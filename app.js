
// Khởi tạo đối tượng process giả lập để chứa API Key cho trình duyệt
window.process = {
    env: {
        API_KEY: "AIzaSyDPjEdZPjh8iSqlqikFYSdSpnEc8tbXgQk"
    }
};

const { createClient } = supabase;
const SUPABASE_URL = "https://uefydnefprcannlviimp.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVlZnlkbmVmcHJjYW5ubHZpaW1wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwNTcwMDUsImV4cCI6MjA3NjYzMzAwNX0.X274J_1_crUknJEOT1WWUD1h0HM9WdYScDW2eWWsiLk";
export const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// Import module voice assistant để đăng ký sự kiện ngay lập tức
import './voice-assistant.js';

export let currentUser = null;
let currentView = 'view-phat-trien'; 
let userChannel = null; 
let adminNotificationChannel = null;
let presenceChannel = null;
let dataChannel = null; 
export const onlineUsers = new Map();
export const DEFAULT_AVATAR_URL = 'https://t4.ftcdn.net/jpg/05/49/98/39/360_F_549983970_bRCkYfk0P6PP5fKbMhZMIb07vs1cACai.jpg';
export const PLACEHOLDER_IMAGE_URL = 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Placeholder_view_vector.svg/681px-Placeholder_view_vector.svg.png';
export const cache = {
    userList: [],
    sanPhamList: [],
    tonKhoList: [],
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
        filters: { ma_vt: [], lot: [], date: [], tinh_trang: [], nganh: [], phu_trach: [] },
        stockAvailability: 'available',
        totalFilteredCount: 0,
        paginationText: '',
    },
    'view-chi-tiet': {
        currentPage: 1,
        itemsPerPage: 50,
        searchTerm: '',
        filters: { from_date: '', to_date: '', loai: [], ma_kho: [], ma_nx: [], ma_vt: [], lot: [], nganh: [], phu_trach: [], yeu_cau: [] },
        totalFilteredCount: 0,
        paginationText: '',
    }
};
let isViewInitialized = {
    'view-phat-trien': false,
    'view-san-pham': false,
    'view-ton-kho': false,
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
    'ton-kho-filter-tinh-trang-btn': 'Tình Trạng',
    'ton-kho-filter-nganh-btn': 'Ngành',
    'ton-kho-filter-phu-trach-btn': 'Phụ Trách',
    'chi-tiet-filter-loai-btn': 'Loại',
    'chi-tiet-filter-ma-kho-btn': 'Mã Kho',
    'chi-tiet-filter-ma-nx-btn': 'Mã NX',
    'chi-tiet-filter-ma-vt-btn': 'Mã VT',
    'chi-tiet-filter-lot-btn': 'LOT',
    'chi-tiet-filter-nganh-btn': 'Ngành',
    'chi-tiet-filter-phu-trach-btn': 'Phụ Trách',
    'chi-tiet-filter-yeu-cau-btn': 'Yêu Cầu',
};
let activeAutocompletePopover = null;

/**
 * Theo dõi và cập nhật trạng thái kết nối mạng (Minimalist - ms Only)
 */
