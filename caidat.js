
import { sb, cache, currentUser, showLoading, showToast, showConfirm, DEFAULT_AVATAR_URL, updateSidebarAvatar, sanitizeFileName, onlineUsers, lastSeenMap, openAutocomplete } from './app.js';

let selectedAvatarFile = null;

const AVAILABLE_VIEWS = [
    { id: 'view-phat-trien', label: 'Tổng Quan' },
    { id: 'view-san-pham', label: 'Sản Phẩm' },
    { id: 'view-ton-kho', label: 'Tồn Kho' },
    { id: 'view-chi-tiet', label: 'Chi Tiết' }
];

/**
 * Hàm mở Droplist Checklist (Popover) - Tối ưu Mobile nhỏ gọn
 */
function openMultiSelectDroplist(button, options, currentSelected, onApply) {
    if (!button) return;
    const oldPopover = document.getElementById('settings-droplist-popover');
    if (oldPopover) oldPopover.remove();

    const popover = document.createElement('div');
    popover.id = 'settings-droplist-popover';
    const isMobile = window.innerWidth <= 768;
    
    popover.className = isMobile 
        ? 'fixed inset-x-6 top-24 bottom-24 z-[100] bg-white border border-gray-200 rounded-2xl shadow-2xl p-3 flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300'
        : 'fixed z-[100] bg-white border border-gray-200 rounded-xl shadow-2xl p-4 flex flex-col w-[380px] animate-in fade-in zoom-in duration-200';
    
    if (!isMobile) {
        const rect = button.getBoundingClientRect();
        let top = rect.bottom + window.scrollY + 8;
        let left = rect.left;
        if (left + 380 > window.innerWidth) left = window.innerWidth - 400;
        if (top + 350 > window.innerHeight + window.scrollY) top = rect.top + window.scrollY - 360;
        popover.style.top = `${Math.max(10, top)}px`;
        popover.style.left = `${Math.max(10, left)}px`;
    }

    const selectedSet = new Set(currentSelected.map(s => s.trim()).filter(Boolean));

    popover.innerHTML = `
        <div class="flex items-center justify-between mb-2 border-b pb-2">
            <h4 class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Danh mục & Phụ trách</h4>
            <button id="droplist-close" class="text-gray-400 hover:text-gray-600 text-xl px-2">&times;</button>
        </div>
        <div class="mb-2">
            <input type="text" id="droplist-search" placeholder="Tìm nhanh..." class="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-blue-500">
        </div>
        <div id="droplist-items" class="max-h-[240px] overflow-y-auto space-y-0.5 no-scrollbar pr-1 border-b pb-2">
            ${options.map(opt => `
                <label class="flex items-center p-2 hover:bg-blue-50 rounded-lg cursor-pointer transition-all active:bg-blue-100 group border-b border-gray-50 last:border-0">
                    <input type="checkbox" value="${opt.id}" class="droplist-cb w-4 h-4 rounded text-blue-600 border-gray-300 mr-2.5" ${selectedSet.has(opt.id) ? 'checked' : ''}>
                    <div class="flex-grow flex justify-between items-center min-w-0">
                        <span class="text-xs font-bold text-gray-700 truncate group-hover:text-blue-700">${opt.label}</span>
                        <span class="text-[9px] font-medium text-gray-400 italic ml-2 flex-shrink-0">${opt.subInfo || ''}</span>
                    </div>
                </label>
            `).join('')}
        </div>
        <div class="mt-2 flex justify-between items-center gap-2">
            <button id="droplist-clear" class="text-[9px] font-bold text-red-400 px-1 uppercase">Xóa hết</button>
            <button id="droplist-apply" class="flex-1 bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 shadow-md active:scale-95 transition-all uppercase text-[10px]">Xác nhận</button>
        </div>
    `;

    document.body.appendChild(popover);

    const searchInput = popover.querySelector('#droplist-search');
    searchInput.focus();
    searchInput.oninput = (e) => {
        const term = e.target.value.toLowerCase();
        popover.querySelectorAll('#droplist-items label').forEach(label => {
            label.classList.toggle('hidden', !label.textContent.toLowerCase().includes(term));
        });
    };

    popover.querySelector('#droplist-close').onclick = () => popover.remove();
    popover.querySelector('#droplist-clear').onclick = () => popover.querySelectorAll('.droplist-cb').forEach(cb => cb.checked = false);
    popover.querySelector('#droplist-apply').onclick = () => {
        const checkedValues = Array.from(popover.querySelectorAll('.droplist-cb:checked')).map(cb => cb.value);
        onApply(checkedValues);
        popover.remove();
    };

    const closeHandler = (e) => {
        if (!isMobile && !popover.contains(e.target) && !button.contains(e.target)) {
            popover.remove();
            document.removeEventListener('mousedown', closeHandler);
        }
    };
    if (!isMobile) document.addEventListener('mousedown', closeHandler);
}

