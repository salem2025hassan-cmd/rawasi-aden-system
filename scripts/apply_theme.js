const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, '../css/style.css');
let css = fs.readFileSync(cssPath, 'utf8');

// 1. استبدال :root الأساسي في بداية الملف
const oldRootRegex = /:root\s*\{[\s\S]*?--transition:[^;]+;\s*\}/;
const newRoot = `:root {
  /* لوحة الألوان الفاخرة - الأبيض والبيج الرسمي لشركة رواسي عدن */
  --bg-main: #f8f6f0;
  --bg-surface: #ffffff;
  --bg-card: #ffffff;
  --bg-card-hover: #faf7f2;
  --border-color: #dfd4c0;
  --border-light: #eee6d8;

  /* الألوان المميزة (Gold & Accents) */
  --gold-primary: #b89355;
  --gold-light: #c8a86b;
  --gold-dark: #967439;
  --gold-glow: rgba(184, 147, 85, 0.18);

  --accent-blue: #7c684d;
  --accent-green: #2e7d32;
  --accent-green-bg: #edf7ee;
  --accent-red: #c62828;
  --accent-red-bg: #fdebee;
  --accent-amber: #b8860b;

  /* النصوص */
  --text-primary: #2d251a;
  --text-secondary: #6e6252;
  --text-muted: #9a8e7e;
  --text-gold: #967439;

  /* الظلال والانتقالات */
  --shadow-sm: 0 2px 6px rgba(73, 57, 35, 0.06);
  --shadow-md: 0 4px 14px rgba(73, 57, 35, 0.09);
  --shadow-lg: 0 10px 28px rgba(73, 57, 35, 0.12);
  --shadow-gold: 0 4px 15px rgba(184, 147, 85, 0.22);
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}`;

if (oldRootRegex.test(css)) {
  css = css.replace(oldRootRegex, newRoot);
}

// 2. تحديث الرأس والقائمة الجانبية والكروت لتطبيق الأبيض والبيج مباشرة وبشكل متكامل
const themeOverrides = `

/* ==========================================================================
   هوية رواسي عدن - الواجهة الفاخرة باللون الأبيض والبيج (White & Beige Theme)
   ========================================================================== */
body {
  background-color: var(--bg-main) !important;
  color: var(--text-primary) !important;
}

.app-header {
  background: #ffffff !important;
  border-bottom: 1px solid var(--border-color) !important;
  box-shadow: var(--shadow-sm) !important;
}

.brand-title-group h1 {
  color: var(--text-primary) !important;
}

.brand-title-group p {
  color: var(--gold-dark) !important;
}

.sidebar {
  background: #ffffff !important;
  border-left: 1px solid var(--border-color) !important;
  box-shadow: var(--shadow-md) !important;
}

.sidebar-logo-card {
  background: linear-gradient(145deg, #ffffff, #f7f2e7) !important;
  border: 1px solid var(--border-color) !important;
}

.sidebar-logo-card h3 {
  color: var(--text-primary) !important;
}

.sidebar-logo-card span {
  color: var(--gold-dark) !important;
}

.nav-item {
  color: var(--text-secondary) !important;
}

.nav-item:hover {
  background: #f7f1e7 !important;
  color: var(--gold-dark) !important;
}

.nav-item.active {
  background: linear-gradient(90deg, #efe2ca, #e3cfab) !important;
  color: #4a3924 !important;
  font-weight: 800 !important;
  box-shadow: inset -3px 0 0 var(--gold-primary) !important;
}

.nav-item.active svg {
  fill: #4a3924 !important;
}

.page-title {
  color: var(--text-primary) !important;
}

.panel-card,
.quick-form-card,
.stat-card,
.dashboard-card,
.modal-content,
.kpi-card {
  background: #ffffff !important;
  border-color: var(--border-color) !important;
  box-shadow: var(--shadow-sm) !important;
  color: var(--text-primary) !important;
}

.kpi-value {
  color: var(--text-primary) !important;
}

.panel-title, h1, h2, h3, h4, h5, h6 {
  color: var(--text-primary) !important;
}

.form-control {
  background: #ffffff !important;
  color: var(--text-primary) !important;
  border: 1px solid #d9ccb6 !important;
}

.form-control::placeholder {
  color: #aaa092 !important;
}

.form-control:focus {
  border-color: var(--gold-primary) !important;
  box-shadow: 0 0 0 2px var(--gold-glow) !important;
}

.custom-table {
  background: #ffffff !important;
}

.custom-table thead {
  background: #f3ecdf !important;
}

.custom-table th {
  color: #4a3c2a !important;
  border-bottom: 1px solid #d9ccb6 !important;
}

.custom-table td {
  color: var(--text-primary) !important;
  border-bottom: 1px solid var(--border-light) !important;
}

.custom-table tr:hover td {
  background: #faf7f0 !important;
}

.btn-primary {
  background: linear-gradient(135deg, #c8a86b, #b89355) !important;
  border-color: #b89355 !important;
  color: #ffffff !important;
}

.btn-secondary {
  background: #f5efe5 !important;
  border: 1px solid #d8c9b0 !important;
  color: #5b4c38 !important;
}

.btn-secondary:hover {
  background: #ece1ce !important;
  color: #433626 !important;
}

.notifications-dropdown {
  background: #ffffff !important;
  border: 1px solid var(--border-color) !important;
  box-shadow: var(--shadow-lg) !important;
  color: var(--text-primary) !important;
}

.notif-dropdown-header {
  background: #f8f5ee !important;
  border-bottom: 1px solid var(--border-color) !important;
}

.notif-dropdown-footer {
  background: #f8f5ee !important;
  border-top: 1px solid var(--border-color) !important;
}

.notif-conn-card.status-offline {
  background: #fbf6f6 !important;
  border: 1px solid #f2c7c7 !important;
}

.notif-conn-card.status-online {
  background: #f4fbf5 !important;
  border: 1px solid #c3e6cb !important;
}

.user-badge, .icon-btn {
  background: #ffffff !important;
  border: 1px solid var(--border-color) !important;
  color: var(--text-primary) !important;
}

.modal-header {
  background: #f8f5ee !important;
  border-bottom: 1px solid var(--border-color) !important;
}

.modal-footer {
  background: #f8f5ee !important;
  border-top: 1px solid var(--border-color) !important;
}
`;

// إلحاق التنسيقات الفاخرة لضمان أولوية التطبيق
css += themeOverrides;

fs.writeFileSync(cssPath, css, 'utf8');
fs.writeFileSync(path.join(__dirname, '../www/css/style.css'), css, 'utf8');
if (fs.existsSync('C:/Users/user/Desktop/مجلد جديد (10)/css/style.css')) {
  fs.writeFileSync('C:/Users/user/Desktop/مجلد جديد (10)/css/style.css', css, 'utf8');
  fs.writeFileSync('C:/Users/user/Desktop/مجلد جديد (10)/www/css/style.css', css, 'utf8');
}

console.log('White & Beige Theme applied successfully across all CSS files!');