function setupNetworkStatusWatcher() {
    const indicator = document.getElementById('network-indicator');
    const speedText = document.getElementById('network-speed-text');
    const arcs = [
        document.getElementById('wifi-arc-1'), // dot
        document.getElementById('wifi-arc-2'),
        document.getElementById('wifi-arc-3'),
        document.getElementById('wifi-arc-4')
    ];

    const updateUI = () => {
        const isOnline = navigator.onLine;
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        
        if (!isOnline) {
            indicator.className = 'flex items-center gap-1.5 px-1 transition-all flex-shrink-0';
            speedText.textContent = 'Offline';
            speedText.className = 'text-[9px] md:text-[11px] font-medium text-red-600 uppercase tracking-tighter';
            arcs.forEach(arc => {
                if (arc) {
                    const color = '#EF4444'; // Red (Offline)
                    if (arc.hasAttribute('fill')) arc.setAttribute('fill', color);
                    if (arc.hasAttribute('stroke')) arc.setAttribute('stroke', color);
                    arc.style.opacity = '1';
                }
            });
            return;
        }

        let rtt = connection ? connection.rtt : 50;

        // Xanh lá (Mạnh: < 150ms) -> Cam (TB: 150-300ms) -> Vàng (Yếu: > 300ms)
        let activeLevel = 1;
        let activeColor = 'rgba(8, 201, 69, 1)'; // Vàng

        if (rtt > 0 && rtt < 150) {
            activeLevel = 4;
            activeColor = '#rgba(8, 201, 69, 1)'; // Xanh lá
        } else if (rtt >= 150 && rtt < 400) {
            activeLevel = 3;
            activeColor = 'rgba(8, 201, 69, 1)'; // Cam
        } else if (rtt >= 400) {
            activeLevel = 2;
            activeColor = '#93770aff'; // Vàng
        }

        // Cập nhật giao diện Online (Mảnh mai, không nền)
        indicator.className = 'flex items-center gap-1.5 px-1 transition-all flex-shrink-0';
        speedText.className = 'text-[9px] md:text-[11px] font-medium uppercase tracking-tighter';
        speedText.style.color = activeColor;
        speedText.textContent = `${rtt} ms`;

        arcs.forEach((arc, index) => {
            if (!arc) return;
            const isActive = index < activeLevel;
            const targetColor = isActive ? activeColor : '#E2E8F0';
            
            if (arc.hasAttribute('fill')) arc.setAttribute('fill', targetColor);
            if (arc.hasAttribute('stroke')) arc.setAttribute('stroke', targetColor);
            arc.style.opacity = isActive ? '1' : '0.3';
        });
    };

    window.addEventListener('online', updateUI);
    window.addEventListener('offline', updateUI);
    if (navigator.connection) {
        navigator.connection.addEventListener('change', updateUI);
    }

    updateUI();
}

// --- OFFLINE QUEUE MANAGEMENT ---
const OFFLINE_QUEUE_KEY = 'offlineQueue';
const getOfflineQueue = () => JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY)) || [];
const saveOfflineQueue = (queue) => localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));

export function openPrintPreviewModal(url, title = 'Xem trước khi in') {
    const modal = document.getElementById('print-preview-modal');
    const iframe = document.getElementById('print-preview-iframe');
    const titleEl = document.getElementById('print-preview-title');
    const maximizeBtn = document.getElementById('print-preview-maximize-btn');

    if (!modal || !iframe || !titleEl || !maximizeBtn) return;
    
    if (window.innerWidth > 768) {
        modal.style.left = '10vw';
        modal.style.top = '5vh';
    } else {
        modal.style.left = '5vw';
        modal.style.top = '5vh';
    }
    modal.style.transform = '';

    iframe.src = url;
    titleEl.textContent = title;
    maximizeBtn.dataset.url = url;
    modal.classList.remove('hidden');
}

export function updateOfflineIndicator() {
    const queue = getOfflineQueue();
    const indicator = document.getElementById('offline-sync-indicator');
    const countEl = document.getElementById('offline-sync-count');
    if (indicator && countEl) {
        if (queue.length > 0) {
            indicator.classList.remove('hidden');
            countEl.textContent = queue.length;
        } else {
            indicator.classList.add('hidden');
        }
    }
}

export async function processOfflineQueue() {
    if (!navigator.onLine) return;
    let queue = getOfflineQueue();
    if (queue.length === 0) return;

    showToast(`Đang đồng bộ ${queue.length} thay đổi offline...`, 'info');
    
    const failedJobs = [];
    for (const job of queue) {
        try {
            showToast(`Dòng đồng bộ offline cũ đã bị gỡ bỏ do chức năng tương ứng không còn tồn tại.`, 'info');
        } catch (error) {
            console.error('Offline sync failed for job:', job.id, error);
            failedJobs.push(job); 
        }
    }

    saveOfflineQueue(failedJobs);
    updateOfflineIndicator();
}

