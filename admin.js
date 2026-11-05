/* Luca · Notificaciones push (suscripción) y panel de desarrollador */
"use strict";
const b64u=s=>{const p="=".repeat((4-s.length%4)%4),b=atob((s+p).replace(/-/g,"+").replace(/_/g,"/"));return Uint8Array.from(b,c=>c.charCodeAt(0))};
/* En la app de Android las notificaciones van por Firebase (FCM); en web, por Web Push */
const PushNativo=()=>window.Capacitor&&Capacitor.isNativePlatform&&Capacitor.isNativePlatform()&&Capacitor.Plugins&&Capacitor.Plugins.PushNotifications;
let pushNativoListo=false;
async function suscribirNativo(pedir){const P=PushNativo();
  let st=await P.checkPermissions();if(st.receive!=="granted"){if(!pedir)return "pendiente";st=await P.requestPermissions();if(st.receive!=="granted")return "denegado"}
  if(!pushNativoListo){pushNativoListo=true;
    P.addListener("registration",async t=>{if(user&&t&&t.value)await sb.from("push_subs").upsert({user_id:user.id,endpoint:"fcm:"+t.value,p256dh:"fcm",auth:"fcm"},{onConflict:"endpoint"})});
    P.addListener("pushNotificationReceived",n=>toast((n.title?n.title+": ":"")+(n.body||"")));
    P.addListener("pushNotificationActionPerformed",()=>{})}
  await P.register();return "ok"}
const permisoPush=async()=>{if(PushNativo()){try{return (await PushNativo().checkPermissions()).receive}catch(e){return "prompt"}}return "Notification" in window?Notification.permission:"denied"};
const pushSoportado=()=>!!PushNativo()||"serviceWorker" in navigator&&"PushManager" in window&&"Notification" in window&&!!(window.CONFIG&&CONFIG.VAPID_PUBLIC);

/* Guarda la suscripción de este celular en Supabase */
async function suscribirPush(pedir){
  if(!pushSoportado()||!user)return "no";
  if(PushNativo())return suscribirNativo(pedir);
  if(Notification.permission==="denied")return "denegado";
  if(Notification.permission!=="granted"){if(!pedir)return "pendiente";if(await Notification.requestPermission()!=="granted")return "denegado"}
  const reg=await navigator.serviceWorker.ready;
  let s=await reg.pushManager.getSubscription();
  if(!s)s=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64u(CONFIG.VAPID_PUBLIC)});
  const j=s.toJSON();
  await sb.from("push_subs").upsert({user_id:user.id,endpoint:j.endpoint,p256dh:j.keys.p256dh,auth:j.keys.auth},{onConflict:"endpoint"});
  return "ok";
}
/* Al entrar: si ya dio permiso, renueva en silencio; si no, lo pide una sola vez tras unos segundos de uso */
function pushAlEntrar(){
  if(!pushSoportado())return;
  if(PushNativo()){permisoPush().then(p=>{if(p==="granted")suscribirNativo(false).catch(()=>{});else{let ya=null;try{ya=localStorage.getItem("luca-push-pedido")}catch(e){}if(!ya)setTimeout(()=>{try{localStorage.setItem("luca-push-pedido","1")}catch(e){}suscribirNativo(true).catch(()=>{})},15000)}});return}
  if(Notification.permission==="granted"){suscribirPush(false).catch(()=>{});return}
  let ya=null;try{ya=localStorage.getItem("luca-push-pedido")}catch(e){}
  if(ya||Notification.permission==="denied")return;
  setTimeout(()=>{if(!user)return;try{localStorage.setItem("luca-push-pedido","1")}catch(e){}
    openSheet("Avisos de Luca",`<div class="stack"><p>¿Quieres que Luca te avise cuando vence una tarjeta y cuando haya novedades?</p>
      <button class="primary" id="pushSi">Activar notificaciones</button><button type="button" class="ghost" id="pushNo">Ahora no</button></div>`,()=>{
      $("#pushSi").onclick=async()=>{const r=await suscribirPush(true).catch(()=>"error");closeSheet();toast(r==="ok"?"Notificaciones activadas":"Puedes activarlas luego en Más")};
      $("#pushNo").onclick=closeSheet})},20000);
}

