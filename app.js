"use strict";
/* Luca — app de finanzas personales. Datos en Supabase (una fila por registro, protegidas por usuario). */
const DEF_CATS=["Comida","Transporte","Salidas","Ropa","Hogar","Suscripciones","Juegos","Salud","Otros"];
const MESES=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DIAS=["dom","lun","mar","mié","jue","vie","sáb"];
const $=s=>document.querySelector(s);
const fmt=n=>"$ "+Math.round(n||0).toLocaleString("es-CO");
const parse=v=>{const d=String(v??"").replace(/[^\d]/g,"");return d?parseInt(d,10):null};
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const iso=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const today=()=>iso(new Date());
const monthKey=d=>String(d||"").slice(0,7);
const midnight=()=>{const d=new Date();d.setHours(0,0,0,0);return d};
const fechaCorta=f=>{if(!f)return"";const[y,m,d]=f.split("-");return +d+" "+MESES[+m-1].slice(0,3).toLowerCase()};
const dLabel=d=>DIAS[d.getDay()]+" "+d.getDate()+" "+MESES[d.getMonth()].slice(0,3).toLowerCase();
const fmtU=n=>"US$ "+(Number(n)||0).toLocaleString("es-CO",{minimumFractionDigits:2,maximumFractionDigits:2});
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
function cacheSave(){try{localStorage.setItem(cacheKey(),JSON.stringify(S))}catch(e){}}
function cacheLoad(){try{const r=JSON.parse(localStorage.getItem(cacheKey())||"null");if(r)Object.assign(S,r)}catch(e){}}
function emptyState(){COLS.forEach(c=>S[c]=[]);S.ajustes=defaultAjustes()}
function errMsg(){return "No se pudo guardar. Revisa tu conexión e inténtalo de nuevo."}
function setSync(t){const c=$("#syncChip");if(c)c.textContent=t}
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
      if(p.eventType==="DELETE"){const o=p.old||{};if(o.collection&&S[o.collection]){S[o.collection]=S[o.collection].filter(x=>x.id!==o.id);cacheSave();render()}return}
      const r=p.new;if(!r||!r.collection)return;
      if(r.collection==="ajustes"){if(r.id==="principal")S.ajustes={...defaultAjustes(),...r.data}}
      else if(S[r.collection]){const arr=S[r.collection];const i=arr.findIndex(x=>x.id===r.id);const row={...r.data,id:r.id};i>=0?arr[i]=row:arr.push(row)}
      cacheSave();render();
    })
    .subscribe(st=>{if(st==="SUBSCRIBED")setSync("Sincronizado");else if(st==="CHANNEL_ERROR"||st==="TIMED_OUT")setSync("Sin conexión")});
}
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&user)loadAll().then(()=>setSync("Sincronizado")).catch(()=>setSync("Sin conexión"))});

