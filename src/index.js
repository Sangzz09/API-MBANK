// server.js - CommonJS format (không cần type: "module")
const express = require('express');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;

// Middleware log
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check
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

// Webhook endpoint
app.post('/api/sepay/webhook', async (req, res) => {
  try {
    console.log('\n========================================');
    console.log('🔔 WEBHOOK NHẬN ĐƯỢC TỪ SEPAY');
    console.log('========================================');
    console.log('⏰ Thời gian:', new Date().toISOString());
    console.log('📦 Dữ liệu:', JSON.stringify(req.body, null, 2));
    console.log('========================================\n');

    const data = req.body;

    if (!data || Object.keys(data).length === 0) {
      console.log('⚠️  Không có dữ liệu');
      return res.status(400).json({ 
        success: false, 
        message: 'Không có dữ liệu' 
      });
    }

    // Parse thông tin giao dịch
    const transaction = {
      id: data.id || data.transaction_id || 'N/A',
      bank: data.gateway || data.bank_brand_name || 'MBBank',
      date: data.transaction_date || data.when || new Date().toISOString(),
      accountNumber: data.account_number || '',
      amount: parseFloat(data.amount_in || data.transferAmount || 0),
      content: data.transaction_content || data.description || data.transferContent || '',
      referenceNumber: data.reference_number || data.code || '',
      accumulated: parseFloat(data.accumulated || 0)
    };
    
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

    res.status(200).json({ 
      success: true,
      message: 'Đã nhận và xử lý webhook',
      transactionId: transaction.id
    });

  } catch (error) {
    console.error('❌ Lỗi xử lý webhook:', error);
    res.status(200).json({ 
      success: false,
      message: 'Có lỗi xảy ra',
      error: error.message 
    });
  }
});

// Xử lý thanh toán
async function handlePayment(transaction) {
  console.log('\n💳 BẮT ĐẦU XỬ LÝ THANH TOÁN');
  
  const orderCode = findOrderCode(transaction.content);
  
  if (orderCode) {
    console.log(`✅ Tìm thấy mã đơn: ${orderCode}`);
    console.log(`📝 Đã xử lý đơn hàng: ${orderCode}`);
  } else {
    console.log('⚠️  Không tìm thấy mã đơn hàng trong nội dung');
    console.log(`   Nội dung: "${transaction.content}"`);
  }
  
  saveLog(transaction, orderCode);
  console.log('✅ HOÀN TẤT XỬ LÝ\n');
}

// Tìm mã đơn hàng
function findOrderCode(content) {
  if (!content) return null;
  
  const patterns = [
    /dh[\s-]?(\d+)/i,
    /ma[\s-]?don[\s-]?(\d+)/i,
    /order[\s-]?(\d+)/i,
    /md[\s-]?(\d+)/i,
    /#(\d+)/,
    /ma[\s-]?(\d+)/i,
    /(\d{5,})/
  ];
  
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      return match[1] || match[0];
    }
  }
  
  return null;
}

// Lưu log
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
  console.error('💥 Lỗi:', err);
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

process.on('SIGTERM', () => {
  console.log('\n👋 Đang tắt server...');
  process.exit(0);
});
