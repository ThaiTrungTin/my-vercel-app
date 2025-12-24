
import { sb, viewStates, showView, currentUser, cache, showToast, showLoading } from './app.js';

let activityChart = null;
let inventoryStatusChart = null;
let chartMode = 'quantity'; 
let last30DaysChiTiet = []; 
let allAlertsData = null;
let allNganhOptions = []; 
let activeHierarchyPopover = null;

// Biến kiểm soát trạng thái tải lần đầu của phả hệ
let isHierarchyFirstLoad = true;

// Biến lưu trữ các path đang được mở trong phả hệ để giữ trạng thái khi chuyển mode
const expandedHierarchyPaths = new Set();
// Set lưu trữ danh sách ID có phân bổ để đánh dấu trên phả hệ
let idsWithDistribution = new Set();

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
    },
    hierarchy: {
        mode: 'xuat',
        subMode: 'all', // all, xuat, shortage
        ma_vt: [],
        yeu_cau: []
    }
};

function closeHierarchyPopover() {
    if (activeHierarchyPopover) {
        activeHierarchyPopover.element.remove();
        document.removeEventListener('click', closeHierarchyPopover);
        activeHierarchyPopover = null;
    }
}

function updateTQFilterButtonTexts() {
    const defaultTexts = {
        'tq-alert-filter-loai-btn': 'Loại',
        'tq-alert-filter-nganh-btn': 'Ngành',
        'tq-alert-filter-phu-trach-btn': 'Phụ Trách',
        'tq-inventory-nganh-filter-btn': 'Ngành',
        'tq-hierarchy-ma-vt-filter-btn': 'Mã VT',
        'tq-hierarchy-yeu-cau-filter-btn': 'Yêu Cầu',
        'tq-hierarchy-time-filter-btn': 'Thời Gian'
    };
    
    document.querySelectorAll('#view-phat-trien .filter-btn, #tq-hierarchy-time-filter-btn').forEach(btn => {
        const context = btn.dataset.context || 'alerts';
        const filterKey = btn.dataset.filterKey || (btn.id === 'tq-hierarchy-time-filter-btn' ? 'time_preset' : '');
        const state = tongQuanState[context];
        
        if (btn.id === 'tq-hierarchy-time-filter-btn') {
            const preset = document.getElementById('tq-hierarchy-time-preset').value;
            const presets = {
                all: 'Tất cả', today: 'Hôm nay', week: 'Tuần này', month: 'Tháng này',
                quarter: 'Quý này', year: 'Năm nay', last_year: 'Năm trước', custom: 'Tùy chọn'
            };
            btn.textContent = presets[preset] || 'Thời Gian';
            return;
        }

        if (state && state[filterKey]) {
            const selectedCount = state[filterKey].length;
            const defaultText = defaultTexts[btn.id] || 'Filter';
            btn.textContent = selectedCount > 0 ? `${defaultText} (${selectedCount})` : defaultText;
        }
    });
}

function openHierarchyTimePresetPopover(button) {
    const template = document.getElementById('filter-popover-template');
    if (!template) return;
    const popover = template.content.cloneNode(true).querySelector('.filter-popover');
    document.body.appendChild(popover);

    const rect = button.getBoundingClientRect();
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile) {
        popover.style.position = 'fixed';
        popover.style.left = '50%';
        popover.style.top = '50%';
        popover.style.transform = 'translate(-50%, -50%)';
        popover.style.width = '200px';
    } else {
        popover.style.left = `${rect.left}px`;
        popover.style.top = `${rect.bottom + window.scrollY + 5}px`;
    }

    const searchInput = popover.querySelector('.filter-search-input');
    searchInput.classList.add('hidden');
    const optionsList = popover.querySelector('.filter-options-list');
    const applyBtn = popover.querySelector('.filter-apply-btn');
    applyBtn.classList.add('hidden');
    popover.querySelector('.filter-toggle-all-btn').classList.add('hidden');
    popover.querySelector('.filter-selection-count').classList.add('hidden');

    const presets = [
        { value: 'all', label: 'Tất cả' },
        { value: 'today', label: 'Hôm nay' },
        { value: 'week', label: 'Tuần này' },
        { value: 'month', label: 'Tháng này' },
        { value: 'quarter', label: 'Quý này' },
        { value: 'year', label: 'Năm nay' },
        { value: 'last_year', label: 'Năm trước' },
        { value: 'custom', label: 'Tùy chọn' }
    ];

    const currentPreset = document.getElementById('tq-hierarchy-time-preset').value;

    optionsList.innerHTML = presets.map(p => `
        <label class="flex items-center space-x-2 px-2 py-2 hover:bg-blue-50 rounded cursor-pointer border-b last:border-0 border-gray-50">
            <input type="radio" name="time_preset_choice" value="${p.value}" class="time-preset-radio w-4 h-4" ${p.value === currentPreset ? 'checked' : ''}>
            <span class="text-sm font-medium ${p.value === currentPreset ? 'text-blue-600' : 'text-gray-700'}">${p.label}</span>
        </label>
    `).join('');

    const closeHandler = (e) => {
        if (!popover.contains(e.target) && e.target !== button) {
            popover.remove();
            document.removeEventListener('click', closeHandler);
        }
    };

    optionsList.onchange = (e) => {
        const val = e.target.value;
        document.getElementById('tq-hierarchy-time-preset').value = val;
        document.getElementById('tq-hierarchy-custom-dates').classList.toggle('hidden', val !== 'custom');
        updateTQFilterButtonTexts();
        fetchAndRenderHierarchy();
        popover.remove();
        document.removeEventListener('click', closeHandler);
    };

    setTimeout(() => document.addEventListener('click', closeHandler), 0);
}

async function getHierarchyDependentOptions(filterKey) {
    const preset = document.getElementById('tq-hierarchy-time-preset').value;
    const { start, end } = getRangeDates(preset);
    const hState = tongQuanState.hierarchy;

    let query = sb.from('chi_tiet_v1')
        .select(filterKey)
        .gte('thoi_gian', start)
        .lte('thoi_gian', end);

    if (hState.mode === 'xuat') {
        query = query.gt('yc_sl', 0);
    } else {
        query = query.gt('nhap', 0);
    }

    if (filterKey !== 'ma_vt' && hState.ma_vt.length > 0) {
        query = query.in('ma_vt', hState.ma_vt);
    }
    if (filterKey !== 'yeu_cau' && hState.yeu_cau.length > 0) {
        query = query.in('yeu_cau', hState.yeu_cau);
    }

    if (currentUser.phan_quyen !== 'Admin') {
        const allowedNganh = (currentUser.xem_data || '').split(',').filter(Boolean);
        if (allowedNganh.length > 0) {
            query = query.or(`phu_trach.eq."${currentUser.ho_ten}",nganh.in.(${allowedNganh.map(n => `"${n}"`).join(',')})`);
        } else {
            query = query.eq('phu_trach', currentUser.ho_ten);
        }
    }

    const { data } = await query.limit(5000);
    return [...new Set((data || []).map(i => i[filterKey]).filter(Boolean))].sort();
}

