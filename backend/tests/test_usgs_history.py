"""Sin tráfico externo ni cambios en Supabase."""
import os
os.environ['DATABASE_URL']='sqlite+pysqlite:///:memory:'
os.environ['JWT_SECRET']='local-test-secret-0123456789-sismoia-tests'
from datetime import date, datetime, timezone
from copy import deepcopy
import pytest
import httpx
from sqlalchemy import create_engine, select, func
from sqlalchemy.orm import Session
from app.db import Base
from app.models import SeismicEvent, IngestionRun
from app.ingestion import fetch_usgs, sync_usgs_history


def fake_service(n=1):
    requests=[]
    def handler(request):
        requests.append(dict(request.url.params))
        limit=int(request.url.params['limit'])
        offset=int(request.url.params['offset'])
        features=[]
        for i in range(offset, min(offset+limit,n+1)):
            features.append({'type':'Feature','id':f'history-{i}', 'geometry':{'coordinates':[-77,-12,30]},
                             'properties':{'mag':3.1 if i%2 else 5.2,'time':1720000000000}})
        return httpx.Response(200,json={'type':'FeatureCollection','features':features})
    return httpx.Client(transport=httpx.MockTransport(handler)),requests


def test_range_request_and_offset():
    client, requests=fake_service()
    with client:
        fetch_usgs(start_at=datetime(2024,1,1,tzinfo=timezone.utc),end_at=datetime(2024,1,10,tzinfo=timezone.utc),limit=25,offset=26,client=client)
    assert requests[0]['offset']=='26' and requests[0]['starttime'].startswith('2024-01-01')


@pytest.mark.parametrize('start,end,chunk,pages',[
    (date(2025,1,2),date(2025,1,1),14,10),
    (date(2020,1,1),date(2021,1,1),14,10),
    (date(2025,1,1),date(2025,1,2),0,10),
    (date(2025,1,1),date(2025,1,2),14,11),
    (date(2026,12,1),date(2026,12,2),14,10),
])
def test_reject_invalid_ranges(start,end,chunk,pages):
    engine=create_engine('sqlite+pysqlite:///:memory:')
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        with pytest.raises(ValueError):
            sync_usgs_history(db,start_date=start,end_date=end,chunk_days=chunk,max_pages=pages)
    engine.dispose()


def test_multiwindow_pagination_and_idempotency():
    engine=create_engine('sqlite+pysqlite:///:memory:')
    Base.metadata.create_all(engine)
    client, requests=fake_service(3)
    with Session(engine) as db, client:
        kwargs={'start_date':date(2024,1,1),'end_date':date(2024,1,5),'chunk_days':2,'page_size':2,'max_pages':3,'client':client}
        first=sync_usgs_history(db,**kwargs)
        assert first['windows_completed']==3 and first['inserted']==3
        assert db.scalar(select(func.count()).select_from(SeismicEvent))==3
        again=sync_usgs_history(db,**kwargs)
        assert again['inserted']==0 and again['updated']==9
        assert db.scalar(select(func.count()).select_from(SeismicEvent))==3
        assert db.scalar(select(func.count()).select_from(IngestionRun))==6
        assert any(x['offset']=='3' for x in requests)
    engine.dispose()


def test_saturation_does_not_commit_partial_window():
    engine=create_engine('sqlite+pysqlite:///:memory:')
    Base.metadata.create_all(engine)
    client,_=fake_service(10)
    with Session(engine) as db, client:
        with pytest.raises(ValueError,match='saturada'):
            sync_usgs_history(db,start_date=date(2024,1,1),end_date=date(2024,1,2),page_size=2,max_pages=2,client=client)
        assert db.scalar(select(func.count()).select_from(SeismicEvent))==0
        assert db.scalar(select(IngestionRun.status))=='failed'
    engine.dispose()
