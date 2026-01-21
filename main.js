// Show selected GPX file name next to the button
document.addEventListener('DOMContentLoaded', function() {
  var gpxInput = document.getElementById('gpxfile');
  var gpxName = document.getElementById('gpxfile-name');
  if (gpxInput && gpxName) {
    gpxInput.addEventListener('change', function() {
      gpxName.textContent = gpxInput.files.length ? gpxInput.files[0].name : '';
    });
  }
});
// Debug logging removed
// 全国表示ボタン（削除済み）
// if(document.getElementById('resetAllBtn')){
//   document.getElementById('resetAllBtn').addEventListener('click', () => {
//     setMuniLayer(features);
//     try {
//       if(features.length > 0) map.fitBounds(muniLayer.getBounds());
//     } catch(e) {}
//   });
// }
// Update municipality ranking (top 10 by found count)
function updateMuniRanking(){
  const el = document.getElementById('muniRankingList');
  const statsEl = document.getElementById('muniRankingStats');
  if(!el) return;
  // Aggregate counts by municipality name
  const muniStats = new Map();
  features.forEach((f, idx) => {
    const { city, pref } = extractNames(f.properties);
    const key = `${pref} ${city}`;
    const cur = muniStats.get(key) || { name: key, count: 0 };
    cur.count += (counts.get(idx) || 0);
    muniStats.set(key, cur);
  });
  // Sort by count desc, then name, and filter out 0F
  const entries = Array.from(muniStats.values()).filter(e => e.count > 0);
  entries.sort((a,b)=> b.count - a.count || a.name.localeCompare(b.name, 'ja'));
  // Show up to 10 entries with count > 0
  const top10 = entries.slice(0, 10);
  if(statsEl){
    if(entries.length === 0){
      statsEl.textContent = '発見数統計: データなし';
    } else {
      const countsArr = top10.map(e=>e.count);
     
    }
  }
    
  el.innerHTML = '';
  // Global (nationwide) summary sentence: counts of 市/町/村/区 where counts>0
  try{
    let globalEl = document.getElementById('globalSummarySentence');
    if(!globalEl){
      globalEl = document.createElement('p');
      globalEl.id = 'globalSummarySentence';
      globalEl.className = 'small';
      globalEl.style.marginBottom = '12px';
      // Find the specific prefecture-card title and insert immediately after it
      const titles = Array.from(document.querySelectorAll('.card-title'));
      let inserted = false;
      for(const t of titles){
        try{
          if(t.textContent && t.textContent.trim() === '都道府県ごとのキャッシュを見つけた市区町村数'){
            // insert right after the title element
            t.parentNode.insertBefore(globalEl, t.nextSibling);
            inserted = true; break;
          }
        }catch(e){}
      }
      if(!inserted){
        // fallback: insert before the prefecture list as before
        let cardContent = el && el.parentNode;
        while(cardContent && (!cardContent.classList || !cardContent.classList.contains('card-content'))){
          cardContent = cardContent.parentNode;
        }
        if(cardContent) cardContent.insertBefore(globalEl, el);
      }
    }
    // compute nationwide counts (only count municipalities with found caches)
    let gshi = 0, gcho = 0, gmura = 0, gku = 0;
    for(const [i, f] of features.entries()){
      try{
        const c = counts.get(i) || 0;
        if(c <= 0) continue;
        const { city } = extractNames(f.properties);
        const nm = String(city || '').trim();
        const last = nm.length ? nm.charAt(nm.length - 1) : '';
        if(last === '市') gshi++;
        else if(last === '町') gcho++;
        else if(last === '村') gmura++;
        else if(last === '区') gku++;
        else gshi++;
      }catch(e){ /* ignore feature errors */ }
    }
    const gparts = [];
    if(gshi > 0) gparts.push(`${gshi}市`);
    if(gcho > 0) gparts.push(`${gcho}町`);
    if(gmura > 0) gparts.push(`${gmura}村`);
    if(gku > 0) gparts.push(`${gku}区`);
    if(gparts.length === 0){ globalEl.textContent = ''; globalEl.style.display = 'none'; }
    else {
      globalEl.style.display = 'block';
      // Emphasize the counts portion
      const countsHtml = `<span class="summary-highlight">${gparts.join('')}</span>`;
      globalEl.innerHTML = `あなたは全国の${countsHtml}でGeocacheを発見しています。`;
    }
  }catch(e){ /* ignore global summary errors */ }
  // Render as a table: 順位 | 市区町村 | 発見数
  const table = document.createElement('table');
  table.className = 'muni-table';
  table.style.width = '100%';
  table.style.borderCollapse = 'collapse';
  const thead = document.createElement('thead');
  const hrow = document.createElement('tr');
  ['順位', '市区町村', '発見数'].forEach(h => {
    const th = document.createElement('th'); th.textContent = h; th.style.textAlign = 'left'; th.style.padding = '6px 8px'; th.style.borderBottom = '1px solid #e0e0e0'; hrow.appendChild(th);
  });
  thead.appendChild(hrow); table.appendChild(thead);
  const tbody = document.createElement('tbody');
  for(let i=0;i<top10.length;++i){
    const ent = top10[i];
    const tr = document.createElement('tr');
    const tdRank = document.createElement('td'); tdRank.textContent = `${i+1}位`; tdRank.style.padding='8px'; tdRank.style.width='64px'; tr.appendChild(tdRank);
    const tdName = document.createElement('td'); tdName.textContent = ent.name; tdName.style.padding='8px'; tr.appendChild(tdName);
    const tdCount = document.createElement('td'); tdCount.textContent = `${ent.count}F`; tdCount.style.padding='8px'; tdCount.style.textAlign='right'; tdCount.style.width='96px'; tr.appendChild(tdCount);
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  el.appendChild(table);
}

// Given a lon/lat, returns { idx, feature } or null if not inside any municipality
function getMuniForPoint(lat, lon){
  try{
    const buf = 0.00001;
    const candidates = tree.search({ minX: lon-buf, minY: lat-buf, maxX: lon+buf, maxY: lat+buf });
    const pt = turf.point([lon, lat]);
    for(const cand of candidates){
      const f = features[cand.idx];
      if(f && turf.booleanPointInPolygon(pt, f)) return { idx: cand.idx, feature: f };
    }
  }catch(e){ /* ignore */ }
  return null;
}

// Compute and render the extreme municipalities (N/S/E/W) given an array of points [{lat,lon,props}]
function updateExtremes(points){
  const elN = document.getElementById('ext-north-val');
  const elS = document.getElementById('ext-south-val');
  const elW = document.getElementById('ext-west-val');
  const elE = document.getElementById('ext-east-val');
  if(!elN || !elS || !elW || !elE) return;
  if(!points || points.length===0){
    ['ext-north-val','ext-south-val','ext-west-val','ext-east-val'].forEach(id=>{
      const el = document.getElementById(id); if(el) el.textContent = '—';
    });
    return;
  }
  // Only consider points that are assigned to a municipality
  const assigned = [];
  for(const p of points){
    const found = getMuniForPoint(p.lat, p.lon);
    if(found && found.feature) assigned.push({ pt: p, found });
  }
  if(assigned.length === 0){
    // no assigned points => show dashes
    ['ext-north-val','ext-south-val','ext-west-val','ext-east-val'].forEach(id=>{
      const el = document.getElementById(id); if(el) el.textContent = '(未割当)';
    });
    return;
  }

  // find extremes among assigned points
  let north = assigned[0], south = assigned[0], west = assigned[0], east = assigned[0];
  for(const a of assigned){
    const p = a.pt;
    if(p.lat > north.pt.lat) north = a;
    if(p.lat < south.pt.lat) south = a;
    if(p.lon < west.pt.lon) west = a;
    if(p.lon > east.pt.lon) east = a;
  }
  // helper to resolve municipality name for a point
  // since we already resolved found for assigned entries, reuse them
  // helper to extract GC code and cache name from GPX point properties
  function extractCacheInfo(props){
    if(!props) return { gc:null, name:null };
    let gc = null;
    let name = null;
    for(const k in props){
      try{
        const v = String(props[k] || '');
        const m = v.match(/(GC[0-9A-Z]+)/i);
        if(m){ gc = m[1].toUpperCase(); break; }
      }catch(e){}
    }
    // prefer desc as cache name, then name, then any string that's not the GC
    if(props.desc) name = String(props.desc);
    else if(props.name) name = String(props.name);
    if(name && gc && name.toUpperCase().includes(gc)) name = null;
    if(!name){
      for(const k in props){
        const v = String(props[k]||'').trim();
        if(!v) continue;
        if(gc && v.toUpperCase().includes(gc)) continue;
        name = v; break;
      }
    }
    // If we have a name, remove any trailing "by ..." (e.g. "Cache Name by Finder")
    if(name){
      try{
        // Remove patterns like "(by someone)" or "（by someone）"
        name = name.replace(/\s*[（(]\s*by[\s\S]*?[)）]\s*$/i, '');
        // Remove trailing " by someone" (no parentheses)
        name = name.replace(/\s+by\s+.*$/i, '');
        name = name.trim();
        if(name.length === 0) name = null;
      }catch(e){ /* ignore */ }
    }
    return { gc, name };
  }

  // Escape text for safe HTML insertion
  function esc(s){
    if(s==null) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  // Return HTML label for an extreme entry: prefecture+city plus （GCリンク：キャッシュ名）
  function formatEntryLabel(entry){
    try{
      const { pref, city } = extractNames(entry.found.feature.properties);
      const info = extractCacheInfo(entry.pt.props || entry.pt);
      const base = esc(`${pref}${city}`);
      let suffixParts = [];
      if(info.gc){
        const gc = esc(info.gc.toUpperCase());
        const url = `https://coord.info/${gc}`;
        suffixParts.push(`<a href="${esc(url)}" target="_blank" rel="noopener">${gc}</a>`);
      }
      if(info.name){
        suffixParts.push(esc(info.name));
      }
      const suffix = suffixParts.length ? `（${suffixParts.join('：')}）` : '';
      return base + suffix;
    }catch(e){ return esc('(不明)'); }
  }

  try{ elN.innerHTML = formatEntryLabel(north); }catch(e){}
  try{ elS.innerHTML = formatEntryLabel(south); }catch(e){}
  try{ elW.innerHTML = formatEntryLabel(west); }catch(e){}
  try{ elE.innerHTML = formatEntryLabel(east); }catch(e){}
}

// Render municipalities that have exactly 1 found cache (1F only)
function updateOneFList(points){
  const el = document.getElementById('oneFList');
  if(!el) return;
  el.innerHTML = '';
  if(!points || points.length === 0){ el.textContent = 'データなし'; return; }

  // Build mapping: feature idx -> array of points assigned to that municipality
  const assignedMap = new Map();
  for(const p of points){
    try{
      const found = getMuniForPoint(p.lat, p.lon);
      if(found && typeof found.idx !== 'undefined'){
        const arr = assignedMap.get(found.idx) || [];
        arr.push({ pt: p, found });
        assignedMap.set(found.idx, arr);
      }
    }catch(e){ /* ignore point errors */ }
  }

  // Collect entries with exactly one point
  const oneEntries = Array.from(assignedMap.entries()).filter(([idx, arr]) => arr.length === 1);
  if(oneEntries.length === 0){ el.textContent = '該当なし'; return; }

  // helper: extract cache info (GC + cleaned name)
  function extractCacheInfo(props){
    if(!props) return { gc:null, name:null };
    let gc = null; let name = null;
    for(const k in props){ try{ const v = String(props[k]||''); const m = v.match(/(GC[0-9A-Z]+)/i); if(m){ gc = m[1].toUpperCase(); break; } }catch(e){} }
    if(props.desc) name = String(props.desc);
    else if(props.name) name = String(props.name);
    if(name && gc && name.toUpperCase().includes(gc)) name = null;
    if(!name){
      for(const k in props){ const v = String(props[k]||'').trim(); if(!v) continue; if(gc && v.toUpperCase().includes(gc)) continue; name = v; break; }
    }
    if(name){
      try{
        name = name.replace(/\s*[（(]\s*by[\s\S]*?[)）]\s*$/i, '');
        name = name.replace(/\s+by\s+.*$/i, '');
        name = name.trim(); if(name.length === 0) name = null;
      }catch(e){}
    }
    return { gc, name };
  }

  function esc(s){ if(s==null) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

  // Build table
  const table = document.createElement('table'); table.className = 'onef-table';
  const thead = document.createElement('thead');
  const hrow = document.createElement('tr');
  ['市区町村名','キャッシュ名'].forEach(h=>{ const th=document.createElement('th'); th.textContent = h; hrow.appendChild(th); });
  thead.appendChild(hrow); table.appendChild(thead);
  const tbody = document.createElement('tbody');

  // Sort by municipality name for stable ordering
  oneEntries.sort((a,b)=>{
    const fa = features[a[0]]; const fb = features[b[0]];
    const na = fa ? (extractNames(fa.properties).pref + extractNames(fa.properties).city) : '';
    const nb = fb ? (extractNames(fb.properties).pref + extractNames(fb.properties).city) : '';
    return na.localeCompare(nb, 'ja');
  });

  for(const [idx, arr] of oneEntries){
    const f = features[idx];
    const { pref, city } = extractNames(f && f.properties);
    const row = document.createElement('tr');
    const tdMuni = document.createElement('td'); tdMuni.className = 'muni-col'; tdMuni.textContent = `${pref}${city}`;
    const tdCache = document.createElement('td'); tdCache.className = 'cache-col';
    // arr has exactly one element
    const entry = arr[0];
    const info = extractCacheInfo(entry.pt.props || entry.pt);
    let html = '';
    if(info.gc){ const gc = esc(info.gc.toUpperCase()); const url = `https://coord.info/${gc}`; html += `<a href="${esc(url)}" target="_blank" rel="noopener">${gc}</a>`; }
    if(info.name){ if(html) html += '：' + esc(info.name); else html += esc(info.name); }
    if(!html) html = '（情報なし）';
    tdCache.innerHTML = html;
    row.appendChild(tdMuni); row.appendChild(tdCache); tbody.appendChild(row);
  }
  table.appendChild(tbody);
  el.appendChild(table);
}
// Determine whether a GPX point's properties contain an FTF marker.
function isFTF(props){
  if(!props) return false;
  // Search all string values inside props (including nested) for patterns like {*FTF*}, {FTF}, [FTF]
  try{
    const s = JSON.stringify(props);
    const re = /(?:\{\*?FTF\*?\}|\[FTF\])/i;
    return re.test(s);
  }catch(e){
    // Fallback: iterate values
    try{
      const re = /(?:\{\*?FTF\*?\}|\[FTF\])/i;
      for(const k in props){
        const v = props[k];
        if(typeof v === 'string' && re.test(v)) return true;
      }
    }catch(_){}
  }
  return false;
}

// Enhanced FTF detection that explicitly inspects groundspeak:logs -> groundspeak:log -> groundspeak:text
// This preserves the original regex exactly but searches nested log text nodes first.
function isFTF2(props){
  if(!props) return false;
  const re = /(?:\{\*?FTF\*?\}|\[FTF\])/i; // keep regex unchanged

  try{
    for(const k in props){
      try{
        const lk = String(k).toLowerCase();
        if(lk.includes('groundspeak') && lk.includes('logs')){
          const logs = props[k];
          const items = [];
          if(Array.isArray(logs)) items.push(...logs);
          else if(logs && typeof logs === 'object'){
            for(const k2 in logs){
              const v2 = logs[k2];
              const lk2 = String(k2).toLowerCase();
              if(lk2.includes('log')){
                if(Array.isArray(v2)) items.push(...v2);
                else if(v2) items.push(v2);
              } else {
                if(Array.isArray(v2)) items.push(...v2);
                else if(v2 && typeof v2 === 'object') items.push(v2);
              }
            }
          }

          for(const li of items){
            if(!li) continue;
            for(const k3 in li){
              try{
                const lk3 = String(k3).toLowerCase();
                if(lk3.includes('text')){
                  const txt = li[k3];
                  if(typeof txt === 'string' && re.test(txt)) return true;
                  if(txt && typeof txt === 'object'){
                    if(typeof txt['#text'] === 'string' && re.test(txt['#text'])) return true;
                    if(typeof txt['$t'] === 'string' && re.test(txt['$t'])) return true;
                  }
                }
              }catch(e){}
            }
            try{ if(re.test(JSON.stringify(li))) return true; }catch(e){}
          }
        }
      }catch(e){}
    }
  }catch(e){}

  // Fallback: broad search across properties (same as original behavior)
  try{
    const s = JSON.stringify(props);
    if(re.test(s)) return true;
  }catch(e){
    try{
      for(const k in props){
        const v = props[k];
        if(typeof v === 'string' && re.test(v)) return true;
      }
    }catch(_){ }
  }
  return false;
}

// Render municipalities where the uploaded GPX contains FTF logs
function updateFTFList(points){
  const el = document.getElementById('ftfList');
  if(!el) return;
  el.innerHTML = '';
  if(!points || points.length === 0){ el.textContent = 'データなし'; return; }

  

  // Map: muni idx -> array of {pt, info}
  const ftfMap = new Map();
  // We will also collect a representative cache info for display
  function extractCacheInfo(props){
    if(!props) return { gc:null, name:null };
    let gc = null; let name = null;
    for(const k in props){ try{ const v = String(props[k]||''); const m = v.match(/(GC[0-9A-Z]+)/i); if(m){ gc = m[1].toUpperCase(); break; } }catch(e){} }
    if(props.desc) name = String(props.desc);
    else if(props.name) name = String(props.name);
    if(name && gc && name.toUpperCase().includes(gc)) name = null;
    if(!name){ for(const k in props){ try{ const v = String(props[k]||'').trim(); if(!v) continue; if(gc && v.toUpperCase().includes(gc)) continue; name = v; break; }catch(e){} } }
    if(name){ try{ name = name.replace(/\s*[（(]\s*by[\s\S]*?[)）]\s*$/i,''); name = name.replace(/\s+by\s+.*$/i,''); name = name.trim(); if(name.length===0) name = null; }catch(e){} }
    return { gc, name };
  }

  for(const p of points){
    try{
  const matched = isFTF2(p.props || p);
  if(!matched) continue;
      const found = getMuniForPoint(p.lat, p.lon);
      if(found && typeof found.idx !== 'undefined'){
        const arr = ftfMap.get(found.idx) || [];
        arr.push({ pt: p, info: extractCacheInfo(p.props || p) });
        ftfMap.set(found.idx, arr);
      }
    }catch(e){ /* ignore */ }
  }
  

  if(ftfMap.size === 0){ el.textContent = '該当なし'; return; }

  // Build table: 都道府県市区町村 | FTFキャッシュ (GC link + name)
  const table = document.createElement('table'); table.className = 'ftf-table'; table.style.width='100%';
  const thead = document.createElement('thead'); const hrow = document.createElement('tr');
  ['市区町村','FTF数'].forEach(h=>{ const th=document.createElement('th'); th.textContent = h; th.style.textAlign='left'; th.style.padding='6px 8px'; th.style.borderBottom='1px solid #e0e0e0'; hrow.appendChild(th); });
  thead.appendChild(hrow); table.appendChild(thead);
  const tbody = document.createElement('tbody');

  // Sort entries by FTF count desc, then municipality name asc
  const entries = Array.from(ftfMap.entries()).map(([idx, arr])=>({ idx, arr, feat: features[idx] }));
  entries.sort((a,b)=>{
    const ca = a.arr ? a.arr.length : 0;
    const cb = b.arr ? b.arr.length : 0;
    if(cb !== ca) return cb - ca; // descending by count
    const na = a.feat ? (extractNames(a.feat.properties).pref + extractNames(a.feat.properties).city) : '';
    const nb = b.feat ? (extractNames(b.feat.properties).pref + extractNames(b.feat.properties).city) : '';
    return na.localeCompare(nb, 'ja');
  });

  function esc(s){ if(s==null) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

  for(const ent of entries){
    try{
      const { idx, arr, feat } = ent;
      const { pref, city } = feat ? extractNames(feat.properties) : { pref:'(不明)', city:'(不明)'};
      const tr = document.createElement('tr');
      const tdName = document.createElement('td'); tdName.style.padding='8px'; tdName.textContent = `${pref}${city}`;
      const tdCaches = document.createElement('td'); tdCaches.style.padding='8px';
      // Show count of FTF caches for this municipality
  const count = arr.length || 0;
  tdCaches.textContent = `${count}`;
      tr.appendChild(tdName); tr.appendChild(tdCaches); tbody.appendChild(tr);
    }catch(e){ /* ignore row */ }
  }

  table.appendChild(tbody);
  el.appendChild(table);
}
// Configuration
// Note: municipaltopo.json is no longer used. Polygon sources come from ./polygon/ or manual upload.
const POLYGON_INDEX = './polygon/index.json'; // polygon/ に配置した index.json を優先して使用

// Helpers to extract prefecture and municipality names from feature properties
function extractNames(props){
  if(!props) return {pref:'(不明)', city:'(不明)'};
  let pref = null, city = null;
  // Try N03_001, N03_002, N03_003, N03_004 first
  if(props.N03_001) pref = props.N03_001;
  // 北海道は N03_002 が振興局なので pref は N03_001 のみ
  if(props.N03_001 === '北海道') {
    // ignore N03_002 for pref
  } else if(props.N03_002) {
    pref = props.N03_002;
  }
  // Use N03_004 primarily for municipality name (e.g. 小字等), fall back to N03_003 when N03_004 is missing
  if(props.N03_004) city = props.N03_004;
  else if(props.N03_003) city = props.N03_003;
  // Fallback: try other common keys
  if(!pref) {
    const prefKeys = ['PREF_NAME','pref_name','pref','都道府県名','PREF','NAME','name','NAME_1'];
    for(const k of prefKeys){ if(props[k]){ pref = props[k]; break; } }
  }
  if(!city) {
    const cityKeys = ['CITY_NAME','city','市区町村名','NAME_2','NAME_1','name'];
    for(const k of cityKeys){ if(props[k]){ city = props[k]; break; } }
  }
  // Fallback: look for keys containing prefecture/city kanji
  if(!pref){ for(const k in props) if(/都|道|府|県/.test(String(props[k]))) { pref = props[k]; break } }
  if(!city){ for(const k in props) if(/市|区|町|村/.test(String(props[k]))) { city = props[k]; break } }
  // Last resort: use any string property
  if(!pref){ for(const k in props) if(typeof props[k]==='string' && props[k].length>0){ pref = props[k]; break } }
  if(!city){ for(const k in props) if(typeof props[k]==='string' && props[k].length>0){ city = props[k]; break } }
  if(!pref) pref='(不明)';
  if(!city) city='(不明)';
  return {pref: String(pref), city: String(city)};
}

// Map setup
const map = L.map('map', { zoomControl:true }).setView([36.0, 138.0], 5);
// Base map left blank (white)
// L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
//   attribution: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors &amp; <a href="https://carto.com/">CARTO</a>',
//   maxZoom: 19
// }).addTo(map);

// Empty geoJSON layer placeholder
let muniLayer = L.geoJSON(null, { style: styleFeature, onEachFeature: onEachFeature }).addTo(map);

// Helper to replace the municipal layer safely (remove previous layer from map before adding new)
function setMuniLayer(objOrFeatures){
  const fc = (objOrFeatures && objOrFeatures.type === 'FeatureCollection') ? objOrFeatures : { type:'FeatureCollection', features: objOrFeatures || [] };
  try{ if(muniLayer && map.hasLayer(muniLayer)) map.removeLayer(muniLayer); }catch(e){ }
  muniLayer = L.geoJSON(fc, { style: styleFeature, onEachFeature: onEachFeature }).addTo(map);
  return muniLayer;
}

// rbush index for polygon bbox -> store {minX,minY,maxX,maxY, idx}
const RBushClass = (typeof window !== 'undefined') && (window.rbush || window.RBush || (window.rbush && window.rbush.default) || (window.RBush && window.RBush.default));
if(!RBushClass){ console.error('rbush is not available as a global (rbush / RBush). Please ensure the rbush script loaded.'); }
const tree = RBushClass ? new RBushClass() : { load: ()=>{}, search: ()=>[] };
let features = []; // array of GeoJSON features
let counts = new Map(); // key: idx, value: count
let unassigned = 0;

// Color scale placeholder
let colorScale = chroma.scale(['#fee5d9','#fcae91','#fb6a4a','#de2d26','#67000d']).domain([0,1]);

// Lightweight GPX->GeoJSON parser (used as a local shim when togeojson is unavailable)
function parseGPXPoints(xmlDoc){
  const features = [];
  // wpt elements
  const wpts = xmlDoc.getElementsByTagName('wpt');
  for(let i=0;i<wpts.length;i++){
    const w = wpts[i];
    const lat = parseFloat(w.getAttribute('lat'));
    const lon = parseFloat(w.getAttribute('lon'));
    const nameEl = w.getElementsByTagName('name')[0];
    const descEl = w.getElementsByTagName('desc')[0];
    const props = {};
    if(nameEl && nameEl.textContent) props.name = nameEl.textContent;
    if(descEl && descEl.textContent) props.desc = descEl.textContent;
    features.push({ type:'Feature', geometry:{ type:'Point', coordinates:[lon,lat] }, properties: props });
  }
  // trkpt elements
  const trkpts = xmlDoc.getElementsByTagName('trkpt');
  for(let i=0;i<trkpts.length;i++){
    const t = trkpts[i];
    const lat = parseFloat(t.getAttribute('lat'));
    const lon = parseFloat(t.getAttribute('lon'));
    const nameEl = t.getElementsByTagName('name')[0];
    const descEl = t.getElementsByTagName('desc')[0];
    const props = {};
    if(nameEl && nameEl.textContent) props.name = nameEl.textContent;
    if(descEl && descEl.textContent) props.desc = descEl.textContent;
    features.push({ type:'Feature', geometry:{ type:'Point', coordinates:[lon,lat] }, properties: props });
  }
  return { type:'FeatureCollection', features };
}

if(typeof window !== 'undefined' && !window.toGeoJSON && !window.togeojson){ window.toGeoJSON = { gpx: parseGPXPoints }; window.togeojson = window.toGeoJSON; }

// Load multiple polygon files from ./polygon/index.json (or directory listing)
async function loadPolygons(){
  let combined = [];
  try{
    const idxResp = await fetch(POLYGON_INDEX);
    if(idxResp.ok){
      const list = await idxResp.json();
      if(Array.isArray(list) && list.length>0){
        for(const fname of list){
          try{
            const resp = await fetch(`./polygon/${fname}`);
            if(!resp.ok) { console.warn('failed to fetch', fname); continue; }
            const doc = await resp.json();
            let fc = null;
            if(doc && doc.type === 'FeatureCollection') fc = doc;
            else if(doc && doc.objects){ const keys = Object.keys(doc.objects||{}); const obj = doc.objects[keys[0]]; fc = topojson.feature(doc, obj); }
            if(fc && fc.features) combined = combined.concat(fc.features);
          }catch(e){ console.warn('error loading polygon file', fname, e); }
        }
      }
    } else {
      console.warn('No polygon index found at', POLYGON_INDEX);
      try{
        const dirResp = await fetch('./polygon/');
        if(dirResp.ok){
          const text = await dirResp.text();
          const parser = new DOMParser();
          const doc = parser.parseFromString(text, 'text/html');
          const anchors = Array.from(doc.querySelectorAll('a'));
          const jsonFiles = anchors.map(a=>a.getAttribute('href')).filter(h=>h && h.match(/\.json$/i));
          for(const href of jsonFiles){
            const name = href.replace(/^\.\//, '').replace(/^\//, '');
            try{
              const resp = await fetch(`./polygon/${name}`);
              if(!resp.ok) { console.warn('failed to fetch', name); continue; }
              const doc = await resp.json();
              let fc = null;
              if(doc && doc.type === 'FeatureCollection') fc = doc;
              else if(doc && doc.objects){ const keys = Object.keys(doc.objects||{}); const obj = doc.objects[keys[0]]; fc = topojson.feature(doc, obj); }
              if(fc && fc.features) combined = combined.concat(fc.features);
            }catch(e){ console.warn('error loading polygon file from dir', href, e); }
          }
        }
      }catch(e){ console.warn('failed to fetch polygon directory listing', e); }
    }
  }catch(e){ console.warn('failed to fetch polygon index', e); }

  if(combined.length===0){
    // summary要素は削除済みのため、エラー表示はalertで代用
    alert('ポリゴンが見つかりません。polygon/ に .json ファイルを置いてください。');
    return;
  }

  // deduplicate features by geometry coordinates (avoid duplicates across files)
  const seen = new Set();
  const unique = [];
  for(const f of combined){
    try{
      const key = f.id || JSON.stringify(f.geometry && f.geometry.coordinates);
      if(!seen.has(key)){
        seen.add(key);
        unique.push(f);
      }
    }catch(e){ unique.push(f); }
  }

  // attach stable index to each unique feature so Leaflet layers can reference it reliably
  features = unique.map((f, i) => { if(!f.properties) f.properties = {}; f.properties.__idx = i; return f; });

  // register features to rbush
  const items = features.map((f, idx) => {
    const bbox = turf.bbox(f);
    return { minX: bbox[0], minY: bbox[1], maxX: bbox[2], maxY: bbox[3], idx };
  });
  tree.load(items);

  counts = new Map(features.map((f,i)=>[i,0]));

  // add to map (replace existing layer)
  setMuniLayer(features);
  try{ map.fitBounds(muniLayer.getBounds()); }catch(e){ console.warn('fitBounds failed', e); }

  // summary要素は削除済みのため、読み込み件数の表示は省略
  // update per-prefecture counts UI
  try{ updatePrefCounts(); }catch(e){ /* ignore */ }
  try{ updateMuniRanking(); }catch(e){ /* ignore */ }
  try{ updateChallenges(); }catch(e){ /* ignore */ }
}

// Auto-load polygons on start
loadPolygons();

// Update challenges UI based on current counts
function updateChallenges(){
  const targets = [
    {idFill:'challenge-shi-792-fill', idText:'challenge-shi-792-text', target:792, type:'市'},
    {idFill:'challenge-cho-743-fill', idText:'challenge-cho-743-text', target:743, type:'町'},
    {idFill:'challenge-mura-189-fill', idText:'challenge-mura-189-text', target:189, type:'村'},
    {idFill:'challenge-ku-23-fill', idText:'challenge-ku-23-text', target:23, type:'区'},
    {idFill:'challenge-seirei-20-fill', idText:'challenge-seirei-20-text', target:20, type:'政令'}
  ];

  // compute nationwide counts of distinct 市/町/村/区 where counts>0
  let gshi = 0, gcho = 0, gmura = 0, gku = 0;
  for(const [i,f] of features.entries()){
    try{
      const c = counts.get(i) || 0;
      if(c <= 0) continue;
      const { city } = extractNames(f.properties);
      const nm = String(city||'').trim();
      const last = nm.length ? nm.charAt(nm.length-1) : '';
      if(last === '市') gshi++;
      else if(last === '町') gcho++;
      else if(last === '村') gmura++;
      else if(last === '区') gku++;
      else gshi++; // fallback treat as 市
    }catch(e){}
  }

  // compute seirei-designated cities (政令指定都市) found among the features
  const seireiList = [
    '札幌市','仙台市','さいたま市','千葉市','横浜市','川崎市','相模原市','新潟市','静岡市','浜松市',
    '名古屋市','京都市','大阪市','堺市','神戸市','岡山市','広島市','北九州市','福岡市','熊本市'
  ];
  const seireiFound = new Set();
  for(const [i,f] of features.entries()){
    try{
      const c = counts.get(i) || 0;
      if(c <= 0) continue;
      const { city } = extractNames(f.properties);
      const nm = String(city||'').trim();
      // Count if the municipality name matches one of the seirei names
      for(const s of seireiList){ if(nm === s || nm.indexOf(s) !== -1){ seireiFound.add(s); break; } }
    }catch(e){}
  }
  const seireiCount = seireiFound.size;

  for(const t of targets){
    try{
      const fill = document.getElementById(t.idFill);
      const txt = document.getElementById(t.idText);
      if(!fill || !txt) continue;
  let cur = 0;
  if(t.type === '市') cur = gshi;
  else if(t.type === '町') cur = gcho;
  else if(t.type === '村') cur = gmura;
  else if(t.type === '区') cur = gku;
  else if(t.type === '政令') cur = seireiCount;
  else cur = gshi;
      const pct = (t.target > 0) ? Math.min(100, Math.round((cur / t.target) * 100)) : 0;
      fill.style.width = pct + '%';
      txt.textContent = `${cur} / ${t.target}`;
    }catch(e){/* ignore per-item */}
  }
}

// Styling function uses counts map
function styleFeature(feature){
  const idx = (feature && feature.properties && (typeof feature.properties.__idx !== 'undefined')) ? feature.properties.__idx : features.indexOf(feature);
  const c = counts.get(idx) || 0;
  // compute min/max and update domain for the color scale
  let vals = Array.from(counts.values());
  const max = Math.max(...vals, 1);
  colorScale.domain([0, max]);

  // Boundary stroke is always dark gray; fill shows intensity per specified buckets
  const stroke = '#333333';
  if(c===0) return { color: stroke, weight:0.5, fillColor:'#eeeeee', fillOpacity:1 };
  let fill;
  if(c <= 100) fill = 'rgb(235,129,100)';
  else if(c <= 1000) fill = 'rgb(209,71,56)';
  else fill = 'rgb(122,27,26)';
  return { color: stroke, weight:0.8, fillColor: fill, fillOpacity: 1 };
}

function onEachFeature(feature, layer){ layer.on({ mouseover: highlightFeature, mouseout: resetHighlight }); }

function highlightFeature(e){
  const layer = e.target;
  layer.setStyle({ weight:1.2, color:'#000' });
  const feat = layer.feature;
  const idx = (feat && feat.properties && (typeof feat.properties.__idx !== 'undefined')) ? feat.properties.__idx : features.indexOf(feat);
  const {pref, city} = extractNames(feat.properties);
  const c = counts.get(idx) || 0;
  layer.bindTooltip(`${pref} / ${city} / ${c} Finds`, {sticky:true}).openTooltip();
}
function resetHighlight(e){ muniLayer.resetStyle(e.target); e.target.closeTooltip(); }

// Update per-prefecture found/total counts and render into #prefCountsList
function updatePrefCounts(){
  const el = document.getElementById('prefCountsList');
  if(!el) return;
  // 集計: 都道府県ごとの発見市町村数と総数
  const stats = new Map();
  features.forEach((f, idx) => {
    const { pref } = extractNames(f.properties);
    const key = pref || '(不明)';
    const cur = stats.get(key) || { found: 0, total: 0 };
    cur.total += 1;
    if((counts.get(idx) || 0) > 0) cur.found += 1;
    stats.set(key, cur);
  });
  // 都道府県ごと発見数降順
  const entries = Array.from(stats.entries()).map(([k,v])=>({ pref:k, found:v.found, total:v.total }));
  entries.sort((a,b)=> b.found - a.found || a.pref.localeCompare(b.pref, 'ja'));
  el.innerHTML = '';
  // 都道府県選択状態を管理
  if(!window._selectedPref) window._selectedPref = null;
  for(const ent of entries){
    const div = document.createElement('div');
    // 色分け: 発見割合で背景色を変える
    const ratio = ent.total ? ent.found/ent.total : 0;
    let bg = '#eeeeee';
    if(ratio === 1) bg = '#de2d26';
    else if(ratio >= 0.75) bg = '#fb6a4a';
    else if(ratio >= 0.5) bg = '#fcae91';
    else if(ratio > 0) bg = '#fee5d9';
    div.style.background = bg;
    div.className = 'pref-item' + (ent.found === 0 ? ' empty' : '') + (window._selectedPref === ent.pref ? ' selected' : '');
    div.style.cursor = 'pointer';
    const nameSpan = document.createElement('span'); nameSpan.textContent = ent.pref;
    nameSpan.style.marginRight = '8px';
    const countSpan = document.createElement('span'); countSpan.className = 'count'; countSpan.textContent = `${ent.found}/${ent.total}`;
    div.appendChild(nameSpan); div.appendChild(countSpan);
    // クリックでその都道府県のみ表示・もう一度押すと解除
    div.addEventListener('click', () => {
      if(window._selectedPref === ent.pref){
        window._selectedPref = null;
        setMuniLayer(features);
        try{ if(features.length > 0) map.fitBounds(muniLayer.getBounds()); }catch(e){}
      }else{
        window._selectedPref = ent.pref;
        const filtered = features.filter(f => {
          const { pref } = extractNames(f.properties);
          return pref === ent.pref;
        });
        setMuniLayer(filtered);
        try{ if(filtered.length > 0) map.fitBounds(muniLayer.getBounds()); }catch(e){}
      }
      updatePrefCounts(); // 再描画でハイライト
    });
    el.appendChild(div);
  }
  // If a prefecture is selected, render its municipalities as badges under the prefecture list
  try{
    const prefMuniEl = document.getElementById('prefMuniList');
    if(prefMuniEl){
      prefMuniEl.innerHTML = '';
      if(window._selectedPref){
        const munis = features.map((f, idx) => ({ f, idx })).filter(o => extractNames(o.f.properties).pref === window._selectedPref);
        if(munis.length === 0){ prefMuniEl.textContent = '該当なし'; }
        else {
          // sort by found count desc, then name asc
          munis.sort((a,b)=>{
            const ca = counts.get(a.idx) || 0; const cb = counts.get(b.idx) || 0;
            if(cb !== ca) return cb - ca;
            const na = extractNames(a.f.properties).city || '';
            const nb = extractNames(b.f.properties).city || '';
            return na.localeCompare(nb, 'ja');
          });

          for(const item of munis){
            try{
              const f = item.f; const idx = item.idx;
              const { pref, city } = extractNames(f.properties);
              const c = counts.get(idx) || 0;
              // Use explicit buckets per user's request:
              // 1-100: rgb(235,129,100)
              // 101-1000: rgb(209,71,56)
              // 1001- : rgb(122,27,26)
              let bg = '#f5f5f5';
              let textColor = 'rgba(0,0,0,0.8)';
              if(c === 0){
                bg = '#f5f5f5';
                textColor = 'rgba(0,0,0,0.8)';
              } else if(c <= 100){
                bg = 'rgb(235,129,100)';
                textColor = 'rgba(0,0,0,0.8)';
              } else if(c <= 1000){
                bg = 'rgb(209,71,56)';
                textColor = '#ffffff';
              } else {
                bg = 'rgb(122,27,26)';
                textColor = '#ffffff';
              }

              const mdiv = document.createElement('div');
              mdiv.className = 'muni-item';
              mdiv.style.cursor = 'default';
              mdiv.style.background = bg;
              mdiv.style.color = textColor;
              mdiv.style.borderColor = (c === 0) ? '#eeeeee' : 'rgba(0,0,0,0.06)';

              const nameSpan = document.createElement('span'); nameSpan.textContent = city;
              const countSpan = document.createElement('span'); countSpan.className = 'count'; countSpan.textContent = `${c}F`;
              mdiv.appendChild(nameSpan); mdiv.appendChild(countSpan);
              // Intentionally do nothing on click for municipality badges per user preference.
              prefMuniEl.appendChild(mdiv);
            }catch(e){ /* ignore individual muni render errors */ }
          }
        }
      } else {
        prefMuniEl.innerHTML = '';
      }
    }
  }catch(e){ /* ignore pref muni rendering errors */ }

  // Render a descriptive sentence for the selected prefecture: counts of 市/町/村/区 with found caches
  try{
    const cardContainer = el && el.parentNode; // card-content
    if(cardContainer){
      let summaryEl = document.getElementById('prefSummarySentence');
      if(!summaryEl){
        summaryEl = document.createElement('p');
        summaryEl.id = 'prefSummarySentence';
        summaryEl.className = 'small';
        // visual spacing: ensure a blank line after the sentence
        summaryEl.style.marginBottom = '12px';
        // Insert the summary into #prefMuniList so it appears below the divider line
        const prefMuniEl2 = document.getElementById('prefMuniList');
        if(prefMuniEl2) prefMuniEl2.insertBefore(summaryEl, prefMuniEl2.firstChild);
        else cardContainer.insertBefore(summaryEl, el);
      }
      if(window._selectedPref){
        let shi = 0, cho = 0, mura = 0, ku = 0;
        for(const [i, f] of features.entries()){
          try{
            const { pref, city } = extractNames(f.properties);
            if(pref !== window._selectedPref) continue;
            const c = counts.get(i) || 0;
            if(c <= 0) continue; // only count municipalities where user has found caches
            // Classify by the last character of the municipality name (市/町/村/区)
            try{
              const nm = String(city || '').trim();
              const last = nm.length ? nm.charAt(nm.length - 1) : '';
              if(last === '市') shi++;
              else if(last === '町') cho++;
              else if(last === '村') mura++;
              else if(last === '区') ku++;
              else {
                // fallback: treat as 市
                shi++;
              }
            }catch(e){ shi++; }
          }catch(e){ /* ignore individual feature errors */ }
        }
        // Build sentence only including non-zero parts; hide the sentence if all are zero
        const parts = [];
        if(shi > 0) parts.push(`${shi}市`);
        if(cho > 0) parts.push(`${cho}町`);
        if(mura > 0) parts.push(`${mura}村`);
        if(ku > 0) parts.push(`${ku}区`);
        if(parts.length === 0){
          summaryEl.textContent = '';
          summaryEl.style.display = 'none';
        } else {
          summaryEl.style.display = 'block';
          // escape prefecture name for safe HTML insertion
          const esc = (s)=> String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
          const countsHtml = `<span class="summary-highlight">${parts.join('')}</span>`;
          summaryEl.innerHTML = `あなたは${esc(window._selectedPref)}の${countsHtml}でGeocacheを発見しています。`;
        }
      } else {
        summaryEl.textContent = '';
        summaryEl.style.display = 'none';
      }
    }
  }catch(e){ /* ignore summary rendering errors */ }
}

// GPX upload handling
document.getElementById('gpxfile').addEventListener('change', async (ev)=>{
  const f = ev.target.files[0];
  if(!f) return;
  const txt = await f.text();
  const parser = new DOMParser();
  const xml = parser.parseFromString(txt, 'application/xml');
  // Parse groundspeak logs directly from the GPX XML as a robust fallback
  function parseGroundspeakLogsFromXml(xmlDoc){
    const out = [];
    try{
      const wpts = xmlDoc.getElementsByTagName('wpt');
      for(let i=0;i<wpts.length;i++){
        const w = wpts[i];
        const lat = parseFloat(w.getAttribute('lat'));
        const lon = parseFloat(w.getAttribute('lon'));
        // find logs under this wpt: try prefixed tag first, then any 'logs' localName
        let logsParent = null;
        const pref = w.getElementsByTagName('groundspeak:logs');
        if(pref && pref.length>0) logsParent = pref[0];
        if(!logsParent){
          // fallback: search descendant nodes where localName === 'logs'
          const all = w.getElementsByTagName('*');
          for(let j=0;j<all.length;j++){
            const node = all[j];
            try{ if(node.localName === 'logs'){ logsParent = node; break; } }catch(e){}
          }
        }
        if(!logsParent) continue;
        const logNodes = logsParent.getElementsByTagName('groundspeak:log');
        const texts = [];
        if(logNodes && logNodes.length>0){
          for(let j=0;j<logNodes.length;j++){
            const ln = logNodes[j];
            const txtNodes = ln.getElementsByTagName('groundspeak:text');
            if(txtNodes && txtNodes.length>0){
              for(let k=0;k<txtNodes.length;k++){
                const tnode = txtNodes[k];
                if(tnode && tnode.textContent) texts.push(tnode.textContent);
              }
            } else {
              // fallback: find descendant with localName 'text'
              const all2 = ln.getElementsByTagName('*');
              for(let k=0;k<all2.length;k++){
                try{ if(all2[k].localName === 'text' && all2[k].textContent) texts.push(all2[k].textContent); }catch(e){}
              }
            }
          }
        } else {
          // if prefixed logs not found, try any 'log' localName
          const allLogs = logsParent.getElementsByTagName('*');
          for(let j=0;j<allLogs.length;j++){
            const node = allLogs[j];
            try{
              if(node.localName === 'log'){
                // find text children
                const all2 = node.getElementsByTagName('*');
                for(let k=0;k<all2.length;k++){
                  try{ if(all2[k].localName === 'text' && all2[k].textContent) texts.push(all2[k].textContent); }catch(e){}
                }
              }
            }catch(e){}
          }
        }
        if(texts.length>0) out.push({ lat, lon, texts });
      }
    }catch(e){ console.warn('parseGroundspeakLogsFromXml failed', e); }
    return out;
  }
  const gsLogsList = parseGroundspeakLogsFromXml(xml);
  
  // togeojson exposes different globals depending on build; try common ones.
  const TOGEO = (typeof window !== 'undefined') && (window.toGeoJSON || window.togeojson || window.TO_GEOJSON || null);
  let geo = null;
  if(TOGEO){
    
    if(typeof TOGEO.gpx === 'function') geo = TOGEO.gpx(xml);
    else if(typeof TOGEO === 'function') geo = TOGEO(xml);
  }
  if(!geo){ console.warn('toGeoJSON not available or failed — using fallback GPX parser'); geo = parseGPXPoints(xml); }
  const pts = geo.features.filter(fe=>fe.geometry && fe.geometry.type==='Point');
  
  const uniq = new Map();
  for(const p of pts){
    const [lon,lat] = p.geometry.coordinates;
    const id = (p.properties && (p.properties.sym || p.properties.name || `${lat},${lon}`));
    uniq.set(id, {lat, lon, props: p.properties});
  }
  const points = Array.from(uniq.values());
  
  // Attach parsed groundspeak logs (from XML) to the corresponding point.properties when coordinates match closely
  try{
    if(gsLogsList && gsLogsList.length>0){
      for(const p of points){
        try{
          for(const entry of gsLogsList){
            if(Math.abs(p.lat - entry.lat) < 0.00001 && Math.abs(p.lon - entry.lon) < 0.00001){
              if(!p.props) p.props = {};
              // mimic togeojson structure so isFTF2 can find it
              p.props['groundspeak:logs'] = { 'groundspeak:log': entry.texts.map(t=>({ 'groundspeak:text': String(t) })) };
              break;
            }
          }
        }catch(e){}
      }
    }
  }catch(e){ console.warn('error attaching gs logs to points', e); }
  // summary要素は削除済みのため、件数表示は省略

  counts = new Map(features.map((f,i)=>[i,0]));
  unassigned = 0;

  for(const pt of points){
    const buf = 0.00001;
    const candidates = tree.search({ minX: pt.lon-buf, minY: pt.lat-buf, maxX: pt.lon+buf, maxY: pt.lat+buf });
    let assigned = false;
    const turfPt = turf.point([pt.lon, pt.lat]);
    for(const cand of candidates){
      const f = features[cand.idx];
      if(turf.booleanPointInPolygon(turfPt, f)){
        counts.set(cand.idx, (counts.get(cand.idx)||0) + 1);
        assigned = true; break;
      }
    }
    if(!assigned) unassigned++;
  }
  

  // update layer style (replace existing layer)
  setMuniLayer(features);

  // summary要素は削除済みのため、未割当件数の表示は省略
  const __downloadBtn = document.getElementById('downloadCsv');
  if(__downloadBtn) __downloadBtn.disabled = false;
  try{ updatePrefCounts(); }catch(e){ }
  try{ updateMuniRanking(); }catch(e){ }
  try{ updateExtremes(points); }catch(e){ }
  try{ updateOneFList(points); }catch(e){ }
  try{ updateFTFList(points); }catch(e){ }
  try{ updateChallenges(); }catch(e){ }
});

// polygon upload removed: polygons are loaded from ./polygon/ by default

// クリアボタン・summaryは削除済み
// if(document.getElementById('clearBtn')){
//   document.getElementById('clearBtn').addEventListener('click', ()=>{
//     counts = new Map(features.map((f,i)=>[i,0])); unassigned = 0;
//     setMuniLayer(features);
//     // document.getElementById('summary').textContent = 'クリアしました';
//     document.getElementById('downloadCsv').disabled = true;
//     document.getElementById('gpxfile').value = '';
//     try{ updatePrefCounts(); }catch(e){}
//     try{ updateMuniRanking(); }catch(e){}
//   });
// }

// CSV download
const __downloadBtn2 = document.getElementById('downloadCsv');
if(__downloadBtn2){
  __downloadBtn2.addEventListener('click', ()=>{
    const rows = [['都道府県','市区町村','件数']];
    features.forEach((f, idx)=>{
      const {pref, city} = extractNames(f.properties);
      const c = counts.get(idx) || 0;
      rows.push([pref, city, String(c)]);
    });
    rows.push(['(未割当)', '', String(unassigned)]);
    const csv = rows.map(r=>r.map(cell=>`"${String(cell).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'municipal_counts.csv'; a.click(); URL.revokeObjectURL(url);
  });
}
