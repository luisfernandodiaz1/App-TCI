/* ============================================================
   INVENTORY.JS — Inventory module with advanced filters
   ============================================================ */

var InventoryModule = (function () {
  'use strict';

  var currentTab = 'dashboard';
  var filterCategory = '', searchText = '';
  var filterStockLevel = ''; // '' | 'critical' | 'low' | 'ok'
  var filterPriceMin = '', filterPriceMax = '';
  var showAdvancedFilters = false;
  var invFilterFrom = '', invFilterTo = '';

  function render() {
    var container = document.getElementById('section-inventory');
    if (!container) return;

    // 1. Estructura base (solo si no existe)
    if (!container.querySelector('.section-header')) {
      container.innerHTML =
        '<div class="section-header">' +
        '<div class="section-header-left"><h2>📦 Inventario</h2></div>' +
        '<div class="flex gap-2">' +
        '<button class="btn btn-secondary btn-sm" id="inv-export-btn">📤 Exportar Excel</button>' +
        '<button class="btn btn-primary" id="inv-add-btn">+ Nuevo Artículo</button>' +
        '</div>' +
        '</div>' +
        '<div class="tabs">' +
        '<button class="tab-btn ' + (currentTab === 'dashboard' ? 'active' : '') + '" data-tab="dashboard">📊 Centro de Mando</button>' +
        '<button class="tab-btn ' + (currentTab === 'items' ? 'active' : '') + '" data-tab="items">📦 Artículos</button>' +
        '<button class="tab-btn ' + (currentTab === 'categories' ? 'active' : '') + '" data-tab="categories">🗂️ Categorías</button>' +
        '<button class="tab-btn ' + (currentTab === 'movements' ? 'active' : '') + '" data-tab="movements">🔄 Movimientos</button>' +
        '</div>' +
        '<div id="inv-tab-content"></div>';

      // Eventos base
      container.querySelectorAll('.tab-btn').forEach(function (btn) {
        btn.onclick = function () { currentTab = btn.dataset.tab; render(); };
      });
      document.getElementById('inv-export-btn').onclick = exportExcel;
      document.getElementById('inv-add-btn').onclick = function () {
        if (currentTab === 'categories') showCategoryModal();
        else if (currentTab === 'movements') showMovementModal(null, 'entrada');
        else showItemModal();
      };
    }

    // 2. Actualizar estado visual de pestañas
    container.querySelectorAll('.tab-btn').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.tab === currentTab);
    });

    // 3. Renderizar contenido de la pestaña
    if (currentTab === 'dashboard') renderDashboard();
    else if (currentTab === 'items') renderItems();
    else if (currentTab === 'categories') renderCategories();
    else if (currentTab === 'movements') renderMovements();
  }

  function kpi(icon, label, value, colorClass) {
    return '<div class="kpi-card ' + colorClass + '" style="background:var(--bg-elevated);border-left:4px solid var(--color-' + (colorClass === 'green' ? 'success' : colorClass === 'red' ? 'danger' : colorClass === 'amber' ? 'warning' : colorClass === 'blue' ? 'primary' : colorClass) + ');">' +
      '<div class="display-flex justify-between items-center">' +
      '<div><div class="kpi-label">' + label + '</div><div class="kpi-value" style="font-size:1.6rem;">' + value + '</div></div>' +
      '<div class="kpi-icon ' + colorClass + '" style="opacity:0.8;font-size:1.5rem;">' + icon + '</div>' +
      '</div>' +
      '</div>';
  }

  function renderDashboard() {
    var today = Utils.todayISO();
    var firstOfMonth = today.substring(0, 7) + '-01';
    if (!invFilterFrom) invFilterFrom = firstOfMonth;
    if (!invFilterTo) invFilterTo = today;

    var items = DB.getAll('items');
    var movements = DB.getAll('movements');

    // Filter movements by selected date range
    var movs = movements.filter(function (m) { return m.date >= invFilterFrom && m.date <= invFilterTo; });

    // Cálculos de precisión decimal
    var totalInmovilizado = items.reduce(function (a, i) {
      return Utils.dec.add(a, Utils.dec.mul(i.stock, i.unitCost));
    }, 0);

    var entradasMes = movs.filter(function (m) { return m.type === 'entrada'; }).reduce(function (a, m) {
      return Utils.dec.add(a, m.totalCost);
    }, 0);
    var salidasMes = movs.filter(function (m) { return m.type === 'salida'; }).reduce(function (a, m) {
      return Utils.dec.add(a, m.totalCost);
    }, 0);

    // Calcular top consumidos
    var itemConsumptions = {};
    movs.filter(function (m) { return m.type === 'salida'; }).forEach(function (m) {
      if (!itemConsumptions[m.itemId]) itemConsumptions[m.itemId] = { id: m.itemId, name: m.itemName || '-', qty: 0, cost: 0 };
      itemConsumptions[m.itemId].qty += m.qty;
      itemConsumptions[m.itemId].cost = Utils.dec.add(itemConsumptions[m.itemId].cost, m.totalCost || 0);
    });
    var topItems = Object.values(itemConsumptions).sort(function (a, b) { return b.cost - a.cost; }).slice(0, 5);

    // Artículos Críticos (Radar)
    var criticals = items.filter(function (i) { return Utils.stockLevel(i) === 'critical'; });
    var lowStock = items.filter(function (i) { return Utils.stockLevel(i) === 'low'; });

    var container = document.getElementById('inv-tab-content');
    if (!container) return;

    // 1. Estructura del Dashboard (solo si no existe)
    if (!container.querySelector('.card h3')) {
      container.innerHTML =
        '<div class="card" style="margin-bottom:20px;" id="inv-dash-header-card">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:16px;">' +
        '<div>' +
        '<h3 style="margin:0 0 4px 0;">📊 Panel de Control Logístico</h3>' +
        '<div style="font-size:0.8rem;color:var(--text-muted);">Análisis de rotación, alertas de mantenimiento de inventario y gastos.</div>' +
        '</div>' +
        '<div style="display:flex;align-items:end;gap:12px;">' +
        '<div class="form-group" style="margin:0;">' +
        '<label style="font-size:0.75rem;">Desde</label>' +
        '<input type="date" id="inv-dash-from" class="form-control" value="' + invFilterFrom + '" max="' + today + '" style="font-size:0.85rem;">' +
        '</div>' +
        '<div class="form-group" style="margin:0;">' +
        '<label style="font-size:0.75rem;">Hasta</label>' +
        '<input type="date" id="inv-dash-to" class="form-control" value="' + invFilterTo + '" max="' + today + '" style="font-size:0.85rem;">' +
        '</div>' +
        '</div>' +
        '</div>' +
        '<div class="grid-4" id="inv-dash-kpis" style="margin-top:16px;"></div>' +
        '</div>' +
        '<div class="grid-2" style="margin-bottom:20px;" id="inv-dash-grids"></div>' +
        '<div class="card" id="inv-dash-chart-card">' +
        '<h4 style="margin-top:0;">📈 Gráfico de Compras vs Consumo Operacional (Últimos 6 meses)</h4>' +
        '<div style="height: 250px; position:relative;"><canvas id="inv-chart"></canvas></div>' +
        '</div>';

      // Listeners inmediatos
      document.getElementById('inv-dash-from').onchange = function (e) { invFilterFrom = e.target.value; renderDashboard(); };
      document.getElementById('inv-dash-to').onchange = function (e) { invFilterTo = e.target.value; renderDashboard(); };
    }

    // 2. Actualizar KPIs
    document.getElementById('inv-dash-kpis').innerHTML =
      kpi('💰', 'Capital Inmovilizado', '$ ' + Utils.fmtNum(totalInmovilizado), 'blue') +
      kpi('📥', 'Gasto en Compras (Mes)', '$ ' + Utils.fmtNum(entradasMes), entradasMes > 0 ? 'amber' : 'cyan') +
      kpi('📤', 'Consumo Operacional (Mes)', '$ ' + Utils.fmtNum(salidasMes), salidasMes > 0 ? 'green' : 'cyan') +
      kpi('🚨', 'Alertas de Stock', (criticals.length + lowStock.length), (criticals.length > 0 ? 'red' : (lowStock.length > 0 ? 'amber' : 'green')));

    // 3. Actualizar Grids (Top Consumo + Radar)
    var gridHtml = '';

    // Top Consumo
    gridHtml += '<div class="card" style="padding:0;">' +
      '<div class="card-header" style="padding:16px 20px;"><h4 style="margin:0;">🔥 Top Artículos Gasto</h4></div>' +
      '<div class="table-wrapper"><table><tbody>';
    if (!topItems.length) gridHtml += '<tr><td><p class="text-sm text-center py-4">No hay salidas este período.</p></td></tr>';
    else topItems.forEach(function (ti, idx) {
      gridHtml += '<tr><td style="width:30px;">#' + (idx + 1) + '</td><td>' + Utils.escapeHtml(ti.name) + '</td><td>$ ' + Utils.fmtNum(ti.cost) + '</td></tr>';
    });
    gridHtml += '</tbody></table></div></div>';

    // Radar
    gridHtml += '<div class="card" style="padding:0; border-top: 4px solid var(--color-danger);">' +
      '<div class="card-header" style="padding:16px 20px;"><h4 style="margin:0;color:var(--color-danger);">🚨 Radar</h4></div>' +
      '<div class="table-wrapper"><table><tbody>';
    var allAlerts = criticals.concat(lowStock);
    if (!allAlerts.length) gridHtml += '<tr><td><p class="text-sm text-center py-4">Inventario Sano</p></td></tr>';
    else allAlerts.forEach(function (item) {
      gridHtml += '<tr><td>' + Utils.escapeHtml(item.name) + '</td><td><strong>' + item.stock + '</strong>/' + item.minStock + '</td></tr>';
    });
    gridHtml += '</tbody></table></div></div>';

    document.getElementById('inv-dash-grids').innerHTML = gridHtml;

    // Dibujar la gráfica
    Utils.afterRender('inv-chart', function () {
      var monthlyMoves = {};
      var maxMonths = 6;
      var d = new Date(); // Always start from current real month to get the last 6 months regardless of filter
      d.setDate(1);
      var monthKeys = [];
      for (var i = 0; i < maxMonths; i++) {
        var key = Utils.toLocalISO(d).substring(0, 7);
        monthKeys.unshift(key);
        monthlyMoves[key] = { entradas: 0, salidas: 0 };
        d.setMonth(d.getMonth() - 1);
      }

      movements.forEach(function (m) {
        var mk = m.date.substring(0, 7);
        if (monthlyMoves[mk]) {
          if (m.type === 'entrada') monthlyMoves[mk].entradas = Utils.dec.add(monthlyMoves[mk].entradas, m.totalCost || 0);
          if (m.type === 'salida') monthlyMoves[mk].salidas = Utils.dec.add(monthlyMoves[mk].salidas, m.totalCost || 0);
        }
      });

      var labels = monthKeys.map(function (mk) {
        var p = mk.split('-');
        return p[1] + '/' + p[0];
      });
      var dataEntradas = monthKeys.map(function (mk) { return monthlyMoves[mk].entradas; });
      var dataSalidas = monthKeys.map(function (mk) { return monthlyMoves[mk].salidas; });

      var ctx = document.getElementById('inv-chart');
      if (ctx && window.Chart) {
        new Chart(ctx, {
          type: 'bar',
          data: {
            labels: labels,
            datasets: [
              {
                label: 'Inversión (Compras) $',
                data: dataEntradas,
                backgroundColor: 'rgba(56, 189, 248, 0.9)', // cyan
                borderRadius: 4
              },
              {
                label: 'Consumo (Salidas) $',
                data: dataSalidas,
                backgroundColor: 'rgba(34, 197, 94, 0.9)', // green
                borderRadius: 4
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { tooltip: { mode: 'index', intersect: false } },
            scales: {
              x: { stacked: false, grid: { display: false } },
              y: { stacked: false, beginAtZero: true, border: { dash: [4, 4] } }
            }
          }
        });
      } else if (ctx) {
        // Fallback a nuestra implementación manual de Utils si Chart.js no está
        Utils.drawBarChart('inv-chart', labels, dataEntradas, 'rgba(56, 189, 248, 0.9)');
      }
    });
  }

  function renderItems() {
    var categories = DB.getAll('categories');
    var items = getFilteredItems();
    var allItems = DB.getAll('items');
    var catMap = {};
    categories.forEach(function (c) { catMap[c.id] = c.name; });

    var critCount = allItems.filter(function (i) { return Utils.stockLevel(i) === 'critical'; }).length;
    var lowCount = allItems.filter(function (i) { return Utils.stockLevel(i) === 'low'; }).length;

    var tabContent = document.getElementById('inv-tab-content');
    if (!tabContent) return;

    // 1. Estructura de la lista (solo si no existe el toolbar)
    if (!tabContent.querySelector('.toolbar')) {
      tabContent.innerHTML =
        '<div class="toolbar" style="display:flex;gap:12px;margin-bottom:12px;">' +
        '<div class="search-bar" style="flex:1;"><span>🔍</span><input type="text" placeholder="Buscar por código, nombre, categoría..." id="inv-search" value="' + Utils.escapeHtml(searchText) + '"></div>' +
        '<select class="filter-select" id="inv-filter-cat"><option value="">Todas las categorías</option>' +
        categories.map(function (c) { return '<option value="' + c.id + '"' + (filterCategory === c.id ? ' selected' : '') + '>' + Utils.escapeHtml(c.name) + '</option>'; }).join('') +
        '</select>' +
        '</div>' +
        '<div id="inv-items-status-bar"></div>' +
        '<div id="inv-items-list"></div>';

      // Listeners estables
      var si = document.getElementById('inv-search');
      if (si) si.oninput = Utils.debounce(function () { searchText = si.value; renderItems(); }, 250);
      var fc = document.getElementById('inv-filter-cat');
      if (fc) fc.onchange = function () { filterCategory = fc.value; renderItems(); };
    }

    // 2. Barra de Estado (Dashboard rápido)
    var totalValue = items.reduce(function (sum, i) {
      return Utils.dec.add(sum, Utils.dec.mul(i.stock, i.unitCost));
    }, 0);

    var statusBar = document.getElementById('inv-items-status-bar');
    if (statusBar) {
      statusBar.innerHTML =
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:20px;flex-wrap:wrap;">' +
        '<span style="font-size:0.75rem;color:var(--text-muted);font-weight:700;text-transform:uppercase;margin-right:4px;">Estado de Stock:</span>' +
        '<button class="badge ' + (filterStockLevel === '' ? 'badge-blue' : 'badge-gray') + '" style="cursor:pointer;border:none;padding:6px 12px;font-size:0.8rem;" onclick="InventoryModule.setInvFilterLvl(\'\')">Todos</button>' +
        '<button class="badge ' + (filterStockLevel === 'critical' ? 'badge-red' : 'badge-gray') + '" style="cursor:pointer;border:none;padding:6px 12px;font-size:0.8rem;" onclick="InventoryModule.setInvFilterLvl(\'critical\')">🔴 Críticos (' + critCount + ')</button>' +
        '<button class="badge ' + (filterStockLevel === 'low' ? 'badge-amber' : 'badge-gray') + '" style="cursor:pointer;border:none;padding:6px 12px;font-size:0.8rem;" onclick="InventoryModule.setInvFilterLvl(\'low\')">⚠️ Bajos (' + lowCount + ')</button>' +
        '<button class="badge ' + (filterStockLevel === 'ok' ? 'badge-green' : 'badge-gray') + '" style="cursor:pointer;border:none;padding:6px 12px;font-size:0.8rem;" onclick="InventoryModule.setInvFilterLvl(\'ok\')">✅ Sanos</button>' +
        '<div style="flex:1;"></div>' +
        '<div class="flex items-center gap-3">' +
        '<span class="badge badge-gray" style="font-size:0.9rem;">💰 Valor Total: $ ' + Utils.fmtNum(totalValue) + '</span>' +
        '<span class="text-secondary text-sm">' + items.length + ' artículos</span>' +
        '</div>' +
        '</div>';
    }

    // 3. Tabla de Resultados
    var itemsHtml = '';
    if (!items.length) {
      itemsHtml = '<div class="card"><div class="empty-state"><div class="empty-state-icon">📦</div><h3>No hay artículos con los filtros actuales</h3></div></div>';
    } else {
      itemsHtml = '<div class="card" style="padding:0;"><div class="table-wrapper"><table><thead><tr>' +
        '<th>Código</th><th>Artículo</th><th>Categoría</th><th>Stock</th><th>Costo U.</th><th>Total (Base)</th><th>Acciones</th>' +
        '</tr></thead><tbody>' +
        items.map(function (item) {
          var totalV = Utils.dec.mul(item.stock, item.unitCost || 0);
          return '<tr>' +
            '<td><code style="background:var(--bg-elevated);padding:2px 8px;border-radius:4px;font-size:0.75rem;">' + Utils.escapeHtml(item.code || '—') + '</code></td>' +
            '<td><div class="font-medium">' + Utils.escapeHtml(item.name) + '</div></td>' +
            '<td>' + Utils.escapeHtml(catMap[item.categoryId] || '—') + '</td>' +
            '<td><strong>' + Utils.fmtNum(item.stock) + '</strong> <span class="text-muted text-xs">' + Utils.escapeHtml(item.unit) + '</span>' + (item.active === false ? '<br><span class="badge badge-red" style="font-size:0.65rem;padding:2px 4px;">Inactivo</span>' : '') + '</td>' +
            '<td>$ ' + Utils.fmtNum(item.unitCost || 0) + '</td>' +
            '<td><strong>$ ' + Utils.fmtNum(totalV) + '</strong></td>' +
            '<td><div class="table-actions">' +
            '<button class="btn btn-ghost btn-sm" onclick="InventoryModule.showMovementModal(\'' + item.id + '\',\'entrada\')">➕</button>' +
            '<button class="btn btn-ghost btn-sm" onclick="InventoryModule.showItemHistory(\'' + item.id + '\')">📋</button>' +
            '<button class="btn btn-ghost btn-sm" onclick="InventoryModule.showItemModal(\'' + item.id + '\')">✏️</button>' +
            '<button class="btn btn-ghost btn-sm text-danger" onclick="InventoryModule.deleteItem(\'' + item.id + '\')">🗑️</button>' +
            '</div></td></tr>';
        }).join('') +
        '</tbody></table></div><div class="pagination"><span>' + items.length + ' artículos encontrados</span></div></div>';
    }

    var listContainer = document.getElementById('inv-items-list');
    if (listContainer) listContainer.innerHTML = itemsHtml;
  }

  function getFilteredItems() {
    var items = DB.getAll('items');
    if (filterCategory) items = items.filter(function (i) { return i.categoryId === filterCategory; });
    if (filterStockLevel) items = items.filter(function (i) { return Utils.stockLevel(i) === filterStockLevel; });
    if (filterPriceMin !== '') { var mn = parseFloat(filterPriceMin); if (!isNaN(mn)) items = items.filter(function (i) { return (i.unitCost || 0) >= mn; }); }
    if (filterPriceMax !== '') { var mx = parseFloat(filterPriceMax); if (!isNaN(mx)) items = items.filter(function (i) { return (i.unitCost || 0) <= mx; }); }
    if (searchText) {
      var q = searchText.toLowerCase();
      items = items.filter(function (i) {
        return (i.name || '').toLowerCase().includes(q) ||
          (i.code || '').toLowerCase().includes(q) ||
          (i.description || '').toLowerCase().includes(q) ||
          (i.location || '').toLowerCase().includes(q);
      });
    }
    return items;
  }

  // ── Historial por artículo ────────────────────────────────
  function showItemHistory(itemId) {
    var item = DB.getById('items', itemId);
    if (!item) return;
    var movs = DB.getAll('movements').filter(function (m) { return m.itemId === itemId; }).slice().reverse();
    var users = DB.getAll('users');
    var uMap = {}; users.forEach(function (u) { uMap[u.id] = u.name; });
    var old = document.getElementById('hist-item-modal'); if (old) old.remove();

    var totalEntradas = movs.filter(function (m) { return m.type === 'entrada'; }).reduce(function (a, m) { return a + m.qty; }, 0);
    var totalSalidas = movs.filter(function (m) { return m.type === 'salida'; }).reduce(function (a, m) { return a + m.qty; }, 0);
    var totalCostoEntradas = movs.filter(function (m) { return m.type === 'entrada'; }).reduce(function (a, m) { return Utils.dec.add(a, m.totalCost || 0); }, 0);
    var totalCostoSalidas = movs.filter(function (m) { return m.type === 'salida'; }).reduce(function (a, m) { return Utils.dec.add(a, m.totalCost || 0); }, 0);

    var html = '<div class="modal-overlay" id="hist-item-modal"><div class="modal modal-lg">' +
      '<div class="modal-header">' +
      '<div><h3>📋 Historial — ' + Utils.escapeHtml(item.name) + '</h3>' +
      '<div class="text-xs text-muted">Código: ' + Utils.escapeHtml(item.code || '—') + ' · Stock actual: ' + item.stock + ' ' + Utils.escapeHtml(item.unit) + '</div>' +
      '</div>' +
      '<button class="modal-close" id="hitem-close">✕</button>' +
      '</div>' +
      '<div class="modal-body">' +
      '<div class="grid-3" style="margin-bottom:16px;">' +
      '<div class="kpi-card green"><div class="kpi-icon green">⬆️</div><div class="kpi-value">' + totalEntradas + '</div><div class="kpi-label">Total Entradas</div></div>' +
      '<div class="kpi-card red"><div class="kpi-icon red">⬇️</div><div class="kpi-value">' + totalSalidas + '</div><div class="kpi-label">Total Salidas</div></div>' +
      '<div class="kpi-card blue"><div class="kpi-icon blue">📋</div><div class="kpi-value">' + movs.length + '</div><div class="kpi-label">Total Movimientos</div></div>' +
      '</div>' +
      (!movs.length ? '<div class="empty-state" style="padding:32px;"><div class="empty-state-icon">📭</div><p>Sin movimientos registrados para este artículo.</p></div>' :
        '<div class="table-wrapper"><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Cantidad</th><th>Costo U.</th><th>Total</th><th>Referencia</th><th>Notas</th><th>Usuario</th></tr></thead><tbody>' +
        movs.map(function (m) {
          return '<tr>' +
            '<td>' + Utils.formatDate(m.date) + '</td>' +
            '<td>' + (m.type === 'entrada' ? '<span class="badge badge-amber">⬆️ Compra</span>' : (m.type === 'salida' ? '<span class="badge badge-green">⬇️ Consumo</span>' : '<span class="badge badge-blue">🔄 Ajuste</span>')) + '</td>' +
            '<td><strong>' + Utils.fmtNum(m.qty) + '</strong></td>' +
            '<td>$ ' + Utils.fmtNum(m.unitCost || 0) + '</td>' +
            '<td>$ ' + Utils.fmtNum(m.totalCost || 0) + '</td>' +
            '<td>' + Utils.escapeHtml(m.reference || '—') + '</td>' +
            '<td class="text-secondary">' + Utils.escapeHtml(m.notes || '—') + '</td>' +
            '<td>' + Utils.escapeHtml(uMap[m.userId] || '—') + '</td>' +
            '</tr>';
        }).join('') +
        '</tbody></table></div>') +
      '</div>' +
      '</div></div>';

    document.body.insertAdjacentHTML('beforeend', html);
    var ov = document.getElementById('hist-item-modal');
    document.getElementById('hitem-close').onclick = function () { ov.remove(); };
    ov.onclick = function (e) { if (e.target === ov) ov.remove(); };
  }

  function renderCategories() {
    var categories = DB.getAll('categories');
    var items = DB.getAll('items');
    document.getElementById('inv-add-btn').textContent = '+ Nueva Categoría';
    document.getElementById('inv-add-btn').onclick = showCategoryModal;

    var colorHex = { blue: '#3B82F6', cyan: '#06B6D4', amber: '#F59E0B', green: '#10B981', purple: '#8B5CF6', red: '#EF4444', orange: '#F97316' };

    var html = !categories.length
      ? '<div class="card"><div class="empty-state"><div class="empty-state-icon">🗂️</div><h3>Sin categorías</h3></div></div>'
      : '<div class="grid-3">' + categories.map(function (cat) {
        var count = items.filter(function (i) { return i.categoryId === cat.id; }).length;
        var c = colorHex[cat.color] || '#3B82F6';
        return '<div class="card" style="border-top:3px solid ' + c + ';">' +
          '<div class="flex justify-between items-center"><h3>' + Utils.escapeHtml(cat.name) + '</h3>' +
          '<div class="flex gap-1"><button class="btn btn-ghost btn-sm" onclick="InventoryModule.showCategoryModal(\'' + cat.id + '\')">✏️</button>' +
          '<button class="btn btn-ghost btn-sm" onclick="InventoryModule.deleteCategory(\'' + cat.id + '\')">🗑️</button></div></div>' +
          '<p class="text-secondary text-sm" style="margin-top:4px;">' + Utils.escapeHtml(cat.description || '') + '</p>' +
          '<div style="margin-top:12px;"><span class="badge badge-blue">' + count + ' artículos</span></div></div>';
      }).join('') + '</div>';

    document.getElementById('inv-tab-content').innerHTML = html;
  }

  function renderMovements() {
    var today = Utils.todayISO();
    var firstOfMonth = today.substring(0, 7) + '-01';
    if (!invFilterFrom) invFilterFrom = firstOfMonth;
    if (!invFilterTo) invFilterTo = today;

    var allMovements = DB.getAll('movements');
    var movements = allMovements.filter(function (m) { return m.date >= invFilterFrom && m.date <= invFilterTo; }).slice().reverse();
    var items = DB.getAll('items'); var users = DB.getAll('users');
    var iMap = {}, uMap = {};
    items.forEach(function (i) { iMap[i.id] = i.name; });
    users.forEach(function (u) { uMap[u.id] = u.name; });

    document.getElementById('inv-add-btn').textContent = '+ Registrar Entrada';
    document.getElementById('inv-add-btn').onclick = function () { showMovementModal(null, 'entrada'); };

    var totalEntradas = movements.filter(function (m) { return m.type === 'entrada'; }).reduce(function (a, m) { return Utils.dec.add(a, m.totalCost || 0); }, 0);
    var totalSalidas = movements.filter(function (m) { return m.type === 'salida'; }).reduce(function (a, m) { return Utils.dec.add(a, m.totalCost || 0); }, 0);

    var html = '<div class="card" style="margin-bottom:20px;">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:16px;">' +
      '<div><h3 style="margin:0 0 4px 0;">📊 Historial de Movimientos</h3><div style="font-size:0.8rem;color:var(--text-muted);">Registro detallado de entradas, salidas y ajustes de stock.</div></div>' +
      '<div style="display:flex;align-items:end;gap:12px;">' +
      '<div class="form-group" style="margin:0;"><label style="font-size:0.75rem;">Desde</label><input type="date" id="mov-dash-from" class="form-control" value="' + invFilterFrom + '" max="' + today + '" style="font-size:0.85rem;"></div>' +
      '<div class="form-group" style="margin:0;"><label style="font-size:0.75rem;">Hasta</label><input type="date" id="mov-dash-to" class="form-control" value="' + invFilterTo + '" max="' + today + '" style="font-size:0.85rem;"></div>' +
      '</div>' +
      '</div>' +
      '<div class="grid-3" style="margin-bottom:20px;">' +
      kpi('📋', 'Movimientos Totales', movements.length, 'blue') +
      kpi('📥', 'Inversión en Compras', '$ ' + Utils.fmtNum(totalEntradas), 'amber') +
      kpi('📤', 'Costo Operativo Consumido', '$ ' + Utils.fmtNum(totalSalidas), 'green') +
      '</div>';


    if (!movements.length) {
      html += '<div class="empty-state"><div class="empty-state-icon">📋</div><h3>Sin movimientos en el período</h3><p>Ajusta el rango de fechas</p></div>';
    } else {
      html += '<div class="table-wrapper"><table><thead><tr>' +
        '<th>Fecha</th><th>Artículo</th><th>Tipo</th><th>Cant.</th><th>Costo U.</th><th>Costo Total</th><th>Ref.</th><th>Notas</th><th>Por</th>' +
        '</tr></thead><tbody>' +
        movements.map(function (m) {
          return '<tr><td><strong>' + Utils.formatDate(m.date) + '</strong></td><td><span style="font-weight:700;">' + Utils.escapeHtml(iMap[m.itemId] || '—') + '</span></td>' +
            '<td>' + (m.type === 'entrada' ? '<span class="badge badge-amber">⬆️ Compra</span>' : (m.type === 'salida' ? '<span class="badge badge-green">⬇️ Consumo</span>' : '<span class="badge badge-blue">🔄 Ajuste</span>')) + '</td>' +
            '<td><strong>' + Utils.fmtNum(m.qty) + '</strong></td>' +
            '<td>$ ' + Utils.fmtNum(m.unitCost || 0) + '</td>' +
            '<td style="font-weight:700;color:' + (m.type === 'entrada' ? 'var(--color-warning)' : 'var(--color-success)') + ';">$ ' + Utils.fmtNum(m.totalCost || 0) + '</td>' +
            '<td>' + Utils.escapeHtml(m.reference || '—') + '</td>' +
            '<td class="text-secondary text-sm">' + Utils.escapeHtml(m.notes || '—') + '</td><td class="text-sm">' + Utils.escapeHtml(uMap[m.userId] || '—') + '</td></tr>';
        }).join('') +
        '</tbody></table></div>' +
        '<div class="p-4 text-center">' +
        '<button class="btn btn-ghost" onclick="App.loadMore(\'movements\')">🔄 Cargar registros anteriores</button>' +
        '</div>' +
        '<div class="pagination"><span>' + movements.length + ' movimientos cargados</span></div></div>';
    }

    html += '</div>';

    document.getElementById('inv-tab-content').innerHTML = html;

    var dFrom = document.getElementById('mov-dash-from');
    var dTo = document.getElementById('mov-dash-to');
    if (dFrom) dFrom.onchange = function (e) { invFilterFrom = e.target.value; renderMovements(); };
    if (dTo) dTo.onchange = function (e) { invFilterTo = e.target.value; renderMovements(); };
  }

  function showItemModal(id) {
    var item = id ? DB.getById('items', id) : null;
    var cats = DB.getAll('categories');
    var old = document.getElementById('item-modal'); if (old) old.remove();

    var catOpts = cats.map(function (c) { return '<option value="' + c.id + '"' + (item && item.categoryId === c.id ? ' selected' : '') + '>' + Utils.escapeHtml(c.name) + '</option>'; }).join('');

    var html = '<div class="modal-overlay" id="item-modal"><div class="modal">' +
      '<div class="modal-header"><h3>' + (item ? '✏️ Editar Artículo' : '+ Nuevo Artículo') + '</h3><button class="modal-close" id="item-mc">✕</button></div>' +
      '<div class="modal-body"><div class="form-grid">' +
      '<div class="form-group"><label>Código *</label><input class="form-input" id="if-code" value="' + Utils.escapeHtml(item ? item.code : '') + '" placeholder="REP-001"></div>' +
      '<div class="form-group"><label>Nombre *</label><input class="form-input" id="if-name" value="' + Utils.escapeHtml(item ? item.name : '') + '" placeholder="Nombre del artículo"></div>' +
      '<div class="form-group"><label>Categoría *</label><select class="form-select" id="if-cat"><option value="">Seleccionar...</option>' + catOpts + '</select></div>' +
      '<div class="form-group"><label>Unidad</label><input class="form-input" id="if-unit" value="' + Utils.escapeHtml(item ? item.unit : 'unidad') + '" placeholder="unidad, kg, litro..."></div>' +
      '<div class="form-group"><label>Stock actual</label><input class="form-input" id="if-stock" type="number" min="0" value="' + (item ? item.stock : 0) + '"></div>' +
      '<div class="form-group"><label>Stock mínimo</label><input class="form-input" id="if-min" type="number" min="0" value="' + (item ? item.minStock : 5) + '"></div>' +
      '<div class="form-group"><label>Ubicación</label><input class="form-input" id="if-loc" value="' + Utils.escapeHtml(item ? item.location || '' : '') + '" placeholder="A-01, Bodega 2..."></div>' +
      '<div class="form-group"><label>Costo Unitario ($)</label><input class="form-input" id="if-cost" type="number" min="0" value="' + (item ? item.unitCost || 0 : 0) + '"></div>' +
      '<div class="form-group"><label>Estado</label><div style="margin-top:8px;"><label class="flex items-center gap-2" style="cursor:pointer;"><input type="checkbox" id="if-active" ' + (item && item.active === false ? '' : 'checked') + '> Artículo Activo</label></div></div>' +
      '<div class="form-group span-2"><label>Descripción</label><textarea class="form-textarea" id="if-desc" rows="2">' + Utils.escapeHtml(item ? item.description || '' : '') + '</textarea></div>' +
      '</div></div>' +
      '<div class="modal-footer"><button class="btn btn-secondary" id="item-can">Cancelar</button><button class="btn btn-primary" id="item-sv">💾 Guardar</button></div>' +
      '</div></div>';

    document.body.insertAdjacentHTML('beforeend', html);
    var ov = document.getElementById('item-modal');
    function close() { ov.remove(); }
    document.getElementById('item-mc').onclick = close;
    document.getElementById('item-can').onclick = close;
    ov.onclick = function (e) { if (e.target === ov) close(); };

    document.getElementById('item-sv').onclick = function () {
      var code = document.getElementById('if-code').value.trim();
      var name = document.getElementById('if-name').value.trim();
      var cat = document.getElementById('if-cat').value;
      if (!code || !name || !cat) { Utils.toast('Completa los campos obligatorios.', 'warning'); return; }
      var stock = parseFloat(document.getElementById('if-stock').value) || 0;
      var minStock = parseFloat(document.getElementById('if-min').value) || 0;
      var unitCost = parseFloat(document.getElementById('if-cost').value) || 0;
      var active = document.getElementById('if-active').checked;

      if (stock < 0 || minStock < 0 || unitCost < 0) {
        Utils.toast('Los valores de stock y costo no pueden ser negativos.', 'error');
        return;
      }

      var data = {
        code: code, name: name, categoryId: cat,
        unit: document.getElementById('if-unit').value.trim() || 'unidad',
        stock: stock,
        minStock: minStock,
        unitCost: unitCost,
        location: document.getElementById('if-loc').value.trim(),
        description: document.getElementById('if-desc').value.trim(),
        active: active
      };
      
      if (item) { 
        DB.update('items', item.id, data); 
        Utils.toast('Artículo actualizado.', 'success'); 
      } else { 
        if (stock > 0) {
          DB.transaction(function () {
            var newId = DB.create('items', data);
            DB.registerMovement(newId, 'entrada', stock, {
              unitCost: unitCost,
              totalCost: Utils.dec.mul(stock, unitCost),
              reference: 'CARGA-INICIAL',
              notes: 'Stock inicial al crear artículo',
              date: Utils.todayISO()
            });
          });
        } else {
          DB.create('items', data);
        }
        Utils.toast('Artículo creado.', 'success'); 
      }
      close(); render(); App.updateBadges();
    };
  }

  function showCategoryModal(id) {
    var cat = id ? DB.getById('categories', id) : null;
    var colors = ['blue', 'cyan', 'amber', 'green', 'purple', 'red', 'orange'];
    var colorHex = { blue: '#3B82F6', cyan: '#06B6D4', amber: '#F59E0B', green: '#10B981', purple: '#8B5CF6', red: '#EF4444', orange: '#F97316' };
    var old = document.getElementById('cat-modal'); if (old) old.remove();

    var html = '<div class="modal-overlay" id="cat-modal"><div class="modal">' +
      '<div class="modal-header"><h3>' + (cat ? '✏️ Editar Categoría' : '+ Nueva Categoría') + '</h3><button class="modal-close" id="cat-mc">✕</button></div>' +
      '<div class="modal-body">' +
      '<div class="form-group"><label>Nombre *</label><input class="form-input" id="cf-name" value="' + Utils.escapeHtml(cat ? cat.name : '') + '"></div>' +
      '<div class="form-group"><label>Descripción</label><input class="form-input" id="cf-desc" value="' + Utils.escapeHtml(cat ? cat.description || '' : '') + '"></div>' +
      '<div class="form-group"><label>Color</label><div class="flex gap-2" id="cf-colors">' +
      colors.map(function (c) { return '<div class="color-pick" data-color="' + c + '" style="width:28px;height:28px;border-radius:50%;background:' + colorHex[c] + ';cursor:pointer;border:' + (cat && cat.color === c ? '3px solid #fff' : '3px solid transparent') + ';"></div>'; }).join('') +
      '</div></div>' +
      '</div>' +
      '<div class="modal-footer"><button class="btn btn-secondary" id="cat-can">Cancelar</button><button class="btn btn-primary" id="cat-sv">💾 Guardar</button></div>' +
      '</div></div>';

    document.body.insertAdjacentHTML('beforeend', html);
    var ov = document.getElementById('cat-modal');
    var selColor = cat ? cat.color : 'blue';

    ov.querySelectorAll('.color-pick').forEach(function (el) {
      el.onclick = function () {
        selColor = el.dataset.color;
        ov.querySelectorAll('.color-pick').forEach(function (e) { e.style.border = '3px solid transparent'; });
        el.style.border = '3px solid #fff';
      };
    });

    function close() { ov.remove(); }
    document.getElementById('cat-mc').onclick = close;
    document.getElementById('cat-can').onclick = close;
    ov.onclick = function (e) { if (e.target === ov) close(); };

    document.getElementById('cat-sv').onclick = function () {
      var name = document.getElementById('cf-name').value.trim();
      if (!name) { Utils.toast('El nombre es obligatorio.', 'warning'); return; }
      var data = { name: name, description: document.getElementById('cf-desc').value.trim(), color: selColor };
      if (cat) { DB.update('categories', cat.id, data); Utils.toast('Categoría actualizada.', 'success'); }
      else { DB.create('categories', data); Utils.toast('Categoría creada.', 'success'); }
      close(); render();
    };
  }

  function showMovementModal(itemId, type, recomQty) {
    var items = DB.getAll('items');
    var settings = DB.getSettings();
    var old = document.getElementById('mov-modal'); if (old) old.remove();

    var dQty = recomQty ? recomQty : 1;

    var html = '<div class="modal-overlay" id="mov-modal"><div class="modal">' +
      '<div class="modal-header"><h3>' + (type === 'entrada' ? '➕ Registrar Entrada' : '➖ Registrar Salida') + '</h3><button class="modal-close" id="mov-mc">✕</button></div>' +
      '<div class="modal-body">' +
      '<div class="form-group"><label>Artículo *</label><select class="form-select" id="mf-item"><option value="">Seleccionar...</option>' +
      items.map(function (i) { return '<option value="' + i.id + '"' + (itemId === i.id ? ' selected' : '') + '>' + Utils.escapeHtml(i.code + ' — ' + i.name) + ' (Stock: ' + i.stock + ')</option>'; }).join('') +
      '</select></div>' +
      '<div class="form-group"><label>Tipo</label><select class="form-select" id="mf-type">' +
      '<option value="entrada"' + (type === 'entrada' ? ' selected' : '') + '>⬆️ Entrada</option>' +
      '<option value="salida"' + (type === 'salida' ? ' selected' : '') + '>⬇️ Salida</option>' +
      '<option value="ajuste">🔄 Ajuste (nuevo total)</option>' +
      '</select></div>' +
      '<div class="form-grid">' +
      '<div class="form-group"><label id="lbl-mf-qty">Cantidad *</label><input class="form-input" type="number" min="1" id="mf-qty" value="' + dQty + '"></div>' +
      '<div class="form-group" id="mf-cost-group" style="' + (type === 'entrada' ? '' : 'display:none;') + '"><label>Costo Unit. Compra ($)</label><input class="form-input" type="number" min="0" id="mf-cost" value="0"></div>' +
      '<div class="form-group"><label>Fecha</label><input class="form-input" type="date" id="mf-date" value="' + Utils.todayISO() + '"></div>' +
      '<div class="form-group"><label>Referencia</label><input class="form-input" id="mf-ref" placeholder="OC-001, OT-001..."></div>' +
      '<div class="form-group span-2"><label>Notas</label><input class="form-input" id="mf-notes" placeholder="Notas..."></div>' +
      '</div>' +
      '</div>' +
      '<div class="modal-footer"><button class="btn btn-secondary" id="mov-can">Cancelar</button><button class="btn btn-primary" id="mov-sv">💾 Registrar</button></div>' +
      '</div></div>';

    document.body.insertAdjacentHTML('beforeend', html);
    var ov = document.getElementById('mov-modal');
    function close() { ov.remove(); }
    document.getElementById('mov-mc').onclick = close;
    document.getElementById('mov-can').onclick = close;
    ov.onclick = function (e) { if (e.target === ov) close(); };

    document.getElementById('mf-type').onchange = function () {
      document.getElementById('mf-cost-group').style.display = this.value === 'entrada' ? 'block' : 'none';
      var lbl = document.getElementById('lbl-mf-qty');
      if (lbl) lbl.textContent = this.value === 'ajuste' ? 'Nuevo Stock Total *' : 'Cantidad *';
    };

    document.getElementById('mf-item').onchange = function () {
      var itId = this.value;
      if (itId && document.getElementById('mf-type').value === 'entrada') {
        var itm = DB.getById('items', itId);
        if (itm) document.getElementById('mf-cost').value = itm.unitCost || 0;
      }
    };

    if (itemId && type === 'entrada') {
      var preItm = DB.getById('items', itemId);
      if (preItm) document.getElementById('mf-cost').value = preItm.unitCost || 0;
    }

    document.getElementById('mov-sv').onclick = function () {
      var iId = document.getElementById('mf-item').value;
      var mtyp = document.getElementById('mf-type').value;
      var qty = Utils.safeNum(document.getElementById('mf-qty').value);
      var cost = Utils.safeNum(document.getElementById('mf-cost').value);

      if (!iId) { Utils.toast('Selecciona un artículo.', 'warning'); return; }
      if (qty <= 0) { Utils.toast('La cantidad debe ser mayor a 0.', 'error'); return; }
      if (mtyp === 'entrada' && cost < 0) { Utils.toast('El costo no puede ser negativo.', 'error'); return; }

      var it = DB.getById('items', iId);
      if (!it) return;

      // 🧠 MOTOR DECIMAL V1.3: Cálculo de stock resultante
      var currentStock = Utils.safeNum(it.stock);
      var ns = 0;
      if (mtyp === 'entrada') ns = Utils.dec.add(currentStock, qty);
      else if (mtyp === 'salida') ns = Utils.dec.sub(currentStock, qty);
      else if (mtyp === 'ajuste') ns = qty;

      // 🛡️ POKA-YOKE: Bloqueo de stock negativo
      if (ns < 0) { 
        Utils.toast('❌ Operación cancelada: El stock resultante no puede ser negativo (Disponible: ' + currentStock + ').', 'error', 5000); 
        return; 
      }

      var mref = document.getElementById('mf-ref').value.trim();
      if (mtyp === 'salida' && !mref) {
        Utils.toast('⚠️ Control de Fugas: Las salidas de almacén requieren una Referencia u OT obligatoria.', 'warning');
        return;
      }

      var movementUnitCost = mtyp === 'entrada' ? cost : Utils.safeNum(it.unitCost);
      var totalC = Utils.dec.mul(movementUnitCost, mtyp === 'ajuste' ? Math.abs(Utils.dec.sub(qty, currentStock)) : qty);

      DB.transaction(function () {
        if (mtyp === 'entrada' && cost > 0) {
          DB.update('items', iId, { unitCost: cost });
        }
        DB.registerMovement(iId, mtyp, qty, {
          unitCost: movementUnitCost,
          totalCost: totalC,
          date: document.getElementById('mf-date').value || Utils.todayISO(),
          reference: document.getElementById('mf-ref').value.trim(),
          notes: document.getElementById('mf-notes').value.trim(),
          userId: settings.activeUserId,
          userName: (DB.getById('users', settings.activeUserId) || { name: 'Usuario' }).name
        });
      });
      Utils.toast('Movimiento registrado.', 'success');
      close(); render(); App.updateBadges();
    };  }

  function deleteItem(id) {
    var item = DB.getById('items', id);
    if (!item) return;

    // 🛡️ BLINDAJE DE INTEGRIDAD (V2.2): Escaneo cruzado exhaustivo
    var movements = DB.getAll('movements').filter(function (m) { return m.itemId === id; });
    var workOrders = DB.getAll('workOrders').filter(function (w) {
      return (w.materials || []).some(function (m) { return m.itemId === id; });
    });
    var maintenanceLogs = (DB.getAll('maintenanceLogs') || []).filter(function (l) {
      return (l.materialsUsed || []).some(function (m) { return m.id === id; });
    });

    var hasHistory = movements.length > 0 || workOrders.length > 0 || maintenanceLogs.length > 0;

    if (hasHistory) {
      Utils.confirm(
        "❌ Error de Integridad: El artículo '" + item.name + "' tiene historial vinculado (OTs, Movimientos o Bitácora).\n\n¿Deseas INACTIVARLO en su lugar? (Esto lo ocultará de los selectores de taller sin romper los reportes pasados).",
        "Protección de Almacén",
        function () {
          DB.update('items', id, { active: false });
          Utils.toast('Artículo inactivado correctamente.', 'info');
          render();
          App.updateBadges();
        },
        true
      );
      return;
    }

    Utils.confirm('¿Eliminar el artículo "' + item.name + '"?', 'Eliminar Artículo', function () {
      try {
        DB.remove('items', id);
        Utils.toast('Artículo eliminado.', 'success');
        render();
        App.updateBadges();
      } catch (e) {
        Utils.toast(e.message, 'error', 5000);
      }
    }, true);
  }

  function deleteCategory(id) {
    var cat = DB.getById('categories', id);
    Utils.confirm('¿Eliminar la categoría "' + cat.name + '"?', 'Eliminar', function () {
      try {
        DB.remove('categories', id);
        Utils.toast('Categoría eliminada.', 'success');
        render();
      } catch (e) {
        Utils.toast(e.message, 'error', 5000);
      }
    }, true);
  }

  function exportExcel() {
    var items = DB.getAll('items'); var cats = DB.getAll('categories');
    var catMap = {}; cats.forEach(function (c) { catMap[c.id] = c.name; });
    Utils.exportExcel('inventario_' + Utils.todayISO() + '.xlsx', 'Inventario General de Activos',
      ['Código', 'Nombre', 'Categoría', 'Unidad', 'Stock', 'Stock Mínimo', 'Costo Unit.', 'Valor Total', 'Ubicación', 'Descripción'],
      items.map(function (i) {
        var totalBase = Utils.dec.mul(i.stock, i.unitCost || 0);
        return [i.code || '', i.name, catMap[i.categoryId] || '', i.unit, i.stock, i.minStock, i.unitCost || 0, totalBase, i.location || '', i.description || ''];
      })
    );
    Utils.toast('Exportado a Excel.', 'success');
  }

  function setInvFilterLvl(val) { filterStockLevel = val; renderItems(); }

  return { render: render, showItemModal: showItemModal, showCategoryModal: showCategoryModal, showMovementModal: showMovementModal, deleteItem: deleteItem, deleteCategory: deleteCategory, showItemHistory: showItemHistory, setInvFilterLvl: setInvFilterLvl };
})();
