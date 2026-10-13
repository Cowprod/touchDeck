#include <Arduino.h>
#include <Arduino_GFX_Library.h>
#include <ArduinoJson.h>
#include <WebSocketsClient.h>
#include <WiFi.h>
#include <WebServer.h>
#include <Preferences.h>
#include <Wire.h>
#include <ESPmDNS.h>
#include <HTTPClient.h>
#include <LittleFS.h>
Arduino_DataBus *bus = new Arduino_ESP32SPI(2,10,6,7,GFX_NOT_DEFINED);
Arduino_GFX *lcd = new Arduino_GC9A01(bus,GFX_NOT_DEFINED,0,true);
#define TOUCHDECK_FIRMWARE_VERSION "0.1.0+" __DATE__ " " __TIME__
WebSocketsClient ws;
WebServer web(80);
Preferences prefs;
DynamicJsonDocument state(16000);
DynamicJsonDocument iconPaths(4096);
bool iconFsReady=false;
String iconGroup;
String currentGroup;
uint32_t iconRevision=0;
uint32_t lastIconDiagnostic=0;
String id, host, pageId, selectedServer;
uint16_t port = 3000;
uint32_t revision=0, wifiStarted=0;
bool provision=false, wsReady=false, wsStarted=false;
uint32_t disconnectedAt=0;
uint32_t discoveryAt=0, lastRetryAt=0;
uint8_t failedDiscoveries=0;
int startX=-1, startY=-1, lastX=0, lastY=0;
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
void drawIcon(const String &name,int x,int y,int w,int h,uint16_t color){
 const char *path=iconPaths[name] | "";
 if(!path[0]||!iconFsReady)return;
 File file=LittleFS.open(path,"r");
 if(!file)return;
 int width=file.read(),height=file.read();
 if(width!=48||height!=48||file.size()!=290){file.close();return;}
 uint8_t bitmap[288];
 if(file.read(bitmap,sizeof(bitmap))!=sizeof(bitmap)){file.close();return;}
 file.close();
 int scale=min(w,h);
 int left=x+(w-scale)/2,top=y+(h-scale)/2;
 for(int py=0;py<scale;py++)for(int px=0;px<scale;px++){
  int sx=px*48/scale,sy=py*48/scale,bit=sy*48+sx;
  if(bitmap[bit>>3]&(0x80>>(bit&7)))lcd->drawPixel(left+px,top+py,color);
 }
}
void syncIcons(const String &group,uint32_t newRevision){
 if(!iconFsReady||group.isEmpty()||(group==iconGroup&&newRevision==iconRevision))return;
 WiFiClient net;
 HTTPClient http;
 String url="http://"+host+":"+String(port)+"/api/icons/manifest/"+group;
 if(!http.begin(net,url)){Serial.println("icon_manifest_begin_failed");return;}
 http.setTimeout(5000);
 int code=http.GET();
 if(code!=200){Serial.printf("icon_manifest_http=%d\\n",code);http.end();return;}
 DynamicJsonDocument manifest(12000);
 String manifestBody=http.getString();
 http.end();
 DeserializationError err=deserializeJson(manifest,manifestBody);
 if(err||!manifest["resources"].is<JsonArray>()){Serial.printf("icon_manifest_invalid err=%s bytes=%u body=%.180s\\n",err.c_str(),(unsigned)manifestBody.length(),manifestBody.c_str());return;}
 DynamicJsonDocument nextPaths(4096);
 bool success=true;
 for(JsonVariantConst resource:manifest["resources"].as<JsonArrayConst>()){
  String name=resource["id"]|"",sha=resource["sha256"]|"";
  if(name.length()<3||name.length()>90||sha.length()!=64){success=false;break;}
  String path="/i"+sha.substring(0,24)+".bin";
  if(!LittleFS.exists(path)){
   HTTPClient imageHttp;WiFiClient imageNet;
   String imageUrl="http://"+host+":"+String(port)+"/api/icons/mask/"+name;
   if(!imageHttp.begin(imageNet,imageUrl)){success=false;break;}
   imageHttp.setTimeout(5000);
   int imageCode=imageHttp.GET();
   if(imageCode!=200||(imageHttp.getSize()>=0&&imageHttp.getSize()!=290)){Serial.printf("icon_mask_http=%d size=%d\\n",imageCode,imageHttp.getSize());imageHttp.end();success=false;break;}
   String tmp=path+".tmp";
   File output=LittleFS.open(tmp,"w");
   if(!output){imageHttp.end();success=false;break;}
   int copied=imageHttp.writeToStream(&output);
   output.close();imageHttp.end();
   if(copied!=290){LittleFS.remove(tmp);success=false;break;}
   File verify=LittleFS.open(tmp,"r");
   bool valid=verify&&verify.size()==290&&verify.read()==48&&verify.read()==48;
   verify.close();
   if(!valid||!LittleFS.rename(tmp,path)){LittleFS.remove(tmp);success=false;break;}
  }
  nextPaths[name]=path;
 }
 if(!success){Serial.println("icon_sync_incomplete");return;}
 iconPaths.clear();iconPaths.set(nextPaths.as<JsonVariantConst>());
 iconGroup=group;iconRevision=newRevision;
 File root=LittleFS.open("/");
 File file=root.openNextFile();
 while(file){
  String path=file.name();
  if(!path.startsWith("/"))path="/"+path;
  file.close();
  bool keep=false;
  for(JsonPairConst entry:iconPaths.as<JsonObjectConst>())if(path==entry.value().as<String>()){keep=true;break;}
  if(path.startsWith("/i")&&path.endsWith(".bin")&&!keep)LittleFS.remove(path);
  file=root.openNextFile();
 }
 root.close();
 Serial.printf("icon_sync_ok group=%s count=%u\\n",group.c_str(),(unsigned)iconPaths.size());
}
void drawComponent(JsonVariantConst component,bool clearArea){
 int x=component["x"]|0,y=component["y"]|0,w=component["w"]|30,h=component["h"]|30;
 if(x<0||y<0||w<4||h<4||x+w>240||y+h>240)return;
 if(clearArea)lcd->fillRect(x,y,w,h,rgb(state["page"]["backgroundColor"]|"",BLACK));
 String type=component["type"]|"Label";
 if(!((type=="Label"||type=="Icon") && component["backgroundColor"].isNull())){
  int radius=component["radius"]|1;
  int r=radius==2?min(w-2,h-2)/2:radius==0?0:4;
  uint16_t bg=rgb(component["backgroundColor"]|"",0x3186);
  if(r==0)lcd->fillRect(x+1,y+1,w-2,h-2,bg);
  else lcd->fillRoundRect(x+1,y+1,w-2,h-2,r,bg);
 }
 if(type=="Icon"){
  Serial.printf("icon_render name=%s color=%s bg=%s cached=%d\\n",component["icon"]|"",component["textColor"]|"",component["backgroundColor"]|"transparent",iconPaths.containsKey(component["icon"]|""));
  drawIcon(component["icon"]|"",x+2,y+2,w-4,h-4,rgb(component["textColor"]|"",WHITE));
 }
 else label(component["text"]|"",x+2,y+2,w-4,h-4,rgb(component["textColor"]|"",WHITE),(component["fontSize"]|15)>=19?2:1);
}
void draw(){
 JsonVariantConst page=state["page"];
 if(page.isNull()){status("Non affecte","Attente du serveur");return;}
 lcd->fillScreen(rgb(page["backgroundColor"]|"",BLACK));
 for(JsonVariantConst component:page["components"].as<JsonArrayConst>())drawComponent(component,false);
}
void send(const char *type,const char *key,const String &value){
 StaticJsonDocument<256> d;d["type"]=type;d[key]=value;
 String out;serializeJson(d,out);ws.sendTXT(out);
}
void onWs(WStype_t event,uint8_t *payload,size_t len){
 if(event==WStype_DISCONNECTED){wsReady=false;if(!disconnectedAt)disconnectedAt=millis();status("Serveur deconnecte",host+":"+String(port));Serial.printf("ws_disconnected endpoint=%s:%u wifi=%s\n",host.c_str(),port,WiFi.localIP().toString().c_str());return;}
 if(event==WStype_CONNECTED){disconnectedAt=0;wsReady=true;StaticJsonDocument<256> hello;hello["type"]="hello";hello["clientId"]=id;hello["firmwareVersion"]=TOUCHDECK_FIRMWARE_VERSION;hello["deviceType"]="esp32c3";String out;serializeJson(hello,out);ws.sendTXT(out);Serial.printf("ws_connected firmware=%s\n",TOUCHDECK_FIRMWARE_VERSION);return;}
 if(event!=WStype_TEXT||len>22000)return;
 DynamicJsonDocument doc(24000);
 DeserializationError parseError=deserializeJson(doc,payload,len);
 if(parseError){Serial.printf("ws_json_error=%s len=%u\n",parseError.c_str(),(unsigned)len);return;}
 String type=doc["type"]|"";
 if(type=="welcome"){
  String group=doc["groupId"]|"";
  currentGroup=group;
  Serial.printf("welcome group=%s\n",group.c_str());
  if(group.isEmpty())send("assign","groupId","demo");
 }else if(type=="page"){
  // Own the page tree independently of the temporary incoming JSON document.
  String pageJson;serializeJson(doc["page"],pageJson);
  state.clear();
  DeserializationError pageError=deserializeJson(state,String("{\"page\":")+pageJson+"}");
  if(pageError){Serial.printf("page_copy_error=%s\n",pageError.c_str());return;}
  pageId=doc["page"]["id"]|"";
  revision=doc["pageRevision"]|0;
  Serial.printf("page=%s revision=%lu components=%u bg=%s\n",pageId.c_str(),(unsigned long)revision,(unsigned)state["page"]["components"].as<JsonArrayConst>().size(),state["page"]["backgroundColor"]|"missing");
  currentGroup=doc["groupId"]|currentGroup;
  syncIcons(currentGroup,revision);
  draw();
 }else if(type=="component_update"){
  String incomingPage=doc["pageId"]|"";
  uint32_t incomingRevision=doc["pageRevision"]|0;
  static uint32_t lastUpdateLog=0;
  if(pageId!=incomingPage||revision!=incomingRevision){
   if(millis()-lastUpdateLog>3000){
    Serial.printf("update_rejected local=%s/%lu incoming=%s/%lu\n",pageId.c_str(),(unsigned long)revision,incomingPage.c_str(),(unsigned long)incomingRevision);
    lastUpdateLog=millis();
   }
   return;
  }
  unsigned changed=0;
  for(JsonVariantConst update:doc["changes"].as<JsonArrayConst>()){
   const char *updateId=update["id"]|"";
   String nextText=update["text"]|"";
   for(JsonVariant component:state["page"]["components"].as<JsonArray>()){
    if(strcmp(component["id"]|"",updateId)!=0)continue;
    if(String(component["text"]|"")==nextText)break;
    component["text"]=nextText;
    if(state.overflowed())Serial.printf("state_overflow update=%s heap=%u\\n",updateId,(unsigned)ESP.getFreeHeap());
    drawComponent(component.as<JsonVariantConst>(),true);
    changed++;
    break;
   }
  }
  // ArduinoJson 6 keeps superseded string values until garbage collection.
  // Clock/stopwatch updates otherwise exhaust the 16 KB state document over time.
  static uint32_t updateBatches=0;
  if(changed && (++updateBatches % 30)==0){
   state.garbageCollect();
   Serial.printf("state_gc used=%u capacity=%u overflow=%d\\n",(unsigned)state.memoryUsage(),(unsigned)state.capacity(),state.overflowed());
  }
  if(millis()-lastUpdateLog>3000){
   Serial.printf("update_received count=%u redrawn=%u heap=%u\n",(unsigned)doc["changes"].as<JsonArrayConst>().size(),changed,(unsigned)ESP.getFreeHeap());
   lastUpdateLog=millis();
  }
 }else if(type=="interaction_result"){
  Serial.printf("interaction_result component=%s request=%s status=%s reason=%s\\n",
    doc["componentId"]|"",doc["requestId"]|"",doc["status"]|"",doc["reason"]|"");
 }else if(type=="error")Serial.printf("ws_error=%s\\n",doc["code"]|"unknown");
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
  if(!pressed){startX=x;startY=y;started=millis();}
  lastX=x;lastY=y;
 }else if(pressed&&startX>=0){
  int dx=lastX-startX;
  if(abs(dx)>=35&&millis()-started<1000&&wsReady){
   send("navigate","direction",dx<0?"next":"previous");
   Serial.printf("swipe=%d\n",dx);
  }
  else if(abs(dx)<15&&abs(lastY-startY)<15&&millis()-started<1000&&wsReady){
   for(JsonVariantConst component:state["page"]["components"].as<JsonArrayConst>()){
    String kind=component["type"]|"";
    if((kind!="Button"&&kind!="Toggle")||(component["disabled"]|false))continue;
    int cx=component["x"]|0,cy=component["y"]|0,cw=component["w"]|0,ch=component["h"]|0;
    if(lastX<cx||lastX>=cx+cw||lastY<cy||lastY>=cy+ch)continue;
    StaticJsonDocument<256> interaction;
    interaction["type"]="interact";interaction["pageId"]=pageId;interaction["pageRevision"]=revision;
    interaction["componentId"]=component["id"]|"";
    interaction["requestId"]="esp-"+String(millis());
    String payload;serializeJson(interaction,payload);ws.sendTXT(payload);
    Serial.printf("interaction_sent component=%s\n",component["id"]|"");
    break;
   }
  }
  startX=-1;
 }
 pressed=down;
}
bool discoverServer(){
 int count=MDNS.queryService("touchdeck","tcp");
 Serial.printf("mdns_count=%d wifi=%s gateway=%s\n",count,WiFi.localIP().toString().c_str(),WiFi.gatewayIP().toString().c_str());
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
 // mDNS may resolve a multi-homed server to its ZeroTier/VPN address.
 // Prefer an explicitly advertised IPv4 on the ESP's own subnet.
 IPAddress local=WiFi.localIP(),mask=WiFi.subnetMask();
 for(int n=0;n<8;n++){
  String key="ip"+String(n);
  String advertisedIp=MDNS.txt(chosen,key.c_str());
  if(advertisedIp.isEmpty())continue;
  IPAddress candidateIp;
  if(!candidateIp.fromString(advertisedIp))continue;
  bool sameSubnet=true;
  for(int octet=0;octet<4;octet++)
   if((candidateIp[octet]&mask[octet])!=(local[octet]&mask[octet]))sameSubnet=false;
  Serial.printf("mdns_ipv4_candidate=%s same_subnet=%d\n",advertisedIp.c_str(),sameSubnet);
  if(sameSubnet){host=advertisedIp;break;}
 }
 if(host=="0.0.0.0"||!port)return false;
 status("Serveur trouve",host+":"+String(port));
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
 iconFsReady=LittleFS.begin(true);
 Serial.printf("littlefs=%d\\n",iconFsReady);
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
 if(wsReady && millis()-lastIconDiagnostic>15000){
  lastIconDiagnostic=millis();
  Serial.printf("icon_diag fs=%d group=%s rev=%lu entries=%u page=%s\\n",iconFsReady,iconGroup.c_str(),(unsigned long)iconRevision,(unsigned)iconPaths.size(),pageId.c_str());
  JsonVariantConst page=state["page"];
  for(JsonVariantConst component:page["components"].as<JsonArrayConst>()){
   if(String(component["type"]|"")=="Icon"){
    String name=component["icon"]|"";
    const char *path=iconPaths[name] | "";
    Serial.printf("icon_diag_component name=%s color=%s bg=%s file=%s exists=%d\\n",name.c_str(),component["textColor"]|"",component["backgroundColor"]|"transparent",path,strlen(path)>0&&LittleFS.exists(path));
   }
  }
  if(iconPaths.size()==0 && !page.isNull())syncIcons(currentGroup,revision);
 }
 if(wsStarted&&!wsReady&&disconnectedAt&&millis()-disconnectedAt>90000){
  Serial.println("ws_rediscover");ws.disconnect();wsStarted=false;disconnectedAt=0;
  status("Recherche serveur","mDNS");
 }
 poll();delay(2);
}
