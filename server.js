// server.js
import express from "express";
import fetch from "node-fetch";
import fs from "fs";

const app = express();
app.use(express.json());

// CONFIG - Thay các giá trị này
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "8364892217:AAFqXe7GYhDYzghcT9k1ZeNATuEUE-DIkYI";
const SEPAY_API_KEY = process.env.SEPAY_API_KEY || "minhsangpro"; // API Key bạn cấu hình ở SePay (Authorization: Apikey <value>)
const PYTHON_BOT_URL = process.env.PYTHON_BOT_URL || "http://YOUR_PYTHON_HOST:5000/api/payment"; // URL bot Python
const NODE_TO_PYTHON_KEY = process.env.NODE_TO_PYTHON_KEY || "node-to-python-secret"; // shared secret between node->python
const HISTORY_FILE = "history.json";

let groupChatId = null;
let lastTransaction = null;

function saveHistory(data) {
  let arr = [];
  if (fs.existsSync(HISTORY_FILE)) {
    try {
      arr = JSON.parse(fs.readFileSync(HISTORY_FILE, "utf-8"));
    } catch {
      arr = [];
    }
  }
  arr.unshift(data);
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(arr, null, 4), "utf-8");
}

// Telegram listener (optional — nếu bạn dùng webhook telegram)
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

async function sendTelegramMessage(text) {
  if (!groupChatId) {
    console.log("⚠️ Chưa có nhóm Telegram để gửi tin!");
    return;
  }
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: groupChatId, text, parse_mode: "Markdown" }),
    });
  } catch (e) {
    console.log("❌ Lỗi gửi telegram:", e);
  }
}

// Helper verify SePay API Key header (Authorization: Apikey <key>)
function verifySePayApiKey(req) {
  const auth = req.headers["authorization"] || "";
  const expected = `Apikey ${SEPAY_API_KEY}`;
  return auth.trim() === expected;
}

// Webhook SePay
app.post("/api/sepay/webhook", async (req, res) => {
  const data = req.body;
  console.log("📩 Webhook SePay:", data);

  // Verify header
  if (!verifySePayApiKey(req)) {
    console.warn("❌ SePay authorization header invalid:", req.headers["authorization"]);
    return res.status(401).send("Invalid SePay API Key");
  }

  try {
    // extract fields (tương thích payload ví dụ)
    const noiDung = (data.content || data.description || "").toString();
    const soTien = Number(data.transferAmount ?? data.amount ?? 0);
    const thoiGian = data.transactionDate || data.transaction_time || new Date().toISOString();
    const maGD = data.referenceCode || data.txn_id || data.reference || "";
    const transDbId = String(data.id ?? data.referenceCode ?? maGD);

    // extract user id from content: look for "NAPTIEN <digits>"
    let userId = null;
    const upper = noiDung.toUpperCase();
    if (upper.includes("NAPTIEN")) {
      try {
        userId = upper.split("NAPTIEN")[1].trim().split(/\s+/)[0].replace(/\D/g, "");
      } catch { userId = null; }
    }

    const giaoDich = {
      ten_nguoi_gui: data.gateway || data.account_name || "Không rõ",
      so_tien: soTien,
      noi_dung: noiDung,
      thoi_gian: thoiGian,
      ma_giao_dich: maGD,
      user_id: userId,
      db_id: transDbId,
      raw: data
    };

    // Lưu lịch sử
    lastTransaction = giaoDich;
    saveHistory(giaoDich);

    // Gửi thông báo nhóm Telegram
    const msg = `
💸 *Giao dịch mới!*
🏦 Ngân hàng: *${data.gateway || "MB Bank"}*
👤 Người gửi: *${giaoDich.ten_nguoi_gui}*
💰 Số tiền: *${Number(giaoDich.so_tien).toLocaleString()} VND*
📝 Nội dung: _${giaoDich.noi_dung}_
🕒 Thời gian: ${giaoDich.thoi_gian}
🔖 Mã giao dịch: \`${giaoDich.ma_giao_dich}\`
👤 User ID: *${userId || "Không tìm thấy"}*
    `;
    await sendTelegramMessage(msg);

    // Gửi sang Python bot nếu tìm được userId
    if (userId) {
      try {
        await fetch(PYTHON_BOT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-node-to-bot-key": NODE_TO_PYTHON_KEY
          },
          body: JSON.stringify({
            user_id: userId,
            amount: soTien,
            trans_id: maGD,
            sender: data.gateway,
            time: thoiGian,
            content: noiDung,
            db_id: transDbId
          }),
        });
      } catch (err) {
        console.error("❌ Lỗi gửi sang Python bot:", err);
      }
    }

    return res.status(200).send("OK");
  } catch (err) {
    console.error("❌ Lỗi xử lý webhook:", err);
    return res.status(500).send("ERROR");
  }
});

