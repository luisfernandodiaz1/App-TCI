/* ============================================================
   DB.JS — Hybrid Synchronization Engine (V2) 🛰️
   ============================================================ */

// ── ES6 POLYFILLS ───────────────────────────────────────────
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

var DB = (function () {
  'use strict';

  var STORE = 'inventario_app_v2';
  var _data = {
    categories: [], items: [], movements: [], workOrders: [],
    vehicles: [], preventiveRoutines: [], fuelLogs: [],
    vehicleDocuments: [], users: [], employees: [],
    positions: [], maintenanceLogs: [], hoursLogs: [],
    settings: { nextOTNumber: 1, activeUserId: null }
  };

  var _listeners = [];
  var _lastDocs = {}; // Punteros para paginación (V2.2)
  var _isCloudReady = false;

  // ── 1. INITIALIZATION ──────────────────────────────────────
  function init() {
    // Carga inicial local (Inmediata)
    var local = loadLocal();
    if (local) {
      _data = local;
    } else {
      _data = seed();
      saveLocal();
    }

    // Intentar conectar con la nube
    initCloud();
  }

  function loadLocal() {
    try {
      var raw = localStorage.getItem(STORE);
      var parsed = raw ? JSON.parse(raw) : null;
      if (parsed) return migrateData(parsed);
    } catch (e) { return null; }
    return null;
  }

  function saveLocal() {
    try {
      localStorage.setItem(STORE, JSON.stringify(_data));
    } catch (e) { console.error('Error persistencia local', e); }
  }

  function migrateData(data) {
    // Mantener compatibilidad Km -> Horas
    if (data.vehicles) {
      data.vehicles.forEach(function (v) {
        if (v.mileage !== undefined) { v.hours = v.mileage; delete v.mileage; }
      });
    }
    if (data.workOrders) {
      data.workOrders.forEach(function (w) {
        if (w.km !== undefined) { w.vehicleHours = w.km; delete w.km; }
        // 🔹 Sistema de Auto-Sanado (Auto-Healing) para OTs Preventivas Fantasmas
        // Si fue creada antes del Poka-Yoke y le falta el enlance a la rutina madre,
        // se degrada a OT normal para evitar que crashee la lógica de cierre (workorders.js).
        if (w.isPreventive && !w.routineId) {
          w.isPreventive = false;
        }
      });
    }
    return data;
  }

  // ── 2. CLOUD SYNC ENGINE ───────────────────────────────────
  function initCloud() {
    if (typeof window.firebase_db === 'undefined') {
      console.warn('⚠️ Firebase no detectado. Operando solo en modo local.');
      return;
    }

    _isCloudReady = true;
    var lightCols = ['categories', 'items', 'vehicles', 'preventiveRoutines', 'fuelLogs', 'vehicleDocuments', 'users', 'employees', 'positions'];
    var heavyCols = ['movements', 'workOrders'];

    // Escuchar Settings
    window.firebase_db.collection('settings').doc('config').onSnapshot(function (doc) {
      if (doc.exists) {
        _data.settings = Object.assign(_data.settings, doc.data());
        notify();
      }
    });

    // Carga Completa para Colecciones Ligeras
    lightCols.forEach(function (col) {
      window.firebase_db.collection(col).onSnapshot(function (snapshot) {
        if (snapshot.metadata.hasPendingWrites) return;
        var remoteData = snapshot.docs.map(function (doc) { return Object.assign({ id: doc.id }, doc.data()); });
        if (remoteData.length > 0) { _data[col] = remoteData; saveLocal(); notify(); }
      });
    });

    // Carga Paginada para Colecciones Pesadas con Smart Merge (V2.2)
    heavyCols.forEach(function(col) {
      window.firebase_db.collection(col)
        .orderBy('date', 'desc')
        .limit(30)
        .onSnapshot(function(snapshot) {
          if (snapshot.metadata.hasPendingWrites) return;
          var remoteData = snapshot.docs.map(function(doc) { return Object.assign({ id: doc.id }, doc.data()); });
          if (remoteData.length === 0) return;

          // 🧠 SMART MERGE ENGINE (Fusión Cíclica)
          var localData = _data[col] || [];
          var localMap = {};
          // Volcar datos actuales a un mapa para persistencia
          localData.forEach(function(d) { localMap[d.id] = d; });

          // 1. Determinar frontera cronológica (Oldest Remote)
          var oldestRemote = remoteData[remoteData.length - 1];
          var oldestDate = oldestRemote ? (oldestRemote.date || '') : '';

          // 2. Purga Dinámica (Manejo de Deletes)
          // Si un doc local está dentro de la ventana del Top 30 pero no vino en el lote -> Borrar
          Object.keys(localMap).forEach(function(id) {
            var doc = localMap[id];
            var docDate = doc.date || '';
            // Si el documento es más reciente o igual que el más viejo del Top 30 remoto
            if (docDate >= oldestDate) {
              var isPresent = remoteData.some(function(r) { return r.id === id; });
              if (!isPresent) delete localMap[id];
            }
          });

          // 3. Inyectar/Actualizar con datos remotos
          remoteData.forEach(function(r) { localMap[r.id] = r; });

          // 4. Reconstrucción y Ordenamiento
          var merged = Object.values(localMap);
          merged.sort(function(a, b) { 
            return (b.date || '') > (a.date || '') ? 1 : ( (b.date || '') < (a.date || '') ? -1 : 0 ); 
          });

          _data[col] = merged;
          _lastDocs[col] = snapshot.docs[snapshot.docs.length - 1]; // Mantener puntero para paginación
          saveLocal();
          notify();
        });
    });
  }

  function loadMore(col) {
    if (!_isCloudReady || !_lastDocs[col]) return;
    Utils.toast('Cargando registros anteriores...', 'info', 2000);
    window.firebase_db.collection(col)
      .orderBy('date', 'desc')
      .startAfter(_lastDocs[col])
      .limit(50)
      .get()
      .then(function (snap) {
        if (snap.empty) {
          _lastDocs[col] = null;
          Utils.toast('No hay más registros antiguos.', 'success');
          return;
        }

        var newRecords = snap.docs.map(function (doc) { return Object.assign({ id: doc.id }, doc.data()); });

        // Combinar sin duplicados
        newRecords.forEach(function (r) {
          if (!_data[col].find(function (x) { return x.id === r.id; })) {
            _data[col].push(r);
          }
        });

        // 🧠 ORDENAMIENTO POST-CARGA (V2.2): Mantener coherencia visual
        _data[col].sort(function(a, b) { 
          return (b.date || '') > (a.date || '') ? 1 : ( (b.date || '') < (a.date || '') ? -1 : 0 ); 
        });

        _lastDocs[col] = snap.docs[snap.docs.length - 1];
        notify();
      })
      .catch(function (e) {
        console.error('Error loadMore:', e);
      });
  }

  function notify() {
    _listeners.forEach(function (cb) { cb(_data); });
  }

  function onReady(cb) {
    _listeners.push(cb);
    cb(_data);
  }

  // ── 3. SYNCHRONOUS READS (Instant UI) ──────────────────────
  function getAll(collection) { 
    if (!_data[collection]) _data[collection] = [];
    return _data[collection]; 
  }
  function getById(collection, id) { return getAll(collection).find(function (r) { return r.id === id; }) || null; }
  function getSettings() { return Object.assign({}, _data.settings); }

  function nextOTNumber() {
    var num = _data.settings.nextOTNumber || 1;
    var year = new Date().getFullYear();
    // INCREMENTAR Y PERSISTIR (V2.1)
    _data.settings.nextOTNumber = num + 1;
    saveLocal();
    if (_isCloudReady) {
      window.firebase_db.collection('settings').doc('config').update({ nextOTNumber: num + 1 }).catch(console.error);
    }
    return 'OT-' + year + '-' + String(num).padStart(3, '0');
  }

  // ── 4. HYBRID WRITES (Poka-Yoke Client Side) ──────────────
  function create(collection, record) {
    if (!record.id) record.id = generateId();

    // 1. Local
    if (!_data[collection]) _data[collection] = [];
    _data[collection].push(record);
    saveLocal();

    // 2. Cloud (Background)
    if (_isCloudReady) {
      window.firebase_db.collection(collection).doc(record.id).set(record).catch(function (err) {
        console.error('Error sincronización Cloud:', err);
        Utils.toast('⚠️ Error de conexión: El cambio se guardó solo localmente.', 'warning');
      });
    }
    return record.id;
  }

  function update(collection, id, changes) {
    var idx = (_data[collection] || []).findIndex(function (r) { return r.id === id; });
    if (idx === -1) return false;

    // 1. Local
    Object.assign(_data[collection][idx], changes);
    saveLocal();

    // 2. Cloud
    if (_isCloudReady) {
      window.firebase_db.collection(collection).doc(id).update(changes).catch(function (err) {
        console.error('Error sincronización Cloud:', err);
        Utils.toast('⚠️ Error de conexión: Actualización solo local.', 'warning');
      });
    }
    return true;
  }

  function remove(collection, id) {
    // 🛡️ REGLAS POKA-YOKE (Validación previa al borrado)
    if (collection === 'categories') {
      if (getAll('items').some(function (i) { return i.categoryId === id; }))
        throw new Error('No se puede eliminar una categoría con artículos asociados.');
    }
    if (collection === 'items') {
      if (getAll('movements').some(function (m) { return m.itemId === id; }))
        throw new Error('No se puede eliminar un artículo con historial de movimientos.');
    }
    if (collection === 'vehicles') {
      if (getAll('workOrders').some(function (w) { return w.vehicleId === id; }) ||
        getAll('fuelLogs').some(function (f) { return f.vehicleId === id; }))
        throw new Error('No se puede eliminar un vehículo con historial de registros.');
    }
    if (collection === 'users' && id === _data.settings.activeUserId) {
      throw new Error('No puedes eliminar el usuario activo.');
    }

    // 1. Local
    var arr = _data[collection];
    var idx = arr.findIndex(function (r) { return r.id === id; });
    if (idx !== -1) {
      arr.splice(idx, 1);
      saveLocal();
    }

    // 2. Cloud
    if (_isCloudReady) {
      window.firebase_db.collection(collection).doc(id).delete().catch(console.error);
    }
    return true;
  }

  // ── 5. ATOMIC & TRANSACTIONS ───────────────────────────────
  function transaction(cb) {
    var backup = JSON.stringify(_data);
    try {
      var result = cb();
      saveLocal();
      return result;
    } catch (e) {
      _data = JSON.parse(backup);
      console.error('Transaction Error - Rollback:', e);
      throw e;
    }
  }

  function registerMovement(itemId, type, qty, options) {
    var item = getById('items', itemId);
    if (!item) return false;
    var opt = options || {};

    var sQty = Utils.safeNum(qty);
    var currentStock = Utils.safeNum(item.stock);
    var newStock = currentStock;

    if (type === 'entrada') newStock = Utils.dec.add(currentStock, sQty);
    else if (type === 'salida') newStock = Utils.dec.sub(currentStock, sQty);
    else if (type === 'ajuste') newStock = sQty;

    transaction(function () {
      update('items', itemId, { stock: newStock });

      var unitC = Utils.safeNum(opt.unitCost || item.unitCost || 0);
      var mov = Object.assign({
        itemId: itemId,
        itemName: item.name,
        type: type,
        qty: sQty,
        unitCost: unitC,
        totalCost: Utils.dec.mul(sQty, unitC), // dec.mul ya usa safeNum internamente tras mi cambio previo
        date: Utils.todayISO(),
        userId: _data.settings.activeUserId
      }, opt);
      create('movements', mov);
    });
    return true;
  }

  // ── 6. CLOUD TOOLS ─────────────────────────────────────────
  function uploadToCloud() {
    if (!_isCloudReady) return alert('Firebase no conectado.');
    if (!confirm('⚠️ ATENCIÓN: Se iniciará una sincronización masiva por lotes. ¿Deseas continuar?')) return;
    var collections = [
      'categories', 'items', 'movements', 'workOrders',
      'vehicles', 'preventiveRoutines', 'fuelLogs',
      'vehicleDocuments', 'users', 'employees', 'positions',
      'maintenanceLogs', 'hoursLogs'
    ];
    var CHUNK_SIZE = 450;
    // 1. Guardar configuración global primero
    window.firebase_db.collection('settings').doc('config').set(_data.settings)
      .then(function () {
        var sequence = Promise.resolve();
        
        collections.forEach(function (col) {
          var records = _data[col] || [];
          if (records.length === 0) return;
          // Dividir colección en trozos de 450
          for (var i = 0; i < records.length; i += CHUNK_SIZE) {
            (function (index, currentCol) {
              var chunk = records.slice(index, index + CHUNK_SIZE);
              sequence = sequence.then(function () {
                var batch = window.firebase_db.batch();
                chunk.forEach(function (record) {
                  var ref = window.firebase_db.collection(currentCol).doc(record.id);
                  batch.set(ref, record);
                });
                console.log('Sincronizando ' + currentCol + ': Lote desde ' + index);
                return batch.commit();
              });
            })(i, col);
          }
        });
        return sequence;
      })
      .then(function () {
        alert('✅ Sincronización industrial completada. Todos los registros han sido subidos en lotes seguros.');
      })
      .catch(function (e) {
        console.error('Fallo en sincronización masiva:', e);
        alert('❌ Error crítico: ' + e.message);
      });
  }

  function saveSettings(changes) {
    Object.assign(_data.settings, changes);
    saveLocal();
    if (_isCloudReady) {
      window.firebase_db.collection('settings').doc('config').update(changes).catch(console.error);
    }
  }

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }

  function seed() {
    return {
      categories: [
        { id: 'cat1', name: 'Repuestos Mecánicos', color: 'blue' },
        { id: 'cat2', name: 'Lubricantes', color: 'amber' }
      ],
      items: [], movements: [], workOrders: [], vehicles: [], preventiveRoutines: [],
      fuelLogs: [], vehicleDocuments: [], employees: [], positions: [],
      users: [{ id: 'u1', name: 'Admin local', role: 'admin', initials: 'AD', active: true }],
      settings: { nextOTNumber: 1, activeUserId: 'u1' }
    };
  }

  function exportAll() {
    return JSON.stringify(_data, null, 2);
  }

  function importAll(jsonStr) {
    try {
      var parsed = JSON.parse(jsonStr);
      if (parsed && typeof parsed === 'object') {
        _data = migrateData(parsed);
        saveLocal();
        notify();
        return true;
      }
    } catch (e) {
      console.error('Error importing backup:', e);
      return false;
    }
    return false;
  }

  function reset() {
    _data = seed();
    saveLocal();
    notify();
  }

  // Auto-init
  init();

  return {
    getAll: getAll,
    getById: getById,
    create: create,
    update: update,
    remove: remove,
    getSettings: getSettings,
    saveSettings: saveSettings,
    nextOTNumber: nextOTNumber,
    registerMovement: registerMovement,
    generateId: generateId,
    onReady: onReady,
    on: onReady, // ALIAS RESTAURADO (V2.1)
    uploadToCloud: uploadToCloud,
    loadMore: loadMore,
    transaction: transaction,
    exportAll: exportAll,
    importAll: importAll,
    reset: reset,
    isCloudReady: function () { return _isCloudReady; }
  };
})();
