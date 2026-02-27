const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// API key để menu game xác thực (đặt trong biến môi trường Render)
const API_KEY = process.env.API_KEY || 'minhsang_secret_key_2024';

// File lưu lịch sử (tránh mất khi restart - dùng disk Render)
const HISTORY_FILE = './lichsu.json';

app.use(cors());
app.use(bodyParser.json());

// ============================================
// HELPER: Đọc/ghi file lịch sử
// ============================================
function loadHistory() {
    try {
        if (fs.existsSync(HISTORY_FILE)) {
            const data = fs.readFileSync(HISTORY_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (e) {
        console.error('Lỗi đọc file lịch sử:', e);
    }
    return [];
}

function saveHistory(list) {
    try {
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(list, null, 2), 'utf8');
    } catch (e) {
        console.error('Lỗi ghi file lịch sử:', e);
    }
}

// Load lịch sử khi server khởi động
let lichSuGiaoDich = loadHistory();
console.log(`[INIT] Đã tải ${lichSuGiaoDich.length} giao dịch từ file`);

// ============================================
// 1. WEBHOOK NHẬN TIỀN TỪ SEPAY
// ============================================
app.post('/api/sepay/webhook', async (req, res) => {
    try {
        const data = req.body;

        // SePay gửi field "content" (không phải transferContent)
        const content  = data.content || data.transferContent || '';
        const amount   = data.transferAmount || 0;
        const date     = data.transactionDate || new Date().toISOString();
        const refCode  = data.referenceCode || '';
        const id       = String(data.id || Date.now());

        // Bỏ qua nếu không có tiền
        if (amount <= 0) {
            return res.status(200).json({ success: true, message: 'Ignored' });
        }

        // Chống trùng giao dịch theo ID
        const isDuplicate = lichSuGiaoDich.some(gd => gd.id === id);
        if (isDuplicate) {
            console.log(`[DUPLICATE] Bỏ qua giao dịch đã xử lý: ${id}`);
            return res.status(200).json({ success: true, message: 'Already processed' });
        }

        // Lưu giao dịch mới
        const giaoDichMoi = {
            id,
            amount,
            content,
            date,
            bank_code: refCode,
            used: false,      // ← đánh dấu đã dùng hay chưa
            created_at: Date.now()
        };

        lichSuGiaoDich.push(giaoDichMoi);

        // Giữ tối đa 500 giao dịch gần nhất
        if (lichSuGiaoDich.length > 500) {
            lichSuGiaoDich = lichSuGiaoDich.slice(-500);
        }

        saveHistory(lichSuGiaoDich);

        console.log('--------------------------------');
        console.log('💰 NHẬN ĐƯỢC TIỀN!');
        console.log(`- Nội dung: ${content}`);
        console.log(`- Số tiền:  ${amount.toLocaleString()} VNĐ`);
        console.log(`- Ref:      ${refCode}`);
        console.log('--------------------------------');

        return res.status(200).json({ success: true, message: 'Updated' });

    } catch (error) {
        console.error('Lỗi webhook:', error);
        return res.status(200).json({ success: false });
    }
});

// ============================================
// 2. CHECK PAYMENT - Menu game gọi vào đây
// ============================================
// GET /api/check-payment?content=SHOP_sang_50000&apikey=xxx
app.get('/api/check-payment', (req, res) => {
    // Xác thực API key
    const apikey = req.query.apikey || req.headers['x-api-key'];
    if (apikey !== API_KEY) {
        return res.status(403).json({ status: false, message: 'Unauthorized' });
    }

    const noiDungCanTim = req.query.content;
    const amountCanTim = req.query.amount ? parseInt(req.query.amount) : null;

    if (!noiDungCanTim) {
        return res.json({ status: false, message: 'Thiếu tham số content' });
    }

    // Tìm giao dịch chưa dùng, khớp nội dung (và số tiền nếu truyền vào)
    const index = lichSuGiaoDich.findIndex(gd => {
        if (gd.used) return false; // Đã dùng rồi → bỏ qua
        const contentMatch = gd.content.toLowerCase().includes(noiDungCanTim.toLowerCase());
        const amountMatch  = amountCanTim ? gd.amount >= amountCanTim : true;
        return contentMatch && amountMatch;
    });

    if (index !== -1) {
        const ketQua = lichSuGiaoDich[index];

        // Đánh dấu đã dùng (tránh dùng lại)
        lichSuGiaoDich[index].used = true;
        saveHistory(lichSuGiaoDich);

        return res.json({
            status: true,
            message: 'Thanh toán thành công',
            data: {
                amount:  ketQua.amount,
                content: ketQua.content,
                time:    ketQua.date,
                ref:     ketQua.bank_code
            }
        });
    } else {
        return res.json({
            status: false,
            message: 'Chưa tìm thấy giao dịch nào khớp'
        });
    }
});

// ============================================
// 3. LỊCH SỬ GIAO DỊCH (admin xem)
// ============================================
// GET /api/history?apikey=xxx
app.get('/api/history', (req, res) => {
    const apikey = req.query.apikey || req.headers['x-api-key'];
    if (apikey !== API_KEY) {
        return res.status(403).json({ status: false, message: 'Unauthorized' });
    }

    // Sắp xếp mới nhất lên trước
    const sorted = [...lichSuGiaoDich].sort((a, b) => b.created_at - a.created_at);

    res.json({
        total: sorted.length,
        used:  sorted.filter(g => g.used).length,
        pending: sorted.filter(g => !g.used).length,
        transactions: sorted.slice(0, 50) // trả về 50 gần nhất
    });
});

// ============================================
// 4. XÓA GIAO DỊCH CŨ (admin dọn dẹp)
// ============================================
// DELETE /api/clear?apikey=xxx&days=7  (xóa giao dịch cũ hơn 7 ngày)
app.delete('/api/clear', (req, res) => {
    const apikey = req.query.apikey || req.headers['x-api-key'];
    if (apikey !== API_KEY) {
        return res.status(403).json({ status: false, message: 'Unauthorized' });
    }

    const days = parseInt(req.query.days) || 7;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const before = lichSuGiaoDich.length;

    lichSuGiaoDich = lichSuGiaoDich.filter(gd => gd.created_at > cutoff);
    saveHistory(lichSuGiaoDich);

    res.json({
        status: true,
        deleted: before - lichSuGiaoDich.length,
        remaining: lichSuGiaoDich.length
    });
});

// Trang chủ
app.get('/', (req, res) => {
    res.send(`
        <h2>✅ Server Auto Bank Minhsang đang chạy!</h2>
        <p>Tổng giao dịch: ${lichSuGiaoDich.length}</p>
        <p>Chưa dùng: ${lichSuGiaoDich.filter(g => !g.used).length}</p>
    `);
});

app.listen(PORT, () => {
    console.log(`🚀 Server chạy tại port ${PORT}`);
});
