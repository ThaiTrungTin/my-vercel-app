import { sb, viewStates, showView, currentUser, cache, showToast } from './app.js';

let activityChart = null;
let inventoryStatusChart = null;
let currentStats = {}; 
let chartMode = 'quantity'; 
let last30DaysChiTiet = []; 
let allAlertsData = null;
let allNganhOptions = []; 
let unreturnedItemsCache = []; 

const STATUS_CONFIG = {
    'Hết hạn sử dụng': { color: '#ef4444', order: 0 },
    'Từ 1-30 ngày': { color: '#f87171', order: 1 },
    'Từ 31-60 ngày': { color: '#f97316', order: 2 },
    'Từ 61-90 ngày': { color: '#fb923c', order: 3 },
    'Từ 91-120 ngày': { color: '#fbbf24', order: 4 },
    'Từ 121-150 ngày': { color: '#facc15', order: 5 },
    'Từ 151-180 ngày': { color: '#fef08a', order: 6 },
    'Trên 180 ngày': { color: '#16a34a', order: 7 },
    'Còn sử dụng': { color: '#31D134', order: 8 },
    'Cận date': { color: '#36A2EB', order: 9 },
    'Hàng hư': { color: '#F2F208', order: 10 },
    'Không có date': { color: '#9ca3af', order: 11 }
};

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
    const popoverWidth = 250; 
    let left = rect.left;
    
    if (left + popoverWidth > window.innerWidth) {
        left = window.innerWidth - popoverWidth - 20;
    }
    
    popover.style.left = `${left}px`;
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
            <label class="flex items-center space-x-2 px-2 py-1 hover:bg-gray-100 rounded cursor-pointer">
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
            options = ['Sắp hết hàng', 'Tồn kho lâu', 'Cận date'];
        } else {
             const allItems = [];
             if (allAlertsData) {
                Object.values(allAlertsData).forEach(arr => allItems.push(...arr));
             }
             const keyToExtract = filterKey === 'phu_trach' ? 'phu_trach' : 'nganh';
             options = [...new Set(allItems.map(item => item[keyToExtract]).filter(Boolean))].sort();
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
    const isNotAdmin = currentUser.phan_quyen !== 'Admin';
    const userName = currentUser.ho_ten;
    const allowedNganh = (currentUser.xem_data || '').split(',').filter(Boolean);
    const lowStockThreshold = 10;
    const slowMovingDays = 60;
    const urgentExpiryDays = 30;

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - slowMovingDays);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(today.getDate() + urgentExpiryDays);

    let allStockQuery = sb.from('ton_kho_update')
        .select('ma_vach, ma_vt, ten_vt, ton_cuoi, nganh, phu_trach')
        .gt('ton_cuoi', 0);
        
    let recentMovementQuery = sb.from('chi_tiet')
        .select('ma_vach')
        .eq('loai', 'Xuat')
        .gte('thoi_gian', sixtyDaysAgo.toISOString());
        
    let urgentExpiryQuery = sb.from('ton_kho_update')
        .select('ma_vt, ten_vt, lot, date, nganh, phu_trach')
        .eq('tinh_trang', 'Cận date')
        .gt('ton_cuoi', 0);

    if (isNotAdmin) {
        if (allowedNganh.length > 0) {
            const nganhListStr = allowedNganh.map(n => `"${n}"`).join(',');
            allStockQuery = allStockQuery.or(`phu_trach.eq."${userName}",nganh.in.(${nganhListStr})`);
            urgentExpiryQuery = urgentExpiryQuery.or(`phu_trach.eq."${userName}",nganh.in.(${nganhListStr})`);
        } else {
            allStockQuery = allStockQuery.eq('phu_trach', userName);
            urgentExpiryQuery = urgentExpiryQuery.eq('phu_trach', userName);
        }
    }
    
    const [allStockRes, recentMovementRes, urgentExpiryRes] = await Promise.all([
        allStockQuery,
        recentMovementQuery,
        urgentExpiryQuery
    ]);

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

    const recentlyMovedMaVach = new Set((recentMovementRes.data || []).map(i => i.ma_vach));
    const slowMovingItems = (allStockRes.data || []).filter(item => !recentlyMovedMaVach.has(item.ma_vach)).slice(0, 5);
    
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
        urgentExpiry: urgentExpiryItems
    };
}

