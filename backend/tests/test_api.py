import os
import tempfile
os.environ['AASHIRWAD_DATA_DIR']=tempfile.mkdtemp(prefix='aashirwad-test-')
import asyncio
from datetime import date,timedelta
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.models import Farm
from app.service import analyze
from app.connectors.nasa import aggregate,unavailable
from app.connectors import nasa
from app.domain import rank
from app.yield_model import predict,split_records

client=TestClient(app)
FARM=dict(name='Test farm',location='Sehore',latitude=23.2032,longitude=77.0844,radiusKm=1,area=5,areaUnit='acres',season='Rabi',irrigation='Limited',irrigationSource='Borewell',existingCrop='chickpea',boundary=[])

def test_demo_end_to_end():
    r=client.post('/api/farms/analyze',json={'farm':FARM,'mode':'demo'})
    assert r.status_code==200
    a=r.json();assert a['mode']=='demo' and a['crops'][0]['eligible']
    assert a['yield']['status']=='unavailable' and 'yieldTonnesPerHa' not in a['yield']
    assert a['soil']['ph']==7.1 and a['recordId']

def test_live_missing_source_not_demo(monkeypatch):
    async def offline(*args):return unavailable('test offline')
    monkeypatch.setattr(nasa,'fetch',offline)
    a=client.post('/api/farms/analyze',json={'farm':FARM,'mode':'live'}).json()
    assert a['soil']['ph'] is None and a['water']['moisture'] is None
    assert all(c['score'] is None for c in a['crops'])
    assert a['weather']['status']=='unavailable'

def test_invalid_coordinates_and_polygon():
    assert client.post('/api/farms/analyze',json={'farm':dict(FARM,latitude=900),'mode':'demo'}).status_code==422
    # Self-intersecting field boundaries are rejected.
    boundary=[(23,77),(24,78),(23,78),(24,77)]
    assert client.post('/api/farms/analyze',json={'farm':dict(FARM,boundary=boundary),'mode':'demo'}).status_code==422

def test_soil_tests_require_confirmation_and_valid_dates():
    assert client.post('/api/soil-tests/validate',json=dict(ph=7,lab='Test lab',date='2025-01-01',confirmed=False)).status_code==422
    assert client.post('/api/soil-tests/validate',json=dict(ph=7,lab='Test lab',date='2025-99-99',confirmed=True)).status_code==422
    assert client.post('/api/soil-tests/validate',json=dict(lab='Test lab',date='2025-01-01',confirmed=True)).status_code==422

def test_measured_values_override_estimates():
    f=dict(FARM,soilTest=dict(ph=5.2,date='2025-01-01',lab='Test lab',confirmed=True))
    a=client.post('/api/farms/analyze',json={'farm':f,'mode':'demo'}).json()
    assert a['soil']['ph']==5.2
    assert a['provenance']['ph']['source']=='Farmer-confirmed laboratory report'

def test_water_units_and_validation():
    r=client.post('/api/irrigation/estimate',json=dict(cropId='wheat',stage=2,eto=4,rain=5,areaHa=2,efficiency=.75))
    assert r.status_code==200
    x=r.json();assert x['volumeM3']==pytest.approx(x['grossMm']*20)
    assert client.post('/api/irrigation/estimate',json=dict(cropId='wheat',stage=2,eto=4,rain=5,areaHa=2,efficiency=0)).status_code==422
    assert client.post('/api/irrigation/estimate',json=dict(cropId='rice',stage=2,eto=4,rain=5,areaHa=2,efficiency=.75)).status_code==422

def test_model_requires_real_artifact():
    r=client.post('/api/yield/predict',json={'crop':'wheat','areaHa':2,'features':{}})
    assert r.status_code==422
    assert 'yieldTonnesPerHa' not in r.json()

def test_rabi_time_aggregation_and_nasa_fill_values():
    p={key:{} for key in ('T2M','PRECTOTCORR','T2M_MIN','T2M_MAX')}
    d=date(2019,1,1)
    while d<=date(2024,12,31):
        key=d.strftime('%Y%m%d')
        for name,value in zip(p,[20,2,12,28]):p[name][key]=value
        d+=timedelta(days=1)
    w=aggregate(p,'Rabi','2025-01-01');assert len(w['years'])==5 and w['years'][0]['days']==152
    assert w['years'][0]['rainfall']==304
    for day in range(1,32):p['T2M'][f'202001{day:02d}']=-999
    assert aggregate(p,'Rabi','2025-01-01')['status']=='unavailable'

def test_temporal_and_geographic_splits_have_no_leakage():
    import pandas as pd
    df=pd.DataFrame([dict(state='MP',district=f'D{d}',year=y) for d in range(20) for y in range(2010,2024)])
    train,cal,test,geo,held=split_records(df)
    assert train.year.max()<cal.year.min()<test.year.min()
    assert set(train.district).isdisjoint(set(geo.district))
    assert set(train.index).isdisjoint(cal.index) and set(test.index).isdisjoint(geo.index)

def test_training_pipeline_uses_a_separate_calibration_year(tmp_path):
    import pandas as pd
    from app.yield_model import train
    # Synthetic test fixture only. The artifact is written to pytest's temporary folder.
    rows=[]
    for district in range(20):
        for year in range(2010,2024):
            rows.append(dict(state='TEST',district=f'FIXTURE-{district}',crop='wheat',season='Rabi',year=year,area_ha=100,production_tonnes=150+district*3+(year-2010)*2,rainfall_mm=100+district*2,temperature_c=20,soil_ph=7,irrigation='Limited'))
    path=tmp_path/'synthetic_test_only.csv';pd.DataFrame(rows).to_csv(path,index=False)
    report=train(path,'wheat',tmp_path/'test_models')
    assert max(report['trainYears'])<min(report['calibrationYears'])<min(report['testYears'])
    assert report['temporal']['rows']>=15 and report['geographic']['rows']>=10
    assert report['units']=='tonnes/hectare'
    assert (tmp_path/'test_models'/'wheat.json').exists()
