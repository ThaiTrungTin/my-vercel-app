import { sb, currentUser, cache, viewStates, showLoading, showToast, showConfirm, debounce, renderPagination, filterButtonDefaultTexts, openAutocomplete, updateTonKhoToggleUI } from './app.js';
import { fetchSanPham } from './sanpham.js';

// Configuration for toggleable columns on Desktop
const OPTIONAL_COLUMNS = [
    { key: 'full-code', label: 'Code + Lot + EXP', class: 'tk-col-full-code' },
    { key: 'ten-vt', label: 'Tên Vật Tư', class: 'tk-col-ten-vt' },
    { key: 'dau', label: 'Tồn Đầu', class: 'tk-col-dau' },
    { key: 'nhap', label: 'Nhập', class: 'tk-col-nhap' },
    { key: 'xuat', label: 'Xuất', class: 'tk-col-xuat' },
    { key: 'tinh-trang', label: 'Tình Trạng', class: 'tk-col-tinh-trang' },
    { key: 'tray', label: 'Tray', class: 'tk-col-tray' },
    { key: 'nganh', label: 'Ngành', class: 'tk-col-nganh' },
    { key: 'phu-trach', label: 'Phụ Trách', class: 'tk-col-phu-trach' },
    { key: 'ghi-chu', label: 'Ghi chú', class: 'tk-col-ghi-chu' },
];

const STATUS_ORDER = [
    'Hết hạn sử dụng',
    'Từ 1-30 ngày',
    'Từ 31-60 ngày',
    'Từ 61-90 ngày',
    'Từ 91-120 ngày',
    'Từ 121-150 ngày',
    'Từ 151-180 ngày',
    'Trên 180 ngày',
    'Không có date'
];

// Helper to get UI Configuration (CSS and Label) for Expiry Status
function getStatusUI(statusLabel, daysLeft = null) {
    let bgCss = 'px-1.5 py-0.5 rounded-full shadow-sm font-semibold ';
    let textCss = 'font-bold ';
    let display = statusLabel;
    let mobileDayLabel = '';

    // 1. Determine Colors (Under 180 is Warning, Above is Green)
    if (statusLabel === 'Hết hạn sử dụng') {
        bgCss += 'text-white bg-red-600';
        textCss += 'text-red-600';
        mobileDayLabel = 'Hết hạn';
    } else if (statusLabel === 'Từ 1-30 ngày') {
        bgCss += 'text-white bg-red-400';
        textCss += 'text-red-400';
    } else if (statusLabel === 'Từ 31-60 ngày') {
        bgCss += 'text-white bg-orange-500';
        textCss += 'text-orange-500';
    } else if (statusLabel === 'Từ 61-90 ngày') {
        bgCss += 'text-white bg-orange-400';
        textCss += 'text-white bg-orange-400';
        textCss += 'text-orange-400';
    } else if (statusLabel === 'Từ 91-120 ngày') {
        bgCss += 'text-gray-800 bg-amber-400';
        textCss += 'text-amber-500';
    } else if (statusLabel === 'Từ 121-150 ngày') {
        bgCss += 'text-gray-800 bg-yellow-400';
        textCss += 'text-yellow-500';
    } else if (statusLabel === 'Từ 151-180 ngày') {
        bgCss += 'text-gray-800 bg-yellow-200';
        textCss += 'text-yellow-400';
    } else if (statusLabel === 'Trên 180 ngày') {
        bgCss += 'text-white bg-green-600';
        textCss += 'text-green-600';
    } else {
        bgCss += 'text-gray-500 bg-gray-100';
        textCss += 'text-gray-400';
    }

    // 2. Refined Display Logic for detailed days
    if (daysLeft !== null && statusLabel !== 'Không có date' && statusLabel !== 'Hết hạn sử dụng') {
        if (daysLeft > 4000) {
            display = 'Trên 180 ngày ( ... )';
            mobileDayLabel = '...';
        } else {
            display = `${statusLabel} (${daysLeft} ngày)`;
            mobileDayLabel = `${daysLeft} ngày`;
        }
    } else if (statusLabel === 'Trên 180 ngày' && daysLeft === null) {
        display = 'Trên 180 ngày ( chi tiết )';
    }

    return { bgCss, textCss, display, mobileDayLabel };
}

