/**
 * وحدة إدارة وخدمة سندات القبض والصرف (Vouchers Service)
 * نظام شركة رواسي عدن للهندسة والمقاولات
 */

const Vouchers = {
  vouchersList: [],
  _selectedVoucher: null,
  currentFilter: {
    type: 'all', // 'all', 'قبض', 'صرف'
    projectId: 'all',
    method: 'all',
    currency: 'all',
    fromDate: '',
    toDate: '',
    search: ''
  },

  async init() {
    await this.loadProjectsFilter();
    await this.loadVouchers();
  },

  async loadProjectsFilter() {
    try {
      const res = await fetch('/api/projects');
      const json = await res.json();
      if (json.success) {
        const select = document.getElementById('voucherFilterProject');
        if (select) {
          const currentVal = select.value;
          select.innerHTML = '<option value="all">جميع المشاريع</option>' +
            json.data.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
          select.value = currentVal || 'all';
        }
      }
    } catch (e) {
      console.error('Error loading projects filter:', e);
    }
  },

  async loadVouchers() {
    try {
      const params = new URLSearchParams();
      if (this.currentFilter.type && this.currentFilter.type !== 'all') {
        params.append('type', this.currentFilter.type);
      }
      if (this.currentFilter.projectId && this.currentFilter.projectId !== 'all') {
        params.append('project_id', this.currentFilter.projectId);
      }
      if (this.currentFilter.fromDate) {
        params.append('from_date', this.currentFilter.fromDate);
      }
      if (this.currentFilter.toDate) {
        params.append('to_date', this.currentFilter.toDate);
      }
      if (this.currentFilter.search) {
        params.append('search', this.currentFilter.search);
      }

      const res = await fetch('/api/payments/all-vouchers?' + params.toString());
      const json = await res.json();
      if (json.success) {
        this.vouchersList = json.data || [];
        this.updateKPIs(json.summary);
        this.renderTable();
      }
    } catch (e) {
      console.error('Error loading vouchers:', e);
    }
  },

  updateKPIs(summary) {
    if (!summary) return;
    const elRecTotal = document.getElementById('vouchersKpiReceiptsTotal');
    const elRecCount = document.getElementById('vouchersKpiReceiptsCount');
    const elExpTotal = document.getElementById('vouchersKpiExpensesTotal');
    const elExpCount = document.getElementById('vouchersKpiExpensesCount');
    const elNetTotal = document.getElementById('vouchersKpiNetTotal');
    const elTotalCount = document.getElementById('vouchersKpiTotalCount');

    if (elRecTotal) elRecTotal.textContent = (typeof App !== 'undefined' && App.formatNumber) ? App.formatNumber(summary.totalReceipts) : summary.totalReceipts;
    if (elRecCount) elRecCount.textContent = `(${summary.countReceipts} سند)`;
    if (elExpTotal) elExpTotal.textContent = (typeof App !== 'undefined' && App.formatNumber) ? App.formatNumber(summary.totalExpenses) : summary.totalExpenses;
    if (elExpCount) elExpCount.textContent = `(${summary.countExpenses} سند)`;
    if (elNetTotal) {
      elNetTotal.textContent = (typeof App !== 'undefined' && App.formatNumber) ? App.formatNumber(summary.netBalance) : summary.netBalance;
      elNetTotal.style.color = summary.netBalance >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
    }
    if (elTotalCount) elTotalCount.textContent = summary.totalCount;

    // تحديث شارات الألسنة
    const bAll = document.getElementById('voucherTabBadgeAll');
    const bRc = document.getElementById('voucherTabBadgeRc');
    const bExp = document.getElementById('voucherTabBadgeExp');
    if (bAll) bAll.textContent = summary.totalCount;
    if (bRc) bRc.textContent = summary.countReceipts;
    if (bExp) bExp.textContent = summary.countExpenses;
  },

  setTab(tabType, clickedBtn = null) {
    this.currentFilter.type = tabType;
    document.querySelectorAll('.voucher-tab-btn').forEach(btn => btn.classList.remove('active'));
    if (clickedBtn) {
      clickedBtn.classList.add('active');
    } else {
      const btn = document.querySelector(`.voucher-tab-btn[data-tab="${tabType}"]`);
      if (btn) btn.classList.add('active');
    }
    this.loadVouchers();
  },

  applyFilters() {
    this.currentFilter.search = document.getElementById('voucherFilterSearch')?.value.trim() || '';
    this.currentFilter.projectId = document.getElementById('voucherFilterProject')?.value || 'all';
    this.currentFilter.method = document.getElementById('voucherFilterMethod')?.value || 'all';
    this.currentFilter.currency = document.getElementById('voucherFilterCurrency')?.value || 'all';
    this.currentFilter.fromDate = document.getElementById('voucherFilterFromDate')?.value || '';
    this.currentFilter.toDate = document.getElementById('voucherFilterToDate')?.value || '';
    this.loadVouchers();
  },

  resetFilters() {
    if (document.getElementById('voucherFilterSearch')) document.getElementById('voucherFilterSearch').value = '';
    if (document.getElementById('voucherFilterProject')) document.getElementById('voucherFilterProject').value = 'all';
    if (document.getElementById('voucherFilterMethod')) document.getElementById('voucherFilterMethod').value = 'all';
    if (document.getElementById('voucherFilterCurrency')) document.getElementById('voucherFilterCurrency').value = 'all';
    if (document.getElementById('voucherFilterFromDate')) document.getElementById('voucherFilterFromDate').value = '';
    if (document.getElementById('voucherFilterToDate')) document.getElementById('voucherFilterToDate').value = '';
    this.currentFilter = {
      type: this.currentFilter.type || 'all',
      projectId: 'all',
      method: 'all',
      currency: 'all',
      fromDate: '',
      toDate: '',
      search: ''
    };
    this.loadVouchers();
  },

  renderTable() {
    const tbody = document.getElementById('vouchersTableBody');
    if (!tbody) return;

    let list = this.vouchersList;

    // فلترة محلية لطريقة الدفع والعملة إذا تم تحديدهما
    if (this.currentFilter.method && this.currentFilter.method !== 'all') {
      list = list.filter(v => v.payment_method === this.currentFilter.method);
    }
    if (this.currentFilter.currency && this.currentFilter.currency !== 'all') {
      list = list.filter(v => (v.currency || 'ر.ي') === this.currentFilter.currency);
    }

    if (list.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align: center; padding: 40px 20px; color: var(--text-secondary);">
            <div style="font-size: 2.2rem; margin-bottom: 8px;">🧾</div>
            <strong style="font-size: 1.05rem; color: var(--text-primary);">لا توجد سندات مسجلة مطابقة للبحث</strong>
            <p style="font-size: 0.85rem; margin-top: 6px; color: var(--text-muted);">
              يمكنك إصدار سند قبض جديد أو سند صرف جديد بواسطة الأزرار المباشرة بالأعلى
            </p>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = list.map(v => {
      const isReceipt = (v.type === 'قبض');
      const badgeClass = isReceipt ? 'badge-receipt' : 'badge-expense';
      const badgeText = isReceipt ? '📥 سند قبض' : '📤 سند صرف';
      const amountColor = isReceipt ? 'var(--accent-green)' : 'var(--accent-red)';
      const curr = v.currency || 'ر.ي';
      const formattedAmount = (typeof App !== 'undefined' && App.formatNumber) ? App.formatNumber(v.amount) : v.amount;
      const vJson = JSON.stringify(v).replace(/"/g, '&quot;');

      return `
        <tr>
          <td>
            <a href="javascript:void(0)" class="voucher-code-link ${isReceipt ? 'rc-link' : 'exp-link'}" onclick="Vouchers.viewDetails(${vJson})" title="عرض تفاصيل السند">
              ${v.receipt_no}
            </a>
          </td>
          <td><span class="badge ${badgeClass}">${badgeText}</span></td>
          <td style="white-space: nowrap;">${v.date}</td>
          <td>
            <strong>${v.party_name || '-'}</strong>
            ${v.reference_no ? `<span class="badge badge-light-subtle" title="رقم المرجع/الشيك">#${v.reference_no}</span>` : ''}
          </td>
          <td>${v.project_name ? `<span>${v.project_name}</span>` : '<span style="color: var(--text-muted);">عام</span>'}</td>
          <td style="font-weight: 700; color: ${amountColor}; white-space: nowrap; font-size: 1rem; direction: ltr; text-align: right;">
            ${isReceipt ? '+' : '-'}${formattedAmount} ${curr}
          </td>
          <td>
            <span class="badge badge-method">${v.payment_method || 'نقدي'}</span>
          </td>
          <td style="max-width: 220px; font-size: 0.86rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${v.notes || ''}">
            ${v.notes || '-'}
          </td>
          <td style="text-align: center; white-space: nowrap;">
            <div style="display: inline-flex; gap: 4px; align-items: center;">
              <button class="btn btn-secondary btn-sm" onclick="Vouchers.printSingleVoucher(${vJson})" title="طباعة السند الرسمي A4">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/></svg>
                <span>طباعة</span>
              </button>
              <button class="btn btn-info btn-sm" onclick="Vouchers.viewDetails(${vJson})" title="معاينة تفاصيل السند">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
              </button>
              <button class="btn btn-danger btn-sm" onclick="Vouchers.deleteVoucher(${v.id}, '${v.receipt_no}', '${v.type}', '${v.source}')" title="حذف السند">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  printSingleVoucher(v) {
    if (v.type === 'قبض') {
      Accounting.printReceipt({
        receipt_no: v.receipt_no,
        date: v.date,
        client_name: v.party_name || v.client_name || 'العميل',
        project_name: v.project_name || '-',
        amount: v.amount,
        currency: v.currency || 'ر.ي',
        payment_method: v.payment_method || 'نقدي',
        notes: v.notes || '',
        reference_no: v.reference_no || ''
      });
    } else {
      Accounting.printExpenseReceipt({
        receipt_no: v.receipt_no,
        date: v.date,
        expense_type: v.category || 'مصروفات',
        supplier_name: v.party_name || v.supplier_name || 'المستفيد',
        project_name: v.project_name || '-',
        amount: v.amount,
        currency: v.currency || 'ر.ي',
        payment_method: v.payment_method || 'نقدي',
        notes: v.notes || '',
        reference_no: v.reference_no || ''
      });
    }
  },

  viewDetails(v) {
    const isReceipt = (v.type === 'قبض');
    const modalEl = document.getElementById('voucherDetailsModal');
    if (!modalEl) return;

    const words = Accounting.tafqeet(v.amount, v.currency || 'ر.ي');
    let currLabel = 'ريال يمني (ر.ي)';
    if (v.currency === 'ر.س') currLabel = 'ريال سعودي (ر.س)';
    else if (v.currency === '$' || v.currency === 'USD') currLabel = 'دولار أمريكي ($)';

    const formattedAmount = (typeof App !== 'undefined' && App.formatNumber) ? App.formatNumber(v.amount) : v.amount;

    document.getElementById('vdNumber').textContent = v.receipt_no;
    document.getElementById('vdTypeBadge').innerHTML = isReceipt ? 
      '<span class="badge badge-receipt" style="font-size: 0.92rem; padding: 4px 14px;">📥 سند قبض (إيراد)</span>' :
      '<span class="badge badge-expense" style="font-size: 0.92rem; padding: 4px 14px;">📤 سند صرف (مصروف)</span>';
    document.getElementById('vdDate').textContent = v.date;
    document.getElementById('vdPartyLabel').textContent = isReceipt ? 'استلمنا من الأخ/السادة:' : 'صرفنا إلى الأخ/السادة:';
    document.getElementById('vdPartyName').textContent = v.party_name || '-';
    document.getElementById('vdProject').textContent = v.project_name || 'عام (غير مرتبط بمشروع)';
    
    const vdAmount = document.getElementById('vdAmount');
    if (vdAmount) {
      vdAmount.textContent = `${isReceipt ? '+' : '-'}${formattedAmount} ${currLabel}`;
      vdAmount.style.color = isReceipt ? 'var(--accent-green)' : 'var(--accent-red)';
    }

    document.getElementById('vdTafqeet').textContent = words;
    document.getElementById('vdMethod').textContent = v.payment_method || 'نقدي';
    document.getElementById('vdRefNo').textContent = v.reference_no || 'لا يوجد';
    document.getElementById('vdCategory').textContent = v.category || (isReceipt ? 'إيرادات' : 'مصروفات');
    document.getElementById('vdNotes').textContent = v.notes || 'لا توجد ملاحظات إضافية';

    this._selectedVoucher = v;
    App.openModal('voucherDetailsModal');
  },

  printSelectedFromModal() {
    if (this._selectedVoucher) {
      this.printSingleVoucher(this._selectedVoucher);
    }
  },

  async deleteVoucher(id, receiptNo, type, source) {
    if (!confirm(`هل أنت متأكد من رغبتك في حذف ${type === 'قبض' ? 'سند القبض' : 'سند الصرف'} رقم (${receiptNo})؟\nسيتم عكس الأثر المالي في الصندوق والحسابات المرتبطة تلقائياً وبأمان.`)) {
      return;
    }

    try {
      const url = (source === 'expense') ? `/api/expenses/${id}` : `/api/payments/${id}`;
      const res = await fetch(url, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        App.showToast(`تم حذف السند (${receiptNo}) بنجاح`, 'success');
        this.loadVouchers();
        App.loadRevenuesTable();
        App.loadExpensesTable();
        Accounting.loadCashMovement();
        if (typeof Reports !== 'undefined') Reports.loadDashboardKPIs();
      } else {
        App.showToast(json.message || 'حدث خطأ أثناء حذف السند', 'error');
      }
    } catch (e) {
      App.showToast('فشل الاتصال بالخادم لحذف السند', 'error');
    }
  },

  exportCSV() {
    if (!this.vouchersList || this.vouchersList.length === 0) {
      App.showToast('لا توجد بيانات سندات لتصديرها', 'error');
      return;
    }

    let csv = '\uFEFF'; // UTF-8 BOM
    csv += 'رقم السند,النوع,التاريخ,المستلم منه / المصروف له,المشروع,المبلغ,العملة,طريقة الدفع,الرقم المرجعي,البيان\n';

    this.vouchersList.forEach(v => {
      const cleanParty = `"${(v.party_name || '').replace(/"/g, '""')}"`;
      const cleanProject = `"${(v.project_name || '').replace(/"/g, '""')}"`;
      const cleanNotes = `"${(v.notes || '').replace(/"/g, '""')}"`;
      const cleanRef = `"${(v.reference_no || '').replace(/"/g, '""')}"`;
      csv += `${v.receipt_no},${v.type},${v.date},${cleanParty},${cleanProject},${v.amount},${v.currency || 'ر.ي'},${v.payment_method || 'نقدي'},${cleanRef},${cleanNotes}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `سندات_رواسي_عدن_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    App.showToast('تم تصدير كشف السندات بنجاح', 'success');
  },

  printVouchersStatement() {
    const printArea = document.getElementById('printArea');
    if (!printArea) return;

    let list = this.vouchersList;
    if (this.currentFilter.method && this.currentFilter.method !== 'all') {
      list = list.filter(v => v.payment_method === this.currentFilter.method);
    }
    if (this.currentFilter.currency && this.currentFilter.currency !== 'all') {
      list = list.filter(v => (v.currency || 'ر.ي') === this.currentFilter.currency);
    }

    if (!list || list.length === 0) {
      App.showToast('لا توجد سندات للطباعة في الكشف المحدد', 'error');
      return;
    }

    const totalReceipts = list.filter(v => v.type === 'قبض').reduce((s, v) => s + (Number(v.amount) || 0), 0);
    const totalExpenses = list.filter(v => v.type === 'صرف').reduce((s, v) => s + (Number(v.amount) || 0), 0);
    const net = totalReceipts - totalExpenses;

    const rowsHtml = list.map((v, idx) => {
      const isReceipt = (v.type === 'قبض');
      return `
        <tr style="background: ${idx % 2 === 0 ? '#ffffff' : '#fbf9f5'}; height: 32px; border-bottom: 1px solid #e2d7c5;">
          <td style="text-align: center; font-weight: bold; padding: 6px;">${idx + 1}</td>
          <td style="text-align: center; font-weight: bold; color: #0f2744; padding: 6px;">${v.receipt_no}</td>
          <td style="text-align: center; padding: 6px;">
            <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 0.8rem; background: ${isReceipt ? '#edf7ee' : '#fdebee'}; color: ${isReceipt ? '#2e7d32' : '#c62828'};">
              ${v.type === 'قبض' ? 'سند قبض' : 'سند صرف'}
            </span>
          </td>
          <td style="text-align: center; padding: 6px;">${v.date}</td>
          <td style="padding: 6px; font-weight: bold;">${v.party_name || '-'}</td>
          <td style="padding: 6px;">${v.project_name || 'عام'}</td>
          <td style="text-align: left; padding: 6px; font-weight: bold; color: ${isReceipt ? '#2e7d32' : '#c62828'}; direction: ltr;">
            ${(typeof App !== 'undefined' && App.formatNumber) ? App.formatNumber(v.amount) : v.amount} ${v.currency || 'ر.ي'}
          </td>
          <td style="text-align: center; padding: 6px;">${v.payment_method || 'نقدي'}</td>
          <td style="padding: 6px; font-size: 0.82rem;">${v.notes || '-'}</td>
        </tr>
      `;
    }).join('');

    printArea.innerHTML = `
      <div style="direction: rtl; font-family: 'Cairo', 'Tajawal', sans-serif; padding: 25px; background: #fff; color: #111;">
        <div style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid #b89355; padding-bottom: 15px;">
          <h2 style="margin: 0; color: #0f2744; font-size: 1.5rem; font-weight: 800;">كشف حركة سندات القبض والصرف</h2>
          <div style="color: #666; font-size: 0.9rem; margin-top: 5px;">تاريخ الطباعة: ${new Date().toLocaleDateString('ar-YE')} | نظام رواسي عدن للهندسة والمقاولات</div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 12px; margin-bottom: 20px; text-align: center;">
          <div style="padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; background: #edf7ee;">
            <div style="font-size: 0.85rem; color: #2e7d32; font-weight: bold;">إجمالي المقبوضات</div>
            <div style="font-size: 1.15rem; font-weight: 800; color: #2e7d32; margin-top: 4px;">${(typeof App !== 'undefined' && App.formatNumber) ? App.formatNumber(totalReceipts) : totalReceipts} ر.ي</div>
          </div>
          <div style="padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; background: #fdebee;">
            <div style="font-size: 0.85rem; color: #c62828; font-weight: bold;">إجمالي المدفوعات</div>
            <div style="font-size: 1.15rem; font-weight: 800; color: #c62828; margin-top: 4px;">${(typeof App !== 'undefined' && App.formatNumber) ? App.formatNumber(totalExpenses) : totalExpenses} ر.ي</div>
          </div>
          <div style="padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; background: #f8f6f0;">
            <div style="font-size: 0.85rem; color: #2d251a; font-weight: bold;">صافي حركة السيولة</div>
            <div style="font-size: 1.15rem; font-weight: 800; color: #0f2744; margin-top: 4px;">${(typeof App !== 'undefined' && App.formatNumber) ? App.formatNumber(net) : net} ر.ي</div>
          </div>
          <div style="padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; background: #f8f6f0;">
            <div style="font-size: 0.85rem; color: #2d251a; font-weight: bold;">إجمالي السندات</div>
            <div style="font-size: 1.15rem; font-weight: 800; color: #0f2744; margin-top: 4px;">${list.length} سند</div>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 0.86rem; border: 1px solid #cbd5e1;">
          <thead>
            <tr style="background: #0e1a2c; color: #fff; height: 36px;">
              <th style="padding: 6px; border: 1px solid #334155; width: 35px;">#</th>
              <th style="padding: 6px; border: 1px solid #334155;">رقم السند</th>
              <th style="padding: 6px; border: 1px solid #334155;">النوع</th>
              <th style="padding: 6px; border: 1px solid #334155;">التاريخ</th>
              <th style="padding: 6px; border: 1px solid #334155;">الطرف المعني</th>
              <th style="padding: 6px; border: 1px solid #334155;">المشروع</th>
              <th style="padding: 6px; border: 1px solid #334155;">المبلغ والعملة</th>
              <th style="padding: 6px; border: 1px solid #334155;">طريقة الدفع</th>
              <th style="padding: 6px; border: 1px solid #334155;">البيان</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 40px; padding: 0 40px; text-align: center;">
          <div>
            <p style="font-weight: bold; margin-bottom: 40px; color: #0f2744;">إعداد المحاسب المالي</p>
            <p style="color: #666;">............................</p>
          </div>
          <div>
            <p style="font-weight: bold; margin-bottom: 40px; color: #0f2744;">المراجعة والتدقيق</p>
            <p style="color: #666;">............................</p>
          </div>
          <div>
            <p style="font-weight: bold; margin-bottom: 40px; color: #0f2744;">اعتماد المدير العام</p>
            <p style="color: #666;">............................</p>
          </div>
        </div>
      </div>
    `;

    App.printWithRawasiLetterhead(printArea);
  }
};

window.Vouchers = Vouchers;
