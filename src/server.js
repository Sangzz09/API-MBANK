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

app.get('/', function(req, res) {
  res.json({
    success: true,
    service: 'Sepay Webhook API',
    version: '1.0.0',
    status: 'running',
    bank: 'MBank',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    endpoints: {
      home: 'GET /',
      health: 'GET /health',
      webhook: 'POST /api/sepay/webhook',
      test: 'POST /api/test'
    }
  });
});

app.get('/health', function(req, res) {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()) + ' seconds',
    environment: ENV,
    nodeVersion: process.version
  });
});

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

// ============================================
// WEBHOOK SEPAY
// ============================================

app.post('/api/sepay/webhook', function(req, res) {
  var startTime = Date.now();
  
  try {
    console.log('\n' + '='.repeat(70));
    console.log('🔔 WEBHOOK TU SEPAY - MBANK');
    console.log('='.repeat(70));
    console.log('⏰ Thoi gian:', new Date().toISOString());
    console.log('📍 IP:', req.ip);
    console.log('📦 Data:', JSON.stringify(req.body, null, 2));
    console.log('='.repeat(70));

    var data = req.body;

    if (!data || Object.keys(data).length === 0) {
      console.log('⚠️  Khong co du lieu\n');
      return res.status(200).json({ 
        success: false, 
        message: 'No data received'
      });
    }

    var transaction = parseTransaction(data);
    logTransaction(transaction);

    if (transaction.amountIn > 0) {
      processPayment(transaction);
    } else if (transaction.amountOut > 0) {
      console.log('💸 Giao dich tien RA - bo qua\n');
    } else {
      console.log('❓ Khong xac dinh duoc loai giao dich\n');
    }

    var processingTime = Date.now() - startTime;

    res.status(200).json({ 
      success: true,
      message: 'Webhook processed successfully',
      transactionId: transaction.id,
      processingTime: processingTime + 'ms',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Loi xu ly webhook:', error);

    res.status(200).json({
      success: false,
      message: 'Error processing webhook',
      error: error.message
    });
  }
});

// ============================================
// FUNCTIONS
// ============================================

function parseTransaction(data) {
  return {
    id: data.id || generateId(),
    bank: data.bank_brand_name || data.gateway || 'MBBank',
    accountNumber: data.account_number || '',
    amountIn: parseFloat(data.amount_in || 0),
    amountOut: parseFloat(data.amount_out || 0),
    accumulated: parseFloat(data.accumulated || 0),
    content: String(data.transaction_content || '').trim(),
    code: data.code || '',
    referenceNumber: data.reference_number || '',
    date: data.transaction_date || new Date().toISOString(),
    raw: data
  };
}

function logTransaction(tx) {
  console.log('💰 GIAO DICH:');
  console.log('├─ ID:', tx.id);
  console.log('├─ Ngan hang:', tx.bank);
  console.log('├─ So TK:', tx.accountNumber);
  console.log('├─ Tien vao:', formatMoney(tx.amountIn));
  console.log('├─ Noi dung:', tx.content);
  console.log('└─ Thoi gian:', tx.date);
}

function processPayment(transaction) {
  console.log('\n💳 Xu ly thanh toan...');
  console.log('   So tien:', formatMoney(transaction.amountIn));
  console.log('   Noi dung:', transaction.content);
  console.log('   (TODO: Ket noi DB, cap nhat don hang, thong bao...)');
}

function formatMoney(amount) {
  return parseFloat(amount).toLocaleString('vi-VN') + ' VND';
}

function generateId() {
  return 'TXN_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
}

// 404
app.use(function(req, res) {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path
  });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, '0.0.0.0', function() {
  console.clear();
  console.log('\n🚀 SEPAY WEBHOOK API - MBANK');
  console.log('📡 Port:', PORT);
  console.log('🔗 Webhook URL: /api/sepay/webhook');
  console.log('⏰ Start:', new Date().toLocaleString('vi-VN'));
  console.log('=============================================\n');
});

module.exports = app;
