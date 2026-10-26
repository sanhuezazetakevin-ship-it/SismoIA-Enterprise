from scripts.preflight_production import check

def valid():
    return {'ENVIRONMENT':'production','JWT_SECRET':'A'*64,'DATABASE_URL':'postgresql+psycopg://u:p@database.example.com:5432/sismo','REFRESH_COOKIE_SECURE':'true','CORS_ORIGINS':'https://sismo.example.com','PUSH_ENABLED':'false','MONITORING_ENABLED':'false'}

def test_safe_config_passes():
    assert check(valid()) == []

def test_insecure_cookie_and_cors_rejected():
    e=valid(); e['REFRESH_COOKIE_SECURE']='false';e['CORS_ORIGINS']='*'
    assert len(check(e))==2

def test_monitor_requires_actor_and_push_disabled():
    e=valid();e['MONITORING_ENABLED']='true';e['PUSH_ENABLED']='true'
    assert len(check(e))==2

def test_no_local_db_or_weak_secret():
    e=valid();e['DATABASE_URL']='postgresql+psycopg://x:y@localhost/z';e['JWT_SECRET']='abc'
    assert len(check(e))==2
