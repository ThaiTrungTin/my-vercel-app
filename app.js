
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
let nganhDataCache = []; // MỚI: Cache Ngành cho modal Đơn Hàng
let donhangModalState = { mode: 'add', originalMaNx: null }; // MỚI

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

// Modals & Forms
const confirmModal = document.getElementById('confirm-modal');
const confirmMessage = document.getElementById('confirm-message');
const confirmOkButton = document.getElementById('confirm-ok');
const confirmCancelButton = document.getElementById('confirm-cancel');
let confirmCallback = null;

// MỚI: DOM cho Modal Đơn Hàng
const donhangModal = {
    modal: document.getElementById('add-donhang-modal'),
    closeButton: document.getElementById('donhang-modal-close'),
    cancelButton: document.getElementById('donhang-modal-cancel'),
    saveButton: document.getElementById('donhang-modal-save'),
    addProductButton: document.getElementById('donhang-modal-add-product'),
    productsBody: document.getElementById('donhang-modal-products-body'),
    loaiDonSelect: document.getElementById('donhang-modal-loai_don'),
    labelMaNx: document.getElementById('donhang-modal-label-ma_nx'),
    labelUser: document.getElementById('donhang-modal-label-user'),
    headerSoLuong: document.getElementById('donhang-modal-header-so_luong'),
    nganhInput: document.getElementById('donhang-modal-nganh'),
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

  // MỚI: Ẩn/hiện các nút CRUD cho view Chi Tiết
  const crudButtons = [toolbar.add, toolbar.edit, toolbar.delete];
  const saveCancelButtons = [toolbar.save, toolbar.cancel];

  if (viewId === 'chitiet') {
      crudButtons.forEach(btn => btn.style.display = 'none');
      saveCancelButtons.forEach(btn => btn.style.display = 'none'); // Cũng ẩn luôn nút lưu/hủy
  } else {
      crudButtons.forEach(btn => btn.style.display = ''); // Reset về mặc định
      // Việc hiển thị nút lưu/hủy được quản lý bởi hàm show/hideInlineEditControls
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
function handleToolbarAdd() {
  if (currentEditState.mode) return; 

  // MỚI: Mở modal cho Đơn Hàng
  if (currentView === 'donhang') {
    openDonhangModal('add');
    return;
  }
  
  // Logic cũ cho các view khác
  if (currentEditState.mode !== 'add') {
    showToast('Đang ở chế độ thêm mới. Nhấn "Lưu" hoặc "Hủy" để thoát.', 'warning', 5000);
    showInlineEditControls();
    currentEditState.view = currentView;
    currentEditState.mode = 'add';
  }

  switch (currentView) {
    case 'sanpham': createNewSanphamRow(); break;
    case 'tonkho': createNewTonkhoRow(); break;
  }
}

function handleToolbarEdit() {
  if (!selectedItem.id || currentEditState.mode) return;
  const { view, id } = selectedItem;
  // THÊM MỚI: Toast
  showToast('Đang ở chế độ chỉnh sửa. Nhấn "Lưu" hoặc "Hủy" để thoát.', 'warning', 5000);
  switch (view) {
    case 'sanpham': editSanpham(id); break;
    case 'tonkho': editTonkho(id); break;
    case 'donhang': editDonhang(id); break;
    // case 'chitiet': (Bị ẩn)
  }
}

function handleToolbarDelete() {
  if (!selectedItem.id || currentEditState.mode) return;
  const { view, id } = selectedItem;
  switch (view) {
    case 'sanpham': deleteSanpham(id); break;
    case 'tonkho': deleteTonkho(id); break;
    case 'donhang': deleteDonhang(id); break;
    case 'chitiet': deleteChitiet(id); break;
  }
}

function handleToolbarSearch() {
  if (currentEditState.mode) return; // Không tìm kiếm khi đang edit
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    pagination.page = 1;
    paginationControls.pageInput.value = 1;
    loadDataForCurrentView();
  }, 300);
}

function handleToolbarClearFilter() {
    if (currentEditState.mode) return;
    toolbar.search.value = '';
    
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
        setDefaultDateFilters('donhang');
    } else if (currentView === 'chitiet') {
        stateToReset = chitietFilterState = { thoi_gian_from: '', thoi_gian_to: '', ma_kho: new Set(), ma_nx: new Set(), ma_vt: new Set(), lot: new Set(), nganh: new Set(), phu_trach: new Set(), loai_don: new Set(), trang_thai: new Set() };
        filterSelector = '#filter-chitiet';
        setDefaultDateFilters('chitiet');
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
        if (!e.target.checked) clearSelection();
      });
    });
  }
}

/**
 * MỚI: Xử lý khi click vào TR (toàn bộ hàng)
 */
function toggleRowSelection(view, id, event) {
  if (currentEditState.mode) return; 

  if (event.target.closest('input, a, button, select')) return;

  const checkbox = document.querySelector(`.row-checkbox[data-view="${view}"][data-id="${id}"]`);
  if (checkbox) {
    checkbox.click();
  }
}

function handleCheckboxClick(event, view) {
  if (currentEditState.mode) {
    event.target.checked = !event.target.checked;
    return;
  }

  const cb = event.target;
  const id = cb.dataset.id;

  if (cb.checked) {
    selectRow(view, id);
  } else {
    clearSelection();
  }
}

