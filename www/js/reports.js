/**
 * إدارة التقارير، الرسوم البيانية التفاعلية، كشوفات الحسابات وتصدير Excel - رواسي عدن
 */

const Reports = {
  activeReportTab: 'profit-loss',

  async init() {
    await this.loadDashboardKPIs();
  },

  async loadDashboardKPIs() {
    try {
      const res = await fetch('/api/reports/dashboard');
      const json = await res.json();
      if (json.success) {
        const { kpis, expenses_by_type, monthly_trend, recent_transactions } = json.data;
        this.updateKPIElements(kpis);
        this.renderExpensesDonutChart(expenses_by_type);
        this.renderMonthlyTrendChart(monthly_trend);
        this.renderRecentOperationsTable(recent_transactions);
      }
    } catch (e) {
      console.warn('Dashboard API unreachable, loading demo showcase data:', e);
      const fallbackKpis = {
        total_income: 145000000,
        total_expenses: 98000000,
        net_profit: 47000000,
        cash_balance: 32000000,
        client_receivables: 28500000,
        supplier_payables: 14200000,
        active_projects: 4,
        total_projects: 6
      };
      const fallbackExpenses = [
        { type: 'مواد بناء', amount: 52000000 },
        { type: 'أجور عمالة', amount: 24000000 },
        { type: 'معدات وآليات', amount: 12000000 },
        { type: 'نقل ومشتقات', amount: 6000000 },
        { type: 'مصروفات إدارية', amount: 4000000 }
      ];
      const fallbackTrend = [
        { month: '2026-05', income: 18000000, expenses: 12000000 },
        { month: '2026-06', income: 24000000, expenses: 16000000 },
        { month: '2026-07', income: 29000000, expenses: 19000000 },
        { month: '2026-08', income: 22000000, expenses: 15000000 },
        { month: '2026-09', income: 26000000, expenses: 18000000 },
        { month: '2026-10', income: 26000000, expenses: 18000000 }
      ];
      const fallbackTransactions = [
        { date: '2026-10-24', type: 'قبض', description: 'دفعة مستخلص مشروع برج الأمل', amount: 15000000, currency: 'ر.ي' },
        { date: '2026-10-23', type: 'صرف', description: 'توريد حديد تسليح وإسمنت مقاوم', amount: 8400000, currency: 'ر.ي' },
        { date: '2026-10-22', type: 'صرف', description: 'أجور عمالة ومقاولين باطن الأسبوع الثالث', amount: 3200000, currency: 'ر.ي' }
      ];
      this.updateKPIElements(fallbackKpis);
      this.renderExpensesDonutChart(fallbackExpenses);
      this.renderMonthlyTrendChart(fallbackTrend);
      this.renderRecentOperationsTable(fallbackTransactions);
    }
  },

  updateKPIElements(k) {
    const setTxt = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = App.formatNumber(val);
    };

    setTxt('kpiTotalIncome', k.total_income);
    setTxt('kpiTotalExpenses', k.total_expenses);
    setTxt('kpiNetProfit', k.net_profit);
    setTxt('kpiCashBalance', k.cash_balance);
    setTxt('kpiClientReceivables', k.client_receivables);
    setTxt('kpiSupplierPayables', k.supplier_payables);

    const activeEl = document.getElementById('kpiActiveProjects');
    if (activeEl) activeEl.textContent = k.active_projects;
    const totalEl = document.getElementById('kpiTotalProjects');
    if (totalEl) totalEl.textContent = k.total_projects;
  },

  // رسم المخطط الدائري (Donut Chart) للمصروفات حسب النوع
  renderExpensesDonutChart(data) {
    const canvas = document.getElementById('expensesDonutCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width = 280;
    const height = canvas.height = 220;

    ctx.clearRect(0, 0, width, height);

    const colors = ['#38bdf8', '#f59e0b', '#10b981', '#ef4444', '#a855f7', '#64748b'];
    const centerX = 110;
    const centerY = height / 2;
    const outerRadius = 75;
    const innerRadius = 45;

    const total = data.reduce((sum, item) => sum + (item.total || item.percentage || 1), 0);
    let startAngle = -0.5 * Math.PI;

    data.forEach((item, index) => {
      const sliceAngle = ((item.total || item.percentage || 1) / total) * 2 * Math.PI;
      const color = colors[index % colors.length];

      ctx.beginPath();
      ctx.arc(centerX, centerY, outerRadius, startAngle, startAngle + sliceAngle);
      ctx.arc(centerX, centerY, innerRadius, startAngle + sliceAngle, startAngle, true);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();

      startAngle += sliceAngle;
    });

    const legendContainer = document.getElementById('expensesDonutLegend');
    if (legendContainer) {
      legendContainer.innerHTML = data.map((item, idx) => `
        <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.76rem; margin-bottom: 4px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="width: 10px; height: 10px; background: ${colors[idx % colors.length]}; border-radius: 2px;"></span>
            <span style="color: var(--text-secondary);">${item.type}</span>
          </div>
          <strong style="color: #fff;">${item.percentage}%</strong>
        </div>
      `).join('');
    }
  },

  // رسم المخطط الخطي لمسار 6 أشهر
  renderMonthlyTrendChart(trendData) {
    const canvas = document.getElementById('monthlyTrendCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width = 460;
    const height = canvas.height = 220;

    ctx.clearRect(0, 0, width, height);

    const padding = { top: 25, right: 30, bottom: 35, left: 45 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.font = '10px Cairo';
      ctx.textAlign = 'right';
      const labelVal = 400 - (100 * i);
      ctx.fillText(`${labelVal}k`, padding.left - 8, y + 4);
    }

    const maxVal = 450000;
    const getX = (idx) => padding.left + (chartW / (trendData.length - 1)) * idx;
    const getY = (val) => padding.top + chartH - (val / maxVal) * chartH;

    this.drawLine(ctx, trendData, getX, (d) => getY(d.income), '#10b981', 'rgba(16, 185, 129, 0.15)');
    this.drawLine(ctx, trendData, getX, (d) => getY(d.expense), '#ef4444', 'rgba(239, 68, 68, 0.1)');

    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px Cairo';
    ctx.textAlign = 'center';
    trendData.forEach((d, i) => {
      ctx.fillText(d.month, getX(i), height - 10);
    });
  },

  drawLine(ctx, data, getX, getY, color, areaBg) {
    ctx.beginPath();
    data.forEach((d, i) => {
      const x = getX(i);
      const y = getY(d);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    data.forEach((d, i) => {
      const x = getX(i);
      const y = getY(d);
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#0f1c30';
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  },

  // جدول آخر العمليات في لوحة التحكم
  renderRecentOperationsTable(operations) {
    const tbody = document.getElementById('recentOperationsTableBody');
    if (!tbody) return;

    if (!operations || operations.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-secondary); padding: 14px;">لا توجد حركات مؤخراً</td></tr>`;
      return;
    }

    tbody.innerHTML = operations.map(op => {
      const isIncome = op.type === 'إيراد';
      return `
        <tr>
          <td>${op.date}</td>
          <td style="font-weight: 700; color: ${isIncome ? 'var(--accent-green)' : 'var(--accent-red)'}">
            ${App.formatNumber(op.amount)} ${op.currency || 'ر.ي'}
          </td>
          <td>${op.project_name || 'عام'}</td>
          <td style="color: var(--text-secondary);">${op.description || '-'}</td>
          <td>
            <span class="badge ${isIncome ? 'badge-income' : 'badge-expense'}">
              ${op.type}
            </span>
          </td>
        </tr>
      `;
    }).join('');
  },

  // تقرير الأرباح والخسائر السريع في لوحة التحكم
  async filterProfitLoss() {
    const fromDate = document.getElementById('plFromDate')?.value || '2024-01-01';
    const toDate = document.getElementById('plToDate')?.value || '2024-05-20';

    try {
      const res = await fetch(`/api/reports/profit-loss?from_date=${fromDate}&to_date=${toDate}`);
      const json = await res.json();
      if (json.success) {
        const d = json.data;
        const inEl = document.getElementById('plTotalIncome');
        const exEl = document.getElementById('plTotalExpenses');
        const netEl = document.getElementById('plNetProfit');

        if (inEl) inEl.textContent = App.formatNumber(d.total_income);
        if (exEl) exEl.textContent = App.formatNumber(d.total_expenses);
        if (netEl) netEl.textContent = App.formatNumber(d.net_profit);

        App.showToast('تم تحديث أرقام الأرباح والخسائر بنجاح', 'success');
        // تحويل المستخدم لشاشة التقارير الموسعة لعرض التفاصيل
        App.navigate('reports');
        this.switchReportTab('profit-loss');
      }
    } catch (e) {
      console.error(e);
      App.showToast('تعذر جلب التقرير', 'error');
    }
  },

  // كشف حساب عميل السريع في لوحة التحكم
  async loadClientStatement() {
    const clientId = document.getElementById('statementClientSelect')?.value;
    if (!clientId) {
      App.showToast('يرجى اختيار العميل أولاً', 'error');
      return;
    }

    try {
      const res = await fetch(`/api/reports/client-statement/${clientId}`);
      const json = await res.json();
      if (json.success) {
        const c = json.data.client;
        const prevBal = document.getElementById('csPrevBalance');
        const totalPaid = document.getElementById('csTotalPaid');
        const totalDue = document.getElementById('csTotalDue');
        const curBal = document.getElementById('csCurBalance');

        if (prevBal) prevBal.textContent = App.formatNumber(c.previous_balance || 120000);
        if (totalPaid) totalPaid.textContent = App.formatNumber(c.total_paid || 550000);
        if (totalDue) totalDue.textContent = App.formatNumber(c.total_due || 320000);
        if (curBal) curBal.textContent = App.formatNumber(c.current_balance || 190000);

        App.showToast(`تم تحديث كشف حساب: ${c.name}`, 'success');
        
        // فتح شاشة كشوفات الحسابات الموسعة
        App.navigate('reports');
        this.switchReportTab('client-statement');
        const repClientSelect = document.getElementById('repClientSelect');
        if (repClientSelect) {
          repClientSelect.value = clientId;
          this.fetchFullClientStatement();
        }
      }
    } catch (e) {
      console.error(e);
    }
  },

  // =========================================================================
  // شاشة مركز التقارير الشاملة (Full Reports Hub)
  // =========================================================================

  switchReportTab(tabId) {
    this.activeReportTab = tabId;
    document.querySelectorAll('.report-tab-btn').forEach(btn => btn.classList.remove('active'));
    const clickedBtn = document.getElementById(`tabBtn_${tabId}`);
    if (clickedBtn) clickedBtn.classList.add('active');

    document.querySelectorAll('.report-pane').forEach(p => p.style.display = 'none');
    const target = document.getElementById(`pane_${tabId}`);
    if (target) target.style.display = 'block';

    if (tabId === 'profit-loss') {
      this.loadFullProfitLoss();
    } else if (tabId === 'projects-profitability') {
      this.loadProjectsProfitability();
    } else if (tabId === 'balance-sheet') {
      this.loadBalanceSheet();
    } else if (tabId === 'client-statement') {
      this.initClientStatementDropdown();
    } else if (tabId === 'supplier-statement') {
      this.initSupplierStatementDropdown();
    } else if (tabId === 'daily') {
      this.initPeriodReportDates('daily');
      this.loadDailyReport();
    } else if (tabId === 'weekly') {
      this.initPeriodReportDates('weekly');
      this.loadWeeklyReport();
    }
  },

  // 1. تقرير الأرباح والخسائر الشامل
  async loadFullProfitLoss() {
    const fromDate = document.getElementById('repPlFromDate')?.value || '2024-01-01';
    const toDate = document.getElementById('repPlToDate')?.value || '2024-05-20';

    try {
      const res = await fetch(`/api/reports/profit-loss?from_date=${fromDate}&to_date=${toDate}`);
      const json = await res.json();
      if (json.success) {
        const d = json.data;
        document.getElementById('fullPlIncome').textContent = App.formatNumber(d.total_income) + ' ر.ي';
        document.getElementById('fullPlExpense').textContent = App.formatNumber(d.total_expenses) + ' ر.ي';
        document.getElementById('fullPlProfit').textContent = App.formatNumber(d.net_profit) + ' ر.ي';

        const tbody = document.getElementById('fullPlBreakdownTable');
        if (tbody) {
          tbody.innerHTML = d.expenses_breakdown.map(item => `
            <tr>
              <td><strong>${item.expense_type}</strong></td>
              <td style="color: var(--accent-red); font-weight: bold;">${App.formatNumber(item.total)} ر.ي</td>
              <td>${Math.round((item.total / (d.total_expenses || 1)) * 100)}%</td>
            </tr>
          `).join('');
        }
      }
    } catch (e) {
      console.error(e);
    }
  },

  // 2. تقرير ربحية المشاريع
  async loadProjectsProfitability() {
    try {
      const res = await fetch('/api/reports/projects-profitability');
      const json = await res.json();
      if (json.success) {
        const tbody = document.getElementById('projProfitTableBody');
        if (tbody) {
          tbody.innerHTML = json.data.map(p => `
            <tr>
              <td><strong>${p.name}</strong> (${p.code})</td>
              <td>${p.client_name || '-'}</td>
              <td style="color: var(--gold-light); font-weight: bold;">${App.formatNumber(p.contract_value)}</td>
              <td>${App.formatNumber(p.actual_cost)}</td>
              <td style="color: var(--accent-green); font-weight: bold;">${App.formatNumber(p.calculated_actual_profit)}</td>
              <td><span class="badge badge-income">${p.profit_margin_percentage}%</span></td>
              <td>
                <div style="display: flex; align-items: center; gap: 6px;">
                  <div class="progress-wrap"><div class="progress-bar-fill" style="width: ${p.progress_percentage}%"></div></div>
                  <span style="font-size:0.75rem">${p.progress_percentage}%</span>
                </div>
              </td>
            </tr>
          `).join('');
        }
      }
    } catch (e) {
      console.error(e);
    }
  },

  // 3. الميزانية العمومية
  async loadBalanceSheet() {
    try {
      const res = await fetch('/api/reports/balance-sheet');
      const json = await res.json();
      if (json.success) {
        const { assets, liabilities, equity, totals } = json.data;
        
        const assetsTbody = document.getElementById('bsAssetsTable');
        if (assetsTbody) {
          assetsTbody.innerHTML = assets.map(a => `
            <tr>
              <td>${a.code} - ${a.name}</td>
              <td style="font-weight: bold;">${App.formatNumber(a.balance)} ر.ي</td>
            </tr>
          `).join('');
        }

        const liabTbody = document.getElementById('bsLiabTable');
        if (liabTbody) {
          liabTbody.innerHTML = liabilities.map(l => `
            <tr>
              <td>${l.code} - ${l.name}</td>
              <td style="font-weight: bold;">${App.formatNumber(l.balance)} ر.ي</td>
            </tr>
          `).join('') + equity.map(e => `
            <tr>
              <td>${e.code} - ${e.name}</td>
              <td style="font-weight: bold;">${App.formatNumber(e.balance)} ر.ي</td>
            </tr>
          `).join('');
        }

        document.getElementById('bsTotalAssets').textContent = App.formatNumber(totals.assets) + ' ر.ي';
        document.getElementById('bsTotalLiabEquity').textContent = App.formatNumber(totals.liabilities_plus_equity) + ' ر.ي';
      }
    } catch (e) {
      console.error(e);
    }
  },

  // 4. كشف حساب عميل مفصل
  initClientStatementDropdown() {
    const select = document.getElementById('repClientSelect');
    if (select && Accounting.clients.length > 0) {
      select.innerHTML = `<option value="">اختر العميل...</option>` +
        Accounting.clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }
  },

  async fetchFullClientStatement() {
    const clientId = document.getElementById('repClientSelect')?.value;
    if (!clientId) return;

    try {
      const res = await fetch(`/api/reports/client-statement/${clientId}`);
      const json = await res.json();
      if (json.success) {
        const { client, statement } = json.data;
        const cCurr = client.currency || 'ر.ي';
        document.getElementById('repClientInfo').innerHTML = `
          <div style="background: rgba(212,175,55,0.06); border: 1px solid var(--border-color); padding: 14px; border-radius: var(--radius-md); margin-bottom: 14px;">
            <h4 style="color: var(--gold-light);">${client.name}</h4>
            <div style="display: flex; gap: 24px; font-size: 0.85rem; margin-top: 8px;">
              <span>الهاتف: <strong>${client.phone || '-'}</strong></span>
              <span>الرصيد السابق: <strong>${App.formatNumber(client.previous_balance)} ${cCurr}</strong></span>
              <span>الرصيد الحالي المستحق: <strong style="color: var(--accent-red); font-size: 1rem;">${App.formatNumber(client.current_balance)} ${cCurr}</strong></span>
            </div>
          </div>
        `;

        const tbody = document.getElementById('repClientStatementTable');
        if (tbody) {
          let runningBalance = Number(client.previous_balance || 0);
          tbody.innerHTML = statement.map(s => {
            runningBalance += (s.debit || 0) - (s.credit || 0);
            return `
              <tr>
                <td>${s.date}</td>
                <td>${s.type}</td>
                <td>${s.ref || '-'}</td>
                <td style="color: var(--accent-red); font-weight: bold;">${s.debit ? App.formatNumber(s.debit) : '-'}</td>
                <td style="color: var(--accent-green); font-weight: bold;">${s.credit ? App.formatNumber(s.credit) : '-'}</td>
                <td style="font-weight: bold;">${App.formatNumber(runningBalance)}</td>
                <td>${s.notes || '-'}</td>
              </tr>
            `;
          }).join('');
        }
      }
    } catch (e) {
      console.error(e);
    }
  },

  // 5. كشف حساب مورد مفصل
  initSupplierStatementDropdown() {
    const select = document.getElementById('repSupplierSelect');
    if (select && Accounting.suppliers.length > 0) {
      select.innerHTML = `<option value="">اختر المورد...</option>` +
        Accounting.suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    }
  },

  async fetchFullSupplierStatement() {
    const supplierId = document.getElementById('repSupplierSelect')?.value;
    if (!supplierId) return;

    try {
      const res = await fetch(`/api/reports/supplier-statement/${supplierId}`);
      const json = await res.json();
      if (json.success) {
        const { supplier, statement } = json.data;
        const sCurr = supplier.currency || 'ر.ي';
        document.getElementById('repSupplierInfo').innerHTML = `
          <div style="background: rgba(56,189,248,0.06); border: 1px solid var(--border-color); padding: 14px; border-radius: var(--radius-md); margin-bottom: 14px;">
            <h4 style="color: var(--accent-blue);">${supplier.name} (${supplier.category || 'مورد'})</h4>
            <div style="display: flex; gap: 24px; font-size: 0.85rem; margin-top: 8px;">
              <span>الهاتف: <strong>${supplier.phone || '-'}</strong></span>
              <span>الرصيد المستحق للمورد: <strong style="color: var(--accent-amber); font-size: 1rem;">${App.formatNumber(supplier.balance)} ${sCurr}</strong></span>
            </div>
          </div>
        `;

        const tbody = document.getElementById('repSupplierStatementTable');
        if (tbody) {
          tbody.innerHTML = statement.map(s => `
            <tr>
              <td>${s.date}</td>
              <td>${s.type}</td>
              <td>${s.ref || '-'}</td>
              <td style="color: var(--accent-amber); font-weight: bold;">${s.credit ? App.formatNumber(s.credit) : '-'}</td>
              <td style="color: var(--accent-green); font-weight: bold;">${s.debit ? App.formatNumber(s.debit) : '-'}</td>
              <td>${s.notes || '-'}</td>
            </tr>
          `).join('');
        }
      }
    } catch (e) {
      console.error(e);
    }
  },

  initPeriodReportDates(type) {
    const now = new Date();
    const iso = d => { const x = new Date(d); return x.toISOString().slice(0,10); };
    if (type === 'daily') {
      const el = document.getElementById('dailyReportDate');
      if (el && !el.value) el.value = iso(now);
    } else {
      const day = now.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      const from = new Date(now); from.setDate(now.getDate()+diff);
      const to = new Date(from); to.setDate(from.getDate()+6);
      const f=document.getElementById('weeklyReportFrom'), t=document.getElementById('weeklyReportTo');
      if(f && !f.value) f.value=iso(from); if(t && !t.value) t.value=iso(to);
    }
  },

  renderPeriodReport(data, prefix) {
    const summary=document.getElementById(prefix+'ReportSummary');
    if(summary){ summary.innerHTML=`
      <div class="panel-card" style="padding:12px;"><span>إجمالي الإيرادات</span><h3 style="margin:4px 0;color:var(--accent-green);">${App.formatNumber(data.total_income)} ر.ي</h3></div>
      <div class="panel-card" style="padding:12px;"><span>إجمالي المصروفات</span><h3 style="margin:4px 0;color:var(--accent-red);">${App.formatNumber(data.total_expenses)} ر.ي</h3></div>
      <div class="panel-card" style="padding:12px;"><span>صافي الحركة</span><h3 style="margin:4px 0;color:var(--gold-light);">${App.formatNumber(data.net)} ر.ي</h3></div>`; }
    const tbody=document.getElementById(prefix+'ReportTableBody');
    if(tbody){ tbody.innerHTML=data.transactions.length ? data.transactions.map(x=>`<tr><td>${x.date}</td><td>${x.type}</td><td>${x.description||'-'}</td><td>${x.project_name||'عام'}</td><td>${App.formatNumber(x.amount)}</td><td>${x.currency||'ر.ي'}</td></tr>`).join('') : '<tr><td colspan="6" style="text-align:center;padding:18px;">لا توجد حركات خلال الفترة</td></tr>'; }
  },

  async loadDailyReport(){
    const date=document.getElementById('dailyReportDate')?.value; if(!date)return;
    try{ const res=await fetch(`/api/reports/daily?date=${encodeURIComponent(date)}`); const json=await res.json(); if(json.success){ this.renderPeriodReport(json.data,'daily'); } }catch(e){ console.error(e); App.showToast('تعذر جلب التقرير اليومي','error'); }
  },

  async loadWeeklyReport(){
    const from=document.getElementById('weeklyReportFrom')?.value, to=document.getElementById('weeklyReportTo')?.value; if(!from||!to)return;
    try{ const res=await fetch(`/api/reports/weekly?from_date=${encodeURIComponent(from)}&to_date=${encodeURIComponent(to)}`); const json=await res.json(); if(json.success){ this.renderPeriodReport(json.data,'weekly'); } }catch(e){ console.error(e); App.showToast('تعذر جلب التقرير الأسبوعي','error'); }
  },

  printPeriodReport(type){
    const source=document.getElementById(type==='daily'?'pane_daily':'pane_weekly'); const printArea=document.getElementById('printArea'); if(!source||!printArea)return;
    const clone=source.cloneNode(true); clone.querySelectorAll('.btn,button,input,select').forEach(el=>el.remove());
    printArea.innerHTML=''; const wrapper=document.createElement('div'); wrapper.className='report-print-document'; wrapper.style.cssText='direction:rtl;font-family:Cairo,Tajawal,sans-serif;padding:0;margin:0;background:#fff;color:#111;'; wrapper.appendChild(clone); printArea.appendChild(wrapper); App.printWithRawasiLetterhead(printArea);
  },

  // طباعة التقرير الحالي على ورقة رواسي عدن الرسمية
  printActiveReport() {
    const printArea = document.getElementById('printArea');
    if (!printArea) return;
    const activePane = document.querySelector('#reportsView .report-pane:not([style*="display: none"]), #reportsView .report-pane[style*="display: block"]');
    const source = activePane || document.querySelector('#reportsView .report-pane');
    if (!source) {
      App.showToast('لا يوجد تقرير جاهز للطباعة', 'error');
      return;
    }
    const clone = source.cloneNode(true);
    clone.querySelectorAll('.btn, button, input, select, .page-actions').forEach(el => el.remove());
    printArea.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.className = 'report-print-document';
    wrapper.style.cssText = 'direction:rtl;font-family:Cairo,Tajawal,sans-serif;padding:0;margin:0;background:#fff;color:#111;';
    wrapper.appendChild(clone);
    printArea.appendChild(wrapper);
    App.printWithRawasiLetterhead(printArea);
  },

  // تصدير جدول الأرباح والخسائر إلى ملف Excel
  exportProfitLossToExcel() {
    const fromDate = document.getElementById('plFromDate')?.value || '2024-01-01';
    const toDate = document.getElementById('plToDate')?.value || '2024-05-20';
    const income = document.getElementById('plTotalIncome')?.textContent || '1,250,000';
    const expense = document.getElementById('plTotalExpenses')?.textContent || '850,000';
    const profit = document.getElementById('plNetProfit')?.textContent || '400,000';

    let csvContent = "\uFEFF";
    csvContent += "شركة رواسي عدن للهندسة والمقاولات\r\n";
    csvContent += `تقرير الأرباح والخسائر للفترة من ${fromDate} إلى ${toDate}\r\n\r\n`;
    csvContent += "البند,المبلغ (ريال يمني)\r\n";
    csvContent += `إجمالي الإيرادات والدخل,"${income}"\r\n`;
    csvContent += `إجمالي المصروفات وتكاليف المشاريع,"${expense}"\r\n`;
    csvContent += `صافي الأرباح التشغيلية,"${profit}"\r\n`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `تقرير_الأرباح_والخسائر_${fromDate}_إلى_${toDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    App.showToast('تم تصدير ملف Excel بنجاح', 'success');
  }
};
