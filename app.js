// ===== 1. Khởi tạo Supabase =====
const SUPABASE_URL = 'https://uefydnefprcannlviimp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVlZnlkbmVmcHJjYW5ubHZpaW1wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEwNTcwMDUsImV4cCI6MjA3NjYzMzAwNX0.X274J_1_crUknJEOT1WWUD1h0HM9WdYScDW2eWWsiLk';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ===== 2. Biến toàn cục (Global Variables) =====
let currentView = 'sanpham';
let selectedItem = { view: null, id: null };
let debounceTimer;
// Trạng thái chỉnh sửa nội tuyến
let currentEditState = { view: null, id: null, mode: null }; // mode: 'add' or 'edit'
let sanphamFiltersPopulated = false; // MỚI: Cờ để chỉ tải bộ lọc 1 lần
let tonkhoFiltersPopulated = false; // MỚI: Cờ cho bộ lọc Tồn Kho
let donhangFiltersPopulated = false; // MỚI
let chitietFiltersPopulated = false; // MỚI
let sanphamDataForLookup = []; // MỚI: Cache sản phẩm cho Tồn Kho
let tonkhoDataForLookup = []; // MỚI: Cache Tồn Kho cho modal đơn hàng
let draggedRow = null; // MỚI: Cho drag & drop
let currentEditingDonhangId = null; // MỚI: ID của đơn hàng đang sửa
let currentSuggestionPanel = null; // THAY ĐỔI: Panel gợi ý đang hiển thị (chung)


// MỚI: Biến lưu trữ dữ liệu gốc và trạng thái bộ lọc custom
let sanphamDataCache = []; // Lưu trữ tất cả sản phẩm
let sanphamFilterState = {
  ma_vt: new Set(),
  ten_vt: new Set(),
  nganh: new Set(),
  phu_trach: new Set()
};
// MỚI: State cho bộ lọc Tồn Kho
let tonkhoFilterState = {
  ma_vt: new Set(),
  lot: new Set(),
  ton_cuoi: new Set(),
  tinh_trang: new Set(),
  nganh: new Set(),
  phu_trach: new Set()
};
// MỚI: State cho bộ lọc Đơn Hàng
let donhangFilterState = {
  thoi_gian_from: '',
  thoi_gian_to: '',
  ma_kho: new Set(),
  ma_nx: new Set(),
  loai_don: new Set(),
  trang_thai: new Set()
};
// MỚI: State cho bộ lọc Chi Tiết
let chitietFilterState = {
  thoi_gian_from: '',
  thoi_gian_to: '',
  ma_kho: new Set(),
  ma_nx: new Set(),
  ma_vt: new Set(),
  lot: new Set(),
  nganh: new Set(),
  phu_trach: new Set(),
  loai_don: new Set(),
  trang_thai: new Set()
};


// MỚI: Biến phân trang
let pagination = {
  page: 1,
  limit: 50,
  totalItems: 0,
  totalPages: 1
};

// ===== 3. Lấy DOM Elements =====
const views = document.querySelectorAll('.view');
const navLinks = document.querySelectorAll('.nav-link');

// Toolbar (Đã SỬA LỖI JS)
const toolbar = {
  search: document.getElementById('toolbar-search'),
  clearFilter: document.getElementById('toolbar-clear-filter'),
  add: document.getElementById('toolbar-add'),
  edit: document.getElementById('toolbar-edit'),
  delete: document.getElementById('toolbar-delete'),
  save: document.getElementById('toolbar-save'),
  excel: document.getElementById('toolbar-excel'),
  cancel: document.getElementById('toolbar-cancel'), // MỚI
  sync: document.getElementById('toolbar-sync') // MỚI
};

// DOM Bộ lọc (MỚI)
const toolbarToggleFilter = document.getElementById('toolbar-toggle-filter');
const toolbarToggleFilterText = document.getElementById('toolbar-toggle-filter-text');
const filterPanel = document.getElementById('filter-panel');
const filterSelects = document.querySelectorAll('.filter-select'); // ĐỔI TÊN TỪ filterInputs

// MỚI: Lấy DOM cho bộ lọc custom (sẽ được gắn listener sau)
let customFilters = [];

// Modals & Forms (Đã xóa các modal form)
const confirmModal = document.getElementById('confirm-modal');
const confirmMessage = document.getElementById('confirm-message');
const confirmOkButton = document.getElementById('confirm-ok');
const confirmCancelButton = document.getElementById('confirm-cancel');
let confirmCallback = null;

// CẬP NHẬT: DOM cho Modal Đơn Hàng mới
const donhangModal = {
    element: document.getElementById('donhang-modal'),
    form: document.getElementById('donhang-form'),
    title: document.getElementById('donhang-modal-title'),
    closeButton: document.getElementById('donhang-modal-close'),
    cancelButton: document.getElementById('donhang-modal-cancel'),
    saveButton: document.getElementById('donhang-modal-save'),
    detailsBody: document.getElementById('donhang-modal-details-body'),
    addDetailRowButton: document.getElementById('dh-add-detail-row'),
    // Form fields
    loaiDon: document.getElementById('dh-loai-don'),
    thoiGian: document.getElementById('dh-thoi-gian'),
    maKho: document.getElementById('dh-ma-kho'),
    maNx: document.getElementById('dh-ma-nx'),
    maNxLabel: document.getElementById('dh-ma-nx-label'),
    user: document.getElementById('dh-user'),
    userLabel: document.getElementById('dh-user-label'),
    nganh: document.getElementById('dh-nganh'),
    nganhDatalist: document.getElementById('nganh-datalist'),
    totalQuantity: document.getElementById('dh-total-quantity'),
    quantityHeader: document.getElementById('dh-quantity-header'),
    remainingStockHeader: document.getElementById('dh-remaining-stock-header')
};


// Table bodies
const sanphamTableBody = document.getElementById('sanpham-table-body');
const tonkhoTableBody = document.getElementById('tonkho-table-body');
const donhangTableBody = document.getElementById('donhang-table-body');
const chitietTableBody = document.getElementById('chitiet-table-body');


// MỚI: DOM Phân trang, Đồng bộ & Cỡ chữ
const paginationControls = {
    limitSelect: document.getElementById('pagination-limit'),
    pageInput: document.getElementById('pagination-page'),
    totalPagesSpan: document.getElementById('pagination-total-pages'),
    prevButton: document.getElementById('pagination-prev'),
    nextButton: document.getElementById('pagination-next'),
    infoSpan: document.getElementById('pagination-info')
};

const lastSyncTimeSpan = document.getElementById('last-sync-time'); // MỚI

// THÊM MỚI: DOM cho Cài đặt Popover và Toast
const settingsMenu = document.getElementById('settings-menu');
const settingsToggleButton = document.getElementById('settings-toggle-button');
const settingsPopover = document.getElementById('settings-popover');
const fontSizeSelect = document.getElementById('font-size-select'); // Đã di chuyển
const darkModeToggle = document.getElementById('dark-mode-toggle');
const darkModeToggleKnob = document.getElementById('dark-mode-toggle-knob');
const toastContainer = document.getElementById('toast-container');
const loadingProgressBar = document.getElementById('loading-progress-bar'); // THÊM MỚI


// ===== 4. Logic Chuyển View (Navigation) =====
/**
 * Hiển thị một view (tab) cụ thể
 */
function showView(viewId) {
  if (currentEditState.mode) return; // Không chuyển view khi đang edit
  
  currentView = viewId;
  views.forEach(view => view.classList.remove('active'));
  navLinks.forEach(link => link.classList.remove('active'));

  document.getElementById(`view-${viewId}`).classList.add('active');
  document.querySelector(`.nav-link[data-view="${viewId}"]`).classList.add('active');

  // MỚI: Reset phân trang khi chuyển view
  pagination.page = 1;
  
  hideInlineEditControls(); // Luôn reset trạng thái edit

  // MỚI: Xử lý hiển thị nút Tải Excel
  if (viewId === 'donhang') {
    toolbar.excel.style.display = 'none';
  } else {
    toolbar.excel.style.display = 'flex';
  }
  
  // THAY ĐỔI: Không ẩn nút Thêm/Sửa/Xóa cho Đơn Hàng
  toolbar.add.style.display = 'flex';
  toolbar.edit.style.display = 'flex';
  toolbar.delete.style.display = 'flex';


  // MỚI: Xử lý hiển thị bộ lọc
  filterPanel.classList.add('hidden'); // 1. Luôn ẩn bảng lọc khi chuyển view
  toolbarToggleFilterText.textContent = 'Hiện bộ lọc'; // 2. Reset text nút

  // 3. Ẩn tất cả các tùy chọn lọc
  document.querySelectorAll('.filter-view-options').forEach(f => f.classList.add('hidden'));

  const filterOptions = document.getElementById(`filter-${viewId}`);

  // 4. Hiển thị nút "Hiện bộ lọc" VÀ tùy chọn lọc nếu nó tồn tại
  if (filterOptions) {
    filterOptions.classList.remove('hidden'); // Hiển thị tùy chọn (ví dụ: filter-sanpham)
    toolbarToggleFilter.style.display = 'flex'; // Hiển thị nút "Hiện bộ lọc"

    // MỚI: Tải dữ liệu cho dropdowns nếu chưa tải
    if (viewId === 'sanpham' && !sanphamFiltersPopulated) populateSanphamFilters();
    if (viewId === 'tonkho' && !tonkhoFiltersPopulated) populateTonkhoFilters();
    if (viewId === 'donhang' && !donhangFiltersPopulated) populateDonhangFilters();
    if (viewId === 'chitiet' && !chitietFiltersPopulated) populateChitietFilters();

  } else {
    toolbarToggleFilter.style.display = 'none'; // Ẩn nút "Hiện bộ lọc"
  }

  loadDataForCurrentView();
}

