"use strict";
/* Luca 2.0 — funciones Pro:
   Anillos del día · Racha · Luca te cuenta (insights) · Cazador de suscripciones ·
   Plan de pago inteligente · Reparto de quincena · Modo privado · Pantalla Luca Pro */

const PRO_ICO={
  anillo:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/></svg>',
  fuego:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c1 3.5-1.5 5-1.5 7.5 0 1.4 1 2.5 2.3 2.5 1.6 0 2.4-1.4 2.2-3.2C17.6 10.6 19 13 19 15.5 19 19.1 15.9 22 12 22s-7-2.9-7-6.5C5 10.8 9.6 8.4 12 2z"/></svg>',
  hormiga:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="7" cy="12" r="2.5"/><circle cx="12.5" cy="12" r="2"/><ellipse cx="18" cy="12" rx="3" ry="2.4"/><path d="M5 9 3 6M5 15l-2 3M12 10l-1-4M12 14l-1 4M17 10l2-4M17 14l2 4"/></svg>',
  tendencia:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/></svg>',
  calendario:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  repetir:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12"/><path d="M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/></svg>',
  tarjeta:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20"/></svg>',
  reparto:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 3v18M3 12h18"/><circle cx="12" cy="12" r="9"/></svg>',
  plan:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19h16"/><path d="M6 15l4-4 3 3 5-6"/></svg>',
  chispa:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.2 6.3L20.5 10l-6.3 2.2L12 18.5l-2.2-6.3L3.5 10l6.3-1.7z"/></svg>',
  ojo:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  ojoNo:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 3l18 18"/><path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.3 6.3C3.7 8 2 12 2 12s3.6 7 10 7c1.6 0 3-.4 4.3-1"/></svg>',
  candado:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="4" y="10" width="16" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>'
};
const tile=(ico,color)=>`<span class="tile" style="--c:${color}">${PRO_ICO[ico]}</span>`;
const sumar=(a,f)=>a.reduce((s,x)=>s+(f(x)||0),0);
const gastoDia=d=>sumar(S.gastos.filter(g=>g.fecha===d),g=>g.valor);

/* ---------- Anillos y racha ---------- */
function ringSvg(rings){
  const R=[54,41,28],C=r=>2*Math.PI*r;
  return `<svg class="rings" viewBox="0 0 132 132" aria-hidden="true">${rings.map((g,i)=>{const r=R[i],c=C(r),p=g.p==null?0:Math.min(g.p,1);
    return `<circle cx="66" cy="66" r="${r}" fill="none" stroke="${g.color}" stroke-opacity=".2" stroke-width="11"/>
      <circle class="ring-p" cx="66" cy="66" r="${r}" fill="none" stroke="${g.color}" stroke-width="11" stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${c.toFixed(1)}" data-off="${(c*(1-p)).toFixed(1)}" transform="rotate(-90 66 66)"/>`}).join("")}</svg>`;
}
function rachaDias(lim){
  if(!(lim>0))return 0;let n=0;const hoy=midnight();
  for(let i=0;i<90;i++){const d=iso(addDays(hoy,-i));const v=gastoDia(d);
    if(i===0&&v<=lim){n++;continue}if(i===0)return 0;
    if(d<(S.gastos.map(g=>g.fecha).sort()[0]||d))break;if(v<=lim)n++;else break}
  return n;
}
function renderAnillos(T){
  const el=$("#anillosBox");if(!el)return;
  const I=libreInfo(),hoyV=gastoDia(today());
  const lim=I.libre>0?I.porDia:null;
  const espacio=(T.ing||0)-T.fijos-T.minimos-T.pagado;
  const pres=Object.values(S.ajustes.presupuestos||{}).reduce((s,v)=>s+(v||0),0);
  const baseMes=pres||(espacio>0?espacio:(T.ing>0?T.ing:null));
  const pendMin=T.minimos;
  const rings=[
    {color:"#FF2D55",p:lim?hoyV/lim:null,t:"Hoy",v:lim?`${fmt(hoyV)} de ${fmt(lim)}`:"Pon tu sueldo"},
    {color:"#30D158",p:baseMes?T.gastado/baseMes:null,t:pres?"Presupuesto del mes":"Gasto del mes",v:baseMes?`${fmt(T.gastado)} de ${fmt(baseMes)}`:"Sin datos aún"},
    {color:"#0A84FF",p:S.tarjetas.length?(T.pagado+pendMin?T.pagado/(T.pagado+pendMin):1):null,t:"Tarjetas pagadas",v:S.tarjetas.length?`${fmt(T.pagado)} de ${fmt(T.pagado+pendMin)}`:"Sin tarjetas"}];
  const racha=rachaDias(lim);
  const html=`<div class="rc-head"><h2>Tu día</h2>${racha?`<span class="racha">${PRO_ICO.fuego}<b>${racha}</b> ${racha===1?"día":"días"} en racha</span>`:""}</div>
    <div class="rc-body">${ringSvg(rings)}<div class="rc-leg">${rings.map(g=>`<div class="rl"><i style="background:${g.color}"></i><div><span>${g.t}</span><b class="num">${g.v}</b></div></div>`).join("")}</div></div>
    ${rings[0].p>1?`<p class="rc-note over">Hoy te pasaste ${fmt(hoyV-lim)} de lo que te toca por día.</p>`:lim?`<p class="rc-note"><span>${hoyV?`Te quedan ${fmt(Math.max(0,lim-hoyV))} para hoy.`:"Hoy aún no has gastado. ¡Bien!"}</span> <span>La racha cuenta los días que no pasas de ${fmt(lim)}.</span></p>`:""}`;
  if(el.dataset.h===html)return;el.dataset.h=html;el.innerHTML=html;
  requestAnimationFrame(()=>requestAnimationFrame(()=>el.querySelectorAll(".ring-p").forEach(c=>c.style.strokeDashoffset=c.dataset.off)));
}

