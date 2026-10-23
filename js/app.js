/**
 * المنظم الرئيسي للنظام - نظام رواسي عدن للهندسة والمقاولات (SPA Controller)
 */

const App = {
  activeView: 'dashboard',
  dbStatus: null,

  async init() {
    console.log('🚀 تهيئة نظام رواسي عدن للهندسة والمقاولات...');
    
    // التحقق المسبق من الاتصال بقاعدة البيانات (أونلاين / أوفلاين)
    await this.checkDatabaseStatus();

    // تهيئة الوحدات
    Auth.init();
    await Projects.init();
    await Accounting.init();
    await Reports.init();
    await Inventory.init();
    await Settings.init();
    await Quotations.init();
    if (window.Invoices) await Invoices.init();

    this.bindEvents();
    this.setupDatePickers();
    this.setupNetworkWatchers();

    console.log('✅ تم تشغيل كافة وحدات النظام بنجاح!');
  },



  // تجهيز قالب الطباعة على ورقة A4 بيضاء نقية مع كلام وبيانات الطباعة فقط
  preparePrintLetterhead(printArea) {
    if (!printArea) return;
    printArea.classList.add('rawasi-letterhead-print');

    // إزالة أي صور أو خلفيات للورق الرسمي من منطقة الطباعة لضمان ورقة بيضاء نقية
    printArea.querySelectorAll('.rawasi-page-bg, .rawasi-letterhead-bg').forEach(el => el.remove());

    const documentRoot = printArea.firstElementChild;
    if (documentRoot) {
      documentRoot.classList.add('rawasi-print-document');
    }

    let meta = documentRoot && documentRoot.querySelector('.rawasi-print-meta');
    if (!meta && documentRoot && !printArea.querySelector('.rawasi-print-page')) {
      meta = document.createElement('div');
      meta.className = 'rawasi-print-meta';
      const now = new Date();
      meta.textContent = `تاريخ ووقت الطباعة: ${now.toLocaleDateString('ar-YE')} - ${now.toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' })}`;
      documentRoot.prepend(meta);
    }
  },

  printWithRawasiLetterhead(printArea) {
    this.preparePrintLetterhead(printArea || document.getElementById('printArea'));
    window.print();
  },

  // حساب الارتفاع التقديري للبند في جدول الطباعة بناءً على طول النص
  estimateItemHeight(item) {
    const desc = (item.description || item.notes || item.name || '').trim();
    const chars = desc.length;
    const lines = Math.max(1, Math.ceil(chars / 48));
    return Math.round(22 + ((lines - 1) * 13.5));
  },

  // محرك التقسيم الذكي لصفحات الطباعة A4 المعتمد على الارتفاع الفعلي للبند وتوازن الصفحات
  paginatePrintItems(items, options = {}) {
    const total = items.length;
    if (total === 0) return [];

    const hasNotes = !!options.hasNotes;
    const notesH = hasNotes ? 45 : 0;

    const capSingle = options.capSingle || (540 - notesH);
    const capPage1 = options.capPage1 || 780;
    const capMid = options.capMid || 900;
    const capLast = options.capLast || (680 - notesH);

    const heights = items.map(it => this.estimateItemHeight(it));
    const totalHeight = heights.reduce((a, b) => a + b, 0);

    // إذا كانت البنود تتسع بالكامل في صفحة واحدة رسمية مع الإجماليات والتوقيع
    if (totalHeight <= capSingle) {
      return [items];
    }

    let pages = [];
    let curIdx = 0;

    while (curIdx < total) {
      const isFirst = (pages.length === 0);
      const remHeight = heights.slice(curIdx).reduce((a, b) => a + b, 0);
      const lastCap = isFirst ? capSingle : capLast;

      // إذا كانت بقية البنود تتسع في الصفحة الأخيرة
      if (remHeight <= lastCap) {
        pages.push(items.slice(curIdx));
        break;
      }

      const cap = isFirst ? capPage1 : capMid;
      let page = [];
      let accH = 0;

      while (curIdx < total) {
        const h = heights[curIdx];
        if (page.length > 0 && (accH + h > cap)) {
          break;
        }
        page.push(items[curIdx]);
        accH += h;
        curIdx++;

        const leftCount = total - curIdx;
        // منع ترك 1 إلى 3 بنود فقط معلقة بالصفحة الأخيرة إذا كانت الصفحة الحالية ممتلئة بنسبة جيدة
        if (leftCount > 0 && leftCount <= 3 && accH > cap * 0.72) {
          break;
        }
      }
      pages.push(page);
    }

    // إعادة توازن البنود بين آخر صفحتين إذا كانت الصفحة الأخيرة تحتوي على عدد قليل جداً من البنود
    if (pages.length >= 2) {
      const lastP = pages[pages.length - 1];
      const prevP = pages[pages.length - 2];
      if (lastP.length <= 4 && prevP.length > 9) {
        while (lastP.length < prevP.length - 3) {
          const item = prevP.pop();
          lastP.unshift(item);
          const lastH = lastP.reduce((s, it) => s + this.estimateItemHeight(it), 0);
          if (lastH > capLast) {
            prevP.push(lastP.shift());
            break;
          }
        }
      }
    }

    return pages;
  },

  bindEvents() {
    // إغلاق النوافذ المنبثقة بالنقر على الخلفية
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.classList.remove('active');
        }
      });
    });

    // إغلاق قائمة الإشعارات المنسدلة عند النقر خارجها
    document.addEventListener('click', (e) => {
      const wrapper = document.getElementById('notificationsWrapper');
      const dropdown = document.getElementById('notificationsDropdown');
      if (dropdown && dropdown.classList.contains('active') && wrapper && !wrapper.contains(e.target)) {
        dropdown.classList.remove('active');
      }
    });

    // استجابة تغيير حجم النافذة للرسوم البيانية
    window.addEventListener('resize', () => {
      if (this.activeView === 'dashboard') {
        Reports.loadDashboardKPIs();
      }
    });
  },

  setupDatePickers() {
    const today = new Date().toISOString().split('T')[0];
    const dateInputs = ['rcDate', 'expDate', 'custodyDate', 'plToDate'];
    dateInputs.forEach(id => {
      const el = document.getElementById(id);
      if (el && !el.value) el.value = today;
    });

    const fromInput = document.getElementById('plFromDate');
    if (fromInput && !fromInput.value) fromInput.value = '2024-01-01';
  },

  // التحكم بالقائمة الجانبية للشاشات الصغيرة والهواتف
  toggleMobileSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (sidebar) sidebar.classList.toggle('mobile-open');
    if (backdrop) backdrop.classList.toggle('active');
  },

  closeMobileSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (sidebar) sidebar.classList.remove('mobile-open');
    if (backdrop) backdrop.classList.remove('active');
  },

  // التنقل بين الأقسام والشاشات
  navigate(viewId, clickedEl = null) {
    this.activeView = viewId;
    this.closeMobileSidebar();

    // تحديث رابط القائمة الجانبية النشط
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
    });
    if (clickedEl && clickedEl.classList.contains('nav-item')) {
      clickedEl.classList.add('active');
    } else {
      // مطابقة العنصر في القائمة الجانبية تلقائياً
      const matchedNavItem = document.querySelector(`.nav-item[onclick*="'${viewId}'"]`);
      if (matchedNavItem) matchedNavItem.classList.add('active');
    }

    // تحديث أزرار شريط التنقل السفلي للهواتف
    document.querySelectorAll('.bottom-nav-item').forEach(btn => {
      if (btn.getAttribute('data-nav') === viewId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // إخفاء كافة الشاشات وإظهار الشاشة المطلوبة
    const views = document.querySelectorAll('.app-view-section');
    views.forEach(v => v.style.display = 'none');

    const targetView = document.getElementById(viewId + 'View');
    if (targetView) {
      targetView.style.display = 'block';
    } else {
      // إذا كانت شاشة افتراضية ترجع إلى لوحة التحكم
      const dash = document.getElementById('dashboardView');
      if (dash) dash.style.display = 'block';
    }

    // تمرير الشاشة للأعلى بسلاسة
    const mainContent = document.querySelector('.main-content');
    if (mainContent) mainContent.scrollTop = 0;
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // تحديث المحتوى وفق الشاشة
    if (viewId === 'dashboard') {
      Reports.loadDashboardKPIs();
      Projects.loadProjects();
    } else if (viewId === 'reports') {
      Reports.switchReportTab(Reports.activeReportTab || 'profit-loss');
    } else if (viewId === 'projects') {
      Projects.loadProjects();
    } else if (viewId === 'inventory') {
      Inventory.loadItems();
    } else if (viewId === 'vouchers') {
      if (window.Vouchers) Vouchers.init();
    } else if (viewId === 'revenues') {
      this.loadRevenuesTable();
    } else if (viewId === 'expenses') {
      this.loadExpensesTable();
    } else if (viewId === 'custody') {
      Accounting.loadRecentCustodySummary();
      this.loadCustodyTable();
    } else if (viewId === 'clients') {
      this.loadClientsTable();
    } else if (viewId === 'suppliers') {
      this.loadSuppliersTable();
    } else if (viewId === 'cash') {
      Accounting.loadCashMovement();
      this.loadCashTable();
    } else if (viewId === 'quotations') {
      Quotations.loadList();
    } else if (viewId === 'invoices') {
      if (window.Invoices) Invoices.loadList();
    } else if (viewId === 'boq') {
      if (window.BOQ) BOQ.init();
    } else if (viewId === 'contracts') {
      if (window.Contracts) Contracts.init();
    } else if (viewId === 'settings') {
      Settings.loadCompanySettings();
      Settings.loadUsers();
    }
  },

  async loadRevenuesTable() {
    try {
      const res = await fetch('/api/payments?type=قبض');
      const json = await res.json();
      const tbody = document.getElementById('fullRevenuesTableBody');
      if (json.success) {
        const list = json.data || [];
        const total = list.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        const kpiTotal = document.getElementById('revKpiTotal');
        const kpiCount = document.getElementById('revKpiCount');
        if (kpiTotal) kpiTotal.textContent = this.formatNumber(total);
        if (kpiCount) kpiCount.textContent = list.length;

        if (tbody) {
          if (list.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 20px; color: var(--text-secondary);">لا توجد سندات قبض مسجلة حتى الآن</td></tr>`;
          } else {
            tbody.innerHTML = list.map(p => `
              <tr>
                <td><strong style="color: var(--gold-light);">${p.receipt_no}</strong></td>
                <td>${p.date}</td>
                <td><strong>${p.client_name || '-'}</strong></td>
                <td>${p.project_name || '-'}</td>
                <td style="color: var(--accent-green); font-weight: bold;">${this.formatNumber(p.amount)} ${p.currency || 'ر.ي'}</td>
                <td><span class="badge badge-active">${p.payment_method}</span></td>
                <td>${p.notes || '-'}</td>
                <td style="text-align: center; white-space: nowrap;">
                  <button class="btn btn-secondary btn-sm" onclick="Accounting.printReceipt({
                    receipt_no: '${p.receipt_no}',
                    date: '${p.date}',
                    client_name: '${(p.client_name || 'العميل').replace(/'/g, "\\'")}',
                    project_name: '${(p.project_name || '-').replace(/'/g, "\\'")}',
                    amount: ${p.amount},
                    currency: '${p.currency || 'ر.ي'}',
                    payment_method: '${p.payment_method}',
                    notes: '${(p.notes || '').replace(/'/g, "\\'")}'
                  })">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="vertical-align: middle;"><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/></svg>
                    <span>طباعة</span>
                  </button>
                  <button class="btn btn-danger btn-sm" onclick="App.deletePayment(${p.id}, '${p.receipt_no}', 'قبض')" title="حذف سند القبض">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style="vertical-align: middle;"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                    <span>حذف</span>
                  </button>
                </td>
              </tr>
            `).join('');
          }
        }
      }
    } catch (e) {
      console.error('Error loading revenues:', e);
    }
  },

  async loadExpensesTable() {
    try {
      const res = await fetch('/api/expenses');
      const json = await res.json();
      const tbody = document.getElementById('fullExpensesTableBody');
      if (json.success) {
        const list = json.data || [];
        const total = list.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
        const kpiTotal = document.getElementById('expKpiTotal');
        const kpiCount = document.getElementById('expKpiCount');
        if (kpiTotal) kpiTotal.textContent = this.formatNumber(total);
        if (kpiCount) kpiCount.textContent = list.length;

        if (tbody) {
          if (list.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 20px; color: var(--text-secondary);">لا توجد سندات صرف مسجلة حتى الآن</td></tr>`;
          } else {
            tbody.innerHTML = list.map(e => `
              <tr>
                <td><strong style="color: var(--accent-red);">${e.receipt_no}</strong></td>
                <td>${e.date}</td>
                <td><span class="badge badge-expense">${e.expense_type}</span></td>
                <td>${e.project_name || '-'}</td>
                <td><strong>${e.supplier_name || '-'}</strong></td>
                <td style="color: var(--accent-red); font-weight: bold;">${this.formatNumber(e.amount)} ${e.currency || 'ر.ي'}</td>
                <td><span class="badge badge-active">${e.payment_method}</span></td>
                <td>${e.notes || '-'}</td>
                <td style="text-align: center; white-space: nowrap;">
                  <button class="btn btn-secondary btn-sm" onclick="Accounting.printExpenseReceipt({
                    receipt_no: '${e.receipt_no}',
                    date: '${e.date}',
                    expense_type: '${(e.expense_type || '').replace(/'/g, "\\'")}',
                    supplier_name: '${(e.supplier_name || '-').replace(/'/g, "\\'")}',
                    project_name: '${(e.project_name || '-').replace(/'/g, "\\'")}',
                    amount: ${e.amount},
                    currency: '${e.currency || 'ر.ي'}',
                    payment_method: '${e.payment_method}',
                    notes: '${(e.notes || '').replace(/'/g, "\\'")}'
                  })">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="vertical-align: middle;"><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/></svg>
                    <span>طباعة</span>
                  </button>
                  <button class="btn btn-danger btn-sm" onclick="App.deleteExpense(${e.id}, '${e.receipt_no}')" title="حذف سند الصرف">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style="vertical-align: middle;"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                    <span>حذف</span>
                  </button>
                </td>
              </tr>
            `).join('');
          }
        }
      }
    } catch (e) {
      console.error('Error loading expenses:', e);
    }
  },

  async loadCustodyTable() {
    try {
      const res = await fetch('/api/accounting/custodies');
      const json = await res.json();
      const tbody = document.getElementById('fullCustodyTableBody');
      if (json.success) {
        const list = json.data || [];
        const totalAmount = list.reduce((sum, c) => sum + (Number(c.total_amount) || 0), 0);
        const totalSpent = list.reduce((sum, c) => sum + (Number(c.spent_amount) || 0), 0);
        const totalRemaining = list.reduce((sum, c) => sum + (Number(c.remaining_amount) || 0), 0);

        const kpiTotal = document.getElementById('custodyKpiTotal');
        const kpiSpent = document.getElementById('custodyKpiSpent');
        const kpiRemain = document.getElementById('custodyKpiRemaining');
        if (kpiTotal) kpiTotal.textContent = this.formatNumber(totalAmount);
        if (kpiSpent) kpiSpent.textContent = this.formatNumber(totalSpent);
        if (kpiRemain) kpiRemain.textContent = this.formatNumber(totalRemaining);

        if (tbody) {
          if (list.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 20px; color: var(--text-secondary);">لا توجد حركات عهد مسجلة</td></tr>`;
          } else {
            tbody.innerHTML = list.map(c => `
              <tr>
                <td>${c.date}</td>
                <td><strong>${c.employee_name}</strong></td>
                <td><span class="badge ${c.operation_type === 'تصفية عهدة' ? 'badge-income' : 'badge-active'}">${c.operation_type}</span></td>
                <td>${this.formatNumber(c.total_amount)} ${c.currency || 'ر.ي'}</td>
                <td style="color: var(--accent-red); font-weight: bold;">${this.formatNumber(c.spent_amount)} ${c.currency || 'ر.ي'}</td>
                <td style="color: var(--accent-green); font-weight: bold;">${this.formatNumber(c.remaining_amount)} ${c.currency || 'ر.ي'}</td>
                <td>${c.notes || '-'}</td>
                <td style="text-align: center;">
                  <button class="btn btn-danger btn-sm" onclick="App.deleteCustody(${c.id}, '${c.employee_name}')" title="حذف العهدة">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style="vertical-align: middle;"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                    <span>حذف</span>
                  </button>
                </td>
              </tr>
            `).join('');
          }
        }
      }
    } catch (e) {
      console.error('Error loading custodies:', e);
    }
  },

  async loadClientsTable() {
    try {
      const res = await fetch('/api/clients');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        this._clientsData = json.data;

        // تحديث بطاقات المؤشرات المالية للعملاء (KPIs)
        const totalCount = json.data.length;
        const totalDue = json.data.reduce((sum, c) => sum + (Number(c.current_balance) || 0), 0);
        const totalPaid = json.data.reduce((sum, c) => sum + (Number(c.total_paid) || 0), 0);
        const totalCreditLimit = json.data.reduce((sum, c) => sum + (Number(c.credit_limit) || 0), 0);

        const elCount = document.getElementById('kpiClientsCount');
        const elDue = document.getElementById('kpiClientsTotalDue');
        const elPaid = document.getElementById('kpiClientsTotalPaid');
        const elLimit = document.getElementById('kpiClientsCreditLimit');

        if (elCount) elCount.textContent = this.formatNumber(totalCount);
        if (elDue) elDue.textContent = this.formatNumber(totalDue) + ' ر.ي';
        if (elPaid) elPaid.textContent = this.formatNumber(totalPaid) + ' ر.ي';
        if (elLimit) elLimit.textContent = this.formatNumber(totalCreditLimit) + ' ر.ي';

        this.renderClientsTable(this._clientsData);
      }
    } catch (e) {
      console.error('Error loading clients table:', e);
    }
  },

  renderClientsTable(clients) {
    const tbody = document.getElementById('fullClientsTableBody');
    if (!tbody) return;

    if (!clients || clients.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align: center; padding: 32px; color: var(--text-muted);">
            <div style="font-size: 2rem; margin-bottom: 8px;">📂</div>
            لا توجد حسابات عملاء مطابقة للبحث أو الفلترة المحددة.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = clients.map(c => {
      const curBal = Number(c.current_balance) || 0;
      const limit = Number(c.credit_limit) || 0;
      const isOverLimit = limit > 0 && curBal > limit;
      const isPaidOff = curBal <= 0;
      const cur = c.currency || 'ر.ي';

      let balColor = 'var(--text-primary)';
      if (isOverLimit) balColor = 'var(--accent-red)';
      else if (curBal > 0) balColor = 'var(--gold-dark)';
      else balColor = 'var(--accent-green)';

      const statusBadge = (c.account_status === 'موقوف') 
        ? '<span class="badge badge-status-inactive">موقوف</span>' 
        : (c.account_status === 'تحت المراجعة')
          ? '<span class="badge" style="background: rgba(184,134,11,0.15); color: var(--accent-amber);">مراجعة</span>'
          : '<span class="badge badge-status-active">نشط</span>';

      return `
        <tr style="${isOverLimit ? 'background: rgba(198, 40, 40, 0.03);' : ''}">
          <td>
            <span class="badge" style="background: rgba(184, 147, 85, 0.12); color: var(--gold-dark); font-weight: bold; font-family: monospace; font-size: 0.85rem; border: 1px solid var(--border-color); padding: 4px 8px; border-radius: 4px;">
              ${c.account_code || '112---'}
            </span>
          </td>
          <td>
            <div style="font-weight: 700; color: var(--text-primary);">${c.name}</div>
            <small style="color: var(--text-secondary); font-size: 0.78rem;">${c.company || 'عميل فردي / مباشر'}</small>
          </td>
          <td>
            <div style="direction: ltr; text-align: right; font-size: 0.85rem;">${c.phone || '-'}</div>
            <small style="color: var(--text-muted); font-size: 0.75rem;">${c.address || 'عدن'}</small>
          </td>
          <td>
            <div style="font-size: 0.85rem; font-weight: 600;">${limit > 0 ? this.formatNumber(limit) + ' ' + cur : '<span style="color: var(--text-muted);">غير مقيد</span>'}</div>
            ${isOverLimit ? '<span class="badge badge-expense" style="font-size: 0.65rem; padding: 2px 6px;">تجاوز الائتمان!</span>' : ''}
          </td>
          <td>
            <span class="badge badge-light-subtle" style="font-size: 0.75rem;">${c.payment_terms_days ? c.payment_terms_days + ' يوم' : 'نقدي فوري'}</span>
          </td>
          <td style="color: var(--accent-green); font-weight: 600;">
            ${this.formatNumber(c.total_paid)} ${cur}
          </td>
          <td>
            <div style="color: ${balColor}; font-weight: bold; font-size: 0.95rem;">
              ${this.formatNumber(curBal)} ${cur}
            </div>
            ${isPaidOff ? '<small style="color: var(--accent-green); font-size: 0.7rem;">(خالص ومسدد)</small>' : ''}
          </td>
          <td style="text-align: center;">
            ${statusBadge}
          </td>
          <td style="text-align: center; white-space: nowrap;">
            <div style="display: flex; gap: 4px; justify-content: center; align-items: center;">
              <button class="btn btn-primary btn-sm" onclick="App.viewClientAccountCard(${c.id})" title="عرض بطاقة الحساب المالي والائتماني">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style="vertical-align: middle;"><path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/></svg>
                <span>بطاقة الحساب</span>
              </button>
              <button class="btn btn-secondary btn-sm" onclick="App.openClientStatement(${c.id})" title="كشف الحساب المحاسبي التفصيلي">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style="vertical-align: middle;"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
                <span>كشف حساب</span>
              </button>
              <button class="btn btn-secondary btn-sm" style="color: var(--accent-green);" onclick="App.quickReceiptForClient(${c.id}, '${c.name.replace(/'/g, "\\'")}', ${curBal})" title="سند قبض سريع للحساب">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style="vertical-align: middle;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                <span>قبض</span>
              </button>
              <button class="btn btn-secondary btn-sm" onclick="App.openEditClientModal(${c.id})" title="تعديل الحساب والشروط">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style="vertical-align: middle;"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
              </button>
              <button class="btn btn-danger btn-sm" onclick="App.deleteClient(${c.id}, '${c.name.replace(/'/g, "\\'")}')" title="حذف أو تعطيل الحساب">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style="vertical-align: middle;"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  filterClientsTable() {
    if (!this._clientsData) return;
    const searchVal = (document.getElementById('clientSearchInput')?.value || '').trim().toLowerCase();
    const statusVal = document.getElementById('clientStatusFilter')?.value || 'all';

    const filtered = this._clientsData.filter(c => {
      const matchesSearch = !searchVal || 
        (c.name && c.name.toLowerCase().includes(searchVal)) ||
        (c.account_code && c.account_code.toLowerCase().includes(searchVal)) ||
        (c.company && c.company.toLowerCase().includes(searchVal)) ||
        (c.phone && c.phone.includes(searchVal)) ||
        (c.address && c.address.toLowerCase().includes(searchVal));

      let matchesStatus = true;
      const limit = Number(c.credit_limit) || 0;
      const curBal = Number(c.current_balance) || 0;

      if (statusVal === 'active') matchesStatus = (c.account_status !== 'موقوف');
      else if (statusVal === 'suspended') matchesStatus = (c.account_status === 'موقوف');
      else if (statusVal === 'overlimit') matchesStatus = (limit > 0 && curBal > limit);
      else if (statusVal === 'has_due') matchesStatus = (curBal > 0);

      return matchesSearch && matchesStatus;
    });

    this.renderClientsTable(filtered);
  },

  openClientStatement(clientId) {
    this.navigate('reports');
    if (window.Reports && Reports.switchReportTab) {
      Reports.switchReportTab('client-statement');
      const repClientSelect = document.getElementById('repClientSelect');
      if (repClientSelect) {
        repClientSelect.value = String(clientId);
        Reports.fetchFullClientStatement();
      }
    }
  },

  quickReceiptForClient(clientId, clientName, currentBalance) {
    this.navigate('vouchers');
    if (window.Vouchers && Vouchers.openCreateModal) {
      Vouchers.openCreateModal('قبض');
      setTimeout(() => {
        const clSelect = document.getElementById('voucherClientSelect') || document.getElementById('modalRcClientSelect') || document.getElementById('rcClientSelect');
        if (clSelect) clSelect.value = String(clientId);
        const amtInput = document.getElementById('voucherAmount') || document.getElementById('modalRcAmount') || document.getElementById('rcAmount');
        if (amtInput && currentBalance > 0) amtInput.value = currentBalance;
        const notesInput = document.getElementById('voucherNotes') || document.getElementById('modalRcNotes') || document.getElementById('rcNotes');
        if (notesInput) notesInput.value = `تحصيل دفعة من حساب العميل: ${clientName}`;
      }, 200);
    }
  },

  async viewClientAccountCard(clientId) {
    try {
      const res = await fetch(`/api/clients/${clientId}/account-card`);
      const json = await res.json();
      if (!json.success || !json.data) {
        this.showToast('تعذر جلب بطاقة الحساب', 'error');
        return;
      }

      const { client, stats, transactions } = json.data;
      this._currentCardClient = client;
      this._currentCardStats = stats;

      const titleEl = document.getElementById('cardClientTitle');
      const subtitleEl = document.getElementById('cardClientSubtitle');
      if (titleEl) titleEl.textContent = `بطاقة الحساب المالي: ${client.name}`;
      if (subtitleEl) subtitleEl.textContent = `رقم الحساب: ${client.account_code || '112---'} | شجرة الحسابات (الأصول المتداولة - العملاء)`;

      const cardBody = document.getElementById('clientAccountCardBody');
      if (cardBody) {
        const cur = client.currency || 'ر.ي';
        const limit = Number(stats.credit_limit) || 0;
        const util = stats.credit_utilization_percent || 0;
        const utilColor = util > 90 ? 'var(--accent-red)' : util > 70 ? 'var(--accent-amber)' : 'var(--accent-green)';

        cardBody.innerHTML = `
          <!-- ترويسة بطاقة الحساب التعريفية -->
          <div style="background: rgba(184, 147, 85, 0.08); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 16px; margin-bottom: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px;">
              <div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span class="badge" style="background: var(--gold-dark); color: #fff; font-weight: bold; font-family: monospace; font-size: 1rem; padding: 4px 10px; border-radius: 4px;">
                    ${client.account_code || '112---'}
                  </span>
                  <h3 style="margin: 0; font-size: 1.2rem; color: var(--text-primary);">${client.name}</h3>
                  <span class="badge ${client.account_status === 'موقوف' ? 'badge-status-inactive' : 'badge-status-active'}">
                    ${client.account_status || 'نشط'}
                  </span>
                </div>
                <div style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 6px;">
                  ${client.company ? '<strong>الشركة / المؤسسة:</strong> ' + client.company + ' | ' : ''}
                  <strong>الهاتف:</strong> ${client.phone || '-'} | 
                  <strong>العنوان:</strong> ${client.address || 'عدن'}
                </div>
                <div style="color: var(--text-muted); font-size: 0.78rem; margin-top: 4px;">
                  ${client.commercial_reg ? '<strong>السجل التجاري/الهوية:</strong> ' + client.commercial_reg + ' | ' : ''}
                  ${client.tax_number ? '<strong>الرقم الضريبي:</strong> ' + client.tax_number + ' | ' : ''}
                  <strong>تاريخ فتح الحساب:</strong> ${client.created_at ? client.created_at.split(' ')[0] : '-'}
                </div>
              </div>

              <div style="text-align: left;">
                <div style="font-size: 0.78rem; color: var(--text-secondary);">الرصيد الحالي المستحق</div>
                <div style="font-size: 1.4rem; font-weight: 800; color: ${stats.current_balance > 0 ? 'var(--gold-dark)' : 'var(--accent-green)'};">
                  ${this.formatNumber(stats.current_balance)} ${cur}
                </div>
              </div>
            </div>
          </div>

          <!-- شبكة ملخص الحساب المالي -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin-bottom: 16px;">
            <div style="background: var(--bg-card); border: 1px solid var(--border-light); padding: 12px; border-radius: var(--radius-sm); text-align: center;">
              <span style="font-size: 0.75rem; color: var(--text-secondary); display: block;">الرصيد الافتتاحي</span>
              <strong style="font-size: 1rem; color: var(--text-primary);">${this.formatNumber(stats.opening_balance)} ${cur}</strong>
            </div>
            <div style="background: var(--bg-card); border: 1px solid var(--border-light); padding: 12px; border-radius: var(--radius-sm); text-align: center;">
              <span style="font-size: 0.75rem; color: var(--text-secondary); display: block;">إجمالي الحركات المدينة (فواتير/مستخلصات)</span>
              <strong style="font-size: 1rem; color: var(--accent-red);">${this.formatNumber(stats.total_debits)} ${cur}</strong>
            </div>
            <div style="background: var(--bg-card); border: 1px solid var(--border-light); padding: 12px; border-radius: var(--radius-sm); text-align: center;">
              <span style="font-size: 0.75rem; color: var(--text-secondary); display: block;">إجمالي الحركات الدائنة (تحصيلات)</span>
              <strong style="font-size: 1rem; color: var(--accent-green);">${this.formatNumber(stats.total_credits)} ${cur}</strong>
            </div>
            <div style="background: var(--bg-card); border: 1px solid var(--border-light); padding: 12px; border-radius: var(--radius-sm); text-align: center;">
              <span style="font-size: 0.75rem; color: var(--text-secondary); display: block;">سقف الائتمان</span>
              <strong style="font-size: 1rem; color: var(--accent-blue);">${limit > 0 ? this.formatNumber(limit) + ' ' + cur : 'غير محدد'}</strong>
            </div>
          </div>

          <!-- شريط استهلاك سقف الائتمان إن وجد -->
          ${limit > 0 ? `
            <div style="background: var(--bg-card); border: 1px solid var(--border-light); padding: 14px; border-radius: var(--radius-sm); margin-bottom: 16px;">
              <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 6px;">
                <span><strong>نسبة استهلاك سقف الائتمان:</strong> ${util}%</span>
                <span>المتبقي من الائتمان: <strong>${this.formatNumber(stats.credit_remaining)} ${cur}</strong></span>
              </div>
              <div style="background: #e8e3d8; height: 10px; border-radius: 5px; overflow: hidden;">
                <div style="width: ${util}%; height: 100%; background: ${utilColor}; transition: width 0.4s ease;"></div>
              </div>
              ${stats.is_limit_exceeded ? '<div style="color: var(--accent-red); font-size: 0.78rem; font-weight: bold; margin-top: 6px;">⚠️ تنبيه: تم تجاوز سقف الائتمان المسموح لهذا الحساب بمقدار (' + this.formatNumber(stats.current_balance - limit) + ' ' + cur + ')</div>' : ''}
            </div>
          ` : ''}

          <!-- جدول آخر الحركات على الحساب -->
          <div style="border: 1px solid var(--border-light); border-radius: var(--radius-sm); overflow: hidden;">
            <div style="background: #f7f5f0; padding: 10px 14px; font-weight: bold; font-size: 0.88rem; display: flex; justify-content: space-between; align-items: center;">
              <span>أحدث الحركات المحاسبية المسجلة على الحساب</span>
              <span style="font-size: 0.75rem; color: var(--text-muted);">${transactions.length} حركة مسجلة</span>
            </div>
            <div class="table-responsive" style="max-height: 220px; overflow-y: auto;">
              <table class="custom-table" style="font-size: 0.82rem; margin: 0;">
                <thead>
                  <tr style="background: #fff;">
                    <th>التاريخ</th>
                    <th>نوع الحركة</th>
                    <th>رقم المرجع</th>
                    <th>مدين (+)</th>
                    <th>دائن (-)</th>
                    <th>الرصيد التراكمي</th>
                  </tr>
                </thead>
                <tbody>
                  ${transactions.length === 0 ? '<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 16px;">لا توجد حركات مسجلة بعد</td></tr>' : 
                    transactions.slice(-15).reverse().map(t => `
                      <tr>
                        <td>${t.date}</td>
                        <td>${t.type}</td>
                        <td><span style="font-family: monospace; font-weight: bold;">${t.ref_no || '-'}</span></td>
                        <td style="color: var(--accent-red); font-weight: bold;">${t.debit > 0 ? this.formatNumber(t.debit) : '-'}</td>
                        <td style="color: var(--accent-green); font-weight: bold;">${t.credit > 0 ? this.formatNumber(t.credit) : '-'}</td>
                        <td style="font-weight: bold; color: var(--text-primary);">${this.formatNumber(t.running_balance)}</td>
                      </tr>
                    `).join('')
                  }
                </tbody>
              </table>
            </div>
          </div>
        `;
      }

      this.openModal('clientAccountCardModal');
    } catch (e) {
      console.error('Error viewing account card:', e);
      this.showToast('خطأ أثناء تحميل بطاقة الحساب', 'error');
    }
  },

  printCustomerAccountCertificate() {
    if (!this._currentCardClient) return;
    const client = this._currentCardClient;
    const stats = this._currentCardStats || {};
    const cur = client.currency || 'ر.ي';

    const printWin = window.open('', '_blank');
    if (!printWin) {
      alert('يرجى السماح بالنوافذ المنبثقة لطباعة شهادة الحساب');
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>شهادة فتح حساب عميل - ${client.name}</title>
        <style>
          body { font-family: 'Cairo', Arial, sans-serif; direction: rtl; padding: 25px; color: #2d251a; background: #fff; }
          .header { text-align: center; border-bottom: 2px solid #b89355; padding-bottom: 15px; margin-bottom: 20px; }
          .logo-text { font-size: 20px; font-weight: bold; color: #b89355; margin-bottom: 4px; }
          .sub-text { font-size: 13px; color: #6e6252; }
          .cert-title { font-size: 18px; font-weight: 800; margin: 16px 0; color: #2d251a; background: #f8f6f0; padding: 8px; border-radius: 6px; }
          .info-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          .info-table td { padding: 8px 12px; border: 1px solid #dfd4c0; font-size: 13px; }
          .info-table td.label { font-weight: bold; background: #faf7f2; width: 25%; color: #6e6252; }
          .fin-grid { display: flex; gap: 15px; margin-bottom: 25px; }
          .fin-card { flex: 1; border: 1px solid #dfd4c0; border-radius: 6px; padding: 12px; text-align: center; background: #faf7f2; }
          .fin-card span { display: block; font-size: 12px; color: #6e6252; margin-bottom: 4px; }
          .fin-card strong { font-size: 16px; color: #2d251a; }
          .signatures { display: flex; justify-content: space-between; margin-top: 40px; padding: 0 30px; }
          .sign-box { text-align: center; font-size: 13px; }
          .sign-line { width: 140px; border-bottom: 1px dashed #6e6252; margin: 35px auto 8px; }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo-text">شركة رواسي عدن للهندسة والمقاولات</div>
          <div class="sub-text">الإدارة المالية والمحاسبية | دليل شجرة الحسابات</div>
          <div class="cert-title">شهادة واعتماد فتح حساب عميل مالي</div>
        </div>

        <table class="info-table">
          <tr>
            <td class="label">رقم الحساب المحاسبي:</td>
            <td><strong>${client.account_code || '112---'}</strong> (حساب فرعي تحت 112 العملاء)</td>
            <td class="label">تاريخ فتح الحساب:</td>
            <td>${client.created_at ? client.created_at.split(' ')[0] : new Date().toISOString().split('T')[0]}</td>
          </tr>
          <tr>
            <td class="label">اسم صاحب الحساب:</td>
            <td><strong>${client.name}</strong></td>
            <td class="label">اسم المنشأة / الشركة:</td>
            <td>${client.company || '-'}</td>
          </tr>
          <tr>
            <td class="label">رقم الهاتف:</td>
            <td>${client.phone || '-'}</td>
            <td class="label">العنوان والمدينة:</td>
            <td>${client.address || 'عدن'}</td>
          </tr>
          <tr>
            <td class="label">السجل التجاري / الهوية:</td>
            <td>${client.commercial_reg || '-'}</td>
            <td class="label">الرقم الضريبي:</td>
            <td>${client.tax_number || '-'}</td>
          </tr>
          <tr>
            <td class="label">سقف الائتمان المعتمد:</td>
            <td><strong>${stats.credit_limit ? App.formatNumber(stats.credit_limit) + ' ' + cur : 'غير محدد'}</strong></td>
            <td class="label">شروط وفترة السداد:</td>
            <td>${client.payment_terms_days ? client.payment_terms_days + ' يوم' : 'نقدي فوري'}</td>
          </tr>
        </table>

        <div class="fin-grid">
          <div class="fin-card">
            <span>الرصيد الافتتاحي</span>
            <strong>${App.formatNumber(stats.opening_balance || 0)} ${cur}</strong>
          </div>
          <div class="fin-card">
            <span>إجمالي المسدد والمحصل</span>
            <strong style="color: #2e7d32;">${App.formatNumber(stats.total_credits || 0)} ${cur}</strong>
          </div>
          <div class="fin-card">
            <span>الرصيد القائم المستحق</span>
            <strong style="color: #967439;">${App.formatNumber(stats.current_balance || 0)} ${cur}</strong>
          </div>
        </div>

        <div style="font-size: 12px; color: #6e6252; line-height: 1.6; margin-bottom: 20px;">
          تشهد إدارة الحسابات في شركة رواسي عدن للهندسة والمقاولات بأن الحساب المحاسبي الموضح أعلاه قد تم فتحه وربطه بصورة نظامية ومحاسبية في شجرة حسابات الشركة تحت حساب الأصول المتداولة (الذمم المدينة) وفقاً للمعايير والأنظمة المحاسبية المعتمدة.
        </div>

        <div class="signatures">
          <div class="sign-box">
            <div>المحاسب المالي المختص</div>
            <div class="sign-line"></div>
            <div>التوقيع / الختم</div>
          </div>
          <div class="sign-box">
            <div>مدير الشؤون المالية</div>
            <div class="sign-line"></div>
            <div>التوقيع / الختم</div>
          </div>
          <div class="sign-box">
            <div>اعتماد المدير العام</div>
            <div class="sign-line"></div>
            <div>شركة رواسي عدن</div>
          </div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(() => { window.print(); }, 400);
          };
        </script>
      </body>
      </html>
    `;

    printWin.document.write(html);
    printWin.document.close();
  },

  async openEditClientModal(clientId) {
    try {
      const res = await fetch(`/api/clients/${clientId}`);
      const json = await res.json();
      if (!json.success || !json.data) {
        this.showToast('تعذر جلب بيانات العميل للتعديل', 'error');
        return;
      }
      const c = json.data;
      document.getElementById('editClientId').value = c.id;
      document.getElementById('editClientName').value = c.name || '';
      document.getElementById('editClientAccountCode').value = c.account_code || '112---';
      document.getElementById('editClientCompany').value = c.company || '';
      document.getElementById('editClientPhone').value = c.phone || '';
      document.getElementById('editClientCreditLimit').value = c.credit_limit || 0;
      document.getElementById('editClientPaymentTerms').value = c.payment_terms_days || 30;
      document.getElementById('editClientAccountStatus').value = c.account_status || 'نشط';
      document.getElementById('editClientCommercialReg').value = c.commercial_reg || '';
      document.getElementById('editClientTaxNumber').value = c.tax_number || '';
      document.getElementById('editClientAddress').value = c.address || '';
      document.getElementById('editClientNotes').value = c.notes || '';

      this.openModal('editClientModal');
    } catch (e) {
      console.error(e);
      this.showToast('خطأ أثناء تحميل بيانات العميل', 'error');
    }
  },

  async submitEditClient(e) {
    if (e) e.preventDefault();
    const id = document.getElementById('editClientId').value;
    if (!id) return;

    const payload = {
      name: document.getElementById('editClientName').value.trim(),
      company: document.getElementById('editClientCompany').value.trim(),
      phone: document.getElementById('editClientPhone').value.trim(),
      credit_limit: document.getElementById('editClientCreditLimit').value,
      payment_terms_days: document.getElementById('editClientPaymentTerms').value,
      account_status: document.getElementById('editClientAccountStatus').value,
      commercial_reg: document.getElementById('editClientCommercialReg').value.trim(),
      tax_number: document.getElementById('editClientTaxNumber').value.trim(),
      address: document.getElementById('editClientAddress').value.trim(),
      notes: document.getElementById('editClientNotes').value.trim()
    };

    try {
      const res = await fetch(`/api/clients/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        this.showToast(data.message || 'تم تحديث بيانات الحساب بنجاح', 'success');
        this.closeModal('editClientModal');
        this.loadClientsTable();
        if (window.Accounting && Accounting.loadClients) Accounting.loadClients();
      } else {
        this.showToast(data.message || 'فشل تحديث بيانات الحساب', 'error');
      }
    } catch (err) {
      console.error(err);
      this.showToast('خطأ في الاتصال بالخادم', 'error');
    }
  },

  switchClientModalTab(tabKey) {
    const tabs = ['info', 'finance', 'opening'];
    tabs.forEach(t => {
      const btn = document.getElementById(`cTabBtn_${t}`);
      const pane = document.getElementById(`cTabPane_${t}`);
      if (btn) btn.classList.remove('active');
      if (pane) pane.style.display = 'none';
    });

    const activeBtn = document.getElementById(`cTabBtn_${tabKey}`);
    const activePane = document.getElementById(`cTabPane_${tabKey}`);
    if (activeBtn) activeBtn.classList.add('active');
    if (activePane) activePane.style.display = 'block';

    const prevBtn = document.getElementById('cPrevTabBtn');
    const nextBtn = document.getElementById('cNextTabBtn');
    const idx = tabs.indexOf(tabKey);
    if (prevBtn) prevBtn.style.display = (idx > 0) ? 'inline-block' : 'none';
    if (nextBtn) nextBtn.style.display = (idx < tabs.length - 1) ? 'inline-block' : 'none';
  },

  nextClientModalTab() {
    const activeBtn = document.querySelector('.client-modal-tab-btn.active');
    if (!activeBtn) return;
    if (activeBtn.id === 'cTabBtn_info') this.switchClientModalTab('finance');
    else if (activeBtn.id === 'cTabBtn_finance') this.switchClientModalTab('opening');
  },

  prevClientModalTab() {
    const activeBtn = document.querySelector('.client-modal-tab-btn.active');
    if (!activeBtn) return;
    if (activeBtn.id === 'cTabBtn_opening') this.switchClientModalTab('finance');
    else if (activeBtn.id === 'cTabBtn_finance') this.switchClientModalTab('info');
  },

  async loadSuppliersTable() {
    try {
      const res = await fetch('/api/suppliers');
      const json = await res.json();
      const tbody = document.getElementById('fullSuppliersTableBody');
      if (tbody && json.success) {
        tbody.innerHTML = json.data.map(s => `
          <tr>
            <td><strong>${s.name}</strong></td>
            <td><span class="badge badge-active">${s.category || 'مواد بناء'}</span></td>
            <td>${s.phone || '-'}</td>
            <td>${s.address || '-'}</td>
            <td style="color: var(--accent-amber); font-weight: bold;">${this.formatNumber(s.balance)} ${s.currency || 'ر.ي'}</td>
            <td>${s.notes || '-'}</td>
            <td style="text-align: center; white-space: nowrap;">
              <button class="btn btn-secondary btn-sm" onclick="App.navigate('reports'); Reports.switchReportTab('supplier-statement'); document.getElementById('repSupplierSelect').value = ${s.id}; Reports.fetchFullSupplierStatement();">
                كشف الحساب
              </button>
              <button class="btn btn-danger btn-sm" onclick="App.deleteSupplier(${s.id}, '${s.name}')" title="حذف المورد">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style="vertical-align: middle;"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                <span>حذف</span>
              </button>
            </td>
          </tr>
        `).join('');
      }
    } catch (e) {}
  },

  // دوال الحذف الشامل في أقسام النظام
  async deletePayment(id, receiptNo, type) {
    if (!confirm(`هل أنت متأكد من حذف سند ال${type} رقم (${receiptNo})؟ سيتم عكس أثره المالي بنجاح.`)) return;
    try {
      const res = await fetch(`/api/payments/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        this.showToast(data.message, 'success');
        this.loadRevenuesTable();
        this.loadExpensesTable();
        this.loadCashTable();
        this.loadClientsTable();
      } else {
        this.showToast(data.message || 'فشل حذف السند', 'error');
      }
    } catch (e) {
      this.showToast('خطأ أثناء حذف السند', 'error');
    }
  },

  async deleteExpense(id, receiptNo) {
    if (!confirm(`هل أنت متأكد من حذف سند الصرف رقم (${receiptNo})؟`)) return;
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        this.showToast(data.message, 'success');
        this.loadExpensesTable();
        if (window.Projects) Projects.loadProjects();
      } else {
        this.showToast(data.message || 'فشل حذف سند الصرف', 'error');
      }
    } catch (e) {
      this.showToast('خطأ أثناء حذف سند الصرف', 'error');
    }
  },

  async deleteCustody(id, employeeName) {
    if (!confirm(`هل أنت متأكد من حذف عهدة الموظف (${employeeName})؟`)) return;
    try {
      const res = await fetch(`/api/accounting/custodies/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        this.showToast(data.message, 'success');
        this.loadCustodyTable();
      } else {
        this.showToast(data.message || 'فشل حذف العهدة', 'error');
      }
    } catch (e) {
      this.showToast('خطأ أثناء حذف العهدة', 'error');
    }
  },

  async deleteClient(id, name) {
    if (!confirm(`هل أنت متأكد من حذف العميل (${name}) من النظام؟`)) return;
    try {
      const res = await fetch(`/api/clients/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        this.showToast(data.message, 'success');
        this.loadClientsTable();
        if (window.Accounting) Accounting.loadClients();
      } else {
        this.showToast(data.message || 'فشل حذف العميل', 'error');
      }
    } catch (e) {
      this.showToast('خطأ أثناء حذف العميل', 'error');
    }
  },

  async deleteSupplier(id, name) {
    if (!confirm(`هل أنت متأكد من حذف المورد (${name}) من النظام؟`)) return;
    try {
      const res = await fetch(`/api/suppliers/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        this.showToast(data.message, 'success');
        this.loadSuppliersTable();
        if (window.Accounting) Accounting.loadSuppliers();
      } else {
        this.showToast(data.message || 'فشل حذف المورد', 'error');
      }
    } catch (e) {
      this.showToast('خطأ أثناء حذف المورد', 'error');
    }
  },

  async loadCashTable() {
    try {
      const res = await fetch('/api/accounting/cash-movements');
      const json = await res.json();
      const tbody = document.getElementById('fullCashTableBody');
      if (tbody && json.success) {
        tbody.innerHTML = json.data.map(m => `
          <tr>
            <td>${m.date}</td>
            <td>${this.formatNumber(m.previous_balance)}</td>
            <td style="color: var(--accent-green); font-weight: bold;">${m.cash_in ? '+' + this.formatNumber(m.cash_in) : '-'}</td>
            <td style="color: var(--accent-red); font-weight: bold;">${m.cash_out ? '-' + this.formatNumber(m.cash_out) : '-'}</td>
            <td>${m.withdrawals ? this.formatNumber(m.withdrawals) : '-'}</td>
            <td style="color: var(--gold-light); font-weight: bold;">${this.formatNumber(m.current_balance)}</td>
            <td>${m.notes || '-'}</td>
          </tr>
        `).join('');
      }
    } catch (e) {}
  },


  // النوافذ المنبثقة
  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('active');
    }
  },

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('active');
    }
  },

  // رسائل التنبيه العائمة الفاخرة (Toast)
  showToast(message, type = 'info') {
    const existing = document.querySelectorAll('.toast-msg');
    existing.forEach(t => t.remove());

    const toast = document.createElement('div');
    toast.className = `toast-msg toast-${type}`;

    let icon = '🔔';
    if (type === 'success') {
      icon = '✅';
    } else if (type === 'error') {
      icon = '⚠️';
    } else if (type === 'warning') {
      icon = '⚡';
    } else if (type === 'info') {
      icon = 'ℹ️';
    }

    toast.innerHTML = `
      <div class="toast-icon">${icon}</div>
      <div class="toast-content">
        <div class="toast-text">${message}</div>
      </div>
      <button type="button" class="toast-close" title="إغلاق">&times;</button>
    `;

    const closeBtn = toast.querySelector('.toast-close');
    if (closeBtn) {
      closeBtn.onclick = () => {
        toast.classList.remove('toast-visible');
        setTimeout(() => toast.remove(), 250);
      };
    }

    document.body.appendChild(toast);

    // تفعيل ظهور الرسالة بانسيابية
    requestAnimationFrame(() => {
      toast.classList.add('toast-visible');
    });

    // إخفاء الرسالة تلقائياً بعد 4 ثوانٍ
    setTimeout(() => {
      if (toast.parentElement) {
        toast.classList.remove('toast-visible');
        setTimeout(() => {
          if (toast.parentElement) toast.remove();
        }, 350);
      }
    }, 4500);
  },

  // تنسيق الأرقام بالفواصل المالية
  formatNumber(num) {
    if (num === null || num === undefined || isNaN(num)) return '0';
    return Number(num).toLocaleString('en-US');
  },

  // مراقبة اتصال الشبكة في المتصفح وتحديث حالة قاعدة البيانات
  setupNetworkWatchers() {
    window.addEventListener('online', async () => {
      await this.checkDatabaseStatus();
      this.showToast('تم استعادة الاتصال بالشبكة، جاري فحص السيرفر السحابي 🌐', 'info');
    });

    window.addEventListener('offline', () => {
      this.updateConnectionUI({
        isOnline: false,
        mode: 'offline',
        activeDb: 'local',
        statusMessage: 'المتصفح في وضع عدم الاتصال - يعمل النظام محلياً (أوفلاين)'
      });
      this.showToast('أنت الآن غير متصل بالإنترنت - يتم حفظ بياناتك على قاعدة البيانات المحلية 🟠', 'warning');
    });
  },

  // التحقق المسبق من حالة قاعدة البيانات والاتصال
  async checkDatabaseStatus() {
    try {
      const res = await fetch('/api/settings/db-status');
      const json = await res.json();
      if (json && json.success) {
        this.dbStatus = json.data;
        this.updateConnectionUI(json.data);
        return json.data;
      }
    } catch (e) {
      console.warn('Database status check failed, using local offline mode:', e);
      const fallback = {
        isOnline: false,
        mode: 'offline',
        activeDb: 'local',
        statusMessage: 'الوضع المحلي (أوفلاين) نشط'
      };
      this.dbStatus = fallback;
      this.updateConnectionUI(fallback);
      return fallback;
    }
  },

  // التحكم بفتح وإغلاق قائمة الإشعارات المنسدلة وحالة الاتصال
  toggleNotificationsDropdown(e) {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const dropdown = document.getElementById('notificationsDropdown');
    if (!dropdown) return;

    const isActive = dropdown.classList.contains('active');
    if (isActive) {
      dropdown.classList.remove('active');
    } else {
      this.renderNotificationsList();
      dropdown.classList.add('active');
    }
  },

  closeNotificationsDropdown() {
    const dropdown = document.getElementById('notificationsDropdown');
    if (dropdown) dropdown.classList.remove('active');
  },

  // تحديث شارة وحالة الاتصال داخل قائمة الإشعارات وشاشة تسجيل الدخول
  updateConnectionUI(status) {
    const isOnline = !!(status && status.isOnline);
    const latency = (status && status.latencyMs) || 0;

    // 1. بطاقة الاتصال الرئيسية داخل قائمة الإشعارات
    const notifCard = document.getElementById('notifConnCard');
    const notifIcon = document.getElementById('notifConnIcon');
    const notifTitle = document.getElementById('notifConnStatusTitle');
    const notifDesc = document.getElementById('notifConnStatusDesc');
    const notifBadge = document.getElementById('notifConnBadge');

    if (notifCard) {
      notifCard.className = `notif-conn-card ${isOnline ? 'status-online' : 'status-offline'}`;
    }
    if (notifIcon) {
      notifIcon.textContent = isOnline ? '🟢' : '🔴';
    }
    if (notifTitle) {
      notifTitle.textContent = isOnline ? `متصل بالسيرفر السحابي (${latency}ms)` : 'قاعدة البيانات المحلية (أوفلاين)';
    }
    if (notifDesc) {
      notifDesc.textContent = isOnline 
        ? 'المشروع متصل بقاعدة البيانات السحابية المركزية، وتتم المزامنة تلقائياً'
        : 'يعمل النظام محلياً على قاعدة بيانات SQLite، مع حفظ كافة التعديلات بأمان تام';
    }
    if (notifBadge) {
      notifBadge.className = `notif-conn-badge ${isOnline ? 'online' : 'offline'}`;
      notifBadge.textContent = isOnline ? '🟢 أونلاين' : '🔴 أوفلاين';
    }

    // 2. نقطة الإشعار على أيقونة الجرس
    const notifDot = document.getElementById('headerNotificationDot');
    if (notifDot) {
      notifDot.className = `notification-dot ${isOnline ? 'online' : 'offline'}`;
    }

    // 3. نقطة الحالة على صورة المستخدم
    const userAvatarDot = document.getElementById('userAvatarStatusDot');
    if (userAvatarDot) {
      userAvatarDot.className = `user-avatar-dot ${isOnline ? 'online' : 'offline'}`;
      userAvatarDot.setAttribute('title', isOnline ? 'أونلاين (سحابي)' : 'أوفلاين (محلي)');
    }

    // 4. شارة شاشة تسجيل الدخول
    const loginBadge = document.getElementById('loginConnectionBadge');
    const loginText = document.getElementById('loginConnectionText');
    const loginDot = document.getElementById('loginConnectionDot');

    if (loginBadge) {
      loginBadge.className = `connection-status-pill ${isOnline ? 'status-online' : 'status-offline'}`;
      loginBadge.setAttribute('title', isOnline ? `السيرفر السحابي متصل (${latency}ms) - انقر للتفاصيل` : 'قاعدة البيانات المحلية نشطة (أوفلاين) - انقر للتفاصيل');
    }
    if (loginText) {
      loginText.textContent = isOnline ? `متصل سحابياً (${latency}ms)` : 'قاعدة البيانات المحلية (أوفلاين)';
    }
    if (loginDot) {
      loginDot.className = `status-indicator-dot ${isOnline ? 'online' : 'offline'}`;
    }

    // 5. إعادة بناء قائمة الإشعارات
    this.renderNotificationsList();
  },

  // بناء عناصر قائمة الإشعارات ديناميكياً
  renderNotificationsList() {
    const listEl = document.getElementById('notifList');
    if (!listEl) return;

    const s = this.dbStatus || {};
    const isOnline = !!s.isOnline;
    const user = (typeof Auth !== 'undefined' && Auth.currentUser) ? Auth.currentUser.full_name : 'المستخدم';

    const items = [
      {
        icon: isOnline ? '🟢' : '🔴',
        iconClass: isOnline ? 'success' : 'warning',
        title: isOnline ? 'تم التحقق من الاتصال السحابي' : 'يعمل النظام على قاعدة البيانات المحلية',
        desc: isOnline ? `تم فحص السيرفر السحابي بنجاح (${s.latencyMs || 0}ms)` : 'الاتصال السحابي غير مفعل - البيانات تحفظ محلياً',
        time: 'عند تسجيل الدخول'
      },
      {
        icon: '💾',
        iconClass: 'info',
        title: 'نظام النسخ الاحتياطي التلقائي نشط',
        desc: 'يتم أخذ نسخة احتياطية فورية تلقائياً عند تسجيل الخروج لضمان عدم ضياع أي تعديل',
        time: 'تلقائي دائم'
      },
      {
        icon: '🛡️',
        iconClass: 'success',
        title: 'حماية وتكامل البيانات 100%',
        desc: 'كافة القيود والسندات والمشاريع تخزن فورياً بأعلى معايير الأمان المالي',
        time: 'النظام مؤمن'
      }
    ];

    listEl.innerHTML = items.map(item => `
      <div class="notif-item">
        <div class="notif-item-icon ${item.iconClass}">${item.icon}</div>
        <div class="notif-item-content">
          <div class="notif-item-title">${item.title}</div>
          <div style="font-size: 0.72rem; color: var(--text-secondary); margin-bottom: 2px;">${item.desc}</div>
          <div class="notif-item-time">${item.time}</div>
        </div>
      </div>
    `).join('');
  },

  // إظهار نافذة تفاصيل الاتصال والنسخ الاحتياطي
  showConnectionModal() {
    const modal = document.getElementById('connectionDetailsModal');
    if (!modal) return;

    const s = this.dbStatus || {};
    const modeEl = document.getElementById('connModalMode');
    const statusTextEl = document.getElementById('connModalStatusText');
    const latencyEl = document.getElementById('connModalLatency');
    const dbFileEl = document.getElementById('connModalDbFile');
    const lastBackupEl = document.getElementById('connModalLastBackup');

    if (modeEl) {
      modeEl.textContent = s.isOnline ? 'سحابي (Online)' : 'محلي (Offline - SQLite)';
      modeEl.className = s.isOnline ? 'badge badge-active' : 'badge badge-warning';
    }
    if (statusTextEl) statusTextEl.textContent = s.statusMessage || 'يعمل على قاعدة البيانات المحلية';
    if (latencyEl) latencyEl.textContent = s.isOnline ? `${s.latencyMs || 0} ms` : '0 ms (محلي فوري)';
    if (dbFileEl) dbFileEl.textContent = s.localDbFile || 'rawasi_aden.db';

    if (lastBackupEl) {
      if (s.lastLogoutBackup) {
        lastBackupEl.innerHTML = `
          <strong style="color: var(--gold-light);">${s.lastLogoutBackup.fileName}</strong><br>
          <small style="color: var(--text-secondary);">المستخدم: ${s.lastLogoutBackup.username} | التاريخ: ${s.lastLogoutBackup.displayTime} | الحجم: ${(s.lastLogoutBackup.size / 1024).toFixed(1)} KB</small>
        `;
      } else {
        lastBackupEl.innerHTML = '<span style="color: var(--text-secondary);">سيتم إنشاء أول نسخة تلقائياً عند تسجيل الخروج القادم</span>';
      }
    }

    this.openModal('connectionDetailsModal');
  },

  // إعادة فحص الاتصال يدوياً من النافذة
  async recheckConnectionModal() {
    const btn = document.getElementById('btnRecheckConn');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = 'جاري التحقق... ⏳';
    }
    try {
      const data = await this.checkDatabaseStatus();
      this.showConnectionModal();
      if (data && data.isOnline) {
        this.showToast('تم التحقق بنجاح: متصل بالسيرفر السحابي 🟢', 'success');
      } else {
        this.showToast('تم التحقق: النظام يعمل بنجاح على قاعدة البيانات المحلية 🟠', 'info');
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = 'إعادة فحص الاتصال الآن 🔄';
      }
    }
  }
};

// تشغيل التطبيق عند اكتمال تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
