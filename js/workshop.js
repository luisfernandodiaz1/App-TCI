/* ============================================================
   WORKSHOP.JS — Workshop view (Taller role)
   ============================================================ */

var WorkshopModule = (function () {
  'use strict';

  var searchText = '';
  var filterMode = 'all'; // 'all' | 'mine' | 'high'
  var workshopTab = 'reparaciones'; // 'reparaciones' | 'preventivos'

  function render() {
    var settings = DB.getSettings();
    var activeUser = DB.getById('users', settings.activeUserId);
    var isAdmin = activeUser && activeUser.role === 'admin';
    var isTaller = activeUser && (activeUser.role === 'taller' || isAdmin);

    if (!isTaller) {
      var html = '<div class="section-header"><div class="section-header-left"><h2>🛠️ Vista Taller</h2></div></div>' +
        '<div class="card"><div class="empty-state"><div class="empty-state-icon">🔒</div><h3>Sin acceso</h3><p>Esta vista es para el personal de taller.</p></div></div>';
      var container = document.getElementById('section-workshop');
      if (container) container.innerHTML = html;
      return;
    }

    // ── Separar OTs: Correctivas vs Preventivas ─────────────
    var allWOs = DB.getAll('workOrders').filter(function (w) { return w.status !== 'borrador' && w.status !== 'cancelada'; });
    var empId = activeUser ? activeUser.employeeId : null;

    // Filtrar por modo (mine, high)
    var baseWOs = allWOs.slice();
    if (filterMode === 'mine' && empId) {
      baseWOs = baseWOs.filter(function (w) { return w.assignedTo === empId; });
    } else if (filterMode === 'high') {
      baseWOs = baseWOs.filter(function (w) { return w.priority === 'alta'; });
    }
    if (searchText) {
      var q = searchText.toLowerCase();
      baseWOs = baseWOs.filter(function (w) {
        return (w.number || '').toLowerCase().includes(q) ||
          (w.vehiclePlate || '').toLowerCase().includes(q) ||
          (w.description || '').toLowerCase().includes(q);
      });
    }

    // Separar por tipo — usa maintenanceType con fallback a isPreventive (retrocompatibilidad)
    function isPreventiveWO(w) { return w.maintenanceType === 'preventivo' || (!w.maintenanceType && !!w.isPreventive); }
    var repWOs = baseWOs.filter(function (w) { return !isPreventiveWO(w); });
    var prevWOs = baseWOs.filter(function (w) { return isPreventiveWO(w); });
    var activeWOs = workshopTab === 'preventivos' ? prevWOs : repWOs;

    // Columnas Kanban
    var colPendientes = activeWOs.filter(function (w) { return w.status === 'emitida'; });
    var colProceso = activeWOs.filter(function (w) { return w.status === 'en_proceso'; });
    var colPausadas = activeWOs.filter(function (w) { return w.status === 'esperando_repuestos'; });
    var colCerradas = activeWOs.filter(function (w) { return w.status === 'completada'; }).sort(function(a,b){ return b.closedAt > a.closedAt ? 1 : -1; }).slice(0, 5);

    // Contadores por tab — para badges
    var repPendCount = repWOs.filter(function (w) { return w.status === 'emitida' || w.status === 'en_proceso' || w.status === 'esperando_repuestos'; }).length;
    var prevPendCount = prevWOs.filter(function (w) { return w.status === 'emitida' || w.status === 'en_proceso' || w.status === 'esperando_repuestos'; }).length;

    var html = '<div class="section-header">' +
      '<div class="section-header-left"><h2>🛠️ Vista Taller</h2>' +
      (activeUser ? '<span class="badge badge-cyan">' + Utils.escapeHtml(activeUser.name) + '</span>' : '') +
      '</div>' +
      '</div>';

    // ── Selector de modo: Reparaciones / Preventivos ─────────
    html += '<div style="display:flex;align-items:center;gap:0;margin-bottom:20px;border:1px solid var(--border);border-radius:var(--radius-md);overflow:hidden;width:fit-content;">' +
      '<button id="ws-tab-rep" style="' + (workshopTab === 'reparaciones' ? 'background:var(--accent-primary);color:#fff;' : 'background:var(--bg-elevated);color:var(--text-secondary);') + 'border:none;padding:10px 20px;font-size:0.875rem;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:8px;">🔧 Reparaciones' +
      (repPendCount > 0 ? ' <span style="background:var(--color-danger);color:#fff;border-radius:999px;padding:1px 7px;font-size:0.72rem;font-weight:700;">' + repPendCount + '</span>' : '') +
      '</button>' +
      '<button id="ws-tab-prev" style="' + (workshopTab === 'preventivos' ? 'background:var(--accent-primary);color:#fff;' : 'background:var(--bg-elevated);color:var(--text-secondary);') + 'border:none;padding:10px 20px;font-size:0.875rem;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:8px;">📅 Mantenimientos Preventivos' +
      (prevPendCount > 0 ? ' <span style="background:var(--color-warning);color:#000;border-radius:999px;padding:1px 7px;font-size:0.72rem;font-weight:700;">' + prevPendCount + '</span>' : '') +
      '</button>' +
      '</div>';

    // Toolbar de búsqueda y filtros
    html += '<div class="toolbar" style="margin-bottom:20px; flex-wrap:wrap; gap:12px;">' +
      '<div class="search-bar" style="flex:1; min-width:250px;">' +
      '<span>🔍</span><input type="text" id="ws-search" placeholder="Buscar placa, OT o descripción..." value="' + Utils.escapeHtml(searchText) + '">' +
      '</div>' +
      '<div class="flex gap-1">' +
      '<button class="btn btn-sm ' + (filterMode === 'all' ? 'btn-primary' : 'btn-ghost') + '" id="ws-f-all">Todos</button>' +
      '<button class="btn btn-sm ' + (filterMode === 'mine' ? 'btn-primary' : 'btn-ghost') + '" id="ws-f-mine">Mis OTs</button>' +
      '<button class="btn btn-sm ' + (filterMode === 'high' ? 'btn-primary' : 'btn-ghost') + '" id="ws-f-high">Prioridad Alta</button>' +
      '</div>' +
      '</div>';

    if (activeWOs.length === 0 && (searchText || filterMode !== 'all')) {
      html += '<div class="card"><div class="empty-state" style="padding:40px;">' +
        '<div class="empty-state-icon">🔎</div><h3>Sin resultados</h3>' +
        '<p>No se encontraron órdenes con esos criterios.</p>' +
        '<button class="btn btn-secondary btn-sm" onclick="WorkshopModule.resetFilters()">Limpiar Filtros</button>' +
        '</div></div>';
    } else if (activeWOs.length === 0) {
      var emptyIcon = workshopTab === 'preventivos' ? '📅' : '🔧';
      var emptyMsg = workshopTab === 'preventivos'
        ? 'No hay mantenimientos programados. Créalos desde <strong>Vehículos > Alertas Preventivas</strong>.'
        : 'No hay órdenes de reparación activas.';
      html += '<div class="card"><div class="empty-state" style="padding:48px;">' +
        '<div class="empty-state-icon">' + emptyIcon + '</div>' +
        '<h3>Sin órdenes</h3><p>' + emptyMsg + '</p></div></div>';
    } else {
      html += '<div class="kanban-board">' +
        renderKanbanCol('📨 PENDIENTES', colPendientes, 'amber', 'pendiente') +
        renderKanbanCol('⚙️ EN PROCESO', colProceso, 'blue', 'en_proceso') +
        renderKanbanCol('⏳ PAUSADAS', colPausadas, 'red', 'pausada') +
        renderKanbanCol('✅ CERRADAS (Top 5)', colCerradas, 'green', 'completada') +
        '</div>';
    }

    var container = document.getElementById('section-workshop');
    if (container) {
      container.innerHTML = html;
      // Tab switchers
      var tabRep = document.getElementById('ws-tab-rep');
      var tabPrev = document.getElementById('ws-tab-prev');
      if (tabRep) tabRep.onclick = function() { workshopTab = 'reparaciones'; render(); };
      if (tabPrev) tabPrev.onclick = function() { workshopTab = 'preventivos'; render(); };
      var searchInput = document.getElementById('ws-search');
      if (searchInput) {
        searchInput.oninput = Utils.debounce(function () {
          searchText = searchInput.value;
          render();
          var s = document.getElementById('ws-search'); if(s) s.focus();
        }, 300);
      }
      document.getElementById('ws-f-all').onclick = function() { filterMode = 'all'; render(); };
      document.getElementById('ws-f-mine').onclick = function() { filterMode = 'mine'; render(); };
      document.getElementById('ws-f-high').onclick = function() { filterMode = 'high'; render(); };
    }
  }

  function renderKanbanCol(title, wos, color, mode) {
    var colorHex = { amber: '#f59e0b', blue: '#3b82f6', red: '#ef4444', green: '#10b981' };
    var html = '<div class="kanban-col">' +
      '<div class="kanban-col-header" style="border-top: 3px solid ' + colorHex[color] + ';">' +
      '<span class="kanban-col-title">' + title + '</span>' +
      '<span class="kanban-col-count" style="background:' + colorHex[color] + ';">' + wos.length + '</span>' +
      '</div>';
    if (!wos.length) html += '<div class="kanban-empty">Sin órdenes</div>';
    else html += wos.map(function (wo) { return renderWOCard(wo, mode); }).join('');
    html += '</div>';
    return html;
  }

  function kpiCard(icon, label, val, color) {
    return '<div class="kpi-card ' + color + '">' +
      '<div class="kpi-icon ' + color + '">' + icon + '</div>' +
      '<div class="kpi-value">' + val + '</div>' +
      '<div class="kpi-label">' + label + '</div>' +
      '</div>';
  }

  function renderWOCard(wo, mode) {
    var matTotal = (wo.materials || []).length;
    var matDel = (wo.materials || []).filter(function (m) { return m.delivered; }).length;
    var progress = matTotal > 0 ? Math.round((matDel / matTotal) * 100) : 0;

    var daysOpen = Math.floor((new Date() - new Date(wo.date)) / 864e5);
    var timeLabel = daysOpen === 0 ? 'Hoy' : 'Hace ' + daysOpen + ' d';
    var priorityColor = wo.priority === 'alta' ? '#ef4444' : (wo.priority === 'media' ? '#f59e0b' : '#10b981');

    // Badge especial para OTs preventivas
    var prevBadgeHtml = wo.isPreventive
      ? '<div style="margin-bottom:6px;padding:4px 8px;background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.4);border-radius:6px;font-size:0.72rem;font-weight:700;color:var(--color-warning);">📅 Preventivo: ' + Utils.escapeHtml(wo.routineName || 'Rutina') + '</div>'
      : '';

    var html = '<div class="kanban-card" style="border-left:4px solid ' + priorityColor + '; box-shadow: 0 4px 12px rgba(0,0,0,0.1);' + (wo.isPreventive ? 'border-top:2px solid var(--color-warning);' : '') + '">' +
      '<div class="flex justify-between items-center" style="margin-bottom:6px;">' +
      '<span class="kanban-card-num">' + Utils.escapeHtml(wo.number) + '</span>' +
      '<span class="text-xs text-muted" style="font-weight:600;">⏱️ ' + timeLabel + '</span>' +
      '</div>' +
      prevBadgeHtml +
      (wo.vehiclePlate ? '<div class="kanban-card-vehicle">🚗 ' + Utils.escapeHtml(wo.vehiclePlate) + '</div>' : '') +
      '<div class="kanban-card-desc" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:2.4em;">' + Utils.escapeHtml(wo.description) + '</div>';

    if (matTotal > 0) {
      html += '<div style="margin: 8px 0 12px 0;">' +
        '<div class="flex justify-between text-xs" style="margin-bottom:4px; font-weight:600;">' +
        '<span class="text-muted">Repuestos</span><span>' + matDel + '/' + matTotal + '</span>' +
        '</div>' +
        '<div style="height:6px; background:var(--bg-elevated); border-radius:10px; overflow:hidden;">' +
        '<div style="width:' + progress + '%; height:100%; background:var(--accent-primary); transition:width 0.3s ease;"></div>' +
        '</div>' +
        '</div>';
    }

    html += '<div class="kanban-card-actions">';
    if (mode === 'pendiente') {
      html += '<button class="btn btn-warning btn-xs" style="flex:1;" onclick="WorkshopModule.acceptOT(\'' + Utils.escapeHtml(wo.id) + '\')">Aceptar</button>';
    } else {
      html += '<button class="btn ' + (mode === 'completada' ? 'btn-ghost' : 'btn-primary') + ' btn-xs" style="flex:1;" onclick="WorkshopModule.openDeliverModal(\'' + Utils.escapeHtml(wo.id) + '\')">' + (mode === 'completada' ? 'Ver' : 'Gestionar') + '</button>';
    }
    html += '<button class="btn btn-ghost btn-xs" onclick="Utils.printOT(DB.getById(\'workOrders\',\'' + Utils.escapeHtml(wo.id) + '\'))">🖨️</button>' +
      '</div></div>';
    return html;
  }

  function acceptOT(id) {
    var settings = DB.getSettings();
    var activeUser = DB.getById('users', settings.activeUserId);
    var wo = DB.getById('workOrders', id);
    if (!wo) return;

    Utils.confirm('¿Aceptar esta orden de trabajo y ponerla en proceso?', 'Aceptar OT', function () {
      var updateData = { status: 'en_proceso' };
      // Si la orden no tiene mecánico asignado, asignársela a quien la acepta
      if (!wo.assignedTo && activeUser && activeUser.employeeId) {
        updateData.assignedTo = activeUser.employeeId;
      }
      DB.update('workOrders', id, updateData);
      Utils.toast('OT aceptada y asignada a tu usuario.', 'success');
      render(); App.updateBadges();
    });
  }

  function _doAction(idx, action, wId) {
    var o = DB.getById('workOrders', wId);
    if (!o) return;
    var m = o.materials[idx];
    var item = DB.getById('items', m.itemId);
    var settings = DB.getSettings();

    if (action === 'deliver') {
      var qty = parseInt(document.getElementById('mat-del-' + idx).value) || 0;
      if (qty <= 0) return;
      if (!item || item.stock < qty) { Utils.toast('Stock insuficiente. Disponible: ' + (item ? item.stock : 0), 'error'); return; }

      var unitC = item.unitCost || 0;
      var baseAdd = Utils.dec.mul(qty, unitC);

      DB.transaction(function () {
        DB.registerMovement(item.id, 'salida', qty, {
          unitCost: unitC,
          totalCost: baseAdd,
          reference: o.number,
          notes: 'Entrega taller ' + o.number + ' (Costo: ' + Utils.fmtNum(baseAdd) + ')'
        });

        m.qtyDelivered = (m.qtyDelivered || 0) + qty;
        m.delivered = (m.qtyDelivered >= m.qtyRequested);
        m.unitCost = unitC;
        m.totalBase = Utils.dec.add(m.totalBase || 0, baseAdd);
        m.totalCost = m.totalBase;
        DB.update('workOrders', wId, { materials: o.materials });
      });
      Utils.toast('Entrega registrada exitosamente.', 'success');

    } else if (action === 'return') {
      var rQty = parseInt(document.getElementById('mat-ret-' + idx).value) || 0;
      if (rQty <= 0 || rQty > (m.qtyDelivered || 0)) return;

      Utils.confirm('¿Deseas devolver ' + rQty + ' unidad(es) al inventario?', 'Confirmar Devolución', function () {
        var unitC = m.unitCost || (item ? item.unitCost : 0) || 0;
        var baseSub = Utils.dec.mul(rQty, unitC);

        DB.transaction(function () {
          if (item) {
            DB.registerMovement(item.id, 'entrada', rQty, {
              unitCost: unitC,
              totalCost: baseSub,
              reference: o.number,
              notes: 'Devolución taller ' + o.number + ' (Costo: ' + Utils.fmtNum(baseSub) + ')'
            });
          }

          m.qtyDelivered = (m.qtyDelivered || 0) - rQty;
          m.delivered = (m.qtyDelivered >= m.qtyRequested);
          m.totalBase = Math.max(0, Utils.dec.sub(m.totalBase || 0, baseSub));
          m.totalCost = m.totalBase;
          DB.update('workOrders', wId, { materials: o.materials });
        });
        Utils.toast('Devolución procesada.', 'info');
        finishAction(o, wId);
      });
      return; 
    }
    finishAction(o, wId);
  }

  function finishAction(o, wId) {
    App.updateBadges(); render();
    var matsContainer = document.getElementById('dlv-mats');
    if (matsContainer && o) { 
       var currentO = DB.getById('workOrders', wId);
       if (currentO) {
         openDeliverModal(wId); 
       }
    }
  }

  function openDeliverModal(woId) {
    var wo = DB.getById('workOrders', woId);
    if (!wo) return;
    var settings = DB.getSettings();
    var isCompleted = (wo.status === 'completada' || wo.status === 'cancelada');
    var old = document.getElementById('deliver-modal'); if (old) old.remove();

    var mats = wo.materials || [];

    function buildMatHtml() {
      if (!mats.length) return '<p class="text-muted text-sm">Esta OT no tiene materiales requeridos.</p>';
      return mats.map(function (m, i) {
        var pending = m.qtyRequested - (m.qtyDelivered || 0);
        var isDone = pending <= 0;
        var hasDelivered = (m.qtyDelivered || 0) > 0;

        var html = '<div class="material-item" style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;padding:12px;background:var(--bg-elevated);margin-bottom:8px;border-radius:8px;">' +
          '<div style="flex:1;min-width:200px;">' +
          '<div class="mat-name" style="font-weight:600;margin-bottom:4px;">' + Utils.escapeHtml(m.itemName) + '</div>' +
          '<div class="text-xs text-muted">Solicitado: ' + m.qtyRequested + ' ' + m.unit + ' | Entregado: <strong style="color:var(--text)">' + (m.qtyDelivered || 0) + '</strong> | Pendiente: <strong style="color:var(--color-danger)">' + pending + '</strong></div>' +
          '</div>';

        if (!isCompleted) {
          html += '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">';
          if (pending > 0) {
            html += '<input type="number" id="mat-del-' + i + '" min="1" max="' + pending + '" value="' + pending + '" class="form-input" style="width:70px;padding:4px;"> ' +
              '<button class="btn btn-success btn-sm" onclick="WorkshopModule._doAction(' + i + ',\'deliver\',\'' + Utils.escapeHtml(woId) + '\')">Entrega</button>';
          } else {
            html += '<span class="badge badge-green">✔ Completo</span>';
          }
          if (hasDelivered) {
            html += '<input type="number" id="mat-ret-' + i + '" min="1" max="' + (m.qtyDelivered || 0) + '" value="1" class="form-input" style="width:70px;padding:4px;margin-left:8px;"> ' +
              '<button class="btn btn-warning btn-sm" onclick="WorkshopModule._doAction(' + i + ',\'return\',\'' + Utils.escapeHtml(woId) + '\')">Devolver</button>';
          }
          html += '</div>';
        } else {
          html += '<div style="font-weight:600;color:var(--color-success);">Total entregado: ' + (m.qtyDelivered || 0) + ' ' + m.unit + '</div>';
        }

        html += '</div>';
        return html;
      }).join('');
    }

    var html = '<div class="modal-overlay" id="deliver-modal"><div class="modal modal-lg">' +
      '<div class="modal-header">' +
      '<div><h3>' + Utils.escapeHtml(wo.number) + ' (Gestión de Materiales)</h3>' +
      '<div style="font-size:0.786rem;color:var(--text-muted);">' + Utils.escapeHtml(wo.description.substring(0, 60)) + (wo.description.length > 60 ? '...' : '') + '</div>' +
      '</div>' +
      '<button class="modal-close" id="dlv-close">✕</button>' +
      '</div>' +
      '<div class="modal-body">' +
      '<div class="alert-banner info" style="margin-bottom:16px;">ℹ️ ' +
      (isCompleted ? 'Esta OT ya fue cerrada. El historial de materiales no se puede modificar.' : 'Registra entregas parciales y devoluciones en tiempo real. El stock se actualiza inmediatamente.') +
      '</div>' +
      (!isCompleted ? 
      '<div class="form-group" style="background:var(--bg-elevated);padding:12px;border-radius:8px;margin-bottom:16px;">' +
      '<label>➕ Añadir Repuesto Extra a la OT</label>' +
      '<div style="display:grid;grid-template-columns:1fr auto auto auto;gap:6px;margin-top:4px;align-items:center;">' +
      '<select class="form-select" id="dlv-extra-item">' +
      '<option value="">Buscar repuesto...</option>' +
      DB.getAll('items').map(function (i) { return '<option value="' + i.id + '">' + Utils.escapeHtml(i.code + ' — ' + i.name) + ' (Stock: ' + i.stock + ')</option>'; }).join('') +
      '</select>' +
      '<input type="number" id="dlv-extra-qty" class="form-input" min="1" value="1" style="width:70px;" placeholder="Cant.">' +
      '<select class="form-select" id="dlv-extra-mech" style="max-width:160px;">' +
      '<option value="">-- Mecánico --</option>' +
      DB.getAll('employees').filter(function(e){ return e.active && e.isTechnician; }).map(function(e){ return '<option value="' + e.id + '">' + Utils.escapeHtml(e.name) + '</option>'; }).join('') +
      '</select>' +
      '<button class="btn btn-cyan btn-sm" id="dlv-add-extra">+ Añadir</button>' +
      '</div></div>' : '') +
      '<div id="dlv-mats">' + buildMatHtml() + '</div>' +
      '<div class="divider"></div>' +
      '<div class="form-group"><label>Observaciones del técnico</label><textarea class="form-textarea" id="dlv-notes" rows="3" ' + (isCompleted ? 'disabled' : '') + '>' + Utils.escapeHtml(wo.notes || '') + '</textarea></div>' +
      '</div>' +
      '<div class="modal-footer">' +
      '<button class="btn btn-secondary" id="dlv-cancel">Cerrar Ventana</button>' +
      (!isCompleted ?
        '<button class="btn btn-warning" id="dlv-pause">⏳ Pausar (Falta Repuesto)</button>' +
        '<button class="btn btn-success" id="dlv-close-ot">✅ Finalizar OT</button>' : '') +
      '</div>' +
      '</div></div>';

    document.body.insertAdjacentHTML('beforeend', html);
    var ov = document.getElementById('deliver-modal');

    function close() { ov.remove(); }
    document.getElementById('dlv-close').onclick = close;
    document.getElementById('dlv-cancel').onclick = close;
    ov.onclick = function (e) { if (e.target === ov) close(); };

    if (!isCompleted) {
      var btnExtra = document.getElementById('dlv-add-extra');
      if (btnExtra) {
        btnExtra.onclick = function() {
          var sel = document.getElementById('dlv-extra-item');
          var qty = parseFloat(document.getElementById('dlv-extra-qty').value) || 0;
          var mechSel = document.getElementById('dlv-extra-mech');
          var mechId = mechSel ? mechSel.value : null;
          var iId = sel.value;

          if (!iId) { Utils.toast('Selecciona un repuesto.', 'warning'); return; }
          if (qty <= 0) { Utils.toast('La cantidad debe ser mayor a 0.', 'error'); return; }
          if (!mechId) { Utils.toast('⚠️ Indica qué mecánico solicita este repuesto.', 'warning'); return; }

          var item = DB.getById('items', iId);
          if (!item) return;

          var existingIdx = wo.materials.findIndex(function(m) { return m.itemId === iId; });
          if (existingIdx !== -1) {
            wo.materials[existingIdx].qtyRequested += qty;
          } else {
            wo.materials.push({
              itemId: item.id,
              itemName: item.name,
              unit: item.unit || 'unidad',
              qtyRequested: qty,
              qtyDelivered: 0,
              delivered: false,
              requestedBy: mechId  // Mecánico que solicitó el repuesto
            });
          }

          DB.update('workOrders', woId, { materials: wo.materials });

          // Registrar log en el Muro de Actividad
          var settings2 = DB.getSettings();
          var mech = DB.getById('employees', mechId);
          var mechName = mech ? mech.name : 'Desconocido';
          WorkOrdersModule.addWOLog(
            woId,
            mechName + ' solicitó ' + qty + ' ' + item.unit + ' de "' + item.name + '"',
            settings2.activeUserId
          );

          Utils.toast('Repuesto añadido a la OT.', 'success');
          App.updateBadges();
          close();
          openDeliverModal(woId);
        };
      }

      document.getElementById('dlv-pause').onclick = function () {
        var notes = document.getElementById('dlv-notes').value.trim();
        DB.update('workOrders', woId, { status: 'esperando_repuestos', notes: notes });
        // Registrar log
        var settings3 = DB.getSettings();
        WorkOrdersModule.addWOLog(woId, 'OT pausada: Esperando repuestos.' + (notes ? ' Nota: ' + notes : ''), settings3.activeUserId);
        Utils.toast('OT pausada. En espera de repuestos.', 'warning');
        close(); render(); App.updateBadges();
      };

      document.getElementById('dlv-close-ot').onclick = function () {
        var currentWo = DB.getById('workOrders', woId);
        if (!currentWo) return;

        if (!currentWo.assignedTo) {
          Utils.toast('⚠️ Operación bloqueada: La OT debe tener un técnico asignado para ser finalizada.', 'warning');
          return;
        }

        // Poka-Yoke: Si es preventiva, el horómetro es crítico para resetear la rutina
        if (currentWo.isPreventive) {
          var horaInicial = currentWo.vehicleHours || 0;
          // La advertencia se mostrará en el modal de cierre financiero
        }

        var hasPending = (currentWo.materials || []).some(function (m) { return (m.qtyDelivered || 0) < m.qtyRequested; });
        showFinancialCloseModal(currentWo, hasPending, function (finData) {
          var notes = document.getElementById('dlv-notes') ? document.getElementById('dlv-notes').value.trim() : '';
          var settings4 = DB.getSettings();

          DB.update('workOrders', woId, {
            status: 'completada',
            closedAt: Utils.todayISO(),
            notes: notes,
            laborCost: finData.labor,
            externalCost: finData.external,
            laborHours: finData.hours || 0,
            materialBase: finData.matBase,
            totalCost: finData.total,
            laborEntries: finData.laborEntries || []  // Array multi-mecánico
          });

          // Registrar log de cierre con el equipo
          var teamStr = (finData.laborEntries || []).map(function(e){ return e.name + ' (' + e.hours + 'h)'; }).join(', ');
          WorkOrdersModule.addWOLog(
            woId,
            'OT Cerrada.' + (teamStr ? ' Equipo: ' + teamStr : '') + ' | Total: $' + Utils.fmtNum(finData.total),
            settings4.activeUserId
          );

          // ── Sincronizar rutina si es preventiva ──
          var closedWo = DB.getById('workOrders', woId);
          if (closedWo && closedWo.isPreventive) {
            WorkOrdersModule.syncRoutineOnClose(closedWo, finData.finalHours, Utils.todayISO());
            Utils.toast('✅ OT Preventiva finalizada. Rutina sincronizada automáticamente. ➰', 'success', 5000);
          } else {
            Utils.toast('✅ OT finalizada exitosamente.', 'success', 4000);
          }
          close(); render(); App.updateBadges();
        });

      };
    }
  }

  function showFinancialCloseModal(wo, hasPending, onConfirm) {
    var old = document.getElementById('fin-close-modal'); if (old) old.remove();

    var matBaseSum = (wo.materials || []).reduce(function (acc, m) { return Utils.dec.add(acc, m.totalBase || 0); }, 0);
    var settings = DB.getSettings();
    var baseHours = settings.monthlyWorkingHours || 220;

    // ── Construir lista inicial de mecánicos desde el activityLog ──
    var mechMap = {}; // { empId: { id, name, rate, hours } }

    // 1. Agregar el mecánico responsable principal
    var mainEmp = DB.getById('employees', wo.assignedTo);
    if (mainEmp) {
      var mainRate = (mainEmp.monthlySalary || 0) / baseHours;
      mechMap[mainEmp.id] = { id: mainEmp.id, name: mainEmp.name, rate: mainRate, hours: 0 };
    }

    // 2. Agregar mecánicos detectados en el activityLog
    var allEmps = DB.getAll('employees');
    (wo.activityLog || []).forEach(function(log) {
      if (log.userId && !mechMap[log.userId]) {
        var logEmp = allEmps.find(function(e){ return e.id === log.userId; });
        if (logEmp && logEmp.isTechnician) {
          var logRate = (logEmp.monthlySalary || 0) / baseHours;
          mechMap[logEmp.id] = { id: logEmp.id, name: logEmp.name, rate: logRate, hours: 0 };
        }
      }
    });

    // 3. Agregar quien solicitó repuestos extra
    (wo.materials || []).forEach(function(m) {
      if (m.requestedBy && !mechMap[m.requestedBy]) {
        var reqEmp = allEmps.find(function(e){ return e.id === m.requestedBy; });
        if (reqEmp) {
          var reqRate = (reqEmp.monthlySalary || 0) / baseHours;
          mechMap[reqEmp.id] = { id: reqEmp.id, name: reqEmp.name, rate: reqRate, hours: 0 };
        }
      }
    });

    var mechList = Object.values(mechMap); // Array de mecánicos detectados

    function buildMechRows() {
      if (!mechList.length) return '<p class="text-muted text-sm">No se detectó ningún técnico. Agrega uno manualmente.</p>';
      return mechList.map(function(m, i) {
        var rateStr = m.rate > 0 ? '$ ' + Utils.fmtNum(Math.round(m.rate)) + '/hr' : 'Sin sueldo';
        return '<div style="display:grid;grid-template-columns:1fr auto auto auto;gap:8px;align-items:center;padding:8px;background:var(--bg-elevated);border-radius:8px;margin-bottom:6px;" id="mech-row-' + i + '">' +
          '<div><div style="font-weight:600;font-size:0.875rem;">' + Utils.escapeHtml(m.name) + '</div>' +
          '<div class="text-xs text-muted">' + rateStr + '</div></div>' +
          '<div><input type="number" id="mech-hours-' + i + '" min="0" step="0.5" value="0" class="form-input" style="width:80px;" placeholder="Hrs" oninput="WorkshopModule._updateMechCost(' + i + ',' + m.rate + ')"></div>' +
          '<div id="mech-cost-' + i + '" style="font-weight:700;color:var(--color-success);min-width:80px;text-align:right;">$ 0</div>' +
          '<button onclick="WorkshopModule._removeMechRow(' + i + ')" style="background:none;border:none;color:var(--color-danger);cursor:pointer;font-size:1rem;">✕</button>' +
          '</div>';
      }).join('');
    }

    var availableTechs = allEmps.filter(function(e){ return e.active && e.isTechnician && !mechMap[e.id]; });

    var html = '<div class="modal-overlay" id="fin-close-modal" style="z-index:9999;"><div class="modal modal-lg">' +
      '<div class="modal-header"><h3>Cierre Financiero: ' + Utils.escapeHtml(wo.number) + '</h3><button class="modal-close" id="fin-close-x">✕</button></div>' +
      '<div class="modal-body">' +
      (hasPending ? '<div class="alert-banner warning" style="margin-bottom:16px;">⚠️ Hay materiales sin entregar en su totalidad.</div>' : '') +
      // Horómetro para preventivas
      (wo.isPreventive ? '<div class="form-group"><label style="color:var(--color-warning);font-weight:700;">📏 Horómetro Final (Horas) * <span style="font-size:0.7rem;font-weight:400;">(Obligatorio para actualizar la rutina)</span></label><input class="form-input" type="number" min="' + (wo.vehicleHours || 0) + '" step="0.1" id="fin-horometro-final" value="' + (wo.vehicleHours || 0) + '"></div>' : '') +
      // Tabla de mecánicos
      '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:10px;padding:16px;margin-bottom:16px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">' +
      '<h4 style="margin:0;">👥 Mano de Obra por Mecánico</h4>' +
      (availableTechs.length ? '<div style="display:flex;gap:6px;align-items:center;">' +
        '<select class="form-select" id="fin-add-mech" style="font-size:0.8rem;">' +
        '<option value="">➕ Agregar otro mecánico...</option>' +
        availableTechs.map(function(e){ return '<option value="' + e.id + '">' + Utils.escapeHtml(e.name) + '</option>'; }).join('') +
        '</select>' +
        '<button class="btn btn-primary btn-sm" id="fin-add-mech-btn">Agregar</button>' +
        '</div>' : '') +
      '</div>' +
      '<div id="fin-mech-list">' + buildMechRows() + '</div>' +
      '</div>' +
      // Subtotales
      '<div class="form-grid">' +
      '<div class="form-group"><label>Subtotal Repuestos</label><input class="form-input" type="text" disabled value="$ ' + Utils.fmtNum(matBaseSum) + '"></div>' +
      '<div class="form-group"><label>Servicios Externos ($)</label><input class="form-input" type="number" min="0" id="fin-ext" value="0" oninput="WorkshopModule._updateFinTotal()"></div>' +
      '</div>' +
      '<div id="fin-total-pre" style="margin-top:16px;padding:16px;background:var(--bg-elevated);border-radius:8px;">' +
      '<div class="text-xs text-muted">RESUMEN FINAL:</div>' +
      '<div id="fin-total-breakdown" style="margin-top:8px;font-size:0.82rem;color:var(--text-secondary);"></div>' +
      '<div id="fin-total-amount" style="font-weight:800;font-size:1.3rem;color:var(--color-success);margin-top:6px;">TOTAL: $ ' + Utils.fmtNum(matBaseSum) + '</div>' +
      '</div>' +
      '</div>' +
      '<div class="modal-footer"><button class="btn btn-secondary" id="fin-cancel">Cancelar</button><button class="btn btn-success" id="fin-confirm">✅ Guardar y Cerrar OT</button></div>' +
      '</div></div>';

    document.body.insertAdjacentHTML('beforeend', html);
    var ov = document.getElementById('fin-close-modal');

    // Guardar mechList en el módulo para acceso desde _removeMechRow y _updateMechCost
    WorkshopModule._mechList = mechList;
    WorkshopModule._matBaseSum = matBaseSum;
    WorkshopModule._baseHours = baseHours;

    // Agregar mecánico extra
    var addMechBtn = document.getElementById('fin-add-mech-btn');
    if (addMechBtn) {
      addMechBtn.onclick = function() {
        var selEl = document.getElementById('fin-add-mech');
        var empId = selEl ? selEl.value : '';
        if (!empId) { Utils.toast('Selecciona un mecánico.', 'warning'); return; }
        var emp = DB.getById('employees', empId);
        if (!emp) return;

        // ── Anti-duplicado: verificar si ya está en la lista ──
        var yaExiste = mechList.some(function(m) { return m.id === emp.id; });
        if (yaExiste) {
          Utils.toast('⚠️ ' + emp.name + ' ya está en la lista de mano de obra.', 'warning');
          selEl.value = ''; // Limpiar selección
          return;
        }

        mechList.push({ id: emp.id, name: emp.name, rate: (emp.monthlySalary || 0) / (settings.monthlyWorkingHours || 220), hours: 0 });
        WorkshopModule._mechList = mechList;

        // Remover del selector para no poder agregarlo doble
        var optToRemove = selEl.querySelector('option[value="' + emp.id + '"]');
        if (optToRemove) optToRemove.remove();
        selEl.value = '';

        document.getElementById('fin-mech-list').innerHTML = buildMechRows();
        WorkshopModule._updateFinTotal();
      };
    }


    WorkshopModule._updateFinTotal = function() {
      var totalLabor = 0;
      var breakdown = '';
      mechList.forEach(function(m, i) {
        var hEl = document.getElementById('mech-hours-' + i);
        var h = hEl ? (parseFloat(hEl.value) || 0) : 0;
        var cost = Utils.dec.round(Utils.dec.mul(h, m.rate), 0);
        totalLabor = Utils.dec.add(totalLabor, cost);
        breakdown += '<span style="margin-right:12px;">' + Utils.escapeHtml(m.name) + ': ' + h + 'h = $ ' + Utils.fmtNum(cost) + '</span>';
      });
      var ext = parseFloat((document.getElementById('fin-ext') || {}).value) || 0;
      var total = Utils.dec.add(matBaseSum, Utils.dec.add(totalLabor, ext));
      var breakEl = document.getElementById('fin-total-breakdown');
      var amtEl = document.getElementById('fin-total-amount');
      if (breakEl) breakEl.innerHTML = breakdown;
      if (amtEl) amtEl.textContent = 'TOTAL: $ ' + Utils.fmtNum(total);
    };

    WorkshopModule._updateMechCost = function(i, rate) {
      var hEl = document.getElementById('mech-hours-' + i);
      var h = hEl ? (parseFloat(hEl.value) || 0) : 0;
      var cost = Utils.dec.round(Utils.dec.mul(h, rate), 0);
      var costEl = document.getElementById('mech-cost-' + i);
      if (costEl) costEl.textContent = '$ ' + Utils.fmtNum(cost);
      WorkshopModule._updateFinTotal();
    };

    WorkshopModule._removeMechRow = function(i) {
      mechList.splice(i, 1);
      WorkshopModule._mechList = mechList;
      document.getElementById('fin-mech-list').innerHTML = buildMechRows();
      WorkshopModule._updateFinTotal();
    };

    function closeFin() { ov.remove(); }
    document.getElementById('fin-close-x').onclick = closeFin;
    document.getElementById('fin-cancel').onclick = closeFin;

    document.getElementById('fin-confirm').onclick = function () {
      var horoFinalEl = document.getElementById('fin-horometro-final');
      var horoFinal = horoFinalEl ? (parseFloat(horoFinalEl.value) || 0) : 0;
      var ext = parseInt((document.getElementById('fin-ext') || {}).value) || 0;

      if (ext < 0) { Utils.toast('Los costos no pueden ser negativos.', 'error'); return; }

      if (wo.isPreventive && horoFinal <= (wo.vehicleHours || 0)) {
        Utils.toast('⚠️ Para OTs preventivas, el Horómetro Final debe ser mayor al inicial (' + (wo.vehicleHours || 0) + ' hrs).', 'warning');
        return;
      }

      // Recolectar entradas de labor
      var laborEntries = [];
      var totalLabor = 0;
      mechList.forEach(function(m, i) {
        var hEl = document.getElementById('mech-hours-' + i);
        var h = parseFloat(hEl ? hEl.value : 0) || 0;
        var cost = Utils.dec.round(Utils.dec.mul(h, m.rate), 0);
        laborEntries.push({ employeeId: m.id, name: m.name, hours: h, cost: cost });
        totalLabor = Utils.dec.add(totalLabor, cost);
      });

      if (totalLabor === 0 && !window.confirm('¿Seguro que el costo de mano de obra es $0?')) return;

      var total = Utils.dec.add(matBaseSum, Utils.dec.add(totalLabor, ext));

      closeFin();
      onConfirm({
        laborEntries: laborEntries,
        labor: totalLabor,
        external: ext,
        matBase: matBaseSum,
        total: total,
        finalHours: horoFinal
      });
    };
  }

  function resetFilters() {
    searchText = '';
    filterMode = 'all';
    render();
  }

  return {
    render: render,
    acceptOT: acceptOT,
    openDeliverModal: openDeliverModal,
    _doAction: _doAction,
    resetFilters: resetFilters,
    _updateMechCost: function(i, rate) { if (WorkshopModule._updateMechCost) WorkshopModule._updateMechCost(i, rate); },
    _removeMechRow: function(i) { if (WorkshopModule._removeMechRow) WorkshopModule._removeMechRow(i); },
    _updateFinTotal: function() { if (WorkshopModule._updateFinTotal) WorkshopModule._updateFinTotal(); }
  };

})();
