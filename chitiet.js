
import { sb, cache, viewStates, currentUser, showLoading, showToast, debounce, renderPagination, filterButtonDefaultTexts, showView, updateMobileFilterIconStatus, openAutocomplete } from './app.js';

const OPTIONAL_COLUMNS_CT = [
    { key: 'ma-kho', label: 'Mã Kho', class: 'ct-col-ma-kho' },
    { key: 'ma-vach', label: 'Code + Lot + EXP', class: 'ct-col-ma-vach' },
    { key: 'ten-vt', label: 'Tên Vật Tư', class: 'ct-col-ten-vt' },
    { key: 'yeu-cau', label: 'Yêu Cầu', class: 'ct-col-yeu-cau' },
    { key: 'nhap', label: 'Nhập', class: 'ct-col-nhap' },
    { key: 'xuat', label: 'Xuất', class: 'ct-col-xuat' },
    { key: 'loai', label: 'Loại', class: 'ct-col-loai' },
    { key: 'muc-dich', label: 'Mục Đích', class: 'ct-col-muc-dich' },
    { key: 'nganh', label: 'Ngành', class: 'ct-col-nganh' },
    { key: 'phu-trach', label: 'Phụ Trách', class: 'ct-col-phu-trach' },
];

let activeActionPopover = null;
let currentDistributingItem = null;
let detailVtItems = [];
let initialDetailVtItems = []; 
let nameSuggestionsCache = []; 
let isModalListenersInitialized = false;

