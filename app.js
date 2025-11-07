

import { initCaiDatView, fetchUsers, initProfileAvatarState } from './caidat.js';
import { initSanPhamView, fetchSanPham } from './sanpham.js';
import { initDonHangView, fetchDonHang } from './don-hang.js';
import { initChiTietView, fetchChiTiet } from './chitiet.js';


const { createClient } = supabase;
const SUPABASE_URL = "https://uefydnefprcannlviimp.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVlZnlkbmVmcHJjYW5ubHZpaW1wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwNTcwMDUsImV4cCI6MjA3NjYzMzAwNX0.X274J_1_crUknJEOT1WWUD1h0HM9WdYScDW2eWWsiLk";
export const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

export let currentUser = null;
let currentView = 'view-phat-trien'; 
let userChannel = null; 
let adminNotificationChannel = null;
export const DEFAULT_AVATAR_URL = 'https://t4.ftcdn.net/jpg/05/49/98/39/360_F_549983970_bRCkYfk0P6PP5fKbMhZMIb07vs1cACai.jpg';
export const PLACEHOLDER_IMAGE_URL = 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Placeholder_view_vector.svg/681px-Placeholder_view_vector.svg.png';
export const cache = {
    userList: [],
    sanPhamList: [],
    tonKhoList: [],
    donHangList: [],
    chiTietList: [],
};
export const viewStates = {
    'view-san-pham': {
        currentPage: 1,
        itemsPerPage: 50,
        searchTerm: '',
        selected: new Set(),
        filters: { ma_vt: [], ten_vt: [], nganh: [], phu_trach: [] },
        totalFilteredCount: 0,
        paginationText: '',
    },
    'view-ton-kho': {
        currentPage: 1,
        itemsPerPage: 50,
        searchTerm: '',
        selected: new Set(),
        filters: { ma_vt: [], lot: [], date: [], ton_cuoi: [], tinh_trang: [], nganh: [], phu_trach: [] },
        totalFilteredCount: 0,
        paginationText: '',
    },
    'view-don-hang': {
        currentPage: 1,
        itemsPerPage: 50,
        searchTerm: '',
        selected: new Set(),
        filters: { from_date: '', to_date: '', loai: [], trang_thai_xu_ly: [], ma_kho: [], ma_nx: [], yeu_cau: [], nganh: [] },
        totalFilteredCount: 0,
        paginationText: '',
    },
    'view-chi-tiet': {
        currentPage: 1,
        itemsPerPage: 50,
        searchTerm: '',
        filters: { from_date: '', to_date: '', ma_kho: [], ma_nx: [], ma_vt: [], lot: [], nganh: [], phu_trach: [] },
        totalFilteredCount: 0,
        paginationText: '',
    }
};
let isViewInitialized = {
    'view-san-pham': false,
    'view-ton-kho': false,
    'view-don-hang': false,
    'view-chi-tiet': false,
    'view-cai-dat': false,
};
export const filterButtonDefaultTexts = {
    'san-pham-filter-ma-vt-btn': 'Mã VT', 
    'san-pham-filter-ten-vt-btn': 'Tên Vật Tư', 
    'san-pham-filter-nganh-btn': 'Ngành', 
    'san-pham-filter-phu-trach-btn': 'Phụ Trách',
    'ton-kho-filter-ma-vt-btn': 'Mã VT',
    'ton-kho-filter-lot-btn': 'Lot',
    'ton-kho-filter-date-btn': 'Date',
    'ton-kho-filter-ton-cuoi-btn': 'Tồn Cuối',
    'ton-kho-filter-tinh-trang-btn': 'Tình Trạng',
    'ton-kho-filter-nganh-btn': 'Ngành',
    'ton-kho-filter-phu-trach-btn': 'Phụ Trách',
    'don-hang-filter-loai-btn': 'Loại',
    'don-hang-filter-trang-thai-btn': 'Trạng Thái',
    'don-hang-filter-ma-kho-btn': 'Mã Kho',
    'don-hang-filter-ma-nx-btn': 'Mã NX',
    'don-hang-filter-yeu-cau-btn': 'Yêu Cầu',
    'don-hang-filter-nganh-btn': 'Ngành',
    'chi-tiet-filter-ma-kho-btn': 'Mã Kho',
    'chi-tiet-filter-ma-nx-btn': 'Mã NX',
    'chi-tiet-filter-ma-vt-btn': 'Mã VT',
    'chi-tiet-filter-lot-btn': 'LOT',
    'chi-tiet-filter-nganh-btn': 'Ngành',
    'chi-tiet-filter-phu-trach-btn': 'Phụ Trách',
};
let activeAutocompletePopover = null;


export const showLoading = (show) => document.getElementById('loading-bar').classList.toggle('hidden', !show);

export function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => {
        toast.classList.remove('show');
        toast.classList.add('hide');
        toast.addEventListener('transitionend', () => toast.remove());
    }, 3000);
}

export function showConfirm(message, title = 'Xác nhận hành động') {
    return new Promise(resolve => {
        const modal = document.getElementById('confirm-modal');
        const titleEl = document.getElementById('confirm-title');
        const messageEl = document.getElementById('confirm-message');
        const okBtn = document.getElementById('confirm-ok-btn');
        const cancelBtn = document.getElementById('confirm-cancel-btn');

        titleEl.textContent = title;
        messageEl.textContent = message;

        const cleanup = (result) => {
            modal.classList.add('hidden');
            okBtn.onclick = null;
            cancelBtn.onclick = null;
            resolve(result);
        };

        okBtn.onclick = () => cleanup(true);
        cancelBtn.onclick = () => cleanup(false);

        modal.classList.remove('hidden');
    });
}

export function sanitizeFileName(fileName) {
    if (!fileName) return '';
    const lastDot = fileName.lastIndexOf('.');
    const nameWithoutExt = lastDot !== -1 ? fileName.slice(0, lastDot) : fileName;
    const ext = lastDot !== -1 ? fileName.slice(lastDot) : '';

    return nameWithoutExt
        .normalize('NFD') 
        .replace(/[\u0300-\u036f]/g, '') 
        .toLowerCase() 
        .replace(/\s+/g, '-') 
        .replace(/[^a-z0-9-.]/g, '') + 
        ext; 
}

export const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
};