/* ---------- Cazador de suscripciones ---------- */
function suscripciones(){
  const out=[],vistos=new Set(),desde=iso(addDays(midnight(),-200));
  const g=S.gastos.filter(x=>x.fecha>=desde&&x.valor);const grupos={};
  g.forEach(x=>{const k=norm(x.nota||x.categoria);(grupos[k]=grupos[k]||[]).push(x)});
  Object.entries(grupos).forEach(([k,arr])=>{
    const meses=new Set(arr.map(x=>monthKey(x.fecha)));const vals=arr.map(x=>x.valor).sort((a,b)=>a-b);const med=vals[vals.length>>1];
    const parecido=arr.filter(x=>Math.abs(x.valor-med)<=med*.15).length>=Math.min(arr.length,2);
    const esSus=arr.some(x=>x.categoria==="Suscripciones");
    if((meses.size>=2&&parecido&&arr.length<=meses.size*2)||esSus){vistos.add(k);out.push({nombre:arr[0].nota||arr[0].categoria,mes:med,veces:arr.length,ultimo:arr.map(x=>x.fecha).sort().pop(),tipo:"gasto"})}});
  (S.ajustes.fijos||[]).forEach(f=>{const k=norm(f.nombre);if(!vistos.has(k))out.push({nombre:f.nombre,mes:f.valor||0,tipo:"fijo",dia:f.dia})});
  return out.sort((a,b)=>b.mes-a.mes);
}
function susSheet(){
  const L_=suscripciones(),cancel=new Set(S.ajustes.cancelar||[]);const tot=sumar(L_,x=>x.mes),ahorro=sumar(L_.filter(x=>cancel.has(norm(x.nombre))),x=>x.mes);
  openSheet("Suscripciones y cobros fijos",`<div class="stack">
    <div class="big-stat"><span class="eyebrow">Te cuestan al año</span><b class="num">${fmt(tot*12)}</b><span class="hint num">${fmt(tot)} al mes en ${L_.length} ${L_.length===1?"cobro":"cobros"}</span></div>
    ${L_.length?`<div class="ios-list">${L_.map(x=>{const k=norm(x.nombre),c=cancel.has(k);return `<button class="ios-row sus ${c?"cancel":""}" data-sus="${esc(k)}"><span><b>${esc(x.nombre)}</b><small>${x.tipo==="fijo"?"Gasto fijo":"Detectado en tus gastos"} · ${fmt(x.mes*12)} al año</small></span><b class="num">${fmt(x.mes)}</b></button>`}).join("")}</div>
      <p class="hint">Toca uno para marcarlo como “lo voy a cancelar”.${ahorro?` Si cancelas los marcados te ahorras ${fmt(ahorro*12)} al año.`:""}</p>`
    :`<div class="empty">Todavía no detecto cobros que se repitan. Cuando un gasto se repita en dos meses distintos (Netflix, gimnasio, plan de celular…), aparece aquí solo.</div>`}
  </div>`,()=>{$("#sheetBody").querySelectorAll("[data-sus]").forEach(b=>b.onclick=()=>{const k=b.dataset.sus,s=new Set(S.ajustes.cancelar||[]);s.has(k)?s.delete(k):s.add(k);S.ajustes.cancelar=[...s];saveAjustes();vibrar(8);susSheet()})});
}