const VIEW_HTML = `
    <div class="flex-shrink-0">
        <div id="ct-mobile-toolbar" class="md:hidden flex items-center gap-2 mb-3 bg-white p-2 rounded-lg shadow-sm">
            <input type="text" id="chi-tiet-search-mobile" placeholder="Tìm kiếm..." class="flex-grow px-2 py-1.5 border rounded-md text-[11px] min-w-0">
            <button id="ct-mobile-filter-toggle" class="p-1.5 bg-gray-100 rounded-md text-gray-600">
                <svg class="w-3 h-3 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path></svg>
            </button>
            <button id="chi-tiet-btn-excel-mobile" class="p-1.5 bg-green-100 rounded-md text-green-600">
                <svg class="w-3 h-3 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
            </button>
        </div>

        <div id="ct-filter-drawer-overlay" class="fixed inset-0 bg-black bg-opacity-50 z-40 hidden transition-opacity duration-300"></div>
        <div id="ct-filter-drawer" class="fixed inset-y-0 right-0 w-64 bg-white z-50 transform translate-x-full transition-transform duration-300 shadow-xl flex flex-col">
            <div class="p-4 border-b flex justify-between items-center">
                <h3 class="font-bold text-lg">Bộ Lọc Chi Tiết</h3>
                <button id="ct-filter-drawer-close" class="text-gray-500 hover:text-gray-800">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
            </div>
            <div class="p-4 flex-grow space-y-4 overflow-y-auto">
                <div class="space-y-2">
                    <p class="text-xs font-semibold text-gray-500 uppercase">Ngày tháng</p>
                    <div class="grid grid-cols-1 gap-2">
                        <input type="date" id="chi-tiet-filter-from-date-mobile" class="px-3 py-2 border rounded-md text-sm">
                        <input type="date" id="chi-tiet-filter-to-date-mobile" class="px-3 py-2 border rounded-md text-sm">
                    </div>
                </div>
                <div class="space-y-2 pt-2 border-t">
                    <p class="text-xs font-semibold text-gray-500 uppercase">Tiêu chí</p>
                    <button id="chi-tiet-filter-loai-btn-mobile" data-filter-key="loai" class="filter-btn w-full text-left px-3 py-2 border rounded-md bg-gray-50 text-sm">Loại</button>
                    <button id="chi-tiet-filter-ma-kho-btn-mobile" data-filter-key="ma_kho" class="filter-btn w-full text-left px-3 py-2 border rounded-md bg-gray-50 text-sm">Mã Kho</button>
                    <button id="chi-tiet-filter-ma-nx-btn-mobile" data-filter-key="ma_nx" class="filter-btn w-full text-left px-3 py-2 border rounded-md bg-gray-50 text-sm">Mã NX</button>
                    <button id="chi-tiet-filter-ma-vt-btn-mobile" data-filter-key="ma_vt" class="filter-btn w-full text-left px-3 py-2 border rounded-md bg-gray-50 text-sm">Mã VT</button>
                    <button id="chi-tiet-filter-lot-btn-mobile" data-filter-key="lot" class="filter-btn w-full text-left px-3 py-2 border rounded-md bg-gray-50 text-sm">LOT</button>
                    <button id="chi-tiet-filter-nganh-btn-mobile" data-filter-key="nganh" class="filter-btn w-full text-left px-3 py-2 border rounded-md bg-gray-50 text-sm">Ngành</button>
                    <button id="chi-tiet-filter-phu-trach-btn-mobile" data-filter-key="phu_trach" class="filter-btn w-full text-left px-3 py-2 border rounded-md bg-gray-50 text-sm">Phụ Trách</button>
                    <button id="chi-tiet-filter-yeu-cau-btn-mobile" data-filter-key="yeu_cau" class="filter-btn w-full text-left px-3 py-2 border rounded-md bg-gray-50 text-sm">Yêu Cầu</button>
                </div>
            </div>
            <div class="p-4 border-t">
                <button id="chi-tiet-reset-filters-mobile" class="w-full bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 rounded-md">Xóa Lọc</button>
            </div>
        </div>

        <div class="hidden md:block bg-white p-4 rounded-lg shadow-md mb-4">
            <div class="flex flex-wrap gap-x-4 gap-y-2 items-center justify-between">
                <div class="flex flex-wrap gap-2 items-center w-full md:w-auto">
                    <input type="text" id="chi-tiet-search" placeholder="Tìm kiếm chung..." class="px-3 py-2 border rounded-md w-full md:w-40 text-xs">
                    <div class="flex items-center gap-2 w-full md:w-auto">
                        <label for="chi-tiet-filter-from-date" class="text-[10px] md:text-sm whitespace-nowrap">Từ:</label>
                        <input type="date" id="chi-tiet-filter-from-date" class="px-3 py-1.5 border rounded-md w-full md:w-auto text-[10px] md:text-sm">
                        <label for="chi-tiet-filter-to-date" class="text-[10px] md:text-sm whitespace-nowrap">Đến:</label>
                        <input type="date" id="chi-tiet-filter-to-date" class="px-3 py-1.5 border rounded-md w-full md:w-auto text-[10px] md:text-sm">
                    </div>
                    <div class="relative flex-grow md:flex-grow-0"><button id="chi-tiet-filter-loai-btn" data-filter-key="loai" class="filter-btn text-left px-2 py-1 md:px-3 md:py-2 border rounded-md bg-white w-full md:w-28 text-[10px] md:text-sm">Loại</button></div>
                    <div class="relative flex-grow md:flex-grow-0"><button id="chi-tiet-filter-ma-kho-btn" data-filter-key="ma_kho" class="filter-btn text-left px-2 py-1 md:px-3 md:py-2 border rounded-md bg-white w-full md:w-32 text-[10px] md:text-sm">Mã Kho</button></div>
                    <div class="relative flex-grow md:flex-grow-0"><button id="chi-tiet-filter-ma-nx-btn" data-filter-key="ma_nx" class="filter-btn text-left px-2 py-1 md:px-3 md:py-2 border rounded-md bg-white w-full md:w-32 text-[10px] md:text-sm">Mã NX</button></div>
                    <div class="relative flex-grow md:flex-grow-0"><button id="chi-tiet-filter-ma-vt-btn" data-filter-key="ma_vt" class="filter-btn text-left px-2 py-1 md:px-3 md:py-2 border rounded-md bg-white w-full md:w-32 text-[10px] md:text-sm">Mã VT</button></div>
                    <div class="relative flex-grow md:flex-grow-0"><button id="chi-tiet-filter-lot-btn" data-filter-key="lot" class="filter-btn text-left px-2 py-1 md:px-3 md:py-2 border rounded-md bg-white w-full md:w-28 text-[10px] md:text-sm">LOT</button></div>
                    <div class="relative flex-grow md:flex-grow-0"><button id="chi-tiet-filter-nganh-btn" data-filter-key="nganh" class="filter-btn text-left px-2 py-1 md:px-3 md:py-2 border rounded-md bg-white w-full md:w-28 text-[10px] md:text-sm">Ngành</button></div>
                    <div class="relative flex-grow md:flex-grow-0"><button id="chi-tiet-filter-phu-trach-btn" data-filter-key="phu_trach" class="filter-btn text-left px-2 py-1 md:px-3 md:py-2 border rounded-md bg-white w-full md:w-32 text-[10px] md:text-sm">Phụ Trách</button></div>
                    <div class="relative flex-grow md:flex-grow-0"><button id="chi-tiet-filter-yeu-cau-btn" data-filter-key="yeu_cau" class="filter-btn text-left px-2 py-1 md:px-3 md:py-2 border rounded-md bg-white w-full md:w-32 text-[10px] md:text-sm">Yêu Cầu</button></div>
                </div>
                <div class="flex flex-wrap gap-2 items-center w-full md:w-auto justify-end mt-2 md:mt-0">
                    <button id="chi-tiet-reset-filters" class="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md text-[10px] md:text-sm">Xóa Lọc</button>
                    <button id="chi-tiet-btn-settings" class="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2 px-3 rounded-md text-[10px] md:text-sm flex items-center gap-1" title="Cài đặt cột hiển thị">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066-1.543-.94-3.31.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 00 1.066-2.573c-.94-1.543-.826-3.31-2.37-2.37.996.608 2.296.07 2.572-1.065z"></path></svg>
                        <span class="hidden lg:inline">Cài Đặt Cột</span>
                    </button>
                    <button id="chi-tiet-btn-excel" class="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md text-[10px] md:text-sm">Excel</button>
                </div>
            </div>
        </div>
    </div>
    <div class="flex-1 min-h-0 bg-white rounded-lg shadow-md flex flex-col overflow-hidden">
        <div class="table-container min-w-full overflow-auto flex-1">
            <table class="min-w-full border-collapse table-fixed md:table-auto">
                <thead class="bg-gray-200 sticky top-0 z-30"><tr>
                    <th class="px-2 py-3 text-center font-bold text-black uppercase tracking-wider border border-gray-300 w-24">
                        <span class="md:hidden">TG</span><span class="hidden md:inline">Thời Gian</span>
                    </th>
                    <th class="hidden md:table-cell ct-col-ma-kho px-2 py-3 text-center font-bold text-black uppercase tracking-wider border border-gray-300 w-28">Mã Kho</th>
                    <th class="sticky left-0 z-40 bg-gray-200 px-3 py-3 text-center font-bold text-black uppercase tracking-wider border border-gray-300 whitespace-nowrap min-w-max md:whitespace-normal md:min-w-[180px] shadow-[2px_0_5_px_-2px_rgba(0,0,0,0.2)]">Mã NX</th>
                    <th class="hidden md:table-cell ct-col-ma-vach px-2 py-3 text-center font-bold text-black uppercase tracking-wider border border-gray-300 w-64">Code + Lot + EXP</th>
                    <th class="px-2 py-3 text-center font-bold text-black uppercase tracking-wider border border-gray-300 w-32">Mã VT</th>
                    <th class="hidden md:table-cell ct-col-ten-vt px-2 py-3 text-center font-bold text-black uppercase tracking-wider border border-gray-300 min-w-[400px] w-auto">Tên VT</th>
                    <th class="px-2 py-3 text-center font-bold text-black uppercase tracking-wider border border-gray-300 w-24">Lot</th>
                    <th class="px-2 py-3 text-center font-bold text-black uppercase tracking-wider border border-gray-300 w-28">Date</th>
                    <th class="hidden md:table-cell ct-col-yeu-cau px-2 py-3 text-center font-bold text-black uppercase tracking-wider border border-gray-300 w-20">Yêu Cầu</th>
                    <th class="hidden md:table-cell ct-col-nhap px-2 py-3 text-center font-bold text-black uppercase tracking-wider border border-gray-300 w-20">
                        <div>Nhập<span id="chi-tiet-header-nhap-count" class="block font-bold text-green-600 text-[9px] md:text-xs"></span></div>
                    </th>
                    <th class="hidden md:table-cell ct-col-xuat px-2 py-3 text-center font-bold text-black uppercase tracking-wider border border-gray-300 w-20">
                        <div>Xuất<span id="chi-tiet-header-xuat-count" class="block font-bold text-red-600 text-[9px] md:text-xs"></span></div>
                    </th>
                    <th class="md:hidden px-1 py-3 text-center font-bold text-black uppercase tracking-wider border border-gray-300 w-6">
                        SL
                    </th>
                    <th class="hidden md:table-cell ct-col-loai px-2 py-3 text-center font-bold text-black uppercase tracking-wider border border-gray-300 w-28">Loại</th>
                    <th class="px-2 py-3 text-center font-bold text-black uppercase tracking-wider border border-gray-300 w-32">Người YC</th>
                    <th class="hidden md:table-cell ct-col-muc-dich px-2 py-3 text-center font-bold text-black uppercase tracking-wider border border-gray-300 min-w-[300px] w-auto">Mục Đích</th>
                    <th class="hidden md:table-cell ct-col-nganh px-2 py-3 text-center font-bold text-black uppercase tracking-wider border border-gray-300 w-32">Ngành</th>
                    <th class="hidden md:table-cell ct-col-phu-trach px-2 py-3 text-center font-bold text-black uppercase tracking-wider border border-gray-300 w-32">Phụ Trách</th>
                    <th class="px-1 py-3 text-center font-bold text-black uppercase tracking-wider border border-gray-300 w-6 md:w-12 md:sticky md:right-0 md:bg-gray-200 z-30 sticky-action-col-mobile">
                    </th>
                </tr></thead>
                <tbody id="chi-tiet-table-body" class="bg-white"></tbody>
            </table>
        </div>
    </div>
    <div class="flex-shrink-0 flex flex-row justify-between items-center mt-2 md:mt-4 p-2 md:p-4 bg-white rounded-lg shadow-md flex-nowrap overflow-hidden">
        <span id="chi-tiet-pagination-info" class="text-[8px] md:text-sm text-gray-600 mr-1 whitespace-nowrap flex-shrink-0"></span>
        <div id="ct-summary-info" class="flex-grow flex justify-center items-center overflow-hidden no-scrollbar px-1"></div>
        <div class="flex items-center gap-1 flex-nowrap flex-shrink-0">
            <select id="chi-tiet-items-per-page" class="hidden md:block px-3 py-1 border rounded-md bg-white">
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="200">200</option>
                <option value="500">500</option>
            </select>
            <button id="chi-tiet-prev-page" class="px-1.5 py-1 md:px-3 border rounded-md bg-white text-[10px] md:text-sm">
                <svg class="w-3 h-3 md:hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path></svg>
                <span class="hidden md:inline"></span>
            </button>
            <div class="flex items-center gap-0.5 mx-0.5">
                <input type="number" id="chi-tiet-page-input" class="w-7 md:w-16 text-center border rounded-md p-0.5 text-[9px] md:text-sm" value="1" min="1">
                <span id="chi-tiet-total-pages" class="text-[9px] md:text-sm text-gray-700 whitespace-nowrap">/1</span>
            </div>
            <button id="chi-tiet-next-page" class="px-1.5 py-1 md:px-3 border rounded-md bg-white text-[10px] md:text-sm">
                <svg class="w-3 h-3 fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                <span class="hidden md:inline"></span>
            </button>
        </div>
    </div>
`;

const SETTINGS_MODAL_HTML = `
    <div id="chi-tiet-settings-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center modal-backdrop">
        <div class="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 flex flex-col modal-content-custom">
            <div class="p-4 border-b">
                <h3 class="text-lg font-bold text-gray-800">Cài đặt hiển thị cột chi tiết</h3>
                <p class="text-xs text-gray-500 mt-1">Chọn các cột bạn muốn hiển thị trên màn hình máy tính.</p>
            </div>
            <div class="p-6 overflow-y-auto max-h-[60vh]">
                <div id="chi-tiet-column-toggles" class="grid grid-cols-1 gap-4"></div>
            </div>
            <div class="p-4 border-t flex justify-end">
                <button id="chi-tiet-settings-close-btn" class="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-bold shadow-sm">Xong</button>
            </div>
        </div>
    </div>
`;