function selectRow(view, id) {
  if (selectedItem.id && selectedItem.id !== id) {
    const oldRow = document.getElementById(`${selectedItem.view}-row-${selectedItem.id}`);
    if (oldRow) oldRow.classList.remove('selected');
    const oldCb = document.querySelector(`.row-checkbox[data-id="${selectedItem.id}"]`);
    if (oldCb) oldCb.checked = false;
  }

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
function showToast(message, type = 'success', duration = 3000) {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
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

  setTimeout(() => {
    toast.classList.add('show');
  }, 10);

  setTimeout(() => {
    toast.classList.remove('show');
    toast.classList.add('hide');
    toast.addEventListener('transitionend', () => {
      toast.remove();
    });
  }, duration);
}

// ===== MỚI: 6.5. Cập nhật UI Phân trang =====
function updatePaginationUI() {
  const { page, limit, totalItems } = pagination;
  
  pagination.totalPages = Math.max(1, Math.ceil(totalItems / limit));
  
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
  paginationControls.pageInput.max = pagination.totalPages;
}


// ===== 7. CRUD cho SẢN PHẨM (SANPHAM) =====
async function loadSanpham() {
  clearSelection();
  const searchTerm = toolbar.search.value.toLowerCase();

  const filterMaVt = Array.from(sanphamFilterState.ma_vt);
  const filterTenVt = Array.from(sanphamFilterState.ten_vt);
  const filterNganh = Array.from(sanphamFilterState.nganh);
  const filterPhuTrach = Array.from(sanphamFilterState.phu_trach);

  try {
    let query = supabase.from('SANPHAM').select('*');
    let countQuery = supabase.from('SANPHAM').select('*', { count: 'exact', head: true });

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
  }
  
  updateLastSyncTime();
}

async function editSanpham(ma_vt) {
  try {
    let { data, error } = await supabase.from('SANPHAM').select('*').eq('ma_vt', ma_vt).single();
    if (error) throw error;

    const row = document.getElementById(`sanpham-row-${ma_vt}`);
    row.innerHTML = createEditableRowContents('sanpham', data, true);
    row.setAttribute('data-editing', 'true');

    currentEditState = { view: 'sanpham', id: ma_vt, mode: 'edit' };
    showInlineEditControls();
  } catch (error) {
    console.error('Lỗi lấy dữ liệu sửa:', error);
    showToast(`Lỗi lấy dữ liệu sửa: ${error.message}`, 'error');
  }
}

function createNewSanphamRow() {
  const tableBody = document.getElementById('sanpham-table-body');
  const newId = `new-${crypto.randomUUID()}`;
  const rowHtml = `<tr id="sanpham-row-${newId}" data-editing="true">${createEditableRowContents('sanpham', {}, false)}</tr>`;
  tableBody.insertAdjacentHTML('afterbegin', rowHtml);
  const newRow = document.getElementById(`sanpham-row-${newId}`);
  newRow.querySelector('input[name="ma_vt"]').focus();
  return newRow;
}

async function saveSanpham(data, mode, id) {
  const cleanData = {
    ma_vt: data.ma_vt,
    ten_vt: data.ten_vt,
    nganh: data.nganh || null,
    phu_trach: data.phu_trach || null
  };

  if (!cleanData.ten_vt || !cleanData.nganh || !cleanData.phu_trach) {
    showConfirm('Lỗi: Tên VT, Ngành, và Phụ trách không được để trống.', () => {}, true);
    return false;
  }

  if (mode === 'add' || (mode === 'edit' && data.ma_vt !== id)) {
    if (!cleanData.ma_vt) {
        showConfirm('Lỗi: Mã VT không được để trống khi thêm mới hoặc thay đổi.', () => {}, true);
        return false;
    }
    
    const { data: existing, error: checkError } = await supabase
      .from('SANPHAM')
      .select('ma_vt')
      .eq('ma_vt', cleanData.ma_vt)
      .maybeSingle();

    if (checkError) throw checkError;

    if (existing) {
      showConfirm(`Lỗi: Mã VT '${cleanData.ma_vt}' đã tồn tại.`, () => {}, true);
      return false;
    }
  }

  let error;
  if (mode === 'edit') {
    const { error: updateError } = await supabase.from('SANPHAM').update(cleanData).eq('ma_vt', id);
    error = updateError;
  } else {
    const { error: insertError } = await supabase.from('SANPHAM').insert([cleanData]);
    error = insertError;
  }
  if (error) throw error;
  return true;
}

async function deleteSanpham(ma_vt) {
  showConfirm(`Bạn có chắc muốn xóa sản phẩm '${ma_vt}' không?`, async () => {
    try {
      const { error } = await supabase.from('SANPHAM').delete().eq('ma_vt', ma_vt);
      if (error) throw error;
      showToast(`Đã xóa sản phẩm '${ma_vt}'!`, 'success');
      loadSanpham();
    } catch (error) {
      console.error('Lỗi xóa sản phẩm:', error);
      showToast(`Lỗi khi xóa: ${error.message}`, 'error');
    }
  });
}

// ===== 8. CRUD cho TỒN KHO (TONKHO) =====
function formatDate(dateString) {
  if (!dateString) return '';
  try {
    const date = new Date(dateString.includes('/') ? dateString.split('/').reverse().join('-') : dateString);
    if (isNaN(date.getTime())) return dateString;
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (e) {
    return dateString;
  }
}

function getStatusClass(status) {
    if (!status) return '';
    if (status === 'Hết Date') return 'status-het-date';
    if (status === 'Cận Date') return 'status-can-date';
    if (status === 'Hàng Hư') return 'status-hang-hu';
    if (status === 'Còn Sử Dụng' || status === 'Đang Sử Dụng') return 'status-binh-thuong';
    return '';
}

async function loadTonkho() {
    clearSelection();
    const searchTerm = toolbar.search.value.toLowerCase();
    try {
        const { data: chiTietData, error: chiTietError } = await supabase.from('CHITIET').select('ma_vach, ma_kho, so_luong');
        if (chiTietError) throw chiTietError;

        const aggregatedDetails = {};
        for (const detail of chiTietData) {
            if (!detail.ma_vach) continue;
            if (!aggregatedDetails[detail.ma_vach]) {
                aggregatedDetails[detail.ma_vach] = { nhap: 0, xuat: 0 };
            }
            const soLuong = Number(detail.so_luong) || 0;
            if (detail.ma_kho && detail.ma_kho.toUpperCase().includes('IN')) {
                aggregatedDetails[detail.ma_vach].nhap += soLuong;
            }
            if (detail.ma_kho && detail.ma_kho.toUpperCase().includes('OUT')) {
                aggregatedDetails[detail.ma_vach].xuat += soLuong;
            }
        }
        
        await loadSanphamForLookup(); 
        let query = supabase.from('TONKHO').select('*');
        let countQuery = supabase.from('TONKHO').select('*', { count: 'exact', head: true });

        if (searchTerm) {
            const searchFilter = `ma_vach.ilike.%${searchTerm}%,ma_vt.ilike.%${searchTerm}%,lot.ilike.%${searchTerm}%,tinh_trang.ilike.%${searchTerm}%`;
            query = query.or(searchFilter);
            countQuery = countQuery.or(searchFilter);
        }
        
        const { ma_vt, lot, tinh_trang, nganh, phu_trach } = tonkhoFilterState;
        if (ma_vt.size > 0) { query = query.in('ma_vt', Array.from(ma_vt)); countQuery = countQuery.in('ma_vt', Array.from(ma_vt)); }
        if (lot.size > 0) { query = query.in('lot', Array.from(lot)); countQuery = countQuery.in('lot', Array.from(lot)); }
        if (tinh_trang.size > 0) { query = query.in('tinh_trang', Array.from(tinh_trang)); countQuery = countQuery.in('tinh_trang', Array.from(tinh_trang)); }
        if (nganh.size > 0) { query = query.in('nganh', Array.from(nganh)); countQuery = countQuery.in('nganh', Array.from(nganh)); }
        if (phu_trach.size > 0) { query = query.in('phu_trach', Array.from(phu_trach)); countQuery = countQuery.in('phu_trach', Array.from(phu_trach)); }

        const { count, error: countError } = await countQuery;
        if (countError) throw countError;
        pagination.totalItems = count || 0;
        updatePaginationUI();
        
        const from = (pagination.page - 1) * pagination.limit;
        const to = from + pagination.limit - 1;
        query = query.range(from, to);

        let { data, error } = await query.order('ma_vach');
        if (error) throw error;
        
        const finalData = data.map(item => {
            const ton_dau = Number(item.ton_dau) || 0;
            const aggregates = aggregatedDetails[item.ma_vach] || { nhap: 0, xuat: 0 };
            const nhap = aggregates.nhap;
            const xuat = aggregates.xuat;
            const ton_cuoi = ton_dau + nhap - xuat;
            return { ...item, nhap, xuat, ton_cuoi };
        }).filter(item => {
            const tonCuoiFilter = tonkhoFilterState.ton_cuoi;
            if (tonCuoiFilter.size === 0 || tonCuoiFilter.has('Tất cả')) return true;
            if (tonCuoiFilter.has('Còn hàng')) return item.ton_cuoi > 0;
            if (tonCuoiFilter.has('Hết hàng')) return item.ton_cuoi <= 0;
            return false;
        });
        
        if (finalData.length === 0) {
            tonkhoTableBody.innerHTML = `<tr><td colspan="14" class="td-center">Không có dữ liệu phù hợp.</td></tr>`;
            return;
        }


        tonkhoTableBody.innerHTML = finalData.map(item => {
            const productInfo = sanphamDataForLookup.find(p => p.ma_vt === item.ma_vt) || {};
            const displayStatus = item.tinh_trang || 'Còn Sử Dụng';
            return `
            <tr id="tonkho-row-${item.ma_vach}" class="selectable-row hover:bg-gray-50 dark:hover:bg-gray-700" onclick="toggleRowSelection('tonkho', '${item.ma_vach}', event)">
                <td class="td"><input type="checkbox" class="row-checkbox" data-view="tonkho" data-id="${item.ma_vach}"></td>
                <td class="td text-sm font-medium text-gray-900 dark:text-gray-100">${item.ma_vach}</td>
                <td class="td text-sm text-gray-600 dark:text-gray-300">${item.ma_vt || ''}</td>
                <td class="td text-sm text-gray-600 dark:text-gray-300">${productInfo.ten_vt || item.ten_vt || ''}</td>
                <td class="td text-sm text-gray-600 dark:text-gray-300">${item.lot || ''}</td>
                <td class="td text-sm text-gray-600 dark:text-gray-300">${formatDate(item.date)}</td>
                <td class="td text-sm text-gray-600 dark:text-gray-300">${item.ton_dau}</td>
                <td class="td text-sm text-nhap">${item.nhap}</td>
                <td class="td text-sm text-xuat">${item.xuat}</td>
                <td class="td text-sm font-bold text-gray-800 dark:text-gray-100">${item.ton_cuoi}</td>
                <td class="td text-sm ${getStatusClass(displayStatus)}">${displayStatus}</td>
                <td class="td text-sm text-gray-600 dark:text-gray-300">${item.tray || ''}</td>
                <td class="td text-sm text-gray-600 dark:text-gray-300">${productInfo.nganh || item.nganh || ''}</td>
                <td class="td text-sm text-gray-600 dark:text-gray-300">${productInfo.phu_trach || item.phu_trach || ''}</td>
            </tr>
            `}).join('');
        attachCheckboxListeners('tonkho');
    } catch (error) {
        console.error('Lỗi tải tồn kho:', error);
        showToast(`Lỗi tải tồn kho: ${error.message}`, 'error');
        tonkhoTableBody.innerHTML = `<tr><td colspan="14" class="td-center text-red-500">Lỗi: ${error.message}</td></tr>`;
    }
    updateLastSyncTime();
}


async function editTonkho(ma_vach) {
  await loadSanphamForLookup();
  try {
    let { data, error } = await supabase.from('TONKHO').select('*').eq('ma_vach', ma_vach).single();
    if (error) throw error;

    // MỚI: Tính toán Nhập/Xuất/Tồn Cuối
    const { data: chiTietData, error: chiTietError } = await supabase.from('CHITIET').select('ma_kho, so_luong').eq('ma_vach', ma_vach);
    if (chiTietError) throw chiTietError;

    const aggregates = (chiTietData || []).reduce((acc, detail) => {
        const soLuong = Number(detail.so_luong) || 0;
        if (String(detail.ma_kho).toUpperCase().includes('IN')) acc.nhap += soLuong;
        if (String(detail.ma_kho).toUpperCase().includes('OUT')) acc.xuat += soLuong;
        return acc;
    }, { nhap: 0, xuat: 0 });

    const ton_dau = Number(data.ton_dau) || 0;
    data.nhap = aggregates.nhap; // Thêm vào data
    data.xuat = aggregates.xuat; // Thêm vào data
    data.ton_cuoi = ton_dau + aggregates.nhap - aggregates.xuat; // Thêm vào data
    // KẾT THÚC MỚI

    const row = document.getElementById(`tonkho-row-${ma_vach}`);
    row.innerHTML = createEditableRowContents('tonkho', data, true);
    row.setAttribute('data-editing', 'true');

    currentEditState = { view: 'tonkho', id: ma_vach, mode: 'edit' };
    showInlineEditControls();
  } catch (error) {
    console.error('Lỗi lấy dữ liệu sửa:', error);
    showToast(`Lỗi lấy dữ liệu sửa: ${error.message}`, 'error');
  }
}

async function createNewTonkhoRow() {
  await loadSanphamForLookup();
  const tableBody = document.getElementById('tonkho-table-body');
  const newId = `new-${crypto.randomUUID()}`;
  const rowHtml = `<tr id="tonkho-row-${newId}" data-editing="true">${createEditableRowContents('tonkho', {}, false)}</tr>`;
  tableBody.insertAdjacentHTML('afterbegin', rowHtml);
  const newRow = document.getElementById(`tonkho-row-${newId}`);
  newRow.querySelector('.inline-custom-select-toggle').click();
  return newRow;
}

async function saveTonkho(data, mode, id) {
    if (!data.ma_vt || data.ton_dau === '' || data.ton_dau === null) {
        showConfirm('Lỗi: Mã VT và Tồn Đầu là các trường bắt buộc.', () => {}, true);
        return false;
    }

    let parsedDate = null;
    let isoDate = null;
    let datePart = ''; // MỚI
    const dateValue = data.date;
    if (dateValue) {
        if (!/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateValue)) {
            showConfirm('Lỗi: Định dạng Date không hợp lệ. Vui lòng sử dụng dd/mm/yyyy.', () => {}, true);
            return false;
        }
        const dateParts = dateValue.split('/');
        const day = parseInt(dateParts[0], 10);
        const month = parseInt(dateParts[1], 10);
        const year = parseInt(dateParts[2], 10);
        parsedDate = new Date(year, month - 1, day);

        if (parsedDate.getFullYear() !== year || parsedDate.getMonth() + 1 !== month || parsedDate.getDate() !== day) {
            showConfirm('Lỗi: Ngày không hợp lệ. Vui lòng kiểm tra lại.', () => {}, true);
            return false;
        }
        isoDate = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        // MỚI: Tạo datePart cho ma_vach
        datePart = `${String(day).padStart(2,'0')}.${String(month).padStart(2,'0')}.${year}`;
    }

    const selectedProduct = sanphamDataForLookup.find(p => p.ma_vt === data.ma_vt);
    if (!selectedProduct) {
        showConfirm(`Lỗi: Mã VT '${data.ma_vt}' không tồn tại trong danh sách Sản Phẩm.`, () => {}, true);
        return false;
    }
    
    // THAY ĐỔI: Logic tạo Mã Vạch
    const maVtPart = data.ma_vt || '';
    const lotPart = data.lot || ''; // Trống nếu không có
    // datePart đã được tạo ở trên
    const generatedMaVach = `${maVtPart}${lotPart}${datePart}`;

    
    if (!data.ma_vt) {
         showConfirm(`Lỗi: Không thể tạo Mã Vạch. Cần có Mã VT.`, () => {}, true);
        return false;
    }

    let query = supabase.from('TONKHO').select('ma_vach').eq('ma_vach', generatedMaVach);
    if (mode === 'edit') {
        query = query.neq('ma_vach', id);
    }
    const { data: existing, error: checkError } = await query.maybeSingle();

    if (checkError) {
        throw new Error(`Lỗi kiểm tra Mã Vạch: ${checkError.message}`);
    }
    if (existing) {
        showConfirm(`Lỗi: Mã Vạch '${generatedMaVach}' đã tồn tại. Vui lòng thay đổi Mã VT, LOT, hoặc Date.`, () => {}, true);
        return false;
    }

    const cleanData = {
        ma_vach: generatedMaVach,
        ma_vt: data.ma_vt,
        ten_vt: selectedProduct.ten_vt,
        nganh: selectedProduct.nganh,
        phu_trach: selectedProduct.phu_trach,
        lot: data.lot || null,
        date: isoDate,
        ton_dau: Number(data.ton_dau) || 0,
        tray: data.tray || null,
    };
    
    if (data.tinh_trang && (data.tinh_trang === "Hàng Hư" || data.tinh_trang === "Đang Sử Dụng")) {
        cleanData.tinh_trang = data.tinh_trang;
    } else if (parsedDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const threeMonthsFromNow = new Date();
        threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);

        if (parsedDate < today) {
            cleanData.tinh_trang = "Hết Date";
        } else if (parsedDate <= threeMonthsFromNow) {
            cleanData.tinh_trang = "Cận Date";
        } else {
            cleanData.tinh_trang = "Còn Sử Dụng";
        }
    } else {
         cleanData.tinh_trang = "Còn Sử Dụng";
    }


    let error;
    if (mode === 'edit') {
        const { error: updateError } = await supabase.from('TONKHO').update(cleanData).eq('ma_vach', id);
        error = updateError;
    } else {
        const { error: insertError } = await supabase.from('TONKHO').insert([cleanData]);
        error = insertError;
    }

    if (error) throw error;
    return true;
}

async function deleteTonkho(ma_vach) {
  showConfirm(`Bạn có chắc muốn xóa tồn kho '${ma_vach}' không?`, async () => {
    try {
      const { error } = await supabase.from('TONKHO').delete().eq('ma_vach', ma_vach);
      if (error) throw error;
      showToast(`Đã xóa tồn kho '${ma_vach}'!`, 'success');
      loadTonkho();
    } catch (error) {
      console.error('Lỗi xóa tồn kho:', error);
      showToast(`Lỗi khi xóa: ${error.message}`, 'error');
    }
  });
}


