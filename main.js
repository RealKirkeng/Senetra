import './style.css';
import L from 'leaflet';
import osmtogeojson from 'osmtogeojson';

// ─── Config ──────────────────────────────────────────────────────────────────
const MAP_CENTER   = [59.6600, 10.7450]; // NMBU farmland, Ås, Norway
const INITIAL_ZOOM = 13;
const MIN_ZOOM     = 13;

// ─── State ───────────────────────────────────────────────────────────────────
let map, geoJsonLayer, baseTile, satelliteTile, darkTile;
let fetching      = false;
let activeId      = null;
let satelliteMode = false;
let nightMode     = false;
let showWaterways = true;
const cache       = new Map();
const waterwayFeatures = [];
let lastZoom       = INITIAL_ZOOM;

// ─── UI refs ─────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const ui = {
  landing     : $('landing-page'),
  dashboard   : $('dashboard'),
  enterBtn    : $('enter-dashboard-btn'),
  mobBtn      : $('mob-sidebar-btn'),
  closeBtn    : $('mobile-toggle'),
  searchBar   : $('search-bar'),
  sidebar     : $('sidebar'),
  overlay     : $('loading-overlay'),
  emptyState  : $('empty-state'),
  dataState   : $('data-state'),
  statusBar   : $('status-bar'),
  zoomWarn    : $('zoom-warning'),
  rescanBtn   : $('rescan-btn'),
  rescanIcon  : $('rescan-icon'),
  subtitle    : $('sidebar-subtitle'),
  // farm header
  farmName    : $('farm-name'),
  farmTypeBadge : $('farm-type-badge'),
  farmCropBadge : $('farm-crop-badge'),
  farmAreaBadge : $('farm-area-badge'),
  riskBadge   : $('risk-badge'),
  riskRec     : $('risk-recommendation'),
  weatherCodeBadge: $('weather-code-badge'),
  // metrics
  moisture    : $('metric-moisture'),
  moistureBar : $('moisture-bar'),
  temp        : $('metric-temp'),
  wind        : $('metric-wind'),
  rainTotal   : $('metric-rain-total'),
  humidity    : $('metric-humidity'),
  runoffScore : $('metric-runoff-score'),
  // timeline
  rainChart   : $('rain-chart'),
  timeline    : $('weather-timeline'),
  advisory    : $('spraying-advisory'),
  coords      : $('farm-coords'),
  // new panels
  historicalChart : $('historical-chart'),
  histLabelStart  : $('hist-label-start'),
  proximityAlert  : $('proximity-alert'),
  safeWindow      : $('safe-window'),
  // stats strip
  stripFarms  : $('strip-farms'),
  stripL5     : $('strip-l5'),
  stripL4     : $('strip-l4'),
  stripL3     : $('strip-l3'),
  stripL2     : $('strip-l2'),
  stripL1     : $('strip-l1'),
  stripTime   : $('strip-time'),
  // map controls
  layerToggleBtn   : $('layer-toggle-btn'),
  layerToggleLabel : $('layer-toggle-label'),
  modeToggleBtn    : $('mode-toggle-btn'),
  modeToggleLabel  : $('mode-toggle-label'),
  waterwayToggleBtn: $('waterway-toggle-btn'),
};

// ─── LANDING → DASHBOARD routing ─────────────────────────────────────────────
ui.enterBtn.addEventListener('click', () => {
  ui.landing.style.opacity = '0';
  ui.landing.style.pointerEvents = 'none';
  setTimeout(() => {
    ui.landing.classList.add('hidden');
    ui.dashboard.classList.remove('hidden');
    ui.dashboard.style.display = 'flex';
    requestAnimationFrame(() => initMap());
  }, 400);
});

ui.landing.style.transition = 'opacity 0.4s ease';

