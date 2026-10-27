/* Luca · Escanear recibos.
   Lee la foto dentro del celular (Tesseract, español) y extrae lo que importa de una factura colombiana:
   total, subtotal, IVA/INC, propina, descuento, comercio, NIT, fecha, hora, número de factura, forma de pago,
   últimos 4 dígitos de la tarjeta y cantidad de productos. Comprueba que las cuentas cuadren. Nada se sube. */
"use strict";
const OCR_BASE="vendor/ocr/";let ocrWorker=null,ocrCargando=null;
const RECIBO_GRATIS=3;

function cargarScript(src){return new Promise((ok,no)=>{if(document.querySelector(`script[src="${src}"]`))return ok();const s=document.createElement("script");s.src=src;s.onload=ok;s.onerror=no;document.head.appendChild(s)})}
async function ocrListo(progreso){
  if(ocrWorker)return ocrWorker;
  if(!ocrCargando)ocrCargando=(async()=>{await cargarScript(OCR_BASE+"tesseract.min.js");
    const w=await Tesseract.createWorker("spa",1,{workerPath:OCR_BASE+"worker.min.js",corePath:OCR_BASE+"core",langPath:OCR_BASE+"lang",gzip:true,workerBlobURL:false,
      logger:m=>{if(ocrCargando&&ocrCargando.prog)ocrCargando.prog(m)}});
    await w.setParameters({tessedit_pageseg_mode:"6",preserve_interword_spaces:"1"});ocrWorker=w;return w})();
  ocrCargando.prog=progreso;return ocrCargando;
}

/* Prepara la foto: gira según EXIF, escala a ~1600 px, gris, contraste estirado y un poco de nitidez */
async function prepararFoto(file){
  const bmp=await createImageBitmap(file,{imageOrientation:"from-image"});
  const k=Math.min(2.2,Math.max(1,1600/Math.max(bmp.width,bmp.height)*(Math.max(bmp.width,bmp.height)<1600?1.4:1)));
  const W=Math.round(bmp.width*k),H=Math.round(bmp.height*k);const c=document.createElement("canvas");c.width=W;c.height=H;
  const x=c.getContext("2d",{willReadFrequently:true});x.drawImage(bmp,0,0,W,H);const d=x.getImageData(0,0,W,H),p=d.data;
  const hist=new Uint32Array(256);for(let i=0;i<p.length;i+=4){const g=(p[i]*299+p[i+1]*587+p[i+2]*114)/1000|0;p[i]=g;hist[g]++}
  let lo=0,hi=255,acc=0,tot=W*H;for(;lo<255&&(acc+=hist[lo])<tot*.02;lo++);acc=0;for(;hi>0&&(acc+=hist[hi])<tot*.02;hi--);
  const r=Math.max(1,hi-lo);for(let i=0;i<p.length;i+=4){let g=(p[i]-lo)*255/r;g=g<0?0:g>255?255:g;p[i]=p[i+1]=p[i+2]=g}
  x.putImageData(d,0,0);return c;
}

