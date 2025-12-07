const express = require("express");
const app = express();

const PORT = process.env.PORT || 10000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Home
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "SEPAY WEBHOOK RUNNING",
    webhook: "/api/sepay/webhook"
  });
});

// Webhook Sepay
app.post("/api/sepay/webhook", (req, res) => {

  console.log("=== WEBHOOK NHAN ===");
  console.log(JSON.stringify(req.body, null, 2));

  const d = req.body;

  const giaoDich = {
    id: d.id || d.transaction_id || "",
    so_tien_vao: Number(d.amount_in || 0),
    so_tien_ra: Number(d.amount_out || 0),
    noi_dung: d.transaction_content || "",
    thoi_gian: d.transaction_date || "",
    ma_tham_chieu: d.reference_number || "",
    so_tk: d.account_number || "",
    raw: d
  };

  console.log("➜ Parsed:", giaoDich);

  return res.status(200).json({
    success: true,
    message: "Webhook OK",
    data: giaoDich
  });
});

// Run server
app.listen(PORT, "0.0.0.0", () => {
  console.log("🚀 SERVER STARTED ON PORT", PORT);
});
