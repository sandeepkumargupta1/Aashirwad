import asyncio
import copy
from datetime import datetime,timezone
from .models import Farm
from .domain import rank,SOURCES,haversine
from .connectors import nasa,groundwater
from .connectors.raster import OpenLandMap,SoilGrids,EOS04

EMPTY_SOIL=dict(ph=None,texture=None,sand=None,silt=None,clay=None,organicCarbon=None,totalNitrogen=None,cec=None,bulkDensity=None,origin='unavailable',date=None)

def demo_weather(season):
    rain=[842,965,788,1015,906] if season=='Kharif' else [86,62,103,74,91] if season=='Rabi' else [24,36,18,42,31]
    temp=27.1 if season=='Kharif' else 20.4 if season=='Rabi' else 30.2
    return dict(status='demo',source='Illustrative sample climate',resolution='Synthetic demonstration, not observations',fetchedAt=None,period='2020–2024 sample seasons',years=[dict(year=2020+i,rainfall=r,temperature=temp+(i-2)*.3,minTemperature=temp-7,maxTemperature=temp+7,drySpells=3+i%2,days=122 if season=='Kharif' else 151 if season=='Rabi' else 92,coverage=1) for i,r in enumerate(rain)],rainfall=sum(rain)/5,temperature=temp,humidity=62,wind=2.1,solar=18.2,solarUnit="MJ/m²/day (illustrative)",drySpells=3.4,monthly=[dict(month=m,rainfall=r,temperature=t) for m,r,t in zip(['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],[8,7,5,6,16,132,306,287,183,36,12,8],[16,19,24,29,33,30,27,26,26,25,21,17])])

async def analyze(farm:Farm,mode:str):
    data=farm.model_dump(exclude_none=True);soil=copy.deepcopy(EMPTY_SOIL);provenance={}
    if mode=='demo':
        weather=demo_weather(farm.season);soil.update(ph=7.1,texture='Clay loam',sand=28,silt=36,clay=36,organicCarbon=.62,totalNitrogen=.09,cec=24,bulkDensity=1.34,origin='demo',date='2025-01-15')
        water=dict(moisture=23.4,moistureDate='2025-11-15',wells=[dict(id='SAMPLE-01',name='Sample monitoring well A',latitude=23.224,longitude=77.101,depth=8.4,date='2025-11-15',distance=haversine(farm.latitude,farm.longitude,23.224,77.101),quality='Not tested')],status='demo')
    else:
        weather,olm,sg,eos,gw=await asyncio.gather(nasa.fetch(farm.latitude,farm.longitude,farm.season),asyncio.to_thread(OpenLandMap().query,farm),asyncio.to_thread(SoilGrids().query,farm),asyncio.to_thread(EOS04().query,farm),asyncio.to_thread(groundwater.query,farm.latitude,farm.longitude))
        # One configured depth avoids silently mixing layers. Keep all imports in provenance.
        import os
        depth=os.environ.get('AASHIRWAD_SOIL_DEPTH','0-30cm')
        candidates=olm['values']+sg['values']
        for row in candidates:
            prop=row.get('property')
            if row['status']=='imported_estimate' and row.get('depth')==depth and prop in soil and row.get('value') is not None:
                soil[prop]=row['value'];soil['origin']='mapped';soil['date']=row['observedAt'];provenance[prop]=row
        surface=next((v for v in eos['values'] if v['status']=='imported_estimate' and v.get('property')=='surfaceMoisture'),None)
        water=dict(moisture=surface['value'] if surface else None,moistureDate=surface['observedAt'] if surface else None,wells=gw['wells'],status='imported' if surface or gw['wells'] else 'awaiting_import')
        provenance.update(openlandmap=olm,soilgrids=sg,eos04=eos,cgwb=gw)
    if farm.texture:soil['texture']=farm.texture;provenance['texture']={'source':'Farmer input','value':farm.texture}
    if farm.soilTest:
        test=farm.soilTest
        for field in ('ph','organicCarbon'):
            value=getattr(test,field)
            if value is not None:soil[field]=value;provenance[field]={'source':'Farmer-confirmed laboratory report','date':test.date,'lab':test.lab,'value':value}
        if test.ph is not None:soil['origin']='measured'
        soil['date']=test.date
    sources=copy.deepcopy(SOURCES)
    for s in sources:
        if mode=='demo':s['status']='Farmer-confirmed' if s['id']=='shc' and farm.soilTest else 'Demo sample'
        elif s['id']=='nasa':s['status']='Cached' if weather.get('cached') else 'Fetched' if weather['status']=='available' else 'Unavailable'
        elif s['id']=='shc' and farm.soilTest:s['status']='Farmer-confirmed'
        elif s['id'] in ('olm','soilgrids','isro','cgwb'):
            key={'olm':'openlandmap','soilgrids':'soilgrids','isro':'eos04','cgwb':'cgwb'}[s['id']]
            s['status']='Imported' if provenance[key].get('status') in ('imported','imported_observations') else 'Import required'
    return dict(mode=mode,farm=data,analyzedAt=datetime.now(timezone.utc).isoformat(),soil=soil,weather=weather,crops=rank(data,soil,weather),sources=sources,water=water,yield_=dict(status='unavailable',reason='Call the yield endpoint with evaluated crop-model features. No model or unsupported location yields no prediction.'),provenance=provenance)
