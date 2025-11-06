
import { sb, cache, viewStates, showLoading, showToast, showConfirm, debounce, renderPagination, sanitizeFileName, filterButtonDefaultTexts, currentUser, openAutocomplete } from './app.js';

let selectedDonHangFiles = []; 
let initialExistingFiles = []; 
let currentExistingFiles = []; 
let chiTietItems = []; 
let initialChiTietItems = []; 
let initialDonHangData = {}; 
let chiTietSortable = null; 
let activeLotPopover = null;

function formatDateToDDMMYYYY(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return ''; 
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0'); 
    const year = date.getFullYear();
    
    return `${day}/${month}/${year}`;
}

function parseFileArray(fileData) {
    if (Array.isArray(fileData)) return fileData;
    if (typeof fileData === 'string' && fileData.startsWith('[') && fileData.endsWith(']')) {
        try {
            const parsed = JSON.parse(fileData);
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            console.error("Failed to parse file data string:", fileData, e);
            return [];
        }
    }
    return [];
}

function getTinhTrangClass(tinh_trang) {
    let classes = 'text-[10px] font-semibold px-1 py-0.5 rounded-full ';
    switch (tinh_trang) {
        case 'Hết hạn sử dụng': classes += 'text-red-800 bg-red-100'; break;
        case 'Cận date': classes += 'text-blue-800 bg-blue-100'; break;
        case 'Còn sử dụng': classes += 'text-green-800 bg-green-100'; break;
        case 'Hàng hư': classes += 'text-yellow-800 bg-yellow-100'; break;
        default: classes += 'text-gray-800 bg-gray-100';
    }
    return classes;
}

function closeActiveLotPopover() {
    if (activeLotPopover) {
        activeLotPopover.element.remove();
        document.removeEventListener('click', activeLotPopover.closeHandler);
        activeLotPopover = null;
    }
}


async function openDonHangFilterPopover(button, view) {
    const filterKey = button.dataset.filterKey;
    const state = viewStates[view];

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

    const renderOptions = (options) => {
        const searchTerm = searchInput.value.toLowerCase();
        const filteredOptions = options.filter(option => 
            option && String(option).toLowerCase().includes(searchTerm)
        );
        optionsList.innerHTML = filteredOptions.length > 0 ? filteredOptions.map(option => `
            <label class="flex items-center space-x-2 px-2 py-1 hover:bg-gray-100 rounded">
                <input type="checkbox" value="${option}" class="filter-option-cb" ${state.filters[filterKey]?.includes(String(option)) ? 'checked' : ''}>
                <span class="text-sm">${option}</span>
            </label>
        `).join('') : '<div class="text-center p-4 text-sm text-gray-500">Không có tùy chọn.</div>';
    };

    if (filterKey === 'loai') {
        searchInput.classList.add('hidden');
        renderOptions(['Nhập', 'Xuất']);
    } else if (filterKey === 'trang_thai_xu_ly') {
        searchInput.classList.add('hidden');
        renderOptions(['Đang xử lý', 'Đã xử lý']);
    } else {
        optionsList.innerHTML = '<div class="text-center p-4 text-sm text-gray-500">Đang tải...</div>';
        applyBtn.disabled = true;
        try {
            let query = sb.from('don_hang').select(filterKey);
            
            const otherFilters = { ...state.filters };
            
            if (state.searchTerm) {
                 const st = `%${state.searchTerm}%`;
                 query = query.or(`ma_kho.ilike.${st},ma_nx.ilike.${st},yeu_cau.ilike.${st},nganh.ilike.${st},muc_dich.ilike.${st},ghi_chu.ilike.${st}`);
            }

            if (otherFilters.from_date) query = query.gte('thoi_gian', otherFilters.from_date);
            if (otherFilters.to_date) query = query.lte('thoi_gian', otherFilters.to_date);

            if (filterKey !== 'loai' && otherFilters.loai?.length === 1) {
                const loaiPrefix = otherFilters.loai[0] === 'Nhập' ? 'IN.%' : 'OUT.%';
                query = query.ilike('ma_kho', loaiPrefix);
            }

             if (filterKey !== 'trang_thai_xu_ly' && otherFilters.trang_thai_xu_ly?.length === 1) {
                if (otherFilters.trang_thai_xu_ly[0] === 'Đang xử lý') {
                    query = query.like('ma_nx', '%-');
                } else if (otherFilters.trang_thai_xu_ly[0] === 'Đã xử lý') {
                    query = query.not('ma_nx', 'like', '%-');
                }
            }
            if (filterKey !== 'ma_kho' && otherFilters.ma_kho?.length > 0) query = query.in('ma_kho', otherFilters.ma_kho);
            if (filterKey !== 'ma_nx' && otherFilters.ma_nx?.length > 0) query = query.in('ma_nx', otherFilters.ma_nx);
            if (filterKey !== 'yeu_cau' && otherFilters.yeu_cau?.length > 0) query = query.in('yeu_cau', otherFilters.yeu_cau);
            if (filterKey !== 'nganh' && otherFilters.nganh?.length > 0) query = query.in('nganh', otherFilters.nganh);

            const { data, error } = await query.limit(1000);
            if (error) throw error;
            
            const uniqueOptions = [...new Set(data.map(item => item[filterKey]).filter(Boolean))].sort();
            renderOptions(uniqueOptions);
            searchInput.addEventListener('input', () => renderOptions(uniqueOptions));
            applyBtn.disabled = false;

        } catch (error) {
            console.error("Filter error:", error);
            optionsList.innerHTML = '<div class="text-center p-4 text-sm text-red-500">Lỗi tải dữ liệu.</div>';
            showToast(`Lỗi tải bộ lọc cho: ${filterKey}.`, 'error');
        }
    }
    
    const closePopover = (e) => {
        if (!popover.contains(e.target) && e.target !== button) {
            popover.remove();
            document.removeEventListener('click', closePopover);
        }
    };

    applyBtn.onclick = () => {
        const selectedOptions = Array.from(popover.querySelectorAll('.filter-option-cb:checked')).map(cb => cb.value);
        state.filters[filterKey] = selectedOptions;
        
        const defaultText = filterButtonDefaultTexts[button.id] || button.id;
        button.textContent = selectedOptions.length > 0 ? `${defaultText} (${selectedOptions.length})` : defaultText;
        
        fetchDonHang(1);
        
        popover.remove();
        document.removeEventListener('click', closePopover);
    };

    setTimeout(() => document.addEventListener('click', closePopover), 0);
}

