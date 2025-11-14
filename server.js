import express from "express";
import fetch from "node-fetch";
import fs from "fs";

const app = express();
app.use(express.json());

// =======================================================
//                 CẤU HÌNH TELEGRAM
// =======================================================
const TELEGRAM_BOT_TOKEN = "8364892217:AAFqXe7GYhDYzghcT9k1ZeNATuEUE-DIkYI";
let groupChatId = null;

// Lưu giao dịch
let lastTransaction = null;

// File lưu lịch sử
const HISTORY_FILE = "history.json";

function saveHistory(data) {
  let arr = [];
  if (fs.existsSync(HISTORY_FILE)) {
    arr = JSON.parse(fs.readFileSync(HISTORY_FILE));
  }
  arr.unshift(data);
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(arr, null, 4));
}

// =======================================================
//          LẮNG NGHE TELEGRAM (BOT VÀO NHÓM)
// =======================================================
app.post(`/api/telegram/${TELEGRAM_BOT_TOKEN}`, async (req, res) => {
  try {
    const data = req.body;
    if (!data?.message) return res.sendStatus(200);

    const msg = data.message;

    if (msg.chat && (msg.chat.type === "group" || msg.chat.type === "supergroup")) {
      groupChatId = msg.chat.id;
      await sendTelegramMessage(`✅ Bot đã kích hoạt trong nhóm *${msg.chat.title}*`);
    }

    if (msg.text?.startsWith("/start")) {
      groupChatId = msg.chat.id;
      await sendTelegramMessage("🚀 Bot đã sẵn sàng nhận thông báo chuyển khoản SePay!");
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("❌ Telegram error:", err);
    res.sendStatus(500);
  }
});

// =======================================================
//                     GỬI TELEGRAM
// =======================================================
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

// =======================================================
//                      WEBHOOK SEPAY
// =======================================================
app.post("/api/sepay/webhook", async (req, res) => {
  const data = req.body;

  console.log("📩 Webhook SePay:", data);

  if (data.type === "RECEIVE" && data.status === "SUCCESS") {
    
    const giaoDich = {
      ten_nguoi_gui: data.account_name || "Không có",
      so_tien: data.amount || 0,
      noi_dung: data.content || "",
      thoi_gian: data.transaction_time || new Date().toLocaleString(),
      ma_giao_dich: data.txn_id || "",
      raw: data
    };

    lastTransaction = giaoDich;
    saveHistory(giaoDich);

    const msg = `
💸 *Giao dịch mới!*
🏦 Ngân hàng: *${data.bank_short_name || "MB Bank"}*
👤 Người gửi: *${giaoDich.ten_nguoi_gui}*
💰 Số tiền: *${Number(giaoDich.so_tien).toLocaleString()} VND*
📝 Nội dung: _${giaoDich.noi_dung}_
🕒 Thời gian: ${giaoDich.thoi_gian}
🔖 Mã giao dịch: \`${giaoDich.ma_giao_dich}\`
    `;

    await sendTelegramMessage(msg);
  }

  res.status(200).send("OK");
});

// =======================================================
//                API HIỂN THỊ JSON TRÊN WEB
// =======================================================

// JSON giao dịch mới nhất
app.get("/giaodich", (req, res) => {
  if (!lastTransaction) {
    return res.json({ message: "Chưa có giao dịch!" });
  }

  res.setHeader("Content-Type", "application/json");
  res.send(JSON.stringify(lastTransaction, null, 4));
});

// JSON lịch sử
app.get("/history", (req, res) => {
  if (!fs.existsSync(HISTORY_FILE))
    return res.json([]);

  const history = JSON.parse(fs.readFileSync(HISTORY_FILE));
  res.setHeader("Content-Type", "application/json");
  res.send(JSON.stringify(history, null, 4));
});

// =======================================================
//                        CHECK SERVER
// =======================================================
app.get("/", (_, res) => res.send("✅ API SePay Webhook + Telegram đang hoạt động!"));

// =======================================================
//                        START SERVER
// =======================================================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Server chạy trên cổng ${PORT}`);
  console.log(`🌐 URL: https://api-mbank.onrender.com`);
});