// test endpoint
app.get("/api/sepay/webhook/test", (req, res) => {
  const testData = {
    gateway: "MBBank",
    transactionDate: new Date().toISOString(),
    accountNumber: "0886027767",
    content: "ZALOPAY-CHUYENTIEN-XXX-NAPTIEN 7219600109",
    transferAmount: 10000,
    referenceCode: "TESTREF123",
    id: 999999
  };
  lastTransaction = testData;
  saveHistory(testData);
  res.json(testData);
});

// other endpoints
app.get("/giaodich", (_, res) => {
  if (!lastTransaction) return res.json({ message: "Chưa có giao dịch!" });
  res.json(lastTransaction);
});
app.get("/history", (_, res) => {
  if (!fs.existsSync(HISTORY_FILE)) return res.json([]);
  const history = JSON.parse(fs.readFileSync(HISTORY_FILE, "utf-8"));
  res.json(history);
});
app.get("/", (_, res) => res.send("✅ API SePay Webhook + Telegram đang hoạt động!"));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server chạy trên cổng ${PORT}`));
// server.js
import express from "express";
import fetch from "node-fetch";
import fs from "fs";

const app = express();
app.use(express.json());

// CONFIG - Thay các giá trị này
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "8364892217:AAFqXe7GYhDYzghcT9k1ZeNATuEUE-DIkYI";
const SEPAY_API_KEY = process.env.SEPAY_API_KEY || "minhsangpro"; // API Key bạn cấu hình ở SePay (Authorization: Apikey <value>)
const PYTHON_BOT_URL = process.env.PYTHON_BOT_URL || "http://YOUR_PYTHON_HOST:5000/api/payment"; // URL bot Python
const NODE_TO_PYTHON_KEY = process.env.NODE_TO_PYTHON_KEY || "node-to-python-secret"; // shared secret between node->python
const HISTORY_FILE = "history.json";

let groupChatId = null;
let lastTransaction = null;

function saveHistory(data) {
  let arr = [];
  if (fs.existsSync(HISTORY_FILE)) {
    try {
      arr = JSON.parse(fs.readFileSync(HISTORY_FILE, "utf-8"));
    } catch {
      arr = [];
    }
  }
  arr.unshift(data);
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(arr, null, 4), "utf-8");
}

// Telegram listener (optional — nếu bạn dùng webhook telegram)
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

async function sendTelegramMessage(text) {
  if (!groupChatId) {
    console.log("⚠️ Chưa có nhóm Telegram để gửi tin!");
    return;
  }
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: groupChatId, text, parse_mode: "Markdown" }),
    });
  } catch (e) {
    console.log("❌ Lỗi gửi telegram:", e);
  }
}

// Helper verify SePay API Key header (Authorization: Apikey <key>)
function verifySePayApiKey(req) {
  const auth = req.headers["authorization"] || "";
  const expected = `Apikey ${SEPAY_API_KEY}`;
  return auth.trim() === expected;
}

// Webhook SePay
app.post("/api/sepay/webhook", async (req, res) => {
  const data = req.body;
  console.log("📩 Webhook SePay:", data);

  // Verify header
  if (!verifySePayApiKey(req)) {
    console.warn("❌ SePay authorization header invalid:", req.headers["authorization"]);
    return res.status(401).send("Invalid SePay API Key");
  }

  try {
    // extract fields (tương thích payload ví dụ)
    const noiDung = (data.content || data.description || "").toString();
    const soTien = Number(data.transferAmount ?? data.amount ?? 0);
    const thoiGian = data.transactionDate || data.transaction_time || new Date().toISOString();
    const maGD = data.referenceCode || data.txn_id || data.reference || "";
    const transDbId = String(data.id ?? data.referenceCode ?? maGD);

    // extract user id from content: look for "NAPTIEN <digits>"
    let userId = null;
    const upper = noiDung.toUpperCase();
    if (upper.includes("NAPTIEN")) {
      try {
        userId = upper.split("NAPTIEN")[1].trim().split(/\s+/)[0].replace(/\D/g, "");
      } catch { userId = null; }
    }

    const giaoDich = {
      ten_nguoi_gui: data.gateway || data.account_name || "Không rõ",
      so_tien: soTien,
      noi_dung: noiDung,
      thoi_gian: thoiGian,
      ma_giao_dich: maGD,
      user_id: userId,
      db_id: transDbId,
      raw: data
    };

    // Lưu lịch sử
    lastTransaction = giaoDich;
    saveHistory(giaoDich);

    // Gửi thông báo nhóm Telegram
    const msg = `