/**
 * Tải dữ liệu dựa trên view hiện tại
 */
function loadDataForCurrentView() {
  switch (currentView) {
    case 'sanpham': loadSanpham(); break;
    case 'tonkho': loadTonkho(); break;
    case 'donhang': loadDonhang(); break;
    case 'chitiet': loadChitiet(); break;
  }
}

/**
 * Xử lý sự kiện cho các nút toolbar (Đã refactor)
 */
async function handleToolbarAdd() {
   // THAY ĐỔI: Xử lý cho Đơn Hàng
  if (currentView === 'donhang') {
    await openDonhangModal();
    return;
  }
  if (currentEditState.mode === 'edit') return; // Đang *sửa* thì không thêm

  if (currentEditState.mode !== 'add') {
    // Lần click đầu tiên
    showToast('Đang ở chế độ thêm mới. Nhấn "Lưu" hoặc "Hủy" để thoát.', 'warning', 5000);
    showInlineEditControls();
    currentEditState.view = currentView;
    currentEditState.mode = 'add';
  }

  // Các lần click tiếp theo
  switch (currentView) {
    case 'sanpham': createNewSanphamRow(); break;
    case 'tonkho': createNewTonkhoRow(); break;
    // case 'chitiet': (Bị ẩn)
  }
}

async function handleToolbarEdit() {
  if (!selectedItem.id || currentEditState.mode) return;
  const { view, id } = selectedItem;
   // THAY ĐỔI: Xử lý cho Đơn Hàng
  if (view === 'donhang') {
    const { data, error } = await supabase.from('DONHANG').select('*').eq('ma_nx', id).single();
    if (error) {
      showToast(`Lỗi tải đơn hàng: ${error.message || JSON.stringify(error)}`, 'error');
      return;
    }
    await openDonhangModal(data);
    return;
  }
  
  showToast('Đang ở chế độ chỉnh sửa. Nhấn "Lưu" hoặc "Hủy" để thoát.', 'warning', 5000);
  switch (view) {
    case 'sanpham': editSanpham(id); break;
    case 'tonkho': editTonkho(id); break;
    // case 'chitiet': (Bị ẩn)
  }
}

function handleToolbarDelete() {
  if (!selectedItem.id || currentEditState.mode) return;
  // ... (logic xóa không đổi) ...
  const { view, id } = selectedItem;
  switch (view) {
    case 'sanpham': deleteSanpham(id); break;
    case 'tonkho': deleteTonkho(id); break;
    case 'donhang': deleteDonhang(id); break;
    case 'chitiet': deleteChitiet(id); break; // Nút Xóa ở Chi tiết cũng bị ẩn, nhưng để logic ở đây
  }
}

function handleToolbarSearch() {
  if (currentEditState.mode) return; // Không tìm kiếm khi đang edit
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    // MỚI: Reset phân trang
    pagination.page = 1;
    paginationControls.pageInput.value = 1;
    loadDataForCurrentView();
  }, 300);
}

function handleToolbarClearFilter() {
    if (currentEditState.mode) return;
    toolbar.search.value = '';
    
    // Reset bộ lọc cho view hiện tại
    let stateToReset = null;
    let filterSelector = '';

    if (currentView === 'sanpham') {
        stateToReset = sanphamFilterState = { ma_vt: new Set(), ten_vt: new Set(), nganh: new Set(), phu_trach: new Set() };
        filterSelector = '#filter-sanpham';
    } else if (currentView === 'tonkho') {
        stateToReset = tonkhoFilterState = { ma_vt: new Set(), lot: new Set(), ton_cuoi: new Set(), tinh_trang: new Set(), nganh: new Set(), phu_trach: new Set() };
        filterSelector = '#filter-tonkho';
    } else if (currentView === 'donhang') {
        stateToReset = donhangFilterState = { thoi_gian_from: '', thoi_gian_to: '', ma_kho: new Set(), ma_nx: new Set(), loai_don: new Set(), trang_thai: new Set() };
        filterSelector = '#filter-donhang';
        setDefaultDateFilters('donhang'); // THAY ĐỔI: Reset lại ngày mặc định
    } else if (currentView === 'chitiet') {
        stateToReset = chitietFilterState = { thoi_gian_from: '', thoi_gian_to: '', ma_kho: new Set(), ma_nx: new Set(), ma_vt: new Set(), lot: new Set(), nganh: new Set(), phu_trach: new Set(), loai_don: new Set(), trang_thai: new Set() };
        filterSelector = '#filter-chitiet';
        setDefaultDateFilters('chitiet'); // THAY ĐỔI: Reset lại ngày mặc định
    }

    if (stateToReset && filterSelector) {
        document.querySelectorAll(`${filterSelector} .custom-filter`).forEach(filter => {
            const column = filter.dataset.filterColumn;
            updateCustomFilterText(column, filter);
            filter.querySelectorAll('.custom-filter-list input[type="checkbox"]').forEach(cb => cb.checked = false);
            const search = filter.querySelector('.custom-filter-search');
            if (search) search.value = ''; 
            filter.querySelectorAll('.custom-filter-item').forEach(item => item.style.display = 'flex');
        });
    }

    pagination.page = 1;
    paginationControls.pageInput.value = 1;
    loadDataForCurrentView();
}

// ===== 5. Logic Chọn Hàng (Row Selection) (ĐÃ THAY ĐỔI) =====

/**
 * Gắn listener cho các checkbox
 */
function attachCheckboxListeners(view) {
  // Listener cho từng checkbox hàng
  document.querySelectorAll(`#${view}-table-body .row-checkbox`).forEach(cb => {
    cb.addEventListener('click', (e) => handleCheckboxClick(e, view));
  });

  // Listener cho checkbox "chọn tất cả"
  const selectAll = document.querySelector(`.select-all-checkbox[data-view="${view}"]`);
  if (selectAll) {
    selectAll.addEventListener('click', (e) => {
      document.querySelectorAll(`#${view}-table-body .row-checkbox`).forEach(cb => {
        cb.checked = e.target.checked;
        // Tạm thời không kích hoạt multi-select, chỉ dùng để clear
        if (!e.target.checked) clearSelection();
      });
    });
  }
}

/**
 * MỚI: Xử lý khi click vào TR (toàn bộ hàng)
 */
function toggleRowSelection(view, id, event) {
  if (currentEditState.mode) return; // Không chọn khi đang edit

  // Bỏ qua nếu click vào checkbox, input, link hoặc button
  if (event.target.closest('input, a, button, select')) return;

  const checkbox = document.querySelector(`.row-checkbox[data-view="${view}"][data-id="${id}"]`);
  if (checkbox) {
    checkbox.click(); // Kích hoạt sự kiện click của checkbox
  }
}

function handleCheckboxClick(event, view) {
  if (currentEditState.mode) {
    event.target.checked = !event.target.checked; // Ngăn thay đổi khi đang edit
    return;
  }

  const cb = event.target;
  const id = cb.dataset.id;

  if (cb.checked) {
    // Chọn hàng mới
    selectRow(view, id);
  } else {
    // Bỏ chọn
    clearSelection();
  }
}

function selectRow(view, id) {
  // 1. Xóa lựa chọn cũ (nếu có)
  if (selectedItem.id && selectedItem.id !== id) {
    const oldRow = document.getElementById(`${selectedItem.view}-row-${selectedItem.id}`);
    if (oldRow) oldRow.classList.remove('selected');
    const oldCb = document.querySelector(`.row-checkbox[data-id="${selectedItem.id}"]`);
    if (oldCb) oldCb.checked = false;
  }

  // 2. Đặt lựa chọn mới
  selectedItem.view = view;
  selectedItem.id = id;

  const newRow = document.getElementById(`${view}-row-${id}`);
  if (newRow) {
    newRow.classList.add('selected');
  }
  const newCb = document.querySelector(`.row-checkbox[data-id="${id}"]`);
  if (newCb) {
    newCb.checked = true;
  }

  // 3. Kích hoạt nút (chỉ khi không ở chế độ edit)
  if (!currentEditState.mode) {
    toolbar.edit.disabled = false;
    toolbar.delete.disabled = false;
  }
}

function clearSelection() {
  if (selectedItem.view && selectedItem.id) {
    const oldRow = document.getElementById(`${selectedItem.view}-row-${selectedItem.id}`);
    if (oldRow) {
      oldRow.classList.remove('selected');
    }
    const oldCb = document.querySelector(`.row-checkbox[data-id="${selectedItem.id}"]`);
    if (oldCb) oldCb.checked = false;
  }

  selectedItem.view = null;
  selectedItem.id = null;
  toolbar.edit.disabled = true;
  toolbar.delete.disabled = true;
}


// ===== 6. Logic Modal Xác Nhận (Custom Confirm) =====
// ... (Không thay đổi) ...
function showConfirm(message, callback, isAlert = false) {
  confirmMessage.textContent = message;
  confirmCallback = callback;

  if (isAlert) {
    confirmOkButton.textContent = 'Đã hiểu';
    confirmOkButton.classList.remove('bg-red-600', 'hover:bg-red-700');
    confirmOkButton.classList.add('bg-blue-600', 'hover:bg-blue-700');
    confirmCancelButton.classList.add('hidden');
  } else {
    confirmOkButton.textContent = 'Xóa';
    confirmOkButton.classList.add('bg-red-600', 'hover:bg-red-700');
    confirmOkButton.classList.remove('bg-blue-600', 'hover:bg-blue-700');
    confirmCancelButton.classList.remove('hidden');
  }

  confirmModal.classList.remove('hidden');
}
confirmOkButton.addEventListener('click', () => {
  if (confirmCallback) {
    confirmCallback();
  }
  confirmCallback = null;
  confirmModal.classList.add('hidden');
});
confirmCancelButton.addEventListener('click', () => {
  confirmCallback = null;
  confirmModal.classList.add('hidden');
});

