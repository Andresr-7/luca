"use strict";
/* Luca — app de finanzas personales. Datos en Supabase (una fila por registro, protegidas por usuario). */
const DEF_CATS=["Comida","Transporte","Salidas","Ropa","Hogar","Suscripciones","Juegos","Salud","Otros"];
const MESES=LANG==="en"?["January","February","March","April","May","June","July","August","September","October","November","December"]:["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DIAS=LANG==="en"?["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]:["dom","lun","mar","mié","jue","vie","sáb"];
const DIAS_L=LANG==="en"?["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]:["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];
const $=s=>document.querySelector(s);
const fmt=n=>"$\u00a0"+Math.round(n||0).toLocaleString("es-CO");
const parse=v=>{const d=String(v??"").replace(/[^\d]/g,"");return d?parseInt(d,10):null};
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const today=()=>iso(new Date());
const monthKey=d=>String(d||"").slice(0,7);
const midnight=()=>{const d=new Date();d.setHours(0,0,0,0);return d};
const fechaCorta=f=>{if(!f)return"";const[y,m,d]=f.split("-");return +d+" "+MESES[+m-1].slice(0,3).toLowerCase()};
const dLabel=d=>DIAS[d.getDay()]+" "+d.getDate()+" "+MESES[d.getMonth()].slice(0,3).toLowerCase();
const fmtU=n=>"US$\u00a0"+(Number(n)||0).toLocaleString("es-CO",{minimumFractionDigits:2,maximumFractionDigits:2});
function parseU(v){let s=String(v??"").replace(/[^\d.,]/g,"");if(!s)return null;
  if(s.includes(",")){s=s.replace(/\./g,"").replace(",",".")}
  else{const p=s.split(".");if(p.length>2||(p.length===2&&p[1].length===3))s=p.join("")}
  const n=parseFloat(s);return isNaN(n)?null:Math.round(n*100)/100}
function liveUsd(inp){inp&&inp.addEventListener("blur",()=>{const n=parseU(inp.value);inp.value=n==null?"":fmtU(n)})}
const trm=()=>S.ajustes.tasaBanco||S.ajustes.trm||0;
const rateName=()=>S.ajustes.tasaBanco?"tasa Bancolombia":"TRM";
const rateDate=()=>S.ajustes.tasaBanco?S.ajustes.tasaBancoFecha:S.ajustes.trmFecha;
const deudaCopCard=t=>(t.saldo||0)+(t.usd?(t.saldoUsd||0)*trm():0);
const minTotal=t=>(t.minimo||0)+(t.usd&&t.minimoUsd?t.minimoUsd*trm():0);
const minLabel=t=>{const p=[];if(t.minimo!=null)p.push(fmt(t.minimo));if(t.usd&&t.minimoUsd!=null)p.push(fmtU(t.minimoUsd));return p.join(" + ")};
const minNA=t=>t.minimo==null&&!(t.usd&&t.minimoUsd!=null);
function liveMoney(inp){inp&&inp.addEventListener("input",()=>{const n=parse(inp.value);inp.value=n==null?"":fmt(n)})}
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);

/* ---------- Estado y guardado ---------- */
const S={tarjetas:[],gastos:[],pagos:[],ingresos:[],metas:[],cuentas:[],movcuentas:[],ajustes:{montoPago:null,diasPago:[15,30],otros:null,trm:3210,trmFecha:"2026-10-06",fijos:[],categorias:DEF_CATS.slice(),presupuestos:{}}};
const COLS=["tarjetas","gastos","pagos","ingresos","metas","cuentas","movcuentas"];
let mes=monthKey(today());
/* ---------- Conexión con Supabase (cuentas de usuario + base de datos) ---------- */
let sb=null,user=null,perfil={plan:"free",plan_until:null},canal=null;
const defaultAjustes=()=>({montoPago:null,diasPago:[15,30],otros:null,trm:null,trmFecha:null,fijos:[],categorias:DEF_CATS.slice(),presupuestos:{}});
const cacheKey=()=>"luca-cache-"+(user?user.id:"anon");
/* Guardar en el celular sin frenar la pantalla: se agrupa y se escribe cuando hay un respiro. */
let cacheT=0;function cacheSaveYa(){clearTimeout(cacheT);cacheT=0;if(!user)return;try{localStorage.setItem(cacheKey(),JSON.stringify(S))}catch(e){}}
function cacheSave(){clearTimeout(cacheT);cacheT=setTimeout(cacheSaveYa,350)}
addEventListener("pagehide",()=>{if(cacheT)cacheSaveYa()});document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden"&&cacheT)cacheSaveYa()});
function cacheLoad(){try{const r=JSON.parse(localStorage.getItem(cacheKey())||"null");if(r)Object.assign(S,r)}catch(e){}}
function emptyState(){COLS.forEach(c=>S[c]=[]);S.ajustes=defaultAjustes()}
function errMsg(){return "No se pudo guardar. Revisa tu conexión e inténtalo de nuevo."}
function setSync(t){const c=$("#syncChip");if(c){c.textContent=t;c.classList.toggle("off",/Sin conexi|Conectando/.test(t))}}
const fila=(col,id,data)=>({user_id:user.id,collection:col,id,data,updated_at:new Date().toISOString()});
async function put(col,id,data){
  const arr=S[col];const i=arr.findIndex(x=>x.id===id);const row={...data,id};i>=0?arr[i]=row:arr.push(row);
  cacheSave();render();
  const {error}=await sb.from("docs").upsert(fila(col,id,data));
  if(error){toast(errMsg());setSync("Sin conexión")}
}
async function del(col,id){
  S[col]=S[col].filter(x=>x.id!==id);cacheSave();render();
  const {error}=await sb.from("docs").delete().match({user_id:user.id,collection:col,id});
  if(error){toast(errMsg());setSync("Sin conexión")}
}
async function saveAjustes(){
  cacheSave();render();
  const {error}=await sb.from("docs").upsert(fila("ajustes","principal",{...S.ajustes}));
  if(error){toast(errMsg());setSync("Sin conexión")}
}
const strip=o=>{const{id,...r}=o;return r};
const cats=()=>(S.ajustes.categorias&&S.ajustes.categorias.length?S.ajustes.categorias:DEF_CATS);

async function loadAll(){
  const rows=[];
  for(let from=0;;from+=1000){
    const {data,error}=await sb.from("docs").select("collection,id,data").eq("user_id",user.id).range(from,from+999);
    if(error)throw error;rows.push(...data);if(data.length<1000)break;
  }
  const next={};COLS.forEach(c=>next[c]=[]);let aj=null;
  rows.forEach(r=>{if(r.collection==="ajustes"){if(r.id==="principal")aj=r.data}else if(next[r.collection])next[r.collection].push({...r.data,id:r.id})});
  COLS.forEach(c=>S[c]=next[c]);
  S.ajustes={...defaultAjustes(),...(aj||{})};
  cacheSave();render();
}
function subscribe(){
  if(canal)sb.removeChannel(canal);
  canal=sb.channel("docs-"+user.id)
    .on("postgres_changes",{event:"*",schema:"public",table:"docs",filter:"user_id=eq."+user.id},p=>{
      if(p.eventType==="DELETE"){const o=p.old||{};if(o.collection&&S[o.collection]){S[o.collection]=S[o.collection].filter(x=>x.id!==o.id);cacheSave();renderPronto()}return}
      const r=p.new;if(!r||!r.collection)return;
      if(r.collection==="ajustes"){if(r.id==="principal")S.ajustes={...defaultAjustes(),...r.data}}
      else if(S[r.collection]){const arr=S[r.collection];const i=arr.findIndex(x=>x.id===r.id);const row={...r.data,id:r.id};i>=0?arr[i]=row:arr.push(row)}
      cacheSave();renderPronto();
    })
    .subscribe(st=>{if(st==="SUBSCRIBED")setSync("Sincronizado");else if(st==="CHANNEL_ERROR"||st==="TIMED_OUT")setSync("Sin conexión")});
}
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&user)loadAll().then(()=>setSync("Sincronizado")).catch(()=>setSync("Sin conexión"))});

/* ---------- Plan y pagos (listo para cobrar en el futuro) ---------- */
async function loadPerfil(){const {data}=await sb.from("profiles").select("plan,plan_until,rol").eq("id",user.id).maybeSingle();if(data)perfil=data}
const isPro=()=>perfil.plan==="pro"&&(!perfil.plan_until||new Date(perfil.plan_until)>new Date());
const NOMBRES={tarjetas:"tarjetas",cuentas:"cuentas de ahorro",metas:"metas de ahorro"};
function limitOk(k){
  const planes=(window.CONFIG&&CONFIG.PLANES)||{};const lim=(planes[isPro()?"pro":"free"]||{})[k];
  if(lim==null||(S[k]||[]).length<lim)return true;
  openSheet("Pásate a Pro",`<div class="stack"><p>En el plan gratis puedes tener hasta ${lim} ${NOMBRES[k]||k}. Con Pro no tienes límite.</p>
    ${CONFIG.PAGOS&&CONFIG.PAGOS.activo?'<button class="primary" id="goPro">Mejorar a Pro</button>':'<p class="hint">Los pagos todavía no están activos.</p>'}</div>`,()=>{$("#goPro")&&($("#goPro").onclick=irAPagar)});
  return false;
}
function irAPagar(){
  const u=CONFIG.PAGOS&&CONFIG.PAGOS.checkoutUrl;if(!u){toast("Los pagos todavía no están activos");return}
  location.href=u+(u.includes("?")?"&":"?")+"ref="+encodeURIComponent(user.id)+"&email="+encodeURIComponent(user.email||"");
}

/* ---------- Dólar automático (TRM oficial, datos abiertos del Gobierno) ---------- */
async function actualizarTRM(){
  const a=S.ajustes;if(a.trmFecha&&a.trmFecha>=today()&&a.trm)return;
  try{
    const r=await fetch("https://www.datos.gov.co/resource/32sa-8pi3.json?$order=vigenciadesde%20DESC&$limit=1");if(!r.ok)return;
    const [x]=await r.json();const v=parseFloat(x&&x.valor);const f=String((x&&x.vigenciadesde)||"").slice(0,10);
    if(v>0&&f&&(!a.trm||!a.trmFecha||f>a.trmFecha)){a.trm=v;a.trmFecha=f;await saveAjustes()}
  }catch(e){}
}

/* ---------- Respaldo: descargar e importar ---------- */
function exportar(){
  const data={app:"luca",version:1,exportado:today(),colecciones:Object.fromEntries(COLS.map(c=>[c,S[c]])),ajustes:S.ajustes};
  const blob=new Blob([JSON.stringify(data,null,1)],{type:"application/json"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="luca-respaldo-"+today()+".json";
  document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},800);
}
function leerRespaldo(file){
  if(!file||file.size>5*1024*1024){toast("El respaldo es demasiado grande (máximo 5 MB).");return}
  const fr=new FileReader();
  fr.onload=()=>{
    let d;try{d=JSON.parse(fr.result,(k,v)=>k==="__proto__"||k==="constructor"||k==="prototype"?undefined:v)}catch(e){toast("Ese archivo no es un respaldo válido de Luca.");return}
    if(!d||typeof d!=="object"||!d.colecciones){toast("Ese archivo no es un respaldo válido de Luca.");return}
    const rows=[];
    COLS.forEach(c=>(Array.isArray(d.colecciones[c])?d.colecciones[c]:[]).forEach(x=>{if(x&&typeof x==="object"&&x.id&&String(x.id).length<=64&&JSON.stringify(x).length<=16000){const{id,...rest}=x;rows.push(fila(c,String(id),rest))}}));
    if(rows.length>20000){toast("El respaldo tiene demasiados registros.");return}
    if(d.ajustes&&typeof d.ajustes==="object")rows.push(fila("ajustes","principal",{...defaultAjustes(),...d.ajustes}));
    const resumen=COLS.map(c=>[c,(d.colecciones[c]||[]).length]).filter(x=>x[1]).map(x=>x[1]+" "+x[0]).join(", ")||"solo ajustes";
    openSheet("Importar respaldo",`<div class="stack"><p>Este respaldo tiene: <b>${esc(resumen)}</b>.</p>
      <p class="hint">Se agrega a lo que ya tienes. Si un registro tiene el mismo id, se reemplaza con el del respaldo.</p>
      <button class="primary" id="impOk">Importar ${rows.length} registros</button></div>`,()=>{
      $("#impOk").onclick=async()=>{
        const b=$("#impOk");b.disabled=true;b.textContent="Importando…";
        for(let i=0;i<rows.length;i+=500){const {error}=await sb.from("docs").upsert(rows.slice(i,i+500));if(error){closeSheet();toast("No se pudo importar. Revisa tu conexión e inténtalo de nuevo.");return}}
        closeSheet();await loadAll();toast("Respaldo importado");
      };
    });
  };
  fr.readAsText(file);
}

/* ---------- Entrar: Google, Apple, correo + contraseña, códigos por correo ---------- */
const GSVG='<svg aria-hidden="true" width="20" height="20" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
const ASVG='<svg aria-hidden="true" width="18" height="20" viewBox="0 0 17 20" fill="currentColor"><path d="M14.2 10.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.3-.9-1.7 0-3.3 1-4.2 2.5-1.8 3.1-.5 7.7 1.3 10.2.8 1.2 1.8 2.6 3.1 2.5 1.3-.1 1.7-.8 3.3-.8 1.5 0 1.9.8 3.3.8 1.4 0 2.2-1.2 3-2.5 1-1.4 1.4-2.8 1.4-2.9-.1 0-2.5-1-2.5-3.9zM11.6 3c.7-.8 1.2-2 1-3.1-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.6 2.9-1.4z"/></svg>';
const redirectURL=()=>location.origin+location.pathname;
const MAIL_RE=/^[^@\s]+@[^@\s]+\.[^@\s]+$/;
let authEmail="",pendingRecovery=false,recoveryInForm=false,resendTimer=null;
function authMsg(t,ok){const m=$("#authMsg");m.textContent=t||"";m.hidden=!t;m.classList.toggle("ok",!!ok);if(t&&!ok)setTimeout(()=>window.sacudir&&sacudir(document.activeElement),0)}
function authErr(error){
  const m=(error&&error.message)||"";
  if(/already|registered|exists/i.test(m))return "Ese correo ya tiene cuenta. Entra con tu contraseña o con un código.";
  if(/invalid login|credentials/i.test(m))return "El correo o la contraseña no coinciden. Revísalos o entra con un código.";
  if(/not confirmed/i.test(m))return "Falta confirmar tu correo. Te enviamos un código para hacerlo.";
  if(/expired|invalid.*(token|otp)|token.*(invalid|expired)/i.test(m))return "El código no es correcto o ya venció. Revísalo o pide uno nuevo.";
  if(/rate|seconds|limit|too many/i.test(m))return "Hiciste varios intentos seguidos. Espera un minuto y vuelve a intentarlo.";
  if(/sending|smtp|email.*(send|deliver)/i.test(m))return "No pudimos enviar el correo en este momento. Inténtalo más tarde o entra con tu contraseña.";
  if(/signups? not allowed|disabled/i.test(m))return "Por ahora no se pueden crear cuentas nuevas.";
  if(/password/i.test(m))return "Esa contraseña no sirve: usa al menos 8 caracteres.";
  return "No se pudo completar. Revisa tu conexión e inténtalo de nuevo.";
}
const pwField=(id,label,auto,ph)=>`<label>${label}<span class="pw"><input id="${id}" name="${id}" type="password" autocomplete="${auto}" placeholder="${ph}"><button type="button" class="pw-eye" data-eye="${id}" aria-label="Mostrar contraseña">Ver</button></span></label>`;
/* Código en 6 casillas tipo baraja: un solo input real (autocompletar y pegar funcionan), casillas visuales encima. */
const OTP_LEN=(window.CONFIG&&CONFIG.OTP_LEN)||8,OTP_C=(OTP_LEN-1)/2,OTP_ANG=Array.from({length:OTP_LEN},(_,k)=>+((k-OTP_C)*30/OTP_LEN).toFixed(1)),OTP_DX=OTP_ANG.map(a=>-Math.round(a*3.2)),otpQuieto=()=>matchMedia("(prefers-reduced-motion: reduce)").matches;
function otpDeck(){const i=$("#aCode");if(!i||i.dataset.deck)return;i.dataset.deck="1";i.maxLength=OTP_LEN;i.removeAttribute("placeholder");
  const w=document.createElement("div");w.className="otp";w.id="otpDeck";w.style.setProperty("--n",OTP_LEN);
  w.innerHTML=OTP_ANG.map(()=>'<span class="slot"><b></b></span>').join("")+'<svg class="otp-seal" aria-hidden="true" preserveAspectRatio="none"><rect x="1" y="1" rx="16" ry="16" pathLength="1"/></svg>';
  i.parentNode.insertBefore(w,i);w.appendChild(i);
  const sl=[...w.querySelectorAll(".slot")],f=$("#fAuth"),conPass=!!$("#aPass");
  const pinta=()=>{const v=i.value.replace(/\D/g,"").slice(0,OTP_LEN);if(v!==i.value)i.value=v;const foco=document.activeElement===i;
    sl.forEach((s,k)=>{const d=v[k]||"",b=s.firstChild;if(b.textContent!==d){b.textContent=d;if(d&&!otpQuieto()&&s.animate)s.animate([{transform:"translateY(8px) scale(.9)",opacity:.4},{transform:"none",opacity:1}],{duration:320,easing:"cubic-bezier(.3,1.5,.5,1)"})}
      s.classList.toggle("on",!!d);s.classList.toggle("cur",foco&&k===Math.min(v.length,OTP_LEN-1))});
    if(v.length===OTP_LEN&&!conPass&&!w.classList.contains("busy")&&f){vibrar(10);f.requestSubmit()}};
  ["input","focus","blur"].forEach(ev=>i.addEventListener(ev,pinta));
  f&&f.addEventListener("submit",()=>{if(i.value.length===OTP_LEN)otpAbanico(true)});pinta()}
