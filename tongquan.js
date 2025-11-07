

import { sb, viewStates, showView, currentUser, cache } from './app.js';

let activityChart = null;
let inventoryStatusChart = null;
let currentStats = {}; // Store stats for conditional navigation
let chartMode = 'quantity'; // 'quantity' or 'transaction'
let last30DaysChiTiet = []; // Store chart data to avoid re-fetching
let allAlertsData = null;
let allNganhOptions = []; // Cache for inventory filter

const tongQuanState = {
    alerts: {
        loai: [],
        nganh: [],
        phu_trach: []
    },
    inventory: {
        nganh: []
    }
};

function updateTQFilterButtonTexts() {
    const defaultTexts = {
        'tq-alert-filter-loai-btn': 'Loại',
        'tq-alert-filter-nganh-btn': 'Ngành',
        'tq-alert-filter-phu-trach-btn': 'Phụ Trách',
        'tq-inventory-nganh-filter-btn': 'Ngành'
    };
    
    document.querySelectorAll('#view-phat-trien .filter-btn').forEach(btn => {
        const context = btn.dataset.context || 'alerts';
        const filterKey = btn.dataset.filterKey;
        const state = tongQuanState[context];
        if (state && state[filterKey]) {
            const selectedCount = state[filterKey].length;
            const defaultText = defaultTexts[btn.id] || 'Filter';
            btn.textContent = selectedCount > 0 ? `${defaultText} (${selectedCount})` : defaultText;
        }
    });
}

async function openTongQuanFilterPopover(button) {
    const filterKey = button.dataset.filterKey;
    const context = button.dataset.context || 'alerts';
    const state = tongQuanState[context];

    const template = document.getElementById('filter-popover-template');
    if (!template) return;
    const popoverContent = template.content.cloneNode(true);
    const popover = popoverContent.querySelector('.filter-popover');
    document.body.appendChild(popover);

    const rect = button.getBoundingClientRect();
    popover.style.left = `${rect.left}px`;
    popover.style.top = `${rect.bottom + window.scrollY + 5}px`;

    const optionsList = popover.querySelector('.filter-options-list');
    const applyBtn = popover.querySelector('.filter-apply-btn');
    const searchInput = popover.querySelector('.filter-search-input');
    const selectionCountEl = popover.querySelector('.filter-selection-count');
    const toggleAllBtn = popover.querySelector('.filter-toggle-all-btn');

    const tempSelectedOptions = new Set(state[filterKey] || []);

    const updateSelectionCount = () => {
        const count = tempSelectedOptions.size;
        selectionCountEl.textContent = count > 0 ? `Đã chọn: ${count}` : '';
    };

    const updateToggleAllButtonState = (allOptions) => {
        if (!allOptions || allOptions.length === 0) {
            toggleAllBtn.textContent = 'Tất cả';
            toggleAllBtn.disabled = true;
            return;
        }
        toggleAllBtn.disabled = false;
        const allVisibleSelected = allOptions.every(opt => tempSelectedOptions.has(opt));
        toggleAllBtn.textContent = allVisibleSelected ? 'Bỏ chọn' : 'Tất cả';
    };

    const renderOptions = (options) => {
        const searchTerm = searchInput.value.toLowerCase();
        const filteredOptions = options.filter(option =>
            option && String(option).toLowerCase().includes(searchTerm)
        );
        optionsList.innerHTML = filteredOptions.length > 0 ? filteredOptions.map(option => `
            <label class="flex items-center space-x-2 px-2 py-1 hover:bg-gray-100 rounded">
                <input type="checkbox" value="${option}" class="filter-option-cb" ${tempSelectedOptions.has(String(option)) ? 'checked' : ''}>
                <span class="text-sm">${option}</span>
            </label>
        `).join('') : '<div class="text-center p-4 text-sm text-gray-500">Không có tùy chọn.</div>';
        updateToggleAllButtonState(filteredOptions);
    };

    const setupEventListeners = (allOptions) => {
        searchInput.addEventListener('input', () => renderOptions(allOptions));
        optionsList.addEventListener('change', e => {
            if (e.target.classList.contains('filter-option-cb')) {
                if (e.target.checked) tempSelectedOptions.add(e.target.value);
                else tempSelectedOptions.delete(e.target.value);
                updateSelectionCount();
                updateToggleAllButtonState(allOptions.filter(opt => opt.toLowerCase().includes(searchInput.value.toLowerCase())));
            }
        });
        toggleAllBtn.onclick = () => {
            const visibleOptions = allOptions.filter(opt => opt.toLowerCase().includes(searchInput.value.toLowerCase()));
            const isSelectAllAction = toggleAllBtn.textContent === 'Tất cả';
            visibleOptions.forEach(option => {
                if (isSelectAllAction) tempSelectedOptions.add(String(option));
                else tempSelectedOptions.delete(String(option));
            });
            renderOptions(allOptions);
            updateSelectionCount();
        };
    };

    updateSelectionCount();
    
    let options = [];
    if (context === 'alerts') {
        if (filterKey === 'loai') {
            options = ['Sắp hết hàng', 'Tồn kho lâu', 'Cận date', 'Đơn hàng trễ'];
        } else {
             const allItems = [];
             Object.values(allAlertsData).forEach(arr => allItems.push(...arr));
             const keyToExtract = filterKey === 'phu_trach' ? 'phu_trach' : 'nganh';
             const altKey = filterKey === 'phu_trach' ? 'yeu_cau' : null;
             options = [...new Set(allItems.map(item => item[keyToExtract] || item[altKey]).filter(Boolean))].sort();
        }
    } else if (context === 'inventory' && filterKey === 'nganh') {
        options = allNganhOptions;
    }

    renderOptions(options);
    setupEventListeners(options);

    const closePopover = (e) => {
        if (!popover.contains(e.target) && e.target !== button) {
            popover.remove();
            document.removeEventListener('click', closePopover);
        }
    };

    applyBtn.onclick = () => {
        state[filterKey] = [...tempSelectedOptions];
        updateTQFilterButtonTexts();
        if (context === 'alerts') updateAlertFiltersAndRender();
        else if (context === 'inventory') renderInventoryStatusChart();
        popover.remove();
        document.removeEventListener('click', closePopover);
    };

    setTimeout(() => document.addEventListener('click', closePopover), 0);
}