/* ---------- Plan y pagos (listo para cobrar en el futuro) ---------- */
async function loadPerfil(){const {data}=await sb.from("profiles").select("plan,plan_until").eq("id",user.id).maybeSingle();if(data)perfil=data}
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
  const fr=new FileReader();
  fr.onload=()=>{
    let d;try{d=JSON.parse(fr.result)}catch(e){toast("Ese archivo no es un respaldo válido de Luca.");return}
    if(!d||typeof d!=="object"||!d.colecciones){toast("Ese archivo no es un respaldo válido de Luca.");return}
    const rows=[];
    COLS.forEach(c=>(Array.isArray(d.colecciones[c])?d.colecciones[c]:[]).forEach(x=>{if(x&&x.id){const{id,...rest}=x;rows.push(fila(c,String(id),rest))}}));
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

/* ---------- Tu cuenta ---------- */
function renderCuenta(){
  const el=$("#cuentaPanel");if(!el||!user)return;
  const prov=(user.app_metadata&&user.app_metadata.provider)||"email";
  const html=`<div class="row-head"><div style="min-width:0"><div style="font-weight:700;overflow-wrap:anywhere">${esc(user.email||"Cuenta sin correo")}</div>
      <div class="hint">Entraste con ${({google:"Google",apple:"Apple",email:"tu correo"})[prov]||esc(prov)}</div></div>
      <span class="chip ${isPro()?"in":""}">${isPro()?"Plan Pro":"Plan gratis"}</span></div>
    ${CONFIG.PAGOS&&CONFIG.PAGOS.activo&&!isPro()?'<button class="primary" id="cPro">Mejorar a Pro</button>':""}
    <div class="actions"><button id="cExport">Descargar respaldo</button><button id="cImport">Importar respaldo</button><button id="cOut">Cerrar sesión</button></div>
    <button class="danger" id="cDel">Eliminar mi cuenta y mis datos</button>`;
  if(el.dataset.h===html)return;el.dataset.h=html;el.innerHTML=html;
  $("#cPro")&&($("#cPro").onclick=irAPagar);
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

/* ---------- Entrar: Google, Apple o código por correo ---------- */
const GSVG='<svg aria-hidden="true" width="20" height="20" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
const ASVG='<svg aria-hidden="true" width="18" height="20" viewBox="0 0 17 20" fill="currentColor"><path d="M14.2 10.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.3-.9-1.7 0-3.3 1-4.2 2.5-1.8 3.1-.5 7.7 1.3 10.2.8 1.2 1.8 2.6 3.1 2.5 1.3-.1 1.7-.8 3.3-.8 1.5 0 1.9.8 3.3.8 1.4 0 2.2-1.2 3-2.5 1-1.4 1.4-2.8 1.4-2.9-.1 0-2.5-1-2.5-3.9zM11.6 3c.7-.8 1.2-2 1-3.1-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.6 2.9-1.4z"/></svg>';
const redirectURL=()=>location.origin+location.pathname;
function authMsg(t){const m=$("#authMsg");m.textContent=t||"";m.hidden=!t}
function renderAuth(modo){
  modo=modo==="crear"?"crear":"entrar";
  const P=(window.CONFIG&&CONFIG.PROVEEDORES)||{};
  authMsg("");
  const crear=modo==="crear";
  $("#authBody").innerHTML=`${P.google||P.apple?`<div class="oauth">
      ${P.apple?`<button type="button" class="oa" id="aApple">${ASVG}<span>Continuar con Apple</span></button>`:""}
      ${P.google?`<button type="button" class="oa" id="aGoogle">${GSVG}<span>Continuar con Google</span></button>`:""}
    </div><p class="or">o con tu correo</p>`:""}
    <div class="cats" role="tablist" aria-label="Entrar o crear cuenta">
      <button type="button" role="tab" aria-selected="${!crear}" aria-pressed="${!crear}" id="tEntrar">Ya tengo cuenta</button>
      <button type="button" role="tab" aria-selected="${crear}" aria-pressed="${crear}" id="tCrear">Crear cuenta</button>
    </div>
    <form id="fPass" novalidate>
      <label>Correo<input id="aMail" name="email" type="email" autocomplete="email" spellcheck="false" placeholder="tucorreo@ejemplo.com"></label>
      <label>Contraseña<input id="aPass" name="password" type="password" autocomplete="${crear?"new-password":"current-password"}" placeholder="${crear?"Mínimo 6 caracteres":"Tu contraseña"}"></label>
      <button class="primary" type="submit">${crear?"Crear mi cuenta":"Entrar"}</button>
    </form>`;
  const oauth=async prov=>{authMsg("");const {error}=await sb.auth.signInWithOAuth({provider:prov,options:{redirectTo:redirectURL()}});if(error)authMsg("No se pudo abrir el inicio de sesión. Inténtalo de nuevo.")};
  $("#aGoogle")&&($("#aGoogle").onclick=()=>oauth("google"));
  $("#aApple")&&($("#aApple").onclick=()=>oauth("apple"));
  $("#tEntrar").onclick=()=>renderAuth("entrar");
  $("#tCrear").onclick=()=>renderAuth("crear");
  $("#fPass").onsubmit=async e=>{e.preventDefault();
    const email=$("#aMail").value.trim().toLowerCase(),password=$("#aPass").value;
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){authMsg("Escribe un correo válido, por ejemplo nombre@gmail.com.");$("#aMail").focus();return}
    if(password.length<6){authMsg("La contraseña debe tener al menos 6 caracteres.");$("#aPass").focus();return}
    const b=e.submitter||$("#fPass button.primary"),txt=b.textContent;b.disabled=true;b.textContent=crear?"Creando cuenta…":"Entrando…";
    const {data,error}=crear?await sb.auth.signUp({email,password}):await sb.auth.signInWithPassword({email,password});
    b.disabled=false;b.textContent=txt;
    if(error){const m=error.message||"";
      authMsg(/already|registered|exists/i.test(m)?"Ese correo ya tiene cuenta. Toca “Ya tengo cuenta” y entra con tu contraseña."
        :/invalid login|credentials/i.test(m)?"El correo o la contraseña no coinciden. Revísalos o crea una cuenta nueva."
        :/rate|seconds|limit/i.test(m)?"Muchos intentos seguidos. Espera un minuto y vuelve a intentarlo."
        :/password/i.test(m)?"Esa contraseña no sirve: usa al menos 6 caracteres."
        :"No se pudo entrar. Revisa tu conexión e inténtalo de nuevo.");return}
    if(crear&&data&&!data.session)authMsg("Cuenta creada. Revisa tu correo para confirmarla y luego entra.");
  };
}
function pantalla(cual){$("#boot").hidden=cual!=="boot";$("#auth").hidden=cual!=="auth";$("#app").hidden=cual!=="app";$("#fab").hidden=cual!=="app"}
function showAuth(){pantalla("auth");renderAuth("entrar")}
async function start(u){
  if(user&&user.id===u.id)return;
  user=u;perfil={plan:"free",plan_until:null};emptyState();cacheLoad();
  pantalla("app");render();go("resumen");setSync("Conectando…");
  if(/[?&]code=|access_token|error_description/.test(location.search+location.hash))history.replaceState(null,"",location.pathname);
  try{await loadAll();setSync("Sincronizado")}catch(e){setSync("Sin conexión");toast("No se pudieron cargar tus datos. Revisa tu conexión.")}
  loadPerfil().then(render).catch(()=>{});
  subscribe();actualizarTRM();
}
function stop(){if(canal&&sb)sb.removeChannel(canal);canal=null;user=null;emptyState();closeSheet();showAuth()}
async function init(){
  const C=window.CONFIG||{};
  if(!window.supabase||!C.SUPABASE_URL||/TU-PROYECTO/.test(C.SUPABASE_URL)){
    pantalla("auth");$("#authBody").innerHTML='<div class="notice">Falta conectar la base de datos. Abre <b>config.js</b> y pega la URL y la clave pública de tu proyecto de Supabase (la guía está en README.md).</div>';return}
  sb=window.supabase.createClient(C.SUPABASE_URL,C.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:"implicit"}});
  sb.auth.onAuthStateChange((ev,session)=>{const u=session&&session.user;if(u)start(u);else if(user)stop()});
  const {data}=await sb.auth.getSession();
  if(data&&data.session&&data.session.user)start(data.session.user);else if(!user)showAuth();
}

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
  const d=new Date();$("#monthLabel").textContent=MESES[d.getMonth()]+" "+d.getFullYear();
  const T=totals(),a=S.ajustes;
  renderResumen(T,a);renderAgenda();renderTarjetas();renderMovs();renderMas(a);renderCuenta();
}
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
  const sorted=[...S.tarjetas].sort((a,b)=>(a.orden??99)-(b.orden??99)||String(a.nombre).localeCompare(b.nombre));
  $("#cardsList").innerHTML=sorted.length?sorted.map(t=>{const due=dueInfo(t.dia);const corte=t.corte?nextOn(t.corte):null;return `
    <article class="card ${due?due.cls:""}">
      <div class="card-top"><h3>${esc(t.nombre)}</h3>${due?`<span class="chip ${due.cls}">${due.label}</span>`:'<span class="chip">Sin fecha</span>'}</div>
      <div class="kv">
        <div><span class="k">Deuda${t.usd?" en pesos":""}</span><span class="val num">${t.saldo!=null?fmt(t.saldo):'<span class="na">Sin registrar</span>'}</span></div>
        <div><span class="k">Mínimo${t.usd?" en pesos":""}</span><span class="val num">${t.minimo!=null?fmt(t.minimo):'<span class="na">Aún no disponible</span>'}</span></div>
        ${t.usd?`<div><span class="k">Deuda en dólares</span><span class="val num">${t.saldoUsd!=null?fmtU(t.saldoUsd):'<span class="na">Sin registrar</span>'}</span></div>
        <div><span class="k">Mínimo en dólares</span><span class="val num">${t.minimoUsd!=null?fmtU(t.minimoUsd):'<span class="na">Aún no disponible</span>'}</span></div>`:""}
        <div><span class="k">Fecha límite de pago</span><span class="val">${due?due.txt:'<span class="na">Sin definir</span>'}</span></div>
        <div><span class="k">Fecha de corte</span><span class="val">${corte?dLabel(corte):'<span class="na">Sin definir</span>'}</span></div>
      </div>
      ${t.usd?`<div class="kv" style="background:var(--surface-2);border-radius:10px;padding:10px 12px">
        <div><span class="k">Deuda total en COP</span><span class="val num">${fmt(deudaCopCard(t))}</span></div>
        <div><span class="k">Mínimo total en COP</span><span class="val num">${minNA(t)?'<span class="na">Aún no disponible</span>':fmt(minTotal(t))}</span></div>
        <div style="grid-column:1/-1"><span class="hint">Dólares convertidos a ${fmt(trm())} (${rateName()})</span></div></div>`:""}
      ${t.cupo?(()=>{const u=deudaCopCard(t),p=u/t.cupo*100;return `<div class="stack" style="gap:6px"><div class="small muted">Cupo ${fmt(t.cupo)} · usado <b style="color:${p>=90?"var(--danger)":"var(--ink)"}">${Math.round(p)}%</b> (${fmt(u)}${t.usd&&t.saldoUsd?", incluye dólares":""}) · disponible ${fmt(Math.max(0,t.cupo-u))}</div><div class="meter"><i style="width:${Math.min(100,p)}%;${p>=90?"background:var(--danger)":""}"></i></div></div>`})():""}
      <div class="actions"><button class="primary" data-pay="${esc(t.id)}">Registrar pago</button><button data-edit="${esc(t.id)}">Editar</button></div>
    </article>`}).join(""):'<div class="empty">Aún no hay tarjetas. Agrega la primera con el botón de abajo.</div>';
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
function openSheet(title,html,onMount){$("#sheetTitle").textContent=title;$("#sheetBody").innerHTML=html;$("#sheetBody").querySelectorAll("input").forEach(i=>i.setAttribute("autocomplete","off"));$("#sheetBack").hidden=false;onMount&&onMount();const f=$("#sheetBody input:not([disabled])");f&&setTimeout(()=>f.focus(),50)}
function closeSheet(){$("#sheetBack").hidden=true;$("#sheetBody").innerHTML=""}
$("#sheetClose").onclick=closeSheet;
$("#sheetBack").addEventListener("click",e=>{if(e.target.id==="sheetBack")closeSheet()});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("#sheetBack").hidden)closeSheet()});
function toast(m){const t=$("#toast");t.textContent=m;t.hidden=false;clearTimeout(toast.h);toast.h=setTimeout(()=>t.hidden=true,2400)}
function confirmBtn(btn,fn,txt){let armed=false;btn.onclick=()=>{if(!armed){armed=true;btn.textContent=txt||"Toca otra vez para confirmar";return}fn()}}

