/**
 * SEPAY WEBHOOK API FOR MBANK
 * Nhận và xử lý thông báo giao dịch real-time từ Sepay
 */

const express = require('express');
const app = express();

// ============================================
// CẤU HÌNH
// ============================================
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'production';

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS (nếu cần)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path} - IP: ${req.ip}`);
  next();
});

// ============================================
// ROUTES - HEALTH CHECK
// ============================================

app.get('/', (req, res) => {
  res.json({ 
    success: true,
    service: 'Sepay Webhook API',
    version: '1.0.0',
    status: 'running',
    bank: 'MBank (Maritime Bank)',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    endpoints: {
      webhook: 'POST /api/sepay/webhook',
      health: 'GET /health',
      test: 'POST /api/test'
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// Test endpoint
app.post('/api/test', (req, res) => {
  console.log('📨 Test request received:', req.body);
  res.json({
    success: true,
    message: 'Test endpoint working',
    received: req.body,
    timestamp: new Date().toISOString()
  });
});

// ============================================
// MAIN WEBHOOK ENDPOINT
// ============================================

app.post('/api/sepay/webhook', async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Log chi tiết webhook nhận được
    console.log('\n' + '='.repeat(60));
    console.log('🔔 WEBHOOK MỚI TỪ SEPAY - MBANK');
    console.log('='.repeat(60));
    console.log('⏰ Thời gian nhận:', new Date().toISOString());
    console.log('📍 IP nguồn:', req.ip);
    console.log('📋 Headers:', JSON.stringify(req.headers, null, 2));
    console.log('📦 Body:', JSON.stringify(req.body, null, 2));
    console.log('='.repeat(60));

    const data = req.body;

    // Validate dữ liệu
    if (!data || Object.keys(data).length === 0) {
      console.log('⚠️  Webhook rỗng - không có dữ liệu');
      return res.status(200).json({ 
        success: false, 
        message: 'Không có dữ liệu trong webhook'
      });
    }

    // Parse thông tin giao dịch
    const transaction = parseTransaction(data);
    
    // Log thông tin giao dịch đã parse
    logTransaction(transaction);

    // Xử lý giao dịch TIỀN VÀO
    if (transaction.amount > 0) {
      await processIncomingPayment(transaction);
    } else if (transaction.amountOut > 0) {
      console.log('💸 Giao dịch tiền RA - bỏ qua xử lý');
    } else {
      console.log('❓ Không xác định được loại giao dịch');
    }

    // Tính thời gian xử lý
    const processingTime = Date.now() - startTime;
    console.log(`⚡ Thời gian xử lý: ${processingTime}ms`);
    console.log('='.repeat(60) + '\n');

    // QUAN TRỌNG: Luôn trả về 200 OK cho Sepay
    res.status(200).json({ 
      success: true,
      message: 'Webhook đã được xử lý thành công',
      transactionId: transaction.id,
      processingTime: `${processingTime}ms`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('\n' + '❌'.repeat(30));
    console.error('💥 LỖI KHI XỬ LÝ WEBHOOK:');
    console.error('Lỗi:', error.message);
    console.error('Stack:', error.stack);
    console.error('❌'.repeat(30) + '\n');

    // Vẫn trả về 200 để Sepay không retry
    res.status(200).json({ 
      success: false,
      message: 'Có lỗi khi xử lý webhook',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ============================================
// FUNCTIONS - XỬ LÝ DỮ LIỆU
// ============================================

/**
 * Parse dữ liệu từ Sepay thành format chuẩn
 */
function parseTransaction(data) {
  return {
    // ID giao dịch
    id: data.id || data.transaction_id || data.transferId || generateId(),
    
    // Thông tin ngân hàng
    bank: data.gateway || data.bank_brand_name || 'MBBank',
    accountNumber: data.account_number || data.accountNumber || '',
    subAccount: data.sub_account || '',
    
    // Số tiền
    amount: parseFloat(data.amount_in || data.transferAmount || data.credit || 0),
    amountOut: parseFloat(data.amount_out || data.debit || 0),
    accumulated: parseFloat(data.accumulated || data.balance || 0),
    
    // Nội dung và mã
    content: (data.transaction_content || data.description || data.transferContent || '').trim(),
    code: data.code || data.transaction_code || '',
    referenceNumber: data.reference_number || data.ref || '',
    
    // Thời gian
    date: data.transaction_date || data.when || data.transactionDate || new Date().toISOString(),
    
    // Raw data để backup
    raw: data
  };
}

/**
 * Log thông tin giao dịch đẹp mắt
 */
function logTransaction(transaction) {
  console.log('\n💰 THÔNG TIN GIAO DỊCH:');
  console.log('├─ ID:', transaction.id);
  console.log('├─ Ngân hàng:', transaction.bank);
  console.log('├─ Số TK:', transaction.accountNumber || 'N/A');
  console.log('├─ Số tiền VÀO:', formatMoney(transaction.amount));
  console.log('├─ Số tiền RA:', formatMoney(transaction.amountOut));
  console.log('├─ Số dư:', formatMoney(transaction.accumulated));
  console.log('├─ Nội dung:', `"${transaction.content}"`);
  console.log('├─ Mã GD:', transaction.code || 'N/A');
  console.log('├─ Mã tham chiếu:', transaction.referenceNumber || 'N/A');
  console.log('└─ Thời gian:', transaction.date);
}

/**
 * Xử lý giao dịch tiền VÀO
 */
async function processIncomingPayment(transaction) {
  console.log('\n💳 BẮT ĐẦU XỬ LÝ THANH TOÁN');
  console.log('━'.repeat(60));
  
  // Tìm mã đơn hàng trong nội dung
  const orderCode = extractOrderCode(transaction.content);
  
  if (orderCode) {
    console.log(`✅ Tìm thấy mã đơn hàng: "${orderCode}"`);
    
    // ========================================
    // XỬ LÝ ĐẠT HÀNG Ở ĐÂY
    // ========================================
    
    try {
      // 1. Cập nhật trạng thái đơn hàng trong database
      await updateOrderStatus(orderCode, transaction);
      
      // 2. Gửi email xác nhận
      await sendConfirmationEmail(orderCode, transaction);
      
      // 3. Gửi thông báo
      await sendNotification(orderCode, transaction);
      
      // 4. Trigger các process khác (fulfillment, inventory, etc.)
      await triggerFulfillment(orderCode, transaction);
      
      console.log(`✅ Đã xử lý thành công đơn hàng: ${orderCode}`);
      
    } catch (error) {
      console.error(`❌ Lỗi xử lý đơn hàng ${orderCode}:`, error.message);
    }
    
  } else {
    console.log('⚠️  KHÔNG TÌM THẤY MÃ ĐƠN HÀNG');
    console.log(`   📝 Nội dung: "${transaction.content}"`);
    console.log('   💡 Gợi ý: Yêu cầu khách ghi rõ mã đơn (VD: DH12345)');
  }
  
  // Lưu log giao dịch
  await saveTransactionLog(transaction, orderCode);
  
  console.log('━'.repeat(60));
  console.log('✅ HOÀN TẤT XỬ LÝ THANH TOÁN\n');
}

/**
 * Tìm mã đơn hàng từ nội dung chuyển khoản
 */
function extractOrderCode(content) {
  if (!content) return null;
  
  const normalizedContent = content.trim();
  
  // Các pattern phổ biến (từ ưu tiên cao đến thấp)
  const patterns = [
    { regex: /\bDH[\s-]?(\d+)\b/i, name: 'DH + số' },
    { regex: /\bORDER[\s-]?(\d+)\b/i, name: 'ORDER + số' },
    { regex: /\bMD[\s-]?(\d+)\b/i, name: 'MD + số' },
    { regex: /\bINV[\s-]?(\d+)\b/i, name: 'INV + số' },
    { regex: /\b#(\d+)\b/, name: '# + số' },
    { regex: /\bMa don[\s:-]?(\d+)\b/i, name: 'Ma don + số' },
    { regex: /\bMa[\s:-]?(\d+)\b/i, name: 'Ma + số' },
    { regex: /\b(\d{5,})\b/, name: '5 chữ số trở lên' } // Match cuối cùng
  ];
  
  for (const pattern of patterns) {
    const match = normalizedContent.match(pattern.regex);
    if (match) {
      const code = match[1] || match[0];
      console.log(`   🔍 Tìm thấy bằng pattern: ${pattern.name}`);
      return code;
    }
  }
  
  return null;
}

// ============================================
// FUNCTIONS - XỬ LÝ BUSINESS LOGIC
// ============================================

/**
 * Cập nhật trạng thái đơn hàng
 */
async function updateOrderStatus(orderCode, transaction) {
  console.log(`   📝 Cập nhật đơn hàng: ${orderCode}`);
  
  // TODO: Implement database update
  // Ví dụ với MongoDB:
  // await db.orders.updateOne(
  //   { orderCode: orderCode },
  //   {
  //     $set: {
  //       status: 'paid',
  //       paidAmount: transaction.amount,
  //       transactionId: transaction.id,
  //       paidAt: new Date(),
  //       paymentMethod: 'bank_transfer',
  //       bankName: transaction.bank
  //     }
  //   }
  // );
  
  // Ví dụ với MySQL:
  // await db.query(
  //   'UPDATE orders SET status = ?, paid_amount = ?, transaction_id = ?, paid_at = NOW() WHERE order_code = ?',
  //   ['paid', transaction.amount, transaction.id, orderCode]
  // );
  
  console.log(`   ✅ Đã cập nhật database`);
}

/**
 * Gửi email xác nhận
 */
async function sendConfirmationEmail(orderCode, transaction) {
  console.log(`   📧 Gửi email xác nhận: ${orderCode}`);
  
  // TODO: Implement email sending
  // Ví dụ với Nodemailer, SendGrid, etc.
  // await emailService.send({
  //   to: customer.email,
  //   subject: `Xác nhận thanh toán đơn hàng ${orderCode}`,
  //   html: `
  //     <h2>Thanh toán thành công!</h2>
  //     <p>Đơn hàng: <strong>${orderCode}</strong></p>
  //     <p>Số tiền: <strong>${formatMoney(transaction.amount)}</strong></p>
  //     <p>Thời gian: ${new Date().toLocaleString('vi-VN')}</p>
  //   `
  // });
  
  console.log(`   ✅ Đã gửi email`);
}