export function renderPagination(viewPrefix, totalItems, from, to) {
    const state = viewStates[`view-${viewPrefix}`];
    if (!state) return;
    
    const { currentPage, itemsPerPage } = state;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const paginationInfoEl = document.getElementById(`${viewPrefix}-pagination-info`);
    const pageInput = document.getElementById(`${viewPrefix}-page-input`);
    const totalPagesEl = document.getElementById(`${viewPrefix}-total-pages`);
    const prevBtn = document.getElementById(`${viewPrefix}-prev-page`);
    const nextBtn = document.getElementById(`${viewPrefix}-next-page`);

    const paginationText = `(Hiển thị ${from + 1} - ${to + 1} trên ${totalItems})`;
    state.paginationText = paginationText;

    if(paginationInfoEl) paginationInfoEl.textContent = paginationText;
    
    if (pageInput) {
        pageInput.value = currentPage;
        pageInput.max = totalPages > 0 ? totalPages : 1;
        pageInput.min = 1;
    }
    if (totalPagesEl) {
        totalPagesEl.textContent = `/ ${totalPages > 0 ? totalPages : 1}`;
    }
    
    if(prevBtn) prevBtn.disabled = currentPage <= 1;
    if(nextBtn) nextBtn.disabled = currentPage >= totalPages;
}

export function updateSidebarAvatar(url) {
    document.getElementById('sidebar-avatar').src = url || DEFAULT_AVATAR_URL;
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
            
            if (filterKey.includes('date') && selectedOptions) {
                 btn.textContent = defaultText; 
            } else if (Array.isArray(selectedOptions)) {
                btn.textContent = selectedOptions.length > 0 ? `${defaultText} (${selectedOptions.length})` : defaultText;
            }
        }
    });
}

function closeActiveAutocompletePopover() {
    if (activeAutocompletePopover) {
        activeAutocompletePopover.element.remove();
        document.removeEventListener('click', activeAutocompletePopover.closeHandler);
        activeAutocompletePopover = null;
    }
}

export function openAutocomplete(inputElement, suggestions, config) {
    closeActiveAutocompletePopover(); 
    if (suggestions.length === 0) return;

    const popoverTemplate = document.getElementById('autocomplete-popover-template');
    if (!popoverTemplate) return;

    const popoverContent = popoverTemplate.content.cloneNode(true);
    const popover = popoverContent.querySelector('div'); 
    
    const optionsList = popover.querySelector('.autocomplete-options-list');
    const secondaryTextHTML = (item) => config.secondaryTextKey ? `<p class="text-xs text-gray-500 pointer-events-none">${item[config.secondaryTextKey] || ''}</p>` : '';

    optionsList.innerHTML = suggestions.map(item => `
        <div class="px-3 py-2 cursor-pointer hover:bg-gray-100 autocomplete-option" data-value="${item[config.valueKey]}">
            <p class="text-sm font-medium text-gray-900 pointer-events-none">${item[config.primaryTextKey]}</p>
            ${secondaryTextHTML(item)}
        </div>
    `).join('');

    inputElement.parentNode.appendChild(popover);
    popover.style.width = config.width || `${inputElement.offsetWidth}px`;
    
    optionsList.addEventListener('mousedown', (e) => { 
        const option = e.target.closest('.autocomplete-option');
        if (option) {
            e.preventDefault(); 
            config.onSelect(option.dataset.value);
            closeActiveAutocompletePopover(); 
        }
    });
    
    const closeHandler = (e) => {
        if (!inputElement.contains(e.target) && !popover.contains(e.target)) {
            closeActiveAutocompletePopover();
        }
    };
    
    setTimeout(() => document.addEventListener('click', closeHandler), 0);
    
    activeAutocompletePopover = { element: popover, closeHandler: closeHandler };
}

const debouncedValidateMaVach = debounce(async (ma_vach) => {
    const statusEl = document.getElementById('ton-kho-modal-ma-vach-status');
    const saveBtn = document.getElementById('save-ton-kho-btn');
    if (!ma_vach) {
        statusEl.textContent = '';
        saveBtn.disabled = true;
        return;
    }

    const { data, error } = await sb.from('ton_kho').select('ma_vach').eq('ma_vach', ma_vach).single();
    
    if (data) {
        statusEl.textContent = 'Mã vạch đã tồn tại';
        statusEl.classList.remove('text-green-600');
        statusEl.classList.add('text-red-600');
        saveBtn.disabled = true;
    } else {
        statusEl.textContent = 'Hợp lệ';
        statusEl.classList.remove('text-red-600');
        statusEl.classList.add('text-green-600');
        saveBtn.disabled = false;
    }
}, 500);


function updateGeneratedMaVach() {
    const ma_vt = document.getElementById('ton-kho-modal-ma-vt').value.trim();
    const lot = document.getElementById('ton-kho-modal-lot').value.trim();
    const dateInput = document.getElementById('ton-kho-modal-date').value.trim();

    const dateParts = dateInput.split('/');
    const formattedDate = dateParts.length === 3 ? `${dateParts[0]}.${dateParts[1]}.${dateParts[2]}` : dateInput;

    const generatedMaVach = [ma_vt, lot, formattedDate].filter(Boolean).join('');
    
    document.getElementById('ton-kho-modal-ma-vach').value = generatedMaVach;
    document.getElementById('ton-kho-modal-ma-vach-display').textContent = generatedMaVach || '...';
    
    if (!document.getElementById('ton-kho-edit-mode-ma-vach').value) {
        debouncedValidateMaVach(generatedMaVach);
    }
}


function parseDate(dateString) { 
    if (!dateString || !/^\d{2}\/\d{2}\/\d{4}$/.test(dateString)) return null;
    
    const parts = dateString.split('/');
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10); 
    const year = parseInt(parts[2], 10);

    if (year < 1000 || year > 9999 || month === 0 || month > 12) return null;

    const monthLength = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

    if (year % 400 === 0 || (year % 100 !== 0 && year % 4 === 0)) {
        monthLength[1] = 29;
    }

    if (day <= 0 || day > monthLength[month - 1]) return null;

    const date = new Date(year, month - 1, day);
    return isNaN(date.getTime()) ? null : date;
}


function updateTinhTrangField() {
    const dateInput = document.getElementById('ton-kho-modal-date').value;
    const container = document.getElementById('ton-kho-modal-tinh-trang-container');
    const dateValue = parseDate(dateInput);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0); 

    const threeMonthsFromNow = new Date();
    threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);

    let newElement;
    if (dateValue && dateValue <= today) {
        newElement = `<input type="text" id="ton-kho-modal-tinh-trang" value="Hết hạn sử dụng" readonly class="block w-full border rounded-md p-2 bg-gray-200">`;
    } else if (dateValue && dateValue > today && dateValue <= threeMonthsFromNow) {
        newElement = `<input type="text" id="ton-kho-modal-tinh-trang" value="Cận date" readonly class="block w-full border rounded-md p-2 bg-gray-200">`;
    } else { 
        newElement = `
            <select id="ton-kho-modal-tinh-trang" required class="block w-full border rounded-md p-2">
                <option value="Còn sử dụng">Còn sử dụng</option>
                <option value="Hàng hư">Hàng hư</option>
            </select>`;
    }
    container.innerHTML = newElement;
}

