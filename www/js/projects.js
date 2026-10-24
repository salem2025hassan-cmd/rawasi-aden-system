/**
 * إدارة المشاريع والعقود ونسب الإنجاز - شركة رواسي عدن
 */

const Projects = {
  list: [],

  async init() {
    await this.loadProjects();
  },

  async loadProjects() {
    try {
      const res = await fetch('/api/projects');
      const json = await res.json();
      if (json.success) {
        this.list = json.data;
        this.renderProjectsTable();
      }
    } catch (e) {
      console.warn('Projects API unreachable, using sample projects:', e);
      if (this.list.length === 0) {
        this.list = [
          { id: 1, name: 'مشروع برج الأمل السكني', code: 'PRJ-2026-01', client_name: 'شركة الأمل العقارية', contract_value: 85000000, estimated_cost: 62000000, actual_cost: 41000000, progress_percentage: 65, currency: 'ر.ي' },
          { id: 2, name: 'مشروع مجمع الشروق التجاري', code: 'PRJ-2026-02', client_name: 'مؤسسة الشروق للتجارة', contract_value: 120000000, estimated_cost: 88000000, actual_cost: 32000000, progress_percentage: 35, currency: 'ر.ي' },
          { id: 3, name: 'أعمال سفلتة وإنارة المخطط الغربي', code: 'PRJ-2026-03', client_name: 'مكتب الأشغال العامة', contract_value: 45000000, estimated_cost: 34000000, actual_cost: 31000000, progress_percentage: 90, currency: 'ر.ي' }
        ];
        this.renderProjectsTable();
      }
    }
  },

  renderProjectsTable(projectsToRender = null) {
    const tableBodyDashboard = document.getElementById('projectsTableBody');
    const tableBodyFull = document.getElementById('fullProjectsTableBody');

    if (!tableBodyDashboard && !tableBodyFull) return;

    const data = projectsToRender || this.list;
    if (data.length === 0) {
      const emptyHtml = `<tr><td colspan="9" style="text-align: center; padding: 25px; color: var(--text-secondary);">لا توجد مشاريع مسجلة حالياً</td></tr>`;
      if (tableBodyDashboard) tableBodyDashboard.innerHTML = emptyHtml;
      if (tableBodyFull) tableBodyFull.innerHTML = emptyHtml;
      return;
    }

    const htmlContent = data.map(p => {
      const progress = p.progress_percentage || 0;
      const curr = p.currency || 'ر.ي';
      return `
        <tr>
          <td>
            <strong>${p.name}</strong>
            <div style="font-size: 0.72rem; color: var(--text-secondary);">${p.code || ''}</div>
          </td>
          <td>${p.client_name || 'عميل مباشر'}</td>
          <td style="color: var(--gold-light); font-weight: 700;">${App.formatNumber(p.contract_value)} <small style="font-size:0.75rem">${curr}</small></td>
          <td>${App.formatNumber(p.estimated_cost)} <small style="font-size:0.75rem">${curr}</small></td>
          <td style="color: ${p.actual_cost > p.estimated_cost ? 'var(--accent-red)' : 'var(--text-primary)'}; font-weight: 600;">
            ${App.formatNumber(p.actual_cost)} <small style="font-size:0.75rem">${curr}</small>
          </td>
          <td style="min-width: 120px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <div class="progress-wrap">
                <div class="progress-bar-fill" style="width: ${progress}%;"></div>
              </div>
              <span class="progress-text">${progress}%</span>
            </div>
          </td>
          <td style="color: var(--accent-blue); font-weight: 600;">${App.formatNumber(p.expected_profit)} <small style="font-size:0.75rem">${curr}</small></td>
          <td style="color: var(--accent-green); font-weight: 700;">${App.formatNumber(p.actual_profit)} <small style="font-size:0.75rem">${curr}</small></td>
          <td>
            <div style="display: flex; gap: 4px;">
              <button class="btn btn-secondary btn-sm" onclick="Projects.printProjectReport(${p.id})" title="طباعة تقرير المشروع" style="color: var(--gold-light); border-color: var(--gold-primary);">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/></svg>
              </button>
              <button class="btn btn-secondary btn-sm" onclick="Projects.viewDetails(${p.id})" title="عرض التفاصيل">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zm0 12.5c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
              </button>
              <button class="btn btn-danger btn-sm" onclick="Projects.deleteProject(${p.id})" title="حذف المشروع">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    if (tableBodyDashboard) tableBodyDashboard.innerHTML = htmlContent;
    if (tableBodyFull) tableBodyFull.innerHTML = htmlContent;
  },

  openNewModal() {
    // ملء قائمة العملاء في نموذج المشروع
    const select = document.getElementById('projClientSelect');
    if (select) {
      fetch('/api/clients').then(r => r.json()).then(res => {
        if (res.success) {
          select.innerHTML = `<option value="">اختر العميل...</option>` + 
            res.data.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        }
      });
    }
    App.openModal('newProjectModal');
  },

  async submitNewProject(e) {
    if (e) e.preventDefault();
    const nameInput = document.getElementById('projName');
    const name = nameInput ? nameInput.value.trim() : '';
    const client_id = document.getElementById('projClientSelect')?.value;
    const contract_value = document.getElementById('projContractVal')?.value;
    const currency = document.getElementById('projCurrency')?.value || 'ر.ي';
    const estimated_cost = document.getElementById('projEstimatedCost')?.value || 0;
    const actual_cost = document.getElementById('projActualCost')?.value || 0;
    const progress_percentage = document.getElementById('projProgress')?.value || 0;
    const expected_profit = document.getElementById('projExpectedProfit')?.value || (Number(contract_value || 0) - Number(estimated_cost || 0));
    const actual_profit = document.getElementById('projActualProfit')?.value || (Number(contract_value || 0) - Number(actual_cost || 0));
    const notes = document.getElementById('projNotes')?.value || '';

    if (!name || !contract_value) {
      App.showToast('يرجى كتابة اسم المشروع وقيمة العقد أولاً', 'error');
      if (nameInput) nameInput.focus();
      return;
    }

    const form = document.getElementById('newProjectForm');
    const submitBtn = form ? form.querySelector('button[type="submit"]') : null;
    const originalBtnHtml = submitBtn ? submitBtn.innerHTML : 'حفظ المشروع';

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span>⏳</span> جاري الحفظ والتحقق من قاعدة البيانات...';
    }

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          client_id,
          contract_value,
          currency,
          estimated_cost,
          actual_cost,
          progress_percentage,
          expected_profit,
          actual_profit,
          notes
        })
      });
      const data = await res.json();

      if (res.ok && data.success && data.id) {
        // إظهار رسالة النجاح المؤكدة من قاعدة البيانات
        const successMsg = data.message || `تم حفظ المشروع (${name}) بنجاح وتأكيده في قاعدة البيانات`;
        App.showToast(successMsg, 'success');
        App.closeModal('newProjectModal');
        if (form) form.reset();

        // تحديث جدول المشاريع ومؤشرات لوحة التحكم والقوائم المنسدلة
        await this.loadProjects();
        if (typeof Reports !== 'undefined' && Reports.loadDashboardKPIs) {
          Reports.loadDashboardKPIs();
        }
        if (typeof Accounting !== 'undefined' && Accounting.loadDropdowns) {
          Accounting.loadDropdowns();
        }
      } else {
        App.showToast(data.message || 'فشل في حفظ المشروع في قاعدة البيانات', 'error');
      }
    } catch (err) {
      console.error('Error saving project:', err);
      App.showToast('فشل الاتصال بالخادم أو حفظ المشروع في قاعدة البيانات', 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHtml;
      }
    }
  },

  async viewDetails(id) {
    try {
      const res = await fetch(`/api/projects/${id}`);
      const data = await res.json();
      if (data.success) {
        const p = data.data;
        this._currentProjectDetails = p;
        const body = document.getElementById('projectDetailsBody');
        if (body) {
          body.innerHTML = `
            <div style="background: rgba(255,255,255,0.03); padding: 16px; border-radius: var(--radius-md); margin-bottom: 16px; border: 1px solid var(--border-light);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <h4 style="color: var(--gold-light); margin: 0;">${p.name} (${p.code})</h4>
                <button class="btn btn-secondary btn-sm" onclick="Projects.printCurrentProjectDetails()" style="color: var(--gold-light); border-color: var(--gold-primary);">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/></svg>
                  <span>طباعة التقرير</span>
                </button>
              </div>
              <p style="color: var(--text-secondary); font-size: 0.85rem;">العميل: <strong>${p.client_name || 'غير محدد'}</strong> | هاتف: ${p.client_phone || 'غير مسجل'}</p>
              <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 12px;">
                <div><span style="font-size:0.75rem; color:var(--text-secondary)">قيمة العقد:</span> <strong style="color:var(--gold-light)">${App.formatNumber(p.contract_value)} ${p.currency || 'ر.ي'}</strong></div>
                <div><span style="font-size:0.75rem; color:var(--text-secondary)">التكلفة الفعلية:</span> <strong>${App.formatNumber(p.actual_cost)} ${p.currency || 'ر.ي'}</strong></div>
                <div><span style="font-size:0.75rem; color:var(--text-secondary)">نسبة الإنجاز:</span> <strong style="color:var(--accent-green)">${p.progress_percentage}%</strong></div>
              </div>
            </div>

            <h5 style="margin-bottom: 8px; color: #fff;">المصروفات المسجلة على المشروع (${p.expenses?.length || 0}):</h5>
            <div class="table-responsive" style="max-height: 160px; margin-bottom: 16px;">
              <table class="custom-table">
                <thead><tr><th>رقم السند</th><th>النوع</th><th>المبلغ</th><th>التاريخ</th><th>ملاحظات</th></tr></thead>
                <tbody>
                  ${(p.expenses && p.expenses.length > 0) ? p.expenses.map(e => `
                    <tr>
                      <td>${e.receipt_no}</td>
                      <td>${e.expense_type}</td>
                      <td style="color:var(--accent-red)">${App.formatNumber(e.amount)}</td>
                      <td>${e.date}</td>
                      <td>${e.notes || '-'}</td>
                    </tr>
                  `).join('') : '<tr><td colspan="5" style="text-align:center">لا توجد مصروفات مباشرة</td></tr>'}
                </tbody>
              </table>
            </div>

            <h5 style="margin-bottom: 8px; color: #fff;">المستخلصات المعتمدة (${p.bills?.length || 0}):</h5>
            <div class="table-responsive" style="max-height: 160px;">
              <table class="custom-table">
                <thead><tr><th>رقم المستخلص</th><th>المبلغ</th><th>الاستقطاع</th><th>الصافي</th><th>الحالة</th></tr></thead>
                <tbody>
                  ${(p.bills && p.bills.length > 0) ? p.bills.map(b => `
                    <tr>
                      <td>${b.bill_no}</td>
                      <td>${App.formatNumber(b.amount)}</td>
                      <td>${App.formatNumber(b.deduction)}</td>
                      <td style="color:var(--accent-green); font-weight:bold;">${App.formatNumber(b.net_amount)}</td>
                      <td><span class="badge badge-income">${b.status}</span></td>
                    </tr>
                  `).join('') : '<tr><td colspan="5" style="text-align:center">لا توجد مستخلصات</td></tr>'}
                </tbody>
              </table>
            </div>
          `;
          App.openModal('projectDetailsModal');
        }
      }
    } catch (e) {
      App.showToast('تعذر جلب تفاصيل المشروع', 'error');
    }
  },

  printCurrentProjectDetails() {
    if (this._currentProjectDetails) {
      this.generateAndPrintProjectReport(this._currentProjectDetails);
    } else {
      App.showToast('لا توجد بيانات مشروع محددة للطباعة', 'error');
    }
  },

  async printProjectReport(id) {
    try {
      App.showToast('جاري تحضير وتجهيز تقرير المشروع للطباعة...', 'info');
      const res = await fetch(`/api/projects/${id}`);
      const data = await res.json();
      if (data.success && data.data) {
        this.generateAndPrintProjectReport(data.data);
      } else {
        App.showToast('تعذر جلب بيانات المشروع للطباعة', 'error');
      }
    } catch (e) {
      console.error('Error fetching project report:', e);
      App.showToast('خطأ في الاتصال بالخادم لتحضير التقرير', 'error');
    }
  },

  generateAndPrintProjectReport(p) {
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
      sig1: 'مهندس المشروع',
      sig2: 'الإدارة المالية',
      sig3: 'المدير العام',
      border_style: 'classic',
      accent_color: '#d4af37',
      footer_notes: 'تعتبر هذه التقارير والبيانات معتمدة رسمياً من إدارة شركة رواسي عدن للهندسة والمقاولات'
    };

    const curr = p.currency || 'ر.ي';
    const todayDate = new Date().toISOString().split('T')[0];
    const totalExpenses = (p.expenses || []).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const totalBills = (p.bills || []).reduce((sum, b) => sum + (Number(b.net_amount) || Number(b.amount) || 0), 0);
    const totalPayments = (p.payments || []).reduce((sum, pay) => sum + (Number(pay.amount) || 0), 0);
    const totalActualCost = Number(p.actual_cost) || totalExpenses || 0;

    let borderCss = 'border: 3px double #0f2744;';
    if (cfg.border_style === 'modern') borderCss = `border: 2px solid ${cfg.accent_color};`;
    else if (cfg.border_style === 'minimal') borderCss = 'border: 1px solid #cbd5e1;';
    else if (cfg.border_style === 'none') borderCss = 'border: none;';

    const showLogo = (cfg.show_logo === '1' || cfg.show_logo === 1 || cfg.show_logo === true);
    const showStamp = (cfg.show_stamp === '1' || cfg.show_stamp === 1 || cfg.show_stamp === true);

    printArea.innerHTML = `
      <div style="direction: rtl; font-family: 'Cairo', 'Tajawal', sans-serif; padding: 25px; ${borderCss} border-radius: 8px; max-width: 900px; margin: auto; background: #ffffff; color: #111827;">
        
        <!-- الترويسة الرسمية الفاخرة -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid ${cfg.accent_color}; padding-bottom: 14px; margin-bottom: 20px;">
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
            <h3 style="color: ${cfg.accent_color}; margin: 0; font-size: 1.35rem; font-weight: 800;">تقرير بيانات وحساب المشروع</h3>
            <div style="margin: 4px 0; font-weight: bold; font-size: 0.95rem; color: #0f2744;">كود المشروع: ${p.code || 'PRJ'}</div>
            <div style="font-size: 0.8rem; color: #666;">تاريخ التقرير: ${todayDate}</div>
          </div>
        </div>

        <!-- بطاقة معلومات المشروع الأساسية -->
        <table style="width: 100%; font-size: 0.9rem; margin-bottom: 18px; border-collapse: collapse; border: 1px solid #ddd;">
          <tr style="background: #f8fafc;">
            <td style="padding: 8px 12px; font-weight: bold; width: 18%; border: 1px solid #ddd; background: #f1f5f9;">اسم المشروع:</td>
            <td style="padding: 8px 12px; font-weight: bold; color: #0f2744; width: 32%; border: 1px solid #ddd;">${p.name}</td>
            <td style="padding: 8px 12px; font-weight: bold; width: 18%; border: 1px solid #ddd; background: #f1f5f9;">العميل / المالك:</td>
            <td style="padding: 8px 12px; width: 32%; border: 1px solid #ddd;">${p.client_name || 'عميل مباشر'} ${p.client_phone ? '(' + p.client_phone + ')' : ''}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; font-weight: bold; border: 1px solid #ddd; background: #f1f5f9;">حالة المشروع:</td>
            <td style="padding: 8px 12px; border: 1px solid #ddd;">
              <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.85rem; font-weight: bold; ${p.status === 'completed' ? 'background:#d1fae5; color:#065f46;' : 'background:#dbeafe; color:#1e40af;'}">
                ${p.status === 'completed' ? 'مكتمل ومسلّم' : 'قيد التنفيذ والعمل'}
              </span>
            </td>
            <td style="padding: 8px 12px; font-weight: bold; border: 1px solid #ddd; background: #f1f5f9;">نسبة الإنجاز:</td>
            <td style="padding: 8px 12px; font-weight: bold; color: #059669; border: 1px solid #ddd;">${p.progress_percentage || 0}%</td>
          </tr>
          <tr style="background: #f8fafc;">
            <td style="padding: 8px 12px; font-weight: bold; border: 1px solid #ddd; background: #f1f5f9;">تاريخ البدء:</td>
            <td style="padding: 8px 12px; border: 1px solid #ddd;">${p.start_date || 'غير محدد'}</td>
            <td style="padding: 8px 12px; font-weight: bold; border: 1px solid #ddd; background: #f1f5f9;">تاريخ التسليم:</td>
            <td style="padding: 8px 12px; border: 1px solid #ddd;">${p.end_date || 'غير محدد'}</td>
          </tr>
          ${p.notes ? `
          <tr>
            <td style="padding: 8px 12px; font-weight: bold; border: 1px solid #ddd; background: #f1f5f9;">ملاحظات وشروط:</td>
            <td colspan="3" style="padding: 8px 12px; border: 1px solid #ddd; color: #444;">${p.notes}</td>
          </tr>
          ` : ''}
        </table>

        <!-- المؤشرات المالية والتعاقدية للمشروع -->
        <h4 style="color: #0f2744; margin: 16px 0 8px 0; font-size: 1rem; border-right: 4px solid ${cfg.accent_color}; padding-right: 8px;">1. الملخص المالي والتعاقدي</h4>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 18px;">
          <div style="border: 1px solid #ddd; border-radius: 6px; padding: 10px; text-align: center; background: #fdfaf2;">
            <div style="font-size: 0.75rem; color: #666; margin-bottom: 4px;">قيمة العقد الإجمالية</div>
            <div style="font-weight: 800; font-size: 1.05rem; color: #b8911c;">${App.formatNumber(p.contract_value)} <small style="font-size:0.7rem">${curr}</small></div>
          </div>
          <div style="border: 1px solid #ddd; border-radius: 6px; padding: 10px; text-align: center; background: #f8fafc;">
            <div style="font-size: 0.75rem; color: #666; margin-bottom: 4px;">التكلفة التقديرية (الموازنة)</div>
            <div style="font-weight: 800; font-size: 1.05rem; color: #334155;">${App.formatNumber(p.estimated_cost)} <small style="font-size:0.7rem">${curr}</small></div>
          </div>
          <div style="border: 1px solid #ddd; border-radius: 6px; padding: 10px; text-align: center; background: #fef2f2;">
            <div style="font-size: 0.75rem; color: #666; margin-bottom: 4px;">التكلفة الفعلية المنصرفة</div>
            <div style="font-weight: 800; font-size: 1.05rem; color: #dc2626;">${App.formatNumber(totalActualCost)} <small style="font-size:0.7rem">${curr}</small></div>
          </div>
          <div style="border: 1px solid #ddd; border-radius: 6px; padding: 10px; text-align: center; background: #f0fdf4;">
            <div style="font-size: 0.75rem; color: #666; margin-bottom: 4px;">الربح الفعلي المحقق</div>
            <div style="font-weight: 800; font-size: 1.05rem; color: #16a34a;">${App.formatNumber(p.actual_profit)} <small style="font-size:0.7rem">${curr}</small></div>
          </div>
        </div>

        <!-- جدول المصروفات المسجلة على المشروع -->
        <h4 style="color: #0f2744; margin: 16px 0 8px 0; font-size: 1rem; border-right: 4px solid ${cfg.accent_color}; padding-right: 8px;">2. تفاصيل المصروفات المباشرة للمشروع (${(p.expenses || []).length})</h4>
        <table style="width: 100%; font-size: 0.85rem; margin-bottom: 18px; border-collapse: collapse; border: 1px solid #ddd;">
          <thead>
            <tr style="background: #f1f5f9; text-align: right;">
              <th style="padding: 6px 10px; border: 1px solid #ddd;">رقم السند</th>
              <th style="padding: 6px 10px; border: 1px solid #ddd;">نوع المصروف</th>
              <th style="padding: 6px 10px; border: 1px solid #ddd;">التاريخ</th>
              <th style="padding: 6px 10px; border: 1px solid #ddd;">البيان / الملاحظات</th>
              <th style="padding: 6px 10px; border: 1px solid #ddd; text-align: left;">المبلغ (${curr})</th>
            </tr>
          </thead>
          <tbody>
            ${(p.expenses && p.expenses.length > 0) ? p.expenses.map(e => `
              <tr>
                <td style="padding: 6px 10px; border: 1px solid #ddd;"><strong>${e.receipt_no || '-'}</strong></td>
                <td style="padding: 6px 10px; border: 1px solid #ddd;">${e.expense_type || '-'}</td>
                <td style="padding: 6px 10px; border: 1px solid #ddd;">${e.date || '-'}</td>
                <td style="padding: 6px 10px; border: 1px solid #ddd;">${e.notes || '-'}</td>
                <td style="padding: 6px 10px; border: 1px solid #ddd; text-align: left; font-weight: bold; color: #dc2626;">${App.formatNumber(e.amount)} ${e.currency || curr}</td>
              </tr>
            `).join('') : `
              <tr><td colspan="5" style="text-align: center; padding: 12px; color: #888;">لا توجد مصروفات مباشرة مسجلة</td></tr>
            `}
            <tr style="background: #f8fafc; font-weight: bold;">
              <td colspan="4" style="padding: 6px 10px; border: 1px solid #ddd; text-align: right;">إجمالي المصروفات المباشرة:</td>
              <td style="padding: 6px 10px; border: 1px solid #ddd; text-align: left; color: #dc2626;">${App.formatNumber(totalExpenses)} ${curr}</td>
            </tr>
          </tbody>
        </table>

        <!-- جدول المستخلصات المعتمدة للمشروع -->
        <h4 style="color: #0f2744; margin: 16px 0 8px 0; font-size: 1rem; border-right: 4px solid ${cfg.accent_color}; padding-right: 8px;">3. المستخلصات المعتمدة (${(p.bills || []).length})</h4>
        <table style="width: 100%; font-size: 0.85rem; margin-bottom: 18px; border-collapse: collapse; border: 1px solid #ddd;">
          <thead>
            <tr style="background: #f1f5f9; text-align: right;">
              <th style="padding: 6px 10px; border: 1px solid #ddd;">رقم المستخلص</th>
              <th style="padding: 6px 10px; border: 1px solid #ddd;">التاريخ</th>
              <th style="padding: 6px 10px; border: 1px solid #ddd;">المبلغ الإجمالي</th>
              <th style="padding: 6px 10px; border: 1px solid #ddd;">الاستقطاع</th>
              <th style="padding: 6px 10px; border: 1px solid #ddd; text-align: left;">الصافي المعتمَد (${curr})</th>
            </tr>
          </thead>
          <tbody>
            ${(p.bills && p.bills.length > 0) ? p.bills.map(b => `
              <tr>
                <td style="padding: 6px 10px; border: 1px solid #ddd;"><strong>${b.bill_no || '-'}</strong></td>
                <td style="padding: 6px 10px; border: 1px solid #ddd;">${b.date || '-'}</td>
                <td style="padding: 6px 10px; border: 1px solid #ddd;">${App.formatNumber(b.amount)}</td>
                <td style="padding: 6px 10px; border: 1px solid #ddd; color: #dc2626;">${App.formatNumber(b.deduction || 0)}</td>
                <td style="padding: 6px 10px; border: 1px solid #ddd; text-align: left; font-weight: bold; color: #2563eb;">${App.formatNumber(b.net_amount || b.amount)} ${curr}</td>
              </tr>
            `).join('') : `
              <tr><td colspan="5" style="text-align: center; padding: 12px; color: #888;">لا توجد مستخلصات مسجلة</td></tr>
            `}
            <tr style="background: #f8fafc; font-weight: bold;">
              <td colspan="4" style="padding: 6px 10px; border: 1px solid #ddd; text-align: right;">إجمالي صافي المستخلصات:</td>
              <td style="padding: 6px 10px; border: 1px solid #ddd; text-align: left; color: #2563eb;">${App.formatNumber(totalBills)} ${curr}</td>
            </tr>
          </tbody>
        </table>

        <!-- جدول المقبوضات والدفعات المستلمة من العميل -->
        ${(p.payments && p.payments.length > 0) ? `
        <h4 style="color: #0f2744; margin: 16px 0 8px 0; font-size: 1rem; border-right: 4px solid ${cfg.accent_color}; padding-right: 8px;">4. الدفعات والمقبوضات المستلمة من العميل (${p.payments.length})</h4>
        <table style="width: 100%; font-size: 0.85rem; margin-bottom: 18px; border-collapse: collapse; border: 1px solid #ddd;">
          <thead>
            <tr style="background: #f1f5f9; text-align: right;">
              <th style="padding: 6px 10px; border: 1px solid #ddd;">رقم سند القبض</th>
              <th style="padding: 6px 10px; border: 1px solid #ddd;">التاريخ</th>
              <th style="padding: 6px 10px; border: 1px solid #ddd;">طريقة الدفع</th>
              <th style="padding: 6px 10px; border: 1px solid #ddd;">البيان</th>
              <th style="padding: 6px 10px; border: 1px solid #ddd; text-align: left;">المبلغ المستلم</th>
            </tr>
          </thead>
          <tbody>
            ${p.payments.map(pay => `
              <tr>
                <td style="padding: 6px 10px; border: 1px solid #ddd;"><strong>${pay.receipt_no}</strong></td>
                <td style="padding: 6px 10px; border: 1px solid #ddd;">${pay.date}</td>
                <td style="padding: 6px 10px; border: 1px solid #ddd;">${pay.payment_method}</td>
                <td style="padding: 6px 10px; border: 1px solid #ddd;">${pay.notes || 'دفعة أعمال'}</td>
                <td style="padding: 6px 10px; border: 1px solid #ddd; text-align: left; font-weight: bold; color: #059669;">${App.formatNumber(pay.amount)} ${pay.currency || curr}</td>
              </tr>
            `).join('')}
            <tr style="background: #f8fafc; font-weight: bold;">
              <td colspan="4" style="padding: 6px 10px; border: 1px solid #ddd; text-align: right;">إجمالي المقبوضات المستلمة:</td>
              <td style="padding: 6px 10px; border: 1px solid #ddd; text-align: left; color: #059669;">${App.formatNumber(totalPayments)} ${curr}</td>
            </tr>
          </tbody>
        </table>
        ` : ''}

        <!-- تواقيع الاعتماد الرسمية -->
        <div style="display: flex; justify-content: space-between; margin-top: 35px; padding: 0 30px; text-align: center; font-size: 0.9rem;">
          <div>
            <p style="font-weight: bold; margin-bottom: 35px; color: #0f2744;">${cfg.sig1}</p>
            <p style="color: #666;">............................</p>
          </div>
          <div>
            <p style="font-weight: bold; margin-bottom: 35px; color: #0f2744;">${cfg.sig2}</p>
            <p style="color: #666;">............................</p>
          </div>
          <div>
            <p style="font-weight: bold; margin-bottom: 35px; color: #0f2744;">${cfg.sig3}</p>
            <p style="color: #666;">............................</p>
          </div>
          <div>
            <p style="font-weight: bold; margin-bottom: 35px; color: #0f2744;">الختم الرسمي</p>
            ${showStamp ? '<div style="width: 75px; height: 75px; border: 2px dashed #bbb; border-radius: 50%; margin: auto;"></div>' : '<p style="color: #666; margin-top: 25px;">............................</p>'}
          </div>
        </div>

        ${cfg.footer_notes ? `<div style="margin-top: 30px; padding-top: 10px; border-top: 1px solid #eee; text-align: center; font-size: 0.75rem; color: #888;">${cfg.footer_notes}</div>` : ''}

      </div>
    `;

    App.printWithRawasiLetterhead(printArea);
  },

  async deleteProject(id) {
    if (!confirm('هل أنت متأكد من رغبتك في حذف هذا المشروع؟')) return;
    try {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        App.showToast('تم حذف المشروع بنجاح', 'info');
        await this.loadProjects();
        Reports.loadDashboardKPIs();
      }
    } catch (e) {
      App.showToast('خطأ أثناء الحذف', 'error');
    }
  }
};
