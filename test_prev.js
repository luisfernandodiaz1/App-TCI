const fs = require('fs');

// We simulate what the DB does when a preventive maintenance OT is saved and then closed.
let dbData = {
  preventiveRoutines: [
    { id: 'r1', vehicleId: 'v1', active: true, frequencyHours: 50, frequencyDays: 30, lastPerformedHours: 1000, lastPerformedDate: '2026-01-01', name: 'Cambio de Aceite' }
  ],
  vehicles: [
    { id: 'v1', plate: 'ABC-123', hours: 1060 } // The vehicle has run 60 hours since last maintenance
  ],
  workOrders: []
};

// 1. Simulate saveWizard
let wizData = {
  isPreventive: true,
  routineId: 'r1',
  vehicleId: 'v1',
  vehicleHours: 1060
};
let isPrevFinal = wizData.isPreventive;
if (isPrevFinal && !wizData.routineId) { isPrevFinal = false; }
let newWO = {
  id: 'wo1',
  status: 'esperando_repuestos', // Default in wizard
  vehicleId: wizData.vehicleId,
  isPreventive: isPrevFinal,
  routineId: isPrevFinal ? wizData.routineId : null
};
dbData.workOrders.push(newWO);

// 2. Simulate showFinancialCloseModal -> onConfirm
let woId = 'wo1';
let currentWo = dbData.workOrders.find(w => w.id === woId);

let vehicleForHoro = dbData.vehicles.find(v => v.id === currentWo.vehicleId);
let horoFinal = vehicleForHoro ? vehicleForHoro.hours : 0;

let finData = {
  finalHours: horoFinal
};

// Update WO
currentWo.status = 'completada';

// Sync Routine
let closedWo = dbData.workOrders.find(w => w.id === woId);
if (closedWo && closedWo.isPreventive) {
  // Sync logic
  let routine = dbData.preventiveRoutines.find(r => r.id === closedWo.routineId);
  if (routine) {
    routine.lastPerformedHours = finData.finalHours;
    routine.lastPerformedDate = '2026-04-09';
  }
}

console.log('Resulting Routine:', dbData.preventiveRoutines[0]);