async function openTongQuanFilterPopover(button) {
    const filterKey = button.dataset.filterKey;
    const context = button.dataset.context || 'alerts';
    const state = tongQuanState[context];
    const isMobile = window.innerWidth <= 768;

    const template = document.getElementById('filter-popover-template');
    if (!template) return;
    const popoverContent = template.content.cloneNode(true);
    const popover = popoverContent.querySelector('.filter-popover');
    document.body.appendChild(popover);

    const rect = button.getBoundingClientRect();
    const popoverWidth = isMobile ? 180 : 250; 
    let left = rect.left;
    if (left + popoverWidth > window.innerWidth) left = window.innerWidth - popoverWidth - 10;
    
    popover.style.width = `${popoverWidth}px`;
    popover.style.left = `${Math.max(10, left)}px`;
    popover.style.top = `${rect.bottom + window.scrollY + 5}px`;
    popover.style.zIndex = '1000';

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

    optionsList.innerHTML = '<div class="text-center py-4 text-gray-400 italic">Đang tải lựa chọn...</div>';
    applyBtn.disabled = true;

    let options = [];
    if (context === 'alerts') {
        if (filterKey === 'loai') {
            options = ['Sắp hết hàng', 'Tồn kho lâu', 'Cận date'];
        } else {
             const allItems = [];
             if (allAlertsData) Object.values(allAlertsData).forEach(arr => allItems.push(...arr));
             const keyToExtract = filterKey === 'phu_trach' ? 'phu_trach' : 'nganh';
             options = [...new Set(allItems.map(item => item[keyToExtract]).filter(Boolean))].sort();
        }
    } else if (context === 'inventory' && filterKey === 'nganh') {
        options = allNganhOptions;
    } else if (context === 'hierarchy') {
        options = await getHierarchyDependentOptions(filterKey);
    }

    renderOptions(options);
    updateSelectionCount();
    applyBtn.disabled = false;

    searchInput.oninput = () => renderOptions(options);
    optionsList.onchange = e => {
        if (e.target.classList.contains('filter-option-cb')) {
            if (e.target.checked) tempSelectedOptions.add(e.target.value);
            else tempSelectedOptions.delete(e.target.value);
            updateSelectionCount();
            updateToggleAllButtonState(options.filter(opt => opt.toLowerCase().includes(searchInput.value.toLowerCase())));
        }
    };
    toggleAllBtn.onclick = () => {
        const visibleOptions = options.filter(opt => opt.toLowerCase().includes(searchInput.value.toLowerCase()));
        const isSelectAllAction = toggleAllBtn.textContent === 'Tất cả';
        visibleOptions.forEach(option => {
            if (isSelectAllAction) tempSelectedOptions.add(String(option));
            else tempSelectedOptions.delete(String(option));
        });
        renderOptions(options);
        updateSelectionCount();
    };

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
        else if (context === 'hierarchy') fetchAndRenderHierarchy();
        popover.remove();
        document.removeEventListener('click', closePopover);
    };

    setTimeout(() => document.addEventListener('click', closePopover), 0);
}

function getRangeDates(preset) {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    switch (preset) {
        case 'all':
            start = new Date(0); 
            end = new Date();
            break;
        case 'today':
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
            break;
        case 'week':
            const day = now.getDay();
            const diff = now.getDate() - day + (day === 0 ? -6 : 1); 
            start = new Date(now.setDate(diff));
            start.setHours(0, 0, 0, 0);
            end = new Date(start);
            end.setDate(start.getDate() + 6);
            end.setHours(23, 59, 59, 999);
            break;
        case 'month':
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
            break;
        case 'quarter':
            const q = Math.floor(now.getMonth() / 3);
            start = new Date(now.getFullYear(), q * 3, 1);
            end = new Date(now.getFullYear(), (q + 1) * 3, 0, 23, 59, 59, 999);
            break;
        case 'year':
            start = new Date(now.getFullYear(), 0, 1);
            end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
            break;
        case 'last_year':
            start = new Date(now.getFullYear() - 1, 0, 1);
            end = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
            break;
        case 'custom':
            const from = document.getElementById('tq-hierarchy-date-from').value;
            const to = document.getElementById('tq-hierarchy-date-to').value;
            start = from ? new Date(from) : new Date(0);
            end = to ? new Date(to) : new Date();
            end.setHours(23, 59, 59, 999);
            break;
    }
    return { start: start.toISOString(), end: end.toISOString() };
}

async function fetchAndRenderHierarchy() {
    const container = document.getElementById('tq-hierarchy-container');
    if (!container) return;
    
    if (isHierarchyFirstLoad || container.innerHTML.trim() === '') {
        container.innerHTML = '<div class="text-center py-10"><svg class="animate-spin h-8 w-8 text-blue-500 mx-auto" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><p class="mt-2 text-xs text-gray-500 font-bold uppercase tracking-wider">Đang tải...</p></div>';
    }

    const preset = document.getElementById('tq-hierarchy-time-preset').value;
    const { start, end } = getRangeDates(preset);
    const hState = tongQuanState.hierarchy;

    // Hiển thị pill sub-mode nếu đang ở chế độ Xuất
    const subModeContainer = document.getElementById('tq-hierarchy-submode-container');
    if (subModeContainer) {
        subModeContainer.classList.toggle('hidden', hState.mode !== 'xuat');
    }

    try {
        let query = sb.from('chi_tiet_v1')
            .select('id, bu, franchise, ma_vt, yeu_cau, ma_nx, xuat, nhap, yc_sl')
            .gte('thoi_gian', start)
            .lte('thoi_gian', end);

        if (hState.mode === 'xuat') {
            query = query.gt('yc_sl', 0);
        } else {
            query = query.gt('nhap', 0);
        }

        if (hState.ma_vt.length > 0) query = query.in('ma_vt', hState.ma_vt);
        if (hState.yeu_cau.length > 0) query = query.in('yeu_cau', hState.yeu_cau);

        if (currentUser.phan_quyen !== 'Admin') {
            const allowedNganh = (currentUser.xem_data || '').split(',').filter(Boolean);
            if (allowedNganh.length > 0) {
                query = query.or(`phu_trach.eq."${currentUser.ho_ten}",nganh.in.(${allowedNganh.map(n => `"${n}"`).join(',')})`);
            } else {
                query = query.eq('phu_trach', currentUser.ho_ten);
            }
        }

        const { data: distData } = await sb.from('chi_tiet_vt').select('id_ct');
        idsWithDistribution = new Set((distData || []).map(d => d.id_ct));

        const { data, error } = await query;
        if (error) throw error;

        if (!data || data.length === 0) {
            container.innerHTML = `<div class="text-center py-10 text-gray-400 italic">Không có dữ liệu trong khoảng thời gian này.</div>`;
            isHierarchyFirstLoad = false;
            return;
        }

        const tree = buildHierarchy(data, hState.mode, hState.subMode);
        
        const fragment = document.createDocumentFragment();
        renderTree(fragment, tree, 0, hState.mode, '', hState.subMode);
        
        container.innerHTML = '';
        container.appendChild(fragment);
        isHierarchyFirstLoad = false;

    } catch (err) {
        console.error("Hierarchy fetch error:", err);
        if (isHierarchyFirstLoad) {
            container.innerHTML = `<div class="text-center py-10 text-red-500 font-bold">Lỗi tải: ${err.message}</div>`;
        }
        isHierarchyFirstLoad = false;
    }
}

