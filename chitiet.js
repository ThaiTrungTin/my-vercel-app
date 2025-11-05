import { sb, cache, viewStates, showLoading, showToast, debounce, renderPagination, filterButtonDefaultTexts } from './app.js';
import { openDonHangModal } from './don-hang.js';

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

async function updateChiTietHeaderCounts() {
    const state = viewStates['view-chi-tiet'];
    const nhapEl = document.getElementById('chi-tiet-header-nhap-count');
    const xuatEl = document.getElementById('chi-tiet-header-xuat-count');

    if (!nhapEl || !xuatEl) return;
    [nhapEl, xuatEl].forEach(el => el.textContent = '(...)');

    try {
        const { data, error } = await sb.rpc('get_chi_tiet_summary', {
            _search_term: state.searchTerm || '',
            _from_date: state.filters.from_date || null,
            _to_date: state.filters.to_date || null,
            _ma_kho_filter: state.filters.ma_kho || [],
            _ma_nx_filter: state.filters.ma_nx || [],
            _ma_vt_filter: state.filters.ma_vt || [],
            _lot_filter: state.filters.lot || [],
            _nganh_filter: state.filters.nganh || [],
            _phu_trach_filter: state.filters.phu_trach || [],
        });

        if (error) {
            showToast("Lỗi: Cần tạo hàm 'get_chi_tiet_summary' trên Supabase.", 'error');
            throw error;
        }

        if (data && data.length > 0) {
            const totals = data[0];
            nhapEl.textContent = `(${(totals.total_nhap || 0).toLocaleString()})`;
            xuatEl.textContent = `(${(totals.total_xuat || 0).toLocaleString()})`;
        } else {
            [nhapEl, xuatEl].forEach(el => el.textContent = '(0)');
        }
    } catch (err) {
        console.error("Error fetching chi tiet summary:", err);
        [nhapEl, xuatEl].forEach(el => el.textContent = '(lỗi)');
    }
}

function buildChiTietQuery() {
    const state = viewStates['view-chi-tiet'];
    let query = sb.from('chi_tiet').select('*', { count: 'exact' });

    if (state.searchTerm) {
        const st = `%${state.searchTerm}%`;
        query = query.or(`ma_kho.ilike.${st},ma_nx.ilike.${st},ma_vach.ilike.${st},ma_vt.ilike.${st},ten_vt.ilike.${st},lot.ilike.${st},loai.ilike.${st},yeu_cau.ilike.${st},muc_dich.ilike.${st},nganh.ilike.${st},phu_trach.ilike.${st}`);
    }
    if (state.filters.from_date) query = query.gte('thoi_gian', state.filters.from_date);
    if (state.filters.to_date) query = query.lte('thoi_gian', state.filters.to_date);
    if (state.filters.ma_kho?.length > 0) query = query.in('ma_kho', state.filters.ma_kho);
    if (state.filters.ma_nx?.length > 0) query = query.in('ma_nx', state.filters.ma_nx);
    if (state.filters.ma_vt?.length > 0) query = query.in('ma_vt', state.filters.ma_vt);
    if (state.filters.lot?.length > 0) query = query.in('lot', state.filters.lot);
    if (state.filters.nganh?.length > 0) query = query.in('nganh', state.filters.nganh);
    if (state.filters.phu_trach?.length > 0) query = query.in('phu_trach', state.filters.phu_trach);
    
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

        const query = buildChiTietQuery().order('thoi_gian', { ascending: false }).range(from, to);
        
        const [queryResult, _] = await Promise.all([query, updateChiTietHeaderCounts()]);
        const { data, error, count } = queryResult;

        if (error) {
            showToast("Không thể tải dữ liệu chi tiết.", 'error');
            console.error(error);
        } else {
            state.totalFilteredCount = count;
            cache.chiTietList = data;
            
            renderChiTietTable(data);
            renderPagination('chi-tiet', count, from, to);
        }
    } finally {
        if (showLoader) showLoading(false);
    }
}

