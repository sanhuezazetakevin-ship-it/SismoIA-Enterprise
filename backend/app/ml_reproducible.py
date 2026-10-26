"""Snapshot-bound, reproducible *retrospective* experiments. NOT earthquake forecasts."""
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
import math
import sklearn
import pandas
import numpy as np
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from sklearn.dummy import DummyClassifier, DummyRegressor
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score, precision_recall_fscore_support, confusion_matrix
from app.auth import db_session, require, audit
from app.snapshot_models import QuerySnapshot, EventSnapshot
from app.ml_registry_models import DatasetVersion, MLStudy
from app.snapshots import digest

router=APIRouter(prefix='/api/v1/ml',tags=['Versioned experimental ML'])
FEATURES=['latitude','longitude','depth_km']
# Columns deriving from magnitude cannot enter a model whose target is
# the magnitude or its categorical range. This is an explicit testable guard.
PROHIBITED_TARGET_FEATURES={'magnitude','mag','magType','mag_error','magnitude_type',
 'magnitude_error','mag_range','magnitude_range','target','label','observed_magnitude'}
MODEL_QUESTIONS={
 'regression_simple':'¿Qué asociación presenta la profundidad con la magnitud de un evento ya observado?',
 'regression_multiple':'¿Qué asociación tienen profundidad y ubicación con la magnitud observada?',
 'classification':'¿En qué rango de magnitud cae un evento ya observado usando características independientes del objetivo?'
}

def validate_features(features):
    """Fail closed: only reviewed source features are admissible."""
    if not features or any(str(name).strip() not in FEATURES for name in features):
        raise ValueError('Fuga de datos o variable no aprobada en características del modelo.')
    if any(str(name).lower() in {v.lower() for v in PROHIBITED_TARGET_FEATURES} for name in features):
        raise ValueError('Fuga de datos: característica derivada del objetivo.')
    return list(features)

DISCLAIMER='Resultados retrospectivos de eventos observados; NO pronostican terremotos ni constituyen avisos oficiales.'

def clean_rows(rows):
    """Prevent target leakage; do not include magnitude among input features."""
    unique={}; excluded=Counter()
    for raw in rows:
        event_id=str(raw.get('external_id') or '').strip()
        if not event_id:
            excluded['missing_id']+=1;continue
        if event_id in unique:
            excluded['duplicate_id']+=1;continue
        try:
            moment=datetime.fromisoformat(str(raw['occurred_at']).replace('Z','+00:00'))
            if moment.tzinfo is None: moment=moment.replace(tzinfo=timezone.utc)
            values=[float(raw[k]) for k in FEATURES+['magnitude']]
            lat,lon,depth,mag=values
            if not all(map(math.isfinite,values)) or not(-90<=lat<=90 and -180<=lon<=180 and 0<=depth<=750 and -2<=mag<=10):
                raise ValueError('Out of bounds')
        except (ValueError,TypeError,KeyError,OverflowError):
            excluded['missing_invalid_outlier']+=1;continue
        unique[event_id]={'id':event_id,'at':moment.astimezone(timezone.utc).isoformat(),
                          'features':[lat,lon,depth],'magnitude':mag}
    ordered=sorted(unique.values(),key=lambda r:(r['at'],r['id']))
    return ordered,dict(excluded)

def split_rows(rows):
    if len(rows)<40:
        raise ValueError('Se necesitan al menos 40 observaciones válidas.')
    cut=int(len(rows)*.8)
    boundary=rows[cut]['at']
    while cut>0 and rows[cut-1]['at']==boundary:cut-=1
    train,test=rows[:cut],rows[cut:]
    if len(train)<30 or len(test)<8:
        raise ValueError('Partición temporal insuficiente; use un dataset más amplio.')
    return train,test

