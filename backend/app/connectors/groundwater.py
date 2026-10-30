import csv
from datetime import date
from ..config import DATA_DIR
from ..domain import haversine
REQUIRED={'id','name','latitude','longitude','depth_m','observed_at','source_url'}

def query(latitude,longitude,radius_km=50):
    path=DATA_DIR/'imports'/'groundwater.csv'
    if not path.exists():return dict(status='awaiting_import',wells=[],reason='Import an official CGWB/NWIC CSV. No exact farm groundwater quantity is inferred.')
    stations={}
    with path.open(newline='') as f:
        reader=csv.DictReader(f)
        if not REQUIRED.issubset(reader.fieldnames or []):raise ValueError('Groundwater CSV schema is incomplete')
        for row in reader:
            lat,lon=float(row['latitude']),float(row['longitude']);distance=haversine(latitude,longitude,lat,lon)
            date.fromisoformat(row['observed_at'])
            if distance>radius_km:continue
            stations.setdefault(row['id'],[]).append(dict(id=row['id'],name=row['name'],latitude=lat,longitude=lon,depth=float(row['depth_m']),date=row['observed_at'],distance=distance,quality=row.get('quality','Not tested'),sourceUrl=row['source_url']))
    wells=[]
    for rows in stations.values():
        rows.sort(key=lambda r:r['date']);latest=dict(rows[-1]);latest['history']=rows
        latest['waterLevelChangeM']=rows[-1]['depth']-rows[0]['depth'] if len(rows)>1 else None
        latest['trendNote']='Positive change means deeper water; seasonal differences are not a long-term trend.'
        wells.append(latest)
    return dict(status='imported_observations',wells=sorted(wells,key=lambda w:w['distance'])[:10],radiusKm=radius_km)
