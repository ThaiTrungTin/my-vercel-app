
import { sb, currentUser, showLoading, showToast, viewStates, showView } from './app.js';

export const expandedHierarchyPaths = new Set();
export let idsWithDistribution = new Set();
let activeHierarchyPopover = null;

export function getRangeDates(preset) {
    const now = new Date();
    let start = new Date();
    let end = new Date();
    switch (preset) {
        case 'all': start = new Date(0); end = new Date(); break;
        case 'today': start.setHours(0, 0, 0, 0); end.setHours(23, 59, 59, 999); break;
        case 'week':
            const day = now.getDay();
            const diff = now.getDate() - day + (day === 0 ? -6 : 1);
            start = new Date(now.setDate(diff)); start.setHours(0, 0, 0, 0);
            end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23, 59, 59, 999);
            break;
        case 'month':
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
            break;
        case 'quarter':
            const q = Math.floor(now.getMonth() / 3);
            start = new Date(now.getFullYear(), q * 3, 1);
            end = new Date(now.getFullYear(), (q + 1) * 3, 0, 23, 59, 59, 999);
            break;
        case 'year':
            start = new Date(now.getFullYear(), 0, 1);
            end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
            break;
        case 'custom':
            const from = document.getElementById('tq-hierarchy-date-from')?.value;
            const to = document.getElementById('tq-hierarchy-date-to')?.value;
            start = from ? new Date(from) : new Date(0);
            end = to ? new Date(to) : new Date();
            end.setHours(23, 59, 59, 999);
            break;
    }
    return { start: start.toISOString(), end: end.toISOString() };
}

export async function fetchAndRenderHierarchy(tongQuanState, isFirstLoad) {
    const container = document.getElementById('tq-hierarchy-container');
    if (!container) return;
    
    const hState = tongQuanState.hierarchy;
    const allowedBUs = (currentUser.xem_data || '').split(',').map(s => s.trim()).filter(Boolean);
    const isAdmin = currentUser.phan_quyen === 'Admin';
    const hasGatePermission = allowedBUs.includes('EES') || allowedBUs.includes('ESC');

    // Nếu không phải Admin và không có ngành EES hoặc ESC trong danh sách cấp phép, ẩn luôn
    if (!isAdmin && !hasGatePermission) {
        container.innerHTML = '';
        return false;
    }

    if (isFirstLoad || container.innerHTML.trim() === '') {
        container.innerHTML = '<div class="text-center py-10"><svg class="animate-spin h-8 w-8 text-blue-500 mx-auto" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><p class="mt-2 text-[10px] text-gray-500 font-bold uppercase tracking-wider">Đang tính toán phả hệ...</p></div>';
    }

    const preset = document.getElementById('tq-hierarchy-time-preset').value;
    const { start, end } = getRangeDates(preset);

    if (document.getElementById('tq-hierarchy-submode-container')) {
        document.getElementById('tq-hierarchy-submode-container').classList.toggle('hidden', hState.mode !== 'xuat');
    }

    try {
        let query = sb.from('chi_tiet_v1').select('id, bu, khu_vuc, franchise, ma_vt, yeu_cau, ma_nx, xuat, nhap, yc_sl').gte('thoi_gian', start).lte('thoi_gian', end);
        if (hState.mode === 'xuat') query = query.gt('yc_sl', 0); else query = query.gt('nhap', 0);
        if (hState.ma_vt.length > 0) query = query.in('ma_vt', hState.ma_vt);
        if (hState.yeu_cau.length > 0) query = query.in('yeu_cau', hState.yeu_cau);

        if (!isAdmin) {
            if (allowedBUs.length > 0) {
                // Lọc dữ liệu phả hệ dựa trên các BU được phép (Vẫn hiển thị ngành khác nếu có trong xem_data, miễn là có EES/ESC để "mở cửa")
                query = query.in('bu', allowedBUs);
            }
        }

        const [{ data: distData }, { data: rows }] = await Promise.all([
            sb.from('chi_tiet_vt').select('id_ct'),
            query
        ]);
        
        idsWithDistribution = new Set((distData || []).map(d => d.id_ct));

        if (!rows || rows.length === 0) {
            container.innerHTML = `<div class="text-center py-10 text-gray-400 italic">Không tìm thấy dữ liệu phù hợp.</div>`;
            return false;
        }

        const tree = buildHierarchy(rows, hState.mode, hState.subMode);
        const fragment = document.createDocumentFragment();
        renderTree(fragment, tree, 0, hState.mode, '', hState.subMode);
        container.innerHTML = '';
        container.appendChild(fragment);
        return false;
    } catch (err) {
        container.innerHTML = `<div class="text-center py-10 text-red-500 font-bold text-xs uppercase">Lỗi: ${err.message}</div>`;
        return false;
    }
}