function buildHierarchy(data, mode, subMode = 'all') {
    const root = { total: 0, xuatTotal: 0, shortageTotal: 0, nxSet: new Set(), vtSet: new Set(), children: {} };

    data.forEach(row => {
        const bu = row.bu || 'KHÔNG XÁC ĐỊNH';
        const franchise = row.franchise || 'N/A';
        const ma_vt = row.ma_vt;
        const yeu_cau = row.yeu_cau || 'Chưa rõ';
        const ma_nx = row.ma_nx || 'N/A';
        const id_ct = row.id; 
        
        const xuatVal = parseFloat(row.xuat) || 0;
        const nhapVal = parseFloat(row.nhap) || 0;
        const ycVal = parseFloat(row.yc_sl) || 0;
        
        const isDO = ma_nx.includes('DO');
        const shortageVal = (mode === 'xuat' && isDO) ? Math.max(0, ycVal - xuatVal) : 0;

        // Logic lọc Sub-mode cho chế độ Xuất
        if (mode === 'xuat') {
            if (subMode === 'xuat' && xuatVal <= 0) return;
            if (subMode === 'shortage' && shortageVal <= 0) return;
        }

        const mainVal = mode === 'xuat' ? xuatVal + shortageVal : nhapVal;
        root.total += mainVal;
        root.xuatTotal += mode === 'xuat' ? xuatVal : 0;
        root.shortageTotal += mode === 'xuat' ? shortageVal : 0;
        if(ma_nx) root.nxSet.add(ma_nx);
        if(ma_vt) root.vtSet.add(ma_vt);

        if (!root.children[bu]) root.children[bu] = { total: 0, xuatTotal: 0, shortageTotal: 0, nxSet: new Set(), vtSet: new Set(), children: {} };
        root.children[bu].total += mainVal;
        root.children[bu].xuatTotal += mode === 'xuat' ? xuatVal : 0;
        root.children[bu].shortageTotal += mode === 'xuat' ? shortageVal : 0;
        if(ma_nx) root.children[bu].nxSet.add(ma_nx);
        if(ma_vt) root.children[bu].vtSet.add(ma_vt);

        if (!root.children[bu].children[franchise]) root.children[bu].children[franchise] = { total: 0, xuatTotal: 0, shortageTotal: 0, nxSet: new Set(), vtSet: new Set(), children: {} };
        root.children[bu].children[franchise].total += mainVal;
        root.children[bu].children[franchise].xuatTotal += mode === 'xuat' ? xuatVal : 0;
        root.children[bu].children[franchise].shortageTotal += mode === 'xuat' ? shortageVal : 0;
        if(ma_nx) root.children[bu].children[franchise].nxSet.add(ma_nx);
        if(ma_vt) root.children[bu].children[franchise].vtSet.add(ma_vt);

        if (!root.children[bu].children[franchise].children[ma_vt]) root.children[bu].children[franchise].children[ma_vt] = { total: 0, xuatTotal: 0, shortageTotal: 0, nxSet: new Set(), vtSet: new Set(), children: {} };
        root.children[bu].children[franchise].children[ma_vt].total += mainVal;
        root.children[bu].children[franchise].children[ma_vt].xuatTotal += mode === 'xuat' ? xuatVal : 0;
        root.children[bu].children[franchise].children[ma_vt].shortageTotal += mode === 'xuat' ? shortageVal : 0;
        if(ma_nx) root.children[bu].children[franchise].children[ma_vt].nxSet.add(ma_nx);
        if(ma_vt) root.children[bu].children[franchise].children[ma_vt].vtSet.add(ma_vt);

        const prodNode = root.children[bu].children[franchise].children[ma_vt];

        if (mode === 'xuat') {
            if (subMode === 'all') {
                if (xuatVal > 0) {
                    const cat = "Đã xuất";
                    if (!prodNode.children[cat]) prodNode.children[cat] = { total: 0, xuatTotal: 0, shortageTotal: 0, nxSet: new Set(), children: {} };
                    prodNode.children[cat].total += xuatVal;
                    prodNode.children[cat].xuatTotal += xuatVal;
                    if(ma_nx) prodNode.children[cat].nxSet.add(ma_nx);
                    
                    if (!prodNode.children[cat].children[yeu_cau]) prodNode.children[cat].children[yeu_cau] = { total: 0, xuatTotal: 0, shortageTotal: 0, nxSet: new Set(), children: {} };
                    prodNode.children[cat].children[yeu_cau].total += xuatVal;
                    prodNode.children[cat].children[yeu_cau].xuatTotal += xuatVal;
                    if(ma_nx) prodNode.children[cat].children[yeu_cau].nxSet.add(ma_nx);
                    
                    if (!prodNode.children[cat].children[yeu_cau].children[ma_nx]) {
                        prodNode.children[cat].children[yeu_cau].children[ma_nx] = { total: 0, xuatTotal: 0, shortageTotal: 0, id_cts: [], isMaNX: true, nxSet: new Set(), children: {} };
                    }
                    const nxNode = prodNode.children[cat].children[yeu_cau].children[ma_nx];
                    nxNode.total += xuatVal;
                    nxNode.xuatTotal += xuatVal;
                    nxNode.id_cts.push(id_ct);
                    if(ma_nx) nxNode.nxSet.add(ma_nx);
                }

                if (shortageVal > 0) {
                    const cat = "Thiếu hàng";
                    if (!prodNode.children[cat]) prodNode.children[cat] = { total: 0, xuatTotal: 0, shortageTotal: 0, nxSet: new Set(), children: {} };
                    prodNode.children[cat].total += shortageVal;
                    prodNode.children[cat].shortageTotal += shortageVal;
                    if(ma_nx) prodNode.children[cat].nxSet.add(ma_nx);
                    
                    if (!prodNode.children[cat].children[yeu_cau]) prodNode.children[cat].children[yeu_cau] = { total: 0, xuatTotal: 0, shortageTotal: 0, nxSet: new Set(), children: {} };
                    prodNode.children[cat].children[yeu_cau].total += shortageVal;
                    prodNode.children[cat].children[yeu_cau].shortageTotal += shortageVal;
                    if(ma_nx) prodNode.children[cat].children[yeu_cau].nxSet.add(ma_nx);
                    
                    if (!prodNode.children[cat].children[yeu_cau].children[ma_nx]) {
                        prodNode.children[cat].children[yeu_cau].children[ma_nx] = { total: 0, xuatTotal: 0, shortageTotal: 0, id_cts: [], isMaNX: true, nxSet: new Set(), children: {} };
                    }
                    const nxNode = prodNode.children[cat].children[yeu_cau].children[ma_nx];
                    nxNode.total += shortageVal;
                    nxNode.shortageTotal += shortageVal;
                    nxNode.id_cts.push(id_ct);
                    if(ma_nx) nxNode.nxSet.add(ma_nx);
                }
            } else {
                const valToUse = subMode === 'xuat' ? xuatVal : shortageVal;
                if (valToUse > 0) {
                    if (!prodNode.children[yeu_cau]) prodNode.children[yeu_cau] = { total: 0, xuatTotal: 0, shortageTotal: 0, nxSet: new Set(), children: {} };
                    prodNode.children[yeu_cau].total += valToUse;
                    if (subMode === 'xuat') prodNode.children[yeu_cau].xuatTotal += valToUse;
                    else prodNode.children[yeu_cau].shortageTotal += valToUse;
                    if(ma_nx) prodNode.children[yeu_cau].nxSet.add(ma_nx);

                    if (!prodNode.children[yeu_cau].children[ma_nx]) {
                        prodNode.children[yeu_cau].children[ma_nx] = { total: 0, xuatTotal: 0, shortageTotal: 0, id_cts: [], isMaNX: true, nxSet: new Set(), children: {} };
                    }
                    const nxNode = prodNode.children[yeu_cau].children[ma_nx];
                    nxNode.total += valToUse;
                    if (subMode === 'xuat') nxNode.xuatTotal += valToUse;
                    else nxNode.shortageTotal += valToUse;
                    nxNode.id_cts.push(id_ct);
                    if(ma_nx) nxNode.nxSet.add(ma_nx);
                }
            }
        } else {
            if (!prodNode.children[yeu_cau]) prodNode.children[yeu_cau] = { total: 0, nxSet: new Set(), children: {} };
            prodNode.children[yeu_cau].total += nhapVal;
            if(ma_nx) prodNode.children[yeu_cau].nxSet.add(ma_nx);

            if (!prodNode.children[yeu_cau].children[ma_nx]) {
                prodNode.children[yeu_cau].children[ma_nx] = { total: 0, id_cts: [], isMaNX: true, nxSet: new Set(), children: {} };
            }
            const nxNode = prodNode.children[yeu_cau].children[ma_nx];
            nxNode.total += nhapVal;
            nxNode.id_cts.push(id_ct);
            if(ma_nx) nxNode.nxSet.add(ma_nx);
        }
    });

    return root;
}