export function addJobToOfflineQueue(job) {
    const queue = getOfflineQueue();
    job.id = job.id || `job-${Date.now()}`;
    queue.push(job);
    saveOfflineQueue(queue);
    updateOfflineIndicator();
}

export const showLoading = (show) => {
    const loader = document.getElementById('loading-bar');
    if (loader) loader.classList.toggle('hidden', !show);
};

export function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    // --- NÂNG CẤP: Chống trùng lặp thông báo trong cùng một thời điểm ---
    const existingToasts = Array.from(container.querySelectorAll('.toast'));
    const isDuplicate = existingToasts.some(t => t.textContent === message && !t.classList.contains('hide'));
    if (isDuplicate) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.style.whiteSpace = 'pre-wrap'; 
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => {
        toast.classList.remove('show');
        toast.classList.add('hide');
        toast.addEventListener('transitionend', () => toast.remove());
    }, 4000); 
}

export function showConfirm(message, title = 'Xác nhận hành động') {
    return new Promise(resolve => {
        const modal = document.getElementById('confirm-modal');
        const titleEl = document.getElementById('confirm-title');
        const messageEl = document.getElementById('confirm-message');
        const okBtn = document.getElementById('confirm-ok-btn');
        const cancelBtn = document.getElementById('confirm-cancel-btn');

        if (!modal || !titleEl || !messageEl || !okBtn || !cancelBtn) {
            resolve(confirm(message));
            return;
        }

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
            func.apply(null, args);
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
    const avatar = document.getElementById('sidebar-avatar');
    if (avatar) avatar.src = url || DEFAULT_AVATAR_URL;
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
            const defaultText = filterButtonDefaultTexts[btn.id.replace('-mobile', '')] || 'Filter';
            
            if (Array.isArray(selectedOptions)) {
                const newText = selectedOptions.length > 0 ? `${defaultText} (${selectedOptions.length})` : defaultText;
                btn.textContent = newText;
                const mobileBtn = document.getElementById(`${btn.id.replace('-mobile', '')}-mobile`);
                if(mobileBtn) mobileBtn.textContent = newText;
            }
        }
    });
}

/**
 * Cập nhật trạng thái "sáng" cho nút bộ lọc mobile khi có dữ liệu lọc/search
 */
export function updateMobileFilterIconStatus(viewPrefix) {
    const state = viewStates[`view-${viewPrefix}`];
    const btnIdMap = {
        'san-pham': 'sp-mobile-filter-toggle',
        'ton-kho': 'tk-mobile-filter-toggle',
        'chi-tiet': 'ct-mobile-filter-toggle'
    };
    const btnId = btnIdMap[viewPrefix];
    const btn = document.getElementById(btnId);
    if (!btn || !state) return;

    const hasSearch = state.searchTerm && state.searchTerm.trim() !== '';
    const hasFilters = Object.values(state.filters).some(val => {
        if (Array.isArray(val)) return val.length > 0;
        return !!val;
    });

    // Đối với Tồn kho, kiểm tra cả chế độ 'Tất cả' so với mặc định 'Khả dụng'
    let isChanged = hasSearch || hasFilters;
    if (viewPrefix === 'ton-kho' && state.stockAvailability !== 'available') {
        isChanged = true;
    }

    btn.classList.toggle('filter-active-mobile', isChanged);
}

function closeActiveAutocompletePopover() {
    if (activeAutocompletePopover) {
        activeAutocompletePopover.element.remove();
        document.removeEventListener('click', activeAutocompletePopover.closeHandler);
        activeAutocompletePopover = null;
    }
}

/**
 * Cải tiến openAutocomplete để không bị ẩn bởi container overflow và tối ưu Mobile
 */