const getColumnSettingsCT = () => {
    const saved = localStorage.getItem('chiTietColumnSettings');
    if (saved) return JSON.parse(saved);
    return OPTIONAL_COLUMNS_CT.reduce((acc, col) => {
        acc[col.key] = true;
        return acc;
    }, {});
};

const saveColumnSettingsCT = (settings) => {
    localStorage.setItem('chiTietColumnSettings', JSON.stringify(settings));
};

function applyChiTietColumnSettings() {
    const settings = getColumnSettingsCT();
    
    OPTIONAL_COLUMNS_CT.forEach(col => {
        const isVisible = settings[col.key];
        document.querySelectorAll(`.${col.class}`).forEach(el => {
            if (window.innerWidth >= 768) {
                el.classList.toggle('hidden', !isVisible);
                el.classList.toggle('md:table-cell', isVisible);
            } else {
                if (el.classList.contains('md:table-cell')) {
                     el.classList.add('hidden');
                }
            }
        });
    });
}

function openChiTietSettingsModal() {
    const modal = document.getElementById('chi-tiet-settings-modal');
    const container = document.getElementById('chi-tiet-column-toggles');
    const settings = getColumnSettingsCT();

    container.innerHTML = OPTIONAL_COLUMNS_CT.map(col => `
        <label class="flex items-center justify-between p-3 rounded-md bg-gray-50 border hover:bg-gray-100 cursor-pointer">
            <span class="text-sm font-medium text-gray-700">${col.label}</span>
            <input type="checkbox" class="ct-col-toggle-cb w-5 h-5 accent-blue-600" data-key="${col.key}" ${settings[col.key] ? 'checked' : ''}>
        </label>
    `).join('');

    modal.classList.remove('hidden');

    container.querySelectorAll('.ct-col-toggle-cb').forEach(cb => {
        cb.onchange = (e) => {
            const key = e.target.dataset.key;
            settings[key] = e.target.checked;
            saveColumnSettingsCT(settings);
            applyChiTietColumnSettings();
        };
    });
}

