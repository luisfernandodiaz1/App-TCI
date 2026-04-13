/* ============================================================
   UTILS.JS — Helpers: dates, Excel export, toasts, modals, etc.
   ============================================================ */

var Utils = (function () {
  'use strict';

  // ── POLYFILLS (Compatibility for older browsers) ───────────
  if (!Array.prototype.find) {
    Array.prototype.find = function (predicate) {
      if (this == null) throw new TypeError('Array.prototype.find called on null or undefined');
      if (typeof predicate !== 'function') throw new TypeError('predicate must be a function');
      var list = Object(this);
      var length = list.length >>> 0;
      var thisArg = arguments[1];
      var value;
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
      var list = Object(this);
      var length = list.length >>> 0;
      var thisArg = arguments[1];
      var value;
      for (var i = 0; i < length; i++) {
        value = list[i];
        if (predicate.call(thisArg, value, i, list)) return i;
      }
      return -1;
    };
  }

  if (!String.prototype.includes) {
    String.prototype.includes = function (search, start) {
      if (typeof start !== 'number') start = 0;
      if (start + search.length > this.length) return false;
      return this.indexOf(search, start) !== -1;
    };
  }

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

  if (!Object.values) {
    Object.values = function (obj) {
      return Object.keys(obj).map(function (key) {
        return obj[key];
      });
    };
  }

  // ── Proteccion Matemática (Shield) ─────────────────────────
  function safeNum(val, fallback) {
    if (val === null || val === undefined || val === '') return fallback || 0;
    var n = Number(val);
    return isNaN(n) || !isFinite(n) ? (fallback || 0) : n;
  }

  // ── Date formatting ────────────────────────────────────────
  function formatDate(dateStr) {
    if (!dateStr) return '—';
    var d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function formatDateTime(isoStr) {
    if (!isoStr) return '—';
    var d = new Date(isoStr);
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })
      + ' ' + d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
  }

  function toLocalISO(val) {
    if (!val) val = new Date();
    // Si ya es un string YYYY-MM-DD, lo devolvemos tal cual para evitar desfases
    if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) return val;

    var d = new Date(val);
    if (isNaN(d.getTime())) return '';

    // Ajuste: restamos el offset (minutos a ms) para que toISOString use la fecha local
    var offset = d.getTimezoneOffset() * 60000;
    var local = new Date(d.getTime() - offset);
    return local.toISOString().split('T')[0];
  }

  function todayISO() {
    return toLocalISO();
  }

  function daysAgoISO(n) {
    var d = new Date();
    d.setDate(d.getDate() - n);
    return toLocalISO(d);
  }

  // ── Toast notifications ────────────────────────────────────
  var toastContainer;

  function initToasts() {
    toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      toastContainer.className = 'toast-container';
      document.body.appendChild(toastContainer);
    }
  }

  var ICONS = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };

  function toast(message, type, duration) {
    type = type || 'info';
    duration = duration || 3500;
    if (!toastContainer) initToasts();

    var el = document.createElement('div');
    el.className = 'toast ' + type;
    el.innerHTML = '<span class="toast-icon">' + ICONS[type] + '</span><span class="toast-msg">' + escapeHtml(message) + '</span>';
    el.onclick = function () { removeToast(el); };

    toastContainer.appendChild(el);

    setTimeout(function () { removeToast(el); }, duration);
  }

  function removeToast(el) {
    if (!el.parentNode) return;
    el.classList.add('toast-exit');
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 280);
  }

  // ── Confirm dialog ─────────────────────────────────────────
  function confirm(message, title, onConfirm, danger) {
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML =
      '<div class="modal confirm-modal" style="max-width:400px;text-align:center;">' +
      '<div class="modal-body">' +
      '<div class="confirm-icon">' + (danger ? '🗑️' : '❓') + '</div>' +
      '<h3 style="margin-bottom:8px;">' + escapeHtml(title || '¿Confirmar?') + '</h3>' +
      '<p style="color:var(--text-secondary);font-size:0.875rem;">' + escapeHtml(message) + '</p>' +
      '</div>' +
      '<div class="modal-footer" style="justify-content:center;">' +
      '<button class="btn btn-secondary btn-cancel">Cancelar</button>' +
      '<button class="btn ' + (danger ? 'btn-danger' : 'btn-primary') + ' btn-ok">Confirmar</button>' +
      '</div>' +
      '</div>';

    document.body.appendChild(overlay);

    overlay.querySelector('.btn-cancel').onclick = function () { document.body.removeChild(overlay); };
    overlay.querySelector('.btn-ok').onclick = function () {
      document.body.removeChild(overlay);
      if (onConfirm) onConfirm();
    };
    overlay.onclick = function (e) { if (e.target === overlay) document.body.removeChild(overlay); };
  }

  // ── Modal helpers ──────────────────────────────────────────
  function openModal(modalEl) {
    modalEl.classList.remove('hidden');
  }

  function closeModal(modalEl) {
    modalEl.classList.add('hidden');
  }

  // ── Excel Export Avanzado (SheetJS) ───────────────────────
  function exportExcel(filename, reportTitle, headers, rows) {
    try {
      var settings = DB.getSettings();
      var cleanName = filename.replace(/\.(csv|xlsx)$/, '') + '.xlsx';

      var companyNameRaw = settings.companyName ? String(settings.companyName) : 'EMPRESA';
      // Encabezado profesional (Empresa, Título, Fecha)
      var metadata = [
        [companyNameRaw.toUpperCase()],
        [(reportTitle || 'Reporte de Sistema').toUpperCase()],
        ['Fecha de Generación:', formatDate(todayISO()) + ' ' + new Date().toLocaleTimeString()],
        [''] // Fila en blanco
      ];

      // Convertir filas asegurando que los números sean Numbers y filtrando NaN/Infinity
      var processedRows = rows.map(function (row) {
        return row.map(function (cell) {
          // Si es un número inválido (NaN o Infinity), devolver null para que Excel lo vea vacío
          if (typeof cell === 'number' && (isNaN(cell) || !isFinite(cell))) return null;

          // Si es un string numérico, intentar convertirlo
          if (typeof cell === 'string' && cell.trim() !== '' && !isNaN(cell)) {
            var n = Number(cell);
            return isFinite(n) ? n : cell;
          }
          return cell;
        });
      });

      var sheetData = metadata.concat([headers]).concat(processedRows);
      var ws = XLSX.utils.aoa_to_sheet(sheetData);

      // ColWidths
      var wscols = headers.map(function (h) { return { wch: Math.max(h.length + 5, 20) }; });
      ws['!cols'] = wscols;

      // Filtros automáticos en la fila de cabeceras
      var range = XLSX.utils.decode_range(ws['!ref']);
      ws['!autofilter'] = {
        ref: XLSX.utils.encode_range({
          s: { c: 0, r: metadata.length },
          e: { c: headers.length - 1, r: range.e.r }
        })
      };

      var wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Datos");

      // Forzar la descarga explícita usando Blob y etiqueta <a> para asegurar el nombre del archivo
      var wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      var blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = cleanName;
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }, 100);

      toast('Excel generado con éxito.', 'success');
    } catch (err) {
      console.error('Error exportando Excel Avanzado:', err);
      toast('Fallo al exportar excel. Verifique conexión a internet.', 'error');
    }
  }

  // ── Escape HTML ────────────────────────────────────────────
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ── Stock level ────────────────────────────────────────────
  function stockLevel(item) {
    var pct = item.minStock > 0 ? (item.stock / item.minStock) : 1;
    if (item.stock === 0) return 'critical';
    if (pct <= 0.5) return 'critical';
    if (pct < 1) return 'low';
    return 'ok';
  }

  function stockBadge(item) {
    var lvl = stockLevel(item);
    var map = { ok: ['badge-green', '✅ OK'], low: ['badge-amber', '⚠️ Bajo'], critical: ['badge-red', '🔴 Crítico'] };
    var info = map[lvl];
    return '<span class="badge ' + info[0] + '">' + info[1] + '</span>';
  }

  // ── OT Status config ───────────────────────────────────────
  var OT_STATUS = {
    borrador: { label: 'Borrador', badge: 'badge-gray', icon: '📝' },
    emitida: { label: 'Emitida', badge: 'badge-blue', icon: '📨' },
    en_proceso: { label: 'En Proceso', badge: 'badge-amber', icon: '⚙️' },
    esperando_repuestos: { label: 'Faltan Repuestos', badge: 'badge-red', icon: '⏳' },
    esperando_repuestos_externo: { label: 'Esperando Ext.', badge: 'badge-purple', icon: '🟣' },
    completada: { label: 'Completada', badge: 'badge-green', icon: '✅' },
    cancelada: { label: 'Cancelada', badge: 'badge-red', icon: '❌' }
  };

  function otStatusBadge(status) {
    var s = OT_STATUS[status] || { label: status, badge: 'badge-gray', icon: '❓' };
    return '<span class="badge ' + s.badge + '">' + s.icon + ' ' + s.label + '</span>';
  }

  var PRIORITY_CFG = {
    alta: { label: 'Alta', badge: 'badge-red', dot: 'alta' },
    media: { label: 'Media', badge: 'badge-amber', dot: 'media' },
    baja: { label: 'Baja', badge: 'badge-green', dot: 'baja' },
  };

  function priorityBadge(priority) {
    var p = PRIORITY_CFG[priority] || { label: priority, badge: 'badge-gray', dot: '' };
    return '<span class="badge ' + p.badge + '"><span class="priority-dot ' + p.dot + '"></span>' + p.label + '</span>';
  }

  // ── Maintenance Type config ──────────────────────────────────────
  var MAINTENANCE_TYPES = {
    preventivo: { label: 'Preventivo', badge: 'badge-amber', icon: '📅' },
    correctivo: { label: 'Correctivo', badge: 'badge-blue', icon: '🛠️' }
  };

  function maintenanceTypeBadge(type) {
    var mt = MAINTENANCE_TYPES[type] || { label: type || 'Correctivo', badge: 'badge-blue', icon: '🛠️' };
    return '<span class="badge ' + mt.badge + '">' + mt.icon + ' ' + mt.label + '</span>';
  }

  // ── Print OT ───────────────────────────────────────────────
  function printOT(wo) {
    var settings = DB.getSettings();
    var items = DB.getAll('items');
    var tecnico = DB.getById('employees', wo.assignedTo);
    var solicitante = DB.getById('users', wo.requesterId);

    var matRows = (wo.materials || []).map(function (m) {
      return '<tr>' +
        '<td style="padding:6px 10px;border:1px solid #ccc;">' + escapeHtml(m.itemName) + '</td>' +
        '<td style="padding:6px 10px;border:1px solid #ccc;text-align:center;">' + m.qtyRequested + '</td>' +
        '<td style="padding:6px 10px;border:1px solid #ccc;text-align:center;">' + escapeHtml(m.unit) + '</td>' +
        '<td style="padding:6px 10px;border:1px solid #ccc;text-align:center;">' + (m.delivered ? m.qtyDelivered : '') + '</td>' +
        '</tr>';
    }).join('');

    var html = '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>OT ' + wo.number + '</title>' +
      '<style>body{font-family:Arial,sans-serif;font-size:12pt;color:#111;padding:20px;max-width:800px;margin:auto;}' +
      'h1{font-size:16pt;margin:0;}h2{font-size:13pt;}' +
      '.header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #333;padding-bottom:12px;margin-bottom:20px;}' +
      '.company{font-size:10pt;color:#555;}' +
      '.ot-number{font-size:18pt;font-weight:bold;color:#1d4ed8;text-align:right;}' +
      'table{width:100%;border-collapse:collapse;margin-top:10px;}' +
      'th{background:#1e293b;color:#fff;padding:8px 10px;border:1px solid #333;text-align:left;font-size:10pt;}' +
      '.meta-table td{padding:5px 10px;border:1px solid #ccc;font-size:10pt;}' +
      '.meta-table td:first-child{font-weight:bold;background:#f5f5f5;width:140px;}' +
      '.sign-area{display:flex;justify-content:space-around;margin-top:40px;flex-wrap:wrap;gap:20px;}' +
      '.sign-box{text-align:center;min-width:180px;}' +
      '.sign-line{border-top:1px solid #333;margin-top:40px;padding-top:5px;font-size:10pt;}' +
      '.badge-prev{display:inline-block;padding:2px 10px;background:#fef3c7;border:1px solid #f59e0b;color:#92400e;border-radius:4px;font-weight:700;font-size:9pt;}' +
      '.badge-corr{display:inline-block;padding:2px 10px;background:#dbeafe;border:1px solid #3b82f6;color:#1e40af;border-radius:4px;font-weight:700;font-size:9pt;}' +
      '@media print{button{display:none;}}' +
      '</style></head><body>' +
      '<div class="header">' +
      '<div><h1>' + escapeHtml(settings.companyName) + '</h1>' +
      '<div class="company">NIT: ' + escapeHtml(settings.companyNit || '') + '</div>' +
      '<div class="company">' + escapeHtml(settings.companyAddress || '') + '</div>' +
      '</div>' +
      '<div class="ot-number">ORDEN DE TRABAJO<br>' + wo.number + '</div>' +
      '</div>' +
      '<h2 style="margin-bottom:10px;">Información General</h2>' +
      '<table class="meta-table"><tbody>' +
      '<tr><td>Fecha Emisión</td><td>' + formatDate(wo.date) + '</td><td>Prioridad</td><td>' + (wo.priority || '').toUpperCase() + '</td></tr>' +
      '<tr><td>Tipo</td><td>' + (wo.maintenanceType === 'preventivo' ? '<span class="badge-prev">📅 PREVENTIVO</span>' : '<span class="badge-corr">🔧 CORRECTIVO</span>') + '</td><td>Estado</td><td>' + (OT_STATUS[wo.status] || { label: wo.status }).label + '</td></tr>' +
      '<tr><td>Solicitante</td><td>' + escapeHtml(solicitante ? solicitante.name : wo.requesterName) + '</td><td>Cerrada</td><td>' + (wo.closedAt ? formatDate(wo.closedAt) : '—') + '</td></tr>' +
      (function () {
        var equipoLabel, equipoVal;
        if ((wo.laborEntries || []).length > 1) {
          equipoLabel = 'Equipo Técnico';
          equipoVal = wo.laborEntries.map(function (e) { return escapeHtml(e.name); }).join(', ');
        } else if ((wo.laborEntries || []).length === 1) {
          equipoLabel = 'Técnico';
          equipoVal = escapeHtml(wo.laborEntries[0].name);
        } else {
          equipoLabel = 'Técnico Responsable';
          equipoVal = escapeHtml(tecnico ? tecnico.name : 'Sin asignar');
        }
        return '<tr><td>' + equipoLabel + '</td><td>' + equipoVal + '</td><td>Vehículo</td><td>' + escapeHtml(wo.vehiclePlate || '—') + '</td></tr>';
      })() +
      '</tbody></table>' +
      '<h2 style="margin-top:20px;margin-bottom:6px;">Descripción del Trabajo / Checklist</h2>' +
      '<div style="border:1px solid #ccc;padding:12px;min-height:40px;margin-bottom:10px;">' + 
      '<strong>Instrucción General:</strong><br>' + escapeHtml(wo.description) + 
      '</div>';

    // ── CHECKLIST PREVENTIVO INTEGRADO (V2.3) ───────────────────────
    if (wo.checklist && wo.checklist.length > 0) {
      html += '<div style="margin-left:20px;margin-top:10px;display:flex;flex-direction:column;gap:5px;">' +
        '<h4 style="margin:0 0 8px 0;font-size:11pt;">📋 Puntos de Inspección Obligatorios:</h4>' +
        wo.checklist.map(function (c) {
          var isComp = !!c.completed;
          return '<div style="margin-bottom:8px;display:flex;align-items:center;gap:12px;font-size:10.5pt;">' +
            '<div style="width:20px;height:20px;border:1.5px solid #333;text-align:center;line-height:20px;flex-shrink:0;">' + (isComp ? '✔' : '&nbsp;') + '</div>' +
            '<span style="' + (isComp ? 'text-decoration:line-through;color:#666;' : '') + '">' + escapeHtml(c.task || 'Inspección de rutina') + '</span>' +
            '</div>';
        }).join('') +
        '</div>';
    }

    html += '<h2 style="margin-top:20px;margin-bottom:6px;">Materiales Solicitados</h2>' +
      '<table><thead><tr><th>Material</th><th style="text-align:center;width:80px;">Cant. Req.</th><th style="text-align:center;width:80px;">Unidad</th><th style="text-align:center;width:80px;">Entregado</th></tr></thead>' +
      '<tbody>' + matRows + '</tbody></table>' +
      '<h2 style="margin-top:20px;margin-bottom:6px;">Observaciones</h2>' +
      '<p style="border:1px solid #ccc;padding:10px;min-height:40px;">' + escapeHtml(wo.notes || '') + '</p>';

    // ── EQUIPO DE TRABAJO (siempre visible) ──────────────────────────
    // Construir el equipo: laborEntries si está cerrada, activityLog si está abierta
    var allEmpsForPrint = DB.getAll('employees');
    var equipoMostrar = []; // [{ name, hours, cost, isClosed }]

    if ((wo.laborEntries || []).length) {
      // OT cerrada: usar datos reales con horas y costos
      equipoMostrar = wo.laborEntries.map(function (e) {
        return { name: e.name, hours: e.hours, cost: e.cost, isClosed: true };
      });
    } else {
      // OT abierta: construir desde activityLog — IDs únicos que sean empleados
      var seenIds = {};
      // 1. Siempre incluir el responsable principal
      if (wo.assignedTo) {
        var mainEmpPrint = allEmpsForPrint.find(function (e) { return e.id === wo.assignedTo; });
        if (mainEmpPrint) { seenIds[wo.assignedTo] = true; equipoMostrar.push({ name: mainEmpPrint.name, hours: null, cost: null, isClosed: false }); }
      }
      // 2. Participantes del activityLog
      (wo.activityLog || []).forEach(function (log) {
        if (log.userId && !seenIds[log.userId]) {
          var logEmp = allEmpsForPrint.find(function (e) { return e.id === log.userId; });
          if (logEmp) { seenIds[log.userId] = true; equipoMostrar.push({ name: logEmp.name, hours: null, cost: null, isClosed: false }); }
        }
      });
    }

    html += '<h2 style="margin-top:20px;margin-bottom:6px;">Equipo de Trabajo</h2>';
    if (equipoMostrar.length) {
      if (equipoMostrar[0].isClosed) {
        // Con horas y costos (OT completada)
        html += '<table><thead><tr><th>Mecánico</th><th style="text-align:center;width:100px;">Horas</th><th style="text-align:right;width:130px;">Costo M.O.</th></tr></thead><tbody>';
        equipoMostrar.forEach(function (e) {
          html += '<tr><td>' + escapeHtml(e.name) + '</td><td style="text-align:center;">' + e.hours + ' hrs</td><td style="text-align:right;">$ ' + fmtNum(e.cost) + '</td></tr>';
        });
        html += '</tbody></table>';
      } else {
        // Solo nombres (OT en proceso)
        html += '<table><thead><tr><th>Mecánico</th><th style="text-align:center;width:160px;">Estado</th></tr></thead><tbody>';
        equipoMostrar.forEach(function (e, i) {
          html += '<tr><td>' + escapeHtml(e.name) + '</td><td style="text-align:center;">' + (i === 0 ? '<strong>Responsable</strong>' : 'Participante') + '</td></tr>';
        });
        html += '</tbody></table>';
      }
    } else {
      html += '<p style="border:1px solid #ccc;padding:10px;">Sin técnico asignado</p>';
    }

    // ── DESGLOSE FINANCIERO (solo si está completada) ─────────────────
    if (wo.status === 'completada') {
      var matSum = (wo.materials || []).reduce(function (acc, m) { return acc + (m.totalCost || 0); }, 0);
      html += '<h2 style="margin-top:20px;margin-bottom:6px;">Desglose Financiero (Costo de Mantenimiento)</h2>' +
        '<table class="meta-table" style="width:50%; margin-bottom:20px;"><tbody>' +
        '<tr><td>Costo Repuestos consumidos</td><td style="text-align:right;">$ ' + fmtNum(matSum) + '</td></tr>' +
        '<tr><td>Costo Mano de Obra</td><td style="text-align:right;">$ ' + fmtNum(wo.laborCost || 0) + '</td></tr>' +
        '<tr><td>Servicios Externos / Terceros</td><td style="text-align:right;">$ ' + fmtNum(wo.externalCost || 0) + '</td></tr>' +
        '<tr><td style="font-weight:bold;background:#e2e8f0;">COSTO TOTAL OT</td><td style="text-align:right;font-weight:bold;font-size:12pt;background:#e2e8f0;color:#1d4ed8;">$ ' + fmtNum(wo.totalCost || 0) + '</td></tr>' +
        '</tbody></table>';
    }

    // ── FIRMAS ────────────────────────────────────────────────────────
    var signBoxes;
    if (equipoMostrar.length > 1) {
      signBoxes = equipoMostrar.map(function (e) {
        return '<div class="sign-box"><div class="sign-line">' + escapeHtml(e.name) + '</div></div>';
      }).join('');
    } else {
      signBoxes = '<div class="sign-box"><div class="sign-line">Solicitante / Mantenimiento</div></div>' +
        '<div class="sign-box"><div class="sign-line">' + escapeHtml(tecnico ? tecnico.name : 'Técnico de Taller') + '</div></div>';
    }

    html += '<div class="sign-area">' + signBoxes + '</div>' +
      '<button onclick="window.print()" style="margin-top:20px;padding:8px 20px;background:#1d4ed8;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:11pt;">🖨️ Imprimir</button>' +
      '</body></html>';

    var win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
  }

  // ── Print Vehicle History (Hoja de Vida) ───────────────────
  function printVehicleHistory(vehicleId) {
    var v = DB.getById('vehicles', vehicleId);
    if (!v) return;
    var wos = DB.getAll('workOrders').filter(function (w) { return w.vehicleId === vehicleId; });
    var docs = DB.getAll('vehicleDocuments').filter(function (d) { return d.vehicleId === vehicleId; });
    var settings = DB.getSettings();

    // Calcular Totales
    var totalCost = wos.reduce(function (acc, w) { return acc + (Number(w.totalCost) || 0); }, 0);
    var matCost = wos.reduce(function (acc, w) { return acc + (Number(w.materialBase) || 0); }, 0);
    var laborCost = wos.reduce(function (acc, w) { return acc + (Number(w.laborCost) || 0); }, 0);
    var extCost = wos.reduce(function (acc, w) { return acc + (Number(w.externalCost) || 0); }, 0);

    var woRows = wos.map(function (w) {
      return '<tr>' +
        '<td>' + formatDate(w.date) + '</td>' +
        '<td><strong>' + escapeHtml(w.number) + '</strong></td>' +
        '<td>' + (w.maintenanceType === 'preventivo' ? '📅 Prev.' : '🔧 Corr.') + '</td>' +
        '<td style="font-size:9pt;">' + escapeHtml(w.description) + '</td>' +
        '<td style="text-align:right;">$ ' + fmtNum(w.totalCost) + '</td>' +
        '</tr>';
    }).join('') || '<tr><td colspan="5" style="text-align:center;color:#777;padding:20px;">Sin historial de mantenimiento registrado.</td></tr>';

    var docRows = docs.map(function (d) {
      var isExpired = new Date(d.expiry) < new Date();
      return '<tr>' +
        '<td>' + escapeHtml(d.type.toUpperCase()) + '</td>' +
        '<td>' + formatDate(d.expiry) + '</td>' +
        '<td style="color:' + (isExpired ? '#dc2626' : '#059669') + ';font-weight:bold;">' + (isExpired ? 'VENCIDO' : 'VIGENTE') + '</td>' +
        '<td>' + escapeHtml(d.notes || '') + '</td>' +
        '</tr>';
    }).join('') || '<tr><td colspan="4" style="text-align:center;color:#777;padding:10px;">Sin documentos registrados.</td></tr>';

    var html = '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Hoja de Vida - ' + v.plate + '</title>' +
      '<style>body{font-family:Arial,sans-serif;font-size:11pt;color:#111;padding:25px;max-width:900px;margin:auto;}' +
      'h1{font-size:16pt;margin:0;}h2{font-size:13pt;border-bottom:1px solid #333;padding-bottom:5px;margin-top:25px;}' +
      '.header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #333;padding-bottom:12px;margin-bottom:20px;}' +
      '.company{font-size:9pt;color:#555;text-transform:uppercase;}' +
      '.report-title{font-size:16pt;font-weight:bold;color:#1d4ed8;text-align:right;}' +
      'table{width:100%;border-collapse:collapse;margin-top:10px;}' +
      'th{background:#f1f5f9;color:#334155;padding:8px 10px;border:1px solid #cbd5e1;text-align:left;font-size:9pt;text-transform:uppercase;}' +
      'td{padding:6px 10px;border:1px solid #cbd5e1;font-size:9.5pt;}' +
      '.info-grid{display:grid;grid-template-columns:repeat(3, 1fr);gap:15px;margin-bottom:20px;}' +
      '.info-item{border:1px solid #e2e8f0;padding:10px;border-radius:6px;}' +
      '.info-label{font-size:8pt;color:#64748b;text-transform:uppercase;font-weight:bold;margin-bottom:4px;}' +
      '.info-val{font-size:11pt;font-weight:bold;}' +
      '.kpi-row{display:flex;gap:15px;margin-top:20px;}' +
      '.kpi-box{flex:1;background:#f8fafc;border:1px solid #e2e8f0;padding:12px;border-radius:8px;text-align:center;}' +
      '.kpi-box.total{background:#eff6ff;border-color:#bfdbfe;}' +
      '@media print{button{display:none;}.no-print{display:none;}}' +
      '</style></head><body>' +
      '<div class="header">' +
      '<div><h1>' + escapeHtml(settings.companyName) + '</h1>' +
      '<div class="company">NIT: ' + escapeHtml(settings.companyNit || '') + ' — ' + escapeHtml(settings.companyAddress || '') + '</div>' +
      '</div>' +
      '<div class="report-title">HOJA DE VIDA DE VEHÍCULO<br><span style="color:#111;">PLACA: ' + v.plate + '</span></div>' +
      '</div>' +

      '<h2>Ficha Técnica de la Unidad</h2>' +
      '<div class="info-grid">' +
      '<div class="info-item"><div class="info-label">Marca / Línea</div><div class="info-val">' + escapeHtml(v.brand + ' ' + v.model) + '</div></div>' +
      '<div class="info-item"><div class="info-label">Año / Modelo</div><div class="info-val">' + escapeHtml(v.year || '—') + '</div></div>' +
      '<div class="info-item"><div class="info-label">Color</div><div class="info-val">' + escapeHtml(v.color || '—') + '</div></div>' +
      '<div class="info-item"><div class="info-label">Horómetro Actual</div><div class="info-val">' + fmtNum(v.hours) + ' hrs</div></div>' +
      '<div class="info-item"><div class="info-label">Departamento</div><div class="info-val">' + escapeHtml(v.department || '—') + '</div></div>' +
      '<div class="info-item"><div class="info-label">Estado</div><div class="info-val">' + (v.active ? 'ACTIVO' : 'INACTIVO') + '</div></div>' +
      '</div>' +

      '<h2>Estado de Documentación</h2>' +
      '<table><thead><tr><th>Documento</th><th>Vencimiento</th><th>Estado</th><th>Notas</th></tr></thead><tbody>' + docRows + '</tbody></table>' +

      '<h2>Historial de Mantenimiento (Ordenes de Trabajo)</h2>' +
      '<table><thead><tr><th>Fecha</th><th>OT #</th><th>Tipo</th><th>Descripción de la Intervención</th><th style="text-align:right;">Costo Total</th></tr></thead><tbody>' + woRows + '</tbody></table>' +

      '<h2>Resumen Financiero de Mantenimiento</h2>' +
      '<div class="kpi-row">' +
      '<div class="kpi-box"><div class="info-label">Repuestos</div><div class="info-val">$ ' + fmtNum(matCost) + '</div></div>' +
      '<div class="kpi-box"><div class="info-label">Mano de Obra</div><div class="info-val">$ ' + fmtNum(laborCost) + '</div></div>' +
      '<div class="kpi-box"><div class="info-label">Serv. Externos</div><div class="info-val">$ ' + fmtNum(extCost) + '</div></div>' +
      '<div class="kpi-box total"><div class="info-label" style="color:#1d4ed8;">Inversión Total Acumulada</div><div class="info-val" style="font-size:14pt;color:#1d4ed8;">$ ' + fmtNum(totalCost) + '</div></div>' +
      '</div>' +

      '<div style="margin-top:40px;font-size:9pt;color:#777;text-align:center;" class="no-print">Este documento es un reporte consolidado generado por el sistema InvControl Pro.</div>' +
      '<button onclick="window.print()" style="margin:20px auto;display:block;padding:10px 30px;background:#1d4ed8;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:11pt;font-weight:bold;">🖨️ Generar Impresión</button>' +
      '</body></html>';

    var win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
  }

  // ── Mini bar chart ─────────────────────────────────────────
  function drawBarChart(canvasId, labels, values, color) {
    var canvas = document.getElementById(canvasId);
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var W = canvas.width = canvas.parentElement.clientWidth || 400;
    var H = canvas.height = canvas.parentElement.clientHeight || 180;
    ctx.clearRect(0, 0, W, H);

    if (!values.length) return;

    var pad = { top: 20, right: 16, bottom: 40, left: 40 };
    var chartW = W - pad.left - pad.right;
    var chartH = H - pad.top - pad.bottom;
    var maxVal = Math.max.apply(null, values) || 1;
    var barW = chartW / values.length * 0.6;
    var barGap = chartW / values.length;

    // Grid lines
    ctx.strokeStyle = 'rgba(148,163,184,0.1)';
    ctx.lineWidth = 1;
    for (var g = 0; g <= 4; g++) {
      var y = pad.top + chartH - (g / 4) * chartH;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + chartW, y); ctx.stroke();
      ctx.fillStyle = 'rgba(148,163,184,0.5)';
      ctx.font = '10px Inter, system-ui';
      ctx.textAlign = 'right';
      ctx.fillText(Math.round(maxVal * g / 4), pad.left - 6, y + 4);
    }

    // Bars
    values.forEach(function (v, i) {
      var x = pad.left + i * barGap + (barGap - barW) / 2;
      var barH = (v / maxVal) * chartH;
      var y = pad.top + chartH - barH;

      // Gradient
      var grad = ctx.createLinearGradient(0, y, 0, y + barH);
      grad.addColorStop(0, color || 'rgba(59,130,246,0.9)');
      grad.addColorStop(1, color ? color.replace('0.9', '0.3') : 'rgba(6,182,212,0.3)');
      ctx.fillStyle = grad;

      // Rounded top bar
      ctx.beginPath();
      ctx.roundRect
        ? ctx.roundRect(x, y, barW, barH, [4, 4, 0, 0])
        : ctx.rect(x, y, barW, barH);
      ctx.fill();

      // Label
      ctx.fillStyle = 'rgba(148,163,184,0.8)';
      ctx.font = '10px Inter, system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(labels[i] || '', x + barW / 2, H - 8);

      // Value on top
      if (v > 0) {
        ctx.fillStyle = 'rgba(241,245,249,0.9)';
        ctx.font = 'bold 10px Inter, system-ui';
        ctx.fillText(v, x + barW / 2, y - 4);
      }
    });
  }

  // ── Number & Money formatting (NIF Colombia) ──────────────
  function fmtNum(n, decimals) {
    if (n === null || n === undefined || isNaN(n) || !isFinite(n)) return '0';
    var d = (decimals !== undefined) ? decimals : 0;
    return Number(n).toLocaleString('es-CO', {
      minimumFractionDigits: d,
      maximumFractionDigits: d
    });
  }

  /**
   * Simple decimal arithmetic helper (Fixed point 4 decimals)
   * Prevents 0.1 + 0.2 = 0.30000000000000004
   */
  var dec = {
    add: function (a, b) { return (Math.round(safeNum(a) * 10000) + Math.round(safeNum(b) * 10000)) / 10000; },
    sub: function (a, b) { return (Math.round(safeNum(a) * 10000) - Math.round(safeNum(b) * 10000)) / 10000; },
    mul: function (a, b) { return (Math.round(safeNum(a) * 10000) * Math.round(safeNum(b) * 10000)) / 100000000; },
    div: function (a, b) { 
      var denominator = safeNum(b);
      if (denominator === 0) return 0;
      return Math.round((safeNum(a) / denominator) * 10000) / 10000; 
    },
    round: function (n, d) { var f = Math.pow(10, d || 0); return Math.round(safeNum(n) * f) / f; }
  };

  // ── Debounce ───────────────────────────────────────────────
  function debounce(fn, ms) {
    var t;
    return function () {
      clearTimeout(t);
      var args = arguments;
      var ctx = this;
      t = setTimeout(function () { fn.apply(ctx, args); }, ms || 300);
    };
  }

  function afterRender(canvasId, callback) {
    var check = function () {
      if (document.getElementById(canvasId)) {
        callback();
      } else {
        requestAnimationFrame(check);
      }
    };
    requestAnimationFrame(check);
  }

  return {
    formatDate: formatDate,
    formatDateTime: formatDateTime,
    toLocalISO: toLocalISO,
    todayISO: todayISO,
    daysAgoISO: daysAgoISO,
    toast: toast,
    confirm: confirm,
    openModal: openModal,
    closeModal: closeModal,
    exportExcel: exportExcel,
    escapeHtml: escapeHtml,
    stockLevel: stockLevel,
    stockBadge: stockBadge,
    otStatusBadge: otStatusBadge,
    priorityBadge: priorityBadge,
    maintenanceTypeBadge: maintenanceTypeBadge,
    printOT: printOT,
    printVehicleHistory: printVehicleHistory,
    drawBarChart: drawBarChart,
    fmtNum: fmtNum,
    dec: dec,
    debounce: debounce,
    afterRender: afterRender,
    safeNum: safeNum,
    OT_STATUS: OT_STATUS,
    PRIORITY_CFG: PRIORITY_CFG,
    MAINTENANCE_TYPES: MAINTENANCE_TYPES
  };
})();