function renderTree(container, node, level, mode, parentPath, subMode = 'all') {
    const sortedKeys = Object.keys(node.children || {}).sort((a, b) => node.children[b].total - node.children[a].total);

    const weightMap = [
        'font-black',      
        'font-extrabold',  
        'font-bold',       
        'font-semibold',   
        'font-medium',     
        'font-normal'      
    ];
    const currentWeight = weightMap[level] || 'font-normal';

    sortedKeys.forEach(key => {
        const child = node.children[key];
        const hasActualChildren = child.children && Object.keys(child.children).length > 0;
        const isMaNXNode = child.isMaNX;
        
        // Hợp nhất phân bổ: Kiểm tra xem bất kỳ ID nào trong mảng id_cts có phân bổ không
        const hasAnyDistribution = isMaNXNode && child.id_cts.some(id => idsWithDistribution.has(id));
        const canExpandMaNX = isMaNXNode && hasAnyDistribution;
        const hasChildren = hasActualChildren || canExpandMaNX;

        const currentPath = parentPath ? `${parentPath}|${key}` : key;
        const isPreviouslyExpanded = expandedHierarchyPaths.has(currentPath);

        const nodeEl = document.createElement('div');
        nodeEl.className = 'tree-node';
        if (isPreviouslyExpanded) nodeEl.classList.add('expanded');
        
        const contentEl = document.createElement('div');
        contentEl.className = `tree-node-content group flex-nowrap ${level === 0 ? 'bg-white shadow-sm border border-gray-100 mb-1 py-3' : 'py-1.5'}`;
        
        let labelColor = 'text-gray-700';
        let branchLabelWeight = weightMap[level] || 'font-semibold';

        if (level === 0) { labelColor = 'text-blue-900'; }
        if (level === 1) { labelColor = 'text-gray-800'; }
        if (level === 2) { labelColor = 'text-indigo-700'; }
        
        if (key === "Thiếu hàng" || (mode === 'xuat' && subMode === 'shortage' && level >= 3)) {
            labelColor = 'text-amber-500';
        } else if (key === "Đã xuất" || (mode === 'xuat' && subMode === 'xuat' && level >= 3)) {
            labelColor = 'text-red-600';
        }

        const isMaVT = level === 2;
        const isMaNX = isMaNXNode;

        // Số đếm đơn hàng (Đen)
        const nxCount = child.nxSet ? child.nxSet.size : 0;
        const blackCountHtml = !isMaNX ? `<span class="text-[10px] md:text-xs ${currentWeight} text-black ml-1.5 tracking-tighter" title="Số lượng đơn hàng">(${nxCount})</span>` : '';

        // MỚI: Số đếm Mã vật tư (Tím xanh da trời) - Chỉ cho cấp BU và Franchise
        let vtCountHtml = '';
        if (level < 2 && child.vtSet) {
            const vtCount = child.vtSet.size;
            vtCountHtml = `<span class="text-[10px] md:text-xs ${currentWeight} text-indigo-400 ml-1 tracking-tighter cursor-help" title="Số lượng mã vật tư">(${vtCount})</span>`;
        }

        let badgeHtml = '';
        if (isMaNX) {
            let nxColor = 'text-gray-700'; 
            if (mode === 'nhap') {
                nxColor = 'text-green-600';
            } else {
                if (currentPath.includes('Thiếu hàng') || subMode === 'shortage') nxColor = 'text-amber-500';
                else if (currentPath.includes('Đã xuất') || subMode === 'xuat') nxColor = 'text-red-600';
                else nxColor = 'text-blue-600';
            }
            badgeHtml = `<span class="text-[11px] md:text-sm ${currentWeight} ${nxColor} ml-auto whitespace-nowrap">${child.total.toLocaleString()}</span>`;
        } else {
            if (mode === 'xuat') {
                const hasShortage = child.shortageTotal > 0;
                const hasXuat = child.xuatTotal > 0;
                
                if (subMode === 'all') {
                    badgeHtml = `
                        <div class="ml-auto flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap">
                            <div class="flex items-center gap-1 shadow-sm rounded-full overflow-hidden border border-gray-100 bg-white">
                                ${hasXuat ? `<span class="px-2 py-0.5 text-xs md:text-sm ${currentWeight} text-red-600">${child.xuatTotal.toLocaleString()}</span>` : ''}
                                ${hasShortage ? `<span class="px-2 py-0.5 text-xs md:text-sm ${currentWeight} text-amber-500 border-l border-gray-50 bg-amber-50/20">${child.shortageTotal.toLocaleString()}</span>` : ''}
                            </div>
                        </div>
                    `;
                } else if (subMode === 'xuat') {
                    badgeHtml = `
                        <div class="ml-auto flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap">
                            <span class="text-red-600 px-2 py-0.5 text-xs md:text-sm ${currentWeight}">${child.xuatTotal.toLocaleString()}</span>
                        </div>
                    `;
                } else if (subMode === 'shortage') {
                    badgeHtml = `
                        <div class="ml-auto flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap">
                            <span class="text-amber-500 px-2 py-0.5 text-xs md:text-sm ${currentWeight}">${child.shortageTotal.toLocaleString()}</span>
                        </div>
                    `;
                }
            } else {
                badgeHtml = `
                    <div class="ml-auto flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap">
                        <span class="text-green-600 px-2 py-0.5 text-xs md:text-sm ${currentWeight}">${child.total.toLocaleString()}</span>
                    </div>
                `;
            }
        }

        contentEl.innerHTML = `
            <div class="flex items-center gap-1 md:gap-2 flex-grow min-w-0 overflow-hidden">
                ${hasChildren ? `
                    <svg class="tree-toggle-icon w-3 h-3 md:w-4 md:h-4 text-gray-400 group-hover:text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M10 12a1 1 0 01-.707-.293l-4-4a1 1 0 111.414-1.414L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4A1 1 0 0110 12z"></path></svg>
                ` : `<span class="w-3 md:w-4 flex-shrink-0"></span>`}
                
                <div class="flex-grow flex items-center gap-1 md:gap-1.5 overflow-hidden min-w-0">
                    <span class="${branchLabelWeight} ${labelColor} truncate leading-tight text-[10px] md:text-sm">${key}</span>
                    ${blackCountHtml}
                    ${vtCountHtml}
                    ${isMaVT ? `
                        <button class="hierarchy-vt-action-btn flex-shrink-0 p-1 text-gray-300 hover:text-indigo-500 rounded opacity-0 group-hover:opacity-100 transition-opacity" data-ma-vt="${key}">
                            <svg class="w-3 h-3 md:w-4 md:h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"></path></svg>
                        </button>
                    ` : ''}
                    ${isMaNX ? `
                        <button class="hierarchy-nx-action-btn flex-shrink-0 p-1 text-gray-300 hover:text-green-500 rounded opacity-0 group-hover:opacity-100 transition-opacity" data-ma-nx="${key}" data-ct-id="${child.id_cts[0]}">
                            <svg class="w-3 h-3 md:w-4 md:h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"></path></svg>
                        </button>
                    ` : ''}
                </div>
            </div>
            ${badgeHtml}
        `;

        nodeEl.appendChild(contentEl);

        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'tree-children';
        nodeEl.appendChild(childrenContainer);

        const vtActionBtn = contentEl.querySelector('.hierarchy-vt-action-btn');
        if (vtActionBtn) vtActionBtn.onclick = (e) => { e.stopPropagation(); openHierarchyVtActionMenu(e, vtActionBtn); };

        const nxActionBtn = contentEl.querySelector('.hierarchy-nx-action-btn');
        if (nxActionBtn) nxActionBtn.onclick = (e) => {
            e.stopPropagation();
            openHierarchyNxActionMenu(e, nxActionBtn);
        };

        if (hasChildren) {
            contentEl.onclick = async (e) => {
                if (e.target.closest('button')) return;
                e.stopPropagation();
                const isExpanded = nodeEl.classList.toggle('expanded');
                if (isExpanded) {
                    expandedHierarchyPaths.add(currentPath);
                    if (childrenContainer.innerHTML === '') {
                        if (canExpandMaNX) {
                            childrenContainer.innerHTML = '<div class="p-2 text-center text-[9px] text-gray-400 italic">Đang tải phân bổ...</div>';
                            try {
                                // Hợp nhất phân bổ: Query cho toàn bộ danh sách ID trong đơn hàng (gộp)
                                const { data: distributions } = await sb.from('chi_tiet_vt')
                                    .select('sl, nguoi_nhan, dia_diem, created_at')
                                    .in('id_ct', child.id_cts)
                                    .order('created_at', { ascending: true });
                                
                                if (distributions && distributions.length > 0) {
                                    childrenContainer.innerHTML = distributions.map(d => {
                                        const dt = new Date(d.created_at);
                                        const dateStr = `${dt.getDate().toString().padStart(2,'0')}/${(dt.getMonth()+1).toString().padStart(2,'0')}/${dt.getFullYear()}`;
                                        return `
                                            <div class="flex items-center gap-2 py-1.5 px-3 border-b border-gray-50 last:border-0 hover:bg-white rounded transition-colors group/dist overflow-hidden">
                                                <div class="flex-shrink-0 w-1 h-1 rounded-full bg-indigo-300 group-hover/dist:bg-indigo-500"></div>
                                                <div class="flex-grow overflow-hidden">
                                                    <div class="text-[10px] md:text-xs text-gray-600 whitespace-nowrap">
                                                        <strong class="text-blue-700">${d.sl}</strong> - 
                                                        <span class="font-bold text-gray-800">${d.nguoi_nhan || 'Chưa rõ'}</span> - 
                                                        <span class="italic text-gray-500">${d.dia_diem || 'N/A'}</span> - 
                                                        <span class="text-gray-400 font-medium">${dateStr}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        `;
                                    }).join('');
                                } else {
                                    childrenContainer.innerHTML = '<div class="p-2 text-center text-[9px] text-gray-400 italic">Không có thông tin phân bổ.</div>';
                                }
                            } catch (err) {
                                childrenContainer.innerHTML = '<div class="p-2 text-center text-[9px] text-red-400 italic">Lỗi tải.</div>';
                            }
                        } else {
                            renderTree(childrenContainer, child, level + 1, mode, currentPath, subMode);
                        }
                    }
                } else {
                    expandedHierarchyPaths.delete(currentPath);
                }
            };

            if (isPreviouslyExpanded) {
                if (canExpandMaNX) {
                    setTimeout(() => contentEl.click(), 10);
                } else {
                    renderTree(childrenContainer, child, level + 1, mode, currentPath, subMode);
                }
            }
        }

        container.appendChild(nodeEl);
    });
}