function otpAbanico(on){const w=$("#otpDeck");if(!w)return;w.classList.toggle("busy",on);w.classList.remove("err","ok");
  if(otpQuieto())return;[...w.querySelectorAll(".slot")].forEach((s,k)=>s.animate&&s.animate([{transform:"none"},{transform:`translate(${OTP_DX[k]}px,-6px) rotate(${OTP_ANG[k]}deg)`}],{duration:560,delay:k*45,easing:"cubic-bezier(.3,1.3,.5,1)",fill:"forwards",direction:on?"normal":"reverse"}))}
function otpFallo(){const w=$("#otpDeck"),i=$("#aCode");if(!w){i&&i.select();return}otpAbanico(false);w.getAnimations&&w.querySelectorAll(".slot").forEach(s=>s.getAnimations().forEach(a=>a.cancel()));
  w.classList.add("err");vibrar([20,40,20]);setTimeout(()=>{i.value="";i.dispatchEvent(new Event("input"));w.classList.remove("err");i.focus()},650)}
let otpEspera=null;
function otpOk(){const w=$("#otpDeck");if(!w)return;w.querySelectorAll(".slot").forEach(s=>s.getAnimations&&s.getAnimations().forEach(a=>a.cancel()));
  w.classList.remove("busy");w.classList.add("ok");vibrar([12,40,12]);
  if(!otpQuieto())w.querySelectorAll(".slot").forEach((s,k)=>s.animate&&s.animate([{transform:"scale(1)"},{transform:"scale(1.12)"},{transform:"scale(1)"}],{duration:380,delay:k*40,easing:"cubic-bezier(.3,1.5,.5,1)"}))}
const codeField=()=>`<label>Código del correo<input id="aCode" name="code" class="code-in num" inputmode="numeric" autocomplete="one-time-code" maxlength="10" placeholder="••••••" spellcheck="false"></label>`;
function busy(b,t){const old=b.textContent;b.disabled=true;b.textContent=t;b.classList.add("lap");return()=>{b.disabled=false;b.textContent=old;b.classList.remove("lap")}}
function startResend(fn){
  const b=$("#aResend");if(!b)return;let n=60;clearInterval(resendTimer);
  const tick=()=>{if(!b.isConnected){clearInterval(resendTimer);return}if(n<=0){b.disabled=false;b.textContent="Reenviar código";clearInterval(resendTimer);return}b.disabled=true;b.textContent="Reenviar en "+n+" s";n--};
  tick();resendTimer=setInterval(tick,1000);
  b.onclick=async()=>{const {error}=await fn();if(error){authMsg(authErr(error));return}authMsg("Te enviamos un código nuevo.",true);startResend(fn)};
}
function renderAuth(paso,email){
  paso=paso||"entrar";if(email!=null)authEmail=email;
  const P=(window.CONFIG&&CONFIG.PROVEEDORES)||{};authMsg("");
  const B=$("#authBody");const mailVal=esc(authEmail);
  const social=(P.google||P.apple)?`<div class="oauth">
      ${P.apple?`<button type="button" class="oa" id="aApple">${ASVG}<span>Continuar con Apple</span></button>`:""}
      ${P.google?`<button type="button" class="oa" id="aGoogle">${GSVG}<span>Continuar con Google</span></button>`:""}
    </div><p class="hint oa-hint">Si ya tienes cuenta en Luca con ese mismo correo, se vincula sola y ves tus mismos datos.</p><p class="or">o con tu correo</p>`:"";
  const seg=(c)=>`<div class="cats seg" role="tablist" aria-label="Entrar o crear cuenta">
      <button type="button" role="tab" aria-selected="${!c}" aria-pressed="${!c}" data-paso="entrar">Entrar</button>
      <button type="button" role="tab" aria-selected="${c}" aria-pressed="${c}" data-paso="crear">Crear cuenta</button></div>`;
  const back=`<button type="button" class="ghost" data-paso="entrar">‹ Volver</button>`;
  if(paso==="entrar"){
    B.innerHTML=`${social}${seg(false)}<form id="fAuth" novalidate>
      <label>Correo<input id="aMail" name="email" type="email" autocomplete="email" spellcheck="false" placeholder="tucorreo@ejemplo.com" value="${mailVal}"></label>
      ${pwField("aPass","Contraseña","current-password","Tu contraseña")}
      <button class="primary go" type="submit">Entrar</button></form>
      <div class="auth-links"><button type="button" class="ghost" data-paso="olvide">¿Olvidaste tu contraseña?</button><button type="button" class="ghost" data-paso="codigo-pedir">Entrar con un código</button></div>`;
    $("#fAuth").onsubmit=async e=>{e.preventDefault();const email=$("#aMail").value.trim().toLowerCase(),password=$("#aPass").value;authEmail=email;
      if(!MAIL_RE.test(email)){authMsg("Escribe un correo válido, por ejemplo nombre@gmail.com.");$("#aMail").focus();return}
      if(!password){authMsg("Escribe tu contraseña.");$("#aPass").focus();return}
      const done=busy(e.submitter||$("#fAuth .primary"),"Entrando…");
      const {error}=await sb.auth.signInWithPassword({email,password});done();
      if(error){if(/not confirmed/i.test(error.message||"")){await sb.auth.resend({type:"signup",email});renderAuth("verificar",email);authMsg(authErr(error));return}authMsg(authErr(error))}};
  }else if(paso==="crear"){
    B.innerHTML=`${social}${seg(true)}<form id="fAuth" novalidate>
      <label>Tu nombre<input id="aName" name="name" autocomplete="given-name" placeholder="Cómo quieres que te salude Luca"></label>
      <label>Correo<input id="aMail" name="email" type="email" autocomplete="email" spellcheck="false" placeholder="tucorreo@ejemplo.com" value="${mailVal}"></label>
      <div class="pw-2">${pwField("aPass","Contraseña","new-password","Mínimo 8")}${pwField("aPass2","Confirmar","new-password","Repítela")}</div>
      <div class="pw-meter" aria-hidden="true"><i></i></div>
      <label class="check"><input type="checkbox" id="aTerms"><span>Acepto los <a href="terminos.html" target="_blank" rel="noopener">términos</a> y la <a href="privacidad.html" target="_blank" rel="noopener">política de privacidad</a></span></label>
      <button class="primary go" type="submit">Crear mi cuenta</button></form>`;
    $("#aPass").addEventListener("input",e=>{const v=e.target.value;let s=0;if(v.length>=8)s++;if(v.length>=12)s++;if(/[A-Z]/.test(v)&&/[a-z]/.test(v))s++;if(/\d/.test(v))s++;if(/[^A-Za-z0-9]/.test(v))s++;
      const m=$(".pw-meter i");m.style.width=Math.min(100,s*20)+"%";m.dataset.s=s<=1?"low":s<=3?"mid":"high"});
    $("#fAuth").onsubmit=async e=>{e.preventDefault();const nombre=$("#aName").value.trim(),email=$("#aMail").value.trim().toLowerCase(),password=$("#aPass").value;authEmail=email;
      if(!MAIL_RE.test(email)){authMsg("Escribe un correo válido, por ejemplo nombre@gmail.com.");$("#aMail").focus();return}
      if(password.length<8){authMsg("La contraseña debe tener al menos 8 caracteres.");$("#aPass").focus();return}
      if($("#aPass2")&&$("#aPass2").value!==password){authMsg("Las contraseñas no coinciden.");$("#aPass2").focus();return}
      if($("#aTerms")&&!$("#aTerms").checked){authMsg("Acepta los términos para crear tu cuenta.");$("#aTerms").focus();return}
      const done=busy(e.submitter||$("#fAuth .primary"),"Creando cuenta…");
      const {data,error}=await sb.auth.signUp({email,password,options:{data:{nombre},emailRedirectTo:redirectURL()}});done();
      if(error){authMsg(authErr(error));return}
      if(data&&data.user&&Array.isArray(data.user.identities)&&!data.user.identities.length){authMsg("Ese correo ya tiene cuenta. Entra con tu contraseña o con un código.");return}
      if(!data||!data.session)renderAuth("verificar",email)};
  }else if(paso==="verificar"||paso==="codigo"){
    const verif=paso==="verificar";
    B.innerHTML=`<form id="fAuth" novalidate>
      <p>${verif?"Para confirmar tu cuenta":"Para entrar"}, escribe el código que enviamos a <b>${mailVal}</b>. Revisa también la carpeta de spam. Si el correo trae un enlace, también puedes tocarlo en este mismo dispositivo.</p>
      ${codeField()}<button class="primary" type="submit">${verif?"Confirmar y entrar":"Entrar"}</button></form>
      <div class="auth-links"><button type="button" class="ghost" id="aResend">Reenviar código</button>${back}</div>`;
    setTimeout(()=>{otpDeck();$("#aCode")&&$("#aCode").focus()},60);
    startResend(()=>verif?sb.auth.resend({type:"signup",email:authEmail}):sb.auth.signInWithOtp({email:authEmail,options:{shouldCreateUser:false,emailRedirectTo:redirectURL()}}));
    $("#fAuth").onsubmit=async e=>{e.preventDefault();const token=$("#aCode").value.replace(/\D/g,"");
      if(token.length<OTP_LEN){authMsg("Escribe el código completo que te llegó al correo.");$("#aCode").focus();return}
      const done=busy(e.submitter||$("#fAuth .primary"),"Verificando…");
      let soltar;otpEspera=new Promise(r=>soltar=r);const t0=Date.now();
      let r=await sb.auth.verifyOtp({email:authEmail,token,type:"email"});
      if(r.error&&verif)r=await sb.auth.verifyOtp({email:authEmail,token,type:"signup"});
      if(r.error){done();otpEspera=null;soltar();authMsg(authErr(r.error));otpFallo();return}
      // Deja ver el abanico y el sello, luego "verificado", y recién ahí abre la app.
      const quieto=otpQuieto();await new Promise(x=>setTimeout(x,quieto?0:Math.max(0,1300-(Date.now()-t0))));
      done();otpOk();authMsg("Código verificado",true);const b=$("#fAuth .primary");if(b)b.textContent="Verificado ✓";
      await new Promise(x=>setTimeout(x,quieto?300:1000));otpEspera=null;soltar()};
  }else if(paso==="codigo-pedir"||paso==="olvide"){
    const olv=paso==="olvide";
    B.innerHTML=`<form id="fAuth" novalidate>
      <p>${olv?"Te enviamos un código para crear una contraseña nueva.":"Te enviamos un código para entrar sin contraseña."}</p>
      <label>Correo de tu cuenta<input id="aMail" name="email" type="email" autocomplete="email" spellcheck="false" placeholder="tucorreo@ejemplo.com" value="${mailVal}"></label>
      <button class="primary" type="submit">Enviarme el código</button></form><div class="auth-links">${back}</div>`;
    $("#fAuth").onsubmit=async e=>{e.preventDefault();const email=$("#aMail").value.trim().toLowerCase();authEmail=email;
      if(!MAIL_RE.test(email)){authMsg("Escribe un correo válido, por ejemplo nombre@gmail.com.");$("#aMail").focus();return}
      const done=busy(e.submitter||$("#fAuth .primary"),"Enviando…");
      const {error}=olv?await sb.auth.resetPasswordForEmail(email,{redirectTo:redirectURL()}):await sb.auth.signInWithOtp({email,options:{shouldCreateUser:false,emailRedirectTo:redirectURL()}});
      done();
      if(error&&/not found|signups? not allowed|user/i.test(error.message||"")&&!olv){authMsg("No encontramos una cuenta con ese correo. Revisa el correo o crea una cuenta.");return}
      if(error){authMsg(authErr(error));return}
      renderAuth(olv?"recuperar":"codigo",email)};
  }else if(paso==="recuperar"){
    B.innerHTML=`<form id="fAuth" novalidate>
      <p>Escribe el código que enviamos a <b>${mailVal}</b> y tu contraseña nueva.</p>
      ${codeField()}${pwField("aPass","Contraseña nueva","new-password","Mínimo 8 caracteres")}
      <button class="primary" type="submit">Guardar y entrar</button></form>
      <div class="auth-links"><button type="button" class="ghost" id="aResend">Reenviar código</button>${back}</div>`;
    setTimeout(()=>{otpDeck();$("#aCode")&&$("#aCode").focus()},60);
    startResend(()=>sb.auth.resetPasswordForEmail(authEmail,{redirectTo:redirectURL()}));
    $("#fAuth").onsubmit=async e=>{e.preventDefault();const token=$("#aCode").value.replace(/\D/g,""),password=$("#aPass").value;
      if(token.length<OTP_LEN){authMsg("Escribe el código completo que te llegó al correo.");$("#aCode").focus();return}
      if(password.length<8){authMsg("La contraseña nueva debe tener al menos 8 caracteres.");$("#aPass").focus();return}
      const done=busy(e.submitter||$("#fAuth .primary"),"Guardando…");
      recoveryInForm=true;const v=await sb.auth.verifyOtp({email:authEmail,token,type:"recovery"});
      if(v.error){recoveryInForm=false;done();authMsg(authErr(v.error));otpFallo();return}
      const u=await sb.auth.updateUser({password});done();recoveryInForm=false;pendingRecovery=false;
      if(u.error){toast(authErr(u.error));nuevaClaveSheet();return}
      toast("Contraseña actualizada")};
  }
  const oauth=async prov=>{authMsg("");const {error}=await sb.auth.signInWithOAuth({provider:prov,options:{redirectTo:redirectURL()}});if(error)authMsg("No se pudo abrir el inicio de sesión. Inténtalo de nuevo.")};
  $("#aGoogle")&&($("#aGoogle").onclick=()=>oauth("google"));
  $("#aApple")&&($("#aApple").onclick=()=>oauth("apple"));
  B.querySelectorAll("[data-paso]").forEach(b=>b.onclick=()=>{const m=$("#aMail");renderAuth(b.dataset.paso,m?m.value.trim().toLowerCase():authEmail)});
  B.querySelectorAll("[data-eye]").forEach(b=>b.onclick=()=>{const i=$("#"+b.dataset.eye);const show=i.type==="password";i.type=show?"text":"password";b.textContent=show?"Ocultar":"Ver";b.setAttribute("aria-label",show?"Ocultar contraseña":"Mostrar contraseña")});
}
function nuevaClaveSheet(titulo){
  openSheet(titulo||"Crea tu contraseña nueva",`<form id="fNP" class="stack" novalidate>
    ${pwField("npPass","Contraseña nueva","new-password","Mínimo 8 caracteres")}
    <p class="hint" id="npMsg"></p><button class="primary" type="submit">Guardar contraseña</button></form>`,()=>{
    $("#sheetBody [data-eye]").onclick=e=>{const i=$("#npPass");const s=i.type==="password";i.type=s?"text":"password";e.target.textContent=s?"Ocultar":"Ver"};
    $("#fNP").onsubmit=async e=>{e.preventDefault();const p=$("#npPass").value;if(p.length<8){$("#npMsg").textContent="Usa al menos 8 caracteres.";return}
      const done=busy(e.submitter||$("#fNP .primary"),"Guardando…");const {error}=await sb.auth.updateUser({password:p});done();
      if(error){$("#npMsg").textContent=authErr(error);return}closeSheet();toast("Contraseña guardada")};
  });
}
function pantalla(cual){$("#boot").hidden=cual!=="boot";$("#auth").hidden=cual!=="auth";$("#app").hidden=cual!=="app";$("#fab").hidden=cual!=="app"}
function showAuth(){pantalla("auth");renderAuth("entrar")}
async function start(u){
  if(user&&user.id===u.id){user=u;return}
  user=u;perfil={plan:"free",plan_until:null};emptyState();cacheLoad();
  if(otpEspera)await Promise.race([otpEspera,new Promise(r=>setTimeout(r,6000))]);
  pantalla("app");render();go("resumen");setSync("Conectando…");
  if(/[?&]code=|access_token|error_description|type=recovery/.test(location.search+location.hash))history.replaceState(null,"",location.pathname);
  let ok=false;
  try{await loadAll();ok=true;setSync(navigator.onLine===false?"Sin conexión":"Sincronizado")}catch(e){setSync("Sin conexión");toast("No se pudieron cargar tus datos. Revisa tu conexión.")}
  loadPerfil().then(render).catch(()=>{});
  subscribe();actualizarTRM();
  if(pendingRecovery){pendingRecovery=false;nuevaClaveSheet()}
  else if(ok)maybeOnboard();
}
function limpiarLocal(){try{Object.keys(localStorage).filter(k=>/^luca-(cache-|bloqueo)/.test(k)||/^sb-.*-auth-token$/.test(k)).forEach(k=>localStorage.removeItem(k))}catch(e){}}
function stop(){clearTimeout(cacheT);cacheT=0;if(canal&&sb)sb.removeChannel(canal);canal=null;if(user)limpiarLocal();user=null;emptyState();closeSheet();showAuth()}
async function init(){
  const C=window.CONFIG||{};
  if(!window.supabase||!C.SUPABASE_URL||/TU-PROYECTO/.test(C.SUPABASE_URL)){
    pantalla("auth");$("#authBody").innerHTML='<div class="notice">Falta conectar la base de datos. Abre <b>config.js</b> y pega la URL y la clave pública de tu proyecto de Supabase (la guía está en README.md).</div>';return}
  sb=window.supabase.createClient(C.SUPABASE_URL,C.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:"implicit"}});
  sb.auth.onAuthStateChange((ev,session)=>{
    if(ev==="PASSWORD_RECOVERY"&&!recoveryInForm){if(user)setTimeout(()=>nuevaClaveSheet(),50);else pendingRecovery=true}
    const u=session&&session.user;if(u)start(u);else if(user)stop()});
  const {data}=await sb.auth.getSession();
  if(data&&data.session&&data.session.user)start(data.session.user);else if(!user)showAuth();
}
addEventListener("online",()=>{if(user){setSync("Sincronizado");loadAll().catch(()=>{})}});
addEventListener("offline",()=>{if(user){setSync("Sin conexión");toast("Estás sin internet. Lo que veas puede no estar al día.")}});

