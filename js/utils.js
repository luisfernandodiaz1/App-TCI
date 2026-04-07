/* ============================================================
   UTILS.JS — Helpers: dates, Excel export, toasts, modals, etc.
   ============================================================ */

var Utils = (function () {
  'use strict';

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

  function todayISO() {
    return new Date().toISOString().split('T')[0];
  }

  function daysAgoISO(n) {
    var d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().split('T')[0];
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
      setTimeout(function() {
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
    correctivo: { label: 'Correctivo', badge: 'badge-blue',  icon: '🛠️' }
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
      (function() {
        var equipoLabel, equipoVal;
        if ((wo.laborEntries || []).length > 1) {
          equipoLabel = 'Equipo Técnico';
          equipoVal = wo.laborEntries.map(function(e){ return escapeHtml(e.name); }).join(', ');
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
      '<h2 style="margin-top:20px;margin-bottom:6px;">Descripción del Trabajo</h2>' +
      '<p style="border:1px solid #ccc;padding:10px;min-height:50px;">' + escapeHtml(wo.description) + '</p>' +
      '<h2 style="margin-top:20px;margin-bottom:6px;">Materiales Solicitados</h2>' +
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
      equipoMostrar = wo.laborEntries.map(function(e) {
        return { name: e.name, hours: e.hours, cost: e.cost, isClosed: true };
      });
    } else {
      // OT abierta: construir desde activityLog — IDs únicos que sean empleados
      var seenIds = {};
      // 1. Siempre incluir el responsable principal
      if (wo.assignedTo) {
        var mainEmpPrint = allEmpsForPrint.find(function(e){ return e.id === wo.assignedTo; });
        if (mainEmpPrint) { seenIds[wo.assignedTo] = true; equipoMostrar.push({ name: mainEmpPrint.name, hours: null, cost: null, isClosed: false }); }
      }
      // 2. Participantes del activityLog
      (wo.activityLog || []).forEach(function(log) {
        if (log.userId && !seenIds[log.userId]) {
          var logEmp = allEmpsForPrint.find(function(e){ return e.id === log.userId; });
          if (logEmp) { seenIds[log.userId] = true; equipoMostrar.push({ name: logEmp.name, hours: null, cost: null, isClosed: false }); }
        }
      });
    }

    html += '<h2 style="margin-top:20px;margin-bottom:6px;">Equipo de Trabajo</h2>';
    if (equipoMostrar.length) {
      if (equipoMostrar[0].isClosed) {
        // Con horas y costos (OT completada)
        html += '<table><thead><tr><th>Mecánico</th><th style="text-align:center;width:100px;">Horas</th><th style="text-align:right;width:130px;">Costo M.O.</th></tr></thead><tbody>';
        equipoMostrar.forEach(function(e) {
          html += '<tr><td>' + escapeHtml(e.name) + '</td><td style="text-align:center;">' + e.hours + ' hrs</td><td style="text-align:right;">$ ' + fmtNum(e.cost) + '</td></tr>';
        });
        html += '</tbody></table>';
      } else {
        // Solo nombres (OT en proceso)
        html += '<table><thead><tr><th>Mecánico</th><th style="text-align:center;width:160px;">Estado</th></tr></thead><tbody>';
        equipoMostrar.forEach(function(e, i) {
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
      signBoxes = equipoMostrar.map(function(e) {
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
    add: function (a, b) { return (Math.round(Number(a) * 10000) + Math.round(Number(b) * 10000)) / 10000; },
    sub: function (a, b) { return (Math.round(Number(a) * 10000) - Math.round(Number(b) * 10000)) / 10000; },
    mul: function (a, b) { return (Math.round(Number(a) * 10000) * Math.round(Number(b) * 10000)) / 100000000; },
    div: function (a, b) { return Math.round((Number(a) / Number(b)) * 10000) / 10000; },
    round: function (n, d) { var f = Math.pow(10, d || 0); return Math.round(Number(n) * f) / f; }
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
    drawBarChart: drawBarChart,
    fmtNum: fmtNum,
    dec: dec,
    debounce: debounce,
    afterRender: afterRender,
    OT_STATUS: OT_STATUS,
    PRIORITY_CFG: PRIORITY_CFG,
    MAINTENANCE_TYPES: MAINTENANCE_TYPES
  };
})();