async function openHierarchyVtActionMenu(e, button) {
    if (activeHierarchyPopover && activeHierarchyPopover.sourceButton === button) {
        closeHierarchyPopover();
        return;
    }
    
    closeHierarchyPopover();
    
    const ma_vt = button.dataset.maVt;
    const template = document.getElementById('hierarchy-vt-action-menu-template');
    if (!template) return;

    const popover = template.content.cloneNode(true).querySelector('.action-popover');
    document.body.appendChild(popover);

    const rect = button.getBoundingClientRect();
    const isMobile = window.innerWidth <= 768;
    
    popover.style.position = 'fixed';
    if (isMobile) {
        popover.style.left = '50%';
        popover.style.top = `${rect.bottom + 5}px`;
        popover.style.transform = 'translateX(-50%)';
    } else {
        popover.style.left = `${rect.left - 120}px`;
        popover.style.top = `${rect.bottom + 5}px`;
    }
    popover.style.zIndex = '1000';

    const nEl = popover.querySelector('#h-pop-n');
    const xEl = popover.querySelector('#h-pop-x');
    const tEl = popover.querySelector('#h-pop-t');

    const preset = document.getElementById('tq-hierarchy-time-preset').value;
    const { start, end } = getRangeDates(preset);
    const hState = tongQuanState.hierarchy;

    let nxQuery = sb.from('chi_tiet')
        .select('nhap, xuat')
        .eq('ma_vt', ma_vt)
        .gte('thoi_gian', start)
        .lte('thoi_gian', end);
    
    if (hState.yeu_cau.length > 0) nxQuery = nxQuery.in('yeu_cau', hState.yeu_cau);

    let stockQuery = sb.from('ton_kho_update')
        .select('ton_cuoi')
        .eq('ma_vt', ma_vt);

    const [nxRes, stockRes] = await Promise.all([nxQuery, stockQuery]);
    
    let totalN = 0, totalX = 0;
    (nxRes.data || []).forEach(row => {
        totalN += parseFloat(row.nhap) || 0;
        totalX += parseFloat(row.xuat) || 0;
    });
    
    let totalT = (stockRes.data || []).reduce((sum, row) => sum + (parseFloat(row.ton_cuoi) || 0), 0);

    nEl.textContent = totalN.toLocaleString();
    xEl.textContent = totalX.toLocaleString();
    tEl.textContent = totalT.toLocaleString();

    popover.querySelector('.h-action-stock').onclick = () => {
        const state = viewStates['view-ton-kho'];
        state.searchTerm = '';
        Object.keys(state.filters).forEach(k => state.filters[k] = Array.isArray(state.filters[k]) ? [] : '');
        state.filters.ma_vt = [ma_vt];
        state.stockAvailability = 'all';
        sessionStorage.setItem('tonKhoStockAvailability', 'all');
        showView('view-ton-kho');
        closeHierarchyPopover();
    };

    popover.querySelector('.h-action-card').onclick = () => {
        const state = viewStates['view-chi-tiet'];
        state.searchTerm = '';
        Object.keys(state.filters).forEach(k => state.filters[k] = Array.isArray(state.filters[k]) ? [] : '');
        state.filters.ma_vt = [ma_vt];
        showView('view-chi-tiet');
        closeHierarchyPopover();
    };

    const closeHandler = (event) => {
        if (!popover.contains(event.target) && !button.contains(event.target)) {
            closeHierarchyPopover();
        }
    };
    
    setTimeout(() => document.addEventListener('click', closeHandler), 0);
    activeHierarchyPopover = { element: popover, sourceButton: button };
}

