const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const matches = html.match(/id=\"[^\"]+\"/g);
const counts = {};
matches.forEach(m => {
  counts[m] = (counts[m] || 0) + 1;
});
for (const [id, count] of Object.entries(counts)) {
  if (count > 1) console.log('Duplicate:', id);
}