function renderAlerts(alerts) {
    const listEl = document.getElementById('tq-alerts-list');
    if (!listEl) return;
    listEl.innerHTML = '';
    let alertCount = 0;

    const createAlertItem = (icon, text, info, action, data) => {
        const li = document.createElement('li');
        // --- NÂNG CẤP: Giảm tối đa padding và spacing trên mobile để tiết kiệm không gian ---
        li.className = 'flex items-center space-x-1.5 md:space-x-3 p-1 md:p-3 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer alert-item';
        li.dataset.action = action;
        li.dataset.value = data;
        li.innerHTML = `
            ${icon}
            <div class="flex-grow min-w-0">
                <span class="text-[9px] md:text-sm text-gray-700 leading-tight">${text}</span>
            </div>
            <div class="flex-shrink-0 text-right text-[8px] md:text-xs text-gray-500 ml-2 w-24 md:w-28">
                <p class="truncate">${info.nganh || 'N/A'}</p>
                <p class="font-medium truncate">${info.phu_trach || 'N/A'}</p>
            </div>
        `;
        listEl.appendChild(li);
        alertCount++;
    };
    
    const icons = {
        lowStock: `<div class="flex-shrink-0 w-6 h-6 md:w-8 md:h-8 rounded-full bg-yellow-100 flex items-center justify-center"><svg class="w-4 h-4 md:w-5 md:h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1-1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2a1 1 0 011 1v8a1 1 0 01-1 1h-2a1 1 0 01-1-1z"></path></svg></div>`,
        slowMoving: `<div class="flex-shrink-0 w-6 h-6 md:w-8 md:h-8 rounded-full bg-blue-100 flex items-center justify-center"><svg class="w-4 h-4 md:w-5 md:h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div>`,
        urgentExpiry: `<div class="flex-shrink-0 w-6 h-6 md:w-8 md:h-8 rounded-full bg-red-100 flex items-center justify-center"><svg class="w-4 h-4 md:w-5 md:h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg></div>`
    };

    (alerts.lowStock || []).forEach(item => {
        createAlertItem(icons.lowStock, `Hết: <strong>${item.ma_vt}</strong> còn <strong>${item.total_ton_cuoi}</strong>.`, item, 'ton-kho:ma_vt', item.ma_vt);
    });
    (alerts.slowMoving || []).forEach(item => {
        createAlertItem(icons.slowMoving, `Lâu: <strong>${item.ma_vt}</strong> (>60 ngày).`, item, 'ton-kho:ma_vt', item.ma_vt);
    });
    (alerts.urgentExpiry || []).forEach(item => {
        createAlertItem(icons.urgentExpiry, `Date: <strong>${item.lot}</strong> (${item.ma_vt}) - <strong>${item.date}</strong>.`, item, 'ton-kho:lot', item.lot);
    });

    if (alertCount === 0) {
        listEl.innerHTML = '<li class="p-4 text-center text-gray-500">Mọi thứ đều ổn!</li>';
    }
}

