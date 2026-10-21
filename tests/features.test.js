const H=require("./harness.js");const fs=require("fs");const os=require("os");const path=require("path");const T=H.T;
const w=(p,ms=300)=>p.waitForTimeout(ms);
(async()=>{const b=await H.launch();const {p}=await H.page(b);
  await p.goto("https://app.test/");await w(p,1200);
  T("app abierta",await p.isVisible("#app"));
  T("libre visible",(await p.textContent("#libreBox")).includes("al día"),(await p.textContent("#libreBox")).replace(/\s+/g," ").slice(0,200));
  T("aviso",(await p.textContent("#avisoBox")).includes("Nubank"),(await p.textContent("#avisoBox")).replace(/\s+/g," "));
  T("chips rápidos (auto)",(await p.textContent("#qChips")).includes("Almuerzo"),(await p.textContent("#qChips")).replace(/\s+/g," "));
  // parser
  const casos=await p.evaluate(()=>["almuerzo 18 mil nequi","uber 12.500 nubank ayer","tenis 89k amex","netflix 20 usd amex","2 lucas tinto","arriendo 1,2 millones ahorros bancolombia","pizza 35","cine con la novia 40000 efectivo","robux 25 mil credito"].map(t=>[t,interpretarGasto(t)]));
  
  // escribir y guardar
  const n0=await p.evaluate(()=>S.gastos.length);
  await p.fill("#qText","almuerzo 18 mil nequi");await w(p,200);
  T("previa",(await p.textContent("#qPrev")).includes("$\u00a018.000"),(await p.textContent("#qPrev")));
  const s0=await p.evaluate(()=>S.cuentas.find(c=>c.id==="c1").saldo);
  await p.click("#fQuick button[type=submit]");await w(p,400);
  T("gasto guardado por texto",await p.evaluate(n=>S.gastos.length===n+1,n0));
  T("descontado de Nequi",await p.evaluate(s=>S.cuentas.find(c=>c.id==="c1").saldo===s-18000,s0));
  T("toast con deshacer",await p.isVisible("#toast .toast-act"));
  await p.click("#toast .toast-act");await w(p,400);
  T("deshacer",await p.evaluate(([n,s])=>S.gastos.length===n&&S.cuentas.find(c=>c.id==="c1").saldo===s,[n0,s0]));
  // chip rápido con tarjeta
  const d0=await p.evaluate(()=>S.tarjetas.find(t=>t.id==="t1").saldo);
  await p.evaluate(()=>{S.ajustes.rapidos=[{id:"r1",nota:"Uber",valor:12500,categoria:"Transporte",medioKey:"t:t1"}];render()});
  await p.click('.qchip[data-rap="0"]');await w(p,400);
  T("chip suma a tarjeta",await p.evaluate(d=>S.tarjetas.find(t=>t.id==="t1").saldo===d+12500,d0));
  await p.click("#toast .toast-act");await w(p,400);
  T("deshacer chip",await p.evaluate(d=>S.tarjetas.find(t=>t.id==="t1").saldo===d,d0));
  // ¿me alcanza?
  await p.click("#btnAlcanza");await w(p,300);
  for(const [v,exp] of [["50000","verde"],["600000","amarillo"],["5000000","rojo"]]){await p.fill("#maVal",v);await p.dispatchEvent("#maVal","input");await w(p,150);
    const r=await p.getAttribute("#maRes","data-v");T("me alcanza "+v,r===exp,r+" · "+(await p.textContent("#maRes")).replace(/\s+/g," "))}
  await p.fill("#maVal","50000");await p.dispatchEvent("#maVal","input");await p.click('#maCats [data-c="Comida"]');await w(p,200);
  await p.click("#maComprar");await w(p,300);
  T("prefill gasto",(await p.inputValue("#gVal"))==="$\u00a050.000");
  await p.fill("#gTexto","pizza 35 mil amex");await w(p,150);
  T("texto llena hoja",(await p.inputValue("#gVal"))==="$\u00a035.000"&&(await p.inputValue("#gMedio"))==="t:t2",await p.inputValue("#gNota"));
  await p.check("#gRap");await p.click("#fg .primary");await w(p,400);
  T("guardado como rápido",await p.evaluate(()=>(S.ajustes.rapidos||[]).some(r=>r.nota==="Pizza")));
  // Libre de deudas
  T("libre de deudas",(await p.textContent("#libreDeudaBox")).includes("Libre de deudas"),(await p.textContent("#libreDeudaBox")).replace(/\s+/g," ").slice(0,260));
  await p.$eval("#ldRange",e=>{e.value=+e.max;e.dispatchEvent(new Event("input"))});await w(p,100);
  await p.locator("#libreDeudaBox").scrollIntoViewIfNeeded();
  // wrapped
  await p.click("#wrapBox");await w(p,1400);
  T("resumen abierto",await p.isVisible(".story"));
  for(let i=2;i<=7;i++){await p.mouse.click(330,500);await w(p,600)}
  await p.keyboard.press("Escape");await w(p,400);
  T("resumen cerrado",!(await p.isVisible(".story")));
  // tarjetas: payoff
  await p.click('nav.tabs [data-tab="tarjetas"]');await w(p,400);
  // metas abono
  await p.click('nav.tabs [data-tab="mas"]');await w(p,300);
  await p.click('[data-abono="m2"]');await w(p,300);await p.fill("#abVal","60000");await p.click("#fAbono .primary");await w(p,700);
  T("celebración",await p.isVisible(".celebra"));await w(p,1000);
  await p.click("#ceOk");await w(p,300);
  // calendario
  const [dl]=await Promise.all([p.waitForEvent("download"),p.click("#avCal")]);const ics=fs.readFileSync(await dl.path(),"utf8");
  T("ics",ics.includes("BEGIN:VCALENDAR")&&ics.includes("SUMMARY:Pagar Nubank")&&ics.includes("BYMONTHDAY=28,29,30;BYSETPOS=-1"),dl.suggestedFilename()+" "+ics.length+"b");
  
  // Pregúntale a Luca
  await p.evaluate(()=>closeSheet&&closeSheet());await w(p,400);
  const resp=await p.evaluate(()=>["¿Cuánto debo?","¿Cuánto gasté en comida este mes?","¿Cuánto puedo gastar hoy?","¿Cuánto tengo en mis cuentas?","qwerty"].map(q=>String(responder(q)).replace(/<[^>]+>/g,"")));
  T("asistente responde deuda",/\$/.test(resp[0]),resp[0]);
  T("asistente categoría",/omida/.test(resp[1]),resp[1]);
  T("asistente fallback",resp[4].length>10,resp[4]);
  await p.evaluate(()=>document.querySelector('.ask-bar').click());await w(p,500);
  await p.fill("#pregIn","¿Cuánto debo?");await p.click("#fPreg button[type=submit]");await w(p,400);
  T("chat burbujas",(await p.$$(".msg.yo")).length===1&&(await p.$$(".msg.luca")).length>=2);
  T("panel seguridad",(await p.textContent("#seguridadPanel")).length>5,await p.textContent("#seguridadPanel"));
  T("no JavaScript errors",p.errs.filter(e=>!/fetching the script/.test(e)).length===0,p.errs.join(" | "));H.done();
  await b.close()})();