// ─── MAP INIT ──────────────────────────────────────────────────────────────────────────
function initMap() {
  if (map) return;

  map = L.map('map-container', { zoomControl: true }).setView(MAP_CENTER, INITIAL_ZOOM);

  baseTile = L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    { attribution: '© OpenStreetMap © CARTO', maxZoom: 19 }
  ).addTo(map);

  darkTile = L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    { attribution: '© OpenStreetMap © CARTO', maxZoom: 19 }
  );

  satelliteTile = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { attribution: 'Tiles © Esri — Source: Esri, USGS, AeroGRID', maxZoom: 19 }
  );

  geoJsonLayer = L.geoJSON(null, {
    style       : featureStyle,
    onEachFeature: bindFeature
  }).addTo(map);

  map.on('moveend', onMove);
  
  // Search listener
  if (ui.searchBar) {
    ui.searchBar.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') searchLocation(e.target.value);
    });
  }

  ui.mobBtn.addEventListener('click', () =>
    ui.sidebar.classList.toggle('translate-x-[120%]'));
  if (ui.closeBtn) {
    ui.closeBtn.addEventListener('click', () =>
      ui.sidebar.classList.add('translate-x-[120%]'));
  }
  ui.rescanBtn.addEventListener('click', rescan);

  // Toggles
  ui.layerToggleBtn.addEventListener('click', () => {
    satelliteMode = !satelliteMode;
    updateMapTiles();
  });
 
  ui.modeToggleBtn.addEventListener('click', () => {
    nightMode = !nightMode;
    updateMapTiles();
  });
 
  ui.waterwayToggleBtn.addEventListener('click', () => {
    showWaterways = !showWaterways;
    ui.waterwayToggleBtn.classList.toggle('active', showWaterways);
    geoJsonLayer.setStyle(featureStyle);
  });
 
  onMove();
}
 
function updateMapTiles() {
  const mapContainer = document.getElementById('map-container');
  mapContainer.style.opacity = '0.5';
  
  setTimeout(() => {
    [baseTile, darkTile, satelliteTile].forEach(t => {
      if (map.hasLayer(t)) map.removeLayer(t);
    });
 
    let target;
    if (satelliteMode) {
      target = satelliteTile;
    } else if (nightMode) {
      target = darkTile;
    } else {
      target = baseTile;
    }
    
    target.addTo(map);
    target.bringToBack();
    
    // Update UI labels and icons
    ui.layerToggleBtn.classList.toggle('active', satelliteMode);
    ui.modeToggleBtn.classList.toggle('active', nightMode);
    
    ui.layerToggleLabel.textContent = satelliteMode ? 'Standard Map' : 'Satellite View';
    ui.layerToggleBtn.querySelector('.toggle-icon').textContent = satelliteMode ? '🗺️' : '🛰️';
    
    ui.modeToggleLabel.textContent = nightMode ? 'Day Mode' : 'Night Mode';
    ui.modeToggleBtn.querySelector('.toggle-icon').textContent = nightMode ? '☀️' : '🌙';
    
    mapContainer.style.opacity = '1';
  }, 100);
}

// ─── MAP MOVE ────────────────────────────────────────────────────────────────
async function onMove() {
  const zoom = map.getZoom();
  
  if (zoom < MIN_ZOOM) {
    ui.zoomWarn.classList.remove('hidden');
    ui.statusBar.textContent = 'Zoom in further to load agricultural sectors';
  } else {
    ui.zoomWarn.classList.add('hidden');
    // If we just zoomed back in, trigger a scan
    if (lastZoom < MIN_ZOOM && !fetching) {
      fetchArea();
    }
  }
  
  lastZoom = zoom;
}

function rescan() {
  cache.clear();
  geoJsonLayer.clearLayers();
  activeId = null;
  showEmpty();
  fetchArea();
}

