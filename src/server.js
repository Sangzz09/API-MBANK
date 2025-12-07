import express from "express";
import pkg from "pg";

const { Pool } = pkg;

const app = express();
app.use(express.json());

// =======================
// DATABASE (Render)
// =======================
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// =======================
// WEBHOOK SEPAY
// =======================
app.post("/webhook/sepay", async (req, res) => {
    try {
        const data = req.body;

        console.log("📌 Webhook nhận:", data);

        // Lưu giao dịch
        await pool.query(
            `INSERT INTO transactions (tran_id, amount, description, time)
             VALUES ($1, $2, $3, NOW())`,
            [data.tranId, data.amount, data.description]
        );

        res.status(200).send("OK");
    } catch (err) {
        console.error("❌ Lỗi:", err);
        res.status(500).send("FAIL");
    }
});

// =======================
app.get("/", (req, res) => {
    res.send("SePay API is running.");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🚀 Server chạy cổng", PORT));
