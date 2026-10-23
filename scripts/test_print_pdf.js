const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function testPrint() {
  const res = await fetch('http://localhost:5500/api/quotations/4');
  const json = await res.json();
  const q = json.data;

  // استدعاء ملف quotations.js لفحص دالة paginateItems
  // أو محاكاتها مباشرة للتأكد
  const total = q.items.length;
  const page1Count = Math.min(19, Math.max(Math.ceil(total * 0.58), total - 14));
  const page1Items = q.items.slice(0, page1Count);
  const page2Items = q.items.slice(page1Count);

  console.log(`Total items: ${total}`);
  console.log(`Page 1 items count: ${page1Items.length} (Items 1 to ${page1Items.length})`);
  console.log(`Page 2 items count: ${page2Items.length} (Items ${page1Items.length + 1} to ${total})`);

  // قراءة ملف style.css
  const css = fs.readFileSync(path.join(__dirname, '../css/style.css'), 'utf8');

  // تجهيز HTML كامل بنفس آلية printArea
  const now = new Date();
  const printDateTime = `${now.toLocaleDateString('ar-YE')} - ${now.toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' })}`;
  const curr = q.currency || '$';
  const words = 'فقط ستة آلاف وتسعة وستون دولار أمريكي وخمسون سنت لا غير';

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>عرض سعر ${q.quotation_no}</title>
  <style>
    ${css}
    /* ضمان ظهور منطقة الطباعة في المعاينة والـ PDF */
    body { margin: 0; padding: 0; background: #fff; }
    #printArea { display: block !important; visibility: visible !important; }
  </style>
</head>
<body>
  <div id="printArea" class="rawasi-letterhead-print has-page-bg">
    <!-- الصفحة الأولى -->
    <div class="rawasi-print-page quotation-page-1">
      <img class="rawasi-page-bg" src="assets/letterhead.png" alt="" aria-hidden="true">
      <div class="rawasi-page-content">
        <div class="quotation-print-meta">تاريخ ووقت الطباعة: ${printDateTime}</div>
        
        <div class="quotation-header-box">
          <div class="quotation-title-block">
            <h1>عرض سعر</h1>
            <div class="quotation-no-badge">رقم العرض: <b>${q.quotation_no}</b></div>
          </div>
          <div class="quotation-meta-grid">
            <div><span>التاريخ:</span> <b>${q.date || '-'}</b></div>
            <div><span>صالح حتى:</span> <b>${q.valid_until || '-'}</b></div>
            <div><span>العملة:</span> <b>${curr}</b></div>
          </div>
        </div>

        <div class="quotation-client-bar">
          <span class="client-item"><b>السادة:</b> ${q.client_name || 'عميل مباشر'}</span>
          ${q.client_phone ? `<span class="client-item"><b>هاتف:</b> ${q.client_phone}</span>` : ''}
          <span class="client-item"><b>المشروع:</b> ${q.project_name || 'عام / غير محدد'}</span>
        </div>

        <table class="quotation-print-table">
          <thead>
            <tr>
              <th style="width:32px;">#</th>
              <th>وصف البند / الأعمال</th>
              <th style="width:65px;">الوحدة</th>
              <th style="width:60px;">الكمية</th>
              <th style="width:95px;">سعر الوحدة (${curr})</th>
              <th style="width:105px;">الإجمالي (${curr})</th>
            </tr>
          </thead>
          <tbody>
            ${page1Items.map((x, i) => `
              <tr>
                <td class="center-cell">${i + 1}</td>
                <td class="desc-cell">${x.description}</td>
                <td class="center-cell">${x.unit || 'وحدة'}</td>
                <td class="center-cell">${x.quantity}</td>
                <td class="num-cell">${Number(x.unit_price).toLocaleString()}</td>
                <td class="num-cell" style="font-weight:bold;">${Number(x.total).toLocaleString()}</td>
              </tr>`).join('')}
          </tbody>
        </table>

        <div class="quotation-page-footer-note">صفحة 1 من 2 — (يتبع في الصفحة التالية ⬅️)</div>
      </div>
    </div>

    <!-- الصفحة الثانية -->
    <div class="rawasi-print-page quotation-page-2">
      <img class="rawasi-page-bg" src="assets/letterhead.png" alt="" aria-hidden="true">
      <div class="rawasi-page-content">
        <div class="quotation-continuation-header">
          <div class="cont-title">عرض سعر رقم: <b>${q.quotation_no}</b> (تكملة جدول الأعمال)</div>
          <div class="cont-page-num">صفحة 2 من 2</div>
        </div>

        <table class="quotation-print-table">
          <thead>
            <tr>
              <th style="width:32px;">#</th>
              <th>وصف البند / الأعمال</th>
              <th style="width:65px;">الوحدة</th>
              <th style="width:60px;">الكمية</th>
              <th style="width:95px;">سعر الوحدة (${curr})</th>
              <th style="width:105px;">الإجمالي (${curr})</th>
            </tr>
          </thead>
          <tbody>
            ${page2Items.map((x, i) => `
              <tr>
                <td class="center-cell">${page1Count + i + 1}</td>
                <td class="desc-cell">${x.description}</td>
                <td class="center-cell">${x.unit || 'وحدة'}</td>
                <td class="center-cell">${x.quantity}</td>
                <td class="num-cell">${Number(x.unit_price).toLocaleString()}</td>
                <td class="num-cell" style="font-weight:bold;">${Number(x.total).toLocaleString()}</td>
              </tr>`).join('')}
          </tbody>
          <tfoot>
            <tr class="quotation-total-tr">
              <td colspan="5" class="total-label">الإجمالي الكلي:</td>
              <td class="total-val">${Number(q.total_amount).toLocaleString()} ${curr}</td>
            </tr>
          </tfoot>
        </table>

        <div class="quotation-tafqeet-box">
          <b>المبلغ كتابةً:</b> ${words}
        </div>

        ${q.notes ? `
          <div class="quotation-notes-box">
            <b>الشروط والملاحظات:</b>
            <div>${q.notes.replace(/\n/g, '<br>')}</div>
          </div>
        ` : ''}

        <div class="quotation-signatures-box">
          <div class="sig-col">
            <span class="sig-title">إعداد ومراجعة العرض</span>
            <div class="sig-space"></div>
            <span class="sig-line">التوقيع: _______________________</span>
          </div>
          <div class="sig-col">
            <span class="sig-title">الاعتماد والختم الرسمي</span>
            <div class="sig-space"></div>
            <span class="sig-line">التوقيع / الختم: _______________________</span>
          </div>
        </div>

        <div style="text-align:left; font-size:7.5pt; color:#888; margin-top:3px;">صفحة 2 من 2</div>
      </div>
    </div>
  </div>
</body>
</html>`;

  const htmlPath = path.join(__dirname, '../test_quotation_print.html');
  const pdfPath = path.join(__dirname, '../test_quotation_print.pdf');
  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log('Saved test HTML to:', htmlPath);

  // تشغيل كروم لتوليد PDF
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const cmd = `"${chromePath}" --headless=new --disable-gpu --no-pdf-header-footer --print-to-pdf="${pdfPath}" "http://localhost:5500/test_quotation_print.html"`;
  console.log('Running Chrome to generate PDF...');
  execSync(cmd, { stdio: 'inherit' });

  if (fs.existsSync(pdfPath)) {
    const stats = fs.statSync(pdfPath);
    console.log(`PDF Generated Successfully! Path: ${pdfPath}, Size: ${stats.size} bytes`);
  } else {
    console.error('Failed to create PDF');
  }
}

testPrint().catch(console.error);
