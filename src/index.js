const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// --- KHU VỰC LƯU TRỮ TẠM THỜI ---
// Lưu ý: Vì dùng gói Free, nếu server khởi động lại thì danh sách này sẽ bị reset.
// Để lưu vĩnh viễn cần dùng Database (Mongo, SQL), nhưng hiện tại dùng cái này là chạy ổn.
let lichSuGiaoDich = []; 

// ============================================
// 1. API NHẬN THÔNG BÁO TỪ SEPAY (WEBHOOK)
// ============================================
app.post('/api/sepay/webhook', async (req, res) => {
    try {
        const data = req.body;

        // Lấy thông tin quan trọng
        const giaoDichMoi = {
            id: data.id, // ID giao dịch của SePay
            amount: data.transferAmount, // Số tiền
            content: data.transferContent, // Nội dung khách ghi
            date: data.transactionDate, // Thời gian
            bank_code: data.referenceCode // Mã tham chiếu
        };

        // --- LƯU VÀO DANH SÁCH ---
        // Không cần check chữ "minhsang" nữa, có tiền là lưu hết.
        lichSuGiaoDich.push(giaoDichMoi);

        // In ra log để bạn xem trên Render
        console.log("--------------------------------");
        console.log("💰 NHẬN ĐƯỢC TIỀN!");
        console.log(`- Khách ghi: ${giaoDichMoi.content}`);
        console.log(`- Số tiền:   ${giaoDichMoi.amount} VNĐ`);
        console.log("--------------------------------");

        // Báo cho SePay biết là đã nhận OK
        return res.status(200).json({ success: true, message: 'Updated' });

    } catch (error) {
        console.error("Lỗi:", error);
        return res.status(200).json({ success: false });
    }
});

// ============================================
// 2. API CHO MENU/TOOL KIỂM TRA (CHECK PAYMENT)
// ============================================
// Menu game sẽ gọi vào đây để hỏi: "Thằng user123 đã nạp chưa?"
app.get('/api/check-payment', (req, res) => {
    
    // Lấy nội dung mà Menu Game gửi lên để tìm
    const noiDungCanTim = req.query.content; 

    if (!noiDungCanTim) {
        return res.json({ status: false, message: "Thiếu nội dung cần tìm (content)" });
    }

    // --- THUẬT TOÁN TÌM KIẾM ---
    // Tìm trong lịch sử xem có giao dịch nào CHỨA nội dung đó không
    // (Dùng toLowerCase để không phân biệt hoa thường)
    const ketQua = lichSuGiaoDich.find(gd => 
        gd.content.toLowerCase().includes(noiDungCanTim.toLowerCase())
    );

    if (ketQua) {
        // ==> ĐÃ TÌM THẤY GIAO DỊCH
        res.json({
            status: true,
            message: "Thanh toán thành công",
            data: {
                amount: ketQua.amount,
                content: ketQua.content,
                time: ketQua.date
            }
        });
    } else {
        // ==> CHƯA THẤY
        res.json({
            status: false,
            message: "Chưa tìm thấy giao dịch nào khớp"
        });
    }
});

// ============================================
// 3. API KIỂM TRA LỊCH SỬ (XEM TẤT CẢ)
// ============================================
// Vào link này để xem danh sách các đơn đã nạp
app.get('/api/history', (req, res) => {
    res.json({
        total: lichSuGiaoDich.length,
        transactions: lichSuGiaoDich
    });
});

// Trang chủ
app.get('/', (req, res) => {
    res.send('Server Auto Bank Minhsang đang chạy!');
});

app.listen(PORT, () => {
    console.log(`Server chạy tại port ${PORT}`);
});
