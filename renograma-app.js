/* Simulador de renograma: carga de la dinamica y la postmiccional, fases y mosaicos, regiones,
   curvas de actividad-tiempo y parametros, exportacion PNG y proyecto. Todo local. */
'use strict';
(()=>{
const $=id=>document.getElementById(id),C=RenalCore;
const COLORES={izq:'#e00000',der:'#00a000',fondoIzq:'#d8d800',fondoDer:'#0000d0',aorta:'#c000c0'};
const E=3; // escala del lienzo de regiones (128 -> 384)
const SIGMA_ISO=1;
const S={caso:null,archivos:[],ignorados:[],seleccion:null,paleta:'grisInv',techo:1,infoVista:new Set(),
 angioSeg:1,excrMin:.25,rois:{},herramienta:'iso',objetivo:'izq',umbral:.4,poligono:[],
 furosemidaMin:20,ventana:[1,2.5],restarFondo:true,porSegundo:true,confirmado:false,
 exportados:{angio:false,excr:false,curvas:false},proyectoGuardado:false,paso:0,mosaicosVistos:false};
let tutorial=null,lienzoRoi=null;
function estado(msg){$('status').textContent=msg;}
/* ---------- archivos ---------- */
function reconocido(d){return d.rec&&(S.caso===null||d.rec.caso===S.caso);}
function archivoRol(rol){return S.archivos.find(d=>d.rec&&d.rec.rol===rol&&(S.caso===null||d.rec.caso===S.caso))||null;}
function dinamica(){return archivoRol('dinamica')||S.archivos.find(d=>d.tipo==='DYNAMIC'&&Math.abs(((d.detectores[0]?.angulo||0)+360)%360)<1)||S.archivos.find(d=>d.tipo==='DYNAMIC')||null;}
function postmiccional(){return archivoRol('postmiccional')||S.archivos.find(d=>d.tipo==='STATIC')||null;}
async function cargar(files){
 let nuevos=0;
 for(const f of files){
  if(/\.(png|pdf|txt|zip|docx?)$/i.test(f.name)){S.ignorados.push(f.name+' (no es DICOM)');continue;}
  try{const d=await C.leer(f);
   if(S.archivos.some(x=>x.hash===d.hash)){S.ignorados.push(f.name+' (copia repetida de un archivo ya cargado)');continue;}
   d.rec=renoReconocer(d.hash);S.archivos.push(d);nuevos++;
  }catch(e){S.ignorados.push(f.name+' ('+e.message+')');}
 }
 if(S.caso===null){const r=S.archivos.find(d=>d.rec);if(r&&tutorial)tutorial.setCaso(r.rec.caso);}
 sumas.clear();estado(nuevos?nuevos+' archivo(s) cargado(s).':'No se cargó ningún archivo nuevo.');refrescar();
}
function faltantes(){return ['dinamica','postmiccional'].filter(r=>!archivoRol(r));}
function problemasCarga(){
 const p=[];
 for(const d of S.archivos){
  if(!d.rec)p.push('«'+d.nombre+'» no pertenece a ningún caso de este curso. Revisa que sea de tu carpeta.');
  else if(S.caso!==null&&d.rec.caso!==S.caso)p.push('«'+d.nombre+'» es del caso '+d.rec.caso+', no del caso '+S.caso+'.');
 }
 const f=faltantes();if(S.archivos.length&&f.length)p.push('Falta: '+f.map(r=>RENO_ROLES[r]).join('; ')+'.');
 return p;
}
function descripcion(d){
 if(d.tipo==='DYNAMIC')return 'Dinámica · '+d.frames+' frames · detector a '+C.fmt(d.detectores[0]?.angulo||0,0)+'° ('+(Math.abs(((d.detectores[0]?.angulo||0)+360)%360)<1?'posterior':'anterior')+')';
 return 'Estática · '+d.detectores.map(x=>x.vista||('detector '+x.indice)).join(' + ');
}
function listar(){
 const ul=$('listaArchivos');ul.replaceChildren();
 for(const d of S.archivos){
  const li=document.createElement('li');li.className=reconocido(d)?'ok':'problema';
  li.append(Object.assign(document.createElement('strong'),{textContent:d.nombre}));
  li.append(Object.assign(document.createElement('span'),{textContent:descripcion(d)}));
  li.append(Object.assign(document.createElement('span'),{textContent:d.rows+'×'+d.cols+' · píxel '+C.fmt(d.pixelMm,1)+' mm'}));
  const est=document.createElement('span');est.className='estado';est.textContent=d.rec?'Caso '+d.rec.caso+' · '+RENO_ROLES[d.rec.rol]:'archivo desconocido';li.append(est);
  li.tabIndex=0;li.onclick=()=>{S.seleccion=d;if(d.rec)S.infoVista.add(d.rec.rol);refrescar();};li.onkeydown=e=>{if(e.key==='Enter')li.onclick();};
  if(S.seleccion===d)li.style.outline='2px solid #000080';ul.append(li);
 }
 const info=[];if(S.archivos.length)info.push(S.archivos.length+' archivo(s) DICOM.');if(S.ignorados.length)info.push('Omitidos: '+S.ignorados.join('; ')+'.');
 $('cargaInfo').textContent=info.join(' ')||'Aún no hay archivos.';
 $('infoAdquisicion').hidden=!S.seleccion;if(S.seleccion)tablaInfo(S.seleccion);
}
function tablaInfo(d){
 const total=C.total(d.data);const vacios=[];for(let i=0;i<d.frames;i++)if(C.total(d.frame(i))===0)vacios.push(i);
 const filas=[['Tipo de imagen',d.imageType.join(' / ')],['Matriz',d.cols+' × '+d.rows+' píxeles · '+d.frames+' frames'],['Píxel',C.fmt(d.pixelMm,2)+' mm · campo '+C.fmt(d.pixelMm*d.cols/10,1)+' cm · zoom '+C.fmt(d.detectores[0]?.zoom||1,2)],
  ['Detectores',d.detectores.map(x=>'detector '+x.indice+(x.vista?' «'+x.vista+'»':'')+' a '+C.fmt(x.angulo,0)+'°').join(' · ')],
  ['Fases',d.fases.length?d.fases.map((f,i)=>'fase '+(i+1)+': '+f.frames+' frames de '+Math.round(f.duracionMs/1000)+' s ('+f.duracionMs+' ms) = '+C.fmt(f.frames*f.duracionMs/60000,1)+' min').join(' · ')+' · total '+C.fmt(d.fases.reduce((a,f)=>a+f.frames*f.duracionMs,0)/60000,1)+' min':'sin fases · duración '+Math.round(d.duracionMs/1000)+' s'],
  ['Frames vacíos',vacios.length?vacios.length+' (desde el frame '+(vacios[0]+1)+': la adquisición se interrumpió a los '+C.fmt((d.tiempos[vacios[0]].inicioMs)/60000,1)+' min)':'ninguno'],
  ['Cuentas totales',Math.round(total/1000)+' k'],
  ['Ventana energética',d.ventanas.map(w=>(w.nombre||'')+' '+C.fmt(w.bajo,1)+'–'+C.fmt(w.alto,1)+' keV').join('; ')||'no consta'],
  ['Radiofármaco',(d.farmaco||'no consta en el DICOM')+(d.dosisMBq?' · '+C.fmt(d.dosisMBq,1)+' MBq ('+C.fmt(d.dosisMBq/37,1)+' mCi)':' · dosis no registrada')],
  ['Fecha y hora',d.fecha.replace(/(\d{4})(\d{2})(\d{2})/,'$3-$2-$1')+' '+d.hora.replace(/(\d{2})(\d{2})(\d{2}).*/,'$1:$2:$3')],
  ['Paciente',d.paciente.nombre+(d.paciente.edad?' · '+d.paciente.edad:'')+(d.paciente.sexo?' · '+d.paciente.sexo:'')],['Identificación del caso',d.rec?'Caso '+d.rec.caso+' · '+RENO_ROLES[d.rec.rol]:'no reconocido']];
 const t=document.createElement('table');t.className='tabla';filas.forEach(([k,v])=>{const tr=document.createElement('tr');const th=document.createElement('td');th.textContent=k;const td=document.createElement('td');td.style.textAlign='left';td.textContent=v;tr.append(th,td);t.append(tr);});
 $('infoTabla').replaceChildren(t);
}
/* ---------- tiempos y sumas ---------- */
const sumas=new Map();
function framesEntre(d,t0s,t1s){const out=[];for(let i=0;i<d.frames;i++){const t=d.tiempos[i];if(t.inicioMs>=t0s*1000-1&&t.inicioMs+t.duracionMs<=t1s*1000+1)out.push(i);}return out;}
function sumaEntre(d,t0s,t1s){const k=d.hash+':'+t0s+':'+t1s;if(!sumas.has(k)){const fr=framesEntre(d,t0s,t1s);const m=d.rows*d.cols,out=new Float32Array(m);for(const i of fr){const a=d.frame(i);for(let j=0;j<m;j++)out[j]+=a[j];}sumas.set(k,{img:out,frames:fr});}return sumas.get(k);}
function ultimoConDatos(d){let u=-1;for(let i=0;i<d.frames;i++)if(C.total(d.frame(i))>0)u=i;return u;}
function finDatosS(d){const u=ultimoConDatos(d);return u<0?0:(d.tiempos[u].inicioMs+d.tiempos[u].duracionMs)/1000;}
function etiquetaTiempo(s){return s<300?Math.round(s)+' s':C.fmt(s/60,s%60?1:0)+' min';}
/* ---------- fases y mosaicos ---------- */
function tablaFases(){
 const d=dinamica(),host=$('tablaFases');if(!d){host.replaceChildren();return;}
 const t=document.createElement('table');t.className='tabla fases';
 const fila=(c,th)=>{const tr=document.createElement('tr');c.forEach((x,i)=>{const td=document.createElement(th?'th':'td');td.textContent=x;if(!th&&i===0)td.style.textAlign='left';tr.append(td);});t.append(tr);};
 fila(['Fase','Frames','Duración por frame','Duración de la fase','Intervalo'],true);let acum=0;
 d.fases.forEach((f,i)=>{fila(['Fase '+(i+1),f.frames,(f.duracionMs/1000)+' s',C.fmt(f.frames*f.duracionMs/60000,1)+' min',etiquetaTiempo(acum/1000)+' → '+etiquetaTiempo((acum+f.frames*f.duracionMs)/1000)]);acum+=f.frames*f.duracionMs;});
 const fin=finDatosS(d);if(fin<acum/1000-1)fila(['Datos reales',ultimoConDatos(d)+1,'','',etiquetaTiempo(0)+' → '+etiquetaTiempo(fin)+' (interrumpido)']);
 host.replaceChildren(t);
}
/* Frames de la dinamica que pertenecen a cada fase, en orden. Si no hay fases, todo es una. */
function framesFase(d,k){const out=[];for(let i=0;i<d.frames;i++){const f=d.fasePorFrame?d.fasePorFrame[i]-1:0;if(f===k)out.push(i);}return out;}
/* Agrupa los frames de una fase de a `porGrupo` y devuelve [{frames, inicioS, finS, img}]. Los grupos
   se arman por indice de frame, no por reloj: los frames duran 1002 o 15002 ms y el reloj deriva. */
function gruposFase(d,k,porGrupo){
 const fr=framesFase(d,k),out=[];porGrupo=Math.max(1,Math.round(porGrupo));
 for(let i=0;i<fr.length;i+=porGrupo){const idx=fr.slice(i,i+porGrupo);const key=d.hash+':g:'+idx[0]+':'+idx.length;
  if(!sumas.has(key)){const m=d.rows*d.cols,img=new Float32Array(m);for(const j of idx){const a=d.frame(j);for(let q=0;q<m;q++)img[q]+=a[q];}sumas.set(key,img);}
  const t0=d.tiempos[idx[0]],t1=d.tiempos[idx[idx.length-1]];out.push({frames:idx,inicioS:t0.inicioMs/1000,finS:(t1.inicioMs+t1.duracionMs)/1000,img:sumas.get(key)});}
 return out;
}
function mosaico(host,grupos,d,op={}){
 host.replaceChildren();let mx=0;for(const g of grupos)mx=Math.max(mx,C.maximo(g.img));
 grupos.forEach(g=>{const fig=document.createElement('figure');const cv=document.createElement('canvas');const vacio=C.total(g.img)===0;
  C.pintar(cv,g.img,d.rows,d.cols,{paleta:S.paleta,max:mx||1,maxRel:S.techo});const cap=document.createElement('figcaption');cap.textContent=etiquetaTiempo(Math.round(g.inicioS))+(vacio?' · sin datos':'');
  if(vacio)fig.classList.add('vacio');if(op.furosemida!==undefined&&op.furosemida*60>=Math.round(g.inicioS)&&op.furosemida*60<Math.round(g.finS)){fig.classList.add('furosemida');cap.textContent+=' · FUROSEMIDA';}
  fig.append(cv,cap);host.append(fig);});
 return {grupos,mx};
}
function durFase(d,k){return d.fases[k]?d.fases[k].duracionMs/1000:(d.duracionMs/1000||1);}
function gruposAngio(d){return gruposFase(d,0,S.angioSeg/durFase(d,0));}
function gruposExcr(d){return gruposFase(d,d.fases.length>1?1:0,S.excrMin*60/durFase(d,d.fases.length>1?1:0));}
function construirMosaicos(){
 const d=dinamica();if(!d){$('mosaicoAngio').replaceChildren();$('mosaicoExcr').replaceChildren();$('postmiccional').replaceChildren();return;}
 tablaFases();
 const a=mosaico($('mosaicoAngio'),gruposAngio(d),d);$('angioTitulo').textContent=a.grupos.length+' imágenes de '+S.angioSeg+' s';
 const ex=mosaico($('mosaicoExcr'),gruposExcr(d),d,{furosemida:S.furosemidaMin});$('excrTitulo').textContent=ex.grupos.length+' imágenes de '+etiquetaTiempo(S.excrMin*60)+(S.furosemidaMin>0?' · furosemida marcada en el minuto '+S.furosemidaMin:' · furosemida a tiempo 0');
 const pm=postmiccional(),host=$('postmiccional');host.replaceChildren();
 if(pm){pm.detectores.forEach((det,i)=>{const sec=document.createElement('section');sec.className='imagewindow';const h=document.createElement('h2');h.append(Object.assign(document.createElement('b'),{textContent:'Postmiccional · '+(det.vista||('detector '+det.indice))}));h.append(Object.assign(document.createElement('span'),{textContent:Math.round(pm.duracionMs/1000)+' s · '+Math.round(C.total(pm.frame(i))/1000)+' k cuentas'}));const cv=document.createElement('canvas');C.pintar(cv,pm.frame(i),pm.rows,pm.cols,{paleta:S.paleta,maxRel:S.techo});sec.append(h,cv);host.append(sec);});}
 if(S.paso===1)S.mosaicosVistos=true;
}
/* ---------- regiones ---------- */
function imagenRoi(){const d=dinamica();if(!d)return null;const s=sumaEntre(d,59.5,181);return {d,img:s.img,frames:s.frames};}
let suaveCache=null;
function suave(v){if(!suaveCache||suaveCache.k!==v.d.hash)suaveCache={k:v.d.hash,img:C.suavizar(v.img,v.d.rows,v.d.cols,SIGMA_ISO)};return suaveCache.img;}
function construirRoi(){
 const host=$('roiArea');host.replaceChildren();lienzoRoi=null;const v=imagenRoi();if(!v)return;
 const sec=document.createElement('section');sec.className='imagewindow seleccionada';const h=document.createElement('h2');h.append(Object.assign(document.createElement('b'),{textContent:'Suma de los minutos 1 a 3 · posterior'}));const det=document.createElement('span');h.append(det);
 const cv=document.createElement('canvas');cv.className='lienzoRoi';cv.width=v.d.cols*E;cv.height=v.d.rows*E;sec.append(h,cv);host.append(sec);lienzoRoi={canvas:cv,detalle:det};
 cv.onclick=e=>{const p=coord(cv,e,v.d);clicRoi(p,v);};cv.ondblclick=e=>{e.preventDefault();if(S.herramienta==='poli'&&S.poligono.length>=3)cerrarPoligono();};
 const pm=postmiccional();if(pm){const s2=document.createElement('section');s2.className='imagewindow';const h2=document.createElement('h2');h2.append(Object.assign(document.createElement('b'),{textContent:'Referencia · postmiccional posterior'}));const c2=document.createElement('canvas');const i=pm.detectores.findIndex(x=>/POST/i.test(x.vista||'')&&!/ANT/i.test(x.vista||''));C.pintar(c2,pm.frame(i>=0?i:pm.frames-1),pm.rows,pm.cols,{paleta:S.paleta,maxRel:S.techo});s2.append(h2,c2);host.append(s2);}
 dibujarRoi();
}
function coord(canvas,e,d){const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width*d.cols,y:(e.clientY-r.top)/r.height*d.rows};}
function dibujarRoi(){
 const v=imagenRoi();if(!v||!lienzoRoi)return;const {d,img}=v;const base=C.lienzo(d.cols,d.rows);C.pintar(base,img,d.rows,d.cols,{paleta:S.paleta,maxRel:S.techo});
 const cv=lienzoRoi.canvas,ctx=cv.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(base,0,0,cv.width,cv.height);ctx.save();ctx.scale(E,E);
 for(const k of ['fondoIzq','fondoDer','izq','der','aorta']){if(!S.rois[k])continue;C.contorno(ctx,S.rois[k],d.rows,d.cols,COLORES[k],2);const c=C.centroide(S.rois[k],d.rows,d.cols);if(c&&k!=='fondoIzq'&&k!=='fondoDer'){ctx.save();ctx.font='4.5px Tahoma, Arial';ctx.fillStyle=COLORES[k];ctx.textAlign='center';ctx.fillText(k==='izq'?'Riñón izquierdo':k==='der'?'Riñón derecho':'Aorta',c.x,Math.max(4,c.y-Math.sqrt(c.n)/1.5));ctx.restore();}}
 if(S.poligono.length){ctx.strokeStyle=COLORES[S.objetivo];ctx.lineWidth=.6;ctx.setLineDash([1.5,1.5]);ctx.beginPath();S.poligono.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();ctx.setLineDash([]);S.poligono.forEach(([x,y])=>{ctx.fillStyle=COLORES[S.objetivo];ctx.fillRect(x-.7,y-.7,1.4,1.4);});}
 ctx.restore();
 const r=resultado();lienzoRoi.detalle.textContent=r?'Función diferencial: izq '+C.fmt(r.funcion.izq,1)+' % · der '+C.fmt(r.funcion.der,1)+' %':'faltan regiones';
}
function clicRoi(p,v){
 const {d,img}=v;const fondoDe={izq:'fondoIzq',der:'fondoDer'};
 if(S.herramienta==='iso'){const ventana=Math.round(150/(d.pixelMm||3.3));const m=C.isocontorno(suave(v),d.rows,d.cols,p.x,p.y,S.umbral,4,S.objetivo==='aorta'?Math.round(40/(d.pixelMm||3.3)):ventana);const n=C.cuentas(img,m).pixeles;
  if(!n){estado('El isocontorno quedó vacío: haz clic dentro de la estructura o baja el umbral.');return;}
  S.rois[S.objetivo]=m;if(fondoDe[S.objetivo])S.rois[fondoDe[S.objetivo]]=fondoDe_(m,v);S.confirmado=false;
  estado(C.isocontorno.derramado?'El isocontorno se derramó hasta el borde de su ventana: sube el umbral o usa polígono.':'Isocontorno: '+n+' píxeles.'+(fondoDe[S.objetivo]?' El fondo perirrenal se generó solo.':''));refrescar();return;}
 if(S.herramienta==='poli'){S.poligono.push([p.x,p.y]);$('cerrarPoli').disabled=S.poligono.length<3;dibujarRoi();estado(S.poligono.length+' vértice(s). Doble clic o «Cerrar polígono» para terminar.');}
}
/* Fondo perirrenal: anillo de 1 a 3 pixeles dividido en 8 sectores; quedan los 2 de menor actividad
   en la suma 1-3 min. A 3,3 mm de pixel un anillo completo cae sobre higado o bazo y resta de mas. */
function fondoDe_(m,v){return C.fondoSectores(m,v.img,v.d.rows,v.d.cols,{desde:1,hasta:3,sectores:8,elegir:2});}
function cerrarPoligono(){const v=imagenRoi();if(!v||S.poligono.length<3)return;const m=C.mascaraPoligono(S.poligono,v.d.rows,v.d.cols);S.rois[S.objetivo]=m;if(S.objetivo==='izq'||S.objetivo==='der')S.rois[S.objetivo==='izq'?'fondoIzq':'fondoDer']=fondoDe_(m,v);S.poligono=[];S.confirmado=false;$('cerrarPoli').disabled=true;estado('Polígono cerrado: '+C.cuentas(v.img,m).pixeles+' píxeles.');refrescar();}
function fondoAutomatico(){const v=imagenRoi();if(!v)return;for(const k of ['izq','der'])if(S.rois[k])S.rois[k==='izq'?'fondoIzq':'fondoDer']=fondoDe_(S.rois[k],v);S.confirmado=false;refrescar();}
function ladoOk(k,m){const v=imagenRoi();if(!v||!m)return true;const c=C.centroide(m,v.d.rows,v.d.cols);if(!c)return true;return (k==='izq')===(c.x<v.d.cols/2);}
function problemasRoi(){
 const p=[],v=imagenRoi();if(!v)return ['Falta la dinámica.'];
 for(const k of ['izq','der']){const nombre=k==='izq'?'izquierdo':'derecho';if(!S.rois[k]){p.push('Falta el ROI del riñón '+nombre+'.');continue;}
  if(!ladoOk(k,S.rois[k]))p.push('El ROI «'+nombre+'» está en el lado de la imagen del otro riñón. La dinámica es posterior: la izquierda del paciente queda a la izquierda de la imagen.');
  const n=C.cuentas(v.img,S.rois[k]).pixeles;if(n<4)p.push('El ROI del riñón '+nombre+' tiene solo '+n+' píxeles.');
  const maxPx=Math.round(150/(v.d.pixelMm*v.d.pixelMm/100));if(n>maxPx)p.push('El ROI del riñón '+nombre+' tiene '+n+' píxeles, unos '+Math.round(n*v.d.pixelMm*v.d.pixelMm/100)+' cm²: se derramó por el fondo. Sube el umbral o usa polígono.');
  if(!S.rois[k==='izq'?'fondoIzq':'fondoDer'])p.push('Falta el fondo del riñón '+nombre+'.');}
 if(S.rois.izq&&S.rois.der){let sol=0;for(let i=0;i<S.rois.izq.length;i++)if(S.rois.izq[i]&&S.rois.der[i])sol++;if(sol)p.push('Los dos ROI renales se superponen en '+sol+' píxeles.');}
 return p;
}
/* ---------- curvas y parametros ---------- */
function curvas(){
 const d=dinamica();if(!d||!S.rois.izq||!S.rois.der)return null;
 const u=ultimoConDatos(d);if(u<0)return null;const n=u+1;
 const series={izq:[],der:[],fondoIzq:[],fondoDer:[],aorta:[]},t=[],dur=[];
 const px={izq:C.cuentas(d.frame(0),S.rois.izq).pixeles,der:C.cuentas(d.frame(0),S.rois.der).pixeles};
 for(let i=0;i<n;i++){const fr=d.frame(i),ti=d.tiempos[i];const durS=ti.duracionMs/1000;t.push((ti.inicioMs+ti.duracionMs/2)/1000);dur.push(durS);
  for(const k of ['izq','der']){const bruto=C.cuentas(fr,S.rois[k]).suma;const f=S.rois[k==='izq'?'fondoIzq':'fondoDer'];let fondo=0;if(f){const q=C.cuentas(fr,f);fondo=q.pixeles?q.suma/q.pixeles*px[k]:0;}
   series[k==='izq'?'fondoIzq':'fondoDer'].push(fondo/(S.porSegundo?durS:1));series[k].push(Math.max(0,bruto-(S.restarFondo?fondo:0))/(S.porSegundo?durS:1));}
  series.aorta.push(S.rois.aorta?C.cuentas(fr,S.rois.aorta).suma/(S.porSegundo?durS:1):NaN);}
 return {t,dur,series,n,finS:finDatosS(d),completo:n===d.frames};
}
function suavizarSerie(a,w=3){const out=a.slice();for(let i=0;i<a.length;i++){let s=0,c=0;for(let j=-w;j<=w;j++)if(a[i+j]!==undefined){s+=a[i+j];c++;}out[i]=s/c;}return out;}
function resultado(){
 const cv=curvas();if(!cv)return null;const {t,dur,series}=cv;const [w0,w1]=S.ventana.map(x=>x*60);
 const integral=k=>{let s=0;for(let i=0;i<t.length;i++)if(t[i]>=w0&&t[i]<=w1)s+=series[k][i]*(S.porSegundo?dur[i]:1);return s;};
 const ii=integral('izq'),id=integral('der'),tot=ii+id;
 // El maximo se considera "no alcanzado" si cae en el ultimo 10 % del estudio: la curva seguia subiendo.
 const param=k=>{const y=suavizarSerie(series[k]);let imax=0;for(let i=1;i<y.length;i++)if(y[i]>y[imax])imax=i;const tmax=t[imax]/60;const alcanzado=imax<y.length-Math.max(2,Math.ceil(y.length*.1));
  let thalf=null;if(alcanzado){for(let i=imax;i<y.length;i++)if(y[i]<=y[imax]/2){thalf=t[i]/60;break;}}
  let tpost=null;const fMin=S.furosemidaMin;if(fMin>0){let i0=t.findIndex(x=>x>=fMin*60);if(i0>=0){const y0=y[i0];for(let i=i0;i<y.length;i++)if(y[i]<=y0/2){tpost=(t[i]-t[i0])/60;break;}}}
  return {tmax,alcanzado,thalf,tpost,pico:y[imax],cuentasVentana:integral(k)};};
 return {funcion:{izq:tot?100*ii/tot:NaN,der:tot?100*id/tot:NaN},izq:param('izq'),der:param('der'),ventana:S.ventana,finMin:cv.finS/60,completo:cv.completo};
}
function dibujarCurva(canvas,tipo,W,H){
 const cv=curvas();const ctx=canvas.getContext('2d');canvas.width=W;canvas.height=H;ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);
 if(!cv){ctx.fillStyle='#000';ctx.font='14px Arial';ctx.fillText('Dibuja las regiones para ver las curvas.',20,30);return;}
 const {t,series}=cv;const flujo=tipo==='flujo';const tmaxS=flujo?60:Math.max(cv.finS,60);
 const idx=[];for(let i=0;i<t.length;i++)if(flujo?t[i]<=60:true)idx.push(i);
 const claves=flujo?['izq','der','aorta']:['izq','der','fondoIzq','fondoDer'];
 let ymax=0;for(const k of claves)for(const i of idx)if(Number.isFinite(series[k][i]))ymax=Math.max(ymax,series[k][i]);ymax=ymax*1.08||1;
 const L=64,R=20,T=18,B=40,pw=W-L-R,ph=H-T-B;const X=s=>L+(flujo?s:s/60)/(flujo?tmaxS:tmaxS/60)*pw,Y=v=>T+ph-v/ymax*ph;
 ctx.strokeStyle='#bbb';ctx.lineWidth=1;ctx.font='11px Arial';ctx.fillStyle='#000';ctx.textAlign='right';
 for(let g=0;g<=5;g++){const v=ymax*g/5,y=Y(v);ctx.beginPath();ctx.moveTo(L,y);ctx.lineTo(W-R,y);ctx.stroke();ctx.fillText(C.fmt(v,0),L-6,y+4);}
 ctx.textAlign='center';const pasoX=flujo?5:2;for(let g=0;g<=(flujo?60:Math.ceil(tmaxS/60));g+=pasoX){const x=X(flujo?g:g*60);if(x>W-R+1)break;ctx.beginPath();ctx.moveTo(x,T);ctx.lineTo(x,T+ph);ctx.stroke();ctx.fillText(String(g),x,T+ph+14);}
 ctx.fillText(flujo?'segundos':'minutos',L+pw/2,H-6);ctx.save();ctx.translate(14,T+ph/2);ctx.rotate(-Math.PI/2);ctx.fillText(S.porSegundo?'cuentas por segundo':'cuentas por frame',0,0);ctx.restore();
 if(!flujo&&S.furosemidaMin>0&&S.furosemidaMin*60<tmaxS){const x=X(S.furosemidaMin*60);ctx.strokeStyle='#e08000';ctx.setLineDash([4,3]);ctx.beginPath();ctx.moveTo(x,T);ctx.lineTo(x,T+ph);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#e08000';ctx.textAlign='left';ctx.fillText('furosemida',x+4,T+12);}
 if(!flujo){const [w0,w1]=S.ventana;ctx.fillStyle='rgba(0,0,128,.07)';ctx.fillRect(X(w0*60),T,X(w1*60)-X(w0*60),ph);}
 for(const k of claves){ctx.strokeStyle=COLORES[k];ctx.lineWidth=k.startsWith('fondo')?1:2;ctx.beginPath();let primero=true;for(const i of idx){const v=series[k][i];if(!Number.isFinite(v))continue;const x=X(t[i]),y=Y(v);if(primero){ctx.moveTo(x,y);primero=false;}else ctx.lineTo(x,y);}ctx.stroke();}
 const R2=resultado();if(!flujo&&R2){for(const k of ['izq','der']){const q=R2[k];if(!q.alcanzado)continue;const x=X(q.tmax*60);ctx.strokeStyle=COLORES[k];ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,T);ctx.lineTo(x,T+ph);ctx.stroke();ctx.fillStyle=COLORES[k];ctx.textAlign='left';ctx.fillText('Tmáx '+(k==='izq'?'I':'D'),x+3,T+(k==='izq'?26:40));if(q.thalf){const x2=X(q.thalf*60);ctx.beginPath();ctx.moveTo(x2,T+ph*.5);ctx.lineTo(x2,T+ph);ctx.stroke();ctx.fillText('T½ '+(k==='izq'?'I':'D'),x2+3,T+ph*.5+(k==='izq'?12:26));}}}
 ctx.font='11px Arial';ctx.textAlign='left';let lx=L+8;for(const k of claves){ctx.fillStyle=COLORES[k];ctx.fillRect(lx,T+2,14,3);ctx.fillStyle='#000';const nombre={izq:'Riñón izquierdo',der:'Riñón derecho',fondoIzq:'Fondo izquierdo',fondoDer:'Fondo derecho',aorta:'Aorta'}[k];ctx.fillText(nombre,lx+18,T+7);lx+=ctx.measureText(nombre).width+34;}
}
function tablaParametros(){
 const host=$('tablaParametros');const R=resultado();if(!R){host.replaceChildren();$('confirmar').disabled=true;return;}
 const t=document.createElement('table');t.className='tabla';const fila=(c,th)=>{const tr=document.createElement('tr');c.forEach((x,i)=>{const td=document.createElement(th?'th':'td');td.textContent=x;if(!th&&i===0)td.style.textAlign='left';tr.append(td);});t.append(tr);};
 const fmtT=(q,campo)=>campo==='tmax'?(q.alcanzado?C.fmt(q.tmax,1)+' min':'no alcanzado en '+C.fmt(R.finMin,1)+' min (curva ascendente)'):campo==='thalf'?(q.thalf?C.fmt(q.thalf,1)+' min':q.alcanzado?'no baja al 50 % en '+C.fmt(R.finMin,1)+' min':'—'):(q.tpost!==null?C.fmt(q.tpost,1)+' min':S.furosemidaMin>0?'no baja al 50 % tras el diurético':'diurético a tiempo 0');
 fila(['Parámetro','Izquierda','Derecha'],true);
 fila(['Función diferencial (%) · ventana '+R.ventana[0]+'–'+R.ventana[1]+' min',C.fmt(R.funcion.izq,1),C.fmt(R.funcion.der,1)]);
 fila(['Cuentas netas en la ventana',Math.round(R.izq.cuentasVentana).toLocaleString('es-CL'),Math.round(R.der.cuentasVentana).toLocaleString('es-CL')]);
 fila(['Tiempo al máximo (Tmáx)',fmtT(R.izq,'tmax'),fmtT(R.der,'tmax')]);
 fila(['Tiempo medio (T½ desde el máximo)',fmtT(R.izq,'thalf'),fmtT(R.der,'thalf')]);
 fila(['T½ después de la furosemida',fmtT(R.izq,'tpost'),fmtT(R.der,'tpost')]);
 const nota=document.createElement('p');nota.className='notice';nota.textContent='Curvas en '+(S.porSegundo?'cuentas por segundo':'cuentas por frame')+(S.restarFondo?', con fondo perirrenal restado por píxel':', sin restar fondo')+'. Tmáx y T½ sobre la curva suavizada (media móvil de 7 frames). '+(R.completo?'':'La adquisición se interrumpió a los '+C.fmt(R.finMin,1)+' min.');
 host.replaceChildren(t,nota);$('confirmar').disabled=false;$('confirmadoInfo').textContent=S.confirmado?'Resultados confirmados. Puedes exportar en el paso 5.':'Cuando estés conforme con regiones y parámetros, confirma.';
}
/* ---------- exportacion ---------- */
function casoActual(){return S.caso??(S.archivos.find(d=>d.rec)?.rec.caso??null);}
function cabecera(ctx,W,titulo){ctx.fillStyle='#fff';ctx.fillRect(0,0,W,860);ctx.fillStyle='#000';ctx.font='bold 20px Arial';ctx.textAlign='center';ctx.fillText('CINTIGRAMA RENAL DINÁMICO',W/2,34);ctx.textAlign='left';ctx.font='14px Arial';const n=casoActual(),d=dinamica();ctx.fillText((n?'Caso '+n:'Caso sin identificar')+' · '+(d?d.fecha.replace(/(\d{4})(\d{2})(\d{2})/,'$3-$2-$1'):'')+(d&&d.farmaco?' · '+d.farmaco:''),24,34);ctx.textAlign='right';ctx.fillText(titulo,W-24,34);ctx.textAlign='left';}
function paginaMosaico(tipo){
 const W=1132,H=860,cv=C.lienzo(W,H),ctx=cv.getContext('2d');const d=dinamica();cabecera(ctx,W,tipo==='angio'?'Fase angiográfica · '+S.angioSeg+' s por imagen':'Fase excretora · '+etiquetaTiempo(S.excrMin*60)+' por imagen');
 if(!d)return cv;
 const grupos=tipo==='angio'?gruposAngio(d):gruposExcr(d);let mx=0;for(const g of grupos)mx=Math.max(mx,C.maximo(g.img));
 const extra=tipo==='excr'&&postmiccional()?2:0;const total=grupos.length+extra;const cols=total<=20?5:8,filas=Math.ceil(total/cols);const tw=Math.floor((W-48-(cols-1)*8)/cols),th=Math.min(tw,Math.floor((H-70-(filas-1)*8-30)/filas)-16);
 ctx.imageSmoothingEnabled=false;ctx.font='11px Arial';
 const dibuja=(i,img,rows,c,label,vacio,furo)=>{const col=i%cols,row=Math.floor(i/cols),x=24+col*(tw+8),y=60+row*(th+24);const base=C.lienzo(c,rows);C.pintar(base,img,rows,c,{paleta:S.paleta,max:mx||1,maxRel:S.techo});if(vacio){ctx.fillStyle='#eee';ctx.fillRect(x,y,tw,th);}else ctx.drawImage(base,x,y,tw,th);ctx.fillStyle=furo?'#ffe08a':'#c8c8e8';ctx.fillRect(x,y+th,tw,16);ctx.fillStyle='#000';ctx.fillText(label,x+4,y+th+12);};
 grupos.forEach((g,i)=>{const vacio=C.total(g.img)===0;const a=Math.round(g.inicioS),b=Math.round(g.finS);const furo=tipo==='excr'&&S.furosemidaMin*60>=a&&S.furosemidaMin*60<b;dibuja(i,g.img,d.rows,d.cols,etiquetaTiempo(a)+(vacio?' · sin datos':'')+(furo?' · furosemida':''),vacio,furo);});
 if(extra){const pm=postmiccional();pm.detectores.forEach((det,k)=>{const img=pm.frame(k);const base=C.lienzo(pm.cols,pm.rows);const i=grupos.length+k,col=i%cols,row=Math.floor(i/cols),x=24+col*(tw+8),y=60+row*(th+24);C.pintar(base,img,pm.rows,pm.cols,{paleta:S.paleta,maxRel:S.techo});ctx.drawImage(base,x,y,tw,th);ctx.fillStyle='#c8e8c8';ctx.fillRect(x,y+th,tw,16);ctx.fillStyle='#000';ctx.fillText(det.vista||('Postmiccional det. '+det.indice),x+4,y+th+12);});}
 ctx.font='12px Arial';ctx.fillText((tipo==='angio'?'Frames de '+(d.fases[0]?d.fases[0].duracionMs/1000:1)+' s sumados de a '+S.angioSeg+' s.':'Frames de '+(d.fases[1]?d.fases[1].duracionMs/1000:15)+' s sumados de a '+etiquetaTiempo(S.excrMin*60)+'.'+(S.furosemidaMin>0?' Furosemida en el minuto '+S.furosemidaMin+'.':' Furosemida a tiempo 0.'))+' Escala común a todas las imágenes, techo '+Math.round(S.techo*100)+' %.',24,H-14);
 return cv;
}
function paginaCurvas(){
 const W=1132,H=860,cv=C.lienzo(W,H),ctx=cv.getContext('2d');cabecera(ctx,W,'Curvas y parámetros');
 if(lienzoRoi){ctx.imageSmoothingEnabled=false;ctx.drawImage(lienzoRoi.canvas,24,60,340,340);ctx.fillStyle='#c8c8e8';ctx.fillRect(24,400,340,18);ctx.fillStyle='#000';ctx.font='12px Arial';ctx.fillText('Suma 1–3 min · posterior · regiones',30,413);}
 const c1=C.lienzo(720,360);dibujarCurva(c1,'renal',720,360);ctx.drawImage(c1,388,60);const c2=C.lienzo(720,230);dibujarCurva(c2,'flujo',720,230);ctx.drawImage(c2,388,440);
 ctx.font='bold 13px Arial';ctx.fillStyle='#000';ctx.fillText('Renograma · 30 min',392,56);ctx.fillText('Flujo · primeros 60 s',392,436);
 const R=resultado();ctx.font='12px Arial';if(R){const filas=[['Parámetro','Izquierda','Derecha'],['Función diferencial (%) · '+R.ventana[0]+'–'+R.ventana[1]+' min',C.fmt(R.funcion.izq,1),C.fmt(R.funcion.der,1)],['Tmáx',R.izq.alcanzado?C.fmt(R.izq.tmax,1)+' min':'no alcanzado',R.der.alcanzado?C.fmt(R.der.tmax,1)+' min':'no alcanzado'],['T½ desde el máximo',R.izq.thalf?C.fmt(R.izq.thalf,1)+' min':'no baja al 50 %',R.der.thalf?C.fmt(R.der.thalf,1)+' min':'no baja al 50 %'],['T½ post furosemida',R.izq.tpost!==null?C.fmt(R.izq.tpost,1)+' min':'—',R.der.tpost!==null?C.fmt(R.der.tpost,1)+' min':'—']];
  filas.forEach((f,i)=>{const y=450+i*24;if(i===0||i===1)ctx.font='bold 12px Arial';else ctx.font='12px Arial';ctx.fillText(f[0],24,y);ctx.fillText(f[1],224,y);ctx.fillText(f[2],300,y);ctx.fillStyle='#bbb';ctx.fillRect(24,y+6,350,1);ctx.fillStyle='#000';});
  ctx.font='11px Arial';ctx.fillText((S.porSegundo?'Cuentas por segundo':'Cuentas por frame')+(S.restarFondo?', fondo restado.':'.')+(R.completo?'':' Interrumpido a los '+C.fmt(R.finMin,1)+' min.'),24,600);ctx.fillText('Furosemida: '+(S.furosemidaMin>0?'minuto '+S.furosemidaMin:'tiempo 0')+'.',24,616);}
 return cv;
}
async function exportarPng(tipo){
 const cv=tipo==='curvas'?paginaCurvas():paginaMosaico(tipo);const n=casoActual();const nombre='Renograma-Caso-'+(n??'X')+'-'+({angio:'angiografica',excr:'excretora',curvas:'curvas'})[tipo]+'.png';
 const blob=await C.canvasABlob(cv);C.descargar(blob,nombre);S.exportados[tipo]=true;$('exportInfo').textContent='Descargado '+nombre+'.';
 const img=document.createElement('img');img.src=URL.createObjectURL(blob);img.style.maxWidth='100%';img.style.border='1px solid #808080';img.alt=nombre;$('previsualizacion').replaceChildren(img);refrescar();
}
function estadoProyecto(){const rois={};for(const k of Object.keys(S.rois))if(S.rois[k])rois[k]=C.mascaraABase64(S.rois[k]);return {caso:casoActual(),paleta:S.paleta,techo:S.techo,angioSeg:S.angioSeg,excrMin:S.excrMin,rois,umbral:S.umbral,furosemidaMin:S.furosemidaMin,ventana:S.ventana,restarFondo:S.restarFondo,porSegundo:S.porSegundo,confirmado:S.confirmado,exportados:S.exportados,infoVista:[...S.infoVista],mosaicosVistos:S.mosaicosVistos};}
function guardarProyecto(){const n=casoActual();C.guardarProyecto('renograma',estadoProyecto(),S.archivos,'Renograma-Caso-'+(n??'X')+'.renalproject');S.proyectoGuardado=true;$('exportInfo').textContent='Proyecto guardado.';refrescar();}
async function abrirProyecto(file){
 try{const obj=await C.abrirProyecto(file);if(obj.app!=='renograma')throw Error('Este proyecto es del simulador '+obj.app+'.');
  reiniciar(false);await cargar(obj.files);const e=obj.estado;Object.assign(S,{paleta:e.paleta,techo:e.techo,angioSeg:e.angioSeg,excrMin:e.excrMin,umbral:e.umbral??.4,furosemidaMin:e.furosemidaMin,ventana:e.ventana||[1,2.5],restarFondo:e.restarFondo!==false,porSegundo:e.porSegundo!==false,confirmado:!!e.confirmado,exportados:e.exportados||S.exportados,infoVista:new Set(e.infoVista||[]),mosaicosVistos:!!e.mosaicosVistos});
  for(const [k,b] of Object.entries(e.rois||{}))S.rois[k]=C.mascaraDesdeBase64(b);sincronizarControles();if(e.caso&&tutorial)tutorial.setCaso(e.caso);S.proyectoGuardado=true;estado('Proyecto abierto.');refrescar();
 }catch(err){estado('No se pudo abrir el proyecto: '+err.message);}
}
function sincronizarControles(){$('paleta').value=S.paleta;$('techo').value=Math.round(S.techo*100);$('techoValor').textContent=Math.round(S.techo*100)+' %';$('angioSeg').value=String(S.angioSeg);$('excrMin').value=String(S.excrMin);$('umbral').value=Math.round(S.umbral*100);$('umbralValor').textContent=Math.round(S.umbral*100)+' %';$('furosemida').value=S.furosemidaMin;$('ventanaIni').value=S.ventana[0];$('ventanaFin').value=S.ventana[1];$('restarFondo').checked=S.restarFondo;$('porSegundo').checked=S.porSegundo;}
/* ---------- navegacion y refresco ---------- */
function navegar(i){S.paso=Math.max(0,Math.min(4,i));document.querySelectorAll('.step').forEach((s,k)=>s.hidden=k!==S.paso);document.querySelectorAll('.steps button').forEach((b,k)=>b.classList.toggle('active',k===S.paso));$('prev').disabled=S.paso===0;$('next').disabled=S.paso===4;$('posicion').textContent='Paso '+(S.paso+1)+' de 5';
 $('panelMosaicos').hidden=S.paso!==1;$('panelHerramientas').hidden=S.paso!==2;$('panelCurvas').hidden=S.paso!==3;if(S.paso===1&&dinamica())S.mosaicosVistos=true;$('vacio').hidden=S.archivos.length>0||S.paso!==0;if(tutorial)tutorial.render();}
