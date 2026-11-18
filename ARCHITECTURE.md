# AgriNASA — System Architecture

**NASA-Powered Smart Agriculture Decision Support Platform for Wheat**

This document describes *how* the platform is structured and *why*. It is the first
deliverable (Phase 1) and the reference for every later phase. If a later code decision
conflicts with this file, update the file as well.

---

## 1. Design principles

1. **Deterministic science, generative explanation.**
   Every number a farmer acts on (ET₀, ETc, soil-water depletion, demand class) is computed
   by tested Python code. The language model only explains numbers that were passed to it.
   The AI can never change a recommendation.
2. **No fabricated data.** If an input is missing we return `INSUFFICIENT_DATA` and say which
   input is missing. Demo mode is explicitly labelled on every surface.
3. **Freshman-readable.** Small modules, type hints, and comments that explain *purpose,
   inputs, outputs, units and assumptions*.
4. **Provider-agnostic edges.** NASA, geocoding and LLM access sit behind thin service
   interfaces, so a provider can be swapped without touching science or UI.
5. **Scientific transparency.** Every chart/value states its source, unit, date range and
   resolution (e.g. "NASA POWER / MERRA-2, 0.5° × 0.625°, model-derived").
6. **Single source of truth.** Crop constants live in the crop registry (code); the database
   stores *user* data and *snapshots of results*, never a second copy of constants.

---

## 2. System context

```text
                         ┌────────────────────────────────────────────┐
                         │  Browser — React 18 + TypeScript + Vite    │
                         │  Tailwind design system · Recharts          │
                         │  Leaflet + OpenStreetMap + NASA GIBS        │
                         └───────────────┬────────────────────────────┘
                                         │ REST/JSON  (no secrets in browser)
                         ┌───────────────▼────────────────────────────┐
                         │  FastAPI backend (Python 3.11+)             │
                         │                                            │
                         │  routers/        HTTP contract              │
                         │  services/       orchestration + caching    │
                         │  science/        pure functions, tested     │
                         │  crops/          wheat growth model         │
                         │  ai/             prompt + provider          │
                         │  db/             SQLAlchemy + SQLite        │
                         └───┬───────────┬───────────┬────────────────┘
                             │           │           │
              ┌──────────────▼──┐   ┌────▼─────┐   ┌─▼──────────────┐
              │ NASA POWER API  │   │ Nominatim│   │ LLM API        │
              │ (keyless, real) │   │ (geocode)│   │ (optional key) │
              └─────────────────┘   └──────────┘   └────────────────┘
                             │
              ┌──────────────▼──────────────────────────────────────┐
              │ Google Earth Engine (optional service account)      │
              │ Sentinel-1 GRD · Sentinel-2 SR harmonized           │
              │ tiles returned as getMapId() URLs, fetched by map   │
              └─────────────────────────────────────────────────────┘
```

The backend is the only component that talks to external services. This keeps API keys out
of the bundle and lets us validate, cache and normalise every third-party response.

---

## 3. Folder structure

