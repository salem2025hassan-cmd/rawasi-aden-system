/* ==========================================================================
   نظام جدول الكميات والمواصفات (BOQ - Bill of Quantities)
   شركة رواسي عدن للهندسة والمقاولات
   ========================================================================== */

const BOQ = {
  items: [],
  projects: [],
  clients: [],
  list: [],
  editingId: null,
  activeFilterProject: '',

  // التصنيفات والأقسام الهندسية المعتمدة
  categories: [
    'الأعمال الترابية والحفريات',
    'الأعمال الخرسانية المسلحة',
    'أعمال الخرسانة العادية والأساسات',
    'أعمال المباني والبلوك',
    'أعمال العزل المائي والحراري',
    'أعمال اللياسة والتشطيبات',
    'أعمال الدهانات والديكور',
    'أعمال الأرضيات والسيراميك والرخام',
    'أعمال التمديدات الكهربائية والإنارة',
    'أعمال التغذية والصرف الصحي (السباكة)',
    'أعمال النجارة والأبواب والشبابيك والألمنيوم',
    'أعمال الحدادة والمظلات',
    'أعمال عامة وموقع عام'
  ],

  // وحدات القياس الهندسية المعتمدة
  units: ['م3', 'م2', 'م.ط', 'عدد', 'كجم', 'طن', 'مقطوعية', 'طقم', 'نقطة', 'حبة'],

  async init() {
    await Promise.all([this.loadLookups(), this.loadList()]);
    if (!this.items.length) {
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
      console.error('Error loading lookups for BOQ:', e);
    }
  },

  fillSelects() {
    const projSelect = document.getElementById('boqProject');
    const clientSelect = document.getElementById('boqClient');
    const filterSelect = document.getElementById('boqFilterProject');

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
    const pId = document.getElementById('boqProject')?.value;
    if (!pId) return;

    const proj = this.projects.find(p => String(p.id) === String(pId));
    if (proj) {
      if (proj.client_id) {
        const clientSelect = document.getElementById('boqClient');
        if (clientSelect) clientSelect.value = proj.client_id;
      }
      if (proj.currency) {
        this.setCurrency(proj.currency);
      }
      const titleInput = document.getElementById('boqTitle');
      if (titleInput && (!titleInput.value || titleInput.value.trim() === '')) {
        titleInput.value = `جدول كميات مشروع: ${proj.name}`;
      }
    }
  },

  getCurrency() {
    const sel = document.getElementById('boqCurrency');
    if (!sel) return 'ر.ي';
    if (sel.value === 'custom') {
      const custom = document.getElementById('boqCustomCurrency');
      return (custom && custom.value.trim()) ? custom.value.trim() : 'عملة مخصصة';
    }
    return sel.value || 'ر.ي';
  },

  setCurrency(curr) {
    const sel = document.getElementById('boqCurrency');
    const custom = document.getElementById('boqCustomCurrency');
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
    const sel = document.getElementById('boqCurrency');
    const custom = document.getElementById('boqCustomCurrency');
    if (sel && custom) {
      custom.style.display = (sel.value === 'custom') ? 'inline-block' : 'none';
      if (sel.value === 'custom') custom.focus();
    }

    const curr = this.getCurrency();
    document.querySelectorAll('.boq-curr-badge').forEach(b => b.textContent = curr);
    this.items.forEach((_, i) => this.updateLineTotal(i));
    this.renderTotalsOnly();
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

  addItem(data = {}, shouldFocus = true) {
    const defaultCategory = this.items.length > 0 ? this.items[this.items.length - 1].category : 'الأعمال الترابية والحفريات';
    this.items.push({
      item_order: this.items.length + 1,
      category: data.category || defaultCategory || 'عام',
      description: data.description || '',
      unit: data.unit || 'م3',
      quantity: data.quantity !== undefined ? data.quantity : '',
      unit_price: data.unit_price !== undefined ? data.unit_price : '',
      executed_qty: data.executed_qty !== undefined ? data.executed_qty : 0,
      notes: data.notes || ''
    });

    this.renderItems();

    if (shouldFocus) {
      const idx = this.items.length - 1;
      setTimeout(() => {
        const input = document.getElementById(`boqDesc_${idx}`);
        if (input) input.focus();
      }, 50);
    }
  },

  removeItem(idx) {
    if (this.items.length <= 1) {
      this.items = [{
        item_order: 1,
        category: 'الأعمال الترابية والحفريات',
        description: '',
        unit: 'م3',
        quantity: '',
        unit_price: '',
        executed_qty: 0,
        notes: ''
      }];
      this.renderItems();
      return;
    }
    this.items.splice(idx, 1);
    this.items.forEach((it, i) => it.item_order = i + 1);
    this.renderItems();
  },

  duplicateItem(idx) {
    const src = this.items[idx];
    if (!src) return;
    this.items.splice(idx + 1, 0, {
      ...src,
      item_order: idx + 2,
      description: src.description ? `${src.description} (نسخة)` : ''
    });
    this.items.forEach((it, i) => it.item_order = i + 1);
    this.renderItems();
  },

  // إضافة حزمة بنود هندسية نموذجية جاهزة بنقرة واحدة
  applyTemplate(type) {
    let presets = [];
    if (type === 'civil') {
      presets = [
        { category: 'الأعمال الترابية والحفريات', description: 'حفريات للأساسات والقواعد في تربة صخرية ومتوسطة حسب المخططات وتوجيهات المهندس المشرف', unit: 'م3', quantity: 150, unit_price: 15 },
        { category: 'الأعمال الترابية والحفريات', description: 'ردم حول القواعد وداخل المبنى بأتربة صالحة نظيفة على طبقات مع الرش والدك الميكانيكي', unit: 'م3', quantity: 80, unit_price: 10 },
        { category: 'أعمال الخرسانة العادية والأساسات', description: 'صب خرسانة عادية (فرشة نظافة) أسفل القواعد بسمك 10 سم بمحتوى 250 كجم أسمنت/م3', unit: 'م3', quantity: 25, unit_price: 75 },
        { category: 'الأعمال الخرسانية المسلحة', description: 'صب خرسانة مسلحة للقواعد المنفصلة والشريطية بمقاومة 350 كجم/سم2 شاملة حديد التسليح والشدات', unit: 'م3', quantity: 60, unit_price: 210 },
        { category: 'الأعمال الخرسانية المسلحة', description: 'صب خرسانة مسلحة للميدات والرقاب والأعمدة مع الرش والمعالجة الهندسية', unit: 'م3', quantity: 45, unit_price: 230 },
        { category: 'الأعمال الخرسانية المسلحة', description: 'صب خرسانة مسلحة للأسقف والكمرات الهوردي والمصمتة بالمضخة الجاهزة', unit: 'م3', quantity: 70, unit_price: 220 },
        { category: 'أعمال المباني والبلوك', description: 'بناء جدران من البلوك الإسمنتي المصمت والمفرغ سمك 20 سم مع المونة والربط المحكم', unit: 'م2', quantity: 350, unit_price: 18 }
      ];
    } else if (type === 'finishing') {
      presets = [
        { category: 'أعمال اللياسة والتشطيبات', description: 'طرطشة مسمارية ولياسة إسمنتية داخلية للجدران والأسقف مع تركيب الشبك وزوايا الحماية', unit: 'م2', quantity: 600, unit_price: 9 },
        { category: 'أعمال اللياسة والتشطيبات', description: 'لياسة إسمنتية خارجية ملونة / واجهات مع العزل والمقاومة للرطوبة والعوامل الجوية', unit: 'م2', quantity: 320, unit_price: 13 },
        { category: 'أعمال الأرضيات والسيراميك والرخام', description: 'توريد وتركيب بلاط بورسلان نخب أول للأرضيات والممرات مقاس 60×60 سم مع الغراء والروبة', unit: 'م2', quantity: 280, unit_price: 24 },
        { category: 'أعمال الأرضيات والسيراميك والرخام', description: 'توريد وتركيب سيراميك جدران وأرضيات الحمامات والمطابخ نخب أول مع العزل المائي المتكامل', unit: 'م2', quantity: 140, unit_price: 22 },
        { category: 'أعمال الدهانات والديكور', description: 'أعمال دهان داخلي 3 أوجه أساس ومعجون وبويه بلاستيكية فينيل حريري فاخر عالي الجودة', unit: 'م2', quantity: 600, unit_price: 6 },
        { category: 'أعمال النجارة والأبواب والشبابيك والألمنيوم', description: 'توريد وتركيب أبواب خشبية كبس قشرة سنديان شاملة الحلق والإكسسوارات والكيلون', unit: 'عدد', quantity: 12, unit_price: 160 }
      ];
    } else if (type === 'mep') {
      presets = [
        { category: 'أعمال التمديدات الكهربائية والإنارة', description: 'تأسيس وتمديد مواسير وأسلاك الكهرباء المعزولة للإنارة والمخارج مع لوحات التوزيع والقواطع', unit: 'نقطة', quantity: 85, unit_price: 16 },
        { category: 'أعمال التمديدات الكهربائية والإنارة', description: 'توريد وتركيب سبوت لايت ووحدات إنارة LED موفرة للطاقة ومفاتيح وبرايز عالية الجودة', unit: 'عدد', quantity: 90, unit_price: 12 },
        { category: 'أعمال التغذية والصرف الصحي (السباكة)', description: 'شبكة تغذية المياه البارد والحار بأنابيب PPR حرارية ملحومة مع فحص الضغط', unit: 'نقطة', quantity: 28, unit_price: 22 },
        { category: 'أعمال التغذية والصرف الصحي (السباكة)', description: 'تمديد شبكة الصرف الصحي ومزاريب مياه الأمطار بأنابيب PVC ثقيلة مع فتحات التفتيش', unit: 'م.ط', quantity: 65, unit_price: 18 }
      ];
    }

    if (presets.length) {
      if (this.items.length === 1 && !this.items[0].description) {
        this.items = [];
      }
      presets.forEach(p => this.addItem(p, false));
      this.renderItems();
      App.showToast(`تمت إضافة ${presets.length} بنداً هندسياً بنجاح ✨`, 'success');
    }
  },

  update(idx, key, val) {
    if (!this.items[idx]) return;
    this.items[idx][key] = val;
    if (key === 'quantity' || key === 'unit_price' || key === 'executed_qty') {
      this.updateLineTotal(idx);
      this.renderTotalsOnly();
    }
  },

  updateLineTotal(idx) {
    const it = this.items[idx];
    if (!it) return;

    const qty = this.parseNumber(it.quantity);
    const price = this.parseNumber(it.unit_price);
    const execQty = this.parseNumber(it.executed_qty);
    const lineTotal = qty * price;
    const execTotal = execQty * price;
    const progress = qty > 0 ? Math.min(100, Math.round((execQty / qty) * 100)) : 0;
    const curr = this.getCurrency();

    const cell = document.getElementById(`boqLineTotal_${idx}`);
    if (cell) {
      cell.innerHTML = `<strong>${this.money(lineTotal)}</strong> <small class="boq-curr-badge">${this.esc(curr)}</small>`;
    }

    const progCell = document.getElementById(`boqLineProg_${idx}`);
    if (progCell) {
      progCell.innerHTML = `
        <div class="boq-mini-progress">
          <div class="boq-prog-bar" style="width: ${progress}%;"></div>
        </div>
        <div class="boq-prog-text">${progress}% (${this.money(execQty)} / ${this.money(qty)})</div>
      `;
    }
  },

  renderItems() {
    const tbody = document.getElementById('boqItemsBody');
    if (!tbody) return;

    const curr = this.getCurrency();

    tbody.innerHTML = this.items.map((it, i) => {
      const qty = this.parseNumber(it.quantity);
      const price = this.parseNumber(it.unit_price);
      const execQty = this.parseNumber(it.executed_qty);
      const lineTotal = qty * price;
      const progress = qty > 0 ? Math.min(100, Math.round((execQty / qty) * 100)) : 0;

      return `
        <tr id="boqRow_${i}" class="boq-item-row">
          <td class="text-center boq-order-cell">
            <span class="boq-order-badge">${i + 1}</span>
          </td>
          <td style="min-width: 170px;">
            <input list="boqCategoryList" class="form-control boq-cat-input" id="boqCat_${i}" 
                   value="${this.esc(it.category || 'عام')}" 
                   onchange="BOQ.update(${i}, 'category', this.value)" 
                   placeholder="القسم / المرحلة">
          </td>
          <td style="min-width: 250px;">
            <textarea class="form-control boq-desc-input" id="boqDesc_${i}" rows="2"
                      oninput="BOQ.update(${i}, 'description', this.value)" 
                      placeholder="وصف البند والمواصفات الفنية بالتفصيل...">${this.esc(it.description)}</textarea>
          </td>
          <td style="width: 95px;">
            <select class="form-control" id="boqUnit_${i}" onchange="BOQ.update(${i}, 'unit', this.value)">
              ${this.units.map(u => `<option value="${u}" ${it.unit === u ? 'selected' : ''}>${u}</option>`).join('')}
              ${!this.units.includes(it.unit) && it.unit ? `<option value="${this.esc(it.unit)}" selected>${this.esc(it.unit)}</option>` : ''}
            </select>
          </td>
          <td style="width: 100px;">
            <input type="text" inputmode="decimal" class="form-control text-center boq-num" id="boqQty_${i}" 
                   value="${it.quantity !== undefined ? it.quantity : ''}" 
                   onfocus="this.select()"
                   oninput="BOQ.update(${i}, 'quantity', this.value)" 
                   placeholder="0">
          </td>
          <td style="width: 110px;">
            <input type="text" inputmode="decimal" class="form-control text-center boq-num" id="boqPrice_${i}" 
                   value="${it.unit_price !== undefined ? it.unit_price : ''}" 
                   onfocus="this.select()"
                   oninput="BOQ.update(${i}, 'unit_price', this.value)" 
                   placeholder="0.00">
          </td>
          <td class="text-left boq-line-total-cell" id="boqLineTotal_${i}" style="width: 125px;">
            <strong>${this.money(lineTotal)}</strong> <small class="boq-curr-badge">${this.esc(curr)}</small>
          </td>
          <td style="width: 95px;">
            <input type="text" inputmode="decimal" class="form-control text-center boq-num" id="boqExecQty_${i}" 
                   value="${it.executed_qty !== undefined ? it.executed_qty : 0}" 
                   onfocus="this.select()"
                   oninput="BOQ.update(${i}, 'executed_qty', this.value)" 
                   title="الكمية المنفذة فعلياً حتى الآن"
                   placeholder="0">
          </td>
          <td class="text-center boq-progress-cell" id="boqLineProg_${i}" style="width: 110px;">
            <div class="boq-mini-progress">
              <div class="boq-prog-bar" style="width: ${progress}%;"></div>
            </div>
            <div class="boq-prog-text">${progress}%</div>
          </td>
          <td class="text-center" style="width: 80px;">
            <div class="btn-group-sm" style="display:flex; gap:3px; justify-content:center;">
              <button type="button" class="btn btn-secondary btn-sm" onclick="BOQ.duplicateItem(${i})" title="تكرار البند">📋</button>
              <button type="button" class="btn btn-danger btn-sm" onclick="BOQ.removeItem(${i})" title="حذف">✕</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    this.renderTotalsOnly();
  },

  renderTotalsOnly() {
    const curr = this.getCurrency();
    let totalEstimated = 0;
    let totalExecuted = 0;
    let totalItems = 0;

    this.items.forEach(it => {
      const q = this.parseNumber(it.quantity);
      const p = this.parseNumber(it.unit_price);
      const eq = this.parseNumber(it.executed_qty);
      if (it.description && it.description.trim()) {
        totalItems++;
        totalEstimated += (q * p);
        totalExecuted += (eq * p);
      }
    });

    const overallProgress = totalEstimated > 0 ? Math.min(100, Math.round((totalExecuted / totalEstimated) * 100)) : 0;
    const tafqeetText = this.getTafqeet(totalEstimated, curr);

    const countEl = document.getElementById('boqItemsCount');
    const totalEl = document.getElementById('boqTotalEstimated');
    const execEl = document.getElementById('boqTotalExecuted');
    const progEl = document.getElementById('boqOverallProgress');
    const progBar = document.getElementById('boqOverallProgressBar');
    const tafqeetEl = document.getElementById('boqTafqeetText');

    if (countEl) countEl.textContent = totalItems;
    if (totalEl) totalEl.textContent = `${this.money(totalEstimated)} ${curr}`;
    if (execEl) execEl.textContent = `${this.money(totalExecuted)} ${curr}`;
    if (progEl) progEl.textContent = `${overallProgress}%`;
    if (progBar) progBar.style.width = `${overallProgress}%`;
    if (tafqeetEl) tafqeetEl.textContent = tafqeetText;
  },

  resetForm() {
    this.editingId = null;
    const titleEl = document.getElementById('boqTitle');
    const projEl = document.getElementById('boqProject');
    const clientEl = document.getElementById('boqClient');
    const dateEl = document.getElementById('boqDate');
    const statusEl = document.getElementById('boqStatus');
    const notesEl = document.getElementById('boqNotes');
    const badge = document.getElementById('boqEditingBadge');

    if (titleEl) titleEl.value = '';
    if (projEl) projEl.value = '';
    if (clientEl) clientEl.value = '';
    if (dateEl) dateEl.value = new Date().toISOString().split('T')[0];
    if (statusEl) statusEl.value = 'نشط';
    if (notesEl) notesEl.value = '';
    if (badge) badge.style.display = 'none';

    this.setCurrency('ر.ي');

    this.items = [{
      item_order: 1,
      category: 'الأعمال الترابية والحفريات',
      description: '',
      unit: 'م3',
      quantity: '',
      unit_price: '',
      executed_qty: 0,
      notes: ''
    }];

    this.renderItems();
  },

  async save() {
    try {
      const title = document.getElementById('boqTitle')?.value?.trim();
      const project_id = document.getElementById('boqProject')?.value || null;
      const client_id = document.getElementById('boqClient')?.value || null;
      const date = document.getElementById('boqDate')?.value || new Date().toISOString().split('T')[0];
      const currency = this.getCurrency();
      const status = document.getElementById('boqStatus')?.value || 'نشط';
      const notes = document.getElementById('boqNotes')?.value || '';

      if (!title) {
        App.showToast('يرجى كتابة عنوان أو مسمى لجدول الكميات', 'warning');
        document.getElementById('boqTitle')?.focus();
        return;
      }

      const validItems = this.items.filter(it => it.description && it.description.trim() && this.parseNumber(it.quantity) > 0);
      if (!validItems.length) {
        App.showToast('يرجى إدخال بند واحد على الأقل مع تحديد الكمية وسعر الوحدة', 'warning');
        return;
      }

      const payload = {
        title,
        project_id,
        client_id,
        date,
        currency,
        status,
        notes,
        items: validItems.map((it, idx) => ({
          item_order: idx + 1,
          category: it.category || 'عام',
          description: it.description.trim(),
          unit: it.unit || 'وحدة',
          quantity: this.parseNumber(it.quantity),
          unit_price: this.parseNumber(it.unit_price),
          executed_qty: this.parseNumber(it.executed_qty),
          notes: it.notes || ''
        }))
      };

      const saveBtn = document.getElementById('boqSaveBtn');
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span>جاري الحفظ...</span>';
      }

      let res;
      if (this.editingId) {
        res = await fetch(`/api/boq/${this.editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch('/api/boq', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      const json = await res.json();
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<span>💾 حفظ جدول الكميات</span>';
      }

      if (json.success) {
        App.showToast(this.editingId ? 'تم تحديث جدول الكميات بنجاح ✅' : 'تم حفظ جدول الكميات بنجاح ✨', 'success');
        this.resetForm();
        await this.loadList();
      } else {
        App.showToast(json.message || 'حدث خطأ أثناء الحفظ', 'error');
      }
    } catch (e) {
      console.error('Save BOQ error:', e);
      App.showToast('تعذر الاتصال بالخادم لحفظ جدول الكميات', 'error');
      const saveBtn = document.getElementById('boqSaveBtn');
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<span>💾 حفظ جدول الكميات</span>';
      }
    }
  },

  async loadList() {
    try {
      let url = '/api/boq';
      if (this.activeFilterProject) {
        url += `?project_id=${this.activeFilterProject}`;
      }
      const res = await fetch(url);
      const json = await res.json();
      this.list = json.success ? (json.data || []) : [];
      this.renderList();
    } catch (e) {
      console.error('Error loading BOQ list:', e);
    }
  },

  renderList() {
    const tbody = document.getElementById('boqTableBody');
    if (!tbody) return;

    if (!this.list.length) {
      tbody.innerHTML = '<tr><td colspan="9" class="empty-state">لا توجد جداول كميات مسجلة حتى الآن</td></tr>';
      return;
    }

    tbody.innerHTML = this.list.map(b => {
      const tot = Number(b.total_amount) || 0;
      const exec = Number(b.executed_amount) || 0;
      const prog = tot > 0 ? Math.min(100, Math.round((exec / tot) * 100)) : 0;
      const curr = b.currency || 'ر.ي';

      return `
        <tr>
          <td><strong>${this.esc(b.boq_no)}</strong></td>
          <td>
            <strong>${this.esc(b.title)}</strong>
            <div style="font-size:11px; color:var(--text-muted);">${b.date || '-'}</div>
          </td>
          <td>${this.esc(b.project_name || 'بدون مشروع')}</td>
          <td>${this.esc(b.client_name || '-')}</td>
          <td><strong style="color:var(--gold-dark);">${this.money(tot)} ${this.esc(curr)}</strong></td>
          <td>
            <div style="display:flex; align-items:center; gap:8px;">
              <div class="boq-mini-progress" style="width:70px;">
                <div class="boq-prog-bar" style="width:${prog}%;"></div>
              </div>
              <span style="font-size:12px; font-weight:bold;">${prog}%</span>
            </div>
            <small style="color:var(--text-muted); font-size:10px;">${this.money(exec)} ${this.esc(curr)}</small>
          </td>
          <td><span class="badge ${b.status === 'نشط' ? 'badge-active' : 'badge-inactive'}">${this.esc(b.status || 'نشط')}</span></td>
          <td>
            <div class="action-btns" style="display:flex; gap:4px;">
              <button class="btn btn-secondary btn-sm" onclick="BOQ.print(${b.id})" title="طباعة رسمية A4">🖨️ طباعة</button>
              <button class="btn btn-primary btn-sm" onclick="BOQ.edit(${b.id})" title="تعديل">✏️ تعديل</button>
              <button class="btn btn-danger btn-sm" onclick="BOQ.remove(${b.id})" title="حذف">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  },

  async edit(id) {
    try {
      const res = await fetch(`/api/boq/${id}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.message);

      const b = json.data;
      this.editingId = b.id;

      const titleEl = document.getElementById('boqTitle');
      const projEl = document.getElementById('boqProject');
      const clientEl = document.getElementById('boqClient');
      const dateEl = document.getElementById('boqDate');
      const statusEl = document.getElementById('boqStatus');
      const notesEl = document.getElementById('boqNotes');
      const badge = document.getElementById('boqEditingBadge');

      if (titleEl) titleEl.value = b.title || '';
      if (projEl) projEl.value = b.project_id || '';
      if (clientEl) clientEl.value = b.client_id || '';
      if (dateEl) dateEl.value = b.date || '';
      if (statusEl) statusEl.value = b.status || 'نشط';
      if (notesEl) notesEl.value = b.notes || '';
      if (badge) {
        badge.style.display = 'inline-block';
        badge.textContent = `تعديل: ${b.boq_no}`;
      }

      this.setCurrency(b.currency || 'ر.ي');

      this.items = (b.items && b.items.length) ? b.items.map(it => ({
        id: it.id,
        item_order: it.item_order,
        category: it.category || 'عام',
        description: it.description,
        unit: it.unit || 'وحدة',
        quantity: it.quantity,
        unit_price: it.unit_price,
        executed_qty: it.executed_qty || 0,
        notes: it.notes || ''
      })) : [{
        item_order: 1,
        category: 'الأعمال الترابية والحفريات',
        description: '',
        unit: 'م3',
        quantity: '',
        unit_price: '',
        executed_qty: 0,
        notes: ''
      }];

      this.renderItems();

      const view = document.getElementById('boqView');
      if (view) view.scrollIntoView({ behavior: 'smooth' });

      App.showToast(`تم تحميل جدول الكميات ${b.boq_no} للتعديل ✏️`, 'info');
    } catch (e) {
      console.error(e);
      App.showToast(e.message || 'تعذر تحميل جدول الكميات', 'error');
    }
  },

  async remove(id) {
    if (!confirm('هل تريد بالتأكيد حذف جدول الكميات هذا؟ سيتم حذف جميع البنود المرتبطة به.')) return;
    try {
      const res = await fetch(`/api/boq/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        App.showToast('تم حذف جدول الكميات بنجاح', 'success');
        if (this.editingId === id) this.resetForm();
        this.loadList();
      } else {
        App.showToast(json.message || 'تعذر حذف جدول الكميات', 'error');
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

  // تفقيط المبالغ وتحويلها إلى كلمات عربية بالعملة المختارة
  getTafqeet(num, currency) {
    if (window.Quotations && typeof window.Quotations.getTafqeet === 'function') {
      return window.Quotations.getTafqeet(num, currency);
    }
    return `فقط ${this.money(num)} ${currency} لا غير`;
  },

  // تجهيز وطباعة جدول الكميات A4 على الورقة الرسمية لرواسي عدن
  async print(id) {
    try {
      const res = await fetch(`/api/boq/${id}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.message);

      const b = json.data;
      const area = document.getElementById('printArea');
      if (!area) return;

      const curr = b.currency || 'ر.ي';
      const words = this.getTafqeet(b.total_amount, curr);
      const items = b.items || [];
      const hasNotes = !!(b.notes && b.notes.trim());

      // تقسيم البنود هندسياً على صفحات A4 الرسمية
      // الصفحة الأولى: ترويسة + بيانات المشروع والمالك + حوالي 12-14 بنداً
      // الصفحات الوسطى: حوالي 18-20 بنداً
      // الصفحة الأخيرة: بقية البنود + جدول الإجماليات والتفقيط + التوقيعات والختم
      const pages = this.paginateBoqItems(items, hasNotes);
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

        // حساب إجمالي الصفحة الحالية
        const pageSubtotal = pageItems.reduce((s, it) => s + (Number(it.total) || 0), 0);

        pagesHtml += `
          <div class="rawasi-print-page boq-print-page boq-page-${pageNum}">
            <div class="rawasi-page-content">

              ${isFirstPage ? `
                <div class="quotation-print-meta">تاريخ ووقت الطباعة: ${this.esc(printDateTime)}</div>
                
                <div class="quotation-header-box" style="margin-bottom:12px;">
                  <div class="quotation-title-block">
                    <div style="font-size: 11pt; font-weight: 800; color: #1e293b; margin-bottom: 2px;">شركة رواسي عدن للهندسة والمقاولات</div>
                    <h1 style="font-size:16pt; margin:0; color:var(--text-primary);">جدول الكميات والمواصفات (B.O.Q)</h1>
                    <div class="quotation-no-badge">الرقم المرجعي: <b>${this.esc(b.boq_no)}</b></div>
                  </div>
                  <div class="quotation-meta-grid" style="grid-template-columns: repeat(3, 1fr); gap:6px;">
                    <div><span>المشروع:</span> <b>${this.esc(b.project_name || 'مشروع هندسي عام')}</b></div>
                    <div><span>المالك / العميل:</span> <b>${this.esc(b.client_name || 'غير محدد')}</b></div>
                    <div><span>تاريخ الإعداد:</span> <b>${this.esc(b.date || '-')}</b></div>
                    <div><span>العملة المعتمدة:</span> <b>${this.esc(curr)}</b></div>
                    <div><span>حالة الجدول:</span> <b>${this.esc(b.status || 'معتمد')}</b></div>
                    <div><span>إجمالي البنود:</span> <b>${items.length} بنداً</b></div>
                  </div>
                </div>
              ` : `
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #dfd4c0; padding-bottom:4px; margin-bottom:8px; font-size:8pt; color:#666;">
                  <span><b>رواسي عدن للهندسة والمقاولات</b> — جدول الكميات: ${this.esc(b.boq_no)} (${this.esc(b.project_name || '')})</span>
                  <span>صفحة ${pageNum} من ${totalPages}</span>
                </div>
              `}

              <table class="quotation-print-table boq-print-table">
                <thead>
                  <tr>
                    <th style="width:36px;">ت</th>
                    <th style="width:110px;">القسم / المرحلة</th>
                    <th>بيان الأعمال والمواصفات الفنية</th>
                    <th style="width:50px;">الوحدة</th>
                    <th style="width:55px;">الكمية</th>
                    <th style="width:85px;">الفئة (${this.esc(curr)})</th>
                    <th style="width:95px;">الإجمالي (${this.esc(curr)})</th>
                  </tr>
                </thead>
                <tbody>
                  ${pageItems.map((it, i) => `
                    <tr>
                      <td class="center-cell">${startIndex + i + 1}</td>
                      <td style="font-weight:600; font-size:8pt; color:#4a3f35;">${this.esc(it.category || 'عام')}</td>
                      <td class="desc-cell" style="font-size:8.5pt;">${this.esc(it.description)}</td>
                      <td class="center-cell">${this.esc(it.unit || 'وحدة')}</td>
                      <td class="center-cell">${this.money(it.quantity)}</td>
                      <td class="num-cell">${this.money(it.unit_price)}</td>
                      <td class="num-cell" style="font-weight:bold;">${this.money(it.total)}</td>
                    </tr>
                  `).join('')}
                </tbody>
                ${isLastPage ? `
                  <tfoot>
                    <tr class="quotation-total-tr">
                      <td colspan="6" class="total-label" style="font-size:10pt;">الإجمالي التقديري العام لجدول الكميات:</td>
                      <td class="total-val" style="font-size:10.5pt;">${this.money(b.total_amount)} ${this.esc(curr)}</td>
                    </tr>
                  </tfoot>
                ` : `
                  <tfoot>
                    <tr style="background:#faf7f2; font-size:8pt; font-weight:bold;">
                      <td colspan="6" style="text-align:left; padding:3px 8px;">إجمالي هذه الصفحة:</td>
                      <td class="num-cell" style="padding:3px 8px;">${this.money(pageSubtotal)} ${this.esc(curr)}</td>
                    </tr>
                  </tfoot>
                `}
              </table>

              ${!isLastPage ? `
                <div class="quotation-page-footer-note">صفحة ${pageNum} من ${totalPages} — (يتبع جدول الكميات في الصفحة التالية ⬅️)</div>
              ` : ''}

              ${isLastPage ? `
                <div class="quotation-tafqeet-box" style="margin-top:6px; padding:6px 10px; font-size:9pt;">
                  <b>المبلغ كتابةً:</b> ${this.esc(words)}
                </div>

                ${hasNotes ? `
                  <div class="quotation-notes-box" style="margin-top:6px; padding:6px 10px; font-size:8pt;">
                    <b>ملاحظات وشروط فنية:</b>
                    <div>${this.esc(b.notes).replace(/\n/g, '<br>')}</div>
                  </div>
                ` : ''}

                <div class="quotation-signatures-box" style="margin-top:10px;">
                  <div class="sig-col">
                    <span class="sig-title">إعداد مهندس الحصر والكميات</span>
                    <div class="sig-space" style="height:35px;"></div>
                    <span class="sig-line">التوقيع: _______________________</span>
                  </div>
                  <div class="sig-col">
                    <span class="sig-title">مراجعة وتدقيق مهندس الإشراف</span>
                    <div class="sig-space" style="height:35px;"></div>
                    <span class="sig-line">التوقيع: _______________________</span>
                  </div>
                  <div class="sig-col">
                    <span class="sig-title">اعتماد الإدارة وختم الشركة</span>
                    <div class="sig-space" style="height:35px;"></div>
                    <span class="sig-line">التوقيع والختم: __________________</span>
                  </div>
                </div>

                <div style="text-align:left; font-size:7.5pt; color:#888; margin-top:4px;">صفحة ${pageNum} من ${totalPages}</div>
              ` : ''}

            </div>
          </div>
        `;
      });

      area.innerHTML = pagesHtml;
      App.printWithRawasiLetterhead(area);
    } catch (e) {
      console.error(e);
      App.showToast(e.message || 'تعذر إعداد طباعة جدول الكميات', 'error');
    }
  },

  // تقسيم بنود جدول الكميات هندسياً بحساب دقيق لارتفاع كل بند لضمان عدم قص أي سطر أو بند نهائياً
  paginateBoqItems(items, hasNotes) {
    if (window.App && typeof App.paginatePrintItems === 'function') {
      return App.paginatePrintItems(items, { hasNotes, capSingle: 500, capPage1: 760, capMid: 880, capLast: 660 });
    }
    return [items];
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

window.BOQ = BOQ;
