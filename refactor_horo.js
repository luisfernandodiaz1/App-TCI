const fs = require('fs');
const path = require('path');

const files = [
  'js/app.js',
  'js/vehicles.js',
  'js/workorders.js',
  'js/reports.js'
];

files.forEach(file => {
  const p = path.join(__dirname, file);
  if (!fs.existsSync(p)) return;
  let content = fs.readFileSync(p, 'utf8');

  // DB Keys and common variables
  content = content.replace(/mileageLogs/g, 'hoursLogs');
  content = content.replace(/\.mileage/g, '.hours');
  content = content.replace(/mileage:/g, 'hours:');
  
  content = content.replace(/kmTraveled/g, 'workedHours');
  content = content.replace(/kmTotal/g, 'totalHours');
  content = content.replace(/lastPerformedKm/g, 'lastPerformedHours');
  content = content.replace(/frequencyKm/g, 'frequencyHours');
  
  // Variables logic
  content = content.replace(/kmDiff/g, 'hoursDiff');
  content = content.replace(/yieldingKmGal/g, 'yieldHrsGal');
  content = content.replace(/yieldKmGal/g, 'yieldHrsGal');
  content = content.replace(/newKm/g, 'newHours');
  content = content.replace(/baseKm/g, 'baseHours');
  content = content.replace(/prevLog\.km/g, 'prevLog.hours');

  content = content.replace(/l\.km /g, 'l.hours ');
  content = content.replace(/l\.km\b/g, 'l.hours');
  content = content.replace(/km: /g, 'hours: ');
  
  content = content.replace(/var km /g, 'var hours ');
  content = content.replace(/var km=/g, 'var hours=');
  content = content.replace(/ km = /g, ' hours = ');
  content = content.replace(/\(km /g, '(hours ');
  content = content.replace(/ km;/g, ' hours;');
  content = content.replace(/ km,/g, ' hours,');
  content = content.replace(/ km}/g, ' hours}');
  content = content.replace(/ km\)/g, ' hours)');
  content = content.replace(/ km >/g, ' hours >');
  content = content.replace(/ km </g, ' hours <');
  content = content.replace(/ km -/g, ' hours -');
  content = content.replace(/ km\n/g, ' hours\n');

  // Specific string replacements
  content = content.replace(/KM DIARIO/g, 'HORÓMETRO DIARIO');
  content = content.replace(/kilometraje/ig, 'horómetro');
  content = content.replace(/TAB: KM/g, 'TAB: HORAS');
  
  // DOM IDs
  content = content.replace(/-km"/g, '-hrs"');
  content = content.replace(/-km'/g, "-hrs'");
  content = content.replace(/'#.*?km'/g, match => match.replace('km', 'hrs'));
  content = content.replace(/"#.*?km"/g, match => match.replace('km', 'hrs'));
  content = content.replace(/'[a-zA-Z0-9]+-km'/g, match => match.replace('km', 'hrs'));
  
  // Custom manual replacements from app.js and reports.js
  content = content.replace(/missingKmToday/g, 'missingHoursToday');
  content = content.replace(/avgKmToday/g, 'avgHoursToday');

  fs.writeFileSync(p, content, 'utf8');
  console.log('Refactorizado: ' + file);
});
