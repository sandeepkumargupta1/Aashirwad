from datetime import date
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator

class SoilTest(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False, extra='forbid')
    ph: float | None = Field(None, ge=0, le=14)
    nitrogen: float | None = Field(None, ge=0, le=5000)
    phosphorus: float | None = Field(None, ge=0, le=5000)
    potassium: float | None = Field(None, ge=0, le=5000)
    ec: float | None = Field(None, ge=0, le=100)
    organicCarbon: float | None = Field(None, ge=0, le=100)
    zinc: float | None = Field(None, ge=0, le=10000)
    iron: float | None = Field(None, ge=0, le=10000)
    date: str
    lab: str = Field(min_length=1, max_length=200)
    confirmed: Literal[True]

    @model_validator(mode='after')
    def validate_sample(self):
        if date.fromisoformat(self.date) > date.today():
            raise ValueError('Sampling date is in the future')
        if all(getattr(self, k) is None for k in ('ph','nitrogen','phosphorus','potassium','ec','organicCarbon','zinc','iron')):
            raise ValueError('At least one measured value is required')
        return self

class Farm(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False, extra='forbid')
    name: str = Field(min_length=1, max_length=100)
    location: str = Field(min_length=1, max_length=150)
    latitude: float = Field(ge=6, le=38)
    longitude: float = Field(ge=68, le=98)
    radiusKm: float = Field(1, ge=0.1, le=10)
    area: float = Field(gt=0, le=10000)
    areaUnit: Literal['acres','hectares'] = 'acres'
    season: Literal['Kharif','Rabi','Zaid'] = 'Rabi'
    irrigation: Literal['Rain-fed','Limited','Reliable'] = 'Limited'
    irrigationSource: str = Field('Borewell', max_length=100)
    texture: Literal['Loam','Clay loam','Sandy loam','Clay','Silt loam'] | None = None
    soilTest: SoilTest | None = None
    existingCrop: str = Field('', max_length=40)
    boundary: list[tuple[float,float]] = Field(default_factory=list, max_length=200)

    @model_validator(mode='after')
    def validate_boundary(self):
        if self.boundary:
            if len(self.boundary) < 3:
                raise ValueError('A field boundary needs at least three vertices')
            if any(not (6 <= lat <= 38 and 68 <= lon <= 98) for lat,lon in self.boundary):
                raise ValueError('Boundary coordinates must be within the supported India extent')
            from shapely.geometry import Polygon
            polygon = Polygon([(lon,lat) for lat,lon in self.boundary])
            if not polygon.is_valid or polygon.area == 0:
                raise ValueError('Boundary must be a valid, non-self-intersecting polygon')
        return self

class AnalyzeRequest(BaseModel):
    farm: Farm
    mode: Literal['demo','live'] = 'live'

class IrrigationRequest(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)
    cropId: str
    stage: int = Field(ge=0, le=3)
    eto: float = Field(ge=0, le=15)
    rain: float = Field(ge=0, le=500)
    areaHa: float = Field(gt=0, le=10000)
    efficiency: float = Field(ge=0.3, le=1)

class YieldRequest(BaseModel):
    crop: str
    areaHa: float = Field(gt=0, le=10000)
    features: dict = Field(default_factory=dict)