const getColumnSettings = () => {
    const saved = localStorage.getItem('tonKhoColumnSettings');
    if (saved) return JSON.parse(saved);
    return OPTIONAL_COLUMNS.reduce((acc, col) => {
        acc[col.key] = true;
        return acc;
    }, {});
};

const saveColumnSettings = (settings) => {
    localStorage.setItem('tonKhoColumnSettings', JSON.stringify(settings));
};

async function updateTonKhoHeaderCounts() {
    const state = viewStates['view-ton-kho'];
    const dauEl = document.getElementById('ton-kho-header-dau-count');
    const nhapEl = document.getElementById('ton-kho-header-nhap-count');
    const xuatEl = document.getElementById('ton-kho-header-xuat-count');
    const cuoiEl = document.getElementById('ton-kho-header-cuoi-count');
    const mobileSummaryEl = document.getElementById('tk-summary-info');

    if (!dauEl || !nhapEl || !xuatEl || !cuoiEl) return;

    [dauEl, nhapEl, xuatEl, cuoiEl].forEach(el => el.textContent = '(...)');
    if (mobileSummaryEl) mobileSummaryEl.innerHTML = '<span class="text-gray-400 font-normal">...</span>';

    try {
        let query = buildTonKhoQuery();
        const { data, error } = await query.select('ton_dau, nhap, xuat, ton_cuoi');

        if (error) throw error;

        let totalDau = 0, totalNhap = 0, totalXuat = 0, totalCuoi = 0;
        
        if (data && data.length > 0) {
            data.forEach(item => {
                totalDau += (item.ton_dau || 0);
                totalNhap += (item.nhap || 0);
                totalXuat += (item.xuat || 0);
                totalCuoi += (item.ton_cuoi || 0);
            });
        }

        const dVal = totalDau.toLocaleString();
        const nVal = totalNhap.toLocaleString();
        const xVal = totalXuat.toLocaleString();
        const cVal = totalCuoi.toLocaleString();

        dauEl.textContent = `(${dVal})`;
        nhapEl.textContent = `(${nVal})`;
        xuatEl.textContent = `(${xVal})`;
        cuoiEl.textContent = `(${cVal})`;
        
        cuoiEl.classList.toggle('text-red-600', totalCuoi > 0);
        cuoiEl.classList.toggle('text-green-600', totalCuoi <= 0);

        if (mobileSummaryEl) {
            // Sử dụng CSS class đã định nghĩa để ưu tiên hiển thị bên phải
            mobileSummaryEl.innerHTML = `
                <div class="mobile-summary-container">
                    <div class="mobile-summary-content flex items-center gap-1 sm:gap-1.5 text-[7px] sm:text-[9px] font-bold border-x border-gray-100 px-1">
                        <span class="text-blue-600">Đ:${dVal}</span>
                        <span class="text-gray-300">|</span>
                        <span class="text-green-600">N:${nVal}</span>
                        <span class="text-gray-300">|</span>
                        <span class="text-red-500">X:${xVal}</span>
                        <span class="text-gray-300">|</span>
                        <span class="${totalCuoi > 0 ? 'text-red-600' : 'text-green-600'}">C:${cVal}</span>
                    </div>
                </div>
            `;
        }

    } catch (err) {
        console.error("Error updating counts:", err);
        [dauEl, nhapEl, xuatEl, cuoiEl].forEach(el => el.textContent = '(lỗi)');
        if (mobileSummaryEl) mobileSummaryEl.innerHTML = '<span class="text-red-500">Lỗi</span>';
    }
}

