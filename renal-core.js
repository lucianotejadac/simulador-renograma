/* Nucleo compartido de los simuladores renales (DMSA y renograma). Identico en ambos
   repositorios. Lee NM planares y dinamicas sin compresion, dibuja, maneja regiones de interes
   y exporta PNG y proyectos. Todo ocurre en el navegador; ningun dato sale de el. */
'use strict';
const RenalCore=(()=>{
 const text=(d,t)=>(d.string(t)||'').trim();
 const nums=(d,t)=>text(d,t).split('\\').map(Number);
 const seq=(d,t)=>(d.elements[t]?.items||[]).map(i=>i.dataSet);
 function fnv(bytes){let h=0x811c9dc5;for(let i=0;i<bytes.length;i++){h^=bytes[i];h=Math.imul(h,0x01000193)>>>0;}return h.toString(16).padStart(8,'0');}
 function pixels(d){
  const syntax=text(d,'x00020010'),p=d.elements.x7fe00010;
  if(!['1.2.840.10008.1.2','1.2.840.10008.1.2.1','1.2.840.10008.1.2.2'].includes(syntax)||!p||p.encapsulatedPixelData)throw Error('Se requieren píxeles DICOM sin compresión.');
  const rows=d.uint16('x00280010'),cols=d.uint16('x00280011'),frames=Number(text(d,'x00280008')||1),bits=d.uint16('x00280100'),stored=d.uint16('x00280101'),signed=d.uint16('x00280103');
  if(!rows||!cols||!Number.isInteger(frames)||frames<1||![8,16].includes(bits)||!stored||stored>bits||![0,1].includes(signed)||(d.uint16('x00280002')||1)!==1)throw Error('Formato de píxeles no compatible.');
  const count=rows*cols*frames;if(count>64e6||p.length<count*bits/8)throw Error('Datos de píxeles incompletos.');
  const bytes=new Uint8Array(d.byteArray.buffer,d.byteArray.byteOffset+p.dataOffset,p.length);
  const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),out=new Float32Array(count),little=syntax!=='1.2.840.10008.1.2.2',mask=2**stored-1;
  for(let i=0;i<count;i++){let q=(bits===8?v.getUint8(i):v.getUint16(i*2,little))&mask;if(signed&&q>=2**(stored-1))q-=2**stored;out[i]=q;}
  return {rows,cols,frames,data:out,hash:fnv(bytes)};
 }
 function vector(d,tag,n){if(!d.elements[tag])return null;const out=new Uint16Array(n);for(let i=0;i<n;i++)out[i]=d.uint16(tag,i)||0;return out;}
 function codigo(item,tag){const s=seq(item,tag)[0];return s?text(s,'x00080104'):'';}
 /* Lee un archivo NM. Devuelve un objeto plano con los datos que usan los simuladores. */
 async function leer(file){
  const bytes=new Uint8Array(await file.arrayBuffer());
  let d;try{d=dicomParser.parseDicom(bytes);}catch(e){throw Error('No es un archivo DICOM legible.');}
  const modalidad=text(d,'x00080060'),imageType=text(d,'x00080008').split('\\');
  if(modalidad!=='NM')throw Error('No es una imagen de medicina nuclear (modalidad '+(modalidad||'desconocida')+').');
  const px=pixels(d),n=px.frames;
  const detectores=seq(d,'x00540022').map((q,i)=>({indice:i+1,vista:codigo(q,'x00540220'),angulo:Number(text(q,'x00540200')),zoom:nums(q,'x00280031')[0]||1}));
  // NumberOfFramesInPhase es US (entero binario); ActualFrameDuration es IS (texto).
  const fases=seq(d,'x00540032').map(f=>({frames:f.uint16('x00540033')||Number(text(f,'x00540033'))||0,duracionMs:Number(text(f,'x00181242'))||0}));
  const detectorPorFrame=vector(d,'x00540020',n)||Uint16Array.from({length:n},()=>1);
  const fasePorFrame=vector(d,'x00540030',n);
  const ventanas=seq(d,'x00540012').map(w=>{const r=seq(w,'x00540013')[0];return {nombre:text(w,'x00540018'),bajo:r?Number(text(r,'x00540014')):NaN,alto:r?Number(text(r,'x00540015')):NaN};});
  let farmaco='',dosisMBq=0;for(const r of seq(d,'x00540016')){farmaco=farmaco||text(r,'x00180031');dosisMBq=Math.max(dosisMBq,Number(text(r,'x00181074'))||0);}
  const sp=nums(d,'x00280030');
  const tipo=imageType[2]||'',duracionMs=Number(text(d,'x00181242'))||0;
  // Tiempos de cada frame: por detector, sumando la duracion de la fase a la que pertenece.
  const tiempos=new Array(n);const acumulado={};
  for(let i=0;i<n;i++){const det=detectorPorFrame[i]||1;const dur=fases.length&&fasePorFrame?fases[(fasePorFrame[i]||1)-1]?.duracionMs||duracionMs:duracionMs;const t0=acumulado[det]||0;tiempos[i]={inicioMs:t0,duracionMs:dur,detector:det};acumulado[det]=t0+dur;}
  return {
   nombre:file.name,bytes,hash:px.hash,rows:px.rows,cols:px.cols,frames:n,data:px.data,
   modalidad,imageType,tipo,detectores,fases,detectorPorFrame,fasePorFrame,tiempos,ventanas,
   pixelMm:Number.isFinite(sp[0])?sp[0]:NaN,duracionMs,farmaco,dosisMBq,
   fecha:text(d,'x00080020'),hora:text(d,'x00080032')||text(d,'x00080030'),
   paciente:{nombre:text(d,'x00100010'),id:text(d,'x00100020'),edad:text(d,'x00101010'),sexo:text(d,'x00100040')},
   serie:text(d,'x0008103e'),estudio:text(d,'x00081030'),
   frame(i){return this.data.subarray(i*this.rows*this.cols,(i+1)*this.rows*this.cols);}
  };
 }
 /* Suma de frames [desde, hasta) de una dinamica. */
 function sumar(dicom,desde,hasta){const m=dicom.rows*dicom.cols,out=new Float32Array(m);for(let f=Math.max(0,desde);f<Math.min(hasta,dicom.frames);f++){const a=dicom.frame(f);for(let i=0;i<m;i++)out[i]+=a[i];}return out;}
 function maximo(img){let mx=0;for(let i=0;i<img.length;i++)if(img[i]>mx)mx=img[i];return mx;}
 function total(img){let s=0;for(let i=0;i<img.length;i++)s+=img[i];return s;}
 /* Paletas: gris invertido (como las pantallas del equipo), gris y hot iron. */
 const PALETAS={
  grisInv:v=>[255-v,255-v,255-v],gris:v=>[v,v,v],
  hot:v=>[Math.min(255,v*3),Math.max(0,Math.min(255,v*3-255)),Math.max(0,Math.min(255,v*3-510))]
 };
 /* Dibuja img (rows x cols) en canvas, con techo relativo (0..1 del maximo) y paleta. */
 function pintar(canvas,img,rows,cols,op={}){
  const techo=(op.maxRel??1)*(op.max??maximo(img))||1,pal=PALETAS[op.paleta||'grisInv'],piso=(op.minRel??0)*techo;
  if(canvas.width!==cols||canvas.height!==rows){canvas.width=cols;canvas.height=rows;}
  const ctx=canvas.getContext('2d'),id=ctx.createImageData(cols,rows),px=id.data;
  for(let i=0;i<rows*cols;i++){const v=Math.max(0,Math.min(255,Math.round((img[i]-piso)/(techo-piso)*255)));const [r,g,b]=pal(v);px[i*4]=r;px[i*4+1]=g;px[i*4+2]=b;px[i*4+3]=255;}
  ctx.putImageData(id,0,0);return canvas;
 }
 /* Suavizado gaussiano separable, para que los isocontornos sigan el organo y no el ruido. */
 function suavizar(img,rows,cols,sigma=1){
  if(!(sigma>0))return Float32Array.from(img);const r=Math.ceil(3*sigma),k=[];let s=0;for(let i=-r;i<=r;i++){const w=Math.exp(-.5*(i/sigma)**2);k.push(w);s+=w;}for(let i=0;i<k.length;i++)k[i]/=s;
  const tmp=new Float32Array(rows*cols),out=new Float32Array(rows*cols);
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){let v=0;for(let i=-r;i<=r;i++){const xx=Math.min(cols-1,Math.max(0,x+i));v+=img[y*cols+xx]*k[i+r];}tmp[y*cols+x]=v;}
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){let v=0;for(let i=-r;i<=r;i++){const yy=Math.min(rows-1,Math.max(0,y+i));v+=tmp[yy*cols+x]*k[i+r];}out[y*cols+x]=v;}
  return out;
 }
 /* Regiones de interes: mascaras de rows x cols con 0/1. */
 function mascaraPoligono(puntos,rows,cols){
  const m=new Uint8Array(rows*cols);if(puntos.length<3)return m;
  for(let y=0;y<rows;y++){const py=y+.5;const cruces=[];
   for(let i=0,j=puntos.length-1;i<puntos.length;j=i++){const [xi,yi]=puntos[i],[xj,yj]=puntos[j];if((yi>py)!==(yj>py))cruces.push(xi+(py-yi)/(yj-yi)*(xj-xi));}
   cruces.sort((a,b)=>a-b);for(let k=0;k+1<cruces.length;k+=2){const x0=Math.max(0,Math.ceil(cruces[k]-.5)),x1=Math.min(cols-1,Math.floor(cruces[k+1]-.5));for(let x=x0;x<=x1;x++)m[y*cols+x]=1;}}
  return m;
 }
 /* Isocontorno: crece desde la semilla sobre pixeles >= fraccion del maximo local. */
 /* El crecimiento queda limitado a una ventana alrededor del pico local (en pixeles) para que
    un umbral bajo en una imagen con mucho fondo no se derrame por todo el campo. Devuelve la
    mascara; `isocontorno.derramado` indica si toco el borde de la ventana. */
 function isocontorno(img,rows,cols,sx,sy,fraccion=.5,radioPico=6,ventana=40){
  sx=Math.round(sx);sy=Math.round(sy);const m=new Uint8Array(rows*cols);isocontorno.derramado=false;if(sx<0||sy<0||sx>=cols||sy>=rows)return m;
  let pico=0,mejor=sy*cols+sx;for(let y=Math.max(0,sy-radioPico);y<=Math.min(rows-1,sy+radioPico);y++)for(let x=Math.max(0,sx-radioPico);x<=Math.min(cols-1,sx+radioPico);x++){const v=img[y*cols+x];if(v>pico){pico=v;mejor=y*cols+x;}}
  const umbral=fraccion*pico;if(!(pico>0))return m;
  const inicio=img[sy*cols+sx]>=umbral?sy*cols+sx:mejor;const px=inicio%cols,py=(inicio-px)/cols;
  const x0=Math.max(0,px-ventana),x1=Math.min(cols-1,px+ventana),y0=Math.max(0,py-ventana),y1=Math.min(rows-1,py+ventana);
  // Solo cuenta como derrame tocar un borde de la ventana que cae dentro de la imagen: un organo
  // pegado al borde del campo no es un derrame.
  const bx0=px-ventana>0,bx1=px+ventana<cols-1,by0=py-ventana>0,by1=py+ventana<rows-1;
  const cola=[inicio];m[inicio]=1;let borde=0;
  while(cola.length){const i=cola.pop();const x=i%cols,y=(i-x)/cols;if((bx0&&x===x0)||(bx1&&x===x1)||(by0&&y===y0)||(by1&&y===y1))borde++;
   for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy;if(nx<x0||ny<y0||nx>x1||ny>y1)continue;const j=ny*cols+nx;if(!m[j]&&img[j]>=umbral){m[j]=1;cola.push(j);}}}
  isocontorno.derramado=borde>8;
  return m;
 }
 function dilatar(m,rows,cols,veces=1){let a=m;for(let k=0;k<veces;k++){const b=new Uint8Array(a);for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){if(!a[y*cols+x])continue;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy;if(nx>=0&&ny>=0&&nx<cols&&ny<rows)b[ny*cols+nx]=1;}}a=b;}return a;}
 function centroide(m,rows,cols){let sx=0,sy=0,n=0;for(let i=0;i<m.length;i++)if(m[i]){const x=i%cols;sx+=x;sy+=(i-x)/cols;n++;}return n?{x:sx/n,y:sy/n,n}:null;}
 /* Fondo perirrenal: anillo entre dos dilataciones, solo por el lado lateral del rinon. */
 function fondoPerirrenal(mRinon,rows,cols,op={}){
  const c=centroide(mRinon,rows,cols);const out=new Uint8Array(rows*cols);if(!c)return out;
  const interior=dilatar(mRinon,rows,cols,op.desde??4),exterior=dilatar(mRinon,rows,cols,op.hasta??8);
  const lateral=c.x<cols/2?-1:1;// hacia afuera del cuerpo
  for(let i=0;i<out.length;i++){if(!exterior[i]||interior[i])continue;const x=i%cols,y=(i-x)/cols;if(op.todo||(x-c.x)*lateral>0||y>c.y+(op.inferior??0.25)*Math.sqrt(c.n))out[i]=1;}
  return out;
 }
 /* Fondo perirrenal robusto para matrices chicas: anillo alrededor del rinon dividido en sectores
    angulares; se conservan los `elegir` sectores de menor actividad en `img`, para no caer sobre
    higado, bazo o vasos. Devuelve la mascara del fondo. */
 function fondoSectores(mRinon,img,rows,cols,op={}){
  const c=centroide(mRinon,rows,cols);const out=new Uint8Array(rows*cols);if(!c)return out;
  const interior=dilatar(mRinon,rows,cols,op.desde??1),exterior=dilatar(mRinon,rows,cols,op.hasta??3);const n=op.sectores??8;
  const suma=new Float64Array(n),cuenta=new Uint32Array(n),sector=new Int8Array(rows*cols).fill(-1);
  for(let i=0;i<out.length;i++){if(!exterior[i]||interior[i])continue;const x=i%cols,y=(i-x)/cols;const a=Math.atan2(y-c.y,x-c.x);const k=Math.min(n-1,Math.floor((a+Math.PI)/(2*Math.PI)*n));sector[i]=k;suma[k]+=img[i];cuenta[k]++;}
  const orden=[...Array(n).keys()].filter(k=>cuenta[k]>=3).sort((a,b)=>suma[a]/cuenta[a]-suma[b]/cuenta[b]).slice(0,op.elegir??2);
  for(let i=0;i<out.length;i++)if(sector[i]>=0&&orden.includes(sector[i]))out[i]=1;
  return out;
 }
 function espejar(m,rows,cols){const out=new Uint8Array(m.length);for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)out[y*cols+x]=m[y*cols+(cols-1-x)];return out;}
 function cuentas(img,m){let s=0,n=0;for(let i=0;i<m.length;i++)if(m[i]){s+=img[i];n++;}return {suma:s,pixeles:n};}
 /* Contorno de una mascara sobre un contexto ya escalado (1 unidad = 1 pixel). */
 function contorno(ctx,m,rows,cols,color,grosor=1.5){
  ctx.save();ctx.strokeStyle=color;ctx.lineWidth=grosor/ (ctx.getTransform().a||1);ctx.beginPath();
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const i=y*cols+x;if(!m[i])continue;
   if(x===0||!m[i-1]){ctx.moveTo(x,y);ctx.lineTo(x,y+1);}if(x===cols-1||!m[i+1]){ctx.moveTo(x+1,y);ctx.lineTo(x+1,y+1);}
   if(y===0||!m[i-cols]){ctx.moveTo(x,y);ctx.lineTo(x+1,y);}if(y===rows-1||!m[i+cols]){ctx.moveTo(x,y+1);ctx.lineTo(x+1,y+1);}}
  ctx.stroke();ctx.restore();
 }
 /* Utilidades de exportacion. */
 function lienzo(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
 function descargar(blob,nombre){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=nombre;document.body.append(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},2000);}
 function canvasABlob(c){return new Promise(r=>c.toBlob(r,'image/png'));}
 function base64(bytes){let s='';for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode.apply(null,bytes.subarray(i,i+0x8000));return btoa(s);}
 function desdeBase64(s){const b=atob(s),out=new Uint8Array(b.length);for(let i=0;i<b.length;i++)out[i]=b.charCodeAt(i);return out;}
 function limpiarNombre(s){return String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^A-Za-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'');}
 /* Proyecto: JSON con los DICOM en base64 mas el estado que entregue la aplicacion. */
 function guardarProyecto(app,estado,dicoms,nombre){
  const obj={formato:'renalproject',version:1,app,fecha:new Date().toISOString(),estado,archivos:dicoms.map(d=>({nombre:d.nombre,base64:base64(d.bytes)}))};
  descargar(new Blob([JSON.stringify(obj)],{type:'application/json'}),nombre);
 }
 async function abrirProyecto(file){
  const obj=JSON.parse(await file.text());if(obj.formato!=='renalproject')throw Error('No es un proyecto de los simuladores renales.');
  obj.files=obj.archivos.map(a=>new File([desdeBase64(a.base64)],a.nombre));return obj;
 }
 function mascaraABase64(m){return base64(m);}
 function mascaraDesdeBase64(s){return desdeBase64(s);}
 function fmt(n,dec=1){return Number.isFinite(n)?n.toLocaleString('es-CL',{minimumFractionDigits:dec,maximumFractionDigits:dec}):'—';}
 function fnvTexto(texto){return fnv(new TextEncoder().encode(String(texto||'')));}
 return {leer,sumar,maximo,total,pintar,PALETAS,suavizar,mascaraPoligono,isocontorno,dilatar,centroide,fondoPerirrenal,fondoSectores,espejar,cuentas,contorno,lienzo,descargar,canvasABlob,base64,desdeBase64,limpiarNombre,guardarProyecto,abrirProyecto,mascaraABase64,mascaraDesdeBase64,fmt,fnv,fnvTexto};
})();