/* ---------- Lectura del texto ---------- */
const sinTildes=s=>s.normalize("NFD").replace(/[̀-ͯ]/g,"");
function arreglarNumeros(l){return l.replace(/(?<=[\d$.,])[Oo](?=[\d.,])|(?<=[\d.,])[Oo]\b/g,"0").replace(/(?<=\d)[lI|](?=\d)/g,"1").replace(/(?<=\d)S(?=\d)/g,"5").replace(/(?<=\d)\s(?=\d{3}\b)/g,".")}
function monto(tok){
  let t=tok.replace(/[^\d.,]/g,"");if(!t||!/\d/.test(t))return null;
  const m=/[.,](\d{1,2})$/.exec(t);let dec=0;
  if(m&&!/[.,]\d{3}[.,]\d{1,2}$/.test(t)&&m[1].length===2&&/\d{1,3}([.,]\d{3})+[.,]\d{2}$|^\d+[.,]\d{2}$/.test(t)){dec=+("0."+m[1]);t=t.slice(0,-m[0].length)}
  const n=+(t.replace(/[.,]/g,""));if(!isFinite(n))return null;return n+dec;
}
const RX_MONTO=/\$?\s?-?\d{1,3}(?:[.,\s]\d{3})+(?:[.,]\d{2})?\b|\$\s?\d+(?:[.,]\d{2})?|\b\d{4,9}(?:[.,]\d{2})?\b/g;
function montosDe(l){const out=[];for(const m of l.matchAll(RX_MONTO)){const s=m[0];if(/\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}/.test(l.slice(Math.max(0,m.index-6),m.index+s.length+6)))continue;const v=monto(s);if(v!=null&&v>=50&&v<1e9)out.push(v)}return out}
function ultimoMonto(lines,i){const a=montosDe(lines[i]);if(a.length)return a[a.length-1];const b=lines[i+1]&&montosDe(lines[i+1]);return b&&b.length&&!/[A-Z]{4,}/.test(lines[i+1].replace(/\$|COP/g,""))?b[b.length-1]:null}

const COMERCIOS=[
  [/\bEXITO\b|CARULLA|\bD1\b|TIENDAS ARA|\bARA\b|OLIMPICA|\bJUMBO\b|\bMETRO\b|ALKOSTO|MAKRO|PRICESMART|JUSTO Y BUENO|ISIMO|SURTIMAX|COLSUBSIDIO|CAFAM|OXXO|SUPERMERCADO|MINIMERCADO|FRUVER|DROGUERIA ALEMANA/,"Hogar"],
  [/CRUZ VERDE|FARMATODO|LOCATEL|DROGUERIA|FARMACIA|LABORATORIO|CLINICA|ODONTO|OPTICA/,"Salud"],
  [/TERPEL|PRIMAX|BIOMAX|\bESSO\b|\bMOBIL\b|TEXACO|ZEUSS|PARQUEADERO|PEAJE|TRANSMILENIO|\bUBER\b|DIDI|CABIFY|TAXI|GASOLINA|ESTACION DE SERVICIO|EDS /,"Transporte"],
  [/RESTAURANTE|FRISBY|\bKFC\b|MC ?DONALD|BURGER|EL CORRAL|JUAN VALDEZ|TOSTAO|CREPES|PIZZA|DOMINO|PAPA JOHN|SUBWAY|PANADERIA|CAFE|ASADERO|PIQUETEADERO|HELADERIA|RAPPI|\bIFOOD\b|SANDWICH QBANO|WOK|PRESTO|CHEF BURGER/,"Comida"],
  [/CINE COLOMBIA|CINEMARK|PROCINAL|BAR\b|DISCOTECA|TEATRO|BOLERA|MUSEO|PARQUE/,"Salidas"],
  [/ZARA|ARTURO CALLE|KOAJ|STUDIO F|ELA\b|TENNIS|ADIDAS|NIKE|FALABELLA|H&M|BERSHKA|PULL&BEAR|AMERICANINO|CHEVIGNON|SPRING STEP|BOSI|VELEZ/,"Ropa"],
  [/HOMECENTER|EASY|KTRONIX|PANAMERICANA|DOLLARCITY|MINISO|TUGO|JAMAR|ETB|CLARO|MOVISTAR|\bTIGO\b|ENEL|CODENSA|VANTI|ACUEDUCTO|GAS NATURAL/,"Hogar"],
  [/NETFLIX|SPOTIFY|DISNEY|HBO|\bMAX\b|PRIME VIDEO|YOUTUBE|APPLE\.COM|GOOGLE|CRUNCHYROLL/,"Suscripciones"],
  [/PLAYSTATION|XBOX|NINTENDO|STEAM|GAMER|JUEGOS/,"Juegos"]];