function buildTonKhoQuery() {
    const state = viewStates['view-ton-kho'];
    let query = sb.from('ton_kho_update').select('*', { count: 'exact' });

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

    if (state.searchTerm) {
        query = query.or(`ma_vach.ilike.%${state.searchTerm}%,ma_vt.ilike.%${state.searchTerm}%,ten_vt.ilike.%${state.searchTerm}%,lot.ilike.%${state.searchTerm}%,tinh_trang.ilike.%${state.searchTerm}%,nganh.ilike.%${state.searchTerm}%,phu_trach.ilike.%${state.searchTerm}%,note.ilike.%${state.searchTerm}%`);
    }

    if (state.stockAvailability === 'available') {
        query = query.gt('ton_cuoi', 0);
    }

    if (state.filters.ma_vt?.length > 0) query = query.in('ma_vt', state.filters.ma_vt);
    if (state.filters.lot?.length > 0) query = query.in('lot', state.filters.lot);
    if (state.filters.date?.length > 0) query = query.in('date', state.filters.date);
    if (state.filters.tinh_trang?.length > 0) query = query.in('tinh_trang', state.filters.tinh_trang);
    if (state.filters.nganh?.length > 0) query = query.in('nganh', state.filters.nganh);
    if (state.filters.phu_trach?.length > 0) query = query.in('phu_trach', state.filters.phu_trach);
    
    return query;
}

export async function fetchTonKho(page = viewStates['view-ton-kho'].currentPage, showLoader = true) {
    if (showLoader) showLoading(true);
    try {
        viewStates['view-ton-kho'].currentPage = page;
        const state = viewStates['view-ton-kho'];
        state.selected.clear();
        updateTonKhoToggleUI();

        const { itemsPerPage } = state;
        const from = (page - 1) * itemsPerPage;
        const to = from + itemsPerPage - 1;

        let query = buildTonKhoQuery().order('ma_vach', { ascending: true }).range(from, to);

        const [queryResult, _] = await Promise.all([
            query,
            updateTonKhoHeaderCounts()
        ]);
        
        const { data, error, count } = queryResult;

        if (error) {
            showToast("Không thể tải dữ liệu tồn kho.", 'error');
        } else {
            state.totalFilteredCount = count;
            cache.tonKhoList = data;
            
            renderTonKhoTable(data);
            applyTonKhoColumnSettings(); 
            renderPagination('ton-kho', count, from, to);
            updateFilterButtonTexts('ton-kho');
        }
    } finally {
        if (showLoader) showLoading(false);
    }
}