// ─── OVERPASS FETCH ──────────────────────────────────────────────────────────
async function fetchArea() {
  fetching = true;
  ui.overlay.classList.add('active');
  spinRescan(true);

  const b = map.getBounds();
  const bbox = `${b.getSouth()},${b.getWest()},${b.getNorth()},${b.getEast()}`;

  const query = `[out:json][timeout:25];
(
  way["landuse"="farmland"](${bbox});
  relation["landuse"="farmland"](${bbox});
  way["waterway"~"^(river|stream|canal|drain)$"](${bbox});
  way["natural"="water"](${bbox});
  relation["natural"="water"](${bbox});
);
out body; >; out skel qt;`;

  try {
    const res  = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST', body: query
    });
    if (!res.ok) throw new Error('Overpass error ' + res.status);

    const osm  = await res.json();
    const geo  = osmtogeojson(osm);

    await fetchWeatherBatch(geo.features);

    geoJsonLayer.clearLayers();
    geoJsonLayer.addData(geo);

    const farms = geo.features.filter(isFarm);
    const stats = computeStats(farms);
    ui.statusBar.textContent =
      `${farms.length} farm sectors · ${stats.l5} critical · ${stats.l4} high · ${stats.l3} mod · ${stats.l2} low · ${stats.l1} min`;
    if (ui.stripFarms) ui.stripFarms.textContent = farms.length;
    if (ui.stripL5) ui.stripL5.textContent = stats.l5;
    if (ui.stripL4) ui.stripL4.textContent = stats.l4;
    if (ui.stripL3) ui.stripL3.textContent = stats.l3;
    if (ui.stripL2) ui.stripL2.textContent = stats.l2;
    if (ui.stripL1) ui.stripL1.textContent = stats.l1;

    if (activeId) rehighlight();
  } catch (e) {
    console.error(e);
    ui.statusBar.textContent = 'Data fetch failed — check connection';
  } finally {
    fetching = false;
    ui.overlay.classList.remove('active');
    spinRescan(false);
  }
}

// ─── WEATHER BATCH (Open-Meteo) ───────────────────────────────────────────────
async function fetchWeatherBatch(features) {
  const farms = features.filter(f => !cache.has(f.id) && isFarm(f));
  const chunks = [];
  for (let i = 0; i < farms.length; i += 8) chunks.push(farms.slice(i, i + 8));
  for (const chunk of chunks) {
    await Promise.all(chunk.map(fetchWeatherFor));
  }
}

async function fetchWeatherFor(feature) {
  const id  = feature.id;
  if (cache.has(id)) return;

  const pt  = centroid(feature);
  if (!pt) return;
  const [lat, lon] = pt;

  try {
    const url = `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lon}` +
      `&hourly=precipitation,soil_moisture_3_to_9cm,precipitation_probability` +
      `&current=temperature_2m,wind_speed_10m,weather_code,relative_humidity_2m` +
      `&past_days=7&forecast_days=2&timezone=auto`;

    const data = await (await fetch(url)).json();
    if (!data?.hourly) return;

    const precip   = data.hourly.precipitation          || [];
    const moisture = data.hourly.soil_moisture_3_to_9cm || [];
    const prob     = data.hourly.precipitation_probability || [];
    const times    = data.hourly.time                   || [];

    // Separate past 7 days (168h) from forecast (next 48h)
    const pastPrecip    = precip.slice(0, 168);
    const forecastPrec  = precip.slice(168);
    const forecastProb  = prob.slice(168);
    const forecastMoist = moisture.slice(168);
    const forecastTimes = times.slice(168);

    // Daily buckets for 7-day history
    const historicalRain = [];
    for (let d = 0; d < 7; d++) {
      const slice = pastPrecip.slice(d * 24, d * 24 + 24);
      historicalRain.push(slice.reduce((a, b) => a + (b || 0), 0));
    }

    const totalRain = forecastPrec.reduce((a, b) => a + (b || 0), 0);
    const curMoist  = moisture[168] || moisture[0] || 0;
    const curTemp   = data.current?.temperature_2m   ?? null;
    const curWind   = data.current?.wind_speed_10m   ?? null;
    const curHum    = data.current?.relative_humidity_2m ?? null;
    const wCode     = data.current?.weather_code     ?? 0;

    // 12-hour forecast buckets
    const timeline = [0, 1, 2, 3].map(i => {
      const slice = forecastPrec.slice(i * 12, i * 12 + 12);
      const sum   = slice.reduce((a, b) => a + (b || 0), 0);
      const maxP  = Math.max(...(forecastProb.slice(i * 12, i * 12 + 12)));
      const t     = forecastTimes[i * 12] ? new Date(forecastTimes[i * 12]) : null;
      const label = i === 0 ? 'Next 12h'
                  : i === 1 ? '12–24h'
                  : t ? t.toLocaleDateString('en-GB', { weekday:'short', hour:'numeric' }) + ' +12h'
                  : `${i * 12}–${i * 12 + 12}h`;
      return { label, sum, maxP, hours: slice };
    });

    // Risk level
    const risk = calculateRiskLevel(curMoist, totalRain);

    // Farm metadata — osmtogeojson puts tags directly on properties
    const tags    = getTags(feature);
    const name    = tags.name || null;
    const crop    = tags.crop || tags.produce || tags['crop:type'] || null;
    const landuse = tags.landuse || 'farmland';
    const area    = estimateArea(feature);

    // Runoff risk score 0-100
    const runoffScore = Math.min(100, Math.round(
      (curMoist / 0.60) * 45 +
      (Math.min(totalRain, 30) / 30) * 35 +
      ((curHum ?? 50) / 100) * 20
    ));

    cache.set(id, {
      lat, lon, totalRain, curMoist, curTemp, curWind, curHum, wCode,
      timeline, risk, runoffScore, historicalRain,
      name, crop, landuse, area
    });
  } catch (e) {
    console.warn('Weather fetch failed for', id, e.message);
  }
}

