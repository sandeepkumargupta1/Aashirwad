# Aashirwad

An agricultural decision-support application for Indian farms. Select a field, review soil and historical climate evidence, compare crops, and explore an indicative water balance.

## Run the dashboard

Use Node.js 22.13+ and pnpm (the checked-in `pnpm-lock.yaml` records exact versions).

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Open the address printed by the dev server. Start in **Demo** to explore clearly labeled synthetic records. Choose **Live data** to request NASA POWER's previous five complete seasonal records and use your confirmed soil-test entries. If an external request fails, the app keeps missing values empty and withholds unsupported scores.

The frontend is React + TypeScript with Tailwind, custom CSS, Recharts and Leaflet. The map offers Streets (OpenFreeMap/MapLibre, with an FOSSGIS OSM raster fallback), Satellite (Esri World Imagery) and Terrain (OpenTopoMap). Layers preserve the selected field and drawn boundary. Imagery is a reference basemap, not a live feed or a source of farm measurements. Map serving depends on provider availability and usage terms. No paid API subscription is built in.

## Run the Python data service

```bash
cd backend
python -m venv .venv
# macOS/Linux
source .venv/bin/activate
# Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

API documentation: `http://127.0.0.1:8000/docs`.

To connect the dashboard to this service, set `PYTHON_API_BASE_URL=http://127.0.0.1:8000` in the dashboard's local environment and restart `pnpm dev`. The TypeScript server forwards its `/api/*` requests to the configured Python service. Without that setting, the built-in TypeScript routes provide NASA POWER, analysis and irrigation functions; official raster/station imports run only in Python.

The Python service includes reusable OpenLandMap, SoilGrids, EOS-04 and CGWB connectors, Rasterio/Shapely field aggregation, a SQLite cache and farm-analysis records, and the scikit-learn training workflow. Imported rasters are queried locally. The supplied PostgreSQL/PostGIS schema is an optional migration design, **not an implemented PostgreSQL database adapter**.

## What is ready

- Automatic device-location request on opening; permission denial, timeout and unsupported-device handling.
- One-click current area, a nearby field map, and village/town search with explicit submission.
- Large labeled crop/water/soil actions, a simpler four-item menu and a clearer sprout logo. Coordinates, boundaries and extra form fields are optional advanced controls.
- Saved map-selected fields stay selected when a later GPS fix arrives. Field-specific soil tests are not reused at a different location.
- Animated bilingual welcome/sign-in page: a farmer’s prayer, rain reaching the hands, a drop watering a seed, and a full-grown plant. Pause/replay and reduced-motion support. Existing Sites/ChatGPT sign-in protects the hosted site.
- Refreshed responsive styling with larger controls, clearer typography, real crop photos and simple icons.
- Overview, soil, climate, water, crops, advisory, comparison and data-source screens.
- A free English/Hindi voice and typed assistant controls navigation, maps, farm settings, crop comparison, soil-test drafts, irrigation scenarios and downloads. It reads actual app values and requests confirmation before saving changes.
- Optional on-device AI uses WebLLM/Qwen3 without an API key, server inference or billing setup; about 400 MB downloads once, with WebGPU and about 2 GB graphics memory required. Voice and typed commands work without loading the model. See `docs/ASSISTANT.md`.
- English/Hindi throughout screens, forms, charts, crop explanations, source notes and messages. Scientific units, publisher names and farmer-entered names retain their original form. Language preference persists between visits.
- Explicit demo/live separation; loading, failure and partial-data states.
- Soil Health Card manual entry, structured JSON import, confirmation and laboratory priority. No PDF/OCR extraction is claimed.
- Nine configurable crop profiles, real reference plant photos, visible factor weights, missing-evidence checks and water scenarios. Photo credits and licenses are available under Data & sources and in `docs/PHOTO_CREDITS.md`.
- Historical NASA POWER request, missing-value handling, cross-year Rabi grouping and 24-hour caching.
- An indicative weekly ETc calculator using user-entered ETo and effective rain, with FAO stage coefficients where configured.
- Official local raster imports, polygon/radius aggregation, nearest groundwater station observations and source metadata.
- Crop-specific baseline/Random Forest training with separate past calibration, future-year testing, held-out districts, MAE/RMSE and empirical interval evaluation.
- Farm report JSON export and source-code download.

## What still needs real data or review

No official regional soil/moisture/well files or real trained yield model are shipped. NASA requests need working outbound HTTPS access. The current hosted instance does not run a Python process or contain local raster imports: its Python service can be deployed separately and configured through `PYTHON_API_BASE_URL`. It returns no yield estimate without an evaluated crop model. A real model was not trained during this build because no adequate labeled dataset was supplied.

Agronomic ranges and scoring weights are an explainable initial screening configuration. Regional agronomist review, local crop calendars, soil sampling and model validation are still required for field deployment. A score is relative suitability, not success probability. Satellite surface moisture is not root-zone storage or groundwater. No fertilizer dose, exact borewell capacity, future weather forecast or profit estimate is invented.

## Verify

```bash
pnpm typecheck
pnpm test
cd backend
python -m pytest tests -q
```

Tests cover missing-data withholding, lab priority, score limits, water units, seasonal aggregation, validation, API responses, raster masks/scales and geographic/temporal model separation. Synthetic test fixtures are created only in temporary test folders and are never installed as real models.

## Project layout

```text
app/                  Dashboard entry, styles, hosted /api routes
components/           Dashboard, map, charts and crop illustrations
lib/                  Shared types, screening engine, climate aggregation and validation
data/                 Crop profiles and official source catalog
backend/app/          FastAPI service, domain rules, SQLite and yield model
backend/app/connectors/  NASA, rasters and groundwater connectors
backend/import_data.py   Official local raster/station import CLI
backend/train_yield.py   Real APY model training CLI
backend/schema.sql       Optional PostgreSQL/PostGIS schema
backend/data/            Blank import templates (no official observations)
tests/                TypeScript domain tests
backend/tests/        API, geospatial and model tests
docs/                 Architecture, dataset setup, agronomic method and limitations
```

Read [Architecture](docs/architecture.md), [Data source setup](docs/data-sources.md), [Agronomic method](docs/agronomic-method.md) and [Validation and remaining work](docs/validation.md).

## Location and village search

The browser must grant location permission; websites cannot bypass this. GPS centers the map automatically and starts live analysis when supported. The map remains available when permission is denied. Device accuracy is shown when available; the farmer can tap a nearby field instead. Named-place lookup uses `/api/places/search` and `/api/places/reverse`. Reverse lookup rounds coordinates to three decimals for the area name; the selected field retains the device coordinates.

Village search uses the [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/): explicit search only (no autocomplete), identifying User-Agent, visible attribution, cached results and at least 1.1 seconds between upstream calls per service instance. This private demonstration has one owner. For a multi-user or scaled deployment, configure `GEOCODER_BASE_URL` to a self-hosted/authorized compatible endpoint and enforce the publisher rate limit across all instances. Search outages show a clear message and preserve map selection. This service is independent of the optional FastAPI gateway.
