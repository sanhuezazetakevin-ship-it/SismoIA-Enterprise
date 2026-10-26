"""Pure deterministic reproducibility and model safeguards."""
from datetime import datetime,timedelta,timezone
import pytest
from app.ml_reproducible import clean_rows,split_rows,evaluate_study

def sample(n=120):
    origin=datetime(2024,1,1,tzinfo=timezone.utc)
    rows=[]
    for i in range(n):
        magnitude=3.0+(.04*i)+(.35 if i%3 else -.25)
        rows.append({'external_id':f'usgs-{i}','occurred_at':(origin+timedelta(days=i)).isoformat(),
                    'latitude':-18+i*.04,'longitude':-78+i*.03,'depth_km':5+i%23,
                    'magnitude':magnitude})
    return rows

def test_dataset_order_hash_and_duplicate_exclusion():
    rows,ex=clean_rows(sample(120)+[sample(1)[0]])
    assert len(rows)==120 and ex['duplicate_id']==1
    assert rows==clean_rows(list(reversed(sample(120))))[0]
    assert 'magnitude' not in rows[0]['features']

def test_missing_invalid_coordinate_excluded():
    bad=sample(41);bad[0]['latitude']=100
    rows,ex=clean_rows(bad)
    assert len(rows)==40 and ex['missing_invalid_outlier']==1

def test_simple_regression_reproducible_and_temporal():
    rows,_=clean_rows(sample())
    a=evaluate_study(rows,'regression_simple')
    b=evaluate_study(rows,'regression_simple')
    assert a==b and a['features']==['depth_km']
    assert a['train_end_utc']<a['test_start_utc']
    assert set(['mae','rmse','r2'])<=a['metrics'].keys()

def test_multiple_regression_uses_three_features():
    rows,_=clean_rows(sample())
    result=evaluate_study(rows,'regression_multiple')
    assert len(result['features'])==3
    assert len(result['observations'])==result['n_test']

def test_classification_deterministic_and_nonleaking():
    records=sample()
    for i,row in enumerate(records): row['magnitude']=3.5 if i%2 else 4.8
    rows,_=clean_rows(records)
    result=evaluate_study(rows,'classification',threshold=4.0)
    assert 'magnitude' not in result['features']
    assert set(['precision_macro','recall_macro','f1_macro'])<=result['metrics'].keys()
    assert len(result['confusion_matrix'])==2

def test_insufficient_records_rejected():
    rows,_=clean_rows(sample(15))
    with pytest.raises(ValueError,match='40'):
        evaluate_study(rows)

def test_single_class_classification_rejected():
    rows,_=clean_rows(sample())
    with pytest.raises(ValueError,match='ambas clases'):
        evaluate_study(rows,'classification',threshold=9)