const GENERICO=/^(RESTAURANTE|SUPERMERCADO|MINIMERCADO|FRUVER|DROGUERIA|FARMACIA|LABORATORIO|CLINICA|ODONTO|OPTICA|PARQUEADERO|PEAJE|TAXI|GASOLINA|ESTACION DE SERVICIO|EDS|PANADERIA|CAFE|ASADERO|PIQUETEADERO|HELADERIA|PIZZA|BAR|DISCOTECA|TEATRO|BOLERA|MUSEO|PARQUE|TENNIS|JUEGOS|GAMER)$/;
const BANCOS=["BANCOLOMBIA","DAVIVIENDA","BBVA","BANCO DE BOGOTA","OCCIDENTE","POPULAR","AV VILLAS","COLPATRIA","SCOTIABANK","ITAU","FALABELLA","NU","NUBANK","RAPPICARD","LULO","SERFINANZA","101","CAJA SOCIAL","NEQUI","DAVIPLATA","MOVII","DALE"];

function leerFactura(texto){
  const crudo=texto.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  const L=crudo.map(l=>arreglarNumeros(sinTildes(l).toUpperCase()).replace(/\s{2,}/g," "));
  const r={confianza:0};const idx=re=>L.findIndex(l=>re.test(l));
  // Total: palabras clave en orden de prioridad, evitando subtotal, total IVA, total ítems y cambio
  const NO_TOTAL=/SUB ?TOTAL|TOTAL (IVA|IMP|ITEMS?|ARTICULOS|UNIDADES|PRODUCTOS|DESC|AHORRO|BASE|CANT)|BASE|EXCLUID|CAMBIO|VUELTO|RECIBIDO|EFECTIVO RECIB/;
  const CLAVES_TOTAL=[/TOTAL A PAGAR|VALOR A PAGAR|NETO A PAGAR|TOTAL NETO|VR\.? ?A PAGAR|PAGAR\b/,/VALOR TOTAL|VR\.? ?TOTAL|GRAN TOTAL|TOTAL FACTURA|TOTAL VENTA|TOTAL COP/,/\bTOTAL\b/];
  for(const re of CLAVES_TOTAL){for(let i=L.length-1;i>=0;i--){if(re.test(L[i])&&!NO_TOTAL.test(L[i])){const v=ultimoMonto(L,i);if(v){r.total=v;r.lTotal=i;break}}}if(r.total)break}
  const valorDe=(re,ex)=>{for(let i=0;i<L.length;i++)if(re.test(L[i])&&!(ex&&ex.test(L[i]))){const v=ultimoMonto(L,i);if(v!=null)return v}return null};
  r.subtotal=valorDe(/SUB ?TOTAL|BASE GRAVABLE|VALOR ANTES DE IMP/);
  r.iva=valorDe(/\bIVA\b|TOTAL IMP|IMPUESTO|\bINC\b|IMPOCONSUMO|I\.N\.C/,/BASE|EXCLUID|EXENTO|NIT|REGIMEN|RESPONSABLE/);
  r.propina=valorDe(/PROPINA|SERVICIO VOLUNTARIO|SERV\.? VOL|SERVICIO SUGERIDO/);
  r.descuento=valorDe(/DESCUENTO|AHORRO|DCTO|DSCTO/);
  if(r.propina&&r.total&&r.propina>=r.total)r.propina=null;if(r.iva&&r.total&&r.iva>=r.total)r.iva=null;
  if(r.subtotal&&r.total&&r.subtotal>r.total*1.5)r.subtotal=null;
  // Respaldo: el monto más grande de la mitad de abajo, sin líneas de efectivo/cambio
  if(!r.total){let best=0;for(let i=Math.floor(L.length*.35);i<L.length;i++){if(/CAMBIO|VUELTO|RECIBIDO|EFECTIVO|NIT|TEL|RESOLUCION|AUTORIZ/.test(L[i]))continue;for(const v of montosDe(L[i]))if(v>best)best=v}if(best)r.total=best}
  // ¿Cuadran las cuentas?
  if(r.total){const base=r.subtotal!=null?r.subtotal:null;
    if(base!=null){const calc=base+(r.subtotal&&r.iva&&!(Math.abs(base-r.total)<2)?r.iva:0)+(r.propina||0)-(r.descuento&&base>r.total?r.descuento:0);
      r.cuadra=Math.abs(calc-r.total)<=Math.max(2,r.total*.005)||Math.abs(base+(r.propina||0)-r.total)<=2}
    else if(r.propina){r.cuadra=null}}
  // Comercio: primeras líneas con letras, sin NIT/dirección/teléfono; si es conocido, mejor
  for(const l of L.slice(0,12)){for(const [re,cat] of COMERCIOS){const m=l.match(re);if(m){r.categoria=r.categoria||cat;if(!r.comercioConocido&&!GENERICO.test(m[0]))r.comercioConocido=m[0].trim()}}}
  const linNombre=L.slice(0,8).find(l=>/[A-Z]{3,}/.test(l)&&!/NIT|DIRECCION|DIR\b|CALLE|CRA|CARRERA|KR\b|CL\b|AV\b|TEL|CEL|FACTURA|REGIMEN|RESOLUCION|IVA|WWW|HTTP|@|BOGOTA|MEDELLIN|CALI|COLOMBIA|SUCURSAL|CAJA|FECHA|HORA/.test(l)&&l.replace(/[^A-Z]/g,"").length>=3);
  const nombre=(r.comercioConocido||linNombre||"").replace(/\b(S\.?A\.?S?|LTDA|E\.?U)\.?\b/g,"").replace(/[^A-Z0-9&ÑÁÉÍÓÚ .'-]/g,"").replace(/\s+/g," ").trim();
  if(nombre)r.comercio=nombre.toLowerCase().replace(/(^|\s)\S/g,c=>c.toUpperCase()).slice(0,40);
  // NIT, factura, fecha, hora
  const nit=texto.toUpperCase().match(/N\.?\s?I\.?\s?T\.?\s*[:.#]?\s*([\d.\s]{7,15}\s?-\s?\d|[\d.]{7,15})/);if(nit)r.nit=nit[1].replace(/\s/g,"");
  const fac=L.map(l=>l.match(/(?:FACTURA|FACT\.?|FE|POS|TIQUETE|TICKET|COMPROBANTE|RECIBO)[^0-9A-Z]{0,12}(?:N[O°º.]*|#)?\s*:?\s*([A-Z]{0,5}[- ]?\d{3,12})/)).find(Boolean);if(fac)r.factura=fac[1].replace(/\s/g,"");
  const hoy=new Date();const meses={ENE:1,FEB:2,MAR:3,ABR:4,MAY:5,JUN:6,JUL:7,AGO:8,SEP:9,SET:9,OCT:10,NOV:11,DIC:12};
  const fechas=[];for(const l of L){let m;
    if(m=l.match(/\b(20\d{2})[\/.-](\d{1,2})[\/.-](\d{1,2})\b/))fechas.push([+m[1],+m[2],+m[3]]);
    else if(m=l.match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})\b/)){let y=+m[3];if(y<100)y+=2000;fechas.push([y,+m[2],+m[1]])}
    else if(m=l.match(/\b(\d{1,2})\s?(?:DE\s)?(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEPT?|OCT|NOV|DIC)[A-Z]*\.?\s?(?:DE\s)?(20\d{2})\b/))fechas.push([+m[3],meses[m[2].slice(0,3)],+m[1]])}
  for(const [y,mo,d] of fechas){if(mo<1||mo>12||d<1||d>31)continue;const f=new Date(y,mo-1,d);const dias=(hoy-f)/864e5;if(dias>=-1&&dias<400){r.fecha=`${y}-${String(mo).padStart(2,"0")}-${String(d).padStart(2,"0")}`;break}}
  const hora=L.map(l=>l.match(/\b([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?\s?(AM|PM|A\.M\.|P\.M\.)?/)).find(Boolean);if(hora)r.hora=hora[0].replace(/\s/g," ").trim();
  // Forma de pago y tarjeta
  const todo=L.join(" ");
  if(/NEQUI/.test(todo))r.pago="Nequi";else if(/DAVIPLATA/.test(todo))r.pago="Daviplata";
  else if(/CREDITO|TARJ\.? CRED|T\.? ?CREDITO|VISA|MASTER ?CARD|AMEX|AMERICAN EXPRESS|DINERS/.test(todo))r.pago="Tarjeta de crédito";
  else if(/DEBITO|TARJ\.? DEB|MAESTRO|REDEBAN|CREDIBANCO|DATAFONO/.test(todo))r.pago="Tarjeta débito";
  else if(/EFECTIVO|CAMBIO|VUELTO/.test(todo))r.pago="Efectivo";
  const marca=todo.match(/VISA|MASTER ?CARD|AMERICAN EXPRESS|AMEX|DINERS/);if(marca)r.marca=marca[0].replace(/MASTER ?CARD/,"Mastercard").replace("AMERICAN EXPRESS","Amex").replace(/^VISA$/,"Visa").replace("AMEX","Amex").replace("DINERS","Diners");
  const ult=todo.match(/(?:\*{2,}|X{2,}|#{2,})\s?(\d{4})\b|TERMINADA EN\s?(\d{4})|ULT(?:IMOS)?\.? ?4[^0-9]{0,3}(\d{4})/);if(ult)r.ultimos4=ult[1]||ult[2]||ult[3];
  r.banco=BANCOS.find(b=>new RegExp("\\b"+b+"\\b").test(todo))||null;
  // Productos: líneas con cantidad x precio o con precio a la derecha antes del subtotal
  const fin=r.subtotal!=null?L.findIndex(l=>/SUB ?TOTAL/.test(l)):r.lTotal||L.length;
  r.productos=L.slice(0,fin<0?L.length:fin).filter(l=>/[A-Z]{3,}/.test(l)&&montosDe(l).length&&!/NIT|TEL|RESOL|FACTURA|FECHA|HORA|CAJA|CAJERO|TOTAL/.test(l)).length||null;
  r.confianza=(r.total?50:0)+(r.cuadra?25:0)+(r.comercio?10:0)+(r.fecha?10:0)+(r.nit?5:0);
  delete r.lTotal;delete r.comercioConocido;return r;
}

/* Con qué medio de la app pagaste, según lo que dice el recibo */
function medioDeRecibo(r,opts){
  const busca=re=>{const o=opts.find(o=>re.test(sinTildes(o.l).toUpperCase()));return o&&o.k};
  if(r.pago==="Nequi")return busca(/NEQUI/)||"debito";
  if(r.pago==="Daviplata")return busca(/DAVIPLATA/);
  if(r.pago==="Efectivo")return "efectivo";
  if(r.ultimos4){const t=S.tarjetas.find(t=>String(t.ultimos4||"")===r.ultimos4||new RegExp(r.ultimos4).test(t.nombre||""));if(t)return "t:"+t.id}
  if(r.banco){const b=r.banco==="NUBANK"?"NU":r.banco;const k=busca(new RegExp("\\b"+b));if(k)return k}
  if(r.marca){const k=busca(new RegExp(r.marca,"i"));if(k)return k}
  if(r.pago==="Tarjeta de crédito"){const t=opts.filter(o=>o.k.startsWith("t:"));if(t.length===1)return t[0].k}
  return null;
}

/* Límite gratis: 3 recibos al mes; Pro, sin límite */
function escaneosMes(){try{const o=JSON.parse(localStorage.getItem("luca-recibos")||"{}");return o.m===today().slice(0,7)?o.n:0}catch(e){return 0}}
function contarEscaneo(){try{localStorage.setItem("luca-recibos",JSON.stringify({m:today().slice(0,7),n:escaneosMes()+1}))}catch(e){}}
function puedeEscanear(){return (typeof isPro==="function"&&isPro())||escaneosMes()<RECIBO_GRATIS}

/* Ficha de lo que Luca leyó, para revisar antes de guardar */
function fichaRecibo(r){
  const fila=(k,v,cls)=>v==null||v===""?"":`<div class="rc-row${cls?" "+cls:""}"><span>${k}</span><b>${v}</b></div>`;
  const cuadra=r.cuadra===true?'<span class="rc-ok">Las cuentas cuadran</span>':r.cuadra===false?'<span class="rc-warn">Revisa el total: no cuadra con el subtotal</span>':"";
  return `<div class="rc-card"><div class="rc-head"><b>${esc(r.comercio||"Recibo")}</b>${cuadra}</div>
    ${fila("Total",r.total!=null?fmt(r.total):"No se encontró","rc-total")}${fila("Subtotal",r.subtotal!=null?fmt(r.subtotal):null)}
    ${fila("IVA / impuestos",r.iva!=null?fmt(r.iva):null)}${fila("Propina",r.propina!=null?fmt(r.propina):null)}${fila("Descuento",r.descuento!=null?"− "+fmt(r.descuento):null)}
    ${fila("Fecha",r.fecha?r.fecha.split("-").reverse().join("/")+(r.hora?" · "+esc(r.hora):""):null)}
    ${fila("Pago",r.pago?esc(r.pago)+(r.marca?" "+esc(r.marca):"")+(r.ultimos4?" ···· "+esc(r.ultimos4):""):null)}
    ${fila("NIT",r.nit?esc(r.nit):null)}${fila("Factura",r.factura?esc(r.factura):null)}${fila("Productos",r.productos?r.productos:null)}
    ${r.propina?'<p class="hint">La propina está incluida en el total. Si no la pagaste, cambia el valor.</p>':""}</div>`;
}

/* Flujo completo: foto → texto → datos */
async function leerRecibo(file,avance){
  avance("Preparando la foto…",.05);const canvas=await prepararFoto(file);
  avance("Cargando el lector (solo la primera vez)…",.15);
  const w=await ocrListo(m=>{if(m.status==="recognizing text")avance("Leyendo el recibo…",.35+.6*m.progress);else if(/load/.test(m.status||""))avance("Cargando el lector (solo la primera vez)…",.15+.2*(m.progress||0))});
  avance("Leyendo el recibo…",.35);const {data}=await w.recognize(canvas);
  avance("Listo",1);return leerFactura(data.text||"");
}

/* ---------- Escaneo en vivo con la cámara ----------
   Lee un cuadro cada vez que el lector termina el anterior, marca las palabras sobre el video
   y va sumando las líneas nuevas mientras bajas por un recibo largo. */
const camaraDisponible=()=>!!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia);
async function escaneoEnVivo(alTerminar){
  const ov=document.createElement("div");ov.id="liveScan";ov.setAttribute("role","dialog");ov.setAttribute("aria-label","Escanear recibo");
  ov.innerHTML=`<video playsinline muted autoplay></video><canvas class="ls-boxes"></canvas>
    <div class="ls-top"><div class="ls-chips">
      <span data-k="total">Total</span><span data-k="iva">IVA</span><span data-k="comercio">Comercio</span><span data-k="fecha">Fecha</span></div>
      <p class="ls-msg">Apunta al recibo. Si es largo, baja despacio.</p></div>
    <div class="ls-bottom"><button type="button" class="ls-cancel">Cancelar</button><button type="button" class="ls-ok" disabled>Listo</button></div>`;
  document.body.appendChild(ov);requestAnimationFrame(()=>ov.classList.add("on"));
  const v=ov.querySelector("video"),cv=ov.querySelector(".ls-boxes"),cx=cv.getContext("2d"),msg=ov.querySelector(".ls-msg"),okB=ov.querySelector(".ls-ok");
  let stream=null,vivo=true,acum=[],vistos=new Set(),ult=null,listoAvisado=false;
  const cerrar=r=>{vivo=false;clearTimeout(tope);if(stream)stream.getTracks().forEach(t=>t.stop());ov.classList.remove("on");setTimeout(()=>ov.remove(),250);alTerminar(r||null)};
  ov.querySelector(".ls-cancel").onclick=()=>cerrar(null);okB.onclick=()=>{if(ult&&ult.total){contarEscaneo();cerrar(ult)}};
  const tope=setTimeout(()=>{if(vivo){msg.textContent=ult&&ult.total?"Toca Listo para usar lo que leí.":"No logré leerlo. Prueba con más luz o toma una foto.";if(!(ult&&ult.total))setTimeout(()=>vivo&&cerrar(null),2500)}},60000);
  try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"},width:{ideal:1920},height:{ideal:1080}},audio:false});v.srcObject=stream;await v.play()}
  catch(e){cerrar(null);throw e}
  msg.textContent="Cargando el lector…";const w=await ocrListo(()=>{});if(!vivo)return;msg.textContent="Apunta al recibo. Si es largo, baja despacio.";
  const marco=document.createElement("canvas"),mx=marco.getContext("2d",{willReadFrequently:true});
  const pinta=(words,f)=>{const W=cv.width=ov.clientWidth*devicePixelRatio,H=cv.height=ov.clientHeight*devicePixelRatio;cx.clearRect(0,0,W,H);
    const s=Math.max(W/v.videoWidth,H/v.videoHeight),ox=(W-v.videoWidth*s)/2,oy=(H-v.videoHeight*s)/2;
    cx.lineWidth=2*devicePixelRatio;cx.strokeStyle="rgba(10,132,255,.9)";cx.fillStyle="rgba(10,132,255,.18)";
    for(const wd of words){const b=wd.bbox,x=ox+b.x0/f*s,y=oy+b.y0/f*s,ww=(b.x1-b.x0)/f*s,hh=(b.y1-b.y0)/f*s;cx.beginPath();cx.roundRect?cx.roundRect(x,y,ww,hh,4*devicePixelRatio):cx.rect(x,y,ww,hh);cx.fill();cx.stroke()}};
  const chips=r=>{for(const el of ov.querySelectorAll(".ls-chips span")){const k=el.dataset.k,val=r[k];const ok=val!=null&&val!=="";el.classList.toggle("ok",ok);
      el.textContent=({total:"Total",iva:"IVA",comercio:"Comercio",fecha:"Fecha"})[k]+(ok?": "+(k==="total"||k==="iva"?fmt(Math.round(val)):k==="fecha"?val.split("-").reverse().slice(0,2).join("/"):val):"")}};
  while(vivo){
    if(v.readyState<2){await new Promise(r=>setTimeout(r,100));continue}
    const f=Math.min(1,1280/Math.max(v.videoWidth,v.videoHeight));marco.width=Math.round(v.videoWidth*f);marco.height=Math.round(v.videoHeight*f);
    mx.filter="grayscale(1) contrast(1.5)";mx.drawImage(v,0,0,marco.width,marco.height);
    let data;try{({data}=await w.recognize(marco,{},{blocks:true,text:true}))}catch(e){break}
    if(!vivo)break;
    const lines=[],words=[];for(const bl of data.blocks||[])for(const pa of bl.paragraphs||[])for(const li of pa.lines||[]){if(li.confidence>45&&li.text.trim().length>2)lines.push(li.text.trim());for(const wd of li.words||[])if(wd.confidence>55&&wd.text.trim().length>1)words.push(wd)}
    pinta(words,f);
    for(const l of lines){const k=sinTildes(l).toUpperCase().replace(/[^A-Z0-9]/g,"");if(k.length>2&&!vistos.has(k)){vistos.add(k);acum.push(l)}}
    if(acum.length){ult=leerFactura(acum.join("\n"));chips(ult);okB.disabled=!ult.total;
      if(ult.total&&ult.cuadra&&!listoAvisado){listoAvisado=true;try{navigator.vibrate&&navigator.vibrate([12,40,12])}catch(e){}msg.textContent="Las cuentas cuadran. Toca Listo.";okB.classList.add("pulse")}}
  }
}
