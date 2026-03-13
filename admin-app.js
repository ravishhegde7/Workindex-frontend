/* ═══════════════════════════════════════════════════════════
   WorkIndex Admin — admin-app.js
   All application logic. Requires: admin.css, admin.html
   ═══════════════════════════════════════════════════════════ */

(function(){
  var API = 'https://workindex-production.up.railway.app/api/admin';
  var tok = localStorage.getItem('admTok') || '';
  var adm = null;
  try { adm = JSON.parse(localStorage.getItem('admData') || 'null'); } catch(e) {}
  var dF = '', dT = '', T = {};
  var _editPostId = null, _creditUid = null, _pwUid = null, _tkId = null;

  // ─── ADMIN PAGINATION ───
  var _pages = {
    experts: 1, clients: 1, approaches: 1, chats: 1,
    credits: 1, tickets: 1, posts: 1, reviews: 1,
    registrations: 1, kyc: 1, suspReq: 1, reports: 1
  };
  var _pageData = {};
  var PER_PAGE = 10;

  function pagSlice(key, arr) {
    _pageData[key] = arr;
    var p = _pages[key] || 1;
    var total = arr.length;
    var pages = Math.ceil(total / PER_PAGE);
    if (p > pages && pages > 0) { p = pages; _pages[key] = p; }
    return arr.slice((p - 1) * PER_PAGE, p * PER_PAGE);
  }

  function pagHTML(key, containerId) {
    var arr = _pageData[key] || [];
    var total = arr.length;
    var pages = Math.ceil(total / PER_PAGE);
    var p = _pages[key] || 1;
    if (pages <= 1) return;
    var c = document.getElementById(containerId);
    if (!c) return;
    var existing = document.getElementById('pag-' + key);
    if (existing) existing.remove();
    var div = document.createElement('div');
    div.id = 'pag-' + key;
    div.style.cssText = 'display:flex;align-items:center;gap:6px;padding:14px 0;justify-content:center;flex-wrap:wrap;';
    var btns = '';
    btns += '<button onclick="goPage(\'' + key + '\',' + (p-1) + ')" ' + (p<=1?'disabled':'') + ' style="padding:6px 12px;background:#1a1a24;border:1px solid #2a2a38;color:#a0a0b8;border-radius:6px;cursor:pointer;font-size:13px;">&laquo;</button>';
    var start = Math.max(1, p-2), end = Math.min(pages, p+2);
    if (start > 1) btns += '<button onclick="goPage(\'' + key + '\',1)" style="padding:6px 10px;background:#1a1a24;border:1px solid #2a2a38;color:#a0a0b8;border-radius:6px;cursor:pointer;font-size:13px;">1</button>' + (start>2?'<span style="color:#606078;padding:0 4px">…</span>':'');
    for (var i = start; i <= end; i++) {
      var active = i === p;
      btns += '<button onclick="goPage(\'' + key + '\',' + i + ')" style="padding:6px 10px;background:' + (active?'#FC8019':'#1a1a24') + ';border:1px solid ' + (active?'#FC8019':'#2a2a38') + ';color:' + (active?'#fff':'#a0a0b8') + ';border-radius:6px;cursor:pointer;font-size:13px;font-weight:' + (active?'700':'400') + ';">' + i + '</button>';
    }
    if (end < pages) btns += (end<pages-1?'<span style="color:#606078;padding:0 4px">…</span>':'') + '<button onclick="goPage(\'' + key + '\',' + pages + ')" style="padding:6px 10px;background:#1a1a24;border:1px solid #2a2a38;color:#a0a0b8;border-radius:6px;cursor:pointer;font-size:13px;">' + pages + '</button>';
    btns += '<button onclick="goPage(\'' + key + '\',' + (p+1) + ')" ' + (p>=pages?'disabled':'') + ' style="padding:6px 12px;background:#1a1a24;border:1px solid #2a2a38;color:#a0a0b8;border-radius:6px;cursor:pointer;font-size:13px;">&raquo;</button>';
    btns += '<span style="font-size:12px;color:#606078;margin-left:8px">' + total + ' total</span>';
    div.innerHTML = btns;
    c.parentNode.insertBefore(div, c.nextSibling);
  }

  window.goPage = function goPage(key, p) {
    var arr = _pageData[key] || [];
    var pages = Math.ceil(arr.length / PER_PAGE);
    if (p < 1 || p > pages) return;
    _pages[key] = p;
    var reloaders = {
      experts: function() { renderUsersPage('expert'); },
      clients: function() { renderUsersPage('client'); },
      approaches: function() { renderApproachesPage(); },
      chats: function() { renderChatsPage(); },
      credits: function() { renderCreditsPage(); },
      tickets: function() { renderTicketsPage(); },
      posts: function() { renderPostsPage(); },
      reviews: function() { renderReviewsPage(); },
      registrations: function() { renderRegistrationsPage(); },
      kyc: function() { renderKycPage(); }
    };
    if (reloaders[key]) reloaders[key]();
    // Scroll to top of table
    var tbl = document.getElementById(key === 'experts' ? 'eTbl' : key === 'clients' ? 'cTbl' : key === 'approaches' ? 'apTbl' : key === 'chats' ? 'chTbl' : key === 'credits' ? 'crTbl' : key === 'tickets' ? 'tkTbl' : key === 'posts' ? 'poTbl' : key === 'reviews' ? 'rvTbl' : key === 'registrations' ? 'rgTbl' : 'kycTbl');
    if (tbl) tbl.closest('table') && tbl.closest('table').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ─── ADMIN INACTIVITY LOGOUT (30 minutes) ───
  var _adminInactivityTimer = null;
  var ADMIN_INACTIVITY_TIMEOUT = 30 * 60 * 1000;

  function resetAdminTimer() {
    if (!tok) return;
    clearTimeout(_adminInactivityTimer);
    _adminInactivityTimer = setTimeout(function() {
      doLogout();
      alert('Session expired due to inactivity. Please log in again.');
    }, ADMIN_INACTIVITY_TIMEOUT);
  }

  function startAdminInactivity() {
    ['mousemove','mousedown','keydown','touchstart','scroll','click'].forEach(function(ev) {
      window.addEventListener(ev, resetAdminTimer, { passive: true });
    });
    resetAdminTimer();
  }

  function stopAdminInactivity() {
    clearTimeout(_adminInactivityTimer);
    _adminInactivityTimer = null;
  }

  function g(id) { return document.getElementById(id); }
  function qa(s) { return Array.from(document.querySelectorAll(s)); }
  function deb(k, fn) { clearTimeout(T[k]); T[k] = setTimeout(fn, 300); }
  function esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  if (document.readyState !== 'loading') { init(); } else { document.addEventListener('DOMContentLoaded', init); }

  /* ═══ INIT ═══════════════════════════════════════════════════════════════ */
  function init() {
    if (tok && adm) { showApp(); }
    g('loginBtn').onclick = doLogin;
    g('liPw').onkeydown = function(e) { if (e.key === 'Enter') doLogin(); };
    g('logoutBtn').onclick = doLogout;
    if(g('mLogoutBtn')) g('mLogoutBtn').onclick = doLogout;
    /* mobile bottom nav */
    qa('.mni').forEach(function(n){ n.onclick = function(){ goTo(n.dataset.s); }; });
    g('applyDF').onclick = applyDates;
    g('clearDF').onclick = clearDates;
    g('drClose').onclick = closeDr;
    g('chDrClose').onclick = closeChDr;
    g('ov1').onclick = closeDr;
    g('ov2').onclick = closeChDr;
    qa('.ni').forEach(function(n) { n.onclick = function() { goTo(n.dataset.s); }; });

    /* search inputs */
    g('eSrch').oninput = function() { deb('e', function() { loadUsers('expert'); }); };
    g('cSrch').oninput = function() { deb('c', function() { loadUsers('client'); }); };
    g('apSt').onchange = loadApproaches;
    g('crType').onchange = loadCredits;
    g('crSrch').oninput = function() { deb('cr', loadCredits); };
    g('acSrch').oninput = function() { deb('ac', searchActions); };
    g('acRole').onchange = searchActions;
    g('tkSt').onchange = loadTickets;
    g('tkSrch').oninput = function() { deb('tk', loadTickets); };
    g('poSrch').oninput = function() { deb('po', loadPosts); };
    g('poSt').onchange = loadPosts;
    g('rvSrch').oninput = function() { deb('rv', loadReviews); };
    g('rvMin').onchange = loadReviews;
    g('rgSt').onchange = loadRegistrations;
         if (g('kycSt')) g('kycSt').onchange = loadKycRequests;
    g('commTarget').onchange = function() {
      g('commCustomBox').style.display = this.value === 'custom' ? 'block' : 'none';
    };
    g('previewCommBtn').onclick = previewComm;
    g('sendCommBtn').onclick = sendComm;
    g('genInvBtn').onclick = genInvoice;
    g('invUserSel').onchange = onInvExpertChange;
    g('invTxSel').onchange = onInvTxChange;
    g('invDesc').oninput = previewInvoice;
    g('invAmt').oninput = previewInvoice;
    g('invDate').oninput = previewInvoice;
    if (g('invDue')) g('invDue').oninput = previewInvoice;
    if (g('invNotes')) g('invNotes').oninput = previewInvoice;
    // Wire tax rate selectors directly in init so they always respond
    if (g('invTaxRate')) {
      g('invTaxRate').onchange = function() {
        var box = g('invCustomTaxBox');
        if (box) box.style.display = (this.value === 'custom') ? 'block' : 'none';
        previewInvoice();
      };
    }
    if (g('invCustomTax')) g('invCustomTax').oninput = previewInvoice;
    loadInvExperts();

     // Close approach action dropdowns when clicking outside
    document.addEventListener('click', function() {
      document.querySelectorAll('[id^="ap_"]').forEach(function(d) { d.style.display = 'none'; });
    });
     
    /* modal close buttons */
    document.addEventListener('click', function(ev) {
      var cl = ev.target.closest('[data-close]');
      if (cl) { closeModal(cl.dataset.close); }
    });

    /* modal submits */
    g('creditSubmit').onclick = submitCredit;
    g('pwSubmit').onclick = submitPw;
    g('savePostBtn').onclick = savePost;
    g('deletePostBtn').onclick = deletePost;
    g('tkApproveBtn').onclick = function() { processTicket('approve'); };
    g('tkRejectBtn').onclick = function() { processTicket('reject'); };
    g('tkResolveBtn').onclick = function() { processTicket('resolve'); };
    g('dmSubmit').onclick = submitDm;
    g('kycApproveBtn').onclick = function() { processKyc('approve'); };
    g('kycRejectBtn').onclick = function() { processKyc('reject'); };
    g('sendAnnBtn').onclick = sendAnnouncement;
    g('hmRole').onchange = function() { loadHeatmap(); };
    g('hmRefresh').onclick = function() { loadHeatmap(); };
    /* delegated: open DM modal */
    document.addEventListener('click', function(ev) {
      var btn = ev.target.closest('[data-dm-uid]');
      if (btn) { ev.preventDefault(); openDmModal(btn.dataset.dmUid, btn.dataset.dmName); return; }
      var tkb = ev.target.closest('[data-tk-uid]');
      if (tkb) { ev.preventDefault(); openCreateTicketModal(tkb.dataset.tkUid, tkb.dataset.tkName, tkb.dataset.tkRole); return; }
      var kb = ev.target.closest('[data-kyc-uid]');
      if (kb) { ev.preventDefault(); openKycModal(kb.dataset.kycUid, kb.dataset.kycName); return; }
      var hb = ev.target.closest('[data-hm-state]');
      if (hb) { ev.preventDefault(); drillHeatmap(hb.dataset.hmState); return; }
    });

    /* delegated: open user drawer */
    document.addEventListener('click', function(ev) {
      var el = ev.target.closest('[data-uid]');
      if (el && !ev.defaultPrevented) { openDr(el.dataset.uid); }
    });
    /* delegated: stat card nav */
    document.addEventListener('click', function(ev) {
      var el = ev.target.closest('[data-goto]');
      if (!el) return;
      var gt = el.dataset.goto;
      if (gt === 'credits-purchase') { goTo('credits'); g('crType').value = 'purchase'; loadCredits(); }
      else if (gt === 'credits-spent') { goTo('credits'); g('crType').value = 'spent'; loadCredits(); }
      else if (gt === 'credits-refund') { goTo('credits'); g('crType').value = 'refund'; loadCredits(); }
      else { goTo(gt); }
    });
    /* delegated: ledger + action uid buttons in drawer */
    document.addEventListener('click', function(ev) {
      var lb = ev.target.closest('[data-ledger-uid]');
      if (lb) { ev.preventDefault(); openLedger(lb.dataset.ledgerUid); return; }
      var ab = ev.target.closest('[data-action-uid]');
      if (ab) { ev.preventDefault(); closeDr(); goActId(ab.dataset.actionUid); return; }
      var cb = ev.target.closest('[data-credit-uid]');
      if (cb) { ev.preventDefault(); openCreditModal(cb.dataset.creditUid, cb.dataset.creditName, cb.dataset.creditBal); return; }
      var pb = ev.target.closest('[data-pw-uid]');
      if (pb) { ev.preventDefault(); openPwModal(pb.dataset.pwUid, pb.dataset.pwName); return; }
    });
    /* delegated: chat view */
    document.addEventListener('click', function(ev) {
      var btn = ev.target.closest('[data-cid]');
      if (btn) { ev.preventDefault(); viewChat(btn.dataset.cid, btn.dataset.en, btn.dataset.cn, btn.dataset.rt); }
    });
    /* delegated: approve/reject refunds */
    document.addEventListener('click', function(ev) {
      var ap = ev.target.closest('[data-approve]');
      if (ap) {
        ev.preventDefault();
        var id = ap.dataset.approve, cr = ap.dataset.credits;
        if (!confirm('Approve ' + cr + ' credits?')) return;
        var note = ''; var nt = g('tn-' + id); if (nt) note = nt.value;
        api('tickets/' + id + '/approve', 'POST', { note: note }).then(function(d) {
          if (d.success) { toast('Approved: ' + d.creditsAdded + ' credits'); var c = g('tc-' + id); if (c) c.parentNode.removeChild(c); loadDashboard(); }
          else toast(d.message || 'Failed', 'e');
        }).catch(function() { toast('Error', 'e'); });
        return;
      }
      var rj = ev.target.closest('[data-reject]');
      if (rj) {
        ev.preventDefault();
        var rid = rj.dataset.reject;
        if (!confirm('Reject this refund?')) return;
        var rnote = ''; var rnt = g('tn-' + rid); if (rnt) rnote = rnt.value;
        api('tickets/' + rid + '/reject', 'POST', { note: rnote }).then(function(d) {
          if (d.success) { toast('Rejected', 'i'); var rc = g('tc-' + rid); if (rc) rc.parentNode.removeChild(rc); }
          else toast(d.message || 'Failed', 'e');
        }).catch(function() { toast('Error', 'e'); });
      }
    });
    /* delegated: action buttons (ban/warn/flag) */
    document.addEventListener('click', function(ev) {
      var btn = ev.target.closest('[data-act]');
      if (!btn) return;
      ev.preventDefault(); ev.stopPropagation();
      var act = btn.dataset.act, uid = btn.dataset.uid, nm = btn.dataset.nm;
      if (act === 'warn') {
        var reason = prompt('Warning reason for ' + nm + ':');
        if (!reason) return;
        doAct(uid, act, reason);
      } else if (act === 'restrict') {
        var rReason = prompt('Restriction reason for ' + nm + ' (this will directly restrict the account):');
        if (!rReason) return;
        // Set warnings to 3 and restrict via warn action x3 — or use unrestrict+warn shortcut
        // We call warn 3 times isn't clean, so use a direct approach:
        api('users/' + uid + '/action', 'POST', { action: 'warn', reason: rReason })
          .then(function() { return api('users/' + uid + '/action', 'POST', { action: 'warn', reason: rReason }); })
          .then(function() { return api('users/' + uid + '/action', 'POST', { action: 'warn', reason: rReason }); })
          .then(function(d) { toast(d.message || 'Restricted'); searchActions(); })
          .catch(function() { toast('Error', 'e'); });
      } else {
        if (!confirm(act + ' ' + nm + '?')) return;
        doAct(uid, act, '');
      }
    });
    /* delegated: post edit */
    document.addEventListener('click', function(ev) {
      var btn = ev.target.closest('[data-edit-post]');
      if (btn) { ev.preventDefault(); openPostModal(btn.dataset.editPost); }
    });
    /* delegated: review delete */
    document.addEventListener('click', function(ev) {
      var btn = ev.target.closest('[data-del-review]');
      if (btn) {
        ev.preventDefault();
        if (!confirm('Delete this review?')) return;
        api('ratings/' + btn.dataset.delReview, 'DELETE').then(function(d) {
          if (d.success) { toast('Review deleted'); loadReviews(); }
          else toast(d.message || 'Failed', 'e');
        }).catch(function() { toast('Error', 'e'); });
      }
    });
    /* delegated: registration approve/reject */
    document.addEventListener('click', function(ev) {
      var btn = ev.target.closest('[data-reg-action]');
      if (btn) {
        ev.preventDefault();
        var uid = btn.dataset.regAction, action = btn.dataset.action, nm = btn.dataset.nm;
        if (!confirm(action + ' ' + nm + '?')) return;
        api('users/' + uid + '/action', 'POST', { action: action }).then(function(d) {
          if (d.success) { toast(d.message); loadRegistrations(); }
          else toast(d.message || 'Failed', 'e');
        }).catch(function() { toast('Error', 'e'); });
      }
    });
    /* delegated: open ticket detail */
    document.addEventListener('click', function(ev) {
      var btn = ev.target.closest('[data-tk-id]');
      if (btn) { ev.preventDefault(); openTicketModal(btn.dataset.tkId); }
    });
    /* delegated: add manual refund */
    document.addEventListener('click', function(ev) {
      var btn = ev.target.closest('[data-manual-refund]');
      if (btn) { ev.preventDefault(); openCreditModal(btn.dataset.manualRefund, btn.dataset.nm, btn.dataset.bal); }
    });
  }

  /* ═══ DATE FILTER ════════════════════════════════════════════════════════ */
  function applyDates() {
    var f = g('dfF').value, t = g('dfT').value;
    if (!f && !t) { toast('Select at least one date', 'i'); return; }
    dF = f; dT = t;
    refresh();
    toast('Date filter applied', 'i');
  }
  function clearDates() {
    dF = ''; dT = '';
    g('dfF').value = ''; g('dfT').value = '';
    refresh();
  }

  /* ═══ AUTH ═══════════════════════════════════════════════════════════════ */
  function doLogin() {
    var id = g('liId').value.trim(), pw = g('liPw').value;
    g('lerr').textContent = '';
    if (!id || !pw) { g('lerr').textContent = 'Please fill all fields'; return; }
    g('lerr').textContent = 'Signing in...';
    g('lerr').style.color = '#a0a0b8';
    fetch(API + '/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adminId: id, password: pw }) })
      .then(function(r) { return r.json(); })
      .then(function(r) {
        g('lerr').style.color = '#ef4444';
        if (r.success) {
          tok = r.token; adm = r.admin;
          localStorage.setItem('admTok', tok);
          localStorage.setItem('admData', JSON.stringify(adm));
          showApp();
        } else { g('lerr').textContent = r.message || 'Invalid credentials'; }
      })
      .catch(function(err) { g('lerr').style.color = '#ef4444'; g('lerr').textContent = 'Connection failed: ' + err.message; });
  }

  function showApp() {
    g('loginWrap').style.display = 'none';
    g('appWrap').style.display = 'block';
    startAdminInactivity();
    // Dashboard stat card clicks
    document.addEventListener('click', function(ev) {
      var sc = ev.target.closest('[data-goto]');
      if (sc) { ev.preventDefault(); goTo(sc.dataset.goto); }
    });
    var nm = (adm && adm.name) ? adm.name : 'Admin';
    g('sbNm').textContent = nm; g('sbId').textContent = (adm && adm.adminId) || ''; g('sbAv').textContent = nm.charAt(0).toUpperCase();
    if(g('msbNm')) g('msbNm').textContent = nm;
    if(g('msbId')) g('msbId').textContent = (adm && adm.adminId) || '';
    if(g('msbAv')) g('msbAv').textContent = nm.charAt(0).toUpperCase();
    loadDashboard();
  }

  function doLogout() {
    stopAdminInactivity();
    localStorage.removeItem('admTok'); localStorage.removeItem('admData');
    tok = ''; adm = null;
    g('appWrap').style.display = 'none';
    g('loginWrap').style.display = 'flex';
  }

  /* ═══ API ════════════════════════════════════════════════════════════════ */
  function api(path, method, body, noauth) {
    var opts = { method: method || 'GET', headers: { 'Content-Type': 'application/json' } };
    if (!noauth && tok) { opts.headers['Authorization'] = 'Bearer ' + tok; }
    if (body) { opts.body = JSON.stringify(body); }
    return fetch(API + '/' + path, opts).then(function(r) { return r.json(); });
  }

  function qs(obj) {
    var p = [];
    if (obj) { Object.keys(obj).forEach(function(k) { if (obj[k] && obj[k] !== 'all') p.push(k + '=' + encodeURIComponent(obj[k])); }); }
    if (dF) p.push('from=' + dF);
    if (dT) p.push('to=' + dT);
    return p.length ? '?' + p.join('&') : '';
  }

  /* ═══ NAVIGATION ═════════════════════════════════════════════════════════ */
  function refresh() {
    var a = document.querySelector('.sec.on'); if (!a) return;
    var s = a.id.replace('sec-', '');
    var m = sectionLoaders();
    if (m[s]) m[s]();
  }

  function sectionLoaders() {
    return {
      dashboard: loadDashboard,
      heatmap: loadHeatmap,
      experts: function() { loadUsers('expert'); },
      clients: function() { loadUsers('client'); },
      approaches: loadApproaches,
      chats: loadChats,
      credits: loadCredits,
      refunds: loadRefunds,
      actions: function() { g('acSrch').value=''; setT('acTbl','<tr><td colspan="6" style="text-align:center;padding:26px;color:#606078">Search for a user to take action</td></tr>'); },
      tickets: loadTickets,
      posts: loadPosts,
      reviews: loadReviews,
      registrations: loadRegistrations,
             kyc: loadKycRequests,
      payments: loadPayments,
      communication: function() { loadCommHistory(); },
      invoices: function() { loadInvExperts(); },
      settings: function() { loadSettingsTab(); },
       suspReq: loadSuspendedRequests,
       reports: loadReports,
emailNotifications: loadEmailNotifications,
       revenue: loadRevenue,
         audit: loadAudit
    };
  }

  var PT = { dashboard:'Dashboard', revenue:'Revenue Dashboard', audit:'Audit Log', heatmap:'Geographic Heatmap', experts:'Experts', clients:'Clients', approaches:'Approaches', chats:'Chats', credits:'Credits', refunds:'Refunds', actions:'Actions', tickets:'Tickets', posts:'Posts', reviews:'Reviews', registrations:'Registrations', kyc:'KYC Review', payments:'Payments', communication:'Communication', invoices:'Invoices', settings:'Settings', suspReq:'Suspended Requests', reports:'Reports', emailNotifications: 'Email Notifications' };
  var PS = { dashboard:'Platform overview', revenue:'Credits, earnings & service breakdown', audit:'Full filterable activity log', heatmap:'Expert & client locations across India', experts:'All registered experts', clients:'All registered clients', approaches:'Expert approach activity', chats:'All conversations', credits:'Credit ledger', refunds:'Pending refund requests', actions:'Ban, warn and flag users', tickets:'All support tickets', posts:'User posted requests', reviews:'Ratings & reviews', registrations:'Expert approval queue', kyc:'Identity verification queue', payments:'Failed payment tracking', communication:'Bulk email & notifications', invoices:'Generate invoices', settings:'Admin configuration & platform management', suspReq:'Posts flagged by 3+ experts pending admin review', reports:'All user reports and admin actions' , emailNotifications: 'Email logs and notification settings'};  function goTo(s) {
    qa('.sec').forEach(function(e) { e.classList.remove('on'); });
    qa('.ni').forEach(function(e) { e.classList.remove('on'); });
    qa('.mni').forEach(function(e) { e.classList.remove('on'); });
    var sec = g('sec-' + s); if (sec) sec.classList.add('on');
    qa('[data-s="' + s + '"]').forEach(function(el){ el.classList.add('on'); });
    g('ptitle').textContent = PT[s] || s;
    g('psub').textContent = PS[s] || '';
    var m = sectionLoaders();
    if (m[s]) m[s]();
  }

  /* ═══ HELPERS ════════════════════════════════════════════════════════════ */
  function fmt(d) { return d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'; }
  function fmtT(d) { return d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'; }

  function toast(msg, t) {
    var el = document.createElement('div'); el.className = 'toast-el ' + (t || 's'); el.textContent = msg;
    document.body.appendChild(el); setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 3500);
  }

  function bdg(s) {
    var m = { pending:'byw', accepted:'bgr', rejected:'brd', active:'bbl', completed:'bgr', cancelled:'brd', resolved:'btl', pending_review:'byw', client:'bbl', expert:'bo', banned:'brd', open:'bbl', flagged:'brd', approved:'bgr' };
    return '<span class="badge ' + (m[s] || 'bgy') + '">' + esc(s) + '</span>';
  }
  function ust(u) {
    if (u.isBanned) return '<span class="badge brd">Banned</span>';
      if (u.isRestricted) return '<span class="badge brd">Restricted</span>';
    if (u.isFlagged) return '<span class="badge byw">Flagged</span>';
    return '<span class="badge bgr">Active</span>';
  }
  function stars(n) { var s = ''; for (var i=0;i<5;i++) s += (i<n?'&#11088;':'&#9734;'); return '<span style="font-size:11px">' + s + '</span>'; }
  function setT(id, html) { var el = g(id); if (el) el.innerHTML = html || '<tr><td colspan="20" style="text-align:center;padding:30px;color:#606078">No data found</td></tr>'; }
  function spin() { return '<tr><td colspan="20" style="text-align:center;padding:24px"><div class="spin"></div></td></tr>'; }
  function uLnk(uid, name, col) { return '<span data-uid="' + esc(uid) + '" style="cursor:pointer;color:' + (col || '#FC8019') + ';font-weight:600">' + esc(name) + '</span>'; }

  function openModal(id) { var m = g(id); if (m) m.classList.add('on'); }
  function closeModal(id) { var m = g(id); if (m) m.classList.remove('on'); }

  /* ═══ EXPORT CSV ═════════════════════════════════════════════════════════ */
  function exportCSV(data, filename) {
    if (!data.length) { toast('No data to export', 'i'); return; }
    var keys = Object.keys(data[0]);
    var csv = keys.join(',') + '\n' + data.map(function(row) {
      return keys.map(function(k) {
        var v = row[k] || '';
        return '"' + String(v).replace(/"/g, '""') + '"';
      }).join(',');
    }).join('\n');
    var a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = filename + '.csv';
    a.click();
  }

  /* ═══ DASHBOARD ══════════════════════════════════════════════════════════ */
  function loadDashboard() {
    api('stats' + qs({})).then(function(d) {
      if (!d.success) return;
      var st = d.stats, cr = st.credits || {};
      g('sgrid').innerHTML = [
        sc('Total Clients', st.totalClients, 'cb', 'clients'),
        sc('Total Experts', st.totalExperts, 'co', 'experts'),
        sc('Approaches', st.totalApproaches, '', 'approaches', (st.openApproaches||0) + ' open / ' + (st.closedApproaches||0) + ' closed'),
        sc('Requests', st.totalRequests, '', 'posts'),
        sc('Reviews', st.totalReviews || 0, 'cy', 'reviews'),
        sc('Credits Purchased', cr.totalPurchased || 0, 'cg', 'credits-purchase'),
        sc('Amount Paid (₹)', '₹' + (cr.totalAmountPaid || 0).toLocaleString('en-IN'), 'cg', 'credits'),
        sc('Credits Spent', cr.totalSpent || 0, 'co', 'credits-spent'),
        sc('Credits Refunded', cr.totalRefunded || 0, 'cpu', 'credits-refund'),
        sc('Pending Refunds', st.pendingRefunds || 0, 'cy', 'refunds'),
        sc('Open Tickets', st.openTickets || 0, 'cb', 'tickets')
      ].join('');
      var rb = g('rbadge'); if ((st.pendingRefunds||0) > 0) { rb.textContent = st.pendingRefunds; rb.style.display = 'inline-block'; }
      var tb = g('tkbadge'); if ((st.openTickets||0) > 0) { tb.textContent = st.openTickets; tb.style.display = 'inline-block'; }
      setT('recentTbl', (d.recentUsers || []).map(function(u) {
        return '<tr><td>' + uLnk(u._id, u.name) + '</td><td>' + bdg(u.role) + '</td><td style="font-size:12px;color:#a0a0b8">' + esc(u.email) + '</td><td style="color:#f59e0b">' + (u.credits || 0) + '</td><td style="font-size:12px;color:#a0a0b8">' + fmt(u.createdAt) + '</td></tr>';
      }).join(''));
    }).catch(function(e) { console.error('Dashboard err:', e); });
  }

  function sc(label, val, col, goto_, sub) {
    var cl = goto_ ? ' cl" data-goto="' + goto_ + '"' : '"';
    var colorMap = { cb:'#3b82f6', co:'#FC8019', cg:'#22c55e', cy:'#f59e0b', cpu:'#a855f7', cblu:'#3b82f6', '':'#f0f0f4' };
    var clr = colorMap[col] || '#f0f0f4';
    return '<div class="sc' + cl + '><div class="sclbl">' + label + '</div><div class="scval" style="color:' + clr + '">' + val + '</div>' + (sub ? '<div class="scsub">' + sub + '</div>' : '') + (goto_ ? '<div class="sclink">View &rarr;</div>' : '') + '</div>';
  }

  /* ═══ USERS ══════════════════════════════════════════════════════════════ */
  function loadUsers(role) {
    var si = role === 'expert' ? 'eSrch' : 'cSrch', ti = role === 'expert' ? 'eTbl' : 'cTbl';
    var key = role === 'expert' ? 'experts' : 'clients';
    var srch = g(si) ? g(si).value : '';
    _pages[key] = 1;
    setT(ti, spin());
    api('users' + qs({ role: role, search: srch })).then(function(d) {
      if (!d.success) { setT(ti, ''); return; }
      var card = document.querySelector('#sec-' + (role==='expert'?'experts':'clients') + ' .ch');
      if (card && !card.querySelector('.exp-btn')) {
        var eb = document.createElement('button');
        eb.className = 'btn bgho exp-btn'; eb.textContent = 'Export CSV';
        eb.onclick = function() {
          exportCSV((d.users||[]).map(function(u) {
            return { Name: u.name, Email: u.email, Phone: u.phone||'', Role: u.role, Credits: u.credits||0, Status: u.isBanned?'Banned':u.isFlagged?'Flagged':'Active', Joined: fmt(u.createdAt) };
          }), role + 's-export');
        };
        card.appendChild(eb);
      }
      pagSlice(key, d.users || []);
      renderUsersPage(role);
    }).catch(function() { setT(ti, ''); });
  }

  function renderUsersPage(role) {
    var key = role === 'expert' ? 'experts' : 'clients';
    var ti = role === 'expert' ? 'eTbl' : 'cTbl';
    var page = pagSlice(key, _pageData[key] || []);
    var existing = document.getElementById('pag-' + key);
    if (existing) existing.remove();
    if (role === 'expert') {
      setT('eTbl', page.map(function(u) {
        return '<tr><td>' + uLnk(u._id, u.name) + '</td><td style="font-size:12px;color:#a0a0b8">' + esc(u.email) + '</td><td style="font-size:12px">' + (u.phone||'-') + '</td><td style="color:#f59e0b">' + (u.credits||0) + '</td><td>' + (u.rating||'-') + '</td><td>' + ust(u) + '</td><td style="font-size:12px;color:#a0a0b8">' + fmt(u.createdAt) + '</td><td><span class="btn bgho" data-uid="' + esc(u._id) + '">View</span></td></tr>';
      }).join(''));
    } else {
      setT('cTbl', page.map(function(u) {
        return '<tr><td>' + uLnk(u._id, u.name) + '</td><td style="font-size:12px;color:#a0a0b8">' + esc(u.email) + '</td><td style="font-size:12px">' + (u.phone||'-') + '</td><td>' + ust(u) + '</td><td style="font-size:12px;color:#a0a0b8">' + fmt(u.createdAt) + '</td><td><span class="btn bgho" data-uid="' + esc(u._id) + '">View</span></td></tr>';
      }).join(''));
    }
    pagHTML(key, ti);
  }

  /* ═══ USER DRAWER ════════════════════════════════════════════════════════ */
  function openDr(uid) {
    if (!uid) return;
    g('ov1').classList.add('on'); g('dr1').classList.add('on');
    g('drB').innerHTML = '<div style="text-align:center;padding:40px"><div class="spin"></div></div>';
    g('drTabs').innerHTML = '';
    api('users/' + uid + qs({})).then(function(d) {
      if (!d.success) { g('drB').innerHTML = '<div class="empty"><h3>Failed to load</h3></div>'; return; }
      g('drT').textContent = d.user.name;
      buildDr(d.user, d);
    }).catch(function() { g('drB').innerHTML = '<div class="empty"><h3>Error</h3></div>'; });
  }

  function buildDr(u, d) {
    var tabs = ['Profile', 'Transactions', u.role === 'expert' ? 'Approaches' : 'Requests', 'Tickets'];
    g('drTabs').innerHTML = tabs.map(function(t, i) {
      return '<div class="drt' + (i===0?' on':'') + '" data-panel="dp' + i + '">' + t + '</div>';
    }).join('');
    g('drTabs').addEventListener('click', function(ev) {
      var tab = ev.target.closest('.drt'); if (!tab) return;
      qa('.drt').forEach(function(e) { e.classList.remove('on'); });
      qa('.drp').forEach(function(e) { e.classList.remove('on'); });
      tab.classList.add('on');
      var p = g(tab.dataset.panel); if (p) p.classList.add('on');
    });

    var pr = u.profile || {};
var av = u.profilePhoto ? '<img src="' + esc(u.profilePhoto) + '" alt="">' : esc((u.name||'?').charAt(0).toUpperCase());
var p0 = '<div class="uhero"><div class="uav">' + av + '</div><div class="uhi"><h3>' + esc(u.name) + '</h3><p>' + esc(u.email) + ' / ' + esc(u.phone||'No phone') + '</p><div style="display:flex;gap:5px;flex-wrap:wrap">' + bdg(u.role) + ust(u) + (u.warnings ? '<span class="badge bo">' + u.warnings + ' warns</span>' : '') + '</div></div></div>';

var loc = u.location || {};
var locStr = [loc.city, loc.state, loc.pincode].filter(Boolean).join(', ') || [pr.city, pr.state, pr.pincode].filter(Boolean).join(', ') || '-';
var kycStatus = (u.kyc && u.kyc.status) || 'not_submitted';
var kycColor = kycStatus==='approved'?'#22c55e':kycStatus==='pending'?'#f59e0b':kycStatus==='rejected'?'#ef4444':'#606078';
var warnColor = (u.warnings||0)>=3?'#ef4444':(u.warnings||0)>0?'#f59e0b':'#22c55e';
var lastLoginStr = u.lastLogin
  ? new Date(u.lastLogin).toLocaleString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
      timeZone: 'Asia/Kolkata'
    }) + ' IST'
  : '<span style="color:#606078;font-style:italic">Never logged in</span>';
     
p0 += '<div style="display:flex;flex-direction:column;gap:12px;margin-top:4px">';

// ── Stat cards ──
p0 += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">';
p0 += '<div style="background:#18181d;border-radius:10px;padding:14px 16px"><div style="font-size:10px;color:#606078;text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px">Credits</div><div style="font-size:24px;font-weight:800;color:#f59e0b">' + (u.credits||0) + '</div></div>';
p0 += '<div style="background:#18181d;border-radius:10px;padding:14px 16px"><div style="font-size:10px;color:#606078;text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px">Rating</div><div style="font-size:24px;font-weight:800;color:#FC8019">' + (u.rating||'–') + '<span style="font-size:12px;color:#606078;font-weight:400;margin-left:4px">(' + (u.reviewCount||0) + ')</span></div></div>';
p0 += '<div style="background:#18181d;border-radius:10px;padding:14px 16px"><div style="font-size:10px;color:#606078;text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px">Warnings</div><div style="font-size:24px;font-weight:800;color:' + warnColor + '">' + (u.warnings||0) + '<span style="font-size:13px;color:#606078;font-weight:400">/3</span></div></div>';
p0 += '<div style="background:#18181d;border-radius:10px;padding:14px 16px"><div style="font-size:10px;color:#606078;text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px">Approaches</div><div style="font-size:24px;font-weight:800;color:#f0f0f4">' + (u.totalApproaches||0) + '</div></div>';
p0 += '</div>';

// ── Account info card ──
p0 += '<div style="background:#18181d;border-radius:10px;padding:14px 16px;display:flex;flex-direction:column;gap:0">';
p0 += '<div style="font-size:10px;color:#606078;text-transform:uppercase;letter-spacing:.06em;font-weight:700;margin-bottom:10px">Account Info</div>';
p0 += '<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid #222230"><span style="font-size:12px;color:#606078">Joined</span><span style="font-size:13px;color:#f0f0f4">' + fmt(u.createdAt) + '</span></div>';
p0 += '<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid #222230"><span style="font-size:12px;color:#606078">Last Login</span><span style="font-size:13px;color:#f0f0f4">' + lastLoginStr + '</span></div>';
p0 += '<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid #222230"><span style="font-size:12px;color:#606078">KYC</span><span style="font-size:13px;font-weight:600;color:' + kycColor + '">' + kycStatus.replace(/_/g,' ') + '</span></div>';
p0 += '<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0"><span style="font-size:12px;color:#606078">Location</span><span style="font-size:13px;color:#f0f0f4;text-align:right;max-width:62%">' + esc(locStr) + '</span></div>';
p0 += '</div>';

// ── Expert professional info card ──
if (u.role === 'expert') {
  var spec = u.specialization||pr.specialization, comp = u.companyName||pr.companyName||pr.company;
  var exp = u.yearsOfExperience||pr.yearsOfExperience||pr.experience, avail = u.availability||pr.availability;
  var website = u.websiteUrl||pr.websiteUrl||pr.website;
  if (spec||comp||exp||avail||website) {
    p0 += '<div style="background:#18181d;border-radius:10px;padding:14px 16px;display:flex;flex-direction:column;gap:0">';
    p0 += '<div style="font-size:10px;color:#606078;text-transform:uppercase;letter-spacing:.06em;font-weight:700;margin-bottom:10px">Professional</div>';
    var proRows = [];
    if (spec)    proRows.push(['Specialization', esc(spec), '#f0f0f4']);
    if (comp)    proRows.push(['Company', esc(comp), '#f0f0f4']);
    if (exp)     proRows.push(['Experience', esc(String(exp)) + ' yrs', '#f0f0f4']);
    if (avail)   proRows.push(['Availability', esc(avail), '#22c55e']);
    proRows.forEach(function(row, i) {
      p0 += '<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;' + (i<proRows.length-1||website?'border-bottom:1px solid #222230':'') + '"><span style="font-size:12px;color:#606078">' + row[0] + '</span><span style="font-size:13px;color:' + row[2] + ';font-weight:600">' + row[1] + '</span></div>';
    });
    if (website) p0 += '<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0"><span style="font-size:12px;color:#606078">Website</span><a href="' + esc(website) + '" target="_blank" style="font-size:13px;color:#FC8019;text-decoration:none;max-width:65%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(website) + '</a></div>';
    p0 += '</div>';
  }

  // Services
  var services = u.servicesOffered||(pr.servicesOffered)||[];
  if (typeof services === 'string') services = services.split(',').map(function(s){return s.trim();}).filter(Boolean);
   if (services.length) {
    p0 += '<div style="background:#18181d;border-radius:10px;padding:14px 16px">';
    p0 += '<div style="font-size:10px;color:#606078;text-transform:uppercase;letter-spacing:.06em;font-weight:700;margin-bottom:10px">Services Offered</div>';
    p0 += '<div style="display:flex;flex-wrap:wrap;gap:6px">' + services.map(function(s){ return '<span style="background:rgba(252,128,25,.12);color:#FC8019;border:1px solid rgba(252,128,25,.25);border-radius:6px;padding:5px 11px;font-size:12px;font-weight:600">' + esc(s) + '</span>'; }).join('') + '</div>';
    p0 += '</div>';
  }

  // Bio
  var bio = u.bio||pr.bio||pr.about;
  if (bio) {
    p0 += '<div style="background:#18181d;border-radius:10px;padding:14px 16px">';
    p0 += '<div style="font-size:10px;color:#606078;text-transform:uppercase;letter-spacing:.06em;font-weight:700;margin-bottom:10px">Bio</div>';
    p0 += '<div style="font-size:13px;color:#c0c0d8;line-height:1.7;white-space:pre-wrap">' + esc(bio) + '</div>';
    p0 += '</div>';
  }

  // Why Choose Me
  var why = u.whyChooseMe||pr.whyChooseMe;
  if (why) {
    p0 += '<div style="background:#18181d;border-radius:10px;padding:14px 16px">';
    p0 += '<div style="font-size:10px;color:#606078;text-transform:uppercase;letter-spacing:.06em;font-weight:700;margin-bottom:10px">Why Choose Me</div>';
    p0 += '<div style="font-size:13px;color:#c0c0d8;line-height:1.7;white-space:pre-wrap">' + esc(why) + '</div>';
    p0 += '</div>';
  }

  // Education
  var edu = u.education||pr.education;
  if (edu) {
    p0 += '<div style="background:#18181d;border-radius:10px;padding:14px 16px">';
    p0 += '<div style="font-size:10px;color:#606078;text-transform:uppercase;letter-spacing:.06em;font-weight:700;margin-bottom:10px">Education</div>';
    p0 += '<div style="font-size:13px;color:#c0c0d8;line-height:1.7;white-space:pre-wrap">' + esc(edu) + '</div>';
    p0 += '</div>';
  }

  // Portfolio — stored as plain string in profile
  var portfolioRaw = u.portfolio||pr.portfolio||'';
  var portfolioText = Array.isArray(portfolioRaw) ? portfolioRaw.map(function(l){ return typeof l==='string'?l:(l.url||l.title||''); }).join('\n') : portfolioRaw;
  if (portfolioText && portfolioText.trim()) {
    p0 += '<div style="background:#18181d;border-radius:10px;padding:14px 16px">';
    p0 += '<div style="font-size:10px;color:#606078;text-transform:uppercase;letter-spacing:.06em;font-weight:700;margin-bottom:10px">Portfolio</div>';
    p0 += '<div style="font-size:13px;color:#c0c0d8;line-height:1.7;white-space:pre-wrap">' + esc(portfolioText) + '</div>';
    p0 += '</div>';
  }
}

p0 += '</div>'; // close outer flex
     /* Action buttons */
    var actionRow = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">';
    actionRow += '<button class="btn bgho" style="justify-content:center" data-ledger-uid="' + u._id + '">Credit Ledger</button>';
    actionRow += '<button class="btn bywn" style="justify-content:center" data-credit-uid="' + u._id + '" data-credit-name="' + esc(u.name) + '" data-credit-bal="' + (u.credits||0) + '">Adjust Credits</button>';
    actionRow += '<button class="btn bgy" style="justify-content:center;background:rgba(255,255,255,.06);color:#f0f0f4" data-pw-uid="' + u._id + '" data-pw-name="' + esc(u.name) + '">Reset Password</button>';
    actionRow += '<button class="btn brdn" style="justify-content:center" data-action-uid="' + u._id + '">Take Action</button>';
    actionRow += '<button class="btn bpri" style="justify-content:center" data-dm-uid="' + u._id + '" data-dm-name="' + esc(u.name) + '">&#128172; Send DM</button>';
    actionRow += '<button class="btn bywn" style="justify-content:center" data-tk-uid="' + u._id + '" data-tk-name="' + esc(u.name) + '" data-tk-role="' + esc(u.role||'user') + '">&#43; Create Ticket</button>';
    actionRow += '</div>';
    p0 += actionRow;

    var cs = d.creditSummary, p1 = '';
    if (cs) { p1 = '<div class="ledger"><div class="lc"><label>Purchased</label><span style="color:#22c55e">+' + (cs.purchased||0) + '</span></div><div class="lc"><label>Spent</label><span style="color:#ef4444">-' + (cs.spent||0) + '</span></div><div class="lc"><label>Refunded</label><span style="color:#a855f7">+' + (cs.refunded||0) + '</span></div><div class="lc"><label>Balance</label><span style="color:#f59e0b">' + (cs.closing||0) + '</span></div></div>'; }
    p1 += '<div class="slbl">Transaction History</div>';
    p1 += (d.transactions||[]).length ? (d.transactions||[]).map(function(tx) {
      return '<div class="txi"><div><div class="txd">' + esc(tx.description||tx.type) + '</div><div class="txm">' + fmtT(tx.createdAt) + '</div></div><span class="txa ' + (tx.amount>0?'p':'n') + '">' + (tx.amount>0?'+':'') + tx.amount + '</span></div>';
    }).join('') : '<p style="color:#606078;font-size:13px;padding:8px">No transactions</p>';

    var items = u.role === 'expert' ? (d.approaches||[]) : (d.requests||[]);
    var p2 = '<div class="slbl">' + (u.role==='expert'?'Approaches':'Requests') + '</div>';
    p2 += items.length ? items.map(function(it) {
      var title = u.role === 'expert' ? ((it.request&&it.request.title)||'-') : (it.title||'-');
      var sub = fmtT(it.createdAt) + (u.role==='expert' ? ' / ' + (it.creditsSpent||0) + ' cr' + (it.client?' / '+esc(it.client.name||''):'') : '');
      return '<div class="txi" style="flex-direction:column;align-items:flex-start;gap:5px"><div style="display:flex;justify-content:space-between;width:100%;align-items:center"><div class="txd">' + esc(title) + '</div>' + bdg(it.status||'pending') + '</div><div class="txm">' + sub + '</div></div>';
    }).join('') : '<p style="color:#606078;font-size:13px;padding:8px">None</p>';

    var p3 = '<div class="slbl">Support Tickets</div>';
    p3 += (d.tickets||[]).length ? (d.tickets||[]).map(function(t) {
      return '<div class="txi" style="flex-direction:column;align-items:flex-start;gap:4px"><div style="display:flex;justify-content:space-between;width:100%"><span class="txd">' + esc(t.issueType||'Support') + '</span>' + bdg(t.status) + '</div><div class="txm">' + fmtT(t.createdAt) + ' / ' + (t.decision||'-') + ' / ' + (t.eligibleCredits||0) + ' cr</div></div>';
    }).join('') : '<p style="color:#606078;font-size:13px;padding:8px">No tickets</p>';

    g('drB').innerHTML = '<div class="drp on" id="dp0">' + p0 + '</div><div class="drp" id="dp1">' + p1 + '</div><div class="drp" id="dp2">' + p2 + '</div><div class="drp" id="dp3">' + p3 + '</div>';
  }

  function closeDr() { g('ov1').classList.remove('on'); g('dr1').classList.remove('on'); }

/* ═══ CREDIT MODAL ═══════════════════════════════════════════════════════ */
  function openCreditModal(uid, name, bal) {
    _creditUid = uid;
    g('creditModalInfo').innerHTML = '<strong>' + esc(name) + '</strong><br>Current balance: <span style="color:#f59e0b">' + bal + ' credits</span>';
    g('creditAmount').value = '';
    g('creditReason').value = '';
    // Inject Type selector if not already in modal
    if (!g('creditType')) {
      var ref = g('creditAmount');
      var wrap = ref && ref.parentNode;
      if (wrap) {
        var div = document.createElement('div');
        div.style.cssText = 'margin-bottom:14px';
        div.innerHTML =
          '<label style="display:block;font-size:10px;color:#606078;text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px">TRANSACTION TYPE</label>' +
          '<select id="creditType" style="width:100%;padding:10px 12px;background:#18181d;border:1px solid rgba(255,255,255,.1);border-radius:8px;color:#f0f0f4;font-size:13px">' +
            '<option value="refund">Refund (credit back to expert)</option>' +
            '<option value="bonus">Bonus (reward/gift credits)</option>' +
            '<option value="adjustment">Adjustment (manual correction)</option>' +
            '<option value="purchase">Purchase (credit buy)</option>' +
          '</select>';
        wrap.parentNode.insertBefore(div, wrap);
      }
    }
    // Reset type to refund when action is add
    var ca = g('creditAction');
    if (ca) ca.onchange = function() {
      var ct = g('creditType');
      if (!ct) return;
      ct.value = this.value === 'add' ? 'refund' : 'adjustment';
    };
    openModal('creditModal');
  }

  function submitCredit() {
    if (!_creditUid) return;
    var action = g('creditAction').value;   // add | deduct | set
    var amount = parseInt(g('creditAmount').value);
    var reason = g('creditReason').value;
    var txType = (g('creditType') && g('creditType').value) || (action === 'add' ? 'refund' : 'adjustment');
    if (!amount || amount <= 0) { toast('Enter valid amount', 'e'); return; }
    api('users/' + _creditUid + '/credits', 'POST', { action: action, amount: amount, reason: reason, type: txType })
      .then(function(d) {
        if (d.success) {
          toast('Credits updated! (' + txType + ')');
          closeModal('creditModal');
          closeDr();
        } else toast(d.message || 'Failed', 'e');
      }).catch(function() { toast('Error', 'e'); });
  }

  /* ═══ RESET PASSWORD MODAL ═══════════════════════════════════════════════ */
  function openPwModal(uid, name) {
    _pwUid = uid;
    g('pwModalInfo').textContent = 'Reset password for: ' + name;
    g('newPw').value = ''; g('newPw2').value = '';
    openModal('pwModal');
  }

  function submitPw() {
    if (!_pwUid) return;
    var p1 = g('newPw').value, p2 = g('newPw2').value;
    if (!p1 || p1.length < 8) { toast('Password must be 8+ characters', 'e'); return; }
    if (p1 !== p2) { toast('Passwords do not match', 'e'); return; }
    api('users/' + _pwUid + '/reset-password', 'POST', { newPassword: p1 })
      .then(function(d) {
        if (d.success) { toast('Password reset!'); closeModal('pwModal'); }
        else toast(d.message || 'Failed', 'e');
      }).catch(function() { toast('Error', 'e'); });
  }

  /* ═══ LEDGER ═════════════════════════════════════════════════════════════ */
  function openLedger(eid) {
    closeDr();
    g('ov1').classList.add('on'); g('dr1').classList.add('on');
    g('drT').textContent = 'Credit Ledger'; g('drTabs').innerHTML = '';
    g('drB').innerHTML = '<div style="text-align:center;padding:40px"><div class="spin"></div></div>';
    api('credits/expert/' + eid + qs({})).then(function(d) {
      if (!d.success) return;
      var sm = d.summary || {}, txs = d.transactions || [];
      var html = '<div class="ledger"><div class="lc"><label>Opening</label><span>' + (sm.opening||0) + '</span></div><div class="lc"><label>Purchased</label><span style="color:#22c55e">+' + (sm.purchased||0) + '</span></div><div class="lc"><label>Spent</label><span style="color:#ef4444">-' + (sm.spent||0) + '</span></div><div class="lc"><label>Balance</label><span style="color:#f59e0b">' + (sm.closing||0) + '</span></div></div>';
      html += '<div class="slbl">All Transactions (' + txs.length + ')</div>';
      html += txs.length ? txs.map(function(tx) {
        var sub = fmtT(tx.createdAt) + (tx.relatedClient&&tx.relatedClient.name?' / '+esc(tx.relatedClient.name):'') + (tx.relatedRequest&&tx.relatedRequest.title?' / '+esc(tx.relatedRequest.title):'');
        return '<div class="txi"><div><div class="txd">' + esc(tx.description||tx.type) + '</div><div class="txm">' + sub + '</div></div><div style="text-align:right"><div class="txa ' + (tx.amount>0?'p':'n') + '">' + (tx.amount>0?'+':'') + tx.amount + '</div><div class="txm">Bal: ' + (tx.balanceAfter||0) + '</div></div></div>';
      }).join('') : '<p style="color:#606078;font-size:13px;padding:8px">No transactions</p>';
      g('drB').innerHTML = html;
    }).catch(function() { g('drB').innerHTML = '<div class="empty"><h3>Error</h3></div>'; });
  }

  /* ═══ APPROACHES ═════════════════════════════════════════════════════════ */
    function loadApproaches() {
    _pages['approaches'] = 1;
    setT('apTbl', spin());

    // Fetch both regular approaches and expert invites in parallel
    Promise.all([
      api('approaches' + qs({ status: g('apSt').value })),
      api('interests' + qs({})).catch(function() { return { success: false, interests: [] }; })
    ]).then(function(results) {
      var d = results[0];
      var inviteData = results[1];
      var invites = (inviteData && inviteData.interests) || [];

      // ── Expert Invites Section (insert above main table if any exist) ──
      var inviteSection = document.getElementById('apInviteSection');
      if (!inviteSection) {
        // Create the invite section container above the approaches table
        var apSection = document.getElementById('apTbl');
        if (apSection) {
          var wrapper = apSection.closest('table') || apSection.parentNode;
          var div = document.createElement('div');
          div.id = 'apInviteSection';
          div.style.cssText = 'margin-bottom:20px;';
          wrapper.parentNode.insertBefore(div, wrapper);
          inviteSection = div;
        }
      }

      if (inviteSection) {
        if (invites.length > 0) {
          inviteSection.innerHTML =
            '<div style="font-size:15px;font-weight:700;color:#f0f0f4;margin-bottom:10px;">🎯 Expert Invites (' + invites.length + ')</div>' +
            '<div style="overflow-x:auto;">' +
            '<table style="width:100%;border-collapse:collapse;font-size:13px;">' +
            '<thead><tr style="background:#18181d;color:#606078;font-size:11px;text-transform:uppercase;">' +
            '<th style="padding:10px 12px;text-align:left;">Expert</th>' +
            '<th style="padding:10px 12px;text-align:left;">Client</th>' +
            '<th style="padding:10px 12px;text-align:left;">Masked Contact</th>' +
            '<th style="padding:10px 12px;text-align:left;">Status</th>' +
            '<th style="padding:10px 12px;text-align:left;">Date</th>' +
            '</tr></thead><tbody>' +
            invites.map(function(inv) {
              var statusBadge = inv.completed
  ? '<span class="badge bgr">✅ Completed</span>'
  : inv.unlocked
    ? '<span class="badge bbl">🔓 Unlocked</span>'
    : '<span class="badge byw">🔒 Pending</span>';
              return '<tr style="border-bottom:1px solid #1a1a24;">' +
                '<td style="padding:10px 12px;color:#FC8019;font-weight:600;">' + esc(inv.expert ? inv.expert.name : '—') + '</td>' +
                '<td style="padding:10px 12px;color:#a0a0b8;">' + esc(inv.clientName || '—') + '</td>' +
                '<td style="padding:10px 12px;font-family:monospace;font-size:12px;color:#a0a0b8;">' +
                  esc(inv.maskedPhone || '') + '<br>' + esc(inv.maskedEmail || '') +
                '</td>' +
                '<td style="padding:10px 12px;">' + statusBadge + '</td>' +
                '<td style="padding:10px 12px;color:#606078;font-size:12px;">' + fmt(inv.createdAt) + '</td>' +
                '</tr>';
            }).join('') +
            '</tbody></table></div>' +
            '<hr style="border:none;border-top:1px solid #1a1a24;margin:16px 0;">';
        } else {
          inviteSection.innerHTML = '';
        }
      }

      // ── Regular Approaches Table ──
      var allApproaches = d.approaches || [];
      pagSlice('approaches', allApproaches);
      renderApproachesPage(allApproaches);

      // Delegated events — set on container, persistent
      var apTblEl = document.getElementById('apTbl');
      if (apTblEl) {
        apTblEl.onclick = function(ev) {
          var ab = ev.target.closest('[data-ap-act]');
          var db = ev.target.closest('[data-ap-del]');
          var rm = ev.target.closest('[data-full-msg]');
          if (ab) { updateApproach(ab.dataset.apId, ab.dataset.apAct); }
          if (db) { if (confirm('Delete this approach?')) deleteApproach(db.dataset.apDel); }
          if (rm) { showMsgModal(rm.dataset.fullMsg); }
        };
      }
    }).catch(function() { setT('apTbl', ''); });
  }
   
  function updateApproach(id, status) {
    api('approaches/' + id, 'PUT', { status: status }).then(function(d) {
      if (d.success) { toast('Approach ' + status); loadApproaches(); }
      else toast(d.message||'Failed', 'e');
    }).catch(function() { toast('Error', 'e'); });
  }

  function deleteApproach(id) {
    api('approaches/' + id, 'DELETE').then(function(d) {
      if (d.success) { toast('Approach deleted'); loadApproaches(); }
      else toast(d.message||'Failed', 'e');
    }).catch(function() { toast('Error', 'e'); });
  }
function renderApproachesPage(arr) {
    if (arr) pagSlice('approaches', arr);
    var page = pagSlice('approaches', _pageData['approaches'] || []);
    var existing = document.getElementById('pag-approaches');
    if (existing) existing.remove();
    setT('apTbl', page.map(function(a) {
      var en = a.expert ? esc(a.expert.name||'-') : '-', eid = a.expert ? a.expert._id : '';
      var uid = 'ap_' + a._id;
      var quote = a.quote ? '₹' + Number(a.quote).toLocaleString('en-IN') : '—';
      var fullMsg = esc(a.message || '');
      var shortMsg = a.message ? (a.message.length > 60 ? esc(a.message.substring(0, 60)) + '… <span data-full-msg="' + fullMsg + '" style="color:#FC8019;cursor:pointer;font-size:12px;white-space:nowrap;">read more</span>' : fullMsg) : '—';
      var message = '<div style="max-width:200px;">' + shortMsg + '</div>';
      var actions = '<div style="position:relative;display:inline-block;"><button class="btn bgho" onclick="document.getElementById(\'' + uid + '\').style.display = document.getElementById(\'' + uid + '\').style.display===\'block\'?\'none\':\'block\'; event.stopPropagation();">Actions ▾</button><div id="' + uid + '" style="display:none;position:absolute;right:0;top:32px;background:#1a1a24;border:1px solid #2a2a38;border-radius:8px;z-index:100;min-width:120px;box-shadow:0 4px 16px rgba(0,0,0,0.4);">' + (a.status === 'pending' ? '<div data-ap-id="' + a._id + '" data-ap-act="accepted" style="padding:10px 14px;cursor:pointer;color:#22c55e;font-size:13px;font-weight:600;" onmouseover="this.style.background=\'#2a2a38\'" onmouseout="this.style.background=\'transparent\'">✓ Accept</div><div data-ap-id="' + a._id + '" data-ap-act="rejected" style="padding:10px 14px;cursor:pointer;color:#ef4444;font-size:13px;font-weight:600;" onmouseover="this.style.background=\'#2a2a38\'" onmouseout="this.style.background=\'transparent\'">✕ Reject</div>' : '') + '<div data-ap-del="' + a._id + '" style="padding:10px 14px;cursor:pointer;color:#a0a0b8;font-size:13px;border-top:1px solid #2a2a38;" onmouseover="this.style.background=\'#2a2a38\'" onmouseout="this.style.background=\'transparent\'">🗑 Delete</div></div></div>';
      var statusBadge = a.status === 'completed' ? '<span class="badge bgr">completed</span>' : bdg(a.status);
      return '<tr><td><span data-uid="' + eid + '" style="cursor:pointer;color:#FC8019;font-weight:600">' + en + '</span></td><td style="color:#a0a0b8">' + (a.client?esc(a.client.name):'-') + '</td><td style="font-size:12px">' + (a.request?esc(a.request.title):'-') + '</td><td style="color:#f59e0b;font-weight:700;">' + quote + '</td><td style="font-size:12px;color:#a0a0b8;max-width:180px;">' + message + '</td><td style="color:#f59e0b">' + (a.creditsSpent||0) + '</td><td>' + statusBadge + '</td><td style="font-size:12px;color:#a0a0b8">' + fmt(a.createdAt) + '</td><td>' + actions + '</td></tr>';
    }).join(''));
    pagHTML('approaches', 'apTbl');
  }
   
function showMsgModal(msg) {
    var existing = document.getElementById('msgReadModal');
    if (existing) existing.remove();
    var overlay = document.createElement('div');
    overlay.id = 'msgReadModal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px;';
    overlay.innerHTML =
      '<div style="background:#1a1a24;border:1px solid #2a2a38;border-radius:12px;max-width:480px;width:100%;padding:24px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">' +
          '<span style="font-size:15px;font-weight:700;color:#f0f0f4;">Expert Message</span>' +
          '<span onclick="document.getElementById(\'msgReadModal\').remove()" style="cursor:pointer;color:#606078;font-size:20px;line-height:1;">×</span>' +
        '</div>' +
        '<p style="font-size:14px;color:#a0a0b8;line-height:1.7;white-space:pre-wrap;">' + msg + '</p>' +
      '</div>';
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) overlay.remove();
    });
    document.body.appendChild(overlay);
  }
   
  /* ═══ CHATS ══════════════════════════════════════════════════════════════ */
  function loadChats() {
    _pages['chats'] = 1;
    setT('chTbl', spin());
    api('chats' + qs({})).then(function(d) {
      var chats = d.chats || [];
      pagSlice('chats', chats);
      renderChatsPage(chats);
    }).catch(function() { setT('chTbl', ''); });
  }

  function renderChatsPage(arr) {
    if (arr) pagSlice('chats', arr);
    var page = pagSlice('chats', _pageData['chats'] || []);
    var existing = document.getElementById('pag-chats');
    if (existing) existing.remove();
    setT('chTbl', page.map(function(c) {
        var en = c.expert ? esc(c.expert.name||'-') : '-', eid = c.expert ? c.expert._id : '';
        var cn = c.client ? esc(c.client.name||'-') : '-', cid2 = c.client ? c.client._id : '';
        var rt = c.request ? esc(c.request.title||'-') : (c.requestTitle ? esc(c.requestTitle) : '-');
        var lm = esc(((c.lastMessage||'No messages yet').substring(0, 50)));
        return '<tr>' +
          '<td><span data-uid="' + eid + '" style="cursor:pointer;color:#FC8019;font-weight:600">' + en + '</span></td>' +
          '<td><span data-uid="' + cid2 + '" style="cursor:pointer;color:#3b82f6;font-weight:600">' + cn + '</span></td>' +
          '<td style="font-size:12px">' + rt + '</td>' +
          '<td style="font-size:12px;color:#a0a0b8;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + lm + '</td>' +
          '<td style="font-size:12px;color:#a0a0b8">' + fmt(c.lastMessageAt||c.updatedAt||c.createdAt) + '</td>' +
          '<td><button class="btn bgho chat-view-btn" data-chat-id="' + c._id + '" data-en="' + en + '" data-cn="' + cn + '" data-rt="' + rt + '">View Chat</button></td>' +
          '</tr>';
      }).join(''));
    pagHTML('chats', 'chTbl');
    var tbl = document.getElementById('chTbl');
    if (tbl) {
      tbl.onclick = function(ev) {
        var btn = ev.target.closest('.chat-view-btn');
        if (!btn) return;
        viewChat(btn.dataset.chatId, btn.dataset.en, btn.dataset.cn, btn.dataset.rt);
      };
    }
  }

  function viewChat(cid, en, cn, rt) {
    g('ov2').classList.add('on'); g('dr2').classList.add('on');
    g('chDrT').textContent = en + ' ↔ ' + cn;
    g('chDrMeta').innerHTML = '<span class="badge bgy" style="margin-bottom:10px">' + esc(rt) + '</span>';
    g('chDrMsgs').innerHTML = '<div style="text-align:center;padding:20px"><div class="spin"></div></div>';
    // Render messages with smart name resolution using chat participants
    function renderChatMsgs(msgs, chatInfo) {
      if (!msgs.length) {
        g('chDrMsgs').innerHTML = '<div class="empty"><h3>No messages yet</h3><p style="font-size:13px;color:#606078">Conversation started but no messages sent yet</p></div>';
        return;
      }
      // Build lookup: expertId → expertName, clientId → clientName from backend response
      var expertId = chatInfo && chatInfo.expertId;
      var clientId = chatInfo && chatInfo.clientId;
      var expertName = (chatInfo && chatInfo.expert && chatInfo.expert.name) || en;
      var clientName = (chatInfo && chatInfo.client && chatInfo.client.name) || cn;

      g('chDrMsgs').innerHTML = msgs.map(function(m) {
        var senderObj = (m.sender && typeof m.sender === 'object') ? m.sender : null;
        // Try every possible field for sender name
        var sName = (senderObj && senderObj.name)
          || m.senderName || m.senderUsername || '';
        var sRole = (senderObj && senderObj.role)
          || m.senderRole || m.role || '';
        var sid   = senderObj ? String(senderObj._id || '') : String(m.sender || '');

        // If name still blank, resolve from chat participants by ID or role
        if (!sName) {
          if (expertId && sid && sid === String(expertId)) sName = expertName;
          else if (clientId && sid && sid === String(clientId)) sName = clientName;
          else if (sRole === 'expert') sName = expertName;
          else if (sRole === 'client') sName = clientName;
          else sName = en || cn || 'User';   // last resort
        }

        var isAdmin  = m.isAdminMessage || sRole === 'admin';
        var isExpert = !isAdmin && (sRole === 'expert' || (!sRole && sName === expertName));
        var cls = isAdmin ? 'admin' : (isExpert ? 'out' : 'in');
        var label = isAdmin ? '🔑 Admin' : esc(sName);
        var msgText = m.text || m.message || m.content || m.body || '';
        return '<div class="cmsg ' + cls + '">' +
          '<div class="cmeta">' + label +
            (sRole && !isAdmin ? '<span style="opacity:.55;font-size:10px;margin-left:5px">(' + sRole + ')</span>' : '') +
          '</div>' +
          '<div style="margin-top:3px;white-space:pre-wrap">' + esc(msgText || '[media]') + '</div>' +
          '<div class="cmeta" style="margin-top:4px;text-align:right">' + fmtT(m.createdAt) + '</div>' +
          '</div>';
      }).join('');
      setTimeout(function() { g('chDrMsgs').scrollTop = g('chDrMsgs').scrollHeight; }, 50);
    }

    api('chats/' + cid + '/messages').then(function(d) {
      var msgs = d.messages || (d.chat && d.chat.messages) || [];
      var chatInfo = d.chat || {};
      renderChatMsgs(msgs, chatInfo);
    }).catch(function() {
      // Fallback: GET the chat object directly
      api('chats/' + cid).then(function(d2) {
        var msgs2 = (d2.chat && d2.chat.messages) || d2.messages || [];
        renderChatMsgs(msgs2, d2.chat || {});
      }).catch(function() {
        g('chDrMsgs').innerHTML = '<p style="text-align:center;color:#ef4444;padding:20px">Error loading messages</p>';
      });
    });
  }

  function closeChDr() { g('ov2').classList.remove('on'); g('dr2').classList.remove('on'); }

  /* ═══ CREDITS ════════════════════════════════════════════════════════════ */
  function loadCredits() {
    var type = g('crType').value, srch = g('crSrch').value.toLowerCase();
    _pages['credits'] = 1;
    setT('crTbl', spin());
    api('credits' + qs({ type: type })).then(function(d) {
      var txs = d.transactions || [];
      if (srch) { txs = txs.filter(function(t) { return t.user && ((t.user.name||'').toLowerCase().indexOf(srch) >= 0 || (t.user.email||'').toLowerCase().indexOf(srch) >= 0); }); }
      pagSlice('credits', txs);
      renderCreditsPage(txs);
    }).catch(function() { setT('crTbl', ''); });
  }

  function renderCreditsPage(arr) {
    if (arr) pagSlice('credits', arr);
    var page = pagSlice('credits', _pageData['credits'] || []);
    var existing = document.getElementById('pag-credits');
    if (existing) existing.remove();
    var tc = { purchase:'bgr', spent:'bo', refund:'bpu', bonus:'btl' };
    setT('crTbl', page.map(function(tx) {
      var uid = tx.user ? tx.user._id : '', un = tx.user ? esc(tx.user.name||'-') : '-', ue = tx.user ? esc(tx.user.email||'') : '';
      var displayAmt = (tx.type === 'purchase' && tx.purchaseDetails && tx.purchaseDetails.amountPaid) ? '₹' + tx.purchaseDetails.amountPaid.toLocaleString('en-IN') : (tx.amount > 0 ? '+' : '') + tx.amount + ' cr';
      return '<tr><td><span data-uid="' + uid + '" style="cursor:pointer;color:#FC8019;font-weight:600">' + un + '</span><br><small style="color:#606078">' + ue + '</small></td><td><span class="badge ' + (tc[tx.type]||'bgy') + '">' + (tx.type||'') + '</span></td><td style="color:' + (tx.amount>0?'#22c55e':'#ef4444') + '">' + displayAmt + '</td><td style="color:#f59e0b">' + (tx.balanceAfter||0) + '</td><td style="font-size:12px;color:#a0a0b8">' + esc((tx.description||'-').substring(0, 40)) + '</td><td style="font-size:12px;color:#a0a0b8">' + fmtT(tx.createdAt) + '</td></tr>';
    }).join(''));
    pagHTML('credits', 'crTbl');
  }

  /* ═══ REFUNDS ════════════════════════════════════════════════════════════ */
  function loadRefunds() {
    g('rfList').innerHTML = '<div style="text-align:center;padding:40px"><div class="spin"></div></div>';
    /* load all experts too so admin can manually add credits */
    api('tickets?status=pending_review&limit=100').then(function(d) {
      var ts = d.tickets || [];
      var header = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px"><div style="font-size:13px;color:#a0a0b8">' + ts.length + ' pending requests</div><button class="btn bywn" id="manualCreditBtn">+ Manual Credit Adjustment</button></div>';
      if (!ts.length) {
        g('rfList').innerHTML = header + '<div class="empty"><h3>No pending refunds</h3></div>';
        g('manualCreditBtn').onclick = function() { openManualCredit(); };
        return;
      }
      g('rfList').innerHTML = header + ts.map(function(t) {
        var u = t.user || {}, uid = u._id || '', un = esc(u.name||'-'), ue = esc(u.email||'');
        var bk = (t.transactionBreakdown||[]).filter(function(b) { return b.eligible; }).map(function(b) {
          return '<div class="trow"><span>' + esc(b.clientName||'Client') + '</span><span style="color:#606078">' + esc(b.reason||'') + '</span><span style="color:#f59e0b">' + (b.creditsSpent||0) + ' cr</span></div>';
        }).join('');
        return '<div class="tcard" id="tc-' + t._id + '"><div class="ttop"><div class="ttu"><div class="ttav">' + esc((u.name||'U').charAt(0).toUpperCase()) + '</div><div class="tti"><strong>' + un + '</strong><small>' + ue + ' / ' + (u.credits||0) + ' credits</small></div></div><span class="badge byw">Pending</span></div><div class="tamt">+' + (t.eligibleCredits||0) + ' credits requested</div>' + bk + '<div style="font-size:12px;color:#606078;margin:8px 0">' + fmtT(t.createdAt) + '</div><textarea class="tnote" id="tn-' + t._id + '" rows="2" placeholder="Admin note (optional)..."></textarea><div class="tacrow"><button class="btn bgrn" style="flex:1;padding:10px" data-approve="' + t._id + '" data-credits="' + (t.eligibleCredits||0) + '">Approve ' + (t.eligibleCredits||0) + ' credits</button><button class="btn brdn" style="flex:1;padding:10px" data-reject="' + t._id + '">Reject</button><span class="btn bgho" style="padding:10px" data-uid="' + uid + '">Profile</span></div></div>';
      }).join('');
      g('manualCreditBtn').onclick = function() { openManualCredit(); };
    }).catch(function() { g('rfList').innerHTML = '<div class="empty"><h3>Failed to load</h3></div>'; });
  }

  function openManualCredit() {
    /* search for expert first */
    var nm = prompt('Enter expert name or email to add credits:');
    if (!nm) return;
    api('users' + qs({ role: 'expert', search: nm })).then(function(d) {
      var users = d.users || [];
      if (!users.length) { toast('No expert found', 'e'); return; }
      var u = users[0];
      openCreditModal(u._id, u.name, u.credits || 0);
    }).catch(function() { toast('Error', 'e'); });
  }

  /* ═══ TICKETS ════════════════════════════════════════════════════════════ */
  function loadTickets() {
    _pages['tickets'] = 1;
    setT('tkTbl', spin());
    var st = g('tkSt').value, srch = g('tkSrch').value;
    api('tickets' + qs({ status: st })).then(function(d) {
      var ts = d.tickets || [];
      if (srch) { srch = srch.toLowerCase(); ts = ts.filter(function(t) { return t.user && ((t.user.name||'').toLowerCase().indexOf(srch)>=0||(t.user.email||'').toLowerCase().indexOf(srch)>=0); }); }
      pagSlice('tickets', ts);
      renderTicketsPage(ts);
    }).catch(function() { setT('tkTbl', ''); });
  }

  function renderTicketsPage(arr) {
    if (arr) pagSlice('tickets', arr);
    var page = pagSlice('tickets', _pageData['tickets'] || []);
    var existing = document.getElementById('pag-tickets');
    if (existing) existing.remove();
    setT('tkTbl', page.map(function(t) {
      var u = t.user || {};
      var priMap = { high:'<span class="badge brd">🔴 High</span>', medium:'<span class="badge byw">🟡 Medium</span>', low:'<span class="badge bgy">🟢 Low</span>' };
        var priBadge = priMap[t.priority||'medium'] || priMap['medium'];
        return '<tr><td>' + uLnk(u._id||'', u.name||'-') + '<br><small style="color:#606078">' + esc(u.email||'') + '</small></td><td style="font-size:12px">' + esc(t.issueType||'-') + '</td><td style="font-size:12px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc((t.subject||t.description||'-').substring(0,60)) + '</td><td>' + priBadge + '</td><td>' + bdg(t.status) + '</td><td style="color:#f59e0b">' + (t.eligibleCredits||0) + '</td><td style="font-size:12px;color:#a0a0b8">' + fmt(t.createdAt) + '</td><td><button class="btn bgho" data-tk-id="' + t._id + '">View</button></td></tr>';    }).join(''));
    pagHTML('tickets', 'tkTbl');
  }

  function openTicketModal(tid) {
    _tkId = tid;
    g('tkModalBody').innerHTML = '<div style="text-align:center;padding:20px"><div class="spin"></div></div>';
    openModal('ticketModal');
    api('tickets/' + tid).then(function(d) {
      if (!d.success || !d.ticket) { g('tkModalBody').innerHTML = '<p style="color:#606078">Failed to load</p>'; return; }
      var t = d.ticket, u = t.user || {};
      g('tkModalTitle').textContent = 'Ticket: ' + (t.issueType || 'Support');
      var html = '<div class="uhero" style="margin-bottom:12px"><div class="ttav">' + esc((u.name||'U').charAt(0).toUpperCase()) + '</div><div><strong>' + esc(u.name||'-') + '</strong><div style="font-size:12px;color:#a0a0b8">' + esc(u.email||'') + '</div></div></div>';
      html += '<div class="igrid" style="margin-bottom:12px"><div class="ic"><label>Status</label>' + bdg(t.status) + '</div><div class="ic"><label>Credits Req</label><span style="color:#f59e0b">' + (t.eligibleCredits||0) + '</span></div><div class="ic"><label>Created</label><span>' + fmt(t.createdAt) + '</span></div><div class="ic"><label>Decision</label><span>' + (t.decision||'Pending') + '</span></div></div>';
      if (t.description) html += '<div class="tk-body" style="background:#18181d;padding:12px;border-radius:8px;margin-bottom:12px">' + esc(t.description) + '</div>';
      if ((t.transactionBreakdown||[]).length) {
        html += '<div class="slbl">Breakdown</div>';
        t.transactionBreakdown.forEach(function(b) {
          html += '<div class="trow"><span>' + esc(b.clientName||'Client') + '</span><span>' + esc(b.reason||'') + '</span><span style="color:' + (b.eligible?'#22c55e':'#606078') + '">' + (b.creditsSpent||0) + ' cr</span></div>';
        });
      }
      if (t.adminNote) html += '<div style="margin-top:12px;padding:10px;background:#18181d;border-radius:8px;font-size:12px;color:#a0a0b8">Admin note: ' + esc(t.adminNote) + '</div>';
      html += '<textarea class="tnote" id="tkNote" rows="2" placeholder="Add admin note..." style="margin-top:12px">' + (t.adminNote||'') + '</textarea>';

      // Canned responses
      var isActive = t.status === 'open' || t.status === 'escalated' || t.status === 'pending_review';
      if (isActive) {
        html += '<div style="margin-top:16px;border-top:1px solid #2a2a38;padding-top:14px">';
        html += '<div style="font-size:11px;color:#606078;text-transform:uppercase;letter-spacing:.07em;margin-bottom:10px;font-weight:700">Quick Canned Response</div>';
        html += '<div style="display:flex;flex-wrap:wrap;gap:8px">';
        var canned = [
          { type:'refund_approved',      label:'✅ Approve Refund',        color:'#22c55e' },
          { type:'not_eligible',         label:'❌ Not Eligible',           color:'#ef4444' },
          { type:'under_investigation',  label:'🔍 Under Investigation',    color:'#f59e0b' },
          { type:'resolved_no_action',   label:'✔ Resolved',               color:'#3b82f6' },
          { type:'contact_support',      label:'📞 Contact Support',        color:'#a855f7' }
        ];
        canned.forEach(function(c) {
          html += '<button onclick="sendCannedResponse(\'' + _tkId + '\',\'' + c.type + '\',this)" style="padding:7px 13px;border-radius:7px;border:1px solid ' + c.color + '40;background:' + c.color + '15;color:' + c.color + ';font-size:12px;font-weight:600;cursor:pointer">' + c.label + '</button>';
        });
        html += '</div></div>';
      }

      // Client Activity button
      html += '<div style="margin-top:12px">';
      html += '<button onclick="loadClientActivity(\'' + (t.user && t.user._id ? t.user._id : '') + '\',\'' + esc(t.user && t.user.name ? t.user.name : 'User') + '\')" style="padding:7px 14px;border-radius:7px;border:1px solid rgba(252,128,25,.3);background:rgba(252,128,25,.1);color:#FC8019;font-size:12px;font-weight:600;cursor:pointer">📋 Client Activity Log</button>';
      html += '</div>';

      g('tkModalBody').innerHTML = html;
      var isPending = t.status === 'pending_review';
      g('tkApproveBtn').style.display = isPending ? 'inline-flex' : 'none';
      g('tkRejectBtn').style.display = isPending ? 'inline-flex' : 'none';
      g('tkResolveBtn').style.display = (t.status === 'open' || t.status === 'escalated') ? 'inline-flex' : 'none';
    }).catch(function() { g('tkModalBody').innerHTML = '<p style="color:#606078">Error</p>'; });
  }

  function processTicket(action) {
    if (!_tkId) return;
    var note = ''; var nt = g('tkNote'); if (nt) note = nt.value;
    var path = action === 'resolve' ? ('tickets/' + _tkId + '/resolve') : ('tickets/' + _tkId + '/' + action);
    api(path, 'POST', { note: note }).then(function(d) {
      if (d.success) { toast(action === 'approve' ? 'Refund approved!' : action === 'reject' ? 'Rejected' : 'Resolved'); closeModal('ticketModal'); loadTickets(); loadDashboard(); }
      else toast(d.message || 'Failed', 'e');
    }).catch(function() { toast('Error', 'e'); });
  }

  /* ═══ POSTS ══════════════════════════════════════════════════════════════ */
  function loadPosts() {
    _pages['posts'] = 1;
    setT('poTbl', spin());
    var srch = g('poSrch').value, st = g('poSt').value;
    api('requests' + qs({ search: srch, status: st })).then(function(d) {
      var posts = d.requests || [];
      pagSlice('posts', posts);
      renderPostsPage(posts);
    }).catch(function() { setT('poTbl', ''); });
  }

  function renderPostsPage(arr) {
    if (arr) pagSlice('posts', arr);
    var page = pagSlice('posts', _pageData['posts'] || []);
    var existing = document.getElementById('pag-posts');
    if (existing) existing.remove();
    setT('poTbl', page.map(function(p) {
      var cname = p.client ? esc(p.client.name||'-') : '-';
      var cr = p.creditsRequired || p.creditsSpent || p.credits || 0;
      return '<tr><td style="font-size:13px;font-weight:600">' + esc((p.title||'-').substring(0,40)) + '</td><td>' + uLnk(p.client?p.client._id:'', cname, '#3b82f6') + '</td><td style="font-size:12px">' + esc(p.service||p.category||'-') + '</td><td style="color:#f59e0b">' + (p.budget||'-') + '</td><td>' + bdg(p.status||'open') + '</td><td style="color:#FC8019;font-weight:600">' + cr + '</td><td style="font-size:12px;color:#a0a0b8">' + fmt(p.createdAt) + '</td><td><button class="btn bgho" data-edit-post="' + p._id + '">Edit</button></td></tr>';
    }).join(''));
    pagHTML('posts', 'poTbl');
  }
   
function openPostModal(pid) {
    _editPostId = pid;
    api('requests/' + pid).then(function(d) {
      var p = d.request || {};
      g('postTitle').value = p.title || '';
      g('postDesc').value = p.description || '';
      g('postStatus').value = p.status || '';
      g('postCredits').value = p.credits || p.creditsRequired || 0;
      openModal('postModal');
    }).catch(function() { toast('Error loading post', 'e'); });
  }

  function savePost() {
    if (!_editPostId) return;
    var statusVal = g('postStatus').value;
    var creditsVal = parseInt(g('postCredits').value) || 0;
    var payload = {
      title: g('postTitle').value,
      description: g('postDesc').value,
      creditsRequired: creditsVal
    };
    // Only send status if admin explicitly chose one - empty means keep current
    if (statusVal) payload.status = statusVal;
    var btn = g('savePostBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
    api('requests/' + _editPostId, 'PUT', payload)
      .then(function(d) {
        if (btn) { btn.disabled = false; btn.textContent = 'Save Changes'; }
        if (d.success) {
          toast('Post updated');
          closeModal('postModal');
          _editPostId = null;
          loadPosts(); // fresh reload from server
        } else toast(d.message || 'Failed', 'e');
      }).catch(function() {
        if (btn) { btn.disabled = false; btn.textContent = 'Save Changes'; }
        toast('Error saving', 'e');
      });
  }

  function deletePost() {
    if (!_editPostId || !confirm('Delete this post permanently?')) return;
    api('requests/' + _editPostId, 'DELETE')
      .then(function(d) {
        if (d.success) { toast('Post deleted'); closeModal('postModal'); loadPosts(); }
        else toast(d.message || 'Failed', 'e');
      }).catch(function() { toast('Error', 'e'); });
  }

  /* ═══ REVIEWS ════════════════════════════════════════════════════════════ */
  function loadReviews() {
    _pages['reviews'] = 1;
    setT('rvTbl', spin());
    var srch = g('rvSrch').value;
    api('ratings' + qs({ search: srch })).then(function(d) {
      var reviews = d.ratings || [];
      pagSlice('reviews', reviews);
      renderReviewsPage(reviews);
    }).catch(function() { setT('rvTbl', ''); });
  }

  function renderReviewsPage(arr) {
    if (arr) pagSlice('reviews', arr);
    var page = pagSlice('reviews', _pageData['reviews'] || []);
    var existing = document.getElementById('pag-reviews');
    if (existing) existing.remove();
    setT('rvTbl', page.map(function(r) {
      var en = r.expert ? esc(r.expert.name||'-') : '-', eid = r.expert ? r.expert._id : '';
      var cl = r.client ? esc(r.client.name||'-') : '-';
      return '<tr><td><span data-uid="' + eid + '" style="cursor:pointer;color:#FC8019;font-weight:600">' + en + '</span></td><td style="color:#a0a0b8">' + cl + '</td><td>' + stars(r.rating||0) + ' <span style="font-size:11px;color:#f59e0b">' + (r.rating||0) + '</span></td><td style="font-size:12px;max-width:200px;overflow:hidden;text-overflow:ellipsis">' + esc((r.review||r.comment||'-').substring(0,80)) + '</td><td style="font-size:12px;color:#a0a0b8">' + fmt(r.createdAt) + '</td><td><button class="btn brdn" data-del-review="' + r._id + '">Delete</button></td></tr>';
    }).join(''));
    pagHTML('reviews', 'rvTbl');
  }

  /* ═══ REGISTRATIONS ══════════════════════════════════════════════════════ */
  function loadRegistrations() {
    _pages['registrations'] = 1;
    setT('rgTbl', spin());
    var st = g('rgSt').value;
    api('users' + qs({ role: 'expert', registrationStatus: st })).then(function(d) {
      var users = d.users || [];
       
      /* filter by approval status if field exists */
      if (st !== 'all') {
        users = users.filter(function(u) {
          if (st === 'pending') return !u.isApproved && !u.isRejected && !u.isBanned;
          if (st === 'approved') return u.isApproved;
          if (st === 'rejected') return u.isRejected || u.isBanned;
          return true;
        });
      }
      pagSlice('registrations', users);
      renderRegistrationsPage(users);
    }).catch(function() { setT('rgTbl', ''); });
  }

  function renderRegistrationsPage(arr) {
    if (arr) pagSlice('registrations', arr);
    var page = pagSlice('registrations', _pageData['registrations'] || []);
    var existing = document.getElementById('pag-registrations');
    if (existing) existing.remove();
    setT('rgTbl', page.map(function(u) {
        var pr = u.profile || {};
        var actions = '';
        if (!u.isApproved) actions += '<button class="btn bgrn" data-reg-action="' + u._id + '" data-action="approve" data-nm="' + esc(u.name) + '">Approve</button> ';
        if (!u.isBanned) actions += '<button class="btn brdn" data-reg-action="' + u._id + '" data-action="ban" data-nm="' + esc(u.name) + '">Reject</button>';
        var kycCount = [u.aadharDoc, u.panDoc, u.certificateDoc, u.kycDocument,
  (u.profile&&u.profile.aadhar), (u.profile&&u.profile.pan), (u.profile&&u.profile.certificate),
  (u.kyc && u.kyc.status && u.kyc.status !== 'not_submitted' ? u.kyc.docType : null)
].filter(Boolean).length;

var kycBtn = kycCount > 0
  ? '<button class="btn bpri" data-kyc-uid="' + u._id + '" data-kyc-name="' + esc(u.name) + '">' + (u.kyc && u.kyc.docType ? u.kyc.docType : kycCount + ' doc') + '</button>'
  : '<span style="font-size:11px;color:#606078">No docs</span>';
                var kycStatusMap = {
          not_submitted: '<span class="badge bgy">—</span>',
          pending:       '<span class="badge byw">⏳ Under Review</span>',
          approved:      '<span class="badge bgr">✅ Verified</span>',
          rejected:      '<span class="badge brd">❌ Rejected</span>'
        };
        var kycStatusBadge = kycStatusMap[(u.kyc && u.kyc.status) || 'not_submitted'];
        return '<tr><td>' + uLnk(u._id, u.name) + '</td><td style="font-size:12px;color:#a0a0b8">' + esc(u.email) + '</td><td style="font-size:12px">' + (u.phone||'-') + '</td><td style="font-size:12px">' + esc(pr.specialization||u.specialization||'-') + '</td><td>' + kycBtn + '</td><td>' + kycStatusBadge + '</td><td>' + (u.isApproved ? '<span class="badge bgr">Approved</span>' : u.isBanned ? '<span class="badge brd">Rejected</span>' : '<span class="badge byw">Pending</span>') + '</td><td style="font-size:12px;color:#a0a0b8">' + fmt(u.createdAt) + '</td><td>' + actions + '</td></tr>';
      }).join(''));
    pagHTML('registrations', 'rgTbl');
  }

  /* ═══ PAYMENTS ═══════════════════════════════════════════════════════════ */
  function loadPayments() {
    setT('pyTbl', spin());
    api('payments/failed' + qs({})).then(function(d) {
      var payments = d.payments || [];
      if (!payments.length) { setT('pyTbl', '<tr><td colspan="6" style="text-align:center;padding:30px;color:#606078">No failed payments found</td></tr>'); return; }
      setT('pyTbl', payments.map(function(p) {
        var u = p.user || {};
        return '<tr><td>' + uLnk(u._id||'', u.name||'-') + '<br><small style="color:#606078">' + esc(u.email||'') + '</small></td><td style="color:#ef4444">&#8377;' + (p.amount||0) + '</td><td style="font-size:12px">' + esc(p.gateway||'-') + '</td><td style="font-size:12px;color:#f59e0b">' + esc(p.failureReason||p.reason||'-') + '</td><td style="font-size:12px;color:#a0a0b8">' + fmtT(p.createdAt) + '</td><td><span class="btn bgho" data-uid="' + (u._id||'') + '">Profile</span></td></tr>';
      }).join(''));
    }).catch(function() { setT('pyTbl', '<tr><td colspan="6" style="text-align:center;padding:30px;color:#606078">Payments API not available</td></tr>'); });
  }

  /* ═══ COMMUNICATION ══════════════════════════════════════════════════════ */
  function previewComm() {
    var target = g('commTarget').value;
    var label = { all:'All Users', experts:'All Experts', clients:'All Clients', custom:'Custom List' }[target] || target;
    toast('Will send to: ' + label, 'i');
  }

  function sendComm() {
    var subj = g('commSubj').value.trim();
    var msg = g('commMsg').value.trim();
    var target = g('commTarget').value;
    if (!subj || !msg) { toast('Subject and message required', 'e'); return; }
    var payload = { subject: subj, message: msg, target: target };
    if (target === 'custom') { payload.emails = g('commEmails').value.split(',').map(function(e) { return e.trim(); }).filter(Boolean); }
    g('commStatus').textContent = 'Sending...';
    api('communications/send', 'POST', payload).then(function(d) {
      if (d.success) {
        g('commStatus').textContent = 'Sent to ' + (d.recipientCount || '?') + ' recipients!';
        g('commSubj').value = ''; g('commMsg').value = '';
        loadCommHistory();
      } else { g('commStatus').textContent = 'Failed: ' + (d.message || 'Unknown error'); g('commStatus').style.color = '#ef4444'; }
    }).catch(function() { g('commStatus').textContent = 'Error - check server logs'; g('commStatus').style.color = '#ef4444'; });
  }

  function loadCommHistory() {
    api('communications/history').then(function(d) {
      var logs = d.logs || [];
      setT('commHist', logs.length ? logs.map(function(l) {
        var typeTag = l.type === 'announcement' ? '<span class="badge bo">&#128276; Announcement</span>' : '<span class="badge bgy">&#128140; Email</span>';
        return '<tr><td>' + typeTag + '</td><td style="font-size:13px">' + esc(l.subject||l.title||'-') + '</td><td>' + bdg(l.target||'all') + '</td><td style="color:#22c55e">' + (l.recipientCount||0) + '</td><td style="font-size:12px;color:#a0a0b8">' + fmtT(l.createdAt) + '</td></tr>';
      }).join('') : '<tr><td colspan="5" style="text-align:center;padding:20px;color:#606078">No history yet</td></tr>');
    }).catch(function() {});
  }

  /* ═══ INVOICES ═══════════════════════════════════════════════════════════ */
  var _invExpertName = '';

  function loadInvExperts() {
    api('users' + qs({ role: 'expert', limit: 200 })).then(function(d) {
      var sel = g('invUserSel');
      sel.innerHTML = '<option value="">-- Select Expert --</option>';
      (d.users||[]).forEach(function(u) {
        var opt = document.createElement('option');
        opt.value = u._id;
        opt.textContent = u.name + ' (' + (u.email||'') + ')';
        opt.dataset.name = u.name;
        opt.dataset.email = u.email||'';
        opt.dataset.credits = u.credits||0;
        sel.appendChild(opt);
      });
    }).catch(function() {});
  }

  function onInvExpertChange() {
    var sel = g('invUserSel');
    var opt = sel.options[sel.selectedIndex];
    var uid = sel.value;
    var txSel = g('invTxSel');

    if (!uid) {
      txSel.innerHTML = '<option value="">-- Select Expert first --</option>';
      txSel.disabled = true;
      _invExpertName = '';
      g('invPreview').innerHTML = '<div class="empty"><h3>Select expert to preview</h3></div>';
      return;
    }

    _invExpertName = opt.dataset.name || opt.textContent;
    txSel.innerHTML = '<option value="">Loading transactions...</option>';
    txSel.disabled = true;

    // Load ALL credit transactions for this expert
    api('credits/expert/' + uid).then(function(d) {
      var txs = d.transactions || [];
      txSel.innerHTML = '<option value="">-- Select Transaction (optional) --</option>';
      if (!txs.length) {
        txSel.innerHTML += '<option value="" disabled>No transactions found</option>';
      } else {
        var typeIcon = { purchase:'🟢', bonus:'🟡', refund:'🟣', spent:'🔴', adjustment:'⚪' };
        txs.forEach(function(tx) {
          var opt = document.createElement('option');
          opt.value = tx._id;
          var dt = tx.createdAt ? new Date(tx.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : '';
          var icon = typeIcon[tx.type] || '⚫';
          var sign = tx.amount > 0 ? '+' : '';
          var label = icon + ' ' + dt + ' | ' + (tx.type||'?').toUpperCase() + ' | ' + sign + tx.amount + ' cr | ' + esc((tx.description||tx.type||'').substring(0,25));
          opt.textContent = label;
          opt.dataset.amount = Math.abs(tx.amount) || 0;
          opt.dataset.desc = tx.description || tx.type || '';
           opt.dataset.amountPaid = (tx.purchaseDetails && tx.purchaseDetails.amountPaid) || 0;
          opt.dataset.date = tx.createdAt ? tx.createdAt.split('T')[0] : '';
          opt.dataset.type = tx.type || '';
          txSel.appendChild(opt);
        });
      }
      txSel.disabled = false;
      previewInvoice();
    }).catch(function() {
      txSel.innerHTML = '<option value="">-- Select Transaction (optional) --</option>';
      txSel.disabled = false;
    });
  }

  function onInvTxChange() {
    var txSel = g('invTxSel');
    var opt = txSel.options[txSel.selectedIndex];
    if (!opt || !opt.value) { previewInvoice(); return; }

    // Auto-fill form fields from selected transaction
    var amt = parseFloat(opt.dataset.amount) || 0;
    var desc = opt.dataset.desc || '';
    var date = opt.dataset.date || '';

    // Convert credits to INR (adjust rate as needed — 1 credit = ₹10 by default)
    var txOpt = txSel.options[txSel.selectedIndex];
var actualPaid = parseFloat(txOpt.dataset.amountPaid) || 0;
var inrAmt = actualPaid > 0 ? actualPaid : amt * 10;
g('invAmt').value = inrAmt > 0 ? inrAmt : '';
    if (desc) g('invDesc').value = desc;
    if (date) g('invDate').value = date;

    previewInvoice();
  }

  function previewInvoice() {
    var sel = g('invUserSel');
    var userName = _invExpertName || (sel && sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].dataset.name : '') || 'Expert Name';
    var desc = g('invDesc').value;
    var amt = parseFloat(g('invAmt').value)||0;
    var date = g('invDate').value;
    var due = g('invDue').value;
    var notes = g('invNotes').value;

    if (!userName || userName === 'Expert Name') {
      g('invPreview').innerHTML = '<div class="empty"><h3>Select expert to preview</h3></div>';
      return;
    }

    // Tax rate — ALWAYS read live from select, never hardcode 18
    var taxRateSel = g('invTaxRate');
    var taxRate = 0; // default to 0, let user pick
    if (taxRateSel) {
      var tv = taxRateSel.value;
      if (tv === 'custom') {
        var ctEl = g('invCustomTax');
        taxRate = parseFloat((ctEl && ctEl.value) || '0') || 0;
      } else {
        taxRate = parseFloat(tv) || 0;
      }
    }
    var inv_no = 'WI-' + Date.now().toString().slice(-6);
    var taxAmt = (amt * taxRate / 100);
    var total = amt + taxAmt;
    var taxLabel = taxRate > 0 ? ('GST / Tax (' + taxRate + '%)') : 'Tax (Exempt)';
    var fmtDate = function(d) { return d ? new Date(d+'T00:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : '--'; };
    var fmtMoney = function(v) { return '&#8377;' + v.toFixed(2); };

    g('invPreview').innerHTML = '<div class="inv-preview">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">' +
        '<div><h2 style="font-size:22px;font-weight:800;color:#FC8019;margin-bottom:2px">WorkIndex</h2>' +
        '<div style="font-size:11px;color:#888;font-weight:600;letter-spacing:.08em">TAX INVOICE</div></div>' +
        '<div style="text-align:right;font-size:11px;color:#666">' +
          '<div>Invoice #: <strong style="color:#111">' + inv_no + '</strong></div>' +
          '<div>Date: ' + fmtDate(date) + '</div>' +
          '<div>Due: ' + fmtDate(due) + '</div>' +
        '</div>' +
      '</div>' +
      '<div style="margin-bottom:14px;padding:10px;background:#f9f9f9;border-radius:6px">' +
        '<div style="font-size:10px;color:#888;font-weight:700;text-transform:uppercase;margin-bottom:4px">Bill To</div>' +
        '<div style="font-weight:700;font-size:14px;color:#111">' + esc(userName) + '</div>' +
      '</div>' +
      '<div class="inv-row" style="font-weight:700;font-size:10px;color:#888;text-transform:uppercase"><span>Description</span><span>Amount</span></div>' +
      '<div class="inv-row"><span>' + esc(desc||'Professional Services') + '</span><span style="color:#111">' + fmtMoney(amt) + '</span></div>' +
      (taxRate > 0 ? '<div class="inv-tax-row"><span style="color:#888">' + taxLabel + '</span><span style="color:#888">' + fmtMoney(taxAmt) + '</span></div>' : '') +
      '<div class="inv-total" style="margin-top:8px;border-top:2px solid #FC8019;padding-top:10px"><span>Total Payable</span><span style="color:#FC8019">' + fmtMoney(total) + '</span></div>' +
      (notes ? '<div style="margin-top:12px;padding:8px;background:#f9f9f9;border-radius:5px;font-size:11px;color:#666"><strong>Notes:</strong> ' + esc(notes) + '</div>' : '') +
      '<div style="margin-top:16px;padding-top:10px;border-top:1px solid #eee;font-size:10px;color:#aaa;text-align:center">WorkIndex Platform · workindex-frontend.vercel.app</div>' +
    '</div>';
  }

  function genInvoice() {
    var preview = g('invPreview').querySelector('.inv-preview');
    if (!preview) { toast('Select an expert first', 'e'); return; }
    var w = window.open('', '_blank');
    w.document.write('<html><head><title>Invoice - WorkIndex</title><style>' +
      'body{font-family:system-ui;padding:30px;max-width:620px;margin:auto;color:#111}' +
      'h2{color:#FC8019;font-size:22px;font-weight:800;margin:0}' +
      '.inv-row{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #eee;font-size:13px}' +
      '.inv-total{display:flex;justify-content:space-between;padding:10px 0;font-weight:800;font-size:16px;border-top:2px solid #FC8019;margin-top:8px}' +
      '@media print{body{padding:10px}}' +
    '</style></head><body>' + g('invPreview').innerHTML + '</body></html>');
    w.document.close();
    setTimeout(function() { w.print(); }, 600);
  }

  /* ═══ ACTIONS ════════════════════════════════════════════════════════════ */
  function searchActions() {
    var srch = g('acSrch').value, role = g('acRole').value;
    setT('acTbl', spin());
    api('users' + qs({ role: role, search: srch })).then(function(d) {
      renderActTbl(d.users||[]);
    }).catch(function() { setT('acTbl', ''); });
  }

  function doAct(uid, act, reason) {
    api('users/' + uid + '/action', 'POST', { action: act, reason: reason || '' }).then(function(d) {
      if (d.success) { toast(d.message); searchActions(); }
      else toast(d.message || 'Failed', 'e');
    }).catch(function() { toast('Error', 'e'); });
  }

  function goActId(uid) {
    goTo('actions');
    setTimeout(function() {
      // Load all users and highlight the one we want
      g('acSrch').value = '';
      g('acRole').value = 'all';
      setT('acTbl', spin());
      api('users' + qs({ search: uid.slice(-8) })).then(function(d) {
        if (!d.success || !(d.users||[]).length) {
          // fallback: load all
          return api('users' + qs({})).then(function(d2) { renderActTbl(d2.users||[]); });
        }
        renderActTbl(d.users||[]);
      }).catch(function() { setT('acTbl', ''); });
    }, 200);
  }

  function renderActTbl(users) {
    setT('acTbl', users.map(function(u) {
      var bb = u.isBanned ? '<button class="btn bgrn" data-act="unban" data-uid="' + u._id + '" data-nm="' + esc(u.name) + '">Unban</button>' : '<button class="btn brdn" data-act="ban" data-uid="' + u._id + '" data-nm="' + esc(u.name) + '">Ban</button>';
      var fb = u.isFlagged ? '<button class="btn bgho" data-act="unflag" data-uid="' + u._id + '" data-nm="' + esc(u.name) + '">Unflag</button>' : '<button class="btn bgho" data-act="flag" data-uid="' + u._id + '" data-nm="' + esc(u.name) + '">Flag</button>';
      var rb = u.isRestricted
        ? '<button class="btn bgrn" data-act="unrestrict" data-uid="' + u._id + '" data-nm="' + esc(u.name) + '">Unrestrict</button>'
        : '<button class="btn bywn" style="background:rgba(239,68,68,.15);color:#fca5a5;border-color:rgba(239,68,68,.3)" data-act="restrict" data-uid="' + u._id + '" data-nm="' + esc(u.name) + '">Restrict</button>';      var warnBadge = (u.warnings||0) > 0 ? '<span style="color:' + ((u.warnings||0)>=3?'#ef4444':'#f59e0b') + ';font-weight:700">' + (u.warnings||0) + '/3</span>' : '0';
      return '<tr><td><strong>' + esc(u.name) + '</strong></td><td>' + bdg(u.role) + '</td><td style="font-size:12px;color:#a0a0b8">' + esc(u.email) + '</td><td>' + ust(u) + (u.isRestricted ? ' <span class="badge brd">Restricted</span>' : '') + '</td><td>' + warnBadge + '</td><td><div style="display:flex;gap:4px;flex-wrap:wrap">' + bb + '<button class="btn bywn" data-act="warn" data-uid="' + u._id + '" data-nm="' + esc(u.name) + '">Warn</button>' + fb + rb + '<span class="btn bgho" data-uid="' + u._id + '">View</span></div></td></tr>';    }).join(''));
  }

  /* ═══ HEATMAP ════════════════════════════════════════════════════════════ */
  var _hmData = {}, _hmState = null;
  // Indian states with rough SVG positions for bar chart (no external map needed)
  var IN_STATES = ['Maharashtra','Delhi','Karnataka','Tamil Nadu','Uttar Pradesh','Gujarat','Rajasthan','West Bengal','Telangana','Andhra Pradesh','Kerala','Madhya Pradesh','Punjab','Haryana','Bihar','Odisha','Jharkhand','Assam','Chhattisgarh','Uttarakhand','Himachal Pradesh','Goa','Tripura','Manipur','Meghalaya','Nagaland','Arunachal Pradesh','Mizoram','Sikkim','Chandigarh','Puducherry','Jammu and Kashmir','Ladakh'];

  function loadHeatmap() {
    var role = g('hmRole').value;
    g('hmMapArea').innerHTML = '<div style="text-align:center;padding:30px"><div class="spin"></div><div style="margin-top:8px;font-size:12px;color:#606078">Loading location data...</div></div>';
    g('hmBars').innerHTML = '';
    _hmState = null;
    g('hmCrumbs').innerHTML = '<span class="hm-crumb" data-level="country">India</span>';

    // Load users for heatmap - try up to 500 at a time
    var hmRole = role === 'all' ? '' : role;
    var hmQs = '?limit=500' + (hmRole ? '&role=' + hmRole : '') + (dF ? '&from=' + dF : '') + (dT ? '&to=' + dT : '');
    fetch(API + '/users' + hmQs, { headers: { Authorization: 'Bearer ' + tok } })
      .then(function(r) { return r.json(); })
      .then(function(d) {
      var users = d.users || [];
      // ── Location field mapping from index.html questionnaire: ──
      // Expert registration saves to profile.city (plain string e.g. "Bengaluru")
      //   + profile.pincode (6-digit) + profile.serviceLocationType
      // Client questionnaire saves fullAddress: {city,state,pincode,...} 
      //   stored as profile.fullAddress.city / profile.fullAddress.state
      // We use city as the top-level grouping since experts don't have state
      var byState = {};
      users.forEach(function(u) {
  var pr = u.profile || {};
  var city = null;
  var state = null;

  // 1. profile.fullAddress (client — in-person service)
  if (pr.fullAddress) {
    city  = (pr.fullAddress.city  || '').trim() || null;
    state = (pr.fullAddress.state || '').trim() || null;
  }

  // 2. profile.clientLocation (client — online service)
  if (!city && pr.clientLocation) {
    city  = (pr.clientLocation.city  || '').trim() || null;
    state = (pr.clientLocation.state || '').trim() || null;
  }

  // 3. profile.address (another client address variant)
  if (!city && pr.address) {
    city  = (pr.address.city  || '').trim() || null;
    state = (pr.address.state || '').trim() || null;
  }

  // 4. profile.city + profile.state (expert AND client)
  if (!city) {
    city = (pr.city || '').trim() || null;
  }
  if (!state) {
    state = (pr.state || '').trim() || null;
  }

  // 5. top-level user location field (fallback)
  if (!city && u.location) {
    city  = (u.location.city  || '').trim() || null;
    state = (u.location.state || '').trim() || null;
  }

  // 6. try to derive state from city for old client records
  // that only have fullAddress without state filled
  if (city && !state) {
    var cityStateMap = {
      'Bengaluru': 'Karnataka', 'Bangalore': 'Karnataka',
      'Mumbai': 'Maharashtra', 'Pune': 'Maharashtra',
      'Nagpur': 'Maharashtra', 'Nashik': 'Maharashtra',
      'Delhi': 'Delhi', 'New Delhi': 'Delhi',
      'Noida': 'Uttar Pradesh', 'Agra': 'Uttar Pradesh',
      'Lucknow': 'Uttar Pradesh', 'Varanasi': 'Uttar Pradesh',
      'Meerut': 'Uttar Pradesh', 'Kanpur': 'Uttar Pradesh',
      'Gurgaon': 'Haryana', 'Gurugram': 'Haryana',
      'Faridabad': 'Haryana', 'Chandigarh': 'Chandigarh',
      'Hyderabad': 'Telangana',
      'Chennai': 'Tamil Nadu', 'Coimbatore': 'Tamil Nadu',
      'Madurai': 'Tamil Nadu',
      'Kolkata': 'West Bengal',
      'Ahmedabad': 'Gujarat', 'Surat': 'Gujarat',
      'Vadodara': 'Gujarat', 'Rajkot': 'Gujarat',
      'Jaipur': 'Rajasthan', 'Jodhpur': 'Rajasthan',
      'Kochi': 'Kerala', 'Kozhikode': 'Kerala',
      'Thiruvananthapuram': 'Kerala',
      'Bhopal': 'Madhya Pradesh', 'Indore': 'Madhya Pradesh',
      'Patna': 'Bihar',
      'Bhubaneswar': 'Odisha',
      'Raipur': 'Chhattisgarh',
      'Dehradun': 'Uttarakhand',
      'Guwahati': 'Assam',
      'Mysuru': 'Karnataka', 'Mysore': 'Karnataka',
      'Visakhapatnam': 'Andhra Pradesh',
      'Amritsar': 'Punjab', 'Ludhiana': 'Punjab',
      'Thane': 'Maharashtra', 'Aurangabad': 'Maharashtra'
    };
    state = cityStateMap[city] || null;
  }

  var groupKey = state || city || 'Unknown';
  var subKey   = city  || 'Unknown';
  if (!byState[groupKey]) byState[groupKey] = { count: 0, cities: {} };
  byState[groupKey].count++;
  byState[groupKey].cities[subKey] = (byState[groupKey].cities[subKey] || 0) + 1;
});
      _hmData = { byState: byState, total: users.length, role: role };
      renderHeatmapIndia(byState, users.length);
      renderHmBars(byState, null);
      }).catch(function(err) {
        console.error('Heatmap load error:', err);
        g('hmMapArea').innerHTML = '<div style="text-align:center;padding:30px;color:#606078;font-size:13px">Failed to load data</div>';
      });
  }

  // ── Leaflet map instance (kept so we can destroy/recreate on refresh) ──
  var _leafletMap = null;

  // ── City lat/lng lookup for heatmap dots ──
  var CITY_LL = {
    'Bengaluru':[12.972,77.594],'Bangalore':[12.972,77.594],'Delhi':[28.613,77.209],
    'New Delhi':[28.613,77.209],'Mumbai':[19.076,72.877],'Pune':[18.520,73.856],
    'Hyderabad':[17.385,78.487],'Chennai':[13.083,80.270],'Kolkata':[22.573,88.364],
    'Ahmedabad':[23.023,72.571],'Jaipur':[26.912,75.787],'Surat':[21.170,72.831],
    'Lucknow':[26.847,80.947],'Chandigarh':[30.733,76.779],'Kochi':[9.931,76.267],
    'Bhopal':[23.260,77.413],'Nagpur':[21.145,79.082],'Coimbatore':[11.016,76.956],
    'Mysuru':[12.296,76.644],'Mysore':[12.296,76.644],'Indore':[22.719,75.857],
    'Patna':[25.594,85.137],'Vadodara':[22.307,73.181],'Visakhapatnam':[17.686,83.218],
    'Gurgaon':[28.459,77.026],'Gurugram':[28.459,77.026],'Noida':[28.535,77.391],
    'Agra':[27.176,78.008],'Varanasi':[25.320,82.974],'Thane':[19.218,72.978],
    'Meerut':[28.984,77.706],'Nashik':[19.998,73.789],'Aurangabad':[19.877,75.343],
    'Faridabad':[28.408,77.313],'Rajkot':[22.303,70.802],'Ludhiana':[30.901,75.857],
    'Amritsar':[31.634,74.872],'Jodhpur':[26.300,73.017],'Madurai':[9.939,78.121],
    'Raipur':[21.251,81.629],'Kozhikode':[11.258,75.780],'Bhubaneswar':[20.296,85.825],
    'Dehradun':[30.316,78.032],'Thiruvananthapuram':[8.524,76.936],'Guwahati':[26.144,91.736]
  };

  function renderHeatmapIndia(byState, total) {
    var container = g('hmMapArea');
    // Destroy existing Leaflet map cleanly
    if (_leafletMap) {
      try { _leafletMap.off(); _leafletMap.remove(); } catch(e) {}
      _leafletMap = null;
    }
    container.innerHTML = '<div id="indiaLeafletMap" style="width:100%;height:470px;border-radius:10px;background:#0d0d14"></div>';

    function normName(s) { return (s || '').toLowerCase().replace(/[^a-z]/g, ''); }

    function matchStateData(geoName) {
      // exact match
      if (byState[geoName]) return byState[geoName];
      var n = normName(geoName);
      for (var k in byState) {
        if (normName(k) === n) return byState[k];
      }
      // partial match
      for (var k in byState) {
        var kn = normName(k);
        if (n.indexOf(kn) >= 0 || kn.indexOf(n) >= 0) return byState[k];
      }
      return null;
    }

    function getStateColor(count, maxVal) {
      if (!count || !maxVal) return '#1a1a2e';
      var pct = count / maxVal;
      // dark background → bright orange
      var r = Math.round(26 + pct * 226);
      var gv = Math.round(26 + pct * 102);
      var b  = Math.round(36 + pct * -11);
      return 'rgb(' + r + ',' + gv + ',' + Math.max(0,b) + ')';
    }

    function initMap() {
      var L = window.L;
      if (!L) { fallbackTiles(byState, total, container); return; }

      var map = L.map('indiaLeafletMap', {
        center: [22.5, 80.5],
        zoom: 4,
        minZoom: 3,
        maxZoom: 10,
        zoomControl: true,
        scrollWheelZoom: true,
        attributionControl: false
      });
      _leafletMap = map;

      // Dark tile base layer
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        opacity: 0.6
      }).addTo(map);

      var maxCount = 0;
      Object.keys(byState).forEach(function(s) {
        if (byState[s].count > maxCount) maxCount = byState[s].count;
      });

      // India state GeoJSON — well-known public CDN
      var GEO_URL = 'https://raw.githubusercontent.com/geohacker/india/master/state/india_telengana.geojson';

      fetch(GEO_URL)
        .then(function(r) { return r.ok ? r.json() : Promise.reject('geo-fail'); })
        .then(function(geo) {
          var geoLayer = L.geoJSON(geo, {
            style: function(feat) {
              var name = feat.properties.NAME_1 || feat.properties.st_nm || feat.properties.name || '';
              var data = matchStateData(name);
              var cnt  = data ? data.count : 0;
              return {
                fillColor:   getStateColor(cnt, maxCount),
                fillOpacity: cnt > 0 ? 0.80 : 0.20,
                color:       '#FC8019',
                weight:      0.8,
                opacity:     0.7
              };
            },
            onEachFeature: function(feat, layer) {
              var stName = feat.properties.NAME_1 || feat.properties.st_nm || feat.properties.name || '';
              var data   = matchStateData(stName);
              var cnt    = data ? data.count : 0;

              // Tooltip
              var cities = data && data.cities ? Object.keys(data.cities)
                .sort(function(a,b){ return data.cities[b]-data.cities[a]; })
                .slice(0,4).map(function(c){ return c + ' (' + data.cities[c] + ')'; }).join(', ') : '';
              layer.bindTooltip(
                '<div style="font-weight:700;color:#FC8019;font-size:13px">' + stName + '</div>' +
                '<div style="color:#f0f0f4;margin-top:2px">' + cnt + ' user' + (cnt!==1?'s':'') + '</div>' +
                (cities ? '<div style="color:#a0a0b8;font-size:11px;margin-top:3px">' + cities + '</div>' : ''),
                { sticky: true, className: 'hm-lf-tip', opacity: 1 }
              );

              // State abbreviation label
              try {
                var center = layer.getBounds().getCenter();
                var abbr = stName.split(' ').map(function(w){ return w[0]; }).join('').substring(0,3);
                L.marker(center, {
                  icon: L.divIcon({
                    className:'',
                    html: '<div class="hm-state-lbl">' + abbr +
                      (cnt > 0 ? '<br><span class="hm-state-cnt">' + cnt + '</span>' : '') + '</div>',
                    iconSize: [44, 26],
                    iconAnchor: [22, 13]
                  }),
                  interactive: false
                }).addTo(map);
              } catch(e) {}

              // Click → drill to cities
              layer.on('click', function() {
                if (data && data.cities && Object.keys(data.cities).length) {
                  drillHeatmapState(stName);
                } else {
                  toast('No city data for ' + stName, 'i');
                }
              });

              // Hover highlight
              layer.on('mouseover', function() {
                this.setStyle({ weight: 2, color: '#ffffff', opacity: 1 });
              });
              layer.on('mouseout', function() {
                geoLayer.resetStyle(this);
              });
            }
          }).addTo(map);

          // Fit to India bounds
          try { map.fitBounds(geoLayer.getBounds(), { padding: [10,10] }); } catch(e){}

          // ── Heat dots: circle markers for cities with known coords ──
          Object.keys(byState).forEach(function(stKey) {
            var stData = byState[stKey];
            if (!stData.cities) return;
            Object.keys(stData.cities).forEach(function(city) {
              var cnt = stData.cities[city];
              var ll  = CITY_LL[city];
              if (!ll) return;
              var radius = Math.max(5, Math.min(26, 5 + cnt * 3));
              L.circleMarker(ll, {
                radius:      radius,
                fillColor:   '#FC8019',
                color:       '#fff',
                weight:      1.5,
                opacity:     0.9,
                fillOpacity: 0.75
              })
                .bindTooltip('<strong style="color:#FC8019">' + city + '</strong><br>' + cnt + ' user' + (cnt!==1?'s':''),
                  { sticky:true, className:'hm-lf-tip' })
                .addTo(map);
            });
          });

          // Legend
          g('hmLegend').innerHTML =
            '<div class="hm-lswatch" style="background:#1a1a2e;border:1px solid rgba(252,128,25,.3)"></div><span>0</span>' +
            '<div class="hm-lswatch" style="background:rgb(80,40,10)"></div><span>Low</span>' +
            '<div class="hm-lswatch" style="background:rgb(170,80,15)"></div><span>Mid</span>' +
            '<div class="hm-lswatch" style="background:rgb(252,128,25)"></div><span>High</span>';
          g('hmBarTitle').textContent = 'Top States';
        })
        .catch(function() {
          // GeoJSON CDN blocked — fall back to tile grid
          fallbackTiles(byState, total, container);
        });
    }

 // Load Leaflet JS + CSS on demand
    function loadLeaflet(cb) {
      if (window.L) { cb(); return; }
      if (!document.querySelector('link[href*="leaflet"]')) {
        var css = document.createElement('link');
        css.rel = 'stylesheet';
        css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(css);
      }
      if (!document.querySelector('script[src*="leaflet"]')) {
        var sc = document.createElement('script');
        sc.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        sc.onload  = cb;
        sc.onerror = function() { fallbackTiles(byState, total, container); };
        document.head.appendChild(sc);
      } else {
        // script already in DOM but may still be loading
        var t = setInterval(function() {
          if (window.L) { clearInterval(t); cb(); }
        }, 50);
      }
    }

    loadLeaflet(initMap);
  }

  // ── Tile-grid fallback (used when Leaflet / GeoJSON CDN is blocked) ──
  function fallbackTiles(byState, total, container) {
    var maxVal = 0;
    Object.keys(byState).forEach(function(s) { if (byState[s].count>maxVal) maxVal=byState[s].count; });
    var states = Object.keys(byState).filter(function(s){return s!=='Unknown';}).sort(function(a,b){return byState[b].count-byState[a].count;});
    if (!states.length) {
      container.innerHTML = '<div style="text-align:center;padding:30px;color:#606078">No location data — users need a city/state in their profile.</div>';
      return;
    }
    var html = '<div style="display:flex;flex-wrap:wrap;gap:5px;padding:8px">';
    states.forEach(function(st) {
      var c = byState[st].count, pct = maxVal>0?c/maxVal:0;
      var r=Math.round(50+pct*202), gv=Math.round(20+pct*108), b=Math.round(0+pct*25);
      html += '<div data-hm-state="' + esc(st) + '" style="background:rgb('+r+','+gv+','+b+');border-radius:6px;padding:6px 10px;cursor:pointer;min-width:55px;flex-shrink:0" title="' + esc(st)+': '+c+'">' +
        '<div style="font-size:10px;font-weight:700;color:rgba(255,255,255,.9);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(st.substring(0,13))+'</div>' +
        '<div style="font-size:15px;font-weight:800;color:#fff">'+c+'</div></div>';
    });
    var unk = byState['Unknown'] ? byState['Unknown'].count : 0;
    html += '</div>' + (unk?'<div style="font-size:11px;color:#606078;padding:4px 8px">'+unk+' without location</div>':'') +
      '<div style="font-size:11px;color:#606078;padding:2px 8px">Total: <strong style="color:#f0f0f4">'+total+'</strong> · Click to drill</div>';
    container.innerHTML = html;
    g('hmLegend').innerHTML = '<div class="hm-lswatch" style="background:rgb(50,20,0)"></div><span>Low</span><div class="hm-lswatch" style="background:rgb(252,128,25)"></div><span>High</span>';
    g('hmBarTitle').textContent = 'Top States';
    return;
    /*
    /*
    var maxVal = 0;
    Object.keys(byState).forEach(function(s) { if (byState[s].count > maxVal) maxVal = byState[s].count; });

    // Build a simple visual grid of states as colored rectangles (no external SVG needed)
    var states = Object.keys(byState).filter(function(s) { return s !== 'Unknown'; }).sort(function(a,b) { return byState[b].count - byState[a].count; });
    var unknownCount = byState['Unknown'] ? byState['Unknown'].count : 0;

    var html = '<div style="display:flex;flex-wrap:wrap;gap:4px;padding:4px">';
    states.forEach(function(state) {
      var cnt = byState[state].count;
      var pct = maxVal > 0 ? cnt / maxVal : 0;
      // Color intensity: dark orange to bright orange
      var r = Math.round(50 + pct * 202), g2 = Math.round(20 + pct * 108), b = Math.round(0 + pct * 25);
      var bg = 'rgb(' + r + ',' + g2 + ',' + b + ')';
      var w = Math.max(50, Math.round(40 + pct * 120));
      html += '<div data-hm-state="' + esc(state) + '" style="background:' + bg + ';border-radius:5px;padding:5px 8px;cursor:pointer;width:' + w + 'px;min-width:50px;flex-shrink:0;transition:opacity .2s;position:relative" title="' + esc(state) + ': ' + cnt + '">';
      html += '<div style="font-size:9px;font-weight:700;color:rgba(255,255,255,.9);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(state.substring(0,14)) + '</div>';
      html += '<div style="font-size:13px;font-weight:800;color:#fff">' + cnt + '</div>';
      html += '</div>';
    });
    html += '</div>';
    if (unknownCount) html += '<div style="font-size:11px;color:#606078;margin-top:6px;padding:0 4px">' + unknownCount + ' users without location data</div>';
    html += '<div style="font-size:11px;color:#606078;margin-top:4px;padding:0 4px">Total: <strong style="color:#f0f0f4">' + total + '</strong> &bull; Click a state to drill down</div>';

    g('hmMapArea').innerHTML = html;
    // Legend
    g('hmLegend').innerHTML = '<div class="hm-lswatch" style="background:rgb(50,20,0)"></div><span>Low</span><div class="hm-lswatch" style="background:rgb(150,64,12)"></div><span>Medium</span><div class="hm-lswatch" style="background:rgb(252,128,25)"></div><span>High</span>';
    g('hmBarTitle').textContent = 'Top States';
  }


  */ }

  function drillHeatmap(state) {
    drillHeatmapState(state); return;
    if (!_hmData.byState || !_hmData.byState[state]) return;
    _hmState = state;
    var cities = _hmData.byState[state].cities;
    var maxVal = 0;
    Object.keys(cities).forEach(function(c) { if (cities[c] > maxVal) maxVal = cities[c]; });

    g('hmCrumbs').innerHTML = '<span class="hm-crumb" data-level="country" style="cursor:pointer">India</span><span class="hm-crumb">' + esc(state) + '</span>';
    g('hmCrumbs').querySelector('[data-level="country"]').onclick = function() {
      _hmState = null;
      g('hmCrumbs').innerHTML = '<span class="hm-crumb" data-level="country">India</span>';
      renderHeatmapIndia(_hmData.byState, _hmData.total);
      renderHmBars(_hmData.byState, null);
    };

    var sorted = Object.keys(cities).filter(function(c) { return c !== 'Unknown'; }).sort(function(a,b) { return cities[b] - cities[a]; });
    var html = '<div style="display:flex;flex-wrap:wrap;gap:4px;padding:4px">';
    sorted.forEach(function(city) {
      var cnt = cities[city];
      var pct = maxVal > 0 ? cnt / maxVal : 0;
      var r = Math.round(50 + pct * 202), g2 = Math.round(20 + pct * 108), b = Math.round(0 + pct * 25);
      var bg = 'rgb(' + r + ',' + g2 + ',' + b + ')';
      html += '<div style="background:' + bg + ';border-radius:5px;padding:5px 8px;min-width:60px;flex-shrink:0">';
      html += '<div style="font-size:9px;font-weight:700;color:rgba(255,255,255,.9);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(city.substring(0,12)) + '</div>';
      html += '<div style="font-size:13px;font-weight:800;color:#fff">' + cnt + '</div>';
      html += '</div>';
    });
    if (cities['Unknown']) html += '<div style="background:#1a1a24;border-radius:5px;padding:5px 8px"><div style="font-size:9px;color:#606078">Unknown</div><div style="font-size:13px;font-weight:800;color:#606078">' + cities['Unknown'] + '</div></div>';
    html += '</div>';
    html += '<div style="font-size:11px;color:#606078;margin-top:6px;padding:0 4px">Total in ' + esc(state) + ': <strong style="color:#f0f0f4">' + _hmData.byState[state].count + '</strong></div>';
    g('hmMapArea').innerHTML = html;
    g('hmBarTitle').textContent = 'Cities in ' + state;
    renderHmBars(null, cities);
  }

  function renderHmBars(byState, byCities) {
    var data = byState || byCities;
    if (!data) { g('hmBars').innerHTML = ''; return; }
    var sorted = Object.keys(data).filter(function(k) { return k !== 'Unknown'; }).sort(function(a,b) {
      var va = byState ? data[a].count : data[a];
      var vb = byState ? data[b].count : data[b];
      return vb - va;
    }).slice(0, 15);
    var maxVal = 0;
    sorted.forEach(function(k) { var v = byState ? data[k].count : data[k]; if (v > maxVal) maxVal = v; });
    g('hmBars').innerHTML = sorted.map(function(k) {
      var v = byState ? data[k].count : data[k];
      var pct = maxVal > 0 ? (v / maxVal * 100) : 0;
      return '<div class="hm-bar-row"><div class="hm-bar-label" title="' + esc(k) + '">' + esc(k) + '</div>' +
        '<div style="flex:1;background:#18181d;border-radius:4px;overflow:hidden"><div class="hm-bar" style="width:' + pct + '%;background:linear-gradient(90deg,#FC8019,#e06b0a)"></div></div>' +
        '<div class="hm-bar-val">' + v + '</div></div>';
    }).join('') || '<div style="color:#606078;font-size:13px;padding:10px">No data</div>';
  }

  /* ═══ DM (DIRECT MESSAGE) ════════════════════════════════════════════════ */
  var _dmUid = null;

  function openDmModal(uid, name) {
    _dmUid = uid;
    g('dmModalInfo').innerHTML = '<strong>' + esc(name) + '</strong><br><span style="color:#a0a0b8;font-size:12px">Message will appear in their chat inbox</span>';
    g('dmText').value = '';
    openModal('dmModal');
  }

  function submitDm() {
    if (!_dmUid) return;
    var text = g('dmText').value.trim();
    if (!text) { toast('Enter a message', 'e'); return; }
    g('dmSubmit').textContent = 'Sending...';
    api('users/' + _dmUid + '/dm', 'POST', { message: text })
      .then(function(d) {
        g('dmSubmit').textContent = '\u2708 Send Message';
        if (d.success) { toast('Message sent!'); closeModal('dmModal'); }
        else toast(d.message || 'Failed to send', 'e');
      }).catch(function() { g('dmSubmit').textContent = '\u2708 Send Message'; toast('Connection error', 'e'); });
  }

  /* ═══ KYC VIEWER ═════════════════════════════════════════════════════════ */
  var _kycUid = null;

  function openKycModal(uid, name) {
    _kycUid = uid;
    g('kycModalTitle').textContent = '\ud83d\udcc4 KYC Documents — ' + name;
    g('kycModalBody').innerHTML = '<div style="text-align:center;padding:24px"><div class="spin"></div></div>';
    openModal('kycModal');
    api('users/' + uid).then(function(d) {
      if (!d.success) { g('kycModalBody').innerHTML = '<p style="color:#606078;padding:16px">Failed to load</p>'; return; }
      var u = d.user;
      var pr = u.profile || {};
      // Collect all possible doc fields
        var docs = [
  { label: 'Aadhar Card', url: u.aadharDoc || pr.aadhar || pr.aadharUrl || pr.aadharDoc || null, icon: '💳' },
  { label: 'PAN Card', url: u.panDoc || pr.pan || pr.panUrl || pr.panDoc || null, icon: '📋' },
  { label: 'Certificate / Degree', url: u.certificateDoc || pr.certificate || pr.certificateUrl || pr.certDoc || null, icon: '🎓' },
  { label: 'KYC Document', url: u.kycDocument || pr.kycDocument || pr.kyc || null, icon: '📜' },
  { label: 'Profile Photo', url: u.profilePhoto || null, icon: '🖼️' }
];

// Extra docs array
var extraDocs = u.documents || pr.documents || [];
extraDocs.forEach(function(doc, i) {
  var url = typeof doc === 'string' ? doc : (doc.url || doc.path || null);
  var label = typeof doc === 'object' ? (doc.name || doc.label || 'Document ' + (i+1)) : 'Document ' + (i+1);
  docs.push({ label: label, url: url, icon: '📎' });
});

// NEW KYC system — inject AFTER docs is declared
if (u.kyc && u.kyc.docBase64) {
  docs.unshift({
    label: (u.kyc.docType || 'KYC Document') + ' (Submitted)',
    url: u.kyc.docBase64,
    icon: '🛡️'
  });
}

      var realDocs = docs.filter(function(d) { return d.url; });
      var html = '';
      if (!realDocs.length) {
        html = '<div class="empty" style="padding:30px"><h3>No documents uploaded</h3><p style="font-size:13px;color:#606078;margin-top:4px">Expert has not uploaded any KYC documents yet</p></div>';
      } else {
        html = '<div style="margin-bottom:14px;font-size:12px;color:#606078">' + realDocs.length + ' document' + (realDocs.length>1?'s':'') + ' found</div>';
        realDocs.forEach(function(doc) {
          var isImg = /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(doc.url);
          var isPdf = /\.pdf(\?|$)/i.test(doc.url);
          html += '<div class="kyc-doc">';
          html += '<div class="kyc-doc-icon">' + doc.icon + '</div>';
          html += '<div class="kyc-doc-info"><strong>' + esc(doc.label) + '</strong><small>' + esc(doc.url.substring(0, 60)) + (doc.url.length > 60 ? '...' : '') + '</small></div>';
          html += '<div class="kyc-doc-actions">';
          var isBase64Img = doc.url && doc.url.startsWith('data:image');
var isBase64Pdf = doc.url && doc.url.startsWith('data:application/pdf');
if (isImg || isBase64Img) html += '<button class="btn bgho kyc-view-btn">View</button>';
else if (isPdf || isBase64Pdf) html += '<button class="btn bgho kyc-view-btn">Open PDF</button>';
else html += '<a class="btn bgho" href="' + esc(doc.url) + '" target="_blank">Download</a>';
          html += '</div></div>';
          if (isImg) html += '<div id="kp-' + esc(doc.label.replace(/\s/g,'')) + '" style="display:none;margin-bottom:8px"><img src="' + esc(doc.url) + '" class="kyc-img-preview" onerror="this.style.display=\'none\'"></div>';
        });
      }
      // Basic info strip
      html += '<div style="margin-top:16px;padding:12px;background:#18181d;border-radius:8px;font-size:12px;color:#a0a0b8">';
      html += '<strong style="color:#f0f0f4">' + esc(u.name) + '</strong> &bull; ' + esc(u.email) + ' &bull; ' + (u.phone||'-');
      html += '<br>Status: ' + (u.isApproved ? '<span style="color:#22c55e">Approved</span>' : u.isBanned ? '<span style="color:#ef4444">Rejected</span>' : '<span style="color:#f59e0b">Pending</span>');
      html += '</div>';
            g('kycModalBody').innerHTML = html;
      // Wire up view buttons with stored URLs (avoids base64 in onclick attribute)
      var viewBtns = g('kycModalBody').querySelectorAll('.kyc-view-btn');
      viewBtns.forEach(function(btn, i) {
        btn.addEventListener('click', function() {
          showKycPreview(realDocs[i].url, realDocs[i].label);
        });
      });
      // Show/hide approve reject based on status
      g('kycApproveBtn').style.display = u.isApproved ? 'none' : 'inline-flex';
      g('kycRejectBtn').style.display = u.isBanned ? 'none' : 'inline-flex';
    }).catch(function() { g('kycModalBody').innerHTML = '<p style="color:#606078;padding:16px">Error loading</p>'; });
  }

    function showKycPreview(url, label) {
    var w = window.open('', '_blank');
    if (!w) { alert('Allow popups to view documents'); return; }
    w.document.write(
      '<html><head><title>' + label + '</title>' +
      '<style>body{margin:0;background:#000;display:flex;align-items:center;justify-content:center;min-height:100vh}' +
      'img{max-width:100%;max-height:100vh;object-fit:contain}</style></head>' +
      '<body><img src="' + url + '" onerror="document.body.innerHTML=\'<p style=color:red;padding:20px>Failed to load image</p>\'"></body></html>'
    );
    w.document.close();
  }

    function processKyc(action) {
  if (!_kycUid) return;
  if (action === 'reject') {
    var reason = prompt('Rejection reason:') || 'Document unclear or invalid';
    api('kyc/' + _kycUid + '/reject', 'POST', { reason: reason })
      .then(function(d) {
        if (d.success) { toast('KYC rejected'); closeModal('kycModal'); loadKycRequests(); loadRegistrations(); }
        else toast(d.message || 'Failed', 'e');
      }).catch(function() { toast('Error', 'e'); });
  } else {
    if (!confirm('Approve KYC?')) return;
    api('kyc/' + _kycUid + '/approve', 'POST', {})
      .then(function(d) {
        if (d.success) { toast('KYC approved ✅'); closeModal('kycModal'); loadKycRequests(); loadRegistrations(); }
        else toast(d.message || 'Failed', 'e');
      }).catch(function() { toast('Error', 'e'); });
  }
}
  /* ═══ KYC REQUESTS TAB ══════════════════════════════════════════════════ */
  function loadKycRequests() {
    setT('kycTbl', spin());
    var st = g('kycSt') ? g('kycSt').value : 'pending';

    // Fetch all experts and filter those with kyc.status matching
    api('users' + qs({ role: 'expert' })).then(function(d) {
      var users = d.users || [];
      var filtered = users.filter(function(u) {
        var kycStatus = (u.kyc && u.kyc.status) || 'not_submitted';
        return kycStatus === st;
      });

      // Update badge count for pending
      if (st === 'pending') {
        var badge = g('kycbadge');
        if (badge) {
          badge.textContent = filtered.length;
          badge.style.display = filtered.length > 0 ? 'inline-block' : 'none';
        }
      }

      if (!filtered.length) {
        setT('kycTbl', '<tr><td colspan="8" style="text-align:center;padding:30px;color:#606078">No ' + st + ' KYC requests</td></tr>');
        return;
      }

      pagSlice('kyc', filtered);
      renderKycPage(filtered);
    }).catch(function() { setT('kycTbl', ''); });
  }

  function renderKycPage(arr) {
    if (arr) pagSlice('kyc', arr);
    var page = pagSlice('kyc', _pageData['kyc'] || []);
    var existing = document.getElementById('pag-kyc');
    if (existing) existing.remove();
    setT('kycTbl', page.map(function(u) {
        var kyc = u.kyc || {};
        var regStatus = u.isApproved
          ? '<span class="badge bgr">Approved</span>'
          : u.isBanned
          ? '<span class="badge brd">Rejected</span>'
          : '<span class="badge byw">Pending</span>';

        var kycStatusMap = {
          pending:  '<span class="badge byw">⏳ Under Review</span>',
          approved: '<span class="badge bgr">✅ Verified</span>',
          rejected: '<span class="badge brd">❌ Rejected</span>',
          not_submitted: '<span class="badge bgy">Not Submitted</span>'
        };
        var kycBadge = kycStatusMap[kyc.status || 'not_submitted'];

        var actions = '';
        if (kyc.status === 'pending') {
          actions += '<button class="btn bgrn" onclick="processKycDirect(\'' + u._id + '\',\'approve\')">✅ Approve</button> ';
          actions += '<button class="btn brdn" onclick="processKycDirect(\'' + u._id + '\',\'reject\')">❌ Reject</button> ';
        }
        actions += '<button class="btn bgho" data-kyc-uid="' + u._id + '" data-kyc-name="' + esc(u.name) + '">View Doc</button>';

        return '<tr>' +
          '<td>' + uLnk(u._id, u.name) + '</td>' +
          '<td style="font-size:12px;color:#a0a0b8">' + esc(u.email) + '</td>' +
          '<td style="font-size:12px">' + (u.phone || '-') + '</td>' +
          '<td style="font-size:13px;font-weight:600;color:#f0f0f4">' + esc(kyc.docType || '—') + '</td>' +
          '<td style="font-size:12px;color:#a0a0b8">' + fmt(kyc.submittedAt) + '</td>' +
          '<td>' + kycBadge + '</td>' +
          '<td>' + regStatus + '</td>' +
          '<td><div style="display:flex;gap:4px;flex-wrap:wrap">' + actions + '</div></td>' +
          '</tr>';
      }).join(''));
    pagHTML('kyc', 'kycTbl');
  }

  function processKycDirect(uid, action) {
    var confirmMsg = action === 'approve'
      ? 'Approve KYC for this expert?'
      : 'Reject KYC? Enter rejection reason:';

    if (action === 'reject') {
      var reason = prompt(confirmMsg);
      if (reason === null) return; // cancelled
      api('kyc/' + uid + '/reject', 'POST', { reason: reason || 'Document unclear or invalid' })
        .then(function(d) {
          if (d.success) { toast('KYC rejected'); loadKycRequests(); }
          else toast(d.message || 'Failed', 'e');
        }).catch(function() { toast('Error', 'e'); });
    } else {
      if (!confirm('Approve KYC for this expert?')) return;
      api('kyc/' + uid + '/approve', 'POST', {})
        .then(function(d) {
          if (d.success) { toast('KYC approved! Expert is now verified ✅'); loadKycRequests(); }
          else toast(d.message || 'Failed', 'e');
        }).catch(function() { toast('Error', 'e'); });
    }
  }

  /* ═══ ANNOUNCEMENT ═══════════════════════════════════════════════════════ */
  function sendAnnouncement() {
    var target = g('annTarget').value;
    var title = g('annTitle').value.trim();
    var msg = g('annMsg').value.trim();
    if (!title || !msg) { toast('Title and message required', 'e'); return; }
    g('annStatus').textContent = 'Sending...';
    g('annStatus').style.color = '#a0a0b8';
    api('communications/announce', 'POST', { target: target, title: title, message: msg })
      .then(function(d) {
        if (d.success) {
          g('annStatus').textContent = 'Sent to ' + (d.recipientCount||'?') + ' users!';
          g('annStatus').style.color = '#22c55e';
          g('annTitle').value = ''; g('annMsg').value = '';
          loadCommHistory();
        } else {
          g('annStatus').textContent = 'Failed: ' + (d.message||'Unknown error');
          g('annStatus').style.color = '#ef4444';
        }
      }).catch(function() { g('annStatus').textContent = 'Connection error'; g('annStatus').style.color = '#ef4444'; });
  }


  /* ═══════════════════════════════════════════════════════════
     TICKET CREATE (admin creates on behalf of user)
  ═══════════════════════════════════════════════════════════ */
  var _tkCreateUid = null, _tkCreateRole = null, _tkSelectedIssue = null;

  var TICKET_CATEGORIES = [
    { group: '🧾 Account & Login Issues', items: [
      'Unable to login', 'Forgot password / OTP not received',
      'Account locked / suspended', 'Change phone/email',
      'Delete account request', 'Profile update issue'
    ]},
    { group: '📋 Request / Job Issues', items: [
      'Unable to post request', 'Edit request issue',
      'Request not visible to experts', 'Wrong category selected',
      'Duplicate request created', 'Want to cancel request',
      'Request marked completed incorrectly', 'Spam responses received'
    ]},
    { group: '💬 Expert Interaction Issues', items: [
      'Expert not responding', 'Received too many responses',
      'Harassment / inappropriate behavior 🚨', 'Expert asking payment outside platform',
      'Expert details incorrect', 'Fake expert suspected'
    ]},
    { group: '💰 Payment & Refund Issues', items: [
      'Payment failed but amount deducted', 'Refund not received',
      'Wrong charge applied', 'Payment confirmation not received',
      'Need invoice / receipt', 'Payment method issue'
    ]},
    { group: '⭐ Review & Rating Issues', items: [
      'Unable to submit review', 'Want to edit/remove review',
      'Fake review posted about me', 'Rating incorrect'
    ]},
    { group: '🛡️ Safety & Abuse', items: [
      'Report fraud/scam 🚨', 'Threatening behavior',
      'Privacy concern', 'Unauthorized use of my data'
    ]},
    { group: '⚙️ Technical Issues', items: [
      'App/website not working', 'Page loading error',
      'Feature not functioning', 'Bug report', 'Mobile app issue'
    ]},
    { group: '❓ General Support', items: [
      'Need help using platform', 'Feature request',
      'Feedback / suggestions', 'Other issue'
    ]}
  ];

  function openCreateTicketModal(uid, name, role) {
    _tkCreateUid = uid; _tkCreateRole = role; _tkSelectedIssue = null;
    g('tkCreateFor').innerHTML = 'Creating ticket for: <strong style="color:#FC8019">' + esc(name) + '</strong> <span class="badge bgy">' + esc(role||'user') + '</span>';
    var html = '';
    TICKET_CATEGORIES.forEach(function(cat) {
      html += '<div class="tk-cat-group">' + esc(cat.group) + '</div>';
      cat.items.forEach(function(item) {
        html += '<div class="tk-cat-item" data-issue="' + esc(item) + '">' + esc(item) + '</div>';
      });
    });
    g('tkCatList').innerHTML = html;
    g('tkStep1').style.display = 'block';
    g('tkStep2').style.display = 'none';
    g('tkCreateSubmit').style.display = 'none';
    g('tkCatList').onclick = function(ev) {
      var item = ev.target.closest('.tk-cat-item');
      if (!item) return;
      document.querySelectorAll('.tk-cat-item').forEach(function(el) { el.classList.remove('sel'); });
      item.classList.add('sel');
      _tkSelectedIssue = item.dataset.issue;
      g('tkSelectedCat').textContent = _tkSelectedIssue;
      g('tkDescription').placeholder = 'Describe the issue in detail for: ' + _tkSelectedIssue;
      g('tkStep1').style.display = 'none';
      g('tkStep2').style.display = 'block';
      g('tkCreateSubmit').style.display = 'inline-flex';
    };
    g('tkCreateSubmit').onclick = submitCreateTicket;
    openModal('tkCreateModal');
  }

  function tkGoBack() {
    g('tkStep1').style.display = 'block';
    g('tkStep2').style.display = 'none';
    g('tkCreateSubmit').style.display = 'none';
    _tkSelectedIssue = null;
    // Re-attach listener
    openCreateTicketModal(_tkCreateUid, g('tkCreateFor').querySelector('strong').textContent, _tkCreateRole);
    closeModal('tkCreateModal'); openModal('tkCreateModal');
  }

  function submitCreateTicket() {
    if (!_tkCreateUid || !_tkSelectedIssue) { toast('Select an issue first', 'e'); return; }
    var payload = {
      userId: _tkCreateUid,
      subject: _tkSelectedIssue,
      description: g('tkDescription').value || _tkSelectedIssue,
      priority: g('tkPriority').value,
      adminNote: g('tkAdminNote').value,
      createdByAdmin: true
    };
    var btn = g('tkCreateSubmit');
    if (btn) { btn.disabled = true; btn.textContent = 'Creating...'; }
    api('tickets/create-for-user', 'POST', payload).then(function(d) {
      if (btn) { btn.disabled = false; btn.innerHTML = '🎫 Create Ticket'; }
      if (d.success) {
        var tid = (d.ticket && d.ticket._id) ? '#' + d.ticket._id.slice(-6).toUpperCase() : '';
        toast('Ticket ' + tid + ' created!');
        closeModal('tkCreateModal');
        goTo('tickets');   // ← navigate to Tickets main tab
      } else {
        toast(d.message || 'Failed to create ticket', 'e');
      }
    }).catch(function(err) {
      if (btn) { btn.disabled = false; btn.innerHTML = '🎫 Create Ticket'; }
      toast('Connection error — ticket not created', 'e');
    });
  }
/* ═══ CANNED RESPONSE ═══════════════════════════════════════════════════ */
  window.sendCannedResponse = function(tid, cannedType, btn) {
    var note = g('tkNote') ? g('tkNote').value : '';
    var labels = { refund_approved:'Approve refund?', not_eligible:'Mark as not eligible?', under_investigation:'Mark as under investigation?', resolved_no_action:'Mark as resolved?', contact_support:'Send contact support response?' };
    if (!confirm(labels[cannedType] || 'Send this canned response?')) return;
    if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }
    api('tickets/' + tid + '/canned', 'POST', { cannedType: cannedType, note: note })
      .then(function(d) {
        if (btn) { btn.disabled = false; }
        if (d.success) {
          toast('Canned response sent!');
          closeModal('ticketModal');
          loadTickets();
        } else toast(d.message || 'Failed', 'e');
      }).catch(function() {
        if (btn) { btn.disabled = false; }
        toast('Error', 'e');
      });
  };

  /* ═══ CLIENT ACTIVITY ════════════════════════════════════════════════════ */
  window.loadClientActivity = function(uid, name) {
    if (!uid) { toast('No user ID', 'e'); return; }
    // Open drawer with activity
    g('ov1').classList.add('on'); g('dr1').classList.add('on');
    g('drT').textContent = '📋 Activity — ' + name;
    g('drTabs').innerHTML = '';
    g('drB').innerHTML = '<div style="text-align:center;padding:40px"><div class="spin"></div></div>';
    api('audit/user/' + uid).then(function(d) {
      var logs = d.logs || [];
      if (!logs.length) {
        g('drB').innerHTML = '<div class="empty"><h3>No activity found</h3><p style="font-size:13px;color:#606078">No audit events recorded for this user yet</p></div>';
        return;
      }
      var actionColors = {
        login: '#22c55e', request_created: '#3b82f6', approach_submitted: '#FC8019',
        approach_accepted: '#22c55e', approach_rejected: '#ef4444',
        service_completed: '#a855f7', ticket_followup: '#f59e0b'
      };
      var html = '<div style="font-size:12px;color:#606078;margin-bottom:14px">' + logs.length + ' events recorded</div>';
      html += logs.map(function(l) {
        var color = actionColors[l.action] || '#a0a0b8';
        var meta = '';
        if (l.targetName) meta += l.targetName;
        if (l.metadata && l.metadata.ip) meta += (meta ? ' · ' : '') + 'IP: ' + l.metadata.ip;
        return '<div style="display:flex;gap:10px;padding:10px 0;border-bottom:1px solid #18181d;align-items:flex-start">' +
          '<div style="width:8px;height:8px;border-radius:50%;background:' + color + ';margin-top:5px;flex-shrink:0"></div>' +
          '<div style="flex:1">' +
            '<div style="font-size:13px;font-weight:600;color:#f0f0f4">' + esc(l.action.replace(/_/g,' ')) + '</div>' +
            (meta ? '<div style="font-size:11px;color:#606078;margin-top:2px">' + esc(meta) + '</div>' : '') +
            '<div style="font-size:11px;color:#606078;margin-top:2px">' + fmtT(l.createdAt) + '</div>' +
          '</div>' +
        '</div>';
      }).join('');
      g('drB').innerHTML = html;
    }).catch(function() {
      g('drB').innerHTML = '<div class="empty"><h3>Error loading activity</h3></div>';
    });
  };

  /* ═══ AUDIT LOG TAB ══════════════════════════════════════════════════════ */
  function loadAudit() {
    var action = g('auditAction') ? g('auditAction').value : '';
    var role   = g('auditRole')   ? g('auditRole').value   : '';
    var search = g('auditSearch') ? g('auditSearch').value : '';
    var from   = g('auditFrom')   ? g('auditFrom').value   : '';
    var to     = g('auditTo')     ? g('auditTo').value     : '';
    var qp = 'audit?limit=100' +
      (action && action !== 'all' ? '&action=' + encodeURIComponent(action) : '') +
      (role   && role   !== 'all' ? '&role='   + encodeURIComponent(role)   : '') +
      (search ? '&search=' + encodeURIComponent(search) : '') +
      (from   ? '&from='   + encodeURIComponent(from)   : '') +
      (to     ? '&to='     + encodeURIComponent(to)     : '');
    var tbody = g('auditTbody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px"><div class="spin"></div></td></tr>';
    api(qp).then(function(d) {
      var logs  = d.logs  || [];
      var total = d.total || logs.length;
      var tc = g('auditTotal'); if (tc) tc.textContent = total + ' events';
      if (!tbody) return;
      if (!logs.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;color:#606078">No audit events found</td></tr>';
        return;
      }
      var roleColors = { admin:'#a855f7', expert:'#FC8019', client:'#3b82f6' };
      var actionColors = {
        login:'#22c55e', request_created:'#3b82f6', approach_submitted:'#FC8019',
        approach_accepted:'#22c55e', approach_rejected:'#ef4444',
        service_completed:'#a855f7', ticket_followup:'#f59e0b',
        ticket_canned_response:'#06b6d4'
      };
      tbody.innerHTML = logs.map(function(l) {
        var rc = roleColors[l.actorRole]  || '#a0a0b8';
        var ac = actionColors[l.action]   || '#a0a0b8';
        var meta = '';
        if (l.targetName) meta = l.targetName;
        return '<tr>' +
          '<td style="font-size:12px;font-weight:600;color:#f0f0f4">' + esc(l.actorName||'-') +
            '<br><span class="badge" style="background:' + rc + '20;color:' + rc + ';font-size:10px">' + (l.actorRole||'-') + '</span></td>' +
          '<td><span style="font-size:12px;font-weight:600;color:' + ac + '">' + esc((l.action||'-').replace(/_/g,' ')) + '</span></td>' +
          '<td style="font-size:12px;color:#a0a0b8">' + esc(l.targetType||'-') + '</td>' +
          '<td style="font-size:12px;color:#a0a0b8;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(meta) + '</td>' +
          '<td style="font-size:12px;color:#606078">' + fmtT(l.createdAt) + '</td>' +
          '<td><button class="btn bgho" style="font-size:11px;padding:4px 8px" onclick="showAuditMeta(' + "'" + l._id + "'" + ')">Details</button></td>' +
        '</tr>';
      }).join('');
      // store logs for details modal
      window._auditLogs = logs;
    }).catch(function() {
      if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;color:#ef4444">Error loading audit log</td></tr>';
    });
  }

  window.showAuditMeta = function(id) {
    var logs = window._auditLogs || [];
    var l = logs.filter(function(x){ return x._id === id; })[0];
    if (!l) return;
    var meta = JSON.stringify(l.metadata || {}, null, 2);
    alert('Action: ' + l.action + '\nActor: ' + l.actorName + ' (' + l.actorRole + ')\nTarget: ' + (l.targetName||'-') + '\nMetadata:\n' + meta);
  };

  window.exportAuditCSV = function() {
    var logs = window._auditLogs || [];
    if (!logs.length) { toast('No data to export', 'i'); return; }
    exportCSV(logs.map(function(l) {
      return { Actor: l.actorName, Role: l.actorRole, Action: l.action, Target: l.targetName||'-', Date: fmtT(l.createdAt) };
    }), 'audit-log-' + new Date().toISOString().slice(0,10));
  };
   
/* ═══ REPORTS ════════════════════════════════════════════════════════════ */
  function loadReports() {
    _pages['reports'] = 1;
    setT('reportsTbl', spin());
    api('reports').then(function(d) {
      var reports = d.reports || [];
      if (!reports.length) {
        setT('reportsTbl', '<tr><td colspan="8" style="text-align:center;padding:30px;color:#606078">No reports yet</td></tr>');
        return;
      }
      renderReportsPage(reports);
    }).catch(function() { setT('reportsTbl', ''); });
  }

  function renderReportsPage(arr) {
    if (arr) pagSlice('reports', arr);
    var page = pagSlice('reports', _pageData['reports'] || []);
    var existing = document.getElementById('pag-reports');
    if (existing) existing.remove();
    setT('reportsTbl', page.map(function(r) {
      var reporterRole = r.reporterRole || 'expert';
      var roleBadge = reporterRole === 'expert'
        ? '<span class="badge bo">Expert</span>'
        : '<span class="badge bbl">Client</span>';
      var targetStatus = r.targetIsRestricted
        ? '<span class="badge brd">Restricted</span>'
        : r.targetIsBanned
        ? '<span class="badge brd">Banned</span>'
        : '<span class="badge bgr">Active</span>';
      var actions = '';
      if (!r.targetIsRestricted && !r.targetIsBanned) {
        actions += '<button class="btn brdn" style="font-size:11px;padding:5px 8px" data-act="restrict" data-uid="' + esc(r.reportedUserId) + '" data-nm="' + esc(r.reportedUserName) + '">Restrict</button> ';
      } else if (r.targetIsRestricted) {
        actions += '<button class="btn bgrn" style="font-size:11px;padding:5px 8px" data-act="unrestrict" data-uid="' + esc(r.reportedUserId) + '" data-nm="' + esc(r.reportedUserName) + '">Unrestrict</button> ';
      }
      if (!r.targetIsBanned) {
        actions += '<button class="btn brdn" style="font-size:11px;padding:5px 8px;background:rgba(239,68,68,.15)" data-act="ban" data-uid="' + esc(r.reportedUserId) + '" data-nm="' + esc(r.reportedUserName) + '">Ban</button>';
      }
      return '<tr>' +
        '<td>' + roleBadge + '<br><span style="font-size:12px;color:#f0f0f4;font-weight:600">' + esc(r.reporterName || '-') + '</span><br><small style="color:#606078">' + esc(r.reporterEmail || '') + '</small></td>' +
        '<td>' + uLnk(r.reportedUserId || '', r.reportedUserName || '-', '#3b82f6') + '<br><small style="color:#606078">' + esc(r.reportedUserEmail || '') + '</small></td>' +
        '<td>' + targetStatus + '</td>' +
        '<td style="font-size:12px;max-width:140px"><strong>' + esc(r.category || r.reason || '-') + '</strong></td>' +
        '<td style="font-size:12px;color:#a0a0b8;max-width:160px;overflow:hidden;text-overflow:ellipsis">' + esc((r.message || r.note || '-').substring(0, 80)) + '</td>' +
        '<td style="font-size:12px;color:#a0a0b8">' + fmtT(r.createdAt) + '</td>' +
        '<td style="font-size:12px">' + (r.requestTitle ? '<span style="color:#f59e0b">' + esc(r.requestTitle.substring(0, 30)) + '</span>' : '-') + '</td>' +
        '<td><div style="display:flex;gap:4px;flex-wrap:wrap">' + actions + '</div></td>' +
        '</tr>';
    }).join(''));
    pagHTML('reports', 'reportsTbl');
    var tbl = document.getElementById('reportsTbl');
    if (tbl) {
      tbl.onclick = function(ev) {
        var btn = ev.target.closest('[data-act]');
        if (!btn) return;
        ev.preventDefault(); ev.stopPropagation();
        var act = btn.dataset.act, uid = btn.dataset.uid, nm = btn.dataset.nm;
        if (act === 'restrict') {
          if (!confirm('Restrict ' + nm + '?')) return;
          doAct(uid, 'warn', 'Reported by multiple users');
        } else if (act === 'unrestrict') {
          if (!confirm('Unrestrict ' + nm + '?')) return;
          doAct(uid, 'unrestrict', '');
        } else if (act === 'ban') {
          if (!confirm('Ban ' + nm + '?')) return;
          doAct(uid, 'ban', '');
        }
      };
    }
  }
   
/* ═══ SUSPENDED REQUESTS ════════════════════════════════════════════════ */
  function loadSuspendedRequests() {
    _pages['suspReq'] = 1;
    setT('suspReqTbl', spin());
    api('suspended-requests').then(function(d) {
      var reqs = d.requests || [];
      if (!reqs.length) {
        setT('suspReqTbl', '<tr><td colspan="6" style="text-align:center;padding:30px;color:#606078">No suspended requests</td></tr>');
        return;
      }
      pagSlice('suspReq', reqs);
      renderSuspendedPage(reqs);
    }).catch(function() { setT('suspReqTbl', ''); });
  }

  function renderSuspendedPage(arr) {
    if (arr) pagSlice('suspReq', arr);
    var page = pagSlice('suspReq', _pageData['suspReq'] || []);
    var existing = document.getElementById('pag-suspReq');
    if (existing) existing.remove();
    setT('suspReqTbl', page.map(function(r) {
      var reportList = (r.reports || []).map(function(rp) {
        return '<div style="font-size:11px;color:#a0a0b8;margin-bottom:2px">• ' + esc(rp.reason||'') + (rp.note ? ' — ' + esc(rp.note) : '') + '</div>';
      }).join('');
      var cname = r.client ? esc(r.client.name||'-') : '-';
      var cid = r.client ? r.client._id : '';
      return '<tr>' +
        '<td style="font-weight:600">' + esc((r.title||'-').substring(0,40)) + '</td>' +
        '<td>' + uLnk(cid, cname, '#3b82f6') + '</td>' +
        '<td style="font-size:12px">' + esc(r.service||'-') + '</td>' +
        '<td style="font-size:12px">' + (r.reports||[]).length + ' reports<br>' + reportList + '</td>' +
        '<td style="font-size:12px;color:#a0a0b8">' + fmt(r.suspendedAt) + '</td>' +
        '<td><div style="display:flex;gap:6px;">' +
          '<button class="btn bgrn" data-sr-id="' + r._id + '" data-sr-act="restore">✓ Restore</button>' +
          '<button class="btn brdn" data-sr-id="' + r._id + '" data-sr-act="delete">🗑 Delete</button>' +
        '</div></td>' +
      '</tr>';
    }).join(''));
    pagHTML('suspReq', 'suspReqTbl');
    var tbl = document.getElementById('suspReqTbl');
    if (tbl) {
      tbl.onclick = function(ev) {
        var btn = ev.target.closest('[data-sr-act]');
        if (!btn) return;
        var act = btn.dataset.srAct, id = btn.dataset.srId;
        var label = act === 'restore' ? 'Restore this request and unrestrict the client?' : 'Permanently delete this request?';
        if (!confirm(label)) return;
        api('suspended-requests/' + id + '/action', 'POST', { action: act }).then(function(d) {
          if (d.success) { toast(d.message); loadSuspendedRequests(); }
          else toast(d.message || 'Failed', 'e');
        }).catch(function() { toast('Error', 'e'); });
      };
    }
  }
   
  /* ═══════════════════════════════════════════════════════════
     SETTINGS TAB
  ═══════════════════════════════════════════════════════════ */
  function loadSettingsTab() {
    // Show API URL
    if (g('settApiUrl')) g('settApiUrl').value = API;
    // Wire download report buttons
    if (g('dlExperts'))  g('dlExperts').onclick  = function() { downloadReport('experts'); };
    if (g('dlClients'))  g('dlClients').onclick  = function() { downloadReport('clients'); };
    if (g('dlApproaches')) g('dlApproaches').onclick = function() { downloadReport('approaches'); };
    if (g('dlPosts'))    g('dlPosts').onclick    = function() { downloadReport('posts'); };
    if (g('dlCredits'))  g('dlCredits').onclick  = function() { downloadReport('credits'); };
    // Show admin info
    if (g('settAdminInfo')) {
      g('settAdminInfo').innerHTML =
        '<strong>' + esc((adm&&adm.adminId)||(adm&&adm.name)||'Admin') + '</strong>' +
        '<div style="color:#606078;margin-top:4px;font-size:12px">Last login: ' + ((adm&&adm.lastLogin) ? new Date(adm.lastLogin).toLocaleString('en-IN') : 'N/A') + '</div>';
    }
    // Load platform stats
    loadSettingsStats();
    // Password change
    if (g('settSavePwBtn')) {
      g('settSavePwBtn').onclick = function() {
        var old = g('settOldPw').value, nw = g('settNewPw').value, nw2 = g('settNewPw2').value;
        if (!old || !nw || !nw2) { toast('Fill all password fields', 'e'); return; }
        if (nw !== nw2) { toast('Passwords do not match', 'e'); return; }
        if (nw.length < 8) { toast('Password must be 8+ characters', 'e'); return; }
        api('settings/change-password', 'POST', { currentPassword: old, newPassword: nw })
          .then(function(d) {
            if (d.success) { toast('Password updated'); g('settOldPw').value=''; g('settNewPw').value=''; g('settNewPw2').value=''; }
            else toast(d.message||'Failed', 'e');
          }).catch(function() { toast('Error', 'e'); });
      };
    }
    if (g('settRefreshStats')) g('settRefreshStats').onclick = loadSettingsStats;
  }

  function loadSettingsStats() {
    if (!g('settStats')) return;
    g('settStats').innerHTML = '<div class="spin"></div>';
    api('stats' + qs({})).then(function(d) {
      if (!d.success) { g('settStats').innerHTML = '<p style="color:#606078;text-align:center">Could not load stats</p>'; return; }
      var s = d.stats || {};
      var cr = s.credits || {};
      var items = [
        { label: 'Total Experts', val: s.totalExperts||0, color: '#FC8019' },
        { label: 'Total Clients', val: s.totalClients||0, color: '#3b82f6' },
        { label: 'Requests', val: s.totalRequests||0, color: '#f0f0f4' },
        { label: 'Approaches', val: s.totalApproaches||0, color: '#f0f0f4' },
        { label: 'Credits Spent', val: cr.totalSpent||0, color: '#f59e0b' },
        { label: 'Credits Refunded', val: cr.totalRefunded||0, color: '#a855f7' }
      ];
      g('settStats').innerHTML = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">' +
        items.map(function(it) {
          return '<div style="background:#18181d;border-radius:8px;padding:10px"><div style="font-size:10px;color:#606078;text-transform:uppercase;margin-bottom:4px">' + it.label + '</div><div style="font-size:20px;font-weight:800;color:' + it.color + '">' + it.val + '</div></div>';
        }).join('') + '</div>';
    }).catch(function() { g('settStats').innerHTML = '<p style="color:#606078;text-align:center">Could not load stats</p>'; });
  }
/* ═══ DOWNLOAD REPORTS ══════════════════════════════════════════════════ */
  function downloadReport(type) {
    var btn = g('dl' + type.charAt(0).toUpperCase() + type.slice(1));
    if (btn) { btn.textContent = 'Loading...'; btn.disabled = true; }

    var promise;
    if (type === 'experts') {
      promise = api('users?role=expert&limit=500').then(function(d) {
        return (d.users||[]).map(function(u) {
          return { Name: u.name, Email: u.email, Phone: u.phone||'', Credits: u.credits||0, Rating: u.rating||'-', Status: u.isBanned?'Banned':u.isRestricted?'Restricted':u.isFlagged?'Flagged':'Active', Joined: fmt(u.createdAt) };
        });
      });
    } else if (type === 'clients') {
      promise = api('users?role=client&limit=500').then(function(d) {
        return (d.users||[]).map(function(u) {
          return { Name: u.name, Email: u.email, Phone: u.phone||'', Credits: u.credits||0, Rating: u.rating||'-', Status: u.isBanned?'Banned':u.isRestricted?'Restricted':u.isFlagged?'Flagged':'Active', Joined: fmt(u.createdAt) };
        });
      });
    } else if (type === 'approaches') {
      promise = api('approaches?limit=500').then(function(d) {
        return (d.approaches||[]).map(function(a) {
          return { Expert: a.expert?a.expert.name:'-', Client: a.client?a.client.name:'-', Request: a.request?a.request.title:'-', Quote: a.quote||'-', Message: (a.message||'').substring(0,100), Credits: a.creditsSpent||0, Status: a.status||'-', Date: fmt(a.createdAt) };
        });
      });
    } else if (type === 'posts') {
      promise = api('requests?limit=500').then(function(d) {
        return (d.requests||[]).map(function(p) {
          return { Title: p.title||'-', Client: p.client?p.client.name:'-', Service: p.service||'-', Budget: p.budget||'-', Status: p.status||'-', Credits: p.credits||0, Date: fmt(p.createdAt) };
        });
      });
    } else if (type === 'credits') {
      promise = api('credits?limit=500').then(function(d) {
        return (d.transactions||[]).map(function(tx) {
          return { Expert: tx.user?tx.user.name:'-', Email: tx.user?tx.user.email:'-', Type: tx.type||'-', Amount: tx.amount||0, Balance: tx.balanceAfter||0, Description: (tx.description||'-').substring(0,80), Date: fmtT(tx.createdAt) };
        });
      });
    }

    if (!promise) return;
    promise.then(function(rows) {
      if (btn) { btn.textContent = btn.dataset.label || 'Download'; btn.disabled = false; }
      if (!rows.length) { toast('No data to export', 'i'); return; }
      // Show format picker
      var fmt2 = confirm('Click OK for Excel (CSV), Cancel for printable PDF view');
      if (fmt2) {
        exportCSV(rows, type + '-report-' + new Date().toISOString().slice(0,10));
        toast('CSV downloaded ✓');
      } else {
        exportPrintPDF(rows, type);
      }
    }).catch(function() {
      if (btn) { btn.textContent = btn.dataset.label || 'Download'; btn.disabled = false; }
      toast('Error loading data', 'e');
    });
  }

  function exportPrintPDF(rows, title) {
    if (!rows.length) return;
    var keys = Object.keys(rows[0]);
    var w = window.open('', '_blank');
    var tableRows = rows.map(function(r) {
      return '<tr>' + keys.map(function(k) { return '<td>' + String(r[k]||'').replace(/</g,'&lt;') + '</td>'; }).join('') + '</tr>';
    }).join('');
    w.document.write(
      '<html><head><title>WorkIndex ' + title + ' Report</title>' +
      '<style>body{font-family:system-ui;padding:20px;font-size:12px}' +
      'h2{color:#FC8019;margin-bottom:4px}' +
      'table{width:100%;border-collapse:collapse;margin-top:14px}' +
      'th{background:#FC8019;color:#fff;padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase}' +
      'td{padding:7px 10px;border-bottom:1px solid #eee;vertical-align:top}' +
      'tr:nth-child(even){background:#f9f9f9}' +
      '@media print{body{padding:8px}}' +
      '</style></head><body>' +
      '<h2>WorkIndex — ' + title.charAt(0).toUpperCase()+title.slice(1) + ' Report</h2>' +
      '<div style="font-size:11px;color:#888;margin-bottom:10px">Generated: ' + new Date().toLocaleString('en-IN') + ' · Total: ' + rows.length + ' records</div>' +
      '<table><thead><tr>' + keys.map(function(k){return '<th>'+k+'</th>';}).join('') + '</tr></thead><tbody>' + tableRows + '</tbody></table>' +
      '</body></html>'
    );
    w.document.close();
    setTimeout(function() { w.print(); }, 600);
  }
   
  function dangerAction(action) {
    var msgs = { clearLogs: 'Clear all communication logs older than 90 days?', clearFailedPayments: 'Clear all failed payment logs?' };
    if (!confirm(msgs[action]||'Are you sure?')) return;
    api('settings/danger/' + action, 'POST', {}).then(function(d) {
      toast(d.message||'Done');
    }).catch(function() { toast('Error', 'e'); });
  }

  /* ═══════════════════════════════════════════════════════════
     INVOICE — TAX RATE TOGGLE
  ═══════════════════════════════════════════════════════════ */
  function initInvoiceTaxToggle() {
    var sel = g('invTaxRate');
    if (!sel) return;
    sel.addEventListener('change', function() {
      var box = g('invCustomTaxBox');
      if (box) box.style.display = this.value === 'custom' ? 'block' : 'none';
      previewInvoice();
    });
    var customInput = g('invCustomTax');
    if (customInput) customInput.addEventListener('input', previewInvoice);
  }

  /* ═══════════════════════════════════════════════════════════
     INDIA SVG CHOROPLETH HEATMAP
     Proper state paths — replaces the tile grid approach
  ═══════════════════════════════════════════════════════════ */
  // Full India SVG viewBox path data for all states
  // Using simplified but geographically accurate paths
  var INDIA_STATES_SVG = {
    viewBox: "0 0 950 1050",
    states: [
      { id: "Jammu & Kashmir", name: "Jammu & Kashmir", abbr: "J&K", d: "M 285 30 L 320 25 L 365 45 L 385 80 L 360 110 L 330 125 L 295 115 L 270 85 Z" },
      { id: "Himachal Pradesh", name: "Himachal Pradesh", abbr: "HP", d: "M 320 115 L 370 108 L 390 135 L 370 165 L 335 160 L 318 140 Z" },
      { id: "Punjab", name: "Punjab", abbr: "PB", d: "M 265 120 L 320 115 L 318 140 L 300 158 L 270 155 L 255 138 Z" },
      { id: "Haryana", name: "Haryana", abbr: "HR", d: "M 285 158 L 330 155 L 340 185 L 318 205 L 288 198 L 278 178 Z" },
      { id: "Delhi", name: "Delhi", abbr: "DL", d: "M 318 185 L 335 182 L 338 198 L 322 202 Z" },
      { id: "Rajasthan", name: "Rajasthan", abbr: "RJ", d: "M 190 170 L 280 158 L 290 200 L 280 270 L 240 320 L 188 310 L 158 268 L 162 210 Z" },
      { id: "Uttar Pradesh", name: "Uttar Pradesh", abbr: "UP", d: "M 335 180 L 445 168 L 490 200 L 480 265 L 430 295 L 360 285 L 320 255 L 308 215 Z" },
      { id: "Uttarakhand", name: "Uttarakhand", abbr: "UK", d: "M 370 148 L 420 142 L 450 168 L 415 185 L 380 178 Z" },
      { id: "Bihar", name: "Bihar", abbr: "BR", d: "M 490 200 L 560 195 L 580 235 L 555 265 L 500 260 L 482 235 Z" },
      { id: "Jharkhand", name: "Jharkhand", abbr: "JH", d: "M 500 265 L 562 268 L 575 310 L 545 340 L 500 335 L 482 300 Z" },
      { id: "West Bengal", name: "West Bengal", abbr: "WB", d: "M 580 220 L 620 215 L 645 260 L 630 320 L 595 350 L 565 310 L 580 270 Z" },
      { id: "Sikkim", name: "Sikkim", abbr: "SK", d: "M 620 195 L 640 190 L 645 210 L 625 215 Z" },
      { id: "Assam", name: "Assam", abbr: "AS", d: "M 650 215 L 720 210 L 740 240 L 710 265 L 660 258 L 645 238 Z" },
      { id: "Arunachal Pradesh", name: "Arunachal Pradesh", abbr: "AR", d: "M 660 165 L 760 158 L 785 195 L 740 210 L 655 210 Z" },
      { id: "Meghalaya", name: "Meghalaya", abbr: "ML", d: "M 655 268 L 710 265 L 720 292 L 685 300 L 655 288 Z" },
      { id: "Nagaland", name: "Nagaland", abbr: "NL", d: "M 740 240 L 775 235 L 780 262 L 748 268 L 740 255 Z" },
      { id: "Manipur", name: "Manipur", abbr: "MN", d: "M 748 268 L 780 265 L 785 295 L 758 305 L 742 290 Z" },
      { id: "Tripura", name: "Tripura", abbr: "TR", d: "M 690 305 L 715 300 L 718 328 L 695 332 Z" },
      { id: "Mizoram", name: "Mizoram", abbr: "MZ", d: "M 718 310 L 748 308 L 752 340 L 722 345 Z" },
      { id: "Madhya Pradesh", name: "Madhya Pradesh", abbr: "MP", d: "M 230 310 L 370 290 L 440 310 L 450 370 L 410 420 L 320 435 L 235 420 L 200 370 L 208 330 Z" },
      { id: "Gujarat", name: "Gujarat", abbr: "GJ", d: "M 125 295 L 192 312 L 205 370 L 195 420 L 160 455 L 110 465 L 80 440 L 70 390 L 90 340 Z" },
      { id: "Maharashtra", name: "Maharashtra", abbr: "MH", d: "M 195 425 L 315 438 L 370 455 L 380 520 L 340 570 L 270 585 L 200 565 L 162 510 L 158 458 Z" },
      { id: "Chhattisgarh", name: "Chhattisgarh", abbr: "CG", d: "M 450 375 L 535 368 L 555 430 L 520 480 L 460 475 L 435 430 Z" },
      { id: "Odisha", name: "Odisha", abbr: "OD", d: "M 540 345 L 600 340 L 625 390 L 610 445 L 565 465 L 525 445 L 520 395 Z" },
      { id: "Telangana", name: "Telangana", abbr: "TS", d: "M 355 575 L 440 565 L 475 600 L 460 650 L 400 658 L 355 630 L 342 600 Z" },
      { id: "Andhra Pradesh", name: "Andhra Pradesh", abbr: "AP", d: "M 420 580 L 570 555 L 600 600 L 580 660 L 520 695 L 450 685 L 408 648 L 424 608 Z" },
      { id: "Karnataka", name: "Karnataka", abbr: "KA", d: "M 200 595 L 345 585 L 365 640 L 345 700 L 295 730 L 230 720 L 185 680 L 175 635 Z" },
      { id: "Goa", name: "Goa", abbr: "GA", d: "M 162 590 L 198 585 L 202 612 L 168 618 Z" },
      { id: "Tamil Nadu", name: "Tamil Nadu", abbr: "TN", d: "M 295 735 L 375 710 L 430 750 L 420 830 L 375 880 L 320 870 L 275 810 L 268 760 Z" },
      { id: "Kerala", name: "Kerala", abbr: "KL", d: "M 222 730 L 290 738 L 285 830 L 258 880 L 215 850 L 200 790 L 208 755 Z" },
      { id: "Lakshadweep", name: "Lakshadweep", abbr: "LD", d: "M 120 780 L 130 780 L 132 792 L 120 792 Z" },
      { id: "Andaman & Nicobar", name: "Andaman & Nicobar", abbr: "AN", d: "M 790 580 L 800 575 L 808 615 L 796 618 Z" }
    ]
  };

  function renderIndiaSvgMap(byState, total) {
    var stateData = byState || {};
    var maxCount = 0;
    Object.keys(stateData).forEach(function(s) {
      if (stateData[s] && stateData[s].count > maxCount) maxCount = stateData[s].count;
    });

    var svgPaths = INDIA_STATES_SVG.states.map(function(st) {
      // Try to match by exact name, then by abbr
      var data = stateData[st.name] || stateData[st.id] || stateData[st.abbr] || null;
      // Also try city-level match (experts stored by city)
      if (!data) {
        var firstWord = st.name.toLowerCase().split(' ')[0];
        Object.keys(stateData).forEach(function(k) {
          if (k.toLowerCase().indexOf(firstWord) >= 0) data = stateData[k];
        });
      }
      // Also try matching city data directly to state (experts store by city name)
      if (!data) {
        Object.keys(stateData).forEach(function(k) {
          var kl = k.toLowerCase();
          var nl = st.name.toLowerCase();
          if (kl === nl || nl.indexOf(kl) >= 0) data = stateData[k];
        });
      }
      var count = data ? data.count : 0;
      var intensity = maxCount > 0 ? count / maxCount : 0;
      // Color: dark (#1a1a24) to orange (#FC8019)
      var r = Math.round(26 + intensity * (252-26));
      var g2 = Math.round(26 + intensity * (128-26));
      var b = Math.round(36 + intensity * (25-36));
      var fill = count > 0 ? ('rgb('+r+','+g2+','+b+')') : '#1a1a24';
      var opacity = count > 0 ? (0.4 + intensity * 0.6) : 0.5;
      return '<path class="hm-state" id="hms-' + st.abbr + '" d="' + st.d + '" fill="' + fill + '" opacity="' + opacity + '" data-state="' + esc(st.name) + '" data-count="' + count + '" data-abbr="' + st.abbr + '"><title>' + esc(st.name) + ': ' + count + ' users</title></path>' +
        (count > 0 ? '<text x="' + svgCentroid(st.d).x + '" y="' + (svgCentroid(st.d).y+4) + '" text-anchor="middle" fill="white" font-size="7" font-weight="700" pointer-events="none" style="text-shadow:0 1px 2px rgba(0,0,0,.8)">' + st.abbr + '</text><text x="' + svgCentroid(st.d).x + '" y="' + (svgCentroid(st.d).y+14) + '" text-anchor="middle" fill="rgba(255,255,255,.85)" font-size="6" pointer-events="none">' + count + '</text>' : '<text x="' + svgCentroid(st.d).x + '" y="' + (svgCentroid(st.d).y+4) + '" text-anchor="middle" fill="rgba(150,150,180,.4)" font-size="6" pointer-events="none">' + st.abbr + '</text>');
    }).join('');

    return '<svg id="indiaSvgMap" viewBox="' + INDIA_STATES_SVG.viewBox + '" style="width:100%;max-height:500px;cursor:pointer" xmlns="http://www.w3.org/2000/svg">' +
      '<rect width="950" height="1050" fill="#0d0d14" rx="10"/>' +
      svgPaths +
      '</svg>' +
      '<div id="hmTip" style="position:fixed;background:#111115;border:1px solid rgba(255,255,255,.15);border-radius:8px;padding:8px 12px;font-size:12px;pointer-events:none;display:none;z-index:9999;min-width:130px;box-shadow:0 4px 20px rgba(0,0,0,.5)"></div>';
  }

  function svgCentroid(d) {
    // Rough centroid from path data
    var nums = d.match(/[\d.]+/g)||[];
    var xs = [], ys = [];
    for (var i=0; i<nums.length-1; i+=2) { xs.push(parseFloat(nums[i])); ys.push(parseFloat(nums[i+1])); }
    var cx = xs.reduce(function(a,b){return a+b;},0)/xs.length;
    var cy = ys.reduce(function(a,b){return a+b;},0)/ys.length;
    return { x: Math.round(cx), y: Math.round(cy) };
  }

  function attachSvgMapEvents() {
    var svg = document.getElementById('indiaSvgMap');
    if (!svg) return;
    var tip = document.getElementById('hmTip');
    svg.querySelectorAll('.hm-state').forEach(function(path) {
      path.addEventListener('mouseenter', function(ev) {
        var cnt = parseInt(this.dataset.count)||0;
        if (tip) {
          tip.innerHTML = '<strong>' + esc(this.dataset.state) + '</strong><br>' + cnt + ' users';
          tip.style.display = 'block';
        }
      });
      path.addEventListener('mousemove', function(ev) {
        if (tip) { tip.style.left = (ev.clientX+12)+'px'; tip.style.top = (ev.clientY-10)+'px'; }
      });
      path.addEventListener('mouseleave', function() {
        if (tip) tip.style.display = 'none';
      });
      path.addEventListener('click', function() {
        if (tip) tip.style.display = 'none';
        drillHeatmapState(this.dataset.state);
      });
    });
  }

  function drillHeatmapState(stateName) {
    if (!_hmData || !_hmData.byState) return;
    var data = _hmData.byState[stateName];
    if (!data || !data.cities) {
      toast('No city data for ' + stateName);
      return;
    }
    _hmState = stateName;
    g('hmCrumbs').innerHTML = '<span class="hm-crumb" data-level="country" style="cursor:pointer">India</span><span class="hm-crumb"> › ' + esc(stateName) + '</span>';
    // Build city breakdown
    var cities = data.cities;
    var sorted = Object.keys(cities).sort(function(a,b){return cities[b]-cities[a];});
    var maxC = cities[sorted[0]]||1;
    var cityHtml = sorted.map(function(city) {
      var cnt = cities[city];
      var w = Math.max(4, Math.round((cnt/maxC)*200));
      return '<div class="hm-bar-row"><div class="hm-bar-label">' + esc(city) + '</div>' +
        '<div class="hm-bar" style="width:'+w+'px;background:linear-gradient(90deg,#FC8019,#e06b0a)"></div>' +
        '<div class="hm-bar-val">' + cnt + '</div></div>';
    }).join('');
    g('hmMapArea').innerHTML = '<div style="padding:10px">' +
      '<div style="font-size:13px;font-weight:700;margin-bottom:12px;color:#FC8019">Cities in ' + esc(stateName) + '</div>' +
      (sorted.length ? cityHtml : '<p style="color:#606078">No city data available</p>') +
      '</div>';
    g('hmBarTitle').textContent = 'Cities in ' + stateName;
    // Update bar chart with city data
    renderHmBars({}, cities);
  }

   

// ═══════════════════════════════════════════════════════════
// ADD TO: admin-app.js
// 1. Add 'emailNotifications' to sectionLoaders()
// 2. Add to PT and PS objects
// 3. Add the full loadEmailNotifications function below
// ═══════════════════════════════════════════════════════════
/* ═══ REVENUE DASHBOARD ══════════════════════════════════ */
  var _revChart = null, _revSvcChart = null;

  window.loadRevenue = function loadRevenue() {
    var period = (g('revPeriod') || {}).value || 'month';
   g('revSummary').innerHTML = '<div style="color:#a0a0b8;font-size:13px;padding:8px;">Loading...</div>';

    var svcPeriod = (g('revSvcPeriod') || {}).value || 'all';
    api('revenue?period=' + period + '&svcPeriod=' + svcPeriod).then(function(d) {
       if (!d.success) return;
      var s = d.summary || {};

      // ── Summary cards ──
      var cards = [
        { label: 'Amount Received',    value: '₹' + (s.amountReceived||0).toLocaleString('en-IN'), color: '#22c55e' },
        { label: 'Credits Purchased',  value: (s.purchased||0).toLocaleString(),                   color: '#3b82f6' },
        { label: 'Credits Spent',      value: (s.spent||0).toLocaleString(),                       color: '#FC8019' },
        { label: 'Credits Refunded',   value: (s.refunded||0).toLocaleString(),                    color: '#a855f7' },
        { label: 'Bonus Credits',      value: (s.bonus||0).toLocaleString(),                       color: '#f59e0b' },
        { label: 'Total Purchases',    value: (s.txCount||0).toLocaleString(),                     color: '#06b6d4' }
      ];
      g('revSummary').innerHTML = cards.map(function(c) {
        return '<div style="background:#18181d;border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:16px 18px;">' +
          '<div style="font-size:12px;color:#a0a0b8;margin-bottom:6px;">' + c.label + '</div>' +
          '<div style="font-size:22px;font-weight:700;color:' + c.color + '">' + c.value + '</div>' +
          '</div>';
      }).join('');

      // ── Time series chart ──
      var bp = d.byPeriod || [];
      var labels  = bp.map(function(r) { return r.label; });
      var purch   = bp.map(function(r) { return r.purchased  || 0; });
      var spent   = bp.map(function(r) { return r.spent      || 0; });
      var refund  = bp.map(function(r) { return r.refunded   || 0; });
      var revenue = bp.map(function(r) { return r.amountReceived || 0; });

      var ctx = g('revChart');
      if (!ctx) return;
      if (_revChart) { _revChart.destroy(); _revChart = null; }
      var chartType = (g('revChartType') || {}).value || 'bar';

      _revChart = new Chart(ctx, {
        type: chartType,
        data: {
          labels: labels,
          datasets: [
            { label: '₹ Revenue',   data: revenue, backgroundColor: 'rgba(34,197,94,0.7)',  borderColor: '#22c55e', borderWidth: 2, tension: 0.3, fill: chartType==='line' },
            { label: 'Purchased',   data: purch,   backgroundColor: 'rgba(59,130,246,0.7)', borderColor: '#3b82f6', borderWidth: 2, tension: 0.3 },
            { label: 'Spent',       data: spent,   backgroundColor: 'rgba(252,128,25,0.7)', borderColor: '#FC8019', borderWidth: 2, tension: 0.3 },
            { label: 'Refunded',    data: refund,  backgroundColor: 'rgba(168,85,247,0.7)', borderColor: '#a855f7', borderWidth: 2, tension: 0.3 }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { labels: { color: '#a0a0b8', font: { size: 12 } } } },
          scales: {
            x: { ticks: { color: '#a0a0b8' }, grid: { color: 'rgba(255,255,255,.05)' } },
            y: { ticks: { color: '#a0a0b8' }, grid: { color: 'rgba(255,255,255,.05)' } }
          }
        }
      });

      // ── Service breakdown ──
      var bs = d.byService || [];
      var svcLabels = bs.map(function(r) { return (r._id||'Other').toUpperCase(); });
      var svcData   = bs.map(function(r) { return r.totalCredits || 0; });
      var svcColors = ['#FC8019','#3b82f6','#22c55e','#f59e0b','#a855f7','#06b6d4','#ef4444','#84cc16'];

      var svcCtx = g('revSvcChart');
      if (svcCtx) {
        if (_revSvcChart) { _revSvcChart.destroy(); _revSvcChart = null; }
        var svcType = (g('revSvcChartType') || {}).value || 'bar';
        _revSvcChart = new Chart(svcCtx, {
          type: svcType,
          data: {
            labels: svcLabels,
            datasets: [{ label: 'Credits Spent', data: svcData, backgroundColor: svcColors, borderColor: svcColors, borderWidth: 1, tension: 0.3 }]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: svcType==='pie', labels: { color: '#a0a0b8' } } },
            scales: svcType === 'pie' ? {} : {
              x: { ticks: { color: '#a0a0b8' }, grid: { color: 'rgba(255,255,255,.05)' } },
              y: { ticks: { color: '#a0a0b8' }, grid: { color: 'rgba(255,255,255,.05)' } }
            }
          }
        });
      }

   // ── Service table ──
      var totalReqs = bs.reduce(function(a,r){return a+r.count;},0)||1;
      g('revSvcTable').innerHTML = '<table style="width:100%;font-size:13px;border-collapse:collapse;">' +
        '<thead><tr>' +
          '<th style="text-align:left;padding:8px 6px;color:#a0a0b8;border-bottom:1px solid rgba(255,255,255,.07);">Service</th>' +
          '<th style="text-align:right;padding:8px 6px;color:#a0a0b8;border-bottom:1px solid rgba(255,255,255,.07);">Experts</th>' +
          '<th style="text-align:right;padding:8px 6px;color:#a0a0b8;border-bottom:1px solid rgba(255,255,255,.07);">Requests</th>' +
          '<th style="text-align:right;padding:8px 6px;color:#a0a0b8;border-bottom:1px solid rgba(255,255,255,.07);">Share</th>' +
        '</tr></thead><tbody>' +
        bs.map(function(r,i) {
          var pct = r.share !== undefined ? r.share : Math.round((r.count/totalReqs)*100);
          return '<tr>' +
            '<td style="padding:8px 6px;color:#f0f0f4;font-weight:600;">' +
              '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' + svcColors[i%svcColors.length] + ';margin-right:6px;"></span>' +
              (r._id||'Other').toUpperCase() +
            '</td>' +
            '<td style="padding:8px 6px;text-align:right;color:#22c55e;font-weight:600;">' + (r.expertCount||0) + '</td>' +
            '<td style="padding:8px 6px;text-align:right;color:#a0a0b8;">' + (r.count||0) + '</td>' +
            '<td style="padding:8px 6px;text-align:right;">' +
              '<div style="display:flex;align-items:center;justify-content:flex-end;gap:6px;">' +
                '<div style="width:60px;height:6px;background:rgba(255,255,255,.1);border-radius:3px;overflow:hidden;">' +
                  '<div style="width:' + pct + '%;height:100%;background:' + svcColors[i%svcColors.length] + ';border-radius:3px;"></div>' +
                '</div>' +
                '<span style="color:#f0f0f4;font-weight:600;min-width:32px;">' + pct + '%</span>' +
              '</div>' +
            '</td>' +
          '</tr>';
        }).join('') +
        '</tbody></table>';

    }).catch(function(e) { console.error('Revenue err:', e); });
  }

  document.addEventListener('change', function(e) {
    if (e.target.id === 'revPeriod' || e.target.id === 'revChartType' || e.target.id === 'revSvcChartType' || e.target.id === 'revSvcPeriod') {
      loadRevenue();
    }
  });
   
/* ═══ EMAIL NOTIFICATIONS TAB ════════════════════════════ */
var _emailSettings = {};

function loadEmailNotifications() {
  var sec = g('sec-emailNotifications');
  if (!sec) return;

  // Load settings + logs in parallel
  Promise.all([
    api('email-settings'),
    api('email-logs?limit=100')
  ]).then(function(results) {
    var settingsData = results[0];
    var logsData     = results[1];

    _emailSettings = (settingsData.success && settingsData.settings) ? settingsData.settings : {};
    var logs = (logsData.success && logsData.logs) ? logsData.logs : [];
    var total = logsData.total || logs.length;

    sec.innerHTML = buildEmailNotificationsUI(_emailSettings, logs, total);

    // Wire toggle changes
    sec.querySelectorAll('.email-toggle').forEach(function(toggle) {
      toggle.addEventListener('change', function() {
        var key = this.dataset.key;
        var val = this.checked;
        _emailSettings[key] = val;
        // Update visual slider
        var span = this.nextElementSibling;
        if (span) {
          span.style.background = val ? '#FC8019' : '#2a2a38';
          var thumb = span.querySelector('span');
          if (thumb) thumb.style.left = val ? '23px' : '3px';
        }
        api('email-settings', 'PUT', { [key]: val }).then(function(d) {
          if (d.success) {
            toast((val ? '✅ Enabled: ' : '🔕 Disabled: ') + key.replace(/_/g, ' '));
          } else {
            toast('Failed to save setting', 'e');
          }
        });
      });
    });

    // Wire filter changes
    var catFilter  = g('emailLogCat');
    var statFilter = g('emailLogStat');
    if (catFilter)  catFilter.onchange  = function() { reloadEmailLogs(); };
    if (statFilter) statFilter.onchange = function() { reloadEmailLogs(); };

    // Wire test digest button
    var testBtn = g('testDigestBtn');
    if (testBtn) {
      testBtn.onclick = function() {
        testBtn.textContent = 'Sending...';
        testBtn.disabled = true;
        api('email-test-digest', 'POST', {}).then(function(d) {
          testBtn.textContent = '📋 Test Daily Digest';
          testBtn.disabled = false;
          toast(d.message || 'Done', d.success ? 's' : 'e');
        });
      };
    }
  }).catch(function() {
    var sec = g('sec-emailNotifications');
    if (sec) sec.innerHTML = '<div class="empty"><h3>Failed to load email settings</h3></div>';
  });
}

function reloadEmailLogs() {
  var cat  = g('emailLogCat')  ? g('emailLogCat').value  : 'all';
  var stat = g('emailLogStat') ? g('emailLogStat').value : 'all';
  var qs   = 'email-logs?limit=100' + (cat !== 'all' ? '&category=' + cat : '') + (stat !== 'all' ? '&status=' + stat : '');
  g('emailLogsTbody').innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px"><div class="spin"></div></td></tr>';
  api(qs).then(function(d) {
    renderEmailLogsTable(d.logs || [], d.total || 0);
  });
}

function renderEmailLogsTable(logs, total) {
  var tbody = g('emailLogsTbody');
  if (!tbody) return;
  if (!logs.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;color:#606078">No email logs found</td></tr>';
    var tc = g('emailLogTotal'); if (tc) tc.textContent = '0 emails';
    return;
  }
  var tc = g('emailLogTotal'); if (tc) tc.textContent = total + ' total';
  tbody.innerHTML = logs.map(function(l) {
    var statusBadge = l.status === 'sent'
      ? '<span class="badge bgr">Sent</span>'
      : '<span class="badge brd">Failed</span>';
    var catColor = { client: '#3b82f6', expert: '#FC8019', admin: '#a855f7' };
    var catBadge = '<span class="badge" style="background:' + (catColor[l.category] || '#606078') + '20;color:' + (catColor[l.category] || '#606078') + ';border:1px solid ' + (catColor[l.category] || '#606078') + '40;">' + (l.category || '—') + '</span>';
    var typeLabel = (l.type || '').replace(/_/g, ' ');
    var date = l.createdAt ? new Date(l.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
    return '<tr>' +
      '<td style="font-size:12px;color:#f0f0f4">' + esc(l.to) + '<br><small style="color:#606078">' + esc(l.toName || '') + '</small></td>' +
      '<td>' + catBadge + '</td>' +
      '<td style="font-size:12px;color:#a0a0b8">' + esc(typeLabel) + '</td>' +
      '<td style="font-size:12px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(l.reason || l.subject || '—') + '</td>' +
      '<td>' + statusBadge + (l.error ? '<br><small style="color:#ef4444">' + esc(l.error.substring(0,40)) + '</small>' : '') + '</td>' +
      '<td style="font-size:12px;color:#606078">' + date + '</td>' +
    '</tr>';
  }).join('');
}

function buildEmailNotificationsUI(settings, logs, total) {
  var groups = [
    {
      label: '👤 Client Emails',
      items: [
        { key: 'client_welcome',           label: 'Welcome Email',                  desc: 'Sent when a client registers' },
        { key: 'client_post_created',      label: 'Request Posted',                 desc: 'Sent when client posts a new request' },
        { key: 'client_expert_approached', label: 'Expert Approached',              desc: 'Sent when an expert submits a proposal' },
        { key: 'client_post_suspended',    label: 'Post Suspended',                 desc: 'Sent when client\'s post is suspended (3 reports)' },
        { key: 'client_restricted',        label: 'Account Restricted',             desc: 'Sent when client account is restricted' },
        { key: 'client_banned',            label: 'Account Banned',                 desc: 'Sent when client account is banned' }
      ]
    },
    {
      label: '🧑‍💼 Expert Emails',
      items: [
        { key: 'expert_welcome',           label: 'Welcome Email',                  desc: 'Sent when an expert registers' },
        { key: 'expert_credits_purchased', label: 'Credits Purchased',              desc: 'Sent when expert buys credits' },
        { key: 'expert_credits_refunded',  label: 'Credits Refunded',               desc: 'Sent when admin refunds credits' },
        { key: 'expert_approach_sent',     label: 'Approach Submitted',             desc: 'Sent when expert submits an approach' },
        { key: 'expert_restricted',        label: 'Account Restricted',             desc: 'Sent when expert account is restricted' },
        { key: 'expert_banned',            label: 'Account Banned',                 desc: 'Sent when expert account is banned' }
      ]
    },
    {
      label: '🔑 Admin Emails',
      items: [
        { key: 'admin_post_suspended',     label: 'Post Suspended Alert',           desc: 'Admin notified when a post is auto-suspended' },
        { key: 'admin_user_restricted',    label: 'User Restricted Alert',          desc: 'Admin notified when any user is auto-restricted' },
         { key: 'admin_ticket_escalated',   label: 'Ticket Escalated Alert',         desc: 'Admin notified when a user sends a follow-up and ticket is escalated' },
        { key: 'admin_daily_tickets',      label: 'Daily Ticket Digest (9:30 PM)',  desc: 'Daily summary of open tickets sent to admin' }
      ]
    }
  ];

  var togglesHTML = groups.map(function(group) {
    var rows = group.items.map(function(item) {
      var isOn = settings[item.key] !== false;
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:14px 0;border-bottom:1px solid #18181d;">' +
        '<div>' +
          '<div style="font-size:14px;font-weight:600;color:#f0f0f4">' + item.label + '</div>' +
          '<div style="font-size:12px;color:#606078;margin-top:2px">' + item.desc + '</div>' +
        '</div>' +
        '<label style="position:relative;display:inline-block;width:44px;height:24px;flex-shrink:0;">' +
          '<input type="checkbox" class="email-toggle" data-key="' + item.key + '" ' + (isOn ? 'checked' : '') + ' style="opacity:0;width:0;height:0;">' +
          '<span style="position:absolute;cursor:pointer;inset:0;background:' + (isOn ? '#FC8019' : '#2a2a38') + ';border-radius:24px;transition:.2s;">' +
            '<span style="position:absolute;content:\'\';height:18px;width:18px;left:' + (isOn ? '23px' : '3px') + ';bottom:3px;background:#fff;border-radius:50%;transition:.2s;"></span>' +
          '</span>' +
        '</label>' +
      '</div>';
    }).join('');
    return '<div class="ch" style="margin-bottom:20px;">' +
      '<div style="font-size:13px;font-weight:700;color:#FC8019;text-transform:uppercase;letter-spacing:.08em;margin-bottom:14px;">' + group.label + '</div>' +
      rows +
    '</div>';
  }).join('');

  var logsHTML = '<div class="ch">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px;">' +
      '<div style="font-size:15px;font-weight:700;color:#f0f0f4">📬 Email Log <span id="emailLogTotal" style="font-size:12px;color:#606078;margin-left:6px">' + total + ' total</span></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
        '<select id="emailLogCat" style="padding:6px 10px;background:#18181d;border:1px solid #2a2a38;border-radius:6px;color:#a0a0b8;font-size:13px;">' +
          '<option value="all">All Categories</option>' +
          '<option value="client">Client</option>' +
          '<option value="expert">Expert</option>' +
          '<option value="admin">Admin</option>' +
        '</select>' +
        '<select id="emailLogStat" style="padding:6px 10px;background:#18181d;border:1px solid #2a2a38;border-radius:6px;color:#a0a0b8;font-size:13px;">' +
          '<option value="all">All Status</option>' +
          '<option value="sent">Sent</option>' +
          '<option value="failed">Failed</option>' +
        '</select>' +
        '<button id="testDigestBtn" class="btn bgho" style="font-size:12px;padding:6px 12px;">📋 Test Daily Digest</button>' +
      '</div>' +
    '</div>' +
    '<div style="overflow-x:auto;">' +
    '<table style="width:100%;border-collapse:collapse;font-size:13px;">' +
      '<thead><tr style="background:#18181d;color:#606078;font-size:11px;text-transform:uppercase;">' +
        '<th style="padding:10px 12px;text-align:left;">Sent To</th>' +
        '<th style="padding:10px 12px;text-align:left;">Category</th>' +
        '<th style="padding:10px 12px;text-align:left;">Type</th>' +
        '<th style="padding:10px 12px;text-align:left;">Reason</th>' +
        '<th style="padding:10px 12px;text-align:left;">Status</th>' +
        '<th style="padding:10px 12px;text-align:left;">Time</th>' +
      '</tr></thead>' +
      '<tbody id="emailLogsTbody">' + (function() {
        if (!logs.length) return '<tr><td colspan="6" style="text-align:center;padding:30px;color:#606078">No emails sent yet</td></tr>';
        return logs.map(function(l) {
          var statusBadge = l.status === 'sent' ? '<span class="badge bgr">Sent</span>' : '<span class="badge brd">Failed</span>';
          var catColor = { client: '#3b82f6', expert: '#FC8019', admin: '#a855f7' };
          var catBadge = '<span class="badge" style="background:' + (catColor[l.category]||'#606078') + '20;color:' + (catColor[l.category]||'#606078') + ';">' + (l.category||'—') + '</span>';
          var date = l.createdAt ? new Date(l.createdAt).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) : '—';
          return '<tr><td style="font-size:12px;color:#f0f0f4">' + esc(l.to) + '<br><small style="color:#606078">' + esc(l.toName||'') + '</small></td>' +
            '<td>' + catBadge + '</td>' +
            '<td style="font-size:12px;color:#a0a0b8">' + esc((l.type||'').replace(/_/g,' ')) + '</td>' +
            '<td style="font-size:12px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(l.reason||l.subject||'—') + '</td>' +
            '<td>' + statusBadge + '</td>' +
            '<td style="font-size:12px;color:#606078">' + date + '</td></tr>';
        }).join('');
      })() +
      '</tbody>' +
    '</table></div></div>';

  return '<div style="max-width:860px;">' + togglesHTML + logsHTML + '</div>';
}
   
})();