function formatDateToDDMMYYYY(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

async function updateChiTietHeaderCounts() {
    const nhapEl = document.getElementById('chi-tiet-header-nhap-count');
    const xuatEl = document.getElementById('chi-tiet-header-xuat-count');
    const bottomSummaryEl = document.getElementById('ct-summary-info');
    
    if (!nhapEl || !xuatEl) return;
    
    [nhapEl, xuatEl].forEach(el => el.textContent = '(...)');
    if (bottomSummaryEl) bottomSummaryEl.innerHTML = '<span class="text-gray-400 font-normal text-[8px] md:text-xs italic">Đang tính toán...</span>';

    try {
        let query = buildChiTietQuery();
        // Lấy ma_nx và ma_vt để đếm duy nhất
        const { data, error } = await query.select('ma_nx, ma_vt, nhap, xuat');
        if (error) throw error;
        
        let totalNhap = 0;
        let totalXuat = 0;
        const uniqueMaNx = new Set();
        const uniqueMaVt = new Set();
        
        if (data && data.length > 0) {
            data.forEach(item => {
                totalNhap += (item.nhap || 0);
                totalXuat += (item.xuat || 0);
                if (item.ma_nx) uniqueMaNx.add(item.ma_nx);
                if (item.ma_vt) uniqueMaVt.add(item.ma_vt);
            });
        }
        
        const nVal = totalNhap.toLocaleString();
        const xVal = totalXuat.toLocaleString();
        const nxCount = uniqueMaNx.size.toLocaleString();
        const vtCount = uniqueMaVt.size.toLocaleString();
        
        nhapEl.textContent = `(${nVal})`;
        xuatEl.textContent = `(${xVal})`;
        
        if (bottomSummaryEl) {
            bottomSummaryEl.innerHTML = `
                <div class="flex items-center gap-1 sm:gap-2 text-[7px] sm:text-[10px] md:text-xs font-bold px-2">
                    <span class="text-green-600 whitespace-nowrap hidden md:inline" title="Số lượng Mã NX ">NX: ${nxCount}</span>
                    <span class="text-gray-200 hidden md:inline">|</span>
                    <span class="text-blue-600 whitespace-nowrap hidden md:inline" title="Số lượng Mã VT ">Mã VT: ${vtCount}</span>
                    <span class="text-gray-200 hidden md:inline">|</span>
                    <span class="text-green-600 whitespace-nowrap">N: ${nVal}</span>
                    <span class="text-gray-200">|</span>
                    <span class="text-red-600 whitespace-nowrap">X: ${xVal}</span>
                    <div class="md:hidden flex items-center gap-0.5 ml-1">
                        <span class="text-green-600">(${nxCount})</span>
                        <span class="text-blue-600">(${vtCount})</span>
                    </div>
                </div>
            `;
        }
    } catch (err) {
        console.error("Error calculating chi tiet summary:", err);
        [nhapEl, xuatEl].forEach(el => el.textContent = '(lỗi)');
        if (bottomSummaryEl) bottomSummaryEl.innerHTML = '<span class="text-red-500 text-[8px] md:text-xs">Lỗi tính toán</span>';
    }
}

function buildChiTietQuery() {
    const state = viewStates['view-chi-tiet'];
    let query = sb.from('chi_tiet').select('*', { count: 'exact' });

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

    if (state.searchTerm) query = query.or(`ma_kho.ilike.%${state.searchTerm}%,ma_nx.ilike.%${state.searchTerm}%,ma_vach.ilike.%${state.searchTerm}%,ma_vt.ilike.%${state.searchTerm}%,ten_vt.ilike.%${state.searchTerm}%,lot.ilike.%${state.searchTerm}%,loai.ilike.%${state.searchTerm}%,yeu_cau.ilike.%${state.searchTerm}%,muc_dich.ilike.%${state.searchTerm}%,nganh.ilike.%${state.searchTerm}%,phu_trach.ilike.%${state.searchTerm}%`);
    if (state.filters.from_date) query = query.gte('thoi_gian', state.filters.from_date);
    if (state.filters.to_date) query = query.lte('thoi_gian', state.filters.to_date);

    if (state.filters.loai?.length > 0) {
        let orConditions = [];
        if (state.filters.loai.includes('Nhập')) orConditions.push('ma_nx.ilike.%RO%');
        if (state.filters.loai.includes('Xuất')) orConditions.push('ma_nx.ilike.%DO%');
        if (orConditions.length > 0) query = query.or(orConditions.join(','));
    }

    if (state.filters.ma_kho?.length > 0) query = query.in('ma_kho', state.filters.ma_kho);
    if (state.filters.ma_nx?.length > 0) query = query.in('ma_nx', state.filters.ma_nx);
    if (state.filters.ma_vt?.length > 0) query = query.in('ma_vt', state.filters.ma_vt);
    if (state.filters.lot?.length > 0) query = query.in('lot', state.filters.lot);
    if (state.filters.nganh?.length > 0) query = query.in('nganh', state.filters.nganh);
    if (state.filters.phu_trach?.length > 0) query = query.in('phu_trach', state.filters.phu_trach);
    if (state.filters.yeu_cau?.length > 0) query = query.in('yeu_cau', state.filters.yeu_cau);
    
    return query;
}

export async function fetchChiTiet(page = viewStates['view-chi-tiet'].currentPage, showLoader = true) {
    if (showLoader) showLoading(true);
    try {
        viewStates['view-chi-tiet'].currentPage = page;
        const state = viewStates['view-chi-tiet'];
        
        const { itemsPerPage } = state;
        const from = (page - 1) * itemsPerPage;
        const to = from + itemsPerPage - 1;

        const query = buildChiTietQuery().order('thoi_gian', { ascending: false }).order('ma_nx', { ascending: true }).order('stt', { ascending: true }).range(from, to);
        
        const [queryResult, _] = await Promise.all([
            query,
            updateChiTietHeaderCounts()
        ]);

        const { data, error, count } = queryResult;
        
        if (error) {
            showToast("Không thể tải dữ liệu chi tiết.", 'error');
        } else {
            state.totalFilteredCount = count;
            cache.chiTietList = data;
            
            renderChiTietTable(data);
            applyChiTietColumnSettings();
            renderPagination('chi-tiet', count, from, to);
            updateMobileFilterIconStatus('chi-tiet');
        }
    } finally {
        if (showLoader) showLoading(false);
    }
}

function renderChiTietTable(data) {
    const tableBody = document.getElementById('chi-tiet-table-body');
    if (!tableBody) return;

    if (data && data.length > 0) {
        tableBody.innerHTML = data.map(ct => {
            const maNxRaw = ct.ma_nx || '';
            const maNxClass = maNxRaw.endsWith('-') ? 'text-yellow-600 font-semibold' : 'text-green-600 font-semibold';
            
            // Tô màu chữ DO và RO
            const maNxFormatted = maNxRaw
                .replace(/DO/g, '<span class="text-red-600 font-bold">DO</span>')
                .replace(/RO/g, '<span class="text-green-600 font-bold">RO</span>');

            const displaySLValue = ct.nhap > 0 ? ct.nhap : (ct.xuat > 0 ? ct.xuat : 0);
            const slColorClass = ct.nhap > 0 ? 'text-green-600' : (ct.xuat > 0 ? 'text-red-600' : 'text-gray-400');
            const slPrefix = ct.nhap > 0 ? '+' : (ct.xuat > 0 ? '-' : '');

            return `
            <tr class="hover:bg-gray-50 border-b border-gray-200 text-gray-900">
                <td class="px-2 py-2 border-r border-gray-300 text-center whitespace-nowrap">${formatDateToDDMMYYYY(ct.thoi_gian)}</td>
                <td class="hidden md:table-cell ct-col-ma-kho px-2 py-2 border-r border-gray-300 text-center whitespace-nowrap" title="${ct.ma_kho}">${ct.ma_kho}</td>
                <td class="sticky left-0 z-10 bg-white px-3 py-2 border-r border-gray-300 text-center shadow-[2px_0_5px_-2px_rgba(0,0,0,0.2)] whitespace-nowrap min-w-max md:whitespace-normal md:min-w-[180px] w-auto">
                    <div class="flex items-center justify-between gap-1.5 w-full">
                        <span class="${maNxClass}" title="${maNxRaw}">${maNxFormatted}</span>
                        <button class="copy-ma-nx-btn p-1 text-gray-300 hover:text-blue-500 transition-colors" data-ma-nx="${maNxRaw}" title="Copy Mã NX">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                        </button>
                    </div>
                </td>
                <td class="hidden md:table-cell ct-col-ma-vach px-2 py-2 border-r border-gray-300 text-left whitespace-nowrap" title="${ct.ma_vach}">${ct.ma_vach}</td>
                <td class="px-2 py-2 border-r border-gray-300 text-left cursor-pointer text-blue-600 hover:underline ma-vt-cell whitespace-nowrap" title="${ct.ma_vt}">${ct.ma_vt}</td>
                <td class="hidden md:table-cell ct-col-ten-vt px-2 py-2 border-r border-gray-300 text-left min-w-[400px]" title="${ct.ten_vt}">
                    <div class="line-clamp-2 break-words">${ct.ten_vt}</div>
                </td>
                <td class="px-2 py-2 border-r border-gray-300 text-center whitespace-nowrap">${ct.lot || ''}</td>
                <td class="px-2 py-2 border-r border-gray-300 text-center whitespace-nowrap">${ct.date || ''}</td>
                <td class="hidden md:table-cell ct-col-yeu-cau px-2 py-2 border-r border-gray-300 text-center font-bold whitespace-nowrap">${ct.yc_sl || 0}</td>
                <td class="hidden md:table-cell ct-col-nhap px-2 py-2 border-r border-gray-300 text-center text-green-600 font-bold whitespace-nowrap">${ct.nhap || 0}</td>
                <td class="hidden md:table-cell ct-col-xuat px-2 py-2 border-r border-gray-300 text-center text-red-600 font-bold whitespace-nowrap">${ct.xuat || 0}</td>
                
                <td class="md:hidden px-1 py-2 border-r border-gray-300 text-center font-bold whitespace-nowrap ${slColorClass}">${slPrefix}${displaySLValue}</td>
                
                <td class="hidden md:table-cell ct-col-loai px-2 py-2 border-r border-gray-300 text-center whitespace-nowrap">${ct.loai || ''}</td>
                <td class="px-2 py-2 border-r border-gray-300 text-center whitespace-nowrap" title="${ct.yeu_cau || ''}">${ct.yeu_cau || ''}</td>
                <td class="hidden md:table-cell ct-col-muc-dich px-2 py-2 border-r border-gray-300 text-left min-w-[300px]" title="${ct.muc_dich || ''}">
                    <div class="line-clamp-2 break-words">${ct.muc_dich || ''}</div>
                </td>
                <td class="hidden md:table-cell ct-col-nganh px-2 py-2 border-r border-gray-300 text-center whitespace-nowrap" title="${ct.nganh || ''}">${ct.nganh || ''}</td>
                <td class="hidden md:table-cell ct-col-phu-trach px-2 py-2 border-r border-gray-300 text-center whitespace-nowrap" title="${ct.phu_trach || ''}">${ct.phu_trach || ''}</td>
                <td class="px-1 py-2 border-r border-gray-300 text-center whitespace-nowrap md:sticky md:right-0 md:bg-white z-10 sticky-action-col-mobile">
                    <button class="text-gray-400 hover:text-indigo-600 p-1 rounded-full hover:bg-gray-100 ct-open-action-menu" data-ct-id="${ct.id}">
                        <svg class="w-2.5 h-2.5 md:w-5 md:h-5 mx-auto" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"></path></svg>
                    </button>
                </td>
            </tr>
        `}).join('');
    } else {
        tableBody.innerHTML = '<tr><td colspan="18" class="text-center py-4">Không có dữ liệu</td></tr>';
    }
}

function closeActionPopover() {
    if (activeActionPopover) {
        activeActionPopover.remove();
        document.removeEventListener('click', closeActionPopover);
        activeActionPopover = null;
    }
}

function openActionMenu(e, button) {
    e.stopPropagation(); 
    
    // Logic Toggle cho menu chi tiết
    if (activeActionPopover) {
        const isSameButton = activeActionPopover._trigger === button;
        activeActionPopover.remove();
        activeActionPopover = null;
        if (isSameButton) return;
    }
    
    const ctId = String(button.dataset.ctId || '').trim();
    if (!ctId) return;

    const ct = cache.chiTietList.find(i => String(i.id).trim() === ctId);
    if (!ct) {
        showToast("Không tìm thấy dữ liệu dòng này.", "error");
        return;
    }

    const template = document.getElementById('chi-tiet-action-menu-template');
    const popover = template.content.cloneNode(true).querySelector('.action-popover');
    popover._trigger = button; // Lưu nút kích hoạt
    document.body.appendChild(popover);

    const rect = button.getBoundingClientRect();
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile) {
        popover.style.position = 'fixed';
        popover.style.right = '10px';
        popover.style.top = `${rect.bottom + 5}px`;
    } else {
        popover.style.position = 'fixed';
        popover.style.left = `${rect.left - 120}px`;
        popover.style.top = `${rect.bottom + 5}px`;
    }

    popover.querySelector('.ct-action-view-purpose').onclick = () => {
        openDetailVtModal(ct, true);
        popover.remove(); activeActionPopover = null;
    };

    popover.querySelector('.ct-action-edit-vt').onclick = () => {
        openDetailVtModal(ct, false);
        popover.remove(); activeActionPopover = null;
    };

    activeActionPopover = popover;

    const closeHandler = (event) => {
        if (popover.contains(event.target) || event.target === button) return;
        popover.remove();
        if (activeActionPopover === popover) activeActionPopover = null;
        document.removeEventListener('click', closeHandler);
    };
    
    setTimeout(() => document.addEventListener('click', closeHandler), 0);
}

