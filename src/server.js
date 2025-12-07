/**
 * ============================================
 * SEPAY WEBHOOK API FOR MBANK
 * ============================================
 * Nhận và xử lý thông báo giao dịch từ Sepay
 * Version: 1.0.0
 * Node.js: >= 18.0.0
 * ============================================
 */

const express = require('express');
const app = express();

// Cấu hình
const PORT = process.env.PORT || 3000;
const ENV = process.env.NODE_ENV || 'production';

// ============================================
// MIDDLEWARE
// ============================================

// Parse JSON và URL-encoded data
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS headers
app.use(function(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Request logging
app.use(function(req, res, next) {
  var timestamp = new Date().toISOString();
  var method = req.method;
  var path = req.path;
  var ip = req.ip || req.connection.remoteAddress;
  
  console.log('[' + timestamp + '] ' + method + ' ' + path + ' - IP: ' + ip);
  next();
});

// ============================================
// ROUTES
// ============================================

/**
 * GET / - Home endpoint
 * Thông tin cơ bản về service
 */
app.get('/', function(req, res) {
  var response = { 
    success: true,
    service: 'Sepay Webhook API',
    version: '1.0.0',
    status: 'running',
    bank: 'MBank (Maritime Bank)',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    memory: {
      used: Math.floor(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
      total: Math.floor(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB'
    },
    endpoints: {
      home: 'GET /',
      health: 'GET /health',
      webhook: 'POST /api/sepay/webhook',
      test: 'POST /api/test'
    }
  };
  
  res.json(response);
});

/**
 * GET /health - Health check
 * Dùng cho monitoring và uptime check
 */
app.get('/health', function(req, res) {
  var health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()) + ' seconds',
    environment: ENV,
    nodeVersion: process.version
  };
  
  res.json(health);
});

/**
 * POST /api/test - Test endpoint
 * Để test API có nhận được request không
 */
app.post('/api/test', function(req, res) {
  console.log('\n========== TEST REQUEST ==========');
  console.log('Body:', JSON.stringify(req.body, null, 2));
  console.log('==================================\n');
  
  res.json({
    success: true,
    message: 'Test endpoint is working',
    received: req.body,
    timestamp: new Date().toISOString()
  });
});

/**
 * POST /api/sepay/webhook - Main webhook endpoint
 * Nhận thông báo giao dịch từ Sepay
 */
app.post('/api/sepay/webhook', function(req, res) {
  var startTime = Date.now();
  
  try {
    // Log webhook nhận được
    console.log('\n' + '='.repeat(70));
    console.log('🔔 WEBHOOK TU SEPAY - MBANK');
    console.log('='.repeat(70));
    console.log('⏰ Thoi gian:', new Date().toISOString());
    console.log('📍 IP:', req.ip || 'unknown');
    console.log('📦 Data:', JSON.stringify(req.body, null, 2));
    console.log('='.repeat(70));

    var data = req.body;

    // Validate dữ liệu
    if (!data || Object.keys(data).length === 0) {
      console.log('⚠️  Khong co du lieu\n');
      return res.status(200).json({ 
        success: false, 
        message: 'No data received'
      });
    }

    // Parse thông tin giao dịch
    var transaction = parseTransaction(data);
    
    // Log thông tin
    logTransaction(transaction);

    // Xử lý giao dịch tiền VÀO
    if (transaction.amountIn > 0) {
      processPayment(transaction);
    } else if (transaction.amountOut > 0) {
      console.log('💸 Giao dich tien RA - bo qua\n');
    } else {
      console.log('❓ Khong xac dinh duoc loai giao dich\n');
    }

    // Tính thời gian xử lý
    var processingTime = Date.now() - startTime;
    console.log('⚡ Thoi gian xu ly:', processingTime + 'ms');
    console.log('='.repeat(70) + '\n');

    // Trả về 200 OK cho Sepay
    res.status(200).json({ 
      success: true,
      message: 'Webhook processed successfully',
      transactionId: transaction.id,
      processingTime: processingTime + 'ms',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('\n' + '❌'.repeat(35));
    console.error('💥 LOI KHI XU LY WEBHOOK:');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    console.error('❌'.repeat(35) + '\n');

    // Vẫn trả về 200 để Sepay không retry
    res.status(200).json({ 
      success: false,
      message: 'Error processing webhook',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ============================================
// FUNCTIONS
// ============================================

/**
 * Parse dữ liệu từ Sepay
 */
function parseTransaction(data) {
  return {
    id: data.id || data.transaction_id || data.transferId || generateId(),
    bank: data.gateway || data.bank_brand_name || 'MBBank',
    accountNumber: data.account_number || data.accountNumber || '',
    subAccount: data.sub_account || '',
    amountIn: parseFloat(data.amount_in || data.transferAmount || data.credit || 0),
    amountOut: parseFloat(data.amount_out || data.debit || 0),
    accumulated: parseFloat(data.accumulated || data.balance || 0),
    content: String(data.transaction_content || data.description || data.transferContent || '').trim(),
    code: data.code || data.transaction_code || '',
    referenceNumber: data.reference_number || data.ref || '',
    date: data.transaction_date || data.when || data.transactionDate || new Date().toISOString(),
    raw: data
  };
}

/**
 * Log thông tin giao dịch
 */
function logTransaction(transaction) {
  console.log('\n💰 THONG TIN GIAO DICH:');
  console.log('├─ ID:', transaction.id);
  console.log('├─ Ngan hang:', transaction.bank);
  console.log('├─ So TK:', transaction.accountNumber || 'N/A');
  console.log('├─ Tien VAO:', formatMoney(transaction.amountIn));
  console.log('├─ Tien RA:', formatMoney(transaction.amountOut));
  console.log('├─ So du:', formatMoney(transaction.accumulated));
  console.log('├─ Noi dung:', '"' + transaction.content + '"');
  console.log('├─ Ma GD:', transaction.code || 'N/A');
  console.log('├─ Ma tham chieu:', transaction.referenceNumber || 'N/A');
  console.log('└─ Thoi gian:', transaction.date);
}

/**
 * Xử lý thanh toán
 */
function processPayment(transaction) {
  console.log('\n💳 BAT DAU XU LY THANH TOAN');
  console.log('━'.repeat(70));
  
  // Tìm mã đơn hàng
  var orderCode = findOrderCode(transaction.content);
  
  if (orderCode) {
    console.log('✅ Tim thay ma don: "' + orderCode + '"');
    
    // XỬ LÝ ĐƠN HÀNG Ở ĐÂY
    try {
      // 1. Cập nhật database
      updateOrderStatus(orderCode, transaction);
      
      // 2. Gửi email
      sendConfirmationEmail(orderCode, transaction);
      
      // 3. Gửi thông báo
      sendNotification(orderCode, transaction);
      
      console.log('✅ Da xu ly thanh cong don hang:', orderCode);
      
    } catch (error) {
      console.error('❌ Loi xu ly don hang ' + orderCode + ':', error.message);
    }
    
  } else {
    console.log('⚠️  KHONG TIM THAY MA DON HANG');
    console.log('   📝 Noi dung: "' + transaction.content + '"');
    console.log('   💡 Goi y: Yeu cau khach ghi ro ma don (VD: DH12345)');
  }
  
  // Lưu log
  saveTransactionLog(transaction, orderCode);
  
  console.log('━'.repeat(70));
  console.log('✅ HOAN TAT XU LY THANH TOAN\n');
}

/**
 * Tìm mã đơn hàng
 */
function findOrderCode(content) {
  if (!content) {
    return null;
  }
  
  var normalized = String(content).trim();
  
  // Các pattern tìm kiếm
  var patterns = [
    { regex: /\bDH[\s-]?(\d+)\b/i, name: 'DH + so' },
    { regex: /\bORDER[\s-]?(\d+)\b/i, name: 'ORDER + so' },
    { regex: /\bMD[\s-]?(\d+)\b/i, name: 'MD + so' },
    { regex: /\bINV[\s-]?(\d+)\b/i, name: 'INV + so' },
    { regex: /\b#(\d+)\b/, name: '# + so' },
    { regex: /\bMa don[\s:-]?(\d+)\b/i, name: 'Ma don + so' },
    { regex: /\bMa[\s:-]?(\d+)\b/i, name: 'Ma + so' },
    { regex: /\b(\d{5,})\b/, name: '5 chu so tro len' }
  ];
  
  for (var i = 0; i < patterns.length; i++) {
    var pattern = patterns[i];
    var match = normalized.match(pattern.regex);
    
    if (match) {
      var code = match[1] || match[0];
      console.log('   🔍 Tim thay bang pattern:', pattern.name);
      return code;
    }
  }
  
  return null;
}

/**
 * Cập nhật đơn hàng
 */
function updateOrderStatus(orderCode, transaction) {
  console.log('   📝 Cap nhat don hang:', orderCode);
  
  // TODO: Implement database update
  // await db.orders.update({ code: orderCode }, { 
  //   status: 'paid',
  //   paidAmount: transaction.amountIn,
  //   transactionId: transaction.id
  // });
  
  console.log('   ✅ Da cap nhat database');
}

/**
 * Gửi email xác nhận
 */
function sendConfirmationEmail(orderCode, transaction) {
  console.log('   📧 Gui email xac nhan:', orderCode);
  
  // TODO: Implement email sending
  // await emailService.send({...});
  
  console.log('   ✅ Da gui email');
}

/**
 * Gửi thông báo
 */
function sendNotification(orderCode, transaction) {
  console.log('   🔔 Gui thong bao:', orderCode);
  
  // TODO: Implement notification
  
  console.log('   ✅ Da gui thong bao');
}

/**
 * Lưu log giao dịch
 */
function saveTransactionLog(transaction, orderCode) {
  var logEntry = {
    timestamp: new Date().toISOString(),
    transactionId: transaction.id,
    orderCode: orderCode || null,
    bank: transaction.bank,
    amount: transaction.amountIn,
    content: transaction.content,
    status: orderCode ? 'matched' : 'unmatched'
  };
  
  console.log('   💾 Luu log:', transaction.id);
  
  // TODO: Save to database
  // await db.logs.insert(logEntry);
  
  if (ENV === 'development') {
    console.log('   📄 Log entry:', JSON.stringify(logEntry, null, 2));
  }
}

/**
 * Format tiền tệ
 */
function formatMoney(amount) {
  if (!amount || amount === 0) {
    return '0 VND';
  }
  
  var formatted = parseFloat(amount).toLocaleString('vi-VN');
  return formatted + ' VND';
}

/**
 * Generate unique ID
 */
function generateId() {
  var timestamp = Date.now();
  var random = Math.random().toString(36).substring(2, 11);
  return 'TXN_' + timestamp + '_' + random;
}

// ============================================
// ERROR HANDLERS
// ============================================

// 404 handler
app.use(function(req, res) {
  console.log('⚠️  404 - Not found:', req.method, req.path);
  
  res.status(404).json({ 
    success: false,
    error: 'Endpoint not found',
    path: req.path,
    method: req.method,
    availableEndpoints: [
      'GET /',
      'GET /health',
      'POST /api/sepay/webhook',
      'POST /api/test'
    ]
  });
});

// Global error handler
app.use(function(err, req, res, next) {
  console.error('\n💥 GLOBAL ERROR HANDLER:');
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

var server = app.listen(PORT, '0.0.0.0', function() {
  console.clear();
  console.log('\n' + '═'.repeat(70));
  console.log('║' + ' '.repeat(68) + '║');
  console.log('║' + ' '.repeat(15) + '🚀 SEPAY WEBHOOK API - MBANK' + ' '.repeat(26) + '║');
  console.log('║' + ' '.repeat(68) + '║');
  console.log('═'.repeat(70));
  console.log('');
  console.log('  📡 Server dang chay');
  console.log('  🌐 Port: ' + PORT);
  console.log('  🏦 Ngan hang: MBank (Maritime Bank)');
  console.log('  🔗 Webhook URL: /api/sepay/webhook');
  console.log('  ⏰ Khoi dong: ' + new Date().toLocaleString('vi-VN'));
  console.log('  🖥️  Environment: ' + ENV);
  console.log('  📦 Node version: ' + process.version);
  console.log('');
  console.log('═'.repeat(70));
  console.log('  ✅ San sang nhan webhook tu Sepay!');
  console.log('═'.repeat(70) + '\n');
});

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

process.on('SIGTERM', function() {
  console.log('\n👋 SIGTERM - Dang tat server...');
  server.close(function() {
    console.log('✅ Server da tat');
    process.exit(0);
  });
});

process.on('SIGINT', function() {
  console.log('\n\n👋 SIGINT (Ctrl+C) - Dang tat server...');
  server.close(function() {
    console.log('✅ Server da tat');
    process.exit(0);
  });
});

process.on('uncaughtException', function(err) {
  console.error('\n💥 UNCAUGHT EXCEPTION:');
  console.error(err);
  process.exit(1);
});

process.on('unhandledRejection', function(reason, promise) {
  console.error('\n💥 UNHANDLED REJECTION:');
  console.error('Reason:', reason);
  process.exit(1);
});

// Export app for testing
module.exports = app;