function renderChiTietTable(data) {
    const tableBody = document.getElementById('chi-tiet-table-body');
    if (!tableBody) return;

    if (data && data.length > 0) {
        tableBody.innerHTML = data.map(item => `
            <tr data-ma-kho="${item.ma_kho}" data-ma-vt="${item.ma_vt}" class="hover:bg-gray-50">
                <td class="px-1 py-2 border border-gray-300 text-center">${formatDate(item.thoi_gian)}</td>
                <td class="px-1 py-2 border border-gray-300 text-center"><span class="text-blue-600 hover:underline cursor-pointer ma-kho-link">${item.ma_kho || ''}</span></td>
                <td class="px-1 py-2 border border-gray-300 text-center">${item.ma_nx || ''}</td>
                <td class="px-1 py-2 border border-gray-300 text-center">${item.ma_vach || ''}</td>
                <td class="px-1 py-2 border border-gray-300 text-center"><span class="text-blue-600 hover:underline cursor-pointer ma-vt-link">${item.ma_vt || ''}</span></td>
                <td class="px-1 py-2 border border-gray-300 text-left break-words">${item.ten_vt || ''}</td>
                <td class="px-1 py-2 border border-gray-300 text-center">${item.lot || ''}</td>
                <td class="px-1 py-2 border border-gray-300 text-center">${item.date || ''}</td>
                <td class="px-1 py-2 border border-gray-300 text-center font-bold">${item.yc_sl || ''}</td>
                <td class="px-1 py-2 border border-gray-300 text-center text-green-600 font-semibold">${item.nhap > 0 ? item.nhap : ''}</td>
                <td class="px-1 py-2 border border-gray-300 text-center text-red-600 font-semibold">${item.xuat > 0 ? item.xuat : ''}</td>
                <td class="px-1 py-2 border border-gray-300 text-center">${item.loai || ''}</td>
                <td class="px-1 py-2 border border-gray-300 text-center">${item.yeu_cau || ''}</td>
                <td class="px-1 py-2 border border-gray-300 text-left break-words">${item.muc_dich || ''}</td>
                <td class="px-1 py-2 border border-gray-300 text-center">${item.nganh || ''}</td>
                <td class="px-1 py-2 border border-gray-300 text-center">${item.phu_trach || ''}</td>
            </tr>
        `).join('');
    } else {
        tableBody.innerHTML = '<tr><td colspan="16" class="text-center py-4">Không có dữ liệu</td></tr>';
    }
}

async function openChiTietFilterPopover(button, view) {
    const filterKey = button.dataset.filterKey;
    const state = viewStates[view];

    const popover = document.getElementById('filter-popover-template').cloneNode(true);
    popover.id = '';
    popover.classList.remove('hidden');
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

    optionsList.innerHTML = '<div class="text-center p-4 text-sm text-gray-500">Đang tải...</div>';
    applyBtn.disabled = true;
    try {
        const { data: rpcData, error } = await sb.rpc('get_chi_tiet_filter_options', {
            filter_key: filterKey,
            _search_term: state.searchTerm || '',
            _from_date: state.filters.from_date || null,
            _to_date: state.filters.to_date || null,
            _ma_kho_filter: state.filters.ma_kho || [],
            _ma_nx_filter: state.filters.ma_nx || [],
            _ma_vt_filter: state.filters.ma_vt || [],
            _lot_filter: state.filters.lot || [],
            _nganh_filter: state.filters.nganh || [],
            _phu_trach_filter: state.filters.phu_trach || [],
        });
        if (error) {
             showToast("Lỗi: Cần tạo hàm 'get_chi_tiet_filter_options' trên Supabase.", 'error');
             throw error;
        }
        
        const uniqueOptions = rpcData;
        renderOptions(uniqueOptions);
        searchInput.addEventListener('input', () => renderOptions(uniqueOptions));
        applyBtn.disabled = false;
    } catch (error) {
        console.error("Filter error:", error);
        optionsList.innerHTML = '<div class="text-center p-4 text-sm text-red-500">Lỗi tải dữ liệu.</div>';
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
        
        fetchChiTiet(1);
        
        popover.remove();
        document.removeEventListener('click', closePopover);
    };

    setTimeout(() => document.addEventListener('click', closePopover), 0);
}