/* ---------- Fechas ---------- */
const onDay=(y,m,day)=>{const last=new Date(y,m+1,0).getDate();return new Date(y,m,Math.min(day,last))};
function nextOn(day){
  if(!day)return null;const now=midnight();
  let d=onDay(now.getFullYear(),now.getMonth(),day);
  if(d<now)d=onDay(now.getFullYear(),now.getMonth()+1,day);
  return d;
}
const daysUntil=d=>Math.round((d-midnight())/864e5);
function dueInfo(day){
  const d=nextOn(day);if(!d)return null;const days=daysUntil(d);
  const cls=days<=3?"soon":days<=7?"week":"okc";
  const label=days===0?"Vence hoy":days===1?"Vence mañana":"Faltan "+days+" días";
  return{date:d,days,cls,label,txt:dLabel(d)};
}
function paydaysBetween(from,to){
  const out=[];const dias=S.ajustes.diasPago||[];
  for(let y=from.getFullYear(),m=from.getMonth();new Date(y,m,1)<=to;m++){
    if(m>11){m=0;y++}
    dias.forEach(dd=>{const d=onDay(y,m,dd);if(d>=from&&d<=to)out.push(d)});
  }
  return out.sort((a,b)=>a-b).filter((d,i,a)=>!i||+d!==+a[i-1]);
}
function nextPayday(){const f=midnight();const t=new Date(f);t.setDate(t.getDate()+62);const ingHoy=S.ingresos.some(i=>i.fecha===today());return paydaysBetween(f,t).find(d=>!(ingHoy&&iso(d)===today()))||null}

/* ---------- Cálculos ---------- */
const esTarjeta=g=>!!g.tarjetaId;
function totals(){
  const mk=monthKey(today()),a=S.ajustes;
  const deudaCop=S.tarjetas.reduce((s,t)=>s+(t.saldo||0),0);
  const deudaUsd=S.tarjetas.reduce((s,t)=>s+(t.usd?(t.saldoUsd||0):0),0);
  const deuda=deudaCop+deudaUsd*trm();
  const conMin=S.tarjetas.filter(t=>!minNA(t));
  const minCop=S.tarjetas.reduce((s,t)=>s+(t.minimo||0),0);
  const minUsd=S.tarjetas.reduce((s,t)=>s+(t.usd?(t.minimoUsd||0):0),0);
  const minimos=minCop+minUsd*trm();
  const gm=S.gastos.filter(g=>monthKey(g.fecha)===mk);
  const gastado=gm.reduce((s,g)=>s+(g.valor||0),0);
  const gastadoBolsillo=gm.filter(g=>!esTarjeta(g)).reduce((s,g)=>s+(g.valor||0),0);
  const pagado=S.pagos.filter(p=>monthKey(p.fecha)===mk).reduce((s,p)=>s+(p.valor||0),0);
  const fijos=(a.fijos||[]).reduce((s,f)=>s+(f.valor||0),0);
  const recibido=S.ingresos.filter(i=>monthKey(i.fecha)===mk).reduce((s,i)=>s+(i.valor||0),0);
  // pagos de sueldo que aún faltan este mes
  const now=midnight(),fin=new Date(now.getFullYear(),now.getMonth()+1,0);
  const ingHoy=S.ingresos.some(i=>i.fecha===today());
  const pendientes=paydaysBetween(now,fin).filter(d=>!(ingHoy&&iso(d)===today())).length;
  const esperado=(a.montoPago||0)*pendientes;
  const ing=recibido+esperado+(a.otros||0);
  return{deuda,deudaCop,deudaUsd,minCop,minUsd,minimos,conMin:conMin.length,sinMin:S.tarjetas.length-conMin.length,gastado,gastadoBolsillo,ngas:gm.length,pagado,fijos,recibido,esperado,pendientes,ing,gm};
}
// Lo que vence antes del próximo pago
function antesDe(limit){
  const items=[];const now=midnight();
  S.tarjetas.forEach(t=>{const d=nextOn(t.dia);if(d&&d<limit)items.push({tipo:"tarjeta",nombre:t.nombre,valor:minNA(t)?null:minTotal(t),date:d})});
  (S.ajustes.fijos||[]).forEach(f=>{const d=nextOn(f.dia);if(d&&d<limit&&f.pagado!==monthKey(iso(d)))items.push({tipo:"fijo",nombre:f.nombre,valor:f.valor,date:d})});
  return items.sort((a,b)=>a.date-b.date);
}

