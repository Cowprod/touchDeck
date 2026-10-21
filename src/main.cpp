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
#include <Update.h>
#include <mbedtls/sha256.h>
Arduino_DataBus *bus = new Arduino_ESP32SPI(2,10,6,7,GFX_NOT_DEFINED);
Arduino_GFX *lcd = new Arduino_GC9A01(bus,GFX_NOT_DEFINED,0,true);
#ifndef TOUCHDECK_VERSION
#define TOUCHDECK_VERSION "0.1.0"
#endif
#define TOUCHDECK_FIRMWARE_VERSION TOUCHDECK_VERSION "+" __DATE__ " " __TIME__
WebSocketsClient ws;
WebServer web(80);
Preferences prefs;
DynamicJsonDocument state(16000);
DynamicJsonDocument iconPaths(4096);
DynamicJsonDocument fontPaths(12288);
String fontGroup;
uint32_t fontRevision=0;
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
// Alpha icons are rendered as RGB565 row spans; transparent pixels remain untouched.
void drawIcon(const String &name,int x,int y,int w,int h,uint16_t color,uint16_t background){
 const char *path=iconPaths[name] | "";
 if(!path[0]||!iconFsReady)return;
 File file=LittleFS.open(path,"r");
 if(!file)return;
 if(file.read()!=0x41||file.read()!=96||file.read()!=96||file.size()!=4611){file.close();return;}
 // A 96x96 mask exceeds the remaining loopTask stack on ESP32-C3.
 // Allocate the bitmap in heap instead of the task stack.
 std::unique_ptr<uint8_t[]> bitmap(new (std::nothrow) uint8_t[4608]);
 if(!bitmap){file.close();Serial.println("icon_bitmap_alloc_failed");return;}
 if(file.read(bitmap.get(),4608)!=4608){file.close();return;}
 file.close();
 const int scale=min(w,h);
 if(scale<=0||scale>240)return;
 const int left=x+(w-scale)/2,top=y+(h-scale)/2;
 uint16_t row[240];
 for(int py=0;py<scale;py++){
  const int sy=py*96/scale;
  int runStart=-1;
  for(int px=0;px<=scale;px++){
   uint8_t alpha=0;
   if(px<scale){
    const int sx=px*96/scale,bit=sy*96+sx;
    alpha=(bit&1)?(bitmap[bit>>1]&15):(bitmap[bit>>1]>>4);
   }
   if(alpha){
    if(runStart<0)runStart=px;
    const uint8_t inv=15-alpha;
    const uint16_t red=(((color>>11)*alpha+(background>>11)*inv+7)/15);
    const uint16_t green=(((((color>>5)&63)*alpha+((background>>5)&63)*inv+7)/15));
    const uint16_t blue=(((color&31)*alpha+(background&31)*inv+7)/15);
    row[px]=(red<<11)|(green<<5)|blue;
   }else if(runStart>=0){
    lcd->draw16bitRGBBitmap(left+runStart,top+py,row+runStart,px-runStart,1);
    runStart=-1;
   }
  }
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
  String path="/a96"+sha.substring(0,24)+".bin";
  if(!LittleFS.exists(path)){
   HTTPClient imageHttp;WiFiClient imageNet;
   String imageUrl="http://"+host+":"+String(port)+"/api/icons/alpha/"+name;
   if(!imageHttp.begin(imageNet,imageUrl)){success=false;break;}
   imageHttp.setTimeout(5000);
   int imageCode=imageHttp.GET();
   if(imageCode!=200||(imageHttp.getSize()>=0&&imageHttp.getSize()!=4611)){Serial.printf("icon_mask_http=%d size=%d\\n",imageCode,imageHttp.getSize());imageHttp.end();success=false;break;}
   String tmp=path+".tmp";
   File output=LittleFS.open(tmp,"w");
   if(!output){imageHttp.end();success=false;break;}
   int copied=imageHttp.writeToStream(&output);
   output.close();imageHttp.end();
   if(copied!=4611){LittleFS.remove(tmp);success=false;break;}
   File verify=LittleFS.open(tmp,"r");
   bool valid=verify&&verify.size()==4611&&verify.read()==0x41&&verify.read()==96&&verify.read()==96;
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
  if((path.startsWith("/i")||path.startsWith("/a"))&&path.endsWith(".bin")&&!keep)LittleFS.remove(path);
  file=root.openNextFile();
 }
 root.close();
 Serial.printf("icon_sync_ok group=%s count=%u\\n",group.c_str(),(unsigned)iconPaths.size());
}

uint16_t blendFontColor(uint16_t fg,uint16_t bg,uint8_t alpha){
 if(alpha>=15)return fg;
 uint8_t r=((fg>>11)*alpha+(bg>>11)*(15-alpha)+7)/15;
 uint8_t g=(((fg>>5)&63)*alpha+((bg>>5)&63)*(15-alpha)+7)/15;
 uint8_t b=((fg&31)*alpha+(bg&31)*(15-alpha)+7)/15;
 return (r<<11)|(g<<5)|b;
}
uint32_t nextFontCodepoint(const String &text,unsigned &index){
 const unsigned char c=(unsigned char)text[index++];
 if(c<128)return c;
 int count=(c&0xe0)==0xc0?1:(c&0xf0)==0xe0?2:(c&0xf8)==0xf0?3:0;
 uint32_t cp=c&((1<<(6-count))-1);
 for(int n=0;n<count && index<text.length();n++)cp=(cp<<6)|((unsigned char)text[index++]&63);
 return cp;
}
bool drawFontText(const String &text,int x,int y,int w,int h,uint16_t fg,uint16_t bg,int size){
 if(!fontPaths.is<JsonObject>()||fontPaths.as<JsonObject>().size()==0)return false;
 const int cell=(size*3+2)/5, gh=size+4;
 int count=0;
 for(unsigned i=0;i<text.length();){nextFontCodepoint(text,i);count++;}
 int start=x+max(0,(w-count*cell)/2),top=y+max(0,(h-gh)/2);
 unsigned index=0;
 int pos=0;
 while(index<text.length()&&pos<100){
  uint32_t cp=nextFontCodepoint(text,index);
  String id=String(size)+"-"+String(cp,HEX);
  const char *path=fontPaths[id] | "";
  if(path[0]){
   File file=LittleFS.open(path,"r");
   if(file){
    const int magic=file.read(),gw=file.read(),height=file.read(),advance=file.read();
    const int bytes=(gw*height+1)/2;
    if(magic==0x54&&gw>0&&gw<=32&&height==gh&&bytes<=600&&advance>0){
     uint8_t bitmap[600];
     if(file.read(bitmap,bytes)==bytes){
      for(int py=0;py<height;py++)for(int px=0;px<gw;px++){
       const int dx=start+pos*cell+px,dy=top+py;
       if(dx<x||dx>=x+w||dy<y||dy>=y+h)continue;
       const int pixel=py*gw+px;
       const uint8_t a=(pixel&1)?(bitmap[pixel>>1]&15):(bitmap[pixel>>1]>>4);
       if(a)lcd->drawPixel(dx,dy,blendFontColor(fg,bg,a));
      }
     }
    }
    file.close();
   }
  }
  pos++;
 }
 return true;
}
void syncFonts(const String &group,uint32_t newRevision){
 if(!iconFsReady||group.isEmpty()||(group==fontGroup&&newRevision==fontRevision))return;
 WiFiClient net;HTTPClient http;
 String url="http://"+host+":"+String(port)+"/api/fonts/manifest/"+group;
 if(!http.begin(net,url))return;
 http.setTimeout(7000);
 int code=http.GET();
 if(code!=200){Serial.printf("font_manifest_http=%d\\n",code);http.end();return;}
 String body=http.getString();http.end();
 DynamicJsonDocument manifest(28000);
 DeserializationError err=deserializeJson(manifest,body);
 body=String();
 if(err||!manifest["resources"].is<JsonArray>()){Serial.printf("font_manifest_invalid=%s\\n",err.c_str());return;}
 DynamicJsonDocument nextPaths(12288);
 bool success=true;
 for(JsonVariantConst resource:manifest["resources"].as<JsonArrayConst>()){
  String id=resource["id"]|"",sha=resource["sha256"]|"";
  int expected=resource["bytes"]|0;
  if(id.length()>20||sha.length()!=64||expected<4||expected>2052){success=false;break;}
  String path="/f"+sha.substring(0,24)+".bin";
  if(!LittleFS.exists(path)){
   WiFiClient imageNet;HTTPClient imageHttp;
   String imageUrl="http://"+host+":"+String(port)+"/api/fonts/glyph/"+id;
   if(!imageHttp.begin(imageNet,imageUrl)){success=false;break;}
   imageHttp.setTimeout(5000);
   int status=imageHttp.GET();
   if(status!=200){Serial.printf("font_glyph_http=%d id=%s\\n",status,id.c_str());imageHttp.end();success=false;break;}
   String tmp=path+".tmp";
   File output=LittleFS.open(tmp,"w");
   if(!output){imageHttp.end();success=false;break;}
   int copied=imageHttp.writeToStream(&output);
   output.close();imageHttp.end();
   File verify=LittleFS.open(tmp,"r");
   bool valid=verify&&verify.size()==expected&&verify.read()==0x54;
   verify.close();
   if(copied!=expected||!valid||!LittleFS.rename(tmp,path)){LittleFS.remove(tmp);success=false;break;}
  }
  nextPaths[id]=path;
  if(nextPaths.overflowed()){success=false;break;}
 }
 if(!success){Serial.println("font_sync_incomplete");return;}
 fontPaths.clear();fontPaths.set(nextPaths.as<JsonVariantConst>());
 fontGroup=group;fontRevision=newRevision;
 File root=LittleFS.open("/");File file=root.openNextFile();
 while(file){
  String path=file.name();if(!path.startsWith("/"))path="/"+path;
  file.close();bool keep=false;
  for(JsonPairConst entry:fontPaths.as<JsonObjectConst>())if(path==entry.value().as<String>()){keep=true;break;}
  if(path.startsWith("/f")&&path.endsWith(".bin")&&!keep)LittleFS.remove(path);
  file=root.openNextFile();
 }
 root.close();
 Serial.printf("font_sync_ok group=%s glyphs=%u\\n",group.c_str(),(unsigned)fontPaths.size());
}

// Render frequently updated labels off-screen to avoid per-glyph SPI flicker.
// Reuse a bounded RGB565 buffer; fall back to the legacy path if it cannot fit.
bool drawBufferedLabel(const String &text,int x,int y,int w,int h,uint16_t fg,uint16_t bg,int size,uint16_t pageBg,int radius){
 if(!fontPaths.is<JsonObject>()||fontPaths.as<JsonObject>().size()==0)return false;
 if(w<=0||h<=0||(uint32_t)w*h>12000)return false;
 static uint16_t *pixels=nullptr;
 static size_t capacity=0;
 const size_t needed=(size_t)w*h;
 if(capacity<needed){
  uint16_t *replacement=(uint16_t*)realloc(pixels,needed*sizeof(uint16_t));
  if(!replacement)return false;
  pixels=replacement;capacity=needed;
 }
 for(size_t i=0;i<needed;i++)pixels[i]=pageBg;
 const int r=radius==2?min(w-2,h-2)/2:radius==0?0:4;
 for(int py=1;py<h-1;py++)for(int px=1;px<w-1;px++){
  bool inside=true;
  if(r>0){
   int left=1+r,right=w-2-r,topEdge=1+r,bottom=h-2-r;
   int cornerX=px<left?left:(px>right?right:px);
   int cornerY=py<topEdge?topEdge:(py>bottom?bottom:py);
   int dx=px-cornerX,dy=py-cornerY;
   inside=dx*dx+dy*dy<=r*r;
  }
  if(inside)pixels[py*w+px]=bg;
 }
 const int cell=(size*3+2)/5,gh=size+4;
 int count=0;
 for(unsigned i=0;i<text.length();){nextFontCodepoint(text,i);count++;}
 const int start=max(0,(w-count*cell)/2),top=max(0,(h-gh)/2);
 unsigned index=0;
 int pos=0;
 while(index<text.length()&&pos<100){
  uint32_t cp=nextFontCodepoint(text,index);
  String id=String(size)+"-"+String(cp,HEX);
  const char *path=fontPaths[id] | "";
  if(path[0]){
   File file=LittleFS.open(path,"r");
   if(file){
    const int magic=file.read(),gw=file.read(),height=file.read(),advance=file.read();
    const int bytes=(gw*height+1)/2;
    if(magic==0x54&&gw>0&&gw<=32&&height==gh&&bytes<=600&&advance>0){
     uint8_t bitmap[600];
     if(file.read(bitmap,bytes)==bytes){
      for(int py=0;py<height;py++)for(int px=0;px<gw;px++){
       const int dx=start+pos*cell+px,dy=top+py;
       if(dx<0||dx>=w||dy<0||dy>=h)continue;
       const int pixel=py*gw+px;
       const uint8_t a=(pixel&1)?(bitmap[pixel>>1]&15):(bitmap[pixel>>1]>>4);
       if(a)pixels[dy*w+dx]=blendFontColor(fg,bg,a);
      }
     }
    }
    file.close();
   }
  }
  pos++;
 }
 lcd->draw16bitRGBBitmap(x,y,pixels,w,h);
 return true;
}
// Diagnostic A/B: use the graphics library's built-in bitmap font.
// Set to 0 to restore the custom downloaded glyph renderer.
#define TOUCHDECK_TEST_BUILTIN_FONT 1

void drawComponent(JsonVariantConst component,bool clearArea){
 int x=component["x"]|0,y=component["y"]|0,w=component["w"]|30,h=component["h"]|30;
 if(x<0||y<0||w<4||h<4||x+w>240||y+h>240)return;
 String type=component["type"]|"Label";
 // Only opaque, rectangular, dynamically refreshed labels use the buffer.
 // Preserve legacy transparency and rounded-corner behavior elsewhere.
 if(!TOUCHDECK_TEST_BUILTIN_FONT&&type=="Label"&&clearArea&&!component["backgroundColor"].isNull()){
  String text=component["text"]|"";
  int size=component["fontSize"]|15;
  if(size!=12&&size!=15&&size!=20)size=15;
  const uint16_t foreground=rgb(component["textColor"]|"",WHITE);
  const uint16_t background=rgb(component["backgroundColor"]|"",rgb(state["page"]["backgroundColor"]|"",BLACK));
  if(drawBufferedLabel(text,x,y,w,h,foreground,background,size,rgb(state["page"]["backgroundColor"]|"",BLACK),component["radius"]|1))return;
 }
 if(clearArea)lcd->fillRect(x,y,w,h,rgb(state["page"]["backgroundColor"]|"",BLACK));
 if(!((type=="Label"||type=="Icon") && component["backgroundColor"].isNull())){
  int radius=component["radius"]|1;
  int r=radius==2?min(w-2,h-2)/2:radius==0?0:4;
  uint16_t bg=rgb(component["backgroundColor"]|"",0x3186);
  if(r==0)lcd->fillRect(x+1,y+1,w-2,h-2,bg);
  else lcd->fillRoundRect(x+1,y+1,w-2,h-2,r,bg);
 }
 if(type=="Gauge"||type=="Progress"||type=="Slider"){
  float minimum=component["min"]|0.0f,maximum=component["max"]|100.0f,value=component["value"]|0.0f;
  float ratio=maximum>minimum?constrain((value-minimum)/(maximum-minimum),0.0f,1.0f):0;
  uint16_t color=rgb(component["textColor"]|"",WHITE),track=0x8410;
  String display=component["display"]|"bar",orientation=component["orientation"]|"horizontal";
  if(display=="circle"||display=="arc"){
   int cx=x+w/2,cy=y+h/2,r=max(3,min(w,h)/2-5);
   int start=display=="arc"?135:0,extent=display=="arc"?270:360;
   // Render a continuous annular band with 4x subpixel coverage.
   // Avoid disconnected fillCircle stamps at 3-degree increments.
   const float outer=r+2.5f,inner=max(0.0f,r-2.5f);
   const float progress=extent*ratio;
   const int left=max(0,(int)floorf(cx-outer-1)),right=min(239,(int)ceilf(cx+outer+1));
   const int top=max(0,(int)floorf(cy-outer-1)),bottom=min(239,(int)ceilf(cy+outer+1));
   const uint16_t bg=rgb(component["backgroundColor"]|"",rgb(state["page"]["backgroundColor"]|"",BLACK));
   uint16_t line[240];
   for(int py=top;py<=bottom;py++){
    for(int px=left;px<=right;px++){
     int active=0,inactive=0;
     for(int sy=0;sy<2;sy++)for(int sx=0;sx<2;sx++){
      float dx=px+(sx?0.75f:0.25f)-cx,dy=py+(sy?0.75f:0.25f)-cy;
      float dist2=dx*dx+dy*dy;
      if(dist2<inner*inner||dist2>outer*outer)continue;
      float deg=atan2f(dy,dx)*180.0f/PI+90.0f-start;
      while(deg<0)deg+=360.0f;
      if(deg>=extent)continue;
      if(deg<progress)active++;else inactive++;
     }
     uint16_t target=bg;
     if(active||inactive){
      const int rr=((color>>11)*active+(track>>11)*inactive+(bg>>11)*(4-active-inactive)+2)/4;
      const int gg=(((color>>5)&63)*active+((track>>5)&63)*inactive+((bg>>5)&63)*(4-active-inactive)+2)/4;
      const int bb=((color&31)*active+(track&31)*inactive+(bg&31)*(4-active-inactive)+2)/4;
      target=(rr<<11)|(gg<<5)|bb;
     }
     line[px-left]=target;
    }
    lcd->draw16bitRGBBitmap(left,py,line,right-left+1,1);
   }
  }else if(orientation=="vertical"){
   int bx=x+w/3,bw=max(3,w/3),by=y+4,bh=max(1,h-8),filled=(int)(bh*ratio);
   lcd->fillRect(bx,by,bw,bh,track);
   if(filled>0)lcd->fillRect(bx,by+bh-filled,bw,filled,color);
  }else{
   int bx=x+4,bw=max(1,w-8),by=y+h/3,bh=max(3,h/3),filled=(int)(bw*ratio);
   lcd->fillRect(bx,by,bw,bh,track);
   if(filled>0)lcd->fillRect(bx,by,filled,bh,color);
  }
  return;
 }
 if(type=="IconBar"){
  JsonArrayConst icons=component["icons"].as<JsonArrayConst>();
  int count=icons.size();if(count==0)return;
  for(int i=0;i<count;i++){
   int iw=w/count;
   drawIcon(icons[i].as<String>(),x+i*iw+2,y+2,iw-4,h-4,rgb(component["textColor"]|"",WHITE),rgb(component["backgroundColor"]|"",rgb(state["page"]["backgroundColor"]|"",BLACK)));
  }
  return;
 }
 if(type=="Icon"){
  Serial.printf("icon_render name=%s color=%s bg=%s cached=%d\\n",component["icon"]|"",component["textColor"]|"",component["backgroundColor"]|"transparent",iconPaths.containsKey(component["icon"]|""));
  drawIcon(component["icon"]|"",x+2,y+2,w-4,h-4,rgb(component["textColor"]|"",WHITE),rgb(component["backgroundColor"]|"",rgb(state["page"]["backgroundColor"]|"",BLACK)));
 }
 else {
  String text=component["text"]|"";
  uint16_t foreground=rgb(component["textColor"]|"",WHITE);
  uint16_t background=rgb(component["backgroundColor"]|"",rgb(state["page"]["backgroundColor"]|"",BLACK));
  int size=component["fontSize"]|15;
  if(size!=12&&size!=15&&size!=20)size=15;
  if(TOUCHDECK_TEST_BUILTIN_FONT || !drawFontText(text,x+2,y+2,w-4,h-4,foreground,background,size))
   label(text,x+2,y+2,w-4,h-4,foreground,size>=19?2:1);
 }
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
// OTA is only initiated by the connected TouchDeck server. The manifest
// supplies an exact SHA-256, board identifier and version before any flash write.
void runOta(JsonVariantConst command){
 const String version=command["version"]|"",sha=command["sha256"]|"",board=command["board"]|"";
 const size_t expected=command["size"]|0;
 if(board!="esp32c3"||sha.length()!=64||expected<4096||expected>1310720||version.isEmpty()){
  Serial.println("ota_rejected_manifest");return;
 }
 const String installed=TOUCHDECK_FIRMWARE_VERSION;
 if(installed.startsWith(version+"+")){Serial.println("ota_already_installed");return;}
 WiFiClient net;
 HTTPClient http;
 String url="http://"+host+":"+String(port)+"/api/firmware/esp32c3.bin";
 if(!http.begin(net,url)){Serial.println("ota_http_begin_failed");return;}
 http.setTimeout(15000);
 int code=http.GET();
 if(code!=200||http.getSize()!=(int)expected){
  Serial.printf("ota_download_rejected http=%d bytes=%d\\n",code,http.getSize());http.end();return;
 }
 if(!Update.begin(expected,U_FLASH)){Serial.printf("ota_begin_failed error=%u\\n",Update.getError());http.end();return;}
 mbedtls_sha256_context digest;
 mbedtls_sha256_init(&digest);
 mbedtls_sha256_starts_ret(&digest,0);
 WiFiClient *stream=http.getStreamPtr();
 uint8_t buffer[1024];size_t received=0;
 unsigned long lastData=millis();
 bool failed=false;
 while(received<expected){
  int available=stream->available();
  if(available<=0){
   if(millis()-lastData>15000||!http.connected()){failed=true;break;}
   delay(5);continue;
  }
  size_t count=stream->readBytes(buffer,min((size_t)available,min(sizeof(buffer),expected-received)));
  if(!count){failed=true;break;}
  mbedtls_sha256_update_ret(&digest,buffer,count);
  if(Update.write(buffer,count)!=count){failed=true;break;}
  received+=count;lastData=millis();
  delay(1);
 }
 uint8_t hash[32];mbedtls_sha256_finish_ret(&digest,hash);mbedtls_sha256_free(&digest);
 char actual[65];for(int i=0;i<32;i++)sprintf(actual+i*2,"%02x",hash[i]);actual[64]=0;
 http.end();
 if(failed||received!=expected||sha!=String(actual)){
  Update.abort();Serial.printf("ota_integrity_failed bytes=%u expected=%u hash=%s\\n",(unsigned)received,(unsigned)expected,actual);return;
 }
 if(!Update.end(true)){Serial.printf("ota_commit_failed error=%u\\n",Update.getError());return;}
 Serial.printf("ota_success version=%s reboot\\n",version.c_str());
 delay(200);ESP.restart();
}
void onWs(WStype_t event,uint8_t *payload,size_t len){
 if(event==WStype_DISCONNECTED){wsReady=false;if(!disconnectedAt)disconnectedAt=millis();status("Serveur deconnecte",host+":"+String(port));Serial.printf("ws_disconnected endpoint=%s:%u wifi=%s\n",host.c_str(),port,WiFi.localIP().toString().c_str());return;}
 if(event==WStype_CONNECTED){disconnectedAt=0;wsReady=true;StaticJsonDocument<256> hello;hello["type"]="hello";hello["clientId"]=id;hello["firmwareVersion"]=TOUCHDECK_FIRMWARE_VERSION;hello["deviceType"]="esp32c3";String out;serializeJson(hello,out);ws.sendTXT(out);Serial.printf("ws_connected firmware=%s\n",TOUCHDECK_FIRMWARE_VERSION);return;}
 if(event!=WStype_TEXT||len>22000)return;
 DynamicJsonDocument doc(24000);
 DeserializationError parseError=deserializeJson(doc,payload,len);
 if(parseError){Serial.printf("ws_json_error=%s len=%u\n",parseError.c_str(),(unsigned)len);return;}
 String type=doc["type"]|"";
 if(type=="ota_update"){runOta(doc.as<JsonVariantConst>());return;}
 if(type=="welcome"){
  String group=doc["groupId"]|"";
  currentGroup=group;
  Serial.printf("welcome group=%s\n",group.c_str());
  // Group assignment is server-owned; an unassigned device waits for a page.
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
  syncFonts(currentGroup,revision);
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
    bool numeric=String(component["type"]|"")=="Gauge"||String(component["type"]|"")=="Progress"||String(component["type"]|"")=="Slider";
    bool valueChanged=numeric&&!update["value"].isNull()&&fabsf((component["value"]|0.0f)-(update["value"]|0.0f))>0.001f;
    if(String(component["text"]|"")==nextText&&!valueChanged)break;
    component["text"]=nextText;
    if(valueChanged)component["value"]=update["value"].as<float>();
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
  bool sliderHandled=false;
  if(wsReady&&millis()-started<3000){
   for(JsonVariantConst component:state["page"]["components"].as<JsonArrayConst>()){
    if(String(component["type"]|"")!="Slider"||(component["disabled"]|false))continue;
    int cx=component["x"]|0,cy=component["y"]|0,cw=component["w"]|0,ch=component["h"]|0;
    if(startX<cx||startX>=cx+cw||startY<cy||startY>=cy+ch)continue;
    float minimum=component["min"]|0.0f,maximum=component["max"]|100.0f;
    String orientation=component["orientation"]|"horizontal";
    float ratio=orientation=="vertical"?1.0f-(float)(lastY-cy)/max(1,ch):(float)(lastX-cx)/max(1,cw);
    float value=roundf(minimum+constrain(ratio,0.0f,1.0f)*(maximum-minimum));
    StaticJsonDocument<256> interaction;
    interaction["type"]="interact";interaction["pageId"]=pageId;interaction["pageRevision"]=revision;
    interaction["componentId"]=component["id"]|"";interaction["requestId"]="esp-"+String(millis());interaction["value"]=value;
    String payload;serializeJson(interaction,payload);ws.sendTXT(payload);
    sliderHandled=true;break;
   }
  }
  if(!sliderHandled&&abs(dx)>=35&&millis()-started<1000&&wsReady){
   send("navigate","direction",dx<0?"next":"previous");
   Serial.printf("swipe=%d\n",dx);
  }
  else if(!sliderHandled&&abs(dx)<15&&abs(lastY-startY)<15&&millis()-started<1000&&wsReady){
   for(JsonVariantConst component:state["page"]["components"].as<JsonArrayConst>()){
    String kind=component["type"]|"";
    if((kind!="Button"&&kind!="Toggle"&&kind!="Label"&&kind!="Icon")||(component["disabled"]|false))continue;
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
  bool iconCacheIncomplete=iconPaths.size()==0;
  for(JsonVariantConst component:page["components"].as<JsonArrayConst>()){
   if(String(component["type"]|"")!="Icon")continue;
   const char *path=iconPaths[component["icon"]|""] | "";
   if(!path[0]||!LittleFS.exists(path)){iconCacheIncomplete=true;break;}
  }
  if(iconCacheIncomplete && !page.isNull()){
   // Force a manifest refresh even when the server revision has not changed.
   iconRevision=0;
   syncIcons(currentGroup,revision);
   if(iconPaths.size()>0)draw();
  }
 }
 if(wsStarted&&!wsReady&&disconnectedAt&&millis()-disconnectedAt>90000){
  Serial.println("ws_rediscover");ws.disconnect();wsStarted=false;disconnectedAt=0;
  status("Recherche serveur","mDNS");
 }
 poll();delay(2);
}