export function openAutocomplete(inputElement, suggestions, config) {
    closeActiveAutocompletePopover(); 
    if (suggestions.length === 0) return;

    const popoverTemplate = document.getElementById('autocomplete-popover-template');
    if (!popoverTemplate) return;

    const popoverContent = popoverTemplate.content.cloneNode(true);
    const popover = popoverContent.querySelector('div'); 
    const optionsList = popover.querySelector('.autocomplete-options-list');

    // Tối ưu layout Droplist cho di động: Gọn gàng, nhỏ chữ, Primary & Secondary cùng hàng
    optionsList.innerHTML = suggestions.map(item => `
        <div class="px-2.5 py-1.5 cursor-pointer hover:bg-gray-100 autocomplete-option border-b border-gray-50 last:border-0" data-value="${item[config.valueKey]}">
            <div class="flex justify-between items-center pointer-events-none gap-2">
                <p class="text-[11px] md:text-sm font-bold text-gray-800 truncate">${item[config.primaryTextKey]}</p>
                ${config.secondaryTextKey ? `<p class="text-[9px] md:text-xs text-gray-400 italic truncate text-right flex-shrink-0">${item[config.secondaryTextKey] || ''}</p>` : ''}
            </div>
        </div>
    `).join('');

    document.body.appendChild(popover);
    
    const rect = inputElement.getBoundingClientRect();
    const isMobile = window.innerWidth <= 768;
    
    popover.style.position = 'fixed';
    popover.style.left = `${rect.left}px`;
    popover.style.top = `${rect.bottom + 4}px`;
    popover.style.width = isMobile ? `${Math.max(rect.width, 160)}px` : (config.width || `${rect.width}px`);
    popover.style.zIndex = '9999';
    popover.classList.add('shadow-xl', 'rounded-lg', 'border', 'border-gray-200');

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

export function updateTonKhoToggleUI() {
    const toggleAvailableBtn = document.getElementById('ton-kho-toggle-available');
    const toggleAllBtn = document.getElementById('ton-kho-toggle-all');
    if (!toggleAvailableBtn || !toggleAllBtn) return;
    
    const state = viewStates['view-ton-kho'];
    const currentMode = state.stockAvailability || 'available';
    
    if (currentMode === 'available') {
        toggleAvailableBtn.classList.add('bg-white', 'shadow-sm', 'font-semibold');
        toggleAvailableBtn.classList.remove('text-gray-500');
        toggleAllBtn.classList.remove('bg-white', 'shadow-sm', 'font-semibold');
        toggleAllBtn.classList.add('text-gray-500');
    } else {
        toggleAllBtn.classList.add('bg-white', 'shadow-sm', 'font-semibold');
        toggleAllBtn.classList.remove('text-gray-500');
        toggleAvailableBtn.classList.remove('bg-white', 'shadow-sm', 'font-semibold');
        toggleAvailableBtn.classList.add('text-gray-500');
    }
}

export async function openTonKhoFilterPopover(button, view) {
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
            _ton_cuoi_filter: state.stockAvailability === 'available' ? ['Còn Hàng'] : [],
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
        
        if(view === 'view-ton-kho') {
            const { fetchTonKho } = await import('./tonkho.js');
            fetchTonKho(1);
        }
        
        popover.remove();
        document.removeEventListener('click', closePopover);
    };

    setTimeout(() => document.addEventListener('click', closePopover), 0);
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
    const dateString = `${dayOfWeek}, Ngày ${day}/${month}/${year}`;

    const ho_ten = currentUser.ho_ten || 'User';
    const phan_quyen = currentUser.phan_quyen || 'View';

    let roleMessage = '';
    switch (phan_quyen) {
        case 'Admin':
            roleMessage = 'Chúc bạn ngày làm việc hiệu quả.';
            break;
        case 'User':
            roleMessage = 'Cảm ơn sự đóng góp của bạn.';
            break;
        case 'View':
            roleMessage = 'Bạn đang xem dữ liệu kho hàng.';
            break;
        default:
            roleMessage = 'Chào mừng bạn.';
    }

    notificationBar.innerHTML = `
        <marquee behavior="scroll" direction="left" scrollamount="4" class="w-full">
            <span class="font-bold text-blue-800">${ho_ten}</span> (${phan_quyen}) - 
            <span>${dateString}</span> - 
            <span class="italic text-gray-600">${roleMessage}</span>
        </marquee>
    `;
}

