import express from "express";
import crypto from "crypto";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

// === CẤU HÌNH CỦA BẠN ===
const SEPAY_SECRET = "YOUR_SEPAY_SECRET_KEY";  // Lấy trong my.sepay.vn -> API Key
const TELEGRAM_BOT_TOKEN = "YOUR_TELEGRAM_BOT_TOKEN";
const TELEGRAM_CHAT_ID = "YOUR_TELEGRAM_CHAT_ID";

// === HÀM GỬI TELEGRAM ===
async function sendTelegramMessage(text) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text,
      parse_mode: "Markdown"
    }),
  });
}

// === WEBHOOK SEPAY ===
app.post("/api/sepay/webhook", async (req, res) => {
  const data = req.body;
  const signature = req.headers["x-sepay-signature"];

  const hash = crypto
    .createHmac("sha256", SEPAY_SECRET)
    .update(JSON.stringify(data))
    .digest("hex");

  if (hash !== signature) {
    console.log("❌ Sai chữ ký webhook!");
    return res.status(401).send("Invalid signature");
  }

  // Chỉ xử lý giao dịch thành công
  if (data.type === "RECEIVE" && data.status === "SUCCESS") {
    const msg = `
💸 *Giao dịch mới nhận được!*
🏦 Ngân hàng: *${data.bank_short_name}*
👤 Tên TK: *${data.account_name}*
💰 Số tiền: *${data.amount.toLocaleString()} VND*
📝 Nội dung: _${data.content}_
🕒 Thời gian: ${data.transaction_time}
🔖 Mã GD: \`${data.txn_id}\`
    `;
    console.log("💰 Thanh toán mới:", data);
    await sendTelegramMessage(msg);
  }

  res.status(200).send("OK");
});

// Route kiểm tra server
app.get("/", (req, res) => {
  res.send("✅ API Sepay Webhook đang hoạt động và gửi Telegram!");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server chạy cổng ${PORT}`));
