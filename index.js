// --- IMPORT CÁC THƯ VIỆN CẦN THIẾT ---
import express from 'express';
import cors from 'cors';
import { createClient }D from '@supabase/supabase-js';
import 'dotenv/config'; // Tự động đọc tệp .env

// --- KHỞI TẠO ỨNG DỤNG EXPRESS ---
const app = express();
const port = process.env.PORT || 3000;

// --- KẾT NỐI SUPABASE ---
// Lấy thông tin từ các biến môi trường (đã có trong .env)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

// Kiểm tra xem biến môi trường đã được cung cấp chưa
if (!supabaseUrl || !supabaseKey) {
  console.error('Lỗi: SUPABASE_URL hoặc SUPABASE_KEY chưa được đặt trong tệp .env');
  process.exit(1); // Thoát ứng dụng nếu thiếu
}

// Tạo một client Supabase
const supabase = createClient(supabaseUrl, supabaseKey);

// --- CẤU HÌNH MIDDLEWARE ---
// CORS: Cho phép frontend (từ bất kỳ đâu) gọi API này
app.use(cors({
    origin: '*', // Cho phép mọi nguồn gốc
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    // Cho phép frontend đọc header 'content-range' để phân trang
    exposedHeaders: ['content-range'] 
}));

// JSON: Phân tích body của request thành JSON
app.use(express.json());

// --- DANH SÁCH CÁC BẢNG ĐƯỢC PHÉP TRUY CẬP ---
// Điều này rất quan trọng để bảo mật, chỉ cho phép API tương tác với 4 bảng này
const ALLOWED_TABLES = ['SANPHAM', 'TONKHO', 'DONHANG', 'CHITIET'];

// Middleware để kiểm tra tên bảng
const checkTable = (req, res, next) => {
    const { view } = req.params;
    if (!ALLOWED_TABLES.includes(view.toUpperCase())) {
        return res.status(403).json({ error: `Không được phép truy cập bảng: ${view}` });
    }
    // Gán tên bảng đã chuẩn hóa (viết hoa) vào request
    req.tableName = view.toUpperCase();
    next();
};


// =================================================================
// ĐỊNH NGHĨA CÁC API ENDPOINTS
// =================================================================

// --- 1. GET: LẤY DỮ LIỆU (Có Phân Trang và Tìm Kiếm) ---
// GET /api/data/SANPHAM?from=0&to=49&search=ao
app.get('/api/data/:view', checkTable, async (req, res) => {
    const { tableName } = req;
    const { from, to, search } = req.query;

    // Phân trang
    const rangeFrom = parseInt(from) || 0;
    const rangeTo = parseInt(to) || 49;

    let query = supabase.from(tableName).select('*', { count: 'exact' });

    // Tìm kiếm (nếu có)
    if (search) {
        // Lấy danh sách cột của bảng từ TABLE_CONFIG (cần định nghĩa ở backend)
        // Tạm thời, chúng ta sẽ tìm kiếm trên các cột phổ biến
        // CÁCH TỐT HƠN: Tạo một cột 'search_vector' trong Supabase (PostgreSQL)
        // Tạm thời dùng 'or'
        if (tableName === 'SANPHAM') {
             query = query.or(`ma_vt.ilike.%${search}%,ten_vt.ilike.%${search}%,nganh.ilike.%${search}%`);
        }
        // Thêm logic 'or' cho các bảng khác nếu cần
        // ...
    }
    
    // Áp dụng phân trang
    query = query.range(rangeFrom, rangeTo);
    
    // Sắp xếp (mặc định theo 'id' hoặc 'created_at' nếu có)
    // Tạm thời sắp xếp theo 'id' giảm dần
    query = query.order('id', { ascending: false });

    // Thực thi truy vấn
    const { data, error, count } = await query;

    if (error) {
        console.error('Lỗi Supabase (GET):', error);
        return res.status(500).json({ error: error.message });
    }

    // Gửi header Content-Range cho frontend biết tổng số item
    res.setHeader('Content-Range', `${rangeFrom}-${rangeTo}/${count}`);
    res.json(data);
});

// --- 2. POST: THÊM MỚI DỮ LIỆU ---
// POST /api/data/SANPHAM
app.post('/api/data/:view', checkTable, async (req, res) => {
    const { tableName } = req;
    const newItem = req.body; // Dữ liệu hàng mới từ frontend

    const { data, error } = await supabase
        .from(tableName)
        .insert([newItem])
        .select(); // .select() để trả về dữ liệu vừa tạo

    if (error) {
        console.error('Lỗi Supabase (POST):', error);
        return res.status(500).json({ error: error.message });
    }

    res.status(201).json(data[0]); // Trả về item vừa tạo
});

// --- 3. PUT: CẬP NHẬT DỮ LIỆU (SỬA) ---
// PUT /api/data/SANPHAM/123
app.put('/api/data/:view/:id', checkTable, async (req, res) => {
    const { tableName } = req;
    const { id } = req.params;
    const updates = req.body; // Các trường cần cập nhật

    const { data, error } = await supabase
        .from(tableName)
        .update(updates)
        .eq('id', id)
        .select();

    if (error) {
        console.error('Lỗi Supabase (PUT):', error);
        return res.status(500).json({ error: error.message });
    }
    
    if (!data || data.length === 0) {
        return res.status(404).json({ error: `Không tìm thấy hàng có ID: ${id}` });
    }

    res.json(data[0]); // Trả về item vừa cập nhật
});


// --- 4. DELETE: XÓA DỮ LIỆU ---
// DELETE /api/data/SANPHAM/123
app.delete('/api/data/:view/:id', checkTable, async (req, res) => {
    const { tableName } = req;
    const { id } = req.params;

    const { error } = await supabase
        .from(tableName)
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Lỗi Supabase (DELETE):', error);
        return res.status(500).json({ error: error.message });
    }

    res.status(204).send(); // 204 No Content - Xóa thành công
});


// --- ENDPOINT CƠ BẢN (CHỈ ĐỂ KIỂM TRA) ---
app.get('/', (req, res) => {
  res.send('Chào mừng đến với API Quản Lý Kho! Vui lòng gọi /api/data/[ten_bang]');
});

// --- KHỞI CHẠY SERVER ---
app.listen(port, () => {
  console.log(`Server đang chạy tại http://localhost:${port}`);
});

// QUAN TRỌNG: Vercel sẽ tự động xử lý file này
// Bạn không cần gọi app.listen() khi triển khai lên Vercel
// Nhưng nó cần thiết để chạy local
export default app;

