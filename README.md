# Hệ Thống Quản Lý Kho

Ứng dụng web quản lý kho sử dụng Supabase làm backend.

## Cài Đặt

### 1. Cấu hình Supabase

1. Tạo tài khoản tại [Supabase](https://supabase.com)
2. Tạo project mới
3. Lấy URL và Anon Key từ Settings > API
4. Cập nhật vào file `app.js`:
   ```javascript
   const SUPABASE_URL = 'your-project-url';
   const SUPABASE_ANON_KEY = 'your-anon-key';
   ```

### 2. Tạo Database Schema

Chạy các SQL sau trong Supabase SQL Editor:

```sql
-- Bảng users
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Bảng san_pham
CREATE TABLE san_pham (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ma_sp TEXT UNIQUE NOT NULL,
    ten_sp TEXT NOT NULL,
    phu_trach TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Bảng don_hang
CREATE TABLE don_hang (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    thoi_gian TIMESTAMP NOT NULL,
    loai TEXT NOT NULL CHECK (loai IN ('Nhập', 'Xuất')),
    ma_nx TEXT UNIQUE NOT NULL,
    yeu_cau TEXT,
    muc_dich TEXT,
    ghi_chu TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Bảng chi_tiet
CREATE TABLE chi_tiet (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    thoi_gian TIMESTAMP NOT NULL,
    ma_nx TEXT NOT NULL,
    loai TEXT NOT NULL CHECK (loai IN ('Nhập', 'Xuất')),
    ma_sp TEXT NOT NULL,
    ten_sp TEXT NOT NULL,
    nhap INTEGER,
    xuat INTEGER,
    ghi_chu TEXT,
    phu_trach TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_chi_tiet_ma_nx ON chi_tiet(ma_nx);
CREATE INDEX idx_chi_tiet_ma_sp ON chi_tiet(ma_sp);
CREATE INDEX idx_chi_tiet_thoi_gian ON chi_tiet(thoi_gian DESC);
CREATE INDEX idx_don_hang_thoi_gian ON don_hang(thoi_gian DESC);

-- RLS Policies (Row Level Security)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE san_pham ENABLE ROW LEVEL SECURITY;
ALTER TABLE don_hang ENABLE ROW LEVEL SECURITY;
ALTER TABLE chi_tiet ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view all users" ON users FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admins can manage users" ON users FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);

-- San_pham policies
CREATE POLICY "Anyone can view san_pham" ON san_pham FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage san_pham" ON san_pham FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);

-- Don_hang policies
CREATE POLICY "Anyone can view don_hang" ON don_hang FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage don_hang" ON don_hang FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);

-- Chi_tiet policies
CREATE POLICY "Anyone can view chi_tiet" ON chi_tiet FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage chi_tiet" ON chi_tiet FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
);
```

### 3. Tạo Admin User

Sau khi đăng ký tài khoản đầu tiên, chạy SQL sau để cấp quyền admin:

```sql
UPDATE users SET role = 'admin' WHERE email = 'your-email@example.com';
```

### 4. Thêm Sample Data (Optional)

```sql
-- Thêm sản phẩm mẫu
INSERT INTO san_pham (ma_sp, ten_sp, phu_trach) VALUES
('SP001', 'Sản phẩm A', 'Nguyễn Văn A, Trần Văn B'),
('SP002', 'Sản phẩm B', 'Lê Thị C'),
('SP003', 'Sản phẩm C', 'Nguyễn Văn A');
```

## Chạy Ứng Dụng

1. Mở file `index.html` bằng trình duyệt web
2. Hoặc sử dụng live server:
   ```bash
   python -m http.server 8000
   # hoặc
   npx serve
   ```
3. Truy cập http://localhost:8000

## Tính Năng

### Đơn Hàng
- ✅ Phân trang (50/100/200/Tất cả)
- ✅ Cố định tiêu đề khi cuộn
- ✅ Thêm/Sửa đơn hàng với bảng con
- ✅ Sắp xếp theo thời gian giảm dần
- ✅ Tự động sinh mã NX (IN.JNJ.xxxxxx cho Nhập, OUT.JNJ.xxxxxx cho Xuất)
- ✅ Hiển thị tồn kho khi thêm sản phẩm
- ✅ Kiểm tra số lượng xuất không vượt quá tồn kho

### Chi Tiết
- ✅ Tìm kiếm toàn văn
- ✅ Bộ lọc phụ thuộc (Mã NX, Loại, Mã SP, Tên SP, Phụ Trách)
- ✅ Xuất Excel (Bộ lọc / Tất cả)
- ✅ Xuất PDF (Bộ lọc / Tất cả)
- ✅ Phân trang (50/100/200/Tất cả)
- ✅ Cố định tiêu đề khi cuộn
- ✅ Sắp xếp theo thời gian giảm dần

### Cài Đặt
- ✅ Đổi thông tin cá nhân (Tên, Mật khẩu)
- ✅ Đăng xuất
- ✅ Quản lý người dùng (Admin only)
- ✅ Thêm/Sửa/Xóa user (Admin only)

### Phân Quyền
- ✅ User: Xem dữ liệu, đổi thông tin cá nhân
- ✅ Admin: Toàn quyền quản lý (Thêm/Sửa/Xóa đơn hàng, quản lý user)

## Cấu Trúc File

```
/workspace/
  ├── index.html      # Giao diện người dùng
  ├── app.js          # Logic ứng dụng + Supabase integration
  ├── style.css       # Styles
  └── README.md       # Tài liệu này
```

## Lưu Ý

- Cần cấu hình Supabase URL và Key trước khi sử dụng
- User đầu tiên cần được cấp quyền admin thủ công qua SQL
- Ứng dụng yêu cầu kết nối internet để truy cập Supabase
- Tất cả dữ liệu được lưu trên Supabase cloud

## Hỗ Trợ

Nếu gặp vấn đề:
1. Kiểm tra Console log trong DevTools (F12)
2. Kiểm tra kết nối Supabase
3. Kiểm tra RLS policies trong Supabase Dashboard
4. Kiểm tra email/password đã đúng chưa
