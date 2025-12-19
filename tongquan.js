import { sb, viewStates, showView, currentUser, cache, showToast } from './app.js';

let activityChart = null;
let inventoryStatusChart = null;
let chartMode = 'quantity'; 
let last30DaysChiTiet = []; 
let allAlertsData = null;
let allNganhOptions = []; 
let activeHierarchyPopover = null;

// Biến lưu trữ các path đang được mở trong phả hệ để giữ trạng thái khi chuyển mode
const expandedHierarchyPaths = new Set();

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
        'tq-hierarchy-yeu-cau-filter-btn': 'Người YC'
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

/**
 * Hàm lấy options phụ thuộc cho bộ lọc Phả hệ
 */
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

    // Áp dụng các bộ lọc KHÁC hiện tại (Trừ chính nó)
    if (filterKey !== 'ma_vt' && hState.ma_vt.length > 0) {
        query = query.in('ma_vt', hState.ma_vt);
    }
    if (filterKey !== 'yeu_cau' && hState.yeu_cau.length > 0) {
        query = query.in('yeu_cau', hState.yeu_cau);
    }

    // Phân quyền
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
        // --- NÂNG CẤP: Lấy options phụ thuộc cho Phả hệ ---
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
            start = new Date(0); // Epoch
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
    
    container.innerHTML = '<div class="text-center py-10"><svg class="animate-spin h-8 w-8 text-blue-500 mx-auto" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><p class="mt-2 text-xs text-gray-500 font-bold uppercase tracking-wider">Đang phân tích phả hệ...</p></div>';

    const preset = document.getElementById('tq-hierarchy-time-preset').value;
    const { start, end } = getRangeDates(preset);
    const hState = tongQuanState.hierarchy;

    try {
        let query = sb.from('chi_tiet_v1')
            .select('bu, franchise, ma_vt, yeu_cau, ma_nx, xuat, nhap, yc_sl')
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

        const { data, error } = await query;
        if (error) throw error;

        if (!data || data.length === 0) {
            container.innerHTML = `<div class="text-center py-10 text-gray-400 italic">Không có dữ liệu trong khoảng thời gian này.</div>`;
            return;
        }

        const tree = buildHierarchy(data, hState.mode);
        container.innerHTML = '';
        renderTree(container, tree, 0, hState.mode, '');

    } catch (err) {
        console.error("Hierarchy fetch error:", err);
        container.innerHTML = `<div class="text-center py-10 text-red-500 font-bold">Lỗi tải: ${err.message}</div>`;
    }
}

function buildHierarchy(data, mode) {
    const root = { total: 0, children: {} };

    data.forEach(row => {
        const bu = row.bu || 'KHÔNG XÁC ĐỊNH';
        const franchise = row.franchise || 'N/A';
        const ma_vt = row.ma_vt;
        const yeu_cau = row.yeu_cau || 'Chưa rõ';
        const ma_nx = row.ma_nx || 'N/A';
        
        const xuatVal = parseFloat(row.xuat) || 0;
        const nhapVal = parseFloat(row.nhap) || 0;
        const ycVal = parseFloat(row.yc_sl) || 0;
        
        const isDO = ma_nx.includes('DO');
        const shortageVal = (mode === 'xuat' && isDO) ? Math.max(0, ycVal - xuatVal) : 0;

        const mainVal = mode === 'xuat' ? xuatVal + shortageVal : nhapVal;
        root.total += mainVal;

        if (!root.children[bu]) root.children[bu] = { total: 0, children: {} };
        root.children[bu].total += mainVal;

        if (!root.children[bu].children[franchise]) root.children[bu].children[franchise] = { total: 0, children: {} };
        root.children[bu].children[franchise].total += mainVal;

        if (!root.children[bu].children[franchise].children[ma_vt]) root.children[bu].children[franchise].children[ma_vt] = { total: 0, children: {} };
        root.children[bu].children[franchise].children[ma_vt].total += mainVal;

        const prodNode = root.children[bu].children[franchise].children[ma_vt];

        if (mode === 'xuat') {
            if (xuatVal > 0) {
                const cat = "Đã xuất";
                if (!prodNode.children[cat]) prodNode.children[cat] = { total: 0, children: {} };
                prodNode.children[cat].total += xuatVal;
                
                if (!prodNode.children[cat].children[yeu_cau]) prodNode.children[cat].children[yeu_cau] = { total: 0, children: {} };
                prodNode.children[cat].children[yeu_cau].total += xuatVal;
                
                if (!prodNode.children[cat].children[yeu_cau].children[ma_nx]) prodNode.children[cat].children[yeu_cau].children[ma_nx] = { total: 0 };
                prodNode.children[cat].children[yeu_cau].children[ma_nx].total += xuatVal;
            }

            if (shortageVal > 0) {
                const cat = "Thiếu hàng";
                if (!prodNode.children[cat]) prodNode.children[cat] = { total: 0, children: {} };
                prodNode.children[cat].total += shortageVal;
                
                if (!prodNode.children[cat].children[yeu_cau]) prodNode.children[cat].children[yeu_cau] = { total: 0, children: {} };
                prodNode.children[cat].children[yeu_cau].total += shortageVal;
                
                if (!prodNode.children[cat].children[yeu_cau].children[ma_nx]) prodNode.children[cat].children[yeu_cau].children[ma_nx] = { total: 0 };
                prodNode.children[cat].children[yeu_cau].children[ma_nx].total += shortageVal;
            }
        } else {
            if (!prodNode.children[yeu_cau]) prodNode.children[yeu_cau] = { total: 0, children: {} };
            prodNode.children[yeu_cau].total += nhapVal;

            if (!prodNode.children[yeu_cau].children[ma_nx]) prodNode.children[yeu_cau].children[ma_nx] = { total: 0 };
            prodNode.children[yeu_cau].children[ma_nx].total += nhapVal;
        }
    });

    return root;
}