async function fetchNameSuggestions() {
    try {
        const [usersRes, chiTietRes] = await Promise.all([
            sb.from('user').select('ho_ten'),
            sb.from('chi_tiet').select('yeu_cau')
        ]);
        
        const names = new Set();
        (usersRes.data || []).forEach(u => names.add(u.ho_ten));
        (chiTietRes.data || []).forEach(ct => names.add(ct.yeu_cau));
        
        nameSuggestionsCache = Array.from(names).filter(Boolean).map(n => ({ name: n })).sort((a,b) => a.name.localeCompare(b.name));
    } catch (err) {
        console.error("Error fetching name suggestions:", err);
    }
}

/**
 * Làm mới dữ liệu cho modal phân bổ đang mở (Dùng cho Realtime)
 */
export async function refreshCurrentDetailVtModal() {
    if (!currentDistributingItem) return;
    
    // NÂNG CẤP: Sử dụng String ID an toàn
    const cleanId = String(currentDistributingItem.id).trim();
    const { data, error } = await sb.from('chi_tiet_vt').select('*').eq('id_ct', cleanId).order('created_at', { ascending: true });
    
    if (!error && data) {
        const isFocusing = document.querySelector('#chi-tiet-vt-table-body input:focus, #chi-tiet-vt-table-body textarea:focus');
        if (!isFocusing) {
            detailVtItems = data;
            initialDetailVtItems = JSON.parse(JSON.stringify(data));
            const isReadOnly = document.getElementById('save-ct-vt-btn').classList.contains('hidden');
            renderDetailVtRows(isReadOnly);
            renderHistory();
        }
    }
}

/**
 * Gán các sự kiện cố định cho Modal Phân bổ chi tiết.
 * Cần chạy hàm này một lần duy nhất.
 */
function ensureModalListenersAttached() {
    if (isModalListenersInitialized) return;

    const closeBtn = document.getElementById('close-ct-vt-modal');
    if (closeBtn) closeBtn.onclick = () => {
        currentDistributingItem = null;
        document.getElementById('chi-tiet-vt-modal').classList.add('hidden');
    };
    
    const cancelBtn = document.getElementById('cancel-ct-vt-btn');
    if (cancelBtn) cancelBtn.onclick = () => {
        currentDistributingItem = null;
        document.getElementById('chi-tiet-vt-modal').classList.add('hidden');
    };
    
    const addBtn = document.getElementById('add-ct-vt-row-btn');
    if (addBtn) addBtn.onclick = () => {
        if (!currentDistributingItem) return;
        const newItem = {
            id: crypto.randomUUID(),
            id_ct: String(currentDistributingItem.id).trim(), // Ép kiểu string ID
            nguoi_nhan: '',
            sl: 0,
            dia_diem: '',
            ghi_chu: '',
            trang_thai: '', 
            lich_su: '',
            created_at: new Date().toISOString(),
            is_new: true 
        };
        detailVtItems.push(newItem);
        renderDetailVtRows(false);
    };

    const saveBtn = document.getElementById('save-ct-vt-btn');
    if (saveBtn) saveBtn.onclick = async () => {
        if (!currentDistributingItem) return;
        const currentActiveSum = detailVtItems.reduce((s, i) => i.trang_thai !== 'Xóa' ? s + (parseFloat(i.sl) || 0) : s, 0);
        const original = parseFloat(document.getElementById('ct-vt-original-qty').textContent) || 0;

        if (currentActiveSum > original) {
            showToast("Tổng số lượng không được vượt quá số gốc.", 'error');
            return;
        }

        showLoading(true);
        try {
            const nowStr = new Date().toLocaleString('vi-VN');
            const currentUserLabel = currentUser.ho_ten || 'Admin';
            const cleanIdCt = String(currentDistributingItem.id).trim();

            const finalDataToSave = detailVtItems.map(item => {
                const initialItem = initialDetailVtItems.find(it => String(it.id).trim() === String(item.id).trim());
                let logs = item.lich_su || '';

                if (!initialItem) {
                    if (item.trang_thai !== 'Xóa') {
                        const log = `${currentUserLabel} thêm mới người nhận [${item.nguoi_nhan || 'N/A'}]: SL ${item.sl} tại ${item.dia_diem || 'N/A'} lúc ${nowStr}`;
                        logs = logs ? `${logs}\n${log}` : log;
                    }
                    item.created_at = new Date().toISOString(); 
                } else {
                    const hasNameChanged = initialItem.nguoi_nhan !== item.nguoi_nhan;
                    const hasSlChanged = parseFloat(initialItem.sl) !== parseFloat(item.sl);
                    const hasPlaceChanged = initialItem.dia_diem !== item.dia_diem;
                    const hasNoteChanged = initialItem.ghi_chu !== item.ghi_chu;
                    const hasStatusChanged = initialItem.trang_thai !== item.trang_thai;

                    if (hasNameChanged || hasSlChanged || hasPlaceChanged || hasNoteChanged || hasStatusChanged) {
                        let changes = [];
                        if (hasNameChanged) changes.push(`Tên: ${initialItem.nguoi_nhan || 'Trống'} -> ${item.nguoi_nhan || 'Trống'}`);
                        if (hasSlChanged) changes.push(`SL: ${initialItem.sl} -> ${item.sl}`);
                        if (hasPlaceChanged) changes.push(`Địa điểm: ${initialItem.dia_diem || 'Trống'} -> ${item.dia_diem || 'Trống'}`);
                        if (hasNoteChanged) changes.push(`Ghi chú: ${initialItem.ghi_chu || 'Trống'} -> ${item.ghi_chu || 'Trống'}`);
                        
                        if (!hasStatusChanged && (hasNameChanged || hasSlChanged || hasPlaceChanged || hasNoteChanged)) {
                            const log = `${currentUserLabel} cập nhật dòng [${item.nguoi_nhan || 'N/A'}]: ${changes.join(', ')} lúc ${nowStr}`;
                            logs = logs ? `${logs}\n${log}` : log;
                        }
                    }
                    item.created_at = new Date().toISOString();
                }

                return {
                    id: String(item.id).trim(),
                    id_ct: cleanIdCt,
                    nguoi_nhan: item.nguoi_nhan,
                    sl: item.sl,
                    dia_diem: item.dia_diem,
                    ghi_chu: item.ghi_chu,
                    trang_thai: item.trang_thai || '',
                    lich_su: logs,
                    created_at: item.created_at
                };
            });

            // Xóa cũ thêm mới dựa trên Text ID an toàn
            const { error: deleteError } = await sb.from('chi_tiet_vt').delete().eq('id_ct', cleanIdCt);
            if (deleteError) throw deleteError;

            if (finalDataToSave.length > 0) {
                const { error: insertError } = await sb.from('chi_tiet_vt').insert(finalDataToSave);
                if (insertError) throw insertError;
            }

            showToast("Lưu phân bổ thành công!", 'success');
            document.getElementById('chi-tiet-vt-modal').classList.add('hidden');
        } catch (err) {
            showToast("Lỗi khi lưu dữ liệu: " + err.message, 'error');
        } finally {
            showLoading(false);
        }
    };

    isModalListenersInitialized = true;
}

