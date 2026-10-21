"use strict";
/* Luca 1.2 — funciones nuevas:
   Libre hasta la quincena · ¿Me alcanza? · Gastos rápidos · Escribir el gasto como hablas ·
   Resumen del mes animado · Metas animadas · Avisos de pago · Libre de deudas el… */

/* ---------- Utilidades ---------- */
const norm=s=>String(s??"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
const escRx=s=>String(s).replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
const addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
const sinMovimiento=()=>matchMedia("(prefers-reduced-motion: reduce)").matches;
const palabra=w=>new RegExp("(^|\\s)"+escRx(w)+"(?=\\s|$)");
function fechaDia(d){return LANG==="en"?MESES[d.getMonth()]+" "+d.getDate():d.getDate()+" de "+MESES[d.getMonth()].toLowerCase()}
function fechaLarga(d){return LANG==="en"?DIAS_L[d.getDay()]+", "+MESES[d.getMonth()]+" "+d.getDate():DIAS_L[d.getDay()]+" "+d.getDate()+" de "+MESES[d.getMonth()].toLowerCase()}
const mesAnio=d=>MESES[d.getMonth()]+" "+d.getFullYear();
const nDias=n=>n+" "+(n===1?"día":"días");
function contar(el,to,{dur=900,f=fmt,from=0}={}){
  if(!el)return;if(sinMovimiento()){el.textContent=f(to);return}
  const t0=performance.now();
  const paso=t=>{if(!el.isConnected)return;const k=Math.min(1,(t-t0)/dur),e=1-Math.pow(1-k,3);el.textContent=f(from+(to-from)*e);if(k<1)requestAnimationFrame(paso)};
  requestAnimationFrame(paso);
}
const ICO={
  ok:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  ojo:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6v8" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><circle cx="12" cy="18.5" r="1.8" fill="currentColor"/></svg>',
  no:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>',
  q:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 9a3 3 0 1 1 4.2 2.8c-.8.4-1.2 1-1.2 1.9v.6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><circle cx="12" cy="18.3" r="1.6" fill="currentColor"/></svg>',
  campana:'<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9"/><path d="M10 20a2.2 2.2 0 0 0 4 0"/></svg>',
  chispa:'<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12 2l2.2 6.3L20.5 10l-6.3 2.2L12 18.5l-2.2-6.3L3.5 10l6.3-1.7z"/><path d="M19 15l.9 2.4 2.4.9-2.4.9L19 21.6l-.9-2.4-2.4-.9 2.4-.9z" opacity=".7"/></svg>'
};

/* ---------- Medios de pago ---------- */
const medioKeyDe=g=>g.cuentaId?"c:"+g.cuentaId:g.tarjetaId?"t:"+g.tarjetaId:g.medio==="Débito / Nequi"?"debito":"efectivo";
function medioNombre(k){
  if(!k)return null;
  if(k.startsWith("c:")){const c=S.cuentas.find(x=>x.id===k.slice(2));return c?c.nombre:null}
  if(k.startsWith("t:")){const t=S.tarjetas.find(x=>x.id===k.slice(2));return t?t.nombre:null}
  return k==="debito"?"Débito / Nequi":k==="efectivo"?"Efectivo":null;
}
function medioPorDefecto(){
  const last=S.gastos.slice().sort((a,b)=>(b.creado||0)-(a.creado||0))[0];
  const k=last?medioKeyDe(last):"efectivo";return medioNombre(k)?k:"efectivo";
}

/* ---------- Guardar y deshacer un gasto ---------- */
async function registrarGasto(o){
  const k=medioNombre(o.medioKey)?o.medioKey:"efectivo";
  const t=k.startsWith("t:")?S.tarjetas.find(x=>x.id===k.slice(2)):null;
  const c=k.startsWith("c:")?S.cuentas.find(x=>x.id===k.slice(2)):null;
  const usd=o.valorUsd!=null&&!!t&&!!t.usd;
  const valor=usd?Math.round(o.valorUsd*trm()):Math.round(o.valor||0);
  if(!valor)return null;
  const id=uid(),fecha=o.fecha||today(),categoria=o.categoria||cats()[0],nota=String(o.nota||"").trim();
  const sumar=!!t&&o.sumar!==false;
  const data={valor,valorUsd:usd?o.valorUsd:null,categoria,nota,fecha,medio:medioNombre(k),tarjetaId:t?t.id:null,cuentaId:c?c.id:null,creado:Date.now(),
    sumado:sumar?(usd?{usd:o.valorUsd}:{cop:valor}):null};
  await put("gastos",id,data);
  if(c)await moveAcct(c.id,-valor,{tipo:"gasto",nota:nota||categoria,fecha,ref:id});
  if(sumar){const f=S.tarjetas.find(x=>x.id===t.id)||t;
    await put("tarjetas",t.id,usd?{...strip(f),saldoUsd:Math.round(((f.saldoUsd||0)+o.valorUsd)*100)/100}:{...strip(f),saldo:(f.saldo||0)+valor})}
  return id;
}
async function deshacerGasto(id){
  const g=S.gastos.find(x=>x.id===id);if(!g)return;
  await undoRef(id);
  if(g.sumado&&g.tarjetaId){const t=S.tarjetas.find(x=>x.id===g.tarjetaId);
    if(t){if(g.sumado.usd!=null)await put("tarjetas",t.id,{...strip(t),saldoUsd:Math.max(0,Math.round(((t.saldoUsd||0)-g.sumado.usd)*100)/100)});
      else await put("tarjetas",t.id,{...strip(t),saldo:Math.max(0,(t.saldo||0)-(g.sumado.cop||0))})}}
  await del("gastos",id);toast("Gasto deshecho");
}

/* ---------- Escribir el gasto como hablas ---------- */
const CAT_KW={
  Comida:["almuerzo","almorzar","desayuno","cena","comida","comer","mercado","restaurante","rappi","domicilio","pizza","hamburguesa","burger","tinto","cafe","empanada","empanadas","pan","panaderia","fruta","frutas","onces","helado","mcdonalds","kfc","corral","perro caliente","arepa","pollo","sushi","jugo","gaseosa","snack","papas","d1","ara","exito","carulla","olimpica","jumbo","oxxo","tienda","galletas","chocolatina","pricesmart","lunch","breakfast","dinner","food","groceries","coffee","snacks"],
  Transporte:["uber","didi","taxi","bus","buseta","transmilenio","sitp","gasolina","tanqueo","parqueadero","peaje","indriver","cabify","picap","pasaje","pasajes","metro","tullave","bici","patineta","vuelo","tiquete","gas station","parking","fuel","train"],
  Salidas:["cine","cerveza","cervezas","pola","polas","bar","rumba","fiesta","discoteca","concierto","boleta","boletas","trago","tragos","salida","paseo","bolos","karaoke","teatro","movies","beer","party","drinks","concert"],
  Ropa:["ropa","camisa","camiseta","tenis","zapatos","pantalon","jean","jeans","chaqueta","buzo","gorra","medias","vestido","zara","nike","adidas","falda","bolso","clothes","shoes","shirt","sneakers","jacket"],
  Hogar:["arriendo","servicios","luz","agua","gas","internet","aseo","detergente","muebles","ferreteria","lavanderia","rent","utilities","cleaning","furniture"],
  Suscripciones:["netflix","spotify","disney","hbo","prime video","youtube premium","icloud","chatgpt","suscripcion","plan celular","claro","movistar","tigo","wom","crunchyroll","paramount","deezer","subscription","phone plan"],
  Juegos:["juego","juegos","steam","xbox","playstation","ps5","ps4","nintendo","fortnite","robux","roblox","valorant","free fire","minecraft","skin","skins","game pass","pavos","game","games"],
  Salud:["farmacia","drogueria","medicina","medicamento","medicamentos","medico","cita medica","eps","gimnasio","gym","dentista","odontologo","examen","examenes","pastillas","vitaminas","optica","gafas","copago","terapia","psicologo","pharmacy","doctor","medicine","dentist"]
};
const KW_LISTA=Object.entries(CAT_KW).flatMap(([c,ks])=>ks.map(k=>({k,c}))).sort((a,b)=>b.k.length-a.k.length);
const STOP_MEDIO=new Set(["de","del","la","el","y","mi","cuenta","ahorros","ahorro","tarjeta","credito","debito","card","banco","corriente","the","my"]);
const RELLENO=new Set(["en","con","de","del","por","para","el","la","los","las","un","una","unos","unas","me","mi","mis","pague","gaste","compre","y","a","al","que","pesos","peso","cop","plata","valor","fue","costo","credito","tarjeta","debito","cuenta","on","for","with","the","an","paid","spent","bought","at","in","of","my","and","to","$"]);
function tokensMedio(nombre){
  const n=norm(nombre);const t=n.split(/[^a-z0-9]+/).filter(w=>w.length>=2&&!STOP_MEDIO.has(w)&&!(/^\d+$/.test(w)&&w.length<3));
  if(n.includes("american express"))t.push("amex");
  if(n.includes("nubank"))t.push("nu");
  if(n.includes("mastercard"))t.push("master");
  return [...new Set(t)];
}
function interpretarGasto(texto){
  const raw=String(texto||"").trim();if(!raw)return null;
  let t=" "+norm(raw).replace(/[¿?¡!;:]/g," ").replace(/\s+/g," ")+" ";
  // 1) Con qué pagó
  let medioKey=null,mejor=0,quitar=[];
  [...S.cuentas.map(c=>({k:"c:"+c.id,n:c.nombre})),...S.tarjetas.map(x=>({k:"t:"+x.id,n:x.nombre}))].forEach(o=>{
    const toks=tokensMedio(o.n),full=norm(o.n);let sc=0;const usados=[];
    if(full.length>2&&t.includes(" "+full+" ")){sc+=5;usados.push(full)}
    toks.forEach(w=>{if(palabra(w).test(t)){sc++;usados.push(w)}});
    if(sc>mejor){mejor=sc;medioKey=o.k;quitar=usados}});
  if(medioKey)quitar.sort((a,b)=>b.length-a.length).forEach(w=>{t=t.replace(new RegExp("(^|\\s)"+escRx(w)+"(?=\\s)","g")," ")});
  else if(/\s(efectivo|cash)\s/.test(t)){medioKey="efectivo";t=t.replace(/\s(efectivo|cash)\s/g," ")}
  else if(!S.cuentas.length&&/\s(debito|nequi|daviplata)\s/.test(t)){medioKey="debito";t=t.replace(/\s(debito|nequi|daviplata)\s/g," ")}
  // 2) Cuándo
  let fecha=today();
  for(const [rx,n] of [[/\s(antes de ayer|anteayer|antier|day before yesterday)\s/,-2],[/\s(ayer|yesterday)\s/,-1],[/\s(hoy|today)\s/,0]]){
    if(rx.test(t)){fecha=iso(addDays(midnight(),n));t=t.replace(rx," ");break}}
  // 3) Cuánto
  let valor=null,valorUsd=null,supuesto=false,m;
  if((m=t.match(/(?:us\$|usd|u\$s)\s*(\d+(?:[.,]\d{1,2})?)|(\d+(?:[.,]\d{1,2})?)\s*(?:usd|us\$|dolares|dolar|dollars?|dls)(?=\s)/))){
    valorUsd=parseFloat((m[1]||m[2]).replace(",","."));valor=Math.round(valorUsd*(trm()||0))||null;t=t.replace(m[0]," ")}
  else if((m=t.match(/\s(medio|media)\s+(millon|palo|luca)(?=\s)/))){valor=m[2]==="luca"?500:500000;t=t.replace(m[0]," ")}
  else if((m=t.match(/\s(un|una)\s+(millon|palo|luca|barra)(?=\s)/))){valor=m[2]==="luca"?1000:1000000;t=t.replace(m[0]," ")}
  else if((m=t.match(/(\d+(?:[.,]\d+)?)\s*(mil|k|lucas|luca|millones|millon|palos|palo|barras|barra)(?=\s)/))){
    const n=parseFloat(m[1].replace(",","."));valor=Math.round(n*(/^(mil|k|lucas|luca)$/.test(m[2])?1e3:1e6));t=t.replace(m[0]," ")}
  else if((m=t.match(/\$?\s*(\d{1,3}(?:[.,]\d{3})+|\d+)(\s*pesos)?(?=\s)/))){
    let n=parseInt(m[1].replace(/[.,]/g,""),10);if(n<1000&&!m[2]){n*=1000;supuesto=true}valor=n;t=t.replace(m[0]," ")}
  else if((m=t.match(/\smil(?=\s)/))){valor=1000;t=t.replace(m[0]," ")}
  // 4) Categoría
  let categoria=null;
  for(const c of cats()){const nc=norm(c);if(nc&&palabra(nc).test(t)){categoria=c;break}}
  if(!categoria)for(const {k,c} of KW_LISTA){if(cats().includes(c)&&palabra(k).test(t)){categoria=c;break}}
  if(!categoria)categoria=cats().includes("Otros")?"Otros":cats()[cats().length-1];
  // 5) Nota: lo que sobra, con las tildes y mayúsculas originales
  const quedan={};t.split(/\s+/).filter(Boolean).forEach(w=>quedan[w]=(quedan[w]||0)+1);
  const toks=raw.split(/\s+/).filter(tk=>{const k=norm(tk).replace(/[¿?¡!;:,.]/g,"");if(!k||!quedan[k])return false;quedan[k]--;return true});
  const rell=tk=>RELLENO.has(norm(tk).replace(/[¿?¡!;:,.]/g,""));
  while(toks.length&&rell(toks[0]))toks.shift();while(toks.length&&rell(toks[toks.length-1]))toks.pop();
  const nota=toks.join(" ").replace(/[,.;:]+$/,"");
  return {valor,valorUsd,categoria,nota:nota?nota.charAt(0).toUpperCase()+nota.slice(1):"",fecha,medioKey,supuesto};
}
function chipsPrevia(r){
  if(!r)return"";
  const f=r.fecha===today()?"Hoy":r.fecha===iso(addDays(midnight(),-1))?"Ayer":fechaCorta(r.fecha);
  const monto=r.valorUsd!=null?fmtU(r.valorUsd):r.valor?fmt(r.valor):null;
  return `<span class="pchip cat">${esc(r.categoria)}</span>`+
    (monto?`<span class="pchip num">${esc(monto)}</span>`:`<span class="pchip warn">Falta el valor</span>`)+
    `<span class="pchip">${esc(medioNombre(r.medioKey||medioPorDefecto())||"Efectivo")}</span><span class="pchip">${esc(f)}</span>`+
    (r.nota?`<span class="pchip nota">${esc(r.nota)}</span>`:"");
}

/* ---------- Gastos rápidos ---------- */
function listaRapidos(){
  const out=(S.ajustes.rapidos||[]).filter(r=>medioNombre(r.medioKey)).map(r=>({...r,fijo:true}));
  const desde=iso(addDays(midnight(),-90)),grupos={};
  S.gastos.filter(g=>g.fecha>=desde&&g.valor).forEach(g=>{
    const k=[norm(g.nota||g.categoria),g.valorUsd!=null?"u"+g.valorUsd:g.valor,g.categoria,medioKeyDe(g)].join("|");
    const x=grupos[k]||(grupos[k]={nota:g.nota||"",valor:g.valor,valorUsd:g.valorUsd,categoria:g.categoria,medioKey:medioKeyDe(g),n:0,ult:0});
    x.n++;x.ult=Math.max(x.ult,g.creado||0)});
  Object.values(grupos).filter(x=>x.n>=2&&medioNombre(x.medioKey)).sort((a,b)=>b.n-a.n||b.ult-a.ult).forEach(a=>{
    if(out.length>=8)return;
    if(out.some(r=>norm(r.nota||r.categoria)===norm(a.nota||a.categoria)&&r.valor===a.valor))return;out.push(a)});
  return out.slice(0,8);
}
let RAPIDOS=[];
function renderRapidos(){
  RAPIDOS=listaRapidos();
  const el=$("#qChips");if(!el)return;
  const html=RAPIDOS.length?RAPIDOS.map((r,i)=>`<button type="button" class="qchip" data-rap="${i}"><span class="qc-n">${esc(r.nota||r.categoria)}</span><span class="qc-v num">${r.valorUsd!=null?fmtU(r.valorUsd):fmt(r.valor)}</span></button>`).join("")
    :`<p class="hint">Aquí aparecen tus gastos de siempre para guardarlos con un toque. Marca “Guardar como gasto rápido” al registrar uno, o repite un gasto dos veces y Luca lo pone aquí solo.</p>`;
  if(el.dataset.h!==html){el.dataset.h=html;el.innerHTML=html}
}
function guardarRapido(o){
  const lista=(S.ajustes.rapidos||[]).filter(r=>!(norm(r.nota||r.categoria)===norm(o.nota||o.categoria)&&r.valor===o.valor));
  S.ajustes.rapidos=[{id:uid(),nota:o.nota||"",valor:o.valor,valorUsd:o.valorUsd??null,categoria:o.categoria,medioKey:o.medioKey},...lista].slice(0,8);
  saveAjustes();
}
function renderRapList(){
  const el=$("#rapList");if(!el)return;
  const r=S.ajustes.rapidos||[];
  const html=(r.length?'<div class="list">'+r.map(x=>`<div class="item"><span class="dot info"></span><div class="main"><div class="t">${esc(x.nota||x.categoria)}</div><div class="s">${esc(x.categoria)} · ${esc(medioNombre(x.medioKey)||"Efectivo")}</div></div><div class="amt num">${x.valorUsd!=null?fmtU(x.valorUsd):fmt(x.valor)}</div><button class="x" data-delrap="${esc(x.id)}" aria-label="Quitar gasto rápido">✕</button></div>`).join("")+"</div>"
    :'<div class="empty">Todavía no tienes gastos rápidos guardados. Al registrar un gasto, marca “Guardar como gasto rápido”.</div>')+
    '<p class="hint">Los gastos que repites seguido también aparecen solos en el Resumen.</p>';
  if(el.dataset.h!==html){el.dataset.h=html;el.innerHTML=html}
}
document.addEventListener("click",async e=>{
  const ch=e.target.closest(".qchip[data-rap]");
  if(ch){const r=RAPIDOS[+ch.dataset.rap];if(!r||ch.disabled)return;ch.disabled=true;
    const id=await registrarGasto({...r,fecha:today()});ch.classList.add("ok");vibrar(12);setTimeout(()=>{ch.classList.remove("ok");ch.disabled=false},900);
    if(id)toast("Gasto guardado · "+(r.valorUsd!=null?fmtU(r.valorUsd):fmt(r.valor)),{label:"Deshacer",fn:()=>deshacerGasto(id)});return}
  const dr=e.target.closest("[data-delrap]");
  if(dr){S.ajustes.rapidos=(S.ajustes.rapidos||[]).filter(x=>x.id!==dr.dataset.delrap);saveAjustes();toast("Gasto rápido quitado");return}
});
(()=>{const q=$("#qText"),prev=$("#qPrev");
  const pintar=()=>{const r=interpretarGasto(q.value);prev.hidden=!r;prev.innerHTML=chipsPrevia(r)};
  q.addEventListener("input",pintar);
  $("#fQuick").onsubmit=async e=>{e.preventDefault();const r=interpretarGasto(q.value);
    if(!r){q.focus();toast("Escribe el gasto, por ejemplo: almuerzo 18 mil");return}
    if(!r.valor&&r.valorUsd==null){toast("Escribe también cuánto fue, por ejemplo: almuerzo 18 mil");q.focus();return}
    const id=await registrarGasto({...r,medioKey:r.medioKey||medioPorDefecto()});
    if(!id){toast("No se pudo guardar ese gasto");return}
    q.value="";pintar();q.blur();
    toast("Gasto guardado · "+(r.valorUsd!=null?fmtU(r.valorUsd):fmt(r.valor)),{label:"Deshacer",fn:()=>deshacerGasto(id)})};
  $("#qMas").onclick=()=>gastoSheet(null);
})();

/* ---------- Libre hasta la quincena ---------- */
function libreInfo(){
  const hoy=midnight(),np=nextPayday();
  const fin=np||new Date(hoy.getFullYear(),hoy.getMonth()+1,1);
  const dias=Math.max(1,daysUntil(fin));
  const obl=antesDe(fin).filter(i=>i.valor!=null);
  const oblTotal=obl.reduce((s,i)=>s+i.valor,0);
  const a=S.ajustes,totCtas=S.cuentas.reduce((s,c)=>s+(c.saldo||0),0);
  const {start}=cycleBounds();const ini=iso(start),hoyS=today();
  const enCiclo=x=>x.fecha>=ini&&x.fecha<=hoyS;
  let base=null,modo=null;
  if(S.cuentas.length&&totCtas>0){base=totCtas;modo="cuentas"}
  else if(a.montoPago){
    const ing=S.ingresos.filter(enCiclo).reduce((s,i)=>s+(i.valor||0),0);
    const bolsillo=S.gastos.filter(g=>enCiclo(g)&&!g.tarjetaId).reduce((s,g)=>s+(g.valor||0),0);
    const pagos=S.pagos.filter(enCiclo).reduce((s,p)=>s+(p.valor||0),0);
    base=(ing||a.montoPago)-bolsillo-pagos;modo="sueldo";
  }
  if(base==null)return{libre:null,fin,dias,np,start};
  const libre=base-oblTotal,porDia=libre/dias;
  const d14=iso(addDays(hoy,-13));
  const ritmo=S.gastos.filter(g=>g.fecha>=d14&&g.fecha<=hoyS&&!g.tarjetaId).reduce((s,g)=>s+(g.valor||0),0)/14;
  const estado=libre<=0?"rojo":(ritmo>0&&porDia<ritmo)?"amarillo":"verde";
  return{libre,porDia,dias,fin,np,start,obl,oblTotal,base,modo,ritmo,estado};
}
function renderLibre(){
  const el=$("#libreBox");if(!el)return;const I=libreInfo();
  if(I.libre==null){
    const html=`<div class="libre-top"><span class="eyebrow">Libre hasta tu próximo pago</span></div>
      <p class="libre-empty">Pon cuánto te pagan o la plata de tus cuentas y Luca te dice cuánto puedes gastar cada día.</p>
      <div class="hbtns"><button class="primary" data-go="mas">Poner mi sueldo</button><button data-go="tarjetas">Agregar una cuenta</button></div>`;
    if(el.dataset.h!==html){el.dataset.h=html;el.innerHTML=html;el.dataset.estado=""}return}
  const total=Math.max(1,Math.round((I.fin-I.start)/864e5)),pas=Math.min(total,Math.max(0,Math.round((midnight()-I.start)/864e5)));
  const est={verde:"Vas bien",amarillo:"A tu ritmo no alcanza",rojo:"En rojo"}[I.estado];
  const positivo=I.libre>0,valorBig=positivo?I.porDia:Math.abs(I.libre);
  const sub=positivo?`Tienes ${fmt(I.libre)} libres para ${nDias(I.dias)}.`:`Te faltan ${fmt(-I.libre)} para cubrir lo que vence antes de tu pago.`;
  const det=I.oblTotal?`Ya está descontado ${fmt(I.oblTotal)} que vence antes.`:I.modo==="cuentas"?"Según la plata en tus cuentas.":"Según tu sueldo y lo que llevas gastado.";
  const html=`<div class="libre-top"><span class="eyebrow">${esc(I.np?"Libre hasta tu pago del "+fechaDia(I.fin):"Libre hasta fin de mes")}</span><span class="pill ${I.estado}">${est}</span></div>
    <div class="libre-big num"><span id="libreNum">${positivo?"":"− "}${fmt(valorBig)}</span>${positivo?"<small>al día</small>":""}</div>
    <p class="sub"><span>${sub}</span> <span>${det}</span></p>
    <div class="libre-meter" role="img" aria-label="Día ${pas} de ${total} de este pago"><i style="width:${(pas/total*100).toFixed(1)}%"></i></div>
    <div class="hbtns"><button class="primary" id="btnAlcanza">¿Me alcanza?</button></div>`;
  if(el.dataset.h===html)return;
  const antes=+el.dataset.v||0;el.dataset.h=html;el.dataset.v=valorBig;el.dataset.estado=I.estado;el.innerHTML=html;
  $("#btnAlcanza").onclick=()=>alcanzaSheet();
  if(positivo&&Math.round(antes)!==Math.round(valorBig))contar($("#libreNum"),valorBig,{from:antes});
}

/* ---------- ¿Me alcanza? ---------- */
function veredicto(X,cat){
  const I=libreInfo();
  if(I.libre==null)return{v:"none",t:"Falta tu sueldo",d:"Pon cuánto te pagan en la pestaña Más, o tus cuentas de ahorro, para que Luca te pueda responder."};
  if(!X)return{v:"none",t:"Escribe cuánto cuesta",d:I.libre>0?`Hoy tienes ${fmt(I.libre)} libres hasta tu próximo pago.`:"Ahora mismo vas en rojo hasta tu próximo pago."};
  const despues=I.libre-X,dia=despues/I.dias;
  let v,t,d,x="";
  if(despues<0){v="rojo";t="Mejor espera";
    d=I.np?(I.dias===1?`Te faltarían ${fmt(-despues)}. Tu próximo pago llega mañana.`:`Te faltarían ${fmt(-despues)}. Tu próximo pago llega en ${nDias(I.dias)}.`):`Te faltarían ${fmt(-despues)} este mes.`}
  else if(X>I.libre*0.5||(I.ritmo>0&&dia<I.ritmo*0.8)){v="amarillo";t="Con cuidado";d=`Te alcanza, pero quedas con ${fmt(despues)} para ${nDias(I.dias)}: ${fmt(dia)} al día.`}
  else{v="verde";t="¡Sí te alcanza!";d=`Te quedan ${fmt(despues)} hasta tu próximo pago: ${fmt(dia)} al día.`}
  const lim=cat&&(S.ajustes.presupuestos||{})[cat];
  if(lim){const mk=monthKey(today());const g=S.gastos.filter(y=>monthKey(y.fecha)===mk&&y.categoria===cat).reduce((s,y)=>s+(y.valor||0),0);
    if(g+X>lim){x=`Te pasarías del presupuesto de esta categoría por ${fmt(g+X-lim)}.`;if(v==="verde"){v="amarillo";t="Con cuidado"}}
    else x=`Después de esta compra te quedan ${fmt(lim-g-X)} del presupuesto de esta categoría.`}
  return{v,t,d,x};
}
function alcanzaSheet(){
  let cat=null,ultimo="";
  openSheet("¿Me alcanza?",`<div class="stack">
    <label>¿Cuánto cuesta lo que quieres?<input id="maVal" class="money num" inputmode="numeric" placeholder="$ 0" autocomplete="off"></label>
    <div><div class="eyebrow" style="margin-bottom:6px">Categoría (opcional)</div><div class="cats" id="maCats">${cats().map(c=>`<button type="button" aria-pressed="false" data-c="${esc(c)}">${esc(c)}</button>`).join("")}</div></div>
    <div class="ver" id="maRes" data-v="none" aria-live="polite"></div>
    <button class="primary" id="maComprar" hidden>Lo compré: registrar gasto</button>
  </div>`,()=>{
    const inp=$("#maVal");
    const pintar=()=>{const X=parse(inp.value)||0,r=veredicto(X,cat),el=$("#maRes");
      el.dataset.v=r.v;el.innerHTML=`<div class="ver-ico">${{verde:ICO.ok,amarillo:ICO.ojo,rojo:ICO.no,none:ICO.q}[r.v]}</div><div class="ver-txt"><div class="ver-t">${r.t}</div><p class="ver-d">${r.d}</p>${r.x?`<p class="ver-x">${r.x}</p>`:""}</div>`;
      if(r.v!==ultimo&&r.v!=="none"&&!sinMovimiento()){el.classList.remove("pop");void el.offsetWidth;el.classList.add("pop")}ultimo=r.v;
      $("#maComprar").hidden=!X};
    inp.addEventListener("input",()=>{const n=parse(inp.value);inp.value=n==null?"":fmt(n);pintar()});
    $("#maCats").onclick=e=>{const b=e.target.closest("button");if(!b)return;cat=cat===b.dataset.c?null:b.dataset.c;
      $("#maCats").querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",x.dataset.c===cat));pintar()};
    $("#maComprar").onclick=()=>{const X=parse(inp.value);closeSheet();gastoSheet(null,{valor:X,categoria:cat||cats()[0]})};
    pintar();
  });
}

/* ---------- Avisos de pago ---------- */
function vencimientos(maxDias){
  const out=[],lim=addDays(midnight(),maxDias);
  S.tarjetas.forEach(t=>{if(!t.dia)return;
    const conSaldo=t.saldo!=null||t.saldoUsd!=null;if(conSaldo&&!((t.saldo||0)+(t.usd?(t.saldoUsd||0):0)))return;
    if(t.minimo===0&&!(t.usd&&t.minimoUsd>0))return;
    const d=nextOn(t.dia);if(d<=lim)out.push({id:"t-"+t.id,nombre:t.nombre,valor:minNA(t)?null:minTotal(t),date:d,dias:daysUntil(d),tipo:"tarjeta"})});
  (S.ajustes.fijos||[]).forEach((f,i)=>{if(!f.dia)return;const d=nextOn(f.dia);
    if(d<=lim&&f.pagado!==monthKey(iso(d)))out.push({id:"f-"+i+"-"+norm(f.nombre).replace(/\W+/g,""),nombre:f.nombre,valor:f.valor,date:d,dias:daysUntil(d),tipo:"fijo"})});
  return out.sort((a,b)=>a.date-b.date);
}
const venceTxt=n=>n===0?"Vence hoy":n===1?"Vence mañana":"Vence en "+n+" días";
function renderAviso(){
  const el=$("#avisoBox");if(!el)return;const it=vencimientos(2);
  const html=it.length?`<div class="av-head"><span class="av-ico">${ICO.campana}</span><b>Pagos que vencen pronto</b><button class="ghost" data-go="agenda">Ver agenda</button></div>
    <div class="av-list">${it.slice(0,4).map(i=>`<div class="av-row ${i.dias===0?"hoy":""}"><span class="av-n">${esc(i.nombre)}</span><span class="av-w">${venceTxt(i.dias)}</span><span class="av-v num">${i.valor==null?'<span class="na">Sin mínimo</span>':fmt(i.valor)}</span></div>`).join("")}</div>`:"";
  if(el.dataset.h!==html){el.dataset.h=html;el.innerHTML=html}
}
const AV_KEY="luca-avisos";
const avisosOn=()=>{try{return localStorage.getItem(AV_KEY)==="1"}catch(e){return false}};
const notifOk=()=>"Notification" in window&&"serviceWorker" in navigator;
const esIOS=()=>/iPhone|iPad|iPod/i.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
function renderAvisosPanel(){
  const b=$("#avOn"),h=$("#avEstado");if(!b||!h)return;
  let txt,btn="Activar avisos en este dispositivo",dis=false;
  if(!notifOk()){dis=true;txt=esIOS()?"En iPhone primero agrega Luca a la pantalla de inicio (Compartir → Agregar a inicio) y ábrela desde ahí. Mientras tanto, usa el calendario.":"Este navegador no permite avisos. Usa el calendario."}
  else if(Notification.permission==="denied"){dis=true;txt="Bloqueaste los avisos de Luca. Puedes permitirlos en los ajustes del navegador o del celular."}
  else if(avisosOn()&&Notification.permission==="granted"){btn="Desactivar avisos en este dispositivo";txt="Activos. Te avisamos al abrir Luca y, en Android, también en segundo plano cuando el sistema lo permite."}
  else txt="Te avisamos con una notificación del celular o del computador.";
  if(b.textContent!==btn)b.textContent=btn;b.disabled=dis;if(h.dataset.t!==txt){h.dataset.t=txt;h.textContent=txt}
}
async function guardarAvisosSW(){
  if(!("caches" in window))return;
  try{const items=vencimientos(40).map(i=>({id:i.id,nombre:i.nombre,valor:i.valor,fecha:iso(i.date)}));
    const c=await caches.open("luca-avisos");await c.put("avisos.json",new Response(JSON.stringify({lang:LANG,items}),{headers:{"content-type":"application/json"}}))}catch(e){}
}
async function registrarSync(){
  try{const reg=await navigator.serviceWorker.ready;if(!reg.periodicSync)return;
    const st=await navigator.permissions.query({name:"periodic-background-sync"});
    if(st.state==="granted")await reg.periodicSync.register("luca-avisos",{minInterval:12*60*60*1000})}catch(e){}
}
async function notificarHoy(){
  if(!avisosOn()||!notifOk()||Notification.permission!=="granted")return;
  let reg;try{reg=await navigator.serviceWorker.ready}catch(e){return}
  for(const i of vencimientos(1)){
    const k="luca-av-"+today()+"-"+i.id;try{if(localStorage.getItem(k))continue;localStorage.setItem(k,"1")}catch(e){}
    const title=LANG==="en"?i.nombre+(i.dias===0?" is due today":" is due tomorrow"):(i.dias===0?"Hoy vence ":"Mañana vence ")+i.nombre;
    const body=i.valor?L("Mínimo: ","Minimum: ")+fmt(i.valor):L("Abre Luca para ver el valor.","Open Luca to see the amount.");
    try{await reg.showNotification(title,{body,tag:"luca-"+i.id+"-"+iso(i.date),icon:"icons/icon-192.png",badge:"icons/icon-192.png",data:{url:"./"}})}catch(e){}
  }
}
$("#avOn").onclick=async()=>{
  if(!notifOk())return;
  if(avisosOn()&&Notification.permission==="granted"){try{localStorage.removeItem(AV_KEY)}catch(e){}renderAvisosPanel();toast("Avisos desactivados en este dispositivo");return}
  let p=Notification.permission;if(p==="default"){try{p=await Notification.requestPermission()}catch(e){}}
  if(p!=="granted"){renderAvisosPanel();toast("Sin permiso no podemos avisarte. Usa el calendario.");return}
  try{localStorage.setItem(AV_KEY,"1")}catch(e){}
  await guardarAvisosSW();await registrarSync();renderAvisosPanel();toast("Avisos activados");notificarHoy();
};
function descargarCalendario(){
  const ev=[],p2=n=>String(n).padStart(2,"0"),d=new Date();
  const stamp=d.getUTCFullYear()+p2(d.getUTCMonth()+1)+p2(d.getUTCDate())+"T"+p2(d.getUTCHours())+p2(d.getUTCMinutes())+"00Z";
  const icsEsc=s=>String(s).replace(/\\/g,"\\\\").replace(/;/g,"\\;").replace(/,/g,"\\,").replace(/\n/g,"\\n");
  const alarma=(tr,t)=>["BEGIN:VALARM","ACTION:DISPLAY","DESCRIPTION:"+icsEsc(t),"TRIGGER:"+tr,"END:VALARM"];
  const evento=(id,titulo,dia,desc,antes)=>{const f=nextOn(dia);if(!f)return;
    const rr=dia>28?"RRULE:FREQ=MONTHLY;BYMONTHDAY="+Array.from({length:dia-27},(_,i)=>28+i).join(",")+";BYSETPOS=-1":"RRULE:FREQ=MONTHLY;BYMONTHDAY="+dia;
    ev.push("BEGIN:VEVENT","UID:"+id+"@luca-app","DTSTAMP:"+stamp,"DTSTART:"+iso(f).replace(/-/g,"")+"T090000","DURATION:PT30M",rr,
      "SUMMARY:"+icsEsc(titulo),"DESCRIPTION:"+icsEsc(desc),...(antes?alarma("-P1D",titulo):[]),...alarma("PT0M",titulo),"END:VEVENT")};
  S.tarjetas.forEach(t=>t.dia&&evento("pago-"+t.id,L("Pagar ","Pay ")+t.nombre,t.dia,L("Fecha límite de pago de la tarjeta. Abre Luca para ver el mínimo.","Card payment due date. Open Luca to see the minimum."),true));
  (S.ajustes.fijos||[]).forEach((f,i)=>f.dia&&evento("fijo-"+i+"-"+norm(f.nombre).replace(/\W+/g,""),f.nombre+" · "+fmt(f.valor),f.dia,L("Gasto fijo. Márcalo como pagado en Luca.","Fixed expense. Mark it as paid in Luca."),true));
  (S.ajustes.diasPago||[]).forEach(dd=>evento("sueldo-"+dd,L("Te pagan","Payday"),dd,L("Registra en Luca cuánto te llegó.","Log in Luca how much you got."),false));
  if(!ev.length){toast("Primero pon los días de pago de tus tarjetas o de tus gastos fijos.");return}
  const ics=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Luca//Pagos//ES","CALSCALE:GREGORIAN","METHOD:PUBLISH","X-WR-CALNAME:"+L("Luca · pagos","Luca · payments"),...ev,"END:VCALENDAR"].join("\r\n");
  if(esIOS()){location.href="data:text/calendar;charset=utf-8,"+encodeURIComponent(ics);return}
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([ics],{type:"text/calendar;charset=utf-8"}));a.download="luca-pagos.ics";
  document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},800);
  toast("Abre el archivo para agregar las fechas a tu calendario");
}
$("#avCal").onclick=descargarCalendario;

