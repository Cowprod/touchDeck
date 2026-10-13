#include <Arduino.h>
#include <Arduino_GFX_Library.h>
#include <ArduinoJson.h>
#include <WebSocketsClient.h>
#include <WiFi.h>
#include <WebServer.h>
#include <Preferences.h>
#include <Wire.h>
#include <ESPmDNS.h>
Arduino_DataBus *bus = new Arduino_ESP32SPI(2,10,6,7,GFX_NOT_DEFINED);
Arduino_GFX *lcd = new Arduino_GC9A01(bus,GFX_NOT_DEFINED,0,true);
WebSocketsClient ws;
WebServer web(80);
Preferences prefs;
DynamicJsonDocument state(16000);
String id, host, pageId, selectedServer;
uint16_t port = 3000;
uint32_t revision=0, wifiStarted=0;
bool provision=false, wsReady=false, wsStarted=false;
uint32_t disconnectedAt=0;
uint32_t discoveryAt=0, lastRetryAt=0;
uint8_t failedDiscoveries=0;
int startX=-1, lastX=0, lastY=0;
bool pressed=false;
uint32_t started=0, lastPoll=0;
uint16_t rgb(const char *hex, uint16_t fallback) {
 if(!hex || strlen(hex)!=7 || hex[0]!='#')return fallback;
 unsigned long v=strtoul(hex+1,nullptr,16);
 return lcd->color565((v>>16)&255,(v>>8)&255,v&255);
}
void label(String s,int x,int y,int w,int h,uint16_t color,int size){
 lcd->setTextSize(size);lcd->setTextColor(color);
 if(s.length()>100)s=s.substring(0,100);
 lcd->setCursor(x+max(0,(w-(int)s.length()*6*size)/2),y+max(0,(h-8*size)/2));lcd->print(s);
}
void status(String a,String b){
 lcd->fillScreen(BLACK);lcd->drawCircle(120,120,112,CYAN);
 label("TouchDeck",25,55,190,30,WHITE,2);
 label(a,20,104,200,20,YELLOW,1);
 label(b,20,132,200,30,WHITE,1);
}
void draw(){
 JsonVariantConst page=state["page"];
 if(page.isNull()){status("Non affecte","Attente du serveur");return;}
 lcd->fillScreen(rgb(page["backgroundColor"]|"",BLACK));
 for(JsonVariantConst c:page["components"].as<JsonArrayConst>()){
  int x=c["x"]|0,y=c["y"]|0,w=c["w"]|30,h=c["h"]|30;
  if(x<0||y<0||w<4||h<4||x+w>240||y+h>240)continue;
  String type=c["type"]|"Label";
  if(type!="Label")lcd->fillRoundRect(x+1,y+1,w-2,h-2,4,rgb(c["backgroundColor"]|"",0x3186));
  label(c["text"]|"",x+2,y+2,w-4,h-4,rgb(c["textColor"]|"",WHITE),(c["fontSize"]|15)>=19?2:1);
 }
}
void send(const char *type,const char *key,const String &value){
 StaticJsonDocument<256> d;d["type"]=type;d[key]=value;
 String out;serializeJson(d,out);ws.sendTXT(out);
}
void onWs(WStype_t event,uint8_t *payload,size_t len){
 if(event==WStype_DISCONNECTED){wsReady=false;if(!disconnectedAt)disconnectedAt=millis();status("Serveur deconnecte","Reconnexion...");Serial.println("ws_disconnected");return;}
 if(event==WStype_CONNECTED){disconnectedAt=0;wsReady=true;send("hello","clientId",id);Serial.println("ws_connected");return;}
 if(event!=WStype_TEXT||len>22000)return;
 DynamicJsonDocument doc(24000);
 if(deserializeJson(doc,payload,len))return;
 String type=doc["type"]|"";
 if(type=="welcome"){
  String group=doc["groupId"]|"";
  Serial.printf("welcome group=%s\n",group.c_str());
  if(group.isEmpty())send("assign","groupId","demo");
 }else if(type=="page"){
  state.clear();state["page"]=doc["page"];
  pageId=doc["page"]["id"]|"";
  revision=doc["pageRevision"]|0;
  Serial.printf("page=%s revision=%lu\n",pageId.c_str(),(unsigned long)revision);
  draw();
 }else if(type=="component_update"){
  if(pageId!=(doc["pageId"]|"")||revision!=(doc["pageRevision"]|0))return;
  bool changed=false;
  for(JsonVariantConst update:doc["changes"].as<JsonArrayConst>())
   for(JsonVariant component:state["page"]["components"].as<JsonArray>())
    if(String(component["id"]|"")==String(update["id"]|"")){
     component["text"]=update["text"].as<String>();changed=true;
    }
  if(changed)draw();
 }else if(type=="error")Serial.printf("ws_error=%s\n",doc["code"]|"unknown");
}
bool touch(int &x,int &y){
 Wire.beginTransmission(0x15);Wire.write((uint8_t)0x01);
 if(Wire.endTransmission(false)!=0||Wire.requestFrom((uint8_t)0x15,(uint8_t)6)!=6)return false;
 uint8_t p[6];for(int i=0;i<6;i++)p[i]=Wire.read();
 if((p[1]&15)!=1)return false;
 x=((p[2]&15)<<8)|p[3];y=((p[4]&15)<<8)|p[5];
 return x>=0&&x<240&&y>=0&&y<240;
}
void poll(){
 if(millis()-lastPoll<35)return;lastPoll=millis();
 int x=0,y=0;bool down=touch(x,y);
 if(down){
  if(!pressed){startX=x;started=millis();}
  lastX=x;lastY=y;
 }else if(pressed&&startX>=0){
  int dx=lastX-startX;
  if(abs(dx)>=35&&millis()-started<1000&&wsReady){
   send("navigate","direction",dx<0?"next":"previous");
   Serial.printf("swipe=%d\n",dx);
  }
  startX=-1;
 }
 pressed=down;
}
bool discoverServer(){
 int count=MDNS.queryService("touchdeck","tcp");
 Serial.printf("mdns_count=%d\n",count);
 if(count<=0)return false;
 int chosen=-1;
 for(int i=0;i<count;i++){
  String candidate=MDNS.txt(i,"id");
  Serial.printf("mdns_candidate=%s ip=%s port=%u\n",candidate.c_str(),MDNS.IP(i).toString().c_str(),MDNS.port(i));
  if(selectedServer.length()&&candidate==selectedServer){chosen=i;break;}
 }
 if(chosen<0){
  if(selectedServer.length()){status("Serveur absent",selectedServer);return false;}
  if(count!=1){status("Choix serveur requis","Plusieurs instances");return false;}
  chosen=0;
  selectedServer=MDNS.txt(chosen,"id");
  if(selectedServer.isEmpty()){status("Serveur invalide","ID mDNS manquant");return false;}
  prefs.begin("touchdeck",false);prefs.putString("serverId",selectedServer);prefs.end();
 }
 host=MDNS.IP(chosen).toString();port=MDNS.port(chosen);
 if(host=="0.0.0.0"||!port)return false;
 Serial.printf("mdns_selected=%s endpoint=%s:%u\n",selectedServer.c_str(),host.c_str(),port);
 return true;
}
void portal(){
 WiFi.mode(WIFI_AP);
 String ssid="TouchDeck-"+id.substring(id.length()-6);
 WiFi.softAP(ssid.c_str());
 status("Configuration Wi-Fi",ssid);
 web.on("/",HTTP_GET,[](){
  web.send(200,"text/html","<meta name='viewport' content='width=device-width'><h2>TouchDeck</h2><form method='post' action='/save'>SSID<input name='ssid' required><br>Mot de passe<input type='password' name='pass'><br><button>Enregistrer</button></form>");
 });
 web.on("/save",HTTP_POST,[](){
  String ssid=web.arg("ssid");
  if(ssid.length()<1||ssid.length()>32){
   web.send(400,"text/plain","Invalid");return;
  }
  prefs.begin("touchdeck",false);
  prefs.putString("ssid",ssid);prefs.putString("pass",web.arg("pass"));
  prefs.end();
  web.send(200,"text/plain","Enregistre. Redemarrage...");delay(300);ESP.restart();
 });
 web.begin();Serial.printf("ap=%s ip=%s\n",ssid.c_str(),WiFi.softAPIP().toString().c_str());
}
void setup(){
 Serial.begin(115200);delay(400);
 // One-time provisioning reset for the current physical troubleshooting session.
 Preferences resetPrefs;
 resetPrefs.begin("td-reset",false);
 if(!resetPrefs.getBool("once-20261013",false)){
   Preferences wifiPrefs;
   wifiPrefs.begin("touchdeck",false);
   wifiPrefs.clear();
   wifiPrefs.end();
   resetPrefs.putBool("once-20261013",true);
   Serial.println("provisioning_reset_once");
 }
 resetPrefs.end();
 id="esp-"+WiFi.macAddress();id.replace(":","");id.toLowerCase();
 pinMode(3,OUTPUT);digitalWrite(3,HIGH);lcd->begin();
 pinMode(1,OUTPUT);digitalWrite(1,LOW);delay(15);digitalWrite(1,HIGH);delay(80);
 Wire.begin(4,5);Wire.setClock(100000);
 status("Demarrage",id);
 prefs.begin("touchdeck",true);
 String ssid=prefs.getString("ssid",""),pass=prefs.getString("pass","");
 selectedServer=prefs.getString("serverId","");prefs.end();
 Serial.printf("client=%s\n",id.c_str());
 if(ssid.isEmpty()){portal();provision=true;return;}
 WiFi.mode(WIFI_STA);WiFi.begin(ssid.c_str(),pass.c_str());
 status("Connexion Wi-Fi",ssid);wifiStarted=millis();
}
void loop(){
 if(provision){web.handleClient();delay(5);return;}
 if(WiFi.status()!=WL_CONNECTED){
  if(millis()-wifiStarted>30000){
   Serial.println("wifi_reconnect");
   WiFi.reconnect();wifiStarted=millis();status("Wi-Fi indisponible","Reconnexion...");return;
  }
  delay(20);return;
 }
 if(!wsStarted){
  static bool mdnsReady=false;
  if(!mdnsReady){mdnsReady=MDNS.begin(id.c_str());if(!mdnsReady){delay(2000);return;}}
  if(millis()-discoveryAt<5000)return;
  discoveryAt=millis();
  if(!discoverServer()){
    failedDiscoveries++;
    if(failedDiscoveries>=3){status("Recherche serveur","mDNS _touchdeck._tcp");failedDiscoveries=0;}
    delay(30);return;
  }
  failedDiscoveries=0;
  ws.begin(host.c_str(),port,"/ws");
  ws.onEvent(onWs);ws.setReconnectInterval(5000);wsStarted=true;
  Serial.printf("wifi_ip=%s server=%s:%u\n",WiFi.localIP().toString().c_str(),host.c_str(),port);
 }
 ws.loop();
 if(wsStarted&&!wsReady&&disconnectedAt&&millis()-disconnectedAt>90000){
  Serial.println("ws_rediscover");ws.disconnect();wsStarted=false;disconnectedAt=0;
  status("Recherche serveur","mDNS");
 }
 poll();delay(2);
}
