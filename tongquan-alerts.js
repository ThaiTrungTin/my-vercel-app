
import { sb, currentUser, showView, viewStates } from './app.js';

export async function fetchAlerts() {
    const isNotAdmin = currentUser.phan_quyen !== 'Admin', name = currentUser.ho_ten;
    const allowed = (currentUser.xem_data || '').split(',').filter(Boolean);
    const sixtyAgo = new Date(); sixtyAgo.setDate(sixtyAgo.getDate() - 60);
    const today = new Date(); today.setHours(0,0,0,0);
    const urgentLimit = new Date(); urgentLimit.setDate(today.getDate() + 30);

    let stockQ = sb.from('ton_kho_update').select('ma_vach, ma_vt, ten_vt, ton_cuoi, nganh, phu_trach').gt('ton_cuoi', 0);
    let moveQ = sb.from('chi_tiet').select('ma_vach').eq('loai', 'Xuat').gte('thoi_gian', sixtyAgo.toISOString());
    let expQ = sb.from('ton_kho_update').select('ma_vt, ten_vt, lot, date, nganh, phu_trach').eq('tinh_trang', 'Cận date').gt('ton_cuoi', 0);

    if (isNotAdmin) {
        const cond = allowed.length > 0 ? `phu_trach.eq."${name}",nganh.in.(${allowed.map(n => `"${n}"`).join(',')})` : `phu_trach.eq."${name}"`;
        stockQ = stockQ.or(cond); expQ = expQ.or(cond);
    }
    const [sRes, mRes, eRes] = await Promise.all([stockQ, moveQ, expQ]);
    const stockMap = new Map();
    (sRes.data || []).forEach(i => { if(!stockMap.has(i.ma_vt)) stockMap.set(i.ma_vt, {...i, sum: 0}); stockMap.get(i.ma_vt).sum += i.ton_cuoi; });
    const low = [...stockMap.values()].filter(i => i.sum > 0 && i.sum <= 10).slice(0, 10);
    const recent = new Set((mRes.data || []).map(i => i.ma_vach));
    const slow = (sRes.data || []).filter(i => !recent.has(i.ma_vach)).slice(0, 5);
    const parse = (d) => { if(!d || !/^\d{2}\/\d{2}\/\d{4}$/.test(d)) return null; const [dd,mm,yy] = d.split('/').map(Number); return new Date(yy,mm-1,dd); };
    const urgent = (eRes.data || []).filter(i => { const d = parse(i.date); return d && d >= today && d <= urgentLimit; }).slice(0, 10);
    return { lowStock: low, slowMoving: slow, urgentExpiry: urgent };
}

export function renderAlerts(alerts) {
    const list = document.getElementById('tq-alerts-list');
    if (!list) return;
    list.innerHTML = '';
    const add = (icon, text, info, action, val) => {
        const li = document.createElement('li');
        li.className = 'flex items-center space-x-3 p-3 rounded-xl hover:bg-gray-50 transition-all cursor-pointer border border-transparent hover:border-blue-100 group';
        li.onclick = () => {
            const [view, key] = action.split(':');
            const s = viewStates[`view-${view}`];
            if(s) { 
                s.searchTerm = ''; Object.keys(s.filters).forEach(k => s.filters[k] = Array.isArray(s.filters[k])?[]:'');
                s.filters[key] = [val]; if(view==='ton-kho') s.stockAvailability = 'available';
                showView(`view-${view}`);
            }
        };
        li.innerHTML = `${icon}<div class="flex-grow min-w-0"><span class="text-[11px] md:text-sm text-gray-700 leading-tight">${text}</span></div>
            <div class="flex-shrink-0 text-right text-[8px] md:text-[10px] text-gray-400 ml-2 w-24 md:w-32"><p class="truncate font-bold text-blue-400">${info.nganh || 'N/A'}</p><p class="truncate">${info.phu_trach || 'N/A'}</p></div>`;
        list.appendChild(li);
    };
    const I = {
        L: `<div class="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center flex-shrink-0 text-yellow-600"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1-1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2a1 1 0 011 1v8a1 1 0 01-1 h-2a1 1 0 01-1-1z"></path></svg></div>`,
        S: `<div class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 text-blue-600"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div>`,
        E: `<div class="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 text-red-600"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg></div>`
    };
    alerts.lowStock.forEach(i => add(I.L, `Sắp hết: <strong>${i.ma_vt}</strong> còn <strong>${i.sum}</strong>.`, i, 'ton-kho:ma_vt', i.ma_vt));
    alerts.slowMoving.forEach(i => add(I.S, `Tồn lâu: <strong>${i.ma_vt}</strong> (>60 ngày).`, i, 'ton-kho:ma_vt', i.ma_vt));
    alerts.urgentExpiry.forEach(i => add(I.E, `Cận date: <strong>${i.lot}</strong> (${i.ma_vt}) - <strong>${i.date}</strong>.`, i, 'ton-kho:lot', i.lot));
    if (list.innerHTML === '') list.innerHTML = '<li class="p-8 text-center text-gray-400 italic">Mọi thứ đều ổn định!</li>';
}