💸 *Giao dịch mới!*
🏦 Ngân hàng: *${data.gateway || "MB Bank"}*
👤 Người gửi: *${giaoDich.ten_nguoi_gui}*
💰 Số tiền: *${Number(giaoDich.so_tien).toLocaleString()} VND*
📝 Nội dung: _${giaoDich.noi_dung}_
🕒 Thời gian: ${giaoDich.thoi_gian}
🔖 Mã giao dịch: \`${giaoDich.ma_giao_dich}\`
👤 User ID: *${userId || "Không tìm thấy"}*
    `;
    await sendTelegramMessage(msg);

    // Gửi sang Python bot nếu tìm được userId
    if (userId) {
      try {
        await fetch(PYTHON_BOT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-node-to-bot-key": NODE_TO_PYTHON_KEY
          },
          body: JSON.stringify({
            user_id: userId,
            amount: soTien,
            trans_id: maGD,
            sender: data.gateway,
            time: thoiGian,
            content: noiDung,
            db_id: transDbId
          }),
        });
      } catch (err) {
        console.error("❌ Lỗi gửi sang Python bot:", err);
      }
    }

    return res.status(200).send("OK");
  } catch (err) {
    console.error("❌ Lỗi xử lý webhook:", err);
    return res.status(500).send("ERROR");
  }
});

// test endpoint
app.get("/api/sepay/webhook/test", (req, res) => {
  const testData = {
    gateway: "MBBank",
    transactionDate: new Date().toISOString(),
    accountNumber: "0886027767",
    content: "ZALOPAY-CHUYENTIEN-XXX-NAPTIEN 7219600109",
    transferAmount: 10000,
    referenceCode: "TESTREF123",
    id: 999999
  };
  lastTransaction = testData;
  saveHistory(testData);
  res.json(testData);
});

// other endpoints
app.get("/giaodich", (_, res) => {
  if (!lastTransaction) return res.json({ message: "Chưa có giao dịch!" });
  res.json(lastTransaction);
});
app.get("/history", (_, res) => {
  if (!fs.existsSync(HISTORY_FILE)) return res.json([]);
  const history = JSON.parse(fs.readFileSync(HISTORY_FILE, "utf-8"));
  res.json(history);
});
app.get("/", (_, res) => res.send("✅ API SePay Webhook + Telegram đang hoạt động!"));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server chạy trên cổng ${PORT}`));