async function updateTonKhoHeaderCounts() {
    const state = viewStates['view-ton-kho'];
    const dauEl = document.getElementById('ton-kho-header-dau-count');
    const nhapEl = document.getElementById('ton-kho-header-nhap-count');
    const xuatEl = document.getElementById('ton-kho-header-xuat-count');
    const cuoiEl = document.getElementById('ton-kho-header-cuoi-count');

    if (!dauEl || !nhapEl || !xuatEl || !cuoiEl) return;

    [dauEl, nhapEl, xuatEl, cuoiEl].forEach(el => el.textContent = '(...)');

    try {
        const { data, error } = await sb.rpc('get_ton_kho_summary', {
            _search_term: state.searchTerm || '',
            _ma_vt_filter: state.filters.ma_vt || [],
            _lot_filter: state.filters.lot || [],
            _date_filter: state.filters.date || [],
            _tinh_trang_filter: state.filters.tinh_trang || [],
            _nganh_filter: state.filters.nganh || [],
            _phu_trach_filter: state.filters.phu_trach || [],
            _ton_cuoi_filter: state.filters.ton_cuoi || [],
            _user_role: currentUser.phan_quyen,
            _user_ho_ten: currentUser.ho_ten
        });

        if (error) {
            console.error("Error fetching ton kho summary:", error);
            showToast("Lỗi khi tải dữ liệu tổng hợp tồn kho.", 'error');
            throw error;
        }

        if (data && data.length > 0) {
            const totals = data[0];
            dauEl.textContent = `(${(totals.total_ton_dau || 0).toLocaleString()})`;
            nhapEl.textContent = `(${(totals.total_nhap || 0).toLocaleString()})`;
            xuatEl.textContent = `(${(totals.total_xuat || 0).toLocaleString()})`;
            
            const totalTonCuoi = totals.total_ton_cuoi || 0;
            cuoiEl.textContent = `(${totalTonCuoi.toLocaleString()})`;
            cuoiEl.classList.toggle('text-red-600', totalTonCuoi > 0);
            cuoiEl.classList.toggle('text-green-600', totalTonCuoi <= 0);
        } else {
             [dauEl, nhapEl, xuatEl, cuoiEl].forEach(el => el.textContent = '(0)');
             cuoiEl.classList.remove('text-red-600');
             cuoiEl.classList.add('text-green-600');
        }

    } catch (err) {
        [dauEl, nhapEl, xuatEl, cuoiEl].forEach(el => el.textContent = '(lỗi)');
    }
}


function buildTonKhoQuery() {
    const state = viewStates['view-ton-kho'];
    let query = sb.from('ton_kho_update').select('*', { count: 'exact' });

    if (currentUser.phan_quyen === 'View') {
        query = query.eq('phu_trach', currentUser.ho_ten);
    }

    if (state.searchTerm) {
        query = query.or(`ma_vach.ilike.%${state.searchTerm}%,ma_vt.ilike.%${state.searchTerm}%,ten_vt.ilike.%${state.searchTerm}%,lot.ilike.%${state.searchTerm}%,tinh_trang.ilike.%${state.searchTerm}%,nganh.ilike.%${state.searchTerm}%,phu_trach.ilike.%${state.searchTerm}%,note.ilike.%${state.searchTerm}%`);
    }

    if (state.filters.ma_vt?.length > 0) query = query.in('ma_vt', state.filters.ma_vt);
    if (state.filters.lot?.length > 0) query = query.in('lot', state.filters.lot);
    if (state.filters.date?.length > 0) query = query.in('date', state.filters.date);
    if (state.filters.tinh_trang?.length > 0) query = query.in('tinh_trang', state.filters.tinh_trang);
    if (state.filters.nganh?.length > 0) query = query.in('nganh', state.filters.nganh);
    if (state.filters.phu_trach?.length > 0) query = query.in('phu_trach', state.filters.phu_trach);
    
    if (state.filters.ton_cuoi?.length > 0) {
        if (state.filters.ton_cuoi.includes('Còn Hàng') && !state.filters.ton_cuoi.includes('Hết Hàng')) {
            query = query.gt('ton_cuoi', 0);
        } else if (!state.filters.ton_cuoi.includes('Còn Hàng') && state.filters.ton_cuoi.includes('Hết Hàng')) {
            query = query.eq('ton_cuoi', 0);
        }
    }
    
    return query;
}