async function handleChiTietExcelExport() {
    const modal = document.getElementById('excel-export-modal');
    modal.classList.remove('hidden');

    const exportAndClose = async (exportAll) => {
        modal.classList.add('hidden');
        showLoading(true);
        try {
            const query = exportAll ? sb.from('chi_tiet').select('*') : buildChiTietQuery().select('*');
            const { data, error } = await query.order('thoi_gian', { ascending: false }).limit(50000);
            
            if (error) throw error;
            if (!data || data.length === 0) {
                showToast("Không có dữ liệu để xuất.", 'info');
                return;
            }

            const worksheet = XLSX.utils.json_to_sheet(data);
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
    document.getElementById('excel-export-filtered-btn').onclick = () => exportAndClose(false);
    document.getElementById('excel-export-all-btn').onclick = () => exportAndClose(true);
    document.getElementById('excel-export-cancel-btn').onclick = () => modal.classList.add('hidden');
}


export function initChiTietView() {
    const viewContainer = document.getElementById('view-chi-tiet');
    const triggerFetch = debounce(() => fetchChiTiet(1), 500);

    document.getElementById('chi-tiet-search').addEventListener('input', e => {
        viewStates['view-chi-tiet'].searchTerm = e.target.value;
        triggerFetch();
    });

    document.getElementById('chi-tiet-filter-from-date').addEventListener('change', e => {
        viewStates['view-chi-tiet'].filters.from_date = e.target.value;
        fetchChiTiet(1);
    });
    document.getElementById('chi-tiet-filter-to-date').addEventListener('change', e => {
        viewStates['view-chi-tiet'].filters.to_date = e.target.value;
        fetchChiTiet(1);
    });

    viewContainer.addEventListener('click', e => {
        const btn = e.target.closest('.filter-btn');
        if (btn) openChiTietFilterPopover(btn, 'view-chi-tiet');
    });

    document.getElementById('chi-tiet-reset-filters').addEventListener('click', () => {
        const state = viewStates['view-chi-tiet'];
        document.getElementById('chi-tiet-search').value = '';
        document.getElementById('chi-tiet-filter-from-date').value = '';
        document.getElementById('chi-tiet-filter-to-date').value = '';
        state.searchTerm = '';
        state.filters = { from_date: '', to_date: '', ma_kho: [], ma_nx: [], ma_vt: [], lot: [], nganh: [], phu_trach: [] };
        viewContainer.querySelectorAll('#view-chi-tiet .filter-btn').forEach(btn => {
            btn.textContent = filterButtonDefaultTexts[btn.id];
        });
        fetchChiTiet(1);
    });
    
    document.getElementById('chi-tiet-btn-excel').addEventListener('click', handleChiTietExcelExport);

    document.getElementById('chi-tiet-table-body').addEventListener('click', async (e) => {
        const maKhoLink = e.target.closest('.ma-kho-link');
        const maVtLink = e.target.closest('.ma-vt-link');
        
        if (maKhoLink) {
            const maKho = maKhoLink.closest('tr').dataset.maKho;
            if (!maKho) return;
            
            showLoading(true);
            try {
                const { data, error } = await sb.from('don_hang').select('*').eq('ma_kho', maKho).single();
                if (error) throw error;
                if (data) {
                    openDonHangModal(data, 'view');
                } else {
                    showToast('Không tìm thấy đơn hàng tương ứng.', 'error');
                }
            } catch (err) {
                showToast(`Lỗi khi tải chi tiết đơn hàng: ${err.message}`, 'error');
            } finally {
                showLoading(false);
            }
        } else if (maVtLink) {
            const maVt = maVtLink.closest('tr').dataset.maVt;
            if (!maVt) return;

            // 1. Reset all other filters for ton-kho view
            const tonKhoState = viewStates['view-ton-kho'];
            tonKhoState.searchTerm = '';
            document.getElementById('ton-kho-search').value = ''; 
            tonKhoState.filters = { ma_vt: [], lot: [], date: [], ton_cuoi: [], tinh_trang: [], nganh: [], phu_trach: [] };

            document.querySelectorAll('#view-ton-kho .filter-btn').forEach(btn => {
                btn.textContent = filterButtonDefaultTexts[btn.id];
            });

            // 2. Apply the new filter
            tonKhoState.filters.ma_vt = [maVt];

            // 3. Update the specific button text
            const maVtBtn = document.getElementById('ton-kho-filter-ma-vt-btn');
            if (maVtBtn) {
                maVtBtn.textContent = `${filterButtonDefaultTexts[maVtBtn.id]} (1)`;
            }

            // 4. Switch view by simulating click on sidebar button
            document.querySelector('.nav-button[data-view="view-ton-kho"]').click();
        }
    });

    // Pagination
    document.getElementById('chi-tiet-items-per-page').addEventListener('change', (e) => {
        viewStates['view-chi-tiet'].itemsPerPage = parseInt(e.target.value, 10);
        fetchChiTiet(1);
    });
    document.getElementById('chi-tiet-prev-page').addEventListener('click', () => fetchChiTiet(viewStates['view-chi-tiet'].currentPage - 1));
    document.getElementById('chi-tiet-next-page').addEventListener('click', () => fetchChiTiet(viewStates['view-chi-tiet'].currentPage + 1));
    const pageInput = document.getElementById('chi-tiet-page-input');
    const handlePageJump = () => {
        const state = viewStates['view-chi-tiet'];
        const totalPages = Math.ceil(state.totalFilteredCount / state.itemsPerPage) || 1;
        let targetPage = parseInt(pageInput.value, 10);
        if (isNaN(targetPage) || targetPage < 1) targetPage = 1;
        else if (targetPage > totalPages) targetPage = totalPages;
        pageInput.value = targetPage;
        if (targetPage !== state.currentPage) fetchChiTiet(targetPage);
    };
    pageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handlePageJump();
            e.target.blur();
        }
    });
    pageInput.addEventListener('change', handlePageJump);
}