/* ---------- Libre de deudas el… ---------- */
const tasaMes=t=>(t.interes!=null?t.interes:(S.ajustes.interes??2))/100;
function pagoMensual(t){
  const desde=iso(addDays(midnight(),-90));const ps=S.pagos.filter(p=>p.tarjetaId===t.id&&p.fecha>=desde);
  if(ps.length)return ps.reduce((s,p)=>s+(p.valor||0),0)/3;
  return minNA(t)?null:(minTotal(t)||null);
}
function simular(B,P,r){
  if(B<=0)return{meses:0,intereses:0};if(!P||P<=0||P<=B*r)return{meses:Infinity,intereses:Infinity};
  let b=B,n=0,int=0;while(b>0.5&&n<600){const i=b*r;int+=i;b=b+i-P;n++}
  return n>=600?{meses:Infinity,intereses:Infinity}:{meses:n,intereses:int};
}
const finEn=n=>{const d=new Date();d.setDate(1);d.setMonth(d.getMonth()+n);return d};
const nMeses=n=>n+" "+(n===1?"mes":"meses");
function payoffCard(t){
  const B=deudaCopCard(t);
  if(t.saldo==null&&t.saldoUsd==null)return"";
  if(B<=0)return`<div class="payoff ok"><span class="k">Libre de esta deuda</span><b>Al día, sin deuda</b></div>`;
  const P=pagoMensual(t);
  if(!P)return`<div class="payoff"><span class="k">Libre de esta deuda</span><span class="hint">Registra un pago o el mínimo para estimar cuándo terminas de pagarla.</span></div>`;
  const s=simular(B,P,tasaMes(t));
  if(!isFinite(s.meses))return`<div class="payoff warn"><span class="k">Libre de esta deuda</span><b>Así casi no baja</b><span class="hint">Con ${fmt(P)} al mes los intereses se comen casi todo el abono.</span></div>`;
  return`<div class="payoff"><span class="k">Libre de esta deuda</span><b>${mesAnio(finEn(s.meses))}</b><span class="hint">Pagando ${fmt(P)} al mes · estimado</span></div>`;
}
let pagoSim=null;
const red10=n=>Math.max(10000,Math.ceil(n/10000)*10000);
function datosDeuda(){
  const cs=S.tarjetas.filter(t=>deudaCopCard(t)>0);const B=cs.reduce((s,t)=>s+deudaCopCard(t),0);
  if(!B)return null;
  const r=cs.reduce((s,t)=>s+deudaCopCard(t)*tasaMes(t),0)/B;
  const base=cs.reduce((s,t)=>s+(pagoMensual(t)||0),0);
  const min=red10(B*r*1.25+10000);let max=red10(Math.max(B/6,min*3));
  const P0=Math.min(Math.max(red10(base||B*0.08),min),max*2);if(P0>max)max=red10(P0*1.5);
  return{B,r,P0,min,max};
}
function textoDeuda(D,P){
  const s=simular(D.B,P,D.r);const b=simular(D.B,D.P0,D.r);
  const fecha=isFinite(s.meses)?mesAnio(finEn(s.meses)):"—";
  const sub=isFinite(s.meses)?`En ${nMeses(s.meses)} · intereses aprox. ${fmt(s.intereses)}`:"Con ese pago la deuda casi no baja.";
  let gana="Mueve la barra para ver qué pasa si pagas más cada mes.";
  if(P!==D.P0&&isFinite(s.meses)&&isFinite(b.meses)){
    const dm=b.meses-s.meses,di=b.intereses-s.intereses;
    if(P>D.P0&&dm>0)gana=`Con ${fmt(P-D.P0)} más al mes terminas ${nMeses(dm)} antes y te ahorras ${fmt(di)} en intereses.`;
    else if(P>D.P0)gana=`Con ${fmt(P-D.P0)} más al mes te ahorras ${fmt(di)} en intereses.`;
    else if(dm<0)gana=`Con ${fmt(D.P0-P)} menos al mes terminas ${nMeses(-dm)} después y pagas ${fmt(-di)} más en intereses.`;
  }
  return{fecha,sub,gana,pago:`Pagando ${fmt(P)} al mes`};
}
function renderLibreDeuda(){
  const el=$("#libreDeudaBox");if(!el)return;const D=datosDeuda();
  if(!D){if(el.innerHTML){el.innerHTML="";el.dataset.h=""}return}
  if(pagoSim==null||pagoSim<D.min||pagoSim>D.max)pagoSim=D.P0;
  const x=textoDeuda(D,pagoSim);
  const html=`<div class="row-head"><h2>Libre de deudas</h2><span class="chip">Estimado</span></div>
    <div class="payoff-card">
      <div class="eyebrow" id="ldPago">${x.pago}</div>
      <div class="ld-fecha" id="ldFecha">${x.fecha}</div>
      <p class="sub" id="ldSub">${x.sub}</p>
      <input type="range" id="ldRange" min="${D.min}" max="${D.max}" step="10000" value="${pagoSim}" aria-label="Cuánto pagas al mes">
      <div class="range-lab num"><span>${fmt(D.min)}</span><span>${fmt(D.max)}</span></div>
      <p class="hint" id="ldGana">${x.gana}</p>
      <p class="hint">Suma tus tarjetas (${fmt(D.B)}) con un interés de ${String(Math.round(D.r*1000)/10).replace(".",",")}% mensual. No incluye cuotas de manejo ni seguros.</p>
    </div>`;
  if(el.dataset.h===html)return;el.dataset.h=html;el.innerHTML=html;
  $("#ldRange").addEventListener("input",e=>{pagoSim=+e.target.value;const y=textoDeuda(D,pagoSim);
    $("#ldPago").textContent=y.pago;$("#ldFecha").textContent=y.fecha;$("#ldSub").textContent=y.sub;$("#ldGana").textContent=y.gana});
}

