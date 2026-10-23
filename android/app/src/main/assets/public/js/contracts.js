/* ==========================================================================
   نظام عقود المشاريع الهندسية (Project Contracts Management)
   شركة رواسي عدن للهندسة والمقاولات
   ========================================================================== */

const Contracts = {
  projects: [],
  clients: [],
  list: [],
  editingId: null,
  activeFilterProject: '',

  // الدفعات المرحلية النموذجية
  milestones: [],

  async init() {
    await Promise.all([this.loadLookups(), this.loadList()]);
    if (!this.editingId) {
      this.resetForm();
    }
  },

  async loadLookups() {
    try {
      const [cRes, pRes] = await Promise.all([
        fetch('/api/clients'),
        fetch('/api/projects')
      ]);
      const cJson = await cRes.json();
      const pJson = await pRes.json();

      this.clients = cJson.success ? (cJson.data || []) : [];
      this.projects = pJson.success ? (pJson.data || []) : [];

      this.fillSelects();
    } catch (e) {
      console.error('Error loading lookups for contracts:', e);
    }
  },

  fillSelects() {
    const projSelect = document.getElementById('contractProject');
    const clientSelect = document.getElementById('contractClient');
    const filterSelect = document.getElementById('contractFilterProject');

    if (projSelect) {
      projSelect.innerHTML = '<option value="">اختر المشروع المرتبط</option>' +
        this.projects.map(p => `<option value="${p.id}">${this.esc(p.name)} (${p.code || 'بدون كود'})</option>`).join('');
    }

    if (clientSelect) {
      clientSelect.innerHTML = '<option value="">اختر العميل / المالك</option>' +
        this.clients.map(c => `<option value="${c.id}">${this.esc(c.name)}</option>`).join('');
    }

    if (filterSelect) {
      filterSelect.innerHTML = '<option value="">جميع المشاريع</option>' +
        this.projects.map(p => `<option value="${p.id}">${this.esc(p.name)}</option>`).join('');
    }
  },

  onProjectChange() {
    const pId = document.getElementById('contractProject')?.value;
    if (!pId) return;

    const proj = this.projects.find(p => String(p.id) === String(pId));
    if (proj) {
      if (proj.client_id) {
        const clientSelect = document.getElementById('contractClient');
        if (clientSelect) {
          clientSelect.value = proj.client_id;
          this.onClientChange();
        }
      }
      if (proj.currency) {
        this.setCurrency(proj.currency);
      }
      if (proj.contract_value) {
        const amountInput = document.getElementById('contractTotalAmount');
        if (amountInput && (!amountInput.value || Number(amountInput.value) === 0)) {
          amountInput.value = proj.contract_value;
          this.onAmountChange();
        }
      }
      const titleInput = document.getElementById('contractTitle');
      if (titleInput && (!titleInput.value || titleInput.value.trim() === '')) {
        titleInput.value = `عقد تنفيذ مشروع: ${proj.name}`;
      }
      this.checkProjectBoq(pId);
    } else {
      this.checkProjectBoq(null);
    }
  },

  // فحص ما إذا كان للمشروع جدول كميات معتمد لإظهار إشعار ذكي وإمكانية إدراجه فورياً
  async checkProjectBoq(pId) {
    const hintEl = document.getElementById('contractBoqHint');
    if (!hintEl) return;
    if (!pId) {
      hintEl.style.display = 'none';
      return;
    }
    try {
      const res = await fetch(`/api/boq?project_id=${pId}`);
      const json = await res.json();
      if (json.success && json.data && json.data.length > 0) {
        const boq = json.data[0];
        hintEl.style.display = 'flex';
        hintEl.innerHTML = `
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:16px;">📋</span>
            <span>يتوفر جدول كميات معتمد لهذا المشروع: <b>${this.esc(boq.boq_no)}</b> (${boq.items_count || 0} بنداً هندسياً — بقيمة <b>${this.money(boq.total_estimated || 0)} ${this.esc(boq.currency || 'ر.ي')}</b>)</span>
          </div>
          <button type="button" class="btn btn-primary btn-sm" style="padding:3px 10px; font-size:11.5px;" onclick="Contracts.insertBoqClause()">+ إدراج بند جدول الكميات بالعقد</button>
        `;
      } else {
        hintEl.style.display = 'none';
      }
    } catch (e) {
      hintEl.style.display = 'none';
    }
  },

  onClientChange() {
    const cId = document.getElementById('contractClient')?.value;
    if (!cId) return;

    const client = this.clients.find(c => String(c.id) === String(cId));
    if (client) {
      const secondPartyInput = document.getElementById('contractSecondParty');
      const phoneInput = document.getElementById('contractSecondPartyPhone');
      const addressInput = document.getElementById('contractSecondPartyAddress');

      if (secondPartyInput && !secondPartyInput.value) secondPartyInput.value = client.name || '';
      if (phoneInput && !phoneInput.value) phoneInput.value = client.phone || '';
      if (addressInput && !addressInput.value) addressInput.value = client.address || '';
    }
  },

  getCurrency() {
    const sel = document.getElementById('contractCurrency');
    if (!sel) return 'ر.ي';
    if (sel.value === 'custom') {
      const custom = document.getElementById('contractCustomCurrency');
      return (custom && custom.value.trim()) ? custom.value.trim() : 'عملة مخصصة';
    }
    return sel.value || 'ر.ي';
  },

  setCurrency(curr) {
    const sel = document.getElementById('contractCurrency');
    const custom = document.getElementById('contractCustomCurrency');
    if (!sel) return;

    const std = ['ر.ي', 'ر.س', '$', 'EUR'];
    const target = curr ? String(curr).trim() : 'ر.ي';

    if (std.includes(target)) {
      sel.value = target;
      if (custom) custom.style.display = 'none';
    } else {
      sel.value = 'custom';
      if (custom) {
        custom.style.display = 'inline-block';
        custom.value = target;
      }
    }
    this.onCurrencyChange();
  },

  onCurrencyChange() {
    const sel = document.getElementById('contractCurrency');
    const custom = document.getElementById('contractCustomCurrency');
    if (sel && custom) {
      custom.style.display = (sel.value === 'custom') ? 'inline-block' : 'none';
      if (sel.value === 'custom') custom.focus();
    }

    const curr = this.getCurrency();
    document.querySelectorAll('.contract-curr-badge').forEach(b => b.textContent = curr);
    this.onAmountChange();
  },

  parseNumber(val) {
    if (val === null || val === undefined) return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    let s = String(val).trim();
    if (!s) return 0;
    const eastern = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9' };
    s = s.replace(/[٠-٩]/g, d => eastern[d]).replace(/,/g, '').replace(/،/g, '.').replace(/\s+/g, '');
    const num = parseFloat(s);
    return isNaN(num) ? 0 : num;
  },

  onAmountChange() {
    const amountInput = document.getElementById('contractTotalAmount');
    const tafqeetEl = document.getElementById('contractTafqeetText');
    const amount = this.parseNumber(amountInput ? amountInput.value : 0);
    const curr = this.getCurrency();

    if (tafqeetEl) {
      tafqeetEl.textContent = this.getTafqeet(amount, curr);
    }
    this.recalculateMilestonePercentages();
  },

  // احتساب المدة بالأيام بين تاريخ البدء والانتهاء تلقائياً
  calculateDuration() {
    const start = document.getElementById('contractStartDate')?.value;
    const end = document.getElementById('contractCompletionDate')?.value;
    const durationInput = document.getElementById('contractDuration');

    if (start && end && durationInput) {
      const d1 = new Date(start);
      const d2 = new Date(end);
      const diffTime = d2.getTime() - d1.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays >= 0) {
        durationInput.value = diffDays;
      }
    }
  },

  // إدارة جدول الدفعات المرحلية
  addMilestone(data = { name: '', percent: '', amount: '', condition: '' }) {
    this.milestones.push({
      name: data.name || `الدفعة رقم ${this.milestones.length + 1}`,
      percent: data.percent !== undefined ? data.percent : '',
      amount: data.amount !== undefined ? data.amount : '',
      condition: data.condition || ''
    });
    this.renderMilestones();
  },

  removeMilestone(idx) {
    this.milestones.splice(idx, 1);
    this.renderMilestones();
  },

  applyMilestonePreset(type) {
    const totalAmount = this.parseNumber(document.getElementById('contractTotalAmount')?.value || 0);

    if (type === '4_phases') {
      this.milestones = [
        { name: 'الدفعة الأولى (دفعة مقدمة)', percent: 20, amount: totalAmount ? Math.round(totalAmount * 0.20) : '', condition: 'عند توقيع العقد وقبل بدء الأعمال الميدانية' },
        { name: 'الدفعة الثانية (مرحلة الأساسات)', percent: 30, amount: totalAmount ? Math.round(totalAmount * 0.30) : '', condition: 'عند الانتهاء من أعمال الحفر وصب القواعد والرقاب والميدات' },
        { name: 'الدفعة الثالثة (مرحلة الهيكل الخرساني)', percent: 30, amount: totalAmount ? Math.round(totalAmount * 0.30) : '', condition: 'عند اكتمال صب الأعمدة والأسقف والمباني' },
        { name: 'الدفعة الرابعة (الدفعة الختامية)', percent: 20, amount: totalAmount ? Math.round(totalAmount * 0.20) : '', condition: 'عند الاستلام الابتدائي وتسليم المشروع للمالك' }
      ];
    } else if (type === '5_phases') {
      this.milestones = [
        { name: 'الدفعة الأولى (مقدمة)', percent: 15, amount: totalAmount ? Math.round(totalAmount * 0.15) : '', condition: 'دفعة مقدمة عند توقيع العقد وبدء التجهيزات' },
        { name: 'الدفعة الثانية (أساسات وميدات)', percent: 25, amount: totalAmount ? Math.round(totalAmount * 0.25) : '', condition: 'عند إتمام صب خرسانات الأساسات والميدات الأرضية' },
        { name: 'الدفعة الثالثة (الأعمدة والأسقف)', percent: 25, amount: totalAmount ? Math.round(totalAmount * 0.25) : '', condition: 'عند صب الهيكل الخرساني للأسقف والكمرات' },
        { name: 'الدفعة الرابعة (التشطيبات)', percent: 25, amount: totalAmount ? Math.round(totalAmount * 0.25) : '', condition: 'عند اكتمال أعمال البلوك واللياسة والتشطيبات الأساسية' },
        { name: 'الدفعة الخامسة (الاستلام والتسليم)', percent: 10, amount: totalAmount ? Math.round(totalAmount * 0.10) : '', condition: 'بعد الاستلام النهائي وتصفية حسابات المشروع' }
      ];
    }

    this.renderMilestones();
    App.showToast('تم تطبيق نموذج جدول الدفعات بنجاح 📋', 'success');
  },

  updateMilestone(idx, key, val) {
    if (!this.milestones[idx]) return;
    this.milestones[idx][key] = val;

    const totalAmount = this.parseNumber(document.getElementById('contractTotalAmount')?.value || 0);

    if (key === 'percent' && totalAmount > 0) {
      const p = this.parseNumber(val);
      this.milestones[idx].amount = Math.round((totalAmount * p) / 100);
      const amtInput = document.getElementById(`milestoneAmt_${idx}`);
      if (amtInput) amtInput.value = this.milestones[idx].amount;
    } else if (key === 'amount' && totalAmount > 0) {
      const a = this.parseNumber(val);
      this.milestones[idx].percent = Math.round((a / totalAmount) * 100);
      const pctInput = document.getElementById(`milestonePct_${idx}`);
      if (pctInput) pctInput.value = this.milestones[idx].percent;
    }
  },

  recalculateMilestonePercentages() {
    const totalAmount = this.parseNumber(document.getElementById('contractTotalAmount')?.value || 0);
    if (totalAmount <= 0) return;

    this.milestones.forEach((m, idx) => {
      if (m.percent) {
        m.amount = Math.round((totalAmount * this.parseNumber(m.percent)) / 100);
        const amtInput = document.getElementById(`milestoneAmt_${idx}`);
        if (amtInput) amtInput.value = m.amount;
      }
    });
  },

  renderMilestones() {
    const tbody = document.getElementById('contractMilestonesBody');
    if (!tbody) return;

    const curr = this.getCurrency();

    if (!this.milestones.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-state" style="padding:12px;">لم يتم تحديد دفعات مرحلية بعد. يمكنك إضافة دفعة أو اختيار نموذج سريع أعلاه.</td></tr>';
      return;
    }

    tbody.innerHTML = this.milestones.map((m, i) => `
      <tr>
        <td class="text-center" style="font-weight:bold; color:var(--text-secondary); width:35px;">${i + 1}</td>
        <td style="min-width:180px;">
          <input class="form-control form-control-sm" value="${this.esc(m.name)}" oninput="Contracts.updateMilestone(${i}, 'name', this.value)" placeholder="مسمى الدفعة">
        </td>
        <td style="width:90px;">
          <div style="display:flex; align-items:center; gap:2px;">
            <input type="text" inputmode="decimal" class="form-control form-control-sm text-center" id="milestonePct_${i}" value="${m.percent !== undefined ? m.percent : ''}" oninput="Contracts.updateMilestone(${i}, 'percent', this.value)" placeholder="0">
            <span style="font-weight:bold; font-size:12px;">%</span>
          </div>
        </td>
        <td style="width:130px;">
          <input type="text" inputmode="decimal" class="form-control form-control-sm text-center" id="milestoneAmt_${i}" value="${m.amount !== undefined ? m.amount : ''}" oninput="Contracts.updateMilestone(${i}, 'amount', this.value)" placeholder="0.00">
        </td>
        <td>
          <input class="form-control form-control-sm" value="${this.esc(m.condition || '')}" oninput="Contracts.updateMilestone(${i}, 'condition', this.value)" placeholder="شرط الاستحقاق ومرحلة الإنجاز">
        </td>
        <td class="text-center" style="width:40px;">
          <button type="button" class="btn btn-danger btn-sm" style="padding:2px 6px;" onclick="Contracts.removeMilestone(${i})" title="حذف الدفعة">✕</button>
        </td>
      </tr>
    `).join('');
  },

  // توليد بنود العقد والشروط الهندسية والقانونية النموذجية بنقرة واحدة (شاملة بند جداول الكميات)
  generateStandardClauses() {
    const clausesText = `البند الأول (موضوع العقد):
يقوم الطرف الأول (المقاول) بتنفيذ وإتمام وصيانة كافة الأعمال الهندسية والإنشائية المحددة في هذا العقد ومخططاته وجدول الكميات والمواصفات الفنية التابعة له وفق الأصول الهندسية المعتمدة وتعليمات المهندس المشرف.

البند الثاني (وثائق ومستندات العقد):
تعتبر الوثائق التالية جزءاً لا يتجزأ من هذا العقد وتفسر مجتمعة:
1. وثيقة العقد الأساسية هذه.
2. جدول الكميات والمواصفات الفنية المعتمد (BOQ).
3. المخططات الهندسية والإنشائية والتنفيذية المعتمدة للمشروع.
4. الشروط والتعليمات والمذكرات الخطية الصادرة من المهندس المشرف.

البند الثالث (جداول الكميات والمواصفات الفنية - BOQ):
1. تعتبر جداول الكميات وفئات الأسعار المرفقة بهذا العقد جزءاً لا يتجزأ منه وملحقاً أساسياً لتفسيره وتنفيذه، وأساساً لاحتساب مستحقات الطرف الأول عن الأعمال المنجزة فعلياً.
2. الكميات الواردة في جدول الكميات هي كميات تقديرية تقريبية، وتتم المحاسبة والفوترة النهائية بموجب الحصر والذرعة الهندسية الفعلية للأعمال المنفذة على الطبيعة طبقاً للأسعار الإفرادية المحددة في جدول الكميات المعتمد.
3. يلتزم الطرف الأول بالتنفيذ طبقاً للمواصفات الفنية المحددة بجدول الكميات والمخططات الهندسية المعتمدة وتعليمات المهندس المشرف، ولا يجوز استبدال أو تعديل أي مادة أو صنف إلا بموافقة كتابية مسبقة من المهندس المشرف.
4. أي أعمال أو بنود إضافية مستجدة غير مدرجة في جدول الكميات المعتمد تخضع لإجراءات الأوامر التغييرية المعتمدة كتابياً بين الطرفين قبل الشروع في تنفيذها.

البند الرابع (التزامات الطرف الأول - المقاول):
1. توفير العمالة الفنية الماهرة والمعدات والآليات اللازمة لتنفيذ الأعمال في أوقاتها المحددة.
2. استخدام مواد بناء نخب أول مطابقة للمواصفات القياسية وفحصها هندسياً قبل التركيب.
3. الالتزام بتعليمات الأمن والسلامة المهنية في موقع المشروع.
4. تصحيح أو إعادة تنفيذ أي أعمال تظهر فيها عيوب ناتجة عن سوء التنفيذ أو مخالفة للمواصفات على نفقته الخاصة.

البند الخامس (التزامات الطرف الثاني - المالك / صاحب العمل):
1. تسليم موقع العمل للطرف الأول خالياً من العوائق القانونية والمادية في الموعد المتفق عليه.
2. سداد الدفعات والمستخلصات المالية للطرف الأول في مواعيدها المحددة وفق جدول الدفعات المعتمد دون تأخير.
3. اعتماد المخططات والعينات والمواد في مدة لا تتجاوز 48 ساعة من تقديمها من المقاول.

البند السادس (الأوامر التغييرية والأعمال الإضافية):
لا يجوز للطرف الأول تنفيذ أي أعمال إضافية أو تعديلات على المخططات الأصلية إلا بموجب أمر كتابي صريح ومعتمد من الطرف الثاني أو المهندس المشرف يحدد فيه وصف العمل وقيمته ومدة إنجازه الإضافية.

البند السابع (غرامة التأخير):
إذا تأخر الطرف الأول عن إتمام الأعمال في المدة المحددة لأسباب تعود إليه ودون مبرر قانوني أو قوة قاهرة، تطبق بحقه غرامة تأخير قدرها 0.1% عن كل يوم تأخير، على ألا يتجاوز إجمالي الغرامة 10% من قيمة العقد الإجمالية.

البند الثامن (الضمان والاستلام الابتدائي والنهائي):
1. يتم الاستلام الابتدائي للمشروع بحضور ممثلي الطرفين والمهندس المشرف بموجب محضر استلام رسمي يسجل فيه أي ملاحظات أو نواقص طفيفة لإنجازها.
2. يضمن الطرف الأول جودة وسلامة الأعمال الإنشائية المنفذة لمدة عام كامل من تاريخ الاستلام الابتدائي (فترة الصيانة والضمان).

البند التاسع (القوة القاهرة وتسوية النزاعات):
في حال نشوء أي خلاف حول تفسير أو تنفيذ بنود هذا العقد، يتم السعي لحله ودياً بروح التعاون الهندسي، وفي حال تعذر ذلك يتم اللجوء للتحكيم الهندسي أو المحاكم المختصة في محافظة عدن.`;

    const clausesEl = document.getElementById('contractConditions');
    if (clausesEl) {
      clausesEl.value = clausesText;
      App.showToast('تم توليد بنود العقد الهندسية والقانونية النموذجية (شاملة بند جداول الكميات) بنجاح 📜', 'success');
    }
  },

  // إدراج بند جداول الكميات والمواصفات الفنية المعتمد (BOQ) بشكل منفصل أو مخصص
  async insertBoqClause() {
    const clausesEl = document.getElementById('contractConditions');
    if (!clausesEl) return;

    let boqDetailText = '';
    const pId = document.getElementById('contractProject')?.value;

    if (pId) {
      try {
        const res = await fetch(`/api/boq?project_id=${pId}`);
        const json = await res.json();
        if (json.success && json.data && json.data.length > 0) {
          const boq = json.data[0];
          boqDetailText = ` المعتمد للمشروع (رقم: ${boq.boq_no} — عدد ${boq.items_count || 0} بنداً هندسياً بقيمة ${this.money(boq.total_estimated || 0)} ${boq.currency || 'ر.ي'})`;
        }
      } catch (e) {
        console.warn('Error fetching project BOQ for contract clause:', e);
      }
    }

    const boqClause = `بند جداول الكميات والمواصفات الفنية (BOQ)${boqDetailText}:
1. تعتبر جداول الكميات وفئات الأسعار المرفقة بهذا العقد جزءاً لا يتجزأ منه وملحقاً أساسياً لتفسيره وتنفيذه، وأساساً لاحتساب مستحقات الطرف الأول عن الأعمال المنجزة فعلياً.
2. الكميات الواردة في جدول الكميات هي كميات تقديرية تقريبية، وتتم المحاسبة والفوترة النهائية بموجب الحصر والذرعة الهندسية الفعلية للأعمال المنفذة على الطبيعة طبقاً للأسعار الإفرادية المحددة في جدول الكميات المعتمد.
3. يلتزم الطرف الأول بالتنفيذ طبقاً للمواصفات الفنية المحددة بجدول الكميات والمخططات الهندسية المعتمدة وتعليمات المهندس المشرف، ولا يجوز استبدال أو تعديل أي مادة أو صنف إلا بموافقة كتابية مسبقة من المهندس المشرف.
4. أي أعمال أو بنود إضافية مستجدة غير مدرجة في جدول الكميات المعتمد تخضع لإجراءات الأوامر التغييرية المعتمدة كتابياً بين الطرفين قبل الشروع في تنفيذها.`;

    const currentVal = clausesEl.value.trim();
    if (!currentVal) {
      clausesEl.value = boqClause;
    } else if (currentVal.includes('جداول الكميات والمواصفات الفنية') || currentVal.includes('جدول الكميات')) {
      if (confirm('بند جداول الكميات موجود مسبقاً في نصوص العقد. هل ترغب بإضافته وتحديثه في نهاية النص؟')) {
        clausesEl.value = currentVal + '\n\n' + boqClause;
      } else {
        return;
      }
    } else {
      clausesEl.value = currentVal + '\n\n' + boqClause;
    }

    App.showToast('تم إدراج بند جداول الكميات والمواصفات الفنية في وثيقة العقد بنجاح 📋✨', 'success');
    clausesEl.focus();
  },

  resetForm() {
    this.editingId = null;
    const titleEl = document.getElementById('contractTitle');
    const projEl = document.getElementById('contractProject');
    const clientEl = document.getElementById('contractClient');
    const dateEl = document.getElementById('contractDate');
    const startEl = document.getElementById('contractStartDate');
    const compEl = document.getElementById('contractCompletionDate');
    const durEl = document.getElementById('contractDuration');
    const firstPartyEl = document.getElementById('contractFirstParty');
    const firstRepEl = document.getElementById('contractFirstPartyRep');
    const secPartyEl = document.getElementById('contractSecondParty');
    const secRepEl = document.getElementById('contractSecondPartyRep');
    const secPhoneEl = document.getElementById('contractSecondPartyPhone');
    const secAddrEl = document.getElementById('contractSecondPartyAddress');
    const locEl = document.getElementById('contractLocation');
    const amountEl = document.getElementById('contractTotalAmount');
    const advanceEl = document.getElementById('contractAdvancePayment');
    const retentionEl = document.getElementById('contractRetentionPercent');
    const statusEl = document.getElementById('contractStatus');
    const notesEl = document.getElementById('contractNotes');
    const badge = document.getElementById('contractEditingBadge');

    const today = new Date().toISOString().split('T')[0];

    if (titleEl) titleEl.value = 'عقد مقاولة تنفيذ أعمال إنشائية وهندسية';
    if (projEl) projEl.value = '';
    if (clientEl) clientEl.value = '';
    if (dateEl) dateEl.value = today;
    if (startEl) startEl.value = today;
    if (compEl) compEl.value = '';
    if (durEl) durEl.value = 90;
    if (firstPartyEl) firstPartyEl.value = 'شركة رواسي عدن للهندسة والمقاولات';
    if (firstRepEl) firstRepEl.value = 'المدير العام';
    if (secPartyEl) secPartyEl.value = '';
    if (secRepEl) secRepEl.value = '';
    if (secPhoneEl) secPhoneEl.value = '';
    if (secAddrEl) secAddrEl.value = '';
    if (locEl) locEl.value = 'مدينة عدن';
    if (amountEl) amountEl.value = '';
    if (advanceEl) advanceEl.value = '';
    if (retentionEl) retentionEl.value = 5;
    if (statusEl) statusEl.value = 'ساري';
    if (notesEl) notesEl.value = '';
    if (badge) badge.style.display = 'none';
    const hintEl = document.getElementById('contractBoqHint');
    if (hintEl) hintEl.style.display = 'none';

    this.setCurrency('ر.ي');
    this.milestones = [];
    this.applyMilestonePreset('4_phases');
    this.generateStandardClauses();
    this.onAmountChange();
  },

  async save() {
    try {
      const title = document.getElementById('contractTitle')?.value?.trim();
      const project_id = document.getElementById('contractProject')?.value || null;
      const client_id = document.getElementById('contractClient')?.value || null;
      const contract_date = document.getElementById('contractDate')?.value || new Date().toISOString().split('T')[0];
      const start_date = document.getElementById('contractStartDate')?.value || null;
      const completion_date = document.getElementById('contractCompletionDate')?.value || null;
      const duration_days = this.parseNumber(document.getElementById('contractDuration')?.value || 0);

      const first_party = document.getElementById('contractFirstParty')?.value?.trim() || 'شركة رواسي عدن للهندسة والمقاولات';
      const first_party_rep = document.getElementById('contractFirstPartyRep')?.value?.trim() || 'المدير العام';
      const second_party = document.getElementById('contractSecondParty')?.value?.trim();
      const second_party_rep = document.getElementById('contractSecondPartyRep')?.value?.trim() || '';
      const second_party_phone = document.getElementById('contractSecondPartyPhone')?.value?.trim() || '';
      const second_party_address = document.getElementById('contractSecondPartyAddress')?.value?.trim() || '';
      const project_location = document.getElementById('contractLocation')?.value?.trim() || '';

      const total_amount = this.parseNumber(document.getElementById('contractTotalAmount')?.value || 0);
      const currency = this.getCurrency();
      const advance_payment = this.parseNumber(document.getElementById('contractAdvancePayment')?.value || 0);
      const retention_percent = this.parseNumber(document.getElementById('contractRetentionPercent')?.value || 5);
      const status = document.getElementById('contractStatus')?.value || 'ساري';
      const conditions = document.getElementById('contractConditions')?.value || '';
      const notes = document.getElementById('contractNotes')?.value || '';

      if (!title) {
        App.showToast('يرجى كتابة عنوان العقد', 'warning');
        document.getElementById('contractTitle')?.focus();
        return;
      }
      if (!second_party) {
        App.showToast('يرجى تحديد الطرف الثاني (اسم العميل / المالك)', 'warning');
        document.getElementById('contractSecondParty')?.focus();
        return;
      }
      if (total_amount <= 0) {
        App.showToast('يرجى إدخال القيمة الإجمالية للعقد', 'warning');
        document.getElementById('contractTotalAmount')?.focus();
        return;
      }

      const payload = {
        title,
        project_id,
        client_id,
        first_party,
        first_party_rep,
        second_party,
        second_party_rep,
        second_party_phone,
        second_party_address,
        project_location,
        contract_date,
        start_date,
        completion_date,
        duration_days,
        total_amount,
        currency,
        advance_payment,
        retention_percent,
        payment_terms: JSON.stringify(this.milestones),
        conditions,
        status,
        notes
      };

      const saveBtn = document.getElementById('contractSaveBtn');
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span>جاري التوثيق والحفظ...</span>';
      }

      let res;
      if (this.editingId) {
        res = await fetch(`/api/contracts/${this.editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch('/api/contracts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      const json = await res.json();
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<span>📜 حفظ وتوثيق العقد</span>';
      }

      if (json.success) {
        App.showToast(this.editingId ? 'تم تحديث العقد بنجاح ✅' : 'تم توثيق وحفظ العقد بنجاح ✨', 'success');
        this.resetForm();
        await this.loadList();
      } else {
        App.showToast(json.message || 'حدث خطأ أثناء حفظ العقد', 'error');
      }
    } catch (e) {
      console.error('Save contract error:', e);
      App.showToast('تعذر حفظ العقد', 'error');
      const saveBtn = document.getElementById('contractSaveBtn');
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<span>📜 حفظ وتوثيق العقد</span>';
      }
    }
  },

  async loadList() {
    try {
      let url = '/api/contracts';
      if (this.activeFilterProject) {
        url += `?project_id=${this.activeFilterProject}`;
      }
      const res = await fetch(url);
      const json = await res.json();
      this.list = json.success ? (json.data || []) : [];
      this.renderList();
    } catch (e) {
      console.error('Error loading contracts list:', e);
    }
  },

  renderList() {
    const tbody = document.getElementById('contractsTableBody');
    if (!tbody) return;

    if (!this.list.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty-state">لا توجد عقود مسجلة حتى الآن</td></tr>';
      return;
    }

    tbody.innerHTML = this.list.map(c => {
      const tot = Number(c.total_amount) || 0;
      const curr = c.currency || 'ر.ي';

      return `
        <tr>
          <td><strong>${this.esc(c.contract_no)}</strong></td>
          <td>
            <strong>${this.esc(c.title)}</strong>
            <div style="font-size:11px; color:var(--text-muted);">${c.contract_date || '-'} | مدة التنفيذ: ${c.duration_days || 0} يوم</div>
          </td>
          <td>${this.esc(c.project_name || 'عام')}</td>
          <td>
            <strong>${this.esc(c.second_party)}</strong>
            <div style="font-size:11px; color:var(--text-muted);">${this.esc(c.second_party_phone || '')}</div>
          </td>
          <td><strong style="color:var(--gold-dark);">${this.money(tot)} ${this.esc(curr)}</strong></td>
          <td>
            <div style="font-size:11px;">بدء: ${c.start_date || '-'}</div>
            <div style="font-size:11px; color:var(--text-muted);">تسليم: ${c.completion_date || '-'}</div>
          </td>
          <td><span class="badge ${c.status === 'ساري' ? 'badge-active' : 'badge-inactive'}">${this.esc(c.status || 'ساري')}</span></td>
          <td>
            <div class="action-btns" style="display:flex; gap:4px;">
              <button class="btn btn-secondary btn-sm" onclick="Contracts.print(${c.id})" title="طباعة العقد الرسمي A4">🖨️ طباعة</button>
              <button class="btn btn-primary btn-sm" onclick="Contracts.edit(${c.id})" title="تعديل">✏️ تعديل</button>
              <button class="btn btn-danger btn-sm" onclick="Contracts.remove(${c.id})" title="حذف">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  async edit(id) {
    try {
      const res = await fetch(`/api/contracts/${id}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.message);

      const c = json.data;
      this.editingId = c.id;

      const titleEl = document.getElementById('contractTitle');
      const projEl = document.getElementById('contractProject');
      const clientEl = document.getElementById('contractClient');
      const dateEl = document.getElementById('contractDate');
      const startEl = document.getElementById('contractStartDate');
      const compEl = document.getElementById('contractCompletionDate');
      const durEl = document.getElementById('contractDuration');
      const firstPartyEl = document.getElementById('contractFirstParty');
      const firstRepEl = document.getElementById('contractFirstPartyRep');
      const secPartyEl = document.getElementById('contractSecondParty');
      const secRepEl = document.getElementById('contractSecondPartyRep');
      const secPhoneEl = document.getElementById('contractSecondPartyPhone');
      const secAddrEl = document.getElementById('contractSecondPartyAddress');
      const locEl = document.getElementById('contractLocation');
      const amountEl = document.getElementById('contractTotalAmount');
      const advanceEl = document.getElementById('contractAdvancePayment');
      const retentionEl = document.getElementById('contractRetentionPercent');
      const condEl = document.getElementById('contractConditions');
      const statusEl = document.getElementById('contractStatus');
      const notesEl = document.getElementById('contractNotes');
      const badge = document.getElementById('contractEditingBadge');

      if (titleEl) titleEl.value = c.title || '';
      if (projEl) projEl.value = c.project_id || '';
      if (clientEl) clientEl.value = c.client_id || '';
      if (dateEl) dateEl.value = c.contract_date || '';
      if (startEl) startEl.value = c.start_date || '';
      if (compEl) compEl.value = c.completion_date || '';
      if (durEl) durEl.value = c.duration_days || 0;
      if (firstPartyEl) firstPartyEl.value = c.first_party || 'شركة رواسي عدن للهندسة والمقاولات';
      if (firstRepEl) firstRepEl.value = c.first_party_rep || 'المدير العام';
      if (secPartyEl) secPartyEl.value = c.second_party || '';
      if (secRepEl) secRepEl.value = c.second_party_rep || '';
      if (secPhoneEl) secPhoneEl.value = c.second_party_phone || '';
      if (secAddrEl) secAddrEl.value = c.second_party_address || '';
      if (locEl) locEl.value = c.project_location || '';
      if (amountEl) amountEl.value = c.total_amount || '';
      if (advanceEl) advanceEl.value = c.advance_payment || '';
      if (retentionEl) retentionEl.value = c.retention_percent || 5;
      if (condEl) condEl.value = c.conditions || '';
      if (statusEl) statusEl.value = c.status || 'ساري';
      if (notesEl) notesEl.value = c.notes || '';
      if (badge) {
        badge.style.display = 'inline-block';
        badge.textContent = `تعديل: ${c.contract_no}`;
      }

      this.setCurrency(c.currency || 'ر.ي');

      // معالجة الدفعات المرحلية
      if (c.payment_terms) {
        try {
          this.milestones = JSON.parse(c.payment_terms);
        } catch (e) {
          this.milestones = [];
        }
      } else {
        this.milestones = [];
      }
      this.renderMilestones();
      this.onAmountChange();

      const view = document.getElementById('contractsView');
      if (view) view.scrollIntoView({ behavior: 'smooth' });

      App.showToast(`تم تحميل العقد ${c.contract_no} للتعديل ✏️`, 'info');
    } catch (e) {
      console.error(e);
      App.showToast(e.message || 'تعذر تحميل بيانات العقد', 'error');
    }
  },

  async remove(id) {
    if (!confirm('هل تريد بالتأكيد حذف هذا العقد؟')) return;
    try {
      const res = await fetch(`/api/contracts/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        App.showToast('تم حذف العقد بنجاح', 'success');
        if (this.editingId === id) this.resetForm();
        this.loadList();
      } else {
        App.showToast(json.message || 'تعذر حذف العقد', 'error');
      }
    } catch (e) {
      console.error(e);
      App.showToast('حدث خطأ أثناء محاولة الحذف', 'error');
    }
  },

  filterByProject(pId) {
    this.activeFilterProject = pId || '';
    this.loadList();
  },

  getTafqeet(num, currency) {
    if (window.Quotations && typeof window.Quotations.getTafqeet === 'function') {
      return window.Quotations.getTafqeet(num, currency);
    }
    return `فقط ${this.money(num)} ${currency} لا غير`;
  },

  // طباعة وثيقة العقد الرسمية A4 على ورق رواسي عدن
  async print(id) {
    try {
      const res = await fetch(`/api/contracts/${id}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.message);

      const c = json.data;
      const area = document.getElementById('printArea');
      if (!area) return;

      const curr = c.currency || 'ر.ي';
      const words = this.getTafqeet(c.total_amount, curr);
      const advanceWords = c.advance_payment ? this.getTafqeet(c.advance_payment, curr) : '';

      let milestonesList = [];
      if (c.payment_terms) {
        try {
          milestonesList = JSON.parse(c.payment_terms);
        } catch (e) {
          milestonesList = [];
        }
      }

      const now = new Date();
      const printDateTime = `${now.toLocaleDateString('ar-YE')} - ${now.toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' })}`;

      // تقسيم بنود العقد المكتوبة
      const conditionsParagraphs = (c.conditions || '').split('\n\n').filter(p => p.trim());

      // الصفحة 1: الديباجة، التعريف بالطرفين، موضوع العقد، القيمة المالية، المدة
      // الصفحة 2: جدول الدفعات، بقية الشروط، وخانات التوقيع والختم الرسمية للطرفين
      let pagesHtml = `
        <!-- الصفحة الأولى من العقد -->
        <div class="rawasi-print-page contract-print-page contract-page-1">
          <div class="rawasi-page-content">

            <div class="quotation-print-meta">تاريخ التوثيق والطباعة: ${this.esc(printDateTime)}</div>

            <div class="contract-doc-header">
              <h1 class="contract-doc-title">عقد مقاولة تنفيذ أعمال إنشائية وهندسية</h1>
              <div class="contract-doc-no">رقم العقد: <b>${this.esc(c.contract_no)}</b></div>
            </div>

            <div class="contract-preamble">
              <p><b>بعون الله وتوفيقه</b>، في يوم <u>${this.esc(c.contract_date || '-')}</u>، تم الاتفاق والتراضي بين كل من:</p>
              
              <div class="contract-parties-box">
                <div class="party-card party-first">
                  <div class="party-header-title">الطرف الأول (المقاول المنفذ):</div>
                  <div class="party-name"><b>${this.esc(c.first_party || 'شركة رواسي عدن للهندسة والمقاولات')}</b></div>
                  <div class="party-rep">ويمثلها: <b>${this.esc(c.first_party_rep || 'المدير العام')}</b></div>
                  <div class="party-info">المقر الرئيسي: محافظة عدن — الجمهورية اليمنية</div>
                </div>

                <div class="party-card party-second">
                  <div class="party-header-title">الطرف الثاني (المالك / صاحب العمل):</div>
                  <div class="party-name"><b>${this.esc(c.second_party)}</b></div>
                  ${c.second_party_rep ? `<div class="party-rep">صفته / ممثله: <b>${this.esc(c.second_party_rep)}</b></div>` : ''}
                  <div class="party-info">رقم الهاتف: <b>${this.esc(c.second_party_phone || '-')}</b> | العنوان: ${this.esc(c.second_party_address || '-')}</div>
                </div>
              </div>

              <div class="contract-intro-text">
                وحيث أن الطرف الثاني يرغب في تنفيذ وإنجاز مشروع: <b>${this.esc(c.project_name || c.title)}</b> في موقعه الكائن في <b>${this.esc(c.project_location || 'محافظة عدن')}</b>، وحيث أن الطرف الأول يمتلك الخبرة الهندسية والإمكانات الفنية المؤهلة لتنفيذ هذه الأعمال، فقد اتفق الطرفان بكامل أهليتهما المعتبرة شرعاً وقانوناً على ما يلي:
              </div>
            </div>

            <div class="contract-clause-item">
              <div class="clause-heading">البند الأول: موضوع ونطاق العقد</div>
              <div class="clause-body">
                يلتزم الطرف الأول بتنفيذ وإتمام أعمال: <b>${this.esc(c.title)}</b> طبقاً للمخططات الهندسية المعتمدة وجداول الكميات والمواصفات الفنية والشروط المرفقة بهذا العقد، تحت إشراف المهندس المعين من قبل الطرف الثاني.
              </div>
            </div>

            <div class="contract-clause-item">
              <div class="clause-heading">البند الثاني: القيمة الإجمالية للعقد وطريقة السداد</div>
              <div class="clause-body">
                اتفق الطرفان على أن القيمة الإجمالية لتنفيذ الأعمال موضوع هذا العقد هي بمبلغ وقدره:
                <div class="contract-amount-highlight">
                  <span class="amt-num">${this.money(c.total_amount)} ${this.esc(curr)}</span>
                  <span class="amt-words">(${this.esc(words)})</span>
                </div>
                ${c.advance_payment > 0 ? `<div>ويلتزم الطرف الثاني بسداد دفعة مقدمة قدرها: <b>${this.money(c.advance_payment)} ${this.esc(curr)}</b> (${this.esc(advanceWords)}) عند توقيع هذا العقد.</div>` : ''}
              </div>
            </div>

            <div class="contract-clause-item">
              <div class="clause-heading">البند الثالث: مدة التنفيذ والبرنامج الزمني</div>
              <div class="clause-body">
                تحدد مدة تنفيذ كافة الأعمال المشمولة بهذا العقد بـ <b>(${c.duration_days || 0}) يوماً</b>، تبدأ من تاريخ تسليم الموقع للمقاول في <b>${this.esc(c.start_date || c.contract_date)}</b> وتنتهي في <b>${this.esc(c.completion_date || 'الموعد المحدد بالجدول الزمني')}</b>، ما لم تطرأ أي أعمال إضافية معتمدة كتابياً أو ظروف قوة قاهرة.
              </div>
            </div>

            ${milestonesList.length ? `
              <div class="contract-clause-item" style="margin-top: 8px;">
                <div class="clause-heading">البند الرابع: جدول الدفعات والمستخلصات المرحلية</div>
                <div class="clause-body">
                  <table class="contract-milestones-print-table">
                    <thead>
                      <tr>
                        <th style="width:35px;">ت</th>
                        <th>مسمى الدفعة</th>
                        <th style="width:65px;">النسبة</th>
                        <th style="width:110px;">المبلغ (${this.esc(curr)})</th>
                        <th>شرط ومرحلة الاستحقاق</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${milestonesList.map((m, idx) => `
                        <tr>
                          <td class="center-cell">${idx + 1}</td>
                          <td style="font-weight:600;">${this.esc(m.name)}</td>
                          <td class="center-cell">${m.percent ? m.percent + '%' : '-'}</td>
                          <td class="num-cell" style="font-weight:bold;">${this.money(m.amount)}</td>
                          <td>${this.esc(m.condition || '-')}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                  <div style="font-size:7.8pt; color:#666; margin-top:3px;">* يتم استقطاع نسبة (${c.retention_percent || 5}%) من كل دفعة كضمان حسن تنفيذ تصرف بعد الاستلام النهائي للمشروع.</div>
                </div>
              </div>
            ` : ''}

            <div class="quotation-page-footer-note">صفحة 1 من 2 — (يتبع الشروط العامة والتوقيعات في الصفحة التالية ⬅️)</div>

          </div>
        </div>

        <!-- الصفحة الثانية من العقد -->
        <div class="rawasi-print-page contract-print-page contract-page-2">
          <div class="rawasi-page-content">

            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #dfd4c0; padding-bottom:4px; margin-bottom:10px; font-size:8pt; color:#666;">
              <span><b>رواسي عدن للهندسة والمقاولات</b> — تابع وثيقة العقد رقم: ${this.esc(c.contract_no)}</span>
              <span>صفحة 2 من 2</span>
            </div>

            <div class="contract-clause-item">
              <div class="clause-heading">البند الخامس: الشروط العامة والالتزامات الهندسية</div>
              <div class="clause-body" style="font-size:8.5pt; line-height:1.6;">
                ${conditionsParagraphs.length ? conditionsParagraphs.map(p => {
                  const trimmed = p.trim();
                  const isHeading = trimmed.startsWith('البند ') || trimmed.startsWith('بند ');
                  if (isHeading) {
                    const firstLineEnd = trimmed.indexOf('\n');
                    if (firstLineEnd !== -1) {
                      const head = trimmed.substring(0, firstLineEnd);
                      const rest = trimmed.substring(firstLineEnd + 1);
                      return `<div style="margin-bottom:8px;">
                        <div style="font-weight:bold; color:#785413; font-size:8.8pt; margin-bottom:2px; border-right:3px solid #b8911c; padding-right:6px;">${this.esc(head)}</div>
                        <div style="padding-right:8px;">${this.esc(rest).replace(/\n/g, '<br>')}</div>
                      </div>`;
                    }
                  }
                  return `<p style="margin-bottom:6px;">${this.esc(trimmed).replace(/\n/g, '<br>')}</p>`;
                }).join('') : `
                  <p>1. يلتزم الطرف الأول بتنفيذ الأعمال وفق أعلى معايير الجودة الهندسية والمواصفات الفنية المعتمدة.</p>
                  <p>2. تعتبر جداول الكميات والمواصفات الفنية المعتمدة جزءاً لا يتجزأ من هذا العقد وأساساً للحصر والذرعة الهندسية الفعلية للأعمال المنفذة على الطبيعة طبقاً للأسعار الإفرادية المتفق عليها.</p>
                  <p>3. يلتزم الطرف الثاني بتسديد المستحقات المالية في مواعيدها المحددة فور اعتماد المستخلصات الهندسية.</p>
                  <p>4. يضمن الطرف الأول جودة وسلامة الأعمال المنفذة لمدة عام كامل من تاريخ الاستلام الابتدائي.</p>
                  <p>5. تم تحرير هذا العقد من نسختين أصليتين، بيد كل طرف نسخة للعمل بموجبها والتنفيذ بمقتضاها.</p>
                `}
              </div>
            </div>

            <!-- صندوق التواقيع والختم الرسمي للطرفين -->
            <div class="contract-signatures-container">
              <div class="contract-sig-box">
                <div class="sig-party-title">عن الطرف الأول (المقاول المنفذ)</div>
                <div class="sig-company-name">شركة رواسي عدن للهندسة والمقاولات</div>
                <div class="sig-name">المفوض بالتوقيع: <b>${this.esc(c.first_party_rep || 'المدير العام')}</b></div>
                <div class="sig-line-space"></div>
                <div class="sig-labels-row">
                  <span>التوقيع: ___________________</span>
                  <span>الختم الرسمي:</span>
                </div>
              </div>

              <div class="contract-sig-box">
                <div class="sig-party-title">عن الطرف الثاني (المالك / صاحب العمل)</div>
                <div class="sig-company-name">${this.esc(c.second_party)}</div>
                <div class="sig-name">المفوض بالتوقيع: <b>${this.esc(c.second_party_rep || c.second_party)}</b></div>
                <div class="sig-line-space"></div>
                <div class="sig-labels-row">
                  <span>التوقيع: ___________________</span>
                  <span>بصمة الإبهام / الختم:</span>
                </div>
              </div>
            </div>

            <div style="text-align:center; font-size:8pt; color:#888; margin-top:8px;">
              حرر ووقع في مدينة عدن بتاريخ ${this.esc(c.contract_date || '-')} — وثيقة تعاقدية قانونية ملزمة
            </div>

          </div>
        </div>
      `;

      area.innerHTML = pagesHtml;
      App.printWithRawasiLetterhead(area);
    } catch (e) {
      console.error(e);
      App.showToast(e.message || 'تعذر إعداد طباعة وثيقة العقد', 'error');
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

window.Contracts = Contracts;