function renderTonKhoTable(data) {
    const tkTableBody = document.getElementById('ton-kho-table-body');
    if (!tkTableBody) return;

    if (data && data.length > 0) {
        const html = data.map(tk => {
            const tonCuoiClass = tk.ton_cuoi > 0 ? 'text-red-600 font-bold' : 'text-green-600 font-bold';
            const ui = getStatusUI(tk.tinh_trang, tk.ngay_con_lai);

            const noteHtml = tk.note ? `
                <div class="group relative flex justify-center items-center h-full">
                    <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                    <div class="absolute bottom-full right-full mb-2 mr-2 w-max max-w-xs scale-0 transform rounded bg-gray-800 p-2 text-sm text-white transition-all group-hover:scale-100 origin-bottom-right pointer-events-none z-20 whitespace-pre-wrap">${tk.note}</div>
                </div>
            ` : '';
            
            return `
                <tr data-id="${tk.ma_vach}" class="hover:bg-gray-50">
                    <td class="tk-col-full-code hidden md:table-cell px-1 py-2 text-sm font-medium text-blue-600 hover:underline border border-gray-300 text-left cursor-pointer">
                        ${tk.ma_vach}
                    </td>
                    <td class="px-2 md:px-4 py-1 text-[10px] md:text-sm font-medium border border-gray-300 text-left break-all">
                        <div class="flex items-center gap-1.5">
                            <span class="text-blue-600 font-bold">${tk.ma_vt}</span>
                            <button class="copy-ma-vt-btn p-1 text-gray-400 hover:text-blue-600 transition-colors" title="Copy mã VT">
                                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                            </button>
                        </div>
                        <div class="md:hidden text-[8px] text-gray-500 break-words mt-0.5 leading-tight font-normal hover:text-blue-500 hover:underline cursor-pointer mobile-ten-vt-trigger">${tk.ten_vt}</div>
                    </td>
                    <td class="tk-col-ten-vt hidden md:table-cell px-1 py-2 text-sm text-gray-600 break-words border border-gray-300 text-left">${tk.ten_vt}</td>
                    <td class="px-1 md:px-4 py-1 text-[9px] md:text-sm text-gray-600 border border-gray-300 text-center whitespace-nowrap overflow-hidden text-ellipsis">${tk.lot || ''}</td>
                    <td class="px-1 md:px-4 py-1 text-[9px] md:text-sm text-gray-600 border border-gray-300 text-center whitespace-nowrap">
                        ${tk.date || ''}
                        <div class="md:hidden text-[7px] mt-0.5 leading-tight ${ui.textCss}">
                            ${ui.mobileDayLabel}
                        </div>
                    </td>
                    <td class="tk-col-dau hidden md:table-cell px-2 py-2 text-sm text-black font-bold border border-gray-300 text-center">${tk.ton_dau}</td>
                    <td class="tk-col-nhap hidden md:table-cell px-2 py-2 text-sm text-green-600 border border-gray-300 text-center">${tk.nhap}</td>
                    <td class="tk-col-xuat hidden md:table-cell px-2 py-2 text-sm text-red-600 border border-gray-300 text-center">${tk.xuat}</td>
                    <td class="px-2 md:px-4 py-1 text-[10px] md:text-sm border border-gray-300 text-center ${tonCuoiClass}">${tk.ton_cuoi}</td>
                    <td class="tk-col-tinh-trang hidden md:table-cell px-1 py-2 border border-gray-300 text-center whitespace-nowrap">
                        <span class="text-[10px] ${ui.bgCss}">${ui.display}</span>
                    </td>
                    <td class="tk-col-tray hidden md:table-cell px-1 py-2 text-sm text-gray-600 border border-gray-300 text-center">${tk.tray || ''}</td>
                    <td class="tk-col-nganh hidden md:table-cell px-1 md:px-4 py-2 text-[9px] md:text-sm text-gray-600 border border-gray-300 text-center whitespace-nowrap overflow-hidden text-ellipsis">${tk.nganh || ''}</td>
                    <td class="tk-col-phu-trach hidden md:table-cell px-1 py-2 text-sm text-gray-600 border border-gray-300 text-center">${tk.phu_trach || ''}</td>
                    <td class="tk-col-ghi-chu hidden md:table-cell px-1 py-2 border border-gray-300 text-center">${noteHtml}</td>
                </tr>
            `;
        }).join('');
        tkTableBody.innerHTML = html;
    } else {
        tkTableBody.innerHTML = '<tr><td colspan="14" class="text-center py-4">Không có dữ liệu</td></tr>';
    }
}

async function openTonKhoModal(tk = null, mode = 'view') {
    const modal = document.getElementById('ton-kho-modal');
    const form = document.getElementById('ton-kho-form');
    form.reset();
    
    form.querySelectorAll('input, select, textarea').forEach(el => el.disabled = true);
    document.getElementById('save-ton-kho-btn').classList.add('hidden');
    document.getElementById('cancel-ton-kho-btn').classList.add('hidden');
    document.getElementById('close-ton-kho-view-btn').classList.remove('hidden');
    document.getElementById('ton-kho-modal-ma-vach-display-container').classList.remove('hidden');
    
    document.getElementById('ton-kho-modal-title').textContent = 'Chi Tiết Tồn Kho';
    document.getElementById('ton-kho-edit-mode-ma-vach').value = tk.ma_vach;
    
    Object.keys(tk).forEach(key => {
        const input = document.getElementById(`ton-kho-modal-${key.replace(/_/g, '-')}`);
        if (input) input.value = tk[key] || '';
    });

    const container = document.getElementById('ton-kho-modal-tinh-trang-container');
    container.innerHTML = `<input type="text" value="${tk.tinh_trang}" disabled class="block w-full border rounded-md p-2 bg-gray-100">`;

    modal.classList.remove('hidden');
}