/* ---------- Plan de pago inteligente ---------- */
function tarjetasDeuda(){return S.tarjetas.filter(t=>deudaCopCard(t)>0).map(t=>{const b=deudaCopCard(t);const m=minNA(t)?Math.max(20000,Math.round(b*.05)):Math.min(minTotal(t)||Math.round(b*.05),b);return{t,b,r:tasaMes(t),min:m,minRate:Math.min(.5,Math.max(.03,m/b))}})}
function repartir(cs,budget,metodo,bal){
  const pay={};let rest=budget;
  cs.forEach((c,i)=>{const m=Math.min(bal[i],Math.max(Math.min(20000,bal[i]),bal[i]*c.minRate),rest);pay[i]=m;rest-=m});
  const orden=cs.map((c,i)=>i).sort(metodo==="avalancha"?(a,b)=>cs[b].r-cs[a].r||bal[a]-bal[b]:(a,b)=>bal[a]-bal[b]);
  for(const i of orden){if(rest<=0)break;const e=Math.min(rest,bal[i]-pay[i]);pay[i]+=e;rest-=e}
  return pay;
}
function simPlan(cs,budget,metodo){
  const bal=cs.map(c=>c.b);let n=0,int=0;
  while(bal.some(b=>b>1)&&n<360){bal.forEach((b,i)=>{const x=b*cs[i].r;bal[i]+=x;int+=x});
    const pay=metodo==="minimos"?bal.map((b,i)=>Math.min(b,Math.max(Math.min(20000,b),b*cs[i].minRate))):repartir(cs,budget,metodo,bal);
    bal.forEach((b,i)=>bal[i]=Math.max(0,b-(pay[i]||0)));n++}
  return{meses:n>=360?Infinity:n,int};
}
function planSheet(){
  const cs=tarjetasDeuda();
  if(!cs.length){openSheet("Plan de pago inteligente",`<div class="empty">No tienes deudas en tarjetas. ¡Felicitaciones!</div>`);return}
  const sumMin=sumar(cs,c=>c.min);let budget=Math.ceil((S.ajustes.planPago||Math.max(sumMin,Math.round(sumMin*1.3)))/10000)*10000,metodo=S.ajustes.planMetodo||"avalancha";
  openSheet("Plan de pago inteligente",`<div class="stack">
    <p class="muted" style="margin:0">Dime cuánto puedes pagar este mes en total y Luca reparte la plata entre tus tarjetas para que pagues menos intereses.</p>
    <label>¿Cuánto puedes pagar este mes?<input id="ppVal" class="money num" inputmode="numeric"></label>
    <div class="cats seg" id="ppMet"><button type="button" data-m="avalancha">Ahorra más intereses</button><button type="button" data-m="bola">Termina tarjetas rápido</button></div>
    <div id="ppOut"></div></div>`,()=>{
    const inp=$("#ppVal");inp.value=fmt(budget);
    const pintar=()=>{$("#ppMet").querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.m===metodo));
      const bal=cs.map(c=>c.b),pay=repartir(cs,budget,metodo,bal);const falta=sumMin-budget;
      const r=simPlan(cs,budget,metodo),m0=simPlan(cs,budget,"minimos");
      $("#ppOut").innerHTML=`${falta>0?`<p class="notice">Con ${fmt(budget)} no alcanzas a cubrir todos los mínimos (${fmt(sumMin)}). Te faltan ${fmt(falta)}.</p>`:""}
        <div class="ios-list">${cs.map((c,i)=>`<div class="ios-row"><span><b>${esc(c.t.nombre)}</b><small>Debes ${fmt(c.b)} · mínimo ${fmt(c.min)}</small></span><b class="num pp-pay">${fmt(pay[i]||0)}</b></div>`).join("")}</div>
        <div class="pp-res">${isFinite(r.meses)?`<div><span>Libre de deudas en</span><b class="num">${nMeses(r.meses)}</b></div><div><span>Intereses aprox.</span><b class="num">${fmt(r.int)}</b></div>`:`<div><span>Con este pago</span><b>Casi no baja</b></div>`}</div>
        ${isFinite(r.meses)&&(!isFinite(m0.meses)||m0.int>r.int)?`<p class="pp-win">${PRO_ICO.chispa}<span>${isFinite(m0.meses)?`Frente a pagar solo el mínimo te ahorras ${fmt(m0.int-r.int)} en intereses y terminas ${nMeses(Math.max(0,m0.meses-r.meses))} antes.`:"Pagando solo el mínimo nunca terminarías. Con este plan sí."}</span></p>`:""}
        <p class="hint">${metodo==="avalancha"?"Primero cubre todos los mínimos y lo que sobra va a la tarjeta con el interés más alto.":"Primero cubre todos los mínimos y lo que sobra va a la deuda más pequeña, para que la cierres pronto y te motives."} Estimado con el interés de cada tarjeta (2% mensual si no lo pusiste).</p>`};
    inp.addEventListener("input",()=>{const n=parse(inp.value)||0;inp.value=n?fmt(n):"";budget=n;S.ajustes.planPago=n;pintar()});
    inp.addEventListener("change",()=>saveAjustes());
    $("#ppMet").onclick=e=>{const b=e.target.closest("[data-m]");if(!b)return;metodo=b.dataset.m;S.ajustes.planMetodo=metodo;saveAjustes();vibrar(6);pintar()};
    pintar();
  });
}