function buildDonHangQuery() {
    const state = viewStates['view-don-hang'];
    let query = sb.from('don_hang').select('*', { count: 'exact' });

    if (state.filters.from_date) query = query.gte('thoi_gian', state.filters.from_date);
    if (state.filters.to_date) query = query.lte('thoi_gian', state.filters.to_date);

    if (state.filters.loai?.length === 1) {
        const loaiPrefix = state.filters.loai[0] === 'Nhập' ? 'IN.%' : 'OUT.%';
        query = query.ilike('ma_kho', loaiPrefix);
    }
    
    const trangThaiFilter = state.filters.trang_thai_xu_ly || [];
    if (trangThaiFilter.length === 1) {
        if (trangThaiFilter[0] === 'Đang xử lý') {
            query = query.like('ma_nx', '%-');
        } else if (trangThaiFilter[0] === 'Đã xử lý') {
            query = query.not('ma_nx', 'like', '%-').not('ma_nx', 'is', null);
        }
    }
    if (state.filters.ma_kho?.length > 0) query = query.in('ma_kho', state.filters.ma_kho);
    if (state.filters.ma_nx?.length > 0) query = query.in('ma_nx', state.filters.ma_nx);
    if (state.filters.yeu_cau?.length > 0) query = query.in('yeu_cau', state.filters.yeu_cau);
    if (state.filters.nganh?.length > 0) query = query.in('nganh', state.filters.nganh);

    if (state.searchTerm) {
        const st = `%${state.searchTerm}%`;
        query = query.or(`ma_kho.ilike.${st},ma_nx.ilike.${st},yeu_cau.ilike.${st},nganh.ilike.${st},muc_dich.ilike.${st},ghi_chu.ilike.${st}`);
    }

    return query;
}

export async function fetchDonHang(page = viewStates['view-don-hang'].currentPage, showLoader = true) {
    if (showLoader) showLoading(true);
    try {
        viewStates['view-don-hang'].currentPage = page;
        const state = viewStates['view-don-hang'];
        state.selected.clear();
        updateDonHangActionButtonsState();
        updateDonHangSelectionInfo(); 

        const { itemsPerPage } = state;
        const from = (page - 1) * itemsPerPage;
        const to = from + itemsPerPage - 1;

        const queryBuilder = buildDonHangQuery();
        if (!queryBuilder || typeof queryBuilder.order !== 'function') {
             console.error('Lỗi truy vấn đơn hàng. Đối tượng trả về không hợp lệ.', queryBuilder);
             showToast('Lỗi nghiêm trọng khi tạo truy vấn đơn hàng.', 'error');
             throw new Error('Invalid query builder');
        }
        
        const { data, error, count } = await queryBuilder.order('thoi_gian', { ascending: false }).range(from, to);
        
        if (error) {
            console.error(error);
            showToast("Lỗi khi tải dữ liệu đơn hàng.", 'error');
        } else {
            state.totalFilteredCount = count; 
            cache.donHangList = data;
            
            renderDonHangTable(data);
            renderPagination('don-hang', count, from, to);
            updateDonHangSelectionInfo(); 
        }
    } catch(err) {
        console.error("Fetch Don Hang failed:", err);
    } finally {
        if (showLoader) showLoading(false);
    }
}

function renderDonHangTable(data) {
    const tableBody = document.getElementById('don-hang-table-body');
    if (!tableBody) return;

    if (data && data.length > 0) {
        tableBody.innerHTML = data.map(dh => {
            const isSelected = viewStates['view-don-hang'].selected.has(dh.ma_kho);
            const thoi_gian = formatDateToDDMMYYYY(dh.thoi_gian);
            const filesAsArray = parseFileArray(dh.file);
            const fileCount = filesAsArray.length;

            const fileIcon = fileCount > 0 ? 
                `<div class="relative cursor-pointer w-6 h-6 mx-auto">
                    <svg class="w-6 h-6 text-yellow-500" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"></path></svg>
                    <span class="absolute -top-1 -right-2 bg-red-600 text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">${fileCount}</span>
                 </div>` : '';
            
            let maKhoIcon = '';
            if (dh.ma_kho.includes('OUT')) {
                maKhoIcon = `<svg class="w-4 h-4 inline-block ml-1 text-red-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18"></path></svg>`;
            } else if (dh.ma_kho.includes('IN')) {
                maKhoIcon = `<svg class="w-4 h-4 inline-block ml-1 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path></svg>`;
            }
            const maKhoHtml = `<div class="flex items-center justify-center">
                <span class="text-blue-600 hover:underline">${dh.ma_kho}</span>
                ${maKhoIcon}
            </div>`;

            let maNxClass = '';
            if (dh.ma_nx) {
                if (dh.ma_nx.endsWith('-')) {
                    maNxClass = 'text-yellow-600 font-semibold';
                } else {
                    maNxClass = 'text-green-600 font-semibold';
                }
            }
            
            return `
                <tr data-id="${dh.ma_kho}" class="hover:bg-gray-50 ${isSelected ? 'bg-blue-100' : ''}">
                    <td class="px-1 py-2 border border-gray-300 text-center"><input type="checkbox" class="don-hang-select-row" data-id="${dh.ma_kho}" ${isSelected ? 'checked' : ''}></td>
                    <td class="px-1 py-2 text-sm font-medium border border-gray-300 text-center cursor-pointer ma-kho-cell">${maKhoHtml}</td>
                    <td class="px-1 py-2 text-sm text-gray-600 border border-gray-300 text-center">${thoi_gian}</td>
                    <td class="px-1 py-2 text-sm border border-gray-300 text-center ${maNxClass}">${dh.ma_nx || ''}</td>
                    <td class="px-1 py-2 text-sm text-gray-600 border border-gray-300 text-center">${dh.yeu_cau || ''}</td>
                    <td class="px-1 py-2 text-sm text-gray-600 border border-gray-300 text-center">${dh.nganh || ''}</td>
                    <td class="px-1 py-2 text-sm text-gray-600 break-words border border-gray-300 text-left">${dh.muc_dich || ''}</td>
                    <td class="px-1 py-2 text-sm text-gray-600 break-words border border-gray-300 text-left">${dh.ghi_chu || ''}</td>
                    <td class="px-1 py-2 border border-gray-300 text-center file-cell">${fileIcon}</td>
                </tr>
            `;
        }).join('');
    } else {
        tableBody.innerHTML = '<tr><td colspan="9" class="text-center py-4">Không có dữ liệu</td></tr>';
    }
}

function updateChiTietSummary() {
    const summaryEl = document.getElementById('don-hang-chi-tiet-summary');
    if (!summaryEl) return;

    const loaiDon = document.getElementById('don-hang-modal-loai-don').value;
    if (!loaiDon) {
        summaryEl.innerHTML = '';
        return;
    }

    const totalYCSL = chiTietItems.reduce((sum, item) => sum + (parseFloat(item.yc_sl) || 0), 0);
    const totalSL = chiTietItems.reduce((sum, item) => sum + (parseFloat(item.sl) || 0), 0);

    const label = loaiDon === 'Nhap' ? 'Thực Nhập' : 'Thực Xuất';

    summaryEl.innerHTML = `
        <span class="font-bold">Tổng cộng</span> ${label} / YCSL: 
        <span class="font-bold text-blue-600">${totalSL.toLocaleString()}</span> / 
        <span class="font-bold text-gray-800">${totalYCSL.toLocaleString()}</span>
    `;
}

async function fetchChiTietDonHang(ma_kho_don_hang) {
    showLoading(true);
    const { data, error } = await sb.from('chi_tiet').select('*').eq('ma_kho', ma_kho_don_hang);
    showLoading(false);
    if (error) {
        showToast("Lỗi khi tải chi tiết đơn hàng.", "error");
        return [];
    }
    return data || [];
}