// ===== MỚI: 6.3. Logic Thông báo (Toast) =====
/**
 * MỚI: Xóa một toast cụ thể
 */
function removeToast(toastElement) {
  if (!toastElement) return;
  toastElement.classList.remove('show');
  toastElement.classList.add('hide');
  toastElement.addEventListener('transitionend', () => {
    toastElement.remove();
  });
}

/**
 * Hiển thị một thông báo toast
 * @param {string} message Nội dung thông báo
 * @param {'success' | 'warning' | 'error'} type Loại thông báo
 * @param {number} duration Thời gian hiển thị (ms)
 * @returns {HTMLElement} The created toast element.
 */
function showToast(message, type = 'success', duration = 3000) {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  // Thêm icon
  let iconSvg = '';
  switch(type) {
    case 'success':
      iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`;
      break;
    case 'warning':
      iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>`;
      break;
    case 'error':
      iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`;
      break;
  }

  toast.innerHTML = `${iconSvg}<span>${message}</span>`;
  toastContainer.appendChild(toast);

  // Trigger animation
  setTimeout(() => {
    toast.classList.add('show');
  }, 10); // delay nhỏ để transition hoạt động

  // Tự động ẩn
  const timer = setTimeout(() => {
    removeToast(toast);
  }, duration);
  
  toast.addEventListener('click', () => {
    removeToast(toast);
    clearTimeout(timer);
  })
  
  return toast; // MỚI: Trả về element
}

// ===== MỚI: 6.5. Cập nhật UI Phân trang =====
/**
 * MỚI: Cập nhật UI phân trang
 */
function updatePaginationUI() {
  const { page, limit, totalItems } = pagination;
  
  pagination.totalPages = Math.max(1, Math.ceil(totalItems / limit));
  
  // Nếu trang hiện tại lớn hơn tổng số trang (ví dụ: sau khi lọc), reset về trang cuối
  if (pagination.page > pagination.totalPages) {
    pagination.page = pagination.totalPages;
  }
  
  const from = totalItems === 0 ? 0 : (pagination.page - 1) * limit + 1;
  const to = Math.min(pagination.page * limit, totalItems);

  paginationControls.totalPagesSpan.textContent = pagination.totalPages;
  paginationControls.pageInput.value = pagination.page;
  paginationControls.infoSpan.textContent = `Hiển thị ${from}-${to} của ${totalItems}`;
  
  paginationControls.prevButton.disabled = (pagination.page <= 1);
  paginationControls.nextButton.disabled = (pagination.page >= pagination.totalPages);
  paginationControls.pageInput.max = pagination.totalPages; // Đặt max cho input
}


// ===== 7. CRUD cho SẢN PHẨM (SANPHAM) =====
async function loadSanpham() {
  clearSelection();
  showProgressBar();
  try {
    const searchTerm = toolbar.search.value.toLowerCase();
    const filterMaVt = Array.from(sanphamFilterState.ma_vt);
    const filterTenVt = Array.from(sanphamFilterState.ten_vt);
    const filterNganh = Array.from(sanphamFilterState.nganh);
    const filterPhuTrach = Array.from(sanphamFilterState.phu_trach);

    let query = supabase.from('SANPHAM').select('*');
    let countQuery = supabase.from('SANPHAM').select('*', { count: 'exact', head: true }); // MỚI: Query đếm

    if (searchTerm) {
      const searchFilter = `ma_vt.ilike.%${searchTerm}%,ten_vt.ilike.%${searchTerm}%,nganh.ilike.%${searchTerm}%,phu_trach.ilike.%${searchTerm}%`;
      query = query.or(searchFilter);
      countQuery = countQuery.or(searchFilter);
    }
    if (filterMaVt.length > 0) { 
      query = query.in('ma_vt', filterMaVt); 
      countQuery = countQuery.in('ma_vt', filterMaVt);
    }
    if (filterTenVt.length > 0) { 
      query = query.in('ten_vt', filterTenVt); 
      countQuery = countQuery.in('ten_vt', filterTenVt);
    }
    if (filterNganh.length > 0) { 
      query = query.in('nganh', filterNganh); 
      countQuery = countQuery.in('nganh', filterNganh);
    }
    if (filterPhuTrach.length > 0) { 
      query = query.in('phu_trach', filterPhuTrach); 
      countQuery = countQuery.in('phu_trach', filterPhuTrach);
    }
    const { count, error: countError } = await countQuery;
    if (countError) throw countError;
    
    pagination.totalItems = count || 0;
    updatePaginationUI();

    const from = (pagination.page - 1) * pagination.limit;
    const to = from + pagination.limit - 1;
    query = query.range(from, to);

    let { data, error } = await query.order('ma_vt');
    if (error) throw error;

    if (data.length === 0) {
      sanphamTableBody.innerHTML = `<tr><td colspan="5" class="td-center">Không tìm thấy dữ liệu.</td></tr>`;
      return;
    }

    sanphamTableBody.innerHTML = data.map(item => `
      <tr id="sanpham-row-${item.ma_vt}" class="selectable-row hover:bg-gray-50 dark:hover:bg-gray-700" onclick="toggleRowSelection('sanpham', '${item.ma_vt}', event)">
        <td class="td"><input type="checkbox" class="row-checkbox" data-view="sanpham" data-id="${item.ma_vt}"></td>
        <td class="td whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">${item.ma_vt}</td>
        <td class="td text-sm text-gray-600 dark:text-gray-300">${item.ten_vt}</td>
        <td class="td whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">${item.nganh || ''}</td>
        <td class="td whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">${item.phu_trach || ''}</td>
      </tr>
    `).join('');
    attachCheckboxListeners('sanpham');
  } catch (error) {
    console.error('Lỗi tải sản phẩm:', error);
    showToast(`Lỗi tải sản phẩm: ${error.message}`, 'error');
    sanphamTableBody.innerHTML = `<tr><td colspan="5" class="td-center text-red-500">Lỗi: ${error.message}</td></tr>`;
  } finally {
    hideProgressBar();
    updateLastSyncTime();
  }
}

// ... (Các hàm CRUD khác cho Sản Phẩm: create, edit, delete) ...
// ... (Tạm thời giữ nguyên) ...

// ===== 8. CRUD cho TỒN KHO (TONKHO) =====
async function loadTonkho() {
    clearSelection();
    showProgressBar();
    try {
        const searchTerm = toolbar.search.value.toLowerCase();
        
        // Lấy giá trị từ bộ lọc custom
        const filterMaVt = Array.from(tonkhoFilterState.ma_vt);
        const filterLot = Array.from(tonkhoFilterState.lot);
        const filterTonCuoi = Array.from(tonkhoFilterState.ton_cuoi);
        const filterTinhTrang = Array.from(tonkhoFilterState.tinh_trang);
        const filterNganh = Array.from(tonkhoFilterState.nganh);
        const filterPhuTrach = Array.from(tonkhoFilterState.phu_trach);
        
        let query = supabase.from('TONKHO_VIEW').select('*');
        let countQuery = supabase.from('TONKHO_VIEW').select('*', { count: 'exact', head: true });

        // Áp dụng bộ lọc tìm kiếm nhanh
        if (searchTerm) {
            const searchFilter = `ma_vt.ilike.%${searchTerm}%,ten_vt.ilike.%${searchTerm}%,lot.ilike.%${searchTerm}%,ma_vach.ilike.%${searchTerm}%,tinh_trang.ilike.%${searchTerm}%,nganh.ilike.%${searchTerm}%,phu_trach.ilike.%${searchTerm}%`;
            query = query.or(searchFilter);
            countQuery = countQuery.or(searchFilter);
        }
        // Áp dụng bộ lọc custom
        if (filterMaVt.length > 0) { query = query.in('ma_vt', filterMaVt); countQuery = countQuery.in('ma_vt', filterMaVt); }
        if (filterLot.length > 0) { query = query.in('lot', filterLot); countQuery = countQuery.in('lot', filterLot); }
        if (filterTonCuoi.length > 0) {
            if (filterTonCuoi.includes('lonhon0')) { query = query.gt('ton_cuoi', 0); countQuery = countQuery.gt('ton_cuoi', 0); }
            if (filterTonCuoi.includes('bang0')) { query = query.eq('ton_cuoi', 0); countQuery = countQuery.eq('ton_cuoi', 0); }
        }
        if (filterTinhTrang.length > 0) { query = query.in('tinh_trang', filterTinhTrang); countQuery = countQuery.in('tinh_trang', filterTinhTrang); }
        if (filterNganh.length > 0) { query = query.in('nganh', filterNganh); countQuery = countQuery.in('nganh', filterNganh); }
        if (filterPhuTrach.length > 0) { query = query.in('phu_trach', filterPhuTrach); countQuery = countQuery.in('phu_trach', filterPhuTrach); }
        
        // Đếm tổng số lượng
        const { count, error: countError } = await countQuery;
        if (countError) throw countError;
        pagination.totalItems = count || 0;
        updatePaginationUI();
        
        // Phân trang
        const from = (pagination.page - 1) * pagination.limit;
        const to = from + pagination.limit - 1;
        query = query.range(from, to);

        let { data, error } = await query.order('ma_vt').order('lot');
        if (error) throw error;
        
        if (data.length === 0) {
            tonkhoTableBody.innerHTML = `<tr><td colspan="14" class="td-center">Không tìm thấy dữ liệu.</td></tr>`;
            return;
        }

        tonkhoTableBody.innerHTML = data.map(item => {
            const dateObj = item.date ? new Date(item.date) : null;
            const formattedDate = dateObj ? `${dateObj.getDate().toString().padStart(2, '0')}/${(dateObj.getMonth() + 1).toString().padStart(2, '0')}/${dateObj.getFullYear()}` : '';
            
            let tinhTrangClass = '';
            switch (item.tinh_trang) {
                case 'Hết date': tinhTrangClass = 'status-het-date'; break;
                case 'Cận date': tinhTrangClass = 'status-can-date'; break;
                case 'Bình thường': tinhTrangClass = 'status-binh-thuong'; break;
                case 'Hàng Hư': tinhTrangClass = 'status-hang-hu'; break;
            }

            return `
              <tr id="tonkho-row-${item.ma_vach}" class="selectable-row hover:bg-gray-50 dark:hover:bg-gray-700" onclick="toggleRowSelection('tonkho', '${item.ma_vach}', event)">
                <td class="td"><input type="checkbox" class="row-checkbox" data-view="tonkho" data-id="${item.ma_vach}"></td>
                <td class="td font-medium">${item.ma_vach}</td>
                <td class="td">${item.ma_vt}</td>
                <td class="td text-sm text-gray-600 dark:text-gray-300">${item.ten_vt}</td>
                <td class="td">${item.lot}</td>
                <td class="td">${formattedDate}</td>
                <td class="td">${item.ton_dau}</td>
                <td class="td text-nhap">${item.nhap}</td>
                <td class="td text-xuat">${item.xuat}</td>
                <td class="td font-semibold">${item.ton_cuoi}</td>
                <td class="td ${tinhTrangClass}">${item.tinh_trang}</td>
                <td class="td">${item.tray}</td>
                <td class="td">${item.nganh || ''}</td>
                <td class="td">${item.phu_trach || ''}</td>
              </tr>
            `;
        }).join('');
        attachCheckboxListeners('tonkho');
    } catch (error) {
        console.error('Lỗi tải tồn kho:', error);
        showToast(`Lỗi tải tồn kho: ${error.message}`, 'error');
        tonkhoTableBody.innerHTML = `<tr><td colspan="14" class="td-center text-red-500">Lỗi: ${error.message}</td></tr>`;
    } finally {
        hideProgressBar();
    }
}
// ... (Các hàm CRUD khác cho Tồn Kho: create, edit, delete) ...
// ... (Tạm thời giữ nguyên) ...

// ===== 9. CRUD cho ĐƠN HÀNG (DONHANG) =====
async function loadDonhang() {
  clearSelection();
  showProgressBar();
  try {
    const searchTerm = toolbar.search.value.toLowerCase();
    
    // Lấy giá trị từ bộ lọc
    const { thoi_gian_from, thoi_gian_to } = donhangFilterState;
    const filterMaKho = Array.from(donhangFilterState.ma_kho);
    const filterMaNx = Array.from(donhangFilterState.ma_nx);
    const filterLoaiDon = Array.from(donhangFilterState.loai_don);
    const filterTrangThai = Array.from(donhangFilterState.trang_thai);

    let query = supabase.from('DONHANG').select('*');
    let countQuery = supabase.from('DONHANG').select('*', { count: 'exact', head: true });

    // Áp dụng bộ lọc
    if (searchTerm) {
      const searchFilter = `ma_kho.ilike.%${searchTerm}%,ma_nx.ilike.%${searchTerm}%,user.ilike.%${searchTerm}%,nganh.ilike.%${searchTerm}%,muc_dich.ilike.%${searchTerm}%,dia_chi.ilike.%${searchTerm}%,ghi_chu.ilike.%${searchTerm}%`;
      query = query.or(searchFilter);
      countQuery = countQuery.or(searchFilter);
    }
    if (thoi_gian_from) { query = query.gte('thoi_gian', thoi_gian_from); countQuery = countQuery.gte('thoi_gian', thoi_gian_from); }
    if (thoi_gian_to) { query = query.lte('thoi_gian', thoi_gian_to); countQuery = countQuery.lte('thoi_gian', thoi_gian_to); }
    if (filterMaKho.length > 0) { query = query.in('ma_kho', filterMaKho); countQuery = countQuery.in('ma_kho', filterMaKho); }
    if (filterMaNx.length > 0) { query = query.in('ma_nx', filterMaNx); countQuery = countQuery.in('ma_nx', filterMaNx); }
    if (filterLoaiDon.length > 0) { query = query.in('loai_don', filterLoaiDon); countQuery = countQuery.in('loai_don', filterLoaiDon); }
    if (filterTrangThai.length > 0) { query = query.in('trang_thai', filterTrangThai); countQuery = countQuery.in('trang_thai', filterTrangThai); }
    
    // Đếm tổng số
    const { count, error: countError } = await countQuery;
    if (countError) throw countError;
    pagination.totalItems = count || 0;
    updatePaginationUI();
    
    // Phân trang
    const from = (pagination.page - 1) * pagination.limit;
    const to = from + pagination.limit - 1;
    query = query.range(from, to).order('thoi_gian', { ascending: false });

    let { data, error } = await query;
    if (error) throw error;
    
    if (data.length === 0) {
      donhangTableBody.innerHTML = `<tr><td colspan="13" class="td-center">Không tìm thấy dữ liệu.</td></tr>`;
      return;
    }

    donhangTableBody.innerHTML = data.map(item => `
      <tr id="donhang-row-${item.ma_nx}" class="selectable-row hover:bg-gray-50 dark:hover:bg-gray-700" onclick="toggleRowSelection('donhang', '${item.ma_nx}', event)">
        <td class="td"><input type="checkbox" class="row-checkbox" data-view="donhang" data-id="${item.ma_nx}"></td>
        <td class="td">${item.ma_kho}</td>
        <td class="td">${new Date(item.thoi_gian).toLocaleDateString('vi-VN')}</td>
        <td class="td font-medium">${item.ma_nx}</td>
        <td class="td">${item.user || ''}</td>
        <td class="td">${item.nganh || ''}</td>
        <td class="td">${item.muc_dich || ''}</td>
        <td class="td">${item.dia_chi || ''}</td>
        <td class="td">${item.ghi_chu || ''}</td>
        <td class="td">${item.order ? '✓' : ''}</td>
        <td class="td">${item.pkl ? '✓' : ''}</td>
        <td class="td">${item.done ? '✓' : ''}</td>
        <td class="td">${item.image ? '✓' : ''}</td>
      </tr>
    `).join('');
    attachCheckboxListeners('donhang');
  } catch (error) {
    console.error('Lỗi tải đơn hàng:', error);
    showToast(`Lỗi tải đơn hàng: ${error.message}`, 'error');
    donhangTableBody.innerHTML = `<tr><td colspan="13" class="td-center text-red-500">Lỗi: ${error.message}</td></tr>`;
  } finally {
    hideProgressBar();
  }
}
async function deleteDonhang(id) {
    showConfirm(`Bạn có chắc chắn muốn xóa đơn hàng "${id}" và toàn bộ chi tiết liên quan không? Hành động này không thể hoàn tác.`, async () => {
        try {
            // Xóa chi tiết trước
            const { error: detailError } = await supabase.from('CHITIET').delete().eq('ma_nx', id);
            if (detailError) throw detailError;
            
            // Xóa đơn hàng
            const { error: orderError } = await supabase.from('DONHANG').delete().eq('ma_nx', id);
            if (orderError) throw orderError;
            
            showToast('Đã xóa đơn hàng và chi tiết thành công.', 'success');
            loadDonhang(); // Tải lại cả hai view
            loadChitiet();
            clearSelection();
        } catch (error) {
            console.error('Lỗi xóa đơn hàng:', error);
            showToast(`Lỗi xóa đơn hàng: ${error.message}`, 'error');
        }
    });
}
// ===== 10. CRUD cho CHI TIẾT =====
async function loadChitiet() {
  clearSelection();
  showProgressBar();
  try {
    const searchTerm = toolbar.search.value.toLowerCase();

    // Lấy giá trị từ bộ lọc
    const { thoi_gian_from, thoi_gian_to } = chitietFilterState;
    const filterMaKho = Array.from(chitietFilterState.ma_kho);
    const filterMaNx = Array.from(chitietFilterState.ma_nx);
    const filterMaVt = Array.from(chitietFilterState.ma_vt);
    const filterLot = Array.from(chitietFilterState.lot);
    const filterNganh = Array.from(chitietFilterState.nganh);
    const filterPhuTrach = Array.from(chitietFilterState.phu_trach);
    const filterLoaiDon = Array.from(chitietFilterState.loai_don);
    const filterTrangThai = Array.from(chitietFilterState.trang_thai);

    let query = supabase.from('CHITIET_DONHANG_VIEW').select('*');
    let countQuery = supabase.from('CHITIET_DONHANG_VIEW').select('*', { count: 'exact', head: true });
    
    // Áp dụng bộ lọc
    if (searchTerm) {
      const searchFilter = `ma_kho.ilike.%${searchTerm}%,ma_nx.ilike.%${searchTerm}%,ma_vach.ilike.%${searchTerm}%,ma_vt.ilike.%${searchTerm}%,ten_vt.ilike.%${searchTerm}%,lot.ilike.%${searchTerm}%,loai.ilike.%${searchTerm}%,user.ilike.%${searchTerm}%,muc_dich.ilike.%${searchTerm}%,nganh.ilike.%${searchTerm}%,phu_trach.ilike.%${searchTerm}%`;
      query = query.or(searchFilter);
      countQuery = countQuery.or(searchFilter);
    }
    if (thoi_gian_from) { query = query.gte('thoi_gian', thoi_gian_from); countQuery = countQuery.gte('thoi_gian', thoi_gian_from); }
    if (thoi_gian_to) { query = query.lte('thoi_gian', thoi_gian_to); countQuery = countQuery.lte('thoi_gian', thoi_gian_to); }
    if (filterMaKho.length > 0) { query = query.in('ma_kho', filterMaKho); countQuery = countQuery.in('ma_kho', filterMaKho); }
    if (filterMaNx.length > 0) { query = query.in('ma_nx', filterMaNx); countQuery = countQuery.in('ma_nx', filterMaNx); }
    if (filterMaVt.length > 0) { query = query.in('ma_vt', filterMaVt); countQuery = countQuery.in('ma_vt', filterMaVt); }
    if (filterLot.length > 0) { query = query.in('lot', filterLot); countQuery = countQuery.in('lot', filterLot); }
    if (filterNganh.length > 0) { query = query.in('nganh', filterNganh); countQuery = countQuery.in('nganh', filterNganh); }
    if (filterPhuTrach.length > 0) { query = query.in('phu_trach', filterPhuTrach); countQuery = countQuery.in('phu_trach', filterPhuTrach); }
    if (filterLoaiDon.length > 0) { query = query.in('loai_don', filterLoaiDon); countQuery = countQuery.in('loai_don', filterLoaiDon); }
    if (filterTrangThai.length > 0) { query = query.in('trang_thai', filterTrangThai); countQuery = countQuery.in('trang_thai', filterTrangThai); }

    const { count, error: countError } = await countQuery;
    if (countError) throw countError;
    pagination.totalItems = count || 0;
    updatePaginationUI();
    
    const from = (pagination.page - 1) * pagination.limit;
    const to = from + pagination.limit - 1;
    query = query.range(from, to).order('thoi_gian', { ascending: false }).order('id');

    let { data, error } = await query;
    if (error) throw error;
    
    if (data.length === 0) {
      chitietTableBody.innerHTML = `<tr><td colspan="17" class="td-center">Không tìm thấy dữ liệu.</td></tr>`;
      return;
    }

    chitietTableBody.innerHTML = data.map(item => `
      <tr id="chitiet-row-${item.id}" class="selectable-row hover:bg-gray-50 dark:hover:bg-gray-700" onclick="toggleRowSelection('chitiet', '${item.id}', event)">
        <td class="td"><input type="checkbox" class="row-checkbox" data-view="chitiet" data-id="${item.id}"></td>
        <td class="td">${item.id}</td>
        <td class="td">${new Date(item.thoi_gian).toLocaleString('vi-VN')}</td>
        <td class="td">${item.ma_kho}</td>
        <td class="td">${item.ma_nx}</td>
        <td class="td font-medium">${item.ma_vach}</td>
        <td class="td">${item.ma_vt}</td>
        <td class="td">${item.ten_vt}</td>
        <td class="td">${item.lot}</td>
        <td class="td">${item.date ? new Date(item.date).toLocaleDateString('vi-VN') : ''}</td>
        <td class="td">${item.yeu_cau}</td>
        <td class="td font-semibold">${item.loai_don === 'Nhập' ? `+${item.so_luong}` : `-${item.so_luong}`}</td>
        <td class="td">${item.loai || ''}</td>
        <td class="td">${item.user || ''}</td>
        <td class="td">${item.muc_dich || ''}</td>
        <td class="td">${item.nganh || ''}</td>
        <td class="td">${item.phu_trach || ''}</td>
      </tr>
    `).join('');
    attachCheckboxListeners('chitiet');
  } catch (error) {
    console.error('Lỗi tải chi tiết:', error);
    showToast(`Lỗi tải chi tiết: ${error.message}`, 'error');
    chitietTableBody.innerHTML = `<tr><td colspan="17" class="td-center text-red-500">Lỗi: ${error.message}</td></tr>`;
  } finally {
    hideProgressBar();
  }
}
// ... (Hàm xóa chi tiết không cần vì đã tích hợp vào xóa đơn hàng)

// ===== 11. Logic Bộ Lọc (ĐÃ REFACTOR) =====
async function populateSanphamFilters() {
  try {
    const { data, error } = await supabase.from('SANPHAM').select('ma_vt, ten_vt, nganh, phu_trach');
    if (error) throw error;
    sanphamDataCache = data; // Cache dữ liệu
    
    populateCustomFilter('ma_vt', data, '#filter-sanpham');
    populateCustomFilter('ten_vt', data, '#filter-sanpham');
    populateCustomFilter('nganh', data, '#filter-sanpham');
    populateCustomFilter('phu_trach', data, '#filter-sanpham');

    sanphamFiltersPopulated = true;
  } catch (error) {
    console.error("Lỗi tải bộ lọc Sản phẩm:", error);
    showToast("Lỗi tải bộ lọc Sản phẩm", 'error');
  }
}
async function populateTonkhoFilters() {
    try {
        const { data, error } = await supabase.from('TONKHO_VIEW').select('ma_vt, lot, tinh_trang, nganh, phu_trach');
        if (error) throw error;
        
        populateCustomFilter('ma_vt', data, '#filter-tonkho');
        populateCustomFilter('lot', data, '#filter-tonkho');
        
        // Tồn cuối và Tình trạng là các giá trị cố định
        const tonCuoiData = [{ ton_cuoi: 'Có tồn (>0)', value: 'lonhon0' }, { ton_cuoi: 'Hết hàng (=0)', value: 'bang0' }];
        populateCustomFilter('ton_cuoi', tonCuoiData, '#filter-tonkho', 'ton_cuoi', 'value');
        
        populateCustomFilter('tinh_trang', data, '#filter-tonkho');
        populateCustomFilter('nganh', data, '#filter-tonkho');
        populateCustomFilter('phu_trach', data, '#filter-tonkho');
        
        tonkhoFiltersPopulated = true;
    } catch (error) {
        console.error("Lỗi tải bộ lọc Tồn Kho:", error);
        showToast("Lỗi tải bộ lọc Tồn Kho", 'error');
    }
}
async function populateDonhangFilters() {
    try {
        const { data, error } = await supabase.from('DONHANG').select('ma_kho, ma_nx');
        if (error) throw error;
        
        populateCustomFilter('ma_kho', data, '#filter-donhang');
        populateCustomFilter('ma_nx', data, '#filter-donhang');
        
        const loaiDonData = [{ loai_don: 'Nhập' }, { loai_don: 'Xuất' }];
        populateCustomFilter('loai_don', loaiDonData, '#filter-donhang');
        
        // Trạng thái sẽ được thêm sau nếu cần
        // populateCustomFilter('trang_thai', data, '#filter-donhang');
        
        setDefaultDateFilters('donhang'); // Đặt ngày mặc định
        
        donhangFiltersPopulated = true;
    } catch (error) {
        console.error("Lỗi tải bộ lọc Đơn Hàng:", error);
        showToast("Lỗi tải bộ lọc Đơn Hàng", 'error');
    }
}
async function populateChitietFilters() {
    try {
        const { data, error } = await supabase.from('CHITIET_DONHANG_VIEW').select('ma_kho, ma_nx, ma_vt, lot, nganh, phu_trach');
        if (error) throw error;
        
        populateCustomFilter('ma_kho', data, '#filter-chitiet');
        populateCustomFilter('ma_nx', data, '#filter-chitiet');
        populateCustomFilter('ma_vt', data, '#filter-chitiet');
        populateCustomFilter('lot', data, '#filter-chitiet');
        populateCustomFilter('nganh', data, '#filter-chitiet');
        populateCustomFilter('phu_trach', data, '#filter-chitiet');
        
        const loaiDonData = [{ loai_don: 'Nhập' }, { loai_don: 'Xuất' }];
        populateCustomFilter('loai_don', loaiDonData, '#filter-chitiet');
        // populateCustomFilter('trang_thai', data, '#filter-chitiet');

        setDefaultDateFilters('chitiet'); // Đặt ngày mặc định
        
        chitietFiltersPopulated = true;
    } catch (error) {
        console.error("Lỗi tải bộ lọc Chi Tiết:", error);
        showToast("Lỗi tải bộ lọc Chi Tiết", 'error');
    }
}
function setDefaultDateFilters(view) {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    const fromInput = document.querySelector(`#filter-${view} input[name="thoi_gian_from"]`);
    const toInput = document.querySelector(`#filter-${view} input[name="thoi_gian_to"]`);

    if (fromInput && toInput) {
        fromInput.value = firstDayOfMonth.toISOString().split('T')[0];
        toInput.value = today.toISOString().split('T')[0];
        
        // Cập nhật state
        if (view === 'donhang') {
            donhangFilterState.thoi_gian_from = fromInput.value;
            donhangFilterState.thoi_gian_to = toInput.value;
        } else if (view === 'chitiet') {
            chitietFilterState.thoi_gian_from = fromInput.value;
            chitietFilterState.thoi_gian_to = toInput.value;
        }
    }
}
function setupFilterListeners() {
    // Listener cho nút "Hiện/Ẩn bộ lọc"
    toolbarToggleFilter.addEventListener('click', () => {
        filterPanel.classList.toggle('hidden');
        const isHidden = filterPanel.classList.contains('hidden');
        toolbarToggleFilterText.textContent = isHidden ? 'Hiện bộ lọc' : 'Ẩn bộ lọc';
    });

    // Lấy tất cả các bộ lọc custom và gắn listener
    customFilters = document.querySelectorAll('.custom-filter');
    customFilters.forEach(filter => {
        const toggle = filter.querySelector('.custom-filter-toggle');
        const panel = filter.querySelector('.custom-filter-panel');
        const searchInput = filter.querySelector('.custom-filter-search');
        const applyButton = filter.querySelector('.custom-filter-apply');
        const column = filter.dataset.filterColumn;

        toggle.addEventListener('click', () => {
            // Đóng tất cả các panel khác trước khi mở panel này
            customFilters.forEach(f => {
                if (f !== filter) {
                    f.querySelector('.custom-filter-panel').classList.add('hidden');
                }
            });
            panel.classList.toggle('hidden');
        });

        if (searchInput) {
            searchInput.addEventListener('input', () => {
                const term = searchInput.value.toLowerCase();
                panel.querySelectorAll('.custom-filter-item').forEach(item => {
                    const label = item.querySelector('label').textContent.toLowerCase();
                    item.style.display = label.includes(term) ? 'flex' : 'none';
                });
            });
        }
        
        applyButton.addEventListener('click', () => {
            const stateSet = getStateSetForFilter(currentView, column);
            if (!stateSet) return;
            
            stateSet.clear(); // Xóa các lựa chọn cũ
            const checkboxes = panel.querySelectorAll('.custom-filter-list input[type="checkbox"]:checked');
            checkboxes.forEach(cb => {
                stateSet.add(cb.value);
            });

            updateCustomFilterText(column, filter);
            panel.classList.add('hidden'); // Đóng panel sau khi áp dụng
            
            // Tải lại dữ liệu
            pagination.page = 1;
            loadDataForCurrentView();
        });
    });
    
    // Gắn listener cho các input date
    document.querySelectorAll('#filter-donhang input[type="date"], #filter-chitiet input[type="date"]').forEach(input => {
        input.addEventListener('change', (e) => {
            if (currentView === 'donhang') {
                donhangFilterState[e.target.name] = e.target.value;
            } else if (currentView === 'chitiet') {
                chitietFilterState[e.target.name] = e.target.value;
            }
            pagination.page = 1;
            loadDataForCurrentView();
        });
    });

    // Đóng panel khi click ra ngoài
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.custom-filter')) {
            customFilters.forEach(f => {
                f.querySelector('.custom-filter-panel').classList.add('hidden');
            });
        }
    });
}
function populateCustomFilter(column, data, containerSelector, displayKey = column, valueKey = column) {
    const filterElement = document.querySelector(`${containerSelector} [data-filter-column="${column}"]`);
    if (!filterElement) return;

    const listElement = filterElement.querySelector('.custom-filter-list');
    const uniqueValues = [...new Set(data.map(item => item[valueKey]).filter(Boolean))].sort();

    listElement.innerHTML = uniqueValues.map(value => {
        // Tìm display text tương ứng nếu displayKey và valueKey khác nhau
        const displayValue = (displayKey !== valueKey) ? data.find(item => item[valueKey] === value)[displayKey] : value;
        
        return `
            <div class="custom-filter-item">
                <input type="checkbox" id="filter-${column}-${value}" value="${value}">
                <label for="filter-${column}-${value}" class="w-full">${displayValue}</label>
            </div>
        `;
    }).join('');
}
function getStateSetForFilter(view, column) {
    if (view === 'sanpham') return sanphamFilterState[column];
    if (view === 'tonkho') return tonkhoFilterState[column];
    if (view === 'donhang') return donhangFilterState[column];
    if (view === 'chitiet') return chitietFilterState[column];
    return null;
}
function updateCustomFilterText(column, filterElement) {
    const stateSet = getStateSetForFilter(currentView, column);
    const textElement = filterElement.querySelector('.custom-filter-text');
    
    if (stateSet.size === 0) {
        textElement.textContent = `Tất cả`; // Reset text
    } else if (stateSet.size === 1) {
        textElement.textContent = stateSet.values().next().value;
    } else {
        textElement.textContent = `${stateSet.size} lựa chọn`;
    }
}