async function handleLogout() {
    if (userChannel) { await sb.removeChannel(userChannel); userChannel = null; }
    if (adminNotificationChannel) { await sb.removeChannel(adminNotificationChannel); adminNotificationChannel = null; }
    if (presenceChannel) { await sb.removeChannel(presenceChannel); presenceChannel = null; }
    if (dataChannel) { await sb.removeChannel(dataChannel); dataChannel = null; }
    sessionStorage.clear();
    window.location.href = 'login.html';
}

export function applyViewPermissions() {
    if (!currentUser) return;
    const allowedViewsStr = currentUser.xem_view || '';
    const allowedViews = allowedViewsStr.split(',').map(v => v.trim()).filter(Boolean);
    
    if (!allowedViews.includes('view-cai-dat')) {
        allowedViews.push('view-cai-dat');
    }

    document.querySelectorAll('.nav-button').forEach(btn => {
        const viewId = btn.dataset.view;
        const isAllowed = allowedViews.includes(viewId);
        
        if (isAllowed) {
            btn.classList.remove('hidden');
            btn.style.display = ''; 
        } else {
            btn.classList.add('hidden');
            btn.style.display = 'none'; 
        }
    });
}

export async function showView(viewId) {
    if (currentUser) {
        const allowedViews = (currentUser.xem_view || '').split(',').map(v => v.trim()).filter(Boolean);
        const managedViews = ['view-phat-trien', 'view-san-pham', 'view-ton-kho', 'view-chi-tiet'];
        
        if (managedViews.includes(viewId) && !allowedViews.includes(viewId)) {
            const fallbackView = managedViews.find(v => allowedViews.includes(v)) || 'view-cai-dat';
            return showView(fallbackView);
        }
    }

    const viewTitles = {
        'view-phat-trien': 'Tổng Quan',
        'view-san-pham': 'Sản Phẩm',
        'view-ton-kho': 'Tồn Kho',
        'view-chi-tiet': 'Chi Tiết',
        'view-cai-dat': 'Cài Đặt',
    };

    document.querySelectorAll('.app-view').forEach(view => view.classList.add('hidden'));
    const viewContainer = document.getElementById(viewId);
    if (!viewContainer) return;

    const viewTitleEl = document.getElementById('view-title');
    if (viewTitleEl) viewTitleEl.textContent = viewTitles[viewId] || 'Dashboard';

    viewContainer.classList.remove('hidden');
    sessionStorage.setItem('lastViewId', viewId);

    document.querySelectorAll('.nav-button').forEach(btn => {
        const isActive = btn.dataset.view === viewId;
        btn.classList.toggle('active', isActive);
        if (btn.classList.contains('mobile-nav-btn')) {
             if (isActive) {
                 btn.classList.add('text-blue-400', 'active');
                 btn.classList.remove('text-gray-400');
             } else {
                 btn.classList.remove('text-blue-400', 'active');
                 btn.classList.add('text-gray-400');
             }
        }
    });

    currentView = viewId;

    try {
        if (viewId === 'view-phat-trien') {
            if (!isViewInitialized['view-phat-trien']) {
                const { initTongQuanView } = await import('./tongquan.js');
                initTongQuanView();
                isViewInitialized['view-phat-trien'] = true;
            }
            const { fetchTongQuanData } = await import('./tongquan.js');
            await fetchTongQuanData();
        } else if (viewId === 'view-cai-dat') {
            if (!isViewInitialized['view-cai-dat']) {
                const { initCaiDatView } = await import('./caidat.js');
                initCaiDatView();
                const logoutBtn = document.getElementById('logout-btn');
                if (logoutBtn) logoutBtn.addEventListener('click', async () => {
                    const confirmed = await showConfirm('Bạn có chắc chắn muốn đăng xuất?', 'Xác nhận');
                    if (confirmed) handleLogout();
                });
                isViewInitialized['view-cai-dat'] = true;
            }
            const { initProfileAvatarState, fetchUsers } = await import('./caidat.js');
            const hoTenInput = document.getElementById('profile-ho-ten');
            if (hoTenInput) hoTenInput.value = currentUser.ho_ten || '';
            initProfileAvatarState();
            
            const isAdmin = currentUser.phan_quyen === 'Admin';
            const adminPanel = document.getElementById('admin-panel');
            if (adminPanel) {
                adminPanel.classList.toggle('hidden', !isAdmin);
                if (isAdmin) await fetchUsers();
            }
        } else if (viewId === 'view-san-pham') {
            if (!isViewInitialized['view-san-pham']) {
                const { initSanPhamView } = await import('./sanpham.js');
                initSanPhamView();
                isViewInitialized['view-san-pham'] = true;
            }
            const { fetchSanPham } = await import('./sanpham.js');
            await fetchSanPham();
        } else if (viewId === 'view-ton-kho') {
            if (!isViewInitialized['view-ton-kho']) {
                const { initTonKhoView } = await import('./tonkho.js');
                initTonKhoView();
                isViewInitialized['view-ton-kho'] = true;
            }
            const { fetchTonKho } = await import('./tonkho.js');
            await fetchTonKho();
        } else if (viewId === 'view-chi-tiet') {
            if (!isViewInitialized['view-chi-tiet']) {
                const { initChiTietView } = await import('./chitiet.js');
                initChiTietView();
                isViewInitialized['view-chi-tiet'] = true;
            }
            const { fetchChiTiet } = await import('./chitiet.js');
            await fetchChiTiet();
        }
    } catch (error) {
        console.error(error);
        if (viewContainer) viewContainer.innerHTML = `<div class="p-8 text-center text-red-500">Error loading view content. Details: ${error.message}</div>`;
    }
}