function renderChiTietTable() {
    const tbody = document.getElementById('don-hang-chi-tiet-body');
    const loaiDon = document.getElementById('don-hang-modal-loai-don').value;
    const isViewMode = document.getElementById('save-don-hang-btn').classList.contains('hidden');
    
    tbody.innerHTML = chiTietItems.filter(Boolean).map((item, index) => {
        const tonKhoInfo = item.tonKhoData ? `Tồn: <span class="font-bold text-blue-600">${item.tonKhoData.ton_cuoi}</span>` : 'Tồn: ?';
        const slValue = isNaN(parseFloat(item.sl)) ? 0 : parseFloat(item.sl);
        const tonKhoValue = item.tonKhoData?.ton_cuoi || 0;
        const trayInfo = item.tonKhoData ? `Tray: <span class="font-bold text-indigo-600">${item.tonKhoData.tray || '?'}</span>` : '';

        let projectedStock;
        let projectedStockText;
        if (loaiDon === 'Nhap') {
            projectedStock = tonKhoValue + slValue;
            projectedStockText = `Sau Nhập: <span class="font-bold text-green-600">${projectedStock}</span>`;
        } else {
            projectedStock = tonKhoValue - slValue;
            projectedStockText = `Sau Xuất: <span class="font-bold text-red-600">${projectedStock}</span>`;
        }


        const barcodeColorClass = item.ma_vach_valid === true ? 'text-green-600' : 'text-red-600';
        const generatedBarcode = item.ma_vach;

        return `
            <tr data-id="${item.id}" class="chi-tiet-row group">
                <td class="p-1 border text-center align-top ${isViewMode ? '' : 'drag-handle cursor-move'}">${index + 1}</td>
                <td class="p-1 border align-top relative">
                    <input type="text" value="${item.ma_vt || ''}" class="w-full p-1 border rounded chi-tiet-input" data-field="ma_vt" autocomplete="off" ${isViewMode ? 'disabled' : ''}>
                </td>
                <td class="p-1 border align-top break-words">${item.ten_vt || ''}</td>
                <td class="p-1 border align-top">
                    <div class="relative">
                        <input type="text" value="${item.lot || ''}" class="w-full p-1 border rounded chi-tiet-lot-input" readonly placeholder="Chọn LOT..." ${isViewMode ? 'disabled' : ''}>
                        <div class="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                            <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                        </div>
                    </div>
                </td>
                <td class="p-1 border align-top text-center">${item.date || ''}</td>
                <td class="p-1 border align-top">
                    <input type="number" value="${item.yc_sl || ''}" min="1" class="w-full p-1 border rounded chi-tiet-input" data-field="yc_sl" ${isViewMode ? 'disabled' : ''}>
                </td>
                <td class="p-1 border align-top">
                    <input type="number" value="${(item.sl === null || item.sl === undefined) ? '' : item.sl}" min="0" class="w-full p-1 border rounded chi-tiet-input" data-field="sl" ${isViewMode ? 'disabled' : ''}>
                </td>
                <td class="p-1 border align-top">
                    <select class="w-full p-1 border rounded chi-tiet-input" data-field="loai" ${isViewMode ? 'disabled' : ''}>
                        <option value="" disabled ${!item.loai ? 'selected' : ''}>-- Chọn --</option>
                        <option value="Tiêu Hao" ${item.loai === 'Tiêu Hao' ? 'selected' : ''}>Tiêu Hao</option>
                        <option value="Trưng Bày" ${item.loai === 'Trưng Bày' ? 'selected' : ''}>Trưng Bày</option>
                    </select>
                </td>
                <td class="p-1 border align-top text-center font-mono ${barcodeColorClass}">${generatedBarcode || ''}</td>
                <td class="p-1 border text-center align-top">
                    ${!isViewMode ? `<button type="button" class="text-red-500 hover:text-red-700 chi-tiet-delete-btn text-xl font-bold">&times;</button>` : ''}
                </td>
            </tr>
            <tr data-info-id="${item.id}" class="bg-blue-50">
                 <td colspan="10" class="px-2 py-1.5 text-xs text-gray-800 border border-t-0 border-blue-200">
                    <div class="flex justify-between items-center">
                        <div>
                            <span class="font-semibold">${tonKhoInfo}</span> | <span class="font-semibold">${projectedStockText}</span>
                        </div>
                        <div>
                            <span class="font-semibold">${trayInfo}</span>
                        </div>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    updateChiTietSummary();
}

function openLotSelectorPopover(inputElement, item) {
    closeActiveLotPopover();
    const activeAutocompletePopover = 'dummy-value-to-prevent-double-open'; 

    const popoverTemplate = document.getElementById('autocomplete-popover-template');
    if (!popoverTemplate) return;

    const popoverContent = popoverTemplate.content.cloneNode(true);
    const popover = popoverContent.querySelector('div');
    popover.id = 'lot-selector-popover';
    popover.style.width = `350px`;

    const rect = inputElement.getBoundingClientRect();
    popover.style.left = `${rect.left}px`;
    popover.style.top = `${rect.bottom + window.scrollY}px`;
    document.body.appendChild(popover);

    const optionsList = popover.querySelector('.autocomplete-options-list');
    if (item.lotOptions && item.lotOptions.length > 0) {
        optionsList.innerHTML = item.lotOptions.map(opt => {
            const tonKhoClass = opt.ton_cuoi > 0 ? 'text-green-600' : 'text-red-600';
            const tinhTrangClass = getTinhTrangClass(opt.tinh_trang);
            return `
                <div class="px-3 py-2 cursor-pointer hover:bg-gray-100 lot-option" data-ma-vach="${opt.ma_vach}">
                    <div class="flex justify-between items-center text-sm font-medium gap-2">
                        <span class="flex-1 text-left">LOT: ${opt.lot || 'Chưa có LOT'}</span>
                        <div class="flex-1 flex justify-center items-center gap-2">
                            <span class="text-green-600 font-semibold">N:${opt.nhap || 0}</span>
                            <span class="text-red-600 font-semibold">X:${opt.xuat || 0}</span>
                        </div>
                        <span class="flex-1 text-right ${tonKhoClass} font-bold">Tồn:${opt.ton_cuoi}</span>
                    </div>
                    <div class="flex justify-between items-center text-xs text-gray-500 mt-1">
                        <span>${opt.date || 'No Date'}</span>
                        <span class="${tinhTrangClass}">${opt.tinh_trang || 'N/A'}</span>
                        <span>Tray: ${opt.tray || '?'}</span>
                    </div>
                </div>
            `;
        }).join('');
    } else {
        optionsList.innerHTML = '<div class="p-3 text-sm text-gray-500">Không có LOT nào cho Mã VT này.</div>';
    }

    const onSelect = (selectedMaVach) => {
        const selectedOptionData = item.lotOptions.find(opt => opt.ma_vach === selectedMaVach);
        if (selectedOptionData) {
            item.ma_vach = selectedOptionData.ma_vach;
            item.date = selectedOptionData.date;
            item.lot = selectedOptionData.lot;
            item.tonKhoData = selectedOptionData;
            item.ten_vt = selectedOptionData.ten_vt;
            item.nganh = selectedOptionData.nganh;
            item.phu_trach = selectedOptionData.phu_trach;
            item.ma_vach_valid = true;
        }
        closeActiveLotPopover();
        renderChiTietTable();
    };

    optionsList.addEventListener('mousedown', (e) => {
        const optionEl = e.target.closest('.lot-option');
        if (optionEl) {
            e.preventDefault();
            onSelect(optionEl.dataset.maVach);
        }
    });

    const closeHandler = (e) => {
        if (!inputElement.contains(e.target) && !popover.contains(e.target)) {
            closeActiveLotPopover();
        }
    };
    
    setTimeout(() => document.addEventListener('click', closeHandler), 0);
    
    activeLotPopover = { element: popover, closeHandler: closeHandler };
}

function updateDonHangSelectionInfo() {
    const selectionInfoEl = document.getElementById('don-hang-selection-info');
    if (!selectionInfoEl) return;
    const state = viewStates['view-don-hang'];
    const selectedCount = state.selected.size;
    const totalCount = state.totalFilteredCount;
    selectionInfoEl.textContent = `${selectedCount} / ${totalCount} hàng được chọn`;
}

function updateDonHangActionButtonsState() {
    const selectedCount = viewStates['view-don-hang'].selected.size;
    const editBtn = document.getElementById('don-hang-btn-edit');
    const deleteBtn = document.getElementById('don-hang-btn-delete');
    const printBtn = document.getElementById('don-hang-btn-print');
    
    if (editBtn) editBtn.disabled = selectedCount !== 1;
    if (deleteBtn) deleteBtn.disabled = selectedCount === 0;

    if (printBtn) {
        if (selectedCount !== 1) {
            printBtn.disabled = true;
        } else {
            if (currentUser.phan_quyen === 'View') {
                const selectedId = [...viewStates['view-don-hang'].selected][0];
                const selectedOrder = cache.donHangList.find(dh => dh.ma_kho === selectedId);
                printBtn.disabled = !selectedOrder || selectedOrder.yeu_cau !== currentUser.ho_ten;
            } else {
                printBtn.disabled = false; 
            }
        }
    }
}


function generateMaKho(loai) {
    const prefix = loai === 'Nhap' ? 'IN' : 'OUT';
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    return `${prefix}.JNJ.${randomNum}`;
}

function generateMaNx(loai, nganh) {
    const prefix = loai === 'Nhap' ? 'RO' : 'DO';
    const year = new Date().getFullYear();
    const nganhPart = nganh ? `${nganh}-` : '';
    return `${prefix}-${year}-${nganhPart}`;
}

function updateGeneratedCodes() {
    const loai = document.getElementById('don-hang-modal-loai-don').value;
    const nganh = document.getElementById('don-hang-modal-nganh').value;
    
    if (!document.getElementById('don-hang-edit-mode-ma-kho').value) {
        document.getElementById('don-hang-modal-ma-kho').value = generateMaKho(loai);
    }
    document.getElementById('don-hang-modal-ma-nx').value = generateMaNx(loai, nganh);
}

function renderFileList() {
    const fileListContainer = document.getElementById('don-hang-file-list');
    const isViewMode = document.getElementById('save-don-hang-btn').classList.contains('hidden');

    fileListContainer.innerHTML = '';
    
    currentExistingFiles.forEach(url => {
        const fileName = decodeURIComponent(url.split('/').pop().split('?')[0].split('-').slice(1).join('-'));
        fileListContainer.innerHTML += `
            <div class="flex items-center justify-between bg-gray-100 p-2 rounded-md text-sm">
                <a href="${url}" target="_blank" class="truncate hover:underline text-blue-600">${fileName}</a>
                ${isViewMode ? '' : `<button type="button" data-url="${url}" class="remove-file-btn text-red-500 hover:text-red-700 font-bold text-lg px-2">&times;</button>`}
            </div>
        `;
    });

    selectedDonHangFiles.forEach((file, index) => {
        fileListContainer.innerHTML += `
             <div class="flex items-center justify-between bg-blue-50 p-2 rounded-md text-sm">
                <span class="truncate">${file.name}</span>
                ${isViewMode ? '' : `<button type="button" data-index="${index}" class="remove-file-btn text-red-500 hover:text-red-700 font-bold text-lg px-2">&times;</button>`}
            </div>
        `;
    });
}

function handleFileSelection(files) {
    if (!files || files.length === 0) return;
    selectedDonHangFiles.push(...Array.from(files));
    renderFileList();
}

export async function openDonHangModal(dh = null, mode = 'add') {
    const modal = document.getElementById('don-hang-modal');
    const form = document.getElementById('don-hang-form');
    form.reset();
    selectedDonHangFiles = [];
    initialExistingFiles = [];
    currentExistingFiles = [];
    chiTietItems = [];
    initialChiTietItems = [];
    initialDonHangData = {};

    const isViewMode = mode === 'view';
    const isEditOrAdd = !isViewMode;
    
    form.querySelectorAll('input, select, textarea').forEach(el => el.disabled = isViewMode);
    document.getElementById('don-hang-file-drop-area').style.display = isViewMode ? 'none' : 'flex';
    document.getElementById('don-hang-them-vat-tu-btn').classList.toggle('hidden', !isEditOrAdd || !(currentUser.phan_quyen === 'Admin' || currentUser.phan_quyen === 'User'));

    document.getElementById('save-don-hang-btn').classList.toggle('hidden', isViewMode);
    document.getElementById('cancel-don-hang-btn').classList.toggle('hidden', isViewMode);
    document.getElementById('close-don-hang-view-btn').classList.toggle('hidden', !isViewMode);

    const { data: nganhData, error } = await sb.from('ton_kho').select('nganh');
    if(!error && nganhData){
         const uniqueNganh = [...new Set(nganhData.map(item => item.nganh).filter(Boolean))];
         document.getElementById('nganh-list').innerHTML = uniqueNganh.map(nganh => `<option value="${nganh}"></option>`).join('');
    }
    
    if (mode === 'add') {
        document.getElementById('don-hang-modal-title').textContent = 'Thêm Đơn Hàng Mới';
        document.getElementById('don-hang-edit-mode-ma-kho').value = '';
        const today = new Date();
        document.getElementById('don-hang-modal-thoi-gian').valueAsDate = today;
        document.getElementById('don-hang-modal-loai-don').value = ''; 
        updateGeneratedCodes();
        
        initialDonHangData = {
            thoi_gian: today.toISOString().split('T')[0],
            loai_don: document.getElementById('don-hang-modal-loai-don').value,
            yeu_cau: document.getElementById('don-hang-modal-yeu-cau').value,
            nganh: document.getElementById('don-hang-modal-nganh').value,
            ma_nx: document.getElementById('don-hang-modal-ma-nx').value,
            muc_dich: document.getElementById('don-hang-modal-muc-dich').value,
            ghi_chu: document.getElementById('don-hang-modal-ghi-chu').value,
        };
        initialChiTietItems = [];

    } else {
        document.getElementById('don-hang-modal-title').textContent = isViewMode ? 'Xem Chi Tiết Đơn Hàng' : 'Sửa Đơn Hàng';
        document.getElementById('don-hang-edit-mode-ma-kho').value = dh.ma_kho;
        
        Object.keys(dh).forEach(key => {
            const input = document.getElementById(`don-hang-modal-${key.replace(/_/g, '-')}`);
            if (input) {
                if (key === 'thoi_gian' && dh[key]) {
                    input.value = new Date(dh[key]).toISOString().split('T')[0];
                } else if (key !== 'file') {
                    input.value = dh[key] || '';
                }
            }
        });
        document.getElementById('don-hang-modal-loai-don').value = dh.ma_kho.startsWith('IN') ? 'Nhap' : 'Xuat';
        
        initialDonHangData = {
            thoi_gian: dh.thoi_gian ? new Date(dh.thoi_gian).toISOString().split('T')[0] : '',
            loai_don: dh.ma_kho.startsWith('IN') ? 'Nhap' : 'Xuat',
            yeu_cau: dh.yeu_cau || '',
            nganh: dh.nganh || '',
            ma_nx: dh.ma_nx || '',
            muc_dich: dh.muc_dich || '',
            ghi_chu: dh.ghi_chu || ''
        };
        
        const filesFromDB = parseFileArray(dh.file);
        initialExistingFiles = [...filesFromDB];
        currentExistingFiles = [...filesFromDB];

        const fetchedChiTiet = await fetchChiTietDonHang(dh.ma_kho);
        const loaiDon = dh.ma_kho.startsWith('IN') ? 'Nhap' : 'Xuat';

        const originalQuantities = new Map(
            fetchedChiTiet.map(item => [item.ma_vach, item.nhap || item.xuat])
        );
        
        const chiTietPromises = fetchedChiTiet.map(async (item) => {
            let lotOptions = [];
            let tonKhoData = null;
            if (item.ma_vt) {
                const { data: lotData } = await sb.from('ton_kho_update')
                    .select('ma_vach, lot, date, ten_vt, tinh_trang, ton_cuoi, nganh, phu_trach, tray, nhap, xuat')
                    .eq('ma_vt', item.ma_vt);

                if (lotData) {
                    const adjustedLotData = lotData.map(lot => {
                        const originalQty = originalQuantities.get(lot.ma_vach);
                        if (originalQty && loaiDon === 'Xuat') { 
                            return { ...lot, ton_cuoi: lot.ton_cuoi + originalQty };
                        }
                        return lot;
                    });
                    
                    lotOptions = adjustedLotData;
                    tonKhoData = adjustedLotData.find(opt => opt.ma_vach === item.ma_vach);
                }
            }
            return { 
                ...item, 
                sl: item.nhap || item.xuat,
                ma_vach_valid: true,
                lotOptions: lotOptions,
                tonKhoData: tonKhoData,
            };
        });
        
        chiTietItems = await Promise.all(chiTietPromises);
        initialChiTietItems = JSON.parse(JSON.stringify(chiTietItems));
    }

    renderFileList();
    renderChiTietTable();
    modal.classList.remove('hidden');
    document.addEventListener('keydown', handleDonHangModalEsc, { capture: true });
}

async function syncChiTietDonHang(ma_kho_don_hang, donHangInfo) {
    const itemsToAdd = [];
    const itemsToUpdate = [];
    
    for (const item of chiTietItems) {
        if (!item) continue;
        if (!item.nganh && item.tonKhoData) item.nganh = item.tonKhoData.nganh;
        if (!item.phu_trach && item.tonKhoData) item.phu_trach = item.tonKhoData.phu_trach;
    }

    chiTietItems.forEach(item => {
        if (!item) return;
        const baseData = {
            id: item.id.toString().startsWith('new-') ? crypto.randomUUID() : item.id, 
            ma_kho: ma_kho_don_hang,
            thoi_gian: donHangInfo.thoi_gian,
            ma_nx: donHangInfo.ma_nx,
            ma_vt: item.ma_vt,
            ma_vach: item.ma_vach,
            ten_vt: item.ten_vt,
            lot: item.lot,
            date: item.date,
            yc_sl: item.yc_sl,
            nhap: donHangInfo.loai_don === 'Nhap' ? item.sl : 0,
            xuat: donHangInfo.loai_don === 'Xuat' ? item.sl : 0,
            loai: item.loai,
            yeu_cau: donHangInfo.yeu_cau,
            muc_dich: donHangInfo.muc_dich,
            nganh: item.nganh, 
            phu_trach: item.phu_trach,
        };
        if (item.id.toString().startsWith('new-')) {
            itemsToAdd.push(baseData);
        } else {
            itemsToUpdate.push(baseData);
        }
    });

    const initialIds = new Set(initialChiTietItems.map(item => item.id));
    const currentIds = new Set(chiTietItems.map(item => item.id).filter(id => !id.toString().startsWith('new-')));
    const idsToDelete = [...initialIds].filter(id => !currentIds.has(id));

    const promises = [];
    if (idsToDelete.length > 0) {
        promises.push(sb.from('chi_tiet').delete().in('id', idsToDelete));
    }
    if (itemsToUpdate.length > 0) {
        promises.push(sb.from('chi_tiet').upsert(itemsToUpdate));
    }
    if (itemsToAdd.length > 0) {
        promises.push(sb.from('chi_tiet').insert(itemsToAdd));
    }

    const results = await Promise.all(promises);
    for (const result of results) {
        if (result.error) throw result.error;
    }
}

async function handleSaveDonHang(e) {
    e.preventDefault();
    const ma_kho_orig = document.getElementById('don-hang-edit-mode-ma-kho').value;
    const isEdit = !!ma_kho_orig;

    const donHangData = {
        ma_kho: document.getElementById('don-hang-modal-ma-kho').value.trim(),
        thoi_gian: document.getElementById('don-hang-modal-thoi-gian').value,
        ma_nx: document.getElementById('don-hang-modal-ma-nx').value.trim(),
        yeu_cau: document.getElementById('don-hang-modal-yeu-cau').value.trim(),
        nganh: document.getElementById('don-hang-modal-nganh').value.trim(),
        muc_dich: document.getElementById('don-hang-modal-muc-dich').value.trim(),
        ghi_chu: document.getElementById('don-hang-modal-ghi-chu').value.trim(),
    };
    const loai_don = document.getElementById('don-hang-modal-loai-don').value;
    
    if (!loai_don) {
        showToast('Vui lòng chọn Loại Đơn.', 'error');
        return;
    }
    const requiredFields = { thoi_gian: "Thời Gian", yeu_cau: "Yêu Cầu", nganh: "Ngành", ma_nx: "Mã NX", muc_dich: "Mục Đích" };
    for (const [field, name] of Object.entries(requiredFields)) {
        if (!donHangData[field]) {
            showToast(`Trường "${name}" là bắt buộc.`, 'error');
            return;
        }
    }
    
    const validChiTietItems = chiTietItems.filter(Boolean);
    if (validChiTietItems.length === 0) {
        showToast('Phải có ít nhất một vật tư trong đơn hàng.', 'error');
        return;
    }

    for (const [index, item] of validChiTietItems.entries()) {
        if (!item.ma_vt || !item.yc_sl || (item.sl === null || item.sl === undefined) || !item.loai) {
            showToast(`Vui lòng điền đầy đủ các trường bắt buộc (*) cho vật tư ở dòng ${index + 1}.`, 'error');
            return;
        }
        
        if (loai_don === 'Xuat') {
            if (!item.tonKhoData) {
                showToast(`Không tìm thấy thông tin tồn kho cho vật tư "${item.ma_vt}" ở dòng ${index + 1}.`, 'error');
                return;
            }
            const tonKhoValue = item.tonKhoData.ton_cuoi || 0;
            const slValue = parseFloat(item.sl) || 0;
            if (tonKhoValue - slValue < 0) {
                showToast(`Tồn kho không đủ cho vật tư "${item.ma_vt}" ở dòng ${index + 1}.`, 'error');
                return;
            }
        }
    }
    
    showLoading(true);
    try {
        const filesToRemove = initialExistingFiles.filter(url => !currentExistingFiles.includes(url));
        if (filesToRemove.length > 0) {
            const filePathsToRemove = filesToRemove.map(url => {
                try {
                    const path = new URL(url).pathname.split('/file_don_hang/')[1];
                    return path ? decodeURIComponent(path) : null;
                } catch (e) {
                    console.error("Invalid URL for file deletion:", url, e); return null;
                }
            }).filter(Boolean);
            if(filePathsToRemove.length > 0) await sb.storage.from('file_don_hang').remove(filePathsToRemove);
        }

        let uploadedFileUrls = [];
        if (selectedDonHangFiles.length > 0) {
            const uploadPromises = selectedDonHangFiles.map(file => {
                const safeFileName = sanitizeFileName(file.name);
                const filePath = `${donHangData.ma_kho}/${Date.now()}-${safeFileName}`;
                return sb.storage.from('file_don_hang').upload(filePath, file);
            });
            const uploadResults = await Promise.all(uploadPromises);
            for (const result of uploadResults) {
                if (result.error) throw new Error(`Lỗi tải file: ${result.error.message}`);
                const { data: urlData } = sb.storage.from('file_don_hang').getPublicUrl(result.data.path);
                uploadedFileUrls.push(urlData.publicUrl);
            }
        }
        donHangData.file = [...currentExistingFiles, ...uploadedFileUrls];

        const { error: donHangError } = isEdit
            ? await sb.from('don_hang').update(donHangData).eq('ma_kho', ma_kho_orig)
            : await sb.from('don_hang').insert(donHangData);
        if (donHangError) throw donHangError;

        await syncChiTietDonHang(donHangData.ma_kho, { ...donHangData, loai_don });

        showToast('Lưu đơn hàng thành công!', 'success');
        forceCloseDonHangModal();
        const pageToFetch = isEdit ? viewStates['view-don-hang'].currentPage : 1;
        fetchDonHang(pageToFetch, false);
    } catch (error) {
        if (error.code === '23505') showToast(`Mã kho "${donHangData.ma_kho}" đã tồn tại.`, 'error');
        else showToast(`Lỗi: ${error.message}`, 'error');
        console.error("Save error:", error);
    } finally {
        showLoading(false);
    }
}

async function handleDeleteMultipleDonHang() {
    const selectedIds = [...viewStates['view-don-hang'].selected];
    if (selectedIds.length === 0) return;
    
    const confirmed = await showConfirm(`Bạn có chắc muốn xóa ${selectedIds.length} đơn hàng? Thao tác này sẽ xóa vĩnh viễn cả chi tiết và file đính kèm.`);
    if (!confirmed) return;

    showLoading(true);
    try {
        await sb.from('chi_tiet').delete().in('ma_kho', selectedIds);
        for (const ma_kho of selectedIds) {
             const { data: list, error } = await sb.storage.from('file_don_hang').list(ma_kho);
             if (list && list.length > 0) {
                const filesToRemove = list.map(x => `${ma_kho}/${x.name}`);
                await sb.storage.from('file_don_hang').remove(filesToRemove);
             }
        }
        const { error: deleteError } = await sb.from('don_hang').delete().in('ma_kho', selectedIds);
        if (deleteError) throw deleteError;

        showToast(`Đã xóa ${selectedIds.length} đơn hàng.`, 'success');
        fetchDonHang(1, false);
    } catch (error) {
        showToast(`Lỗi khi xóa: ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
}

async function updateItemFromMaVt(item, ma_vt) {
    if (!item || !ma_vt) return item;

    item.ma_vt = ma_vt;
    item.lot = null;
    item.date = null;
    item.ma_vach = null;
    item.tonKhoData = null;
    item.lotOptions = [];
    item.ma_vach_valid = false;
    item.ten_vt = 'Đang tải...';

    const { data: lotData, error: lotError } = await sb.from('ton_kho_update')
        .select('ma_vach, lot, date, ten_vt, tinh_trang, ton_cuoi, nganh, phu_trach, tray, nhap, xuat')
        .eq('ma_vt', ma_vt);

    if (lotError) {
        showToast(`Lỗi khi tải LOT cho ${ma_vt}.`, 'error');
        item.ten_vt = 'Lỗi tải dữ liệu';
    } else if (lotData && lotData.length > 0) {
        item.lotOptions = lotData;
        item.ten_vt = lotData[0]?.ten_vt || '';
    } else {
        const { data: sanPham } = await sb.from('san_pham').select('ten_vt').eq('ma_vt', ma_vt).single();
        item.ten_vt = sanPham?.ten_vt || 'Không rõ';
        showToast(`Không có tồn kho cho Mã VT: ${ma_vt}`, 'info');
    }
    return item;
}

async function handleMaVtAutocomplete(input) {
    const row = input.closest('tr');
    const id = row.dataset.id;
    const item = chiTietItems.find(i => i && i.id == id);
    const nganh = document.getElementById('don-hang-modal-nganh').value;
    if (!item || !nganh) {
        if (!nganh) showToast('Vui lòng chọn Ngành trong Thông Tin Chung trước.', 'info');
        return;
    }

    item.ma_vt = input.value;
    const { data, error } = await sb.from('san_pham')
        .select('ma_vt, ten_vt')
        .eq('nganh', nganh)
        .or(`ma_vt.ilike.%${input.value}%,ten_vt.ilike.%${input.value}%`)
        .limit(10);

    if (error) { console.error(error); return; }

    openAutocomplete(input, data || [], {
        valueKey: 'ma_vt',
        primaryTextKey: 'ma_vt',
        secondaryTextKey: 'ten_vt',
        width: '350px',
        onSelect: async (selectedValue) => {
            input.value = selectedValue;
            await updateItemFromMaVt(item, selectedValue);
            renderChiTietTable();
        }
    });
}

const handleDonHangModalEsc = (e) => {
    if (e.key === 'Escape') {
        const modal = document.getElementById('don-hang-modal');
        if (!modal.classList.contains('hidden')) {
            e.preventDefault();
            e.stopPropagation();
            closeDonHangModalWithConfirm();
        }
    }
};

function hasDonHangChanges() {
    const currentData = {
        thoi_gian: document.getElementById('don-hang-modal-thoi-gian').value,
        loai_don: document.getElementById('don-hang-modal-loai-don').value,
        yeu_cau: document.getElementById('don-hang-modal-yeu-cau').value.trim(),
        nganh: document.getElementById('don-hang-modal-nganh').value.trim(),
        ma_nx: document.getElementById('don-hang-modal-ma-nx').value.trim(),
        muc_dich: document.getElementById('don-hang-modal-muc-dich').value.trim(),
        ghi_chu: document.getElementById('don-hang-modal-ghi-chu').value.trim(),
    };

    for (const key in initialDonHangData) {
        if (initialDonHangData[key] !== currentData[key]) {
            return true;
        }
    }

    if (selectedDonHangFiles.length > 0) return true;
    if (initialExistingFiles.length !== currentExistingFiles.length) return true;

    if (chiTietItems.length !== initialChiTietItems.length) return true;

    const getComparableItem = ({ ma_vt, lot, yc_sl, sl, loai }) => ({ ma_vt, lot, yc_sl, sl, loai });
    const initialChiTietString = JSON.stringify(initialChiTietItems.map(getComparableItem));
    const currentChiTietString = JSON.stringify(chiTietItems.map(getComparableItem));

    if (initialChiTietString !== currentChiTietString) return true;

    return false;
}

function forceCloseDonHangModal() {
    document.getElementById('don-hang-modal').classList.add('hidden');
    document.removeEventListener('keydown', handleDonHangModalEsc, { capture: true });
}

async function closeDonHangModalWithConfirm() {
    if (document.getElementById('save-don-hang-btn').classList.contains('hidden')) {
        forceCloseDonHangModal();
        return;
    }
    if (!hasDonHangChanges()) {
        forceCloseDonHangModal();
        return;
    }

    const confirmed = await showConfirm('Bạn có chắc muốn đóng? Mọi thay đổi chưa lưu sẽ bị mất.');
    if (confirmed) {
        forceCloseDonHangModal();
    }
}

export function initDonHangView() {
    const viewContainer = document.getElementById('view-don-hang');
    const isAdminOrUser = currentUser.phan_quyen === 'Admin' || currentUser.phan_quyen === 'User';
    viewContainer.querySelectorAll('.dh-admin-only').forEach(el => el.classList.toggle('hidden', !isAdminOrUser));
    
    const triggerFetch = debounce(() => fetchDonHang(1), 500);
    
    document.getElementById('don-hang-search').addEventListener('input', e => {
        viewStates['view-don-hang'].searchTerm = e.target.value; triggerFetch(); });
    document.getElementById('don-hang-filter-from-date').addEventListener('change', e => {
        viewStates['view-don-hang'].filters.from_date = e.target.value; fetchDonHang(1); });
    document.getElementById('don-hang-filter-to-date').addEventListener('change', e => {
        viewStates['view-don-hang'].filters.to_date = e.target.value; fetchDonHang(1); });

     viewContainer.addEventListener('click', e => {
        const btn = e.target.closest('.filter-btn');
        if (btn) openDonHangFilterPopover(btn, 'view-don-hang'); });

    document.getElementById('don-hang-reset-filters').addEventListener('click', () => {
        const state = viewStates['view-don-hang'];
        document.getElementById('don-hang-search').value = '';
        document.getElementById('don-hang-filter-from-date').value = '';
        document.getElementById('don-hang-filter-to-date').value = '';
        state.searchTerm = '';
        state.filters = { from_date: '', to_date: '', loai: [], trang_thai_xu_ly: [], ma_kho: [], ma_nx: [], yeu_cau: [], nganh: [] };
        viewContainer.querySelectorAll('#view-don-hang .filter-btn').forEach(btn => {
            btn.textContent = filterButtonDefaultTexts[btn.id]; });
        fetchDonHang(1);
    });

    document.getElementById('don-hang-table-body').addEventListener('click', async e => {
        const row = e.target.closest('tr'); if (!row || !row.dataset.id) return;
        const id = row.dataset.id;
        
        if (e.target.closest('.ma-kho-cell') || e.target.closest('.file-cell')) {
            const optimisticData = cache.donHangList.find(dh => dh.ma_kho === id);
            if (!optimisticData) return;

            if (currentUser.phan_quyen === 'View' && currentUser.ho_ten !== optimisticData.yeu_cau) {
                showToast("Bạn không có quyền xem chi tiết đơn hàng này.", 'error');
                return;
            }
            
            openDonHangModal(optimisticData, 'view');
            
            sb.from('don_hang').select('*').eq('ma_kho', id).single().then(({ data: freshData }) => {
                if (freshData && document.getElementById('don-hang-edit-mode-ma-kho').value === id) {
                    openDonHangModal(freshData, 'view');
                }
            });
            return;
        }

        const checkbox = row.querySelector('.don-hang-select-row');
        if (e.target !== checkbox) checkbox.checked = !checkbox.checked;
        viewStates['view-don-hang'].selected[checkbox.checked ? 'add' : 'delete'](id);
        row.classList.toggle('bg-blue-100', checkbox.checked);
        updateDonHangActionButtonsState();
        updateDonHangSelectionInfo();
    });

    document.getElementById('don-hang-select-all').addEventListener('click', e => {
        const isChecked = e.target.checked;
        document.querySelectorAll('.don-hang-select-row').forEach(cb => {
            const row = cb.closest('tr');
            if (row && cb.checked !== isChecked) {
                 cb.checked = isChecked;
                 const id = row.dataset.id;
                 viewStates['view-don-hang'].selected[isChecked ? 'add' : 'delete'](id);
                 row.classList.toggle('bg-blue-100', isChecked);
            }
        });
        updateDonHangActionButtonsState();
        updateDonHangSelectionInfo();
    });
    
    document.getElementById('don-hang-btn-add').addEventListener('click', () => openDonHangModal(null, 'add'));
    document.getElementById('don-hang-btn-edit').addEventListener('click', () => {
        const ma_kho = [...viewStates['view-don-hang'].selected][0];
        const optimisticData = cache.donHangList.find(dh => dh.ma_kho === ma_kho);
        if (optimisticData) {
            openDonHangModal(optimisticData, 'edit');
        }
    });
    document.getElementById('don-hang-btn-delete').addEventListener('click', handleDeleteMultipleDonHang);
    
    document.getElementById('don-hang-btn-print').addEventListener('click', () => {
        const selectedIds = [...viewStates['view-don-hang'].selected];
        if (selectedIds.length === 1) {
            const ma_kho = selectedIds[0];
            window.open(`print.html?ma_kho=${ma_kho}`, '_blank');
        }
    });

    document.getElementById('cancel-don-hang-btn').addEventListener('click', closeDonHangModalWithConfirm);
    document.getElementById('close-don-hang-view-btn').addEventListener('click', closeDonHangModalWithConfirm);
    document.getElementById('don-hang-form').addEventListener('submit', handleSaveDonHang);

    document.getElementById('don-hang-modal-loai-don').addEventListener('change', () => {
        updateGeneratedCodes();
        document.getElementById('don-hang-sl-header').textContent = document.getElementById('don-hang-modal-loai-don').value === 'Nhap' ? 'Nhập' : 'SL';
        renderChiTietTable(); 
    });
    document.getElementById('don-hang-modal-nganh').addEventListener('input', debounce(updateGeneratedCodes, 300));

    const dropArea = document.getElementById('don-hang-file-drop-area');
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(ev => dropArea.addEventListener(ev, e => {e.preventDefault(); e.stopPropagation();}));
    ['dragenter', 'dragover'].forEach(ev => dropArea.addEventListener(ev, () => dropArea.classList.add('border-indigo-500', 'bg-gray-100')));
    ['dragleave', 'drop'].forEach(ev => dropArea.addEventListener(ev, () => dropArea.classList.remove('border-indigo-500', 'bg-gray-100')));
    dropArea.addEventListener('drop', e => handleFileSelection(e.dataTransfer.files));
    dropArea.addEventListener('paste', e => handleFileSelection(e.clipboardData.files));
    document.getElementById('don-hang-file-upload').addEventListener('change', e => handleFileSelection(e.target.files));
    document.getElementById('don-hang-file-list').addEventListener('click', e => {
        const button = e.target.closest('.remove-file-btn');
        if (button) {
            if (button.dataset.url) {
                currentExistingFiles = currentExistingFiles.filter(url => url !== button.dataset.url);
            } else if (button.dataset.index) {
                selectedDonHangFiles.splice(parseInt(button.dataset.index, 10), 1);
            }
            renderFileList();
        }
    });

    const chiTietBody = document.getElementById('don-hang-chi-tiet-body');
    if(chiTietBody) {
        if (chiTietSortable) chiTietSortable.destroy();
        chiTietSortable = new Sortable(chiTietBody, {
            animation: 150,
            handle: '.drag-handle',
            ghostClass: 'sortable-ghost',
            dragClass: 'sortable-drag',
            draggable: '.chi-tiet-row',
            onUpdate: (evt) => {
                const itemToMove = chiTietItems.splice(evt.oldIndex, 1)[0];
                if (itemToMove) {
                    chiTietItems.splice(evt.newIndex, 0, itemToMove);
                }
                renderChiTietTable();
            }
        });

        chiTietBody.addEventListener('paste', async (e) => {
            e.preventDefault();
            const pasteData = e.clipboardData.getData('text');
            const rows = pasteData.split(/[\r\n]+/).filter(row => row.trim() !== '');
            if (rows.length === 0) return;

            showLoading(true);
            showToast('Đang xử lý dữ liệu dán...', 'info');

            try {
                const initialNewItems = rows.map(row => {
                    const cells = row.split('\t'); 
                    const ma_vt = (cells[0] || '').trim();
                    const yc_sl_raw = cells[1] || '';
                    const yc_sl = parseInt(yc_sl_raw, 10);
            
                    if (!ma_vt) return null; 
            
                    return {
                        id: `new-${Date.now()}-${Math.random()}`,
                        ma_vt: ma_vt,
                        ten_vt: '',
                        yc_sl: isNaN(yc_sl) ? null : yc_sl,
                        sl: null,
                        loai: null,
                    };
                }).filter(Boolean); 

                const updatePromises = initialNewItems.map(item => updateItemFromMaVt(item, item.ma_vt));
                const finalNewItems = await Promise.all(updatePromises);
                
                if(finalNewItems.length > 0) {
                   const focusedRow = document.activeElement.closest('tr.chi-tiet-row');
                   if (focusedRow && focusedRow.dataset.id) {
                       const targetId = focusedRow.dataset.id;
                       const targetIndex = chiTietItems.findIndex(item => item && item.id == targetId);
                       
                       if (targetIndex !== -1) {
                           chiTietItems.splice(targetIndex, 1, ...finalNewItems);
                       } else {
                           chiTietItems.push(...finalNewItems);
                       }
                   } else {
                       chiTietItems.push(...finalNewItems);
                   }
                    renderChiTietTable();
                    showToast(`Đã dán và cập nhật ${finalNewItems.length} vật tư.`, 'success');
                }
            } catch(err) {
                showToast(`Lỗi khi dán: ${err.message}`, 'error');
            } finally {
                showLoading(false);
            }
       });
    }

    document.getElementById('don-hang-them-vat-tu-btn').addEventListener('click', () => {
        chiTietItems.push({ id: `new-${Date.now()}-${Math.random()}`, loai: null, sl: 0, yc_sl: 1 });
        renderChiTietTable();
    });

    chiTietBody.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.chi-tiet-delete-btn');
        if (deleteBtn) {
            const row = e.target.closest('tr');
            const id = row.dataset.id;
            chiTietItems = chiTietItems.filter(item => item && item.id != id);
            renderChiTietTable();
            return;
        }

        const lotInput = e.target.closest('.chi-tiet-lot-input');
        if (lotInput) {
            const row = lotInput.closest('tr');
            const id = row.dataset.id;
            const item = chiTietItems.find(i => i && i.id == id);
            if(item) {
                openLotSelectorPopover(lotInput, item);
            }
        }
    });

    chiTietBody.addEventListener('change', (e) => {
        const input = e.target;
        if (!input.classList.contains('chi-tiet-input')) return;
        
        const row = input.closest('tr');
        if (!row) return;
        const id = row.dataset.id;
        const field = input.dataset.field;
        let value = input.type === 'number' ? parseFloat(input.value) : input.value;
        const item = chiTietItems.find(i => i && i.id == id);

        if (item) {
            const oldValue = item[field];
            item[field] = value;
            
            if (field === 'yc_sl') {
                if(value <= 0) {
                    showToast('Yêu cầu (Y/c) phải lớn hơn 0.', 'error');
                    item.yc_sl = oldValue || 1;
                }
            } else if (field === 'sl') {
                const loaiDon = document.getElementById('don-hang-modal-loai-don').value;
                const availableStock = item.tonKhoData?.ton_cuoi || 0;

                 if (value < 0) {
                    showToast('Số lượng (SL) không được âm.', 'error');
                    item.sl = oldValue || 0;
                 } else if (item.yc_sl && value > item.yc_sl) {
                    showToast('Số lượng (SL) không được lớn hơn Yêu cầu (Y/c).', 'error');
                    item.sl = oldValue || item.yc_sl;
                 } else if (loaiDon === 'Xuat' && value > availableStock) {
                    showToast(`Số lượng (SL) không được lớn hơn tồn kho (${availableStock}).`, 'error');
                    item.sl = oldValue !== undefined ? oldValue : availableStock;
                 }
            }
            renderChiTietTable();
        }
    });
    
    chiTietBody.addEventListener('input', debounce(async (e) => {
        const input = e.target;
        if (input.classList.contains('chi-tiet-input') && input.dataset.field === 'ma_vt') {
            await handleMaVtAutocomplete(input);
        }
    }, 300));
    
    chiTietBody.addEventListener('focusin', async (e) => {
        const input = e.target;
        if (input.classList.contains('chi-tiet-input') && input.dataset.field === 'ma_vt') {
            await handleMaVtAutocomplete(input);
        }
    });

    document.getElementById('don-hang-items-per-page').addEventListener('change', (e) => {
        viewStates['view-don-hang'].itemsPerPage = parseInt(e.target.value, 10); fetchDonHang(1); });
    document.getElementById('don-hang-prev-page').addEventListener('click', () => fetchDonHang(viewStates['view-don-hang'].currentPage - 1));
    document.getElementById('don-hang-next-page').addEventListener('click', () => fetchDonHang(viewStates['view-don-hang'].currentPage + 1));
    const pageInput = document.getElementById('don-hang-page-input');
    const handlePageJump = () => {
        const state = viewStates['view-don-hang'];
        const totalPages = Math.ceil(state.totalFilteredCount / state.itemsPerPage) || 1;
        let targetPage = parseInt(pageInput.value, 10);
        if (isNaN(targetPage) || targetPage < 1) targetPage = 1;
        else if (targetPage > totalPages) targetPage = totalPages;
        pageInput.value = targetPage;
        if (targetPage !== state.currentPage) fetchDonHang(targetPage);
    };
    pageInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); handlePageJump(); e.target.blur(); }});
    pageInput.addEventListener('change', handlePageJump);
}