function gastoSheet(g){
  const isNew=!g;g=g||{valor:null,categoria:cats()[0],nota:"",fecha:today(),medio:"Efectivo"};
  let cat=g.categoria, cur=g.valorUsd!=null?"usd":"cop";
  const opts=[{k:"efectivo",l:"Efectivo"},...S.cuentas.map(c=>({k:"c:"+c.id,l:c.nombre+" (cuenta)"})),...(S.cuentas.length?[]:[{k:"debito",l:"Débito / Nequi"}]),...S.tarjetas.map(t=>({k:"t:"+t.id,l:t.nombre}))];
  let sel=g.cuentaId?"c:"+g.cuentaId:g.tarjetaId?"t:"+g.tarjetaId:g.medio==="Débito / Nequi"?"debito":"efectivo";
  if(!opts.some(o=>o.k===sel))opts.push({k:sel,l:g.medio||"Otro"});
  if(isNew&&S.cuentas.length&&sel==="efectivo"){const last=S.gastos.slice().sort((a,b)=>(b.creado||0)-(a.creado||0))[0];if(last&&last.cuentaId&&S.cuentas.some(c=>c.id===last.cuentaId))sel="c:"+last.cuentaId}
  const cs=cats().includes(cat)?cats():[...cats(),cat];
  const key=()=>$("#gMedio").value;
  const card=()=>{const k=key();return k.startsWith("t:")?S.tarjetas.find(x=>x.id===k.slice(2)):null};
  const acct=()=>{const k=key();return k.startsWith("c:")?S.cuentas.find(x=>x.id===k.slice(2)):null};
  openSheet(isNew?"Nuevo gasto":"Editar gasto",`<form id="fg">
    <label>Pagado con<select id="gMedio">${opts.map(o=>`<option value="${esc(o.k)}" ${o.k===sel?"selected":""}>${esc(o.l)}</option>`).join("")}</select></label>
    <div class="cats" id="gCur" hidden><button type="button" data-cur="cop">En pesos (COP)</button><button type="button" data-cur="usd">En dólares (US$)</button></div>
    <label><span id="gValLbl">¿Cuánto?</span><input id="gVal" class="money num" autocomplete="off"><span class="hint" id="gConv" hidden></span></label>
    <div><div class="eyebrow" style="margin-bottom:6px">Categoría</div><div class="cats" id="gCats">${cs.map(c=>`<button type="button" aria-pressed="${c===cat}" data-c="${esc(c)}">${esc(c)}</button>`).join("")}</div></div>
    <label>Nota (opcional)<input id="gNota" placeholder="Ej. almuerzo, Uber, Netflix" value="${esc(g.nota)}"></label>
    <label>Fecha<input id="gFecha" type="date" value="${esc(g.fecha||today())}"></label>
    ${isNew?`<label class="check" id="gSumWrap" hidden><input type="checkbox" id="gSum" checked> <span id="gSumLbl">Sumar a la deuda de la tarjeta</span></label>`:""}
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
    <div class="cats" id="mvTipo"><button type="button" data-t="entrada" aria-pressed="false">Entró plata</button><button type="button" data-t="salida" aria-pressed="true">Salió plata</button>${otras.length?'<button type="button" data-t="transferencia" aria-pressed="false">Pasar a otra cuenta</button>':""}</div>
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
        usd,saldoUsd:usd?parseU($("#cSalU").value):null,minimoUsd:usd&&!$("#cNoMinU").checked?(parseU($("#cMinU").value)??0):null,dia:day("#cDia"),corte:day("#cCorte"),cupo:parse($("#cCupo").value),orden:t.orden??S.tarjetas.length};
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
    ${t.usd?`<div class="cats" id="pCur"><button type="button" aria-pressed="true" data-cur="cop">Deuda en pesos</button><button type="button" aria-pressed="false" data-cur="usd">Deuda en dólares</button></div>`:""}
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
        if(ca)await moveAcct(ca.id,-v,{tipo:"pago",nota:"Pago "+t.nombre,fecha,ref:pid});toast(ca?"Pago registrado y descontado de "+ca.nombre:"Pago registrado")}
      else{const u=parseU($("#pVal").value);if(!u){toast("Escribe cuántos dólares abonaste");return}
        const cop=parse($("#pCop").value)||Math.round(u*trm());
        const r2=n=>Math.round(n*100)/100;
        const upd={...strip(t),saldoUsd:t.saldoUsd!=null?Math.max(0,r2(t.saldoUsd-u)):null,minimoUsd:t.minimoUsd!=null?Math.max(0,r2(t.minimoUsd-u)):null};
        const pid=uid(),ca=pAcct();closeSheet();await put("tarjetas",t.id,upd);await put("pagos",pid,{tarjeta:t.nombre,tarjetaId:t.id,valor:cop,valorUsd:u,fecha,cuentaId:ca?ca.id:null});
        if(ca)await moveAcct(ca.id,-cop,{tipo:"pago",nota:"Pago "+t.nombre+" ("+fmtU(u)+")",fecha,ref:pid});toast(ca?"Pago en dólares descontado de "+ca.nombre:"Pago en dólares registrado")}};
  });
}
function ingresoSheet(){
  openSheet("Me pagaron",`<form id="fi">
    <label>¿Cuánto llegó?<input id="iVal" class="money num" inputmode="numeric" placeholder="$ 0" value="${S.ajustes.montoPago?fmt(S.ajustes.montoPago):""}"></label>
    <div class="two"><label>Fecha<input id="iFecha" type="date" value="${today()}"></label>
    <label>Concepto<input id="iNota" value="Quincena"></label></div>
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
function abonoSheet(m){
  openSheet("Abonar a "+m.nombre,`<form id="fab2">
    <label>¿Cuánto guardaste?<input id="abVal" class="money num" inputmode="numeric" placeholder="$ 0"></label>
    <button class="primary" type="submit">Abonar</button></form>`,()=>{
    liveMoney($("#abVal"));
    $("#fab2").onsubmit=async e=>{e.preventDefault();const v=parse($("#abVal").value);if(!v)return;closeSheet();await put("metas",m.id,{...strip(m),ahorrado:(m.ahorrado||0)+v});toast("Abono guardado")};
  });
}

/* ---------- Eventos ---------- */
const TITLES={resumen:"Resumen",agenda:"Agenda",tarjetas:"Cuentas y tarjetas",movs:"Movimientos",mas:"Más"};
function go(tab){
  Object.keys(TITLES).forEach(v=>$("#v-"+v).hidden=v!==tab);
  document.querySelectorAll("nav.tabs button").forEach(b=>b.dataset.tab===tab?b.setAttribute("aria-current","page"):b.removeAttribute("aria-current"));
  $("#pageTitle").textContent=TITLES[tab];window.scrollTo(0,0);
  const v=$("#v-"+tab);v.classList.remove("enter");void v.offsetWidth;v.classList.add("enter");
}
document.querySelectorAll("nav.tabs button").forEach(b=>b.onclick=()=>go(b.dataset.tab));
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
init();
