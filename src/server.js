import express from "express";
import pkg from "pg";
const { Pool } = pkg;

const app = express();
app.use(express.json());

// ===========================
//   CONFIG DATABASE RENDER
// ===========================
const pool = new Pool({
    connectionString: "postgresql://USER:PASSWORD@HOST:PORT/DBNAME",
    ssl: { rejectUnauthorized: false }
});

// Tạo bảng giao dịch
async function initDB() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS sepay_transactions (
            id SERIAL PRIMARY KEY,
            tran_id VARCHAR(50),
            amount BIGINT,
            content TEXT,
            bank TEXT,
            sender TEXT,
            time TIMESTAMP,
            raw JSONB
        );
    `);
}
initDB();


// ===========================
//     NHẬN WEBHOOK SEPAY
// ===========================
// SePay gửi JSON như sau:
// {
//   "tranId": "123456",
//   "amount": 50000,
//   "content": "NAPTIEN 123",
//   "bank": "MB",
//   "sender": "NGUYEN VAN A",
//   "time": "2024-12-01 12:15:00"
// }

app.post("/webhook/sepay", async (req, res) => {
    const data = req.body;

    try {
        await pool.query(
            `INSERT INTO sepay_transactions 
            (tran_id, amount, content, bank, sender, time, raw)
            VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [
                data.tranId,
                data.amount,
                data.content,
                data.bank,
                data.sender,
                data.time,
                data
            ]
        );

        console.log("🔥 Nhận giao dịch:", data);
        return res.json({ status: "success" });

    } catch (e) {
        console.error(e);
        return res.status(500).json({ status: "error" });
    }
});


// ===========================
//       API CHO TELE BOT
// ===========================

// Lấy giao dịch theo nội dung (VD: mã key)
app.get("/api/find", async (req, res) => {
    const content = req.query.content;

    if (!content) return res.json({ error: "missing content" });

    const result = await pool.query(
        `SELECT * FROM sepay_transactions 
         WHERE content ILIKE $1 
         ORDER BY id DESC LIMIT 1`,
        [`%${content}%`]
    );

    res.json(result.rows[0] || {});
});

// Lấy giao dịch mới nhất
app.get("/api/latest", async (req, res) => {
    const result = await pool.query(
        `SELECT * FROM sepay_transactions ORDER BY id DESC LIMIT 1`
    );
    res.json(result.rows[0] || {});
});


// ===========================
//        KHỞI CHẠY
// ===========================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("API RUNNING ON PORT " + PORT));