/* ---------- Reparto de quincena ---------- */
function repartoSheet(monto){
  const np=nextPayday()||addDays(midnight(),15);
  const it=antesDe(np).filter(i=>i.valor);const fij=sumar(it.filter(i=>i.tipo==="fijo"),i=>i.valor),tar=sumar(it.filter(i=>i.tipo==="tarjeta"),i=>i.valor);
  let total=monto||S.ajustes.montoPago||0,pct=S.ajustes.ahorroPct??10;
  openSheet("Reparto de quincena",`<div class="stack">
    <p class="muted" style="margin:0">Así se reparte tu pago antes de que se te vaya en otras cosas.</p>
    <label>¿Cuánto te llegó?<input id="rqVal" class="money num" inputmode="numeric"></label>
    <div class="rq-bar" id="rqBar"></div><div id="rqList"></div>
    <label>Ahorro: <b id="rqPct"></b><input type="range" id="rqRange" min="0" max="40" step="1"></label>
    ${S.metas.length?`<label>Mandar el ahorro a<select id="rqMeta"><option value="">No abonar ahora</option>${S.metas.map(m=>`<option value="${esc(m.id)}">${esc(m.nombre)}</option>`).join("")}</select></label>`:""}
    <button class="primary" id="rqOk">Listo, así lo reparto</button></div>`,()=>{
    const inp=$("#rqVal"),rg=$("#rqRange");inp.value=total?fmt(total):"";rg.value=pct;
    const dias=Math.max(1,daysUntil(np));
    const pintar=()=>{const aho=Math.round(total*pct/100),libre=total-fij-tar-aho;
      const seg=[["Gastos fijos",fij,"#FF9F0A"],["Tarjetas",tar,"#FF453A"],["Ahorro",aho,"#30D158"],["Para gastar",Math.max(0,libre),"#0A84FF"]];
      const tot=Math.max(1,seg.reduce((s,x)=>s+x[1],0));
      $("#rqBar").innerHTML=seg.map(([n,v,c])=>v?`<i style="flex:${v/tot};background:${c}"></i>`:"").join("");
      $("#rqPct").textContent=pct+"% · "+fmt(aho);
      $("#rqList").innerHTML=`<div class="ios-list">${seg.map(([n,v,c])=>`<div class="ios-row"><span><i class="dotc" style="background:${c}"></i>${n}</span><b class="num">${fmt(v)}</b></div>`).join("")}</div>
        <p class="rq-dia">${libre>0?`Te quedan <b class="num">${fmt(libre/dias)}</b> por día durante ${nDias(dias)}.`:`<span class="neg">Te faltan ${fmt(-libre)} para cubrir todo. Baja el ahorro o revisa tus pagos.</span>`}</p>`};
    inp.addEventListener("input",()=>{const n=parse(inp.value)||0;inp.value=n?fmt(n):"";total=n;pintar()});
    rg.addEventListener("input",()=>{pct=+rg.value;vibrar(4);pintar()});
    $("#rqOk").onclick=async()=>{S.ajustes.ahorroPct=pct;await saveAjustes();const m=S.metas.find(x=>x.id===($("#rqMeta")?.value||""));const aho=Math.round(total*pct/100);closeSheet();
      if(m&&aho>0){const a0=m.ahorrado||0;await put("metas",m.id,{...strip(m),ahorrado:a0+aho});
        celebrar({titulo:"Ahorro guardado",nombre:m.nombre,antes:m.objetivo?a0/m.objetivo*100:0,despues:m.objetivo?(a0+aho)/m.objetivo*100:0,texto:`Separaste ${fmt(aho)} de tu quincena.`})}
      else toast("Reparto guardado")};
    pintar();
  });
}

