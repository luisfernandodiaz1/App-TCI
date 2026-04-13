/* ============================================================
   EMPLOYEES.JS — Module for managing mechanics and company staff
   ============================================================ */

var EmployeesModule = (function () {
  'use strict';

  var searchText = '';

  function render() {
    var html = '<div class="section-header">' +
      '<div class="section-header-left"><h2>👥 Gestión de Empleados</h2></div>' +
      '<div class="flex gap-2">' +
      '<button class="btn btn-secondary" id="emp-pos-btn">📋 Gestionar Cargos</button>' +
      '<button class="btn btn-primary" id="emp-add-btn">+ Nuevo Empleado</button>' +
      '</div>' +
      '</div>' +

      '<div class="card" style="margin-bottom:20px;">' +
      '<div class="toolbar">' +
      '<div class="search-bar" style="flex:1;"><span>🔍</span><input type="text" placeholder="Buscar por nombre, cédula o cargo..." id="emp-search" value="' + Utils.escapeHtml(searchText) + '"></div>' +
      '</div>' +
      '</div>' +

      '<div id="emp-list-content"></div>';

    document.getElementById('section-employees').innerHTML = html;

    document.getElementById('emp-add-btn').onclick = function() { showEmployeeModal(); };
    document.getElementById('emp-pos-btn').onclick = function() { showPositionsModal(); };
    var si = document.getElementById('emp-search');
    if (si) si.oninput = Utils.debounce(function () { searchText = si.value; renderTable(); }, 250);

    renderTable();
  }

  function renderTable() {
    var allEmployees = DB.getAll('employees');
    var employees = allEmployees;

    if (searchText) {
      var q = searchText.toLowerCase();
      var positions = DB.getAll('positions');
      employees = employees.filter(function (e) {
        var pos = positions.find(function(p){ return p.id === e.positionId; });
        return (e.name || '').toLowerCase().includes(q) ||
          (e.idNumber || '').toLowerCase().includes(q) ||
          (pos ? pos.name.toLowerCase().includes(q) : false);
      });
    }

    var html = '';
    if (!employees.length) {
      html = '<div class="card"><div class="empty-state"><div class="empty-state-icon">👥</div><h3>No se encontraron empleados</h3><p>Agrega un nuevo empleado para comenzar.</p></div></div>';
    } else {
      var positions = DB.getAll('positions');
      var pMap = {}; positions.forEach(function(p){ pMap[p.id] = p.name; });

      html = '<div class="card" style="padding:0;"><div class="table-wrapper"><table><thead><tr>' +
        '<th>Nombre</th><th>Cédula</th><th>Cargo</th><th>Técnico OT</th><th>Sueldo Mensual</th><th>Acciones</th>' +
        '</tr></thead><tbody>' +
        employees.map(function (emp) {
          return '<tr>' +
            '<td><div class="font-medium">' + Utils.escapeHtml(emp.name) + '</div><div class="text-xs text-muted">ID: ' + Utils.escapeHtml(emp.idNumber || '—') + '</div></td>' +
            '<td>' + Utils.escapeHtml(emp.idNumber || '—') + '</td>' +
            '<td><span class="badge badge-blue">' + Utils.escapeHtml(pMap[emp.positionId] || 'Sin cargo') + '</span></td>' +
            '<td>' + (emp.isTechnician ? '<span class="badge badge-cyan">✅ Sí</span>' : '<span class="badge badge-gray">No</span>') + '</td>' +
            '<td><strong style="color:var(--accent-primary);">$ ' + Utils.fmtNum(emp.monthlySalary || 0) + '</strong></td>' +
            '<td><div class="table-actions">' +
            '<button class="btn btn-ghost btn-sm" title="Editar" onclick="EmployeesModule.showEmployeeModal(\'' + emp.id + '\')">✏️</button>' +
            '<button class="btn btn-ghost btn-sm" title="Eliminar" onclick="EmployeesModule.deleteEmployee(\'' + emp.id + '\')">🗑️</button>' +
            '</div></td></tr>';
        }).join('') +
        '</tbody></table></div></div>';
    }

    document.getElementById('emp-list-content').innerHTML = html;
  }

  function showEmployeeModal(id) {
    var emp = id ? DB.getById('employees', id) : null;
    var positions = DB.getAll('positions');
    var old = document.getElementById('emp-modal'); if (old) old.remove();

    var html = '<div class="modal-overlay" id="emp-modal"><div class="modal">' +
      '<div class="modal-header"><h3>' + (emp ? '✏️ Editar Empleado' : '👤 Nuevo Empleado') + '</h3><button class="modal-close" id="emp-mc">✕</button></div>' +
      '<div class="modal-body">' +
      '<div class="form-grid">' +
      '<div class="form-group span-2"><label>Nombre Completo *</label><input class="form-input" id="ef-name" value="' + Utils.escapeHtml(emp ? emp.name : '') + '" placeholder="Ej: Juan Pérez"></div>' +
      '<div class="form-group"><label>Cédula / ID *</label><input class="form-input" id="ef-id" value="' + Utils.escapeHtml(emp ? emp.idNumber : '') + '" placeholder="Ej: 12345678"></div>' +
      '<div class="form-group"><label>Sueldo Mensual ($) *</label><input class="form-input" type="number" id="ef-salary" value="' + (emp ? emp.monthlySalary || 0 : 0) + '"></div>' +
      '<div class="form-group"><label>Cargo en la Empresa *</label>' +
      '<select class="form-select" id="ef-pos-id">' +
      '<option value="">Seleccionar cargo...</option>' +
      positions.map(function(p){ return '<option value="'+p.id+'"'+(emp && emp.positionId === p.id?' selected':'')+'>'+Utils.escapeHtml(p.name)+'</option>'; }).join('') +
      '</select></div>' +
      '<div class="form-group"><label>Participa en OTs</label>' +
      '<div style="margin-top:8px;"><label class="flex items-center gap-2" style="cursor:pointer;"><input type="checkbox" id="ef-istech" '+( (!emp || emp.isTechnician) ? 'checked' : '' )+'> Aparece como técnico</label></div>' +
      '</div>' +
      '<div class="form-group"><label>Estado</label>' +
      '<div style="margin-top:8px;"><label class="flex items-center gap-2" style="cursor:pointer;"><input type="checkbox" id="ef-active" ' + (emp && emp.active === false ? '' : 'checked') + '> Empleado Activo</label></div>' +
      '</div>' +
      '</div>' +
      '</div>' +
      '<div class="modal-footer"><button class="btn btn-secondary" id="emp-can">Cancelar</button><button class="btn btn-primary" id="emp-sv">💾 Guardar Empleado</button></div>' +
      '</div></div>';

    document.body.insertAdjacentHTML('beforeend', html);
    var ov = document.getElementById('emp-modal');
    function close() { ov.remove(); }
    document.getElementById('emp-mc').onclick = close;
    document.getElementById('emp-can').onclick = close;
    ov.onclick = function (e) { if (e.target === ov) close(); };

    document.getElementById('emp-sv').onclick = function () {
      var name = document.getElementById('ef-name').value.trim();
      var idNum = document.getElementById('ef-id').value.trim();
      var posId = document.getElementById('ef-pos-id').value;
      var salary = parseInt(document.getElementById('ef-salary').value) || 0;
      var isTech = document.getElementById('ef-istech').checked;
      var isActive = document.getElementById('ef-active').checked;

      if (!name || !idNum || !posId) {
        Utils.toast('Por favor completa los campos obligatorios (Nombre, ID y Cargo).', 'warning');
        return;
      }

      // Poka-Yoke: Bloquear inactivación si tiene trabajos pendientes
      if (emp && !isActive && emp.active) {
        var pendingWOs = DB.getAll('workOrders').filter(function (w) {
          return w.assignedTo === emp.id && ['emitida', 'en_proceso', 'esperando_repuestos'].indexOf(w.status) !== -1;
        });
        if (pendingWOs.length > 0) {
          Utils.toast('⚠️ Bloqueo: El técnico tiene trabajos pendientes. Entregue las OTs antes de inactivarlo.', 'warning');
          return;
        }
      }

      var data = {
        name: name,
        idNumber: idNum,
        positionId: posId,
        monthlySalary: salary,
        isTechnician: isTech,
        active: isActive
      };

      if (emp) {
        DB.update('employees', emp.id, data);
        Utils.toast('Empleado actualizado correctamente.', 'success');
      } else {
        data.createdAt = Utils.todayISO();
        DB.create('employees', data);
        Utils.toast('Nuevo empleado registrado.', 'success');
      }
      close();
      renderTable();
    };
  }

  function deleteEmployee(id) {
    var emp = DB.getById('employees', id);
    if (!emp) return;
    
    // 🛡️ BLINDAJE DE BORRADO (V1.5): Integridad Referencial Histórica
    
    // 1. Verificar en WorkOrders (Asignado o en laborEntries)
    var hasWOHistory = DB.getAll('workOrders').some(function (w) {
      var isAssigned = w.assignedTo === id;
      var isInEntries = (w.laborEntries || []).some(function (e) { 
        return e.employeeId === id || e.id === id; 
      });
      var isInLog = (w.activityLog || []).some(function (log) { return log.userId === id; });
      return isAssigned || isInEntries || isInLog;
    });

    // 2. Verificar en MaintenanceLogs
    var hasMaintHistory = DB.getAll('maintenanceLogs').some(function (l) {
      return l.userId === id || (l.materialsUsed || []).some(function(m) { return m.requestedBy === id; });
    });

    // 3. Verificar en FuelLogs (Conductor)
    var hasFuelHistory = DB.getAll('fuelLogs').some(function (f) {
      return f.userId === id || f.driverId === id; // userId suele ser quien registra, driverId el responsable
    });

    // 4. Verificar en VehicleInspections
    var hasInspHistory = (DB.getAll('vehicleInspections') || []).some(function (i) {
      return i.userId === id;
    });

    if (hasWOHistory || hasMaintHistory || hasFuelHistory || hasInspHistory) {
      Utils.toast("❌ Error de Integridad: Este empleado tiene registro histórico en el sistema (OTs, Bitácora o Inspecciones). Inactívelo en su lugar para preservar la validez de los reportes.", "error", 6000);
      return;
    }

    Utils.confirm('¿Estás seguro de eliminar a ' + emp.name + '? Esta acción no se puede deshacer.', 'Eliminar Empleado', function () {
      try {
        DB.remove('employees', id);
        Utils.toast('Empleado eliminado.', 'success');
        renderTable();
      } catch (e) {
        Utils.toast(e.message, 'error', 5000);
      }
    }, true);
  }

  function showPositionsModal() {
    var old = document.getElementById('pos-modal'); if (old) old.remove();
    var positions = DB.getAll('positions') || [];

    var html = '<div class="modal-overlay" id="pos-modal"><div class="modal">' +
      '<div class="modal-header"><h3>📋 Gestionar Cargos</h3><button class="modal-close" id="pos-mc">✕</button></div>' +
      '<div class="modal-body">' +
      '<div class="flex gap-2" style="margin-bottom:16px;">' +
      '<input class="form-input" id="ps-name" placeholder="Nombre del nuevo cargo...">' +
      '<button class="btn btn-cyan btn-sm" id="ps-add">Añadir</button>' +
      '</div>' +
      '<div id="pos-list" style="max-height:300px;overflow-y:auto;">' +
      positions.map(function(p){
        return '<div class="flex justify-between items-center" style="padding:8px;border-bottom:1px solid var(--border);">' +
          '<span>'+Utils.escapeHtml(p.name)+'</span>' +
          '<button class="btn btn-ghost btn-sm" onclick="EmployeesModule.deletePosition(\''+p.id+'\')">🗑️</button>' +
          '</div>';
      }).join('') +
      '</div>' +
      '</div>' +
      '<div class="modal-footer"><button class="btn btn-secondary" id="pos-close">Cerrar</button></div>' +
      '</div></div>';

    document.body.insertAdjacentHTML('beforeend', html);
    var ov = document.getElementById('pos-modal');
    document.getElementById('pos-mc').onclick = function(){ ov.remove(); renderTable(); };
    document.getElementById('pos-close').onclick = function(){ ov.remove(); renderTable(); };

    document.getElementById('ps-add').onclick = function() {
      var name = document.getElementById('ps-name').value.trim();
      if(!name) return;
      DB.create('positions', { name: name });
      document.getElementById('ps-name').value = '';
      showPositionsModal();
    };
  }

  function deletePosition(id) {
    var inUse = DB.getAll('employees').some(function(e){ return e.positionId === id; });
    if(inUse) { Utils.toast('No se puede eliminar un cargo asignado a empleados.', 'error'); return; }
    DB.remove('positions', id);
    showPositionsModal();
  }

  return {
    render: render,
    showEmployeeModal: showEmployeeModal,
    deleteEmployee: deleteEmployee,
    showPositionsModal: showPositionsModal,
    deletePosition: deletePosition
  };
})();
