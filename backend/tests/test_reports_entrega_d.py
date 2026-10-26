"""Offline report correctness and RBAC behaviour tests; no USGS network required."""
import csv
import io
import pytest
from fastapi import HTTPException
from app.reports.exporters import csv_bytes,pdf_bytes
from app.reports.routes import utc,download,history
from app.reports.service import describe
from datetime import datetime,timezone
from unittest.mock import patch
from tests.test_security_automated import setup_api


def test_csv_safe_and_traceable():
    data=csv_bytes(['id','formula'],[['abc','=HYPERLINK("https://bad")']],{'Fuente':'USGS','Solicitante':'Analista'})
    assert data.startswith(b'\xef\xbb\xbf')
    rows=list(csv.reader(io.StringIO(data.decode('utf-8-sig'))))
    assert rows[0]==['Fuente','USGS']
    assert rows[1]==['Solicitante','Analista']
    assert rows[4][1].startswith("'=")


def test_pdf_signature_and_details():
    meta={'Fuente':'USGS','Solicitante':'Analista','Fecha de corte':'2026-10-25','Alcance':'Eventos guardados'}
    body=pdf_bytes(['magnitud','evento'],[[4.2,'us123']],meta,[('Eventos en reporte','1')])
    assert body[:5]==b'%PDF-'
    assert len(body)>1000


def test_dates_require_explicit_timezone_and_order():
    with pytest.raises(HTTPException) as e:utc(datetime(2026,10,25))
    assert e.value.status_code==422
    assert utc(datetime(2026,10,25,tzinfo=timezone.utc)).tzinfo==timezone.utc


def test_descriptions():
    assert describe([], 'events')[0]==('Eventos en reporte','0')
    assert ('Estado pending','2') in describe([[None,None,None,None,None,'pending']]*2,'alerts')


def test_report_validation_before_database_calls():
    class Actor:pass
    actor=Actor();actor.id='u';actor.full_name='Tester'
    class DB:pass
    with pytest.raises(HTTPException) as e:download(category='bad',format='csv',actor=actor,db=DB())
    assert e.value.status_code==422
    with pytest.raises(HTTPException) as e:download(category='events',format='zip',actor=actor,db=DB())
    assert e.value.status_code==422


def test_report_audit_and_mime():
    class Actor: id='actor';full_name='Analista'
    class DB:
        def __init__(self):self.objects=[];self.committed=False
        def add(self,x):self.objects.append(x)
        def flush(self):
            for item in self.objects:
                if getattr(item,'id',None) is None:item.id='generated-id'
        def commit(self):self.committed=True
    db=DB()
    with patch('app.reports.routes.rows_for',return_value=(['id'],[['1']], 'Datos de prueba')),patch('app.reports.routes.audit'):
        response=download(category='events',format='csv',actor=Actor(),db=db)
    assert db.committed
    assert response.headers['cache-control']=='no-store'
    assert response.headers['content-disposition'].endswith('.csv"')
    assert db.objects[0].rows_count==1


def test_download_authorization_and_persisted_history(setup_api):
    from tests.test_security_automated import login
    from sqlalchemy import select
    from app.report_models import ReportExport
    client,Session=setup_api
    assert client.get('/api/v1/reports/download').status_code==401
    assert client.get('/api/v1/reports/download',headers=login(client,'CONSULTA')).status_code==403
    headers=login(client,'ANALISTA')
    exported=client.get('/api/v1/reports/download?category=events&format=csv',headers=headers)
    assert exported.status_code==200,exported.text
    assert 'USGS' in exported.text
    assert exported.headers['content-type'].startswith('text/csv')
    pdf=client.get('/api/v1/reports/download?category=alerts&format=pdf',headers=headers)
    assert pdf.status_code==200 and pdf.content.startswith(b'%PDF-')
    entries=client.get('/api/v1/reports/exports',headers=headers)
    assert entries.status_code==200 and len(entries.json())==2
    with Session() as db:
        assert len(db.scalars(select(ReportExport)).all())==2
