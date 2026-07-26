const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TARGETS = ['netlify', 'docs', 'surge'];
const FILES = ['script.js', 'styles.css', 'lang.js', 'privacy.html', 'terms.html'];

let count = 0;
for (const target of TARGETS) {
  for (const file of FILES) {
    const src = path.join(ROOT, file);
    const dst = path.join(ROOT, target, file);
    if (!fs.existsSync(src)) {
      console.warn(`SKIP: ${src} not found`);
      continue;
    }
    const content = fs.readFileSync(src);
    fs.writeFileSync(dst, content);
    count++;
    console.log(`  ${file} → ${target}/`);
  }
}
console.log(`\nSynced ${count} files to ${TARGETS.length} static clients.`);