// ─── STYLES ──────────────────────────────────────────────────────────────────────────
function featureStyle(f) {
  const tags = getTags(f);

  // Waterway / water body
  if (tags.waterway || tags.natural === 'water') {
    if (!showWaterways) return { opacity: 0, fillOpacity: 0, weight: 0 };
    const isRiver = tags.waterway === 'river';
    return {
      color     : '#2563eb',
      weight    : isRiver ? 3 : 1.5,
      opacity   : 0.75,
      fillColor : '#60a5fa',
      fillOpacity: 0.35,
      dashArray : isRiver ? null : '4 3'
    };
  }

  // Farm
  const d   = cache.get(f.id);
  const risk = d?.risk || calculateRiskLevel(0, 0);
  const active = f.id === activeId;
  const fill = risk.color;

  return {
    fillColor  : fill,
    fillOpacity: active ? 0.82 : 0.58,
    color      : active ? '#1e293b' : 'rgba(255,255,255,0.7)',
    weight     : active ? 2.5 : 1,
    dashArray  : active ? null : '4 3'
  };
}

// ─── PER-FEATURE EVENTS ───────────────────────────────────────────────────────
function bindFeature(f, layer) {
  const tags = getTags(f);

  if (isFarm(f)) {
    layer.on('click', () => {
      activeId = f.id;
      geoJsonLayer.setStyle(featureStyle);
      layer.bringToFront();
      populateSidebar(f.id);
    });

    // Hover tooltip (quick preview)
    layer.on('mouseover', function(e) {
      const d = cache.get(f.id);
      if (!d) return;
      const label = d.name || 'Farmland';
      const col   = d.risk.color;
      this.bindTooltip(
        `<div style="font-family:Inter,sans-serif;font-size:12px;line-height:1.4">
          <div style="font-weight:700;color:#0f172a">${label}</div>
          <div style="display:flex;align-items:center;gap:6px;margin-top:4px">
            <span style="width:8px;height:8px;border-radius:50%;background:${col};display:inline-block"></span>
            <span style="font-weight:600;color:${col}">${d.risk.riskText} RISK</span>
          </div>
          <div style="color:#64748b;margin-top:2px">Rain 48h: <b>${d.totalRain.toFixed(1)} mm</b></div>
          <div style="color:#64748b">Soil moisture: <b>${d.curMoist.toFixed(3)} m³/m³</b></div>
          <div style="color:#94a3b8;font-size:11px;margin-top:4px">Click for full details</div>
        </div>`,
        { sticky: true, opacity: 1, className: '' }
      ).openTooltip(e.latlng);
    });
    layer.on('mouseout', function() { this.closeTooltip(); });
  }

  if (tags.waterway || tags.natural === 'water') {
    const wname = tags.name || (tags.waterway ? capitalise(tags.waterway) : 'Water body');
    layer.bindTooltip(wname, {
      sticky: true, className: 'waterway-tip', opacity: 1
    });
  }
}

