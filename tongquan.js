import { sb, viewStates, showView, currentUser, showToast, showLoading } from './app.js';
import { fetchAndRenderHierarchy, getRangeDates, expandedHierarchyPaths } from './tongquan-hierarchy.js';
import { renderActivityChart, renderInventoryStatusChart, renderRegionLineChart, renderRecipientStackedBarChart } from './tongquan-charts.js';
import { fetchAlerts, renderAlerts } from './tongquan-alerts.js';

let chartMode = 'quantity'; 
let last30DaysData = []; 
let allAlerts = null;
let isHierarchyFirstLoad = true;
let analyticsRecipientView = 'chart'; // 'chart' or 'list'
let expandedRecipientPaths = new Set();

export const tongQuanState = {
    alerts: { loai: [], nganh: [], phu_trach: [] },
    inventory: { nganh: [] },
    hierarchy: { mode: 'xuat', subMode: 'all', ma_vt: [], yeu_cau: [] },
    analytics: { bu: [], yeu_cau: [], ma_vt: [], nguoi_nhan: [] }
};

function updateFilterButtons() {
    const mapping = {
        'tq-alert-filter-loai-btn': ['alerts', 'loai', 'Loại'],
        'tq-alert-filter-nganh-btn': ['alerts', 'nganh', 'Ngành'],
        'tq-alert-filter-phu-trach-btn': ['alerts', 'phu_trach', 'Phụ Trách'],
        'tq-inventory-chart-nganh-filter-btn': ['inventory', 'nganh', 'Ngành'],
        'tq-hierarchy-ma-vt-filter-btn': ['hierarchy', 'ma_vt', 'Mã VT'],
        'tq-hierarchy-yeu-cau-filter-btn': ['hierarchy', 'yeu_cau', 'Yêu Cầu'],
        'tq-ana-nganh-filter-btn': ['analytics', 'bu', 'Ngành (BU)'],
        'tq-ana-yeu-cau-filter-btn': ['analytics', 'yeu_cau', 'Yêu Cầu'],
        'tq-ana-ma-vt-filter-btn': ['analytics', 'ma_vt', 'Mã VT'],
        'tq-ana-nguoi-nhan-filter-btn': ['analytics', 'nguoi_nhan', 'Người Nhận']
    };
    Object.keys(mapping).forEach(id => {
        const btn = document.getElementById(id); if(!btn) return;
        const [ctx, key, def] = mapping[id], len = tongQuanState[ctx][key].length;
        btn.textContent = len > 0 ? `${def} (${len})` : def;
    });
    
    const presetMapping = {
        'tq-hierarchy-time-filter-btn': 'tq-hierarchy-time-preset',
        'tq-ana-time-filter-btn': 'tq-ana-time-preset'
    };
    Object.keys(presetMapping).forEach(btnId => {
        const btn = document.getElementById(btnId); if(!btn) return;
        const presetEl = document.getElementById(presetMapping[btnId]);
        if (!presetEl) return;
        const p = presetEl.value;
        const map = { all:'Tất cả', today:'Hôm nay', week:'Tuần này', month:'Tháng này', quarter:'Quý này', year:'Năm nay', custom:'Tùy chọn' };
        btn.textContent = map[p] || 'Thời Gian';
    });
}

