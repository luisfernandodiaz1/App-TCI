/* ============================================================
   VEHICLES.JS — Vehicle fleet management module
   ============================================================ */

var VehiclesModule = (function () {
  'use strict';

  var searchText = '', filterType = '', filterDept = '', filterStatus = 'active', activeTab = 'flota';
  var kmDiarioDate = ''; // Fecha seleccionada en el panel de Horómetro Diario
  var combFilterVehicle = '', combFilterFrom = '', combFilterTo = ''; // Filtros del tab Combustible

  var VEHICLE_TYPES = ['Camión', 'Camioneta', 'Automóvil', 'Motocicleta', 'Tracto', 'Maquinaria', 'Bus', 'Furgoneta', 'Otro'];

  var TYPE_ICONS = {
    'Camión': '🚛', 'Camioneta': '🛻', 'Automóvil': '🚗', 'Motocicleta': '🏍️',
    'Tracto': '🚚', 'Maquinaria': '🏗️', 'Bus': '🚌', 'Furgoneta': '🚐', 'Otro': '🚙'
  };

  var DOC_TYPE_NAMES = {
    soat: 'SOAT', tecno: 'Revisión Tecnomecánica', extra: 'Seguro Extracontractual',
    todo: 'Seguro Todo Riesgo', tarjeta: 'Tarjeta de Propiedad', impuesto: 'Impuesto Vehicular'
  };

  // ── Main Render ────────────────────────────────────────────
  function render() {
    var vehicles = getFiltered();
    var allVehicles = DB.getAll('vehicles');
    var wos = DB.getAll('workOrders');
    var depts = allVehicles.map(function (v) { return v.department; })
      .filter(Boolean)
      .filter(function (v, i, a) { return a.indexOf(v) === i; });

    // KPIs
    var activeCount = allVehicles.filter(function (v) { return v.active; }).length;
    var withOTs = wos.map(function (w) { return w.vehicleId; })
      .filter(function (v, i, a) { return v && a.indexOf(v) === i; }).length;
    var openOTs = wos.filter(function (w) { return w.vehicleId && (w.status === 'emitida' || w.status === 'en_proceso'); }).length;

    var html = '<div class="section-header">' +
      '<div class="section-header-left"><h2>🚗 Vehículos</h2></div>' +
      '<div class="flex gap-2">' +
      '<button class="btn btn-secondary btn-sm" id="veh-export">📤 Exportar Excel</button>' +
      '<button class="btn btn-primary" id="veh-add" style="display:' + (activeTab === 'flota' ? 'block' : 'none') + ';">+ Nuevo Vehículo</button>' +
      '</div>' +
      '</div>' +
      '<div class="form-tabs" style="margin-bottom:20px;">' +
      '<button class="tab-btn ' + (activeTab === 'flota' ? 'active' : '') + '" id="tab-flota">🚗 Flota Vehicular</button>' +
      '<button class="tab-btn ' + (activeTab === 'preventivos' ? 'active' : '') + '" id="tab-prev">📅 Alertas Preventivas</button>' +
      '<button class="tab-btn ' + (activeTab === 'kmdiario' ? 'active' : '') + '" id="tab-hrs">📍 Horómetro Diario</button>' +
      '<button class="tab-btn ' + (activeTab === 'combustible' ? 'active' : '') + '" id="tab-comb">⛽ Combustible</button>' +
      '</div>';

    if (activeTab === 'flota') {
      html += renderFlota(vehicles, allVehicles, wos, depts);
    } else if (activeTab === 'kmdiario') {
      html += renderKmDiario(allVehicles);
    } else if (activeTab === 'combustible') {
      html += renderCombustible(allVehicles);
    } else {
      html += renderPreventivos(allVehicles);
    }

    document.getElementById('section-vehicles').innerHTML = html;

    // Events Globales
    document.getElementById('tab-flota').onclick = function () { activeTab = 'flota'; VehiclesModule.render(); };
    document.getElementById('tab-prev').onclick = function () { activeTab = 'preventivos'; VehiclesModule.render(); };
    document.getElementById('tab-hrs').onclick = function () { activeTab = 'kmdiario'; VehiclesModule.render(); };
    document.getElementById('tab-comb').onclick = function () { activeTab = 'combustible'; VehiclesModule.render(); };
    document.getElementById('veh-export').onclick = exportExcel;
    var btnAdd = document.getElementById('veh-add');
    if (btnAdd) btnAdd.onclick = function () { showVehicleModal(); };

    // Events Flota
    if (activeTab === 'flota') {
      var si = document.getElementById('veh-search');
      if (si) si.oninput = Utils.debounce(function () { searchText = si.value; render(); }, 250);
      var ft = document.getElementById('veh-ftype');
      if (ft) ft.onchange = function () { filterType = ft.value; render(); };
      var fd = document.getElementById('veh-fdept');
      if (fd) fd.onchange = function () { filterDept = fd.value; VehiclesModule.render(); };
      var fs = document.getElementById('veh-fstatus');
      if (fs) fs.onchange = function () { filterStatus = fs.value; VehiclesModule.render(); };
      var gotoKm = document.getElementById('km-goto-tab');
      if (gotoKm) gotoKm.onclick = function (e) { e.preventDefault(); activeTab = 'kmdiario'; VehiclesModule.render(); };
    }
    if (activeTab === 'kmdiario') {
      var dateSel = document.getElementById('km-date-sel');
      if (dateSel) dateSel.onchange = function () {
        kmDiarioDate = dateSel.value.length === 7 ? dateSel.value + '-01' : dateSel.value;
        render();
      };
      // Event delegation for cells
      var table = document.getElementById('km-matrix-table');
      if (table) {
        table.onclick = function (e) {
          var cell = e.target.closest('.km-cell');
          if (cell) {
            VehiclesModule.showKmEntryModal(cell.dataset.veh, cell.dataset.date);
          }
        };
      }
    }
    if (activeTab === 'combustible') {
      var cbVeh = document.getElementById('comb-filter-veh');
      if (cbVeh) cbVeh.onchange = function () { combFilterVehicle = cbVeh.value; render(); };
      var cbFrom = document.getElementById('comb-filter-from');
      if (cbFrom) cbFrom.onchange = function () { combFilterFrom = cbFrom.value; render(); };
      var cbTo = document.getElementById('comb-filter-to');
      if (cbTo) cbTo.onchange = function () { combFilterTo = cbTo.value; render(); };
      var cbExp = document.getElementById('comb-export-btn');
      if (cbExp) cbExp.onclick = exportCombustible;
      var cbReg = document.getElementById('comb-register-btn');
      if (cbReg) cbReg.onclick = function () {
        var sel = document.getElementById('comb-filter-veh').value;
        showFuelTicketModal(sel);
      };
    }
  }

  function renderFlota(vehicles, allVehicles, wos, depts) {
    var activeCount = allVehicles.filter(function (v) { return v.active; }).length;
    var inMaintenance = allVehicles.filter(function (v) {
      return v.active && isVehicleInMaintenance(v.id).inMaintenance;
    }).length;

    var today = Utils.todayISO();
    var allHoursLogs = DB.getAll('hoursLogs');
    var activeVehicles = allVehicles.filter(function (v) { return v.active; });
    var withHrsToday = activeVehicles.filter(function (v) {
      return allHoursLogs.some(function (l) { return l.vehicleId === v.id && l.date === today; });
    }).length;
    var missingHoursToday = activeVehicles.length - withHrsToday;

    var html = '<div class="grid-4" style="margin-bottom:16px;">' +
      kpi('✅', 'En Operación', (activeCount - inMaintenance), 'blue', 'Activos y disponibles') +
      kpi('🛠️', 'En Taller', inMaintenance, inMaintenance > 0 ? 'red' : 'green', 'En mantenimiento') +
      kpi('📋', 'Total en Flota', allVehicles.length, 'cyan', 'Activos + Inactivos') +
      kpi('📍', 'Sin Horas Hoy', missingHoursToday, missingHoursToday > 0 ? 'amber' : 'green') +
      '</div>';

    if (missingHoursToday > 0) {
      html += '<div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.3);border-radius:var(--radius-md);padding:10px 16px;margin-bottom:16px;display:flex;align-items:center;gap:10px;">' +
        '<span style="font-size:1.2rem;">⚠️</span>' +
        ' <strong>' + missingHoursToday + ' vehículos</strong> sin horas registradas hoy' +
        ' · <a href="#" id="km-goto-tab" style="color:var(--accent-primary);text-decoration:none;font-weight:600;">→ Ver Horas Diarias</a></div>';
    }

    html += '<div class="toolbar">' +
      '<div class="search-bar"><span>🔍</span><input type="text" placeholder="Buscar por placa, marca o modelo..." id="veh-search" value="' + Utils.escapeHtml(searchText) + '"></div>' +
      '<select class="filter-select" id="veh-ftype"><option value="">Todos los tipos</option>' +
      VEHICLE_TYPES.map(function (t) { return '<option value="' + t + '"' + (filterType === t ? ' selected' : '') + '>' + t + '</option>'; }).join('') +
      '</select>' +
      '<select class="filter-select" id="veh-fdept"><option value="">Todos los dept.</option>' +
      depts.map(function (d) { return '<option value="' + d + '"' + (filterDept === d ? ' selected' : '') + '>' + d + '</option>'; }).join('') +
      '</select>' +
      '<select class="filter-select" id="veh-fstatus">' +
      '<option value="active"' + (filterStatus === 'active' ? ' selected' : '') + '>Solo activos</option>' +
      '<option value="all"' + (filterStatus === 'all' ? ' selected' : '') + '>Todos</option>' +
      '<option value="inactive"' + (filterStatus === 'inactive' ? ' selected' : '') + '>Inactivos</option>' +
      '</select>' +
      '<span class="text-secondary text-sm">' + vehicles.length + ' vehículos</span>' +
      '</div>';

    if (!vehicles.length) {
      html += '<div class="card"><div class="empty-state"><div class="empty-state-icon">🚗</div><h3>Sin vehículos</h3><p>Agrega el primer vehículo de tu flota o ajusta los filtros.</p></div></div>';
    } else {
      html += '<div class="grid-3" id="veh-grid">' + vehicles.map(function (v) { return vehicleCard(v, wos); }).join('') + '</div>';
    }
    return html;
  }

  function renderPreventivos(allVehicles) {
    var routines = DB.getAll('preventiveRoutines').filter(function (r) { return r.active; });
    var allDocs = DB.getAll('vehicleDocuments');
    var today = Utils.todayISO();

    // ── Alertas de Mantenimiento Preventivo ─────────────────
    var alerts = [];
    routines.forEach(function (r) {
      var v = allVehicles.find(function (x) { return x.id === r.vehicleId; });
      if (!v || !v.active) return;

      var isDue = false;
      var isWarning = false;
      var statusMsg = '';

      var hoursDiff = (r.lastPerformedHours + r.frequencyHours) - (v.hours || 0);

      if (hoursDiff <= 0) { isDue = true; statusMsg = 'Vencido por horas (' + Math.abs(hoursDiff) + ' hrs)'; }
      else if (hoursDiff <= 100) { isWarning = true; statusMsg = 'Próximo (' + hoursDiff + ' hrs faltantes)'; }

      var nextDateStr = new Date(new Date(r.lastPerformedDate).getTime() + (r.frequencyDays * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];
      var daysDiff = Math.floor((new Date(nextDateStr) - new Date()) / (1000 * 60 * 60 * 24));

      if (!isDue) {
        if (daysDiff <= 0) { isDue = true; statusMsg = 'Vencido por fecha (Hace ' + Math.abs(daysDiff) + ' días)'; }
        else if (daysDiff <= 15) {
          if (!isWarning || daysDiff < Math.round(hoursDiff / 8)) {
            isWarning = true; statusMsg = 'Próximo por fecha (En ' + daysDiff + ' días)';
          }
        }
      }
      if (!isDue && !isWarning) {
        statusMsg = 'Al día (Próx. a los ' + (r.lastPerformedHours + r.frequencyHours) + ' hrs)';
      }
      alerts.push({ routine: r, vehicle: v, isDue: isDue, isWarning: isWarning, msg: statusMsg, hoursDiff: hoursDiff, daysDiff: daysDiff });
    });

    alerts.sort(function (a, b) {
      if (a.isDue && !b.isDue) return -1;
      if (!a.isDue && b.isDue) return 1;
      if (a.isWarning && !b.isWarning) return -1;
      if (!a.isWarning && b.isWarning) return 1;
      return a.hoursDiff - b.hoursDiff;
    });

    // ── Alertas de Documentos Legales ───────────────────────
    var docAlerts = [];
    allVehicles.filter(function (v) { return v.active; }).forEach(function (v) {
      var vDocs = allDocs.filter(function (d) { return d.vehicleId === v.id; });
      vDocs.forEach(function (d) {
        var daysLeft = Math.floor((new Date(d.expiry) - new Date(today)) / 864e5);
        if (daysLeft <= 30) {
          docAlerts.push({ vehicle: v, doc: d, daysLeft: daysLeft });
        }
      });
    });
    docAlerts.sort(function (a, b) { return a.daysLeft - b.daysLeft; });

    var numDue = alerts.filter(function (a) { return a.isDue; }).length;
    var numWarn = alerts.filter(function (a) { return a.isWarning; }).length;
    var numDocsDue = docAlerts.filter(function (a) { return a.daysLeft < 0; }).length;
    var numDocsWarn = docAlerts.filter(function (a) { return a.daysLeft >= 0; }).length;

    var html = '<div class="grid-4" style="margin-bottom:24px;">' +
      kpi('🚨', 'Mttos. Vencidos', numDue, 'red') +
      kpi('⚠️', 'Próximos Mtto.', numWarn, 'amber') +
      kpi('🪪', 'Docs. Vencidos', numDocsDue, numDocsDue > 0 ? 'red' : 'green') +
      kpi('📅', 'Docs. Por Vencer', numDocsWarn, numDocsWarn > 0 ? 'amber' : 'green') +
      '</div>';

    // Tabla de mantenimientos
    if (!alerts.length) {
      html += '<div class="card"><div class="empty-state"><div class="empty-state-icon">📅</div><h3>Sin rutinas</h3><p>Configura los planes de mantenimiento preventivo desde la ficha de cada vehículo.</p></div></div>';
    } else {
      html += '<div class="card" style="padding:0;margin-bottom:20px;"><div class="card-header" style="padding:16px 20px;"><h3>⚙️ Mantenimientos Preventivos</h3></div>' +
        '<div class="table-wrapper"><table><thead><tr>' +
        '<th>Vehículo</th><th>Rutina de Mantenimiento</th><th>Frecuencia</th><th>Último Mtto.</th><th>Estado</th><th>Acciones</th>' +
        '</tr></thead><tbody>' +
        alerts.map(function (a) {
          var badge = a.isDue ? '<span class="badge badge-red">Vencido</span>' : (a.isWarning ? '<span class="badge badge-amber">Próximo</span>' : '<span class="badge badge-green">Al día</span>');
          var trStyle = a.isDue ? 'background-color:rgba(239,68,68,0.05);' : (a.isWarning ? 'background-color:rgba(245,158,11,0.05);' : '');
          return '<tr style="' + trStyle + '">' +
            '<td><strong>' + Utils.escapeHtml(a.vehicle.plate) + '</strong><div class="text-xs text-secondary">' + Utils.escapeHtml(a.vehicle.brand + ' ' + a.vehicle.model) + '</div></td>' +
            '<td><strong style="color:var(--accent-primary);">' + Utils.escapeHtml(a.routine.name) + '</strong></td>' +
            '<td class="text-sm">Cada ' + Utils.fmtNum(a.routine.frequencyHours) + ' hrs<br>o ' + a.routine.frequencyDays + ' días</td>' +
            '<td class="text-sm">' + Utils.fmtNum(a.routine.lastPerformedHours) + ' hrs<br>' + Utils.formatDate(a.routine.lastPerformedDate) + '</td>' +
            '<td>' + badge + '<div class="text-xs ' + (a.isDue ? 'text-red' : (a.isWarning ? 'text-amber' : 'text-muted')) + '" style="margin-top:4px;">' + a.msg + '</div></td>' +
            '<td>' +
            (a.isDue || a.isWarning ? '<button class="btn btn-primary btn-sm" style="gap:6px;" onclick="WorkOrdersModule.showWizard(\'' + a.vehicle.id + '\',{routineId:\'' + a.routine.id + '\',routineName:\'' + Utils.escapeHtml(a.routine.name).replace(/'/g, "\\'") + '\',isPreventive:true,priority:\'alta\'})">🔧 Crear OT Preventiva</button>' : '') +
            '</td>' +
            '</tr>';
        }).join('') +
        '</tbody></table></div></div>';
    }

    // Tabla de documentos
    if (docAlerts.length) {
      html += '<div class="card" style="padding:0;"><div class="card-header" style="padding:16px 20px;"><h3>🪦 Documentos Legales por Vencer / Vencidos</h3></div>' +
        '<div class="table-wrapper"><table><thead><tr>' +
        '<th>Vehículo</th><th>Documento</th><th>Vencimiento</th><th>Estado</th><th>Acción</th>' +
        '</tr></thead><tbody>' +
        docAlerts.map(function (a) {
          var badge = a.daysLeft < 0
            ? '<span class="badge badge-red">🔴 Vencido hace ' + Math.abs(a.daysLeft) + ' días</span>'
            : '<span class="badge badge-amber">🟡 Vence en ' + a.daysLeft + ' días</span>';
          var trStyle = a.daysLeft < 0 ? 'background:rgba(239,68,68,0.05);' : 'background:rgba(245,158,11,0.05);';
          return '<tr style="' + trStyle + '">' +
            '<td><strong>' + Utils.escapeHtml(a.vehicle.plate) + '</strong><div class="text-xs text-secondary">' + Utils.escapeHtml(a.vehicle.brand + ' ' + a.vehicle.model) + '</div></td>' +
            '<td><strong>' + Utils.escapeHtml(DOC_TYPE_NAMES[a.doc.type] || a.doc.type) + '</strong></td>' +
            '<td>' + Utils.formatDate(a.doc.expiry) + '</td>' +
            '<td>' + badge + '</td>' +
            '<td><button class="btn btn-secondary btn-sm" onclick="VehiclesModule.showHistory(\'' + a.vehicle.id + '\')">📂 Ver ficha</button></td>' +
            '</tr>';
        }).join('') +
        '</tbody></table></div></div>';
    } else {
      html += '<div class="card"><div class="empty-state"><div class="empty-state-icon">🪦</div><p>Todos los documentos legales de la flota están vigentes y al día. ✅</p></div></div>';
    }

    return html;
  }

  function kpi(icon, label, val, color) {
    return '<div class="kpi-card ' + color + '"><div class="kpi-icon ' + color + '">' + icon + '</div><div class="kpi-value">' + val + '</div><div class="kpi-label">' + label + '</div></div>';
  }

  function getFiltered() {
    var vehicles = DB.getAll('vehicles');
    if (filterStatus === 'active') vehicles = vehicles.filter(function (v) { return v.active; });
    if (filterStatus === 'inactive') vehicles = vehicles.filter(function (v) { return !v.active; });
    if (filterType) vehicles = vehicles.filter(function (v) { return v.type === filterType; });
    if (filterDept) vehicles = vehicles.filter(function (v) { return v.department === filterDept; });
    if (searchText) {
      var q = searchText.toLowerCase();
      vehicles = vehicles.filter(function (v) {
        return v.plate.toLowerCase().includes(q) || (v.brand || '').toLowerCase().includes(q) ||
          (v.model || '').toLowerCase().includes(q) || (v.department || '').toLowerCase().includes(q);
      });
    }
    return vehicles;
  }

  // ── Vehicle Card ───────────────────────────────────────────
  function vehicleCard(v, wos) {
    var vWOs = wos.filter(function (w) { return w.vehicleId === v.id; });
    var logs = DB.getAll('maintenanceLogs').filter(function (l) { return l.vehicleId === v.id; });
    var totalCost = vWOs.reduce(function (a, w) { return a + (w.totalCost || 0); }, 0) +
      logs.reduce(function (a, l) { return a + (l.totalCost || 0); }, 0);

    var icon = TYPE_ICONS[v.type] || '🚙';
    var today = Utils.todayISO();
    var users = DB.getAll('users');

    // ── Preventive semaphore ────────────────────────────────
    var pStatus = getVehiclePreventiveStatus(v);

    // ── Document semaphore (2.1) ────────────────────────────
    var docStatus = getVehicleDocStatus(v.id);

    // ── Daily inspection badge (2.2) ────────────────────────
    var inspections = DB.getAll('vehicleInspections');
    var hasInspToday = inspections.some(function (i) { return i.vehicleId === v.id && i.date === today; });

    // ── Assigned driver (2.5) ───────────────────────────────
    var driver = v.assignedDriverId ? users.find(function (u) { return u.id === v.assignedDriverId; }) : null;

    var openWOs = vWOs.filter(function (w) { return w.status === 'emitida' || w.status === 'en_proceso'; }).length;
    var maintStatus = isVehicleInMaintenance(v.id);

    // Border color: prioritize most urgent condition
    var borderColor = !v.active ? 'var(--text-muted)' :
      (maintStatus.inMaintenance ? 'var(--color-danger)' :
        (pStatus.isDue || docStatus.isExpired ? 'var(--color-danger)' :
          (pStatus.isWarning || docStatus.isWarning ? 'var(--color-warning)' :
            (openWOs > 0 ? 'var(--accent-primary)' : 'var(--color-success)'))));

    var semHtml = '';
    if (v.active && pStatus.routineName) {
      var semCls = pStatus.isDue ? 'vpa-due' : (pStatus.isWarning ? 'vpa-warn' : 'vpa-ok');
      var semIcon = pStatus.isDue ? '🔴' : (pStatus.isWarning ? '⚠️' : '🟢');
      semHtml = '<div class="vehicle-preventive-alert ' + semCls + '">' +
        '<span class="vpa-icon">' + semIcon + '</span>' +
        '<span class="vpa-name">' + Utils.escapeHtml(pStatus.routineName) + '</span>' +
        '<span class="vpa-msg">' + Utils.escapeHtml(pStatus.msg) + '</span>' +
        '</div>';
    }

    // Badge de documento vencido (2.1)
    var docBadgeHtml = '';
    if (v.active && docStatus.isExpired) {
      docBadgeHtml = '<div style="background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.3);border-radius:var(--radius-md);padding:4px 10px;margin-bottom:6px;font-size:0.75rem;font-weight:700;color:var(--color-danger);">'
        + '🔴 Doc. Vencido: ' + Utils.escapeHtml(docStatus.docName) + ' (hace ' + Math.abs(docStatus.daysLeft) + ' días)</div>';
    } else if (v.active && docStatus.isWarning) {
      docBadgeHtml = '<div style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:var(--radius-md);padding:4px 10px;margin-bottom:6px;font-size:0.75rem;font-weight:700;color:var(--color-warning);">'
        + '🟡 Doc. Por Vencer: ' + Utils.escapeHtml(docStatus.docName) + ' (en ' + docStatus.daysLeft + ' días)</div>';
    }

    // Badge de inspección diaria (2.2)
    var inspBadgeHtml = '';
    if (v.active) {
      inspBadgeHtml = hasInspToday
        ? '<span style="font-size:0.7rem;color:var(--color-success);font-weight:700;">✅ Insp. OK hoy</span>'
        : '<span style="font-size:0.7rem;color:var(--color-warning);font-weight:700;">⚠️ Sin insp. hoy</span>';
    }


    var topBadge = '';
    if (!v.active) {
      topBadge = '<span class="badge badge-gray" style="position:absolute;top:12px;right:12px;">Inactivo</span>';
    } else if (maintStatus.inMaintenance) {
      topBadge = '<span class="badge badge-red" style="position:absolute;top:12px;right:12px;">🔴 EN MANTTO. (' + maintStatus.downtimeDays + ' d)</span>';
    } else if (openWOs > 0) {
      topBadge = '<span class="badge badge-amber" style="position:absolute;top:12px;right:12px;">⚠️ ' + openWOs + ' OT</span>';
    }

    return '<div class="card vehicle-card" style="border-top:3px solid ' + borderColor + ';position:relative;">' +
      topBadge +

      '<div class="flex items-center gap-3" style="margin-bottom:12px;">' +
      '<div style="width:52px;height:52px;border-radius:var(--radius-lg);background:var(--bg-elevated);display:flex;align-items:center;justify-content:center;font-size:1.6rem;flex-shrink:0;">' + icon + '</div>' +
      '<div>' +
      '<div style="font-size:1.2rem;font-weight:800;letter-spacing:0.08em;color:var(--accent-cyan);">' + Utils.escapeHtml(v.plate) + '</div>' +
      '<div style="font-size:0.857rem;font-weight:600;color:var(--text-primary);">' + Utils.escapeHtml((v.brand || '') + ' ' + (v.model || '')) + '</div>' +
      '<div style="font-size:0.75rem;color:var(--text-muted);">' + Utils.escapeHtml(v.type || '') + ' · ' + v.year + (v.active ? ' · ' : '') + inspBadgeHtml + '</div>' +
      '</div>' +
      '</div>' +

      semHtml +
      docBadgeHtml +

      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 12px;margin-bottom:12px;">' +
      infoRow('🏢', 'Depto.', v.department) +
      infoRow('🎨', 'Color', v.color) +
      infoRow('📏', 'Horas', v.hours ? Utils.fmtNum(v.hours) + ' hrs' : '—') +
      infoRow('👤', 'Conductor', driver ? driver.name : 'Sin asignar') +
      '<div class="span-2" style="margin-top:4px;padding-top:4px;border-top:1px dashed var(--border);">' +
      infoRow('💰', 'Gasto Acumulado', '$ ' + Utils.fmtNum(totalCost)) +
      '</div>' +
      '</div>' +

      '<div class="flex gap-1">' +
      '<button class="btn btn-cyan btn-sm" style="flex:1;" onclick="VehiclesModule.showHistory(\'' + Utils.escapeHtml(v.id) + '\')">📋 Historial</button>' +
      '<button class="btn btn-ghost btn-sm" onclick="VehiclesModule.showVehicleModal(\'' + Utils.escapeHtml(v.id) + '\')">✏️</button>' +
      '<button class="btn btn-ghost btn-sm" onclick="VehiclesModule.toggleActive(\'' + Utils.escapeHtml(v.id) + '\')">'
      + (!v.active ? '✅' : '🔒') + '</button>' +
      '<button class="btn btn-ghost btn-sm" onclick="VehiclesModule.deleteVehicle(\'' + Utils.escapeHtml(v.id) + '\')">🗑️</button>' +
      '</div>' +
      '</div>';
  }

  function getVehicleDocStatus(vehicleId) {
    var docs = DB.getAll('vehicleDocuments').filter(function (d) { return d.vehicleId === vehicleId; });
    var today = Utils.todayISO();
    var worst = { isExpired: false, isWarning: false, docName: '', daysLeft: 999 };
    docs.forEach(function (d) {
      var daysLeft = Math.floor((new Date(d.expiry) - new Date(today)) / 864e5);
      var name = DOC_TYPE_NAMES[d.type] || d.type;
      if (daysLeft < 0 && (!worst.isExpired || daysLeft < worst.daysLeft)) {
        worst = { isExpired: true, isWarning: false, docName: name, daysLeft: daysLeft };
      } else if (!worst.isExpired && daysLeft <= 30 && daysLeft < worst.daysLeft) {
        worst = { isExpired: false, isWarning: true, docName: name, daysLeft: daysLeft };
      }
    });
    return worst;
  }

  function getVehiclePreventiveStatus(v) {
    var routines = DB.getAll('preventiveRoutines').filter(function (r) { return r.vehicleId === v.id && r.active; });
    if (!routines.length) return { isDue: false, isWarning: false, routineName: null, msg: '' };
    var best = null;
    routines.forEach(function (r) {
      var hoursDiff = (r.lastPerformedHours + r.frequencyHours) - (v.hours || 0);
      var nextDate = new Date(new Date(r.lastPerformedDate).getTime() + r.frequencyDays * 864e5).toISOString().split('T')[0];
      var daysDiff = Math.floor((new Date(nextDate) - new Date()) / 864e5);
      var isDue = (hoursDiff <= 0 || daysDiff <= 0);
      var isWarn = !isDue && (hoursDiff <= 100 || daysDiff <= 15);
      var severity = isDue ? 0 : (isWarn ? 1 : 2);
      var msg = isDue
        ? (hoursDiff <= 0 ? 'Vencido (' + Math.abs(hoursDiff) + ' hrs)' : 'Venció hace ' + Math.abs(daysDiff) + ' días')
        : (isWarn
          ? (hoursDiff <= 100 ? hoursDiff + ' hrs restantes' : daysDiff + ' días restantes')
          : 'Faltan ' + Math.min(hoursDiff, daysDiff * 8) + ' hrs / ' + daysDiff + ' días');
      if (!best || severity < best.severity) {
        best = { routineName: r.name, isDue: isDue, isWarning: isWarn, msg: msg, severity: severity };
      }
    });
    return best || { isDue: false, isWarning: false, routineName: null, msg: '' };
  }

  function infoRow(icon, label, val) {
    return '<div style="font-size:0.786rem;"><span style="color:var(--text-muted);">' + icon + ' ' + label + ': </span><span style="font-weight:500;">' + Utils.escapeHtml(String(val || '—')) + '</span></div>';
  }

  // ── Vehicle Modal ──────────────────────────────────────────
  function showVehicleModal(id) {
    var v = id ? DB.getById('vehicles', id) : null;
    var old = document.getElementById('veh-modal'); if (old) old.remove();

    var typeOpts = VEHICLE_TYPES.map(function (t) {
      return '<option value="' + t + '"' + (v && v.type === t ? ' selected' : '') + '>' + t + '</option>';
    }).join('');

    var html = '<div class="modal-overlay" id="veh-modal"><div class="modal modal-lg">' +
      '<div class="modal-header"><h3>' + (v ? '✏️ Editar Vehículo' : '🚗 Nuevo Vehículo') + '</h3><button class="modal-close" id="veh-mc">✕</button></div>' +
      '<div class="modal-body"><div class="form-grid">' +
      '<div class="form-group"><label>Placa *</label><input class="form-input" id="vf-plate" value="' + Utils.escapeHtml(v ? v.plate : '') + '" placeholder="ABC-123" style="text-transform:uppercase;font-weight:700;font-size:1rem;letter-spacing:0.05em;"></div>' +
      '<div class="form-group"><label>Tipo *</label><select class="form-select" id="vf-type"><option value="">Seleccionar...</option>' + typeOpts + '</select></div>' +
      '<div class="form-group"><label>Marca</label><input class="form-input" id="vf-brand" value="' + Utils.escapeHtml(v ? v.brand || '' : '') + '" placeholder="Toyota, Chevrolet..."></div>' +
      '<div class="form-group"><label>Modelo</label><input class="form-input" id="vf-model" value="' + Utils.escapeHtml(v ? v.model || '' : '') + '" placeholder="Hilux, NPR..."></div>' +
      '<div class="form-group"><label>Año</label><input class="form-input" type="number" id="vf-year" value="' + (v ? v.year : new Date().getFullYear()) + '" min="1990" max="2030"></div>' +
      '<div class="form-group"><label>Color</label><input class="form-input" id="vf-color" value="' + Utils.escapeHtml(v ? v.color || '' : '') + '" placeholder="Blanco, Rojo..."></div>' +
      '<div class="form-group"><label>Departamento / Área</label><input class="form-input" id="vf-dept" value="' + Utils.escapeHtml(v ? v.department || '' : '') + '" placeholder="Operaciones, Logística..."></div>' +
      '<div class="form-group"><label>Horómetro actual (Horas)</label><input class="form-input" type="number" id="vf-hrs" value="' + (v ? v.hours || 0 : 0) + '" min="0" placeholder="0"></div>' +
      '<div class="form-group span-2"><label>Notas</label><textarea class="form-textarea" id="vf-notes" rows="2" placeholder="Observaciones del vehículo...">' + Utils.escapeHtml(v ? v.notes || '' : '') + '</textarea></div>' +
      '</div></div>' +
      '<div class="modal-footer"><button class="btn btn-secondary" id="veh-mc2">Cancelar</button><button class="btn btn-primary" id="veh-sv">💾 Guardar</button></div>' +
      '</div></div>';

    document.body.insertAdjacentHTML('beforeend', html);
    var ov = document.getElementById('veh-modal');

    // Auto uppercase plate
    var plateInput = document.getElementById('vf-plate');
    if (plateInput) plateInput.oninput = function () { this.value = this.value.toUpperCase(); };

    function close() { ov.remove(); }
    document.getElementById('veh-mc').onclick = close;
    document.getElementById('veh-mc2').onclick = close;
    ov.onclick = function (e) { if (e.target === ov) close(); };

    document.getElementById('veh-sv').onclick = function () {
      var plate = document.getElementById('vf-plate').value.trim().toUpperCase();
      var type = document.getElementById('vf-type').value;
      if (!plate || !type) { Utils.toast('Placa y tipo son obligatorios.', 'warning'); return; }

      // Check duplicate plate
      var existing = DB.getAll('vehicles').find(function (x) { return x.plate === plate && (!v || x.id !== v.id); });
      if (existing) { Utils.toast('Ya existe un vehículo con esa placa.', 'error'); return; }

      var data = {
        plate: plate, type: type,
        brand: document.getElementById('vf-brand').value.trim(),
        model: document.getElementById('vf-model').value.trim(),
        year: parseInt(document.getElementById('vf-year').value) || new Date().getFullYear(),
        color: document.getElementById('vf-color').value.trim(),
        department: document.getElementById('vf-dept').value.trim(),
        hours: parseFloat(document.getElementById('vf-hrs').value) || 0,
        notes: document.getElementById('vf-notes').value.trim(),
        active: v ? v.active : true
      };

      // Poka-Yoke: Horómetro inicial obligatorio para vehículos nuevos
      if (!v) {
        if (data.hours <= 0) {
          Utils.toast('⚠️ Configuración Requerida: El horómetro inicial es obligatorio para el mantenimiento preventivo.', 'warning');
          return;
        }
      }

      if (v && data.hours < (v.hours || 0)) {
        Utils.toast('El horómetro no puede ser menor al valor actual registrado.', 'error');
        return;
      }

      if (v) {
        var oldPlate = v.plate;
        DB.transaction(function () {
          DB.update('vehicles', v.id, data);
          if (oldPlate !== data.plate) {
            DB.getAll('workOrders').filter(function (w) { return w.vehicleId === v.id; }).forEach(function (w) {
              DB.update('workOrders', w.id, { vehiclePlate: data.plate });
            });
            DB.getAll('fuelLogs').filter(function (f) { return f.vehicleId === v.id; }).forEach(function (f) {
              DB.update('fuelLogs', f.id, { vehiclePlate: data.plate });
            });
            DB.getAll('maintenanceLogs').filter(function (m) { return m.vehicleId === v.id; }).forEach(function (m) {
              DB.update('maintenanceLogs', m.id, { vehiclePlate: data.plate });
            });
          }
        });
        Utils.toast('Vehículo actualizado.', 'success');
      } else {
        data.createdAt = Utils.todayISO();
        DB.create('vehicles', data);
        Utils.toast('Vehículo creado.', 'success');
      }
      close(); render(); App.updateBadges();
    };
  }

  // ── Vehicle History Modal ──────────────────────────────────
  function showHistory(id) {
    var v = DB.getById('vehicles', id);
    if (!v) return;
    var wos = DB.getAll('workOrders').filter(function (w) { return w.vehicleId === id; }).slice().reverse();
    var logs = DB.getAll('maintenanceLogs').filter(function (l) { return l.vehicleId === id; });
    var users = DB.getAll('users');
    var uMap = {}; users.forEach(function (u) { uMap[u.id] = u.name; });

    var woCost = wos.reduce(function (acc, w) { return acc + (w.totalCost || 0); }, 0);
    var logCost = logs.reduce(function (acc, l) { return acc + (l.totalCost || 0); }, 0);
    var totalCost = woCost + logCost;

    var items = DB.getAll('items');
    var iMap = {}; items.forEach(function (i) { iMap[i.id] = i.name; });

    // Calculate total materials consumed
    var matTotals = {};
    wos.forEach(function (w) {
      (w.materials || []).forEach(function (m) {
        if (m.delivered && m.qtyDelivered > 0) {
          if (!matTotals[m.itemId]) matTotals[m.itemId] = { name: m.itemName, unit: m.unit, qty: 0 };
          matTotals[m.itemId].qty += m.qtyDelivered;
        }
      });
    });
    logs.forEach(function (l) {
      (l.materialsUsed || []).forEach(function (m) {
        if (!matTotals[m.id]) matTotals[m.id] = { name: m.name, unit: m.unit, qty: 0 };
        matTotals[m.id].qty += m.qty;
      });
    });
    var topMats = Object.values(matTotals).sort(function (a, b) { return b.qty - a.qty; }).slice(0, 8);

    var icon = TYPE_ICONS[v.type] || '🚙';
    var old = document.getElementById('hist-modal'); if (old) old.remove();

    var driver = users.find(function (u) { return u.id === v.assignedDriverId; });
    var ms = isVehicleInMaintenance(v.id);
    var badgeHtml = ms.inMaintenance ? ' <span class="badge badge-red" style="vertical-align:middle;margin-left:8px;font-size:0.75rem;">🔴 MANTENIMIENTO (' + ms.downtimeDays + ' d)</span>' : '';

    var html = '<div class="modal-overlay" id="hist-modal"><div class="modal modal-xl">' +
      '<div class="modal-header">' +
      '<div class="flex items-center gap-3">' +
      '<div style="font-size:2rem;">' + icon + '</div>' +
      '<div>' +
      '<h3 style="color:var(--accent-cyan);font-size:1.4rem;letter-spacing:0.08em;line-height:1.1;display:inline-block;margin:0;">' + Utils.escapeHtml(v.plate) + '</h3>' + badgeHtml +
      '<div style="font-size:0.75rem;color:var(--text-muted);">' + Utils.escapeHtml(v.brand + ' ' + v.model + ' ' + v.year) + ' · ' + Utils.escapeHtml(v.type) + '</div>' +
      '<div style="font-size:0.8rem;margin-top:4px;color:var(--accent-primary);display:flex;align-items:center;gap:6px;">' +
      '👤 ' + (driver ? Utils.escapeHtml(driver.name) : '<span class="text-muted">Sin conductor</span>') +
      '<button class="btn btn-ghost btn-xs" style="padding:0 4px;" onclick="VehiclesModule.showAssignDriverModal(\'' + id + '\')" title="Asignar Conductor">✏️</button>' +
      '</div>' +
      '</div>' +
      '</div>' +
      '<div class="flex gap-2">' +
      '<button class="btn btn-secondary btn-sm" onclick="VehiclesModule.exportVehicleExcel(\'' + id + '\')">📤 Exportar</button>' +
      '<button class="modal-close" id="hist-close">✕</button>' +
      '</div>' +
      '</div>' +
      '<div class="modal-body" style="padding:0;overflow:hidden;display:flex;flex-direction:column;height:650px;">' +
      '<div class="grid-4" style="padding:20px;background:var(--bg-card);border-bottom:1px solid var(--border);margin:0;">' +
      hKpi('📋', 'Total OTs', wos.length) +
      hKpi('✅', 'Completadas', wos.filter(function (w) { return w.status === 'completada'; }).length) +
      '<div style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-md);padding:12px 16px;text-align:center;">' +
      '<div style="font-size:1.3rem;">💰</div>' +
      '<div style="font-size:1.2rem;font-weight:800;color:var(--color-success);line-height:1.2;">$ ' + Utils.fmtNum(totalCost) + '</div>' +
      '<div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;">Costo Histórico</div>' +
      '</div>' +
      '<div style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-md);padding:12px 16px;text-align:center;position:relative;">' +
      '<div style="font-size:1.3rem;">📏</div>' +
      '<div style="font-size:1.2rem;font-weight:800;color:var(--accent-primary);line-height:1.2;">' + Utils.fmtNum(v.hours || 0) + '</div>' +
      '<div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;">Horas (Total)</div>' +
      '<button class="btn btn-ghost btn-sm" style="position:absolute;top:4px;right:4px;" onclick="VehiclesModule.promptUpdateKm(\'' + v.id + '\')">✏️</button>' +
      '</div>' +
      '</div>' +

      '<div class="tabs" style="padding:10px 20px;border-bottom:1px solid var(--border);background:var(--bg-card);">' +
      '<button class="tab-btn active" id="btn-vhist">📋 OTs</button>' +
      '<button class="tab-btn" id="btn-vlogs">⚡ Mttos</button>' +
      '<button class="tab-btn" id="btn-vdocs">📄 Documentos</button>' +
      '<button class="tab-btn" id="btn-vinsp">🔍 Inspección</button>' +
      '<button class="tab-btn" id="btn-vprev">⚙️ Config.</button>' +
      '</div>' +
      '<div style="padding:20px;overflow-y:auto;flex:1;">' +
      '<div id="sec-vhist">' +

      // Top materials consumed
      (topMats.length ? '<div class="card" style="margin-bottom:16px;padding:14px 18px;">' +
        '<div style="font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:var(--text-muted);margin-bottom:10px;">📦 Repuestos más usados</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:8px;">' +
        topMats.map(function (m) {
          return '<div style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-md);padding:6px 12px;font-size:0.786rem;">' +
            '<strong>' + m.qty + '</strong> <span class="text-muted">' + Utils.escapeHtml(m.unit) + '</span> — ' + Utils.escapeHtml(m.name) + '</div>';
        }).join('') +
        '</div></div>' : '') +

      // OT History table
      '<h4 style="margin-bottom:10px;">🔧 Historial de Órdenes de Trabajo</h4>' +
      (!wos.length ? '<div class="empty-state" style="padding:24px;"><div class="empty-state-icon">📭</div><p>Este vehículo no tiene OTs registradas.</p></div>' :
        '<div class="table-wrapper" style="border:1px solid var(--border);border-radius:var(--radius-lg);">' +
        '<table><thead><tr>' +
        '<th>Número</th><th>Fecha</th><th>Repuestos</th><th>Mano Obra</th><th>Externos</th><th>TOTAL</th><th>Estado</th><th>Técnico</th>' +
        '</tr></thead>' +
        '<tbody>' +
        wos.map(function (w) {
          var tech = DB.getById('employees', w.assignedTo);
          var matSum = (w.materials || []).reduce(function (acc, m) { return acc + (m.totalCost || 0); }, 0);
          // Priorizamos materialBase si existe (nuevo modelo), si no usamos la suma calculada
          var repuestos = w.materialBase !== undefined ? w.materialBase : matSum;
          var mo = w.laborCost || 0;
          var ext = w.externalCost || 0;

          return '<tr>' +
            '<td style="color:var(--accent-cyan);font-weight:700;">' + Utils.escapeHtml(w.number) + '</td>' +
            '<td>' + Utils.formatDate(w.date) + '</td>' +
            '<td>$ ' + Utils.fmtNum(repuestos) + '</td>' +
            '<td>$ ' + Utils.fmtNum(mo) + '</td>' +
            '<td>$ ' + Utils.fmtNum(ext) + '</td>' +
            '<td style="font-weight:700;color:var(--color-success);">$ ' + Utils.fmtNum(w.totalCost || 0) + '</td>' +
            '<td>' + Utils.otStatusBadge(w.status) + '</td>' +
            '<td><div class="text-xs">' + Utils.escapeHtml(tech ? tech.name : '—') + '</div></td>' +
            '</tr>';
        }).join('') +
        '</tbody></table></div>') +
      '</div>' + // End sec-vhist

      '<div id="sec-vlogs" style="display:none;"></div>' +
      '<div id="sec-vdocs" style="display:none;"></div>' +
      '<div id="sec-vinsp" style="display:none;"></div>' +
      '<div id="sec-vprev" style="display:none;"></div>' +
      '</div>' +
      '</div></div>';

    document.body.insertAdjacentHTML('beforeend', html);
    var ov = document.getElementById('hist-modal');
    document.getElementById('hist-close').onclick = function () { ov.remove(); };
    ov.onclick = function (e) { if (e.target === ov) ov.remove(); };

    // Set up tabs
    document.getElementById('btn-vhist').onclick = function () { setActiveTab('vhist'); };
    document.getElementById('btn-vlogs').onclick = function () { setActiveTab('vlogs'); renderMaintenanceLog(id); };
    document.getElementById('btn-vdocs').onclick = function () { setActiveTab('vdocs'); renderVehicleDocs(id); };
    document.getElementById('btn-vinsp').onclick = function () { setActiveTab('vinsp'); renderInspections(id); };
    document.getElementById('btn-vprev').onclick = function () { setActiveTab('vprev'); renderVehicleRoutines(id); };

    function setActiveTab(tab) {
      ['vhist', 'vlogs', 'vdocs', 'vinsp', 'vprev'].forEach(function (t) {
        var btn = document.getElementById('btn-' + t);
        var sec = document.getElementById('sec-' + t);
        if (btn) btn.classList.toggle('active', t === tab);
        if (sec) sec.style.display = (t === tab ? 'block' : 'none');
      });
    }
  }

  function renderMaintenanceLog(vehicleId) {
    var logs = DB.getAll('maintenanceLogs').filter(function (l) { return l.vehicleId === vehicleId; });
    var target = document.getElementById('sec-vlogs');
    if (!target) return;

    var html = '<h4 style="margin-bottom:16px;">Bitácora de Mantenimientos Exprés</h4>';
    if (!logs.length) {
      html += '<div class="empty-state" style="padding:24px;"><div class="empty-state-icon">⚡</div><p>No hay mantenimientos directos registrados.</p></div>';
    } else {
      html += '<div class="table-wrapper"><table><thead><tr>' +
        '<th>Fecha</th><th>Rutina</th><th>Horas</th><th>Costo</th><th>Personal / Notas</th><th>Acciones</th>' +
        '</tr></thead><tbody>' +
        logs.slice().reverse().map(function (l) {
          return '<tr>' +
            '<td>' + Utils.formatDate(l.date) + '</td>' +
            '<td><strong>' + Utils.escapeHtml(l.routineName) + '</strong></td>' +
            '<td>' + Utils.fmtNum(l.hours) + ' hrs</td>' +
            '<td style="font-weight:700;color:var(--color-success);">$ ' + Utils.fmtNum(l.totalCost) + '</td>' +
            '<td><div class="text-xs">' + Utils.escapeHtml(l.notes || 'Sin notas') + '</div></td>' +
            '<td><button class="btn btn-ghost btn-sm" style="color:var(--color-danger);" onclick="VehiclesModule.deleteMaintenanceLog(\'' + l.id + '\',\'' + vehicleId + '\')">🗑️ Anular</button></td>' +
            '</tr>';
        }).join('') +
        '</tbody></table></div>';
    }
    target.innerHTML = html;
  }

  function renderVehicleDocs(vehicleId) {
    var target = document.getElementById('sec-vdocs');
    if (!target) return;
    var docs = DB.getAll('vehicleDocuments').filter(function (d) { return d.vehicleId === vehicleId; });
    var today = Utils.todayISO();

    var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">' +
      '<div><h4>Documentación Legal y Seguros</h4>' +
      '<div style="font-size:0.75rem;color:var(--text-muted);">' + docs.length + ' documento(s) registrado(s)</div></div>' +
      '<button class="btn btn-primary btn-sm" onclick="VehiclesModule.showDocumentModal(\'' + vehicleId + '\')">' +
      '+ Nuevo Documento</button>' +
      '</div>';

    if (!docs.length) {
      html += '<div class="empty-state" style="padding:40px;"><div class="empty-state-icon">📄</div>' +
        '<p>No hay documentos registrados. Registra el SOAT, Tecnomecánica o Seguros para recibir alertas de vencimiento.</p></div>';
    } else {
      html += '<div class="table-wrapper"><table><thead><tr>' +
        '<th>Tipo de Documento</th><th>Vencimiento</th><th>Días restantes</th><th>Estado</th><th>Notas</th><th></th>' +
        '</tr></thead><tbody>';
      docs.slice().sort(function (a, b) { return a.expiry < b.expiry ? -1 : 1; }).forEach(function (d) {
        var daysLeft = Math.floor((new Date(d.expiry) - new Date(today)) / 864e5);
        var badge, rowStyle;
        if (daysLeft < 0) {
          badge = '<span class="badge badge-red">🔴 Vencido</span>';
          rowStyle = 'background:rgba(239,68,68,0.05);';
        } else if (daysLeft <= 30) {
          badge = '<span class="badge badge-amber">🟡 Por vencer</span>';
          rowStyle = 'background:rgba(245,158,11,0.05);';
        } else {
          badge = '<span class="badge badge-green">🟢 Vigente</span>';
          rowStyle = '';
        }
        var daysText = daysLeft < 0
          ? '<span style="color:var(--color-danger);font-weight:700;">Venció hace ' + Math.abs(daysLeft) + ' días</span>'
          : '<span style="color:' + (daysLeft <= 30 ? 'var(--color-warning)' : 'var(--color-success)') + ';font-weight:600;">' + daysLeft + ' días</span>';
        html += '<tr style="' + rowStyle + '">' +
          '<td><strong>' + Utils.escapeHtml(DOC_TYPE_NAMES[d.type] || d.type) + '</strong></td>' +
          '<td>' + Utils.formatDate(d.expiry) + '</td>' +
          '<td>' + daysText + '</td>' +
          '<td>' + badge + '</td>' +
          '<td class="text-sm text-muted">' + Utils.escapeHtml(d.notes || '—') + '</td>' +
          '<td><button class="btn btn-ghost btn-sm" style="color:var(--color-danger);" ' +
          'onclick="VehiclesModule.deleteDocument(\'' + d.id + '\',\'' + vehicleId + '\')">' +
          '🗑️</button></td>' +
          '</tr>';
      });
      html += '</tbody></table></div>';
    }
    target.innerHTML = html;
  }

  function renderInspections(vehicleId) {
    var target = document.getElementById('sec-vinsp');
    if (!target) return;
    var insps = DB.getAll('vehicleInspections').filter(function (i) { return i.vehicleId === vehicleId; });
    insps.sort(function (a, b) { return b.date < a.date ? -1 : 1; }); // más reciente primero
    var today = Utils.todayISO();
    var hasToday = insps.some(function (i) { return i.date === today; });

    var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">' +
      '<div><h4>Inspecciones Pre-operacionales Diarias</h4>' +
      '<div style="font-size:0.75rem;color:var(--text-muted);">' + insps.length + ' inspección(es) registrada(s)' +
      (hasToday
        ? ' · <span style="color:var(--color-success);font-weight:700;">✅ Inspeccionado hoy</span>'
        : ' · <span style="color:var(--color-warning);font-weight:700;">⚠️ Sin inspección hoy</span>') +
      '</div></div>' +
      '<button class="btn btn-primary btn-sm" onclick="VehiclesModule.showInspectionModal(\'' + vehicleId + '\')">🔍 Nueva Inspección</button>' +
      '</div>';

    if (!insps.length) {
      html += '<div class="empty-state" style="padding:40px;"><div class="empty-state-icon">✅</div>' +
        '<p>Registra las inspecciones diarias para garantizar el estado preventivo de la flota.</p></div>';
    } else {
      html += '<div class="table-wrapper"><table><thead><tr>' +
        '<th>Fecha</th><th>Horómetro</th><th>Resultado general</th><th>Ítems con fallo</th><th>Observaciones</th><th></th>' +
        '</tr></thead><tbody>';
      insps.forEach(function (insp) {
        var failItems = (insp.checklist || []).filter(function (c) { return c.result === 'fail'; });
        var overallBadge = insp.hasFailures
          ? '<span class="badge badge-red">❌ Con fallos</span>'
          : '<span class="badge badge-green">✅ Sin novedad</span>';
        var failText = failItems.length
          ? failItems.map(function (c) { return Utils.escapeHtml(c.label); }).join(', ')
          : '<span class="text-muted">—</span>';
        var isToday = insp.date === today;
        html += '<tr>' +
          '<td><strong>' + Utils.formatDate(insp.date) + (isToday ? ' <span class="badge badge-cyan">Hoy</span>' : '') + '</strong></td>' +
          '<td>' + Utils.fmtNum(insp.km || 0) + ' hrs</td>' +
          '<td>' + overallBadge + '</td>' +
          '<td class="text-sm" style="color:var(--color-danger);max-width:200px;">' + failText + '</td>' +
          '<td class="text-sm text-muted">' + Utils.escapeHtml(insp.notes || '—') + '</td>' +
          '<td><button class="btn btn-ghost btn-sm" style="color:var(--color-danger);" ' +
          'onclick="VehiclesModule.deleteInspection(\'' + insp.id + '\',\'' + vehicleId + '\')">' +
          '🗑️</button></td>' +
          '</tr>';
      });
      html += '</tbody></table></div>';
    }
    target.innerHTML = html;
  }

  function showDocumentModal(vehicleId) {
    var v = DB.getById('vehicles', vehicleId);
    var docTypes = [
      { id: 'soat', name: 'SOAT' },
      { id: 'tecno', name: 'Revisión Tecnomecánica' },
      { id: 'extra', name: 'Seguro Extracontractual' },
      { id: 'todo', name: 'Seguro Todo Riesgo' },
      { id: 'tarjeta', name: 'Tarjeta de Propiedad' },
      { id: 'impuesto', name: 'Impuesto Vehicular' }
    ];

    var html = '<div class="modal-overlay" id="doc-modal"><div class="modal modal-md">' +
      '<div class="modal-header"><h3>📄 Gestionar Documento: ' + v.plate + '</h3><button class="modal-close" id="doc-close">✕</button></div>' +
      '<div class="modal-body">' +
      '<div class="form-group"><label>Tipo de Documento</label><select id="df-type" class="form-control">' +
      docTypes.map(function (t) { return '<option value="' + t.id + '">' + t.name + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="form-group"><label>Fecha de Vencimiento</label><input type="date" id="df-expiry" class="form-control"></div>' +
      '<div class="form-group"><label>Costo del Documento ($)</label><input type="number" id="df-cost" class="form-control" placeholder="0"></div>' +
      '<div class="form-group span-2"><label>Notas / Observaciones</label><textarea id="df-notes" class="form-control" rows="3" placeholder="Ej: Compañía de seguros, detalles adicionales..."></textarea></div>' +
      '</div>' +
      '<div class="modal-footer">' +
      '<button class="btn btn-secondary" id="doc-cancel">Cancelar</button>' +
      '<button class="btn btn-primary" id="doc-save">Guardar Documento</button>' +
      '</div>' +
      '</div></div>';

    document.body.insertAdjacentHTML('beforeend', html);
    var ov = document.getElementById('doc-modal');
    var close = function () { ov.remove(); };
    document.getElementById('doc-close').onclick = close;
    document.getElementById('doc-cancel').onclick = close;
    document.getElementById('doc-save').onclick = function () {
      var type = document.getElementById('df-type').value;
      var expiry = document.getElementById('df-expiry').value;
      var cost = parseFloat(document.getElementById('df-cost').value) || 0;
      var notes = document.getElementById('df-notes').value.trim();

      if (!type) { Utils.toast('Selecciona el tipo de documento.', 'warning'); return; }
      if (!expiry) { Utils.toast('La fecha de vencimiento es obligatoria.', 'warning'); return; }

      // Poka-Yoke: Prevenir duplicidad de documentos
      var existingDocs = DB.getAll('vehicleDocuments').filter(function (d) {
        return d.vehicleId === vehicleId && d.type === type;
      });
      
      if (existingDocs.length > 0) {
        Utils.toast('⚠️ Operación bloqueada: Ya existe un documento de este tipo. Elimínalo primero para registrar uno nuevo.', 'error');
        return;
      }

      DB.create('vehicleDocuments', {
        vehicleId: vehicleId,
        type: type,
        expiry: expiry,
        cost: cost,
        notes: notes,
        createdAt: Utils.todayISO()
      });
      Utils.toast(DOC_TYPE_NAMES[type] + ' registrado correctamente.', 'success');
      
      close();
      renderVehicleDocs(vehicleId);
    };
  }


  function showInspectionModal(vehicleId) {
    var v = DB.getById('vehicles', vehicleId);
    var checks = [
      { id: 'lights', label: 'Luces (Altas, Bajas, Frenos, Direccionales)' },
      { id: 'brakes', label: 'Sistema de Frenos' },
      { id: 'tires', label: 'Llantas (Presión y Desgaste)' },
      { id: 'fluids', label: 'Niveles (Aceite, Refrigerante, Frenos)' },
      { id: 'leaks', label: 'Fugas (Goteos bajo el vehículo)' }
    ];

    var html = '<div class="modal-overlay" id="insp-modal"><div class="modal modal-md">' +
      '<div class="modal-header"><h3>🔍 Inspección Pre-operativa: ' + v.plate + '</h3><button class="modal-close" id="insp-close">✕</button></div>' +
      '<div class="modal-body">' +
      '<div class="grid-2" style="margin-bottom:15px;">' +
      '<div class="form-group"><label>Fecha</label><input type="date" id="if-date" class="form-control" value="' + Utils.todayISO() + '"></div>' +
      '<div class="form-group"><label>Horas (Horómetro)</label><input type="number" id="if-hrs" class="form-control" value="' + (v.hours || 0) + '"></div>' +
      '</div>' +
      '<h5>Checklist de Seguridad</h5>' +
      '<div class="inspection-list" style="margin-bottom:15px;">' +
      checks.map(function (c) {
        return '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px;border-bottom:1px solid var(--border);">' +
          '<span>' + c.label + '</span>' +
          '<div class="flex gap-2">' +
          '<label style="cursor:pointer;background:var(--bg-elevated);padding:4px 8px;border-radius:4px;"><input type="radio" name="ck-' + c.id + '" value="ok" checked> ✅ OK</label>' +
          '<label style="cursor:pointer;background:var(--bg-elevated);padding:4px 8px;border-radius:4px;"><input type="radio" name="ck-' + c.id + '" value="fail"> ❌ Fallo</label>' +
          '</div></div>';
      }).join('') +
      '</div>' +
      '<div class="form-group"><label>Observaciones Adicionales</label><textarea id="if-notes" class="form-control" rows="2"></textarea></div>' +
      '</div>' +
      '<div class="modal-footer">' +
      '<button class="btn btn-secondary" id="insp-cancel">Cancelar</button>' +
      '<button class="btn btn-primary" id="insp-save">Guardar Inspección</button>' +
      '</div>' +
      '</div></div>';

    document.body.insertAdjacentHTML('beforeend', html);
    var ov = document.getElementById('insp-modal');
    var close = function () { ov.remove(); };
    document.getElementById('insp-close').onclick = close;
    document.getElementById('insp-cancel').onclick = close;
    document.getElementById('insp-save').onclick = function () {
      var date = document.getElementById('if-date').value;
      var hours = parseFloat(document.getElementById('if-hrs').value) || 0;
      var notes = document.getElementById('if-notes').value.trim();

      if (!date) { Utils.toast('La fecha es obligatoria.', 'warning'); return; }
      if (hours < (v.hours || 0)) {
        Utils.toast('El horómetro no puede ser menor al valor actual registrado.', 'error');
        return;
      }

      // Leer estado de cada ítem del checklist
      var checklist = checks.map(function (c) {
        var radioChecked = document.querySelector('input[name="ck-' + c.id + '"]:checked');
        return { id: c.id, label: c.label, result: radioChecked ? radioChecked.value : 'ok' };
      });
      var failCount = checklist.filter(function (c) { return c.result === 'fail'; }).length;

      DB.create('vehicleInspections', {
        vehicleId: vehicleId,
        date: date,
        hours: hours,
        checklist: checklist,
        hasFailures: failCount > 0,
        notes: notes,
        createdAt: Utils.todayISO()
      });

      if (failCount > 0) {
        Utils.toast('Inspección guardada con ' + failCount + ' fallo(s) detectado(s). Revisa el estado del vehículo.', 'warning');
      } else {
        Utils.toast('Inspección registrada. Vehículo en buenas condiciones. ✅', 'success');
      }
      close();
      renderInspections(vehicleId);
    };
  }

  function deleteMaintenanceLog(logId, vehicleId) {
    var log = DB.getAll('maintenanceLogs').find(function (l) { return l.id === logId; });
    if (!log) return;

    Utils.confirm('¿Anular este registro de mantenimiento? Los repuestos usados serán devueltos al inventario.', 'Anular Registro', function () {
      // 1. Revert stock
      (log.materialsUsed || []).forEach(function (m) {
        var item = DB.getById('items', m.id);
        if (item) DB.update('items', m.id, { stock: item.stock + m.qty });
        DB.create('movements', {
          itemId: m.id, itemName: m.name, type: 'entrada', qty: m.qty,
          date: Utils.todayISO(), reference: 'ANULACION', notes: 'Reversión por anulación de: ' + log.routineName,
          userId: DB.getSettings().activeUserId
        });
      });
      // 2. Remove log
      DB.remove('maintenanceLogs', logId);
      syncVehicleOdometer(vehicleId);

      Utils.toast('Registro anulado y stock revertido.', 'success');
      renderMaintenanceLog(vehicleId);
      render(); // Refresh main dashboard
    }, true);
  }

  function promptUpdateKm(id) {
    var v = DB.getById('vehicles', id);
    if (!v) return;

    var old = document.getElementById('upd-km-modal'); if (old) old.remove();
    var html = '<div class="modal-overlay" id="upd-km-modal"><div class="modal modal-sm">' +
      '<div class="modal-header"><h3>⏱️ Actualizar Horómetro</h3><button class="modal-close" id="ukm-close">✕</button></div>' +
      '<div class="modal-body">' +
      '<p class="text-sm text-muted" style="margin-bottom:12px;">Ingrese el nuevo valor del horómetro (Horas acumuladas) para <strong>' + Utils.escapeHtml(v.plate) + '</strong>:</p>' +
      '<div class="form-group"><input type="number" id="ukm-val" class="form-input" value="' + (v.hours || 0) + '" step="0.1"></div>' +
      '</div>' +
      '<div class="modal-footer"><button class="btn btn-secondary" id="ukm-can">Cancelar</button><button class="btn btn-primary" id="ukm-sv">💾 Guardar</button></div>' +
      '</div></div>';

    document.body.insertAdjacentHTML('beforeend', html);
    var ov = document.getElementById('upd-km-modal');
    var close = function () { ov.remove(); };
    document.getElementById('ukm-close').onclick = close;
    document.getElementById('ukm-can').onclick = close;
    ov.onclick = function (e) { if (e.target === ov) close(); };

    document.getElementById('ukm-sv').onclick = function () {
      var newHours = parseFloat(document.getElementById('ukm-val').value);
      if (isNaN(newHours) || newHours < (v.hours || 0)) {
        Utils.toast('El horómetro no puede ser menor al valor actual registrado.', 'error');
        return;
      }
      DB.update('vehicles', id, { hours: newHours });
      Utils.toast('Horómetro actualizado.', 'success');
      var kmLbl = document.getElementById('v-km-lbl');
      if (kmLbl) kmLbl.textContent = Utils.fmtNum(newHours) + ' hrs';
      close();
      render(); // Update dashboard behind
    };
  }

  function renderVehicleRoutines(vehicleId) {
    var routines = DB.getAll('preventiveRoutines').filter(function (r) { return r.vehicleId === vehicleId && r.active; });
    var target = document.getElementById('sec-vprev');
    if (!target) return;

    var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">' +
      '<h4>Plan de Mantenimiento Preventivo</h4>' +
      '<button class="btn btn-primary btn-sm" onclick="VehiclesModule.showRoutineModal(\'' + vehicleId + '\')">+ Nueva Rutina</button>' +
      '</div>';

    if (!routines.length) {
      html += '<div class="empty-state" style="padding:24px;"><div class="empty-state-icon">✅</div><p>No hay rutinas preventivas configuradas para este vehículo.</p></div>';
    } else {
      html += '<div class="table-wrapper"><table><thead><tr>' +
        '<th>Nombre de la Rutina</th><th>Frecuencia Horas</th><th>Frecuencia Días</th><th>Último Mtto. Horas</th><th>Último Mtto. Fecha</th><th>Acciones</th>' +
        '</tr></thead><tbody>' +
        routines.map(function (r) {
          return '<tr>' +
            '<td><strong>' + Utils.escapeHtml(r.name) + '</strong></td>' +
            '<td>' + Utils.fmtNum(r.frequencyHours) + ' hrs</td>' +
            '<td>' + r.frequencyDays + ' días</td>' +
            '<td>' + Utils.fmtNum(r.lastPerformedHours) + ' hrs</td>' +
            '<td>' + Utils.formatDate(r.lastPerformedDate) + '</td>' +
            '<td>' +
            '<button class="btn btn-ghost btn-sm" onclick="VehiclesModule.showRoutineModal(\'' + vehicleId + '\',\'' + r.id + '\')">✏️</button>' +
            '<button class="btn btn-ghost btn-sm" onclick="VehiclesModule.deleteRoutine(\'' + r.id + '\',\'' + vehicleId + '\')">🗑️</button>' +
            '</td>' +
            '</tr>';
        }).join('') +
        '</tbody></table></div>';
    }
    target.innerHTML = html;
  }

  function hKpi(icon, label, val) {
    return '<div style="background:var(--bg-elevated);border:1px solid var(--border);border-radius:var(--radius-md);padding:12px 16px;text-align:center;">' +
      '<div style="font-size:1.3rem;">' + icon + '</div>' +
      '<div style="font-size:1.5rem;font-weight:800;line-height:1.2;">' + val + '</div>' +
      '<div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em;">' + label + '</div>' +
      '</div>';
  }

  // ── Toggle active ──────────────────────────────────────────
  function toggleActive(id) {
    var v = DB.getById('vehicles', id);
    var newState = !v.active;
    DB.update('vehicles', id, { active: newState });
    Utils.toast('Vehículo ' + (newState ? 'activado' : 'desactivado') + '.', 'info');
    render();
  }

  // ── Delete ─────────────────────────────────────────────────
  function deleteVehicle(id) {
    var v = DB.getById('vehicles', id);
    var linked = DB.getAll('workOrders').filter(function (w) { return w.vehicleId === id; }).length;
    if (linked > 0) {
      Utils.toast('No puedes eliminar este vehículo: tiene ' + linked + ' OT(s) asociadas.', 'error'); return;
    }
    Utils.confirm('¿Eliminar el vehículo "' + v.plate + '"?', 'Eliminar Vehículo', function () {
      DB.remove('vehicles', id); Utils.toast('Vehículo eliminado.', 'success'); render(); App.updateBadges();
    }, true);
  }

  // ── Export vehicle Excel ────────────────────────────────────
  function exportVehicleExcel(id) {
    var v = DB.getById('vehicles', id);
    var wos = DB.getAll('workOrders').filter(function (w) { return w.vehicleId === id; });
    var users = DB.getAll('users');
    var uMap = {}; users.forEach(function (u) { uMap[u.id] = u.name; });

    Utils.exportExcel('historial_' + v.plate + '_' + Utils.todayISO() + '.xlsx', 'Historial de Mantenimiento: ' + v.plate,
      ['Número OT', 'Fecha', 'Descripción', 'Prioridad', 'Estado', 'Técnico', 'Mat. Solicitados', 'Mat. Entregados', 'Cerrada'],
      wos.map(function (w) {
        var matReq = (w.materials || []).length;
        var matDel = (w.materials || []).filter(function (m) { return m.delivered; }).length;
        return [w.number, w.date, w.description, w.priority,
        Utils.OT_STATUS[w.status] ? Utils.OT_STATUS[w.status].label : w.status,
        uMap[w.assignedTo] || 'Sin asignar', matReq, matDel, w.closedAt || ''];
      })
    );
    Utils.toast('Historial de ' + v.plate + ' exportado.', 'success');
  }

  // ── Export full fleet Excel ──────────────────────────────────
  function exportExcel() {
    var vehicles = DB.getAll('vehicles');
    var wos = DB.getAll('workOrders');
    Utils.exportExcel('flota_' + Utils.todayISO() + '.xlsx', 'Listado Maestro de Flota Vehicular',
      ['Placa', 'Tipo', 'Marca', 'Modelo', 'Año', 'Color', 'Departamento', 'Horas', 'Activo', 'OTs Total', 'Notas'],
      vehicles.map(function (v) {
        var count = wos.filter(function (w) { return w.vehicleId === v.id; }).length;
        return [v.plate, v.type, v.brand || '', v.model || '', v.year, v.color || '', v.department || '', v.hours || 0, v.active ? 'Sí' : 'No', count, v.notes || ''];
      })
    );
    Utils.toast('Flota exportada a Excel.', 'success');
  }

  // ── Public helpers used by other modules ───────────────────
  function getVehicleSelector(selectedId) {
    var vehicles = DB.getAll('vehicles').filter(function (v) { return v.active; });
    var opts = '<option value="">Sin vehículo asignado</option>' +
      vehicles.map(function (v) {
        var label = v.plate + ' — ' + v.brand + ' ' + v.model + ' ' + v.year;
        return '<option value="' + v.id + '"' + (selectedId === v.id ? ' selected' : '') + ' data-plate="' + Utils.escapeHtml(v.plate) + '" data-name="' + Utils.escapeHtml(v.brand + ' ' + v.model + ' ' + v.year) + '">' + Utils.escapeHtml(label) + '</option>';
      }).join('');
    return opts;
  }

  function getVehicleLabel(vehicleId, vehiclePlate, vehicleName) {
    if (!vehicleId && !vehiclePlate) return '<span class="text-muted">—</span>';
    return '<span class="badge badge-cyan" style="font-family:monospace;font-size:0.8rem;">🚗 ' + Utils.escapeHtml(vehiclePlate || '') + '</span>' +
      (vehicleName ? '<div class="text-xs text-secondary" style="margin-top:2px;">' + Utils.escapeHtml(vehicleName) + '</div>' : '');
  }

  // ── Preventive Routines ─────────────────────────────────────
  function showRoutineModal(vehicleId, routineId) {
    var v = DB.getById('vehicles', vehicleId);
    if (!v) return;
    var r = routineId ? DB.getById('preventiveRoutines', routineId) : null;
    var old = document.getElementById('rt-modal'); if (old) old.remove();

    var html = '<div class="modal-overlay" id="rt-modal" style="z-index:3000;"><div class="modal">' +
      '<div class="modal-header"><h3>' + (r ? '✏️ Editar Rutina' : '📅 Nueva Rutina') + ' para ' + Utils.escapeHtml(v.plate) + '</h3><button class="modal-close" id="rt-close">✕</button></div>' +
      '<div class="modal-body"><div class="form-grid">' +
      '<div class="form-group span-2"><label>Nombre de la Rutina *</label><input class="form-input" id="rt-name" value="' + Utils.escapeHtml(r ? r.name : '') + '" placeholder="Ej: Cambio de Aceite y Filtros"></div>' +
      '<div class="form-group"><label>Frecuencia (Hrs) *</label><input class="form-input" type="number" id="rt-fkm" value="' + (r ? r.frequencyHours : 10000) + '" min="1"></div>' +
      '<div class="form-group"><label>Frecuencia Máx (Días) *</label><input class="form-input" type="number" id="rt-fdays" value="' + (r ? r.frequencyDays : 180) + '" min="1"></div>' +
      '<div class="form-group"><label>Último Mtto. (Hrs) *</label><input class="form-input" type="number" id="rt-lkm" value="' + (r ? r.lastPerformedHours : v.hours || 0) + '" min="0"></div>' +
      '<div class="form-group"><label>Último Mtto. (Fecha) *</label><input class="form-input" type="date" id="rt-ldate" value="' + (r ? r.lastPerformedDate : Utils.todayISO()) + '"></div>' +
      '</div></div>' +
      '<div class="modal-footer"><button class="btn btn-secondary" id="rt-can">Cancelar</button><button class="btn btn-primary" id="rt-sv">💾 Guardar</button></div>' +
      '</div></div>';

    document.body.insertAdjacentHTML('beforeend', html);
    var ov = document.getElementById('rt-modal');
    function close() { ov.remove(); }
    document.getElementById('rt-close').onclick = close;
    document.getElementById('rt-can').onclick = close;
    ov.onclick = function (e) { if (e.target === ov) close(); };

    document.getElementById('rt-sv').onclick = function () {
      var name = document.getElementById('rt-name').value.trim();
      var fkm = parseFloat(document.getElementById('rt-fkm').value);
      var fdays = parseInt(document.getElementById('rt-fdays').value);
      var lkm = parseFloat(document.getElementById('rt-lkm').value);
      var ldate = document.getElementById('rt-ldate').value;

      if (!name || !fkm || !fdays || isNaN(lkm) || !ldate) {
        Utils.toast('Todos los campos son obligatorios y numéricos.', 'warning'); return;
      }

      var data = {
        vehicleId: vehicleId,
        name: name, frequencyHours: fkm, frequencyDays: fdays,
        lastPerformedHours: lkm, lastPerformedDate: ldate, active: true
      };

      if (r) {
        DB.update('preventiveRoutines', r.id, data);
        Utils.toast('Rutina actualizada.', 'success');
      } else {
        DB.create('preventiveRoutines', data);
        Utils.toast('Rutina creada.', 'success');
      }
      close();
      renderVehicleRoutines(vehicleId); // update internal modal
      render(); // update background if in preventivos tab
    };
  }

  function deleteRoutine(routineId, vehicleId) {
    var r = DB.getById('preventiveRoutines', routineId);
    Utils.confirm('¿Eliminar la rutina "' + r.name + '"?', 'Eliminar Rutina', function () {
      DB.remove('preventiveRoutines', routineId);
      Utils.toast('Rutina eliminada.', 'success');
      renderVehicleRoutines(vehicleId);
      render();
    }, true);
  }

  function showQuickMaintenanceModal(routineId) {
    var r = DB.getById('preventiveRoutines', routineId);
    if (!r) return;
    var v = DB.getById('vehicles', r.vehicleId);
    if (!v) return;
    var items = DB.getAll('items');
    var settings = DB.getSettings();
    var old = document.getElementById('qmnt-modal'); if (old) old.remove();

    var selectedMats = [];

    function buildMatHtml() {
      if (!selectedMats.length) return '<p class="text-xs text-muted">Sin repuestos seleccionados.</p>';
      return selectedMats.map(function (m, i) {
        return '<div class="flex justify-between items-center p-2 bg-elevated rounded mb-1 text-sm">' +
          '<span>' + Utils.escapeHtml(m.name) + ' (' + m.qty + ' ' + Utils.escapeHtml(m.unit) + ')</span>' +
          '<button class="btn btn-ghost btn-sm" onclick="VehiclesModule._rmQMat(' + i + ')">✕</button>' +
          '</div>';
      }).join('');
    }

    VehiclesModule._rmQMat = function (idx) {
      selectedMats.splice(idx, 1);
      var container = document.getElementById('qmnt-mat-list');
      if (container) container.innerHTML = buildMatHtml();
    };

    var html = '<div class="modal-overlay" id="qmnt-modal"><div class="modal">' +
      '<div class="modal-header"><h3>⚡ Registro de Mantenimiento Exprés</h3><button class="modal-close" id="qmnt-close">✕</button></div>' +
      '<div class="modal-body">' +
      '<div class="alert-banner info" style="margin-bottom:16px;">Registrando: <strong>' + Utils.escapeHtml(r.name) + '</strong> para <strong>' + v.plate + '</strong></div>' +
      '<div class="form-grid">' +
      '<div class="form-group"><label>Fecha realización</label><input class="form-input" type="date" id="qf-date" value="' + Utils.todayISO() + '"></div>' +
      '<div class="form-group"><label>Horas Actuales (Horómetro)</label><input class="form-input" type="number" id="qf-hrs" value="' + (v.hours || 0) + '"></div>' +
      '<div class="form-group span-2"><label>Repuestos del Inventario (Opcional)</label>' +
      '<div class="flex gap-2">' +
      '<select class="form-select" id="qf-mat-sel" style="flex:1;"><option value="">Seleccionar...</option>' +
      items.map(function (i) { return '<option value="' + i.id + '" data-name="' + Utils.escapeHtml(i.name) + '" data-unit="' + Utils.escapeHtml(i.unit) + '">' + Utils.escapeHtml(i.name) + ' (Stock: ' + i.stock + ')</option>'; }).join('') +
      '</select>' +
      '<input type="number" id="qf-mat-qty" value="1" min="1" class="form-input" style="width:60px;">' +
      '<button class="btn btn-secondary btn-sm" id="qf-mat-add">➕</button>' +
      '</div>' +
      '<div id="qmnt-mat-list" style="margin-top:8px;">' + buildMatHtml() + '</div>' +
      '</div>' +
      '<div class="form-group"><label>Costo Mano de Obra ($)</label><input class="form-input" type="number" id="qf-labor" value="0"></div>' +
      '<div class="form-group"><label>Otros Costos ($)</label><input class="form-input" type="number" id="qf-other" value="0"></div>' +
      '<div class="form-group span-2"><label>Notas / Observaciones</label><textarea class="form-textarea" id="qf-notes" rows="2"></textarea></div>' +
      '</div>' +
      '</div>' +
      '<div class="modal-footer"><button class="btn btn-secondary" id="qmnt-can">Cancelar</button><button class="btn btn-primary" id="qmnt-sv">💾 Guardar Registro</button></div>' +
      '</div></div>';

    document.body.insertAdjacentHTML('beforeend', html);
    var ov = document.getElementById('qmnt-modal');
    function close() { ov.remove(); }
    document.getElementById('qmnt-close').onclick = close;
    document.getElementById('qmnt-can').onclick = close;
    ov.onclick = function (e) { if (e.target === ov) close(); };

    document.getElementById('qf-mat-add').onclick = function () {
      var sel = document.getElementById('qf-mat-sel');
      var iId = sel.value; if (!iId) return;
      var opt = sel.options[sel.selectedIndex];
      var qty = parseInt(document.getElementById('qf-mat-qty').value) || 1;
      selectedMats.push({ id: iId, name: opt.getAttribute('data-name'), unit: opt.getAttribute('data-unit'), qty: qty });
      document.getElementById('qmnt-mat-list').innerHTML = buildMatHtml();
      sel.value = '';
    };

    document.getElementById('qmnt-sv').onclick = function () {
      var date = document.getElementById('qf-date').value;
      var hours = Math.max(0, parseFloat(document.getElementById('qf-hrs').value) || 0);
      var labor = Math.max(0, parseFloat(document.getElementById('qf-labor').value) || 0);
      var other = Math.max(0, parseFloat(document.getElementById('qf-other').value) || 0);
      var notes = document.getElementById('qf-notes').value.trim();

      // Human Error Validations
      if (!date || date > Utils.todayISO()) { Utils.toast('La fecha no puede ser futura.', 'warning'); return; }
      if (hours < (v.hours || 0)) {
        Utils.toast('El horómetro no puede ser menor al valor actual registrado.', 'error');
        return;
      }

      var doSave = function () {
        var logId = 'ml-' + Date.now();
        var matCost = 0;
        var movementsGenerated = [];

        // Pre-check stock
        for (var i = 0; i < selectedMats.length; i++) {
          var m = selectedMats[i];
          var item = DB.getById('items', m.id);
          if (!item || item.stock < m.qty) {
            Utils.toast('Stock insuficiente para: ' + m.name + '. Disponible: ' + (item ? item.stock : 0), 'error');
            return;
          }
        }

        // Process materials
        selectedMats.forEach(function (m) {
          var item = DB.getById('items', m.id);
          var cost = (item.unitCost || 0) * m.qty;
          matCost += cost;
          DB.update('items', m.id, { stock: item.stock - m.qty });
          var activeUser = DB.getById('users', settings.activeUserId);
          var mov = {
            itemId: m.id, itemName: item.name, type: 'salida', qty: m.qty,
            unitCost: item.unitCost, totalCost: cost, date: date,
            reference: 'MTTO-' + v.plate, notes: 'Mantenimiento: ' + r.name,
            userId: settings.activeUserId, userName: activeUser ? activeUser.name : 'Sistema',
            maintenanceLogId: logId
          };
          DB.create('movements', mov);
          movementsGenerated.push(m);
        });

        var totalCost = matCost + labor + other;

        // Create log
        DB.create('maintenanceLogs', {
          id: logId, vehicleId: v.id, vehiclePlate: v.plate, routineId: r.id, routineName: r.name,
          date: date, hours: hours, matCost: matCost, laborCost: labor, otherCost: other,
          totalCost: totalCost, notes: notes, userId: settings.activeUserId,
          materialsUsed: movementsGenerated
        });

        // Update vehicle & routine
        DB.update('vehicles', v.id, { hours: hours });
        DB.update('preventiveRoutines', r.id, { lastPerformedHours: hours, lastPerformedDate: date });

        Utils.toast('Mantenimiento registrado con éxito.', 'success');
        close(); render(); App.updateBadges();
      };

      if (hours > (v.hours || 0) + 500) {
        Utils.confirm('¿Confirmas que el horómetro es ' + Utils.fmtNum(hours) + '? (Incremento inusual de >500 hrs)', 'Horómetro Inusual', function () {
          doSave();
        });
      } else {
        doSave();
      }
    };
  }

  function deleteFuelLog(logId, vehicleId) {
    Utils.confirm('¿Eliminar este registro de tanqueo?', 'Anular Tanqueo', function () {
      DB.remove('fuelLogs', logId);
      syncVehicleOdometer(vehicleId);
      Utils.toast('Registro de combustible eliminado.', 'success');
      render(); // Recarga la vista completa para reflejar el cambio en la pestaña de combustible
    }, true);
  }

  function showAssignDriverModal(vehicleId) {
    var v = DB.getById('vehicles', vehicleId);
    var users = DB.getAll('users').filter(function (u) { return u.active; });

    var html = '<div class="modal-overlay" id="driver-modal"><div class="modal modal-sm">' +
      '<div class="modal-header"><h3>👤 Asignar Conductor</h3><button class="modal-close" id="dr-close">✕</button></div>' +
      '<div class="modal-body">' +
      '<div class="form-group"><label>Seleccionar Conductor</label><select id="df-driver" class="form-control">' +
      '<option value="">(Sin asignar)</option>' +
      users.map(function (u) { return '<option value="' + u.id + '" ' + (v.assignedDriverId === u.id ? 'selected' : '') + '>' + u.name + '</option>'; }).join('') +
      '</select></div>' +
      '</div>' +
      '<div class="modal-footer">' +
      '<button class="btn btn-primary btn-block" id="dr-save">Confirmar Asignación</button>' +
      '</div>' +
      '</div></div>';

    document.body.insertAdjacentHTML('beforeend', html);
    var ov = document.getElementById('driver-modal');
    document.getElementById('dr-close').onclick = function () { ov.remove(); };
    document.getElementById('dr-save').onclick = function () {
      var driverId = document.getElementById('df-driver').value || null;
      DB.update('vehicles', vehicleId, { assignedDriverId: driverId });
      var selectedUser = users.find(function (u) { return u.id === driverId; });
      var msg = selectedUser
        ? 'Conductor asignado: ' + selectedUser.name + '.'
        : 'Conductor removido del vehículo.';
      Utils.toast(msg, 'success');
      ov.remove();
      showHistory(vehicleId); // Reabre el historial con el conductor actualizado
    };
  }

  // ══════════════════════════════════════════════════════════
  //  🔒 MANTENIMIENTO — Detección de vehículo en mantenimiento
  // ══════════════════════════════════════════════════════════
  var DOWNTIME_STATUSES = ['en_proceso', 'esperando_repuestos'];

  function isVehicleInMaintenance(vehicleId) {
    var wos = DB.getAll('workOrders');
    var openOTs = wos.filter(function (w) {
      return w.vehicleId === vehicleId && DOWNTIME_STATUSES.indexOf(w.status) !== -1;
    });
    if (!openOTs.length) return { inMaintenance: false, openOTs: [], sinceDate: null, downtimeDays: 0 };
    // Earliest open OT date
    openOTs.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var sinceDate = openOTs[0].date;
    var downtimeDays = Math.max(0, Math.floor((new Date() - new Date(sinceDate + 'T00:00:00')) / 864e5));
    return { inMaintenance: true, openOTs: openOTs, sinceDate: sinceDate, downtimeDays: downtimeDays };
  }

  // ══════════════════════════════════════════════════════════
  //  ⛽ COMBUSTIBLE — Centro de Tiquetes de Combustible
  // ══════════════════════════════════════════════════════════
  function renderCombustible(allVehicles) {
    var today = Utils.todayISO();
    var firstOfMonth = today.substring(0, 7) + '-01';
    if (!combFilterFrom) combFilterFrom = firstOfMonth;
    if (!combFilterTo) combFilterTo = today;

    var activeVehicles = allVehicles.filter(function (v) { return v.active; });
    var allFuelLogs = DB.getAll('fuelLogs');
    var vMap = {}; allVehicles.forEach(function (v) { vMap[v.id] = v; });

    // ── Filtrar tiquetes ─────────────────────────────────
    var combFuelType = combFuelType || '';
    var logs = allFuelLogs.filter(function (l) {
      return l.date >= combFilterFrom && l.date <= combFilterTo;
    });
    if (combFilterVehicle) logs = logs.filter(function (l) { return l.vehicleId === combFilterVehicle; });
    logs.sort(function (a, b) { return b.date < a.date ? -1 : 1; });

    // ── KPIs del período ─────────────────────────────────
    var totalTickets = logs.length;
    var totalGal = logs.reduce(function (a, l) { return a + (l.gallons || 0); }, 0);
    var totalCost = logs.reduce(function (a, l) { return a + (l.cost || 0); }, 0);
    var validYields = logs.filter(function (l) { return l.yield && l.yield > 0; });
    var avgYield = validYields.length ? validYields.reduce(function (a, l) { return a + l.yield; }, 0) / validYields.length : 0;

    // ── Vehículos en mantenimiento (bloqueados) ──────────
    var blockedVehicles = activeVehicles.filter(function (v) {
      return isVehicleInMaintenance(v.id).inMaintenance;
    });

    // ── HTML ─────────────────────────────────────────────
    var html = '';

    // Banner de vehículos en mantenimiento
    if (blockedVehicles.length) {
      html += '<div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.3);border-radius:var(--radius-md);padding:12px 16px;margin-bottom:16px;display:flex;align-items:flex-start;gap:12px;">' +
        '<span style="font-size:1.3rem;">🔒</span>' +
        '<div><strong style="color:var(--color-danger);">' + blockedVehicles.length + ' vehículo(s) NO pueden recibir combustible — están en mantenimiento:</strong>' +
        '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;">' +
        blockedVehicles.map(function (v) {
          var ms = isVehicleInMaintenance(v.id);
          return '<span style="background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.4);border-radius:6px;padding:2px 10px;font-size:0.78rem;font-weight:700;color:var(--color-danger);">🔴 ' + Utils.escapeHtml(v.plate) + ' (' + ms.downtimeDays + ' días)</span>';
        }).join('') +
        '</div></div></div>';
    }

    // Cabecera + filtros
    html += '<div class="card" style="margin-bottom:16px;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:14px;">' +
      '<div>' +
      '<h3 style="margin:0 0 2px 0;">📋 Centro de Tiquetes de Combustible</h3>' +
      '<div style="font-size:0.78rem;color:var(--text-muted);">Registra un tiquete por cada carga de combustible. Selecciona la placa en cada tiquete.</div>' +
      '</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
      '<button class="btn btn-secondary btn-sm" id="comb-export-btn">📤 Exportar Excel</button>' +
      '<button class="btn btn-primary" id="comb-register-btn">📋 Nuevo Tiquete</button>' +
      '</div>' +
      '</div>' +
      // Filtros
      '<div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;">' +
      '<div class="form-group" style="margin:0;min-width:200px;">' +
      '<label style="font-size:0.72rem;font-weight:600;text-transform:uppercase;letter-spacing:.04em;">🚗 Vehículo</label>' +
      '<select id="comb-filter-veh" class="form-control">' +
      '<option value="">Toda la flota</option>' +
      activeVehicles.map(function (v) {
        var ms = isVehicleInMaintenance(v.id);
        return '<option value="' + v.id + '"' + (combFilterVehicle === v.id ? ' selected' : '') + '>' +
          Utils.escapeHtml(v.plate + ' — ' + (v.brand || '') + ' ' + (v.model || '')) +
          (ms.inMaintenance ? ' 🔴 MANTENIMIENTO' : '') + '</option>';
      }).join('') +
      '</select></div>' +
      '<div class="form-group" style="margin:0;">' +
      '<label style="font-size:0.72rem;font-weight:600;text-transform:uppercase;letter-spacing:.04em;">Desde</label>' +
      '<input type="date" id="comb-filter-from" class="form-control" value="' + combFilterFrom + '" max="' + today + '">' +
      '</div>' +
      '<div class="form-group" style="margin:0;">' +
      '<label style="font-size:0.72rem;font-weight:600;text-transform:uppercase;letter-spacing:.04em;">Hasta</label>' +
      '<input type="date" id="comb-filter-to" class="form-control" value="' + combFilterTo + '" max="' + today + '">' +
      '</div>' +
      '<div class="form-group" style="margin:0;">' +
      '<label style="font-size:0.72rem;font-weight:600;text-transform:uppercase;letter-spacing:.04em;">&nbsp;</label>' +
      '<div style="display:flex;gap:6px;">' +
      '<button class="btn btn-ghost btn-sm" id="comb-btn-mes">Este Mes</button>' +
      '<button class="btn btn-ghost btn-sm" id="comb-btn-3m">3 Meses</button>' +
      '<button class="btn btn-ghost btn-sm" id="comb-btn-all">Todo</button>' +
      '</div></div>' +
      '</div></div>';

    // KPIs
    html += '<div class="grid-4" style="margin-bottom:20px;">' +
      '<div class="kpi-card cyan"><div class="kpi-icon cyan">📋</div><div class="kpi-value">' + totalTickets + '</div><div class="kpi-label">Tiquetes en Período</div></div>' +
      '<div class="kpi-card blue"><div class="kpi-icon blue">💧</div><div class="kpi-value">' + totalGal.toFixed(1) + ' Gal</div><div class="kpi-label">Galones Consumidos</div></div>' +
      '<div class="kpi-card amber"><div class="kpi-icon amber">💰</div><div class="kpi-value">$ ' + Utils.fmtNum(Math.round(totalCost)) + '</div><div class="kpi-label">Gasto Total</div></div>' +
      '<div class="kpi-card ' + (avgYield > 0 && avgYield < 25 ? 'red' : 'green') + '"><div class="kpi-icon green">📅</div><div class="kpi-value">' + (avgYield > 0 ? avgYield.toFixed(1) + ' hrs/Gal' : '—') + '</div><div class="kpi-label">Rendimiento Promedio</div></div>' +
      '</div>';

    // ── Tabla de Tiquetes ─────────────────────────────────
    html += '<div class="card" style="padding:0;margin-bottom:20px;">' +
      '<div class="card-header" style="padding:14px 20px;">' +
      '<div style="display:flex;align-items:center;gap:12px;">' +
      '<h4 style="margin:0;">🧾 Registro de Tiquetes</h4>' +
      '<span class="badge badge-cyan">' + logs.length + ' tiquetes</span>' +
      '</div>' +
      '</div>';

    if (!logs.length) {
      html += '<div class="empty-state" style="padding:40px;"><div class="empty-state-icon">📋</div>' +
        '<h4>Sin tiquetes en el período</h4>' +
        '<p>Haz clic en <strong>📋 Nuevo Tiquete</strong> para registrar la primera carga de combustible.</p>' +
        '</div>';
    } else {
      // Calcular km recorridos entre tiquetes por vehículo
      var vehLogsSorted = {};
      allFuelLogs.forEach(function (l) {
        if (!vehLogsSorted[l.vehicleId]) vehLogsSorted[l.vehicleId] = [];
        vehLogsSorted[l.vehicleId].push(l);
      });
      Object.keys(vehLogsSorted).forEach(function (vid) {
        vehLogsSorted[vid].sort(function (a, b) { return a.date < b.date ? -1 : 1; });
      });

      html += '<div class="table-wrapper"><table><thead><tr>' +
        '<th>N° Tiquete</th><th>Fecha</th><th>Placa / Vehículo</th><th>Horas Horóm.</th><th>Horas Trabajadas</th>' +
        '<th>Galones</th><th>Tipo Combustible</th><th>Estación</th><th>$/Gal</th><th>Costo Total</th>' +
        '<th>Rendimiento</th><th>Tanque</th><th></th>' +
        '</tr></thead><tbody>';

      logs.slice(0, 300).forEach(function (l) {
        var v = vMap[l.vehicleId];
        var vSorted = vehLogsSorted[l.vehicleId] || [];
        var idx = vSorted.findIndex(function (x) { return x.id === l.id; });
        var kmDriven = (idx > 0 && vSorted[idx - 1].hours && l.hours) ? l.hours - vSorted[idx - 1].hours : null;
        var yieldStyle = l.yield && l.yield < 25 ? 'color:var(--color-warning);font-weight:700;' : (l.yield ? 'color:var(--color-success);font-weight:700;' : '');

        html += '<tr>' +
          '<td><span style="font-weight:700;color:var(--accent-cyan);">' + Utils.escapeHtml(l.ticketNumber || l.ticket || '—') + '</span></td>' +
          '<td><strong>' + Utils.formatDate(l.date) + '</strong>' + (l.fullTank ? ' <span class="badge badge-blue" style="font-size:0.55rem;">Lleno</span>' : '') + '</td>' +
          '<td>' + (v ? '<strong style="color:var(--accent-cyan);">' + Utils.escapeHtml(v.plate) + '</strong><div class="text-xs text-muted">' + Utils.escapeHtml((v.brand || '') + ' ' + (v.model || '')) + '</div>' : '<span class="text-muted">—</span>') + '</td>' +
          '<td>' + Utils.fmtNum(l.hours || 0) + ' hrs</td>' +
          '<td>' + (kmDriven !== null && kmDriven >= 0 ? '<span style="color:var(--accent-primary);font-weight:700;">+' + Utils.fmtNum(kmDriven) + ' hrs</span>' : '<span class="text-muted">—</span>') + '</td>' +
          '<td><strong>' + (l.gallons || 0).toFixed(2) + '</strong> Gal</td>' +
          '<td class="text-sm">' + Utils.escapeHtml(l.fuelType || '—') + '</td>' +
          '<td class="text-sm">' + Utils.escapeHtml(l.station || '—') + '</td>' +
          '<td class="text-sm">$ ' + Utils.fmtNum(l.pricePerGal || 0) + '</td>' +
          '<td style="font-weight:700;color:var(--color-success);">$ ' + Utils.fmtNum(l.cost || 0) + '</td>' +
          '<td style="' + yieldStyle + '">' + (l.yield ? l.yield.toFixed(1) + ' hrs/Gal' : '—') + '</td>' +
          '<td>' + (l.fullTank ? '<span class="badge badge-green">Lleno</span>' : '<span class="badge badge-gray">Parcial</span>') + '</td>' +
          '<td><button class="btn btn-ghost btn-sm" style="color:var(--color-danger);" onclick="VehiclesModule.deleteFuelLog(\'' + l.id + '\',\'' + l.vehicleId + '\')">🗑️</button></td>' +
          '</tr>';
      });

      if (logs.length > 300) {
        html += '<tr><td colspan="13" style="text-align:center;padding:10px;color:var(--text-muted);">... y ' + (logs.length - 300) + ' tiquetes más. Exporta para verlos todos.</td></tr>';
      }
      html += '</tbody></table></div>';
    }
    html += '</div>';

    // ── Resumen por Vehículo ──────────────────────────────
    var vehSummary = {};
    logs.forEach(function (l) {
      if (!vehSummary[l.vehicleId]) vehSummary[l.vehicleId] = { gal: 0, cost: 0, count: 0, yields: [] };
      vehSummary[l.vehicleId].gal += (l.gallons || 0);
      vehSummary[l.vehicleId].cost += (l.cost || 0);
      vehSummary[l.vehicleId].count += 1;
      if (l.yield && l.yield > 0) vehSummary[l.vehicleId].yields.push(l.yield);
    });

    var vehKeys = Object.keys(vehSummary).sort(function (a, b) {
      return vehSummary[b].cost - vehSummary[a].cost;
    });

    if (vehKeys.length > 0) {
      html += '<div class="card" style="padding:0;">' +
        '<div class="card-header" style="padding:14px 20px;"><h4 style="margin:0;">📊 Consumo por Vehículo (Período Seleccionado)</h4></div>' +
        '<div class="table-wrapper"><table><thead><tr>' +
        '<th>Vehículo</th><th>Tiquetes</th><th>Galones</th><th>Gasto Total</th><th>Rend. Promedio</th><th>Estado</th>' +
        '</tr></thead><tbody>';

      vehKeys.forEach(function (vid) {
        var v = vMap[vid];
        var s = vehSummary[vid];
        var avgY = s.yields.length ? s.yields.reduce(function (a, b) { return a + b; }, 0) / s.yields.length : null;
        var ms = isVehicleInMaintenance(vid);
        html += '<tr>' +
          '<td>' + (v ? '<strong style="color:var(--accent-cyan);">' + Utils.escapeHtml(v.plate) + '</strong><div class="text-xs text-muted">' + Utils.escapeHtml((v.brand || '') + ' ' + (v.model || '')) + '</div>' : '<span class="text-muted">' + vid + '</span>') + '</td>' +
          '<td>' + s.count + '</td>' +
          '<td><strong>' + s.gal.toFixed(2) + '</strong> Gal</td>' +
          '<td style="font-weight:700;color:var(--color-success);">$ ' + Utils.fmtNum(Math.round(s.cost)) + '</td>' +
          '<td>' + (avgY ? '<span style="font-weight:700;">' + avgY.toFixed(1) + ' hrs/Gal</span>' : '—') + '</td>' +
          '<td>' + (ms.inMaintenance ? '<span class="badge badge-red">🔴 En Mantenimiento (' + ms.downtimeDays + ' días)</span>' : '<span class="badge badge-green">✅ Operativo</span>') + '</td>' +
          '</tr>';
      });

      html += '</tbody></table></div></div>';
    }

    return html;
  }

  // ── Modal de Nuevo Tiquete ─────────────────────────────
  function showFuelTicketModal(preselectedVehicleId) {
    var allVehicles = DB.getAll('vehicles').filter(function (v) { return v.active; });
    var allFuelLogs = DB.getAll('fuelLogs');
    var fuelTypes = ['Gasolina Corriente', 'Gasolina Extra', 'Diesel / ACPM', 'Gas Natural (GNV)', 'Biodiesel'];

    // Auto-generate ticket number
    var ticketCount = allFuelLogs.length + 1;
    var autoTicket = 'TQ-' + String(ticketCount).padStart(3, '0');

    var old = document.getElementById('fuel-ticket-modal'); if (old) old.remove();

    var html = '<div class="modal-overlay" id="fuel-ticket-modal"><div class="modal modal-lg">' +
      '<div class="modal-header"><h3>📋 Nuevo Tiquete de Combustible</h3><button class="modal-close" id="ftic-close">✕</button></div>' +
      '<div class="modal-body">' +
      '<div class="form-grid">' +
      // Fila 1: N° Tiquete y Fecha
      '<div class="form-group"><label>N° Tiquete *</label><input class="form-input" id="ftic-num" value="' + Utils.escapeHtml(autoTicket) + '" placeholder="Ej: TQ-001"></div>' +
      '<div class="form-group"><label>Fecha *</label><input class="form-input" type="date" id="ftic-date" value="' + Utils.todayISO() + '" max="' + Utils.todayISO() + '"></div>' +
      // Fila 2: Vehículo
      '<div class="form-group span-2">' +
      '<label>🚗 Placa / Vehículo *</label>' +
      '<select class="form-select" id="ftic-veh">' +
      '<option value="">Selecciona una placa...</option>' +
      allVehicles.map(function (v) {
        var ms = isVehicleInMaintenance(v.id);
        var disabled = ms.inMaintenance ? ' disabled' : '';
        var suffix = ms.inMaintenance ? ' 🔴 EN MANTENIMIENTO — NO DISPONIBLE' : '';
        return '<option value="' + v.id + '"' + (preselectedVehicleId === v.id ? ' selected' : '') + disabled + ' data-plate="' + Utils.escapeHtml(v.plate) + '" data-name="' + Utils.escapeHtml((v.brand || '') + ' ' + (v.model || '') + ' ' + v.year) + '" data-km="' + (v.hours || 0) + '">' +
          Utils.escapeHtml(v.plate + ' — ' + (v.brand || '') + ' ' + (v.model || '') + ' ' + v.year) + suffix + '</option>';
      }).join('') +
      '</select>' +
      '<div id="ftic-maint-warn" style="display:none;margin-top:6px;padding:8px 12px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:var(--radius-md);color:var(--color-danger);font-size:0.82rem;font-weight:700;">🔴 Este vehículo tiene una Orden de Trabajo abierta y no puede recibir combustible.</div>' +
      '</div>' +
      // Fila 3: Horas
      '<div class="form-group span-2"><label>Horómetro Actual (Horas) *</label>' +
      '<input class="form-input" type="number" id="ftic-hrs" placeholder="0" min="0">' +
      '<div id="ftic-yield-info" class="text-xs" style="margin-top:4px;color:var(--accent-primary);font-weight:600;"></div>' +
      '</div>' +
      // Fila 4: Galones, Precio, Costo
      '<div class="form-group"><label>Galones *</label><input class="form-input" type="number" id="ftic-gal" step="0.001" placeholder="0.000"></div>' +
      '<div class="form-group"><label>Precio por Galón ($) *</label><input class="form-input" type="number" id="ftic-price" placeholder="0"></div>' +
      '<div class="form-group"><label>Costo Total ($)</label><input class="form-input" type="number" id="ftic-cost" placeholder="Calculado automáticamente"></div>' +
      // Fila 5: Tipo y Tanque
      '<div class="form-group"><label>Tipo de Combustible</label><select class="form-select" id="ftic-type">' +
      fuelTypes.map(function (t) { return '<option value="' + t + '">' + t + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="form-group"><label>¿Tanque Lleno?</label>' +
      '<div class="flex gap-3" style="margin-top:8px;">' +
      '<label style="cursor:pointer;"><input type="radio" name="ftic-full" value="1" checked> Sí (tanque lleno)</label>' +
      '<label style="cursor:pointer;"><input type="radio" name="ftic-full" value="0"> Parcial</label>' +
      '</div></div>' +
      // Fila 6: Estación
      '<div class="form-group span-2"><label>Estación de Servicio</label><input class="form-input" id="ftic-station" placeholder="Ej: Texaco Norte, EDS Principal..."></div>' +
      '</div>' +
      '</div>' +
      '<div class="modal-footer">' +
      '<button class="btn btn-secondary" id="ftic-cancel">Cancelar</button>' +
      '<button class="btn btn-primary" id="ftic-save">💾 Guardar Tiquete</button>' +
      '</div>' +
      '</div></div>';

    document.body.insertAdjacentHTML('beforeend', html);
    var ov = document.getElementById('fuel-ticket-modal');
    var close = function () { ov.remove(); };
    document.getElementById('ftic-close').onclick = close;
    document.getElementById('ftic-cancel').onclick = close;
    ov.onclick = function (e) { if (e.target === ov) close(); };

    var inpGal = document.getElementById('ftic-gal');
    var inpPrice = document.getElementById('ftic-price');
    var inpCost = document.getElementById('ftic-cost');
    var inpKm = document.getElementById('ftic-hrs');
    var selVeh = document.getElementById('ftic-veh');
    var warnDiv = document.getElementById('ftic-maint-warn');
    var yieldInfo = document.getElementById('ftic-yield-info');

    // Prellenar km cuando se selecciona vehículo
    selVeh.onchange = function () {
      var opt = selVeh.options[selVeh.selectedIndex];
      var hours = opt.getAttribute('data-km'); // El atributo se llama data-km pero contiene horas
      if (hours) inpKm.value = hours;
      // Advertencia de mantenimiento
      if (opt.disabled) {
        warnDiv.style.display = 'block';
      } else {
        warnDiv.style.display = 'none';
      }
      updateCalc('km');
    };

    // Prellenar km del vehículo preseleccionado
    if (preselectedVehicleId) {
      var v = DB.getById('vehicles', preselectedVehicleId);
      if (v) inpKm.value = v.hours || 0;
    }

    function updateCalc(source) {
      var gal = parseFloat(inpGal.value) || 0;
      var price = parseFloat(inpPrice.value) || 0;
      var cost = parseFloat(inpCost.value) || 0;
      if (source === 'gal' || source === 'price') {
        if (gal && price) inpCost.value = (gal * price).toFixed(0);
      } else if (source === 'cost') {
        if (cost && price) inpGal.value = (cost / price).toFixed(3);
        else if (cost && gal) inpPrice.value = (cost / gal).toFixed(0);
      }
      // Rendimiento estimado y alerta de consumo inusual
      var vid = selVeh.value;
      if (vid) {
        var v = DB.getById('vehicles', vid);
        var vLogs = allFuelLogs.filter(function (l) { return l.vehicleId === vid; }).sort(function (a, b) { return a.hours < b.hours ? -1 : 1; });
        var lastLog = vLogs.length ? vLogs[vLogs.length - 1] : null;
        var hrsInput = parseFloat(inpKm.value) || 0;

        if (lastLog && hrsInput > lastLog.hours && gal > 0) {
          var diff = hrsInput - lastLog.hours;
          var y = (diff / gal).toFixed(1);
          yieldInfo.innerHTML = '⚡ Rendimiento estimado: ' + y + ' hrs/Gal';
          yieldInfo.style.color = parseFloat(y) < 25 ? 'var(--color-warning)' : 'var(--accent-primary)';

          // Poka-Yoke: Alerta de desviación (Gallons / Hours)
          var currentPerformance = gal / diff;
          var historicalPerformances = [];
          vLogs.forEach(function (l, idx) {
            var prevHrs = (idx === 0) ? (v.hoursStart || 0) : vLogs[idx - 1].hours;
            var d = l.hours - prevHrs;
            if (d > 0 && l.gallons > 0) historicalPerformances.push(l.gallons / d);
          });

          if (historicalPerformances.length > 0) {
            var avgPerf = historicalPerformances.reduce(function (a, b) { return a + b; }, 0) / historicalPerformances.length;
            var deviation = Math.abs(currentPerformance - avgPerf) / avgPerf;
            if (deviation > 0.5) {
              if (window._fuelDevTimeout) clearTimeout(window._fuelDevTimeout);
              window._fuelDevTimeout = setTimeout(function () {
                Utils.toast('Aviso: El consumo ingresado es inusual para este vehículo. Verifique los datos.', 'warning');
              }, 1000);
            }
          }
        } else {
          yieldInfo.innerHTML = '';
        }
      }
    }

    inpGal.oninput = function () { updateCalc('gal'); };
    inpPrice.oninput = function () { updateCalc('price'); };
    inpCost.oninput = function () { updateCalc('cost'); };
    inpKm.oninput = function () { updateCalc('km'); };

    document.getElementById('ftic-save').onclick = function () {
      var ticketNum = document.getElementById('ftic-num').value.trim();
      var date = document.getElementById('ftic-date').value;
      var vid = selVeh.value;
      var hours = Math.max(0, parseFloat(inpKm.value) || 0);
      var gallons = Math.max(0, parseFloat(inpGal.value) || 0);
      var price = Math.max(0, parseFloat(inpPrice.value) || 0);
      var cost = Math.max(0, parseFloat(inpCost.value) || 0);
      var fuelType = document.getElementById('ftic-type').value;
      var fullTankEl = document.querySelector('input[name="ftic-full"]:checked');
      var fullTank = fullTankEl ? fullTankEl.value === '1' : true;
      var station = document.getElementById('ftic-station').value.trim();

      if (!ticketNum) { Utils.toast('El N° de tiquete es obligatorio.', 'warning'); return; }
      if (!date) { Utils.toast('La fecha es obligatoria.', 'warning'); return; }
      if (!vid) { Utils.toast('Selecciona un vehículo.', 'warning'); return; }
      if (!gallons || gallons <= 0) { Utils.toast('Ingresa los galones cargados.', 'warning'); return; }
      if (!cost || cost <= 0) { Utils.toast('Ingresa el costo total.', 'warning'); return; }

      // Bloquear si está en mantenimiento
      var ms = isVehicleInMaintenance(vid);
      if (ms.inMaintenance) {
        var otNums = ms.openOTs.map(function (o) { return o.number; }).join(', ');
        Utils.toast('❌ Este vehículo está en mantenimiento (OT: ' + otNums + '). No puede recibir combustible.', 'error', 5000);
        return;
      }

      var v = DB.getById('vehicles', vid);
      if (hours < (v.hours || 0)) {
        Utils.toast('El horómetro no puede ser menor al valor actual registrado.', 'error');
        return;
      }

      // Calcular rendimiento
      var vehLogs = allFuelLogs.filter(function (l) { return l.vehicleId === vid; });
      vehLogs.sort(function (a, b) { return a.hours < b.hours ? -1 : 1; });
      var lastFull = null;
      for (var i = vehLogs.length - 1; i >= 0; i--) {
        if (vehLogs[i].fullTank) { lastFull = vehLogs[i]; break; }
      }
      var lastLog = vehLogs.length ? vehLogs[vehLogs.length - 1] : null;
      var yieldHrsGal = null;
      if (fullTank && lastFull && hours > lastFull.hours && gallons > 0) {
        var galsInBetween = vehLogs.filter(function (l) { return l.hours > lastFull.hours; }).reduce(function (acc, l) { return acc + l.gallons; }, 0) + gallons;
        yieldHrsGal = (hours - lastFull.hours) / galsInBetween;
      } else if (lastLog && hours > lastLog.hours && gallons > 0) {
        yieldHrsGal = (hours - lastLog.hours) / gallons;
      }

      DB.create('fuelLogs', {
        ticketNumber: ticketNum,
        ticket: ticketNum,
        vehicleId: vid,
        vehiclePlate: v.plate,
        vehicleName: (v.brand || '') + ' ' + (v.model || '') + ' ' + v.year,
        date: date,
        hours: hours,
        gallons: gallons,
        pricePerGal: price,
        cost: cost,
        fuelType: fuelType,
        fullTank: fullTank,
        station: station,
        yield: yieldHrsGal,
        createdAt: Utils.todayISO()
      });

      if (hours > (v.hours || 0)) {
        DB.update('vehicles', vid, { hours: hours });
      }

      Utils.toast('✅ Tiquete ' + ticketNum + ' registrado correctamente.', 'success', 4000);

      // Alerta rendimiento bajo
      if (yieldHrsGal !== null && vehLogs.length >= 2) {
        var historicalYields = vehLogs.filter(function (l) { return l.yield && l.yield > 0; }).map(function (l) { return l.yield; });
        if (historicalYields.length >= 2) {
          var avgHist = historicalYields.reduce(function (a, b) { return a + b; }, 0) / historicalYields.length;
          var dropPct = ((avgHist - yieldHrsGal) / avgHist) * 100;
          if (dropPct > 15) {
            setTimeout(function () {
              Utils.toast('⚠️ Rendimiento inusualmente bajo: ' + yieldHrsGal.toFixed(1) + ' vs promedio ' + avgHist.toFixed(1) + ' hrs/Gal. Verifica el estado del motor.', 'warning', 6000);
            }, 500);
          }
        }
      }

      close();
      render();
    };
  }



  function _drawCombCharts() {
    var allFuelLogs = DB.getAll('fuelLogs');
    var logs = allFuelLogs;
    if (combFilterVehicle) logs = logs.filter(function (l) { return l.vehicleId === combFilterVehicle; });

    // ── Gasto semanal ─────────────────────────────────────
    var costEl = document.getElementById('comb-chart-cost');
    if (costEl) {
      var weeks = []; var wLabels = [];
      for (var w = 7; w >= 0; w--) {
        var wEnd = new Date(); wEnd.setDate(wEnd.getDate() - w * 7);
        var wStart = new Date(wEnd); wStart.setDate(wStart.getDate() - 6);
        var wEndStr = wEnd.toISOString().split('T')[0];
        var wStartStr = wStart.toISOString().split('T')[0];
        var wCost = logs.filter(function (l) { return l.date >= wStartStr && l.date <= wEndStr; })
          .reduce(function (a, l) { return a + (l.cost || 0); }, 0);
        weeks.push(wCost);
        wLabels.push('S' + (8 - w));
      }
      costEl.innerHTML = '<canvas id="cnv-comb-cost" style="width:100%;height:140px;"></canvas>';
      setTimeout(function () { Utils.drawBarChart('cnv-comb-cost', wLabels, weeks, 'rgba(245,158,11,0.85)'); }, 60);
    }

    // ── Rendimiento últimos 15 tanqueos ───────────────────
    var yieldEl = document.getElementById('comb-chart-yield');
    if (yieldEl) {
      var yLogs = logs.filter(function (l) { return l.yield > 0; }).slice(-15);
      if (yLogs.length < 2) {
        yieldEl.innerHTML = '<p class="text-muted text-sm" style="padding:16px;text-align:center;">Se necesitan al menos 2 tanqueos con rendimiento calculado.</p>';
      } else {
        var yLabels = yLogs.map(function (l, i) {
          var v = DB.getAll('vehicles').find(function (x) { return x.id === l.vehicleId; });
          return (v ? v.plate.split('-')[0] : '') + ' ' + l.date.substring(5);
        });
        var yVals = yLogs.map(function (l) { return l.yield; });
        yieldEl.innerHTML = '<canvas id="cnv-comb-yield" style="width:100%;height:140px;"></canvas>';
        setTimeout(function () { Utils.drawBarChart('cnv-comb-yield', yLabels, yVals, 'rgba(16,185,129,0.85)'); }, 80);
      }
    }
  }

  function exportCombustible() {
    var allFuelLogs = DB.getAll('fuelLogs');
    var vehicles = DB.getAll('vehicles'); var vMap = {}; vehicles.forEach(function (v) { vMap[v.id] = v; });
    var logs = allFuelLogs.filter(function (l) {
      return l.date >= combFilterFrom && l.date <= combFilterTo;
    });
    if (combFilterVehicle) logs = logs.filter(function (l) { return l.vehicleId === combFilterVehicle; });
    logs.sort(function (a, b) { return b.date < a.date ? -1 : 1; });

    // Km recorridos
    var vehLogsSorted = {};
    allFuelLogs.forEach(function (l) {
      if (!vehLogsSorted[l.vehicleId]) vehLogsSorted[l.vehicleId] = [];
      vehLogsSorted[l.vehicleId].push(l);
    });
    Object.keys(vehLogsSorted).forEach(function (vid) {
      vehLogsSorted[vid].sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    });

    var rows = logs.map(function (l) {
      var v = vMap[l.vehicleId];
      var vSorted = vehLogsSorted[l.vehicleId] || [];
      var idx = vSorted.findIndex(function (x) { return x.id === l.id; });
      var hrsWorked = (idx > 0 && vSorted[idx - 1].hours && l.hours) ? l.hours - vSorted[idx - 1].hours : '';
      return [
        l.date, v ? v.plate : '—', v ? (v.brand + ' ' + v.model) : '—',
        l.gallons || 0, l.fuelType || '', l.fullTank ? 'Sí' : 'Parcial',
        l.hours || 0, hrsWorked, l.yield ? parseFloat(l.yield.toFixed(2)) : '',
        l.pricePerGal || 0, l.cost || 0, l.station || '', l.ticket || ''
      ];
    });
    Utils.exportExcel(
      'reporte_combustible_' + Utils.todayISO() + '.xlsx',
      'Historial de Tanqueos de Flota',
      ['Fecha', 'Placa', 'Vehículo', 'Galones', 'Tipo', 'Tanque Lleno', 'Horómetro', 'Horas Trabajadas', 'Rend. hrs/Gal', 'Precio/Gal', 'Costo Total', 'Estación', 'Ticket'],
      rows
    );
    Utils.toast('Reporte de combustible exportado.', 'success');
  }

  function deleteDocument(docId, vehicleId) {
    Utils.confirm('¿Eliminar este documento?', 'Eliminar Documento', function () {
      DB.remove('vehicleDocuments', docId);
      Utils.toast('Documento eliminado.', 'success');
      renderVehicleDocs(vehicleId);
    }, true);
  }

  function deleteInspection(inspId, vehicleId) {
    Utils.confirm('¿Eliminar este registro de inspección?', 'Eliminar Inspección', function () {
      DB.remove('vehicleInspections', inspId);
      syncVehicleOdometer(vehicleId);
      Utils.toast('Inspección eliminada.', 'success');
      renderInspections(vehicleId);
    }, true);
  }

  // ══════════════════════════════════════════════════════════
  //  📍 HORÓMETRO DIARIO — Sistema de registro diario de horómetro
  // ══════════════════════════════════════════════════════════
  function renderKmDiario(allVehicles) {
    var today = Utils.todayISO();
    var selDate = kmDiarioDate || today;
    var selYear = parseInt(selDate.substring(0, 4));
    var selMonth = parseInt(selDate.substring(5, 7));
    var activeVehicles = allVehicles.filter(function (v) { return v.active; });
    var allLogs = DB.getAll('hoursLogs');

    var daysInMonth = new Date(selYear, selMonth, 0).getDate();
    var monthDates = [];
    for (var i = 1; i <= daysInMonth; i++) {
      var dStr = selYear + '-' + String(selMonth).padStart(2, '0') + '-' + String(i).padStart(2, '0');
      monthDates.push(dStr);
    }

    var html = '<div class="card" style="margin-bottom:20px; padding:0; overflow:hidden;">' +
      '<div style="padding:20px 20px 10px 20px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;">' +
      '<div>' +
      '<h3 style="margin:0 0 4px 0;">⏱️ Matriz Mensual de Horómetro Diario</h3>' +
      '<div style="font-size:0.85rem;color:var(--text-muted);">Selecciona cualquier celda para agregar o editar las horas trabajadas de un vehículo en un día específico.</div>' +
      '</div>' +
      '<div style="display:flex; align-items:center; gap:12px;">' +
      '<div style="text-align:right;">' +
      '<div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Mes y Año</div>' +
      '<input type="month" id="km-date-sel" value="' + selYear + '-' + String(selMonth).padStart(2, '0') + '" max="' + today.substring(0, 7) + '" ' +
      'style="background:var(--bg-elevated); border:1px solid var(--border); border-radius:var(--radius-md); padding:8px 12px; color:var(--text-primary); font-size:0.95rem; outline:none;">' +
      '</div>' +
      '</div>' +
      '</div>';

    if (!activeVehicles.length) {
      html += '<div class="empty-state" style="padding:40px;"><div class="empty-state-icon">🚗</div><p>No hay vehículos activos en la flota.</p></div></div>';
      return html;
    }

    html += '<div class="table-wrapper" style="overflow-x:auto; max-width:100%; padding-bottom:10px;">' +
      '<table id="km-matrix-table" style="min-width:max-content; border-collapse:separate; border-spacing:0; width:100%; border-top:1px solid var(--border);">' +
      '<thead><tr>' +
      '<th style="position:sticky; left:0; background:var(--bg-card); z-index:2; border-right:2px solid var(--border); border-bottom:1px solid var(--border); box-shadow: 2px 0 5px rgba(0,0,0,0.05); text-align:left; padding:12px 16px;">Placa / Vehículo</th>';

    monthDates.forEach(function (d) {
      var dayNum = d.substring(8, 10);
      var isTd = d === today;
      html += '<th style="text-align:center; min-width:48px; padding:10px 4px; border-bottom:1px solid var(--border); font-size:0.85rem; border-right:1px solid var(--border);' + (isTd ? 'background:rgba(59,130,246,0.1); color:var(--accent-primary); font-weight:800;' : '') + '">' + dayNum + (isTd ? '<div style="font-size:0.6rem;text-transform:uppercase;">Hoy</div>' : '') + '</th>';
    });
    html += '</tr></thead><tbody>';

    activeVehicles.forEach(function (v) {
      html += '<tr>' +
        '<td style="position:sticky; left:0; background:var(--bg-card); z-index:1; border-right:2px solid var(--border); border-bottom:1px solid var(--border); padding:10px 16px; box-shadow: 2px 0 5px rgba(0,0,0,0.02);">' +
        '<strong style="font-size:0.9rem; color:var(--accent-cyan); letter-spacing:0.04em;">' + Utils.escapeHtml(v.plate) + '</strong>' +
        '<div style="font-size:0.7rem; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:120px;">' + Utils.escapeHtml((v.brand || '') + ' ' + (v.model || '')) + '</div>' +
        '</td>';

      monthDates.forEach(function (dateStr) {
        var log = allLogs.find(function (l) { return l.vehicleId === v.id && l.date === dateStr; });
        var isFuture = dateStr > today;
        var tdStyle = 'text-align:center; padding:6px 4px; border-bottom:1px solid var(--border); border-right:1px solid var(--border); cursor:' + (isFuture ? 'not-allowed' : 'pointer') + '; transition:all 0.15s; position:relative;';

        var cellContent = '';
        if (isFuture) {
          tdStyle += ' background:var(--bg-elevated); opacity:0.4;';
          cellContent = '<span class="text-muted text-xs">—</span>';
        } else if (log) {
          tdStyle += ' background:rgba(34,197,94,0.08);';
          cellContent = '<div style="font-size:0.85rem; font-weight:800; color:var(--color-success); line-height:1.1;">+' + Utils.fmtNum(log.workedHours || 0) + '</div>' +
            '<div style="font-size:0.65rem; color:var(--text-muted); margin-top:2px;">' + Utils.fmtNum(log.totalHours || log.km || 0) + '</div>';
        } else {
          tdStyle += ' background:rgba(239,68,68,0.02);';
          cellContent = '<div style="font-size:1.2rem; color:var(--text-muted); opacity:0.4; line-height:1; user-select:none;">+</div>';
        }

        var dataAttrs = isFuture ? '' : ' data-veh="' + Utils.escapeHtml(v.id) + '" data-date="' + dateStr + '" class="km-cell"';
        html += '<td style="' + tdStyle + '" ' + dataAttrs + ' title="' + dateStr + ' | ' + Utils.escapeHtml(v.plate) + '">' + cellContent + '</td>';
      });
      html += '</tr>';
    });

    html += '</tbody></table></div></div>';

    return html;
  }

  function showKmEntryModal(vehicleId, dateContext) {
    var v = DB.getById('vehicles', vehicleId);
    if (!v) return;
    var today = Utils.todayISO();
    var defaultDate = dateContext || today;
    var allLogs = DB.getAll('hoursLogs');
    var existingLog = allLogs.find(function (l) { return l.vehicleId === vehicleId && l.date === defaultDate; });

    // Km base: el total acumulado hasta ayer
    var prevLog = allLogs
      .filter(function (l) { return l.vehicleId === vehicleId && l.date < defaultDate; })
      .sort(function (a, b) { return b.date < a.date ? -1 : 1; })[0];
    var baseHours = prevLog ? (prevLog.totalHours || prevLog.hours || 0) : (v.hours || 0);
    var existingTraveled = existingLog ? (existingLog.workedHours || 0) : 0;
    var icon = TYPE_ICONS[v.type] || '🚙';

    var old = document.getElementById('km-entry-modal'); if (old) old.remove();

    var html = '<div class="modal-overlay" id="km-entry-modal"><div class="modal modal-sm">' +
      '<div class="modal-header">' +
      '<div style="display:flex;align-items:center;gap:10px;">' +
      '<span style="font-size:1.5rem;">' + icon + '</span>' +
      '<div><h3 style="margin:0;">⏱️ Horas Trabajadas Diarias — ' + Utils.escapeHtml(v.plate) + '</h3>' +
      '<div style="font-size:0.75rem;color:var(--text-muted);">' + Utils.escapeHtml((v.brand || '') + ' ' + (v.model || '')) + '</div></div>' +
      '</div>' +
      '<button class="modal-close" id="km-modal-close">✕</button>' +
      '</div>' +
      '<div class="modal-body">' +

      // Aviso retroactivo
      (defaultDate < today
        ? '<div style="background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.3);border-radius:var(--radius-md);padding:8px 12px;margin-bottom:12px;font-size:0.8rem;color:var(--accent-primary);">'
        + '📅 Registro retroactivo para: <strong>' + Utils.formatDate(defaultDate) + '</strong></div>'
        : '') +

      // Aviso si edita existente
      (existingLog
        ? '<div style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:var(--radius-md);padding:8px 12px;margin-bottom:12px;font-size:0.8rem;color:var(--color-warning);">'
        + '✏️ Editando registro existente de este día. Se actualizará.</div>'
        : '') +

      // Fecha
      '<div class="form-group">' +
      '<label>📅 Fecha del Registro</label>' +
      '<input type="date" id="km-entry-date" class="form-control" value="' + defaultDate + '" max="' + today + '">' +
      '</div>' +

      // Panel de referencia (hours base)
      '<div style="background:var(--bg-elevated);border-radius:var(--radius-md);padding:12px 16px;margin-bottom:14px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;">' +
      '<div>' +
      '<div style="font-size:0.7rem;text-transform:uppercase;font-weight:700;color:var(--text-muted);">Horómetro base (inicio del día)</div>' +
      '<div style="font-size:1.3rem;font-weight:800;color:var(--accent-primary);">' + Utils.fmtNum(baseHours) + ' <small style="font-size:0.7rem;font-weight:500;">hrs</small></div>' +
      '</div>' +
      '<div style="font-size:1.5rem;">🚗</div>' +
      '</div>' +
      '</div>' +

      // Entrada: KM RECORRIDOS HOY (no el odómetro total)
      '<div class="form-group">' +
      '<label style="font-size:0.95rem;font-weight:700;">⏱️ Horas trabajadas hoy</label>' +
      '<input type="number" id="km-entry-value" class="form-control" value="' + existingTraveled + '" min="0" placeholder="Ej: 8" ' +
      'style="font-size:1.8rem;font-weight:900;text-align:center;padding:16px;letter-spacing:0.04em;color:var(--accent-primary);">' +
      '<div id="km-entry-result" style="text-align:center;margin-top:8px;padding:8px;background:var(--bg-elevated);border-radius:var(--radius-md);">' +
      '<div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;font-weight:700;">Nuevo horómetro resultante</div>' +
      '<div id="km-entry-total" style="font-size:1.2rem;font-weight:800;color:var(--text-primary);">' + Utils.fmtNum(baseHours + existingTraveled) + ' hrs</div>' +
      '</div>' +
      '</div>' +

      // Notas
      '<div class="form-group">' +
      '<label>📝 Notas (opcional)</label>' +
      '<input type="text" id="km-entry-notes" class="form-control" placeholder="Ej: Ruta norte, entrega cliente, etc." value="' + Utils.escapeHtml(existingLog ? existingLog.notes || '' : '') + '">' +
      '</div>' +

      '</div>' +
      '<div class="modal-footer">' +
      '<button class="btn btn-secondary" id="km-modal-cancel">Cancelar</button>' +
      '<button class="btn btn-primary" id="km-modal-save" style="flex:1;">💾 Guardar Horas</button>' +
      '</div>' +
      '</div></div>';

    document.body.insertAdjacentHTML('beforeend', html);
    var ov = document.getElementById('km-entry-modal');
    var close = function () { ov.remove(); };
    document.getElementById('km-modal-close').onclick = close;
    document.getElementById('km-modal-cancel').onclick = close;
    ov.onclick = function (e) { if (e.target === ov) close(); };

    var inpKm = document.getElementById('km-entry-value');
    var totalDiv = document.getElementById('km-entry-total');
    function updateTotal() {
      var traveled = parseFloat(inpKm.value) || 0;
      var newTotal = baseHours + traveled;
      totalDiv.textContent = Utils.fmtNum(newTotal) + ' hrs';
      totalDiv.style.color = traveled > 0 ? 'var(--color-success)' : 'var(--text-muted)';
    }
    inpKm.oninput = updateTotal;
    updateTotal();

    document.getElementById('km-modal-save').onclick = function () {
      var date = document.getElementById('km-entry-date').value;
      var workedHours = parseFloat(inpKm.value) || 0;
      var notes = document.getElementById('km-entry-notes').value.trim();

      // Validaciones
      if (!date) { Utils.toast('La fecha es obligatoria.', 'warning'); return; }
      if (date > today) { Utils.toast('No puedes registrar para fechas futuras.', 'error'); return; }
      if (isNaN(workedHours) || workedHours < 0) { Utils.toast('Ingresa las horas trabajadas (número positivo).', 'warning'); return; }
      if (workedHours === 0) {
        if (!confirm('Vas a registrar 0 horas trabajadas. ¿El vehículo no operó hoy?')) return;
      }
      if (workedHours > 24) {
        if (!confirm('⚠️ Detectado un valor inusual: ' + Utils.fmtNum(workedHours) + ' horas en un día. ¿Es correcto?')) return;
      }

      var totalHours = baseHours + workedHours;

      // Guardar o actualizar
      var existing = allLogs.find(function (l) { return l.vehicleId === vehicleId && l.date === date; });
      if (existing) {
        DB.update('hoursLogs', existing.id, { workedHours: workedHours, totalHours: totalHours, notes: notes, updatedAt: today });
      } else {
        DB.create('hoursLogs', { vehicleId: vehicleId, date: date, workedHours: workedHours, totalHours: totalHours, notes: notes, createdAt: today });
      }

      // Actualizar km maestro del vehículo de manera segura (solo incrementar)
      if (totalHours > (v.hours || 0)) {
        DB.update('vehicles', vehicleId, { hours: totalHours });
      }

      Utils.toast('✅ ' + v.plate + ': +' + Utils.fmtNum(workedHours) + ' hrs hoy → Total: ' + Utils.fmtNum(totalHours) + ' hrs', 'success');
      close();
      render();
    };
  }

  function deleteKmLog(logId) {
    Utils.confirm('¿Eliminar este registro de horómetro?', 'Eliminar Registro', function () {
      var log = DB.getAll('hoursLogs').find(function (l) { return l.id === logId; });
      DB.remove('hoursLogs', logId);
      if (log) {
        syncVehicleOdometer(log.vehicleId);
      }
      Utils.toast('Registro eliminado.', 'success');
      render();
    }, true);
  }

  // ══════════════════════════════════════════════════════════
  //  Sincronizador Maestro de Odómetro
  // ══════════════════════════════════════════════════════════
  function syncVehicleOdometer(vehicleId) {
    var maxKm = 0;
    // 1. Logs diarios
    DB.getAll('hoursLogs').filter(function (l) { return l.vehicleId === vehicleId; }).forEach(function (l) { if (l.totalHours > maxKm) maxKm = l.totalHours; });
    // 2. Combustible
    DB.getAll('fuelLogs').filter(function (l) { return l.vehicleId === vehicleId; }).forEach(function (l) { if (l.hours > maxKm) maxKm = l.hours; });
    // 3. Mantenimientos
    DB.getAll('maintenanceLogs').filter(function (l) { return l.vehicleId === vehicleId; }).forEach(function (l) { if (l.hours > maxKm) maxKm = l.hours; });
    // 4. Inspecciones
    DB.getAll('vehicleInspections').filter(function (l) { return l.vehicleId === vehicleId; }).forEach(function (l) { if (l.hours > maxKm) maxKm = l.hours; });

    var v = DB.getById('vehicles', vehicleId);
    if (v && maxKm > (v.hours || 0)) {
      DB.update('vehicles', vehicleId, { hours: maxKm });
    }
  }

  return {
    render: render,
    showVehicleModal: showVehicleModal,
    showHistory: showHistory,
    toggleActive: toggleActive,
    deleteVehicle: deleteVehicle,
    exportVehicleExcel: exportVehicleExcel,
    getVehicleSelector: getVehicleSelector,
    getVehicleLabel: getVehicleLabel,
    TYPE_ICONS: TYPE_ICONS,
    promptUpdateKm: promptUpdateKm,
    renderPreventivos: renderPreventivos,
    showRoutineModal: showRoutineModal,
    deleteRoutine: deleteRoutine,
    showQuickMaintenanceModal: showQuickMaintenanceModal,
    deleteMaintenanceLog: deleteMaintenanceLog,
    showDocumentModal: showDocumentModal,
    deleteDocument: deleteDocument,
    showFuelModal: showFuelTicketModal,
    deleteFuelLog: deleteFuelLog,
    showInspectionModal: showInspectionModal,
    deleteInspection: deleteInspection,
    showAssignDriverModal: showAssignDriverModal,
    showKmEntryModal: showKmEntryModal,
    deleteKmLog: deleteKmLog,
    isVehicleInMaintenance: isVehicleInMaintenance,
    _rmQMat: function (idx) { /* sobreescrito por showQuickMaintenanceModal */ }
  };
})();