/* ---------- Render ---------- */
function render(){
  const d=new Date();const nom=user?nombreUsuario():"";$("#monthLabel").textContent=(nom?"Hola, "+nom+" · ":"")+MESES[d.getMonth()]+" "+d.getFullYear();
  const T=totals(),a=S.ajustes;
  renderResumen(T,a);
  // Solo se dibuja ya la pestaña que se está viendo; las demás, cuando el celular está libre o al abrirlas.
  for(const k of ["agenda","tarjetas","movs","mas"]){if(k===tabActual)VISTAS[k]();else sucias.add(k)}
  if(typeof renderExtras==="function")renderExtras(T);
  if(sucias.size)enReposo(limpiarSucias);
}
let tabActual="resumen",rPronto=0;const sucias=new Set();
const VISTAS={agenda:()=>renderAgenda(),tarjetas:()=>renderTarjetas(),movs:()=>renderMovs(),mas:()=>{renderMas(S.ajustes);renderCuenta();renderPlan()}};
const enReposo=f=>(window.requestIdleCallback?requestIdleCallback(f,{timeout:1200}):setTimeout(f,120));
function limpiarSucias(){const k=sucias.values().next().value;if(!k)return;sucias.delete(k);if(user)VISTAS[k]();if(sucias.size)enReposo(limpiarSucias)}
function renderPronto(){if(rPronto)return;rPronto=requestAnimationFrame(()=>{rPronto=0;render()})}
function renderResumen(T,a){
  let disp=null;
  if(a.montoPago||T.recibido||a.otros){
    disp=T.ing-T.fijos-T.pagado-T.minimos-T.gastadoBolsillo;
    $("#dispo").textContent=(disp<0?"− ":"")+fmt(Math.abs(disp));
    let sub=`Ingresos del mes ${fmt(T.ing)}`+(T.pendientes&&a.montoPago?` (te faltan ${T.pendientes} pago${T.pendientes>1?"s":""})`:"")+", menos fijos, pagos a tarjetas, mínimos pendientes y gastos en efectivo o débito.";
    if(disp<0)sub+=" Vas en rojo este mes.";
    $("#dispoSub").textContent=sub;
  }else{$("#dispo").textContent="—";$("#dispoSub").textContent="Pon cuánto te pagan en la pestaña Más para calcular esto."}

  renderCiclo(disp);
  const np=nextPayday();
  if(np){
    const items=antesDe(np);const total=items.reduce((s,i)=>s+(i.valor||0),0);const sinMin=items.filter(i=>i.valor==null).length;
    const dd=daysUntil(np);
    $("#paydayBox").innerHTML=`<div class="cal"><b>${np.getDate()}</b><span>${MESES[np.getMonth()].slice(0,3)}</span></div>
      <div><div class="eyebrow">Próximo pago de sueldo</div><div style="font-weight:600">${dd===0?"Hoy":dd===1?"Mañana":"En "+dd+" días"}${a.montoPago?` · <span class="num">${fmt(a.montoPago)}</span>`:""}</div></div>
      <div class="small muted">${items.length?`Antes de esa fecha vencen ${items.length} pago${items.length>1?"s":""}: <b class="num" style="color:var(--ink)">${fmt(total)}</b>${sinMin?` + ${sinMin} con mínimo aún no disponible`:""}.`:"No tienes vencimientos antes de esa fecha."}</div>
      ${items.length?`<div class="due">${items.slice(0,5).map(i=>`<div><span class="due-d num">${i.date.getDate()} ${MESES[i.date.getMonth()].slice(0,3).toLowerCase()}</span><span class="due-n">${esc(i.nombre)}</span><span class="due-v num">${i.valor==null?'<span class="na">Sin mínimo</span>':fmt(i.valor)}</span></div>`).join("")}</div>`:""}`;
  }else{$("#paydayBox").innerHTML=`<div class="cal"><b>?</b><span>pago</span></div><div><div class="eyebrow">Próximo pago de sueldo</div><div style="font-weight:600">Sin días de pago</div></div><div class="small muted">Pon los días en que te pagan en la pestaña Más.</div>`}

  $("#sDeuda").textContent=fmt(T.deuda);
  const sinSaldo=S.tarjetas.filter(t=>t.saldo==null&&!(t.usd&&t.saldoUsd!=null)).length;
  $("#sDeudaH").textContent=(T.deudaUsd?"Pesos + dólares · ":"")+S.tarjetas.length+" tarjetas"+(sinSaldo?" · "+sinSaldo+" sin saldo":"");
  $("#sMin").textContent=fmt(T.minimos);
  $("#sMinH").textContent=(T.minUsd?"Incluye "+fmtU(T.minUsd)+" · ":"")+(T.sinMin?T.sinMin+" aún no disponible"+(T.sinMin>1?"s":""):"Todas con mínimo");
  const totCtas=S.cuentas.reduce((s,c)=>s+(c.saldo||0),0);
  $("#acctResumen").innerHTML=S.cuentas.length?`<div class="row-head"><h2>Plata en tus cuentas</h2><button class="ghost" data-go="tarjetas">Ver cuentas</button></div>
    <div class="list">${S.cuentas.slice().sort((a,b)=>(a.orden??99)-(b.orden??99)).map(c=>`<div class="item"><span class="dot in"></span><div class="main"><div class="t">${esc(c.nombre)}</div></div><div class="amt num">${fmt(c.saldo)}</div></div>`).join("")}
    <div class="item" style="background:var(--surface-2)"><span class="dot info"></span><div class="main"><div class="t">Total en cuentas</div><div class="s">Si pagaras todas tus deudas hoy te quedarían ${totCtas-T.deuda<0?"− ":""}${fmt(Math.abs(totCtas-T.deuda))}</div></div><div class="amt num" style="font-size:17px">${fmt(totCtas)}</div></div></div>`
    :`<div class="row-head"><h2>Plata en tus cuentas</h2><button class="ghost" data-go="tarjetas">Agregar</button></div><div class="empty">Agrega tus cuentas de ahorro en la pestaña <b>Cuentas</b> para ver cuánto tienes en total.</div>`;
  const usdCards=S.tarjetas.filter(t=>t.usd);
  $("#deudasBox").innerHTML=`
    <div class="item"><span class="dot out"></span><div class="main"><div class="t">Deuda en pesos</div><div class="s">Mínimos: ${fmt(T.minCop)}</div></div><div class="amt num">${fmt(T.deudaCop)}</div></div>
    <div class="item"><span class="dot fijo"></span><div class="main"><div class="t">Deuda en dólares</div><div class="s">${usdCards.length?"Mínimos: "+fmtU(T.minUsd)+" · ≈ "+fmt(T.deudaUsd*trm()):"Ninguna tarjeta con deuda en dólares. Actívala en Editar."}</div></div><div class="amt num">${fmtU(T.deudaUsd)}</div></div>
    <div class="item" style="background:var(--surface-2)"><span class="dot info"></span><div class="main"><div class="t">Total de todo (en pesos)</div><div class="s">Dólar a ${fmt(trm())} (${rateName()})${rateDate()?" · "+esc(fechaCorta(rateDate())):""}</div></div><div class="amt num" style="font-size:17px">${fmt(T.deuda)}</div></div>`;
  $("#sGas").textContent=fmt(T.gastado);$("#sGasH").textContent=T.ngas+" gasto"+(T.ngas===1?"":"s")+(T.gastado!==T.gastadoBolsillo?" · "+fmt(T.gastado-T.gastadoBolsillo)+" con tarjeta":"");
  const fj=a.fijos||[];const pag=fj.filter(f=>f.pagado===monthKey(today())).length;
  $("#sFij").textContent=fmt(T.fijos);$("#sFijH").textContent=fj.length?pag+" de "+fj.length+" pagados":"Ninguno registrado";

  const by={};T.gm.forEach(g=>by[g.categoria||"Otros"]=(by[g.categoria||"Otros"]||0)+(g.valor||0));
  const pres=a.presupuestos||{};Object.keys(pres).forEach(c=>{if(pres[c]&&!(c in by))by[c]=0});
  const rows=Object.entries(by).sort((x,y)=>y[1]-x[1]);
  const max=Math.max(1,...rows.map(([c,v])=>Math.max(v,pres[c]||0)));
  $("#porCat").innerHTML=rows.length&&T.gastado+Object.values(pres).reduce((s,v)=>s+(v||0),0)>0?'<div class="bars">'+rows.map(([c,v])=>{const lim=pres[c];const over=lim&&v>lim;
    const note=lim?`<span class="bar-note ${over?"over":""}">${over?"Te pasaste por "+fmt(v-lim):"Te quedan "+fmt(lim-v)} de ${fmt(lim)}</span>`:"";
    return `<div class="bar-row"><span>${esc(c)}${T.gastado?` <span class="muted">· ${Math.round(v/T.gastado*100)}%</span>`:""}</span><span class="num" style="font-weight:600">${fmt(v)}</span><div class="bar"><i class="${over?"over":""}" style="width:${lim?Math.min(100,v/lim*100):Math.max(3,v/max*100)}%"></i></div>${note}</div>`}).join("")+"</div>"
    :'<div class="empty">Todavía no hay gastos este mes. Toca <b>+ Gasto</b> para registrar el primero.</div>';

  $("#metasResumen").innerHTML=S.metas.length?'<div class="row-head"><h2>Metas de ahorro</h2><button class="ghost" data-go="mas">Ver</button></div><div class="bars">'+S.metas.map(m=>`<div class="bar-row"><span>${esc(m.nombre)}</span><span class="num" style="font-weight:600">${fmt(m.ahorrado)} <span class="muted" style="font-weight:400">de ${fmt(m.objetivo)}</span></span><div class="bar"><i style="width:${m.objetivo?Math.min(100,(m.ahorrado||0)/m.objetivo*100):0}%"></i></div></div>`).join("")+"</div>":"";
}
/* ---------- Gráfica: gasto por día en la quincena actual ---------- */
function cycleBounds(){
  const now=midnight();const f=new Date(now);f.setDate(f.getDate()-45);const t=new Date(now);t.setDate(t.getDate()+45);
  let start=null,end=null;
  for(const d of paydaysBetween(f,t)){if(d<=now)start=d;else if(!end)end=d}
  if(start&&end)return{start,end,quincena:true};
  return{start:new Date(now.getFullYear(),now.getMonth(),1),end:new Date(now.getFullYear(),now.getMonth()+1,1),quincena:false};
}
function renderCiclo(disp){
  const {start,end,quincena}=cycleBounds();const now=midnight();
  const days=[];for(const d=new Date(start);d<end;d.setDate(d.getDate()+1))days.push(new Date(d));
  const by={};S.gastos.forEach(g=>{if(g.fecha)by[g.fecha]=(by[g.fecha]||0)+(g.valor||0)});
  const vals=days.map(d=>by[iso(d)]||0);
  const past=days.map(d=>d<=now);
  const passed=Math.max(1,past.filter(Boolean).length);
  const spent=vals.reduce((s,v,i)=>past[i]?s+v:s,0);
  const avg=spent/passed;
  const finMes=new Date(now.getFullYear(),now.getMonth()+1,0);const diasMes=Math.round((finMes-now)/864e5)+1;
  const ritmo=disp!=null&&disp>0?disp/diasMes:null;
  const max=Math.max(1,...vals,ritmo||0)*1.12;
  const last=days[days.length-1];
  const corto=d=>d.getDate()+" "+MESES[d.getMonth()].slice(0,3).toLowerCase();
  const ti=days.findIndex(d=>+d===+now);
  const lab=i=>{if(i===ti)return'<span class="hoy">Hoy</span>';if(i===0&&(ti<0||ti>2))return`<span>${corto(days[0])}</span>`;if(i===days.length-1&&(ti<0||ti<days.length-3))return`<span>${corto(last)}</span>`;return"<span></span>"};
  const third=disp==null?`<div><b class="muted">—</b><span>Pon tu sueldo para ver tu ritmo</span></div>`
    :disp<=0?`<div><b style="color:var(--neg)">En rojo</b><span>No te queda plata este mes</span></div>`
    :`<div><b class="num">${fmt(ritmo)}</b><span>Por día hasta fin de mes</span></div>`;
  $("#cicloBox").innerHTML=`
    <div class="row-head"><div><h2>${quincena?"Tu quincena, día a día":"Tu mes, día a día"}</h2><p class="small muted">${corto(start)} – ${corto(last)} · gastos de todos los medios</p></div></div>
    <div class="ciclo-stats">
      <div><b class="num">${fmt(spent)}</b><span>Gastado ${quincena?"en esta quincena":"este mes"}</span></div>
      <div><b class="num">${fmt(avg)}</b><span>Promedio por día</span></div>
      ${third}
    </div>
    <div class="chart">
      <div class="plot">
        ${ritmo?`<div class="ref" style="bottom:${(ritmo/max*100).toFixed(2)}%"><span class="num">Ritmo ${fmt(ritmo)}</span></div>`:""}
        <div class="cols">${days.map((d,i)=>{const v=vals[i],fut=!past[i];
          const tip=dLabel(d)+": "+(fut?"todavía no llega":fmt(v));
          return `<button type="button" class="col ${fut?"future":v?"":"zero"}" style="--h:${(v/max*100).toFixed(2)}%" data-tip="${esc(tip)}" aria-label="${esc(tip)}"><i></i></button>`}).join("")}</div>
      </div>
      <div class="xlab" aria-hidden="true">${days.map((d,i)=>lab(i)).join("")}</div>
    </div>
    <div class="tip" hidden></div>`;
}
function cicloTip(col){
  const box=$("#cicloBox"),tip=box.querySelector(".tip"),plot=box.querySelector(".plot");if(!tip||!plot)return;
  box.querySelectorAll(".col.on").forEach(c=>c.classList.remove("on"));
  if(!col){tip.hidden=true;return}
  col.classList.add("on");tip.textContent=col.dataset.tip;tip.hidden=false;
  const br=box.getBoundingClientRect(),cr=col.getBoundingClientRect();
  const half=tip.offsetWidth/2+8;const x=Math.max(half,Math.min(br.width-half,cr.left-br.left+cr.width/2));
  tip.style.left=x+"px";tip.style.top=(plot.offsetTop-6)+"px";
}
(()=>{const b=$("#cicloBox");
  b.addEventListener("pointerover",e=>{const c=e.target.closest(".col");if(c)cicloTip(c)});
  b.addEventListener("pointerleave",()=>cicloTip(null));
  b.addEventListener("focusin",e=>{const c=e.target.closest(".col");if(c)cicloTip(c)});
  b.addEventListener("focusout",()=>cicloTip(null));
  b.addEventListener("click",e=>{const c=e.target.closest(".col");if(c)cicloTip(c)});
})();
function renderAgenda(){
  const from=midnight(),to=new Date(from);to.setDate(to.getDate()+45);
  const ev=[];
  paydaysBetween(from,to).forEach(d=>ev.push({d,k:"in",t:"Te pagan el sueldo",amt:S.ajustes.montoPago,inc:true}));
  S.tarjetas.forEach(t=>{
    for(let i=0;i<2;i++){if(!t.dia)break;const base=nextOn(t.dia);const d=onDay(base.getFullYear(),base.getMonth()+i,t.dia);if(d<=to)ev.push({d,k:"out",t:"Pagar "+t.nombre,lbl:i===0&&!minNA(t)?minLabel(t):null,na:i===0&&minNA(t),s:i===0?"Pago mínimo":"Mínimo del siguiente extracto"})}
    for(let i=0;i<2;i++){if(!t.corte)break;const base=nextOn(t.corte);const d=onDay(base.getFullYear(),base.getMonth()+i,t.corte);if(d<=to)ev.push({d,k:"info",t:"Corte "+t.nombre,s:"Desde aquí las compras pasan al siguiente extracto"})}
  });
  (S.ajustes.fijos||[]).forEach((f,idx)=>{if(!f.dia)return;
    for(let i=0;i<2;i++){const base=nextOn(f.dia);const d=onDay(base.getFullYear(),base.getMonth()+i,f.dia);if(d<=to){const mk=monthKey(iso(d));ev.push({d,k:"fijo",t:f.nombre,amt:f.valor,s:"Gasto fijo",fijo:idx,mk,done:f.pagado===mk})}}
  });
  ev.sort((a,b)=>a.d-b.d||(a.k==="in"?-1:1));
  if(!ev.length){$("#agendaList").innerHTML='<div class="empty">Aún no hay fechas. Pon los días de pago de cada tarjeta (en Tarjetas → Editar), los días en que te pagan y los días de tus gastos fijos (en Más).</div>';return}
  let html='<div class="list">',cur="";
  ev.forEach(e=>{const key=iso(e.d);
    if(key!==cur){cur=key;const dd=daysUntil(e.d);html+=`<div class="day-h"><span>${dLabel(e.d)}</span><span>${dd===0?"Hoy":dd===1?"Mañana":"en "+dd+" días"}</span></div>`}
    const amt=e.lbl?`<div class="amt num">${esc(e.lbl)}</div>`:e.amt!=null?`<div class="amt num ${e.inc?"in":""}">${e.inc?"+ ":""}${fmt(e.amt)}</div>`:e.na?'<div class="amt"><span class="na">Mínimo aún no disponible</span></div>':"";
    const tick=e.fijo!=null?`<button class="tick" aria-pressed="${e.done}" data-fijopag="${e.fijo}" data-mk="${e.mk}" aria-label="Marcar ${esc(e.t)} como pagado">${e.done?"✓":""}</button>`:`<span class="dot ${e.k}"></span>`;
    html+=`<div class="item ${e.done?"done":""}">${tick}<div class="main"><div class="t">${esc(e.t)}</div>${e.s?`<div class="s">${esc(e.s)}</div>`:""}</div>${amt}</div>`;
  });
  $("#agendaList").innerHTML=html+"</div>";
}
function renderTarjetas(){
  const cs=S.cuentas.slice().sort((a,b)=>(a.orden??99)-(b.orden??99));
  $("#acctTotal").textContent=cs.length?"Total "+fmt(cs.reduce((s,c)=>s+(c.saldo||0),0)):"";
  $("#acctList").innerHTML=cs.length?cs.map(c=>{const ms=S.movcuentas.filter(m=>m.cuentaId===c.id).sort(byRecent).slice(0,3);return `
    <article class="card acct">
      <div class="card-top"><h3>${esc(c.nombre)}</h3><span class="chip in">Ahorros</span></div>
      <div class="acct-bal num">${fmt(c.saldo)}</div>
      ${ms.length?'<div class="list" style="background:var(--surface-2)">'+ms.map(m=>movRow(m,false)).join("")+"</div>":'<p class="hint" style="margin:0">Sin movimientos todavía.</p>'}
      <div class="actions"><button class="primary" data-mov="${esc(c.id)}">+ Movimiento</button><button data-hist="${esc(c.id)}">Ver todo</button><button data-edita="${esc(c.id)}">Editar</button></div>
    </article>`}).join(""):'<div class="empty">Agrega tus cuentas (Ahorros Bancolombia, Nequi, Nu, etc.) con lo que tienes hoy. Después, los gastos, la quincena y los pagos de tarjeta pueden moverse solos desde o hacia cada cuenta.</div>';
  const usoCls=p=>p>=100?"over":p>=80?"high":p>=50?"mid":"low";
  const usoTxt=p=>p>=100?"Sobrecupo":p>=80?"Casi lleno":p>=50?"A la mitad":"Saludable";
  const conDeuda=t=>deudaCopCard(t)>0||t.saldo==null&&t.saldoUsd==null;
  const ordenDue=t=>{const d=dueInfo(t.dia);return d?d.days:999};
  const activas=S.tarjetas.filter(conDeuda).sort((a,b)=>ordenDue(a)-ordenDue(b)||deudaCopCard(b)-deudaCopCard(a));
  const libres=S.tarjetas.filter(t=>!conDeuda(t)).sort((a,b)=>String(a.nombre).localeCompare(b.nombre));
  const cupoTot=S.tarjetas.reduce((s,t)=>s+(t.cupo||0),0),usoTot=S.tarjetas.reduce((s,t)=>s+(t.cupo?deudaCopCard(t):0),0),pTot=cupoTot?usoTot/cupoTot*100:0;
  const resumen=S.tarjetas.length?`<div class="cupo-sum">
      <div class="cs-top"><div><div class="eyebrow">Deuda total en tarjetas</div><div class="cs-big num">${fmt(S.tarjetas.reduce((s,t)=>s+deudaCopCard(t),0))}</div></div>
      ${cupoTot?`<span class="uso-pill ${usoCls(pTot)}">${Math.round(pTot)}% del cupo</span>`:""}</div>
      ${cupoTot?`<div class="uso-bar ${usoCls(pTot)}"><i style="width:${Math.min(100,pTot)}%"></i></div><div class="cs-sub num"><span>Usado ${fmt(usoTot)}</span><span>Disponible ${fmt(Math.max(0,cupoTot-usoTot))}</span></div>`:""}
    </div>`:"";
  const tarjeta=t=>{const due=dueInfo(t.dia);const corte=t.corte?nextOn(t.corte):null;const tot=deudaCopCard(t);const p=t.cupo&&(t.saldo!=null||t.saldoUsd!=null)?tot/t.cupo*100:null;return `
    <article class="card tcard">
      <div class="card-top"><h3>${esc(t.nombre)}</h3>${due?`<span class="chip ${due.cls}">${due.label}</span>`:'<span class="chip">Sin fecha</span>'}</div>
      <div><div class="eyebrow">Deuda total</div><div class="t-big num">${t.saldo==null&&t.saldoUsd==null?'<span class="na">Sin registrar</span>':fmt(tot)}</div>
        ${t.usd&&t.saldoUsd?`<div class="hint num">${fmt(t.saldo||0)} + ${fmtU(t.saldoUsd)} · dólar a ${fmt(trm())}</div>`:""}</div>
      ${p!=null?`<div class="uso"><div class="uso-row num"><span>Cupo usado <b class="uso-txt ${usoCls(p)}">${Math.round(p)}% · ${usoTxt(p)}</b></span><span class="muted">de ${fmt(t.cupo)}</span></div>
        <div class="uso-bar ${usoCls(p)}"><i style="width:${Math.min(100,p)}%"></i></div>
        <div class="hint num">Disponible ${fmt(Math.max(0,t.cupo-tot))}${p>=100?" · te pasaste por "+fmt(tot-t.cupo):""}</div></div>`:""}
      <div class="ios-list">
        <div class="ios-row"><span>Pago mínimo</span><b class="num">${minNA(t)?'<span class="na">Aún no disponible</span>':esc(minLabel(t))}</b></div>
        <div class="ios-row"><span>Fecha límite</span><b>${due?due.txt:'<span class="na">Sin definir</span>'}</b></div>
        <div class="ios-row"><span>Fecha de corte</span><b>${corte?dLabel(corte):'<span class="na">Sin definir</span>'}</b></div>
      </div>
      ${typeof payoffCard==="function"?payoffCard(t):""}
      <div class="actions"><button class="primary" data-pay="${esc(t.id)}">Registrar pago</button><button data-edit="${esc(t.id)}">Editar</button></div>
    </article>`};
  $("#cardsList").innerHTML=S.tarjetas.length?resumen+activas.map(tarjeta).join("")+
    (libres.length?`<div class="sec-h">Sin deuda</div><div class="ios-list solo">${libres.map(t=>`<button class="ios-row" data-edit="${esc(t.id)}"><span>${esc(t.nombre)}</span><b class="muted num">${t.cupo?"Cupo "+fmt(t.cupo):"Al día"}</b></button>`).join("")}</div>`:"")
    :'<div class="empty">Aún no hay tarjetas. Agrega la primera con el botón de abajo.</div>';
}
function renderMovs(){
  const meses=new Set([monthKey(today()),...S.gastos.map(g=>monthKey(g.fecha)),...S.ingresos.map(i=>monthKey(i.fecha)),...S.pagos.map(p=>monthKey(p.fecha))].filter(Boolean));
  const opts=[...meses].sort().reverse();if(!opts.includes(mes))mes=opts[0];
  $("#mesSel").innerHTML=opts.map(m=>`<option value="${m}" ${m===mes?"selected":""}>${MESES[+m.slice(5)-1]} ${m.slice(0,4)}</option>`).join("");
  const gl=S.gastos.filter(g=>monthKey(g.fecha)===mes).sort((a,b)=>(b.fecha||"").localeCompare(a.fecha||"")||(b.creado||0)-(a.creado||0));
  $("#gastosTotal").innerHTML=`Gastos · <span class="num">${fmt(gl.reduce((s,g)=>s+(g.valor||0),0))}</span>`;
  $("#gastosList").innerHTML=gl.length?'<div class="list">'+gl.map(g=>`<button class="item" data-editg="${esc(g.id)}"><div class="main"><div class="t">${esc(g.nota||g.categoria)}</div><div class="s">${esc(g.categoria)} · ${esc(fechaCorta(g.fecha))}${g.medio?" · "+esc(g.medio):""}</div></div><div class="amt num">${g.valorUsd!=null?fmtU(g.valorUsd)+'<div class="s" style="font-weight:400">≈ '+fmt(g.valor)+'</div>':fmt(g.valor)}</div></button>`).join("")+"</div>"
    :'<div class="empty">Sin gastos en este mes. Toca <b>+ Gasto</b> para agregar uno.</div>';
  const il=S.ingresos.filter(i=>monthKey(i.fecha)===mes).sort((a,b)=>(b.fecha||"").localeCompare(a.fecha||""));
  $("#ingList").innerHTML=il.length?'<div class="list">'+il.map(i=>`<div class="item"><span class="dot in"></span><div class="main"><div class="t">${esc(i.nota||"Sueldo")}</div><div class="s">${esc(fechaCorta(i.fecha))}${i.cuenta?" · a "+esc(i.cuenta):""}</div></div><div class="amt num in">+ ${fmt(i.valor)}</div><button class="x" data-deli="${esc(i.id)}" aria-label="Borrar ingreso">✕</button></div>`).join("")+"</div>"
    :'<div class="empty">Cuando te llegue la quincena, toca <b>+ Me pagaron</b> y pon cuánto llegó de verdad.</div>';
  const mcl=S.movcuentas.filter(m=>monthKey(m.fecha)===mes).sort(byRecent);
  $("#movCtaList").innerHTML=mcl.length?'<div class="list">'+mcl.map(m=>movRow(m,true)).join("")+"</div>":'<div class="empty">Aquí salen las entradas, salidas y transferencias de tus cuentas de ahorro.</div>';
  const pl=S.pagos.filter(p=>monthKey(p.fecha)===mes).sort((a,b)=>(b.fecha||"").localeCompare(a.fecha||""));
  $("#pagosList").innerHTML=pl.length?'<div class="list">'+pl.map(p=>`<div class="item"><span class="dot out"></span><div class="main"><div class="t">${esc(p.tarjeta)}</div><div class="s">${esc(fechaCorta(p.fecha))}${p.valorUsd?" · abono de "+fmtU(p.valorUsd):""}</div></div><div class="amt num">${fmt(p.valor)}</div><button class="x" data-delp="${esc(p.id)}" aria-label="Borrar pago">✕</button></div>`).join("")+"</div>"
    :'<div class="empty">Cuando registres un pago a una tarjeta aparecerá aquí.</div>';
}
function renderMas(a){
  const ae=document.activeElement?.id;
  if(ae!=="ingValor")$("#ingValor").value=a.montoPago?fmt(a.montoPago):"";
  if(ae!=="ingOtros")$("#ingOtros").value=a.otros?fmt(a.otros):"";
  if(ae!=="ingDias")$("#ingDias").value=(a.diasPago||[]).join(", ");
  const fr=n=>n?"$ "+Number(n).toLocaleString("es-CO",{maximumFractionDigits:2}):"";
  if(ae!=="trmVal")$("#trmVal").value=fr(a.trm);
  if(ae!=="bancoVal")$("#bancoVal").value=fr(a.tasaBanco);
  $("#trmHint").textContent=(a.trmFecha?"Vigente el "+fechaCorta(a.trmFecha)+". ":"")+"Se actualiza sola con la TRM oficial publicada en datos.gov.co. Se usa si no hay tasa Bancolombia.";
  $("#bancoHint").textContent=(a.tasaBanco?"Guardada el "+fechaCorta(a.tasaBancoFecha)+". Es la que se usa para convertir tus dólares a pesos. ":"Vacía: se usa la TRM oficial. ")+"Bancolombia no la publica en internet; la ves en su app al pagar la tarjeta en dólares. Déjala vacía para usar solo la TRM.";
  const fj=a.fijos||[];const mk=monthKey(today());
  $("#fijosList").innerHTML=fj.length?'<div class="list">'+fj.map((f,i)=>`<div class="item ${f.pagado===mk?"done":""}"><button class="tick" aria-pressed="${f.pagado===mk}" data-fijopag="${i}" data-mk="${mk}" aria-label="Pagado este mes">${f.pagado===mk?"✓":""}</button><div class="main"><div class="t">${esc(f.nombre)}</div><div class="s">${f.dia?"Cada día "+f.dia:"Sin día"}${f.pagado===mk?" · pagado este mes":""}</div></div><div class="amt num">${fmt(f.valor)}</div><button class="x" data-delf="${i}" aria-label="Quitar ${esc(f.nombre)}">✕</button></div>`).join("")+"</div>"
    :'<div class="empty">Ej. aporte en casa, plan de celular, transporte, Spotify. Con el día de pago aparecen en la Agenda.</div>';
  const pres=a.presupuestos||{};
  if(!$("#presuList").contains(document.activeElement))
    $("#presuList").innerHTML=cats().map((c,i)=>`<div class="item" style="padding:0;border:0;gap:8px"><div class="main"><div class="t">${esc(c)}</div></div><input style="max-width:150px" class="num" inputmode="numeric" placeholder="Sin límite" data-presu="${esc(c)}" id="presu-${i}" value="${pres[c]?fmt(pres[c]):""}"><button class="x" data-delcat="${esc(c)}" aria-label="Quitar categoría ${esc(c)}">✕</button></div>`).join("");
  $("#metasList").innerHTML=S.metas.length?S.metas.map(m=>{const p=m.objetivo?Math.min(100,(m.ahorrado||0)/m.objetivo*100):0;return `<div class="panel"><div class="row-head"><h3 style="font-size:16px">${esc(m.nombre)}</h3><span class="chip ${p>=100?"in":""}">${Math.round(p)}%</span></div>
    <div class="small muted num">${fmt(m.ahorrado)} de ${fmt(m.objetivo)}${p<100?" · te faltan "+fmt(m.objetivo-(m.ahorrado||0)):" · ¡meta cumplida!"}</div><div class="meter"><i style="width:${p}%"></i></div>
    <div class="actions"><button class="primary" data-abono="${esc(m.id)}">+ Abonar</button><button data-editm="${esc(m.id)}">Editar</button></div></div>`}).join("")
    :'<div class="empty">Ej. curso de piloto, un PC, un viaje. Pon cuánto necesitas y ve abonando.</div>';
}