// ─── SIDEBAR ──────────────────────────────────────────────────────────────────
function populateSidebar(id) {
  const d = cache.get(id);
  if (!d) { showEmpty(); return; }

  ui.emptyState.classList.add('hidden');
  ui.dataState.classList.remove('hidden');

  // Farm header
  ui.farmName.textContent = d.name || 'Unnamed Sector';
  ui.farmTypeBadge.textContent = capitalise(d.landuse);
  ui.farmCropBadge.textContent = d.crop ? `🌾 ${capitalise(d.crop)}` : 'Crop unknown';
  ui.farmCropBadge.style.display = '';
  if (d.area) {
    ui.farmAreaBadge.textContent = d.area < 10000
      ? `${d.area.toFixed(0)} m²`
      : `${(d.area / 10000).toFixed(1)} ha`;
    ui.farmAreaBadge.style.display = '';
  } else { ui.farmAreaBadge.style.display = 'none'; }

  // Weather code badge
  const wmo = wmoLabel(d.wCode);
  ui.weatherCodeBadge.textContent = `${wmo.icon} ${wmo.label}`;

  // Risk badge
  const rObj = d.risk;
  ui.riskBadge.className = `ml-3 shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wide border ${rObj.bg} ${rObj.textCls} ${rObj.border}`;
  ui.riskBadge.textContent = rObj.riskText;

  ui.riskRec.textContent = rObj.rec;
  ui.riskRec.className   = `text-xs mt-2.5 leading-relaxed font-medium ${rObj.recCls}`;

  // Metrics
  ui.moisture.textContent  = d.curMoist.toFixed(3);
  ui.temp.textContent      = d.curTemp !== null ? d.curTemp.toFixed(1) : '--';
  ui.wind.textContent      = d.curWind !== null ? d.curWind.toFixed(1) : '--';
  ui.rainTotal.textContent = d.totalRain.toFixed(1);
  ui.humidity.textContent  = d.curHum !== null ? Math.round(d.curHum) : '--';
  ui.runoffScore.textContent = d.runoffScore;
  const scoreEl = ui.runoffScore;
  scoreEl.className = `text-xl font-bold ${d.runoffScore > 70 ? 'text-red-600' : d.runoffScore > 40 ? 'text-amber-500' : 'text-green-600'}`;

  // Moisture bar (0–0.60 scale)
  const mPct = Math.min((d.curMoist / 0.60) * 100, 100);
  ui.moistureBar.style.width = `${mPct}%`;
  ui.moistureBar.className   = `h-full rounded-full transition-all duration-500 ${
    d.curMoist > 0.50 ? 'bg-red-500' : d.curMoist > 0.40 ? 'bg-orange-500' : d.curMoist > 0.30 ? 'bg-yellow-500' : 'bg-lime-500'
  }`;

  // Rain mini-chart (forecast)
  const maxHourly = Math.max(...d.timeline.map(t => Math.max(...t.hours, 0.01)));
  ui.rainChart.innerHTML = d.timeline.flatMap(t =>
    t.hours.slice(0, 6).map((v, i) => {
      const h = Math.max(Math.round(((v || 0) / maxHourly) * 56), 2);
      const cl = v > 0 ? 'has-rain' : '';
      return `<div class="flex-1 flex flex-col justify-end">
        <div class="rain-bar ${cl}" style="height:${h}px" title="${v?.toFixed(1)} mm"></div>
      </div>`;
    })
  ).join('');

  // Timeline rows
  ui.timeline.innerHTML = '';
  d.timeline.forEach(row => {
    const intensity = row.sum > 10 ? 'text-red-600 font-bold'
                    : row.sum > 2  ? 'text-blue-600 font-semibold'
                    : 'text-slate-500';
    const bar = row.sum > 0
      ? `<div class="mt-1.5 h-1 rounded-full bg-slate-100 overflow-hidden">
           <div class="h-full rounded-full bg-blue-400 transition-all" style="width:${Math.min(row.sum/20*100,100)}%"></div>
         </div>`
      : '';
    const div = document.createElement('div');
    div.className = 'timeline-row select-none';
    div.innerHTML = `
      <div class="flex justify-between items-center">
        <span class="text-xs text-slate-500">${row.label}</span>
        <div class="flex items-center gap-2">
          <span class="text-xs ${intensity}">${row.sum.toFixed(1)} mm</span>
          <span class="text-xs text-slate-400">${row.maxP}% prob</span>
          <svg class="w-3 h-3 text-slate-300 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
          </svg>
        </div>
      </div>
      ${bar}
      <div class="timeline-detail mt-2 pt-2 border-t border-slate-100">
        <div class="flex gap-1 flex-wrap">
          ${row.hours.map((h, i) => `<div class="text-center"><div class="text-xs font-mono ${h>0?'text-blue-600':'text-slate-400'}">${(h||0).toFixed(1)}</div><div class="text-slate-300 text-xs">${i}h</div></div>`).join('')}
        </div>
      </div>
    `;
    div.addEventListener('click', () => {
      div.classList.toggle('expanded');
      div.querySelector('svg').style.transform =
        div.classList.contains('expanded') ? 'rotate(180deg)' : '';
    });
    ui.timeline.appendChild(div);
  });

  // Historical 7-day rain bars
  if (d.historicalRain && d.historicalRain.length) {
    const maxH = Math.max(...d.historicalRain, 0.01);
    ui.historicalChart.innerHTML = d.historicalRain.map((v, i) => {
      const h = Math.max(Math.round((v / maxH) * 40), 2);
      const col = v > 10 ? '#ef4444' : v > 3 ? '#3b82f6' : '#bfdbfe';
      const day = new Date();
      day.setDate(day.getDate() - (6 - i));
      const lbl = day.toLocaleDateString('en-GB', { weekday: 'short' });
      return `<div class="flex-1 flex flex-col items-center justify-end gap-0.5" title="${lbl}: ${v.toFixed(1)} mm">
        <div style="height:${h}px;background:${col};width:100%;border-radius:2px 2px 0 0"></div>
      </div>`;
    }).join('');
    const start = new Date(); start.setDate(start.getDate() - 6);
    ui.histLabelStart.textContent = start.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  // Waterway proximity alert
  const nearWaterway = checkWaterwayProximity(d.lat, d.lon);
  if (nearWaterway) {
    ui.proximityAlert.innerHTML = `<div class="proximity-alert">
      <span style="font-size:18px">⚠️</span>
      <div><b>Waterway within ~200 m</b><br>Elevated runoff pathway detected. Any fertilizer applied here has a high probability of reaching the nearby watercourse if conditions are wet.</div>
    </div>`;
  } else {
    ui.proximityAlert.innerHTML = `<div class="proximity-alert proximity-safe">
      <span style="font-size:18px">✅</span>
      <div><b>No immediate waterway detected</b><br>No watercourse found within ~200 m. Standard runoff precautions apply.</div>
    </div>`;
  }

  // Safe fertilizer window
  const safeWindow = findNextSafeWindow(d.timeline, d.curMoist, d.curWind);
  if (safeWindow) {
    ui.safeWindow.innerHTML = `<div class="safe-window-card">
      <div class="text-xs font-bold text-green-800 mb-1">🗓️ ${safeWindow.label}</div>
      <div class="text-xs text-green-700">Rain &lt; 1 mm · Soil moisture acceptable · Wind &lt; 15 km/h</div>
    </div>`;
  } else {
    ui.safeWindow.innerHTML = `<div class="safe-window-card safe-window-none">
      <div class="text-xs font-bold text-red-800 mb-1">🚫 No safe window in next 48 h</div>
      <div class="text-xs text-red-700">Conditions remain unfavourable. Monitor again tomorrow.</div>
    </div>`;
  }

  // Spraying advisory
  const wind    = d.curWind ?? 0;
  const windOk  = wind < 15;
  const tempOk  = (d.curTemp ?? 10) > 2 && (d.curTemp ?? 10) < 30;
  const moistOk = d.curMoist <= 0.30;
  const rainOk  = d.totalRain <= 15;
  const checks = [
    [windOk,  `Wind ${wind.toFixed(1)} km/h`, windOk  ? '< 15 km/h threshold' : 'Too windy — fertilizer drift risk'],
    [tempOk,  `Temp ${d.curTemp?.toFixed(1) ?? '--'}°C`, tempOk  ? '2–30°C optimal range' : 'Temperature outside optimal range'],
    [moistOk, `Soil ${d.curMoist.toFixed(3)} m³/m³`, moistOk ? 'Field capacity acceptable' : 'Field too saturated'],
    [rainOk,  `Rain ${d.totalRain.toFixed(1)} mm 48h`, rainOk  ? 'Precipitation within limits' : 'Rain forecast too high'],
  ];
  const overall = checks.every(c => c[0]);
  ui.advisory.className = `rounded-xl border p-3 text-xs leading-relaxed ${
    overall ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'
  }`;
  ui.advisory.innerHTML = `
    <div class="font-semibold mb-2 ${overall ? 'text-green-700' : 'text-red-700'}">
      ${overall ? '✅ Conditions suitable for spraying' : '🚫 Not recommended for spraying'}
    </div>
    <ul class="space-y-1">
      ${checks.map(([ok, label, note]) => `
        <li class="flex items-start gap-1.5">
          <span>${ok ? '✓' : '✗'}</span>
          <span class="${ok ? 'text-slate-600' : 'text-red-600'}"><b>${label}</b> — ${note}</span>
        </li>
      `).join('')}
    </ul>
  `;

  // Coordinates
  ui.coords.textContent = `${d.lat.toFixed(5)}° N, ${d.lon.toFixed(5)}° E`;
  ui.sidebar.classList.remove('translate-x-[120%]');
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function getTags(f) { return f.properties || {}; }

function isFarm(f) {
  const t = getTags(f);
  return t.landuse === 'farmland' || t.landuse === 'farmyard' || t.landuse === 'meadow';
}

function centroid(f) {
  try {
    if (f.geometry.type === 'Polygon') {
      const ring = f.geometry.coordinates[0];
      return [ring.reduce((s,c)=>s+c[1],0)/ring.length, ring.reduce((s,c)=>s+c[0],0)/ring.length];
    }
    if (f.geometry.type === 'MultiPolygon') {
      const ring = f.geometry.coordinates[0][0];
      return [ring.reduce((s,c)=>s+c[1],0)/ring.length, ring.reduce((s,c)=>s+c[0],0)/ring.length];
    }
    if (f.geometry.type === 'Point') return [f.geometry.coordinates[1], f.geometry.coordinates[0]];
    return null;
  } catch { return null; }
}

function estimateArea(f) {
  try {
    if (f.geometry.type !== 'Polygon') return null;
    const ring = f.geometry.coordinates[0];
    const lat  = ring[0][1] * Math.PI / 180;
    const mPerDegLon = 111320 * Math.cos(lat);
    let area = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      const x1 = ring[i][0]*mPerDegLon,   y1 = ring[i][1]*111320;
      const x2 = ring[i+1][0]*mPerDegLon, y2 = ring[i+1][1]*111320;
      area += (x1*y2 - x2*y1);
    }
    return Math.abs(area / 2);
  } catch { return null; }
}

function capitalise(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g,' ') : '';
}

