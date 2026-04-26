const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const ids = [
  'landing-page', 'dashboard', 'enter-dashboard-btn', 'mob-sidebar-btn', 'sidebar',
  'loading-overlay', 'empty-state', 'data-state', 'status-bar', 'zoom-warning',
  'rescan-btn', 'rescan-icon', 'sidebar-subtitle', 'farm-name', 'farm-type-badge',
  'farm-crop-badge', 'farm-area-badge', 'risk-badge', 'risk-recommendation',
  'weather-code-badge', 'metric-moisture', 'moisture-bar', 'metric-temp',
  'metric-wind', 'metric-rain-total', 'metric-humidity', 'metric-runoff-score',
  'rain-chart', 'weather-timeline', 'spraying-advisory', 'farm-coords',
  'historical-chart', 'hist-label-start', 'proximity-alert', 'safe-window',
  'strip-farms', 'strip-high', 'strip-med', 'strip-low', 'strip-time',
  'layer-toggle-btn', 'layer-toggle-label', 'waterway-toggle-btn'
];
ids.forEach(id => {
  if (!html.includes('id="' + id + '"')) {
    console.log('Missing:', id);
  }
});