async function openHierarchyNxActionMenu(e, button) {
    if (activeHierarchyPopover && activeHierarchyPopover.sourceButton === button) {
        closeHierarchyPopover();
        return;
    }
    
    closeHierarchyPopover();
    
    const ct_id = button.dataset.ctId; 
    const template = document.getElementById('hierarchy-nx-action-menu-template');
    if (!template) return;

    const popover = template.content.cloneNode(true).querySelector('.action-popover');
    document.body.appendChild(popover);

    const rect = button.getBoundingClientRect();
    const isMobile = window.innerWidth <= 768;
    
    popover.style.position = 'fixed';
    if (isMobile) {
        popover.style.left = '50%';
        popover.style.top = `${rect.bottom + 5}px`;
        popover.style.transform = 'translateX(-50%)';
    } else {
        popover.style.left = `${rect.left - 120}px`;
        popover.style.top = `${rect.bottom + 5}px`;
    }
    popover.style.zIndex = '1000';

    const handleOrderForm = async (mode) => {
        showLoading(true);
        try {
            const { data: ct, error: ctError } = await sb.from('chi_tiet').select('*').eq('id', ct_id).single();
            if (ctError || !ct) throw new Error("Không tìm thấy thông tin dòng chi tiết.");

            const { openDetailVtModal } = await import('./chitiet.js');
            const isReadOnly = mode === 'view';
            await openDetailVtModal(ct, isReadOnly);
        } catch (err) {
            showToast("Lỗi: " + err.message, "error");
        } finally {
            showLoading(false);
            closeHierarchyPopover();
        }
    };

    popover.querySelector('.h-nx-action-view').onclick = () => handleOrderForm('view');
    popover.querySelector('.h-nx-action-edit').onclick = () => handleOrderForm('edit');
    popover.querySelector('.h-nx-action-goto').onclick = () => {
        const ma_nx = button.dataset.maNx;
        const state = viewStates['view-chi-tiet'];
        state.searchTerm = '';
        Object.keys(state.filters).forEach(k => state.filters[k] = Array.isArray(state.filters[k]) ? [] : '');
        state.filters.ma_nx = [ma_nx];
        showView('view-chi-tiet');
        closeHierarchyPopover();
    };

    const closeHandler = (event) => {
        if (!popover.contains(event.target) && !button.contains(event.target)) {
            closeHierarchyPopover();
        }
    };
    
    setTimeout(() => document.addEventListener('click', closeHandler), 0);
    activeHierarchyPopover = { element: popover, sourceButton: button };
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
        urgentExpiryQuery // SỬA LỖI TẠI ĐÂY: urgentExpiryResQuery -> urgentExpiryQuery
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
        return new Date(year, month - 1, day);
    };

    const urgentExpiryItems = (urgentExpiryRes.data || []).filter(item => {
        const expiryDate = parseDate(item.date);
        return expiryDate && expiryDate >= today && expiryDate <= sevenDaysFromNow;
    }).slice(0, 5);

    return { lowStock: lowStockItems, slowMoving: slowMovingItems, urgentExpiry: urgentExpiryItems };
}

function renderAlerts(alerts) {
    const listEl = document.getElementById('tq-alerts-list');
    if (!listEl) return;
    listEl.innerHTML = '';
    let alertCount = 0;

    const createAlertItem = (icon, text, info, action, data) => {
        const li = document.createElement('li');
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
        lowStock: `<div class="flex-shrink-0 w-6 h-6 md:w-8 md:h-8 rounded-full bg-yellow-100 flex items-center justify-center"><svg class="w-4 h-4 md:w-5 md:h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1-1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2a1 1 0 011 1v8a1 1 0 01-1 h-2a1 1 0 01-1-1z"></path></svg></div>`,
        slowMoving: `<div class="flex-shrink-0 w-6 h-6 md:w-8 md:h-8 rounded-full bg-blue-100 flex items-center justify-center"><svg class="w-4 h-4 md:w-5 md:h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div>`,
        urgentExpiry: `<div class="flex-shrink-0 w-6 h-6 md:w-8 md:h-8 rounded-full bg-red-100 flex items-center justify-center"><svg class="w-4 h-4 md:w-5 md:h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg></div>`
    };

    (alerts.lowStock || []).forEach(item => createAlertItem(icons.lowStock, `Hết: <strong>${item.ma_vt}</strong> còn <strong>${item.total_ton_cuoi}</strong>.`, item, 'ton-kho:ma_vt', item.ma_vt));
    (alerts.slowMoving || []).forEach(item => createAlertItem(icons.slowMoving, `Lâu: <strong>${item.ma_vt}</strong> (>60 ngày).`, item, 'ton-kho:ma_vt', item.ma_vt));
    (alerts.urgentExpiry || []).forEach(item => createAlertItem(icons.urgentExpiry, `Date: <strong>${item.lot}</strong> (${item.ma_vt}) - <strong>${item.date}</strong>.`, item, 'ton-kho:lot', item.lot));

    if (alertCount === 0) listEl.innerHTML = '<li class="p-4 text-center text-gray-500">Mọi thứ đều ổn!</li>';
}