// ===== 12. Logic Chỉnh sửa Nội tuyến (Inline Editing) (ĐÃ THAY ĐỔI) =====
function showInlineEditControls() {
    toolbar.save.hidden = false;
    toolbar.cancel.hidden = false;
    toolbar.add.hidden = true;
    toolbar.edit.hidden = true;
    toolbar.delete.hidden = true;
    toolbar.excel.hidden = true;
    toolbarToggleFilter.hidden = true;
    toolbar.sync.disabled = true;
    toolbar.search.disabled = true;
}
function hideInlineEditControls() {
    toolbar.save.hidden = true;
    toolbar.cancel.hidden = true;
    toolbar.add.hidden = false;
    toolbar.edit.hidden = false;
    toolbar.delete.hidden = false;
    toolbar.excel.hidden = false;
    toolbarToggleFilter.hidden = false;
    toolbar.sync.disabled = false;
    toolbar.search.disabled = false;
    currentEditState = { view: null, id: null, mode: null };
    clearSelection(); // Bỏ chọn hàng khi thoát chế độ edit
    loadDataForCurrentView(); // Tải lại để xóa các hàng input trống
}
// Các hàm create/edit/save/delete cho từng view (sanpham, tonkho)
// ... (tạm thời giữ nguyên)

// ===== CẬP NHẬT: 13. Logic Modal Đơn Hàng =====

