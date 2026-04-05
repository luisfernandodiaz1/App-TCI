/* ============================================================
   DB.JS — Data persistence layer using localStorage
   ============================================================ */

// ── ES6 POLYFILLS (For older browsers/environments) ─────────
if (typeof Object.assign !== 'function') {
  Object.assign = function (target) {
    if (target === null || target === undefined) throw new TypeError('Cannot convert undefined or null to object');
    var to = Object(target);
    for (var i = 1; i < arguments.length; i++) {
      var nextSource = arguments[i];
      if (nextSource !== null && nextSource !== undefined) {
        for (var key in nextSource) {
          if (Object.prototype.hasOwnProperty.call(nextSource, key)) to[key] = nextSource[key];
        }
      }
    }
    return to;
  };
}
if (!Array.prototype.find) {
  Array.prototype.find = function (predicate) {
    if (this == null) throw new TypeError('Array.prototype.find called on null or undefined');
    if (typeof predicate !== 'function') throw new TypeError('predicate must be a function');
    var list = Object(this), length = list.length >>> 0, thisArg = arguments[1], value;
    for (var i = 0; i < length; i++) {
      value = list[i];
      if (predicate.call(thisArg, value, i, list)) return value;
    }
    return undefined;
  };
}
if (!Array.prototype.findIndex) {
  Array.prototype.findIndex = function (predicate) {
    if (this == null) throw new TypeError('Array.prototype.findIndex called on null or undefined');
    if (typeof predicate !== 'function') throw new TypeError('predicate must be a function');
    var list = Object(this), length = list.length >>> 0, thisArg = arguments[1];
    for (var i = 0; i < length; i++) {
      if (predicate.call(thisArg, list[i], i, list)) return i;
    }
    return -1;
  };
}

