/* ============================================================
   WORKORDERS.JS — Work Orders module — Kanban + Wizard
   ============================================================ */

var WorkOrdersModule = (function () {
  'use strict';

  var filterStatus = '', filterPriority = '', filterVehicle = '', searchText = '';
  var viewMode = 'kanban'; // 'kanban' | 'list'

  // ── Wizard state ───────────────────────────────────────────
  var wizStep = 1;
  var wizData = {};
  var wizMats = [];

  function render() {
    try {
      var wos = getFiltered();
      var container = document.getElementById('section-workorders');
      if (!container) { console.error("NO SE ENCONTRÓ EL CONTENEDOR section-workorders"); return; }

      // 1. Si no hay cabecera iniciada, renderizamos estructura base
      var header = container.querySelector('.section-header');
      if (!header) {
        container.innerHTML =
          '<div class="section-header">' +
          '<div class="section-header-left"><h2>🔧 Órdenes de Trabajo</h2></div>' +
          '<div class="flex gap-2">' +
          '<div class="view-toggle">' +
          '<button class="view-btn ' + (viewMode === 'kanban' ? 'active' : '') + '" id="wo-vkb" title="Kanban">⬛ Kanban</button>' +
          '<button class="view-btn ' + (viewMode === 'list' ? 'active' : '') + '" id="wo-vls" title="Lista">☰ Lista</button>' +
          '</div>' +
          '<button class="btn btn-secondary btn-sm" id="wo-export">📤 Exportar Excel</button>' +
          '<button class="btn btn-primary" id="wo-new">+ Nueva OT</button>' +
          '</div>' +
          '</div>' +
          '<div class="toolbar">' +
          '<div class="search-bar"><span>🔍</span><input type="text" placeholder="Buscar OT..." id="wo-search" value="' + Utils.escapeHtml(searchText) + '"></div>' +
          '<select class="filter-select" id="wo-fstatus"><option value="">Todos los estados</option>' +
          Object.keys(Utils.OT_STATUS).map(function (k) { return '<option value="' + k + '"' + (filterStatus === k ? ' selected' : '') + '>' + Utils.OT_STATUS[k].label + '</option>'; }).join('') +
          '</select>' +
          '<select class="filter-select" id="wo-fprio"><option value="">Todas las prioridades</option>' +
          '<option value="alta"' + (filterPriority === 'alta' ? ' selected' : '') + '>🔴 Alta</option>' +
          '<option value="media"' + (filterPriority === 'media' ? ' selected' : '') + '>🟡 Media</option>' +
          '<option value="baja"' + (filterPriority === 'baja' ? ' selected' : '') + '>🟢 Baja</option>' +
          '</select>' +
          '<select class="filter-select" id="wo-fveh"><option value="">Todos los vehículos</option>' +
          DB.getAll('vehicles').filter(function (v) { return v.active; }).map(function (v) {
            return '<option value="' + v.id + '"' + (filterVehicle === v.id ? ' selected' : '') + '>' + Utils.escapeHtml(v.plate + ' — ' + v.brand + ' ' + v.model) + '</option>';
          }).join('') +
          '</select>' +
          '<span id="wo-counter" class="text-secondary text-sm">' + wos.length + ' órdenes</span>' +
          '</div>' +
          '<div id="wo-dynamic-content"></div>';

        // Bind events once
        document.getElementById('wo-new').onclick = function () { wizStep = 1; wizData = {}; wizMats = []; showWizard(); };
        document.getElementById('wo-export').onclick = exportExcel;
        document.getElementById('wo-vkb').onclick = function () { viewMode = 'kanban'; render(); };
        document.getElementById('wo-vls').onclick = function () { viewMode = 'list'; render(); };

        var si = document.getElementById('wo-search');
        if (si) si.oninput = Utils.debounce(function () { searchText = si.value; render(); }, 250);
        var fs = document.getElementById('wo-fstatus');
        if (fs) fs.onchange = function () { filterStatus = fs.value; render(); };
        var fp = document.getElementById('wo-fprio');
        if (fp) fp.onchange = function () { filterPriority = fp.value; render(); };
        var fv = document.getElementById('wo-fveh');
        if (fv) fv.onchange = function () { filterVehicle = fv.value; render(); };
      }

      // 2. Actualizar solo el contenido dinámico y el contador
      var dyn = document.getElementById('wo-dynamic-content');
      var counter = document.getElementById('wo-counter');
      if (dyn) dyn.innerHTML = (viewMode === 'kanban') ? renderKanban(wos) : renderList(wos);
      if (counter) counter.innerText = wos.length + ' órdenes';

      // Actualizar estado de botones view-toggle
      var bkb = document.getElementById('wo-vkb');
      var bls = document.getElementById('wo-vls');
      if (bkb) bkb.classList.toggle('active', viewMode === 'kanban');
      if (bls) bls.classList.toggle('active', viewMode === 'list');

    } catch (e) {
      console.error('WorkOrdersModule.render Error Ocurrido:', e);
      var container = document.getElementById('section-workorders');
      if (container) container.innerHTML = '<div style="color:red;padding:20px;">' + e.toString() + '<br>' + e.stack + '</div>';
    }
  }

  // ── KANBAN VIEW ───────────────────────────────────────────
  function renderKanban(wos) {
    var columns = [
      { key: 'borrador', label: '📝 Borrador', color: '#64748b' },
      { key: 'emitida', label: '📨 Emitidas', color: '#3b82f6' },
      { key: 'en_proceso', label: '⚙️ En Proceso', color: '#f59e0b' },
      { key: 'esperando_repuestos', label: '⏳ Falta Repuesto', color: '#ef4444' },
      { key: 'completada', label: '✅ Completadas', color: '#10b981' },
    ];

    var emps = DB.getAll('employees');
    var eMap = {}; emps.forEach(function (e) { eMap[e.id] = e; });

    var html = '<div class="kanban-board">';
    columns.forEach(function (col) {
      var colWOs = wos.filter(function (w) { return w.status === col.key; });
      html += '<div class="kanban-col">' +
        '<div class="kanban-col-header" style="border-top:3px solid ' + col.color + ';">' +
        '<span class="kanban-col-title">' + col.label + '</span>' +
        '<span class="kanban-col-count" style="background:' + col.color + ';">' + colWOs.length + '</span>' +
        '</div>';
      if (!colWOs.length) {
        html += '<div class="kanban-empty">Sin órdenes</div>';
      } else {
        colWOs.forEach(function (wo) {
          var tech = eMap[wo.assignedTo];
          var matTotal = (wo.materials || []).length;
          var matDel = (wo.materials || []).filter(function (m) { return m.delivered; }).length;
          html += '<div class="kanban-card" style="border-left:3px solid ' + col.color + ';">' +
            '<div class="kanban-card-header">' +
            '<span class="kanban-card-num">' + Utils.escapeHtml(wo.number) + '</span>' +
            Utils.priorityBadge(wo.priority) +
            '</div>' +
            '<div style="margin-bottom:6px;">' + Utils.maintenanceTypeBadge(wo.maintenanceType || (wo.isPreventive ? 'preventivo' : 'correctivo')) + '</div>' +
            (wo.vehiclePlate ? '<div class="kanban-card-vehicle">🚗 ' + Utils.escapeHtml(wo.vehiclePlate) + '</div>' : '') +
            '<div class="kanban-card-desc">' + Utils.escapeHtml(wo.description.substring(0, 70)) + (wo.description.length > 70 ? '...' : '') + '</div>' +
            '<div class="kanban-card-footer">' +
            '<span class="text-xs text-muted">' + (tech ? '👤 ' + Utils.escapeHtml(tech.name) : 'Sin asignar') + '</span>' +
            (matTotal > 0 ? '<span class="badge ' + (matDel === matTotal ? 'badge-green' : 'badge-gray') + '">📦 ' + matDel + '/' + matTotal + '</span>' : '') +
            '</div>' +
            '<div class="kanban-card-actions">' +
            '<button class="btn btn-ghost btn-sm" onclick="WorkOrdersModule.showDetail(\'' + Utils.escapeHtml(wo.id) + '\')">👁️ Ver</button>' +
            '<button class="btn btn-ghost btn-sm" onclick="WorkOrdersModule.printWO(\'' + Utils.escapeHtml(wo.id) + '\')">🖨️</button>' +
            (wo.status === 'borrador' || wo.status === 'emitida' ? '<button class="btn btn-ghost btn-sm" onclick="WorkOrdersModule.showEditModal(\'' + Utils.escapeHtml(wo.id) + '\')">✏️</button>' : '') +
            (wo.status !== 'completada' && wo.status !== 'cancelada' ? '<button class="btn btn-ghost btn-sm" onclick="WorkOrdersModule.cancelWO(\'' + Utils.escapeHtml(wo.id) + '\')" title="Anular OT">❌</button>' : '') +
            '<button class="btn btn-ghost btn-sm" onclick="WorkOrdersModule.deleteWO(\'' + Utils.escapeHtml(wo.id) + '\')">🗑️</button>' +
            '</div>' +
            '</div>';
        });
      }
      html += '</div>';
    });
    html += '</div>';
    return html;
  }

  // ── LIST VIEW ─────────────────────────────────────────────
  function renderList(wos) {
    var emps = DB.getAll('employees');
    var eMap = {}; emps.forEach(function (e) { eMap[e.id] = e; });
    if (!wos.length) {
      return '<div class="card"><div class="empty-state"><div class="empty-state-icon">🔧</div><h3>No hay órdenes de trabajo</h3><p>Crea la primera OT usando el botón superior.</p></div></div>';
    }
    return '<div class="card" style="padding:0;"><div class="table-wrapper"><table><thead><tr>' +
      '<th>Número</th><th>Fecha</th><th>Tipo</th><th>Vehículo</th><th>Descripción</th><th>Prioridad</th><th>Estado</th><th>Técnico</th><th>Materiales</th><th>Acciones</th>' +
      '</tr></thead><tbody>' +
      wos.map(function (wo) {
        var tech = eMap[wo.assignedTo];
        var matCount = (wo.materials || []).length;
        var matDel = (wo.materials || []).filter(function (m) { return m.delivered; }).length;
        return '<tr>' +
          '<td><span style="font-weight:700;color:var(--accent-cyan);">' + Utils.escapeHtml(wo.number) + '</span></td>' +
          '<td>' + Utils.formatDate(wo.date) + '</td>' +
          '<td>' + Utils.maintenanceTypeBadge(wo.maintenanceType || (wo.isPreventive ? 'preventivo' : 'correctivo')) + '</td>' +
          '<td>' + VehiclesModule.getVehicleLabel(wo.vehicleId, wo.vehiclePlate, wo.vehicleName) + '</td>' +
          '<td style="max-width:180px;"><div class="truncate">' + Utils.escapeHtml(wo.description) + '</div></td>' +
          '<td>' + Utils.priorityBadge(wo.priority) + '</td>' +
          '<td>' + Utils.otStatusBadge(wo.status) + '</td>' +
          '<td>' + (tech ? '<div class="flex items-center gap-2"><div class="user-avatar" style="width:26px;height:26px;font-size:0.65rem;">' + (tech.initials || tech.name.charAt(0)) + '</div>' + Utils.escapeHtml(tech.name) + '</div>' : '<span class="text-muted">Sin asignar</span>') + '</td>' +
          '<td><span class="badge ' + (matDel === matCount && matCount > 0 ? 'badge-green' : 'badge-gray') + '">' + matDel + '/' + matCount + ' entregados</span></td>' +
          '<td><div class="table-actions">' +
          '<button class="btn btn-ghost btn-sm" onclick="WorkOrdersModule.showDetail(\'' + Utils.escapeHtml(wo.id) + '\')">👁️</button>' +
          '<button class="btn btn-ghost btn-sm" onclick="WorkOrdersModule.printWO(\'' + Utils.escapeHtml(wo.id) + '\')">🖨️</button>' +
          (wo.status === 'borrador' || wo.status === 'emitida' ? '<button class="btn btn-ghost btn-sm" onclick="WorkOrdersModule.showEditModal(\'' + Utils.escapeHtml(wo.id) + '\')">✏️</button>' : '') +
          (wo.status !== 'completada' && wo.status !== 'cancelada' ? '<button class="btn btn-ghost btn-sm" onclick="WorkOrdersModule.cancelWO(\'' + Utils.escapeHtml(wo.id) + '\')" title="Anular OT">❌</button>' : '') +
          '<button class="btn btn-ghost btn-sm" onclick="WorkOrdersModule.deleteWO(\'' + Utils.escapeHtml(wo.id) + '\')">🗑️</button>' +
          '</div></td></tr>';
      }).join('') +
      '</tbody></table></div>' +
      '<div class="p-4 text-center">' +
      '<button class="btn btn-ghost" onclick="App.loadMore(\'workOrders\')">🔄 Cargar registros anteriores</button>' +
      '</div>' +
      '<div class="pagination"><span>' + wos.length + ' órdenes cargadas</span></div></div>';
  }

  // ── WIZARD ────────────────────────────────────────────────
  function showWizard(preloadVehicleId, prefillData) {
    if (preloadVehicleId) { wizData.vehicleId = preloadVehicleId; }
    // Si viene de una rutina preventiva, pre-cargar datos
    if (prefillData) {
      wizData.routineId = prefillData.routineId || null;
      wizData.routineName = prefillData.routineName || null;
      wizData.isPreventive = prefillData.isPreventive || false;
      wizData.maintenanceType = prefillData.isPreventive ? 'preventivo' : (prefillData.maintenanceType || 'correctivo');
      if (prefillData.priority) wizData.priority = prefillData.priority;
      if (prefillData.routineName) {
        wizData.description = 'Mantenimiento Preventivo: ' + prefillData.routineName;
      }
    }
    var old = document.getElementById('wiz-modal'); if (old) old.remove();

    var html = '<div class="modal-overlay" id="wiz-modal"><div class="modal modal-lg">' +
      '<div class="modal-header">' +
      '<h3>+ Nueva Orden de Trabajo</h3>' +
      '<button class="modal-close" id="wiz-close">✕</button>' +
      '</div>' +
      '<div class="modal-body">' +
      // Step indicators
      '<div class="wizard-steps">' +
      stepDot(1, 'Vehículo') +
      '<div class="wizard-line ' + (wizStep > 1 ? 'active' : '') + '"></div>' +
      stepDot(2, 'Trabajo') +
      '<div class="wizard-line ' + (wizStep > 2 ? 'active' : '') + '"></div>' +
      stepDot(3, 'Materiales') +
      '</div>' +
      '<div id="wiz-step-content"></div>' +
      '</div>' +
      '<div class="modal-footer" id="wiz-footer"></div>' +
      '</div></div>';

    document.body.insertAdjacentHTML('beforeend', html);
    var ov = document.getElementById('wiz-modal');
    document.getElementById('wiz-close').onclick = function () { ov.remove(); };
    ov.onclick = function (e) { if (e.target === ov) ov.remove(); };

    renderWizStep();
  }

  function stepDot(n, label) {
    var cls = wizStep === n ? 'active' : (wizStep > n ? 'done' : '');
    return '<div class="wizard-dot-wrap">' +
      '<div class="wizard-dot ' + cls + '">' + (wizStep > n ? '✓' : n) + '</div>' +
      '<div class="wizard-dot-label">' + label + '</div>' +
      '</div>';
  }

  function renderWizStep() {
    var content = document.getElementById('wiz-step-content');
    var footer = document.getElementById('wiz-footer');
    if (!content) return;

    if (wizStep === 1) {
      var vehicles = DB.getAll('vehicles').filter(function (v) { return v.active; });
      var isPreventiveBanner = wizData.isPreventive
        ? '<div class="alert-banner warning" style="margin-bottom:16px;border-left:4px solid var(--color-warning);">🔧 <strong>OT de Mantenimiento Preventivo</strong> — Rutina: <strong>' + Utils.escapeHtml(wizData.routineName || '') + '</strong></div>'
        : '';
      content.innerHTML =
        '<h4 style="margin-bottom:16px;">Paso 1: Selecciona el Vehículo</h4>' +
        isPreventiveBanner +
        '<div class="form-group"><label>Fecha de la OT</label><input class="form-input" type="date" id="wf-date" value="' + (wizData.date || Utils.todayISO()) + '"></div>' +
        '<div class="form-group"><label>Vehículo</label>' +
        '<select class="form-select" id="wf-veh" onchange="WorkOrdersModule.updateWizKm(this)">' +
        '<option value="">Sin vehículo asignado</option>' +
        vehicles.map(function (v) {
          return '<option value="' + v.id + '"' + (wizData.vehicleId === v.id ? ' selected' : '') +
            ' data-plate="' + Utils.escapeHtml(v.plate) + '"' +
            ' data-km="' + (v.hours || 0) + '"' +
            ' data-name="' + Utils.escapeHtml(v.brand + ' ' + v.model + ' ' + v.year) + '">' +
            Utils.escapeHtml(v.plate + ' — ' + v.brand + ' ' + v.model + ' (' + v.year + ')') +
            '</option>';
        }).join('') +
        '</select>' +
        '</div>' +
        '<div class="form-group"><label>Horómetro al Ingreso (Horas)</label><input class="form-input" type="number" id="wf-km-entry" min="0" value="' + (wizData.vehicleHours || 0) + '"></div>';
      footer.innerHTML =
        '<button class="btn btn-secondary" id="wiz-close2">Cancelar</button>' +
        '<button class="btn btn-primary" id="wiz-next1">Siguiente → Paso 2</button>';
      document.getElementById('wiz-close2').onclick = function () { document.getElementById('wiz-modal').remove(); };
      document.getElementById('wiz-next1').onclick = function () {
        wizData.date = document.getElementById('wf-date').value || Utils.todayISO();
        var sel = document.getElementById('wf-veh');
        
        if (!sel.value) {
          Utils.toast('⚠️ Operación bloqueada: Debes seleccionar un vehículo.', 'warning');
          return;
        }
        
        wizData.vehicleId = sel.value;
        var vHours = parseFloat(document.getElementById('wf-km-entry').value) || 0;
        
        if (vHours < 0) {
          Utils.toast('El horómetro no puede ser negativo.', 'error');
          return;
        }
        wizData.vehicleHours = vHours;

        if (sel.value) {
          var opt = sel.options[sel.selectedIndex];
          wizData.vehiclePlate = opt.getAttribute('data-plate');
          wizData.vehicleName = opt.getAttribute('data-name');
          // Actualizar horómetro del vehículo opcionalmente si es mayor
          var v = DB.getById('vehicles', sel.value);
          if (v && wizData.vehicleHours > (v.hours || 0)) {
            DB.update('vehicles', v.id, { hours: wizData.vehicleHours });
          }
        } else { wizData.vehiclePlate = null; wizData.vehicleName = null; }
        wizStep = 2; rebuildWiz();
      };
    } else if (wizStep === 2) {
      var users = DB.getAll('users');
      var techs = users.filter(function (u) { return u.role === 'taller'; });
      content.innerHTML =
        '<h4 style="margin-bottom:16px;">Paso 2: Describe el Trabajo</h4>' +
        '<div class="form-grid">' +
        '<div class="form-group"><label>Prioridad *</label><select class="form-select" id="wf-prio">' +
        '<option value="alta"' + (wizData.priority === 'alta' ? ' selected' : '') + '>🔴 Alta</option>' +
        '<option value="media"' + (!wizData.priority || wizData.priority === 'media' ? ' selected' : '') + '>🟡 Media</option>' +
        '<option value="baja"' + (wizData.priority === 'baja' ? ' selected' : '') + '>🟢 Baja</option>' +
        '</select></div>' +
        '<div class="form-group"><label>Tipo de Mantenimiento *</label>' +
        (wizData.maintenanceType === 'preventivo'
          ? '<div style="padding:8px 12px;background:var(--bg-elevated);border-radius:8px;border:1px solid var(--border);display:flex;align-items:center;gap:8px;">' +
            '<span class="badge badge-amber">📅 Preventivo</span>' +
            '<span class="text-xs text-muted">Pre-asignado desde alerta de rutina</span>' +
            '</div>'
          : '<select class="form-select" id="wf-maint-type">' +
            '<option value="correctivo"' + (!wizData.maintenanceType || wizData.maintenanceType === 'correctivo' ? ' selected' : '') + '>🛠️ Correctivo (Reparación)</option>' +
            '<option value="preventivo"' + (wizData.maintenanceType === 'preventivo' ? ' selected' : '') + '>📅 Preventivo (Programado)</option>' +
            '</select>') +
        '</div>' +
        '<div class="form-group"><label>Técnico Asignado</label><select class="form-select" id="wf-tech">' +
        '<option value="">Sin asignar</option>' +
        DB.getAll('employees').filter(function (e) { return e.active && e.isTechnician; }).map(function (e) {
          var positions = DB.getAll('positions');
          var pos = positions.find(function (p) { return p.id === e.positionId; });
          return '<option value="' + e.id + '"' + (wizData.assignedTo === e.id ? ' selected' : '') + '>' + Utils.escapeHtml(e.name + (pos ? ' (' + pos.name + ')' : '')) + '</option>';
        }).join('') +
        '</select></div>' +
        '<div class="form-group"><label>Estado Inicial</label><select class="form-select" id="wf-status">' +
        Object.keys(Utils.OT_STATUS).filter(function(k){ return k !== 'completada'; }).map(function (k) { return '<option value="' + k + '"' + ((!wizData.status && k === 'emitida') || wizData.status === k ? ' selected' : '') + '>' + Utils.OT_STATUS[k].label + '</option>'; }).join('') +
        '</select></div>' +
        '</div>' +

        '<div class="form-group span-2"><label>Descripción del trabajo *</label>' +
        '<textarea class="form-textarea" id="wf-desc" rows="4" placeholder="Describe detalladamente el trabajo a realizar...">' + Utils.escapeHtml(wizData.description || '') + '</textarea>' +
        '</div>' +
        '<div class="form-group span-2"><label>Observaciones</label>' +
        '<textarea class="form-textarea" id="wf-notes" rows="2" placeholder="Notas adicionales...">' + Utils.escapeHtml(wizData.notes || '') + '</textarea>' +
        '</div>';
      footer.innerHTML =
        '<button class="btn btn-secondary" id="wiz-prev2">← Volver</button>' +
        '<button class="btn btn-primary" id="wiz-next2">Siguiente → Paso 3</button>';
      document.getElementById('wiz-prev2').onclick = function () { wizStep = 1; rebuildWiz(); };
      document.getElementById('wiz-next2').onclick = function () {
        var desc = document.getElementById('wf-desc').value.trim();
        var tech = document.getElementById('wf-tech').value;
        
        if (!tech) {
          Utils.toast('⚠️ Operación bloqueada: Debes asignar un técnico responsable.', 'warning');
          return;
        }
        
        if (desc.length < 10) {
          Utils.toast('⚠️ Calidad de Información: Describe detalladamente el trabajo (mín. 10 caracteres).', 'warning');
          return;
        }

        wizData.priority = document.getElementById('wf-prio').value;
        // Leer tipo de mantenimiento: si ya era preventivo (bloqueado), mantenerlo;
        // si hay selector activo, leer su valor
        var maintTypeEl = document.getElementById('wf-maint-type');
        if (maintTypeEl) wizData.maintenanceType = maintTypeEl.value;
        wizData.assignedTo = document.getElementById('wf-tech').value || null;
        wizData.status = document.getElementById('wf-status').value;
        wizData.description = desc;
        wizData.notes = document.getElementById('wf-notes').value.trim();
        wizStep = 3; rebuildWiz();
      };
    } else if (wizStep === 3) {
      var items = DB.getAll('items');
      content.innerHTML =
        '<h4 style="margin-bottom:16px;">Paso 3: Materiales Requeridos (Opcional)</h4>' +
        '<div class="flex gap-2" style="margin-bottom:12px;">' +
        '<select class="form-select" id="wf-mat-item" style="flex:1;">' +
        '<option value="">Seleccionar artículo del inventario...</option>' +
        items.map(function (i) { return '<option value="' + i.id + '" data-name="' + Utils.escapeHtml(i.name) + '" data-unit="' + Utils.escapeHtml(i.unit) + '">' + Utils.escapeHtml(i.code + ' — ' + i.name) + ' (Stock: ' + i.stock + ')</option>'; }).join('') +
        '</select>' +
        '<input class="form-input" type="number" id="wf-mat-qty" min="1" value="1" style="width:80px;">' +
        '<button class="btn btn-cyan btn-sm" id="wf-add-mat">+ Agregar</button>' +
        '</div>' +
        '<div id="wf-mat-list"></div>';
      renderWizMatList();
      document.getElementById('wf-add-mat').onclick = function () {
        var sel = document.getElementById('wf-mat-item');
        var qty = parseFloat(document.getElementById('wf-mat-qty').value) || 0;
        var iId = sel.value;
        if (!iId) { Utils.toast('Selecciona un artículo.', 'warning'); return; }
        if (qty <= 0) { Utils.toast('La cantidad debe ser al menos 1.', 'error'); return; }
        var opt = sel.options[sel.selectedIndex];
        if (wizMats.find(function (m) { return m.itemId === iId; })) { Utils.toast('Artículo ya agregado.', 'warning'); return; }
        wizMats.push({ itemId: iId, itemName: opt.getAttribute('data-name'), unit: opt.getAttribute('data-unit'), qtyRequested: qty, qtyDelivered: 0, delivered: false });
        renderWizMatList();
        document.getElementById('wf-mat-qty').value = 1; sel.value = '';
      };
      footer.innerHTML =
        '<button class="btn btn-secondary" id="wiz-prev3">← Volver</button>' +
        '<button class="btn btn-success" id="wiz-save">💾 Crear Orden de Trabajo</button>';
      document.getElementById('wiz-prev3').onclick = function () { wizStep = 2; rebuildWiz(); };
      document.getElementById('wiz-save').onclick = saveWizard;
    }
  }

  function renderWizMatList() {
    var list = document.getElementById('wf-mat-list');
    if (!list) return;
    if (!wizMats.length) { list.innerHTML = '<p class="text-muted text-sm" style="padding:8px 0;">Sin materiales agregados. Puedes continuar sin materiales.</p>'; return; }
    list.innerHTML = wizMats.map(function (m, i) {
      return '<div class="material-item"><div class="mat-info"><div class="mat-name">' + Utils.escapeHtml(m.itemName) + '</div><div class="mat-qty">Cant: ' + m.qtyRequested + ' ' + Utils.escapeHtml(m.unit) + '</div></div>' +
        '<button class="btn btn-ghost btn-sm" onclick="WorkOrdersModule._rmMat(' + i + ')">🗑️</button></div>';
    }).join('');
  }

  function rebuildWiz() {
    var ov = document.getElementById('wiz-modal');
    if (!ov) return;
    // Update step indicators
    var stepsDiv = ov.querySelector('.wizard-steps');
    if (stepsDiv) {
      stepsDiv.innerHTML =
        stepDot(1, 'Vehículo') +
        '<div class="wizard-line ' + (wizStep > 1 ? 'active' : '') + '"></div>' +
        stepDot(2, 'Trabajo') +
        '<div class="wizard-line ' + (wizStep > 2 ? 'active' : '') + '"></div>' +
        stepDot(3, 'Materiales');
    }
    renderWizStep();
  }

  function saveWizard() {
    var settings = DB.getSettings();
    var currentUser = DB.getById('users', settings.activeUserId);
    var data = {
      number: DB.nextOTNumber(),
      date: wizData.date || Utils.todayISO(),
      priority: wizData.priority || 'media',
      assignedTo: wizData.assignedTo || null,
      status: wizData.status || 'emitida',
      description: wizData.description,
      notes: wizData.notes || '',
      materials: wizMats,
      vehicleId: wizData.vehicleId || null,
      vehiclePlate: wizData.vehiclePlate || null,
      vehicleName: wizData.vehicleName || null,
      vehicleHours: wizData.vehicleHours || 0,
      requesterId: settings.activeUserId,
      requesterName: currentUser ? currentUser.name : 'Sistema',
      laborCost: 0, externalCost: 0, totalCost: 0,
      closedAt: null,
      createdAt: Utils.todayISO(),
      // ── Tipo de Mantenimiento ──
      maintenanceType: wizData.maintenanceType || 'correctivo',
      isPreventive: (wizData.maintenanceType === 'preventivo') || (wizData.isPreventive || false),
      routineId: wizData.routineId || null,
      routineName: wizData.routineName || null
    };
    DB.create('workOrders', data);
    var msg = data.isPreventive
      ? '✅ OT Preventiva ' + data.number + ' creada. Ve a Vista Taller para gestionarla.'
      : '✅ OT ' + data.number + ' creada exitosamente.';
    Utils.toast(msg, 'success', 5000);
    document.getElementById('wiz-modal').remove();
    render(); App.updateBadges();
  }

  // ── Sincronización de Rutina al Completar OT Preventiva ────
  function syncRoutineOnClose(wo, finalHours, finalDate) {
    if (!wo.isPreventive || !wo.routineId) return;
    var routine = DB.getById('preventiveRoutines', wo.routineId);
    if (!routine) return;
    DB.update('preventiveRoutines', wo.routineId, {
      lastPerformedHours: finalHours,
      lastPerformedDate: finalDate
    });
    console.log('🔄 Rutina sincronizada: ' + routine.name + ' | Horas: ' + finalHours + ' | Fecha: ' + finalDate);
  }

  // ── Expose for inline onclick ──────────────────────────────
  function _rmMat(i) { wizMats.splice(i, 1); renderWizMatList(); }
  function updateWizKm(sel) {
    if (!sel.value) return;
    var opt = sel.options[sel.selectedIndex];
    var hours = opt.getAttribute('data-km');
    var input = document.getElementById('wf-km-entry');
    if (input) input.value = hours;
  }

  // ── Edit existing OT ──────────────────────────────────────
  function showEditModal(id) {
    var wo = DB.getById('workOrders', id);
    if (!wo) return;
    var users = DB.getAll('users');
    var techs = users.filter(function (u) { return u.role === 'taller'; });
    var old = document.getElementById('wo-edit-modal'); if (old) old.remove();

    var html = '<div class="modal-overlay" id="wo-edit-modal"><div class="modal modal-lg">' +
      '<div class="modal-header"><h3>✏️ Editar OT ' + Utils.escapeHtml(wo.number) + '</h3><button class="modal-close" id="woedit-close">✕</button></div>' +
      '<div class="modal-body"><div class="form-grid">' +
      '<div class="form-group"><label>Fecha</label><input class="form-input" type="date" id="woe-date" value="' + wo.date + '"></div>' +
      '<div class="form-group"><label>Prioridad</label><select class="form-select" id="woe-prio">' +
      '<option value="alta"' + (wo.priority === 'alta' ? ' selected' : '') + '>🔴 Alta</option>' +
      '<option value="media"' + (wo.priority === 'media' ? ' selected' : '') + '>🟡 Media</option>' +
      '<option value="baja"' + (wo.priority === 'baja' ? ' selected' : '') + '>🟢 Baja</option>' +
      '</select></div>' +
      '<div class="form-group"><label>Técnico</label><select class="form-select" id="woe-tech">' +
      '<option value="">Sin asignar</option>' +
      DB.getAll('employees').filter(function (e) { return e.active && e.isTechnician; }).map(function (e) {
        var positions = DB.getAll('positions');
        var pos = positions.find(function (p) { return p.id === e.positionId; });
        return '<option value="' + e.id + '"' + (wo.assignedTo === e.id ? ' selected' : '') + '>' + Utils.escapeHtml(e.name + (pos ? ' (' + pos.name + ')' : '')) + '</option>';
      }).join('') +
      '</select></div>' +
      '<div class="form-group"><label>Estado</label><select class="form-select" id="woe-status">' +
      Object.keys(Utils.OT_STATUS).filter(function(k){ return k !== 'completada'; }).map(function (k) { return '<option value="' + k + '"' + (wo.status === k ? ' selected' : '') + '>' + Utils.OT_STATUS[k].label + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="form-group span-2"><label>Descripción *</label><textarea class="form-textarea" id="woe-desc" rows="3">' + Utils.escapeHtml(wo.description) + '</textarea></div>' +
      '<div class="form-group span-2"><label>Observaciones</label><textarea class="form-textarea" id="woe-notes" rows="2">' + Utils.escapeHtml(wo.notes || '') + '</textarea></div>' +
      '</div></div>' +
      '<div class="modal-footer"><button class="btn btn-secondary" id="woedit-can">Cancelar</button><button class="btn btn-primary" id="woedit-sv">💾 Guardar</button></div>' +
      '</div></div>';

    document.body.insertAdjacentHTML('beforeend', html);
    var ov = document.getElementById('wo-edit-modal');
    function close() { ov.remove(); }
    document.getElementById('woedit-close').onclick = close;
    document.getElementById('woedit-can').onclick = close;
    ov.onclick = function (e) { if (e.target === ov) close(); };
    document.getElementById('woedit-sv').onclick = function () {
      var desc = document.getElementById('woe-desc').value.trim();
      if (!desc) { Utils.toast('La descripción es obligatoria.', 'warning'); return; }

      var newStatus = document.getElementById('woe-status').value;
      var newTech = document.getElementById('woe-tech').value;
      if ((newStatus === 'en_proceso' || newStatus === 'completada') && !newTech) {
        Utils.toast('⚠️ Operación bloqueada: Debes asignar un técnico responsable para poner la OT en proceso.', 'warning');
        return;
      }

      DB.update('workOrders', wo.id, {
        date: document.getElementById('woe-date').value || wo.date,
        priority: document.getElementById('woe-prio').value,
        assignedTo: document.getElementById('woe-tech').value || null,
        status: document.getElementById('woe-status').value,
        description: desc,
        notes: document.getElementById('woe-notes').value.trim()
      });
      Utils.toast('OT actualizada.', 'success');
      close(); render(); App.updateBadges();
    };
  }

  // ── Detail modal ──────────────────────────────────────────
  function showDetail(id) {
    var wo = DB.getById('workOrders', id);
    if (!wo) return;
    var tech = DB.getById('employees', wo.assignedTo);

    var flowSteps = ['borrador', 'emitida', 'en_proceso', 'completada'];
    var stepIdx = flowSteps.indexOf(wo.status);

    var flowHtml = '<div class="ot-flow">' + flowSteps.map(function (s, i) {
      var cls = i < stepIdx ? 'done' : (i === stepIdx ? 'active' : '');
      return (i > 0 ? '<span class="flow-sep">›</span>' : '') +
        '<div class="flow-step ' + cls + '">' + Utils.OT_STATUS[s].icon + ' ' + Utils.OT_STATUS[s].label + '</div>';
    }).join('') + '</div>';

    var matHtml = (wo.materials || []).length ? (wo.materials || []).map(function (m) {
      return '<div class="material-item ' + (m.delivered ? 'delivered' : '') + '">' +
        '<div class="mat-checkbox ' + (m.delivered ? 'checked' : '') + '"></div>' +
        '<div class="mat-info"><div class="mat-name">' + Utils.escapeHtml(m.itemName) + '</div>' +
        '<div class="mat-qty">Solicitado: ' + m.qtyRequested + ' ' + Utils.escapeHtml(m.unit) + (m.delivered ? ' | Entregado: ' + m.qtyDelivered : '') + '</div></div>' +
        '</div>';
    }).join('') : '<p class="text-muted text-sm">Sin materiales.</p>';

    var financialHtml = '';
    if (wo.status === 'completada') {
      var matSum = (wo.materials || []).reduce(function (acc, m) { return acc + (m.totalCost || 0); }, 0);
      financialHtml = '<div class="divider"></div><h4 style="margin-bottom:12px;color:var(--color-success);">💰 Costo Total OT</h4>' +
        '<div class="grid-3" style="background:var(--bg-elevated);padding:16px;border-radius:8px;">' +
        '<div><div class="text-xs text-muted">REPUESTOS</div><div class="font-medium">$ ' + Utils.fmtNum(matSum) + '</div></div>' +
        '<div><div class="text-xs text-muted">MANO DE OBRA</div><div class="font-medium">$ ' + Utils.fmtNum(wo.laborCost || 0) + '</div></div>' +
        '<div><div class="text-xs text-muted">EXTERNOS</div><div class="font-medium">$ ' + Utils.fmtNum(wo.externalCost || 0) + '</div></div>' +
        '<div style="grid-column:1/-1;margin-top:12px;padding-top:12px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">' +
        '<span style="font-weight:700;">TOTAL OT:</span>' +
        '<span style="font-weight:800;font-size:1.3rem;color:var(--color-success);">$ ' + Utils.fmtNum(wo.totalCost || 0) + '</span>' +
        '</div>' +
        '</div>';
    }

    var old = document.getElementById('wod-modal'); if (old) old.remove();
    var html = '<div class="modal-overlay" id="wod-modal"><div class="modal modal-lg">' +
      '<div class="modal-header">' +
      '<div><h3 style="color:var(--accent-cyan);">' + Utils.escapeHtml(wo.number) + '</h3>' +
      '<div style="font-size:0.786rem;color:var(--text-muted);">Emitida el ' + Utils.formatDate(wo.date) + '</div>' +
      '</div>' +
      '<div class="flex gap-2">' +
      (wo.status === 'en_proceso' ? '<button class="btn btn-success btn-sm" onclick="document.getElementById(\'wod-modal\').remove();WorkOrdersModule.showClosingWizard(\'' + Utils.escapeHtml(wo.id) + '\')">🏁 Finalizar y Cerrar Orden</button>' : '') +
      '<button class="btn btn-secondary btn-sm" onclick="Utils.printOT(DB.getById(\'workOrders\',\'' + Utils.escapeHtml(wo.id) + '\'))">🖨️ Imprimir</button>' +
      (wo.status === 'emitida' || wo.status === 'borrador' ? '<button class="btn btn-primary btn-sm" onclick="document.getElementById(\'wod-modal\').remove();WorkOrdersModule.showEditModal(\'' + Utils.escapeHtml(wo.id) + '\')">✏️ Editar</button>' : '') +
      '<button class="modal-close" id="wod-close">✕</button>' +
      '</div>' +
      '</div>' +
      '<div class="modal-body">' +
      flowHtml +
      '<div class="grid-2" style="margin-bottom:16px;">' +
      '<div><div class="text-xs text-muted">PRIORIDAD</div><div>' + Utils.priorityBadge(wo.priority) + '</div></div>' +
      '<div><div class="text-xs text-muted">ESTADO</div><div>' + Utils.otStatusBadge(wo.status) + '</div></div>' +
      '<div><div class="text-xs text-muted">TÉCNICO</div><div class="font-medium">' + (function () { var em = DB.getById('employees', wo.assignedTo); return em ? em.name : 'Sin asignar'; })() + '</div></div>' +
      '<div><div class="text-xs text-muted">SOLICITANTE</div><div class="font-medium">' + Utils.escapeHtml(wo.requesterName || '—') + '</div></div>' +
      (wo.vehiclePlate ? '<div class="span-2"><div class="text-xs text-muted">VEHÍCULO</div><div>' + VehiclesModule.getVehicleLabel(wo.vehicleId, wo.vehiclePlate, wo.vehicleName) + '</div></div>' : '') +
      (wo.closedAt ? '<div><div class="text-xs text-muted">CERRADA</div><div>' + Utils.formatDate(wo.closedAt) + '</div></div>' : '') +
      '</div>' +
      '<div class="divider"></div>' +
      '<h4 style="margin-bottom:8px;">Descripción</h4>' +
      '<p style="color:var(--text-secondary);line-height:1.7;margin-bottom:16px;">' + Utils.escapeHtml(wo.description) + '</p>' +
      '<h4 style="margin-bottom:8px;">Materiales</h4>' + matHtml +
      (wo.notes ? '<div class="divider"></div><h4 style="margin-bottom:8px;">Observaciones</h4><p class="text-secondary">' + Utils.escapeHtml(wo.notes) + '</p>' : '') +
      financialHtml +
      '</div>' +
      '</div></div>';

    document.body.insertAdjacentHTML('beforeend', html);
    var ov = document.getElementById('wod-modal');
    document.getElementById('wod-close').onclick = function () { ov.remove(); };
    ov.onclick = function (e) { if (e.target === ov) ov.remove(); };
  }

  // ── Filters & getFiltered ─────────────────────────────────
  function getFiltered() {
    var wos = DB.getAll('workOrders').slice().reverse();
    if (filterStatus) wos = wos.filter(function (w) { return w.status === filterStatus; });
    if (filterPriority) wos = wos.filter(function (w) { return w.priority === filterPriority; });
    if (filterVehicle) wos = wos.filter(function (w) { return w.vehicleId === filterVehicle; });
    if (searchText) { var q = searchText.toLowerCase(); wos = wos.filter(function (w) { return w.number.toLowerCase().includes(q) || w.description.toLowerCase().includes(q) || (w.vehiclePlate || '').toLowerCase().includes(q); }); }
    return wos;
  }

  function cancelWO(id) {
    var wo = DB.getById('workOrders', id);
    if (!wo) return;
    Utils.confirm('¿Cancelar esta orden de trabajo?', 'Cancelar OT', function () {
      if (wo.status !== 'cancelada' && wo.materials) {
        wo.materials.forEach(function (m) {
          if ((m.qtyDelivered || 0) > 0) {
            var item = DB.getById('items', m.itemId);
            if (item) DB.update('items', m.itemId, { stock: item.stock + m.qtyDelivered });
            DB.create('movements', { itemId: m.itemId, itemName: m.itemName, type: 'entrada', qty: m.qtyDelivered, date: Utils.todayISO(), reference: 'ANULACION OT', notes: 'Reversión automática por anulación de OT: ' + wo.number, userId: DB.getSettings().activeUserId });
          }
        });
      }
      DB.update('workOrders', id, { status: 'cancelada' });
      Utils.toast('OT cancelada y stock devuelto al inventario.', 'warning'); render(); App.updateBadges();
    }, true);
  }

  function deleteWO(id) {
    var wo = DB.getById('workOrders', id);
    if (!wo) return;
    Utils.confirm('¿Eliminar definitivamente esta OT?', 'Eliminar OT', function () {
      if (wo.status !== 'cancelada' && wo.materials) {
        wo.materials.forEach(function (m) {
          if ((m.qtyDelivered || 0) > 0) {
            var item = DB.getById('items', m.itemId);
            if (item) DB.update('items', m.itemId, { stock: item.stock + m.qtyDelivered });
            DB.create('movements', { itemId: m.itemId, itemName: m.itemName, type: 'entrada', qty: m.qtyDelivered, date: Utils.todayISO(), reference: 'ELIMINACION OT', notes: 'Reversión automática por eliminación de OT: ' + wo.number, userId: DB.getSettings().activeUserId });
          }
        });
      }
      DB.remove('workOrders', id); Utils.toast('OT eliminada resolviendo estado de stock.', 'success'); render(); App.updateBadges();
    }, true);
  }

  function showClosingWizard(id) {
    var wo = DB.getById('workOrders', id);
    if (!wo) return;
    var old = document.getElementById('wo-close-wizard'); if (old) old.remove();

    var matSum = (wo.materials || []).reduce(function (acc, m) { return Utils.dec.add(acc, m.totalCost || 0); }, 0);

    var html = '<div class="modal-overlay" id="wo-close-wizard"><div class="modal">' +
      '<div class="modal-header"><h3>🏁 Cierre de Orden: ' + Utils.escapeHtml(wo.number) + '</h3><button class="modal-close" id="woc-close-x">✕</button></div>' +
      '<div class="modal-body">' +
      '<div style="background:var(--bg-elevated);padding:12px;border-radius:8px;margin-bottom:16px;border-left:4px solid var(--color-success);">' +
      '<div class="text-xs text-muted">HORÓMETRO INICIAL</div>' +
      '<div style="font-weight:700;font-size:1.1rem;">' + Utils.fmtNum(wo.vehicleHours || 0) + ' hrs</div>' +
      '</div>' +
      '<div class="form-group"><label>Horómetro Final (Horas) *</label>' +
      '<input type="number" class="form-input" id="woc-hours" min="' + (wo.vehicleHours || 0) + '" value="' + (wo.vehicleHours || 0) + '"></div>' +
      '<div class="form-group"><label>Costo Mano de Obra ($) *</label>' +
      '<input type="number" class="form-input" id="woc-labor" min="0" value="0"></div>' +
      '<div class="form-group"><label>Servicios Externos ($)</label>' +
      '<input type="number" class="form-input" id="woc-ext" min="0" value="0"></div>' +
      '<div style="margin-top:16px;padding:12px;background:var(--bg-elevated);border-radius:8px;text-align:right;">' +
      '<div class="text-xs text-muted">REPUESTOS: $ ' + Utils.fmtNum(matSum) + '</div>' +
      '<div id="woc-total-display" style="font-weight:700;font-size:1.2rem;color:var(--color-success);margin-top:4px;">TOTAL OT: $ ' + Utils.fmtNum(matSum) + '</div>' +
      '</div>' +
      '</div>' +
      '<div class="modal-footer"><button class="btn btn-secondary" id="woc-cancel">Cancelar</button><button class="btn btn-success" id="woc-save">💾 Finalizar y Cerrar</button></div>' +
      '</div></div>';

    document.body.insertAdjacentHTML('beforeend', html);
    var ov = document.getElementById('wo-close-wizard');
    var inpHours = document.getElementById('woc-hours');
    var inpLabor = document.getElementById('woc-labor');
    var inpExt = document.getElementById('woc-ext');
    var display = document.getElementById('woc-total-display');

    function updateDocTotal() {
      var l = parseFloat(inpLabor.value) || 0;
      var e = parseFloat(inpExt.value) || 0;
      display.textContent = 'TOTAL OT: $ ' + Utils.fmtNum(Utils.dec.add(matSum, Utils.dec.add(l, e)));
    }
    inpLabor.oninput = updateDocTotal;
    inpExt.oninput = updateDocTotal;

    function close() { ov.remove(); }
    document.getElementById('woc-close-x').onclick = close;
    document.getElementById('woc-cancel').onclick = close;

    document.getElementById('woc-save').onclick = function () {
      var h = parseFloat(inpHours.value) || 0;
      var l = parseFloat(inpLabor.value) || 0;
      var e = parseFloat(inpExt.value) || 0;

      if (h < (wo.vehicleHours || 0)) {
        Utils.toast('El horómetro final no puede ser menor al inicial (' + (wo.vehicleHours || 0) + ').', 'error');
        return;
      }
      if (l < 0 || e < 0) {
        Utils.toast('Los costos no pueden ser negativos.', 'error');
        return;
      }
      if (l === 0) {
        if (!confirm('¿Seguro que el costo de mano de obra es $0?')) return;
      }

      var total = Utils.dec.add(matSum, Utils.dec.add(l, e));

      DB.transaction(function () {
        DB.update('workOrders', wo.id, {
          status: 'completada',
          closedAt: Utils.todayISO(),
          laborCost: l,
          externalCost: e,
          totalCost: total,
          vehicleHoursFinal: h
        });

        // Sincronizar horómetro del vehículo
        var v = DB.getById('vehicles', wo.vehicleId);
        if (v && h > (v.hours || 0)) {
          DB.update('vehicles', v.id, { hours: h });
        }
      });

      Utils.toast('✅ OT ' + wo.number + ' cerrada exitosamente.', 'success');
      close(); render(); App.updateBadges();
    };
  }

  function printWO(id) {
    var wo = DB.getById('workOrders', id);
    if (wo) Utils.printOT(wo);
  }

  function exportExcel() {
    var wos = DB.getAll('workOrders');
    var emps = DB.getAll('employees');
    var eMap = {}; emps.forEach(function (e) { eMap[e.id] = e.name; });
    Utils.exportExcel('ordenes_trabajo_' + Utils.todayISO() + '.xlsx', 'Reporte General de Órdenes de Trabajo',
      ['Número', 'Fecha', 'Tipo Mantenimiento', 'Vehículo (Placa)', 'Descripción', 'Prioridad', 'Estado', 'Técnico', 'Materiales', 'Creada por', 'Cerrada', 'Costo Total'],
      wos.map(function (w) {
        var tipo = w.maintenanceType
          ? (Utils.MAINTENANCE_TYPES[w.maintenanceType] || { label: w.maintenanceType }).label
          : (w.isPreventive ? 'Preventivo' : 'Correctivo');
        return [w.number, w.date, tipo, w.vehiclePlate || 'Sin vehículo', w.description, w.priority,
        Utils.OT_STATUS[w.status] ? Utils.OT_STATUS[w.status].label : w.status,
        eMap[w.assignedTo] || 'Sin asignar', (w.materials || []).length,
        w.requesterName || '', w.closedAt || '', w.totalCost || 0];
      })
    );
    Utils.toast('Órdenes de trabajo exportadas a Excel.', 'success');
  }

  // Public API — also expose showCreateModal alias for backwards compat
  function showCreateModal(id) {
    if (id) { showEditModal(id); } else { wizStep = 1; wizData = {}; wizMats = []; showWizard(); }
  }

  return {
    render: render,
    showCreateModal: showCreateModal,
    showWizard: showWizard,
    showEditModal: showEditModal,
    showDetail: showDetail,
    showClosingWizard: showClosingWizard,
    cancelWO: cancelWO,
    deleteWO: deleteWO,
    printWO: printWO,
    _rmMat: _rmMat,
    updateWizKm: updateWizKm,
    syncRoutineOnClose: syncRoutineOnClose
  };
})();