async function openFilter(button) {
    const ctx = button.dataset.context, key = button.dataset.filterKey;
    const template = document.getElementById('filter-popover-template');
    if (!template) return;
    const pop = template.content.cloneNode(true).querySelector('.filter-popover');
    document.body.appendChild(pop);
    const rect = button.getBoundingClientRect(), isM = window.innerWidth <= 768;
    pop.style.width = isM ? '180px' : '250px';
    let left = rect.left; if (left + (isM?180:250) > window.innerWidth) left = window.innerWidth - (isM?190:260);
    pop.style.left = `${Math.max(10, left)}px`; pop.style.top = `${rect.bottom + window.scrollY + 5}px`; pop.style.zIndex = '1000';

    const list = pop.querySelector('.filter-options-list'), apply = pop.querySelector('.filter-apply-btn'), search = pop.querySelector('.filter-search-input');
    const cntEl = pop.querySelector('.filter-selection-count'), toggle = pop.querySelector('.filter-toggle-all-btn');
    const temp = new Set(tongQuanState[ctx][key] || []);

    const render = (opts) => {
        const term = search.value.toLowerCase();
        const filtered = opts.filter(o => o && String(o).toLowerCase().includes(term));
        list.innerHTML = filtered.length > 0 ? filtered.map(o => `<label class="flex items-center space-x-2 px-2 py-1 hover:bg-gray-100 rounded cursor-pointer"><input type="checkbox" value="${o}" class="filter-option-cb" ${temp.has(String(o))?'checked':''}> <span class="text-sm">${o}</span></label>`).join('') : '<div class="p-4 text-center text-gray-400 text-xs italic">Trống.</div>';
        toggle.textContent = filtered.length > 0 && filtered.every(o => temp.has(String(o))) ? 'Bỏ chọn' : 'Tất cả';
        cntEl.textContent = temp.size > 0 ? `Chọn: ${temp.size}` : '';
    };

    let opts = [];
    if (ctx === 'alerts') {
        if (key === 'loai') {
            opts = ['Sắp hết hàng', 'Tồn kho lâu', 'Cận date'];
        } else {
            const mapLoai = { 'Sắp hết hàng': 'lowStock', 'Tồn kho lâu': 'slowMoving', 'Cận date': 'urgentExpiry' };
            const selL = tongQuanState.alerts.loai.map(l => mapLoai[l]);
            const otherKey = key === 'phu_trach' ? 'nganh' : 'phu_trach';
            const otherSel = tongQuanState.alerts[otherKey];
            let all = [];
            if (allAlerts) {
                Object.keys(allAlerts).forEach(k => { if (selL.length === 0 || selL.includes(k)) all.push(...allAlerts[k]); });
            }
            opts = [...new Set(all.filter(i => otherSel.length === 0 || otherSel.includes(i[otherKey])).map(i => i[key]).filter(Boolean))].sort();
        }
    } else if (ctx === 'inventory') {
        const isNotAdmin = currentUser.phan_quyen !== 'Admin';
        const allowedBUs = (currentUser.xem_data || '').split(',').map(s => s.trim()).filter(Boolean);
        let q = sb.from('ton_kho_update').select('nganh').gt('ton_cuoi', 0);
        if (isNotAdmin) {
            const cond = allowedBUs.length > 0 ? `phu_trach.eq."${currentUser.ho_ten}",nganh.in.(${allowedBUs.map(n => `"${n}"`).join(',')})` : `phu_trach.eq."${currentUser.ho_ten}"`;
            q = q.or(cond);
        }
        const { data } = await q;
        opts = [...new Set((data || []).map(i => i.nganh).filter(Boolean))].sort();
    } else if (ctx === 'hierarchy' || ctx === 'analytics') {
        if (key === 'nguoi_nhan') {
            const presetEl = document.getElementById('tq-ana-time-preset');
            const { start, end } = getRangeDates(presetEl ? presetEl.value : 'all');
            let q1 = sb.from('chi_tiet').select('id').gte('thoi_gian', start).lte('thoi_gian', end);
            const filter = tongQuanState.analytics;
            if (filter.bu.length > 0) q1 = q1.in('nganh', filter.bu); 
            if (filter.yeu_cau.length > 0) q1 = q1.in('yeu_cau', filter.yeu_cau);
            if (filter.ma_vt.length > 0) q1 = q1.in('ma_vt', filter.ma_vt);
            
            // Áp dụng phân quyền khi lấy danh sách filter
            if (currentUser.phan_quyen !== 'Admin') {
                const allowed = (currentUser.xem_data || '').split(',').map(s => s.trim()).filter(Boolean);
                if (allowed.length > 0) q1 = q1.in('nganh', allowed);
                else q1 = q1.eq('phu_trach', currentUser.ho_ten);
            }

            const { data: v1Rows } = await q1.order('thoi_gian', { ascending: false }).limit(2000);
            const v1Ids = (v1Rows || []).map(r => r.id);
            
            if (v1Ids.length > 0) {
                // CHUNKING: Chia nhỏ v1Ids để lấy danh sách người nhận (tránh lỗi 400)
                const vtNames = new Set();
                const chunkSize = 500;
                for (let i = 0; i < v1Ids.length; i += chunkSize) {
                    const chunk = v1Ids.slice(i, i + chunkSize);
                    const { data: vtRows } = await sb.from('chi_tiet_vt').select('nguoi_nhan').in('id_ct', chunk);
                    if (vtRows) vtRows.forEach(v => { if(v.nguoi_nhan) vtNames.add(v.nguoi_nhan.trim()); });
                }
                opts = [...vtNames].sort();
            }
        } else {
            const presetId = ctx === 'hierarchy' ? 'tq-hierarchy-time-preset' : 'tq-ana-time-preset';
            const presetEl = document.getElementById(presetId);
            const { start, end } = getRangeDates(presetEl ? presetEl.value : 'all');
            let q = sb.from('chi_tiet_v1').select(key).gte('thoi_gian', start).lte('thoi_gian', end);
            
            if (ctx === 'hierarchy' && tongQuanState.hierarchy.mode === 'nhap') q = q.gt('nhap', 0); 
            else q = q.gt('yc_sl', 0);

            if (currentUser.phan_quyen !== 'Admin') {
                const allowedBUs = (currentUser.xem_data || '').split(',').map(s => s.trim()).filter(Boolean);
                if (allowedBUs.length > 0) q = q.in('bu', allowedBUs);
            }
            Object.keys(tongQuanState[ctx]).forEach(k => {
                if (k !== key && Array.isArray(tongQuanState[ctx][k]) && tongQuanState[ctx][k].length > 0 && k !== 'nguoi_nhan') {
                    q = q.in(k, tongQuanState[ctx][k]);
                }
            });
            const { data } = await q.limit(2000);
            opts = [...new Set((data || []).map(i => i[key]).filter(Boolean))].sort();
        }
    }

    render(opts);
    search.oninput = () => render(opts);
    list.onchange = e => { if(e.target.checked) temp.add(e.target.value); else temp.delete(e.target.value); render(opts); };
    toggle.onclick = () => { const term = search.value.toLowerCase(); const vis = opts.filter(o => String(o).toLowerCase().includes(term)); const isAll = toggle.textContent === 'Tất cả'; vis.forEach(o => isAll?temp.add(String(o)):temp.delete(String(o))); render(opts); };
    apply.onclick = () => {
        tongQuanState[ctx][key] = [...temp]; updateFilterButtons();
        if (ctx === 'alerts') filterAlertsAndRender();
        else if (ctx === 'inventory') renderInventoryStatusChart(tongQuanState.inventory.nganh);
        else if (ctx === 'hierarchy') fetchAndRenderHierarchy(tongQuanState, false);
        else if (ctx === 'analytics') fetchAndRenderAnalytics();
        pop.remove();
    };
    document.addEventListener('click', function c(e) { if(!pop.contains(e.target) && e.target !== button) { pop.remove(); document.removeEventListener('click', c); } }, 0);
}

