import express from "express";
import crypto from "crypto";

const app = express();
app.use(express.json());

// ✅ Thay bằng API Secret Key của bạn trên https://my.sepay.vn/api
const SEPAY_SECRET = "YOUR_SEPAY_SECRET_KEY";

// ✅ Route webhook
app.post("/api/sepay/webhook", (req, res) => {
  const data = req.body;
  const signature = req.headers["x-sepay-signature"];

  // ✅ Tạo hash để xác thực tính toàn vẹn
  const hash = crypto
    .createHmac("sha256", SEPAY_SECRET)
    .update(JSON.stringify(data))
    .digest("hex");

  if (hash !== signature) {
    console.log("❌ Sai chữ ký, bỏ qua webhook không hợp lệ.");
    return res.status(401).send("Invalid signature");
  }

  // ✅ Xử lý khi có giao dịch thành công
  if (data.type === "RECEIVE" && data.status === "SUCCESS") {
    const transaction = {
      bank: data.bank_short_name,
      account: data.account_name,
      amount: data.amount,
      content: data.content,
      time: data.transaction_time,
      txn_id: data.txn_id,
    };

    console.log("💰 Giao dịch mới nhận:", transaction);

    // 👉 TODO: xử lý logic của bạn ở đây
    // Ví dụ:
    // - Lưu vào database
    // - Cộng tiền vào tài khoản người dùng theo content
    // - Gửi thông báo Telegram hoặc Discord
  }

  res.status(200).send("OK");
});

// ✅ Chạy server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 Webhook Sepay đang chạy tại cổng ${PORT}`)
);
