import asyncio
import calendar
import math
from datetime import date, datetime, timezone, timedelta
from statistics import mean
import httpx
from ..db import cache_get,cache_put
PARAMETERS='T2M,T2M_MAX,T2M_MIN,PRECTOTCORR,RH2M,WS2M,ALLSKY_SFC_SW_DWN'

def unavailable(error):
    return dict(status='unavailable',source='NASA POWER',resolution='Regional climate grid',fetchedAt=None,period='Unavailable',years=[],monthly=[],rainfall=None,temperature=None,humidity=None,wind=None,solar=None,drySpells=None,error=str(error))

def season_key(d,season):
    y,m=int(d[:4]),int(d[4:6])
    if season=='Kharif':return y if 6<=m<=9 else None
    if season=='Zaid':return y if 3<=m<=5 else None
    return y if m>=11 else y-1 if m<=3 else None

def valid(v):return isinstance(v,(int,float)) and math.isfinite(v) and v>-900

def aggregate(params,season,fetched,solar_unit=None):
    groups={};monthly=[[] for _ in range(12)]
    for d in sorted(params.get('T2M',{})):
        values=[params.get(k,{}).get(d) for k in ('T2M','PRECTOTCORR','T2M_MIN','T2M_MAX')]
        if not all(valid(v) for v in values) or values[1]<0:continue
        t,r,lo,hi=values
        monthly[int(d[4:6])-1].append((r,t))
        key=season_key(d,season)
        if key is not None:groups.setdefault(key,[]).append((d,r,t,lo,hi))
    years=[]
    for y,rows in sorted(groups.items()):
        expected=122 if season=='Kharif' else 92 if season=='Zaid' else (date(y+1,4,1)-date(y,11,1)).days
        coverage=len(rows)/expected
        if coverage<.98:continue
        run=spells=0;previous=None
        for d,r,*_ in rows:
            current=datetime.strptime(d,'%Y%m%d').date()
            if previous and current-previous!=timedelta(days=1):run=0
            run=run+1 if r<1 else 0
            if run==7:spells+=1
            previous=current
        years.append(dict(year=y,rainfall=round(sum(r[1] for r in rows),1),temperature=round(mean(r[2] for r in rows),1),minTemperature=round(mean(r[3] for r in rows),1),maxTemperature=round(mean(r[4] for r in rows),1),drySpells=spells,days=len(rows),coverage=coverage))
    years=years[-5:];selected={r['year'] for r in years}
    def avg(key):
        v=[v for d,v in params.get(key,{}).items() if season_key(d,season) in selected and valid(v)]
        return mean(v) if v else None
    months=[dict(month=calendar.month_abbr[i+1],rainfall=round(mean(v[0] for v in rows)*[31,28.25,31,30,31,30,31,31,30,31,30,31][i],1),temperature=round(mean(v[1] for v in rows),1)) for i,rows in enumerate(monthly) if rows]
    return dict(solarUnit=solar_unit or 'Source units unspecified',status='available' if len(years)>=5 else 'unavailable',source='NASA POWER',resolution='Regional grid: meteorology about 0.5° × 0.625°, solar about 1°; not a farm measurement',fetchedAt=fetched,period=f"{years[0]['year']}–{years[-1]['year']} seasonal start years" if years else 'No complete seasons',years=years,monthly=months,rainfall=mean(y['rainfall'] for y in years) if years else None,temperature=mean(y['temperature'] for y in years) if years else None,humidity=avg('RH2M'),wind=avg('WS2M'),solar=avg('ALLSKY_SFC_SW_DWN'),drySpells=mean(y['drySpells'] for y in years) if years else None,**({'error':'Fewer than five complete seasons. Rankings withheld.'} if len(years)<5 else {}))

async def fetch(latitude,longitude,season):
    end=date.today().year-1;key=f'power:{latitude:.3f}:{longitude:.3f}:{end}'
    cached=await asyncio.to_thread(cache_get,key)
    if cached:
        cached_payload,at=cached
        payload=cached_payload.get('data',cached_payload)
        return dict(aggregate(payload,season,datetime.fromtimestamp(at,timezone.utc).isoformat(),cached_payload.get('solarUnit')),cached=True)
    query=dict(latitude=latitude,longitude=longitude,start=f'{end-5}0101',end=f'{end}1231',community='AG',parameters=PARAMETERS,format='JSON')
    try:
        async with httpx.AsyncClient(timeout=25) as client:
            response=await client.get('https://power.larc.nasa.gov/api/temporal/daily/point',params=query)
            response.raise_for_status();raw=response.json();payload=raw['properties']['parameter'];solar_unit=raw.get('parameters',{}).get('ALLSKY_SFC_SW_DWN',{}).get('units')
        if not payload.get('T2M') or not payload.get('PRECTOTCORR'):raise ValueError('NASA response lacks required parameters')
        await asyncio.to_thread(cache_put,key,dict(data=payload,solarUnit=solar_unit))
        return aggregate(payload,season,datetime.now(timezone.utc).isoformat(),solar_unit)
    except (httpx.HTTPError,ValueError,KeyError) as error:
        return unavailable(f'Historical climate request failed: {error}')