async function fetchAndRenderAnalytics() {
    const presetEl = document.getElementById('tq-ana-time-preset');
    const { start, end } = getRangeDates(presetEl ? presetEl.value : 'all');
    const filter = tongQuanState.analytics;
    const isNotAdmin = currentUser.phan_quyen !== 'Admin';
    const allowedBUs = (currentUser.xem_data || '').split(',').map(s => s.trim()).filter(Boolean);

    try {
        // 1. Fetch chi_tiet_v1 for Region
        let q = sb.from('chi_tiet_v1').select('*').gte('thoi_gian', start).lte('thoi_gian', end);
        if (filter.bu.length > 0) q = q.in('bu', filter.bu);
        if (filter.yeu_cau.length > 0) q = q.in('yeu_cau', filter.yeu_cau);
        if (filter.ma_vt.length > 0) q = q.in('ma_vt', filter.ma_vt);
        
        if (isNotAdmin) {
            if (allowedBUs.length > 0) q = q.in('bu', allowedBUs);
            else q = q.eq('phu_trach', currentUser.ho_ten);
        }
        
        const { data: v1Rows, error: v1Err } = await q.order('thoi_gian', { ascending: false }).limit(2000);
        if (v1Err) throw v1Err;

        const regionMap = {};
        (v1Rows || []).forEach(row => {
            const reg = row.khu_vuc || 'CHƯA PHÂN VÙNG';
            if (!regionMap[reg]) regionMap[reg] = { nhap: 0, xuat: 0, thieu: 0 };
            const nhap = parseFloat(row.nhap) || 0, xuat = parseFloat(row.xuat) || 0, ycsl = parseFloat(row.yc_sl) || 0;
            const shortage = (row.ma_nx && row.ma_nx.includes('DO')) ? Math.max(0, ycsl - xuat) : 0;
            regionMap[reg].nhap += nhap; regionMap[reg].xuat += xuat; regionMap[reg].thieu += shortage;
        });
        renderRegionLineChart(regionMap);

        // 2. Fetch Recipients với Chunking (Tránh lỗi 400 Bad Request URI Too Long)
        let qIds = sb.from('chi_tiet').select('id, ma_vt').gte('thoi_gian', start).lte('thoi_gian', end);
        if (filter.bu.length > 0) qIds = qIds.in('nganh', filter.bu);
        if (filter.yeu_cau.length > 0) qIds = qIds.in('yeu_cau', filter.yeu_cau);
        if (filter.ma_vt.length > 0) qIds = qIds.in('ma_vt', filter.ma_vt);
        
        if (isNotAdmin) {
            if (allowedBUs.length > 0) qIds = qIds.in('nganh', allowedBUs);
            else qIds = qIds.eq('phu_trach', currentUser.ho_ten);
        }

        const { data: idsRows } = await qIds.order('thoi_gian', { ascending: false }).limit(2000); 
        const v1Ids = (idsRows || []).map(r => r.id);
        
        if (v1Ids.length === 0) {
            renderRecipientStackedBarChart({});
            renderRecipientHierarchyList({});
            return;
        }

        const vtRows = [];
        const chunkSize = 500;
        for (let i = 0; i < v1Ids.length; i += chunkSize) {
            const chunk = v1Ids.slice(i, i + chunkSize);
            let qVt = sb.from('chi_tiet_vt').select('id_ct, nguoi_nhan, sl, dia_diem').in('id_ct', chunk);
            if (filter.nguoi_nhan.length > 0) qVt = qVt.in('nguoi_nhan', filter.nguoi_nhan);
            const { data: chunkData, error: chunkErr } = await qVt;
            if (chunkErr) throw chunkErr;
            if (chunkData) vtRows.push(...chunkData);
        }

        const recipientData = {};
        const vtToMaVtMap = new Map(idsRows.map(r => [r.id, r.ma_vt]));

        (vtRows || []).forEach(vt => {
            const name = (vt.nguoi_nhan || 'ẨN DANH').trim();
            const maVt = vtToMaVtMap.get(vt.id_ct) || 'N/A';
            const loc = (vt.dia_diem || 'CHƯA RÕ').trim();
            const sl = parseFloat(vt.sl) || 0;
            if (!recipientData[name]) recipientData[name] = { total: 0, skus: {} };
            recipientData[name].total += sl;
            if (!recipientData[name].skus[maVt]) recipientData[name].skus[maVt] = { total: 0, locations: {} };
            recipientData[name].skus[maVt].total += sl;
            recipientData[name].skus[maVt].locations[loc] = (recipientData[name].skus[maVt].locations[loc] || 0) + sl;
        });

        const chartData = {};
        Object.keys(recipientData).forEach(name => {
            chartData[name] = { counts: {}, skuCount: Object.keys(recipientData[name].skus).length };
            Object.keys(recipientData[name].skus).forEach(ma => { chartData[name].counts[ma] = recipientData[name].skus[ma].total; });
        });

        renderRecipientStackedBarChart(chartData);
        renderRecipientHierarchyList(recipientData);
    } catch (err) { console.error("Analytics Error:", err); }
}