/* ---------- Hojas ---------- */
let sheetT=null;
function openSheet(title,html,onMount){clearTimeout(sheetT);$("#sheetBack").classList.remove("closing");const sh=$("#sheetBack .sheet");sh.style.transform="";$("#sheetTitle").textContent=title;$("#sheetBody").innerHTML=html;$("#sheetBody").querySelectorAll("input").forEach(i=>i.setAttribute("autocomplete","off"));$("#sheetBack").hidden=false;onMount&&onMount();const f=$("#sheetBody input:not([disabled])");f&&setTimeout(()=>f.focus(),50)}
function closeSheet(ya){const b=$("#sheetBack");if(b.hidden)return;
  if(ya===true||matchMedia("(prefers-reduced-motion: reduce)").matches){b.classList.remove("closing");$("#sheetBack .sheet").style.transform="";b.hidden=true;$("#sheetBody").innerHTML="";return}
  b.classList.add("closing");clearTimeout(sheetT);sheetT=setTimeout(()=>{if(!b.classList.contains("closing"))return;b.hidden=true;b.classList.remove("closing");$("#sheetBack .sheet").style.transform="";$("#sheetBody").innerHTML=""},300)}
/* Deslizar hacia abajo para cerrar la hoja, como en iPhone: sigue el dedo 1:1, resiste al subir,
   proyecta el impulso para decidir, y termina con un resorte que hereda la velocidad del dedo. */
(()=>{const sh=$("#sheetBack .sheet");let g=null,stop=null;
  const quieto=()=>matchMedia("(prefers-reduced-motion: reduce)").matches;
  const goma=(o,d)=>(o*d*.55)/(d+.55*Math.abs(o));
  const proyectar=(v,r=.998)=>(v/1000)*r/(1-r);
  const resorte=(desde,hasta,v0,{amort=1,resp=.3},cada,fin)=>{const w=2*Math.PI/resp;let x=desde-hasta,v=v0,t0=performance.now(),id;
    const paso=t=>{const dt=Math.min(.032,(t-t0)/1000);t0=t;v+=(-w*w*x-2*amort*w*v)*dt;x+=v*dt;
      if(Math.abs(x)<.5&&Math.abs(v)<8){cada(hasta);fin&&fin();return}cada(hasta+x);id=requestAnimationFrame(paso)};
    id=requestAnimationFrame(paso);return()=>cancelAnimationFrame(id)};
  const pon=y=>{sh.style.transform=y?`translateY(${y}px)`:""};
  sh.addEventListener("touchstart",e=>{if(sh.scrollTop>0||e.target.closest("input,select,textarea,[type=range],.chat"))return;
    stop&&stop();stop=null;const m=/translateY\((-?[\d.]+)px\)/.exec(sh.style.transform);const base=m?+m[1]:0;
    const y=e.touches[0].clientY;g={y0:y-base,base,act:false,h:[[performance.now(),base]]}},{passive:true});
  sh.addEventListener("touchmove",e=>{if(!g)return;let d=e.touches[0].clientY-g.y0;
    if(!g.act){if(Math.abs(d-g.base)<10)return;if(d<g.base&&g.base===0){g=null;return}g.act=true;sh.classList.add("dragging")}
    const y=d<0?-goma(-d,sh.offsetHeight):d;pon(y);g.h.push([performance.now(),y]);if(g.h.length>6)g.h.shift()},{passive:true});
  const suelta=()=>{if(!g)return;const a=g;g=null;if(!a.act)return;sh.classList.remove("dragging");
    const [t1,y1]=a.h[a.h.length-1],[t0,y0]=a.h[0];const v=t1>t0?(y1-y0)/((t1-t0)/1000):0;const alto=sh.offsetHeight;
    if(quieto()){if(y1>alto*.3)closeSheet(true);else pon(0);return}
    if(y1+proyectar(v)>alto*.5){vibrar(6);stop=resorte(y1,alto,v,{amort:1,resp:.28},pon,()=>{stop=null;closeSheet(true)})}
    else stop=resorte(y1,0,v,{amort:.85,resp:.3},pon,()=>{stop=null})};
  sh.addEventListener("touchend",suelta);sh.addEventListener("touchcancel",suelta);
})();
const vibrar=(ms=8)=>{try{navigator.vibrate&&navigator.vibrate(ms)}catch(e){}};
$("#sheetClose").onclick=closeSheet;
$("#sheetBack").addEventListener("click",e=>{if(e.target.id==="sheetBack")closeSheet()});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("#sheetBack").hidden)closeSheet()});
function toast(m,act){if(/^(Escribe|Pon |Elige|Falta)/.test(m))setTimeout(()=>{const s=document.querySelector("#sheetBack:not([hidden]) #sheetBody");const f=document.activeElement&&document.activeElement.matches("input,select,textarea")?document.activeElement:s&&[...s.querySelectorAll("input:not([type=checkbox]),select")].find(i=>!i.value);window.sacudir&&sacudir(f)},0);const t=$("#toast");t.textContent="";const sp=document.createElement("span");sp.textContent=m;t.appendChild(sp);
  if(act){const b=document.createElement("button");b.type="button";b.className="toast-act";b.textContent=act.label;b.onclick=()=>{t.hidden=true;act.fn()};t.appendChild(b)}
  t.classList.toggle("has-act",!!act);t.hidden=false;clearTimeout(toast.h);toast.h=setTimeout(()=>t.hidden=true,act?5500:2400)}
function confirmBtn(btn,fn,txt){let armed=false;btn.onclick=()=>{if(!armed){armed=true;btn.textContent=txt||"Toca otra vez para confirmar";return}fn()}}