async function handleTonKhoExcelExport() {
    const modal = document.getElementById('excel-export-modal');
    modal.classList.remove('hidden');

    const exportAndClose = async (exportAll) => {
        modal.classList.add('hidden');
        showLoading(true);
        try {
            const query = exportAll ? sb.from('ton_kho_update').select('*') : buildTonKhoQuery().select('*');
            const { data, error } = await query.order('ma_vach').limit(50000);
            
            if (error) throw error;
            if (!data || data.length === 0) {
                showToast("Không có dữ liệu để xuất.", 'info');
                return;
            }

            const worksheet = XLSX.utils.json_to_sheet(data);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "TonKho");
            XLSX.writeFile(workbook, `TonKho_${new Date().toISOString().slice(0,10)}.xlsx`);
            showToast("Xuất Excel thành công!", 'success');
        } catch (err) {
            showToast(`Lỗi khi xuất Excel: ${err.message}`, 'error');
        } finally {
            showLoading(false);
        }
    };
    document.getElementById('excel-export-filtered-btn').onclick = () => exportAndClose(false);
    document.getElementById('excel-export-all-btn').onclick = () => exportAndClose(true);
    document.getElementById('excel-export-cancel-btn').onclick = () => modal.classList.add('hidden');
}

function applyTonKhoColumnSettings() {
    const settings = getColumnSettings();
    
    OPTIONAL_COLUMNS.forEach(col => {
        const isVisible = settings[col.key];
        document.querySelectorAll(`.${col.class}`).forEach(el => {
            if (window.innerWidth >= 768) {
                el.classList.toggle('hidden', !isVisible);
                el.classList.toggle('md:table-cell', isVisible);
            } else {
                el.classList.add('hidden');
                el.classList.remove('md:table-cell');
            }
        });
    });
}

function openTonKhoSettingsModal() {
    const modal = document.getElementById('ton-kho-settings-modal');
    const container = document.getElementById('ton-kho-column-toggles');
    const settings = getColumnSettings();

    container.innerHTML = OPTIONAL_COLUMNS.map(col => `
        <label class="flex items-center justify-between p-3 rounded-md bg-gray-50 border hover:bg-gray-100 cursor-pointer">
            <span class="text-sm font-medium text-gray-700">${col.label}</span>
            <input type="checkbox" class="tk-col-toggle-cb w-5 h-5 accent-blue-600" data-key="${col.key}" ${settings[col.key] ? 'checked' : ''}>
        </label>
    `).join('');

    modal.classList.remove('hidden');

    container.querySelectorAll('.tk-col-toggle-cb').forEach(cb => {
        cb.onchange = (e) => {
            const key = e.target.dataset.key;
            settings[key] = e.target.checked;
            saveColumnSettings(settings);
            applyTonKhoColumnSettings();
        };
    });
}

function updateFilterButtonTexts(viewPrefix) {
    const state = viewStates[`view-${viewPrefix}`];
    if (!state) return;
    
    const viewContainer = document.getElementById(`view-${viewPrefix}`);
    if (!viewContainer) return;

    viewContainer.querySelectorAll('.filter-btn').forEach(btn => {
        const filterKey = btn.dataset.filterKey;
        if (filterKey && state.filters.hasOwnProperty(filterKey)) {
            const selectedOptions = state.filters[filterKey] || [];
            const defaultText = filterButtonDefaultTexts[btn.id] || 'Filter';
            
            if (Array.isArray(selectedOptions)) {
                const newText = selectedOptions.length > 0 ? `${defaultText} (${selectedOptions.length})` : defaultText;
                btn.textContent = newText;
                const mobileBtn = document.getElementById(`${btn.id}-mobile`);
                if(mobileBtn) mobileBtn.textContent = newText;
            }
        }
    });
}