function renderRecipientHierarchyList(data) {
    const container = document.getElementById('tq-recipient-hierarchy-list');
    if (!container) return;
    
    const sortedNames = Object.keys(data).sort((a,b) => data[b].total - data[a].total);
    if (sortedNames.length === 0) {
        container.innerHTML = '<div class="p-4 text-center text-gray-400 italic">Không có dữ liệu người nhận.</div>';
        return;
    }

    const buildList = (obj, level, path) => {
        const fragment = document.createDocumentFragment();
        const keys = Object.keys(obj).sort((a, b) => {
            const valA = (typeof obj[a] === 'number' ? obj[a] : obj[a].total);
            const valB = (typeof obj[b] === 'number' ? obj[b] : obj[b].total);
            return valB - valA;
        });

        keys.forEach(key => {
            const item = obj[key];
            const currentPath = path ? `${path}|${key}` : key;
            const isExp = expandedRecipientPaths.has(currentPath);
            const val = (typeof item === 'number' ? item : item.total);
            const hasChildren = typeof item === 'object' && (item.skus || item.locations);
            
            const node = document.createElement('div');
            node.className = 'tree-node mb-1' + (isExp ? ' expanded' : '');
            
            const content = document.createElement('div');
            content.className = `tree-node-content flex items-center justify-between p-2 rounded-lg hover:bg-white/70 transition-all cursor-pointer border border-transparent hover:border-blue-100 ${level === 0 ? 'bg-white/40 font-bold shadow-sm' : ''}`;
            
            let color = 'text-gray-700';
            if (level === 0) color = 'text-indigo-900';
            else if (level === 1) color = 'text-blue-600';
            else color = 'text-gray-500 italic';

            content.innerHTML = `
                <div class="flex items-center gap-2 overflow-hidden">
                    ${hasChildren ? `<svg class="tree-toggle-icon w-3.5 h-3.5 text-gray-400" fill="currentColor" viewBox="0 0 24 24"><path d="M10 12a1 1 0 01-.707-.293l-4-4a1 1 0 111.414-1.414L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4A1 1 0 0110 12z"></path></svg>` : '<span class="w-3.5"></span>'}
                    <span class="${color} truncate text-[10px] md:text-[13px] tracking-tighter">${key}</span>
                </div>
                <span class="text-[10px] md:text-xs font-black text-gray-900 ml-2 bg-white/50 px-1.5 py-0.5 rounded">${val.toLocaleString()}</span>
            `;

            content.onclick = (e) => {
                e.stopPropagation();
                const nowExp = node.classList.toggle('expanded');
                const childDiv = node.querySelector('.tree-children');
                if (nowExp) {
                    expandedRecipientPaths.add(currentPath);
                    childDiv.classList.remove('hidden');
                    if (childDiv.innerHTML === '') {
                        if (item.skus) childDiv.appendChild(buildList(item.skus, level + 1, currentPath));
                        else if (item.locations) childDiv.appendChild(buildList(item.locations, level + 1, currentPath));
                    }
                } else {
                    expandedRecipientPaths.delete(currentPath);
                    childDiv.classList.add('hidden');
                }
            };

            node.appendChild(content);
            const childDiv = document.createElement('div');
            childDiv.className = 'tree-children pl-4 ml-2 border-l border-gray-200 ' + (isExp ? '' : 'hidden');
            if (isExp) {
                if (item.skus) childDiv.appendChild(buildList(item.skus, level + 1, currentPath));
                else if (item.locations) childDiv.appendChild(buildList(item.locations, level + 1, currentPath));
            }
            node.appendChild(childDiv);
            fragment.appendChild(node);
        });
        return fragment;
    };

    container.innerHTML = '';
    container.appendChild(buildList(data, 0, ''));
}

