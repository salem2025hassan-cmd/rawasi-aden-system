/* عروض الأسعار - رواسي عدن للهندسة والمقاولات */
const Quotations = {
  items: [],
  clients: [],
  projects: [],
  list: [],
  editingId: null,

  async init() {
    await Promise.all([this.loadLookups(), this.loadList()]);
    this.resetForm();
  },

  async loadLookups() {
    try {
      const [c, p] = await Promise.all([fetch('/api/clients'), fetch('/api/projects')]);
      const cj = await c.json(), pj = await p.json();
      this.clients = cj.success ? (cj.data || []) : [];
      this.projects = pj.success ? (pj.data || []) : [];
      this.fillSelects();
    } catch (e) {
      console.error('Error loading lookups for quotations:', e);
    }
  },

  fillSelects() {
    const c = document.getElementById('quotationClient');
    const p = document.getElementById('quotationProject');
    if (c) {
      c.innerHTML = '<option value="">اختر العميل</option>' + this.clients.map(x => `<option value="${x.id}">${this.esc(x.name)}</option>`).join('');
    }
    if (p) {
      p.innerHTML = '<option value="">بدون مشروع محدد</option>' + this.projects.map(x => `<option value="${x.id}">${this.esc(x.name)}</option>`).join('');
    }
  },

  // تنظيف وتحويل الأرقام (يدعم الأرقام العربية المشرقية والإنجليزية والفواصل المالية)
  parseNumber(val) {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    let s = String(val).trim();
    if (!s) return 0;

    // تحويل الأرقام المشرقية (العربية) إلى أرقام قياسية
    const easternDigits = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9' };
    s = s.replace(/[٠-٩]/g, d => easternDigits[d]);

    // معالجة فواصل الآلاف والفواصل العشرية
    s = s.replace(/,/g, '').replace(/،/g, '.').replace(/\s+/g, '');
    const num = parseFloat(s);
    return isNaN(num) ? 0 : num;
  },

  // الحصول على رمز أو مسمى العملة المحددة حالياً
  getCurrency() {
    const select = document.getElementById('quotationCurrency');
    if (!select) return 'ر.ي';
    if (select.value === 'custom') {
      const customInput = document.getElementById('quotationCustomCurrency');
      return (customInput && customInput.value.trim()) ? customInput.value.trim() : 'عملة مخصصة';
    }
    return select.value || 'ر.ي';
  },

  // ضبط العملة برمجياً
  setCurrency(curr) {
    const select = document.getElementById('quotationCurrency');
    const customInput = document.getElementById('quotationCustomCurrency');
    if (!select) return;

    const standardValues = ['ر.ي', 'ر.س', '$', 'EUR'];
    const target = curr ? String(curr).trim() : 'ر.ي';

    if (standardValues.includes(target)) {
      select.value = target;
      if (customInput) customInput.style.display = 'none';
    } else {
      select.value = 'custom';
      if (customInput) {
        customInput.style.display = 'inline-block';
        customInput.value = target;
      }
    }
    this.onCurrencyChange();
  },

  // عند تغيير العملة من القائمة المنسدلة
  onCurrencyChange() {
    const select = document.getElementById('quotationCurrency');
    const customInput = document.getElementById('quotationCustomCurrency');
    if (select && customInput) {
      if (select.value === 'custom') {
        customInput.style.display = 'inline-block';
        customInput.focus();
      } else {
        customInput.style.display = 'none';
      }
    }

    const curr = this.getCurrency();

    // تحديث كافة الشارات والعناوين في الصفحة فورياً
    document.querySelectorAll('.quotation-curr-badge').forEach(el => {
      el.textContent = curr;
    });

    // تحديث إجماليات السطور مع العملة الجديدة
    this.items.forEach((_, i) => this.updateLineTotal(i));

    // تحديث الإجمالي الكلي والتفقيط
    this.renderTotalsOnly();
  },

  // عند اختيار عميل أو مشروع، استنتاج العملة الافتراضية الخاصة به إذا كانت متوفرة
  onClientOrProjectChange() {
    const pId = document.getElementById('quotationProject')?.value;
    const cId = document.getElementById('quotationClient')?.value;

    if (pId) {
      const proj = this.projects.find(x => String(x.id) === String(pId));
      if (proj && proj.currency) {
        this.setCurrency(proj.currency);
        return;
      }
    }

    if (cId) {
      const client = this.clients.find(x => String(x.id) === String(cId));
      if (client && client.currency) {
        this.setCurrency(client.currency);
      }
    }
  },

  // تفقيط المبالغ وتحويلها إلى كلمات عربية بالعملة المختارة (يدعم الكسور والعملات المختلفة)
  getTafqeet(num, currency) {
    if (num === null || num === undefined || isNaN(num) || Number(num) <= 0) {
      const curMap = { 'ر.ي': 'ريال يمني', 'ر.س': 'ريال سعودي', '$': 'دولار أمريكي', 'USD': 'دولار أمريكي', 'EUR': 'يورو', '€': 'يورو' };
      return `فقط صفر ${curMap[currency] || currency || 'ريال'} لا غير`;
    }

    const n = Number(num);
    const integerPart = Math.floor(n);
    const decimalPart = Math.round((n - integerPart) * 100);

    const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
    const teens = ['عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
    const tens = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
    const hundreds = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];

    function convertGroup(val) {
      if (val === 0) return '';
      const h = Math.floor(val / 100);
      const remainder = val % 100;
      let res = [];
      if (h > 0) res.push(hundreds[h]);
      if (remainder > 0) {
        if (remainder < 10) res.push(ones[remainder]);
        else if (remainder < 20) res.push(teens[remainder - 10]);
        else {
          const o = remainder % 10;
          const t = Math.floor(remainder / 10);
          if (o > 0) res.push(ones[o] + ' و' + tens[t]);
          else res.push(tens[t]);
        }
      }
      return res.join(' و');
    }

    function convertNumberToWords(val) {
      if (val === 0) return '';
      let parts = [];
      const billions = Math.floor(val / 1000000000);
      val %= 1000000000;
      const millions = Math.floor(val / 1000000);
      val %= 1000000;
      const thousands = Math.floor(val / 1000);
      const units = val % 1000;

      if (billions > 0) {
        if (billions === 1) parts.push('مليار');
        else if (billions === 2) parts.push('ملياران');
        else if (billions <= 10) parts.push(convertGroup(billions) + ' مليارات');
        else parts.push(convertGroup(billions) + ' مليار');
      }
      if (millions > 0) {
        if (millions === 1) parts.push('مليون');
        else if (millions === 2) parts.push('مليونان');
        else if (millions <= 10) parts.push(convertGroup(millions) + ' ملايين');
        else parts.push(convertGroup(millions) + ' مليون');
      }
      if (thousands > 0) {
        if (thousands === 1) parts.push('ألف');
        else if (thousands === 2) parts.push('ألفان');
        else if (thousands <= 10) parts.push(convertGroup(thousands) + ' آلاف');
        else parts.push(convertGroup(thousands) + ' ألف');
      }
      if (units > 0) {
        parts.push(convertGroup(units));
      }
      return parts.join(' و');
    }

    const intWords = convertNumberToWords(integerPart);
    let decWords = '';
    if (decimalPart > 0) {
      decWords = convertNumberToWords(decimalPart);
    }

    let mainCurrency = 'ريال يمني';
    let subCurrency = 'فلس';
    if (currency === 'ر.س') {
      mainCurrency = 'ريال سعودي';
      subCurrency = 'هللة';
    } else if (currency === '$' || currency === 'USD') {
      mainCurrency = 'دولار أمريكي';
      subCurrency = 'سنت';
    } else if (currency === 'EUR' || currency === '€') {
      mainCurrency = 'يورو';
      subCurrency = 'سنت';
    } else if (currency) {
      mainCurrency = currency;
      subCurrency = 'جزء';
    }

    let finalString = 'فقط ' + intWords + ' ' + mainCurrency;
    if (decWords) {
      finalString += ' و' + decWords + ' ' + subCurrency;
    }
    finalString += ' لا غير';
    return finalString;
  },

  // إضافة سطر جديد في جدول البنود
  addItem(data = { description: '', unit: 'وحدة', quantity: '', unit_price: '' }, shouldFocus = true) {
    this.items.push({
      description: data.description || '',
      unit: data.unit || 'وحدة',
      quantity: data.quantity !== undefined ? data.quantity : '',
      unit_price: data.unit_price !== undefined ? data.unit_price : ''
    });
    this.renderItems();

    if (shouldFocus) {
      const nextIdx = this.items.length - 1;
      setTimeout(() => {
        const descInput = document.getElementById(`quotationDesc_${nextIdx}`);
        if (descInput) descInput.focus();
      }, 50);
    }
  },

  // حذف سطر بند
  removeItem(i) {
    if (this.items.length <= 1) {
      this.items = [{ description: '', unit: 'وحدة', quantity: '', unit_price: '' }];
      this.renderItems();
      return;
    }
    this.items.splice(i, 1);
    this.renderItems();
  },

  // الانتقال التلقائي للسطر التالي عند ضغط Enter في خانة السعر
  onPriceKeyDown(e, i) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (i === this.items.length - 1) {
        this.addItem();
      } else {
        const nextDesc = document.getElementById(`quotationDesc_${i + 1}`);
        if (nextDesc) nextDesc.focus();
      }
    }
  },

  // تحديث بيانات البند لحظياً أثناء الكتابة (Real-time update)
  update(i, key, value) {
    if (!this.items[i]) return;

    if (key === 'quantity' || key === 'unit_price') {
      this.items[i][key] = value;
      this.updateLineTotal(i);
      this.renderTotalsOnly();
    } else {
      this.items[i][key] = value;
    }
  },

  // تحديث خلية إجمالي البند فقط دون إعادة رسم كامل الجدول لضمان سلاسة الكتابة
  updateLineTotal(i) {
    const it = this.items[i];
    if (!it) return;
    const qty = this.parseNumber(it.quantity);
    const price = this.parseNumber(it.unit_price);
    const lineTotal = qty * price;
    const curr = this.getCurrency();

    const cell = document.getElementById(`quotationLineTotal_${i}`);
    if (cell) {
      cell.innerHTML = `<strong>${this.money(lineTotal)}</strong> <small class="quotation-curr-badge">${this.esc(curr)}</small>`;
    }
  },

  // رسم جدول البنود
  renderItems() {
    const tbody = document.getElementById('quotationItemsBody');
    if (!tbody) return;
    const curr = this.getCurrency();

    tbody.innerHTML = this.items.map((it, i) => {
      const qty = this.parseNumber(it.quantity);
      const price = this.parseNumber(it.unit_price);
      const lineTotal = qty * price;

      return `
        <tr id="quotationRow_${i}">
          <td class="text-center" style="font-weight:bold; color:var(--text-secondary);">${i + 1}</td>
          <td>
            <input class="form-control" id="quotationDesc_${i}" value="${this.esc(it.description)}" oninput="Quotations.update(${i},'description',this.value)" placeholder="وصف البند / الأعمال">
          </td>
          <td>
            <input class="form-control" id="quotationUnit_${i}" value="${this.esc(it.unit || 'وحدة')}" oninput="Quotations.update(${i},'unit',this.value)" placeholder="م2 / حبة / متر">
          </td>
          <td>
            <input class="form-control quotation-num" id="quotationQty_${i}" type="text" inputmode="decimal" value="${it.quantity !== undefined ? it.quantity : ''}" placeholder="0" onfocus="this.select()" oninput="Quotations.update(${i},'quantity',this.value)">
          </td>
          <td>
            <input class="form-control quotation-num" id="quotationPrice_${i}" type="text" inputmode="decimal" value="${it.unit_price !== undefined ? it.unit_price : ''}" placeholder="0.00" onfocus="this.select()" oninput="Quotations.update(${i},'unit_price',this.value)" onkeydown="Quotations.onPriceKeyDown(event, ${i})">
          </td>
          <td class="quotation-line-total text-left" id="quotationLineTotal_${i}">
            <strong>${this.money(lineTotal)}</strong> <small class="quotation-curr-badge">${this.esc(curr)}</small>
          </td>
          <td class="text-center">
            <button type="button" class="btn btn-danger btn-sm" style="padding:4px 8px;" onclick="Quotations.removeItem(${i})" title="حذف هذا البند">✕</button>
          </td>
        </tr>`;
    }).join('');

    this.renderTotalsOnly();
  },

  // تحديث كروت الإجماليات والتفقيط والعملة لحظياً
  renderTotalsOnly() {
    const curr = this.getCurrency();
    let total = 0;
    let totalQty = 0;
    let activeItemsCount = 0;

    this.items.forEach(it => {
      const q = this.parseNumber(it.quantity);
      const p = this.parseNumber(it.unit_price);
      total += (q * p);
      totalQty += q;
      if ((it.description && it.description.trim()) || q > 0 || p > 0) {
        activeItemsCount++;
      }
    });

    // تحديث بطاقة الإجمالي الكلي
    const totalEl = document.getElementById('quotationTotal');
    if (totalEl) {
      totalEl.textContent = `${this.money(total)} ${curr}`;
    }

    // تحديث عدد البنود ومجموع الكميات
    const countEl = document.getElementById('quotationItemsCount');
    if (countEl) countEl.textContent = String(activeItemsCount || this.items.length);

    const qtyEl = document.getElementById('quotationTotalQuantity');
    if (qtyEl) qtyEl.textContent = this.money(totalQty);

    // تحديث التفقيط بالكلمات
    const tafqeetEl = document.getElementById('quotationTafqeet');
    if (tafqeetEl) {
      tafqeetEl.textContent = this.getTafqeet(total, curr);
    }

    // تحديث كافة شارات العملة
    document.querySelectorAll('.quotation-curr-badge').forEach(el => {
      el.textContent = curr;
    });
  },

  // حفظ أو تحديث عرض السعر
  async save() {
    const cleanItems = this.items.map(x => ({
      description: String(x.description || '').trim(),
      unit: String(x.unit || 'وحدة').trim(),
      quantity: this.parseNumber(x.quantity),
      unit_price: this.parseNumber(x.unit_price)
    })).filter(x => x.description && x.quantity > 0);

    if (!cleanItems.length) {
      return App.showToast('يرجى إضافة بند واحد على الأقل مع وصف وكمية وسعر صالحين', 'error');
    }

    const payload = {
      client_id: document.getElementById('quotationClient')?.value || null,
      project_id: document.getElementById('quotationProject')?.value || null,
      date: document.getElementById('quotationDate')?.value || new Date().toISOString().split('T')[0],
      valid_until: document.getElementById('quotationValidUntil')?.value || null,
      currency: this.getCurrency(),
      status: document.getElementById('quotationStatus')?.value || 'مسودة',
      notes: document.getElementById('quotationNotes')?.value || '',
      items: cleanItems
    };

    try {
      let res, json;
      if (this.editingId) {
        res = await fetch(`/api/quotations/${this.editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        json = await res.json();
        if (!json.success) throw new Error(json.message);
        App.showToast('تم تحديث عرض السعر بنجاح ✅', 'success');
      } else {
        res = await fetch('/api/quotations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        json = await res.json();
        if (!json.success) throw new Error(json.message);
        App.showToast(`تم حفظ عرض السعر ${json.quotation_no || ''} بنجاح ✅`, 'success');
      }

      await this.loadList();
      this.resetForm();
    } catch (e) {
      console.error(e);
      App.showToast(e.message || 'تعذر حفظ عرض السعر', 'error');
    }
  },

  // تفريغ النموذج وإعادته لحالة الإنشاء الجديد
  resetForm() {
    this.editingId = null;

    ['quotationClient', 'quotationProject', 'quotationValidUntil', 'quotationNotes'].forEach(id => {
      const e = document.getElementById(id);
      if (e) e.value = '';
    });

    const statusEl = document.getElementById('quotationStatus');
    if (statusEl) statusEl.value = 'مسودة';

    const d = document.getElementById('quotationDate');
    if (d) d.value = new Date().toISOString().split('T')[0];

    const titleEl = document.getElementById('quotationFormTitle');
    if (titleEl) titleEl.textContent = 'بيانات عرض السعر';

    const badgeEl = document.getElementById('quotationEditingBadge');
    if (badgeEl) badgeEl.style.display = 'none';

    const saveBtn = document.getElementById('quotationSaveBtn');
    if (saveBtn) saveBtn.textContent = 'حفظ عرض السعر';

    this.setCurrency('ر.ي');

    this.items = [];
    this.addItem({ description: '', unit: 'وحدة', quantity: '', unit_price: '' }, false);
  },

  // تحميل عرض سعر سابق للتعديل
  async edit(id) {
    try {
      const res = await fetch(`/api/quotations/${id}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.message);

      const q = json.data;
      this.editingId = q.id;

      const titleEl = document.getElementById('quotationFormTitle');
      if (titleEl) titleEl.textContent = `تعديل عرض سعر: ${q.quotation_no}`;

      const badgeEl = document.getElementById('quotationEditingBadge');
      if (badgeEl) badgeEl.style.display = 'inline-block';

      const saveBtn = document.getElementById('quotationSaveBtn');
      if (saveBtn) saveBtn.textContent = 'تحديث عرض السعر';

      const c = document.getElementById('quotationClient');
      if (c) c.value = q.client_id || '';

      const p = document.getElementById('quotationProject');
      if (p) p.value = q.project_id || '';

      const d = document.getElementById('quotationDate');
      if (d) d.value = q.date || '';

      const v = document.getElementById('quotationValidUntil');
      if (v) v.value = q.valid_until || '';

      const statusEl = document.getElementById('quotationStatus');
      if (statusEl) statusEl.value = q.status || 'مسودة';

      const notesEl = document.getElementById('quotationNotes');
      if (notesEl) notesEl.value = q.notes || '';

      this.setCurrency(q.currency || 'ر.ي');

      this.items = (q.items && q.items.length) ? q.items.map(it => ({
        description: it.description,
        unit: it.unit,
        quantity: it.quantity,
        unit_price: it.unit_price
      })) : [{ description: '', unit: 'وحدة', quantity: '', unit_price: '' }];

      this.renderItems();

      // التمرير إلى النموذج
      const view = document.getElementById('quotationsView');
      if (view) view.scrollIntoView({ behavior: 'smooth' });

      App.showToast(`تم تحميل عرض السعر ${q.quotation_no} للتعديل ✏️`, 'info');
    } catch (e) {
      console.error(e);
      App.showToast(e.message || 'تعذر تحميل عرض السعر للتعديل', 'error');
    }
  },

  // جلب قائمة عروض الأسعار المسجلة
  async loadList() {
    try {
      const res = await fetch('/api/quotations');
      const json = await res.json();
      this.list = json.success ? (json.data || []) : [];
      this.renderList();
    } catch (e) {
      console.error('Error loading quotations list:', e);
    }
  },

  // رسم جدول العروض المحفوظة
  renderList() {
    const body = document.getElementById('quotationsTableBody');
    if (!body) return;

    if (!this.list.length) {
      body.innerHTML = '<tr><td colspan="7" class="empty-state">لا توجد عروض أسعار حتى الآن</td></tr>';
      return;
    }

    body.innerHTML = this.list.map(q => `
      <tr>
        <td><strong>${this.esc(q.quotation_no)}</strong></td>
        <td>${q.date || '-'}</td>
        <td>${this.esc(q.client_name || 'غير محدد')}</td>
        <td>${this.esc(q.project_name || '-')}</td>
        <td><strong style="color:var(--gold-light);">${this.money(q.total_amount)} ${this.esc(q.currency || 'ر.ي')}</strong></td>
        <td><span class="badge ${q.status === 'معتمد' ? 'badge-active' : 'badge-inactive'}">${this.esc(q.status || 'مسودة')}</span></td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="Quotations.print(${q.id})">🖨️ طباعة</button>
          <button class="btn btn-primary btn-sm" onclick="Quotations.edit(${q.id})">✏️ تعديل</button>
          <button class="btn btn-danger btn-sm" onclick="Quotations.remove(${q.id})">حذف</button>
        </td>
      </tr>`).join('');
  },

  // حذف عرض السعر
  async remove(id) {
    if (!confirm('هل تريد بالتأكيد حذف عرض السعر هذا؟')) return;
    try {
      const r = await fetch('/api/quotations/' + id, { method: 'DELETE' });
      const j = await r.json();
      if (j.success) {
        App.showToast('تم حذف عرض السعر بنجاح', 'success');
        if (this.editingId === id) this.resetForm();
        this.loadList();
      } else {
        App.showToast(j.message || 'تعذر حذف عرض السعر', 'error');
      }
    } catch (e) {
      console.error(e);
      App.showToast('حدث خطأ أثناء حذف عرض السعر', 'error');
    }
  },

  // تقسيم بنود عرض السعر هندسياً بحساب دقيق لارتفاع كل بند لضمان عدم قص أي سطر أو بند نهائياً
  paginateItems(items, hasNotes) {
    if (window.App && typeof App.paginatePrintItems === 'function') {
      return App.paginatePrintItems(items, { hasNotes, capSingle: 540, capPage1: 780, capMid: 900, capLast: 680 });
    }
    return [items];
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
      const printDateTime = `${now.toLocaleDateString('ar-YE')} - ${now.toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' })}`;

      let currentItemIndex = 0;
      let pagesHtml = '';

      pages.forEach((pageItems, pageIdx) => {
        const pageNum = pageIdx + 1;
        const isFirstPage = (pageIdx === 0);
        const isLastPage = (pageIdx === totalPages - 1);
        const startIndex = currentItemIndex;
        currentItemIndex += pageItems.length;

        pagesHtml += `
          <div class="rawasi-print-page quotation-page-${pageNum}">
            <div class="rawasi-page-content">

              ${isFirstPage ? `
                <div class="quotation-print-meta">تاريخ ووقت الطباعة: ${this.esc(printDateTime)}</div>
                
                <div class="quotation-header-box">
                  <div class="quotation-title-block">
                    <div style="font-size: 11pt; font-weight: 800; color: #1e293b; margin-bottom: 3px;">شركة رواسي عدن للهندسة والمقاولات</div>
                    <h1>عرض سعر</h1>
                    <div class="quotation-no-badge">رقم العرض: <b>${this.esc(q.quotation_no)}</b></div>
                  </div>
                  <div class="quotation-meta-grid">
                    <div><span>التاريخ:</span> <b>${this.esc(q.date || '-')}</b></div>
                    <div><span>صالح حتى:</span> <b>${this.esc(q.valid_until || '-')}</b></div>
                    <div><span>العملة:</span> <b>${this.esc(curr)}</b></div>
                  </div>
                </div>

                <div class="quotation-client-bar">
                  <span class="client-item"><b>السادة:</b> ${this.esc(q.client_name || 'عميل مباشر')}</span>
                  ${q.client_phone ? `<span class="client-item"><b>هاتف:</b> ${this.esc(q.client_phone)}</span>` : ''}
                  <span class="client-item"><b>المشروع:</b> ${this.esc(q.project_name || 'عام / غير محدد')}</span>
                </div>
              ` : `
                <div class="quotation-continuation-header">
                  <div class="cont-title">عرض سعر رقم: <b>${this.esc(q.quotation_no)}</b> (تكملة جدول الأعمال)</div>
                  <div class="cont-page-num">صفحة ${pageNum} من ${totalPages}</div>
                </div>
              `}

              <table class="quotation-print-table">
                <thead>
                  <tr>
                    <th style="width:32px;">#</th>
                    <th>وصف البند / الأعمال</th>
                    <th style="width:65px;">الوحدة</th>
                    <th style="width:60px;">الكمية</th>
                    <th style="width:95px;">سعر الوحدة (${this.esc(curr)})</th>
                    <th style="width:105px;">الإجمالي (${this.esc(curr)})</th>
                  </tr>
                </thead>
                <tbody>
                  ${pageItems.map((x, i) => `
                    <tr>
                      <td class="center-cell">${startIndex + i + 1}</td>
                      <td class="desc-cell">${this.esc(x.description)}</td>
                      <td class="center-cell">${this.esc(x.unit || 'وحدة')}</td>
                      <td class="center-cell">${this.money(x.quantity)}</td>
                      <td class="num-cell">${this.money(x.unit_price)}</td>
                      <td class="num-cell" style="font-weight:bold;">${this.money(x.total)}</td>
                    </tr>`).join('')}
                </tbody>
                ${isLastPage ? `
                  <tfoot>
                    <tr class="quotation-total-tr">
                      <td colspan="5" class="total-label">الإجمالي الكلي:</td>
                      <td class="total-val">${this.money(q.total_amount)} ${this.esc(curr)}</td>
                    </tr>
                  </tfoot>
                ` : ''}
              </table>

              ${!isLastPage ? `
                <div class="quotation-page-footer-note">صفحة ${pageNum} من ${totalPages} — (يتبع في الصفحة التالية ⬅️)</div>
              ` : ''}

              ${isLastPage ? `
                <div class="quotation-tafqeet-box">
                  <b>المبلغ كتابةً:</b> ${this.esc(words)}
                </div>

                ${hasNotes ? `
                  <div class="quotation-notes-box">
                    <b>الشروط والملاحظات:</b>
                    <div>${this.esc(q.notes).replace(/\n/g, '<br>')}</div>
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

                <div style="text-align:left; font-size:7.5pt; color:#888; margin-top:3px;">صفحة ${pageNum} من ${totalPages}</div>
              ` : ''}

            </div>
          </div>
        `;
      });

      area.innerHTML = pagesHtml;
      App.printWithRawasiLetterhead(area);
    } catch (e) {
      console.error(e);
      App.showToast(e.message || 'تعذر إعداد طباعة عرض السعر', 'error');
    }
  },

  money(n) {
    if (n === null || n === undefined || isNaN(n)) return '0';
    return Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  },

  esc(v) {
    return String(v ?? '').replace(/[&<>'"]/g, c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[c]));
  }
};

window.Quotations = Quotations;
