/**
 * إدارة إعدادات النظام، بيانات الشركة، النسخ الاحتياطي، والمستخدمين والصلاحيات - رواسي عدن
 */

const Settings = {
  _cachedUsers: [],
  _selectedBackupFile: null,
  _selectedServerBackupName: null,
  _printConfig: null,
  activeTab: 'users',

  async init() {
    await this.loadCompanySettings();
    await this.loadPrintSettings();
    await this.loadUsers();
  },

  // ================== تبديل تبويبات الإعدادات ==================
  switchTab(tab) {
    this.activeTab = tab;
    document.querySelectorAll('.settings-pane').forEach(p => p.style.display = 'none');
    document.querySelectorAll('.report-tabs-bar .report-tab-btn').forEach(b => b.classList.remove('active'));

    const activePane = document.getElementById(`pane_settings_${tab}`);
    const activeBtn = document.getElementById(`tabBtn_settings_${tab}`);
    if (activePane) activePane.style.display = 'block';
    if (activeBtn) activeBtn.classList.add('active');

    if (tab === 'users') {
      this.loadUsers();
    } else if (tab === 'company') {
      this.loadCompanySettings();
    } else if (tab === 'print') {
      this.loadPrintSettings();
    } else if (tab === 'backup') {
      this.loadDbConfig();
      this.loadLogoutBackups();
    }
  },

  // ================== إعدادات الشركة ==================
  async loadCompanySettings() {
    try {
      const res = await fetch('/api/settings');
      const json = await res.json();
      if (json.success) {
        const s = json.data;
        const setVal = (id, val) => {
          const el = document.getElementById(id);
          if (el && val !== undefined && val !== null) el.value = val;
        };

        setVal('setCompanyName', s.company_name);
        setVal('setPhone1', s.phone1);
        setVal('setPhone2', s.phone2);
        setVal('setEmail', s.email);
        setVal('setAddress', s.address);
        setVal('setSlogan', s.slogan);

        // تحديث تذييل الصفحة (Footer)
        this.updateFooter(s);
      }
    } catch (e) {
      console.error('Error loading settings:', e);
    }
  },

  updateFooter(s) {
    if (!s) return;
    const phoneEl = document.getElementById('footerPhone');
    if (phoneEl) {
      if (s.phone1 && s.phone2 && s.phone1 !== s.phone2) {
        phoneEl.textContent = `${s.phone1} / ${s.phone2}`;
      } else {
        phoneEl.textContent = s.phone1 || s.phone2 || '773413937';
      }
    }
    const emailEl = document.getElementById('footerEmail');
    if (emailEl && s.email) emailEl.textContent = s.email;
    const addressEl = document.getElementById('footerAddress');
    if (addressEl && s.address) addressEl.textContent = s.address;
    const sloganEl = document.getElementById('footerSlogan');
    if (sloganEl && s.slogan) sloganEl.textContent = s.slogan;
  },

  async saveCompanySettings(e) {
    if (e) e.preventDefault();
    const updates = {
      company_name: document.getElementById('setCompanyName')?.value,
      phone1: document.getElementById('setPhone1')?.value,
      phone2: document.getElementById('setPhone2')?.value,
      email: document.getElementById('setEmail')?.value,
      address: document.getElementById('setAddress')?.value,
      slogan: document.getElementById('setSlogan')?.value
    };

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      const data = await res.json();
      if (data.success) {
        this.updateFooter(updates);
        App.showToast('تم حفظ وتحديث بيانات الشركة بنجاح وتم التأكيد في قاعدة البيانات!', 'success');
      }
    } catch (e) {
      App.showToast('تعذر حفظ الإعدادات', 'error');
    }
  },

  // ================== تخصيص ورقة الطباعة والتقارير ==================
  getPrintConfig() {
    if (this._printConfig) return this._printConfig;
    const defaults = {
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
      footer_notes: 'تعتبر هذه السندات والوثائق رسمية ولا يعتمد أي كشط أو تعديل بدون ختم الإدارة'
    };

    try {
      const cached = localStorage.getItem('rawasi_print_config');
      if (cached) {
        this._printConfig = Object.assign({}, defaults, JSON.parse(cached));
        return this._printConfig;
      }
    } catch (e) {}

    this._printConfig = defaults;
    return defaults;
  },

  async loadPrintSettings() {
    try {
      const res = await fetch('/api/settings');
      const json = await res.json();
      if (json.success && json.data) {
        const s = json.data;
        const cfg = {
          header_title: s.print_header_title || s.company_name || 'شركة رواسي عدن للهندسة والمقاولات',
          header_subtitle: s.print_header_subtitle || (s.address ? `${s.address} | هاتف: ${s.phone1 || '773413937'}` : 'عدن - الجمهورية اليمنية | هاتف: 773413937'),
          header_en: s.print_header_en || 'Rawasi Aden for Engineering & Contracting',
          tax_no: s.print_tax_no || 'س.ت: 102948 - ر.ض: 3004918',
          slogan: s.print_slogan || s.slogan || 'نبني الحاضر لنستثمر المستقبل',
          show_logo: s.print_show_logo !== undefined ? String(s.print_show_logo) : '1',
          show_stamp: s.print_show_stamp !== undefined ? String(s.print_show_stamp) : '1',
          sig1: s.print_sig1 || 'المستلم / المحاسب',
          sig2: s.print_sig2 || 'المدير العام',
          sig3: s.print_sig3 || 'الختم الرسمي',
          border_style: s.print_border_style || 'classic',
          accent_color: s.print_accent_color || '#d4af37',
          footer_notes: s.print_footer_notes || 'تعتبر هذه السندات والوثائق رسمية ولا يعتمد أي كشط أو تعديل بدون ختم الإدارة'
        };

        this._printConfig = cfg;
        localStorage.setItem('rawasi_print_config', JSON.stringify(cfg));

        const setInput = (id, val) => {
          const el = document.getElementById(id);
          if (el && val !== undefined) el.value = val;
        };
        const setCheck = (id, val) => {
          const el = document.getElementById(id);
          if (el) el.checked = (val === '1' || val === true || val === 1);
        };

        setInput('printHeaderTitle', cfg.header_title);
        setInput('printHeaderEn', cfg.header_en);
        setInput('printHeaderSubtitle', cfg.header_subtitle);
        setInput('printTaxNo', cfg.tax_no);
        setInput('printSlogan', cfg.slogan);
        setCheck('printShowLogo', cfg.show_logo);
        setCheck('printShowStamp', cfg.show_stamp);
        setInput('printSig1', cfg.sig1);
        setInput('printSig2', cfg.sig2);
        setInput('printSig3', cfg.sig3);
        setInput('printBorderStyle', cfg.border_style);
        setInput('printAccentColor', cfg.accent_color);
        setInput('printFooterNotes', cfg.footer_notes);

        this.updatePrintPreview();
      }
    } catch (e) {
      console.error('Error loading print settings:', e);
    }
  },

  async savePrintSettings(e) {
    if (e) e.preventDefault();

    const cfg = {
      print_header_title: document.getElementById('printHeaderTitle')?.value || 'شركة رواسي عدن للهندسة والمقاولات',
      print_header_en: document.getElementById('printHeaderEn')?.value || 'Rawasi Aden for Engineering & Contracting',
      print_header_subtitle: document.getElementById('printHeaderSubtitle')?.value || '',
      print_tax_no: document.getElementById('printTaxNo')?.value || '',
      print_slogan: document.getElementById('printSlogan')?.value || '',
      print_show_logo: document.getElementById('printShowLogo')?.checked ? '1' : '0',
      print_show_stamp: document.getElementById('printShowStamp')?.checked ? '1' : '0',
      print_sig1: document.getElementById('printSig1')?.value || 'المستلم / المحاسب',
      print_sig2: document.getElementById('printSig2')?.value || 'المدير العام',
      print_sig3: document.getElementById('printSig3')?.value || 'الختم الرسمي',
      print_border_style: document.getElementById('printBorderStyle')?.value || 'classic',
      print_accent_color: document.getElementById('printAccentColor')?.value || '#d4af37',
      print_footer_notes: document.getElementById('printFooterNotes')?.value || ''
    };

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg)
      });
      const data = await res.json();
      if (data.success) {
        this._printConfig = {
          header_title: cfg.print_header_title,
          header_en: cfg.print_header_en,
          header_subtitle: cfg.print_header_subtitle,
          tax_no: cfg.print_tax_no,
          slogan: cfg.print_slogan,
          show_logo: cfg.print_show_logo,
          show_stamp: cfg.print_show_stamp,
          sig1: cfg.print_sig1,
          sig2: cfg.print_sig2,
          sig3: cfg.print_sig3,
          border_style: cfg.print_border_style,
          accent_color: cfg.print_accent_color,
          footer_notes: cfg.print_footer_notes
        };
        localStorage.setItem('rawasi_print_config', JSON.stringify(this._printConfig));
        this.updatePrintPreview();
        App.showToast('تم حفظ وتطبيق إعدادات ورقة الطباعة بنجاح 🖨️✨', 'success');
      } else {
        App.showToast(data.message || 'خطأ في حفظ الإعدادات', 'error');
      }
    } catch (err) {
      console.error(err);
      App.showToast('تعذر حفظ إعدادات الطباعة', 'error');
    }
  },

  resetDefaultPrintSettings() {
    const defaults = {
      header_title: 'شركة رواسي عدن للهندسة والمقاولات',
      header_en: 'Rawasi Aden for Engineering & Contracting',
      header_subtitle: 'عدن - الجمهورية اليمنية | هاتف: 773413937',
      tax_no: 'س.ت: 102948 - ر.ض: 3004918',
      slogan: 'نبني الحاضر لنستثمر المستقبل',
      show_logo: '1',
      show_stamp: '1',
      sig1: 'المستلم / المحاسب',
      sig2: 'المدير العام',
      sig3: 'الختم الرسمي',
      border_style: 'classic',
      accent_color: '#d4af37',
      footer_notes: 'تعتبر هذه السندات والوثائق رسمية ولا يعتمد أي كشط أو تعديل بدون ختم الإدارة'
    };

    const setInput = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val;
    };
    const setCheck = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.checked = (val === '1');
    };

    setInput('printHeaderTitle', defaults.header_title);
    setInput('printHeaderEn', defaults.header_en);
    setInput('printHeaderSubtitle', defaults.header_subtitle);
    setInput('printTaxNo', defaults.tax_no);
    setInput('printSlogan', defaults.slogan);
    setCheck('printShowLogo', defaults.show_logo);
    setCheck('printShowStamp', defaults.show_stamp);
    setInput('printSig1', defaults.sig1);
    setInput('printSig2', defaults.sig2);
    setInput('printSig3', defaults.sig3);
    setInput('printBorderStyle', defaults.border_style);
    setInput('printAccentColor', defaults.accent_color);
    setInput('printFooterNotes', defaults.footer_notes);

    this.updatePrintPreview();
    App.showToast('تم استعادة الإعدادات الافتراضية، اضغط حفظ للتأكيد', 'info');
  },

  updatePrintPreview() {
    const previewBox = document.getElementById('printLivePreviewBox');
    if (!previewBox) return;

    const title = document.getElementById('printHeaderTitle')?.value || 'شركة رواسي عدن للهندسة والمقاولات';
    const enTitle = document.getElementById('printHeaderEn')?.value || 'Rawasi Aden for Engineering & Contracting';
    const subTitle = document.getElementById('printHeaderSubtitle')?.value || 'عدن - الجمهورية اليمنية | هاتف: 773413937';
    const taxNo = document.getElementById('printTaxNo')?.value || '';
    const slogan = document.getElementById('printSlogan')?.value || '';
    const showLogo = document.getElementById('printShowLogo')?.checked ?? true;
    const showStamp = document.getElementById('printShowStamp')?.checked ?? true;
    const sig1 = document.getElementById('printSig1')?.value || 'المستلم / المحاسب';
    const sig2 = document.getElementById('printSig2')?.value || 'المدير العام';
    const sig3 = document.getElementById('printSig3')?.value || 'الختم الرسمي';
    const borderStyle = document.getElementById('printBorderStyle')?.value || 'classic';
    const accentColor = document.getElementById('printAccentColor')?.value || '#d4af37';
    const footerNotes = document.getElementById('printFooterNotes')?.value || 'تعتبر هذه السندات والوثائق رسمية ولا يعتمد أي كشط أو تعديل بدون ختم الإدارة';

    let borderCss = 'border: 3px double #0f2744;';
    if (borderStyle === 'modern') borderCss = `border: 2px solid ${accentColor};`;
    else if (borderStyle === 'minimal') borderCss = 'border: 1px solid #cbd5e1;';
    else if (borderStyle === 'none') borderCss = 'border: none;';

    previewBox.innerHTML = `
      <div style="direction: rtl; font-family: 'Cairo', 'Tajawal', sans-serif; padding: 18px; ${borderCss} border-radius: 8px; background: #ffffff; color: #111; font-size: 0.82rem;">
        
        <!-- الترويسة -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid ${accentColor}; padding-bottom: 10px; margin-bottom: 12px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            ${showLogo ? '<img src="images/logo.svg" alt="Logo" style="height: 42px; width: 42px; object-fit: contain;">' : ''}
            <div>
              <div style="color: #0f2744; font-weight: 800; font-size: 0.98rem;">${title}</div>
              ${enTitle ? `<div style="font-size: 0.65rem; color: #64748b; font-weight: 600;">${enTitle}</div>` : ''}
              <div style="font-size: 0.7rem; color: #475569; margin-top: 2px;">${subTitle}</div>
              ${taxNo ? `<div style="font-size: 0.65rem; color: #64748b;">${taxNo}</div>` : ''}
            </div>
          </div>
          <div style="text-align: left;">
            <div style="color: ${accentColor}; font-weight: 800; font-size: 1rem;">سند قبض رسمي</div>
            <div style="font-weight: bold; font-size: 0.75rem; color: #0f2744; margin: 2px 0;">رقم السند: RC-2026-0008</div>
            <div style="font-size: 0.7rem; color: #64748b;">التاريخ: 2026-09-07</div>
          </div>
        </div>

        <!-- جسم السند -->
        <table style="width: 100%; font-size: 0.78rem; border-collapse: collapse; margin-bottom: 14px;">
          <tr style="height: 28px;">
            <td style="width: 30%; font-weight: bold; color: #334155;">استلمنا من الأخ/السادة:</td>
            <td style="border-bottom: 1px dashed #94a3b8; font-weight: bold; color: #0f2744;">علوي محمد باعبيد</td>
          </tr>
          <tr style="height: 28px;">
            <td style="font-weight: bold; color: #334155;">مبلغ وقدره:</td>
            <td style="border-bottom: 1px dashed #94a3b8; font-weight: 800; color: #059669; font-size: 0.88rem;">1,000 دولار أمريكي ($)</td>
          </tr>
          <tr style="height: 28px;">
            <td style="font-weight: bold; color: #334155;">المبلغ كتابة:</td>
            <td style="border-bottom: 1px dashed #94a3b8; font-weight: bold; color: #b45309;">فقط ألف دولار أمريكي لا غير</td>
          </tr>
          <tr style="height: 28px;">
            <td style="font-weight: bold; color: #334155;">المشروع التابع له:</td>
            <td style="border-bottom: 1px dashed #94a3b8; color: #1e293b;">مدرسة التواهي النموذجية</td>
          </tr>
          <tr style="height: 28px;">
            <td style="font-weight: bold; color: #334155;">طريقة الدفع وذلك عن:</td>
            <td style="border-bottom: 1px dashed #94a3b8; color: #1e293b;">نقدي - دفعة أعمال مقاولات وهندسة</td>
          </tr>
        </table>

        <!-- التوقيعات -->
        <div style="display: flex; justify-content: space-between; align-items: flex-end; text-align: center; margin-top: 20px; padding: 0 10px;">
          <div>
            <div style="font-weight: bold; font-size: 0.75rem; color: #0f2744; margin-bottom: 24px;">${sig1}</div>
            <div style="color: #94a3b8; font-size: 0.7rem;">...........................</div>
          </div>
          <div>
            <div style="font-weight: bold; font-size: 0.75rem; color: #0f2744; margin-bottom: 24px;">${sig2}</div>
            <div style="color: #94a3b8; font-size: 0.7rem;">...........................</div>
          </div>
          <div>
            <div style="font-weight: bold; font-size: 0.75rem; color: #0f2744; margin-bottom: 6px;">${sig3}</div>
            ${showStamp ? '<div style="width: 50px; height: 50px; border: 1.5px dashed #94a3b8; border-radius: 50%; margin: auto;"></div>' : '<div style="color: #94a3b8; font-size: 0.7rem; margin-top: 20px;">...........................</div>'}
          </div>
        </div>

        ${footerNotes ? `<div style="margin-top: 14px; padding-top: 6px; border-top: 1px solid #e2e8f0; font-size: 0.65rem; color: #64748b; text-align: center;">${footerNotes}</div>` : ''}
      </div>
    `;
  },

  // ================== إدارة المستخدمين والصلاحيات ==================
  async loadUsers() {
    try {
      const res = await fetch('/api/users');
      const json = await res.json();
      if (json.success) {
        this._cachedUsers = json.data || [];
        const tbody = document.getElementById('usersTableBody');
        if (!tbody) return;

        if (this._cachedUsers.length === 0) {
          tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-secondary); padding: 20px;">لا يوجد مستخدمون مسجلون حالياً</td></tr>`;
          return;
        }

        tbody.innerHTML = this._cachedUsers.map(u => {
          // Role badge class
          let roleBadgeClass = 'badge-role-accountant';
          let roleTitle = u.role_name || u.role;
          if (u.role === 'admin') {
            roleBadgeClass = 'badge-role-admin';
            roleTitle = 'المدير العام';
          } else if (u.role === 'accountant') {
            roleBadgeClass = 'badge-role-accountant';
            roleTitle = 'المحاسب المالي';
          } else if (u.role === 'project_manager') {
            roleBadgeClass = 'badge-role-pm';
            roleTitle = 'مهندس المشاريع';
          } else if (u.role === 'storekeeper') {
            roleBadgeClass = 'badge-role-storekeeper';
            roleTitle = 'أمين المخزن';
          }

          // Permissions summary
          const perms = u.permissions_list || [];
          let permsHtml = '';
          if (u.role === 'admin' || perms.includes('all') || perms.length >= 18) {
            permsHtml = `<span class="badge badge-role-admin">كافة الصلاحيات (شامل)</span>`;
          } else if (perms.length === 0) {
            permsHtml = `<span class="badge" style="background: rgba(255,255,255,0.06); color: var(--text-secondary);">صلاحيات افتراضية (${roleTitle})</span>`;
          } else {
            permsHtml = `<span class="badge badge-active" title="${perms.join(', ')}">${perms.length} صلاحية مخصصة</span>`;
          }

          // Status Badge
          const isActive = u.status === 'active';
          const statusBadge = isActive
            ? `<span class="badge-status-active">نشط</span>`
            : `<span class="badge-status-inactive">معطل</span>`;

          const isRootAdmin = u.username === 'admin' || u.id === 1;

          return `
            <tr>
              <td>
                <div style="font-weight: 700; color: var(--gold-light); font-size: 0.9rem;">${u.username}</div>
                <div style="font-size: 0.72rem; color: var(--text-secondary);">ID: #${u.id}</div>
              </td>
              <td><strong>${u.full_name}</strong></td>
              <td><span class="badge ${roleBadgeClass}">${roleTitle}</span></td>
              <td>
                <div style="font-size: 0.82rem;">${u.phone || '-'}</div>
                ${u.email ? `<div style="font-size: 0.72rem; color: var(--text-secondary);">${u.email}</div>` : ''}
              </td>
              <td>${permsHtml}</td>
              <td>${statusBadge}</td>
              <td>
                <div style="display: flex; gap: 6px; align-items: center;">
                  <button type="button" class="btn btn-secondary btn-sm" onclick="Settings.openEditUserModal(${u.id})" title="تعديل المستخدم والصلاحيات">
                    ✏️ تعديل
                  </button>
                  <button type="button" class="btn btn-secondary btn-sm" onclick="Settings.toggleUserStatus(${u.id})" title="${isActive ? 'تعطيل الحساب' : 'تفعيل الحساب'}" ${isRootAdmin ? 'disabled style="opacity:0.4;"' : ''}>
                    ${isActive ? '⏸️ تعطيل' : '▶️ تنشيط'}
                  </button>
                  ${!isRootAdmin ? `
                    <button type="button" class="btn btn-secondary btn-sm" style="color: var(--accent-red); border-color: rgba(239,68,68,0.3);" onclick="Settings.deleteUser(${u.id}, '${u.username}')" title="حذف المستخدم">
                      🗑️
                    </button>
                  ` : ''}
                </div>
              </td>
            </tr>
          `;
        }).join('');
      }
    } catch (e) {
      console.error('Error loading users:', e);
    }
  },

  // ================== نافذة إضافة مستخدم جديد ==================
  openNewUserModal() {
    const titleEl = document.getElementById('userModalTitle');
    if (titleEl) titleEl.textContent = 'إضافة مستخدم جديد وتحديد الصلاحيات';

    document.getElementById('userIdVal').value = '';
    document.getElementById('userNameVal').value = '';
    document.getElementById('userUsernameVal').value = '';
    
    const pwdInput = document.getElementById('userPasswordVal');
    if (pwdInput) {
      pwdInput.value = '';
      pwdInput.required = true;
      pwdInput.placeholder = 'كلمة المرور (6 خانات على الأقل)';
    }

    const pwdHint = document.getElementById('userPasswordHint');
    if (pwdHint) pwdHint.style.display = 'none';

    document.getElementById('userPhoneVal').value = '';
    document.getElementById('userEmailVal').value = '';
    document.getElementById('userStatusVal').value = 'active';

    const roleSelect = document.getElementById('userRoleVal');
    if (roleSelect) {
      roleSelect.value = 'accountant';
      this.applyRolePermissionsPreset('accountant');
    }

    App.openModal('newUserModal');
  },

  // ================== نافذة تعديل مستخدم ==================
  openEditUserModal(userId) {
    const user = this._cachedUsers.find(u => u.id === userId);
    if (!user) {
      App.showToast('لم يتم العثور على بيانات المستخدم', 'error');
      return;
    }

    const titleEl = document.getElementById('userModalTitle');
    if (titleEl) titleEl.textContent = `تعديل بيانات وصلاحيات المستخدم (${user.full_name})`;

    document.getElementById('userIdVal').value = user.id;
    document.getElementById('userNameVal').value = user.full_name || '';
    document.getElementById('userUsernameVal').value = user.username || '';

    const pwdInput = document.getElementById('userPasswordVal');
    if (pwdInput) {
      pwdInput.value = '';
      pwdInput.required = false;
      pwdInput.placeholder = 'اتركه فارغاً للاحتفاظ بكلمة المرور الحالية';
    }

    const pwdHint = document.getElementById('userPasswordHint');
    if (pwdHint) pwdHint.style.display = 'block';

    document.getElementById('userPhoneVal').value = user.phone || '';
    document.getElementById('userEmailVal').value = user.email || '';
    document.getElementById('userStatusVal').value = user.status || 'active';

    const roleSelect = document.getElementById('userRoleVal');
    if (roleSelect) {
      roleSelect.value = user.role || 'custom';
    }

    // Uncheck all checkboxes first
    this.selectAllPermissions(false);

    // Check user's assigned permissions
    const perms = user.permissions_list || [];
    if (user.role === 'admin' || perms.includes('all')) {
      this.selectAllPermissions(true);
    } else if (perms.length > 0) {
      perms.forEach(p => {
        const chk = document.querySelector(`.perm-chk[value="${p}"]`);
        if (chk) chk.checked = true;
      });
    } else {
      // If no custom perms, apply role default
      this.applyRolePermissionsPreset(user.role || 'accountant');
    }

    App.openModal('newUserModal');
  },

  // ================== تطبيق قوالب الصلاحيات التلقائية ==================
  onRoleChange() {
    const role = document.getElementById('userRoleVal')?.value;
    if (role && role !== 'custom') {
      this.applyRolePermissionsPreset(role);
    }
  },

  applyRolePermissionsPreset(role) {
    this.selectAllPermissions(false);

    let permsToSelect = [];

    switch (role) {
      case 'admin':
        this.selectAllPermissions(true);
        return;
      case 'accountant':
        permsToSelect = [
          'dashboard:view',
          'revenues:view', 'revenues:create', 'revenues:print',
          'expenses:view', 'expenses:create',
          'custody:view', 'custody:manage',
          'clients:view', 'clients:manage', 'clients:statement',
          'suppliers:view', 'suppliers:manage', 'suppliers:statement',
          'cash:view',
          'reports:view'
        ];
        break;
      case 'project_manager':
        permsToSelect = [
          'dashboard:view',
          'projects:view', 'projects:manage', 'projects:print',
          'expenses:view', 'expenses:create',
          'custody:view',
          'inventory:view', 'inventory:issue',
          'reports:view'
        ];
        break;
      case 'storekeeper':
        permsToSelect = [
          'inventory:view', 'inventory:manage', 'inventory:issue',
          'projects:view'
        ];
        break;
      default:
        return;
    }

    permsToSelect.forEach(val => {
      const chk = document.querySelector(`.perm-chk[value="${val}"]`);
      if (chk) chk.checked = true;
    });
  },

  selectAllPermissions(select) {
    document.querySelectorAll('.perm-chk').forEach(chk => {
      chk.checked = !!select;
    });
  },

  // ================== حفظ المستخدم والصلاحيات ==================
  async submitUserForm(e) {
    if (e) e.preventDefault();

    const id = document.getElementById('userIdVal')?.value;
    const full_name = document.getElementById('userNameVal')?.value?.trim();
    const username = document.getElementById('userUsernameVal')?.value?.trim();
    const password = document.getElementById('userPasswordVal')?.value;
    const role = document.getElementById('userRoleVal')?.value;
    const phone = document.getElementById('userPhoneVal')?.value?.trim();
    const email = document.getElementById('userEmailVal')?.value?.trim();
    const status = document.getElementById('userStatusVal')?.value || 'active';

    if (!full_name || !username) {
      App.showToast('يرجى ملء الاسم الكامل واسم المستخدم', 'error');
      return;
    }

    if (!id && (!password || password.length < 4)) {
      App.showToast('يرجى إدخال كلمة مرور مناسبة (4 خانات على الأقل)', 'error');
      return;
    }

    // Gather checked permissions
    const checkedPerms = Array.from(document.querySelectorAll('.perm-chk:checked')).map(c => c.value);

    const payload = {
      full_name,
      username,
      role,
      phone,
      email,
      status,
      permissions: checkedPerms
    };

    if (password && password.trim().length > 0) {
      payload.password = password;
    }

    const saveBtn = document.getElementById('btnSaveUser');
    const originalBtnText = saveBtn ? saveBtn.innerHTML : 'حفظ';
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<span>⏳</span> جاري الحفظ والتحقق من قاعدة البيانات...';
    }

    try {
      const url = id ? `/api/users/${id}` : '/api/users';
      const method = id ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok && data.success) {
        App.showToast(data.message || 'تم حفظ المستخدم وتعيين الصلاحيات بنجاح!', 'success');
        App.closeModal('newUserModal');
        await this.loadUsers();
      } else {
        App.showToast(data.message || 'حدث خطأ أثناء حفظ المستخدم', 'error');
      }
    } catch (err) {
      console.error('Error saving user:', err);
      App.showToast('تعذر الاتصال بالخادم لحفظ المستخدم', 'error');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = originalBtnText;
      }
    }
  },

  // ================== تبديل حالة المستخدم ==================
  async toggleUserStatus(userId) {
    try {
      const res = await fetch(`/api/users/${userId}/status`, {
        method: 'PATCH'
      });
      const data = await res.json();
      if (res.ok && data.success) {
        App.showToast(data.message, 'success');
        await this.loadUsers();
      } else {
        App.showToast(data.message || 'تعذر تغيير حالة الحساب', 'error');
      }
    } catch (e) {
      App.showToast('خطأ في الاتصال بالخادم', 'error');
    }
  },

  // ================== حذف مستخدم ==================
  async deleteUser(userId, username) {
    if (!confirm(`هل أنت متأكد من حذف المستخدم (${username}) نهائياً من النظام؟`)) {
      return;
    }

    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (res.ok && data.success) {
        App.showToast(data.message, 'success');
        await this.loadUsers();
      } else {
        App.showToast(data.message || 'تعذر حذف المستخدم', 'error');
      }
    } catch (e) {
      App.showToast('خطأ في الاتصال بالخادم', 'error');
    }
  },

  // ================== تنزيل نسخة احتياطية ==================
  async downloadBackup() {
    try {
      App.showToast('جاري تحضير وتنزيل النسخة الاحتياطية لقاعدة البيانات...', 'info');
      window.location.href = '/api/settings/backup';
    } catch (e) {
      App.showToast('خطأ في تنزيل النسخة الاحتياطية', 'error');
    }
  },

  // ================== استعادة النسخ الاحتياطية ==================
  openRestoreModal() {
    this._selectedBackupFile = null;
    this._selectedServerBackupName = null;

    const fileInput = document.getElementById('backupFileInput');
    if (fileInput) fileInput.value = '';

    const dropzoneText = document.getElementById('selectedBackupFileName');
    if (dropzoneText) dropzoneText.textContent = 'أو اسحب وأفلت الملف هنا';

    const confirmBtn = document.getElementById('btnConfirmRestore');
    if (confirmBtn) confirmBtn.disabled = true;

    App.openModal('restoreBackupModal');
    this.loadServerBackups();
  },

  handleFileSelected(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.db') && !file.name.endsWith('.sqlite')) {
      App.showToast('يرجى اختيار ملف قاعدة بيانات صالح بصيغة (.db أو .sqlite)', 'error');
      return;
    }

    this._selectedBackupFile = file;
    this._selectedServerBackupName = null;

    const dropzoneText = document.getElementById('selectedBackupFileName');
    if (dropzoneText) {
      const sizeKB = (file.size / 1024).toFixed(1);
      dropzoneText.innerHTML = `<strong style="color: var(--gold-light);">الملف المحدد:</strong> ${file.name} (${sizeKB} KB)`;
    }

    const confirmBtn = document.getElementById('btnConfirmRestore');
    if (confirmBtn) confirmBtn.disabled = false;
  },

  selectServerBackup(fileName) {
    this._selectedServerBackupName = fileName;
    this._selectedBackupFile = null;

    const fileInput = document.getElementById('backupFileInput');
    if (fileInput) fileInput.value = '';

    const dropzoneText = document.getElementById('selectedBackupFileName');
    if (dropzoneText) {
      dropzoneText.innerHTML = `<strong style="color: var(--accent-blue);">تم اختيار نسخة من الخادم:</strong> ${fileName}`;
    }

    const confirmBtn = document.getElementById('btnConfirmRestore');
    if (confirmBtn) confirmBtn.disabled = false;

    App.showToast(`تم اختيار النسخة: ${fileName}`, 'info');
  },

  async loadServerBackups() {
    try {
      const res = await fetch('/api/settings/backups');
      const json = await res.json();
      const container = document.getElementById('serverBackupsList');
      const section = document.getElementById('serverBackupsSection');
      if (container && section) {
        if (json.success && json.data && json.data.length > 0) {
          section.style.display = 'block';
          container.innerHTML = json.data.map(b => {
            const dateStr = new Date(b.createdAt).toLocaleString('ar-YE');
            const sizeKB = (b.size / 1024).toFixed(1);
            return `
              <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-light);">
                <div>
                  <div style="font-size: 0.85rem; font-weight: 600; color: var(--gold-light);">${b.fileName}</div>
                  <div style="font-size: 0.75rem; color: var(--text-secondary);">${dateStr} | ${sizeKB} KB</div>
                </div>
                <button type="button" class="btn btn-secondary btn-sm" onclick="Settings.selectServerBackup('${b.fileName}')">
                  اختيار هذه النسخة
                </button>
              </div>
            `;
          }).join('');
        } else {
          section.style.display = 'none';
        }
      }
    } catch (e) {
      console.error('Error loading backups:', e);
    }
  },

  async executeRestore() {
    const confirmBtn = document.getElementById('btnConfirmRestore');
    if (!this._selectedBackupFile && !this._selectedServerBackupName) {
      App.showToast('يرجى اختيار ملف النسخة الاحتياطية أولاً', 'error');
      return;
    }

    const targetName = this._selectedBackupFile ? this._selectedBackupFile.name : this._selectedServerBackupName;
    if (!confirm(`هل أنت متأكد تماماً من استعادة النسخة الاحتياطية (${targetName})؟\n\nتنبيه: سيتم استبدال كافة البيانات الحالية ببيانات النسخة المحددة.`)) {
      return;
    }

    const originalBtnHtml = confirmBtn ? confirmBtn.innerHTML : 'بدء الاستعادة والتأكيد';
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.innerHTML = '<span>⏳</span> جاري استعادة قاعدة البيانات والتحقق...';
    }

    try {
      let res;
      if (this._selectedBackupFile) {
        res = await fetch('/api/settings/restore-upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream',
            'X-Filename': encodeURIComponent(this._selectedBackupFile.name)
          },
          body: this._selectedBackupFile
        });
      } else {
        res = await fetch('/api/settings/restore-local', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName: this._selectedServerBackupName })
        });
      }

      const data = await res.json();
      if (res.ok && data.success) {
        App.showToast(data.message || 'تمت استعادة قاعدة البيانات بنجاح! جاري تحديث الصفحة...', 'success');
        App.closeModal('restoreBackupModal');
        setTimeout(() => {
          window.location.reload();
        }, 1800);
      } else {
        App.showToast(data.message || 'فشلت عملية استعادة النسخة الاحتياطية', 'error');
      }
    } catch (e) {
      console.error('Restore error:', e);
      App.showToast('فشل الاتصال بالخادم أثناء استعادة النسخة الاحتياطية', 'error');
    } finally {
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = originalBtnHtml;
      }
    }
  },

  // ================== إدارة الربط السحابي وقاعدة البيانات ==================
  async loadDbConfig() {
    try {
      const res = await fetch('/api/settings/db-status');
      const json = await res.json();
      if (json && json.success) {
        const d = json.data;
        const modeEl = document.getElementById('cfgDbMode');
        const urlEl = document.getElementById('cfgOnlineUrl');
        const statusBox = document.getElementById('dbConfigStatusBox');

        if (modeEl && d.mode) modeEl.value = d.mode;
        if (urlEl) urlEl.value = d.rawOnlineUrl || '';

        if (statusBox) {
          const badgeClass = d.isOnline ? 'badge-active' : 'badge-warning';
          const badgeText = d.isOnline ? '🟢 أونلاين (سحابي متصل)' : '🟠 أوفلاين (محلي نشط)';
          statusBox.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; flex-wrap: wrap; gap: 8px;">
              <span>حالة الاتصال الحالية: <strong class="badge ${badgeClass}">${badgeText}</strong></span>
              <span>زمن الاستجابة: <strong>${d.latencyMs || 0} ms</strong></span>
            </div>
            <div style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.4;">${d.statusMessage}</div>
          `;
        }
      }
    } catch (e) {
      console.error('Error loading db config:', e);
    }
  },

  async testOnlineDb() {
    const urlInput = document.getElementById('cfgOnlineUrl');
    const resultBox = document.getElementById('onlineDbTestResult');
    const btn = document.getElementById('btnTestOnlineDb');
    const testUrl = urlInput ? urlInput.value.trim() : '';

    if (!testUrl) {
      App.showToast('يرجى إدخال رابط السيرفر/قاعدة البيانات السحابية للاختبار أولاً', 'warning');
      if (urlInput) urlInput.focus();
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = 'جاري الفحص والتحقق... ⏳';
    }
    if (resultBox) {
      resultBox.style.display = 'block';
      resultBox.innerHTML = '<span style="color: var(--text-secondary);">جاري إرسال إشارة الفحص والتحقق من الاستجابة...</span>';
    }

    try {
      const res = await fetch('/api/settings/test-online-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: testUrl })
      });
      const json = await res.json();
      const d = json.data || {};

      if (json.success && d.isOnline) {
        App.showToast('تم التحقق بنجاح! السيرفر السحابي متصل ومستجيب 🟢', 'success');
        if (resultBox) {
          resultBox.innerHTML = `
            <div style="color: var(--accent-green); font-weight: 700; margin-bottom: 4px;">✅ تم الاتصال بنجاح (${d.latencyMs} ms)</div>
            <div style="font-size: 0.82rem; color: var(--text-secondary);">${d.message}</div>
          `;
        }
      } else {
        App.showToast('تعذر الاتصال بالسيرفر السحابي، التحويل التلقائي للقاعدة المحلية نشط 🟠', 'warning');
        if (resultBox) {
          resultBox.innerHTML = `
            <div style="color: var(--accent-red); font-weight: 700; margin-bottom: 4px;">⚠️ تعذر الاتصال بالسيرفر السحابي</div>
            <div style="font-size: 0.82rem; color: var(--text-secondary);">${d.message || json.message}</div>
          `;
        }
      }
    } catch (e) {
      if (resultBox) {
        resultBox.innerHTML = `<div style="color: var(--accent-red);">خطأ أثناء محاولة الفحص: ${e.message}</div>`;
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = 'فحص الاتصال والتحقق الآن 🔍';
      }
    }
  },

  async saveDbConfig(e) {
    if (e) e.preventDefault();
    const mode = document.getElementById('cfgDbMode')?.value || 'auto';
    const onlineUrl = document.getElementById('cfgOnlineUrl')?.value || '';

    try {
      const res = await fetch('/api/settings/update-db-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, onlineUrl })
      });
      const json = await res.json();
      if (json.success) {
        App.showToast('تم حفظ إعدادات الاتصال وتحديث وضع العمل بنجاح ✅', 'success');
        await this.loadDbConfig();
        if (typeof App !== 'undefined' && App.checkDatabaseStatus) {
          await App.checkDatabaseStatus();
        }
      } else {
        App.showToast('تعذر حفظ إعدادات الاتصال: ' + json.message, 'error');
      }
    } catch (err) {
      App.showToast('خطأ أثناء حفظ الإعدادات: ' + err.message, 'error');
    }
  },

  // ================== نسخ الخروج الاحتياطية التلقائية ==================
  async loadLogoutBackups() {
    try {
      const res = await fetch('/api/settings/logout-backups');
      const json = await res.json();
      const tbody = document.getElementById('logoutBackupsTableBody');
      if (!tbody) return;

      if (json.success && json.data && json.data.length > 0) {
        tbody.innerHTML = json.data.map(b => {
          const sizeKB = (b.size / 1024).toFixed(1);
          const modeBadge = b.mode === 'online' 
            ? '<span class="badge badge-active" style="font-size: 0.72rem;">أونلاين سحابي</span>'
            : '<span class="badge badge-warning" style="font-size: 0.72rem;">أوفلاين محلي</span>';

          return `
            <tr>
              <td>
                <div style="font-weight: 700; color: var(--gold-light); font-size: 0.85rem;">${b.fileName}</div>
                <small style="color: var(--text-secondary);">${b.notes || '-'}</small>
              </td>
              <td><span class="badge badge-secondary">${b.username || 'مستخدم'}</span></td>
              <td>${b.displayTime || b.timestamp}</td>
              <td>${sizeKB} KB</td>
              <td>${modeBadge}</td>
              <td style="text-align: center;">
                <button type="button" class="btn btn-secondary btn-sm" onclick="Settings.confirmRestoreLogoutBackup('${b.fileName}')" title="استعادة هذه النقطة الزمنية">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="vertical-align: middle;"><path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/></svg>
                  <span>استعادة</span>
                </button>
              </td>
            </tr>
          `;
        }).join('');
      } else {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" style="text-align: center; padding: 25px; color: var(--text-secondary);">
              لم يتم تسجيل أي نسخ خروج تلقائية بعد. سيقوم النظام بإنشاء نسخة فورية عند كل تسجيل خروج للمستخدم لحفظ آخر التعديلات.
            </td>
          </tr>
        `;
      }
    } catch (e) {
      console.error('Error loading logout backups:', e);
    }
  },

  confirmRestoreLogoutBackup(fileName) {
    if (!confirm(`هل ترغب في استعادة النسخة الاحتياطية (${fileName})؟\n\nستتم إعادة المشروع تماماً إلى اللحظة التي تم فيها تسجيل الخروج وحفظ تلك النسخة.`)) {
      return;
    }
    this.selectServerBackup(fileName);
    this.executeRestore();
  }
};