async function fetchAlerts() {
    const isViewRole = currentUser.phan_quyen === 'View';
    const userName = currentUser.ho_ten;
    const lowStockThreshold = 10;
    const slowMovingDays = 60;
    const overdueDays = 3;
    const urgentExpiryDays = 30;

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - slowMovingDays);

    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - overdueDays);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(today.getDate() + urgentExpiryDays);

    // 1 & 2. Data for Low Stock & Slow Moving Items
    let allStockQuery = sb.from('ton_kho_update')
        .select('ma_vach, ma_vt, ten_vt, ton_cuoi, nganh, phu_trach')
        .gt('ton_cuoi', 0);
        
    // Sub-query for Slow Moving
    let recentMovementQuery = sb.from('chi_tiet')
        .select('ma_vach')
        .eq('loai', 'Xuat')
        .gte('thoi_gian', sixtyDaysAgo.toISOString());
        
    // 3. Urgent Expiry
    let urgentExpiryQuery = sb.from('ton_kho_update')
        .select('ma_vt, ten_vt, lot, date, nganh, phu_trach')
        .eq('tinh_trang', 'Cận date')
        .gt('ton_cuoi', 0);

    // 4. Overdue Orders
    let overdueOrdersQuery = sb.from('don_hang')
        .select('ma_kho, yeu_cau, thoi_gian, nganh, ma_nx')
        .like('ma_nx', '%-')
        .lte('thoi_gian', threeDaysAgo.toISOString())
        .order('thoi_gian', { ascending: true })
        .limit(5);

    if (isViewRole) {
        allStockQuery = allStockQuery.eq('phu_trach', userName);
        urgentExpiryQuery = urgentExpiryQuery.eq('phu_trach', userName);
        overdueOrdersQuery = overdueOrdersQuery.eq('yeu_cau', userName);
    }
    
    const [
        allStockRes,
        recentMovementRes,
        urgentExpiryRes,
        overdueOrdersRes
    ] = await Promise.all([
        allStockQuery,
        recentMovementQuery,
        urgentExpiryQuery,
        overdueOrdersQuery
    ]);

    // Process Low Stock
    const stockByProduct = new Map();
    (allStockRes.data || []).forEach(item => {
        if (!stockByProduct.has(item.ma_vt)) {
            stockByProduct.set(item.ma_vt, {
                ma_vt: item.ma_vt,
                ten_vt: item.ten_vt,
                nganh: item.nganh,
                phu_trach: item.phu_trach,
                total_ton_cuoi: 0,
            });
        }
        stockByProduct.get(item.ma_vt).total_ton_cuoi += item.ton_cuoi;
    });

    const lowStockItems = [...stockByProduct.values()].filter(
        item => item.total_ton_cuoi > 0 && item.total_ton_cuoi <= lowStockThreshold
    );

    // Process Slow Moving
    const recentlyMovedMaVach = new Set((recentMovementRes.data || []).map(i => i.ma_vach));
    const slowMovingItems = (allStockRes.data || []).filter(item => !recentlyMovedMaVach.has(item.ma_vach)).slice(0, 5);
    
    // Process Urgent Expiry
    const parseDate = (dateString) => {
        if (!dateString || !/^\d{2}\/\d{2}\/\d{4}$/.test(dateString)) return null;
        const [day, month, year] = dateString.split('/').map(Number);
        const date = new Date(year, month - 1, day);
        return isNaN(date.getTime()) ? null : date;
    };

    const urgentExpiryItems = (urgentExpiryRes.data || []).filter(item => {
        const expiryDate = parseDate(item.date);
        return expiryDate && expiryDate >= today && expiryDate <= sevenDaysFromNow;
    }).slice(0, 5);

    return {
        lowStock: lowStockItems,
        slowMoving: slowMovingItems,
        urgentExpiry: urgentExpiryItems,
        overdueOrders: overdueOrdersRes.data || [],
    };
}