def evaluate_study(rows,kind='regression_simple',threshold=4.0,seed=42):
    """Evaluate under temporal split with comparable baselines and explicit observations."""
    train,test=split_rows(rows)
    inds=[2] if kind=='regression_simple' else [0,1,2]
    validate_features([FEATURES[i] for i in inds])
    def xs(items):return [[r['features'][i] for i in inds] for r in items]
    xtrain,xtest=xs(train),xs(test)
    if kind in ('regression_simple','regression_multiple'):
        ytrain=[r['magnitude'] for r in train];ytest=[r['magnitude'] for r in test]
        model=LinearRegression();baseline=DummyRegressor(strategy='mean')
        model.fit(xtrain,ytrain);baseline.fit(xtrain,ytrain)
        predictions=model.predict(xtest); base=baseline.predict(xtest)
        def measures(actual,pred):
            return {'mae':round(float(mean_absolute_error(actual,pred)),5),
                    'rmse':round(float(math.sqrt(mean_squared_error(actual,pred))),5),
                    'r2':round(float(r2_score(actual,pred)),5)}
        name='LinearRegression'
        evaluation={'metrics':measures(ytest,predictions),'baseline_metrics':measures(ytest,base),
                    'coefficient':list(map(float,model.coef_)),'intercept':float(model.intercept_),
                    'baseline_name':'DummyRegressor(media del entrenamiento)',
                    'residual_percentiles_test':{'p05':round(float(np.percentile(np.array(ytest)-predictions,5)),5),
                                                 'p95':round(float(np.percentile(np.array(ytest)-predictions,95)),5)},
                    'residual_note':'Percentiles descriptivos sobre errores del test; NO intervalo predictivo validado.'}
    elif kind=='classification':
        ytrain=[int(r['magnitude']>=threshold) for r in train]
        ytest=[int(r['magnitude']>=threshold) for r in test]
        if len(set(ytrain))<2 or len(set(ytest))<2:
            raise ValueError('Se necesitan ambas clases en entrenamiento y prueba.')
        model=RandomForestClassifier(n_estimators=80,max_depth=6,min_samples_leaf=3,
                                     random_state=seed,n_jobs=1,class_weight='balanced')
        baseline=DummyClassifier(strategy='most_frequent')
        stratified_baseline=DummyClassifier(strategy='stratified',random_state=seed)
        model.fit(xtrain,ytrain);baseline.fit(xtrain,ytrain);stratified_baseline.fit(xtrain,ytrain)
        predictions=model.predict(xtest);base=baseline.predict(xtest)
        stratified=stratified_baseline.predict(xtest)
        def measures(actual,pred):
            p,r,f,_=precision_recall_fscore_support(actual,pred,labels=[0,1],average='macro',zero_division=0)
            return {'precision_macro':round(float(p),5),'recall_macro':round(float(r),5),'f1_macro':round(float(f),5)}
        p_by,r_by,f_by,support=precision_recall_fscore_support(
            ytest,predictions,labels=[0,1],average=None,zero_division=0)
        name='RandomForestClassifier'
        evaluation={'metrics':measures(ytest,predictions),'baseline_metrics':measures(ytest,base),
                    'baseline_name':'DummyClassifier(clase mayoritaria)',
                    'other_baselines':{'DummyClassifier(aleatorio estratificado)':measures(ytest,stratified)},
                    'per_class_metrics':[
                        {'class':str(i),'precision':round(float(p_by[i]),5),
                         'recall':round(float(r_by[i]),5),'f1':round(float(f_by[i]),5),
                         'support':int(support[i])} for i in [0,1]],
                    'class_counts':{'train':{str(i):ytrain.count(i) for i in [0,1]},
                                    'test':{str(i):ytest.count(i) for i in [0,1]}},
                    'confusion_matrix':confusion_matrix(ytest,predictions,labels=[0,1]).tolist()}
    else:
        raise ValueError('Tipo de experimento desconocido.')
    predictions=[float(p) for p in predictions]
    evaluation.update({'question':MODEL_QUESTIONS[kind],
                       'library_versions':{'scikit_learn':sklearn.__version__,'pandas':pandas.__version__},
                       'kind':kind,'algorithm':name,'target':'magnitude observed' if kind!='classification' else f'observed magnitude >= {threshold}',
                       'features':[FEATURES[i] for i in inds],'n_total':len(rows),'n_train':len(train),'n_test':len(test),
                       'train_end_utc':train[-1]['at'],'test_start_utc':test[0]['at'],
                       'observations':[{'at':r['at'],'actual':float(y),'estimated':round(p,5)}
                                       for r,y,p in zip(test,ytest,predictions)],
                       'disclaimer':DISCLAIMER})
    return evaluation

