/* Arranque: service worker y protección contra clickjacking (GitHub Pages no permite el encabezado frame-ancestors). */
"use strict";
if(window.top!==window.self){try{window.top.location=window.self.location}catch(e){document.documentElement.innerHTML=""}}
if("serviceWorker" in navigator)addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));
