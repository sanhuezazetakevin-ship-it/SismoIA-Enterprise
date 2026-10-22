"""Run once after migration 002: python -m scripts.bootstrap_auth"""
import getpass
from sqlalchemy import select
from app.db import SessionLocal
from app.auth_models import User,Role,Permission,UserRole,RolePermission
from app.security import hash_password

CATALOG={
 'ADMINISTRADOR':['usuarios.ver','usuarios.crear','usuarios.editar','roles.asignar','auditoria.ver','fuentes.administrar','modelos.entrenar','alertas.configurar','alertas.aprobar','reportes.generar','eventos.ver'],
 'ANALISTA':['eventos.ver','modelos.entrenar','reportes.generar'],
 'OPERADOR_ALERTAS':['eventos.ver','alertas.configurar','alertas.aprobar'],
 'AUDITOR':['auditoria.ver','eventos.ver'],
 'CONSULTA':['eventos.ver']
}

def run():
    with SessionLocal() as db:
        role_objs={}; perm_objs={}
        for name in sorted({p for pp in CATALOG.values() for p in pp}):
            obj=db.scalar(select(Permission).where(Permission.code==name))
            if not obj: obj=Permission(code=name);db.add(obj);db.flush()
            perm_objs[name]=obj
        for name,perms in CATALOG.items():
            role=db.scalar(select(Role).where(Role.code==name))
            if not role: role=Role(code=name,description=name.replace('_',' ').title());db.add(role);db.flush()
            role_objs[name]=role
            for p in perms:
                if not db.get(RolePermission, (role.id,perm_objs[p].id)):
                    db.add(RolePermission(role_id=role.id,permission_id=perm_objs[p].id))
        db.commit()
        if db.scalar(select(User.id).limit(1)):
            print('Roles y permisos preparados. Ya existe un usuario; no se crea otro administrador.');return
        email=input('Correo del primer administrador: ').strip().lower()
        if not email or '@' not in email: raise SystemExit('Correo inválido')
        name=input('Nombre completo: ').strip()
        password=getpass.getpass('Contraseña (mínimo 12 caracteres): ')
        repeat=getpass.getpass('Repetir contraseña: ')
        if password!=repeat: raise SystemExit('Las contraseñas no coinciden')
        password_hash=hash_password(password)
        user=User(email=email,full_name=name,password_hash=password_hash)
        db.add(user);db.flush();db.add(UserRole(user_id=user.id,role_id=role_objs['ADMINISTRADOR'].id));db.commit()
        print('Primer administrador creado correctamente.')
if __name__=='__main__':run()
