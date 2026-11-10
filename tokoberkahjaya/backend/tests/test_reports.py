"""Tes endpoint laporan (dashboard & laba rugi).

Jalankan dari folder backend:
    pip install -r requirements-dev.txt
    pytest
"""
import os
import tempfile

# Pakai database SQLite sementara, harus di-set sebelum `database` di-import.
os.environ["DATABASE_URL"] = f"sqlite:///{os.path.join(tempfile.mkdtemp(), 'test.db')}"

from datetime import datetime, timezone  # noqa: E402

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import models  # noqa: E402
from core.security import get_password_hash  # noqa: E402
from database import Base, SessionLocal, engine  # noqa: E402
from main import app  # noqa: E402


@pytest.fixture(scope="module")
def setup():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    owner = models.User(email="owner@test.com", password_hash=get_password_hash("pw"))
    cashier = models.User(email="kasir@test.com", password_hash=get_password_hash("pw"))
    ws = models.Workspace(name="Toko Tes")  # timezone default Asia/Jakarta
    db.add_all([owner, cashier, ws])
    db.commit()
    db.add_all([
        models.WorkspaceMember(workspace_id=ws.id, user_id=owner.id, role=models.RoleEnum.OWNER),
        models.WorkspaceMember(workspace_id=ws.id, user_id=cashier.id, role=models.RoleEnum.CASHIER),
    ])
    cat = models.Category(workspace_id=ws.id, name="Sembako")
    db.add(cat)
    db.commit()

    beras = models.Product(workspace_id=ws.id, category_id=cat.id, sku="BRS", name="Beras", unit="sak",
                           selling_price=75000, current_hpp=70000, current_stock=20)
    gula = models.Product(workspace_id=ws.id, sku="GLA", name="Gula", unit="pcs",
                          selling_price=16000, current_hpp=14500, current_stock=3)
    db.add_all([beras, gula])
    db.commit()

    def sale(ts, items, method="CASH"):
        trx = models.Transaction(workspace_id=ws.id, user_id=owner.id, payment_method=method,
                                 total_amount=0, timestamp=ts)
        db.add(trx)
        db.flush()
        for product, qty in items:
            db.add(models.TransactionItem(transaction_id=trx.id, product_id=product.id, quantity=qty,
                                          selling_price=product.selling_price, hpp=product.current_hpp))
            trx.total_amount += qty * product.selling_price
        db.commit()

    # 9 Nov 18:30 UTC = 10 Nov 01:30 WIB -> harus masuk tanggal 10 Nov.
    sale(datetime(2026, 11, 9, 18, 30, tzinfo=timezone.utc), [(beras, 2), (gula, 1)])
    sale(datetime(2026, 11, 10, 3, 0, tzinfo=timezone.utc), [(gula, 4)], "QRIS")
    # Periode pembanding (sebelum 8 Nov).
    sale(datetime(2026, 11, 5, 3, 0, tzinfo=timezone.utc), [(beras, 1)])
    # Stok gula hilang 2 pcs.
    db.add(models.InventoryMovement(workspace_id=ws.id, product_id=gula.id,
                                    type=models.MovementTypeEnum.ADJUSTMENT, quantity=-2,
                                    previous_stock=5, new_stock=3, user_id=owner.id,
                                    timestamp=datetime(2026, 11, 10, 4, 0, tzinfo=timezone.utc)))
    db.commit()
    ws_id = ws.id
    db.close()

    client = TestClient(app)

    def auth(email):
        res = client.post("/api/auth/login", data={"username": email, "password": "pw"})
        return {"Authorization": f"Bearer {res.json()['access_token']}"}

    return client, ws_id, auth


def test_dashboard_totals_and_timezone(setup):
    client, ws_id, auth = setup
    res = client.get(f"/api/workspaces/{ws_id}/reports/dashboard",
                     params={"start_date": "2026-11-08", "end_date": "2026-11-10"},
                     headers=auth("owner@test.com"))
    assert res.status_code == 200
    data = res.json()

    revenue = 2 * 75000 + 5 * 16000
    assert data["summary"]["revenue"] == revenue
    assert data["summary"]["gross_profit"] == 2 * 5000 + 5 * 1500
    assert data["summary"]["transaction_count"] == 2
    assert data["summary"]["avg_basket"] == revenue / 2

    # Kedua transaksi jatuh di 10 Nov waktu lokal (WIB), bukan 9 Nov.
    assert [d["date"] for d in data["daily"]] == ["2026-11-08", "2026-11-09", "2026-11-10"]
    assert data["daily"][1]["revenue"] == 0
    assert data["daily"][2]["revenue"] == revenue

    assert data["previous_summary"]["revenue"] == 75000
    assert data["change_pct"]["revenue"] == pytest.approx((revenue - 75000) / 75000 * 100)

    assert {p["method"] for p in data["payment_methods"]} == {"CASH", "QRIS"}
    assert data["top_products"][0]["name"] == "Beras"
    assert data["inventory"]["low_stock_count"] == 1  # gula stok 3 <= 5


def test_profit_loss(setup):
    client, ws_id, auth = setup
    res = client.get(f"/api/workspaces/{ws_id}/reports/profit-loss",
                     params={"start_date": "2026-11-01", "end_date": "2026-11-30"},
                     headers=auth("owner@test.com"))
    assert res.status_code == 200
    pl = res.json()

    assert pl["revenue"] == 3 * 75000 + 5 * 16000
    assert pl["gross_profit"] == 3 * 5000 + 5 * 1500
    assert pl["stock_loss"] == 2 * 14500
    assert pl["profit_after_adjustment"] == pl["gross_profit"] - 2 * 14500

    categories = {c["category"]: c for c in pl["by_category"]}
    assert categories["Sembako"]["revenue"] == 3 * 75000
    assert categories["Tanpa Kategori"]["revenue"] == 5 * 16000
    assert len(pl["by_product"]) == 2


def test_cashier_cannot_see_reports(setup):
    client, ws_id, auth = setup
    headers = auth("kasir@test.com")
    assert client.get(f"/api/workspaces/{ws_id}/reports/dashboard", headers=headers).status_code == 403
    assert client.get(f"/api/workspaces/{ws_id}/reports/profit-loss", headers=headers).status_code == 403


def test_invalid_range_rejected(setup):
    client, ws_id, auth = setup
    res = client.get(f"/api/workspaces/{ws_id}/reports/dashboard",
                     params={"start_date": "2026-11-10", "end_date": "2026-11-01"},
                     headers=auth("owner@test.com"))
    assert res.status_code == 400
