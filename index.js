// Import các thư viện cần thiết
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Nạp các biến môi trường từ tệp .env
dotenv.config();

// Khởi tạo máy chủ Express
const app = express();
const port = process.env.PORT || 3000;

// ----- Cấu hình Supabase Client -----
// Lấy thông tin kết nối từ biến môi trường
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

// Kiểm tra xem biến môi trường đã được cài đặt chưa
if (!supabaseUrl || !supabaseKey) {
  console.error("Lỗi: SUPABASE_URL hoặc SUPABASE_KEY chưa được cài đặt trong tệp .env");
  // Dừng ứng dụng nếu thiếu biến môi trường
  // process.exit(1); // Bạn có thể bỏ comment dòng này nếu muốn ứng dụng dừng hẳn
}

// Tạo một client Supabase
const supabase = createClient(supabaseUrl, supabaseKey);

// ----- Cấu hình Middleware -----

// Cho phép Cross-Origin Resource Sharing (CORS)
// **QUAN TRỌNG: Dòng này cho phép cổng 5500 gọi đến cổng 3000**
app.use(cors());

// Cho phép Express đọc dữ liệu JSON
app.use(express.json());

// ----- Định nghĩa API Endpoints -----

// Tạo một API endpoint tại /api/all-data
app.get('/api/all-data', async (req, res) => {
  console.log('Nhận được yêu cầu tại /api/all-data');
  try {
    // Dùng Promise.all để gọi API lấy dữ liệu từ 4 bảng CÙNG LÚC
    // Điều này nhanh hơn là gọi từng bảng một
    const [sanpham, tonkho, donhang, chitiet] = await Promise.all([
      supabase.from('SANPHAM').select('*'),
      supabase.from('TONKHO').select('*'),
      supabase.from('DONHANG').select('*'),
      supabase.from('CHITIET').select('*')
    ]);

    // Kiểm tra lỗi cho từng yêu cầu
    if (sanpham.error) throw sanpham.error;
    if (tonkho.error) throw tonkho.error;
    if (donhang.error) throw donhang.error;
    if (chitiet.error) throw chitiet.error;

    // Nếu không có lỗi, gửi dữ liệu về cho client
    res.status(200).json({
      SANPHAM: sanpham.data,
      TONKHO: tonkho.data,
      DONHANG: donhang.data,
      CHITIET: chitiet.data
    });

  } catch (error) {
    // Nếu có bất kỳ lỗi nào xảy ra...
    console.error('Lỗi khi lấy dữ liệu từ Supabase:', error.message);
    res.status(500).json({ 
      error: 'Không thể lấy dữ liệu từ Supabase', 
      details: error.message 
    });
  }
});

// ----- Phục vụ tệp Frontend -----

// Khi người dùng truy cập vào trang chủ (route '/'),
// chúng ta sẽ gửi cho họ tệp index.html
app.get('/', (req, res) => {
  // path.join đảm bảo nó hoạt động trên mọi hệ điều hành
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ----- Khởi động máy chủ -----
app.listen(port, () => {
  console.log(`Máy chủ đang chạy tại http://localhost:${port}`);
});

// Xuất app để Vercel có thể sử dụng nó
module.exports = app;