// ===== 9. CRUD cho ĐƠN HÀNG (DONHANG) =====
function createLinkIcon(url) {
    if (!url || typeof url !== 'string' || !url.trim()) {
        return '';
    }
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="flex justify-center items-center text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
          <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
        </svg>
    </a>`;
}


async function loadDonhang() {
  clearSelection();
  const searchTerm = toolbar.search.value.toLowerCase();
  try {
    let query = supabase.from('DONHANG').select('*');
    let countQuery = supabase.from('DONHANG').select('*', { count: 'exact', head: true }); 
    
    if (searchTerm) {
      const searchFilter = `ma_kho.ilike.%${searchTerm}%,ma_nx.ilike.%${searchTerm}%,user.ilike.%${searchTerm}%,nganh.ilike.%${searchTerm}%,muc_dich.ilike.%${searchTerm}%`;
      query = query.or(searchFilter);
      countQuery = countQuery.or(searchFilter);
    }

    const { thoi_gian_from, thoi_gian_to, ma_kho, ma_nx, loai_don, trang_thai } = donhangFilterState;
    if (thoi_gian_from) { query.gte('thoi_gian', `${thoi_gian_from}T00:00:00`); countQuery.gte('thoi_gian', `${thoi_gian_from}T00:00:00`); }
    if (thoi_gian_to) { query.lte('thoi_gian', `${thoi_gian_to}T23:59:59`); countQuery.lte('thoi_gian', `${thoi_gian_to}T23:59:59`); }
    if (ma_kho.size > 0) { query.in('ma_kho', Array.from(ma_kho)); countQuery.in('ma_kho', Array.from(ma_kho)); }
    if (ma_nx.size > 0) { query.in('ma_nx', Array.from(ma_nx)); countQuery.in('ma_nx', Array.from(ma_nx)); }
    
    const loaiDonFilters = [];
    if (loai_don.has('Nhập')) loaiDonFilters.push('ma_kho.ilike.%IN%');
    if (loai_don.has('Xuất')) loaiDonFilters.push('ma_kho.ilike.%OUT%');
    if (loaiDonFilters.length > 0) { query.or(loaiDonFilters.join(',')); countQuery.or(loaiDonFilters.join(',')); }
    
    const trangThaiFilters = [];
    if (trang_thai.has('Đang xử lý')) trangThaiFilters.push('ma_nx.like.%...%');
    if (trang_thai.has('Đã xử lý')) trangThaiFilters.push('ma_nx.not.like.%...%');
    if (trangThaiFilters.length > 0) { query.or(trangThaiFilters.join(',')); countQuery.or(trangThaiFilters.join(',')); }


    const { count, error: countError } = await countQuery;
    if (countError) throw countError;
    pagination.totalItems = count || 0;
    updatePaginationUI();
    
    const from = (pagination.page - 1) * pagination.limit;
    const to = from + pagination.limit - 1;
    query = query.range(from, to);

    let { data, error } = await query.order('thoi_gian', { ascending: false });
    if (error) throw error;

    if (data.length === 0) {
      donhangTableBody.innerHTML = `<tr><td colspan="13" class="td-center">Chưa có dữ liệu.</td></tr>`;
      return;
    }

    donhangTableBody.innerHTML = data.map(item => `
      <tr id="donhang-row-${item.ma_nx}" class="selectable-row hover:bg-gray-50 dark:hover:bg-gray-700" onclick="toggleRowSelection('donhang', '${item.ma_nx}', event)">
        <td class="td"><input type="checkbox" class="row-checkbox" data-view="donhang" data-id="${item.ma_nx}"></td>
        <td class="td text-sm text-gray-600 dark:text-gray-300">${item.ma_kho || ''}</td>
        <td class="td text-sm text-gray-600 dark:text-gray-300">${formatDate(item.thoi_gian)}</td>
        <td class="td text-sm font-medium text-gray-900 dark:text-gray-100">${item.ma_nx}</td>
        <td class="td text-sm text-gray-600 dark:text-gray-300">${item.user || ''}</td>
        <td class="td text-sm text-gray-600 dark:text-gray-300">${item.nganh || ''}</td>
        <td class="td text-sm text-gray-600 dark:text-gray-300">${item.muc_dich || ''}</td>
        <td class="td text-sm text-gray-600 dark:text-gray-300">${item.dia_chi || ''}</td>
        <td class="td text-sm text-gray-600 dark:text-gray-300">${item.ghi_chu || ''}</td>
        <td class="td">${createLinkIcon(item.order)}</td>
        <td class="td">${createLinkIcon(item.pkl)}</td>
        <td class="td">${createLinkIcon(item.done)}</td>
        <td class="td">${createLinkIcon(item.image)}</td>
      </tr>
    `).join('');
    attachCheckboxListeners('donhang');
  } catch (error) {
    console.error('Lỗi tải đơn hàng:', error);
    showToast(`Lỗi tải đơn hàng: ${error.message}`, 'error');
    donhangTableBody.innerHTML = `<tr><td colspan="13" class="td-center text-red-500">Lỗi: ${error.message}</td></tr>`;
  }
  
  updateLastSyncTime();
}

async function editDonhang(ma_nx) {
    try {
        showToast('Đang tải dữ liệu đơn hàng...', 'warning');
        const { data: donhang, error: donhangError } = await supabase.from('DONHANG').select('*').eq('ma_nx', ma_nx).single();
        if (donhangError) throw donhangError;
        if (!donhang) {
            showToast(`Không tìm thấy đơn hàng với mã: ${ma_nx}`, 'error');
            return;
        }

        const { data: chitiet, error: chitietError } = await supabase.from('CHITIET').select('*').eq('ma_nx', ma_nx);
        if (chitietError) throw chitietError;

        await openDonhangModal('edit', { donhang, chitiet });

    } catch (error) {
        console.error('Lỗi tải đơn hàng để sửa:', error);
        showToast(`Lỗi tải đơn hàng: ${error.message}`, 'error');
    }
}

async function deleteDonhang(ma_nx) {
  showConfirm(`Bạn có chắc muốn xóa đơn hàng '${ma_nx}' và tất cả chi tiết liên quan không?`, async () => {
    try {
      // Xóa chi tiết trước
      const { error: chitietError } = await supabase.from('CHITIET').delete().eq('ma_nx', ma_nx);
      if (chitietError) throw chitietError;

      // Xóa đơn hàng
      const { error: donhangError } = await supabase.from('DONHANG').delete().eq('ma_nx', ma_nx);
      if (donhangError) throw donhangError;

      showToast(`Đã xóa đơn hàng '${ma_nx}'!`, 'success');
      loadDonhang();
    } catch (error) {
      console.error('Lỗi xóa đơn hàng:', error);
      showToast(`Lỗi khi xóa: ${error.message}`, 'error');
    }
  });
}

// ===== 10. CRUD cho CHI TIẾT (CHITIET) =====
async function loadChitiet() {
    clearSelection();
    const searchTerm = toolbar.search.value.toLowerCase();
    try {
        let query = supabase.from('CHITIET').select('*');
        let countQuery = supabase.from('CHITIET').select('*', { count: 'exact', head: true });

        if (searchTerm) {
            const searchFilter = `ma_kho.ilike.%${searchTerm}%,ma_nx.ilike.%${searchTerm}%,ma_vach.ilike.%${searchTerm}%,ma_vt.ilike.%${searchTerm}%,ten_vt.ilike.%${searchTerm}%,user.ilike.%${searchTerm}%`;
            query = query.or(searchFilter);
            countQuery = countQuery.or(searchFilter);
        }
        
        const { thoi_gian_from, thoi_gian_to, ma_kho, ma_nx, ma_vt, lot, nganh, phu_trach, loai_don, trang_thai } = chitietFilterState;
        if (thoi_gian_from) { query.gte('thoi_gian', `${thoi_gian_from}T00:00:00`); countQuery.gte('thoi_gian', `${thoi_gian_from}T00:00:00`); }
        if (thoi_gian_to) { query.lte('thoi_gian', `${thoi_gian_to}T23:59:59`); countQuery.lte('thoi_gian', `${thoi_gian_to}T23:59:59`); }
        if (ma_kho.size > 0) { query.in('ma_kho', Array.from(ma_kho)); countQuery.in('ma_kho', Array.from(ma_kho)); }
        if (ma_nx.size > 0) { query.in('ma_nx', Array.from(ma_nx)); countQuery.in('ma_nx', Array.from(ma_nx)); }
        if (ma_vt.size > 0) { query.in('ma_vt', Array.from(ma_vt)); countQuery.in('ma_vt', Array.from(ma_vt)); }
        if (lot.size > 0) { query.in('lot', Array.from(lot)); countQuery.in('lot', Array.from(lot)); }
        if (nganh.size > 0) { query.in('nganh', Array.from(nganh)); countQuery.in('nganh', Array.from(nganh)); }
        if (phu_trach.size > 0) { query.in('phu_trach', Array.from(phu_trach)); countQuery.in('phu_trach', Array.from(phu_trach)); }
        
        const loaiDonFilters = [];
        if (loai_don.has('Nhập')) loaiDonFilters.push('ma_kho.ilike.%IN%');
        if (loai_don.has('Xuất')) loaiDonFilters.push('ma_kho.ilike.%OUT%');
        if (loaiDonFilters.length > 0) { query.or(loaiDonFilters.join(',')); countQuery.or(loaiDonFilters.join(',')); }
        
        const trangThaiFilters = [];
        if (trang_thai.has('Đang xử lý')) trangThaiFilters.push('ma_nx.like.%...%');
        if (trang_thai.has('Đã xử lý')) trangThaiFilters.push('ma_nx.not.like.%...%');
        if (trangThaiFilters.length > 0) { query.or(trangThaiFilters.join(',')); countQuery.or(trangThaiFilters.join(',')); }


        const { count, error: countError } = await countQuery;
        if (countError) throw countError;
        pagination.totalItems = count || 0;
        updatePaginationUI();
        
        const from = (pagination.page - 1) * pagination.limit;
        const to = from + pagination.limit - 1;
        query = query.range(from, to);

        let { data, error } = await query.order('thoi_gian', { ascending: false }).order('id', { ascending: false });
        if (error) throw error;

        if (data.length === 0) {
            chitietTableBody.innerHTML = `<tr><td colspan="16" class="td-center">Chưa có dữ liệu.</td></tr>`;
            return;
        }

        chitietTableBody.innerHTML = data.map(item => `
        <tr id="chitiet-row-${item.id}" class="selectable-row hover:bg-gray-50 dark:hover:bg-gray-700" onclick="toggleRowSelection('chitiet', '${item.id}', event)">
            <td class="td"><input type="checkbox" class="row-checkbox" data-view="chitiet" data-id="${item.id}"></td>
            <td class="td text-sm text-gray-600 dark:text-gray-300">${formatDate(item.thoi_gian)}</td>
            <td class="td text-sm text-gray-600 dark:text-gray-300">${item.ma_kho || ''}</td>
            <td class="td text-sm text-gray-600 dark:text-gray-300">${item.ma_nx || ''}</td>
            <td class="td text-sm text-gray-600 dark:text-gray-300">${item.ma_vach || ''}</td>
            <td class="td text-sm text-gray-600 dark:text-gray-300">${item.ma_vt || ''}</td>
            <td class="td text-sm text-gray-600 dark:text-gray-300">${item.ten_vt || ''}</td>
            <td class="td text-sm text-gray-600 dark:text-gray-300">${item.lot || ''}</td>
            <td class="td text-sm text-gray-600 dark:text-gray-300">${formatDate(item.date)}</td>
            <td class="td text-sm text-gray-600 dark:text-gray-300">${item.yeu_cau || ''}</td>
            <td class="td text-sm text-gray-600 dark:text-gray-300">${item.so_luong || 0}</td>
            <td class="td text-sm text-gray-600 dark:text-gray-300">${item.loai || ''}</td>
            <td class="td text-sm text-gray-600 dark:text-gray-300">${item.user || ''}</td>
            <td class="td text-sm text-gray-600 dark:text-gray-300">${item.muc_dich || ''}</td>
            <td class="td text-sm text-gray-600 dark:text-gray-300">${item.nganh || ''}</td>
            <td class="td text-sm text-gray-600 dark:text-gray-300">${item.phu_trach || ''}</td>
        </tr>
        `).join('');
        attachCheckboxListeners('chitiet');
    } catch (error) {
        console.error('Lỗi tải chi tiết:', error);
        showToast(`Lỗi tải chi tiết: ${error.message}`, 'error');
        chitietTableBody.innerHTML = `<tr><td colspan="16" class="td-center text-red-500">Lỗi: ${error.message}</td></tr>`;
    }
    updateLastSyncTime();
}

async function deleteChitiet(id) {
  showConfirm(`Bạn có chắc muốn xóa chi tiết ID '${id}' không?`, async () => {
    try {
      const { error } = await supabase.from('CHITIET').delete().eq('id', id);
      if (error) throw error;
      showToast(`Đã xóa chi tiết ID '${id}'!`, 'success');
      loadChitiet();
    } catch (error) {
      console.error('Lỗi xóa chi tiết:', error);
      showToast(`Lỗi khi xóa: ${error.message}`, 'error');
    }
  });
}

// ===== MỚI: 10.5. Tải dữ liệu cho Bộ lọc =====

async function getUniqueColumnValues(tableName, columnName) {
    let query = supabase.from(tableName).select(columnName);
    const { data, error } = await query;
    if (error) throw error;
    return [...new Set(data.map(item => item[columnName]).filter(Boolean))].sort();
}

async function populateSanphamFilters() {
  if (sanphamFiltersPopulated) return;
  console.log('Đang tải dữ liệu cho bộ lọc Sản phẩm...');
  try {
    const [maVts, tenVts, nganhs, phuTrachs] = await Promise.all([
      getUniqueColumnValues('SANPHAM', 'ma_vt'),
      getUniqueColumnValues('SANPHAM', 'ten_vt'),
      getUniqueColumnValues('SANPHAM', 'nganh'),
      getUniqueColumnValues('SANPHAM', 'phu_trach')
    ]);
    const filters = document.querySelectorAll('#filter-sanpham .custom-filter');
    filters.forEach(filter => {
      const column = filter.dataset.filterColumn;
      let items = [];
      if (column === 'ma_vt') items = maVts;
      if (column === 'ten_vt') items = tenVts;
      if (column === 'nganh') items = nganhs;
      if (column === 'phu_trach') items = phuTrachs;
      populateCustomFilterList(filter, items, column, sanphamFilterState);
    });
    sanphamFiltersPopulated = true;
  } catch (error) {
    console.error('Lỗi khi tải bộ lọc Sản phẩm:', error.message);
    showToast(`Lỗi tải bộ lọc Sản Phẩm: ${error.message}`, 'error');
  }
}

async function populateTonkhoFilters() {
    if (tonkhoFiltersPopulated) return;
    console.log('Đang tải dữ liệu cho bộ lọc Tồn Kho...');
    try {
        const [maVts, lots, tinhTrangs, nganhs, phuTrachs] = await Promise.all([
            getUniqueColumnValues('TONKHO', 'ma_vt'),
            getUniqueColumnValues('TONKHO', 'lot'),
            getUniqueColumnValues('TONKHO', 'tinh_trang'),
            getUniqueColumnValues('TONKHO', 'nganh'),
            getUniqueColumnValues('TONKHO', 'phu_trach')
        ]);
        const filters = document.querySelectorAll('#filter-tonkho .custom-filter');
        filters.forEach(filter => {
            const column = filter.dataset.filterColumn;
            let items = [];
            if (column === 'ma_vt') items = maVts;
            if (column === 'lot') items = lots;
            if (column === 'tinh_trang') items = [...tinhTrangs, "Còn Sử Dụng"].filter((v, i, a) => a.indexOf(v) === i).sort();;
            if (column === 'nganh') items = nganhs;
            if (column === 'phu_trach') items = phuTrachs;
            if (column === 'ton_cuoi') {
                populateCustomFilterList(filter, ['Còn hàng', 'Hết hàng'], column, tonkhoFilterState, false);
            } else {
                populateCustomFilterList(filter, items, column, tonkhoFilterState);
            }
        });
        tonkhoFiltersPopulated = true;
    } catch (error) {
        console.error('Lỗi khi tải bộ lọc Tồn Kho:', error.message);
        showToast(`Lỗi tải bộ lọc Tồn Kho: ${error.message}`, 'error');
    }
}

async function populateDonhangFilters() {
  if (donhangFiltersPopulated) return;
  console.log('Đang tải dữ liệu cho bộ lọc Đơn Hàng...');
  try {
    const [maKhos, maNxs] = await Promise.all([
      getUniqueColumnValues('DONHANG', 'ma_kho'),
      getUniqueColumnValues('DONHANG', 'ma_nx')
    ]);
    const filters = document.querySelectorAll('#filter-donhang .custom-filter');
    filters.forEach(filter => {
      const column = filter.dataset.filterColumn;
      let items = [];
      if (column === 'ma_kho') items = maKhos;
      if (column === 'ma_nx') items = maNxs;
      if (column === 'loai_don') {
        populateCustomFilterList(filter, ['Nhập', 'Xuất'], column, donhangFilterState, false);
      } else if (column === 'trang_thai') {
        populateCustomFilterList(filter, ['Đang xử lý', 'Đã xử lý'], column, donhangFilterState, false);
      } else {
        populateCustomFilterList(filter, items, column, donhangFilterState);
      }
    });
    donhangFiltersPopulated = true;
  } catch (error) {
    console.error('Lỗi khi tải bộ lọc Đơn Hàng:', error.message);
    showToast(`Lỗi tải bộ lọc Đơn Hàng: ${error.message}`, 'error');
  }
}

async function populateChitietFilters() {
  if (chitietFiltersPopulated) return;
  console.log('Đang tải dữ liệu cho bộ lọc Chi Tiết...');
  try {
    const [maKhos, maNxs, maVts, lots, nganhs, phuTrachs] = await Promise.all([
      getUniqueColumnValues('CHITIET', 'ma_kho'),
      getUniqueColumnValues('CHITIET', 'ma_nx'),
      getUniqueColumnValues('CHITIET', 'ma_vt'),
      getUniqueColumnValues('CHITIET', 'lot'),
      getUniqueColumnValues('CHITIET', 'nganh'),
      getUniqueColumnValues('CHITIET', 'phu_trach')
    ]);
    const filters = document.querySelectorAll('#filter-chitiet .custom-filter');
    filters.forEach(filter => {
      const column = filter.dataset.filterColumn;
      let items = [];
      if (column === 'ma_kho') items = maKhos;
      if (column === 'ma_nx') items = maNxs;
      if (column === 'ma_vt') items = maVts;
      if (column === 'lot') items = lots;
      if (column === 'nganh') items = nganhs;
      if (column === 'phu_trach') items = phuTrachs;

      if (column === 'loai_don') {
        populateCustomFilterList(filter, ['Nhập', 'Xuất'], column, chitietFilterState, false);
      } else if (column === 'trang_thai') {
        populateCustomFilterList(filter, ['Đang xử lý', 'Đã xử lý'], column, chitietFilterState, false);
      } else {
        populateCustomFilterList(filter, items, column, chitietFilterState);
      }
    });
    chitietFiltersPopulated = true;
  } catch (error) {
    console.error('Lỗi khi tải bộ lọc Chi Tiết:', error.message);
    showToast(`Lỗi tải bộ lọc Chi Tiết: ${error.message}`, 'error');
  }
}

function populateCustomFilterList(filterElement, items, column, state, includeSelectAll = true) {
  const listElement = filterElement.querySelector('.custom-filter-list');
  const selectedValues = state[column];
  
  const selectAllHTML = includeSelectAll ? `
    <div class="custom-filter-item">
      <input type="checkbox" class="custom-filter-select-all" data-column="${column}">
      <label class="font-bold">(Chọn tất cả)</label>
    </div>` : '';

  const itemsHTML = items.map(item => {
      const isChecked = selectedValues.has(item);
      return `
        <div class="custom-filter-item">
          <input type="checkbox" class="custom-filter-checkbox" value="${item}" data-column="${column}" ${isChecked ? 'checked' : ''}>
          <label>${item}</label>
        </div>
      `;
    }).join('');
  
  listElement.innerHTML = selectAllHTML + itemsHTML;
}

function updateCustomFilterText(column, filterElement) {
    if (!filterElement) {
        filterElement = document.querySelector(`.custom-filter[data-filter-column="${column}"]`);
    }
    if (!filterElement) return;

    let state;
    if (currentView === 'sanpham') state = sanphamFilterState;
    else if (currentView === 'tonkho') state = tonkhoFilterState;
    else if (currentView === 'donhang') state = donhangFilterState;
    else if (currentView === 'chitiet') state = chitietFilterState;
    else return;

    const textElement = filterElement.querySelector('.custom-filter-text');
    const selectedCount = state[column].size;
    
    const defaultTexts = {
        'ma_vt': 'Tất cả Mã VT', 'ten_vt': 'Tất cả Tên VT', 'nganh': 'Tất cả Ngành', 
        'phu_trach': 'Tất cả Phụ trách', 'lot': 'Tất cả LOT', 'tinh_trang': 'Tất cả Tình Trạng',
        'ma_kho': 'Tất cả Mã Kho', 'ma_nx': 'Tất cả Mã NX',
        'ton_cuoi': 'Tất cả', 'loai_don': 'Tất cả', 'trang_thai': 'Tất cả'
    };

    if (selectedCount === 0) {
        textElement.textContent = defaultTexts[column] || `Tất cả`;
    } else if (selectedCount === 1) {
        textElement.textContent = state[column].values().next().value;
    } else {
        textElement.textContent = `${selectedCount} mục đã chọn`;
    }
}


// ===== 11. HÀM HELPER MỚI CHO INLINE EDIT VÀ SYNC =====
async function loadSanphamForLookup() {
    if (sanphamDataForLookup.length > 0) return; // Chỉ tải 1 lần
    try {
        let allProducts = [];
        let page = 0;
        const pageSize = 1000;
        while (true) {
            const { data, error } = await supabase
                .from('SANPHAM')
                .select('ma_vt, ten_vt, nganh, phu_trach')
                .range(page * pageSize, (page + 1) * pageSize - 1);
            
            if (error) throw error;
            
            allProducts = allProducts.concat(data);
            
            if (data.length < pageSize) {
                break; 
            }
            page++;
        }
        sanphamDataForLookup = allProducts;
        console.log(`Đã tải ${sanphamDataForLookup.length} sản phẩm cho lookup.`);
    } catch (error) {
        console.error('Lỗi tải toàn bộ sản phẩm cho lookup:', error);
        showToast('Không thể tải toàn bộ dữ liệu sản phẩm.', 'error');
        sanphamDataForLookup = [];
    }
}

function handleTonkhoInputChange(element) {
    const row = element.closest('tr');
    if (!row) return;

    const maVtInput = row.querySelector('input[name="ma_vt"]');
    const tenVtInput = row.querySelector('input[name="ten_vt"]');
    const nganhInput = row.querySelector('input[name="nganh"]');
    const phuTrachInput = row.querySelector('input[name="phu_trach"]');
    const lotInput = row.querySelector('input[name="lot"]');
    const dateInput = row.querySelector('input[name="date"]');
    const maVachInput = row.querySelector('input[name="ma_vach"]');
    const tinhTrangCell = row.querySelector('.tinh-trang-cell');
    
    // MỚI: Lấy input Tồn Đầu và Tồn Cuối
    const tonDauInput = row.querySelector('input[name="ton_dau"]');
    const tonCuoiInput = row.querySelector('input[name="ton_cuoi"]'); 
    const nhapInput = row.querySelector('input[name="nhap"]'); 
    const xuatInput = row.querySelector('input[name="xuat"]'); 


    if (element.name === 'ma_vt') {
        const selectedProduct = sanphamDataForLookup.find(p => p.ma_vt === maVtInput.value);
        if (selectedProduct) {
            tenVtInput.value = selectedProduct.ten_vt || '';
            nganhInput.value = selectedProduct.nganh || '';
            phuTrachInput.value = selectedProduct.phu_trach || '';
        } else {
            tenVtInput.value = '';
            nganhInput.value = '';
            phuTrachInput.value = '';
        }
    }
    
    // MỚI: Cập nhật Tồn Cuối khi Tồn Đầu thay đổi
    if (element.name === 'ton_dau') {
        const ton_dau = Number(tonDauInput.value) || 0;
        const nhap = Number(nhapInput.value) || 0;
        const xuat = Number(xuatInput.value) || 0;
        tonCuoiInput.value = ton_dau + nhap - xuat;
    }
    
    let selectedDate = null;
    let datePart = ''; // MỚI: Khởi tạo datePart
    const dateValue = dateInput.value;
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateValue)) {
        const parts = dateValue.split('/');
        selectedDate = new Date(parts[2], parts[1] - 1, parts[0]);
        if (selectedDate.getFullYear() != parts[2] || selectedDate.getMonth() + 1 != parts[1] || selectedDate.getDate() != parts[0]) {
             selectedDate = null;
        } else {
            // THAY ĐỔI: Format là dd.mm.yyyy
            datePart = `${String(parts[0]).padStart(2,'0')}.${String(parts[1]).padStart(2,'0')}.${parts[2]}`;
        }
    }

    if (element.name === 'date' || element.name === 'ma_vt') { 
        let tinhTrangInputHTML = '';
        const currentTinhTrang = tinhTrangCell.querySelector('select, input')?.value || '';

        let canSelectOtherOptions = true;
        if (selectedDate) {
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const threeMonthsFromNow = new Date(); threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);

            if (selectedDate < today) {
                tinhTrangInputHTML = `<input type="text" name="tinh_trang" value="Hết Date" class="inline-input bg-gray-input" readonly>`;
                canSelectOtherOptions = false;
            } else if (selectedDate <= threeMonthsFromNow) {
                tinhTrangInputHTML = `<input type="text" name="tinh_trang" value="Cận Date" class="inline-input bg-gray-input" readonly>`;
                canSelectOtherOptions = false;
            }
        }
        
        if (canSelectOtherOptions) {
             const isDangSuDung = currentTinhTrang === 'Đang Sử Dụng';
             const isHangHu = currentTinhTrang === 'Hàng Hư';
             const isConSuDung = currentTinhTrang === 'Còn Sử Dụng' || !currentTinhTrang;
             tinhTrangInputHTML = `
                <select name="tinh_trang" class="inline-input">
                    <option value="Còn Sử Dụng" ${isConSuDung ? 'selected' : ''}>Còn Sử Dụng</option>
                    <option value="Đang Sử Dụng" ${isDangSuDung ? 'selected' : ''}>Đang Sử Dụng</option>
                    <option value="Hàng Hư" ${isHangHu ? 'selected' : ''}>Hàng Hư</option>
                </select>`;
        }

        if (tinhTrangCell) {
          tinhTrangCell.innerHTML = tinhTrangInputHTML;
        }
    }
    
    // THAY ĐỔI: Logic tạo Mã Vạch mới
    const maVtPart = maVtInput.value || '';
    const lotPart = lotInput.value || ''; // THAY ĐỔI: Trống nếu không có
    // datePart đã được tạo ở trên
    
    maVachInput.value = `${maVtPart}${lotPart}${datePart}`;
}

async function handleSync() {
    if (currentEditState.mode) {
        showToast('Không thể đồng bộ khi đang chỉnh sửa!', 'warning');
        return;
    }
    showToast('Đang đồng bộ...', 'warning', 5000);
    await loadDataForCurrentView();
    showToast('Đã đồng bộ thành công!', 'success');
}

function updateLastSyncTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('vi-VN', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
    });
    lastSyncTimeSpan.textContent = `Lúc: ${timeString}`;
}

function handleFontSizeChange() {
    const percentage = parseInt(fontSizeSelect.value, 10);
    document.documentElement.style.fontSize = `${percentage}%`; 
}

function showInlineEditControls() {
  toolbar.save.hidden = false;
  toolbar.cancel.hidden = false;

  toolbar.add.disabled = true;
  toolbar.edit.disabled = true;
  toolbar.delete.disabled = true;
  toolbar.excel.disabled = true;
  toolbar.search.disabled = true;
  toolbar.clearFilter.disabled = true;
  toolbar.sync.disabled = true;

  navLinks.forEach(link => link.style.pointerEvents = 'none');
}

function hideInlineEditControls() {
  toolbar.save.hidden = true;
  toolbar.cancel.hidden = true;

  toolbar.add.disabled = false;
  toolbar.edit.disabled = !selectedItem.id;
  toolbar.delete.disabled = !selectedItem.id;

  toolbar.excel.disabled = false;
  toolbar.search.disabled = false;
  toolbar.clearFilter.disabled = false;
  toolbar.sync.disabled = false;

  navLinks.forEach(link => link.style.pointerEvents = 'auto');

  currentEditState = { view: null, id: null, mode: null };
}

async function handleToolbarSave() {
  const { view, id, mode } = currentEditState;
  if (!view) return;

  const editRows = document.querySelectorAll('tr[data-editing="true"]');
  if (editRows.length === 0) {
    hideInlineEditControls();
    return;
  }

  try {
    let allSavesSuccessful = true;

    for (const editRow of editRows) {
      const data = {};
      const inputs = editRow.querySelectorAll('input, textarea, select');
      inputs.forEach(input => {
        const name = input.name;
        if (name) {
          data[name] = (input.type === 'checkbox') ? input.checked : input.value;
        }
      });

      const rowId = editRow.id.split('-row-')[1];
      const saveId = (mode === 'edit') ? rowId : null;
      let saveResult = true;

      showToast('Đang lưu...', 'warning');

      switch (view) {
        case 'sanpham': 
          saveResult = await saveSanpham(data, mode, saveId); 
          break;
        case 'tonkho': 
          saveResult = await saveTonkho(data, mode, saveId); 
          break;
      }
      
      if (!saveResult) {
        allSavesSuccessful = false;
        break; 
      }
    }

     if (allSavesSuccessful) {
      hideInlineEditControls();
      showToast('Lưu thành công!', 'success');
      loadDataForCurrentView();
    }

  } catch (error) {
    console.error('Lỗi lưu dữ liệu:', error);
    showToast(`Lỗi khi lưu: ${error.message}`, 'error');
  }
}

function handleToolbarCancel() {
  const mode = currentEditState.mode;
  hideInlineEditControls();

  if (mode === 'edit') {
    loadDataForCurrentView();
  } else if (mode === 'add') {
    document.querySelectorAll('tr[data-editing="true"]').forEach(row => row.remove());
  }
  showToast('Đã hủy thao tác.', 'warning');
}

function createEditableRowContents(view, data = {}, isEdit = false) {
  const val = (key) => data[key] || '';
  const num = (key) => data[key] || 0;
  const date = (key) => (data[key] ? data[key].slice(0, 10) : '');

  switch (view) {
    case 'sanpham':
      return `
        <td class="td px-6 py-2"><input type="checkbox" class="row-checkbox" disabled></td>
        <td class="td px-6 py-2"><input type="text" name="ma_vt" value="${val('ma_vt')}" class="inline-input" required></td>
        <td class="td px-6 py-2"><input type="text" name="ten_vt" value="${val('ten_vt')}" class="inline-input" required></td>
        <td class="td px-6 py-2"><input type="text" name="nganh" value="${val('nganh')}" class="inline-input"></td>
        <td class="td px-6 py-2"><input type="text" name="phu_trach" value="${val('phu_trach')}" class="inline-input"></td>
      `;
    case 'tonkho': {
        let tinhTrangInputHTML = '';
        const selectedDate = data.date ? new Date(data.date) : null;
        const currentTinhTrang = val('tinh_trang');
        const isDangSuDung = currentTinhTrang === 'Đang Sử Dụng';
        const isHangHu = currentTinhTrang === 'Hàng Hư';
        const isConSuDung = currentTinhTrang === 'Còn Sử Dụng' || !currentTinhTrang;
        
        let canSelectOtherOptions = true;
        if (selectedDate) {
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const threeMonthsFromNow = new Date(); threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);
            if (selectedDate < today) {
                tinhTrangInputHTML = `<input type="text" name="tinh_trang" value="Hết Date" class="inline-input bg-gray-input" readonly>`;
                canSelectOtherOptions = false;
            } else if (selectedDate <= threeMonthsFromNow) {
                tinhTrangInputHTML = `<input type="text" name="tinh_trang" value="Cận Date" class="inline-input bg-gray-input" readonly>`;
                canSelectOtherOptions = false;
            }
        }
        
        if (canSelectOtherOptions) {
             tinhTrangInputHTML = `
                <select name="tinh_trang" class="inline-input">
                    <option value="Còn Sử Dụng" ${isConSuDung ? 'selected' : ''}>Còn Sử Dụng</option>
                    <option value="Đang Sử Dụng" ${isDangSuDung ? 'selected' : ''}>Đang Sử Dụng</option>
                    <option value="Hàng Hư" ${isHangHu ? 'selected' : ''}>Hàng Hư</option>
                </select>`;
        }
        
        // MỚI: Lấy giá trị nhap, xuat, ton_cuoi từ data
        const nhap = data.nhap || 0;
        const xuat = data.xuat || 0;
        const ton_cuoi = data.ton_cuoi !== undefined ? data.ton_cuoi : num('ton_dau'); // Fallback về ton_dau nếu chưa có


        const maVtSelectorHTML = `
          <div class="inline-custom-select relative">
            <input type="hidden" name="ma_vt" value="${val('ma_vt')}">
            <button type="button" class="inline-custom-select-toggle w-full text-left inline-input">
                <span class="truncate">${val('ma_vt') || 'Chọn Mã VT...'}</span>
            </button>
            <div class="inline-custom-select-panel hidden absolute top-full left-0 mt-1 w-64 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg z-50 p-2">
                <input type="text" class="inline-custom-select-search w-full px-2 py-1 mb-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700" placeholder="Tìm Mã VT...">
                <div class="inline-custom-select-list max-h-48 overflow-y-auto">
                    ${sanphamDataForLookup.map(p => `<div class="inline-custom-select-item p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer" data-value="${p.ma_vt}">${p.ma_vt}</div>`).join('')}
                </div>
            </div>
          </div>`;

        return `
            <td class="td px-6 py-2"><input type="checkbox" class="row-checkbox" disabled></td>
            <td class="td px-6 py-2"><input type="text" name="ma_vach" value="${val('ma_vach')}" class="inline-input bg-gray-input" readonly required placeholder="Tự động tạo"></td>
            <td class="td px-6 py-2">${maVtSelectorHTML}</td>
            <td class="td px-6 py-2"><input type="text" name="ten_vt" value="${val('ten_vt')}" class="inline-input bg-gray-input" readonly></td>
            <td class="td px-6 py-2"><input type="text" name="lot" value="${val('lot')}" class="inline-input" oninput="handleTonkhoInputChange(this)"></td>
            <td class="td px-6 py-2"><input type="text" name="date" value="${formatDate(data.date)}" placeholder="dd/mm/yyyy" class="inline-input" oninput="handleTonkhoInputChange(this)"></td>
            <td class="td px-6 py-2"><input type="number" name="ton_dau" value="${num('ton_dau')}" class="inline-input" required oninput="handleTonkhoInputChange(this)"></td>
            
            <!-- THAY ĐỔI: Thêm name và class, cập nhật value -->
            <td class="td px-6 py-2"><input type="text" name="nhap" value="${nhap}" class="inline-input-text bg-gray-input text-center text-nhap" readonly></td>
            <td class="td px-6 py-2"><input type="text" name="xuat" value="${xuat}" class="inline-input-text bg-gray-input text-center text-xuat" readonly></td>
            <td class="td px-6 py-2"><input type="text" name="ton_cuoi" value="${ton_cuoi}" class="inline-input-text bg-gray-input text-center" readonly></td>

            <td class="td px-6 py-2 tinh-trang-cell">${tinhTrangInputHTML}</td>
            <td class="td px-6 py-2"><input type="text" name="tray" value="${val('tray')}" class="inline-input"></td>
            <td class="td px-6 py-2"><input type="text" name="nganh" value="${val('nganh')}" class="inline-input bg-gray-input" readonly></td>
            <td class="td px-6 py-2"><input type="text" name="phu_trach" value="${val('phu_trach')}" class="inline-input bg-gray-input" readonly></td>
        `;
    }
    default: return '';
  }
} 

// ===============================================
// ===== 11.B LOGIC FOR DON HANG MODAL (MỚI) =====
// ===============================================

let modalMaVtList = []; // Cache list of Ma VT for the modal

function generateUniqueId(length = 6) {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function updateDonhangModalCodes() {
    if (donhangModalState.mode !== 'add') return; // Only auto-generate for new orders

    const loaiDon = document.getElementById('donhang-modal_loai_don').value;
    const nganh = document.getElementById('donhang-modal-nganh').value || '';
    const maKhoInput = document.getElementById('donhang-modal-ma_kho');
    const maNxInput = document.getElementById('donhang-modal-ma_nx');

    const randomDigits = generateUniqueId(6);
    const nganhFormatted = nganh.toUpperCase().replace(/\s+/g, '');

    if (loaiDon === 'Xuat') {
        maKhoInput.value = `OUT.JNJ.${randomDigits}`;
        maNxInput.value = `DO-2025-${nganhFormatted}-`;
    } else { // Nhap
        maKhoInput.value = `IN.JNJ.${randomDigits}`;
        maNxInput.value = `RO-2025-${nganhFormatted}-`;
    }
}

async function openDonhangModal(mode = 'add', data = null) {
    donhangModalState.mode = mode;
    donhangModalState.originalMaNx = data ? data.donhang.ma_nx : null;

    try {
        donhangModal.saveButton.disabled = true;

        if (nganhDataCache.length === 0) {
            const { data, error } = await supabase.from('SANPHAM').select('nganh');
            if (error) throw error;
            nganhDataCache = [...new Set(data.map(item => item.nganh).filter(Boolean))].sort();
            const datalist = document.getElementById('nganh-options');
            datalist.innerHTML = nganhDataCache.map(nganh => `<option value="${nganh}"></option>`).join('');
        }
        
        if (modalMaVtList.length === 0) {
             const { data, error } = await supabase.from('TONKHO').select('ma_vt');
            if (error) throw error;
            modalMaVtList = [...new Set(data.map(item => item.ma_vt).filter(Boolean))].sort();
        }

        const modalTitle = document.querySelector('#add-donhang-modal h3');
        const saveButton = document.getElementById('donhang-modal-save');
        
        donhangModal.productsBody.innerHTML = '';

        if (mode === 'edit') {
            modalTitle.textContent = 'Chỉnh Sửa Đơn Hàng';
            saveButton.textContent = 'Cập Nhật Đơn Hàng';

            const { donhang, chitiet } = data;
            // Populate general info
            document.getElementById('donhang-modal-thoi_gian').value = donhang.thoi_gian ? donhang.thoi_gian.split('T')[0] : '';
            document.getElementById('donhang-modal-loai_don').value = (donhang.ma_kho || '').toUpperCase().includes('OUT') ? 'Xuat' : 'Nhap';
            document.getElementById('donhang-modal-ma_kho').value = donhang.ma_kho;
            document.getElementById('donhang-modal-ma_nx').value = donhang.ma_nx;
            document.getElementById('donhang-modal-user').value = donhang.user;
            document.getElementById('donhang-modal-nganh').value = donhang.nganh;
            document.getElementById('donhang-modal-muc_dich').value = donhang.muc_dich;
            document.getElementById('donhang-modal-dia_chi').value = donhang.dia_chi;
            document.getElementById('donhang-modal-ghi_chu').value = donhang.ghi_chu;
            document.getElementById('donhang-modal-order').value = donhang.order;
            document.getElementById('donhang-modal-pkl').value = donhang.pkl;
            document.getElementById('donhang-modal-done').value = donhang.done;
            document.getElementById('donhang-modal-image').value = donhang.image;

            // Populate product list
            if (chitiet && chitiet.length > 0) {
                for (const product of chitiet) {
                    await addProductRowToModal(product);
                }
            } else {
                addProductRowToModal();
            }

        } else { // mode 'add'
            modalTitle.textContent = 'Tạo Đơn Hàng Mới';
            saveButton.textContent = 'Lưu Đơn Hàng';
            donhangModal.modal.querySelectorAll('input, textarea, select').forEach(el => {
                if (el.tagName !== 'SELECT') el.value = '';
            });
            donhangModal.loaiDonSelect.value = 'Xuat';
            document.getElementById('donhang-modal-thoi_gian').value = new Date().toISOString().split('T')[0];
            updateDonhangModalCodes(); // Generate initial codes
            addProductRowToModal();
        }
        
        updateDonhangModalLabels();
        donhangModal.modal.classList.remove('hidden');

    } catch (error) {
        console.error('Lỗi mở modal đơn hàng:', error);
        showToast(`Không thể mở form đơn hàng: ${error.message}`, 'error');
    } finally {
        donhangModal.saveButton.disabled = false;
    }
}


function closeDonhangModal() {
    donhangModal.modal.classList.add('hidden');
}

function updateDonhangModalLabels() {
    const isExport = donhangModal.loaiDonSelect.value === 'Xuat';
    donhangModal.labelMaNx.textContent = isExport ? 'Mã Xuất' : 'Mã Nhập';
    donhangModal.labelUser.textContent = isExport ? 'Xuất Cho' : 'Nhập Từ';
    donhangModal.headerSoLuong.textContent = isExport ? 'Xuất' : 'Nhập';
    
    // Update Tồn Sau for all existing rows as the calculation logic changes
    donhangModal.productsBody.querySelectorAll('tr').forEach(row => {
        const soLuongInput = row.querySelector('input[name="so_luong"]');
        if (soLuongInput) {
            handleModalProductChange({ target: soLuongInput });
        }
    });
}

async function addProductRowToModal(productData = null) {
    const rowCount = donhangModal.productsBody.children.length;
    const newRow = document.createElement('tr');
    newRow.className = 'product-row';
    newRow.draggable = true;

    const maVtOptions = modalMaVtList.map(ma_vt => `<option value="${ma_vt}" ${productData && productData.ma_vt === ma_vt ? 'selected' : ''}>${ma_vt}</option>`).join('');

    newRow.innerHTML = `
        <td class="modal-td text-center">
          <div class="drag-handle">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16m-7 6h7" /></svg>
            <span class="stt-number ml-1">${rowCount + 1}</span>
          </div>
        </td>
        <td class="modal-td">
            <select name="ma_vt" class="modal-td-input">
                <option value="">Chọn VT</option>
                ${maVtOptions}
            </select>
            <input type="hidden" name="lot" value="${productData?.lot || ''}">
        </td>
        <td class="modal-td"><input type="text" name="ten_vt" class="modal-td-input" readonly value="${productData?.ten_vt || ''}"></td>
        <td class="modal-td">
            <select name="lot_select" class="modal-td-input" disabled>
                <option value="">Chọn LOT</option>
            </select>
        </td>
        <td class="modal-td"><input type="text" name="date" class="modal-td-input" readonly></td>
        <td class="modal-td"><input type="number" name="yeu_cau" min="1" class="modal-td-input" value="${productData?.yeu_cau || ''}"></td>
        <td class="modal-td"><input type="number" name="so_luong" min="0" class="modal-td-input" value="${productData?.so_luong || ''}"></td>
        <td class="modal-td ton-sau-cell"><input type="text" name="ton_sau" class="modal-td-input" readonly></td>
        <td class="modal-td"><input type="text" name="ma_vach" class="modal-td-input" readonly></td>
        <td class="modal-td">
            <select name="loai" class="modal-td-input">
                <option value="Tiêu Hao" ${productData?.loai === 'Tiêu Hao' ? 'selected' : ''}>Tiêu Hao</option>
                <option value="Trưng Bày" ${productData?.loai === 'Trưng Bày' ? 'selected' : ''}>Trưng Bày</option>
            </select>
        </td>
        <td class="modal-td text-center">
            <button type="button" class="delete-product-row text-red-500 hover:text-red-700">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>
            </button>
        </td>
    `;
    donhangModal.productsBody.appendChild(newRow);

    if (productData && productData.ma_vt) {
        const maVtSelect = newRow.querySelector('select[name="ma_vt"]');
        await handleModalProductChange({ target: maVtSelect }, productData);
    }
}

function reindexModalRows() {
    donhangModal.productsBody.querySelectorAll('tr.product-row').forEach((row, index) => {
        const stt = row.querySelector('.stt-number');
        if (stt) stt.textContent = index + 1;
    });
}

function deleteModalProductRow(button) {
    button.closest('tr').remove();
    reindexModalRows();
}

async function handleModalProductChange(event, productToSelect = null) {
    const input = event.target;
    if (!input) return;
    const row = input.closest('tr');
    if (!row) return;

    const maVtSelect = row.querySelector('select[name="ma_vt"]');
    const tenVtInput = row.querySelector('input[name="ten_vt"]');
    const lotSelect = row.querySelector('select[name="lot_select"]');
    const hiddenLotInput = row.querySelector('input[name="lot"]');
    const dateInput = row.querySelector('input[name="date"]');
    const soLuongInput = row.querySelector('input[name="so_luong"]');
    const tonSauInput = row.querySelector('input[name="ton_sau"]');
    const maVachInput = row.querySelector('input[name="ma_vach"]');

    if (input.name === 'ma_vt') {
        const selectedMaVt = maVtSelect.value;
        // Clear all dependent fields
        tenVtInput.value = '';
        lotSelect.innerHTML = '<option value="">Chọn LOT</option>';
        lotSelect.disabled = true;
        dateInput.value = '';
        tonSauInput.value = '';
        maVachInput.value = '';
        hiddenLotInput.value = '';
        row.dataset.currentStock = '0';
        row.dataset.phuTrach = '';
        row.dataset.nganh = '';

        if (selectedMaVt) {
            try {
                const { data: sanphamData, error: spError } = await supabase.from('SANPHAM').select('ten_vt, phu_trach, nganh').eq('ma_vt', selectedMaVt).single();
                if (spError) throw spError;
                if (sanphamData) {
                    tenVtInput.value = sanphamData.ten_vt;
                    row.dataset.phuTrach = sanphamData.phu_trach || '';
                    row.dataset.nganh = sanphamData.nganh || '';
                }

                // Complex query to get all inventory and transaction data
                const { data: tonkhoItems, error: tonkhoError } = await supabase.from('TONKHO').select('ma_vach, lot, date, ton_dau, tinh_trang').eq('ma_vt', selectedMaVt);
                if (tonkhoError) throw tonkhoError;
                
                if (tonkhoItems.length > 0) {
                    const maVachs = tonkhoItems.map(item => item.ma_vach);
                    const { data: chiTietData, error: chiTietError } = await supabase.from('CHITIET').select('ma_vach, ma_kho, so_luong').in('ma_vach', maVachs);
                    if (chiTietError) throw chiTietError;

                    const aggregatedDetails = {};
                    for (const detail of chiTietData) {
                        if (!aggregatedDetails[detail.ma_vach]) {
                            aggregatedDetails[detail.ma_vach] = { nhap: 0, xuat: 0 };
                        }
                        const soLuong = Number(detail.so_luong) || 0;
                        if (String(detail.ma_kho).toUpperCase().includes('IN')) aggregatedDetails[detail.ma_vach].nhap += soLuong;
                        if (String(detail.ma_kho).toUpperCase().includes('OUT')) aggregatedDetails[detail.ma_vach].xuat += soLuong;
                    }

                    const lotOptionsData = tonkhoItems.map(item => {
                        const aggregates = aggregatedDetails[item.ma_vach] || { nhap: 0, xuat: 0 };
                        const ton_cuoi = (item.ton_dau || 0) + aggregates.nhap - aggregates.xuat;
                        const displayStatus = item.tinh_trang || 'Còn Sử Dụng';
                        const formattedDate = formatDate(item.date);
                        const displayString = `${item.lot} Date: ${formattedDate} Tồn: ${ton_cuoi} ${displayStatus}`;
                        return {
                            ma_vach: item.ma_vach, lot: item.lot, date: formattedDate,
                            stock: ton_cuoi, display: displayString
                        };
                    });
                    
                    lotSelect.innerHTML += lotOptionsData.map(d => `
                        <option value="${d.ma_vach}" data-lot="${d.lot}" data-date="${d.date}" data-stock="${d.stock}">${d.display}</option>
                    `).join('');
                    lotSelect.disabled = false;
                    
                    if (productToSelect && productToSelect.ma_vach) {
                        lotSelect.value = productToSelect.ma_vach;
                        await handleModalProductChange({ target: lotSelect });
                    }
                }
            } catch (error) {
                console.error("Lỗi tải dữ liệu cho Mã VT:", error);
                showToast(`Lỗi tải dữ liệu cho Mã VT ${selectedMaVt}`, 'error');
            }
        }
    }

    if (input.name === 'lot_select') {
        const selectedOption = lotSelect.options[lotSelect.selectedIndex];
        if (selectedOption && selectedOption.value) {
            hiddenLotInput.value = selectedOption.dataset.lot || '';
            dateInput.value = selectedOption.dataset.date || '';
            maVachInput.value = selectedOption.value || '';
            row.dataset.currentStock = selectedOption.dataset.stock || '0';
        } else {
            hiddenLotInput.value = '';
            dateInput.value = '';
            maVachInput.value = '';
            row.dataset.currentStock = '0';
        }
        // Trigger calculation for so_luong
        handleModalProductChange({ target: soLuongInput });
    }

    if (['so_luong', 'yeu_cau'].includes(input.name)) {
        const soLuong = parseInt(soLuongInput.value, 10) || 0;
        const currentStock = parseInt(row.dataset.currentStock || '0', 10);
        const isExport = donhangModal.loaiDonSelect.value === 'Xuat';
        
        soLuongInput.classList.toggle('border-red-500', isExport && soLuong > currentStock);
        tonSauInput.value = isExport ? (currentStock - soLuong) : (currentStock + soLuong);
    }
}

function convertDateForDB(dateString) { // dd/mm/yyyy to yyyy-mm-dd
    if (!dateString || !/^\d{2}\/\d{2}\/\d{4}$/.test(dateString)) return null;
    const [day, month, year] = dateString.split('/');
    return `${year}-${month}-${day}`;
}

async function saveDonhang() {
    const donhangData = {
        thoi_gian: document.getElementById('donhang-modal-thoi_gian').value,
        ma_kho: document.getElementById('donhang-modal-ma_kho').value,
        ma_nx: document.getElementById('donhang-modal-ma_nx').value,
        user: document.getElementById('donhang-modal-user').value,
        nganh: document.getElementById('donhang-modal-nganh').value,
        muc_dich: document.getElementById('donhang-modal-muc_dich').value,
        dia_chi: document.getElementById('donhang-modal-dia_chi').value,
        ghi_chu: document.getElementById('donhang-modal-ghi_chu').value,
        order: document.getElementById('donhang-modal-order').value || null,
        pkl: document.getElementById('donhang-modal-pkl').value || null,
        done: document.getElementById('donhang-modal-done').value || null,
        image: document.getElementById('donhang-modal-image').value || null,
    };

    for (const key of ['thoi_gian', 'ma_kho', 'ma_nx']) {
        if (!donhangData[key]) {
            showToast(`Lỗi: Vui lòng điền ${key}.`, 'error');
            return;
        }
    }

    const productRows = donhangModal.productsBody.querySelectorAll('tr');
    if (productRows.length === 0) {
        showToast('Lỗi: Phải có ít nhất một sản phẩm.', 'error');
        return;
    }

    const chitietDataList = [];
    for (const [index, row] of productRows.entries()) {
        const soLuongInput = row.querySelector('[name="so_luong"]');
        const soLuong = parseInt(soLuongInput.value, 10);
        if (isNaN(soLuong) || soLuong <= 0) {
             showToast(`Lỗi ở sản phẩm STT ${index + 1}: Số lượng phải lớn hơn 0.`, 'error');
             return;
        }
        if(soLuongInput.classList.contains('border-red-500')){
             showToast(`Lỗi ở sản phẩm STT ${index + 1}: Số lượng xuất vượt tồn kho.`, 'error');
             return;
        }
        if(!row.querySelector('[name="ma_vt"]').value) {
            showToast(`Lỗi ở sản phẩm STT ${index + 1}: Vui lòng chọn Mã VT.`, 'error');
            return;
        }

        chitietDataList.push({
            thoi_gian: donhangData.thoi_gian,
            ma_kho: donhangData.ma_kho,
            ma_nx: donhangData.ma_nx,
            user: donhangData.user,
            muc_dich: donhangData.muc_dich,
            phu_trach: row.dataset.phuTrach || null,
            nganh: row.dataset.nganh || null,
            ma_vt: row.querySelector('[name="ma_vt"]').value,
            ten_vt: row.querySelector('[name="ten_vt"]').value,
            lot: row.querySelector('[name="lot"]').value,
            date: convertDateForDB(row.querySelector('[name="date"]').value),
            yeu_cau: parseInt(row.querySelector('[name="yeu_cau"]').value, 10) || null,
            so_luong: soLuong,
            ma_vach: row.querySelector('[name="ma_vach"]').value,
            loai: row.querySelector('[name="loai"]').value,
        });
    }

    try {
        donhangModal.saveButton.disabled = true;
        showToast('Đang lưu đơn hàng...', 'warning');
        
        if (donhangModalState.mode === 'add' || (donhangModalState.mode === 'edit' && donhangData.ma_nx !== donhangModalState.originalMaNx)) {
             const { data: existing, error: checkError } = await supabase.from('DONHANG').select('ma_nx').eq('ma_nx', donhangData.ma_nx).maybeSingle();
             if (checkError) throw checkError;
             if (existing) {
                 showToast(`Lỗi: Mã NX '${donhangData.ma_nx}' đã tồn tại.`, 'error');
                 donhangModal.saveButton.disabled = false;
                 return;
             }
        }
        
        if (donhangModalState.mode === 'edit') {
            const { error: donhangError } = await supabase.from('DONHANG').update(donhangData).eq('ma_nx', donhangModalState.originalMaNx);
            if (donhangError) throw donhangError;

            const { error: deleteError } = await supabase.from('CHITIET').delete().eq('ma_nx', donhangModalState.originalMaNx);
            if (deleteError) throw deleteError;

            const { error: insertError } = await supabase.from('CHITIET').insert(chitietDataList);
            if (insertError) throw insertError;
            
        } else { // mode 'add'
            const { error: donhangError } = await supabase.from('DONHANG').insert([donhangData]);
            if (donhangError) throw donhangError;

            const { error: insertError } = await supabase.from('CHITIET').insert(chitietDataList);
            if (insertError) throw insertError;
        }

        showToast('Lưu đơn hàng thành công!', 'success');
        closeDonhangModal();
        loadDonhang(); 
        loadTonkho(); 
        loadChitiet();

    } catch (error) {
        console.error('Lỗi lưu đơn hàng:', error);
        showToast(`Lỗi khi lưu: ${error.message}`, 'error');
    } finally {
        donhangModal.saveButton.disabled = false;
    }
}

// ===== 12. Gắn Event Listeners =====
// MỚI: Logic bộ lọc điều kiện
async function updateDependentFilters(viewId, changedColumn) {
    const filterConfig = {
        sanpham: { table: 'SANPHAM', columns: ['ma_vt', 'ten_vt', 'nganh', 'phu_trach'] },
        tonkho: { table: 'TONKHO', columns: ['ma_vt', 'lot', 'tinh_trang', 'nganh', 'phu_trach'] },
        donhang: { table: 'DONHANG', columns: ['ma_kho', 'ma_nx'] },
        chitiet: { table: 'CHITIET', columns: ['ma_kho', 'ma_nx', 'ma_vt', 'lot', 'nganh', 'phu_trach'] }
    };

    const config = filterConfig[viewId];
    if (!config) return;

    let filterState;
    if (viewId === 'sanpham') filterState = sanphamFilterState;
    else if (viewId === 'tonkho') filterState = tonkhoFilterState;
    else if (viewId === 'donhang') filterState = donhangFilterState;
    else if (viewId === 'chitiet') filterState = chitietFilterState;
    else return;

    for (const columnToUpdate of config.columns) {
        // Không cần cập nhật lại chính cột vừa thay đổi
        if (columnToUpdate === changedColumn) continue;

        let query = supabase.from(config.table).select(columnToUpdate);

        // Áp dụng tất cả các bộ lọc đang hoạt động
        for (const [key, valueSet] of Object.entries(filterState)) {
            if (valueSet instanceof Set && valueSet.size > 0) {
                query = query.in(key, Array.from(valueSet));
            }
        }
        
        try {
            const { data, error } = await query;
            if (error) throw error;
            
            const availableOptions = [...new Set(data.map(item => item[columnToUpdate]).filter(Boolean))].sort();
            
            const filterElement = document.querySelector(`#filter-${viewId} .custom-filter[data-filter-column="${columnToUpdate}"]`);
            if (filterElement) {
                populateCustomFilterList(filterElement, availableOptions, columnToUpdate, filterState);
            }

        } catch (error) {
            console.error(`Lỗi cập nhật bộ lọc cho cột ${columnToUpdate}:`, error);
        }
    }
}