/**
 * Mở modal để tạo mới hoặc chỉnh sửa đơn hàng
 * @param {object|null} donhangData Dữ liệu đơn hàng để chỉnh sửa, null nếu tạo mới
 */
async function openDonhangModal(donhangData = null) {
    // 1. Reset modal
    donhangModal.detailsBody.innerHTML = '';
    donhangModal.form.reset(); 
    
    // 2. Tải dữ liệu cần thiết (nếu chưa có)
    if (sanphamDataForLookup.length === 0) {
        const { data, error } = await supabase.from('SANPHAM').select('ma_vt, ten_vt, nganh');
        if (error) {
            showToast('Lỗi tải danh sách sản phẩm.', 'error');
            return;
        }
        sanphamDataForLookup = data;
        // Populate datalist ngành hàng
        const uniqueNganh = [...new Set(data.map(item => item.nganh).filter(Boolean))];
        donhangModal.nganhDatalist.innerHTML = uniqueNganh.map(ng => `<option value="${ng}"></option>`).join('');
    }
    if (tonkhoDataForLookup.length === 0) {
        const { data, error } = await supabase.from('TONKHO_VIEW').select('ma_vt, lot, date, ma_vach, ton_cuoi');
        if (error) {
            showToast('Lỗi tải dữ liệu tồn kho.', 'error');
            return;
        }
        tonkhoDataForLookup = data.filter(item => item.ton_cuoi > 0); // Chỉ lấy hàng có tồn
    }

    // 3. Thiết lập trạng thái (Thêm mới / Chỉnh sửa)
    if (donhangData) {
        // CHỈNH SỬA
        currentEditingDonhangId = donhangData.ma_nx;
        donhangModal.title.textContent = `Chỉnh Sửa Đơn Hàng: ${donhangData.ma_nx}`;
        
        // Populate form
        donhangModal.loaiDon.value = donhangData.loai_don;
        donhangModal.thoiGian.value = new Date(donhangData.thoi_gian).toISOString().split('T')[0];
        donhangModal.maKho.value = donhangData.ma_kho || '';
        donhangModal.maNx.value = donhangData.ma_nx || '';
        donhangModal.user.value = donhangData.user || '';
        donhangModal.nganh.value = donhangData.nganh || '';
        // CẬP NHẬT: Lấy các trường mới
        donhangModal.form.querySelector('[name="muc_dich"]').value = donhangData.muc_dich || '';
        donhangModal.form.querySelector('[name="dia_chi"]').value = donhangData.dia_chi || '';
        donhangModal.form.querySelector('[name="ghi_chu"]').value = donhangData.ghi_chu || '';
        donhangModal.form.querySelector('[name="order"]').value = donhangData.order || '';
        donhangModal.form.querySelector('[name="pkl"]').value = donhangData.pkl || '';
        donhangModal.form.querySelector('[name="done"]').value = donhangData.done || '';
        donhangModal.form.querySelector('[name="image"]').value = donhangData.image || '';


        // Tải và hiển thị chi tiết
        const { data: details, error: detailsError } = await supabase
            .from('CHITIET_DONHANG_VIEW')
            .select('*')
            .eq('ma_nx', donhangData.ma_nx)
            .order('id', { ascending: true });

        if (detailsError) {
            showToast('Lỗi tải chi tiết đơn hàng.', 'error');
            return;
        }
        
        details.forEach(detail => {
            const tonkhoItem = tonkhoDataForLookup.find(tk => tk.ma_vach === detail.ma_vach) || {};
            const tonHienTai = (tonkhoItem.ton_cuoi || 0) + (donhangData.loai_don === 'Xuất' ? detail.so_luong : 0);
            
            addDonhangDetailRow({
                ma_vt: detail.ma_vt,
                ten_vt: detail.ten_vt,
                lot: detail.lot,
                date: detail.date,
                yeu_cau: detail.yeu_cau,
                so_luong: detail.so_luong,
                loai: detail.loai || '',
                ton_hien_tai: tonHienTai,
                ma_vach: detail.ma_vach
            });
        });
        
    } else {
        // THÊM MỚI
        currentEditingDonhangId = null;
        donhangModal.title.textContent = 'Tạo Đơn Hàng Mới';
        
        // Đặt giá trị mặc định
        donhangModal.thoiGian.value = new Date().toISOString().split('T')[0];
        donhangModal.maKho.value = 'OUT.JNJ643205'; // Mặc định
        
        addDonhangDetailRow(); 
        addDonhangDetailRow();
        addDonhangDetailRow();
    }
    
    // 4. Hiển thị modal
    updateDonhangModalUI(); // Cập nhật UI lần đầu
    donhangModal.element.classList.remove('hidden');
}