/* ---------- Metas: abono animado y confeti ---------- */
function confeti(n=170){
  if(sinMovimiento())return;
  const cv=document.createElement("canvas");cv.className="confeti";document.body.appendChild(cv);
  const ctx=cv.getContext("2d"),dpr=Math.min(2,devicePixelRatio||1);
  const W=cv.width=innerWidth*dpr,H=cv.height=innerHeight*dpr;
  const col=["#0071E3","#30D158","#FF9F0A","#FF375F","#BF5AF2","#FFD60A","#64D2FF"];
  const ps=Array.from({length:n},()=>({x:W/2+(Math.random()-.5)*W*.3,y:H*.42,vx:(Math.random()-.5)*16*dpr,vy:(-Math.random()*17-6)*dpr,r:(4+Math.random()*5)*dpr,c:col[Math.random()*col.length|0],a:Math.random()*6,va:(Math.random()-.5)*.35}));
  const t0=performance.now();
  const frame=t=>{ctx.clearRect(0,0,W,H);ps.forEach(p=>{p.vy+=.42*dpr;p.vx*=.99;p.x+=p.vx;p.y+=p.vy;p.a+=p.va;
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.a);ctx.fillStyle=p.c;ctx.fillRect(-p.r,-p.r*.45,p.r*2,p.r*.9);ctx.restore()});
    if(t-t0<3200)requestAnimationFrame(frame);else cv.remove()};
  requestAnimationFrame(frame);
}
function celebrar({titulo,nombre,antes,despues,texto,boton}){
  const el=document.createElement("div");el.className="celebra";el.setAttribute("role","dialog");el.setAttribute("aria-modal","true");
  el.innerHTML=`<div class="celebra-card"><div class="eyebrow">${titulo}</div><h2>${esc(nombre)}</h2>
    <div class="ce-p num" id="ceP">${Math.round(Math.min(100,antes))}%</div>
    <div class="meter ce-bar"><i id="ceBar" style="width:${Math.min(100,antes)}%"></i></div>
    <p class="sub">${texto}</p><button class="primary" id="ceOk">${boton||"Listo"}</button></div>`;
  document.body.appendChild(el);
  const cerrar=()=>{el.classList.add("out");setTimeout(()=>el.remove(),220)};
  $("#ceOk").onclick=cerrar;el.addEventListener("click",e=>{if(e.target===el)cerrar()});
  requestAnimationFrame(()=>requestAnimationFrame(()=>{$("#ceBar").style.width=Math.min(100,despues)+"%";
    contar($("#ceP"),Math.min(100,despues),{dur:1200,from:Math.min(100,antes),f:v=>Math.round(v)+"%"})}));
  if(despues>=100&&antes<100)setTimeout(()=>confeti(),650);
  setTimeout(()=>$("#ceOk")&&$("#ceOk").focus(),60);
}
function abonoSheet(m){
  openSheet("Abonar a la meta",`<form id="fAbono">
    <p class="muted" style="margin:0">${esc(m.nombre)}</p>
    <label>¿Cuánto guardaste?<input id="abVal" class="money num" inputmode="numeric" placeholder="$ 0"></label>
    ${S.cuentas.length?`<label>¿Sale de alguna cuenta?<select id="abCta"><option value="">No, solo sumar a la meta</option>${S.cuentas.map(c=>`<option value="${esc(c.id)}">${esc(c.nombre)}</option>`).join("")}</select></label>`:""}
    <button class="primary" type="submit">Abonar</button></form>`,()=>{
    liveMoney($("#abVal"));
    $("#fAbono").onsubmit=async e=>{e.preventDefault();const v=parse($("#abVal").value);if(!v){toast("Escribe cuánto guardaste");return}
      const c=S.cuentas.find(x=>x.id===($("#abCta")?.value||""));
      const fresh=S.metas.find(x=>x.id===m.id)||m;const ah0=fresh.ahorrado||0,ah1=ah0+v,obj=fresh.objetivo||0;
      closeSheet();await put("metas",m.id,{...strip(fresh),ahorrado:ah1});
      if(c)await moveAcct(c.id,-v,{tipo:"salida",nota:L("Abono a meta: ","Saved toward goal: ")+fresh.nombre,fecha:today()});
      const p0=obj?ah0/obj*100:0,p1=obj?ah1/obj*100:0;
      celebrar({titulo:p1>=100?"¡Meta cumplida!":"Abono guardado",nombre:fresh.nombre,antes:p0,despues:p1,
        texto:p1>=100?`Juntaste ${fmt(ah1)}. Lo lograste.`:`Abonaste ${fmt(v)}. Te faltan ${fmt(obj-ah1)}.`,boton:p1>=100?"¡Listo!":"Listo"});
    };
  });
}
function celebrarDeuda(t){
  confeti();toast(L("¡Pagaste toda la deuda de ","You paid off ")+t.nombre+L("!","!"));
}