function showEmpty() {
  ui.emptyState.classList.remove('hidden');
  ui.dataState.classList.add('hidden');
}

function rehighlight() {
  geoJsonLayer.setStyle(featureStyle);
  geoJsonLayer.eachLayer(l => { if (l.feature?.id === activeId) l.bringToFront(); });
}

function computeStats(farms) {
  const counts = { l1: 0, l2: 0, l3: 0, l4: 0, l5: 0 };
  farms.forEach(f => {
    const d = cache.get(f.id);
    if (!d) return;
    counts['l' + d.risk.level]++;
  });
  return counts;
}

function spinRescan(on) {
  ui.rescanIcon.style.animation = on ? 'spin 0.8s linear infinite' : '';
}

// WMO weather code → label + emoji
function wmoLabel(code) {
  if (code === 0) return { icon: '☀️', label: 'Clear sky' };
  if (code <= 2)  return { icon: '⛅', label: 'Partly cloudy' };
  if (code === 3) return { icon: '☁️', label: 'Overcast' };
  if (code <= 49) return { icon: '🌫️', label: 'Fog' };
  if (code <= 57) return { icon: '🌧️', label: 'Drizzle' };
  if (code <= 67) return { icon: '🌧️', label: 'Rain' };
  if (code <= 77) return { icon: '❄️', label: 'Snow' };
  if (code <= 82) return { icon: '🌦️', label: 'Rain showers' };
  if (code <= 86) return { icon: '🌨️', label: 'Snow showers' };
  if (code <= 99) return { icon: '⛈️', label: 'Thunderstorm' };
  return { icon: '🌡️', label: `Code ${code}` };
}