function filterAlertsAndRender() {
    if (!allAlerts) return;
    const mapLoai = { 'Sắp hết hàng': 'lowStock', 'Tồn kho lâu': 'slowMoving', 'Cận date': 'urgentExpiry' };
    const selL = tongQuanState.alerts.loai.map(l => mapLoai[l]), selN = tongQuanState.alerts.nganh, selP = tongQuanState.alerts.phu_trach;
    const filtered = {};
    Object.keys(allAlerts).forEach(k => {
        filtered[k] = allAlerts[k].filter(i => 
            (selL.length === 0 || selL.includes(k)) && 
            (selN.length === 0 || selN.includes(i.nganh)) && 
            (selP.length === 0 || selP.includes(i.phu_trach))
        );
    });
    renderAlerts(filtered);
}

export async function fetchTongQuanData() {
    try {
        const isNotAdmin = currentUser.phan_quyen !== 'Admin', name = currentUser.ho_ten;
        const allowedBUs = (currentUser.xem_data || '').split(',').map(s => s.trim()).filter(Boolean);
        const hasGatePermission = allowedBUs.includes('EES') || allowedBUs.includes('ESC') || currentUser.phan_quyen === 'Admin';
        
        const hierarchySection = document.getElementById('tq-hierarchy-container')?.closest('.bg-white');
        if (hierarchySection) hierarchySection.classList.toggle('hidden', !hasGatePermission);

        const analyticsSection = document.getElementById('tq-analytics-section');
        if (analyticsSection) analyticsSection.classList.toggle('hidden', !hasGatePermission);

        let spQ = sb.from('san_pham').select('ma_vt', { count: 'exact', head: true }), tkQ = sb.from('ton_kho_update').select('ma_vt, date, ton_cuoi, tinh_trang, nganh, phu_trach');
        if (isNotAdmin) { 
            const cond = allowedBUs.length > 0 ? `phu_trach.eq."${name}",nganh.in.(${allowedBUs.map(n => `"${n}"`).join(',')})` : `phu_trach.eq."${name}"`; 
            spQ = spQ.or(cond); tkQ = tkQ.or(cond); 
        }
        const [spRes, tkRes] = await Promise.all([spQ, tkQ]);
        const tk = tkRes.data || [];
        
        const totalProducts = spRes.count ?? 0;
        const totalStock = tk.reduce((s,i) => s+(i.ton_cuoi||0), 0);
        document.getElementById('tq-stat-san-pham').textContent = totalProducts.toLocaleString();
        document.getElementById('tq-sub-stat-san-pham').textContent = `Tồn kho: ${totalStock.toLocaleString()}`;

        const canDate = tk.filter(i => i.tinh_trang === 'Từ 1-30 ngày' && i.ton_cuoi > 0);
        const canDateQty = canDate.reduce((s,i) => s+(i.ton_cuoi||0), 0);
        document.getElementById('tq-stat-can-date').textContent = `${new Set(canDate.map(i=>i.ma_vt)).size} mã`;
        document.getElementById('tq-sub-stat-can-date').textContent = `Số lượng: ${canDateQty.toLocaleString()}`;

        const hetHan = tk.filter(i => i.tinh_trang === 'Hết hạn sử dụng' && i.ton_cuoi > 0);
        const hetHanQty = hetHan.reduce((s,i) => s+(i.ton_cuoi||0), 0);
        document.getElementById('tq-stat-het-han').textContent = `${new Set(hetHan.map(i=>i.ma_vt)).size} mã`;
        document.getElementById('tq-sub-stat-het-han').textContent = `Số lượng: ${hetHanQty.toLocaleString()}`;

        const thirtyAgo = new Date(); thirtyAgo.setDate(new Date().getDate() - 30);
        let ctQ = sb.from('chi_tiet').select('id, thoi_gian, nhap, xuat, nganh, phu_trach').gte('thoi_gian', thirtyAgo.toISOString());
        if (isNotAdmin) {
            const cond = allowedBUs.length > 0 ? `phu_trach.eq."${name}",nganh.in.(${allowedBUs.map(n => `"${n}"`).join(',')})` : `phu_trach.eq."${name}"`;
            ctQ = ctQ.or(cond);
        }
        
        const [ctRes, alertsData] = await Promise.all([ctQ, fetchAlerts()]);
        last30DaysData = ctRes.data || []; allAlerts = alertsData;

        renderActivityChart(last30DaysData, chartMode); 
        filterAlertsAndRender(); 
        renderInventoryStatusChart(tongQuanState.inventory.nganh);
        
        if (hasGatePermission) {
            fetchAndRenderAnalytics();
            isHierarchyFirstLoad = await fetchAndRenderHierarchy(tongQuanState, isHierarchyFirstLoad);
        }
        updateFilterButtons();
    } catch (e) { console.error(e); }
}

