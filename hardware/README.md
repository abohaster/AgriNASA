# AgriNASA field robot (ESP32)

A minimal, honest sensor node: the ESP32 measures soil moisture, air
temperature and humidity, and the distance to the crop canopy, then posts each
reading to the AgriNASA backend. The site stores values exactly as sent and
shows them beside the satellite and water-balance numbers — it never smooths
or invents a value.

Reference sketch: [`agrinasa_robot/agrinasa_robot.ino`](agrinasa_robot/agrinasa_robot.ino).

## Parts

| Part | Purpose | Notes |
| --- | --- | --- |
| ESP32 DevKit (30 or 38 pin) | Wi-Fi + HTTPS | Any ESP32 with 3.3 V logic works |
| Capacitive soil-moisture probe | Soil moisture | Resistive probes corrode; prefer capacitive |
| DHT22 / AM2302 | Air temperature + humidity | Needs a 10 kΩ pull-up |
| HC-SR04 | Distance to canopy | 5 V module — echo needs a divider |
| Breadboard, jumper wires, 10 kΩ + 2×20 kΩ resistors | Wiring | Two 20 kΩ make the echo divider |

## Wiring

| Module | Module pin | ESP32 pin | Notes |
| --- | --- | --- | --- |
| DHT22 | VCC / DATA / GND | 3V3 / GPIO4 / GND | 10 kΩ between DATA and 3V3 |
| Soil probe | VCC / AOUT / GND | 3V3 / GPIO34 / GND | GPIO34 is ADC1 and input-only |
| HC-SR04 | VCC / TRIG / ECHO / GND | VIN (5 V) / GPIO5 / GPIO18 / GND | ECHO is 5 V: use two 20 kΩ resistors as a divider before GPIO18 |

All grounds are common. Power the ESP32 over USB while flashing, then use a
5 V supply for the HC-SR04 (the board's `VIN` is fine on USB).

## Pair the robot

1. Open the field → **Robot** tab (or the Fale7 page's *Field robot* card).
2. Press **Create pairing QR** and scan it, or use **Create a key directly** if
   you are wiring at the same computer.
3. The pairing page shows the device key **once**. Copy it immediately; the
   server stores only a hash and a short prefix.
4. Keep the key out of public repositories. If it leaks, press **Revoke** on the
   Robot page — ingestion stops immediately — and create a new key.

Pairing codes expire after 15 minutes and work only once.

## Flash

1. Arduino IDE → **Boards Manager** → install **esp32** by Espressif.
2. **Library Manager** → install **DHT sensor library** (Adafruit) and
   **Adafruit Unified Sensor**.
3. Open `agrinasa_robot/agrinasa_robot.ino` and set:
   - `WIFI_SSID`, `WIFI_PASS`
   - `INGEST_URL` — the live site is
     `https://agrinasa-production.up.railway.app/api/ingest/readings`
   - `DEVICE_TOKEN` — the `ags_…` key from the pairing page
4. Calibrate the soil probe: print `analogRead(34)` in air and in a cup of
   water, then set `SOIL_ADC_DRY` and `SOIL_ADC_WET` to those values.
5. Select **ESP32 Dev Module**, upload, and open the Serial Monitor at 115200.
   A working post prints `POST 201` and the stored reading.

TLS: the sketch calls `client.setInsecure()` so a first-time build works without
a CA. That encrypts the traffic but does not authenticate the server. For a
real deployment, use `client.setCACert(...)` with the site's root CA (the hosted
site uses a public Let's Encrypt certificate) instead.

## What the site does with the data

- The **Robot** tab shows the latest values and the last 60 readings, and polls
  every 5 seconds while you press **Connect**.
- The same tab shows Sentinel-2 NDVI/NDMI, the Sentinel-1 relative wetness
  signal and the FAO-56 root-zone water balance.
- These are **different instruments with different footprints**: a probe reads
  one point at one depth, a satellite pixel covers 10 m, and the water balance
  estimates root-zone depletion from a weather grid. They may disagree, and
  the page never calibrates one from another or claims an accuracy gain.
- The **Preview the panel with a local test pattern** button draws a synthetic
  series in the browser for UI checking. It is labelled and never stored.

## Status codes from `POST /api/ingest/readings`

| Status | Meaning | Fix |
| --- | --- | --- |
| `201` | Reading stored | — |
| `401` | Missing, unknown or revoked device key | Re-pair and update `DEVICE_TOKEN` |
| `422` | No sensor value, out-of-range value, or `measured_at` more than 30 days old / 10 min in the future | Check the JSON and the board clock |
| `404` | The field was deleted | Pair a robot to an existing field |
| `5xx` | Server problem | Retry; check the site health endpoint |

## Troubleshooting

- **DHT22 read failed** — check the pull-up and that you waited ~2 s after boot.
- **Distance always `nan`** — the echo divider must bring 5 V down to 3.3 V, and
  TRIG/ECHO must match the sketch.
- **Soil % pinned at 0 or 100** — recalibrate `SOIL_ADC_DRY` / `SOIL_ADC_WET`.
- **Readings arrive but the panel says stale** — the panel's freshness badge is
  based on `measured_at`; if the board sends its own clock, keep it in sync.