import numpy as np
import pytest
import rasterio
from rasterio.transform import from_origin
from app.models import Farm
from app.config import DATA_DIR
from app.connectors.raster import sample_record

def test_field_aggregation_masks_nodata_and_applies_scale():
    path=DATA_DIR/'test_raster.tif';path.parent.mkdir(parents=True,exist_ok=True)
    values=np.array([[70,72],[74,-9999]],dtype='int16')
    with rasterio.open(path,'w',driver='GTiff',height=2,width=2,count=1,dtype='int16',crs='EPSG:4326',transform=from_origin(77,24,.01,.01),nodata=-9999) as dst:dst.write(values,1)
    f=Farm(name='test',location='test',latitude=23.99,longitude=77.01,radiusKm=2,area=1,areaUnit='hectares',boundary=[(24,77),(24,77.02),(23.98,77.02),(23.98,77)])
    row=dict(path='test_raster.tif',source='soilgrids',property='ph',scale=.1,offset=0,unit='pH',depth='0-30cm',observed_at='2025-01-01',imported_at='2025-02-01',resolution='test only',source_url='https://docs.isric.org/',license='test fixture')
    result=sample_record(row,f)
    assert result['pixelCount']==3 and result['value']==pytest.approx(7.2)
    assert result['status']=='imported_estimate' and result['depth']=='0-30cm'

def test_outside_raster_coverage_is_not_extrapolated():
    f=Farm(name='test',location='test',latitude=10,longitude=70,area=1,areaUnit='hectares')
    row=dict(path='test_raster.tif',source='soilgrids',property='ph',scale=.1,unit='pH')
    assert sample_record(row,f)['status']=='outside_coverage'
