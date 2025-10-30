// Supabase Configuration
const SUPABASE_URL = 'YOUR_SUPABASE_URL'; // Replace with your Supabase URL
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY'; // Replace with your Supabase Anon Key

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Global App State
const app = {
    currentUser: null,
    currentView: 'donhang',
    donhangData: [],
    chitietData: [],
    sanphamData: [],
    usersData: [],
    
    // Pagination State
    donhangPage: 1,
    donhangPageSize: 50,
    chitietPage: 1,
    chitietPageSize: 50,
    
    // Filter State
    chitietFilters: {
        search: '',
        maNX: [],
        loai: [],
        maSP: [],
        tenSP: [],
        phuTrach: []
    },
    
    // Modal State
    currentDonHang: null,
    currentProducts: [],
    
    // Initialize App
    async init() {
        console.log('Initializing app...');
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
            this.currentUser = session.user;
            await this.loadUserProfile();
            await this.showMainApp();
        } else {
            this.showLoginScreen();
        }
        
        // Setup event listeners
        this.setupEventListeners();
    },
    
    setupEventListeners() {
        // Chi Tiết search
        const searchInput = document.getElementById('chitiet-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.chitietFilters.search = e.target.value;
                this.applyChiTietFilters();
            });
        }
        
        // Close filter panels when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.custom-filter-toggle') && !e.target.closest('.custom-filter-panel')) {
                document.querySelectorAll('.custom-filter-panel').forEach(panel => {
                    panel.classList.add('hidden');
                });
            }
        });
    },
    
    // Authentication
    showLoginScreen() {
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('main-app').classList.add('hidden');
    },
    
    showMainApp() {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        this.loadAllData();
        this.updateUIByRole();
    },
    
    showLogin() {
        document.getElementById('login-form').classList.remove('hidden');
        document.getElementById('register-form').classList.add('hidden');
    },
    
    showRegister() {
        document.getElementById('login-form').classList.add('hidden');
        document.getElementById('register-form').classList.remove('hidden');
    },
    
    async login() {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        
        if (!email || !password) {
            this.showToast('Vui lòng nhập email và mật khẩu', 'error');
            return;
        }
        
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        
        if (error) {
            this.showToast('Đăng nhập thất bại: ' + error.message, 'error');
            return;
        }
        
        this.currentUser = data.user;
        await this.loadUserProfile();
        this.showToast('Đăng nhập thành công!', 'success');
        this.showMainApp();
    },
    
    async register() {
        const name = document.getElementById('register-name').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const confirm = document.getElementById('register-confirm').value;
        
        if (!name || !email || !password || !confirm) {
            this.showToast('Vui lòng điền đầy đủ thông tin', 'error');
            return;
        }
        
        if (password !== confirm) {
            this.showToast('Mật khẩu không khớp', 'error');
            return;
        }
        
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { name, role: 'user' }
            }
        });
        
        if (error) {
            this.showToast('Đăng ký thất bại: ' + error.message, 'error');
            return;
        }
        
        // Create user profile
        await supabase.from('users').insert([{
            id: data.user.id,
            email,
            name,
            role: 'user'
        }]);
        
        this.showToast('Đăng ký thành công! Vui lòng đăng nhập.', 'success');
        this.showLogin();
    },
    
    async logout() {
        await supabase.auth.signOut();
        this.currentUser = null;
        this.showLoginScreen();
        this.showToast('Đã đăng xuất', 'success');
    },
    
    async loadUserProfile() {
        const { data } = await supabase
            .from('users')
            .select('*')
            .eq('id', this.currentUser.id)
            .single();
        
        if (data) {
            this.currentUser.profile = data;
            document.getElementById('user-name').textContent = data.name;
        }
    },
    
    // UI Updates based on Role
    updateUIByRole() {
        const isAdmin = this.currentUser?.profile?.role === 'admin';
        
        // Show/hide buttons based on role
        const addButtons = ['btn-add-donhang', 'btn-add-user'];
        addButtons.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.classList.toggle('hidden', !isAdmin);
            }
        });
        
        // Hide user action column for non-admin
        const actionHeader = document.getElementById('user-action-header');
        if (actionHeader) {
            actionHeader.classList.toggle('hidden', !isAdmin);
        }
    },
    
    // Load Data
    async loadAllData() {
        await Promise.all([
            this.loadDonHang(),
            this.loadChiTiet(),
            this.loadSanPham(),
            this.loadUsers()
        ]);
    },
    
    async loadDonHang() {
        const { data, error } = await supabase
            .from('don_hang')
            .select('*')
            .order('thoi_gian', { ascending: false });
        
        if (!error && data) {
            this.donhangData = data;
            this.renderDonHang();
        }
    },
    
    async loadChiTiet() {
        const { data, error } = await supabase
            .from('chi_tiet')
            .select('*')
            .order('thoi_gian', { ascending: false });
        
        if (!error && data) {
            this.chitietData = data;
            this.updateChiTietFilters();
            this.renderChiTiet();
        }
    },
    
    async loadSanPham() {
        const { data, error } = await supabase
            .from('san_pham')
            .select('*');
        
        if (!error && data) {
            this.sanphamData = data;
            this.populateYeuCauDropdown();
        }
    },
    
    async loadUsers() {
        const { data, error } = await supabase
            .from('users')
            .select('*');
        
        if (!error && data) {
            this.usersData = data;
            this.renderUsers();
        }
    },
    
    // View Switching
    switchView(viewName) {
        // Update tabs
        document.querySelectorAll('.nav-link').forEach(tab => {
            tab.classList.remove('active');
        });
        document.getElementById(`tab-${viewName}`).classList.add('active');
        
        // Update views
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });
        document.getElementById(`view-${viewName}`).classList.add('active');
        
        this.currentView = viewName;
        
        // Load data for specific view
        if (viewName === 'caidat') {
            this.loadProfileData();
        }
    },
    
    // Đơn Hàng Functions
    renderDonHang() {
        const tbody = document.getElementById('donhang-table-body');
        if (!tbody) return;
        
        const start = (this.donhangPage - 1) * this.donhangPageSize;
        const end = this.donhangPageSize === 9999 ? this.donhangData.length : start + this.donhangPageSize;
        const pageData = this.donhangData.slice(start, end);
        
        tbody.innerHTML = pageData.map((item, index) => `
            <tr class="selectable-row hover:bg-gray-50">
                <td class="td">${start + index + 1}</td>
                <td class="td">${this.formatDateTime(item.thoi_gian)}</td>
                <td class="td">${item.ma_nx}</td>
                <td class="td ${item.loai === 'Nhập' ? 'text-nhap' : 'text-xuat'}">${item.loai}</td>
                <td class="td">${item.yeu_cau || ''}</td>
                <td class="td">${item.muc_dich || ''}</td>
                <td class="td">${item.ghi_chu || ''}</td>
                <td class="td">
                    ${this.currentUser?.profile?.role === 'admin' ? `
                        <button onclick="app.editDonHang('${item.id}')" class="text-blue-600 hover:underline mr-2">Sửa</button>
                        <button onclick="app.deleteDonHang('${item.id}')" class="text-red-600 hover:underline">Xóa</button>
                    ` : ''}
                </td>
            </tr>
        `).join('');
        
        this.renderDonHangPagination();
    },
    
    renderDonHangPagination() {
        const container = document.getElementById('donhang-pagination');
        if (!container) return;
        
        const totalPages = Math.ceil(this.donhangData.length / this.donhangPageSize);
        
        if (totalPages <= 1) {
            container.innerHTML = '';
            return;
        }
        
        let html = '';
        for (let i = 1; i <= totalPages; i++) {
            html += `<button onclick="app.goToDonHangPage(${i})" 
                class="px-3 py-1 rounded ${i === this.donhangPage ? 'bg-blue-600 text-white' : 'bg-gray-200'}">${i}</button>`;
        }
        
        container.innerHTML = html;
    },
    
    goToDonHangPage(page) {
        this.donhangPage = page;
        this.renderDonHang();
    },
    
    changeDonHangPageSize() {
        this.donhangPageSize = parseInt(document.getElementById('donhang-page-size').value);
        this.donhangPage = 1;
        this.renderDonHang();
    },
    
    openDonHangModal(id = null) {
        this.currentDonHang = id;
        const modal = document.getElementById('modal-donhang');
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        
        if (id) {
            // Edit mode
            this.loadDonHangForEdit(id);
            document.getElementById('modal-donhang-title').textContent = 'Sửa Đơn Hàng';
        } else {
            // Add mode
            document.getElementById('modal-donhang-title').textContent = 'Thêm Đơn Hàng';
            this.resetDonHangForm();
        }
    },
    
    closeDonHangModal() {
        document.getElementById('modal-donhang').classList.add('hidden');
        document.getElementById('modal-donhang').classList.remove('flex');
        this.currentDonHang = null;
        this.currentProducts = [];
    },
    
    resetDonHangForm() {
        // Set current time
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        document.getElementById('donhang-time').value = now.toISOString().slice(0, 16);
        
        document.getElementById('donhang-loai').value = 'Xuất';
        document.getElementById('donhang-yeucau').selectedIndex = 0;
        document.getElementById('donhang-mucdich').value = '';
        document.getElementById('donhang-ghichu').value = '';
        
        this.currentProducts = [];
        this.generateMaNX();
        this.renderProductList();
    },
    
    async loadDonHangForEdit(id) {
        const donhang = this.donhangData.find(d => d.id === id);
        if (!donhang) return;
        
        // Set form values
        const time = new Date(donhang.thoi_gian);
        time.setMinutes(time.getMinutes() - time.getTimezoneOffset());
        document.getElementById('donhang-time').value = time.toISOString().slice(0, 16);
        
        document.getElementById('donhang-loai').value = donhang.loai;
        document.getElementById('donhang-manx').value = donhang.ma_nx;
        document.getElementById('donhang-yeucau').value = donhang.yeu_cau || '';
        document.getElementById('donhang-mucdich').value = donhang.muc_dich || '';
        document.getElementById('donhang-ghichu').value = donhang.ghi_chu || '';
        
        // Load products from chi_tiet
        const { data } = await supabase
            .from('chi_tiet')
            .select('*')
            .eq('ma_nx', donhang.ma_nx);
        
        if (data) {
            this.currentProducts = data.map(item => ({
                ma_sp: item.ma_sp,
                ten_sp: item.ten_sp,
                so_luong: item.nhap || item.xuat || 0
            }));
            this.renderProductList();
        }
    },
    
    generateMaNX() {
        const loai = document.getElementById('donhang-loai').value;
        const prefix = loai === 'Nhập' ? 'IN.JNJ.' : 'OUT.JNJ.';
        const random = Math.floor(100000 + Math.random() * 900000);
        document.getElementById('donhang-manx').value = prefix + random;
    },
    
    populateYeuCauDropdown() {
        const select = document.getElementById('donhang-yeucau');
        if (!select) return;
        
        // Get unique phu_trach values from san_pham
        const phuTrachSet = new Set();
        this.sanphamData.forEach(sp => {
            if (sp.phu_trach) {
                sp.phu_trach.split(',').forEach(pt => phuTrachSet.add(pt.trim()));
            }
        });
        
        select.innerHTML = '<option value="">Chọn người yêu cầu</option>' + 
            Array.from(phuTrachSet).map(pt => `<option value="${pt}">${pt}</option>`).join('');
    },
    
    addProductRow() {
        this.currentProducts.push({
            ma_sp: '',
            ten_sp: '',
            so_luong: 0
        });
        this.renderProductList();
    },
    
    renderProductList() {
        const tbody = document.getElementById('product-list-body');
        if (!tbody) return;
        
        tbody.innerHTML = this.currentProducts.map((product, index) => `
            <tr id="product-row-${index}">
                <td class="td">${index + 1}</td>
                <td class="td">
                    <select onchange="app.updateProduct(${index}, 'ma_sp', this.value)" class="w-full p-1 border rounded">
                        <option value="">Chọn sản phẩm</option>
                        ${this.sanphamData.map(sp => 
                            `<option value="${sp.ma_sp}" ${product.ma_sp === sp.ma_sp ? 'selected' : ''}>${sp.ma_sp}</option>`
                        ).join('')}
                    </select>
                </td>
                <td class="td">${product.ten_sp}</td>
                <td class="td">
                    <input type="number" value="${product.so_luong}" 
                        onchange="app.updateProduct(${index}, 'so_luong', this.value)"
                        class="w-full p-1 border rounded" min="0">
                </td>
                <td class="td">
                    <button onclick="app.removeProduct(${index})" class="text-red-600 hover:underline">Xóa</button>
                </td>
            </tr>
            <tr id="stock-info-${index}" class="bg-blue-50">
                <td colspan="5" class="td text-sm text-gray-600"></td>
            </tr>
        `).join('');
        
        // Update stock info for each product
        this.currentProducts.forEach((product, index) => {
            if (product.ma_sp) {
                this.updateStockInfo(index);
            }
        });
    },
    
    updateProduct(index, field, value) {
        this.currentProducts[index][field] = value;
        
        if (field === 'ma_sp') {
            // Auto-fill ten_sp
            const sanpham = this.sanphamData.find(sp => sp.ma_sp === value);
            if (sanpham) {
                this.currentProducts[index].ten_sp = sanpham.ten_sp;
            }
            this.renderProductList();
        } else if (field === 'so_luong') {
            this.updateStockInfo(index);
        }
    },
    
    async updateStockInfo(index) {
        const product = this.currentProducts[index];
        const stockInfoCell = document.querySelector(`#stock-info-${index} td`);
        if (!stockInfoCell || !product.ma_sp) return;
        
        // Calculate current stock from chi_tiet
        const { data } = await supabase
            .from('chi_tiet')
            .select('nhap, xuat')
            .eq('ma_sp', product.ma_sp);
        
        let currentStock = 0;
        if (data) {
            data.forEach(item => {
                currentStock += (item.nhap || 0) - (item.xuat || 0);
            });
        }
        
        const loai = document.getElementById('donhang-loai').value;
        const soLuong = parseInt(product.so_luong) || 0;
        const afterStock = loai === 'Nhập' ? currentStock + soLuong : currentStock - soLuong;
        
        let message = `Tồn kho hiện tại: ${currentStock} | Tồn kho sau ${loai.toLowerCase()}: ${afterStock}`;
        
        if (loai === 'Xuất' && soLuong > currentStock) {
            message += ' <span class="text-red-600 font-bold">(Vượt quá tồn kho!)</span>';
        }
        
        stockInfoCell.innerHTML = message;
    },
    
    removeProduct(index) {
        this.currentProducts.splice(index, 1);
        this.renderProductList();
    },
    
    async saveDonHang() {
        // Validate
        const thoi_gian = document.getElementById('donhang-time').value;
        const loai = document.getElementById('donhang-loai').value;
        const ma_nx = document.getElementById('donhang-manx').value;
        const yeu_cau = document.getElementById('donhang-yeucau').value;
        const muc_dich = document.getElementById('donhang-mucdich').value;
        const ghi_chu = document.getElementById('donhang-ghichu').value;
        
        if (!thoi_gian || !yeu_cau) {
            this.showToast('Vui lòng điền đầy đủ thông tin', 'error');
            return;
        }
        
        if (this.currentProducts.length === 0) {
            this.showToast('Vui lòng thêm ít nhất một sản phẩm', 'error');
            return;
        }
        
        // Validate stock for export
        if (loai === 'Xuất') {
            for (const product of this.currentProducts) {
                const { data } = await supabase
                    .from('chi_tiet')
                    .select('nhap, xuat')
                    .eq('ma_sp', product.ma_sp);
                
                let currentStock = 0;
                if (data) {
                    data.forEach(item => {
                        currentStock += (item.nhap || 0) - (item.xuat || 0);
                    });
                }
                
                if (product.so_luong > currentStock) {
                    this.showToast(`Số lượng xuất vượt quá tồn kho cho ${product.ma_sp}`, 'error');
                    return;
                }
            }
        }
        
        try {
            // Save don_hang
            const donhangData = {
                thoi_gian,
                loai,
                ma_nx,
                yeu_cau,
                muc_dich,
                ghi_chu
            };
            
            if (this.currentDonHang) {
                // Update
                await supabase
                    .from('don_hang')
                    .update(donhangData)
                    .eq('id', this.currentDonHang);
                
                // Delete old chi_tiet
                await supabase
                    .from('chi_tiet')
                    .delete()
                    .eq('ma_nx', ma_nx);
            } else {
                // Insert
                donhangData.id = this.generateUUID();
                await supabase
                    .from('don_hang')
                    .insert([donhangData]);
            }
            
            // Save chi_tiet
            const chitietData = [];
            for (const product of this.currentProducts) {
                const sanpham = this.sanphamData.find(sp => sp.ma_sp === product.ma_sp);
                
                chitietData.push({
                    id: this.generateUUID(),
                    thoi_gian,
                    ma_nx,
                    loai,
                    ma_sp: product.ma_sp,
                    ten_sp: product.ten_sp,
                    nhap: loai === 'Nhập' ? product.so_luong : null,
                    xuat: loai === 'Xuất' ? product.so_luong : null,
                    ghi_chu,
                    phu_trach: sanpham?.phu_trach || ''
                });
            }
            
            await supabase
                .from('chi_tiet')
                .insert(chitietData);
            
            this.showToast('Lưu thành công!', 'success');
            this.closeDonHangModal();
            await this.loadDonHang();
            await this.loadChiTiet();
        } catch (error) {
            this.showToast('Lỗi khi lưu: ' + error.message, 'error');
        }
    },
    
    async editDonHang(id) {
        this.openDonHangModal(id);
    },
    
    async deleteDonHang(id) {
        if (!confirm('Bạn có chắc muốn xóa đơn hàng này?')) return;
        
        const donhang = this.donhangData.find(d => d.id === id);
        if (!donhang) return;
        
        // Delete chi_tiet first
        await supabase
            .from('chi_tiet')
            .delete()
            .eq('ma_nx', donhang.ma_nx);
        
        // Delete don_hang
        await supabase
            .from('don_hang')
            .delete()
            .eq('id', id);
        
        this.showToast('Xóa thành công!', 'success');
        await this.loadDonHang();
        await this.loadChiTiet();
    },
    
    // Chi Tiết Functions
    updateChiTietFilters() {
        // Populate filter options
        const filters = {
            'ma-nx': new Set(),
            'loai': new Set(),
            'ma-sp': new Set(),
            'ten-sp': new Set(),
            'phu-trach': new Set()
        };
        
        this.chitietData.forEach(item => {
            if (item.ma_nx) filters['ma-nx'].add(item.ma_nx);
            if (item.loai) filters['loai'].add(item.loai);
            if (item.ma_sp) filters['ma-sp'].add(item.ma_sp);
            if (item.ten_sp) filters['ten-sp'].add(item.ten_sp);
            if (item.phu_trach) {
                item.phu_trach.split(',').forEach(pt => filters['phu-trach'].add(pt.trim()));
            }
        });
        
        // Render filter lists
        Object.keys(filters).forEach(filterKey => {
            this.renderFilterList(filterKey, Array.from(filters[filterKey]).sort());
        });
    },
    
    renderFilterList(filterKey, options) {
        const list = document.getElementById(`filter-${filterKey}-list`);
        if (!list) return;
        
        const currentSelections = this.chitietFilters[this.toCamelCase(filterKey)] || [];
        
        list.innerHTML = options.map(option => `
            <div class="custom-filter-item" onclick="app.toggleFilterOption('${filterKey}', '${option}')">
                <input type="checkbox" ${currentSelections.includes(option) ? 'checked' : ''} 
                    onchange="event.stopPropagation(); app.toggleFilterOption('${filterKey}', '${option}')">
                <label>${option}</label>
            </div>
        `).join('');
    },
    
    toggleFilter(filterKey) {
        const panel = document.getElementById(`filter-${filterKey}-panel`);
        const isHidden = panel.classList.contains('hidden');
        
        // Close all other panels
        document.querySelectorAll('.custom-filter-panel').forEach(p => {
            p.classList.add('hidden');
        });
        
        // Toggle current panel
        if (isHidden) {
            panel.classList.remove('hidden');
        }
    },
    
    toggleFilterOption(filterKey, option) {
        const camelKey = this.toCamelCase(filterKey);
        const index = this.chitietFilters[camelKey].indexOf(option);
        
        if (index === -1) {
            this.chitietFilters[camelKey].push(option);
        } else {
            this.chitietFilters[camelKey].splice(index, 1);
        }
        
        this.updateFilterText(filterKey);
        this.applyChiTietFilters();
    },
    
    updateFilterText(filterKey) {
        const camelKey = this.toCamelCase(filterKey);
        const text = document.getElementById(`filter-${filterKey}-text`);
        const selected = this.chitietFilters[camelKey];
        
        if (selected.length === 0) {
            text.textContent = 'Tất cả';
        } else if (selected.length === 1) {
            text.textContent = selected[0];
        } else {
            text.textContent = `${selected.length} mục`;
        }
    },
    
    filterOptions(filterKey, searchTerm) {
        const list = document.getElementById(`filter-${filterKey}-list`);
        const items = list.querySelectorAll('.custom-filter-item');
        
        items.forEach(item => {
            const label = item.querySelector('label').textContent.toLowerCase();
            item.style.display = label.includes(searchTerm.toLowerCase()) ? '' : 'none';
        });
    },
    
    applyChiTietFilters() {
        let filtered = [...this.chitietData];
        
        // Apply search
        if (this.chitietFilters.search) {
            const search = this.chitietFilters.search.toLowerCase();
            filtered = filtered.filter(item => 
                Object.values(item).some(val => 
                    val && val.toString().toLowerCase().includes(search)
                )
            );
        }
        
        // Apply filters
        if (this.chitietFilters.maNX.length > 0) {
            filtered = filtered.filter(item => this.chitietFilters.maNX.includes(item.ma_nx));
        }
        if (this.chitietFilters.loai.length > 0) {
            filtered = filtered.filter(item => this.chitietFilters.loai.includes(item.loai));
        }
        if (this.chitietFilters.maSP.length > 0) {
            filtered = filtered.filter(item => this.chitietFilters.maSP.includes(item.ma_sp));
        }
        if (this.chitietFilters.tenSP.length > 0) {
            filtered = filtered.filter(item => this.chitietFilters.tenSP.includes(item.ten_sp));
        }
        if (this.chitietFilters.phuTrach.length > 0) {
            filtered = filtered.filter(item => {
                if (!item.phu_trach) return false;
                return item.phu_trach.split(',').some(pt => 
                    this.chitietFilters.phuTrach.includes(pt.trim())
                );
            });
        }
        
        this.renderChiTiet(filtered);
    },
    
    renderChiTiet(data = null) {
        const tbody = document.getElementById('chitiet-table-body');
        if (!tbody) return;
        
        const displayData = data || this.chitietData;
        const start = (this.chitietPage - 1) * this.chitietPageSize;
        const end = this.chitietPageSize === 9999 ? displayData.length : start + this.chitietPageSize;
        const pageData = displayData.slice(start, end);
        
        tbody.innerHTML = pageData.map((item, index) => `
            <tr class="hover:bg-gray-50">
                <td class="td">${start + index + 1}</td>
                <td class="td">${this.formatDateTime(item.thoi_gian)}</td>
                <td class="td">${item.ma_nx}</td>
                <td class="td">${item.ma_sp}</td>
                <td class="td">${item.ten_sp}</td>
                <td class="td ${item.loai === 'Nhập' ? 'text-nhap' : 'text-xuat'}">${item.loai}</td>
                <td class="td text-nhap">${item.nhap || ''}</td>
                <td class="td text-xuat">${item.xuat || ''}</td>
                <td class="td">${item.ghi_chu || ''}</td>
                <td class="td">${item.phu_trach || ''}</td>
            </tr>
        `).join('');
        
        this.renderChiTietPagination(displayData.length);
    },
    
    renderChiTietPagination(totalItems) {
        const container = document.getElementById('chitiet-pagination');
        if (!container) return;
        
        const totalPages = Math.ceil(totalItems / this.chitietPageSize);
        
        if (totalPages <= 1) {
            container.innerHTML = '';
            return;
        }
        
        let html = '';
        for (let i = 1; i <= totalPages; i++) {
            html += `<button onclick="app.goToChiTietPage(${i})" 
                class="px-3 py-1 rounded ${i === this.chitietPage ? 'bg-blue-600 text-white' : 'bg-gray-200'}">${i}</button>`;
        }
        
        container.innerHTML = html;
    },
    
    goToChiTietPage(page) {
        this.chitietPage = page;
        this.applyChiTietFilters();
    },
    
    changeChiTietPageSize() {
        this.chitietPageSize = parseInt(document.getElementById('chitiet-page-size').value);
        this.chitietPage = 1;
        this.applyChiTietFilters();
    },
    
    async exportChiTietExcel(all = false) {
        const data = all ? this.chitietData : this.getFilteredChiTiet();
        
        const ws_data = [
            ['STT', 'Thời Gian', 'Mã NX', 'Mã SP', 'Tên SP', 'Loại', 'Nhập', 'Xuất', 'Ghi Chú', 'Phụ Trách']
        ];
        
        data.forEach((item, index) => {
            ws_data.push([
                index + 1,
                this.formatDateTime(item.thoi_gian),
                item.ma_nx,
                item.ma_sp,
                item.ten_sp,
                item.loai,
                item.nhap || '',
                item.xuat || '',
                item.ghi_chu || '',
                item.phu_trach || ''
            ]);
        });
        
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(ws_data);
        XLSX.utils.book_append_sheet(wb, ws, "Chi Tiết");
        XLSX.writeFile(wb, `ChiTiet_${new Date().toISOString().slice(0, 10)}.xlsx`);
        
        this.showToast('Xuất Excel thành công!', 'success');
    },
    
    async exportChiTietPDF(all = false) {
        const data = all ? this.chitietData : this.getFilteredChiTiet();
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        const tableData = data.map((item, index) => [
            index + 1,
            this.formatDateTime(item.thoi_gian),
            item.ma_nx,
            item.ma_sp,
            item.ten_sp,
            item.loai,
            item.nhap || '',
            item.xuat || '',
            item.ghi_chu || '',
            item.phu_trach || ''
        ]);
        
        doc.autoTable({
            head: [['STT', 'Thời Gian', 'Mã NX', 'Mã SP', 'Tên SP', 'Loại', 'Nhập', 'Xuất', 'Ghi Chú', 'Phụ Trách']],
            body: tableData,
            styles: { font: 'helvetica', fontSize: 8 }
        });
        
        doc.save(`ChiTiet_${new Date().toISOString().slice(0, 10)}.pdf`);
        
        this.showToast('Xuất PDF thành công!', 'success');
    },
    
    getFilteredChiTiet() {
        let filtered = [...this.chitietData];
        
        if (this.chitietFilters.search) {
            const search = this.chitietFilters.search.toLowerCase();
            filtered = filtered.filter(item => 
                Object.values(item).some(val => 
                    val && val.toString().toLowerCase().includes(search)
                )
            );
        }
        
        if (this.chitietFilters.maNX.length > 0) {
            filtered = filtered.filter(item => this.chitietFilters.maNX.includes(item.ma_nx));
        }
        if (this.chitietFilters.loai.length > 0) {
            filtered = filtered.filter(item => this.chitietFilters.loai.includes(item.loai));
        }
        if (this.chitietFilters.maSP.length > 0) {
            filtered = filtered.filter(item => this.chitietFilters.maSP.includes(item.ma_sp));
        }
        if (this.chitietFilters.tenSP.length > 0) {
            filtered = filtered.filter(item => this.chitietFilters.tenSP.includes(item.ten_sp));
        }
        if (this.chitietFilters.phuTrach.length > 0) {
            filtered = filtered.filter(item => {
                if (!item.phu_trach) return false;
                return item.phu_trach.split(',').some(pt => 
                    this.chitietFilters.phuTrach.includes(pt.trim())
                );
            });
        }
        
        return filtered;
    },
    
    // Settings Functions
    loadProfileData() {
        if (this.currentUser?.profile) {
            document.getElementById('profile-name').value = this.currentUser.profile.name;
        }
    },
    
    async updateProfile() {
        const name = document.getElementById('profile-name').value;
        const oldPassword = document.getElementById('profile-old-password').value;
        const newPassword = document.getElementById('profile-new-password').value;
        const confirmPassword = document.getElementById('profile-confirm-password').value;
        
        if (!name) {
            this.showToast('Vui lòng nhập họ tên', 'error');
            return;
        }
        
        // Update name
        await supabase
            .from('users')
            .update({ name })
            .eq('id', this.currentUser.id);
        
        // Update password if provided
        if (newPassword) {
            if (newPassword !== confirmPassword) {
                this.showToast('Mật khẩu xác nhận không khớp', 'error');
                return;
            }
            
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            
            if (error) {
                this.showToast('Lỗi cập nhật mật khẩu: ' + error.message, 'error');
                return;
            }
        }
        
        this.showToast('Cập nhật thành công!', 'success');
        await this.loadUserProfile();
        this.loadProfileData();
        
        // Clear password fields
        document.getElementById('profile-old-password').value = '';
        document.getElementById('profile-new-password').value = '';
        document.getElementById('profile-confirm-password').value = '';
    },
    
    renderUsers() {
        const tbody = document.getElementById('users-table-body');
        if (!tbody) return;
        
        const isAdmin = this.currentUser?.profile?.role === 'admin';
        
        tbody.innerHTML = this.usersData.map(user => `
            <tr>
                <td class="td">${user.name}</td>
                <td class="td">${user.email}</td>
                <td class="td">${user.role}</td>
                <td class="td ${!isAdmin ? 'hidden' : ''}">
                    ${isAdmin ? `
                        <button onclick="app.editUser('${user.id}')" class="text-blue-600 hover:underline mr-2">Sửa</button>
                        <button onclick="app.deleteUser('${user.id}')" class="text-red-600 hover:underline">Xóa</button>
                    ` : ''}
                </td>
            </tr>
        `).join('');
    },
    
    openUserModal(id = null) {
        const modal = document.getElementById('modal-user');
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        
        if (id) {
            const user = this.usersData.find(u => u.id === id);
            if (user) {
                document.getElementById('user-name').value = user.name;
                document.getElementById('user-email').value = user.email;
                document.getElementById('user-role').value = user.role;
                document.getElementById('modal-user-title').textContent = 'Sửa Người Dùng';
            }
        } else {
            document.getElementById('user-name').value = '';
            document.getElementById('user-email').value = '';
            document.getElementById('user-password').value = '';
            document.getElementById('user-role').value = 'user';
            document.getElementById('modal-user-title').textContent = 'Thêm Người Dùng';
        }
    },
    
    closeUserModal() {
        document.getElementById('modal-user').classList.add('hidden');
        document.getElementById('modal-user').classList.remove('flex');
    },
    
    async saveUser() {
        const name = document.getElementById('user-name').value;
        const email = document.getElementById('user-email').value;
        const password = document.getElementById('user-password').value;
        const role = document.getElementById('user-role').value;
        
        if (!name || !email) {
            this.showToast('Vui lòng điền đầy đủ thông tin', 'error');
            return;
        }
        
        // For new users, create auth account
        if (password) {
            const { data, error } = await supabase.auth.admin.createUser({
                email,
                password,
                email_confirm: true
            });
            
            if (error) {
                this.showToast('Lỗi tạo tài khoản: ' + error.message, 'error');
                return;
            }
            
            await supabase.from('users').insert([{
                id: data.user.id,
                email,
                name,
                role
            }]);
        }
        
        this.showToast('Lưu thành công!', 'success');
        this.closeUserModal();
        await this.loadUsers();
    },
    
    async editUser(id) {
        this.openUserModal(id);
    },
    
    async deleteUser(id) {
        if (!confirm('Bạn có chắc muốn xóa người dùng này?')) return;
        
        await supabase.from('users').delete().eq('id', id);
        await supabase.auth.admin.deleteUser(id);
        
        this.showToast('Xóa thành công!', 'success');
        await this.loadUsers();
    },
    
    // Utility Functions
    formatDateTime(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleString('vi-VN');
    },
    
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    },
    
    toCamelCase(str) {
        return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
    },
    
    showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        container.appendChild(toast);
        
        setTimeout(() => toast.classList.add('show'), 100);
        
        setTimeout(() => {
            toast.classList.remove('show');
            toast.classList.add('hide');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