export async function openDetailVtModal(ct, isReadOnly = false) {
    if (!ct || !ct.id) return; 
    
    ensureModalListenersAttached();
    
    currentDistributingItem = ct;
    const cleanId = String(ct.id).trim(); // Text ID an toàn
    const modal = document.getElementById('chi-tiet-vt-modal');
    const headerEl = document.getElementById('ct-vt-info-header');
    const originalQtyEl = document.getElementById('ct-vt-original-qty');
    
    if (headerEl) {
        headerEl.innerHTML = `
            <div class="flex flex-col gap-1 md:gap-1.5 overflow-hidden">
                <div class="text-[11px] md:text-lg font-black flex items-center gap-1.5 whitespace-nowrap overflow-x-auto no-scrollbar">
                    <span class="text-gray-800 uppercase tracking-tight flex-shrink-0">Phân bổ:</span>
                    <span class="text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 flex-shrink-0">${ct.ma_vt} - ${ct.lot || 'No LOT'} - ${ct.date || 'No Date'}</span>
                </div>
                <div class="text-[9px] md:text-sm font-bold text-gray-500 flex items-center gap-2 whitespace-nowrap overflow-x-auto no-scrollbar">
                    <span class="text-gray-700 flex-shrink-0">${formatDateToDDMMYYYY(ct.thoi_gian)}</span>
                    <span class="w-1 h-1 rounded-full bg-gray-300 flex-shrink-0"></span>
                    <span class="text-indigo-600 flex-shrink-0">${ct.ma_nx}</span>
                    <span class="w-1 h-1 rounded-full bg-gray-300 flex-shrink-0"></span>
                    <span class="flex-shrink-0">Y/c: <span class="text-gray-800 underline underline-offset-2">${ct.yeu_cau || 'N/A'}</span></span>
                </div>
                <div class="text-[9px] md:text-xs text-gray-400 mt-1 bg-gray-50 p-1.5 rounded border border-gray-100 italic line-clamp-2" title="${ct.muc_dich || ''}">
                    Mục đích: <span class="text-gray-600 not-italic font-medium">${ct.muc_dich || 'Không có'}</span>
                </div>
            </div>
        `;
    }
    
    const qty = ct.nhap || ct.xuat || 0;
    if (originalQtyEl) originalQtyEl.textContent = qty;

    const saveBtn = document.getElementById('save-ct-vt-btn');
    const addBtn = document.getElementById('add-ct-vt-row-btn');
    
    if (isReadOnly) {
        if (saveBtn) saveBtn.classList.add('hidden');
        if (addBtn) addBtn.classList.add('hidden');
        document.querySelectorAll('.ct-vt-col-delete').forEach(el => el.classList.add('hidden'));
    } else {
        if (saveBtn) saveBtn.classList.remove('hidden');
        if (addBtn) addBtn.classList.remove('hidden');
        document.querySelectorAll('.ct-vt-col-delete').forEach(el => el.classList.remove('hidden'));
    }

    showLoading(true);
    try {
        await fetchNameSuggestions();
        // NÂNG CẤP: Ép kiểu Text ID trong query
        const { data, error } = await sb.from('chi_tiet_vt').select('*').eq('id_ct', cleanId).order('created_at', { ascending: true });
        if (error) throw error;
        
        detailVtItems = data || [];
        initialDetailVtItems = JSON.parse(JSON.stringify(detailVtItems)); 
        
        renderDetailVtRows(isReadOnly);
        renderHistory(); 
        if (modal) modal.classList.remove('hidden');
    } catch (err) {
        showToast(`Lỗi xác thực dữ liệu: ${err.message}`, 'error');
    } finally {
        showLoading(false);
    }
}

function renderHistory() {
    const historyList = document.getElementById('ct-vt-history-list');
    if (!historyList) return;
    
    historyList.innerHTML = '';
    
    let allHistory = [];
    detailVtItems.forEach(item => {
        if (item.lich_su) {
            const logs = item.lich_su.split('\n').filter(Boolean);
            logs.forEach((log, index) => {
                allHistory.push({
                    id: String(item.id).trim(),
                    text: log,
                    time: new Date(new Date(item.created_at || Date.now()).getTime() + (index * 1000)).toISOString(),
                    trangThaiHienTai: item.trang_thai
                });
            });
        }
    });

    if (allHistory.length === 0) {
        historyList.innerHTML = '<p class="text-[10px] md:text-xs text-gray-400 italic">Chưa có lịch sử cập nhật cho mục này.</p>';
        return;
    }

    allHistory.sort((a, b) => new Date(b.time) - new Date(a.time));

    historyList.innerHTML = allHistory.map(log => {
        const isDelete = log.text.includes('đã xóa');
        const isRestore = log.text.includes('đã khôi phục');
        const isAdd = log.text.includes('thêm mới');
        
        let dotColor = 'bg-blue-500';
        if (isDelete) dotColor = 'bg-red-500';
        else if (isAdd) dotColor = 'bg-green-500';

        const showRestoreBtn = isDelete && log.trangThaiHienTai === 'Xóa';
        const restoreBtnHtml = showRestoreBtn ? 
            `<button class="ml-2 text-blue-600 font-bold hover:underline ct-vt-restore-btn" data-id="${log.id}">Khôi phục ngay</button>` : '';
        
        return `
            <div class="flex gap-2 md:gap-3 relative pl-4 border-l-2 border-gray-100 py-1">
                <div class="absolute -left-[7px] top-2 w-3 h-3 rounded-full ${dotColor} border-2 border-white shadow-sm"></div>
                <div class="flex-grow">
                    <p class="text-[9px] md:text-xs text-gray-600 font-medium leading-tight">
                        ${log.text} ${restoreBtnHtml}
                    </p>
                </div>
            </div>
        `;
    }).join('');

    historyList.querySelectorAll('.ct-vt-restore-btn').forEach(btn => {
        btn.onclick = (e) => {
            const id = e.target.dataset.id;
            handleRestoreItem(id);
        };
    });
}

function handleRestoreItem(id) {
    const item = detailVtItems.find(it => String(it.id).trim() === String(id).trim());
    if (!item) return;

    const originalQty = parseFloat(document.getElementById('ct-vt-original-qty').textContent) || 0;
    const currentActiveSum = detailVtItems.reduce((s, i) => i.trang_thai !== 'Xóa' ? s + (parseFloat(i.sl) || 0) : s, 0);
    const itemQty = parseFloat(item.sl) || 0;

    if (currentActiveSum + itemQty > originalQty) {
        showToast(`Không thể khôi phục! Tổng SL (${currentActiveSum + itemQty}) vượt quá SL gốc (${originalQty}).`, 'error');
        return;
    }

    const nowStr = new Date().toLocaleString('vi-VN');
    const currentUserLabel = currentUser.ho_ten || 'Admin';
    const log = `${currentUserLabel} đã khôi phục: người nhận [${item.nguoi_nhan || 'Trống'}]: SL ${item.sl} lúc ${nowStr}`;
    
    item.trang_thai = ''; 
    item.lich_su = item.lich_su ? `${item.lich_su}\n${log}` : log;
    item.created_at = new Date().toISOString(); 
    
    const isReadOnly = document.getElementById('save-ct-vt-btn').classList.contains('hidden');
    renderDetailVtRows(isReadOnly);
    renderHistory();
    showToast("Đã khôi phục hàng!", 'success');
}