function renderActivityChart() {
    const ctxEl = document.getElementById('tq-activity-chart');
    if (!ctxEl) return;
    const ctx = ctxEl.getContext('2d');
    
    const last30Days = {};
    for (let i = 29; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        last30Days[d.toISOString().split('T')[0]] = { nhap: 0, xuat: 0, balance: 0 };
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

    // Tính toán Biến động (Balance) = Nhập - Xuất
    Object.values(last30Days).forEach(d => {
        d.balance = d.nhap - d.xuat;
    });

    if (activityChart) activityChart.destroy();
    activityChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(last30Days).map(k => `${new Date(k).getDate()}/${new Date(k).getMonth() + 1}`),
            datasets: [
                { 
                    label: 'Nhập', 
                    type: 'bar',
                    data: Object.values(last30Days).map(d => d.nhap), 
                    backgroundColor: 'rgba(54, 162, 235, 0.6)',
                    order: 2
                },
                { 
                    label: 'Xuất', 
                    type: 'bar',
                    data: Object.values(last30Days).map(d => d.xuat), 
                    backgroundColor: 'rgba(255, 99, 132, 0.6)',
                    order: 3
                },
                {
                    label: 'Biến động ròng',
                    type: 'line',
                    data: Object.values(last30Days).map(d => d.balance),
                    borderColor: 'rgba(75, 192, 192, 1)',
                    backgroundColor: 'rgba(75, 192, 192, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4,
                    pointRadius: 2,
                    order: 1
                }
            ]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { boxWidth: 12, font: { size: 10 } }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: '#f3f4f6' }
                },
                x: { grid: { display: false } }
            }
        }
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
    const sortedStatuses = activeStatuses.sort((a, b) => (STATUS_CONFIG[a]?.order ?? 999) - (STATUS_CONFIG[b]?.order ?? 999));

    if (inventoryStatusChart) inventoryStatusChart.destroy();
    inventoryStatusChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: sortedStatuses,
            datasets: [{ data: sortedStatuses.map(s => countsMap[s]), backgroundColor: sortedStatuses.map(s => STATUS_CONFIG[s]?.color || '#9ca3af'), borderWidth: 1, hoverOffset: 10 }]
        },
        options: { 
            responsive: true, maintainAspectRatio: false, layout: { padding: isMobile ? 0 : 10 },
            plugins: {
                legend: {
                    position: 'right', align: 'center',
                    labels: {
                        usePointStyle: true, padding: isMobile ? 4 : 12, boxWidth: 8,
                        font: { size: isMobile ? 8 : 14, weight: '700' }, 
                        generateLabels: (chart) => chart.data.labels.map((label, i) => {
                            const isHidden = !chart.getDataVisibility(i); 
                            const value = chart.data.datasets[0].data[i];
                            const percentage = totalCount > 0 ? ((value / totalCount) * 100).toFixed(1) : 0;
                            return { 
                                text: `${label}: ${value.toLocaleString()} (${percentage}%)`, 
                                fillStyle: chart.data.datasets[0].backgroundColor[i], 
                                strokeStyle: chart.data.datasets[0].backgroundColor[i], 
                                lineWidth: 0, 
                                index: i, 
                                hidden: isHidden, 
                                textDecoration: isHidden ? 'line-through' : 'none', 
                                font: { size: isMobile ? 8 : 14, weight: '700' }
                            };
                        })
                    }
                },
                tooltip: { callbacks: { label: (context) => `${context.label}: ${context.raw.toLocaleString()} (${totalCount > 0 ? ((context.raw / totalCount) * 100).toFixed(1) : 0}%)` } }
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
            const allowedCond = allowedNganh.length > 0 ? `phu_trach.eq."${userName}",nganh.in.(${allowedNganh.map(n => `"${n}"`).join(',')})` : `phu_trach.eq."${userName}"`;
            sanPhamCountQuery = sanPhamCountQuery.or(allowedCond);
            tonKhoQuery = tonKhoQuery.or(allowedCond);
            nganhResQuery = nganhResQuery.or(allowedCond);
        }

        const [spRes, tkRes] = await Promise.all([sanPhamCountQuery, tonKhoQuery]);
        const allStockItems = tkRes.data || [];
        
        const statSpEl = document.getElementById('tq-stat-san-pham');
        const subStatSpEl = document.getElementById('tq-sub-stat-san-pham');
        if (statSpEl) statSpEl.textContent = (spRes.count ?? 0).toLocaleString();
        if (subStatSpEl) subStatSpEl.innerHTML = `Khả dụng: ${allStockItems.filter(i => i.ton_cuoi > 0).reduce((s, i) => s + i.ton_cuoi, 0).toLocaleString()}`;

        const urgentItems = allStockItems.filter(i => i.tinh_trang === 'Từ 1-30 ngày' && i.ton_cuoi > 0);
        const statCanDateEl = document.getElementById('tq-stat-can-date');
        const subStatCanDateEl = document.getElementById('tq-sub-stat-can-date');
        if (statCanDateEl) statCanDateEl.textContent = `${new Set(urgentItems.map(i => i.ma_vt)).size} vật tư`;
        if (subStatCanDateEl) subStatCanDateEl.innerHTML = `Số lượng: ${urgentItems.reduce((s, i) => s + i.ton_cuoi, 0).toLocaleString()}`;

        const expiredItems = allStockItems.filter(i => i.tinh_trang === 'Hết hạn sử dụng' && i.ton_cuoi > 0);
        const statHetHanEl = document.getElementById('tq-stat-het-han');
        const subStatHetHanEl = document.getElementById('tq-sub-stat-het-han');
        if (statHetHanEl) statHetHanEl.textContent = `${new Set(expiredItems.map(i => i.ma_vt)).size} vật tư`;
        if (subStatHetHanEl) subStatHetHanEl.innerHTML = `Số lượng: ${expiredItems.reduce((s, i) => s + i.ton_cuoi, 0).toLocaleString()}`;

        const today = new Date();
        const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(today.getDate() - 30);
        let chiTietQuery = sb.from('chi_tiet').select('thoi_gian, nhap, xuat, nganh, phu_trach').gte('thoi_gian', thirtyDaysAgo.toISOString());
        if (isNotAdmin) chiTietQuery = chiTietQuery.or(allowedNganh.length > 0 ? `phu_trach.eq."${userName}",nganh.in.(${allowedNganh.map(n => `"${n}"`).join(',')})` : `phu_trach.eq."${userName}"`);

        const [ctRes, alerts, nganhRes] = await Promise.all([chiTietQuery, fetchAlerts(), nganhResQuery]);
        last30DaysChiTiet = ctRes.data || [];
        allAlertsData = alerts;
        allNganhOptions = [...new Set((nganhRes.data || []).map(i => i.nganh).filter(Boolean))].sort();

        renderActivityChart();
        updateAlertFiltersAndRender();
        renderInventoryStatusChart();
        fetchAndRenderHierarchy();
        updateTQFilterButtonTexts();
    } catch (e) { console.error(e); }
}