export function initTongQuanView() {
    const v = document.getElementById('view-phat-trien'); if(!v || v.dataset.attached) return;
    v.addEventListener('click', e => {
        const fBtn = e.target.closest('.filter-btn'); if (fBtn) { openFilter(fBtn); return; }
        
        const anaTBtn = e.target.closest('#tq-ana-time-filter-btn');
        if (anaTBtn) {
            const template = document.getElementById('filter-popover-template'); if (!template) return;
            const pop = template.content.cloneNode(true).querySelector('.filter-popover'); document.body.appendChild(pop);
            const rect = anaTBtn.getBoundingClientRect(); pop.style.left = `${rect.left}px`; pop.style.top = `${rect.bottom + window.scrollY + 5}px`;
            pop.querySelector('.filter-search-input').classList.add('hidden');
            const opts = [{v:'all',l:'Tất cả'},{v:'today',l:'Hôm nay'},{v:'week',l:'Tuần này'},{v:'month',l:'Tháng này'},{v:'quarter',l:'Quý này'},{v:'year',l:'Năm nay'},{v:'custom',l:'Tùy chọn'}];
            const presetEl = document.getElementById('tq-ana-time-preset');
            const cur = presetEl ? presetEl.value : 'all';
            pop.querySelector('.filter-options-list').innerHTML = opts.map(p => `<label class="flex items-center space-x-2 px-2 py-2 hover:bg-blue-50 rounded cursor-pointer border-b border-gray-50 last:border-0"><input type="radio" name="ana-tp" value="${p.v}" ${p.v===cur?'checked':''}><span class="text-sm">${p.l}</span></label>`).join('');
            pop.querySelector('.filter-options-list').onchange = ev => { 
                const pEl = document.getElementById('tq-ana-time-preset');
                if (pEl) pEl.value = ev.target.value; 
                updateFilterButtons(); fetchAndRenderAnalytics(); pop.remove(); 
            };
            document.addEventListener('click', function c(ev) { if(!pop.contains(ev.target) && ev.target !== anaTBtn) { pop.remove(); document.removeEventListener('click', c); } }, 0);
            return;
        }

        const tBtn = e.target.closest('#tq-hierarchy-time-filter-btn'); if (tBtn) {
            const template = document.getElementById('filter-popover-template'); if (!template) return;
            const pop = template.content.cloneNode(true).querySelector('.filter-popover'); document.body.appendChild(pop);
            const rect = tBtn.getBoundingClientRect(); pop.style.left = `${rect.left}px`; pop.style.top = `${rect.bottom + window.scrollY + 5}px`;
            pop.querySelector('.filter-search-input').classList.add('hidden');
            const opts = [{v:'all',l:'Tất cả'},{v:'today',l:'Hôm nay'},{v:'week',l:'Tuần này'},{v:'month',l:'Tháng này'},{v:'quarter',l:'Quý này'},{v:'year',l:'Năm nay'},{v:'custom',l:'Tùy chọn'}];
            const presetEl = document.getElementById('tq-hierarchy-time-preset');
            const cur = presetEl ? presetEl.value : 'all';
            pop.querySelector('.filter-options-list').innerHTML = opts.map(p => `<label class="flex items-center space-x-2 px-2 py-2 hover:bg-blue-50 rounded cursor-pointer border-b border-gray-50 last:border-0"><input type="radio" name="tp" value="${p.v}" ${p.v===cur?'checked':''}><span class="text-sm">${p.l}</span></label>`).join('');
            pop.querySelector('.filter-options-list').onchange = e => { 
                const pEl = document.getElementById('tq-hierarchy-time-preset');
                if (pEl) pEl.value = e.target.value; 
                const customDatesEl = document.getElementById('tq-hierarchy-custom-dates');
                if (customDatesEl) customDatesEl.classList.toggle('hidden', e.target.value!=='custom'); 
                updateFilterButtons(); fetchAndRenderHierarchy(tongQuanState, false); pop.remove(); 
            };
            document.addEventListener('click', function c(ev) { if(!pop.contains(ev.target) && ev.target !== tBtn) { pop.remove(); document.removeEventListener('click', c); } }, 0);
            return;
        }

        const sBtn = e.target.closest('.submode-pill'); if (sBtn) {
            tongQuanState.hierarchy.subMode = sBtn.dataset.submode;
            document.querySelectorAll('.submode-pill').forEach(b => { const isA = b === sBtn; b.classList.toggle('bg-blue-600', isA); b.classList.toggle('text-white', isA); b.classList.toggle('bg-gray-50', !isA); b.classList.toggle('text-gray-400', !isA); });
            fetchAndRenderHierarchy(tongQuanState, false); return;
        }

        const card = e.target.closest('[id^="tq-card-"]'); if (card) {
            const s = viewStates['view-ton-kho']; s.searchTerm = ''; Object.keys(s.filters).forEach(k => s.filters[k]=[]);
            if(card.id==='tq-card-can-date') s.filters.tinh_trang = ['Từ 1-30 ngày']; else if(card.id==='tq-card-het-han') s.filters.tinh_trang = ['Hết hạn sử dụng'];
            showView('view-ton-kho');
        }

        const modeChartBtn = e.target.closest('#tq-ana-recipient-view-chart');
        const modeListBtn = e.target.closest('#tq-ana-recipient-view-list');
        if (modeChartBtn || modeListBtn) {
            analyticsRecipientView = (modeChartBtn ? 'chart' : 'list');
            const cBtn = document.getElementById('tq-ana-recipient-view-chart'), lBtn = document.getElementById('tq-ana-recipient-view-list');
            const isChart = analyticsRecipientView === 'chart';
            
            cBtn.className = isChart ? 'p-1 px-2.5 rounded-md text-[9px] font-bold transition-all bg-blue-600 text-white shadow-sm' : 'p-1 px-2.5 rounded-md text-[9px] font-bold transition-all text-gray-400 hover:text-blue-600';
            lBtn.className = !isChart ? 'p-1 px-2.5 rounded-md text-[9px] font-bold transition-all bg-blue-600 text-white shadow-sm' : 'p-1 px-2.5 rounded-md text-[9px] font-bold transition-all text-gray-400 hover:text-blue-600';
            
            const chartCanvas = document.getElementById('tq-recipient-stacked-bar-chart');
            const listDiv = document.getElementById('tq-recipient-hierarchy-list');
            
            if (isChart) {
                chartCanvas.style.display = 'block';
                listDiv.classList.add('hidden');
            } else {
                chartCanvas.style.display = 'none';
                listDiv.classList.remove('hidden');
            }
        }
    });

    const refreshBtn = document.getElementById('tq-ana-refresh-btn');
    if (refreshBtn) {
        refreshBtn.onclick = () => {
            tongQuanState.analytics = { bu: [], yeu_cau: [], ma_vt: [], nguoi_nhan: [] };
            const presetEl = document.getElementById('tq-ana-time-preset');
            if (presetEl) presetEl.value = 'all';
            fetchAndRenderAnalytics(); updateFilterButtons();
        };
    }

    const hRefreshBtn = document.getElementById('tq-hierarchy-refresh-btn');
    if (hRefreshBtn) {
        hRefreshBtn.onclick = () => {
            expandedHierarchyPaths.clear(); tongQuanState.hierarchy.ma_vt = []; tongQuanState.hierarchy.yeu_cau = []; tongQuanState.hierarchy.subMode = 'all'; 
            const presetEl = document.getElementById('tq-hierarchy-time-preset');
            if (presetEl) presetEl.value = 'all';
            const customDatesEl = document.getElementById('tq-hierarchy-custom-dates');
            if (customDatesEl) customDatesEl.classList.add('hidden'); 
            fetchAndRenderHierarchy(tongQuanState, false); updateFilterButtons(); showToast("Đã làm mới phả hệ.");
        };
    }

    const setHMode = (m) => { tongQuanState.hierarchy.mode = m; fetchAndRenderHierarchy(tongQuanState, false); };
    const hModeXuat = document.getElementById('tq-hierarchy-mode-xuat');
    if (hModeXuat) hModeXuat.onclick = () => setHMode('xuat');
    const hModeNhap = document.getElementById('tq-hierarchy-mode-nhap');
    if (hModeNhap) hModeNhap.onclick = () => setHMode('nhap');

    const chartModeQty = document.getElementById('tq-chart-mode-quantity');
    if (chartModeQty) {
        chartModeQty.onclick = (e) => { 
            chartMode = 'quantity'; 
            e.target.classList.add('bg-gray-200','font-semibold'); 
            document.getElementById('tq-chart-mode-transaction').classList.remove('bg-gray-200','font-semibold'); 
            renderActivityChart(last30DaysData, chartMode); 
        };
    }

    const chartModeTrans = document.getElementById('tq-chart-mode-transaction');
    if (chartModeTrans) {
        chartModeTrans.onclick = (e) => { 
            chartMode = 'transaction'; 
            e.target.classList.add('bg-gray-200','font-semibold'); 
            document.getElementById('tq-chart-mode-quantity').classList.remove('bg-gray-200','font-semibold'); 
            renderActivityChart(last30DaysData, chartMode); 
        };
    }

    v.dataset.attached = 'true';
}