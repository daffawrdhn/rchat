const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const mainHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const targets = ['netlify', 'docs', 'surge'];
for (const t of targets) {
    let html = mainHtml.replace(/<script src="config-env\.php"><\/script>/, '<script src="config.js"></script>');
    html = html.replace(/src="config-env\.php"/, 'src="config.js"');
    fs.writeFileSync(path.join(ROOT, t, 'index.html'), html);
    console.log('Updated ' + t + '/index.html');
}
