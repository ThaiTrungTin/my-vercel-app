import { sb, cache, viewStates, showLoading, showToast, showConfirm, debounce, renderPagination, sanitizeFileName, filterButtonDefaultTexts, PLACEHOLDER_IMAGE_URL, currentUser, showView } from './app.js';

function buildSanPhamQuery() {
    const state = viewStates['view-san-pham'];
    let query = sb.from('san_pham').select('*', { count: 'exact' });

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

    if (state.searchTerm) query = query.or(`ma_vt.ilike.%${state.searchTerm}%,ten_vt.ilike.%${state.searchTerm}%,nganh.ilike.%${state.searchTerm}%,phu_trach.ilike.%${state.searchTerm}%`);
    if (state.filters.ma_vt?.length > 0) query = query.in('ma_vt', state.filters.ma_vt);
    if (state.filters.ten_vt?.length > 0) query = query.in('ten_vt', state.filters.ten_vt);
    if (state.filters.nganh?.length > 0) query = query.in('nganh', state.filters.nganh);
    if (state.filters.phu_trach?.length > 0) query = query.in('phu_trach', state.filters.phu_trach);
    
    return query;
}

export async function fetchSanPham(page = viewStates['view-san-pham'].currentPage, showLoader = true) {
    if (showLoader) showLoading(true);
    try {
        viewStates['view-san-pham'].currentPage = page;
        const state = viewStates['view-san-pham'];
        state.selected.clear();
        updateSanPhamSelectionInfo(); 

        const from = (page - 1) * state.itemsPerPage;
        const to = from + state.itemsPerPage - 1;
        
        let query = buildSanPhamQuery().order('ma_vt', { ascending: true }).range(from, to);
        const { data, error, count } = await query;
        
        if (error) {
            showToast("Không thể tải dữ liệu sản phẩm.", 'error');
        } else {
            state.totalFilteredCount = count; 
            let dataWithStock = data || [];
            if (dataWithStock.length > 0) {
                const maVts = dataWithStock.map(p => p.ma_vt);
                const { data: stockData } = await sb.from('ton_kho_update').select('ma_vt, ton_cuoi').in('ma_vt', maVts);
                const stockMap = new Map();
                (stockData || []).forEach(item => stockMap.set(item.ma_vt, (stockMap.get(item.ma_vt) || 0) + (item.ton_cuoi || 0)));
                dataWithStock = dataWithStock.map(sp => ({ ...sp, total_ton_cuoi: stockMap.get(sp.ma_vt) || 0 }));
            }
            cache.sanPhamList = dataWithStock;
            renderSanPhamTable(dataWithStock);
            renderPagination('san-pham', count, from, to);
        }
    } finally { if (showLoader) showLoading(false); }
}

function renderSanPhamTable(data) {
    const spTableBody = document.getElementById('san-pham-table-body');
    if (!spTableBody) return;
    if (data && data.length > 0) {
        spTableBody.innerHTML = data.map(sp => {
            const imageHtml = sp.url_hinh_anh ? `<img src="${sp.url_hinh_anh}" class="w-8 h-8 md:w-12 md:h-12 object-cover rounded-md thumbnail-image" data-large-src="${sp.url_hinh_anh}">` : `<div class="w-8 h-8 md:w-12 md:h-12 bg-gray-200 rounded-md flex items-center justify-center text-gray-400">...</div>`;
            const tonCuoiClass = sp.total_ton_cuoi > 0 ? 'text-green-600' : 'text-red-500';
            return `
                <tr data-id="${sp.ma_vt}" class="cursor-pointer hover:bg-gray-50">
                    <td class="px-1 md:px-4 py-1 border border-gray-300 flex justify-center items-center">${imageHtml}</td>
                    <td class="px-2 md:px-6 py-1 border border-gray-300">
                        <div class="flex flex-col">
                            <div class="flex justify-between items-center w-full gap-2">
                                <button data-ma-vt="${sp.ma_vt}" class="san-pham-ma-vt-link text-blue-600 font-bold hover:underline break-all text-left uppercase text-[10px] md:text-sm">${sp.ma_vt}</button>
                                <span class="text-[10px] md:text-sm font-bold whitespace-nowrap ${tonCuoiClass}">Tồn: ${sp.total_ton_cuoi.toLocaleString()}</span>
                            </div>
                            <span class="md:hidden text-[9px] text-gray-500 break-words mt-0.5 leading-tight">${sp.ten_vt}</span>
                        </div>
                    </td>
                    <td class="hidden md:table-cell px-6 py-1 text-sm text-gray-600 break-words border border-gray-300">${sp.ten_vt}</td>
                    <td class="px-1 md:px-6 py-1 text-[10px] md:text-sm text-gray-600 border border-gray-300 text-center">${sp.nganh || ''}</td>
                    <td class="hidden md:table-cell px-6 py-1 text-sm text-gray-600 border border-gray-300 text-center">${sp.phu_trach || ''}</td>
                </tr>`;
        }).join('');
    } else { spTableBody.innerHTML = '<tr><td colspan="5" class="text-center py-4">Không có dữ liệu</td></tr>'; }
}