export function initTongQuanView() {
    const view = document.getElementById('view-phat-trien');
    if(!view || view.dataset.listenerAttached) return;

    view.addEventListener('click', (e) => {
        const filterBtn = e.target.closest('.filter-btn');
        if (filterBtn) { openTongQuanFilterPopover(filterBtn); return; }

        const timeFilterBtn = e.target.closest('#tq-hierarchy-time-filter-btn');
        if (timeFilterBtn) { openHierarchyTimePresetPopover(timeFilterBtn); return; }

        // Logic sub-mode clicks (All, Export, Shortage)
        const submodeBtn = e.target.closest('.submode-pill');
        if (submodeBtn) {
            const sm = submodeBtn.dataset.submode;
            tongQuanState.hierarchy.subMode = sm;
            
            document.querySelectorAll('.submode-pill').forEach(btn => {
                const isActive = btn.dataset.submode === sm;
                let activeColor = 'bg-blue-600';
                if (sm === 'xuat') activeColor = 'bg-red-600';
                if (sm === 'shortage') activeColor = 'bg-amber-500';

                btn.classList.toggle(activeColor, isActive);
                btn.classList.toggle('text-white', isActive);
                btn.classList.toggle('bg-gray-50', !isActive);
                btn.classList.toggle('text-gray-400', !isActive);
                btn.classList.toggle('shadow-sm', isActive);
                
                // Clear other possible active colors
                if (!isActive) {
                    btn.classList.remove('bg-blue-600', 'bg-red-600', 'bg-amber-500');
                }
            });
            fetchAndRenderHierarchy();
            return;
        }

        const resetAndShow = (viewId, filters) => {
            const state = viewStates[viewId];
            if (state) {
                state.searchTerm = '';
                Object.keys(state.filters).forEach(k => state.filters[k] = Array.isArray(state.filters[k]) ? [] : '');
                Object.assign(state.filters, filters);
                if (viewId === 'view-ton-kho') state.stockAvailability = 'available';
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
            resetAndShow('view-ton-kho', { tinh_trang: ['Từ 1-30 ngày'] });
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

    document.getElementById('tq-hierarchy-refresh-btn').onclick = () => {
        // RESET TOÀN BỘ BỘ LỌC CỦA PHẢ HỆ
        expandedHierarchyPaths.clear();
        tongQuanState.hierarchy.ma_vt = [];
        tongQuanState.hierarchy.yeu_cau = [];
        tongQuanState.hierarchy.subMode = 'all';
        document.getElementById('tq-hierarchy-time-preset').value = 'all';
        document.getElementById('tq-hierarchy-custom-dates').classList.add('hidden');
        
        // Reset submode buttons UI
        document.querySelectorAll('.submode-pill').forEach(btn => {
            const isAll = btn.dataset.submode === 'all';
            btn.classList.toggle('bg-blue-600', isAll);
            btn.classList.toggle('text-white', isAll);
            btn.classList.toggle('bg-gray-50', !isAll);
            btn.classList.toggle('text-gray-400', !isAll);
            btn.classList.toggle('shadow-sm', isAll);
            if (!isAll) btn.classList.remove('bg-red-600', 'bg-amber-500');
        });

        updateTQFilterButtonTexts();
        fetchAndRenderHierarchy();
        showToast("Đã làm mới và xóa toàn bộ bộ lọc phả hệ.", "info");
    };
    
    document.getElementById('tq-hierarchy-date-from').onchange = fetchAndRenderHierarchy;
    document.getElementById('tq-hierarchy-date-to').onchange = fetchAndRenderHierarchy;

    const xuatBtn = document.getElementById('tq-hierarchy-mode-xuat');
    const nhapBtn = document.getElementById('tq-hierarchy-mode-nhap');
    const xuatDot = document.getElementById('tq-hierarchy-mode-xuat-dot');
    const nhapDot = document.getElementById('tq-hierarchy-mode-nhap-dot');

    const setMode = (mode) => {
        tongQuanState.hierarchy.mode = mode;
        const isActiveXuat = mode === 'xuat';
        
        if (xuatBtn) {
            xuatBtn.classList.toggle('bg-white', isActiveXuat);
            xuatBtn.classList.toggle('shadow-sm', isActiveXuat);
            xuatBtn.classList.toggle('text-red-600', isActiveXuat);
            xuatBtn.classList.toggle('text-gray-400', !isActiveXuat);
            if (!isActiveXuat) xuatBtn.classList.remove('text-red-600');
        }
        if (nhapBtn) {
            nhapBtn.classList.toggle('bg-white', !isActiveXuat);
            nhapBtn.classList.toggle('shadow-sm', !isActiveXuat);
            nhapBtn.classList.toggle('text-green-600', !isActiveXuat);
            nhapBtn.classList.toggle('text-gray-400', isActiveXuat);
            if (isActiveXuat) nhapBtn.classList.remove('text-green-600');
        }

        if (xuatDot) {
            xuatDot.classList.toggle('bg-red-500', isActiveXuat);
            xuatDot.classList.toggle('bg-gray-300', !isActiveXuat);
            xuatDot.classList.toggle('border-red-200', isActiveXuat);
            xuatDot.classList.toggle('border-transparent', !isActiveXuat);
        }
        if (nhapDot) {
            nhapDot.classList.toggle('bg-green-500', !isActiveXuat);
            nhapDot.classList.toggle('bg-gray-300', isActiveXuat);
            nhapDot.classList.toggle('border-green-200', !isActiveXuat);
            nhapDot.classList.toggle('border-transparent', isActiveXuat);
        }

        fetchAndRenderHierarchy();
    };
    
    if (xuatBtn) xuatBtn.onclick = () => setMode('xuat');
    if (nhapBtn) nhapBtn.onclick = () => setMode('nhap');
    if (xuatDot) xuatDot.onclick = () => setMode('xuat');
    if (nhapDot) nhapDot.onclick = () => setMode('nhap');

    view.dataset.listenerAttached = 'true';
}
