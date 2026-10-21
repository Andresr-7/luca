/* Arranque: service worker y protección contra clickjacking (GitHub Pages no permite el encabezado frame-ancestors). */
"use strict";
if(window.top!==window.self){try{window.top.location=window.self.location}catch(e){document.documentElement.innerHTML=""}}
if("serviceWorker" in navigator)addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));

/* Campos con la misma sensación del código: halo al enfocar, rebote al escribir, temblor si falta algo. */
(()=>{const quieto=()=>matchMedia("(prefers-reduced-motion: reduce)").matches;
  const campo=e=>e&&e.matches&&e.matches("input:not([type=range]):not([type=checkbox]):not([type=radio]):not([type=file]):not(.code-in),select,textarea");
  window.sacudir=c=>{if(!campo(c))return;c.classList.remove("shake");void c.offsetWidth;c.classList.add("shake","bad");
    try{navigator.vibrate&&navigator.vibrate([15,30,15])}catch(_){}};
  document.addEventListener("invalid",e=>sacudir(e.target),true);
  document.addEventListener("input",e=>{const c=e.target;if(!campo(c))return;c.classList.remove("bad");
    if(!quieto()&&c.animate&&c.tagName!=="SELECT")c.animate([{transform:"scale(1.012)"},{transform:"none"}],{duration:220,easing:"cubic-bezier(.3,1.5,.5,1)"})},true);
  document.addEventListener("animationend",e=>{if(e.animationName==="campoShake")e.target.classList.remove("shake")},true);
})();

/* Modo liviano automático para celulares lentos: mide los cuadros por segundo al abrir y lo recuerda. */
(()=>{const h=document.documentElement;let g=null;try{g=localStorage.getItem("luca-lite")}catch(e){}
  const nav=navigator,debil=(nav.deviceMemory&&nav.deviceMemory<=3)||(nav.hardwareConcurrency&&nav.hardwareConcurrency<=4&&/Android/i.test(nav.userAgent))||(nav.connection&&nav.connection.saveData);
  if(g==="1"||(g===null&&debil)){h.classList.add("lite")}
  if(g!==null)return;
  addEventListener("load",()=>setTimeout(()=>{let n=0,t0=performance.now(),lentos=0,prev=t0;
    const f=t=>{const d=t-prev;prev=t;if(d>34)lentos++;n++;if(t-t0<2000)requestAnimationFrame(f);else{const lite=lentos/n>.3||h.classList.contains("lite")&&lentos/n>.15;
      try{localStorage.setItem("luca-lite",lite?"1":"0")}catch(e){}h.classList.toggle("lite",lite)}};requestAnimationFrame(f)},800));
})();
