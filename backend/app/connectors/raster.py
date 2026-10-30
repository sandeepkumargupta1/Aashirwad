"""Source-specific raster queries from official local imports, not the SoilGrids REST API."""
import json
from datetime import datetime,timezone
from pathlib import Path
import numpy as np
from ..config import DATA_DIR

def field_geometry(farm):
    from shapely.geometry import Point,Polygon,mapping
    from shapely.ops import transform
    from pyproj import CRS,Transformer
    if farm.boundary:return mapping(Polygon([(lon,lat) for lat,lon in farm.boundary]))
    local=CRS.from_proj4(f'+proj=aeqd +lat_0={farm.latitude} +lon_0={farm.longitude} +datum=WGS84 +units=m')
    forward=Transformer.from_crs('EPSG:4326',local,always_xy=True).transform
    inverse=Transformer.from_crs(local,'EPSG:4326',always_xy=True).transform
    return mapping(transform(inverse,transform(forward,Point(farm.longitude,farm.latitude)).buffer(farm.radiusKm*1000)))

def read_catalog():
    path=DATA_DIR/'catalog.json'
    return json.loads(path.read_text()) if path.exists() else []

def sample_record(record,farm):
    import rasterio
    from rasterio.mask import mask
    from rasterio.warp import transform_geom
    path=(DATA_DIR/record['path']).resolve()
    if not path.is_relative_to(DATA_DIR):raise ValueError('Raster path escapes the import directory')
    with rasterio.open(path) as src:
        if not src.crs:raise ValueError('Raster CRS is missing')
        geom=transform_geom('EPSG:4326',src.crs,field_geometry(farm))
        try:arr,_=mask(src,[geom],indexes=1,crop=True,filled=False,all_touched=False)
        except ValueError:return dict(status='outside_coverage',source=record['source'],property=record['property'],value=None)
        values=arr.compressed().astype(float);values=values[np.isfinite(values)]
        if 'raw_valid_min' in record:values=values[values>=record['raw_valid_min']]
        if 'raw_valid_max' in record:values=values[values<=record['raw_valid_max']]
        values=values*record['scale']+record.get('offset',0)
        if len(values)==0:return dict(status='no_valid_pixels',source=record['source'],property=record['property'],value=None)
        if record.get('classes'):
            unique,counts=np.unique(values,return_counts=True);mode=float(unique[counts.argmax()]);value=record['classes'].get(str(int(mode)),str(mode));method='mode of valid pixel centres'
        else:value=float(np.mean(values));method='unweighted mean of valid pixel centres'
        return dict(status='imported_estimate',source=record['source'],property=record['property'],value=value,min=float(values.min()),max=float(values.max()),std=float(values.std()),pixelCount=len(values),unit=record['unit'],depth=record.get('depth'),observedAt=record['observed_at'],lastUpdated=record['imported_at'],resolution=record['resolution'],method=method,sourceUrl=record['source_url'],license=record['license'],uncertainty=record.get('uncertainty','Not supplied'),extent=src.bounds._asdict(),crs=str(src.crs))

class RasterConnector:
    source=''
    def query(self,farm):
        records=[r for r in read_catalog() if r['source']==self.source]
        if not records:return dict(status='awaiting_import',source=self.source,values=[],reason='Import an authorized official raster with scale, units, depth and observation date.')
        results=[]
        for record in records:
            try:results.append(sample_record(record,farm))
            except (OSError,ValueError,KeyError) as error:results.append(dict(status='unavailable',source=self.source,property=record.get('property'),value=None,error=str(error)))
        return dict(status='imported',source=self.source,values=results)
class OpenLandMap(RasterConnector):source='openlandmap'
class SoilGrids(RasterConnector):source='soilgrids'
class EOS04(RasterConnector):source='eos04'