// Hiển thị khoảng thời gian kể từ timestamp ISO (ví dụ "2 giờ trước")
function formatTimeAgo(isoString) {
    try {
        const then = new Date(isoString).getTime();
        const now = Date.now();
        const diff = Math.max(0, Math.floor((now - then) / 1000)); // seconds
        if (diff < 60) return `${diff}s trước`;
        const mins = Math.floor(diff / 60);
        if (mins < 60) return `${mins} phút trước`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours} giờ trước`;
        const days = Math.floor(hours / 24);
        return `${days} ngày trước`;
    } catch (e) {
        return '';
    }
}

async function handleProfileUpdate(e) {
    e.preventDefault();
    const ho_ten = document.getElementById('profile-ho-ten').value.trim();
    const old_password = document.getElementById('profile-old-password').value;
    const new_password = document.getElementById('profile-new-password').value;
    const confirm_password = document.getElementById('profile-confirm-password').value;
    let anh_dai_dien_url = document.getElementById('profile-current-avatar-url').value;

    showLoading(true);
    try {
        // NÂNG CẤP: Kiểm tra mật khẩu cũ trực tiếp từ DB thay vì dựa vào session
        const { data: dbUser, error: fetchError } = await sb.from('user').select('mat_khau').eq('gmail', currentUser.gmail).single();
        if (fetchError || !dbUser) throw new Error("Không thể xác thực người dùng.");

        if (dbUser.mat_khau !== old_password) {
            showToast("Mật khẩu cũ không chính xác.", 'error');
            showLoading(false);
            return;
        }

        if (new_password && new_password !== confirm_password) {
            showToast("Mật khẩu mới không khớp.", 'error');
            showLoading(false);
            return;
        }

        if (selectedAvatarFile) {
            const fileName = sanitizeFileName(`${currentUser.gmail}-${Date.now()}-${selectedAvatarFile.name}`);
            const { error: uploadError } = await sb.storage.from('anh_dai_dien').upload(`public/${fileName}`, selectedAvatarFile);
            if (uploadError) throw uploadError;
            const { data: urlData } = sb.storage.from('anh_dai_dien').getPublicUrl(`public/${fileName}`);
            anh_dai_dien_url = urlData.publicUrl;
        } 

        const updateData = { ho_ten, anh_dai_dien_url };
        if (new_password) updateData.mat_khau = new_password;

        const { data, error } = await sb.from('user').update(updateData).eq('gmail', currentUser.gmail).select().single();
        if (error) throw error;

        Object.assign(currentUser, data);
        sessionStorage.setItem('loggedInUser', JSON.stringify(data));
        
        document.getElementById('user-ho-ten').textContent = data.ho_ten;
        updateSidebarAvatar(data.anh_dai_dien_url);
        initProfileAvatarState();
        
        // Reset trường mật khẩu sau khi lưu thành công
        document.getElementById('profile-old-password').value = '';
        document.getElementById('profile-new-password').value = '';
        document.getElementById('profile-confirm-password').value = '';
        
        showToast("Đã cập nhật thông tin cá nhân!", "success");
    } catch (err) { 
        showToast(err.message, 'error'); 
    } finally { 
        showLoading(false); 
    }
}

export async function fetchUsers() {
    const [{ data: users }, { data: nganhData }] = await Promise.all([
        sb.from('user').select('*').order('ho_ten'),
        sb.from('san_pham').select('nganh, phu_trach')
    ]);
    const industryMap = new Map();
    (nganhData || []).forEach(item => { if (item.nganh && !industryMap.has(item.nganh)) industryMap.set(item.nganh, item.phu_trach || ''); });
    const enrichedNganh = Array.from(industryMap, ([nganh, pt]) => ({ id: nganh, label: nganh, subInfo: pt })).sort((a,b) => a.label.localeCompare(b.label));
    cache.userList = users;
    // populate lastSeenMap from persisted DB values so last-online survives reloads
    try {
        (users || []).forEach(u => {
            if (u && u.gmail && u.last_online_at) {
                lastSeenMap.set(u.gmail, u.last_online_at);
            }
        });
    } catch (e) {
        console.debug('populate lastSeenMap error', e);
    }
    renderUserList(users, enrichedNganh);
}

function renderUserList(users, allNganhEnriched) {
    const container = document.getElementById('user-list-body');
    if (!container) return;
    container.innerHTML = '';

    users.forEach(user => {
        const isMe = user.gmail === currentUser.gmail;
        const viewCnt = (user.xem_view || '').split(',').filter(Boolean).length;
        const dataCnt = (user.xem_data || '').split(',').filter(Boolean).length;
        const isLocked = user.stt === 'Khóa';
        
        // Kiểm tra trạng thái hiện diện (online/away) và thời gian hoạt động gần nhất
        const presence = onlineUsers.get(user.gmail);
        const status = presence ? (presence.status || 'online') : 'offline';
        let statusDotClass = 'bg-gray-300'; // Mặc định offline
        if (status === 'online') statusDotClass = 'bg-green-500';
        else if (status === 'away') statusDotClass = 'bg-yellow-400';
        const lastSeenIso = (presence && presence.online_at) ? presence.online_at : (lastSeenMap.get(user.gmail) || '');
        const lastSeenText = lastSeenIso ? formatTimeAgo(lastSeenIso) : '';

        const card = document.createElement('div');
        card.className = `bg-white border ${isLocked ? 'border-red-100 bg-red-50/20' : 'border-gray-100'} rounded-xl p-3 shadow-sm transition-all hover:border-indigo-100`;
        
        card.innerHTML = `
            <div class="flex flex-col gap-3">
                <div class="flex items-center gap-2.5">
                    <div class="relative flex-shrink-0">
                        <img src="${user.anh_dai_dien_url || DEFAULT_AVATAR_URL}" class="w-10 h-10 rounded-full object-cover border border-white shadow-sm">
                        <span class="absolute -bottom-0.5 -right-0.5 block h-2.5 w-2.5 rounded-full ${statusDotClass} ring-2 ring-white"></span>
                    </div>
                    <div class="flex-grow min-w-0">
                        <h4 class="font-bold text-gray-900 text-xs truncate flex items-center gap-1">
                            ${user.ho_ten}
                            ${isLocked ? '<span class="text-[7px] bg-red-500 text-white px-1 py-0.5 rounded font-black">KHÓA</span>' : ''}
                        </h4>
                        <p class="text-[9px] text-gray-400 truncate">${user.gmail}</p>
                    </div>
                    <div class="relative">
                        <button data-gmail="${user.gmail}" class="user-options-btn p-1.5 text-gray-300 hover:bg-gray-50 rounded-lg">
                            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"></path></svg>
                        </button>
                        <div id="popover-${user.gmail.replace(/[@.]/g, '')}" class="hidden absolute right-0 top-8 w-40 bg-white rounded-xl shadow-2xl border border-gray-100 py-1.5 z-50 overflow-hidden">
                            <button class="reset-password-btn flex items-center gap-2 w-full px-3 py-2 text-[10px] text-gray-600 hover:bg-blue-50" data-gmail="${user.gmail}">
                                <svg class="w-3.5 h-3.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"></path></svg>
                                Reset mật khẩu
                            </button>
                            <button class="user-status-option flex items-center gap-2 w-full px-3 py-2 text-[10px] ${isLocked ? 'text-green-600' : 'text-orange-600'} hover:bg-gray-50" data-gmail="${user.gmail}" data-status="${isLocked ? 'Đã Duyệt' : 'Khóa'}">
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                                ${isLocked ? 'Mở khóa' : 'Khóa tài khoản'}
                            </button>
                            <div class="h-px bg-gray-50 mx-2 my-1"></div>
                            <button class="user-delete-option flex items-center gap-2 w-full px-3 py-2 text-[10px] text-red-500 font-bold hover:bg-red-50" data-gmail="${user.gmail}">
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                Xóa vĩnh viễn
                            </button>
                        </div>
                    </div>
                </div>

                <div class="flex items-center justify-between px-1 bg-gray-50/50 rounded-lg p-1.5">
                    <div class="flex flex-col">
                        <span class="text-[7px] font-black text-gray-400 uppercase tracking-widest">Quyền hạn</span>
                        <span class="text-[9px] italic text-gray-400">${status === 'offline' ? `Ngoại tuyến${lastSeenText ? ' • ' + lastSeenText : ''}` : (status === 'away' ? `Vắng mặt${lastSeenText ? ' • ' + lastSeenText : ''}` : 'Đang hoạt động')}</span>
                    </div>
                    <select data-gmail="${user.gmail}" class="user-role-select bg-white border border-gray-100 rounded-lg px-2 py-1 text-[11px] font-black text-blue-600 outline-none focus:ring-1 focus:ring-blue-500 shadow-sm" ${isMe ? 'disabled' : ''}>
                        <option value="Admin" ${user.phan_quyen === 'Admin' ? 'selected' : ''}>Admin</option>
                        <option value="User" ${user.phan_quyen === 'User' ? 'selected' : ''}>User</option>
                        <option value="View" ${user.phan_quyen === 'View' ? 'selected' : ''}>View</option>
                    </select>
                </div>

                <div class="grid grid-cols-2 gap-2">
                    <button class="trigger-view-list flex flex-col items-center gap-0.5 p-2 bg-gray-50 hover:bg-blue-50 border border-gray-100 rounded-xl transition-all active:scale-95" data-gmail="${user.gmail}">
                        <span class="text-[7px] font-black text-gray-400 uppercase">Menu View</span>
                        <div class="flex items-center justify-center gap-1 w-full">
                            <span class="text-[11px] font-black text-gray-700">${viewCnt}</span>
                            <svg class="w-2.5 h-2.5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" stroke-width="2" stroke-linecap="round"></path></svg>
                        </div>
                    </button>
                    <button class="trigger-data-list flex flex-col items-center gap-0.5 p-2 bg-gray-50 hover:bg-blue-50 border border-gray-100 rounded-xl transition-all active:scale-95" data-gmail="${user.gmail}">
                        <span class="text-[7px] font-black text-gray-400 uppercase">Dữ liệu ngành</span>
                        <div class="flex items-center justify-center gap-1 w-full">
                            <span class="text-[11px] font-black text-gray-700">${dataCnt}</span>
                            <svg class="w-2.5 h-2.5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" stroke-width="2" stroke-linecap="round"></path></svg>
                        </div>
                    </button>
                </div>
            </div>
        `;

        card.querySelector('.trigger-view-list').onclick = (e) => {
            openMultiSelectDroplist(e.currentTarget, AVAILABLE_VIEWS, (user.xem_view || '').split(','), async (vals) => {
                showLoading(true);
                await sb.from('user').update({ xem_view: vals.join(',') }).eq('gmail', user.gmail);
                fetchUsers();
                showLoading(false);
            });
        };

        card.querySelector('.trigger-data-list').onclick = (e) => {
            openMultiSelectDroplist(e.currentTarget, allNganhEnriched, (user.xem_data || '').split(','), async (vals) => {
                showLoading(true);
                await sb.from('user').update({ xem_data: vals.join(',') }).eq('gmail', user.gmail);
                fetchUsers();
                showLoading(false);
            });
        };

        container.appendChild(card);
    });
}

async function handleUpdateUserStatus(gmail, status) {
    showLoading(true);
    const { error } = await sb.from('user').update({ stt: status }).eq('gmail', gmail);
    showLoading(false);
    if (!error) { showToast(status === 'Khóa' ? "Đã khóa." : "Đã mở.", 'success'); fetchUsers(); }
}

async function handleDeleteUser(gmail) {
    const confirmed = await showConfirm(`Xóa tài khoản ${gmail}?`);
    if (!confirmed) return;
    showLoading(true);
    const { error } = await sb.from('user').delete().eq('gmail', gmail);
    showLoading(false);
    if (!error) { showToast("Đã xóa.", 'success'); fetchUsers(); }
}

function openPasswordResetModal(gmail) {
    document.getElementById('reset-user-gmail').value = gmail;
    document.getElementById('reset-user-gmail-display').textContent = gmail;
    document.getElementById('password-reset-modal').classList.remove('hidden');
}

async function handlePasswordReset(e) {
    e.preventDefault();
    const gmail = document.getElementById('reset-user-gmail').value;
    const pwd = document.getElementById('reset-new-password').value;
    showLoading(true);
    const { error } = await sb.from('user').update({ mat_khau: pwd }).eq('gmail', gmail);
    showLoading(false);
    if (!error) {
        showToast("Đã đổi MK.", 'success');
        document.getElementById('password-reset-modal').classList.add('hidden');
        document.getElementById('password-reset-form').reset();
    }
}

export async function initProfileAvatarState() {
    selectedAvatarFile = null;
    const preview = document.getElementById('profile-image-preview');
    const removeBtn = document.getElementById('profile-remove-image-btn');
    const urlInput = document.getElementById('profile-current-avatar-url');
    preview.src = currentUser.anh_dai_dien_url || DEFAULT_AVATAR_URL;
    urlInput.value = currentUser.anh_dai_dien_url || '';
    removeBtn.classList.toggle('hidden', !currentUser.anh_dai_dien_url);

    const container = document.getElementById('profile-user-data-access-container');
    if (currentUser.phan_quyen === 'User') {
        container.classList.remove('hidden');
        renderProfileDataTrigger();
    } else {
        container.classList.add('hidden');
    }
}

async function renderProfileDataTrigger() {
    const optionsContainer = document.getElementById('profile-xem-data-options');
    if (!optionsContainer) return;
    optionsContainer.className = "mt-2";
    const dataCount = (currentUser.xem_data || '').split(',').filter(Boolean).length;
    
    optionsContainer.innerHTML = `
        <button type="button" id="profile-data-droplist-btn" class="w-full flex justify-between items-center bg-white border border-blue-100 p-2.5 rounded-xl active:bg-blue-50 transition-all shadow-sm">
            <div class="flex items-center space-x-2.5">
                <div class="bg-blue-600 p-1.5 rounded-lg shadow-sm">
                    <svg class="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                </div>
                <div class="text-left">
                    <p class="text-[11px] font-bold text-gray-800 leading-tight">Ngành theo dõi</p>
                    <p class="text-[9px] text-gray-400 font-medium">Đã chọn: <span class="text-blue-600">${dataCount}</span></p>
                </div>
            </div>
            <svg class="w-3.5 h-3.5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"></path></svg>
        </button>
    `;

    document.getElementById('profile-data-droplist-btn').onclick = async (e) => {
        const targetBtn = e.currentTarget;
        showLoading(true);
        try {
            const { data: nganhData } = await sb.from('san_pham').select('nganh, phu_trach');
            const industryMap = new Map();
            (nganhData || []).forEach(item => { if (item.nganh && !industryMap.has(item.nganh)) industryMap.set(item.nganh, item.phu_trach || ''); });
            const enrichedNganh = Array.from(industryMap, ([nganh, pt]) => ({ id: nganh, label: nganh, subInfo: pt })).sort((a,b) => a.label.localeCompare(b.label));
            showLoading(false);
            openMultiSelectDroplist(targetBtn, enrichedNganh, (currentUser.xem_data || '').split(','), async (vals) => {
                showLoading(true);
                const { data, error } = await sb.from('user').update({ xem_data: vals.join(',') }).eq('gmail', currentUser.gmail).select().single();
                if (!error) {
                    Object.assign(currentUser, data);
                    sessionStorage.setItem('loggedInUser', JSON.stringify(data));
                    renderProfileDataTrigger();
                    showToast("Đã lưu.", "success");
                }
                showLoading(false);
            });
        } catch (err) { showLoading(false); showToast("Lỗi tải.", "error"); }
    };
}

async function handleBackupExcel() {
    const confirmed = await showConfirm("Tải Excel backup?");
    if (!confirmed) return;
    showLoading(true);
    try {
        const tables = ['user', 'san_pham', 'ton_kho', 'chi_tiet'];
        const wb = XLSX.utils.book_new();
        for (const table of tables) {
            const { data } = await sb.from(table).select('*').limit(50000);
            if (data) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), table);
        }
        XLSX.writeFile(wb, `Backup_${new Date().toISOString().slice(0, 10)}.xlsx`);
        showToast("Xong.", "success");
    } catch (e) { showToast(e.message, "error"); }
    finally { showLoading(false); }
}

export function initCaiDatView() {
    document.getElementById('profile-form').addEventListener('submit', handleProfileUpdate);
    document.getElementById('user-list-body').addEventListener('change', e => {
        if (e.target.classList.contains('user-role-select')) {
            const gmail = e.target.dataset.gmail;
            const newRole = e.target.value;
            sb.from('user').update({ phan_quyen: newRole }).eq('gmail', gmail).then(() => {
                showToast("Đã đổi quyền.", "success");
                fetchUsers();
            });
        }
    });

    document.getElementById('user-list-body').addEventListener('click', e => {
        const optBtn = e.target.closest('.user-options-btn');
        if (optBtn) {
            const gmail = optBtn.dataset.gmail;
            const popId = `popover-${gmail.replace(/[@.]/g, '')}`;
            document.querySelectorAll('[id^="popover-"]').forEach(p => { if (p.id !== popId) p.classList.add('hidden'); });
            document.getElementById(popId).classList.toggle('hidden');
            return;
        }
        const resetBtn = e.target.closest('.reset-password-btn');
        if (resetBtn) { openPasswordResetModal(resetBtn.dataset.gmail); return; }
        const statusBtn = e.target.closest('.user-status-option');
        if (statusBtn) handleUpdateUserStatus(statusBtn.dataset.gmail, statusBtn.dataset.status);
        const delBtn = e.target.closest('.user-delete-option');
        if (delBtn) handleDeleteUser(delBtn.dataset.gmail);
    });

    document.getElementById('password-reset-form').addEventListener('submit', handlePasswordReset);
    document.getElementById('cancel-reset-btn').onclick = () => document.getElementById('password-reset-modal').classList.add('hidden');
    document.getElementById('backup-excel-btn').onclick = handleBackupExcel;

    const processAvatar = (file) => {
        if (file && file.type.startsWith('image/')) {
            selectedAvatarFile = file;
            const reader = new FileReader();
            reader.onload = (e) => {
                document.getElementById('profile-image-preview').src = e.target.result;
                document.getElementById('profile-remove-image-btn').classList.remove('hidden');
                document.getElementById('profile-current-avatar-url').value = 'new';
            };
            reader.readAsDataURL(file);
        }
    };
    document.getElementById('profile-image-upload').onchange = (e) => processAvatar(e.target.files[0]);
    document.getElementById('profile-image-paste-area').onpaste = (e) => {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) { if (items[i].type.indexOf('image') !== -1) processAvatar(items[i].getAsFile()); }
    };
    document.getElementById('profile-remove-image-btn').onclick = () => {
        selectedAvatarFile = null;
        document.getElementById('profile-image-preview').src = DEFAULT_AVATAR_URL;
        document.getElementById('profile-remove-image-btn').classList.add('hidden');
        document.getElementById('profile-current-avatar-url').value = '';
    };

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.user-options-btn') && !e.target.closest('[id^="popover-"]')) {
            document.querySelectorAll('[id^="popover-"]').forEach(p => p.classList.add('hidden'));
        }
    });
}
