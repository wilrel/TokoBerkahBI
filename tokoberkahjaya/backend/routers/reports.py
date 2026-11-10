"""Laporan & dashboard: ringkasan penjualan dan laporan laba rugi.

Semua angka dihitung dari data yang sudah ada:
- Pendapatan  = sum(qty * selling_price) dari TransactionItem
- HPP         = sum(qty * hpp) dari TransactionItem (HPP dikunci saat transaksi)
- Selisih stok = penyesuaian/opname stok (InventoryMovement ADJUSTMENT/STOCKTAKE),
                 dinilai dengan HPP produk saat ini.

Rentang tanggal dibaca dalam zona waktu workspace (default Asia/Jakarta), jadi
"hari ini" mengikuti jam toko, bukan UTC.
"""
from collections import defaultdict
from datetime import date, datetime, time, timedelta, timezone
from typing import Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from core.dependencies import get_current_user

router = APIRouter(prefix="/api/workspaces/{workspace_id}/reports", tags=["reports"])

# Kasir tidak boleh melihat laba / HPP.
REPORT_ROLES = {models.RoleEnum.OWNER, models.RoleEnum.ADMIN, models.RoleEnum.MANAGER}
LOSS_MOVEMENT_TYPES = (models.MovementTypeEnum.ADJUSTMENT, models.MovementTypeEnum.STOCKTAKE)
MAX_RANGE_DAYS = 366


# ---------------------------------------------------------------- helpers

