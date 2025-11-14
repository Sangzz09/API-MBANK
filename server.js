import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

// ====== CẤU HÌNH TELEGRAM ======
const TELEGRAM_BOT_TOKEN = "8364892217:AAFqXe7GYhDYzghcT9k1ZeNATuEUE-DIkYI";
let groupChatId = null;

// ====== NHẬN TIN TỪ TELEGRAM (BOT ĐƯỢC THÊM VÀO NHÓM) ======
app.post(`/api/telegram/${TELEGRAM_BOT_TOKEN}`, async (req, res) => {
  try {
    const data = req.body;
    if (!data?.message) return res.sendStatus(200);

    const msg = data.message;

    // Khi bot được thêm vào nhóm
    if (msg.chat && (msg.chat.type === "group" || msg.chat.type === "supergroup")) {
      groupChatId = msg.chat.id;
      await sendTelegramMessage(`✅ Bot đã được kích hoạt trong nhóm *${msg.chat.title}*`);
    }

    // Khi người dùng gõ /start
    if (msg.text?.startsWith("/start")) {
      groupChatId = msg.chat.id;
      await sendTelegramMessage("🚀 Bot thông báo SePay đã sẵn sàng hoạt động!");
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("❌ Lỗi nhận Telegram:", err);
    res.sendStatus(500);
  }
});

// ====== HÀM GỬI TIN TELEGRAM ======
async function sendTelegramMessage(text) {
  if (!groupChatId) {
    console.log("⚠️ Chưa có nhóm để gửi thông báo Telegram!");
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

// ====== WEBHOOK SEPAY ======
app.post("/api/sepay/webhook", async (req, res) => {
  const data = req.body;
  console.log("📩 Dữ liệu Webhook SePay:", data);

  // Chỉ xử lý giao dịch nhận tiền thành công
  if (data.type === "RECEIVE" && data.status === "SUCCESS") {

    const jsonPhanHoi = {
      ten_nguoi_gui: data.account_name || "Không rõ",
      so_tien: data.amount || 0,
      noi_dung: data.content || "Không có",
      thoi_gian: data.transaction_time || new Date().toLocaleString(),
      ma_giao_dich: data.txn_id || "Không có"
    };

    // ====== GỬI TIN TELEGRAM ======
    const msg = `
💸 *GIAO DỊCH MỚI!*
👤 Người gửi: *${jsonPhanHoi.ten_nguoi_gui}*
💰 Số tiền: *${jsonPhanHoi.so_tien.toLocaleString()} VND*
📝 Nội dung: _${jsonPhanHoi.noi_dung}_
🕒 Thời gian: ${jsonPhanHoi.thoi_gian}
🔖 Mã giao dịch: \`${jsonPhanHoi.ma_giao_dich}\`
    `;

    await sendTelegramMessage(msg);

    // ====== TRẢ JSON VỀ CHO CLIENT ======
    return res.status(200).json(jsonPhanHoi);
  }

  res.status(200).send("OK");
});

// ====== KIỂM TRA SERVER ======
app.get("/", (_, res) => {
  res.send("✅ API Webhook SePay đang hoạt động!");
});

// ====== KHỞI ĐỘNG SERVER ======
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Server đang chạy trên cổng ${PORT}`);
  console.log(`🌐 URL: https://api-mbank.onrender.com`);
});