/* ---------- Panel de desarrollador ---------- */
const esDev=()=>typeof perfil!=="undefined"&&perfil&&perfil.rol==="desarrollador";
async function panelDev(){
  if(!esDev())return;
  openSheet("Panel de desarrollador",'<p class="hint">Cargando…</p>');
  const [r,u,ac,vs]=await Promise.all([sb.rpc("admin_resumen"),sb.rpc("admin_usuarios"),sb.rpc("admin_actividad"),sb.rpc("admin_versiones")]);const A=(ac&&ac.data)||null;const V=(vs&&!vs.error&&vs.data)||null;
  if(r.error||u.error){$("#sheetBody").innerHTML='<p class="hint">No se pudo cargar el panel.</p><p class="hint" style="font-family:ui-monospace,monospace;font-size:12px">'+esc(((r.error||u.error).message||"")+" "+((r.error||u.error).code||""))+'</p><button class="primary" id="dvReint">Reintentar</button>';$("#dvReint").onclick=async()=>{try{await sb.auth.refreshSession()}catch(e){}panelDev()};return}
  const R=r.data||{},U=u.data||[];
  const kpi=(n,t)=>`<div class="dv-kpi"><b>${n??0}</b><span>${t}</span></div>`;
  const fila=x=>`<div class="dv-user"><div class="dv-u-main"><b>${esc(x.email)}</b><small>${esc(x.tipo)}${x.pro_hasta?" · hasta "+x.pro_hasta.split("-").reverse().join("/"):""} · ${x.gastos} gastos${x.push?" · push":""}</small></div>
    <select data-mail="${esc(x.email)}" aria-label="Cambiar tipo de ${esc(x.email)}"><option value="">Cambiar…</option><option value="pro:30">Pro 30 días</option><option value="pro:365">Pro 1 año</option><option value="pro:">Pro sin vencer</option><option value="desarrollador:">Desarrollador</option><option value="normal:">Normal</option></select></div>`;
  $("#sheetBody").innerHTML=`<div class="stack">
    <div class="dv-kpis">${kpi(R.usuarios,"Usuarios")}${kpi(R.activos7,"Activos 7 días")}${kpi(R.nuevos7,"Nuevos 7 días")}${kpi(R.pro,"Pro")}${kpi(R.push,"Con push")}${kpi(R.gastos,"Gastos")}</div>
    ${A?`<h3 class="dv-h">Actividad</h3><div class="dv-kpis">${kpi(A.gastos_hoy,"Gastos hoy")}${kpi(A.gastos_7,"Gastos 7 días")}${kpi(A.recibos,"Recibos escaneados")}</div>
    <div class="dv-bars">${(A.por_dia||[]).map(d=>{const mx=Math.max(1,...A.por_dia.map(x=>x.n));return `<div class="dv-bar"><i style="height:${Math.round(d.n/mx*100)}%"></i><b>${d.n}</b><span>${d.dia}</span></div>`}).join("")}</div>`:""}
    ${V?(()=>{const con=V.filter(x=>x.version),al=con.filter(x=>x.version===APP_VERSION).length,cnt={};con.forEach(x=>{const k=x.version+" · "+x.plataforma+(x.nativa?" "+x.nativa:"");cnt[k]=(cnt[k]||0)+1});
      return `<h3 class="dv-h">Versiones</h3><div class="dv-kpis">${kpi(al,"Al día ("+APP_VERSION+")")}${kpi(con.length-al,"Desactualizados")}${kpi(V.length-con.length,"Sin abrir desde 3.9")}</div>
      <div class="dv-vers">${Object.entries(cnt).sort().reverse().map(([k,n])=>`<span class="${k.startsWith(APP_VERSION+" ")?"ok":"old"}">${esc(k)} <b>${n}</b></span>`).join("")}</div>
      <details class="dv-det"><summary>Ver por usuario</summary>${V.map(x=>`<div class="dv-vu"><span>${esc(x.email)}</span><span class="${x.version===APP_VERSION?"ok":"old"}">${x.version?esc(x.version+" · "+x.plataforma+(x.nativa?" (app "+x.nativa+")":"")):"—"}</span><small>${x.visto?new Date(x.visto).toLocaleDateString("es-CO",{day:"numeric",month:"short"}):""}</small></div>`).join("")}</details>`})():""}
    <h3 class="dv-h">Dar Pro por correo</h3>
    <form id="fPlan" class="dv-row"><input id="plMail" type="email" placeholder="correo@gmail.com" autocomplete="off"><select id="plTipo"><option value="pro:30">Pro 30 días</option><option value="pro:365">Pro 1 año</option><option value="pro:">Pro sin vencer</option><option value="normal:">Normal</option><option value="desarrollador:">Desarrollador</option></select><button class="primary sm" type="submit">Aplicar</button></form>
    <h3 class="dv-h">Aviso dentro de la app</h3>
    <p class="hint">Sale como tarjeta arriba en Resumen cuando abren Luca. No necesita permiso de notificaciones.</p>
    <form id="fAviso" class="stack"><input id="avTit" maxlength="60" placeholder="Título, ej. Mantenimiento esta noche"><textarea id="avCue" maxlength="240" rows="2" placeholder="Mensaje"></textarea>
      <select id="avPub"><option value="todos">Todos</option><option value="pro">Solo Pro</option><option value="normal">Solo normales</option></select>
      <button class="primary" type="submit">Publicar aviso</button><button type="button" class="ghost" id="avQuitar">Quitar avisos activos</button></form>
    <div class="dv-diag" id="dvDiag">Revisando este celular…</div>
    <button type="button" class="scan-btn" id="dvProbar">Probar notificación en este celular</button>
    <h3 class="dv-h">Enviar notificación</h3>
    <form id="fPush" class="stack">
      <label>Título<input id="pTit" maxlength="60" placeholder="Ej. Nueva función"></label>
      <label>Mensaje<textarea id="pCue" maxlength="180" rows="3" placeholder="Ej. Ya puedes escanear recibos en vivo."></textarea></label>
      <label>Para<select id="pPub"><option value="todos">Todos</option><option value="pro">Solo Pro</option><option value="normal">Solo normales</option>${U.filter(x=>x.push).map(x=>`<option value="${esc(x.email)}">${esc(x.email)}</option>`).join("")}</select></label>
      <button class="primary" type="submit">Enviar</button><p class="hint" id="pRes"></p></form>
    ${(R.envios||[]).length?`<h3 class="dv-h">Últimos envíos</h3><div class="ios-list solo">${R.envios.map(e=>`<div class="dv-env"><b>${esc(e.titulo)}</b><small>${esc(e.publico)} · ${e.enviados} enviados${e.fallidos?" · "+e.fallidos+" fallidos":""} · ${new Date(e.creado).toLocaleDateString("es-CO")}</small></div>`).join("")}</div>`:""}
    <h3 class="dv-h">Usuarios (${U.length})</h3><input id="dvBus" placeholder="Buscar por correo" autocomplete="off">
    <div class="ios-list solo" id="dvLista">${U.map(fila).join("")}</div></div>`;
  diagPush();
  $("#fPlan").onsubmit=async e=>{e.preventDefault();const m=$("#plMail").value.trim();if(!m){toast("Escribe el correo");return}const [t,d]=$("#plTipo").value.split(":");
    const {data,error}=await sb.rpc("admin_plan",{correo:m,tipo:t,dias:d?+d:null});toast(error?"No se pudo cambiar":data);if(!error&&!/No existe/.test(data))panelDev()};
  $("#fAviso").onsubmit=async e=>{e.preventDefault();const t=$("#avTit").value.trim(),c=$("#avCue").value.trim();if(!t||!c){toast("Escribe título y mensaje");return}
    const {data,error}=await sb.rpc("admin_aviso",{titulo:t,cuerpo:c,publico:$("#avPub").value});toast(error?"No se pudo publicar. ¿Ejecutaste supabase/avisos-admin.sql?":data);if(!error){$("#avTit").value="";$("#avCue").value=""}};
  $("#avQuitar").onclick=async()=>{const {data,error}=await sb.rpc("admin_avisos_quitar");toast(error?"No se pudo":data)};
  $("#dvProbar").onclick=async()=>{try{if(Notification.permission!=="granted"&&await Notification.requestPermission()!=="granted"){toast("Este celular tiene las notificaciones bloqueadas");return}
    const reg=await navigator.serviceWorker.ready;await reg.showNotification("Prueba de Luca",{body:"Si ves esto, este celular puede mostrar notificaciones.",icon:"icons/icon-192.png",badge:"icons/icon-192.png",tag:"luca-prueba"});toast("Prueba enviada. Revisa la barra de notificaciones.")}
    catch(e){toast("Este celular no pudo mostrar la notificación: "+(e.message||e))}};
  $("#dvBus").oninput=e=>{const q=e.target.value.toLowerCase();document.querySelectorAll(".dv-user").forEach(el=>el.hidden=!el.querySelector("b").textContent.toLowerCase().includes(q))};
  $("#dvLista").onchange=async e=>{const s=e.target.closest("select[data-mail]");if(!s||!s.value)return;const [t,d]=s.value.split(":");
    const {data,error}=await sb.rpc("admin_plan",{correo:s.dataset.mail,tipo:t,dias:d?+d:null});toast(error?"No se pudo cambiar":data);if(!error)panelDev()};
  $("#fPush").onsubmit=async e=>{e.preventDefault();const t=$("#pTit").value.trim(),c=$("#pCue").value.trim(),p=$("#pPub").value;
    if(!t||!c){toast("Escribe título y mensaje");return}
    const btn=$("#fPush .primary");const done=busy(btn,"Enviando…");
    const {data,error}=await sb.functions.invoke("send-push",{body:{titulo:t,cuerpo:c,publico:p}});done();
    $("#pRes").textContent=error?"No se pudo enviar. ¿Ya publicaste la función send-push en Supabase?":`Enviada a ${data.enviados} celular${data.enviados===1?"":"es"}${data.fallidos?" · "+data.fallidos+" fallaron":""}${data.nota?" · "+data.nota:""}`;
    if(!error){vibrar(12);$("#pTit").value="";$("#pCue").value=""}};
}
/* Botones en Más: notificaciones para todos y panel solo para desarrolladores */
function renderAdminFilas(){
  const el=$("#adminPanel");if(!el)return;
  const pushTxt=!pushSoportado()?"":(!PushNativo()&&Notification.permission==="granted")?"Notificaciones activadas":"Activar notificaciones";
  el.innerHTML=(pushTxt?`<button type="button" class="item row-btn" id="aPush"><span class="main">${pushTxt}</span><span class="chev" aria-hidden="true">›</span></button>`:"")+
    (esDev()?'<button type="button" class="item row-btn" id="aDev"><span class="main">Panel de desarrollador</span><span class="chev" aria-hidden="true">›</span></button>':"");
  el.hidden=!el.innerHTML;
  $("#aPush")&&($("#aPush").onclick=async()=>{const r=await suscribirPush(true).catch(()=>"error");toast(r==="ok"?"Notificaciones activadas":r==="denegado"?"Las notificaciones están bloqueadas en los ajustes del celular":"No se pudieron activar");renderAdminFilas()});
  $("#aDev")&&($("#aDev").onclick=panelDev);
}