def evaluate_temporal_windows(rows,kind='regression_simple',threshold=4.0,seed=42,n_splits=3):
    """Expanding-window chronological validation on event-time groups.

    Never divide the same timestamp between train and test, nor use an event twice.
    Results are exploratory and independent of the final 80/20 holdout.
    """
    if kind not in MODEL_QUESTIONS:
        raise ValueError('Tipo de experimento desconocido.')
    if not 3 <= n_splits <= 5:
        raise ValueError('Se requieren entre 3 y 5 ventanas temporales.')
    if len(rows)<40:
        raise ValueError('Se necesitan al menos 40 observaciones válidas.')
    # Chronological order is contractual: fold boundaries must not mix revisions
    # of the same observed event, or place identical timestamps on either side.
    seen=set(); last=None; groups=[]
    for row in rows:
        rid=row['id'];at=row['at']
        if rid in seen or (last is not None and at<last):
            raise ValueError('Los eventos deben ser únicos y estar ordenados cronológicamente.')
        seen.add(rid)
        if at!=last:groups.append([])
        groups[-1].append(row)
        last=at
    if len(groups)<n_splits+1:
        raise ValueError('No hay fechas distintas suficientes para las ventanas.')
    folds=[]; omitted=[]
    splitter=TimeSeriesSplit(n_splits=n_splits)
    for index,(train_ids,test_ids) in enumerate(splitter.split(groups),start=1):
        train=[r for i in train_ids for r in groups[i]]
        test=[r for i in test_ids for r in groups[i]]
        if len(train)<30 or len(test)<8:
            omitted.append({'window':index,'reason':'sample_too_small','n_train':len(train),'n_test':len(test)})
            continue
        if kind=='classification':
            ytrain={int(r['magnitude']>=threshold) for r in train}
            ytest={int(r['magnitude']>=threshold) for r in test}
            if len(ytrain)<2 or len(ytest)<2:
                omitted.append({'window':index,'reason':'missing_class','n_train':len(train),'n_test':len(test)})
                continue
        # Evaluate exactly the train/test fold, rather than applying the 80/20 split again.
        evaluated=_evaluate_explicit_split(train,test,kind,threshold,seed)
        folds.append({'window':index,'n_train':len(train),'n_test':len(test),
                      'train_end_utc':train[-1]['at'],'test_start_utc':test[0]['at'],
                      'model':evaluated['model'],'baseline':evaluated['baseline'],
                      'baseline_name':evaluated['baseline_name'],
                      'class_counts':evaluated.get('class_counts')})
    if len(folds)<2:
        raise ValueError('Se necesitan al menos dos ventanas temporales evaluables.')
    keys=sorted(folds[0]['model'])
    def summary(which):
        return {k:{'mean':round(float(np.mean([fold[which][k] for fold in folds])),5),
                   'std':round(float(np.std([fold[which][k] for fold in folds])),5)} for k in keys}
    return {'method':'TimeSeriesSplit por fechas distintas, entrenamiento expansivo',
            'n_requested':n_splits,'n_evaluated':len(folds),'folds':folds,'omitted':omitted,
            'model_summary':summary('model'),'baseline_summary':summary('baseline'),
            'seed':seed,'notes':['Validación retrospectiva; no predice eventos futuros.',
                                  'Desviación estándar poblacional entre ventanas; muestras relacionadas.',
                                  'Las fechas iguales nunca se separan entre train y test.']}