/**
 * Cập nhật giao diện của modal đơn hàng dựa trên "Loại Đơn"
 */
function updateDonhangModalUI() {
    const isXuat = donhangModal.loaiDon.value === 'Xuất';
    donhangModal.maNxLabel.textContent = isXuat ? 'Mã Xuất*' : 'Mã Nhập*';
    donhangModal.userLabel.textContent = isXuat ? 'Xuất Cho*' : 'Nhập Từ*';
    donhangModal.quantityHeader.textContent = isXuat ? 'Xuất' : 'Nhập';
    donhangModal.remainingStockHeader.style.display = isXuat ? '' : 'none';
    
    // Cập nhật các cột trong bảng chi tiết
    document.querySelectorAll('#donhang-modal-details-table .dh-ton-sau-xuat-cell').forEach(cell => {
        cell.style.display = isXuat ? '' : 'none';
    });

    updateTotalQuantity();
}

/**
 * Thêm một hàng mới vào bảng chi tiết đơn hàng
 * @param {object|null} detailData Dữ liệu để điền vào hàng, null nếu là hàng trống
 */
function addDonhangDetailRow(detailData = {}) {
    const row = document.createElement('tr');
    row.draggable = true;
    const stt = donhangModal.detailsBody.rows.length + 1;
    
    const tonSauXuat = (detailData.ton_hien_tai || 0) - (detailData.so_luong || 0);
    const dateObj = detailData.date ? new Date(detailData.date) : null;
    const formattedDate = dateObj ? `${dateObj.getDate().toString().padStart(2, '0')}/${(dateObj.getMonth() + 1).toString().padStart(2, '0')}/${dateObj.getFullYear()}` : '';

    row.innerHTML = `
        <td class="td-modal text-center text-gray-500">${stt}</td>
        <td class="td-modal"><input type="text" name="ma_vt" class="modal-table-input highlight-required" placeholder="Tìm mã..." value="${detailData.ma_vt || ''}"></td>
        <td class="td-modal"><input type="text" name="ten_vt" class="modal-table-input" value="${detailData.ten_vt || ''}" readonly></td>
        <td class="td-modal"><input type="text" name="lot" class="modal-table-input highlight-required" placeholder="Chọn LOT" value="${detailData.lot || ''}"></td>
        <td class="td-modal"><input type="text" name="date" class="modal-table-input" value="${formattedDate}" readonly></td>
        <td class="td-modal"><input type="number" name="yeu_cau" class="modal-table-input" value="${detailData.yeu_cau || '0'}" min="0"></td>
        <td class="td-modal"><input type="number" name="so_luong" class="modal-table-input highlight-required" value="${detailData.so_luong || '0'}" min="0"></td>
        <td class="td-modal dh-ton-sau-xuat-cell"><input type="text" name="ton_sau_xuat" class="modal-table-input" value="${tonSauXuat}" readonly></td>
        <td class="td-modal"><input type="text" name="ma_vach" class="modal-table-input" value="${detailData.ma_vach || ''}" readonly></td>
        <td class="td-modal">
            <select name="loai" class="modal-table-input">
                <option value="">-- Chọn --</option>
                <option value="Tiêu Hao" ${detailData.loai === 'Tiêu Hao' ? 'selected' : ''}>Tiêu Hao</option>
                <option value="Hàng Hư" ${detailData.loai === 'Hàng Hư' ? 'selected' : ''}>Hàng Hư</option>
                <option value="Trưng Bày" ${detailData.loai === 'Trưng Bày' ? 'selected' : ''}>Trưng Bày</option>
                <option value="Trả Hàng" ${detailData.loai === 'Trả Hàng' ? 'selected' : ''}>Trả Hàng</option>
            </select>
        </td>
        <td class="td-modal text-center">
            <button type="button" class="dh-delete-detail-row p-1 text-red-500 hover:text-red-700">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mx-auto" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" /></svg>
            </button>
        </td>
    `;
    donhangModal.detailsBody.appendChild(row);
    updateDonhangModalUI(); // Cập nhật lại UI (quan trọng cho cột Tồn Sau)
}

