/**
 * WorkIndex — Service Category & Questionnaire Configuration
 * ============================================================
 * All service definitions, colors, labels, and questionnaire
 * steps live here. Edit this file to add/modify services.
 * 
 * This file is loaded by index.html before app.js.
 * Usage in app.js: WI_SERVICES.labels, WI_SERVICES.colors, etc.
 */

const WI_SERVICES = {

  // ─── Master list of all service categories ───────────────
  list: [
    { value: 'itr',         label: 'ITR Filing',    icon: '📄', color: '#8b5cf6' },
    { value: 'gst',         label: 'GST Services',  icon: '🧾', color: '#3b82f6' },
    { value: 'accounting',  label: 'Accounting',    icon: '📊', color: '#10b981' },
    { value: 'audit',       label: 'Audit',         icon: '🔍', color: '#f59e0b' },
    { value: 'photography', label: 'Photography',   icon: '📷', color: '#ec4899' },
    { value: 'development', label: 'Development',   icon: '💻', color: '#06b6d4' },
  ],

  // ─── Quick lookup maps (auto-generated from list above) ──
  get labels() {
    const m = {};
    this.list.forEach(s => m[s.value] = s.label);
    return m;
  },
  get colors() {
    const m = {};
    this.list.forEach(s => m[s.value] = s.color);
    return m;
  },
  get icons() {
    const m = {};
    this.list.forEach(s => m[s.value] = s.icon);
    return m;
  },

  // ─── Landing page search aliases ─────────────────────────
  // Maps user-typed words to a service value
  searchAliases: {
    'itr':          'itr',
    'itr filing':   'itr',
    'income tax':   'itr',
    'tax':          'itr',
    'gst':          'gst',
    'gst services': 'gst',
    'accounting':   'accounting',
    'bookkeeping':  'accounting',
    'audit':        'audit',
    'photography':  'photography',
    'photo':        'photography',
    'development':  'development',
    'dev':          'development',
    'web':          'development',
    'website':      'development',
  },

  // ─── Questionnaire steps per service ─────────────────────
  questionnaire: {

    itr: [
      {
        id:       'itrTaxpayerType',
        question: 'What is your taxpayer type?',
        type:     'radio',
        required: true,
        options: [
          { value: 'salaried',   label: '💼 Salaried Employee' },
          { value: 'business',   label: '🏢 Business Owner / Self-Employed' },
          { value: 'freelancer', label: '💻 Freelancer / Consultant' },
          { value: 'nri',        label: '🌍 NRI (Non-Resident Indian)' },
        ],
      },
      {
        id:       'itrAnnualIncome',
        question: 'What is your approximate annual income?',
        type:     'radio',
        required: true,
        options: [
          { value: 'below5L',  label: 'Below ₹5 Lakhs' },
          { value: '5L-10L',   label: '₹5 – ₹10 Lakhs' },
          { value: '10L-20L',  label: '₹10 – ₹20 Lakhs' },
          { value: 'above20L', label: 'Above ₹20 Lakhs' },
        ],
      },
      {
        id:       'itrIncomeSources',
        question: 'Select all your income sources',
        type:     'checkbox',
        required: true,
        options: [
          { value: 'salary',        label: '💼 Salary / Pension' },
          { value: 'rental',        label: '🏠 Rental Income' },
          { value: 'capital_gains', label: '📈 Capital Gains (Stocks / MF / Property)' },
          { value: 'business',      label: '🏢 Business Income' },
          { value: 'freelance',     label: '💻 Freelance / Consulting' },
          { value: 'foreign',       label: '🌍 Foreign / NRI Income' },
          { value: 'other',         label: '📋 Other Sources' },
        ],
      },
      {
        id:       'itrUrgency',
        question: 'When do you need it filed?',
        type:     'radio',
        required: true,
        alias:    'urgency',
        options: [
          { value: 'immediate', label: '🔴 Immediately (within 24 hours)' },
          { value: '2-3days',   label: '🟠 Within 2–3 days' },
          { value: 'week',      label: '🟡 Within a week' },
          { value: 'flexible',  label: '🔵 Flexible / Before deadline' },
        ],
      },
    ],

    gst: [
      {
        id:       'gstServiceType',
        question: 'What GST service do you need?',
        type:     'radio',
        required: true,
        options: [
          { value: 'new_registration', label: '📋 New GST Registration' },
          { value: 'monthly_filing',   label: '📊 Monthly GSTR Filing' },
          { value: 'annual_return',    label: '📁 Annual GST Return (GSTR-9)' },
          { value: 'notice_handling',  label: '⚠️ GST Notice / Scrutiny' },
          { value: 'itc_reconciliation', label: '🔁 ITC Reconciliation' },
          { value: 'consultation',     label: '💬 GST Consultation' },
        ],
      },
      {
        id:       'gstTurnover',
        question: 'What is your monthly business turnover?',
        type:     'radio',
        required: true,
        options: [
          { value: 'below5L',    label: 'Below ₹5 Lakhs' },
          { value: '5L-20L',     label: '₹5 – ₹20 Lakhs' },
          { value: '20L-50L',    label: '₹20 – ₹50 Lakhs' },
          { value: 'above50L',   label: 'Above ₹50 Lakhs' },
        ],
      },
      {
        id:       'gstBusinessType',
        question: 'Type of business',
        type:     'radio',
        required: true,
        options: [
          { value: 'trader',      label: '🏪 Trader / Retailer' },
          { value: 'manufacturer',label: '🏭 Manufacturer' },
          { value: 'services',    label: '💼 Service Provider' },
          { value: 'ecommerce',   label: '🛒 E-Commerce / Online Seller' },
          { value: 'exporter',    label: '🚢 Exporter / Importer' },
        ],
      },
      {
        id:       'gstUrgency',
        question: 'When do you need this?',
        type:     'radio',
        required: true,
        alias:    'urgency',
        options: [
          { value: 'immediate', label: '🔴 Immediately' },
          { value: '2-3days',   label: '🟠 Within 2–3 days' },
          { value: 'week',      label: '🟡 This week' },
          { value: 'flexible',  label: '🔵 Flexible' },
        ],
      },
    ],

    accounting: [
      {
        id:       'accountingServiceType',
        question: 'What accounting service do you need?',
        type:     'radio',
        required: true,
        options: [
          { value: 'bookkeeping',       label: '📚 Monthly Bookkeeping' },
          { value: 'payroll',           label: '👥 Payroll Processing' },
          { value: 'annual_accounts',   label: '📋 Annual Accounts Preparation' },
          { value: 'tds_filing',        label: '📄 TDS Filing' },
          { value: 'consultation',      label: '💬 Accounting Consultation' },
        ],
      },
      {
        id:       'accountingFrequency',
        question: 'How often do you need accounting support?',
        type:     'radio',
        required: true,
        options: [
          { value: 'monthly',     label: '📅 Monthly (ongoing)' },
          { value: 'quarterly',   label: '🗓️ Quarterly' },
          { value: 'annual',      label: '📆 One-time / Annual' },
          { value: 'as-needed',   label: '🔄 As needed' },
        ],
      },
      {
        id:       'accountingTransactions',
        question: 'How many transactions per month approximately?',
        type:     'radio',
        required: true,
        options: [
          { value: 'below50',    label: 'Below 50' },
          { value: '50-200',     label: '50 – 200' },
          { value: '200-500',    label: '200 – 500' },
          { value: 'above500',   label: 'Above 500' },
        ],
      },
      {
        id:       'accountingSoftware',
        question: 'Which accounting software do you use?',
        type:     'radio',
        required: false,
        options: [
          { value: 'tally',     label: 'Tally' },
          { value: 'zoho',      label: 'Zoho Books' },
          { value: 'quickbooks',label: 'QuickBooks' },
          { value: 'excel',     label: 'Excel / Manual' },
          { value: 'none',      label: 'None / Open to suggestion' },
        ],
      },
    ],

    audit: [
      {
        id:       'auditType',
        question: 'What type of audit do you need?',
        type:     'radio',
        required: true,
        options: [
          { value: 'statutory_audit',  label: '📋 Statutory Audit' },
          { value: 'tax_audit',        label: '📄 Tax Audit (Section 44AB)' },
          { value: 'internal_audit',   label: '🔍 Internal Audit' },
          { value: 'gst_audit',        label: '🧾 GST Audit' },
          { value: 'stock_audit',      label: '📦 Stock / Inventory Audit' },
        ],
      },
      {
        id:       'auditTurnover',
        question: 'What is your annual business turnover?',
        type:     'radio',
        required: true,
        options: [
          { value: 'below1Cr',   label: 'Below ₹1 Crore' },
          { value: '1Cr-5Cr',   label: '₹1 – ₹5 Crore' },
          { value: '5Cr-20Cr',  label: '₹5 – ₹20 Crore' },
          { value: 'above20Cr', label: 'Above ₹20 Crore' },
        ],
      },
      {
        id:       'auditUrgency',
        question: 'When do you need the audit completed?',
        type:     'radio',
        required: true,
        alias:    'urgency',
        options: [
          { value: 'immediate', label: '🔴 Urgently (within 1 week)' },
          { value: 'month',     label: '🟡 Within a month' },
          { value: '2-3months', label: '🟢 Within 2–3 months' },
          { value: 'flexible',  label: '🔵 Flexible' },
        ],
      },
    ],

    photography: [
      {
        id:       'photographyType',
        question: 'What type of photography do you need?',
        type:     'radio',
        required: true,
        options: [
          { value: 'wedding',    label: '💍 Wedding Photography' },
          { value: 'portrait',   label: '🤳 Portrait / Headshots' },
          { value: 'product',    label: '📦 Product / E-Commerce' },
          { value: 'corporate',  label: '🏢 Corporate / Event' },
          { value: 'real_estate',label: '🏠 Real Estate / Architecture' },
          { value: 'other',      label: '📷 Other' },
        ],
      },
      {
        id:       'photographyDuration',
        question: 'How long is the shoot?',
        type:     'radio',
        required: true,
        options: [
          { value: '1-2hours',   label: '1–2 hours' },
          { value: 'half-day',   label: 'Half day (3–5 hours)' },
          { value: 'full-day',   label: 'Full day' },
          { value: 'multi-day',  label: 'Multiple days' },
        ],
      },
      {
        id:       'photographyUrgency',
        question: 'When is the event / shoot?',
        type:     'radio',
        required: true,
        alias:    'urgency',
        options: [
          { value: 'immediate', label: '🔴 Within a week' },
          { value: 'month',     label: '🟡 Within a month' },
          { value: 'flexible',  label: '🔵 Not fixed yet' },
        ],
      },
    ],

    development: [
      {
        id:       'devProjectType',
        question: 'What type of project do you need?',
        type:     'radio',
        required: true,
        options: [
          { value: 'website',      label: '🌐 Website (informational / brochure)' },
          { value: 'ecommerce',    label: '🛒 E-Commerce Store' },
          { value: 'webapp',       label: '💻 Web Application / SaaS' },
          { value: 'mobile-app',   label: '📱 Mobile App (Android / iOS)' },
          { value: 'api',          label: '🔌 API / Backend Development' },
          { value: 'redesign',     label: '🎨 Website Redesign / Revamp' },
          { value: 'maintenance',  label: '🔧 Maintenance / Bug Fix' },
        ],
      },
      {
        id:       'devTimeline',
        question: 'What is your project timeline?',
        type:     'radio',
        required: true,
        alias:    'urgency',
        options: [
          { value: 'immediate', label: '🔴 ASAP (within 1 week)' },
          { value: '2-3days',   label: '🟠 Within 2–4 weeks' },
          { value: 'month',     label: '🟡 1–3 months' },
          { value: 'flexible',  label: '🔵 Flexible' },
        ],
      },
      {
        id:       'devBudgetRange',
        question: 'What is your approximate budget?',
        type:     'radio',
        required: false,
        options: [
          { value: 'below10k',   label: 'Below ₹10,000' },
          { value: '10k-50k',    label: '₹10,000 – ₹50,000' },
          { value: '50k-2L',     label: '₹50,000 – ₹2 Lakhs' },
          { value: 'above2L',    label: 'Above ₹2 Lakhs' },
        ],
      },
    ],

  }, // end questionnaire

  // ─── Credit cost per service ─────────────────────────────
  creditCost: {
    itr:         20,
    gst:         20,
    accounting:  20,
    audit:       20,
    photography: 10,
    development: 15,
  },

  // ─── Max approaches per request ──────────────────────────
  maxApproaches: {
    itr:         5,
    gst:         5,
    accounting:  5,
    audit:       5,
    photography: 5,
    development: 5,
  },

  // ─── Answer tag rendering (shown on browse cards) ────────
  // Maps a questionnaire answer key to a human-readable pill label
  answerTagFormatters: {
    itrAnnualIncome:        v => 'Income: ' + v.replace('above', '> ').replace('below', '< '),
    itrTaxpayerType:        v => v.charAt(0).toUpperCase() + v.slice(1),
    itrIncomeSources:       v => Array.isArray(v) ? v.join(', ') : v,
    gstTurnover:            v => 'Turnover: ' + v,
    gstServiceType:         v => v.replace(/_/g, ' '),
    gstBusinessType:        v => v.charAt(0).toUpperCase() + v.slice(1),
    accountingFrequency:    v => v.replace(/-/g, ' '),
    accountingTransactions: v => v + ' txns/mo',
    accountingSoftware:     v => v,
    photographyType:        v => v.charAt(0).toUpperCase() + v.slice(1),
    photographyDuration:    v => v.replace(/-/g, ' '),
    devProjectType:         v => v.replace(/-/g, ' '),
    devTimeline:            v => v.replace(/-/g, ' '),
    auditType:              v => v.replace(/_/g, ' ') + ' audit',
    auditTurnover:          v => 'Turnover: ' + v,
  },

};

// Freeze to prevent accidental mutation
Object.freeze(WI_SERVICES);