function renderDetailVtRows(isReadOnly = false) {
    const tbody = document.getElementById('chi-tiet-vt-table-body');
    const emptyState = document.getElementById('ct-vt-empty-state');
    const distributedEl = document.getElementById('ct-vt-distributed-qty');
    const originalQtyEl = document.getElementById('ct-vt-original-qty');
    const originalQty = originalQtyEl ? (parseFloat(originalQtyEl.textContent) || 0) : 0;
    
    if (!tbody) return;
    tbody.innerHTML = '';
    let totalDist = 0;

    const visibleItems = detailVtItems.filter(it => it.trang_thai !== 'Xóa');

    if (visibleItems.length === 0) {
        if (emptyState) emptyState.classList.remove('hidden');
    } else {
        if (emptyState) emptyState.classList.add('hidden');
        visibleItems.forEach((item) => {
            const actualIndex = detailVtItems.findIndex(it => String(it.id).trim() === String(item.id).trim());
            
            totalDist += (parseFloat(item.sl) || 0);
            const row = document.createElement('tr');
            row.className = "hover:bg-gray-50 transition-colors border-b";
            
            row.innerHTML = `
                <td class="border p-0 relative">
                    <input type="text" class="w-full p-2 border-none bg-transparent text-[11px] md:text-sm font-medium vt-input-nguoi-nhan text-center md:text-left" value="${item.nguoi_nhan || ''}" placeholder="..." ${isReadOnly ? 'readonly' : ''}>
                </td>
                <td class="border p-0">
                    <input type="number" class="w-full p-1 border-none bg-transparent text-[11px] md:text-sm font-black text-blue-700 vt-input-sl text-center" value="${item.sl || 0}" step="1" min="0" ${isReadOnly ? 'readonly' : ''}>
                </td>
                <td class="border p-0">
                    <textarea class="w-full p-2 border-none bg-transparent text-[10px] md:text-sm vt-input-dia-diem resize-none line-clamp-2 h-[42px] leading-tight focus:line-clamp-none focus:h-auto cursor-pointer" placeholder="..." ${isReadOnly ? 'readonly' : ''}>${item.dia_diem || ''}</textarea>
                </td>
                <td class="border p-0">
                    <textarea class="w-full p-2 border-none bg-transparent text-[10px] md:text-sm vt-input-ghi-chu resize-none line-clamp-2 h-[42px] leading-tight focus:line-clamp-none focus:h-auto cursor-pointer" placeholder="..." ${isReadOnly ? 'readonly' : ''}>${item.ghi_chu || ''}</textarea>
                </td>
                <td class="border p-0 text-center ct-vt-col-delete ${isReadOnly ? 'hidden' : ''}">
                    <button class="text-red-400 hover:text-red-600 vt-delete-row-btn p-1.5 transition-transform active:scale-125" data-id="${item.id}">
                        <svg class="w-4 h-4 md:w-5 md:h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                </td>
            `;
            
            if (!isReadOnly) {
                const nameInput = row.querySelector('.vt-input-nguoi-nhan');
                const handleNameSearch = () => {
                    const val = nameInput.value.toLowerCase();
                    const suggestions = nameSuggestionsCache.filter(item => 
                        item.name.toLowerCase().includes(val)
                    );
                    openAutocomplete(nameInput, suggestions, {
                        valueKey: 'name',
                        primaryTextKey: 'name',
                        onSelect: (val) => {
                            nameInput.value = val;
                            detailVtItems[actualIndex].nguoi_nhan = val;
                        }
                    });
                };
                nameInput.onfocus = handleNameSearch;
                nameInput.oninput = handleNameSearch;

                const slInput = row.querySelector('.vt-input-sl');
                slInput.oninput = (e) => {
                    let newValue = parseFloat(e.target.value) || 0;
                    if (newValue < 0) newValue = 0;
                    const otherRowsSum = detailVtItems.reduce((sum, it) => (String(it.id).trim() !== String(item.id).trim() && it.trang_thai !== 'Xóa') ? sum + (parseFloat(it.sl) || 0) : sum, 0);
                    const maxAllowed = originalQty - otherRowsSum;
                    if (newValue > maxAllowed) {
                        newValue = maxAllowed;
                        e.target.value = newValue;
                        showToast(`Tổng số lượng không được vượt quá ${originalQty}`, 'info');
                    }
                    detailVtItems[actualIndex].sl = newValue;
                    updateLiveTotal();
                };

                const diaDiemInput = row.querySelector('.vt-input-dia-diem');
                const ghiChuInput = row.querySelector('.vt-input-ghi-chu');
                diaDiemInput.oninput = (e) => detailVtItems[actualIndex].dia_diem = e.target.value;
                ghiChuInput.oninput = (e) => detailVtItems[actualIndex].ghi_chu = e.target.value;

                const showToastIfTruncated = (el, prefix) => {
                    if (el.scrollHeight > el.clientHeight) showToast(`${prefix}: ${el.value}`, 'info');
                };
                diaDiemInput.onclick = (e) => showToastIfTruncated(e.target, 'Địa điểm');
                ghiChuInput.onclick = (e) => showToastIfTruncated(e.target, 'Ghi chú');

                row.querySelector('.vt-delete-row-btn').onclick = (e) => {
                    const id = e.currentTarget.dataset.id;
                    handleDeleteItem(id);
                };
            } else {
                const diaDiemInput = row.querySelector('.vt-input-dia-diem');
                const ghiChuInput = row.querySelector('.vt-input-ghi-chu');
                if (diaDiemInput) diaDiemInput.onclick = (e) => { if (e.target.scrollHeight > e.target.clientHeight) showToast(`Địa điểm: ${e.target.value}`, 'info'); };
                if (ghiChuInput) ghiChuInput.onclick = (e) => { if (e.target.scrollHeight > e.target.clientHeight) showToast(`Ghi chú: ${e.target.value}`, 'info'); };
            }

            tbody.appendChild(row);
        });
    }
    
    function updateLiveTotal() {
        if (!distributedEl) return;
        const currentSum = detailVtItems.reduce((s, i) => i.trang_thai !== 'Xóa' ? s + (parseFloat(i.sl) || 0) : s, 0);
        distributedEl.textContent = currentSum;
        distributedEl.className = currentSum > originalQty ? 'font-black text-red-600' : 'font-black text-green-700';
    }
    updateLiveTotal();
}

function handleDeleteItem(id) {
    const actualIndex = detailVtItems.findIndex(it => String(it.id).trim() === String(id).trim());
    if (actualIndex === -1) return;

    const item = detailVtItems[actualIndex];
    const nowStr = new Date().toLocaleString('vi-VN');
    const currentUserLabel = currentUser.ho_ten || 'Admin';
    const log = `${currentUserLabel} đã xóa: người nhận [${item.nguoi_nhan || 'Trống'}]: SL ${item.sl} tại ${item.dia_diem || 'Trống'} lúc ${nowStr}`;

    item.trang_thai = 'Xóa';
    item.lich_su = item.lich_su ? `${item.lich_su}\n${log}` : log;
    item.created_at = new Date().toISOString(); 
    
    const saveBtn = document.getElementById('save-ct-vt-btn');
    const isReadOnly = saveBtn ? saveBtn.classList.contains('hidden') : true;
    renderDetailVtRows(isReadOnly);
    renderHistory();
}

async function handleExcelExport() {
    const modal = document.getElementById('excel-export-modal');
    if (modal) modal.classList.remove('hidden');

    const exportAndClose = async (exportAll) => {
        if (modal) modal.classList.add('hidden');
        showLoading(true);
        try {
            const query = exportAll ? sb.from('chi_tiet').select('*') : buildChiTietQuery().select('*');
            const { data, error } = await query.order('thoi_gian', { ascending: false }).limit(50000);
            
            if (error) throw error;
            if (!data || data.length === 0) {
                showToast("Không có dữ liệu để xuất.", 'info');
                return;
            }

            // --- NÂNG CẤP: Định dạng cột Thời Gian trước khi tạo file Excel ---
            const formattedData = data.map(item => ({
                ...item,
                thoi_gian: formatDateToDDMMYYYY(item.thoi_gian)
            }));

            const worksheet = XLSX.utils.json_to_sheet(formattedData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "ChiTiet");
            XLSX.writeFile(workbook, `ChiTietGiaoDich_${new Date().toISOString().slice(0,10)}.xlsx`);
            showToast("Xuất Excel thành công!", 'success');
        } catch (err) {
            showToast(`Lỗi khi xuất Excel: ${err.message}`, 'error');
        } finally {
            showLoading(false);
        }
    };
    
    const filterBtn = document.getElementById('excel-export-filtered-btn');
    const allBtn = document.getElementById('excel-export-all-btn');
    const cancelBtn = document.getElementById('excel-export-cancel-btn');
    
    if (filterBtn) filterBtn.onclick = () => exportAndClose(false);
    if (allBtn) allBtn.onclick = () => exportAndClose(true);
    if (cancelBtn) cancelBtn.onclick = () => modal.classList.add('hidden');
}