function updateOnlineStatusUI() {
    const avatarStatusEl = document.getElementById('sidebar-avatar-status');
    if (!avatarStatusEl) return;

    const selfPresence = onlineUsers.get(currentUser.gmail);
    if (selfPresence) {
        const status = selfPresence.status || 'online';
        const statusColor = status === 'away' ? 'bg-yellow-400' : 'bg-green-500';
        avatarStatusEl.className = `absolute -bottom-0.5 -right-0.5 block h-3 w-3 rounded-full ${statusColor} ring-2 ring-gray-900`;
    } else {
        avatarStatusEl.className = 'absolute -bottom-0.5 -right-0.5 block h-3 w-3 rounded-full bg-gray-400 ring-2 ring-gray-900';
    }
}

function setupUserPermissionRealtime() {
    if (userChannel) sb.removeChannel(userChannel);
    
    userChannel = sb.channel(`user-perm-sync-${currentUser.gmail}`)
        .on('postgres_changes', { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'user', 
            filter: `gmail=eq.${currentUser.gmail}` 
        }, payload => {
            const newData = payload.new;
            Object.assign(currentUser, newData);
            sessionStorage.setItem('loggedInUser', JSON.stringify(currentUser));
            showToast("Admin đã cập nhật quyền hạn của bạn.", "info");
            updateNotificationBar();
            updateSidebarAvatar(currentUser.anh_dai_dien_url);
            applyViewPermissions(); 
            showView(currentView);
        })
        .subscribe();
}

function setupPresence() {
    if (presenceChannel) sb.removeChannel(presenceChannel);

    presenceChannel = sb.channel('presence-online-users');

    presenceChannel
        .on('presence', { event: 'sync' }, () => {
            const newState = presenceChannel.presenceState();
            onlineUsers.clear();
            for (const id in newState) {
                const presenceItems = newState[id];
                if (presenceItems && presenceItems.length > 0) {
                    const p = presenceItems[0];
                    onlineUsers.set(p.gmail, p);
                }
            }
            updateOnlineStatusUI();
            if (currentView === 'view-cai-dat') {
                import('./caidat.js').then(m => m.fetchUsers());
            }
        })
        .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await presenceChannel.track({
                    gmail: currentUser.gmail,
                    status: document.visibilityState === 'visible' ? 'online' : 'away',
                    online_at: new Date().toISOString(),
                });
            }
        });

    document.addEventListener('visibilitychange', async () => {
        if (presenceChannel) {
            const status = document.visibilityState === 'visible' ? 'online' : 'away';
            await presenceChannel.track({
                gmail: currentUser.gmail,
                status: status,
                online_at: new Date().toISOString(),
            });
        }
    });
}