function initApp() {
  // Navigation
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      showView(e.target.dataset.view);
    });
  });

  // Toolbar
  toolbar.add.addEventListener('click', handleToolbarAdd);
  toolbar.edit.addEventListener('click', handleToolbarEdit);
  toolbar.delete.addEventListener('click', handleToolbarDelete);
  toolbar.save.addEventListener('click', handleToolbarSave);
  toolbar.cancel.addEventListener('click', handleToolbarCancel);
  toolbar.search.addEventListener('input', handleToolbarSearch);
  toolbar.clearFilter.addEventListener('click', handleToolbarClearFilter);
  toolbar.sync.addEventListener('click', handleSync);
  toolbar.excel.addEventListener('click', exportToExcel);


  // Bộ lọc
  toolbarToggleFilter.addEventListener('click', () => {
    const isHidden = filterPanel.classList.toggle('hidden');
    toolbarToggleFilterText.textContent = isHidden ? 'Hiện bộ lọc' : 'Ẩn bộ lọc';
  });
  
  // Settings & Dark Mode
  fontSizeSelect.addEventListener('change', handleFontSizeChange);

  // Pagination
  paginationControls.limitSelect.addEventListener('change', () => {
      pagination.limit = parseInt(paginationControls.limitSelect.value, 10);
      pagination.page = 1;
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
  paginationControls.pageInput.addEventListener('change', () => {
      let newPage = parseInt(paginationControls.pageInput.value, 10);
      if (newPage > 0 && newPage <= pagination.totalPages) {
          pagination.page = newPage;
          loadDataForCurrentView();
      } else {
          paginationControls.pageInput.value = pagination.page; // revert
      }
  });
  
  // MỚI: Event listener cho Document để xử lý click bên ngoài
  document.addEventListener('click', (e) => {
    // Ẩn popover bộ lọc
    document.querySelectorAll('.custom-filter').forEach(filter => {
      if (!filter.contains(e.target)) {
        filter.querySelector('.custom-filter-panel').classList.add('hidden');
      }
    });

    // Ẩn popover inline-select trong edit Tồn Kho
    document.querySelectorAll('.inline-custom-select').forEach(sel => {
        if (!sel.contains(e.target)) {
            sel.querySelector('.inline-custom-select-panel').classList.add('hidden');
        }
    });

    // Ẩn popover Cài đặt
    if (!settingsMenu.contains(e.target)) {
      settingsPopover.classList.add('hidden');
    }
  });

  // MỚI: Listeners cho Custom Filters
  document.querySelectorAll('.custom-filter').forEach(filter => {
    const toggleButton = filter.querySelector('.custom-filter-toggle');
    const panel = filter.querySelector('.custom-filter-panel');
    const searchInput = filter.querySelector('.custom-filter-search');
    const applyButton = filter.querySelector('.custom-filter-apply');
    const list = filter.querySelector('.custom-filter-list');
    const column = filter.dataset.filterColumn;
    
    toggleButton.addEventListener('click', () => panel.classList.toggle('hidden'));
    
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            const term = searchInput.value.toLowerCase();
            list.querySelectorAll('.custom-filter-item').forEach(item => {
                const label = item.querySelector('label')?.textContent.toLowerCase() || '';
                item.style.display = label.includes(term) ? 'flex' : 'none';
            });
        });
    }

    if (applyButton) {
        applyButton.addEventListener('click', async () => {
            let state;
            if (currentView === 'sanpham') state = sanphamFilterState;
            else if (currentView === 'tonkho') state = tonkhoFilterState;
            else if (currentView === 'donhang') state = donhangFilterState;
            else if (currentView === 'chitiet') state = chitietFilterState;
            
            state[column].clear();
            list.querySelectorAll('.custom-filter-checkbox:checked').forEach(cb => {
                state[column].add(cb.value);
            });
            
            updateCustomFilterText(column, filter);
            panel.classList.add('hidden');
            pagination.page = 1;
            
            // Cập nhật các bộ lọc khác và tải lại dữ liệu
            await updateDependentFilters(currentView, column);
            loadDataForCurrentView();
        });
    }
  });

  // MỚI: Listener cho các item/checkbox trong bộ lọc để dễ click
  document.getElementById('filter-panel').addEventListener('click', (e) => {
    const item = e.target.closest('.custom-filter-item');
    if (item) {
        const checkbox = item.querySelector('input[type="checkbox"]');
        if (checkbox && e.target !== checkbox) {
            checkbox.checked = !checkbox.checked;
        }
    }

    // Xử lý "Chọn tất cả"
    if (e.target.classList.contains('custom-filter-select-all')) {
        const list = e.target.closest('.custom-filter-list');
        list.querySelectorAll('.custom-filter-checkbox').forEach(cb => {
            cb.checked = e.target.checked;
        });
    }
  });
  
  // MỚI: Listener cho bộ lọc ngày tháng
  document.querySelectorAll('#filter-donhang input[type="date"], #filter-chitiet input[type="date"]').forEach(input => {
    input.addEventListener('change', (e) => {
        let state;
        if (currentView === 'donhang') state = donhangFilterState;
        else if (currentView === 'chitiet') state = chitietFilterState;

        if (e.target.name === 'thoi_gian_from') state.thoi_gian_from = e.target.value;
        if (e.target.name === 'thoi_gian_to') state.thoi_gian_to = e.target.value;
        
        pagination.page = 1;
        loadDataForCurrentView();
    });
  });

  // MỚI: Listener cho edit nội tuyến Tồn Kho (custom select)
  document.querySelector('#view-tonkho').addEventListener('click', (e) => {
    const toggle = e.target.closest('.inline-custom-select-toggle');
    if (toggle) {
        const panel = toggle.nextElementSibling;
        panel.classList.toggle('hidden');
        panel.querySelector('.inline-custom-select-search').focus();
    }
    
    const item = e.target.closest('.inline-custom-select-item');
    if (item) {
        const customSelect = item.closest('.inline-custom-select');
        const hiddenInput = customSelect.querySelector('input[name="ma_vt"]');
        const toggleSpan = customSelect.querySelector('.inline-custom-select-toggle span');
        
        hiddenInput.value = item.dataset.value;
        toggleSpan.textContent = item.dataset.value;
        customSelect.querySelector('.inline-custom-select-panel').classList.add('hidden');

        // Trigger update
        handleTonkhoInputChange(hiddenInput);
    }
  });

  // MỚI: Tìm kiếm trong custom select Tồn kho
  document.querySelector('#view-tonkho').addEventListener('input', (e) => {
    if(e.target.classList.contains('inline-custom-select-search')) {
        const term = e.target.value.toLowerCase();
        const list = e.target.nextElementSibling;
        list.querySelectorAll('.inline-custom-select-item').forEach(item => {
            const value = item.dataset.value.toLowerCase();
            item.style.display = value.includes(term) ? 'block' : 'none';
        });
    }
  });

  // Dark Mode Toggle Logic
  darkModeToggle.addEventListener('click', () => {
      const isDarkMode = document.documentElement.classList.toggle('dark');
      localStorage.setItem('darkMode', isDarkMode);
      darkModeToggle.setAttribute('aria-checked', isDarkMode);
      darkModeToggleKnob.classList.toggle('translate-x-5', isDarkMode);
  });
  
  // Settings Popover Toggle
  settingsToggleButton.addEventListener('click', () => {
      settingsPopover.classList.toggle('hidden');
  });

  // --- Modal Đơn Hàng Listeners ---
  donhangModal.closeButton.addEventListener('click', closeDonhangModal);
  donhangModal.cancelButton.addEventListener('click', closeDonhangModal);
  donhangModal.saveButton.addEventListener('click', saveDonhang);
  donhangModal.addProductButton.addEventListener('click', () => addProductRowToModal());
  donhangModal.loaiDonSelect.addEventListener('change', updateDonhangModalLabels);
  // Auto-generate codes when nganh is changed in 'add' mode
  donhangModal.nganhInput.addEventListener('change', updateDonhangModalCodes);

  donhangModal.productsBody.addEventListener('change', handleModalProductChange);
  donhangModal.productsBody.addEventListener('input', handleModalProductChange); // For number inputs

  donhangModal.productsBody.addEventListener('click', (e) => {
      if (e.target.closest('.delete-product-row')) {
          deleteModalProductRow(e.target.closest('.delete-product-row'));
      }
  });
  
  // Drag and Drop for Modal Rows
  donhangModal.productsBody.addEventListener('dragstart', (e) => {
    if (e.target.classList.contains('product-row')) {
      e.target.classList.add('dragging');
    }
  });

  donhangModal.productsBody.addEventListener('dragend', (e) => {
    if (e.target.classList.contains('product-row')) {
      e.target.classList.remove('dragging');
      reindexModalRows();
    }
  });

  donhangModal.productsBody.addEventListener('dragover', (e) => {
    e.preventDefault();
    const draggingRow = document.querySelector('.dragging');
    if (!draggingRow) return;

    const afterElement = getDragAfterElement(donhangModal.productsBody, e.clientY);
    if (afterElement == null) {
      donhangModal.productsBody.appendChild(draggingRow);
    } else {
      donhangModal.productsBody.insertBefore(draggingRow, afterElement);
    }
  });

  // Load initial data
  showView('sanpham');
}

