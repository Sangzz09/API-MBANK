const express = require('express');
const app = express();

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// Webhook endpoint
app.post('/api/sepay/webhook', async (req, res) => {
  try {
    console.log('\n========================================');
    console.log('🔔 WEBHOOK TỪ SEPAY');
    console.log('========================================');
    console.log('Thời gian:', new Date().toISOString());
    console.log('Dữ liệu:', JSON.stringify(req.body, null, 2));
    console.log('========================================\n');

    const data = req.body;

    if (!data || Object.keys(data).length === 0) {
      return res.status(200).json({ 
        success: false, 
        message: 'Không có dữ liệu' 
      });
    }

    const transaction = {
      id: data.id || 'N/A',
      bank: data.gateway || 'MBBank',
      amount: parseFloat(data.amount_in || 0),
      content: data.transaction_content || '',
      date: data.transaction_date || new Date().toISOString()
    };
    
    console.log('💰 Giao dịch:', transaction.amount.toLocaleString('vi-VN'), 'VND');
    console.log('📝 Nội dung:', transaction.content);

    if (transaction.amount > 0) {
      const orderCode = findOrderCode(transaction.content);
      if (orderCode) {
        console.log('✅ Mã đơn:', orderCode);
      } else {
        console.log('⚠️  Không tìm thấy mã đơn');
      }
    }

    res.status(200).json({ 
      success: true,
      message: 'OK',
      transactionId: transaction.id
    });

  } catch (error) {
    console.error('❌ Lỗi:', error);
    res.status(200).json({ 
      success: false,
      error: error.message 
    });
  }
});

function findOrderCode(content) {
  if (!content) return null;
  const patterns = [
    /dh[\s-]?(\d+)/i,
    /order[\s-]?(\d+)/i,
    /#(\d+)/,
    /(\d{5,})/
  ];
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) return match[1] || match[0];
  }
  return null;
}

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   🚀 SEPAY WEBHOOK API ĐANG CHẠY     ║');
  console.log('╚════════════════════════════════════════╝');
  console.log(`📡 Port: ${PORT}`);
  console.log(`🔗 Webhook: /api/sepay/webhook`);
  console.log(`⏰ ${new Date().toLocaleString('vi-VN')}`);
  console.log('═══════════════════════════════════════════\n');
});

process.on('SIGTERM', () => process.exit(0));
