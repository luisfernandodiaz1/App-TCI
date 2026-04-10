const fs = require('fs');
const path = require('path');

const jsDir = './js';
const files = fs.readdirSync(jsDir).filter(f => f.endsWith('.js'));
let errors = [];

files.forEach(file => {
  const content = fs.readFileSync(path.join(jsDir, file), 'utf-8');
  const lines = content.split('\n');

  lines.forEach((line, i) => {
    // 1. Unsafe getElementById chain: document.getElementById('...').something
    // Check if it's strictly chained without assignment and check
    if (/document\.getElementById\([^)]+\)\.[a-zA-Z]/.test(line)) {
        // Exclude if it has ?., or if it's inside a try catch (too complex, just flag it)
        // Actually, this is very common in vanilla JS. Let's look for known missing ones.
    }

    // 2. parseFloat without fallback or NaN check
    if (/parseFloat\([^)]+\)/.test(line) && !/\|\|/.test(line) && !/isNaN/.test(line)) {
         errors.push(`${file}:${i + 1} - Posible NaN en parseFloat dinámico: ${line.trim()}`);
    }

    // 3. Object property access on potentially undefined arrays
    if (/\[.*?\]\.[a-zA-Z]/.test(line) && !/\?/.test(line) && !/&&/.test(line) && !/\|\|/.test(line) && !line.includes('length')) {
        // errors.push(`${file}:${i + 1} - Posible acceso a array indefinido: ${line.trim()}`);
    }
  });
});

fs.writeFileSync('audit_results.txt', errors.join('\n'));
console.log(`Auditoría completa. Se encontraron ${errors.length} advertencias.`);
