const {chromium}=require("playwright");const fs=require("fs");const path=require("path");
const APP=path.join(__dirname,"..");
async function ctxFor(b,opts={}){const ctx=await b.newContext({viewport:{width:390,height:844},locale:"es-CO",timezoneId:"America/Bogota",colorScheme:opts.scheme||"light",acceptDownloads:true});
 await ctx.route("**/*",async r=>{const u=new URL(r.request().url());
   if(u.hostname==="app.test"&&u.pathname.startsWith("/vendor/supabase"))return r.fulfill({body:fs.readFileSync(path.join(__dirname,"mock-supabase.js")),contentType:"text/javascript"});
   if(u.hostname==="app.test"){let p=u.pathname==="/"?"/index.html":u.pathname;if(!fs.existsSync(path.join(APP,p)))return r.fulfill({status:404,body:""});
     const ct={".html":"text/html",".js":"text/javascript",".css":"text/css",".png":"image/png",".webmanifest":"application/manifest+json"}[path.extname(p)]||"text/plain";
     return r.fulfill({body:fs.readFileSync(path.join(APP,p)),contentType:ct})}
   if(u.hostname==="cdn.jsdelivr.net")return r.fulfill({body:fs.readFileSync(path.join(__dirname,"mock-supabase.js")),contentType:"text/javascript"});
   if(u.hostname==="www.datos.gov.co")return r.fulfill({body:'[{"valor":"3156.32","vigenciadesde":"2026-10-20T00:00:00.000"}]',contentType:"application/json"});
   return r.abort()});
 if(opts.confirm)await ctx.addInitScript(()=>localStorage.setItem("__confirm","1"));
 const p=await ctx.newPage();p.errs=[];p.on("pageerror",e=>p.errs.push(e.message));return {ctx,p}}
