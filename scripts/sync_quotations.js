const fs = require('fs');
const path = require('path');

const srcPath = 'C:/Users/user/Desktop/مجلد جديد (10)/js/quotations.js';
const src = fs.readFileSync(srcPath, 'utf8');

const idxPrint = src.indexOf('  // تجهيز وطباعة العرض على الورقة الرسمية');
const idxMoney = src.indexOf('  money(n) {');

if (idxPrint === -1 || idxMoney === -1) {
  console.error('Could not locate methods in src!');
  process.exit(1);
}

const basePart = src.slice(0, idxPrint);
const helpersPart = src.slice(idxMoney);

const newMethods = `  // تقسيم بنود عرض السعر بذكاء وتوازن بين صفحات A4 الرسمية
  paginateItems(items, hasNotes) {
    const total = items.length;
    // إذا كان العرض صغيراً (13 بنداً أو أقل): يتسع بالكامل في صفحة واحدة رسمية مع الترويسة والختم والتوقيع
    const maxSinglePage = hasNotes ? 13 : 15;
    if (total <= maxSinglePage) {
      return [items];
    }

    // إذا كانت البنود بين 14 و 34 (مثل حالة المستخدم 32 بنداً):
    // نقسمها على صفحتين بحيث تحتوي الصفحة الأولى على الجزء الأكبر من الجدول مع الترويسة وبيانات العميل،
    // والصفحة الثانية تحتوي على التكملة وسطر الإجمالي والتفقيط والشروط والختم والتوقيع
    if (total <= 34) {
      // نحدد للصفحة الأولى بين 17 و 19 بنداً، مع إبقاء الباقي (بين 6 و 15 بنداً) للصفحة الثانية
      const page1Count = Math.min(19, Math.max(Math.ceil(total * 0.58), total - 14));
      return [
        items.slice(0, page1Count),
        items.slice(page1Count)
      ];
    }

    // إذا كانت البنود أكثر من 34 بنداً (3 صفحات أو أكثر):
    const pages = [];
    let idx = 0;
    // الصفحة الأولى
    pages.push(items.slice(idx, idx + 18));
    idx += 18;

    while (idx < total) {
      const remaining = total - idx;
      if (remaining <= 14) {
        pages.push(items.slice(idx));
        break;
      } else if (remaining <= 28) {
        const midCount = Math.ceil(remaining / 2);
        pages.push(items.slice(idx, idx + midCount));
        idx += midCount;
      } else {
        pages.push(items.slice(idx, idx + 21));
        idx += 21;
      }
    }
    return pages;
  },

  // تجهيز وطباعة العرض على الورقة الرسمية لشركة رواسي عدن A4 مقسمة ومتناسقة
  async print(id) {
    try {
      const r = await fetch('/api/quotations/' + id);
      const j = await r.json();
      if (!j.success) throw new Error(j.message);

      const q = j.data;
      const area = document.getElementById('printArea');
      if (!area) return;

      const curr = q.currency || 'ر.ي';
      const words = this.getTafqeet(q.total_amount, curr);
      const allItems = q.items || [];
      const hasNotes = !!(q.notes && q.notes.trim());

      // تقسيم البنود بذكاء بين الصفحات
      const pages = this.paginateItems(allItems, hasNotes);
      const totalPages = pages.length;

      const now = new Date();
      const printDateTime = \`\${now.toLocaleDateString('ar-YE')} - \${now.toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' })}\`;

      let currentItemIndex = 0;
      let pagesHtml = '';

      pages.forEach((pageItems, pageIdx) => {
        const pageNum = pageIdx + 1;
        const isFirstPage = (pageIdx === 0);
        const isLastPage = (pageIdx === totalPages - 1);
        const startIndex = currentItemIndex;
        currentItemIndex += pageItems.length;

        pagesHtml += \`
          <div class="rawasi-print-page quotation-page-\${pageNum}">
            <img class="rawasi-page-bg" src="assets/letterhead.png" alt="" aria-hidden="true">
            <div class="rawasi-page-content">

              \${isFirstPage ? \`
                <div class="quotation-print-meta">تاريخ ووقت الطباعة: \${this.esc(printDateTime)}</div>
                
                <div class="quotation-header-box">
                  <div class="quotation-title-block">
                    <h1>عرض سعر</h1>
                    <div class="quotation-no-badge">رقم العرض: <b>\${this.esc(q.quotation_no)}</b></div>
                  </div>
                  <div class="quotation-meta-grid">
                    <div><span>التاريخ:</span> <b>\${this.esc(q.date || '-')}</b></div>
                    <div><span>صالح حتى:</span> <b>\${this.esc(q.valid_until || '-')}</b></div>
                    <div><span>العملة:</span> <b>\${this.esc(curr)}</b></div>
                  </div>
                </div>

                <div class="quotation-client-bar">
                  <span class="client-item"><b>السادة:</b> \${this.esc(q.client_name || 'عميل مباشر')}</span>
                  \${q.client_phone ? \`<span class="client-item"><b>هاتف:</b> \${this.esc(q.client_phone)}</span>\` : ''}
                  <span class="client-item"><b>المشروع:</b> \${this.esc(q.project_name || 'عام / غير محدد')}</span>
                </div>
              \` : \`
                <div class="quotation-continuation-header">
                  <div class="cont-title">عرض سعر رقم: <b>\${this.esc(q.quotation_no)}</b> (تكملة جدول الأعمال)</div>
                  <div class="cont-page-num">صفحة \${pageNum} من \${totalPages}</div>
                </div>
              \`}

              <table class="quotation-print-table">
                <thead>
                  <tr>
                    <th style="width:32px;">#</th>
                    <th>وصف البند / الأعمال</th>
                    <th style="width:65px;">الوحدة</th>
                    <th style="width:60px;">الكمية</th>
                    <th style="width:95px;">سعر الوحدة (\${this.esc(curr)})</th>
                    <th style="width:105px;">الإجمالي (\${this.esc(curr)})</th>
                  </tr>
                </thead>
                <tbody>
                  \${pageItems.map((x, i) => \`
                    <tr>
                      <td class="center-cell">\${startIndex + i + 1}</td>
                      <td class="desc-cell">\${this.esc(x.description)}</td>
                      <td class="center-cell">\${this.esc(x.unit || 'وحدة')}</td>
                      <td class="center-cell">\${this.money(x.quantity)}</td>
                      <td class="num-cell">\${this.money(x.unit_price)}</td>
                      <td class="num-cell" style="font-weight:bold;">\${this.money(x.total)}</td>
                    </tr>\`).join('')}
                </tbody>
                \${isLastPage ? \`
                  <tfoot>
                    <tr class="quotation-total-tr">
                      <td colspan="5" class="total-label">الإجمالي الكلي:</td>
                      <td class="total-val">\${this.money(q.total_amount)} \${this.esc(curr)}</td>
                    </tr>
                  </tfoot>
                \` : ''}
              </table>

              \${!isLastPage ? \`
                <div class="quotation-page-footer-note">صفحة \${pageNum} من \${totalPages} — (يتبع في الصفحة التالية ⬅️)</div>
              \` : ''}

              \${isLastPage ? \`
                <div class="quotation-tafqeet-box">
                  <b>المبلغ كتابةً:</b> \${this.esc(words)}
                </div>

                \${hasNotes ? \`
                  <div class="quotation-notes-box">
                    <b>الشروط والملاحظات:</b>
                    <div>\${this.esc(q.notes).replace(/\\n/g, '<br>')}</div>
                  </div>
                \` : ''}

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

                <div style="text-align:left; font-size:7.5pt; color:#888; margin-top:3px;">صفحة \${pageNum} من \${totalPages}</div>
              \` : ''}

            </div>
          </div>
        \`;
      });

      area.innerHTML = pagesHtml;
      App.printWithRawasiLetterhead(area);
    } catch (e) {
      console.error(e);
      App.showToast(e.message || 'تعذر إعداد طباعة عرض السعر', 'error');
    }
  },

`;

const fullContent = basePart + newMethods + helpersPart;

// كتابة الملف للوجهات المختلفة
fs.writeFileSync('./js/quotations.js', fullContent, 'utf8');
fs.writeFileSync('./www/js/quotations.js', fullContent, 'utf8');
fs.writeFileSync('C:/Users/user/Desktop/مجلد جديد (10)/js/quotations.js', fullContent, 'utf8');
fs.writeFileSync('C:/Users/user/Desktop/مجلد جديد (10)/www/js/quotations.js', fullContent, 'utf8');

console.log('Successfully updated quotations.js everywhere! File size:', fullContent.length);