/**
 * Gửi thông báo (push notification, SMS, Telegram, etc.)
 */
async function sendNotification(orderCode, transaction) {
  console.log(`   🔔 Gửi thông báo: ${orderCode}`);
  
  // TODO: Implement notification
  // Push notification, SMS, Telegram bot, Discord webhook, etc.
  
  console.log(`   ✅ Đã gửi thông báo`);
}

/**
 * Trigger fulfillment process
 */
async function triggerFulfillment(orderCode, transaction) {
  console.log(`   📦 Kích hoạt fulfillment: ${orderCode}`);
  
  // TODO: Trigger các process tiếp theo
  // - Cập nhật inventory
  // - Tạo shipping label
  // - Gửi đến warehouse
  // - etc.
  
  console.log(`   ✅ Đã kích hoạt fulfillment`);
}

/**
 * Lưu log giao dịch
 */
async function saveTransactionLog(transaction, orderCode) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    transactionId: transaction.id,
    orderCode: orderCode || null,
    bank: transaction.bank,
    amount: transaction.amount,
    content: transaction.content,
    accountNumber: transaction.accountNumber,
    status: orderCode ? 'matched' : 'unmatched',
    rawData: transaction.raw
  };
  
  console.log(`   💾 Lưu log: ${transaction.id}`);
  
  // TODO: Save to database or file
  // await db.transaction_logs.insert(logEntry);
  
  // Hoặc ghi vào file (development)
  if (NODE_ENV === 'development') {
    console.log('   📄 Log entry:', JSON.stringify(logEntry, null, 2));
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Format số tiền
 */
function formatMoney(amount) {
  if (!amount || amount === 0) return '0 VND';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND'
  }).format(amount);
}