async function fetchTonKho(page = viewStates['view-ton-kho'].currentPage, showLoader = true) {
    if (showLoader) showLoading(true);
    try {
        viewStates['view-ton-kho'].currentPage = page;
        const state = viewStates['view-ton-kho'];
        state.selected.clear();
        updateTonKhoActionButtonsState();
        updateTonKhoSelectionInfo();

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
            applyTonKhoColumnState();
            renderPagination('ton-kho', count, from, to);
            updateTonKhoSelectionInfo();
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
            const isSelected = viewStates['view-ton-kho'].selected.has(tk.ma_vach);
            const tonCuoiClass = tk.ton_cuoi > 0 ? 'text-red-600 font-bold' : 'text-green-600 font-bold';
            
            let tinhTrangClass = 'text-[10px] font-semibold px-1 py-0.5 rounded-full ';
            switch (tk.tinh_trang) {
                case 'Hết hạn sử dụng':
                    tinhTrangClass += 'text-red-800 bg-red-100';
                    break;
                case 'Cận date':
                    tinhTrangClass += 'text-blue-800 bg-blue-100';
                    break;
                case 'Còn sử dụng':
                    tinhTrangClass += 'text-green-800 bg-green-100';
                    break;
                case 'Hàng hư':
                    tinhTrangClass += 'text-yellow-800 bg-yellow-100';
                    break;
                default:
                    tinhTrangClass += 'text-gray-800 bg-gray-100';
            }

            const noteHtml = tk.note ? `
                <div class="group relative flex justify-center items-center h-full">
                    <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                    <div class="absolute bottom-full right-full mb-2 mr-2 w-max max-w-xs scale-0 transform rounded bg-gray-800 p-2 text-sm text-white transition-all group-hover:scale-100 origin-bottom-right pointer-events-none z-20 whitespace-pre-wrap">
                        ${tk.note}
                    </div>
                </div>
            ` : '';
            
            return `
                <tr data-id="${tk.ma_vach}" class="hover:bg-gray-50 ${isSelected ? 'bg-blue-100' : ''}">
                    <td class="px-1 py-2 border border-gray-300 text-center"><input type="checkbox" class="ton-kho-select-row" data-id="${tk.ma_vach}" ${isSelected ? 'checked' : ''}></td>
                    <td class="px-1 py-2 text-sm font-medium text-gray-900 border border-gray-300 text-left cursor-pointer text-blue-600 hover:underline ma-vach-cell">${tk.ma_vach}</td>
                    <td class="px-1 py-2 text-sm font-medium text-gray-900 border border-gray-300 text-left">${tk.ma_vt}</td>
                    <td class="px-1 py-2 text-sm text-gray-600 break-words border border-gray-300 text-left">${tk.ten_vt}</td>
                    <td class="px-1 py-2 text-sm text-gray-600 border border-gray-300 text-center">${tk.lot || ''}</td>
                    <td class="px-1 py-2 text-sm text-gray-600 border border-gray-300 text-center">${tk.date || ''}</td>
                    <td class="px-2 py-2 text-sm text-black font-bold border border-gray-300 text-center">${tk.ton_dau}</td>
                    <td class="px-2 py-2 text-sm text-green-600 border border-gray-300 text-center">${tk.nhap}</td>
                    <td class="px-2 py-2 text-sm text-red-600 border border-gray-300 text-center">${tk.xuat}</td>
                    <td class="px-2 py-2 text-sm border border-gray-300 text-center ${tonCuoiClass}">${tk.ton_cuoi}</td>
                    <td class="px-1 py-2 border border-gray-300 text-center whitespace-nowrap"><span class="${tinhTrangClass}">${tk.tinh_trang || ''}</span></td>
                    <td class="px-1 py-2 text-sm text-gray-600 border border-gray-300 text-center">${tk.tray || ''}</td>
                    <td class="ton-kho-col-nganh px-1 py-2 text-sm text-gray-600 border border-gray-300 text-center">${tk.nganh || ''}</td>
                    <td class="ton-kho-col-phu-trach px-1 py-2 text-sm text-gray-600 border border-gray-300 text-center">${tk.phu_trach || ''}</td>
                    <td class="px-1 py-2 border border-gray-300 text-center">${noteHtml}</td>
                </tr>
            `;
        }).join('');
        tkTableBody.innerHTML = html;
    } else {
        tkTableBody.innerHTML = '<tr><td colspan="15" class="text-center py-4">Không có dữ liệu</td></tr>';
    }
}

function updateTonKhoSelectionInfo() {
    const state = viewStates['view-ton-kho'];
    const selectedCount = state.selected.size;
    const totalCount = state.totalFilteredCount;
    const selectionText = `${selectedCount} / ${totalCount} hàng được chọn`;
    
    const selectionInfoEl = document.getElementById('ton-kho-selection-info');
    if (selectionInfoEl) {
        selectionInfoEl.textContent = selectionText;
    }
}

function updateTonKhoActionButtonsState() {
    const selectedCount = viewStates['view-ton-kho'].selected.size;
    document.getElementById('ton-kho-btn-edit').disabled = selectedCount !== 1;
    document.getElementById('ton-kho-btn-delete').disabled = selectedCount === 0;
}

async function openTonKhoModal(tk = null, mode = 'add') {
    const modal = document.getElementById('ton-kho-modal');
    const form = document.getElementById('ton-kho-form');
    form.reset();
    document.getElementById('ton-kho-modal-date').classList.remove('border-red-500');

    if (cache.sanPhamList.length === 0) await fetchSanPham(1, false);
    
    const isViewMode = mode === 'view';
    form.querySelectorAll('input, select, textarea').forEach(el => el.disabled = isViewMode);

    document.getElementById('save-ton-kho-btn').classList.toggle('hidden', isViewMode);
    document.getElementById('cancel-ton-kho-btn').classList.toggle('hidden', isViewMode);
    document.getElementById('close-ton-kho-view-btn').classList.toggle('hidden', !isViewMode);
    document.getElementById('ton-kho-modal-ma-vach-display-container').classList.toggle('hidden', mode === 'edit');
    
    const maVachStatusEl = document.getElementById('ton-kho-modal-ma-vach-status');
    maVachStatusEl.textContent = '';

    if (mode === 'add') {
        document.getElementById('ton-kho-modal-title').textContent = 'Thêm Tồn Kho Mới';
        document.getElementById('ton-kho-edit-mode-ma-vach').value = '';
        updateGeneratedMaVach();
        updateTinhTrangField(); 
    } else { 
        document.getElementById('ton-kho-modal-title').textContent = isViewMode ? 'Xem Chi Tiết Tồn Kho' : 'Sửa Tồn Kho';
        document.getElementById('ton-kho-edit-mode-ma-vach').value = tk.ma_vach;
        Object.keys(tk).forEach(key => {
            const input = document.getElementById(`ton-kho-modal-${key.replace(/_/g, '-')}`);
            if (input) input.value = tk[key] || '';
        });
        updateTinhTrangField(); 
        document.getElementById('ton-kho-modal-tinh-trang').value = tk.tinh_trang;
    }

    modal.classList.remove('hidden');
}

