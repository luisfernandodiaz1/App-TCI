const fs = require('fs');

let content = fs.readFileSync('js/vehicles.js', 'utf-8');

// Replace identifiers and definitions
content = content.replace(/deleteKmLog/g, 'deleteHrLog');
content = content.replace(/showKmEntryModal/g, 'showHrEntryModal');
content = content.replace(/km-goto-tab/g, 'hr-goto-tab');
content = content.replace(/km-date-sel/g, 'hr-date-sel');
content = content.replace(/km-matrix-table/g, 'hr-matrix-table');
content = content.replace(/upd-km-modal/g, 'upd-hr-modal');
content = content.replace(/promptUpdateKm/g, 'promptUpdateHrs');
content = content.replace(/data-km/g, 'data-hr');
content = content.replace(/v-km-lbl/g, 'v-hrs-lbl');
content = content.replace(/inpKm/g, 'inpHrs');
content = content.replace(/\.km([^A-Za-z0-9])/g, '.hours$1'); // e.g. log.km || 0 -> log.hours || 0

content = content.replace(/km-cell/g, 'hr-cell');
content = content.replace(/km /gi, 'hr '); // for string literals like "Calcular km " to "Calcular hr "
content = content.replace(/kilometraje/gi, 'horómetro'); // For texts like "Kilometraje"

// A few specific strings that remain
content = content.replace(/'km'/g, "'hr'");
content = content.replace(/"km"/g, '"hr"');
content = content.replace(/updateCalc\('km'\)/g, "updateCalc('hr')");
content = content.replace(/updateCalc\("km"\)/g, 'updateCalc("hr")');

fs.writeFileSync('js/vehicles.js', content, 'utf-8');

console.log('vehicles.js correctly refactored!');