function renderTree(container, node, level, mode, parentPath) {
    const sortedKeys = Object.keys(node.children || {}).sort((a, b) => node.children[b].total - node.children[a].total);

    sortedKeys.forEach(key => {
        const child = node.children[key];
        const hasChildren = child.children && Object.keys(child.children).length > 0;
        const currentPath = parentPath ? `${parentPath}|${key}` : key;
        const isPreviouslyExpanded = expandedHierarchyPaths.has(currentPath);

        const nodeEl = document.createElement('div');
        nodeEl.className = 'tree-node';
        if (isPreviouslyExpanded) nodeEl.classList.add('expanded');
        
        const contentEl = document.createElement('div');
        // Nâng cấp: Sử dụng flex-wrap để tránh bị đẩy ra ngoài màn hình trên Mobile
        contentEl.className = `tree-node-content group flex-wrap ${level === 0 ? 'bg-white shadow-sm border border-gray-100 mb-1 py-3' : 'py-1.5'}`;
        
        let labelColor = 'text-gray-700';
        let weightClass = 'font-bold';
        let badgeColor = 'bg-blue-50 text-blue-700 border-blue-100';

        if (level === 0) { labelColor = 'text-blue-900'; weightClass = 'font-black text-xs md:text-sm uppercase'; }
        if (level === 1) { labelColor = 'text-gray-800'; weightClass = 'font-bold text-[11px] md:text-sm'; }
        if (level === 2) { labelColor = 'text-indigo-700'; weightClass = 'font-black text-[11px] md:text-base'; }
        
        if (key === "Thiếu hàng") {
            labelColor = 'text-red-600';
            badgeColor = 'bg-red-50 text-red-700 border-red-100';
        } else if (key === "Đã xuất") {
            labelColor = 'text-green-600';
            badgeColor = 'bg-green-50 text-green-700 border-green-100';
        }

        const isMaVT = level === 2;
        // Kiểm tra xem có phải dòng cuối cùng chứa Mã NX không
        const isMaNX = !hasChildren && (key.includes('IN.') || key.includes('OUT.') || key.includes('RO-') || key.includes('DO-'));

        // Loại bỏ 'truncate' để hiển thị hết nội dung
        contentEl.innerHTML = `
            <div class="flex items-center gap-2 flex-grow min-w-0 overflow-hidden">
                ${hasChildren ? `
                    <svg class="tree-toggle-icon w-3 h-3 md:w-4 md:h-4 text-gray-400 group-hover:text-blue-500" fill="currentColor" viewBox="0 0 20 20"><path d="M10 12a1 1 0 01-.707-.293l-4-4a1 1 0 111.414-1.414L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4A1 1 0 0110 12z"></path></svg>
                ` : `<span class="w-3 md:w-4"></span>`}
                
                <div class="flex-grow flex items-center gap-1.5 overflow-hidden">
                    <span class="${weightClass} ${labelColor} break-words whitespace-normal leading-tight">${key}</span>
                    ${isMaVT ? `
                        <button class="hierarchy-vt-action-btn flex-shrink-0 p-1 text-gray-300 hover:text-indigo-500 rounded opacity-0 group-hover:opacity-100 transition-opacity" data-ma-vt="${key}">
                            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"></path></svg>
                        </button>
                    ` : ''}
                    ${isMaNX ? `
                        <button class="hierarchy-nx-action-btn flex-shrink-0 p-1 text-gray-300 hover:text-green-500 rounded opacity-0 group-hover:opacity-100 transition-opacity" data-ma-nx="${key}">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                        </button>
                    ` : ''}
                </div>
            </div>

            <span class="ml-auto ${badgeColor} px-2 py-0.5 rounded-full text-xs md:text-sm font-black border shadow-sm flex-shrink-0">${child.total.toLocaleString()}</span>
        `;

        nodeEl.appendChild(contentEl);

        // Gắn sự kiện cho các nút hành động
        const vtActionBtn = contentEl.querySelector('.hierarchy-vt-action-btn');
        if (vtActionBtn) {
            vtActionBtn.onclick = (e) => {
                e.stopPropagation();
                openHierarchyVtActionMenu(e, vtActionBtn);
            };
        }

        const nxActionBtn = contentEl.querySelector('.hierarchy-nx-action-btn');
        if (nxActionBtn) {
            nxActionBtn.onclick = (e) => {
                e.stopPropagation();
                const ma_nx = nxActionBtn.dataset.maNx;
                const state = viewStates['view-chi-tiet'];
                state.searchTerm = '';
                Object.keys(state.filters).forEach(k => state.filters[k] = Array.isArray(state.filters[k]) ? [] : '');
                state.filters.ma_nx = [ma_nx];
                showView('view-chi-tiet');
            };
        }

        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'tree-children';
        nodeEl.appendChild(childrenContainer);

        if (hasChildren) {
            contentEl.onclick = (e) => {
                if (e.target.closest('button')) return; // Không đóng/mở node khi bấm nút hành động
                e.stopPropagation();
                const isExpanded = nodeEl.classList.toggle('expanded');
                if (isExpanded) {
                    expandedHierarchyPaths.add(currentPath);
                    if (childrenContainer.innerHTML === '') {
                        renderTree(childrenContainer, child, level + 1, mode, currentPath);
                    }
                } else {
                    expandedHierarchyPaths.delete(currentPath);
                }
            };

            // Nếu node này đã từng được mở, render con của nó luôn
            if (isPreviouslyExpanded) {
                renderTree(childrenContainer, child, level + 1, mode, currentPath);
            }
        }

        container.appendChild(nodeEl);
    });
}

