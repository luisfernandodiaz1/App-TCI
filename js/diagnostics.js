/* ============================================================
   DIAGNOSTICS.JS — Sistema de Auditoría e Integridad TCI 🔍
   ============================================================ */

var DiagnosticsModule = (function () {
  'use strict';

  var _results = {
    inventory: { status: 'pending', errors: [], ok: 0, total: 0 },
    referential: { status: 'pending', errors: [], ok: 0, total: 0 },
    fleet: { status: 'pending', errors: [], ok: 0, total: 0 },
    sync: { status: 'pending', info: '' }
  };

  function runFullScan() {
    showModal();
    // Iniciar con retraso para permitir que el modal se dibuje
    setTimeout(function() {
      // 1. Inventario
      _results.inventory = checkInventory();
      updateUI('inventory');
      
      // 2. Integridad Referencial
      _results.referential = checkReferential();
      updateUI('referential');

      // 3. Salud de Flota
      _results.fleet = checkFleet();
      updateUI('fleet');

      // 4. Sincronización
      _results.sync = checkSync();
      updateUI('sync');
    }, 500);
  }

  function checkInventory() {
    var items = DB.getAll('items');
    var movs = DB.getAll('movements');
    var errors = [];
    var okCount = 0;

    items.forEach(function (item) {
      var itemMovs = movs.filter(function (m) { return m.itemId === item.id; });
      var theoretical = 0;
      itemMovs.forEach(function (m) {
        var q = Utils.safeNum(m.qty);
        if (m.type === 'entrada') theoretical = Utils.dec.add(theoretical, q);
        else if (m.type === 'salida') theoretical = Utils.dec.sub(theoretical, q);
        else if (m.type === 'ajuste') theoretical = q;
      });

      var actual = Utils.safeNum(item.stock);
      var diff = Utils.dec.sub(theoretical, actual);
      
      if (Math.abs(diff) > 0.001) {
        errors.push({
          id: item.id,
          name: item.name,
          diff: diff,
          expected: theoretical,
          actual: actual
        });
      } else {
        okCount++;
      }
    });

    return {
      status: errors.length > 0 ? 'error' : 'success',
      errors: errors,
      ok: okCount,
      total: items.length
    };
  }

  function checkReferential() {
    var wos = DB.getAll('workOrders');
    var vehs = DB.getAll('vehicles');
    var items = DB.getAll('items');
    var emps = DB.getAll('employees');
    var errors = [];
    var totalChecks = wos.length;

    wos.forEach(function (w) {
      // Vehículo
      if (w.vehicleId && !vehs.find(function(v){ return v.id === w.vehicleId; })) {
        errors.push('OT ' + (w.number || w.id) + ': Vehículo no encontrado (ID: ' + w.vehicleId + ')');
      }
      // Materiales
      (w.materials || []).forEach(function (m) {
        if (m.itemId && !items.find(function(i){ return i.id === m.itemId; })) {
          errors.push('OT ' + (w.number || w.id) + ': Material "' + m.itemName + '" borrado del inventario.');
        }
      });
      // Mecánicos
      if (w.mechanicId && !emps.find(function(e){ return e.id === w.mechanicId; })) {
        errors.push('OT ' + (w.number || w.id) + ': Mecánico principal no encontrado.');
      }
    });

    return {
      status: errors.length > 0 ? 'warning' : 'success',
      errors: errors,
      ok: totalChecks - errors.length,
      total: totalChecks
    };
  }

  function checkFleet() {
    var vehs = DB.getAll('vehicles');
    var fuel = DB.getAll('fuelLogs');
    var errors = [];

    vehs.forEach(function (v) {
      if (!v.active) return;
      var currentHrs = Utils.safeNum(v.hours);
      // Horas desfasadas en combustible
      var vFuel = fuel.filter(function(f){ return f.vehicleId === v.id; });
      vFuel.forEach(function(f){
        if (Utils.safeNum(f.hours) > (currentHrs + 200)) { 
          errors.push('Vehículo ' + v.plate + ': Ticket de combustible con horas (' + f.hours + ') superiores al horómetro actual (' + currentHrs + ')');
        }
      });
    });

    return {
      status: errors.length > 0 ? 'warning' : 'success',
      errors: errors,
      ok: vehs.length - errors.length,
      total: vehs.length
    };
  }

  function checkSync() {
    var isReady = DB.isCloudReady();
    return {
      status: isReady ? 'success' : 'info',
      info: isReady ? 'Conectado a Firebase Cloud. Datos sincronizados.' : 'Operando en Modo Local. No hay respaldo en la nube.'
    };
  }

  function showModal() {
    var old = document.getElementById('diag-modal'); if (old) old.remove();
    var html = '<div class="modal-overlay" id="diag-modal" style="z-index:9000;"><div class="modal modal-lg">' +
      '<div class="modal-header"><h3>🛡️ Diagnóstico de Salud TCI</h3><button class="modal-close" id="diag-close">✕</button></div>' +
      '<div class="modal-body" id="diag-body">' +
      '<div class="empty-state" id="diag-loading"><div class="spinner-sm"></div><p>Escaneando integridad de datos...</p></div>' +
      '</div>' +
      '<div class="modal-footer"><button class="btn btn-secondary" id="diag-exit">Cerrar Diagnóstico</button></div>' +
      '</div></div>';

    document.body.insertAdjacentHTML('beforeend', html);
    document.getElementById('diag-close').onclick = function () { document.getElementById('diag-modal').remove(); };
    document.getElementById('diag-exit').onclick = function () { document.getElementById('diag-modal').remove(); };
  }

  function updateUI(key) {
    var body = document.getElementById('diag-body');
    var loading = document.getElementById('diag-loading');
    if (loading) loading.remove();

    var res = _results[key];
    var statusIcon = { success: '✅', warning: '⚠️', error: '🚨', info: 'ℹ️' }[res.status];
    var statusLabel = { success: 'Excelente', warning: 'Observaciones', error: 'Atención', info: 'Estado' }[res.status];
    
    var sectionId = 'diag-sec-' + key;
    var existing = document.getElementById(sectionId);
    if (existing) existing.remove();

    var titleMap = { 
      inventory: 'Integridad del Almacén', 
      referential: 'Integridad Operativa (OTs)', 
      fleet: 'Estado de la Flota (Horómetros)', 
      sync: 'Salud de la Nube' 
    };
    
    var title = titleMap[key];
    var sub = (res.total || res.total === 0) ? (res.ok + ' / ' + res.total + ' registros correctos') : (res.info || '');

    var cls = res.status === 'success' ? 'green' : (res.status === 'error' ? 'red' : 'amber');
    if (res.status === 'info') cls = 'blue';

    var html = '<div class="card" id="' + sectionId + '" style="margin-bottom:12px;border-left:4px solid var(--color-' + (res.status === 'success' ? 'success' : (res.status === 'error' ? 'danger' : 'warning')) + ');">' +
      '<div class="flex justify-between items-center">' +
      '<div>' +
      '<div class="font-medium">' + statusIcon + ' ' + title + '</div>' +
      '<div class="text-xs text-muted">' + sub + '</div>' +
      '</div>' +
      '<div class="badge badge-' + cls + '">' + statusLabel + '</div>' +
      '</div>';

    if (res.errors && res.errors.length > 0) {
      html += '<div style="margin-top:12px;max-height:120px;overflow-y:auto;background:var(--bg-elevated);padding:8px;border-radius:6px;font-size:0.75rem;">' +
        res.errors.map(function (e) {
          var msg = typeof e === 'string' ? e : (e.name + ': Diferencia de ' + Utils.fmtNum(e.diff) + ' ' + (e.diff > 0 ? 'sobrantes' : 'faltantes'));
          return '<div style="margin-bottom:4px;border-bottom:1px solid var(--border);padding-bottom:4px;color:var(--text-secondary);">↳ ' + Utils.escapeHtml(msg) + '</div>';
        }).join('') +
        '</div>';
    }
    
    html += '</div>';
    body.insertAdjacentHTML('beforeend', html);
  }

  return {
    runFullScan: runFullScan
  };
})();
