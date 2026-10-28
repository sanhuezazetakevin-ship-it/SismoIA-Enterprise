"""Script para inicializar roles, permisos y las 5 cuentas de demostración."""
import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from sqlalchemy import select
from app.db import SessionLocal
from app.auth_models import User, Role, Permission, UserRole, RolePermission
from app.models import DataSource
from app.security import hash_password
from scripts.bootstrap_auth import CATALOG

PASSWORD = "Password-for-local-tests-2026!"

DEMO_USERS = [
    {
        "email": "administrador@example.com",
        "full_name": "Administrador Principal",
        "role": "ADMINISTRADOR",
    },
    {
        "email": "analista@example.com",
        "full_name": "Analista de Datos",
        "role": "ANALISTA",
    },
    {
        "email": "operador_alertas@example.com",
        "full_name": "Operador de Alertas",
        "role": "OPERADOR_ALERTAS",
    },
    {
        "email": "auditor@example.com",
        "full_name": "Auditor de Seguridad",
        "role": "AUDITOR",
    },
    {
        "email": "consulta@example.com",
        "full_name": "Usuario de Consulta",
        "role": "CONSULTA",
    },
]

def seed():
    with SessionLocal() as db:
        print("1. Creando catálogo de permisos y roles...")
        role_objs = {}
        perm_objs = {}
        
        # Permissions
        for name in sorted({p for pp in CATALOG.values() for p in pp}):
            obj = db.scalar(select(Permission).where(Permission.code == name))
            if not obj:
                obj = Permission(code=name)
                db.add(obj)
                db.flush()
            perm_objs[name] = obj

        # Roles
        for name, perms in CATALOG.items():
            role = db.scalar(select(Role).where(Role.code == name))
            if not role:
                role = Role(code=name, description=name.replace('_', ' ').title())
                db.add(role)
                db.flush()
            role_objs[name] = role
            for p in perms:
                if not db.get(RolePermission, (role.id, perm_objs[p].id)):
                    db.add(RolePermission(role_id=role.id, permission_id=perm_objs[p].id))
        
        db.commit()
        print("-> Roles y permisos listos.")

        print("2. Creando data source inicial (USGS)...")
        ds = db.scalar(select(DataSource).where(DataSource.name == "USGS Earthquake Hazards Program"))
        if not ds:
            ds = DataSource(
                name="USGS Earthquake Hazards Program",
                base_url="https://earthquake.usgs.gov/fdsnws/event/1/",
                status="active"
            )
            db.add(ds)
            db.commit()
            print("-> Data source USGS registrada.")
        else:
            print("-> Data source USGS ya existe.")

        print("3. Creando usuarios de demostración...")
        pw_hash = hash_password(PASSWORD)
        for uinfo in DEMO_USERS:
            user = db.scalar(select(User).where(User.email == uinfo["email"]))
            if not user:
                user = User(
                    email=uinfo["email"],
                    full_name=uinfo["full_name"],
                    password_hash=pw_hash,
                    is_active=True,
                )
                db.add(user)
                db.flush()
                db.add(UserRole(user_id=user.id, role_id=role_objs[uinfo["role"]].id))
                print(f"-> Creado: {uinfo['email']} [{uinfo['role']}]")
            else:
                user.password_hash = pw_hash
                user.is_active = True
                # Asegurar rol
                existing_ur = db.scalar(select(UserRole).where(UserRole.user_id == user.id))
                if not existing_ur:
                    db.add(UserRole(user_id=user.id, role_id=role_objs[uinfo["role"]].id))
                print(f"-> Actualizado: {uinfo['email']} [{uinfo['role']}]")

        db.commit()
        print("\n¡Sembrado completado con éxito!")

if __name__ == "__main__":
    seed()
