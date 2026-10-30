"""Operator CLI for authorized official downloads. Run from the backend directory."""
import argparse
import csv
import hashlib
import json
import math
import shutil
import uuid
from datetime import date,datetime,timezone
from pathlib import Path
from urllib.parse import urlparse
from app.config import DATA_DIR

def official_url(value):
    parsed=urlparse(value)
    if parsed.scheme!='https' or not parsed.netloc:raise ValueError('Supply an HTTPS publisher/source URL')
    return value

def register_raster(args):
    import numpy as np
    import rasterio
    source=Path(args.path).resolve()
    date.fromisoformat(args.observed)
    if date.fromisoformat(args.observed)>date.today():raise ValueError('Observation date is in the future')
    official_url(args.source_url)
    if args.source=='eos04' and not args.quality_note:raise ValueError('EOS-04 imports require a quality-mask review note')
    dest_dir=DATA_DIR/'imports';dest_dir.mkdir(parents=True,exist_ok=True)
    ident=str(uuid.uuid4());dest=dest_dir/f'{ident}.tif'
    with rasterio.open(source) as src:
        if not src.crs:raise ValueError('Raster must declare a coordinate reference system')
        data=src.read(1,masked=True).astype('float32')
        if args.qa_raster:
            with rasterio.open(args.qa_raster) as qa:
                if qa.crs!=src.crs or qa.transform!=src.transform or qa.shape!=src.shape:raise ValueError('QA raster must be aligned to source raster')
                allowed=[int(x) for x in args.qa_values.split(',')]
                data.mask=np.ma.getmaskarray(data)|~np.isin(qa.read(1),allowed)
        profile=src.profile.copy();profile.update(driver='GTiff',dtype='float32',count=1,nodata=-9999,compress='deflate')
        with rasterio.open(dest,'w',**profile) as target:target.write(data.filled(-9999),1)
    entry=dict(id=ident,source=args.source,property=args.property,path=str(dest.relative_to(DATA_DIR)),unit=args.unit,scale=args.scale,offset=args.offset,depth=args.depth,observed_at=args.observed,imported_at=datetime.now(timezone.utc).isoformat(),resolution=args.resolution,source_url=args.source_url,license=args.license,uncertainty=args.uncertainty,qualityNote=args.quality_note,rawSha256=hashlib.sha256(source.read_bytes()).hexdigest(),sha256=hashlib.sha256(dest.read_bytes()).hexdigest())
    if args.classes:entry['classes']=json.loads(args.classes)
    if args.raw_valid_min is not None:entry['raw_valid_min']=args.raw_valid_min
    if args.raw_valid_max is not None:entry['raw_valid_max']=args.raw_valid_max
    catalog_path=DATA_DIR/'catalog.json';catalog=json.loads(catalog_path.read_text()) if catalog_path.exists() else []
    catalog.append(entry);tmp=catalog_path.with_suffix('.tmp');tmp.write_text(json.dumps(catalog,indent=2));tmp.replace(catalog_path)
    return dict(status='imported',id=ident,property=args.property,publisher=args.source_url)

def register_groundwater(args):
    from app.connectors.groundwater import REQUIRED
    rows=[]
    with open(args.path,newline='') as stream:
        reader=csv.DictReader(stream)
        if not REQUIRED.issubset(reader.fieldnames or []):raise ValueError(f'CSV must contain {sorted(REQUIRED)}')
        fields=reader.fieldnames
        for row in reader:
            lat,lon,depth=float(row['latitude']),float(row['longitude']),float(row['depth_m'])
            if not all(math.isfinite(x) for x in (lat,lon,depth)) or not (6<=lat<=38 and 68<=lon<=98 and -100<=depth<=2000):raise ValueError('Invalid station coordinates or water level')
            if date.fromisoformat(row['observed_at'])>date.today():raise ValueError('Observation date is in the future')
            if not row['id'] or not row['name']:raise ValueError('Station identifier/name is required')
            official_url(row['source_url']);rows.append(row)
    if not rows:raise ValueError('Empty station CSV')
    keys=[(r['id'],r['observed_at']) for r in rows]
    if len(set(keys))!=len(keys):raise ValueError('Duplicate station/date records must be resolved')
    output=DATA_DIR/'imports'/'groundwater.csv';output.parent.mkdir(parents=True,exist_ok=True)
    # Fully validated rows are installed atomically.
    tmp=output.with_suffix('.tmp')
    with tmp.open('w',newline='') as stream:
        writer=csv.DictWriter(stream,fieldnames=fields);writer.writeheader();writer.writerows(rows)
    tmp.replace(output)
    return dict(status='imported',records=len(rows),stations=len({r['id'] for r in rows}))

def main():
    parser=argparse.ArgumentParser(description=__doc__);sub=parser.add_subparsers(dest='command',required=True)
    raster=sub.add_parser('raster');raster.add_argument('--source',choices=['openlandmap','soilgrids','eos04'],required=True);raster.add_argument('--path',required=True);raster.add_argument('--property',choices=['ph','texture','sand','silt','clay','organicCarbon','totalNitrogen','cec','bulkDensity','surfaceMoisture'],required=True)
    for flag in ('unit','observed','resolution','source-url','license'):raster.add_argument('--'+flag,required=True)
    raster.add_argument('--scale',type=float,required=True);raster.add_argument('--offset',type=float,default=0);raster.add_argument('--depth',default='0-30cm');raster.add_argument('--uncertainty',default='Not supplied');raster.add_argument('--classes');raster.add_argument('--qa-raster');raster.add_argument('--qa-values',default='0');raster.add_argument('--quality-note',default='');raster.add_argument('--raw-valid-min',type=float);raster.add_argument('--raw-valid-max',type=float)
    well=sub.add_parser('groundwater');well.add_argument('--path',required=True)
    args=parser.parse_args()
    try:print(json.dumps(register_raster(args) if args.command=='raster' else register_groundwater(args),indent=2))
    except (ValueError,OSError,KeyError) as error:parser.exit(2,f'Import rejected: {error}\n')
if __name__=='__main__':main()
