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

// Endpoint G-E-T mẫu: Lấy tất cả dữ liệu từ một bảng
// Ví dụ: http://localhost:3001/api/items
app.get('/api/items', async (req, res) => {
  try {
    // Thay 'ten_bang_cua_ban' bằng tên bảng thực tế trong Supabase
    const { data, error } = await supabase
      .from('ten_bang_cua_ban') // <-- THAY TÊN BẢNG Ở ĐÂY
      .select('*');

    if (error) {
      throw error;
    }

    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint P-O-S-T mẫu: Thêm một mục mới
// Ví dụ: P-O-S-T đến http://localhost:3001/api/items với body là { "name": "Item mới" }
app.post('/api/items', async (req, res) => {
  try {
    const { body } = req; // Lấy dữ liệu từ body của request

    // Giả sử bảng của bạn có cột 'name'
    const { data, error } = await supabase
      .from('ten_bang_cua_ban') // <-- THAY CỘT Ở ĐÂY
      .insert([
        { name: body.name } // <-- THAY CỘT Ở ĐÂY
      ])
      .select(); // .select() để trả về dữ liệu vừa tạo

    if (error) {
      throw error;
    }

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
