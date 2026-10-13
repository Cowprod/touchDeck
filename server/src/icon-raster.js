// Deterministic monochrome SVG rasterizer for Font Awesome paths.
// Output: 2-byte header (width, height), followed by row-major packed 1-bit mask.
const tokens = d => d.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g) ?? [];
export function rasterSvg(svg, size = 48) {
  if (!Number.isInteger(size) || size < 8 || size > 96) throw Error('invalid_size');
  const vb = /viewBox="([^"]+)"/.exec(svg)?.[1]?.split(/[ ,]+/).map(Number);
  if (!vb || vb.length !== 4 || vb[2] <= 0 || vb[3] <= 0) throw Error('invalid_viewbox');
  const paths = [...svg.matchAll(/<path\b[^>]*\bd="([^"]+)"/g)].map(m => m[1]);
  if (!paths.length) throw Error('missing_path');
  const polygons = [];
  for (const d of paths) {
    const ts = tokens(d); let i=0,cmd='',x=0,y=0,sx=0,sy=0,px=0,py=0,last='',poly=[];
    const n=()=>{if(i>=ts.length||/[a-zA-Z]/.test(ts[i]))throw Error('invalid_path');return Number(ts[i++])};
    const add=(a,b)=>{x=a;y=b;poly.push([x,y])};
    const close=()=>{if(poly.length>2)polygons.push(poly);poly=[];x=sx;y=sy};
    while(i<ts.length){
      if(/[a-zA-Z]/.test(ts[i]))cmd=ts[i++];
      if(!cmd)throw Error('invalid_command');
      const relative=cmd===cmd.toLowerCase(),op=cmd.toUpperCase();
      if(op==='Z'){close();cmd='';last='Z';continue}
      const oldX=x,oldY=y;
      if(op==='M'||op==='L'){const a=n(),b=n();if(op==='M'){close();sx=relative?x+a:a;sy=relative?y+b:b}add(relative?x+a:a,relative?y+b:b);if(op==='M')cmd=relative?'l':'L'}
      else if(op==='H'){const a=n();add(relative?x+a:a,y)}
      else if(op==='V'){const a=n();add(x,relative?y+a:a)}
      else if(op==='C'||op==='S'||op==='Q'||op==='T'){
        let c1x,c1y,c2x,c2y,ex,ey;
        if(op==='C'){const a=n(),b=n(),c=n(),d=n(),e=n(),f=n();c1x=relative?x+a:a;c1y=relative?y+b:b;c2x=relative?x+c:c;c2y=relative?y+d:d;ex=relative?x+e:e;ey=relative?y+f:f}
        else if(op==='S'){const a=n(),b=n(),c=n(),d=n();c1x=['C','S'].includes(last)?2*x-px:x;c1y=['C','S'].includes(last)?2*y-py:y;c2x=relative?x+a:a;c2y=relative?y+b:b;ex=relative?x+c:c;ey=relative?y+d:d}
        else {let qx,qy;if(op==='Q'){const a=n(),b=n();qx=relative?x+a:a;qy=relative?y+b:b}else{qx=['Q','T'].includes(last)?2*x-px:x;qy=['Q','T'].includes(last)?2*y-py:y}const a=n(),b=n();ex=relative?x+a:a;ey=relative?y+b:b;c1x=x+2*(qx-x)/3;c1y=y+2*(qy-y)/3;c2x=ex+2*(qx-ex)/3;c2y=ey+2*(qy-ey)/3;px=qx;py=qy}
        const steps=Math.max(4,Math.min(64,Math.ceil(Math.hypot(ex-x,ey-y)/12)));
        for(let s=1;s<=steps;s++){const t=s/steps,u=1-t;add(u*u*u*oldX+3*u*u*t*c1x+3*u*t*t*c2x+t*t*t*ex,u*u*u*oldY+3*u*u*t*c1y+3*u*t*t*c2y+t*t*t*ey)}
        if(op==='C'||op==='S'){px=c2x;py=c2y}
      }else if(op==='A'){
        let rx=Math.abs(n()),ry=Math.abs(n()),rotation=n()*Math.PI/180,large=n(),sweep=n(),a=n(),b=n();
        const ex=relative?x+a:a,ey=relative?y+b:b;
        if(rx===0||ry===0){add(ex,ey)}
        else{
          const cos=Math.cos(rotation),sin=Math.sin(rotation);
          const dx=(x-ex)/2,dy=(y-ey)/2;
          const x1=cos*dx+sin*dy,y1=-sin*dx+cos*dy;
          const lambda=x1*x1/(rx*rx)+y1*y1/(ry*ry);
          if(lambda>1){const k=Math.sqrt(lambda);rx*=k;ry*=k}
          const factor=(large===sweep?-1:1)*Math.sqrt(Math.max(0,(rx*rx*ry*ry-rx*rx*y1*y1-ry*ry*x1*x1)/(rx*rx*y1*y1+ry*ry*x1*x1)));
          const cx1=factor*rx*y1/ry,cy1=-factor*ry*x1/rx;
          const cx=cos*cx1-sin*cy1+(x+ex)/2,cy=sin*cx1+cos*cy1+(y+ey)/2;
          const angle=(ux,uy,vx,vy)=>Math.atan2(ux*vy-uy*vx,ux*vx+uy*vy);
          const ux=(x1-cx1)/rx,uy=(y1-cy1)/ry,vx=(-x1-cx1)/rx,vy=(-y1-cy1)/ry;
          const start=Math.atan2(uy,ux);let delta=angle(ux,uy,vx,vy);
          if(!sweep&&delta>0)delta-=2*Math.PI;
          if(sweep&&delta<0)delta+=2*Math.PI;
          const steps=Math.max(6,Math.ceil(Math.abs(delta)*Math.max(rx,ry)/12));
          for(let s=1;s<=steps;s++){const t=start+delta*s/steps;add(cx+cos*rx*Math.cos(t)-sin*ry*Math.sin(t),cy+sin*rx*Math.cos(t)+cos*ry*Math.sin(t))}
        }
      }else throw Error('unsupported_svg_command:'+op);
      if(!['C','S','Q','T'].includes(op)){px=x;py=y}
      last=op;
    }
    close();
  }
  const scale=Math.min((size-2)/vb[2],(size-2)/vb[3]),offsetX=(size-vb[2]*scale)/2,offsetY=(size-vb[3]*scale)/2;
  const edges=[];
  for(const polygon of polygons)for(let i=0;i<polygon.length;i++){
    const a=polygon[i],b=polygon[(i+1)%polygon.length];
    edges.push([(a[0]-vb[0])*scale+offsetX,(a[1]-vb[1])*scale+offsetY,(b[0]-vb[0])*scale+offsetX,(b[1]-vb[1])*scale+offsetY]);
  }
  const out=Buffer.alloc(2+Math.ceil(size*size/8));out[0]=size;out[1]=size;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    let winding=0;const px=x+.5,py=y+.5;
    for(const [ax,ay,bx,by] of edges){
      if((ay<=py&&by>py)||(by<=py&&ay>py)){
        const cross=ax+(py-ay)*(bx-ax)/(by-ay);
        if(cross>px)winding+=by>ay?1:-1;
      }
    }
    if(winding!==0){const bit=y*size+x;out[2+(bit>>3)]|=0x80>>(bit&7)}
  }
  return out;
}
