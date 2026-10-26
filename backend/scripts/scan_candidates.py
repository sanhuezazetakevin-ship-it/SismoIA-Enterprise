"""Unattended scan, run once: python -m scripts.scan_candidates

Configure MONITORING_ENABLED=true and MONITORING_ACTOR_USER_ID=<existing authorized user UUID>.
Schedule this command with Windows Task Scheduler only after manual verification.
"""
import sys
from app.config import settings
from app.db import SessionLocal
from app.auth_models import User
from app.monitoring import scan


def main():
    if not settings.monitoring_enabled or not settings.monitoring_actor_user_id:
        raise SystemExit('Monitoreo desactivado o MONITORING_ACTOR_USER_ID no configurado')
    with SessionLocal() as db:
        actor=db.get(User,settings.monitoring_actor_user_id)
        try:
            result=scan(db,actor)
        except Exception as exc:
            db.rollback()
            raise SystemExit(f'Escaneo no completado: {exc}') from exc
        print(result)

if __name__=='__main__':main()
