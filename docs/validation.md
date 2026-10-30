# Validation and remaining work

## Automated checks

- TypeScript: score bounds and seasonal caps; missing data withholding; lab overrides; water-category scenarios; hectare and distance units; irrigation limits; cross-year climate seasons and leap days; NASA missing values; request and soil-report validation.
- Python: FastAPI demo/live responses and SQLite record creation; invalid coordinates and polygons; measured soil priority; no invented yield; irrigation calculations; climate aggregation; spatial raster masks, scales and outside-coverage handling; geographic/temporal split disjointness; synthetic training fixture written only to a temporary test folder.
- Production build: Sites/Vinext build helper and Worker asset packaging.

These are software checks, not agronomic or yield-model field validation. No real yield training/evaluation was completed without a suitable official dataset.

## Data and functionality boundaries

- The hosted site includes the full interactive dashboard and TypeScript API. Python imports/training are shipped as separately runnable source.
- Official soil rasters, EOS-04 products, CGWB records and real APY models must be supplied through their official access workflows. Import connectors do not imply that those datasets are already loaded.
- Live NASA POWER availability depends on external access, service health and publisher limits. The managed preview may restrict outbound requests. A failed live request remains visibly unavailable.
- The browser used for QA may lack WebGL2. The map retains coordinate, radius and boundary interactions and attempts the documented FOSSGIS OSM raster fallback. An unavailable basemap is labeled and is not replaced with a fictional satellite image.
- Hindi covers navigation and primary interface labels. Detailed source and agronomic text is in English.
- Soil Health Card import supports JSON and manual entries, not unverified OCR of arbitrary PDFs.
- A PostGIS schema is provided; the current implemented persistence is SQLite. Browser-only mode stores farm inputs locally rather than offering cloud account synchronization.
- Raster aggregation is an unweighted mean/mode of valid pixel centres. It does not claim a 1 km map can determine exact farm soil, aquifer storage, pumping capacity or nutrient doses.
- The crop rule database and weight choices need region-specific expert review; the app clearly labels them as screening rules.
- Model artifacts need real data, leakage-free feature joins, adequate domain coverage and acceptable independent evaluation. The service withholds predictions by default.

## Build phases delivered

1. Complete frontend and FastAPI project structure, source documentation and demo.
2. Map/GPS/pin/polygon/radius and local geospatial query code.
3. NASA connector and authorized OpenLandMap import workflow.
4. SoilGrids raster workflow independent of the paused REST API.
5. Official EOS-04 and CGWB import tools, source metadata and station distance logic.
6. Configurable crop screening engine with tests and visible evidence gaps; regional review pending.
7. Real-data model training/evaluation pipeline; actual trained model pending adequate source data.
8. Approximate ETc scenario and cautious soil-management advice.
9. All requested dashboard sections plus overview and source documentation.
10. Meaningful software checks, deployment setup and runnable demonstration.

## Automatic-location update

The updated interface requests device location once when opened, offers current-area and nearby-map actions, and moves coordinate entry behind More map options. New tests cover successful GPS fixes, permission denial, timeouts, unavailable/unsupported devices, outside-area fixes, saved-location validation, field-specific soil-test isolation, place parsing, bounded search, caching and throttling. Location cannot bypass browser permission; no IP-based or example location is substituted for a failed device request. Named-place service availability depends on outbound access.
