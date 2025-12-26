
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
    const hasGatePermission = allowedBUs.includes('EES') || allowedBUs.includes('ESC') || isAdmin;

    if (!hasGatePermission) {
        container.innerHTML = '<div class="text-center py-10 text-gray-400 italic">Bạn không có quyền xem phả hệ ngành này.</div>';
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
        const bu = row.bu || 'KHÔNG XÁC ĐỊNH', kv = row.khu_vuc || 'CHƯA PHÂN VÙNG', fr = row.franchise || 'N/A', vt = row.ma_vt;
        const yc = row.yeu_cau || 'Chưa rõ', nx = row.ma_nx || 'N/A';
        const xuat = parseFloat(row.xuat) || 0, nhap = parseFloat(row.nhap) || 0, ycsl = parseFloat(row.yc_sl) || 0;
        const shortage = (mode === 'xuat' && nx.includes('DO')) ? Math.max(0, ycsl - xuat) : 0;

        // Hàm helper để thêm dữ liệu vào một node bất kỳ
        const updateNodeData = (node, val, xuatVal, shortageVal) => {
            node.total += val;
            node.xuatTotal += xuatVal;
            node.shortageTotal += shortageVal;
            if (nx) node.nxSet.add(nx);
            if (vt) node.vtSet.add(vt);
        };

        const processRow = (finalVal, isXuatCat, isShortageCat) => {
            // Chỉ build phả hệ khi có giá trị thực tế
            if (finalVal <= 0) return;

            // Root
            updateNodeData(root, finalVal, mode === 'xuat' ? xuat : 0, mode === 'xuat' ? shortage : 0);

            // BU
            if (!root.children[bu]) root.children[bu] = createNode();
            updateNodeData(root.children[bu], finalVal, mode === 'xuat' ? xuat : 0, mode === 'xuat' ? shortage : 0);

            // Khu Vực
            if (!root.children[bu].children[kv]) root.children[bu].children[kv] = createNode();
            updateNodeData(root.children[bu].children[kv], finalVal, mode === 'xuat' ? xuat : 0, mode === 'xuat' ? shortage : 0);

            // Franchise
            if (!root.children[bu].children[kv].children[fr]) root.children[bu].children[kv].children[fr] = createNode();
            updateNodeData(root.children[bu].children[kv].children[fr], finalVal, mode === 'xuat' ? xuat : 0, mode === 'xuat' ? shortage : 0);

            // Mã VT
            if (!root.children[bu].children[kv].children[fr].children[vt]) root.children[bu].children[kv].children[fr].children[vt] = createNode();
            const vtN = root.children[bu].children[kv].children[fr].children[vt];
            updateNodeData(vtN, finalVal, mode === 'xuat' ? xuat : 0, mode === 'xuat' ? shortage : 0);

            if (mode === 'xuat') {
                const catName = isXuatCat ? 'Đã xuất' : 'Thiếu hàng';
                if (!vtN.children[catName]) vtN.children[catName] = createNode();
                const catN = vtN.children[catName];
                updateNodeData(catN, finalVal, isXuatCat ? finalVal : 0, isShortageCat ? finalVal : 0);

                if (!catN.children[yc]) catN.children[yc] = createNode();
                const ycN = catN.children[yc];
                updateNodeData(ycN, finalVal, isXuatCat ? finalVal : 0, isShortageCat ? finalVal : 0);

                if (!ycN.children[nx]) ycN.children[nx] = { total: 0, xuatTotal: 0, shortageTotal: 0, nxSet: new Set(), id_cts: [], isMaNX: true, children: {} };
                const nxN = ycN.children[nx];
                nxN.total += finalVal;
                if (isXuatCat) nxN.xuatTotal += finalVal;
                if (isShortageCat) nxN.shortageTotal += finalVal;
                nxN.id_cts.push(row.id);
                if (nx) nxN.nxSet.add(nx);
            } else {
                // Chế độ nhập (đơn giản hơn)
                if (!vtN.children[yc]) vtN.children[yc] = createNode();
                const ycN = vtN.children[yc];
                updateNodeData(ycN, finalVal, 0, 0);

                if (!ycN.children[nx]) ycN.children[nx] = { total: 0, xuatTotal: 0, shortageTotal: 0, nxSet: new Set(), id_cts: [], isMaNX: true, children: {} };
                const nxN = ycN.children[nx];
                nxN.total += finalVal;
                nxN.id_cts.push(row.id);
                if (nx) nxN.nxSet.add(nx);
            }
        };

        if (mode === 'xuat') {
            if (subMode === 'all' || subMode === 'xuat') processRow(xuat, true, false);
            if (subMode === 'all' || subMode === 'shortage') processRow(shortage, false, true);
        } else {
            processRow(nhap, false, false);
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
        else if (level === 1) color = 'text-indigo-600'; 
        else if (level === 2) color = 'text-gray-800'; 
        else if (level === 3) color = 'text-indigo-700'; 

        if (key === "Thiếu hàng" || (mode === 'xuat' && subMode === 'shortage' && level >= 4)) color = 'text-amber-500';
        else if (key === "Đã xuất" || (mode === 'xuat' && subMode === 'xuat' && level >= 4)) color = 'text-red-600';

        const nxCount = child.nxSet ? child.nxSet.size : 0;
        const nxHtml = !isNX ? `<span class="text-[10px] md:text-xs ${weights[level]} text-black ml-1.5 tracking-tighter">(${nxCount})</span>` : '';
        const vtHtml = (level < 3 && child.vtSet) ? `<span class="text-[10px] md:text-xs ${weights[level]} text-indigo-400 ml-1 tracking-tighter">(${child.vtSet.size})</span>` : '';

        const badge = isNX ? `<span class="text-[11px] md:text-sm ${weights[level]} ${mode === 'nhap' ? 'text-green-600' : (path.includes('Thiếu') ? 'text-amber-500' : 'text-red-600')} ml-auto whitespace-nowrap">${child.total.toLocaleString()}</span>`
            : `<div class="ml-auto flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap">
                ${mode === 'xuat' ? `<div class="flex items-center gap-1 shadow-sm rounded-full overflow-hidden border border-gray-100 bg-white">
                    ${child.shortageTotal > 0 ? `<span class="px-2 py-0.5 text-xs md:text-sm ${weights[level]} text-amber-500 bg-amber-50/20">${child.shortageTotal.toLocaleString()}</span>` : ''}
                    ${child.xuatTotal > 0 ? `<span class="px-2 py-0.5 text-xs md:text-sm ${weights[level]} text-red-600 ${child.shortageTotal > 0 ? 'border-l border-gray-50' : ''}">${child.xuatTotal.toLocaleString()}</span>` : ''}
                </div>` : `<span class="text-green-600 px-2 py-0.5 text-xs md:text-sm ${weights[level]}">${child.total.toLocaleString()}</span>`}
               </div>`;

        contentEl.innerHTML = `
            <div class="flex items-center gap-1 md:gap-2 flex-grow min-w-0 overflow-hidden">
                ${hasChildren ? `<svg class="tree-toggle-icon w-3.5 h-3.5 md:w-4 md:h-4 text-gray-400 group-hover:text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M10 12a1 1 0 01-.707-.293l-4-4a1 1 0 111.414-1.414L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4A1 1 0 0110 12z"></path></svg>` : `<span class="w-3.5 md:w-4 flex-shrink-0"></span>`}
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
    popover._trigger = button; 
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