```text
AgriNASA/
├── ARCHITECTURE.md              ← this file (Phase 1)
├── README.md                    ← concise project README
├── GUIDE.txt                    ← student navigation manual
├── .env.example                 ← every environment variable, no secrets
│
├── backend/
│   ├── requirements.txt
│   ├── pytest.ini
│   ├── app/
│   │   ├── main.py              ← FastAPI app factory, CORS, routers, error handlers
│   │   ├── config.py            ← env-driven settings (pydantic-settings)
│   │   ├── api/
│   │   │   ├── deps.py          ← shared dependencies (field lookup, settings)
│   │   │   └── routers/
│   │   │       ├── fields.py        fields CRUD + geocode
│   │   │       ├── environment.py   environmental series + summary
│   │   │       ├── vegetation.py    NDVI card (GEE Sentinel-2 via satellite service)
│   │   │       ├── irrigation.py    irrigation analysis
│   │   │       ├── health.py        crop-health analysis
│   │   │       ├── satellite.py     Sentinel-1/2 analysis via Earth Engine
│   │   │       ├── farmer.py       simplified farmer check (both intentions)
│   │   │       ├── assistant.py     AI chat
│   │   │       └── meta.py          data sources, health check, demo info
│   │   ├── schemas/             ← Pydantic request/response models (the API contract)
│   │   ├── services/
│   │   │   ├── nasa_power.py    ← HTTP client, validation, caching, demo switch
│   │   │   ├── forecast.py      ← Open-Meteo daily forecast client (keyless)
│   │   │   ├── processing.py    ← cleaning, units, aggregation, anomalies, trends
│   │   │   ├── environment.py   ← cards + analytics series
│   │   │   ├── irrigation.py    ← orchestrates science, builds facts
│   │   │   ├── crop_health.py   ← stress indicators → status
│   │   │   ├── vegetation.py    ← NDVI/NDMI card response from the GEE snapshot
│   │   │   ├── earth_engine.py  ← lazy ee init, service-account credentials
│   │   │   ├── satellite.py     ← S1/S2 collection queries, statistics, map tiles
│   │   │   ├── farmer_summary.py ← simple verdicts, health %, soil + weather advice
│   │   │   ├── geocoding.py     ← Nominatim proxy (search + reverse)
│   │   │   └── demo.py          ← deterministic NASA-POWER snapshot replay
│   │   ├── science/
│   │   │   ├── et0.py               FAO-56 Penman–Monteith
│   │   │   ├── crop_coefficient.py  stage-based Kc curve
│   │   │   ├── water_balance.py     daily root-zone bucket
│   │   │   ├── irrigation.py        demand classification + confidence
│   │   │   ├── stress.py            heat / water / rainfall indicators
│   │   │   ├── sar_moisture.py      VV backscatter → relative wetness classes
│   │   │   ├── vegetation_indices.py NDVI & friends
│   │   │   └── validation.py        range checks for science inputs
│   │   ├── crops/
│   │   │   ├── base.py          ← CropProfile dataclass + registry
│   │   │   ├── calendar.py      ← simple planting calendar for eight crops
│   │   │   └── wheat.py         ← wheat Kc stages, rooting depth, thresholds
│   │   ├── ai/
│   │   │   ├── prompts.py       ← strict system prompt
│   │   │   ├── context.py       ← structured field context builder
│   │   │   └── provider.py      ← OpenAI-compatible client + rule fallback
│   │   ├── db/
│   │   │   ├── database.py      ← engine, session factory, init
│   │   │   ├── models.py        ← SQLAlchemy tables
│   │   │   └── repository.py    ← focused DB helpers
│   │   └── demo/
│   │       └── qena_power_snapshot.json  ← real cached NASA POWER response
│   └── tests/
│       ├── fixtures/            ← POWER response fixtures
│       ├── test_et0.py · test_crop_coefficient.py · test_water_balance.py
│       ├── test_vegetation.py · test_processing.py
│       ├── test_satellite.py    ← SAR classes, spatial validation, 503 paths
│       └── test_api.py
│
└── frontend/
    ├── package.json · vite.config.ts · tsconfig.json
    ├── tailwind.config.ts · postcss.config.js · index.html
    └── src/
        ├── main.tsx · App.tsx · index.css
        ├── api/            client.ts, types.ts, queries.ts
        ├── components/     layout/, ui/, data/, map/, assistant/
        │                   data/SatelliteMap.tsx (GEE + OSM tile overlays)
        ├── pages/          Home, FieldList, FieldSetup, Dashboard, Analytics,
        │                   Irrigation, CropHealth, Satellite, FarmerGuide,
        │                   Assistant, Guide, NotFound
        ├── hooks/          useAsync, useField, useSelectedField
        └── lib/            format.ts, palette.ts, thresholds.ts
```

---

## 4. Data flow

### 4.1 Request path (example: irrigation page)

