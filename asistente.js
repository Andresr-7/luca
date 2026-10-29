"use strict";
/* Luca 2.1 — Pregúntale a Luca (respuestas sobre tus datos, sin enviar nada a internet) y bloqueo con huella / Face ID. */

/* ---------- Pregúntale a Luca ---------- */
function periodo(q){
  const h=midnight(),y=h.getFullYear(),m=h.getMonth(),d=x=>iso(x);
  if(/\bhoy|today\b/.test(q))return{desde:today(),hasta:today(),txt:"hoy"};
  if(/\bayer|yesterday\b/.test(q)){const a=d(addDays(h,-1));return{desde:a,hasta:a,txt:"ayer"}}
  if(/semana pasada|last week/.test(q))return{desde:d(addDays(h,-13)),hasta:d(addDays(h,-7)),txt:"la semana pasada"};
  if(/semana|week/.test(q))return{desde:d(addDays(h,-6)),hasta:today(),txt:"los últimos 7 días"};
  if(/mes pasado|last month/.test(q)){const a=new Date(y,m-1,1),b=new Date(y,m,0);return{desde:d(a),hasta:d(b),txt:MESES[a.getMonth()].toLowerCase()}}
  if(/\bano|year\b/.test(q))return{desde:y+"-01-01",hasta:today(),txt:"este año"};
  for(let i=0;i<12;i++){const n=norm(MESES[i]);if(new RegExp("\\b"+n+"\\b").test(q)){const yy=i>m?y-1:y;return{desde:d(new Date(yy,i,1)),hasta:d(new Date(yy,i+1,0)),txt:MESES[i].toLowerCase()}}}
  return{desde:d(new Date(y,m,1)),hasta:today(),txt:"este mes"};
}
function tarjetaEn(q){let best=null,sc=0;S.tarjetas.forEach(t=>{const s=tokensMedio(t.nombre).filter(w=>palabra(w).test(" "+q+" ")).length;if(s>sc){sc=s;best=t}});return best}
function categoriaEn(q){for(const c of cats())if(palabra(norm(c)).test(" "+q+" "))return c;for(const {k,c} of KW_LISTA)if(cats().includes(c)&&palabra(k).test(" "+q+" "))return{c,k};return null}
function responder(texto){
  const q=" "+norm(texto).replace(/[¿?¡!.,]/g," ")+" ";
  const P=periodo(q),t=tarjetaEn(q),cm=categoriaEn(q);
  const cat=typeof cm==="string"?cm:null,kw=cm&&typeof cm==="object"?cm:null;
  const enPer=g=>g.fecha>=P.desde&&g.fecha<=P.hasta;
  // ¿Cuánto puedo gastar?
  if(/puedo gastar|me queda|libre|alcanza|disponible hoy|can i spend|left/.test(q)){const I=libreInfo();
    if(I.libre==null)return"Todavía no sé cuánto te pagan. Ponlo en Más → Tu sueldo y te respondo.";
    return I.libre>0?`Puedes gastar ${fmt(I.porDia)} al día hasta tu pago${I.np?" del "+fechaDia(I.fin):""}. En total tienes ${fmt(I.libre)} libres.`:`Ahora mismo vas en rojo: te faltan ${fmt(-I.libre)} para cubrir lo que vence antes de tu pago.`}
  // Fechas de pago
  if(/cuando|vence|fecha|due/.test(q)&&(t||/tarjeta|pago|pagar|card/.test(q))){
    if(t){const d=dueInfo(t.dia);return d?`${t.nombre} vence el ${fechaLarga(d.date)} (${d.label.toLowerCase()}). Mínimo: ${minNA(t)?"aún no disponible":minLabel(t)}.`:`No tengo la fecha de pago de ${t.nombre}. Ponla en Cuentas → Editar.`}
    const v=vencimientos(31).slice(0,4);return v.length?"Lo próximo que vence:\n"+v.map(i=>`• ${i.nombre}: ${fechaDia(i.date)}${i.valor?" · "+fmt(i.valor):""}`).join("\n"):"No tienes pagos en los próximos 30 días."}
  // Cupo
  if(/cupo|limite|limit/.test(q)){const L=(t?[t]:S.tarjetas).filter(x=>x.cupo);if(!L.length)return"No tengo el cupo de tus tarjetas. Agrégalo en Cuentas → Editar.";
    return L.map(x=>{const u=deudaCopCard(x);return`• ${x.nombre}: usas ${Math.round(u/x.cupo*100)}%, disponible ${fmt(Math.max(0,x.cupo-u))}`}).join("\n")}
  // Deuda
  if(/debo|deuda|owe|debt/.test(q)){if(t)return`Le debes ${fmt(deudaCopCard(t))} a ${t.nombre}${t.usd&&t.saldoUsd?` (incluye ${fmtU(t.saldoUsd)})`:""}.`;
    const tot=sumar(S.tarjetas,deudaCopCard);const D=datosDeuda();let s=`Debes ${fmt(tot)} en ${S.tarjetas.filter(x=>deudaCopCard(x)>0).length} tarjetas.`;
    if(D){const r=simular(D.B,D.P0,D.r);if(isFinite(r.meses))s+=` Pagando ${fmt(D.P0)} al mes quedas libre en ${mesAnio(finEn(r.meses))}.`}return s}
  // Plata en cuentas
  if(/cuentas|ahorro|saldo|tengo en|savings|balance/.test(q)){if(!S.cuentas.length)return"No tienes cuentas de ahorro registradas.";
    return`Tienes ${fmt(sumar(S.cuentas,c=>c.saldo))} en tus cuentas:\n`+S.cuentas.map(c=>`• ${c.nombre}: ${fmt(c.saldo)}`).join("\n")}
  // Mayor gasto
  if(/mayor|mas caro|mas grande|biggest/.test(q)){const g=S.gastos.filter(enPer).sort((a,b)=>b.valor-a.valor)[0];return g?`Tu gasto más grande ${P.txt}: ${g.nota||g.categoria}, ${fmt(g.valor)} el ${fechaCorta(g.fecha)}.`:`No tienes gastos ${P.txt}.`}
  // En qué se va
  if(/en que|donde|categoria|where/.test(q)&&!cat&&!kw&&!t){const pc={};S.gastos.filter(enPer).forEach(g=>pc[g.categoria]=(pc[g.categoria]||0)+g.valor);const top=Object.entries(pc).sort((a,b)=>b[1]-a[1]).slice(0,3);
    return top.length?`${P.txt.charAt(0).toUpperCase()+P.txt.slice(1)} tu plata se fue en:\n`+top.map(([c,v])=>`• ${c}: ${fmt(v)}`).join("\n"):`No tienes gastos ${P.txt}.`}
  // Gasto (por defecto)
  if(/gast|cuanto|llevo|spent|spend|how much/.test(q)||cat||kw||t){
    let L=S.gastos.filter(enPer),filtro="";
    if(t){L=L.filter(g=>g.tarjetaId===t.id);filtro=" con "+t.nombre}
    else if(cat){L=L.filter(g=>g.categoria===cat);filtro=" en "+cat}
    else if(kw){const k=kw.k;const n=L.filter(g=>palabra(k).test(" "+norm(g.nota)+" "));L=n.length?n:L.filter(g=>g.categoria===kw.c);filtro=n.length?" en "+k:" en "+kw.c}
    const tot=sumar(L,g=>g.valor);if(!L.length)return`No encontré gastos${filtro} ${P.txt}.`;
    return`${P.txt.charAt(0).toUpperCase()+P.txt.slice(1)} gastaste ${fmt(tot)}${filtro} en ${L.length} ${L.length===1?"gasto":"gastos"}.`+(L.length>1?"\nLos más grandes:\n"+L.sort((a,b)=>b.valor-a.valor).slice(0,3).map(g=>`• ${g.nota||g.categoria}: ${fmt(g.valor)} (${fechaCorta(g.fecha)})`).join("\n"):"")}
  return"Todavía no entiendo esa pregunta. Prueba con una de las sugerencias de abajo.";
}
const SUGS=["¿Cuánto puedo gastar hoy?","¿Cuánto gasté en comida este mes?","¿Cuándo vence Nubank?","¿Cuánto debo?","¿En qué se me va la plata?","¿Cuál fue mi gasto más grande?","¿Cuánto tengo en mis cuentas?","¿Cómo voy con el cupo?"];
function preguntaSheet(){
  const sug=SUGS.map(s=>{if(/Nubank/.test(s)){const t=S.tarjetas[0];return t?s.replace("Nubank",t.nombre):null}return s}).filter(Boolean);
  openSheet("Pregúntale a Luca",`<div class="chat" id="chat"><div class="msg luca">Hola. Pregúntame lo que quieras sobre tu plata: gastos, deudas, fechas o cuánto puedes gastar. Todo se calcula aquí en tu celular.</div></div>
    <div class="qchips sugs" id="sugs">${sug.map(s=>`<button type="button" class="qchip sug">${esc(s)}</button>`).join("")}</div>
    <form id="fPreg" class="quick-in" novalidate><input id="pregIn" placeholder="Escribe tu pregunta…" autocomplete="off" enterkeyhint="send"><button class="primary" type="submit" aria-label="Preguntar"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg></button></form>`,()=>{
    const chat=$("#chat");
    const decir=q=>{if(!q.trim())return;chat.insertAdjacentHTML("beforeend",`<div class="msg yo">${esc(q)}</div>`);
      const r=responder(q);setTimeout(()=>{chat.insertAdjacentHTML("beforeend",`<div class="msg luca">${esc(r).replace(/\n/g,"<br>")}</div>`);chat.lastElementChild.scrollIntoView({behavior:"smooth",block:"end"});vibrar(6)},250)};
    $("#fPreg").onsubmit=e=>{e.preventDefault();const i=$("#pregIn");decir(i.value);i.value=""};
    $("#sugs").onclick=e=>{const b=e.target.closest(".sug");if(b)decir(b.textContent)};
  });
}

