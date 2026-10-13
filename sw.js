const CACHE='kstar-a-pwa-v20';
const ASSETS=['./','./index.html','./logic.js','./data.js','./cloud.js','./cloud-config.js','./app.js','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
const assetUrls=new Set(ASSETS.map(p=>new URL(p,self.registration.scope).href));
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('kstar-a-pwa-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||e.request.headers.has('Authorization')||!assetUrls.has(e.request.url))return;e.respondWith(fetch(e.request).then(async r=>{if(r.ok){const c=await caches.open(CACHE);await c.put(e.request,r.clone());}return r;}).catch(async()=>{const r=await caches.match(e.request);if(r)return r;throw Error('离线资产不可用');}));});