function gastoSheet(g,pre){
  const isNew=!g;g=g||{valor:null,categoria:cats()[0],nota:"",fecha:today(),medio:"Efectivo",...(pre||{})};
  let cat=g.categoria, cur=g.valorUsd!=null?"usd":"cop";
  const opts=[{k:"efectivo",l:"Efectivo"},...S.cuentas.map(c=>({k:"c:"+c.id,l:c.nombre+" (cuenta)"})),...(S.cuentas.length?[]:[{k:"debito",l:"Débito / Nequi"}]),...S.tarjetas.map(t=>({k:"t:"+t.id,l:t.nombre}))];
  let sel=g.cuentaId?"c:"+g.cuentaId:g.tarjetaId?"t:"+g.tarjetaId:g.medio==="Débito / Nequi"?"debito":"efectivo";
  if(!opts.some(o=>o.k===sel))opts.push({k:sel,l:g.medio||"Otro"});
  if(pre&&pre.medioKey)sel=pre.medioKey;
  else if(isNew&&S.cuentas.length&&sel==="efectivo"){const last=S.gastos.slice().sort((a,b)=>(b.creado||0)-(a.creado||0))[0];if(last&&last.cuentaId&&S.cuentas.some(c=>c.id===last.cuentaId))sel="c:"+last.cuentaId}
  const cs=cats().includes(cat)?cats():[...cats(),cat];
  const key=()=>$("#gMedio").value;
  const card=()=>{const k=key();return k.startsWith("t:")?S.tarjetas.find(x=>x.id===k.slice(2)):null};
  const acct=()=>{const k=key();return k.startsWith("c:")?S.cuentas.find(x=>x.id===k.slice(2)):null};
  openSheet(isNew?"Nuevo gasto":"Editar gasto",`<form id="fg">
    ${isNew?`<label>Escríbelo como hablas<input id="gTexto" placeholder="Ej. almuerzo 18 mil nequi" autocomplete="off" spellcheck="false"><span class="hint">Luca llena los campos por ti. Revisa y guarda.</span></label>`:""}
    <label>Pagado con<select id="gMedio">${opts.map(o=>`<option value="${esc(o.k)}" ${o.k===sel?"selected":""}>${esc(o.l)}</option>`).join("")}</select></label>
    <div class="cats seg" id="gCur" hidden><button type="button" data-cur="cop">En pesos (COP)</button><button type="button" data-cur="usd">En dólares (US$)</button></div>
    <label><span id="gValLbl">¿Cuánto?</span><input id="gVal" class="money num" autocomplete="off"><span class="hint" id="gConv" hidden></span></label>
    <div><div class="eyebrow" style="margin-bottom:6px">Categoría</div><div class="cats" id="gCats">${cs.map(c=>`<button type="button" aria-pressed="${c===cat}" data-c="${esc(c)}">${esc(c)}</button>`).join("")}</div></div>
    <label>Nota (opcional)<input id="gNota" placeholder="Ej. almuerzo, Uber, Netflix" value="${esc(g.nota)}"></label>
    <label>Fecha<input id="gFecha" type="date" value="${esc(g.fecha||today())}"></label>
    ${isNew?`<label class="check" id="gSumWrap" hidden><input type="checkbox" id="gSum" checked> <span id="gSumLbl">Sumar a la deuda de la tarjeta</span></label>
    <label class="check"><input type="checkbox" id="gRap"> <span>Guardar como gasto rápido</span></label>`:""}
    <p class="hint" id="gHint" style="margin:0" hidden></p>
    <button class="primary" type="submit">${isNew?"Guardar gasto":"Guardar cambios"}</button>
    ${isNew?"":'<button type="button" class="danger" id="gDel">Borrar este gasto</button>'}</form>`,()=>{
    const inp=$("#gVal");
    inp.addEventListener("input",()=>{if(cur==="cop"){const n=parse(inp.value);inp.value=n==null?"":fmt(n)}conv()});
    inp.addEventListener("blur",()=>{if(cur==="usd"){const n=parseU(inp.value);inp.value=n==null?"":fmtU(n)}});
    const conv=()=>{const c=$("#gConv");if(cur!=="usd"){c.hidden=true;return}const u=parseU(inp.value);c.hidden=false;c.textContent=u?"≈ "+fmt(u*trm())+" con el dólar a "+fmt(trm())+" ("+rateName()+")":"Usa coma para los centavos, por ejemplo 19,99."};
    const setCur=(c,keep)=>{cur=c;$("#gCur").querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.cur===c));
      if(!keep)inp.value="";
      inp.placeholder=c==="usd"?"US$ 0,00":"$ 0";inp.inputMode=c==="usd"?"decimal":"numeric";
      $("#gValLbl").textContent=c==="usd"?"¿Cuántos dólares?":"¿Cuánto?";syncSum();conv()};
    const syncSum=()=>{const t=card();if(!$("#gSumLbl")||!t)return;
      $("#gSumLbl").textContent=cur==="usd"?"Sumar a la deuda en dólares de "+t.nombre:"Sumar a la deuda en pesos de "+t.nombre};
    const syncMedio=()=>{const t=card(),c=acct(),h=$("#gHint");
      h.hidden=!(t||c);h.textContent=t?"Las compras con tarjeta cuentan en tus categorías, pero no se restan de tu plata del mes: eso pasa cuando pagas la tarjeta.":c?"Se descuenta del saldo de "+c.nombre+" (tiene "+fmt(c.saldo)+").":"";
      if($("#gSumWrap"))$("#gSumWrap").hidden=!t;
      const usdOk=!!(t&&t.usd);$("#gCur").hidden=!usdOk;
      if(!usdOk&&cur==="usd")setCur("cop");else syncSum()};
    if(g.valorUsd!=null){inp.value=fmtU(g.valorUsd)}else if(g.valor){inp.value=fmt(g.valor)}
    setCur(cur,true);syncMedio();
    const pickCat=c=>{if(!c)return;if(!$("#gCats").querySelector(`[data-c="${CSS.escape(c)}"]`))return;cat=c;$("#gCats").querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",x.dataset.c===c))};
    $("#gTexto")&&$("#gTexto").addEventListener("input",()=>{const r=typeof interpretarGasto==="function"&&interpretarGasto($("#gTexto").value);if(!r)return;
      if(r.medioKey&&opts.some(o=>o.k===r.medioKey)){$("#gMedio").value=r.medioKey;syncMedio()}
      const t=card();if(r.valorUsd!=null&&t&&t.usd){if(cur!=="usd")setCur("usd");inp.value=fmtU(r.valorUsd);conv()}else if(r.valor){if(cur!=="cop")setCur("cop");inp.value=fmt(r.valor)}
      pickCat(r.categoria);$("#gNota").value=r.nota||"";$("#gFecha").value=r.fecha||today()});
    $("#gMedio").onchange=syncMedio;
    $("#gCur").onclick=e=>{const b=e.target.closest("button");if(b&&b.dataset.cur!==cur)setCur(b.dataset.cur)};
    $("#gCats").onclick=e=>{const b=e.target.closest("button");if(!b)return;cat=b.dataset.c;$("#gCats").querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",x===b))};
    $("#fg").onsubmit=async e=>{e.preventDefault();
      const t=card(),c=acct(),k=key();const usd=cur==="usd"&&t&&t.usd;
      const u=usd?parseU(inp.value):null;const v=usd?(u?Math.round(u*trm()):null):parse(inp.value);
      if(!v){toast(usd?"Escribe cuántos dólares gastaste":"Escribe cuánto gastaste");return}
      const id=g.id||uid();
      const data={valor:v,valorUsd:usd?u:null,categoria:cat,nota:$("#gNota").value.trim(),fecha:$("#gFecha").value||today(),
        medio:t?t.nombre:c?c.nombre:k==="debito"?"Débito / Nequi":k==="efectivo"?"Efectivo":(g.medio||"Otro"),tarjetaId:t?t.id:null,cuentaId:c?c.id:null,creado:g.creado||Date.now()};
      const sumar=isNew&&t&&$("#gSum")&&$("#gSum").checked;
      if(sumar)data.sumado=usd?{usd:u}:{cop:v};
      if(isNew&&$("#gRap")&&$("#gRap").checked&&typeof guardarRapido==="function")guardarRapido({nota:data.nota,valor:v,valorUsd:data.valorUsd,categoria:cat,medioKey:k});
      closeSheet();
      if(!isNew)await undoRef(id);
      await put("gastos",id,data);
      if(c)await moveAcct(c.id,-v,{tipo:"gasto",nota:data.nota||cat,fecha:data.fecha,ref:id});
      if(sumar){const fresh=S.tarjetas.find(x=>x.id===t.id)||t;
        await put("tarjetas",t.id,usd?{...strip(fresh),saldoUsd:Math.round(((fresh.saldoUsd||0)+u)*100)/100}:{...strip(fresh),saldo:(fresh.saldo||0)+v})}
      toast(!isNew?"Gasto actualizado":sumar?(usd?fmtU(u)+" sumados a la deuda en dólares de ":"Gasto sumado a ")+t.nombre:c?"Gasto descontado de "+c.nombre:"Gasto guardado")};
    if(!isNew)confirmBtn($("#gDel"),async()=>{closeSheet();await undoRef(g.id);await del("gastos",g.id);toast("Gasto borrado")},"Toca otra vez para borrar");
  });
}
const TIPOS={entrada:"Entrada",salida:"Salida",transferencia:"Transferencia",gasto:"Gasto",ingreso:"Ingreso",pago:"Pago de tarjeta",ajuste:"Ajuste de saldo"};
const MANUAL=["entrada","salida","transferencia","ajuste"];
const byRecent=(a,b)=>(b.fecha||"").localeCompare(a.fecha||"")||(b.creado||0)-(a.creado||0);
const pAcct=()=>S.cuentas.find(x=>x.id===($("#pCuenta")?.value||""));
async function moveAcct(cuentaId,delta,mov){
  const c=S.cuentas.find(x=>x.id===cuentaId);if(!c)return;
  await put("cuentas",c.id,{...strip(c),saldo:Math.round((c.saldo||0)+delta)});
  if(mov)await put("movcuentas",uid(),{cuentaId:c.id,cuenta:c.nombre,valor:Math.round(delta),creado:Date.now(),...mov});
}
async function undoRef(ref){
  for(const m of S.movcuentas.filter(x=>x.ref===ref)){
    const c=S.cuentas.find(x=>x.id===m.cuentaId);
    if(c)await put("cuentas",c.id,{...strip(c),saldo:Math.round((c.saldo||0)-(m.valor||0))});
    await del("movcuentas",m.id);
  }
}
async function undoMov(m){
  if(m.ref){await undoRef(m.ref);return}
  const c=S.cuentas.find(x=>x.id===m.cuentaId);
  if(c)await put("cuentas",c.id,{...strip(c),saldo:Math.round((c.saldo||0)-(m.valor||0))});
  await del("movcuentas",m.id);
}
function movRow(m,showAcct){
  const pos=(m.valor||0)>=0;const canDel=MANUAL.includes(m.tipo);
  return `<div class="item"><span class="dot ${pos?"in":"out"}"></span><div class="main"><div class="t">${esc(m.nota||TIPOS[m.tipo]||"Movimiento")}</div><div class="s">${esc(TIPOS[m.tipo]||"")} · ${esc(fechaCorta(m.fecha))}${showAcct?" · "+esc(m.cuenta):""}</div></div><div class="amt num ${pos?"in":""}">${pos?"+ ":"− "}${fmt(Math.abs(m.valor||0))}</div>${canDel?`<button class="x" data-delmov="${esc(m.id)}" aria-label="Borrar movimiento">✕</button>`:""}</div>`;
}
function acctSheet(c){
  const isNew=!c;c=c||{nombre:"",saldo:null};
  openSheet(isNew?"Nueva cuenta":"Editar cuenta",`<form id="fa">
    <label>Nombre de la cuenta<input id="aNom" value="${esc(c.nombre)}" placeholder="Ej. Ahorros Bancolombia, Nequi, Nu"></label>
    <label>${isNew?"¿Cuánto tienes ahora?":"Saldo actual"}<input id="aSal" class="money num" inputmode="numeric" placeholder="$ 0" value="${c.saldo!=null?fmt(c.saldo):""}"><span class="hint">${isNew?"Míralo en la app del banco.":"Si lo cambias, queda registrado como ajuste de saldo."}</span></label>
    <button class="primary" type="submit">Guardar</button>
    ${isNew?"":'<button type="button" class="danger" id="aDel">Eliminar esta cuenta</button>'}</form>`,()=>{
    liveMoney($("#aSal"));
    $("#fa").onsubmit=async e=>{e.preventDefault();const nombre=$("#aNom").value.trim();if(!nombre){toast("Ponle un nombre");return}
      const saldo=parse($("#aSal").value)||0;const id=c.id||uid();
      closeSheet();
      if(isNew){await put("cuentas",id,{nombre,saldo,orden:S.cuentas.length,creado:Date.now()});toast("Cuenta agregada")}
      else{const delta=saldo-(c.saldo||0);await put("cuentas",id,{...strip(c),nombre,saldo});
        if(delta)await put("movcuentas",uid(),{cuentaId:id,cuenta:nombre,valor:delta,tipo:"ajuste",nota:"Ajuste de saldo",fecha:today(),creado:Date.now()});
        toast("Cuenta actualizada")}};
    if(!isNew)confirmBtn($("#aDel"),async()=>{closeSheet();for(const m of S.movcuentas.filter(x=>x.cuentaId===c.id))await del("movcuentas",m.id);await del("cuentas",c.id);toast("Cuenta eliminada")},"Toca otra vez para eliminar");
  });
}
function movSheet(c){
  let tipo="salida";const otras=S.cuentas.filter(x=>x.id!==c.id);
  openSheet("Movimiento en "+c.nombre,`<form id="fmv">
    <p class="muted" style="margin:0">Saldo actual: <b class="num">${fmt(c.saldo)}</b></p>
    <div class="cats seg" id="mvTipo"><button type="button" data-t="entrada" aria-pressed="false">Entró plata</button><button type="button" data-t="salida" aria-pressed="true">Salió plata</button>${otras.length?'<button type="button" data-t="transferencia" aria-pressed="false">Pasar a otra cuenta</button>':""}</div>
    <label>¿Cuánto?<input id="mvVal" class="money num" inputmode="numeric" placeholder="$ 0"></label>
    <label id="mvDestW" hidden>¿A qué cuenta?<select id="mvDest">${otras.map(o=>`<option value="${esc(o.id)}">${esc(o.nombre)}</option>`).join("")}</select></label>
    <label>Nota<input id="mvNota" placeholder="Ej. retiro cajero, me consignaron, Nequi a Bancolombia"></label>
    <label>Fecha<input id="mvFecha" type="date" value="${today()}"></label>
    <p class="hint" style="margin:0">Para compras usa mejor <b>+ Gasto</b> y elige esta cuenta: así queda en tus categorías.</p>
    <button class="primary" type="submit">Guardar movimiento</button></form>`,()=>{
    liveMoney($("#mvVal"));
    $("#mvTipo").onclick=e=>{const b=e.target.closest("button");if(!b)return;tipo=b.dataset.t;$("#mvTipo").querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",x===b));$("#mvDestW").hidden=tipo!=="transferencia"};
    $("#fmv").onsubmit=async e=>{e.preventDefault();const v=parse($("#mvVal").value);if(!v){toast("Escribe el valor");return}
      const nota=$("#mvNota").value.trim(),fecha=$("#mvFecha").value||today();
      if(tipo==="transferencia"){const d=S.cuentas.find(x=>x.id===$("#mvDest").value);if(!d)return;const ref="tr-"+uid();
        closeSheet();await moveAcct(c.id,-v,{tipo,nota:nota||"A "+d.nombre,fecha,ref});await moveAcct(d.id,v,{tipo,nota:nota||"Desde "+c.nombre,fecha,ref});toast("Pasaste "+fmt(v)+" a "+d.nombre)}
      else{closeSheet();await moveAcct(c.id,tipo==="entrada"?v:-v,{tipo,nota,fecha});toast("Movimiento guardado")}};
  });
}
function histSheet(c){
  const ms=S.movcuentas.filter(m=>m.cuentaId===c.id).sort(byRecent);
  openSheet(c.nombre,`<p class="muted" style="margin:0">Saldo: <b class="num" style="color:var(--ink)">${fmt(c.saldo)}</b> · ${ms.length} movimiento${ms.length===1?"":"s"}</p>
    ${ms.length?'<div class="list" style="background:var(--surface-2)">'+ms.map(m=>movRow(m,false)).join("")+"</div>":'<div class="empty">Sin movimientos todavía.</div>'}
    <p class="hint" style="margin:0">Los gastos, ingresos y pagos de tarjeta se borran desde la pestaña Movimientos; al borrarlos, el saldo se corrige solo.</p>`);
}
function cardSheet(t){
  const isNew=!t;t=t||{nombre:"",saldo:null,minimo:null,dia:null,corte:null,cupo:null};
  openSheet(isNew?"Nueva tarjeta":"Editar tarjeta",`<form id="fc">
    <label>Nombre<input id="cNom" value="${esc(t.nombre)}" placeholder="Ej. Bancolombia Mastercard"></label>
    <div class="eyebrow">Deuda en pesos (COP)</div>
    <label>Deuda actual en pesos<input id="cSal" class="money num" inputmode="numeric" placeholder="$ 0" value="${t.saldo!=null?fmt(t.saldo):""}"></label>
    <label>Pago mínimo en pesos<input id="cMin" class="num" inputmode="numeric" placeholder="$ 0" value="${t.minimo!=null?fmt(t.minimo):""}"></label>
    <label class="check"><input type="checkbox" id="cNoMin" ${t.minimo==null?"checked":""}> Pago mínimo en pesos aún no disponible</label>
    <label class="check" style="margin-top:6px"><input type="checkbox" id="cUsd" ${t.usd?"checked":""}> Esta tarjeta también tiene deuda en dólares</label>
    <div id="usdBox" class="stack">
      <div class="eyebrow">Deuda en dólares (USD)</div>
      <label>Deuda actual en dólares<input id="cSalU" class="money num" inputmode="decimal" placeholder="US$ 0,00" value="${t.saldoUsd!=null?fmtU(t.saldoUsd):""}"></label>
      <label>Pago mínimo en dólares<input id="cMinU" class="num" inputmode="decimal" placeholder="US$ 0,00" value="${t.minimoUsd!=null?fmtU(t.minimoUsd):""}"></label>
      <label class="check"><input type="checkbox" id="cNoMinU" ${t.minimoUsd==null?"checked":""}> Pago mínimo en dólares aún no disponible</label>
      <p class="hint" style="margin:0">Usa coma para los centavos, por ejemplo 125,50.</p>
    </div>
    <div class="two"><label>Día límite de pago<input id="cDia" type="number" min="1" max="31" inputmode="numeric" placeholder="Ej. 15" value="${t.dia??""}"></label>
    <label>Día de corte<input id="cCorte" type="number" min="1" max="31" inputmode="numeric" placeholder="Opcional" value="${t.corte??""}"></label></div>
    <p class="hint" style="margin:0">Los dos días están en tu extracto o en la app del banco. El de corte es opcional.</p>
    <label>Cupo total (opcional)<input id="cCupo" class="num" inputmode="numeric" placeholder="$ 0" value="${t.cupo?fmt(t.cupo):""}"></label>
    <label>Interés mensual % (opcional)<input id="cInt" inputmode="decimal" placeholder="Ej. 1,9" value="${t.interes!=null?String(t.interes).replace(".",","):""}"><span class="hint">Está en tu extracto como tasa mes vencido (MV). Si lo dejas vacío, Luca usa 2% para estimar cuándo terminas de pagar.</span></label>
    <button class="primary" type="submit">Guardar</button>
    ${isNew?"":'<button type="button" class="danger" id="cDel">Eliminar esta tarjeta</button>'}
  </form>`,()=>{
    ["#cSal","#cMin","#cCupo"].forEach(s=>liveMoney($(s)));
    const sync=()=>{$("#cMin").disabled=$("#cNoMin").checked;if($("#cNoMin").checked)$("#cMin").value=""};sync();
    $("#cNoMin").onchange=sync;
    ["#cSalU","#cMinU"].forEach(s=>liveUsd($(s)));
    const syncU=()=>{$("#usdBox").hidden=!$("#cUsd").checked;$("#cMinU").disabled=$("#cNoMinU").checked;if($("#cNoMinU").checked)$("#cMinU").value=""};syncU();
    $("#cUsd").onchange=syncU;$("#cNoMinU").onchange=syncU;
    const day=s=>{const n=parseInt($(s).value,10);return n>=1&&n<=31?n:null};
    $("#fc").onsubmit=async e=>{e.preventDefault();const nombre=$("#cNom").value.trim();if(!nombre){toast("Ponle un nombre");return}
      const usd=$("#cUsd").checked;
      const data={...(isNew?{}:strip(t)),nombre,saldo:parse($("#cSal").value),minimo:$("#cNoMin").checked?null:(parse($("#cMin").value)??0),
        usd,saldoUsd:usd?parseU($("#cSalU").value):null,minimoUsd:usd&&!$("#cNoMinU").checked?(parseU($("#cMinU").value)??0):null,dia:day("#cDia"),corte:day("#cCorte"),cupo:parse($("#cCupo").value),orden:t.orden??S.tarjetas.length,
        interes:(()=>{const n=parseFloat(String($("#cInt").value).replace(",",".").replace(/[^\d.]/g,""));return n>0&&n<20?n:null})()};
      closeSheet();await put("tarjetas",t.id||uid(),data);toast("Tarjeta guardada")};
    if(!isNew)confirmBtn($("#cDel"),async()=>{closeSheet();await del("tarjetas",t.id);toast("Tarjeta eliminada")},"Toca otra vez para eliminar");
  });
}
function paySheet(t){
  let cur="cop";
  const body=()=>cur==="cop"?`
    <p class="muted" style="margin:0">Deuda en pesos: <b class="num">${t.saldo!=null?fmt(t.saldo):"sin registrar"}</b> · Mínimo: <b class="num">${t.minimo!=null?fmt(t.minimo):"aún no disponible"}</b></p>
    <label>¿Cuánto pagaste?<input id="pVal" class="money num" inputmode="numeric" placeholder="$ 0"></label>
    <div class="actions">${t.minimo?`<button type="button" data-fill="${fmt(t.minimo)}">El mínimo (${fmt(t.minimo)})</button>`:""}${t.saldo?`<button type="button" data-fill="${fmt(t.saldo)}">Todo (${fmt(t.saldo)})</button>`:""}</div>`:`
    <p class="muted" style="margin:0">Deuda en dólares: <b class="num">${t.saldoUsd!=null?fmtU(t.saldoUsd):"sin registrar"}</b> · Mínimo: <b class="num">${t.minimoUsd!=null?fmtU(t.minimoUsd):"aún no disponible"}</b></p>
    <label>¿Cuántos dólares abonaste?<input id="pVal" class="money num" inputmode="decimal" placeholder="US$ 0,00"></label>
    <div class="actions">${t.minimoUsd?`<button type="button" data-fill="${fmtU(t.minimoUsd)}">El mínimo (${fmtU(t.minimoUsd)})</button>`:""}${t.saldoUsd?`<button type="button" data-fill="${fmtU(t.saldoUsd)}">Todo (${fmtU(t.saldoUsd)})</button>`:""}</div>
    <label>¿Cuántos pesos te costó?<input id="pCop" class="num" inputmode="numeric" placeholder="Se calcula con el dólar del día"><span class="hint">Si lo dejas vacío se calcula con el dólar a ${fmt(trm())}.</span></label>`;
  openSheet("Pago a "+t.nombre,`<form id="fp">
    ${t.usd?`<div class="cats seg" id="pCur"><button type="button" aria-pressed="true" data-cur="cop">Deuda en pesos</button><button type="button" aria-pressed="false" data-cur="usd">Deuda en dólares</button></div>`:""}
    <div id="pBody" class="stack">${body()}</div>
    ${S.cuentas.length?`<label>¿Desde qué cuenta pagaste?<select id="pCuenta">${S.cuentas.map((c,i)=>`<option value="${esc(c.id)}" ${i===0?"selected":""}>${esc(c.nombre)} (${fmt(c.saldo)})</option>`).join("")}<option value="">No descontar de una cuenta</option></select></label>`:""}
    <label>Fecha<input id="pFecha" type="date" value="${today()}"></label>
    <button class="primary" type="submit">Guardar pago</button></form>`,()=>{
    const wire=()=>{cur==="cop"?liveMoney($("#pVal")):liveUsd($("#pVal"));liveMoney($("#pCop"))};wire();
    $("#pBody").addEventListener("click",e=>{const b=e.target.closest("[data-fill]");if(b)$("#pVal").value=b.dataset.fill});
    $("#pCur")&&($("#pCur").onclick=e=>{const b=e.target.closest("button");if(!b)return;cur=b.dataset.cur;$("#pCur").querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",x===b));$("#pBody").innerHTML=body();wire()});
    $("#fp").onsubmit=async e=>{e.preventDefault();const fecha=$("#pFecha").value||today();
      if(cur==="cop"){const v=parse($("#pVal").value);if(!v){toast("Escribe cuánto pagaste");return}
        const upd={...strip(t),saldo:t.saldo!=null?Math.max(0,t.saldo-v):null,minimo:t.minimo!=null?Math.max(0,t.minimo-v):null};
        const pid=uid(),ca=pAcct();closeSheet();await put("tarjetas",t.id,upd);await put("pagos",pid,{tarjeta:t.nombre,tarjetaId:t.id,valor:v,fecha,cuentaId:ca?ca.id:null});
        if(ca)await moveAcct(ca.id,-v,{tipo:"pago",nota:"Pago "+t.nombre,fecha,ref:pid});toast(ca?"Pago registrado y descontado de "+ca.nombre:"Pago registrado");
        if(t.saldo>0&&upd.saldo===0&&!(t.usd&&upd.saldoUsd>0)&&typeof celebrarDeuda==="function")celebrarDeuda(t)}
      else{const u=parseU($("#pVal").value);if(!u){toast("Escribe cuántos dólares abonaste");return}
        const cop=parse($("#pCop").value)||Math.round(u*trm());
        const r2=n=>Math.round(n*100)/100;
        const upd={...strip(t),saldoUsd:t.saldoUsd!=null?Math.max(0,r2(t.saldoUsd-u)):null,minimoUsd:t.minimoUsd!=null?Math.max(0,r2(t.minimoUsd-u)):null};
        const pid=uid(),ca=pAcct();closeSheet();await put("tarjetas",t.id,upd);await put("pagos",pid,{tarjeta:t.nombre,tarjetaId:t.id,valor:cop,valorUsd:u,fecha,cuentaId:ca?ca.id:null});
        if(ca)await moveAcct(ca.id,-cop,{tipo:"pago",nota:"Pago "+t.nombre+" ("+fmtU(u)+")",fecha,ref:pid});toast(ca?"Pago en dólares descontado de "+ca.nombre:"Pago en dólares registrado");
        if(t.saldoUsd>0&&upd.saldoUsd===0&&!(upd.saldo>0)&&typeof celebrarDeuda==="function")celebrarDeuda(t)}};
  });
}
function ingresoSheet(){
  openSheet("Me pagaron",`<form id="fi">
    <label>¿Cuánto llegó?<input id="iVal" class="money num" inputmode="numeric" placeholder="$ 0" value="${S.ajustes.montoPago?fmt(S.ajustes.montoPago):""}"></label>
    <div class="two"><label>Fecha<input id="iFecha" type="date" value="${today()}"></label>
    <label>Concepto<input id="iNota" value="${L("Quincena","Paycheck")}"></label></div>
    ${S.cuentas.length?`<label>¿A qué cuenta llegó?<select id="iCuenta">${S.cuentas.map((c,i)=>`<option value="${esc(c.id)}" ${i===0?"selected":""}>${esc(c.nombre)}</option>`).join("")}<option value="">No sumar a una cuenta</option></select></label>`:""}
    <p class="hint" style="margin:0">Si este pago llegó distinto a lo normal (horas extra, descuentos), pon el valor real. Así el cálculo del mes queda exacto.</p>
    <button class="primary" type="submit">Guardar ingreso</button></form>`,()=>{
    liveMoney($("#iVal"));
    $("#fi").onsubmit=async e=>{e.preventDefault();const v=parse($("#iVal").value);if(!v){toast("Escribe cuánto te llegó");return}
      const c=S.cuentas.find(x=>x.id===($("#iCuenta")?.value||""));const id=uid();const fecha=$("#iFecha").value||today(),nota=$("#iNota").value.trim()||"Quincena";
      closeSheet();await put("ingresos",id,{valor:v,fecha,nota,cuentaId:c?c.id:null,cuenta:c?c.nombre:null});
      if(c)await moveAcct(c.id,v,{tipo:"ingreso",nota,fecha,ref:id});
      toast(c?"Ingreso sumado a "+c.nombre:"Ingreso guardado")};
  });
}
function metaSheet(m){
  const isNew=!m;m=m||{nombre:"",objetivo:null,ahorrado:0};
  openSheet(isNew?"Nueva meta":"Editar meta",`<form id="fm">
    <label>¿Para qué ahorras?<input id="mNom" value="${esc(m.nombre)}" placeholder="Ej. Curso de piloto"></label>
    <div class="two"><label>Cuánto necesitas<input id="mObj" class="num" inputmode="numeric" placeholder="$ 0" value="${m.objetivo?fmt(m.objetivo):""}"></label>
    <label>Ya tienes<input id="mAh" class="num" inputmode="numeric" placeholder="$ 0" value="${m.ahorrado?fmt(m.ahorrado):""}"></label></div>
    <button class="primary" type="submit">Guardar</button>
    ${isNew?"":'<button type="button" class="danger" id="mDel">Borrar meta</button>'}</form>`,()=>{
    ["#mObj","#mAh"].forEach(s=>liveMoney($(s)));
    $("#fm").onsubmit=async e=>{e.preventDefault();const n=$("#mNom").value.trim(),o=parse($("#mObj").value);if(!n||!o){toast("Pon el nombre y cuánto necesitas");return}
      closeSheet();await put("metas",m.id||uid(),{nombre:n,objetivo:o,ahorrado:parse($("#mAh").value)||0});toast("Meta guardada")};
    if(!isNew)confirmBtn($("#mDel"),async()=>{closeSheet();await del("metas",m.id);toast("Meta borrada")},"Toca otra vez para borrar");
  });
}
/* ---------- Eventos ---------- */
const TITLES={resumen:"Resumen",agenda:"Agenda",tarjetas:"Cuentas y tarjetas",movs:"Movimientos",mas:"Más"};
function go(tab){
  tabActual=tab;if(sucias.has(tab)){sucias.delete(tab);VISTAS[tab]()}
  Object.keys(TITLES).forEach(v=>$("#v-"+v).hidden=v!==tab);
  document.querySelectorAll("nav.tabs button").forEach(b=>b.dataset.tab===tab?b.setAttribute("aria-current","page"):b.removeAttribute("aria-current"));
  $("#pageTitle").textContent=TITLES[tab];window.scrollTo(0,0);
  const v=$("#v-"+tab);v.classList.remove("enter");void v.offsetWidth;v.classList.add("enter");
}
document.querySelectorAll("nav.tabs button").forEach(b=>b.onclick=()=>{vibrar(6);go(b.dataset.tab)});
document.addEventListener("click",e=>{
  const q=s=>e.target.closest(s);let el;
  const xb=q("button.x[data-deli],button.x[data-delp],button.x[data-delmov],button.x[data-delf],button.x[data-delcat]");
  if(xb&&!xb.classList.contains("armed")){xb.classList.add("armed");xb.dataset.lbl=xb.textContent;xb.textContent="¿Borrar?";
    setTimeout(()=>{if(xb.isConnected&&xb.classList.contains("armed")){xb.classList.remove("armed");xb.textContent=xb.dataset.lbl}},3000);return}
  if(el=q("[data-go]"))go(el.dataset.go);
  else if(el=q("[data-edit]"))cardSheet(S.tarjetas.find(t=>t.id===el.dataset.edit));
  else if(el=q("[data-pay]"))paySheet(S.tarjetas.find(t=>t.id===el.dataset.pay));
  else if(el=q("[data-editg]"))gastoSheet(S.gastos.find(g=>g.id===el.dataset.editg));
  else if(el=q("[data-deli]")){const id=el.dataset.deli;(async()=>{await undoRef(id);await del("ingresos",id);toast("Ingreso borrado")})()}
  else if(el=q("[data-delp]")){const id=el.dataset.delp;(async()=>{await undoRef(id);await del("pagos",id);toast("Pago borrado del historial (la deuda de la tarjeta no cambia)")})()}
  else if(el=q("[data-delmov]")){const m=S.movcuentas.find(x=>x.id===el.dataset.delmov);if(m){const inSheet=!$("#sheetBack").hidden;(async()=>{await undoMov(m);toast("Movimiento borrado y saldo corregido");if(inSheet){const c=S.cuentas.find(x=>x.id===m.cuentaId);c?histSheet(c):closeSheet()}})()}}
  else if(el=q("[data-mov]"))movSheet(S.cuentas.find(c=>c.id===el.dataset.mov));
  else if(el=q("[data-hist]"))histSheet(S.cuentas.find(c=>c.id===el.dataset.hist));
  else if(el=q("[data-edita]"))acctSheet(S.cuentas.find(c=>c.id===el.dataset.edita));
  else if(el=q("[data-delf]")){S.ajustes.fijos.splice(+el.dataset.delf,1);saveAjustes()}
  else if(el=q("[data-fijopag]")){const f=S.ajustes.fijos[+el.dataset.fijopag];if(f){f.pagado=f.pagado===el.dataset.mk?null:el.dataset.mk;saveAjustes()}}
  else if(el=q("[data-delcat]")){const c=el.dataset.delcat;S.ajustes.categorias=cats().filter(x=>x!==c);if(S.ajustes.presupuestos)delete S.ajustes.presupuestos[c];saveAjustes();toast("Categoría quitada")}
  else if(el=q("[data-abono]"))abonoSheet(S.metas.find(m=>m.id===el.dataset.abono));
  else if(el=q("[data-editm]"))metaSheet(S.metas.find(m=>m.id===el.dataset.editm));
});
$("#presuList").addEventListener("input",e=>{if(e.target.dataset.presu!=null){const n=parse(e.target.value);e.target.value=n==null?"":fmt(n)}});
$("#presuList").addEventListener("change",e=>{const c=e.target.dataset.presu;if(c==null)return;S.ajustes.presupuestos={...(S.ajustes.presupuestos||{}),[c]:parse(e.target.value)};e.target.blur();saveAjustes();toast("Presupuesto guardado")});
$("#fab").onclick=()=>gastoSheet(null);
$("#fab2").onclick=()=>gastoSheet(null);
$("#heroIng").onclick=ingresoSheet;$("#addIng").onclick=ingresoSheet;
$("#addCard").onclick=()=>limitOk("tarjetas")&&cardSheet(null);
$("#addAcct").onclick=()=>limitOk("cuentas")&&acctSheet(null);
$("#addMeta").onclick=()=>limitOk("metas")&&metaSheet(null);
$("#mesSel").onchange=e=>{mes=e.target.value;render()};
["#ingValor","#ingOtros","#fijoVal"].forEach(s=>liveMoney($(s)));
$("#fTrm").onsubmit=async e=>{e.preventDefault();
  const b=parseU($("#bancoVal").value),t=parseU($("#trmVal").value),a=S.ajustes;
  if(b!==a.tasaBanco){a.tasaBanco=b||null;a.tasaBancoFecha=b?today():null}
  if(t&&t!==a.trm){a.trm=t;a.trmFecha=today()}
  document.activeElement.blur();await saveAjustes();toast("Tasas guardadas")};
$("#fIngreso").onsubmit=async e=>{e.preventDefault();
  const dias=[...new Set($("#ingDias").value.split(/[^\d]+/).map(n=>parseInt(n,10)).filter(n=>n>=1&&n<=31))].sort((a,b)=>a-b);
  S.ajustes.montoPago=parse($("#ingValor").value);S.ajustes.otros=parse($("#ingOtros").value);S.ajustes.diasPago=dias;
  document.activeElement.blur();await saveAjustes();toast("Sueldo guardado")};
$("#fFijo").onsubmit=async e=>{e.preventDefault();const n=$("#fijoNom").value.trim(),v=parse($("#fijoVal").value),d=parseInt($("#fijoDia").value,10);if(!n||!v){toast("Pon nombre y valor");return}
  S.ajustes.fijos=[...(S.ajustes.fijos||[]),{nombre:n,valor:v,dia:d>=1&&d<=31?d:null,pagado:null}];$("#fijoNom").value="";$("#fijoVal").value="";$("#fijoDia").value="";await saveAjustes();toast("Gasto fijo agregado")};
$("#fCat").onsubmit=async e=>{e.preventDefault();const n=$("#catNom").value.trim();if(!n)return;if(cats().some(c=>c.toLowerCase()===n.toLowerCase())){toast("Esa categoría ya existe");return}
  S.ajustes.categorias=[...cats(),n];$("#catNom").value="";await saveAjustes();toast("Categoría agregada")};
document.querySelectorAll("#app input").forEach(i=>i.setAttribute("autocomplete","off"));
$("#fileImport").addEventListener("change",e=>{const f=e.target.files&&e.target.files[0];if(f)leerRespaldo(f);e.target.value=""});
/* ---------- Tu cuenta ---------- */
const APP_VERSION="3.1.0";
const REPO_URL="https://github.com/Andresr-7/luca";
const SOPORTE="luca.app.col@gmail.com";
function nombreUsuario(){
  const md=(user&&user.user_metadata)||{};
  const n=(S.ajustes&&S.ajustes.nombre)||md.nombre||md.full_name||md.name||"";
  return String(n).trim().split(/\s+/)[0]||"";
}
const PROV_TXT={google:"Google",apple:"Apple",email:"correo y contraseña"};
function renderCuenta(){
  const el=$("#cuentaPanel");if(!el||!user)return;
  const prov=(user.app_metadata&&user.app_metadata.provider)||"email";
  const nom=nombreUsuario();const ini=(nom||user.email||"?").charAt(0).toUpperCase();
  const fila=(id,txt,extra)=>`<button type="button" class="item row-btn${extra||""}" id="${id}"><span class="main">${txt}</span><span class="chev" aria-hidden="true">›</span></button>`;
  const html=`<div class="me"><span class="avatar" aria-hidden="true">${esc(ini)}</span><div style="min-width:0;flex:1">
      <div class="me-name">${esc(nom||"Tu cuenta")}</div><div class="hint" style="overflow-wrap:anywhere">${esc(user.email||"")}</div>
      <div class="hint">Entraste con ${esc(PROV_TXT[prov]||prov)}</div></div>
      <span class="chip ${isPro()?"in":""}">${perfil.rol==="desarrollador"?"Desarrollador":isPro()?"Pro":"Gratis"}</span></div>
    ${CONFIG.PAGOS&&CONFIG.PAGOS.activo&&!isPro()?'<button class="primary" id="cPro">Mejorar a Pro</button>':""}
    <div class="list">
      ${fila("cName","Cambiar mi nombre")}
      ${fila("cPass",prov==="email"?"Cambiar contraseña":"Crear una contraseña")}
      ${fila("cVinc","Google, Apple y correo vinculados")}
      ${fila("cCsv","Exportar movimientos a Excel")}
      ${fila("cExport","Descargar respaldo completo")}
      ${fila("cImport","Importar respaldo")}
      ${fila("cOut","Cerrar sesión")}
    </div>
    <button class="danger" id="cDel">Eliminar mi cuenta y mis datos</button>`;
  if(el.dataset.h===html)return;el.dataset.h=html;el.innerHTML=html;
  $("#cPro")&&($("#cPro").onclick=irAPagar);
  $("#cName").onclick=()=>nombreSheet();
  $("#cPass").onclick=()=>nuevaClaveSheet(prov==="email"?"Cambiar contraseña":"Crear una contraseña");
  $("#cVinc").onclick=vincSheet;
  $("#cCsv").onclick=exportarCSV;
  $("#cExport").onclick=exportar;
  $("#cImport").onclick=()=>$("#fileImport").click();
  $("#cOut").onclick=async()=>{await sb.auth.signOut();stop()};
  confirmBtn($("#cDel"),async()=>{
    const {error}=await sb.rpc("delete_my_account");
    if(error){toast("No se pudo eliminar la cuenta. Inténtalo de nuevo.");return}
    try{localStorage.removeItem(cacheKey())}catch(e){}
    await sb.auth.signOut();stop();toast("Tu cuenta y tus datos fueron eliminados");
  },"Toca otra vez: se borra todo y no se puede deshacer");
}
function nombreSheet(){
  openSheet("Tu nombre",`<form id="fNom" class="stack" novalidate>
    <label>¿Cómo quieres que te salude Luca?<input id="nNom" name="nombre" autocomplete="given-name" value="${esc(nombreUsuario())}" placeholder="Tu nombre"></label>
    <button class="primary" type="submit">Guardar</button></form>`,()=>{
    $("#fNom").onsubmit=async e=>{e.preventDefault();S.ajustes.nombre=$("#nNom").value.trim();closeSheet();await saveAjustes();renderCuenta();toast("Nombre guardado")};
  });
}

/* ---------- Exportar a Excel (CSV con ; para Excel en español) ---------- */
function exportarCSV(){
  const q=v=>{const s=String(v??"");return /[;"\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s};
  const rows=[["tipo","fecha","descripcion","categoria","medio_o_cuenta","valor_cop","valor_usd"]];
  S.gastos.forEach(g=>rows.push(["gasto",g.fecha,g.nota||g.categoria,g.categoria,g.medio||"",-(g.valor||0),g.valorUsd!=null?-g.valorUsd:""]));
  S.ingresos.forEach(i=>rows.push(["ingreso",i.fecha,i.nota||"Ingreso","",i.cuenta||"",i.valor||0,""]));
  S.pagos.forEach(p=>rows.push(["pago_tarjeta",p.fecha,"Pago "+(p.tarjeta||""),"",p.tarjeta||"",-(p.valor||0),p.valorUsd!=null?-p.valorUsd:""]));
  S.movcuentas.filter(m=>["entrada","salida","transferencia","ajuste"].includes(m.tipo)).forEach(m=>rows.push(["cuenta_"+m.tipo,m.fecha,m.nota||"",""
    ,m.cuenta||"",m.valor||0,""]));
  const body=[rows[0],...rows.slice(1).sort((a,b)=>String(b[1]).localeCompare(String(a[1])))].map(r=>r.map(q).join(";")).join("\r\n");
  const blob=new Blob(["﻿"+body],{type:"text/csv;charset=utf-8"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="luca-movimientos-"+today()+".csv";
  document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},800);
  toast("Exportados "+(rows.length-1)+" movimientos");
}

/* ---------- Apariencia (por dispositivo) ---------- */
function temaGuardado(){try{return localStorage.getItem("luca-tema")||"auto"}catch(e){return "auto"}}
function aplicarTema(t){const H=document.documentElement;H.classList.add("tema-cambio");clearTimeout(aplicarTema.t);aplicarTema.t=setTimeout(()=>H.classList.remove("tema-cambio"),600);
  const r=document.documentElement;if(t==="light"||t==="dark")r.dataset.theme=t;else delete r.dataset.theme;
  try{localStorage.setItem("luca-tema",t)}catch(e){}
  const dark=t==="dark"||(t==="auto"&&matchMedia("(prefers-color-scheme: dark)").matches);
  document.querySelectorAll('meta[name="theme-color"]').forEach(m=>m.setAttribute("content",dark?"#000000":"#F2F2F7"));
  document.querySelectorAll("#temaSeg button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.tema===t));
}
aplicarTema(temaGuardado());
$("#temaSeg").addEventListener("click",e=>{const b=e.target.closest("button[data-tema]");if(b)aplicarTema(b.dataset.tema)});

/* ---------- Plan ---------- */
function renderPlan(){
  const el=$("#planPanel");if(!el)return;
  const pro=isPro();
  const html=`<div class="row-head"><div><div class="me-name">${pro?"Luca Pro":"Luca Gratis"}</div>
      <div class="hint">${pro?(perfil.rol==="desarrollador"?"Cuenta de desarrollador: todo incluido, sin límites.":perfil.plan_until?"Activo hasta el "+fechaCorta(String(perfil.plan_until).slice(0,10)):"Activo"):"Todo incluido mientras Luca está en lanzamiento."}</div></div>
      <span class="chip ${pro?"in":""}">${perfil.rol==="desarrollador"?"Desarrollador":pro?"Activo":"Tu plan"}</span></div>
    <ul class="checks"><li>Tarjetas en pesos y dólares, sin límite</li><li>Quincena, agenda y presupuestos</li><li>Cuentas de ahorro y metas</li><li>Sincronización entre celular y computador</li><li>Exportar a Excel y respaldos</li></ul>
    ${pro?"":`<p class="hint">Luca Pro llega pronto.</p>`}
    ${CONFIG.PAGOS&&CONFIG.PAGOS.activo&&!pro?'<button class="primary" id="plPro">Mejorar a Pro</button>':""}`;
  if(el.dataset.h===html)return;el.dataset.h=html;el.innerHTML=html;
  $("#plPro")&&($("#plPro").onclick=irAPagar);
}

/* ---------- Ayuda y acerca de ---------- */
function esAndroidWeb(){return /Android/i.test(navigator.userAgent)&&!matchMedia("(display-mode: standalone)").matches&&!document.referrer.startsWith("android-app://")}
if(esAndroidWeb())$("#androidDl").hidden=false;
(()=>{const el=$("#ayudaPanel");if(!el)return;
  const link=(href,txt,ext)=>`<a class="item row-btn" href="${href}"${ext?' target="_blank" rel="noopener"':""}><span class="main">${txt}</span><span class="chev" aria-hidden="true">›</span></a>`;
  el.innerHTML=`<div class="list">
    ${link(REPO_URL+"/issues/new","Reportar un problema o sugerir algo",true)}
    ${link("mailto:"+SOPORTE+"?subject="+encodeURIComponent("Luca "+APP_VERSION),"Escribir a soporte")}
    <div class="item"><span class="main">Correo de soporte</span><span class="amt muted" style="user-select:all">${SOPORTE}</span></div>
    ${esAndroidWeb()?link("descargas/Luca.apk","Descargar la app para Android"):""}
    ${link("privacidad.html","Política de privacidad")}
    ${link("terminos.html","Términos de uso")}
    <div class="item"><span class="main">Versión</span><span class="amt muted">${APP_VERSION}</span></div></div>
    <p class="hint">Luca no se conecta a tu banco ni pide claves bancarias. Tú escribes tus datos y solo tú los ves.</p>`;
})();

/* ---------- Bienvenida para cuentas nuevas ---------- */
function maybeOnboard(){
  const a=S.ajustes;if(a.onboarded)return;
  const tieneDatos=S.tarjetas.length||S.gastos.length||S.cuentas.length||a.montoPago;
  if(tieneDatos){a.onboarded=true;saveAjustes();return}
  let paso=1;const datos={nombre:nombreUsuario(),monto:null,dias:(a.diasPago||[15,30]).join(", ")};
  const pintar=()=>{
    const dots=`<div class="steps" aria-label="Paso ${paso} de 3">${[1,2,3].map(i=>`<i class="${i<=paso?"on":""}"></i>`).join("")}</div>`;
    if(paso===1){
      $("#sheetTitle").textContent="Bienvenido a Luca";
      $("#sheetBody").innerHTML=`${dots}<form id="ob" class="stack" novalidate><p>Luca te ayuda a saber cuánto debes, cuándo pagar y en qué se va tu plata. Configurarlo toma un minuto.</p>
        <label>¿Cómo te llamas?<input id="obNom" autocomplete="given-name" value="${esc(datos.nombre)}" placeholder="Tu nombre"></label>
        <button class="primary" type="submit">Siguiente</button></form>`;
      $("#ob").onsubmit=e=>{e.preventDefault();datos.nombre=$("#obNom").value.trim();paso=2;pintar()};
    }else if(paso===2){
      $("#sheetTitle").textContent="Tu sueldo";
      $("#sheetBody").innerHTML=`${dots}<form id="ob" class="stack" novalidate><p>Con esto Luca calcula cuánto te queda cada mes y cuándo te llega la plata.</p>
        <label>¿Cuánto te llega cada pago?<input id="obMonto" class="money num" inputmode="numeric" placeholder="$ 0" value="${datos.monto?fmt(datos.monto):""}"></label>
        <label>¿Qué días del mes te pagan?<input id="obDias" inputmode="numeric" placeholder="Ej. 15, 30…" value="${esc(datos.dias)}"><span class="hint">Sepáralos con coma. Si te pagan una vez al mes, pon un solo día.</span></label>
        <button class="primary" type="submit">Siguiente</button><button type="button" class="ghost" id="obSkip">Lo hago después</button></form>`;
      liveMoney($("#obMonto"));
      const next=async guardar=>{if(guardar){datos.monto=parse($("#obMonto").value);datos.dias=$("#obDias").value}
        const dias=[...new Set(String(datos.dias).split(/[^\d]+/).map(n=>parseInt(n,10)).filter(n=>n>=1&&n<=31))].sort((x,y)=>x-y);
        S.ajustes.nombre=datos.nombre||S.ajustes.nombre||"";if(guardar&&datos.monto)S.ajustes.montoPago=datos.monto;if(guardar&&dias.length)S.ajustes.diasPago=dias;
        S.ajustes.onboarded=true;await saveAjustes();paso=3;pintar()};
      $("#ob").onsubmit=e=>{e.preventDefault();next(true)};$("#obSkip").onclick=()=>next(false);
    }else{
      $("#sheetTitle").textContent=datos.nombre?"Listo, "+datos.nombre:"Listo";
      $("#sheetBody").innerHTML=`${dots}<div class="stack"><p>Ahora agrega lo primero que quieras controlar. Puedes cambiar todo después en la pestaña Más.</p>
        <button class="primary" id="obCard">Agregar mi primera tarjeta</button>
        <button id="obAcct">Agregar una cuenta de ahorro</button>
        <button class="ghost" id="obFin">Explorar la app</button></div>`;
      $("#obCard").onclick=()=>{closeSheet();cardSheet(null)};
      $("#obAcct").onclick=()=>{closeSheet();acctSheet(null)};
      $("#obFin").onclick=()=>{closeSheet();toast("Toca + Gasto cuando gastes algo")};
    }
    const f=$("#sheetBody input");f&&setTimeout(()=>f.focus(),60);
  };
  $("#sheetBack").hidden=false;pintar();
}


/* Modo rápido manual */
(()=>{const b=$("#swLite");if(!b)return;const h=document.documentElement;const pinta=()=>b.setAttribute("aria-checked",h.classList.contains("lite"));pinta();
  b.onclick=()=>{const on=!h.classList.contains("lite");h.classList.toggle("lite",on);try{localStorage.setItem("luca-lite",on?"1":"0")}catch(e){}pinta();vibrar(8)};
  addEventListener("load",()=>setTimeout(pinta,3500))})();

/* Cuentas vinculadas: Google, Apple (iCloud) y correo en la misma cuenta de Luca */
const PROV_ICO={google:typeof GSVG!=="undefined"?GSVG:"",apple:typeof ASVG!=="undefined"?ASVG:"",email:'<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m3 7 9 6 9-6"/></svg>'};
async function vincSheet(){
  const P=(window.CONFIG&&CONFIG.PROVEEDORES)||{};
  let ids=(user&&user.identities)||[];
  try{if(sb.auth.getUserIdentities){const r=await sb.auth.getUserIdentities();if(r&&r.data&&r.data.identities)ids=r.data.identities}}catch(e){}
  const tiene=p=>ids.find(i=>i.provider===p);
  const fila=(p,nom)=>{const i=tiene(p),activo=p==="email"||P[p];const mail=i&&i.identity_data&&i.identity_data.email;
    const acc=i?(ids.length>1&&p!=="email"?`<button type="button" class="ghost" data-desv="${p}">Desvincular</button>`:'<span class="chip in">Vinculada</span>')
      :activo?`<button type="button" class="primary sm" data-vinc="${p}">Vincular</button>`:'<span class="chip">Pronto</span>';
    return `<div class="ios-row vinc"><span class="vinc-ico">${PROV_ICO[p]}</span><span class="vinc-txt"><b>${nom}</b><small class="hint">${i?esc(mail||"Conectada"):p==="email"?"Crea una contraseña para entrar también con tu correo":"No vinculada"}</small></span>${acc}</div>`};
  openSheet("Cuentas vinculadas",`<div class="stack"><p class="hint">Entra a Luca con cualquiera de estas opciones y verás siempre los mismos datos.</p>
    <div class="ios-list solo">${fila("google","Google")}${fila("apple","Apple (iCloud)")}${fila("email","Correo y contraseña")}</div>
    <p class="hint">Si entras con Google o Apple usando el mismo correo de tu cuenta, Luca las une automáticamente.</p></div>`,()=>{
    document.querySelectorAll("[data-vinc]").forEach(b=>b.onclick=async()=>{const p=b.dataset.vinc;
      if(p==="email"){closeSheet();nuevaClaveSheet("Crear una contraseña");return}
      if(!sb.auth.linkIdentity){toast("Actualiza la app para vincular cuentas.");return}
      const done=busy(b,"Abriendo…");const {error}=await sb.auth.linkIdentity({provider:p,options:{redirectTo:redirectURL()}});
      if(error){done();toast(/manual linking/i.test(error.message||"")?"La vinculación aún no está activada. Inténtalo más tarde.":"No se pudo vincular. Inténtalo de nuevo.")}});
    document.querySelectorAll("[data-desv]").forEach(b=>b.onclick=async()=>{const i=tiene(b.dataset.desv);if(!i||!sb.auth.unlinkIdentity)return;
      const done=busy(b,"Quitando…");const {error}=await sb.auth.unlinkIdentity(i);done();
      if(error){toast("No se pudo desvincular.");return}toast("Cuenta desvinculada");const u=await sb.auth.getUser();if(u&&u.data&&u.data.user)user=u.data.user;vincSheet()});
  });
}

$("#navAdd")&&($("#navAdd").onclick=()=>$("#fab").click());