def _evaluate_explicit_split(train,test,kind,threshold,seed):
    inds=[2] if kind=='regression_simple' else [0,1,2]
    validate_features([FEATURES[i] for i in inds])
    def xs(seq):return [[row['features'][i] for i in inds] for row in seq]
    a,b=xs(train),xs(test)
    if kind in ('regression_simple','regression_multiple'):
        yt=[row['magnitude'] for row in train]
        yv=[row['magnitude'] for row in test]
        model=LinearRegression().fit(a,yt)
        basal=DummyRegressor(strategy='mean').fit(a,yt)
        def measure(pred):
            return {'mae':round(float(mean_absolute_error(yv,pred)),5),
                    'rmse':round(float(np.sqrt(mean_squared_error(yv,pred))),5),
                    'r2':round(float(r2_score(yv,pred)),5)}
        return {'model':measure(model.predict(b)),'baseline':measure(basal.predict(b)),
                'baseline_name':'DummyRegressor(media del entrenamiento)'}
    yt=[int(row['magnitude']>=threshold) for row in train]
    yv=[int(row['magnitude']>=threshold) for row in test]
    model=RandomForestClassifier(n_estimators=80,max_depth=6,min_samples_leaf=3,
               random_state=seed,n_jobs=1,class_weight='balanced').fit(a,yt)
    basal=DummyClassifier(strategy='most_frequent').fit(a,yt)
    def measure(pred):
        pr,re,f1,_=precision_recall_fscore_support(yv,pred,labels=[0,1],average='macro',zero_division=0)
        return {'precision_macro':round(float(pr),5),'recall_macro':round(float(re),5),
                'f1_macro':round(float(f1),5)}
    return {'model':measure(model.predict(b)),'baseline':measure(basal.predict(b)),
            'baseline_name':'DummyClassifier(clase mayoritaria)',
            'class_counts':{'train':{str(i):yt.count(i) for i in [0,1]},
                            'test':{str(i):yv.count(i) for i in [0,1]}}}

@router.post('/datasets/from-snapshot')
def create_dataset(snapshot_id:str,actor=Depends(require('modelos.entrenar')),db:Session=Depends(db_session)):
    snap=db.get(QuerySnapshot,snapshot_id)
    if not snap or snap.status!='completed':raise HTTPException(422,'Snapshot inexistente o incompleto')
    events=db.scalars(select(EventSnapshot).where(EventSnapshot.query_id==snapshot_id)).all()
    if len(events)!=snap.event_count or digest(sorted([e.data for e in events],key=lambda r:(r['occurred_at'],r['external_id'])))!=snap.result_hash:
        raise HTTPException(409,'Integridad del snapshot no válida')
    rows,excluded=clean_rows([e.data for e in events]);manifest={'rows':rows,'source':'USGS','snapshot_id':snapshot_id,
      'period_start':snap.period_start.isoformat(),'period_end':snap.period_end.isoformat(),
      'features':FEATURES,'target':'observed_magnitude','disclaimer':DISCLAIMER}
    h=digest(manifest)
    previous=db.scalar(select(DatasetVersion).where(DatasetVersion.snapshot_id==snapshot_id,DatasetVersion.content_sha256==h))
    if previous:return {'id':previous.id,'sha256':previous.content_sha256,'row_count':previous.row_count,'quality':previous.quality_report,'reused':True}
    dataset=DatasetVersion(snapshot_id=snapshot_id,content_sha256=h,row_count=len(rows),
                           quality_report={'original_count':len(events),'valid_count':len(rows),'excluded':excluded,'missing_values_policy':'exclude invalid records'},
                           manifest=manifest,created_by=actor.id)
    try:
        db.add(dataset);db.flush();audit(db,'ml.dataset.create',actor.id,'success',dataset.id);db.commit()
    except IntegrityError:
        db.rollback();raise HTTPException(409,'Dataset ya creado por otra solicitud')
    return {'id':dataset.id,'sha256':h,'row_count':len(rows),'quality':dataset.quality_report,'reused':False}