```text
User opens /irrigation/{fieldId}
  → React calls GET /api/fields/{id}/irrigation?end=2026-04-20
  → router loads the field from SQLite
  → irrigation service asks NASA POWER service for daily data
        (cache hit? → cached JSON; else HTTP → validate → normalise → cache)
  → processing layer cleans & aligns the daily series
  → science: ET0 → Kc(stage) → ETc → water balance → demand + confidence
  → service returns schema-validated IrrigationAnalysis JSON
  → React renders IrrigationCard + drivers + "View calculation" table
```

### 4.2 AI path

```text
User question
  → POST /api/assistant/chat { field_id, message, conversation_id? }
  → backend recomputes the same structured metrics (never trusts the client)
  → ai/context.py builds a compact JSON context: field, data coverage, latest values,
    ET0/ETc/balance, demand + confidence reasons, health indicators, limitations
  → ai/provider.py sends system prompt + context + question (or rule fallback)
  → answer + `context_used` (the exact JSON) + `provider` are returned and stored
```

The UI shows "data used for this answer" so the explanation is auditable.

---

## 5. NASA data

| Need | Source | Nature | Resolution |
|---|---|---|---|
| Temperature, humidity, wind, pressure, precipitation, solar radiation | **NASA POWER** daily point API, community `AG` | MERRA-2 reanalysis / satellite-assimilated, **model-derived** | ~0.5° × 0.625°, daily |
| Root-zone soil wetness (`GWETROOT`) | NASA POWER (MERRA-2 Land) | model-derived wetness fraction (0–1), not a probe | ~0.5° × 0.625°, daily |
| 30-year rainfall normals | NASA POWER `climatology` endpoint | model-derived normal | monthly |
| Satellite imagery basemap | **NASA GIBS** WMTS tiles | real satellite imagery | tile-dependent |
| Sentinel-1 C-band SAR (VV/VH) | **Google Earth Engine** `COPERNICUS/S1_GRD` | real radar observation → relative surface wetness proxy | 10 m, ~6–12 day revisit |
| Sentinel-2 surface reflectance | **Google Earth Engine** `COPERNICUS/S2_SR_HARMONIZED` | real optical observation, cloud-masked | 10 m, ~5 day revisit |
| NDVI / NDMI / NDWI | derived inside Earth Engine from Sentinel-2 | deterministic index calculation | 10 m |

**Disclaimers baked into the UI** (`DataSourceBadge`): POWER values are reanalysis/model
products, not on-farm sensors. A 0.5° cell can span tens of kilometres and a wheat field is
a fraction of a pixel; therefore soil moisture and rainfall are **context, not measurement**.
The platform never projects them as field-level truth.

NASA POWER requires **no API key**. The LLM and the optional NDVI provider do; they are
configured only in `.env` and only used server-side.

### 5.1 Satellite analysis (optional)

Earth Engine is an opt-in integration: the app runs fully without it, and the Satellite tab
then shows an honest "not configured on this server" panel (HTTP 503, `GEE_UNAVAILABLE`).

- **Credentials:** a GCP service account (`roles/earthengine.viewer` plus Earth Engine
  access), passed as `GEE_SERVICE_ACCOUNT` + `GEE_PROJECT` + `GEE_PRIVATE_KEY_FILE` (or
  `GEE_PRIVATE_KEY_JSON`). The key file lives outside version control
  (`backend/secrets/`, ignored). Nothing reaches the browser.
- **Soil moisture:** latest Sentinel-1 IW scene with VV+VH in the date window, 30 m focal
  median speckle filter, polygon mean of VV. The dB value is mapped to a documented
  relative wetness category (Dry / Near normal / Wet) and a 0–1 score. It is a **surface
  backscatter proxy**, not volumetric soil moisture and not a calibrated retrieval.
- **Crop health:** latest Sentinel-2 scene under the cloud-percentage limit, SCL classes
  4–7 kept, NDVI = (B8−B4)/(B8+B4), NDMI = (B8−B11)/(B8+B11), NDWI = (B3−B8)/(B3+B8).
  When no single scene clears the 15 % valid-pixel floor, a median composite of the window
  is used and flagged in the response.
