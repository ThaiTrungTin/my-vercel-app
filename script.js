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

// MỚI: Biến lưu trữ dữ liệu gốc và trạng thái bộ lọc custom
let sanphamDataCache = []; // Lưu trữ tất cả sản phẩm
let sanphamFilterState = {
  ma_vt: new Set(),
  ten_vt: new Set(),
  nganh: new Set(),
  phu_trach: new Set()
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
  sync: document.getElementById('toolbar-sync') // MỚI: ID này giờ nằm ở header
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
const fontSizeSelect = document.getElementById('font-size-select'); // MỚI: ID này giờ nằm ở header


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

  // MỚI: Xử lý hiển thị bộ lọc
  filterPanel.classList.add('hidden'); // 1. Luôn ẩn bảng lọc khi chuyển view
  toolbarToggleFilterText.textContent = 'Hiện bộ lọc'; // 2. Reset text nút

  // 3. Ẩn tất cả các tùy chọn lọc
  document.querySelectorAll('.filter-view-options').forEach(f => f.classList.add('hidden'));

  const filterOptions = document.getElementById(`filter-${viewId}`);

  // 4. Hiển thị nút "Hiện bộ lọc" VÀ tùy chọn lọc nếu nó tồn tại VÀ không phải view 'chitiet'
  if (filterOptions && viewId !== 'chitiet') {
    filterOptions.classList.remove('hidden'); // Hiển thị tùy chọn (ví dụ: filter-sanpham)
    toolbarToggleFilter.style.display = 'flex'; // Hiển thị nút "Hiện bộ lọc"

    // MỚI: Tải dữ liệu cho dropdowns nếu chưa tải
    if (viewId === 'sanpham' && !sanphamFiltersPopulated) {
      populateSanphamFilters();
    }

  } else {
    toolbarToggleFilter.style.display = 'none'; // Ẩn nút "Hiện bộ lọc" (cho view 'chitiet' hoặc view chưa có)
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
  if (currentEditState.mode === 'edit') return; // Đang *sửa* thì không thêm

  if (currentEditState.mode !== 'add') {
    // Lần click đầu tiên
    showInlineEditControls();
    currentEditState.view = currentView;
    currentEditState.mode = 'add';
  }

  // Các lần click tiếp theo
  switch (currentView) {
    case 'sanpham': createNewSanphamRow(); break;
    case 'tonkho': createNewTonkhoRow(); break;
    case 'donhang': createNewDonhangRow(); break;
    // case 'chitiet': (Bị ẩn)
  }
}

function handleToolbarEdit() {
  if (!selectedItem.id || currentEditState.mode) return;
  const { view, id } = selectedItem;
  switch (view) {
    case 'sanpham': editSanpham(id); break;
    case 'tonkho': editTonkho(id); break;
    case 'donhang': editDonhang(id); break;
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
  
  // MỚI: Reset cả các select filter
  document.querySelectorAll('.filter-select').forEach(select => {
    select.value = '';
  });

  // MỚI: Reset bộ lọc custom
  sanphamFilterState = {
    ma_vt: new Set(),
    ten_vt: new Set(),
    nganh: new Set(),
    phu_trach: new Set()
  };
  // MỚI: Cập nhật UI bộ lọc custom
  document.querySelectorAll('#filter-sanpham .custom-filter').forEach(filter => {
    updateCustomFilterText(filter.dataset.filterColumn, filter);
    // Bỏ check tất cả checkbox
    filter.querySelectorAll('.custom-filter-list input[type="checkbox"]').forEach(cb => {
      cb.checked = false;
    });
    // Reset ô tìm kiếm
    filter.querySelector('.custom-filter-search').value = '';
    // Hiển thị lại tất cả các item
    filter.querySelectorAll('.custom-filter-item').forEach(item => {
      item.style.display = 'flex';
    });
  });

  // MỚI: Reset phân trang
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
  if (event.target.closest('input, a, button')) return;

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
  sanphamTableBody.innerHTML = `<tr><td colspan="5" class="td-center">Đang tải dữ liệu...</td></tr>`;
  const searchTerm = toolbar.search.value.toLowerCase();

  // MỚI: Lấy giá trị từ bảng lọc (thay đổi ID)
  const filterMaVt = Array.from(sanphamFilterState.ma_vt);
  const filterTenVt = Array.from(sanphamFilterState.ten_vt);
  const filterNganh = Array.from(sanphamFilterState.nganh);
  const filterPhuTrach = Array.from(sanphamFilterState.phu_trach);

  try {
    let query = supabase.from('SANPHAM').select('*');
    let countQuery = supabase.from('SANPHAM').select('*', { count: 'exact', head: true }); // MỚI: Query đếm

    // 1. Lọc "Tìm kiếm nhanh" (OR)
    if (searchTerm) {
      const searchFilter = `ma_vt.ilike.%${searchTerm}%,ten_vt.ilike.%${searchTerm}%,nganh.ilike.%${searchTerm}%,phu_trach.ilike.%${searchTerm}%`;
      query = query.or(searchFilter);
      countQuery = countQuery.or(searchFilter); // MỚI
    }

    // 2. Lọc chi tiết (AND) - MỚI (dùng .eq() cho select)
    if (filterMaVt.length > 0) { 
      query = query.in('ma_vt', filterMaVt); 
      countQuery = countQuery.in('ma_vt', filterMaVt); // MỚI
    }
    if (filterTenVt.length > 0) { 
      query = query.in('ten_vt', filterTenVt); 
      countQuery = countQuery.in('ten_vt', filterTenVt); // MỚI
    }
    if (filterNganh.length > 0) { 
      query = query.in('nganh', filterNganh); 
      countQuery = countQuery.in('nganh', filterNganh); // MỚI
    }
    if (filterPhuTrach.length > 0) { 
      query = query.in('phu_trach', filterPhuTrach); 
      countQuery = countQuery.in('phu_trach', filterPhuTrach); // MỚI
    }

    // MỚI: 3. Lấy tổng số lượng
    const { count, error: countError } = await countQuery;
    if (countError) throw countError;
    
    pagination.totalItems = count || 0;
    updatePaginationUI(); // Cập nhật UI phân trang

    // MỚI: 4. Tính toán offset và áp dụng phân trang
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
      <tr id="sanpham-row-${item.ma_vt}" class="selectable-row hover:bg-gray-50" onclick="toggleRowSelection('sanpham', '${item.ma_vt}', event)">
        <td class="px-6 py-4"><input type="checkbox" class="row-checkbox" data-view="sanpham" data-id="${item.ma_vt}"></td>
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${item.ma_vt}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${item.ten_vt}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${item.nganh || ''}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${item.phu_trach || ''}</td>
      </tr>
    `).join('');
    attachCheckboxListeners('sanpham');
  } catch (error) {
    console.error('Lỗi tải sản phẩm:', error);
    sanphamTableBody.innerHTML = `<tr><td colspan="5" class="td-center text-red-500">Lỗi: ${error.message}</td></tr>`;
  }
  
  // MỚI: Cập nhật thời gian đồng bộ sau khi tải dữ liệu
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
    alert(`Lỗi: ${error.message}`);
  }
}

function createNewSanphamRow() {
  const tableBody = document.getElementById('sanpham-table-body');
  const newId = `new-${crypto.randomUUID()}`; // Unique ID
  const rowHtml = `<tr id="sanpham-row-${newId}" data-editing="true">${createEditableRowContents('sanpham', {}, false)}</tr>`;
  tableBody.insertAdjacentHTML('afterbegin', rowHtml);
  const newRow = document.getElementById(`sanpham-row-${newId}`);
  // Tự động focus vào ô đầu tiên
  newRow.querySelector('input[name="ma_vt"]').focus();
  return newRow; // Trả về row element
}

async function saveSanpham(data, mode, id) {
  // Chuẩn bị dữ liệu
  const cleanData = {
    ma_vt: data.ma_vt, // ma_vt là PK, phải có
    ten_vt: data.ten_vt,
    nganh: data.nganh || null,
    phu_trach: data.phu_trach || null
  };

  let error;
  if (mode === 'edit') {
    // Khi sửa, không update PK (ma_vt)
    const { error: updateError } = await supabase.from('SANPHAM').update({
      ten_vt: cleanData.ten_vt,
      nganh: cleanData.nganh,
      phu_trach: cleanData.phu_trach
    }).eq('ma_vt', id); // id là ma_vt
    error = updateError;
  } else {
    // Khi thêm mới, insert (id là null)
    const { error: insertError } = await supabase.from('SANPHAM').insert([cleanData]);
    error = insertError;
  }
  if (error) throw error; // Ném lỗi để handleToolbarSave bắt
}

async function deleteSanpham(ma_vt) {
  showConfirm(`Bạn có chắc muốn xóa sản phẩm '${ma_vt}' không?`, async () => {
    try {
      const { error } = await supabase.from('SANPHAM').delete().eq('ma_vt', ma_vt);
      if (error) throw error;
      loadSanpham();
    } catch (error) {
      console.error('Lỗi xóa sản phẩm:', error);
      alert(`Lỗi: ${error.message}`);
    }
  });
}

// ===== 8. CRUD cho TỒN KHO (TONKHO) =====

/**
 * MỚI: Helper định dạng ngày
 */
function formatDate(dateString) {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return ''; // Xử lý ngày không hợp lệ
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Tháng bắt đầu từ 0
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (e) {
    return ''; // Trả về rỗng nếu có lỗi
  }
}

async function loadTonkho() {
  clearSelection();
  tonkhoTableBody.innerHTML = `<tr><td colspan="14" class="td-center">Đang tải dữ liệu...</td></tr>`;
  const searchTerm = toolbar.search.value.toLowerCase();
  try {
    let query = supabase.from('TONKHO').select('*');
    let countQuery = supabase.from('TONKHO').select('*', { count: 'exact', head: true }); // MỚI
    
    if (searchTerm) {
      const searchFilter = `ma_vach.ilike.%${searchTerm}%,ma_vt.ilike.%${searchTerm}%,ten_vt.ilike.%${searchTerm}%,lot.ilike.%${searchTerm}%,tinh_trang.ilike.%${searchTerm}%`;
      query = query.or(searchFilter);
      countQuery = countQuery.or(searchFilter); // MỚI
    }

    // MỚI: Lấy count
    const { count, error: countError } = await countQuery;
    if (countError) throw countError;
    pagination.totalItems = count || 0;
    updatePaginationUI();
    
    // MỚI: Áp dụng range
    const from = (pagination.page - 1) * pagination.limit;
    const to = from + pagination.limit - 1;
    query = query.range(from, to);

    let { data, error } = await query.order('ma_vach');
    if (error) throw error;

    if (data.length === 0) {
      tonkhoTableBody.innerHTML = `<tr><td colspan="14" class="td-center">Chưa có dữ liệu.</td></tr>`;
      return;
    }

    tonkhoTableBody.innerHTML = data.map(item => {
      const ton_dau = Number(item.ton_dau) || 0;
      const nhap = Number(item.nhap) || 0;
      const xuat = Number(item.xuat) || 0;
      const ton_cuoi = ton_dau + nhap - xuat;

      return `
      <tr id="tonkho-row-${item.ma_vach}" class="selectable-row hover:bg-gray-50" onclick="toggleRowSelection('tonkho', '${item.ma_vach}', event)">
        <td class="px-6 py-4"><input type="checkbox" class="row-checkbox" data-view="tonkho" data-id="${item.ma_vach}"></td>
        <td class="px-6 py-4 text-sm font-medium text-gray-900">${item.ma_vach}</td>
        <td class="px-6 py-4 text-sm text-gray-600">${item.ma_vt || ''}</td>
        <td class="px-6 py-4 text-sm text-gray-600">${item.ten_vt || ''}</td>
        <td class="px-6 py-4 text-sm text-gray-600">${item.lot || ''}</td>
        <td class="px-6 py-4 text-sm text-gray-600">${formatDate(item.date)}</td>
        <td class="px-6 py-4 text-sm text-gray-600">${ton_dau}</td>
        <td class="px-6 py-4 text-sm text-gray-600">${nhap}</td>
        <td class="px-6 py-4 text-sm text-gray-600">${xuat}</td>
        <td class="px-6 py-4 text-sm font-bold text-gray-800">${ton_cuoi}</td>
        <td class="px-6 py-4 text-sm text-gray-600">${item.tinh_trang || ''}</td>
        <td class="px-6 py-4 text-sm text-gray-600">${item.tray || ''}</td>
        <td class="px-6 py-4 text-sm text-gray-600">${item.nganh || ''}</td>
        <td class="px-6 py-4 text-sm text-gray-600">${item.phu_trach || ''}</td>
      </tr>
    `}).join('');
    attachCheckboxListeners('tonkho');
  } catch (error) {
    console.error('Lỗi tải tồn kho:', error);
    tonkhoTableBody.innerHTML = `<tr><td colspan="14" class="td-center text-red-500">Lỗi: ${error.message}</td></tr>`;
  }
  
  // MỚI: Cập nhật thời gian đồng bộ sau khi tải dữ liệu
  updateLastSyncTime();
}

async function editTonkho(ma_vach) {
  try {
    let { data, error } = await supabase.from('TONKHO').select('*').eq('ma_vach', ma_vach).single();
    if (error) throw error;

    const row = document.getElementById(`tonkho-row-${ma_vach}`);
    row.innerHTML = createEditableRowContents('tonkho', data, true);
    row.setAttribute('data-editing', 'true');

    currentEditState = { view: 'tonkho', id: ma_vach, mode: 'edit' };
    showInlineEditControls();
  } catch (error) {
    console.error('Lỗi lấy dữ liệu sửa:', error);
    alert(`Lỗi: ${error.message}`);
  }
}

function createNewTonkhoRow() {
  const tableBody = document.getElementById('tonkho-table-body');
  const newId = `new-${crypto.randomUUID()}`;
  const rowHtml = `<tr id="tonkho-row-${newId}" data-editing="true">${createEditableRowContents('tonkho', {}, false)}</tr>`;
  tableBody.insertAdjacentHTML('afterbegin', rowHtml);
  const newRow = document.getElementById(`tonkho-row-${newId}`);
  // Tự động focus vào ô đầu tiên
  newRow.querySelector('input[name="ma_vach"]').focus();
  return newRow; // Trả về row element
}

async function saveTonkho(data, mode, id) {
  const cleanData = {
    ma_vach: data.ma_vach,
    ma_vt: data.ma_vt || null,
    ten_vt: data.ten_vt || null,
    lot: data.lot || null,
    date: data.date || null,
    ton_dau: Number(data.ton_dau) || 0,
    nhap: Number(data.nhap) || 0,
    xuat: Number(data.xuat) || 0,
    tinh_trang: data.tinh_trang || null,
    tray: data.tray || null,
    nganh: data.nganh || null,
    phu_trach: data.phu_trach || null,
  };

  let error;
  if (mode === 'edit') {
    delete cleanData.ma_vach; // Không update PK
    const { error: updateError } = await supabase.from('TONKHO').update(cleanData).eq('ma_vach', id); // id là ma_vach
    error = updateError;
  } else {
    // id là null
    const { error: insertError } = await supabase.from('TONKHO').insert([cleanData]);
    error = insertError;
  }
  if (error) throw error;
}

async function deleteTonkho(ma_vach) {
  showConfirm(`Bạn có chắc muốn xóa tồn kho '${ma_vach}' không?`, async () => {
    try {
      const { error } = await supabase.from('TONKHO').delete().eq('ma_vach', ma_vach);
      if (error) throw error;
      loadTonkho();
    } catch (error) {
      console.error('Lỗi xóa tồn kho:', error);
      alert(`Lỗi: ${error.message}`);
    }
  });
}


// ===== 9. CRUD cho ĐƠN HÀNG (DONHANG) =====

async function loadDonhang() {
  clearSelection();
  donhangTableBody.innerHTML = `<tr><td colspan="13" class="td-center">Đang tải dữ liệu...</td></tr>`;
  const searchTerm = toolbar.search.value.toLowerCase();
  try {
    let query = supabase.from('DONHANG').select('*');
    let countQuery = supabase.from('DONHANG').select('*', { count: 'exact', head: true }); // MỚI
    
    if (searchTerm) {
      const searchFilter = `ma_kho.ilike.%${searchTerm}%,ma_nx.ilike.%${searchTerm}%,user.ilike.%${searchTerm}%,nganh.ilike.%${searchTerm}%,muc_dich.ilike.%${searchTerm}%`;
      query = query.or(searchFilter);
      countQuery = countQuery.or(searchFilter); // MỚI
    }

    // MỚI: Lấy count
    const { count, error: countError } = await countQuery;
    if (countError) throw countError;
    pagination.totalItems = count || 0;
    updatePaginationUI();
    
    // MỚI: Áp dụng range
    const from = (pagination.page - 1) * pagination.limit;
    const to = from + pagination.limit - 1;
    query = query.range(from, to);

    let { data, error } = await query.order('ma_nx');
    if (error) throw error;

    if (data.length === 0) {
      donhangTableBody.innerHTML = `<tr><td colspan="13" class="td-center">Chưa có dữ liệu.</td></tr>`;
      return;
    }

    donhangTableBody.innerHTML = data.map(item => `
      <tr id="donhang-row-${item.ma_nx}" class="selectable-row hover:bg-gray-50" onclick="toggleRowSelection('donhang', '${item.ma_nx}', event)">
        <td class="px-6 py-4"><input type="checkbox" class="row-checkbox" data-view="donhang" data-id="${item.ma_nx}"></td>
        <td class="px-6 py-4 text-sm text-gray-600">${item.ma_kho || ''}</td>
        <td class="px-6 py-4 text-sm text-gray-600">${item.thoi_gian ? new Date(item.thoi_gian).toLocaleDateString() : ''}</td>
        <td class="px-6 py-4 text-sm font-medium text-gray-900">${item.ma_nx}</td>
        <td class="px-6 py-4 text-sm text-gray-600">${item.user || ''}</td>
        <td class="px-6 py-4 text-sm text-gray-600">${item.nganh || ''}</td>
        <td class="px-6 py-4 text-sm text-gray-600">${item.muc_dich || ''}</td>
        <td class="px-6 py-4 text-sm text-gray-600">${item.dia_chi || ''}</td>
        <td class="px-6 py-4 text-sm text-gray-600">${item.ghi_chu || ''}</td>
        <td class="px-6 py-4 text-sm text-gray-600">${item.order || ''}</td>
        <td class="px-6 py-4 text-sm text-gray-600">${item.pkl || ''}</td>
        <td class="px-6 py-4 text-sm text-gray-600">${item.done ? '✔️' : '❌'}</td>
        <td class="px-6 py-4 text-sm text-gray-600">${item.image ? 'Có' : ''}</td>
      </tr>
    `).join('');
    attachCheckboxListeners('donhang');
  } catch (error) {
    console.error('Lỗi tải đơn hàng:', error);
    donhangTableBody.innerHTML = `<tr><td colspan="13" class="td-center text-red-500">Lỗi: ${error.message}</td></tr>`;
  }
  
  // MỚI: Cập nhật thời gian đồng bộ sau khi tải dữ liệu
  updateLastSyncTime();
}

async function editDonhang(ma_nx) {
  try {
    let { data, error } = await supabase.from('DONHANG').select('*').eq('ma_nx', ma_nx).single();
    if (error) throw error;

    const row = document.getElementById(`donhang-row-${ma_nx}`);
    row.innerHTML = createEditableRowContents('donhang', data, true);
    row.setAttribute('data-editing', 'true');

    currentEditState = { view: 'donhang', id: ma_nx, mode: 'edit' };
    showInlineEditControls();
  } catch (error) {
    console.error('Lỗi lấy dữ liệu sửa:', error);
    alert(`Lỗi: ${error.message}`);
  }
}

function createNewDonhangRow() {
  const tableBody = document.getElementById('donhang-table-body');
  // Đặt ngày mặc định là hôm nay
  const defaultData = { thoi_gian: new Date().toISOString().slice(0, 10) }
  const newId = `new-${crypto.randomUUID()}`;
  const rowHtml = `<tr id="donhang-row-${newId}" data-editing="true">${createEditableRowContents('donhang', defaultData, false)}</tr>`;
  tableBody.insertAdjacentHTML('afterbegin', rowHtml);
  const newRow = document.getElementById(`donhang-row-${newId}`);
  // Tự động focus vào ô đầu tiên
  newRow.querySelector('input[name="ma_kho"]').focus();
  return newRow; // Trả về row element
}

async function saveDonhang(data, mode, id) {
  const cleanData = {
    ma_nx: data.ma_nx,
    ma_kho: data.ma_kho || null,
    thoi_gian: data.thoi_gian || null,
    user: data.user || null,
    nganh: data.nganh || null,
    muc_dich: data.muc_dich || null,
    dia_chi: data.dia_chi || null,
    ghi_chu: data.ghi_chu || null,
    order: data.order || null,
    pkl: data.pkl || null,
    image: data.image || null,
    done: data.done === 'on' || data.done === true, // Xử lý checkbox
  };

  let error;
  if (mode === 'edit') {
    delete cleanData.ma_nx; // Không update PK
    const { error: updateError } = await supabase.from('DONHANG').update(cleanData).eq('ma_nx', id); // id là ma_nx
    error = updateError;
  } else {
    // id là null
    const { error: insertError } = await supabase.from('DONHANG').insert([cleanData]);
    error = insertError;
  }
  if (error) throw error;
}

async function deleteDonhang(ma_nx) {
  showConfirm(`Bạn có chắc muốn xóa đơn hàng '${ma_nx}' không?`, async () => {
    try {
      const { error } = await supabase.from('DONHANG').delete().eq('ma_nx', ma_nx);
      if (error) throw error;
      loadDonhang();
    } catch (error) {
      console.error('Lỗi xóa đơn hàng:', error);
      alert(`Lỗi: ${error.message}`);
    }
  });
}

// ===== 10. CRUD cho CHI TIẾT (CHITIET) =====
// (Chỉ load và delete, không có add/edit inline)

async function loadChitiet() {
  clearSelection();
  chitietTableBody.innerHTML = `<tr><td colspan="15" class="td-center">Đang tải dữ liệu...</td></tr>`;
  const searchTerm = toolbar.search.value.toLowerCase();
  try {
    let query = supabase.from('CHITIET').select('*');
    let countQuery = supabase.from('CHITIET').select('*', { count: 'exact', head: true }); // MỚI

    if (searchTerm) {
      const searchFilter = `ma_kho.ilike.%${searchTerm}%,ma_nx.ilike.%${searchTerm}%,ma_vt.ilike.%${searchTerm}%,ten_vt.ilike.%${searchTerm}%,user.ilike.%${searchTerm}%`;
      query = query.or(searchFilter);
      countQuery = countQuery.or(searchFilter); // MỚI
    }
    
    // MỚI: Lấy count
    const { count, error: countError } = await countQuery;
    if (countError) throw countError;
    pagination.totalItems = count || 0;
    updatePaginationUI();
    
    // MỚI: Áp dụng range
    const from = (pagination.page - 1) * pagination.limit;
    const to = from + pagination.limit - 1;
    query = query.range(from, to);

    let { data, error } = await query.order('id');
    if (error) throw error;

    if (data.length === 0) {
      chitietTableBody.innerHTML = `<tr><td colspan="15" class="td-center">Chưa có dữ liệu.</td></tr>`;
      return;
    }

    chitietTableBody.innerHTML = data.map(item => `
      <tr id="chitiet-row-${item.id}" class="selectable-row hover:bg-gray-50" onclick="toggleRowSelection('chitiet', '${item.id}', event)">
        <td class="px-6 py-4"><input type="checkbox" class="row-checkbox" data-view="chitiet" data-id="${item.id}"></td>
        <td class="px-6 py-4 text-sm font-medium text-gray-900">${item.id}</td>
        <td class="px-6 py-4 text-sm text-gray-600">${item.ma_kho || ''}</td>
        <td class="px-6 py-4 text-sm text-gray-600">${item.ma_nx || ''}</td>
        <td class="px-6 py-4 text-sm text-gray-600">${item.ma_vt || ''}</td>
        <td class="px-6 py-4 text-sm text-gray-600">${item.ten_vt || ''}</td>
        <td class="px-6 py-4 text-sm text-gray-600">${item.lot || ''}</td>
        <td class="px-6 py-4 text-sm text-gray-600">${item.date || ''}</td>
        <td class="px-6 py-4 text-sm text-gray-600">${item.yeu_cau || ''}</td>
        <td class="px-6 py-4 text-sm text-gray-600">${item.so_luong || 0}</td>
        <td class="px-6 py-4 text-sm text-gray-600">${item.loai || ''}</td>
        <td class="px-6 py-4 text-sm text-gray-600">${item.user || ''}</td>
        <td class="px-6 py-4 text-sm text-gray-600">${item.muc_dich || ''}</td>
        <td class="px-6 py-4 text-sm text-gray-600">${item.nganh || ''}</td>
        <td class="px-6 py-4 text-sm text-gray-600">${item.phu_trach || ''}</td>
      </tr>
    `).join('');
    attachCheckboxListeners('chitiet');
  } catch (error) {
    console.error('Lỗi tải chi tiết:', error);
    chitietTableBody.innerHTML = `<tr><td colspan="15" class="td-center text-red-500">Lỗi: ${error.message}</td></tr>`;
  }
  
  // MỚI: Cập nhật thời gian đồng bộ sau khi tải dữ liệu
  updateLastSyncTime();
}

// (Không có editChitiet, createNewChitietRow, saveChitiet)

async function deleteChitiet(id) {
  // Nút xóa bị ẩn ở view này, nhưng logic vẫn tồn tại
  showConfirm(`Bạn có chắc muốn xóa chi tiết ID '${id}' không?`, async () => {
    try {
      const { error } = await supabase.from('CHITIET').delete().eq('id', id);
      if (error) throw error;
      loadChitiet();
    } catch (error) {
      console.error('Lỗi xóa chi tiết:', error);
      alert(`Lỗi: ${error.message}`);
    }
  });
}

// ===== MỚI: 10.5. Tải dữ liệu cho Bộ lọc =====

/**
 * MỚI: Hàm helper lấy dữ liệu unique cho một cột
 */
async function getUniqueColumnValues(columnName) {
  // 1. Lấy các bộ lọc *khác*
  const otherFilters = {};
  Object.keys(sanphamFilterState).forEach(key => {
    if (key !== columnName && sanphamFilterState[key].size > 0) {
      otherFilters[key] = Array.from(sanphamFilterState[key]);
    }
  });
  
  let query = supabase.from('SANPHAM').select(columnName);

  // 2. Áp dụng các bộ lọc khác
  Object.keys(otherFilters).forEach(key => {
    query = query.in(key, otherFilters[key]);
  });

  const { data, error } = await query;
  if (error) throw error;
  
  // 3. Lấy giá trị unique và sắp xếp
  return [...new Set(data.map(item => item[columnName]).filter(Boolean))].sort();
}


async function populateSanphamFilters() {
  console.log('Đang tải dữ liệu cho bộ lọc Sản phẩm...');
  try {
    // Tải dữ liệu cho TẤT CẢ các cột cùng lúc
    // Tải không phụ thuộc trước
    const [maVts, tenVts, nganhs, phuTrachs] = await Promise.all([
      getUniqueColumnValues('ma_vt'),
      getUniqueColumnValues('ten_vt'),
      getUniqueColumnValues('nganh'),
      getUniqueColumnValues('phu_trach')
    ]);

    // Lấy DOM của các bộ lọc
    const filters = {
      ma_vt: document.querySelector('.custom-filter[data-filter-column="ma_vt"]'),
      ten_vt: document.querySelector('.custom-filter[data-filter-column="ten_vt"]'),
      nganh: document.querySelector('.custom-filter[data-filter-column="nganh"]'),
      phu_trach: document.querySelector('.custom-filter[data-filter-column="phu_trach"]')
    };

    // Populate từng bộ lọc
    populateCustomFilterList(filters.ma_vt, maVts, 'ma_vt');
    populateCustomFilterList(filters.ten_vt, tenVts, 'ten_vt');
    populateCustomFilterList(filters.nganh, nganhs, 'nganh');
    populateCustomFilterList(filters.phu_trach, phuTrachs, 'phu_trach');

    // Đánh dấu là đã tải
    sanphamFiltersPopulated = true;
    console.log('Đã tải xong bộ lọc Sản phẩm.');
  } catch (error) {
    console.error('Lỗi khi tải bộ lọc:', error.message);
  }
}

/**
 * MỚI: Cập nhật danh sách cho một bộ lọc custom
 */
function populateCustomFilterList(filterElement, items, column) {
  const listElement = filterElement.querySelector('.custom-filter-list');
  const selectedValues = sanphamFilterState[column];
  
  const html = `
    <div class="custom-filter-item">
      <input type="checkbox" class="custom-filter-select-all" data-column="${column}">
      <label class="font-bold">(Chọn tất cả)</label>
    </div>
    ${items.map(item => {
      const isChecked = selectedValues.has(item);
      return `
        <div class="custom-filter-item">
          <input type="checkbox" class="custom-filter-checkbox" value="${item}" data-column="${column}" ${isChecked ? 'checked' : ''}>
          <label>${item}</label>
        </div>
      `;
    }).join('')}
  `;
  listElement.innerHTML = html;
}

/**
 * MỚI: Cập nhật text hiển thị của nút filter
 */
function updateCustomFilterText(column, filterElement) {
  if (!filterElement) {
     filterElement = document.querySelector(`.custom-filter[data-filter-column="${column}"]`);
  }
  if (!filterElement) return; // Thoát nếu không tìm thấy

  const textElement = filterElement.querySelector('.custom-filter-text');
  const selectedCount = sanphamFilterState[column].size;
  
  const defaultTexts = {
    'ma_vt': 'Tất cả Mã VT',
    'ten_vt': 'Tất cả Tên VT',
    'nganh': 'Tất cả Ngành',
    'phu_trach': 'Tất cả Phụ trách'
  };

  if (selectedCount === 0) {
    textElement.textContent = defaultTexts[column] || `Tất cả ${column}`;
  } else if (selectedCount === 1) {
    textElement.textContent = sanphamFilterState[column].values().next().value;
  } else {
    textElement.textContent = `${selectedCount} mục đã chọn`;
  }
}

/**
 * MỚI: Hàm cập nhật các bộ lọc phụ thuộc
 */
async function updateDependentFilters(changedColumn) {
  console.log(`Cập nhật bộ lọc phụ thuộc, thay đổi từ: ${changedColumn}`);
  
  // Tải lại tất cả các bộ lọc *ngoại trừ* bộ lọc vừa thay đổi
  const filterUpdates = [];
  const filters = document.querySelectorAll('#filter-sanpham .custom-filter');

  filters.forEach(filter => {
    const column = filter.dataset.filterColumn;
    if (column !== changedColumn) {
      filterUpdates.push(
        getUniqueColumnValues(column).then(items => {
          populateCustomFilterList(filter, items, column);
        })
      );
    }
  });

  try {
    await Promise.all(filterUpdates);
    console.log('Cập nhật xong bộ lọc phụ thuộc.');
  } catch (error) {
    console.error('Lỗi cập nhật bộ lọc phụ thuộc:', error);
  }
} 


// ===== 11. HÀM HELPER MỚI CHO INLINE EDIT VÀ SYNC =====

/**
 * MỚI: Đồng bộ dữ liệu ngầm (Silent Sync)
 */
function handleSync() {
    if (currentEditState.mode) {
        console.log('Không đồng bộ khi đang chỉnh sửa.');
        return;
    }

    console.log(`Bắt đầu đồng bộ ngầm cho view: ${currentView}`);
    // Logic đồng bộ ngầm: Tải lại dữ liệu hiện tại
    loadDataForCurrentView(); 
    
    // Cập nhật thời gian đồng bộ sẽ được gọi từ loadDataForCurrentView()
    // để đảm bảo thời gian hiển thị chính xác sau khi fetch hoàn tất.
    // updateLastSyncTime(); 
}

/**
 * MỚI: Cập nhật hiển thị thời gian đồng bộ gần nhất
 */
function updateLastSyncTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('vi-VN', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
    });
    const dateString = now.toLocaleDateString('vi-VN');
    lastSyncTimeSpan.textContent = `Đồng bộ gần nhất: ${dateString} ${timeString}`;
}

/**
 * MỚI: Thay đổi kích thước chữ (Scaling App)
 */
function handleFontSizeChange() {
    const percentage = parseInt(fontSizeSelect.value, 10);
    // Thay đổi font size gốc của HTML để scale toàn bộ ứng dụng (dựa trên rem/em)
    // Đây là cách chuẩn để thay đổi kích thước chữ toàn bộ mà không làm hỏng layout
    document.documentElement.style.fontSize = `${percentage}%`; 
}

/**
 * Hiển thị/ẩn các nút điều khiển khi chỉnh sửa nội tuyến
 */
function showInlineEditControls() {
  toolbar.save.hidden = false;
  toolbar.cancel.hidden = false;

  toolbar.add.disabled = true;
  toolbar.edit.disabled = true;
  toolbar.delete.disabled = true;
  toolbar.excel.disabled = true;
  toolbar.search.disabled = true;
  toolbar.clearFilter.disabled = true;
  toolbar.sync.disabled = true; // MỚI: Vô hiệu hóa Sync khi đang edit

  // Vô hiệu hóa các tab
  navLinks.forEach(link => link.style.pointerEvents = 'none');
}

function hideInlineEditControls() {
  toolbar.save.hidden = true;
  toolbar.cancel.hidden = true;

  toolbar.add.disabled = false;
  // Kích hoạt lại nút dựa trên trạng thái selection
  toolbar.edit.disabled = !selectedItem.id;
  toolbar.delete.disabled = !selectedItem.id;

  toolbar.excel.disabled = false;
  toolbar.search.disabled = false;
  toolbar.clearFilter.disabled = false;
  toolbar.sync.disabled = false; // MỚI: Kích hoạt lại Sync

  // Kích hoạt lại các tab
  navLinks.forEach(link => link.style.pointerEvents = 'auto');

  // Reset trạng thái
  currentEditState = { view: null, id: null, mode: null };
}

/**
 * Nút Lưu (Save) chung
 */
async function handleToolbarSave() {
  const { view, id, mode } = currentEditState;
  if (!view) return;

  const editRows = document.querySelectorAll('tr[data-editing="true"]');
  if (editRows.length === 0) {
    hideInlineEditControls();
    return;
  }

  try {
    for (const editRow of editRows) {
      // Thu thập dữ liệu từ form
      const inputs = editRow.querySelectorAll('input, textarea, select');

      // === SỬA LỖI LOGIC ===
      const data = {}; // 1. Khởi tạo data cho hàng này
      inputs.forEach(input => { // 2. Lặp qua từng input
        const name = input.name;
        if (name) {
          data[name] = (input.type === 'checkbox') ? input.checked : input.value;
        }
      }); // 3. Kết thúc vòng lặp
      // === KẾT THÚC SỬA LỖI ===

      // Lấy id từ hàng (quan trọng cho mode 'edit')
      const rowId = editRow.id.split('-row-')[1];

      // *** THÊM LẠI LOGIC SAVE BỊ MẤT ***
      // Nếu mode 'edit', id là rowId. Nếu 'add', id là null.
      const saveId = (mode === 'edit') ? rowId : null;

      switch (view) {
        case 'sanpham': await saveSanpham(data, mode, saveId); break;
        case 'tonkho': await saveTonkho(data, mode, saveId); break;
        case 'donhang': await saveDonhang(data, mode, saveId); break;
      }
      // *** KẾT THÚC THÊM LẠI LOGIC SAVE ***
    }

    // === SỬA LỖI SYNTAX ===
    // Di chuyển 2 dòng này vào trong 'try' block
    hideInlineEditControls();
    loadDataForCurrentView(); // Tải lại dữ liệu
    // === KẾT THÚC SỬA LỖI SYNTAX ===

  } catch (error) {
    console.error('Lỗi lưu dữ liệu:', error);
    alert(`Lỗi: ${error.message}`);
  }
}

/**
 * Nút Hủy (Cancel) chung
 */
function handleToolbarCancel() {
  const mode = currentEditState.mode; // Lấy mode trước khi reset
  hideInlineEditControls(); // Reset state về null

  if (mode === 'edit') {
    loadDataForCurrentView(); // Tải lại để hủy thay đổi (khôi phục hàng cũ)
  } else if (mode === 'add') {
    // Chỉ xóa các hàng mới đã được thêm
    document.querySelectorAll('tr[data-editing="true"]').forEach(row => row.remove());
  }
}

/**
 * Tạo HTML cho các ô (TD) có thể chỉnh sửa
 */
function createEditableRowContents(view, data = {}, isEdit = false) {
  // Hàm trợ giúp
  const val = (key) => data[key] || '';
  const num = (key) => data[key] || 0;
  const date = (key) => (data[key] ? data[key].slice(0, 10) : '');
  const check = (key) => (data[key] ? 'checked' : '');
  const ro = isEdit ? 'readonly class="inline-input bg-gray-200"' : 'class="inline-input"'; // Readonly cho PK

  switch (view) {
    case 'sanpham':
      return `
                <td class="td px-6 py-2"><input type="checkbox" class="row-checkbox" disabled></td>
                <td class="td px-6 py-2"><input type="text" name="ma_vt" value="${val('ma_vt')}" ${ro} required></td>
                <td class="td px-6 py-2"><input type="text" name="ten_vt" value="${val('ten_vt')}" class="inline-input" required></td>
                <td class="td px-6 py-2"><input type="text" name="nganh" value="${val('nganh')}" class="inline-input"></td>
                <td class="td px-6 py-2"><input type="text" name="phu_trach" value="${val('phu_trach')}" class="inline-input"></td>
            `;
    case 'tonkho':
      return `
                <td class="td px-6 py-2"><input type="checkbox" class="row-checkbox" disabled></td>
                <td class="td px-6 py-2"><input type="text" name="ma_vach" value="${val('ma_vach')}" ${ro} required></td>
                <td class="td px-6 py-2"><input type="text" name="ma_vt" value="${val('ma_vt')}" class="inline-input"></td>
                <td class="td px-6 py-2"><input type="text" name="ten_vt" value="${val('ten_vt')}" class="inline-input"></td>
                <td class="td px-6 py-2"><input type="text" name="lot" value="${val('lot')}" class="inline-input"></td>
                <td class="td px-6 py-2"><input type="date" name="date" value="${date('date')}" class="inline-input"></td>
                <td class="td px-6 py-2"><input type="number" name="ton_dau" value="${num('ton_dau')}" class="inline-input"></td>
                <td class="td px-6 py-2"><input type="number" name="nhap" value="${num('nhap')}" class="inline-input"></td>
                <td class="td px-6 py-2"><input type="number" name="xuat" value="${num('xuat')}" class="inline-input"></td>
                <td class="td px-6 py-2"></td> <!-- Tồn cuối (tính toán) -->
                <td class="td px-6 py-2"><input type="text" name="tinh_trang" value="${val('tinh_trang')}" class="inline-input"></td>
                <td class="td px-6 py-2"><input type="text" name="tray" value="${val('tray')}" class="inline-input"></td>
                <td class="td px-6 py-2"><input type="text" name="nganh" value="${val('nganh')}" class="inline-input"></td>
                <td class="td px-6 py-2"><input type="text" name="phu_trach" value="${val('phu_trach')}" class="inline-input"></td>
            `;
    case 'donhang':
      return `
                <td class="td px-6 py-2"><input type="checkbox" class="row-checkbox" disabled></td>
                <td class="td px-6 py-2"><input type="text" name="ma_kho" value="${val('ma_kho')}" class="inline-input"></td>
                <td class="td px-6 py-2"><input type="date" name="thoi_gian" value="${date('thoi_gian')}" class="inline-input"></td>
                <td class="td px-6 py-2"><input type="text" name="ma_nx" value="${val('ma_nx')}" ${ro} required></td>
                <td class="td px-6 py-2"><input type="text" name="user" value="${val('user')}" class="inline-input"></td>
                <td class="td px-6 py-2"><input type="text" name="nganh" value="${val('nganh')}" class="inline-input"></td>
                <td class="td px-6 py-2"><input type="text" name="muc_dich" value="${val('muc_dich')}" class="inline-input"></td>
                <td class="td px-6 py-2"><input type="text" name="dia_chi" value="${val('dia_chi')}" class="inline-input"></td>
                <td classD="td px-6 py-2"><input type="text" name="ghi_chu" value="${val('ghi_chu')}" class="inline-input"></td>
                <td class="td px-6 py-2"><input type="text" name="order" value="${val('order')}" class="inline-input"></td>
                <td class="td px-6 py-2"><input type="text" name="pkl" value="${val('pkl')}" class="inline-input"></td>
                <td class="td px-6 py-2"><input type="checkbox" name="done" ${check('done')} class="h-4 w-4"></td>
                <td class="td px-6 py-2"><input type="text" name="image" value="${val('image')}" class="inline-input"></td>
            `;
    default: return '';
  }
} 

// ===== 12. Khởi chạy =====
window.addEventListener('DOMContentLoaded', () => {
  // Xóa các listener form cũ

  // MỚI: Gắn listener cho các tab điều hướng (thay vì onclick)
  document.querySelectorAll('a[data-view-target]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault(); // Ngăn hành vi mặc định của thẻ <a>
      showView(link.dataset.viewTarget);
    });
  });

  // Gắn listener cho toolbar
  toolbar.add.addEventListener('click', handleToolbarAdd);
  toolbar.edit.addEventListener('click', handleToolbarEdit);
  toolbar.delete.addEventListener('click', handleToolbarDelete);
  toolbar.search.addEventListener('input', handleToolbarSearch);
  toolbar.clearFilter.addEventListener('click', handleToolbarClearFilter);

  // Listener MỚI
  toolbar.save.addEventListener('click', handleToolbarSave);
  toolbar.cancel.addEventListener('click', handleToolbarCancel);
  toolbar.sync.addEventListener('click', handleSync); // MỚI: Listener Đồng bộ

  // Listener Bộ Lọc (MỚI)
  toolbarToggleFilter.addEventListener('click', () => {
    const isHidden = filterPanel.classList.toggle('hidden');
    toolbarToggleFilterText.textContent = isHidden ? 'Hiện bộ lọc' : 'Ẩn bộ lọc';
  });

  // MỚI: Gắn listener cho BỘ LỌC CUSTOM
  customFilters = document.querySelectorAll('#filter-sanpham .custom-filter');
  
  customFilters.forEach(filter => {
    const toggle = filter.querySelector('.custom-filter-toggle');
    const panel = filter.querySelector('.custom-filter-panel');
    const search = filter.querySelector('.custom-filter-search');
    const list = filter.querySelector('.custom-filter-list');
    const column = filter.dataset.filterColumn;

    // 1. Mở/đóng panel
    toggle.addEventListener('click', () => {
      // Đóng tất cả các panel khác
      customFilters.forEach(otherFilter => {
        if (otherFilter !== filter) {
          otherFilter.querySelector('.custom-filter-panel').classList.add('hidden');
        }
      });
      // Mở/đóng panel hiện tại
      panel.classList.toggle('hidden');
    });

    // 2. Tìm kiếm trong panel
    search.addEventListener('input', () => {
      const searchTerm = search.value.toLowerCase();
      list.querySelectorAll('.custom-filter-item').forEach(item => {
        const label = item.querySelector('label')?.textContent.toLowerCase();
        if (label) {
          // Ẩn/hiện item (bỏ qua 'Chọn tất cả')
          if (label === '(chọn tất cả)') {
            item.style.display = 'flex';
          } else {
            item.style.display = label.includes(searchTerm) ? 'flex' : 'none';
          }
        }
      });
    });

    // MỚI: Áp dụng bằng Enter khi đang ở ô tìm kiếm
    search.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault(); // Ngăn hành vi mặc định
        // MỚI: Tìm nút Áp dụng TRONG CÙNG PANEL
        const applyButton = filter.querySelector('.custom-filter-apply');
        if (applyButton) {
          applyButton.click();
        }
      }
    });

    // 3. Xử lý checkbox (dùng event delegation)
    list.addEventListener('change', async (e) => {
      if (!e.target.matches('input[type="checkbox"]')) return;

      const checkbox = e.target;

      if (checkbox.classList.contains('custom-filter-select-all')) {
        // Checkbox "Chọn tất cả"
        const isChecked = checkbox.checked;
        list.querySelectorAll('.custom-filter-checkbox').forEach(cb => {
          // Chỉ chọn các mục đang hiển thị (phù hợp với tìm kiếm)
          if (cb.closest('.custom-filter-item').style.display !== 'none') {
            cb.checked = isChecked;
            if (isChecked) {
              sanphamFilterState[column].add(cb.value);
            } else {
              sanphamFilterState[column].delete(cb.value);
            }
          }
        });
      } else {
        // Checkbox item
        if (checkbox.checked) {
          sanphamFilterState[column].add(checkbox.value);
        } else {
          sanphamFilterState[column].delete(checkbox.value);
        }
        // Cập nhật "Chọn tất cả"
        const allCheckboxes = list.querySelectorAll('.custom-filter-checkbox');
        const checkedCheckboxes = list.querySelectorAll('.custom-filter-checkbox:checked');
        const selectAllCheckbox = list.querySelector('.custom-filter-select-all');
        
        if (selectAllCheckbox) { // Thêm kiểm tra null
            selectAllCheckbox.checked = allCheckboxes.length > 0 && allCheckboxes.length === checkedCheckboxes.length;
        }
      }

      // Cập nhật text nút
      updateCustomFilterText(column, filter);
    });

    // MỚI: Xử lý click vào HÀNG (item) để toggle checkbox
    list.addEventListener('click', (e) => {
      const item = e.target.closest('.custom-filter-item');
      if (!item) return; // Không click vào item

      // Nếu click vào checkbox hoặc label, để trình duyệt tự xử lý
      if (e.target.matches('input[type="checkbox"]') || e.target.matches('label')) {
        return;
      }

      // Click vào vùng đệm của .custom-filter-item
      const checkbox = item.querySelector('input[type="checkbox"]');
      if (checkbox) {
        checkbox.checked = !checkbox.checked;
        // Phải tự kích hoạt sự kiện change
        checkbox.dispatchEvent(new Event('change', { bubbles: true })); 
      }
    });

    // MỚI: Gắn listener cho nút Áp Dụng (bên trong mỗi panel)
    const applyButton = filter.querySelector('.custom-filter-apply');
    if (applyButton) {
      applyButton.addEventListener('click', async () => {
        // 1. Đóng tất cả panel custom
        customFilters.forEach(f => {
          f.querySelector('.custom-filter-panel').classList.add('hidden');
        });
        // 2. Đóng panel filter chính
        filterPanel.classList.add('hidden');
        toolbarToggleFilterText.textContent = 'Hiện bộ lọc';

        // 3. Reset phân trang
        pagination.page = 1;
        paginationControls.pageInput.value = 1;

        // 4. Tải lại dữ liệu (với state đã chọn)
        loadDataForCurrentView();

        // 5. Cập nhật các bộ lọc phụ thuộc (dựa trên state MỚI)
        await populateSanphamFilters();
      });
    }
  });

  // MỚI: Đóng filter khi click ra ngoài
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.custom-filter')) {
      customFilters.forEach(filter => {
        filter.querySelector('.custom-filter-panel').classList.add('hidden');
      });
    }
  });


  // MỚI: Listener cho phím Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && currentEditState.mode) {
      handleToolbarCancel();
    }
  });

  // MỚI: Listener cho Cỡ chữ
  fontSizeSelect.addEventListener('change', handleFontSizeChange);

  // MỚI: Thiết lập Đồng bộ tự động mỗi 30s
  const AUTO_SYNC_INTERVAL = 30000;
  setInterval(handleSync, AUTO_SYNC_INTERVAL);
  console.log(`Đồng bộ tự động đã được kích hoạt mỗi ${AUTO_SYNC_INTERVAL / 1000} giây.`);

  // MỚI: Listener cho Phân trang
  paginationControls.limitSelect.addEventListener('change', () => {
    // Khi đổi limit, reset về trang 1
    pagination.page = 1;
    paginationControls.pageInput.value = 1;
    pagination.limit = parseInt(paginationControls.limitSelect.value, 10);
    loadDataForCurrentView();
  });
  paginationControls.pageInput.addEventListener('change', () => {
    let newPage = parseInt(paginationControls.pageInput.value, 10);
    if (isNaN(newPage) || newPage < 1) {
      newPage = 1;
    } else if (newPage > pagination.totalPages) {
      newPage = pagination.totalPages;
    }
    pagination.page = newPage;
    paginationControls.pageInput.value = newPage;
    loadDataForCurrentView();
  });
   paginationControls.pageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        paginationControls.pageInput.blur(); // Trigger sự kiện 'change'
      }
    });
  paginationControls.prevButton.addEventListener('click', () => {
    if (pagination.page > 1) {
      pagination.page--;
      paginationControls.pageInput.value = pagination.page;
      loadDataForCurrentView();
    }
  });
  paginationControls.nextButton.addEventListener('click', () => {
    if (pagination.page < pagination.totalPages) {
      pagination.page++;
      paginationControls.pageInput.value = pagination.page;
      loadDataForCurrentView();
    }
  });

  // MỚI: Listener cho sự kiện Dán (Paste)
  document.addEventListener('paste', handlePaste);

  toolbar.excel.addEventListener('click', () => {
    if (currentEditState.mode) return;
    console.log(`Yêu cầu tải Excel cho view: ${currentView}.`);
    showConfirm(`Chức năng 'Tải Excel' cho '${currentView}' đang được phát triển.`, () => { }, true);
  });

  // Hiển thị view mặc định
  showView('sanpham');
  // Thiết lập cỡ chữ ban đầu (100% là mặc định)
  handleFontSizeChange();
});

/**
 * MỚI: Xử lý dán (Paste)
 */
function handlePaste(e) {
  // Chỉ hoạt động ở view 'sanpham' và 'tonkho'
  if (currentView !== 'sanpham' && currentView !== 'tonkho') return;
  // Chỉ hoạt động ở chế độ 'add'
  if (currentEditState.mode !== 'add') return;
  // Chỉ hoạt động nếu dán vào input
  const targetElement = e.target;
  if (!targetElement.classList.contains('inline-input') || targetElement.readOnly) return;

  e.preventDefault();

  const clipboardData = (e.clipboardData || window.clipboardData).getData('text/plain');
  const pastedRows = clipboardData.trim().split('\n').map(r => r.split('\t'));

  if (pastedRows.length === 0) return;

  const startInput = targetElement;
  const startRow = startInput.closest('tr');
  const startCellIndex = startInput.closest('td').cellIndex;

  let allEditRows = Array.from(document.querySelectorAll(`#${currentView}-table-body tr[data-editing="true"]`));
  let startRowIndex = allEditRows.indexOf(startRow);

  if (startRowIndex === -1) return; // Không tìm thấy hàng

  pastedRows.forEach((rowData, r_idx) => {
    const targetRowIndex = startRowIndex + r_idx;
    let targetRow = allEditRows[targetRowIndex];

    // Nếu thiếu hàng, tạo hàng mới
    if (!targetRow) {
      if (currentView === 'sanpham') {
        targetRow = createNewSanphamRow();
      } else if (currentView === 'tonkho') {
        targetRow = createNewTonkhoRow();
      }
      allEditRows.push(targetRow); // Thêm vào mảng để vòng lặp sau tìm thấy
    }

    const targetInputs = targetRow.querySelectorAll('td .inline-input'); // Lấy input trong td

    rowData.forEach((cellData, c_idx) => {
      // cellIndex 0 là checkbox, nên input index = cellIndex - 1
      const targetInputIndex = (startCellIndex - 1) + c_idx;

      if (targetInputs[targetInputIndex] && !targetInputs[targetInputIndex].readOnly) {
        targetInputs[targetInputIndex].value = cellData.trim();
      }
    });
  });
}