/* ---------- Resumen del mes (tipo Wrapped) ---------- */
function datosMes(mk){
  const gm=S.gastos.filter(g=>monthKey(g.fecha)===mk);
  const [y,m]=mk.split("-").map(Number);const diasMes=new Date(y,m,0).getDate();
  const diasPasados=mk===monthKey(today())?new Date().getDate():mk>monthKey(today())?0:diasMes;
  const total=gm.reduce((s,g)=>s+(g.valor||0),0);
  const porDia={};gm.forEach(g=>porDia[g.fecha]=(porDia[g.fecha]||0)+(g.valor||0));
  const diaTop=Object.entries(porDia).sort((a,b)=>b[1]-a[1])[0]||null;
  let sinGastar=0;for(let d=1;d<=diasPasados;d++)if(!porDia[mk+"-"+String(d).padStart(2,"0")])sinGastar++;
  const pc={};gm.forEach(g=>{const c=g.categoria||"Otros";pc[c]=(pc[c]||0)+(g.valor||0)});
  const porCat=Object.entries(pc).sort((a,b)=>b[1]-a[1]);
  const mayor=gm.slice().sort((a,b)=>(b.valor||0)-(a.valor||0))[0]||null;
  const pagos=S.pagos.filter(p=>monthKey(p.fecha)===mk).reduce((s,p)=>s+(p.valor||0),0);
  const ingresos=S.ingresos.filter(i=>monthKey(i.fecha)===mk).reduce((s,i)=>s+(i.valor||0),0);
  return{mk,y,m,gm,total,n:gm.length,promedio:total/Math.max(1,diasPasados),diaTop,sinGastar,porCat,mayor,pagos,ingresos,mesNombre:MESES[m-1]};
}
function mesParaResumen(){
  const cur=monthKey(today()),d=new Date();d.setDate(1);d.setMonth(d.getMonth()-1);const prev=monthKey(iso(d));
  const nc=S.gastos.filter(g=>monthKey(g.fecha)===cur).length,np=S.gastos.filter(g=>monthKey(g.fecha)===prev).length;
  if(nc>=3)return cur;if(np&&new Date().getDate()<=10)return prev;return nc?cur:np?prev:null;
}
function renderWrapPromo(){
  const b=$("#wrapBox");if(!b)return;const mk=mesParaResumen();
  if(!mk){b.hidden=true;return}
  const n=MESES[+mk.slice(5)-1];
  const html=`<span class="wp-ico">${ICO.chispa}</span><span class="wp-txt"><b>Tu ${n} en Luca</b><span>Mira tu resumen del mes</span></span><span class="chev" aria-hidden="true">›</span>`;
  if(b.dataset.h!==html){b.dataset.h=html;b.innerHTML=html}b.hidden=false;b.dataset.mk=mk;
}
function abrirResumen(mk){
  const D=datosMes(mk);
  if(!D.n){toast("Todavía no hay gastos en ese mes.");return}
  const nombre=typeof nombreUsuario==="function"?nombreUsuario():"";
  const lg='<img class="st-logo" src="logo/logo.svg" alt="">';
  const S_=[];
  S_.push({bg:"linear-gradient(160deg,#0071E3 0%,#5E5CE6 100%)",html:`${lg}${nombre?`<div class="st-k">${esc(nombre)}</div>`:""}<div class="st-k">Tu resumen de</div><div class="st-h">${D.mesNombre}</div><div class="st-s">Así se movió tu plata este mes.</div>`});
  S_.push({bg:"linear-gradient(160deg,#FF375F 0%,#FF9F0A 100%)",html:`<div class="st-k">Este mes gastaste</div><div class="st-big num" data-n="${D.total}">${fmt(0)}</div><div class="st-s">En ${D.n} ${D.n===1?"gasto":"gastos"}.</div><div class="st-s">Promedio por día: ${fmt(D.promedio)}</div>`});
  if(D.porCat.length){const [c,v]=D.porCat[0];const top=D.porCat.slice(0,4),mx=top[0][1]||1;
    S_.push({bg:"linear-gradient(160deg,#30D158 0%,#0A84FF 100%)",html:`<div class="st-k">Lo que más te gustó</div><div class="st-h">${esc(c)}</div><div class="st-big num" data-n="${v}">${fmt(0)}</div><div class="st-s">${Math.round(v/(D.total||1)*100)}% de todo lo que gastaste</div>
      <div class="st-bars">${top.map(([cc,vv])=>`<div class="st-bar"><span>${esc(cc)}</span><span class="num">${fmt(vv)}</span><i style="--w:${(vv/mx*100).toFixed(1)}%"></i></div>`).join("")}</div>`})}
  if(D.diaTop){const d=new Date(D.diaTop[0]+"T00:00:00");
    S_.push({bg:"linear-gradient(160deg,#5E5CE6 0%,#BF5AF2 100%)",html:`<div class="st-k">Tu día más intenso</div><div class="st-h st-h2">${esc(fechaLarga(d))}</div><div class="st-big num" data-n="${D.diaTop[1]}">${fmt(0)}</div><div class="st-s">${D.sinGastar?`Y tuviste ${nDias(D.sinGastar)} sin gastar ni un peso.`:"No hubo un solo día sin gastos."}</div>`})}
  if(D.mayor){S_.push({bg:"linear-gradient(160deg,#FF9F0A 0%,#FF375F 100%)",html:`<div class="st-k">Tu gasto más grande</div><div class="st-h st-h2">${esc(D.mayor.nota||D.mayor.categoria)}</div><div class="st-big num" data-n="${D.mayor.valor||0}">${fmt(0)}</div><div class="st-s">${esc(fechaCorta(D.mayor.fecha))} · ${esc(D.mayor.medio||"")}</div>`})}
  if(D.pagos)S_.push({bg:"linear-gradient(160deg,#0A84FF 0%,#30D158 100%)",html:`<div class="st-k">A tus tarjetas les abonaste</div><div class="st-big num" data-n="${D.pagos}">${fmt(0)}</div><div class="st-s">Cada abono te acerca a estar libre de deudas.</div>`});
  const meta=S.metas.filter(x=>x.objetivo).sort((a,b)=>(b.ahorrado||0)/b.objetivo-(a.ahorrado||0)/a.objetivo)[0];
  S_.push({bg:"linear-gradient(160deg,#1D1D1F 0%,#0071E3 100%)",fin:true,html:`${lg}<div class="st-k">Así cerró tu mes</div>
    <div class="st-rows">${D.ingresos?`<div><span>Entró</span><b class="num">${fmt(D.ingresos)}</b></div>`:""}<div><span>Gastaste</span><b class="num">${fmt(D.total)}</b></div>${D.pagos?`<div><span>Abonaste a tarjetas</span><b class="num">${fmt(D.pagos)}</b></div>`:""}${meta?`<div><span>${esc(meta.nombre)}</span><b class="num">${Math.min(100,Math.round((meta.ahorrado||0)/meta.objetivo*100))}%</b></div>`:""}</div>
    <div class="st-acts"><button class="st-btn" id="stShare">Compartir</button><button class="st-btn ghost" id="stClose2">Cerrar</button></div><div class="st-foot">Hecho con Luca</div>`});
  const el=document.createElement("div");el.className="story";el.setAttribute("role","dialog");el.setAttribute("aria-modal","true");el.setAttribute("aria-label","Resumen del mes");
  el.innerHTML=`<div class="st-prog">${S_.map(()=>'<span class="st-seg"><i></i></span>').join("")}</div><button class="st-x" aria-label="Cerrar">✕</button><div class="st-stage"></div>`;
  document.body.appendChild(el);document.documentElement.classList.add("no-scroll");
  let i=0,timer=null;const DUR=5200;
  const cerrar=()=>{clearTimeout(timer);el.classList.add("out");document.documentElement.classList.remove("no-scroll");document.removeEventListener("keydown",tecla);setTimeout(()=>el.remove(),250)};
  const ir=n=>{if(n<0)n=0;if(n>=S_.length){cerrar();return}i=n;clearTimeout(timer);
    el.querySelectorAll(".st-seg").forEach((s,k)=>{s.className="st-seg"+(k<i?" done":k===i?" now":"")});
    const s=S_[i];const st=el.querySelector(".st-stage");st.style.background=s.bg;
    st.innerHTML=`<div class="st-slide">${s.html}</div>`;
    st.querySelectorAll("[data-n]").forEach(x=>contar(x,+x.dataset.n,{dur:1100}));
    if(s.fin){const sh=$("#stShare");sh.onclick=async ev=>{ev.stopPropagation();
        const txt=L(`Mi ${D.mesNombre} en Luca: gasté ${fmt(D.total)} en ${D.n} gastos. Lo que más: ${D.porCat[0]?D.porCat[0][0]:""}.`,`My ${D.mesNombre} on Luca: I spent ${fmt(D.total)} in ${D.n} expenses. Top category: ${D.porCat[0]?tr(D.porCat[0][0]):""}.`);
        const url=location.origin+location.pathname;
        try{if(navigator.share){await navigator.share({title:"Luca",text:txt,url});return}}catch(e){return}
        try{await navigator.clipboard.writeText(txt+" "+url);toast("Copiado. Pégalo donde quieras.")}catch(e){}};
      $("#stClose2").onclick=ev=>{ev.stopPropagation();cerrar()}}
    else timer=setTimeout(()=>ir(i+1),DUR)};
  const tecla=e=>{if(e.key==="Escape")cerrar();else if(e.key==="ArrowRight")ir(i+1);else if(e.key==="ArrowLeft")ir(i-1)};
  document.addEventListener("keydown",tecla);
  el.querySelector(".st-x").onclick=cerrar;
  el.querySelector(".st-stage").addEventListener("click",e=>{if(e.target.closest("button"))return;const r=el.getBoundingClientRect();ir(e.clientX-r.left<r.width*.3?i-1:i+1)});
  ir(0);
}
$("#wrapBox").onclick=()=>{const mk=$("#wrapBox").dataset.mk;if(mk)abrirResumen(mk)};
$("#wrapMes").onclick=()=>abrirResumen(mes);