function setupDataRealtime() {
    if (dataChannel) sb.removeChannel(dataChannel);

    const refreshCurrentViewData = async () => {
        showLoading(true);
        if (currentView === 'view-phat-trien') {
            const { fetchTongQuanData } = await import('./tongquan.js');
            await fetchTongQuanData();
        } else if (currentView === 'view-san-pham') {
            const { fetchSanPham } = await import('./sanpham.js');
            await fetchSanPham(viewStates['view-san-pham'].currentPage, false);
        } else if (currentView === 'view-ton-kho') {
            const { fetchTonKho } = await import('./tonkho.js');
            await fetchTonKho(viewStates['view-ton-kho'].currentPage, false);
        } else if (currentView === 'view-chi-tiet') {
            const { fetchChiTiet } = await import('./chitiet.js');
            await fetchChiTiet(viewStates['view-chi-tiet'].currentPage, false);
        }
        showLoading(false);
    };

    const handleRealtimeEvent = async (tableName) => {
        setTimeout(async () => {
            await refreshCurrentViewData();
            // Nếu bảng là chi_tiet_vt, kiểm tra xem có modal phân bổ nào đang mở không
            if (tableName === 'chi_tiet_vt') {
                const modal = document.getElementById('chi-tiet-vt-modal');
                if (modal && !modal.classList.contains('hidden')) {
                    const { refreshCurrentDetailVtModal } = await import('./chitiet.js');
                    if (typeof refreshCurrentDetailVtModal === 'function') {
                        refreshCurrentDetailVtModal();
                    }
                }
            }
        }, 500); 
    };

    dataChannel = sb.channel('public-data-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'san_pham' }, () => handleRealtimeEvent('san_pham'))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'ton_kho' }, () => handleRealtimeEvent('ton_kho'))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chi_tiet' }, () => handleRealtimeEvent('chi_tiet'))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chi_tiet_vt' }, () => handleRealtimeEvent('chi_tiet_vt'))
        .subscribe();
}