function refrescar(){
 listar();const d=dinamica();
 if(d){construirMosaicos();construirRoi();dibujarCurva($('curvaRenal'),'renal',900,420);dibujarCurva($('curvaFlujo'),'flujo',900,300);}else{$('mosaicoAngio').replaceChildren();$('mosaicoExcr').replaceChildren();$('postmiccional').replaceChildren();$('tablaFases').replaceChildren();$('roiArea').replaceChildren();}
 tablaParametros();
 const n=casoActual();$('casoNombre').textContent=n?'Renograma · Caso '+n:'Sin caso';$('casoInfo').textContent=n&&RENO_CASOS[n]?RENO_CASOS[n].titulo:'Elige el caso en el tutorial y carga los archivos de tu carpeta.';
 $('herrIso').setAttribute('aria-pressed',String(S.herramienta==='iso'));$('herrPoli').setAttribute('aria-pressed',String(S.herramienta==='poli'));
 const R=resultado();$('pngAngio').disabled=!d;$('pngExcr').disabled=!d;$('pngCurvas').disabled=!R;$('guardarProyecto').disabled=!S.archivos.length;$('vacio').hidden=S.archivos.length>0||S.paso!==0;
 document.querySelectorAll('.steps button').forEach((b,k)=>b.classList.toggle('hecho',[!faltantes().length&&S.archivos.length>0,agrupacionOk(),!problemasRoi().length&&!!R,S.confirmado,S.exportados.angio&&S.exportados.excr&&S.exportados.curvas][k]));
 if(tutorial)tutorial.render();window.dispatchEvent(new CustomEvent('renograma',{detail:{kind:'estado'}}));
}
function agrupacionOk(){return S.angioSeg===RENO_PROTOCOLO.angiograficoS&&S.excrMin===RENO_PROTOCOLO.excretorMin;}
function reiniciar(conCaso=true){Object.assign(S,{archivos:[],ignorados:[],seleccion:null,rois:{},poligono:[],confirmado:false,exportados:{angio:false,excr:false,curvas:false},proyectoGuardado:false,infoVista:new Set(),mosaicosVistos:false,angioSeg:1,excrMin:.25,furosemidaMin:20});sumas.clear();suaveCache=null;sincronizarControles();$('archivos').value='';$('carpeta').value='';$('previsualizacion').replaceChildren();$('exportInfo').textContent='';if(conCaso){navegar(0);refrescar();}}
/* ---------- tutorial ---------- */
function pasosTutorial(n,caso){
 const nombreEst=Object.entries(RENO_ESTUDIANTES).find(([,l])=>l.includes(n))?.[0];const carpeta=nombreEst?'«Renograma '+nombreEst+' › Caso '+n+'»':'la carpeta del caso '+n;
 const dosDet=!!caso.archivos.dinamicaAnterior;
 return [
  {titulo:'Cargar la dinámica y la postmiccional',pantalla:0,resaltar:'archivos',
   texto:'Tu carpeta es '+carpeta+'. Trae '+(dosDet?'tres':'dos')+' archivos DICOM sin extensión: la dinámica de 176 frames'+(dosDet?' posterior, la dinámica anterior':'')+' y la estática postmiccional.',
   haz:['Pulsa «Archivos» y selecciona todos los archivos de la carpeta, o usa «O carpeta».','Espera a que aparezcan las filas en la lista.'],
   deberia:(dosDet?'Tres':'Dos')+' filas en verde con «Caso '+n+'»: '+(dosDet?'dinámica posterior, dinámica anterior y ':'dinámica posterior y ')+'estática postmiccional.',
   ayuda:'Una fila roja es un archivo de otro caso o que no es DICOM. Si en tu carpeta original hubiera varias dinámicas con las mismas cuentas, son copias del mismo archivo: el simulador las omite.',
   completo:()=>S.archivos.length>0&&!faltantes().length&&!problemasCarga().length,problemas:()=>problemasCarga(),
   detalle:()=>S.archivos.filter(reconocido).map(d=>d.nombre+': '+descripcion(d)).join(' · ')},
  {titulo:'Reconocer la adquisición',pantalla:0,resaltar:'listaArchivos',
   texto:'Lee la cabecera de la dinámica: matriz, píxel, fases, detector, ventana y radiofármaco. Son los datos de la pregunta 2 de la presentación.',
   haz:['Haz clic en la fila de la dinámica.','Cuenta los frames de cada fase y calcula la duración total.','Comprueba el ángulo del detector: 0° es posterior.'],
   deberia:'128 × 128, dos fases: 60 frames de 1 s y 116 de 15 s, 30 minutos en total. Píxel de 3,3 mm'+(n===8?', salvo en este caso, que es de 3,9 mm':'')+'. '+(caso.farmaco==='EC'?'La cabecera dice MAG3 aunque el informe dice EC: fíjate.':'Radiofármaco MAG3.'),
   ayuda:'Si la tabla no aparece, la fila no quedó seleccionada. La dosis no siempre consta; en ese caso úsala desde el procedimiento del antecedente.',
   completo:()=>S.infoVista.has('dinamica'),problemas:()=>[],
   detalle:()=>{const d=dinamica();return d?d.frames+' frames · '+d.fases.map(f=>f.frames+'×'+(f.duracionMs/1000)+' s').join(' + ')+(finDatosS(d)<d.fases.reduce((a,f)=>a+f.frames*f.duracionMs,0)/1000-1?' · interrumpido a los '+C.fmt(finDatosS(d)/60,1)+' min':''):'';}},
  {titulo:'Fases y mosaicos',pantalla:1,resaltar:'panelMosaicos',
   texto:'El equipo presenta la fase angiográfica en imágenes de 3 segundos y la fase excretora en imágenes de 1 minuto. Tú eliges la agrupación: cada imagen del mosaico suma frames consecutivos.',
   haz:['En «Suma temporal» elige 3 s para la angiográfica: verás 20 imágenes del primer minuto.','Elige 1 min para la excretora: 29 imágenes, cada una suma 4 frames de 15 s.','Baja el techo de la escala si la vejiga se lleva toda la intensidad y no ves los riñones.','Mira la postmiccional debajo.'],
   deberia:'20 imágenes angiográficas y 29 excretoras, con la furosemida marcada en su minuto. '+(n===9?'En este caso las últimas casillas dicen «sin datos»: la adquisición se interrumpió.':''),
   ayuda:'Si eliges 1 s tendrás 60 imágenes ruidosas; si eliges 15 s en la excretora, 116. La agrupación correcta no cambia las cuentas totales, solo cómo se reparten. Compara.',
   completo:()=>agrupacionOk()&&S.mosaicosVistos,problemas:()=>{const p=[];if(S.angioSeg!==RENO_PROTOCOLO.angiograficoS)p.push('La fase angiográfica está agrupada de a '+S.angioSeg+' s; el equipo la muestra de a 3 s.');if(S.excrMin!==RENO_PROTOCOLO.excretorMin)p.push('La fase excretora está agrupada de a '+etiquetaTiempo(S.excrMin*60)+'; el equipo la muestra de a 1 min.');return p;},
   detalle:()=>'Angiográfica de a '+S.angioSeg+' s · excretora de a '+etiquetaTiempo(S.excrMin*60)},
  {titulo:'Regiones renales, fondo y aorta',pantalla:2,resaltar:'panelHerramientas',
   texto:'Las regiones se dibujan sobre la suma de los minutos 1 a 3, cuando el parénquima capta y la pelvis aún no se llena. La dinámica es posterior: la izquierda del paciente está a la izquierda de la imagen.',
   haz:['Con «Riñón izquierdo» e Isocontorno, haz clic dentro del riñón izquierdo del paciente. Ajusta el umbral si toma fondo o corta corteza.','Repite con «Riñón derecho».','Elige «Aorta» y dibuja un polígono pequeño sobre la aorta, entre los riñones y arriba de la bifurcación, para la curva de flujo.','Si un riñón es tenue o irregular, usa Polígono.'],
   deberia:'Rojo y verde alrededor de cada riñón con sus fondos amarillo y azul; magenta sobre la aorta. En el título aparece la función diferencial provisional.',
   ayuda:'Si el isocontorno se derrama, sube el umbral. Si un riñón casi no se ve (casos con atrofia), baja el techo de la escala y dibuja un polígono siguiendo la silueta. El fondo se regenera con «Fondo perirrenal automático».',
   completo:()=>!problemasRoi().length&&!!resultado(),problemas:()=>problemasRoi(),
   detalle:()=>{const r=resultado();return r?'Función diferencial provisional: izq '+C.fmt(r.funcion.izq,1)+' %, der '+C.fmt(r.funcion.der,1)+' %'+(S.rois.aorta?' · aorta dibujada':' · sin aorta (la curva de flujo no tendrá referencia)'):'';}},
  {titulo:'Curvas y parámetros',pantalla:3,resaltar:'panelCurvas',
   texto:'El renograma se expresa en cuentas por segundo: los frames de 1 s y de 15 s no son comparables en cuentas por frame. Marca el minuto de la furosemida de este caso y revisa la ventana de la función diferencial.',
   haz:['Escribe el minuto de la furosemida: en este caso, '+(caso.furosemidaMin>0?'minuto '+caso.furosemidaMin:'tiempo 0')+'. Está en el procedimiento del antecedente.','Desmarca y vuelve a marcar «cuentas por segundo» para ver el salto en el frame 61.','Revisa la ventana de la función diferencial (1 a 2,5 min) y la tabla.','Pulsa «Confirmar resultados».'],
   deberia:'Dos curvas renales con sus fondos, la línea de la furosemida, Tmáx y T½ marcados cuando existen, y la tabla con función diferencial, Tmáx, T½ y T½ post diurético.',
   ayuda:'Si un Tmáx dice «no alcanzado», la curva sigue subiendo al terminar: es un hallazgo, no un error. Si T½ dice «no baja al 50 %», tampoco lo fuerces.',
   completo:()=>S.confirmado&&!!resultado()&&S.furosemidaMin===caso.furosemidaMin,problemas:()=>{const p=[];if(S.furosemidaMin!==caso.furosemidaMin)p.push('La furosemida está marcada en el minuto '+S.furosemidaMin+'; en este caso se administró '+(caso.furosemidaMin>0?'a los '+caso.furosemidaMin+' minutos':'a tiempo 0')+'.');if(!S.porSegundo)p.push('Las curvas están en cuentas por frame: los frames de 15 s parecen 15 veces más altos que los de 1 s.');if(!resultado())p.push('Faltan regiones para calcular.');return p;}},
  {titulo:'Exportar y guardar',pantalla:4,resaltar:'pngAngio',
   texto:'Entregas tres PNG: fase angiográfica, fase excretora con la postmiccional, y curvas con parámetros. Guarda además el proyecto.',
   haz:['Pulsa los tres botones de PNG.','Pulsa «Guardar proyecto…».'],
   deberia:'Cuatro descargas: Renograma-Caso-'+n+'-angiografica.png, -excretora.png, -curvas.png y Renograma-Caso-'+n+'.renalproject.',
   ayuda:'Si el navegador bloquea descargas seguidas, permítelas para este sitio y vuelve a pulsar.',
   completo:()=>S.exportados.angio&&S.exportados.excr&&S.exportados.curvas&&S.proyectoGuardado,problemas:()=>{const p=[];if(!S.exportados.angio)p.push('Falta el PNG angiográfico.');if(!S.exportados.excr)p.push('Falta el PNG excretor.');if(!S.exportados.curvas)p.push('Falta el PNG de curvas.');if(!S.proyectoGuardado)p.push('Falta guardar el proyecto.');return p;}}
 ];
}
function cierreTutorial(n,caso){
 const R=resultado();const box=document.createElement('div');const ref=caso.referencia;
 if(!ref){box.append(Object.assign(document.createElement('p'),{textContent:'Sin informe de referencia.'}));return box;}
 const t=document.createElement('table');t.className='tabla';const fila=(c,th)=>{const tr=document.createElement('tr');c.forEach(x=>{const td=document.createElement(th?'th':'td');td.textContent=x;tr.append(td);});t.append(tr);};
 fila(['','Izquierda','Derecha'],true);fila(['Tu función diferencial',C.fmt(R?.funcion.izq,1)+' %',C.fmt(R?.funcion.der,1)+' %']);fila(['Informe',C.fmt(ref.izq,1)+' %',C.fmt(ref.der,1)+' %']);
 const dif=R?Math.abs(R.funcion.izq-ref.izq):NaN;fila(['Diferencia',C.fmt(dif,1)+' puntos','']);
 if(ref.tmedioIzq!==undefined)fila(['T½ informe',C.fmt(ref.tmedioIzq,1)+' min',C.fmt(ref.tmedioDer,1)+' min']);
 if(ref.tmedioPostDiureticoDer!==undefined)fila(['T½ post diurético informe','no evaluable',C.fmt(ref.tmedioPostDiureticoDer,1)+' min']);
 box.append(t);
 const msg=document.createElement('p');msg.textContent=!Number.isFinite(dif)?'Sin resultado propio para comparar.':dif<=RENO_TOLERANCIA?'Tu función diferencial coincide con el informe dentro de '+RENO_TOLERANCIA+' puntos. Explica igual de qué dependió: ventana, fondo y regiones.':'Tu función diferencial se aleja del informe más de '+RENO_TOLERANCIA+' puntos. No la corrijas para que calce: revisa la ventana y las regiones y llévalo a la discusión.';box.append(msg);
 const imp=document.createElement('details');imp.open=true;imp.append(Object.assign(document.createElement('summary'),{textContent:'Impresión del informe'}));imp.append(Object.assign(document.createElement('p'),{textContent:ref.impresion}));box.append(imp);
 return box;
}
/* ---------- arranque ---------- */
function iniciar(){
 tutorial=RenalTutorial.crear({contenedor:$('tutorial'),workspace:$('workspace'),boton:$('tutorialBoton'),titulo:'Tutorial renograma',clave:'renogramaTutorial',casos:RENO_CASOS,estudiantes:RENO_ESTUDIANTES,pasos:pasosTutorial,cierre:cierreTutorial,preguntasOrales:RENO_PREGUNTAS_ORALES,onCaso:n=>{S.caso=n;refrescar();},navegar:i=>{if(i!==S.paso&&S.archivos.length)navegar(i);}});
 S.caso=tutorial.caso;
 $('archivos').onchange=e=>cargar([...e.target.files]);$('carpeta').onchange=e=>cargar([...e.target.files]);
 $('paleta').onchange=e=>{S.paleta=e.target.value;refrescar();};$('techo').oninput=e=>{S.techo=Number(e.target.value)/100;$('techoValor').textContent=e.target.value+' %';refrescar();};
 $('angioSeg').onchange=e=>{S.angioSeg=Number(e.target.value);refrescar();};$('excrMin').onchange=e=>{S.excrMin=Number(e.target.value);refrescar();};
 $('umbral').oninput=e=>{S.umbral=Number(e.target.value)/100;$('umbralValor').textContent=e.target.value+' %';};
 $('objetivo').onchange=e=>{S.objetivo=e.target.value;S.poligono=[];refrescar();};
 $('herrIso').onclick=()=>{S.herramienta='iso';S.poligono=[];refrescar();};$('herrPoli').onclick=()=>{S.herramienta='poli';refrescar();};
 $('cerrarPoli').onclick=cerrarPoligono;$('fondoAuto').onclick=fondoAutomatico;
 $('borrarRoi').onclick=()=>{S.rois[S.objetivo]=null;if(S.objetivo==='izq')S.rois.fondoIzq=null;if(S.objetivo==='der')S.rois.fondoDer=null;S.confirmado=false;refrescar();};
 $('borrarTodo').onclick=()=>{S.rois={};S.poligono=[];S.confirmado=false;refrescar();};
 $('furosemida').onchange=e=>{S.furosemidaMin=Math.max(0,Number(e.target.value)||0);S.confirmado=false;refrescar();};
 $('ventanaIni').onchange=$('ventanaFin').onchange=()=>{const a=Number($('ventanaIni').value),b=Number($('ventanaFin').value);if(b>a){S.ventana=[a,b];S.confirmado=false;refrescar();}};
 $('restarFondo').onchange=e=>{S.restarFondo=e.target.checked;S.confirmado=false;refrescar();};$('porSegundo').onchange=e=>{S.porSegundo=e.target.checked;S.confirmado=false;refrescar();};
 $('confirmar').onclick=()=>{S.confirmado=true;estado('Resultados confirmados.');refrescar();};
 $('pngAngio').onclick=()=>exportarPng('angio');$('pngExcr').onclick=()=>exportarPng('excr');$('pngCurvas').onclick=()=>exportarPng('curvas');$('guardarProyecto').onclick=guardarProyecto;
 $('abrirProyecto').onclick=()=>$('proyectoInput').click();$('proyectoInput').onchange=e=>{if(e.target.files[0])abrirProyecto(e.target.files[0]);e.target.value='';};
 $('nuevo').onclick=()=>{if(!S.archivos.length||confirm('¿Descartar el caso cargado y sus regiones?'))reiniciar();};
 $('prev').onclick=()=>navegar(S.paso-1);$('next').onclick=()=>navegar(S.paso+1);document.querySelectorAll('.steps button').forEach(b=>b.onclick=()=>navegar(Number(b.dataset.step)));
 $('ayuda').onclick=()=>$('acerca').showModal();$('cerrarAcerca').onclick=()=>$('acerca').close();$('inicio').onclick=()=>navegar(0);
 window.addEventListener('error',e=>{(window.__errores=window.__errores||[]).push(String(e.message));});
 sincronizarControles();navegar(0);refrescar();
}
window.RenoApp={estado:S,cargar,curvas,resultado,imagenRoi,dinamica,postmiccional,clicRoi,cerrarPoligono,navegar,exportarPng,guardarProyecto,problemasRoi,problemasCarga,agrupacionOk,get tutorial(){return tutorial;},refrescar};
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',iniciar):iniciar();
})();
