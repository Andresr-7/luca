const {chromium}=require("playwright");const fs=require("fs");const path=require("path");
const APP=path.join(__dirname,"..");const seed=require("./seed.js");
exports.launch=()=>chromium.launch(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{});
exports.page=async(b,opts={})=>{
  const ctx=await b.newContext({viewport:opts.vp||{width:390,height:844},deviceScaleFactor:opts.dpr||2,colorScheme:opts.scheme||"light",acceptDownloads:true,locale:opts.locale||"es-CO",timezoneId:"America/Bogota"});
  await ctx.route("**/*",async r=>{const u=new URL(r.request().url());
    if(u.hostname==="app.test"&&u.pathname.startsWith("/vendor/supabase"))return r.fulfill({body:fs.readFileSync(path.join(__dirname,"mock-supabase.js")),contentType:"text/javascript"});
    if(u.hostname==="app.test"){let p=u.pathname==="/"?"/index.html":u.pathname;const f=path.join(APP,decodeURIComponent(p));if(!fs.existsSync(f))return r.fulfill({status:404,body:""});
      const ct={".html":"text/html",".js":"text/javascript",".css":"text/css",".png":"image/png",".svg":"image/svg+xml",".woff2":"font/woff2",".webmanifest":"application/manifest+json"}[path.extname(p)]||"text/plain";
      return r.fulfill({body:fs.readFileSync(f),contentType:ct})}
    if(u.hostname==="cdn.jsdelivr.net")return r.fulfill({body:fs.readFileSync(path.join(__dirname,"mock-supabase.js")),contentType:"text/javascript"});
    if(u.hostname==="www.datos.gov.co")return r.fulfill({body:'[{"valor":"3156.32","vigenciadesde":"2026-10-20T00:00:00.000"}]',contentType:"application/json"});
    return r.abort()});
  const s=seed();
  await ctx.addInitScript(([st,se,lang])=>{if(!sessionStorage.getItem("__seeded")){localStorage.setItem("__mockdb",JSON.stringify(st));localStorage.setItem("__mocksess",JSON.stringify(se));if(lang)localStorage.setItem("luca-idioma",lang);sessionStorage.setItem("__seeded","1")}},[s.store,opts.empty?null:s.sess,opts.lang||null]);
  const p=await ctx.newPage();p.errs=[];p.on("pageerror",e=>p.errs.push(e.message));p.on("console",m=>{if(m.type()==="error")p.errs.push("console: "+m.text())});
  return {ctx,p};
};
let fails=0;
exports.T=(n,ok,x="")=>{if(!ok)fails++;console.log((ok?"PASS":"FAIL")+"  "+n+(x&&!ok?"  — "+x:""))};
exports.done=()=>{console.log(fails?`\n${fails} test(s) failed`:"\nAll tests passed");process.exitCode=fails?1:0};