function renderAlerts(alerts) {
    const listEl = document.getElementById('tq-alerts-list');
    if (!listEl) return;

    listEl.innerHTML = '';
    let alertCount = 0;

    const createAlertItem = (icon, text, info, action, data) => {
        const li = document.createElement('li');
        li.className = 'flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer alert-item';
        li.dataset.action = action;
        li.dataset.value = data;

        const infoHtml = `
            <div class="flex-shrink-0 text-right text-xs text-gray-500 ml-4 w-28">
                <p class="truncate" title="${info.nganh || ''}">${info.nganh || 'N/A'}</p>
                <p class="font-medium truncate" title="${info.phu_trach || ''}">${info.phu_trach || 'N/A'}</p>
            </div>
        `;

        li.innerHTML = `
            ${icon}
            <div class="flex-grow">
                <span class="text-sm text-gray-700">${text}</span>
            </div>
            ${infoHtml}
        `;
        listEl.appendChild(li);
        alertCount++;
    };
    
    const icons = {
        lowStock: `<div class="flex-shrink-0 w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center"><svg class="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2a1 1 0 011 1v8a1 1 0 01-1 1h-2a1 1 0 01-1-1z"></path></svg></div>`,
        slowMoving: `<div class="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center"><svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div>`,
        urgentExpiry: `<div class="flex-shrink-0 w-8 h-8 rounded-full bg-red-100 flex items-center justify-center"><svg class="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg></div>`,
        overdueOrders: `<div class="flex-shrink-0 w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center"><svg class="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path></svg></div>`
    };

    (alerts.lowStock || []).forEach(item => {
        const text = `Sắp hết hàng: <strong>${item.ten_vt} (${item.ma_vt})</strong> chỉ còn tồn <strong class="text-red-600">${item.total_ton_cuoi}</strong>.`;
        const info = { nganh: item.nganh, phu_trach: item.phu_trach };
        createAlertItem(icons.lowStock, text, info, 'ton-kho:ma_vt', item.ma_vt);
        alertCount++;
    });
    
    (alerts.slowMoving || []).forEach(item => {
        const text = `Tồn kho lâu: <strong>${item.ten_vt} (${item.ma_vt})</strong> không có giao dịch xuất trong 60 ngày qua.`;
        const info = { nganh: item.nganh, phu_trach: item.phu_trach };
        createAlertItem(icons.slowMoving, text, info, 'ton-kho:ma_vt', item.ma_vt);
        alertCount++;
    });

    (alerts.urgentExpiry || []).forEach(item => {
        const text = `Cận date: Lô <strong>${item.lot}</strong> của <strong>${item.ten_vt}</strong> sẽ hết hạn vào <strong>${item.date}</strong>.`;
        const info = { nganh: item.nganh, phu_trach: item.phu_trach };
        createAlertItem(icons.urgentExpiry, text, info, 'ton-kho:lot', item.lot);
        alertCount++;
    });
    
    (alerts.overdueOrders || []).forEach(item => {
        const daysOverdue = Math.floor((new Date() - new Date(item.thoi_gian)) / (1000 * 60 * 60 * 24));
        const text = `Đơn hàng trễ: <strong>${item.ma_kho}</strong> của <strong>${item.yeu_cau}</strong> đã quá hạn xử lý ${daysOverdue} ngày.`;
        const info = { nganh: item.nganh, phu_trach: item.yeu_cau };
        createAlertItem(icons.overdueOrders, text, info, 'don-hang:ma_kho', item.ma_kho);
        alertCount++;
    });


    if (alertCount === 0) {
        listEl.innerHTML = `
            <li class="flex items-center space-x-3 p-3">
                <div class="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                    <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                </div>
                <span class="text-sm text-gray-700 font-medium">Mọi thứ đều ổn! Không có cảnh báo nào.</span>
            </li>
        `;
    }
}

