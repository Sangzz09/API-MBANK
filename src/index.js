// index.js
const express = require('express');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;

// Middleware log tất cả requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'running',
    message: 'Sepay Webhook API for MBank',
    timestamp: new Date().toISOString(),
    endpoints: {
      webhook: '/api/sepay/webhook',
      health: '/health'
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// Endpoint nhận webhook từ Sepay
app.post('/api/sepay/webhook', async (req, res) => {
  try {
    console.log('\n========================================');
    console.log('🔔 WEBHOOK NHẬN ĐƯỢC TỪ SEPAY');
    console.log('========================================');
    console.log('⏰ Thời gian:', new Date().toISOString());
    console.log('📦 Dữ liệu:', JSON.stringify(req.body, null, 2));
    console.log('========================================\n');

    const data = req.body;

    // Validate có dữ liệu không
    if (!data || Object.keys(data).length === 0) {
      console.log('⚠️  Không có dữ liệu');
      return res.status(400).json({ 
        success: false, 
        message: 'Không có dữ liệu' 
      });
    }

    // Parse thông tin giao dịch
    const transaction = parseTransaction(data);
    
    console.log('💰 Thông tin giao dịch:');
    console.log(`   - ID: ${transaction.id}`);
    console.log(`   - Ngân hàng: ${transaction.bank}`);
    console.log(`   - Số tiền: ${transaction.amount.toLocaleString('vi-VN')} VND`);
    console.log(`   - Nội dung: ${transaction.content}`);
    console.log(`   - Thời gian: ${transaction.date}`);

    // Xử lý giao dịch TIỀN VÀO
    if (transaction.amount > 0) {
      await handlePayment(transaction);
    } else {
      console.log('ℹ️  Giao dịch tiền ra - bỏ qua');
    }

    // Phản hồi thành công về Sepay (QUAN TRỌNG!)
    res.status(200).json({ 
      success: true,
      message: 'Đã nhận và xử lý webhook',
      transactionId: transaction.id
    });

  } catch (error) {
    console.error('❌ Lỗi xử lý webhook:', error);
    
    // Vẫn phải trả về 200 để Sepay không retry
    res.status(200).json({ 
      success: false,
      message: 'Có lỗi xảy ra',
      error: error.message 
    });
  }
});

// Parse dữ liệu từ Sepay (có nhiều format khác nhau)
function parseTransaction(data) {
  return {
    id: data.id || data.transaction_id || 'N/A',
    bank: data.gateway || data.bank_brand_name || 'MBBank',
    date: data.transaction_date || data.when || new Date().toISOString(),
    accountNumber: data.account_number || '',
    amount: parseFloat(data.amount_in || data.transferAmount || 0),
    content: data.transaction_content || data.description || data.transferContent || '',
    referenceNumber: data.reference_number || data.code || '',
    accumulated: parseFloat(data.accumulated || 0)
  };
}

// Xử lý thanh toán
async function handlePayment(transaction) {
  console.log('\n💳 BẮT ĐẦU XỬ LÝ THANH TOÁN');
  
  // Tìm mã đơn hàng trong nội dung
  const orderCode = findOrderCode(transaction.content);
  
  if (orderCode) {
    console.log(`✅ Tìm thấy mã đơn: ${orderCode}`);
    
    // XỬ LÝ ĐƠN HÀNG Ở ĐÂY
    // ========================
    
    // Ví dụ: Cập nhật database
    // await updateOrder(orderCode, {
    //   status: 'paid',
    //   paidAmount: transaction.amount,
    //   transactionId: transaction.id,
    //   paidAt: new Date()
    // });
    
    // Ví dụ: Gửi email xác nhận
    // await sendEmail({
    //   to: 'customer@email.com',
    //   subject: `Đơn hàng ${orderCode} đã thanh toán`,
    //   body: `Số tiền: ${transaction.amount.toLocaleString('vi-VN')} VND`
    // });
    
    // Ví dụ: Gửi notification
    // await sendNotification({
    //   title: 'Thanh toán thành công',
    //   message: `Đơn hàng ${orderCode} - ${transaction.amount} VND`
    // });
    
    console.log(`📝 Đã xử lý đơn hàng: ${orderCode}`);
    
  } else {
    console.log('⚠️  Không tìm thấy mã đơn hàng trong nội dung');
    console.log(`   Nội dung: "${transaction.content}"`);
  }
  
  // Lưu log giao dịch
  saveLog(transaction, orderCode);
  
  console.log('✅ HOÀN TẤT XỬ LÝ\n');
}

// Tìm mã đơn hàng từ nội dung chuyển khoản
function findOrderCode(content) {
  if (!content) return null;
  
  // Loại bỏ dấu và chuyển thành chữ thường để tìm dễ hơn
  const normalized = content.toLowerCase().trim();
  
  // Các pattern thường gặp
  const patterns = [
    /dh[\s-]?(\d+)/i,        // DH12345, DH-12345, DH 12345
    /ma[\s-]?don[\s-]?(\d+)/i, // ma don 12345
    /order[\s-]?(\d+)/i,     // ORDER12345
    /md[\s-]?(\d+)/i,        // MD12345
    /#(\d+)/,                // #12345
    /ma[\s-]?(\d+)/i,        // ma 12345
    /(\d{5,})/               // 5 số trở lên
  ];
  
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      // Lấy nhóm số hoặc toàn bộ match
      return match[1] || match[0];
    }
  }
  
  return null;
}

// Lưu log giao dịch
function saveLog(transaction, orderCode) {
  const log = {
    timestamp: new Date().toISOString(),
    transactionId: transaction.id,
    orderCode: orderCode || 'N/A',
    amount: transaction.amount,
    content: transaction.content,
    bank: transaction.bank,
    status: orderCode ? 'processed' : 'no_order_code'
  };
  
  console.log('📄 Log:', JSON.stringify(log));
  
  // TODO: Lưu vào database hoặc file
  // await db.logs.insert(log);
}

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Endpoint không tồn tại',
    availableEndpoints: [
      'GET /',
      'GET /health', 
      'POST /api/sepay/webhook'
    ]
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('💥 Lỗi không xử lý được:', err);
  res.status(500).json({ 
    error: 'Lỗi server',
    message: err.message 
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   🚀 SEPAY WEBHOOK API ĐANG CHẠY     ║');
  console.log('╚════════════════════════════════════════╝');
  console.log(`📡 Port: ${PORT}`);
  console.log(`🔗 Webhook: /api/sepay/webhook`);
  console.log(`⏰ Khởi động: ${new Date().toLocaleString('vi-VN')}`);
  console.log('═══════════════════════════════════════════\n');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n👋 Đang tắt server...');
  process.exit(0);
});
