const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// --- ROUTE NHẬN WEBHOOK TỪ SEPAY ---
app.post('/api/sepay/webhook', async (req, res) => {
    try {
        // Lấy toàn bộ dữ liệu SePay gửi sang
        const data = req.body;

        // --- 1. TRÍCH XUẤT 4 THÔNG TIN BẠN CẦN ---
        
        // Số tiền (transferAmount)
        const soTien = data.transferAmount; 

        // Nội dung (transferContent) - VD: "NAP MINHSANG"
        const noiDung = data.transferContent; 

        // Thời gian (transactionDate) - VD: "2025-12-09 19:00:00"
        const thoiGian = data.transactionDate; 

        // Mã đơn/Mã giao dịch ngân hàng (referenceCode) - VD: "FT233..."
        const maDon = data.referenceCode; 


        // --- 2. LOG RA MÀN HÌNH ĐỂ KIỂM TRA (Trên Render Logs) ---
        console.log("--------------------------------");
        console.log("🔥 CÓ GIAO DỊCH MỚI!");
        console.log(`💰 Số tiền:   ${soTien} VNĐ`);
        console.log(`📝 Nội dung:  ${noiDung}`);
        console.log(`⏰ Thời gian: ${thoiGian}`);
        console.log(`🧾 Mã đơn:    ${maDon}`);
        console.log("--------------------------------");


        // --- 3. XỬ LÝ LOGIC CỘNG TIỀN (VÍ DỤ) ---
        // Tại đây bạn viết code lưu vào database
        
        // Ví dụ: Kiểm tra nếu nội dung có chứa "minhsang"
        if (noiDung && noiDung.toLowerCase().includes("minhsang")) {
            console.log(`=> Đang cộng ${soTien} cho user MinhSang...`);
            // Code update database ở đây...
        }


        // --- 4. TRẢ VỀ KẾT QUẢ CHO SEPAY (BẮT BUỘC) ---
        return res.status(200).json({
            success: true,
            message: 'Đã nhận thông tin thành công',
            data_received: {
                amount: soTien,
                content: noiDung,
                time: thoiGian,
                code: maDon
            }
        });

    } catch (error) {
        console.error("Lỗi:", error);
        return res.status(200).json({ success: false, message: 'Có lỗi xảy ra' });
    }
});

// Route kiểm tra server
app.get('/', (req, res) => {
    res.send('API SePay đang chạy ngon lành!');
});

app.listen(PORT, () => {
    console.log(`Server chạy tại port ${PORT}`);
});
