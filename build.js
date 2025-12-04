const fs = require('fs');
const path = require('path');

// Минификация CSS
const css = fs.readFileSync('styles.css', 'utf8');
const minifiedCSS = css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{};:,])\s*/g, '$1')
    .replace(/;}/g, '}')
    .trim();

// Минификация JS (упрощенная)
const js = fs.readFileSync('app.js', 'utf8');
const minifiedJS = js
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
    .replace(/\n\s*\n/g, '\n')
    .replace(/\s+/g, ' ')
    .replace(/\s*([=+\-*/%&|^<>?:;,{}()[\]])\s*/g, '$1')
    .replace(/;}/g, '}')
    .trim();

// Сохранение минифицированных версий
fs.writeFileSync('styles.min.css', minifiedCSS);
fs.writeFileSync('app.min.js', minifiedJS);

// Обновление HTML для использования минифицированных файлов
let html = fs.readFileSync('index.html', 'utf8');
html = html
    .replace('styles.css', 'styles.min.css')
    .replace('app.js', 'app.min.js');

fs.writeFileSync('index.min.html', html);

console.log('✅ Файлы минифицированы:');
console.log(`   - styles.css: ${css.length} → ${minifiedCSS.length} символов (${Math.round((1 - minifiedCSS.length / css.length) * 100)}% меньше)`);
console.log(`   - app.js: ${js.length} → ${minifiedJS.length} символов (${Math.round((1 - minifiedJS.length / js.length) * 100)}% меньше)`);
console.log('   - Созданы файлы: styles.min.css, app.min.js, index.min.html');