- **Map layers:** `getMapId()` tile URLs for VV wetness score, NDVI and NDMI are returned
  with a fixed vis palette; Leaflet overlays them on OpenStreetMap. Tile URLs are short-lived
  and regenerated per response; the backend caches analyses briefly (`GEE_CACHE_TTL_SECONDS`).
- **Failure handling:** every provider failure is a 503 `GEE_UNAVAILABLE` with a stable
  `details` tag — `GEE_NOT_CONFIGURED`, `GEE_NOT_INSTALLED` or `GEE_AUTH_FAILED` for setup
  problems, `GEE_TILES` when only a display layer failed, `GEE_PROVIDER_ERROR` otherwise.
  The page shows the setup paragraph only for the first group. The first computation after
  a new IAM grant can return a stale `serviceusage.services.use` denial during Google-side
  propagation; that specific answer is retried once before being reported.
- **Limits:** area 0.01–5 000 ha, date range ≤ 90 days, end date not in the future.
  Sentinel-1 overpass timing relative to rainfall is not modelled, and vegetation indices
  indicate condition, never disease.

---

## 6. API contract (v1)

All responses are JSON. Errors use a uniform envelope:

```json
{ "error": { "code": "NASA_UNAVAILABLE", "message": "…", "details": "…" } }
```

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | liveness + data-mode |
| GET | `/api/data-sources` | catalogue with nature/resolution/attribution |
| GET | `/api/demo` | demo-mode descriptor and snapshot date |
| GET | `/api/geocode/search?q=` | place search (proxy, cached) |
| GET | `/api/geocode/reverse?lat=&lon=` | label for coordinates |
| GET | `/api/fields` | list fields |
| POST | `/api/fields` | create field profile |
| GET | `/api/fields/{id}` | field detail |
| PATCH | `/api/fields/{id}` | update field |
| DELETE | `/api/fields/{id}` | delete field + dependants |
| GET | `/api/fields/{id}/environment?start=&end=` | normalised daily series + summary |
| GET | `/api/fields/{id}/vegetation` | NDVI/NDMI availability, latest pass and two-scene trend (Earth Engine) |
| GET | `/api/fields/{id}/irrigation?end=` | irrigation analysis |
| GET | `/api/fields/{id}/health?end=` | crop-health analysis |
| POST | `/api/satellite/analyze-field` | Sentinel-1/2 analysis for a GeoJSON polygon or lat/lon + buffer |
| POST | `/api/analyze-field` | alias of the route above for external clients |
| POST | `/api/satellite/fields/{id}` | same analysis using the stored field boundary (or centre + buffer) |
| POST | `/api/assistant/chat` | AI answer grounded in field context |
| GET | `/api/assistant/conversations/{field_id}` | stored conversation |

`end` is requested as *today − 1 day*, then trimmed to the latest day for which a
complete ET₀ can be computed: POWER publishes with a lag, and an analysis should end
on the last defendable day rather than on a null placeholder. The trimmed window is
disclosed in `limitations` on environment, irrigation and health responses. `start`
defaults to the planting date. A `mode=demo` query flag forces demo replay per request.

A wheat season is 150 days. Once the analysis date falls after harvest,
`irrigation` and `health` return `status: "insufficient_data"` with
`season_complete: true`, no demand class, no indicators and an explicit reason
instead of reporting post-harvest weather as crop stress.

### Response highlights

`IrrigationAnalysis`
```ts
{
  status: "ok" | "insufficient_data",
  season_complete: boolean,          // true after the 150-day wheat season
  demand: "low" | "moderate" | "high" | "unknown",
  confidence: { level: "high" | "medium" | "low", reasons: string[] },
  et0_mm_day: number | null,
  kc: number | null,
  etc_mm_day: number | null,
  stage: { code, name, days_after_planting, progress, kc },
  balance: { depletion_mm, taw_mm, raw_mm, depletion_fraction, stress_days },
  net_requirement_mm: number | null,
  gross_requirement_mm: number | null,
  drivers: [{ label, value, unit, interpretation }],
  missing_inputs: string[],
  limitations: string[],
  source: DataSourceRef,
  is_demo: boolean
}
```

