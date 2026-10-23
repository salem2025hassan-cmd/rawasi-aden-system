/**
 * إدارة العمليات المحاسبية، السندات، حركة الصندوق، والعهد - شركة رواسي عدن
 */

const Accounting = {
  clients: [],
  suppliers: [],
  projects: [],

  async init() {
    await this.loadDropdowns();
    await this.loadCashMovement();
    await this.loadRecentCustodySummary();
  },

  _targetClientSelectId: null,
  _targetSupplierSelectId: null,

  async loadDropdowns() {
    try {
      const [cRes, sRes, pRes] = await Promise.all([
        fetch('/api/clients').then(r => r.json()),
        fetch('/api/suppliers').then(r => r.json()),
        fetch('/api/projects').then(r => r.json())
      ]);

      if (cRes.success) {
        this.clients = cRes.data;
        this.populateSelect('rcClientSelect', cRes.data, 'name');
        this.populateSelect('modalRcClientSelect', cRes.data, 'name');
        this.populateSelect('statementClientSelect', cRes.data, 'name');
        this.populateSelect('projClientSelect', cRes.data, 'name');
      }
      if (sRes.success) {
        this.suppliers = sRes.data;
        this.populateSelect('expSupplierSelect', sRes.data, 'name');
      }
      if (pRes.success) {
        this.projects = pRes.data;
        this.populateSelect('rcProjectSelect', pRes.data, 'name');
        this.populateSelect('modalRcProjectSelect', pRes.data, 'name');
        this.populateSelect('expProjectSelect', pRes.data, 'name');
      }
    } catch (e) {
      console.error('Error loading dropdowns:', e);
    }
  },

  populateSelect(elementId, items, displayField) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const defaultOption = el.options[0] ? el.options[0].outerHTML : '<option value="">اختر...</option>';
    el.innerHTML = defaultOption + items.map(item => `<option value="${item.id}">${item[displayField]}</option>`).join('');
  },

  // ================== تفقيط الأرقام وتحويلها إلى كلمات عربية ==================
  tafqeet(num, currency = 'ر.ي') {
    if (!num || isNaN(num) || num <= 0) return '';
    num = Math.floor(Number(num));

    const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
    const teens = ['عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
    const tens = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
    const hundreds = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];

    function convertGroup(n) {
      let res = [];
      const h = Math.floor(n / 100);
      const remainder = n % 100;

      if (h > 0) res.push(hundreds[h]);

      if (remainder > 0) {
        if (remainder < 10) {
          res.push(ones[remainder]);
        } else if (remainder < 20) {
          res.push(teens[remainder - 10]);
        } else {
          const o = remainder % 10;
          const t = Math.floor(remainder / 10);
          if (o > 0) {
            res.push(ones[o] + ' و' + tens[t]);
          } else {
            res.push(tens[t]);
          }
        }
      }
      return res.join(' و');
    }

    let parts = [];
    const billions = Math.floor(num / 1000000000);
    num %= 1000000000;
    const millions = Math.floor(num / 1000000);
    num %= 1000000;
    const thousands = Math.floor(num / 1000);
    const units = num % 1000;

    if (billions > 0) {
      parts.push(convertGroup(billions) + (billions === 1 ? ' مليار' : (billions === 2 ? ' ملياران' : (billions <= 10 ? ' مليارات' : ' مليار'))));
    }
    if (millions > 0) {
      parts.push(convertGroup(millions) + (millions === 1 ? ' مليون' : (millions === 2 ? ' مليونان' : (millions <= 10 ? ' ملايين' : ' مليون'))));
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

    let currName = 'ريال يمني';
    if (currency === 'ر.س') currName = 'ريال سعودي';
    else if (currency === '$' || currency === 'USD') currName = 'دولار أمريكي';

    return 'فقط ' + parts.join(' و') + ' ' + currName + ' لا غير';
  },

  // جلب رقم السند التالي تلقائياً
  async fetchNextVoucherNo(type, badgeElementId) {
    try {
      const res = await fetch(`/api/payments/next-number?type=${encodeURIComponent(type)}`);
      const json = await res.json();
      const badge = document.getElementById(badgeElementId);
      if (badge && json.success && json.next_no) {
        badge.textContent = json.next_no;
      }
    } catch (e) {}
  },

  // تحديث التفقيط اللحظي للمبلغ أثناء الكتابة
  updateLiveTafqeet(amountInputId, displayElementId, currencySelectId) {
    const input = document.getElementById(amountInputId);
    const display = document.getElementById(displayElementId);
    const currSelect = document.getElementById(currencySelectId);
    if (!input || !display) return;
    const amount = Number(input.value) || 0;
    const curr = currSelect ? currSelect.value : 'ر.ي';
    if (amount > 0) {
      display.style.display = 'block';
      display.textContent = 'المبلغ كتابةً: ' + this.tafqeet(amount, curr);
    } else {
      display.style.display = 'none';
      display.textContent = '';
    }
  },

  // فتح نافذة منبثقة لتسجيل سند قبض جديد
  async openNewReceiptModal() {
    this.loadDropdowns();
    const dateInput = document.getElementById('modalRcDate');
    const form = document.getElementById('modalReceiptForm');
    if (form) form.reset();
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

    // جلب رقم السند التالي
    this.fetchNextVoucherNo('قبض', 'nextRcNumberBadge');

    // تفعيل التفقيط اللحظي
    const amtInput = document.getElementById('modalRcAmount');
    const currSelect = document.getElementById('modalRcCurrency');
    const tafqeetDiv = document.getElementById('modalRcTafqeet');
    if (tafqeetDiv) {
      tafqeetDiv.style.display = 'none';
      tafqeetDiv.textContent = '';
    }
    if (amtInput) {
      amtInput.oninput = () => this.updateLiveTafqeet('modalRcAmount', 'modalRcTafqeet', 'modalRcCurrency');
    }
    if (currSelect) {
      currSelect.onchange = () => this.updateLiveTafqeet('modalRcAmount', 'modalRcTafqeet', 'modalRcCurrency');
    }

    App.openModal('newReceiptModal');
  },

  // حفظ سند قبض من النافذة المنبثقة
  async submitReceiptVoucherModal(e, shouldPrint = true) {
    if (e) e.preventDefault();
    const client_id = document.getElementById('modalRcClientSelect')?.value;
    const recipient = document.getElementById('modalRcPayerName')?.value.trim();
    const project_id = document.getElementById('modalRcProjectSelect')?.value;
    const date = document.getElementById('modalRcDate')?.value;
    const payment_method = document.getElementById('modalRcPaymentMethod')?.value;
    const reference_no = document.getElementById('modalRcRefNo')?.value.trim();
    const amount = document.getElementById('modalRcAmount')?.value;
    const currency = document.getElementById('modalRcCurrency')?.value || 'ر.ي';
    const notes = document.getElementById('modalRcNotes')?.value;

    if (!client_id && !recipient) {
      App.showToast('يرجى اختيار العميل أو كتابة اسم الجهة/الشخص المستلم منه', 'error');
      return;
    }
    if (!amount || Number(amount) <= 0) {
      App.showToast('يرجى تحديد المبلغ بشكل صحيح', 'error');
      return;
    }

    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'قبض',
          client_id,
          recipient,
          project_id,
          reference_no,
          date,
          payment_method,
          amount,
          currency,
          notes
        })
      });
      const data = await res.json();
      if (data.success) {
        App.showToast(`تم حفظ سند القبض بنجاح (${data.receipt_no})`, 'success');
        App.closeModal('newReceiptModal');
        const form = document.getElementById('modalReceiptForm');
        if (form) form.reset();
        
        // تحديث جميع الجداول والشاشات فوراً
        if (window.Vouchers && Vouchers.loadVouchers) Vouchers.loadVouchers();
        App.loadRevenuesTable();
        Reports.loadDashboardKPIs();
        this.loadCashMovement();
        
        // إمكانية الطباعة الفورية
        if (shouldPrint) {
          const clientName = recipient || this.clients.find(c => c.id == client_id)?.name || 'العميل';
          this.printReceipt({
            receipt_no: data.receipt_no,
            date,
            client_name: clientName,
            project_name: this.projects.find(p => p.id == project_id)?.name || '-',
            amount,
            currency,
            payment_method,
            notes,
            reference_no
          });
        }
      } else {
        App.showToast(data.message || 'حدث خطأ أثناء الحفظ', 'error');
      }
    } catch (e) {
      App.showToast('فشل الاتصال بالخادم', 'error');
    }
  },

  // حفظ سند قبض من النموذج السريع (الإيرادات)
  async submitReceiptVoucher(e) {
    if (e) e.preventDefault();
    const client_id = document.getElementById('rcClientSelect').value;
    const project_id = document.getElementById('rcProjectSelect').value;
    const date = document.getElementById('rcDate').value;
    const payment_method = document.getElementById('rcPaymentMethod').value;
    const amount = document.getElementById('rcAmount').value;
    const currency = document.getElementById('rcCurrency')?.value || 'ر.ي';
    const notes = document.getElementById('rcNotes').value;

    if (!amount || Number(amount) <= 0) {
      App.showToast('يرجى تحديد المبلغ بشكل صحيح', 'error');
      return;
    }

    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'قبض',
          client_id,
          project_id,
          date,
          payment_method,
          amount,
          currency,
          notes
        })
      });
      const data = await res.json();
      if (data.success) {
        App.showToast(`تم حفظ سند القبض بنجاح (${data.receipt_no})`, 'success');
        this.resetReceiptForm();
        if (window.Vouchers && Vouchers.loadVouchers) Vouchers.loadVouchers();
        App.loadRevenuesTable();
        Reports.loadDashboardKPIs();
        this.loadCashMovement();
        // إمكانية الطباعة الفورية
        if (confirm(`تم إنشاء سند القبض ${data.receipt_no}. هل تريد طباعة السند الآن؟`)) {
          this.printReceipt({
            receipt_no: data.receipt_no,
            date,
            client_name: this.clients.find(c => c.id == client_id)?.name || 'العميل',
            project_name: this.projects.find(p => p.id == project_id)?.name || '-',
            amount,
            currency,
            payment_method,
            notes
          });
        }
      } else {
        App.showToast(data.message || 'حدث خطأ', 'error');
      }
    } catch (e) {
      App.showToast('فشل الاتصال بالخادم', 'error');
    }
  },

  resetReceiptForm() {
    const form = document.getElementById('quickReceiptForm');
    if (form) form.reset();
    const dateInput = document.getElementById('rcDate');
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
  },

  // حفظ سند صرف من النموذج السريع (المصروفات)
  async submitExpenseVoucher(e) {
    if (e) e.preventDefault();
    const expense_type = document.getElementById('expTypeSelect').value;
    const project_id = document.getElementById('expProjectSelect').value;
    const supplier_id = document.getElementById('expSupplierSelect').value;
    const date = document.getElementById('expDate').value;
    const payment_method = document.getElementById('expPaymentMethod').value;
    const amount = document.getElementById('expAmount').value;
    const currency = document.getElementById('expCurrency')?.value || 'ر.ي';
    const notes = document.getElementById('expNotes').value;

    if (!expense_type || !amount || Number(amount) <= 0) {
      App.showToast('يرجى تحديد نوع المصروف والمبلغ', 'error');
      return;
    }

    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expense_type,
          project_id,
          supplier_id,
          date,
          payment_method,
          amount,
          currency,
          notes
        })
      });
      const data = await res.json();
      if (data.success) {
        App.showToast(`تم حفظ سند الصرف بنجاح (${data.receipt_no})`, 'success');
        this.resetExpenseForm();
        if (window.Vouchers && Vouchers.loadVouchers) Vouchers.loadVouchers();
        Reports.loadDashboardKPIs();
        Projects.loadProjects();
        this.loadCashMovement();
      } else {
        App.showToast(data.message || 'حدث خطأ', 'error');
      }
    } catch (e) {
      App.showToast('فشل الاتصال بالخادم', 'error');
    }
  },

  resetExpenseForm() {
    const form = document.getElementById('quickExpenseForm');
    if (form) form.reset();
    const dateInput = document.getElementById('expDate');
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
  },

  // حفظ النثريات والعهد من النموذج السريع
  async submitCustody(e) {
    if (e) e.preventDefault();
    const operation_type = document.getElementById('custodyTypeSelect').value;
    const employee_name = document.getElementById('custodyEmpName').value.trim();
    const total_amount = document.getElementById('custodyTotalAmount').value;
    const currency = document.getElementById('custodyCurrency')?.value || 'ر.ي';
    const spent_amount = document.getElementById('custodySpentAmount')?.value || 0;
    const date = document.getElementById('custodyDate').value;
    const notes = document.getElementById('custodyNotes')?.value || '';

    if (!employee_name || !total_amount || Number(total_amount) <= 0) {
      App.showToast('يرجى كتابة اسم الموظف وإجمالي العهدة', 'error');
      return;
    }

    try {
      const res = await fetch('/api/accounting/custodies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation_type,
          employee_name,
          total_amount,
          spent_amount,
          currency,
          date,
          notes
        })
      });
      const data = await res.json();
      if (data.success) {
        App.showToast('تم تسجيل حركة العهدة بنجاح', 'success');
        this.loadRecentCustodySummary();
        App.loadCustodyTable();
      } else {
        App.showToast(data.message || 'خطأ', 'error');
      }
    } catch (e) {
      App.showToast('فشل الاتصال بالخادم', 'error');
    }
  },

  // فتح نافذة سند صرف جديد
  async openNewExpenseModal() {
    this.loadDropdowns();
    const form = document.getElementById('modalExpenseForm');
    if (form) form.reset();
    const dateInput = document.getElementById('modalExpDate');
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

    // جلب رقم سند الصرف التالي
    this.fetchNextVoucherNo('صرف', 'nextExpNumberBadge');

    // ملء قوائم المشاريع والموردين
    const projSelect = document.getElementById('modalExpProjectSelect');
    if (projSelect) {
      projSelect.innerHTML = `<option value="">اختر المشروع (اختياري)...</option>` +
        this.projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    }
    const suppSelect = document.getElementById('modalExpSupplierSelect');
    if (suppSelect) {
      suppSelect.innerHTML = `<option value="">اختر المورد (اختياري)...</option>` +
        this.suppliers.map(s => `<option value="${s.id}">${s.name} (${s.category || 'مورد'})</option>`).join('');

      // عند اختيار مورد، تعبئة اسم المستفيد تلقائياً إذا كان الحقل فارغاً
      suppSelect.onchange = () => {
        const supp = this.suppliers.find(s => s.id == suppSelect.value);
        const recipientInput = document.getElementById('modalExpRecipient');
        if (supp && recipientInput && !recipientInput.value) {
          recipientInput.value = supp.name;
        }
      };
    }

    // تفعيل التفقيط اللحظي
    const amtInput = document.getElementById('modalExpAmount');
    const currSelect = document.getElementById('modalExpCurrency');
    const tafqeetDiv = document.getElementById('modalExpTafqeet');
    if (tafqeetDiv) {
      tafqeetDiv.style.display = 'none';
      tafqeetDiv.textContent = '';
    }
    if (amtInput) {
      amtInput.oninput = () => this.updateLiveTafqeet('modalExpAmount', 'modalExpTafqeet', 'modalExpCurrency');
    }
    if (currSelect) {
      currSelect.onchange = () => this.updateLiveTafqeet('modalExpAmount', 'modalExpTafqeet', 'modalExpCurrency');
    }

    App.openModal('newExpenseModal');
  },

  // حفظ سند الصرف من النافذة المنبثقة
  async submitExpenseVoucherModal(e, shouldPrint = true) {
    if (e) e.preventDefault();
    const expense_type = document.getElementById('modalExpTypeSelect')?.value;
    const project_id = document.getElementById('modalExpProjectSelect')?.value;
    const supplier_id = document.getElementById('modalExpSupplierSelect')?.value;
    const recipient = document.getElementById('modalExpRecipient')?.value.trim();
    const reference_no = document.getElementById('modalExpRefNo')?.value.trim();
    const date = document.getElementById('modalExpDate')?.value;
    const payment_method = document.getElementById('modalExpPaymentMethod')?.value;
    const amount = document.getElementById('modalExpAmount')?.value;
    const currency = document.getElementById('modalExpCurrency')?.value || 'ر.ي';
    const notes = document.getElementById('modalExpNotes')?.value;

    if (!expense_type || !amount || Number(amount) <= 0) {
      App.showToast('يرجى تحديد نوع المصروف والمبلغ المطلوب', 'error');
      return;
    }
    if (!recipient && !supplier_id) {
      App.showToast('يرجى كتابة اسم المستفيد (صرفنا إلى الأخ/السادة) أو اختيار المورد', 'error');
      return;
    }

    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expense_type,
          project_id,
          supplier_id,
          recipient,
          reference_no,
          date,
          payment_method,
          amount,
          currency,
          notes
        })
      });
      const data = await res.json();
      if (data.success) {
        App.showToast(`تم حفظ سند الصرف بنجاح (${data.receipt_no})`, 'success');
        App.closeModal('newExpenseModal');
        const form = document.getElementById('modalExpenseForm');
        if (form) form.reset();

        if (window.Vouchers && Vouchers.loadVouchers) Vouchers.loadVouchers();
        App.loadExpensesTable();
        Reports.loadDashboardKPIs();
        if (typeof Projects !== 'undefined' && Projects.loadProjects) {
          Projects.loadProjects();
        }
        this.loadCashMovement();

        if (shouldPrint) {
          const beneficiaryName = recipient || this.suppliers.find(s => s.id == supplier_id)?.name || 'المستفيد';
          this.printExpenseReceipt({
            receipt_no: data.receipt_no,
            date,
            expense_type,
            supplier_name: beneficiaryName,
            project_name: this.projects.find(p => p.id == project_id)?.name || '-',
            amount,
            currency,
            payment_method,
            notes,
            reference_no
          });
        }
      } else {
        App.showToast(data.message || 'حدث خطأ أثناء الحفظ', 'error');
      }
    } catch (e) {
      App.showToast('فشل الاتصال بالخادم', 'error');
    }
  },

  // فتح نافذة تسجيل عهدة جديدة
  openNewCustodyModal() {
    const form = document.getElementById('modalCustodyForm');
    if (form) form.reset();
    const dateInput = document.getElementById('modalCustodyDate');
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
    const remInput = document.getElementById('modalCustodyRemainingAmount');
    if (remInput) remInput.value = '0';
    App.openModal('newCustodyModal');
  },

  calcModalCustodyRemaining() {
    const total = Number(document.getElementById('modalCustodyTotalAmount')?.value) || 0;
    const spent = Number(document.getElementById('modalCustodySpentAmount')?.value) || 0;
    const remEl = document.getElementById('modalCustodyRemainingAmount');
    if (remEl) remEl.value = Math.max(0, total - spent);
  },

  // حفظ العهدة من النافذة المنبثقة
  async submitCustodyModal(e) {
    if (e) e.preventDefault();
    const operation_type = document.getElementById('modalCustodyTypeSelect').value;
    const employee_name = document.getElementById('modalCustodyEmpName').value.trim();
    const date = document.getElementById('modalCustodyDate').value;
    const currency = document.getElementById('modalCustodyCurrency')?.value || 'ر.ي';
    const total_amount = document.getElementById('modalCustodyTotalAmount').value;
    const spent_amount = document.getElementById('modalCustodySpentAmount').value || 0;
    const notes = document.getElementById('modalCustodyNotes').value;

    if (!employee_name || !total_amount || Number(total_amount) <= 0) {
      App.showToast('يرجى إدخال اسم الموظف وإجمالي مبلغ العهدة', 'error');
      return;
    }

    try {
      const res = await fetch('/api/accounting/custodies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operation_type,
          employee_name,
          total_amount,
          spent_amount,
          currency,
          date,
          notes
        })
      });
      const data = await res.json();
      if (data.success) {
        App.showToast('تم تسجيل حركة العهدة بنجاح', 'success');
        App.closeModal('newCustodyModal');
        const form = document.getElementById('modalCustodyForm');
        if (form) form.reset();

        App.loadCustodyTable();
        this.loadRecentCustodySummary();
      } else {
        App.showToast(data.message || 'حدث خطأ', 'error');
      }
    } catch (e) {
      App.showToast('فشل الاتصال بالخادم', 'error');
    }
  },

  // طباعة سند صرف رسمي
  printExpenseReceipt(info) {
    const printArea = document.getElementById('printArea');
    if (!printArea) return;

    let currLabel = 'ريال يمني (ر.ي)';
    if (info.currency === 'ر.س') currLabel = 'ريال سعودي (ر.س)';
    else if (info.currency === '$' || info.currency === 'USD') currLabel = 'دولار أمريكي ($)';

    const words = this.tafqeet(info.amount, info.currency);
    const cfg = (typeof Settings !== 'undefined' && Settings.getPrintConfig) ? Settings.getPrintConfig() : {
      header_title: 'شركة رواسي عدن للهندسة والمقاولات',
      header_subtitle: 'عدن - الجمهورية اليمنية | هاتف: 773413937',
      header_en: 'Rawasi Aden for Engineering & Contracting',
      tax_no: 'س.ت: 102948 - ر.ض: 3004918',
      slogan: 'نبني الحاضر لنستثمر المستقبل',
      show_logo: '1',
      show_stamp: '1',
      sig1: 'المستلم',
      sig2: 'أمين الصندوق / المحاسب',
      sig3: 'اعتماد الإدارة',
      border_style: 'classic',
      accent_color: '#dc2626',
      footer_notes: 'تعتبر هذه السندات والوثائق رسمية ومعتمدة من الإدارة المالية'
    };

    let borderCss = 'border: 3px double #0f2744;';
    if (cfg.border_style === 'modern') borderCss = 'border: 2px solid #dc2626;';
    else if (cfg.border_style === 'minimal') borderCss = 'border: 1px solid #cbd5e1;';
    else if (cfg.border_style === 'none') borderCss = 'border: none;';

    const showLogo = (cfg.show_logo === '1' || cfg.show_logo === 1 || cfg.show_logo === true);
    const showStamp = (cfg.show_stamp === '1' || cfg.show_stamp === 1 || cfg.show_stamp === true);

    printArea.innerHTML = `
      <div style="direction: rtl; font-family: 'Cairo', 'Tajawal', sans-serif; padding: 30px; ${borderCss} border-radius: 8px; max-width: 820px; margin: auto; background: #ffffff; color: #111;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #dc2626; padding-bottom: 15px; margin-bottom: 20px;">
          <div style="display: flex; align-items: center; gap: 14px;">
            ${showLogo ? '<img src="images/logo.svg" alt="Logo" style="height: 56px; width: 56px; object-fit: contain;">' : ''}
            <div>
              <h2 style="color: #0f2744; margin: 0; font-size: 1.4rem; font-weight: 800;">${cfg.header_title}</h2>
              ${cfg.header_en ? `<div style="font-size: 0.8rem; color: #b8911c; font-weight: 700; margin-top: 2px;">${cfg.header_en}</div>` : ''}
              <p style="margin: 4px 0 0 0; color: #555; font-size: 0.85rem;">${cfg.header_subtitle}</p>
              ${cfg.tax_no ? `<p style="margin: 2px 0 0 0; color: #777; font-size: 0.78rem;">${cfg.tax_no}</p>` : ''}
            </div>
          </div>
          <div style="text-align: left;">
            <h3 style="color: #dc2626; margin: 0; font-size: 1.4rem; font-weight: 800;">سند صرف نقد / شيك</h3>
            <div style="margin: 4px 0; font-weight: bold; font-size: 1.05rem; color: #0f2744;">رقم السند: ${info.receipt_no}</div>
            <div style="font-size: 0.85rem; color: #666;">التاريخ: ${info.date}</div>
          </div>
        </div>

        <table style="width: 100%; font-size: 1rem; margin-bottom: 25px; border-collapse: collapse;">
          <tr style="height: 40px;">
            <td style="width: 25%; font-weight: bold; color: #333;">صرفنا إلى الأخ/السادة:</td>
            <td style="border-bottom: 1px dashed #333; font-weight: bold; color: #0f2744; font-size: 1.05rem;">${info.supplier_name && info.supplier_name !== '-' ? info.supplier_name : 'المستفيد الميداني'}</td>
          </tr>
          <tr style="height: 40px;">
            <td style="font-weight: bold; color: #333;">مبلغ وقدره:</td>
            <td style="border-bottom: 1px dashed #333; font-weight: bold; font-size: 1.18rem; color: #dc2626;">
              ${App.formatNumber(info.amount)} ${currLabel}
            </td>
          </tr>
          <tr style="height: 40px;">
            <td style="font-weight: bold; color: #333;">المبلغ كتابة:</td>
            <td style="border-bottom: 1px dashed #333; font-weight: bold; color: #b8860b;">
              ${words}
            </td>
          </tr>
          <tr style="height: 40px;">
            <td style="font-weight: bold; color: #333;">نوع المصروف:</td>
            <td style="border-bottom: 1px dashed #333; font-weight: bold;">${info.expense_type || 'مصروفات مشاريع'}</td>
          </tr>
          <tr style="height: 40px;">
            <td style="font-weight: bold; color: #333;">المشروع التابع له:</td>
            <td style="border-bottom: 1px dashed #333;">${info.project_name || 'عام'}</td>
          </tr>
          <tr style="height: 40px;">
            <td style="font-weight: bold; color: #333;">طريقة الدفع:</td>
            <td style="border-bottom: 1px dashed #333;">${info.payment_method || 'نقدي'}${info.reference_no ? ` (رقم المرجع/الشيك: ${info.reference_no})` : ''}</td>
          </tr>
          <tr style="height: 40px;">
            <td style="font-weight: bold; color: #333;">وذلك عن:</td>
            <td style="border-bottom: 1px dashed #333;">${info.notes || 'مصروفات وأعمال'}</td>
          </tr>
        </table>

        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 45px; padding: 0 30px; text-align: center;">
          <div>
            <p style="font-weight: bold; margin-bottom: 40px; color: #0f2744;">${cfg.sig1 || 'المستلم'}</p>
            <p style="color: #666;">............................</p>
          </div>
          <div>
            <p style="font-weight: bold; margin-bottom: 40px; color: #0f2744;">${cfg.sig2 || 'أمين الصندوق / المحاسب'}</p>
            <p style="color: #666;">............................</p>
          </div>
          <div>
            <p style="font-weight: bold; margin-bottom: 15px; color: #0f2744;">${cfg.sig3 || 'اعتماد الإدارة'}</p>
            ${showStamp ? '<div style="width: 75px; height: 75px; border: 2px dashed #bbb; border-radius: 50%; margin: auto;"></div>' : '<p style="color: #666; margin-top: 25px;">............................</p>'}
          </div>
        </div>

        ${cfg.footer_notes ? `<div style="margin-top: 25px; padding-top: 8px; border-top: 1px solid #e2e8f0; font-size: 0.78rem; color: #777; text-align: center;">${cfg.footer_notes}</div>` : ''}
      </div>
    `;

    App.printWithRawasiLetterhead(printArea);
  },

  // طباعة تجريبية لورقة السند من الإعدادات
  printTestReceipt() {
    this.printReceipt({
      receipt_no: 'RC-2026-0008',
      date: new Date().toISOString().split('T')[0],
      client_name: 'علوي محمد باعبيد',
      amount: 1000,
      currency: '$',
      project_name: 'مدرسة التواهي النموذجية',
      payment_method: 'نقدي',
      notes: 'دفعة أعمال مقاولات وهندسة (نموذج تجريبي للطباعة)'
    });
  },

  // تحديث أرقام بطاقة العهدة في لوحة التحكم
  async loadRecentCustodySummary() {
    try {
      const res = await fetch('/api/accounting/custodies');
      const data = await res.json();
      if (data.success && data.data.length > 0) {
        const latest = data.data[0];
        const totalEl = document.getElementById('custodySummaryTotal');
        const spentEl = document.getElementById('custodySummarySpent');
        const remainEl = document.getElementById('custodySummaryRemain');
        const curr = latest.currency || 'ر.ي';
        if (totalEl) totalEl.textContent = `${App.formatNumber(latest.total_amount)} ${curr}`;
        if (spentEl) spentEl.textContent = `${App.formatNumber(latest.spent_amount)} ${curr}`;
        if (remainEl) remainEl.textContent = `${App.formatNumber(latest.remaining_amount)} ${curr}`;
      }
    } catch (e) {}
  },

  // جلب وتحديث أرقام حركة الصندوق والبنك
  async loadCashMovement() {
    try {
      const res = await fetch('/api/accounting/cash-movements');
      const data = await res.json();
      if (data.success) {
        const s = data.summary;
        const prevBalEl = document.getElementById('cashPrevBalance');
        const inEl = document.getElementById('cashIncome');
        const outEl = document.getElementById('cashExpense');
        const withEl = document.getElementById('cashWithdrawal');
        const curBalEl = document.getElementById('cashCurBalance');

        if (prevBalEl) prevBalEl.textContent = App.formatNumber(s.initial_balance || 50000);
        if (inEl) inEl.textContent = App.formatNumber(s.total_cash_in || 25000);
        if (outEl) outEl.textContent = App.formatNumber(s.total_cash_out || 15000);
        if (withEl) withEl.textContent = App.formatNumber(s.total_withdrawals || 5000);
        if (curBalEl) curBalEl.textContent = App.formatNumber(s.current_balance || 55000);
      }
    } catch (e) {
      console.error('Error loading cash movements:', e);
    }
  },

  // تجهيز وطباعة سند رسمي مع التفقيط والعملة المحددة
  printReceipt(info) {
    const printArea = document.getElementById('printArea');
    if (!printArea) return;

    const cfg = (typeof Settings !== 'undefined' && Settings.getPrintConfig) ? Settings.getPrintConfig() : {
      header_title: 'شركة رواسي عدن للهندسة والمقاولات',
      header_subtitle: 'عدن - الجمهورية اليمنية | هاتف: 773413937',
      header_en: 'Rawasi Aden for Engineering & Contracting',
      tax_no: 'س.ت: 102948 - ر.ض: 3004918',
      slogan: 'نبني الحاضر لنستثمر المستقبل',
      show_logo: '1',
      show_stamp: '1',
      sig1: 'المستلم / المحاسب',
      sig2: 'المدير العام',
      sig3: 'الختم الرسمي',
      border_style: 'classic',
      accent_color: '#d4af37',
      footer_notes: 'تعتبر هذه السندات والوثائق رسمية ومعتمدة من الإدارة المالية'
    };

    let currLabel = 'ريال يمني (ر.ي)';
    if (info.currency === 'ر.س') currLabel = 'ريال سعودي (ر.س)';
    else if (info.currency === '$' || info.currency === 'USD') currLabel = 'دولار أمريكي ($)';

    const words = this.tafqeet(info.amount, info.currency);

    let borderCss = 'border: 3px double #0f2744;';
    if (cfg.border_style === 'modern') borderCss = `border: 2px solid ${cfg.accent_color};`;
    else if (cfg.border_style === 'minimal') borderCss = 'border: 1px solid #cbd5e1;';
    else if (cfg.border_style === 'none') borderCss = 'border: none;';

    const showLogo = (cfg.show_logo === '1' || cfg.show_logo === 1 || cfg.show_logo === true);
    const showStamp = (cfg.show_stamp === '1' || cfg.show_stamp === 1 || cfg.show_stamp === true);

    printArea.innerHTML = `
      <div style="direction: rtl; font-family: 'Cairo', 'Tajawal', sans-serif; padding: 32px; ${borderCss} border-radius: 8px; max-width: 820px; margin: auto; background: #ffffff; color: #111;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid ${cfg.accent_color}; padding-bottom: 16px; margin-bottom: 24px;">
          <div style="display: flex; align-items: center; gap: 14px;">
            ${showLogo ? '<img src="images/logo.svg" alt="Logo" style="height: 60px; width: 60px; object-fit: contain;">' : ''}
            <div>
              <h2 style="color: #0f2744; margin: 0; font-size: 1.45rem; font-weight: 800;">${cfg.header_title}</h2>
              ${cfg.header_en ? `<div style="font-size: 0.8rem; color: #b8911c; font-weight: 700; margin-top: 2px;">${cfg.header_en}</div>` : ''}
              <p style="margin: 4px 0 0 0; color: #555; font-size: 0.88rem;">${cfg.header_subtitle}</p>
              ${cfg.tax_no ? `<p style="margin: 2px 0 0 0; color: #777; font-size: 0.78rem;">${cfg.tax_no}</p>` : ''}
            </div>
          </div>
          <div style="text-align: left;">
            <h3 style="color: ${cfg.accent_color}; margin: 0; font-size: 1.5rem; font-weight: 800;">سند قبض رسمي</h3>
            <p style="margin: 6px 0 2px 0; font-weight: bold; font-size: 1.05rem; color: #0f2744;">الرقم: ${info.receipt_no}</p>
            <p style="margin: 0; color: #666; font-size: 0.9rem;">التاريخ: ${info.date}</p>
          </div>
        </div>

        <table style="width: 100%; font-size: 1rem; margin-bottom: 28px; border-collapse: collapse;">
          <tr style="height: 42px;">
            <td style="width: 25%; font-weight: bold; color: #333;">استلمنا من الأخ/السادة:</td>
            <td style="border-bottom: 1px dashed #333; font-weight: bold; color: #0f2744; font-size: 1.05rem;">${info.client_name}</td>
          </tr>
          <tr style="height: 42px;">
            <td style="font-weight: bold; color: #333;">مبلغ وقدره:</td>
            <td style="border-bottom: 1px dashed #333; font-weight: bold; font-size: 1.2rem; color: #059669;">
              ${App.formatNumber(info.amount)} ${currLabel}
            </td>
          </tr>
          <tr style="height: 42px;">
            <td style="font-weight: bold; color: #333;">المبلغ كتابة:</td>
            <td style="border-bottom: 1px dashed #333; font-weight: bold; color: #b8860b; font-size: 1.02rem;">
              ${words}
            </td>
          </tr>
          <tr style="height: 42px;">
            <td style="font-weight: bold; color: #333;">المشروع التابع له:</td>
            <td style="border-bottom: 1px dashed #333; font-size: 0.98rem;">${info.project_name || 'عام'}</td>
          </tr>
          <tr style="height: 42px;">
            <td style="font-weight: bold; color: #333;">طريقة الدفع:</td>
            <td style="border-bottom: 1px dashed #333; font-size: 0.98rem;">${info.payment_method || 'نقدي'}${info.reference_no ? ` (رقم المرجع/الشيك: ${info.reference_no})` : ''}</td>
          </tr>
          <tr style="height: 42px;">
            <td style="font-weight: bold; color: #333;">وذلك عن:</td>
            <td style="border-bottom: 1px dashed #333; font-size: 0.98rem;">${info.notes || 'دفعة أعمال مقاولات وهندسة'}</td>
          </tr>
        </table>

        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 45px; padding: 0 30px; text-align: center;">
          <div>
            <p style="font-weight: bold; margin-bottom: 45px; color: #0f2744;">${cfg.sig1}</p>
            <p style="color: #666;">............................</p>
          </div>
          <div>
            <p style="font-weight: bold; margin-bottom: 45px; color: #0f2744;">${cfg.sig2}</p>
            <p style="color: #666;">............................</p>
          </div>
          <div>
            <p style="font-weight: bold; margin-bottom: 15px; color: #0f2744;">${cfg.sig3}</p>
            ${showStamp ? '<div style="width: 80px; height: 80px; border: 2px dashed #bbb; border-radius: 50%; margin: auto;"></div>' : '<p style="color: #666; margin-top: 30px;">............................</p>'}
          </div>
        </div>

        ${cfg.footer_notes ? `<div style="margin-top: 30px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 0.8rem; color: #777; text-align: center;">${cfg.footer_notes}</div>` : ''}
      </div>
    `;

    App.printWithRawasiLetterhead(printArea);
  },

  // ================== إدارة وخدمات فتح حسابات العملاء ==================
  async openNewClientModal(targetSelectId = null) {
    this._targetClientSelectId = targetSelectId;
    const form = document.getElementById('newClientForm');
    if (form) form.reset();

    if (typeof App !== 'undefined' && App.switchClientModalTab) {
      App.switchClientModalTab('info');
    }

    // تعيين التاريخ الافتراضي
    const opDateInput = document.getElementById('clientOpeningDate');
    if (opDateInput) opDateInput.value = new Date().toISOString().split('T')[0];

    // استعلام وتوليد رقم الحساب المحاسبي الشجري المقترح
    try {
      const res = await fetch('/api/clients/next-account-code');
      const data = await res.json();
      if (data.success && data.next_code) {
        const codeInput = document.getElementById('clientAccountCode');
        const badgeEl = document.getElementById('clientAccountCodeBadge');
        if (codeInput) codeInput.value = data.next_code;
        if (badgeEl) badgeEl.textContent = data.next_code;
      }
    } catch (e) {
      console.warn('Could not fetch next account code:', e);
    }

    App.openModal('newClientModal');
  },

  async submitNewClient(e) {
    if (e) e.preventDefault();
    const nameInput = document.getElementById('clientName');
    const name = nameInput ? nameInput.value.trim() : '';
    const company = document.getElementById('clientCompany') ? document.getElementById('clientCompany').value.trim() : '';
    const contact_person = document.getElementById('clientContactPerson') ? document.getElementById('clientContactPerson').value.trim() : '';
    const phone = document.getElementById('clientPhone') ? document.getElementById('clientPhone').value.trim() : '';
    const email = document.getElementById('clientEmail') ? document.getElementById('clientEmail').value.trim() : '';
    const address = document.getElementById('clientAddress') ? document.getElementById('clientAddress').value.trim() : '';
    const commercial_reg = document.getElementById('clientCommercialReg') ? document.getElementById('clientCommercialReg').value.trim() : '';
    const tax_number = document.getElementById('clientTaxNumber') ? document.getElementById('clientTaxNumber').value.trim() : '';

    const account_code = document.getElementById('clientAccountCode') ? document.getElementById('clientAccountCode').value.trim() : '';
    const currency = document.getElementById('clientCurrency')?.value || 'ر.ي';
    const credit_limit = document.getElementById('clientCreditLimit') ? document.getElementById('clientCreditLimit').value : 0;
    const payment_terms_days = document.getElementById('clientPaymentTerms') ? document.getElementById('clientPaymentTerms').value : 30;
    const account_status = document.getElementById('clientAccountStatus')?.value || 'نشط';

    const previous_balance = document.getElementById('clientPrevBal') ? document.getElementById('clientPrevBal').value : 0;
    const opening_balance_date = document.getElementById('clientOpeningDate') ? document.getElementById('clientOpeningDate').value : new Date().toISOString().split('T')[0];
    const create_opening_entry = document.getElementById('clientCreateOpeningEntry') ? document.getElementById('clientCreateOpeningEntry').checked : true;
    
    const generalNotes = document.getElementById('clientNotes') ? document.getElementById('clientNotes').value.trim() : '';
    const termsNotes = document.getElementById('clientTermsNotes') ? document.getElementById('clientTermsNotes').value.trim() : '';
    const notes = [generalNotes, termsNotes ? 'شروط الائتمان والضمان: ' + termsNotes : '', contact_person ? 'المفوض: ' + contact_person : ''].filter(Boolean).join(' | ');

    if (!name) {
      App.showToast('يرجى إدخال اسم العميل / صاحب الحساب', 'error');
      if (typeof App !== 'undefined' && App.switchClientModalTab) App.switchClientModalTab('info');
      if (nameInput) nameInput.focus();
      return;
    }

    if (!phone) {
      App.showToast('يرجى إدخال رقم الهاتف', 'error');
      if (typeof App !== 'undefined' && App.switchClientModalTab) App.switchClientModalTab('info');
      const phoneInput = document.getElementById('clientPhone');
      if (phoneInput) phoneInput.focus();
      return;
    }

    const form = document.getElementById('newClientForm');
    const submitBtn = form ? form.querySelector('button[type="submit"]') : null;
    const originalBtnHtml = submitBtn ? submitBtn.innerHTML : 'اعتماد وفتح الحساب المحاسبي';

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span>⏳</span> جاري اعتماد وفتح الحساب في شجرة الحسابات...';
    }

    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, company, phone, email, address,
          commercial_reg, tax_number,
          account_code, currency, credit_limit, payment_terms_days, account_status,
          previous_balance, opening_balance_date, create_opening_entry, notes
        })
      });
      const data = await res.json();

      if (res.ok && data.success && data.id) {
        const successMsg = data.message || `تم فتح الحساب المحاسبي (${data.account_code || ''}) للعميل (${name}) بنجاح`;
        App.showToast(successMsg, 'success');
        App.closeModal('newClientModal');
        if (form) form.reset();

        // تحديث القوائم المنسدلة وسجل العملاء والشجرة
        await this.loadDropdowns();
        if (typeof Projects !== 'undefined' && Projects.loadProjects) {
          Projects.loadProjects();
        }
        if (typeof App !== 'undefined' && App.loadClientsTable) {
          App.loadClientsTable();
        }

        // تحديد العميل المضاف تلقائياً في القائمة الهدف إن وجدت
        if (this._targetClientSelectId) {
          const targetEl = document.getElementById(this._targetClientSelectId);
          if (targetEl && data.id) {
            targetEl.value = String(data.id);
          }
          this._targetClientSelectId = null;
        }
      } else {
        App.showToast(data.message || 'فشل في فتح حساب العميل في قاعدة البيانات', 'error');
      }
    } catch (e) {
      console.error('Error adding client account:', e);
      App.showToast('فشل الاتصال بالخادم أو حفظ الحساب', 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHtml;
      }
    }
  },

  // ================== إدارة الموردين ==================
  openNewSupplierModal(targetSelectId = null) {
    this._targetSupplierSelectId = targetSelectId;
    const form = document.getElementById('newSupplierForm');
    if (form) form.reset();
    App.openModal('newSupplierModal');
  },

  async submitNewSupplier(e) {
    if (e) e.preventDefault();
    const nameInput = document.getElementById('suppName');
    const name = nameInput ? nameInput.value.trim() : '';
    const category = document.getElementById('suppCategory') ? document.getElementById('suppCategory').value : 'مواد بناء';
    const phone = document.getElementById('suppPhone') ? document.getElementById('suppPhone').value.trim() : '';
    const address = document.getElementById('suppAddress') ? document.getElementById('suppAddress').value.trim() : '';
    const balance = document.getElementById('suppBalance') ? document.getElementById('suppBalance').value : 0;
    const currency = document.getElementById('suppCurrency')?.value || 'ر.ي';
    const notes = document.getElementById('suppNotes') ? document.getElementById('suppNotes').value.trim() : '';

    if (!name) {
      App.showToast('يرجى إدخال اسم المورد', 'error');
      if (nameInput) nameInput.focus();
      return;
    }

    const form = document.getElementById('newSupplierForm');
    const submitBtn = form ? form.querySelector('button[type="submit"]') : null;
    const originalBtnHtml = submitBtn ? submitBtn.innerHTML : 'حفظ المورد';

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span>⏳</span> جاري الحفظ والتحقق من قاعدة البيانات...';
    }

    try {
      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, category, phone, address, balance, currency, notes
        })
      });
      const data = await res.json();

      if (res.ok && data.success && data.id) {
        const successMsg = data.message || `تم حفظ المورد (${name}) بنجاح وتأكيده في قاعدة البيانات`;
        App.showToast(successMsg, 'success');
        App.closeModal('newSupplierModal');
        if (form) form.reset();

        // تحديث القوائم المنسدلة وسجل الموردين
        await this.loadDropdowns();
        if (typeof App !== 'undefined' && App.loadSuppliersTable) {
          App.loadSuppliersTable();
        }

        // تحديد المورد المضاف تلقائياً في القائمة الهدف إن وجدت
        if (this._targetSupplierSelectId) {
          const targetEl = document.getElementById(this._targetSupplierSelectId);
          if (targetEl && data.id) {
            targetEl.value = String(data.id);
          }
          this._targetSupplierSelectId = null;
        }
      } else {
        App.showToast(data.message || 'فشل في حفظ المورد في قاعدة البيانات', 'error');
      }
    } catch (e) {
      console.error('Error adding supplier:', e);
      App.showToast('فشل الاتصال بالخادم أو حفظ المورد في قاعدة البيانات', 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHtml;
      }
    }
  }
};
