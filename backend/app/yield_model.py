"""Crop-specific yield training. Imports are operator-owned; no arbitrary model deserialization."""
import hashlib
import json
import math
from pathlib import Path
import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.dummy import DummyRegressor
from sklearn.ensemble import RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_absolute_error,mean_squared_error
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from .config import MODEL_DIR
NUMERIC=['rainfall_mm','temperature_c','soil_ph']
CATEGORICAL=['state','district','season','irrigation']
FEATURES=NUMERIC+CATEGORICAL
REQUIRED={'state','district','crop','season','year','area_ha','production_tonnes'}

def split_records(df):
    """Entire districts are held out; all evaluation years follow all training years."""
    years=sorted(df.year.unique());groups=sorted((df.state+'|'+df.district).unique())
    if len(years)<7 or len(groups)<8 or len(df)<150:
        raise ValueError('Need ≥150 crop records, ≥7 years and ≥8 distinct state/district groups')
    rng=np.random.default_rng(42);held=set(rng.choice(groups,max(2,len(groups)//4),replace=False).tolist())
    region=(df.state+'|'+df.district).isin(held);cut=years[-2];cal_year=years[-3]
    train=df[(~region)&(df.year<cal_year)];cal=df[(~region)&(df.year==cal_year)]
    temporal=df[(~region)&(df.year>=cut)];geographic=df[region&(df.year>=cut)]
    if len(train)<60 or len(cal)<10 or len(temporal)<15 or len(geographic)<10:
        raise ValueError('Not enough independent training, calibration, temporal-test and geographic-test rows')
    return train,cal,temporal,geographic,sorted(held)

def metrics(truth,pred,band=None):
    result={'mae':float(mean_absolute_error(truth,pred)),'rmse':float(math.sqrt(mean_squared_error(truth,pred))),'rows':len(truth)}
    if band is not None:result['empiricalIntervalCoverage']=float(np.mean(np.abs(np.asarray(truth)-np.asarray(pred))<=band))
    return result

def train(csv_path:Path,crop:str,out_dir:Path|None=None):
    df=pd.read_csv(csv_path)
    if not REQUIRED.issubset(df.columns):raise ValueError(f'Missing columns: {sorted(REQUIRED-set(df.columns))}')
    df=df[df.crop.str.lower()==crop.lower()].copy()
    for col in ('year','area_ha','production_tonnes'):
        df[col]=pd.to_numeric(df[col],errors='raise')
    if df.empty or not np.isfinite(df[['year','area_ha','production_tonnes']]).all().all():raise ValueError('Missing/nonfinite area, production or year')
    if (df.area_ha<=0).any() or (df.production_tonnes<0).any():raise ValueError('Area must be positive and production nonnegative')
    if (df.year%1!=0).any():raise ValueError('Year must be an integer')
    if df.duplicated(['state','district','crop','season','year']).any():raise ValueError('Duplicate district/crop/season/year observations must be resolved before training')
    for col in CATEGORICAL:
        if col not in df:df[col]='unknown'
        df[col]=df[col].fillna('unknown').astype(str)
    for col in NUMERIC:
        if col not in df:df[col]=np.nan
        df[col]=pd.to_numeric(df[col],errors='coerce')
    df['yield_t_ha']=df.production_tonnes/df.area_ha
    train_df,cal,test,geo,held=split_records(df)
    preprocessor=ColumnTransformer([('numeric',SimpleImputer(strategy='median',keep_empty_features=True),NUMERIC),('categorical',OneHotEncoder(handle_unknown='ignore'),CATEGORICAL)])
    rf=Pipeline([('features',preprocessor),('regressor',RandomForestRegressor(n_estimators=120,min_samples_leaf=4,max_depth=12,random_state=42,n_jobs=1))])
    rf.fit(train_df[FEATURES],train_df.yield_t_ha)
    baseline=DummyRegressor(strategy='median').fit(np.zeros((len(train_df),1)),train_df.yield_t_ha)
    evaluate=lambda data,model:metrics(data.yield_t_ha,model.predict(data[FEATURES]) if model is rf else model.predict(np.zeros((len(data),1))))
    temporal_rf=evaluate(test,rf);geographic_rf=evaluate(geo,rf);temporal_base=evaluate(test,baseline);geographic_base=evaluate(geo,baseline)
    use_rf=temporal_rf['mae']<=temporal_base['mae'] and geographic_rf['mae']<=geographic_base['mae']
    model=rf if use_rf else baseline;name='Random Forest' if use_rf else 'Historical median baseline'
    predict=lambda data:model.predict(data[FEATURES]) if use_rf else model.predict(np.zeros((len(data),1)))
    band=float(np.quantile(np.abs(cal.yield_t_ha-predict(cal)),.9,method='higher'))
    temporal_final=metrics(test.yield_t_ha,predict(test),band);geo_final=metrics(geo.yield_t_ha,predict(geo),band)
    report=dict(crop=crop,model=name,features=FEATURES,trainedRows=len(train_df),calibrationRows=len(cal),trainYears=sorted(int(y) for y in train_df.year.unique()),calibrationYears=sorted(int(y) for y in cal.year.unique()),testYears=sorted(int(y) for y in test.year.unique()),heldOutDistricts=held,temporal=temporal_final,geographic=geo_final,baselineTemporal=temporal_base,baselineGeographic=geographic_base,randomForestTemporal=temporal_rf,randomForestGeographic=geographic_rf,calibrationAbsoluteErrorBand=band,intervalNote='90th percentile absolute residual on a separate past calibration year; empirical coverage on future and held-out regions is reported. Not a confidence guarantee.',units='tonnes/hectare',dataSha256=hashlib.sha256(csv_path.read_bytes()).hexdigest(),deploymentEligible=temporal_final['empiricalIntervalCoverage']>=.75 and geo_final['empiricalIntervalCoverage']>=.75,regionalExpertReview='pending')
    out=out_dir or MODEL_DIR;out.mkdir(parents=True,exist_ok=True)
    key=''.join(c for c in crop.lower() if c.isalnum() or c in '_-')
    if not key:raise ValueError('Invalid crop identifier')
    payload={'model':model,'use_rf':use_rf,'report':report,'knownDistricts':sorted((df.state+'|'+df.district).unique()),'knownSeasons':sorted(df.season.unique())}
    joblib.dump(payload,out/f'{key}.joblib');(out/f'{key}.json').write_text(json.dumps(report,indent=2,allow_nan=False))
    return report

def predict(crop,features,area_ha):
    key=''.join(c for c in crop.lower() if c.isalnum() or c in '_-')
    path=MODEL_DIR/f'{key}.joblib'
    if not path.exists():return {'status':'unavailable','reason':'No crop-specific model trained on real data is installed.'}
    payload=joblib.load(path)  # Only local operator-generated artifacts, never user uploads.
    report=payload['report']
    if not report['deploymentEligible']:return {'status':'unavailable','reason':'The model did not meet temporal/geographic calibration coverage checks.','evaluation':report}
    if any(k not in features for k in FEATURES):return {'status':'unavailable','reason':f'Provide all model features: {FEATURES}'}
    region=str(features['state'])+'|'+str(features['district'])
    if region not in payload['knownDistricts'] or features['season'] not in payload['knownSeasons']:return {'status':'unavailable','reason':'Location or season is outside the evaluated model domain.'}
    row={k:features[k] for k in FEATURES}
    for k in NUMERIC:
        row[k]=float(row[k])
        if not math.isfinite(row[k]):raise ValueError('Nonfinite model feature')
    if not (0<=row['rainfall_mm']<=5000 and -10<=row['temperature_c']<=55 and 0<=row['soil_ph']<=14):return {'status':'unavailable','reason':'Features are outside supported physical screening ranges.'}
    value=max(0,float(payload['model'].predict(pd.DataFrame([row]) if payload['use_rf'] else np.zeros((1,1)))[0]));band=report['calibrationAbsoluteErrorBand']
    return dict(status='available',yieldTonnesPerHa=value,totalHarvestTonnes=value*area_ha,empiricalRangeTonnesPerHa=[max(0,value-band),value+band],evaluation=report,importantFactors='See the model features and held-out evaluation. No causal feature explanation is claimed.',warning='Requires regional expert review. District-level estimates are not calibrated field yields; no future weather forecast is used.')