export function initTonKhoView() {
    const viewContainer = document.getElementById('view-ton-kho');
    applyTonKhoColumnSettings();

    const handleSearch = debounce((e) => {
        viewStates['view-ton-kho'].searchTerm = e.target.value;
        fetchTonKho(1);
    }, 500);

    document.getElementById('ton-kho-search').addEventListener('input', handleSearch);
    document.getElementById('ton-kho-search-mobile').addEventListener('input', handleSearch);
    
    viewContainer.addEventListener('click', e => {
        const btn = e.target.closest('.filter-btn');
        if (btn) openTonKhoFilterPopoverCustom(btn, 'view-ton-kho');
    });

    const toggleAvailableBtn = document.getElementById('ton-kho-toggle-available');
    const toggleAllBtn = document.getElementById('ton-kho-toggle-all');
    const toggleAvailableBtnMobile = document.getElementById('ton-kho-toggle-available-mobile');
    const toggleAllBtnMobile = document.getElementById('ton-kho-toggle-all-mobile');
    const state = viewStates['view-ton-kho'];

    const handleToggleClick = (e) => {
        const mode = e.currentTarget.dataset.stockMode;
        if (state.stockAvailability !== mode) {
            state.stockAvailability = mode;
            sessionStorage.setItem('tonKhoStockAvailability', mode);
            updateTonKhoToggleUI();
            fetchTonKho(1);
        }
    };
    
    if(toggleAvailableBtn) toggleAvailableBtn.addEventListener('click', handleToggleClick);
    if(toggleAllBtn) toggleAllBtn.addEventListener('click', handleToggleClick);
    if(toggleAvailableBtnMobile) toggleAvailableBtnMobile.addEventListener('click', handleToggleClick);
    if(toggleAllBtnMobile) toggleAllBtnMobile.addEventListener('click', handleToggleClick);
    
    state.stockAvailability = sessionStorage.getItem('tonKhoStockAvailability') || 'available';
    updateTonKhoToggleUI();

    document.getElementById('ton-kho-reset-filters').addEventListener('click', () => {
        document.getElementById('ton-kho-search').value = '';
        document.getElementById('ton-kho-search-mobile').value = '';
        viewStates['view-ton-kho'].searchTerm = '';
        viewStates['view-ton-kho'].filters = { ma_vt: [], lot: [], date: [], tinh_trang: [], nganh: [], phu_trach: [] };
        
        viewContainer.querySelectorAll('#view-ton-kho .filter-btn').forEach(btn => {
            if(!btn.id.includes('mobile')) btn.textContent = filterButtonDefaultTexts[btn.id];
        });
        
        state.stockAvailability = 'available';
        sessionStorage.setItem('tonKhoStockAvailability', 'available');
        updateTonKhoToggleUI();
        fetchTonKho(1);
    });

    const drawer = document.getElementById('tk-filter-drawer');
    const overlay = document.getElementById('tk-filter-drawer-overlay');
    const toggleBtn = document.getElementById('tk-mobile-filter-toggle');
    const closeBtn = document.getElementById('tk-filter-drawer-close');

    toggleBtn.addEventListener('click', () => {
        drawer.classList.remove('translate-x-full');
        overlay.classList.remove('hidden');
    });
    closeBtn.addEventListener('click', () => {
        drawer.classList.add('translate-x-full');
        overlay.classList.add('hidden');
    });
    overlay.addEventListener('click', () => {
        drawer.classList.add('translate-x-full');
        overlay.classList.add('hidden');
    });

    document.getElementById('ton-kho-table-body').addEventListener('click', async e => {
        // 1. Logic Copy Mã VT
        const copyBtn = e.target.closest('.copy-ma-vt-btn');
        if (copyBtn) {
            const row = copyBtn.closest('tr');
            const id = row.dataset.id;
            const tk = cache.tonKhoList.find(i => i.ma_vach === id);
            if (tk) {
                try {
                    await navigator.clipboard.writeText(tk.ma_vt);
                    showToast('Đã copy mã VT: ' + tk.ma_vt, 'success');
                } catch (err) {
                    showToast('Lỗi khi copy mã VT.', 'error');
                }
            }
            return;
        }

        // 2. Logic Mở Form Xem (Chỉ khi nhấn vào cột Code hoặc đúng Tên VT trên mobile)
        const openTrigger = e.target.closest('.tk-col-full-code') || e.target.closest('.mobile-ten-vt-trigger');
        if (!openTrigger) return;

        const row = openTrigger.closest('tr');
        if (!row || !row.dataset.id) return;
        const id = row.dataset.id;
        const tk = cache.tonKhoList.find(i => i.ma_vach === id);
        if(tk) openTonKhoModal(tk, 'view');
    });

    document.getElementById('ton-kho-btn-settings').addEventListener('click', openTonKhoSettingsModal);
    document.getElementById('ton-kho-settings-close-btn').addEventListener('click', () => {
        document.getElementById('ton-kho-settings-modal').classList.add('hidden');
    });

    document.getElementById('ton-kho-btn-excel').addEventListener('click', handleTonKhoExcelExport);
    document.getElementById('ton-kho-btn-excel-mobile').addEventListener('click', handleTonKhoExcelExport);

    document.getElementById('ton-kho-items-per-page').addEventListener('change', (e) => {
        viewStates['view-ton-kho'].itemsPerPage = parseInt(e.target.value, 10);
        fetchTonKho(1);
    });
    document.getElementById('ton-kho-prev-page').addEventListener('click', () => fetchTonKho(viewStates['view-ton-kho'].currentPage - 1));
    document.getElementById('ton-kho-next-page').addEventListener('click', () => fetchTonKho(viewStates['view-ton-kho'].currentPage + 1));
    
    const pageInput = document.getElementById('ton-kho-page-input');
    const handlePageJump = () => {
        let targetPage = parseInt(pageInput.value, 10);
        const totalPages = Math.ceil(state.totalFilteredCount / state.itemsPerPage);
        if (isNaN(targetPage) || targetPage < 1) targetPage = 1;
        else if (targetPage > totalPages && totalPages > 0) targetPage = totalPages;
        pageInput.value = targetPage;
        if (targetPage !== state.currentPage) fetchTonKho(targetPage);
    };
    pageInput.addEventListener('change', handlePageJump);
    
    document.getElementById('close-ton-kho-view-btn').onclick = () => {
        document.getElementById('ton-kho-modal').classList.add('hidden');
    };
}