function renderActivityChart() {
    const ctxEl = document.getElementById('tq-activity-chart');
    if (!ctxEl) return;
    const ctx = ctxEl.getContext('2d');
    
    const last30Days = {};
    for (let i = 29; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        last30Days[d.toISOString().split('T')[0]] = { nhap: 0, xuat: 0 };
    }

    last30DaysChiTiet.forEach(item => {
        const key = item.thoi_gian.split('T')[0];
        if (last30Days[key]) {
            if (chartMode === 'quantity') {
                last30Days[key].nhap += item.nhap || 0;
                last30Days[key].xuat += item.xuat || 0;
            } else {
                if (item.nhap > 0) last30Days[key].nhap++;
                if (item.xuat > 0) last30Days[key].xuat++;
            }
        }
    });

    if (activityChart) activityChart.destroy();
    activityChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(last30Days).map(k => `${new Date(k).getDate()}/${new Date(k).getMonth() + 1}`),
            datasets: [
                { label: 'Nhập', data: Object.values(last30Days).map(d => d.nhap), backgroundColor: 'rgba(54, 162, 235, 0.6)' },
                { label: 'Xuất', data: Object.values(last30Days).map(d => d.xuat), backgroundColor: 'rgba(255, 99, 132, 0.6)' }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

async function renderInventoryStatusChart() {
    const ctxEl = document.getElementById('tq-inventory-chart');
    if (!ctxEl) return;
    const ctx = ctxEl.getContext('2d');
    const selectedNganhArr = tongQuanState.inventory.nganh;
    const isMobile = window.innerWidth <= 768;

    let query = sb.from('ton_kho_update').select('tinh_trang, ton_cuoi');
    if (currentUser.phan_quyen !== 'Admin') {
        const name = currentUser.ho_ten;
        const allowedNganh = (currentUser.xem_data || '').split(',').filter(Boolean);
        if (allowedNganh.length > 0) {
            const nganhListStr = allowedNganh.map(n => `"${n}"`).join(',');
            query = query.or(`phu_trach.eq."${name}",nganh.in.(${nganhListStr})`);
        } else {
            query = query.eq('phu_trach', name);
        }
    }
    if (selectedNganhArr.length > 0) query = query.in('nganh', selectedNganhArr);

    const { data } = await query;
    
    const countsMap = {};
    let totalCount = 0;
    (data || []).forEach(item => {
        const status = item.tinh_trang || 'Không có date';
        const count = item.ton_cuoi || 0;
        countsMap[status] = (countsMap[status] || 0) + count;
    });

    const activeStatuses = Object.keys(countsMap).filter(status => countsMap[status] > 0);
    activeStatuses.forEach(s => totalCount += countsMap[s]);

    const sortedStatuses = activeStatuses.sort((a, b) => {
        const orderA = STATUS_CONFIG[a]?.order ?? 999;
        const orderB = STATUS_CONFIG[b]?.order ?? 999;
        return orderA - orderB;
    });

    const chartLabels = sortedStatuses;
    const chartDataValues = sortedStatuses.map(s => countsMap[s]);
    const chartColors = sortedStatuses.map(s => STATUS_CONFIG[s]?.color || '#9ca3af');

    if (inventoryStatusChart) inventoryStatusChart.destroy();
    inventoryStatusChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: chartLabels,
            datasets: [{ 
                data: chartDataValues, 
                backgroundColor: chartColors,
                borderWidth: 1,
                hoverOffset: 10
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            layout: {
                padding: isMobile ? 0 : 10
            },
            plugins: {
                legend: {
                    position: 'right',
                    align: 'center',
                    onClick: (e, legendItem, legend) => {
                        const index = legendItem.index;
                        const chart = legend.chart;
                        const meta = chart.getDatasetMeta(0);
                        
                        // Toggle hidden state of the point
                        meta.data[index].hidden = !meta.data[index].hidden;
                        chart.update();
                    },
                    labels: {
                        usePointStyle: true,
                        pointStyle: 'circle',
                        padding: isMobile ? 6 : 12,
                        boxWidth: 8,
                        font: {
                            size: 10,
                            weight: '600'
                        },
                        generateLabels: (chart) => {
                            const data = chart.data;
                            if (data.labels.length && data.datasets.length) {
                                return data.labels.map((label, i) => {
                                    const value = data.datasets[0].data[i];
                                    const percentage = totalCount > 0 ? ((value / totalCount) * 100).toFixed(1) : 0;
                                    const meta = chart.getDatasetMeta(0);
                                    const isHidden = meta.data[i] ? meta.data[i].hidden : false;
                                    
                                    return {
                                        text: `${label}: ${value.toLocaleString()} (${percentage}%)`,
                                        fillStyle: data.datasets[0].backgroundColor[i],
                                        strokeStyle: data.datasets[0].backgroundColor[i],
                                        lineWidth: 0,
                                        hidden: isHidden,
                                        index: i,
                                        // Áp dụng font gạch ngang (strikethrough) khi bị ẩn
                                        font: {
                                            size: 10,
                                            weight: '600',
                                            decoration: isHidden ? 'line-through' : 'none'
                                        }
                                    };
                                });
                            }
                            return [];
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const value = context.raw;
                            const percentage = totalCount > 0 ? ((value / totalCount) * 100).toFixed(1) : 0;
                            return `${context.label}: ${value.toLocaleString()} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

function updateAlertFiltersAndRender() {
    if (!allAlertsData) return;
    const loaiMap = { 'Sắp hết hàng': 'lowStock', 'Tồn kho lâu': 'slowMoving', 'Cận date': 'urgentExpiry' };
    const selectedLoaiKeys = tongQuanState.alerts.loai.map(l => loaiMap[l]);
    const selectedNganh = tongQuanState.alerts.nganh;
    const selectedPhuTrach = tongQuanState.alerts.phu_trach;

    const filtered = {};
    Object.keys(allAlertsData).forEach(key => {
        filtered[key] = allAlertsData[key].filter(item => {
            const matchesLoai = selectedLoaiKeys.length === 0 || selectedLoaiKeys.includes(key);
            const matchesNganh = selectedNganh.length === 0 || selectedNganh.includes(item.nganh);
            const matchesPhuTrach = selectedPhuTrach.length === 0 || selectedPhuTrach.includes(item.phu_trach);
            return matchesLoai && matchesNganh && matchesPhuTrach;
        });
    });
    renderAlerts(filtered);
}

export async function fetchTongQuanData() {
    try {
        const isNotAdmin = currentUser.phan_quyen !== 'Admin';
        const userName = currentUser.ho_ten;
        const allowedNganh = (currentUser.xem_data || '').split(',').filter(Boolean);

        let sanPhamCountQuery = sb.from('san_pham').select('ma_vt', { count: 'exact', head: true });
        let tonKhoQuery = sb.from('ton_kho_update').select('ma_vt, date, ton_cuoi, tinh_trang, nganh, phu_trach');
        
        let nganhResQuery = sb.from('ton_kho_update').select('nganh');

        if (isNotAdmin) {
            if (allowedNganh.length > 0) {
                const nganhListStr = allowedNganh.map(n => `"${n}"`).join(',');
                sanPhamCountQuery = sanPhamCountQuery.or(`phu_trach.eq."${userName}",nganh.in.(${nganhListStr})`);
                tonKhoQuery = tonKhoQuery.or(`phu_trach.eq."${userName}",nganh.in.(${nganhListStr})`);
                nganhResQuery = nganhResQuery.or(`phu_trach.eq."${userName}",nganh.in.(${nganhListStr})`);
            } else {
                sanPhamCountQuery = sanPhamCountQuery.eq('phu_trach', userName);
                tonKhoQuery = tonKhoQuery.eq('phu_trach', userName);
                nganhResQuery = nganhResQuery.eq('phu_trach', userName);
            }
        }

        const [spRes, tkRes] = await Promise.all([sanPhamCountQuery, tonKhoQuery]);
        const allStockItems = tkRes.data || [];
        
        document.getElementById('tq-stat-san-pham').textContent = (spRes.count ?? 0).toLocaleString();
        document.getElementById('tq-sub-stat-san-pham').innerHTML = `Khả dụng: ${allStockItems.filter(i => i.ton_cuoi > 0).reduce((s, i) => s + i.ton_cuoi, 0).toLocaleString()}`;

        const canDateItems = allStockItems.filter(i => i.tinh_trang === 'Cận date' && i.ton_cuoi > 0);
        document.getElementById('tq-stat-can-date').textContent = `${new Set(canDateItems.map(i => i.ma_vt)).size} mặt hàng`;
        document.getElementById('tq-sub-stat-can-date').innerHTML = `Số lượng: ${canDateItems.reduce((s, i) => s + i.ton_cuoi, 0).toLocaleString()}`;

        const today = new Date();
        const hetHanItems = allStockItems.filter(i => {
            if (!i.date) return false;
            const [d, m, y] = i.date.split('/').map(Number);
            const exp = new Date(y, m - 1, d);
            return exp.getMonth() === today.getMonth() && exp.getFullYear() === today.getFullYear() && exp <= today;
        });
        document.getElementById('tq-stat-het-han').textContent = `${new Set(hetHanItems.map(i => i.ma_vt)).size} mặt hàng`;
        document.getElementById('tq-sub-stat-het-han').innerHTML = `Số lượng: ${hetHanItems.reduce((s, i) => s + i.ton_cuoi, 0).toLocaleString()}`;

        const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(today.getDate() - 30);
        let chiTietQuery = sb.from('chi_tiet').select('thoi_gian, nhap, xuat, nganh, phu_trach').gte('thoi_gian', thirtyDaysAgo.toISOString());
        
        if (isNotAdmin) {
            if (allowedNganh.length > 0) {
                const nganhListStr = allowedNganh.map(n => `"${n}"`).join(',');
                chiTietQuery = chiTietQuery.or(`phu_trach.eq."${userName}",nganh.in.(${nganhListStr})`);
            } else {
                chiTietQuery = chiTietQuery.eq('phu_trach', userName);
            }
        }

        const [ctRes, alerts, nganhRes] = await Promise.all([chiTietQuery, fetchAlerts(), nganhResQuery]);
        last30DaysChiTiet = ctRes.data || [];
        allAlertsData = alerts;
        allNganhOptions = [...new Set((nganhRes.data || []).map(i => i.nganh).filter(Boolean))].sort();

        renderActivityChart();
        updateAlertFiltersAndRender();
        renderInventoryStatusChart();

    } catch (e) { console.error(e); }
}

export function initTongQuanView() {
    const view = document.getElementById('view-phat-trien');
    if(!view || view.dataset.listenerAttached) return;

    view.addEventListener('click', (e) => {
        const filterBtn = e.target.closest('.filter-btn');
        if (filterBtn) { openTongQuanFilterPopover(filterBtn); return; }

        const resetAndShow = (viewId, filters) => {
            const state = viewStates[viewId];
            if (state) {
                state.searchTerm = '';
                Object.keys(state.filters).forEach(k => state.filters[k] = Array.isArray(state.filters[k]) ? [] : '');
                Object.assign(state.filters, filters);
                if (viewId === 'view-ton-kho') state.stockAvailability = filters.tinh_trang ? 'available' : 'all';
                showView(viewId);
            }
        };

        const alertItem = e.target.closest('.alert-item');
        if (alertItem) {
            const [viewPrefix, key] = alertItem.dataset.action.split(':');
            resetAndShow(`view-${viewPrefix}`, { [key]: [alertItem.dataset.value] });
            return;
        }

        if (e.target.closest('#tq-card-san-pham')) {
            const s = viewStates['view-ton-kho']; s.stockAvailability = 'available'; showView('view-ton-kho');
        } else if (e.target.closest('#tq-card-can-date')) {
            resetAndShow('view-ton-kho', { tinh_trang: ['Cận date'] });
        } else if (e.target.closest('#tq-card-het-han')) {
            resetAndShow('view-ton-kho', { tinh_trang: ['Hết hạn sử dụng'] });
        }
    });

    document.getElementById('tq-chart-mode-quantity').onclick = (e) => {
        chartMode = 'quantity'; 
        e.target.classList.add('bg-gray-200', 'font-semibold'); 
        document.getElementById('tq-chart-mode-transaction').classList.remove('bg-gray-200', 'font-semibold');
        renderActivityChart();
    };
    document.getElementById('tq-chart-mode-transaction').onclick = (e) => {
        chartMode = 'transaction'; 
        e.target.classList.add('bg-gray-200', 'font-semibold'); 
        document.getElementById('tq-chart-mode-quantity').classList.remove('bg-gray-200', 'font-semibold');
        renderActivityChart();
    };
    view.dataset.listenerAttached = 'true';
}