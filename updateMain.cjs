const fs = require('fs');

let code = fs.readFileSync('main.js', 'utf8');

// 1. Add calculateRiskLevel function at the end
if (!code.includes('calculateRiskLevel')) {
  const riskFunc = `
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
`;
  code += riskFunc;
}

// 2. Replace ui refs
code = code.replace(
  /stripHigh\s*:\s*\$\('strip-high'\),\s*stripMed\s*:\s*\$\('strip-med'\),\s*stripLow\s*:\s*\$\('strip-low'\),/,
  \`stripL5     : $('strip-l5'),
  stripL4     : $('strip-l4'),
  stripL3     : $('strip-l3'),
  stripL2     : $('strip-l2'),
  stripL1     : $('strip-l1'),\`
);

// 3. Update computeStats
const oldComputeStats = \`function computeStats(farms) {
  let red = 0, yellow = 0, green = 0;
  farms.forEach(f => {
    const d = cache.get(f.id);
    if (!d) return;
    if (d.risk === 'RED') red++;
    else if (d.risk === 'YELLOW') yellow++;
    else green++;
  });
  return { red, yellow, green };
}\`;
const newComputeStats = \`function computeStats(farms) {
  const counts = { l1: 0, l2: 0, l3: 0, l4: 0, l5: 0 };
  farms.forEach(f => {
    const d = cache.get(f.id);
    if (!d) return;
    counts['l' + d.risk.level]++;
  });
  return counts;
}\`;
code = code.replace(oldComputeStats, newComputeStats);

// 4. Update fetchArea stats text and Strip logic
const oldStatsText = \`ui.statusBar.textContent =
      \\\`\${farms.length} farm sectors · \${stats.red} high risk · \${stats.yellow} moderate · \${stats.green} optimal\\\`;\`;
const newStatsText = \`ui.statusBar.textContent =
      \\\`\${farms.length} farm sectors · \${stats.l5} critical · \${stats.l4} high · \${stats.l3} mod · \${stats.l2} low · \${stats.l1} min\\\`;
    if (ui.stripFarms) ui.stripFarms.textContent = farms.length;
    if (ui.stripL5) ui.stripL5.textContent = stats.l5;
    if (ui.stripL4) ui.stripL4.textContent = stats.l4;
    if (ui.stripL3) ui.stripL3.textContent = stats.l3;
    if (ui.stripL2) ui.stripL2.textContent = stats.l2;
    if (ui.stripL1) ui.stripL1.textContent = stats.l1;\`;
code = code.replace(oldStatsText, newStatsText);

// 5. Update fetchWeatherFor
const oldRiskCalc = \`    // Risk level
    let risk = 'GREEN';
    if (curMoist > 0.08 && totalRain > 10) risk = 'RED';
    else if (curMoist > 0.06 || totalRain > 5) risk = 'YELLOW';\`;
const newRiskCalc = \`    // Risk level
    const risk = calculateRiskLevel(curMoist, totalRain);\`;
code = code.replace(oldRiskCalc, newRiskCalc);

// 6. Update featureStyle
const oldFeatureStyle = \`  const d   = cache.get(f.id);
  const risk = d?.risk || 'GREEN';
  const active = f.id === activeId;
  const fill = risk === 'RED' ? '#ef4444'
             : risk === 'YELLOW' ? '#f59e0b'
             : '#22c55e';\`;
const newFeatureStyle = \`  const d   = cache.get(f.id);
  const risk = d?.risk || calculateRiskLevel(0, 0);
  const active = f.id === activeId;
  const fill = risk.color;\`;
code = code.replace(oldFeatureStyle, newFeatureStyle);

// 7. Update bindFeature tooltip
const oldTooltip = \`      const col   = d.risk === 'RED' ? '#ef4444' : d.risk === 'YELLOW' ? '#f59e0b' : '#22c55e';
      this.bindTooltip(
        \\\`<div style="font-family:Inter,sans-serif;font-size:12px;line-height:1.4">
          <div style="font-weight:700;color:#0f172a">\${label}</div>
          <div style="display:flex;align-items:center;gap:6px;margin-top:4px">
            <span style="width:8px;height:8px;border-radius:50%;background:\${col};display:inline-block"></span>
            <span style="font-weight:600;color:\${col}">\${d.risk} RISK</span>\`;
const newTooltip = \`      const col   = d.risk.color;
      this.bindTooltip(
        \\\`<div style="font-family:Inter,sans-serif;font-size:12px;line-height:1.4">
          <div style="font-weight:700;color:#0f172a">\${label}</div>
          <div style="display:flex;align-items:center;gap:6px;margin-top:4px">
            <span style="width:8px;height:8px;border-radius:50%;background:\${col};display:inline-block"></span>
            <span style="font-weight:600;color:\${col}">\${d.risk.riskText} RISK</span>\`;
code = code.replace(oldTooltip, newTooltip);

// 8. Update populateSidebar badges and recommendations
const oldRiskBadge = \`  // Risk badge
  const riskColor = d.risk === 'RED' ? ['bg-red-100','text-red-700','border-red-200']
                  : d.risk === 'YELLOW' ? ['bg-amber-100','text-amber-700','border-amber-200']
                  : ['bg-green-100','text-green-700','border-green-200'];
  ui.riskBadge.className = \\\`ml-3 shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wide border \${riskColor.join(' ')}\\\`;
  ui.riskBadge.textContent = d.risk;

  const recMap = {
    RED    : '⛔ Do NOT apply fertilizer. Soil saturation is critical and heavy rainfall is forecast. Risk of direct nutrient runoff into waterways.',
    YELLOW : '⚠️ Exercise caution. Monitor conditions closely. Consider delaying application until moisture drops or rain risk clears.',
    GREEN  : '✅ Conditions are optimal for fertilizer application. Low runoff risk within the next 48 hours.'
  };
  const recColors = { RED: 'text-red-800', YELLOW: 'text-amber-800', GREEN: 'text-green-800' };
  ui.riskRec.textContent = recMap[d.risk];
  ui.riskRec.className   = \\\`text-xs mt-2.5 leading-relaxed font-medium \${recColors[d.risk]}\\\`;\`;
const newRiskBadge = \`  // Risk badge
  const rObj = d.risk;
  ui.riskBadge.className = \\\`ml-3 shrink-0 px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wide border \${rObj.bg} \${rObj.textCls} \${rObj.border}\\\`;
  ui.riskBadge.textContent = rObj.riskText;

  ui.riskRec.textContent = rObj.rec;
  ui.riskRec.className   = \\\`text-xs mt-2.5 leading-relaxed font-medium \${rObj.recCls}\\\`;\`;
code = code.replace(oldRiskBadge, newRiskBadge);

// 9. Update Moisture bar UI bounds
const oldMoistureBar = \`  // Moisture bar (0–0.15 scale)
  const mPct = Math.min((d.curMoist / 0.15) * 100, 100);
  ui.moistureBar.style.width = \\\`\${mPct}%%\\\`;
  ui.moistureBar.className   = \\\`h-full rounded-full transition-all duration-500 \${
    d.curMoist > 0.08 ? 'bg-red-500' : d.curMoist > 0.06 ? 'bg-amber-400' : 'bg-blue-500'
  }\\\`;\`;
const newMoistureBar = \`  // Moisture bar (0–0.60 scale)
  const mPct = Math.min((d.curMoist / 0.60) * 100, 100);
  ui.moistureBar.style.width = \\\`\${mPct}%\`;
  ui.moistureBar.className   = \\\`h-full rounded-full transition-all duration-500 \${
    d.curMoist > 0.50 ? 'bg-red-500' : d.curMoist > 0.40 ? 'bg-orange-500' : d.curMoist > 0.30 ? 'bg-yellow-500' : 'bg-lime-500'
  }\\\`;\`;
code = code.replace(oldMoistureBar, newMoistureBar);

// Fix string replacement percent issue in template literal
code = code.replace('`${mPct}%%`', '`${mPct}%`');

// 10. Advisory panel thresholds
const oldAdvisory = \`  const moistOk = d.curMoist < 0.07;
  const rainOk  = d.totalRain < 5;\`;
const newAdvisory = \`  const moistOk = d.curMoist <= 0.30;
  const rainOk  = d.totalRain <= 15;\`;
code = code.replace(oldAdvisory, newAdvisory);

fs.writeFileSync('main.js', code);
console.log('main.js updated successfully!');
