#include <Arduino.h>
#include <WiFi.h>
#include <esp_system.h>
#include <esp_chip_info.h>
#include <esp_flash.h>
#include <Arduino_GFX_Library.h>

// Pins recovered from the previous round ESP32-C3 prototype.
static Arduino_DataBus *displayBus = new Arduino_ESP32SPI(2, 10, 6, 7, GFX_NOT_DEFINED);
static Arduino_GFX *display = new Arduino_GC9A01(displayBus, GFX_NOT_DEFINED, 0, true);
static bool displayReady = false;
static uint32_t screenCounter = 0;
static void drawScreen() {
  if (!displayReady) return;
  display->fillScreen(BLACK);
  display->drawCircle(120, 120, 112, CYAN);
  display->setTextColor(WHITE);
  display->setTextSize(2);
  display->setCursor(49, 66);
  display->print("TouchDeck");
  display->setTextSize(1);
  display->setCursor(60, 107);
  display->print("ESP32-C3 / GC9A01");
  display->setCursor(65, 131);
  display->print("SCREEN TEST");
  display->setCursor(77, 154);
  display->printf("tick %lu", (unsigned long)screenCounter);
}


// Safe, serial-only diagnostic. Does not initialize display, touch, Wi-Fi,
// change NVS, or attempt network connections. No credentials are embedded.
static void report() {
  esp_chip_info_t chip;
  esp_chip_info(&chip);
  uint32_t flashBytes = 0;
  esp_flash_get_size(nullptr, &flashBytes);
  Serial.println("\nTOUCHDECK_DIAGNOSTIC_V1");
  Serial.printf("chip_model=%s\n", ESP.getChipModel());
  Serial.printf("chip_revision=%u\n", chip.revision);
  Serial.printf("cpu_cores=%u\n", chip.cores);
  Serial.printf("flash_bytes=%lu\n", (unsigned long)flashBytes);
  Serial.printf("heap_total=%lu\n", (unsigned long)ESP.getHeapSize());
  Serial.printf("heap_free=%lu\n", (unsigned long)ESP.getFreeHeap());
  Serial.printf("psram_bytes=%lu\n", (unsigned long)ESP.getPsramSize());
  Serial.printf("sdk=%s\n", ESP.getSdkVersion());
  Serial.printf("wifi_sta_mac=%s\n", WiFi.macAddress().c_str());
  Serial.println("diagnostic_ready=1");
}
void setup() {
  Serial.begin(115200);
  delay(1500);
  report();
  pinMode(3, OUTPUT);
  digitalWrite(3, HIGH);
  displayReady = display->begin();
  Serial.printf("display_begin=%s\\n", displayReady ? "OK" : "FAILED");
  drawScreen();
}
void loop() {
  static uint32_t previous = 0;
  if (millis() - previous >= 10000) {
    previous = millis();
    report();
    screenCounter++;
    Serial.printf("display_ready=%u screen_tick=%lu\\n", displayReady ? 1u : 0u, (unsigned long)screenCounter);
    drawScreen();
    Serial.printf("heartbeat_ms=%lu free_heap=%lu\n",
      (unsigned long)millis(), (unsigned long)ESP.getFreeHeap());
  }
}