async function handleSaveTonKho(e) {
    e.preventDefault();
    const ma_vach_orig = document.getElementById('ton-kho-edit-mode-ma-vach').value;
    const isEdit = !!ma_vach_orig;
    
    const tonKhoData = {
        ma_vach: document.getElementById('ton-kho-modal-ma-vach').value.trim(),
        ma_vt: document.getElementById('ton-kho-modal-ma-vt').value.trim(),
        ten_vt: document.getElementById('ton-kho-modal-ten-vt').value.trim(),
        lot: document.getElementById('ton-kho-modal-lot').value.trim(),
        date: document.getElementById('ton-kho-modal-date').value.trim(),
        ton_dau: parseInt(document.getElementById('ton-kho-modal-ton-dau').value, 10) || 0,
        nhap: parseInt(document.getElementById('ton-kho-modal-nhap').value, 10) || 0,
        xuat: parseInt(document.getElementById('ton-kho-modal-xuat').value, 10) || 0,
        tinh_trang: document.getElementById('ton-kho-modal-tinh-trang').value.trim(),
        tray: document.getElementById('ton-kho-modal-tray').value.trim(),
        nganh: document.getElementById('ton-kho-modal-nganh').value.trim(),
        phu_trach: document.getElementById('ton-kho-modal-phu-trach').value.trim(),
        note: document.getElementById('ton-kho-modal-note').value.trim(),
    };

    if (!tonKhoData.ma_vt || !tonKhoData.ten_vt || !tonKhoData.tinh_trang || tonKhoData.ton_dau === null) {
        showToast("Mã VT, Tên VT, Tình Trạng và Tồn Đầu là bắt buộc.", 'error');
        return;
    }
     if (!isEdit && !tonKhoData.ma_vach) {
        showToast("Mã vạch không được để trống.", 'error');
        return;
    }

    showLoading(true);
    try {
        const { error } = isEdit
            ? await sb.from('ton_kho').update(tonKhoData).eq('ma_vach', ma_vach_orig)
            : await sb.from('ton_kho').insert(tonKhoData);

        if (error) throw error;
        showToast(`Lưu tồn kho thành công!`, 'success');
        document.getElementById('ton-kho-modal').classList.add('hidden');
        fetchTonKho(viewStates['view-ton-kho'].currentPage, false);
    } catch (error) {
        if (error.code === '23505') showToast(`Mã vạch "${tonKhoData.ma_vach}" đã tồn tại.`, 'error');
        else showToast(`Lỗi: ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
}

async function handleDeleteMultipleTonKho() {
    const selectedIds = [...viewStates['view-ton-kho'].selected];
    if (selectedIds.length === 0) return;

    showLoading(true);
    try {
        const { count, error: checkError } = await sb
            .from('chi_tiet')
            .select('ma_vach', { count: 'exact', head: true })
            .in('ma_vach', selectedIds);

        if (checkError) throw checkError;

        if (count > 0) {
            showToast('Không thể xóa. Một hoặc nhiều mã tồn kho đã có giao dịch Nhập/Xuất.', 'error');
            return; 
        }
        
        showLoading(false); 
        const confirmed = await showConfirm(`Bạn có chắc muốn xóa ${selectedIds.length} mục tồn kho?`);
        if (!confirmed) return;

        showLoading(true); 
        const { error } = await sb.from('ton_kho').delete().in('ma_vach', selectedIds);
        if (error) throw error;
        showToast(`Đã xóa ${selectedIds.length} mục.`, 'success');
        fetchTonKho(1, false);

    } catch (error) {
        showToast(`Lỗi khi xóa: ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
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


async function openTonKhoFilterPopover(button, view) {
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
    const selectionCountEl = popover.querySelector('.filter-selection-count');
    const toggleAllBtn = popover.querySelector('.filter-toggle-all-btn');
    
    const tempSelectedOptions = new Set(state.filters[filterKey] || []);

    const updateSelectionCount = () => {
        const count = tempSelectedOptions.size;
        selectionCountEl.textContent = count > 0 ? `Đã chọn: ${count}` : '';
    };

    const updateToggleAllButtonState = () => {
        const visibleCheckboxes = optionsList.querySelectorAll('.filter-option-cb');
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
            optionsList.innerHTML = filteredOptions.map(option => `
                <label class="flex items-center space-x-2 px-2 py-1 hover:bg-gray-100 rounded">
                    <input type="checkbox" value="${option}" class="filter-option-cb" ${tempSelectedOptions.has(String(option)) ? 'checked' : ''}>
                    <span class="text-sm">${option}</span>
                </label>
            `).join('');
        } else {
            optionsList.innerHTML = '<div class="text-center p-4 text-sm text-gray-500">Không có tùy chọn.</div>';
        }
        updateToggleAllButtonState();
    };
    
    const setupEventListeners = (allOptions) => {
        searchInput.addEventListener('input', () => renderOptions(allOptions));
        
        optionsList.addEventListener('change', e => {
            const cb = e.target;
            if (cb.type === 'checkbox' && cb.classList.contains('filter-option-cb')) {
                if (cb.checked) {
                    tempSelectedOptions.add(cb.value);
                } else {
                    tempSelectedOptions.delete(cb.value);
                }
                updateSelectionCount();
                updateToggleAllButtonState();
            }
        });
        
        toggleAllBtn.onclick = () => {
            const searchTerm = searchInput.value.toLowerCase();
            const visibleOptions = allOptions.filter(option => 
                option && String(option).toLowerCase().includes(searchTerm)
            );
            
            const isSelectAllAction = toggleAllBtn.textContent === 'Tất cả';
            
            visibleOptions.forEach(option => {
                if (isSelectAllAction) {
                    tempSelectedOptions.add(String(option));
                } else {
                    tempSelectedOptions.delete(String(option));
                }
            });

            renderOptions(allOptions);
            updateSelectionCount();
        };
    };

    updateSelectionCount();

    if (filterKey === 'ton_cuoi') {
        searchInput.classList.add('hidden');
        const options = ['Còn Hàng', 'Hết Hàng'];
        renderOptions(options);
        setupEventListeners(options);
    } else {
        optionsList.innerHTML = '<div class="text-center p-4 text-sm text-gray-500">Đang tải...</div>';
        applyBtn.disabled = true;
        try {
            const { data: rpcData, error } = await sb.rpc('get_ton_kho_filter_options', {
                filter_key: filterKey,
                _ma_vt_filter: state.filters.ma_vt || [],
                _lot_filter: state.filters.lot || [],
                _date_filter: state.filters.date || [],
                _tinh_trang_filter: state.filters.tinh_trang || [],
                _nganh_filter: state.filters.nganh || [],
                _phu_trach_filter: state.filters.phu_trach || [],
                _ton_cuoi_filter: state.filters.ton_cuoi || [],
                _search_term: state.searchTerm || '',
                _user_role: currentUser.phan_quyen,
                _user_ho_ten: currentUser.ho_ten
            });
            if (error) throw error;
            
            const uniqueOptions = Array.isArray(rpcData) ? rpcData.map(item => item.option) : [];
            renderOptions(uniqueOptions);
            setupEventListeners(uniqueOptions);
            applyBtn.disabled = false;

        } catch (error) {
            console.error("Filter popover error:", error)
            optionsList.innerHTML = '<div class="text-center p-4 text-sm text-red-500">Lỗi tải dữ liệu.</div>';
            showToast(`Lỗi tải bộ lọc cho ${filterKey}.`, 'error');
        }
    }
    
    const closePopover = (e) => {
        if (!popover.contains(e.target) && e.target !== button) {
            popover.remove();
            document.removeEventListener('click', closePopover);
        }
    };

    applyBtn.onclick = () => {
        state.filters[filterKey] = [...tempSelectedOptions];
        
        const defaultText = filterButtonDefaultTexts[button.id] || button.id;
        button.textContent = tempSelectedOptions.size > 0 ? `${defaultText} (${tempSelectedOptions.size})` : defaultText;
        
        if(view === 'view-ton-kho') fetchTonKho(1);
        
        popover.remove();
        document.removeEventListener('click', closePopover);
    };

    setTimeout(() => document.addEventListener('click', closePopover), 0);
}

function applyTonKhoColumnState() {
    const table = document.getElementById('view-ton-kho').querySelector('table');
    const btn = document.getElementById('ton-kho-toggle-cols');
    if (!table || !btn) return;

    const isCollapsed = sessionStorage.getItem('tonKhoColsCollapsed') !== 'false';

    table.querySelectorAll('.ton-kho-col-nganh, .ton-kho-col-phu-trach').forEach(el => {
        el.classList.toggle('hidden', isCollapsed);
    });

    btn.textContent = isCollapsed ? '[+]' : '[-]';
}

function initTonKhoView() {
    const viewContainer = document.getElementById('view-ton-kho');
    const isAdminOrUser = currentUser.phan_quyen === 'Admin' || currentUser.phan_quyen === 'User';
    viewContainer.querySelectorAll('.tk-admin-only').forEach(el => el.classList.toggle('hidden', !isAdminOrUser));
    
    applyTonKhoColumnState();

    document.getElementById('ton-kho-search').addEventListener('input', debounce(() => {
        viewStates['view-ton-kho'].searchTerm = document.getElementById('ton-kho-search').value;
        fetchTonKho(1);
    }, 500));
    
    viewContainer.addEventListener('click', e => {
        const btn = e.target.closest('.filter-btn');
        if (btn) openTonKhoFilterPopover(btn, 'view-ton-kho');
    });

    document.getElementById('ton-kho-reset-filters').addEventListener('click', () => {
        document.getElementById('ton-kho-search').value = '';
        viewStates['view-ton-kho'].searchTerm = '';
        viewStates['view-ton-kho'].filters = { ma_vt: [], lot: [], date: [], ton_cuoi: [], tinh_trang: [], nganh: [], phu_trach: [] };
        document.querySelectorAll('#view-ton-kho .filter-btn').forEach(btn => {
            btn.textContent = filterButtonDefaultTexts[btn.id];
        });
        fetchTonKho(1);
    });

    document.getElementById('ton-kho-table-body').addEventListener('click', async e => {
        const row = e.target.closest('tr');
        if (!row || !row.dataset.id) return;
        const id = row.dataset.id;
        
        if (e.target.closest('.ma-vach-cell')) {
            const { data } = await sb.from('ton_kho').select('*').eq('ma_vach', id).single();
            if(data) openTonKhoModal(data, 'view');
            return;
        }

        const checkbox = row.querySelector('.ton-kho-select-row');
        if (e.target.type !== 'checkbox') {
            checkbox.checked = !checkbox.checked;
        }
        
        viewStates['view-ton-kho'].selected[checkbox.checked ? 'add' : 'delete'](id);
        row.classList.toggle('bg-blue-100', checkbox.checked);
        updateTonKhoActionButtonsState();
        updateTonKhoSelectionInfo();
    });

    document.getElementById('ton-kho-select-all').addEventListener('click', (e) => {
        const isChecked = e.target.checked;
        document.querySelectorAll('.ton-kho-select-row').forEach(cb => {
            if(cb.checked !== isChecked) {
                 const row = cb.closest('tr');
                 const id = row.dataset.id;
                 viewStates['view-ton-kho'].selected[isChecked ? 'add' : 'delete'](id);
                 row.classList.toggle('bg-blue-100', isChecked);
                 cb.checked = isChecked;
            }
        });
        updateTonKhoActionButtonsState();
        updateTonKhoSelectionInfo();
    });
    
    document.getElementById('ton-kho-btn-add').addEventListener('click', () => openTonKhoModal(null, 'add'));
    document.getElementById('ton-kho-btn-edit').addEventListener('click', async () => {
        const ma_vach = [...viewStates['view-ton-kho'].selected][0];
        const { data } = await sb.from('ton_kho').select('*').eq('ma_vach', ma_vach).single();
        if(data) openTonKhoModal(data, 'edit');
    });
    document.getElementById('ton-kho-btn-delete').addEventListener('click', handleDeleteMultipleTonKho);
    document.getElementById('ton-kho-btn-excel').addEventListener('click', handleTonKhoExcelExport);
    document.getElementById('ton-kho-form').addEventListener('submit', handleSaveTonKho);
    
    const closeModal = () => {
        document.getElementById('ton-kho-modal').classList.add('hidden');
        closeActiveAutocompletePopover();
    };
    document.getElementById('cancel-ton-kho-btn').addEventListener('click', closeModal);
    document.getElementById('close-ton-kho-view-btn').addEventListener('click', closeModal);
    
    const tkModalMaVt = document.getElementById('ton-kho-modal-ma-vt');
    
    const handleMaVtInput = () => {
        const inputValue = tkModalMaVt.value.toLowerCase().trim();
        const suggestions = inputValue 
            ? cache.sanPhamList.filter(p => 
                p.ma_vt.toLowerCase().includes(inputValue) || 
                p.ten_vt.toLowerCase().includes(inputValue)
              ).slice(0, 10)
            : cache.sanPhamList.slice(0, 10);
            
        openAutocomplete(tkModalMaVt, suggestions, {
            valueKey: 'ma_vt',
            primaryTextKey: 'ma_vt',
            secondaryTextKey: 'ten_vt',
            onSelect: (selectedValue) => {
                tkModalMaVt.value = selectedValue;
                tkModalMaVt.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
    };
    
    tkModalMaVt.addEventListener('focus', handleMaVtInput);
    tkModalMaVt.addEventListener('input', debounce(handleMaVtInput, 200)); 
    
    tkModalMaVt.addEventListener('change', () => { 
        closeActiveAutocompletePopover(); 
        const selectedMaVt = tkModalMaVt.value;
        const sanPham = cache.sanPhamList.find(p => p.ma_vt === selectedMaVt);
        document.getElementById('ton-kho-modal-ten-vt').value = sanPham?.ten_vt || '';
        document.getElementById('ton-kho-modal-nganh').value = sanPham?.nganh || '';
        document.getElementById('ton-kho-modal-phu-trach').value = sanPham?.phu_trach || '';
        updateGeneratedMaVach();
    });

    document.getElementById('ton-kho-modal-lot').addEventListener('input', updateGeneratedMaVach);
    const dateInput = document.getElementById('ton-kho-modal-date');
    dateInput.addEventListener('input', updateGeneratedMaVach);
    dateInput.addEventListener('change', (e) => {
        const input = e.target;
        const dateValue = parseDate(input.value);
        if (input.value && !dateValue) {
            showToast('Ngày không hợp lệ. Vui lòng nhập đúng dd/mm/yyyy.', 'error');
            input.classList.add('border-red-500');
            input.value = '';
            updateGeneratedMaVach();
        } else {
            input.classList.remove('border-red-500');
        }
        updateTinhTrangField();
    });

    document.getElementById('ton-kho-items-per-page').addEventListener('change', (e) => {
        viewStates['view-ton-kho'].itemsPerPage = parseInt(e.target.value, 10);
        fetchTonKho(1);
    });
    document.getElementById('ton-kho-prev-page').addEventListener('click', () => fetchTonKho(viewStates['view-ton-kho'].currentPage - 1));
    document.getElementById('ton-kho-next-page').addEventListener('click', () => fetchTonKho(viewStates['view-ton-kho'].currentPage + 1));
    
    const pageInput = document.getElementById('ton-kho-page-input');
    const handlePageJump = () => {
        const state = viewStates['view-ton-kho'];
        let targetPage = parseInt(pageInput.value, 10);
        const totalPages = Math.ceil(state.totalFilteredCount / state.itemsPerPage);

        if (isNaN(targetPage) || targetPage < 1) targetPage = 1;
        else if (targetPage > totalPages && totalPages > 0) targetPage = totalPages;
        else if (totalPages === 0) targetPage = 1;
        
        pageInput.value = targetPage;
        if (targetPage !== state.currentPage) fetchTonKho(targetPage);
    };
    pageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); handlePageJump(); e.target.blur(); }
    });
    pageInput.addEventListener('change', handlePageJump);
    
    document.getElementById('ton-kho-toggle-cols').addEventListener('click', () => {
        const isCurrentlyCollapsed = sessionStorage.getItem('tonKhoColsCollapsed') !== 'false';
        sessionStorage.setItem('tonKhoColsCollapsed', !isCurrentlyCollapsed);
        applyTonKhoColumnState();
    });
}

function updateNotificationBar() {
    const notificationBar = document.getElementById('notification-bar');
    if (!notificationBar || !currentUser) return;

    const now = new Date();
    const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const dayOfWeek = days[now.getDay()];
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const dateString = `${dayOfWeek}, Ngày ${day} Tháng ${month} Năm ${year}`;

    const ho_ten = currentUser.ho_ten || 'Guest';
    const phan_quyen = currentUser.phan_quyen || 'View';

    let roleMessage = '';
    switch (phan_quyen) {
        case 'Admin':
            roleMessage = 'Chúc bạn ngày làm việc hiệu quả.';
            break;
        case 'User':
            roleMessage = 'Bạn chỉ có thể xem dữ liệu. Cảm ơn.';
            break;
        case 'View':
            roleMessage = 'Bạn chỉ có thể xem đơn hàng và Sản phẩm đang phụ trách. Cảm ơn.';
            break;
        default:
            roleMessage = 'Chào mừng bạn.';
    }

    notificationBar.innerHTML = `
        <marquee behavior="scroll" direction="left" scrollamount="5">
            <span>${dateString}</span> : 
            <span>Xin chào: <b class="font-bold">${ho_ten}</b> - <b class="font-bold">${phan_quyen}</b></span>. 
            <span class="italic">${roleMessage}</span>
        </marquee>
    `;
}

async function handleLogout() {
    if (userChannel) {
        await sb.removeChannel(userChannel);
        userChannel = null;
    }
    if (adminNotificationChannel) {
        await sb.removeChannel(adminNotificationChannel);
        adminNotificationChannel = null;
    }
    sessionStorage.clear();
    window.location.href = 'login.html';
}

export async function showView(viewId) {
    const viewTitles = {
        'view-phat-trien': 'Tổng Quan',
        'view-san-pham': 'Quản Lý Sản Phẩm',
        'view-ton-kho': 'Quản Lý Tồn Kho',
        'view-don-hang': 'Quản Lý Đơn Hàng',
        'view-chi-tiet': 'Chi Tiết Giao Dịch',
        'view-cai-dat': 'Cài Đặt & Quản Lý',
    };

    document.querySelectorAll('.app-view').forEach(view => view.classList.add('hidden'));
    const viewContainer = document.getElementById(viewId);
    
    if (!viewContainer) {
        console.error(`View with id ${viewId} not found.`);
        return;
    }

    const viewTitleEl = document.getElementById('view-title');
    if (viewTitleEl) {
        viewTitleEl.textContent = viewTitles[viewId] || 'Dashboard';
    }

    viewContainer.classList.remove('hidden');

    document.querySelectorAll('.nav-button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === viewId);
    });

    currentView = viewId;

    try {
        if (viewId === 'view-cai-dat') {
            if (!isViewInitialized['view-cai-dat']) {
                const response = await fetch(`cai-dat.html`);
                if (!response.ok) throw new Error(`Could not load cai-dat.html`);
                viewContainer.innerHTML = await response.text();
                const oldTitle = viewContainer.querySelector('h1');
                if (oldTitle) oldTitle.remove();
                initCaiDatView();
                document.getElementById('logout-btn').addEventListener('click', handleLogout);
                isViewInitialized['view-cai-dat'] = true;
            }
            document.getElementById('profile-ho-ten').value = currentUser.ho_ten || '';
            initProfileAvatarState();
            
            const isAdmin = currentUser.phan_quyen === 'Admin';
            const adminPanel = document.getElementById('admin-panel');
            const backupPanel = document.getElementById('backup-restore-panel');
            if (adminPanel) {
                adminPanel.classList.toggle('hidden', !isAdmin);
                if (isAdmin) {
                    await fetchUsers();
                }
            }
            if (backupPanel) {
                backupPanel.classList.toggle('hidden', !isAdmin);
            }
        } else if (viewId === 'view-san-pham') {
            if (!isViewInitialized['view-san-pham']) {
                const response = await fetch(`san-pham.html`);
                if (!response.ok) throw new Error(`Could not load san-pham.html`);
                viewContainer.innerHTML = await response.text();
                const oldTitle = viewContainer.querySelector('h1');
                if (oldTitle) oldTitle.remove();
                initSanPhamView();
                isViewInitialized['view-san-pham'] = true;
            }
            await fetchSanPham();
        } else if (viewId === 'view-ton-kho') {
            if (!isViewInitialized['view-ton-kho']) {
                initTonKhoView();
                isViewInitialized['view-ton-kho'] = true;
            }
            await fetchTonKho();
        } else if (viewId === 'view-don-hang') {
            if (!isViewInitialized['view-don-hang']) {
                initDonHangView();
                isViewInitialized['view-don-hang'] = true;
            }
            await fetchDonHang();
        } else if (viewId === 'view-chi-tiet') {
            if (!isViewInitialized['view-chi-tiet']) {
                initChiTietView();
                isViewInitialized['view-chi-tiet'] = true;
            }
            await fetchChiTiet();
        }
    } catch (error) {
        console.error(error);
        if (viewContainer) {
             viewContainer.innerHTML = `<div class="p-8 text-center text-red-500">Error loading view content. Please try again. Details: ${error.message}</div>`;
        }
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('main-content-area');
    const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
    const iconOpen = document.getElementById('sidebar-toggle-icon-open');
    const iconClose = document.getElementById('sidebar-toggle-icon-close');
    const navTexts = document.querySelectorAll('.nav-text');
    const sidebarHeaderContent = document.getElementById('sidebar-header-content');
    const userInfoText = document.getElementById('user-info-text');
    const sidebarFooter = document.getElementById('sidebar-footer');

    const setSidebarState = (isCollapsed) => {
        if (isCollapsed) {
            sidebar.classList.remove('w-64');
            sidebar.classList.add('w-20');
            mainContent.classList.remove('ml-64');
            mainContent.classList.add('ml-20');
            iconClose.classList.add('hidden');
            iconOpen.classList.remove('hidden');
            navTexts.forEach(text => text.classList.add('opacity-0'));
            sidebarFooter.classList.add('opacity-0');

            if (userInfoText) userInfoText.classList.add('hidden');
            if (sidebarHeaderContent) {
                sidebarHeaderContent.classList.remove('justify-between');
                sidebarHeaderContent.classList.add('flex-col', 'gap-4');
            }
        } else {
            sidebar.classList.remove('w-20');
            sidebar.classList.add('w-64');
            mainContent.classList.remove('ml-20');
            mainContent.classList.add('ml-64');
            iconOpen.classList.add('hidden');
            iconClose.classList.remove('hidden');
            navTexts.forEach(text => text.classList.remove('opacity-0'));
            sidebarFooter.classList.remove('opacity-0');

            if (userInfoText) userInfoText.classList.remove('hidden');
            if (sidebarHeaderContent) {
                sidebarHeaderContent.classList.add('justify-between');
                sidebarHeaderContent.classList.remove('flex-col', 'gap-4');
            }
        }
    };

    const isSidebarCollapsed = sessionStorage.getItem('sidebarCollapsed') === 'true';
    setSidebarState(isSidebarCollapsed);

    sidebarToggleBtn.addEventListener('click', () => {
        const isCollapsed = sidebar.classList.contains('w-20');
        sessionStorage.setItem('sidebarCollapsed', !isCollapsed);
        setSidebarState(!isCollapsed);
    });

    try {
        const userJson = sessionStorage.getItem('loggedInUser');
        if (userJson) {
            currentUser = JSON.parse(userJson);
            
            document.getElementById('user-ho-ten').textContent = currentUser.ho_ten || 'User';
            document.getElementById('user-gmail').textContent = currentUser.gmail || '';
            updateSidebarAvatar(currentUser.anh_dai_dien_url);
            updateNotificationBar();

            document.getElementById('app-loading').classList.add('hidden');
            document.getElementById('main-app').classList.remove('hidden');

            document.querySelectorAll('.nav-button').forEach(btn => {
                btn.addEventListener('click', () => showView(btn.dataset.view));
            });
            
            const lastView = sessionStorage.getItem('lastViewId') || 'view-phat-trien';
            await showView(lastView);

            userChannel = sb.channel('public:user')
                .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'user', filter: 'gmail=eq.'+currentUser.gmail }, payload => {
                    const updatedUser = payload.new;
                    if (updatedUser.stt === 'Khóa') {
                        showToast("Tài khoản của bạn đã bị quản trị viên khóa.", 'error');
                        setTimeout(handleLogout, 2000);
                        return;
                    }
                    if(updatedUser.mat_khau !== currentUser.mat_khau) {
                        showToast("Mật khẩu của bạn đã được quản trị viên thay đổi. Vui lòng đăng nhập lại.", 'info');
                        setTimeout(handleLogout, 3000);
                    } else {
                        sessionStorage.setItem('loggedInUser', JSON.stringify(updatedUser));
                        currentUser = updatedUser;
                        updateNotificationBar();
                        if(currentView === 'view-cai-dat') {
                             document.getElementById('profile-ho-ten').value = currentUser.ho_ten || '';
                             initProfileAvatarState();
                        }
                    }
                })
                .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'user', filter: 'gmail=eq.'+currentUser.gmail }, payload => {
                    showToast("Tài khoản của bạn đã bị xóa khỏi hệ thống.", 'error');
                    setTimeout(handleLogout, 2000);
                })
                .subscribe();
            
            if(currentUser.phan_quyen === 'Admin') {
                adminNotificationChannel = sb.channel('admin-notifications')
                    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user' }, payload => {
                        if(payload.new.stt === 'Chờ Duyệt') {
                            showToast(`Có tài khoản mới "${payload.new.ho_ten}" đang chờ duyệt.`, 'info');
                            if(currentView === 'view-cai-dat') {
                                fetchUsers();
                            }
                        }
                    })
                    .subscribe();
            }

        } else {
            window.location.href = 'login.html';
        }
    } catch (error) {
        console.error("Initialization error:", error);
        sessionStorage.clear();
        window.location.href = 'login.html';
    }
    
    window.addEventListener('beforeunload', () => {
        if (currentView) sessionStorage.setItem('lastViewId', currentView);
    });
    
    document.getElementById('close-image-viewer-btn').addEventListener('click', () => {
        document.getElementById('image-viewer-modal').classList.add('hidden');
        document.getElementById('image-viewer-img').src = '';
    });
});