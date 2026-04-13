/* ============================================================
   REPORTS.JS — Reports & analytics module — 5 tabs
   ============================================================ */

var ReportsModule = (function () {
  'use strict';

  var dateFrom = '', dateTo = '', filterVehicle = '';
  var activeTab = 'general'; // 'general' | 'technicians' | 'consumption' | 'preventivos' | 'kmdiario' | 'availability'

  // ── Main Render ────────────────────────────────────────────
  function render() {
    var today = Utils.todayISO();
    var thirtyDaysAgo = Utils.daysAgoISO(30);
    if (!dateFrom) dateFrom = thirtyDaysAgo;
    if (!dateTo) dateTo = today;

    // Solo los tabs general, técnicos, consumo y disponibilidad usan filtro de fecha/vehículo
    var showFilter = (activeTab === 'general' || activeTab === 'technicians' || activeTab === 'consumption' || activeTab === 'kmdiario' || activeTab === 'availability');

    var html = '<div class="section-header">' +
      '<div class="section-header-left"><h2>📊 Reportes</h2></div>' +
      '</div>' +

      // Tabs — 6 tabs
      '<div class="tabs" style="margin-bottom:20px;">' +
      '<button class="tab-btn ' + (activeTab === 'general' ? 'active' : '') + '" id="rpt-tab-gen">📊 General</button>' +
      '<button class="tab-btn ' + (activeTab === 'availability' ? 'active' : '') + '" id="rpt-tab-avail">⏱️ Disponibilidad</button>' +
      '<button class="tab-btn ' + (activeTab === 'technicians' ? 'active' : '') + '" id="rpt-tab-tech">👨‍🔧 Técnicos</button>' +
      '<button class="tab-btn ' + (activeTab === 'consumption' ? 'active' : '') + '" id="rpt-tab-cons">📦 Consumo</button>' +
      '<button class="tab-btn ' + (activeTab === 'preventivos' ? 'active' : '') + '" id="rpt-tab-prev">⚙️ Alertas Preventivas</button>' +
      '<button class="tab-btn ' + (activeTab === 'kmdiario' ? 'active' : '') + '" id="rpt-tab-hrs">📍 Horómetro Diario</button>' +
      '</div>' +

      // Filtro de fecha/vehículo (solo donde aplica)
      (showFilter
        ? '<div class="card" style="margin-bottom:20px;">' +
        '<div class="flex gap-3 items-center flex-wrap">' +
        '<div class="form-group" style="margin:0;"><label>Desde</label><input class="form-input" type="date" id="rpt-from" value="' + dateFrom + '"></div>' +
        '<div class="form-group" style="margin:0;"><label>Hasta</label><input class="form-input" type="date" id="rpt-to" value="' + dateTo + '"></div>' +
        '<div class="form-group" style="margin:0;"><label>Vehículo</label><select class="form-input" id="rpt-veh"><option value="">Todos los vehículos</option>' +
        DB.getAll('vehicles').filter(function (v) { return v.active; }).map(function (v) {
          return '<option value="' + v.id + '"' + (filterVehicle === v.id ? ' selected' : '') + '>' + Utils.escapeHtml(v.plate) + '</option>';
        }).join('') +
        '</select></div>' +
        '<button class="btn btn-primary" id="rpt-apply">Aplicar</button>' +
        '<button class="btn btn-secondary" id="rpt-reset">Últimos 30 Días</button>' +
        '</div></div>'
        : '') +

      '<div id="rpt-content"></div>';

    document.getElementById('section-reports').innerHTML = html;

    // Tab events
    document.getElementById('rpt-tab-gen').onclick = function () { activeTab = 'general'; render(); };
    document.getElementById('rpt-tab-avail').onclick = function () { activeTab = 'availability'; render(); };
    document.getElementById('rpt-tab-tech').onclick = function () { activeTab = 'technicians'; render(); };
    document.getElementById('rpt-tab-cons').onclick = function () { activeTab = 'consumption'; render(); };
    document.getElementById('rpt-tab-prev').onclick = function () { activeTab = 'preventivos'; render(); };
    document.getElementById('rpt-tab-hrs').onclick = function () { activeTab = 'kmdiario'; render(); };

    if (showFilter) {
      document.getElementById('rpt-apply').onclick = function () {
        dateFrom = document.getElementById('rpt-from').value;
        dateTo = document.getElementById('rpt-to').value;
        filterVehicle = document.getElementById('rpt-veh').value;
        renderTabContent();
      };
      document.getElementById('rpt-reset').onclick = function () {
        dateFrom = thirtyDaysAgo; dateTo = today; filterVehicle = '';
        document.getElementById('rpt-from').value = dateFrom;
        document.getElementById('rpt-to').value = dateTo;
        document.getElementById('rpt-veh').value = '';
        renderTabContent();
      };
    }

    renderTabContent();
  }

  // ── Route tab content ──────────────────────────────────────
  function renderTabContent() {
    var container = document.getElementById('rpt-content');
    if (!container) return;

    if (activeTab === 'general') {
      var wos = getWOsInRange(dateFrom, dateTo);
      var logs = getMaintenanceLogsInRange(dateFrom, dateTo);
      var movs = getMovsInRange(dateFrom, dateTo);
      container.innerHTML = renderGeneral(wos, movs, logs);
      var completed = wos.filter(function (w) { return w.status === 'completada'; });
      var salidas = movs.filter(function (m) { return m.type === 'salida'; });
      renderStatusChart(wos);
      renderVehicleCostsChart(completed, logs);
      renderMaterialChart(salidas);
      wireExportBtn('rpt-exp-wo', function () { exportWO(wos, logs); });
      wireExportBtn('rpt-exp-mov', function () { exportMov(movs); });
      wireExportBtn('rpt-exp-tco', exportConsolidatedTCO);

    } else if (activeTab === 'technicians') {
      var wos2 = getWOsInRange(dateFrom, dateTo);
      container.innerHTML = renderTechnicians(wos2);
      wireExportBtn('rpt-exp-tech', function () { exportTechnicians(wos2); });

    } else if (activeTab === 'consumption') {
      var movs2 = getMovsInRange(dateFrom, dateTo);
      container.innerHTML = renderConsumption(movs2);
      wireExportBtn('rpt-exp-cons', function () { exportConsumption(movs2); });

    } else if (activeTab === 'availability') {
      var wos3 = getWOsInRange(dateFrom, dateTo).filter(function(w){ return w.status === 'completada'; });
      container.innerHTML = renderAvailability(wos3);
      wireExportBtn('rpt-exp-avail', function () { exportAvailability(wos3); });

    } else if (activeTab === 'preventivos') {
      container.innerHTML = renderPreventivos();
      wireExportBtn('rpt-exp-prev', exportPreventivos);

    } else if (activeTab === 'kmdiario') {
      container.innerHTML = renderKmDiario();
      wireExportBtn('rpt-exp-hrs', function () { exportKmDiario(); });
    }
  }

  function wireExportBtn(id, fn) {
    var btn = document.getElementById(id);
    if (btn) btn.onclick = fn;
  }

  // ═══════════════════════════════════════════════════════════
  //  TAB: GENERAL
  // ═══════════════════════════════════════════════════════════
  function renderGeneral(wos, movs, logs) {
    var completed = wos.filter(function (w) { return w.status === 'completada'; });
    var salidas = movs.filter(function (m) { return m.type === 'salida'; });

    var woCost = completed.reduce(function (a, w) { return Utils.dec.add(a, w.totalCost || 0); }, 0);
    var logCost = logs.reduce(function (a, l) { return Utils.dec.add(a, l.totalCost || 0); }, 0);
    var allFuelLogs = DB.getAll('fuelLogs').filter(function (l) { return l.date >= dateFrom && l.date <= dateTo; });
    if (filterVehicle) allFuelLogs = allFuelLogs.filter(function (l) { return l.vehicleId === filterVehicle; });
    var fuelCost = allFuelLogs.reduce(function (a, l) { return Utils.dec.add(a, l.cost || 0); }, 0);
    var allDocCosts = DB.getAll('vehicleDocuments').filter(function (d) { return d.updatedAt ? (d.updatedAt >= dateFrom && d.updatedAt <= dateTo) : (d.createdAt >= dateFrom && d.createdAt <= dateTo); });
    if (filterVehicle) allDocCosts = allDocCosts.filter(function (d) { return d.vehicleId === filterVehicle; });
    var docCost = allDocCosts.reduce(function (a, d) { return Utils.dec.add(a, d.cost || 0); }, 0);
    var periodCost = Utils.dec.add(Utils.dec.add(woCost, logCost), Utils.dec.add(fuelCost, docCost));

    var html = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:16px;margin-bottom:24px;">' +
      kpiCard('💰', 'Gasto Total Operativo', '$ ' + Utils.fmtNum(periodCost), 'red') +
      kpiCard('⛽', 'Gasto Combustible', '$ ' + Utils.fmtNum(fuelCost), 'amber') +
      kpiCard('🔧', 'Gasto Mantenimiento', '$ ' + Utils.fmtNum(Utils.dec.add(woCost, logCost)), 'blue') +
      kpiCard('📄', 'Trámites/Docs', '$ ' + Utils.fmtNum(docCost), 'cyan') +
      kpiCard('📋', 'OTs del Período', wos.length, 'blue') +
      kpiCard('✅', 'OTs Completadas', completed.length, 'green') +
      '</div>';

    html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px;margin-bottom:24px;">' +
      '<div class="card"><div class="card-header"><h3>📈 OT por estado</h3></div><div id="chart-ot-status"></div></div>' +
      '<div class="card"><div class="card-header"><h3>💸 Costo por Vehículo</h3></div><div id="chart-costs"></div></div>' +
      '<div class="card"><div class="card-header"><h3>📦 Top repuestos consumidos</h3></div><div id="chart-materials"></div></div>' +
      '</div>';

    html += '<div class="card" style="padding:0;margin-bottom:20px;">' +
      '<div class="card-header" style="padding:16px 20px;"><h3>📊 Resumen Consolidado de Gastos por Vehículo (TCO)</h3><button class="btn btn-secondary btn-sm" id="rpt-exp-tco">📤 Exportar Excel Avanzado</button></div>' +
      '<div class="table-wrapper"><table><thead><tr>' +
      '<th>Vehículo / Placa</th><th>Repuestos OT</th><th>Mano de Obra</th><th>Svc. Externos</th><th>Combustible</th><th>Documentos</th><th style="color:var(--color-success);">TOTAL</th>' +
      '</tr></thead>' +
      '<tbody>' + renderVehicleConsolidatedRows(completed, logs, allFuelLogs, allDocCosts) + '</tbody></table></div></div>';

    html += '<div class="card" style="padding:0;margin-bottom:20px;">' +
      '<div class="card-header" style="padding:16px 20px;"><h3>🔧 Detalle de Intervenciones</h3><button class="btn btn-secondary btn-sm" id="rpt-exp-wo">📤 Excel</button></div>' +
      '<div class="table-wrapper"><table><thead><tr><th>Tipo</th><th>Número/ID</th><th>Fecha</th><th>Vehículo</th><th>Descripción</th><th>Costo</th><th>Estado</th></tr></thead>' +
      '<tbody>' + renderCombinedRows(wos, logs) + '</tbody></table></div></div>';

    html += '<div class="card" style="padding:0;">' +
      '<div class="card-header" style="padding:16px 20px;"><h3>📦 Movimientos en el Período</h3><button class="btn btn-secondary btn-sm" id="rpt-exp-mov">📤 Excel</button></div>' +
      '<div class="table-wrapper"><table><thead><tr><th>Fecha</th><th>Artículo</th><th>Tipo</th><th>Cant.</th><th>Costo Unit.</th><th>Costo Total</th><th>Referencia</th></tr></thead>' +
      '<tbody>' + renderMovRows(movs) + '</tbody></table></div></div>';

    return html;
  }

  // ═══════════════════════════════════════════════════════════
  //  TAB: TÉCNICOS
  // ═══════════════════════════════════════════════════════════
  function renderTechnicians(wos) {
    var employees = DB.getAll('employees').filter(function (e) { return e.active && e.isTechnician; });
    var positions = DB.getAll('positions');
    var settings = DB.getSettings();
    var baseHours = settings.monthlyWorkingHours || 220;
    var techStats = {};
    employees.forEach(function (e) {
      var pos = positions.find(function (p) { return p.id === e.positionId; });
      var salary = e.monthlySalary || 0;
      techStats[e.id] = { name: e.name, position: pos ? pos.name : '—', salary: salary, rate: Math.round(salary / baseHours), completed: 0, inProcess: 0, cancelled: 0, totalHours: 0, laborCost: 0, totalCost: 0, wos: [] };
    });

    wos.forEach(function (w) {
      // 1. OT donde es el responsable principal
      if (techStats[w.assignedTo]) {
        techStats[w.assignedTo].wos.push(w);
        if (w.status === 'completada') {
          techStats[w.assignedTo].completed++;
          techStats[w.assignedTo].totalCost = Utils.dec.add(techStats[w.assignedTo].totalCost, w.totalCost || 0);
        } else if (w.status === 'en_proceso' || w.status === 'esperando_repuestos') {
          techStats[w.assignedTo].inProcess++;
        } else if (w.status === 'cancelada') {
          techStats[w.assignedTo].cancelled++;
        }
      }
      // 2. Contabilizar horas y costo desde laborEntries (multi-mecánico) o fallback a principal
      if (w.laborEntries && w.laborEntries.length > 0) {
        w.laborEntries.forEach(function (entry) {
          if (techStats[entry.employeeId]) {
            techStats[entry.employeeId].totalHours = Utils.dec.add(techStats[entry.employeeId].totalHours, entry.hours || 0);
            techStats[entry.employeeId].laborCost = Utils.dec.add(techStats[entry.employeeId].laborCost, entry.cost || 0);
          }
        });
      } else if (techStats[w.assignedTo] && w.status === 'completada') {
        // Fallback para OTs antiguas de cierre simple
        techStats[w.assignedTo].totalHours = Utils.dec.add(techStats[w.assignedTo].totalHours, w.laborHours || 0);
        techStats[w.assignedTo].laborCost = Utils.dec.add(techStats[w.assignedTo].laborCost, w.laborCost || 0);
      }
    });

    var html = '<div class="card" style="padding:0;">' +
      '<div class="card-header" style="padding:16px 20px;"><h3>👨‍🔧 Rendimiento por Técnico</h3><button class="btn btn-secondary btn-sm" id="rpt-exp-tech">📤 Excel</button></div>' +
      '<div class="table-wrapper"><table><thead><tr>' +
      '<th>Técnico</th><th>Cargo</th><th>Sueldo</th><th>Tarifa/Hr</th><th>OTs ✅</th><th>OTs ⚙️</th><th>Total OTs</th><th>Horas Registradas</th><th>Costo M.O.</th><th>Costo Total Gestionado</th>' +
      '</tr></thead><tbody>';

    if (!employees.length) {
      html += '<tr><td colspan="10" style="text-align:center;padding:24px;color:var(--text-muted);">No hay empleados marcados como técnicos registrados.</td></tr>';
    } else {
      var filteredStats = Object.values(techStats);
      // 🛡️ Filtro de Claridad: Si se filtra por vehículo, ocultar técnicos sin actividad en ese vehículo
      if (filterVehicle) {
        filteredStats = filteredStats.filter(function(t) { return t.totalHours > 0 || t.wos.length > 0; });
      }

      if (!filteredStats.length) {
        html += '<tr><td colspan="10" style="text-align:center;padding:32px;color:var(--text-muted);">Ningún técnico ha realizado trabajos en este vehículo en el período seleccionado.</td></tr>';
      } else {
        filteredStats.forEach(function (t) {
          html += '<tr>' +
            '<td><div class="flex items-center gap-2"><div class="user-avatar" style="width:30px;height:30px;font-size:0.75rem;">' + Utils.escapeHtml(t.name.substring(0, 2).toUpperCase()) + '</div><strong>' + Utils.escapeHtml(t.name) + '</strong></div></td>' +
            '<td class="text-sm text-muted">' + Utils.escapeHtml(t.position) + '</td>' +
            '<td class="text-sm">$ ' + Utils.fmtNum(t.salary) + '</td>' +
            '<td class="text-sm">$ ' + Utils.fmtNum(t.rate) + '/hr</td>' +
            '<td><span class="badge badge-green">✅ ' + t.completed + '</span></td>' +
            '<td><span class="badge badge-amber">⚙️ ' + t.inProcess + '</span></td>' +
            '<td><strong>' + t.wos.length + '</strong></td>' +
            '<td style="font-weight:700;color:var(--accent-primary);">' + t.totalHours.toFixed(1) + ' hrs</td>' +
            '<td>$ ' + Utils.fmtNum(t.laborCost) + '</td>' +
            '<td style="font-weight:700;color:var(--color-success);">$ ' + Utils.fmtNum(t.totalCost) + '</td></tr>';
        });
      }
      var unassigned = wos.filter(function (w) { return !w.assignedTo || !techStats[w.assignedTo]; });
      if (unassigned.length) {
        var unCost = unassigned.filter(function (w) { return w.status === 'completada'; }).reduce(function (a, w) { return Utils.dec.add(a, w.totalCost || 0); }, 0);
        html += '<tr style="opacity:0.6;"><td><span class="text-muted">Sin asignar</span></td><td>—</td><td>—</td><td>—</td>' +
          '<td>' + unassigned.filter(function (w) { return w.status === 'completada'; }).length + '</td>' +
          '<td>' + unassigned.filter(function (w) { return w.status === 'en_proceso'; }).length + '</td>' +
          '<td>' + unassigned.length + '</td><td>—</td><td>—</td><td>$ ' + Utils.fmtNum(unCost) + '</td></tr>';
      }
    }
    html += '</tbody></table></div></div>';
    return html;
  }

  // ═══════════════════════════════════════════════════════════
  //  TAB: DISPONIBILIDAD (DOWNTIME / MTTR)
  // ═══════════════════════════════════════════════════════════
  function renderAvailability(wos) {
    var vehicles = DB.getAll('vehicles').filter(function (v) { return v.active; });
    if (filterVehicle) vehicles = vehicles.filter(function (v) { return v.id === filterVehicle; });

    // Aritmética de Período
    var d1 = new Date(dateFrom + 'T00:00:00');
    var d2 = new Date(dateTo + 'T23:59:59');
    var diffDays = Math.max(1, Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24)));
    var totalPeriodHours = diffDays * 24;

    var stats = vehicles.map(function (v) {
      var vWOs = wos.filter(function (w) { return w.vehicleId === v.id; });
      var downtimeHours = 0;
      
      vWOs.forEach(function (w) {
        if (w.laborEntries && w.laborEntries.length > 0) {
          downtimeHours += w.laborEntries.reduce(function (acc, e) { return acc + (e.hours || 0); }, 0);
        } else {
          downtimeHours += (w.laborHours || 0);
        }
      });

      var availableHours = Math.max(0, totalPeriodHours - downtimeHours);
      var availPct = (availableHours / totalPeriodHours) * 100;
      
      var color = availPct > 90 ? 'green' : (availPct >= 80 ? 'amber' : 'red');
      var statusLabel = availPct > 90 ? 'Excelente' : (availPct >= 80 ? 'Regular' : 'Crítico');

      return {
        id: v.id, plate: v.plate, name: v.brand + ' ' + v.model,
        downtime: downtimeHours, available: availableHours, pct: availPct,
        color: color, label: statusLabel, count: vWOs.length
      };
    });

    stats.sort(function (a, b) { return a.pct - b.pct; });

    // KPIs Globales
    var avgAvail = stats.length ? stats.reduce(function (a, b) { return a + b.pct; }, 0) / stats.length : 0;
    var totalDowntime = stats.reduce(function (a, b) { return a + b.downtime; }, 0);

    var html = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:24px;">' +
      kpiCard('⏱️', 'Disponibilidad Promedio', avgAvail.toFixed(1) + '%', avgAvail > 90 ? 'green' : (avgAvail >= 80 ? 'amber' : 'red')) +
      kpiCard('🛠️', 'Downtime Total (Mantenimiento)', Utils.fmtNum(totalDowntime) + ' hrs', 'blue') +
      kpiCard('📅', 'Días en el Período', diffDays + ' días', 'cyan') +
      kpiCard('🚗', 'Vehículos Analizados', stats.length, 'blue') +
      '</div>';

    html += '<div class="card" style="padding:0;">' +
      '<div class="card-header" style="padding:16px 20px;">' +
      '<h3>📊 Disponibilidad Operativa vs Tiempo en Taller</h3>' +
      '<button class="btn btn-secondary btn-sm" id="rpt-exp-avail">📤 Exportar Disponibilidad</button>' +
      '</div>' +
      '<div class="table-wrapper"><table><thead><tr>' +
      '<th>Vehículo / Placa</th><th>Mantenimientos</th><th>Horas Inactivas (Downtime)</th><th>Horas Disponibles</th><th>% Disponibilidad</th><th>Estado</th>' +
      '</tr></thead><tbody>' +
      stats.map(function (s) {
        var badgeCls = s.color === 'green' ? 'badge-green' : (s.color === 'amber' ? 'badge-amber' : 'badge-red');
        return '<tr onclick="ReportsModule.showVehicleMonthlyDetail(\'' + s.id + '\')" style="cursor:pointer;" title="Click para ver detalle mensual">' +
          '<td><strong style="color:var(--accent-cyan);">' + Utils.escapeHtml(s.plate) + '</strong><div class="text-xs text-muted">' + Utils.escapeHtml(s.name) + '</div></td>' +
          '<td>' + s.count + ' OT(s)</td>' +
          '<td style="font-weight:700;color:var(--color-danger);">' + Utils.fmtNum(s.downtime) + ' hrs</td>' +
          '<td>' + Utils.fmtNum(s.available) + ' hrs</td>' +
          '<td><div style="display:flex;align-items:center;gap:10px;">' +
          '<div style="flex:1;height:10px;background:var(--bg-elevated);border-radius:5px;overflow:hidden;"><div style="width:' + s.pct + '%;height:100%;background:var(--color-' + s.color + ');"></div></div>' +
          '<span style="font-weight:800;min-width:45px;">' + s.pct.toFixed(1) + '%</span></div></td>' +
          '<td><span class="badge ' + badgeCls + '">' + s.label + '</span></td>' +
          '</tr>';
      }).join('') +
      '</tbody></table></div></div>';

    return html;
  }

  function exportAvailability(wos) {
    var vehicles = DB.getAll('vehicles').filter(function (v) { return v.active; });
    if (filterVehicle) vehicles = vehicles.filter(function (v) { return v.id === filterVehicle; });

    var d1 = new Date(dateFrom + 'T00:00:00');
    var d2 = new Date(dateTo + 'T23:59:59');
    var diffDays = Math.max(1, Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24)));
    var totalPeriodHours = diffDays * 24;

    var finalRows = [];
    // Fila de Encabezado de Auditoría
    finalRows.push(['PERIODO DE ANALISIS:', dateFrom + ' al ' + dateTo, '', '', '', '', '', '']);
    finalRows.push(['', '', '', '', '', '', '', '']); // Separador

    vehicles.forEach(function (v) {
      var vWOs = wos.filter(function (w) { return w.vehicleId === v.id; });
      var downtimeHours = 0;
      vWOs.forEach(function (w) {
        downtimeHours += (w.laborEntries ? w.laborEntries.reduce(function (a, e) { return a + (e.hours || 0); }, 0) : (w.laborHours || 0));
      });
      
      var availableHours = Math.max(0, totalPeriodHours - downtimeHours);
      var availPct = (availableHours / totalPeriodHours) * 100;
      var mttr = vWOs.length > 0 ? (downtimeHours / vWOs.length) : 0;
      var status = availPct > 90 ? 'Excelente' : (availPct >= 80 ? 'Regular' : 'Critico');

      // Fila RESUMEN de Vehículo
      finalRows.push([
        v.plate, 
        v.brand + ' ' + v.model + ' (RESUMEN TOTAL)', 
        vWOs.length, 
        parseFloat(downtimeHours.toFixed(1)), 
        parseFloat(availableHours.toFixed(1)), 
        parseFloat(mttr.toFixed(1)), 
        parseFloat(availPct.toFixed(2)), 
        status
      ]);

      // Filas de DESGLOSE MENSUAL
      var monthly = getMonthlyBreakdown(v.id, dateFrom, dateTo).reverse(); // Organizar de antiguo a nuevo para el Excel
      monthly.forEach(function(m) {
        finalRows.push([
          '', 
          '└─ ' + m.label, 
          m.ots, 
          m.downtime, 
          m.available, 
          parseFloat(m.mttr.toFixed(1)), 
          parseFloat(m.pct.toFixed(2)), 
          m.pct > 90 ? 'E' : (m.pct >= 80 ? 'R' : 'C')
        ]);
      });

      finalRows.push(['', '', '', '', '', '', '', '']); // Separador entre vehículos
    });

    var fileName = 'reporte_disponibilidad_DEL_' + dateFrom + '_AL_' + dateTo + '.xlsx';
    var headers = ['Móvil / Placa', 'Vehículo / Mes de Análisis', 'Cant. OTs', 'Inactividad (Hrs)', 'Disponible (Hrs)', 'MTTR (Hrs/OT)', '% Disponibilidad', 'Salud'];
    
    Utils.exportExcel(fileName, 'Disponibilidad Operativa TCI', headers, finalRows);
    Utils.toast('✅ Power Report generado: ' + fileName, 'success');
  }

  // ── Detalle Mensual de Disponibilidad (Time-Series) ────────
  function getMonthlyBreakdown(vehicleId, from, to) {
    var vehicle = DB.getById('vehicles', vehicleId);
    if (!vehicle) return [];

    var start = new Date(from + 'T00:00:00');
    var end = new Date(to + 'T23:59:59');
    var months = [];
    var current = new Date(start.getFullYear(), start.getMonth(), 1);

    while (current <= end) {
      var mStart = new Date(current.getFullYear(), current.getMonth(), 1);
      var mEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0, 23, 59, 59);

      // Ajustar a los límites del filtro global
      var effectiveStart = mStart < start ? start : mStart;
      var effectiveEnd = mEnd > end ? end : mEnd;

      if (effectiveStart <= effectiveEnd) {
        var diffHrs = Math.ceil((effectiveEnd - effectiveStart) / (1000 * 60 * 60));
        var monthKey = current.toLocaleString('es-CO', { month: 'long', year: 'numeric' });
        
        // Filtrar OTs de este vehículo en este mes específico
        var isoStart = Utils.toLocalISO(effectiveStart);
        var isoEnd = Utils.toLocalISO(effectiveEnd);
        var monthWOs = DB.getAll('workOrders').filter(function(w) {
          return w.vehicleId === vehicleId && w.status === 'completada' && w.date >= isoStart && w.date <= isoEnd;
        });

        var downtime = monthWOs.reduce(function(acc, w) {
          return acc + (w.laborEntries ? w.laborEntries.reduce(function(a, e){ return a + (e.hours || 0); }, 0) : (w.laborHours || 0));
        }, 0);

        var avail = Math.max(0, diffHrs - downtime);
        var pct = (avail / diffHrs) * 100;
        var mttr = monthWOs.length > 0 ? (downtime / monthWOs.length) : 0;

        months.push({
          label: monthKey.charAt(0).toUpperCase() + monthKey.slice(1),
          totalHours: diffHrs,
          downtime: downtime,
          available: avail,
          pct: pct,
          ots: monthWOs.length,
          mttr: mttr
        });
      }
      current.setMonth(current.getMonth() + 1);
    }
    return months.reverse(); // De más reciente a más antiguo
  }

  function showVehicleMonthlyDetail(vehicleId) {
    var vehicle = DB.getById('vehicles', vehicleId);
    if (!vehicle) return;

    var history = getMonthlyBreakdown(vehicleId, dateFrom, dateTo);
    var old = document.getElementById('rpt-avail-modal'); if (old) old.remove();

    var html = '<div class="modal-overlay" id="rpt-avail-modal"><div class="modal modal-lg">' +
      '<div class="modal-header">' +
      '<div><h3>📈 Historial de Disponibilidad: ' + Utils.escapeHtml(vehicle.plate) + '</h3>' +
      '<div class="text-xs text-muted">' + Utils.escapeHtml(vehicle.brand + ' ' + vehicle.model) + '</div></div>' +
      '<button class="modal-close" onclick="document.getElementById(\'rpt-avail-modal\').remove()">✕</button>' +
      '</div>' +
      '<div class="modal-body">' +
      '<div class="alert-banner info" style="margin-bottom:16px;">Analizando rendimiento desde ' + Utils.formatDate(dateFrom) + ' hasta ' + Utils.formatDate(dateTo) + '.</div>' +
      '<div class="table-wrapper"><table><thead><tr>' +
      '<th>Mes / Período</th><th>OTs</th><th>Downtime (Hrs)</th><th>MTTR (Promedio)</th><th>Disponibilidad</th>' +
      '</tr></thead><tbody>' +
      history.map(function(m) {
        var color = m.pct > 90 ? 'var(--color-success)' : (m.pct >= 80 ? 'var(--color-warning)' : 'var(--color-danger)');
        return '<tr>' +
          '<td><strong>' + m.label + '</strong></td>' +
          '<td>' + m.ots + '</td>' +
          '<td style="font-weight:600;color:var(--color-danger);">' + Utils.fmtNum(m.downtime) + ' hrs</td>' +
          '<td class="text-sm">' + m.mttr.toFixed(1) + ' hrs/reparación</td>' +
          '<td><div style="display:flex;align-items:center;gap:10px;">' +
          '<div style="flex:1;height:8px;background:var(--bg-elevated);border-radius:4px;overflow:hidden;"><div style="width:' + m.pct + '%;height:100%;background:' + color + ';"></div></div>' +
          '<span style="font-weight:800;color:' + color + ';">' + m.pct.toFixed(1) + '%</span></div></td>' +
          '</tr>';
      }).join('') +
      '</tbody></table></div>' +
      '</div>' +
      '<div class="modal-footer"><button class="btn btn-secondary" onclick="document.getElementById(\'rpt-avail-modal\').remove()">Cerrar Detalle</button></div>' +
      '</div></div>';

    document.body.insertAdjacentHTML('beforeend', html);
  }

  // ═══════════════════════════════════════════════════════════
  //  TAB: CONSUMO
  // ═══════════════════════════════════════════════════════════
  function renderConsumption(movs) {
    var salidas = movs.filter(function (m) { return m.type === 'salida'; });
    var totals = {};
    salidas.forEach(function (m) {
      if (!totals[m.itemId]) totals[m.itemId] = { name: m.itemName, qty: 0, totalCost: 0 };
      totals[m.itemId].qty += m.qty;
      totals[m.itemId].totalCost = Utils.dec.add(totals[m.itemId].totalCost, m.totalCost || 0);
    });
    var sorted = Object.values(totals).sort(function (a, b) { return b.qty - a.qty; }).slice(0, 10);

    var totalQty = Object.values(totals).reduce(function (a, t) { return a + t.qty; }, 0);
    var totalCost = Object.values(totals).reduce(function (a, t) { return Utils.dec.add(a, t.totalCost); }, 0);

    var html = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-bottom:24px;">' +
      kpiCard('📦', 'Artículos Distintos', Object.keys(totals).length, 'cyan') +
      kpiCard('⬇️', 'Unidades Consumidas', Utils.fmtNum(totalQty), 'amber') +
      kpiCard('💸', 'Costo Total Consumido', '$ ' + Utils.fmtNum(totalCost), 'red') +
      '</div>';

    html += '<div class="card" style="padding:0;">' +
      '<div class="card-header" style="padding:16px 20px;"><h3>📦 Top 10 Repuestos más Consumidos</h3><button class="btn btn-secondary btn-sm" id="rpt-exp-cons">📤 Excel</button></div>';

    if (!sorted.length) {
      html += '<div class="empty-state" style="padding:32px;"><div class="empty-state-icon">📦</div><p>Sin salidas de inventario en el período seleccionado.</p></div>';
    } else {
      var maxQty = sorted[0].qty || 1;
      html += '<div class="table-wrapper"><table><thead><tr><th>#</th><th>Artículo</th><th>Unidades</th><th>Costo Total</th><th>Rotación</th></tr></thead><tbody>';
      sorted.forEach(function (item, idx) {
        var pct = Math.round(item.qty / maxQty * 100);
        html += '<tr>' +
          '<td style="font-weight:700;color:var(--text-muted);">' + (idx + 1) + '</td>' +
          '<td><strong>' + Utils.escapeHtml(item.name) + '</strong></td>' +
          '<td><strong>' + Utils.fmtNum(item.qty) + '</strong></td>' +
          '<td style="color:var(--color-success);font-weight:600;">$ ' + Utils.fmtNum(item.totalCost) + '</td>' +
          '<td style="min-width:120px;"><div style="display:flex;align-items:center;gap:8px;">' +
          '<div style="flex:1;height:8px;background:var(--bg-elevated);border-radius:4px;overflow:hidden;"><div style="width:' + pct + '%;height:100%;background:var(--accent-primary);border-radius:4px;"></div></div>' +
          '<span class="text-xs text-muted">' + pct + '%</span></div></td></tr>';
      });
      html += '</tbody></table></div>';
    }
    html += '</div>';
    return html;
  }

  // ═══════════════════════════════════════════════════════════
  //  TAB: ALERTAS PREVENTIVAS
  // ═══════════════════════════════════════════════════════════
  function renderPreventivos() {
    var routines = DB.getAll('preventiveRoutines').filter(function (r) { return r.active; });
    var vehicles = DB.getAll('vehicles').filter(function (v) { return v.active; });
    var allDocs = DB.getAll('vehicleDocuments');
    var today = Utils.todayISO();
    var vMap = {}; vehicles.forEach(function (v) { vMap[v.id] = v; });

    // ── Calcular estado de cada rutina ────────────────────
    var alerts = routines.map(function (r) {
      var v = vMap[r.vehicleId];
      if (!v) return null;
      var hoursDiff = (r.lastPerformedHours + r.frequencyHours) - (v.hours || 0);
      var baseDate = new Date(r.lastPerformedDate + 'T00:00:00');
      baseDate.setDate(baseDate.getDate() + (r.frequencyDays || 0));
      var nextDate = Utils.toLocalISO(baseDate);
      
      var nextDateObj = new Date(nextDate + 'T00:00:00');
      var todayObj = new Date(); todayObj.setHours(0,0,0,0);
      var daysDiff = Math.ceil((nextDateObj - todayObj) / 864e5);
      var isDue = (hoursDiff <= 0 || daysDiff <= 0);
      var isWarning = !isDue && (hoursDiff <= 1500 || daysDiff <= 15);
      var statusText = isDue
        ? (hoursDiff <= 0 ? 'Vencido por horas (' + Math.abs(hoursDiff) + ' hrs)' : 'Vencido por fecha (hace ' + Math.abs(daysDiff) + ' días)')
        : (isWarning
          ? (hoursDiff <= 1500 ? 'Próximo: faltan ' + hoursDiff + ' hrs' : 'Próximo: faltan ' + daysDiff + ' días')
          : 'Al día');
      return { vehicle: v, routine: r, isDue: isDue, isWarning: isWarning, statusText: statusText, hoursDiff: hoursDiff, daysDiff: daysDiff, nextDate: nextDate };
    }).filter(Boolean);

    alerts.sort(function (a, b) {
      if (a.isDue && !b.isDue) return -1; if (!a.isDue && b.isDue) return 1;
      if (a.isWarning && !b.isWarning) return -1; if (!a.isWarning && b.isWarning) return 1;
      return a.hoursDiff - b.hoursDiff;
    });

    var numDue = alerts.filter(function (a) { return a.isDue; }).length;
    var numWarn = alerts.filter(function (a) { return a.isWarning; }).length;
    var numOk = alerts.length - numDue - numWarn;

    // ── Documentos ────────────────────────────────────────
    var docAlerts = [];
    vehicles.forEach(function (v) {
      allDocs.filter(function (d) { return d.vehicleId === v.id; }).forEach(function (d) {
        var daysLeft = Math.floor((new Date(d.expiry) - new Date(today)) / 864e5);
        if (daysLeft <= 60) docAlerts.push({ vehicle: v, doc: d, daysLeft: daysLeft });
      });
    });
    docAlerts.sort(function (a, b) { return a.daysLeft - b.daysLeft; });
    var numDocsExpired = docAlerts.filter(function (a) { return a.daysLeft < 0; }).length;
    var numDocsWarn = docAlerts.filter(function (a) { return a.daysLeft >= 0; }).length;

    // ── Render ────────────────────────────────────────────
    var html = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin-bottom:24px;">' +
      kpiCard('🚨', 'Mttos. Vencidos', numDue, numDue > 0 ? 'red' : 'green') +
      kpiCard('⚠️', 'Próximos a Vencer', numWarn, numWarn > 0 ? 'amber' : 'green') +
      kpiCard('✅', 'Rutinas al Día', numOk, 'green') +
      kpiCard('🪪', 'Docs. Vencidos', numDocsExpired, numDocsExpired > 0 ? 'red' : 'green') +
      kpiCard('📅', 'Docs. Por Vencer', numDocsWarn, numDocsWarn > 0 ? 'amber' : 'green') +
      '</div>';

    // Tabla de rutinas de mantenimiento
    html += '<div class="card" style="padding:0;margin-bottom:20px;">' +
      '<div class="card-header" style="padding:16px 20px;">' +
      '<h3>⚙️ Estado de Rutinas de Mantenimiento</h3>' +
      '<button class="btn btn-secondary btn-sm" id="rpt-exp-prev">📤 Exportar Excel</button>' +
      '</div>';

    if (!alerts.length) {
      html += '<div class="empty-state" style="padding:32px;"><div class="empty-state-icon">📅</div><p>No hay rutinas de mantenimiento configuradas.</p></div>';
    } else {
      html += '<div class="table-wrapper"><table><thead><tr>' +
        '<th>Vehículo</th><th>Rutina</th><th>Frecuencia</th><th>Último Mtto.</th>' +
        '<th>Próxima Fecha</th><th>Horas Faltantes</th><th>Estado</th>' +
        '</tr></thead><tbody>' +
        alerts.map(function (a) {
          var badge = a.isDue
            ? '<span class="badge badge-red">🔴 Vencido</span>'
            : (a.isWarning ? '<span class="badge badge-amber">🟡 Próximo</span>' : '<span class="badge badge-green">🟢 Al día</span>');
          var rowBg = a.isDue ? 'background:rgba(239,68,68,0.05);' : (a.isWarning ? 'background:rgba(245,158,11,0.05);' : '');
          return '<tr style="' + rowBg + '">' +
            '<td><strong style="color:var(--accent-cyan);">' + Utils.escapeHtml(a.vehicle.plate) + '</strong>' +
            '<div class="text-xs text-muted">' + Utils.escapeHtml(a.vehicle.brand + ' ' + a.vehicle.model) + '</div></td>' +
            '<td><strong>' + Utils.escapeHtml(a.routine.name) + '</strong></td>' +
            '<td class="text-sm">Cada ' + Utils.fmtNum(a.routine.frequencyHours) + ' hrs<br>o ' + a.routine.frequencyDays + ' días</td>' +
            '<td class="text-sm">' + Utils.fmtNum(a.routine.lastPerformedHours) + ' hrs<br>' + Utils.formatDate(a.routine.lastPerformedDate) + '</td>' +
            '<td class="text-sm">' + Utils.formatDate(a.nextDate) + '</td>' +
            '<td style="font-weight:700;color:' + (a.hoursDiff <= 0 ? 'var(--color-danger)' : (a.hoursDiff <= 1500 ? 'var(--color-warning)' : 'var(--color-success)')) + ';">' +
            (a.hoursDiff <= 0 ? '— ' + Math.abs(a.hoursDiff) + ' hrs' : '+' + Utils.fmtNum(a.hoursDiff) + ' hrs') + '</td>' +
            '<td>' + badge + '<div class="text-xs text-muted" style="margin-top:4px;">' + Utils.escapeHtml(a.statusText) + '</div></td>' +
            '</tr>';
        }).join('') +
        '</tbody></table></div>';
    }
    html += '</div>';

    // Tabla de documentos
    html += '<div class="card" style="padding:0;">' +
      '<div class="card-header" style="padding:16px 20px;">' +
      '<h3>🪪 Documentos Legales — Próximos a Vencer o Vencidos (≤ 60 días)</h3>' +
      '</div>';

    if (!docAlerts.length) {
      html += '<div class="empty-state" style="padding:32px;"><div class="empty-state-icon">✅</div><p>Todos los documentos de la flota están al día.</p></div>';
    } else {
      var DOC_NAMES = { soat: 'SOAT', tecnomecanica: 'Tecno-mecánica', poliza: 'Póliza Todo Riesgo', tarjeta_propiedad: 'Tarjeta de Propiedad', impuesto: 'Impuesto Rodamiento', otro: 'Otro' };
      html += '<div class="table-wrapper"><table><thead><tr>' +
        '<th>Vehículo</th><th>Documento</th><th>Vencimiento</th><th>Días Restantes</th><th>Estado</th>' +
        '</tr></thead><tbody>' +
        docAlerts.map(function (a) {
          var badge = a.daysLeft < 0
            ? '<span class="badge badge-red">🔴 Vencido hace ' + Math.abs(a.daysLeft) + ' días</span>'
            : '<span class="badge badge-amber">🟡 Vence en ' + a.daysLeft + ' días</span>';
          var rowBg = a.daysLeft < 0 ? 'background:rgba(239,68,68,0.05);' : 'background:rgba(245,158,11,0.05);';
          return '<tr style="' + rowBg + '">' +
            '<td><strong style="color:var(--accent-cyan);">' + Utils.escapeHtml(a.vehicle.plate) + '</strong>' +
            '<div class="text-xs text-muted">' + Utils.escapeHtml(a.vehicle.brand + ' ' + a.vehicle.model) + '</div></td>' +
            '<td><strong>' + Utils.escapeHtml(DOC_NAMES[a.doc.type] || a.doc.type) + '</strong></td>' +
            '<td>' + Utils.formatDate(a.doc.expiry) + '</td>' +
            '<td style="font-weight:800;color:' + (a.daysLeft < 0 ? 'var(--color-danger)' : 'var(--color-warning)') + ';">' + a.daysLeft + '</td>' +
            '<td>' + badge + '</td></tr>';
        }).join('') +
        '</tbody></table></div>';
    }
    html += '</div>';

    return html;
  }

  // ═══════════════════════════════════════════════════════════
  //  TAB: HORÓMETRO DIARIO
  // ═══════════════════════════════════════════════════════════
  function renderKmDiario() {
    var allLogs = DB.getAll('hoursLogs');
    var vehicles = DB.getAll('vehicles').filter(function (v) { return v.active; });
    var today = Utils.todayISO();
    var from = dateFrom;
    var to = dateTo;

    // Filtrar por vehículo si aplica
    var filteredLogs = allLogs.filter(function (l) { return l.date >= from && l.date <= to; });
    if (filterVehicle) filteredLogs = filteredLogs.filter(function (l) { return l.vehicleId === filterVehicle; });
    var filteredVehs = filterVehicle ? vehicles.filter(function (v) { return v.id === filterVehicle; }) : vehicles;

    // KPIs del período
    var totalHoursWorked = filteredLogs.reduce(function (a, l) { return a + (l.workedHours || 0); }, 0);
    var diasConRegistro = filteredLogs.map(function (l) { return l.date; })
      .filter(function (v, i, a) { return (v && a.indexOf(v) === i); }).length;
    var vehiclesRegistered = filteredLogs.map(function (l) { return l.vehicleId; })
      .filter(function (v, i, a) { return (v && a.indexOf(v) === i); }).length;
    var todayLogs = allLogs.filter(function (l) { return l.date === today; });
    var missingToday = vehicles.length - todayLogs.length;

    var html = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;margin-bottom:24px;">' +
      kpiCard('📍', 'Horas Totales del Período', Utils.fmtNum(totalHoursWorked) + ' hrs', 'blue') +
      kpiCard('📅', 'Días con Registros', diasConRegistro, 'cyan') +
      kpiCard('🚗', 'Vehículos Cubiertos', vehiclesRegistered, 'green') +
      kpiCard('⚠️', 'Sin Horas Hoy', missingToday, missingToday > 0 ? 'amber' : 'green') +
      '</div>';

    // Resumen por vehículo en el período
    html += '<div class="card" style="padding:0;margin-bottom:20px;">' +
      '<div class="card-header" style="padding:16px 20px;">' +
      '<h3>📊 Resumen por Vehículo (' + Utils.formatDate(from) + ' — ' + Utils.formatDate(to) + ')</h3>' +
      '<button class="btn btn-secondary btn-sm" id="rpt-exp-hrs">📤 Exportar Excel</button>' +
      '</div>' +
      '<div class="table-wrapper"><table><thead><tr>' +
      '<th>Vehículo</th><th>Horas Trabajadas (período)</th><th>Registros</th>' +
      '<th>Horas Promedio/Día</th><th>Horómetro Total</th><th>Última lectura</th><th>Estado Hoy</th>' +
      '</tr></thead><tbody>';

    filteredVehs.forEach(function (v) {
      var vLogs = filteredLogs.filter(function (l) { return l.vehicleId === v.id; });
      var totalHrs = vLogs.reduce(function (a, l) { return a + (l.workedHours || 0); }, 0);
      var avgHrs = vLogs.length > 0 ? Math.round(totalHrs / vLogs.length) : 0;
      var lastLog = allLogs.filter(function (l) { return l.vehicleId === v.id; }).sort(function (a, b) { return b.date < a.date ? -1 : 1; })[0];
      var hasToday = allLogs.some(function (l) { return l.vehicleId === v.id && l.date === today; });
      var todayBadge = hasToday
        ? '<span class="badge badge-green">✅ Registrado</span>'
        : '<span class="badge badge-amber">⏳ Pendiente</span>';

      html += '<tr>' +
        '<td><strong style="color:var(--accent-cyan);">' + Utils.escapeHtml(v.plate) + '</strong>' +
        '<div class="text-xs text-muted">' + Utils.escapeHtml(v.brand + ' ' + v.model) + '</div></td>' +
        '<td style="font-weight:800;color:var(--accent-primary);">+' + Utils.fmtNum(totalHrs) + ' hrs</td>' +
        '<td>' + vLogs.length + ' día(s)</td>' +
        '<td>' + Utils.fmtNum(avgHrs) + ' hrs/día</td>' +
        '<td style="font-weight:600;">' + Utils.fmtNum(v.hours || 0) + ' hrs</td>' +
        '<td class="text-sm">' + (lastLog ? Utils.formatDate(lastLog.date) + '<br><span class="text-xs text-muted">' + Utils.fmtNum(lastLog.totalHours || 0) + ' h total</span>' : '—') + '</td>' +
        '<td>' + todayBadge + '</td></tr>';
    });

    html += '</tbody></table></div></div>';

    // Historial detallado de registros
    var sortedLogs = filteredLogs.slice().sort(function (a, b) { return b.date < a.date ? -1 : 1; });
    var vMap = {}; vehicles.forEach(function (v) { vMap[v.id] = v; });

    html += '<div class="card" style="padding:0;">' +
      '<div class="card-header" style="padding:16px 20px;">' +
      '<h3>📋 Historial Detallado de Horas</h3>' +
      '<span class="text-sm text-muted">' + sortedLogs.length + ' registros</span>' +
      '</div>';

    if (!sortedLogs.length) {
      html += '<div class="empty-state" style="padding:32px;"><div class="empty-state-icon">📍</div><p>No hay registros de horómetro en el período seleccionado.</p></div>';
    } else {
      html += '<div class="table-wrapper"><table><thead><tr>' +
        '<th>Fecha</th><th>Vehículo</th><th>Horas Recorridas</th><th>Horómetro Total</th><th>Notas</th>' +
        '</tr></thead><tbody>' +
        sortedLogs.slice(0, 100).map(function (l) {
          var v = vMap[l.vehicleId];
          return '<tr>' +
            '<td><strong>' + Utils.formatDate(l.date) + '</strong>' + (l.date === today ? ' <span class="badge badge-green" style="font-size:0.6rem;">HOY</span>' : '') + '</td>' +
            '<td>' + (v ? '<strong style="color:var(--accent-cyan);">' + Utils.escapeHtml(v.plate) + '</strong><div class="text-xs text-muted">' + Utils.escapeHtml(v.type || '') + '</div>' : '—') + '</td>' +
            '<td style="font-weight:800;color:var(--color-success);font-size:1.05rem;">+' + Utils.fmtNum(l.workedHours || 0) + ' hrs</td>' +
            '<td style="color:var(--text-muted);">' + Utils.fmtNum(l.totalHours || l.hours || 0) + ' hrs</td>' +
            '<td class="text-sm text-muted">' + Utils.escapeHtml(l.notes || '—') + '</td>' +
            '</tr>';
        }).join('') +
        (sortedLogs.length > 100 ? '<tr><td colspan="5" style="text-align:center;padding:12px;color:var(--text-muted);">... y ' + (sortedLogs.length - 100) + ' registros más (exporta para ver todos)</td></tr>' : '') +
        '</tbody></table></div>';
    }
    html += '</div>';

    return html;
  }

  // ═══════════════════════════════════════════════════════════
  //  HELPERS
  // ═══════════════════════════════════════════════════════════
  function kpiCard(icon, label, val, color) {
    return '<div class="kpi-card ' + color + '"><div class="kpi-icon ' + color + '">' + icon + '</div><div class="kpi-value">' + val + '</div><div class="kpi-label">' + label + '</div></div>';
  }

  function getWOsInRange(from, to) {
    var wos = DB.getAll('workOrders').filter(function (w) { return w.date >= from && w.date <= to; });
    if (filterVehicle) wos = wos.filter(function (w) { return w.vehicleId === filterVehicle; });
    return wos;
  }
  function getMaintenanceLogsInRange(from, to) {
    var logs = DB.getAll('maintenanceLogs').filter(function (l) { return l.date >= from && l.date <= to; });
    if (filterVehicle) logs = logs.filter(function (l) { return l.vehicleId === filterVehicle; });
    return logs;
  }
  function getMovsInRange(from, to) {
    var movs = DB.getAll('movements').filter(function (m) { return m.date >= from && m.date <= to; });
    if (filterVehicle) {
      // 1. Obtener OTs del vehículo seleccionado en el rango
      var vehicleWOs = DB.getAll('workOrders').filter(function(w) { 
        return w.vehicleId === filterVehicle; 
      });
      // 2. Extraer los números de OT (referencia en movimientos)
      var validRefs = vehicleWOs.map(function(w) { return w.number; });
      
      // 3. Filtrar movimientos que referencien esas OTs
      movs = movs.filter(function(m) { 
        return validRefs.indexOf(m.reference) !== -1; 
      });
    }
    return movs;
  }

  function renderCombinedRows(wos, logs) {
    var emps = DB.getAll('employees'); var eMap = {}; emps.forEach(function (e) { eMap[e.id] = e.name; });
    if (!wos.length && !logs.length) return '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--text-muted);">Sin intervenciones en este período</td></tr>';
    var data = wos.map(function (w) { return { type: 'OT', num: w.number, date: w.date, vehicle: w.vehiclePlate || '—', desc: w.description, tech: eMap[w.assignedTo] || '—', cost: w.totalCost || 0, status: w.status, note: '' }; });
    data = data.concat(logs.map(function (l) { return { type: 'Mtto. Exprés', num: l.routineName, date: l.date, vehicle: l.vehiclePlate || '—', desc: 'Registro Directo', tech: eMap[l.userId] || '—', cost: l.totalCost || 0, status: 'completada', note: l.notes }; }));
    data.sort(function (a, b) { return b.date.localeCompare(a.date); });
    return data.map(function (d) {
      return '<tr>' +
        '<td><span class="badge ' + (d.type === 'OT' ? 'badge-blue' : 'badge-cyan') + '">' + d.type + '</span></td>' +
        '<td style="color:var(--accent-cyan);font-weight:700;">' + Utils.escapeHtml(d.num) + '</td>' +
        '<td>' + Utils.formatDate(d.date) + '</td>' +
        '<td><strong>' + Utils.escapeHtml(d.vehicle) + '</strong></td>' +
        '<td class="truncate" style="max-width:160px;">' + Utils.escapeHtml(d.desc) + '</td>' +
        '<td class="text-sm">' + Utils.escapeHtml(d.tech) + '</td>' +
        '<td style="font-weight:700;color:var(--color-success);">$ ' + Utils.fmtNum(d.cost) + '</td>' +
        '<td>' + (d.type === 'OT' ? Utils.otStatusBadge(d.status) : '<span class="badge badge-green">✅ Completado</span>') + '</td></tr>';
    }).join('');
  }

  function renderMovRows(movs) {
    if (!movs.length) return '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-muted);">Sin movimientos en este período</td></tr>';
    var items = DB.getAll('items'); var iMap = {}; items.forEach(function (i) { iMap[i.id] = i; });
    var sorted = movs.slice().reverse();
    var html = sorted.map(function (m) {
      var item = iMap[m.itemId];
      var unitCost = m.unitCost || (item ? item.unitCost : 0) || 0;
      var totalCost = m.totalCost || (unitCost * m.qty) || 0;
      return '<tr>' +
        '<td>' + Utils.formatDate(m.date) + '</td>' +
        '<td>' + Utils.escapeHtml(m.itemName || (item ? item.name : '—')) + '</td>' +
        '<td>' + (m.type === 'entrada' ? '<span class="badge badge-green">⬆️ Entrada</span>' : '<span class="badge badge-red">⬇️ Salida</span>') + '</td>' +
        '<td><strong>' + Utils.fmtNum(m.qty) + '</strong></td>' +
        '<td class="text-sm">$ ' + Utils.fmtNum(unitCost) + '</td>' +
        '<td style="font-weight:600;color:var(--color-success);">$ ' + Utils.fmtNum(totalCost) + '</td>' +
        '<td class="text-sm text-muted">' + Utils.escapeHtml(m.reference || '—') + '</td></tr>';
    }).join('');
    if (sorted.length > 100) html += '<tr><td colspan="7" style="text-align:center;padding:10px;color:var(--text-muted);">Mostrando todos los ' + sorted.length + ' registros</td></tr>';
    return html;
  }

  function renderVehicleConsolidatedRows(wos, logs, fuelLogs, docCosts) {
    var vehicles = DB.getAll('vehicles');
    var stats = {};
    vehicles.forEach(function (v) { stats[v.id] = { plate: v.plate, name: v.brand + ' ' + v.model, mat: 0, labor: 0, ext: 0, fuel: 0, docs: 0, total: 0 }; });

    wos.forEach(function (w) {
      if (stats[w.vehicleId]) {
        var mat = w.materialBase !== undefined ? w.materialBase : (w.materials || []).reduce(function (acc, m) { return acc + (m.totalCost || 0); }, 0);
        stats[w.vehicleId].mat = Utils.dec.add(stats[w.vehicleId].mat, mat);
        stats[w.vehicleId].labor = Utils.dec.add(stats[w.vehicleId].labor, w.laborCost || 0);
        stats[w.vehicleId].ext = Utils.dec.add(stats[w.vehicleId].ext, w.externalCost || 0);
        stats[w.vehicleId].total = Utils.dec.add(stats[w.vehicleId].total, w.totalCost || 0);
      }
    });
    logs.forEach(function (l) {
      if (stats[l.vehicleId]) {
        stats[l.vehicleId].mat = Utils.dec.add(stats[l.vehicleId].mat, l.matCost || 0);
        stats[l.vehicleId].labor = Utils.dec.add(stats[l.vehicleId].labor, l.laborCost || 0);
        stats[l.vehicleId].ext = Utils.dec.add(stats[l.vehicleId].ext, l.otherCost || 0);
        stats[l.vehicleId].total = Utils.dec.add(stats[l.vehicleId].total, l.totalCost || 0);
      }
    });
    (fuelLogs || []).forEach(function (l) {
      if (stats[l.vehicleId]) {
        stats[l.vehicleId].fuel = Utils.dec.add(stats[l.vehicleId].fuel, l.cost || 0);
        stats[l.vehicleId].total = Utils.dec.add(stats[l.vehicleId].total, l.cost || 0);
      }
    });
    (docCosts || []).forEach(function (d) {
      if (stats[d.vehicleId]) {
        stats[d.vehicleId].docs = Utils.dec.add(stats[d.vehicleId].docs, d.cost || 0);
        stats[d.vehicleId].total = Utils.dec.add(stats[d.vehicleId].total, d.cost || 0);
      }
    });

    var sorted = Object.values(stats).filter(function (s) { return s.total > 0; }).sort(function (a, b) { return b.total - a.total; });
    if (!sorted.length) return '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-muted);">Sin gastos registrados para la flota en este período</td></tr>';

    return sorted.map(function (s) {
      return '<tr>' +
        '<td><strong style="color:var(--accent-cyan);">' + Utils.escapeHtml(s.plate) + '</strong><div class="text-xs text-muted">' + Utils.escapeHtml(s.name) + '</div></td>' +
        '<td>$ ' + Utils.fmtNum(s.mat) + '</td>' +
        '<td>$ ' + Utils.fmtNum(s.labor) + '</td>' +
        '<td>$ ' + Utils.fmtNum(s.ext) + '</td>' +
        '<td>$ ' + Utils.fmtNum(s.fuel) + '</td>' +
        '<td>$ ' + Utils.fmtNum(s.docs) + '</td>' +
        '<td><strong style="color:var(--color-success);font-size:1rem;">$ ' + Utils.fmtNum(s.total) + '</strong></td>' +
        '</tr>';
    }).join('');
  }

  // ── Charts ────────────────────────────────────────────────
  function renderStatusChart(wos) {
    var container = document.getElementById('chart-ot-status'); if (!container) return;
    var statusCount = {};
    wos.forEach(function (w) { statusCount[w.status] = (statusCount[w.status] || 0) + 1; });
    var labels = [], values = [];
    Object.keys(Utils.OT_STATUS).forEach(function (k) { if (statusCount[k]) { labels.push(Utils.OT_STATUS[k].label); values.push(statusCount[k]); } });
    if (!values.length) { container.innerHTML = '<p class="text-muted text-sm" style="padding:16px;text-align:center;">Sin datos</p>'; return; }
    container.innerHTML = '<canvas id="cnv-ot" style="width:100%;height:160px;"></canvas>';
    Utils.afterRender('cnv-ot', function () { Utils.drawBarChart('cnv-ot', labels, values); });
  }
  function renderMaterialChart(salidas) {
    var container = document.getElementById('chart-materials'); if (!container) return;
    var totals = {};
    salidas.forEach(function (m) { totals[m.itemId] = Utils.dec.add(totals[m.itemId] || 0, m.qty); });
    var sorted = Object.keys(totals).sort(function (a, b) { return totals[b] - totals[a]; }).slice(0, 6);
    if (!sorted.length) { container.innerHTML = '<p class="text-muted text-sm" style="padding:16px;text-align:center;">Sin consumo</p>'; return; }
    var items = DB.getAll('items'); var iMap = {}; items.forEach(function (i) { iMap[i.id] = i.name; });
    var labels = sorted.map(function (id) { var n = iMap[id] || id; return n.length > 10 ? n.substring(0, 10) + '…' : n; });
    var values = sorted.map(function (id) { return totals[id]; });
    container.innerHTML = '<canvas id="cnv-mat" style="width:100%;height:160px;"></canvas>';
    Utils.afterRender('cnv-mat', function () { Utils.drawBarChart('cnv-mat', labels, values, 'rgba(6,182,212,0.9)'); });
  }
  function renderVehicleCostsChart(completedWOs, logs) {
    var container = document.getElementById('chart-costs'); if (!container) return;
    var vehs = DB.getAll('vehicles'); var vMap = {}; vehs.forEach(function (v) { vMap[v.id] = v.plate; });
    var totals = {};
    completedWOs.forEach(function (w) { if (w.vehicleId && w.totalCost) { totals[w.vehicleId] = Utils.dec.add(totals[w.vehicleId] || 0, w.totalCost); } });
    (logs || []).forEach(function (l) { if (l.vehicleId && l.totalCost) { totals[l.vehicleId] = Utils.dec.add(totals[l.vehicleId] || 0, l.totalCost); } });
    var sorted = Object.keys(totals).sort(function (a, b) { return totals[b] - totals[a]; }).slice(0, 5);
    if (!sorted.length) { container.innerHTML = '<p class="text-muted text-sm" style="padding:16px;text-align:center;">Sin gastos por mostrar</p>'; return; }
    var labels = sorted.map(function (id) { return vMap[id] || 'Desc.'; });
    var values = sorted.map(function (id) { return totals[id]; });
    container.innerHTML = '<canvas id="cnv-costs" style="width:100%;height:160px;"></canvas>';
    Utils.afterRender('cnv-costs', function () { Utils.drawBarChart('cnv-costs', labels, values, 'rgba(239,68,68,0.9)'); });
  }

  // ═══════════════════════════════════════════════════════════
  //  EXPORTS
  // ═══════════════════════════════════════════════════════════
  function exportWO(wos, logs) {
    var emps = DB.getAll('employees'); var eMap = {}; emps.forEach(function (e) { eMap[e.id] = e.name; });
    var headers = ['Tipo', 'Número/Ref', 'Fecha', 'Vehículo', 'Descripción', 'Técnico', 'Horas Trab.', 'Costo Repuestos', 'Costo M.O.', 'Costo Ext.', 'Costo Total', 'Estado', 'Notas'];
    var rows = wos.map(function (w) {
      var mat = w.materialBase !== undefined ? w.materialBase : (w.materials || []).reduce(function (acc, m) { return acc + (m.totalCost || 0); }, 0);
      var equipoStr = (w.laborEntries || []).length
        ? w.laborEntries.map(function (e) { return e.name; }).join(', ')
        : (eMap[w.assignedTo] || '—');
      return ['OT', w.number, w.date, w.vehiclePlate || '—', w.description, equipoStr, w.laborHours || 0, mat, w.laborCost || 0, w.externalCost || 0, w.totalCost || 0, Utils.OT_STATUS[w.status] ? Utils.OT_STATUS[w.status].label : w.status, w.notes || ''];
    });
    logs.forEach(function (l) { rows.push(['Mtto. Exprés', l.routineName, l.date, l.vehiclePlate || '—', 'Registro Directo', eMap[l.userId] || '—', 0, l.matCost || 0, l.laborCost || 0, l.otherCost || 0, l.totalCost, 'Completada', l.notes || '']); });
    rows.sort(function (a, b) { return b[2].localeCompare(a[2]); });
    Utils.exportExcel('reporte_intervenciones_' + Utils.todayISO() + '.xlsx', 'Consolidado de Mantenimientos', headers, rows);
    Utils.toast('Reporte exportado.', 'success');
  }
  function exportMov(movs) {
    var items = DB.getAll('items'); var iMap = {}; items.forEach(function (i) { iMap[i.id] = i.name; });
    Utils.exportExcel('reporte_movimientos_' + Utils.todayISO() + '.xlsx', 'Movimientos de Almacén',
      ['Fecha', 'Artículo', 'Tipo', 'Cantidad', 'Referencia', 'Notas'],
      movs.map(function (m) { return [m.date, iMap[m.itemId] || '', m.type, m.qty, m.reference || '', m.notes || '']; }));
    Utils.toast('Movimientos exportados.', 'success');
  }
  function exportTechnicians(wos) {
    var employees = DB.getAll('employees').filter(function (e) { return e.active && e.isTechnician; });
    var positions = DB.getAll('positions');
    var settings = DB.getSettings();
    var baseHours = settings.monthlyWorkingHours || 220;
    var techStats = {};
    employees.forEach(function (e) {
      var pos = positions.find(function (p) { return p.id === e.positionId; });
      var salary = e.monthlySalary || 0;
      techStats[e.id] = { name: e.name, position: pos ? pos.name : '—', salary: salary, rate: Math.round(salary / baseHours), completed: 0, inProcess: 0, total: 0, hours: 0, laborCost: 0, cost: 0 };
    });
    wos.forEach(function (w) {
      // Responsable principal
      if (techStats[w.assignedTo]) {
        techStats[w.assignedTo].total++;
        if (w.status === 'completada') {
          techStats[w.assignedTo].completed++;
          techStats[w.assignedTo].cost = Utils.dec.add(techStats[w.assignedTo].cost, w.totalCost || 0);
        }
        if (w.status === 'en_proceso' || w.status === 'esperando_repuestos') techStats[w.assignedTo].inProcess++;
      }
      // Participación por laborEntries o fallback a principal
      if (w.laborEntries && w.laborEntries.length > 0) {
        w.laborEntries.forEach(function (entry) {
          if (techStats[entry.employeeId]) {
            techStats[entry.employeeId].hours = Utils.dec.add(techStats[entry.employeeId].hours, entry.hours || 0);
            techStats[entry.employeeId].laborCost = Utils.dec.add(techStats[entry.employeeId].laborCost, entry.cost || 0);
          }
        });
      } else if (techStats[w.assignedTo] && w.status === 'completada') {
        techStats[w.assignedTo].hours = Utils.dec.add(techStats[w.assignedTo].hours, w.laborHours || 0);
        techStats[w.assignedTo].laborCost = Utils.dec.add(techStats[w.assignedTo].laborCost, w.laborCost || 0);
      }
    });
    Utils.exportExcel('reporte_tecnicos_' + Utils.todayISO() + '.xlsx', 'Rendimiento de Técnicos',
      ['Técnico', 'Cargo', 'Sueldo Mensual', 'Tarifa Hora', 'OTs Completadas', 'OTs En Proceso', 'Total OTs', 'Horas Registradas', 'Costo M.O.', 'Costo Total Gestionado'],
      Object.values(techStats).map(function (t) { return [t.name, t.position, t.salary, t.rate, t.completed, t.inProcess, t.total, t.hours, t.laborCost, t.cost]; }));
    Utils.toast('Reporte técnicos exportado.', 'success');
  }
  function exportConsumption(movs) {
    var salidas = movs.filter(function (m) { return m.type === 'salida'; });
    var totals = {};
    salidas.forEach(function (m) {
      if (!totals[m.itemId]) totals[m.itemId] = { name: m.itemName, qty: 0, cost: 0 };
      totals[m.itemId].qty += m.qty; totals[m.itemId].cost = Utils.dec.add(totals[m.itemId].cost, m.totalCost || 0);
    });
    Utils.exportExcel('reporte_consumo_' + Utils.todayISO() + '.xlsx', 'Consumo de Repuestos',
      ['Artículo', 'Unidades Consumidas', 'Costo Total'],
      Object.values(totals).sort(function (a, b) { return b.qty - a.qty; }).map(function (t) { return [t.name, t.qty, t.cost]; }));
    Utils.toast('Reporte consumo exportado.', 'success');
  }
  function exportPreventivos() {
    var routines = DB.getAll('preventiveRoutines').filter(function (r) { return r.active; });
    var vehicles = DB.getAll('vehicles'); var vMap = {}; vehicles.forEach(function (v) { vMap[v.id] = v; });
    var today = Utils.todayISO();
    var rows = routines.map(function (r) {
      var v = vMap[r.vehicleId];
      if (!v) return null;
      var hoursDiff = (r.lastPerformedHours + r.frequencyHours) - (v.hours || 0);
      var baseDate = new Date(r.lastPerformedDate + 'T00:00:00');
      baseDate.setDate(baseDate.getDate() + (r.frequencyDays || 0));
      var nextDate = Utils.toLocalISO(baseDate);
      
      var nextDateObj = new Date(nextDate + 'T00:00:00');
      var todayObj = new Date(); todayObj.setHours(0,0,0,0);
      var daysDiff = Math.ceil((nextDateObj - todayObj) / 864e5);
      var isDue = (hoursDiff <= 0 || daysDiff <= 0);
      var isWarn = !isDue && (hoursDiff <= 1500 || daysDiff <= 15);
      var estado = isDue ? 'VENCIDO' : (isWarn ? 'PRÓXIMO' : 'AL DÍA');
      return [v.plate, v.brand + ' ' + v.model, r.name, r.frequencyHours, r.frequencyDays, r.lastPerformedHours, r.lastPerformedDate, nextDate, hoursDiff, daysDiff, estado];
    }).filter(Boolean);
    Utils.exportExcel('reporte_preventivos_' + today + '.xlsx', 'Estado de Alertas Preventivas',
      ['Placa', 'Vehículo', 'Rutina', 'Frec. Horas', 'Frec. Días', 'Último Horómetro', 'Última Fecha', 'Próxima Fecha', 'Horas Faltantes', 'Días Faltantes', 'Estado'],
      rows);
    Utils.toast('Reporte de alertas preventivas exportado.', 'success');
  }
  function exportKmDiario() {
    var allLogs = DB.getAll('hoursLogs');
    var vehicles = DB.getAll('vehicles'); var vMap = {}; vehicles.forEach(function (v) { vMap[v.id] = v; });
    var logs = allLogs.filter(function (l) { return l.date >= dateFrom && l.date <= dateTo; });
    if (filterVehicle) logs = logs.filter(function (l) { return l.vehicleId === filterVehicle; });
    logs.sort(function (a, b) { return b.date < a.date ? -1 : 1; });
    var rows = logs.map(function (l) {
      var v = vMap[l.vehicleId];
      return [l.date, v ? v.plate : '—', v ? (v.brand + ' ' + v.model) : '—', l.workedHours || 0, l.totalHours || l.hours || 0, l.notes || ''];
    });
    Utils.exportExcel('reporte_historial_horometro_' + Utils.todayISO() + '.xlsx', 'Historial de Horas Diarias (Horómetro)',
      ['Fecha', 'Placa', 'Vehículo', 'Horas Trabajadas', 'Horómetro Total', 'Notas'],
      rows);
    Utils.toast('Reporte de Horómetro exportado.', 'success');
  }

  function exportConsolidatedTCO() {
    var wos = getWOsInRange(dateFrom, dateTo).filter(function (w) { return w.status === 'completada'; });
    var logs = getMaintenanceLogsInRange(dateFrom, dateTo);
    var fuelLogs = DB.getAll('fuelLogs').filter(function (l) { return l.date >= dateFrom && l.date <= dateTo; });
    var docCosts = DB.getAll('vehicleDocuments').filter(function (d) { return d.updatedAt ? (d.updatedAt >= dateFrom && d.updatedAt <= dateTo) : (d.createdAt >= dateFrom && d.createdAt <= dateTo); });
    
    if (filterVehicle) {
       fuelLogs = fuelLogs.filter(function (l) { return l.vehicleId === filterVehicle; });
       docCosts = docCosts.filter(function (d) { return d.vehicleId === filterVehicle; });
    }

    var vehicles = DB.getAll('vehicles');
    var stats = {};
    vehicles.forEach(function (v) { stats[v.id] = { plate: v.plate, name: (v.brand || '') + ' ' + (v.model || ''), mat: 0, labor: 0, ext: 0, fuel: 0, docs: 0, total: 0 }; });

    wos.forEach(function (w) {
      if (stats[w.vehicleId]) {
        var mat = w.materialBase !== undefined ? w.materialBase : (w.materials || []).reduce(function (acc, m) { return acc + (m.totalCost || 0); }, 0);
        stats[w.vehicleId].mat = Utils.dec.add(stats[w.vehicleId].mat, mat);
        stats[w.vehicleId].labor = Utils.dec.add(stats[w.vehicleId].labor, w.laborCost || 0);
        stats[w.vehicleId].ext = Utils.dec.add(stats[w.vehicleId].ext, w.externalCost || 0);
        stats[w.vehicleId].total = Utils.dec.add(stats[w.vehicleId].total, w.totalCost || 0);
      }
    });
    logs.forEach(function (l) {
      if (stats[l.vehicleId]) {
        stats[l.vehicleId].mat = Utils.dec.add(stats[l.vehicleId].mat, l.matCost || 0);
        stats[l.vehicleId].labor = Utils.dec.add(stats[l.vehicleId].labor, l.laborCost || 0);
        stats[l.vehicleId].ext = Utils.dec.add(stats[l.vehicleId].ext, l.otherCost || 0);
        stats[l.vehicleId].total = Utils.dec.add(stats[l.vehicleId].total, l.totalCost || 0);
      }
    });
    (fuelLogs || []).forEach(function (l) {
      if (stats[l.vehicleId]) {
        stats[l.vehicleId].fuel = Utils.dec.add(stats[l.vehicleId].fuel, l.cost || 0);
        stats[l.vehicleId].total = Utils.dec.add(stats[l.vehicleId].total, l.cost || 0);
      }
    });
    (docCosts || []).forEach(function (d) {
      if (stats[d.vehicleId]) {
        stats[d.vehicleId].docs = Utils.dec.add(stats[d.vehicleId].docs, d.cost || 0);
        stats[d.vehicleId].total = Utils.dec.add(stats[d.vehicleId].total, d.cost || 0);
      }
    });

    var sorted = Object.values(stats).filter(function (s) { return s.total > 0; }).sort(function (a, b) { return b.total - a.total; });
    
    if (!sorted.length) { Utils.toast('No hay gastos para exportar en este período.', 'warning'); return; }

    var rows = sorted.map(function(s) {
      return [
        s.plate,
        s.name,
        s.mat,
        s.labor,
        s.ext,
        s.fuel,
        s.docs,
        s.total
      ];
    });

    Utils.exportExcel('reporte_tco_vehiculos_' + Utils.todayISO() + '.xlsx', 'Gastos Consolidado TCO', 
      ['Móvil / Placa', 'Vehículo', 'Costo Repuestos ($)', 'Costo Mano de Obra ($)', 'Servicios Externos ($)', 'Combustible ($)', 'Documentos Legales ($)', 'Costo Total de Operación ($)'], 
      rows);
      
    Utils.toast('Reporte TCO (Costo Total) exportado.', 'success');
  }

  return { 
    render: render,
    showVehicleMonthlyDetail: showVehicleMonthlyDetail
  };
})();
