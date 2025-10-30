-- ============================================
-- SUPABASE DATABASE SETUP
-- ============================================
-- Run this SQL in Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLE: users
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- TABLE: san_pham (Products)
-- ============================================
CREATE TABLE IF NOT EXISTS san_pham (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ma_sp TEXT UNIQUE NOT NULL,
    ten_sp TEXT NOT NULL,
    phu_trach TEXT, -- Comma-separated list of responsible persons
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- TABLE: don_hang (Orders)
-- ============================================
CREATE TABLE IF NOT EXISTS don_hang (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    thoi_gian TIMESTAMP NOT NULL,
    loai TEXT NOT NULL CHECK (loai IN ('Nhập', 'Xuất')),
    ma_nx TEXT UNIQUE NOT NULL, -- Import/Export code (IN.JNJ.xxxxxx or OUT.JNJ.xxxxxx)
    yeu_cau TEXT, -- Requester
    muc_dich TEXT, -- Purpose
    ghi_chu TEXT, -- Notes
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- TABLE: chi_tiet (Details/Transactions)
-- ============================================
CREATE TABLE IF NOT EXISTS chi_tiet (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    thoi_gian TIMESTAMP NOT NULL,
    ma_nx TEXT NOT NULL, -- Foreign key to don_hang.ma_nx
    loai TEXT NOT NULL CHECK (loai IN ('Nhập', 'Xuất')),
    ma_sp TEXT NOT NULL,
    ten_sp TEXT NOT NULL,
    nhap INTEGER, -- Import quantity (null if export)
    xuat INTEGER, -- Export quantity (null if import)
    ghi_chu TEXT,
    phu_trach TEXT, -- Responsible person(s)
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- INDEXES for Performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_chi_tiet_ma_nx ON chi_tiet(ma_nx);
CREATE INDEX IF NOT EXISTS idx_chi_tiet_ma_sp ON chi_tiet(ma_sp);
CREATE INDEX IF NOT EXISTS idx_chi_tiet_thoi_gian ON chi_tiet(thoi_gian DESC);
CREATE INDEX IF NOT EXISTS idx_don_hang_thoi_gian ON don_hang(thoi_gian DESC);
CREATE INDEX IF NOT EXISTS idx_don_hang_ma_nx ON don_hang(ma_nx);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE san_pham ENABLE ROW LEVEL SECURITY;
ALTER TABLE don_hang ENABLE ROW LEVEL SECURITY;
ALTER TABLE chi_tiet ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES: users
-- ============================================

-- Allow authenticated users to view all users
CREATE POLICY "Users can view all users" 
ON users FOR SELECT 
TO authenticated 
USING (true);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile" 
ON users FOR UPDATE 
TO authenticated 
USING (auth.uid() = id);

-- Allow admins to insert/update/delete users
CREATE POLICY "Admins can manage users" 
ON users FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM users 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Allow users to insert their own profile on signup
CREATE POLICY "Users can insert own profile" 
ON users FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = id);

-- ============================================
-- RLS POLICIES: san_pham
-- ============================================

-- Anyone authenticated can view products
CREATE POLICY "Authenticated users can view san_pham" 
ON san_pham FOR SELECT 
TO authenticated 
USING (true);

-- Only admins can insert/update/delete products
CREATE POLICY "Admins can manage san_pham" 
ON san_pham FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM users 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- ============================================
-- RLS POLICIES: don_hang
-- ============================================

-- Anyone authenticated can view orders
CREATE POLICY "Authenticated users can view don_hang" 
ON don_hang FOR SELECT 
TO authenticated 
USING (true);

-- Only admins can insert/update/delete orders
CREATE POLICY "Admins can manage don_hang" 
ON don_hang FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM users 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- ============================================
-- RLS POLICIES: chi_tiet
-- ============================================

-- Anyone authenticated can view details
CREATE POLICY "Authenticated users can view chi_tiet" 
ON chi_tiet FOR SELECT 
TO authenticated 
USING (true);

-- Only admins can insert/update/delete details
CREATE POLICY "Admins can manage chi_tiet" 
ON chi_tiet FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM users 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- ============================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================

-- Insert sample products
INSERT INTO san_pham (ma_sp, ten_sp, phu_trach) VALUES
('SP001', 'Máy tính xách tay Dell', 'Nguyễn Văn A, Trần Văn B'),
('SP002', 'Chuột Logitech MX Master', 'Lê Thị C'),
('SP003', 'Bàn phím cơ Keychron K8', 'Nguyễn Văn A'),
('SP004', 'Màn hình LG 27 inch', 'Phạm Văn D'),
('SP005', 'Tai nghe Sony WH-1000XM4', 'Lê Thị C, Trần Văn B')
ON CONFLICT (ma_sp) DO NOTHING;

-- ============================================
-- FUNCTIONS (Helper functions)
-- ============================================

-- Function to get current stock for a product
CREATE OR REPLACE FUNCTION get_current_stock(product_code TEXT)
RETURNS INTEGER AS $$
DECLARE
    total_nhap INTEGER;
    total_xuat INTEGER;
BEGIN
    SELECT COALESCE(SUM(nhap), 0) INTO total_nhap
    FROM chi_tiet
    WHERE ma_sp = product_code;
    
    SELECT COALESCE(SUM(xuat), 0) INTO total_xuat
    FROM chi_tiet
    WHERE ma_sp = product_code;
    
    RETURN total_nhap - total_xuat;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- POST-SETUP INSTRUCTIONS
-- ============================================

/*
1. After creating your first user via the app's registration form,
   run this query to make them an admin:

   UPDATE users SET role = 'admin' 
   WHERE email = 'your-email@example.com';

2. To check current stock for any product:

   SELECT ma_sp, ten_sp, get_current_stock(ma_sp) as ton_kho
   FROM san_pham;

3. To view all transactions for a product:

   SELECT * FROM chi_tiet 
   WHERE ma_sp = 'SP001' 
   ORDER BY thoi_gian DESC;

4. To view summary by product:

   SELECT 
       ma_sp,
       ten_sp,
       SUM(nhap) as total_nhap,
       SUM(xuat) as total_xuat,
       SUM(COALESCE(nhap, 0)) - SUM(COALESCE(xuat, 0)) as ton_kho
   FROM chi_tiet
   GROUP BY ma_sp, ten_sp;
*/

-- ============================================
-- SETUP COMPLETE!
-- ============================================
