/* ============================================================
   APP.JS — Router SPA, initialization, dashboard, settings
   ============================================================ */

var App = (function () {
  'use strict';

  var currentSection = 'dashboard';

  // ── Initialize ─────────────────────────────────────────────
  function init() {
    repairData();
    renderUserSelector();
    updateBadges();
    bindNav();
    window.addEventListener('hashchange', function () {
      var hash = location.hash.replace('#', '') || 'dashboard';
      navigate(hash);
    });

    // Forzar navegación inicial basada en hash
    var initialHash = location.hash.replace('#', '') || 'dashboard';
    navigate(initialHash);

    // RESTAURAR: Sistema de escucha reactiva (V2.1)
    DB.on(function () {
      console.log('🔄 UI: Sincronización Cloud detectada. Refrescando...');
      var current = location.hash.replace('#', '') || 'dashboard';
      navigate(current);
    });
  }

  // ── Data Guard ─────────────────────────────────────────────
  function repairData() {
    // Reparar colecciones nuevas si están vacías (Fase 7)
    var fuels = DB.getAll('fuelLogs');
    var docs = DB.getAll('vehicleDocuments');
    if (!fuels.length || !docs.length) {
      console.log('Reparando datos de combustible y documentos...');
      var daysAgo = function (n) {
        var d = new Date(); d.setDate(d.getDate() - n);
        return d.toISOString().split('T')[0];
      };
      if (!fuels.length) {
        DB.create('fuelLogs', { id: 'fl1', vehicleId: 'vh1', date: daysAgo(5), hours: 12450, gallons: 15.5, pricePerGal: 15000, cost: 232500, fuelType: 'Diesel / ACPM', station: 'Texaco Norte', fullTank: true });
        DB.create('fuelLogs', { id: 'fl2', vehicleId: 'vh2', date: daysAgo(2), hours: 8900, gallons: 10.2, pricePerGal: 16000, cost: 163200, fuelType: 'Gasolina Corriente', station: 'EDS Principal', fullTank: true });
      }
      if (!docs.length) {
        DB.create('vehicleDocuments', { id: 'vd1', vehicleId: 'vh1', type: 'soat', expiry: '2026-12-01', cost: 580000, notes: 'Renovado recientemente', createdAt: daysAgo(10) });
        DB.create('vehicleDocuments', { id: 'vd2', vehicleId: 'vh2', type: 'tecno', expiry: '2026-11-15', cost: 210000, notes: 'Revisión anual', createdAt: daysAgo(15) });
      }
    }
  }

  // ── Navigation ─────────────────────────────────────────────
  function bindNav() {
    document.querySelectorAll('.nav-item[data-section]').forEach(function (item) {
      item.onclick = function () {
        navigate(item.dataset.section);
      };
    });

    // Sidebar toggle
    var toggle = document.getElementById('sidebar-toggle');
    var sidebar = document.querySelector('.sidebar');
    if (toggle && sidebar) {
      toggle.onclick = function () {
        sidebar.classList.toggle('collapsed');
        toggle.textContent = sidebar.classList.contains('collapsed') ? '›' : '‹';
      };
    }

    // User switcher (header)
    var userCard = document.getElementById('active-user-card');
    if (userCard) userCard.onclick = showUserSwitcher;
  }

  function navigate(section) {
    currentSection = section;

    // Update active nav
    document.querySelectorAll('.nav-item[data-section]').forEach(function (item) {
      item.classList.toggle('active', item.dataset.section === section);
    });

    // Show section
    document.querySelectorAll('.page-section').forEach(function (el) {
      el.classList.remove('active');
    });
    var target = document.getElementById('section-' + section);
    if (target) target.classList.add('active');

    // Update page title
    var titles = {
      dashboard: '🏠 Dashboard',
      inventory: '📦 Inventario',
      vehicles: '🚗 Vehículos',
      purchasing: '🛒 Compras y Faltantes',
      workorders: 'Órdenes de Trabajo',
      workshop: 'Vista Taller',
      reports: 'Reportes y Analítica',
      employees: '👥 Empleados',
      settings: '⚙️ Configuración'
    };
    var titleEl = document.getElementById('page-title');
    if (titleEl) titleEl.textContent = titles[section] || section;

    location.hash = '#' + section;

    // Render section
    if (section === 'dashboard') renderDashboard();
    if (section === 'inventory') InventoryModule.render();
    if (section === 'vehicles') VehiclesModule.render();
    if (section === 'purchasing') PurchasingModule.render();
    if (section === 'workorders') WorkOrdersModule.render();
    switch (section) {
      case 'workshop': WorkshopModule.render(); break;
      case 'reports': ReportsModule.render(); break;
    }
    if (section === 'employees') EmployeesModule.render();
    if (section === 'settings') renderSettings();
  }

  // ── User selector ──────────────────────────────────────────
  function renderUserSelector() {
    var settings = DB.getSettings();
    var user = DB.getById('users', settings.activeUserId);
    updateUserDisplay(user);
  }

  function updateUserDisplay(user) {
    var avatarEl = document.getElementById('sidebar-avatar');
    var nameEl = document.getElementById('sidebar-user-name');
    var roleEl = document.getElementById('sidebar-user-role');
    if (avatarEl && user) avatarEl.textContent = user.initials || user.name.charAt(0);
    if (nameEl && user) nameEl.textContent = user.name;
    if (roleEl && user) roleEl.textContent = roleLabels[user.role] || user.role;

    var headerAvatar = document.getElementById('header-avatar');
    var headerName = document.getElementById('header-user-name');
    if (headerAvatar && user) headerAvatar.textContent = user.initials || user.name.charAt(0);
    if (headerName && user) headerName.textContent = user.name;
  }

  var roleLabels = { admin: 'Administrador', mantenimiento: 'Mantenimiento', taller: 'Técnico Taller' };

  function showUserSwitcher() {
    var users = DB.getAll('users');
    var settings = DB.getSettings();
    var old = document.getElementById('user-sw-modal'); if (old) old.remove();

    var html = '<div class="modal-overlay" id="user-sw-modal"><div class="modal" style="max-width:380px;">' +
      '<div class="modal-header"><h3>👤 Cambiar Usuario</h3><button class="modal-close" id="usw-close">✕</button></div>' +
      '<div class="modal-body">' +
      '<p class="text-secondary text-sm" style="margin-bottom:16px;">Selecciona el usuario activo para esta sesión:</p>' +
      users.filter(function (u) { return u.active !== false; }).map(function (u) {
        var active = u.id === settings.activeUserId;
        return '<div style="display:flex;align-items:center;gap:12px;padding:10px;border-radius:10px;cursor:pointer;border:1px solid ' + (active ? 'var(--accent-primary)' : 'var(--border)') + ';margin-bottom:8px;background:' + (active ? 'rgba(59,130,246,0.08)' : 'var(--bg-elevated)') + ';transition:all 0.15s;" onclick="App.switchUser(\'' + u.id + '\');document.getElementById(\'user-sw-modal\').remove();">' +
          '<div class="user-avatar">' + Utils.escapeHtml(u.initials || u.name.charAt(0)) + '</div>' +
          '<div><div class="font-medium">' + Utils.escapeHtml(u.name) + '</div><div class="text-xs text-muted">' + (roleLabels[u.role] || u.role) + '</div></div>' +
          (active ? '<span class="badge badge-blue" style="margin-left:auto;">Activo</span>' : '') +
          '</div>';
      }).join('') +
      '</div>' +
      '</div></div>';

    document.body.insertAdjacentHTML('beforeend', html);
    var ov = document.getElementById('user-sw-modal');
    document.getElementById('usw-close').onclick = function () { ov.remove(); };
    ov.onclick = function (e) { if (e.target === ov) ov.remove(); };
  }

  function switchUser(userId) {
    DB.saveSettings({ activeUserId: userId });
    var user = DB.getById('users', userId);
    updateUserDisplay(user);
    Utils.toast('Usuario cambiado a ' + (user ? user.name : ''), 'info');
    updateBadges();
    navigate(currentSection);
  }

  var _dashboardCache = null;

  function invalidateCache() {
    _dashboardCache = null;
  }

  // ── Badges ─────────────────────────────────────────────────
  function updateBadges() {
    invalidateCache();
    var items = DB.getAll('items');
    var wos = DB.getAll('workOrders');
    var settings = DB.getSettings();
    var user = DB.getById('users', settings.activeUserId);

    var critItems = items.filter(function (i) { return Utils.stockLevel(i) !== 'ok'; }).length;
    var openWOs = wos.filter(function (w) { return w.status === 'emitida' || w.status === 'en_proceso'; }).length;

    var empId = user ? user.employeeId : null;
    var myWOs = wos.filter(function (w) { return empId && w.assignedTo === empId && (w.status === 'emitida' || w.status === 'en_proceso'); }).length;

    setBadge('badge-inventory', critItems);
    setBadge('badge-workorders', openWOs);
    setBadge('badge-workshop', myWOs);

    // Notification dot
    var notifDot = document.getElementById('notif-dot');
    if (notifDot) notifDot.style.display = (critItems > 0 || myWOs > 0) ? 'block' : 'none';
  }

  function setBadge(id, count) {
    var el = document.getElementById(id);
    if (!el) return;
    if (count > 0) { el.textContent = count; el.classList.remove('hidden'); }
    else { el.classList.add('hidden'); }
  }

  // ── Dashboard ──────────────────────────────────────────────
  function renderDashboard() {
    var data;
    if (_dashboardCache) {
      data = _dashboardCache;
    } else {
      var items = DB.getAll('items');
      var wos = DB.getAll('workOrders');
      var movs = DB.getAll('movements');
      var vehts = DB.getAll('vehicles');

      var totalItems = items.length;
      var critItems = items.filter(function (i) { return Utils.stockLevel(i) === 'critical'; }).length;
      var lowItems = items.filter(function (i) { return Utils.stockLevel(i) === 'low'; }).length;

      var openWOs = wos.filter(function (w) { return w.status === 'emitida'; }).length;

      var blockedVehiclesCount = vehts.filter(function (v) {
        return v.active && (VehiclesModule.isVehicleInMaintenance ? VehiclesModule.isVehicleInMaintenance(v.id).inMaintenance : false);
      }).length;

      var last7 = [];
      var last7Labels = [];
      for (var d = 6; d >= 0; d--) {
        var dt = new Date(); dt.setDate(dt.getDate() - d);
        var ds = dt.toISOString().split('T')[0];
        var dayVal = movs.filter(function (m) { return m.date === ds && m.type === 'salida'; }).reduce(function (a, m) { return Utils.dec.add(a, m.totalCost || 0); }, 0);
        last7.push(dayVal);
        last7Labels.push(['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][dt.getDay()]);
      }

      var dueRoutinesCount = 0;
      var routines = DB.getAll('preventiveRoutines').filter(function (r) { return r.active; });
      routines.forEach(function (r) {
        var v = vehts.find(function (x) { return x.id === r.vehicleId && x.active; });
        if (!v) return;
        var hoursDiff = (r.lastPerformedHours + r.frequencyHours) - (v.hours || 0);
        var daysDiff = -1;
        if (r.lastPerformedDate) {
          var prevDate = new Date(r.lastPerformedDate);
          if (!isNaN(prevDate.getTime())) {
            var nextDate = new Date(prevDate.getTime() + (r.frequencyDays * 24 * 60 * 60 * 1000));
            daysDiff = Math.floor((nextDate - new Date()) / (1000 * 60 * 60 * 24));
          }
        }
        if (hoursDiff <= 0 || daysDiff <= 0) dueRoutinesCount++;
      });

      var today = Utils.todayISO();
      var todayLogs = DB.getAll('hoursLogs').filter(function (l) { return l.date === today; });
      var activeVehs = vehts.filter(function (v) { return v.active; });
      var missingHoursToday = activeVehs.length - todayLogs.length;
      var avgHoursToday = activeVehs.length > 0 ? (todayLogs.reduce(function (acc, l) { return acc + (l.workedHours || 0); }, 0) / activeVehs.length) : 0;

      data = {
        inventoryValue: '$ ' + Utils.fmtNum(items.reduce(function (acc, i) { return Utils.dec.add(acc, Utils.dec.mul(Number(i.unitCost) || 0, Number(i.stock) || 0)); }, 0)),
        inventoryConsumption: '$ ' + Utils.fmtNum(
          movs.filter(function (m) { return m.type === 'salida' && m.date && m.date.length >= 7 && m.date.substring(0, 7) === Utils.todayISO().substring(0, 7); }).reduce(function (acc, m) { return acc + (Number(m.totalCost) || 0); }, 0)
        ),
        operatingExpense: '$ ' + Utils.fmtNum(
          wos.filter(function (w) { return w.status === 'completada' && w.closedAt && w.closedAt.length >= 7 && w.closedAt.substring(0, 7) === Utils.todayISO().substring(0, 7); }).reduce(function (acc, w) { return acc + (Number(w.totalCost) || 0); }, 0) +
          (DB.getAll('maintenanceLogs') || []).filter(function (l) { return l.date && l.date.length >= 7 && l.date.substring(0, 7) === Utils.todayISO().substring(0, 7); }).reduce(function (acc, l) { return acc + (Number(l.totalCost) || 0); }, 0) +
          (DB.getAll('fuelLogs') || []).filter(function (l) { return l.date && l.date.length >= 7 && l.date.substring(0, 7) === Utils.todayISO().substring(0, 7); }).reduce(function (acc, l) { return acc + (Number(l.cost) || 0); }, 0) +
          (DB.getAll('vehicleDocuments') || []).filter(function (d) {
            var dt = d.updatedAt || d.createdAt;
            return dt && dt.length >= 7 && dt.substring(0, 7) === Utils.todayISO().substring(0, 7);
          }).reduce(function (acc, d) { return acc + (Number(d.cost) || 0); }, 0)
        ),
        avgUsage: Utils.fmtNum(avgHoursToday) + ' hrs/v',
        missingHours: missingHoursToday,
        stockAlertsIcon: (critItems > 0 ? '🔴' : '⚠️'),
        stockAlertsTitle: (critItems + lowItems),
        stockAlertsColor: (critItems > 0 ? 'red' : (lowItems > 0 ? 'amber' : 'green')),
        stockAlertsSub: (critItems > 0 ? '⚠️ Críticos: ' + critItems : (lowItems > 0 ? 'Stock Bajo: ' + lowItems : 'Inventario al día')),
        fleetCount: (vehts.filter(function (v) { return v.active; }).length - blockedVehiclesCount),
        fleetSub: blockedVehiclesCount > 0 ? ('<strong style="color:var(--color-danger);">🛠️ ' + blockedVehiclesCount + ' En Taller</strong>') : (dueRoutinesCount > 0 ? ('<strong style="color:var(--color-danger);">🚨 ' + dueRoutinesCount + ' Mtto. Vencido</strong>') : 'Flota activa'),
        openWOs: openWOs,
        last7: last7,
        last7Labels: last7Labels,
        stockAlertsHtml: renderStockAlerts(items),
        recentWOsHtml: renderRecentWOs(wos)
      };
      _dashboardCache = data;
    }

    var html =
      '<div class="section-header"><h2>🏠 Dashboard</h2><span class="text-secondary text-sm">' + new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) + '</span></div>' +

      '<div class="grid-3" style="margin-bottom:16px;">' +
      kpi('💵', 'Valor Inventario Físico', data.inventoryValue, 'green', 'Capital actual almacén') +
      kpi('📤', 'Consumo Inventario (Mes)', data.inventoryConsumption, 'amber', 'Material de almacén') +
      kpi('💸', 'Gasto Operativo (Mes)', data.operatingExpense, 'blue', 'Mant. + Comb. + Trámites') +
      '</div>' +

      '<div class="grid-4" style="margin-bottom:24px;">' +
      kpi('📍', 'Uso Promedio (Hoy)', data.avgUsage, 'green', 'Horas promedio por vehículo') +
      kpi('⚠️', 'Vehículos sin Horas', data.missingHours, data.missingHours > 0 ? 'amber' : 'green', 'Sin reporte hoy') +
      kpi(data.stockAlertsIcon, 'Alertas de Stock', data.stockAlertsTitle, data.stockAlertsColor, data.stockAlertsSub) +
      kpi('🚗', 'Flota Operativa', data.fleetCount, 'blue', data.fleetSub) +
      kpi('📨', 'OT Emitidas', data.openWOs, 'amber', data.openWOs > 0 ? 'Pendientes de asignar' : '') +
      '</div>' +

      '<div class="grid-2" style="margin-bottom:24px;">' +
      '<div class="card">' +
      '<div class="card-header"><h3>📈 Consumo Diario de Inventario ($ Últimos 7 días)</h3></div>' +
      '<div class="chart-container"><canvas id="dash-chart" style="width:100%;height:180px;"></canvas></div>' +
      '</div>' +
      '<div class="card">' +
      '<div class="card-header"><h3>⚠️ Alertas de Stock</h3></div>' +
      data.stockAlertsHtml +
      '</div>' +
      '</div>' +

      '<div class="grid-2">' +
      '<div class="card">' +
      '<div class="card-header"><h3>🔧 Últimas Órdenes de Trabajo</h3>' +
      '<button class="btn btn-ghost btn-sm" onclick="App.go(\'workorders\')">Ver todas →</button>' +
      '</div>' +
      data.recentWOsHtml +
      '</div>' +

      '<div class="card">' +
      '<div class="card-header"><h3>⚡ Acciones Rápidas</h3></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">' +
      quickAction('+ Nuevo Artículo', '🆕', 'btn-primary', 'InventoryModule.showItemModal();App.go(\'inventory\')') +
      quickAction('+ Nuevo Vehículo', '🚗', 'btn-cyan', 'VehiclesModule.showVehicleModal();App.go(\'vehicles\')') +
      quickAction('+ Nueva OT', '🔧', 'btn-cyan', 'App.go(\'workorders\');setTimeout(function(){WorkOrdersModule.showCreateModal();},100)') +
      quickAction('Entrar Stock', '➕', 'btn-success', 'InventoryModule.showMovementModal(null,\'entrada\');App.go(\'inventory\')') +
      quickAction('Vista Taller', '🛠️', 'btn-warning', 'App.go(\'workshop\')') +
      quickAction('Pendientes Compra', '🛒', 'btn-secondary', 'App.go(\'purchasing\')') +
      '</div>' +
      '</div>' +
      '</div>';

    document.getElementById('section-dashboard').innerHTML = html;

    Utils.afterRender('dash-chart', function () {
      var ctx = document.getElementById('dash-chart');
      if (ctx && window.Chart) {
        new Chart(ctx, {
          type: 'bar',
          data: {
            labels: data.last7Labels,
            datasets: [{
              label: 'Consumo Diario ($)',
              data: data.last7,
              backgroundColor: 'rgba(56, 189, 248, 0.9)',
              borderRadius: 4
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              x: { grid: { display: false } },
              y: { beginAtZero: true, ticks: { stepSize: 1 } }
            }
          }
        });
      } else if (ctx) {
        Utils.drawBarChart('dash-chart', data.last7Labels, data.last7, 'rgba(56, 189, 248, 0.9)');
      }
    });
  }

  function kpi(icon, label, val, color, sub) {
    return '<div class="kpi-card ' + color + '">' +
      '<div class="kpi-icon ' + color + '">' + icon + '</div>' +
      '<div class="kpi-value">' + val + '</div>' +
      '<div class="kpi-label">' + label + '</div>' +
      (sub ? '<div class="kpi-trend text-xs" style="margin-top:4px;color:var(--text-muted);">' + sub + '</div>' : '') +
      '</div>';
  }

  function quickAction(label, icon, cls, action) {
    return '<button class="btn ' + cls + ' w-full" style="justify-content:flex-start;gap:8px;" onclick="' + action + '">' + icon + ' ' + label + '</button>';
  }

  function renderStockAlerts(items) {
    var alerts = items.filter(function (i) { return Utils.stockLevel(i) !== 'ok'; });
    if (!alerts.length) return '<div class="empty-state" style="padding:24px;"><div class="empty-state-icon">✅</div><p>Todos los artículos con stock suficiente.</p></div>';
    return alerts.slice(0, 5).map(function (item) {
      var lvl = Utils.stockLevel(item);
      var cls = lvl === 'critical' ? 'danger' : 'warning';
      return '<div class="alert-banner ' + cls + '" style="margin-bottom:8px;">' +
        '<div style="flex:1;">' +
        '<div class="font-medium">' + Utils.escapeHtml(item.name) + '</div>' +
        '<div class="text-xs">Stock: <strong>' + item.stock + '</strong> | Mín: ' + item.minStock + ' ' + Utils.escapeHtml(item.unit) + '</div>' +
        '</div>' +
        '<button class="btn btn-sm" style="background:rgba(255,255,255,0.1);border:none;color:inherit;cursor:pointer;" onclick="InventoryModule.showMovementModal(\'' + item.id + '\',\'entrada\');App.go(\'inventory\')">➕</button>' +
        '</div>';
    }).join('') + (alerts.length > 5 ? '<p class="text-sm text-muted" style="text-align:center;padding:4px;">y ' + (alerts.length - 5) + ' artículos más...</p>' : '');
  }

  function renderRecentWOs(wos) {
    var recent = wos.slice().reverse().slice(0, 5);
    if (!recent.length) return '<div class="empty-state" style="padding:24px;"><div class="empty-state-icon">🔧</div><p>Sin órdenes de trabajo.</p></div>';
    return '<div>' + recent.map(function (w) {
      return '<div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--border);">' +
        '<div style="flex:1;min-width:0;">' +
        '<div class="flex gap-2 items-center"><span style="font-weight:600;color:var(--accent-cyan);font-size:0.857rem;">' + Utils.escapeHtml(w.number) + '</span>' + Utils.priorityBadge(w.priority) + '</div>' +
        (w.vehiclePlate ? '<div style="margin-bottom:8px;font-weight:600;color:var(--text-secondary);">📌 ' + Utils.escapeHtml(w.vehiclePlate) + ' · Horas: ' + Utils.fmtNum(w.vehicleHours || 0) + ' hrs</div>' : '') +
        '<div class="text-xs text-muted truncate">' + Utils.escapeHtml(w.description) + '</div>' +
        '</div>' +
        Utils.otStatusBadge(w.status) +
        '</div>';
    }).join('') + '</div>';
  }

  // ── Settings ───────────────────────────────────────────────
  function renderSettings() {
    var settings = DB.getSettings();
    var users = DB.getAll('users');

    var html = '<div class="section-header"><h2>⚙️ Configuración</h2></div>' +

      '<div class="grid-2">' +

      '<div class="card">' +
      '<div class="card-header"><h3>🏢 Datos de la Empresa</h3></div>' +
      '<div class="form-group"><label>Nombre de la empresa</label><input class="form-input" id="s-company" value="' + Utils.escapeHtml(settings.companyName || '') + '"></div>' +
      '<div class="form-group"><label>NIT</label><input class="form-input" id="s-nit" value="' + Utils.escapeHtml(settings.companyNit || '') + '"></div>' +
      '<div class="form-group"><label>Dirección</label><input class="form-input" id="s-addr" value="' + Utils.escapeHtml(settings.companyAddress || '') + '" placeholder="Dirección de la empresa"></div>' +
      '<div class="form-group"><label>Horas Laborales Mensuales (Base cálculo)</label><input class="form-input" type="number" id="s-hours" value="' + (settings.monthlyWorkingHours || 220) + '" title="Horas al mes según ley (Colombia actual: 220)"></div>' +
      '<button class="btn btn-primary" id="s-save-company">💾 Guardar Configuración</button>' +
      '</div>' +

      '<div class="card">' +
      '<div class="card-header"><h3>👥 Usuarios</h3><button class="btn btn-primary btn-sm" onclick="App.showUserModal()">+ Usuario</button></div>' +
      users.map(function (u) {
        return '<div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--border);">' +
          '<div class="user-avatar">' + Utils.escapeHtml(u.initials || u.name.charAt(0)) + '</div>' +
          '<div style="flex:1;"><div class="font-medium">' + Utils.escapeHtml(u.name) + '</div>' +
          '<div class="text-xs text-muted">' + (roleLabels[u.role] || u.role) + '</div></div>' +
          '<button class="btn btn-ghost btn-sm" onclick="App.showUserModal(\'' + u.id + '\')">✏️</button>' +
          '<button class="btn btn-ghost btn-sm" onclick="App.deleteUser(\'' + u.id + '\')">🗑️</button>' +
          '</div>';
      }).join('') +
      '</div>' +

      '</div>' +

      '<div class="grid-2" style="margin-top:20px;">' +
      
      '<div class="card">' +
      '<div class="card-header"><h3>🛰️ Gestión de la Nube</h3>' +
      '<span class="badge ' + (DB.isCloudReady() ? 'badge-green' : 'badge-gray') + '" id="cloud-status-badge">' +
      (DB.isCloudReady() ? '● Conectado' : '● Modo Local') + '</span></div>' +
      '<p class="text-secondary text-sm" style="margin-bottom:16px;">Sincroniza tus datos locales con Firebase Cloud para acceso multiusuario.</p>' +
      '<button class="btn btn-primary w-full" id="s-cloud-upload" ' + (DB.isCloudReady() ? '' : 'disabled') + '>🆙 Subir Datos Locales a la Nube</button>' +
      '</div>' +

      '<div class="card">' +
      '<div class="card-header"><h3>💾 Backup & Restore</h3></div>' +
      '<p class="text-secondary text-sm" style="margin-bottom:16px;">Exporta o importa todos los datos de la aplicación en formato JSON.</p>' +
      '<div class="flex gap-3 flex-wrap">' +
      '<button class="btn btn-secondary" id="s-export-db">📤 Exportar Backup</button>' +
      '<button class="btn btn-secondary" id="s-import-db">📥 Importar Backup</button>' +
      '<input type="file" id="s-import-file" accept=".json" class="hidden">' +
      '</div>' +
      '</div>' +

      '<div class="card">' +
      '<div class="card-header"><h3>⚠️ Zona de Peligro</h3></div>' +
      '<p class="text-secondary text-sm" style="margin-bottom:16px;">Restablece todos los datos a la configuración inicial de ejemplo.</p>' +
      '<button class="btn btn-danger" id="s-reset-db">🔄 Restablecer Datos de Ejemplo</button>' +
      '</div>' +
      '</div>';

    document.getElementById('section-settings').innerHTML = html;

    document.getElementById('s-save-company').onclick = function () {
      DB.saveSettings({
        companyName: document.getElementById('s-company').value.trim(),
        companyNit: document.getElementById('s-nit').value.trim(),
        companyAddress: document.getElementById('s-addr').value.trim(),
        monthlyWorkingHours: parseInt(document.getElementById('s-hours').value) || 220
      });
      Utils.toast('Configuración guardada.', 'success');
    };

    var cloudBtn = document.getElementById('s-cloud-upload');
    if (cloudBtn) {
      cloudBtn.onclick = function () {
        DB.uploadToCloud();
      };
    }

    document.getElementById('s-export-db').onclick = function () {
      var blob = new Blob([DB.exportAll()], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a'); a.href = url; a.download = 'backup_inventario_' + Utils.todayISO() + '.json';
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(url); document.body.removeChild(a); }, 200);
      Utils.toast('Backup exportado.', 'success');
    };

    document.getElementById('s-import-db').onclick = function () { document.getElementById('s-import-file').click(); };
    document.getElementById('s-import-file').onchange = function (e) {
      var file = e.target.files[0]; if (!file) return;
      var reader = new FileReader();
      reader.onload = function (ev) {
        Utils.confirm('¿Importar este backup? Se reemplazarán TODOS los datos actuales.', 'Importar Backup', function () {
          if (DB.importAll(ev.target.result)) { Utils.toast('Backup importado correctamente.', 'success'); navigate(currentSection); }
          else Utils.toast('Error al importar. Verifica el archivo JSON.', 'error');
        }, true);
      };
      reader.readAsText(file);
    };

    document.getElementById('s-reset-db').onclick = function () {
      Utils.confirm('¿Restablecer todos los datos? Se perderán todos los registros actuales.', 'Restablecer', function () {
        DB.reset(); Utils.toast('Datos restablecidos.', 'warning'); renderSettings(); updateBadges();
      }, true);
    };
  }

  function showUserModal(id) {
    var user = id ? DB.getById('users', id) : null;
    var old = document.getElementById('um-modal'); if (old) old.remove();

    var html = '<div class="modal-overlay" id="um-modal"><div class="modal">' +
      '<div class="modal-header"><h3>' + (user ? '✏️ Editar Usuario' : '+ Nuevo Usuario') + '</h3><button class="modal-close" id="um-close">✕</button></div>' +
      '<div class="modal-body">' +
      '<div class="form-group"><label>Nombre *</label><input class="form-input" id="um-name" value="' + Utils.escapeHtml(user ? user.name : '') + '"></div>' +
      '<div class="form-group"><label>Iniciales (2-3 letras)</label><input class="form-input" id="um-init" value="' + Utils.escapeHtml(user ? user.initials : '') + '" maxlength="3" style="text-transform:uppercase;"></div>' +
      '<div class="form-group"><label>Rol *</label><select class="form-select" id="um-role">' +
      '<option value="admin"' + (user && user.role === 'admin' ? ' selected' : '') + '>Administrador</option>' +
      '<option value="mantenimiento"' + (user && user.role === 'mantenimiento' ? ' selected' : (!user ? ' selected' : '')) + '>Mantenimiento</option>' +
      '<option value="taller"' + (user && user.role === 'taller' ? ' selected' : '') + '>Técnico Taller</option>' +
      '</select></div>' +
      '<div class="form-group"><label>Vincular con Empleado (Opcional)</label>' +
      '<select class="form-select" id="um-emp"><option value="">No vincular</option>' +
      DB.getAll('employees').filter(function (e) { return e.active; }).map(function (e) { return '<option value="' + e.id + '"' + (user && user.employeeId === e.id ? ' selected' : '') + '>' + Utils.escapeHtml(e.name) + '</option>'; }).join('') +
      '</select></div>' +
      '</div>' +
      '<div class="modal-footer"><button class="btn btn-secondary" id="um-can">Cancelar</button><button class="btn btn-primary" id="um-sv">💾 Guardar</button></div>' +
      '</div></div>';

    document.body.insertAdjacentHTML('beforeend', html);
    var ov = document.getElementById('um-modal');
    function close() { ov.remove(); }
    document.getElementById('um-close').onclick = close;
    document.getElementById('um-can').onclick = close;
    ov.onclick = function (e) { if (e.target === ov) close(); };

    document.getElementById('um-sv').onclick = function () {
      var name = document.getElementById('um-name').value.trim();
      if (!name) { Utils.toast('El nombre es obligatorio.', 'warning'); return; }
      var data = {
        name: name, initials: (document.getElementById('um-init').value.trim() || name.substring(0, 2)).toUpperCase(),
        role: document.getElementById('um-role').value,
        employeeId: document.getElementById('um-emp').value || null,
        active: true
      };
      if (user) { DB.update('users', user.id, data); Utils.toast('Usuario actualizado.', 'success'); }
      else { DB.create('users', data); Utils.toast('Usuario creado.', 'success'); }
      close(); renderSettings();
    };
  }

  function deleteUser(id) {
    var u = DB.getById('users', id);
    var settings = DB.getSettings();
    if (settings.activeUserId === id) { Utils.toast('No puedes eliminar el usuario activo.', 'error'); return; }
    Utils.confirm('¿Eliminar el usuario "' + u.name + '"?', 'Eliminar Usuario', function () {
      DB.remove('users', id); Utils.toast('Usuario eliminado.', 'success'); renderSettings();
    }, true);
  }

  function go(section) { navigate(section); }

  return { init: init, go: go, switchUser: switchUser, showUserSwitcher: showUserSwitcher, showUserModal: showUserModal, deleteUser: deleteUser, updateBadges: updateBadges };
})();

// Boot
document.addEventListener('DOMContentLoaded', function () {
  App.init();
});
