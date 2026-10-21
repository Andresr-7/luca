"use strict";
/* Luca — idiomas.
   La app está escrita en español. Para otro idioma, esta capa traduce lo que aparece en pantalla:
   1) frase exacta del diccionario, 2) la misma frase con los números y fechas cambiados por {0}, {1}…,
   3) reglas para frases que llevan nombres (de tarjetas, cuentas…).
   Para agregar un idioma: agrega su código en LANGS y un diccionario igual al de "en" en I18N (archivo i18n-en.js como guía). */
const LANGS={es:"Español",en:"English"};
let LANG=(()=>{try{const s=localStorage.getItem("luca-idioma");if(s&&LANGS[s])return s}catch(e){}return /^es\b|^es-/i.test(navigator.language||"es")?"es":"en"})();
document.documentElement.lang=LANG==="es"?"es-CO":LANG;
const L=(es,en)=>LANG==="en"?en:es;
function setLang(l){try{localStorage.setItem("luca-idioma",l)}catch(e){}location.reload()}
const I18N=window.LUCA_I18N||{};
const I18N_RX=window.LUCA_I18N_RX||{};
const MES_RX="enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|january|february|march|april|may|june|july|august|september|october|november|december";
const ABR_RX="ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic|jan|apr|aug|dec";
const DIA_RX="dom|lun|mar|mié|jue|vie|sáb|sun|mon|tue|wed|thu|fri|sat";
const DIAL_RX="domingo|lunes|martes|miércoles|jueves|viernes|sábado|sunday|monday|tuesday|wednesday|thursday|friday|saturday";
const TOKEN_RX=new RegExp([
  `(?:(?:${DIAL_RX}),? )?\\d{1,2} de (?:${MES_RX})`,                        // jueves 30 de octubre
  `(?:(?:${DIAL_RX}), )?(?:${MES_RX}) \\d{1,2}(?!\\d)`,                    // Thursday, October 30
  `(?:(?:${MES_RX}) (?:de )?\\d{4})`,                                       // Octubre 2026
  `(?:(?:${DIA_RX}) )?\\d{1,2} (?:${ABR_RX})(?![a-záéíóú])`,               // lun 30 oct
  `(?<![A-Za-zÁÉÍÓÚáéíóúñ])(?:${MES_RX})(?![A-Za-zÁÉÍÓÚáéíóúñ])`,         // Octubre
  `(?:−\\s?|-\\s?)?(?:US)?\\$\\s?\\d(?:[\\d.,]*\\d)?`,                       // $ 18.000 · US$ 19,99
  `\\d+(?:[.,]\\d+)*%?`                                                      // 12 · 45%
].join("|"),"gi");
const TR_HECHO=new Set();
function tr(s){
  if(LANG==="es"||s==null)return s;
  const D=I18N[LANG];if(!D)return s;
  const m=/^(\s*)([\s\S]*?)(\s*)$/.exec(String(s));const core=m[2];if(!core||TR_HECHO.has(core))return s;
  let out=D[core];
  if(out==null){const vals=[];const tpl=core.replace(TOKEN_RX,x=>{vals.push(x);return "{"+(vals.length-1)+"}"});
    if(vals.length&&D[tpl]!=null)out=D[tpl].replace(/\{(\d+)\}/g,(_,i)=>vals[+i]??"")}
  if(out==null)for(const [rx,rep] of (I18N_RX[LANG]||[])){if(rx.test(core)){out=core.replace(rx,rep);break}}
  if(out==null&&core.includes(" · ")){const p=core.split(" · ").map(x=>tr(x)).join(" · ");if(p!==core)out=p}
  if(out==null)return s;
  if(TR_HECHO.size>5000)TR_HECHO.clear();TR_HECHO.add(out);return m[1]+out+m[3];
}
const TR_ATTRS=["placeholder","aria-label","title"];
const TR_SKIP=new Set(["SCRIPT","STYLE","TEXTAREA","NOSCRIPT"]);
function trNodo(n){
  if(n.nodeType===3){const p=n.parentNode;if(!p||TR_SKIP.has(p.nodeName)||(p.closest&&p.closest("[data-notr]")))return;
    const v=tr(n.nodeValue);if(v!==n.nodeValue)n.nodeValue=v;return}
  if(n.nodeType!==1||TR_SKIP.has(n.nodeName)||n.hasAttribute("data-notr"))return;
  for(const a of TR_ATTRS)if(n.hasAttribute(a)){const o=n.getAttribute(a),v=tr(o);if(v!==o)n.setAttribute(a,v)}
  for(let c=n.firstChild;c;c=c.nextSibling)trNodo(c);
}
if(LANG!=="es"&&I18N[LANG]){
  document.title=tr(document.title);
  document.querySelectorAll('meta[name="description"],meta[property="og:description"]').forEach(x=>x.setAttribute("content",tr(x.getAttribute("content"))));
  trNodo(document.body);
  new MutationObserver(ms=>{for(const m of ms){
    if(m.type==="childList")m.addedNodes.forEach(trNodo);
    else if(m.type==="characterData")trNodo(m.target);
    else if(m.type==="attributes"){const o=m.target.getAttribute(m.attributeName);if(o!=null){const v=tr(o);if(v!==o)m.target.setAttribute(m.attributeName,v)}}
  }}).observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:TR_ATTRS});
}
