import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

// === CẤU HÌNH ===
const TELEGRAM_BOT_TOKEN = "8364892217:AAFqXe7GYhDYzghcT9k1ZeNATuEUE-DIkYI";
let groupChatId = null;

// === LẮNG NGHE TELEGRAM (KHI BOT ĐƯỢC THÊM VÀO NHÓM) ===
app.post(`/api/telegram/${TELEGRAM_BOT_TOKEN}`, async (req, res) => {
  try {
    const data = req.body;
    if (!data?.message) return res.sendStatus(200);

    const msg = data.message;

    // Nếu bot được thêm vào nhóm hoặc /start trong nhóm
    if (msg.chat && (msg.chat.type === "group" || msg.chat.type === "supergroup")) {
      groupChatId = msg.chat.id;
      await sendTelegramMessage(`✅ Bot đã được kích hoạt trong nhóm: *${msg.chat.title}*`);
    }
    if (msg.text?.startsWith("/start")) {
      groupChatId = msg.chat.id;
      await sendTelegramMessage("🚀 Bot nhận thông báo SePay đã sẵn sàng hoạt động!");
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("❌ Telegram error:", err);
    res.sendStatus(500);
  }
});

// === GỬI TIN TELEGRAM ===
async function sendTelegramMessage(text) {
  if (!groupChatId) {
    console.log("⚠️ Chưa có nhóm Telegram để gửi tin!");
    return;
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: groupChatId,
      text,
      parse_mode: "Markdown"
    }),
  });
}

// === WEBHOOK SEPAY ===
app.post("/api/sepay/webhook", async (req, res) => {
  const data = req.body;
  console.log("📩 Webhook SePay:", data);

  if (data.type === "RECEIVE" && data.status === "SUCCESS") {
    const msg = `
💸 *Giao dịch mới!*
🏦 Ngân hàng: *${data.bank_short_name || "MB Bank"}*
👤 Tên TK: *${data.account_name || "TRAN MINH SANG"}*
💰 Số tiền: *${data.amount?.toLocaleString()} VND*
📝 Nội dung: _${data.content || "Không có"}_
🕒 Thời gian: ${data.transaction_time || new Date().toLocaleString()}
🔖 Mã GD: \`${data.txn_id || "Không có"}\`
    `;
    await sendTelegramMessage(msg);
  }

  res.status(200).send("OK");
});

// Kiểm tra
app.get("/", (_, res) => res.send("✅ API SePay Webhook đang hoạt động!"));

// Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Server chạy trên cổng ${PORT}`);
  console.log(`🌐 URL: https://api-mbank.onrender.com`);
});
