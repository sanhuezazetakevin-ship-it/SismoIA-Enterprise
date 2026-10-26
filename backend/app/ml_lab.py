"""Fase 6: evaluación retrospectiva de clasificación de magnitudes OBSERVADAS.

No pronostica eventos futuros, ubicación, fecha ni magnitud de terremotos.
Sin artefactos persistentes; resultados provisionales y exploratorios.
"""
from collections import Counter
from datetime import datetime, timedelta, timezone
import hashlib
import json
import math

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, balanced_accuracy_score, f1_score, confusion_matrix
from app.auth import db_session, require
from app.models import SeismicEvent, DataSource

router = APIRouter(prefix='/api/v1/ml', tags=['Experimental machine learning'])
MAX_EVENTS = 5000
MIN_EVENTS = 40
FEATURE_NAMES = ['latitude', 'longitude', 'depth_km']


def prepare(records, threshold=4.0):
    """Filter missing/invalid data, order chronologically and dedupe by source event id."""
    prepared = []
    seen = set()
    exclusions = Counter()
    for event, source in records:
        key = (source, event.external_id)
        if key in seen:
            exclusions['duplicate_source_id'] += 1
            continue
        seen.add(key)
        if event.occurred_at is None:
            exclusions['missing_time'] += 1
            continue
        values = [event.latitude, event.longitude, event.depth_km, event.magnitude]
        if any(v is None or not math.isfinite(float(v)) for v in values):
            exclusions['missing_or_nonfinite'] += 1
            continue
        lat, lon, depth, magnitude = map(float, values)
        if not (-90 <= lat <= 90 and -180 <= lon <= 180 and 0 <= depth <= 750 and -2 <= magnitude <= 10):
            exclusions['outside_review_bounds'] += 1
            continue
        moment = event.occurred_at
        if moment.tzinfo is None:
            moment = moment.replace(tzinfo=timezone.utc)
        prepared.append((moment.astimezone(timezone.utc), str(event.id), [lat, lon, depth], int(magnitude >= threshold)))
    prepared.sort(key=lambda row: (row[0], row[1]))
    return prepared, dict(exclusions)


def evaluate(records, threshold=4.0):
    data, exclusions = prepare(records, threshold)
    n = len(data)
    if n < MIN_EVENTS:
        raise ValueError(f'Se requieren al menos {MIN_EVENTS} eventos válidos; disponibles: {n}.')
    train_n = int(n * 0.8)
    train, test = data[:train_n], data[train_n:]
    # Avoid splitting events that have exactly the same observation timestamp.
    boundary = test[0][0]
    while train and train[-1][0] == boundary:
        test.insert(0, train.pop())
    if len(train) < 30 or len(test) < 8:
        raise ValueError('No hay suficientes eventos con fechas distintas para una evaluación cronológica.')
    X_train = [r[2] for r in train]
    y_train = [r[3] for r in train]
    X_test = [r[2] for r in test]
    y_test = [r[3] for r in test]
    if len(set(y_train)) < 2 or len(set(y_test)) < 2:
        raise ValueError('Ambos segmentos temporales deben contener ejemplos de ambas categorías de magnitud.')
    baseline = DummyClassifier(strategy='most_frequent')
    model = RandomForestClassifier(n_estimators=80, max_depth=6, min_samples_leaf=3, random_state=42, n_jobs=1, class_weight='balanced')
    baseline.fit(X_train, y_train)
    model.fit(X_train, y_train)
    pred = model.predict(X_test)
    base_pred = baseline.predict(X_test)
    metrics = lambda y,p: {'accuracy':round(float(accuracy_score(y,p)),4),
        'balanced_accuracy':round(float(balanced_accuracy_score(y,p)),4),
        'f1_macro':round(float(f1_score(y,p,labels=[0,1],average='macro',zero_division=0)),4)}
    manifest = [{'time':r[0].isoformat(),'id':r[1],'features':r[2],'class':r[3]} for r in data]
    digest = hashlib.sha256(json.dumps(manifest,sort_keys=True,separators=(',',':')).encode()).hexdigest()
    return {
      'study':'Clasificación retrospectiva de magnitud registrada',
      'target':f'Magnitud observada >= {threshold:g}', 'threshold':threshold,
      'features':FEATURE_NAMES, 'n_total':n,'n_train':len(train),'n_test':len(test),
      'class_counts':{'below_threshold':sum(1 for r in data if r[3]==0),'at_or_above_threshold':sum(1 for r in data if r[3]==1)},
      'excluded':exclusions,'split':'80/20 cronológico sin mezcla y sin compartir fecha exacta',
      'train_end_utc':train[-1][0].isoformat(),'test_start_utc':test[0][0].isoformat(),
      'model':'RandomForestClassifier(n_estimators=80, max_depth=6, min_samples_leaf=3, random_state=42)',
      'baseline':'DummyClassifier(strategy=most_frequent)',
      'metrics':metrics(y_test,pred),'baseline_metrics':metrics(y_test,base_pred),
      'confusion_matrix':confusion_matrix(y_test,pred,labels=[0,1]).tolist(),
      'dataset_sha256':digest,
      'limitations':[ 'NO predice terremotos futuros, fecha, ubicación ni riesgo sísmico.',
        'Evaluación retrospectiva exploratoria, no validación para alertas o decisiones de seguridad.',
        'Muestras de USGS/IGP pueden reflejar sesgos de selección y cobertura.',
        'La profundidad se conoce después de observar el evento; no es una característica prospectiva.',
        'El modelo solo existe en memoria durante la solicitud; no se guarda ni publica.' ]
    }


@router.post('/experiments/evaluate')
def run_experiment(days:int=Query(365,ge=7,le=3650),peru_only:bool=True,
                   threshold:float=Query(4.0,ge=0,le=9),
                   user=Depends(require('modelos.entrenar')),db:Session=Depends(db_session)):
    from app.live_catalog import collect
    # La consulta de datos sucede solo al ejecutar un experimento autorizado.
    records,meta=collect(days=days,peru_only=peru_only,max_events=MAX_EVENTS)
    try:
        result=evaluate(records,threshold)
    except ValueError as exc:
        raise HTTPException(422,str(exc)) from exc
    return {'days':days,'peru_only':peru_only,**meta,**result}
