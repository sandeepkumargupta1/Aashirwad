import json
import math
from .config import ROOT
CROPS=json.loads((ROOT/'data'/'crops.json').read_text())
SOURCES=json.loads((ROOT/'data'/'sources.json').read_text())

def haversine(a,b,c,d):
    r=math.radians
    x=math.sin(r(c-a)/2)**2+math.cos(r(a))*math.cos(r(c))*math.sin(r(d-b)/2)**2
    return 6371*2*math.asin(min(1,math.sqrt(x)))

def rank(farm,soil,weather):
    def score_range(v,r,slack):
        return 100 if r[0]<=v<=r[1] else max(0,100-100*min(abs(v-r[0]),abs(v-r[1]))/slack)
    climate_ok=weather.get('temperature') is not None and weather.get('rainfall') is not None and len(weather.get('years',[]))>=5
    result=[]
    for c in CROPS:
        seasonal=farm['season'] in c['seasons']
        water=100 if farm['irrigation']=='Reliable' else ((25 if c['water']=='High' else 70 if c['water']=='Medium' else 95) if farm['irrigation']=='Limited' else (10 if c['water']=='High' else 40 if c['water']=='Medium' else 75))
        if farm['irrigation']=='Rain-fed' and climate_ok:
            water=max(water,min(65 if c['water']=='High' else 100,weather['rainfall']*.7/c['waterMm'][0]*100))
        factors=[
            dict(name='Growing season',weight=25,value=100 if seasonal else 0,detail=f"{farm['season']} {'is' if seasonal else 'is not'} a listed growing season."),
            dict(name='Water availability',weight=25,value=water,detail=f"{farm['irrigation']}; {c['water'].lower()} water demand. Rainfall is historical context."),
            dict(name='Seasonal temperature',weight=20,value=score_range(weather['temperature'],c['temp'],12) if climate_ok else None,detail=f"Indicative temperature range: {c['temp']} °C. Five complete seasons required."),
            dict(name='Soil pH',weight=20,value=score_range(soil['ph'],c['ph'],2) if soil.get('ph') is not None else None,detail=f"Indicative pH range: {c['ph']}. Add a confirmed soil test when missing."),
            dict(name='Soil texture',weight=10,value=(100 if soil['texture'] in c['textures'] else 35) if soil.get('texture') else None,detail=f"Preferred texture labels: {', '.join(c['textures'])}.")
        ]
        coverage=sum(f['weight'] for f in factors if f['value'] is not None)
        raw=sum((f['value'] or 0)*f['weight'] for f in factors)/max(1,coverage)
        value=math.floor((raw if seasonal else min(39,raw))+.5)
        enough=coverage>=70 and climate_ok and (soil.get('ph') is not None or soil.get('texture'))
        result.append(dict(**c,score=value if enough else None,screeningScore=value,eligible=seasonal,coverage=coverage,factors=factors,reasons=[f['detail'] for f in factors if f['value'] is not None and f['value']>=70],gaps=[f['detail'] for f in factors if f['value'] is None]+['Local yield performance, groundwater capacity, nutrient availability and root-zone moisture are not scored.']))
    return sorted(result,key=lambda c:(not c['eligible'],-c['screeningScore'],c['name']))

def irrigation(v):
    c=next((c for c in CROPS if c['id']==v.cropId),None)
    if not c or c['kc'] is None:
        raise ValueError('No verified crop coefficient is configured for this crop')
    kc=c['kc'][v.stage];etc=v.eto*kc*7;net=max(0,etc-v.rain);gross=net/v.efficiency
    return dict(kc=kc,cropEtMm=etc,netMm=net,grossMm=gross,volumeM3=gross*v.areaHa*10,periodDays=7,method='ETc = ETo × Kc; net = max(0, 7-day ETc − effective rain); gross = net / efficiency.',assumptions='Illustrative balance only. Root-zone storage and capillary rise are unknown. Not a field irrigation schedule.')