/* Diagnóstico: ¿este celular puede recibir push y está registrado? */
async function diagPush(){const el=$("#dvDiag");if(!el)return;const L=[];
  const sw="serviceWorker" in navigator,pm="PushManager" in window;
  L.push("Soporte push: "+(sw&&pm?"sí":"no"));
  L.push("Permiso: "+("Notification" in window?({granted:"permitido",denied:"bloqueado",default:"sin responder"})[Notification.permission]:"no disponible"));
  const ios=/iPhone|iPad/.test(navigator.userAgent),inst=matchMedia("(display-mode: standalone)").matches||navigator.standalone;
  if(ios&&!inst)L.push("En iPhone las notificaciones solo funcionan si abres Luca desde el ícono de la pantalla de inicio");
  try{const reg=await navigator.serviceWorker.ready;const s=await reg.pushManager.getSubscription();
    if(!s)L.push("Este celular no está registrado: toca Activar notificaciones");
    else{const {data}=await sb.from("push_subs").select("id").eq("endpoint",s.endpoint).maybeSingle();L.push(data?"Registrado en Luca ✓":"Registrado en el celular pero no en Luca: toca Activar notificaciones");
      L.push("Servicio: "+(/apple/.test(s.endpoint)?"Apple":/google|fcm/.test(s.endpoint)?"Google (Chrome/Android)":/mozilla/.test(s.endpoint)?"Firefox":/windows|wns/.test(s.endpoint)?"Windows":"otro"))}
  }catch(e){L.push("No se pudo revisar: "+(e.message||e))}
  el.innerHTML=L.map(x=>"<div>"+esc(x)+"</div>").join("")}

