"""Regression tests for time-window validation with non-leaking folds."""
import pytest
from app.ml_reproducible import clean_rows,evaluate_temporal_windows
from test_ml_entrega_b import sample

def rows():
    data=sample()
    # Preserve varied labels in both classes in every temporal slice.
    for i,row in enumerate(data):row['magnitude']=3.5 if i%2 else 4.8
    return clean_rows(data)[0]

def test_expanding_windows_are_chronological_and_distinct():
    report=evaluate_temporal_windows(rows(),'regression_multiple')
    assert report['n_evaluated']>=2
    assert report['model_summary']['mae']['mean']>=0
    for fold in report['folds']:
        assert fold['train_end_utc']<fold['test_start_utc']
        assert fold['n_train']>=30 and fold['n_test']>=8

def test_classification_reports_baselines_and_class_counts():
    report=evaluate_temporal_windows(rows(),'classification',threshold=4)
    assert report['n_evaluated']>=2
    for fold in report['folds']:
        assert fold['class_counts']['test']['0']>0
        assert fold['class_counts']['test']['1']>0
        assert 'f1_macro' in fold['baseline']

def test_identical_dataset_is_reproducible():
    sample_rows=rows()
    assert evaluate_temporal_windows(sample_rows,'classification')==evaluate_temporal_windows(sample_rows,'classification')

def test_rejects_bad_time_order_duplicate_and_few_samples():
    r=rows()
    with pytest.raises(ValueError,match='únicos'):
        evaluate_temporal_windows(r+[r[-1]])
    with pytest.raises(ValueError,match='40'):
        evaluate_temporal_windows(r[:20])
    with pytest.raises(ValueError,match='ventanas'):
        evaluate_temporal_windows(r,n_splits=2)

def test_tied_timestamps_are_not_split():
    r=rows()
    for i in range(1,len(r),2):r[i]['at']=r[i-1]['at']
    result=evaluate_temporal_windows(r,'regression_simple')
    assert all(f['train_end_utc']<f['test_start_utc'] for f in result['folds'])
