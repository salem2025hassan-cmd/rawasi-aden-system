const express = require('express');
const cors = require('cors');
const path = require('path');

// إعداد تطبيق Express
const app = express();
const PORT = process.env.PORT || 5500;

// البرمجيات الوسيطة (Middleware)
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// خدمة الملفات الثابتة للواجهة الأمامية (HTML, CSS, JS, Images)
const publicDir = path.join(__dirname, '..');
app.use(express.static(publicDir));

// مسارات واجهات برمجة التطبيقات (API Routes)
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/purchases', require('./routes/purchases'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/billing', require('./routes/billing'));
app.use('/api/quotations', require('./routes/quotations'));
app.use('/api/boq', require('./routes/boq'));
app.use('/api/contracts', require('./routes/contracts'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/accounting', require('./routes/accounting'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/suppliers', require('./routes/suppliers'));
app.use('/api/settings', require('./routes/settings'));

// نقطة فحص صحة النظام
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    system: 'رواسي عدن للهندسة والمقاولات',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// المسار الافتراضي يوجه لصفحة النظام الرئيسية
app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// تشغيل الخادم
app.listen(PORT, () => {
  console.log('===========================================================');
  console.log(`🚀 Rawasi Aden System Server is Running!`);
  console.log(`🌐 System URL: http://localhost:${PORT}`);
  console.log(`💼 Port: ${PORT}`);
  console.log('===========================================================');
});