function updateSanPhamSelectionInfo() {
    const s = viewStates['view-san-pham'];
    const el = document.getElementById('san-pham-selection-info');
    if (el) el.textContent = `${s.selected.size} / ${s.totalFilteredCount} hàng được chọn`;
}

async function handleSanPhamExcelExport() {
    const modal = document.getElementById('excel-export-modal');
    modal.classList.remove('hidden');

    const exportAndClose = async (exportAll) => {
        modal.classList.add('hidden');
        showLoading(true);
        try {
            const query = exportAll ? sb.from('san_pham').select('*') : buildSanPhamQuery().select('*');
            const { data, error } = await query.order('ma_vt').limit(50000);
            
            if (error) throw error;
            if (!data || data.length === 0) {
                showToast("Không có dữ liệu để xuất.", 'info');
                return;
            }

            const worksheet = XLSX.utils.json_to_sheet(data);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "SanPham");
            XLSX.writeFile(workbook, `SanPham_${new Date().toISOString().slice(0,10)}.xlsx`);
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

async function openFilterPopover(button, view) {
    const filterKey = button.dataset.filterKey;
    const state = viewStates[view];
    const template = document.getElementById('filter-popover-template');
    if (!template) return;
    const popover = template.content.cloneNode(true).querySelector('.filter-popover');
    document.body.appendChild(popover);
    const rect = button.getBoundingClientRect();

    if (window.innerWidth <= 768) {
        // Tối ưu vị trí cho Mobile
        popover.style.position = 'fixed';
        popover.style.left = '50%';
        popover.style.top = '50%';
        popover.style.transform = 'translate(-50%, -50%)';
        popover.style.width = '90%';
        popover.style.maxWidth = '300px';
        popover.style.zIndex = '100';
    } else {
        // Desktop
        if (button.closest('#sp-filter-drawer')) {
            popover.style.position = 'fixed';
            popover.style.right = '280px';
            popover.style.top = `${rect.top}px`;
        } else {
            popover.style.left = `${rect.left}px`;
            popover.style.top = `${rect.bottom + window.scrollY + 5}px`;
        }
    }

    const optList = popover.querySelector('.filter-options-list');
    const applyBtn = popover.querySelector('.filter-apply-btn');
    const searchInput = popover.querySelector('.filter-search-input');
    const countEl = popover.querySelector('.filter-selection-count');
    const toggleBtn = popover.querySelector('.filter-toggle-all-btn');
    const tempSel = new Set(state.filters[filterKey] || []);

    const render = (opts) => {
        const term = searchInput.value.toLowerCase();
        const filtered = opts.filter(o => o && String(o).toLowerCase().includes(term));
        optList.innerHTML = filtered.length > 0 ? filtered.map(o => `<label class="flex items-center space-x-2 px-2 py-1 hover:bg-gray-100 rounded cursor-pointer"><input type="checkbox" value="${o}" class="filter-option-cb" ${tempSel.has(String(o)) ? 'checked' : ''}><span class="text-xs md:text-sm">${o}</span></label>`).join('') : '<div class="text-center p-4 text-xs text-gray-500">Không có tùy chọn.</div>';
        const visible = optList.querySelectorAll('.filter-option-cb');
        toggleBtn.disabled = visible.length === 0;
        toggleBtn.textContent = visible.length > 0 && [...visible].every(cb => cb.checked) ? 'Bỏ chọn' : 'Tất cả';
    };

    optList.innerHTML = '<div class="text-center p-4 text-xs">Đang tải...</div>';
    applyBtn.disabled = true;
    try {
        let query = buildSanPhamQuery();
        Object.keys(state.filters).forEach(k => { if (k !== filterKey && state.filters[k]?.length > 0) query = query.in(k, state.filters[k]); });
        const { data } = await query.select(filterKey);
        const unique = [...new Set((data || []).map(i => i[filterKey]).filter(Boolean))].sort();
        render(unique);
        searchInput.oninput = () => render(unique);
        optList.onchange = e => { if (e.target.checked) tempSel.add(e.target.value); else tempSel.delete(e.target.value); countEl.textContent = tempSel.size > 0 ? `Đã chọn: ${tempSel.size}` : ''; render(unique); };
        toggleBtn.onclick = () => {
            const term = searchInput.value.toLowerCase();
            const visible = unique.filter(o => o && String(o).toLowerCase().includes(term));
            const isAll = toggleBtn.textContent === 'Tất cả';
            visible.forEach(o => isAll ? tempSel.add(String(o)) : tempSel.delete(String(o)));
            render(unique); countEl.textContent = tempSel.size > 0 ? `Đã chọn: ${tempSel.size}` : '';
        };
        applyBtn.disabled = false;
    } catch (e) { optList.innerHTML = '<div class="text-center p-4 text-xs text-red-500">Lỗi.</div>'; }

    const close = (e) => { if (!popover.contains(e.target) && e.target !== button) { popover.remove(); document.removeEventListener('click', close); } };
    applyBtn.onclick = () => {
        state.filters[filterKey] = [...tempSel];
        const def = filterButtonDefaultTexts[button.id.replace('-mobile', '')] || button.id;
        const txt = tempSel.size > 0 ? `${def} (${tempSel.size})` : def;
        const dBtn = document.getElementById(`san-pham-filter-${filterKey.replace('_', '-')}-btn`);
        const mBtn = document.getElementById(`san-pham-filter-${filterKey.replace('_', '-')}-btn-mobile`);
        if(dBtn) dBtn.textContent = txt; if(mBtn) mBtn.textContent = txt;
        fetchSanPham(1); popover.remove(); document.removeEventListener('click', close);
    };
    setTimeout(() => document.addEventListener('click', close), 0);
}

export function initSanPhamView() {
    const view = document.getElementById('view-san-pham');

    document.getElementById('san-pham-search').oninput = debounce(e => { viewStates['view-san-pham'].searchTerm = e.target.value; fetchSanPham(1); }, 500);
    document.getElementById('san-pham-search-mobile').oninput = debounce(e => { viewStates['view-san-pham'].searchTerm = e.target.value; fetchSanPham(1); }, 500);
    view.onclick = async e => { 
        const btn = e.target.closest('.filter-btn'); 
        if (btn) {
            openFilterPopover(btn, 'view-san-pham');
            return;
        }

        // Logic điều hướng sang Tồn kho khi nhấn vào Mã VT
        const vtLink = e.target.closest('.san-pham-ma-vt-link');
        if (vtLink) {
            const ma_vt = vtLink.dataset.maVt;
            const tkState = viewStates['view-ton-kho'];
            
            // Reset các bộ lọc tồn kho
            tkState.searchTerm = '';
            tkState.filters = { ma_vt: [ma_vt], lot: [], date: [], tinh_trang: [], nganh: [], phu_trach: [] };
            tkState.stockAvailability = 'all'; // Chuyển sang xem "Tất cả" để thấy mã này dù có thể hết hàng
            sessionStorage.setItem('tonKhoStockAvailability', 'all');
            
            await showView('view-ton-kho');
            return;
        }

        if (e.target.closest('.thumbnail-image')) {
            document.getElementById('image-viewer-img').src = e.target.closest('.thumbnail-image').dataset.largeSrc;
            document.getElementById('image-viewer-modal').classList.remove('hidden'); 
            return;
        }
    };
    
    const reset = () => {
        document.getElementById('san-pham-search').value = ''; document.getElementById('san-pham-search-mobile').value = '';
        viewStates['view-san-pham'].searchTerm = '';
        viewStates['view-san-pham'].filters = { ma_vt: [], ten_vt: [], nganh: [], phu_trach: [] };
        ['ma_vt', 'ten_vt', 'nganh', 'phu_trach'].forEach(k => {
             const def = filterButtonDefaultTexts[`san-pham-filter-${k.replace('_', '-')}-btn`];
             const d = document.getElementById(`san-pham-filter-${k.replace('_', '-')}-btn`);
             const m = document.getElementById(`san-pham-filter-${k.replace('_', '-')}-btn-mobile`);
             if(d) d.textContent = def; if(m) m.textContent = def;
        });
        fetchSanPham(1);
    };
    document.getElementById('san-pham-reset-filters').onclick = reset;
    document.getElementById('san-pham-reset-filters-mobile').onclick = reset;

    const drw = document.getElementById('sp-filter-drawer');
    const ovl = document.getElementById('sp-filter-drawer-overlay');
    document.getElementById('sp-mobile-filter-toggle').onclick = () => { drw.classList.remove('translate-x-full'); ovl.classList.remove('hidden'); };
    document.getElementById('sp-filter-drawer-close').onclick = () => { drw.classList.add('translate-x-full'); ovl.classList.add('hidden'); };
    ovl.onclick = () => { drw.classList.add('translate-x-full'); ovl.classList.add('hidden'); };

    document.getElementById('san-pham-btn-excel').onclick = handleSanPhamExcelExport;
    document.getElementById('san-pham-btn-excel-mobile').onclick = handleSanPhamExcelExport;

    document.getElementById('san-pham-items-per-page').onchange = e => { viewStates['view-san-pham'].itemsPerPage = parseInt(e.target.value); fetchSanPham(1); };
    document.getElementById('san-pham-prev-page').onclick = () => fetchSanPham(viewStates['view-san-pham'].currentPage - 1);
    document.getElementById('san-pham-next-page').onclick = () => fetchSanPham(viewStates['view-san-pham'].currentPage + 1);
}