async function openTonKhoFilterPopoverCustom(button, view) {
    const filterKey = button.dataset.filterKey;
    const state = viewStates[view];

    const template = document.getElementById('filter-popover-template');
    if (!template) return;
    const popoverContent = template.content.cloneNode(true);
    const popover = popoverContent.querySelector('.filter-popover');
    document.body.appendChild(popover);

    const rect = button.getBoundingClientRect();
    if (window.innerWidth <= 768) {
        popover.style.position = 'fixed';
        popover.style.left = '50%';
        popover.style.top = '50%';
        popover.style.transform = 'translate(-50%, -50%)';
        popover.style.width = '90%';
        popover.style.maxWidth = '300px';
    } else {
        popover.style.left = `${rect.left}px`;
        popover.style.top = `${rect.bottom + window.scrollY + 5}px`;
    }

    const optionsList = popover.querySelector('.filter-options-list');
    const applyBtn = popover.querySelector('.filter-apply-btn');
    const searchInput = popover.querySelector('.filter-search-input');
    const selectionCountEl = popover.querySelector('.filter-selection-count');
    const toggleAllBtn = popover.querySelector('.filter-toggle-all-btn');
    
    const tempSelectedOptions = new Set(state.filters[filterKey] || []);

    const updateSelectionCount = () => {
        const count = tempSelectedOptions.size;
        selectionCountEl.textContent = count > 0 ? `Đã chọn: ${count}` : '';
    };

    const updateToggleAllButtonState = (visibleCheckboxes) => {
        if (visibleCheckboxes.length === 0) {
            toggleAllBtn.textContent = 'Tất cả';
            toggleAllBtn.disabled = true;
            return;
        }
        toggleAllBtn.disabled = false;
        const allVisibleSelected = [...visibleCheckboxes].every(cb => cb.checked);
        toggleAllBtn.textContent = allVisibleSelected ? 'Bỏ chọn' : 'Tất cả';
    };

    const renderOptions = (options) => {
        const searchTerm = searchInput.value.toLowerCase();
        const filteredOptions = options.filter(option => 
            option && String(option).toLowerCase().includes(searchTerm)
        );

        if (filteredOptions.length > 0) {
            optionsList.innerHTML = filteredOptions.map(option => {
                let colorClasses = '';
                let displayLabel = option;
                if (filterKey === 'tinh_trang') {
                    const ui = getStatusUI(option);
                    colorClasses = ui.bgCss;
                    displayLabel = ui.display;
                }
                return `
                <label class="flex items-center space-x-2 px-2 py-1 hover:bg-gray-100 rounded cursor-pointer">
                    <input type="checkbox" value="${option}" class="filter-option-cb" ${tempSelectedOptions.has(String(option)) ? 'checked' : ''}>
                    <span class="text-sm ${colorClasses}">${displayLabel}</span>
                </label>
            `}).join('');
        } else {
            optionsList.innerHTML = '<div class="text-center p-4 text-sm text-gray-500">Không có tùy chọn.</div>';
        }
        updateToggleAllButtonState(optionsList.querySelectorAll('.filter-option-cb'));
    };
    
    const setupEventListeners = (allOptions) => {
        searchInput.addEventListener('input', () => renderOptions(allOptions));
        optionsList.addEventListener('change', e => {
            const cb = e.target;
            if (cb.type === 'checkbox' && cb.classList.contains('filter-option-cb')) {
                if (cb.checked) tempSelectedOptions.add(cb.value);
                else tempSelectedOptions.delete(cb.value);
                updateSelectionCount();
                updateToggleAllButtonState(optionsList.querySelectorAll('.filter-option-cb'));
            }
        });
        toggleAllBtn.onclick = () => {
            const searchTerm = searchInput.value.toLowerCase();
            const visibleOptions = allOptions.filter(option => 
                option && String(option).toLowerCase().includes(searchTerm)
            );
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
    optionsList.innerHTML = '<div class="text-center p-4 text-sm text-gray-500">Đang tải...</div>';
    applyBtn.disabled = true;

    try {
        // --- NÂNG CẤP: Lấy dữ liệu bộ lọc tuân thủ PHÂN QUYỀN và PHỤ THUỘC LẪN NHAU ---
        let query = sb.from('ton_kho_update').select(filterKey);

        // 1. Áp dụng phân quyền (Phụ trách / Ngành được phép)
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

        // 2. Áp dụng trạng thái tìm kiếm và nút "Khả dụng"
        if (state.searchTerm) {
            query = query.or(`ma_vach.ilike.%${state.searchTerm}%,ma_vt.ilike.%${state.searchTerm}%,ten_vt.ilike.%${state.searchTerm}%,lot.ilike.%${state.searchTerm}%,tinh_trang.ilike.%${state.searchTerm}%,nganh.ilike.%${state.searchTerm}%,phu_trach.ilike.%${state.searchTerm}%,note.ilike.%${state.searchTerm}%`);
        }
        if (state.stockAvailability === 'available') {
            query = query.gt('ton_cuoi', 0);
        }

        // 3. Áp dụng CÁC BỘ LỌC KHÁC (Logic phụ thuộc lẫn nhao)
        Object.keys(state.filters).forEach(key => {
            if (key !== filterKey && state.filters[key] && state.filters[key].length > 0) {
                query = query.in(key, state.filters[key]);
            }
        });

        const { data, error } = await query.limit(10000);
        if (error) throw error;
        
        let uniqueOptions = [...new Set(data.map(item => item[filterKey]).filter(Boolean))];
        if (filterKey === 'tinh_trang') {
            uniqueOptions.sort((a, b) => STATUS_ORDER.indexOf(a) - STATUS_ORDER.indexOf(b));
        } else uniqueOptions.sort();

        renderOptions(uniqueOptions);
        setupEventListeners(uniqueOptions);
        applyBtn.disabled = false;
    } catch (error) {
        console.error("Filter popover error:", error);
        optionsList.innerHTML = '<div class="text-center p-4 text-sm text-red-500">Lỗi tải bộ lọc.</div>';
    }
    
    const closePopover = (e) => {
        if (!popover.contains(e.target) && e.target !== button) {
            popover.remove();
            document.removeEventListener('click', closePopover);
        }
    };
    applyBtn.onclick = async () => {
        state.filters[filterKey] = [...tempSelectedOptions];
        const defaultText = filterButtonDefaultTexts[button.id] || button.id;
        button.textContent = tempSelectedOptions.size > 0 ? `${defaultText} (${tempSelectedOptions.size})` : defaultText;
        fetchTonKho(1);
        popover.remove();
        document.removeEventListener('click', closePopover);
    };
    setTimeout(() => document.addEventListener('click', closePopover), 0);
}