function buildHierarchy(data, mode, subMode) {
    const root = { total: 0, xuatTotal: 0, shortageTotal: 0, nxSet: new Set(), vtSet: new Set(), children: {} };
    
    const createNode = () => ({ total: 0, xuatTotal: 0, shortageTotal: 0, nxSet: new Set(), vtSet: new Set(), children: {} });

    data.forEach(row => {
        const bu = row.bu || 'KHÔNG XÁC ĐỊNH';
        const kv = row.khu_vuc || 'CHƯA PHÂN VÙNG';
        const fr = row.franchise || 'N/A';
        const vt = row.ma_vt;
        const yc = row.yeu_cau || 'Chưa rõ';
        const nx = row.ma_nx || 'N/A';
        
        const xuat = parseFloat(row.xuat) || 0, nhap = parseFloat(row.nhap) || 0, ycsl = parseFloat(row.yc_sl) || 0;
        const shortage = (mode === 'xuat' && nx.includes('DO')) ? Math.max(0, ycsl - xuat) : 0;

        if (mode === 'xuat') {
            if (subMode === 'xuat' && xuat <= 0) return;
            if (subMode === 'shortage' && shortage <= 0) return;
        }

        const val = mode === 'xuat' ? xuat + shortage : nhap;
        const update = (node) => {
            node.total += val; node.xuatTotal += (mode === 'xuat' ? xuat : 0); node.shortageTotal += (mode === 'xuat' ? shortage : 0);
            if(nx) node.nxSet.add(nx); if(vt) node.vtSet.add(vt);
        };

        update(root);
        // BU Level
        if (!root.children[bu]) root.children[bu] = createNode();
        update(root.children[bu]);
        
        // KHU VỰC Level (NEW)
        if (!root.children[bu].children[kv]) root.children[bu].children[kv] = createNode();
        update(root.children[bu].children[kv]);
        
        // FRANCHISE Level
        if (!root.children[bu].children[kv].children[fr]) root.children[bu].children[kv].children[fr] = createNode();
        update(root.children[bu].children[kv].children[fr]);
        
        // MÃ VT Level
        if (!root.children[bu].children[kv].children[fr].children[vt]) root.children[bu].children[kv].children[fr].children[vt] = createNode();
        const vtN = root.children[bu].children[kv].children[fr].children[vt];
        update(vtN);

        const addLeaf = (parent, catName, finalVal, isX, isS) => {
            if (!parent.children[catName]) parent.children[catName] = { total: 0, xuatTotal: 0, shortageTotal: 0, nxSet: new Set(), children: {} };
            const cN = parent.children[catName];
            cN.total += finalVal; if(isX) cN.xuatTotal += finalVal; if(isS) cN.shortageTotal += finalVal;
            if(nx) cN.nxSet.add(nx);
            if (!cN.children[yc]) cN.children[yc] = { total: 0, xuatTotal: 0, shortageTotal: 0, nxSet: new Set(), children: {} };
            const ycN = cN.children[yc];
            ycN.total += finalVal; if(isX) ycN.xuatTotal += finalVal; if(isS) ycN.shortageTotal += finalVal;
            if(nx) ycN.nxSet.add(nx);
            if (!ycN.children[nx]) ycN.children[nx] = { total: 0, xuatTotal: 0, shortageTotal: 0, nxSet: new Set(), id_cts: [], isMaNX: true, children: {} };
            const nxN = ycN.children[nx];
            nxN.total += finalVal; if(isX) nxN.xuatTotal += finalVal; if(isS) nxN.shortageTotal += finalVal;
            nxN.id_cts.push(row.id); if(nx) nxN.nxSet.add(nx);
        };

        if (mode === 'xuat') {
            if (subMode === 'all') {
                if (xuat > 0) addLeaf(vtN, 'Đã xuất', xuat, true, false);
                if (shortage > 0) addLeaf(vtN, 'Thiếu hàng', shortage, false, true);
            } else {
                addLeaf(vtN, subMode === 'xuat' ? 'Đã xuất' : 'Thiếu hàng', val, subMode === 'xuat', subMode === 'shortage');
            }
        } else {
            if (!vtN.children[yc]) vtN.children[yc] = { total: 0, nxSet: new Set(), children: {} };
            const ycN = vtN.children[yc]; ycN.total += val; if(nx) ycN.nxSet.add(nx);
            if (!ycN.children[nx]) ycN.children[nx] = { total: 0, nxSet: new Set(), id_cts: [], isMaNX: true, children: {} };
            const nxN = ycN.children[nx]; nxN.total += val; nxN.id_cts.push(row.id); if(nx) nxN.nxSet.add(nx);
        }
    });
    return root;
}