@router.get('/datasets/versions')
def list_datasets(actor=Depends(require('modelos.entrenar')),db:Session=Depends(db_session)):
    data=db.scalars(select(DatasetVersion).order_by(DatasetVersion.created_at.desc()).limit(50)).all()
    return [{'id':d.id,'snapshot_id':d.snapshot_id,'sha256':d.content_sha256,'row_count':d.row_count,
             'quality':d.quality_report,'created_at':d.created_at} for d in data]

@router.post('/studies')
def run_study(dataset_id:str,kind:str=Query('regression_simple',pattern='^(regression_simple|regression_multiple|classification)$'),
              threshold:float=Query(4.0,ge=0,le=9),actor=Depends(require('modelos.entrenar')),
              db:Session=Depends(db_session)):
    dataset=db.get(DatasetVersion,dataset_id)
    if dataset is None:raise HTTPException(404,'Dataset inexistente')
    if digest(dataset.manifest)!=dataset.content_sha256:raise HTTPException(409,'Hash del dataset no coincide')
    if dataset.manifest.get('snapshot_id')!=dataset.snapshot_id:raise HTTPException(409,'Manifiesto no coincide con snapshot')
    try:result=evaluate_study(dataset.manifest['rows'],kind,threshold)
    except (ValueError,KeyError,TypeError) as exc:raise HTTPException(422,str(exc)) from exc
    try:temporal=evaluate_temporal_windows(dataset.manifest['rows'],kind,threshold)
    except ValueError as exc:temporal={'status':'not_evaluable','reason':str(exc),'notes':['El experimento 80/20 permanece válido; se necesitan más datos para validar varias ventanas.']}
    result['temporal_validation']=temporal
    config={'threshold':threshold,'seed':42,'split':'80/20 temporal','features':result['features'],
            'target':result['target'],'dataset_sha256':dataset.content_sha256,'sklearn_algorithm':result['algorithm'],
            'library_versions':result['library_versions'],'question':result['question']}
    metrics={'model':result['metrics'],'baseline':result['baseline_metrics']}
    limitations={'items':[DISCLAIMER,'Variables de evento observadas, no disponibles para predecir antes del evento.',
                           'No hay intervalos predictivos calibrados; percentiles de residuos describen solo el conjunto de prueba.',
                           'Correlación no implica causalidad. Validez limitada a población del dataset.']}
    study=MLStudy(dataset_id=dataset.id,kind=kind,algorithm=result['algorithm'],config=config,
                  metrics=metrics,results=result,limitations=limitations,created_by=actor.id)
    db.add(study);db.flush();audit(db,'ml.study.run',actor.id,'success',study.id);db.commit()
    return {'id':study.id,'dataset_id':dataset.id,'metrics':metrics,'results':result,'limitations':limitations}

@router.get('/studies')
def list_studies(actor=Depends(require('modelos.entrenar')),db:Session=Depends(db_session)):
    studies=db.scalars(select(MLStudy).order_by(MLStudy.created_at.desc()).limit(50)).all()
    return [{'id':s.id,'dataset_id':s.dataset_id,'kind':s.kind,'algorithm':s.algorithm,
             'metrics':s.metrics,'created_at':s.created_at,'disclaimer':DISCLAIMER} for s in studies]

@router.get('/studies/{study_id}')
def study_detail(study_id:str,actor=Depends(require('modelos.entrenar')),db:Session=Depends(db_session)):
    study=db.get(MLStudy,study_id)
    if not study:raise HTTPException(404,'Experimento inexistente')
    return {'id':study.id,'dataset_id':study.dataset_id,'kind':study.kind,'created_at':study.created_at,
            'config':study.config,'metrics':study.metrics,'results':study.results,'limitations':study.limitations}


