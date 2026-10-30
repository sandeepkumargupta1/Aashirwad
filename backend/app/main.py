"""Run from backend: uvicorn app.main:app --host 127.0.0.1 --port 8000."""
import asyncio
from fastapi import FastAPI,HTTPException,Query
from fastapi.middleware.cors import CORSMiddleware
from .models import AnalyzeRequest,Farm,IrrigationRequest,YieldRequest,SoilTest
from .domain import irrigation,CROPS,SOURCES
from .service import analyze
from .db import save_farm
from .connectors import nasa,groundwater
from .connectors.raster import OpenLandMap,SoilGrids,EOS04
from .yield_model import predict
app=FastAPI(title='Aashirwad Agricultural API',version='1.0.0',description='Local official-data imports, transparent agronomic screening and evaluated yield-model pipeline.')
app.add_middleware(CORSMiddleware,allow_origins=['http://localhost:3000','http://localhost:5173','http://127.0.0.1:3000'],allow_methods=['GET','POST'],allow_headers=['Content-Type'])

@app.get('/api/health')
def health():return dict(status='ok',application='Aashirwad',version='1.0.0')

@app.post('/api/farms/analyze')
async def analyze_farm(request:AnalyzeRequest):
    result=await analyze(request.farm,request.mode)
    result['yield']=result.pop('yield_')
    result['recordId']=await asyncio.to_thread(save_farm,request.farm.model_dump(),result)
    return result

@app.get('/api/weather/historical')
async def weather(latitude:float=Query(ge=6,le=38),longitude:float=Query(ge=68,le=98),season:str=Query('Rabi',pattern='^(Kharif|Rabi|Zaid)$')):
    return await nasa.fetch(latitude,longitude,season)

def pin_farm(latitude,longitude,radius):
    return Farm(name='API query',location='Coordinates',latitude=latitude,longitude=longitude,radiusKm=radius,area=1,areaUnit='hectares')

@app.get('/api/soil')
def soil(latitude:float=Query(ge=6,le=38),longitude:float=Query(ge=68,le=98),radius:float=Query(1,ge=.1,le=10)):
    farm=pin_farm(latitude,longitude,radius)
    return dict(openlandmap=OpenLandMap().query(farm),soilgrids=SoilGrids().query(farm))

@app.get('/api/moisture')
def moisture(latitude:float=Query(ge=6,le=38),longitude:float=Query(ge=68,le=98),radius:float=Query(1,ge=.1,le=10)):
    return EOS04().query(pin_farm(latitude,longitude,radius))

@app.get('/api/groundwater')
def wells(latitude:float=Query(ge=6,le=38),longitude:float=Query(ge=68,le=98),radius:float=Query(50,ge=1,le=100)):
    return groundwater.query(latitude,longitude,radius)

@app.get('/api/crops/recommendations')
def crop_profiles():return dict(profiles=CROPS,notice='POST a farm and mode for ranked recommendations.')

@app.post('/api/crops/recommendations')
async def recommendations(request:AnalyzeRequest):return await analyze_farm(request)

@app.post('/api/yield/predict')
def yield_prediction(request:YieldRequest):
    try:result=predict(request.crop,request.features,request.areaHa)
    except ValueError as e:raise HTTPException(422,str(e))
    if result['status']=='unavailable':raise HTTPException(422,result)
    return result

@app.post('/api/irrigation/estimate')
def water_estimate(request:IrrigationRequest):
    try:return irrigation(request)
    except ValueError as e:raise HTTPException(422,str(e))

@app.post('/api/soil-tests/validate')
def validate_soil_test(test:SoilTest):return dict(status='farmer_confirmed',test=test.model_dump(),notice='Values are farmer-confirmed, not independently laboratory-verified by Aashirwad.')

@app.get('/api/sources')
def sources():return SOURCES