function renderTree(container, node, level, mode, parentPath, subMode) {
    const keys = Object.keys(node.children || {}).sort((a, b) => node.children[b].total - node.children[a].total);
    const weights = ['font-black', 'font-extrabold', 'font-bold', 'font-semibold', 'font-medium', 'font-normal', 'font-normal'];
    
    keys.forEach(key => {
        const child = node.children[key], isNX = child.isMaNX, path = parentPath ? `${parentPath}|${key}` : key;
        const hasDist = isNX && child.id_cts.some(id => idsWithDistribution.has(id));
        const hasChildren = (child.children && Object.keys(child.children).length > 0) || (isNX && hasDist);
        const isExp = expandedHierarchyPaths.has(path);

        const nodeEl = document.createElement('div');
        nodeEl.className = 'tree-node' + (isExp ? ' expanded' : '');
        const contentEl = document.createElement('div');
        contentEl.className = `tree-node-content group flex-nowrap ${level === 0 ? 'bg-white shadow-sm border border-gray-100 mb-1 py-3' : 'py-1.5'}`;
        
        let color = 'text-gray-700';
        if (level === 0) color = 'text-blue-900'; 
        else if (level === 1) color = 'text-indigo-600'; // Khu vực
        else if (level === 2) color = 'text-gray-800'; // Franchise
        else if (level === 3) color = 'text-indigo-700'; // Mã VT

        if (key === "Thiếu hàng" || (mode === 'xuat' && subMode === 'shortage' && level >= 4)) color = 'text-amber-500';
        else if (key === "Đã xuất" || (mode === 'xuat' && subMode === 'xuat' && level >= 4)) color = 'text-red-600';

        const nxCount = child.nxSet ? child.nxSet.size : 0;
        const nxHtml = !isNX ? `<span class="text-[10px] md:text-xs ${weights[level]} text-black ml-1.5 tracking-tighter">(${nxCount})</span>` : '';
        const vtHtml = (level < 3 && child.vtSet) ? `<span class="text-[10px] md:text-xs ${weights[level]} text-indigo-400 ml-1 tracking-tighter">(${child.vtSet.size})</span>` : '';

        const badge = isNX ? `<span class="text-[11px] md:text-sm ${weights[level]} ${mode === 'nhap' ? 'text-green-600' : (path.includes('Thiếu') ? 'text-amber-500' : 'text-red-600')} ml-auto whitespace-nowrap">${child.total.toLocaleString()}</span>`
            : `<div class="ml-auto flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap">
                ${mode === 'xuat' ? `<div class="flex items-center gap-1 shadow-sm rounded-full overflow-hidden border border-gray-100 bg-white">
                    ${child.xuatTotal > 0 ? `<span class="px-2 py-0.5 text-xs md:text-sm ${weights[level]} text-red-600">${child.xuatTotal.toLocaleString()}</span>` : ''}
                    ${child.shortageTotal > 0 ? `<span class="px-2 py-0.5 text-xs md:text-sm ${weights[level]} text-amber-500 border-l border-gray-50 bg-amber-50/20">${child.shortageTotal.toLocaleString()}</span>` : ''}
                </div>` : `<span class="text-green-600 px-2 py-0.5 text-xs md:text-sm ${weights[level]}">${child.total.toLocaleString()}</span>`}
               </div>`;

        contentEl.innerHTML = `
            <div class="flex items-center gap-1 md:gap-2 flex-grow min-w-0 overflow-hidden">
                ${hasChildren ? `<svg class="tree-toggle-icon w-3 h-3 md:w-4 md:h-4 text-gray-400 group-hover:text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M10 12a1 1 0 01-.707-.293l-4-4a1 1 0 111.414-1.414L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4A1 1 0 0110 12z"></path></svg>` : `<span class="w-3 md:w-4 flex-shrink-0"></span>`}
                <div class="flex-grow flex items-center gap-1 md:gap-1.5 overflow-hidden min-w-0">
                    <span class="${weights[level]} ${color} truncate leading-tight text-[10px] md:text-sm">${key}</span>
                    ${nxHtml}${vtHtml}
                    ${level === 3 ? `<button class="hierarchy-vt-action-btn flex-shrink-0 p-1 text-gray-300 hover:text-indigo-500 rounded opacity-0 group-hover:opacity-100 transition-opacity" data-ma-vt="${key}"><svg class="w-3 h-3 md:w-4 md:h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"></path></svg></button>` : ''}
                    ${isNX ? `<button class="hierarchy-nx-action-btn flex-shrink-0 p-1 text-gray-300 hover:text-green-500 rounded opacity-0 group-hover:opacity-100 transition-opacity" data-ma-nx="${key}" data-ct-id="${child.id_cts[0]}"><svg class="w-3 h-3 md:w-4 md:h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"></path></svg></button>` : ''}
                </div>
            </div>${badge}`;

        nodeEl.appendChild(contentEl);
        const childContainer = document.createElement('div'); childContainer.className = 'tree-children'; nodeEl.appendChild(childContainer);

        contentEl.onclick = async (e) => {
            const vtBtn = e.target.closest('.hierarchy-vt-action-btn'), nxBtn = e.target.closest('.hierarchy-nx-action-btn');
            if (vtBtn) { e.stopPropagation(); openHierarchyActionPopover(vtBtn, 'vt', vtBtn.dataset.maVt); return; }
            if (nxBtn) { e.stopPropagation(); openHierarchyActionPopover(nxBtn, 'nx', nxBtn.dataset.maNx, nxBtn.dataset.ctId); return; }
            
            e.stopPropagation();
            const isExpNow = nodeEl.classList.toggle('expanded');
            if (isExpNow) {
                expandedHierarchyPaths.add(path);
                if (childContainer.innerHTML === '') {
                    if (isNX && hasDist) {
                        childContainer.innerHTML = '<div class="p-2 text-center text-[9px] text-gray-400 italic tracking-tighter">Đang tải phân bổ...</div>';
                        try {
                            const { data: dists } = await sb.from('chi_tiet_vt').select('sl, nguoi_nhan, dia_diem, created_at').in('id_ct', child.id_cts).order('created_at', { ascending: true });
                            childContainer.innerHTML = (dists && dists.length > 0) ? dists.map(d => `<div class="flex items-center gap-2 py-1.5 px-3 border-b border-gray-50 last:border-0 hover:bg-white rounded transition-colors overflow-hidden">
                                <div class="flex-shrink-0 w-1 h-1 rounded-full bg-indigo-300"></div>
                                <div class="text-[9px] md:text-xs text-gray-600 whitespace-nowrap"><strong class="text-blue-700">${d.sl}</strong> - <span class="font-bold text-gray-800">${d.nguoi_nhan || 'Chưa rõ'}</span> - <span class="italic text-gray-500">${d.dia_diem || 'N/A'}</span></div>
                            </div>`).join('') : '<div class="p-2 text-center text-[9px] text-gray-400 italic">Không có phân bổ.</div>';
                        } catch (err) { childContainer.innerHTML = '<div class="p-2 text-center text-[9px] text-red-400 italic">Lỗi.</div>'; }
                    } else renderTree(childContainer, child, level + 1, mode, path, subMode);
                }
            } else expandedHierarchyPaths.delete(path);
        };

        if (isExp) {
            if (isNX && hasDist) setTimeout(() => contentEl.click(), 10);
            else renderTree(childContainer, child, level + 1, mode, path, subMode);
        }
        container.appendChild(nodeEl);
    });
}