# Reproducción de lectura: nunca crea un experimento, modifica datos ni envía avisos.
def replay_saved_study(study: MLStudy, dataset: DatasetVersion) -> dict:
    """Recalculate the stored study and compare its complete evaluated result.

    A changed runtime is reported explicitly rather than silently asserting
    bit-for-bit reproducibility across dependency versions.
    """
    if digest(dataset.manifest) != dataset.content_sha256:
        raise ValueError('La integridad SHA-256 del dataset no coincide.')
    if dataset.manifest.get('snapshot_id') != dataset.snapshot_id:
        raise ValueError('El manifiesto no corresponde al snapshot registrado.')
    if study.dataset_id != dataset.id:
        raise ValueError('El experimento no corresponde al dataset.')
    config=study.config or {}
    if config.get('dataset_sha256') != dataset.content_sha256:
        raise ValueError('El hash configurado del experimento no coincide con el dataset.')
    if config.get('split') != '80/20 temporal':
        raise ValueError('La partición histórica no es compatible con la reproducción actual.')
    seed=config.get('seed')
    if type(seed) is not int or seed < 0:
        raise ValueError('Semilla no válida para reproducción.')
    threshold=config.get('threshold')
    if type(threshold) not in (int,float) or not math.isfinite(threshold):
        raise ValueError('Umbral no válido para reproducción.')
    if study.kind not in MODEL_QUESTIONS:
        raise ValueError('Tipo de modelo no reconocido.')
    stored_versions=config.get('library_versions',{})
    current_versions={'scikit_learn':sklearn.__version__,'pandas':pandas.__version__}
    if stored_versions != current_versions:
        return {'status':'environment_changed','identical':False,
                'reason':'Las versiones de las librerías no coinciden; no se puede certificar una repetición idéntica.',
                'stored_versions':stored_versions,'current_versions':current_versions}
    try:
        calculated=evaluate_study(dataset.manifest['rows'],study.kind,threshold,seed)
        if calculated['features'] != config.get('features') or calculated['target'] != config.get('target') or calculated['algorithm'] != config.get('sklearn_algorithm'):
            raise ValueError('La definición del modelo guardado difiere del cálculo actual.')
        try:
            temporal=evaluate_temporal_windows(dataset.manifest['rows'],study.kind,threshold,seed)
        except ValueError as exc:
            temporal={'status':'not_evaluable','reason':str(exc),
                      'notes':['El experimento 80/20 permanece válido; se necesitan más datos para validar varias ventanas.']}
        calculated['temporal_validation']=temporal
    except (KeyError,TypeError) as exc:
        raise ValueError('Dataset o configuración incompletos.') from exc
    # All the persisted model, baseline, per-class and temporal outputs matter.
    matching_metrics=({'model':calculated['metrics'],'baseline':calculated['baseline_metrics']} == study.metrics)
    matching_results=(calculated == study.results)
    return {'status':'identical' if matching_metrics and matching_results else 'different',
            'identical':matching_metrics and matching_results,
            'metrics_match':matching_metrics,'results_match':matching_results,
            'dataset_id':dataset.id,'dataset_sha256':dataset.content_sha256,
            'study_id':study.id,'kind':study.kind,
            'stored_metrics':study.metrics,
            'recalculated_metrics':{'model':calculated['metrics'],'baseline':calculated['baseline_metrics']},
            'disclaimer':DISCLAIMER}


@router.post('/studies/{study_id}/verify-reproducibility')
def verify_reproducibility(study_id:str, actor=Depends(require('modelos.entrenar')),
                           db:Session=Depends(db_session)):
    study=db.get(MLStudy,study_id)
    if not study:raise HTTPException(404,'Experimento inexistente')
    dataset=db.get(DatasetVersion,study.dataset_id)
    if not dataset:raise HTTPException(409,'El dataset asociado ya no está disponible')
    try:return replay_saved_study(study,dataset)
    except ValueError as exc:raise HTTPException(409,str(exc)) from exc
