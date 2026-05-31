const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/auto-C4BfjCME.js","assets/chartjs-C27vgn_K.js"])))=>i.map(i=>d[i]);
import{m as Mr,p as $t}from"./markdown-tu1jyxFx.js";import{c as Dr,f as ds}from"./cytoscape-AhgvwUel.js";(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))a(s);new MutationObserver(s=>{for(const i of s)if(i.type==="childList")for(const o of i.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&a(o)}).observe(document,{childList:!0,subtree:!0});function r(s){const i={};return s.integrity&&(i.integrity=s.integrity),s.referrerPolicy&&(i.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?i.credentials="include":s.crossOrigin==="anonymous"?i.credentials="omit":i.credentials="same-origin",i}function a(s){if(s.ep)return;s.ep=!0;const i=r(s);fetch(s.href,i)}})();const Rr=["system","light","kiro-light","cortado-light","dark","kiro-dark","cortado-dark"],ps="kiro-dark",Lr="ares.theme";function hs(e){return typeof e=="string"&&Rr.includes(e)}function ct(){try{const e=localStorage.getItem(Lr);if(e&&hs(e))return e}catch{}return ps}function us(){try{if(window.matchMedia("(prefers-color-scheme: light)").matches)return"light"}catch{}return"dark"}function vs(e){return e==="system"?us():e}function St(e,t={}){const r=vs(e);if(document.documentElement.setAttribute("data-theme",r),t.persist!==!1)try{localStorage.setItem(Lr,e)}catch{}return document.dispatchEvent(new CustomEvent("ares:theme-changed",{detail:{id:e,resolved:r}})),r}function fs(){const e=ct();St(e,{persist:!1});try{const t=window.matchMedia("(prefers-color-scheme: light)"),r=()=>{ct()==="system"&&St("system",{persist:!1})};typeof t.addEventListener=="function"?t.addEventListener("change",r):t.addListener(r)}catch{}}function gs(e){switch(e){case"system":return"System";case"light":return"Light";case"dark":return"Dark";case"kiro-light":return"Kiro Light";case"kiro-dark":return"Kiro Dark";case"cortado-light":return"Cortado Light";case"cortado-dark":return"Cortado Dark"}}function Zt(e){switch(e){case"system":return"Match macOS appearance";case"light":return"Neutral light";case"dark":return"Neutral dark";case"kiro-light":return"Purple accent on parchment";case"kiro-dark":return"Purple accent on midnight";case"cortado-light":return"Warm beige + caramel";case"cortado-dark":return"Espresso + caramel"}}let Fe=null,Me=null;async function bs(){try{const e=window.ares?.authToken;if(typeof e=="function"){const t=await Promise.resolve(e.call(window.ares));return typeof t=="string"&&t.length>=32?t:null}}catch{}return null}async function ms(){try{const e=await fetch("/api/auth-handshake",{method:"GET",credentials:"same-origin"});if(!e.ok)return null;const t=await e.json();if(typeof t?.token=="string"&&t.token.length>=32)return t.token}catch{}return null}async function Se(){if(Fe)return Fe;if(Me)return Me;Me=(async()=>{const e=await bs();if(e)return Fe=e,e;const t=await ms();return t?(Fe=t,t):null})();try{return await Me}finally{Me=null}}function jr(){Fe=null}class be extends Error{constructor(t,r){super(r),this.name="AuthError",this.status=t}}async function v(e,t={}){const r={...t},a=new Headers(r.headers||{});if(!t.skipAuth){const i=await Se();i&&!a.has("Authorization")&&a.set("Authorization",`Bearer ${i}`)}r.headers=a;let s=await fetch(e,r);if(s.status===401&&!t.skipAuth){jr();const i=await Se();if(i){const o=new Headers(r.headers||{});o.set("Authorization",`Bearer ${i}`),s=await fetch(e,{...r,headers:o})}if(s.status===401)throw new be(401,"Authentication failed — refresh the page")}return s}async function _(e,t){const r=await v(e,t);if(!r.ok)throw new be(r.status,`GET ${e} → ${r.status}`);return r.json()}async function K(e,t,r){const a=new Headers(r?.headers||{});a.set("Content-Type","application/json");const s=await v(e,{...r,method:"POST",headers:a,body:JSON.stringify(t)});if(!s.ok)throw new be(s.status,`POST ${e} → ${s.status}`);if(s.status!==204)return s.json()}async function xs(e,t={}){const r=await v(e,t);if(!r.ok||!r.body)throw new be(r.status,`stream ${e} → ${r.status}`);return r.body}const er=Object.freeze(Object.defineProperty({__proto__:null,AuthError:be,aresFetch:v,clearCachedToken:jr,getAuthToken:Se,getJson:_,openStream:xs,postJson:K},Symbol.toStringTag,{value:"Module"}));/**
 * @license
 * Copyright 2019 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const nt=globalThis,jt=nt.ShadowRoot&&(nt.ShadyCSS===void 0||nt.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,Ft=Symbol(),tr=new WeakMap;let Fr=class{constructor(t,r,a){if(this._$cssResult$=!0,a!==Ft)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=t,this.t=r}get styleSheet(){let t=this.o;const r=this.t;if(jt&&t===void 0){const a=r!==void 0&&r.length===1;a&&(t=tr.get(r)),t===void 0&&((this.o=t=new CSSStyleSheet).replaceSync(this.cssText),a&&tr.set(r,t))}return t}toString(){return this.cssText}};const _s=e=>new Fr(typeof e=="string"?e:e+"",void 0,Ft),y=(e,...t)=>{const r=e.length===1?e[0]:t.reduce((a,s,i)=>a+(o=>{if(o._$cssResult$===!0)return o.cssText;if(typeof o=="number")return o;throw Error("Value passed to 'css' function must be a 'css' function result: "+o+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(s)+e[i+1],e[0]);return new Fr(r,e,Ft)},ys=(e,t)=>{if(jt)e.adoptedStyleSheets=t.map(r=>r instanceof CSSStyleSheet?r:r.styleSheet);else for(const r of t){const a=document.createElement("style"),s=nt.litNonce;s!==void 0&&a.setAttribute("nonce",s),a.textContent=r.cssText,e.appendChild(a)}},rr=jt?e=>e:e=>e instanceof CSSStyleSheet?(t=>{let r="";for(const a of t.cssRules)r+=a.cssText;return _s(r)})(e):e;/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const{is:ws,defineProperty:ks,getOwnPropertyDescriptor:$s,getOwnPropertyNames:Ss,getOwnPropertySymbols:Cs,getPrototypeOf:As}=Object,bt=globalThis,sr=bt.trustedTypes,Es=sr?sr.emptyScript:"",Ts=bt.reactiveElementPolyfillSupport,Ne=(e,t)=>e,dt={toAttribute(e,t){switch(t){case Boolean:e=e?Es:null;break;case Object:case Array:e=e==null?e:JSON.stringify(e)}return e},fromAttribute(e,t){let r=e;switch(t){case Boolean:r=e!==null;break;case Number:r=e===null?null:Number(e);break;case Object:case Array:try{r=JSON.parse(e)}catch{r=null}}return r}},Nt=(e,t)=>!ws(e,t),ar={attribute:!0,type:String,converter:dt,reflect:!1,useDefault:!1,hasChanged:Nt};Symbol.metadata??=Symbol("metadata"),bt.litPropertyMetadata??=new WeakMap;let $e=class extends HTMLElement{static addInitializer(t){this._$Ei(),(this.l??=[]).push(t)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(t,r=ar){if(r.state&&(r.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(t)&&((r=Object.create(r)).wrapped=!0),this.elementProperties.set(t,r),!r.noAccessor){const a=Symbol(),s=this.getPropertyDescriptor(t,a,r);s!==void 0&&ks(this.prototype,t,s)}}static getPropertyDescriptor(t,r,a){const{get:s,set:i}=$s(this.prototype,t)??{get(){return this[r]},set(o){this[r]=o}};return{get:s,set(o){const d=s?.call(this);i?.call(this,o),this.requestUpdate(t,d,a)},configurable:!0,enumerable:!0}}static getPropertyOptions(t){return this.elementProperties.get(t)??ar}static _$Ei(){if(this.hasOwnProperty(Ne("elementProperties")))return;const t=As(this);t.finalize(),t.l!==void 0&&(this.l=[...t.l]),this.elementProperties=new Map(t.elementProperties)}static finalize(){if(this.hasOwnProperty(Ne("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(Ne("properties"))){const r=this.properties,a=[...Ss(r),...Cs(r)];for(const s of a)this.createProperty(s,r[s])}const t=this[Symbol.metadata];if(t!==null){const r=litPropertyMetadata.get(t);if(r!==void 0)for(const[a,s]of r)this.elementProperties.set(a,s)}this._$Eh=new Map;for(const[r,a]of this.elementProperties){const s=this._$Eu(r,a);s!==void 0&&this._$Eh.set(s,r)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(t){const r=[];if(Array.isArray(t)){const a=new Set(t.flat(1/0).reverse());for(const s of a)r.unshift(rr(s))}else t!==void 0&&r.push(rr(t));return r}static _$Eu(t,r){const a=r.attribute;return a===!1?void 0:typeof a=="string"?a:typeof t=="string"?t.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(t=>this.enableUpdating=t),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(t=>t(this))}addController(t){(this._$EO??=new Set).add(t),this.renderRoot!==void 0&&this.isConnected&&t.hostConnected?.()}removeController(t){this._$EO?.delete(t)}_$E_(){const t=new Map,r=this.constructor.elementProperties;for(const a of r.keys())this.hasOwnProperty(a)&&(t.set(a,this[a]),delete this[a]);t.size>0&&(this._$Ep=t)}createRenderRoot(){const t=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return ys(t,this.constructor.elementStyles),t}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(t=>t.hostConnected?.())}enableUpdating(t){}disconnectedCallback(){this._$EO?.forEach(t=>t.hostDisconnected?.())}attributeChangedCallback(t,r,a){this._$AK(t,a)}_$ET(t,r){const a=this.constructor.elementProperties.get(t),s=this.constructor._$Eu(t,a);if(s!==void 0&&a.reflect===!0){const i=(a.converter?.toAttribute!==void 0?a.converter:dt).toAttribute(r,a.type);this._$Em=t,i==null?this.removeAttribute(s):this.setAttribute(s,i),this._$Em=null}}_$AK(t,r){const a=this.constructor,s=a._$Eh.get(t);if(s!==void 0&&this._$Em!==s){const i=a.getPropertyOptions(s),o=typeof i.converter=="function"?{fromAttribute:i.converter}:i.converter?.fromAttribute!==void 0?i.converter:dt;this._$Em=s;const d=o.fromAttribute(r,i.type);this[s]=d??this._$Ej?.get(s)??d,this._$Em=null}}requestUpdate(t,r,a,s=!1,i){if(t!==void 0){const o=this.constructor;if(s===!1&&(i=this[t]),a??=o.getPropertyOptions(t),!((a.hasChanged??Nt)(i,r)||a.useDefault&&a.reflect&&i===this._$Ej?.get(t)&&!this.hasAttribute(o._$Eu(t,a))))return;this.C(t,r,a)}this.isUpdatePending===!1&&(this._$ES=this._$EP())}C(t,r,{useDefault:a,reflect:s,wrapped:i},o){a&&!(this._$Ej??=new Map).has(t)&&(this._$Ej.set(t,o??r??this[t]),i!==!0||o!==void 0)||(this._$AL.has(t)||(this.hasUpdated||a||(r=void 0),this._$AL.set(t,r)),s===!0&&this._$Em!==t&&(this._$Eq??=new Set).add(t))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(r){Promise.reject(r)}const t=this.scheduleUpdate();return t!=null&&await t,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(const[s,i]of this._$Ep)this[s]=i;this._$Ep=void 0}const a=this.constructor.elementProperties;if(a.size>0)for(const[s,i]of a){const{wrapped:o}=i,d=this[s];o!==!0||this._$AL.has(s)||d===void 0||this.C(s,void 0,i,d)}}let t=!1;const r=this._$AL;try{t=this.shouldUpdate(r),t?(this.willUpdate(r),this._$EO?.forEach(a=>a.hostUpdate?.()),this.update(r)):this._$EM()}catch(a){throw t=!1,this._$EM(),a}t&&this._$AE(r)}willUpdate(t){}_$AE(t){this._$EO?.forEach(r=>r.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(t)),this.updated(t)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(t){return!0}update(t){this._$Eq&&=this._$Eq.forEach(r=>this._$ET(r,this[r])),this._$EM()}updated(t){}firstUpdated(t){}};$e.elementStyles=[],$e.shadowRootOptions={mode:"open"},$e[Ne("elementProperties")]=new Map,$e[Ne("finalized")]=new Map,Ts?.({ReactiveElement:$e}),(bt.reactiveElementVersions??=[]).push("2.1.2");/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Bt=globalThis,ir=e=>e,pt=Bt.trustedTypes,or=pt?pt.createPolicy("lit-html",{createHTML:e=>e}):void 0,Nr="$lit$",se=`lit$${Math.random().toFixed(9).slice(2)}$`,Br="?"+se,Is=`<${Br}>`,ve=document,He=()=>ve.createComment(""),Ke=e=>e===null||typeof e!="object"&&typeof e!="function",Ut=Array.isArray,zs=e=>Ut(e)||typeof e?.[Symbol.iterator]=="function",yt=`[ 	
\f\r]`,De=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,nr=/-->/g,lr=/>/g,pe=RegExp(`>|${yt}(?:([^\\s"'>=/]+)(${yt}*=${yt}*(?:[^ 	
\f\r"'\`<>=]|("|')|))|$)`,"g"),cr=/'/g,dr=/"/g,Ur=/^(?:script|style|textarea|title)$/i,Ps=e=>(t,...r)=>({_$litType$:e,strings:t,values:r}),n=Ps(1),Ce=Symbol.for("lit-noChange"),S=Symbol.for("lit-nothing"),pr=new WeakMap,ue=ve.createTreeWalker(ve,129);function qr(e,t){if(!Ut(e)||!e.hasOwnProperty("raw"))throw Error("invalid template strings array");return or!==void 0?or.createHTML(t):t}const Os=(e,t)=>{const r=e.length-1,a=[];let s,i=t===2?"<svg>":t===3?"<math>":"",o=De;for(let d=0;d<r;d++){const c=e[d];let p,h,u=-1,$=0;for(;$<c.length&&(o.lastIndex=$,h=o.exec(c),h!==null);)$=o.lastIndex,o===De?h[1]==="!--"?o=nr:h[1]!==void 0?o=lr:h[2]!==void 0?(Ur.test(h[2])&&(s=RegExp("</"+h[2],"g")),o=pe):h[3]!==void 0&&(o=pe):o===pe?h[0]===">"?(o=s??De,u=-1):h[1]===void 0?u=-2:(u=o.lastIndex-h[2].length,p=h[1],o=h[3]===void 0?pe:h[3]==='"'?dr:cr):o===dr||o===cr?o=pe:o===nr||o===lr?o=De:(o=pe,s=void 0);const x=o===pe&&e[d+1].startsWith("/>")?" ":"";i+=o===De?c+Is:u>=0?(a.push(p),c.slice(0,u)+Nr+c.slice(u)+se+x):c+se+(u===-2?d:x)}return[qr(e,i+(e[r]||"<?>")+(t===2?"</svg>":t===3?"</math>":"")),a]};class Qe{constructor({strings:t,_$litType$:r},a){let s;this.parts=[];let i=0,o=0;const d=t.length-1,c=this.parts,[p,h]=Os(t,r);if(this.el=Qe.createElement(p,a),ue.currentNode=this.el.content,r===2||r===3){const u=this.el.content.firstChild;u.replaceWith(...u.childNodes)}for(;(s=ue.nextNode())!==null&&c.length<d;){if(s.nodeType===1){if(s.hasAttributes())for(const u of s.getAttributeNames())if(u.endsWith(Nr)){const $=h[o++],x=s.getAttribute(u).split(se),T=/([.?@])?(.*)/.exec($);c.push({type:1,index:i,name:T[2],strings:x,ctor:T[1]==="."?Ds:T[1]==="?"?Rs:T[1]==="@"?Ls:mt}),s.removeAttribute(u)}else u.startsWith(se)&&(c.push({type:6,index:i}),s.removeAttribute(u));if(Ur.test(s.tagName)){const u=s.textContent.split(se),$=u.length-1;if($>0){s.textContent=pt?pt.emptyScript:"";for(let x=0;x<$;x++)s.append(u[x],He()),ue.nextNode(),c.push({type:2,index:++i});s.append(u[$],He())}}}else if(s.nodeType===8)if(s.data===Br)c.push({type:2,index:i});else{let u=-1;for(;(u=s.data.indexOf(se,u+1))!==-1;)c.push({type:7,index:i}),u+=se.length-1}i++}}static createElement(t,r){const a=ve.createElement("template");return a.innerHTML=t,a}}function Ae(e,t,r=e,a){if(t===Ce)return t;let s=a!==void 0?r._$Co?.[a]:r._$Cl;const i=Ke(t)?void 0:t._$litDirective$;return s?.constructor!==i&&(s?._$AO?.(!1),i===void 0?s=void 0:(s=new i(e),s._$AT(e,r,a)),a!==void 0?(r._$Co??=[])[a]=s:r._$Cl=s),s!==void 0&&(t=Ae(e,s._$AS(e,t.values),s,a)),t}class Ms{constructor(t,r){this._$AV=[],this._$AN=void 0,this._$AD=t,this._$AM=r}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(t){const{el:{content:r},parts:a}=this._$AD,s=(t?.creationScope??ve).importNode(r,!0);ue.currentNode=s;let i=ue.nextNode(),o=0,d=0,c=a[0];for(;c!==void 0;){if(o===c.index){let p;c.type===2?p=new Xe(i,i.nextSibling,this,t):c.type===1?p=new c.ctor(i,c.name,c.strings,this,t):c.type===6&&(p=new js(i,this,t)),this._$AV.push(p),c=a[++d]}o!==c?.index&&(i=ue.nextNode(),o++)}return ue.currentNode=ve,s}p(t){let r=0;for(const a of this._$AV)a!==void 0&&(a.strings!==void 0?(a._$AI(t,a,r),r+=a.strings.length-2):a._$AI(t[r])),r++}}class Xe{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(t,r,a,s){this.type=2,this._$AH=S,this._$AN=void 0,this._$AA=t,this._$AB=r,this._$AM=a,this.options=s,this._$Cv=s?.isConnected??!0}get parentNode(){let t=this._$AA.parentNode;const r=this._$AM;return r!==void 0&&t?.nodeType===11&&(t=r.parentNode),t}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(t,r=this){t=Ae(this,t,r),Ke(t)?t===S||t==null||t===""?(this._$AH!==S&&this._$AR(),this._$AH=S):t!==this._$AH&&t!==Ce&&this._(t):t._$litType$!==void 0?this.$(t):t.nodeType!==void 0?this.T(t):zs(t)?this.k(t):this._(t)}O(t){return this._$AA.parentNode.insertBefore(t,this._$AB)}T(t){this._$AH!==t&&(this._$AR(),this._$AH=this.O(t))}_(t){this._$AH!==S&&Ke(this._$AH)?this._$AA.nextSibling.data=t:this.T(ve.createTextNode(t)),this._$AH=t}$(t){const{values:r,_$litType$:a}=t,s=typeof a=="number"?this._$AC(t):(a.el===void 0&&(a.el=Qe.createElement(qr(a.h,a.h[0]),this.options)),a);if(this._$AH?._$AD===s)this._$AH.p(r);else{const i=new Ms(s,this),o=i.u(this.options);i.p(r),this.T(o),this._$AH=i}}_$AC(t){let r=pr.get(t.strings);return r===void 0&&pr.set(t.strings,r=new Qe(t)),r}k(t){Ut(this._$AH)||(this._$AH=[],this._$AR());const r=this._$AH;let a,s=0;for(const i of t)s===r.length?r.push(a=new Xe(this.O(He()),this.O(He()),this,this.options)):a=r[s],a._$AI(i),s++;s<r.length&&(this._$AR(a&&a._$AB.nextSibling,s),r.length=s)}_$AR(t=this._$AA.nextSibling,r){for(this._$AP?.(!1,!0,r);t!==this._$AB;){const a=ir(t).nextSibling;ir(t).remove(),t=a}}setConnected(t){this._$AM===void 0&&(this._$Cv=t,this._$AP?.(t))}}class mt{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(t,r,a,s,i){this.type=1,this._$AH=S,this._$AN=void 0,this.element=t,this.name=r,this._$AM=s,this.options=i,a.length>2||a[0]!==""||a[1]!==""?(this._$AH=Array(a.length-1).fill(new String),this.strings=a):this._$AH=S}_$AI(t,r=this,a,s){const i=this.strings;let o=!1;if(i===void 0)t=Ae(this,t,r,0),o=!Ke(t)||t!==this._$AH&&t!==Ce,o&&(this._$AH=t);else{const d=t;let c,p;for(t=i[0],c=0;c<i.length-1;c++)p=Ae(this,d[a+c],r,c),p===Ce&&(p=this._$AH[c]),o||=!Ke(p)||p!==this._$AH[c],p===S?t=S:t!==S&&(t+=(p??"")+i[c+1]),this._$AH[c]=p}o&&!s&&this.j(t)}j(t){t===S?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,t??"")}}class Ds extends mt{constructor(){super(...arguments),this.type=3}j(t){this.element[this.name]=t===S?void 0:t}}class Rs extends mt{constructor(){super(...arguments),this.type=4}j(t){this.element.toggleAttribute(this.name,!!t&&t!==S)}}class Ls extends mt{constructor(t,r,a,s,i){super(t,r,a,s,i),this.type=5}_$AI(t,r=this){if((t=Ae(this,t,r,0)??S)===Ce)return;const a=this._$AH,s=t===S&&a!==S||t.capture!==a.capture||t.once!==a.once||t.passive!==a.passive,i=t!==S&&(a===S||s);s&&this.element.removeEventListener(this.name,this,a),i&&this.element.addEventListener(this.name,this,t),this._$AH=t}handleEvent(t){typeof this._$AH=="function"?this._$AH.call(this.options?.host??this.element,t):this._$AH.handleEvent(t)}}class js{constructor(t,r,a){this.element=t,this.type=6,this._$AN=void 0,this._$AM=r,this.options=a}get _$AU(){return this._$AM._$AU}_$AI(t){Ae(this,t)}}const Fs=Bt.litHtmlPolyfillSupport;Fs?.(Qe,Xe),(Bt.litHtmlVersions??=[]).push("3.3.3");const Ns=(e,t,r)=>{const a=r?.renderBefore??t;let s=a._$litPart$;if(s===void 0){const i=r?.renderBefore??null;a._$litPart$=s=new Xe(t.insertBefore(He(),i),i,void 0,r??{})}return s._$AI(e),s};/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const qt=globalThis;let m=class extends $e{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){const t=super.createRenderRoot();return this.renderOptions.renderBefore??=t.firstChild,t}update(t){const r=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(t),this._$Do=Ns(r,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return Ce}};m._$litElement$=!0,m.finalized=!0,qt.litElementHydrateSupport?.({LitElement:m});const Bs=qt.litElementPolyfillSupport;Bs?.({LitElement:m});(qt.litElementVersions??=[]).push("4.2.2");/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const w=e=>(t,r)=>{r!==void 0?r.addInitializer(()=>{customElements.define(e,t)}):customElements.define(e,t)};/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Us={attribute:!0,type:String,converter:dt,reflect:!1,hasChanged:Nt},qs=(e=Us,t,r)=>{const{kind:a,metadata:s}=r;let i=globalThis.litPropertyMetadata.get(s);if(i===void 0&&globalThis.litPropertyMetadata.set(s,i=new Map),a==="setter"&&((e=Object.create(e)).wrapped=!0),i.set(r.name,e),a==="accessor"){const{name:o}=r;return{set(d){const c=t.get.call(this);t.set.call(this,d),this.requestUpdate(o,c,e,!0,d)},init(d){return d!==void 0&&this.C(o,void 0,e,d),d}}}if(a==="setter"){const{name:o}=r;return function(d){const c=this[o];t.call(this,d),this.requestUpdate(o,c,e,!0,d)}}throw Error("Unsupported decorator location: "+a)};function E(e){return(t,r)=>typeof r=="object"?qs(e,t,r):((a,s,i)=>{const o=s.hasOwnProperty(i);return s.constructor.createProperty(i,a),o?Object.getOwnPropertyDescriptor(s,i):void 0})(e,t,r)}/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */function l(e){return E({...e,state:!0,attribute:!1})}/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Hs=(e,t,r)=>(r.configurable=!0,r.enumerable=!0,Reflect.decorate&&typeof t!="object"&&Object.defineProperty(e,t,r),r);/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */function Ht(e,t){return(r,a,s)=>{const i=o=>o.renderRoot?.querySelector(e)??null;return Hs(r,a,{get(){return i(this)}})}}const Ks=new Set(["chat","activity-feed","capabilities","my-computer","my-stuff","my-context","customization","jobs"]),Qs=new Set(["connections","skills","scheduled-tasks","mcp","system","bugs"]),Ct={top:"chat",sub:null};function Hr(e){const r=e.split("?")[0].replace(/^#?\/?/,"");if(!r)return Ct;const[a,s]=r.split("/",2);return Ks.has(a)?a==="capabilities"?s&&!Qs.has(s)?{top:"capabilities",sub:"connections"}:{top:"capabilities",sub:s??"connections"}:{top:a,sub:s??null}:Ct}function Kr(e){return e.sub?`#/${e.top}/${e.sub}`:`#/${e.top}`}function Ve(){return Hr(window.location.hash)}const At=new Set;function Qr(e){return At.add(e),()=>{At.delete(e)}}function Kt(e){for(const t of At)try{t(e)}catch(r){console.error("[router] listener threw:",r)}}function I(e,t={}){const r=Kr(e);window.location.hash!==r&&(t.replace?history.replaceState(null,"",r):history.pushState(null,"",r),Kt(e))}window.addEventListener("hashchange",()=>Kt(Ve()));window.addEventListener("popstate",()=>Kt(Ve()));const Vs=Object.freeze(Object.defineProperty({__proto__:null,DEFAULT_ROUTE:Ct,currentRoute:Ve,formatRoute:Kr,navigate:I,parseRoute:Hr,subscribe:Qr},Symbol.toStringTag,{value:"Module"}));var Ws=Object.defineProperty,Ze=(e,t,r,a)=>{for(var s=void 0,i=e.length-1,o;i>=0;i--)(o=e[i])&&(s=o(t,r,s)||s);return s&&Ws(t,r,s),s};class me extends m{constructor(){super(...arguments),this.items=[],this.rowHeight=36,this.overscan=8,this._scrollTop=0,this._viewportHeight=0,this._onScroll=()=>{this._scrollTop=this.scrollTop}}static{this.styles=y`
    :host {
      display: block;
      height: 100%;
      overflow-y: auto;
      overflow-x: hidden;
      contain: strict;
    }
    .spacer { width: 1px; }
    .window {
      position: relative;
      width: 100%;
    }
    .row {
      position: absolute;
      left: 0;
      right: 0;
      height: var(--row-h, 36px);
      box-sizing: border-box;
      will-change: transform;
    }
  `}connectedCallback(){super.connectedCallback(),this.addEventListener("scroll",this._onScroll,{passive:!0}),this._ro=new ResizeObserver(()=>{this._viewportHeight=this.clientHeight}),this._ro.observe(this)}disconnectedCallback(){super.disconnectedCallback(),this.removeEventListener("scroll",this._onScroll),this._ro?.disconnect(),this._ro=void 0}render(){const t=this.rowHeight,r=this.items.length,a=r*t,s=this._viewportHeight||this.clientHeight||480,i=Math.max(0,Math.floor(this._scrollTop/t)-this.overscan),o=Math.min(r,Math.ceil((this._scrollTop+s)/t)+this.overscan),d=[];for(let c=i;c<o;c++)d.push({item:this.items[c],index:c});return n`
      <div class="window" style="height:${a}px;">
        ${d.map(({item:c,index:p})=>n`
          <div
            class="row"
            style="--row-h:${t}px; transform: translateY(${p*t}px);"
            data-id=${c.id}
          >
            ${this.renderRow(c,p)}
          </div>
        `)}
      </div>
    `}}Ze([E({type:Array})],me.prototype,"items");Ze([E({type:Number})],me.prototype,"rowHeight");Ze([E({type:Number})],me.prototype,"overscan");Ze([l()],me.prototype,"_scrollTop");Ze([l()],me.prototype,"_viewportHeight");let Ee=[],at=null,Re=0;const Et=new Set;function Gs(){for(const e of Et)try{e(Ee)}catch(t){console.error("[sessions] listener threw:",t)}}function Ys(){return Ee}async function Be(){try{const e=await _("/api/sessions");Array.isArray(e)&&(Ee=e,Gs())}catch(e){console.warn("[sessions] refresh failed:",e.message)}return Ee}function Vr(e,t={}){if(Et.add(e),Re++,Ee.length&&e(Ee),Re===1){Be();const r=t.intervalMs??1e3;at=setInterval(()=>{document.visibilityState==="visible"&&Be()},r)}return()=>{Et.delete(e),Re=Math.max(0,Re-1),Re===0&&at&&(clearInterval(at),at=null)}}var Js=Object.defineProperty,Xs=Object.getOwnPropertyDescriptor,Pe=(e,t,r,a)=>{for(var s=a>1?void 0:a?Xs(t,r):t,i=e.length-1,o;i>=0;i--)(o=e[i])&&(s=(a?o(t,r,s):o(s))||s);return a&&s&&Js(t,r,s),s};let ae=class extends m{constructor(){super(...arguments),this.items=[],this.glyph="⋯",this.title="More actions",this._open=!1,this._menuPos=null,this._onDocClick=e=>{if(!this._open)return;const t=e.composedPath();t.includes(this)||this._portalEl&&t.includes(this._portalEl)||this._closeMenu()},this._onKey=e=>{e.key==="Escape"&&this._closeMenu()},this._toggleMenu=e=>{if(e.stopPropagation(),this._open){this._closeMenu();return}const t=e.currentTarget.getBoundingClientRect(),r=180,a=Math.min(this.items.length*32+8,320);let s=t.bottom+4,i=t.right-r;s+a>window.innerHeight-8&&(s=t.top-a-4),i<8&&(i=8),i+r>window.innerWidth-8&&(i=window.innerWidth-r-8),this._menuPos={top:s,left:i},this._open=!0,requestAnimationFrame(()=>this._mountPortal())},this._portalEl=null,this._onPortalScroll=()=>{this._closeMenu()}}_closeMenu(){this._open=!1,this._unmountPortal()}_mountPortal(){if(!this._open||!this._menuPos)return;this._unmountPortal();const e=document.createElement("div");e.setAttribute("role","menu"),Object.assign(e.style,{position:"fixed",top:`${this._menuPos.top}px`,left:`${this._menuPos.left}px`,minWidth:"180px",background:"var(--panel, #1c1c22)",border:"1px solid var(--border, #333)",borderRadius:"var(--radius-2, 8px)",boxShadow:"0 8px 24px rgba(0,0,0,0.5)",padding:"4px",zIndex:"100000",display:"flex",flexDirection:"column",gap:"1px",font:"12.5px var(--font-ui, system-ui, sans-serif)"});for(const t of this.items){const r=document.createElement("button");r.textContent=(t.icon?`${t.icon}  `:"")+t.label,Object.assign(r.style,{all:"unset",cursor:t.disabled?"not-allowed":"pointer",padding:"6px 10px",borderRadius:"var(--radius-1, 6px)",color:t.kind==="destructive"?"var(--err, #e5484d)":"var(--text-1, #ddd)",opacity:t.disabled?"0.45":"1",display:"block",whiteSpace:"nowrap"}),t.disabled||(r.addEventListener("mouseenter",()=>{r.style.background="var(--panel-2, #2a2a32)"}),r.addEventListener("mouseleave",()=>{r.style.background="transparent"}),r.addEventListener("click",a=>{a.stopPropagation(),this._closeMenu(),this.dispatchEvent(new CustomEvent("overflow-action",{detail:{id:t.id},bubbles:!0,composed:!0}))})),e.appendChild(r)}document.body.appendChild(e),this._portalEl=e,window.addEventListener("scroll",this._onPortalScroll,!0)}_unmountPortal(){if(this._portalEl){try{this._portalEl.remove()}catch{}this._portalEl=null}window.removeEventListener("scroll",this._onPortalScroll,!0)}connectedCallback(){super.connectedCallback()}disconnectedCallback(){super.disconnectedCallback(),this._removeDocListeners(),this._unmountPortal()}updated(e){e.has("_open")&&(this._open?this._addDocListeners():this._removeDocListeners())}_addDocListeners(){document.addEventListener("click",this._onDocClick,!0),document.addEventListener("keydown",this._onKey)}_removeDocListeners(){document.removeEventListener("click",this._onDocClick,!0),document.removeEventListener("keydown",this._onKey)}render(){return n`
      <button
        class="trigger ${this._open?"open":""}"
        title=${this.title}
        @click=${this._toggleMenu}
        aria-haspopup="menu"
        aria-expanded=${this._open?"true":"false"}
      >${this.glyph}</button>
    `}};ae.styles=y`
    :host { display: inline-block; position: relative; }
    .trigger {
      all: unset;
      cursor: pointer;
      width: 24px; height: 24px;
      display: grid; place-items: center;
      border-radius: 50%;
      color: var(--text-3);
      font-size: 13px;
      transition: background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out);
    }
    .trigger:hover { background: var(--panel-2); color: var(--text-0); }
    .trigger.open { background: var(--panel-2); color: var(--text-0); }
  `;Pe([E({type:Array})],ae.prototype,"items",2);Pe([E({type:String})],ae.prototype,"glyph",2);Pe([E({type:String})],ae.prototype,"title",2);Pe([l()],ae.prototype,"_open",2);Pe([l()],ae.prototype,"_menuPos",2);ae=Pe([w("ares-overflow-menu")],ae);const Tt="ares:toast";let hr=0;function Zs(){try{if(typeof crypto<"u"&&typeof crypto.randomUUID=="function")return`t-${crypto.randomUUID()}`}catch{}return hr+=1,`t-${Date.now()}-${hr}`}function C(e){const t=e.id||Zs(),r=typeof e.durationMs=="number"?Math.max(0,e.durationMs):4e3,a={id:t,variant:e.variant,title:e.title,body:e.body,durationMs:r};return typeof document<"u"&&document.dispatchEvent(new CustomEvent(Tt,{detail:a})),t}const ur="ares:toast-dismiss";var ea=Object.defineProperty,ta=Object.getOwnPropertyDescriptor,Wr=(e,t,r,a)=>{for(var s=a>1?void 0:a?ta(t,r):t,i=e.length-1,o;i>=0;i--)(o=e[i])&&(s=(a?o(t,r,s):o(s))||s);return a&&s&&ea(t,r,s),s};function vr(e){if(!e.length)return[];const t=new Map;for(const o of e)t.set(o.id,o);const r=new Map,a=[];for(const o of e){const d=o.branchedFrom?.parentSessionId;if(d&&t.has(d)){const c=r.get(d)||[];c.push(o),r.set(d,c)}else a.push(o)}const s=[],i=(o,d)=>{s.push({...o,_depth:d});const c=r.get(o.id);if(c&&c.length){c.sort((p,h)=>(h.updatedAt||0)-(p.updatedAt||0));for(const p of c)i(p,d+1)}};for(const o of a)i(o,0);return s}let ie=class extends me{constructor(){super(...arguments),this.selectedId=null,this.rowHeight=32,this._unsubscribe=null}connectedCallback(){super.connectedCallback(),this._unsubscribe=Vr(e=>{this.items=vr(e),this.requestUpdate()}),this.items=vr(Ys())}disconnectedCallback(){super.disconnectedCallback(),this._unsubscribe?.(),this._unsubscribe=null}renderRow(e){const t=e.id===this.selectedId,r=e.streamActive?"streaming":e.pinned?"pinned":"",a=Math.min(e._depth||0,3),s=a>0?` branch-${a}`:"";return n`
      <div
        class="session-row${s} ${t?"active":""}"
        title=${e.title}
        @click=${()=>this._openSession(e.id)}
      >
        ${r?n`<span class="dot ${r}"></span>`:null}
        ${e.branchedFrom?n`<span class="branch-glyph" title="Branched session">↪</span>`:null}
        ${e._mode==="dev"?n`<span class="dev-chip">DEV</span>`:null}
        <span class="title">${e.title||"Untitled"}</span>
        <ares-overflow-menu
          .items=${this._menuItems(e.pinned)}
          @overflow-action=${i=>this._onRowAction(i,e)}
          @click=${i=>i.stopPropagation()}
        ></ares-overflow-menu>
      </div>
    `}render(){return this.items.length?super.render():n`<div class="empty">No conversations yet.</div>`}_menuItems(e){return e?ie._MENU_PINNED:ie._MENU_UNPINNED}_openSession(e){this.dispatchEvent(new CustomEvent("session-selected",{detail:{id:e},bubbles:!0,composed:!0}))}async _onRowAction(e,t){const a=e.detail?.id;if(a)try{switch(a){case"rename":{const s=window.prompt("Rename session",t.title||"Untitled");if(!s||s.trim()===t.title)return;await v(`/api/sessions/${t.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({title:s.trim()})}),C({variant:"info",title:"Renamed"});break}case"pin":{await v(`/api/sessions/${t.id}/pin`,{method:"POST"});break}case"duplicate":{const i=await(await v(`/api/sessions/${t.id}/duplicate`,{method:"POST"})).json?.();i?.ok&&i.sessionId?(C({variant:"info",title:"Duplicated",body:i.title||""}),this.dispatchEvent(new CustomEvent("session-selected",{detail:{id:i.sessionId},bubbles:!0,composed:!0}))):C({variant:"warn",title:"Duplicate failed",body:i?.error||""});break}case"export":{try{const s=await v(`/api/sessions/${t.id}/export?format=sharegpt`);if(!s.ok)throw new Error(`HTTP ${s.status}`);const i=await s.blob(),o=URL.createObjectURL(i),d=(t.title||"session").slice(0,60).replace(/[^a-z0-9]+/gi,"-").replace(/^-+|-+$/g,"").toLowerCase()||"session",c=document.createElement("a");c.href=o,c.download=`${d}-${t.id.slice(0,8)}.sharegpt.json`,document.body.appendChild(c),c.click(),c.remove(),setTimeout(()=>URL.revokeObjectURL(o),1e3),C({variant:"info",title:"Exported",body:"Saved to Downloads"})}catch(s){C({variant:"danger",title:"Export failed",body:s?.message||String(s)})}break}case"delete":{if(!confirm(`Delete "${t.title||"Untitled"}"?`))return;await v(`/api/sessions/${t.id}`,{method:"DELETE"}),C({variant:"info",title:"Deleted"});break}}}catch(s){C({variant:"danger",title:"Action failed",body:s?.message||String(s)})}}};ie.styles=[me.styles,y`
      :host { font-size: 12.5px; }
      .session-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 0 10px;
        border-radius: var(--radius-1);
        cursor: pointer;
        color: var(--text-2);
        line-height: 32px;
        transition: background var(--dur-fast) var(--ease-out);
      }
      .session-row:hover {
        background: var(--panel-2);
        color: var(--text-1);
      }
      .session-row.active {
        background: color-mix(in srgb, var(--accent) 22%, transparent);
        color: var(--text-0);
      }
      .session-row .title {
        flex: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      /* Q-pass-5 P2-4 — overflow trigger reveals on row hover. */
      .session-row ares-overflow-menu {
        opacity: 0;
        transition: opacity var(--dur-fast) var(--ease-out);
        flex-shrink: 0;
      }
      .session-row:hover ares-overflow-menu,
      .session-row.active ares-overflow-menu { opacity: 1; }
      .dot {
        width: 6px; height: 6px; border-radius: 50%;
        flex-shrink: 0;
      }
      .dot.streaming { background: var(--ok); box-shadow: 0 0 6px color-mix(in srgb, var(--ok) 60%, transparent); }
      .dot.pinned    { background: var(--warn); }
      /* Dev-mode badge chip in the recents list. */
      .dev-chip {
        flex-shrink: 0;
        padding: 1px 5px;
        border-radius: 3px;
        background: color-mix(in srgb, var(--accent) 18%, transparent);
        color: var(--accent);
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        line-height: 14px;
      }
      /* Q-pass-5 P1-1 — branched session indicator. */
      .branch-glyph {
        flex-shrink: 0;
        color: var(--text-3);
        font-size: 11px;
        padding-left: 2px;
      }
      /* Q-pass-5 close-out — branch tree rail. The 12px indent + thin
         vertical rule make the parent/child relationship readable at a
         glance. Subtle by design — branches stay scannable in the
         dock. */
      .session-row.branch-1 { padding-left: 22px; position: relative; }
      .session-row.branch-2 { padding-left: 34px; position: relative; }
      .session-row.branch-3 { padding-left: 46px; position: relative; }
      .session-row[class*="branch-"]::before {
        content: '';
        position: absolute;
        top: 0; bottom: 0;
        left: 14px;
        width: 1px;
        background: color-mix(in srgb, var(--text-3) 38%, transparent);
        pointer-events: none;
      }
      .session-row.branch-2::before { left: 26px; }
      .session-row.branch-3::before { left: 38px; }
      .empty {
        padding: 16px 12px;
        color: var(--text-3);
        font-size: 12px;
      }
    `];ie._MENU_PINNED=[{id:"rename",label:"Rename",icon:"✎"},{id:"pin",label:"Unpin",icon:"📌"},{id:"duplicate",label:"Duplicate",icon:"⎘"},{id:"export",label:"Export to ShareGPT",icon:"↗"},{id:"delete",label:"Delete",icon:"🗑",kind:"destructive"}];ie._MENU_UNPINNED=[{id:"rename",label:"Rename",icon:"✎"},{id:"pin",label:"Pin",icon:"📌"},{id:"duplicate",label:"Duplicate",icon:"⎘"},{id:"export",label:"Export to ShareGPT",icon:"↗"},{id:"delete",label:"Delete",icon:"🗑",kind:"destructive"}];Wr([E({type:String})],ie.prototype,"selectedId",2);ie=Wr([w("ares-recents-list")],ie);let Ue=null,it=null,Le=0;const It=new Set;async function fr(){try{Ue=await _("/api/health");for(const e of It)try{e(Ue)}catch(t){console.error("[health] listener:",t)}}catch(e){console.warn("[health] refresh failed:",e.message)}return Ue}function Qt(e,t={}){if(It.add(e),Le++,Ue&&e(Ue),Le===1){fr();const r=t.intervalMs??1e3;it=setInterval(()=>{document.visibilityState==="visible"&&fr()},r)}return()=>{It.delete(e),Le=Math.max(0,Le-1),Le===0&&it&&(clearInterval(it),it=null)}}const lt=new Map,zt=new Map;function Pt(e){return`ares.prompt-queue.${e}`}function oe(e){const t=zt.get(e);if(t)return t;let r=[];try{const a=localStorage.getItem(Pt(e));if(a){const s=JSON.parse(a);Array.isArray(s)&&s.every(i=>typeof i=="string")&&(r=s)}}catch{}return zt.set(e,r),r}function Te(e,t){zt.set(e,t);try{t.length===0?localStorage.removeItem(Pt(e)):localStorage.setItem(Pt(e),JSON.stringify(t))}catch{}const r=lt.get(e);if(r)for(const a of r)try{a([...t])}catch(s){console.error("[prompt-queue] listener:",s)}}function et(e,t){const r=t.trim();if(!r)return;const a=[...oe(e),r];Te(e,a)}function ra(e){const t=oe(e);return t.length>0?t[0]:null}function sa(e){const t=oe(e);if(t.length===0)return null;const[r,...a]=t;return Te(e,a),r}function aa(e,t){const r=oe(e);if(t<0||t>=r.length)return;const a=[...r.slice(0,t),...r.slice(t+1)];Te(e,a)}function ia(e){Te(e,[])}function oa(e,t){if(e===t)return;const r=oe(e);if(r.length===0)return;const a=oe(t);Te(t,[...a,...r]),Te(e,[])}function na(e){return oe(e).length}function la(e,t){let r=lt.get(e);return r||(r=new Set,lt.set(e,r)),r.add(t),t([...oe(e)]),()=>{r?.delete(t),r&&r.size===0&&lt.delete(e)}}var ca=Object.defineProperty,da=Object.getOwnPropertyDescriptor,Vt=(e,t,r,a)=>{for(var s=a>1?void 0:a?da(t,r):t,i=e.length-1,o;i>=0;i--)(o=e[i])&&(s=(a?o(t,r,s):o(s))||s);return a&&s&&ca(t,r,s),s};const Ot=[{id:"web-search",label:"Web Search",description:"Search the internet for current information",icon:"W",default:!0},{id:"file-ops",label:"File operations",description:"Download files, open files, and write files to disk",icon:"F",default:!0},{id:"browser-automation",label:"Browser Automation",description:"Browse and interact with web pages using Chrome",icon:"B",default:!0},{id:"quick-web",label:"Quick Web",description:"Search spaces, list documents, dashboards, and topics",icon:"Q",default:!1},{id:"image-generation",label:"Image Generation",description:"Create and edit images with Company Nova Canvas",icon:"I",default:!1},{id:"code-execution",label:"Code Execution",description:"Run Python code for calculations, analysis, and automation",icon:"C",default:!0},{id:"engram-builder",label:"Engram Builder",description:"Build personality engrams from messages for writing style cloning",icon:"E",default:!0},{id:"knowledge-memory",label:"Knowledge & Memory",description:"Query structured knowledge, build graphs, and recall learned patterns",icon:"K",default:!0},{id:"scheduled-tasks",label:"Scheduled Task Management",description:"Create and manage scheduled tasks for recurring monitoring",icon:"S",default:!0},{id:"task-management",label:"Task Management",description:"Spawn sub-tasks, manage parallel work, and orchestrate workflows",icon:"T",default:!0},{id:"chat-notifications",label:"Chat & Notifications",description:"Message reactions, suggestion pills, notifications, and briefings",icon:"N",default:!0}],Gr="ares.system-caps";function Yr(){try{const e=localStorage.getItem(Gr);if(e)return JSON.parse(e)}catch{}return{}}function pa(e){try{localStorage.setItem(Gr,JSON.stringify(e))}catch{}}function ha(e){const t=Yr();return e in t?t[e]:Ot.find(a=>a.id===e)?.default??!1}let We=class extends m{constructor(){super(...arguments),this._state=Yr(),this._permModalFor=null}_isOn(e){return e in this._state?this._state[e]:Ot.find(t=>t.id===e)?.default??!1}_toggle(e){const t={...this._state,[e]:!this._isOn(e)};this._state=t,pa(t),document.dispatchEvent(new CustomEvent("ares:system-cap-changed",{detail:{id:e,value:t[e]}}))}render(){return n`
      <div class="grid">
        ${Ot.map(e=>n`
          <div class="card">
            <div class="icon-tile">${e.icon}</div>
            <div class="info">
              <div class="label">${e.label}</div>
              <div class="desc">${e.description}</div>
            </div>
            <button class="perm-btn" @click=${()=>{this._permModalFor=e}}>Manage permissions</button>
            <div class="toggle ${this._isOn(e.id)?"on":""}" @click=${()=>this._toggle(e.id)}>
              <div class="knob"></div>
            </div>
          </div>
        `)}
      </div>
      ${this._permModalFor?n`
        <div class="modal-overlay" @click=${()=>{this._permModalFor=null}}>
          <div class="modal" @click=${e=>e.stopPropagation()}>
            <h2>Manage permissions — ${this._permModalFor.label}</h2>
            <p>Granular permission rules — coming in a follow-up phase.</p>
            <p style="color: var(--text-3); font-size: 11.5px;">
              Today this card is a single on/off switch. The follow-up phase ships per-tool
              policies (always-allow / ask / deny) plus a "high-risk only" preset.
            </p>
            <div class="modal-actions">
              <button class="modal-btn" @click=${()=>{this._permModalFor=null}}>OK</button>
            </div>
          </div>
        </div>
      `:""}
    `}};We.styles=y`
    :host { display: block; }
    .grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 10px;
    }
    .card {
      display: flex; align-items: center; gap: 14px;
      padding: 14px 16px;
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: var(--radius-2);
    }
    .icon-tile {
      width: 38px; height: 38px;
      flex-shrink: 0;
      border-radius: var(--radius-2);
      background: color-mix(in srgb, var(--accent) 18%, var(--panel-2));
      color: var(--accent-soft);
      display: flex; align-items: center; justify-content: center;
      font-size: 16px; font-weight: 600;
    }
    .info { flex: 1; min-width: 0; }
    .label {
      color: var(--text-0); font-weight: 500; font-size: 13.5px;
    }
    .desc {
      color: var(--text-3); font-size: 12px; margin-top: 3px;
      line-height: 1.4;
    }
    .perm-btn {
      all: unset; cursor: pointer;
      padding: 5px 12px;
      border: 1px solid var(--border-2);
      border-radius: var(--radius-2);
      color: var(--text-1);
      font-size: 11.5px;
      flex-shrink: 0;
      transition: color var(--dur-fast), border-color var(--dur-fast);
    }
    .perm-btn:hover { color: var(--text-0); border-color: var(--accent); }
    .toggle {
      position: relative; width: 36px; height: 20px;
      background: var(--panel-2);
      border: 1px solid var(--border);
      border-radius: 999px;
      cursor: pointer;
      flex-shrink: 0;
      transition: background var(--dur-fast) var(--ease-out);
    }
    .toggle.on { background: var(--accent); border-color: var(--accent); }
    .toggle .knob {
      position: absolute;
      top: 1px; left: 1px;
      width: 16px; height: 16px;
      background: #fff;
      border-radius: 50%;
      transition: transform var(--dur-fast) var(--ease-spring);
    }
    .toggle.on .knob { transform: translateX(16px); }
    /* Modal */
    .modal-overlay {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.55);
      display: flex; align-items: center; justify-content: center;
      z-index: 100;
    }
    .modal {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: var(--radius-3);
      padding: 22px 26px;
      max-width: 460px; width: 90%;
    }
    .modal h2 { margin: 0 0 8px 0; font-size: 14px; color: var(--text-0); }
    .modal p { margin: 0 0 12px 0; color: var(--text-2); font-size: 12.5px; line-height: 1.5; }
    .modal-actions { display: flex; justify-content: flex-end; margin-top: 14px; }
    .modal-btn {
      all: unset; cursor: pointer;
      padding: 6px 14px;
      border-radius: var(--radius-2);
      font-size: 12.5px;
      background: var(--panel-2);
      color: var(--text-1);
      border: 1px solid var(--border);
    }
  `;Vt([l()],We.prototype,"_state",2);Vt([l()],We.prototype,"_permModalFor",2);We=Vt([w("ares-system-switches")],We);const ua=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];function Jr(e){if(!e||typeof e!="string")return"On demand";const t=e.trim().split(/\s+/);if(t.length!==5)return e;const[r,a,s,i,o]=t;if(r==="*"&&a==="*")return`Every minute (${e})`;const d=/^\d+$/.test(r)&&/^\d+$/.test(a),c=d?`${gr(parseInt(a,10))}:${gr(parseInt(r,10))}`:null;return d&&s==="*"&&i==="*"&&o==="*"?`Daily at ${c}`:d&&s==="*"&&i==="*"&&o==="1-5"?`Weekdays at ${c}`:d&&s==="*"&&i==="*"&&/^[0-6]$/.test(o)?`Weekly on ${ua[parseInt(o,10)]} at ${c}`:d&&/^\d+$/.test(s)&&i==="*"&&o==="*"?`Monthly on day ${s} at ${c}`:e}function gr(e){return e<10?`0${e}`:`${e}`}const va=["get_","list_","search_","read_","describe_"];function fa(e){let t=0,r=0;for(const a of e){const s=ga(a).toLowerCase();va.some(i=>s.startsWith(i))?t++:r++}return{total:e.length,read:t,write:r,conditional:r}}function ga(e){const t=e.indexOf("__");return t>=0?e.slice(t+2):e}function ba(e){const t={title:(e.title||"").trim(),cron:(e.cron||"").trim(),prompt:(e.prompt||"").trim(),enabled:e.enabled!==!1,model:e.model||"smart",mcps:Array.isArray(e.mcps)?e.mcps:[],attachSkills:e.attachSkills!==!1};return e.id&&(t.id=e.id),e.description&&(t.description=e.description),e.deliver&&(t.deliver=e.deliver),e.thinkingEffort&&e.thinkingEffort!=="off"&&(t.thinkingEffort=e.thinkingEffort),e.includeMemory===!0&&(t.includeMemory=!0),t}function Xr(e){const t=e??{},r=Array.isArray(t.mcps)?t.mcps:[];return{id:typeof t.id=="string"?t.id:void 0,title:typeof t.title=="string"?t.title:"",description:typeof t.description=="string"?t.description:"",cron:typeof t.cron=="string"?t.cron:typeof t.defaultCron=="string"?t.defaultCron:"",enabled:t.enabled!==!1,prompt:typeof t.prompt=="string"?t.prompt:"",model:typeof t.model=="string"?t.model:"smart",mcps:r,attachSkills:t.attachSkills!==!1,thinkingEffort:ma(t.thinkingEffort)?t.thinkingEffort:"off",includeMemory:t.includeMemory===!0,deliver:t.deliver&&typeof t.deliver=="object"?t.deliver:void 0}}function ma(e){return e==="off"||e==="low"||e==="medium"||e==="high"}function xa(e){if(!e.enabled)return"off";const t=e.lastRun?.status;return t==="failed"||t==="timeout"||t==="error"?"err":"ok"}var _a=Object.defineProperty,ya=Object.getOwnPropertyDescriptor,re=(e,t,r,a)=>{for(var s=a>1?void 0:a?ya(t,r):t,i=e.length-1,o;i>=0;i--)(o=e[i])&&(s=(a?o(t,r,s):o(s))||s);return a&&s&&_a(t,r,s),s};let q=class extends m{constructor(){super(...arguments),this.initial=null,this._tab="schedule",this._job=this._blank(),this._mcps=[],this._models=[],this._saving=!1,this._error=null,this._addingCapability=!1,this._onKeyDown=e=>{e.key==="Escape"&&this._close()}}connectedCallback(){super.connectedCallback(),this._job=this.initial?Xr(this.initial):this._blank(),this._loadMcps(),this._loadModels(),document.addEventListener("keydown",this._onKeyDown)}disconnectedCallback(){super.disconnectedCallback(),document.removeEventListener("keydown",this._onKeyDown)}_blank(){return{title:"",description:"",cron:"0 9 * * *",enabled:!0,prompt:"",model:"smart",mcps:[],attachSkills:!0,thinkingEffort:"off",includeMemory:!1}}async _loadMcps(){try{const e=await _("/api/mcps"),t=Array.isArray(e)?e:e.servers;Array.isArray(t)&&(this._mcps=t.map(r=>{const a=r;return{name:String(a.name??""),description:String(a.description??""),toolCount:Number(a.toolCount??0),toolNames:Array.isArray(a.toolNames)?a.toolNames:void 0}}))}catch{}}async _loadModels(){try{const e=await _("/api/models"),t=Array.isArray(e)?e:e.models;Array.isArray(t)&&(this._models=t.map(r=>{const a=r;return{id:String(a.id??a.tier??a.name??""),label:typeof a.label=="string"?a.label:typeof a.name=="string"?a.name:void 0}}).filter(r=>r.id))}catch{}this._models.length===0&&(this._models=[{id:"smart",label:"Smart"},{id:"fast",label:"Fast"},{id:"deep",label:"Deep"}])}_close(){this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0}))}async _save(){if(!this._saving){this._saving=!0,this._error=null;try{const e=ba(this._job);if(!e.title)throw new Error("Title is required");if(!e.prompt)throw new Error("Prompt is required");if(!e.cron)throw new Error("Cron is required");const t=this._job.id?`/api/jobs/${encodeURIComponent(this._job.id)}`:"/api/jobs",r=this._job.id?"PUT":"POST",a=await v(t,{method:r,headers:{"Content-Type":"application/json"},body:JSON.stringify(e)});if(!a.ok){const i=await a.text().catch(()=>"");throw new Error(`Save failed (${a.status}): ${i.slice(0,160)}`)}const s=await a.json().catch(()=>({}));this.dispatchEvent(new CustomEvent("saved",{detail:{job:s},bubbles:!0,composed:!0})),this._close()}catch(e){this._error=e.message}finally{this._saving=!1}}}async _delete(){if(!this._job.id){this._close();return}if(confirm(`Delete "${this._job.title}"? This can't be undone.`))try{await v(`/api/jobs/${encodeURIComponent(this._job.id)}`,{method:"DELETE"}),this.dispatchEvent(new CustomEvent("deleted",{detail:{id:this._job.id},bubbles:!0,composed:!0})),this._close()}catch(e){this._error=e.message}}render(){return n`
      <div class="modal" role="dialog" aria-modal="true" @click=${e=>e.stopPropagation()}>
        <header>
          <h2>${this._job.id?"Edit scheduled task":"New scheduled task"}</h2>
          <button class="close" @click=${this._close} title="Close">×</button>
        </header>
        <div class="tabs">
          ${["schedule","capabilities","prompt"].map(e=>n`
            <div class="tab ${this._tab===e?"active":""}" @click=${()=>{this._tab=e}}>
              ${this._tabLabel(e)}
            </div>
          `)}
        </div>
        <div class="body">
          ${this._tab==="schedule"?this._renderSchedule():""}
          ${this._tab==="capabilities"?this._renderCapabilities():""}
          ${this._tab==="prompt"?this._renderPrompt():""}
          ${this._error?n`<div class="err">${this._error}</div>`:""}
        </div>
        <footer>
          <button class="btn danger" @click=${this._delete} ?disabled=${!this._job.id}>Delete task</button>
          <div class="row">
            <button class="btn" @click=${this._close}>Cancel</button>
            <button class="btn primary" @click=${this._save} ?disabled=${this._saving}>
              ${this._saving?"Saving…":"Save"}
            </button>
          </div>
        </footer>
      </div>
    `}_tabLabel(e){return{schedule:"Schedule",capabilities:"Capabilities",prompt:"Prompt & Model"}[e]}_renderSchedule(){const e=Jr(this._job.cron);return n`
      <div class="field">
        <label>Name</label>
        <input
          type="text"
          .value=${this._job.title}
          @input=${t=>{this._job={...this._job,title:t.target.value}}}
          placeholder="e.g. Morning brief"
        />
      </div>
      <div class="field">
        <label>Cron expression</label>
        <input
          type="text"
          .value=${this._job.cron}
          @input=${t=>{this._job={...this._job,cron:t.target.value}}}
          placeholder="0 9 * * *"
        />
        <div class="preview">${e}</div>
      </div>
      <div class="field">
        <label class="toggle">
          <input
            type="checkbox"
            .checked=${this._job.enabled}
            @change=${t=>{this._job={...this._job,enabled:t.target.checked}}}
          />
          Enabled
        </label>
      </div>
    `}_renderCapabilities(){const e=this._job.mcps,t=this._mcps.filter(r=>e.includes(r.name));return n`
      <div>
        ${t.length===0?n`
          <div style="padding: 16px; color: var(--text-3); font-size: 12.5px;">
            No capabilities attached yet — add one to grant the task access to MCP tools.
          </div>
        `:t.map(r=>this._renderCapRow(r))}
        ${this._addingCapability?this._renderCapPicker():n`
          <button class="add-row" @click=${()=>{this._addingCapability=!0}}>+ Add capabilities</button>
        `}
      </div>
    `}_renderCapRow(e){const t=e.toolNames??[],r=t.length?fa(t):{total:e.toolCount,read:e.toolCount,write:0,conditional:0},a=(e.name||"?").charAt(0).toUpperCase();return n`
      <div class="cap-row">
        <div class="cap-tile">${a}</div>
        <div class="cap-info">
          <div class="cap-name">${e.name}</div>
          <div class="cap-desc">${e.description||"(no description)"}</div>
        </div>
        <span class="pill read">${r.read} read</span>
        ${r.write>0?n`<span class="pill write">${r.write} write (${r.conditional} conditional)</span>`:""}
        <button class="ico" title="Settings">⚙</button>
        <button class="ico" title="Remove" @click=${()=>this._removeCap(e.name)}>✕</button>
      </div>
    `}_removeCap(e){this._job={...this._job,mcps:this._job.mcps.filter(t=>t!==e)}}_renderCapPicker(){const e=new Set(this._job.mcps),t=this._mcps.filter(r=>!e.has(r.name));return n`
      <div class="cap-row" style="flex-direction: column; align-items: stretch; gap: 8px;">
        <select
          @change=${r=>{const a=r.target.value;a&&(this._job={...this._job,mcps:[...this._job.mcps,a]},this._addingCapability=!1)}}
        >
          <option value="">Select a capability…</option>
          ${t.map(r=>n`<option value=${r.name}>${r.name}</option>`)}
        </select>
        <button class="btn" @click=${()=>{this._addingCapability=!1}}>Cancel</button>
      </div>
    `}_renderPrompt(){return n`
      <div class="field">
        <label>Prompt</label>
        <textarea
          .value=${this._job.prompt}
          @input=${e=>{this._job={...this._job,prompt:e.target.value}}}
          placeholder="What should this task do each time it runs?"
        ></textarea>
      </div>
      <div class="row" style="gap: 16px; flex-wrap: wrap;">
        <div class="field" style="flex: 1; min-width: 180px;">
          <label>Use model</label>
          <select
            .value=${this._job.model}
            @change=${e=>{this._job={...this._job,model:e.target.value}}}
          >
            ${this._models.map(e=>n`<option value=${e.id}>${e.label||e.id}</option>`)}
          </select>
        </div>
        <div class="field" style="flex: 1; min-width: 180px;">
          <label>Thinking</label>
          <select
            .value=${this._job.thinkingEffort??"off"}
            @change=${e=>{this._job={...this._job,thinkingEffort:e.target.value}}}
          >
            <option value="off">Off</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <div class="field" style="flex: 1; min-width: 180px; display: flex; align-items: flex-end;">
          <label class="toggle" style="margin-bottom: 8px;">
            <input
              type="checkbox"
              .checked=${this._job.includeMemory===!0}
              @change=${e=>{this._job={...this._job,includeMemory:e.target.checked}}}
            />
            Include memory
          </label>
        </div>
      </div>
    `}};q.styles=y`
    :host {
      position: fixed;
      inset: 0;
      z-index: 90;
      display: grid;
      place-items: center;
      background: color-mix(in srgb, #000 55%, transparent);
      animation: fadeIn var(--dur-base) var(--ease-out) both;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    .modal {
      width: 720px;
      max-width: calc(100vw - 32px);
      max-height: calc(100vh - 64px);
      display: flex;
      flex-direction: column;
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: var(--radius-3);
      box-shadow: var(--shadow-3, 0 24px 64px rgba(0,0,0,0.4));
      overflow: hidden;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-4);
      border-bottom: 1px solid var(--border);
    }
    header h2 {
      margin: 0;
      font-size: 15px;
      font-weight: 600;
      color: var(--text-0);
    }
    .close {
      all: unset; cursor: pointer;
      color: var(--text-3);
      font-size: 18px;
      line-height: 1;
      padding: 4px 8px;
      border-radius: var(--radius-1);
    }
    .close:hover { color: var(--text-0); background: var(--panel-2); }
    .tabs {
      display: flex;
      gap: var(--space-2);
      padding: 0 var(--space-4);
      border-bottom: 1px solid var(--border);
    }
    .tab {
      padding: 10px 14px;
      cursor: pointer;
      color: var(--text-3);
      font-size: 13px;
      border-bottom: 2px solid transparent;
      transition: color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out);
    }
    .tab:hover { color: var(--text-1); }
    .tab.active {
      color: var(--text-0);
      border-bottom-color: var(--accent);
    }
    .body {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding: var(--space-4);
    }
    .field { margin-bottom: var(--space-3); }
    label {
      display: block;
      font-size: 11.5px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--text-3);
      margin-bottom: 6px;
    }
    input[type="text"], textarea, select {
      width: 100%;
      box-sizing: border-box;
      background: var(--panel-2);
      color: var(--text-0);
      border: 1px solid var(--border);
      border-radius: var(--radius-1);
      padding: 8px 10px;
      font-family: inherit;
      font-size: 13px;
    }
    textarea {
      min-height: 120px;
      resize: vertical;
      font-family: var(--font-mono);
    }
    .preview {
      margin-top: 6px;
      color: var(--text-2);
      font-size: 12px;
    }
    .row {
      display: flex; align-items: center; gap: var(--space-3);
    }
    .row > * { flex-shrink: 0; }
    .toggle {
      display: inline-flex; align-items: center; gap: 8px;
      cursor: pointer; user-select: none;
      color: var(--text-1); font-size: 13px;
    }
    .toggle input { accent-color: var(--accent); }

    .cap-row {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 12px;
      border-bottom: 1px solid var(--border);
    }
    .cap-row:last-child { border-bottom: none; }
    .cap-tile {
      width: 32px; height: 32px;
      border-radius: var(--radius-1);
      background: color-mix(in srgb, var(--accent) 16%, var(--panel-2));
      color: var(--accent);
      display: grid; place-items: center;
      font-weight: 700; font-size: 14px;
      flex-shrink: 0;
    }
    .cap-info { flex: 1; min-width: 0; }
    .cap-name { color: var(--text-0); font-weight: 500; font-size: 13px; }
    .cap-desc {
      color: var(--text-3); font-size: 11.5px;
      overflow: hidden; text-overflow: ellipsis;
      white-space: nowrap;
    }
    .pill {
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 10.5px;
      font-weight: 500;
      border: 1px solid var(--border);
      background: var(--panel-2);
      color: var(--text-2);
    }
    .pill.read  { color: var(--ok, #10b981); border-color: color-mix(in srgb, var(--ok, #10b981) 35%, transparent); }
    .pill.write { color: var(--err); border-color: color-mix(in srgb, var(--err) 35%, transparent); }
    .ico {
      all: unset; cursor: pointer;
      padding: 4px 6px;
      color: var(--text-3);
      border-radius: var(--radius-1);
    }
    .ico:hover { color: var(--text-0); background: var(--panel-2); }
    .add-row {
      width: 100%;
      box-sizing: border-box;
      padding: 10px 12px;
      border-top: 1px solid var(--border);
      color: var(--accent);
      cursor: pointer;
      background: transparent;
      border-left: none; border-right: none; border-bottom: none;
      text-align: left;
      font-size: 13px;
    }
    .add-row:hover { background: var(--panel-2); }

    footer {
      display: flex; align-items: center; justify-content: space-between;
      padding: var(--space-4);
      border-top: 1px solid var(--border);
      background: var(--panel);
    }
    .btn {
      all: unset; cursor: pointer;
      padding: 8px 14px;
      border-radius: var(--radius-1);
      font-size: 13px;
      border: 1px solid var(--border);
      background: var(--panel-2);
      color: var(--text-1);
    }
    .btn:hover { background: var(--raised, var(--panel)); }
    .btn.primary { background: var(--accent); color: #fff; border-color: var(--accent); }
    .btn.primary:hover { filter: brightness(1.05); }
    .btn.danger { color: var(--err); border-color: color-mix(in srgb, var(--err) 35%, transparent); }
    .err { color: var(--err); font-size: 12px; margin-top: 6px; }
  `;re([E({attribute:!1})],q.prototype,"initial",2);re([l()],q.prototype,"_tab",2);re([l()],q.prototype,"_job",2);re([l()],q.prototype,"_mcps",2);re([l()],q.prototype,"_models",2);re([l()],q.prototype,"_saving",2);re([l()],q.prototype,"_error",2);re([l()],q.prototype,"_addingCapability",2);q=re([w("ares-scheduled-task-editor")],q);var wa=Object.defineProperty,ka=Object.getOwnPropertyDescriptor,L=(e,t,r,a)=>{for(var s=a>1?void 0:a?ka(t,r):t,i=e.length-1,o;i>=0;i--)(o=e[i])&&(s=(a?o(t,r,s):o(s))||s);return a&&s&&wa(t,r,s),s};const $a={jobs:"⏱",outlook:"✉",slack:"","tool-error":"✕",predicted:"✦"},Zr="ares.feed-state";function Sa(){try{const e=localStorage.getItem(Zr);if(e)return JSON.parse(e)}catch{}return{read:[]}}function br(e){try{localStorage.setItem(Zr,JSON.stringify(e))}catch{}}let Mt=0;const Dt=new Set;function es(e){return Dt.add(e),e(Mt),()=>{Dt.delete(e)}}function Ca(e){if(Mt!==e){Mt=e;for(const t of Dt)try{t(e)}catch{}}}let O=class extends m{constructor(){super(...arguments),this._items=[],this._filter="all",this._persist=Sa(),this._overflowOpenId=null,this._replyDraft={},this._replyStatus={},this._upcoming=[],this._editorOpen=!1,this._editorInitial=null,this._refreshing=!1,this._recommendations=[],this._showRelevance=(()=>{try{return localStorage.getItem("ares.feed.show-relevance")!=="0"}catch{return!0}})(),this._eventSrc=null,this._upcomingTimer=null,this._onRefresh=async()=>{if(!this._refreshing){this._refreshing=!0;try{const e=await v("/api/feed/refresh",{method:"POST"});if(!e.ok)throw new Error(`HTTP ${e.status}`);const t=await e.json();this._recommendations=t.recommendations||[],await this._loadInitialItems(),this._loadUpcoming()}catch(e){this._recommendations=[`🟡 Refresh failed — ${e?.message||"network error"}. Try again or check gateway config.`]}finally{this._refreshing=!1}}}}async connectedCallback(){super.connectedCallback(),await this._loadInitialItems(),this._loadUpcoming(),requestAnimationFrame(()=>{const e=this.renderRoot?.querySelector(".timeline");if(e){const t=new Date,r=Math.max(0,t.getHours()*36+t.getMinutes()*.6-80);e.scrollTop=r}}),this._upcomingTimer=window.setInterval(()=>{this._loadUpcoming()},1e3),await this._wireFeedSse()}disconnectedCallback(){if(super.disconnectedCallback(),this._eventSrc){try{this._eventSrc.abort()}catch{}this._eventSrc=null}this._upcomingTimer!=null&&(clearInterval(this._upcomingTimer),this._upcomingTimer=null)}async _loadUpcoming(){try{const e=await _("/api/jobs?upcoming=1");Array.isArray(e)&&(this._upcoming=e)}catch{}}async _loadInitialItems(){try{const e=await _("/api/feed/items");Array.isArray(e.items)&&(this._items=e.items,this._recomputeUnread())}catch{}}async _wireFeedSse(){if(await Se()){this._eventSrc=new AbortController;try{const t=await v("/api/feed/events",{signal:this._eventSrc.signal});if(!t.ok||!t.body)return;const r=t.body.getReader(),a=new TextDecoder;let s="";for(;;){const{value:i,done:o}=await r.read();if(o)break;s+=a.decode(i,{stream:!0});const d=s.split(`

`);s=d.pop()||"";for(const c of d){const p=c.replace(/^data:\s*/,"").trim();if(!p)continue;let h;try{h=JSON.parse(p)}catch{continue}this._ingestFeedEvent(h)}}}catch(t){console.warn("[feed] SSE ended:",t.message)}}}_ingestFeedEvent(e){if(e.type==="snapshot"&&Array.isArray(e.items)){this._items=e.items,this._recomputeUnread();return}if(e.type==="item"&&e.item){const t=e.item,r=this._items.findIndex(a=>a.id===t.id);if(r>=0){const a=[...this._items];a[r]=t,this._items=a}else this._items=[t,...this._items].slice(0,200);this._recomputeUnread();return}if(e.type==="read"&&e.id){this._persist.read.includes(e.id)||(this._persist={...this._persist,read:[...this._persist.read,e.id]},br(this._persist)),this._items=this._items.map(t=>t.id===e.id?{...t,read:!0}:t),this._recomputeUnread();return}if(e.type==="dismiss"&&e.id){this._items=this._items.filter(t=>t.id!==e.id),this._recomputeUnread();return}if(e.type==="handled"&&e.id){this._items=this._items.map(t=>t.id===e.id?{...t,relevance:Math.max(0,(t.relevance||0)*.3),handled:!0}:t);return}}_recomputeUnread(){const e=new Set(this._persist.read),t=this._items.reduce((r,a)=>r+(e.has(a.id)?0:1),0);Ca(t)}async _markRead(e){if(this._persist.read.includes(e))return;const t={...this._persist,read:[...this._persist.read,e]};this._persist=t,br(t),this._recomputeUnread();try{await v(`/api/feed/items/${encodeURIComponent(e)}/read`,{method:"POST"})}catch{}}async _dismiss(e){this._items=this._items.filter(t=>t.id!==e),this._recomputeUnread();try{await v(`/api/feed/items/${encodeURIComponent(e)}/dismiss`,{method:"POST"})}catch{}}async _markHandled(e){this._items=this._items.map(t=>t.id===e?{...t,relevance:Math.max(0,(t.relevance||0)*.3)}:t);try{await v(`/api/feed/items/${encodeURIComponent(e)}/handled`,{method:"POST"})}catch{}}async _copy(e){const t=e.body?`${e.title}

${e.body}`:e.title;try{await navigator.clipboard.writeText(t)}catch{}}render(){let e=this._items;this._filter==="important"?e=e.filter(i=>i.source==="tool-error"||i.source==="jobs"||i.meta?.important===!0):this._filter==="errors"?e=e.filter(i=>i.source==="tool-error"):this._filter==="approvals"?e=e.filter(i=>i.meta?.approval===!0||/approv/i.test(i.title||"")):this._filter==="gateway"?e=e.filter(i=>i.source==="outlook"||i.source==="slack"):this._filter!=="all"&&(e=e.filter(i=>i.source===this._filter));const t=ha("scheduled-tasks"),r=this._filter==="all"?e.filter(i=>i.source==="predicted"):[],a=this._filter==="all"?e.filter(i=>i.source!=="predicted"):e,s=this._filter==="all"||this._filter==="jobs";return n`
      <div class="filters">
        ${["all","important","jobs","gateway","approvals","errors","outlook","slack","tool-error","predicted"].map(i=>n`
          <button class=${this._filter===i?"active":""} @click=${()=>{this._filter=i}}>
            ${i==="tool-error"?"errors":i}
          </button>
        `)}
        <button
          class="refresh-btn ${this._refreshing?"spinning":""}"
          @click=${this._onRefresh}
          ?disabled=${this._refreshing}
          title="Refresh — fetch latest from Outlook + Slack and run AI prioritisation"
        >${this._refreshing?"⟳ refreshing…":"⟳ refresh"}</button>
      </div>
      ${this._recommendations&&this._recommendations.length?n`
        <div class="recommendations">
          <div class="rec-header">
            <span class="rec-eyebrow">AI prioritised actions</span>
            <button class="rec-dismiss" @click=${()=>{this._recommendations=[]}} title="Dismiss">×</button>
          </div>
          ${this._recommendations.map(i=>n`
            <div class="rec-line">${i}</div>
          `)}
        </div>
      `:""}
      ${s?this._renderTimeline():""}
      ${t?e.length===0?n`
        <div class="empty">No activity yet. Run a job or wait for the next cron tick.</div>
      `:n`
        ${r.length?n`
          <div class="eyebrow">Predicted for you</div>
          <div class="stack">
            ${r.map(i=>this._renderCard(i))}
          </div>
        `:""}
        ${a.length?n`
          ${r.length?n`<div class="eyebrow">Recent</div>`:""}
          <div class="stack">
            ${a.map(i=>this._renderCard(i))}
          </div>
        `:""}
      `:n`
        <div class="empty">Scheduled tasks capability is off. Toggle on under Capabilities → System.</div>
      `}
      ${this._editorOpen?n`
        <ares-scheduled-task-editor
          .initial=${this._editorInitial}
          @close=${()=>{this._editorOpen=!1,this._editorInitial=null}}
          @saved=${()=>{this._editorOpen=!1,this._editorInitial=null,this._loadUpcoming()}}
          @deleted=${()=>{this._editorOpen=!1,this._editorInitial=null,this._loadUpcoming()}}
        ></ares-scheduled-task-editor>
      `:""}
    `}_renderTimeline(){const e=new Date,t=new Date(e.getFullYear(),e.getMonth(),e.getDate(),0,0,0,0).getTime(),r=t+24*60*60*1e3,a=(e.getTime()-t)/6e4*.6;return n`
      <div class="timeline-eyebrow">
        <span class="label">Coming up</span>
        <span class="count">${this._upcoming.length} scheduled · next 24h</span>
      </div>
      <div class="timeline">
        <div class="timeline-inner">
        ${[...Array(24).keys()].map(s=>{const i=s*36,o=s===0?"12 AM":s<12?`${s} AM`:s===12?"12 PM":`${s-12} PM`;return n`
            <div class="row" style="top:${i}px">
              <span class="tick-label">${o}</span>
            </div>
          `})}
        <div class="now" style="top:${Math.max(0,Math.min(864,a))}px"></div>
        ${this._upcoming.length===0?n`
          <div class="timeline-empty">No upcoming jobs in the next 24 hours.</div>
        `:""}
        ${this._upcoming.map(s=>{const i=s.nextRunAt<r,o=i?(s.nextRunAt-t)/6e4:24*60-1,d=Math.max(0,Math.min(863,o*.6)),c=Math.max(24,(s.estimatedDurationMs||36*6e4/.6)/6e4*.6),p=new Date(s.nextRunAt).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"});return n`
            <div
              class="block"
              style="top:${d}px;height:${c}px;"
              title=${`${s.title} · ${p}`}
              @click=${()=>this._openTimelineJob(s)}
            >
              <div class="b-title">${s.title}</div>
              <div class="b-meta">${p}${i?"":" · next day"}</div>
            </div>
          `})}
        </div>
      </div>
    `}_openTimelineJob(e){this._editorInitial=e,this._editorOpen=!0}_renderSourceIcon(e){return e==="slack"?n`<span class="slack-mark"><span></span><span></span><span></span><span></span></span>`:n`${$a[e]}`}_renderSuggestedReply(e){const t=this._replyStatus[e.id]||"idle",r=this._replyDraft[e.id]??e.suggestedReply??"",a=t==="drafted";return n`
      <div class="suggested-reply ${a?"done":""}" @click=${s=>s.stopPropagation()}>
        <div class="sr-head">
          <span class="sr-eyebrow">✦ Suggested reply${e.suggestedLang==="fr"?" · FR":""}</span>
          ${a?n`<span class="sr-done">✓ Draft created — review in ${e.source==="outlook"?"Outlook":"Slack"}</span>`:""}
        </div>
        <textarea
          class="sr-text"
          .value=${r}
          ?disabled=${t==="drafting"||a}
          @input=${s=>{this._replyDraft={...this._replyDraft,[e.id]:s.target.value}}}
        ></textarea>
        ${a?"":n`
          <div class="sr-actions">
            <button
              class="sr-accept"
              ?disabled=${t==="drafting"}
              title="Create a draft reply (you review + send)"
              @click=${s=>{s.stopPropagation(),this._acceptReply(e)}}
            >${t==="drafting"?"⟳ drafting…":"✓ Reply with this"}</button>
            <span class="sr-hint">Creates a draft — never sent automatically</span>
          </div>
        `}
      </div>
    `}_renderCard(e){const t=this._persist.read.includes(e.id),r=e.meta?.important===!0,a=e.actions??[],s=a.slice(0,2),i=a.slice(2),o=this._overflowOpenId===e.id;return n`
      <div
        class="card ${t?"":"unread"}"
        data-source=${e.source}
        @click=${()=>this._markRead(e.id)}
      >
        <div class="icon">${this._renderSourceIcon(e.source)}</div>
        <div class="body">
          <div class="title">${e.title}</div>
          <div class="meta">
            ${r?n`<span class="important">Important</span>`:""}
            <span>${this._fmtTs(e.ts)} · ${e.source}</span>
          </div>
          ${e.body?n`<div class="copy-text">${e.body.slice(0,240)}</div>`:""}
          ${e.suggestedReply?this._renderSuggestedReply(e):""}
          ${s.length?n`
            <div class="actions">
              ${s.map((d,c)=>n`
                <button
                  class="action ${d.kind==="reply"||c===0?"primary":"outlined"}"
                  @click=${p=>{p.stopPropagation(),this._fire(d,e)}}
                >${d.label}</button>
              `)}
              ${i.length?n`
                <button
                  class="more"
                  title="More actions"
                  @click=${d=>{d.stopPropagation(),this._overflowOpenId=o?null:e.id}}
                >⋯</button>
                ${o?n`
                  <div class="overflow-menu" @click=${d=>d.stopPropagation()}>
                    ${i.map(d=>n`
                      <button @click=${()=>{this._overflowOpenId=null,this._fire(d,e)}}>${d.label}</button>
                    `)}
                  </div>
                `:""}
              `:""}
            </div>
          `:""}
          ${typeof e.relevance=="number"&&this._showRelevance?n`
            <div class="relevance" title=${e.relevanceReason||""}>
              <div class="relevance-bar"><span class="relevance-fill" style="width: ${Math.round((e.relevance||0)*100)}%"></span></div>
              <button class="relevance-handled" title="Mark as handled" @click=${d=>{d.stopPropagation(),this._markHandled(e.id)}}>handled</button>
            </div>
          `:""}
        </div>
        <div class="toolbar">
          <button class="tb" title="Copy" @click=${d=>{d.stopPropagation(),this._copy(e)}}>⧉</button>
          <button class="tb" title="Mark read" @click=${d=>{d.stopPropagation(),this._markRead(e.id)}}>✓</button>
          <button class="tb" title="Dismiss" @click=${d=>{d.stopPropagation(),this._dismiss(e.id)}}>✕</button>
          <span class="tb glyph" data-source=${e.source} title=${e.source}>${this._renderSourceIcon(e.source)}</span>
        </div>
      </div>
    `}async _acceptReply(e){const t=(this._replyDraft[e.id]??e.suggestedReply??"").toString().trim();if(t){this._replyStatus={...this._replyStatus,[e.id]:"drafting"};try{const r=await v(`/api/feed/items/${encodeURIComponent(e.id)}/reply`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:t})}),a=await r.json().catch(()=>({}));if(r.ok&&a.ok!==!1&&a.drafted!==!1){this._replyStatus={...this._replyStatus,[e.id]:"drafted"};try{C({variant:"success",title:"Draft created",body:`${e.source==="outlook"?"Outlook":"Slack"} draft ready to review and send.`})}catch{}}else{this._replyStatus={...this._replyStatus,[e.id]:"error"};try{C({variant:"danger",title:"Draft failed",body:a.error||`HTTP ${r.status}`})}catch{}}}catch(r){this._replyStatus={...this._replyStatus,[e.id]:"error"};try{C({variant:"danger",title:"Draft failed",body:r?.message||String(r)})}catch{}}}}_fire(e,t){if(e.onAction){e.onAction();return}if(e.kind==="reply"&&t){this._acceptReply(t);return}if(e.kind==="prefill"&&e.prefill){et("draft",e.prefill),I({top:"chat",sub:null});return}if(e.kind==="url"&&e.url){if(e.url.startsWith("/q/")){const r=e.url.replace(/^\/q\//,"#/");window.location.hash=r}else window.open(e.url,"_blank","noopener,noreferrer");return}if(e.kind==="internal-route"&&e.route){window.location.hash=e.route.startsWith("#")?e.route:`#${e.route}`;return}e.href&&window.open(e.href,"_blank","noopener,noreferrer")}_fmtTs(e){const t=Date.now()-e;return t<6e4?"just now":t<36e5?`${Math.floor(t/6e4)}m ago`:t<864e5?`${Math.floor(t/36e5)}h ago`:new Date(e).toLocaleDateString()}};O.styles=y`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow-y: auto;
      padding: var(--space-4) var(--space-5);
    }
    .filters { display: flex; gap: 6px; margin-bottom: 12px; flex-wrap: wrap; align-items: center; }
    .filters button {
      all: unset; cursor: pointer;
      padding: 4px 10px;
      font-size: 11.5px;
      color: var(--text-2);
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 999px;
    }
    .filters button.active { background: var(--accent); color: #fff; border-color: var(--accent); }
    /* Q-pass-5 close-out — manual refresh + AI recommendations */
    .filters .refresh-btn {
      margin-left: auto;
      background: color-mix(in srgb, var(--accent) 18%, transparent);
      border-color: color-mix(in srgb, var(--accent) 40%, var(--border));
      color: var(--text-0);
      font-weight: 500;
      transition: background var(--dur-fast) var(--ease-out), opacity var(--dur-fast) var(--ease-out);
    }
    .filters .refresh-btn:hover:not(:disabled) {
      background: color-mix(in srgb, var(--accent) 28%, transparent);
    }
    .filters .refresh-btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .filters .refresh-btn.spinning { animation: spinPulse 1.4s ease-in-out infinite; }
    @keyframes spinPulse {
      0%, 100% { opacity: 0.6; }
      50% { opacity: 1; }
    }
    .recommendations {
      margin-bottom: 16px;
      padding: 12px 14px;
      background: color-mix(in srgb, var(--accent) 8%, var(--panel));
      border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--border));
      border-radius: var(--radius-2);
    }
    .recommendations .rec-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .recommendations .rec-eyebrow {
      font-size: 10.5px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: color-mix(in srgb, var(--accent) 80%, var(--text-2));
      font-weight: 600;
    }
    .recommendations .rec-dismiss {
      all: unset;
      cursor: pointer;
      width: 20px;
      height: 20px;
      display: grid;
      place-items: center;
      border-radius: 50%;
      color: var(--text-3);
      font-size: 14px;
    }
    .recommendations .rec-dismiss:hover { background: var(--panel-2); color: var(--text-0); }
    .recommendations .rec-line {
      padding: 4px 0;
      font-size: 13px;
      color: var(--text-1);
      line-height: 1.5;
    }
    .recommendations .rec-line + .rec-line {
      border-top: 1px dashed var(--border);
    }

    .eyebrow {
      margin: 14px 0 6px 0;
      padding: 0 4px;
      font-size: 10.5px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--text-3);
    }
    .eyebrow:first-child { margin-top: 0; }

    .stack { display: flex; flex-direction: column; gap: 8px; }

    .card {
      position: relative;
      background: var(--panel);
      border: 1px solid var(--border);
      border-left: 3px solid var(--border);
      border-radius: var(--radius-2);
      padding: 10px 14px;
      display: flex; gap: 10px;
      animation: msgFadeIn var(--dur-base) var(--ease-out) both;
    }
    @keyframes msgFadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .card.unread { border-color: color-mix(in srgb, var(--accent) 50%, var(--border)); }

    /* Source-tinted left edge. */
    .card[data-source="jobs"]       { border-left-color: var(--warn, #f59e0b); }
    .card[data-source="slack"]      { border-left-color: #6c5ce7; }
    .card[data-source="outlook"]    { border-left-color: #3b82f6; }
    .card[data-source="tool-error"] { border-left-color: var(--err); }
    .card[data-source="predicted"]  { border-left-color: #8b5cf6; }

    .icon {
      font-size: 16px; line-height: 1.4; flex-shrink: 0;
      width: 18px; text-align: center;
    }
    .card[data-source="jobs"] .icon       { color: var(--warn, #f59e0b); }
    .card[data-source="outlook"] .icon    { color: #3b82f6; }
    .card[data-source="tool-error"] .icon { color: var(--err); }
    .card[data-source="predicted"] .icon  { color: #8b5cf6; }

    /* Slack "multi-color" 4-dot mark (matches Quick / Slack accent strip). */
    .slack-mark {
      display: inline-grid;
      grid-template-columns: 1fr 1fr;
      gap: 2px;
      width: 14px; height: 14px;
    }
    .slack-mark span {
      display: block;
      width: 6px; height: 6px;
      border-radius: 50%;
    }
    .slack-mark span:nth-child(1) { background: #36c5f0; }
    .slack-mark span:nth-child(2) { background: #2eb67d; }
    .slack-mark span:nth-child(3) { background: #ecb22e; }
    .slack-mark span:nth-child(4) { background: #e01e5a; }

    .body { flex: 1; min-width: 0; }
    .title { color: var(--text-0); font-size: 13px; font-weight: 500; }
    .meta {
      color: var(--text-3);
      font-size: 11px;
      margin-top: 2px;
      display: flex; align-items: center; gap: 6px;
    }
    .important {
      display: inline-block;
      padding: 1px 6px;
      border-radius: 999px;
      font-size: 9.5px;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      background: color-mix(in srgb, var(--err) 18%, transparent);
      color: var(--err);
      border: 1px solid color-mix(in srgb, var(--err) 38%, transparent);
    }
    .copy-text { color: var(--text-2); font-size: 12px; margin-top: 4px; }

    /* Suggested-reply card (Outlook/Slack auto-drafts). */
    .suggested-reply {
      margin-top: 10px;
      padding: 10px;
      border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--border));
      border-radius: var(--radius-2);
      background: color-mix(in srgb, var(--accent) 7%, var(--panel));
    }
    .suggested-reply.done { border-color: color-mix(in srgb, var(--ok) 45%, var(--border)); }
    .sr-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
    .sr-eyebrow {
      font-size: 10px; letter-spacing: 0.06em; text-transform: uppercase;
      color: color-mix(in srgb, var(--accent) 85%, var(--text-2)); font-weight: 600;
    }
    .sr-done { font-size: 11px; color: var(--ok); font-weight: 500; }
    .sr-text {
      width: 100%; box-sizing: border-box;
      min-height: 74px; resize: vertical;
      background: var(--panel); color: var(--text-1);
      border: 1px solid var(--border); border-radius: var(--radius-1);
      padding: 8px 10px; font: 12.5px/1.5 var(--font-ui, system-ui, sans-serif);
      outline: none;
    }
    .sr-text:focus { border-color: var(--accent); }
    .sr-text[disabled] { opacity: 0.75; }
    .sr-actions { display: flex; align-items: center; gap: 10px; margin-top: 8px; }
    .sr-accept {
      all: unset; cursor: pointer;
      padding: 5px 14px; border-radius: var(--radius-1);
      background: var(--accent); color: #fff; font-size: 12px; font-weight: 500;
    }
    .sr-accept[disabled] { opacity: 0.6; cursor: default; }
    .sr-hint { font-size: 10.5px; color: var(--text-3); }

    .actions { display: flex; gap: 6px; margin-top: 8px; align-items: center; position: relative; }
    .action {
      all: unset; cursor: pointer;
      padding: 3px 10px;
      font-size: 11.5px;
      border-radius: var(--radius-1);
      background: var(--panel-2);
      color: var(--text-1);
      border: 1px solid var(--border);
    }
    .action.primary { background: var(--accent); color: #fff; border-color: var(--accent); }
    .action.outlined { background: transparent; }

    /* Q-pass-5 P1-3 — relevance score bar + handled chip. */
    .relevance {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 8px;
      font-size: 10.5px;
      color: var(--text-3);
    }
    .relevance-bar {
      flex: 1;
      max-width: 120px;
      height: 4px;
      border-radius: 2px;
      background: var(--panel-2);
      overflow: hidden;
    }
    .relevance-fill {
      display: block;
      height: 100%;
      background: linear-gradient(90deg, var(--info), var(--accent));
      transition: width var(--dur-fast) var(--ease-out);
    }
    .relevance-handled {
      all: unset;
      cursor: pointer;
      font-size: 10px;
      color: var(--text-3);
      text-decoration: underline dotted;
    }
    .relevance-handled:hover { color: var(--text-1); }
    .more {
      all: unset; cursor: pointer;
      padding: 3px 8px;
      font-size: 13px;
      line-height: 1;
      border-radius: var(--radius-1);
      color: var(--text-2);
      border: 1px solid var(--border);
      background: var(--panel-2);
    }
    .more:hover { color: var(--text-0); }
    .overflow-menu {
      position: absolute;
      top: 100%;
      left: 0;
      margin-top: 4px;
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: var(--radius-2);
      box-shadow: var(--shadow-2, 0 4px 16px rgba(0,0,0,0.25));
      padding: 4px;
      display: flex; flex-direction: column;
      min-width: 140px;
      z-index: 10;
    }
    .overflow-menu button {
      all: unset; cursor: pointer;
      padding: 6px 10px;
      border-radius: var(--radius-1);
      font-size: 12px;
      color: var(--text-1);
    }
    .overflow-menu button:hover { background: var(--panel-2); }

    /* Per-card hover toolbar (top-right). */
    .toolbar {
      position: absolute;
      top: 6px;
      right: 6px;
      display: flex;
      gap: 2px;
      padding: 2px;
      border-radius: var(--radius-1);
      background: color-mix(in srgb, var(--panel) 90%, transparent);
      opacity: 0;
      transition: opacity var(--dur-fast) var(--ease-out);
      pointer-events: none;
    }
    .card:hover .toolbar,
    .card:focus-within .toolbar { opacity: 1; pointer-events: auto; }
    .tb {
      all: unset; cursor: pointer;
      padding: 3px 6px;
      font-size: 12px;
      line-height: 1;
      color: var(--text-3);
      border-radius: var(--radius-1);
      transition: color var(--dur-fast) var(--ease-out), background var(--dur-fast) var(--ease-out);
    }
    .tb:hover { color: var(--text-0); background: var(--panel-2); }
    .tb.glyph { cursor: default; }
    .tb.glyph[data-source="jobs"]       { color: var(--warn, #f59e0b); }
    .tb.glyph[data-source="outlook"]    { color: #3b82f6; }
    .tb.glyph[data-source="tool-error"] { color: var(--err); }
    .tb.glyph[data-source="predicted"]  { color: #8b5cf6; }

    .empty { padding: 32px; text-align: center; color: var(--text-3); }

    /* Q-pass-4-C — "Coming up" timeline. */
    .timeline-eyebrow {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin: 4px 0 8px 0;
    }
    .timeline-eyebrow .label {
      font-size: 10.5px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--text-3);
    }
    .timeline-eyebrow .count {
      font-size: 11px;
      color: var(--text-2);
    }
    .timeline {
      position: relative;
      height: 220px;          /* Compact: ~6 hours visible, scrollable */
      margin-bottom: 16px;
      border: 1px solid var(--border);
      border-radius: var(--radius-2);
      background: var(--panel);
      overflow-y: auto;
      overflow-x: hidden;
      flex-shrink: 0;
    }
    .timeline-inner {
      position: relative;
      height: 864px;          /* 24 rows × 36px — scrolls inside .timeline */
    }
    .timeline .row {
      position: absolute;
      left: 48px;
      right: 0;
      height: 36px;
      border-top: 1px dashed color-mix(in srgb, var(--border) 70%, transparent);
    }
    .timeline .row .tick-label {
      position: absolute;
      left: -44px;
      top: -8px;
      width: 40px;
      text-align: right;
      font-size: 10px;
      color: var(--text-3);
      font-variant-numeric: tabular-nums;
    }
    .timeline .now {
      position: absolute;
      left: 48px;
      right: 0;
      height: 1px;
      background: color-mix(in srgb, var(--accent) 80%, transparent);
      box-shadow: 0 0 4px var(--accent);
      pointer-events: none;
      z-index: 2;
    }
    .timeline .block {
      position: absolute;
      left: 56px;
      right: 8px;
      min-height: 24px;
      border: 1px solid var(--accent);
      background: color-mix(in srgb, var(--accent) 10%, transparent);
      border-radius: var(--radius-1);
      padding: 4px 8px;
      cursor: pointer;
      box-sizing: border-box;
      overflow: hidden;
      transition: background var(--dur-fast) var(--ease-out);
    }
    .timeline .block:hover {
      background: color-mix(in srgb, var(--accent) 20%, transparent);
    }
    .timeline .block .b-title {
      font-size: 11.5px;
      color: var(--text-0);
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .timeline .block .b-meta {
      font-size: 10px;
      color: var(--text-3);
      margin-top: 1px;
    }
    .timeline-empty {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      color: var(--text-3);
      font-size: 12px;
      pointer-events: none;
    }
  `;L([l()],O.prototype,"_items",2);L([l()],O.prototype,"_filter",2);L([l()],O.prototype,"_persist",2);L([l()],O.prototype,"_overflowOpenId",2);L([l()],O.prototype,"_replyDraft",2);L([l()],O.prototype,"_replyStatus",2);L([l()],O.prototype,"_upcoming",2);L([l()],O.prototype,"_editorOpen",2);L([l()],O.prototype,"_editorInitial",2);L([l()],O.prototype,"_refreshing",2);L([l()],O.prototype,"_recommendations",2);L([l()],O.prototype,"_showRelevance",2);O=L([w("ares-activity-feed")],O);var Aa=Object.defineProperty,Ea=Object.getOwnPropertyDescriptor,xe=(e,t,r,a)=>{for(var s=a>1?void 0:a?Ea(t,r):t,i=e.length-1,o;i>=0;i--)(o=e[i])&&(s=(a?o(t,r,s):o(s))||s);return a&&s&&Aa(t,r,s),s};const Ta=n`
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" stroke-width="1.8"
       stroke-linecap="round" stroke-linejoin="round">
    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
  </svg>`,Ia=n`
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" stroke-width="1.8"
       stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 12h3l3-9 4 18 3-9h5"/>
  </svg>`,ts=n`
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" stroke-width="1.8"
       stroke-linecap="round" stroke-linejoin="round">
    <rect x="3"  y="12" width="4" height="9" rx="1"/>
    <rect x="10" y="7"  width="4" height="14" rx="1"/>
    <rect x="17" y="3"  width="4" height="18" rx="1"/>
  </svg>`,rs=n`
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" stroke-width="1.8"
       stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>`,za=n`
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" stroke-width="1.8"
       stroke-linecap="round" stroke-linejoin="round">
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
  </svg>`,Pa=n`
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" stroke-width="1.8"
       stroke-linecap="round" stroke-linejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2"/>
    <path d="M8 21h8m-4-4v4"/>
  </svg>`,Oa=n`
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" stroke-width="1.8"
       stroke-linecap="round" stroke-linejoin="round">
    <path d="M2 12C2 6.477 6.477 2 12 2s10 4.477 10 10"/>
    <path d="M5 12a7 7 0 0 1 7-7"/>
    <path d="M12 5a7 7 0 0 1 7 7"/>
    <path d="M12 19v-7"/>
    <path d="M8 15.5A4 4 0 0 1 8 12"/>
    <path d="M16 12a4 4 0 0 1-4 4"/>
  </svg>`,Ma=n`
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" stroke-width="1.8"
       stroke-linecap="round" stroke-linejoin="round">
    <line x1="4"  y1="6"  x2="20" y2="6"/>
    <line x1="4"  y1="12" x2="20" y2="12"/>
    <line x1="4"  y1="18" x2="20" y2="18"/>
    <circle cx="8"  cy="6"  r="2" fill="var(--panel)"/>
    <circle cx="16" cy="12" r="2" fill="var(--panel)"/>
    <circle cx="10" cy="18" r="2" fill="var(--panel)"/>
  </svg>`,mr=n`
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" stroke-width="2"
       stroke-linecap="round" stroke-linejoin="round">
    <polyline points="18 15 12 9 6 15"/>
  </svg>`,Da=n`
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
       stroke="currentColor" stroke-width="2"
       stroke-linecap="round" stroke-linejoin="round">
    <path d="M15 3H9a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6"/>
    <polyline points="11 8 7 12 11 16"/>
  </svg>`,Ra=n`
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
    <path d="M12 2 L22 8 L22 16 L12 22 L2 16 L2 8 Z"
          stroke="var(--accent)" stroke-width="2"
          fill="color-mix(in srgb, var(--accent) 25%, transparent)"/>
    <circle cx="12" cy="12" r="3" fill="var(--accent)"/>
  </svg>`,La=[{id:"chat",label:"New chat",iconTpl:Ta},{id:"activity-feed",label:"Activity feed",iconTpl:Ia},{id:"my-stuff",label:"My stuff",iconTpl:ts}],xr=[{id:"capabilities",label:"Capabilities",iconTpl:za},{id:"my-computer",label:"My computer",iconTpl:Pa},{id:"my-context",label:"My context",iconTpl:Oa},{id:"customization",label:"Customization",iconTpl:Ma}],ja=[{id:"jobs",label:"Scheduled tasks",iconTpl:rs}],_r="ares.dock.settings-open",yr="ares.dock.more-open",Fa="ares.user.name";function Na(){try{const e=localStorage.getItem(Fa);if(e&&e.trim())return e.trim()}catch{}return"User"}let J=class extends m{constructor(){super(...arguments),this.selectedSessionId=null,this._health=null,this._unread=0,this._settingsOpen=(()=>{try{return localStorage.getItem(_r)!=="0"}catch{return!0}})(),this._moreOpen=(()=>{try{return localStorage.getItem(yr)==="1"}catch{return!1}})(),this._unsubHealth=null,this._unsubUnread=null}connectedCallback(){super.connectedCallback(),this._unsubHealth=Qt(e=>{this._health=e}),this._unsubUnread=es(e=>{this._unread=e})}disconnectedCallback(){super.disconnectedCallback(),this._unsubHealth?.(),this._unsubHealth=null,this._unsubUnread?.(),this._unsubUnread=null}render(){const e=xr.some(s=>s.id===this.currentRoute?.top),t=this._settingsOpen||e,r=Na(),a=this._buildHealthTooltip();return n`
      <!-- Brand header — logo + wordmark only, no collapse button -->
      <header>
        <span class="brand-logo">${Ra}</span>
        <span class="brand-text">
          <span class="brand-name">Ares</span>
          <span class="brand-tagline">The Orchestrator of Intelligence</span>
        </span>
      </header>

      <nav>
        <!-- Collapse button sits at the TOP of nav, above New chat, so the
             right-side topbar stays clear of chrome. -->
        <button
          class="nav-btn collapse-nav-btn"
          title="Collapse sidebar"
          @click=${()=>this._toggleDock()}
          aria-label="Collapse sidebar"
        >
          <span class="icon">${Da}</span>
          <span>Collapse</span>
        </button>
        ${La.map(s=>{const i=this.currentRoute?.top===s.id,o=s.id==="activity-feed"&&this._unread>0;return n`
            <button
              class="nav-btn ${i?"active":""}"
              @click=${()=>this._go(s.id)}
              title=${s.label}
            >
              <span class="icon">${s.iconTpl}</span>
              <span>${s.label}</span>
              ${o?n`<span class="badge">${this._unread>99?"99+":this._unread}</span>`:""}
            </button>
          `})}

        <!-- More disclosure -->
        <div class="settings-group">
          <button
            class="disclosure ${this._moreOpen?"open":""}"
            @click=${()=>this._toggleMore()}
            aria-expanded=${this._moreOpen?"true":"false"}
          >
            <span class="icon">${ts}</span>
            <span>More</span>
            <span class="chev">${mr}</span>
          </button>
          <div class="sub-nav ${this._moreOpen?"open":""}">
            ${ja.map(s=>n`
              <button
                class="nav-btn ${this.currentRoute?.top===s.id?"active":""}"
                @click=${()=>this._go(s.id)}
                title=${s.label}
              >
                <span class="icon">${s.iconTpl}</span>
                <span>${s.label}</span>
              </button>
            `)}
          </div>
        </div>

        <!-- Settings disclosure -->
        <div class="settings-group">
          <button
            class="disclosure ${t?"open":""}"
            @click=${()=>this._toggleSettings()}
            aria-expanded=${t?"true":"false"}
          >
            <span class="icon">${rs}</span>
            <span>Settings</span>
            <span class="chev">${mr}</span>
          </button>
          <div class="sub-nav ${t?"open":""}">
            ${xr.map(s=>n`
              <button
                class="nav-btn ${this.currentRoute?.top===s.id?"active":""}"
                @click=${()=>this._go(s.id)}
                title=${s.label}
              >
                <span class="icon">${s.iconTpl}</span>
                <span>${s.label}</span>
              </button>
            `)}
          </div>
        </div>
      </nav>

      <div class="recents-section">
        <div class="section-label">Recents</div>
        <ares-recents-list .selectedId=${this.selectedSessionId}></ares-recents-list>
      </div>

      <footer>
        <div class="avatar" title=${a}>AM</div>
        <span class="user-name">${r}</span>
      </footer>
    `}_buildHealthTooltip(){if(!this._health)return"Loading health…";const e=this._health.servers?.running??0,t=this._health.servers?.total??0,r=this._health.activeTools??this._health.totalTools??0;return`${e}/${t} MCPs · ${r} tools`}_toggleSettings(){this._settingsOpen=!this._settingsOpen;try{localStorage.setItem(_r,this._settingsOpen?"1":"0")}catch{}}_toggleMore(){this._moreOpen=!this._moreOpen;try{localStorage.setItem(yr,this._moreOpen?"1":"0")}catch{}}_toggleDock(){this.dispatchEvent(new CustomEvent("dock-toggle",{bubbles:!0,composed:!0}))}_go(e){e==="chat"&&this.dispatchEvent(new CustomEvent("new-chat",{bubbles:!0,composed:!0})),I({top:e,sub:e==="capabilities"?"connections":null})}};J.styles=y`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--panel);
      border-right: 1px solid var(--border);
      width: 100%;
      overflow: hidden;
    }

    /* ── Brand header ───────────────────────────────────────── */
    /* macOS hiddenInset titlebar puts traffic-lights at y≈10, x≈12.
     * 28px top padding clears them. The header acts as a drag region. */
    header {
      padding: 28px var(--space-3) 14px var(--space-3);
      display: flex;
      align-items: center;
      gap: 10px;
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
      -webkit-app-region: drag;
      user-select: none;
    }
    header .brand-logo { -webkit-app-region: no-drag; }
    .brand-logo {
      flex-shrink: 0;
      display: flex;
      align-items: center;
    }
    .brand-text {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .brand-name {
      color: var(--text-0);
      font-weight: 600;
      font-size: 14px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      line-height: 1.2;
    }
    .brand-tagline {
      color: var(--text-3);
      font-size: 10px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      letter-spacing: 0.02em;
    }
    /* Collapse nav button — styled like a nav row but slightly dimmer */
    .collapse-nav-btn {
      opacity: 0.65;
      font-size: 12px !important;
    }
    .collapse-nav-btn:hover { opacity: 1; }

    /* ── Primary nav ────────────────────────────────────────── */
    nav {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: var(--space-3) var(--space-2);
      flex-shrink: 0;
    }
    button.nav-btn {
      all: unset;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: 8px 10px;
      border-radius: var(--radius-2);
      color: var(--text-2);
      font-size: 13px;
      transition: background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out);
    }
    button.nav-btn:hover { background: var(--panel-2); color: var(--text-1); }
    button.nav-btn.active {
      background: color-mix(in srgb, var(--accent) 18%, transparent);
      color: var(--text-0);
    }
    .icon {
      width: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      opacity: 0.85;
    }
    button.nav-btn.active .icon { opacity: 1; }
    .badge {
      margin-left: auto;
      background: var(--accent);
      color: white;
      font-size: 10px;
      padding: 1px 6px;
      border-radius: 999px;
      font-weight: 600;
      line-height: 1.6;
    }

    /* ── Settings disclosure group ──────────────────────────── */
    .settings-group {
      display: flex;
      flex-direction: column;
      gap: 2px;
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid var(--border);
    }
    button.disclosure {
      all: unset;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: 8px 10px;
      border-radius: var(--radius-2);
      color: var(--text-2);
      font-size: 13px;
      transition: background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out);
    }
    button.disclosure:hover { background: var(--panel-2); color: var(--text-1); }
    .disclosure .chev {
      margin-left: auto;
      display: flex;
      align-items: center;
      color: var(--text-3);
      transition: transform var(--dur-fast) var(--ease-out);
    }
    .disclosure.open .chev { transform: rotate(180deg); }
    .sub-nav {
      display: flex;
      flex-direction: column;
      gap: 2px;
      max-height: 0;
      overflow: hidden;
      transition: max-height var(--dur-base) var(--ease-out);
    }
    .sub-nav.open { max-height: 220px; }
    .sub-nav button.nav-btn { padding-left: 36px; font-size: 12.5px; }

    /* Q-pass-4 polish — collapsed dock hides every label, count, badge,
     * and the Recents/footer-name strip. Width drops to 56 px so only
     * icons remain. The brand wordmark + "Quick · route" subline also
     * collapse so the brand row stays in the same x-band as the icons. */
    :host([data-collapsed]) .brand-name,
    :host([data-collapsed]) .brand-tagline,
    :host([data-collapsed]) .brand-text,
    :host([data-collapsed]) button.nav-btn span:not(.icon),
    :host([data-collapsed]) button.disclosure span:not(.icon),
    :host([data-collapsed]) .badge,
    :host([data-collapsed]) .chev,
    :host([data-collapsed]) .section-label,
    :host([data-collapsed]) .recents-section,
    :host([data-collapsed]) footer .user-name,
    :host([data-collapsed]) footer .health-pill {
      display: none !important;
    }
    :host([data-collapsed]) header {
      padding: 12px 8px;
      justify-content: center;
    }
    :host([data-collapsed]) nav {
      padding: var(--space-3) 6px;
    }
    :host([data-collapsed]) button.nav-btn,
    :host([data-collapsed]) button.disclosure {
      justify-content: center;
      padding: 8px 0;
    }
    :host([data-collapsed]) .sub-nav button.nav-btn {
      padding-left: 0;
    }
    :host([data-collapsed]) footer {
      justify-content: center;
      padding: var(--space-3) 6px;
    }

    /* ── Recents ────────────────────────────────────────────── */
    .recents-section {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      border-top: 1px solid var(--border);
      padding-top: var(--space-2);
      overflow: hidden;
    }
    .section-label {
      padding: 4px var(--space-4);
      font-size: 11px;
      letter-spacing: 0.04em;
      color: var(--text-3);
      flex-shrink: 0;
    }
    ares-recents-list {
      flex: 1;
      min-height: 0;
      padding: 0 var(--space-2);
    }

    /* ── Footer ─────────────────────────────────────────────── */
    footer {
      padding: var(--space-3);
      border-top: 1px solid var(--border);
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
    }
    .avatar {
      width: 28px; height: 28px;
      border-radius: 50%;
      background: var(--accent);
      color: white;
      display: grid; place-items: center;
      font-size: 11px;
      font-weight: 700;
      flex-shrink: 0;
      cursor: default;
    }
    .user-name {
      flex: 1;
      min-width: 0;
      color: var(--text-1);
      font-size: 13px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `;xe([E({type:Object})],J.prototype,"currentRoute",2);xe([E({type:String})],J.prototype,"selectedSessionId",2);xe([l()],J.prototype,"_health",2);xe([l()],J.prototype,"_unread",2);xe([l()],J.prototype,"_settingsOpen",2);xe([l()],J.prototype,"_moreOpen",2);J=xe([w("ares-dock")],J);var Ba=Object.defineProperty,Ua=Object.getOwnPropertyDescriptor,ss=(e,t,r,a)=>{for(var s=a>1?void 0:a?Ua(t,r):t,i=e.length-1,o;i>=0;i--)(o=e[i])&&(s=(a?o(t,r,s):o(s))||s);return a&&s&&Ba(t,r,s),s};let ht=class extends m{constructor(){super(...arguments),this._selected=ct(),this._onThemeChanged=()=>{this._selected=ct(),this.requestUpdate()}}connectedCallback(){super.connectedCallback(),document.addEventListener("ares:theme-changed",this._onThemeChanged)}disconnectedCallback(){super.disconnectedCallback(),document.removeEventListener("ares:theme-changed",this._onThemeChanged)}_pick(e){this._selected=e,St(e)}render(){return n`
      <h2>Appearance</h2>
      <p class="lead">
        Pick a theme. "System" follows your macOS appearance setting.
      </p>
      <div class="grid" role="radiogroup" aria-label="Theme">
        ${Rr.map(e=>this._renderSwatch(e))}
      </div>
    `}_renderSwatch(e){const t=this._selected===e;return n`
      <button
        class="swatch ${t?"selected":""}"
        role="radio"
        aria-checked=${t?"true":"false"}
        data-theme=${e==="system"?"kiro-dark":e}
        title=${Zt(e)}
        @click=${()=>this._pick(e)}
      >
        <div class="preview">
          <div style="background: var(--bg);"></div>
          <div style="background: var(--panel);"></div>
          <div style="background: var(--accent);"></div>
        </div>
        <div class="label-row">
          <span class="name">${gs(e)}</span>
          <span class="desc">${Zt(e)}</span>
          ${t?n`<span class="check">✓ selected</span>`:null}
        </div>
      </button>
    `}};ht.styles=y`
    :host {
      display: block;
      font-family: var(--font-ui);
    }
    h2 {
      margin: 0 0 var(--space-2) 0;
      font-size: 16px;
      font-weight: 600;
      color: var(--text-0);
    }
    p.lead {
      margin: 0 0 var(--space-4) 0;
      color: var(--text-3);
      font-size: 12.5px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
      gap: var(--space-3);
    }
    button.swatch {
      all: unset;
      cursor: pointer;
      display: block;
      padding: 0;
      border-radius: var(--radius-3);
      border: 2px solid var(--border);
      overflow: hidden;
      background: var(--panel);
      transition: border-color var(--dur-fast) var(--ease-out),
                  transform var(--dur-fast) var(--ease-spring);
    }
    button.swatch:hover { border-color: var(--border-2); }
    button.swatch:active { transform: scale(0.97); }
    button.swatch.selected {
      border-color: var(--accent);
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 30%, transparent);
    }
    .preview {
      display: flex;
      height: 64px;
    }
    .preview > * { flex: 1; }
    .label-row {
      padding: var(--space-2) var(--space-3);
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .label-row .name {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-0);
    }
    .label-row .desc {
      font-size: 11.5px;
      color: var(--text-3);
    }
    .check {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: var(--accent);
      font-size: 11px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      margin-top: 2px;
    }
  `;ss([l()],ht.prototype,"_selected",2);ht=ss([w("ares-theme-picker")],ht);const qa="modulepreload",Ha=function(e){return"/q/"+e},wr={},ut=function(t,r,a){let s=Promise.resolve();if(r&&r.length>0){document.getElementsByTagName("link");const o=document.querySelector("meta[property=csp-nonce]"),d=o?.nonce||o?.getAttribute("nonce");s=Promise.allSettled(r.map(c=>{if(c=Ha(c),c in wr)return;wr[c]=!0;const p=c.endsWith(".css"),h=p?'[rel="stylesheet"]':"";if(document.querySelector(`link[href="${c}"]${h}`))return;const u=document.createElement("link");if(u.rel=p?"stylesheet":qa,p||(u.as="script"),u.crossOrigin="",u.href=c,d&&u.setAttribute("nonce",d),document.head.appendChild(u),p)return new Promise(($,x)=>{u.addEventListener("load",$),u.addEventListener("error",()=>x(new Error(`Unable to preload CSS for ${c}`)))})}))}function i(o){const d=new Event("vite:preloadError",{cancelable:!0});if(d.payload=o,window.dispatchEvent(d),!d.defaultPrevented)throw o}return s.then(o=>{for(const d of o||[])d.status==="rejected"&&i(d.reason);return t().catch(i)})};/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Ka=e=>e.strings===void 0;/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Qa={CHILD:2},Va=e=>(...t)=>({_$litDirective$:e,values:t});class Wa{constructor(t){}get _$AU(){return this._$AM._$AU}_$AT(t,r,a){this._$Ct=t,this._$AM=r,this._$Ci=a}_$AS(t,r){return this.update(t,r)}update(t,r){return this.render(...r)}}/**
 * @license
 * Copyright 2017 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const qe=(e,t)=>{const r=e._$AN;if(r===void 0)return!1;for(const a of r)a._$AO?.(t,!1),qe(a,t);return!0},vt=e=>{let t,r;do{if((t=e._$AM)===void 0)break;r=t._$AN,r.delete(e),e=t}while(r?.size===0)},as=e=>{for(let t;t=e._$AM;e=t){let r=t._$AN;if(r===void 0)t._$AN=r=new Set;else if(r.has(e))break;r.add(e),Ja(t)}};function Ga(e){this._$AN!==void 0?(vt(this),this._$AM=e,as(this)):this._$AM=e}function Ya(e,t=!1,r=0){const a=this._$AH,s=this._$AN;if(s!==void 0&&s.size!==0)if(t)if(Array.isArray(a))for(let i=r;i<a.length;i++)qe(a[i],!1),vt(a[i]);else a!=null&&(qe(a,!1),vt(a));else qe(this,e)}const Ja=e=>{e.type==Qa.CHILD&&(e._$AP??=Ya,e._$AQ??=Ga)};class Xa extends Wa{constructor(){super(...arguments),this._$AN=void 0}_$AT(t,r,a){super._$AT(t,r,a),as(this),this.isConnected=t._$AU}_$AO(t,r=!0){t!==this.isConnected&&(this.isConnected=t,t?this.reconnected?.():this.disconnected?.()),r&&(qe(this,t),vt(this))}setValue(t){if(Ka(this._$Ct))this._$Ct._$AI(t,this);else{const r=[...this._$Ct._$AH];r[this._$Ci]=t,this._$Ct._$AI(r,this,0)}}disconnected(){}reconnected(){}}/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const Wt=()=>new Za;class Za{}const wt=new WeakMap,ft=Va(class extends Xa{render(e){return S}update(e,[t]){const r=t!==this.G;return r&&this.rt(void 0),(r||this.lt!==this.ct)&&(this.G=t,this.ht=e.options?.host,this.rt(this.ct=e.element)),S}rt(e){if(this.G!==void 0)if(this.isConnected||(e=void 0),typeof this.G=="function"){const t=this.ht??globalThis;let r=wt.get(t);r===void 0&&(r=new WeakMap,wt.set(t,r)),r.get(this.G)!==void 0&&this.G.call(this.ht,void 0),r.set(this.G,e),e!==void 0&&this.G.call(this.ht,e)}else this.G.value=e}get lt(){return typeof this.G=="function"?wt.get(this.ht??globalThis)?.get(this.G):this.G?.value}disconnected(){this.lt===this.ct&&this.rt(void 0)}reconnected(){this.rt(this.ct)}});let kr=!1;function ei(){kr||(typeof $t?.addHook=="function"&&$t.addHook("afterSanitizeAttributes",e=>{e.tagName==="A"&&e.getAttribute("target")==="_blank"&&e.setAttribute("rel","noopener noreferrer")}),Mr.setOptions({gfm:!0,breaks:!1}),kr=!0)}function Rt(e){ei();const t=Mr.parse(e||"",{async:!1});return $t.sanitize(t,{ADD_ATTR:["target","rel"]})}var ti=Object.defineProperty,ri=Object.getOwnPropertyDescriptor,H=(e,t,r,a)=>{for(var s=a>1?void 0:a?ri(t,r):t,i=e.length-1,o;i>=0;i--)(o=e[i])&&(s=(a?o(t,r,s):o(s))||s);return a&&s&&ti(t,r,s),s};const Gt=5,si="ares.session-tabs.";function is(e){return`${si}${e}`}function $r(e){if(!e)return[];try{const t=localStorage.getItem(is(e));if(!t)return[];const r=JSON.parse(t);return Array.isArray(r)?r.filter(a=>a&&typeof a.id=="string").slice(0,Gt):[]}catch{return[]}}function Sr(e,t){if(e)try{localStorage.setItem(is(e),JSON.stringify(t.slice(0,Gt)))}catch{}}function ai(e,t){return[...e.filter(s=>s.id!==t.id),t].slice(-Gt)}function ii(e,t){const r=(e||"").toLowerCase();if(["png","jpg","jpeg","gif","webp","svg"].includes(r))return"image";if(r==="md"||r==="markdown")return"markdown";if(r==="json"&&typeof t=="string")try{const a=JSON.parse(t);if(a&&typeof a=="object"&&a.kind==="kpi-report")return"kpi"}catch{}return"text"}let R=class extends m{constructor(){super(...arguments),this.sessionId=null,this.open=!1,this._tabs=[],this._activeId=null,this._content=null,this._loading=!1,this._error=null,this._libraryOpen=!1,this._libraryItems=[],this._expanded=!1}updated(e){e.has("sessionId")&&(this._tabs=$r(this.sessionId||""),this._activeId=this._tabs.length>0?this._tabs[this._tabs.length-1].id:null,this._loadActiveContent()),e.has("open")&&this.open&&(this.sessionId&&(this._tabs=$r(this.sessionId)),this._loadActiveContent())}openArtifact(e){if(!this.sessionId)return;const t=`/uploads/${e.sessionId}/${encodeURIComponent(e.name)}`,r={id:e.id,name:e.name,format:e.format,sessionId:e.sessionId,url:t};this._tabs=ai(this._tabs,r),Sr(this.sessionId,this._tabs),this._activeId=r.id,this.open=!0,this.setAttribute("open",""),this._loadActiveContent()}_activeTab(){return this._tabs.find(e=>e.id===this._activeId)??null}async _loadActiveContent(){const e=this._activeTab();if(!e){this._content=null;return}const t=(e.format||"").toLowerCase();if(["png","jpg","jpeg","gif","webp","svg"].includes(t)){this._content=null;return}this._loading=!0,this._error=null;try{const r=await v(e.url);if(!r.ok)throw new Error(`fetch failed: ${r.status}`);this._content=await r.text()}catch(r){this._error=r.message,this._content=null}finally{this._loading=!1}}_activate(e){this._activeId=e,this._loadActiveContent()}_close(e,t){t.stopPropagation(),this._tabs=this._tabs.filter(r=>r.id!==e),this.sessionId&&Sr(this.sessionId,this._tabs),this._activeId===e&&(this._activeId=this._tabs.length>0?this._tabs[this._tabs.length-1].id:null,this._loadActiveContent())}_closeRail(){this.open=!1,this.removeAttribute("open"),this.dispatchEvent(new CustomEvent("rail-close",{bubbles:!0,composed:!0}))}async _toggleLibrary(){if(this._libraryOpen=!this._libraryOpen,this._libraryOpen&&this._libraryItems.length===0)try{const e=await v("/api/artifacts");if(e.ok){const t=await e.json();this._libraryItems=Array.isArray(t?.items)?t.items:[]}}catch{}}_pickFromLibrary(e){this._libraryOpen=!1,this.openArtifact(e)}_resummarize(){const e=this._activeTab();e&&this.dispatchEvent(new CustomEvent("artifact-resummarize",{detail:{tab:e},bubbles:!0,composed:!0}))}_download(){const e=this._activeTab();if(!e)return;const t=document.createElement("a");t.href=e.url,t.download=e.name,t.target="_blank",t.rel="noopener noreferrer",t.click()}_toggleExpand(){this._expanded=!this._expanded,this._expanded?this.setAttribute("expanded",""):this.removeAttribute("expanded")}render(){const e=this._activeTab();return n`
      <div class="tab-strip">
        ${this._tabs.map(t=>n`
          <div
            class="tab ${t.id===this._activeId?"active":""}"
            @click=${()=>this._activate(t.id)}
            title=${t.name}
          >
            <span class="label">${t.name}</span>
            <button class="close" @click=${r=>this._close(t.id,r)} title="Close tab">×</button>
          </div>
        `)}
        <button class="add" @click=${this._toggleLibrary} title="Open from library">+</button>
        <span class="spacer"></span>
        <span class="actions">
          <button class="sparkle" @click=${this._resummarize} title="Re-summarize">✨</button>
          <button @click=${this._download} title="Download / open">⤓</button>
          <button @click=${this._toggleExpand} title=${this._expanded?"Collapse":"Expand"}>⛶</button>
          <button class="close-rail" @click=${this._closeRail} title="Close panel">×</button>
        </span>
      </div>
      ${this._libraryOpen?this._renderLibrary():""}
      <div class="body">
        ${this._error?n`<div class="err">${this._error}</div>`:""}
        ${e?this._loading?n`<div class="empty">Loading ${e.name}…</div>`:this._renderTab(e):n`<div class="empty">No artifact open. Press + to pick from your library.</div>`}
      </div>
    `}_renderLibrary(){return n`
      <div class="lib-popover" @click=${e=>e.stopPropagation()}>
        ${this._libraryItems.length===0?n`<div class="lib-empty">No artifacts to pick from yet.</div>`:this._libraryItems.slice(0,30).map(e=>n`
              <div class="lib-row" @click=${()=>this._pickFromLibrary(e)}>
                <span>${e.name}</span>
                <span class="meta">${e.format}</span>
              </div>
            `)}
      </div>
    `}_renderTab(e){const t=ii(e.format,this._content);return t==="image"?this._renderImage(e):t==="kpi"?this._renderKpi(this._content):t==="markdown"?this._renderMarkdown(this._content||""):this._renderText(this._content||"(empty)")}_renderImage(e){return n`
      <div class="image-wrap">
        <img
          src=${e.url}
          alt=${e.name}
          @click=${t=>t.target.classList.toggle("zoomed")}
        />
        <a href=${e.url} target="_blank" rel="noopener noreferrer" style="font-size:12px;color:var(--text-2);">Open in browser ↗</a>
      </div>
    `}_renderText(e){return n`<pre class="text">${e}</pre>`}_renderMarkdown(e){const t=Rt(e),r=document.createElement("div");return r.className="markdown-body",r.innerHTML=t,n`${r}`}_renderKpi(e){let t=null;try{t=JSON.parse(e)}catch{t=null}if(!t||t.kind!=="kpi-report")return this._renderText(e);const r=Array.isArray(t.vendors)?t.vendors:[],a=Array.isArray(t.metrics)?t.metrics:[];return n`
      ${t.title?n`<div class="kpi-title">${t.title}</div>`:""}
      ${r.length>0?n`
        <div class="vendor-row">
          ${r.map(s=>{const o=`${100-Math.max(0,Math.min(100,s.progressPct??0))}%`;return n`
              <div class="vendor-tile">
                <div class="code">${s.code||""}</div>
                ${s.brand?n`<div class="brand">${s.brand}</div>`:""}
                <div class="score">${s.score||"—"}</div>
                <div class="progress-bar" style="--mask:${o};"></div>
              </div>
            `})}
        </div>
      `:""}
      ${a.length>0?n`
        <table class="metrics-table">
          <thead>
            <tr>
              <th>Metric</th>
              <th>YTD target</th>
              <th>Actual</th>
              <th>Progress</th>
            </tr>
          </thead>
          <tbody>
            ${a.map(s=>{const i=Math.max(0,Math.min(100,s.progressPct??0));return n`
                <tr>
                  <td>${s.name}</td>
                  <td>${s.target??"—"}</td>
                  <td>${s.actual??"—"}</td>
                  <td>
                    <div class="metric-progress">
                      <div class="bar"><div style="width:${i}%;"></div></div>
                      <span style="color:var(--text-3);font-size:11.5px;">${i.toFixed(0)}%</span>
                    </div>
                  </td>
                </tr>
              `})}
          </tbody>
        </table>
      `:""}
    `}};R.styles=y`
    :host {
      display: block;
      position: absolute;
      top: 0;
      right: 0;
      bottom: 0;
      width: 40%;
      background: var(--panel);
      border-left: 1px solid var(--border);
      transform: translateX(100%);
      transition: transform var(--dur-base) var(--ease-out), width var(--dur-base) var(--ease-out);
      z-index: 50;
      box-shadow: -8px 0 24px rgba(0, 0, 0, 0.3);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    :host([open]) {
      transform: translateX(0);
    }
    :host([expanded]) {
      width: 100%;
    }

    .tab-strip {
      display: flex;
      align-items: center;
      gap: 0;
      padding: 6px 6px 0;
      border-bottom: 1px solid var(--border);
      background: var(--panel);
      overflow-x: auto;
      flex-shrink: 0;
    }
    .tab {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px 9px;
      font-size: 12.5px;
      color: var(--text-2);
      cursor: pointer;
      border-bottom: 2px solid transparent;
      max-width: 200px;
      white-space: nowrap;
      transition: color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out);
    }
    .tab:hover { color: var(--text-1); }
    .tab.active {
      color: var(--text-0);
      border-bottom-color: var(--accent);
    }
    .tab .label {
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .tab button.close {
      all: unset;
      cursor: pointer;
      padding: 0 4px;
      color: var(--text-3);
      font-size: 14px;
      line-height: 1;
    }
    .tab button.close:hover { color: var(--err); }
    .tab-strip .add {
      all: unset;
      cursor: pointer;
      padding: 6px 10px;
      font-size: 14px;
      color: var(--text-3);
      transition: color var(--dur-fast) var(--ease-out);
    }
    .tab-strip .add:hover { color: var(--accent); }
    .tab-strip .spacer { flex: 1; }
    .tab-strip .actions {
      display: flex;
      gap: 4px;
      padding: 0 6px;
    }
    .tab-strip .actions button {
      all: unset;
      cursor: pointer;
      padding: 4px 8px;
      color: var(--text-3);
      font-size: 13px;
      border-radius: var(--radius-1);
      transition: background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out);
    }
    .tab-strip .actions button:hover { background: var(--panel-2); color: var(--text-1); }
    .tab-strip .actions button.close-rail:hover { color: var(--err); }
    .tab-strip .actions button.sparkle:hover { color: var(--accent); }

    .body {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding: var(--space-4) var(--space-5);
      color: var(--text-1);
      font-size: 13px;
    }
    .empty {
      padding: 60px 20px;
      text-align: center;
      color: var(--text-3);
    }
    .err {
      padding: 18px;
      color: var(--err);
      background: color-mix(in srgb, var(--err) 10%, transparent);
      border: 1px solid color-mix(in srgb, var(--err) 30%, transparent);
      border-radius: var(--radius-2);
    }

    /* image view */
    .image-wrap {
      display: flex;
      flex-direction: column;
      gap: 10px;
      align-items: flex-start;
    }
    .image-wrap img {
      max-width: 100%;
      border-radius: var(--radius-2);
      border: 1px solid var(--border);
      transform-origin: top left;
      transition: transform var(--dur-fast) var(--ease-out);
      cursor: zoom-in;
    }
    .image-wrap img.zoomed { transform: scale(2); cursor: zoom-out; }

    /* text view */
    pre.text {
      background: var(--panel-2);
      border: 1px solid var(--border);
      border-radius: var(--radius-2);
      padding: var(--space-4);
      font-family: var(--font-mono);
      font-size: 12px;
      line-height: 1.5;
      white-space: pre-wrap;
      word-wrap: break-word;
      color: var(--text-1);
      max-width: 100%;
    }
    .markdown-body :is(p, ul, ol) { margin: 0 0 10px 0; }
    .markdown-body code {
      background: var(--panel-2);
      padding: 1px 4px;
      border-radius: 4px;
      font-family: var(--font-mono);
      font-size: 0.9em;
    }
    .markdown-body pre {
      background: var(--panel-2);
      border: 1px solid var(--border);
      padding: var(--space-3);
      border-radius: var(--radius-2);
      overflow-x: auto;
      font-family: var(--font-mono);
      font-size: 12.5px;
    }

    /* KPI dashboard */
    .kpi-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-0);
      margin-bottom: var(--space-4);
    }
    .vendor-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: var(--space-3);
      margin-bottom: var(--space-5);
    }
    .vendor-tile {
      background: var(--panel-2);
      border: 1px solid var(--border);
      border-radius: var(--radius-3);
      padding: var(--space-3) var(--space-4);
    }
    .vendor-tile .code {
      font-family: var(--font-mono);
      font-size: 11px;
      color: var(--text-3);
      letter-spacing: 0.06em;
    }
    .vendor-tile .brand {
      color: var(--text-2);
      font-size: 11.5px;
      margin-top: 2px;
    }
    .vendor-tile .score {
      font-size: 22px;
      font-weight: 600;
      color: var(--text-0);
      margin-top: 6px;
    }
    .progress-bar {
      height: 6px;
      border-radius: 3px;
      margin-top: 8px;
      background: linear-gradient(
        to right,
        var(--err) 0%,
        var(--warn) 50%,
        var(--ok) 80%,
        var(--accent) 100%
      );
      position: relative;
      overflow: hidden;
    }
    .progress-bar::after {
      content: "";
      position: absolute;
      top: 0; right: 0; bottom: 0;
      background: var(--panel-2);
      width: var(--mask, 0%);
    }
    .metrics-table {
      width: 100%;
      border-collapse: collapse;
      background: var(--panel-2);
      border: 1px solid var(--border);
      border-radius: var(--radius-2);
      overflow: hidden;
    }
    .metrics-table th, .metrics-table td {
      text-align: left;
      padding: 10px 14px;
      font-size: 12.5px;
    }
    .metrics-table th {
      color: var(--text-3);
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-size: 10.5px;
      border-bottom: 1px solid var(--border);
    }
    .metrics-table td { color: var(--text-1); border-bottom: 1px solid var(--border); }
    .metrics-table tr:last-child td { border-bottom: 0; }
    .metric-progress {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .metric-progress .bar {
      flex: 1;
      max-width: 140px;
      height: 6px;
      background: var(--panel);
      border-radius: 3px;
      overflow: hidden;
    }
    .metric-progress .bar > div {
      height: 100%;
      background: linear-gradient(to right, var(--accent-dim), var(--accent));
    }

    /* Library popover */
    .lib-popover {
      position: absolute;
      top: 44px;
      left: 8px;
      background: var(--raised);
      border: 1px solid var(--border-2);
      border-radius: var(--radius-2);
      padding: 4px;
      box-shadow: 0 12px 32px rgba(0,0,0,0.4);
      z-index: 60;
      min-width: 280px;
      max-height: 320px;
      overflow-y: auto;
    }
    .lib-popover .lib-row {
      padding: 6px 10px;
      cursor: pointer;
      font-size: 12px;
      color: var(--text-1);
      border-radius: var(--radius-1);
      display: flex;
      gap: 8px;
      align-items: center;
    }
    .lib-popover .lib-row:hover { background: var(--panel-2); }
    .lib-popover .lib-row .meta {
      color: var(--text-3);
      font-size: 11px;
    }
    .lib-popover .lib-empty {
      padding: 14px;
      color: var(--text-3);
      font-size: 12px;
      text-align: center;
    }
  `;H([E({type:String})],R.prototype,"sessionId",2);H([E({type:Boolean})],R.prototype,"open",2);H([l()],R.prototype,"_tabs",2);H([l()],R.prototype,"_activeId",2);H([l()],R.prototype,"_content",2);H([l()],R.prototype,"_loading",2);H([l()],R.prototype,"_error",2);H([l()],R.prototype,"_libraryOpen",2);H([l()],R.prototype,"_libraryItems",2);H([l()],R.prototype,"_expanded",2);R=H([w("ares-session-tabs-panel")],R);var oi=Object.defineProperty,ni=Object.getOwnPropertyDescriptor,Yt=(e,t,r,a)=>{for(var s=a>1?void 0:a?ni(t,r):t,i=e.length-1,o;i>=0;i--)(o=e[i])&&(s=(a?o(t,r,s):o(s))||s);return a&&s&&oi(t,r,s),s};let Ge=class extends m{constructor(){super(...arguments),this.chart=null,this._failed=!1,this._canvasRef=Wt(),this._chartInstance=null}updated(e){e.has("chart")&&this.chart&&this.chart.chartType!=="kpi-cards"&&this.chart.chartType!=="vendor-table"&&this._renderChartJs()}disconnectedCallback(){if(super.disconnectedCallback(),this._chartInstance){try{this._chartInstance.destroy()}catch{}this._chartInstance=null}}async _renderChartJs(){const e=this.chart;if(!(!e||!this._canvasRef.value))try{const t=await ut(()=>import("./auto-C4BfjCME.js"),__vite__mapDeps([0,1])),r=t.default??t.Chart,a=getComputedStyle(this),s=a.getPropertyValue("--accent").trim()||"#9b5cf6",i=a.getPropertyValue("--ok").trim()||"#56c79f",o=a.getPropertyValue("--warn").trim()||"#f5b84c",d=a.getPropertyValue("--err").trim()||"#ef4444",c=a.getPropertyValue("--info").trim()||"#3b82f6",p=a.getPropertyValue("--text-1").trim()||"#d4d4dc",h=a.getPropertyValue("--border").trim()||"#2c2c34",u=[s,c,i,o,d,"#a855f7","#22d3ee","#84cc16"],$=e.data.datasets.map((x,T)=>({...x,backgroundColor:x.backgroundColor||u[T%u.length],borderColor:x.borderColor||u[T%u.length]}));if(this._chartInstance){try{this._chartInstance.destroy()}catch{}this._chartInstance=null}this._chartInstance=new r(this._canvasRef.value,{type:e.chartType,data:{labels:e.data.labels,datasets:$},options:{responsive:!0,maintainAspectRatio:!1,indexAxis:e.options?.indexAxis||"x",plugins:{legend:{labels:{color:p,font:{size:11}}},tooltip:{backgroundColor:"rgba(20,20,30,0.95)",titleColor:p,bodyColor:p,borderColor:h,borderWidth:1}},scales:e.chartType==="doughnut"?{}:{x:{ticks:{color:p,font:{size:10.5}},grid:{color:h,drawTicks:!1}},y:{ticks:{color:p,font:{size:10.5}},grid:{color:h,drawTicks:!1},beginAtZero:!0,stacked:!!e.options?.stacked}}}}),this._failed=!1}catch(t){console.warn("[chart-block] render failed:",t),this._failed=!0}}render(){if(!this.chart)return null;if(this._failed)return n`<div class="err">Chart render failed.</div>`;if(this.chart.chartType==="kpi-cards"){const e=this.chart;return n`
        ${e.title?n`<div class="title">${e.title}</div>`:null}
        <div class="kpi-row">
          ${e.items.map(t=>n`
            <div class="kpi-card ${t.kind}">
              <div class="label">${t.label}</div>
              <div class="value">${t.value}</div>
            </div>
          `)}
        </div>
      `}if(this.chart.chartType==="vendor-table"){const e=this.chart;return n`
        ${e.title?n`<div class="title">${e.title}</div>`:null}
        <table class="vt-table">
          <thead>
            <tr><th>Vendor</th><th>Status</th><th>Priority Action</th></tr>
          </thead>
          <tbody>
            ${e.rows.map(t=>n`
              <tr>
                <td class="vendor">${t.vendor}</td>
                <td class="status"><span class="status-dot ${t.status}"></span>${t.statusText}</td>
                <td class="action">${t.action}</td>
              </tr>
            `)}
          </tbody>
        </table>
      `}return n`
      ${this.chart.title?n`<div class="title">${this.chart.title}</div>`:null}
      <div class="chart-frame"><canvas ${ft(this._canvasRef)}></canvas></div>
    `}};Ge.styles=y`
    :host {
      display: block;
      margin: var(--space-2) 0;
      padding: var(--space-3) var(--space-4);
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: var(--radius-3);
      animation: chartIn var(--dur-base) var(--ease-out) both;
    }
    @keyframes chartIn {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @media (prefers-reduced-motion: reduce) {
      :host { animation: none; }
    }
    .title {
      font-size: 12.5px;
      font-weight: 600;
      color: var(--text-1);
      margin-bottom: 10px;
      letter-spacing: 0.01em;
    }
    .chart-frame {
      position: relative;
      height: 240px;
      width: 100%;
    }
    canvas { max-width: 100%; }

    /* KPI cards — flex row, wraps. */
    .kpi-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    .kpi-card {
      flex: 1 1 140px;
      min-width: 120px;
      padding: 10px 14px;
      background: var(--panel-2);
      border: 1px solid var(--border);
      border-radius: var(--radius-2);
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .kpi-card.green  { border-left: 3px solid var(--ok); }
    .kpi-card.yellow { border-left: 3px solid var(--warn); }
    .kpi-card.red    { border-left: 3px solid var(--err); }
    .kpi-card.info   { border-left: 3px solid var(--info); }
    .kpi-card .label {
      font-size: 10.5px;
      color: var(--text-3);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-weight: 600;
    }
    .kpi-card .value {
      font-size: 24px;
      font-weight: 600;
      color: var(--text-0);
      line-height: 1.1;
    }
    .kpi-card.yellow .value { color: var(--warn); }
    .kpi-card.red .value    { color: var(--err); }
    .kpi-card.green .value  { color: var(--ok); }

    /* Vendor table — coloured-emoji status. */
    .vt-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12.5px;
    }
    .vt-table th, .vt-table td {
      text-align: left;
      padding: 8px 10px;
      border-bottom: 1px solid var(--border);
    }
    .vt-table th { color: var(--text-3); font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
    .vt-table td.vendor { font-weight: 600; color: var(--text-0); }
    .vt-table td.status { white-space: nowrap; }
    .vt-table td.action { font-style: italic; color: var(--text-2); }
    .status-dot {
      display: inline-block;
      width: 8px; height: 8px;
      border-radius: 50%;
      margin-right: 6px;
      vertical-align: middle;
    }
    .status-dot.green  { background: var(--ok); }
    .status-dot.yellow { background: var(--warn); }
    .status-dot.red    { background: var(--err); }
    .status-dot.info   { background: var(--info); }
    .status-dot.neutral { background: var(--text-3); }

    .err {
      padding: 8px 12px;
      color: var(--err);
      font-size: 12px;
      background: color-mix(in srgb, var(--err) 12%, transparent);
      border-radius: var(--radius-2);
    }
  `;Yt([E({type:Object})],Ge.prototype,"chart",2);Yt([l()],Ge.prototype,"_failed",2);Ge=Yt([w("ares-chart-block")],Ge);var li=Object.defineProperty,ci=Object.getOwnPropertyDescriptor,k=(e,t,r,a)=>{for(var s=a>1?void 0:a?ci(t,r):t,i=e.length-1,o;i>=0;i--)(o=e[i])&&(s=(a?o(t,r,s):o(s))||s);return a&&s&&li(t,r,s),s};let g=class extends m{constructor(){super(...arguments),this.sessionId=null,this._turns=[],this._loadingSession=!1,this._composerText="",this._streaming=!1,this._queue=[],this._selectedModel="auto",this._selectedMode="standard",this._routing=(()=>{try{return localStorage.getItem("ares.routing")==="direct"?"direct":"smart"}catch{return"smart"}})(),this._appMode=(()=>{try{return localStorage.getItem("ares.mode")==="dev"?"dev":"work"}catch{return"work"}})(),this._modelChoices=[{id:"auto",label:"Auto"}],this._health=null,this._toolsModalOpen=!1,this._activeTools=[],this._attachments=[],this._uploading=!1,this._dragOver=!1,this._tabsPanelOpen=!1,this._expandedTools=new Set,this._slashOpen=!1,this._slashCommands=[],this._slashFiltered=[],this._slashIndex=0,this._suggestionSet=0,this._serverSuggestions=null,this._breakdownOpen=!1,this._breakdownLoading=!1,this._breakdownRows=[],this._breakdownError=null,this._unsubscribeHealth=null,this._abort=null,this._tailAbort=null,this._loadAbort=null,this._activeAssistant=null,this._ownsActiveTurn=!1,this._selfAssignedSessionId=null,this._lastWatchMsgCount=-1,this._flushScheduled=!1,this._proseRefs=new Map,this._unsubscribeQueue=null,this._thinkingHosts=new Map,this._thinkingRefCbs=new Map,this._liveWatchTimer=null,this._onChipsUpdated=()=>{this.requestUpdate()},this._onPaletteAction=e=>{this._streaming||queueMicrotask(()=>this._drainQueue())},this._onAppModeChange=e=>{const t=e.detail;t?.mode&&(this._appMode=t.mode)},this._userScrolledUp=!1,this._scrollListenerAttached=!1,this._onGlobalKeydown=e=>{e.key==="Escape"&&this._streaming&&this._stop()},this._loadingSid=null,this._dragDepth=0,this._onDragEnter=e=>{this._hasFiles(e)&&(e.preventDefault(),this._dragDepth+=1,this._dragOver||(this._dragOver=!0))},this._onDragOver=e=>{this._hasFiles(e)&&(e.preventDefault(),e.dataTransfer&&(e.dataTransfer.dropEffect="copy"))},this._onDragLeave=e=>{this._hasFiles(e)&&(this._dragDepth=Math.max(0,this._dragDepth-1),this._dragDepth===0&&(this._dragOver=!1))},this._onDrop=async e=>{if(!this._hasFiles(e))return;e.preventDefault(),this._dragDepth=0,this._dragOver=!1;const t=Array.from(e.dataTransfer?.files??[]);await this._uploadFiles(t)},this._onComposerInput=e=>{const t=e.target.value;this._composerText=t,this._maybeOpenSlash(t)},this._onComposerKeydown=e=>{if(this._slashOpen){if(e.key==="ArrowDown"){if(e.preventDefault(),this._slashFiltered.length===0)return;this._slashIndex=(this._slashIndex+1)%this._slashFiltered.length;return}if(e.key==="ArrowUp"){if(e.preventDefault(),this._slashFiltered.length===0)return;this._slashIndex=(this._slashIndex-1+this._slashFiltered.length)%this._slashFiltered.length;return}if(e.key==="Enter"||e.key==="Tab"){e.preventDefault();const t=this._slashFiltered[this._slashIndex];t&&this._selectSlash(t);return}if(e.key==="Escape"){e.preventDefault(),this._slashOpen=!1;return}}e.key==="Enter"&&!e.shiftKey&&(e.preventDefault(),e.metaKey||e.ctrlKey?this._enqueue():this._streaming?this._enqueue():this._send())},this._thinkingFlushScheduled=!1,this._syncScheduled=!1,this._toggleTabsPanel=()=>{this._setTabsPanelOpen(!this._tabsPanelOpen)}}_proseRef(e){let t=this._proseRefs.get(e);return t||(t=Wt(),this._proseRefs.set(e,t)),t}_thinkingHostCb(e){let t=this._thinkingRefCbs.get(e);return t||(t=r=>{if(r instanceof HTMLDivElement){this._thinkingHosts.set(e,r);const s=(this._activeAssistant&&this._activeAssistant.id===e?this._activeAssistant:this._turns.find(i=>i.kind==="assistant"&&i.id===e))?.thinkingBuffer||"";r.__lastThinkLen!==s.length&&(r.__lastThinkLen=s.length,r.textContent=s)}else this._thinkingHosts.delete(e)},this._thinkingRefCbs.set(e,t)),t}connectedCallback(){super.connectedCallback(),this._wireQueue(),this._loadModels(),this._loadServerSuggestions(),this._unsubscribeHealth=Qt(e=>{this._health=e}),document.addEventListener("keydown",this._onGlobalKeydown),document.addEventListener("ares:palette-action",this._onPaletteAction),document.addEventListener("ares:suggestion-chips-updated",this._onChipsUpdated),document.addEventListener("ares-mode-change",this._onAppModeChange),this.addEventListener("dragenter",this._onDragEnter),this.addEventListener("dragover",this._onDragOver),this.addEventListener("dragleave",this._onDragLeave),this.addEventListener("drop",this._onDrop),queueMicrotask(()=>this._consumePendingArtifactHint()),this._loadSlashCommands(),this._liveWatchTimer=window.setInterval(()=>this._liveWatchTick(),1e3)}async _liveWatchTick(){if(!(!this.sessionId||this._streaming))try{const e=await v(`/api/sessions/${this.sessionId}/stream-status`);if(!e.ok)return;const t=await e.json();if(t.active===!0){const r=this.sessionId,a=typeof t.messageCount=="number"?t.messageCount:-1,s=a>this._lastWatchMsgCount&&this._lastWatchMsgCount!==-1;if(this._lastWatchMsgCount=a,s){await this._loadSession(r);return}this._maybeAttachToStream(r)}}catch{}}async _loadServerSuggestions(){try{const e=await v("/api/suggestions");if(!e.ok)return;const t=await e.json();Array.isArray(t?.suggestions)&&t.suggestions.length&&(this._serverSuggestions=t.suggestions)}catch{}}disconnectedCallback(){if(super.disconnectedCallback(),this._unsubscribeQueue?.(),this._unsubscribeQueue=null,this._unsubscribeHealth?.(),this._unsubscribeHealth=null,this._liveWatchTimer!=null&&(clearInterval(this._liveWatchTimer),this._liveWatchTimer=null),document.removeEventListener("keydown",this._onGlobalKeydown),document.removeEventListener("ares:palette-action",this._onPaletteAction),document.removeEventListener("ares:suggestion-chips-updated",this._onChipsUpdated),document.removeEventListener("ares-mode-change",this._onAppModeChange),this.removeEventListener("dragenter",this._onDragEnter),this.removeEventListener("dragover",this._onDragOver),this.removeEventListener("dragleave",this._onDragLeave),this.removeEventListener("drop",this._onDrop),this._abort){try{this._abort.abort()}catch{}this._abort=null}if(this._tailAbort){try{this._tailAbort.abort()}catch{}this._tailAbort=null}if(this._loadAbort){try{this._loadAbort.abort()}catch{}this._loadAbort=null}}updated(e){if(e.has("sessionId")){this._wireQueue();const t=e.get("sessionId");if(!!this.sessionId&&this.sessionId===this._selfAssignedSessionId)this._selfAssignedSessionId=null;else if(this.sessionId&&t!==this.sessionId){if(this._streaming){if(this._abort){try{this._abort.abort()}catch{}this._abort=null}if(this._tailAbort){try{this._tailAbort.abort()}catch{}this._tailAbort=null}this._activeAssistant=null,this._ownsActiveTurn=!1,this._streaming=!1}this._turns=[],this._lastWatchMsgCount=-1,this._tabsPanelOpen&&this._setTabsPanelOpen(!1),this._loadSession(this.sessionId)}else if(!this.sessionId){if(this._streaming){if(this._abort){try{this._abort.abort()}catch{}this._abort=null}if(this._tailAbort){try{this._tailAbort.abort()}catch{}this._tailAbort=null}this._activeAssistant=null,this._ownsActiveTurn=!1,this._streaming=!1}if(this._turns=[],this._lastWatchMsgCount=-1,this._tabsPanelOpen&&this._setTabsPanelOpen(!1),this._loadAbort){try{this._loadAbort.abort()}catch{}this._loadAbort=null,this._loadingSid=null}this._loadingSession=!1}queueMicrotask(()=>this._consumePendingArtifactHint())}e.has("_turns")&&this._maybeAutoScroll()}_attachScrollListener(){if(this._scrollListenerAttached)return;const e=this.shadowRoot?.querySelector("#turns-scroll");e&&(this._scrollListenerAttached=!0,e.addEventListener("scroll",()=>{const t=e.scrollHeight-e.scrollTop-e.clientHeight,r=this._userScrolledUp,a=t>80;r!==a&&(this._userScrolledUp=a)},{passive:!0}))}_maybeAutoScroll(){queueMicrotask(()=>{if(this._attachScrollListener(),this._userScrolledUp)return;const e=this.shadowRoot?.querySelector("#turns-scroll");e&&(e.scrollTop=e.scrollHeight)})}_wireQueue(){this._unsubscribeQueue?.();const e=this._effectiveQueueKey();this._unsubscribeQueue=la(e,t=>{this._queue=t})}_effectiveQueueKey(){return this.sessionId||"draft"}async _loadModels(){try{const e=await v("/api/models");if(!e.ok)return;const t=await e.json(),r=Array.isArray(t)?t:t?.models;Array.isArray(r)&&(this._modelChoices=[{id:"auto",label:"Auto"},...r.map(a=>({id:a.id??a.modelId??"",label:a.label??a.name??a.id??""})).filter(a=>a.id)])}catch{}}async _loadActiveTools(){try{const e=await v("/api/tools");if(!e.ok)return;const t=await e.json(),r=Array.isArray(t)?t:t?.tools;Array.isArray(r)&&(this._activeTools=r.map(a=>({name:a.name,description:a.description})))}catch{}}async _loadSession(e){if(this._loadingSid===e&&this._loadAbort)return;if(this._loadAbort)try{this._loadAbort.abort()}catch{}const t=new AbortController;this._loadAbort=t,this._loadingSid=e,this._loadingSession=!0;try{const r=await v(`/api/sessions/${e}`,{signal:t.signal});if(t.signal.aborted)return;if(!r.ok){if(console.warn(`[chat] loadSession ${e} returned ${r.status}`),r.status===404){this._turns=[],this._loadingSession=!1;try{localStorage.removeItem("ares.last-session")}catch{}const{navigate:o}=await ut(async()=>{const{navigate:d}=await Promise.resolve().then(()=>Vs);return{navigate:d}},void 0);o({top:"chat",sub:null},{replace:!0})}return}const a=await r.json();if(t.signal.aborted)return;const s=a.messages??[],i=[];for(let o=0;o<s.length;o++){const d=s[o];if(d.role==="user"){const p=(d.content??[]).filter(h=>h.type==="text").map(h=>h.text.replace(/<context_summary\b[^>]*>[\s\S]*?<\/context_summary>/gi,"").replace(/<context_summary\b[^>]*>[\s\S]*$/gi,"").trim()).filter(h=>h.length>0&&!/^<\s*(context|relevant|memory|knowledge)/i.test(h));p.length>0&&i.push({kind:"user",id:crypto.randomUUID(),text:p.join(`
`)})}else if(d.role==="assistant"){const c=(d.content??[]).filter(x=>x.type==="text"),p=(d.content??[]).filter(x=>x.type==="tool_use"),h=s[o+1],u=new Map;if(h?.role==="user"){for(const x of h.content??[])if(x.type==="tool_result"){const T=x;let F="";typeof T.content=="string"?F=T.content:Array.isArray(T.content)&&(F=T.content.filter(st=>st.type==="text"&&typeof st.text=="string").map(st=>st.text).join(`
`)),u.set(T.tool_use_id,{output:F,isError:!!T.is_error})}}const $=p.map(x=>{const T=u.get(x.id);return{id:x.id,name:x.name,input:x.input,output:T?.output,isError:T?.isError}});i.push({kind:"assistant",id:crypto.randomUUID(),status:"done",textBuffer:c.map(x=>x.text).join(""),toolCalls:$,approvalCard:null,approvalResolved:null,heartbeat:null,prematureStop:null,toolLoopWarning:null,credentialsRefreshing:!1,errorText:null,errorKind:null,errorRecovery:null,recoveryBusy:{},chartBlocks:[],nextActionChips:[],model:null,modelMode:null})}}if(!t.signal.aborted){if(this._turns=i,this._userScrolledUp=!1,queueMicrotask(()=>{const o=this.shadowRoot?.querySelector("#turns-scroll");o&&(o.scrollTop=o.scrollHeight)}),i.length>0){const o=i[i.length-1];o?.kind==="assistant"&&(o.status="streaming")}this._maybeAttachToStream(e)}}catch(r){if(r.name==="AbortError")return;console.warn("[chat] loadSession failed:",r)}finally{this._loadAbort===t&&(this._loadAbort=null,this._loadingSid=null,this._loadingSession=!1)}}async _maybeAttachToStream(e){if(this._streaming)return;let t=null;try{const r=await v(`/api/sessions/${e}/stream-status`);if(!r.ok)return;const a=await r.json();if(!(a.active===!0||a.streamActive===!0)){let h=!1;this._turns=this._turns.map(u=>{if(u.kind==="assistant"&&(u.status==="streaming"||u.status==="thinking")){h=!0;const $=!u.textBuffer&&u.toolCalls.length===0;return{...u,status:$?"error":"done",errorText:$?u.errorText??"No response was produced.":u.errorText}}return u}),h&&this.requestUpdate();return}if(this._turns.length===0){const h={id:crypto.randomUUID(),status:"thinking",textBuffer:"",toolCalls:[],approvalCard:null,approvalResolved:null,heartbeat:null,prematureStop:null,toolLoopWarning:null,credentialsRefreshing:!1,errorText:null,errorKind:null,errorRecovery:null,recoveryBusy:{},chartBlocks:[],nextActionChips:[],model:null,modelMode:null};this._activeAssistant=h,this._turns=[...this._turns,{kind:"assistant",...h}]}else{const h=this._turns[this._turns.length-1];if(h?.kind==="assistant"&&h.status!=="done")h.textBuffer="",h.toolCalls=[],h.chartBlocks=[],h.thinkingBuffer="",h.toolArgsPreview=void 0,this._activeAssistant=h;else{const u={id:crypto.randomUUID(),status:"thinking",textBuffer:"",toolCalls:[],approvalCard:null,approvalResolved:null,heartbeat:null,prematureStop:null,toolLoopWarning:null,credentialsRefreshing:!1,errorText:null,errorKind:null,errorRecovery:null,recoveryBusy:{},chartBlocks:[],nextActionChips:[],model:null,modelMode:null};this._activeAssistant=u,this._turns=[...this._turns,{kind:"assistant",...u}]}}if(this._ownsActiveTurn=!1,this._streaming=!0,this._tailAbort)try{this._tailAbort.abort()}catch{}t=new AbortController,this._tailAbort=t;const i=await v(`/api/sessions/${e}/stream-tail?fromSeq=0`,{signal:t.signal});if(!i.ok||!i.body){this._tailAbort===t&&(this._streaming=!1,this._tailAbort=null);return}const o=i.body.getReader(),d=new TextDecoder;let c="",p=!1;for(;;){const{done:h,value:u}=await o.read();if(h)break;c+=d.decode(u,{stream:!0});const $=c.split(`
`);c=$.pop()||"";for(const x of $)if(x.startsWith("data: "))try{const T=JSON.parse(x.slice(6));if(T?.type==="tail_end")break;const F=T?.event??T;if(!F||typeof F.type!="string")continue;p=!0,this._handleEvent(F)}catch{}}if(!p){this._tailAbort===t&&(this._streaming=!1,this._activeAssistant=null,this._ownsActiveTurn=!1,this._tailAbort=null);let h=!1;this._turns=this._turns.map(u=>{if(u.kind==="assistant"&&(u.status==="streaming"||u.status==="thinking")){h=!0;const $=!u.textBuffer&&u.toolCalls.length===0;return{...u,status:$?"error":"done",errorText:$?u.errorText??"No response was produced.":u.errorText}}return u}),h&&this.requestUpdate(),document.dispatchEvent(new CustomEvent("chat-streaming",{detail:{state:"ended",terminal:"done",sessionId:this.sessionId}}));return}}catch{}finally{this._tailAbort===t&&(this._activeAssistant&&this._activeAssistant.status!=="done"&&(this._activeAssistant.status="done"),this._syncActiveAssistantTurnNow(),this._activeAssistant=null,this._ownsActiveTurn=!1,this._streaming=!1,this._tailAbort=null)}}async _onUploadClick(){const e=document.createElement("input");e.type="file",e.multiple=!0,e.onchange=async()=>{const t=Array.from(e.files??[]);await this._uploadFiles(t)},e.click()}async _uploadFiles(e){if(!e.length)return;const t=this.sessionId||crypto.randomUUID();this.sessionId||(this._selfAssignedSessionId=t,this.sessionId=t,this.dispatchEvent(new CustomEvent("session-created",{detail:{id:t},bubbles:!0,composed:!0})));const r=new FormData;for(const a of e)r.append("files",a);this._uploading=!0;try{const s=await(await v(`/api/sessions/${t}/upload`,{method:"POST",body:r})).json();Array.isArray(s?.attachments)&&(this._attachments=[...this._attachments,...s.attachments])}catch(a){console.error("[chat] upload failed:",a)}finally{this._uploading=!1}}_hasFiles(e){const t=e.dataTransfer;return t?Array.from(t.types??[]).includes("Files"):!1}_removeAttachment(e){this._attachments=this._attachments.filter(t=>t.id!==e)}_maybeOpenSlash(e){if(e.startsWith("/")&&!e.includes(" ")&&!e.includes(`
`)){const t=e.slice(1).toLowerCase();this._slashCommands.length===0&&this._loadSlashCommands(),this._slashFiltered=this._slashCommands.filter(r=>r.name.toLowerCase().startsWith(t)),this._slashIndex=0,this._slashOpen=this._slashFiltered.length>0||this._slashCommands.length===0}else this._slashOpen=!1}async _loadSlashCommands(){try{const e=await v("/api/commands?scope=browser");if(!e.ok)return;const t=await e.json();this._slashCommands=t.commands??[],this._maybeOpenSlash(this._composerText)}catch{}}_selectSlash(e){this._composerText=`/${e.name} `,this._slashOpen=!1,queueMicrotask(()=>{const t=this.shadowRoot?.querySelector("textarea.composer-input");try{t?.focus(),t?.setSelectionRange(this._composerText.length,this._composerText.length)}catch{}})}_send(){const e=this._composerText.trim();if(e){if(this._streaming)if(!this._ownsActiveTurn){if(this._abort){try{this._abort.abort()}catch{}this._abort=null}if(this._tailAbort){try{this._tailAbort.abort()}catch{}this._tailAbort=null}this._activeAssistant=null,this._ownsActiveTurn=!1,this._streaming=!1,document.dispatchEvent(new CustomEvent("chat-streaming",{detail:{state:"ended",terminal:"aborted",sessionId:this.sessionId}}))}else{try{C({variant:"warn",title:"Wait for the current response to finish, or click Stop."})}catch{}return}this._composerText="",this._dispatchTurn(e)}}_enqueue(){const e=this._composerText.trim();e&&(this._composerText="",et(this._effectiveQueueKey(),e))}_stop(){if(this._abort){try{this._abort.abort()}catch{}this._abort=null}if(this._activeAssistant&&(this._activeAssistant.status="interrupted",this._syncActiveAssistantTurn(),this._activeAssistant=null),this._streaming=!1,this.sessionId){const e=this.sessionId;v(`/api/sessions/${e}/stop`,{method:"POST"}).catch(()=>{})}document.dispatchEvent(new CustomEvent("chat-streaming",{detail:{state:"ended",terminal:"aborted",sessionId:this.sessionId}}))}_drainQueue(){if(this._streaming)return;const e=ra(this._effectiveQueueKey());e&&(sa(this._effectiveQueueKey()),this._dispatchTurn(e))}async _dispatchTurn(e){if(this._tailAbort){try{this._tailAbort.abort()}catch{}this._tailAbort=null}this._streaming=!0,document.dispatchEvent(new CustomEvent("chat-streaming",{detail:{state:"started",iter:0,elapsedSec:0,sessionId:this.sessionId}}));const t={kind:"user",id:crypto.randomUUID(),text:e};this._turns=[...this._turns,t];const r={id:crypto.randomUUID(),status:"thinking",textBuffer:"",toolCalls:[],approvalCard:null,approvalResolved:null,heartbeat:null,prematureStop:null,toolLoopWarning:null,credentialsRefreshing:!1,errorText:null,errorKind:null,errorRecovery:null,recoveryBusy:{},chartBlocks:[],nextActionChips:[],model:null,modelMode:null};this._activeAssistant=r,this._ownsActiveTurn=!0,this._turns=[...this._turns,{kind:"assistant",...r}];const a=this.sessionId||crypto.randomUUID();this.sessionId||(this._selfAssignedSessionId=a,this.sessionId=a,this.dispatchEvent(new CustomEvent("session-created",{detail:{id:a},bubbles:!0,composed:!0})),oa("draft",a));const s={sessionId:a,message:e,attachments:this._attachments,model:this._selectedModel,mode:this._selectedMode,routing:this._routing,responseStyle:(()=>{try{const o=localStorage.getItem("ares.chat.response-style");return o==="brief"||o==="detailed"?o:"balanced"}catch{return"balanced"}})(),appMode:(()=>{try{return localStorage.getItem("ares.mode")==="dev"?"dev":"work"}catch{return"work"}})(),platform:"browser-q"};this._attachments.length&&(this._attachments=[]),this._abort=new AbortController;let i="done";try{const o=await v("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(s),signal:this._abort.signal});if(!o.ok||!o.body)throw new be(o.status,`chat failed: ${o.status}`);const d=o.body.getReader(),c=new TextDecoder;let p="";for(;;){const{value:h,done:u}=await d.read();if(u)break;p+=c.decode(h,{stream:!0});const $=p.split(`

`);p=$.pop()||"";for(const x of $){const T=x.replace(/^data:\s*/,"").trim();if(!T)continue;let F;try{F=JSON.parse(T)}catch{continue}this._handleEvent(F),F.type==="premature_stop"&&(i="premature_stop"),F.type==="error"&&(i="error")}}}catch(o){const d=o.message;o.name==="AbortError"?(i="aborted",this._activeAssistant&&(this._activeAssistant.status="interrupted")):(i="error",this._activeAssistant&&(this._activeAssistant.status="error",this._activeAssistant.errorText=d)),this._syncActiveAssistantTurn()}finally{if(this._activeAssistant){const o=this._activeAssistant.status;(o==="streaming"||o==="thinking")&&(i==="error"?(this._activeAssistant.status="error",this._activeAssistant.errorText||(this._activeAssistant.errorText="The run ended without a response. This usually means a tool failed mid-step — try again.")):i==="aborted"?this._activeAssistant.status="interrupted":o==="thinking"&&!this._activeAssistant.textBuffer&&this._activeAssistant.toolCalls.length===0?(this._activeAssistant.status="error",this._activeAssistant.errorText="No response was produced. The process ended before any output — try sending again."):this._activeAssistant.status="done")}this._syncActiveAssistantTurnNow(),this._activeAssistant=null,this._ownsActiveTurn=!1,this._abort=null,this._streaming=!1}if(document.dispatchEvent(new CustomEvent("chat-streaming",{detail:{state:"ended",terminal:i,sessionId:this.sessionId}})),i==="done")try{C({variant:"success",title:"Response complete",durationMs:2400})}catch{}(i==="done"||i==="premature_stop")&&queueMicrotask(()=>this._drainQueue())}_handleEvent(e){const t=this._activeAssistant;if(t)switch(e.type){case"iteration":case"memory_used":case"session_rag_hit":case"context_compressed":case"agent_warning":case"credentials_resumed":return;case"end":(t.status==="streaming"||t.status==="thinking")&&(t.status="done",this._flushSync(),this._syncActiveAssistantTurn());return;case"model_info":{const r=e;t.model=r.model??null,t.modelMode=r.mode==="direct"?"direct":"smart",this._syncActiveAssistantTurn(),document.dispatchEvent(new CustomEvent("chat-streaming",{detail:{state:"model",model:t.model,modelMode:t.modelMode,sessionId:this.sessionId}}));return}case"text_delta":t.status="streaming",t.textBuffer+=e.text,this._scheduleFlush();return;case"thinking_start":t.status="thinking",t.thinkingBuffer==null&&(t.thinkingBuffer=""),this._syncActiveAssistantTurn();return;case"thinking_delta":t.status="thinking",t.thinkingBuffer=(t.thinkingBuffer||"")+(e.text||""),this._flushThinking();return;case"tool_call_started":t.toolArgsPreview="",t.heartbeat={iter:t.heartbeat?.iter??0,elapsedSec:t.heartbeat?.elapsedSec??0,activeTool:`preparing ${e.name||"tool"}…`},this._syncActiveAssistantTurn();return;case"tool_args_delta":t.toolArgsPreview=(t.toolArgsPreview||"")+(e.partial||""),this._scheduleFlush();return;case"tool_call":t.toolArgsPreview=void 0,t.toolCalls.some(r=>r.id===e.tool_use_id)?t.toolCalls=t.toolCalls.map(r=>r.id===e.tool_use_id?{...r,name:e.name,input:e.input}:r):t.toolCalls=[...t.toolCalls,{id:e.tool_use_id,name:e.name,input:e.input}],this._syncActiveAssistantTurn();return;case"tool_result":{t.toolCalls=t.toolCalls.map(r=>r.id===e.tool_use_id?{...r,output:e.output,isError:e.isError}:r),this._syncActiveAssistantTurn();return}case"chart_block":{const r=e.chart;r&&typeof r=="object"&&(t.chartBlocks=[...t.chartBlocks,{id:e.id||`c${t.chartBlocks.length}`,chart:r}],this._syncActiveAssistantTurn());return}case"suggested_actions":{const r=Array.isArray(e.chips)?e.chips.filter(a=>typeof a=="string"):[];t.nextActionChips=r,this._syncActiveAssistantTurn();return}case"heartbeat":t.heartbeat={iter:e.iteration,elapsedSec:e.elapsedSec,activeTool:e.activeToolName},!t.model&&e.model&&(t.model=e.model??null),this._syncActiveAssistantTurn(),document.dispatchEvent(new CustomEvent("chat-streaming",{detail:{state:"heartbeat",iter:e.iteration,elapsedSec:e.elapsedSec,activeTool:e.activeToolName,messageId:t.id,sessionId:this.sessionId}}));return;case"stalled":t.heartbeat={iter:0,elapsedSec:0,activeTool:`nudging — ${e.reason||"stalled"}`},this._syncActiveAssistantTurn();return;case"tool_loop_warning":t.toolLoopWarning={tool:e.tool,hits:e.hits},this._syncActiveAssistantTurn();return;case"credentials_refreshing":t.credentialsRefreshing=!0,this._syncActiveAssistantTurn();return;case"approval_required":t.approvalCard={approvalId:e.approvalId,toolName:e.toolName,input:e.input,classification:{risk:e.classification.risk,reason:e.classification.reason}},this._syncActiveAssistantTurn();return;case"approval_resolved":t.approvalResolved={decision:e.decision,reason:e.reason??null},this._syncActiveAssistantTurn();return;case"premature_stop":t.prematureStop={attempt:e.lastAttempt},this._syncActiveAssistantTurn();return;case"error":t.status="error",t.errorText=e.error,t.errorKind=e.kind??null,t.errorRecovery=Array.isArray(e.recovery)?e.recovery:null,this._syncActiveAssistantTurn();return;case"aborted":t.status="interrupted",this._syncActiveAssistantTurn();return;case"done":t.status="done",this._flushSync(),this._syncActiveAssistantTurn();return}}_scheduleFlush(){if(this._flushScheduled)return;this._flushScheduled=!0;const e=this._activeAssistant,t=e&&e.textBuffer.length>2e3?150:0;t>0?setTimeout(()=>requestAnimationFrame(()=>this._flushSync()),t):requestAnimationFrame(()=>this._flushSync())}_flushSync(){this._flushScheduled=!1;const e=this._activeAssistant;if(!e)return;const r=this._proseRefs.get(e.id)?.value;if(r){const a=e.textBuffer.length;if(r.__lastLen===a)return;r.__lastLen=a,r.innerHTML=Rt(e.textBuffer)}else this._syncActiveAssistantTurn()}_flushThinking(){this._thinkingFlushScheduled||(this._thinkingFlushScheduled=!0,requestAnimationFrame(()=>{this._thinkingFlushScheduled=!1;const e=this._activeAssistant;if(!e)return;const t=this._thinkingHosts.get(e.id);if(!t){this._syncActiveAssistantTurn();return}const r=e.thinkingBuffer||"";t.__lastThinkLen!==r.length&&(t.__lastThinkLen=r.length,t.textContent=r)}))}_syncActiveAssistantTurnNow(){const e=this._activeAssistant;e&&(this._turns=this._turns.map(t=>t.kind==="assistant"&&t.id===e.id?{kind:"assistant",...e}:t))}_syncActiveAssistantTurn(){this._syncScheduled||(this._syncScheduled=!0,requestAnimationFrame(()=>{this._syncScheduled=!1;const e=this._activeAssistant;if(!e){this.requestUpdate();return}this._turns=this._turns.map(t=>t.kind==="assistant"&&t.id===e.id?{kind:"assistant",...e}:t)}))}async _approve(e,t){const r=this._turns.find(s=>s.kind==="assistant"&&s.id===e);if(!r||!r.approvalCard||!this.sessionId)return;const a=t==="deny"&&prompt("Reason (optional)")||null;try{await v(`/api/sessions/${this.sessionId}/${t}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({reason:a,approvalId:r.approvalCard.approvalId})})}catch(s){console.error("[ares-chat] approval send failed:",s)}}_copy(e){navigator.clipboard.writeText(e.textBuffer)}_greetingText(){const e=new Date().getHours();let t;return e<12?t="Good morning, User!":e<17?t="Good afternoon, User!":t="Good evening, User!",{salutation:t,clause:"How can I help?"}}_populateAndSend(e){this._composerText=e,this._send()}_fillFromChip(e){this._composerText=e,queueMicrotask(()=>{const t=this.shadowRoot?.querySelector("textarea.composer-input");t?.focus(),t?.setSelectionRange(e.length,e.length)})}async _startNewConversation(){try{const t=await(await v("/api/sessions",{method:"POST"})).json();t?.id&&(location.hash=`#/chat/${t.id}`,this.dispatchEvent(new CustomEvent("session-selected",{detail:{id:t.id},bubbles:!0,composed:!0})))}catch{C({variant:"danger",title:"Failed to start new conversation"})}}async _sendToBackground(e){if(this.sessionId)try{await v(`/api/sessions/${this.sessionId}/move-to-background`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({label:`Turn ${e.slice(0,6)}`})}),C({variant:"info",title:"Moved to background",body:"Continuing without you"});const t=this._turns.find(r=>r.kind==="assistant"&&r.id===e);t&&t.kind==="assistant"&&(t.status="interrupted",this.requestUpdate())}catch{C({variant:"danger",title:"Background move failed"})}}_renderEmptyState(){const{salutation:e,clause:t}=this._greetingText();let r=[];try{const s=localStorage.getItem("ares.suggestion-chips");if(s){const i=JSON.parse(s);Array.isArray(i)&&(r=i.filter(o=>typeof o=="string"&&o.trim().length>0).slice(0,6))}}catch{}const a=r.length?r:this._serverSuggestions&&this._serverSuggestions.length?this._serverSuggestions.slice(0,4).map(s=>s.text):g._SUGGESTION_SETS[this._suggestionSet%g._SUGGESTION_SETS.length];return n`
      <div class="empty-state">
        <div class="greeting">
          ${e} <span class="gradient-clause">${t}</span>
        </div>
        <div class="empty-composer">
          ${this._appMode==="dev"?n`<div class="dev-mode-badge">DEV MODE · Opus 4.8</div>`:null}
          <div class="composer">
            ${this._slashOpen?this._renderSlashDrop():null}
            ${this._queue.length>0?this._renderQueueStrip():null}
            <div class="composer-toolbar">
              <button class="icon-btn" @click=${this._onUploadClick} title="Attach files">
                ${this._uploading?"…":"📎"}
              </button>
              <select
                .value=${this._selectedModel}
                @change=${s=>{this._selectedModel=s.target.value}}
                title="Model"
              >
                ${this._modelChoices.map(s=>n`<option value=${s.id} ?selected=${s.id===this._selectedModel}>${s.label}</option>`)}
              </select>
              <button
                class="icon-btn routing-pill ${this._routing==="direct"?"active":""}"
                @click=${()=>{this._routing=this._routing==="direct"?"smart":"direct";try{localStorage.setItem("ares.routing",this._routing)}catch{}}}
                title=${this._routing==="direct"?"Direct mode — single Bedrock turn, no MCPs (click for Smart)":"Smart mode — full agent loop (click for Direct)"}
              >${this._routing==="direct"?"Direct":"Smart"}</button>
              <button
                class="icon-btn ${this._selectedMode==="parallel"?"active":""}"
                @click=${()=>{this._selectedMode=this._selectedMode==="parallel"?"standard":"parallel"}}
                title=${this._selectedMode==="parallel"?"Parallel mode (click to disable)":"Single agent (click for parallel)"}
              >⚡</button>
              ${this._attachments.map(s=>n`
                <span class="att-chip" title=${`${s.name} (${s.kind})`}>
                  ${s.name.slice(0,24)}${s.name.length>24?"…":""}
                  <button @click=${()=>this._removeAttachment(s.id)} title="Remove">×</button>
                </span>
              `)}
            </div>
            <div class="composer-row">
              <textarea
                class="composer-input"
                rows="1"
                placeholder="Ask anything (⌘/Ctrl+Enter to queue)…"
                .value=${this._composerText}
                @input=${this._onComposerInput}
                @keydown=${this._onComposerKeydown}
              ></textarea>
              <button
                class="queue"
                @click=${this._enqueue}
                ?disabled=${!this._composerText.trim()}
                title="Add to sequence (⌘/Ctrl+Enter)"
              >Queue +</button>
              <button
                class="send"
                @click=${this._send}
                ?disabled=${!this._composerText.trim()&&this._attachments.length===0}
                title="Send (Enter)"
              >Send</button>
            </div>
          </div>
        </div>
        <div class="suggestion-row">
          ${a.map(s=>n`
            <button class="suggestion-chip" @click=${()=>this._populateAndSend(s)}>${s}</button>
          `)}
          <button
            class="suggestion-refresh"
            @click=${()=>{this._suggestionSet+=1}}
            title="Refresh suggestions"
            aria-label="Refresh suggestions"
          >↻</button>
        </div>
      </div>
      <div class="policy-footer">
        Usage is subject to <a href="https://aws.company.com/machine-learning/responsible-ai/policy/" target="_blank" rel="noopener noreferrer">AWS Responsible AI Policy ↗</a>
      </div>
    `}render(){const e=this._derivedTitle(),t=this._health?.activeTools??this._health?.totalTools??0,r=this._turns.length===0&&!this._streaming&&!this._loadingSession;return n`
      ${this._dragOver?n`
        <div class="drop-overlay" part="drop-overlay">
          <div class="drop-overlay-card">
            <div class="drop-overlay-icon">\u{1F4CE}</div>
            <div class="drop-overlay-title">Drop files to attach</div>
            <div class="drop-overlay-sub">They\u2019ll be added to your next message</div>
          </div>
        </div>
      `:null}
      ${r?this._renderEmptyState():n`
      <!-- Thread header — only shown when a conversation is active -->
      <div class="header">
        <div class="title">${e}</div>
        <a class="new-conv-link" @click=${a=>{a.preventDefault(),this._startNewConversation()}} title="Start a new conversation">⊕ New conversation</a>
        <button class="pill-btn" @click=${()=>this._openToolsModal()} title="Active tools">
          <span class="accent">${t}</span> tools
        </button>
        <button
          class="pill-btn"
          @click=${this._toggleTabsPanel}
          title=${this._tabsPanelOpen?"Hide artifact panel":"Show artifact panel"}
        >
          <span class="accent">⧉</span> Panel
        </button>
      </div>
      <div class="turns" id="turns-scroll">
          ${this._loadingSession?n`
            <div style="max-width:760px;margin:var(--space-5) auto;color:var(--text-3);font-size:13px;display:flex;align-items:center;gap:10px;">
              <span style="display:inline-block;width:14px;height:14px;border:2px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin 0.7s linear infinite;"></span>
              Loading conversation…
            </div>
          `:""}
          ${this._turns.map(a=>a.kind==="user"?this._renderUser(a):this._renderAssistant(a))}
        </div>
        ${this._userScrolledUp?n`
          <button
            class="scroll-to-bottom-btn"
            title="Scroll to latest"
            @click=${()=>{this._userScrolledUp=!1;const a=this.shadowRoot?.querySelector("#turns-scroll");a&&a.scrollTo({top:a.scrollHeight,behavior:"smooth"})}}
          >↓</button>
        `:""}
        <div class="composer-wrap">
          ${this._appMode==="dev"?n`<div class="dev-mode-badge">DEV MODE · Opus 4.8</div>`:null}
          <div class="composer">
            ${this._slashOpen?this._renderSlashDrop():null}
            ${this._queue.length>0?this._renderQueueStrip():null}
            <div class="composer-toolbar">
              <button class="icon-btn" @click=${this._onUploadClick} title="Attach files">
                ${this._uploading?"…":"📎"}
              </button>
              <select
                .value=${this._selectedModel}
                @change=${a=>{this._selectedModel=a.target.value}}
                title="Model"
              >
                ${this._modelChoices.map(a=>n`<option value=${a.id} ?selected=${a.id===this._selectedModel}>${a.label}</option>`)}
              </select>
              <button
                class="icon-btn routing-pill ${this._routing==="direct"?"active":""}"
                @click=${()=>{this._routing=this._routing==="direct"?"smart":"direct";try{localStorage.setItem("ares.routing",this._routing)}catch{}}}
                title=${this._routing==="direct"?"Direct mode — single Bedrock turn, no MCPs (click for Smart)":"Smart mode — full agent loop (click for Direct)"}
              >${this._routing==="direct"?"Direct":"Smart"}</button>
              <button
                class="icon-btn ${this._selectedMode==="parallel"?"active":""}"
                @click=${()=>{this._selectedMode=this._selectedMode==="parallel"?"standard":"parallel"}}
                title=${this._selectedMode==="parallel"?"Parallel mode (click to disable)":"Single agent (click for parallel)"}
              >⚡</button>
              ${this._attachments.map(a=>n`
                <span class="att-chip" title=${`${a.name} (${a.kind})`}>
                  ${a.name.slice(0,24)}${a.name.length>24?"…":""}
                  <button @click=${()=>this._removeAttachment(a.id)} title="Remove">×</button>
                </span>
              `)}
            </div>
            <div class="composer-row">
              <textarea
                class="composer-input"
                rows="1"
                placeholder=${this._streaming?"Type to queue the next prompt…":"Ask anything (⌘/Ctrl+Enter to queue)…"}
                .value=${this._composerText}
                @input=${this._onComposerInput}
                @keydown=${this._onComposerKeydown}
              ></textarea>
              ${this._streaming?n`
                <button class="stop" @click=${this._stop} title="Stop (Esc)">Stop</button>
                <button class="queue" @click=${this._enqueue} title="Add to queue">Queue +</button>
              `:n`
                <button
                  class="queue"
                  @click=${this._enqueue}
                  ?disabled=${!this._composerText.trim()}
                  title="Add to sequence (⌘/Ctrl+Enter)"
                >Queue +</button>
                <button
                  class="send"
                  @click=${this._send}
                  ?disabled=${!this._composerText.trim()&&this._attachments.length===0}
                  title="Send (Enter)"
                >Send</button>
              `}
            </div>
          </div>
          <div class="footer-hint">
            <span><kbd>Enter</kbd> send</span>
            <span><kbd>⌘ ↩</kbd> queue</span>
            <span><kbd>Esc</kbd> stop</span>
            <span>${this._queue.length>0?`${this._queue.length} queued`:""}</span>
          </div>
        </div>
      `}
      ${this._toolsModalOpen?this._renderToolsModal():""}
      ${this._breakdownOpen?this._renderBreakdownModal():""}
      <ares-session-tabs-panel
        id="tabs-panel"
        .sessionId=${this.sessionId}
        ?open=${this._tabsPanelOpen}
        @rail-close=${()=>this._setTabsPanelOpen(!1)}
      ></ares-session-tabs-panel>
    `}_setTabsPanelOpen(e){this._tabsPanelOpen=e,e?this.setAttribute("data-tabs-panel","open"):this.removeAttribute("data-tabs-panel")}_toggleToolExpand(e){const t=new Set(this._expandedTools);t.has(e)?t.delete(e):t.add(e),this._expandedTools=t}_consumePendingArtifactHint(){let e=null;try{e=sessionStorage.getItem("ares.open-artifact")}catch{return}if(e)try{const t=JSON.parse(e);if(!t?.artifactId||!t.sessionId||this.sessionId&&t.sessionId!==this.sessionId)return;sessionStorage.removeItem("ares.open-artifact"),v("/api/artifacts").then(async r=>{if(!r.ok)return;const a=await r.json(),i=(Array.isArray(a?.items)?a.items:[]).find(d=>d.id===t.artifactId);if(!i)return;const o=this.shadowRoot?.querySelector("#tabs-panel");o&&(this._setTabsPanelOpen(!0),o.openArtifact({id:i.id,name:i.name,format:i.format,sessionId:i.sessionId}))})}catch{}}_derivedTitle(){const e=this._turns.find(t=>t.kind==="user");if(e?.text){const t=e.text.trim().replace(/\s+/g," ");return t.length>70?t.slice(0,70)+"…":t}return this.sessionId?"Untitled chat":"New chat"}_openToolsModal(){this._toolsModalOpen=!0,this._loadActiveTools()}_closeToolsModal(){this._toolsModalOpen=!1}_renderToolsModal(){return n`
      <div class="modal-back" @click=${this._closeToolsModal}>
        <div class="modal" @click=${e=>e.stopPropagation()}>
          <header>
            <h2>Active tools (${this._activeTools.length})</h2>
            <button @click=${this._closeToolsModal} title="Close">×</button>
          </header>
          <div class="body">
            ${this._activeTools.length===0?n`
              <div style="padding: 16px; color: var(--text-3);">
                Loading tools…
              </div>
            `:this._activeTools.map(e=>n`
              <div class="tool-row">
                ${e.name}
                ${e.description?n`<div class="desc">${e.description}</div>`:""}
              </div>
            `)}
          </div>
        </div>
      </div>
    `}_renderUser(e){const t=this._turns.findIndex(a=>a.kind==="user"&&a.id===e.id),r=(e.text??"").replace(/^\s+|\s+$/g,"");return n`<div class="turn user"><div class="user-bubble"><span class="ub-text">${r}</span><button class="edit-btn" title="Edit & branch" @click=${()=>this._editAndBranch(e.text,t)}>✎</button></div></div>`}async _editAndBranch(e,t){if(!this.sessionId)return;const r=window.prompt("Edit your message — a new branched session will start from here:",e);if(!r||r.trim()===e.trim()||!r.trim())return;let a=-1;for(let s=0;s<this._turns.length&&(this._turns[s].kind==="user"&&a++,s!==t);s++);if(!(a<0))try{const s=await _(`/api/sessions/${this.sessionId}`);let i=-1,o=-1;for(let p=0;p<(s.messages||[]).length;p++){const h=s.messages[p];if(h?.role==="user"&&!(Array.isArray(h.content)&&h.content.every(u=>u?.type==="tool_result"))&&(i++,i===a)){o=p;break}}if(o<0){C({variant:"danger",title:"Couldn't locate the message to branch from"});return}const d=await v(`/api/sessions/${this.sessionId}/branch`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({fromMessageIdx:o,newText:r.trim()})}),c=await d.json();if(!d.ok||!c.sessionId){C({variant:"danger",title:c.error||"Branch failed"});return}C({variant:"info",title:"Branched — opening new session"}),location.hash=`#/chat/${c.sessionId}`,this.dispatchEvent(new CustomEvent("session-selected",{detail:{id:c.sessionId},bubbles:!0,composed:!0}))}catch(s){C({variant:"danger",title:`Branch failed: ${s?.message||s}`})}}_renderAssistant(e){const t=this._proseRef(e.id);queueMicrotask(()=>{const c=t.value;if(!c||!e.textBuffer)return;const p=e.textBuffer.length;c.__lastLen!==p&&(c.__lastLen=p,c.innerHTML=Rt(e.textBuffer))});const r=(e.status==="thinking"||e.status==="streaming")&&!e.textBuffer&&e.toolCalls.length===0,a=e.status==="streaming"||e.status==="thinking",s=(this._expandedTools||new Set).has(`__thinking_${e.id}`),i=a&&!e.textBuffer||s&&!!e.thinkingBuffer,o=(()=>{const c=e.model||"";return c?/opus-4-8/.test(c)?"Opus 4.8":/opus-4-7/.test(c)?"Opus 4.7":/opus-4-6/.test(c)?"Opus 4.6":/sonnet-4-6/.test(c)?"Sonnet 4.6":/sonnet-4-5/.test(c)?"Sonnet 4.5":/haiku-4-5/.test(c)?"Haiku 4.5":c.replace(/^us\.anthropic\./,"").split(".")[0]:null})(),d=e.heartbeat?.activeTool?`Running ${e.heartbeat.activeTool}…`:e.heartbeat?.iter?`${o?o+" · ":""}Thinking · iter ${e.heartbeat.iter} · ${e.heartbeat.elapsedSec}s`:o?`${o} is thinking…`:"Thinking";return n`
      <div class="turn assistant ${e.status}">
        <div class="assistant-card">
          ${i?n`
            <div class="thinking-indicator">
              <button
                class="thinking-header ${s?"expanded":""}"
                @click=${()=>this._toggleToolExpand(`__thinking_${e.id}`)}
                title="${s?"Hide reasoning":"Show reasoning"}"
              >
                <span class="thinking-dots"><span></span><span></span><span></span></span>
                <span class="thinking-label label">${d}</span>
                <span class="chevron">▼</span>
              </button>
              ${s?n`
                <div class="thinking-body">
                  ${e.thinkingBuffer?n`
                    <div class="thinking-reasoning" ${ft(this._thinkingHostCb(e.id))}></div>
                  `:""}
                  ${e.toolCalls.length>0?e.toolCalls.map(c=>n`<div>→ ${c.name}${c.output?" ✓":" ⋯"}</div>`):e.thinkingBuffer?"":n`<div style="color: var(--text-3); font-style: italic;">Working on it… (reasoning + tool calls appear here live)</div>`}
                  ${e.toolArgsPreview?n`
                    <div class="tool-args-preview">⋯ preparing call · <code>${e.toolArgsPreview.slice(0,300)}</code></div>
                  `:""}
                  ${e.heartbeat?n`<div style="margin-top: 8px; opacity: 0.7;">iter ${e.heartbeat.iter} · ${e.heartbeat.elapsedSec}s elapsed</div>`:""}
                </div>
              `:""}
            </div>
          `:""}
          ${r&&!s?n`
            <div class="assistant-skeleton">
              <div class="skel-line"></div>
              <div class="skel-line"></div>
              <div class="skel-line"></div>
            </div>
          `:""}
          <div class="prose" ${ft(t)}></div>
          ${a&&e.textBuffer?n`<span class="stream-cursor"></span>`:""}
          ${e.toolCalls.map(c=>n`
            <div
              class="tool-card ${c.isError?"error":""} ${(this._expandedTools||new Set).has(c.id)?"expanded":""}"
              @click=${()=>this._toggleToolExpand(c.id)}
            >
              <div class="tool-header">
                <span class="tool-toggle">▸</span>
                <span class="name">${c.name}</span>
                <span class="tool-status">
                  ${c.output!=null?n`<span class="dot ${c.isError?"error":"done"}"></span> ${c.isError?"error":"done"}`:n`<span class="dot running"></span> running`}
                </span>
              </div>
              ${(this._expandedTools||new Set).has(c.id)&&c.output?n`
                <div class="tool-output">${c.output}</div>
              `:""}
            </div>
          `)}
          ${e.status==="thinking"||e.status==="streaming"?n`
            <button class="bg-btn" @click=${()=>this._sendToBackground(e.id)}>↗ Send to background</button>
          `:""}
          ${e.chartBlocks.map(c=>n`
            <ares-chart-block .chart=${c.chart}></ares-chart-block>
          `)}
          ${e.status==="done"&&e.nextActionChips?.length?n`
            <div class="next-actions">
              <div class="next-actions-label">What would you like to focus on next?</div>
              <div class="next-actions-row">
                ${e.nextActionChips.map((c,p)=>n`
                  <button class="next-chip" style="--i:${p}" @click=${()=>this._fillFromChip(c)}>${c}</button>
                `)}
              </div>
            </div>
          `:""}
          ${e.heartbeat?n`
            <div class="heartbeat-strip">
              iter ${e.heartbeat.iter} · ${e.heartbeat.elapsedSec}s elapsed
              ${e.heartbeat.activeTool?n` · ${e.heartbeat.activeTool}`:""}
            </div>
          `:""}
          ${e.toolLoopWarning?n`
            <div class="loop-chip">⚠ ${e.toolLoopWarning.tool} called ${e.toolLoopWarning.hits}× — different approach?</div>
          `:""}
          ${e.credentialsRefreshing?n`<div class="cred-chip">🔄 Refreshing credentials…</div>`:""}
          ${e.prematureStop?n`
            <div class="premature-chip">Premature stop after ${e.prematureStop.attempt} nudges — incomplete</div>
          `:""}
          ${e.approvalCard?this._renderApprovalCard(e):""}
          ${e.errorText?this._renderErrorCard(e):""}
          ${e.status==="interrupted"?n`<div class="stall-chip">Generation stopped.</div>`:""}
          <div class="actions-row">
            <button @click=${()=>this._copy(e)} title="Copy text">Copy</button>
          </div>
        </div>
      </div>
    `}_renderApprovalCard(e){const t=e.approvalCard,r=e.approvalResolved,a=(()=>{try{return JSON.stringify(t.input,null,2)}catch{return String(t.input)}})();return n`
      <div class="approval-card" data-risk=${t.classification.risk}>
        <div class="head">${t.classification.risk==="high"?"⚠ High-risk tool — confirm":"Confirm tool call"}</div>
        <div class="reason">${t.classification.reason}</div>
        <pre>${t.toolName}\n${a}</pre>
        ${r?n`
          <div class="stamp">${r.decision==="approve"?"✓ Approved":`✗ Denied${r.reason?` — ${r.reason}`:""}`}</div>
        `:n`
          <div class="actions">
            <button class="approve" @click=${()=>this._approve(e.id,"approve")}>Approve</button>
            <button class="deny" @click=${()=>this._approve(e.id,"deny")}>Deny</button>
          </div>
        `}
      </div>
    `}_recoveryGlyph(e){return g._RECOVERY_GLYPHS[e]??"•"}async _onRecoveryAction(e,t){if(!e.recoveryBusy?.[t.id]){if(t.id==="show-breakdown"){this._openBreakdownModal();return}e.recoveryBusy={...e.recoveryBusy,[t.id]:!0},this._syncTurnSnapshot(e);try{const a={method:(t.method||"POST").toUpperCase()};let s=t.endpoint;this.sessionId&&!/[?&]sessionId=/.test(s)&&(s+=(s.includes("?")?"&":"?")+`sessionId=${encodeURIComponent(this.sessionId)}`);const i=await v(s,a);if(!i.ok){console.warn("[ares-chat] recovery action failed:",t.id,i.status);return}let o=null;try{o=await i.json()}catch{}this.dispatchEvent(new CustomEvent("recovery-applied",{detail:{actionId:t.id,sessionId:this.sessionId,payload:o},bubbles:!0,composed:!0})),e.errorText=null,e.errorRecovery=null,e.errorKind=null,this._syncTurnSnapshot(e)}catch(r){console.warn("[ares-chat] recovery action threw:",r)}finally{e.recoveryBusy={...e.recoveryBusy,[t.id]:!1},this._syncTurnSnapshot(e)}}}_syncTurnSnapshot(e){this._turns=this._turns.map(t=>t.kind==="assistant"&&t.id===e.id?{...e}:t)}_renderErrorCard(e){const t=e.errorRecovery??[],r=e.errorKind==="preflight_too_large"?"Context too large":"Error";return n`
      <div class="error-card" data-kind=${e.errorKind??"generic"}>
        <div class="err-head">${r}</div>
        <div class="err-body">${e.errorText}</div>
        ${t.length>0?n`
          <div class="recovery-row" role="group" aria-label="Recovery actions">
            ${t.map(a=>{const s=!!e.recoveryBusy?.[a.id];return n`
                <button
                  class="recovery-pill ${s?"busy":""}"
                  ?disabled=${s}
                  data-action-id=${a.id}
                  @click=${()=>this._onRecoveryAction(e,a)}
                  title=${a.label}
                >
                  <span class="glyph" aria-hidden="true">${this._recoveryGlyph(a.id)}</span>
                  <span class="label">${a.label}</span>
                </button>
              `})}
          </div>
        `:""}
      </div>
    `}async _openBreakdownModal(){this._breakdownOpen=!0,this._breakdownLoading=!0,this._breakdownError=null,this._breakdownRows=[];try{const e=this.sessionId?`?sessionId=${encodeURIComponent(this.sessionId)}`:"",t=await v(`/api/dev/prompt-debug${e}`);if(!t.ok){this._breakdownError=`Server returned ${t.status}`;return}const r=await t.json(),a=Array.isArray(r.breakdown)?r.breakdown:Array.isArray(r.sections)?r.sections:[];this._breakdownRows=a}catch(e){this._breakdownError=e.message}finally{this._breakdownLoading=!1}}_closeBreakdownModal(){this._breakdownOpen=!1,this._breakdownRows=[],this._breakdownError=null}_renderBreakdownModal(){return n`
      <div class="breakdown-modal-back" @click=${this._closeBreakdownModal}>
        <div class="breakdown-modal" @click=${e=>e.stopPropagation()}>
          <header>
            <h2>Prompt token breakdown</h2>
            <button @click=${this._closeBreakdownModal} title="Close">×</button>
          </header>
          <div class="body">
            ${this._breakdownLoading?n`
              <div style="color:var(--text-3);padding:8px 0;">Loading…</div>
            `:this._breakdownError?n`
              <div style="color:var(--err);padding:8px 0;">Failed to load: ${this._breakdownError}</div>
            `:this._breakdownRows.length===0?n`
              <div style="color:var(--text-3);padding:8px 0;">No breakdown returned.</div>
            `:n`
              <table>
                <thead>
                  <tr>
                    <th>Section</th>
                    <th class="num">Tokens</th>
                    <th class="num">%</th>
                  </tr>
                </thead>
                <tbody>
                  ${this._breakdownRows.map(e=>n`
                    <tr>
                      <td>${e.label}</td>
                      <td class="num">${e.tokens.toLocaleString()}</td>
                      <td class="num">${e.pct!=null?`${e.pct.toFixed(1)}%`:"—"}</td>
                    </tr>
                  `)}
                </tbody>
              </table>
            `}
          </div>
        </div>
      </div>
    `}_renderSlashDrop(){return this._slashFiltered.length===0?n`
        <div class="slash-drop" role="listbox" aria-label="Slash commands">
          <div class="slash-empty">No matching commands.</div>
        </div>
      `:n`
      <div class="slash-drop" role="listbox" aria-label="Slash commands">
        ${this._slashFiltered.map((e,t)=>n`
          <div
            class=${`slash-row ${t===this._slashIndex?"active":""}`}
            role="option"
            aria-selected=${t===this._slashIndex?"true":"false"}
            @mouseenter=${()=>{this._slashIndex=t}}
            @mousedown=${r=>{r.preventDefault(),this._selectSlash(e)}}
          >
            <span class="name">/${e.name}</span>
            ${e.description?n`<span class="desc">${e.description}</span>`:""}
          </div>
        `)}
      </div>
    `}_renderQueueStrip(){return n`
      <div class="queue-strip" aria-label="Sequence queue">
        ${this._queue.map((e,t)=>n`
          <div class="chip" title=${e}>
            <span class="index">${t+1}.</span>
            <span class="label">${e}</span>
            <button @click=${()=>aa(this._effectiveQueueKey(),t)} title="Remove">×</button>
          </div>
        `)}
        ${this._queue.length>1?n`
          <button class="clear-all" @click=${()=>ia(this._effectiveQueueKey())}>Clear ${na(this._effectiveQueueKey())}</button>
        `:""}
      </div>
    `}};g.styles=y`
    :host {
      display: flex;
      flex-direction: column;
      /* Force the host to fill the full available height so the flex
       * layout works: .turns gets flex:1 (scrollable) and .composer-wrap
       * stays pinned at the bottom. Without a definite height, the flex
       * column just grows to content height and the composer floats in
       * the middle. */
      height: 100%;
      max-height: 100%;
      min-height: 0;
      background: var(--bg);
      position: relative;
      /* Q-pass-4 (Phase 0b) — clip absolutely-positioned descendants
       * (.policy-footer, .owl-mascot) and scroll overflow so that text
       * cannot bleed past the top or bottom of the chat viewport when
       * the empty-state and the active stream are toggled. The
       * isolation:isolate declaration gives this host a fresh stacking
       * context so the right-rail panel and any modal layered inside
       * the shadow root don't leak into other Lit elements. */
      overflow: hidden;
      isolation: isolate;
    }
    /* Drag-and-drop file-attach overlay (host-level DnD). */
    .drop-overlay {
      position: absolute;
      inset: 0;
      z-index: 50;
      display: flex;
      align-items: center;
      justify-content: center;
      background: color-mix(in srgb, var(--bg) 70%, transparent);
      backdrop-filter: blur(2px);
      border: 2px dashed var(--accent);
      border-radius: 12px;
      pointer-events: none;
      animation: dropFade 0.12s ease-out;
    }
    @keyframes dropFade { from { opacity: 0; } to { opacity: 1; } }
    .drop-overlay-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 24px 32px;
      background: var(--bg-2, var(--bg));
      border: 1px solid var(--border);
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    }
    .drop-overlay-icon { font-size: 32px; }
    .drop-overlay-title { font-size: 15px; font-weight: 600; color: var(--text-1, var(--text)); }
    .drop-overlay-sub { font-size: 12px; color: var(--text-3); }
    /* Q-pass-5 close-out — when the artifact side-panel is open, the
     * panel itself is a position:absolute overlay (40% wide, right-
     * anchored). We only need to inset the *scrolling thread* so
     * messages don't slide under the overlay; the empty-state +
     * hero composer should stay centred in the full main area so
     * the greeting + composer never feel left-shifted. The legacy
     * rule (padding-right: 40% on :host) reserved dead space on the
     * right of the empty-state too, which is the bug the user hit:
     * the composer sat in the left 60% of an otherwise empty
     * viewport. */
    .turns,
    .composer-wrap {
      transition: padding-right var(--dur-base) var(--ease-out);
    }
    :host([data-tabs-panel="open"]) .turns,
    :host([data-tabs-panel="open"]) .composer-wrap {
      padding-right: 40%;
    }
    .turns {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding: var(--space-5) var(--space-6);
      scroll-behavior: smooth;
      /* 3D viewing context so child translateZ on turns/cards projects. */
      perspective: var(--perspective, 1000px);
      perspective-origin: 50% 30%;
      /* Thread reveal on mount. */
      animation: turnsReveal var(--dur-slow) var(--ease-out) both;
    }
    @keyframes turnsReveal {
      from { opacity: 0; transform: translateY(20px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .turn {
      max-width: 760px;
      margin: 0 auto var(--space-5) auto;
      /* 3D depth entrance — replaces flat translateY fade. */
      animation: msgFadeIn var(--dur-base) var(--ease-out) both;
      /* Preserve 3D so child transforms (user-bubble, assistant-card)
       * inline perspective() in keyframes handles the 3D context. */
      will-change: transform, opacity;
    }
    /* Q-pass-5 P3-3 — chat density variants. main.ts bootstraps the
     * data-density attr on <html>; we read it via :host-context. */
    :host-context(html[data-density="compact"]) .turn {
      margin-bottom: var(--space-3);
    }
    :host-context(html[data-density="compact"]) .user-bubble,
    :host-context(html[data-density="compact"]) .assistant-card {
      font-size: 13px;
    }
    :host-context(html[data-density="comfortable"]) .turn {
      margin-bottom: var(--space-7, 28px);
    }
    :host-context(html[data-density="comfortable"]) .user-bubble {
      padding: 12px 18px;
    }
    @keyframes msgFadeIn {
      /* Subtle 3D depth entrance. Starts near-visible (opacity 0.001, not 0)
       * so a trapped from-frame is still readable. Gentle lift, no harsh tilt. */
      from { opacity: 0.001; transform: perspective(1200px) translateY(10px) translateZ(-24px) rotateX(3deg); }
      to   { opacity: 1;     transform: perspective(1200px) translateY(0)    translateZ(0)     rotateX(0deg); }
    }
    /* CRITICAL: the streaming/active turn re-renders every token, which
     * can abort+restart the entrance animation and (with fill:both) trap
     * it at the opacity:0 from-frame — making the response disappear.
     * So the live turn never runs the entrance; it is always fully visible. */
    .turn.assistant.streaming,
    .turn.assistant.thinking,
    .turn.assistant.done,
    .turn.assistant.error,
    .turn.assistant.interrupted {
      animation: none !important;
      opacity: 1 !important;
      transform: none !important;
    }
    /* Hard floor: once the entrance animation has finished (fill:both keeps
     * the end-frame), the turn is opacity:1. If for ANY reason the animation
     * is removed/aborted, this guarantees content is never stuck invisible. */
    @media (prefers-reduced-motion: reduce) {
      .turn { animation: none !important; opacity: 1 !important; transform: none !important; }
    }
    .turn.user {
      /* Block + text-align:right (NOT flex). A flex row stretched the
       * bubble on the cross axis and fought width:fit-content, producing
       * a tall narrow box for short messages. inline-block hugs content
       * in both dimensions, so the bubble auto-sizes to the message. */
      display: block;
      text-align: right;
    }
    .user-bubble {
      display: inline-block;
      text-align: left;
      vertical-align: top;
      background: color-mix(in srgb, var(--accent) 16%, var(--panel));
      border: 1px solid color-mix(in srgb, var(--accent) 26%, var(--border));
      color: var(--text-0);
      padding: 10px 15px;
      border-radius: 16px 16px 4px 16px;
      max-width: min(78%, 620px);
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      word-break: normal;
      font-size: 14px;
      line-height: 1.5;
      position: relative;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
      transition: transform var(--dur-base) var(--ease-out), box-shadow var(--dur-base) var(--ease-out);
    }
    .turn.user:hover .user-bubble {
      transform: perspective(900px) translateZ(var(--z-lift-sm, 10px)) rotateX(calc(var(--tilt-max, 9deg) * -0.4));
      box-shadow: var(--depth-shadow), 0 0 0 1px color-mix(in srgb, var(--accent) 24%, transparent);
    }
    .user-bubble .ub-text {
      display: block;
    }
    /* Edit-message button — inside the bubble, top-right, small. */
    .user-bubble .edit-btn {
      all: unset;
      cursor: pointer;
      position: absolute;
      top: 6px;
      right: 6px;
      width: 20px; height: 20px;
      display: grid; place-items: center;
      border-radius: 50%;
      color: var(--text-3);
      background: color-mix(in srgb, var(--panel) 80%, transparent);
      font-size: 10px;
      opacity: 0;
      transition: opacity var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out);
    }
    .turn.user:hover .user-bubble .edit-btn { opacity: 0.8; }
    .user-bubble .edit-btn:hover { opacity: 1; color: var(--accent); }
    .assistant-card {
      background: transparent;
      color: var(--text-1);
      font-size: 14px;
      line-height: 1.65;
      max-width: 100%;

      /* Claude-style: assistant content occupies the centered column,
       * no pill background, generous line-height for readability. */
    }
    .assistant-card .prose :is(p, ul, ol) { margin: 0 0 14px 0; }
    .assistant-card .prose p { line-height: 1.7; }
    .assistant-card .prose code {
      background: color-mix(in srgb, var(--text-0) 8%, transparent);
      padding: 1.5px 5px;
      border-radius: 4px;
      font-family: var(--font-mono);
      font-size: 0.88em;
    }
    .assistant-card .prose pre {
      background: var(--panel-2);
      border: 1px solid var(--border);
      padding: var(--space-3) var(--space-4);
      border-radius: var(--radius-3);
      overflow-x: auto;
      font-family: var(--font-mono);
      font-size: 12.5px;
      margin: 12px 0 16px 0;
      line-height: 1.55;
    }
    .assistant-card .prose pre code {
      background: transparent;
      padding: 0;
      border-radius: 0;
      font-size: inherit;
    }
    .assistant-card .prose h1 { font-size: 22px; font-weight: 600; margin: 24px 0 12px; }
    .assistant-card .prose h2 { font-size: 18px; font-weight: 600; margin: 20px 0 10px; }
    .assistant-card .prose h3 { font-size: 16px; font-weight: 600; margin: 18px 0 8px; }
    .assistant-card .prose ul,
    .assistant-card .prose ol { padding-left: 22px; }
    .assistant-card .prose li { margin-bottom: 4px; }
    .assistant-card .prose blockquote {
      border-left: 2px solid var(--border-2);
      padding-left: 14px;
      color: var(--text-2);
      font-style: italic;
      margin: 14px 0;
    }
    .assistant-card .prose table {
      border-collapse: collapse;
      width: 100%;
      font-size: 13px;
      margin: 12px 0;
    }
    .assistant-card .prose th,
    .assistant-card .prose td {
      border: 1px solid var(--border);
      padding: 8px 12px;
      text-align: left;
    }
    .assistant-card .prose th {
      background: var(--panel-2);
      font-weight: 500;
      color: var(--text-0);
    }
    /* Skeleton loader — 3 pulsing lines shown briefly before first token */
    .assistant-skeleton {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 8px;
    }
    .assistant-skeleton .skel-line {
      height: 14px;
      border-radius: 4px;
      background: linear-gradient(
        90deg,
        var(--panel-2) 0%,
        color-mix(in srgb, var(--panel-2) 60%, var(--text-3)) 50%,
        var(--panel-2) 100%
      );
      background-size: 200% 100%;
      animation: skelShimmer 1.6s ease-in-out infinite;
    }
    .assistant-skeleton .skel-line:nth-child(1) { width: 92%; }
    .assistant-skeleton .skel-line:nth-child(2) { width: 78%; }
    .assistant-skeleton .skel-line:nth-child(3) { width: 88%; }
    @keyframes skelShimmer {
      0%   { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    /* Streaming cursor — blinking caret at end of last paragraph */
    .stream-cursor {
      display: inline-block;
      width: 2px;
      height: 1em;
      background: var(--accent);
      margin-left: 2px;
      vertical-align: text-bottom;
      animation: cursorBlink 0.9s step-end infinite;
    }
    @keyframes cursorBlink {
      0%, 100% { opacity: 1; }
      50%      { opacity: 0; }
    }
    @media (prefers-reduced-motion: reduce) {
      .stream-cursor { animation: none; opacity: 1; }
      .skel-line { animation: none; }
    }
    .tool-card {
      margin-top: var(--space-2);
      padding: 10px 14px;
      background: var(--panel-2);
      border: 1px solid var(--border);
      border-radius: var(--radius-2);
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--text-2);
      cursor: pointer;
      user-select: none;
    }
    .tool-card.error { border-color: var(--err); }
    .tool-card .tool-header {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .tool-card .tool-toggle {
      color: var(--text-3);
      font-size: 10px;
      transition: transform var(--dur-fast) var(--ease-out);
    }
    .tool-card.expanded .tool-toggle { transform: rotate(90deg); }
    .tool-card .name { color: var(--text-1); font-weight: 500; flex: 1; }
    .tool-card .tool-status {
      font-size: 11px;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .tool-card .tool-status .dot {
      width: 6px; height: 6px; border-radius: 50%;
    }
    .tool-card .tool-status .dot.done { background: var(--ok); }
    .tool-card .tool-status .dot.running { background: var(--warn); animation: pulse 1.5s ease-in-out infinite; }
    .tool-card .tool-status .dot.error { background: var(--err); }
    .tool-card .tool-output {
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid var(--border);
      white-space: pre-wrap;
      word-break: break-word;
      font-size: 11px;
      color: var(--text-2);
      max-height: 300px;
      overflow-y: auto;
    }
    .tool-card.error .tool-output { color: var(--err); }
    .tool-running {
      color: var(--text-3);
      font-style: italic;
      animation: pulse 1.5s ease-in-out infinite;
    }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

    /* Claude-style thinking block — collapsible, with pulsing dots and
     * a chevron. Body uses monospace + subtle background. */
    .thinking-indicator {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 4px 0 8px 0;
      animation: ares-fade-slide-up var(--dur-base) var(--ease-out) both;
    }
    .thinking-header {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      color: var(--text-3);
      font-size: 13px;
      transition: color var(--dur-fast) var(--ease-out);
      user-select: none;
      width: fit-content;
      background: none;
      border: none;
      padding: 0;
    }
    .thinking-header:hover { color: var(--text-1); }
    .thinking-header .label { font-weight: 500; }
    .thinking-header .chevron {
      font-size: 10px;
      transition: transform var(--dur-fast) var(--ease-out);
      opacity: 0.6;
    }
    .thinking-header.expanded .chevron { transform: rotate(180deg); }
    .thinking-dots {
      display: inline-flex;
      gap: 3px;
      align-items: center;
    }
    .thinking-dots span {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: var(--accent);
      animation: thinkingDot 1.2s ease-in-out infinite;
    }
    .thinking-dots span:nth-child(2) { animation-delay: 0.2s; }
    .thinking-dots span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes thinkingDot {
      0%, 100% { opacity: 0.3; transform: scale(0.7); }
      50%      { opacity: 1;   transform: scale(1); }
    }
    .thinking-body {
      margin-top: 4px;
      padding: 12px 14px;
      background: color-mix(in srgb, var(--accent) 6%, var(--panel-2));
      border: 1px solid color-mix(in srgb, var(--accent) 18%, var(--border));
      border-radius: var(--radius-3);
      font-family: var(--font-mono);
      font-size: 12px;
      line-height: 1.65;
      color: var(--text-2);
      max-height: 320px;
      overflow-y: auto;
      white-space: pre-wrap;
      word-break: break-word;
      animation: ares-fade-slide-up var(--dur-base) var(--ease-out) both;
    }
    /* Live extended-thinking text — the model's reasoning, streamed. */
    .thinking-reasoning {
      white-space: pre-wrap;
      color: var(--text-1);
      border-left: 2px solid color-mix(in srgb, var(--accent) 40%, transparent);
      padding-left: 10px;
      margin-bottom: 8px;
    }
    /* Live tool-args preview as the call composes. */
    .tool-args-preview {
      margin-top: 8px;
      color: var(--text-3);
      font-size: 11.5px;
    }
    .tool-args-preview code {
      color: var(--accent);
      word-break: break-all;
    }
    @media (prefers-reduced-motion: reduce) {
      .thinking-dots span { animation: none; opacity: 1; }
    }
    .thinking-label {
      animation: ares-cursor-pulse 1.6s ease-in-out infinite;
    }
    .heartbeat-strip {
      margin-top: 6px;
      font-size: 11.5px;
      color: var(--text-3);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .heartbeat-strip::before {
      content: "";
      width: 6px; height: 6px; border-radius: 50%;
      background: var(--ok);
      box-shadow: 0 0 8px color-mix(in srgb, var(--ok) 50%, transparent);
      animation: pulseDot 1.4s var(--ease-in-out) infinite;
    }
    @keyframes pulseDot {
      0%,100% { opacity: 1; transform: scale(1); }
      50%     { opacity: 0.55; transform: scale(0.8); }
    }
    .stall-chip, .loop-chip, .cred-chip, .premature-chip {
      display: inline-block;
      margin-top: 6px;
      padding: 3px 9px;
      border-radius: 999px;
      font-size: 11.5px;
      border: 1px solid var(--border);
      background: var(--panel-2);
    }
    .stall-chip      { color: var(--warn); border-color: color-mix(in srgb, var(--warn) 40%, transparent); }
    .loop-chip       { color: var(--warn); border-color: color-mix(in srgb, var(--warn) 40%, transparent); }
    .cred-chip       { color: var(--info); border-color: color-mix(in srgb, var(--info) 40%, transparent); }
    .premature-chip  { color: var(--err);  border-color: color-mix(in srgb, var(--err)  40%, transparent); }
    .approval-card {
      margin-top: var(--space-2);
      padding: var(--space-3) var(--space-4);
      background: var(--panel);
      border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--border));
      border-radius: var(--radius-3);
      animation: slideIn var(--dur-base) var(--ease-spring) both;
    }
    @keyframes slideIn {
      from { opacity: 0; transform: translateY(16px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .approval-card .head {
      font-weight: 600;
      color: var(--text-0);
      margin-bottom: 6px;
    }
    .approval-card .reason { color: var(--text-2); font-size: 12.5px; margin-bottom: 8px; }
    .approval-card pre {
      background: var(--panel-2);
      padding: 8px;
      border-radius: 6px;
      max-height: 180px; overflow: auto;
      font-size: 11.5px;
    }
    .approval-card .actions {
      margin-top: 10px;
      display: flex;
      gap: 8px;
    }
    .approval-card button {
      all: unset;
      cursor: pointer;
      padding: 6px 14px;
      border-radius: var(--radius-2);
      font-size: 12.5px;
      font-weight: 500;
      transition: background var(--dur-fast) var(--ease-out);
    }
    .approval-card button.approve { background: var(--accent); color: #fff; }
    .approval-card button.approve:hover { background: var(--accent-soft); }
    .approval-card button.deny { background: var(--panel-2); color: var(--text-1); border: 1px solid var(--border); }
    .approval-card button.deny:hover { background: var(--raised); }
    .approval-card .stamp {
      margin-top: 8px;
      font-size: 12.5px;
      color: var(--text-3);
    }
    .actions-row {
      display: flex;
      gap: 6px;
      margin-top: 6px;
      opacity: 0;
      transition: opacity var(--dur-fast) var(--ease-out);
    }
    .turn:hover .actions-row { opacity: 1; }
    .actions-row button {
      all: unset;
      cursor: pointer;
      padding: 2px 8px;
      font-size: 11px;
      border-radius: 4px;
      color: var(--text-3);
      border: 1px solid var(--border);
      background: var(--panel);
      transition: color var(--dur-fast) var(--ease-out);
    }
    .actions-row button:hover { color: var(--text-1); }

    /* Floating scroll-to-bottom button — shown when user scrolls up >80px */
    .scroll-to-bottom-btn {
      position: absolute;
      bottom: 96px;
      left: 50%;
      transform: translateX(-50%);
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: var(--panel);
      border: 1px solid var(--border-2);
      color: var(--text-1);
      font-size: 16px;
      cursor: pointer;
      display: grid;
      place-items: center;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
      z-index: 4;
      transition: transform var(--dur-fast) var(--ease-out), background var(--dur-fast) var(--ease-out);
      animation: ares-fade-slide-up var(--dur-base) var(--ease-out) both;
    }
    .scroll-to-bottom-btn:hover {
      background: var(--raised);
      transform: translateX(-50%) translateY(-2px);
    }
    /* ── composer ─────────────────────────────────────────── */
    .composer-wrap {
      flex-shrink: 0;

      padding: var(--space-3) var(--space-6) var(--space-5);
      background: linear-gradient(
        to top,
        var(--bg) 0%,
        var(--bg) 60%,
        color-mix(in srgb, var(--bg) 80%, transparent) 100%
      );
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border-top: 1px solid color-mix(in srgb, var(--border) 50%, transparent);
      position: sticky;
      bottom: 0;
      z-index: 5;
    }
    .dev-mode-badge {
      max-width: 760px;
      margin: 0 auto 6px;
      padding: 3px 10px;
      border-radius: var(--radius-pill, 999px);
      background: color-mix(in srgb, var(--warn, #f59e0b) 12%, transparent);
      border: 1px solid color-mix(in srgb, var(--warn, #f59e0b) 40%, var(--border));
      color: var(--warn, #f59e0b);
      font-size: 10.5px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-align: center;
    }
    .composer {
      max-width: 760px;
      margin: 0 auto;
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: var(--radius-3);
      transition: border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out), transform var(--dur-base) var(--ease-out);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);

    }
    .composer:focus-within {
      border-color: color-mix(in srgb, var(--accent) 50%, var(--border));
      transform: perspective(1000px) translateZ(var(--z-lift-md, 8px));
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 12%, transparent),
                  0 12px 30px rgba(0, 0, 0, 0.22);
    }
    .queue-strip {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      padding: 8px 12px 0;
    }
    .queue-strip .chip {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 3px 8px 3px 10px;
      background: var(--panel-2);
      border: 1px solid var(--border);
      border-radius: 999px;
      font-size: 11.5px;
      color: var(--text-2);
      max-width: 280px;
    }
    .queue-strip .chip .label {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .queue-strip .chip .index {
      font-family: var(--font-mono);
      color: var(--text-3);
    }
    .queue-strip .chip button {
      all: unset;
      cursor: pointer;
      color: var(--text-3);
      padding: 0 4px;
      font-size: 12px;
    }
    .queue-strip .chip button:hover { color: var(--err); }
    .queue-strip .clear-all {
      all: unset;
      cursor: pointer;
      font-size: 11px;
      color: var(--text-3);
      padding: 3px 6px;
    }
    .queue-strip .clear-all:hover { color: var(--err); }
    .composer-row {
      display: flex;
      align-items: flex-end;
      gap: var(--space-2);
      padding: 8px 12px;
    }
    textarea.composer-input {
      flex: 1;
      min-height: 22px;
      max-height: 200px;
      resize: none;
      background: transparent;
      border: 0;
      outline: 0;
      color: var(--text-0);
      font-family: inherit;
      font-size: 14px;
      line-height: 1.45;
      padding: 4px 0;
    }
    textarea.composer-input::placeholder { color: var(--text-3); }
    .composer button.send,
    .composer button.queue {
      all: unset;
      cursor: pointer;
      padding: 6px 14px;
      border-radius: var(--radius-2);
      font-size: 12.5px;
      font-weight: 500;
      transition: background var(--dur-fast) var(--ease-out), opacity var(--dur-fast) var(--ease-out);
    }
    .composer button.send {
      background: var(--accent);
      color: #fff;
    }
    .composer button.send:hover { background: var(--accent-soft); }
    .composer button.send:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
    .composer button.queue {
      background: var(--panel-2);
      color: var(--text-1);
      border: 1px solid var(--border);
    }
    .composer button.queue:hover { background: var(--raised); }
    .composer button.stop {
      all: unset;
      cursor: pointer;
      padding: 6px 14px;
      border-radius: var(--radius-2);
      background: var(--err);
      color: #fff;
      font-size: 12.5px;
      font-weight: 500;
    }
    .footer-hint {
      max-width: 760px;
      margin: 6px auto 0;
      color: var(--text-3);
      font-size: 11px;
      display: flex;
      gap: 14px;
    }
    .footer-hint kbd {
      background: var(--panel-2);
      border: 1px solid var(--border);
      padding: 0 4px;
      border-radius: 3px;
      font-family: var(--font-mono);
      font-size: 10.5px;
      color: var(--text-2);
    }

    /* Q-cutover: header bar */
    .header {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-6);
      border-bottom: 1px solid var(--border);
      background: var(--panel);
      flex-shrink: 0;
    }
    .header .title {
      flex: 1;
      color: var(--text-0);
      font-size: 14px;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .header .pill-btn {
      all: unset;
      cursor: pointer;
      padding: 4px 12px;
      border-radius: 999px;
      font-size: 11.5px;
      color: var(--text-2);
      background: var(--panel-2);
      border: 1px solid var(--border);
      transition: background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out);
    }
    .header .pill-btn:hover { background: var(--raised); color: var(--text-0); }
    .header .pill-btn .accent { color: var(--accent); }

    /* Q-pass-5 P2-2 — new-conversation link top-right of chat header. */
    .header .new-conv-link {
      cursor: pointer;
      font-size: 11.5px;
      color: var(--text-3);
      padding: 0 6px;
      transition: color var(--dur-fast) var(--ease-out);
    }
    .header .new-conv-link:hover { color: var(--accent); text-decoration: underline; }

    /* Q-pass-4 D — slash-command dropdown anchored under the composer. */
    .composer { position: relative; }
    .slash-drop {
      position: absolute;
      left: 12px;
      right: 12px;
      bottom: calc(100% + 4px);
      background: var(--surface-elevated, var(--panel-2));
      border: 1px solid var(--border);
      border-radius: var(--radius-2);
      box-shadow: var(--shadow-md, 0 8px 24px rgba(0,0,0,0.35));
      max-height: 320px;
      overflow-y: auto;
      z-index: 30;
      animation: ares-fade-in var(--dur-fast) var(--ease-out) both;
    }
    @media (prefers-reduced-motion: reduce) {
      .slash-drop { animation-duration: 0.01ms !important; }
    }
    .slash-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px 12px;
      font-size: 12.5px;
      color: var(--text-1);
      cursor: pointer;
      transition: background var(--dur-fast) var(--ease-out);
    }
    .slash-row:hover { background: var(--panel-2); }
    .slash-row.active { background: var(--accent-soft); color: var(--text-0); }
    .slash-row .name {
      font-family: var(--font-mono);
      color: var(--accent);
      font-size: 12px;
      flex-shrink: 0;
    }
    .slash-row.active .name { color: var(--text-0); }
    .slash-row .desc {
      flex: 1;
      color: var(--text-3);
      font-size: 11.5px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .slash-row.active .desc { color: var(--text-1); }
    .slash-empty {
      padding: 10px 12px;
      color: var(--text-3);
      font-size: 12px;
    }

    /* Q-cutover: composer toolbar */
    .composer-toolbar {
      display: flex; align-items: center; gap: 6px;
      padding: 6px 12px 0;
      flex-wrap: wrap;
    }
    .composer-toolbar select,
    .composer-toolbar .icon-btn {
      all: unset;
      cursor: pointer;
      padding: 3px 8px;
      font-size: 11.5px;
      color: var(--text-2);
      background: var(--panel-2);
      border: 1px solid var(--border);
      border-radius: var(--radius-1);
      transition: background var(--dur-fast) var(--ease-out);
    }
    .composer-toolbar select { padding: 3px 8px; }
    .composer-toolbar .icon-btn:hover { background: var(--raised); color: var(--text-0); }
    .composer-toolbar .icon-btn.active { color: var(--accent); border-color: var(--accent); }
    .composer-toolbar .att-chip {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 2px 8px;
      background: var(--panel-2);
      border: 1px solid var(--border);
      border-radius: 999px;
      font-size: 11px;
      color: var(--text-2);
    }
    .composer-toolbar .att-chip button {
      all: unset; cursor: pointer; color: var(--text-3); margin-left: 4px;
    }
    .composer-toolbar .att-chip button:hover { color: var(--err); }

    /* Q-cutover: tools modal */
    .modal-back {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.55);
      display: grid; place-items: center;
      z-index: 200;
      animation: fade-in var(--dur-fast) var(--ease-out) both;
    }
    @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
    .modal {
      background: var(--panel);
      border: 1px solid var(--border-2);
      border-radius: var(--radius-3);
      width: 640px;
      max-width: 92vw;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .modal header {
      display: flex; align-items: center; gap: 12px;
      padding: 12px 16px;
      border-bottom: 1px solid var(--border);
    }
    .modal header h2 {
      flex: 1; margin: 0; font-size: 14px; color: var(--text-0); font-weight: 600;
    }
    .modal header button {
      all: unset; cursor: pointer; color: var(--text-3); font-size: 16px; padding: 0 4px;
    }
    .modal header button:hover { color: var(--text-0); }
    .modal .body {
      flex: 1; min-height: 0; overflow-y: auto;
      padding: 8px 0;
    }
    .modal .body .tool-row {
      padding: 8px 16px;
      border-bottom: 1px solid var(--border);
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--text-1);
    }
    .modal .body .tool-row:last-child { border-bottom: 0; }
    .modal .body .tool-row .desc { color: var(--text-3); font-family: var(--font-ui); margin-top: 2px; font-size: 11.5px; }

    /* ── Q-pass-4 (Phase 0a) error card w/ recovery actions ──── */
    .error-card {
      margin-top: var(--space-2);
      padding: var(--space-3) var(--space-4);
      background: var(--err-soft, color-mix(in srgb, var(--err) 10%, transparent));
      border-left: 1px solid var(--err);
      border-radius: var(--radius-3);
      color: var(--text-1);
      font-size: 13px;
      line-height: 1.5;
    }
    .error-card .err-head {
      font-weight: 600;
      color: var(--err);
      margin-bottom: 4px;
      font-size: 12.5px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .error-card .err-body { color: var(--text-1); margin-bottom: 8px; white-space: pre-wrap; }
    .error-card .recovery-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 8px;
    }
    .error-card .recovery-pill {
      all: unset;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      padding: 5px 12px;
      border-radius: 999px;
      background: var(--panel);
      border: 1px solid var(--border);
      color: var(--text-1);
      font-size: 12px;
      font-weight: 500;
      transition: background var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out);
    }
    .error-card .recovery-pill:hover {
      background: var(--raised);
      border-color: color-mix(in srgb, var(--accent) 40%, var(--border));
    }
    .error-card .recovery-pill[disabled] {
      opacity: 0.55;
      cursor: not-allowed;
    }
    .error-card .recovery-pill .glyph {
      font-size: 13px;
      line-height: 1;
    }
    .error-card .recovery-pill.busy .glyph::after {
      content: "…";
      margin-left: 4px;
      color: var(--text-3);
    }
    /* Mobile / narrow widths — pills stack and span full width. */
    @media (max-width: 520px) {
      .error-card .recovery-row { flex-direction: column; }
      .error-card .recovery-pill { width: 100%; box-sizing: border-box; justify-content: flex-start; }
    }

    /* Inline breakdown modal (recovery action: show-breakdown). */
    .breakdown-modal-back {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.55);
      display: grid; place-items: center;
      z-index: 220;
      animation: fade-in var(--dur-fast) var(--ease-out) both;
    }
    .breakdown-modal {
      background: var(--panel);
      border: 1px solid var(--border-2);
      border-radius: var(--radius-3);
      width: 540px; max-width: 92vw; max-height: 80vh;
      display: flex; flex-direction: column; overflow: hidden;
    }
    .breakdown-modal header {
      display: flex; align-items: center; gap: 12px;
      padding: 12px 16px;
      border-bottom: 1px solid var(--border);
    }
    .breakdown-modal header h2 {
      flex: 1; margin: 0; font-size: 13.5px; color: var(--text-0); font-weight: 600;
    }
    .breakdown-modal header button {
      all: unset; cursor: pointer; color: var(--text-3); font-size: 16px; padding: 0 4px;
    }
    .breakdown-modal header button:hover { color: var(--text-0); }
    .breakdown-modal .body {
      flex: 1; min-height: 0; overflow-y: auto;
      padding: 8px 16px;
    }
    .breakdown-modal table {
      width: 100%; border-collapse: collapse; font-size: 12px;
    }
    .breakdown-modal th, .breakdown-modal td {
      text-align: left; padding: 6px 8px;
      border-bottom: 1px solid var(--border);
      font-family: var(--font-mono);
    }
    .breakdown-modal th { color: var(--text-3); font-weight: 500; }
    .breakdown-modal td.num { text-align: right; color: var(--text-1); }

    /* ── empty state ──────────────────────────────────────────── */
    /* Greeting + composer centred horizontally and vertically.
     * Uses min-height: calc(100vh - header) to guarantee the flex
     * container fills the visible viewport regardless of parent
     * height chain issues. */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 18px;
      /* Fill the full viewport height minus the 52px top header bar */
      min-height: calc(100vh - 52px);
      padding: 0 var(--space-6);
      overflow: hidden;
      width: 100%;
      box-sizing: border-box;
    }
    .greeting {
      font-size: 26px;
      font-weight: 500;
      color: var(--text-0);
      text-align: center;
      line-height: 1.3;
    }
    .greeting .gradient-clause {
      background: linear-gradient(90deg, var(--text-0), color-mix(in srgb, var(--accent) 70%, var(--text-0)));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      color: transparent;
    }
    .empty-composer {
      width: min(720px, 90%);
    }
    .suggestion-row {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: center;
      /* 3D context for chip hover-tilt. */

    }
    .suggestion-chip {
      all: unset;
      cursor: pointer;
      display: inline-block;
      padding: 7px 16px;
      border-radius: 999px;
      font-size: 13px;
      color: var(--text-1);
      background: var(--panel);
      border: 1px solid var(--border);

      transition: background var(--dur-fast) var(--ease-out),
                  border-color var(--dur-fast) var(--ease-out),
                  color var(--dur-fast) var(--ease-out),
                  transform var(--dur-fast) var(--ease-spring),
                  box-shadow var(--dur-fast) var(--ease-out);
      white-space: nowrap;
      animation: chipStaggerIn var(--dur-base) var(--ease-out) both;
      animation-delay: calc(var(--i, 0) * 60ms);
      will-change: transform;
    }
    @keyframes chipStaggerIn {
      from { opacity: 0; transform: perspective(800px) translateY(6px) translateZ(-12px); }
      to   { opacity: 1; transform: perspective(800px) translateY(0)   translateZ(0); }
    }
    .suggestion-chip:hover {
      background: var(--raised);
      border-color: color-mix(in srgb, var(--accent) 40%, var(--border));
      color: var(--text-0);
      transform: perspective(800px) translateY(-2px) translateZ(var(--z-lift-sm,10px)) rotateX(calc(var(--tilt-max,9deg) * -0.6));
      box-shadow: var(--depth-shadow);
    }
    .suggestion-chip:active {
      transform: translateZ(1px) scale(0.97);
      box-shadow: 0 1px 4px rgba(0,0,0,0.18);
    }

    /* Q-pass-5 P0-1 — "next action" chips after a completed assistant turn. */
    .next-actions {
      margin-top: var(--space-3);
      padding-top: var(--space-2);
      border-top: 1px dashed var(--border);
      animation: nextChipsIn var(--dur-base) var(--ease-out) both;
    }
    @keyframes nextChipsIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
    @media (prefers-reduced-motion: reduce) { .next-actions { animation: none; } }
    .next-actions-label {
      font-size: 11.5px;
      color: var(--text-3);
      font-style: italic;
      margin-bottom: 8px;
    }
    .next-actions-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;

    }
    .next-chip {
      all: unset;
      cursor: pointer;
      padding: 5px 12px;
      border-radius: 999px;
      font-size: 12px;
      color: var(--text-1);
      background: var(--panel);
      border: 1px solid var(--border);
      transition: background var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out);

      animation: chipStaggerIn var(--dur-base) var(--ease-out) both;
      animation-delay: calc(var(--i, 0) * 60ms);
    }
    .next-chip:hover {
      background: var(--raised);
      border-color: color-mix(in srgb, var(--accent) 40%, var(--border));
      transform: perspective(800px) translateY(-2px) translateZ(var(--z-lift-sm, 10px)) rotateX(calc(var(--tilt-max, 9deg) * -0.6));
      box-shadow: var(--depth-shadow);
    }
    .next-chip:active { transform: translateZ(1px) scale(0.97); }

    /* Q-pass-5 P0-2 — "Send to background" button shown on in-flight turns. */
    .bg-btn {
      all: unset;
      cursor: pointer;
      margin-top: 8px;
      padding: 4px 12px;
      border-radius: 999px;
      font-size: 11px;
      color: var(--text-2);
      background: var(--panel-2);
      border: 1px solid var(--border);
      transition: background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out);
    }
    .bg-btn:hover { background: var(--raised); color: var(--text-0); }
    .suggestion-refresh {
      all: unset;
      cursor: pointer;
      display: grid;
      place-items: center;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      color: var(--text-3);
      border: 1px solid var(--border);
      font-size: 13px;
      transition: color var(--dur-fast) var(--ease-out), background var(--dur-fast) var(--ease-out);
      flex-shrink: 0;
    }
    .suggestion-refresh:hover { color: var(--text-1); background: var(--panel); }

    /* Q-pass-4 F — composer card mount. */
    .empty-composer .composer,
    .composer-wrap > .composer {
      animation: composerMount var(--dur-base) var(--ease-out) both;
    }
    @keyframes composerMount {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* Q-pass-4 F — greeting fade-in. */
    .greeting { animation: greetingFade var(--dur-slow) var(--ease-out) both; }
    @keyframes greetingFade {
      from { opacity: 0; transform: translateY(4px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* Q-pass-4 F — tool-card mount + hover lift. */
    .tool-card {
      animation: toolCardIn var(--dur-base) var(--ease-out) both;
      animation-delay: calc(var(--i, 0) * 60ms);
      transition: transform var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out);
    }
    @keyframes toolCardIn {
      from { opacity: 0; transform: translateY(4px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .tool-card {

      transition: transform var(--dur-fast) var(--ease-out),
                  border-color var(--dur-fast) var(--ease-out),
                  box-shadow var(--dur-fast) var(--ease-out);
    }
    .tool-card:hover {
      /* 3D lift: rise toward viewer + slight backward tilt. */
      transform: perspective(900px) translateY(-2px) translateZ(var(--z-lift-md, 18px)) rotateX(calc(var(--tilt-max, 9deg) * -0.5));
      border-color: color-mix(in srgb, var(--accent) 30%, var(--border-2));
      box-shadow: var(--depth-shadow);
    }

    /* Q-pass-4 F — streaming chip pulse. */
    .stall-chip, .cred-chip {
      animation: chipPulse 2.4s var(--ease-in-out) infinite;
    }
    @keyframes chipPulse {
      0%,100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent) 30%, transparent); }
      50%     { box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 0%, transparent); }
    }

    /* Q-pass-4 F — composer card mount. */
    .header { transition: box-shadow var(--dur-base) var(--ease-out), border-color var(--dur-base) var(--ease-out); }
    .header[data-scrolled="1"] {
      box-shadow: 0 1px 0 0 var(--border-2), 0 6px 20px rgba(0,0,0,0.25);
    }

    /* Q-pass-4 F — streaming cursor caret on the active assistant turn. */
    .turn.assistant.streaming .prose::after {
      content: "▍";
      display: inline-block;
      margin-left: 2px;
      color: var(--accent);
      animation: cursorPulse 1.2s var(--ease-in-out) infinite;
    }
    @keyframes cursorPulse {
      0%,100% { opacity: 1; }
      50%     { opacity: 0.35; }
    }

    /* ── policy footer (absolute, bottom of chat surface) ────── */
    .policy-footer {
      position: absolute;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      white-space: nowrap;
      color: var(--text-3);
      font-size: 11.5px;
      text-align: center;
      pointer-events: none;
    }
    .policy-footer a {
      color: inherit;
      text-decoration: underline;
      text-underline-offset: 2px;
      pointer-events: all;
    }

    /* ── session-load spinner ───────────────────────────────── */
    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* ── owl mascot (empty state only) ──────────────────────── */
    .owl-mascot {
      position: absolute;
      right: 24px;
      bottom: 24px;
      width: 72px;
      height: 72px;
      opacity: 0.55;
      pointer-events: none;
      transition: opacity var(--dur-base) var(--ease-out);
    }
    .owl-mascot:hover { opacity: 0.85; }
  `;g._SUGGESTION_SETS=[["What can Ares do?","Catch me up on what I missed today"],["Show me my recent sessions","Search my knowledge graph"]];g._RECOVERY_GLYPHS={compress:"🗜","strip-steering":"✂","trim-mcps":"🪓","show-breakdown":"📊","new-session":"✏"};k([E({type:String})],g.prototype,"sessionId",2);k([l()],g.prototype,"_turns",2);k([l()],g.prototype,"_loadingSession",2);k([l()],g.prototype,"_composerText",2);k([l()],g.prototype,"_streaming",2);k([l()],g.prototype,"_queue",2);k([l()],g.prototype,"_selectedModel",2);k([l()],g.prototype,"_selectedMode",2);k([l()],g.prototype,"_routing",2);k([l()],g.prototype,"_appMode",2);k([l()],g.prototype,"_modelChoices",2);k([l()],g.prototype,"_health",2);k([l()],g.prototype,"_toolsModalOpen",2);k([l()],g.prototype,"_activeTools",2);k([l()],g.prototype,"_attachments",2);k([l()],g.prototype,"_uploading",2);k([l()],g.prototype,"_dragOver",2);k([l()],g.prototype,"_tabsPanelOpen",2);k([l()],g.prototype,"_expandedTools",2);k([l()],g.prototype,"_slashOpen",2);k([l()],g.prototype,"_slashCommands",2);k([l()],g.prototype,"_slashFiltered",2);k([l()],g.prototype,"_slashIndex",2);k([l()],g.prototype,"_suggestionSet",2);k([l()],g.prototype,"_serverSuggestions",2);k([l()],g.prototype,"_breakdownOpen",2);k([l()],g.prototype,"_breakdownLoading",2);k([l()],g.prototype,"_breakdownRows",2);k([l()],g.prototype,"_breakdownError",2);k([l()],g.prototype,"_userScrolledUp",2);g=k([w("ares-chat-surface")],g);var di=Object.defineProperty,pi=Object.getOwnPropertyDescriptor,G=(e,t,r,a)=>{for(var s=a>1?void 0:a?pi(t,r):t,i=e.length-1,o;i>=0;i--)(o=e[i])&&(s=(a?o(t,r,s):o(s))||s);return a&&s&&di(t,r,s),s};let N=class extends m{constructor(){super(...arguments),this.selectedId=null,this._items=[],this._query="",this._preset="all",this._menuOpenFor=null,this._menuX=0,this._menuY=0,this._searching=!1,this._searchHits=[],this._unsubscribe=null,this._onDocClick=()=>{this._menuOpenFor&&(this._menuOpenFor=null)},this._onKeydown=e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="f"){const t=this.shadowRoot?.querySelector(".search");t&&(t.focus(),t.select(),e.preventDefault())}else e.key==="Escape"&&this._menuOpenFor&&(this._menuOpenFor=null)},this._onSearchInput=e=>{this._query=e.target.value,clearTimeout(this._searchT),this._searchT=window.setTimeout(()=>{this._runSearch()},320)}}connectedCallback(){super.connectedCallback(),this._unsubscribe=Vr(e=>{this._items=e}),document.addEventListener("click",this._onDocClick),document.addEventListener("keydown",this._onKeydown)}disconnectedCallback(){super.disconnectedCallback(),this._unsubscribe?.(),document.removeEventListener("click",this._onDocClick),document.removeEventListener("keydown",this._onKeydown)}_filtered(){let e=this._items;const t=Date.now(),r=this._preset==="today"?t-24*3600*1e3:this._preset==="7d"?t-7*24*3600*1e3:this._preset==="30d"?t-30*24*3600*1e3:0;r>0&&(e=e.filter(s=>(s.updatedAt??0)>=r));const a=this._query.trim().toLowerCase();return a&&this._searchHits.length===0&&(e=e.filter(s=>s.title.toLowerCase().includes(a))),e}async _runSearch(){const e=this._query.trim();if(!e){this._searchHits=[];return}this._searching=!0;try{const t=await _(`/api/sessions/search?q=${encodeURIComponent(e)}`);this._searchHits=t.hits??[]}catch{this._searchHits=[]}finally{this._searching=!1}}async _rename(e){const t=this._items.find(a=>a.id===e);if(!t)return;const r=prompt("Rename to:",t.title);!r||r===t.title||(await v(`/api/sessions/${e}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({title:r})}),Be())}async _togglePin(e){await K(`/api/sessions/${e}/toggle-pin`,{}),Be()}async _archive(e){confirm("Archive this session?")&&(await v(`/api/sessions/${e}`,{method:"DELETE"}),Be())}async _exportShareGpt(e){try{const r=((await _(`/api/sessions/${e}`)).messages||[]).map(i=>({from:i.role==="assistant"?"gpt":"human",value:typeof i.content=="string"?i.content:Array.isArray(i.content)?i.content.filter(o=>o?.type==="text").map(o=>o.text||"").join(`
`):""})),a=new Blob([JSON.stringify({conversations:r},null,2)],{type:"application/json"}),s=document.createElement("a");s.href=URL.createObjectURL(a),s.download=`ares-session-${e}.sharegpt.json`,s.click(),setTimeout(()=>URL.revokeObjectURL(s.href),5e3)}catch(t){alert("Export failed: "+t.message)}}_openMenu(e,t){e.preventDefault(),e.stopPropagation(),this._menuOpenFor=t,this._menuX=e.clientX,this._menuY=e.clientY}_selectSession(e){this.dispatchEvent(new CustomEvent("session-selected",{detail:{id:e},bubbles:!0,composed:!0}))}render(){const e=this._query.trim().length>0&&this._searchHits.length>0;return n`
      <h1>Sessions</h1>
      <div class="toolbar">
        <input
          class="search"
          type="text"
          placeholder="Search conversations… (⌘F)"
          .value=${this._query}
          @input=${this._onSearchInput}
        />
        <div class="preset" role="group" aria-label="Date filter">
          ${["all","today","7d","30d"].map(t=>n`
            <button
              class=${this._preset===t?"active":""}
              @click=${()=>{this._preset=t}}
            >${t==="all"?"All":t==="today"?"Today":t==="7d"?"7 days":"30 days"}</button>
          `)}
        </div>
      </div>
      ${e?this._renderSearchHits():this._renderList()}
      ${this._menuOpenFor?this._renderMenu():""}
    `}_renderList(){const e=this._filtered();return e.length===0?n`<div class="empty">No conversations match your filter.</div>`:n`
      <div class="list">
        ${e.map(t=>n`
          <div
            class="row ${t.id===this.selectedId?"active":""}"
            @click=${()=>this._selectSession(t.id)}
            @contextmenu=${r=>this._openMenu(r,t.id)}
          >
            ${t.streamActive?n`<span class="chip streaming">live</span>`:""}
            ${t.pinned?n`<span class="chip pinned">pinned</span>`:""}
            <span class="title">${t.title||"Untitled"}</span>
            <span class="meta">${t.messageCount} msgs · ${this._fmtDate(t.updatedAt)}</span>
          </div>
        `)}
      </div>
    `}_renderSearchHits(){return n`
      <div class="list hits">
        ${this._searching?n`<div class="empty">Searching…</div>`:""}
        ${this._searchHits.map(e=>n`
          <div class="hit" @click=${()=>this._selectSession(e.sessionId)}>
            <div class="title">${e.title}</div>
            <div class="snippet">${e.snippet}</div>
          </div>
        `)}
      </div>
    `}_renderMenu(){const e=this._menuOpenFor,t=this._items.find(r=>r.id===e);return n`
      <div class="menu" style="left:${this._menuX}px; top:${this._menuY}px;" @click=${r=>r.stopPropagation()}>
        <button @click=${()=>{this._rename(e),this._menuOpenFor=null}}>Rename…</button>
        <button @click=${()=>{this._togglePin(e),this._menuOpenFor=null}}>${t?.pinned?"Unpin":"Pin"}</button>
        <button @click=${()=>{this._exportShareGpt(e),this._menuOpenFor=null}}>Export as ShareGPT</button>
        <hr />
        <button class="danger" @click=${()=>{this._archive(e),this._menuOpenFor=null}}>Archive</button>
      </div>
    `}_fmtDate(e){if(!e)return"—";const t=new Date(e),a=new Date().getTime()-e;return a<6e4?"just now":a<36e5?`${Math.floor(a/6e4)}m ago`:a<24*36e5?`${Math.floor(a/36e5)}h ago`:t.toLocaleDateString()}};N.styles=y`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      padding: var(--space-5) var(--space-6);
      box-sizing: border-box;
    }
    h1 {
      margin: 0 0 var(--space-3) 0;
      font-size: 22px;
      font-weight: 600;
      color: var(--text-0);
    }
    .toolbar {
      display: flex;
      gap: var(--space-2);
      align-items: center;
      margin-bottom: var(--space-3);
    }
    input.search {
      flex: 1;
      max-width: 420px;
      padding: 8px 12px;
      background: var(--panel);
      border: 1px solid var(--border);
      color: var(--text-0);
      border-radius: var(--radius-2);
      font-size: 13px;
      outline: none;
      transition: border-color var(--dur-fast) var(--ease-out);
    }
    input.search:focus { border-color: var(--accent); }
    .preset {
      display: flex;
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: var(--radius-2);
      overflow: hidden;
    }
    .preset button {
      all: unset;
      padding: 6px 12px;
      cursor: pointer;
      font-size: 12px;
      color: var(--text-2);
      transition: background var(--dur-fast) var(--ease-out);
    }
    .preset button:hover { background: var(--panel-2); color: var(--text-1); }
    .preset button.active { background: var(--accent); color: #fff; }
    .list {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      border: 1px solid var(--border);
      border-radius: var(--radius-2);
      background: var(--panel);
    }
    .row {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: 10px 14px;
      border-bottom: 1px solid var(--border);
      cursor: pointer;
      transition: background var(--dur-fast) var(--ease-out);
    }
    .row:last-child { border-bottom: 0; }
    .row:hover { background: var(--panel-2); }
    .row.active { background: color-mix(in srgb, var(--accent) 20%, transparent); }
    .title { flex: 1; color: var(--text-0); font-size: 13.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .chip {
      font-size: 10.5px;
      padding: 2px 7px;
      border-radius: 999px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      flex-shrink: 0;
    }
    .chip.pinned    { background: color-mix(in srgb, var(--warn) 25%, transparent); color: var(--warn); }
    .chip.streaming { background: color-mix(in srgb, var(--ok) 25%, transparent); color: var(--ok); }
    .meta { color: var(--text-3); font-size: 11.5px; flex-shrink: 0; }
    .empty {
      padding: 32px;
      text-align: center;
      color: var(--text-3);
    }
    /* search hits */
    .hits {
      max-height: 360px;
      overflow-y: auto;
    }
    .hit {
      padding: 10px 14px;
      border-bottom: 1px solid var(--border);
      cursor: pointer;
    }
    .hit:hover { background: var(--panel-2); }
    .hit .title { color: var(--text-0); font-size: 12.5px; margin-bottom: 4px; }
    .hit .snippet { color: var(--text-2); font-size: 11.5px; line-height: 1.5; }
    /* context menu */
    .menu {
      position: fixed;
      z-index: 100;
      background: var(--raised);
      border: 1px solid var(--border-2);
      border-radius: var(--radius-2);
      padding: 4px;
      box-shadow: 0 12px 32px rgba(0,0,0,0.4);
      min-width: 180px;
      animation: popIn var(--dur-fast) var(--ease-out) both;
    }
    @keyframes popIn {
      from { opacity: 0; transform: scale(0.95); }
      to   { opacity: 1; transform: scale(1); }
    }
    .menu button {
      all: unset;
      display: block;
      width: 100%;
      box-sizing: border-box;
      padding: 6px 12px;
      font-size: 12.5px;
      color: var(--text-1);
      cursor: pointer;
      border-radius: var(--radius-1);
    }
    .menu button:hover { background: var(--panel-2); }
    .menu .danger { color: var(--err); }
    .menu hr { border: 0; border-top: 1px solid var(--border); margin: 4px 0; }
  `;G([E({type:String})],N.prototype,"selectedId",2);G([l()],N.prototype,"_items",2);G([l()],N.prototype,"_query",2);G([l()],N.prototype,"_preset",2);G([l()],N.prototype,"_menuOpenFor",2);G([l()],N.prototype,"_menuX",2);G([l()],N.prototype,"_menuY",2);G([l()],N.prototype,"_searching",2);G([l()],N.prototype,"_searchHits",2);N=G([w("ares-sessions-panel")],N);var hi=Object.defineProperty,ui=Object.getOwnPropertyDescriptor,_e=(e,t,r,a)=>{for(var s=a>1?void 0:a?ui(t,r):t,i=e.length-1,o;i>=0;i--)(o=e[i])&&(s=(a?o(t,r,s):o(s))||s);return a&&s&&hi(t,r,s),s};const ot=8;let X=class extends m{constructor(){super(...arguments),this._items=[],this._query="",this._filter="all",this._page=1,this._signInModalFor=null,this._detailFor=null,this._poll=null,this._onHashChange=()=>{this._page=this._readPageFromHash()}}connectedCallback(){super.connectedCallback(),this._page=this._readPageFromHash(),window.addEventListener("hashchange",this._onHashChange),this._refresh(),this._poll=window.setInterval(()=>{document.visibilityState==="visible"&&this._refresh()},1e3)}disconnectedCallback(){super.disconnectedCallback(),this._poll&&clearInterval(this._poll),window.removeEventListener("hashchange",this._onHashChange)}_readPageFromHash(){const e=window.location.hash.match(/[?&]page=(\d+)/),t=e?parseInt(e[1],10):1;return Number.isFinite(t)&&t>=1?t:1}_writePageToHash(e){const t=window.location.hash,r=t.split("?")[0],a=e>1?`${r}?page=${e}`:r;t!==a&&history.replaceState(null,"",a)}async _refresh(){try{const e=await _("/api/mcps");Array.isArray(e)&&(this._items=e)}catch{}}async _refreshFromUser(){try{const e=await _("/api/mcps");Array.isArray(e)&&(this._items=e),C({variant:"success",title:"Connections refreshed",body:`${e.length} MCP servers`,durationMs:2400})}catch(e){C({variant:"danger",title:"Refresh failed",body:e.message??"Network error"})}}_filtered(){const e=this._query.trim().toLowerCase();return this._items.filter(t=>{if(e&&!t.name.toLowerCase().includes(e)&&!(t.description??"").toLowerCase().includes(e))return!1;const r=t.state==="running";return!(this._filter==="auth"&&!r||this._filter==="needs-signin"&&r)})}_goPage(e){const t=this._filtered(),r=Math.max(1,Math.ceil(t.length/ot)),a=Math.min(Math.max(1,e),r);this._page=a,this._writePageToHash(a)}render(){const e=this._filtered(),t=Math.max(1,Math.ceil(e.length/ot)),r=Math.min(this._page,t),a=e.slice((r-1)*ot,r*ot);return n`
      <div class="header">
        <div class="h-eyebrow">CONNECTORS [${this._items.length}]</div>
        <div class="h-title">Connections</div>
        <div class="h-sub">All available connections.</div>
      </div>
      <div class="toolbar">
        <input
          class="search"
          type="text"
          placeholder=${`Search ${this._items.length} connections…`}
          .value=${this._query}
          @input=${s=>{this._query=s.target.value,this._goPage(1)}}
        />
        <select class="filter" .value=${this._filter}
          @change=${s=>{this._filter=s.target.value,this._goPage(1)}}
        >
          <option value="all">All</option>
          <option value="auth">Authenticated</option>
          <option value="needs-signin">Needs sign-in</option>
        </select>
        <button class="refresh" title="Refresh" @click=${()=>void this._refreshFromUser()}>↻</button>
      </div>
      ${a.length===0?n`
        <div class="empty">No connections match.</div>
      `:n`
        <div class="list">
          ${a.map(s=>this._renderRow(s))}
        </div>
        ${this._renderPager(r,t)}
      `}
      ${this._signInModalFor?this._renderSignInModal(this._signInModalFor):""}
      ${this._detailFor?this._renderDetailModal(this._detailFor):""}
    `}_renderRow(e){const t=e.state==="running",r=(e.icon||e.name).slice(0,1).toUpperCase(),a=t?n`<span class="dot ok"></span><span>Authenticated</span>`:n`<button class="pill-signin" @click=${i=>{i.stopPropagation(),this._signInModalFor=e}}>Sign in</button>`,s=!t&&e.state==="starting"?n`<span class="dot warn"></span><span>Starting…</span>`:e.state==="error"?n`<span class="dot err"></span><span>Error</span>`:"";return n`
      <div class="row">
        <div class="logo">${r}</div>
        <div class="meta">
          <div class="name" title=${e.name}>${e.name}</div>
          <div class="sub">
            ${a}
            ${s}
            <span>·</span>
            <span>${e.toolCount??0} tools</span>
          </div>
        </div>
        <button class="gear" title="Inspect" @click=${()=>{this._detailFor=e}}>⚙</button>
        <div class="toggle-wrap" title="Always-on (Q-pass-2 policy)">
          <div class="toggle"><div class="knob"></div></div>
        </div>
      </div>
    `}_renderPager(e,t){const r=[],s=Math.max(1,e-2),i=Math.min(t,s+5-1);for(let o=s;o<=i;o++)r.push(o);return n`
      <div class="pager">
        <button ?disabled=${e<=1} @click=${()=>this._goPage(e-1)} title="Previous">‹</button>
        ${e>s?n`<span class="page">…</span>`:""}
        ${r.map(o=>n`
          <span class="page ${o===e?"active":""}"
            style="cursor: pointer"
            @click=${()=>this._goPage(o)}
          >${o}</span>
        `)}
        ${e<i?"":i<t?n`<span class="page">…</span>`:""}
        <button ?disabled=${e>=t} @click=${()=>this._goPage(e+1)} title="Next">›</button>
      </div>
    `}_renderSignInModal(e){return n`
      <div class="modal-overlay" @click=${()=>{this._signInModalFor=null}}>
        <div class="modal" @click=${t=>t.stopPropagation()}>
          <h2>Sign in required for ${e.name}</h2>
          <p>This MCP requires AuthProvider authentication. Run <code>auth-init</code> in a terminal and reload Ares.</p>
          ${e.error?n`<p style="color: var(--err); font-size: 11.5px; margin-top: -8px;">${e.error}</p>`:""}
          <div class="modal-actions">
            <button class="modal-btn secondary" @click=${()=>{this._signInModalFor=null}}>Close</button>
          </div>
        </div>
      </div>
    `}_renderDetailModal(e){return n`
      <div class="modal-overlay" @click=${()=>{this._detailFor=null}}>
        <div class="modal" @click=${t=>t.stopPropagation()}>
          <h2>${e.name}</h2>
          <p>${e.description||"(no description)"}</p>
          <p style="color: var(--text-3); font-size: 11.5px;">
            State: ${e.state}${e.alwaysActive?" · always-on":""} · ${e.toolCount??0} tools
          </p>
          ${e.error?n`<p style="color: var(--err); font-size: 11.5px;">${e.error}</p>`:""}
          <div class="modal-actions">
            <button class="modal-btn secondary" @click=${()=>{this._detailFor=null}}>Close</button>
          </div>
        </div>
      </div>
    `}};X.styles=y`
    :host { display: block; }
    .header { margin-bottom: 18px; }
    .h-eyebrow {
      font-size: 11px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--text-3);
    }
    .h-title { font-size: 16px; color: var(--text-0); font-weight: 600; margin-top: 2px; }
    .h-sub   { color: var(--text-3); font-size: 12px; margin-top: 2px; }
    .toolbar {
      display: flex; gap: 10px; align-items: center;
      margin-bottom: 14px;
    }
    input.search {
      flex: 1; max-width: 360px;
      padding: 7px 12px;
      background: var(--panel);
      border: 1px solid var(--border);
      color: var(--text-0);
      border-radius: var(--radius-2);
      font-size: 13px;
      outline: none;
    }
    select.filter {
      padding: 7px 10px;
      background: var(--panel);
      border: 1px solid var(--border);
      color: var(--text-1);
      border-radius: var(--radius-2);
      font-size: 13px;
      outline: none;
    }
    button.refresh {
      all: unset; cursor: pointer;
      padding: 6px 10px;
      background: var(--panel);
      border: 1px solid var(--border);
      color: var(--text-2);
      border-radius: var(--radius-2);
      font-size: 13px;
    }
    button.refresh:hover { color: var(--text-0); border-color: var(--border-2); }
    .list {
      display: flex; flex-direction: column; gap: 10px;
    }
    .row {
      display: flex; align-items: center; gap: 12px;
      padding: 12px 14px;
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: var(--radius-2);
      transition: border-color var(--dur-fast) var(--ease-out);
    }
    .row:hover { border-color: var(--border-2); }
    .logo {
      width: 36px; height: 36px;
      flex-shrink: 0;
      border-radius: var(--radius-2);
      background: color-mix(in srgb, var(--accent) 18%, var(--panel-2));
      color: var(--accent-soft);
      display: flex; align-items: center; justify-content: center;
      font-size: 16px; font-weight: 600;
      letter-spacing: 0.02em;
    }
    .meta { flex: 1; min-width: 0; }
    .name {
      color: var(--text-0); font-size: 13.5px; font-weight: 500;
      font-family: var(--font-mono);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .sub {
      display: flex; align-items: center; gap: 6px;
      margin-top: 3px;
      color: var(--text-3); font-size: 11.5px;
    }
    .dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; display: inline-block; }
    .dot.ok { background: var(--ok); box-shadow: 0 0 5px color-mix(in srgb, var(--ok) 70%, transparent); }
    .dot.err { background: var(--err); box-shadow: 0 0 5px color-mix(in srgb, var(--err) 70%, transparent); }
    .dot.warn { background: var(--warn); }
    .pill-signin {
      all: unset; cursor: pointer;
      padding: 3px 10px;
      border: 1px solid var(--accent);
      color: var(--accent-soft);
      background: color-mix(in srgb, var(--accent) 10%, transparent);
      border-radius: 999px;
      font-size: 11px;
      font-weight: 500;
    }
    .pill-signin:hover { background: color-mix(in srgb, var(--accent) 20%, transparent); }
    .gear, .toggle-wrap {
      flex-shrink: 0;
    }
    .gear {
      all: unset; cursor: pointer;
      width: 28px; height: 28px;
      display: flex; align-items: center; justify-content: center;
      border-radius: var(--radius-1);
      color: var(--text-3);
    }
    .gear:hover { background: var(--panel-2); color: var(--text-0); }
    .toggle {
      position: relative; width: 32px; height: 18px;
      background: var(--accent);
      border: 1px solid var(--accent);
      border-radius: 999px;
      cursor: not-allowed;
      opacity: 0.85;
    }
    .toggle .knob {
      position: absolute; top: 1px; left: 15px;
      width: 14px; height: 14px;
      background: #fff; border-radius: 50%;
    }
    /* Pager */
    .pager {
      display: flex; align-items: center; justify-content: center;
      gap: 6px; margin-top: 18px;
    }
    .pager button {
      all: unset; cursor: pointer;
      width: 28px; height: 28px;
      display: flex; align-items: center; justify-content: center;
      border-radius: var(--radius-1);
      color: var(--text-2);
      font-size: 14px;
    }
    .pager button:hover { color: var(--text-0); background: var(--panel-2); }
    .pager button[disabled] { color: var(--text-4); cursor: default; background: transparent; }
    .pager .page {
      min-width: 28px; padding: 0 8px;
      color: var(--text-3); font-size: 12.5px;
    }
    .pager .page.active { color: var(--text-0); font-weight: 600; }
    /* Modal */
    .modal-overlay {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.55);
      display: flex; align-items: center; justify-content: center;
      z-index: 100;
    }
    .modal {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: var(--radius-3);
      padding: 22px 26px;
      max-width: 460px;
      width: 90%;
    }
    .modal h2 { margin: 0 0 8px 0; font-size: 14px; color: var(--text-0); }
    .modal p { margin: 0 0 12px 0; color: var(--text-2); font-size: 12.5px; line-height: 1.5; }
    .modal code { background: var(--panel-2); padding: 1px 6px; border-radius: 3px; color: var(--accent-soft); font-family: var(--font-mono); }
    .modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
    .modal-btn {
      all: unset; cursor: pointer;
      padding: 6px 14px;
      border-radius: var(--radius-2);
      font-size: 12.5px;
    }
    .modal-btn.primary { background: var(--accent); color: #fff; }
    .modal-btn.secondary { background: var(--panel-2); color: var(--text-1); border: 1px solid var(--border); }
    .empty { padding: 32px; color: var(--text-3); text-align: center; font-size: 13px; }
  `;_e([l()],X.prototype,"_items",2);_e([l()],X.prototype,"_query",2);_e([l()],X.prototype,"_filter",2);_e([l()],X.prototype,"_page",2);_e([l()],X.prototype,"_signInModalFor",2);_e([l()],X.prototype,"_detailFor",2);X=_e([w("ares-connections")],X);var vi=Object.defineProperty,fi=Object.getOwnPropertyDescriptor,j=(e,t,r,a)=>{for(var s=a>1?void 0:a?fi(t,r):t,i=e.length-1,o;i>=0;i--)(o=e[i])&&(s=(a?o(t,r,s):o(s))||s);return a&&s&&vi(t,r,s),s};const Cr="ares.skills.banner-dismissed";let M=class extends m{constructor(){super(...arguments),this._query="",this._items=[],this._selectedSlug=null,this._detail=null,this._bannerDismissed=!1,this._aiModalOpen=!1,this._aiPrompt="",this._aiBusy=!1,this._aiDraft=null,this._flash=null,this._detailMenuOpen=!1,this._activeSkillSlugs=new Set}connectedCallback(){super.connectedCallback();try{this._bannerDismissed=localStorage.getItem(Cr)==="1"}catch{}try{const e=localStorage.getItem("ares.skills.active");e&&(this._activeSkillSlugs=new Set(JSON.parse(e)))}catch{}this._loadSkills()}async _loadSkills(){try{const e=await _("/api/skills");this._items=Array.isArray(e?.skills)?e.skills:[],this._items.length>0&&!this._selectedSlug&&await this._select(this._items[0].slug)}catch{this._items=[]}}async _select(e){this._selectedSlug=e,this._detailMenuOpen=!1;try{const t=await _(`/api/skills/${encodeURIComponent(e)}`);this._detail=t}catch{this._detail=null}}_saveActiveSlugs(){try{localStorage.setItem("ares.skills.active",JSON.stringify([...this._activeSkillSlugs]))}catch{}}_toggleActive(e){const t=new Set(this._activeSkillSlugs);t.has(e)?t.delete(e):t.add(e),this._activeSkillSlugs=t,this._saveActiveSlugs()}_dismissBanner(){this._bannerDismissed=!0;try{localStorage.setItem(Cr,"1")}catch{}}async _runSkill(e){try{await K(`/api/skills/${encodeURIComponent(e)}/run`,{})}catch{}et("draft",`/run-skill ${e}`),I({top:"chat",sub:null})}async _deleteSkill(e){if(confirm(`Delete skill "${e}"? This removes the markdown file.`)){try{const t=await v(`/api/skills/${encodeURIComponent(e)}`,{method:"DELETE"});if(t.ok)this._flash="Deleted.",this._selectedSlug===e&&(this._selectedSlug=null,this._detail=null),await this._loadSkills();else{const r=await t.json().catch(()=>({}));this._flash=`Delete failed: ${r.error||t.status}`}}catch(t){this._flash=`Delete failed: ${t.message}`}setTimeout(()=>{this._flash=null},2200)}}async _generateAi(){if(this._aiPrompt.trim()){this._aiBusy=!0;try{const e=await K("/api/skills/draft",{prompt:this._aiPrompt});this._aiDraft={title:e.title,body:e.body}}catch(e){this._flash=`Draft failed: ${e.message}`}finally{this._aiBusy=!1}}}async _saveAiDraft(){if(this._aiDraft){this._aiBusy=!0;try{await K("/api/skills",{title:this._aiDraft.title,body:this._aiDraft.body}),this._flash="Saved.",this._aiModalOpen=!1,this._aiPrompt="",this._aiDraft=null,await this._loadSkills()}catch(e){this._flash=`Save failed: ${e.message}`}finally{this._aiBusy=!1,setTimeout(()=>{this._flash=null},2200)}}}async _onUpload(e){const t=document.createElement("input");t.type="file",t.accept=".md,.markdown",t.multiple=e,e&&(t.setAttribute("webkitdirectory",""),t.setAttribute("directory","")),t.addEventListener("change",async()=>{const r=Array.from(t.files||[]);if(!r.length)return;const a=new FormData;for(const s of r)/\.(md|markdown)$/i.test(s.name)&&a.append("files",s,s.name);try{const i=await(await v("/api/skills/upload",{method:"POST",body:a})).json(),o=i.saved?.length??0,d=i.errors?.length??0;this._flash=`Uploaded ${o} skill${o===1?"":"s"}${d?`, ${d} error${d===1?"":"s"}`:""}.`,await this._loadSkills()}catch(s){this._flash=`Upload failed: ${s.message}`}setTimeout(()=>{this._flash=null},2400)}),t.click()}render(){const e=this._query.trim().toLowerCase(),t=e?this._items.filter(s=>s.title.toLowerCase().includes(e)||s.slug.toLowerCase().includes(e)||(s.description??"").toLowerCase().includes(e)):this._items,r=t.filter(s=>!s.builtIn),a=t.filter(s=>s.builtIn);return n`
      ${this._bannerDismissed?"":n`
        <div class="banner">
          <h2>How skills work</h2>
          <button class="banner-dismiss" @click=${()=>this._dismissBanner()}>Dismiss</button>
          <div class="banner-cols">
            <div class="banner-col">
              <h3>Create</h3>
              <p>Draft a recipe with AI, upload one you already have, or hand-craft it.</p>
            </div>
            <div class="banner-col">
              <h3>Invoke</h3>
              <p>Ares finds matching skills via keyword + topic search and follows them step-by-step.</p>
            </div>
            <div class="banner-col">
              <h3>Iterate</h3>
              <p>Edit, fork, or share recipes. Run-counts and success rates surface in MEMORY.</p>
            </div>
          </div>
        </div>
      `}
      <div class="columns">
        <div class="left">
          <input
            class="search"
            type="text"
            placeholder="Search skills…"
            .value=${this._query}
            @input=${s=>{this._query=s.target.value}}
          />
          <div class="section-head">MY SKILLS <span class="count">(${r.length})</span></div>
          <div class="actions-row">
            <button class="btn-ai" @click=${()=>{this._aiModalOpen=!0,this._aiDraft=null,this._aiPrompt=""}}>+ Create with AI</button>
            <button class="btn-upload" @click=${()=>this._onUpload(!1)}>↑ Upload</button>
            <button class="btn-upload" @click=${()=>this._onUpload(!0)}>↑ Upload folder</button>
          </div>
          <div class="skill-list">
            ${r.map(s=>this._renderRow(s))}
          </div>
          <div class="section-head">BUILT-IN SKILLS <span class="count">(${a.length})</span></div>
          <div class="skill-list">
            ${a.length===0?n`<div style="color: var(--text-4); font-size: 11.5px; padding: 4px 10px;">None installed.</div>`:""}
            ${a.map(s=>this._renderRow(s))}
          </div>
        </div>
        <div class="right">
          ${this._detail?this._renderDetail(this._detail):n`<div class="empty-detail">Select a skill on the left to inspect.</div>`}
        </div>
      </div>
      ${this._aiModalOpen?this._renderAiModal():""}
      ${this._flash?n`<div class="flash">${this._flash}</div>`:""}
    `}_renderRow(e){const t=e.title.slice(0,1).toUpperCase(),r=e.slug===this._selectedSlug,a=this._activeSkillSlugs.has(e.slug);return n`
      <div class="skill-row ${r?"selected":""}" @click=${()=>this._select(e.slug)}>
        <div class="icon">${t}</div>
        <div class="info">
          <div class="t">${e.title}</div>
          <div class="meta">${e.tools?.length??0} tool${(e.tools?.length??0)===1?"":"s"}${e.builtIn?" · built-in":""}</div>
        </div>
        <div class="toggle-mini ${a?"on":""}"
          title=${a?"Active":"Inactive"}
          @click=${s=>{s.stopPropagation(),this._toggleActive(e.slug)}}
        ><div class="knob"></div></div>
      </div>
    `}_renderDetail(e){const t=this._activeSkillSlugs.has(e.slug);return n`
      <div class="pills">
        <span class="pill ${e.builtIn?"builtin":"user"}">${e.builtIn?"Built-in":"User"}</span>
        <span class="pill ${t?"active":""}">${t?"Active":"Inactive"}</span>
      </div>
      <div class="detail-head">
        <div class="detail-title">${e.title}</div>
        <button class="btn-run" @click=${()=>this._runSkill(e.slug)}>Run</button>
        <div class="menu-wrap">
          <button class="btn-overflow" @click=${r=>{r.stopPropagation(),this._detailMenuOpen=!this._detailMenuOpen}}>⋯</button>
          ${this._detailMenuOpen?n`
            <div class="menu" @click=${r=>r.stopPropagation()}>
              <div class="item ${e.builtIn?"disabled":""}"
                @click=${()=>{e.builtIn||(this._detailMenuOpen=!1,this._flash="Editing inline — open the file at "+(this._detail?.body?"~/.kiro/skills/learned/":""),setTimeout(()=>{this._flash=null},2400))}}
              >Edit${e.builtIn?" (locked)":""}</div>
              <div class="item danger ${e.builtIn?"disabled":""}"
                @click=${()=>{e.builtIn||(this._detailMenuOpen=!1,this._deleteSkill(e.slug))}}
              >Delete${e.builtIn?" (locked)":""}</div>
            </div>
          `:""}
        </div>
      </div>
      ${e.description?n`<div class="description">${e.description}</div>`:""}
      ${e.tools&&e.tools.length>0?n`
        <div class="section-head" style="margin-top: 14px;">Tools (${e.tools.length})</div>
        <div class="tools-list">
          ${e.tools.map(r=>n`<span class="tool-chip">${r}</span>`)}
        </div>
      `:""}
      ${e.body?n`<div class="body-pre">${e.body}</div>`:""}
    `}_renderAiModal(){return n`
      <div class="modal-overlay" @click=${()=>{this._aiBusy||(this._aiModalOpen=!1)}}>
        <div class="modal" @click=${e=>e.stopPropagation()}>
          <h2>Create skill with AI</h2>
          ${this._aiDraft?n`
            <p>Review the draft. Save it to <code>~/.kiro/skills/learned</code> or tweak the prompt and try again.</p>
            <div style="font-size: 13px; color: var(--text-0); margin-bottom: 6px;">
              <strong>Title:</strong> ${this._aiDraft.title}
            </div>
            <textarea
              .value=${this._aiDraft.body}
              @input=${e=>{this._aiDraft&&(this._aiDraft={...this._aiDraft,body:e.target.value})}}
            ></textarea>
            <div class="modal-actions">
              <button class="modal-btn secondary" @click=${()=>{this._aiDraft=null}}>Back</button>
              <button class="modal-btn primary" ?disabled=${this._aiBusy} @click=${()=>void this._saveAiDraft()}>${this._aiBusy?"Saving…":"Save skill"}</button>
            </div>
          `:n`
            <p>Describe the skill you want — the workflow, the trigger, what it should do.</p>
            <textarea
              placeholder="Describe the skill you want…"
              .value=${this._aiPrompt}
              @input=${e=>{this._aiPrompt=e.target.value}}
            ></textarea>
            <div class="modal-actions">
              <button class="modal-btn secondary" @click=${()=>{this._aiModalOpen=!1}}>Cancel</button>
              <button class="modal-btn primary" ?disabled=${this._aiBusy||!this._aiPrompt.trim()} @click=${()=>void this._generateAi()}>${this._aiBusy?"Generating…":"Generate"}</button>
            </div>
          `}
        </div>
      </div>
    `}};M.styles=y`
    :host { display: block; height: 100%; }
    /* Banner */
    .banner {
      position: relative;
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: var(--radius-3);
      padding: 18px 22px;
      margin-bottom: 18px;
    }
    .banner h2 { margin: 0 0 10px 0; font-size: 14px; color: var(--text-0); font-weight: 600; }
    .banner-cols {
      display: grid; grid-template-columns: repeat(3, 1fr);
      gap: 18px;
    }
    .banner-col h3 {
      margin: 0 0 4px 0;
      font-size: 11.5px;
      color: var(--accent-soft);
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .banner-col p { margin: 0; color: var(--text-2); font-size: 12px; line-height: 1.5; }
    .banner-dismiss {
      all: unset; cursor: pointer;
      position: absolute; top: 14px; right: 16px;
      color: var(--text-3); font-size: 11.5px;
    }
    .banner-dismiss:hover { color: var(--text-1); }
    /* Two-column layout */
    .columns {
      display: grid;
      grid-template-columns: 280px 1fr;
      gap: 18px;
      min-height: 480px;
    }
    /* Left pane */
    .left {
      display: flex; flex-direction: column;
      gap: 12px;
      min-height: 0;
    }
    input.search {
      padding: 7px 12px;
      background: var(--panel);
      border: 1px solid var(--border);
      color: var(--text-0);
      border-radius: var(--radius-2);
      font-size: 13px;
      outline: none;
    }
    .section-head {
      display: flex; align-items: center;
      font-size: 10.5px; letter-spacing: 0.08em; text-transform: uppercase;
      color: var(--text-3);
      margin-top: 4px;
    }
    .section-head .count { margin-left: 4px; color: var(--text-4); }
    .actions-row {
      display: grid; grid-template-columns: 1fr 1fr;
      gap: 6px;
    }
    .actions-row button {
      all: unset; cursor: pointer;
      padding: 7px 10px;
      border-radius: var(--radius-2);
      font-size: 12px;
      text-align: center;
    }
    .btn-ai {
      grid-column: 1 / -1;
      background: var(--accent);
      color: #fff;
      font-weight: 500;
    }
    .btn-ai:hover { background: var(--accent-soft); }
    .btn-upload {
      background: var(--panel);
      color: var(--text-1);
      border: 1px solid var(--border);
    }
    .btn-upload:hover { color: var(--text-0); border-color: var(--border-2); }
    .skill-list {
      display: flex; flex-direction: column;
      gap: 4px;
      overflow-y: auto;
    }
    .skill-row {
      display: flex; align-items: center; gap: 8px;
      padding: 7px 10px;
      border-radius: var(--radius-2);
      cursor: pointer;
      color: var(--text-1);
      font-size: 12.5px;
      transition: background var(--dur-fast) var(--ease-out);
    }
    .skill-row:hover { background: var(--panel); }
    .skill-row.selected { background: color-mix(in srgb, var(--accent) 22%, transparent); color: var(--text-0); }
    .skill-row .icon {
      width: 22px; height: 22px;
      flex-shrink: 0;
      border-radius: 4px;
      background: color-mix(in srgb, var(--accent) 16%, var(--panel-2));
      color: var(--accent-soft);
      display: flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 600;
    }
    .skill-row .info { flex: 1; min-width: 0; }
    .skill-row .t {
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .skill-row .meta {
      font-size: 10.5px; color: var(--text-3); margin-top: 1px;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .toggle-mini {
      position: relative; width: 24px; height: 14px;
      background: var(--panel-2);
      border: 1px solid var(--border);
      border-radius: 999px;
      flex-shrink: 0;
      cursor: pointer;
    }
    .toggle-mini.on { background: var(--accent); border-color: var(--accent); }
    .toggle-mini .knob {
      position: absolute; top: 1px; left: 1px;
      width: 10px; height: 10px;
      background: #fff; border-radius: 50%;
      transition: transform var(--dur-fast) var(--ease-spring);
    }
    .toggle-mini.on .knob { transform: translateX(10px); }
    /* Right pane */
    .right {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: var(--radius-3);
      padding: 22px 26px;
      overflow-y: auto;
      min-height: 0;
    }
    .empty-detail {
      color: var(--text-3); font-size: 13px;
      display: flex; align-items: center; justify-content: center;
      height: 100%;
    }
    .pills { display: flex; gap: 6px; margin-bottom: 8px; }
    .pill {
      padding: 2px 9px;
      border-radius: 999px;
      font-size: 10.5px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      background: var(--panel-2);
      color: var(--text-3);
      border: 1px solid var(--border);
    }
    .pill.active { background: color-mix(in srgb, var(--ok) 22%, transparent); color: var(--ok); border-color: transparent; }
    .pill.user { background: color-mix(in srgb, var(--accent) 18%, transparent); color: var(--accent-soft); border-color: transparent; }
    .pill.builtin { background: var(--panel-2); color: var(--text-1); }
    .detail-head {
      display: flex; align-items: center; gap: 12px;
      margin-bottom: 12px;
    }
    .detail-title { flex: 1; color: var(--text-0); font-size: 17px; font-weight: 600; }
    .btn-run {
      all: unset; cursor: pointer;
      padding: 7px 14px;
      border-radius: var(--radius-2);
      background: var(--accent);
      color: #fff;
      font-size: 12.5px;
      font-weight: 500;
    }
    .btn-run:hover { background: var(--accent-soft); }
    .menu-wrap { position: relative; }
    .btn-overflow {
      all: unset; cursor: pointer;
      width: 28px; height: 28px;
      display: flex; align-items: center; justify-content: center;
      border-radius: var(--radius-1);
      color: var(--text-2);
      font-size: 16px;
    }
    .btn-overflow:hover { background: var(--panel-2); color: var(--text-0); }
    .menu {
      position: absolute; top: 32px; right: 0;
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: var(--radius-2);
      padding: 4px;
      z-index: 50;
      min-width: 130px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.4);
    }
    .menu .item {
      padding: 6px 10px;
      cursor: pointer;
      font-size: 12.5px;
      color: var(--text-1);
      border-radius: var(--radius-1);
    }
    .menu .item:hover { background: var(--panel-2); color: var(--text-0); }
    .menu .item.disabled { color: var(--text-4); cursor: not-allowed; background: transparent; }
    .menu .item.danger { color: var(--err); }
    .description {
      color: var(--text-1);
      font-size: 13px;
      line-height: 1.65;
      margin: 14px 0;
      white-space: pre-wrap;
    }
    .tools-list { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
    .tool-chip {
      padding: 3px 9px;
      background: var(--panel-2);
      border: 1px solid var(--border);
      border-radius: 999px;
      font-size: 11px;
      color: var(--text-2);
      font-family: var(--font-mono);
    }
    .body-pre {
      margin-top: 14px;
      background: var(--panel-2);
      border: 1px solid var(--border);
      border-radius: var(--radius-2);
      padding: 12px 14px;
      font-family: var(--font-mono);
      font-size: 11.5px;
      color: var(--text-2);
      white-space: pre-wrap;
      max-height: 360px;
      overflow-y: auto;
    }
    /* Modal (AI create) */
    .modal-overlay {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.55);
      display: flex; align-items: center; justify-content: center;
      z-index: 100;
    }
    .modal {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: var(--radius-3);
      padding: 22px 26px;
      width: 90%; max-width: 580px;
      max-height: 80vh;
      display: flex; flex-direction: column;
    }
    .modal h2 { margin: 0 0 8px 0; font-size: 15px; color: var(--text-0); font-weight: 600; }
    .modal p { margin: 0 0 12px 0; color: var(--text-3); font-size: 12.5px; }
    .modal textarea {
      flex: 1;
      min-height: 120px;
      padding: 10px 12px;
      background: var(--panel-2);
      border: 1px solid var(--border);
      color: var(--text-0);
      border-radius: var(--radius-2);
      font-family: var(--font-mono);
      font-size: 12px;
      resize: vertical;
      outline: none;
    }
    .modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
    .modal-btn {
      all: unset; cursor: pointer;
      padding: 7px 16px;
      border-radius: var(--radius-2);
      font-size: 12.5px;
    }
    .modal-btn.primary { background: var(--accent); color: #fff; font-weight: 500; }
    .modal-btn.primary[disabled] { opacity: 0.5; cursor: default; }
    .modal-btn.secondary { background: var(--panel-2); color: var(--text-1); border: 1px solid var(--border); }
    .flash {
      position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%);
      background: var(--panel); border: 1px solid var(--border); color: var(--text-0);
      padding: 8px 14px; border-radius: var(--radius-2); font-size: 12.5px;
      z-index: 200;
    }
  `;j([l()],M.prototype,"_query",2);j([l()],M.prototype,"_items",2);j([l()],M.prototype,"_selectedSlug",2);j([l()],M.prototype,"_detail",2);j([l()],M.prototype,"_bannerDismissed",2);j([l()],M.prototype,"_aiModalOpen",2);j([l()],M.prototype,"_aiPrompt",2);j([l()],M.prototype,"_aiBusy",2);j([l()],M.prototype,"_aiDraft",2);j([l()],M.prototype,"_flash",2);j([l()],M.prototype,"_detailMenuOpen",2);j([l()],M.prototype,"_activeSkillSlugs",2);M=j([w("ares-skills")],M);var gi=Object.defineProperty,bi=Object.getOwnPropertyDescriptor,tt=(e,t,r,a)=>{for(var s=a>1?void 0:a?bi(t,r):t,i=e.length-1,o;i>=0;i--)(o=e[i])&&(s=(a?o(t,r,s):o(s))||s);return a&&s&&gi(t,r,s),s};let fe=class extends m{constructor(){super(...arguments),this.compact=!1,this._items=[],this._editing=null,this._editorOpen=!1}connectedCallback(){super.connectedCallback(),this._refresh()}async _refresh(){try{const e=await _("/api/jobs"),t=Array.isArray(e)?e:e.jobs??[];this._items=t}catch{this._items=[]}}async _runNow(e,t){t.stopPropagation();try{await v(`/api/jobs/${encodeURIComponent(e)}/run`,{method:"POST"}),C({variant:"info",title:"Scheduled task triggered",body:e})}catch{C({variant:"danger",title:"Run failed",body:e})}setTimeout(()=>this._refresh(),800)}async _toggle(e,t){t.stopPropagation();const r=!e.enabled;if(e.isDynamic)try{await v(`/api/jobs/${encodeURIComponent(e.id)}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({enabled:r})})}catch{}else try{await v(`/api/jobs/${encodeURIComponent(e.id)}/${r?"enable":"disable"}`,{method:"POST"})}catch{}this._refresh()}_open(e){this._editing=Xr(e),this._editorOpen=!0}_create(){this._editing=null,this._editorOpen=!0}_onEditorClose(){this._editorOpen=!1,this._editing=null}_onEditorSaved(){C({variant:"success",title:"Scheduled task saved"}),this._refresh()}_onEditorDeleted(){this._refresh()}render(){return n`
      <div class="list">
        ${this._items.length===0?n`<div class="empty">No scheduled tasks yet. Add one to run prompts on a schedule.</div>`:this._items.map(e=>this._renderRow(e))}
        <button class="add-row" @click=${this._create}>+ Add scheduled task</button>
      </div>
      ${this._editorOpen?n`
        <ares-scheduled-task-editor
          .initial=${this._editing}
          @close=${this._onEditorClose}
          @saved=${this._onEditorSaved}
          @deleted=${this._onEditorDeleted}
        ></ares-scheduled-task-editor>
      `:""}
    `}_renderRow(e){const t=xa(e),r=e.cron||e.defaultCron,a=e.mcps?.length??0,i=`${r?Jr(r):"On demand"} · ${a} MCPs`;return n`
      <div class="row" @click=${()=>this._open(e)}>
        <span class="dot ${t}" title=${t}></span>
        <div class="info">
          <div class="title">${e.title}</div>
          <div class="sub">${i}</div>
        </div>
        <button class="ico" title="Run now" @click=${o=>this._runNow(e.id,o)}>▷</button>
        <div
          class="switch ${e.enabled?"on":""}"
          role="switch"
          aria-checked=${e.enabled?"true":"false"}
          title=${e.enabled?"Disable":"Enable"}
          @click=${o=>this._toggle(e,o)}
        ></div>
      </div>
    `}};fe.styles=y`
    :host { display: block; }
    .list {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: var(--radius-2);
      overflow: hidden;
    }
    .row {
      display: grid;
      grid-template-columns: 12px 1fr auto auto;
      align-items: center;
      gap: 12px;
      padding: 12px 14px;
      cursor: pointer;
      border-bottom: 1px solid var(--border);
      transition: background var(--dur-fast) var(--ease-out);
    }
    .row:last-child { border-bottom: none; }
    .row:hover { background: var(--panel-2); }
    .dot {
      width: 8px; height: 8px;
      border-radius: 50%;
      background: var(--text-3);
      box-shadow: 0 0 0 0 transparent;
    }
    .dot.ok  { background: var(--ok, #10b981); }
    .dot.err { background: var(--err); }
    .dot.off { background: var(--text-3); opacity: 0.5; }
    .info { min-width: 0; }
    .title {
      color: var(--text-0);
      font-size: 13.5px;
      font-weight: 500;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .sub {
      color: var(--text-3);
      font-size: 11.5px;
      margin-top: 2px;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .ico {
      all: unset; cursor: pointer;
      padding: 4px 8px;
      color: var(--text-2);
      border-radius: var(--radius-1);
      font-size: 13px;
    }
    .ico:hover { background: var(--raised, var(--panel)); color: var(--text-0); }
    .switch {
      width: 32px; height: 18px;
      border-radius: 999px;
      background: var(--panel-2);
      border: 1px solid var(--border);
      position: relative;
      cursor: pointer;
      transition: background var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out);
    }
    .switch::after {
      content: "";
      position: absolute;
      top: 1px; left: 1px;
      width: 14px; height: 14px;
      border-radius: 50%;
      background: var(--text-2);
      transition: transform var(--dur-base) var(--ease-out), background var(--dur-base) var(--ease-out);
    }
    .switch.on { background: color-mix(in srgb, var(--accent) 30%, transparent); border-color: var(--accent); }
    .switch.on::after { transform: translateX(14px); background: var(--accent); }
    .add-row {
      display: block;
      width: 100%;
      box-sizing: border-box;
      padding: 12px 14px;
      background: transparent;
      border: none;
      border-top: 1px solid var(--border);
      color: var(--accent);
      cursor: pointer;
      text-align: left;
      font-size: 13px;
    }
    .add-row:hover { background: var(--panel-2); }
    .empty { padding: 24px; text-align: center; color: var(--text-3); font-size: 12.5px; }
  `;tt([E({type:Boolean})],fe.prototype,"compact",2);tt([l()],fe.prototype,"_items",2);tt([l()],fe.prototype,"_editing",2);tt([l()],fe.prototype,"_editorOpen",2);fe=tt([w("ares-scheduled-tasks")],fe);var mi=Object.defineProperty,xi=Object.getOwnPropertyDescriptor,xt=(e,t,r,a)=>{for(var s=a>1?void 0:a?xi(t,r):t,i=e.length-1,o;i>=0;i--)(o=e[i])&&(s=(a?o(t,r,s):o(s))||s);return a&&s&&mi(t,r,s),s};let Ie=class extends m{constructor(){super(...arguments),this._items=[],this._expanded=new Set,this._busy=new Set,this._poll=null}connectedCallback(){super.connectedCallback(),this._refresh(),this._poll=window.setInterval(()=>{document.visibilityState==="visible"&&this._refresh()},1e3)}disconnectedCallback(){super.disconnectedCallback(),this._poll&&clearInterval(this._poll)}async _refresh(){try{const e=await _("/api/mcps");Array.isArray(e)&&(this._items=e)}catch{}}_toggle(e){const t=new Set(this._expanded);t.has(e)?t.delete(e):t.add(e),this._expanded=t}_isConnected(e){return e.active===!0||e.state==="running"}async _setConnection(e,t){if(!this._busy.has(e.name)){this._busy=new Set(this._busy).add(e.name),this._items=this._items.map(r=>r.name===e.name?{...r,state:t?"starting":"disabled"}:r);try{const a=await(await v(`/api/mcps/${encodeURIComponent(e.name)}/${t?"connect":"disconnect"}`,{method:"POST"})).json().catch(()=>({}));t?a.active?C({variant:"success",title:`Connected ${e.name}`,body:`${a.toolCount??0} tools`}):C({variant:"danger",title:`Couldn't connect ${e.name}`,body:a.error||"It may need auth-init / auth. It will retry on next start."}):C({variant:"info",title:`Disconnected ${e.name}`,body:"Stays disconnected until you connect it again."})}catch(r){C({variant:"danger",title:"Action failed",body:r?.message||String(r)})}finally{const r=new Set(this._busy);r.delete(e.name),this._busy=r,await this._refresh()}}}render(){const e=this._items.filter(t=>this._isConnected(t)).length;return n`
      <h2>MCP servers</h2>
      <p class="lead">
        Connect or disconnect each MCP server. Manual choices persist across
        restarts — if you connect a server it stays connected. Click a name
        to see its tools.
      </p>
      <div class="summary">
        <span><b>${e}</b> connected</span>
        <span><b>${this._items.length-e}</b> not connected</span>
        <span><b>${this._items.length}</b> total</span>
      </div>
      <div class="tree">
        ${this._items.map(t=>this._renderRow(t))}
      </div>
    `}_renderRow(e){const t=this._expanded.has(e.name),r=this._isConnected(e),a=e.state==="starting"||this._busy.has(e.name),s=e.state==="error"||!!e.error&&!r,i=r?"ok":a?"warn":s?"err":"off",o=r?"Connected":a?"Connecting…":s?"Error":e.override==="disconnected"?"Disconnected":"Not connected";return n`
      <div>
        <div class="row ${t?"expanded":""}">
          <span class="chev" @click=${()=>this._toggle(e.name)}>▶</span>
          <span class="dot ${i}"></span>
          <span class="name" @click=${()=>this._toggle(e.name)} title=${e.name}>${e.name}</span>
          <span class="status-label">${o}</span>
          ${e.alwaysActive?n`<span class="pin" title="Auto-starts by default">tier-1</span>`:""}
          <span class="count">${e.toolCount??0} tools</span>
          ${r?n`<button class="conn disconnect" ?disabled=${a} @click=${()=>this._setConnection(e,!1)}>Disconnect</button>`:n`<button class="conn connect" ?disabled=${a} @click=${()=>this._setConnection(e,!0)}>${a?"…":"Connect"}</button>`}
        </div>
        ${t?n`
          <div class="body">
            <p>${e.description||"(no description)"}</p>
            ${e.error?n`<p class="err">${e.error}</p>`:""}
            <p style="color: var(--text-3);">
              State: ${e.state}${e.override?` · manual: ${e.override}`:""} · ${e.toolCount??0} tools
            </p>
          </div>
        `:""}
      </div>
    `}};Ie.styles=y`
    :host { display: block; }
    h2 { margin: 0 0 8px 0; font-size: 14px; color: var(--text-0); }
    p.lead { margin: 0 0 16px 0; color: var(--text-3); font-size: 12.5px; max-width: 720px; }
    .summary {
      display: flex; gap: 14px; margin-bottom: 12px;
      font-size: 12px; color: var(--text-3);
    }
    .summary b { color: var(--text-1); font-weight: 600; }
    .tree { background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius-2); }
    .row {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 14px;
      border-bottom: 1px solid var(--border);
    }
    .row:last-child { border-bottom: 0; }
    .row:hover { background: var(--panel-2); }
    .chev { width: 12px; cursor: pointer; transition: transform var(--dur-fast); color: var(--text-3); flex-shrink: 0; }
    .row.expanded .chev { transform: rotate(90deg); }
    .dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .dot.ok { background: var(--ok); box-shadow: 0 0 6px color-mix(in srgb, var(--ok) 70%, transparent); }
    .dot.err { background: var(--err); box-shadow: 0 0 6px color-mix(in srgb, var(--err) 70%, transparent); }
    .dot.warn { background: var(--warn); }
    .dot.off { background: var(--text-4, #555); }
    .name {
      flex: 1; min-width: 0;
      font-family: var(--font-mono); font-size: 12.5px; color: var(--text-0);
      cursor: pointer;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .status-label { font-size: 11px; color: var(--text-3); white-space: nowrap; }
    .count { color: var(--text-3); font-size: 11px; white-space: nowrap; min-width: 52px; text-align: right; }
    .pin { font-size: 10px; color: var(--accent-soft); white-space: nowrap; }
    button.conn {
      all: unset; cursor: pointer;
      padding: 4px 12px; border-radius: var(--radius-1);
      font-size: 11.5px; font-weight: 500;
      border: 1px solid var(--border);
      white-space: nowrap; min-width: 72px; text-align: center;
    }
    button.conn.connect { background: color-mix(in srgb, var(--accent) 14%, transparent); color: var(--accent-soft); border-color: color-mix(in srgb, var(--accent) 40%, transparent); }
    button.conn.connect:hover { background: color-mix(in srgb, var(--accent) 26%, transparent); }
    button.conn.disconnect { background: var(--panel-2); color: var(--text-2); }
    button.conn.disconnect:hover { color: var(--err); border-color: color-mix(in srgb, var(--err) 40%, transparent); }
    button.conn[disabled] { opacity: 0.5; cursor: default; }
    .body { padding: 12px 36px; background: var(--panel-2); color: var(--text-2); font-size: 12px; }
    .body p { margin: 0 0 6px 0; }
    .body .err { color: var(--err); }
  `;xt([l()],Ie.prototype,"_items",2);xt([l()],Ie.prototype,"_expanded",2);xt([l()],Ie.prototype,"_busy",2);Ie=xt([w("ares-mcp-permissions")],Ie);var _i=Object.defineProperty,yi=Object.getOwnPropertyDescriptor,Oe=(e,t,r,a)=>{for(var s=a>1?void 0:a?yi(t,r):t,i=e.length-1,o;i>=0;i--)(o=e[i])&&(s=(a?o(t,r,s):o(s))||s);return a&&s&&_i(t,r,s),s};const wi={logs:"📜",backend:"⚙️",tests:"🧪",frontend:"🎨","ui-ux":"🖌️",architecture:"🏛️"};let ne=class extends m{constructor(){super(...arguments),this.findings=[],this.stats={autoFixed:0,needsUser:0,open:0,reverted:0,total:0},this.loading=!0,this.busyIds=new Set,this.expanded=new Set,this._es=null,this._poll=null}connectedCallback(){super.connectedCallback(),this._load(),this._subscribe(),this._poll=window.setInterval(()=>this._load(),3e4)}disconnectedCallback(){super.disconnectedCallback(),this._es?.close(),this._es=null,this._poll&&(clearInterval(this._poll),this._poll=null)}async _load(){try{const e=await _("/api/bugs");this.stats=e.stats,this.findings=(e.findings||[]).filter(t=>t.status!=="dismissed"&&t.status!=="resolved"),this.loading=!1}catch(e){e instanceof be&&e.status===401&&(this.loading=!1)}}_subscribe(){try{this._es=new EventSource("/api/jobs/events"),this._es.onmessage=e=>{try{const t=JSON.parse(e.data);(t.type==="bug_finding"||t.type==="bug_sweep_complete")&&this._load()}catch{}},this._es.onerror=()=>{}}catch{}}async _act(e,t){this.busyIds=new Set(this.busyIds).add(e);try{await K(`/api/bugs/${e}/${t}`,{}),await this._load()}catch{}finally{const r=new Set(this.busyIds);r.delete(e),this.busyIds=r}}_toggle(e){const t=new Set(this.expanded);t.has(e)?t.delete(e):t.add(e),this.expanded=t}render(){if(this.loading)return n`<div class="empty">Loading findings…</div>`;const e=this.findings.filter(a=>a.status==="needs_user"),t=this.findings.filter(a=>a.status==="auto_fixed"),r=this.findings.filter(a=>a.status==="detected"||a.status==="fixing");return n`
      <div class="stat-strip">
        <div class="stat good"><div class="n">${this.stats.autoFixed}</div><div class="l">Auto-fixed</div></div>
        <div class="stat warn"><div class="n">${this.stats.needsUser}</div><div class="l">Need your command</div></div>
        <div class="stat"><div class="n">${this.stats.open}</div><div class="l">Open / scanning</div></div>
        <div class="stat bad"><div class="n">${this.stats.reverted}</div><div class="l">Reverted</div></div>
      </div>

      ${e.length?n`<div class="section-h">Needs your command</div>
        ${e.map(a=>this._card(a,!0))}`:""}

      ${r.length?n`<div class="section-h">Detected this sweep</div>
        ${r.map(a=>this._card(a,!1))}`:""}

      ${t.length?n`<div class="section-h">Auto-fixed</div>
        ${t.map(a=>this._card(a,!1))}`:""}

      ${this.findings.length?"":n`<div class="empty">No open findings. The debug bot sweeps every 5 minutes. ✓</div>`}
    `}_card(e,t){const r=this.busyIds.has(e.id),a=this.expanded.has(e.id);return n`
      <div class="card">
        <div class="row">
          <div class="icon">${wi[e.layer]??"•"}</div>
          <div class="body">
            <div class="title">${e.title}</div>
            <div class="meta">
              <span class="badge sev-${e.severity}">${e.severity}</span>
              <span class="badge st-${e.status}">${this._statusLabel(e.status)}</span>
              <span class="badge">${e.layer}</span>
              ${e.file?n`<span class="file">${e.file.split("/").slice(-2).join("/")}</span>`:""}
              ${e.seenCount>1?n`<span>seen ${e.seenCount}×</span>`:""}
              ${e.detail||e.proposedDiff?n`<span class="toggle" @click=${()=>this._toggle(e.id)}>${a?"hide":"details"}</span>`:""}
            </div>
            ${e.fixSummary&&e.status==="auto_fixed"?n`<div class="fix-summary">✓ ${e.fixSummary}</div>`:""}
            ${a?n`<div class="detail">${e.proposedDiff?`${e.proposedDiff}

`:""}${e.detail??""}</div>`:""}
          </div>
          <div class="actions">
            ${t?n`<button class="primary" ?disabled=${r} @click=${()=>this._act(e.id,"fix")}>${r?"…":"Fix it"}</button>`:""}
            <button ?disabled=${r} @click=${()=>this._act(e.id,"dismiss")}>Dismiss</button>
          </div>
        </div>
      </div>
    `}_statusLabel(e){return{detected:"open",fixing:"fixing…",auto_fixed:"auto-fixed ✓",needs_user:"needs you",reverted:"reverted"}[e]??e}};ne.styles=y`
    :host { display: block; max-width: 860px; }
    .stat-strip { display: flex; gap: var(--space-3); margin-bottom: var(--space-4); flex-wrap: wrap; }
    .stat {
      flex: 1; min-width: 120px;
      background: var(--panel); border: 1px solid var(--border);
      border-radius: var(--radius-3); padding: var(--space-3) var(--space-4);
    }
    .stat .n { font-size: 24px; font-weight: 600; color: var(--text-0); }
    .stat .l { font-size: 12px; color: var(--text-3); margin-top: 2px; }
    .stat.good .n { color: var(--ok, #3fb950); }
    .stat.warn .n { color: var(--warn, #d29922); }
    .stat.bad .n  { color: var(--danger, #f85149); }

    .section-h { font-size: 13px; color: var(--text-3); text-transform: uppercase;
      letter-spacing: 0.05em; margin: var(--space-4) 0 var(--space-2); }

    .card {
      background: var(--panel); border: 1px solid var(--border);
      border-radius: var(--radius-3); padding: var(--space-3) var(--space-4);
      margin-bottom: var(--space-2);
    }
    .card .row { display: flex; align-items: flex-start; gap: var(--space-3); }
    .card .icon { font-size: 18px; flex-shrink: 0; }
    .card .body { flex: 1; min-width: 0; }
    .card .title { color: var(--text-0); font-weight: 500; font-size: 13.5px; }
    .card .meta { color: var(--text-3); font-size: 11.5px; margin-top: 3px; display: flex; gap: var(--space-2); flex-wrap: wrap; }
    .badge {
      display: inline-block; padding: 1px 8px; border-radius: 999px;
      font-size: 10.5px; border: 1px solid var(--border); color: var(--text-2);
      text-transform: uppercase; letter-spacing: 0.04em;
    }
    .badge.sev-critical { color: var(--danger, #f85149); border-color: currentColor; }
    .badge.sev-high { color: var(--warn, #d29922); border-color: currentColor; }
    .badge.st-auto_fixed { color: var(--ok, #3fb950); border-color: currentColor; }
    .badge.st-needs_user { color: var(--warn, #d29922); border-color: currentColor; }
    .badge.st-reverted { color: var(--danger, #f85149); border-color: currentColor; }

    .actions { display: flex; gap: var(--space-2); flex-shrink: 0; }
    button {
      all: unset; cursor: pointer; padding: 4px 12px; border-radius: var(--radius-1);
      font-size: 12px; border: 1px solid var(--border); color: var(--text-2);
      background: var(--panel-2);
    }
    button:hover { background: var(--border); color: var(--text-0); }
    button.primary { background: color-mix(in srgb, var(--accent) 20%, transparent);
      color: var(--accent); border-color: var(--accent); }
    button[disabled] { opacity: 0.5; cursor: default; }

    .detail {
      margin-top: var(--space-2); padding: var(--space-2) var(--space-3);
      background: var(--bg); border-radius: var(--radius-2);
      font-family: var(--font-mono, monospace); font-size: 11.5px;
      color: var(--text-2); white-space: pre-wrap; word-break: break-word;
      max-height: 240px; overflow: auto;
    }
    .fix-summary { color: var(--ok, #3fb950); font-size: 12px; margin-top: 4px; }
    .toggle { color: var(--accent); cursor: pointer; font-size: 11.5px; }
    .empty { color: var(--text-3); font-size: 13px; padding: var(--space-5); text-align: center; }
    .file { font-family: var(--font-mono, monospace); }
  `;Oe([l()],ne.prototype,"findings",2);Oe([l()],ne.prototype,"stats",2);Oe([l()],ne.prototype,"loading",2);Oe([l()],ne.prototype,"busyIds",2);Oe([l()],ne.prototype,"expanded",2);ne=Oe([w("ares-bugs-fixed")],ne);var ki=Object.defineProperty,$i=Object.getOwnPropertyDescriptor,b=(e,t,r,a)=>{for(var s=a>1?void 0:a?$i(t,r):t,i=e.length-1,o;i>=0;i--)(o=e[i])&&(s=(a?o(t,r,s):o(s))||s);return a&&s&&ki(t,r,s),s};const A={desktopNotif:"ares.notifications.desktop",submitKey:"ares.submit-key",maxParallel:"ares.max-parallel-tasks",screenshotHotkey:"ares.screenshot-hotkey",voiceEnabled:"ares.voice.enabled",dictationDevice:"ares.voice.dictation.device",talkbackEnabled:"ares.talkback.enabled",talkbackVoice:"ares.talkback.voice",talkbackSpeed:"ares.talkback.speed",talkbackLive:"ares.talkback.live",talkbackPause:"ares.talkback.pause-detect-s",talkbackAutoSend:"ares.talkback.auto-send-s",talkbackSmart:"ares.talkback.smart-send"};let f=class extends m{constructor(){super(...arguments),this._feedConfig={sources:{"slack-dm-mentions":!0,"outlook-email":!0,"outlook-calendar":!0,teams:!1,gmail:!1,"google-calendar":!1},checkFrequencyMinutes:15},this._instructions={},this._customizing=null,this._customizeDraft="",this._desktopNotif=!1,this._testingBrowser=!1,this._browserResult=null,this._useMyChrome=!0,this._hotkey="Option+Shift+Q",this._hotkeyDraft="Option+Shift+Q",this._submitKey="enter",this._maxParallel=20,this._voiceEnabled=!1,this._mics=[],this._selectedMic="default",this._talkbackEnabled=!1,this._talkbackVoices=[],this._talkbackVoice="Joanna",this._talkbackSpeed=1.1,this._talkbackLive=!1,this._talkbackPause=1,this._density=(()=>{try{const e=localStorage.getItem("ares.chat.density");return e==="compact"||e==="comfortable"?e:"normal"}catch{return"normal"}})(),this._responseStyle=(()=>{try{const e=localStorage.getItem("ares.chat.response-style");return e==="brief"||e==="detailed"?e:"balanced"}catch{return"balanced"}})(),this._showRelevance=(()=>{try{return localStorage.getItem("ares.feed.show-relevance")!=="0"}catch{return!0}})(),this._suggestionChips=(()=>{try{const e=localStorage.getItem("ares.suggestion-chips");if(!e)return["What can Ares do?","Catch me up on what I missed today"];const t=JSON.parse(e);return Array.isArray(t)?t.slice(0,6):["What can Ares do?","Catch me up on what I missed today"]}catch{return["What can Ares do?","Catch me up on what I missed today"]}})(),this._talkbackAutoSend=3,this._talkbackSmart=!0,this._talkbackAdvancedOpen=!1,this._talkbackPreviewing=!1,this._diagSince="1h",this._diagBusy=!1,this._dangerOpen=!1,this._dangerConfirm="",this._dangerError=null,this._dangerBusy=!1,this._flash=null,this._onDensityChange=e=>{const t=e.target.value;this._density=t;try{localStorage.setItem("ares.chat.density",t)}catch{}document.documentElement.setAttribute("data-density",t)},this._onResponseStyleChange=e=>{const t=e.target.value;this._responseStyle=t;try{localStorage.setItem("ares.chat.response-style",t)}catch{}},this._toggleRelevance=()=>{this._showRelevance=!this._showRelevance;try{localStorage.setItem("ares.feed.show-relevance",this._showRelevance?"1":"0")}catch{}},this._onSuggestionChipsBlur=e=>{const r=(e.target.value||"").split(`
`).map(a=>a.trim()).filter(a=>a.length>0).slice(0,6);this._suggestionChips=r;try{localStorage.setItem("ares.suggestion-chips",JSON.stringify(r))}catch{}document.dispatchEvent(new CustomEvent("ares:suggestion-chips-updated",{detail:{chips:r}}))}}connectedCallback(){super.connectedCallback(),this._loadLocalState(),this._loadServerState(),this._loadVoiceLists()}_loadLocalState(){try{this._desktopNotif=localStorage.getItem(A.desktopNotif)==="1";const e=localStorage.getItem(A.submitKey);(e==="enter"||e==="cmd-enter"||e==="shift-enter-only")&&(this._submitKey=e);const t=parseInt(localStorage.getItem(A.maxParallel)||"",10);Number.isFinite(t)&&t>=1&&t<=50&&(this._maxParallel=t);const r=localStorage.getItem(A.screenshotHotkey);r&&(this._hotkey=r,this._hotkeyDraft=r),this._voiceEnabled=localStorage.getItem(A.voiceEnabled)==="1";const a=localStorage.getItem(A.dictationDevice);a&&(this._selectedMic=a),this._talkbackEnabled=localStorage.getItem(A.talkbackEnabled)==="1";const s=localStorage.getItem(A.talkbackVoice);s&&(this._talkbackVoice=s);const i=parseFloat(localStorage.getItem(A.talkbackSpeed)||"");Number.isFinite(i)&&i>=.5&&i<=2&&(this._talkbackSpeed=i),this._talkbackLive=localStorage.getItem(A.talkbackLive)==="1";const o=parseFloat(localStorage.getItem(A.talkbackPause)||"");Number.isFinite(o)&&o>=.5&&o<=3&&(this._talkbackPause=o);const d=parseFloat(localStorage.getItem(A.talkbackAutoSend)||"");Number.isFinite(d)&&d>=1&&d<=10&&(this._talkbackAutoSend=d),this._talkbackSmart=localStorage.getItem(A.talkbackSmart)!=="0"}catch{}}async _loadServerState(){try{const e=await v("/api/feed/config");e.ok&&(this._feedConfig=await e.json())}catch{}try{const e=await v("/api/feed/instructions");e.ok&&(this._instructions=await e.json())}catch{}}async _loadVoiceLists(){try{const e=await v("/api/talkback/voices");if(e.ok){const t=await e.json();Array.isArray(t.voices)&&(this._talkbackVoices=t.voices)}}catch{}try{const e=await navigator.mediaDevices?.enumerateDevices?.();e&&(this._mics=e.filter(t=>t.kind==="audioinput"))}catch{}}_setLs(e,t){try{localStorage.setItem(e,t)}catch{}}_flashOk(e){this._flash={kind:"ok",text:e},setTimeout(()=>{this._flash=null},2400)}_flashErr(e){this._flash={kind:"err",text:e},setTimeout(()=>{this._flash=null},4e3)}async _toggleDesktopNotif(){const e=!this._desktopNotif;if(e&&typeof Notification<"u")try{const t=await Notification.requestPermission();if(t!=="granted"){this._flashErr(`Notifications permission: ${t}`);return}}catch(t){this._flashErr(`Permission failed: ${t.message}`);return}this._desktopNotif=e,this._setLs(A.desktopNotif,e?"1":"0")}async _toggleSource(e){const t=!this._feedConfig.sources[e],r={...this._feedConfig,sources:{...this._feedConfig.sources,[e]:t}};this._feedConfig=r;try{const a=await v("/api/feed/config",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sources:{[e]:t}})});if(!a.ok)throw new Error(`HTTP ${a.status}`);this._feedConfig=await a.json()}catch(a){this._flashErr(`Could not save: ${a.message}`)}}async _setFrequency(e){this._feedConfig={...this._feedConfig,checkFrequencyMinutes:e};try{const t=await v("/api/feed/config",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({checkFrequencyMinutes:e})});if(!t.ok)throw new Error(`HTTP ${t.status}`);this._feedConfig=await t.json()}catch(t){this._flashErr(`Could not save: ${t.message}`)}}_openCustomize(e){this._customizing=e,this._customizeDraft=this._instructions[e]||""}async _saveCustomize(){if(!this._customizing)return;const e=this._customizing;try{const t=await v("/api/feed/instructions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({[e]:this._customizeDraft})});if(!t.ok)throw new Error(`HTTP ${t.status}`);this._instructions=await t.json(),this._customizing=null,this._flashOk("Saved")}catch(t){this._flashErr(`Could not save: ${t.message}`)}}async _copyDebugUrl(){try{await navigator.clipboard.writeText("chrome://inspect/#remote-debugging"),this._flashOk("Copied chrome://inspect/#remote-debugging")}catch(e){this._flashErr(`Copy failed: ${e.message}`)}}async _testBrowser(){this._testingBrowser=!0,this._browserResult=null;try{const e=await v("/api/browser/test-debug-connection",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});this._browserResult=await e.json()}catch(e){this._browserResult={ok:!1,error:e.message}}finally{this._testingBrowser=!1}}_onHotkeyKey(e){if(e.key==="Enter"){e.preventDefault();const t=e.target.value.trim();this._hotkey=t,this._setLs(A.screenshotHotkey,t),this._flashOk("Hotkey saved — restart Ares to apply")}}_setSubmitKey(e){(e==="enter"||e==="cmd-enter"||e==="shift-enter-only")&&(this._submitKey=e,this._setLs(A.submitKey,e))}_setMaxParallel(e){const t=Math.min(50,Math.max(1,Math.round(e)));this._maxParallel=t,this._setLs(A.maxParallel,String(t))}_toggleVoice(){this._voiceEnabled=!this._voiceEnabled,this._setLs(A.voiceEnabled,this._voiceEnabled?"1":"0")}_setMic(e){this._selectedMic=e,this._setLs(A.dictationDevice,e)}_toggleTalkback(){this._talkbackEnabled=!this._talkbackEnabled,this._setLs(A.talkbackEnabled,this._talkbackEnabled?"1":"0")}_setTalkbackVoice(e){this._talkbackVoice=e,this._setLs(A.talkbackVoice,e)}_setTalkbackSpeed(e){this._talkbackSpeed=e,this._setLs(A.talkbackSpeed,String(e))}_toggleTalkbackLive(){this._talkbackLive=!this._talkbackLive,this._setLs(A.talkbackLive,this._talkbackLive?"1":"0")}_setTalkbackPause(e){this._talkbackPause=e,this._setLs(A.talkbackPause,String(e))}_setTalkbackAutoSend(e){this._talkbackAutoSend=e,this._setLs(A.talkbackAutoSend,String(e))}_toggleTalkbackSmart(){this._talkbackSmart=!this._talkbackSmart,this._setLs(A.talkbackSmart,this._talkbackSmart?"1":"0")}async _previewVoice(){if(!this._talkbackPreviewing){this._talkbackPreviewing=!0;try{const e=`/api/talkback?text=${encodeURIComponent("Hi, I'm "+this._talkbackVoice+". This is your assistant.")}&voice=${encodeURIComponent(this._talkbackVoice)}`,t=await v(e);if(!t.ok)throw new Error(`HTTP ${t.status}`);const r=await t.blob(),a=URL.createObjectURL(r),s=new Audio(a);s.playbackRate=this._talkbackSpeed,s.onended=()=>{URL.revokeObjectURL(a),this._talkbackPreviewing=!1},s.onerror=()=>{URL.revokeObjectURL(a),this._talkbackPreviewing=!1},await s.play()}catch(e){this._flashErr(`Preview failed: ${e.message}`),this._talkbackPreviewing=!1}}}async _exportDiagnostics(){if(!this._diagBusy){this._diagBusy=!0;try{const e=await v(`/api/diagnostics?since=${this._diagSince}`);if(!e.ok)throw new Error(`HTTP ${e.status}`);const t=await e.blob(),r=URL.createObjectURL(t),a=document.createElement("a");a.href=r,a.download=`ares-diagnostics-${this._diagSince}-${new Date().toISOString().replace(/[:.]/g,"-")}.tar.gz`,a.click(),setTimeout(()=>URL.revokeObjectURL(r),1500),this._flashOk("Diagnostics exported")}catch(e){this._flashErr(`Export failed: ${e.message}`)}finally{this._diagBusy=!1}}}async _runFactoryReset(){if(this._dangerConfirm!=="DELETE"){this._dangerError="Type DELETE (uppercase) to confirm.";return}this._dangerBusy=!0,this._dangerError=null;try{const e=await v("/api/admin/factory-reset",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"}),t=await e.json().catch(()=>({}));if(e.status===403){this._dangerError=t.error||"Server refused: ARES_ALLOW_FACTORY_RESET is not set. Per the Production Safety rule, this gate must be opened deliberately before a wipe can run.";return}if(!e.ok){this._dangerError=t.error||`HTTP ${e.status}`;return}this._flashOk("Factory reset queued. The app will quit shortly."),this._dangerOpen=!1}catch(e){this._dangerError=e.message}finally{this._dangerBusy=!1}}_icon(e){return n`<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
      .innerHTML=${{sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>',bell:'<path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',list:'<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/>',globe:'<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z"/>',camera:'<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',chat:'<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',gear:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',speaker:'<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>',mic:'<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>',wave:'<line x1="12" y1="2" x2="12" y2="22"/><path d="M5 8v8M19 8v8M2 11v2M22 11v2M8 5v14M16 5v14"/>',bug:'<rect x="8" y="6" width="8" height="14" rx="4"/><path d="M19 7l-3 2M5 7l3 2M12 4V2M9 22h6M3 12h2M19 12h2M5 17l-2 1M19 17l2 1M5 7L3 6M19 7l2-1"/>',bang:'<path d="M10.29 3.86l-8.18 14a2 2 0 0 0 1.71 3h16.36a2 2 0 0 0 1.71-3l-8.18-14a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',copy:'<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',check:'<polyline points="20 6 9 17 4 12"/>',bars:'<line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>',play:'<polygon points="6 4 20 12 6 20 6 4"/>'}[e]||""}></svg>`}render(){return n`
      <div class="stack">
        ${this._renderAppearance()}
        ${this._renderChatPrefs()}
        ${this._renderNotifications()}
        ${this._renderActivityFeed()}
        ${this._renderBrowser()}
        ${this._renderScreenshot()}
        ${this._renderSubmitBinding()}
        ${this._renderPerformance()}
        ${this._renderVoice()}
        ${this._renderTroubleshooting()}
        ${this._renderDangerZone()}
      </div>
      ${this._renderCustomizeModal()}
      ${this._renderDangerModal()}
      ${this._flash?n`
        <div class="flash ${this._flash.kind}">${this._flash.text}</div>
      `:null}
    `}_renderChatPrefs(){const e=this._density,t=this._responseStyle;return n`
      <section class="card" id="chat-prefs" style="--icon-bg: var(--accent);">
        <div class="card-head">
          <div class="icon-wrap">${this._icon("chat")}</div>
          <div class="titles">
            <h3>Chat preferences</h3>
            <p>Density, response style, suggestion chips, feed relevance bar.</p>
          </div>
        </div>

        <div class="row">
          <div class="row-text">
            <div class="name">Density</div>
            <div class="desc">Spacing between turns. Compact saves screen real estate; Comfortable opens up the room.</div>
          </div>
          <div class="row-control">
            <select .value=${e} @change=${this._onDensityChange}>
              <option value="compact"     ?selected=${e==="compact"}>Compact</option>
              <option value="normal"      ?selected=${e==="normal"}>Normal</option>
              <option value="comfortable" ?selected=${e==="comfortable"}>Comfortable</option>
            </select>
          </div>
        </div>

        <div class="row">
          <div class="row-text">
            <div class="name">Response style</div>
            <div class="desc">Brief = bullet points. Balanced = today. Detailed = explain reasoning + cite sources.</div>
          </div>
          <div class="row-control">
            <select .value=${t} @change=${this._onResponseStyleChange}>
              <option value="brief"    ?selected=${t==="brief"}>Brief</option>
              <option value="balanced" ?selected=${t==="balanced"}>Balanced</option>
              <option value="detailed" ?selected=${t==="detailed"}>Detailed</option>
            </select>
          </div>
        </div>

        <div class="row">
          <div class="row-text">
            <div class="name">Show relevance score on feed items</div>
            <div class="desc">A small bar showing the heuristic score (project match × recency × source weight × handled).</div>
          </div>
          <div class="row-control">
            <div
              class="toggle ${this._showRelevance?"on":""}"
              role="switch"
              tabindex="0"
              aria-checked=${this._showRelevance?"true":"false"}
              @click=${this._toggleRelevance}
              @keydown=${r=>{(r.key===" "||r.key==="Enter")&&(r.preventDefault(),this._toggleRelevance())}}
            ></div>
          </div>
        </div>

        <div class="row block">
          <div class="row-text">
            <div class="name">Quick-action chips (welcome screen)</div>
            <div class="desc">Edit the chips that appear under the greeting. One per line.</div>
          </div>
          <div class="row-control">
            <textarea
              class="chips-textarea"
              rows="3"
              .value=${this._suggestionChips.join(`
`)}
              @blur=${this._onSuggestionChipsBlur}
              placeholder="What can Ares do?&#10;Catch me up on what I missed today"
            ></textarea>
          </div>
        </div>
      </section>
    `}_renderAppearance(){return n`
      <section class="card" id="appearance" style="--icon-bg: var(--accent);">
        <div class="card-head">
          <div class="icon-wrap">${this._icon("sun")}</div>
          <div class="titles">
            <h3>Appearance</h3>
            <p>Choose your preferred color theme.</p>
          </div>
        </div>
        <ares-theme-picker></ares-theme-picker>
      </section>
    `}_renderNotifications(){return n`
      <section class="card" id="notifications" style="--icon-bg: var(--ok);">
        <div class="card-head">
          <div class="icon-wrap">${this._icon("bell")}</div>
          <div class="titles">
            <h3>Notifications</h3>
            <p>Native macOS notifications for incoming feed items + completed tasks.</p>
          </div>
        </div>
        <div class="row">
          <div class="row-text">
            <div class="name">Desktop notifications</div>
            <div class="desc">Show a banner when a task finishes or a high-priority feed item lands.</div>
          </div>
          <div class="row-actions">
            <div
              class="toggle"
              role="switch"
              tabindex="0"
              aria-checked=${this._desktopNotif?"true":"false"}
              @click=${this._toggleDesktopNotif}
            ></div>
          </div>
        </div>
      </section>
    `}_renderActivityFeed(){const e=["slack-dm-mentions","outlook-email","outlook-calendar"].every(t=>this._feedConfig.sources[t]);return n`
      <section class="card" id="activity-feed" style="--icon-bg: var(--ok);">
        <div class="card-head">
          <div class="icon-wrap">${this._icon("list")}</div>
          <div class="titles">
            <h3>Activity Feed</h3>
            <p>Choose which integrations surface items to your activity feed.</p>
          </div>
          ${e?n`
            <div class="right">${this._icon("check")} All sources configured</div>
          `:null}
        </div>

        <div class="group-head">Messaging</div>
        ${this._renderSourceRow("slack-dm-mentions","Slack — DMs & Mentions","Direct messages and @-mentions across your workspaces.",!0)}
        ${this._renderSourceRow("teams","Teams","Requires Teams — connect to enable",!1,"Required")}

        <div class="group-head">Mail</div>
        ${this._renderSourceRow("outlook-email","Outlook Email","Unread inbox + flagged threads.",!0)}
        ${this._renderSourceRow("gmail","Gmail","Connect Google account to enable.",!1)}

        <div class="group-head">Calendar</div>
        ${this._renderSourceRow("outlook-calendar","Outlook Calendar","Today's events + upcoming meeting prep.",!0)}
        ${this._renderSourceRow("google-calendar","Google Calendar","Connect Google account to enable.",!1)}

        <div class="row">
          <div class="row-text">
            <div class="name">Check frequency</div>
            <div class="desc">How often the background poller fans out.</div>
          </div>
          <div class="row-actions">
            <select
              .value=${String(this._feedConfig.checkFrequencyMinutes)}
              @change=${t=>void this._setFrequency(parseInt(t.target.value,10))}
            >
              <option value="5">Every 5 minutes</option>
              <option value="10">Every 10 minutes</option>
              <option value="15">Every 15 minutes</option>
              <option value="30">Every 30 minutes</option>
              <option value="60">Every hour</option>
            </select>
          </div>
        </div>
      </section>
    `}_renderSourceRow(e,t,r,a,s){const o=["slack-dm-mentions","outlook-email","outlook-calendar"].includes(e),d=!!this._feedConfig.sources[e];return n`
      <div class="row ${a?"":"disabled-row"}">
        <div class="row-text">
          <div class="name">
            ${t}
            ${s?n`<span class="badge">${s}</span>`:null}
          </div>
          <div class="desc">${r}</div>
        </div>
        <div class="row-actions">
          ${o?n`
            <button class="link" ?disabled=${!a}
              @click=${()=>this._openCustomize(e)}>
              Customize instructions for ${t.split(" — ")[0]}
            </button>
          `:null}
          <div
            class="toggle"
            role="switch"
            tabindex="0"
            aria-checked=${d?"true":"false"}
            aria-disabled=${a?"false":"true"}
            @click=${()=>a&&void this._toggleSource(e)}
          ></div>
        </div>
      </div>
    `}_renderCustomizeModal(){return this._customizing?n`
      <div class="modal-bg" @click=${()=>{this._customizing=null}}>
        <div class="modal" @click=${e=>e.stopPropagation()}>
          <h4>Customize instructions — ${this._customizing}</h4>
          <p style="margin: 0 0 var(--space-3) 0; color: var(--text-3); font-size: 12px;">
            Free-form guidance the predictor uses when surfacing items from this source.
          </p>
          <textarea
            .value=${this._customizeDraft}
            @input=${e=>{this._customizeDraft=e.target.value}}
            placeholder="e.g. Only surface DMs from my manager. Skip channel-wide @here pings."
          ></textarea>
          <div class="modal-actions">
            <button class="btn secondary" @click=${()=>{this._customizing=null}}>Cancel</button>
            <button class="btn" @click=${this._saveCustomize}>Save</button>
          </div>
        </div>
      </div>
    `:null}_renderBrowser(){return n`
      <section class="card" id="browser" style="--icon-bg: var(--ok);">
        <div class="card-head">
          <div class="icon-wrap">${this._icon("globe")}</div>
          <div class="titles">
            <h3>Browser</h3>
            <p>Connect your existing Chrome session via the remote-debug protocol.</p>
          </div>
        </div>
        <div class="row">
          <div class="row-text">
            <div class="name">Use my Chrome</div>
            <div class="desc">When on, ares-actions controls your already-open Chrome via CDP.</div>
          </div>
          <div class="row-actions">
            <div
              class="toggle"
              role="switch"
              tabindex="0"
              aria-checked=${this._useMyChrome?"true":"false"}
              @click=${()=>{this._useMyChrome=!this._useMyChrome}}
            ></div>
          </div>
        </div>
        ${this._useMyChrome?n`
          <ol class="steps">
            <li>
              Open Chrome and paste this URL in the address bar:
              <div class="copy-field">
                <code>chrome://inspect/#remote-debugging</code>
                <button class="copy-btn" title="Copy" @click=${this._copyDebugUrl}>
                  ${this._icon("copy")}
                </button>
              </div>
            </li>
            <li>Click "Enable remote debugging" in the inspect page.</li>
          </ol>
          <div style="margin-top: var(--space-4);">
            <button class="btn" ?disabled=${this._testingBrowser} @click=${this._testBrowser}>
              ${this._icon("bars")}
              ${this._testingBrowser?"Testing…":"Test Connection"}
            </button>
          </div>
          ${this._browserResult?n`
            <div class="browser-result ${this._browserResult.ok?"ok":"err"}">
              ${this._browserResult.ok?n`Connected. ${this._browserResult.version?n`Browser: ${this._browserResult.version.Browser??"unknown"}`:null}`:n`Failed: ${this._browserResult.error}`}
            </div>
          `:null}
        `:null}
      </section>
    `}_renderScreenshot(){return n`
      <section class="card" id="screenshot" style="--icon-bg: var(--accent);">
        <div class="card-head">
          <div class="icon-wrap">${this._icon("camera")}</div>
          <div class="titles">
            <h3>Screenshot capture</h3>
            <p>Bind a global hotkey to send the active window straight into the chat composer.</p>
          </div>
        </div>
        <div class="row">
          <div class="row-text">
            <div class="name">Global shortcut</div>
            <div class="desc">Currently bound to <code>${this._hotkey}</code>.</div>
          </div>
          <div class="row-actions">
            <input
              type="text"
              .value=${this._hotkeyDraft}
              @input=${e=>{this._hotkeyDraft=e.target.value}}
              @keydown=${this._onHotkeyKey}
              placeholder="Option+Shift+Q"
              style="width: 200px;"
            />
          </div>
        </div>
        <div class="caption">
          Electron accelerator format — e.g. Option+Shift+Q, Control+Alt+S. Press Enter to apply.
          The Electron shell reads this on next boot; we don't register the hotkey from the renderer.
        </div>
      </section>
    `}_renderSubmitBinding(){return n`
      <section class="card" id="submit-key" style="--icon-bg: var(--accent);">
        <div class="card-head">
          <div class="icon-wrap">${this._icon("chat")}</div>
          <div class="titles">
            <h3>Message submit keybinding</h3>
            <p>How the chat composer interprets Enter.</p>
          </div>
        </div>
        <div class="row">
          <div class="row-text">
            <div class="name">Submit message with</div>
            <div class="desc">"Shift+Enter only" lets you draft multi-line prompts without accidental sends.</div>
          </div>
          <div class="row-actions">
            <select
              .value=${this._submitKey}
              @change=${e=>this._setSubmitKey(e.target.value)}
            >
              <option value="enter">Enter (default)</option>
              <option value="cmd-enter">Cmd+Enter</option>
              <option value="shift-enter-only">Shift+Enter only</option>
            </select>
          </div>
        </div>
      </section>
    `}_renderPerformance(){return n`
      <section class="card" id="performance" style="--icon-bg: var(--accent);">
        <div class="card-head">
          <div class="icon-wrap">${this._icon("gear")}</div>
          <div class="titles">
            <h3>Performance</h3>
            <p>Tune the parallel-mode orchestrator.</p>
          </div>
        </div>
        <div class="row">
          <div class="row-text">
            <div class="name">Max parallel tasks <span class="badge">${this._maxParallel}</span></div>
            <div class="desc">Cap on concurrent sub-agents in parallel mode (1–50). Default 20.</div>
          </div>
          <div class="row-actions">
            <input
              type="range" min="1" max="50" step="1"
              .value=${String(this._maxParallel)}
              @input=${e=>this._setMaxParallel(parseInt(e.target.value,10))}
            />
          </div>
        </div>
      </section>
    `}_renderVoice(){return n`
      <section class="card" id="voice" style="--icon-bg: var(--accent);">
        <div class="card-head">
          <div class="icon-wrap">${this._icon("speaker")}</div>
          <div class="titles">
            <h3>Voice</h3>
            <p>Dictation + Talkback over AWS Polly.</p>
          </div>
        </div>
        <div class="row">
          <div class="row-text">
            <div class="name">Voice features enabled</div>
            <div class="desc">Master switch. When off, dictation and talkback are both inert.</div>
          </div>
          <div class="row-actions">
            <div
              class="toggle"
              role="switch"
              tabindex="0"
              aria-checked=${this._voiceEnabled?"true":"false"}
              @click=${this._toggleVoice}
            ></div>
          </div>
        </div>

        ${this._voiceEnabled?n`
          <div class="group-head">${this._icon("mic")} Dictation</div>
          <div class="row">
            <div class="row-text">
              <div class="name">Microphone</div>
              <div class="desc">Dictation will capture audio from this device. The system default follows your OS setting.</div>
            </div>
            <div class="row-actions">
              <select
                .value=${this._selectedMic}
                @change=${e=>this._setMic(e.target.value)}
              >
                <option value="default">System default</option>
                ${this._mics.map(e=>n`
                  <option value=${e.deviceId}>${e.label||`Device ${e.deviceId.slice(0,6)}`}</option>
                `)}
              </select>
            </div>
          </div>

          <div class="group-head">${this._icon("wave")} Talkback</div>
          <div class="row">
            <div class="row-text">
              <div class="name">Read assistant replies aloud</div>
              <div class="desc">Polly synthesises responses on the same your-aws-profile AWS profile.</div>
            </div>
            <div class="row-actions">
              <div
                class="toggle"
                role="switch"
                tabindex="0"
                aria-checked=${this._talkbackEnabled?"true":"false"}
                @click=${this._toggleTalkback}
              ></div>
            </div>
          </div>

          ${this._talkbackEnabled?n`
            <div class="row">
              <div class="row-text">
                <div class="name">Voice</div>
                <div class="desc">${this._talkbackVoices.find(e=>e.id===this._talkbackVoice)?.description??"Pick a Polly voice."}</div>
              </div>
              <div class="row-actions">
                <select
                  .value=${this._talkbackVoice}
                  @change=${e=>this._setTalkbackVoice(e.target.value)}
                >
                  ${this._talkbackVoices.length===0?n`
                    <option value="Joanna">Joanna</option>
                  `:this._talkbackVoices.map(e=>n`
                    <option value=${e.id}>${e.id} (${e.lang})</option>
                  `)}
                </select>
                <button class="btn secondary" ?disabled=${this._talkbackPreviewing} @click=${this._previewVoice}>
                  ${this._icon("play")}${this._talkbackPreviewing?"Playing…":"Preview"}
                </button>
              </div>
            </div>

            <div class="row">
              <div class="row-text">
                <div class="name">Speed <span class="badge">${this._talkbackSpeed.toFixed(2)}×</span></div>
                <div class="desc">Playback rate applied to the synthesised audio.</div>
              </div>
              <div class="row-actions">
                <input type="range" min="0.5" max="2.0" step="0.05"
                  .value=${String(this._talkbackSpeed)}
                  @input=${e=>this._setTalkbackSpeed(parseFloat(e.target.value))}
                />
              </div>
            </div>

            <div class="row">
              <div class="row-text">
                <div class="name">Live mode</div>
                <div class="desc">Keep mic open while the assistant speaks — say 3+ words to interrupt.</div>
              </div>
              <div class="row-actions">
                <div
                  class="toggle"
                  role="switch"
                  tabindex="0"
                  aria-checked=${this._talkbackLive?"true":"false"}
                  @click=${this._toggleTalkbackLive}
                ></div>
              </div>
            </div>

            <div class="row">
              <div class="row-text">
                <div class="name">
                  <button class="link" @click=${()=>{this._talkbackAdvancedOpen=!this._talkbackAdvancedOpen}}>
                    ${this._talkbackAdvancedOpen?"Hide":"Show"} advanced
                  </button>
                </div>
                <div class="desc">Pause detection, auto-send delay, smart send heuristic.</div>
              </div>
            </div>
            ${this._talkbackAdvancedOpen?n`
              <div class="row">
                <div class="row-text">
                  <div class="name">Pause detection <span class="badge">${this._talkbackPause.toFixed(2)} s</span></div>
                  <div class="desc">Silence required before treating speech as ended.</div>
                </div>
                <div class="row-actions">
                  <input type="range" min="0.5" max="3" step="0.05"
                    .value=${String(this._talkbackPause)}
                    @input=${e=>this._setTalkbackPause(parseFloat(e.target.value))}
                  />
                </div>
              </div>
              <div class="row">
                <div class="row-text">
                  <div class="name">Auto-send delay <span class="badge">${this._talkbackAutoSend.toFixed(1)} s</span></div>
                  <div class="desc">Countdown after speech ends before the dictation submits.</div>
                </div>
                <div class="row-actions">
                  <input type="range" min="1" max="10" step="0.1"
                    .value=${String(this._talkbackAutoSend)}
                    @input=${e=>this._setTalkbackAutoSend(parseFloat(e.target.value))}
                  />
                </div>
              </div>
              <div class="row">
                <div class="row-text">
                  <div class="name">Smart send</div>
                  <div class="desc">Auto-submit only when the utterance looks like a complete thought.</div>
                </div>
                <div class="row-actions">
                  <div
                    class="toggle"
                    role="switch"
                    tabindex="0"
                    aria-checked=${this._talkbackSmart?"true":"false"}
                    @click=${this._toggleTalkbackSmart}
                  ></div>
                </div>
              </div>
            `:null}
          `:null}
        `:null}
      </section>
    `}_renderTroubleshooting(){return n`
      <section class="card" id="troubleshooting" style="--icon-bg: var(--accent);">
        <div class="card-head">
          <div class="icon-wrap">${this._icon("bug")}</div>
          <div class="titles">
            <h3>Troubleshooting</h3>
            <p>Bundle logs + recent sessions for support.</p>
          </div>
        </div>
        <div class="row">
          <div class="row-text">
            <div class="name">Export diagnostics</div>
            <div class="desc">Tar.gz of /tmp/ares-chat logs, ~/.ares config, recent sessions, knowledge-graph head.</div>
          </div>
          <div class="row-actions">
            <select
              .value=${this._diagSince}
              @change=${e=>{this._diagSince=e.target.value}}
            >
              <option value="1h">Last 1h</option>
              <option value="2h">Last 2h</option>
              <option value="6h">Last 6h</option>
              <option value="24h">Last 24h</option>
              <option value="all">All time</option>
            </select>
            <button class="btn" ?disabled=${this._diagBusy} @click=${this._exportDiagnostics}>
              ${this._diagBusy?"Bundling…":"Export Diagnostics"}
            </button>
          </div>
        </div>
      </section>
    `}_renderDangerZone(){return n`
      <section class="card danger-card" id="danger-zone" style="--icon-bg: var(--err);">
        <div class="card-head">
          <div class="icon-wrap">${this._icon("bang")}</div>
          <div class="titles">
            <h3 style="color: var(--err);">Danger zone</h3>
            <p>Irreversible operations. Read carefully.</p>
          </div>
        </div>
        <div class="row">
          <div class="row-text">
            <div class="name">Clear all data</div>
            <div class="desc">
              Removes all Ares data including conversations, cached messages,
              knowledge graph, saved credentials, and user preferences. The app will quit
              after cleanup.
            </div>
          </div>
          <div class="row-actions">
            <button class="btn danger" @click=${()=>{this._dangerOpen=!0,this._dangerConfirm="",this._dangerError=null}}>
              Clear all data
            </button>
          </div>
        </div>
      </section>
    `}_renderDangerModal(){return this._dangerOpen?n`
      <div class="modal-bg" @click=${()=>{this._dangerOpen=!1}}>
        <div class="modal" @click=${e=>e.stopPropagation()}>
          <h4 style="color: var(--err);">This is destructive.</h4>
          <p style="margin: 0 0 var(--space-3) 0; color: var(--text-1); font-size: 13px;">
            All conversations, cached messages, knowledge graph, saved credentials,
            and preferences will be deleted. This cannot be undone.
          </p>
          <p style="margin: 0 0 var(--space-2) 0; color: var(--text-3); font-size: 12px;">
            Type <code>DELETE</code> below to confirm.
          </p>
          <input
            type="text"
            .value=${this._dangerConfirm}
            @input=${e=>{this._dangerConfirm=e.target.value}}
            placeholder="DELETE"
            style="width: 100%;"
          />
          ${this._dangerError?n`<div class="danger-error">${this._dangerError}</div>`:null}
          <div class="modal-actions">
            <button class="btn secondary" ?disabled=${this._dangerBusy}
              @click=${()=>{this._dangerOpen=!1}}>Cancel</button>
            <button class="btn danger" ?disabled=${this._dangerBusy||this._dangerConfirm!=="DELETE"}
              @click=${this._runFactoryReset}>
              ${this._dangerBusy?"Working…":"Delete everything"}
            </button>
          </div>
        </div>
      </div>
    `:null}};f.styles=y`
    :host { display: block; font-family: var(--font-ui); color: var(--text-1); }

    .stack { display: flex; flex-direction: column; gap: var(--space-4); }

    section.card {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: var(--radius-3);
      padding: var(--space-5);
      scroll-margin-top: var(--header-h, 48px);
    }

    .card-head {
      display: flex; align-items: flex-start; gap: var(--space-3);
      margin-bottom: var(--space-4);
    }
    .card-head .icon-wrap {
      width: 36px; height: 36px; border-radius: var(--radius-2);
      display: inline-flex; align-items: center; justify-content: center;
      flex: 0 0 36px;
      background: color-mix(in srgb, var(--icon-bg, var(--accent)) 14%, transparent);
      color: var(--icon-bg, var(--accent));
    }
    .card-head .titles { flex: 1; min-width: 0; }
    .card-head h3 { margin: 0; font-size: 15px; color: var(--text-0); font-weight: 600; }
    .card-head p { margin: 2px 0 0 0; font-size: 12.5px; color: var(--text-3); }
    .card-head .right { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--ok); }

    .icon { width: 18px; height: 18px; flex-shrink: 0; }

    .row {
      display: flex; align-items: center; justify-content: space-between;
      gap: var(--space-3);
      padding: var(--space-3) 0;
      border-top: 1px solid var(--border);
    }
    .row:first-of-type { border-top: 0; }
    .row .row-text { flex: 1; min-width: 0; }
    .row .row-text .name {
      color: var(--text-0); font-weight: 500; font-size: 13px;
      display: flex; align-items: center; gap: 8px;
    }
    .row .row-text .name .badge {
      font-size: 10.5px; color: var(--text-3);
      border: 1px solid var(--border-2);
      padding: 1px 6px; border-radius: 4px;
      letter-spacing: 0.04em;
    }
    .row .row-text .desc { font-size: 12px; color: var(--text-3); margin-top: 2px; }
    .row .row-actions { display: flex; align-items: center; gap: var(--space-3); flex-shrink: 0; }
    .row-control { display: flex; align-items: center; gap: var(--space-2); flex-shrink: 0; }
    .row.block { flex-direction: column; align-items: stretch; gap: 8px; }
    .row.block .row-control { width: 100%; }
    .chips-textarea {
      width: 100%;
      min-height: 70px;
      padding: 8px 10px;
      background: var(--panel-2);
      color: var(--text-1);
      border: 1px solid var(--border);
      border-radius: var(--radius-2);
      font-family: var(--font-ui);
      font-size: 12.5px;
      resize: vertical;
      box-sizing: border-box;
    }
    .chips-textarea:focus {
      outline: none;
      border-color: color-mix(in srgb, var(--accent) 60%, var(--border));
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 15%, transparent);
    }
    .row select {
      background: var(--panel-2);
      color: var(--text-1);
      border: 1px solid var(--border);
      border-radius: var(--radius-2);
      padding: 4px 10px;
      font-size: 12.5px;
      font-family: inherit;
      cursor: pointer;
    }
    .row select:focus {
      outline: none;
      border-color: color-mix(in srgb, var(--accent) 60%, var(--border));
    }

    .group-head {
      font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase;
      color: var(--text-3);
      margin-top: var(--space-4); margin-bottom: var(--space-1);
      display: flex; align-items: center; gap: 6px;
    }
    .group-head:first-child { margin-top: 0; }

    .toggle {
      position: relative; width: 36px; height: 20px; border-radius: 999px;
      background: var(--panel-2); border: 1px solid var(--border-2);
      cursor: pointer; transition: background var(--dur-fast) var(--ease-out);
      flex-shrink: 0;
    }
    .toggle::after {
      content: ""; position: absolute; top: 1px; left: 1px;
      width: 16px; height: 16px; border-radius: 50%;
      background: var(--text-2);
      transition: transform var(--dur-fast) var(--ease-spring), background var(--dur-fast) var(--ease-out);
    }
    .toggle[aria-checked="true"] { background: color-mix(in srgb, var(--accent) 50%, transparent); border-color: var(--accent); }
    .toggle[aria-checked="true"]::after { transform: translateX(16px); background: #fff; }
    .toggle[aria-disabled="true"] { opacity: 0.45; cursor: not-allowed; }

    .link {
      all: unset; cursor: pointer; color: var(--accent);
      font-size: 12px; padding: 2px 4px; border-radius: 4px;
    }
    .link:hover { color: var(--accent-soft); }
    .link[disabled] { opacity: 0.4; cursor: not-allowed; }

    .btn {
      all: unset; cursor: pointer;
      padding: 6px 14px;
      background: var(--accent); color: #fff;
      border-radius: var(--radius-2); font-size: 12.5px;
      display: inline-flex; align-items: center; gap: 6px;
      transition: background var(--dur-fast) var(--ease-out);
    }
    .btn:hover { background: var(--accent-soft); }
    .btn[disabled] { opacity: 0.5; cursor: default; }
    .btn.secondary {
      background: var(--panel-2); color: var(--text-1);
      border: 1px solid var(--border-2);
    }
    .btn.secondary:hover { background: var(--raised); }
    .btn.danger {
      background: transparent; color: var(--err);
      border: 1px solid var(--err);
    }
    .btn.danger:hover { background: color-mix(in srgb, var(--err) 14%, transparent); }

    select, input[type="text"], input[type="number"], textarea {
      font-family: inherit;
      background: var(--panel-2);
      color: var(--text-0);
      border: 1px solid var(--border-2);
      border-radius: var(--radius-2);
      padding: 6px 10px;
      font-size: 12.5px;
      transition: border-color var(--dur-fast) var(--ease-out);
    }
    select:focus, input:focus, textarea:focus {
      outline: none; border-color: var(--accent);
    }

    input[type="range"] {
      accent-color: var(--accent);
      width: 240px;
    }

    .copy-field {
      display: flex; align-items: center; gap: 8px;
      background: var(--panel-2); border: 1px solid var(--border-2);
      border-radius: var(--radius-2);
      padding: 6px 10px;
      font-family: var(--font-mono); font-size: 12px; color: var(--text-1);
    }
    .copy-field code { flex: 1; user-select: all; }
    .copy-btn {
      all: unset; cursor: pointer; color: var(--text-3);
      padding: 2px;
    }
    .copy-btn:hover { color: var(--accent); }

    ol.steps {
      margin: 0; padding-left: 18px;
      display: flex; flex-direction: column; gap: var(--space-3);
      font-size: 13px; color: var(--text-1);
    }
    ol.steps li > div { margin-top: 6px; }

    .caption { font-size: 11.5px; color: var(--text-3); margin-top: 4px; }

    .flash {
      position: fixed; bottom: 16px; right: 16px;
      padding: 10px 14px; border-radius: var(--radius-2);
      background: var(--panel); border: 1px solid var(--border-2);
      font-size: 12.5px; color: var(--text-0);
      z-index: 50;
    }
    .flash.ok    { border-color: var(--ok);   color: var(--ok); }
    .flash.err   { border-color: var(--err);  color: var(--err); }

    /* Modal */
    .modal-bg {
      position: fixed; inset: 0;
      background: color-mix(in srgb, #000 60%, transparent);
      display: flex; align-items: center; justify-content: center;
      z-index: 100;
    }
    .modal {
      background: var(--panel); border: 1px solid var(--border-2);
      border-radius: var(--radius-3);
      padding: var(--space-5);
      width: min(560px, 90vw);
      box-shadow: 0 20px 50px -12px rgba(0,0,0,0.6);
    }
    .modal h4 { margin: 0 0 var(--space-3) 0; font-size: 15px; color: var(--text-0); }
    .modal textarea { width: 100%; min-height: 140px; resize: vertical; }
    .modal-actions {
      display: flex; justify-content: flex-end; gap: var(--space-2);
      margin-top: var(--space-4);
    }

    .danger-card { border-color: color-mix(in srgb, var(--err) 35%, var(--border)); }
    .danger-error {
      color: var(--err); font-size: 12px; margin-top: var(--space-2);
      background: color-mix(in srgb, var(--err) 10%, transparent);
      border: 1px solid color-mix(in srgb, var(--err) 30%, transparent);
      padding: 6px 10px; border-radius: var(--radius-2);
    }

    .browser-result {
      margin-top: var(--space-3);
      padding: 8px 10px;
      border-radius: var(--radius-2);
      font-size: 12px;
      border: 1px solid var(--border-2);
      background: var(--panel-2);
    }
    .browser-result.ok  { border-color: var(--ok);  color: var(--ok); }
    .browser-result.err { border-color: var(--err); color: var(--err); }

    .disabled-row { opacity: 0.6; }
  `;b([l()],f.prototype,"_feedConfig",2);b([l()],f.prototype,"_instructions",2);b([l()],f.prototype,"_customizing",2);b([l()],f.prototype,"_customizeDraft",2);b([l()],f.prototype,"_desktopNotif",2);b([l()],f.prototype,"_testingBrowser",2);b([l()],f.prototype,"_browserResult",2);b([l()],f.prototype,"_useMyChrome",2);b([l()],f.prototype,"_hotkey",2);b([l()],f.prototype,"_hotkeyDraft",2);b([l()],f.prototype,"_submitKey",2);b([l()],f.prototype,"_maxParallel",2);b([l()],f.prototype,"_voiceEnabled",2);b([l()],f.prototype,"_mics",2);b([l()],f.prototype,"_selectedMic",2);b([l()],f.prototype,"_talkbackEnabled",2);b([l()],f.prototype,"_talkbackVoices",2);b([l()],f.prototype,"_talkbackVoice",2);b([l()],f.prototype,"_talkbackSpeed",2);b([l()],f.prototype,"_talkbackLive",2);b([l()],f.prototype,"_talkbackPause",2);b([l()],f.prototype,"_density",2);b([l()],f.prototype,"_responseStyle",2);b([l()],f.prototype,"_showRelevance",2);b([l()],f.prototype,"_suggestionChips",2);b([l()],f.prototype,"_talkbackAutoSend",2);b([l()],f.prototype,"_talkbackSmart",2);b([l()],f.prototype,"_talkbackAdvancedOpen",2);b([l()],f.prototype,"_talkbackPreviewing",2);b([l()],f.prototype,"_diagSince",2);b([l()],f.prototype,"_diagBusy",2);b([l()],f.prototype,"_dangerOpen",2);b([l()],f.prototype,"_dangerConfirm",2);b([l()],f.prototype,"_dangerError",2);b([l()],f.prototype,"_dangerBusy",2);b([l()],f.prototype,"_flash",2);f=b([w("ares-settings-shell")],f);var Si=Object.defineProperty,Ci=Object.getOwnPropertyDescriptor,Y=(e,t,r,a)=>{for(var s=a>1?void 0:a?Ci(t,r):t,i=e.length-1,o;i>=0;i--)(o=e[i])&&(s=(a?o(t,r,s):o(s))||s);return a&&s&&Si(t,r,s),s};const os={person:"#F4C430",event:"#9B5CF6",channel:"#33C7BF",organization:"#E45CB7",project:"#7C7CF8",product:"#56C8F2","defined-term":"#F0B040",service:"#56D690","creative-work":"#5C9BFA",action:"#E45656"},Ar="ares.kg-drawer-width",Er=280,Tr=560,Ai=380;function kt(e){return os[e]??"var(--accent)"}let B=class extends m{constructor(){super(...arguments),this.entityId=null,this.labelIndex=null,this._node=null,this._edges=[],this._loading=!1,this._summarizing=!1,this._summaryError=null,this._width=Ai,this._neighborLabels=new Map,this._onResizeStart=e=>{e.preventDefault();const t=e.clientX,r=this._width,a=i=>{const o=t-i.clientX,d=Math.max(Er,Math.min(Tr,r+o));this.style.setProperty("--drawer-w",`${d}px`),this._width=d},s=()=>{window.removeEventListener("pointermove",a),window.removeEventListener("pointerup",s),this._saveWidth(this._width)};window.addEventListener("pointermove",a),window.addEventListener("pointerup",s)}}connectedCallback(){super.connectedCallback(),this._loadStoredWidth()}willUpdate(e){e.has("entityId")&&this.entityId&&this._loadNode(),e.has("entityId")&&!this.entityId&&(this._node=null,this._edges=[],this._neighborLabels.clear())}_loadStoredWidth(){try{const e=localStorage.getItem(Ar);if(e){const t=parseInt(e,10);Number.isFinite(t)&&(this._width=Math.max(Er,Math.min(Tr,t)))}}catch{}this.style.setProperty("--drawer-w",`${this._width}px`)}_saveWidth(e){this._width=e,this.style.setProperty("--drawer-w",`${e}px`);try{localStorage.setItem(Ar,String(e))}catch{}}async _loadNode(){if(this.entityId){this._loading=!0,this._summaryError=null;try{const e=await _(`/api/knowledge-graph/node/${encodeURIComponent(this.entityId)}`);this._node=e.node,this._edges=e.edges||[];const t=new Set;for(const s of this._edges)s.from!==this.entityId&&t.add(s.from),s.to!==this.entityId&&t.add(s.to);const r=new Map,a=[...t].slice(0,60);await Promise.all(a.map(async s=>{try{const i=await _(`/api/knowledge-graph/node/${encodeURIComponent(s)}`);i.node&&r.set(s,i.node)}catch{}})),this._neighborLabels=r,this._node&&!this._node.meta?.summary&&this._summarize()}catch{this._node=null,this._edges=[]}finally{this._loading=!1}}}_close(){this.dispatchEvent(new CustomEvent("close-drawer",{bubbles:!0,composed:!0}))}_focus(){this._node&&this.dispatchEvent(new CustomEvent("focus-node",{detail:{id:this._node.id,label:this._node.label??this._node.id,edges:this._edges.length},bubbles:!0,composed:!0}))}_ask(){if(!this._node)return;const e=this._node.label??this._node.id;et("draft",`Tell me everything you know about ${e}`),I({top:"chat",sub:null})}async _summarize(){if(this._node){this._summarizing=!0,this._summaryError=null;try{const e=await K(`/api/knowledge-graph/entity/${encodeURIComponent(this._node.id)}/summarize`,{});this._node&&(this._node={...this._node,meta:{...this._node.meta||{},summary:e.summary}})}catch(e){this._summaryError=e.message}finally{this._summarizing=!1}}}_retarget(e){this.dispatchEvent(new CustomEvent("retarget",{detail:{id:e},bubbles:!0,composed:!0}))}_renderSummary(e){const t=new Map;for(const c of this._neighborLabels.values()){const p=c.label??c.id;p.length>=3&&t.set(p.toLowerCase(),{id:c.id,type:c.type,label:p})}if(this.labelIndex)for(const[c,p]of this.labelIndex)c.length>=3&&!t.has(c.toLowerCase())&&t.set(c.toLowerCase(),{id:p.id,type:p.type,label:c});if(t.size===0)return n`${e}`;const a=[...t.values()].sort((c,p)=>p.label.length-c.label.length).map(c=>c.label).map(c=>c.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")),s=new RegExp(`\\b(${a.join("|")})\\b`,"gi"),i=[];let o=0,d;for(;(d=s.exec(e))!==null;){d.index>o&&i.push(e.slice(o,d.index));const c=d[0],p=t.get(c.toLowerCase());if(p){const h=kt(p.type);i.push(n`<span
          class="entity-pill"
          style="--pill-color:${h}"
          @click=${()=>this._retarget(p.id)}
        >${c}</span>`)}else i.push(c);o=d.index+c.length}return o<e.length&&i.push(e.slice(o)),n`${i}`}render(){if(!this.entityId)return n``;const e=this._node,t=e?.label??this.entityId,r=e?.type??"—",a=kt(r),s=new Map;for(const o of this._edges){const d=o.label||"related",c=s.get(d)||[];c.push(o),s.set(d,c)}const i=e?.meta?.summary;return n`
      <div
        class="resize-handle"
        @pointerdown=${this._onResizeStart}
        title="Drag to resize"
      ></div>
      <div class="frame">
        <div class="header">
          <span class="pill" style="--type-color:${a}">${r}</span>
          <div class="title" title=${t}>${t}</div>
          <button class="close" @click=${this._close} title="Close">✕</button>
        </div>
        <div class="actions">
          <button class="action primary" @click=${this._focus} title="Re-layout the graph around this node">Focus</button>
          <button
            class="action"
            ?disabled=${this._summarizing||!e}
            @click=${this._summarize}
            title="Generate a Haiku summary"
          >${this._summarizing?"Summarizing…":i?"Re-summarize":"Summarize"}</button>
          <button class="action" @click=${this._ask} title="Send a question to the chat">Ask</button>
        </div>
        <div class="body">
          ${this._loading?n`<div class="empty">Loading…</div>`:""}
          ${this._summarizing&&!i?n`
            <section class="section">
              <h4>Summary</h4>
              <div class="summary shimmer">Generating summary…</div>
            </section>`:""}
          ${i?n`
            <section class="section">
              <h4>Summary</h4>
              <div class="summary">${this._renderSummary(i)}</div>
            </section>`:""}
          ${this._summaryError?n`<div class="err">${this._summaryError}</div>`:""}
          ${e?.meta&&Object.keys(e.meta).filter(o=>o!=="summary"&&o!=="summary_ts").length>0?n`
            <section class="section">
              <h4>Properties</h4>
              ${Object.entries(e.meta).filter(([o])=>o!=="summary"&&o!=="summary_ts").map(([o,d])=>n`
                  <div class="meta-row">
                    <div class="k">${o}</div>
                    <div class="v">${typeof d=="string"?d:JSON.stringify(d)}</div>
                  </div>
                `)}
            </section>`:""}
          <section class="section">
            <h4>Relationships (${this._edges.length})</h4>
            ${this._edges.length===0?n`<div class="empty">No relationships.</div>`:""}
            ${[...s.entries()].map(([o,d])=>n`
              <div class="group">
                <div class="group-label">${this._humanise(o)} (${d.length})</div>
                <div class="chips">
                  ${d.slice(0,30).map(c=>{const p=c.from===this.entityId?c.to:c.from,h=this._neighborLabels.get(p),u=h?.label??p,$=h?kt(h.type):"var(--accent)";return n`<button
                      class="chip"
                      style="border-color:color-mix(in srgb, ${$} 36%, transparent); color:${$};"
                      @click=${()=>this._retarget(p)}
                    >${u}</button>`})}
                </div>
              </div>
            `)}
          </section>
        </div>
      </div>
    `}_humanise(e){return e?e.replace(/[-_]+/g," ").replace(/\b\w/g,t=>t.toUpperCase()):"Related"}};B.styles=y`
    :host {
      display: block;
      width: var(--drawer-w, 380px);
      min-width: 280px;
      max-width: 560px;
      height: 100%;
      background: var(--panel);
      border-left: 1px solid var(--border);
      position: relative;
      overflow: hidden;
      animation: slide-in var(--dur-base) var(--ease-out);
    }
    @keyframes slide-in {
      from { transform: translateX(100%); opacity: 0; }
      to   { transform: translateX(0);    opacity: 1; }
    }
    .resize-handle {
      position: absolute;
      left: 0; top: 0; bottom: 0;
      width: 6px;
      cursor: ew-resize;
      background: transparent;
      z-index: 2;
    }
    .resize-handle:hover { background: var(--border); }

    .frame {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
    }
    .header {
      padding: 14px 16px 10px 16px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      font-size: 10.5px;
      font-weight: 500;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      border-radius: 999px;
      flex-shrink: 0;
      background: color-mix(in srgb, var(--type-color) 14%, transparent);
      color: var(--type-color);
      border: 1px solid color-mix(in srgb, var(--type-color) 28%, transparent);
    }
    .title {
      flex: 1;
      min-width: 0;
      font-size: 15px;
      font-weight: 600;
      color: var(--text-0);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .close {
      all: unset;
      cursor: pointer;
      padding: 4px;
      color: var(--text-3);
      border-radius: var(--radius-1);
      line-height: 1;
      font-size: 16px;
    }
    .close:hover { background: var(--panel-2); color: var(--text-0); }

    .actions {
      display: flex;
      gap: 6px;
      padding: 10px 16px;
      border-bottom: 1px solid var(--border);
    }
    .action {
      all: unset;
      cursor: pointer;
      flex: 1;
      text-align: center;
      padding: 7px 10px;
      font-size: 12px;
      color: var(--text-1);
      background: var(--panel-2);
      border: 1px solid var(--border);
      border-radius: var(--radius-1);
      transition: background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out);
    }
    .action:hover { background: var(--border); color: var(--text-0); }
    .action.primary {
      background: color-mix(in srgb, var(--accent) 18%, transparent);
      color: var(--accent);
      border-color: color-mix(in srgb, var(--accent) 40%, transparent);
    }
    .action.primary:hover { background: color-mix(in srgb, var(--accent) 28%, transparent); }
    .action[disabled] { opacity: 0.5; cursor: progress; }

    .body {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding: 14px 16px 24px 16px;
      font-size: 12.5px;
      color: var(--text-1);
    }
    .section {
      margin-top: 14px;
    }
    .section:first-child { margin-top: 0; }
    .section h4 {
      margin: 0 0 8px 0;
      font-size: 10.5px;
      letter-spacing: 0.08em;
      color: var(--text-3);
      text-transform: uppercase;
      font-weight: 500;
    }
    .meta-row {
      display: grid;
      grid-template-columns: 100px 1fr;
      gap: 6px;
      padding: 4px 0;
      border-top: 1px solid var(--border);
      font-size: 12px;
    }
    .meta-row:first-of-type { border-top: 0; }
    .meta-row .k { color: var(--text-3); }
    .meta-row .v { color: var(--text-1); word-break: break-word; }

    .group { margin-top: 10px; }
    .group:first-of-type { margin-top: 0; }
    .group-label {
      font-size: 11px;
      color: var(--text-2);
      margin: 0 0 6px 0;
    }
    .chips { display: flex; flex-wrap: wrap; gap: 5px; }
    .chip {
      all: unset;
      cursor: pointer;
      padding: 3px 9px;
      border-radius: 999px;
      font-size: 11.5px;
      color: var(--text-1);
      background: var(--panel-2);
      border: 1px solid var(--border);
      transition: background var(--dur-fast) var(--ease-out);
    }
    .chip:hover { background: var(--border); color: var(--text-0); }

    .empty {
      color: var(--text-3);
      font-size: 12px;
      font-style: italic;
    }
    .summary {
      line-height: 1.5;
      color: var(--text-1);
      white-space: pre-wrap;
    }
    .entity-pill {
      display: inline-block;
      padding: 0 6px;
      margin: 0 1px;
      border-radius: 4px;
      font-size: 0.95em;
      cursor: pointer;
      background: color-mix(in srgb, var(--pill-color, var(--accent)) 14%, transparent);
      color: var(--pill-color, var(--accent));
      border: 1px solid color-mix(in srgb, var(--pill-color, var(--accent)) 30%, transparent);
    }
    .entity-pill:hover { background: color-mix(in srgb, var(--pill-color, var(--accent)) 24%, transparent); }
    .err {
      color: var(--err);
      font-size: 12px;
    }
    .shimmer {
      color: var(--text-3);
      animation: shimmer 1.5s ease-in-out infinite;
    }
    @keyframes shimmer {
      0%, 100% { opacity: 0.4; }
      50% { opacity: 1; }
    }
  `;Y([E({type:String})],B.prototype,"entityId",2);Y([E({attribute:!1})],B.prototype,"labelIndex",2);Y([l()],B.prototype,"_node",2);Y([l()],B.prototype,"_edges",2);Y([l()],B.prototype,"_loading",2);Y([l()],B.prototype,"_summarizing",2);Y([l()],B.prototype,"_summaryError",2);Y([l()],B.prototype,"_width",2);Y([l()],B.prototype,"_neighborLabels",2);B=Y([w("ares-kg-entity-drawer")],B);const Ei=os;var Ti=Object.defineProperty,Ii=Object.getOwnPropertyDescriptor,U=(e,t,r,a)=>{for(var s=a>1?void 0:a?Ii(t,r):t,i=e.length-1,o;i>=0;i--)(o=e[i])&&(s=(a?o(t,r,s):o(s))||s);return a&&s&&Ti(t,r,s),s};try{Dr.use(ds)}catch(e){console.warn("[kg] fcose registration failed:",e)}let P=class extends m{constructor(){super(...arguments),this._stats=null,this._nodes=[],this._edges=[],this._focusId=null,this._focusLabel=null,this._focusEdgeCount=0,this._searchQ="",this._searching=!1,this._searchResults=[],this._searchOpen=!1,this._typeFilter="all",this._cy=null,this._hostRef=Wt(),this._searchTimer=null,this._searchFocusTimer=null,this._resizeObserver=null,this._didInitialFit=!1,this._onSearchInput=e=>{const t=e.target.value;if(this._searchQ=t,this._searchTimer&&window.clearTimeout(this._searchTimer),this._searchFocusTimer&&window.clearTimeout(this._searchFocusTimer),!t.trim()){this._searchResults=[],this._searching=!1,this._searchOpen=!1;return}this._searchOpen=!0,this._searching=!0,this._searchTimer=window.setTimeout(()=>{this._runSearch(t)},200),this._searchFocusTimer=window.setTimeout(()=>{this._searchToFocus(t)},300)},this._onSearchKeydown=e=>{e.key==="Enter"&&(e.preventDefault(),this._searchFocusTimer&&window.clearTimeout(this._searchFocusTimer),this._searchToFocus(this._searchQ))},this._onSearchBlur=()=>{setTimeout(()=>{this._searchOpen=!1},120)},this._clearFocusBanner=()=>{this.clearFocus(),this.dispatchEvent(new CustomEvent("ares-kg-clear",{bubbles:!0,composed:!0}))}}connectedCallback(){super.connectedCallback(),this._loadStats()}disconnectedCallback(){if(super.disconnectedCallback(),this._resizeObserver){try{this._resizeObserver.disconnect()}catch{}this._resizeObserver=null}if(this._cy){try{this._cy.destroy()}catch{}this._cy=null}this._searchTimer&&window.clearTimeout(this._searchTimer),this._searchFocusTimer&&window.clearTimeout(this._searchFocusTimer)}async _loadStats(){try{this._stats=await _("/api/knowledge-graph/stats"),this._stats.nodes>0&&await this._loadAll()}catch{this._stats={nodes:0,edges:0,file:""}}}async reload(){await this._loadStats()}async _loadAll(){const e=["person","event","channel","organization","project","product","defined-term","service","creative-work","action"],[t,r]=await Promise.all([Promise.all(e.map(async a=>{try{return(await _(`/api/knowledge-graph/${encodeURIComponent(a)}/list`)).nodes??[]}catch{return[]}})),(async()=>{try{return(await _("/api/knowledge-graph/edges")).edges??[]}catch{return[]}})()]);this._nodes=t.flat(),this._edges=r,await this.updateComplete,this._renderGraph()}_typeColor(e){return Ei[e]??"#9B5CF6"}_renderGraph(){const e=this._hostRef.value;if(!e)return;if(this._cy)try{this._cy.destroy()}catch{}if(this._nodes.length===0)return;this._didInitialFit=!1;const t=this._nodes.map(a=>({data:{id:a.id,label:a.label??a.id,type:a.type,color:this._typeColor(a.type)}})),r=this._edges.map((a,s)=>({data:{id:`e${s}`,source:a.from,target:a.to,label:a.label??"",crossFile:0}}));if(this._cy=Dr({container:e,elements:[...t,...r],style:[{selector:"node",style:{"background-color":"data(color)",label:"data(label)",color:"#e0e0e8","font-size":"9px","text-valign":"bottom","text-margin-y":5,width:14,height:14,"transition-property":"opacity, width, height","transition-duration":220}},{selector:"node.faded",style:{opacity:.15}},{selector:"node.focused",style:{width:28,height:28,"border-width":2,"border-color":"var(--accent)"}},{selector:"edge",style:{width:1.5,"line-color":"#555566","target-arrow-shape":"none","curve-style":"bezier",opacity:.6}},{selector:"edge.faded",style:{opacity:.05}},{selector:"edge.labeled",style:{label:"data(label)","font-size":"9px",color:"var(--text-3)","text-rotation":"autorotate","text-margin-y":-4}},{selector:"edge.crossfile",style:{"line-style":"dashed"}}],layout:{name:"fcose",quality:"default",randomize:!0,animate:!1,nodeDimensionsIncludeLabels:!0,idealEdgeLength:80,nodeRepulsion:4500,edgeElasticity:.45,nestingFactor:.1,gravity:.25,gravityRange:3.8,numIter:2500,tile:!0,tilingPaddingVertical:10,tilingPaddingHorizontal:10,packComponents:!0}}),this._cy.on("tap","node",a=>{const s=a.target.id(),i=this._nodes.find(o=>o.id===s);this.dispatchEvent(new CustomEvent("ares-kg-focus",{detail:{id:s,label:i?.label??s,type:i?.type??""},bubbles:!0,composed:!0}))}),this._cy.on("tap","edge",a=>{const s=a.target,i=s.source().id(),o=s.target().id(),d=s.data("relation")||"related",c=this._nodes.find(h=>h.id===i),p=this._nodes.find(h=>h.id===o);this.dispatchEvent(new CustomEvent("ares-kg-edge-tap",{detail:{sourceId:i,targetId:o,relation:d,sourceLabel:c?.label??i,targetLabel:p?.label??o},bubbles:!0,composed:!0}))}),this._cy.one("layoutstop",()=>{try{this._cy?.fit(void 0,40)}catch{}this._didInitialFit=!0}),this._resizeObserver)try{this._resizeObserver.disconnect()}catch{}this._resizeObserver=new ResizeObserver(a=>{for(const s of a){const{width:i,height:o}=s.contentRect;if(i>0&&o>0&&this._cy&&(this._cy.resize(),!this._didInitialFit)){try{this._cy.fit(void 0,40)}catch{}this._didInitialFit=!0}}});try{this._resizeObserver.observe(e)}catch{}}async focusEntity(e){if(!this._cy)return;let t=[],r=null;try{const o=await _(`/api/knowledge-graph/node/${encodeURIComponent(e)}`);r=o.node,t=o.edges||[]}catch{}this._focusId=e,this._focusLabel=r?.label??e,this._focusEdgeCount=t.length;const a=this._cy,s=new Set(a.edges().map(o=>o.id())),i=new Set;for(const o of t){i.add(o.from),i.add(o.to);const d=`f-${o.from}-${o.to}-${o.label||""}`;s.has(d)||a.getElementById(o.from).length!==0&&a.getElementById(o.to).length!==0&&a.add({group:"edges",data:{id:d,source:o.from,target:o.to,label:o.label??"",crossFile:0}})}a.batch(()=>{a.nodes().removeClass("faded focused"),a.edges().removeClass("faded labeled crossfile"),a.nodes().forEach(o=>{o.id()===e||i.has(o.id())||o.addClass("faded")}),a.getElementById(e).addClass("focused"),a.edges().forEach(o=>{const d=o.source().id(),c=o.target().id();if(d===e||c===e){o.addClass("labeled");const p=o.source().data("type"),h=o.target().data("type");p&&h&&p!==h&&o.addClass("crossfile")}else o.addClass("faded")})}),a.center(a.getElementById(e)),a.zoom({level:Math.max(a.zoom(),.9),renderedPosition:{x:a.width()/2,y:a.height()/2}})}clearFocus(){this._focusId=null,this._focusLabel=null,this._focusEdgeCount=0,this._cy&&(this._cy.batch(()=>{this._cy.nodes().removeClass("faded focused"),this._cy.edges().removeClass("faded labeled crossfile")}),this._cy.fit())}buildLabelIndex(){const e=new Map;for(const t of this._nodes){const r=t.label??t.id;r.length>=3&&e.set(r,{id:t.id,type:t.type})}return e}async _rebuild(){await v("/api/knowledge-graph/rebuild",{method:"POST"}),this._loadStats()}_onFilterChip(e){this._typeFilter=e,this._applyTypeFilter()}_applyTypeFilter(){if(!this._cy)return;const e=this._cy;e.batch(()=>{this._typeFilter==="all"?(e.nodes().style("display","element"),e.edges().style("display","element")):(e.nodes().forEach(t=>{t.data("type")===this._typeFilter?t.style("display","element"):t.style("display","none")}),e.edges().forEach(t=>{const r=t.source().style("display")!=="none",a=t.target().style("display")!=="none";r&&a?t.style("display","element"):t.style("display","none")}))})}async _searchToFocus(e){if(!e.trim())return;const t=e.trim().toLowerCase(),r=this._nodes.find(a=>(a.label??a.id).toLowerCase().includes(t));r&&(this._searchOpen=!1,this.focusEntity(r.id),this.dispatchEvent(new CustomEvent("ares-kg-focus",{detail:{id:r.id,label:r.label??r.id,type:r.type},bubbles:!0,composed:!0})))}async _runSearch(e){if(e===this._searchQ)try{const t=await _(`/api/knowledge-graph/search?q=${encodeURIComponent(e)}&limit=12`);if(e!==this._searchQ)return;this._searchResults=t.nodes||[]}catch{this._searchResults=[]}finally{this._searching=!1}}_onResultClick(e){this._searchOpen=!1,this._searchQ=e.label??e.id,this.focusEntity(e.id),this.dispatchEvent(new CustomEvent("ares-kg-focus",{detail:{id:e.id,label:e.label??e.id,type:e.type},bubbles:!0,composed:!0}))}render(){const e=!this._stats||this._stats.nodes===0;return n`
      <div class="toolbar">
        <span>Nodes: ${this._stats?.nodes??"—"} · Edges: ${this._stats?.edges??"—"}</span>
        <div class="search-wrap">
          <input
            class="search-input"
            type="text"
            placeholder="Search nodes by label…"
            .value=${this._searchQ}
            @input=${this._onSearchInput}
            @keydown=${this._onSearchKeydown}
            @focus=${()=>{this._searchQ&&(this._searchOpen=!0)}}
            @blur=${this._onSearchBlur}
          />
          ${this._searchOpen&&(this._searching||this._searchResults.length>0||this._searchQ)?n`
            <div class="popover">
              ${this._searching?n`<div class="placeholder">Searching…</div>`:""}
              ${!this._searching&&this._searchResults.length===0?n`<div class="placeholder">No matches.</div>`:""}
              ${this._searchResults.map(t=>n`
                <div class="row" @mousedown=${r=>r.preventDefault()} @click=${()=>this._onResultClick(t)}>
                  <span class="dot" style="background:${this._typeColor(t.type)}"></span>
                  <span class="label">${t.label??t.id}</span>
                  <span class="type-chip" style="color:${this._typeColor(t.type)}">${t.type}</span>
                </div>
              `)}
            </div>
          `:""}
        </div>
        <span style="flex:1"></span>
        <button class="btn" @click=${this._rebuild}>Initialize file</button>
      </div>
      <div class="filter-chips">
        ${P.TYPE_FILTERS.map(t=>n`
          <button
            class="filter-chip ${this._typeFilter===t.key?"active":""}"
            @click=${()=>this._onFilterChip(t.key)}
          >${t.label}</button>
        `)}
      </div>
      ${this._focusId?n`
        <div class="focus-banner">
          <span>Showing relationships for:</span>
          <span class="label">${this._focusLabel}</span>
          <span class="meta">· ${this._focusEdgeCount} ${this._focusEdgeCount===1?"connection":"connections"}</span>
          <button class="clear" @click=${this._clearFocusBanner} title="Clear focus">✕</button>
        </div>
      `:""}
      <div class="frame">
        <div class="canvas">
          ${e?n`
            <div class="empty">
              The knowledge graph is empty.<br />
              Q21 ships a cold build over your journal; for now you can
              click <em>Initialize file</em> to create
              <code>~/.ares/knowledge-graph.jsonl</code>.
            </div>
          `:n`<div ${ft(this._hostRef)} style="position:absolute; inset:0; background: #1a1a2e; border-radius: 8px;"></div>`}
        </div>
      </div>
    `}};P.styles=y`
    :host { display: flex; flex-direction: column; height: 100%; gap: 12px; }
    .toolbar {
      display: flex;
      gap: 12px;
      align-items: center;
      color: var(--text-3);
      font-size: 12px;
      position: relative;
    }
    .toolbar .btn {
      all: unset;
      cursor: pointer;
      padding: 4px 10px;
      border-radius: var(--radius-1);
      background: var(--panel-2);
      color: var(--text-1);
      border: 1px solid var(--border);
      font-size: 11.5px;
    }
    .search-wrap {
      position: relative;
      flex: 1;
      max-width: 360px;
    }
    .search-input {
      width: 100%;
      box-sizing: border-box;
      padding: 5px 10px;
      background: var(--panel);
      border: 1px solid var(--border);
      color: var(--text-0);
      border-radius: var(--radius-1);
      font-size: 12px;
      outline: none;
      transition: border-color var(--dur-fast) var(--ease-out);
    }
    .search-input:focus { border-color: var(--accent); }
    .popover {
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      right: 0;
      max-height: 320px;
      overflow-y: auto;
      background: var(--panel-2);
      border: 1px solid var(--border);
      border-radius: var(--radius-2);
      box-shadow: 0 6px 24px rgba(0,0,0,0.3);
      z-index: 20;
      animation: fade-in var(--dur-fast) var(--ease-out);
    }
    @keyframes fade-in {
      from { opacity: 0; transform: translateY(-4px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .popover .row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 7px 12px;
      cursor: pointer;
      font-size: 12.5px;
      color: var(--text-1);
      border-bottom: 1px solid var(--border);
    }
    .popover .row:last-child { border-bottom: 0; }
    .popover .row:hover { background: var(--border); color: var(--text-0); }
    .popover .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .popover .label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .popover .type-chip {
      font-size: 10px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--text-3);
      flex-shrink: 0;
    }
    .popover .placeholder {
      padding: 12px;
      color: var(--text-3);
      font-style: italic;
      font-size: 12px;
    }

    .filter-chips {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      padding: 0 0 8px 0;
    }
    .filter-chip {
      all: unset;
      cursor: pointer;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 11px;
      color: var(--text-2);
      background: var(--panel-2);
      border: 1px solid var(--border);
      transition: background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out);
    }
    .filter-chip:hover { background: var(--border); color: var(--text-0); }
    .filter-chip.active {
      background: color-mix(in srgb, var(--accent) 18%, transparent);
      color: var(--accent);
      border-color: color-mix(in srgb, var(--accent) 40%, transparent);
    }

    .focus-banner {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 7px 12px;
      background: color-mix(in srgb, var(--accent) 12%, var(--panel));
      border: 1px solid color-mix(in srgb, var(--accent) 32%, transparent);
      border-radius: var(--radius-1);
      color: var(--text-0);
      font-size: 12.5px;
      animation: fade-in var(--dur-base) var(--ease-out);
    }
    .focus-banner .label { font-weight: 500; }
    .focus-banner .meta { color: var(--text-3); font-size: 11.5px; }
    .focus-banner .clear {
      all: unset;
      cursor: pointer;
      margin-left: auto;
      padding: 2px 8px;
      border-radius: var(--radius-1);
      color: var(--text-2);
    }
    .focus-banner .clear:hover { background: var(--border); color: var(--text-0); }

    .frame {
      flex: 1; display: grid;
      grid-template-columns: 1fr;
      gap: 12px;
      min-height: 0;
    }
    .canvas {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: var(--radius-2);
      min-height: 320px;
      position: relative;
    }
    .empty {
      position: absolute; inset: 0;
      display: grid; place-items: center;
      color: var(--text-3);
      padding: 20px;
      text-align: center;
    }
  `;P.TYPE_FILTERS=[{key:"all",label:"All"},{key:"person",label:"People"},{key:"organization",label:"Organizations"},{key:"project",label:"Projects"},{key:"product",label:"Products"},{key:"service",label:"Services"},{key:"event",label:"Events"}];U([l()],P.prototype,"_stats",2);U([l()],P.prototype,"_nodes",2);U([l()],P.prototype,"_edges",2);U([l()],P.prototype,"_focusId",2);U([l()],P.prototype,"_focusLabel",2);U([l()],P.prototype,"_focusEdgeCount",2);U([l()],P.prototype,"_searchQ",2);U([l()],P.prototype,"_searching",2);U([l()],P.prototype,"_searchResults",2);U([l()],P.prototype,"_searchOpen",2);U([l()],P.prototype,"_typeFilter",2);P=U([w("ares-knowledge-graph")],P);var zi=Object.defineProperty,Pi=Object.getOwnPropertyDescriptor,D=(e,t,r,a)=>{for(var s=a>1?void 0:a?Pi(t,r):t,i=e.length-1,o;i>=0;i--)(o=e[i])&&(s=(a?o(t,r,s):o(s))||s);return a&&s&&zi(t,r,s),s};const Oi=140;let z=class extends m{constructor(){super(...arguments),this._items=[],this._types=[],this._categories=[],this._stats={total:0,proc:0,facts:0,inferred:0,compacted:0},this._filtered=0,this._total=0,this._type="all",this._category="all",this._sort="recent",this._query="",this._includeInferred=!0,this._loading=!1,this._error=null,this._searchMode="filter"}connectedCallback(){super.connectedCallback(),this._refresh()}_params(){const e=new URLSearchParams;return e.set("type",this._type),e.set("category",this._category),e.set("sort",this._sort),e.set("includeInferred",this._includeInferred?"1":"0"),this._query.trim()&&this._searchMode==="filter"&&e.set("q",this._query.trim()),e}async _refresh(){this._loading=!0,this._error=null;try{const e=await v(`/api/memory/list?${this._params().toString()}`);if(!e.ok){this._error=`Memory list endpoint returned ${e.status}.`,this._items=[];return}const t=await e.json();this._items=t.items||[],this._types=t.types||[],this._categories=t.categories||[],this._stats=t.stats||this._stats,this._filtered=t.filtered??this._items.length,this._total=t.total??this._items.length}catch(e){this._error=e.message}finally{this._loading=!1}}async _semanticSearch(){const e=this._query.trim();if(!e)return this._searchMode="filter",this._refresh();this._loading=!0,this._error=null,this._searchMode="semantic";try{const t=await v(`/api/memory/search?q=${encodeURIComponent(e)}&limit=20`);if(!t.ok){this._error=`Memory search returned ${t.status}.`,this._items=[];return}const r=await t.json();this._items=r.items||[],this._filtered=this._items.length}catch(t){this._error=t.message}finally{this._loading=!1}}_reset(){this._type="all",this._category="all",this._sort="recent",this._query="",this._includeInferred=!0,this._searchMode="filter",this._refresh()}async _deleteEntry(e){if(confirm("Delete this memory entry?"))try{const t=await v(`/api/memory/${e}`,{method:"DELETE"});if(!t.ok){const r=await t.json().catch(()=>({}));alert(`Delete failed: ${r.error||t.status}`);return}this._items=this._items.filter(r=>r.id!==e)}catch(t){alert(`Delete failed: ${t.message}`)}}reload(){this._searchMode==="semantic"&&this._query.trim()?this._semanticSearch():this._refresh()}_truncate(e,t=Oi){if(!e)return"(no summary)";const r=e.replace(/\s+/g," ").trim();return r.length>t?r.slice(0,t-1)+"…":r}_formatDate(e){if(!e)return"";try{return new Date(e).toLocaleDateString()}catch{return""}}render(){const e=this._items;return n`
      <div class="filters">
        <select .value=${this._type} @change=${t=>{this._type=t.target.value,this._refresh()}}>
          <option value="all">All types</option>
          ${this._types.map(t=>n`<option value=${t}>${t}</option>`)}
        </select>
        <select .value=${this._category} @change=${t=>{this._category=t.target.value,this._refresh()}}>
          <option value="all">All categories</option>
          ${this._categories.map(t=>n`<option value=${t}>${t}</option>`)}
        </select>
        <select .value=${this._sort} @change=${t=>{this._sort=t.target.value,this._refresh()}}>
          <option value="recent">Recent</option>
          <option value="most-used">Most-used</option>
          <option value="highest-confidence">Highest confidence</option>
        </select>
        <input
          class="search"
          type="text"
          placeholder="Semantic search…"
          .value=${this._query}
          @input=${t=>{this._query=t.target.value}}
          @keydown=${t=>{t.key==="Enter"&&this._semanticSearch()}}
        />
        <button class="btn primary" @click=${this._semanticSearch}>Search</button>
        <button class="btn ${this._loading?"refreshing":""}" title="Reload memory from disk" @click=${()=>this.reload()}>↻ Refresh</button>
        <label class="toggle">
          <input
            type="checkbox"
            .checked=${this._includeInferred}
            @change=${t=>{this._includeInferred=t.target.checked,this._refresh()}}
          />
          +Inferred
        </label>
      </div>
      <div class="counter-row">
        <span>${this._stats.total} total</span>
        <span>·</span>
        <span>${this._stats.proc} proc</span>
        <span>·</span>
        <span>${this._stats.facts} facts</span>
        <span>·</span>
        <span>Showing ${e.length} of ${this._filtered||this._total}</span>
        <button class="reset" @click=${this._reset}>Reset</button>
      </div>
      ${this._error?n`<div class="err">${this._error}</div>`:""}
      <div class="list">
        ${this._loading?n`<div class="empty">Loading…</div>`:e.length===0?n`
          <div class="empty">No entries match.</div>
        `:e.map(t=>{const r=Math.round((t.confidence??0)*100);return n`
            <div class="row" title=${t.summary}>
              <div class="left">
                <div class="pills">
                  <span class="pill kind">${t.kind||"task"}</span>
                  ${t.category?n`<span class="pill cat">${t.category}</span>`:""}
                  ${t.inferred?n`<span class="pill inf">inferred</span>`:""}
                </div>
                <div class="title">${this._truncate(t.summary)}</div>
                <div class="meta">
                  ${this._formatDate(t.ts)}
                  · Used ${t.usedCount}
                  · ✓${t.confirmedCount}
                  · ✕${t.rejectedCount}
                  ${t.tags&&t.tags.length>0?n` · ${t.tags.slice(0,3).join(", ")}`:""}
                </div>
              </div>
              <div class="right">
                <div class="conf-bar"><div style="width:${r}%"></div></div>
                <div class="conf-pct">${r}%</div>
                <div class="row-actions">
                  <button title="Edit (not yet wired)" disabled>✎</button>
                  <button class="del" title="Delete this entry" @click=${a=>{a.stopPropagation(),this._deleteEntry(t.id)}}>🗑</button>
                </div>
              </div>
            </div>
          `})}
      </div>
    `}};z.styles=y`
    :host { display: flex; flex-direction: column; height: 100%; gap: 10px; }

    .filters {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
    }
    .filters select,
    .filters input {
      padding: 6px 10px;
      background: var(--panel);
      border: 1px solid var(--border);
      color: var(--text-0);
      border-radius: var(--radius-1);
      font-size: 12.5px;
      outline: none;
      transition: border-color var(--dur-fast) var(--ease-out);
    }
    .filters select:focus,
    .filters input:focus { border-color: var(--accent); }
    .filters .search { flex: 1; min-width: 220px; max-width: 360px; }
    .filters .btn {
      all: unset;
      cursor: pointer;
      padding: 6px 12px;
      border-radius: var(--radius-1);
      background: var(--panel-2);
      border: 1px solid var(--border);
      color: var(--text-1);
      font-size: 12px;
      transition: background var(--dur-fast) var(--ease-out);
    }
    .filters .btn:hover { background: var(--border); color: var(--text-0); }
    .filters .btn.primary {
      background: color-mix(in srgb, var(--accent) 18%, transparent);
      color: var(--accent);
      border-color: color-mix(in srgb, var(--accent) 40%, transparent);
    }
    .filters .btn.refreshing { opacity: 0.6; pointer-events: none; }
    .filters .toggle {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: var(--text-2);
      cursor: pointer;
      user-select: none;
    }
    .counter-row {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 11.5px;
      color: var(--text-3);
    }
    .counter-row .reset {
      all: unset;
      cursor: pointer;
      margin-left: auto;
      padding: 3px 9px;
      border-radius: var(--radius-1);
      color: var(--text-2);
      border: 1px solid var(--border);
      background: var(--panel-2);
      font-size: 11px;
    }
    .counter-row .reset:hover { background: var(--border); color: var(--text-0); }

    .list {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: var(--radius-2);
    }
    .row {
      display: grid;
      grid-template-columns: 1fr 110px;
      gap: 12px;
      padding: 10px 14px;
      border-bottom: 1px solid var(--border);
      align-items: center;
    }
    .row:last-child { border-bottom: 0; }
    .row .left { min-width: 0; }
    .row .pills {
      display: flex;
      gap: 5px;
      flex-wrap: wrap;
      margin-bottom: 4px;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      padding: 1px 8px;
      font-size: 10px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      font-weight: 500;
      border-radius: 999px;
      background: var(--panel-2);
      color: var(--text-3);
      border: 1px solid var(--border);
    }
    .pill.kind {
      color: var(--accent);
      border-color: color-mix(in srgb, var(--accent) 36%, transparent);
      background: color-mix(in srgb, var(--accent) 14%, transparent);
    }
    .pill.cat {
      color: var(--ok);
      border-color: color-mix(in srgb, var(--ok) 32%, transparent);
      background: color-mix(in srgb, var(--ok) 10%, transparent);
    }
    .pill.inf {
      color: var(--warn);
      border-color: color-mix(in srgb, var(--warn) 32%, transparent);
    }
    .row .title {
      color: var(--text-0);
      font-size: 13px;
      font-weight: 500;
      line-height: 1.35;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .row .meta {
      margin-top: 3px;
      color: var(--text-3);
      font-size: 11px;
    }
    .right {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 4px;
    }
    .conf-bar {
      width: 100px;
      height: 4px;
      background: var(--panel-2);
      border-radius: 999px;
      overflow: hidden;
    }
    .conf-bar > div {
      height: 100%;
      background: var(--ok);
      border-radius: 999px;
      transition: width var(--dur-fast) var(--ease-out);
    }
    .conf-pct {
      font-size: 10.5px;
      color: var(--text-3);
    }
    .row-actions {
      display: flex;
      gap: 4px;
      margin-top: 2px;
    }
    .row-actions button {
      all: unset;
      cursor: pointer;
      padding: 2px 6px;
      font-size: 11px;
      color: var(--text-3);
      border-radius: var(--radius-1);
    }
    .row-actions button:hover { color: var(--text-0); background: var(--panel-2); }
    .row-actions .del:hover { color: var(--err); }

    .empty { padding: 24px; color: var(--text-3); text-align: center; font-size: 12.5px; }
    .err { color: var(--err); padding: 12px; font-size: 12.5px; }
  `;D([l()],z.prototype,"_items",2);D([l()],z.prototype,"_types",2);D([l()],z.prototype,"_categories",2);D([l()],z.prototype,"_stats",2);D([l()],z.prototype,"_filtered",2);D([l()],z.prototype,"_total",2);D([l()],z.prototype,"_type",2);D([l()],z.prototype,"_category",2);D([l()],z.prototype,"_sort",2);D([l()],z.prototype,"_query",2);D([l()],z.prototype,"_includeInferred",2);D([l()],z.prototype,"_loading",2);D([l()],z.prototype,"_error",2);D([l()],z.prototype,"_searchMode",2);z=D([w("ares-memory-inspector")],z);var Mi=Object.defineProperty,Di=Object.getOwnPropertyDescriptor,le=(e,t,r,a)=>{for(var s=a>1?void 0:a?Di(t,r):t,i=e.length-1,o;i>=0;i--)(o=e[i])&&(s=(a?o(t,r,s):o(s))||s);return a&&s&&Mi(t,r,s),s};let Q=class extends m{constructor(){super(...arguments),this._tab="graph",this._drawerEntity=null,this._labelIndex=null,this._edgeExplain=null,this._refreshing=!1,this._onKgFocus=e=>{const t=e;t.detail?.id&&(this._drawerEntity=t.detail.id,queueMicrotask(()=>{this._graphEl?.focusEntity(t.detail.id),this._labelIndex=this._graphEl?.buildLabelIndex()??null}))},this._onKgClear=()=>{this._drawerEntity=null},this._onDrawerClose=()=>{this._drawerEntity=null,this._graphEl?.clearFocus()},this._onDrawerFocus=e=>{const t=e;t.detail?.id&&this._graphEl?.focusEntity(t.detail.id)},this._onDrawerRetarget=e=>{const t=e;t.detail?.id&&(this._drawerEntity=t.detail.id,queueMicrotask(()=>{this._graphEl?.focusEntity(t.detail.id)}))},this._onKgEdgeTap=async e=>{const r=e.detail;if(!(!r?.sourceId||!r?.targetId)){this._edgeExplain={sourceLabel:r.sourceLabel,targetLabel:r.targetLabel,relation:r.relation,explanation:"",loading:!0};try{const{aresFetch:a}=await ut(async()=>{const{aresFetch:o}=await Promise.resolve().then(()=>er);return{aresFetch:o}},void 0),i=await(await a("/api/knowledge-graph/explain-edge",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sourceId:r.sourceId,targetId:r.targetId,relation:r.relation})})).json();this._edgeExplain&&(this._edgeExplain={...this._edgeExplain,explanation:i.explanation||i.error||"(no explanation)",loading:!1})}catch(a){this._edgeExplain&&(this._edgeExplain={...this._edgeExplain,explanation:`Error: ${a?.message||a}`,loading:!1})}}},this._closeEdgeExplain=()=>{this._edgeExplain=null},this._refreshActive=async()=>{if(!this._refreshing){this._refreshing=!0;try{if(this._tab==="graph"){const{aresFetch:e}=await ut(async()=>{const{aresFetch:t}=await Promise.resolve().then(()=>er);return{aresFetch:t}},void 0);try{await e("/api/knowledge-graph/refresh",{method:"POST"})}catch{}await this._graphEl?.reload()}else this._memoryEl?.reload()}finally{this._refreshing=!1}}}}render(){return n`
      <div class="tabs">
        <div class="tab ${this._tab==="graph"?"active":""}" @click=${()=>{this._tab="graph"}}>Knowledge graph</div>
        <div class="tab ${this._tab==="memory"?"active":""}" @click=${()=>{this._tab="memory"}}>Memory</div>
        <button class="ctx-refresh ${this._refreshing?"spinning":""}" title="Refresh ${this._tab==="graph"?"knowledge graph":"memory"}" @click=${this._refreshActive}>↻ Refresh</button>
      </div>
      <div class="body">
        ${this._tab==="graph"?n`
          <div class="graph-frame">
            <ares-knowledge-graph
              @ares-kg-focus=${this._onKgFocus}
              @ares-kg-clear=${this._onKgClear}
              @ares-kg-edge-tap=${this._onKgEdgeTap}
            ></ares-knowledge-graph>
            ${this._edgeExplain?n`
              <div class="edge-explain-overlay">
                <div class="edge-explain-head">
                  <span class="pill" title=${this._edgeExplain.sourceLabel}>${this._edgeExplain.sourceLabel}</span>
                  <span class="arrow">→</span>
                  <span class="relation">${this._edgeExplain.relation||"related"}</span>
                  <span class="arrow">→</span>
                  <span class="pill" title=${this._edgeExplain.targetLabel}>${this._edgeExplain.targetLabel}</span>
                  <button class="close" @click=${this._closeEdgeExplain}>×</button>
                </div>
                <div class="edge-explain-body ${this._edgeExplain.loading?"loading":""}">
                  ${this._edgeExplain.loading?"":this._edgeExplain.explanation}
                </div>
              </div>
            `:""}
          </div>
          ${this._drawerEntity?n`
            <ares-kg-entity-drawer
              .entityId=${this._drawerEntity}
              .labelIndex=${this._labelIndex}
              @close-drawer=${this._onDrawerClose}
              @focus-node=${this._onDrawerFocus}
              @retarget=${this._onDrawerRetarget}
            ></ares-kg-entity-drawer>
          `:""}
        `:n`<ares-memory-inspector></ares-memory-inspector>`}
      </div>
    `}};Q.styles=y`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      padding: var(--space-4) var(--space-5);
      overflow-y: auto;
    }
    .tabs {
      display: flex; gap: 4px;
      border-bottom: 1px solid var(--border);
      margin-bottom: var(--space-3);
      padding: var(--space-2) 0;
      flex-shrink: 0;
    }
    .tab {
      padding: 8px 14px;
      cursor: pointer;
      font-size: 13px;
      color: var(--text-3);
      border-bottom: 2px solid transparent;
      transition: color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out);
    }
    .tab:hover { color: var(--text-1); }
    .tab.active {
      color: var(--text-0);
      border-bottom-color: var(--accent);
    }
    .ctx-refresh {
      all: unset;
      margin-left: auto;
      cursor: pointer;
      padding: 5px 12px;
      font-size: 12px;
      color: var(--text-2);
      border: 1px solid var(--border);
      border-radius: var(--radius-1);
      background: var(--panel-2);
      transition: background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out);
    }
    .ctx-refresh:hover { background: var(--border); color: var(--text-0); }
    .ctx-refresh.spinning { opacity: 0.6; pointer-events: none; }
    .body { flex: 1; min-height: 0; display: flex; }
    .body .graph-frame { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; position: relative; }

    /* Q-pass-5 P1-2 — explain-connection popover. Anchors to canvas centre. */
    .edge-explain-overlay {
      position: absolute;
      left: 50%;
      top: 60px;
      transform: translateX(-50%);
      max-width: 480px;
      width: calc(100% - 48px);
      background: var(--panel);
      border: 1px solid color-mix(in srgb, var(--accent) 40%, var(--border));
      border-radius: var(--radius-3);
      padding: 14px 16px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.35);
      z-index: 50;
      font-size: 13px;
      animation: edgeExplainIn var(--dur-base) var(--ease-out) both;
    }
    @keyframes edgeExplainIn { from { opacity: 0; transform: translate(-50%, -8px); } to { opacity: 1; transform: translate(-50%, 0); } }
    @media (prefers-reduced-motion: reduce) { .edge-explain-overlay { animation: none; } }
    .edge-explain-head {
      display: flex; align-items: center; gap: 10px;
      font-size: 12px; color: var(--text-3); margin-bottom: 8px;
    }
    .edge-explain-head .pill {
      background: var(--panel-2); border: 1px solid var(--border);
      padding: 2px 8px; border-radius: 999px; color: var(--text-1);
      font-weight: 500; max-width: 140px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .edge-explain-head .arrow { color: var(--accent); }
    .edge-explain-head .relation { color: var(--accent); font-style: italic; }
    .edge-explain-head .close {
      all: unset; cursor: pointer; margin-left: auto;
      color: var(--text-3); padding: 0 4px;
    }
    .edge-explain-head .close:hover { color: var(--err); }
    .edge-explain-body {
      color: var(--text-1); line-height: 1.55;
      min-height: 40px;
    }
    .edge-explain-body.loading::before {
      content: "…";
      animation: dots 1.2s ease-in-out infinite;
    }
    @keyframes dots { 0%,100% { opacity: 0.4; } 50% { opacity: 1; } }`;le([l()],Q.prototype,"_tab",2);le([l()],Q.prototype,"_drawerEntity",2);le([l()],Q.prototype,"_labelIndex",2);le([l()],Q.prototype,"_edgeExplain",2);le([Ht("ares-knowledge-graph")],Q.prototype,"_graphEl",2);le([Ht("ares-memory-inspector")],Q.prototype,"_memoryEl",2);le([l()],Q.prototype,"_refreshing",2);Q=le([w("ares-my-context-pane")],Q);var Ri=Object.defineProperty,Li=Object.getOwnPropertyDescriptor,ce=(e,t,r,a)=>{for(var s=a>1?void 0:a?Li(t,r):t,i=e.length-1,o;i>=0;i--)(o=e[i])&&(s=(a?o(t,r,s):o(s))||s);return a&&s&&Ri(t,r,s),s};function ji(e){return!e||e<=0?"0 B":e<1024?`${e} B`:e<1024*1024?`${(e/1024).toFixed(1)} KB`:e<1024*1024*1024?`${(e/1024/1024).toFixed(1)} MB`:`${(e/1024/1024/1024).toFixed(2)} GB`}function Ir(e){if(!e)return"—";const t=Date.now()-e;return t<6e4?"just now":t<36e5?`${Math.floor(t/6e4)}m ago`:t<24*36e5?`${Math.floor(t/36e5)}h ago`:t<7*24*36e5?`${Math.floor(t/(24*36e5))}d ago`:new Date(e).toLocaleString("en-US",{month:"short",day:"numeric"})}let V=class extends m{constructor(){super(...arguments),this._items=[],this._query="",this._sortKey="created",this._sortDir="desc",this._view="list",this._loading=!0,this._error=null}connectedCallback(){super.connectedCallback(),this._reload()}async _reload(){this._loading=!0,this._error=null;try{const e=await _("/api/artifacts");this._items=Array.isArray(e?.items)?e.items:[]}catch(e){this._error=e.message,this._items=[]}finally{this._loading=!1}}_processed(){const e=this._query.trim().toLowerCase();let t=this._items;e&&(t=t.filter(s=>s.name.toLowerCase().includes(e)||(s.sessionTitle||"").toLowerCase().includes(e)));const r=this._sortDir==="asc"?1:-1,a=this._sortKey;return t=[...t].sort((s,i)=>{const o=a==="name"?s.name.toLowerCase():a==="format"?s.format.toLowerCase():a==="session"?(s.sessionTitle||"").toLowerCase():s.createdAt,d=a==="name"?i.name.toLowerCase():a==="format"?i.format.toLowerCase():a==="session"?(i.sessionTitle||"").toLowerCase():i.createdAt;return o<d?-1*r:o>d?1*r:0}),t}_toggleSort(e){this._sortKey===e?this._sortDir=this._sortDir==="asc"?"desc":"asc":(this._sortKey=e,this._sortDir=e==="created"?"desc":"asc")}_openArtifact(e){try{sessionStorage.setItem("ares.open-artifact",JSON.stringify({artifactId:e.id,sessionId:e.sessionId,name:e.name}))}catch{}this.dispatchEvent(new CustomEvent("session-selected",{detail:{id:e.sessionId},bubbles:!0,composed:!0})),I({top:"chat",sub:null})}_openSession(e,t){e.stopPropagation(),this.dispatchEvent(new CustomEvent("session-selected",{detail:{id:t.sessionId},bubbles:!0,composed:!0})),I({top:"chat",sub:null})}render(){return n`
      <div class="head">
        <div class="icon-tile" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="20" x2="12" y2="10"></line>
            <line x1="18" y1="20" x2="18" y2="4"></line>
            <line x1="6" y1="20" x2="6" y2="14"></line>
          </svg>
        </div>
        <div>
          <h1>My stuff</h1>
          <div class="subtitle">
            Whether it's drafting content, digging through data, or getting
            through your day — focus on what actually matters.
          </div>
        </div>
      </div>
      <input
        class="search"
        type="text"
        placeholder="Find artifacts or folders"
        .value=${this._query}
        @input=${e=>{this._query=e.target.value}}
      />
      <div class="section-bar">
        <div class="section-title">Artifact library</div>
        <div class="view-toggle" role="group" aria-label="View toggle">
          <button class=${this._view==="list"?"active":""} @click=${()=>{this._view="list"}} title="List view">List</button>
          <button class=${this._view==="grid"?"active":""} @click=${()=>{this._view="grid"}} title="Grid view">Grid</button>
        </div>
      </div>
      ${this._error?n`<div class="err">Couldn't load artifacts: ${this._error}</div>`:""}
      ${this._loading?n`<div class="empty">Loading…</div>`:this._processed().length===0?n`<div class="empty">No artifacts yet — uploads + assistant outputs land here.</div>`:this._view==="list"?this._renderList():this._renderGrid()}
    `}_sortArrow(e){return this._sortKey!==e?"":n`<span class="arrow ${this._sortDir}"></span>`}_glyphClass(e){return e.format==="kpi"?"file-glyph kpi":["png","jpg","jpeg","gif","webp","svg"].includes(e.format)?"file-glyph image":["md","txt","json","csv"].includes(e.format)?"file-glyph text":"file-glyph"}_glyphLabel(e){return e.format.slice(0,3).toUpperCase()}_typeLabel(e){return`${e.format||"file"} · ${ji(e.sizeBytes)}`}_renderList(){const e=this._processed();return n`
      <table>
        <thead>
          <tr>
            <th @click=${()=>this._toggleSort("name")}>Name${this._sortArrow("name")}</th>
            <th @click=${()=>this._toggleSort("format")}>Type${this._sortArrow("format")}</th>
            <th @click=${()=>this._toggleSort("session")}>Conversation${this._sortArrow("session")}</th>
            <th @click=${()=>this._toggleSort("created")}>Created${this._sortArrow("created")}</th>
          </tr>
        </thead>
        <tbody>
          ${e.map(t=>n`
            <tr @click=${()=>this._openArtifact(t)}>
              <td>
                <div class="name-cell">
                  <span class=${this._glyphClass(t)}>${this._glyphLabel(t)}</span>
                  <span class="name-text" title=${t.name}>${t.name}</span>
                </div>
              </td>
              <td class="type-cell">${this._typeLabel(t)}</td>
              <td>
                <a class="session-link" href="#/chat" @click=${r=>this._openSession(r,t)} title=${t.sessionTitle}>${t.sessionTitle||"(untitled)"}</a>
              </td>
              <td class="created-cell" title=${new Date(t.createdAt).toLocaleString()}>${Ir(t.createdAt)}</td>
            </tr>
          `)}
        </tbody>
      </table>
    `}_renderGrid(){const e=this._processed();return n`
      <div class="grid">
        ${e.map(t=>n`
          <div class="card" @click=${()=>this._openArtifact(t)}>
            <div class="name" title=${t.name}>${t.name}</div>
            <div class="meta">${this._typeLabel(t)}</div>
            <div class="meta">${t.sessionTitle||"(untitled)"} · ${Ir(t.createdAt)}</div>
          </div>
        `)}
      </div>
    `}};V.styles=y`
    :host {
      display: block;
      max-width: 980px;
      margin: 0 auto;
    }
    .head {
      display: flex;
      align-items: flex-start;
      gap: var(--space-3);
      margin-bottom: var(--space-2);
    }
    .icon-tile {
      width: 32px;
      height: 32px;
      border-radius: var(--radius-2);
      display: grid;
      place-items: center;
      background: color-mix(in srgb, var(--accent) 20%, transparent);
      color: var(--accent);
      flex-shrink: 0;
    }
    h1 {
      margin: 0;
      font-size: 22px;
      font-weight: 600;
      color: var(--text-0);
    }
    .subtitle {
      color: var(--text-2);
      font-size: 13px;
      max-width: 720px;
      margin: 4px 0 var(--space-5);
      line-height: 1.5;
    }
    .search {
      width: 100%;
      box-sizing: border-box;
      padding: 12px 18px;
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 999px;
      color: var(--text-0);
      font-size: 13.5px;
      outline: none;
      margin-bottom: var(--space-5);
      transition: border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out);
    }
    .search::placeholder { color: var(--text-3); }
    .search:focus {
      border-color: color-mix(in srgb, var(--accent) 60%, var(--border));
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 15%, transparent);
    }

    .section-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--space-3);
    }
    .section-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-0);
    }
    .view-toggle {
      display: inline-flex;
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: var(--radius-2);
      overflow: hidden;
    }
    .view-toggle button {
      all: unset;
      cursor: pointer;
      padding: 5px 12px;
      font-size: 11.5px;
      color: var(--text-2);
      transition: background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out);
    }
    .view-toggle button:hover { background: var(--panel-2); color: var(--text-1); }
    .view-toggle button.active {
      background: color-mix(in srgb, var(--accent) 22%, transparent);
      color: var(--text-0);
    }

    /* table view */
    table {
      width: 100%;
      border-collapse: collapse;
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: var(--radius-3);
      overflow: hidden;
    }
    thead th {
      text-align: left;
      padding: 10px 14px;
      color: var(--text-3);
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      border-bottom: 1px solid var(--border);
      cursor: pointer;
      user-select: none;
      transition: color var(--dur-fast) var(--ease-out);
    }
    thead th:hover { color: var(--text-1); }
    thead th .arrow {
      display: inline-block;
      width: 0; height: 0;
      margin-left: 4px;
      border-left: 4px solid transparent;
      border-right: 4px solid transparent;
      vertical-align: middle;
    }
    thead th .arrow.asc  { border-bottom: 5px solid var(--text-1); }
    thead th .arrow.desc { border-top:    5px solid var(--text-1); }
    tbody tr {
      cursor: pointer;
      transition: background var(--dur-fast) var(--ease-out);
    }
    tbody tr:hover { background: var(--panel-2); }
    tbody td {
      padding: 11px 14px;
      border-bottom: 1px solid var(--border);
      color: var(--text-1);
      font-size: 13px;
      vertical-align: middle;
    }
    tbody tr:last-child td { border-bottom: 0; }
    .name-cell {
      display: flex;
      align-items: center;
      gap: 8px;
      max-width: 320px;
    }
    .name-cell .name-text {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .file-glyph {
      width: 22px;
      height: 22px;
      border-radius: var(--radius-1);
      background: var(--panel-2);
      color: var(--text-2);
      display: grid;
      place-items: center;
      font-size: 10px;
      flex-shrink: 0;
    }
    .file-glyph.image { color: var(--info); }
    .file-glyph.text  { color: var(--ok); }
    .file-glyph.kpi   { color: var(--accent); }
    .type-cell { color: var(--text-3); font-size: 12px; }
    .session-link {
      color: var(--text-1);
      text-decoration: none;
      border-bottom: 1px dashed var(--border-2);
    }
    .session-link:hover { color: var(--accent); border-bottom-color: var(--accent); }
    .created-cell { color: var(--text-3); font-size: 12px; white-space: nowrap; }

    /* grid view */
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: var(--space-3);
    }
    .card {
      padding: var(--space-3) var(--space-4);
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: var(--radius-3);
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 6px;
      transition: border-color var(--dur-fast) var(--ease-out), background var(--dur-fast) var(--ease-out);
    }
    .card:hover {
      border-color: color-mix(in srgb, var(--accent) 50%, var(--border));
      background: var(--panel-2);
    }
    .card .name {
      color: var(--text-0);
      font-weight: 500;
      font-size: 13.5px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .card .meta { color: var(--text-3); font-size: 11.5px; }

    .empty {
      padding: 48px 24px;
      text-align: center;
      color: var(--text-3);
      background: var(--panel);
      border: 1px dashed var(--border);
      border-radius: var(--radius-3);
    }
    .err {
      padding: 18px;
      color: var(--err);
      background: color-mix(in srgb, var(--err) 10%, transparent);
      border: 1px solid color-mix(in srgb, var(--err) 30%, transparent);
      border-radius: var(--radius-2);
    }
  `;ce([l()],V.prototype,"_items",2);ce([l()],V.prototype,"_query",2);ce([l()],V.prototype,"_sortKey",2);ce([l()],V.prototype,"_sortDir",2);ce([l()],V.prototype,"_view",2);ce([l()],V.prototype,"_loading",2);ce([l()],V.prototype,"_error",2);V=ce([w("ares-artifact-library")],V);var Fi=Object.defineProperty,Ni=Object.getOwnPropertyDescriptor,ye=(e,t,r,a)=>{for(var s=a>1?void 0:a?Ni(t,r):t,i=e.length-1,o;i>=0;i--)(o=e[i])&&(s=(a?o(t,r,s):o(s))||s);return a&&s&&Fi(t,r,s),s};const Lt=1024*1024*1024,zr=1024*1024;function je(e){return!e||e<1024?`${e??0} B`:e<zr?`${(e/1024).toFixed(1)} KiB`:e<Lt?`${(e/zr).toFixed(1)} MiB`:`${(e/Lt).toFixed(1)} GiB`}function Bi(e,t=48){if(e.length<=t)return e;const r=Math.floor(t/2)-1,a=t-r-1;return`${e.slice(0,r)}…${e.slice(-a)}`}let Z=class extends m{constructor(){super(...arguments),this._folders=[],this._disk={free:0,total:0,usedAres:0,usedFolders:0},this._config={storageLimitGiB:4,maxFileMiB:32,maxFolderMiB:128},this._busy=!1,this._flash=null,this._addPath=""}connectedCallback(){super.connectedCallback(),this._refresh()}async _refresh(){try{const[e,t,r]=await Promise.all([_("/api/indexed-folders").catch(()=>({folders:[]})),_("/api/diskspace").catch(()=>({free:0,total:0,usedAres:0,usedFolders:0})),_("/api/index-config").catch(()=>this._config)]);this._folders=Array.isArray(e.folders)?e.folders:[],this._disk=t,this._config=r}catch{}}async _addFolder(e){const t=e.trim();if(t){this._busy=!0;try{await K("/api/indexed-folders",{path:t}),this._addPath="",await this._refresh(),this._flash="Folder added."}catch(r){this._flash=`Could not add folder: ${r.message}`}finally{this._busy=!1,setTimeout(()=>{this._flash=null},2400)}}}async _pickFolder(){const e=window;if(typeof e.ares?.pickFolder=="function"){try{const r=await e.ares.pickFolder();r&&await this._addFolder(r)}catch(r){this._flash=`Folder picker unavailable: ${r.message}`,setTimeout(()=>{this._flash=null},2200)}return}this.shadowRoot?.querySelector("input.add-input")?.focus()}async _removeFolder(e){if(confirm("Remove this folder from the index?"))try{await v(`/api/indexed-folders/${encodeURIComponent(e)}`,{method:"DELETE"}),await this._refresh()}catch(t){this._flash=`Remove failed: ${t.message}`,setTimeout(()=>{this._flash=null},2200)}}async _reindex(e){try{await K(`/api/indexed-folders/${encodeURIComponent(e)}/reindex`,{}),await this._refresh(),this._flash="Queued for re-index."}catch(t){this._flash=`Re-index failed: ${t.message}`}setTimeout(()=>{this._flash=null},2200)}async _setConfig(e){const t={...this._config,...e};this._config=t;try{await K("/api/index-config",t)}catch(r){this._flash=`Save failed: ${r.message}`,setTimeout(()=>{this._flash=null},2200)}}render(){const e=this._disk.usedAres+this._disk.usedFolders,t=this._config.storageLimitGiB*Lt,r=t>0?Math.min(100,e/t*100):0,a=this._disk.total>0?Math.min(100,(this._disk.total-this._disk.free)/this._disk.total*100):0;return n`
      <div class="page">
      <h1>My computer</h1>
      <p class="lead">
        Folders you opt-in to are scanned and indexed locally so Ares can recall their contents.
        Indexing pauses automatically when the storage limit is reached.
      </p>
      <div class="section-head">Indexed folders (${this._folders.length})</div>
      <div class="folder-list">
        ${this._folders.map(s=>n`
          <div class="folder-row">
            <div class="folder-icon">📁</div>
            <div class="folder-meta">
              <div class="folder-name">${s.name}</div>
              <div class="folder-path" title=${s.path}>${Bi(s.path)}</div>
            </div>
            <span class="folder-status ${s.status}">${s.status}</span>
            <div class="actions">
              <button class="action" title="Search this folder" @click=${()=>{this._flash="Search hook coming in a follow-up phase.",setTimeout(()=>{this._flash=null},2200)}}>🔍</button>
              <button class="action" title="Quick re-index (lightning)" @click=${()=>void this._reindex(s.id)}>⚡</button>
              <button class="action" title="Sync now" @click=${()=>void this._reindex(s.id)}>↻</button>
              <button class="action danger" title="Remove" @click=${()=>void this._removeFolder(s.id)}>✕</button>
            </div>
          </div>
        `)}
        <div class="add-row" @click=${s=>{!(s.target instanceof HTMLInputElement)&&!(s.target instanceof HTMLButtonElement)&&this._pickFolder()}}>
          <span style="font-size: 14px;">＋</span>
          <input
            type="text"
            class="add-input"
            placeholder="Add folder by path (e.g. /path/to/project)…"
            .value=${this._addPath}
            ?disabled=${this._busy}
            @input=${s=>{this._addPath=s.target.value}}
            @keydown=${s=>{s.key==="Enter"&&this._addFolder(this._addPath)}}
          />
          <button ?disabled=${this._busy||!this._addPath.trim()} @click=${s=>{s.stopPropagation(),this._addFolder(this._addPath)}}>Add</button>
        </div>
      </div>
      <div class="card">
        <h3>Search indexing</h3>
        <p class="sub">Storage and ingestion size limits.</p>
        <div class="bar-row">
          <div class="bar-label">
            <span>Disk free</span>
            <span>${je(this._disk.free)} / ${je(this._disk.total)}</span>
          </div>
          <div class="bar-track"><div class="bar-fill muted" style="width: ${a}%"></div></div>
        </div>
        <div class="bar-row">
          <div class="bar-label">
            <span>Local folder and graph storage</span>
            <span>${je(e)} used · ${je(this._disk.free)} free</span>
          </div>
          <div class="bar-track"><div class="bar-fill" style="width: ${r}%"></div></div>
        </div>
        <div class="slider-row">
          <div class="slider-label">
            <div class="l">Storage limit</div>
            <div class="d">Max disk space for the knowledge database. Indexing pauses when reached. Currently using ${je(e)}.</div>
          </div>
          <div class="slider-input">
            <input type="range" min="0.5" max="32" step="0.5"
              .value=${String(this._config.storageLimitGiB)}
              @input=${s=>void this._setConfig({storageLimitGiB:Number(s.target.value)})}
            />
            <div class="v">${this._config.storageLimitGiB.toFixed(1)} GiB</div>
          </div>
        </div>
        <div class="slider-row">
          <div class="slider-label">
            <div class="l">Max file size for indexing</div>
            <div class="d">Files larger than this are skipped — keeps the index lean.</div>
          </div>
          <div class="slider-input">
            <input type="range" min="1" max="256" step="1"
              .value=${String(this._config.maxFileMiB)}
              @input=${s=>void this._setConfig({maxFileMiB:Number(s.target.value)})}
            />
            <div class="v">${this._config.maxFileMiB} MiB</div>
          </div>
        </div>
        <div class="slider-row">
          <div class="slider-label">
            <div class="l">Max folder size for indexing</div>
            <div class="d">A folder larger than this won't be queued for ingestion.</div>
          </div>
          <div class="slider-input">
            <input type="range" min="32" max="2048" step="32"
              .value=${String(this._config.maxFolderMiB)}
              @input=${s=>void this._setConfig({maxFolderMiB:Number(s.target.value)})}
            />
            <div class="v">${this._config.maxFolderMiB} MiB</div>
          </div>
        </div>
      </div>
      </div>
      ${this._flash?n`<div class="flash">${this._flash}</div>`:""}
    `}};Z.styles=y`
    :host {
      /* P1-5 — the parent main-pane sets this route to
       * padding:0; overflow:hidden; display:flex; flex-direction:column
       * and expects this component to own its own scroll + spacing.
       * Previously :host was display:block; max-width:880px with NO
       * padding, NO centering, and NO overflow — so the panel sat
       * flush-left, got clipped by the overflow:hidden parent, and
       * couldn't scroll. Now: a scrolling flex column, padded, with the
       * 880px content column centred via margin:0 auto on an inner wrap. */
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding: var(--space-5) var(--space-6);
      box-sizing: border-box;
    }
    .page {
      width: 100%;
      max-width: 880px;
      margin: 0 auto;
    }
    h1 { margin: 0 0 4px 0; font-size: 22px; font-weight: 600; color: var(--text-0); }
    .lead { margin: 0 0 22px 0; color: var(--text-3); font-size: 13px; max-width: 640px; }
    .section-head {
      font-size: 11px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--text-3);
      margin: 22px 0 10px 0;
    }
    .folder-list { display: flex; flex-direction: column; gap: 8px; }
    .folder-row {
      display: flex; align-items: center; gap: 12px;
      padding: 11px 14px;
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: var(--radius-2);
    }
    .folder-icon {
      width: 28px; height: 28px;
      flex-shrink: 0;
      border-radius: var(--radius-1);
      background: color-mix(in srgb, var(--accent) 14%, var(--panel-2));
      color: var(--accent-soft);
      display: flex; align-items: center; justify-content: center;
      font-size: 14px;
    }
    .folder-meta { flex: 1; min-width: 0; }
    .folder-name { color: var(--text-0); font-size: 13px; font-weight: 500; }
    .folder-path { color: var(--text-3); font-size: 11.5px; margin-top: 2px;
      font-family: var(--font-mono);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .folder-status { font-size: 11px; padding: 2px 8px; border-radius: 999px;
      min-width: 64px; text-align: center; text-transform: capitalize; flex-shrink: 0;
    }
    .folder-status.indexed { background: color-mix(in srgb, var(--ok) 22%, transparent); color: var(--ok); }
    .folder-status.indexing { background: color-mix(in srgb, var(--warn) 22%, transparent); color: var(--warn); }
    .folder-status.queued { background: var(--panel-2); color: var(--text-3); }
    .folder-status.error { background: color-mix(in srgb, var(--err) 22%, transparent); color: var(--err); }
    .actions { display: flex; gap: 4px; }
    .action {
      all: unset; cursor: pointer;
      width: 26px; height: 26px;
      display: flex; align-items: center; justify-content: center;
      border-radius: var(--radius-1);
      color: var(--text-3);
      font-size: 14px;
    }
    .action:hover { background: var(--panel-2); color: var(--text-0); }
    .action.danger:hover { color: var(--err); }
    .add-row {
      display: flex; gap: 8px; align-items: center;
      padding: 12px 14px;
      border: 1px dashed var(--border-2);
      border-radius: var(--radius-2);
      color: var(--text-3);
      cursor: pointer;
      transition: color var(--dur-fast), border-color var(--dur-fast);
    }
    .add-row:hover { color: var(--text-0); border-color: var(--accent); }
    .add-row input {
      flex: 1;
      background: transparent;
      border: 0;
      color: var(--text-1);
      font-family: var(--font-mono);
      font-size: 12px;
      outline: none;
    }
    .add-row button {
      all: unset; cursor: pointer;
      padding: 4px 10px;
      border-radius: var(--radius-1);
      background: var(--accent);
      color: #fff;
      font-size: 11.5px;
    }
    .add-row button[disabled] { opacity: 0.5; cursor: default; }
    /* Card */
    .card {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: var(--radius-3);
      padding: 18px 22px;
      margin-top: 22px;
    }
    .card h3 { margin: 0 0 6px 0; font-size: 14px; color: var(--text-0); font-weight: 600; }
    .card p.sub { margin: 0 0 18px 0; color: var(--text-3); font-size: 12px; }
    .bar-row { margin-bottom: 14px; }
    .bar-label {
      display: flex; justify-content: space-between;
      font-size: 11.5px; color: var(--text-2);
      margin-bottom: 6px;
    }
    .bar-track {
      width: 100%;
      height: 8px;
      background: var(--panel-2);
      border-radius: 999px;
      overflow: hidden;
    }
    .bar-fill {
      height: 100%;
      background: var(--accent);
      border-radius: 999px;
      transition: width var(--dur-base) var(--ease-out);
    }
    .bar-fill.muted { background: color-mix(in srgb, var(--accent) 60%, var(--text-3)); }
    .slider-row {
      display: grid; grid-template-columns: 1fr 220px;
      gap: 18px;
      align-items: start;
      padding: 14px 0;
      border-top: 1px solid var(--border);
    }
    .slider-label .l { color: var(--text-0); font-size: 13px; font-weight: 500; }
    .slider-label .d { color: var(--text-3); font-size: 11.5px; margin-top: 3px; line-height: 1.4; }
    .slider-input { display: flex; flex-direction: column; gap: 4px; }
    .slider-input input[type="range"] {
      width: 100%;
      accent-color: var(--accent);
    }
    .slider-input .v {
      text-align: right;
      color: var(--text-1);
      font-size: 12.5px;
      font-family: var(--font-mono);
    }
    .flash {
      position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%);
      background: var(--panel); border: 1px solid var(--border); color: var(--text-0);
      padding: 8px 14px; border-radius: var(--radius-2); font-size: 12.5px;
      z-index: 200;
    }
  `;ye([l()],Z.prototype,"_folders",2);ye([l()],Z.prototype,"_disk",2);ye([l()],Z.prototype,"_config",2);ye([l()],Z.prototype,"_busy",2);ye([l()],Z.prototype,"_flash",2);ye([l()],Z.prototype,"_addPath",2);Z=ye([w("ares-my-computer")],Z);var Ui=Object.defineProperty,qi=Object.getOwnPropertyDescriptor,Jt=(e,t,r,a)=>{for(var s=a>1?void 0:a?qi(t,r):t,i=e.length-1,o;i>=0;i--)(o=e[i])&&(s=(a?o(t,r,s):o(s))||s);return a&&s&&Ui(t,r,s),s};const Hi={capabilities:{title:"Capabilities",phase:"Q6+",body:"Connections (Q6) · Skills (Q7) · Scheduled tasks (Q8) · MCP permissions (Q9) · System (Q10)."},"my-computer":{title:"My computer",phase:"Q17",body:"Local folder index + storage cap controls."},"my-context":{title:"My context",phase:"Q13–Q14",body:"Knowledge graph (Q13) + Memory inspector (Q14)."},customization:{title:"Customization",phase:"Q17",body:"Appearance, notifications, voice, troubleshooting."},jobs:{title:"Scheduled tasks",phase:"Q8",body:"The current jobs.html surface restyled as Lit cards + calendar view."}},Ki={connections:"Q6 — 45+ MCPs with sign-in / enable / per-tool inspection.",skills:"Q7 — built-in + user skills, with per-skill tools and Run.","scheduled-tasks":"Q8 — restyled jobs.html with Test run-once and a calendar view.",mcp:"Q9 — server → tool → operation tree with Always allow / Ask each time / Deny.",system:"Q10 — 10 capability switches (Web Search, Browser Automation, Image Gen, …).",bugs:"Self-healing debug bot — sweeps logs, backend, tests, frontend, UI/UX, architecture every 5 min."};let Ye=class extends m{constructor(){super(...arguments),this.selectedSessionId=null}willUpdate(e){if(e.has("currentRoute")){const t=this.currentRoute;t&&this.setAttribute("data-route",t.top)}}render(){const e=this.currentRoute;return e.top==="chat"?this._renderChat():e.top==="activity-feed"?this._renderRouted("✨","Activity feed","Predictive cards from Slack, Outlook, jobs, and your knowledge graph.",n`<ares-activity-feed></ares-activity-feed>`):e.top==="my-stuff"?n`<ares-artifact-library></ares-artifact-library>`:e.top==="my-computer"?n`<ares-my-computer></ares-my-computer>`:e.top==="my-context"?this._renderMyContext():e.top==="customization"?this._renderCustomization():e.top==="capabilities"?this._renderCapabilities():this._renderPlaceholder()}_renderRouted(e,t,r,a){return n`
      <div class="route-header">
        <div class="icon-square">${e}</div>
        <div class="text">
          <h1>${t}</h1>
          <div class="sub">${r}</div>
        </div>
      </div>
      ${a}
    `}_renderMyContext(){return n`
      <div class="route-header">
        <div class="icon-square">✦</div>
        <div class="text">
          <h1>My context</h1>
          <div class="sub">Your knowledge graph, memories, and personal context.</div>
        </div>
        <div class="actions">
          <a class="btn-settings" href="/q/#/customization">Settings</a>
        </div>
      </div>
      <ares-my-context-pane></ares-my-context-pane>
    `}_renderChat(){return n`
      <ares-chat-surface
        .sessionId=${this.selectedSessionId}
        @session-created=${e=>{this.dispatchEvent(new CustomEvent("session-created",{detail:e.detail,bubbles:!0,composed:!0}))}}
        @recovery-applied=${e=>{this.dispatchEvent(new CustomEvent("recovery-applied",{detail:e.detail,bubbles:!0,composed:!0}))}}
      ></ares-chat-surface>
    `}_renderPlaceholder(){const e=Hi[this.currentRoute.top];return e?n`
      <h1>${e.title} <span class="pill">${e.phase}</span></h1>
      <p class="lead">Coming online in phase ${e.phase}. Existing data + APIs already there.</p>
      <div class="placeholder-card">
        <div class="title">${e.title} preview</div>
        <div class="body">${e.body}</div>
      </div>
    `:n`<h1>Unknown route</h1>`}_renderCustomization(){return n`
      <h1>Customization</h1>
      <ares-settings-shell></ares-settings-shell>
    `}_renderCapabilities(){const e=this.currentRoute.sub??"connections";return n`
      <h1>Capabilities</h1>
      <div class="tabs">
        ${["connections","skills","scheduled-tasks","mcp","system","bugs"].map(r=>n`
          <div
            class="tab ${e===r?"active":""}"
            @click=${()=>this._goTab(r)}
          >${this._tabLabel(r)}</div>
        `)}
      </div>
      ${this._renderCapBody(e)}
    `}_renderCapBody(e){switch(e){case"connections":return n`<ares-connections></ares-connections>`;case"skills":return n`<ares-skills></ares-skills>`;case"scheduled-tasks":return n`<ares-scheduled-tasks></ares-scheduled-tasks>`;case"mcp":return n`<ares-mcp-permissions></ares-mcp-permissions>`;case"system":return n`<ares-system-switches></ares-system-switches>`;case"bugs":return n`<ares-bugs-fixed></ares-bugs-fixed>`;default:return n`<div class="placeholder-card"><div class="body">${Ki[e]??""}</div></div>`}}_tabLabel(e){return{connections:"Connections",skills:"Skills","scheduled-tasks":"Scheduled tasks",mcp:"MCP",system:"System",bugs:"Bugs Fixed"}[e]??e}_goTab(e){I({top:"capabilities",sub:e})}};Ye.styles=y`
    :host {
      display: block;
      height: 100%;
      overflow-y: auto;
      padding: var(--space-5) var(--space-6);
      background: var(--bg);
      color: var(--text-1);
    }
    :host([data-route="chat"]) {
      padding: 0;
      overflow: hidden;
      /* Definite height context so ares-chat-surface's height:100%
       * resolves and the flex column layout works (turns scroll,
       * composer pinned at bottom). */
      display: flex;
      flex-direction: column;
    }
    /* Full-height routes that own their own scroll. */
    :host([data-route="my-context"]),
    :host([data-route="activity-feed"]),
    :host([data-route="my-computer"]),
    :host([data-route="my-stuff"]) {
      padding: 0;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    ares-chat-surface { flex: 1; min-height: 0; display: flex; }
    ares-my-context-pane,
    ares-activity-feed,
    ares-my-computer,
    ares-artifact-library {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
    }
    .route-header { flex-shrink: 0; }
    .route-header {
      padding: var(--space-5) var(--space-6) var(--space-3) var(--space-6);
      display: flex;
      align-items: flex-start;
      gap: var(--space-3);
    }
    .route-header .icon-square {
      width: 32px; height: 32px;
      border-radius: var(--radius-2);
      background: color-mix(in srgb, var(--accent) 16%, transparent);
      color: var(--accent);
      display: grid; place-items: center;
      font-size: 18px;
      flex-shrink: 0;
    }
    .route-header .text { flex: 1; min-width: 0; }
    .route-header h1 { margin: 0; font-size: 22px; font-weight: 600; color: var(--text-0); }
    .route-header .sub { color: var(--text-3); font-size: 13px; margin-top: 2px; }
    .route-header .actions { margin-left: auto; display: flex; align-items: center; gap: var(--space-2); flex-shrink: 0; }
    .route-header .btn-settings {
      all: unset;
      cursor: pointer;
      padding: 5px 12px;
      border-radius: var(--radius-1);
      background: var(--panel-2);
      border: 1px solid var(--border);
      color: var(--text-2);
      font-size: 12px;
      transition: background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out);
    }
    .route-header .btn-settings:hover { background: var(--border); color: var(--text-0); }
    h1 {
      margin: 0 0 var(--space-2) 0;
      font-size: 22px;
      font-weight: 600;
      color: var(--text-0);
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }
    .pill {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 999px;
      background: var(--panel);
      color: var(--text-2);
      font-size: 11px;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      border: 1px solid var(--border);
      font-weight: 400;
    }
    .lead {
      margin: 0 0 var(--space-5) 0;
      color: var(--text-3);
      max-width: 720px;
      font-size: 13.5px;
    }
    .placeholder-card {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: var(--radius-3);
      padding: var(--space-4) var(--space-5);
      margin-top: var(--space-4);
      max-width: 720px;
    }
    .placeholder-card .title {
      color: var(--text-0);
      font-weight: 600;
      margin-bottom: var(--space-2);
    }
    .placeholder-card .body {
      color: var(--text-2);
      font-size: 13px;
    }
    /* capabilities tab strip */
    .tabs {
      display: flex;
      gap: var(--space-2);
      border-bottom: 1px solid var(--border);
      margin-bottom: var(--space-4);
      max-width: 720px;
    }
    .tab {
      padding: 8px 14px;
      border-bottom: 2px solid transparent;
      cursor: pointer;
      color: var(--text-3);
      font-size: 13px;
      transition: color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out);
    }
    .tab:hover { color: var(--text-1); }
    .tab.active {
      color: var(--text-0);
      border-bottom-color: var(--accent);
    }
  `;Jt([E({type:Object})],Ye.prototype,"currentRoute",2);Jt([E({type:String})],Ye.prototype,"selectedSessionId",2);Ye=Jt([w("ares-main-pane")],Ye);var Qi=Object.defineProperty,Vi=Object.getOwnPropertyDescriptor,de=(e,t,r,a)=>{for(var s=a>1?void 0:a?Vi(t,r):t,i=e.length-1,o;i>=0;i--)(o=e[i])&&(s=(a?o(t,r,s):o(s))||s);return a&&s&&Qi(t,r,s),s};const Pr="ares.mode";function Wi(e){return e?/opus-4-8/.test(e)?"Opus 4.8":/opus-4-7/.test(e)?"Opus 4.7":/opus-4-6/.test(e)?"Opus 4.6":/sonnet-4-6/.test(e)?"Sonnet 4.6":/sonnet-4-5/.test(e)?"Sonnet 4.5":/haiku-4-5/.test(e)?"Haiku 4.5":e.replace(/^us\.anthropic\./,"").split(".")[0]||null:null}let W=class extends m{constructor(){super(...arguments),this.activeOverlay=null,this._unread=0,this._health=null,this._approvalsPending=0,this._streaming={active:!1,iter:0,elapsedSec:0,model:null},this._popover=null,this._appMode=(()=>{try{return localStorage.getItem(Pr)==="dev"?"dev":"work"}catch{return"work"}})(),this._unsub=null,this._unsubHealth=null,this._approvalsPoll=null,this._onStreaming=e=>{const t=e.detail;if(t)if(t.state==="model"){const r=Wi(t.model||null);this._streaming={...this._streaming,active:!0,model:r}}else t.state==="started"||t.state==="heartbeat"?this._streaming={active:!0,iter:t.iter??0,elapsedSec:t.elapsedSec??0,model:this._streaming.model}:t.state==="ended"&&(this._streaming={active:!1,iter:0,elapsedSec:0,model:null})},this._onDocClick=e=>{if(!this._popover)return;(e.composedPath?.()??[]).includes(this)||(this._popover=null)}}connectedCallback(){super.connectedCallback(),this._unsub=es(e=>{this._unread=e}),this._unsubHealth=Qt(e=>{this._health=e}),document.addEventListener("chat-streaming",this._onStreaming),document.addEventListener("click",this._onDocClick,!0),this._refreshApprovals(),this._approvalsPoll=setInterval(()=>{this._refreshApprovals()},1e3),this.setAttribute("data-status-chips","1")}disconnectedCallback(){super.disconnectedCallback(),this._unsub?.(),this._unsub=null,this._unsubHealth?.(),this._unsubHealth=null,document.removeEventListener("chat-streaming",this._onStreaming),document.removeEventListener("click",this._onDocClick,!0),this._approvalsPoll&&(clearInterval(this._approvalsPoll),this._approvalsPoll=null)}async _refreshApprovals(){try{const e=await v("/api/approvals/pending");if(!e.ok)return;const t=await e.json();this._approvalsPending=typeof t.count=="number"?t.count:0}catch{}}_doctorStatus(){const e=this._health;if(!e)return"warn";const t=e.servers;return t?t.running===0&&t.total>0?"err":t.running<t.total?"warn":"ok":"warn"}_scrollToFirstApproval(){const t=document.querySelector("ares-chat-surface")?.shadowRoot;if(!t)return;const r=t.querySelector(".approval-card");if(r){r.scrollIntoView({behavior:"smooth",block:"center"});const a=r.style.outline;r.style.outline="2px solid var(--accent)",setTimeout(()=>{r.style.outline=a},1500)}}_scrollToCurrentStreaming(){const t=document.querySelector("ares-chat-surface")?.shadowRoot;if(!t)return;const r=t.querySelectorAll(".turn.assistant");r[r.length-1]?.scrollIntoView({behavior:"smooth",block:"center"})}_toggleAppMode(){const e=this._appMode==="dev"?"work":"dev";this._appMode=e;try{localStorage.setItem(Pr,e)}catch{}document.dispatchEvent(new CustomEvent("ares-mode-change",{detail:{mode:e}}))}_toggle(e){const t=this.activeOverlay===e?null:e;this.dispatchEvent(new CustomEvent("overlay-change",{detail:{id:t},bubbles:!0,composed:!0}))}render(){const e=this._doctorStatus(),t=this._health?.sandbox?.active??"local",r=t&&t!=="local",a=this._approvalsPending,s=a>0,i=this._streaming.active;return n`
      <button
        class="mode-pill ${this._appMode==="dev"?"dev":""}"
        title=${this._appMode==="dev"?"Dev mode (click to switch to Work)":"Work mode (click to switch to Dev)"}
        @click=${()=>this._toggleAppMode()}
      >
        <span class="mode-dot"></span>
        ${this._appMode==="dev"?"Dev":"Work"}
      </button>

      <div class="chips" data-status-chips="1">
        ${i?n`
          <div class="pop-wrap">
            <button
              class="chip streaming"
              title=${`${this._streaming.model?this._streaming.model+" · ":""}Streaming · iter ${this._streaming.iter} · ${this._streaming.elapsedSec}s — click to scroll to message`}
              @click=${()=>this._scrollToCurrentStreaming()}
            >
              <span class="dot"></span>
              ${this._streaming.model?`${this._streaming.model} · `:""}Streaming · iter ${this._streaming.iter} · ${this._streaming.elapsedSec}s
            </button>
          </div>
        `:S}

        <div class="pop-wrap">
          <button
            class="chip"
            data-status=${e}
            title="Doctor health"
            @click=${o=>{o.stopPropagation(),this._popover=this._popover==="doctor"?null:"doctor"}}
          >
            <span class="dot"></span>
            Doctor
          </button>
          ${this._popover==="doctor"?n`
            <div class="pop">
              <div class="pop-title">Doctor</div>
              <div class="pop-row">${this._health?.servers?`${this._health.servers.running}/${this._health.servers.total} MCPs running`:"No health snapshot yet"}</div>
              <div class="pop-row">${this._health?.activeTools??0} active tools</div>
              <span class="pop-link" @click=${()=>{this._popover=null,I({top:"my-computer",sub:"doctor"})}}>Open /doctor →</span>
            </div>
          `:S}
        </div>

        ${r?n`
          <div class="pop-wrap">
            <button
              class="chip"
              title="Sandbox backend"
              @click=${o=>{o.stopPropagation(),this._popover=this._popover==="sandbox"?null:"sandbox"}}
            >
              <span class="dot"></span>
              Sandbox: ${t}
            </button>
            ${this._popover==="sandbox"?n`
              <div class="pop">
                <div class="pop-title">Sandbox</div>
                <div class="pop-row">Active backend: <strong>${t}</strong></div>
                ${this._health?.sandbox?.description?n`<div class="pop-row">${this._health.sandbox.description}</div>`:S}
                <span class="pop-link" @click=${()=>{this._popover=null,I({top:"my-computer",sub:null})}}>Open My Computer →</span>
              </div>
            `:S}
          </div>
        `:S}

        ${S}

        ${s?n`
          <div class="pop-wrap">
            <button
              class="chip"
              title="Pending approvals"
              @click=${o=>{o.stopPropagation(),this._popover=this._popover==="approvals"?null:"approvals"}}
            >
              <span class="dot" style="background: var(--warn);"></span>
              ${a} pending approval${a===1?"":"s"}
            </button>
            ${this._popover==="approvals"?n`
              <div class="pop">
                <div class="pop-title">Pending approvals</div>
                <div class="pop-row">${a} tool call${a===1?"":"s"} awaiting your decision.</div>
                <span class="pop-link" @click=${()=>{this._popover=null,this._scrollToFirstApproval()}}>Jump to first →</span>
              </div>
            `:S}
          </div>
        `:S}
      </div>

      <button
        title="New chat"
        @click=${()=>{this.dispatchEvent(new CustomEvent("new-chat",{bubbles:!0,composed:!0})),I({top:"chat",sub:null})}}
      >
        <!-- Chat-bubble icon -->
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12a8 8 0 0 1-12.4 6.7L3 21l2.3-5.6A8 8 0 1 1 21 12z"/>
        </svg>
      </button>
      <button
        class=${this.activeOverlay==="feed"?"active":""}
        title="Activity feed and notifications"
        @click=${()=>this._toggle("feed")}
      >
        <!-- Pulse / waveform icon -->
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 12h3l3-9 4 18 3-9h5"/>
        </svg>
        ${this._unread>0?n`<span class="badge">${this._unread>99?"99+":this._unread}</span>`:""}
      </button>
      <button
        class=${this.activeOverlay==="scheduled"?"active":""}
        title="Scheduled tasks"
        @click=${()=>this._toggle("scheduled")}
      >
        <!-- Clipboard / checklist icon -->
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="6" y="4" width="12" height="17" rx="2"/>
          <path d="M9 4h6v3H9z"/>
          <path d="M9 12l2 2 4-4"/>
        </svg>
      </button>
      <button
        class=${this.activeOverlay==="sessions"?"active":""}
        title="Session tabs"
        @click=${()=>this._toggle("sessions")}
      >
        <!-- Folder icon -->
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        </svg>
      </button>
      <button
        class=${this.activeOverlay==="tasks"?"active":""}
        title="Tasks"
        @click=${()=>this._toggle("tasks")}
      >
        <!-- Tree / hierarchy icon -->
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="9" y="3" width="6" height="4" rx="1"/>
          <rect x="3" y="14" width="6" height="4" rx="1"/>
          <rect x="15" y="14" width="6" height="4" rx="1"/>
          <path d="M12 7v3M6 14v-2h12v2"/>
        </svg>
      </button>
      <button
        class=${this.activeOverlay==="data"?"active":""}
        title="Data and apps"
        @click=${()=>this._toggle("data")}
      >
        <!-- Database / grid icon -->
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <ellipse cx="12" cy="6" rx="8" ry="3"/>
          <path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6"/>
          <path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>
        </svg>
      </button>
    `}};W.styles=y`
    :host {
      display: flex;
      align-items: center;
      gap: 4px;
      /* Q-pass-4 polish — was 56px; that height made the floating
       * top-bar pill in app-shell spill outside its 4-px padding box.
       * 36px lines up with the chip + icon-button heights so the pill
       * stays visually compact. */
      height: 36px;
      padding: 0 6px;
    }
    /* Status chips section — LEFT of the icon buttons. */
    .chips {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-right: 6px;
    }
    .chip {
      all: unset;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      height: 24px;
      padding: 0 10px;
      border-radius: var(--radius-pill, 999px);
      border: 1px solid var(--border);
      background: transparent;
      color: var(--text-3);
      font-size: 11.5px;
      transition: background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out);
    }
    .chip:hover { background: var(--panel-2); color: var(--text-1); }
    .chip.streaming {
      color: var(--accent);
      border-color: color-mix(in srgb, var(--accent) 50%, var(--border));
      animation: ares-streaming-chip-pulse 1.6s var(--ease-in-out) infinite;
    }
    .chip .dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      flex-shrink: 0;
      background: var(--text-3);
    }
    .chip[data-status="ok"]   .dot { background: var(--ok); }
    .chip[data-status="warn"] .dot { background: var(--warn); }
    .chip[data-status="err"]  .dot { background: var(--err); }
    .chip.streaming .dot {
      background: var(--accent);
      animation: ares-pulse-dot 1.4s var(--ease-in-out) infinite;
    }

    button {
      all: unset;
      position: relative;
      cursor: pointer;
      /* 28px square fits inside the 36px host without forcing growth. */
      width: 28px; height: 28px;
      display: grid; place-items: center;
      border-radius: var(--radius-1);
      color: var(--text-2);
      font-size: 14px;
      transition: background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out);
    }
    button:hover { background: var(--panel-2); color: var(--text-0); }
    button.active { background: color-mix(in srgb, var(--accent) 18%, transparent); color: var(--text-0); }
    .badge {
      position: absolute;
      top: 4px; right: 4px;
      min-width: 14px; height: 14px;
      padding: 0 4px;
      box-sizing: border-box;
      border-radius: 999px;
      background: var(--accent);
      color: #fff;
      font-size: 9.5px;
      font-weight: 700;
      line-height: 14px;
      text-align: center;
      pointer-events: none;
    }

    /* Tiny inline popover anchored under a chip. */
    .pop-wrap { position: relative; display: inline-flex; }
    /* Mode toggle pill — Work / Dev switcher. */
    .mode-pill {
      all: unset;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      height: 22px;
      padding: 0 9px;
      border-radius: var(--radius-pill, 999px);
      border: 1px solid var(--border);
      background: transparent;
      color: var(--text-2);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      transition: background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out);
      margin-right: 8px;
    }
    .mode-pill:hover { background: var(--panel-2); color: var(--text-0); }
    .mode-pill.dev {
      color: var(--warn, #f59e0b);
      border-color: color-mix(in srgb, var(--warn, #f59e0b) 50%, var(--border));
      background: color-mix(in srgb, var(--warn, #f59e0b) 10%, transparent);
    }
    .mode-pill .mode-dot {
      width: 6px; height: 6px; border-radius: 50%;
      background: var(--text-3);
    }
    .mode-pill.dev .mode-dot { background: var(--warn, #f59e0b); }
    .pop {
      position: absolute;
      top: calc(100% + 6px);
      right: 0;
      min-width: 220px;
      background: var(--surface-elevated, var(--panel-2));
      border: 1px solid var(--border);
      border-radius: var(--radius-2);
      box-shadow: var(--shadow-md, 0 8px 24px rgba(0,0,0,0.35));
      padding: 10px 12px;
      font-size: 12px;
      color: var(--text-1);
      z-index: 50;
      animation: ares-fade-in var(--dur-fast) var(--ease-out) both;
    }
    @media (prefers-reduced-motion: reduce) {
      .chip.streaming { animation: none; }
      .pop { animation-duration: 0.01ms !important; }
    }
    .pop .pop-title { font-weight: 600; color: var(--text-0); margin-bottom: 6px; font-size: 12.5px; }
    .pop .pop-row { color: var(--text-2); margin-top: 3px; }
    .pop .pop-link {
      display: inline-block;
      margin-top: 8px;
      color: var(--accent);
      cursor: pointer;
      font-size: 12px;
    }
    .pop .pop-link:hover { color: var(--accent-soft); }
  `;de([E({attribute:!1})],W.prototype,"activeOverlay",2);de([l()],W.prototype,"_unread",2);de([l()],W.prototype,"_health",2);de([l()],W.prototype,"_approvalsPending",2);de([l()],W.prototype,"_streaming",2);de([l()],W.prototype,"_popover",2);de([l()],W.prototype,"_appMode",2);W=de([w("ares-top-toolbar")],W);var Gi=Object.defineProperty,Yi=Object.getOwnPropertyDescriptor,Xt=(e,t,r,a)=>{for(var s=a>1?void 0:a?Yi(t,r):t,i=e.length-1,o;i>=0;i--)(o=e[i])&&(s=(a?o(t,r,s):o(s))||s);return a&&s&&Gi(t,r,s),s};let Je=class extends m{constructor(){super(...arguments),this.open=!1,this.heading="",this._onKeyDown=e=>{e.key==="Escape"&&this.open&&this._close()}}connectedCallback(){super.connectedCallback(),document.addEventListener("keydown",this._onKeyDown)}disconnectedCallback(){super.disconnectedCallback(),document.removeEventListener("keydown",this._onKeyDown)}_close(){this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0}))}render(){return n`
      <div class="scrim" @click=${this._close}></div>
      <aside class="panel" role="dialog" aria-label=${this.heading} @click=${e=>e.stopPropagation()}>
        <header>
          <h3>${this.heading}</h3>
          <button class="close" @click=${this._close} title="Close">×</button>
        </header>
        <div class="body">
          <slot></slot>
        </div>
      </aside>
    `}};Je.styles=y`
    :host {
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 80;
    }
    .scrim {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0);
      backdrop-filter: blur(0);
      pointer-events: none;
      transition: background var(--dur-base) var(--ease-out), backdrop-filter var(--dur-base) var(--ease-out);
    }
    :host([open]) .scrim {
      pointer-events: auto;
      background: rgba(8, 6, 14, 0.42);
      backdrop-filter: blur(2px);
    }

    .panel {
      position: fixed;
      right: 0;
      top: 56px;
      bottom: 0;
      width: 420px;
      max-width: 100vw;
      background: var(--panel);
      border-left: 1px solid var(--border);
      box-shadow: var(--shadow-2, -8px 0 32px rgba(0,0,0,0.25));
      transform: translateX(100%);
      transition: transform var(--dur-base) var(--ease-out);
      pointer-events: auto;
      display: flex;
      flex-direction: column;
    }
    :host([open]) .panel { transform: translateX(0); }

    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }
    header h3 {
      margin: 0;
      font-size: 13px;
      font-weight: 600;
      color: var(--text-0);
      letter-spacing: 0.02em;
    }
    .close {
      all: unset; cursor: pointer;
      color: var(--text-3);
      padding: 4px 8px;
      border-radius: var(--radius-1);
      font-size: 16px; line-height: 1;
    }
    .close:hover { color: var(--text-0); background: var(--panel-2); }

    .body {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding: 14px 16px;
    }
  `;Xt([E({type:Boolean,reflect:!0})],Je.prototype,"open",2);Xt([E({type:String})],Je.prototype,"heading",2);Je=Xt([w("ares-quick-peek-overlay")],Je);var Ji=Object.defineProperty,Xi=Object.getOwnPropertyDescriptor,_t=(e,t,r,a)=>{for(var s=a>1?void 0:a?Xi(t,r):t,i=e.length-1,o;i>=0;i--)(o=e[i])&&(s=(a?o(t,r,s):o(s))||s);return a&&s&&Ji(t,r,s),s};const Zi={sonnet:"Sonnet",haiku:"Haiku",opus:"Opus"},eo={pending:"⏱",running:"▶",done:"✓",failed:"✕"};let ze=class extends m{constructor(){super(...arguments),this._tasks=[],this._activeSessionId=null,this._now=Date.now(),this._stream=null,this._tickTimer=null}async connectedCallback(){super.connectedCallback(),await this._loadInitial(),this._wireSse(),this._tickTimer=window.setInterval(()=>{this._now=Date.now()},1e3)}disconnectedCallback(){if(super.disconnectedCallback(),this._stream){try{this._stream.abort()}catch{}this._stream=null}this._tickTimer!=null&&(clearInterval(this._tickTimer),this._tickTimer=null)}async _loadInitial(){try{const e=await _("/api/orchestrator/state");Array.isArray(e?.tasks)&&(this._tasks=e.tasks),this._activeSessionId=e?.activeSessionId??null}catch{}}async _wireSse(){if(await Se()){this._stream=new AbortController;try{const t=await v("/api/orchestrator/stream",{signal:this._stream.signal});if(!t.ok||!t.body)return;const r=t.body.getReader(),a=new TextDecoder;let s="";for(;;){const{value:i,done:o}=await r.read();if(o)break;s+=a.decode(i,{stream:!0});const d=s.split(`

`);s=d.pop()||"";for(const c of d){const p=c.replace(/^data:\s*/,"").trim();if(!p)continue;let h;try{h=JSON.parse(p)}catch{continue}this._ingest(h)}}}catch(t){console.warn("[task-list] SSE ended:",t.message)}}}_ingest(e){if(e.type==="snapshot"&&Array.isArray(e.tasks)){this._tasks=e.tasks,this._activeSessionId=e.activeSessionId??null;return}if(e.type==="reset"){this._tasks=[],this._activeSessionId=e.activeSessionId??null;return}if(e.type==="task_added"&&e.task){const t=this._tasks.filter(r=>r.id!==e.task.id);t.push(e.task),this._tasks=t;return}if(e.type==="task_updated"&&e.task){const t=this._tasks.findIndex(r=>r.id===e.task.id);if(t>=0){const r=[...this._tasks];r[t]=e.task,this._tasks=r}return}}render(){if(this._tasks.length===0)return n`
        <div class="empty">
          No tasks yet. Tasks will appear here when the agent spawns sub-tasks.
        </div>
      `;const e=new Set(this._tasks.map(r=>r.id)),t=new Map;for(const r of this._tasks){const a=r.parentTaskId&&e.has(r.parentTaskId)?r.parentTaskId:null,s=t.get(a)||[];s.push(r),t.set(a,s)}return n`
      ${this._activeSessionId?n`
        <div class="session-eyebrow">Active session · <code>${this._activeSessionId.slice(0,8)}</code></div>
      `:""}
      ${this._renderLevel(t,null)}
    `}_renderLevel(e,t){const r=e.get(t)||[];return r.length?n`
      <ul class="tree">
        ${r.map(a=>n`
          <li class="node" data-status=${a.status}>
            <span class="icon">${eo[a.status]||"•"}</span>
            <span class="title" title=${a.title}>${a.title}</span>
            <span class="badge ${a.model}">${Zi[a.model]||a.model}</span>
            <span class="duration">${this._fmtDuration(a)}</span>
          </li>
          ${this._renderLevel(e,a.id)}
        `)}
      </ul>
    `:""}_fmtDuration(e){if(e.status==="pending")return"—";const t=e.startedAt??this._now,r=e.finishedAt??this._now,a=Math.max(0,r-t);if(a<1e3)return"<1s";if(a<6e4)return`${Math.floor(a/1e3)}s`;const s=Math.floor(a/6e4),i=Math.floor(a%6e4/1e3);return`${s}m ${i}s`}};ze.styles=y`
    :host { display: block; }
    .empty {
      padding: 32px 16px;
      text-align: center;
      color: var(--text-3);
      font-size: 12.5px;
      line-height: 1.5;
    }
    .session-eyebrow {
      font-size: 10.5px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--text-3);
      margin: 0 0 10px 0;
    }
    .session-eyebrow code {
      font-family: var(--font-mono);
      color: var(--text-2);
      font-size: 10.5px;
    }

    ul.tree {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    ul.tree ul.tree {
      margin-left: 18px;
      padding-left: 12px;
      border-left: 1px dashed var(--border);
      margin-top: 4px;
    }
    li.node {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: var(--radius-2);
      font-size: 13px;
    }
    li.node[data-status="running"] {
      border-color: color-mix(in srgb, var(--accent) 50%, var(--border));
    }
    li.node[data-status="failed"] {
      border-color: color-mix(in srgb, var(--err) 60%, var(--border));
    }
    .icon {
      width: 18px;
      text-align: center;
      font-size: 13px;
      flex-shrink: 0;
      color: var(--text-2);
    }
    li.node[data-status="running"] .icon {
      color: var(--accent);
      animation: pulse 1.5s var(--ease-out) infinite;
    }
    li.node[data-status="done"] .icon { color: var(--ok); }
    li.node[data-status="failed"] .icon { color: var(--err); }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50%      { opacity: 0.55; transform: scale(0.9); }
    }
    .title {
      flex: 1;
      min-width: 0;
      color: var(--text-0);
      font-size: 12.5px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .badge {
      flex-shrink: 0;
      padding: 1px 8px;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      background: var(--panel-2);
      color: var(--text-2);
      border: 1px solid var(--border);
    }
    .badge.sonnet { color: var(--accent-soft, var(--accent)); border-color: color-mix(in srgb, var(--accent) 35%, var(--border)); }
    .badge.haiku  { color: var(--ok); border-color: color-mix(in srgb, var(--ok) 35%, var(--border)); }
    .badge.opus   { color: var(--warn, #f59e0b); border-color: color-mix(in srgb, var(--warn, #f59e0b) 35%, var(--border)); }
    .duration {
      flex-shrink: 0;
      color: var(--text-3);
      font-size: 11px;
      font-variant-numeric: tabular-nums;
    }
  `;_t([l()],ze.prototype,"_tasks",2);_t([l()],ze.prototype,"_activeSessionId",2);_t([l()],ze.prototype,"_now",2);ze=_t([w("ares-task-list-panel")],ze);var to=Object.defineProperty,ro=Object.getOwnPropertyDescriptor,we=(e,t,r,a)=>{for(var s=a>1?void 0:a?ro(t,r):t,i=e.length-1,o;i>=0;i--)(o=e[i])&&(s=(a?o(t,r,s):o(s))||s);return a&&s&&to(t,r,s),s};let ee=class extends m{constructor(){super(...arguments),this.sessionId=null,this._folders=[],this._skills=[],this._mcps=[],this._sessionFiles=[],this._expanded={workspace:!0,skills:!1,connections:!1}}async connectedCallback(){super.connectedCallback(),await this._refreshAll()}updated(e){e.has("sessionId")&&this._loadSessionFiles()}async _refreshAll(){await Promise.all([this._loadFolders(),this._loadSkills(),this._loadMcps(),this._loadSessionFiles()])}async _loadFolders(){try{const e=await _("/api/indexed-folders");this._folders=Array.isArray(e)?e:e?.folders??[]}catch{this._folders=[]}}async _loadSkills(){try{const e=await _("/api/skills");this._skills=Array.isArray(e?.skills)?e.skills:[]}catch{this._skills=[]}}async _loadMcps(){try{const e=await _("/api/mcps");this._mcps=Array.isArray(e)?e:[]}catch{this._mcps=[]}}async _loadSessionFiles(){if(!this.sessionId){this._sessionFiles=[];return}try{const e=await _(`/api/sessions/${encodeURIComponent(this.sessionId)}`),t=Array.isArray(e?.attachedFiles)?e.attachedFiles:[],r=[];for(const s of e?.messages??[])for(const i of s?._attachments??[])r.push({name:i.name,sizeBytes:i.sizeBytes,format:i.format});const a=new Set;this._sessionFiles=[...t,...r].filter(s=>!s?.name||a.has(s.name)?!1:(a.add(s.name),!0))}catch{this._sessionFiles=[]}}_toggle(e){this._expanded={...this._expanded,[e]:!this._expanded[e]}}_close(){this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0}))}_openSkill(e){window.location.hash=`#/capabilities/skills?slug=${encodeURIComponent(e.slug)}`,this._close()}_openConnection(e){window.location.hash=`#/capabilities/connections?focus=${encodeURIComponent(e.name)}`,this._close()}async _activateConnection(e,t){t.stopPropagation();try{await v(`/api/mcps/${encodeURIComponent(e.name)}/activate`,{method:"POST"}),await this._loadMcps()}catch{}}render(){const e=this._skills.length,t=this._mcps.length;return n`
      <div class="toolbar">
        <button title="Refresh" @click=${()=>this._refreshAll()}>↻</button>
        <button title="Clear cache" @click=${()=>this._refreshAll()}>🗑</button>
        <button title="Close" @click=${this._close}>×</button>
      </div>

      <section class="section ${this._expanded.workspace?"expanded":""}">
        <header @click=${()=>this._toggle("workspace")}>
          <span class="chev">▶</span>
          <h4>Agent workspace</h4>
          <button class="refresh" title="Refresh" @click=${r=>{r.stopPropagation(),this._loadFolders(),this._loadSessionFiles()}}>↻</button>
        </header>
        ${this._expanded.workspace?n`
          <div class="body">
            <div class="subsection-title">Quick Web Spaces</div>
            <div class="placeholder">Web search history (coming soon)</div>

            <div class="subsection-title">Local Folders</div>
            ${this._folders.length===0?n`<div class="empty">No folders indexed. Add one from My Computer.</div>`:this._folders.map(r=>n`
                  <div class="row" title=${r.path}>
                    <div class="icon">📁</div>
                    <div class="meta">
                      <div class="name">${r.name}</div>
                      <div class="sub">${r.status} · ${r.path}</div>
                    </div>
                  </div>
                `)}

            <div class="subsection-title">Session Files</div>
            ${this._sessionFiles.length===0?n`<div class="empty">No files attached to this session.</div>`:this._sessionFiles.map(r=>n`
                  <div class="row" title=${r.name}>
                    <div class="icon">${(r.format||r.name.split(".").pop()||"•").slice(0,3).toUpperCase()}</div>
                    <div class="meta">
                      <div class="name">${r.name}</div>
                      <div class="sub">${r.format||"file"}${r.sizeBytes?` · ${this._fmtSize(r.sizeBytes)}`:""}</div>
                    </div>
                  </div>
                `)}
          </div>
        `:""}
      </section>

      <section class="section ${this._expanded.skills?"expanded":""}">
        <header @click=${()=>this._toggle("skills")}>
          <span class="chev">▶</span>
          <h4>Skills</h4>
          <span class="count">${e}</span>
          <button class="refresh" title="Refresh" @click=${r=>{r.stopPropagation(),this._loadSkills()}}>↻</button>
        </header>
        ${this._expanded.skills?n`
          <div class="body">
            ${this._skills.length===0?n`<div class="empty">No skills available.</div>`:this._skills.slice(0,200).map(r=>n`
                  <div class="row" @click=${()=>this._openSkill(r)}>
                    <div class="icon">${(r.title||r.slug||"?").charAt(0).toUpperCase()}</div>
                    <div class="meta">
                      <div class="name">${r.title||r.slug}</div>
                      <div class="sub">${r.tools?.length??0} tool${(r.tools?.length??0)===1?"":"s"}${r.description?` · ${r.description}`:""}</div>
                    </div>
                  </div>
                `)}
          </div>
        `:""}
      </section>

      <section class="section ${this._expanded.connections?"expanded":""}">
        <header @click=${()=>this._toggle("connections")}>
          <span class="chev">▶</span>
          <h4>Connections</h4>
          <span class="count">${t}</span>
          <button class="refresh" title="Refresh" @click=${r=>{r.stopPropagation(),this._loadMcps()}}>↻</button>
        </header>
        ${this._expanded.connections?n`
          <div class="body">
            ${this._mcps.length===0?n`<div class="empty">No connections available.</div>`:this._mcps.map(r=>{const a=r.state==="running";return n`
                    <div class="row" @click=${()=>this._openConnection(r)}>
                      <div class="icon">${r.name.charAt(0).toUpperCase()}</div>
                      <div class="meta">
                        <div class="name">${r.name}</div>
                        <div class="sub">${r.toolCount??0} tool${r.toolCount===1?"":"s"}${r.description?` · ${r.description}`:""}</div>
                      </div>
                      <div class="auth">
                        ${a?n`<span class="dot ok" title="Authenticated"></span>`:n`<button class="pill-signin" @click=${s=>this._activateConnection(r,s)}>Sign in</button>`}
                      </div>
                    </div>
                  `})}
          </div>
        `:""}
      </section>
    `}_fmtSize(e){return e<1024?`${e}B`:e<1024*1024?`${(e/1024).toFixed(1)}KB`:e<1024*1024*1024?`${(e/1024/1024).toFixed(1)}MB`:`${(e/1024/1024/1024).toFixed(1)}GB`}};ee.styles=y`
    :host { display: block; }

    .toolbar {
      display: flex;
      gap: 4px;
      justify-content: flex-end;
      padding: 0 0 10px 0;
      margin-bottom: 6px;
      border-bottom: 1px solid var(--border);
    }
    .toolbar button {
      all: unset; cursor: pointer;
      padding: 4px 8px;
      font-size: 13px;
      color: var(--text-3);
      border-radius: var(--radius-1);
      transition: background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out);
    }
    .toolbar button:hover { background: var(--panel-2); color: var(--text-0); }

    .section { margin-bottom: 14px; }
    .section header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 4px;
      cursor: pointer;
      user-select: none;
    }
    .section header .chev {
      width: 12px;
      color: var(--text-3);
      transition: transform var(--dur-fast) var(--ease-out);
    }
    .section.expanded header .chev { transform: rotate(90deg); }
    .section header h4 {
      margin: 0;
      flex: 1;
      font-size: 10.5px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--text-3);
      font-weight: 600;
    }
    .section header .count {
      font-size: 11px;
      color: var(--text-2);
      padding: 0 6px;
      border-radius: 999px;
      background: var(--panel-2);
      border: 1px solid var(--border);
    }
    .section header button.refresh {
      all: unset; cursor: pointer;
      width: 22px; height: 22px;
      display: grid; place-items: center;
      border-radius: var(--radius-1);
      color: var(--text-3);
    }
    .section header button.refresh:hover { background: var(--panel-2); color: var(--text-0); }
    .section .body {
      padding: 4px 0 0 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .subsection-title {
      font-size: 10.5px;
      color: var(--text-3);
      margin: 6px 4px 4px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: var(--radius-2);
      cursor: pointer;
      transition: border-color var(--dur-fast) var(--ease-out);
    }
    .row:hover { border-color: var(--border-2, color-mix(in srgb, var(--accent) 30%, var(--border))); }
    .row .icon {
      width: 26px; height: 26px;
      display: grid; place-items: center;
      flex-shrink: 0;
      border-radius: var(--radius-2);
      background: color-mix(in srgb, var(--accent) 18%, var(--panel-2));
      color: var(--accent-soft, var(--accent));
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.02em;
    }
    .row .meta { flex: 1; min-width: 0; }
    .row .name {
      color: var(--text-0);
      font-size: 13px;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .row .sub {
      color: var(--text-3);
      font-size: 11px;
      margin-top: 2px;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .row .auth {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .pill-signin {
      padding: 3px 10px;
      border: 1px solid var(--accent);
      color: var(--accent-soft, var(--accent));
      background: color-mix(in srgb, var(--accent) 10%, transparent);
      border-radius: 999px;
      font-size: 10.5px;
      font-weight: 500;
    }
    .dot {
      width: 8px; height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .dot.ok { background: var(--ok); box-shadow: 0 0 6px color-mix(in srgb, var(--ok) 70%, transparent); }
    .empty {
      padding: 12px;
      color: var(--text-3);
      font-size: 12px;
      text-align: center;
    }
    .placeholder {
      padding: 8px 10px;
      color: var(--text-3);
      font-size: 12px;
      font-style: italic;
      background: var(--panel);
      border: 1px dashed var(--border);
      border-radius: var(--radius-2);
    }
  `;we([E({type:String})],ee.prototype,"sessionId",2);we([l()],ee.prototype,"_folders",2);we([l()],ee.prototype,"_skills",2);we([l()],ee.prototype,"_mcps",2);we([l()],ee.prototype,"_sessionFiles",2);we([l()],ee.prototype,"_expanded",2);ee=we([w("ares-data-and-apps-panel")],ee);var so=Object.defineProperty,ao=Object.getOwnPropertyDescriptor,ke=(e,t,r,a)=>{for(var s=a>1?void 0:a?ao(t,r):t,i=e.length-1,o;i>=0;i--)(o=e[i])&&(s=(a?o(t,r,s):o(s))||s);return a&&s&&so(t,r,s),s};const he=["actions","sessions","skills","mcps","settings"],io={actions:"Actions",sessions:"Sessions",skills:"Skills",mcps:"MCPs",settings:"Settings"},oo=[{group:"settings",id:"capabilities",label:"Capabilities",hint:"Connections, skills, scheduled tasks",payload:{kind:"settings",route:{top:"capabilities",sub:"connections"}}},{group:"settings",id:"my-computer",label:"My Computer",hint:"Sandbox, browser, diagnostics",payload:{kind:"settings",route:{top:"my-computer",sub:null}}},{group:"settings",id:"my-context",label:"My Context",hint:"Knowledge graph, memory inspector",payload:{kind:"settings",route:{top:"my-context",sub:null}}},{group:"settings",id:"customization",label:"Customization",hint:"Theme, animation, layout",payload:{kind:"settings",route:{top:"customization",sub:null}}}];let te=class extends m{constructor(){super(...arguments),this._open=!1,this._query="",this._items=[],this._activeIndex=0,this._loading=!1,this._onGlobalKey=e=>{if((e.metaKey||e.ctrlKey)&&(e.key==="k"||e.key==="K")){e.preventDefault(),this._open?this._hide():this._show();return}if(this._open){if(e.key==="Escape"){e.preventDefault(),this._hide();return}if(e.key==="ArrowDown"){e.preventDefault(),this._move(1);return}if(e.key==="ArrowUp"){e.preventDefault(),this._move(-1);return}if(e.key==="Enter"){e.preventDefault(),this._activate();return}if(e.key==="Tab"){e.preventDefault(),this._tabAdvance();return}}},this._onQueryInput=e=>{this._query=e.target.value,this._activeIndex=0}}connectedCallback(){super.connectedCallback(),document.addEventListener("keydown",this._onGlobalKey)}disconnectedCallback(){super.disconnectedCallback(),document.removeEventListener("keydown",this._onGlobalKey)}openPalette(){this._show()}closePalette(){this._hide()}isOpen(){return this._open}getVisibleItems(){return this._filtered()}getActiveIndex(){return this._activeIndex}_show(){this._open=!0,this.setAttribute("data-open","1"),this._activeIndex=0,this._loadAll(),queueMicrotask(()=>{try{this._searchEl?.focus(),this._searchEl?.select?.()}catch{}})}_hide(){this._open=!1,this.removeAttribute("data-open"),this._query=""}async _loadAll(){if(this._loading)return;this._loading=!0;const e=[];for(const r of oo)e.push(r);const t=[this._loadCommands(e),this._loadSessions(e),this._loadSkills(e),this._loadMcps(e)];await Promise.allSettled(t),e.sort((r,a)=>he.indexOf(r.group)-he.indexOf(a.group)),this._items=e,this._loading=!1}async _loadCommands(e){try{const t=await v("/api/commands");if(!t.ok)return;const r=await t.json();for(const a of r.commands??[])e.push({group:"actions",id:a.name,label:`/${a.name}`,hint:a.description??"",payload:{kind:"action",command:a.name}})}catch{}}async _loadSessions(e){try{const t=await v("/api/sessions");if(!t.ok)return;const a=((await t.json()).sessions??[]).slice().sort((s,i)=>(i.updatedAt??0)-(s.updatedAt??0)).slice(0,20);for(const s of a)e.push({group:"sessions",id:s.id,label:s.title||s.id.slice(0,8),hint:s.id,payload:{kind:"session",sessionId:s.id}})}catch{}}async _loadSkills(e){try{const t=await v("/api/skills");if(!t.ok)return;const a=(await t.json()).skills??[];for(const s of a)e.push({group:"skills",id:s.slug,label:s.title||s.slug,hint:s.description??"",payload:{kind:"skill",slug:s.slug}})}catch{}}async _loadMcps(e){try{const t=await v("/api/mcps");if(!t.ok)return;const r=await t.json(),a=r.mcps??r.servers??[];for(const s of a)e.push({group:"mcps",id:s.name,label:s.name,hint:s.description??"",payload:{kind:"mcp",name:s.name}})}catch{}}_filtered(){const e=this._query.trim().toLowerCase();return e?this._items.filter(t=>t.label.toLowerCase().includes(e)||(t.hint||"").toLowerCase().includes(e)):this._items}_move(e){const t=this._filtered();if(t.length===0)return;let r=this._activeIndex+e;r<0&&(r=t.length-1),r>=t.length&&(r=0),this._activeIndex=r,this._scrollActiveIntoView()}_tabAdvance(){const e=this._filtered();if(e.length===0)return;const t=e[this._activeIndex];if(!t){this._activeIndex=0;return}const r=he.indexOf(t.group);for(let a=1;a<=he.length;a++){const s=he[(r+a)%he.length],i=e.findIndex(o=>o.group===s);if(i!==-1){this._activeIndex=i,this._scrollActiveIntoView();return}}}_scrollActiveIntoView(){queueMicrotask(()=>{const e=this.shadowRoot;if(!e)return;const t=e.querySelector(".row.active");try{t?.scrollIntoView?.({block:"nearest"})}catch{}})}_activate(){const t=this._filtered()[this._activeIndex];t&&(this._dispatchSelection(t),this._hide())}_dispatchSelection(e){const t=e.payload;switch(t.kind){case"action":{et("draft",`/${t.command}`),document.dispatchEvent(new CustomEvent("ares:palette-action",{detail:{command:t.command}})),I({top:"chat",sub:null});return}case"session":{this.dispatchEvent(new CustomEvent("session-selected",{detail:{id:t.sessionId},bubbles:!0,composed:!0})),I({top:"chat",sub:null});return}case"skill":{try{sessionStorage.setItem("ares.cmdk.focus-skill",t.slug)}catch{}I({top:"capabilities",sub:"skills"});return}case"mcp":{try{sessionStorage.setItem("ares.cmdk.focus-mcp",t.name)}catch{}I({top:"capabilities",sub:"connections"});return}case"settings":{I(t.route);return}}}render(){if(!this._open)return S;const e=this._filtered(),t=new Map;return e.forEach((r,a)=>{const s=t.get(r.group)??[];s.push({item:r,globalIndex:a}),t.set(r.group,s)}),n`
      <div class="scrim" @click=${()=>this._hide()}></div>
      <div class="palette" role="dialog" aria-label="Command palette">
        <div class="search-row">
          <span class="icon">⌘K</span>
          <input
            class="search"
            type="text"
            placeholder="Search actions, sessions, skills, MCPs, settings…"
            .value=${this._query}
            @input=${this._onQueryInput}
            aria-label="Search"
          />
        </div>
        <div class="results" role="listbox">
          ${e.length===0?n`<div class="empty">${this._loading?"Loading…":"No matches."}</div>`:""}
          ${he.map(r=>{const a=t.get(r);return!a||a.length===0?S:n`
              <div class="group-label">${io[r]}</div>
              ${a.map(({item:s,globalIndex:i})=>n`
                <div
                  class=${`row ${i===this._activeIndex?"active":""}`}
                  role="option"
                  aria-selected=${i===this._activeIndex?"true":"false"}
                  data-group=${s.group}
                  data-id=${s.id}
                  @click=${()=>{this._activeIndex=i,this._activate()}}
                  @mouseenter=${()=>{this._activeIndex=i}}
                >
                  <span class="label">${s.label}</span>
                  ${s.hint?n`<span class="hint">${s.hint}</span>`:""}
                </div>
              `)}
            `})}
        </div>
      </div>
    `}};te.styles=y`
    :host {
      position: fixed;
      inset: 0;
      z-index: 9000;
      display: none;
      align-items: flex-start;
      justify-content: center;
      pointer-events: none;
    }
    :host([data-open="1"]) { display: flex; pointer-events: auto; }
    .scrim {
      position: absolute;
      inset: 0;
      background: rgba(0,0,0,0.45);
      backdrop-filter: blur(2px);
      animation: ares-fade-in 180ms var(--ease-out) both;
    }
    .palette {
      position: relative;
      margin-top: 14vh;
      width: 560px;
      max-width: 92vw;
      max-height: 60vh;
      display: flex;
      flex-direction: column;
      background: var(--surface-elevated, var(--panel-2));
      border: 1px solid var(--border-2);
      border-radius: var(--radius-3);
      box-shadow: var(--shadow-lg, 0 24px 64px rgba(0,0,0,0.55));
      overflow: hidden;
      animation: ares-cmdk-pop 180ms var(--ease-out) both;
    }
    @keyframes ares-cmdk-pop {
      from { opacity: 0; transform: scale(0.97); }
      to   { opacity: 1; transform: scale(1); }
    }
    @media (prefers-reduced-motion: reduce) {
      @keyframes ares-cmdk-pop {
        from { opacity: 0; transform: none; }
        to   { opacity: 1; transform: none; }
      }
      .palette, .scrim { animation-duration: 0.01ms !important; }
    }
    .search-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      border-bottom: 1px solid var(--border);
    }
    .search-row .icon {
      color: var(--text-3);
      font-size: 14px;
    }
    input.search {
      flex: 1;
      all: unset;
      color: var(--text-0);
      font-size: 14px;
      font-family: var(--font-ui);
    }
    input.search::placeholder { color: var(--text-3); }
    .results {
      overflow-y: auto;
      padding: 6px 0;
    }
    .group-label {
      padding: 6px 16px 4px;
      color: var(--text-3);
      font-size: 10.5px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 7px 16px;
      cursor: pointer;
      color: var(--text-1);
      font-size: 13px;
      transition: background var(--dur-fast) var(--ease-out);
    }
    .row:hover { background: var(--panel-2); }
    .row.active { background: var(--accent-soft); color: var(--text-0); }
    .row .label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .row .hint { color: var(--text-3); font-size: 11.5px; flex-shrink: 0; max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .row.active .hint { color: var(--text-1); }
    .empty {
      padding: 24px 16px;
      text-align: center;
      color: var(--text-3);
      font-size: 12.5px;
    }
  `;ke([l()],te.prototype,"_open",2);ke([l()],te.prototype,"_query",2);ke([l()],te.prototype,"_items",2);ke([l()],te.prototype,"_activeIndex",2);ke([l()],te.prototype,"_loading",2);ke([Ht("input.search")],te.prototype,"_searchEl",2);te=ke([w("ares-cmdk-palette")],te);var no=Object.defineProperty,lo=Object.getOwnPropertyDescriptor,ns=(e,t,r,a)=>{for(var s=a>1?void 0:a?lo(t,r):t,i=e.length-1,o;i>=0;i--)(o=e[i])&&(s=(a?o(t,r,s):o(s))||s);return a&&s&&no(t,r,s),s};const co=3;let gt=class extends m{constructor(){super(...arguments),this._toasts=[],this._onToast=e=>{const t=e.detail;!t||!t.title||this._enqueue(t)},this._onDismiss=e=>{const t=e.detail?.id;t&&this._dismiss(t)}}connectedCallback(){super.connectedCallback(),document.addEventListener(Tt,this._onToast),document.addEventListener(ur,this._onDismiss)}disconnectedCallback(){super.disconnectedCallback(),document.removeEventListener(Tt,this._onToast),document.removeEventListener(ur,this._onDismiss);for(const e of this._toasts)e.timerId&&clearTimeout(e.timerId)}enqueue(e){this._enqueue(e)}_enqueue(e){const t=Date.now(),r=e.durationMs>0?setTimeout(()=>this._dismiss(e.id),e.durationMs):null,a={...e,enqueuedAt:t,timerId:r};let s=[...this._toasts,a];for(;s.length>co;){const i=s.shift();i?.timerId&&clearTimeout(i.timerId)}this._toasts=s}_dismiss(e){const t=this._toasts.findIndex(a=>a.id===e);if(t===-1)return;const r=this._toasts[t];r.timerId&&clearTimeout(r.timerId),this._toasts=this._toasts.filter(a=>a.id!==e)}getQueue(){return this._toasts.map(e=>({id:e.id,variant:e.variant,title:e.title,body:e.body}))}render(){return n`
      ${this._toasts.map(e=>n`
        <div class="toast" data-variant=${e.variant} role="status" aria-live="polite">
          <div class="body-wrap">
            <div class="title">${e.title}</div>
            ${e.body?n`<div class="body">${e.body}</div>`:""}
          </div>
          <button class="close" @click=${()=>this._dismiss(e.id)} title="Dismiss" aria-label="Dismiss">×</button>
        </div>
      `)}
    `}};gt.styles=y`
    :host {
      position: fixed;
      right: 16px;
      bottom: 16px;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 10px;
      pointer-events: none;
    }
    .toast {
      pointer-events: auto;
      width: 360px;
      max-width: 360px;
      background: var(--surface-elevated, var(--panel-2));
      border: 1px solid var(--border);
      border-left-width: 3px;
      border-radius: var(--radius-2);
      padding: var(--space-3);
      box-shadow: var(--shadow-md, 0 8px 24px rgba(0,0,0,0.35));
      color: var(--text-1);
      font-size: 13px;
      display: flex;
      gap: 10px;
      align-items: flex-start;
      animation: ares-toast-slide-in 200ms var(--ease-out) both;
    }
    .toast[data-variant="success"] { border-left-color: var(--ok); }
    .toast[data-variant="warn"]    { border-left-color: var(--warn); }
    .toast[data-variant="danger"]  { border-left-color: var(--err); }
    .toast[data-variant="info"]    { border-left-color: var(--info); }
    .toast .body-wrap {
      flex: 1;
      min-width: 0;
    }
    .toast .title {
      font-weight: 600;
      color: var(--text-0);
      font-size: 13px;
      line-height: 1.3;
    }
    .toast .body {
      margin-top: 4px;
      color: var(--text-2);
      font-size: 12px;
      line-height: 1.4;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .toast .close {
      all: unset;
      cursor: pointer;
      color: var(--text-3);
      font-size: 14px;
      line-height: 1;
      padding: 2px 4px;
      border-radius: var(--radius-1);
      opacity: 0;
      transition: opacity var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out);
    }
    .toast:hover .close { opacity: 1; }
    .toast .close:hover { color: var(--text-0); background: var(--panel-2); }

    @keyframes ares-toast-slide-in {
      from { opacity: 0; transform: translateX(16px); }
      to   { opacity: 1; transform: translateX(0); }
    }
    @media (prefers-reduced-motion: reduce) {
      @keyframes ares-toast-slide-in {
        from { opacity: 0; transform: none; }
        to   { opacity: 1; transform: none; }
      }
      .toast { animation-duration: 0.01ms !important; }
    }
  `;ns([l()],gt.prototype,"_toasts",2);gt=ns([w("ares-toast-stack")],gt);var po=Object.defineProperty,ho=Object.getOwnPropertyDescriptor,rt=(e,t,r,a)=>{for(var s=a>1?void 0:a?ho(t,r):t,i=e.length-1,o;i>=0;i--)(o=e[i])&&(s=(a?o(t,r,s):o(s))||s);return a&&s&&po(t,r,s),s};const ls="ares.shell";function uo(){try{const e=localStorage.getItem(ls);if(e){const t=JSON.parse(e);return{dockCollapsed:!!t?.dockCollapsed,railCollapsed:t?.railCollapsed===void 0?!0:!!t.railCollapsed}}}catch{}return{dockCollapsed:!1,railCollapsed:!0}}function vo(e){try{localStorage.setItem(ls,JSON.stringify(e))}catch{}}let ge=class extends m{constructor(){super(...arguments),this._route=Ve(),this._selectedSessionId=null,this._shell=uo(),this._activeOverlay=null,this._unsubscribeRouter=null,this._onSessionSelected=e=>{const t=e.detail.id;if(!(this._selectedSessionId===t&&this._route.top==="chat")){this._selectedSessionId=t,I({top:"chat",sub:t});try{localStorage.setItem("ares.last-session",t)}catch{}}},this._onNewChat=()=>{this._selectedSessionId=null;try{localStorage.removeItem("ares.last-session")}catch{}I({top:"chat",sub:null})},this._onOverlayChange=e=>{this._activeOverlay=e.detail.id},this._onDockToggle=()=>{const e={...this._shell,dockCollapsed:!this._shell.dockCollapsed};this._shell=e,vo(e)}}connectedCallback(){super.connectedCallback(),this._unsubscribeRouter=Qr(t=>{this._route=t,t.top==="chat"&&t.sub&&t.sub!==this._selectedSessionId?this._selectedSessionId=t.sub:t.top==="chat"&&!t.sub&&this._selectedSessionId&&(this._selectedSessionId=null)});const e=Ve();if(this._route=e,e.top==="chat"&&e.sub)this._selectedSessionId=e.sub;else try{const t=localStorage.getItem("ares.last-session");t&&e.top==="chat"&&(this._selectedSessionId=t,I({top:"chat",sub:t},{replace:!0}))}catch{}this._applyShellAttrs(),this.addEventListener("session-selected",this._onSessionSelected),this.addEventListener("new-chat",this._onNewChat),this.addEventListener("overlay-change",this._onOverlayChange),this.addEventListener("dock-toggle",this._onDockToggle)}disconnectedCallback(){super.disconnectedCallback(),this._unsubscribeRouter?.(),this._unsubscribeRouter=null,this.removeEventListener("session-selected",this._onSessionSelected),this.removeEventListener("new-chat",this._onNewChat),this.removeEventListener("overlay-change",this._onOverlayChange),this.removeEventListener("dock-toggle",this._onDockToggle)}updated(){this._applyShellAttrs()}_applyShellAttrs(){this._shell.dockCollapsed?this.setAttribute("data-dock","collapsed"):this.removeAttribute("data-dock")}_closeOverlay(){this._activeOverlay=null}render(){return n`
      <aside class="dock">
        <ares-dock
          .currentRoute=${this._route}
          .selectedSessionId=${this._selectedSessionId}
          ?data-collapsed=${this._shell.dockCollapsed}
        ></ares-dock>
      </aside>

      <!-- Full-width header bar spanning header area only (grid-area: header) -->
      <header class="topbar">
        <ares-top-toolbar .activeOverlay=${this._activeOverlay}></ares-top-toolbar>
      </header>

      <main class="body">
        <ares-main-pane
          .currentRoute=${this._route}
          .selectedSessionId=${this._selectedSessionId}
          @session-created=${e=>{this._selectedSessionId=e.detail.id}}
        ></ares-main-pane>
      </main>

      <ares-quick-peek-overlay
        ?open=${this._activeOverlay==="feed"}
        heading="Activity feed"
        @close=${this._closeOverlay}
      >
        <ares-activity-feed></ares-activity-feed>
      </ares-quick-peek-overlay>

      <ares-quick-peek-overlay
        ?open=${this._activeOverlay==="scheduled"}
        heading="Scheduled tasks"
        @close=${this._closeOverlay}
      >
        <ares-scheduled-tasks compact></ares-scheduled-tasks>
      </ares-quick-peek-overlay>

      <ares-quick-peek-overlay
        ?open=${this._activeOverlay==="sessions"}
        heading="Session tabs"
        @close=${this._closeOverlay}
      >
        <ares-session-tabs-panel
          .sessionId=${this._selectedSessionId}
          open
        ></ares-session-tabs-panel>
      </ares-quick-peek-overlay>

      <ares-quick-peek-overlay
        ?open=${this._activeOverlay==="tasks"}
        heading="Tasks"
        @close=${this._closeOverlay}
      >
        <ares-task-list-panel></ares-task-list-panel>
      </ares-quick-peek-overlay>

      <ares-quick-peek-overlay
        ?open=${this._activeOverlay==="data"}
        heading="Data & apps"
        @close=${this._closeOverlay}
      >
        <ares-data-and-apps-panel
          .sessionId=${this._selectedSessionId}
        ></ares-data-and-apps-panel>
      </ares-quick-peek-overlay>

      <!-- Q-pass-4 work-stream D — global Cmd+K palette + toast stack.
           Both listen for their own document-level events; mounting them
           as siblings keeps them above quick-peek overlays. -->
      <ares-cmdk-palette></ares-cmdk-palette>
      <ares-toast-stack></ares-toast-stack>

      <!-- Q-pass-5 P3-1 — INTERNAL badge anchored bottom-right of the
           viewport. Always visible regardless of scroll. -->
      <div class="internal-badge" title="Internal Company build — never share screenshots externally">INTERNAL</div>
    `}};ge.styles=y`
    :host {
      display: grid;
      height: 100%;
      /* 2-column: dock | main. The right rail is removed — panels that
       * used to live there (My Context, Activity Feed, etc.) now open
       * as overlays triggered by the top toolbar icons. */
      grid-template-columns: var(--dock-w, 240px) 1fr;
      grid-template-rows: 52px 1fr;
      grid-template-areas:
        "dock header"
        "dock main";
      background: var(--bg);
      color: var(--text-1);
      font-family: var(--font-ui);
      transition: grid-template-columns var(--dur-base) var(--ease-out);
    }
    :host([data-dock="collapsed"]) { --dock-w: 56px; }
    aside.dock  { grid-area: dock; min-width: 0; }
    header.topbar {
      grid-area: header;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: var(--space-2);
      padding: 0 var(--space-4);
      background: var(--panel);
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
      z-index: 10;
      /* Allow dragging the empty right-side space to move the window */
      -webkit-app-region: drag;
      user-select: none;
    }
    /* Interactive elements inside must opt out of the drag region */
    header.topbar button,
    header.topbar ares-top-toolbar,
    header.topbar .preview-pill {
      -webkit-app-region: no-drag;
    }
    main.body {
      grid-area: main;
      min-width: 0;
      min-height: 0;
      overflow: hidden;
      position: relative;
    }
    .preview-pill {
      padding: 3px 9px;
      border-radius: 999px;
      border: 1px solid color-mix(in srgb, var(--accent) 60%, var(--border));
      color: color-mix(in srgb, var(--accent) 90%, var(--text-0));
      font-size: 10.5px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      background: color-mix(in srgb, var(--accent) 12%, transparent);
    }

    /* Q-pass-5 P3-1 — INTERNAL badge bottom-right of the viewport. */
    .internal-badge {
      position: fixed;
      bottom: 8px;
      right: 12px;
      z-index: 9999;
      padding: 2px 6px;
      border-radius: 3px;
      background: var(--err);
      color: #fff;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.08em;
      pointer-events: none;
      opacity: 0.85;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
    }
  `;rt([l()],ge.prototype,"_route",2);rt([l()],ge.prototype,"_selectedSessionId",2);rt([l()],ge.prototype,"_shell",2);rt([l()],ge.prototype,"_activeOverlay",2);ge=rt([w("ares-app-shell")],ge);const fo={};fs();try{const e=localStorage.getItem("ares.chat.density");(e==="compact"||e==="comfortable"||e==="normal")&&document.documentElement.setAttribute("data-density",e)}catch{}function Or(e){if(!Number.isFinite(e)||e<1){document.documentElement.removeAttribute("data-anim-slow");return}document.documentElement.setAttribute("data-anim-slow",String(Math.max(1,Math.min(10,Math.floor(e)))))}(function(){try{const t=new URL(location.href),r=t.searchParams.get("slow")??t.searchParams.get("anim-slow");if(r!==null&&r!==""){const a=parseInt(r,10);if(Number.isFinite(a)&&a>=1){Or(a);return}}}catch{}(async()=>{try{const t=await v("/api/dev/anim");if(!t.ok)return;const r=await t.json(),a=typeof r.multiplier=="number"?r.multiplier:r.slow?4:0;Or(a)}catch{}})()})();Se().catch(e=>{console.warn("[ares-q] auth handshake deferred:",e.message)});const cs=document.getElementById("ares-root");if(!cs)throw new Error("Ares Q: missing #ares-root");console.log(`[ares-q] booting ui v${fo?.VITE_APP_VERSION??"0.1.0"}`);const go=document.createElement("ares-app-shell");cs.replaceChildren(go);