let fails=0;const T=(n,ok,x="")=>{if(!ok)fails++;console.log((ok?"PASS":"FAIL")+"  "+n+(x&&!ok?"  — "+x:""))};
const w=(p,ms=250)=>p.waitForTimeout(ms);
(async()=>{
 const b=await chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
 // A) Sign-up sin confirmación -> bienvenida
 let {ctx,p}=await ctxFor(b);await p.goto("https://app.test/");await w(p,500);
 await p.click('[data-paso="crear"]');await p.fill("#aName","Andrés");await p.fill("#aMail","ana@test.co");await p.fill("#aPass","corta");await p.click("#fAuth .primary");
 T("contraseña corta rechazada",(await p.textContent("#authMsg")).includes("8 caracteres"));
 await p.fill("#aPass","ClaveSegura1!");await p.click("#fAuth .primary");await w(p,700);
 T("cuenta creada y adentro",await p.isVisible("#app"));
 T("bienvenida abierta",(await p.textContent("#sheetTitle"))==="Bienvenido a Luca");
 T("nombre precargado",(await p.inputValue("#obNom"))==="Andrés");
 await p.click("#ob .primary");await w(p);await p.fill("#obMonto","1450000");await p.click("#ob .primary");await w(p,400);
 T("paso 3",(await p.textContent("#sheetTitle")).startsWith("Listo, Andrés"));
 await p.click("#obFin");await w(p,400);
 T("saludo",(await p.textContent("#monthLabel")).startsWith("Hola, Andrés"));
 T("sueldo guardado",await p.evaluate(()=>S.ajustes.montoPago===1450000&&S.ajustes.onboarded===true));
 // Más: cuenta, plan, apariencia, ayuda
 await p.click('nav.tabs [data-tab="mas"]');await w(p,400);
 T("panel cuenta",(await p.textContent("#cuentaPanel")).includes("ana@test.co"));
 T("plan gratis",(await p.textContent("#planPanel")).includes("Luca Gratis"));
 T("ayuda versión",(await p.textContent("#ayudaPanel")).includes(fs.readFileSync(path.join(APP,"app.js"),"utf8").match(/APP_VERSION="([\d.]+)"/)[1]));
 await p.click('#temaSeg [data-tema="dark"]');T("tema oscuro",await p.evaluate(()=>document.documentElement.dataset.theme==="dark"));
 await p.click('#temaSeg [data-tema="auto"]');
 // CSV
 await p.evaluate(()=>{S.gastos.push({id:"g1",valor:23000,categoria:"Comida",nota:"Almuerzo; con \"amigos\"",fecha:"2026-10-20",medio:"Efectivo"});render()});
 const [dl]=await Promise.all([p.waitForEvent("download"),p.click("#cCsv")]);const csv=fs.readFileSync(await dl.path(),"utf8");
 T("CSV exportado",csv.startsWith("﻿tipo;fecha")&&csv.includes('"Almuerzo; con ""amigos"""')&&csv.includes("-23000"),dl.suggestedFilename());
 // cambiar contraseña
 await p.click("#cPass");await w(p);await p.fill("#npPass","NuevaClave22");await p.click("#fNP .primary");await w(p);
 T("contraseña cambiada",await p.evaluate(()=>__mock.store.users["ana@test.co"].password==="NuevaClave22"));
 // cerrar sesión y entrar con contraseña equivocada / correcta
 await p.click("#cOut");await w(p,400);T("cerró sesión",await p.isVisible("#auth"));
 await p.fill("#aMail","ana@test.co");await p.fill("#aPass","mal");await p.click("#fAuth .primary");await w(p);
 T("clave equivocada",(await p.textContent("#authMsg")).includes("no coinciden"));
 await p.fill("#aPass","NuevaClave22");await p.click("#fAuth .primary");await w(p,600);
 T("entró con clave nueva",await p.isVisible("#app"));
 T("sin bienvenida repetida",await p.isHidden("#sheetBack"));
 await p.click('nav.tabs [data-tab="mas"]');await w(p);await p.click("#cOut");await w(p,400);
 // olvidé contraseña con código
 await p.click('[data-paso="olvide"]');await w(p);await p.fill("#aMail","ana@test.co");await p.click("#fAuth .primary");await w(p);
 T("pantalla recuperar",await p.isVisible("#aCode"));
 T("reenviar con espera",(await p.textContent("#aResend")).includes("Reenviar en"));
 await p.fill("#aCode","000000");await p.fill("#aPass","OtraClave33");await p.click("#fAuth .primary");await w(p);
 T("código malo rechazado",(await p.textContent("#authMsg")).includes("no es correcto"));
 await p.fill("#aCode","123456");await p.click("#fAuth .primary");await w(p,600);
 T("recuperó y entró",await p.isVisible("#app")&&await p.evaluate(()=>__mock.store.users["ana@test.co"].password==="OtraClave33"));
 await p.click('nav.tabs [data-tab="mas"]');await w(p);await p.click("#cOut");await w(p,400);
 // entrar con código
 await p.click('[data-paso="codigo-pedir"]');await w(p);await p.fill("#aMail","nadie@test.co");await p.click("#fAuth .primary");await w(p);
 T("código a correo inexistente",(await p.textContent("#authMsg")).includes("No encontramos"));
 await p.fill("#aMail","ana@test.co");await p.click("#fAuth .primary");await w(p);await p.fill("#aCode","123456");await p.click("#fAuth .primary");await w(p,600);
 T("entró con código",await p.isVisible("#app"));
 // eliminar cuenta
 await p.click('nav.tabs [data-tab="mas"]');await w(p);await p.click("#cDel");await p.click("#cDel");await w(p,500);
 T("cuenta eliminada",await p.isVisible("#auth")&&await p.evaluate(()=>!__mock.store.users["ana@test.co"]));
 T("sin errores JS",p.errs.length===0,p.errs.join(" | "));
 await ctx.close();
 // B) Sign-up CON confirmación por código
 ({ctx,p}=await ctxFor(b,{confirm:true}));await p.goto("https://app.test/");await w(p,500);
 await p.click('[data-paso="crear"]');await p.fill("#aMail","beto@test.co");await p.fill("#aPass","ClaveSegura1!");await p.click("#fAuth .primary");await w(p);
 T("pide código de verificación",await p.isVisible("#aCode"));
 await p.fill("#aCode","123456");await p.click("#fAuth .primary");await w(p,600);
 T("verificó y entró",await p.isVisible("#app"));
 T("sin errores JS (B)",p.errs.length===0,p.errs.join(" | "));
 await ctx.close();
 // C) Google visible cuando se activa
 ({ctx,p}=await ctxFor(b));await ctx.route("https://app.test/config.js",r=>r.fulfill({contentType:"text/javascript",body:fs.readFileSync(APP+"/config.js","utf8").replace("google: false","google: true")}));
 await p.goto("https://app.test/");await w(p,500);T("botón Google cuando se activa",await p.isVisible("#aGoogle"));
 await p.click("#aGoogle");await w(p);T("llama a Google",await p.evaluate(()=>__mock.calls.some(c=>c[0]==="oauth"&&c[1]==="google")));
 await ctx.close();await b.close();
})().then(()=>{console.log(fails?`\n${fails} test(s) failed`:"\nAll tests passed");process.exitCode=fails?1:0});
