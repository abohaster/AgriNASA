/*
 * AgriNASA field robot — ESP32 reference sketch
 *
 * Reads a capacitive soil-moisture probe, a DHT22 (air temperature + humidity)
 * and an HC-SR04 (distance to the canopy) and posts one JSON reading at a time
 * to the AgriNASA backend.
 *
 * Setup:
 *   1. Pair the robot on the field's Robot page (QR or "Create a key directly")
 *      and copy the device key exactly once.
 *   2. Fill WIFI_SSID, WIFI_PASS, INGEST_URL and DEVICE_TOKEN below.
 *   3. Arduino IDE: board "ESP32 Dev Module", libraries "DHT sensor library"
 *      (Adafruit) and "Adafruit Unified Sensor".
 *   4. Upload at 115200 baud and watch the Serial Monitor.
 *
 * The device key is a secret. Do not commit it to a public repository; revoke
 * the device on the Robot page if it ever leaks.
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <DHT.h>

// ── Configuration ───────────────────────────────────────────────────────────

const char *WIFI_SSID = "YOUR_WIFI_NAME";
const char *WIFI_PASS = "YOUR_WIFI_PASSWORD";

// Full endpoint, including the site's host. For the hosted app:
//   https://agrinasa-production.up.railway.app/api/ingest/readings
const char *INGEST_URL = "https://YOUR_SITE_HOST/api/ingest/readings";

// The key shown once when the robot was paired (starts with "ags_").
const char *DEVICE_TOKEN = "ags_replace_with_your_device_key";

// Reading interval. The live panel polls every 5 s; 30 s keeps data fresh
// without hammering the server.
const uint32_t POST_INTERVAL_MS = 30UL * 1000UL;

// ── Pins ────────────────────────────────────────────────────────────────────

const int PIN_DHT = 4;          // DHT22 data, 10 kΩ pull-up to 3V3
const int PIN_SOIL = 34;        // capacitive probe AOUT (ADC1, input-only)
const int PIN_TRIG = 5;         // HC-SR04 trigger
const int PIN_ECHO = 18;        // HC-SR04 echo through a divider to 3.3 V

#define DHTTYPE DHT22
DHT dht(PIN_DHT, DHTTYPE);

// ── Soil calibration ────────────────────────────────────────────────────────
// ADC readings in air (dry) and in a cup of water (wet). Measure yours: the
// probe output varies between boards. The sketch maps the raw value into 0–100 %
// of that range; it is not volumetric water content unless you calibrate it.

const int SOIL_ADC_DRY = 2800;
const int SOIL_ADC_WET = 1200;

float readSoilPercent() {
  const int raw = analogRead(PIN_SOIL);
  const float pct = 100.0f * (SOIL_ADC_DRY - raw) / (float)(SOIL_ADC_DRY - SOIL_ADC_WET);
  return constrain(pct, 0.0f, 100.0f);
}

float readDistanceCm() {
  digitalWrite(PIN_TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(PIN_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(PIN_TRIG, LOW);
  // 30 ms timeout ≈ 5 m round trip.
  const unsigned long duration = pulseIn(PIN_ECHO, HIGH, 30000UL);
  if (duration == 0) return NAN;
  return duration * 0.0343f / 2.0f;
}

void connectWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("WiFi");
  const uint32_t deadline = millis() + 30000UL;
  while (WiFi.status() != WL_CONNECTED && millis() < deadline) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("Connected, IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("WiFi failed; will retry before the next post.");
  }
}

void postReading(float soilPct, float tempC, float humidityPct, float distanceCm) {
  if (WiFi.status() != WL_CONNECTED) {
    connectWifi();
    if (WiFi.status() != WL_CONNECTED) return;
  }

  // Numbers are formatted explicitly so the JSON stays valid regardless of locale.
  String body = "{";
  bool first = true;
  auto addField = [&](const char *name, float value) {
    if (isnan(value)) return;
    if (!first) body += ",";
    body += "\"";
    body += name;
    body += "\":";
    body += String(value, 1);
    first = false;
  };
  addField("soil_moisture_pct", soilPct);
  addField("air_temp_c", tempC);
  addField("humidity_pct", humidityPct);
  addField("distance_cm", distanceCm);
  body += "}";

  if (first) {
    Serial.println("No finite sensor values; nothing to post.");
    return;
  }

  WiFiClientSecure client;
  // Preferred: verify the server certificate.
  //   client.setCACert(ROOT_CA_PEM);
  // The hosted site uses a public Let's Encrypt certificate. If you cannot
  // embed a CA in the sketch, setInsecure() still encrypts the link but does
  // not authenticate the server, so the device key could be intercepted by a
  // man-in-the-middle. Prefer setCACert in any real deployment.
  client.setInsecure();

  HTTPClient https;
  if (!https.begin(client, INGEST_URL)) {
    Serial.println("Could not start HTTPS request.");
    return;
  }
  https.addHeader("Content-Type", "application/json");
  https.addHeader("Authorization", String("Bearer ") + DEVICE_TOKEN);
  https.setTimeout(15000);

  const int status = https.POST(body);
  Serial.printf("POST %d  body=%s\n", status, body.c_str());
  if (status > 0) {
    Serial.println(https.getString());
  } else {
    Serial.printf("Transport error: %s\n", https.errorToString(status).c_str());
  }
  https.end();
}

void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println("\nAgriNASA field robot");

  pinMode(PIN_TRIG, OUTPUT);
  pinMode(PIN_ECHO, INPUT);
  pinMode(PIN_SOIL, INPUT);
  analogReadResolution(12);
  dht.begin();

  connectWifi();
}

void loop() {
  // DHT22 needs ~2 s between samples; read once per cycle.
  const float humidity = dht.readHumidity();
  const float tempC = dht.readTemperature();
  if (isnan(humidity) || isnan(tempC)) {
    Serial.println("DHT22 read failed (check wiring and pull-up).");
  }

  postReading(readSoilPercent(), tempC, humidity, readDistanceCm());
  delay(POST_INTERVAL_MS);
}