/**
 * Generate unique ID
 */
function generateId() {
  return `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================
// ERROR HANDLERS
// ============================================

// 404 handler
app.use((req, res) => {
  console.log(`⚠️  404 - Endpoint không tồn tại: ${req.method} ${req.path}`);
  res.status(404).json({ 
    success: false,
    error: 'Endpoint không tồn tại',
    path: req.path,
    availableEndpoints: {
      home: 'GET /',
      health: 'GET /health',
      webhook: 'POST /api/sepay/webhook',
      test: 'POST /api/test'
    }
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('\n💥 UNHANDLED ERROR:');
  console.error('Message:', err.message);
  console.error('Stack:', err.stack);
  
  res.status(500).json({ 
    success: false,
    error: 'Internal server error',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

// ============================================
// START SERVER
// ============================================

const server = app.listen(PORT, '0.0.0.0', () => {
  console.clear();
  console.log('\n' + '═'.repeat(70));
  console.log('║' + ' '.repeat(68) + '║');
  console.log('║' + ' '.repeat(15) + '🚀 SEPAY WEBHOOK API - MBANK' + ' '.repeat(26) + '║');
  console.log('║' + ' '.repeat(68) + '║');
  console.log('═'.repeat(70));
  console.log('');
  console.log('  📡 Server đang chạy');
  console.log(`  🌐 Port: ${PORT}`);
  console.log(`  🏦 Ngân hàng: MBank (Maritime Bank)`);
  console.log(`  🔗 Webhook URL: /api/sepay/webhook`);
  console.log(`  ⏰ Khởi động: ${new Date().toLocaleString('vi-VN')}`);
  console.log(`  🖥️  Environment: ${NODE_ENV}`);
  console.log(`  📦 Node version: ${process.version}`);
  console.log('');
  console.log('═'.repeat(70));
  console.log('  ✅ Sẵn sàng nhận webhook từ Sepay!');
  console.log('═'.repeat(70) + '\n');
});

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

process.on('SIGTERM', () => {
  console.log('\n👋 Nhận tín hiệu SIGTERM - Đang tắt server...');
  server.close(() => {
    console.log('✅ Server đã tắt an toàn');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n\n👋 Nhận tín hiệu SIGINT (Ctrl+C) - Đang tắt server...');
  server.close(() => {
    console.log('✅ Server đã tắt an toàn');
    process.exit(0);
  });
});

process.on('uncaughtException', (err) => {
  console.error('\n💥 UNCAUGHT EXCEPTION:');
  console.error(err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('\n💥 UNHANDLED REJECTION:');
  console.error('Promise:', promise);
  console.error('Reason:', reason);
});

// Export for testing
module.exports = app;