/* ---------- Bloqueo con huella / Face ID (local, con WebAuthn) ---------- */
const LOCK_KEY="luca-bloqueo";
const b64=a=>btoa(String.fromCharCode(...new Uint8Array(a))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const unb64=s=>Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/")),c=>c.charCodeAt(0));
const rnd=n=>crypto.getRandomValues(new Uint8Array(n));
const lockId=()=>{try{return localStorage.getItem(LOCK_KEY)}catch(e){return null}};
/* En la app de Android (Capacitor) se usa la huella nativa; en web, WebAuthn */
const BioNativa=()=>window.Capacitor&&Capacitor.isNativePlatform&&Capacitor.isNativePlatform()&&Capacitor.Plugins&&Capacitor.Plugins.BiometricAuthNative;
async function bioNativaOk(){try{const r=await BioNativa().checkBiometry();return !!(r&&(r.isAvailable||r.deviceIsSecure))}catch(e){return false}}
async function bioNativaAuth(){await BioNativa().internalAuthenticate({reason:"Desbloquea Luca",title:"Luca",subtitle:"Usa tu huella o tu rostro",cancelTitle:"Cancelar",allowDeviceCredential:true,androidTitle:"Luca",androidSubtitle:"Usa tu huella o tu rostro",androidConfirmationRequired:false})}
async function bioDisponible(){if(BioNativa())return bioNativaOk();try{return !!(window.PublicKeyCredential&&await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())}catch(e){return false}}
async function activarBloqueo(){
  if(BioNativa()){try{await bioNativaAuth();localStorage.setItem(LOCK_KEY,"nativo");toast("Bloqueo activado")}catch(e){toast("No se pudo activar. Revisa que tu celular tenga huella configurada.")}renderSeguridad();return}
  try{const c=await navigator.credentials.create({publicKey:{challenge:rnd(32),rp:{name:"Luca"},user:{id:rnd(16),name:"luca",displayName:"Luca"},
      pubKeyCredParams:[{type:"public-key",alg:-7},{type:"public-key",alg:-257}],authenticatorSelection:{authenticatorAttachment:"platform",userVerification:"required",residentKey:"discouraged"},timeout:60000}});
    localStorage.setItem(LOCK_KEY,b64(c.rawId));toast("Bloqueo activado");}catch(e){toast("No se pudo activar. Revisa que tu celular tenga huella o Face ID configurado.")}
  renderSeguridad();
}
async function desbloquear(){
  if(BioNativa()){try{await bioNativaAuth();$("#lockScreen")?.remove();vibrar(10);return true}catch(e){return false}}
  try{await navigator.credentials.get({publicKey:{challenge:rnd(32),allowCredentials:[{type:"public-key",id:unb64(lockId())}],userVerification:"required",timeout:60000}});
    $("#lockScreen")?.remove();vibrar(10);return true}catch(e){return false}
}
function mostrarBloqueo(){
  if(!lockId()||$("#lockScreen")||!user)return;
  const el=document.createElement("div");el.id="lockScreen";el.innerHTML=`<img class="lk-logo" src="logo/logo.svg" alt=""><h2>Luca está bloqueada</h2><p class="muted">Usa tu huella o Face ID para entrar.</p>
    <button class="primary" id="lkOk">Desbloquear</button><button class="ghost" id="lkOut">Cerrar sesión</button>`;
  document.body.appendChild(el);$("#lkOk").onclick=desbloquear;
  $("#lkOut").onclick=async()=>{try{localStorage.removeItem(LOCK_KEY)}catch(e){}el.remove();await sb.auth.signOut();stop()};
  setTimeout(desbloquear,300);
}
async function renderSeguridad(){
  const el=$("#seguridadPanel");if(!el)return;const ok=await bioDisponible(),on=!!lockId();
  el.innerHTML=ok?`<div class="ios-row"><span><b>Bloquear con huella o Face ID</b><small>Luca pide tu huella o cara cada vez que la abres.</small></span><button type="button" class="switch" role="switch" aria-checked="${on}" id="swLock" aria-label="Bloquear con huella o Face ID"><i></i></button></div>`
    :`<div class="ios-row"><span><b>Bloqueo con huella o Face ID</b><small>Este dispositivo o navegador no lo permite. En iPhone, instala Luca desde Safari en la pantalla de inicio.</small></span></div>`;
  $("#swLock")&&($("#swLock").onclick=()=>{if(lockId()){try{localStorage.removeItem(LOCK_KEY)}catch(e){}toast("Bloqueo desactivado");renderSeguridad()}else activarBloqueo()});
}
let ocultoDesde=0;
document.addEventListener("visibilitychange",()=>{if(document.hidden)ocultoDesde=Date.now();else if(lockId()&&Date.now()-ocultoDesde>60000)mostrarBloqueo()});
document.addEventListener("click",e=>{if(e.target.closest("[data-accion='preguntar']")){vibrar(6);preguntaSheet()}});
(()=>{const t=setInterval(()=>{if(user&&!$("#app").hidden){clearInterval(t);mostrarBloqueo()}},400)})();
renderSeguridad();