function renderStats(stats) {
    document.getElementById('tq-stat-don-hang').textContent = stats.donHangCount?.toLocaleString() ?? '0';
    document.getElementById('tq-stat-san-pham').textContent = stats.sanPhamLoai?.toLocaleString() ?? '0';
    document.getElementById('tq-sub-stat-san-pham').textContent = `Tồn kho: ${(stats.sanPhamTon ?? 0).toLocaleString()}`;
    document.getElementById('tq-stat-can-date').textContent = stats.canDateLo?.toLocaleString() ?? '0';
    document.getElementById('tq-sub-stat-can-date').textContent = `Số lượng: ${(stats.canDateSl ?? 0).toLocaleString()}`;
    document.getElementById('tq-stat-het-han').textContent = stats.hetHanLo?.toLocaleString() ?? '0';
    document.getElementById('tq-sub-stat-het-han').textContent = `Số lượng: ${(stats.hetHanSl ?? 0).toLocaleString()}`;

    // Render Trends
    const renderTrend = (elementId, trendValue, positiveIsGood = true, unit = 'đơn') => {
        const el = document.getElementById(elementId);
        if (!el) return;
        if (trendValue === undefined || isNaN(trendValue)) {
            el.innerHTML = ''; return;
        }

        let arrow, colorClass, text;
        if (trendValue > 0) {
            arrow = '↑';
            colorClass = positiveIsGood ? 'text-green-600' : 'text-red-600';
            text = `tăng ${trendValue} ${unit}`;
        } else if (trendValue < 0) {
            arrow = '↓';
            colorClass = positiveIsGood ? 'text-red-600' : 'text-green-600';
            text = `giảm ${Math.abs(trendValue)} ${unit}`;
        } else {
            arrow = '→';
            colorClass = 'text-gray-500';
            text = 'không đổi';
        }
        el.innerHTML = `<span class="${colorClass} font-semibold">${arrow} ${text}</span> so với tuần trước`;
    };

    renderTrend('tq-trend-don-hang', stats.donHangTrend, false, 'đơn');
    renderTrend('tq-trend-can-date', stats.canDateTrend, false, 'lô');
    renderTrend('tq-trend-het-han', stats.hetHanTrend, false, 'lô');
}


function renderActivityChart() {
    const ctxEl = document.getElementById('tq-activity-chart');
    if (!ctxEl) return;
    const ctx = ctxEl.getContext('2d');
    
    const last30Days = {};
    for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split('T')[0];
        last30Days[key] = { nhap: 0, xuat: 0 };
    }

    last30DaysChiTiet.forEach(item => {
        const key = item.thoi_gian.split('T')[0];
        if (last30Days[key]) {
            if (chartMode === 'quantity') {
                last30Days[key].nhap += item.nhap || 0;
                last30Days[key].xuat += item.xuat || 0;
            } else { // transaction mode
                if (item.nhap > 0) last30Days[key].nhap++;
                if (item.xuat > 0) last30Days[key].xuat++;
            }
        }
    });

    const labels = Object.keys(last30Days).map(dateStr => {
        const date = new Date(dateStr);
        return `${date.getDate()}/${date.getMonth() + 1}`;
    });
    const nhapData = Object.values(last30Days).map(d => d.nhap);
    const xuatData = Object.values(last30Days).map(d => d.xuat);
    const netData = nhapData.map((nhap, i) => nhap - xuatData[i]);

    if (activityChart) {
        activityChart.destroy();
    }

    activityChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Nhập',
                    data: nhapData,
                    backgroundColor: 'rgba(54, 162, 235, 0.6)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1,
                    type: 'bar',
                    yAxisID: 'y'
                },
                {
                    label: 'Xuất',
                    data: xuatData,
                    backgroundColor: 'rgba(255, 99, 132, 0.6)',
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 1,
                    type: 'bar',
                    yAxisID: 'y'
                },
                {
                    label: 'Thay Đổi Ròng',
                    data: netData,
                    borderColor: 'rgba(153, 102, 255, 1)',
                    backgroundColor: 'rgba(153, 102, 255, 0.2)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.1,
                    type: 'line',
                    yAxisID: 'y'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            if (chartMode === 'quantity' && value >= 1000) return (value / 1000) + 'k';
                            if (Number.isInteger(value)) return value;
                        }
                    }
                },
                x: { grid: { display: false } }
            },
            plugins: {
                legend: { position: 'top' },
                tooltip: { mode: 'index', intersect: false }
            },
            interaction: { mode: 'index', intersect: false },
        }
    });
}