document.addEventListener('DOMContentLoaded', async () => {
    // --- KHỞI TẠO NETWORK STATUS ---
    setupNetworkStatusWatcher();

    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('main-content-area');
    const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
    const iconOpen = document.getElementById('sidebar-toggle-icon-open');
    const iconClose = document.getElementById('sidebar-toggle-icon-close');
    const navButtons = document.querySelectorAll('.nav-button');
    const navIcons = document.querySelectorAll('.nav-button > svg');
    const navTexts = document.querySelectorAll('.nav-text');
    const sidebarHeaderContent = document.getElementById('sidebar-header-content');
    const userInfoText = document.getElementById('user-info-text');

    const setSidebarState = (isCollapsed) => {
        if (!sidebar || !mainContent || window.innerWidth <= 768) return;
        if (isCollapsed) {
            sidebar.classList.replace('w-64', 'w-20');
            mainContent.classList.replace('md:ml-64', 'md:ml-20');
            if (iconClose) iconClose.classList.add('hidden');
            if (iconOpen) iconOpen.classList.remove('hidden');
            navTexts.forEach(text => text?.classList.add('hidden'));
            if (userInfoText) userInfoText.classList.add('hidden');
            sidebarHeaderContent?.classList.replace('justify-between', 'flex-col');
            navButtons.forEach(btn => !btn.classList.contains('mobile-nav-btn') && btn.classList.replace('px-6', 'justify-center'));
            navIcons.forEach(icon => icon?.classList.remove('mr-4'));
        } else {
            sidebar.classList.replace('w-20', 'w-64');
            mainContent.classList.replace('md:ml-20', 'md:ml-64');
            if (iconOpen) iconOpen.classList.add('hidden');
            if (iconClose) iconClose.classList.remove('hidden');
            navTexts.forEach(text => text?.classList.remove('hidden'));
            if (userInfoText) userInfoText.classList.remove('hidden');
            sidebarHeaderContent?.classList.replace('flex-col', 'justify-between');
            navButtons.forEach(btn => !btn.classList.contains('mobile-nav-btn') && btn.classList.replace('justify-center', 'px-6'));
            navIcons.forEach(icon => icon?.classList.add('mr-4'));
        }
    };

    const isSidebarCollapsed = sessionStorage.getItem('sidebarCollapsed') === 'true';
    if (sidebar) setSidebarState(isSidebarCollapsed);

    if (sidebarToggleBtn) sidebarToggleBtn.addEventListener('click', () => {
        const isCollapsed = sidebar.classList.contains('w-20');
        sessionStorage.setItem('sidebarCollapsed', !isCollapsed);
        setSidebarState(!isCollapsed);
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const modals = [
                { id: 'print-preview-modal', closeBtnId: 'print-preview-close-btn' },
                { id: 'image-viewer-modal', closeBtnId: 'close-image-viewer-btn' },
                { id: 'confirm-modal', closeBtnId: 'confirm-cancel-btn' },
                { id: 'excel-export-modal', closeBtnId: 'excel-export-cancel-btn' },
                { id: 'password-reset-modal', closeBtnId: 'cancel-reset-btn' },
                { id: 'san-pham-modal', closeBtnId: 'cancel-san-pham-btn' },
                { id: 'ton-kho-modal', closeBtnId: 'cancel-ton-kho-btn' },
                { id: 'ton-kho-settings-modal', closeBtnId: 'ton-kho-settings-close-btn' },
                { id: 'chi-tiet-settings-modal', closeBtnId: 'chi-tiet-settings-close-btn' },
                { id: 'chi-tiet-vt-modal', closeBtnId: 'close-ct-vt-modal' },
                { id: 'voice-settings-modal', closeBtnId: 'close-voice-settings-modal' },
            ];
            for (const modalInfo of modals) {
                const modalEl = document.getElementById(modalInfo.id);
                if (modalEl && !modalEl.classList.contains('hidden')) {
                    const closeBtn = document.getElementById(modalInfo.closeBtnId);
                    if (closeBtn) {
                        closeBtn.click();
                    } else {
                        modalEl.classList.add('hidden');
                    }
                    e.preventDefault(); return;
                }
            }
            if (activeAutocompletePopover) closeActiveAutocompletePopover();
        }
    });

    try {
        const userJson = sessionStorage.getItem('loggedInUser');
        if (userJson) {
            currentUser = JSON.parse(userJson);
            const hoTenEl = document.getElementById('user-ho-ten');
            const gmailEl = document.getElementById('user-gmail');
            if (hoTenEl) hoTenEl.textContent = currentUser.ho_ten || 'User';
            if (gmailEl) gmailEl.textContent = currentUser.gmail || '';
            
            updateSidebarAvatar(currentUser.anh_dai_dien_url);
            updateNotificationBar();
            applyViewPermissions(); 
            
            document.getElementById('app-loading')?.classList.add('hidden');
            document.getElementById('main-app')?.classList.remove('hidden');
            
            document.querySelectorAll('.nav-button').forEach(btn => btn.addEventListener('click', () => showView(btn.dataset.view)));
            
            const lastView = sessionStorage.getItem('lastViewId') || 'view-phat-trien';
            await showView(lastView);
            
            setupUserPermissionRealtime();
            setupDataRealtime();
            setupPresence();
        } else { window.location.href = 'login.html'; }
    } catch (error) { sessionStorage.clear(); window.location.href = 'login.html'; }
});
