"""Professor-requested regression tests for target leakage and transparent metrics."""
import pytest
from app.ml_reproducible import validate_features, clean_rows, evaluate_study
from test_ml_entrega_b import sample

@pytest.mark.parametrize('column',['mag','magnitude','magType','mag_error','magnitude_range','target'])
def test_target_leakage_fails_closed(column):
    with pytest.raises(ValueError,match='Fuga'):
        validate_features(['latitude',column])

def test_clean_features_and_duplicate_boundary():
    rows,excluded=clean_rows(sample()+[sample(1)[0]])
    assert excluded['duplicate_id']==1
    assert validate_features(['latitude','longitude','depth_km'])
    assert 'magnitude' not in evaluate_study(rows,'regression_multiple')['features']

def test_named_baselines_and_library_versions():
    rows,_=clean_rows(sample())
    result=evaluate_study(rows,'regression_simple')
    assert 'baseline_name' in result and 'residual_percentiles_test' in result
    assert set(result['library_versions'])=={'scikit_learn','pandas'}
    assert result==evaluate_study(rows,'regression_simple')

def test_classification_per_class_and_two_baselines():
    data=sample()
    for i,row in enumerate(data):row['magnitude']=3.5 if i%2 else 4.8
    rows,_=clean_rows(data)
    result=evaluate_study(rows,'classification',threshold=4.0)
    assert len(result['per_class_metrics'])==2
    assert sum(x['support'] for x in result['per_class_metrics'])==result['n_test']
    assert 'DummyClassifier(aleatorio estratificado)' in result['other_baselines']
    assert result['class_counts']['train']['0']>0


def test_replay_same_study_is_identical_without_writing():
    from types import SimpleNamespace
    from app.ml_reproducible import replay_saved_study, evaluate_temporal_windows, digest, pandas, sklearn
    rows,_ = clean_rows([{'external_id':f'e{i}', 'occurred_at':f'2024-01-{i%28+1:02d}T00:00:00+00:00',
                          'latitude':-12+i*.01,'longitude':-77+i*.01,'depth_km':10+i%9,
                          'magnitude':3.5+(i%4)*.2} for i in range(80)])
    # Use time-distinct samples so all folds can be evaluated.
    from datetime import datetime,timedelta,timezone
    for i,row in enumerate(rows):row['at']=(datetime(2024,1,1,tzinfo=timezone.utc)+timedelta(days=i)).isoformat()
    result=evaluate_study(rows,'regression_simple')
    try:result['temporal_validation']=evaluate_temporal_windows(rows,'regression_simple')
    except ValueError as exc:result['temporal_validation']={'status':'not_evaluable','reason':str(exc),'notes':['El experimento 80/20 permanece válido; se necesitan más datos para validar varias ventanas.']}
    manifest={'rows':rows,'snapshot_id':'snap'}
    dataset=SimpleNamespace(id='dataset',snapshot_id='snap',manifest=manifest,content_sha256=digest(manifest))
    study=SimpleNamespace(id='study',dataset_id='dataset',kind='regression_simple',metrics={'model':result['metrics'],'baseline':result['baseline_metrics']},results=result,config={
        'dataset_sha256':dataset.content_sha256,'split':'80/20 temporal','seed':42,'threshold':4.0,
        'features':result['features'],'target':result['target'],'sklearn_algorithm':result['algorithm'],
        'library_versions':{'scikit_learn':sklearn.__version__,'pandas':pandas.__version__}})
    actual=replay_saved_study(study,dataset)
    assert actual['status']=='identical' and actual['identical']
    study.metrics={'model':{'mae':999},'baseline':result['baseline_metrics']}
    assert replay_saved_study(study,dataset)['status']=='different'
    study.config['library_versions']={'scikit_learn':'old','pandas':'old'}
    assert replay_saved_study(study,dataset)['status']=='environment_changed'
    study.config['library_versions']={'scikit_learn':sklearn.__version__,'pandas':pandas.__version__}
    dataset.content_sha256='invalid'
    with pytest.raises(ValueError,match='SHA-256'):
        replay_saved_study(study,dataset)