var DB = (function () {
  'use strict';

  var STORE = 'inventario_app_v2';

  function load() {
    try {
      var raw = localStorage.getItem(STORE);
      var parsed = raw ? JSON.parse(raw) : null;
      if (parsed) return migrateData(parsed);
      return null;
    } catch (e) { return null; }
  }

  function migrateData(data) {
    var needsSave = false;

    if (data.vehicles) {
      data.vehicles.forEach(function (v) {
        if (v.mileage !== undefined) { v.hours = v.mileage; delete v.mileage; needsSave = true; }
      });
    }
    if (data.preventiveRoutines) {
      data.preventiveRoutines.forEach(function (r) {
        if (r.frequencyKm !== undefined) { r.frequencyHours = r.frequencyKm; delete r.frequencyKm; needsSave = true; }
        if (r.lastPerformedKm !== undefined) { r.lastPerformedHours = r.lastPerformedKm; delete r.lastPerformedKm; needsSave = true; }
      });
    }
    if (data.fuelLogs) {
      data.fuelLogs.forEach(function (l) {
        if (l.km !== undefined) { l.hours = l.km; delete l.km; needsSave = true; }
      });
    }
    if (data.maintenanceLogs) {
      data.maintenanceLogs.forEach(function (l) {
        if (l.km !== undefined) { l.hours = l.km; delete l.km; needsSave = true; }
      });
    }
    if (data.vehicleInspections) {
      data.vehicleInspections.forEach(function (l) {
        if (l.km !== undefined) { l.hours = l.km; delete l.km; needsSave = true; }
      });
    }
    if (data.mileageLogs) {
      data.hoursLogs = data.mileageLogs;
      delete data.mileageLogs;
      data.hoursLogs.forEach(function (l) {
        if (l.kmTraveled !== undefined) { l.workedHours = l.kmTraveled; delete l.kmTraveled; }
        if (l.kmTotal !== undefined) { l.totalHours = l.kmTotal; delete l.kmTotal; }
        if (l.km !== undefined) { l.hours = l.km; delete l.km; }
      });
      needsSave = true;
    }

    if (needsSave) {
      try { localStorage.setItem(STORE, JSON.stringify(data)); } catch (e) { }
    }
    return data;
  }

  function save(data) {
    try { localStorage.setItem(STORE, JSON.stringify(data)); } catch (e) { console.error('DB save error', e); }
  }

  // ── Default seed data ──────────────────────────────────────
  function seed() {
    return {
      categories: [
        { id: 'cat1', name: 'Repuestos Mecánicos', description: 'Piezas y repuestos mecánicos', color: 'blue' },
        { id: 'cat2', name: 'Herramientas', description: 'Herramientas manuales y eléctricas', color: 'cyan' },
        { id: 'cat3', name: 'Lubricantes', description: 'Aceites, grasas y lubricantes', color: 'amber' },
        { id: 'cat4', name: 'Consumibles', description: 'Tornillos, pernos, sellos, etc.', color: 'green' },
        { id: 'cat5', name: 'Material Eléctrico', description: 'Cables, fusibles, interruptores', color: 'purple' },
        { id: 'cat6', name: 'EPP', description: 'Elementos de protección personal', color: 'orange' },
      ],
      items: [
        { id: 'i1', code: 'REP-001', name: 'Rodamiento 6205', categoryId: 'cat1', unit: 'unidad', minStock: 5, stock: 12, unitCost: 15000, description: 'Rodamiento rígido de bolas 6205 2RS', createdAt: daysAgo(100) },
        { id: 'i2', code: 'REP-002', name: 'Correa Trapecial B-55', categoryId: 'cat1', unit: 'unidad', minStock: 6, stock: 4, unitCost: 28000, description: 'Correa en V tipo B sección 55', createdAt: daysAgo(95) },
        { id: 'i3', code: 'LUB-001', name: 'Aceite Hidráulico 68', categoryId: 'cat3', unit: 'litro', minStock: 10, stock: 40, unitCost: 12500, description: 'Aceite HLP 68 para sistemas hidráulicos', createdAt: daysAgo(90) },
        { id: 'i4', code: 'CON-001', name: 'Tornillo Hex M8x30', categoryId: 'cat4', unit: 'unidad', minStock: 50, stock: 200, unitCost: 800, description: 'Tornillo hexagonal M8 x 30mm acero', createdAt: daysAgo(80) },
        { id: 'i5', code: 'CON-002', name: 'Sello O-Ring 50mm', categoryId: 'cat4', unit: 'unidad', minStock: 20, stock: 3, unitCost: 800, description: 'Anillo de sello O-Ring diámetro 50mm', createdAt: daysAgo(75) },
        { id: 'i6', code: 'ELE-001', name: 'Fusible 10A', categoryId: 'cat5', unit: 'unidad', minStock: 10, stock: 30, unitCost: 2500, description: 'Fusible cilíndrico 10 amperios', createdAt: daysAgo(70) },
        { id: 'i7', code: 'HER-001', name: 'Llave Ajustable 12"', categoryId: 'cat2', unit: 'unidad', minStock: 2, stock: 6, unitCost: 35000, description: 'Llave ajustable cromada 12 pulgadas', createdAt: daysAgo(65) },
        { id: 'i8', code: 'LUB-002', name: 'Grasa Multipropósito', categoryId: 'cat3', unit: 'kg', minStock: 3, stock: 8, unitCost: 18000, description: 'Grasa de lito multipropósito EP2', createdAt: daysAgo(60) },
        { id: 'i9', code: 'EPP-001', name: 'Gafas de Seguridad', categoryId: 'cat6', unit: 'unidad', minStock: 15, stock: 30, unitCost: 6500, description: 'Gafas protección UV antiempañantes', createdAt: daysAgo(50) },
      ],
      movements: [
        { id: 'm1', itemId: 'i1', itemName: 'Rodamiento 6205', type: 'entrada', qty: 12, unitCost: 15000, totalCost: 180000, date: daysAgo(10), userId: 'u1', userName: 'Carlos Méndez', reference: 'OC-001' },
        { id: 'm2', itemId: 'i3', itemName: 'Aceite Hidráulico 68', type: 'entrada', qty: 40, unitCost: 12500, totalCost: 500000, date: daysAgo(8), userId: 'u1', userName: 'Carlos Méndez', reference: 'OC-002' },
        { id: 'm3', itemId: 'i2', itemName: 'Correa Trapecial B-55', type: 'salida', qty: 2, unitCost: 28000, totalCost: 56000, date: daysAgo(5), userId: 'u2', userName: 'Ana García', reference: 'OT-2026-001' },
        { id: 'm4', itemId: 'i4', itemName: 'Tornillo Hex M8x30', type: 'entrada', qty: 200, unitCost: 800, totalCost: 160000, date: daysAgo(3), userId: 'u1', userName: 'Carlos Méndez', reference: 'OC-003' },
        { id: 'm5', itemId: 'i6', itemName: 'Fusible 10A', type: 'salida', qty: 5, unitCost: 2500, totalCost: 12500, date: daysAgo(2), userId: 'u3', userName: 'Luis Torres', reference: 'OT-002' },
      ],
      workOrders: [
        {
          id: 'wo1', number: 'OT-2026-001', date: daysAgo(5),
          requesterId: 'u1', requesterName: 'Carlos Méndez',
          description: 'Mantenimiento preventivo compresor L1. Cambio de correas y lubricación general.',
          priority: 'alta', status: 'completada', assignedTo: 'emp1',
          materials: [
            { itemId: 'i2', itemName: 'Correa Trapecial B-55', unit: 'unidad', qtyRequested: 2, qtyDelivered: 2, delivered: true, unitCost: 28000, totalCost: 56000 },
            { itemId: 'i8', itemName: 'Grasa Multipropósito', unit: 'kg', qtyRequested: 1, qtyDelivered: 1, delivered: true, unitCost: 18000, totalCost: 18000 },
          ],
          laborCost: 80000, externalCost: 0,
          totalCost: 154000, // 56000 + 18000 + 80000
          notes: 'Trabajo completado sin novedad.', closedAt: daysAgo(3), createdAt: daysAgo(5),
          vehicleId: 'vh1', vehiclePlate: 'ABC-123', vehicleName: 'Toyota Hilux 2019'
        },
        {
          id: 'wo2', number: 'OT-2026-002', date: daysAgo(2),
          requesterId: 'u1', requesterName: 'Carlos Méndez',
          description: 'Reparación de fuga hidráulica en prensa hidráulica PH-02.',
          priority: 'alta', status: 'en_proceso', assignedTo: 'emp3',
          materials: [
            { itemId: 'i5', itemName: 'Sello O-Ring 50mm', unit: 'unidad', qtyRequested: 3, qtyDelivered: 0, delivered: false, unitCost: 800, totalCost: 0 },
            { itemId: 'i3', itemName: 'Aceite Hidráulico 68', unit: 'litro', qtyRequested: 5, qtyDelivered: 0, delivered: false, unitCost: 12500, totalCost: 0 },
          ],
          laborCost: 0, externalCost: 0, totalCost: 0,
          notes: '', closedAt: null, createdAt: daysAgo(2),
          vehicleId: 'vh3', vehiclePlate: 'DEF-789', vehicleName: 'Kenworth T680 2018'
        },
        {
          id: 'wo3', number: 'OT-2026-003', date: daysAgo(1),
          requesterId: 'u1', requesterName: 'Carlos Méndez',
          description: 'Cambio de rodamientos en motor eléctrico banda transportadora C3.',
          priority: 'media', status: 'emitida', assignedTo: 'emp1',
          materials: [
            { itemId: 'i1', itemName: 'Rodamiento 6205', unit: 'unidad', qtyRequested: 4, qtyDelivered: 0, delivered: false, unitCost: 15000, totalCost: 0 },
          ],
          laborCost: 0, externalCost: 0, totalCost: 0,
          notes: '', closedAt: null, createdAt: daysAgo(1),
          vehicleId: 'vh2', vehiclePlate: 'XYZ-456', vehicleName: 'Chevrolet NPR 2020'
        },
      ],
      vehicles: [
        { id: 'vh1', plate: 'ABC-123', brand: 'Toyota', model: 'Hilux', year: 2019, type: 'Camioneta', department: 'Operaciones', hours: 85000, color: 'Blanco', notes: 'Vehículo de carga liviana', active: true, createdAt: daysAgo(90) },
        { id: 'vh2', plate: 'XYZ-456', brand: 'Chevrolet', model: 'NPR', year: 2020, type: 'Camión', department: 'Logística', hours: 120000, color: 'Gris', notes: 'Camión de distribución', active: true, createdAt: daysAgo(90) },
        { id: 'vh3', plate: 'DEF-789', brand: 'Kenworth', model: 'T680', year: 2018, type: 'Tracto', department: 'Transporte', hours: 310000, color: 'Azul', notes: 'Tractocamión principal', active: true, createdAt: daysAgo(90) },
        { id: 'vh4', plate: 'GHI-321', brand: 'Yamaha', model: 'XTZ 150', year: 2022, type: 'Motocicleta', department: 'Mensajería', hours: 18000, color: 'Rojo', notes: 'Mensajero urbano', active: true, createdAt: daysAgo(60) },
        { id: 'vh5', plate: 'JKL-654', brand: 'Caterpillar', model: '950 GC', year: 2017, type: 'Maquinaria', department: 'Obra', hours: 6200, color: 'Amarillo', notes: 'Cargador frontal', active: true, createdAt: daysAgo(60) },
        { id: 'vh6', plate: 'MNO-987', brand: 'Mercedes', model: 'Sprinter 516', year: 2021, type: 'Furgoneta', department: 'Operaciones', hours: 45000, color: 'Blanco', notes: 'Furgón reparto', active: false, createdAt: daysAgo(30) },
      ],
      preventiveRoutines: [
        { id: 'pr1', vehicleId: 'vh1', name: 'Cambio de Aceite de Motor', frequencyHours: 250, frequencyDays: 180, lastPerformedHours: 12000, lastPerformedDate: daysAgo(100), active: true },
        { id: 'pr2', vehicleId: 'vh1', name: 'Alineación y Balanceo', frequencyHours: 500, frequencyDays: 365, lastPerformedHours: 11500, lastPerformedDate: daysAgo(200), active: true },
        { id: 'pr3', vehicleId: 'vh2', name: 'Revisión de Frenos / Mandos', frequencyHours: 500, frequencyDays: 90, lastPerformedHours: 8500, lastPerformedDate: daysAgo(40), active: true },
        { id: 'pr4', vehicleId: 'vh5', name: 'Lubricación General', frequencyHours: 50, frequencyDays: 30, lastPerformedHours: 5800, lastPerformedDate: daysAgo(35), active: true }
      ],
      fuelLogs: [
        { id: 'fl1', vehicleId: 'vh1', date: daysAgo(5), hours: 12450, gallons: 15.5, pricePerGal: 15000, cost: 232500, fuelType: 'Diesel / ACPM', station: 'Texaco Norte', fullTank: true },
        { id: 'fl2', vehicleId: 'vh2', date: daysAgo(2), hours: 8900, gallons: 10.2, pricePerGal: 16000, cost: 163200, fuelType: 'Gasolina Corriente', station: 'EDS Principal', fullTank: true }
      ],
      vehicleDocuments: [
        { id: 'vd1', vehicleId: 'vh1', type: 'soat', expiry: '2026-12-01', cost: 580000, notes: 'Renovado recientemente', createdAt: daysAgo(10) },
        { id: 'vd2', vehicleId: 'vh2', type: 'tecno', expiry: '2026-11-15', cost: 210000, notes: 'Revisión anual', createdAt: daysAgo(15) }
      ],
      users: [
        { id: 'u1', name: 'Carlos Méndez', role: 'mantenimiento', initials: 'CM', active: true },
        { id: 'u2', name: 'Ana García', role: 'admin', initials: 'AG', active: true },
        { id: 'u3', name: 'Luis Torres', role: 'taller', initials: 'LT', employeeId: 'emp3', active: true },
        { id: 'u4', name: 'María López', role: 'taller', initials: 'ML', employeeId: 'emp2', active: true },
      ],
      settings: {
        companyName: 'MI EMPRESA S.A.S',
        companyNit: '900.000.000-0',
        companyAddress: 'Calle 123 # 45-67',
        activeUserId: 'u1',
        nextOTNumber: 4,
        monthlyWorkingHours: 220
      },
      vehicleInspections: [],
      hoursLogs: [],
      positions: [
        { id: 'pos1', name: 'Mecánico Líder', description: 'Responsable de taller' },
        { id: 'pos2', name: 'Técnico Electricista', description: 'Especialista eléctrico' },
        { id: 'pos3', name: 'Ayudante Mecánico', description: 'Apoyo en reparaciones' },
        { id: 'pos4', name: 'Administrativo', description: 'Personal de oficina' }
      ],
      employees: [
        { id: 'emp1', name: 'Roberto Gómez', idNumber: '10203040', positionId: 'pos1', monthlySalary: 2800000, isTechnician: true, active: true, createdAt: daysAgo(365) },
        { id: 'emp2', name: 'María López', idNumber: '50607081', positionId: 'pos2', monthlySalary: 2400000, isTechnician: true, active: true, createdAt: daysAgo(200) },
        { id: 'emp3', name: 'Luis Torres', idNumber: '11223344', positionId: 'pos3', monthlySalary: 1800000, isTechnician: true, active: true, createdAt: daysAgo(50) }
      ]
    };
  }

  function daysAgo(n) {
    var d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().split('T')[0];
  }

  // ── Initialize ─────────────────────────────────────────────
  var _data = load();
  if (!_data) {
    _data = seed();
    save(_data);
  }

  // ── Generic CRUD ───────────────────────────────────────────
  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }

  function getAll(collection) {
    return (_data[collection] || []).slice();
  }

  function getById(collection, id) {
    return (_data[collection] || []).find(function (r) { return r.id === id; }) || null;
  }

  function create(collection, record) {
    if (!record.id) record.id = generateId();
    if (!_data[collection]) _data[collection] = [];
    _data[collection].push(record);
    save(_data);
    return record;
  }

  function update(collection, id, changes) {
    var idx = (_data[collection] || []).findIndex(function (r) { return r.id === id; });
    if (idx === -1) return null;
    var record = _data[collection][idx];
    for (var key in changes) {
      if (changes.hasOwnProperty(key)) {
        record[key] = changes[key];
      }
    }
    save(_data);
    return _data[collection][idx];
  }

  function remove(collection, id) {
    var arr = _data[collection] || [];
    var idx = arr.findIndex(function (r) { return r.id === id; });
    if (idx === -1) return false;

    // Validación de Integridad Referencial Básica (NIF/Producción)
    if (collection === 'categories') {
      var hasItems = (_data['items'] || []).some(function (i) { return i.categoryId === id; });
      if (hasItems) { throw new Error('No se puede eliminar una categoría que tiene artículos asociados.'); }
    }
    if (collection === 'items') {
      var hasMovements = (_data['movements'] || []).some(function (m) { return m.itemId === id; });
      if (hasMovements) { throw new Error('No se puede eliminar un artículo con historial de movimientos.'); }
    }
    if (collection === 'vehicles') {
      var hasLogs = (_data['hoursLogs'] || []).some(function (l) { return l.vehicleId === id; }) ||
                    (_data['fuelLogs'] || []).some(function (l) { return l.vehicleId === id; }) ||
                    (_data['workOrders'] || []).some(function (w) { return w.vehicleId === id; }) ||
                    (_data['maintenanceLogs'] || []).some(function (l) { return l.vehicleId === id; });
      if (hasLogs) { throw new Error('No se puede eliminar un vehículo con historial de registros.'); }
    }
    if (collection === 'employees') {
      var hasWOs = (_data['workOrders'] || []).some(function (w) { return w.assignedTo === id; });
      if (hasWOs) { throw new Error('No se puede eliminar un empleado asignado a órdenes de trabajo.'); }
    }
    if (collection === 'users') {
      if (id === _data.settings.activeUserId) { throw new Error('No puedes eliminar el usuario activo.'); }
      var hasMovs = (_data['movements'] || []).some(function (m) { return m.userId === id; });
      if (hasMovs) { throw new Error('No se puede eliminar un usuario con historial de operaciones.'); }
    }

    arr.splice(idx, 1);
    save(_data);
    return true;
  }

  // ── Transactions (Atomic Operations) ───────────────────────
  function transaction(cb) {
    var backup = JSON.stringify(_data);
    try {
      var result = cb();
      save(_data); // Si el callback termina sin error, persistimos
      return result;
    } catch (e) {
      _data = JSON.parse(backup); // Reversión en memoria
      console.error('Transaction failed - Rollback executed:', e);
      throw e;
    }
  }

  function registerMovement(itemId, type, qty, options) {
    var item = getById('items', itemId);
    if (!item) return false;
    var opt = options || {};
    transaction(function () {
      var newStock;
      var recordedQty = qty;
      if (type === 'entrada') {
        newStock = item.stock + qty;
      } else if (type === 'salida') {
        newStock = item.stock - qty;
      } else if (type === 'ajuste') {
        newStock = qty;
        recordedQty = Math.abs(qty - item.stock);
      }
      update('items', itemId, { stock: newStock });
      var unitC = opt.unitCost || item.unitCost || 0;
      var totalC = opt.totalCost || (unitC * recordedQty);
      var mov = Object.assign({
        itemId: itemId,
        itemName: item.name,
        type: type,
        qty: recordedQty,
        unitCost: unitC,
        totalCost: totalC,
        date: new Date().toISOString().split('T')[0],
        userId: opt.userId || getSettings().activeUserId
      }, opt);
      create('movements', mov);
    });
    return true;
  }

  // ── Settings ───────────────────────────────────────────────
  function getSettings() {
    var cloned = {};
    for (var key in _data.settings) {
      if (_data.settings.hasOwnProperty(key)) cloned[key] = _data.settings[key];
    }
    return cloned;
  }

  function saveSettings(changes) {
    for (var key in changes) {
      if (changes.hasOwnProperty(key)) _data.settings[key] = changes[key];
    }
    save(_data);
  }

  // ── Backup / Restore ───────────────────────────────────────
  function exportAll() { return JSON.stringify(_data, null, 2); }

  function validateSchema(data) {
    if (!data || typeof data !== 'object') return false;
    var required = ['items', 'vehicles', 'workOrders', 'users', 'settings', 'categories'];
    for (var i = 0; i < required.length; i++) {
      if (!data[required[i]] || !Array.isArray(data[required[i]]) && required[i] !== 'settings') {
        return false;
      }
    }
    return true;
  }

  function importAll(json) {
    try {
      var data = JSON.parse(json);
      if (!validateSchema(data)) {
        console.error('Importación fallida: El archivo no tiene el formato correcto.');
        return false;
      }
      _data = migrateData(data);
      save(_data);
      return true;
    } catch (e) {
      console.error('Error al parsear el JSON de backup', e);
      return false;
    }
  }

  function reset() {
    _data = seed();
    save(_data);
  }

  // ── Next OT number ─────────────────────────────────────────
  function nextOTNumber() {
    var num = _data.settings.nextOTNumber || 1;
    var year = new Date().getFullYear();
    _data.settings.nextOTNumber = num + 1;
    save(_data);
    return 'OT-' + year + '-' + String(num).padStart(3, '0');
  }

  return {
    getAll: getAll,
    getById: getById,
    create: create,
    update: update,
    remove: remove,
    getSettings: getSettings,
    saveSettings: saveSettings,
    exportAll: exportAll,
    importAll: importAll,
    reset: reset,
    nextOTNumber: nextOTNumber,
    registerMovement: registerMovement,
    generateId: generateId,
    transaction: transaction
  };
})();