// Find first 12h block with safe conditions in forecast timeline
function findNextSafeWindow(timeline, curMoist, curWind) {
  const wind = curWind ?? 0;
  for (const block of timeline) {
    const rainOk  = block.sum < 1;
    const moistOk = curMoist < 0.07;
    const windOk  = wind < 15;
    if (rainOk && moistOk && windOk) {
      return { label: block.label };
    }
  }
  return null;
}

// Nominatim Search
async function searchLocation(query) {
  if (!query) return;
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
    const data = await res.json();
    if (data && data.length > 0) {
      const { lat, lon } = data[0];
      map.setView([lat, lon], INITIAL_ZOOM);
      // Brief delay to allow map to move before scanning
      setTimeout(() => fetchArea(), 800);
    }
  } catch (e) {
    console.error('Search failed', e);
  }
}

// Check if farm centroid is within ~200m of any loaded waterway centroid
function checkWaterwayProximity(lat, lon) {
  const DEG_200M = 0.0018; // ~200m in degrees
  for (const f of waterwayFeatures) {
    const pt = centroid(f);
    if (!pt) continue;
    const dlat = pt[0] - lat, dlon = pt[1] - lon;
    if (Math.sqrt(dlat*dlat + dlon*dlon) < DEG_200M) return true;
  }
  return false;
}

