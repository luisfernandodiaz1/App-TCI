/* ============================================================
   PURCHASING.JS — Purchasing & Shortages module (Compras)
   ============================================================ */

var PurchasingModule = (function () {
  'use strict';

  function render() {
    var items = DB.getAll('items');
    var wos = DB.getAll('workOrders');

    var pendingDemand = {}; // itemId -> qty needed
    var activeStatuses = ['emitida', 'en_proceso', 'esperando_repuestos', 'esperando_repuestos_externo'];
    wos.filter(function (w) { return activeStatuses.indexOf(w.status) !== -1; }).forEach(function (wo) {
      (wo.materials || []).forEach(function (m) {
        var pending = m.qtyRequested - (m.qtyDelivered || 0);
        if (pending > 0) {
          pendingDemand[m.itemId] = (pendingDemand[m.itemId] || 0) + pending;
        }
      });
    });

    // 2. Identify missing / critical items
    var suggestions = [];
    items.forEach(function (item) {
      var demand = pendingDemand[item.id] || 0;
      var critical = item.stock <= item.minStock;
      var blocksOT = demand > item.stock;

      if (critical || blocksOT) {
        var suggestedOrder = Math.max(item.minStock * 2, demand + item.minStock) - item.stock;
        suggestions.push({
          item: item,
          demand: demand,
          blocks: blocksOT,
          critical: critical,
          suggested: suggestedOrder > 0 ? suggestedOrder : (item.minStock || 1)
        });
      }
    });

    // Sort: Blocking OTs first, then critical stock
    suggestions.sort(function (a, b) {
      if (a.blocks && !b.blocks) return -1;
      if (!a.blocks && b.blocks) return 1;
      return a.item.name.localeCompare(b.item.name);
    });

    var html = '<div class="section-header">' +
      '<div class="section-header-left"><h2>🛒 Compras y Faltantes</h2></div>' +
      '<div class="flex gap-2">' +
      '<button class="btn btn-secondary btn-sm" onclick="PurchasingModule.exportExcel()">📤 Exportar Excel</button>' +
      '</div>' +
      '</div>';

    html += '<div class="grid-3" style="margin-bottom:24px;">' +
      '<div class="kpi-card red"><div class="kpi-icon red">🛑</div><div class="kpi-value">' + suggestions.filter(function (s) { return s.blocks; }).length + '</div><div class="kpi-label">Artículos Bloqueando OTs</div></div>' +
      '<div class="kpi-card amber"><div class="kpi-icon amber">⚠️</div><div class="kpi-value">' + suggestions.filter(function (s) { return !s.blocks && s.critical; }).length + '</div><div class="kpi-label">Stock Crítico o Bajo</div></div>' +
      '<div class="kpi-card blue"><div class="kpi-icon blue">📦</div><div class="kpi-value">' + suggestions.length + '</div><div class="kpi-label">Total Sugerencias de Compra</div></div>' +
      '</div>';

    if (!suggestions.length) {
      html += '<div class="card"><div class="empty-state"><div class="empty-state-icon">✅</div><h3>Inventario Saludable</h3><p>No hay OTs bloqueadas por repuestos ni artículos por debajo del stock mínimo.</p></div></div>';
    } else {
      html += '<div class="card" style="padding:0;"><div class="card-header" style="padding:16px 20px;"><h3>Sugerencias de Reabastecimiento</h3></div>' +
        '<div class="table-wrapper"><table><thead><tr>' +
        '<th>Artículo</th><th>Código</th><th>Estado</th><th>Stock Actual</th><th>Mínimo</th><th>Falta para OTs</th><th>Sugerencia Compra</th><th>Acciones</th>' +
        '</tr></thead><tbody>' +
        suggestions.map(function (s) {
          var badge = s.blocks ? '<span class="badge badge-red">Alerta OT</span>' : '<span class="badge badge-amber">Stock Bajo</span>';
          return '<tr>' +
            '<td style="font-weight:600;">' + Utils.escapeHtml(s.item.name) + '</td>' +
            '<td class="text-secondary text-sm">' + Utils.escapeHtml(s.item.code) + '</td>' +
            '<td>' + badge + '</td>' +
            '<td style="' + (s.item.stock === 0 ? 'color:var(--color-danger);font-weight:700;' : '') + '">' + s.item.stock + ' ' + s.item.unit + '</td>' +
            '<td class="text-secondary">' + s.item.minStock + ' ' + s.item.unit + '</td>' +
            '<td style="color:var(--color-warning);font-weight:600;">' + (s.demand > 0 ? s.demand + ' unid.' : '—') + '</td>' +
            '<td><strong>+' + s.suggested + '</strong></td>' +
            '<td><button class="btn btn-success btn-sm" onclick="App.go(\'inventory\');setTimeout(function(){InventoryModule.showMovementModal(\'' + Utils.escapeHtml(s.item.id) + '\',\'entrada\')},100)">📦 Ingresar</button></td>' +
            '</tr>';
        }).join('') +
        '</tbody></table></div></div>';
    }

    document.getElementById('section-purchasing').innerHTML = html;
  }

  function exportExcel() {
    var items = DB.getAll('items');
    var wos = DB.getAll('workOrders');
    var cats = DB.getAll('categories');
    var catMap = {}; cats.forEach(function (c) { catMap[c.id] = c.name; });
    var pendingDemand = {};
    var activeStatuses = ['emitida', 'en_proceso', 'esperando_repuestos', 'esperando_repuestos_externo'];
    wos.filter(function (w) { return activeStatuses.indexOf(w.status) !== -1; }).forEach(function (wo) {
      (wo.materials || []).forEach(function (m) {
        var pending = m.qtyRequested - (m.qtyDelivered || 0);
        if (pending > 0) pendingDemand[m.itemId] = (pendingDemand[m.itemId] || 0) + pending;
      });
    });

    var rows = [];
    items.forEach(function (item) {
      var demand = pendingDemand[item.id] || 0;
      var blocks = demand > item.stock;
      if (item.stock <= item.minStock || blocks) {
        rows.push([
          item.code, item.name, catMap[item.categoryId] || '—', item.stock, item.minStock, demand,
          blocks ? 'BLOQUEANDO OTs' : 'Bajo Stock',
          Math.max(item.minStock * 2, demand + item.minStock) - item.stock
        ]);
      }
    });

    Utils.exportExcel('sugerencias_compra_' + Utils.todayISO() + '.xlsx', 'Sugerencias de Compra y Reabastecimiento',
      ['Código', 'Artículo', 'Categoría', 'Stock Actual', 'Stock Mínimo', 'Demanda OT Pendiente', 'Estado', 'Sugerencia de Compra (Unid)'],
      rows);
    Utils.toast('Lista de compras exportada a Excel.', 'success');
  }

  return { render: render, exportExcel: exportExcel };
})();