`CropHealthAnalysis`
```ts
{
  status: "good" | "moderate" | "stressed" | "insufficient_data",
  season_complete: boolean,
  status_reason: string,
  indicators: [{ id, label, value, unit, status, interpretation }],
  indicator_agreement: {             // descriptive, never a health probability
    percent: number | null,          // share of known indicators not at stress
    known: number, total: number, stressed: number,
    definition: string
  } | null,
  vegetation: { available, ndvi, trend, latest_date, note },
  summary: string,
  missing_inputs: string[],
  limitations: string[]
}
```

`SatelliteAnalysis`
```ts
{
  field_id: number | null,
  area_ha: number,
  geometry_source: "polygon" | "point_buffer",
  start: "YYYY-MM-DD",
  end: "YYYY-MM-DD",
  soil_moisture: {                    // Sentinel-1
    available: boolean,
    category: "dry" | "near_normal" | "wet" | "unknown",
    relative_score: number | null,    // 0–1 relative backscatter proxy
    relative_percent: number | null,  // same score ×100, relative only
    vv_db, vh_db, vh_minus_vv_db: number | null,
    acquisition_date: string | null,
    scene_count: number,
    valid_pixels: number | null,
    reason: string | null,
    interpretation: string
  },
  vegetation: {                       // Sentinel-2
    available: boolean,
    ndvi, ndmi, ndwi: number | null,
    ndvi_condition: "sparse" | "moderate" | "dense" | "unknown",
    ndmi_condition: "low" | "moderate" | "high" | "unknown",
    acquisition_date: string | null,
    scene_count: number,
    cloud_cover_percent: number | null,
    valid_fraction: number | null,
    composite: boolean,               // median composite fallback
    reason: string | null,
    interpretation: string
  },
  tiles: {                            // getMapId() URL templates
    soil_moisture | ndvi | ndmi: {
      url, layer_name, min, max, palette, attribution
    } | null
  },
  sources: DataSourceRef[],
  limitations: string[],
  generated_at: string
}
```

`VegetationResponse` (crop-health NDVI card; same Earth Engine service, Sentinel-2 only)
```ts
{
  field_id: number,
  available: boolean,
  reason: string | null,
  provider: string | null,           // "Google Earth Engine · Sentinel-2 SR"
  series: [{ date, ndvi }],          // latest two usable acquisitions
  latest: { date, ndvi } | null,
  trend: "improving" | "declining" | "stable" | "unknown",
  ndmi: number | null,
  ndvi_condition, ndmi_condition,
  acquisition_date: string | null,
  cloud_cover_percent: number | null,
  scene_count: number | null,
  composite: boolean,
  geometry_source: "polygon" | "point_buffer" | null,
  tile: { url, layer_name, min, max, palette, attribution } | null,
  interpretation: string | null,
  formula: string,
  limitations: string[],
  is_demo: boolean
}
```

---

## 7. Database (SQLite via SQLAlchemy 2)

| Table | Purpose | Key columns |
|---|---|---|
| `users` | single local operator today, multi-user ready | id, email, display_name |
| `fields` | field profile | id, user_id, name, crop_id, planting_date, lat, lon, area_ha, soil_texture, irrigation_system, boundary_geojson, created_at |
| `field_locations` | location history / optional boundary label | id, field_id, label, lat, lon, source, created_at |
| `environmental_data` | cached daily observations actually used | field_id, date, variable, value, unit, source, is_demo (unique per tuple) |
| `vegetation_data` | NDVI observations persisted for the field | field_id, date, index_name, value, source |
| `irrigation_analysis` | snapshots of computed analyses | field_id, computed_for, payload_json, demand, confidence |
| `crop_health_analysis` | snapshots | field_id, computed_for, status, payload_json |
| `ai_conversations` | one row per thread | id, field_id, title, created_at |
| `ai_messages` | messages + context used | conversation_id, role, content, context_json |
| `data_sources` | seeded catalogue | id (slug), name, nature, resolution, attribution, url |