// Helper for drag and drop
function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('.product-row:not(.dragging)')];
  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}


// ===== 13. Export to Excel =====
async function exportToExcel() {
  if (currentEditState.mode) {
    showToast('Không thể xuất Excel khi đang chỉnh sửa.', 'warning');
    return;
  }

  showToast('Đang chuẩn bị dữ liệu Excel...', 'warning');

  try {
    let allData = [];
    let query;
    let fileName = `${currentView}_export.xlsx`;

    switch (currentView) {
      case 'sanpham':
        query = supabase.from('SANPHAM').select('ma_vt, ten_vt, nganh, phu_trach');
        break;
      case 'tonkho':
        // This is complex because of calculated fields. We'll fetch and process.
        await exportTonkhoToExcel();
        return; 
      case 'chitiet':
        query = supabase.from('CHITIET').select('*');
        break;
      default:
        showToast('Chức năng này không hỗ trợ cho view hiện tại.', 'error');
        return;
    }
    
    // Pagination logic for fetching all data
    let page = 0;
    const pageSize = 1000;
    while(true) {
        const { data, error } = await query.range(page * pageSize, (page + 1) * pageSize - 1);
        if (error) throw error;
        
        allData = allData.concat(data);
        
        if (data.length < pageSize) break;
        page++;
    }

    const worksheet = XLSX.utils.json_to_sheet(allData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, currentView);
    XLSX.writeFile(workbook, fileName);

    showToast('Xuất Excel thành công!', 'success');

  } catch (error) {
    console.error('Lỗi xuất Excel:', error);
    showToast(`Lỗi khi xuất Excel: ${error.message}`, 'error');
  }
}

