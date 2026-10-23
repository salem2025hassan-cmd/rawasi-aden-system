/**
 * وحدة إدارة وأرشفة الفواتير (نقد، آجل، وسكانر) - شركة رواسي عدن للهندسة والمقاولات
 */

const Invoices = {
  list: [],
  activeTab: 'active', // 'active' أو 'archived'
  filterType: 'all',   // 'all', 'نقد', 'آجل', 'سكانر'
  searchQuery: '',
  items: [],
  editingId: null,

  // متغيرات خاصة بمسح ومرفقات السكانر
  currentScanFile: null, // { file, dataUrl, filename, mimeType }
  mediaStream: null,     // لكاميرا المسح المباشر
  currentAttachmentUrl: null,

  async init() {
    console.log('📄 تهيئة وحدة الفواتير والأرشفة والسكانر...');
    this.setupDragAndDrop();
    this.setupClipboardPaste();
    await this.loadList();
  },

  // إعداد السحب والإفلات لمستندات السكانر
  setupDragAndDrop() {
    const dropZone = document.getElementById('scannerDropZone');
    if (!dropZone) return;

    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.style.borderColor = 'var(--accent-green)';
        dropZone.style.background = 'rgba(16,185,129,0.08)';
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.style.borderColor = 'var(--gold-primary)';
        dropZone.style.background = 'rgba(255,255,255,0.02)';
      }, false);
    });

    dropZone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files && files.length > 0) {
        this.processSelectedFile(files[0]);
      }
    }, false);
  },

  // إعداد اللصق المباشر من الحافظة (Ctrl+V) للفواتير الممسوحة
  setupClipboardPaste() {
    window.addEventListener('paste', (e) => {
      const modal = document.getElementById('scannedInvoiceModal');
      if (!modal || modal.style.display === 'none' || !modal.classList.contains('active')) {
        return;
      }
      const items = (e.clipboardData || e.originalEvent.clipboardData).items;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          this.processSelectedFile(blob, `scan_pasted_${Date.now()}.png`);
          App.showToast('تم لصق صورة الفاتورة الممسوحة من الحافظة بنجاح', 'success');
          break;
        }
      }
    });
  },

  // 1. جلب قائمة الفواتير من الخادم وتحديث الإحصائيات
  async loadList() {
    try {
      const res = await fetch('/api/invoices');
      const json = await res.json();
      if (json.success) {
        this.list = json.data || [];
        this.updateKPIs();
        this.renderList();
      }
    } catch (e) {
      console.error('خطأ في جلب الفواتير:', e);
    }
  },

  // تحديث بطاقات المؤشرات الرقمية
  updateKPIs() {
    const totalAll = this.list.reduce((sum, inv) => sum + (Number(inv.total_amount) || 0), 0);
    const cashTotal = this.list.filter(i => i.invoice_type === 'نقد').reduce((sum, inv) => sum + (Number(inv.total_amount) || 0), 0);
    const creditTotal = this.list.filter(i => i.invoice_type === 'آجل').reduce((sum, inv) => sum + (Number(inv.total_amount) || 0), 0);
    const archivedCount = this.list.filter(i => i.is_archived === 1).length;
    const activeCount = this.list.filter(i => i.is_archived !== 1).length;

    const elTotal = document.getElementById('invKpiTotal');
    const elCash = document.getElementById('invKpiCash');
    const elCredit = document.getElementById('invKpiCredit');
    const elArchived = document.getElementById('invKpiArchived');
    const elActiveBadge = document.getElementById('invActiveBadgeCount');
    const elArchiveBadge = document.getElementById('invArchiveBadgeCount');

    if (elTotal) elTotal.textContent = App.formatNumber(totalAll);
    if (elCash) elCash.textContent = App.formatNumber(cashTotal);
    if (elCredit) elCredit.textContent = App.formatNumber(creditTotal);
    if (elArchived) elArchived.textContent = archivedCount;
    if (elActiveBadge) elActiveBadge.textContent = activeCount;
    if (elArchiveBadge) elArchiveBadge.textContent = archivedCount;
  },

  // التبديل بين تبويب الفواتير النشطة وأرشيف الفواتير
  switchArchiveTab(tab) {
    this.activeTab = tab;
    document.querySelectorAll('.inv-tab-btn').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-tab') === tab);
    });
    this.renderList();
  },

  // تصفية حسب نوع الفاتورة (الكل / نقد / آجل / سكانر)
  setFilterType(type) {
    this.filterType = type;
    document.querySelectorAll('.filter-pills .login-user-pill').forEach(btn => {
      btn.classList.remove('active');
    });
    if (event && event.target) {
      event.target.classList.add('active');
    }
    this.renderList();
  },

  // تصفية بالبحث
  onSearch(query) {
    this.searchQuery = (query || '').toLowerCase().trim();
    this.renderList();
  },

  // رسم جدول الفواتير
  renderList() {
    const tbody = document.getElementById('invoicesTableBody');
    if (!tbody) return;

    // تصفية الفواتير حسب الأرشيف والنوع والبحث
    let filtered = this.list.filter(inv => {
      const matchArchive = (this.activeTab === 'archived') ? (inv.is_archived === 1) : (inv.is_archived !== 1);
      
      let matchType = true;
      if (this.filterType === 'نقد') {
        matchType = (inv.invoice_type === 'نقد' && inv.source !== 'سكانر');
      } else if (this.filterType === 'آجل') {
        matchType = (inv.invoice_type === 'آجل' && inv.source !== 'سكانر');
      } else if (this.filterType === 'سكانر') {
        matchType = (inv.source === 'سكانر');
      }

      let matchSearch = true;
      if (this.searchQuery) {
        const fullText = `${inv.invoice_no || ''} ${inv.client_name || ''} ${inv.client_display_name || ''} ${inv.project_name || ''} ${inv.notes || ''} ${inv.physical_archive_no || ''}`.toLowerCase();
        matchSearch = fullText.includes(this.searchQuery);
      }
      return matchArchive && matchType && matchSearch;
    });

    if (filtered.length === 0) {
      const msg = this.activeTab === 'archived' 
        ? 'لا توجد فواتير في أرشيف النظام مطابقة لخيارات التصفية' 
        : 'لا توجد فواتير مسجلة مطابقة لخيارات التصفية';
      tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 28px; color: var(--text-secondary);">${msg}</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(inv => {
      const isCash = (inv.invoice_type === 'نقد');
      const isScanner = (inv.source === 'سكانر');

      // شارة المصنوع ونوع الدفع
      let typeBadge = '';
      if (isScanner) {
        typeBadge = `<span class="badge" style="background: rgba(245,158,11,0.15); color: var(--accent-amber); border: 1px solid var(--accent-amber); font-weight:700; margin-bottom: 2px; display: inline-block;">📷 سكانر (${this.esc(inv.category || 'أرشيف')})</span><br>`;
      }
      typeBadge += isCash 
        ? `<span class="badge" style="background: rgba(16,185,129,0.15); color: var(--accent-green); border: 1px solid var(--accent-green); font-weight:700;">💵 نقدي</span>`
        : `<span class="badge" style="background: rgba(245,158,11,0.15); color: var(--accent-amber); border: 1px solid var(--accent-amber); font-weight:700;">⏳ آجل</span>`;

      const statusBadge = isCash
        ? `<span class="badge badge-income">مسددة</span>`
        : `<span class="badge badge-active">${inv.status || 'مستحقة'}</span>`;

      const clientName = inv.client_display_name || inv.client_name || 'عميل / جهة مباشرة';
      const projectName = inv.project_name || '-';

      // عمود المستند الممسوح
      let attachmentCell = '<span style="color: var(--text-secondary); font-size: 0.8rem;">-</span>';
      if (inv.attachment_url) {
        const isPdf = (inv.attachment_type && inv.attachment_type.includes('pdf')) || inv.attachment_url.toLowerCase().endsWith('.pdf');
        const icon = isPdf ? '📑' : '🖼️';
        attachmentCell = `
          <button type="button" class="btn btn-secondary btn-sm" onclick="Invoices.viewAttachment('${this.esc(inv.attachment_url)}', '${this.esc(inv.invoice_no)}', '${this.esc(inv.attachment_type || '')}')" title="معاينة المستند الممسوح ضوئياً" style="border-color: rgba(59,130,246,0.5); color: #60a5fa; padding: 2px 8px; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 4px;">
            <span>${icon} عرض المستند</span>
          </button>
        `;
      }

      // زر تبديل الأرشفة
      const archiveBtn = (inv.is_archived === 1)
        ? `<button class="btn btn-secondary btn-sm" onclick="Invoices.toggleArchive(${inv.id})" title="استعادة من الأرشيف" style="color: var(--gold-light);">🔄 استعادة</button>`
        : `<button class="btn btn-secondary btn-sm" onclick="Invoices.toggleArchive(${inv.id})" title="نقل إلى الأرشيف" style="color: #94a3b8;">📦 أرشفة</button>`;

      return `
        <tr>
          <td>
            <strong style="color: var(--gold-light);">${inv.invoice_no}</strong>
            ${inv.physical_archive_no ? `<div style="font-size: 10px; color: #94a3b8;">📁 ${this.esc(inv.physical_archive_no)}</div>` : ''}
          </td>
          <td>
            <div>${inv.date}</div>
            ${inv.due_date && !isCash ? `<div style="font-size: 10px; color: var(--accent-amber);">استحقاق: ${inv.due_date}</div>` : ''}
          </td>
          <td><strong>${this.esc(clientName)}</strong></td>
          <td><span style="color: #e2e8f0; font-weight: 500;">${this.esc(projectName)}</span></td>
          <td>${typeBadge}</td>
          <td><strong style="color: var(--gold-light);">${App.formatNumber(inv.total_amount)} ${inv.currency || 'ر.ي'}</strong></td>
          <td style="text-align: center;">${attachmentCell}</td>
          <td>
            <div>${statusBadge}</div>
            <div style="margin-top: 2px;">${inv.is_archived === 1 ? '<span class="badge" style="background: #334155; color: #cbd5e1; font-size: 10px;">مؤرشفة</span>' : '<span class="badge badge-active" style="font-size: 10px;">نشطة</span>'}</div>
          </td>
          <td style="text-align: center; white-space: nowrap;">
            <button class="btn btn-secondary btn-sm" onclick="Invoices.print(${inv.id})" title="طباعة الفاتورة على ورقة A4 الرسمية">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:middle;"><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/></svg>
              <span>طباعة</span>
            </button>
            ${archiveBtn}
            <button class="btn btn-danger btn-sm" onclick="Invoices.deleteInvoice(${inv.id}, '${inv.invoice_no}')" title="حذف الفاتورة">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style="vertical-align:middle;"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
              <span>حذف</span>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  },

  // 2. إدارة نافذة إنشاء فاتورة نظامية جديدة
  openNewModal() {
    this.editingId = null;
    const form = document.getElementById('newInvoiceForm');
    if (form) form.reset();

    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('invDate');
    if (dateInput) dateInput.value = today;

    const dueDateInput = document.getElementById('invDueDate');
    if (dueDateInput) dueDateInput.value = today;

    const projInput = document.getElementById('invProjectName');
    if (projInput) projInput.value = '';

    // تعبئة قوائم المقترحات
    this.populateSelects();

    this.setModalInvoiceType('نقد');

    this.items = [{ description: '', unit: 'وحدة', quantity: 1, unit_price: 0, completion_percentage: 100, total: 0 }];
    this.renderItemsTable();
    this.calculateTotals();

    App.openModal('newInvoiceModal');
  },

  populateSelects() {
    // قائمة العملاء المسجلين
    const clientSelect = document.getElementById('invClientSelect');
    if (clientSelect) {
      clientSelect.innerHTML = `<option value="">عميل مباشر / كتابة يدوية بالأسفل...</option>` +
        (window.Accounting?.clients || []).map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }

    // تعبئة مقترحات المشاريع للخانة الحرة (الفاتورة العادية)
    const projectsList = document.getElementById('invProjectsList');
    if (projectsList) {
      projectsList.innerHTML = (window.Projects?.list || []).map(p => `<option value="${p.name}">${p.code ? `رمز: ${p.code}` : ''}</option>`).join('');
    }

    // تعبئة مقترحات المشاريع للخانة الحرة (فاتورة السكانر)
    const scanProjectsList = document.getElementById('scanProjectsList');
    if (scanProjectsList) {
      scanProjectsList.innerHTML = (window.Projects?.list || []).map(p => `<option value="${p.name}">${p.code ? `رمز: ${p.code}` : ''}</option>`).join('');
    }

    // قائمة مقترحات الجهات لسكانر
    const scanPartiesList = document.getElementById('scanPartiesList');
    if (scanPartiesList) {
      const clients = (window.Accounting?.clients || []).map(c => `<option value="${c.name}">عميل: ${c.name}</option>`);
      const suppliers = (window.Accounting?.suppliers || []).map(s => `<option value="${s.name}">مورد: ${s.name}</option>`);
      scanPartiesList.innerHTML = [...clients, ...suppliers].join('');
    }
  },

  // التبديل بين نقد وآجل داخل نافذة الإنشاء
  setModalInvoiceType(type) {
    const isCash = (type === 'نقد');
    const inputType = document.getElementById('invTypeInput');
    if (inputType) inputType.value = type;

    const btnCash = document.getElementById('invTypeBtnCash');
    const btnCredit = document.getElementById('invTypeBtnCredit');
    if (btnCash && btnCredit) {
      if (isCash) {
        btnCash.classList.add('active');
        btnCash.style.background = 'var(--accent-green)';
        btnCash.style.color = '#ffffff';
        btnCredit.classList.remove('active');
        btnCredit.style.background = 'transparent';
        btnCredit.style.color = 'var(--text-secondary)';
      } else {
        btnCredit.classList.add('active');
        btnCredit.style.background = 'var(--accent-amber)';
        btnCredit.style.color = '#ffffff';
        btnCash.classList.remove('active');
        btnCash.style.background = 'transparent';
        btnCash.style.color = 'var(--text-secondary)';
      }
    }

    const dueDateGroup = document.getElementById('invDueDateGroup');
    if (dueDateGroup) {
      dueDateGroup.style.display = isCash ? 'none' : 'block';
    }

    const payMethodSelect = document.getElementById('invPayMethod');
    if (payMethodSelect) {
      payMethodSelect.value = isCash ? 'نقدي' : 'آجل';
    }

    const noteHint = document.getElementById('invTypeHintText');
    if (noteHint) {
      noteHint.textContent = isCash 
        ? '💡 الفاتورة النقدية تسجل كمدفوعة فوراً وتغذي رصيد الصندوق'
        : '💡 الفاتورة الآجلة تسجل كمستحقة وتضاف إلى ذمة العميل المالية ومستحقاته';
    }
  },

  // 3. إدارة جدول البنود داخل نافذة الفاتورة النظامية
  addItem() {
    this.items.push({ description: '', unit: 'وحدة', quantity: 1, unit_price: 0, completion_percentage: 100, total: 0 });
    this.renderItemsTable();
  },

  removeItem(index) {
    if (this.items.length <= 1) {
      this.items = [{ description: '', unit: 'وحدة', quantity: 1, unit_price: 0, completion_percentage: 100, total: 0 }];
      this.renderItemsTable();
      this.calculateTotals();
      return;
    }
    this.items.splice(index, 1);
    this.renderItemsTable();
    this.calculateTotals();
  },

  updateItem(index, field, value) {
    if (!this.items[index]) return;
    this.items[index][field] = value;

    if (field === 'quantity' || field === 'unit_price' || field === 'completion_percentage') {
      const qty = Number(this.items[index].quantity) || 0;
      const price = Number(this.items[index].unit_price) || 0;
      const compPercent = (this.items[index].completion_percentage !== '' && !isNaN(Number(this.items[index].completion_percentage)))
        ? Number(this.items[index].completion_percentage)
        : 100;
      const rawTotal = qty * price * (compPercent / 100);
      this.items[index].total = Math.round((rawTotal + Number.EPSILON) * 100) / 100;
      const totCell = document.getElementById(`invItemTotal_${index}`);
      if (totCell) totCell.textContent = App.formatNumber(this.items[index].total);
    }
    this.calculateTotals();
  },

  renderItemsTable() {
    const tbody = document.getElementById('invItemsTableBody');
    if (!tbody) return;

    tbody.innerHTML = this.items.map((it, i) => {
      const compVal = (it.completion_percentage !== undefined && it.completion_percentage !== null) ? it.completion_percentage : 100;
      return `
      <tr>
        <td style="text-align: center; font-weight: bold; width: 32px;">${i + 1}</td>
        <td>
          <input type="text" class="table-input" value="${this.esc(it.description)}" 
            placeholder="بيان الصنف أو العمل..." 
            oninput="Invoices.updateItem(${i}, 'description', this.value)" required>
        </td>
        <td style="width: 75px;">
          <input type="text" class="table-input" value="${this.esc(it.unit || 'وحدة')}" 
            placeholder="وحدة" 
            oninput="Invoices.updateItem(${i}, 'unit', this.value)">
        </td>
        <td style="width: 80px;">
          <input type="number" step="any" min="0" class="table-input" value="${it.quantity !== undefined && it.quantity !== null ? it.quantity : ''}" 
            placeholder="1" 
            oninput="Invoices.updateItem(${i}, 'quantity', this.value)">
        </td>
        <td style="width: 95px;">
          <input type="number" step="any" min="0" class="table-input" value="${it.unit_price !== undefined && it.unit_price !== null ? it.unit_price : ''}" 
            placeholder="0" 
            oninput="Invoices.updateItem(${i}, 'unit_price', this.value)">
        </td>
        <td style="width: 90px;">
          <div style="display: flex; align-items: center; gap: 4px; justify-content: center;">
            <input type="number" step="any" min="0" max="100" class="table-input" value="${compVal}" 
              placeholder="100" 
              style="text-align: center; font-weight: 700; color: var(--gold-light);"
              oninput="Invoices.updateItem(${i}, 'completion_percentage', this.value)">
            <span style="color: var(--gold-light); font-weight: bold; font-size: 0.85rem;">%</span>
          </div>
        </td>
        <td style="width: 110px; text-align: left; font-weight: bold; color: var(--gold-light);" id="invItemTotal_${i}">
          ${App.formatNumber(it.total || 0)}
        </td>
        <td style="width: 40px; text-align: center;">
          <button type="button" class="btn btn-danger btn-sm" style="padding: 2px 6px;" onclick="Invoices.removeItem(${i})" title="حذف السطر">&times;</button>
        </td>
      </tr>
    `;
    }).join('');
  },

  // احتساب الإجماليات والتفقيط
  calculateTotals() {
    const subtotal = this.items.reduce((sum, it) => sum + (Number(it.total) || 0), 0);
    const discount = Number(document.getElementById('invDiscountInput')?.value) || 0;
    const tax = Number(document.getElementById('invTaxInput')?.value) || 0;
    const total = Math.max(0, subtotal - discount + tax);

    const elSub = document.getElementById('invSubtotalDisplay');
    const elTot = document.getElementById('invFinalTotalDisplay');
    const elWords = document.getElementById('invTafqeetDisplay');
    const curr = document.getElementById('invCurrencySelect')?.value || 'ر.ي';

    if (elSub) elSub.textContent = `${App.formatNumber(subtotal)} ${curr}`;
    if (elTot) elTot.textContent = `${App.formatNumber(total)} ${curr}`;
    if (elWords) elWords.textContent = this.getTafqeet(total, curr);
  },

  // 4. حفظ الفاتورة النظامية (مع دعم المشروع المرتبط الحر)
  async submitInvoice(e) {
    if (e) e.preventDefault();

    const invoice_type = document.getElementById('invTypeInput')?.value || 'نقد';
    const client_id = document.getElementById('invClientSelect')?.value || null;
    const custom_client = document.getElementById('invClientCustomName')?.value || '';
    
    // خانة المشروع المرتبط: يستطيع المستخدم كتابة أي شيء يريده
    const enteredProjectName = document.getElementById('invProjectName')?.value?.trim() || '';
    const matchedProject = (window.Projects?.list || []).find(p => p.name === enteredProjectName);
    const project_id = matchedProject ? matchedProject.id : null;
    const project_name = enteredProjectName;

    const date = document.getElementById('invDate')?.value || new Date().toISOString().split('T')[0];
    const due_date = document.getElementById('invDueDate')?.value || date;
    const discount = Number(document.getElementById('invDiscountInput')?.value) || 0;
    const tax_amount = Number(document.getElementById('invTaxInput')?.value) || 0;
    const payment_method = document.getElementById('invPayMethod')?.value || (invoice_type === 'نقد' ? 'نقدي' : 'آجل');
    const currency = document.getElementById('invCurrencySelect')?.value || 'ر.ي';
    const notes = document.getElementById('invNotes')?.value || '';
    const terms = document.getElementById('invTerms')?.value || '';

    const validItems = this.items.filter(it => it.description && it.description.trim());
    if (validItems.length === 0) {
      App.showToast('يرجى إضافة بند واحد على الأقل في الفاتورة', 'error');
      return;
    }

    const subtotal = validItems.reduce((sum, it) => sum + (Number(it.total) || 0), 0);
    const total_amount = Math.max(0, subtotal - discount + tax_amount);

    let finalClientName = custom_client.trim();
    if (client_id && !finalClientName) {
      const opt = document.querySelector(`#invClientSelect option[value="${client_id}"]`);
      if (opt) finalClientName = opt.textContent;
    }

    const payload = {
      invoice_type,
      client_id: client_id ? Number(client_id) : null,
      client_name: finalClientName || 'عميل نقدي مباشر',
      project_id: project_id,
      project_name: project_name, // تسجيل اسم المشروع المكتوب يدوياً أو المختار
      date,
      due_date: (invoice_type === 'آجل') ? due_date : null,
      subtotal,
      discount,
      tax_amount,
      total_amount,
      payment_method,
      currency,
      notes,
      terms,
      items: validItems,
      source: 'نظام'
    };

    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        App.showToast(data.message, 'success');
        App.closeModal('newInvoiceModal');
        await this.loadList();
        if (invoice_type === 'نقد') {
          App.loadCashTable?.();
        } else {
          App.loadClientsTable?.();
        }
      } else {
        App.showToast(data.message || 'فشل حفظ الفاتورة', 'error');
      }
    } catch (err) {
      console.error(err);
      App.showToast('خطأ في الاتصال بالخادم أثناء حفظ الفاتورة', 'error');
    }
  },

  // =========================================================================
  // 5. إدارة نافذة مسح وأرشفة فواتير السكانر (Scanner Invoices)
  // =========================================================================
  
  openScannerModal() {
    this.clearScannedFile();
    const form = document.getElementById('scannedInvoiceForm');
    if (form) form.reset();

    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('scanDate');
    if (dateInput) dateInput.value = today;

    // ترقيم افتراضي مقترح يمكن تغييره
    const invNoInput = document.getElementById('scanInvoiceNo');
    if (invNoInput) {
      const seq = this.list.length + 1;
      invNoInput.value = `SCN-${new Date().getFullYear()}-${String(seq).padStart(4, '0')}`;
    }

    const projInput = document.getElementById('scanProjectName');
    if (projInput) projInput.value = '';

    const archiveCheck = document.getElementById('scanIsArchivedCheck');
    if (archiveCheck) archiveCheck.checked = true;

    this.populateSelects();
    App.openModal('scannedInvoiceModal');
  },

  closeScannerModal() {
    this.stopCameraScan();
    App.closeModal('scannedInvoiceModal');
  },

  // معالجة اختيار ملف ممسوح من الجهاز / السكانر
  onScanFileSelected(event) {
    const file = event.target.files && event.target.files[0];
    if (file) {
      this.processSelectedFile(file);
    }
  },

  // قراءة وعرض الملف الممسوح
  processSelectedFile(file, overrideName) {
    if (!file) return;

    const reader = new FileReader();
    const fileName = overrideName || file.name || `scanned_${Date.now()}.jpg`;
    const mimeType = file.type || 'image/jpeg';
    const isPdf = mimeType.includes('pdf') || fileName.toLowerCase().endsWith('.pdf');

    reader.onload = (e) => {
      const dataUrl = e.target.result;
      this.currentScanFile = {
        file,
        dataUrl,
        filename: fileName,
        mimeType
      };

      // تحديث واجهة المعاينة
      const emptyState = document.getElementById('scannerEmptyState');
      const previewState = document.getElementById('scannerPreviewState');
      const cameraState = document.getElementById('scannerCameraState');
      const container = document.getElementById('scanFilePreviewContainer');
      const nameText = document.getElementById('scanFileNameText');

      if (emptyState) emptyState.style.display = 'none';
      if (cameraState) cameraState.style.display = 'none';
      if (previewState) previewState.style.display = 'block';

      if (container) {
        if (isPdf) {
          container.innerHTML = `
            <div style="padding: 24px; text-align: center; color: var(--gold-light);">
              <div style="font-size: 3rem; margin-bottom: 8px;">📑</div>
              <div style="font-weight: bold;">مستند PDF ممسوح ضوئياً</div>
              <div style="font-size: 0.8rem; color: #94a3b8; margin-top: 4px;">انقر على 'تكبير' لمعاينة صفحات الـ PDF</div>
            </div>
          `;
        } else {
          container.innerHTML = `<img src="${dataUrl}" alt="Scanned Preview" style="max-width: 100%; max-height: 200px; object-fit: contain;">`;
        }
      }

      if (nameText) {
        const sizeKb = Math.round((file.size || dataUrl.length * 0.75) / 1024);
        nameText.textContent = `📎 ${fileName} (${sizeKb} KB)`;
      }
    };

    reader.readAsDataURL(file);
  },

  // تصفية وحذف الملف الممسوح
  clearScannedFile() {
    this.currentScanFile = null;
    this.stopCameraScan();

    const fileInput = document.getElementById('scanFileInput');
    if (fileInput) fileInput.value = '';

    const emptyState = document.getElementById('scannerEmptyState');
    const previewState = document.getElementById('scannerPreviewState');
    const container = document.getElementById('scanFilePreviewContainer');
    const nameText = document.getElementById('scanFileNameText');

    if (emptyState) emptyState.style.display = 'block';
    if (previewState) previewState.style.display = 'none';
    if (container) container.innerHTML = '';
    if (nameText) nameText.textContent = '';
  },

  // بدء تشغيل كاميرا المسح الضوئي المباشرة
  async startCameraScan() {
    try {
      this.currentScanFile = null;
      const emptyState = document.getElementById('scannerEmptyState');
      const previewState = document.getElementById('scannerPreviewState');
      const cameraState = document.getElementById('scannerCameraState');
      const video = document.getElementById('scanCameraVideo');

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        App.showToast('المتصفح لا يدعم الوصول المباشر للكاميرا', 'warning');
        return;
      }

      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false
      });

      if (video) {
        video.srcObject = this.mediaStream;
      }

      if (emptyState) emptyState.style.display = 'none';
      if (previewState) previewState.style.display = 'none';
      if (cameraState) cameraState.style.display = 'block';
    } catch (err) {
      console.error('Camera scan error:', err);
      App.showToast('تعذر فتح الكاميرا: تأكد من منح الإذن للمتصفح', 'error');
    }
  },

  // التقاط صورة فورية من الكاميرا
  captureCameraShot() {
    const video = document.getElementById('scanCameraVideo');
    if (!video || !this.mediaStream) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const fileName = `camera_scan_${Date.now()}.jpg`;

    // تحويل DataURL إلى Blob
    canvas.toBlob((blob) => {
      this.processSelectedFile(blob, fileName);
      this.stopCameraScan();
    }, 'image/jpeg', 0.92);
  },

  // إيقاف تشغيل الكاميرا
  stopCameraScan() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    const cameraState = document.getElementById('scannerCameraState');
    if (cameraState) cameraState.style.display = 'none';

    if (!this.currentScanFile) {
      const emptyState = document.getElementById('scannerEmptyState');
      if (emptyState) emptyState.style.display = 'block';
    }
  },

  // تكبير المستند الممسوح حالياً داخل نافذة الإدخال
  viewCurrentScannedModal() {
    if (!this.currentScanFile || !this.currentScanFile.dataUrl) {
      App.showToast('لا يوجد مستند ممسوح لمعاينته', 'warning');
      return;
    }
    this.viewAttachment(this.currentScanFile.dataUrl, this.currentScanFile.filename, this.currentScanFile.mimeType);
  },

  // حفظ وأرشفة فاتورة السكانر مع بياناتها
  async submitScannerInvoice(e) {
    if (e) e.preventDefault();

    const invoice_no = document.getElementById('scanInvoiceNo')?.value?.trim();
    if (!invoice_no) {
      App.showToast('يرجى إدخال رقم الفاتورة الورقية', 'error');
      return;
    }

    const date = document.getElementById('scanDate')?.value || new Date().toISOString().split('T')[0];
    const category = document.getElementById('scanCategory')?.value || 'مشتريات ومواد';
    const payment_method = document.getElementById('scanPaymentMethod')?.value || 'نقدي';
    const party_name = document.getElementById('scanPartyName')?.value?.trim() || 'جهة مباشرة';
    
    // خانة المشروع المرتبط: حرية كتابة أي شيء يريده المستخدم
    const enteredProjectName = document.getElementById('scanProjectName')?.value?.trim() || '';
    const matchedProject = (window.Projects?.list || []).find(p => p.name === enteredProjectName);
    const project_id = matchedProject ? matchedProject.id : null;
    const project_name = enteredProjectName;

    const total_amount = Number(document.getElementById('scanTotalAmount')?.value);
    if (isNaN(total_amount) || total_amount < 0) {
      App.showToast('يرجى إدخال مبلغ إجمالي صحيح للفاتورة', 'error');
      return;
    }

    const currency = document.getElementById('scanCurrency')?.value || 'ر.ي';
    const notes = document.getElementById('scanNotes')?.value || '';
    const physical_archive_no = document.getElementById('scanPhysicalArchive')?.value?.trim() || '';
    const is_archived = document.getElementById('scanIsArchivedCheck')?.checked ? 1 : 0;
    const skip_financial_impact = document.getElementById('scanSkipFinanceCheck')?.checked || false;

    // تجهيز البند التلقائي من البيان
    const itemDescription = notes.trim() 
      ? `فاتورة ممسوحة (${category}): ${notes.trim().substring(0, 80)}`
      : `فاتورة ورقية ممسوحة (${category}) من ${party_name}`;

    const invoice_type = (payment_method === 'آجل') ? 'آجل' : 'نقد';

    const payload = {
      invoice_no,
      invoice_type,
      client_name: party_name,
      project_id,
      project_name, // حفظ أي اسم سجله المستخدم
      date,
      due_date: (invoice_type === 'آجل') ? date : null,
      subtotal: total_amount,
      discount: 0,
      tax_amount: 0,
      total_amount,
      payment_method,
      currency,
      notes,
      source: 'سكانر',
      category,
      is_archived,
      physical_archive_no,
      skip_financial_impact,
      file_base64: this.currentScanFile ? this.currentScanFile.dataUrl : null,
      attachment_name: this.currentScanFile ? this.currentScanFile.filename : null,
      attachment_type: this.currentScanFile ? this.currentScanFile.mimeType : null,
      items: [
        {
          description: itemDescription,
          unit: 'عملية',
          quantity: 1,
          unit_price: total_amount,
          total: total_amount,
          notes: physical_archive_no ? `أرشيف ورقي: ${physical_archive_no}` : ''
        }
      ]
    };

    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        App.showToast(data.message, 'success');
        this.closeScannerModal();
        await this.loadList();
        if (!skip_financial_impact && invoice_type === 'نقد') {
          App.loadCashTable?.();
        }
      } else {
        App.showToast(data.message || 'فشل حفظ فاتورة السكانر', 'error');
      }
    } catch (err) {
      console.error(err);
      App.showToast('خطأ في الاتصال بالخادم أثناء حفظ فاتورة السكانر', 'error');
    }
  },

  // =========================================================================
  // 6. معاينة وتكبير المستندات الممسوحة ضوئياً (Viewer Lightbox)
  // =========================================================================
  
  viewAttachment(url, invoiceNo, type) {
    if (!url) return;
    this.currentAttachmentUrl = url;

    const titleEl = document.getElementById('attachmentViewerTitle');
    const bodyEl = document.getElementById('attachmentViewerBody');
    const downloadLink = document.getElementById('attachmentDownloadLink');

    if (titleEl) {
      titleEl.textContent = `معاينة مستند الفاتورة: ${invoiceNo || ''}`;
    }

    if (downloadLink) {
      downloadLink.href = url;
      downloadLink.download = `invoice_${invoiceNo || 'scan'}`;
    }

    const isPdf = (type && type.includes('pdf')) || url.toLowerCase().endsWith('.pdf');

    if (bodyEl) {
      if (isPdf) {
        bodyEl.innerHTML = `<iframe src="${url}" style="width: 100%; height: 72vh; border: none; border-radius: 4px;"></iframe>`;
      } else {
        bodyEl.innerHTML = `
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%;">
            <img id="attachmentViewerImg" src="${url}" alt="Scanned Document" style="max-width: 100%; max-height: 72vh; object-fit: contain; border-radius: 4px; box-shadow: 0 4px 20px rgba(0,0,0,0.6); transition: transform 0.2s ease;">
          </div>
        `;
      }
    }

    App.openModal('attachmentViewerModal');
  },

  // طباعة المستند الممسوح مباشرة
  printCurrentAttachment() {
    if (!this.currentAttachmentUrl) return;

    const isPdf = this.currentAttachmentUrl.toLowerCase().endsWith('.pdf');
    if (isPdf) {
      const win = window.open(this.currentAttachmentUrl, '_blank');
      if (win) win.focus();
      return;
    }

    const printWin = window.open('', '_blank');
    if (!printWin) {
      App.showToast('يرجى السماح بالنوافذ المنبثقة للطباعة', 'warning');
      return;
    }

    printWin.document.write(`
      <!DOCTYPE html>
      <html dir="rtl">
      <head>
        <title>طباعة مستند الفاتورة الممسوحة</title>
        <style>
          body { margin: 0; padding: 10px; display: flex; align-items: center; justify-content: center; background: #fff; }
          img { max-width: 100%; height: auto; display: block; }
          @media print {
            body { padding: 0; }
            img { max-width: 100%; page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <img src="${this.currentAttachmentUrl}" onload="window.print(); window.close();">
      </body>
      </html>
    `);
    printWin.document.close();
  },

  // 7. تبديل حالة الأرشفة (أرشفة / استعادة)
  async toggleArchive(id) {
    try {
      const res = await fetch(`/api/invoices/${id}/archive`, { method: 'PUT' });
      const data = await res.json();
      if (data.success) {
        App.showToast(data.message, 'success');
        await this.loadList();
      } else {
        App.showToast(data.message || 'تعذر تغيير حالة الأرشفة', 'error');
      }
    } catch (e) {
      App.showToast('خطأ أثناء الأرشفة', 'error');
    }
  },

  // 8. حذف الفاتورة
  async deleteInvoice(id, invoiceNo) {
    if (!confirm(`هل أنت متأكد من رغبتك في حذف الفاتورة (${invoiceNo})؟ سيتم حذف بياناتها ومرفقها وعكس أي أثر مالي بأمان.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/invoices/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        App.showToast(data.message, 'success');
        await this.loadList();
        App.loadCashTable?.();
        App.loadClientsTable?.();
      } else {
        App.showToast(data.message || 'فشل حذف الفاتورة', 'error');
      }
    } catch (e) {
      App.showToast('خطأ أثناء حذف الفاتورة', 'error');
    }
  },

  // 9. طباعة الفاتورة على الورقة الرسمية A4 واستيعاب حتى 25 بنداً بالصفحة الواحدة
  async print(id) {
    try {
      const res = await fetch(`/api/invoices/${id}`);
      const json = await res.json();
      if (!json.success || !json.data) {
        throw new Error(json.message || 'تعذر تحميل بيانات الفاتورة');
      }

      const inv = json.data;
      const area = document.getElementById('printArea');
      if (!area) return;

      const curr = inv.currency || 'ر.ي';
      const isCash = (inv.invoice_type === 'نقد');
      const allItems = inv.items || [];
      const totalItems = allItems.length;
      const words = this.getTafqeet(inv.total_amount, curr);

      const pages = (window.App && typeof App.paginatePrintItems === 'function')
        ? App.paginatePrintItems(allItems, { hasNotes: false, capSingle: 520, capPage1: 760, capMid: 880, capLast: 660 })
        : (allItems.length <= 15 ? [allItems] : [allItems.slice(0, 15), allItems.slice(15)]);

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

        let titleText = isCash ? 'فاتورة مبيعات نقدية (Cash Invoice)' : 'فاتورة مبيعات آجلة (Credit Invoice)';
        if (inv.source === 'سكانر') {
          titleText = `أرشيف فاتورة ممسوحة ضوئياً - ${inv.category || 'عام'}`;
        }

        pagesHtml += `
          <div class="rawasi-print-page invoice-print-page">
            <div class="rawasi-page-content">

              ${isFirstPage ? `
                <div class="quotation-print-meta">تاريخ ووقت الطباعة: ${this.esc(printDateTime)}</div>

                <div class="quotation-header-box" style="margin-bottom: 6px; padding-bottom: 4px;">
                  <div class="quotation-title-block">
                    <div style="font-size: 11pt; font-weight: 800; color: #1e293b; margin-bottom: 2px;">شركة رواسي عدن للهندسة والمقاولات</div>
                    <h1 style="font-size: 14pt; margin: 0; color: #8c6d3e;">${titleText}</h1>
                    <div class="quotation-no-badge">رقم الفاتورة: <b>${this.esc(inv.invoice_no)}</b></div>
                  </div>
                  <div class="quotation-meta-grid" style="font-size: 8.5pt;">
                    <div><span>التاريخ:</span> <b>${this.esc(inv.date)}</b></div>
                    ${inv.due_date && !isCash ? `<div><span>تاريخ الاستحقاق:</span> <b>${this.esc(inv.due_date)}</b></div>` : ''}
                    <div><span>نوع الدفع:</span> <b>${isCash ? 'نقدي (مسدد)' : 'آجل (ذمة)'}</b></div>
                    <div><span>العملة:</span> <b>${this.esc(curr)}</b></div>
                  </div>
                </div>

                <div class="quotation-client-bar" style="margin-bottom: 6px; padding: 3px 8px; font-size: 8.5pt;">
                  <span class="client-item"><b>الجهة / العميل:</b> ${this.esc(inv.client_display_name || inv.client_name || 'جهة مباشرة')}</span>
                  ${inv.client_phone ? `<span class="client-item"><b>هاتف:</b> ${this.esc(inv.client_phone)}</span>` : ''}
                  <span class="client-item"><b>المشروع:</b> ${this.esc(inv.project_name || 'عام / مباشر')}</span>
                  ${inv.physical_archive_no ? `<span class="client-item"><b>موقع الحفظ:</b> ${this.esc(inv.physical_archive_no)}</span>` : ''}
                  <span class="client-item" style="margin-right:auto;"><b>الحالة:</b> <b style="color:${isCash ? 'green' : '#b45309'};">${inv.status}</b></span>
                </div>
              ` : `
                <div class="quotation-continuation-header" style="margin-bottom: 6px;">
                  <div class="cont-title">فاتورة رقم: <b>${this.esc(inv.invoice_no)}</b> (تكملة جدول البنود)</div>
                  <div class="cont-page-num">صفحة ${pageNum} من ${totalPages}</div>
                </div>
              `}

              <table class="quotation-print-table" style="font-size: 8.5pt; line-height: 1.15;">
                <thead>
                  <tr>
                    <th style="width:30px; padding: 2.5px 3px;">#</th>
                    <th style="padding: 2.5px 4px;">بيان الصنف / وصف الأعمال والتفاصيل</th>
                    <th style="width:55px; padding: 2.5px 3px;">الوحدة</th>
                    <th style="width:55px; padding: 2.5px 3px;">الكمية</th>
                    <th style="width:85px; padding: 2.5px 3px;">سعر الوحدة (${this.esc(curr)})</th>
                    <th style="width:75px; padding: 2.5px 3px;">نسبة الإنجاز</th>
                    <th style="width:95px; padding: 2.5px 3px;">الإجمالي (${this.esc(curr)})</th>
                  </tr>
                </thead>
                <tbody>
                  ${pageItems.map((it, i) => {
                    const compStr = (it.completion_percentage !== undefined && it.completion_percentage !== null)
                      ? `${it.completion_percentage}%`
                      : '100%';
                    return `
                    <tr>
                      <td class="center-cell" style="padding: 2.5px 3px;">${startIndex + i + 1}</td>
                      <td class="desc-cell" style="padding: 2.5px 4px;">${this.esc(it.description)}</td>
                      <td class="center-cell" style="padding: 2.5px 3px;">${this.esc(it.unit || 'وحدة')}</td>
                      <td class="center-cell" style="padding: 2.5px 3px;">${App.formatNumber(it.quantity)}</td>
                      <td class="num-cell" style="padding: 2.5px 3px;">${App.formatNumber(it.unit_price)}</td>
                      <td class="center-cell" style="padding: 2.5px 3px; font-weight:600; color:#0f766e;">${compStr}</td>
                      <td class="num-cell" style="padding: 2.5px 3px; font-weight:bold;">${App.formatNumber(it.total)}</td>
                    </tr>
                  `;
                  }).join('')}
                </tbody>
                ${isLastPage ? `
                  <tfoot>
                    ${(inv.discount > 0 || inv.tax_amount > 0) ? `
                      <tr style="background:#fcfaf7;">
                        <td colspan="6" style="text-align:left; font-weight:bold; padding:2px 6px;">المجموع الفرعي:</td>
                        <td class="num-cell" style="padding:2px 6px;">${App.formatNumber(inv.subtotal)} ${this.esc(curr)}</td>
                      </tr>
                    ` : ''}
                    ${inv.discount > 0 ? `
                      <tr style="background:#fcfaf7; color:#dc2626;">
                        <td colspan="6" style="text-align:left; font-weight:bold; padding:2px 6px;">الخصم التجاري:</td>
                        <td class="num-cell" style="padding:2px 6px;">-${App.formatNumber(inv.discount)} ${this.esc(curr)}</td>
                      </tr>
                    ` : ''}
                    ${inv.tax_amount > 0 ? `
                      <tr style="background:#fcfaf7;">
                        <td colspan="6" style="text-align:left; font-weight:bold; padding:2px 6px;">الضريبة:</td>
                        <td class="num-cell" style="padding:2px 6px;">+${App.formatNumber(inv.tax_amount)} ${this.esc(curr)}</td>
                      </tr>
                    ` : ''}
                    <tr class="quotation-total-tr" style="background:#f2eadc; font-size:9.5pt;">
                      <td colspan="6" class="total-label" style="padding: 3px 6px; font-weight:800;">صافي إجمالي الفاتورة:</td>
                      <td class="total-val" style="padding: 3px 6px; font-weight:800; color:#8c6d3e;">${App.formatNumber(inv.total_amount)} ${this.esc(curr)}</td>
                    </tr>
                  </tfoot>
                ` : ''}
              </table>

              ${isLastPage ? `
                <div class="quotation-tafqeet-box" style="margin: 4px 0; padding: 3px 6px; font-size: 8.5pt;">
                  <b>المبلغ كتابةً:</b> ${this.esc(words)}
                </div>

                ${inv.notes ? `
                  <div class="quotation-notes-box" style="margin: 3px 0; padding: 3px 6px; font-size: 8pt;">
                    <b>ملاحظات وتفاصيل الفاتورة:</b> ${this.esc(inv.notes)}
                  </div>
                ` : ''}

                <div class="quotation-signatures-box" style="margin-top: 8px; padding-top: 4px;">
                  <div class="sig-col" style="width: 30%;">
                    <span class="sig-title" style="font-size: 8.5pt;">المستلم / العميل</span>
                    <div style="height: 16px;"></div>
                    <span class="sig-line" style="font-size: 7.5pt;">التوقيع: __________________</span>
                  </div>
                  <div class="sig-col" style="width: 30%;">
                    <span class="sig-title" style="font-size: 8.5pt;">إعداد المحاسب</span>
                    <div style="height: 16px;"></div>
                    <span class="sig-line" style="font-size: 7.5pt;">التوقيع: __________________</span>
                  </div>
                  <div class="sig-col" style="width: 30%;">
                    <span class="sig-title" style="font-size: 8.5pt;">الاعتماد والختم الرسمي</span>
                    <div style="height: 16px;"></div>
                    <span class="sig-line" style="font-size: 7.5pt;">رواسي عدن للهندسة والمقاولات</span>
                  </div>
                </div>

                <div style="text-align:left; font-size:7pt; color:#888; margin-top:2px;">صفحة ${pageNum} من ${totalPages}</div>
              ` : `
                <div class="quotation-page-footer-note" style="margin-top:4px; font-size:8pt;">صفحة ${pageNum} من ${totalPages} — (يتبع في الصفحة التالية ⬅️)</div>
              `}

            </div>
          </div>
        `;
      });

      area.innerHTML = pagesHtml;
      App.printWithRawasiLetterhead(area);
    } catch (err) {
      console.error(err);
      App.showToast(err.message || 'خطأ في إعداد طباعة الفاتورة', 'error');
    }
  },

  // تفقيط الأرقام إلى كلمات عربية
  getTafqeet(num, currency = 'ر.ي') {
    if (!num || isNaN(num)) return 'صفر ' + currency;
    if (window.Quotations?.getTafqeet) {
      return window.Quotations.getTafqeet(num, currency);
    }
    return `${App.formatNumber(num)} ${currency}`;
  },

  esc(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }
};

window.Invoices = Invoices;