/* Avisos dentro de la app: la tarjeta más reciente que el usuario no haya cerrado */
async function cargarAvisoApp(){
  if(!user||!sb)return;let vistos=[];try{vistos=JSON.parse(localStorage.getItem("luca-avisos-vistos")||"[]")}catch(e){}
  let data;try{const r=await sb.from("app_avisos").select("id,titulo,cuerpo,publico,creado");if(r.error||!r.data)return;data=r.data.sort((x,y)=>String(y.creado).localeCompare(String(x.creado)))}catch(e){return}
  const pro=typeof isPro==="function"&&isPro();const a=data.find(x=>!vistos.includes(x.id)&&(x.publico==="todos"||(x.publico==="pro"&&pro)||(x.publico==="normal"&&!pro)));
  let el=$("#avisoApp");if(!a){el&&el.remove();return}
  if(!el){el=document.createElement("section");el.id="avisoApp";el.className="aviso-app";const v=$("#v-resumen");v&&v.prepend(el)}
  el.innerHTML=`<div><b>${esc(a.titulo)}</b><p>${esc(a.cuerpo)}</p></div><button type="button" class="x" aria-label="Cerrar aviso">×</button>`;
  el.querySelector("button").onclick=()=>{vistos.push(a.id);try{localStorage.setItem("luca-avisos-vistos",JSON.stringify(vistos.slice(-50)))}catch(e){}el.remove()};
}

/* Registra la versión que usa este usuario (para el panel de desarrollador) */
async function reportarVersion(){
  if(!user||!sb)return;
  try{const nat=!!(window.Capacitor&&Capacitor.isNativePlatform&&Capacitor.isNativePlatform());
    const plataforma=nat?"android":(matchMedia("(display-mode: standalone)").matches||navigator.standalone)?"pwa":"web";
    let nativa=null;if(nat&&Capacitor.Plugins&&Capacitor.Plugins.App){try{nativa=(await Capacitor.Plugins.App.getInfo()).version}catch(e){}}
    await sb.from("app_versiones").upsert({user_id:user.id,version:APP_VERSION,plataforma,nativa,visto:new Date().toISOString()})}catch(e){}
}