async function openHierarchyVtActionMenu(e, button) {
    // FIX: Toggle menu (ấn lần 2 vào cùng một nút sẽ tắt menu)
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
        // Tối ưu vị trí cho Mobile để không bị khuất
        popover.style.left = '50%';
        popover.style.top = `${rect.bottom + 5}px`;
        popover.style.transform = 'translateX(-50%)';
    } else {
        popover.style.left = `${rect.left - 100}px`;
        popover.style.top = `${rect.bottom + 5}px`;
    }
    popover.style.zIndex = '1000';

    // Lấy thông tin N|X|T
    const nEl = popover.querySelector('#h-pop-n');
    const xEl = popover.querySelector('#h-pop-x');
    const tEl = popover.querySelector('#h-pop-t');

    const preset = document.getElementById('tq-hierarchy-time-preset').value;
    const { start, end } = getRangeDates(preset);
    const hState = tongQuanState.hierarchy;

    let nxQuery = sb.from('chi_tiet_v1')
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
        // Fix logic đóng menu khi click ra ngoài
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
                        usePointStyle: true, padding: isMobile ? 4 : 12, boxWidth: 8, font: { size: isMobile ? 8 : 10, weight: '600' },
                        generateLabels: (chart) => chart.data.labels.map((label, i) => {
                            const value = chart.data.datasets[0].data[i];
                            const percentage = totalCount > 0 ? ((value / totalCount) * 100).toFixed(1) : 0;
                            return { text: `${label}: ${value.toLocaleString()} (${percentage}%)`, fillStyle: chart.data.datasets[0].backgroundColor[i], strokeStyle: chart.data.datasets[0].backgroundColor[i], lineWidth: 0, index: i, font: { size: isMobile ? 8 : 10, weight: '600' } };
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
        if (isNotAdmin) chiTietQuery = chiTietQuery.or(allowedNganh.length > 0 ? `phu_trach.eq."${userName}",nganh.in.(${allowedNganh.map(n => `"${n}"`).join(',')})` : `phu_trach.eq."${userName}"`);

        const [ctRes, alerts, nganhRes] = await Promise.all([chiTietQuery, fetchAlerts(), nganhResQuery]);
        last30DaysChiTiet = ctRes.data || [];
        allAlertsData = alerts;
        allNganhOptions = [...new Set((nganhRes.data || []).map(i => i.nganh).filter(Boolean))].sort();

        renderActivityChart();
        updateAlertFiltersAndRender();
        renderInventoryStatusChart();
        fetchAndRenderHierarchy();
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

    document.getElementById('tq-hierarchy-time-preset').onchange = (e) => {
        document.getElementById('tq-hierarchy-custom-dates').classList.toggle('hidden', e.target.value !== 'custom');
        fetchAndRenderHierarchy();
    };
    document.getElementById('tq-hierarchy-refresh-btn').onclick = fetchAndRenderHierarchy;
    document.getElementById('tq-hierarchy-date-from').onchange = fetchAndRenderHierarchy;
    document.getElementById('tq-hierarchy-date-to').onchange = fetchAndRenderHierarchy;

    const xuatBtn = document.getElementById('tq-hierarchy-mode-xuat');
    const nhapBtn = document.getElementById('tq-hierarchy-mode-nhap');
    const setMode = (mode) => {
        tongQuanState.hierarchy.mode = mode;
        [xuatBtn, nhapBtn].forEach(btn => {
            const isActive = btn.dataset.mode === mode;
            btn.classList.toggle('bg-white', isActive);
            btn.classList.toggle('shadow-sm', isActive);
            btn.classList.toggle('text-blue-600', isActive);
            btn.classList.toggle('text-gray-400', !isActive);
        });
        fetchAndRenderHierarchy();
    };
    xuatBtn.onclick = () => setMode('xuat');
    nhapBtn.onclick = () => setMode('nhap');

    view.dataset.listenerAttached = 'true';
}