def _get_workspace_for_reports(workspace_id: int, db: Session, user: models.User) -> models.Workspace:
    member = db.query(models.WorkspaceMember).filter(
        models.WorkspaceMember.workspace_id == workspace_id,
        models.WorkspaceMember.user_id == user.id,
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this workspace")
    if member.role not in REPORT_ROLES:
        raise HTTPException(status_code=403, detail="Role ini tidak punya akses ke laporan")
    workspace = db.query(models.Workspace).filter(models.Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return workspace


def _tz(workspace: models.Workspace) -> ZoneInfo:
    try:
        return ZoneInfo(workspace.timezone or "Asia/Jakarta")
    except Exception:
        return ZoneInfo("Asia/Jakarta")


def _resolve_range(start: Optional[date], end: Optional[date], tz: ZoneInfo, default_days: int):
    today = datetime.now(tz).date()
    end = end or today
    start = start or (end - timedelta(days=default_days - 1))
    if start > end:
        raise HTTPException(status_code=400, detail="start_date harus sebelum atau sama dengan end_date")
    if (end - start).days + 1 > MAX_RANGE_DAYS:
        raise HTTPException(status_code=400, detail=f"Rentang maksimal {MAX_RANGE_DAYS} hari")
    return start, end


def _utc_bounds(start: date, end: date, tz: ZoneInfo):
    """[start 00:00, end+1 00:00) waktu lokal -> UTC."""
    lo = datetime.combine(start, time.min, tzinfo=tz).astimezone(timezone.utc)
    hi = datetime.combine(end + timedelta(days=1), time.min, tzinfo=tz).astimezone(timezone.utc)
    return lo, hi


def _local_date(ts: datetime, tz: ZoneInfo) -> date:
    # SQLite mengembalikan datetime naive (UTC); Postgres mengembalikan aware.
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    return ts.astimezone(tz).date()


def _sales_rows(db: Session, workspace_id: int, lo: datetime, hi: datetime):
    return (
        db.query(
            models.Transaction.id,
            models.Transaction.timestamp,
            models.Transaction.payment_method,
            models.TransactionItem.product_id,
            models.TransactionItem.quantity,
            models.TransactionItem.selling_price,
            models.TransactionItem.hpp,
        )
        .join(models.TransactionItem, models.TransactionItem.transaction_id == models.Transaction.id)
        .filter(
            models.Transaction.workspace_id == workspace_id,
            models.Transaction.timestamp >= lo,
            models.Transaction.timestamp < hi,
        )
        .all()
    )


def _totals(rows) -> dict:
    revenue = sum(r.quantity * r.selling_price for r in rows)
    cogs = sum(r.quantity * r.hpp for r in rows)
    trx_ids = {r.id for r in rows}
    count = len(trx_ids)
    gross = revenue - cogs
    return {
        "revenue": revenue,
        "cogs": cogs,
        "gross_profit": gross,
        "gross_margin_pct": (gross / revenue * 100) if revenue else 0.0,
        "transaction_count": count,
        "items_sold": sum(r.quantity for r in rows),
        "avg_basket": (revenue / count) if count else 0.0,
    }


def _pct_change(current: float, previous: float) -> Optional[float]:
    if not previous:
        return None
    return (current - previous) / abs(previous) * 100


def _product_breakdown(db: Session, workspace_id: int, rows):
    products = {
        p.id: p
        for p in db.query(models.Product).filter(models.Product.workspace_id == workspace_id).all()
    }
    categories = {
        c.id: c.name
        for c in db.query(models.Category).filter(models.Category.workspace_id == workspace_id).all()
    }
    agg = defaultdict(lambda: {"quantity": 0, "revenue": 0.0, "cogs": 0.0})
    for r in rows:
        a = agg[r.product_id]
        a["quantity"] += r.quantity
        a["revenue"] += r.quantity * r.selling_price
        a["cogs"] += r.quantity * r.hpp
    result = []
    for pid, a in agg.items():
        p = products.get(pid)
        gross = a["revenue"] - a["cogs"]
        result.append({
            "product_id": pid,
            "sku": p.sku if p else "-",
            "name": p.name if p else f"Produk #{pid}",
            "unit": p.unit if p else "",
            "category": categories.get(p.category_id, "Tanpa Kategori") if p else "Tanpa Kategori",
            "quantity": a["quantity"],
            "revenue": a["revenue"],
            "cogs": a["cogs"],
            "gross_profit": gross,
            "gross_margin_pct": (gross / a["revenue"] * 100) if a["revenue"] else 0.0,
        })
    return result


# ---------------------------------------------------------------- endpoints

@router.get("/dashboard", response_model=schemas.DashboardResponse)
def get_dashboard(
    workspace_id: int,
    start_date: Optional[date] = Query(None, description="YYYY-MM-DD, default 30 hari terakhir"),
    end_date: Optional[date] = Query(None, description="YYYY-MM-DD, default hari ini"),
    low_stock_threshold: int = Query(5, ge=0),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    workspace = _get_workspace_for_reports(workspace_id, db, current_user)
    tz = _tz(workspace)
    start, end = _resolve_range(start_date, end_date, tz, default_days=30)
    lo, hi = _utc_bounds(start, end, tz)

    rows = _sales_rows(db, workspace_id, lo, hi)
    totals = _totals(rows)

    # Periode sebelumnya dengan panjang yang sama, untuk perbandingan.
    span = (end - start).days + 1
    prev_start, prev_end = start - timedelta(days=span), start - timedelta(days=1)
    plo, phi = _utc_bounds(prev_start, prev_end, tz)
    prev = _totals(_sales_rows(db, workspace_id, plo, phi))

    # Seri harian (semua hari tampil, termasuk yang kosong).
    daily = {start + timedelta(days=i): {"revenue": 0.0, "cogs": 0.0, "trx": set()} for i in range(span)}
    for r in rows:
        d = daily.get(_local_date(r.timestamp, tz))
        if d is None:
            continue
        d["revenue"] += r.quantity * r.selling_price
        d["cogs"] += r.quantity * r.hpp
        d["trx"].add(r.id)
    daily_series = [
        {
            "date": d,
            "revenue": v["revenue"],
            "cogs": v["cogs"],
            "gross_profit": v["revenue"] - v["cogs"],
            "transaction_count": len(v["trx"]),
        }
        for d, v in sorted(daily.items())
    ]

    # Metode pembayaran.
    pay = defaultdict(lambda: {"amount": 0.0, "trx": set()})
    for r in rows:
        pay[r.payment_method]["amount"] += r.quantity * r.selling_price
        pay[r.payment_method]["trx"].add(r.id)
    payment_methods = sorted(
        ({"method": m, "amount": v["amount"], "transaction_count": len(v["trx"])} for m, v in pay.items()),
        key=lambda x: x["amount"],
        reverse=True,
    )

    breakdown = _product_breakdown(db, workspace_id, rows)
    top_products = sorted(breakdown, key=lambda x: x["revenue"], reverse=True)[:5]

    # Kondisi stok saat ini (bukan per periode).
    active = db.query(models.Product).filter(
        models.Product.workspace_id == workspace_id,
        models.Product.is_active == True,  # noqa: E712
    ).all()
    low_stock = sorted(
        (p for p in active if p.current_stock <= low_stock_threshold),
        key=lambda p: p.current_stock,
    )
    sold_ids = {r.product_id for r in rows}

    return {
        "start_date": start,
        "end_date": end,
        "summary": totals,
        "previous_summary": prev,
        "change_pct": {
            "revenue": _pct_change(totals["revenue"], prev["revenue"]),
            "gross_profit": _pct_change(totals["gross_profit"], prev["gross_profit"]),
            "transaction_count": _pct_change(totals["transaction_count"], prev["transaction_count"]),
            "avg_basket": _pct_change(totals["avg_basket"], prev["avg_basket"]),
        },
        "daily": daily_series,
        "payment_methods": payment_methods,
        "top_products": top_products,
        "inventory": {
            "active_products": len(active),
            "stock_value_at_cost": sum(max(p.current_stock, 0) * p.current_hpp for p in active),
            "stock_value_at_price": sum(max(p.current_stock, 0) * p.selling_price for p in active),
            "low_stock_threshold": low_stock_threshold,
            "low_stock_count": len(low_stock),
            "low_stock": [
                {"product_id": p.id, "sku": p.sku, "name": p.name, "unit": p.unit, "current_stock": p.current_stock}
                for p in low_stock[:10]
            ],
            "unsold_in_period_count": sum(1 for p in active if p.id not in sold_ids),
        },
    }


@router.get("/profit-loss", response_model=schemas.ProfitLossResponse)
def get_profit_loss(
    workspace_id: int,
    start_date: Optional[date] = Query(None, description="YYYY-MM-DD, default awal bulan ini"),
    end_date: Optional[date] = Query(None, description="YYYY-MM-DD, default hari ini"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    workspace = _get_workspace_for_reports(workspace_id, db, current_user)
    tz = _tz(workspace)
    today = datetime.now(tz).date()
    if start_date is None and end_date is None:
        start_date, end_date = today.replace(day=1), today
    start, end = _resolve_range(start_date, end_date, tz, default_days=30)
    lo, hi = _utc_bounds(start, end, tz)

    rows = _sales_rows(db, workspace_id, lo, hi)
    totals = _totals(rows)
    breakdown = _product_breakdown(db, workspace_id, rows)

    # Selisih stok (hilang/rusak/opname). Negatif = barang berkurang = kerugian.
    movements = (
        db.query(models.InventoryMovement, models.Product)
        .join(models.Product, models.Product.id == models.InventoryMovement.product_id)
        .filter(
            models.InventoryMovement.workspace_id == workspace_id,
            models.InventoryMovement.type.in_(LOSS_MOVEMENT_TYPES),
            models.InventoryMovement.timestamp >= lo,
            models.InventoryMovement.timestamp < hi,
        )
        .all()
    )
    shrink_loss = sum(-m.quantity * p.current_hpp for m, p in movements if m.quantity < 0)
    shrink_gain = sum(m.quantity * p.current_hpp for m, p in movements if m.quantity > 0)
    stock_adjustment = shrink_gain - shrink_loss

    cat = defaultdict(lambda: {"quantity": 0, "revenue": 0.0, "cogs": 0.0})
    for b in breakdown:
        c = cat[b["category"]]
        c["quantity"] += b["quantity"]
        c["revenue"] += b["revenue"]
        c["cogs"] += b["cogs"]
    by_category = sorted(
        (
            {
                "category": name,
                "quantity": v["quantity"],
                "revenue": v["revenue"],
                "cogs": v["cogs"],
                "gross_profit": v["revenue"] - v["cogs"],
                "gross_margin_pct": ((v["revenue"] - v["cogs"]) / v["revenue"] * 100) if v["revenue"] else 0.0,
            }
            for name, v in cat.items()
        ),
        key=lambda x: x["revenue"],
        reverse=True,
    )

    return {
        "start_date": start,
        "end_date": end,
        "revenue": totals["revenue"],
        "cogs": totals["cogs"],
        "gross_profit": totals["gross_profit"],
        "gross_margin_pct": totals["gross_margin_pct"],
        "stock_loss": shrink_loss,
        "stock_gain": shrink_gain,
        "stock_adjustment": stock_adjustment,
        "profit_after_adjustment": totals["gross_profit"] + stock_adjustment,
        "transaction_count": totals["transaction_count"],
        "items_sold": totals["items_sold"],
        "by_category": by_category,
        "by_product": sorted(breakdown, key=lambda x: x["gross_profit"], reverse=True),
    }