async function openChiTietFilterPopover(button, view) {
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
        popover.style.zIndex = '100';
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
        if (selectionCountEl) selectionCountEl.textContent = count > 0 ? `Đã chọn: ${count}` : '';
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
        optionsList.innerHTML = filteredOptions.length > 0 ? filteredOptions.map(option => `
            <label class="flex items-center space-x-2 px-2 py-1 hover:bg-gray-100 rounded">
                <input type="checkbox" value="${option}" class="filter-option-cb" ${tempSelectedOptions.has(String(option)) ? 'checked' : ''}>
                <span class="text-sm">${option}</span>
            </label>
        `).join('') : '<div class="text-center p-4 text-sm text-gray-500">Không có tùy chọn.</div>';
        updateToggleAllButtonState();
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
            const visibleOptions = allOptions.filter(option => option && String(option).toLowerCase().includes(searchTerm));
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
    
    if (filterKey === 'loai') {
        const options = ['Nhập', 'Xuất'];
        renderOptions(options);
        setupEventListeners(options);
        applyBtn.disabled = false;
    } else {
        optionsList.innerHTML = '<div class="text-center p-4 text-sm text-gray-500">Đang tải...</div>';
        applyBtn.disabled = true;
        try {
            const { data, error } = await buildChiTietQuery().select(filterKey);
            if (error) throw error;
            const uniqueOptions = [...new Set(data.map(item => item[filterKey]).filter(Boolean))].sort();
            renderOptions(uniqueOptions);
            setupEventListeners(uniqueOptions);
            applyBtn.disabled = false;
        } catch (error) {
            optionsList.innerHTML = '<div class="text-center p-4 text-sm text-red-500">Lỗi tải bộ lọc.</div>';
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
        const newText = tempSelectedOptions.size > 0 ? `${defaultText} (${tempSelectedOptions.size})` : defaultText;
        button.textContent = newText;
        const mobileBtn = document.getElementById(`${button.id}-mobile`);
        if (mobileBtn) mobileBtn.textContent = newText;
        if(view === 'view-chi-tiet') fetchChiTiet(1);
        popover.remove();
        document.removeEventListener('click', closePopover);
    };
    setTimeout(() => document.addEventListener('click', closePopover), 0);
}

export function initChiTietView() {
    const viewContainer = document.getElementById('view-chi-tiet');
    
    if (!document.getElementById('chi-tiet-search')) {
        viewContainer.innerHTML = VIEW_HTML;
        if (!document.getElementById('chi-tiet-settings-modal')) {
            document.body.insertAdjacentHTML('beforeend', SETTINGS_MODAL_HTML);
        }
    }
    
    applyChiTietColumnSettings();
    ensureModalListenersAttached();

    const handleSearch = debounce(() => {
        const val = (document.getElementById('chi-tiet-search')?.value || document.getElementById('chi-tiet-search-mobile')?.value) || "";
        viewStates['view-chi-tiet'].searchTerm = val;
        fetchChiTiet(1);
    }, 500);

    const searchInput = document.getElementById('chi-tiet-search');
    const searchInputMobile = document.getElementById('chi-tiet-search-mobile');
    if(searchInput) searchInput.addEventListener('input', handleSearch);
    if(searchInputMobile) searchInputMobile.addEventListener('input', handleSearch);

    viewContainer.addEventListener('click', e => {
        const btn = e.target.closest('.filter-btn');
        if (btn) openChiTietFilterPopover(btn, 'view-chi-tiet');
        const actionBtn = e.target.closest('.ct-open-action-menu');
        if (actionBtn) openActionMenu(e, actionBtn); 
    });
    
    const fromDateInputs = [document.getElementById('chi-tiet-filter-from-date'), document.getElementById('chi-tiet-filter-from-date-mobile')];
    const toDateInputs = [document.getElementById('chi-tiet-filter-to-date'), document.getElementById('chi-tiet-filter-to-date-mobile')];

    fromDateInputs.forEach(input => {
        if(input) input.addEventListener('change', e => {
            viewStates['view-chi-tiet'].filters.from_date = e.target.value; 
            fetchChiTiet(1); 
        });
    });
    toDateInputs.forEach(input => {
        if(input) input.addEventListener('change', e => {
            viewStates['view-chi-tiet'].filters.to_date = e.target.value; 
            fetchChiTiet(1); 
        });
    });

    const resetFilters = () => {
        if(searchInput) searchInput.value = '';
        if(searchInputMobile) searchInputMobile.value = '';
        fromDateInputs.forEach(i => i && (i.value = ''));
        toDateInputs.forEach(i => i && (i.value = ''));
        viewStates['view-chi-tiet'].searchTerm = '';
        viewStates['view-chi-tiet'].filters = { from_date: '', to_date: '', loai: [], ma_kho: [], ma_nx: [], ma_vt: [], lot: [], nganh: [], phu_trach: [], yeu_cau: [] };
        document.querySelectorAll('#view-chi-tiet .filter-btn').forEach(btn => {
            const defaultText = filterButtonDefaultTexts[btn.id.replace('-mobile', '')];
            if(defaultText) btn.textContent = defaultText;
        });
        fetchChiTiet(1);
    };

    document.getElementById('chi-tiet-reset-filters')?.addEventListener('click', resetFilters);
    document.getElementById('chi-tiet-reset-filters-mobile')?.addEventListener('click', resetFilters);

    const drawer = document.getElementById('ct-filter-drawer');
    const overlay = document.getElementById('ct-filter-drawer-overlay');
    const toggleBtn = document.getElementById('ct-mobile-filter-toggle');
    const closeBtn = document.getElementById('ct-filter-drawer-close');

    const toggleDrawer = (show) => {
        if (show) {
            drawer?.classList.remove('translate-x-full');
            overlay?.classList.remove('hidden');
        } else {
            drawer?.classList.add('translate-x-full');
            overlay?.classList.add('hidden');
        }
    };

    if(toggleBtn) toggleBtn.addEventListener('click', () => toggleDrawer(true));
    if(closeBtn) closeBtn.addEventListener('click', () => toggleDrawer(false));
    if(overlay) overlay.addEventListener('click', () => toggleDrawer(false));
    
    document.getElementById('chi-tiet-btn-excel')?.addEventListener('click', handleExcelExport);
    document.getElementById('chi-tiet-btn-excel-mobile')?.addEventListener('click', handleExcelExport);

    document.getElementById('chi-tiet-btn-settings')?.addEventListener('click', openChiTietSettingsModal);
    document.getElementById('chi-tiet-settings-close-btn')?.addEventListener('click', () => document.getElementById('chi-tiet-settings-modal').classList.add('hidden'));

    const tableBody = document.getElementById('chi-tiet-table-body');
    if(tableBody) {
        tableBody.addEventListener('click', async (e) => {
            const maVtCell = e.target.closest('.ma-vt-cell');
            const copyNxBtn = e.target.closest('.copy-ma-nx-btn');
            if (maVtCell) {
                const ma_vt = maVtCell.textContent.trim();
                const tonKhoState = viewStates['view-ton-kho'];
                tonKhoState.searchTerm = '';
                tonKhoState.filters = { ma_vt: [ma_vt], lot: [], date: [], ton_cuoi: [], tinh_trang: [], nganh: [], phu_trach: [] };
                tonKhoState.stockAvailability = 'all';
                sessionStorage.setItem('tonKhoStockAvailability', 'all');
                await showView('view-ton-kho');
                return;
            }
            if (copyNxBtn) {
                const maNx = copyNxBtn.dataset.maNx;
                try {
                    await navigator.clipboard.writeText(maNx);
                    showToast('Đã copy Mã NX: ' + maNx, 'success');
                } catch (err) { showToast('Lỗi copy Mã NX', 'error'); }
                return;
            }
        });
    }

    document.getElementById('chi-tiet-items-per-page')?.addEventListener('change', (e) => {
        viewStates['view-chi-tiet'].itemsPerPage = parseInt(e.target.value, 10);
        fetchChiTiet(1);
    });

    document.getElementById('chi-tiet-prev-page')?.addEventListener('click', () => fetchChiTiet(viewStates['view-chi-tiet'].currentPage - 1));
    document.getElementById('chi-tiet-next-page')?.addEventListener('click', () => fetchChiTiet(viewStates['view-chi-tiet'].currentPage + 1));
    
    const pageInput = document.getElementById('chi-tiet-page-input');
    if(pageInput) {
        const handlePageJump = () => {
            const state = viewStates['view-chi-tiet'];
            let targetPage = parseInt(pageInput.value, 10);
            const totalPages = Math.ceil(state.totalFilteredCount / state.itemsPerPage);
            if (isNaN(targetPage) || targetPage < 1) targetPage = 1;
            else if (targetPage > totalPages && totalPages > 0) targetPage = totalPages;
            pageInput.value = targetPage;
            if (targetPage !== state.currentPage) fetchChiTiet(targetPage);
        };
        pageInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); handlePageJump(); e.target.blur(); } });
        pageInput.addEventListener('change', handlePageJump);
    }
}