/**
 * Cập nhật lại số thứ tự cho các hàng
 */
function updateDetailRowSTT() {
    const rows = donhangModal.detailsBody.querySelectorAll('tr');
    rows.forEach((row, index) => {
        const sttCell = row.querySelector('.td-modal'); // STT là ô đầu tiên
        if (sttCell) {
            sttCell.textContent = index + 1;
        }
    });
}
/**
 * Tính và cập nhật tổng số lượng
 */
function updateTotalQuantity() {
    let total = 0;
    donhangModal.detailsBody.querySelectorAll('input[name="so_luong"]').forEach(input => {
        total += parseInt(input.value) || 0;
    });
    donhangModal.totalQuantity.textContent = total;
}

/**
 * SỬA LỖI & TỐI ƯU: Hiển thị panel gợi ý
 * @param {HTMLInputElement} input - Ô input đang được focus.
 * @param {Array<string>} suggestions - Mảng các chuỗi gợi ý.
 * @param {Function} onSelect - Callback khi một mục được chọn.
 */
function showSuggestionPanel(input, suggestions, onSelect) {
    hideSuggestionPanel(); // Đóng panel cũ nếu có

    if (suggestions.length === 0) return;

    const parentTd = input.closest('td');
    if (!parentTd) return;

    const panel = document.createElement('div');
    panel.className = 'suggestion-panel';
    
    suggestions.forEach(suggestion => {
        const item = document.createElement('div');
        item.className = 'suggestion-item';
        item.textContent = suggestion;
        item.addEventListener('mousedown', (e) => { // Dùng mousedown để không bị mất focus của input
            e.preventDefault();
            onSelect(suggestion);
            hideSuggestionPanel();
        });
        panel.appendChild(item);
    });

    // Gắn panel vào ô TD cha để CSS xử lý vị trí và chiều rộng
    parentTd.appendChild(panel);
    currentSuggestionPanel = panel;
}


/**
 * Ẩn panel gợi ý hiện tại
 */
function hideSuggestionPanel() {
    if (currentSuggestionPanel) {
        currentSuggestionPanel.remove();
        currentSuggestionPanel = null;
    }
}


// ... (Các hàm CRUD khác)

// ===== 14. Event Listeners =====
function setupEventListeners() {
  // Navigation
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      showView(link.dataset.view);
    });
  });

  // Toolbar (Refactored)
  toolbar.add.addEventListener('click', handleToolbarAdd);
  toolbar.edit.addEventListener('click', handleToolbarEdit);
  toolbar.delete.addEventListener('click', handleToolbarDelete);
  toolbar.search.addEventListener('input', handleToolbarSearch);
  toolbar.clearFilter.addEventListener('click', handleToolbarClearFilter);
  toolbar.save.addEventListener('click', () => {
    // Logic save sẽ phụ thuộc vào view, tạm thời gọi chung
    // saveInlineChanges(); 
  });
  toolbar.cancel.addEventListener('click', hideInlineEditControls);

  // MỚI: Tải Excel
  toolbar.excel.addEventListener('click', () => {
    if (currentView === 'sanpham') exportToExcel(sanphamDataCache, 'DanhSachSanPham');
    // Cần tạo hàm để lấy toàn bộ dữ liệu cho các view khác
    // exportToExcel(tonkhoDataCache, 'TonKho'); 
  });

  // MỚI: Sync
  toolbar.sync.addEventListener('click', () => {
     loadDataForCurrentView();
     showToast('Đã đồng bộ dữ liệu mới nhất!', 'success');
  });

  // MỚI: Phân trang
  paginationControls.limitSelect.addEventListener('change', (e) => {
    pagination.limit = parseInt(e.target.value);
    pagination.page = 1; // Reset về trang 1 khi đổi limit
    loadDataForCurrentView();
  });
  paginationControls.pageInput.addEventListener('change', (e) => {
    let newPage = parseInt(e.target.value);
    if (newPage < 1) newPage = 1;
    if (newPage > pagination.totalPages) newPage = pagination.totalPages;
    pagination.page = newPage;
    loadDataForCurrentView();
  });
  paginationControls.prevButton.addEventListener('click', () => {
    if (pagination.page > 1) {
      pagination.page--;
      loadDataForCurrentView();
    }
  });
  paginationControls.nextButton.addEventListener('click', () => {
    if (pagination.page < pagination.totalPages) {
      pagination.page++;
      loadDataForCurrentView();
    }
  });

  setupFilterListeners();
  setupSettingsListeners(); // MỚI
  setupDonhangModalListeners(); // MỚI
}

/**
 * MỚI: Gắn các listener cho cài đặt (cỡ chữ, dark mode)
 */