/* ---------- Luca te cuenta (insights) ---------- */
function insights(T){
  const out=[],hoy=midnight(),mk=monthKey(today());
  const gm=S.gastos.filter(g=>monthKey(g.fecha)===mk);
  // Proyección del mes
  const dia=hoy.getDate(),dm=new Date(hoy.getFullYear(),hoy.getMonth()+1,0).getDate();
  if(gm.length>=3&&dia>=3){const proy=T.gastado/dia*dm;out.push({ico:"tendencia",c:"#5E5CE6",t:"Así cierras el mes",v:fmt(proy),d:`Si sigues a este ritmo, terminas ${MESES[hoy.getMonth()].toLowerCase()} gastando ${fmt(proy)}.`})}
  // Gasto hormiga
  const h=gm.filter(g=>g.valor<=15000);if(h.length>=4)out.push({ico:"hormiga",c:"#FF9F0A",t:"Gasto hormiga",v:fmt(sumar(h,g=>g.valor)),d:`${h.length} gastos pequeños este mes. Al año serían unos ${fmt(sumar(h,g=>g.valor)/dia*365)}.`});
  // Semana vs semana
  const s0=sumar(S.gastos.filter(g=>g.fecha>iso(addDays(hoy,-7))&&g.fecha<=today()),g=>g.valor),s1=sumar(S.gastos.filter(g=>g.fecha>iso(addDays(hoy,-14))&&g.fecha<=iso(addDays(hoy,-7))),g=>g.valor);
  if(s0&&s1){const d=(s0-s1)/s1*100;out.push({ico:"tendencia",c:d>0?"#FF453A":"#30D158",t:d>0?"Esta semana gastas más":"Esta semana gastas menos",v:(d>0?"+":"−")+Math.abs(Math.round(d))+"%",d:`${fmt(s0)} en los últimos 7 días contra ${fmt(s1)} la semana anterior.`})}
  // Día de la semana
  const pd=[0,0,0,0,0,0,0],cd=[0,0,0,0,0,0,0];S.gastos.filter(g=>g.fecha>=iso(addDays(hoy,-60))).forEach(g=>{const w=new Date(g.fecha+"T12:00").getDay();pd[w]+=g.valor||0;cd[w]++});
  const tot=pd.reduce((a,b)=>a+b,0);if(tot&&S.gastos.length>=8){const w=pd.indexOf(Math.max(...pd));const r=pd[w]/(tot/7);if(r>1.4)out.push({ico:"calendario",c:"#64D2FF",t:"Tu día más caro",v:DIAS_L[w],d:`Los ${DIAS_L[w]} gastas ${r.toFixed(1).replace(".",",")} veces más que un día normal.`})}
  // Suscripciones
  const su=suscripciones();if(su.length)out.push({ico:"repetir",c:"#BF5AF2",t:"Cobros que se repiten",v:fmt(sumar(su,x=>x.mes)*12)+"/año",d:`${su.length} ${su.length===1?"cobro fijo o suscripción":"cobros fijos y suscripciones"}. Toca para revisarlos.`,go:"sus"});
  // Cupo alto
  const alta=S.tarjetas.filter(t=>t.cupo&&(t.saldo!=null||t.saldoUsd!=null)).map(t=>({t,p:deudaCopCard(t)/t.cupo*100})).sort((a,b)=>b.p-a.p)[0];
  if(alta&&alta.p>=80)out.push({ico:"tarjeta",c:"#FF453A",t:"Cupo casi lleno",v:Math.round(alta.p)+"%",d:`${alta.t.nombre} está al ${Math.round(alta.p)}% del cupo. Usarla menos ayuda a tu historial crediticio.`,go:"plan"});
  // Plan de pago
  if(tarjetasDeuda().length>=2)out.push({ico:"plan",c:"#30D158",t:"Plan de pago",v:"Paga menos intereses",d:"Luca te dice cuánto pagarle a cada tarjeta este mes.",go:"plan"});
  return out;
}
function renderInsights(T){
  const el=$("#insightsBox");if(!el)return;const it=insights(T);
  const html=it.length?`<div class="row-head"><h2>Luca te cuenta</h2><span class="pro-badge">PRO</span></div><div class="ins-row">${it.map((x,i)=>`<button type="button" class="ins" data-ins="${i}">${tile(x.ico,x.c)}<span class="ins-t">${x.t}</span><b class="ins-v num">${esc(x.v)}</b><span class="ins-d">${x.d}</span></button>`).join("")}</div>`:"";
  if(el.dataset.h===html)return;el.dataset.h=html;el.innerHTML=html;el._it=it;
}
document.addEventListener("click",e=>{const b=e.target.closest(".ins");if(!b)return;const x=($("#insightsBox")._it||[])[+b.dataset.ins];if(!x)return;vibrar(6);
  if(x.go==="sus")susSheet();else if(x.go==="plan")planSheet()});

