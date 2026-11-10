"""Anggota tim toko: lihat, tambah karyawan, ubah peran, keluarkan, reset password.

Aturan:
- Hanya Owner dan Admin yang boleh mengelola anggota.
- Admin tidak boleh menyentuh Owner atau menjadikan seseorang Owner.
- Toko harus selalu punya minimal satu Owner.
- Tidak bisa mengeluarkan diri sendiri.
- Reset password hanya untuk akun yang tidak tergabung di toko lain,
  supaya pemilik satu toko tidak bisa mengambil alih akun di toko lain.
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import schemas
from core.dependencies import TEAM_ROLES, get_current_user, require_member
from core.security import get_password_hash
from database import get_db

router = APIRouter(prefix="/api/workspaces/{workspace_id}/members", tags=["members"])

OWNER = models.RoleEnum.OWNER


def _to_response(member: models.WorkspaceMember, user: models.User) -> dict:
    return {
        "user_id": user.id,
        "email": user.email,
        "name": user.name,
        "role": member.role,
        "joined_at": member.created_at,
    }


def _get_target(db: Session, workspace_id: int, user_id: int):
    row = (
        db.query(models.WorkspaceMember, models.User)
        .join(models.User, models.User.id == models.WorkspaceMember.user_id)
        .filter(models.WorkspaceMember.workspace_id == workspace_id, models.WorkspaceMember.user_id == user_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Anggota tidak ditemukan")
    return row


def _owner_count(db: Session, workspace_id: int) -> int:
    return db.query(models.WorkspaceMember).filter(
        models.WorkspaceMember.workspace_id == workspace_id, models.WorkspaceMember.role == OWNER
    ).count()


def _guard_admin(actor: models.WorkspaceMember, target_role: models.RoleEnum, new_role: models.RoleEnum = None):
    if actor.role != OWNER and (target_role == OWNER or new_role == OWNER):
        raise HTTPException(status_code=403, detail="Hanya Owner yang bisa mengatur peran Owner")


@router.get("", response_model=List[schemas.MemberResponse])
def list_members(workspace_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    require_member(db, workspace_id, current_user, TEAM_ROLES)
    rows = (
        db.query(models.WorkspaceMember, models.User)
        .join(models.User, models.User.id == models.WorkspaceMember.user_id)
        .filter(models.WorkspaceMember.workspace_id == workspace_id)
        .order_by(models.WorkspaceMember.created_at)
        .all()
    )
    return [_to_response(m, u) for m, u in rows]


@router.post("", response_model=schemas.MemberResponse, status_code=201)
def add_member(
    workspace_id: int,
    body: schemas.MemberCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    actor = require_member(db, workspace_id, current_user, TEAM_ROLES)
    _guard_admin(actor, body.role)

    email = body.email.strip().lower()
    user = db.query(models.User).filter(models.User.email == email).first()
    if user is None:
        if not body.password:
            raise HTTPException(status_code=400, detail="Password awal wajib diisi untuk akun baru")
        user = models.User(email=email, name=(body.name or "").strip() or None, password_hash=get_password_hash(body.password))
        db.add(user)
        db.flush()
    elif db.query(models.WorkspaceMember).filter(
        models.WorkspaceMember.workspace_id == workspace_id, models.WorkspaceMember.user_id == user.id
    ).first():
        raise HTTPException(status_code=400, detail="Orang ini sudah menjadi anggota toko")

    member = models.WorkspaceMember(workspace_id=workspace_id, user_id=user.id, role=body.role)
    db.add(member)
    db.commit()
    db.refresh(member)
    return _to_response(member, user)


@router.patch("/{user_id}", response_model=schemas.MemberResponse)
def update_member(
    workspace_id: int,
    user_id: int,
    body: schemas.MemberUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    actor = require_member(db, workspace_id, current_user, TEAM_ROLES)
    member, user = _get_target(db, workspace_id, user_id)
    _guard_admin(actor, member.role, body.role)
    if member.role == OWNER and body.role != OWNER and _owner_count(db, workspace_id) <= 1:
        raise HTTPException(status_code=400, detail="Toko harus punya minimal satu Owner")

    member.role = body.role
    db.commit()
    db.refresh(member)
    return _to_response(member, user)


@router.delete("/{user_id}", status_code=204)
def remove_member(
    workspace_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    actor = require_member(db, workspace_id, current_user, TEAM_ROLES)
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Anda tidak bisa mengeluarkan diri sendiri")
    member, _ = _get_target(db, workspace_id, user_id)
    _guard_admin(actor, member.role)
    if member.role == OWNER and _owner_count(db, workspace_id) <= 1:
        raise HTTPException(status_code=400, detail="Toko harus punya minimal satu Owner")

    db.delete(member)
    db.commit()


@router.post("/{user_id}/password", status_code=204)
def reset_password(
    workspace_id: int,
    user_id: int,
    body: schemas.PasswordReset,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    actor = require_member(db, workspace_id, current_user, TEAM_ROLES)
    member, user = _get_target(db, workspace_id, user_id)
    _guard_admin(actor, member.role)
    other_stores = db.query(models.WorkspaceMember).filter(
        models.WorkspaceMember.user_id == user_id, models.WorkspaceMember.workspace_id != workspace_id
    ).count()
    if other_stores:
        raise HTTPException(status_code=400, detail="Akun ini juga dipakai di toko lain, jadi passwordnya hanya bisa diganti oleh pemilik akun")

    user.password_hash = get_password_hash(body.password)
    db.commit()