async function renderInventoryStatusChart() {
    const ctxEl = document.getElementById('tq-inventory-chart');
    if (!ctxEl) return;
    const ctx = ctxEl.getContext('2d');

    const selectedNganhArr = tongQuanState.inventory.nganh;

    let query = sb.from('ton_kho_update').select('tinh_trang, ton_cuoi');
    if (currentUser.phan_quyen === 'View') {
        query = query.eq('phu_trach', currentUser.ho_ten);
    }
    if (selectedNganhArr.length > 0) {
        query = query.in('nganh', selectedNganhArr);
    }

    const { data, error } = await query;
    if (error) {
        console.error("Error fetching inventory status:", error);
        return;
    }
    
    const labels = ['Còn sử dụng', 'Cận date', 'Hết hạn sử dụng', 'Hàng hư'];
    const statusCounts = {
        'Còn sử dụng': 0,
        'Cận date': 0,
        'Hết hạn sử dụng': 0,
        'Hàng hư': 0
    };

    (data || []).forEach(item => {
        if (statusCounts.hasOwnProperty(item.tinh_trang)) {
            statusCounts[item.tinh_trang] += (item.ton_cuoi || 0);
        }
    });

    const chartData = labels.map(label => statusCounts[label]);

    if (inventoryStatusChart) {
        inventoryStatusChart.destroy();
    }

    inventoryStatusChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                label: 'Số Lượng',
                data: chartData,
                backgroundColor: [
                    'rgba(49, 209, 52, 0.93)',  // Green for Còn sử dụng
                    'rgba(54, 162, 235, 0.7)',  // Blue for Cận date
                    'rgba(251, 3, 3, 0.7)',   // Red for Hết hạn sử dụng
                    'rgba(242, 242, 8, 1)'   // Yellow for Hàng hư
                ],
                borderColor: [
                    'rgba(49, 209, 52, 0.93)',
                    'rgba(54, 162, 235, 1)',
                    'rgba(251, 3, 3, 0.7)',
                    'rgba(242, 242, 8, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed !== null) {
                                label += context.parsed.toLocaleString();
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}

function renderRecentOrders(orders) {
    const listEl = document.getElementById('tq-recent-orders-list');
    if (!listEl) return;
    if (!orders || orders.length === 0) {
        listEl.innerHTML = '<li class="text-center text-gray-500">Không có đơn hàng nào.</li>';
        return;
    }

    listEl.innerHTML = orders.map(order => {
        const isXuat = order.ma_kho.startsWith('OUT');
        const icon = isXuat
            ? `<svg class="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3"></path></svg>`
            : `<svg class="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16l-4-4m0 0l4-4m-4 4h18"></path></svg>`;

        const date = new Date(order.thoi_gian);
        const formattedDate = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;

        const isProcessing = order.ma_nx && order.ma_nx.endsWith('-');
        const statusText = isProcessing ? 'Đang xử lý' : 'Đã xử lý';
        const statusClass = isProcessing ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800';
        const statusHtml = `<span class="px-2 py-0.5 text-xs font-medium rounded-full ${statusClass}">${statusText}</span>`;

        return `
            <li class="flex items-center space-x-4 p-2 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors" data-ma-kho="${order.ma_kho}">
                <div class="p-2 bg-gray-100 rounded-full">${icon}</div>
                <div class="flex-grow">
                    <p class="font-semibold text-gray-800">${order.ma_kho} - ${order.ma_nx || ''}</p>
                    <p class="text-sm text-gray-500">${order.yeu_cau} - ${order.nganh}</p>
                </div>
                <div class="flex flex-col items-end flex-shrink-0 gap-1">
                    <p class="text-sm text-gray-500">${formattedDate}</p>
                    ${statusHtml}
                </div>
            </li>
        `;
    }).join('');
}

function updateAlertFiltersAndRender() {
    if (!allAlertsData) return;
    
    const loaiMap = {
        'Sắp hết hàng': 'lowStock',
        'Tồn kho lâu': 'slowMoving',
        'Cận date': 'urgentExpiry',
        'Đơn hàng trễ': 'overdueOrders'
    };
    const selectedLoaiKeys = tongQuanState.alerts.loai.map(l => loaiMap[l]);
    const selectedNganh = tongQuanState.alerts.nganh;
    const selectedPhuTrach = tongQuanState.alerts.phu_trach;

    const allItems = [];
    Object.keys(allAlertsData).forEach(key => {
        if(Array.isArray(allAlertsData[key])) {
             allItems.push(...allAlertsData[key].map(item => ({ ...item, _type: key })));
        }
    });

    const itemsToDisplay = allItems.filter(item => {
        const matchesLoai = selectedLoaiKeys.length === 0 || selectedLoaiKeys.includes(item._type);
        const matchesNganh = selectedNganh.length === 0 || selectedNganh.includes(item.nganh || (item._type === 'overdueOrders' ? item.nganh : null));
        const phu_trach = item.phu_trach || (item._type === 'overdueOrders' ? item.yeu_cau : null);
        const matchesPhuTrach = selectedPhuTrach.length === 0 || selectedPhuTrach.includes(phu_trach);
        return matchesLoai && matchesNganh && matchesPhuTrach;
    });
    
    const displayedAlerts = {};
    itemsToDisplay.forEach(item => {
        if (!displayedAlerts[item._type]) {
            displayedAlerts[item._type] = [];
        }
        displayedAlerts[item._type].push(item);
    });

    renderAlerts(displayedAlerts);
}


export async function fetchTongQuanData() {
    renderStats({});
    document.getElementById('tq-recent-orders-list').innerHTML = '<li class="text-center text-gray-500">Đang tải...</li>';
    document.getElementById('tq-alerts-list').innerHTML = '<li class="text-center text-gray-500 py-4">Đang kiểm tra...</li>';

    try {
        const isViewRole = currentUser.phan_quyen === 'View';
        const userName = currentUser.ho_ten;

        // --- DEFINE TIME RANGES ---
        const today = new Date();
        today.setHours(0,0,0,0);
        const sevenDaysAgo = new Date(today); sevenDaysAgo.setDate(today.getDate() - 7);
        const fourteenDaysAgo = new Date(today); fourteenDaysAgo.setDate(today.getDate() - 14);
        const thirtyDaysAgo = new Date(today); thirtyDaysAgo.setDate(today.getDate() - 30);
        const threeMonthsFromNow = new Date(today); threeMonthsFromNow.setMonth(today.getMonth() + 3);
        const threeMonthsSevenDaysAgo = new Date(sevenDaysAgo); threeMonthsSevenDaysAgo.setMonth(sevenDaysAgo.getMonth() + 3);

        // --- PREPARE QUERIES ---
        // 1. Đơn hàng đang xử lý (current count)
        let donHangQuery = sb.from('don_hang').select('ma_kho', { count: 'exact', head: true }).like('ma_nx', '%-');
        if (isViewRole) donHangQuery = donHangQuery.eq('yeu_cau', userName);

        // 1.1. Đơn hàng đang xử lý (trend)
        let donHangThisWeekQuery = sb.from('don_hang').select('ma_kho', { count: 'exact', head: true }).like('ma_nx', '%-').gte('thoi_gian', sevenDaysAgo.toISOString());
        let donHangLastWeekQuery = sb.from('don_hang').select('ma_kho', { count: 'exact', head: true }).like('ma_nx', '%-').gte('thoi_gian', fourteenDaysAgo.toISOString()).lt('thoi_gian', sevenDaysAgo.toISOString());
        if(isViewRole) {
            donHangThisWeekQuery = donHangThisWeekQuery.eq('yeu_cau', userName);
            donHangLastWeekQuery = donHangLastWeekQuery.eq('yeu_cau', userName);
        }

        // 2. Tổng sản phẩm
        let sanPhamLoaiQuery = sb.from('san_pham').select('ma_vt', { count: 'exact', head: true });
        let sanPhamTonQuery = sb.from('ton_kho_update').select('ton_cuoi');
        if (isViewRole) {
            sanPhamLoaiQuery = sanPhamLoaiQuery.eq('phu_trach', userName);
            sanPhamTonQuery = sanPhamTonQuery.eq('phu_trach', userName);
        }
        
        // 3 & 4. Data for Cận Date & Hết Hạn trends (current and last week)
        let tonKhoForTrendQuery = sb.from('ton_kho_update').select('date, ton_cuoi').gt('ton_cuoi', 0);
        if (isViewRole) tonKhoForTrendQuery = tonKhoForTrendQuery.eq('phu_trach', userName);

        // 5. For chart and recent orders
        let chiTietQuery = sb.from('chi_tiet').select('thoi_gian, nhap, xuat').gte('thoi_gian', thirtyDaysAgo.toISOString());
        let ordersQuery = sb.from('don_hang').select('*').order('thoi_gian', { ascending: false }).limit(5);
        if (isViewRole) {
            chiTietQuery = chiTietQuery.eq('phu_trach', userName);
            ordersQuery = ordersQuery.eq('yeu_cau', userName);
        }

        // 6. For inventory chart filter
        let nganhQuery = sb.from('ton_kho_update').select('nganh');
        if (isViewRole) nganhQuery = nganhQuery.eq('phu_trach', userName);

        // --- EXECUTE QUERIES ---
        const [
            donHangRes, donHangThisWeekRes, donHangLastWeekRes,
            sanPhamLoaiRes, sanPhamTonRes,
            tonKhoForTrendRes,
            chiTietRes, ordersRes,
            alertsData, nganhRes
        ] = await Promise.all([
            donHangQuery, donHangThisWeekQuery, donHangLastWeekQuery,
            sanPhamLoaiQuery, sanPhamTonQuery,
            tonKhoForTrendQuery,
            chiTietQuery, ordersQuery,
            fetchAlerts(), nganhQuery
        ]);

        const errors = [donHangRes.error, sanPhamLoaiRes.error, sanPhamTonRes.error, chiTietRes.error, ordersRes.error, tonKhoForTrendRes.error, nganhRes.error].filter(Boolean);
        if (errors.length > 0) throw new Error(errors.map(e => e.message).join('; '));

        // --- PROCESS RESULTS ---
        const parseDate = (dateString) => {
            if (!dateString || !/^\d{2}\/\d{2}\/\d{4}$/.test(dateString)) return null;
            const [day, month, year] = dateString.split('/').map(Number);
            return new Date(year, month - 1, day);
        };

        let currentCanDateCount = 0, lastWeekCanDateCount = 0;
        let canDateSl = 0;
        
        let allTimeExpiredCount = 0;
        let expiredAsOfLastWeekCount = 0;
        let thisMonthExpiredLo = 0;
        let thisMonthExpiredSl = 0;
        
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();

        (tonKhoForTrendRes.data || []).forEach(item => {
            const expiryDate = parseDate(item.date);
            if (!expiryDate) return;

            // Cận Date Logic
            if (expiryDate > today && expiryDate <= threeMonthsFromNow) {
                currentCanDateCount++;
                canDateSl += item.ton_cuoi;
            }
            if (expiryDate > sevenDaysAgo && expiryDate <= threeMonthsSevenDaysAgo) {
                lastWeekCanDateCount++;
            }

            // Hết Hạn Logic
            if (expiryDate <= today) {
                allTimeExpiredCount++;
                if (expiryDate.getMonth() === currentMonth && expiryDate.getFullYear() === currentYear) {
                    thisMonthExpiredLo++;
                    thisMonthExpiredSl += item.ton_cuoi;
                }
            }
            if (expiryDate <= sevenDaysAgo) {
                expiredAsOfLastWeekCount++;
            }
        });

        currentStats = {
            donHangCount: donHangRes.count ?? 0,
            donHangTrend: (donHangThisWeekRes.count ?? 0) - (donHangLastWeekRes.count ?? 0),
            sanPhamLoai: sanPhamLoaiRes.count ?? 0,
            sanPhamTon: (sanPhamTonRes.data || []).reduce((sum, p) => sum + (p.ton_cuoi || 0), 0),
            canDateLo: currentCanDateCount,
            canDateSl: canDateSl,
            canDateTrend: currentCanDateCount - lastWeekCanDateCount,
            hetHanLo: thisMonthExpiredLo,
            hetHanSl: thisMonthExpiredSl,
            hetHanTrend: allTimeExpiredCount - expiredAsOfLastWeekCount
        };
        
        last30DaysChiTiet = chiTietRes.data || [];
        allAlertsData = alertsData;
        allNganhOptions = [...new Set((nganhRes.data || []).map(item => item.nganh).filter(Boolean))].sort();


        // RENDER EVERYTHING
        renderStats(currentStats);
        updateTQFilterButtonTexts();
        renderActivityChart();
        renderRecentOrders(ordersRes.data || []);
        updateAlertFiltersAndRender();
        renderInventoryStatusChart();

    } catch (error) {
        console.error("Failed to fetch overview data:", error);
        const errorText = "Lỗi";
        if(document.getElementById('tq-stat-don-hang')) document.getElementById('tq-stat-don-hang').textContent = errorText;
        if(document.getElementById('tq-stat-san-pham')) document.getElementById('tq-stat-san-pham').textContent = errorText;
        if(document.getElementById('tq-stat-can-date')) document.getElementById('tq-stat-can-date').textContent = errorText;
        if(document.getElementById('tq-stat-het-han')) document.getElementById('tq-stat-het-han').textContent = errorText;
    }
}

export function initTongQuanView() {
    const view = document.getElementById('view-phat-trien');
    if(!view) return;

    if (!view.dataset.listenerAttached) {
        view.addEventListener('click', (e) => {
            const filterBtn = e.target.closest('.filter-btn');
            if (filterBtn) {
                openTongQuanFilterPopover(filterBtn);
                return;
            }

            const cardDonHang = e.target.closest('#tq-card-don-hang');
            const cardSanPham = e.target.closest('#tq-card-san-pham');
            const cardCanDate = e.target.closest('#tq-card-can-date');
            const cardHetHan = e.target.closest('#tq-card-het-han');
            const alertItem = e.target.closest('.alert-item');
            const recentOrderItem = e.target.closest('#tq-recent-orders-list li');

            const resetAndShow = (viewId, filters) => {
                const state = viewStates[viewId];
                if (state) {
                    state.searchTerm = '';
                    state.currentPage = 1;
                    Object.keys(state.filters).forEach(key => {
                        if (Array.isArray(state.filters[key])) state.filters[key] = [];
                        else if (typeof state.filters[key] === 'string') state.filters[key] = '';
                    });
                    Object.assign(state.filters, filters);
                    showView(viewId);
                }
            };

            if (cardDonHang && currentStats.donHangCount > 0) {
                resetAndShow('view-don-hang', { trang_thai_xu_ly: ['Đang xử lý'] });
                return;
            }
            if (cardSanPham && currentStats.sanPhamLoai > 0) {
                resetAndShow('view-ton-kho', { ton_cuoi: ['Còn Hàng'] });
                return;
            }
            if (cardCanDate && currentStats.canDateLo > 0) {
                resetAndShow('view-ton-kho', { ton_cuoi: ['Còn Hàng'], tinh_trang: ['Cận date'] });
                return;
            }
            if (cardHetHan && currentStats.hetHanLo > 0) {
                resetAndShow('view-ton-kho', { ton_cuoi: ['Còn Hàng'], tinh_trang: ['Hết hạn sử dụng'] });
                return;
            }

            if (alertItem) {
                const { action, value } = alertItem.dataset;
                if (!action || !value) return;

                const [targetViewPrefix, filterKey] = action.split(':');
                const targetView = `view-${targetViewPrefix}`;
                
                const newFilters = { [filterKey]: [value] };
                if (targetView === 'view-don-hang') newFilters.trang_thai_xu_ly = ['Đang xử lý'];
                if (targetView === 'view-ton-kho') newFilters.ton_cuoi = ['Còn Hàng'];
                
                resetAndShow(targetView, newFilters);
                return;
            }
             if (recentOrderItem && recentOrderItem.dataset.maKho) {
                const ma_kho = recentOrderItem.dataset.maKho;
                resetAndShow('view-don-hang', { ma_kho: [ma_kho] });
                return;
            }
        });
        view.dataset.listenerAttached = 'true';
    }


    const quantityBtn = document.getElementById('tq-chart-mode-quantity');
    const transactionBtn = document.getElementById('tq-chart-mode-transaction');

    if(quantityBtn && transactionBtn && !quantityBtn.dataset.listenerAttached) {
        quantityBtn.addEventListener('click', () => {
            if (chartMode === 'quantity') return;
            chartMode = 'quantity';
            quantityBtn.classList.add('bg-gray-200', 'font-semibold');
            quantityBtn.classList.remove('text-gray-600');
            transactionBtn.classList.remove('bg-gray-200', 'font-semibold');
            transactionBtn.classList.add('text-gray-600');
            renderActivityChart();
        });

        transactionBtn.addEventListener('click', () => {
            if (chartMode === 'transaction') return;
            chartMode = 'transaction';
            transactionBtn.classList.add('bg-gray-200', 'font-semibold');
            transactionBtn.classList.remove('text-gray-600');
            quantityBtn.classList.remove('bg-gray-200', 'font-semibold');
            quantityBtn.classList.add('text-gray-600');
            renderActivityChart();
        });
        quantityBtn.dataset.listenerAttached = 'true';
    }
}