Rationale: raw POWER payloads are cached in `environmental_data` only for the dates the
analysis used (prevents unbounded duplication); result snapshots make past recommendations
reproducible. Crop constants are **not** duplicated here — see principle 6.

---

## 8. Scientific methods (summary)

Full formulas, units and citations live in `backend/app/science/*.py` docstrings.

### ET₀ — FAO-56 Penman–Monteith (daily)

```
ET₀ = [0.408 Δ (Rn − G) + γ (900/(T+273)) u₂ (es − ea)] / [Δ + γ (1 + 0.34 u₂)]
```

- Required inputs: Tmax, Tmin, RHmean (or dew point), u₂, Rs, elevation/latitude.
- `Rn` from net shortwave (0.77·Rs) minus net longwave (FAO-56 eq. 39, with Rso).
- `G ≈ 0` for daily steps; `γ = 0.000665·P`; `Δ` from saturation curve.
- If any required input is missing for a day → that day is excluded and reported; we do
  **not** substitute invented values (no silently assumed humidity).

### Kc — wheat growth stages

POWER daily series is indexed by days-after-planting (DAP). The crop registry defines
four stage lengths and three Kc values (FAO-56 Table 12 winter/spring wheat defaults).
Kc is linearly interpolated during development and late season (FAO-56 eq. 66–68).
Default: winter wheat 20/30/60/40 days, Kc 0.40 → 1.15 → 0.30; spring wheat
25/30/50/30, Kc 0.30 → 1.15 → 0.30. Users can later override via crop registry.

### ETc

`ETc = Kc × ET₀` (mm/day).

### Root-zone water balance

```
D_t = D_{t−1} − (P − RO) − I + ETc + DP        (0 ≤ D ≤ TAW)
TAW = 1000 (θFC − θWP) Z_r ;  RAW = p · TAW
```

- `Z_r` grows from 0.15 m at emergence to 1.5 m (wheat), so TAW grows with the crop.
- Initial depletion is documented (50 % of TAW at planting) and adjustable.
- Runoff uses a simple runoff coefficient (10 %) because slope/cover are unknown —
  labelled as an assumption, not a measurement.
- Irrigation `I` is 0 in the baseline (rainfed) run; the module reports the *net
  requirement to refill to field capacity*, not an instruction to irrigate.
- Deep drainage `DP` = excess above field capacity; deficit below wilting point is
  clamped and counted as stress days.

### Demand classification (deterministic)

Demand is a function of depletion relative to RAW, recent rainfall and ETc, with
documented thresholds. Confidence is a qualitative label derived from *documented factors*
(input completeness, spatial mismatch, assumed soil parameters, missing vegetation data),
not a fabricated percentage.

### Crop health

Indicators: heat-stress days around flowering, depletion fraction, rainfall anomaly vs
POWER climatology, and (when available) NDVI trend. Status is `GOOD / MODERATE / STRESSED /
INSUFFICIENT_DATA` with the indicator list attached. No disease claims — the module models
environmental stress only.

### Vegetation

`NDVI = (NIR − Red) / (NIR + Red)` implemented and unit-tested. Values are reduced
server-side in Google Earth Engine from `COPERNICUS/S2_SR_HARMONIZED`; when Earth Engine is
not configured or fails, the endpoint honestly returns `available: false` with the reason
instead of synthetic values.

### Simplified farmer check

`POST /api/farmer-summary` is a thin, jargon-free façade over the same services
(`services/satellite.py`, `services/nasa_power.py`, `services/forecast.py`). It never
invents a value: each block is either measured/computed with its source or explicitly
`available: false` with a reason code.

- **Intent `plant_now`** — the crop calendar (`crops/calendar.py`, regional Egypt
  defaults) scores the month (ideal 100 / acceptable 70 / outside 20), the latest POWER
  mean temperature (100 inside the optimum, −10 per °C outside) and Sentinel-1 surface
  wetness (near normal 100 / dry 45 / wet 30). Weighted 45 / 35 / 20 (renormalised
  55 / 45 without a radar read). One blocking component forces `not_suitable` and caps
  the displayed readiness so the gauge can never contradict the traffic light.
