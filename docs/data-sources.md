# Data integration and imports

Each pathway distinguishes original measurement/estimate, units, spatial scale, observation date, retrieval/import time and availability. Never replace failed official requests with demo values. Dataset links below were checked against publisher documentation during this build (30 October 2026); services and terms can change.

| Source | Access used | Content and limits |
| --- | --- | --- |
| [NASA POWER daily API](https://power.larc.nasa.gov/docs/services/api/temporal/daily/) | Direct server HTTPS; no embedded API key | Daily T2M, min/max, PRECTOTCORR, RH2M, WS2M, solar. Regional historical grid, not a 1 km measurement or forecast. Cache 24 hours. |
| [OpenLandMap catalog](https://developers.google.com/earth-engine/datasets/catalog/OpenLandMap_SOL_SOL_TEXTURE-CLASS_USDA-TT_M_v02) | Operator downloads GeoTIFF or exports permitted Earth Engine data | Soil texture and depth. The cited v02 product is 250 m. Earth Engine requires its own registration/eligibility; check current use terms. |
| [ISRIC SoilGrids](https://docs.isric.org/globaldata/soilgrids/) | Official WCS/WebDAV raster download; local Rasterio query | pH, texture, carbon, total N, CEC, bulk density by depth. REST was paused in the checked official notice; this app does not depend on it. SoilGrids data is CC BY 4.0; retain attribution and uncertainty. |
| [ISRO EOS-04 surface moisture](https://www.isro.gov.in/High-Resolution_Operational_Soil_Moisture_Product.html) | Authorized Bhoonidhi download; local import | 500 m surface-soil moisture product. Registration/EULA applies. [Bhoonidhi](https://bhoonidhi.nrsc.gov.in/bhoonidhi/home.html) advertises API access by contacting the provider; no unauthenticated universal API is assumed. |
| [CGWB monitoring](https://cgwb.gov.in/en/ground-water-level-monitoring) | Official download normalized to CSV | Station water levels, dates, optional quality and multiple observations. Nearest-well distances are computed, not interpolated into an exact farm groundwater measurement. |
| [Soil Health Card](https://soilhealth.dac.gov.in/) | Farmer entry or JSON report, confirmed before saving | Available nutrients, pH, EC, carbon and micronutrients. Laboratory values take priority. Automatic PDF/OCR is not implemented. |
| [Government APY](https://data.desagri.gov.in/website/crops-apy-report-web) | District/crop/year export normalized to CSV | Area in hectares, production in tonnes; yield computed as production/area. Validate units and crop aliases. Some official datasets may use different units for specific crops. |
| [OpenFreeMap](https://openfreemap.org/quick_start/) | Public vector basemap, no API key | OpenStreetMap-derived map with visible OpenFreeMap/OpenMapTiles/OSM attribution. WebGL2 required by current MapLibre; FOSSGIS OSM raster fallback follows its publisher policy. |

## 1. Historical climate

NASA request construction lives in `lib/weather.ts` and `backend/app/connectors/nasa.py`. The request covers six complete calendar years to obtain five full cross-year Rabi seasons, ending at the last complete calendar year. Kharif uses June–September; Rabi November–March; Zaid March–May. These generalized screening windows are not local sowing calendars.

Fill values and nonfinite observations are excluded. Seasons with <98% of expected daily values are excluded; rainfall totals are not inflated to compensate. Dry spells are distinct runs of at least seven consecutive valid days with rainfall <1 mm/day, broken at missing dates. Missing solar/humidity/wind values do not become zero observations. Solar values retain source units when supplied. The in-memory hosted cache is best-effort per Worker instance; the Python cache is durable SQLite. Avoid repeated calls to the same grid cell; this first implementation caches by rounded coordinate, so a high-traffic deployment should add a shared grid-aware cache.

## 2. Official rasters

Download the product from the official publisher using the publisher's allowed workflow. Crop/reproject huge files if needed with GDAL/QGIS before import. Do not download global rasters into the small hosted Worker.

From `backend/`, import a real pH raster using **the scale, depth and dates in its official metadata**:

```bash
python import_data.py raster \
  --source soilgrids --path /absolute/path/to/official-ph.tif \
  --property ph --unit pH --scale 0.1 --depth 0-30cm \
  --observed 2020-01-01 --resolution '250 m' \
  --source-url https://docs.isric.org/globaldata/soilgrids/ \
  --license 'CC BY 4.0' --uncertainty 'Not supplied in this file'
```

The command illustrates syntax. The example date/depth are **not assertions about your file**. SoilGrids typically supplies standard individual depth intervals; import those as-is and set `AASHIRWAD_SOIL_DEPTH` to the matching interval. Do not relabel a `0-5cm` band as `0-30cm`. A depth-integrated estimate requires an explicit preprocessing method and provenance.

For sand/silt/clay, carbon, N, CEC and bulk density, inspect source encoded units and set the appropriate scale yourself. Normalized output units expected by the dashboard are pH, texture label, fractions %, organic carbon %, total nitrogen %, CEC cmol(c)/kg and bulk density g/cm³. Conversions are never guessed from filenames. Texture-class rasters require `--classes` with the official code-to-label mapping. SoilGrids uncertainty layers can be imported and retained in provenance; this initial interface does not merge a full quantile stack into a combined farm uncertainty interval.

EOS-04 uses `--source eos04 --property surfaceMoisture`, the product's actual unit and scale, an actual observation date and `--quality-note`. If a separate aligned QA raster is supplied, use `--qa-raster FILE --qa-values VALID_CODES`. The CLI masks invalid flags before installing a normalized GeoTIFF. Check the product's official ATBD for mask interpretation; no default mask can cover every product version. Surface moisture is not groundwater or a substitute for root-zone readings.

The importer records SHA-256, source URL, licence, scale, depth, observation/import dates and quality note. It writes an atomic catalog. Imports must already be official, authorized files: the program does not bypass registration or scrape authenticated pages.

## 3. Groundwater stations

Normalize an official CGWB/NWIC download to the headers in `backend/data/groundwater_template.csv`. Required columns:

```text
id,name,latitude,longitude,depth_m,observed_at,quality,source_url
```

Depth is metres below local ground level, not borehole construction depth. Use ISO dates. Keep station IDs stable over time and retain source URLs; do not treat measurements from different stations as one time series. Multiple observations per station are permitted; duplicate station/date pairs are rejected.

```bash
python import_data.py groundwater --path /absolute/path/to/normalized-official-wells.csv
```

The connector finds stations within a configurable search radius (default 50 km), sorts by haversine distance and returns their dated history. A positive depth change means water became deeper, but comparison across seasons is not automatically a long-term trend. No well data is shipped, so the hosted interface shows an import-required state.

## 4. Real yield data

Use `backend/data/yield_template.csv`, with crop aliases matching `data/crops.json` IDs. Each row represents a state/district/crop/season/year. The service rejects unresolved duplicates, invalid area and nonfinite output. Numeric climate/soil features must be joined using information available at prediction time, with documented geographic and temporal alignment. Do not join future realized weather and describe the model as a pre-sowing forecast.

```bash
python train_yield.py --csv /absolute/path/to/real-normalized-apy.csv --crop wheat
```

Training requires ≥150 crop records, ≥7 years and ≥8 district groups plus minimum independent split sizes. Entire state/district groups are held out. Earlier years train the model, the next year calibrates residual bands, and the final two years test temporal and geographic behavior. Random Forest is retained only if it improves on a median baseline on both evaluations. Reports include MAE, RMSE, interval coverage, data hash and exact split years/groups. Artifacts failing the configured coverage checks cannot predict. No real dataset or model is bundled.

Model joblib files are loaded only from the operator-owned model folder. Never install arbitrary uploaded pickle/joblib files. The first model remains a regional baseline requiring field validation and agronomist review.

The raster fallback is operated independently by FOSSGIS / OpenStreetMap Germany and is intended here for a low-traffic academic/personal demonstration. Their [published service terms](https://www.openstreetmap.de/nutzen/dienste-osm-de/) apply, including commercial-use restrictions. A larger deployment should self-host or configure a provider with suitable terms. The app performs no bulk tile downloads.

## 5. Current location and named places

Device coordinates come from the browser Geolocation API after permission, not from the default demonstration farm. The current location is shown with its reported accuracy and used to center the nearby field map. Farmers can also search for an Indian village/town or tap the map; coordinates are optional advanced inputs. An explicit saved map/search selection is preserved when a later automatic GPS result arrives.

Place names use Nominatim. [Its publisher policy](https://operations.osmfoundation.org/policies/nominatim/) requires an identifying client, attribution, cached results, no client autocomplete, and at most one request/second. The service spaces requests at least 1.1 seconds apart per instance and caches for 24 hours. Use a self-hosted or authorized compatible `GEOCODER_BASE_URL` with a shared limiter before scaling beyond this private single-owner demonstration. Nearby search applies a bounding box about 50 km from the device fix; all-India search remains optional. No results are fabricated on a service failure.