/* ---------- Acciones rápidas, modo privado, Luca Pro ---------- */
function proSheet(){
  const f=[["anillo","#FF2D55","Anillos del día","Mira de un vistazo cómo vas hoy, en el mes y con tus tarjetas."],["fuego","#FF9F0A","Racha","Suma días sin pasarte de lo que te toca y no la rompas."],["chispa","#5E5CE6","Luca te cuenta","Gasto hormiga, tu día más caro y cómo cierras el mes."],["plan","#30D158","Plan de pago inteligente","Cuánto pagarle a cada tarjeta para pagar menos intereses."],["reparto","#0A84FF","Reparto de quincena","Reparte tu pago entre fijos, tarjetas, ahorro y gasto diario."],["repetir","#BF5AF2","Cazador de suscripciones","Encuentra lo que te cobran cada mes y cuánto suma al año."],["ojoNo","#8E8E93","Modo privado","Oculta tus montos con un toque cuando estés en público."]];
  openSheet("Luca Pro",`<div class="stack"><div class="pro-hero">${tile("chispa","#5E5CE6")}<h3>Tu plata, en modo experto</h3><p class="muted">Gratis mientras Luca está en lanzamiento.</p></div>
    <div class="ios-list">${f.map(([i,c,t,d])=>`<div class="ios-row pro-f">${tile(i,c)}<span><b>${t}</b><small>${d}</small></span></div>`).join("")}</div>
    <p class="hint">Cuando lleguen los pagos, Luca Pro costará ${fmt((window.CONFIG&&CONFIG.PRECIO_PRO)||15900)} al mes. Te avisaremos dentro de la app.</p></div>`);
}
function aplicarPrivado(on){document.documentElement.classList.toggle("privado",on);try{localStorage.setItem("luca-privado",on?"1":"")}catch(e){}
  const b=$("#btnPriv");if(b){b.innerHTML=on?PRO_ICO.ojoNo:PRO_ICO.ojo;b.setAttribute("aria-label",on?"Mostrar montos":"Ocultar montos");b.setAttribute("aria-pressed",on)}}
(()=>{let on=false;try{on=localStorage.getItem("luca-privado")==="1"}catch(e){}aplicarPrivado(on);
  $("#btnPriv").onclick=()=>{vibrar(8);aplicarPrivado(!document.documentElement.classList.contains("privado"))};
  $("#btnPerfil").onclick=()=>go("mas");
  document.addEventListener("click",e=>{const a=e.target.closest("[data-accion]");if(!a)return;vibrar(6);
    ({reparto:()=>repartoSheet(),plan:planSheet,sus:susSheet,resumen:()=>{const mk=mesParaResumen();mk?abrirResumen(mk):toast("Todavía no hay gastos este mes.")},pro:proSheet})[a.dataset.accion]?.()});
})();
function renderPerfil(){const b=$("#btnPerfil");if(!b)return;const n=typeof nombreUsuario==="function"?nombreUsuario():"";const ini=(n||"L").charAt(0).toUpperCase();if(b.textContent!==ini)b.textContent=ini}
function renderPro(T){renderAnillos(T);renderInsights(T);renderPerfil()}
if(typeof user!=="undefined"&&user)render();