- **Intent `already_planted`** — the health score blends the canopy score from Sentinel-2
  NDVI (anchors 0.03 → 0, 0.88 → 100) with the water score from NDMI (−0.10 → 0,
  0.40 → 100) at 80 / 20. Ratings: ≥80 excellent, ≥65 good, ≥50 fair, ≥35 weak, else
  poor. Soil wetness becomes irrigation advice (dry → irrigate, wet → no irrigation).
- **Timeline** — the request carries `intent`, optional `days_since_planting` (0–180) and an
  optional field polygon. The service derives a stage (`pre_planting`, `early_growth`,
  `established`), the expected emergence window and seed depth from the crop calendar, and
  emits risk/action codes for seedbed moisture, crusting, heat, frost, wind, weeds and
  pests. Sentences stay in the frontend.
- **Demo fields** — `GET /api/farmer-demo-fields` publishes three real Egyptian locations
  (Delta, Nubaria reclamation, prepared Sharqia field) with validated square polygons. The
  page offers them as one-tap examples; their descriptions state the intended contrast and
  live satellite values always override them.
- **Map tiles** — the satellite service returns palette NDVI/NDMI/Sentinel-1 layers plus a
  true-colour B4/B3/B2 composite (`kind: "rgb"`). The farmer map shows one layer at a time;
  tile colours are display-only and never feed the reported numbers.
- **Guardrail** — all numeric blocks pass `science/validation.py` before serialisation:
  bounded clamps with tolerance, rejection of gross outliers, recomputation of derived
  fields, and correction codes (`ndvi:clamped`, `relative_percent:recomputed`, …) surfaced
  in `corrections`. A rejected block becomes `available: false` rather than showing a
  broken value.
- **Forecast** — NASA POWER has no forecast product, so the next five days come from the
  keyless Open-Meteo daily endpoint (`services/forecast.py`), attributed in the response
  and in `data_catalog.py`. Failure returns an explicit "no forecast" instead of a gap
  filled by climatology.
- **Demo mode** returns `available: false, is_demo: true` — the cached Qena snapshot
  cannot describe today's field, and the page says so.
- **Wording** — the backend returns codes and numbers; the frontend owns the simple
  English/Arabic sentences, so no scientific term (NDVI, NDMI, backscatter) reaches this
  page. The percentages are descriptive scores, not yield predictions or diagnoses.

---

## 9. AI design

- **Provider:** any OpenAI-compatible chat-completions endpoint (`AI_BASE_URL`, `AI_API_KEY`,
  `AI_MODEL`). Server-side only, with timeouts and a per-session request limit.
- **Grounding:** a compact JSON context built from freshly recomputed analyses. The system
  prompt forbids using outside facts, inventing values, or giving prescriptive irrigation
  volumes beyond computed numbers.
- **Fallback:** without a key, a deterministic explanation engine turns the same structured
  facts into a readable answer and labels itself "rule-based". The UI is fully usable offline.
- **Audit:** every answer stores the exact context JSON; the UI exposes it under
  "Data sent to assistant".

---

## 10. Demo mode

`DATA_MODE=demo` (or `?mode=demo`) replays a **cached real NASA POWER response**
(`backend/app/demo/qena_power_snapshot.json`) through the same pipeline. Every response has
`is_demo: true`; the UI shows a persistent "DEMO DATA" banner and a badge on each card. Demo
mode never pretends to be live. Live mode is the default.

---

## 11. Cross-cutting concerns

- **Errors:** typed domain exceptions (`NASAUnavailable`, `InsufficientData`,
  `ValidationFailure`, `GEEUnavailable`) mapped to friendly JSON by FastAPI handlers;
  stack traces stay in logs. `GEEUnavailable` uses HTTP 503 with code `GEE_UNAVAILABLE` so
  the UI can distinguish "not configured" from a transient failure.
