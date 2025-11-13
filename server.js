import express from "express";
import crypto from "crypto";

const app = express();
app.use(express.json());

// 🔑 Lấy secret key trong phần "API key" của Sepay
const SEPAY_SECRET = "YOUR_SEPAY_SECRET_KEY";

app.post("/api/sepay/webhook", (req, res) => {
  const data = req.body;
  const signature = req.headers["x-sepay-signature"];

  // ✅ Xác thực chữ ký
  const hash = crypto
    .createHmac("sha256", SEPAY_SECRET)
    .update(JSON.stringify(data))
    .digest("hex");

  if (hash !== signature) {
    console.log("Sai chữ ký, bỏ qua!");
    return res.status(401).send("Invalid signature");
  }

  // ✅ Kiểm tra giao dịch thành công
  if (data.type === "RECEIVE" && data.status === "SUCCESS") {
    console.log("📩 Thanh toán mới:", {
      ngân_hàng: data.bank_short_name,
      số_tiền: data.amount,
      nội_dung: data.content,
      mã_giao_dịch: data.txn_id,
    });

    // 👉 TODO: Ở đây bạn xử lý logic riêng của mình
    // Ví dụ: cộng tiền user, đánh dấu đơn hàng thanh toán thành công, lưu DB, v.v.
  }

  res.status(200).send("OK");
});

app.listen(3000, () => console.log("🚀 Webhook Sepay đang chạy trên cổng 3000"));