function setupSettingsListeners() {
    // Mở/đóng Popover Cài đặt
    settingsToggleButton.addEventListener('click', () => {
        settingsPopover.classList.toggle('hidden');
    });
    // Đóng Popover khi click ra ngoài
    document.addEventListener('click', (e) => {
        if (!settingsMenu.contains(e.target)) {
            settingsPopover.classList.add('hidden');
        }
    });

    // Thay đổi cỡ chữ
    fontSizeSelect.addEventListener('change', (e) => {
        document.documentElement.style.fontSize = `${e.target.value}%`;
    });

    // Chế độ tối
    darkModeToggle.addEventListener('click', () => {
        const isDarkMode = document.documentElement.classList.toggle('dark');
        darkModeToggle.setAttribute('aria-checked', isDarkMode);
        localStorage.setItem('darkMode', isDarkMode ? 'enabled' : 'disabled');
    });

    // Kiểm tra chế độ tối đã lưu
    if (localStorage.getItem('darkMode') === 'enabled') {
        document.documentElement.classList.add('dark');
        darkModeToggle.setAttribute('aria-checked', 'true');
    }
}

/**
 * CẬP NHẬT: Gắn các listener cho modal đơn hàng
 */
function setupDonhangModalListeners() {
    // Nút đóng và hủy
    const closeModal = () => donhangModal.element.classList.add('hidden');
    donhangModal.closeButton.addEventListener('click', closeModal);
    donhangModal.cancelButton.addEventListener('click', closeModal);
    donhangModal.element.addEventListener('click', (e) => { // Đóng khi click vào nền
        if (e.target === donhangModal.element) closeModal();
    });

    // Nút lưu
    donhangModal.saveButton.addEventListener('click', saveDonhang);

    // Thay đổi Loại Đơn
    donhangModal.loaiDon.addEventListener('change', updateDonhangModalUI);

    // Nút thêm hàng chi tiết
    donhangModal.addDetailRowButton.addEventListener('click', () => addDonhangDetailRow());

    // Listener chung cho bảng chi tiết (event delegation)
    donhangModal.detailsBody.addEventListener('click', (e) => {
        // Nút xóa hàng
        const deleteButton = e.target.closest('.dh-delete-detail-row');
        if (deleteButton) {
            deleteButton.closest('tr').remove();
            updateDetailRowSTT();
            updateTotalQuantity();
        }
    });
    
    // THAY ĐỔI: Tách listener cho các sự kiện input khác nhau
    let activeInput = null;

    // Focus: Xác định ô nào đang được focus để hiển thị gợi ý
    donhangModal.detailsBody.addEventListener('focusin', (e) => {
        if (e.target.matches('input[name="ma_vt"], input[name="lot"]')) {
            activeInput = e.target;
            handleModalInputChange(e); // Trigger gợi ý ngay khi focus
        } else {
            activeInput = null;
            hideSuggestionPanel();
        }
    });
    
     // Blur: Ẩn gợi ý khi không còn focus
    donhangModal.detailsBody.addEventListener('focusout', (e) => {
        // Dùng setTimeout để cho phép click vào suggestion item
        setTimeout(() => {
            // Kiểm tra xem focus có còn trong bảng gợi ý không
            if (currentSuggestionPanel && !currentSuggestionPanel.contains(document.activeElement)) {
                 hideSuggestionPanel();
            }
        }, 100);
    });

    // Input: Lọc và tính toán khi người dùng gõ
    donhangModal.detailsBody.addEventListener('input', (e) => {
        if (e.target.matches('input[name="ma_vt"], input[name="lot"], input[name="so_luong"]')) {
            handleModalInputChange(e);
        }
    });

    // Drag & Drop
    donhangModal.detailsBody.addEventListener('dragstart', e => {
        draggedRow = e.target;
        e.target.classList.add('dragging');
    });
    donhangModal.detailsBody.addEventListener('dragend', e => {
        draggedRow?.classList.remove('dragging');
        draggedRow = null;
        document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    });
    donhangModal.detailsBody.addEventListener('dragover', e => {
        e.preventDefault();
        const targetRow = e.target.closest('tr');
        if (targetRow && targetRow !== draggedRow) {
            document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
            targetRow.classList.add('drag-over');
        }
    });
    donhangModal.detailsBody.addEventListener('drop', e => {
        e.preventDefault();
        const targetRow = e.target.closest('tr');
        if (targetRow && targetRow !== draggedRow) {
            donhangModal.detailsBody.insertBefore(draggedRow, targetRow);
            updateDetailRowSTT();
        }
        document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    });
}

/**
 * Xử lý sự kiện thay đổi trên các input trong modal
 * @param {Event} e - Sự kiện (input, focus, etc.)
 */
function handleModalInputChange(e) {
    const input = e.target;
    const row = input.closest('tr');
    if (!row) return;

    const maVtInput = row.querySelector('input[name="ma_vt"]');
    const tenVtInput = row.querySelector('input[name="ten_vt"]');
    const lotInput = row.querySelector('input[name="lot"]');
    const dateInput = row.querySelector('input[name="date"]');
    const soLuongInput = row.querySelector('input[name="so_luong"]');
    const tonSauInput = row.querySelector('input[name="ton_sau_xuat"]');
    const maVachInput = row.querySelector('input[name="ma_vach"]');

    // === Logic cho Mã VT ===
    if (input.name === 'ma_vt') {
        const term = input.value.toLowerCase();
        // Lọc sản phẩm
        const matchingSanpham = sanphamDataForLookup.filter(sp => sp.ma_vt.toLowerCase().includes(term));
        const suggestions = matchingSanpham.map(sp => sp.ma_vt).slice(0, 10); // Lấy 10 kết quả đầu
        
        showSuggestionPanel(input, suggestions, (selectedValue) => {
            const selectedProduct = sanphamDataForLookup.find(sp => sp.ma_vt === selectedValue);
            if (selectedProduct) {
                maVtInput.value = selectedProduct.ma_vt;
                tenVtInput.value = selectedProduct.ten_vt;
                // Xóa thông tin cũ khi đổi Mã VT
                lotInput.value = '';
                dateInput.value = '';
                soLuongInput.value = '0';
                tonSauInput.value = '';
                maVachInput.value = '';
                lotInput.focus(); // Chuyển focus sang ô LOT
            }
        });
    }

    // === Logic cho Số LOT ===
    if (input.name === 'lot') {
        const currentMaVt = maVtInput.value;
        if (!currentMaVt) {
            showToast('Vui lòng chọn Mã Vật Tư trước.', 'warning');
            hideSuggestionPanel();
            return;
        }
        
        const term = input.value.toLowerCase();
        const availableLots = tonkhoDataForLookup.filter(tk => 
            tk.ma_vt === currentMaVt && tk.lot.toLowerCase().includes(term)
        );
        const suggestions = [...new Set(availableLots.map(tk => tk.lot))]; // Lấy các lot duy nhất

        showSuggestionPanel(input, suggestions, (selectedValue) => {
             const selectedTonkho = availableLots.find(tk => tk.lot === selectedValue);
             if (selectedTonkho) {
                 lotInput.value = selectedTonkho.lot;
                 const dateObj = new Date(selectedTonkho.date);
                 dateInput.value = `${dateObj.getDate().toString().padStart(2, '0')}/${(dateObj.getMonth() + 1).toString().padStart(2, '0')}/${dateObj.getFullYear()}`;
                 maVachInput.value = selectedTonkho.ma_vach;
                 tonSauInput.value = selectedTonkho.ton_cuoi; // Ban đầu, tồn sau = tồn cuối
                 
                 // Tự động điền số lượng
                 soLuongInput.value = selectedTonkho.ton_cuoi;
                 soLuongInput.max = selectedTonkho.ton_cuoi; // Set max value
                 soLuongInput.dispatchEvent(new Event('input')); // Trigger input event để cập nhật tổng
                 soLuongInput.select(); // Chọn toàn bộ text để dễ sửa
             }
        });
    }

    // === Logic cho Số Lượng ===
    if (input.name === 'so_luong') {
        const lot = lotInput.value;
        const maVt = maVtInput.value;
        const tonkhoItem = tonkhoDataForLookup.find(tk => tk.ma_vt === maVt && tk.lot === lot);
        
        if (tonkhoItem) {
            const tonHienTai = parseInt(tonkhoItem.ton_cuoi) || 0;
            const soLuongXuat = parseInt(input.value) || 0;

            if (soLuongXuat > tonHienTai) {
                showToast(`Số lượng xuất (${soLuongXuat}) không được lớn hơn tồn kho (${tonHienTai}).`, 'warning');
                input.value = tonHienTai;
            }
            tonSauInput.value = tonHienTai - (parseInt(input.value) || 0);
        }
        updateTotalQuantity(); // Cập nhật tổng số lượng
    }
}


// ===== 15. Khởi tạo ứng dụng =====
document.addEventListener('DOMContentLoaded', () => {
  showView('sanpham');
  setupEventListeners();
});

// ... (Các hàm tiện ích khác nếu cần)
function updateLastSyncTime() {
    const now = new Date();
    lastSyncTimeSpan.textContent = `Cập nhật lúc ${now.toLocaleTimeString('vi-VN')}`;
}
function showProgressBar() {
    loadingProgressBar.style.display = 'block';
}
function hideProgressBar() {
    loadingProgressBar.style.display = 'none';
}
/**
 * MỚI: Tải dữ liệu ra file Excel
 */
function exportToExcel(data, fileName) {
    if (!data || data.length === 0) {
        showToast("Không có dữ liệu để xuất.", 'warning');
        return;
    }
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
    XLSX.writeFile(workbook, `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`);
    showToast(`Đã xuất thành công file ${fileName}.xlsx`, 'success');
}