- **Loading/empty/error/success:** `useAsync` + `<AsyncState>` gate every data page.
- **Caching:** in-process TTL cache for POWER and geocoding (default 6 h); POWER series are
  also materialised into `environmental_data`.
- **Security:** Pydantic validation of coordinates (−90..90, −180..180), date ranges
  (≤ 366 days for series, ≥ 1981-01-01), field ownership scoping, message length limits,
  no secrets in responses, CORS restricted to configured origins.
- **Accessibility:** semantic landmarks, skip link, visible focus rings, labelled inputs,
  `aria-live` for async states, colour never the only signal (text labels on status).
- **Responsive:** 12-column grid ≥ 1024 px, stacked cards below 768 px, map heights adapt.
- **Theming:** semantic colour tokens are RGB triplets in `index.css` (`--c-ink`,
  `--c-card`, …) consumed by Tailwind as `rgb(var(--c-x) / <alpha-value>)`.
  `ThemeContext` toggles `.dark` on `<html>`, persists the choice and exposes chart
  colours; component markup therefore needs no `dark:` duplication. Ramps reverse
  in dark mode, and `.panel-night` keeps equation/AI panels dark in both themes.
- **Internationalisation:** English source strings double as dictionary keys.
  `I18nContext.t()` looks up `messages.ar.ts`, interpolates `{placeholders}` and
  falls back to English. Backend-composed sentences (numbers, dates, indicator
  ids) are handled by pattern rules in `patterns.ar.ts`. `dir="rtl"` is set on
  `<html>`; layout uses logical utilities (`ms/me`, `start/end`, `text-start`),
  while Data URLs and charts stay `dir="ltr"` so scientific axes do not mirror.

---

## 12. Phase map (how this build is executed)

| Phase | Deliverable | Where |
|---|---|---|
| 1 | Architecture | this file + folders |
| 2 | Frontend layout | `frontend/src/components/layout`, `pages/Home.tsx` |
| 3 | Backend API | `backend/app/api`, `main.py` |
| 4 | NASA integration | `services/nasa_power.py`, `services/geocoding.py` |
| 5 | Data processing | `services/processing.py` |
| 6 | Scientific models | `science/et0.py`, `crop_coefficient.py`, `water_balance.py` |
| 7 | Irrigation | `science/irrigation.py`, `services/irrigation.py` |
| 8 | Crop health | `science/stress.py`, `services/crop_health.py` |
| 9 | AI assistant | `ai/`, `services/assistant` |
| 10 | Database | `db/` |
| 11 | Testing | `backend/tests/` |
| 12 | Documentation | `README.md`, `GUIDE.txt` |
| 13 | UI polish | design system + final verification |
| 14 | Satellite analysis | `services/earth_engine.py`, `services/satellite.py`, `science/sar_moisture.py`, `pages/Satellite.tsx` |
| 15 | Simplified farmer guide | `services/farmer_summary.py`, `services/forecast.py`, `crops/calendar.py`, `api/routers/farmer.py`, `pages/FarmerGuide.tsx` |

---

## 13. Known architecture limitations

- POWER is coarse (~50 km): field-scale soil water cannot be observed from it; the
  irrigation model is a **decision-support estimate**, not a substitute for soil probes.
- NDVI/NDMI require Earth Engine; without it (or in demo mode) the UI reports
  `available: false` with a reason instead of a value.
- Runoff and initial soil water are assumptions; both are exposed and labelled.
- The demand rule is agronomic guidance, not a validated prescription; see README
  "Scientific validation".
- Single-node SQLite cache and in-process cache: fine for a student/local deployment.
- Earth Engine is optional and requires a GCP service account with Earth Engine access;
  without credentials the Satellite page returns a labelled 503 instead of data. Sentinel-1
  wetness is a relative backscatter proxy — orbit, incidence angle, roughness and vegetation
  cover are not corrected for, so the category is comparative, not volumetric soil moisture.
  Satellite tiles are visual context for the analysed polygon; statistics come from
  `reduceRegion`, never from displayed pixels.
