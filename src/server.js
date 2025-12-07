const express = require("express");
const app = express();

const PORT = process.env.PORT || 10000;

// middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ================================
// HOME
// ================================
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "SEPAY WEBHOOK RUNNING",
    webhook: "/api/sepay/webhook"
  });
});

// ================================
// WEBHOOK SEPAY (NO TOKEN)
// ================================
app.post("/api/sepay/webhook", (req, res) => {
  console.log("=== WEBHOOK SEPAY ===");

  const data = req.body;

  if (!data) {
    return res.status(400).json({
      success: false,
      message: "No data received"
    });
  }

  // LẤY THÔNG TIN GIAO DỊCH
  const giao_dich = {
    id: data.id || null,                                 // Mã giao dịch
    so_tien_vao: data.amount_in || 0,                    // Số tiền vào
    so_tien_ra: data.amount_out || 0,                    // Số tiền ra
    noi_dung: data.transaction_content || "",            // Nội dung CK
    thoi_gian: data.transaction_date || "",              // Thời gian
    ma_tham_chieu: data.reference_number || "",          // Mã tham chiếu
    so_tk: data.account_number || "",
    raw: data                                            // toàn bộ data
  };

  console.log("Dữ liệu giao dịch:", giao_dich);

  // Trả về OK cho Sepay
  res.status(200).json({
    success: true,
    message: "Webhook received",
    data: giao_dich
  });
});

// ================================
// SERVER LISTEN
// ================================
app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 SERVER RUNNING ON PORT", PORT);
});

