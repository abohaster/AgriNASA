# AgriNASA — NASA-Powered Smart Agriculture Decision Support for Wheat, Potato and Tomato

A runnable, honest decision-support platform for a crop field. It downloads
public NASA POWER weather data, computes reference evapotranspiration, crop water
use, a root-zone water balance, irrigation demand and environmental crop-stress
indicators with **deterministic, tested code**. An optional AI assistant only
*explains* those computed values; it never calculates or changes them.

The project is designed to be read and extended by students: every science
module documents its formula, units, assumptions and limitations, and every screen
shows where its numbers came from.

> **What this is not:** it is not a disease diagnostic tool, not a yield
> predictor, not a validated prescription service, and not an on-farm sensor
> network. NASA POWER is coarse reanalysis data (~0.5° grid), not a measurement
> of your field.

---

## Contents

1. [Quick start](#quick-start)
2. [What the platform does](#what-the-platform-does)
3. [Data sources and provenance](#data-sources-and-provenance)
4. [Scientific methods](#scientific-methods)
5. [AI assistant design](#ai-assistant-design)
6. [Demo mode](#demo-mode)
7. [Configuration](#configuration)
8. [API reference](#api-reference)
9. [Database](#database)
10. [Tests](#tests)
11. [Project structure](#project-structure)
12. [Limitations and honesty rules](#limitations-and-honesty-rules)
13. [Security notes](#security-notes)
14. [Troubleshooting](#troubleshooting)
15. [Attribution](#attribution)

---

## Quick start

### Requirements

| Tool | Version | Notes |
| --- | --- | --- |
| Python | 3.11+ (tested on 3.12) | FastAPI backend and science modules |
| Node.js | 18+ (tested on 24) | React + Vite frontend |
| npm | ships with Node | dependency install |

No NASA account, API key or database server is required.

### 1. Configure (optional)

```bash
cp .env.example .env
```

The template sets `DATA_MODE=demo`, which replays a cached real NASA POWER
snapshot and works fully offline. Change it to `DATA_MODE=live` to call NASA
POWER over the network. If you skip this step, the built-in default is `live`.

### 2. Backend

```bash
cd backend
python -m venv .venv

# Windows (Git Bash / PowerShell):
.venv/Scripts/python.exe -m pip install -r requirements.txt
# macOS / Linux:
# source .venv/bin/activate && pip install -r requirements.txt

.venv/Scripts/python.exe -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

- API: <http://127.0.0.1:8000>
- Interactive docs: <http://127.0.0.1:8000/docs>
- Health check: <http://127.0.0.1:8000/api/health>

The SQLite database and its tables are created automatically on first start.

### 3. Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

Open <http://127.0.0.1:5173>. The Vite dev server proxies `/api` to the backend,
so the browser sees one origin and no secrets are ever bundled.

### 4. Create a field

Use **New field** in the UI, or seed one from the API:

```bash
curl -X POST http://127.0.0.1:8000/api/fields \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Demo wheat field",
    "latitude": 26.15,
    "longitude": 32.72,
    "crop_id": "wheat",
    "planting_date": "2025-11-15",
    "area_ha": 4.2,
    "soil_texture": "loam",
    "irrigation_system": "sprinkler",
    "location_label": "Qena, Egypt"
  }'
```

Then open `/dashboard/<id>`. The **Use demo field values** button in the setup
form fills the same Qena coordinates so you can explore without typing.

On the map, choose **Draw field boundary** and click four corners in order around
the field edge. The corners are joined into a GeoJSON Polygon, an area estimate in
hectares and feddan is shown, and the polygon is saved exactly as drawn. The
outline is for display and area only: weather is still sampled from the NASA POWER
grid cell nearest the saved field centre, never averaged over the polygon.

---

## Deploy online

The repository ships a single Docker image that builds the React app and serves
it from FastAPI on `$PORT`, so one service runs the whole site with no CORS
setup.

**Render (recommended).** Push this repository to GitHub, then either:

- open **Dashboard → New + → Blueprint** and pick the repository — `render.yaml`
  creates the service and asks for the Earth Engine and Fale7 values securely, or
- create a **Web Service** manually: Language **Docker**, health check
  `/api/health`, and set `DATA_MODE=live`, `SEED_DEMO_TRIALS=1`,
  `GEE_SERVICE_ACCOUNT`, `GEE_PROJECT` and `GEE_PRIVATE_KEY_JSON` (the whole
  service-account JSON on one line).

Free instances sleep when idle and lose their SQLite file on redeploy. For
durable fields, use a paid instance with a disk mounted at `/var/data` and set
`DATABASE_URL=sqlite:////var/data/agrinasa.db`. Never commit `.env` or the
credentials JSON; the container reads them from environment variables only.

---

## What the platform does

| Screen | Purpose |
| --- | --- |
| **Home** | Explains the platform, its scope and its data honesty rules. |
| **Fields** | Lists saved fields and their current crop day. |
| **New field** | Creates a field profile; validates coordinates, planting date, soil and irrigation system, and can store a user-drawn four-corner boundary. |
| **Dashboard** | Latest weather, 30-day overview, irrigation and health priorities, map context, assistant preview, provenance. A date-period selector (today, yesterday, 7/30 days, this/previous month, season, year, or a custom range) re-queries the backend. |
| **Analytics** | Six weather/ET₀ charts with coverage and source labels, driven by the same date-period selector. |
| **Irrigation** | Demand class, refill requirement, daily balance chart and the full calculation chain for a chosen analysis date. |
| **Crop health** | Heat, frost, water, rainfall-anomaly and NDVI indicators with no disease diagnosis, assessed for a chosen analysis date. |
| **Satellite** | Sentinel-1 relative surface wetness and Sentinel-2 NDVI/NDMI/NDWI with Earth Engine map layers, or a clear "not configured" state. |
| **Robot** (`/robot/{fieldId}`) | Pairs an ESP32 robot by one-time QR, shows measured soil-moisture/DHT22/ultrasonic readings and their series, and places them beside satellite indices and the water balance without claiming an accuracy gain. |
| **Assistant** | Chat grounded in the exact computed context, with a rule-based fallback and a "view data sent" disclosure. |
| **For Farmers** (`/farmer`) | Plain-language field status, water, weather, crop condition and important alerts; technical values sit behind "More details". |
| **Data Sources** (`/data-sources`) | Only the datasets the backend actually serves, each with a reliability badge, coverage and benefits for a small farmer, a farm owner and an agronomic engineer. |
| **Fale7** (`/rayyan`) | Gemini-grounded assistant with key management, capability status and a deterministic fallback. |
| **User guide** | Bilingual English/Arabic walkthrough for Egyptian users, with a language toggle and right-to-left layout. |

Every page includes **loading, empty, error and success states**; when an input or
provider is unavailable, the UI says so instead of showing a fabricated value.

### Appearance and language

The header carries two site-wide controls:

- **Theme** — light/dark. The choice is saved in `localStorage` under
  `agrinasa:theme`, defaults to the operating system preference on first visit,
  and applies to charts, maps and every page. Equations and the assistant's
  system-prompt excerpt stay on a permanent dark panel in both themes.
- **Language** — English/العربية. The choice is saved under
  `agrinasa:language`, switches `<html lang>` and `dir`, and localises the whole
  interface including analysis reasons and limitations. Numbers, units and
  scientific acronyms keep Latin digits in both languages. Arabic translations
  fall back to the English source string when an entry is missing rather than
  machine-translating scientific text.

---

## Data sources and provenance

| Source | Nature | Resolution | Used for |
| --- | --- | --- | --- |
| [NASA POWER](https://power.larc.nasa.gov/) daily point API (community AG) | Reanalysis / model-derived | ~0.5° × 0.625° grid, daily | T2M, T2M_MAX, T2M_MIN, RH2M, PRECTOTCORR, WS2M, ALLSKY_SFC_SW_DWN, PS, GWETROOT |
| NASA POWER climatology (1991–2020) | Reanalysis climatology | Monthly normals | Rainfall anomaly normal (live mode only) |
| [NASA GIBS](https://gibs.earthdata.nasa.gov/) WMTS | Satellite imagery | Variable | Visual map context only; no values are read from pixels |
| [OpenStreetMap Nominatim](https://nominatim.openstreetmap.org/) | Geocoding service | Address-level | Place-name lookup / reverse geocoding |
| FAO-56 calculations | Deterministic derivation | Same as input | ET₀, ETc, water balance, demand class, stress indicators |
| [Sentinel-1 GRD](https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S1_GRD) via Earth Engine | Satellite observation | 10 m C-band SAR | Relative surface-wetness proxy from VV/VH backscatter |
| [Sentinel-2 SR Harmonized](https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S2_SR_HARMONIZED) via Earth Engine | Satellite observation | 10–20 m, ~5-day revisit | NDVI, NDMI, NDWI canopy condition (Satellite tab and the crop-health NDVI card) |
| [Open-Meteo](https://open-meteo.com/) daily forecast | Numerical weather model | Point, 5 days | Next-days outlook on the simplified farmer guide (NASA POWER has no forecast product) |
| [Open-Meteo archive](https://open-meteo.com/en/docs/historical-weather-api) (ERA5 / ERA5-Land) | Reanalysis | ~9–25 km, daily/hourly | Historical temperature, rainfall, humidity, soil moisture, seasonal and year-to-year comparisons, drought screen |
| [Open-Meteo current conditions](https://open-meteo.com/) | Model analysis + forecast step | Point, hourly | Current weather tiles on Explore Map and Location Analysis |
| [ISRIC SoilGrids 2.0](https://soilgrids.org/) | Machine-learning model | 250 m | pH, organic carbon, clay/sand/silt, bulk density, CEC, nitrogen |
| [SMAP L4](https://developers.google.com/earth-engine/datasets/catalog/NASA_SMAP_SPL4SMGP_008) via Earth Engine | Assimilated satellite product | ~9–11 km, top ~5 cm | Surface soil moisture reference (not a depth probe) |
| [Dynamic World](https://developers.google.com/earth-engine/datasets/catalog/GOOGLE_DYNAMICWORLD_V1) via Earth Engine | Satellite classification | 10 m | Dominant land-cover class over the analysed area |
| [GPM IMERG](https://developers.google.com/earth-engine/datasets/catalog/NASA_GPM_L3_IMERG_MONTHLY_V07) via Earth Engine | Satellite precipitation estimate | ~0.1° monthly | Independent monthly rainfall cross-check |
| [FAO WaPOR](https://data.apps.fao.org/wapor) (optional) | Derived water productivity | 100–250 m | Optional actual ET layer; needs a free personal token |

The backend attaches a `DataSourceRef` (`id`, `name`, `nature`, `resolution`,
`attribution`, `url`) to every analysis response. `nature` distinguishes
`reanalysis`, `satellite_observation`, `assimilated`, `estimated`, `derived`,
`calculated` and `optional`, so a client cannot accidentally present a model
value as a measurement.

The **Data Sources** screen (`/data-sources`) is generated from the server's
`SOURCE_CATALOGUE`: it lists only datasets the backend can actually fetch, marks
each one measured / satellite-derived / modeled-estimated / forecast, and states
coverage plus what the dataset means for a small farmer, a farm owner and an
agronomic engineer. WaPOR appears only as "not enabled" because it needs a token.

**Important unit note:** POWER community AG already returns the units used
internally (°C, %, mm/day, m/s, MJ/m²/day, kPa, fraction). The processing layer
passes them through without silent scaling and documents the mapping in
`backend/app/services/processing.py`.

---

## Satellite analysis with Google Earth Engine

The **Satellite** tab adds an independent observation layer: Sentinel-1 radar for
relative surface wetness and Sentinel-2 optical indices for canopy condition. It
is optional and disabled by default; nothing is simulated when credentials are
missing.

### What it computes

| Output | Sensor | Method |
| --- | --- | --- |
| Relative surface wetness class (`dry` / `near normal` / `wet`) and a 0–1 score | Sentinel-1 GRD (VV + VH, IW mode) | Latest scene in the window, focal-median speckle filter (30 m circle), mean VV/VH over the geometry. Classes: VV < −17 dB dry, −17…−12 dB near normal, > −12 dB wet |
| NDVI, NDMI, NDWI | Sentinel-2 SR Harmonized | Latest scene below the cloud threshold, SCL-based cloud masking (classes 4–7 kept), mean indices over the geometry |
| Tile URLs for the map | Both | `getMapId()` XYZ tile templates for NDVI, NDMI and the relative wetness score |

Honesty rules enforced in code and UI:

- Sentinel-1 output is a **relative surface signal**, not volumetric soil
  moisture. Roughness, crop structure and incidence angle also change VV. The
  response and the page repeat this limitation.
- The optical classes describe canopy condition; they are not a disease
  diagnosis.
- If the latest Sentinel-2 scene has less than 15 % valid pixels, a median
  composite of the window is used and the response sets `composite: true`.
- A missing sensor, empty window or cloud-blocked window returns
  `available: false` with a reason. No value is invented.
- Tile URLs expire. The numeric values come from server-side `reduceRegion`
  calls, never from the rendered colours.
- Analyses are cached in-process for `GEE_CACHE_TTL_SECONDS` (default 30 min).
  The analysed area is capped at 5 000 ha and the window at 90 days.

### API

Both endpoints accept the same options and return `SatelliteAnalysis`:

- `POST /api/satellite/analyze-field` — explicit geometry:

```bash
curl -X POST http://127.0.0.1:8000/api/satellite/analyze-field \
  -H "Content-Type: application/json" \
  -d '{
    "geometry": {
      "type": "Polygon",
      "coordinates": [[[32.70,26.14],[32.74,26.14],[32.74,26.16],[32.70,26.16],[32.70,26.14]]]
    },
    "start": "2026-10-15",
    "end": "2026-11-14",
    "max_cloud_percent": 30
  }'
```

  A point plus buffer is also accepted instead of `geometry`:

```json
{"latitude": 26.15, "longitude": 32.72, "buffer_km": 0.5}
```

- `POST /api/satellite/fields/{field_id}` — uses the saved four-corner boundary
  when one exists, otherwise the field centre with `buffer_km`. Body (optional):

```json
{"start": "2026-10-15", "end": "2026-11-14", "max_cloud_percent": 30}
```

Request rules: exactly one spatial input, polygon rings closed with at least four
corners, `buffer_km` 0.1–25, dates default to the last 30 days, no future end
date, window ≤ 90 days.

### Crop-health NDVI card

`GET /api/fields/{field_id}/vegetation` feeds the **NDVI / NDMI** card on the
Crop-health page. It uses the same Earth Engine service as the satellite
endpoints — no separate Earthdata/AppEEARS provider — but only reads
Sentinel-2: it looks back 60 days at 30 % cloud cover, reduces NDVI/NDMI over
the saved boundary (or centre + 0.5 km), and returns the pass date, cloud cover,
scene count, condition classes, an NDVI display tile and the previous
acquisition for a two-scene trend. A single usable pass keeps `trend:
"unknown"` and the UI says a second pass is needed. In demo mode, or when Earth
Engine is not configured, the card reports `available: false` with a reason and
shows no value.

Response shape:

```json
{
  "field_id": 1,
  "area_ha": 78.54,
  "geometry_source": "polygon",
  "start": "2026-10-15",
  "end": "2026-11-14",
  "soil_moisture": {
    "available": true,
    "category": "near_normal",
    "relative_score": 0.47,
    "vv_db": -14.1,
    "vh_db": -20.3,
    "vh_minus_vv_db": -6.2,
    "acquisition_date": "2026-11-10",
    "scene_count": 6,
    "valid_pixels": 12540,
    "reason": null,
    "interpretation": "VV backscatter sits inside the mid band. …"
  },
  "vegetation": {
    "available": true,
    "ndvi": 0.58,
    "ndmi": 0.24,
    "ndwi": -0.12,
    "ndvi_condition": "dense",
    "ndmi_condition": "high",
    "acquisition_date": "2026-11-09",
    "scene_count": 4,
    "cloud_cover_percent": 12.5,
    "valid_fraction": 0.68,
    "composite": false,
    "reason": null,
    "interpretation": "NDVI 0.58 indicates a dense, active canopy. …"
  },
  "tiles": {
    "ndvi": {"url": "https://earthengine.googleapis.com/…/{z}/{x}/{y}", "kind": "palette", "min": 0, "max": 0.85, "palette": ["b71c1c", "…", "1b5e20"]},
    "ndmi": {"url": "…", "kind": "palette", "min": -0.2, "max": 0.6, "palette": ["…"]},
    "soil_moisture": {"url": "…", "kind": "palette", "min": 0, "max": 1, "palette": ["…"]},
    "true_color": {"url": "…", "kind": "rgb", "min": 0, "max": 3000, "palette": []}
  },
  "sources": [{"id": "sentinel1_sar", "name": "Sentinel-1 GRD (C-band SAR)", "nature": "satellite_observation"}],
  "limitations": ["…"],
  "generated_at": "2026-11-14T13:50:00Z"
}
```

### One-time Earth Engine setup

The browser never sees these credentials; all Earth Engine calls happen in the
backend.

1. **Register a Cloud project for Earth Engine.** Sign in at
   [code.earthengine.google.com](https://code.earthengine.google.com/), choose
   *Register a project*, and note the project id.
2. **Create a service account.** In the Google Cloud console for that project,
   open *IAM & Admin → Service accounts → Create service account*. It needs Earth
   Engine access; grant the role that matches your registration (for example
   *Earth Engine Resource Writer*). Also grant **Service Usage Consumer**
   (`roles/serviceusage.serviceUsageConsumer`) to the same service account —
   Earth Engine rejects initialisation with `403 PERMISSION_DENIED` otherwise.
3. **Create a JSON key** for the service account (*Keys → Add key → JSON*) and
   download it. Keep it out of git. Put it in `backend/secrets/gee-credentials.json`
   (the repository already ignores `backend/secrets/`).
4. **Configure `.env`** in `backend/` or the project root (never commit it):

```bash
GEE_SERVICE_ACCOUNT=agrinasa-satellite@your-project.iam.gserviceaccount.com
GEE_PROJECT=your-earth-engine-project-id
GEE_PRIVATE_KEY_FILE=secrets/gee-credentials.json
# Or, instead of a file, the full JSON on one line:
# GEE_PRIVATE_KEY_JSON={"type":"service_account",…}
```

The key path is resolved relative to the project root first, then `backend/`.

5. **Install and restart**:

```bash
cd backend
.venv/Scripts/pip install -r requirements.txt   # Windows
# source .venv/bin/activate && pip install -r requirements.txt   # macOS/Linux
.venv/Scripts/python -m uvicorn app.main:app --reload --port 8000
```

6. **Verify** with `GET /api/health` (`satellite_configured: true`) and
   `POST /api/analyze-field` (alias of `/api/satellite/analyze-field`) or the
   Satellite tab. When the configuration is missing or invalid, the API returns
   HTTP 503 with code `GEE_UNAVAILABLE` and a safe message; the page explains how
   to configure it.

   The first computation after a new IAM grant can answer with a stale
   `serviceusage.services.use` denial while Google propagates the role. The
   service retries that specific transient answer up to three times with
   backoff (2/4/6 s); longer propagation windows are reported honestly instead
   of hanging. Any other provider error is reported to the browser as
   `GEE_UNAVAILABLE` with `details: "GEE_PROVIDER_ERROR"` (or `GEE_TILES` when
   only the display layer failed). Configuration failures carry
   `GEE_NOT_CONFIGURED`, `GEE_NOT_INSTALLED` or `GEE_AUTH_FAILED`, which is how
   the page distinguishes "setup needed" from "try again later".

   The automated tests never call Earth Engine, so they run without credentials.

---

## Location intelligence: Explore Map, Location Analysis and Crop Intelligence

Three pages work on any coordinate or drawn polygon, independently of saved
fields:

| Page | What it does |
| --- | --- |
| `/explore` | Map-first entry point: search a place (Nominatim via the backend), use the browser location, click any point, or draw a field outline (max 24 corners). Current conditions, a 30-day water balance and alerts are previewed before you commit. |
| `/location` | Tabs: **Overview**, **Weather**, **Soil**, **Water**, **Vegetation**, **Historical data**. Works for a point or a whole field polygon; the selected location is stored in session storage so tab switches and the Crop page reuse it. |
| `/crop` | Multi-crop screening (up to 3): temperature suitability, soil, water, planting window, risks and recommendations, each item tied to its source. |

API (all through the backend, all cached on disk where sensible):

```text
GET  /api/location/crops
GET  /api/location/overview?lat=&lon=&crop_id=        POST /api/location/overview
GET  /api/location/soil?lat=&lon=                     POST /api/location/soil
GET  /api/location/history?lat=&lon=&years=           POST /api/location/history
GET  /api/location/vegetation?lat=&lon=&months=       POST /api/location/vegetation
GET  /api/location/crop?lat=&lon=&crop_id=            POST /api/location/crop
```

The `POST` variants take a GeoJSON polygon and analyse the whole area where the
source supports it (Sentinel-2, Dynamic World, SMAP, GPM). Weather is sampled at
the field centroid; soil uses the polygon when Earth Engine has data there and
otherwise widens to a buffer around the field centre, and the response says
exactly which aggregation was used.

Honesty rules repeated in the response payloads and in the UI:

- Every reading carries `source_id`, `period`/`observed_at`, `confidence` and a
  `note`; charts and cards show them.
- SoilGrids is a **model**, SMAP/Open-Meteo soil moisture is **not a depth
  probe**, satellite indices are **area means**, and crop suitability is a
  **screening score, not a yield forecast**.
- When a source fails or returns an empty pixel the response is
  `available: false` with a reason; nothing is filled in.
- The historical tab states the exact archive window returned by ERA5 and the
  latest published day; older values are never labelled as current.
- The drought indicator is a percentile of 90-day rainfall totals from the same
  dataset, not an official SPI or drought declaration.

### Configuration for the new sources

**No key required** (works out of the box, backend-proxied):

- Open-Meteo archive and current conditions — `OPEN_METEO_ARCHIVE_BASE_URL`,
  `OPEN_METEO_TIMEOUT_SECONDS`, `CLIMATE_BASELINE_START/END`.
- ISRIC SoilGrids REST — `SOILGRIDS_BASE_URL`, `SOILGRIDS_TIMEOUT_SECONDS`
  (cached 30 days). Earth Engine's SoilGrids assets are preferred when GEE is
  configured.
- OpenStreetMap Nominatim — `GEOCODING_BASE_URL`, `GEOCODING_USER_AGENT`.

**Google Earth Engine** (see the setup above) additionally provides the
SoilGrids assets, SMAP L4, Dynamic World land cover and GPM IMERG through the
same service account. When GEE is not configured the location pages still work;
the soil tab falls back to REST and vegetation says it is unavailable.

**FAO WaPOR (optional)** — register at
[data.apps.fao.org/wapor](https://data.apps.fao.org/wapor), create a personal
token, and set `WAPOR_TOKEN` in `.env`. Without it WaPOR is reported as not
configured and the app uses the Open-Meteo/NASA POWER balance instead. The token
is read by the backend only.

---

## Fale7 AI assistant (`/rayyan`) setup

Fale7 answers weather, soil, irrigation, crop and plant-health questions
using the same backend data. It runs entirely server-side; the browser never
receives an API key.

1. Open **Fale7 AI → API Settings** in the app and paste a Google Gemini key
   ([aistudio.google.com/apikey](https://aistudio.google.com/apikey)). The key is
   validated, then stored encrypted (`backend/secrets/rayyan_api_keys.key` is the
   generated local encryption keyfile — keep it out of git).
2. Alternatively bootstrap a fresh install from `.env` with
   `RAYAN_GEMINI_API_KEY` and optionally `RAYAN_GEMINI_MODEL`. Without any key,
   Fale7 falls back to the deterministic explainer and says so.
3. In a deployment, set `RAYAN_SETTINGS_TOKEN` to require that header on the
   key-management endpoints, and tune `RAYAN_MAX_REQUESTS_PER_HOUR` if needed.
4. Linking from a field or location page passes `?field=<id>`, so Fale7
   automatically loads that field's stored soil, climate and water context.

### Fale7 API for external applications

The **Fale7 API** section at the bottom of `/rayyan` issues one read-only API
credential per workspace and lets you regenerate or revoke it.

- The key is returned once, in the response that issues it and through a
  single-use QR link (`/rayyan/api/access/{token}`, 10 minutes). Only a SHA-256
  hash is used for lookup; a Fernet-encrypted copy exists solely to deliver the
  key through the QR page. The dashboard then shows the prefix only.
- Revoking or regenerating replaces the stored hash and deletes every pending
  access link, so the previous key stops working immediately.
- Key management uses the same access rule as Gemini settings: a client on the
  server itself, or the `X-Rayyan-Settings-Token` header when
  `RAYAN_SETTINGS_TOKEN` is configured. Set that variable before exposing the
  app publicly; without it the section reports that management is protected.
- `RAYAN_PUBLIC_API_REQUESTS_PER_HOUR` (default 60) sets the per-key hourly
  budget and `RAYAN_PUBLIC_API_ACCESS_MINUTES` (default 10) the QR-link lifetime.

Endpoint: `POST /api/rayyan/v1/ask` with
`Authorization: Bearer fl7_…` and
`{"question": "...", "field_id": 1, "crop": "wheat", "language": "en"}`.
It returns the grounded answer, recommendation, environmental data, sources,
warnings, limitations, confidence, validation result and usage counters. The
beginner-friendly request/response reference, error table and curl example are
in the collapsible **API documentation** panel inside the section.

---

## Field robot and on-farm sensors

The **Robot** tab of every field (`/robot/{fieldId}`) pairs a microcontroller
and displays its readings. Nothing is simulated server-side: values exist only
after the device posts them.

1. **Pair** — *Create pairing QR* (also on the Fale7 page) produces a one-time
   code valid for 15 minutes. Opening `/robot/pair/{code}` and pressing
   *Pair this robot* returns a device key (`ags_…`) exactly once.
2. **Post** — the robot sends one JSON reading at a time to
   `POST /api/ingest/readings` with `Authorization: Bearer <device key>`:

   ```json
   {"soil_moisture_pct": 28.5, "air_temp_c": 31.2, "humidity_pct": 54.0,
    "distance_cm": 62.0, "measured_at": "2026-11-18T09:30:00Z"}
   ```

   Any subset of the four values is accepted; `measured_at` defaults to server
   time and is rejected beyond 30 days old or 10 minutes in the future.
3. **Watch** — *Connect* polls `/fields/{id}/sensors` every 5 seconds; the page
   also loads Sentinel-2 NDVI/NDMI, Sentinel-1 relative wetness and the FAO-56
   water balance for the same field.

Honesty rules specific to this feature:

- The device key is stored only as a SHA-256 hash plus a short prefix. Revoking a
  device stops ingestion immediately (`401`).
- The live panel's *local test pattern* preview is labelled, generated in the
  browser and **never posted** to the backend.
- Sensor, satellite and model numbers are shown side by side as different
  instruments with different footprints. The page does not calibrate one from
  another, does not fuse them into a single "improved" value, and makes no
  accuracy claim.
- The soil probe reports a calibrated 0–100 % index of its own ADC range, not
  volumetric water content unless the sketch is calibrated against a real
  measurement.

Firmware, wiring table, calibration and troubleshooting:
[`hardware/README.md`](hardware/README.md).

---

## Simplified farmer guide

`/farmer-guide` in the navbar ("دليل المزارع المبسط") is a phone-first page for
small farmers. It uses no technical terms: no NDVI, NDMI or backscatter appears
on the page. The user picks a location (GPS, a map tap, or a governorate), a
crop, and one of two situations.

`POST /api/farmer-summary?mode=live` accepts:

```json
{"latitude": 26.1551, "longitude": 32.716, "crop_id": "wheat", "intent": "plant_now"}
```

Crops: `wheat`, `maize`, `tomato`, `potato`, `clover`, `sugarcane`, `cotton`,
`rice` (planting months in `backend/app/crops/calendar.py` are **regional Egypt
defaults**, not measurements). Intents are `plant_now` and `already_planted`.
Wheat, potato and tomato additionally have full FAO-56 water-balance and
stage-band profiles in `backend/app/crops/`; the other calendar crops receive
planting guidance only.

**Plant now** returns a verdict (`suitable` / `marginal` / `not_suitable` /
`unknown`), a 0–100 readiness score, the primary reason code and the component
scores (month, temperature, soil). Month scores: ideal 100, acceptable 70,
outside 20. Temperature: 100 inside the crop's optimum, −10 per °C outside.
Sentinel-1 wetness: near normal 100, dry 45, wet 30. Weights 45 / 35 / 20
(55 / 45 when the radar read is unavailable). A blocking component forces
`not_suitable` and caps the readiness, so the gauge never contradicts the
traffic-light colour. The response also carries today's POWER values and the
Open-Meteo 5-day outlook with advice codes (`irrigate_early_morning`,
`protect_from_frost`, `hold_irrigation_rain`, `avoid_spraying_wind`,
`good_growing_weather`).

**Already planted** returns a 0–100 plant health score from the latest Sentinel-2
pass: 80 % canopy score from NDVI (anchors 0.03 → 0, 0.88 → 100) and 20 % water
score from NDMI (−0.10 → 0, 0.40 → 100). Ratings: ≥80 excellent, ≥65 good,
≥50 fair, ≥35 weak, else poor. Sentinel-1 wetness becomes plain advice
(`irrigate_today`, `no_irrigation_today`, `check_soil_moisture`) next to the
weather and outlook.

The request may also carry `days_since_planting` (0–180, used with
`already_planted`) and an optional `geometry` polygon; a polygon switches the
Sentinel reduction from a point buffer to the drawn field. Both situations get a
`timeline` block:

| Stage | Chosen when | Content |
| --- | --- | --- |
| `pre_planting` | `intent = plant_now` | seedbed risks (`dry_seedbed`, `wet_seedbed`, `rain_crusting`, `heat_stress`, `frost`, `wind_damage`) and actions (`prepare_seedbed`, `pre_irrigate`, `wait_for_drain`, `sow_now`, `sow_at_depth`, `apply_basal_fertiliser`) |
| `early_growth` | planted ≤ max(21, emergence_max + 7) days | expected emergence window from the crop calendar, seedbed checks, `past_emergence_window` once it closes, weed/pest scouting |
| `established` | older, or planting date unknown | routine monitoring actions; canopy stress when health < 50 % |

Emergence windows and seed depths come from `crops/calendar.py` (regional Egypt
defaults and varietal ranges, not measurements): wheat 5–10 days / 3–5 cm,
maize 5–10 / 4–6, tomato 7–14 / 1–2, potato 14–21 / 8–12, clover 5–10 / 1–2,
sugarcane 15–30 / 10–15, cotton 5–12 / 2–4, rice 15–25 / 1–2. The response also
returns `tiles` so the page can draw the field:

- **Vegetation health (NDVI)** — vivid 7-stop ramp red → orange → yellow → green,
  stretched 0–0.85 so healthy canopies are saturated green and bare soil is red.
- **Soil moisture (Sentinel-1)** — brown → sand → teal → blue ramp over the 0–1
  relative wetness score.
- **True colour (RGB)** — Sentinel-2 B4/B3/B2 composite (`kind: "rgb"`, no
  legend).

`GET /api/farmer-demo-fields` returns four real Egyptian examples (Nile Delta
wheat field, Nubaria potato reclamation farm, newly prepared Sharqia wheat field
and a Luxor winter tomato field). The page turns them into one-tap buttons.
Descriptions state the intended contrast; live Sentinel values always win and are
shown unchanged.

### Calculation guardrail

Every numeric block passes through `science/validation.py` before it reaches the
browser (`satellite.analyze`, `vegetation_snapshot`, `farmer_summary`):

- Indices must lie in [-1, 1], percentages in 0–100, relative wetness in 0–1,
  VV/VH in physically plausible dB ranges, rain ≥ 0, humidity ≤ 100.
- Small overshoots inside a per-quantity tolerance are clamped and recorded;
  gross outliers reject the value and, when nothing usable remains, mark the
  block unavailable instead of showing a broken number.
- Derived values are recomputed after clamping (conditions from indices, soil
  score/percent from verified VV), inverted min/max forecasts are swapped, and an
  inconsistent mean is recomputed from the extremes.
- Each correction appends a code such as `ndvi:clamped` or
  `relative_percent:recomputed` to `corrections`. The farmer page shows a short
  note when any correction happened; the raw broken value is never sent.

Honesty rules for this page:

- The backend returns codes and numbers; the UI composes the simple bilingual
  sentences, so backend prose never leaks into the simplified view.
- Demo mode returns `available: false, is_demo: true` — a cached Qena snapshot
  cannot describe today's field.
- If Earth Engine is unconfigured or fails, the satellite blocks say so
  (`satellite_not_configured` / `satellite_unavailable`); no value is invented.
  If Open-Meteo is unreachable, no forecast is shown rather than climatology.
- Every percentage is a descriptive score, not a yield forecast, a disease
  diagnosis or a substitute for field inspection; the page repeats this.

---

## Scientific methods

All formulas live in `backend/app/science/` and are unit-tested.

### Reference evapotranspiration — FAO-56 Penman–Monteith

```
ET₀ = [0.408 Δ (Rn − G) + γ (900/(T + 273)) u₂ (es − ea)]
      / [Δ + γ (1 + 0.34 u₂)]                    (mm/day)
```

- `Δ` slope of the saturation vapour-pressure curve, `γ` psychrometric constant.
- `G = 0` for a daily time step (FAO-56 eq. 42).
- `ea` is derived from mean relative humidity (`ea = RH/100 × es`); this is a
  documented approximation, not a dew-point measurement.
- Pressure comes from POWER `PS`; if missing, it is estimated from elevation with
  the standard atmosphere (FAO-56 eq. 7).
- A day with a missing required input returns `None` with the missing item named.
  Values are **never** interpolated, forward-filled or zeroed.
- Physically invalid pairs (Tmax < Tmin, RH outside 0–100 %) are excluded.
- Negative results on rare cold/cloudy days are clamped to zero and noted.

### Crop coefficient — registered crops

Each crop in `backend/app/crops/` carries its own FAO-56 Table 12 curve, stage
lengths, rooting depth and depletion fraction. `ETc = Kc × ET₀`; Kc is linearly
interpolated across the development and late-season stages.

**Wheat** — 150-day season, roots 0.15 → 1.50 m, `p = 0.55`:

| Stage | Days | Kc |
| --- | --- | --- |
| Initial (emergence–tillering) | 20 | 0.40 constant |
| Development (stem elongation) | 30 | 0.40 → 1.15 linear |
| Mid-season (heading–grain fill) | 60 | 1.15 constant |
| Late season (ripening) | 40 | 1.15 → 0.30 linear |

**Potato** — 120-day season, roots 0.15 → 0.50 m, `p = 0.35`:

| Stage | Days | Kc |
| --- | --- | --- |
| Initial (planting–emergence) | 25 | 0.50 constant |
| Development (leaf growth) | 30 | 0.50 → 1.15 linear |
| Mid-season (tuber bulking) | 45 | 1.15 constant |
| Late season (maturation) | 20 | 1.15 → 0.75 linear |

**Tomato** — 140-day season, roots 0.15 → 1.00 m, `p = 0.40`:

| Stage | Days | Kc |
| --- | --- | --- |
| Initial (transplant establishment) | 30 | 0.60 constant |
| Development (flowering) | 40 | 0.60 → 1.15 linear |
| Mid-season (fruit set) | 40 | 1.15 constant |
| Late season (ripening) | 30 | 1.15 → 0.80 linear |

These are FAO-56 defaults, not measurements of a specific cultivar or sowing
date. The shallow potato root zone is why its depletion threshold (`p = 0.35`)
triggers irrigation earlier than wheat.

### Root-zone water balance (bucket model)

```
D_t = D_(t−1) − (P − RO) − I + ETc + DP
TAW = 1000 (θFC − θWP) Zr
RAW = p × TAW
```

- One homogeneous soil layer; no capillary rise or lateral flow.
- Runoff `RO = 0.10 × P` (fixed coefficient because slope/cover are unavailable).
- Initial depletion is **50 % of TAW** at planting (documented default).
- `I = 0`: irrigation events are not recorded in this version. The output is the
  **refill requirement**, not a claim about water that was applied.
- Soil water capacity uses class averages (Saxton & Rawls) for seven USDA
  textures; unknown textures fall back to loam and this is reported.
- Days with missing ET₀ are simulated without crop water use and counted in
  `excluded_et0_days`; confidence is downgraded when coverage is poor.

### Irrigation demand classes

| Class | Condition |
| --- | --- |
| **HIGH** | depletion ≥ 80 % of TAW, **or** ≥ 65 % with < 2 mm rain in 7 days and ETc ≥ 4.5 mm/day |
| **MODERATE** | depletion ≥ the crop's FAO-56 depletion fraction `p` (potato 35 %, tomato 40 %, wheat 55 %) |
| **LOW** | below that crop's `p` |
| **UNKNOWN** | depletion could not be computed |

The MODERATE boundary is the point where readily available water (RAW = p × TAW)
is exhausted, so it moves with the crop: a shallow-rooted potato crop is flagged
earlier than wheat. The accelerated HIGH rule catches a deficit that will cross
80 % within days.
Net refill = depletion (mm). Gross refill = net ÷ application efficiency
(drip 0.90, sprinkler 0.75, surface 0.60). With no irrigation system, only net is
reported.

**Confidence** is a qualitative label assembled from documented factors (ET₀ and
precipitation coverage, whether soil was supplied, simulation length, whether a
vegetation index exists). With NASA POWER alone the maximum is **MEDIUM**, because
a ~50 km grid cannot resolve field-scale soil water. No invented percentage is
shown.

### Crop-health indicators

| Indicator | Threshold | Status logic |
| --- | --- | --- |
| Heat | Tmax ≥ crop threshold in last 14 days (wheat 30 °C, potato 30 °C, tomato 35 °C) | 0 days good · 1–2 watch · ≥ 3 stress |
| Frost | Tmin ≤ crop threshold in last 14 days (wheat 0 °C, potato 0 °C, tomato 2 °C) | 0 good · 1–2 watch · ≥ 3 stress |
| Water | final depletion fraction | below crop `p` good · `p`–0.80 watch · ≥ 0.80 stress |
| Rainfall anomaly | last 30 days vs climatological normal | −30 % watch · −50 % stress · +100 % watch |
| NDVI | Sentinel-2 via Earth Engine | classified against the crop's stage band (see below) |

NDVI is not read against one global scale. Each registered crop carries an
expected band per growth stage in `backend/app/crops/`; 0.35 is a full canopy for
young wheat but sparse for a bulking potato crop. Until a satellite pass is
available the condition is reported `unknown`, never guessed.

The overall status needs **at least two computable indicators**; otherwise it
returns `insufficient_data`. Any `stress` indicator marks the field `stressed`,
because stress is actionable and should not be averaged away. NDVI is reported as
condition only — it is **not** a disease, pest or nutrient diagnosis. In demo mode
there is no climatology, so the rainfall anomaly is honestly reported `unknown`.

The health response also includes an **indicator agreement** percentage: the share
of computable indicators that are not at stress level. It is a descriptive count,
not a probability of crop health and not a yield estimate, and it is omitted when
no indicator is computable.

### Season and data-lag handling

- POWER publishes with a lag. Analyses request *today − 1* and then end on the
  latest day with a complete ET₀; the dropped days are named in `limitations`.
- Season length comes from the crop's own stage table (wheat 150 days, potato
  120 days, tomato 140 days). After harvest, irrigation and health return
  `season_complete: true` with `insufficient_data` and no demand class or
  indicators, instead of describing post-harvest weather as crop stress.

---

## AI assistant design

```
question → recompute the same analyses as the dashboard
         → structured, auditable context JSON
         → optional LLM (if AI_API_KEY is set and the rate limit allows)
         → deterministic rule-based explainer (always available)
         → persist messages + exact context
```

- **Deterministic code owns every number.** The model receives values already
  computed by `app/science`; it cannot create or change measurements, irrigation
  amounts, confidence labels or diagnoses.
- The system prompt forbids inventing data, diagnosing disease and claiming ML
  accuracy; the same rules are encoded in the rule-based fallback.
- **No key configured → the assistant still works** using fixed templates that
  format the same context. This is shown in the UI and in `notice`.
- **Rate limiting** is per client IP with a sliding window
  (`AI_MAX_REQUESTS_PER_HOUR`, default 30). When exceeded, the rule-based
  explainer answers instead of failing.
- **Provider failure** also falls back; the user sees why.
- The full context is returned as `context_used` and stored with the answer, so
  **"View data sent to the assistant"** still works after reopening a
  conversation.
- Demo-mode answers carry an explicit notice that they describe the cached Qena
  snapshot, not live data and not necessarily the user's field.

`AI_API_KEY` is read by the backend only. The frontend never imports it, and all
provider calls happen server-side.

---

## Demo mode

`DATA_MODE=demo` (or `?mode=demo` per request) replays a **real NASA POWER
response** cached in `backend/app/demo/qena_power_snapshot.json`:

- Location: Qena, Egypt — 26.15 °N, 32.72 °E
- Period: 2025-11-01 → 2026-03-10 (real values fetched once and stored)
- Planting date used for crop stage: 2025-11-15

Demo analyses deliberately use the snapshot's coordinates and planting date, so
they are **not** presented as the user's field. Responses set `is_demo: true`, the
UI shows a persistent **DEMO DATA** banner, and the analysis date is reported as
the snapshot end (2026-03-10), never as today. The rain-anomaly indicator reports
`unknown` because the snapshot has no climatology.

Toggle demo mode in the header. With `DATA_MODE=live`, NASA POWER is called
through a 6-hour TTL cache; when the network is unavailable the API returns a
friendly `NASA_UNAVAILABLE` error and the UI shows an error state, not fake data.

---

## Configuration

Copy `.env.example` to `.env`. All settings are optional; the defaults run
offline in demo mode.

| Variable | Default | Purpose |
| --- | --- | --- |
| `ENVIRONMENT` | `development` | `development`, `test` or `production` |
| `DATA_MODE` | `live` | `live` calls POWER; `demo` replays the snapshot |
| `DATABASE_URL` | `backend/data/agrinasa.db` | SQLAlchemy URL (SQLite works out of the box) |
| `CORS_ORIGINS` | Vite dev origins | Comma-separated allowed browser origins |
| `NASA_POWER_BASE_URL` | `https://power.larc.nasa.gov/api/temporal` | POWER API root (no key) |
| `NASA_TIMEOUT_SECONDS` | `30` | HTTP timeout |
| `NASA_CACHE_TTL_SECONDS` | `21600` | In-process cache lifetime (6 h) |
| `NASA_MAX_SERIES_DAYS` | `366` | Longer requests are clamped |
| `FORECAST_BASE_URL` | `https://api.open-meteo.com/v1` | Keyless daily forecast root |
| `FORECAST_TIMEOUT_SECONDS` | `10` | Forecast HTTP timeout |
| `GEOCODING_BASE_URL` | Nominatim | Forward/reverse geocoding proxy |
| `GEOCODING_USER_AGENT` | `AgriNASA/1.0 …` | Identify your client to OSM |
| `AI_BASE_URL` | `https://api.openai.com/v1` | Any OpenAI-compatible endpoint |
| `AI_API_KEY` | empty | **Leave empty for rule-based answers** |
| `AI_MODEL` | `gpt-4o-mini` | Model name |
| `AI_TIMEOUT_SECONDS` | `45` | Provider timeout |
| `AI_MAX_REQUESTS_PER_HOUR` | `30` | Per-IP sliding-window limit |
| `DEMO_SNAPSHOT_PATH` | bundled snapshot | Override the demo file |
| `VITE_API_BASE_URL` | `/api` | Frontend API base (normally unset) |

**Never put a real key in `.env.example`, source code or git.** Use a local
`.env` (already git-ignored) and rotate any key that was ever committed.

---

## API reference

Base path: `/api`. All errors use one envelope:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": "..." } }
```

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | Service, database, data-mode and integration status |
| `GET` | `/data-sources` | Provenance catalogue and honesty notes |
| `GET` | `/demo` | Demo snapshot descriptor |
| `GET` | `/fields` | List fields |
| `POST` | `/fields` | Create a field (`201`) |
| `GET` | `/fields/{id}` | Field profile |
| `PATCH` | `/fields/{id}` | Update profile fields |
| `DELETE` | `/fields/{id}` | Delete field (`204`) |
| `GET` | `/fields/{id}/environment` | Daily series + ET₀ + summary (`start`, `end`, `mode`) |
| `GET` | `/fields/{id}/irrigation` | Demand class, refill, balance, confidence (`end`, `mode`) |
| `GET` | `/fields/{id}/health` | Environmental stress indicators (`end`, `mode`) |
| `GET` | `/fields/{id}/vegetation` | NDVI availability/series (`mode`) |
| `GET` | `/fields/{id}/sensors` | Paired devices, latest reading and the last 60 readings |
| `POST` | `/devices/pairing-codes` | Create a one-time pairing code (`field_id`) |
| `GET` | `/devices/pairing-codes/{code}` | Check a code without claiming it |
| `POST` | `/devices/claim` | Burn a code and return the device key once (`201`) |
| `POST` | `/devices` | Create a device key directly (`field_id`, `label`, `201`) |
| `GET` | `/devices` | List paired devices (`field_id`) |
| `DELETE` | `/devices/{id}` | Revoke a device (`204`) |
| `POST` | `/ingest/readings` | Robot ingest with `Authorization: Bearer <device key>` (`201`) |
| `POST` | `/farmer-summary` | Simplified check: verdict, health %, soil and weather advice, timeline and map tiles (`mode`) |
| `GET` | `/farmer-demo-fields` | Four real example fields (wheat, potato, tomato) with validated polygons for one-tap checks |
| `GET` | `/demo-trials` | Descriptions of the four one-tap trials (one per demo crop plus a prepared field) used by every field tool |
| `POST` | `/demo-trials/{key}` | Idempotently creates or refreshes the labelled `Demo trial · …` field |
| `POST` | `/assistant/chat` | Grounded answer (`field_id`, `message`, `conversation_id`, `mode`) |
| `GET` | `/assistant/conversations/{field_id}` | Stored messages with `context_used` |
| `GET` | `/geocode/search` | Forward geocoding proxy |
| `GET` | `/geocode/reverse` | Reverse geocoding proxy |

Interactive OpenAPI documentation is served at `/docs`.

---

## Database

SQLAlchemy 2 + SQLite by default, created automatically at startup.

| Table | Contents |
| --- | --- |
| `users` | Single local operator (no authentication in this version) |
| `fields` | Crop profile, coordinates, soil, irrigation system |
| `field_locations` | Append-only location history |
| `environmental_data` | Normalised daily values used by analyses |
| `vegetation_data` | Cached NDVI observations |
| `irrigation_analyses` | Saved irrigation snapshots |
| `crop_health_analyses` | Saved health snapshots |
| `ai_conversations` / `ai_messages` | Chat history and exact context JSON |
| `pairing_codes` | One-time pairing codes (SHA-256 hash, 15-minute expiry, single use) |
| `robot_devices` | Paired devices: label, key prefix and hash, revocation, last seen |
| `sensor_readings` | Robot measurements: soil %, air °C, humidity %, distance cm |
| `data_sources` | Seeded provenance catalogue |

SQLite is configured with WAL mode, `busy_timeout=30000` and `synchronous=NORMAL`
so the dashboard can request environment, irrigation and health concurrently
without "database is locked" failures. Crop constants and science parameters are
**not** stored in the database — `app/crops` and `app/science` are the single
source of truth.

---

## Tests

```bash
cd backend
.venv/Scripts/python.exe -m pytest tests -q
```

The suite (286 tests) runs fully offline in demo mode and covers:

- **Science** — ET₀ validity, missing inputs, invalid pairs, negative clamp,
  pressure fallback; Kc stage boundaries/interpolation; root depth; water balance
  (initial depletion, runoff/drainage, ET depletion, missing ET₀, stress days);
  NDVI formula/trend; every stress threshold; demand classes; refill efficiency;
  confidence caps; processing helpers.
- **Crops** — all three registered profiles (wheat, potato, tomato): stage
  lengths, Kc curve, rooting depth, depletion fraction, and per-stage NDVI/NDMI
  bands; stage-aware conditions keep the same NDVI reading sparse for a young
  canopy and dense for an established one.
- **API** — health, provenance, demo descriptor, field CRUD, validation and 404
  envelopes, stored boundary polygons and rejection of malformed geometry,
  environment window clamping, irrigation and health determinism, honest NDVI
  unavailability, four demo trials including potato and tomato fields, assistant
  fallback, stored context, rate/validation errors.
- **AI explainer** — answers reuse computed values, refuse disease diagnosis,
  report only real data gaps, and cite FAO-56 rather than inventing methods.
- **Field robot** — single-use and expiring pairing codes, hashed device keys,
  bearer-only ingest, value-range validation, revoke blocks ingestion, latest
  reading and 60-point series, cascade delete with the field.

Frontend checks:

```bash
cd frontend
npm run typecheck
npm run build
```

---

## Project structure

```
AgriNASA/
├─ ARCHITECTURE.md              # deeper design rationale
├─ README.md                    # this file
├─ GUIDE.txt                    # plain-text student walkthrough
├─ .env.example                 # configuration template (no real keys)
├─ backend/
│  ├─ main.py                   # uvicorn entrypoint
│  ├─ requirements.txt
│  ├─ app/
│  │  ├─ main.py                # FastAPI app, CORS, error envelope
│  │  ├─ config.py              # env-based settings
│  │  ├─ api/routers/           # meta, fields, assistant, geocode
│  │  ├─ services/              # NASA fetch, processing, analyses, demo
│  │  ├─ science/               # ET₀, Kc, balance, irrigation, stress, NDVI
│  │  ├─ crops/                 # crop registry + wheat, potato, tomato profiles
│  │  ├─ ai/                    # context, prompts, provider, explainer, limiter
│  │  ├─ db/                    # models, repository, engine, seed
│  │  ├─ schemas/               # Pydantic request/response contracts
│  │  └─ demo/                  # cached real POWER snapshot
│  └─ tests/                    # pytest suite
└─ frontend/
   ├─ src/pages/                # Home, fields, guide, dashboard, analytics,
   │                            # irrigation, crop health, satellite, farmer guide,
   │                            # assistant
   ├─ src/components/           # layout, cards, charts, map, chat, provenance
   ├─ src/api/                  # typed client and response types
   └─ vite.config.ts            # dev proxy /api → backend
```

---

## Limitations and honesty rules

These are deliberate constraints, not bugs:

1. **POWER is not a field sensor.** Most variables are MERRA-2 reanalysis on a
   coarse grid. Local microclimate, soil and management can differ substantially.
2. **The water balance is a model.** It assumes one soil layer, fixed runoff,
   50 % initial depletion and no recorded irrigation. It is a planning estimate.
3. **Soil properties are class averages.** Supplying a texture improves the
   analysis but is still not a laboratory measurement of your field.
4. **No disease/pest/nutrient diagnosis.** The health module reports environmental
   stress only. Suspected disease must be confirmed by an agronomist or lab.
5. **No yield prediction and no ML accuracy claim.** The platform does not train
   or claim a validated yield model.
6. **No fabricated geography.** A boundary is stored only when the user draws it
   or supplies valid GeoJSON; the server rejects unclosed rings, holes, invalid
   coordinates and zero-area shapes. A field without an outline shows a point
   marker, not an invented polygon. A drawn outline does not change how weather
   is sampled: NASA POWER remains a grid-cell value.
7. **Missing data stays missing.** No variable is interpolated, forward-filled or
   zeroed to make a chart look complete. Indicators become `unknown`, and the
   overall health status becomes `insufficient_data` when fewer than two
   indicators can be computed.
8. **Simplified percentages are scores.** The farmer guide's readiness and health
   percentages are descriptive scores from the same coarse weather and satellite
   inputs. They are not yield forecasts, probabilities of success or diagnoses,
   and the planting calendar reflects regional Egypt defaults rather than a
   specific farm's history.
9. **Demo data is labelled.** Cached real POWER values are replayed with
   `is_demo: true`, a banner and the actual snapshot dates.
10. **No raw stack traces.** Users see a friendly error envelope; tracebacks go to
   the backend log.
11. **No authentication.** This build is a single-user local educational app.

---

## Security notes

- All AI and Earth Engine calls happen in the **backend**. The frontend bundle
  contains no service-account keys.
- `.env` is git-ignored; `.env.example` contains placeholders only.
- CORS is restricted to configured local origins and credentials are disabled.
- The AI endpoint is rate-limited per IP, request inputs are length- and
  type-validated, and the provider receives only the computed context.
- Geocoding is proxied so the browser does not send a custom user agent or hit
  third-party services directly.
- SQL is parameterised through SQLAlchemy; user-supplied dates and ids are
  validated by Pydantic and domain checks.
- Database errors return generic messages; detailed tracebacks stay server-side.

---

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `database is locked` | Use one backend process. WAL and `busy_timeout` are already enabled; restart the server after changing settings. |
| `NASA_UNAVAILABLE` in live mode | No internet, POWER outage, or a proxy blocking the request. Switch `DATA_MODE=demo`. |
| Frontend shows connection errors | Ensure the backend runs on `127.0.0.1:8000`; Vite proxies `/api` there. |
| `node: command not found` | Install Node.js 18+ and reopen the terminal, or prepend its installation directory to `PATH`. |
| Empty vegetation panel | Earth Engine is unconfigured, in demo mode, or no usable pass was found; the API reports `available: false` with a reason. |
| AI replies are templated | `AI_API_KEY` is empty or the provider failed/is rate-limited; the response `provider` and `notice` explain which. |
| Demo dates look historical | Demo replays a fixed snapshot (2025-11-01 → 2026-03-10). This is intentional and labelled. |
| CORS error in the browser | Add your frontend origin to `CORS_ORIGINS`. |

---

## Attribution

- **NASA POWER** (MERRA-2 reanalysis, community AG) — <https://power.larc.nasa.gov/>
- **NASA GIBS** imagery — <https://gibs.earthdata.nasa.gov/>
- **FAO Irrigation and Drainage Paper 56** (Allen et al., 1998) — ET₀, Kc, water balance
- **Saxton & Rawls** soil water characteristics (class averages)
- **OpenStreetMap Nominatim** geocoding — <https://nominatim.openstreetmap.org/>
- Built as an educational decision-support project. Crop coefficients and
  thresholds are documented heuristics, not a validated prescription for any
  specific field.
