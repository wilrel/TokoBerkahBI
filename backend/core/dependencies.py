from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session
import models
from database import get_db
import os

SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-this-in-production")
ALGORITHM = os.getenv("ALGORITHM", "HS256")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    user = db.query(models.User).filter(models.User.email == email).first()
    if user is None:
        raise credentials_exception
    return user


# Peran yang boleh mengelola data toko (produk, stok, pembelian, import, laporan).
MANAGE_ROLES = {models.RoleEnum.OWNER, models.RoleEnum.ADMIN, models.RoleEnum.MANAGER}
# Peran yang boleh mengelola anggota tim.
TEAM_ROLES = {models.RoleEnum.OWNER, models.RoleEnum.ADMIN}


def require_member(db: Session, workspace_id: int, user: models.User, roles=None) -> models.WorkspaceMember:
    """Pastikan user anggota workspace (dan punya salah satu `roles` bila diberikan)."""
    member = db.query(models.WorkspaceMember).filter(
        models.WorkspaceMember.workspace_id == workspace_id,
        models.WorkspaceMember.user_id == user.id,
    ).first()
    if not member:
        raise HTTPException(status_code=403, detail="Not a member of this workspace")
    if roles is not None and member.role not in roles:
        raise HTTPException(status_code=403, detail="Peran Anda tidak punya akses untuk tindakan ini")
    return member
