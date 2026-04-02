/**
 * WorkIndex — Service Category & Questionnaire Configuration
 * ============================================================
 * AUTO-MANAGED: Admin panel pushes updates to this file.
 * Loaded by index.html BEFORE app.js.
 *
 * Structure:
 *   WI_SERVICES.list              — all service categories
 *   WI_SERVICES.questionnaire
 *     .serviceSelection           — step 0: service picker (client)
 *     .byService.itr[]            — ITR-specific steps
 *     .byService.gst[]            — GST-specific steps
 *     .byService.accounting[]     — Accounting-specific steps
 *     .byService.audit[]          — Audit-specific steps
 *     .byService.photography[]    — Photography-specific steps
 *     .byService.development[]    — Development-specific steps
 *     .common.serviceLocationType — location type question
 *     .common.fullAddress         — in-person address (conditional)
 *     .common.clientLocation      — online location (conditional)
 *     .common.urgency             — when do you need it
 *     .common.budget              — budget range
 *     .common.description         — free text description
 *     .common.preferredProfessional — what kind of professional
 *     .common.contactMethod       — how to reach you
 *     .expert[]                   — expert onboarding steps
 */
 
const WI_SERVICES = {
 
  // ─── Master list ─────────────────────────────────────────
  list: [
    { value: 'itr',         label: 'ITR Filing',    icon: '📄', color: '#8b5cf6' },
    { value: 'gst',         label: 'GST Services',  icon: '🧾', color: '#3b82f6' },
    { value: 'accounting',  label: 'Accounting',    icon: '📊', color: '#10b981' },
    { value: 'audit',       label: 'Audit',         icon: '🔍', color: '#f59e0b' },
    { value: 'photography', label: 'Photography',   icon: '📷', color: '#ec4899' },
    { value: 'development', label: 'Development',   icon: '💻', color: '#06b6d4' },
  ],
 
  // ─── Quick lookup maps ───────────────────────────────────
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
 
  // ─── Search aliases ──────────────────────────────────────
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
 
  // ─── Credit cost per service ─────────────────────────────
  creditCost: {
    itr: 20, gst: 20, accounting: 20, audit: 20, photography: 10, development: 15,
  },
 
  // ─── Max approaches per request ──────────────────────────
  maxApproaches: {
    itr: 5, gst: 5, accounting: 5, audit: 5, photography: 5, development: 5,
  },
 
  // ─── Answer tag formatters (browse cards) ────────────────
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
 
  // ═══════════════════════════════════════════════════════════
  // FULL QUESTIONNAIRE
  // Question object shape (same as BARK_Q_FORMS):
  //   id:       unique string key (used in qState.sequence)
  //   title:    heading shown at top of step
  //   subtitle: optional sub-heading
  //   type:     'single' | 'multi' | 'textarea' | 'address' |
  //             'address-simple' | 'budget' | 'service-picker'
  //   key:      answer storage key in qState.answers
  //   required: true/false
  //   options:  array of { value, label, icon?, desc? }
  //             (omit for textarea/address/budget types)
  // ═══════════════════════════════════════════════════════════
  questionnaire: {
 
    // ── Step 0: Service selection (client) ──────────────────
    serviceSelection: {
      id:       'service',
      key:      'service',
      type:     'service-picker',          // special: renders icon grid
      title:    'What service do you need?',
      subtitle: 'Select the category that best matches your requirement',
      required: true,
      // options auto-populated at runtime from WI_SERVICES.list
      // (handled by _lookupQuestion in index.html)
      useServiceList: true,
    },
 
    // ── Service-specific steps ──────────────────────────────
    byService: {
 
      itr: [
        {
          id: 'itr_taxpayer_type', key: 'itrTaxpayerType',
          type: 'single', required: true,
          title: 'What is your taxpayer type?',
          subtitle: 'Select the option that best describes you',
          options: [
            { value: 'salaried',   label: 'Salaried Employee',         icon: '💼', desc: 'Working in a company, government or private' },
            { value: 'business',   label: 'Business Owner',            icon: '🏢', desc: 'Running your own business or firm' },
            { value: 'freelancer', label: 'Freelancer / Consultant',   icon: '💻', desc: 'Independent professional or contractor' },
            { value: 'nri',        label: 'NRI (Non-Resident Indian)', icon: '🌍', desc: 'Living or working outside India' },
          ],
        },
        {
          id: 'itr_annual_income', key: 'itrAnnualIncome',
          type: 'single', required: true,
          title: 'What is your approximate annual income?',
          subtitle: 'This helps match you with the right CA',
          options: [
            { value: 'below5L',  label: 'Below ₹5 Lakhs',     icon: '💰' },
            { value: '5L-10L',   label: '₹5L – ₹10 Lakhs',   icon: '💰' },
            { value: '10L-20L',  label: '₹10L – ₹20 Lakhs',  icon: '💰' },
            { value: 'above20L', label: 'Above ₹20 Lakhs',    icon: '💰' },
          ],
        },
        {
          id: 'itr_income_sources', key: 'itrIncomeSources',
          type: 'multi', required: true,
          title: 'Select all your income sources',
          subtitle: 'You can select multiple',
          options: [
            { value: 'salary',        label: 'Salary / Pension',                    icon: '💼' },
            { value: 'rental',        label: 'Rental Income',                        icon: '🏠' },
            { value: 'capital_gains', label: 'Capital Gains (Stocks / MF / Property)', icon: '📈' },
            { value: 'business',      label: 'Business Income',                      icon: '🏢' },
            { value: 'freelance',     label: 'Freelance / Consulting',               icon: '💻' },
            { value: 'foreign',       label: 'Foreign / NRI Income',                 icon: '🌍' },
            { value: 'other',         label: 'Other Sources',                        icon: '📋' },
          ],
        },
        {
          id: 'itr_filing_requirement', key: 'itrFilingRequirement',
          type: 'single', required: true,
          title: 'What do you need help with?',
          options: [
            { value: 'filing_only',   label: 'Just file my ITR',        icon: '📄', desc: 'I have all documents ready' },
            { value: 'full_service',  label: 'Full CA assistance',       icon: '🤝', desc: 'Help with documents + filing' },
            { value: 'tax_planning',  label: 'Tax planning + filing',    icon: '📊', desc: 'Optimize my tax and then file' },
            { value: 'notice_reply',  label: 'Reply to IT notice',       icon: '⚠️', desc: 'Got a notice from income tax dept' },
          ],
        },
        {
          id: 'itr_tax_planning', key: 'itrTaxPlanning',
          type: 'single', required: false,
          title: 'Which tax regime do you prefer?',
          subtitle: 'Your CA will recommend the better option for you',
          options: [
            { value: 'old_regime',  label: 'Old Regime',   icon: '📋', desc: 'With deductions (80C, HRA, etc.)' },
            { value: 'new_regime',  label: 'New Regime',   icon: '🆕', desc: 'Lower rates, fewer deductions' },
            { value: 'unsure',      label: 'Not sure',     icon: '🤔', desc: 'Let my CA decide the best option' },
          ],
        },
      ],
 
      gst: [
        {
          id: 'gst_service_type', key: 'gstServiceType',
          type: 'single', required: true,
          title: 'What GST service do you need?',
          options: [
            { value: 'new_registration',   label: 'New GST Registration',      icon: '📋', desc: 'Get a GSTIN for your business' },
            { value: 'monthly_filing',     label: 'Monthly GSTR Filing',       icon: '📊', desc: 'Regular GSTR-1, GSTR-3B filing' },
            { value: 'annual_return',      label: 'Annual Return (GSTR-9)',    icon: '📁', desc: 'Year-end GST reconciliation' },
            { value: 'notice_handling',    label: 'GST Notice / Scrutiny',     icon: '⚠️', desc: 'Received a GST notice' },
            { value: 'itc_reconciliation', label: 'ITC Reconciliation',        icon: '🔁', desc: 'Fix input tax credit mismatches' },
            { value: 'consultation',       label: 'GST Consultation',          icon: '💬', desc: 'General advice or queries' },
          ],
        },
        {
          id: 'gst_business_type', key: 'gstBusinessType',
          type: 'single', required: true,
          title: 'What type of business do you run?',
          options: [
            { value: 'trader',       label: 'Trader / Retailer',    icon: '🏪' },
            { value: 'manufacturer', label: 'Manufacturer',          icon: '🏭' },
            { value: 'services',     label: 'Service Provider',      icon: '💼' },
            { value: 'ecommerce',    label: 'E-Commerce / Online',   icon: '🛒' },
            { value: 'exporter',     label: 'Exporter / Importer',  icon: '🚢' },
          ],
        },
        {
          id: 'gst_turnover', key: 'gstTurnover',
          type: 'single', required: true,
          title: 'What is your monthly business turnover?',
          options: [
            { value: 'below5L',  label: 'Below ₹5 Lakhs',    icon: '💰' },
            { value: '5L-20L',   label: '₹5L – ₹20 Lakhs',  icon: '💰' },
            { value: '20L-50L',  label: '₹20L – ₹50 Lakhs', icon: '💰' },
            { value: 'above50L', label: 'Above ₹50 Lakhs',   icon: '💰' },
          ],
        },
        {
          id: 'gst_existing', key: 'gstExisting',
          type: 'single', required: true,
          title: 'Do you already have a GST registration?',
          options: [
            { value: 'yes_active',    label: 'Yes, active',          icon: '✅' },
            { value: 'yes_cancelled', label: 'Yes, but cancelled',   icon: '❌' },
            { value: 'no',            label: 'No, need new one',      icon: '🆕' },
          ],
        },
      ],
 
      accounting: [
        {
          id: 'accounting_business_type', key: 'accountingBusinessType',
          type: 'single', required: true,
          title: 'What type of business do you have?',
          options: [
            { value: 'startup',      label: 'Startup / New Business',  icon: '🚀' },
            { value: 'sme',          label: 'Established SME',         icon: '🏢' },
            { value: 'freelancer',   label: 'Freelancer / Consultant', icon: '💻' },
            { value: 'individual',   label: 'Individual / Personal',   icon: '👤' },
          ],
        },
        {
          id: 'accounting_frequency', key: 'accountingFrequency',
          type: 'single', required: true,
          title: 'How often do you need accounting support?',
          options: [
            { value: 'monthly',   label: 'Monthly (ongoing)',    icon: '📅', desc: 'Regular bookkeeping every month' },
            { value: 'quarterly', label: 'Quarterly',            icon: '🗓️', desc: 'Every 3 months' },
            { value: 'annual',    label: 'One-time / Annual',    icon: '📆', desc: 'Year-end accounts only' },
            { value: 'as-needed', label: 'As needed',            icon: '🔄', desc: 'On-demand basis' },
          ],
        },
        {
          id: 'accounting_software', key: 'accountingSoftware',
          type: 'single', required: false,
          title: 'Which accounting software do you use?',
          subtitle: 'Leave blank or choose None if you are unsure',
          options: [
            { value: 'tally',      label: 'Tally',               icon: '📊' },
            { value: 'zoho',       label: 'Zoho Books',           icon: '📘' },
            { value: 'quickbooks', label: 'QuickBooks',           icon: '📙' },
            { value: 'excel',      label: 'Excel / Manual',       icon: '📋' },
            { value: 'none',       label: 'None / Open to any',   icon: '🤷' },
          ],
        },
        {
          id: 'accounting_transactions', key: 'accountingTransactions',
          type: 'single', required: true,
          title: 'How many transactions per month approximately?',
          subtitle: 'Invoices, payments, expenses combined',
          options: [
            { value: 'below50',  label: 'Below 50',    icon: '📊' },
            { value: '50-200',   label: '50 – 200',    icon: '📊' },
            { value: '200-500',  label: '200 – 500',   icon: '📊' },
            { value: 'above500', label: 'Above 500',   icon: '📊' },
          ],
        },
      ],
 
      audit: [
        {
          id: 'audit_type', key: 'auditType',
          type: 'single', required: true,
          title: 'What type of audit do you need?',
          options: [
            { value: 'statutory_audit', label: 'Statutory Audit',         icon: '📋', desc: 'Companies Act requirement' },
            { value: 'tax_audit',       label: 'Tax Audit (Sec 44AB)',     icon: '📄', desc: 'Income tax act requirement' },
            { value: 'internal_audit',  label: 'Internal Audit',           icon: '🔍', desc: 'Internal controls review' },
            { value: 'gst_audit',       label: 'GST Audit',                icon: '🧾', desc: 'GST compliance review' },
            { value: 'stock_audit',     label: 'Stock / Inventory Audit',  icon: '📦', desc: 'Physical stock verification' },
          ],
        },
        {
          id: 'audit_org_type', key: 'auditOrgType',
          type: 'single', required: true,
          title: 'What type of organisation are you?',
          options: [
            { value: 'private_company', label: 'Private Limited Company',  icon: '🏢' },
            { value: 'llp',             label: 'LLP',                       icon: '🤝' },
            { value: 'partnership',     label: 'Partnership Firm',          icon: '👥' },
            { value: 'proprietorship',  label: 'Proprietorship',            icon: '👤' },
            { value: 'trust_ngo',       label: 'Trust / NGO',               icon: '🏛️' },
          ],
        },
        {
          id: 'audit_turnover', key: 'auditTurnover',
          type: 'single', required: true,
          title: 'What is your annual business turnover?',
          options: [
            { value: 'below1Cr',   label: 'Below ₹1 Crore',    icon: '💰' },
            { value: '1Cr-5Cr',    label: '₹1 – ₹5 Crore',    icon: '💰' },
            { value: '5Cr-20Cr',   label: '₹5 – ₹20 Crore',   icon: '💰' },
            { value: 'above20Cr',  label: 'Above ₹20 Crore',   icon: '💰' },
          ],
        },
        {
          id: 'audit_deadline', key: 'auditDeadline',
          type: 'single', required: true,
          title: 'When do you need the audit completed?',
          options: [
            { value: 'urgent',     label: 'Urgently (within 1 week)',  icon: '🔴' },
            { value: 'month',      label: 'Within a month',            icon: '🟡' },
            { value: '2-3months',  label: 'Within 2–3 months',         icon: '🟢' },
            { value: 'flexible',   label: 'Flexible',                   icon: '🔵' },
          ],
        },
      ],
 
      photography: [
        {
          id: 'photography_type', key: 'photographyType',
          type: 'single', required: true,
          title: 'What type of photography do you need?',
          options: [
            { value: 'wedding',     label: 'Wedding Photography',        icon: '💍' },
            { value: 'portrait',    label: 'Portrait / Headshots',       icon: '🤳' },
            { value: 'product',     label: 'Product / E-Commerce',       icon: '📦' },
            { value: 'corporate',   label: 'Corporate / Event',          icon: '🏢' },
            { value: 'real_estate', label: 'Real Estate / Architecture', icon: '🏠' },
            { value: 'other',       label: 'Other',                       icon: '📷' },
          ],
        },
        {
          id: 'photography_event_date', key: 'photographyEventDate',
          type: 'single', required: true,
          title: 'When is your event or shoot?',
          options: [
            { value: 'within_week',  label: 'Within this week',   icon: '🔴' },
            { value: 'within_month', label: 'Within a month',     icon: '🟡' },
            { value: '1-3months',    label: '1 – 3 months away',  icon: '🟢' },
            { value: 'not_fixed',    label: 'Not fixed yet',       icon: '🔵' },
          ],
        },
        {
          id: 'photography_duration', key: 'photographyDuration',
          type: 'single', required: true,
          title: 'How long do you need the photographer?',
          options: [
            { value: '1-2hours',  label: '1 – 2 hours',          icon: '⏱️' },
            { value: 'half-day',  label: 'Half day (3–5 hours)', icon: '⏱️' },
            { value: 'full-day',  label: 'Full day',              icon: '⏱️' },
            { value: 'multi-day', label: 'Multiple days',         icon: '⏱️' },
          ],
        },
        {
          id: 'photography_videography', key: 'photographyVideography',
          type: 'single', required: false,
          title: 'Do you also need videography?',
          options: [
            { value: 'yes', label: 'Yes, photo + video',   icon: '🎬' },
            { value: 'no',  label: 'No, photos only',      icon: '📷' },
          ],
        },
      ],
 
      development: [
        {
          id: 'dev_project_type', key: 'devProjectType',
          type: 'single', required: true,
          title: 'What type of project do you need?',
          options: [
            { value: 'website',     label: 'Website (brochure/info)',   icon: '🌐' },
            { value: 'ecommerce',   label: 'E-Commerce Store',          icon: '🛒' },
            { value: 'webapp',      label: 'Web Application / SaaS',    icon: '💻' },
            { value: 'mobile-app',  label: 'Mobile App (Android/iOS)',  icon: '📱' },
            { value: 'api',         label: 'API / Backend only',        icon: '🔌' },
            { value: 'redesign',    label: 'Redesign / Revamp',         icon: '🎨' },
            { value: 'maintenance', label: 'Maintenance / Bug fixes',   icon: '🔧' },
          ],
        },
        {
          id: 'dev_project_stage', key: 'devProjectStage',
          type: 'single', required: true,
          title: 'What stage is the project at?',
          options: [
            { value: 'idea',        label: 'Just an idea',          icon: '💡', desc: 'Starting from scratch' },
            { value: 'design_ready',label: 'Design ready',          icon: '🎨', desc: 'Have mockups / wireframes' },
            { value: 'existing',    label: 'Existing project',      icon: '🔧', desc: 'Need changes to live project' },
          ],
        },
        {
          id: 'dev_platform', key: 'devPlatform',
          type: 'single', required: false,
          title: 'Any technology preference?',
          subtitle: 'Skip if unsure — developer will suggest',
          options: [
            { value: 'react',      label: 'React / Next.js',    icon: '⚛️' },
            { value: 'wordpress',  label: 'WordPress',           icon: '📝' },
            { value: 'shopify',    label: 'Shopify',             icon: '🛒' },
            { value: 'flutter',    label: 'Flutter (Mobile)',    icon: '📱' },
            { value: 'node',       label: 'Node.js / Express',  icon: '🟢' },
            { value: 'no_pref',    label: 'No preference',       icon: '🤷' },
          ],
        },
        {
          id: 'dev_timeline', key: 'devTimeline',
          type: 'single', required: true,
          title: 'What is your project timeline?',
          options: [
            { value: 'immediate', label: 'ASAP (within 1 week)', icon: '🔴' },
            { value: '2-4weeks',  label: 'Within 2–4 weeks',     icon: '🟠' },
            { value: 'month',     label: '1–3 months',           icon: '🟡' },
            { value: 'flexible',  label: 'Flexible',              icon: '🔵' },
          ],
        },
        {
          id: 'dev_maintenance', key: 'devMaintenance',
          type: 'single', required: false,
          title: 'Do you need ongoing maintenance after launch?',
          options: [
            { value: 'yes',   label: 'Yes, ongoing support',  icon: '✅' },
            { value: 'no',    label: 'No, one-time project',  icon: '❌' },
            { value: 'maybe', label: 'Decide later',          icon: '🤔' },
          ],
        },
      ],
 
    }, // end byService
 
    // ── Common steps (all services) ─────────────────────────
    common: {
 
      serviceLocationType: {
        id: 'service_location_type', key: 'serviceLocationType',
        type: 'single', required: true,
        title: 'Where do you need the service?',
        subtitle: 'Choose how you prefer to work with the professional',
        options: [
          { value: 'online',               label: 'Online / Remotely',           icon: '💻', desc: 'Share documents digitally, work via chat/call' },
          { value: 'my-location',          label: 'At my location',              icon: '🏠', desc: 'Professional comes to me' },
          { value: 'professional-office',  label: 'At professional\'s office',   icon: '🏢', desc: 'I visit their office' },
        ],
      },
 
      fullAddress: {
        id: 'full_address', key: 'fullAddress',
        type: 'address', required: true,
        title: 'Enter your address',
        subtitle: 'So we can find professionals near you',
        fields: [
          { key: 'building',  label: 'Flat / Building / House No.', placeholder: 'e.g. 4B, Sunrise Apartments', required: true },
          { key: 'area',      label: 'Area / Street / Locality',    placeholder: 'e.g. Koramangala 5th Block',  required: true },
          { key: 'pincode',   label: 'Pincode',                     placeholder: 'e.g. 560095',                required: true, type: 'pincode' },
          { key: 'city',      label: 'City',                        placeholder: 'e.g. Bengaluru',             required: true },
          { key: 'state',     label: 'State',                       placeholder: 'e.g. Karnataka',             required: true },
          { key: 'landmark',  label: 'Landmark (optional)',         placeholder: 'e.g. Near Indiranagar metro', required: false },
        ],
      },
 
      clientLocation: {
        id: 'client_location', key: 'clientLocation',
        type: 'address-simple', required: true,
        title: 'Where are you based?',
        subtitle: 'Helps match you with professionals in your region',
        fields: [
          { key: 'pincode', label: 'Pincode', placeholder: 'e.g. 560095', required: true, type: 'pincode' },
          { key: 'city',    label: 'City',    placeholder: 'e.g. Bengaluru', required: true },
          { key: 'state',   label: 'State',   placeholder: 'e.g. Karnataka', required: true },
        ],
      },
 
      urgency: {
        id: 'urgency', key: 'urgency',
        type: 'single', required: true,
        title: 'When do you need this done?',
        options: [
          { value: 'immediate', label: 'Immediately (within 24 hours)', icon: '🔴' },
          { value: '2-3days',   label: 'Within 2–3 days',               icon: '🟠' },
          { value: 'week',      label: 'Within a week',                  icon: '🟡' },
          { value: 'month',     label: 'Within a month',                 icon: '🟢' },
          { value: 'flexible',  label: 'Flexible / No rush',             icon: '🔵' },
        ],
      },
 
      budget: {
        id: 'budget', key: 'budget',
        type: 'budget', required: false,
        title: 'What is your budget?',
        subtitle: 'Enter the amount you are willing to pay. Professionals will send you quotes.',
        min: 100, max: 500000, step: 100, currency: '₹',
        placeholder: 'Enter your budget in ₹',
      },
 
      description: {
        id: 'description', key: 'description',
        type: 'textarea', required: true,
        title: 'Describe your requirement',
        subtitle: 'More detail helps professionals give you accurate quotes',
        placeholder: 'Please describe what you need in detail — e.g. documents you have, specific requirements, any deadlines, questions for the professional...',
        minLength: 20,
      },
 
      preferredProfessional: {
        id: 'preferred_professional', key: 'preferredProfessional',
        type: 'single', required: false,
        title: 'What type of professional do you prefer?',
        options: [
          { value: 'individual_ca', label: 'Individual CA / Freelancer',   icon: '👤', desc: 'Personal attention, often more affordable' },
          { value: 'firm',          label: 'CA Firm / Agency',             icon: '🏢', desc: 'Team support, established firm' },
          { value: 'no_preference', label: 'No preference',                icon: '🤷', desc: 'Best quote wins' },
        ],
      },
 
      contactMethod: {
        id: 'contact_method', key: 'contactMethod',
        type: 'single', required: true,
        title: 'How should professionals contact you?',
        options: [
          { value: 'platform_chat', label: 'Chat on WorkIndex',      icon: '💬', desc: 'Professionals message you here' },
          { value: 'phone',         label: 'Phone call / WhatsApp',  icon: '📞', desc: 'They call or WhatsApp you directly' },
          { value: 'email',         label: 'Email',                   icon: '✉️', desc: 'They email you' },
          { value: 'any',           label: 'Any method is fine',      icon: '✅' },
        ],
      },
 
    }, // end common
 
    // ── Expert onboarding steps ──────────────────────────────
    expert: [
      {
        id: 'expert_services', key: 'servicesOffered',
        type: 'multi', required: true,
        title: 'What services do you offer?',
        subtitle: 'Select all that apply — you can update this later',
        useServiceList: true,
        // options auto-populated from WI_SERVICES.list at runtime
      },
      {
        id: 'expert_specialization', key: 'specialization',
        type: 'single', required: true,
        title: 'What is your primary specialization?',
        options: [
          { value: 'Chartered Accountant',       label: 'Chartered Accountant (CA)',         icon: '🎓' },
          { value: 'Cost Accountant',             label: 'Cost Accountant (CMA)',              icon: '🎓' },
          { value: 'Company Secretary',           label: 'Company Secretary (CS)',             icon: '🎓' },
          { value: 'Tax Consultant',              label: 'Tax Consultant',                     icon: '📄' },
          { value: 'GST Consultant',              label: 'GST Consultant',                     icon: '🧾' },
          { value: 'Bookkeeper',                  label: 'Bookkeeper / Accountant',            icon: '📊' },
          { value: 'Photographer',               label: 'Photographer',                       icon: '📷' },
          { value: 'Web Developer',              label: 'Web / App Developer',                icon: '💻' },
          { value: 'Other',                       label: 'Other Professional',                 icon: '🔧' },
        ],
      },
      {
        id: 'expert_experience', key: 'yearsOfExperience',
        type: 'single', required: true,
        title: 'How many years of experience do you have?',
        options: [
          { value: '0-1',   label: 'Less than 1 year',  icon: '🌱' },
          { value: '1-3',   label: '1 – 3 years',       icon: '📈' },
          { value: '3-5',   label: '3 – 5 years',       icon: '📈' },
          { value: '5-10',  label: '5 – 10 years',      icon: '⭐' },
          { value: '10+',   label: 'More than 10 years', icon: '🏆' },
        ],
      },
      {
        id: 'expert_location', key: 'serviceLocationType',
        type: 'single', required: true,
        title: 'Where do you prefer to work?',
        options: [
          { value: 'online', label: 'Online / Remotely only',         icon: '💻', desc: 'Work with clients anywhere in India' },
          { value: 'local',  label: 'Local (in-person preferred)',    icon: '📍', desc: 'Prefer meeting clients face to face' },
          { value: 'both',   label: 'Both online and in-person',     icon: '🌐', desc: 'Flexible depending on the client' },
        ],
      },
      {
        id: 'expert_city', key: 'city',
        type: 'single', required: true,
        title: 'Which city are you based in?',
        subtitle: 'This helps match you with local clients',
        // Note: rendered as pincode-lookup text input in renderQuestion()
        // type stays 'single' but special rendering is handled in HTML
        // by checking question.key === 'city'
        options: [], // empty = text input fallback
        placeholder: 'Enter your city',
        isTextInput: true,
      },
      {
        id: 'expert_state', key: 'state',
        type: 'single', required: true,
        title: 'Which state are you in?',
        options: [
          { value: 'Andhra Pradesh',    label: 'Andhra Pradesh' },
          { value: 'Assam',             label: 'Assam' },
          { value: 'Bihar',             label: 'Bihar' },
          { value: 'Chhattisgarh',      label: 'Chhattisgarh' },
          { value: 'Delhi',             label: 'Delhi' },
          { value: 'Goa',               label: 'Goa' },
          { value: 'Gujarat',           label: 'Gujarat' },
          { value: 'Haryana',           label: 'Haryana' },
          { value: 'Himachal Pradesh',  label: 'Himachal Pradesh' },
          { value: 'Jharkhand',         label: 'Jharkhand' },
          { value: 'Karnataka',         label: 'Karnataka' },
          { value: 'Kerala',            label: 'Kerala' },
          { value: 'Madhya Pradesh',    label: 'Madhya Pradesh' },
          { value: 'Maharashtra',       label: 'Maharashtra' },
          { value: 'Odisha',            label: 'Odisha' },
          { value: 'Punjab',            label: 'Punjab' },
          { value: 'Rajasthan',         label: 'Rajasthan' },
          { value: 'Tamil Nadu',        label: 'Tamil Nadu' },
          { value: 'Telangana',         label: 'Telangana' },
          { value: 'Uttar Pradesh',     label: 'Uttar Pradesh' },
          { value: 'Uttarakhand',       label: 'Uttarakhand' },
          { value: 'West Bengal',       label: 'West Bengal' },
          { value: 'Other',             label: 'Other' },
        ],
      },
      {
        id: 'expert_pincode', key: 'pincode',
        type: 'single', required: true,
        title: 'What is your pincode?',
        subtitle: 'Used to match you with nearby clients',
        options: [],
        placeholder: 'Enter 6-digit pincode',
        isTextInput: true,
      },
      {
        id: 'expert_bio', key: 'bio',
        type: 'textarea', required: true,
        title: 'Tell clients about yourself',
        subtitle: 'Your bio appears on your public profile. Mention your qualifications, specialisation, and what makes you the right choice.',
        placeholder: 'e.g. I am a Chartered Accountant with 8 years of experience specialising in income tax, GST, and startup accounting. I have helped 200+ clients...',
        minLength: 50,
      },
    ], // end expert
 
  }, // end questionnaire
 
};
 
Object.freeze(WI_SERVICES);