// Calculate 5-level risk based on Soil Moisture (m³/m³) and Rainfall (mm)
function calculateRiskLevel(sm, rain) {
  if ((sm > 0.50 && rain > 20) || (sm > 0.40 && rain > 40)) {
    return { level: 5, riskText: 'CRITICAL', color: '#ef4444', bg: 'bg-red-100', textCls: 'text-red-700', border: 'border-red-200', recCls: 'text-red-800', rec: '⛔ Extreme runoff danger. Soil is completely waterlogged and heavy rain is incoming. Fertilizer will immediately wash into waterways.' };
  }
  if ((sm > 0.50 && rain <= 20) || (sm > 0.40 && sm <= 0.50 && rain > 15 && rain <= 40) || (sm > 0.30 && sm <= 0.40 && rain > 40)) {
    return { level: 4, riskText: 'HIGH', color: '#f97316', bg: 'bg-orange-100', textCls: 'text-orange-700', border: 'border-orange-200', recCls: 'text-orange-800', rec: '⛔ Soil is saturated and rain is expected. Runoff is highly likely. Recommendation: Do NOT fertilize.' };
  }
  if ((sm > 0.40 && sm <= 0.50 && rain <= 15) || (sm > 0.30 && sm <= 0.40 && rain > 15 && rain <= 30) || (sm <= 0.30 && rain > 30)) {
    return { level: 3, riskText: 'MODERATE', color: '#eab308', bg: 'bg-yellow-100', textCls: 'text-yellow-700', border: 'border-yellow-200', recCls: 'text-yellow-800', rec: '⚠️ Conditions are shifting. Either the soil is getting saturated, or a very heavy downpour is expected on dry ground. Caution advised.' };
  }
  if ((sm > 0.30 && sm <= 0.40 && rain <= 15) || (sm <= 0.30 && rain > 15 && rain <= 30)) {
    return { level: 2, riskText: 'LOW', color: '#84cc16', bg: 'bg-lime-100', textCls: 'text-lime-700', border: 'border-lime-200', recCls: 'text-lime-800', rec: '✅ Soil is at field capacity with light rain, or dry soil expecting moderate rain. Safe, but monitor weather updates.' };
  }
  return { level: 1, riskText: 'MINIMAL', color: '#22c55e', bg: 'bg-green-100', textCls: 'text-green-700', border: 'border-green-200', recCls: 'text-green-800', rec: '✅ Soil has high absorption capacity and rain is light. Perfect conditions for fertilization.' };
}


