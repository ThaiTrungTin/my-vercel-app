// Import các gói cần thiết
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
require('dotenv').config(); // Tải các biến môi trường từ file .env

// Khởi tạo ứng dụng Express
const app = express();
const port = process.env.PORT || 3001; // Sử dụng cổng do Vercel cung cấp hoặc 3001 (nếu chạy local)

// Lấy thông tin kết nối Supabase từ biến môi trường
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

// Kiểm tra xem biến môi trường đã được tải đúng cách chưa
if (!supabaseUrl || !supabaseKey) {
  console.error('LỖI: SUPABASE_URL hoặc SUPABASE_KEY không được tìm thấy.');
  console.error('Hãy đảm bảo bạn đã tạo file .env và điền đúng thông tin,');
  console.error('hoặc đã cấu hình Environment Variables trên Vercel.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Cấu hình middleware
app.use(cors()); // Cho phép Cross-Origin Resource Sharing
app.use(express.json()); // Cho phép đọc JSON từ body của request

// --- ĐỊNH NGHĨA CÁC API ENDPOINTS ---

// =============================================
// API CHO BẢNG SANPHAM
// =============================================

// Endpoint G-E-T: Lấy tất cả dữ liệu từ bảng SANPHAM
// Ví dụ: https://your-domain.vercel.app/api/sanpham
app.get('/api/sanpham', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('SANPHAM')
      .select('*');

    if (error) throw error;
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint P-O-S-T: Thêm một sản phẩm mới
// Ví dụ: P-O-S-T đến https://your-domain.vercel.app/api/sanpham
app.post('/api/sanpham', async (req, res) => {
  try {
    const { body } = req; // Lấy dữ liệu từ body của request

    // LƯU Ý: Đảm bảo bạn có cột 'ten' hoặc 'tensanpham' trong bảng SANPHAM
    const { data, error } = await supabase
      .from('SANPHAM')
      .insert([
        { ten: body.ten, gia: body.gia } // <-- SỬA LẠI CỘT CHO ĐÚNG
      ])
      .select();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =============================================
// API CHO BẢNG DONHANG
// =============================================

// Endpoint G-E-T: Lấy tất cả dữ liệu từ bảng DONHANG
// Ví dụ: https://your-domain.vercel.app/api/donhang
app.get('/api/donhang', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('DONHANG')
      .select('*');

    if (error) throw error;
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint P-O-S-T: Thêm một đơn hàng mới
// Ví dụ: P-O-S-T đến https://your-domain.vercel.app/api/donhang
app.post('/api/donhang', async (req, res) => {
  try {
    const { body } = req;

    // LƯU Ý: Đây chỉ là ví dụ. Sửa lại các cột cho đúng với bảng DONHANG
    const { data, error } = await supabase
      .from('DONHANG')
      .insert([
        { ten_khach_hang: body.ten_khach_hang, dia_chi: body.dia_chi } // <-- SỬA LẠI CỘT CHO ĐÚNG
      ])
      .select();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =============================================
// API CHO BẢNG CHITIET (Chi Tiết Đơn Hàng)
// =============================================

// Endpoint G-E-T: Lấy tất cả dữ liệu từ bảng CHITIET
// Ví dụ: https://your-domain.vercel.app/api/chitiet
app.get('/api/chitiet', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('CHITIET')
      .select('*');

    if (error) throw error;
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint P-O-S-T: Thêm một chi tiết đơn hàng mới
// Ví dụ: P-O-S-T đến https://your-domain.vercel.app/api/chitiet
app.post('/api/chitiet', async (req, res) => {
  try {
    const { body } = req;

    // LƯU Ý: Đây chỉ là ví dụ. Sửa lại các cột cho đúng (ví dụ: id_donhang, id_sanpham, soluong)
    const { data, error } = await supabase
      .from('CHITIET')
      .insert([
        { id_donhang: body.id_donhang, id_sanpham: body.id_sanpham, soluong: body.soluong } // <-- SỬA LẠI CỘT CHO ĐÚNG
      ])
      .select();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =============================================
// API CHO BẢNG TONKHO
// =============================================

// Endpoint G-E-T: Lấy tất cả dữ liệu từ bảng TONKHO
// Ví dụ: https://your-domain.vercel.app/api/tonkho
app.get('/api/tonkho', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('TONKHO')
      .select('*');

    if (error) throw error;
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint P-O-S-T: Thêm (hoặc cập nhật) tồn kho
// Ví dụ: P-O-S-T đến https://your-domain.vercel.app/api/tonkho
app.post('/api/tonkho', async (req, res) => {
  try {
    const { body } = req;

    // LƯU Ý: Đây chỉ là ví dụ. Sửa lại các cột cho đúng (ví dụ: id_sanpham, soluong_ton)
    const { data, error } = await supabase
      .from('TONKHO')
      .insert([
        { id_sanpham: body.id_sanpham, soluong_ton: body.soluong_ton } // <-- SỬA LẠI CỘT CHO ĐÚNG
      ])
      .select();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- KHỞI ĐỘNG MÁY CHỦ ---

// Chạy máy chủ
app.listen(port, () => {
  console.log(`Server đang chạy tại http://localhost:${port}`);
});

// Quan trọng: Export 'app' để Vercel có thể sử dụng
module.exports = app;