async function openHierarchyActionPopover(button, type, value, ctId = null) {
    // Logic Toggle: Nếu đang mở chính menu của nút này thì đóng lại và thoát
    if (activeHierarchyPopover) {
        const isSameButton = activeHierarchyPopover._trigger === button;
        activeHierarchyPopover.remove();
        activeHierarchyPopover = null;
        if (isSameButton) return;
    }

    const templateId = type === 'vt' ? 'hierarchy-vt-action-menu-template' : 'hierarchy-nx-action-menu-template';
    const template = document.getElementById(templateId);
    if (!template) return;

    const popover = template.content.cloneNode(true).querySelector('.action-popover');
    popover._trigger = button; // Lưu lại nút kích hoạt
    document.body.appendChild(popover);
    const rect = button.getBoundingClientRect();
    popover.style.position = 'fixed'; popover.style.top = `${rect.bottom + 5}px`; popover.style.left = `${rect.left - (type==='vt'?80:120)}px`; popover.style.zIndex = '1000';

    if (type === 'vt') {
        const nEl = popover.querySelector('#h-pop-n'), xEl = popover.querySelector('#h-pop-x'), tEl = popover.querySelector('#h-pop-t');
        const { data } = await sb.from('ton_kho_update').select('nhap, xuat, ton_cuoi').eq('ma_vt', value);
        let n = 0, x = 0, t = 0; (data || []).forEach(d => { n += d.nhap; x += d.xuat; t += d.ton_cuoi; });
        if(nEl) nEl.textContent = n.toLocaleString(); if(xEl) xEl.textContent = x.toLocaleString(); if(tEl) tEl.textContent = t.toLocaleString();

        popover.querySelector('.h-action-stock').onclick = () => { const s = viewStates['view-ton-kho']; s.searchTerm = ''; s.filters = { ma_vt: [value], lot: [], date: [], tinh_trang: [], nganh: [], phu_trach: [] }; s.stockAvailability = 'all'; showView('view-ton-kho'); popover.remove(); activeHierarchyPopover = null; };
        popover.querySelector('.h-action-card').onclick = () => { const s = viewStates['view-chi-tiet']; s.searchTerm = ''; s.filters = { from_date: '', to_date: '', loai: [], ma_kho: [], ma_nx: [], ma_vt: [value], lot: [], nganh: [], phu_trach: [], yeu_cau: [] }; showView('view-chi-tiet'); popover.remove(); activeHierarchyPopover = null; };
    } else {
        popover.querySelector('.h-nx-action-view').onclick = async () => { 
            const { data } = await sb.from('chi_tiet').select('*').eq('id', ctId).single();
            if(data) { const { openDetailVtModal } = await import('./chitiet.js'); openDetailVtModal(data, true); }
            popover.remove(); activeHierarchyPopover = null;
        };
        popover.querySelector('.h-nx-action-edit').onclick = async () => {
            const { data } = await sb.from('chi_tiet').select('*').eq('id', ctId).single();
            if(data) { const { openDetailVtModal } = await import('./chitiet.js'); openDetailVtModal(data, false); }
            popover.remove(); activeHierarchyPopover = null;
        };
        popover.querySelector('.h-nx-action-goto').onclick = () => { const s = viewStates['view-chi-tiet']; s.searchTerm = ''; s.filters = { from_date: '', to_date: '', loai: [], ma_kho: [], ma_nx: [value], ma_vt: [], lot: [], nganh: [], phu_trach: [], yeu_cau: [] }; showView('view-chi-tiet'); popover.remove(); activeHierarchyPopover = null; };
    }

    activeHierarchyPopover = popover;

    // Lắng nghe click toàn cục để đóng popover khi nhấn ra ngoài
    setTimeout(() => {
        const closeHandler = (e) => {
            if (!popover.contains(e.target) && e.target !== button) {
                popover.remove();
                if (activeHierarchyPopover === popover) activeHierarchyPopover = null;
                document.removeEventListener('click', closeHandler);
            }
        };
        document.addEventListener('click', closeHandler);
    }, 0);
}
