"""Tes pendaftaran, /me, anggota tim, dan pembatasan peran."""
import os
import tempfile

os.environ["DATABASE_URL"] = f"sqlite:///{os.path.join(tempfile.mkdtemp(), 'team.db')}"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from database import Base, engine  # noqa: E402
from main import app  # noqa: E402

client = TestClient(app)


@pytest.fixture(autouse=True)
def fresh_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def login(email, password="rahasia1"):
    res = client.post("/api/auth/login", data={"username": email, "password": password})
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def register_owner(email="owner@toko.com", store="Toko Sejahtera"):
    res = client.post("/api/auth/register", json={"email": email, "password": "rahasia1", "name": "Bu Sari", "store_name": store})
    assert res.status_code == 200, res.text
    h = login(email)
    ws_id = client.get("/api/auth/me", headers=h).json()["memberships"][0]["workspace_id"]
    return h, ws_id


def add(h, ws, email, role, password="rahasia1", name=None):
    return client.post(f"/api/workspaces/{ws}/members", headers=h,
                       json={"email": email, "password": password, "role": role, "name": name})


def test_register_with_store_makes_owner():
    h, ws = register_owner()
    me = client.get("/api/auth/me", headers=h).json()
    assert me["name"] == "Bu Sari"
    assert me["memberships"] == [{"workspace_id": ws, "workspace_name": "Toko Sejahtera", "role": "OWNER"}]


def test_register_rejects_duplicate_and_short_password():
    register_owner()
    assert client.post("/api/auth/register", json={"email": "OWNER@toko.com", "password": "rahasia1"}).status_code == 400
    assert client.post("/api/auth/register", json={"email": "baru@toko.com", "password": "123"}).status_code == 422


def test_owner_adds_cashier_who_can_login_and_sell_but_not_manage():
    h, ws = register_owner()
    res = add(h, ws, "Kasir@Toko.com", "CASHIER", name="Andi")
    assert res.status_code == 201
    assert res.json()["email"] == "kasir@toko.com" and res.json()["name"] == "Andi"
    assert res.json()["new_account"] is True

    kasir = login("kasir@toko.com")
    assert client.get(f"/api/workspaces/{ws}/products", headers=kasir).status_code == 200
    assert client.get(f"/api/workspaces/{ws}/members", headers=kasir).status_code == 403
    assert client.get(f"/api/workspaces/{ws}/reports/dashboard", headers=kasir).status_code == 403
    product = {"sku": "X", "name": "X", "unit": "pcs", "selling_price": 1, "current_hpp": 1, "current_stock": 1}
    assert client.post(f"/api/products?workspace_id={ws}", headers=kasir, json=product).status_code == 403
    assert client.get(f"/api/workspaces/{ws}/imports", headers=kasir).status_code == 403


def test_existing_account_is_added_without_password():
    h, ws = register_owner()
    client.post("/api/auth/register", json={"email": "budi@toko.com", "password": "rahasia1"})
    res = client.post(f"/api/workspaces/{ws}/members", headers=h, json={"email": "budi@toko.com", "role": "MANAGER"})
    assert res.status_code == 201
    assert res.json()["new_account"] is False
    assert add(h, ws, "budi@toko.com", "CASHIER").status_code == 400  # sudah anggota


def test_new_account_requires_password():
    h, ws = register_owner()
    res = client.post(f"/api/workspaces/{ws}/members", headers=h, json={"email": "x@toko.com", "role": "CASHIER"})
    assert res.status_code == 400


def test_admin_cannot_touch_owner_role():
    h, ws = register_owner()
    add(h, ws, "admin@toko.com", "ADMIN")
    admin = login("admin@toko.com")
    assert add(admin, ws, "owner2@toko.com", "OWNER").status_code == 403
    assert add(admin, ws, "kasir@toko.com", "CASHIER").status_code == 201
    owner_id = client.get("/api/auth/me", headers=h).json()["id"]
    assert client.patch(f"/api/workspaces/{ws}/members/{owner_id}", headers=admin, json={"role": "CASHIER"}).status_code == 403
    assert client.delete(f"/api/workspaces/{ws}/members/{owner_id}", headers=admin).status_code == 403


def test_last_owner_protected_and_cannot_remove_self():
    h, ws = register_owner()
    owner_id = client.get("/api/auth/me", headers=h).json()["id"]
    assert client.patch(f"/api/workspaces/{ws}/members/{owner_id}", headers=h, json={"role": "ADMIN"}).status_code == 400
    assert client.delete(f"/api/workspaces/{ws}/members/{owner_id}", headers=h).status_code == 400

    second = add(h, ws, "owner2@toko.com", "OWNER").json()["user_id"]
    assert client.patch(f"/api/workspaces/{ws}/members/{owner_id}", headers=h, json={"role": "ADMIN"}).status_code == 200
    # Sekarang hanya owner2 yang Owner.
    o2 = login("owner2@toko.com")
    assert client.patch(f"/api/workspaces/{ws}/members/{second}", headers=o2, json={"role": "ADMIN"}).status_code == 400


def test_remove_member_revokes_access():
    h, ws = register_owner()
    uid = add(h, ws, "kasir@toko.com", "CASHIER").json()["user_id"]
    kasir = login("kasir@toko.com")
    assert client.delete(f"/api/workspaces/{ws}/members/{uid}", headers=h).status_code == 204
    assert client.get(f"/api/workspaces/{ws}/products", headers=kasir).status_code == 403
    assert client.get("/api/auth/me", headers=kasir).json()["memberships"] == []


def test_reset_password_only_for_single_store_accounts():
    h, ws = register_owner()
    uid = add(h, ws, "kasir@toko.com", "CASHIER").json()["user_id"]
    assert client.post(f"/api/workspaces/{ws}/members/{uid}/password", headers=h, json={"password": "barubaru"}).status_code == 204
    login("kasir@toko.com", "barubaru")

    # Akun yang juga ada di toko lain tidak boleh di-reset.
    h2, ws2 = register_owner("lain@toko.com", "Toko Lain")
    client.post(f"/api/workspaces/{ws2}/members", headers=h2, json={"email": "kasir@toko.com", "role": "CASHIER"})
    assert client.post(f"/api/workspaces/{ws}/members/{uid}/password", headers=h, json={"password": "ambilalih"}).status_code == 400


def test_other_store_owner_has_no_access():
    h, ws = register_owner()
    h2, _ = register_owner("lain@toko.com", "Toko Lain")
    assert client.get(f"/api/workspaces/{ws}/members", headers=h2).status_code == 403
    assert client.get(f"/api/workspaces/{ws}/imports", headers=h2).status_code == 403