async function exportTonkhoToExcel() {
    try {
        const { data: chiTietData, error: chiTietError } = await supabase.from('CHITIET').select('ma_vach, ma_kho, so_luong');
        if (chiTietError) throw chiTietError;

        const aggregatedDetails = {};
        for (const detail of chiTietData) {
            if (!detail.ma_vach) continue;
            if (!aggregatedDetails[detail.ma_vach]) {
                aggregatedDetails[detail.ma_vach] = { nhap: 0, xuat: 0 };
            }
            const soLuong = Number(detail.so_luong) || 0;
            if (detail.ma_kho && detail.ma_kho.toUpperCase().includes('IN')) aggregatedDetails[detail.ma_vach].nhap += soLuong;
            if (detail.ma_kho && detail.ma_kho.toUpperCase().includes('OUT')) aggregatedDetails[detail.ma_vach].xuat += soLuong;
        }

        let allTonkho = [];
        let page = 0;
        const pageSize = 1000;
        while(true) {
            const { data, error } = await supabase.from('TONKHO').select('*').range(page * pageSize, (page + 1) * pageSize - 1);
            if (error) throw error;
            allTonkho = allTonkho.concat(data);
            if (data.length < pageSize) break;
            page++;
        }
        
        const exportData = allTonkho.map(item => {
            const aggregates = aggregatedDetails[item.ma_vach] || { nhap: 0, xuat: 0 };
            return {
                'Mã Vạch': item.ma_vach,
                'Mã VT': item.ma_vt,
                'Tên VT': item.ten_vt,
                'Lot': item.lot,
                'Date': formatDate(item.date),
                'Tồn Đầu': item.ton_dau,
                'Nhập': aggregates.nhap,
                'Xuất': aggregates.xuat,
                'Tồn Cuối': (item.ton_dau || 0) + aggregates.nhap - aggregates.xuat,
                'Tình Trạng': item.tinh_trang,
                'Tray': item.tray,
                'Ngành': item.nganh,
                'Phụ Trách': item.phu_trach,
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(allData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, currentView);
    XLSX.writeFile(workbook, fileName);

    showToast('Xuất Excel thành công!', 'success');

  } catch (error) {
    console.error('Lỗi xuất Excel:', error);
    showToast(`Lỗi khi xuất Excel: ${error.message}`, 'error');
  }
}

async function exportTonkhoToExcel() {
    try {
        const { data: chiTietData, error: chiTietError } = await supabase.from('CHITIET').select('ma_vach, ma_kho, so_luong');
        if (chiTietError) throw chiTietError;

        const aggregatedDetails = {};
        for (const detail of chiTietData) {
            if (!detail.ma_vach) continue;
            if (!aggregatedDetails[detail.ma_vach]) {
                aggregatedDetails[detail.ma_vach] = { nhap: 0, xuat: 0 };
            }
            const soLuong = Number(detail.so_luong) || 0;
            if (detail.ma_kho && detail.ma_kho.toUpperCase().includes('IN')) aggregatedDetails[detail.ma_vach].nhap += soLuong;
            if (detail.ma_kho && detail.ma_kho.toUpperCase().includes('OUT')) aggregatedDetails[detail.ma_vach].xuat += soLuong;
        }

        let allTonkho = [];
        let page = 0;
        const pageSize = 1000;
        while(true) {
            const { data, error } = await supabase.from('TONKHO').select('*').range(page * pageSize, (page + 1) * pageSize - 1);
            if (error) throw error;
            allTonkho = allTonkho.concat(data);
            if (data.length < pageSize) break;
            page++;
        }
        
        const exportData = allTonkho.map(item => {
            const aggregates = aggregatedDetails[item.ma_vach] || { nhap: 0, xuat: 0 };
            return {
                'Mã Vạch': item.ma_vach,
                'Mã VT': item.ma_vt,
                'Tên VT': item.ten_vt,
                'Lot': item.lot,
                'Date': formatDate(item.date),
                'Tồn Đầu': item.ton_dau,
                'Nhập': aggregates.nhap,
                'Xuất': aggregates.xuat,
                'Tồn Cuối': (item.ton_dau || 0) + aggregates.nhap - aggregates.xuat,
                'Tình Trạng': item.tinh_trang,
                'Tray': item.tray,
                'Ngành': item.nganh,
                'Phụ Trách': item.phu_trach,
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'TonKho');
        XLSX.writeFile(workbook, 'tonkho_export.xlsx');
        showToast('Xuất Tồn Kho thành công!', 'success');

    } catch (error) {
        console.error('Lỗi xuất Tồn Kho:', error);
        showToast(`Lỗi khi xuất Tồn Kho: ${error.message}`, 'error');
    }
}

// ===== 14. Initial Load =====
function setDefaultDateFilters(view) {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    const toDateStr = today.toISOString().split('T')[0];
    const fromDateStr = firstDayOfMonth.toISOString().split('T')[0];

    const filterContainer = document.getElementById(`filter-${view}`);
    if (filterContainer) {
        filterContainer.querySelector('input[name="thoi_gian_from"]').value = fromDateStr;
        filterContainer.querySelector('input[name="thoi_gian_to"]').value = toDateStr;
        
        if (view === 'donhang') {
            donhangFilterState.thoi_gian_from = fromDateStr;
            donhangFilterState.thoi_gian_to = toDateStr;
        } else if (view === 'chitiet') {
            chitietFilterState.thoi_gian_from = fromDateStr;
            chitietFilterState.thoi_gian_to = toDateStr;
        }
    }
}


document.addEventListener('DOMContentLoaded', () => {
  // Check for saved dark mode preference
  if (localStorage.getItem('darkMode') === 'true' || 
     (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches && !localStorage.getItem('darkMode'))) {
    document.documentElement.classList.add('dark');
    darkModeToggle.setAttribute('aria-checked', 'true');
    darkModeToggleKnob.classList.add('translate-x-5');
  }
  
  setDefaultDateFilters('donhang');
  setDefaultDateFilters('chitiet');
  
  initApp();
});
