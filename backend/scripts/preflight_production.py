"""Comprobación offline de configuración de producción, sin imprimir secretos."""
from __future__ import annotations
import os
import sys
from urllib.parse import urlsplit

def check(env: dict[str,str]) -> list[str]:
    issues=[]
    production=env.get('ENVIRONMENT','').strip().lower() == 'production'
    if not production:
        issues.append('ENVIRONMENT debe ser production para este preflight')
    secret=env.get('JWT_SECRET','')
    if len(secret)<48 or secret.lower() in {'change-me','your-secret','test-secret','secret'}:
        issues.append('JWT_SECRET debe ser aleatorio y de al menos 48 caracteres')
    db=env.get('DATABASE_URL','')
    if not db.startswith(('postgresql+psycopg://','postgresql://')):
        issues.append('DATABASE_URL debe ser PostgreSQL; comprueba el driver psycopg')
    else:
        parsed=urlsplit(db)
        if parsed.hostname in {'localhost','127.0.0.1','db'}:
            issues.append('DATABASE_URL parece señalar a una base local')
    if env.get('REFRESH_COOKIE_SECURE','').lower() not in ('true','1','yes'):
        issues.append('REFRESH_COOKIE_SECURE debe ser true')
    origins=[x.strip() for x in env.get('CORS_ORIGINS','').split(',') if x.strip()]
    if not origins or any(o=='*' or not o.startswith('https://') for o in origins):
        issues.append('CORS_ORIGINS requiere orígenes HTTPS concretos, sin wildcard')
    if env.get('PUSH_ENABLED','').lower() not in ('false','0','no'):
        issues.append('PUSH_ENABLED debe permanecer false antes de autorizar un ensayo de envío')
    if env.get('MONITORING_ENABLED','').lower() in ('true','1','yes') and not env.get('MONITORING_ACTOR_USER_ID','').strip():
        issues.append('Falta MONITORING_ACTOR_USER_ID para el servicio cron')
    return issues

if __name__ == '__main__':
    failures=check(dict(os.environ))
    if failures:
        for item in failures: print('ERROR: '+item)
        sys.exit(1)
    print('PASS: Configuración de producción revisada (sin verificar servicios externos)')