/* ---------- Idioma ---------- */
function renderIdioma(){
  document.querySelectorAll("#idiomaSeg [data-lang]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.lang===LANG));
  document.querySelectorAll("[data-setlang]").forEach(b=>b.hidden=b.dataset.setlang===LANG);
}
$("#idiomaSeg").addEventListener("click",e=>{const b=e.target.closest("[data-lang]");if(b&&b.dataset.lang!==LANG)setLang(b.dataset.lang)});
document.querySelectorAll("[data-setlang]").forEach(b=>b.onclick=()=>setLang(b.dataset.setlang));
renderIdioma();

/* ---------- Todo junto ---------- */
let avisoTimer=null;
function renderExtras(T){
  if(typeof renderPro==="function"&&T)renderPro(T);
  renderAviso();renderLibre();renderRapidos();renderWrapPromo();renderLibreDeuda();renderRapList();renderAvisosPanel();
  clearTimeout(avisoTimer);avisoTimer=setTimeout(()=>{if(user){guardarAvisosSW();notificarHoy()}},1500);
}
/* Título compacto al hacer scroll, como en iPhone */
(()=>{const m=document.createElement("div");m.id="navMini";m.setAttribute("aria-hidden","true");document.body.appendChild(m);
  const upd=()=>{const t=$("#pageTitle");const on=!$("#app").hidden&&scrollY>70&&innerWidth<960;if(on&&t&&m.textContent!==t.textContent)m.textContent=t.textContent;m.classList.toggle("on",on)};
  addEventListener("scroll",upd,{passive:true});addEventListener("resize",upd)})();
renderAvisosPanel();
init();
