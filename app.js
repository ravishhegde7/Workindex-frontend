/* ═══════════════════════════════════════════════════════════
   WORKINDEX COMPLETE JAVASCRIPT v2.0
   Add this inside your <script> tag
   ═══════════════════════════════════════════════════════════ */

// ─── CONFIGURATION ─── 
const API_URL = 'https://workindex-production.up.railway.app/api';

// ─── STATE MANAGEMENT ─── 
const state = {
  token: localStorage.getItem('token') || null,
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  currentPage: 'landing',
  currentTab: 'requests',
  selectedRating: 0,
  documents: [],
  accessRequests: [],
  ratings: [],
  experts: [],
  approachedRequests: [],
  myApproaches: []  // ← NEW: Store expert's approaches
};
// ─── INACTIVITY LOGOUT (30 minutes) ───
const INACTIVITY_TIMEOUT = 30 * 60 * 1000;
let inactivityTimer = null;

function resetInactivityTimer() {
  if (!state.token || !state.user) return;
  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(() => {
    handleSessionExpired();
  }, INACTIVITY_TIMEOUT);
}

function startInactivityWatcher() {
  const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
  events.forEach(event => {
    window.addEventListener(event, resetInactivityTimer, { passive: true });
  });
  resetInactivityTimer();
}

function stopInactivityWatcher() {
  clearTimeout(inactivityTimer);
  inactivityTimer = null;
}

function handleSessionExpired() {
  stopInactivityWatcher();
  if (notificationInterval) clearInterval(notificationInterval);
  if (chatPollingInterval) clearInterval(chatPollingInterval);
  notificationInterval = null;
  chatPollingInterval = null;
  currentChatId = null;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  state.token = null;
  state.user  = null;
  showToast('Session expired due to inactivity. Please log in again.', 'error');
  setTimeout(() => {
    showPage('landing');
  }, 1500);
}

// ─── DARK MODE ─── 
function initDarkMode() {
  const isDark = localStorage.getItem('darkMode') === 'true';
  if (isDark) {
    document.body.classList.add('dark-mode');
    const toggle = document.getElementById('darkModeToggle');
    if (toggle) toggle.checked = true;
  }
}

function toggleDarkMode() {
  const isDark = document.body.classList.toggle('dark-mode');
  localStorage.setItem('darkMode', isDark);
  showToast(isDark ? 'Dark mode enabled' : 'Light mode enabled', 'success');
}

// ─── NAVIGATION ─── 
function showPage(pageId, pushState = true) {
  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active');
  });

  const page = document.getElementById(pageId);
  if (page) {
    page.classList.add('active');
    state.currentPage = pageId;

    // ── URL mapping ──
    const pageToPath = {
      landing:           '/',
      findProfessionals: '/find-professionals',
      howItWorks:        '/how-it-works',
      pricing:           '/pricing',
      clientDash:        '/dashboard',
      expertDash:        '/dashboard',
      settings:          '/settings',
      myTickets:         '/my-tickets',
    };

    const path = pageToPath[pageId] || '/';
    if (pushState && window.location.pathname !== path) {
      history.pushState({ pageId }, '', path);
    }

    // ── Existing page load logic ──
    if (pageId === 'myTickets') {
      loadMyTickets();
    }
    if (pageId === 'findProfessionals') {
      const pending = state.pendingSearch || {};
      state.pendingSearch = null;
      if (pending.service) {
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        document.querySelector(`[data-service="${pending.service}"]`)?.classList.add('active');
      }
      if (pending.location) {
        setTimeout(() => {
          const input = document.getElementById('expertSearchInput');
          if (input) input.value = pending.location;
        }, 100);
      }
      loadExperts({
        service: pending.service || undefined,
        location: pending.location || undefined
      });
    } else if (pageId === 'clientDash' && state.user?.role === 'client') {
      loadClientData();
    } else if (pageId === 'expertDash' && state.user?.role === 'expert') {
      loadExpertData();
    } else if (pageId === 'settings') {
      loadSettings();
    }
  }
}
function goBack() {
  if (window.history.length > 1) {
    window.history.back();
  } else if (state.user) {
    showPage(state.user.role === 'client' ? 'clientDash' : 'expertDash');
  } else {
    showPage('landing');
  }
}

function switchTab(tabName) {
  state.currentTab = tabName;
  
  document.querySelectorAll('.dash-tab').forEach(tab => tab.classList.remove('active'));
  document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');
  
  document.querySelectorAll('.tab-content').forEach(content => content.style.display = 'none');
  
  const isExpert = state.user?.role === 'expert';

  // Determine correct content div ID
  let contentId;
  if (tabName === 'profile' && isExpert) {
    contentId = 'expertProfileTab';
  } else if (tabName === 'chat' && isExpert) {
    contentId = 'expertChatTab';
  } else if (tabName === 'chat' && !isExpert) {
    contentId = 'clientChatTab';
  } else {
    contentId = tabName + 'Tab';
  }
  
  const content = document.getElementById(contentId);
  if (content) {
    content.style.display = 'block';
    if (tabName === 'documents') loadDocuments();
        else if (tabName === 'explore' && !isExpert) {
      loadClientExplorePage();
      // Re-attach invite button listener after render
      setTimeout(() => {
        const invBtn = document.getElementById('exploreFilterInvites');
        if (invBtn) invBtn.onclick = () => filterClientExplore('invites');
        const allBtn = document.getElementById('exploreFilterAll');
        if (allBtn) allBtn.onclick = () => filterClientExplore('all');
        const slBtn = document.getElementById('exploreFilterShortlisted');
        if (slBtn) slBtn.onclick = () => filterClientExplore('shortlisted');
      }, 100);
    }
    else if (tabName === 'invites' && !isExpert) loadClientInvites();
    else if (tabName === 'access') loadAccessRequests();
    else if (tabName === 'ratings') loadMyRatings();
    else if (tabName === 'approaches' && isExpert) loadMyApproaches();
    else if (tabName === 'profile' && isExpert) renderExpertProfile();
    else if (tabName === 'chat') showChatList();
    
  // If switching AWAY from chat, clear the poll
  if (tabName !== 'chat' && chatPollingInterval) {
    clearInterval(chatPollingInterval);
    chatPollingInterval = null;
    currentChatId = null;
  }
  }
}

function showHowItWorks(type) {
  const isClient = type === 'client';
  document.getElementById('clientSteps').style.display = isClient ? 'block' : 'none';
  document.getElementById('expertSteps').style.display = isClient ? 'none' : 'block';
  const tc = document.getElementById('hiwToggleClient');
  const te = document.getElementById('hiwToggleExpert');
  if (tc) tc.classList.toggle('active', isClient);
  if (te) te.classList.toggle('active', !isClient);
}
// ─── AUTHENTICATION ─── 
async function login(email, password, role) {  // ← accept role as parameter
  try {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, role: role })  // ← use passed role
    });
    
    const data = await res.json();
    
    if (data.success) {
      state.token = data.token;
      state.user = data.user;
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      enterDashboard();
    } else {
      showToast(data.message || 'Login failed', 'error');
    }
  } catch (error) {
    console.error('Login error:', error);
    showToast('Login failed. Please try again.', 'error');
  }
}

async function register(formData) {
  try {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    
    const data = await res.json();
    
   if (data.success && data.token) {
  state.token = data.token;
  state.user = data.user;
  localStorage.setItem('token', data.token);
  localStorage.setItem('user', JSON.stringify(state.user));
  
  showToast('Registration successful!', 'success');
  startQuestionnaire(); // ← NEW: Go to questionnaire instead
}  else {
      showToast(data.message || 'Registration failed', 'error');
    }
  } catch (error) {
    console.error('Registration error:', error);
    showToast('Registration failed. Please try again.', 'error');
  }
}

function enterDashboard() {
  const dashPage = state.user.role === 'client' ? 'clientDash' : 'expertDash';
  showPage(dashPage);
  loadNotifications();
  // Clear any existing interval before creating a new one
  if (notificationInterval) clearInterval(notificationInterval);
  notificationInterval = setInterval(loadNotifications, 30000);
  startInactivityWatcher();
   
  // Show service filter modal for new experts
  if (state.user.role === 'expert') {
    const hasFilter = state.user?.profile?.browseServiceFilter?.length > 0;
    const isNewUser = !localStorage.getItem('hasSeenServiceFilter_' + state.user._id);
    if (isNewUser || !hasFilter) {
      localStorage.setItem('hasSeenServiceFilter_' + state.user._id, 'true');
      setTimeout(() => showServiceFilterModal(), 800);
    } else {
      // Returning expert — restore their saved filter silently
      state.browseServiceFilter = state.user.profile.browseServiceFilter;
    }
  }
}

function logout() {
  stopInactivityWatcher();
  if (notificationInterval) clearInterval(notificationInterval);
  if (chatPollingInterval) clearInterval(chatPollingInterval);
  notificationInterval = null;
  chatPollingInterval = null;
  currentChatId = null;
   if (browseAbortController) browseAbortController.abort();
  if (expertsAbortController) expertsAbortController.abort();
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  state.token = null;
  state.user = null;
  showPage('landing');
  showToast('Logged out successfully', 'success');
}

// ─── DOCUMENT MANAGEMENT ─── 
async function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  // Validate file size (10MB)
  if (file.size > 10 * 1024 * 1024) {
    showToast('File too large. Max size is 10MB.', 'error');
    return;
  }
  
  // Show progress
  const progressDiv = document.getElementById('uploadProgress');
  const progressBar = document.getElementById('uploadProgressBar');
  const progressPercent = document.getElementById('uploadPercent');
  
  progressDiv.style.display = 'block';
  
  const formData = new FormData();
  formData.append('file', file);
  formData.append('category', 'other');
  
  try {
    const res = await fetch(`${API_URL}/documents/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${state.token}`
      },
      body: formData
    });
    
    // Simulate progress (real progress would need XMLHttpRequest)
    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      progressBar.style.width = progress + '%';
      progressPercent.textContent = progress + '%';
      
      if (progress >= 90) clearInterval(interval);
    }, 100);
    
    const data = await res.json();
    
    clearInterval(interval);
    progressBar.style.width = '100%';
    progressPercent.textContent = '100%';
    
    setTimeout(() => {
      progressDiv.style.display = 'none';
      progressBar.style.width = '0%';
    }, 1000);
    
    if (data.success) {
      showToast('Document uploaded successfully!', 'success');
      loadDocuments();
      event.target.value = ''; // Reset input
    } else {
      showToast(data.message || 'Upload failed', 'error');
    }
  } catch (error) {
    progressDiv.style.display = 'none';
    console.error('Upload error:', error);
    showToast('Upload failed. Please try again.', 'error');
  }
}

async function loadDocuments() {
  try {
    const res = await fetch(`${API_URL}/documents/my-documents`, {
      headers: {
        'Authorization': `Bearer ${state.token}`
      }
    });
    
    const data = await res.json();
    
    if (data.success) {
      state.documents = data.documents;
      renderDocuments();
    }
  } catch (error) {
    console.error('Load documents error:', error);
  }
}

function renderDocuments() {
  const container = document.getElementById('documentsList');
  const emptyState = document.getElementById('documentsEmpty');
  
  if (!state.documents || state.documents.length === 0) {
    container.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }
  
  emptyState.style.display = 'none';
  
  container.innerHTML = state.documents.map(doc => `
    <div class="document-item">
      <div class="document-icon ${getDocIconClass(doc.fileType)}">
        ${getDocIcon(doc.fileType)}
      </div>
      <div class="document-info">
        <div class="document-name">${doc.originalFileName}</div>
        <div class="document-meta">
          <span>${formatFileSize(doc.fileSize)}</span>
          <span>${formatDate(doc.createdAt)}</span>
          <span class="badge badge-${doc.category === 'tax' ? 'primary' : 'gray'}">${doc.category}</span>
        </div>
      </div>
      <div class="document-actions">
        <button class="doc-action-btn" onclick="downloadDocument('${doc._id}')" title="Download">
          📥
        </button>
        <button class="doc-action-btn" onclick="deleteDocument('${doc._id}')" title="Delete">
          🗑️
        </button>
      </div>
    </div>
  `).join('');
}

function getDocIconClass(type) {
  const classes = {
    'pdf': 'doc-icon-pdf',
    'excel': 'doc-icon-excel',
    'image': 'doc-icon-image',
    'word': 'doc-icon-word'
  };
  return classes[type] || 'doc-icon-pdf';
}

function getDocIcon(type) {
  const icons = {
    'pdf': '📄',
    'excel': '📊',
    'image': '🖼️',
    'word': '📝'
  };
  return icons[type] || '📄';
}

async function downloadDocument(docId) {
  try {
    showToast('Preparing download...', 'info');

    const res = await fetch(`${API_URL}/documents/${docId}`, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });

    const data = await res.json();
    console.log('Download response:', data); // ← temp debug

    if (!data.success) {
      showToast(data.message || 'Download failed', 'error');
      return;
    }

    const fileUrl = data.document?.fileUrl;
    const fileName = data.document?.fileName || data.document?.originalFileName || 'document';

    if (!fileUrl) {
      showToast('File not accessible — please ask client to re-approve access', 'error');
      return;
    }

    const a = document.createElement('a');
    a.href = fileUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    showToast('Download started!', 'success');
  } catch (err) {
    console.error('Download error:', err);
    showToast('Download failed', 'error');
  }
}

async function deleteDocument(docId) {
  if (!confirm('Delete this document?')) return;
  
  try {
    const res = await fetch(`${API_URL}/documents/${docId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${state.token}`
      }
    });
    
    const data = await res.json();
    
    if (data.success) {
      showToast('Document deleted', 'success');
      loadDocuments();
    } else {
      showToast(data.message || 'Delete failed', 'error');
    }
  } catch (error) {
    console.error('Delete error:', error);
    showToast('Delete failed', 'error');
  }
}

// ─── ACCESS REQUESTS ─── 
async function loadAccessRequests() {
  try {
    const res = await fetch(`${API_URL}/access-requests/pending`, {
      headers: {
        'Authorization': `Bearer ${state.token}`
      }
    });
    
    const data = await res.json();
    
    if (data.success) {
      state.accessRequests = data.requests;
      renderAccessRequests();
      updateAccessBadge(data.count);
    }
  } catch (error) {
    console.error('Load access requests error:', error);
  }
}

function renderAccessRequests() {
  const container = document.getElementById('accessRequestsList');
  const emptyState = document.getElementById('accessEmpty');
  
  if (!state.accessRequests || state.accessRequests.length === 0) {
    container.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }
  
  emptyState.style.display = 'none';
  
  container.innerHTML = state.accessRequests.map(req => `
    <div class="access-request-card">
      <div class="request-header">
        <div class="request-expert">
          <div class="avatar">
            ${req.expert.profilePhoto ? 
              `<img src="${req.expert.profilePhoto}" alt="${req.expert.name}">` : 
              req.expert.name.substring(0, 2).toUpperCase()
            }
          </div>
          <div class="request-expert-info">
            <h4>${req.expert.name}</h4>
            <p>${req.expert.specialization || 'Professional'}</p>
          </div>
        </div>
        <span class="badge badge-warning">Pending</span>
      </div>
      
      <div class="request-doc-name">📄 ${req.document.originalFileName}</div>
      <div class="request-message">${req.message}</div>
      
      <div class="request-actions">
        <button class="btn-approve" onclick="approveAccess('${req._id}')">
          ✓ Approve Access
        </button>
        <button class="btn-reject" onclick="rejectAccess('${req._id}')">
          ✕ Reject
        </button>
      </div>
    </div>
  `).join('');
}

function updateAccessBadge(count) {
  const badge = document.getElementById('accessBadge');
  if (badge) {
    if (count > 0) {
      badge.textContent = count;
      badge.style.display = 'block';
    } else {
      badge.style.display = 'none';
    }
  }
}

async function approveAccess(requestId) {
  try {
    const res = await fetch(`${API_URL}/access-requests/${requestId}/approve`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${state.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ responseMessage: 'Access granted' })
    });
    
    const data = await res.json();
    
    if (data.success) {
      showToast('Access granted!', 'success');
      loadAccessRequests();
    } else {
      showToast(data.message || 'Failed to approve', 'error');
    }
  } catch (error) {
    console.error('Approve access error:', error);
    showToast('Failed to approve', 'error');
  }
}

async function rejectAccess(requestId) {
  try {
    const res = await fetch(`${API_URL}/access-requests/${requestId}/reject`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${state.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ responseMessage: 'Access denied' })
    });
    
    const data = await res.json();
    
    if (data.success) {
      showToast('Access rejected', 'success');
      loadAccessRequests();
    } else {
      showToast(data.message || 'Failed to reject', 'error');
    }
  } catch (error) {
    console.error('Reject access error:', error);
    showToast('Failed to reject', 'error');
  }
}

// Continue in next file...
/* ═══════════════════════════════════════════════════════════
   WORKINDEX COMPLETE JAVASCRIPT v2.0 - PART 2
   Continue from Part 1
   ═══════════════════════════════════════════════════════════ */

// ─── RATING SYSTEM ─── 
function openRatingModal(expertId, expertName, approachId, requestId) {
  const modal = document.getElementById('ratingModal');
  document.getElementById('ratingExpertName').textContent = expertName;
  modal.dataset.expertId = expertId;
  modal.dataset.approachId = approachId;
  modal.dataset.requestId = requestId || '';  // ← ADD THIS
  modal.classList.add('open');
  
  // Reset form
  state.selectedRating = 0;
  document.querySelectorAll('.rating-stars .star').forEach(star => {
    star.classList.remove('filled');
  });
  document.getElementById('reviewText').value = '';
  document.getElementById('wouldRecommend').checked = true;
}


function closeRatingModal(event) {
  if (event && event.target !== event.currentTarget) return;
  document.getElementById('ratingModal').classList.remove('open');
}

function selectRating(rating) {
  state.selectedRating = rating;
  
  // Handle modal stars with data-rating attributes
  const modalStars = document.querySelectorAll('#ratingModal .rating-stars .star');
  if (modalStars.length > 0) {
    modalStars.forEach(star => {
      const starRating = parseInt(star.getAttribute('data-rating'));
      if (starRating <= rating) {
        star.classList.add('filled');
      } else {
        star.classList.remove('filled');
      }
    });
  }
  
  // Also handle any other stars using index (for display purposes)
  const otherStars = document.querySelectorAll('.rating-stars .star:not([data-rating])');
  otherStars.forEach((star, index) => {
    if (index < rating) {
      star.classList.add('filled');
    } else {
      star.classList.remove('filled');
    }
  });
}
async function submitRating() {
  const modal = document.getElementById('ratingModal');
  const expertId = modal.dataset.expertId;
  const approachId = modal.dataset.approachId;
  const requestId = modal.dataset.requestId;  // ✅ DECLARE IT FIRST
  const rating = state.selectedRating;
  const review = document.getElementById('reviewText').value.trim();
  const wouldRecommend = document.getElementById('wouldRecommend').checked;
  
  // ✅ ADD DEBUG
  console.log('Submitting rating with:', { expertId, requestId, approachId, rating });
  
  if (rating === 0) {
    showToast('Please select a rating', 'warning');
    return;
  }
  
  if (!review || review.length < 10) {
    showToast('Please write at least 10 characters', 'warning');
    return;
  }
  
  try {
    const res = await fetch(`${API_URL}/ratings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${state.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        expertId,
        requestId,  // ✅ USE THE VARIABLE
        approachId,
        rating,
        review,
        wouldRecommend
      })
    });
    
    const data = await res.json();
    
    if (data.success) {
      showToast('Review submitted successfully!', 'success');
      closeRatingModal();
      loadClientData(); // Refresh data
    } else {
      showToast(data.message || 'Failed to submit review', 'error');
    }
  } catch (error) {
    console.error('Submit rating error:', error);
    showToast('Failed to submit review', 'error');
  }
}

async function loadMyRatings() {
  try {
    const res = await fetch(`${API_URL}/ratings/received`, {
      headers: {
        'Authorization': `Bearer ${state.token}`
      }
    });
    
    const data = await res.json();
    
    if (data.success) {
      state.ratings = data.ratings;
      renderMyRatings(data);
    }
  } catch (error) {
    console.error('Load ratings error:', error);
  }
}

function renderMyRatings(data) {
  const container = document.getElementById('reviewsList');
  const emptyState = document.getElementById('reviewsEmpty');
  
  // Update summary - FIXED to calculate from actual ratings
  if (data.total > 0 && data.ratings && data.ratings.length > 0) {
    // Calculate average from received ratings
    const avgRating = data.ratings.reduce((sum, r) => sum + r.rating, 0) / data.ratings.length;
    document.getElementById('avgRating').textContent = avgRating.toFixed(1);
    document.getElementById('reviewCount').textContent = `${data.total} review${data.total > 1 ? 's' : ''}`;
    
    // Fill the display stars at the top
    const topStars = document.querySelectorAll('#ratingsTab > .settings-section .rating-stars .star');
    const roundedRating = Math.round(avgRating);
    topStars.forEach((star, index) => {
      if (index < roundedRating) {
        star.classList.add('filled');
      } else {
        star.classList.remove('filled');
      }
    });
    
    renderRatingBars(data.ratings);
  }
  
  if (!data.ratings || data.ratings.length === 0) {
    container.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }
  
  emptyState.style.display = 'none';
  
  container.innerHTML = data.ratings.map(rating => `
    <div class="review-card">
      <div class="review-header">
        <div class="avatar">
          ${rating.client.profilePhoto ? 
            `<img src="${rating.client.profilePhoto}" alt="${rating.client.name}">` : 
            rating.client.name.substring(0, 2).toUpperCase()
          }
        </div>
        <div class="review-author">
          <div class="review-author-name">${rating.client.name}</div>
          <div class="review-date">${formatDate(rating.createdAt)}</div>
        </div>
        <div class="rating-stars">
          ${renderStars(rating.rating)}
        </div>
      </div>
      
      <div class="review-text">${rating.review}</div>
      
      ${rating.wouldRecommend ? 
        '<div class="badge badge-success">✓ Would recommend</div>' : ''
      }
      
      ${rating.expertResponse ? `
        <div class="review-response">
          <div class="response-label">Expert Response</div>
          <div class="response-text">${rating.expertResponse.message}</div>
        </div>
      ` : `
        <button class="btn-outline" style="margin-top: 12px; padding: 8px 16px; font-size: 14px;" 
          onclick="respondToReview('${rating._id}')">
          Reply to Review
        </button>
      `}
      
      <div class="review-helpful ${rating.helpful ? 'active' : ''}" 
        onclick="markHelpful('${rating._id}')">
        👍 Helpful (${rating.helpfulCount || 0})
      </div>
    </div>
  `).join('');
}

function renderStars(rating) {
  return Array(5).fill(0).map((_, i) => 
    `<span class="star ${i < rating ? 'filled' : ''}">★</span>`
  ).join('');
}

function renderRatingBars(ratings) {
  const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  
  ratings.forEach(r => {
    distribution[r.rating]++;
  });
  
  const total = ratings.length;
  const barsHTML = [5, 4, 3, 2, 1].map(star => {
    const count = distribution[star];
    const percentage = total > 0 ? (count / total * 100) : 0;
    
    return `
      <div class="rating-bar-row">
        <div class="rating-bar-label">${star} ★</div>
        <div class="rating-bar">
          <div class="rating-bar-fill" style="width: ${percentage}%"></div>
        </div>
        <div class="rating-bar-count">${count}</div>
      </div>
    `;
  }).join('');
  
  document.getElementById('ratingBars').innerHTML = barsHTML;
}

async function respondToReview(ratingId) {
  const response = prompt('Your response to this review:');
  if (!response || !response.trim()) return;
  
  try {
    const res = await fetch(`${API_URL}/ratings/${ratingId}/respond`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${state.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message: response.trim() })
    });
    
    const data = await res.json();
    
    if (data.success) {
      showToast('Response posted!', 'success');
      loadExpertData(); // ✅ FIXED: was loadMyRatings()
    } else {
      showToast(data.message || 'Failed to post response', 'error');
    }
  } catch (error) {
    console.error('Respond error:', error);
    showToast('Failed to post response', 'error');
  }
}

async function markHelpful(ratingId) {
  try {
    const res = await fetch(`${API_URL}/ratings/${ratingId}/helpful`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${state.token}`
      }
    });
    
    const data = await res.json();
    
    if (data.success) {
      loadExpertData(); // ✅ FIXED: was loadMyRatings()
    }
  } catch (error) {
    console.error('Mark helpful error:', error);
  }
}
// ─── NOTIFICATIONS ───
async function loadNotifications() {
  try {
    const res = await fetch(`${API_URL}/notifications`, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    const data = await res.json();
    if (!data.success) return;
    
    const unread = (data.notifications || []).filter(n => !n.isRead).length;
    const badge = document.getElementById('notifBadge');
    if (badge) {
      if (unread > 0) {
        badge.textContent = unread;
        badge.style.display = 'flex';
      } else {
        badge.style.display = 'none';
      }
    }
    return data.notifications || [];
  } catch (err) {
    console.error('Load notifications error:', err);
    return [];
  }
}

async function openNotifications() {
  // Guard — prevent stacking including during async load
  if (document.getElementById('notificationsModal')) return;
  
  // Insert placeholder immediately so guard catches rapid clicks
  const placeholder = document.createElement('div');
  placeholder.id = 'notificationsModal';
  document.body.appendChild(placeholder);

  const notifications = await loadNotifications();
  
  // Remove placeholder, build real modal
  placeholder.remove();
  
  // Re-check in case user navigated away during fetch
  if (document.getElementById('notificationsModal')) return;
  
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:flex-start;justify-content:flex-end;z-index:1001;padding:60px 16px 0;';
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

  const typeIcons = {
    announcement: '📢',
    admin_dm: '💬',
    refund: '💰',
    approach: '👋',
    chat: '💬',
    system: 'ℹ️'
  };

  const listHTML = notifications.length ? notifications.map(n => `
    <div style="padding:14px;border-bottom:1px solid var(--border);background:${n.isRead ? 'transparent' : 'rgba(252,128,25,0.05)'};">
      <div style="display:flex;gap:10px;align-items:flex-start;">
        <span style="font-size:20px;">${typeIcons[n.type] || 'ℹ️'}</span>
        <div style="flex:1;">
          <div style="font-size:14px;font-weight:${n.isRead ? '400' : '700'};color:var(--text);margin-bottom:2px;">${n.title}</div>
          <div style="font-size:13px;color:var(--text-muted);line-height:1.4;">${n.message}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">${formatDate(n.createdAt)}</div>
        </div>
        ${!n.isRead ? '<span style="width:8px;height:8px;background:var(--primary);border-radius:50%;flex-shrink:0;margin-top:4px;"></span>' : ''}
      </div>
    </div>
  `).join('') : '<div style="padding:40px;text-align:center;color:var(--text-muted);">No notifications yet</div>';

  modal.innerHTML = `
    <div style="background:var(--bg);border-radius:16px;width:100%;max-width:380px;max-height:70vh;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.15);">
      <div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;background:var(--bg);">
        <h3 style="font-size:17px;font-weight:700;">Notifications</h3>
        <div style="display:flex;gap:12px;align-items:center;">
          <span onclick="markAllRead()" style="font-size:12px;color:var(--primary);cursor:pointer;font-weight:600;">Mark all read</span>
          <button onclick="this.closest('[style*=fixed]').remove()" style="border:none;background:none;font-size:22px;cursor:pointer;color:var(--text-muted);">×</button>
        </div>
      </div>
      ${listHTML}
    </div>
  `;

  document.body.appendChild(modal);
  markAllRead(); // auto mark as read when opened
}

async function markAllRead() {
  try {
    await fetch(`${API_URL}/notifications/mark-read`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    const badge = document.getElementById('notifBadge');
    if (badge) badge.style.display = 'none';
  } catch (err) {
    console.error('Mark read error:', err);
  }
}

// ─── FIND PROFESSIONALS ─── 
async function loadExperts(filters = {}) {
  const loading = document.getElementById('expertsLoading');
  const grid = document.getElementById('expertGrid');
  const empty = document.getElementById('expertsEmpty');
  
  loading.style.display = 'block';
  grid.innerHTML = '';
  empty.style.display = 'none';

  // Cancel any previous experts fetch
  if (expertsAbortController) expertsAbortController.abort();
  expertsAbortController = new AbortController();

  try {
    const params = new URLSearchParams(filters);
    const res = await fetch(`${API_URL}/users/experts?${params}`, {
      signal: expertsAbortController.signal
    });
    const data = await res.json();
    
    loading.style.display = 'none';
    
    if (data.success && data.experts.length > 0) {
      state.experts = data.experts;
      renderExperts();
    } else {
      empty.style.display = 'block';
    }
  } catch (error) {
    if (error.name === 'AbortError') return; // navigation cancelled this — ignore
    console.error('Load experts error:', error);
    loading.style.display = 'none';
    empty.style.display = 'block';
  }
}
function renderExperts() {
  const grid = document.getElementById('expertGrid');
  if (!grid) return;

  const allExperts = state.experts || [];
  const items = paginate(allExperts, 'findExperts');

  grid.innerHTML = items.map(expert => `
    <div class="expert-card" onclick="viewExpertProfile('${expert._id}')">
      <div class="expert-card-header">
        <div class="avatar avatar-lg">
          ${expert.profilePhoto
            ? `<img src="${expert.profilePhoto}" alt="${expert.name}">`
            : expert.name.substring(0, 2).toUpperCase()}
        </div>
        <div class="expert-card-info">
          <div class="expert-card-name">${expert.name}</div>
          <div class="expert-card-specialty">${expert.specialization || 'Professional'}</div>
        </div>
      </div>
      <div class="expert-card-rating">
        <div class="rating-stars">${renderStars(Math.floor(expert.rating || 0))}</div>
        <span style="font-size:14px;color:var(--text-muted);">
          ${expert.rating || '0.0'} (${expert.reviewCount || 0} reviews)
        </span>
      </div>
      ${expert.bio ? `<div class="expert-card-bio">${expert.bio}</div>` : ''}
      ${expert.servicesOffered?.length ? `
        <div class="expert-card-tags">
          ${expert.servicesOffered.slice(0, 3).map(s => `<span class="badge badge-primary">${s}</span>`).join('')}
        </div>` : ''}
      <div class="expert-card-footer">
        ${expert.location ? `<div class="expert-location">📍 ${expert.location.city || 'India'}</div>` : ''}
        <button class="btn-primary" style="padding:8px 16px;font-size:14px;">View Profile</button>
      </div>
    </div>
  `).join('') + paginationControlsHTML(allExperts, 'findExperts');
}
function filterExperts(service) {
  // Update active filter chip
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.classList.remove('active');
  });
  document.querySelector(`[data-service="${service}"]`)?.classList.add('active');
  
  // Load experts with filter
  const filters = service !== 'all' ? { service } : {};
  loadExperts(filters);
}

function sortExperts(sortBy) {
  loadExperts({ sortBy });
}

// ─── VIEW EXPERT PROFILE ───
async function viewExpertProfile(expertId, loggedIn = false) {
  // Guard — prevent stacking
  if (document.getElementById('expertProfileModal')) return;

  // Insert placeholder immediately so rapid clicks are blocked
  const placeholder = document.createElement('div');
  placeholder.id = 'expertProfileModal';
  document.body.appendChild(placeholder);

  try {
    const res = await fetch(`${API_URL}/users/expert/${expertId}`, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });

    const data = await res.json();

    // Remove placeholder before building real modal
    placeholder.remove();

    // Re-check in case of rapid clicks during fetch
    if (document.getElementById('expertProfileModal')) return;

    if (!data.success) { showToast('Could not load profile', 'error'); return; }

    const expert = data.expert || data.user;
    console.log('Expert data:', JSON.stringify(expert));
    const profile = expert.profile || {};

    const specialization = profile.specialization || expert.specialization || 'Professional';
    const bio            = profile.bio || expert.bio || '';
    const experience     = profile.experience || expert.yearsOfExperience || '—';
    const services       = profile.servicesOffered || expert.servicesOffered || [];
    const companyName    = profile.companyName || expert.companyName || '';
    const companySize    = profile.companySize || '';
    const hasWebsite     = profile.hasWebsite || false;
    const websiteUrl     = profile.websiteUrl || expert.websiteUrl || '';
    const locationType   = profile.serviceLocationType || '';
    const certifications = profile.certifications || expert.certifications || [];
    const city           = profile.city || expert.location?.city || '';

    const education      = profile.education || '';
    const portfolio      = profile.portfolio || '';
    const whyChooseMe    = expert.whyChooseMe || '';
    const availability   = expert.availability || 'available';
    const lastOnline     = expert.lastOnline;

    const availabilityMap = {
      available: { icon: '🟢', label: 'Available',      color: '#10b981' },
      busy:      { icon: '🔴', label: 'Busy This Week', color: '#ef4444' },
      away:      { icon: '🟡', label: 'Away',           color: '#f59e0b' }
    };
    const avail = availabilityMap[availability] || availabilityMap.available;

    const lastOnlineText = (() => {
      if (!lastOnline) return '🕐 Recently active';
      const diff = Date.now() - new Date(lastOnline).getTime();
      const mins = Math.floor(diff / 60000);
      const hrs  = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);
      if (mins < 5)  return '🟢 Online now';
      if (mins < 60) return `🕐 ${mins}m ago`;
      if (hrs < 24)  return `🕐 ${hrs}h ago`;
      return `📅 ${days}d ago`;
    })();

    const locationLabels = {
      online: '💻 Online / Remote only',
      local:  '📍 Local (in-person)',
      both:   '🌐 Both online & in-person'
    };
    const serviceLabels = {
      itr: 'ITR Filing', gst: 'GST Services',
      accounting: 'Accounting', audit: 'Audit',
      photography: 'Photography', development: 'Development'
    };

    const modal = document.createElement('div');
    modal.id = 'expertProfileModal';
    modal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1001; padding: 20px;';
    modal.onclick = (e) => { if (e.target === modal) document.getElementById('expertProfileModal')?.remove(); };

    modal.innerHTML = `
      <div style="background: var(--bg); border-radius: 16px; max-width: 480px; width: 100%; max-height: 85vh; overflow-y: auto; padding: 24px;">

        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h2 style="font-size: 20px; font-weight: 700; color: var(--text);">Expert Profile</h2>
          <button onclick="document.getElementById('expertProfileModal')?.remove()" style="border: none; background: none; font-size: 24px; cursor: pointer; color: var(--text-muted);">×</button>
        </div>

        <div style="text-align: center; margin-bottom: 24px;">
          <div style="width: 80px; height: 80px; border-radius: 50%; background: var(--primary); color: #fff; font-size: 32px; font-weight: 700; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; overflow: hidden;">
            ${expert.profilePhoto ? `<img src="${expert.profilePhoto}" style="width:100%;height:100%;object-fit:cover;">` : expert.name.charAt(0).toUpperCase()}
          </div>
          <h3 style="font-size: 22px; font-weight: 700; color: var(--text); margin-bottom: 4px;">${expert.name}</h3>
          <p style="font-size: 15px; color: var(--primary); font-weight: 600;">${specialization}</p>
          ${city ? `<p style="font-size: 13px; color: var(--text-muted);">📍 ${city}</p>` : ''}
          ${expert.rating ? `
            <div style="display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 8px;">
              <span style="color: #f39c12; font-size: 18px;">★</span>
              <span style="font-size: 16px; font-weight: 700;">${expert.rating.toFixed(1)}</span>
              <span style="font-size: 13px; color: var(--text-muted);">(${expert.reviewCount || 0} reviews)</span>
            </div>
          ` : ''}
          ${loggedIn ? `
            <div style="display:inline-flex;align-items:center;gap:6px;margin-top:10px;padding:5px 14px;border-radius:20px;background:rgba(0,0,0,0.05);border:1.5px solid ${avail.color};font-size:13px;font-weight:700;color:${avail.color};">
              ${avail.icon} ${avail.label}
            </div>
          ` : ''}
        </div>

        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px;">
          <div style="text-align: center; padding: 12px; background: var(--bg-gray); border-radius: 10px;">
            <div style="font-size: 20px; font-weight: 700; color: var(--primary);">${expert.reviewCount || 0}</div>
            <div style="font-size: 12px; color: var(--text-muted);">Reviews</div>
          </div>
          <div style="text-align: center; padding: 12px; background: var(--bg-gray); border-radius: 10px;">
            <div style="font-size: 18px; font-weight: 700; color: var(--primary);">${experience}</div>
            <div style="font-size: 12px; color: var(--text-muted);">Experience</div>
          </div>
          <div style="text-align: center; padding: 12px; background: var(--bg-gray); border-radius: 10px;">
            <div style="font-size: 20px; font-weight: 700; color: var(--primary);">${expert.rating ? expert.rating.toFixed(1) : '—'}</div>
            <div style="font-size: 12px; color: var(--text-muted);">Rating</div>
          </div>
        </div>

        ${loggedIn ? `
          <div style="display:flex;align-items:center;justify-content:center;gap:6px;margin-bottom:20px;font-size:13px;color:var(--text-muted);">
            ${lastOnlineText}
          </div>
        ` : ''}

        ${loggedIn && whyChooseMe ? `
          <div style="margin-bottom:20px;padding:14px 16px;background:rgba(252,128,25,0.06);border-left:3px solid var(--primary);border-radius:0 10px 10px 0;">
            <h4 style="font-size:13px;font-weight:700;color:var(--text-muted);margin-bottom:6px;">💡 WHY CHOOSE ME</h4>
            <p style="font-size:14px;color:var(--text-light);line-height:1.6;margin:0;">${whyChooseMe}</p>
          </div>
        ` : ''}

        ${services.length > 0 ? `
          <div style="margin-bottom: 20px;">
            <h4 style="font-size: 14px; font-weight: 700; color: var(--text-muted); margin-bottom: 10px;">SERVICES OFFERED</h4>
            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
              ${services.map(s => `<span style="padding: 6px 12px; background: rgba(252,128,25,0.1); color: var(--primary); border-radius: 20px; font-size: 13px; font-weight: 600;">${serviceLabels[s] || s}</span>`).join('')}
            </div>
          </div>
        ` : ''}

        ${bio ? `
          <div style="margin-bottom: 20px;">
            <h4 style="font-size: 14px; font-weight: 700; color: var(--text-muted); margin-bottom: 10px;">ABOUT</h4>
            <p style="font-size: 14px; color: var(--text-light); line-height: 1.6;">${bio}</p>
          </div>
        ` : ''}

        ${loggedIn && education ? `
          <div style="margin-bottom: 20px;">
            <h4 style="font-size: 14px; font-weight: 700; color: var(--text-muted); margin-bottom: 10px;">🎓 EDUCATION</h4>
            <p style="font-size: 14px; color: var(--text);">${education}</p>
          </div>
        ` : ''}

        ${loggedIn && portfolio ? `
          <div style="margin-bottom: 20px;">
            <h4 style="font-size: 14px; font-weight: 700; color: var(--text-muted); margin-bottom: 10px;">🗂️ PORTFOLIO & PROOF OF WORK</h4>
            <p style="font-size: 14px; color: var(--text-light); line-height: 1.6; white-space: pre-line;">${portfolio}</p>
          </div>
        ` : ''}

        ${companyName ? `
          <div style="margin-bottom: 20px;">
            <h4 style="font-size: 14px; font-weight: 700; color: var(--text-muted); margin-bottom: 10px;">COMPANY</h4>
            <div style="font-size: 14px; color: var(--text);">🏢 ${companyName}${companySize ? ` · ${companySize} employees` : ''}</div>
            ${hasWebsite && websiteUrl ? `<a href="${websiteUrl}" target="_blank" style="font-size: 13px; color: var(--primary);">🌐 ${websiteUrl}</a>` : ''}
          </div>
        ` : ''}

        ${certifications.length > 0 ? `
          <div style="margin-bottom: 20px;">
            <h4 style="font-size: 14px; font-weight: 700; color: var(--text-muted); margin-bottom: 10px;">CERTIFICATIONS</h4>
            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
              ${certifications.map(c => `<span style="padding: 6px 12px; background: var(--bg-gray); border-radius: 20px; font-size: 13px;">🏅 ${c}</span>`).join('')}
            </div>
          </div>
        ` : ''}

        ${locationType ? `
          <div style="margin-bottom: 20px;">
            <h4 style="font-size: 14px; font-weight: 700; color: var(--text-muted); margin-bottom: 10px;">SERVICE LOCATION</h4>
            <div style="font-size: 14px; color: var(--text);">${locationLabels[locationType] || locationType}</div>
          </div>
        ` : ''}

        ${data.ratings && data.ratings.length > 0 ? `
          <div style="margin-bottom: 20px;">
            <h4 style="font-size: 14px; font-weight: 700; color: var(--text-muted); margin-bottom: 12px;">CUSTOMER REVIEWS</h4>
            ${data.ratings.map(r => `
              <div style="padding: 14px; background: var(--bg-gray); border-radius: 12px; margin-bottom: 10px;">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                  <div style="width: 36px; height: 36px; border-radius: 50%; background: var(--primary); color: #fff; font-size: 14px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                    ${(r.client?.name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div style="flex: 1;">
                    <div style="font-size: 14px; font-weight: 600; color: var(--text);">${r.client?.name || 'Client'}</div>
                    <div style="font-size: 12px; color: #f39c12;">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</div>
                  </div>
                  <div style="font-size: 11px; color: var(--text-muted);">${new Date(r.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</div>
                </div>
                <p style="font-size: 13px; color: var(--text-light); line-height: 1.5; margin: 0;">${r.review}</p>
                ${r.wouldRecommend ? '<div style="font-size: 11px; color: #4CAF50; margin-top: 6px;">✓ Would recommend</div>' : ''}
              </div>
            `).join('')}
          </div>
        ` : ''}

        <button onclick="document.getElementById('expertProfileModal')?.remove()" style="width: 100%; padding: 14px; border: 1.5px solid var(--border); border-radius: 10px; background: transparent; color: var(--text); font-size: 15px; font-weight: 600; cursor: pointer;">Close</button>
      </div>
    `;

    document.body.appendChild(modal);

  } catch (error) {
    // Clean up placeholder on error so future clicks work
    document.getElementById('expertProfileModal')?.remove();
    console.error('View profile error:', error);
    showToast('Failed to load profile', 'error');
  }
}
// ─── PROFILE PHOTO UPLOAD ─── 
async function uploadProfilePhoto(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  // Validate file type
  if (!file.type.startsWith('image/')) {
    showToast('Please select an image file', 'error');
    return;
  }
  
  // Validate file size (5MB)
  if (file.size > 5 * 1024 * 1024) {
    showToast('Image too large. Max size is 5MB.', 'error');
    return;
  }
  
  const formData = new FormData();
  formData.append('profilePhoto', file);
  
  try {
    const res = await fetch(`${API_URL}/users/profile-photo`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${state.token}`
      },
      body: formData
    });
    
    const data = await res.json();
    
    if (data.success) {
      showToast('Profile photo updated!', 'success');
      state.user.profilePhoto = data.profilePhoto;
      localStorage.setItem('user', JSON.stringify(state.user));
      
      // Update all avatar instances
      if (state.user.role === 'client') {
        updateClientProfile();
      } else {
        updateExpertProfile();
      }
    } else {
      showToast(data.message || 'Upload failed', 'error');
    }
  } catch (error) {
    console.error('Upload photo error:', error);
    showToast('Upload failed', 'error');
  }
}

function updateProfilePhoto(photoUrl) {
  // Update all avatar instances
  document.querySelectorAll('.avatar').forEach(avatar => {
    if (avatar.dataset.userId === state.user._id) {
      avatar.innerHTML = `<img src="${photoUrl}" alt="${state.user.name}">`;
    }
  });
}

// ─── CREDIT PURCHASE ─── 
function openCreditModal() {
  document.getElementById('creditModal').classList.add('open');
}

function closeCreditModal(event) {
  if (event && event.target !== event.currentTarget) return;
  document.getElementById('creditModal').classList.remove('open');
}

function proceedToPayment() {
  const selected = document.querySelector('input[name="creditPack"]:checked');
  if (!selected) {
    showToast('Please select a package', 'warning');
    return;
  }
  
  const credits = selected.value;
  const price = selected.dataset.price;
  
  // Open payment modal
  document.getElementById('paymentAmount').textContent = `₹${price}`;
  document.getElementById('paymentCredits').textContent = `${credits} Credits`;
  
  closeCreditModal();
  document.getElementById('paymentModal').classList.add('open');
}

function closePaymentModal(event) {
  if (event && event.target !== event.currentTarget) return;
  document.getElementById('paymentModal').classList.remove('open');
}

async function confirmPayment() {
  const selected = document.querySelector('input[name="creditPack"]:checked');
  if (!selected) return;
  
  const credits = parseInt(selected.value);
  
  try {
    // In production, this would verify actual payment
    const res = await fetch(`${API_URL}/credits/add`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${state.token}`,
        'Content-Type': 'application/json'
      },
            body: JSON.stringify({ 
        credits,
        amountPaid: parseInt(selected.dataset.price)  // ← add this
      })
            });
    
    const data = await res.json();
    
    if (data.success) {
      state.user.credits = data.newBalance;
      localStorage.setItem('user', JSON.stringify(state.user));
      
      showToast(`${credits} credits added successfully!`, 'success');
      closePaymentModal();
      updateCreditDisplay(data.newBalance);
    } else {
      showToast(data.message || 'Payment failed', 'error');
    }
  } catch (error) {
    console.error('Payment error:', error);
    showToast('Payment failed', 'error');
  }
}

function updateCreditDisplay(credits) {
  document.querySelectorAll('.credit-display').forEach(el => {
    el.textContent = credits;
  });
}

// ─── UTILITY FUNCTIONS ─── 
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString('en-IN', { 
    day: 'numeric', 
    month: 'short', 
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined 
  });
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// ─── LOAD CLIENT DATA ─── 
async function loadClientData() {
  // Load client requests
  try {
    const res = await fetch(`${API_URL}/requests`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${state.token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await res.json();
    
    if (data.success) {
      state.requests = data.requests || [];
      renderClientRequests();
      
      // Update profile info
      updateClientProfile();
    }
  } catch (error) {
    console.error('Load client data error:', error);
  }
  
  switchTab('requests');
}

// ─── RENDER CLIENT REQUESTS ───
function renderClientRequests() {
  const container = document.getElementById('requestsList');
  if (!container) return;

  const allRequests = state.requests || [];

  if (!allRequests.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <h3 class="empty-title">No requests yet</h3>
        <p class="empty-text">Click "+ New Request" above to post your first request</p>
      </div>`;
    return;
  }

  const items = paginate(allRequests, 'clientRequests');
  const statusColors = { pending: 'badge-warning', active: 'badge-primary', completed: 'badge-success', cancelled: 'badge-danger' };
  const statusLabels = { pending: 'Pending', active: 'Active', completed: 'Completed', cancelled: 'Cancelled' };
  const clientName = state.user?.name || 'You';

  container.innerHTML = items.map(req => `
    <div class="request-card" style="background:var(--bg);border:1px solid var(--border);border-radius:12px;padding:20px;margin-bottom:16px;cursor:pointer;"
      onclick="showRequestDetail('${req._id}')">
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:12px;">
        <div style="flex:1;">
          <h3 style="font-size:18px;font-weight:700;color:var(--text);margin-bottom:4px;">${req.title}</h3>
          <p style="font-size:14px;color:var(--text-muted);">${req.service.toUpperCase()}</p>
          <p style="font-size:13px;color:var(--text-muted);margin-top:4px;">Posted by: <strong>${clientName}</strong></p>
        </div>
        <span class="badge ${statusColors[req.status] || 'badge-warning'}">${statusLabels[req.status] || 'Pending'}</span>
      </div>
      <p style="font-size:14px;color:var(--text-light);margin-bottom:16px;line-height:1.5;">${req.description || 'No description'}</p>
      <div style="display:flex;gap:20px;font-size:13px;color:var(--text-muted);">
        <span>📍 ${req.location || 'Not specified'}</span>
        <span>💰 ₹${req.budget ? req.budget.toLocaleString('en-IN') : 'Not set'}</span>
        <span>👁️ ${req.viewCount || 0} views</span>
      </div>
      ${(req.approachCount > 0) ? `
        <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);">
          <span style="font-size:13px;font-weight:600;color:var(--primary);">
            ${req.approachCount} professional${req.approachCount > 1 ? 's' : ''} approached
          </span>
        </div>` : ''}
    </div>
  `).join('') + paginationControlsHTML(allRequests, 'clientRequests');
}
// ─── UPDATE CLIENT PROFILE ───
function updateClientProfile() {
  const user = state.user;
  if (!user) return;
  
  // Update avatar
  const avatar = document.getElementById('clientAvatar');
  if (avatar) {
    if (user.profilePhoto) {
      avatar.innerHTML = `<img src="${user.profilePhoto}" alt="${user.name}">`;
    } else {
      avatar.textContent = user.name.substring(0, 1).toUpperCase();
    }
  }
  
  // Update profile tab
  const profileAvatar = document.getElementById('profileAvatar');
  if (profileAvatar) {
    if (user.profilePhoto) {
      profileAvatar.innerHTML = `<img src="${user.profilePhoto}" alt="${user.name}">`;
    } else {
      profileAvatar.textContent = user.name.substring(0, 1).toUpperCase();
    }
  }
  
  const profileName = document.getElementById('profileName');
  if (profileName) profileName.textContent = user.name;
  
  const profileEmail = document.getElementById('profileEmail');
  if (profileEmail) profileEmail.textContent = user.email;
  
  const profilePhone = document.getElementById('profilePhone');
  if (profilePhone) profilePhone.textContent = user.phone || 'Not provided';
}

// ─── LOAD EXPERT DATA ─── 
async function loadExpertData() {
  // FIRST: Fetch fresh user data with profile
  try {
    const userRes = await fetch(`${API_URL}/users/me`, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    const userData = await userRes.json();
    if (userData.success) {
      state.user = userData.user;
      localStorage.setItem('user', JSON.stringify(userData.user));
      renderExpertProfile();  // ✅ MOVE HERE — right after fresh data is loaded
    }
  } catch (error) {
    console.error('Load user data error:', error);
  }
  
  // Cancel any previous browse fetch
  if (browseAbortController) browseAbortController.abort();
  browseAbortController = new AbortController();

  // Load available requests for experts
  try {
    const res = await fetch(`${API_URL}/requests/available`, {
      signal: browseAbortController.signal,
      headers: {
        'Authorization': `Bearer ${state.token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await res.json();
    
    if (data.success) {
      state.availableRequests = data.requests || [];
      renderAvailableRequests();
      updateExpertProfile();
      loadExpertCredits();
      loadMyApproaches();
      // ✅ REMOVE renderExpertProfile() from here
    }
  } catch (error) {
    if (error.name === 'AbortError') return; // navigation cancelled this — ignore
    console.error('Load expert data error:', error);
  }
  
  switchTab('browse');
}
// ─── BROWSE FILTER CHIPS RENDERER ───
function renderBrowseFilterChips() {
  const services = [
    { value: 'all',         label: 'All' },
    { value: 'itr',         label: '📄 ITR Filing' },
    { value: 'gst',         label: '🧾 GST' },
    { value: 'accounting',  label: '📊 Accounting' },
    { value: 'audit',       label: '🔍 Audit' },
    { value: 'photography', label: '📷 Photography' },
    { value: 'development', label: '💻 Development' },
  ];

  const activeFilter = state.browseServiceFilter || [];

  return services.map(s => {
    const isActive = s.value === 'all'
      ? activeFilter.length === 0
      : activeFilter.includes(s.value);

    return `<button
      class="browse-filter-chip"
      data-service="${s.value}"
      onclick="setBrowseFilter('${s.value}')"
      style="padding:7px 16px;
             border:1.5px solid ${isActive ? 'var(--primary)' : 'var(--border)'};
             border-radius:20px;
             background:${isActive ? 'var(--primary)' : 'transparent'};
             color:${isActive ? '#fff' : 'var(--text)'};
             font-size:13px;font-weight:600;
             cursor:pointer;white-space:nowrap;transition:all 0.2s;">
      ${s.label}
    </button>`;
  }).join('');
}

// ─── RENDER AVAILABLE REQUESTS FOR EXPERTS ───
function renderAvailableRequests() {
  // Update filter chips
  const filterBar = document.getElementById('browseFilterBar');
  if (filterBar) filterBar.innerHTML = renderBrowseFilterChips();

  const container = document.getElementById('browseRequestsContainer');
  if (!container) return;
   
  const filter = state.browseServiceFilter || [];
  const allRequests = (state.availableRequests || []).filter(req =>
    !filter.length || filter.includes(req.service)
  );
  if (!allRequests.length) {
    const isFiltered = (state.browseServiceFilter || []).length > 0;
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <h3 class="empty-title">${isFiltered ? 'No requests for selected category' : 'No requests available'}</h3>
        <p class="empty-text">${isFiltered ? 'Try selecting a different category above' : 'New requests will appear here'}</p>
      </div>`;
    return;
  }

  const items = paginate(allRequests, 'expertBrowse');

  container.innerHTML = '<h2 style="margin-bottom:20px;">Available Requests</h2>' +
    items.map(req => {
      const cur  = req.currentApproaches || 0;
      const max  = req.maxApproaches || 5;
      const pct  = (cur / max) * 100;
      const left = max - cur;
      const col  = cur >= 4 ? '#f39c12' : cur >= 3 ? '#3498db' : 'var(--primary)';

      return `
        <div class="request-card" style="background:var(--bg);border:1px solid var(--border);border-radius:12px;padding:20px;margin-bottom:16px;">
          <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:12px;">
            <div style="flex:1;">
              <h3 style="font-size:18px;font-weight:700;color:var(--text);margin-bottom:4px;">${req.title}</h3>
              <p style="font-size:14px;color:var(--text-muted);">${req.service.toUpperCase()}</p>
              <p style="font-size:13px;color:var(--text-muted);margin-top:4px;">👤 <strong>${req.client?.name || 'Client'}</strong></p>
            </div>
            <span class="badge badge-primary">${req.credits || 20} credits</span>
          </div>
          <p style="font-size:14px;color:var(--text-light);margin-bottom:16px;line-height:1.5;">${req.description}</p>
          <div style="display:flex;gap:20px;font-size:13px;color:var(--text-muted);margin-bottom:12px;">
            <span>📍 ${req.location || 'Online'}</span>
            <span>💰 ₹${req.budget ? req.budget.toLocaleString('en-IN') : 'Budget negotiable'}</span>
            <span>⏱️ ${req.timeline || 'Flexible'}</span>
          </div>
          <div style="margin-bottom:16px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
              <span style="font-size:13px;font-weight:600;color:var(--text-muted);">👥 Approaches</span>
              <span style="font-size:14px;font-weight:700;color:${col};">${cur}/${max}</span>
            </div>
            <div style="height:8px;background:var(--bg-gray);border-radius:4px;overflow:hidden;margin-bottom:4px;">
              <div style="height:100%;width:${pct}%;background:${col};transition:width 0.3s;"></div>
            </div>
            ${cur >= 4 ? `<div style="font-size:12px;color:#e74c3c;font-weight:600;">⚠️ Only ${left} spot${left === 1 ? '' : 's'} left!</div>`
                       : cur >= 3 ? `<div style="font-size:12px;color:#f39c12;">${left} spots remaining</div>` : ''}
          </div>
          <div style="display:flex;gap:12px;">
            <button onclick="showExpertRequestDetail('${req._id}')"
              style="flex:1;padding:12px;border:1.5px solid var(--primary);border-radius:10px;background:transparent;color:var(--primary);font-size:14px;font-weight:600;cursor:pointer;">
              View Details
            </button>
            <button onclick="approachClient('${req._id}')"
              style="flex:1;padding:12px;border:none;border-radius:10px;background:var(--primary);color:#fff;font-size:14px;font-weight:700;cursor:pointer;">
              Approach Client
            </button>
          </div>
        </div>`;
    }).join('') + paginationControlsHTML(allRequests, 'expertBrowse');
}
// ─── SHOW REQUEST DETAIL FOR EXPERT ───
async function showExpertRequestDetail(requestId) {
  const req = state.availableRequests.find(r => r._id === requestId);
  if (!req) return;
     // Track view
  fetch(`${API_URL}/requests/${requestId}/view`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${state.token}` }
  }).catch(() => {});
  
  // Create modal to show questionnaire details
  const modal = document.createElement('div');
  modal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px;';
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  
  const answers = req.answers || {};
  
  // Format answers for display
  let detailsHTML = '<div style="display: flex; flex-direction: column; gap: 16px;">';
  
  Object.entries(answers).forEach(([key, value]) => {
    if (key === 'fullAddress' && typeof value === 'object') {
      detailsHTML += `
        <div>
          <div style="font-size: 13px; font-weight: 600; color: var(--text-muted); margin-bottom: 4px;">Address</div>
          <div style="font-size: 14px; color: var(--text);">
            ${value.building}, ${value.area}<br>
            ${value.city}, ${value.state} - ${value.pincode}
            ${value.landmark ? `<br>Landmark: ${value.landmark}` : ''}
          </div>
        </div>
      `;
    } else if (Array.isArray(value)) {
      detailsHTML += `
        <div>
          <div style="font-size: 13px; font-weight: 600; color: var(--text-muted); margin-bottom: 4px;">${formatKey(key)}</div>
          <div style="font-size: 14px; color: var(--text);">${value.join(', ')}</div>
        </div>
      `;
    } else {
      detailsHTML += `
        <div>
          <div style="font-size: 13px; font-weight: 600; color: var(--text-muted); margin-bottom: 4px;">${formatKey(key)}</div>
          <div style="font-size: 14px; color: var(--text);">${value}</div>
        </div>
      `;
    }
  });
  
  detailsHTML += '</div>';
  
  modal.innerHTML = `
    <div style="background: var(--bg); border-radius: 16px; max-width: 500px; width: 100%; max-height: 80vh; overflow-y: auto; padding: 24px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h2 style="font-size: 20px; font-weight: 700; color: var(--text);">${req.title}</h2>
        <button onclick="this.closest('div').parentElement.remove()" style="padding: 8px; border: none; background: transparent; font-size: 24px; cursor: pointer; color: var(--text-muted);">×</button>
      </div>
      
      <div style="padding: 16px; background: var(--bg-gray); border-radius: 12px; margin-bottom: 20px;">
        <div style="font-size: 13px; font-weight: 600; color: var(--text-muted); margin-bottom: 8px;">Service</div>
        <div style="font-size: 16px; font-weight: 600; color: var(--primary);">${req.service}</div>
      </div>
      
      <div style="margin-bottom: 20px;">
        <h3 style="font-size: 16px; font-weight: 700; color: var(--text); margin-bottom: 12px;">Client Requirements</h3>
        ${detailsHTML}
      </div>
      
      <div style="padding: 16px; background: rgba(252, 128, 25, 0.1); border: 1px solid var(--primary); border-radius: 12px; margin-bottom: 20px;">
        <div style="font-size: 13px; color: var(--text-muted); margin-bottom: 4px;">⚠️ Contact details locked</div>
        <div style="font-size: 13px; color: var(--text-light);">Spend ${req.credits || 20} credits to unlock client's phone and email</div>
      </div>
      
      <button onclick="approachClient('${req._id}'); this.closest('div').parentElement.remove();" style="width: 100%; padding: 16px; border: none; border-radius: 12px; background: var(--primary); color: #fff; font-size: 16px; font-weight: 700; cursor: pointer;">Approach This Client</button>
    </div>
  `;
  
  document.body.appendChild(modal);
}

// ─── FORMAT KEY FOR DISPLAY ───
function formatKey(key) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

// ─── APPROACH CLIENT ───
function approachClient(requestId) {
  const modal = document.getElementById('approachModal');
  modal.dataset.requestId = requestId;
  document.getElementById('approachMessage').value = '';
  document.getElementById('approachQuote').value = '';
  modal.style.display = 'flex';
}

async function submitApproach() {
  const modal    = document.getElementById('approachModal');
  const requestId = modal.dataset.requestId;
  const message  = document.getElementById('approachMessage').value.trim();
  const quote    = document.getElementById('approachQuote').value;

  if (!quote || isNaN(quote) || parseInt(quote) < 1) {
    showToast('Please enter your quote amount', 'error'); return;
  }
  if (!message || message.length < 20) {
    showToast('Please write at least 20 characters in your message', 'error'); return;
  }

  const btn = document.getElementById('approachSubmitBtn');
  btn.disabled    = true;
  btn.textContent = 'Sending...';

  try {
    const res = await fetch(`${API_URL}/approaches`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${state.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        request: requestId,
        message,
        quote: parseInt(quote)
      })
    });

    const data = await res.json();

    if (data.success) {
      modal.style.display = 'none';
      showToast('Approach sent successfully!', 'success');
      loadExpertData();
      loadExpertCredits();
    } else {
      showToast(data.message || 'Failed to send approach', 'error');
    }
  } catch (error) {
    console.error('Approach error:', error);
    showToast('Failed to send approach', 'error');
  } finally {
    btn.disabled    = false;
    btn.textContent = '💎 Send Approach';
  }
}

// ─── LOAD EXPERT CREDITS ───

async function loadExpertCredits() {
try {
   // ✅ FIX: Show from state immediately
  const creditsDisplay = document.getElementById('expertCredits');
   if (creditsDisplay && state.user) {
    creditsDisplay.textContent = state.user.credits || 0;
   }
   
  // Also fetch fresh data from API
   const res = await fetch(`${API_URL}/users/me`, {
    method: 'GET',
    headers: {
     'Authorization': `Bearer ${state.token}`
     }
   });
  
   const data = await res.json();
   
   if (data.success && data.user) {
     // Update state with fresh credits
     state.user.credits = data.user.credits;
    localStorage.setItem('user', JSON.stringify(state.user));
     
    // Update display
     if (creditsDisplay) {
      creditsDisplay.textContent = data.user.credits || 0;
    }
  }
 } catch (error) {
  console.error('Load credits error:', error);
   // Still show from state even if API fails
   const creditsDisplay = document.getElementById('expertCredits');
  if (creditsDisplay && state.user) {
    creditsDisplay.textContent = state.user.credits || 0;
   }
 }
}
// ─── UPDATE EXPERT PROFILE ───
function updateExpertProfile() {
  const user = state.user;
  if (!user) return;
  
  // Update avatar
  const avatar = document.getElementById('expertAvatar');
  if (avatar) {
    if (user.profilePhoto) {
      avatar.innerHTML = `<img src="${user.profilePhoto}" alt="${user.name}">`;
    } else {
      avatar.textContent = user.name.substring(0, 1).toUpperCase();
    }
  }
  
  // Update profile tab
  const profileAvatar = document.getElementById('expertProfileAvatar');
  if (profileAvatar) {
    if (user.profilePhoto) {
      profileAvatar.innerHTML = `<img src="${user.profilePhoto}" alt="${user.name}">`;
    } else {
      profileAvatar.textContent = user.name.substring(0, 1).toUpperCase();
    }
  }
  
  const profileName = document.getElementById('expertProfileName');
  if (profileName) profileName.textContent = user.name;
  
  const profileEmail = document.getElementById('expertProfileEmail');
  if (profileEmail) profileEmail.textContent = user.email;
}

// ─── SHOW REQUEST DETAIL MODAL (FOR CLIENT) ───
async function showRequestDetail(requestId) {
  const req = state.requests.find(r => r._id === requestId);
  if (!req) return;
  
  // Fetch approaches for this request
  try {
    const res = await fetch(`${API_URL}/requests/${requestId}/approaches`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${state.token}`
      }
    });
    
    const data = await res.json();
    
    if (data.success) {
      showRequestApproaches(req, data.approaches || []);
    }
  } catch (error) {
    console.error('Load approaches error:', error);
    showToast('Failed to load approaches', 'error');
  }
}

// ADD this new function (doesn't exist yet):

async function cancelRequest(requestId) {
  if (!confirm('Are you sure you want to cancel this request? This cannot be undone.')) return;
  
  try {
    const res = await fetch(`${API_URL}/requests/${requestId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${state.token}`
      }
    });
    
    const data = await res.json();
    
    if (data.success) {
      showToast('Request cancelled successfully', 'success');
      
      // Close any open modals
      document.querySelectorAll('[style*="position: fixed"]').forEach(modal => {
        if (modal.style.zIndex === '1000' || modal.style.zIndex === '1001') {
          modal.remove();
        }
      });
      
      // Reload client data
      loadClientData();
    } else {
      showToast(data.message || 'Failed to cancel request', 'error');
    }
  } catch (error) {
    console.error('Cancel request error:', error);
    showToast('Failed to cancel request', 'error');
  }
}

// ─── SHOW REQUEST APPROACHES MODAL ───
function showRequestApproaches(req, approaches) {
  const modal = document.createElement('div');
  modal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px;';
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  
  const approachesHTML = approaches.length > 0 ? approaches.map(app => {
    const expert = app.expert;
     console.log('Approach data:', JSON.stringify(app));
    return `
      <div style="padding: 16px; background: var(--bg-gray); border-radius: 12px; margin-bottom: 12px;">
        <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 12px;">
          <div class="avatar" style="width: 48px; height: 48px; font-size: 20px;">
            ${expert.profilePhoto ? 
              `<img src="${expert.profilePhoto}" alt="${expert.name}">` : 
              expert.name.substring(0, 1).toUpperCase()
            }
          </div>
          <div style="flex: 1;">
            <h4 style="font-size: 16px; font-weight: 600; color: var(--text); margin-bottom: 2px;">${expert.name}</h4>
            <p style="font-size: 13px; color: var(--text-muted);">${expert.specialization || 'Professional'}</p>
          </div>
          ${expert.rating ? `
            <div style="display: flex; align-items: center; gap: 4px;">
              <span style="color: var(--yellow); font-size: 16px;">★</span>
              <span style="font-size: 14px; font-weight: 600;">${expert.rating.toFixed(1)}</span>
            </div>
          ` : ''}
        </div>
        ${app.quote ? `
  <div style="display:inline-flex; align-items:center; gap:6px; background:rgba(252,128,25,0.1);
              border-radius:20px; padding:6px 14px; margin-bottom:10px;">
    <span style="font-size:20px; font-weight:800; color:var(--primary);">₹${app.quote.toLocaleString('en-IN')}</span>
    <span style="font-size:12px; color:var(--text-muted); font-weight:600;">quoted</span>
  </div>
` : ''}
<p style="font-size: 14px; color: var(--text-light); margin-bottom: 12px; line-height:1.6;">${app.message}</p>
        <div style="display: flex; gap: 8px;">
          <button onclick="viewExpertProfile('${expert._id}', true)" style="flex: 1; padding: 10px; border: 1.5px solid var(--primary); border-radius: 8px; background: transparent; color: var(--primary); font-size: 13px; font-weight: 600; cursor: pointer;">View Profile</button>
          <button onclick="contactExpert('${expert._id}', '${req._id}', '${state.user._id}')" 
          style="flex: 1; padding: 10px; border: none; border-radius: 8px; background: var(--primary); color: #fff; font-size: 13px; font-weight: 700; cursor: pointer;">Contact</button>
          <button onclick="confirmServiceReceived('${req._id}', '${expert._id}', '${expert.name}', '${app._id}')" style="width: 100%; padding: 10px; border: 1.5px solid #4CAF50; border-radius: 8px; background: transparent; color: #4CAF50; font-size: 13px; font-weight: 600; cursor: pointer; margin-top: 4px;">✓ Service Received?</button>

        </div>
      </div>
    `;
  }).join('') : `
    <div class="empty-state" style="padding: 40px 20px;">
      <div class="empty-icon">👨‍💼</div>
      <h3 class="empty-title">No approaches yet</h3>
      <p class="empty-text">Professionals will approach you soon</p>
    </div>
  `;
  
  modal.innerHTML = `
    <div style="background: var(--bg); border-radius: 16px; max-width: 500px; width: 100%; max-height: 80vh; overflow-y: auto; padding: 24px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h2 style="font-size: 20px; font-weight: 700; color: var(--text);">${req.title}</h2>
        <button onclick="this.closest('div').parentElement.remove()" style="padding: 8px; border: none; background: transparent; font-size: 24px; cursor: pointer; color: var(--text-muted);">×</button>
      </div>
      
      <div style="margin-bottom: 20px;">
        <h3 style="font-size: 16px; font-weight: 700; color: var(--text); margin-bottom: 12px;">Professionals Interested (${approaches.length})</h3>
        ${approachesHTML}
      </div>
      
      ${req.status === 'pending' || req.status === 'active' ? `
        <button onclick="cancelRequest('${req._id}')" 
          style="width: 100%; padding: 14px; margin-top: 12px; border: 1.5px solid #dc3545; border-radius: 10px; background: transparent; color: #dc3545; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.2s;"
          onmouseover="this.style.background='#dc3545'; this.style.color='#fff'"
          onmouseout="this.style.background='transparent'; this.style.color='#dc3545'">
          ✕ Cancel Request
        </button>
      ` : ''}
    </div>
  `;
  
  document.body.appendChild(modal);
}

// ─── VIEW EXPERT PROFILE ───

// ─── CONTACT EXPERT ───
async function contactExpert(expertId, requestId, clientId) {
  showToast('Opening chat...', 'info');
  await startChat(requestId, expertId, clientId);
}

// ═══════════════════════════════════════════════════════════
//  ✅ NEW: EXPERT APPROACHES FEATURES
//  Added below to handle expert viewing their approaches
// ═══════════════════════════════════════════════════════════

// ─── LOAD EXPERT'S APPROACHES ───
async function loadMyApproaches() {
  try {
    // Load regular approaches
    const res = await fetch(`${API_URL}/approaches`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    const data = await res.json();
    if (data.success) {
      state.myApproaches = data.approaches || [];
    }

    // Load customer interest notifications
    const notifRes = await fetch(`${API_URL}/notifications`, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    const notifData = await notifRes.json();
    const interests = (notifData.notifications || []).filter(
      n => n.type === 'customer_interest'
    );

    renderMyApproaches(interests);
  } catch (error) {
    console.error('Load my approaches error:', error);
  }
}
// ─── RENDER EXPERT'S APPROACHES ───
function renderMyApproaches(interests = []) {
  const container = document.getElementById('approachesList');
  if (!container) return;

  // ── Customer Interested Section ──
  let interestHTML = '';
  if (interests.length > 0) {
    interestHTML = `
      <div style="margin-bottom:20px;">
        <h3 style="font-size:16px; font-weight:700; color:var(--text); margin-bottom:12px;">
          🎯 Customer Interest (${interests.length})
        </h3>
        ${interests.map(n => {
          const d = n.data || {};
          const unlocked = d.unlocked;
          return `
            <div style="background:var(--bg); border:2px solid ${unlocked ? '#22c55e' : 'var(--primary)'}; border-radius:14px; padding:16px; margin-bottom:12px;">
              <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
                <span style="font-size:14px; font-weight:700; color:var(--text);">🎯 Client wants to hire you</span>
                <span style="font-size:11px; padding:3px 8px; border-radius:20px; background:${unlocked ? 'rgba(34,197,94,0.1)' : 'rgba(252,128,25,0.1)'}; color:${unlocked ? '#22c55e' : 'var(--primary)'}; font-weight:700;">
                  ${unlocked ? 'Unlocked' : '15 credits'}
                </span>
              </div>

              <div style="padding:12px; background:var(--bg-gray); border-radius:10px; margin-bottom:12px;">
                <div style="font-size:13px; color:var(--text-muted); margin-bottom:6px;">Client contact:</div>
                ${unlocked ? `
                  <div style="font-size:15px; font-weight:700; color:var(--text); margin-bottom:4px;">
                    👤 ${d.clientName || 'Client'}
                  </div>
                  <div style="font-size:14px; color:#22c55e; margin-bottom:4px;">
                    📞 ${d.fullPhone || d.maskedPhone}
                  </div>
                  <div style="font-size:14px; color:#22c55e;">
                    ✉️ ${d.fullEmail || d.maskedEmail}
                  </div>
                ` : `
                  <div style="font-size:15px; font-weight:600; color:var(--text); margin-bottom:4px; letter-spacing:1px;">
                    📞 ${d.maskedPhone || '98XXXXXX21'}
                  </div>
                  <div style="font-size:15px; font-weight:600; color:var(--text); letter-spacing:1px;">
                    ✉️ ${d.maskedEmail || 'r****@gmail.com'}
                  </div>
                  <div style="font-size:12px; color:var(--text-muted); margin-top:6px;">
                    🔒 Spend 15 credits to see full details
                  </div>
                `}
              </div>

              <div style="font-size:12px; color:var(--text-muted); margin-bottom:10px;">
                ${formatDate(n.createdAt)}
              </div>

              ${unlocked ? `
                <div style="display:flex; gap:8px; margin-bottom:8px;">
                  <a href="tel:${d.fullPhone}" style="flex:1; padding:10px; background:#22c55e; color:#fff; border:none; border-radius:10px; font-size:13px; font-weight:700; cursor:pointer; text-align:center; text-decoration:none;">
                    📞 Call
                  </a>
                  <a href="mailto:${d.fullEmail}" style="flex:1; padding:10px; background:var(--primary); color:#fff; border:none; border-radius:10px; font-size:13px; font-weight:700; cursor:pointer; text-align:center; text-decoration:none;">
                    ✉️ Email
                  </a>
                </div>
                <div style="display:flex; gap:8px;">
                  <button onclick="viewClientDocumentsFromInterest('${d.clientId}')"
                    style="flex:1; padding:10px; border:1.5px solid var(--primary); border-radius:10px; background:transparent; color:var(--primary); font-size:12px; font-weight:700; cursor:pointer;">
                    📄 View Docs
                  </button>
                  <button onclick="messageClientFromInterest('${d.clientId}')"
                    style="flex:1; padding:10px; border:1.5px solid var(--border); border-radius:10px; background:transparent; color:var(--text); font-size:12px; font-weight:700; cursor:pointer;">
                    💬 Message
                  </button>
                </div>
              ` : `
                <button onclick="unlockInterest('${n._id}')"
                  style="width:100%; padding:12px; background:var(--primary); color:#fff; border:none; border-radius:10px; font-size:14px; font-weight:700; cursor:pointer;">
                  🔓 Unlock for 15 Credits
                </button>
              `}
            </div>
          `;
        }).join('')}
      </div>
      <hr style="border:none; border-top:1px solid var(--border); margin-bottom:20px;">
    `;
  }

  // ── Regular Approaches Section ──
  if (!state.myApproaches || state.myApproaches.length === 0) {
    container.innerHTML = interestHTML + `
      <div class="empty-state">
        <div class="empty-icon">💼</div>
        <h3 class="empty-title">No approaches yet</h3>
        <p class="empty-text">Approach requests to see them here</p>
      </div>
    `;
    return;
  }

  const statusColors = {
    pending: 'badge-warning',
    accepted: 'badge-success',
    rejected: 'badge-danger'
  };

  const allApproaches = state.myApproaches || [];
  const pagedApproaches = paginate(allApproaches, 'expertApproaches');

  container.innerHTML = interestHTML + `
    <h3 style="font-size:16px; font-weight:700; color:var(--text); margin-bottom:12px;">
      📨 My Approaches (${allApproaches.length})
    </h3>
  ` + pagedApproaches.map(app => {
    const req = app.request;
    if (!req) return '';
    return `
      <div class="request-card" style="background:var(--bg); border:1px solid var(--border); border-radius:12px; padding:20px; margin-bottom:16px; cursor:pointer;" onclick="showMyApproachDetail('${app._id}')">
        <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:12px;">
          <div style="flex:1;">
            <h3 style="font-size:18px; font-weight:700; color:var(--text); margin-bottom:4px;">${req.title || 'Request'}</h3>
            <p style="font-size:14px; color:var(--text-muted);">${(req.service || '').toUpperCase()}</p>
          </div>
          <span class="badge ${statusColors[app.status] || 'badge-warning'}">${(app.status || 'pending').toUpperCase()}</span>
        </div>
        <p style="font-size:14px; color:var(--text-light); margin-bottom:12px;">${req.description || ''}</p>
        <div style="display:flex; gap:20px; font-size:13px; color:var(--text-muted);">
          <span>💰 ${app.creditsSpent || 0} credits spent</span>
          <span>📅 ${new Date(app.createdAt).toLocaleDateString()}</span>
        </div>
      </div>
    `;
  }).join('') + paginationControlsHTML(allApproaches, 'expertApproaches');
}
// ─── SHOW APPROACH DETAIL WITH CONTACT INFO ───
async function showMyApproachDetail(approachId) {
  try {
    const res = await fetch(`${API_URL}/approaches/${approachId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${state.token}`
      }
    });
    
    const data = await res.json();
    
    if (data.success) {
      const approach = data.approach;
      const request = approach.request;
      const client = approach.client;
      
      const modal = document.createElement('div');
      modal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px;';
      modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
      
      modal.innerHTML = `
        <div style="background: var(--bg); border-radius: 16px; max-width: 500px; width: 100%; max-height: 80vh; overflow-y: auto; padding: 24px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2 style="font-size: 20px; font-weight: 700; color: var(--text);">${request.title}</h2>
            <button onclick="this.closest('div').parentElement.remove()" style="padding: 8px; border: none; background: transparent; font-size: 24px; cursor: pointer; color: var(--text-muted);">×</button>
          </div>
          
          <div style="padding: 16px; background: rgba(76, 175, 80, 0.1); border: 1px solid #4CAF50; border-radius: 12px; margin-bottom: 20px;">
            <h3 style="font-size: 16px; font-weight: 700; color: #4CAF50; margin-bottom: 12px;">✅ Contact Unlocked</h3>
            <div style="font-size: 15px; color: var(--text); line-height: 1.8;">
              <div style="margin-bottom: 8px;"><strong>Client:</strong> ${client.name}</div>
              <div style="margin-bottom: 8px;"><strong>Email:</strong> <a href="mailto:${client.email}" style="color: var(--primary); text-decoration: none;">${client.email}</a></div>
              <div><strong>Phone:</strong> <a href="tel:${client.phone}" style="color: var(--primary); text-decoration: none;">${client.phone}</a></div>
            </div>
          </div>
          
          <div style="margin-bottom: 20px;">
            <h3 style="font-size: 16px; font-weight: 700; color: var(--text); margin-bottom: 12px;">Request Details</h3>
            <p style="font-size: 14px; color: var(--text-light); line-height: 1.6;">${request.description}</p>
          </div>
          
          <div style="display: flex; flex-wrap: wrap; gap: 16px; font-size: 13px; color: var(--text-muted); margin-bottom: 20px;">
            <span>📍 ${request.location}</span>
            <span>💰 ₹${request.budget || 'Negotiable'}</span>
            <span>⏱️ ${request.timeline || 'Flexible'}</span>
          </div>
          
          
<button onclick="viewClientDocuments('${client._id}', '${request._id}')" style="width: 100%; padding: 14px; border: 1.5px solid var(--primary); border-radius: 10px; background: transparent; color: var(--primary); font-size: 15px; font-weight: 600; cursor: pointer; margin-bottom: 12px; transition: all 0.2s;" onmouseover="this.style.background='var(--primary)'; this.style.color='#fff'" onmouseout="this.style.background='transparent'; this.style.color='var(--primary)'">
  📄 View Client Documents
</button>

<button onclick="expertStartChat('${request._id}', '${state.user._id}', '${client._id}')" style="width: 100%; padding: 14px; border: none; border-radius: 10px; background: var(--primary); color: #fff; font-size: 15px; font-weight: 700; cursor: pointer; margin-bottom: 12px;">
  💬 Message Client
</button>
          
          ${approach.quote ? `
          <div style="margin-bottom: 12px; padding: 12px; background: rgba(252,128,25,0.08); border-radius: 8px; display:flex; align-items:center; justify-content:space-between;">
            <span style="font-size: 13px; font-weight: 600; color: var(--text-muted);">Your Quote</span>
            <span style="font-size: 22px; font-weight: 800; color: var(--primary);">₹${approach.quote.toLocaleString('en-IN')}</span>
          </div>
          ` : ''}
          <div style="padding: 12px; background: var(--bg-gray); border-radius: 8px;">
            <div style="font-size: 13px; font-weight: 600; color: var(--text-muted); margin-bottom: 4px;">Your message:</div>
            <div style="font-size: 14px; color: var(--text);">${approach.message}</div>
          </div>
          
          <div style="margin-top: 16px; padding: 12px; background: rgba(252, 128, 25, 0.1); border-radius: 8px; font-size: 13px; color: var(--text-muted);">
            <strong>Status:</strong> ${approach.status} • <strong>Credits spent:</strong> ${approach.creditsSpent}
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
    }
  } catch (error) {
    console.error('Show approach detail error:', error);
    showToast('Error loading approach details', 'error');
  }
}

async function viewClientDocuments(clientId, requestId) {
  try {
    showToast('Loading documents...', 'info');
    
    const res = await fetch(`${API_URL}/documents/client/${clientId}/request/${requestId}`, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    
    const data = await res.json();
    
    if (!data.success) { showToast(data.message || 'Failed to load documents', 'error'); return; }
    
    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1001; padding: 20px;';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    
    const docsHTML = data.documents && data.documents.length > 0 ? data.documents.map(doc => {
      const sizeKB = (doc.fileSize / 1024).toFixed(1);
      const icon = doc.fileType === 'pdf' ? '📄' : doc.fileType === 'word' ? '📝' : doc.fileType === 'excel' ? '📊' : doc.fileType === 'image' ? '🖼️' : '📎';
      
      if (doc.hasAccess) {
        // ✅ Has access - show download
        return `
          <div style="padding: 16px; background: var(--bg-gray); border-radius: 12px; margin-bottom: 12px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <span style="font-size: 32px;">${icon}</span>
              <div style="flex: 1;">
                <div style="font-size: 15px; font-weight: 600; color: var(--text); margin-bottom: 2px;">${doc.originalFileName}</div>
                <div style="font-size: 13px; color: var(--text-muted);">${sizeKB} KB • ${doc.fileType.toUpperCase()}</div>
                <div style="font-size: 12px; color: #4CAF50; margin-top: 2px;">✅ Access granted</div>
              </div>
              <button onclick="downloadDocument('${doc._id}')" style="padding: 8px 16px; background: var(--primary); color: #fff; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 600; border: none; cursor: pointer;">Download</button>
            </div>
          </div>
        `;
      } else if (doc.accessRequestStatus === 'pending') {
        // ⏳ Request sent, waiting
        return `
          <div style="padding: 16px; background: var(--bg-gray); border-radius: 12px; margin-bottom: 12px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <span style="font-size: 32px;">${icon}</span>
              <div style="flex: 1;">
                <div style="font-size: 15px; font-weight: 600; color: var(--text); margin-bottom: 2px;">${doc.originalFileName}</div>
                <div style="font-size: 13px; color: var(--text-muted);">${sizeKB} KB • ${doc.fileType.toUpperCase()}</div>
                <div style="font-size: 12px; color: #f39c12; margin-top: 2px;">⏳ Access request pending</div>
              </div>
              <span style="padding: 8px 12px; background: rgba(243,156,18,0.1); color: #f39c12; border-radius: 8px; font-size: 12px; font-weight: 600;">Pending</span>
            </div>
          </div>
        `;
      } else if (doc.accessRequestStatus === 'rejected') {
        // ❌ Rejected
        return `
          <div style="padding: 16px; background: var(--bg-gray); border-radius: 12px; margin-bottom: 12px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <span style="font-size: 32px;">${icon}</span>
              <div style="flex: 1;">
                <div style="font-size: 15px; font-weight: 600; color: var(--text); margin-bottom: 2px;">${doc.originalFileName}</div>
                <div style="font-size: 13px; color: var(--text-muted);">${sizeKB} KB • ${doc.fileType.toUpperCase()}</div>
                <div style="font-size: 12px; color: #e74c3c; margin-top: 2px;">❌ Access denied by client</div>
              </div>
            </div>
          </div>
        `;
      } else {
        // 🔒 Locked - show request access button
        return `
          <div style="padding: 16px; background: var(--bg-gray); border-radius: 12px; margin-bottom: 12px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <span style="font-size: 32px; filter: grayscale(1); opacity: 0.5;">${icon}</span>
              <div style="flex: 1;">
                <div style="font-size: 15px; font-weight: 600; color: var(--text); margin-bottom: 2px;">${doc.originalFileName}</div>
                <div style="font-size: 13px; color: var(--text-muted);">${sizeKB} KB • ${doc.fileType.toUpperCase()}</div>
                <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">🔒 Access required</div>
              </div>
              <button onclick="requestDocumentAccess('${doc._id}', '${clientId}', '${requestId}')" style="padding: 8px 12px; background: var(--primary); color: #fff; border: none; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer;">Request Access</button>
            </div>
          </div>
        `;
      }
    }).join('') : `
      <div style="text-align: center; padding: 40px;">
        <div style="font-size: 48px; margin-bottom: 16px;">📁</div>
        <h3 style="font-size: 18px; font-weight: 600; color: var(--text); margin-bottom: 8px;">No documents yet</h3>
        <p style="font-size: 14px; color: var(--text-muted);">Client hasn't uploaded any documents</p>
      </div>
    `;
    
    modal.innerHTML = `
      <div style="background: var(--bg); border-radius: 16px; max-width: 500px; width: 100%; max-height: 80vh; overflow-y: auto; padding: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h2 style="font-size: 20px; font-weight: 700; color: var(--text);">Client Documents</h2>
          <button onclick="this.closest('[style*=fixed]').remove()" style="border: none; background: none; font-size: 24px; cursor: pointer;">×</button>
        </div>
        <div style="padding: 12px; background: rgba(252,128,25,0.1); border-radius: 8px; margin-bottom: 20px; font-size: 13px; color: var(--text-muted);">
          🔒 Documents require client approval before you can download them
        </div>
        ${docsHTML}
      </div>
    `;
    
    document.body.appendChild(modal);
    
  } catch (error) {
    console.error('View documents error:', error);
    showToast('Error loading documents', 'error');
  }
}

async function requestDocumentAccess(documentId, clientId, requestId) {
  try {
    // Step 1: Get the expert's approach for this request
    const approachRes = await fetch(`${API_URL}/approaches`, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    const approachData = await approachRes.json();
    
    if (!approachData.success) {
      showToast('Could not find your approach', 'error');
      return;
    }

    // Find the approach matching this requestId
    const approach = approachData.approaches && approachData.approaches.find(a => {
      const approachRequestId = a.request?._id || a.request;
      return approachRequestId && approachRequestId.toString() === requestId.toString();
    });

    if (!approach) {
      showToast('Could not find your approach for this request', 'error');
      return;
    }

    // Step 2: Send access request with all required fields
    const res = await fetch(`${API_URL}/access-requests`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${state.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        documentId: documentId,
        approachId: approach._id,
        message: 'I would like to access this document for your request.'
      })
    });
    
    const data = await res.json();
    
    if (data.success) {
      showToast('Access request sent to client!', 'success');
      // Refresh documents modal
      document.querySelectorAll('[style*="position: fixed"]').forEach(m => {
        if (m.style.zIndex === '1001') m.remove();
      });
      viewClientDocuments(clientId, requestId);
    } else {
      showToast(data.message || 'Failed to send request', 'error');
    }
  } catch (error) {
    console.error('Request access error:', error);
    showToast('Failed to send access request', 'error');
  }
}

// ─── LOAD SETTINGS ─── 
function loadSettings() {
  const darkModeToggle = document.getElementById('darkModeToggle');
  if (darkModeToggle) {
    darkModeToggle.checked = localStorage.getItem('darkMode') === 'true';
  }
}

// ─── INIT ON PAGE LOAD ─── 
document.addEventListener('DOMContentLoaded', () => {
  initDarkMode();

  // ── Handle back/forward browser buttons ──
  window.addEventListener('popstate', (e) => {
    if (e.state?.pageId) {
      showPage(e.state.pageId, false);
    } else {
      navigateToPath(window.location.pathname, false);
    }
  });

  // ── Route on initial load ──
  const initialPath = window.location.pathname;

  if (state.token && state.user) {
    const authedRoutes = ['/settings', '/my-tickets', '/dashboard'];
    if (authedRoutes.includes(initialPath)) {
      navigateToPath(initialPath, false);
    } else {
      enterDashboard();
    }
  } else {
    navigateToPath(initialPath, false);
  }
});

// ── Path → pageId mapper ──
function navigateToPath(path, pushState = true) {
  const pathToPage = {
    '/':                   'landing',
    '/find-professionals': 'findProfessionals',
    '/how-it-works':       'howItWorks',
    '/pricing':            'pricing',
    '/dashboard':          state.user?.role === 'client' ? 'clientDash' : 'expertDash',
    '/settings':           'settings',
    '/my-tickets':         'myTickets',
  };

  const pageId = pathToPage[path] || 'landing';

  // Guard protected routes
  const protectedPages = ['clientDash', 'expertDash', 'settings', 'myTickets'];
  if (protectedPages.includes(pageId) && !state.token) {
    showPage('landing', pushState);
    return;
  }

  showPage(pageId, pushState);
}
// ─── SERVICE RECEIVED CONFIRMATION ───
function confirmServiceReceived(requestId, expertId, expertName, approachId) {
  // Close current modal first
  document.querySelectorAll('[style*="position: fixed"]').forEach(m => {
    if (m.style.zIndex === '1000') m.remove();
  });

  const modal = document.createElement('div');
  modal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px;';
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

  modal.innerHTML = `
    <div style="background: var(--bg); border-radius: 16px; max-width: 400px; width: 100%; padding: 28px; text-align: center;">
      <div style="font-size: 48px; margin-bottom: 16px;">✅</div>
      <h2 style="font-size: 20px; font-weight: 700; color: var(--text); margin-bottom: 8px;">Service Received?</h2>
      <p style="font-size: 15px; color: var(--text-muted); margin-bottom: 24px;">Did <strong>${expertName}</strong> complete the service for you?</p>
      
      <div style="display: flex; gap: 12px;">
        <button onclick="markServiceComplete('${requestId}', '${expertId}', '${expertName}', '${approachId}')" 
          style="flex: 1; padding: 14px; border: none; border-radius: 12px; background: #4CAF50; color: #fff; font-size: 16px; font-weight: 700; cursor: pointer;">
          ✓ Yes
        </button>
        <button onclick="this.closest('[style*=fixed]').remove()" 
          style="flex: 1; padding: 14px; border: 1.5px solid var(--border); border-radius: 12px; background: transparent; color: var(--text); font-size: 16px; font-weight: 600; cursor: pointer;">
          ✕ No
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}

// ─── MARK SERVICE COMPLETE & GO TO RATING ───
async function markServiceComplete(requestId, expertId, expertName, approachId) {
  try {
    // Close confirmation modal
    document.querySelectorAll('[style*="position: fixed"]').forEach(m => {
      if (m.style.zIndex === '1000') m.remove();
    });

    // Mark request as completed
    const res = await fetch(`${API_URL}/requests/${requestId}/complete`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${state.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ expertId })
    });

    const data = await res.json();

    if (data.success) {
      showToast('Request marked as completed!', 'success');
    }
    // Even if completion fails, still show rating modal
    
    // Reload client data in background
    loadClientData();

    // Show rating modal
    setTimeout(() => {
      showRatingPrompt(expertId, expertName, requestId, approachId);
    }, 500);

  } catch (error) {
    console.error('Mark complete error:', error);
    // Still show rating even if API fails
    showRatingPrompt(expertId, expertName, requestId, approachId);
  }
}

// ─── RATING PROMPT AFTER SERVICE ───
function showRatingPrompt(expertId, expertName, requestId, approachId) {
  const modal = document.createElement('div');
  modal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px;';

  modal.innerHTML = `
    <div style="background: var(--bg); border-radius: 16px; max-width: 400px; width: 100%; padding: 28px; text-align: center;">
      <div style="font-size: 48px; margin-bottom: 16px;">⭐</div>
      <h2 style="font-size: 20px; font-weight: 700; color: var(--text); margin-bottom: 8px;">Rate ${expertName}</h2>
      <p style="font-size: 15px; color: var(--text-muted); margin-bottom: 24px;">How was your experience? Your review helps others find great professionals.</p>
      
      <div style="display: flex; gap: 12px;">
        <button id="rateNowBtn" style="flex: 1; padding: 14px; border: none; border-radius: 12px; background: var(--primary); color: #fff; font-size: 16px; font-weight: 700; cursor: pointer;">
          ⭐ Rate Now
        </button>
        <button onclick="this.closest('[style*=fixed]').remove()" 
          style="flex: 1; padding: 14px; border: 1.5px solid var(--border); border-radius: 12px; background: transparent; color: var(--text); font-size: 15px; font-weight: 600; cursor: pointer;">
          Skip
        </button>
      </div>
    </div>
  `;

  // Use addEventListener to avoid inline quote escaping issues
  modal.querySelector('#rateNowBtn').addEventListener('click', function() {
    modal.remove();
    openRatingModal(expertId, expertName, approachId, requestId);
  });

  document.body.appendChild(modal);
}
// ═══════════════════════════════════════════════════════════
//  EXPERT PROFILE ENHANCEMENT — COMPLETE REPLACEMENT
//  Replace the existing renderExpertProfile() in app.js
//  Also add all new functions below it
// ═══════════════════════════════════════════════════════════

// ─── PROFILE STRENGTH CALCULATOR ───
function calculateProfileStrength(user, profile) {
  const scores = {
    basic: { earned: 0, max: 40, items: [] },
    professional: { earned: 0, max: 40, items: [] },
    trust: { earned: 0, max: 10, items: [] },
    response: { earned: 0, max: 10, items: [] }
  };

  // ── BASIC INFO (40%) ──
  if (user.profilePhoto)                        { scores.basic.earned += 10; scores.basic.items.push({ done: true,  label: 'Profile photo' }); }
  else                                          {                             scores.basic.items.push({ done: false, label: 'Profile photo' }); }
  if (profile.bio && profile.bio.length >= 30)  { scores.basic.earned += 10; scores.basic.items.push({ done: true,  label: 'Bio (30+ chars)' }); }
  else                                          {                             scores.basic.items.push({ done: false, label: 'Bio (30+ chars)' }); }
  if (profile.specialization)                   { scores.basic.earned += 10; scores.basic.items.push({ done: true,  label: 'Specialization' }); }
  else                                          {                             scores.basic.items.push({ done: false, label: 'Specialization' }); }
  if (profile.city && profile.pincode)          { scores.basic.earned += 10; scores.basic.items.push({ done: true,  label: 'Location (city + pincode)' }); }
  else                                          {                             scores.basic.items.push({ done: false, label: 'Location (city + pincode)' }); }

  // ── PROFESSIONAL DETAILS (40%) ──
  const profItems = [
    { key: 'gstNumber',          label: 'GST number',           points: 8  },
    { key: 'licenseNumber',      label: 'Professional license', points: 8  },
    { key: 'certificationNumber',label: 'Certification number', points: 8  },
    { key: 'education',          label: 'Education details',    points: 8  },
    { key: 'portfolio',          label: 'Portfolio / Proof of work', points: 8 },
  ];
  profItems.forEach(item => {
    const val = profile[item.key];
    const done = val && (typeof val === 'string' ? val.trim().length > 0 : true);
    if (done) scores.professional.earned += item.points;
    scores.professional.items.push({ done, label: item.label, points: item.points });
  });

  // ── TRUST SIGNALS (10%) ──
  const hasReview = (user.reviewCount || 0) >= 1;
  const hasApproach = (user.totalApproaches || 0) >= 1 || (state.myApproaches && state.myApproaches.length >= 1);
  if (hasReview)  { scores.trust.earned += 5;  scores.trust.items.push({ done: true,  label: 'Min 1 client review' }); }
  else            {                             scores.trust.items.push({ done: false, label: 'Min 1 client review' }); }
  if (hasApproach){ scores.trust.earned += 5;  scores.trust.items.push({ done: true,  label: 'Min 1 approach sent' }); }
  else            {                             scores.trust.items.push({ done: false, label: 'Min 1 approach sent' }); }

  // ── RESPONSE RATE (10%) ──
  const responseRate = user.responseRate || 0;
  if (responseRate >= 80)       { scores.response.earned = 10; scores.response.items.push({ done: true,  label: `Response rate: ${responseRate}%` }); }
  else if (responseRate >= 50)  { scores.response.earned = 5;  scores.response.items.push({ done: false, label: `Response rate: ${responseRate}% (need 80%+)` }); }
  else                          {                               scores.response.items.push({ done: false, label: 'Response rate (approach more requests)' }); }

  const total = scores.basic.earned + scores.professional.earned + scores.trust.earned + scores.response.earned;

  return { total, scores };
}

function getStrengthLabel(pct) {
  if (pct >= 90) return { label: 'Elite', color: '#10b981', bg: 'rgba(16,185,129,0.12)' };
  if (pct >= 70) return { label: 'Strong', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' };
  if (pct >= 50) return { label: 'Good',   color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' };
  if (pct >= 30) return { label: 'Fair',   color: '#f97316', bg: 'rgba(249,115,22,0.12)' };
  return                { label: 'Starter', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' };
}

function renderStrengthMeter(user, profile) {
  const { total, scores } = calculateProfileStrength(user, profile);
  const { label, color, bg } = getStrengthLabel(total);

  // Ring SVG
  const radius = 32, circ = 2 * Math.PI * radius;
  const dash = (total / 100) * circ;

  const sections = [
    { key: 'basic',        icon: '👤', title: 'Basic Info',           pct: 40 },
    { key: 'professional', icon: '💼', title: 'Professional Details', pct: 40 },
    { key: 'trust',        icon: '🛡️', title: 'Trust Signals',        pct: 10 },
    { key: 'response',     icon: '⚡', title: 'Response Rate',        pct: 10 },
  ];

  const sectionsHTML = sections.map(s => {
    const sec = scores[s.key];
    const secPct = Math.round((sec.earned / sec.max) * 100);
    const itemsHTML = sec.items.map(i =>
      `<div style="display:flex;align-items:center;gap:8px;padding:4px 0;">
        <span style="font-size:13px;color:${i.done ? '#10b981' : '#cbd5e1'};">${i.done ? '✓' : '○'}</span>
        <span style="font-size:13px;color:${i.done ? 'var(--text)' : 'var(--text-muted)'};">${i.label}</span>
      </div>`
    ).join('');

    return `
      <details style="border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:8px;">
        <summary style="padding:12px 14px;cursor:pointer;display:flex;align-items:center;gap:10px;list-style:none;user-select:none;">
          <span style="font-size:16px;">${s.icon}</span>
          <span style="flex:1;font-size:14px;font-weight:600;color:var(--text);">${s.title}</span>
          <span style="font-size:12px;font-weight:700;color:${sec.earned === sec.max ? '#10b981' : color};">${sec.earned}/${sec.max}pts</span>
        </summary>
        <div style="padding:4px 14px 12px 14px;border-top:1px solid var(--border);">${itemsHTML}</div>
      </details>`;
  }).join('');

  return `
    <div id="profileStrengthMeter" style="background:var(--bg);border:1.5px solid var(--border);border-radius:16px;padding:20px;margin-bottom:20px;">
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;">
        <!-- Ring -->
        <div style="position:relative;flex-shrink:0;width:80px;height:80px;">
          <svg width="80" height="80" style="transform:rotate(-90deg);">
            <circle cx="40" cy="40" r="${radius}" fill="none" stroke="var(--border)" stroke-width="7"/>
            <circle cx="40" cy="40" r="${radius}" fill="none" stroke="${color}" stroke-width="7"
              stroke-dasharray="${dash} ${circ}" stroke-linecap="round"
              style="transition:stroke-dasharray 0.8s ease;"/>
          </svg>
          <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;">
            <span style="font-size:18px;font-weight:800;color:var(--text);line-height:1;">${total}</span>
            <span style="font-size:9px;color:var(--text-muted);font-weight:600;">/ 100</span>
          </div>
        </div>
        <!-- Label + bar -->
        <div style="flex:1;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
            <span style="font-size:16px;font-weight:700;color:var(--text);">Profile Strength</span>
            <span style="padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700;background:${bg};color:${color};">${label}</span>
          </div>
          <div style="height:8px;background:var(--border);border-radius:4px;overflow:hidden;">
            <div style="height:100%;width:${total}%;background:${color};border-radius:4px;transition:width 0.8s ease;"></div>
          </div>
          <p style="font-size:12px;color:var(--text-muted);margin-top:6px;">
            ${total < 100 ? `Complete your profile to attract more clients` : '🎉 Perfect profile!'}
          </p>
        </div>
      </div>
      <!-- Breakdown accordion -->
      <div>${sectionsHTML}</div>
    </div>`;
}

// ─── KYC STATUS BADGE ───
function kycBadgeHTML(status) {
  const map = {
    not_submitted: { icon: '📋', text: 'Not submitted',  color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
    pending:       { icon: '⏳', text: 'Under review',   color: '#f59e0b', bg: 'rgba(245,158,11,0.1)'  },
    approved:      { icon: '✅', text: 'KYC Verified',   color: '#10b981', bg: 'rgba(16,185,129,0.1)'  },
    rejected:      { icon: '❌', text: 'Rejected - resubmit', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  };
  const s = map[status] || map.not_submitted;
  return `<span style="padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700;background:${s.bg};color:${s.color};">${s.icon} ${s.text}</span>`;
}

// ─── RENDER EXPERT PROFILE (FULL REPLACEMENT) ───
function renderExpertProfile() {
  if (!state.user) return;

  const user    = state.user;
  const profile = user.profile || {};
  const kyc     = user.kyc    || {};

  const profileTab = document.getElementById('expertProfileTab');
  if (!profileTab) return;

  // Service display labels
  const serviceLabels = { itr: 'ITR Filing', gst: 'GST Services', accounting: 'Accounting', audit: 'Audit', photography: 'Photography', development: 'Development' };
  const locationLabels = { online: '💻 Online / Remote', local: '📍 Local (in-person)', both: '🌐 Both online & in-person' };

  const memberSince = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : 'Recently joined';

  // Services badges
  const servicesBadges = (profile.servicesOffered || []).map(s =>
    `<span style="padding:5px 12px;background:rgba(252,128,25,0.1);color:var(--primary);border-radius:20px;font-size:13px;font-weight:600;">${serviceLabels[s] || s}</span>`
  ).join('');

  profileTab.innerHTML = `
    <!-- ── AVATAR SECTION ── -->
    <div style="text-align:center;padding:24px 20px 0;">
      <div class="avatar-upload" style="display:inline-block;position:relative;margin-bottom:12px;">
        <div class="avatar avatar-xl" id="expertProfileAvatar" style="width:88px;height:88px;font-size:32px;">
          ${user.profilePhoto ? `<img src="${user.profilePhoto}" alt="${user.name}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : (user.name || 'E').substring(0,2).toUpperCase()}
        </div>
        <button class="avatar-upload-btn" onclick="document.getElementById('expertPhotoInput').click()" style="position:absolute;bottom:0;right:0;width:28px;height:28px;border-radius:50%;background:var(--primary);color:#fff;border:2px solid var(--bg);font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;">📷</button>
        <input type="file" id="expertPhotoInput" style="display:none;" accept="image/*" onchange="uploadProfilePhoto(event)">
      </div>
      <h2 style="font-size:22px;font-weight:800;color:var(--text);margin-bottom:4px;" id="expertProfileName">${user.name || 'Expert'}</h2>
      <p style="color:var(--text-muted);font-size:14px;margin-bottom:4px;" id="expertProfileEmail">${user.email || ''}</p>
      ${profile.specialization ? `<p style="color:var(--primary);font-size:14px;font-weight:600;">${profile.specialization}</p>` : ''}
      <div style="display:flex;align-items:center;justify-content:center;gap:16px;margin-top:12px;margin-bottom:20px;flex-wrap:wrap;">
        <span style="font-size:14px;color:var(--text-muted);">⭐ ${user.rating || '0.0'} (${user.reviewCount || 0} reviews)</span>
        <span style="font-size:14px;color:var(--text-muted);">💎 ${user.credits || 0} credits</span>
        ${profile.city ? `<span style="font-size:14px;color:var(--text-muted);">📍 ${profile.city}</span>` : ''}
      </div>
    </div>

    <div style="padding:0 20px 40px;">
<!-- ── BASIC INFO (EDITABLE) ── -->
      <div class="settings-section" style="margin-bottom:20px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
          <h3 class="settings-section-title" style="margin:0;">👤 Basic Info</h3>
          <button onclick="toggleBasicEditMode()" id="basicEditBtn" style="padding:6px 14px;border:1.5px solid var(--primary);border-radius:8px;background:transparent;color:var(--primary);font-size:13px;font-weight:600;cursor:pointer;">✏️ Edit</button>
        </div>

        <div style="padding:12px 0;border-bottom:1px solid var(--border);" class="basic-field-row">
          <div style="font-size:13px;color:var(--text-muted);margin-bottom:4px;">Full Name</div>
          <div id="basic_display_name" style="font-size:14px;font-weight:500;color:var(--text);">${user.name || 'Not set'}</div>
          <input id="basic_edit_name" type="text" value="${user.name || ''}" style="display:none;width:100%;padding:10px 12px;border:1.5px solid var(--primary);border-radius:8px;font-size:14px;background:var(--bg);color:var(--text);box-sizing:border-box;">
        </div>

        <div style="padding:12px 0;border-bottom:1px solid var(--border);" class="basic-field-row">
          <div style="font-size:13px;color:var(--text-muted);margin-bottom:4px;">City</div>
          <div id="basic_display_city" style="font-size:14px;font-weight:500;color:var(--text);">${profile.city || user.location?.city || '<span style="color:var(--text-muted);font-style:italic;">Not set</span>'}</div>
          <input id="basic_edit_city" type="text" value="${profile.city || user.location?.city || ''}" placeholder="e.g. Bengaluru" style="display:none;width:100%;padding:10px 12px;border:1.5px solid var(--primary);border-radius:8px;font-size:14px;background:var(--bg);color:var(--text);box-sizing:border-box;">
        </div>

        <div style="padding:12px 0;border-bottom:1px solid var(--border);" class="basic-field-row">
          <div style="font-size:13px;color:var(--text-muted);margin-bottom:4px;">Pincode</div>
          <div id="basic_display_pincode" style="font-size:14px;font-weight:500;color:var(--text);">${profile.pincode || user.location?.pincode || '<span style="color:var(--text-muted);font-style:italic;">Not set</span>'}</div>
          <input id="basic_edit_pincode" type="text" value="${profile.pincode || user.location?.pincode || ''}" placeholder="e.g. 560001" maxlength="6" style="display:none;width:100%;padding:10px 12px;border:1.5px solid var(--primary);border-radius:8px;font-size:14px;background:var(--bg);color:var(--text);box-sizing:border-box;">
        </div>

        <div style="padding:12px 0;border-bottom:1px solid var(--border);" class="basic-field-row">
          <div style="font-size:13px;color:var(--text-muted);margin-bottom:4px;">State</div>
          <div id="basic_display_state" style="font-size:14px;font-weight:500;color:var(--text);">${profile.state || user.location?.state || '<span style="color:var(--text-muted);font-style:italic;">Not set</span>'}</div>
          <input id="basic_edit_state" type="text" value="${profile.state || user.location?.state || ''}" placeholder="e.g. Karnataka" style="display:none;width:100%;padding:10px 12px;border:1.5px solid var(--primary);border-radius:8px;font-size:14px;background:var(--bg);color:var(--text);box-sizing:border-box;">
        </div>

        <div id="basicSaveRow" style="display:none;margin-top:16px;">
          <button onclick="saveBasicInfo()" style="width:100%;padding:14px;background:var(--primary);color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;">💾 Save Basic Info</button>
        </div>
      </div>

      <!-- ── PROFILE STRENGTH ── -->
      ${renderStrengthMeter(user, profile)}

      <!-- ── KYC VERIFICATION ── -->
      <div class="settings-section" style="margin-bottom:20px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
          <h3 class="settings-section-title" style="margin:0;">🛡️ KYC Verification</h3>
          ${kycBadgeHTML(kyc.status || 'not_submitted')}
        </div>
        ${kyc.status === 'approved' ? `
          <div style="padding:12px;background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.3);border-radius:10px;font-size:13px;color:#10b981;">
            Your identity has been verified. A ✅ verified badge appears on your public profile.
          </div>
        ` : kyc.status === 'pending' ? `
          <div style="padding:12px;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.3);border-radius:10px;font-size:13px;color:#f59e0b;">
            ⏳ Documents submitted. Admin will review within 24–48 hours.
          </div>
        ` : `
          <p style="font-size:13px;color:var(--text-muted);margin-bottom:14px;">Upload one government ID to get a verified badge on your profile. Verified experts get 3× more client trust.</p>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
            ${['Aadhaar Card','PAN Card','Voter ID','Driving License'].map(doc => `
              <label style="display:flex;align-items:center;gap:8px;padding:10px 12px;border:1.5px solid var(--border);border-radius:10px;cursor:pointer;font-size:13px;font-weight:500;transition:all 0.2s;"
                id="kyc_label_${doc.replace(/\s/g,'_')}"
                onmouseover="this.style.borderColor='var(--primary)'"
                onmouseout="if(window._kycSelected!==this.querySelector('input').value)this.style.borderColor='var(--border)'">
                <input type="radio" name="kycDocType" value="${doc}" onchange="selectKycDocType('${doc}')" style="accent-color:var(--primary);">
                ${doc}
              </label>`).join('')}
          </div>
          <div id="kycUploadArea" style="display:none;">
            <div id="kycPreview" style="display:none;margin-bottom:10px;"></div>
            <label style="display:flex;flex-direction:column;align-items:center;gap:8px;padding:20px;border:2px dashed var(--border);border-radius:12px;cursor:pointer;background:var(--bg-gray);" onclick="document.getElementById('kycFileInput').click()">
              <span style="font-size:32px;">📄</span>
              <span style="font-size:14px;font-weight:600;color:var(--text);">Tap to upload document</span>
              <span style="font-size:12px;color:var(--text-muted);">JPG, PNG or PDF • Max 5MB</span>
            </label>
            <input type="file" id="kycFileInput" style="display:none;" accept="image/*,.pdf" onchange="previewKycDoc(event)">
            <button id="kycSubmitBtn" onclick="submitKycDocument()" style="display:none;width:100%;margin-top:12px;padding:14px;background:var(--primary);color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;">
              🛡️ Submit for Verification
            </button>
          </div>
          ${kyc.status === 'rejected' ? `
            <div style="padding:10px 12px;background:rgba(239,68,68,0.08);border-radius:8px;font-size:13px;color:#ef4444;margin-top:8px;">
              ❌ Rejection reason: ${kyc.rejectionReason || 'Document unclear or unreadable. Please resubmit.'}
            </div>` : ''}
        `}
      </div>

      <!-- ── SERVICES OFFERED ── -->
      ${(profile.servicesOffered || []).length > 0 ? `
        <div class="settings-section" style="margin-bottom:20px;">
          <h3 class="settings-section-title">Services Offered</h3>
          <div style="display:flex;flex-wrap:wrap;gap:8px;">${servicesBadges}</div>
        </div>` : ''}

      <!-- ── PROFESSIONAL DETAILS (inline editable) ── -->
      <div class="settings-section" style="margin-bottom:20px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
          <h3 class="settings-section-title" style="margin:0;">💼 Professional Details</h3>
          <button onclick="toggleEditMode()" id="editModeBtn" style="padding:6px 14px;border:1.5px solid var(--primary);border-radius:8px;background:transparent;color:var(--primary);font-size:13px;font-weight:600;cursor:pointer;">✏️ Edit</button>
        </div>

        ${renderInlineField('specialization', 'Specialization', profile.specialization, 'text', 'e.g. Chartered Accountant')}
        ${renderInlineField('experience', 'Experience', profile.experience, 'text', 'e.g. 5-10 years')}
        ${renderInlineField('certificationNumber', 'Certification Number', profile.certificationNumber, 'text', 'e.g. ICAI-MRN-123456')}
        ${renderInlineField('gstNumber', 'GST Number', profile.gstNumber, 'text', 'e.g. 29ABCDE1234F1Z5')}
        ${renderInlineField('licenseNumber', 'Professional License No.', profile.licenseNumber, 'text', 'e.g. LIC/2023/00123')}
        ${renderInlineField('education', 'Education', profile.education, 'text', 'e.g. B.Com, CA Final')}
        ${renderInlineField('professionalAddress', 'Professional Address', profile.professionalAddress, 'text', 'Office address')}
        ${renderInlineField('bio', 'About / Bio', profile.bio, 'textarea', 'Tell clients about your expertise...')}
        ${renderInlineField('portfolio', 'Portfolio & Proof of Work', profile.portfolio, 'textarea', 'Links, achievements, notable projects...')}

        <div id="editSaveRow" style="display:none;margin-top:16px;">
          <button onclick="saveProfileEdits()" style="width:100%;padding:14px;background:var(--primary);color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;">💾 Save Changes</button>
        </div>
      </div>

      <!-- ── AVAILABILITY STATUS ── -->
      <div class="settings-section" style="margin-bottom:20px;">
        <h3 class="settings-section-title">Availability Status</h3>
        <p style="font-size:13px;color:var(--text-muted);margin-bottom:12px;">Clients see this on your profile — keep it updated</p>
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${['available','busy','away'].map(status => {
            const map = {
              available: { icon: '🟢', label: "I'm Available",     sub: 'Open to new clients' },
              busy:      { icon: '🔴', label: 'Busy This Week',    sub: 'Limited availability' },
              away:      { icon: '🟡', label: 'Away',              sub: 'Temporarily unavailable' }
            };
            const s = map[status];
            const isActive = (user.availability || 'available') === status;
            return `<label style="display:flex;align-items:center;gap:12px;padding:12px 14px;border:2px solid ${isActive ? 'var(--primary)' : 'var(--border)'};border-radius:10px;cursor:pointer;background:${isActive ? 'rgba(252,128,25,0.05)' : 'var(--bg)'};">
              <input type="radio" name="availabilityRadio" value="${status}" ${isActive ? 'checked' : ''} style="accent-color:var(--primary);" onchange="updateAvailability('${status}')">
              <div>
                <div style="font-size:14px;font-weight:700;color:var(--text);">${s.icon} ${s.label}</div>
                <div style="font-size:12px;color:var(--text-muted);">${s.sub}</div>
              </div>
            </label>`;
          }).join('')}
        </div>
      </div>

      <!-- ── WHY CHOOSE ME ── -->
      <div class="settings-section" style="margin-bottom:20px;">
        <h3 class="settings-section-title">Why Choose Me</h3>
        <p style="font-size:13px;color:var(--text-muted);margin-bottom:10px;">Shown on your public profile to help clients decide</p>
        <textarea id="whyChooseMeInput" rows="4" maxlength="500"
          placeholder="e.g. I respond within 2 hours, offer free consultation, have 8 years experience with 100+ happy clients..."
          style="width:100%;padding:12px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;font-family:inherit;resize:vertical;background:var(--bg);color:var(--text);box-sizing:border-box;"
        >${user.whyChooseMe || ''}</textarea>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px;">
          <span style="font-size:12px;color:var(--text-muted);">Max 500 characters</span>
          <button onclick="saveWhyChooseMe()" style="padding:8px 20px;background:var(--primary);color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;">Save</button>
        </div>
      </div>

      <!-- ── LAST ONLINE ── -->
      <div class="settings-section" style="margin-bottom:20px;">
        <h3 class="settings-section-title">Last Online</h3>
        <div style="font-size:15px;font-weight:600;color:var(--text);">${(() => {
          if (!user.lastOnline) return '🕐 Recently active';
          const diff = Date.now() - new Date(user.lastOnline).getTime();
          const mins = Math.floor(diff / 60000);
          const hrs  = Math.floor(diff / 3600000);
          const days = Math.floor(diff / 86400000);
          if (mins < 5)       return '🟢 Online now';
          if (mins < 60)      return `🕐 ${mins} minute${mins > 1 ? 's' : ''} ago`;
          if (hrs < 24)       return `🕐 ${hrs} hour${hrs > 1 ? 's' : ''} ago`;
          return `📅 ${days} day${days > 1 ? 's' : ''} ago`;
        })()}</div>
      </div>

      <!-- ── CONTACT & ACCOUNT ── -->
      <div class="settings-section" style="margin-bottom:20px;">
        <h3 class="settings-section-title">Contact Information</h3>
        <div style="padding:12px 0;border-bottom:1px solid var(--border);">
          <div style="font-size:13px;color:var(--text-muted);margin-bottom:4px;">Phone</div>
          <div style="font-size:15px;font-weight:600;color:var(--text);">${user.phone || 'Not provided'}</div>
        </div>
        <div style="padding:12px 0;border-bottom:1px solid var(--border);">
          <div style="font-size:13px;color:var(--text-muted);margin-bottom:4px;">Service Location</div>
          <div style="font-size:15px;font-weight:600;color:var(--text);">${locationLabels[profile.serviceLocationType] || '—'}</div>
        </div>
        <div style="padding:12px 0;">
          <div style="font-size:13px;color:var(--text-muted);margin-bottom:4px;">Member Since</div>
          <div style="font-size:15px;font-weight:600;color:var(--text);">${memberSince}</div>
        </div>
      </div>

    </div><!-- end padding wrapper -->
  `;
}

// ─── INLINE FIELD RENDERER ───
function renderInlineField(key, label, value, type, placeholder) {
  const displayVal = value ? value : `<span style="color:var(--text-muted);font-style:italic;">Not set</span>`;
  const inputEl = type === 'textarea'
    ? `<textarea id="edit_${key}" rows="3" placeholder="${placeholder}" style="display:none;width:100%;padding:10px 12px;border:1.5px solid var(--primary);border-radius:8px;font-size:14px;font-family:inherit;resize:vertical;background:var(--bg);color:var(--text);">${value || ''}</textarea>`
    : `<input type="text" id="edit_${key}" value="${value || ''}" placeholder="${placeholder}" style="display:none;width:100%;padding:10px 12px;border:1.5px solid var(--primary);border-radius:8px;font-size:14px;background:var(--bg);color:var(--text);">`;

  return `
    <div style="padding:12px 0;border-bottom:1px solid var(--border);" class="profile-field-row">
      <div style="font-size:13px;color:var(--text-muted);margin-bottom:4px;">${label}</div>
      <div id="display_${key}" style="font-size:14px;font-weight:500;color:var(--text);line-height:1.5;">${displayVal}</div>
      ${inputEl}
    </div>`;
}

// ─── TOGGLE EDIT MODE ───
let _editMode = false;
function toggleEditMode() {
  _editMode = !_editMode;
  const btn = document.getElementById('editModeBtn');
  const saveRow = document.getElementById('editSaveRow');

  document.querySelectorAll('.profile-field-row').forEach(row => {
    const displays = row.querySelectorAll('[id^="display_"]');
    const inputs   = row.querySelectorAll('input[id^="edit_"], textarea[id^="edit_"]');
    displays.forEach(d => d.style.display = _editMode ? 'none' : 'block');
    inputs.forEach(i => i.style.display   = _editMode ? 'block' : 'none');
  });

  if (btn) btn.textContent = _editMode ? '✕ Cancel' : '✏️ Edit';
  if (saveRow) saveRow.style.display = _editMode ? 'block' : 'none';

  if (!_editMode) {
    // Cancelled — refresh to restore original values
    renderExpertProfile();
  }
}

// ─── SAVE PROFILE EDITS ───
async function saveProfileEdits() {
  const fields = ['specialization','experience','certificationNumber','gstNumber','licenseNumber','education','professionalAddress','bio','portfolio'];
  const updatedProfile = { ...(state.user.profile || {}) };

  fields.forEach(key => {
    const el = document.getElementById('edit_' + key);
    if (el) updatedProfile[key] = el.value.trim();
  });

  const btn = document.querySelector('#editSaveRow button');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

  try {
    const res = await fetch(`${API_URL}/users/profile`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${state.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ profile: updatedProfile })
    });

    const data = await res.json();

    if (data.success) {
      state.user.profile = updatedProfile;
      localStorage.setItem('user', JSON.stringify(state.user));
      _editMode = false;
      showToast('Profile updated successfully!', 'success');
      renderExpertProfile();
    } else {
      showToast(data.message || 'Failed to save', 'error');
      if (btn) { btn.disabled = false; btn.textContent = '💾 Save Changes'; }
    }
  } catch (err) {
    console.error('Save profile error:', err);
    showToast('Network error. Please try again.', 'error');
    if (btn) { btn.disabled = false; btn.textContent = '💾 Save Changes'; }
  }
}
// ─── TOGGLE BASIC EDIT MODE ───
let _basicEditMode = false;
function toggleBasicEditMode() {
  _basicEditMode = !_basicEditMode;
  const btn = document.getElementById('basicEditBtn');
  const saveRow = document.getElementById('basicSaveRow');

  document.querySelectorAll('.basic-field-row').forEach(row => {
    row.querySelectorAll('[id^="basic_display_"]').forEach(d => d.style.display = _basicEditMode ? 'none' : 'block');
    row.querySelectorAll('[id^="basic_edit_"]').forEach(i => i.style.display = _basicEditMode ? 'block' : 'none');
  });

  if (btn) btn.textContent = _basicEditMode ? '✕ Cancel' : '✏️ Edit';
  if (saveRow) saveRow.style.display = _basicEditMode ? 'block' : 'none';

  if (!_basicEditMode) renderExpertProfile();
}

// ─── SAVE BASIC INFO ───
async function saveBasicInfo() {
  const nameVal    = document.getElementById('basic_edit_name')?.value.trim();
  const cityVal    = document.getElementById('basic_edit_city')?.value.trim();
  const pincodeVal = document.getElementById('basic_edit_pincode')?.value.trim();
  const stateVal   = document.getElementById('basic_edit_state')?.value.trim();

  if (!nameVal) { showToast('Name cannot be empty', 'error'); return; }

  const btn = document.querySelector('#basicSaveRow button');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

  try {
    const updatedProfile = {
      ...(state.user.profile || {}),
      city: cityVal,
      pincode: pincodeVal,
      state: stateVal
    };

    // Save profile (city, pincode, state)
    const res = await fetch(`${API_URL}/users/profile`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${state.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ profile: updatedProfile })
    });
    const data = await res.json();

    if (data.success) {
      // Save name separately via /me
      await fetch(`${API_URL}/users/me`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${state.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: nameVal })
      });

      state.user.name = nameVal;
      state.user.profile = updatedProfile;
      localStorage.setItem('user', JSON.stringify(state.user));
      _basicEditMode = false;
      showToast('Basic info updated!', 'success');
      renderExpertProfile();
    } else {
      showToast(data.message || 'Failed to save', 'error');
      if (btn) { btn.disabled = false; btn.textContent = '💾 Save Basic Info'; }
    }
  } catch (err) {
    showToast('Network error', 'error');
    if (btn) { btn.disabled = false; btn.textContent = '💾 Save Basic Info'; }
  }
}
// ─── UPDATE AVAILABILITY ───
async function updateAvailability(status) {
  try {
    const res = await fetch(`${API_URL}/users/availability`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${state.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ availability: status })
    });
    const data = await res.json();
    if (data.success) {
      state.user.availability = status;
      localStorage.setItem('user', JSON.stringify(state.user));
      showToast('Availability updated!', 'success');
    } else {
      showToast(data.message || 'Failed to update', 'error');
    }
  } catch (err) {
    showToast('Network error', 'error');
  }
}

// ─── SAVE WHY CHOOSE ME ───
async function saveWhyChooseMe() {
  const text = document.getElementById('whyChooseMeInput')?.value.trim() || '';
  try {
    const res = await fetch(`${API_URL}/users/profile`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${state.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ whyChooseMe: text })
    });
    const data = await res.json();
    if (data.success) {
      state.user.whyChooseMe = text;
      localStorage.setItem('user', JSON.stringify(state.user));
      showToast('Saved!', 'success');
    } else {
      showToast(data.message || 'Failed to save', 'error');
    }
  } catch (err) {
    showToast('Network error', 'error');
  }
}
// ─── KYC DOC TYPE SELECTION ───
window._kycSelected = null;
window._kycBase64   = null;
window._kycFileName = null;
window._kycMime     = null;

function selectKycDocType(docType) {
  window._kycSelected = docType;
  // Highlight selected card
  document.querySelectorAll('[id^="kyc_label_"]').forEach(el => el.style.borderColor = 'var(--border)');
  const lbl = document.getElementById('kyc_label_' + docType.replace(/\s/g,'_'));
  if (lbl) lbl.style.borderColor = 'var(--primary)';
  // Show upload area
  const area = document.getElementById('kycUploadArea');
  if (area) area.style.display = 'block';
}

// ─── KYC DOC PREVIEW ───
function previewKycDoc(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    showToast('File too large. Max 5MB.', 'error');
    return;
  }

  window._kycFileName = file.name;
  window._kycMime     = file.type;

  const reader = new FileReader();
  reader.onload = function(e) {
    window._kycBase64 = e.target.result; // full data URL

    const preview = document.getElementById('kycPreview');
    const submitBtn = document.getElementById('kycSubmitBtn');

    if (preview) {
      preview.style.display = 'block';
      if (file.type.startsWith('image/')) {
        preview.innerHTML = `
          <div style="position:relative;border-radius:10px;overflow:hidden;border:1.5px solid var(--border);">
            <img src="${e.target.result}" style="width:100%;max-height:180px;object-fit:cover;display:block;">
            <div style="position:absolute;bottom:0;left:0;right:0;padding:8px 12px;background:rgba(0,0,0,0.6);font-size:12px;color:#fff;">
              📄 ${file.name}
            </div>
          </div>`;
      } else {
        preview.innerHTML = `
          <div style="display:flex;align-items:center;gap:12px;padding:12px;background:var(--bg-gray);border-radius:10px;border:1.5px solid var(--border);">
            <span style="font-size:32px;">📄</span>
            <div>
              <div style="font-size:14px;font-weight:600;">${file.name}</div>
              <div style="font-size:12px;color:var(--text-muted);">${(file.size/1024).toFixed(1)} KB • PDF</div>
            </div>
          </div>`;
      }
    }
    if (submitBtn) submitBtn.style.display = 'block';
  };
  reader.readAsDataURL(file);
}

// ─── SUBMIT KYC DOCUMENT ───
async function submitKycDocument() {
  if (!window._kycSelected) { showToast('Please select document type', 'error'); return; }
  if (!window._kycBase64)   { showToast('Please upload a document', 'error');    return; }

  const btn = document.getElementById('kycSubmitBtn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Uploading...'; }

  try {
    const res = await fetch(`${API_URL}/users/kyc`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${state.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        docType:  window._kycSelected,
        docBase64: window._kycBase64,
        fileName:  window._kycFileName,
        mimeType:  window._kycMime
      })
    });

    const data = await res.json();

    if (data.success) {
      // Update local state
      if (!state.user.kyc) state.user.kyc = {};
      state.user.kyc.status  = 'pending';
      state.user.kyc.docType = window._kycSelected;
      localStorage.setItem('user', JSON.stringify(state.user));

      showToast('KYC submitted! Admin will review within 24–48 hours.', 'success');

      // Reset globals
      window._kycSelected = null;
      window._kycBase64   = null;
      window._kycFileName = null;

      renderExpertProfile();
    } else {
      showToast(data.message || 'KYC submission failed', 'error');
      if (btn) { btn.disabled = false; btn.textContent = '🛡️ Submit for Verification'; }
    }
  } catch (err) {
    console.error('KYC submit error:', err);
    showToast('Network error. Please try again.', 'error');
    if (btn) { btn.disabled = false; btn.textContent = '🛡️ Submit for Verification'; }
  }
}
// ─── ABORT CONTROLLERS ───
let browseAbortController = null;
let expertsAbortController = null;

// ─── CHAT STATE ───
let currentChatId = null;
let chatPollingInterval = null;
let notificationInterval = null;

// ─── HELPER: get correct element ID based on role ───
function chatEl(clientId, expertId) {
  return document.getElementById(
    state.user?.role === 'expert' ? expertId : clientId
  );
}

// ─── SHOW CHAT LIST (back button) ───
function showChatList() {
  currentChatId = null;
  clearInterval(chatPollingInterval);

  // Hide message view, show list view
  const listView = chatEl('clientChatListView', 'expertChatListView');
  const msgView  = chatEl('clientChatMessageView', 'expertChatMessageView');
  if (listView) listView.style.display = 'block';
  if (msgView)  msgView.style.display  = 'none';

  loadChats();
}

// ─── LOAD ALL CHATS ───
async function loadChats() {
  try {
    const res = await fetch(`${API_URL}/chats`, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    const data = await res.json();
    if (!data.success) return;

    const container = chatEl('clientChatConversations', 'expertChatConversations');
    if (!container) return;

    if (!data.chats.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">💬</div>
          <h3 class="empty-title">No conversations yet</h3>
          <p class="empty-text">${state.user?.role === 'expert' 
            ? 'Approach a request to start chatting' 
            : 'Experts who approach your requests will appear here'}</p>
        </div>`;
      return;
    }

    container.innerHTML = data.chats.map(chat => {
      const other = state.user?.role === 'expert' ? chat.client : chat.expert;
      const initials = (other?.name || '?').substring(0, 2).toUpperCase();
      const photo = other?.profilePhoto
        ? `<img src="${other.profilePhoto}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
        : initials;

      return `
        <div onclick="openChat('${chat._id}')"
          style="display:flex;align-items:center;gap:12px;padding:14px;border-radius:12px;
                 cursor:pointer;border:1px solid var(--border);margin-bottom:10px;background:var(--bg);">
          <div class="avatar">${photo}</div>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:600;margin-bottom:2px;">${other?.name || 'Unknown'}</div>
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px;">${chat.request?.title || ''}</div>
            <div style="font-size:13px;color:var(--text-light);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              ${chat.lastMessage || 'No messages yet'}
            </div>
          </div>
        </div>`;
    }).join('');

  } catch (err) {
    console.error('Load chats error:', err);
  }
}

// ─── OPEN SPECIFIC CHAT ───
async function openChat(chatId) {
  currentChatId = chatId;

  const listView = chatEl('clientChatListView', 'expertChatListView');
  const msgView  = chatEl('clientChatMessageView', 'expertChatMessageView');
  if (listView) listView.style.display = 'none';
  if (msgView)  { msgView.style.display = 'flex'; }

  await loadMessages(chatId);

  // Poll every 5 seconds for new messages
  clearInterval(chatPollingInterval);
  chatPollingInterval = setInterval(() => loadMessages(chatId), 5000);
}

// ─── LOAD MESSAGES ───
async function loadMessages(chatId) {
  try {
    const res = await fetch(`${API_URL}/chats/${chatId}/messages`, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    const data = await res.json();
    if (!data.success) return;

    // Update header with other person's name
    const chatsRes = await fetch(`${API_URL}/chats`, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    const chatsData = await chatsRes.json();
    const chat = chatsData.chats?.find(c => c._id === chatId);
    if (chat) {
      const other = state.user?.role === 'expert' ? chat.client : chat.expert;
      const nameEl    = chatEl('chatWithName', 'expertChatWithName');
      const titleEl   = chatEl('chatRequestTitle', 'expertChatRequestTitle');
      const avatarEl  = chatEl('chatWithAvatar', 'expertChatWithAvatar');
      if (nameEl)   nameEl.textContent  = other?.name || '';
      if (titleEl)  titleEl.textContent = chat.request?.title || '';
      if (avatarEl) avatarEl.innerHTML  = other?.profilePhoto
        ? `<img src="${other.profilePhoto}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
        : (other?.name || '?').substring(0, 2).toUpperCase();
    }

    // Render messages
    const container = chatEl('chatMessages', 'expertChatMessages');
    if (!container) return;

    const myId = state.user?._id || state.user?.id;
    container.innerHTML = data.messages.map(msg => {
      const senderId = msg.sender?._id || msg.sender;
      const isMe = senderId === myId;
      const time = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return `
        <div style="display:flex;justify-content:${isMe ? 'flex-end' : 'flex-start'};">
          <div style="max-width:70%;padding:10px 14px;
            border-radius:${isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px'};
            background:${isMe ? 'var(--primary)' : '#f1f1f1'};
            color:${isMe ? 'white' : 'var(--text)'};
            font-size:14px;line-height:1.4;">
            ${msg.text}
            <div style="font-size:10px;opacity:0.7;margin-top:4px;text-align:right;">${time}</div>
          </div>
        </div>`;
    }).join('');

    container.scrollTop = container.scrollHeight;

  } catch (err) {
    console.error('Load messages error:', err);
  }
}

// ─── SEND MESSAGE ───
async function sendMessage() {
  const inputEl = chatEl('chatInput', 'expertChatInput');
  const text = inputEl?.value.trim();
  if (!text || !currentChatId) return;
  inputEl.value = '';

  try {
    await fetch(`${API_URL}/chats/${currentChatId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${state.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text })
    });
    await loadMessages(currentChatId);
  } catch (err) {
    console.error('Send message error:', err);
  }
}

// ─── START CHAT (from Contact button) ───
async function startChat(requestId, expertId, clientId) {
  try {
    const res = await fetch(`${API_URL}/chats/start`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${state.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ requestId, expertId, clientId })
    });
    const data = await res.json();
    if (data.success) {
      // ✅ Close all open modals correctly
      document.querySelectorAll('[style*="position: fixed"]').forEach(m => m.remove());
      switchTab('chat');
      openChat(data.chat._id);
    } else {
      showToast(data.message || 'Could not start chat', 'error');
    }
  } catch (err) {
    showToast('Network error', 'err');
  }
}
// ─── EXPERT STARTS CHAT FROM APPROACH DETAIL ───
async function expertStartChat(requestId, expertId, clientId) {
  try {
    const res = await fetch(`${API_URL}/chats/start`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${state.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ requestId, expertId, clientId })
    });
    const data = await res.json();
    if (data.success) {
      // Close all open modals
      document.querySelectorAll('[style*="position: fixed"]').forEach(m => m.remove());
      switchTab('chat');
      openChat(data.chat._id);
    } else {
      showToast(data.message || 'Could not start chat', 'error');
    }
  } catch (err) {
    showToast('Network error', 'error');
  }
}
async function lookupPincode(value) {
  if (value.length !== 6 || !/^\d+$/.test(value)) return;
  
  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${value}`);
    const data = await res.json();
    
    if (data[0].Status === 'Success') {
      const post = data[0].PostOffice[0];
      const area = post.Name;
      const city = post.District;
      const stateVal = post.State;
      
      // Auto-fill city if empty (expert)
      const cityInput = document.getElementById('q_city');
      if (cityInput && !cityInput.value) {
        cityInput.value = city;
        qState.answers['city'] = city;
      }
      
      // Auto-fill state if empty (expert) — targets the select dropdown
      if (!qState.answers['state']) {
        qState.answers['state'] = stateVal;
        // Re-render so the dropdown shows the selected state
        renderQuestion();
        return; // renderQuestion resets pincodeResult so we stop here
      }
      
      const pincodeResult = document.getElementById('pincodeResult');
      if (pincodeResult) {
        pincodeResult.innerHTML = `
          <div style="font-size: 13px; color: #4CAF50; margin-top: 6px;">
            📍 ${area}, ${city}, ${stateVal}
          </div>`;
      }
    } else {
      const pincodeResult = document.getElementById('pincodeResult');
      if (pincodeResult) {
        pincodeResult.innerHTML = `
          <div style="font-size: 13px; color: #e74c3c; margin-top: 6px;">Invalid pincode</div>`;
      }
    }
  } catch (err) {
    console.error('Pincode lookup error:', err);
  }
}

// ─── PINCODE LOOKUP FOR CLIENT FULL ADDRESS (in-person) ───
async function lookupAddressPincode(value) {
  if (value.length !== 6 || !/^\d+$/.test(value)) return;
  
  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${value}`);
    const data = await res.json();
    
    if (data[0].Status === 'Success') {
      const post = data[0].PostOffice[0];
      const area = post.Name;
      const city = post.District;
      const stateVal = post.State;
      
      if (!qState.answers.fullAddress) qState.answers.fullAddress = {};
      
      // Auto-fill city if empty
      const cityInput = document.getElementById('q_fullAddress_city');
      if (cityInput && !cityInput.value) {
        cityInput.value = city;
        qState.answers.fullAddress.city = city;
      }
      
      // Auto-fill state if empty
      const stateInput = document.getElementById('q_fullAddress_state');
      if (stateInput && !stateInput.value) {
        stateInput.value = stateVal;
        qState.answers.fullAddress.state = stateVal;
      }
      
      // Auto-fill area if empty
      const areaInput = document.getElementById('q_fullAddress_area');
      if (areaInput && !areaInput.value) {
        areaInput.value = area;
        qState.answers.fullAddress.area = area;
      }
      
      const resultEl = document.getElementById('addressPincodeResult');
      if (resultEl) {
        resultEl.innerHTML = `
          <div style="font-size: 13px; color: #4CAF50; margin-top: 6px;">
            📍 ${area}, ${city}, ${stateVal}
          </div>`;
      }
      
      checkCanProceed();
    } else {
      const resultEl = document.getElementById('addressPincodeResult');
      if (resultEl) {
        resultEl.innerHTML = `
          <div style="font-size: 13px; color: #e74c3c; margin-top: 6px;">Invalid pincode</div>`;
      }
    }
  } catch (err) {
    console.error('Address pincode lookup error:', err);
  }
}

// ─── PINCODE LOOKUP FOR CLIENT ONLINE LOCATION ───
async function lookupClientLocationPincode(value) {
  if (value.length !== 6 || !/^\d+$/.test(value)) return;
  
  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${value}`);
    const data = await res.json();
    
    if (data[0].Status === 'Success') {
      const post = data[0].PostOffice[0];
      const area = post.Name;
      const city = post.District;
      const stateVal = post.State;
      
      if (!qState.answers.clientLocation) qState.answers.clientLocation = {};
      
      // Auto-fill city if empty
      const cityInput = document.getElementById('q_clientLocation_city');
      if (cityInput && !cityInput.value) {
        cityInput.value = city;
        qState.answers.clientLocation.city = city;
      }
      
      // Auto-fill state if empty
      const stateInput = document.getElementById('q_clientLocation_state');
      if (stateInput && !stateInput.value) {
        stateInput.value = stateVal;
        qState.answers.clientLocation.state = stateVal;
      }
      
      const resultEl = document.getElementById('clientLocationPincodeResult');
      if (resultEl) {
        resultEl.innerHTML = `
          <div style="font-size: 13px; color: #4CAF50; margin-top: 6px;">
            📍 ${area}, ${city}, ${stateVal}
          </div>`;
      }
      
      checkCanProceed();
    } else {
      const resultEl = document.getElementById('clientLocationPincodeResult');
      if (resultEl) {
        resultEl.innerHTML = `
          <div style="font-size: 13px; color: #e74c3c; margin-top: 6px;">Invalid pincode</div>`;
      }
    }
  } catch (err) {
    console.error('Client location pincode lookup error:', err);
  }
}
// ─── EXPERT SEARCH AUTOCOMPLETE ───
const SEARCH_SUGGESTIONS = {
  services: [
    { label: 'ITR Filing', value: 'itr', type: 'service' },
    { label: 'GST Services', value: 'gst', type: 'service' },
    { label: 'Accounting', value: 'accounting', type: 'service' },
    { label: 'Audit', value: 'audit', type: 'service' },
    { label: 'Photography', value: 'photography', type: 'service' },
    { label: 'Development', value: 'development', type: 'service' }
  ]
};

let searchTimeout = null;

function handleExpertSearch(value) {
  clearTimeout(searchTimeout);
  if (!value || value.length < 2) {
    hideSearchSuggestions();
    if (!value) loadExperts();
    return;
  }
  showSearchSuggestions(value);
  searchTimeout = setTimeout(() => {
    loadExperts({ location: value });
  }, 500);
}

function showSearchSuggestions(value) {
  const el = document.getElementById('searchSuggestions');
  if (!el) return;
  const lower = value.toLowerCase();
  const suggestions = [];

  SEARCH_SUGGESTIONS.services.forEach(s => {
    if (s.label.toLowerCase().includes(lower)) suggestions.push(s);
  });

  const cities = [...new Set(
    (state.experts || []).map(e => e.location?.city || e.profile?.city).filter(Boolean)
  )];
  cities.forEach(city => {
    if (city.toLowerCase().includes(lower))
      suggestions.push({ label: city, value: city, type: 'city' });
  });

  const pincodes = [...new Set(
    (state.experts || []).map(e => e.location?.pincode || e.profile?.pincode).filter(Boolean)
  )];
  pincodes.forEach(pin => {
    if (pin.includes(value))
      suggestions.push({ label: pin, value: pin, type: 'pincode' });
  });

  if (!suggestions.length) { hideSearchSuggestions(); return; }

  const icons = { service: '🔧', city: '🏙️', pincode: '📍' };
  const labels = { service: 'Service', city: 'City', pincode: 'Pincode' };

  el.innerHTML = suggestions.slice(0, 6).map(s => `
    <div onclick="selectSearchSuggestion('${s.value}','${s.type}')"
      style="padding:12px 16px;cursor:pointer;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--border);"
      onmouseover="this.style.background='#f5f5f5'" onmouseout="this.style.background='transparent'">
      <span style="font-size:18px;">${icons[s.type]}</span>
      <div>
        <div style="font-size:14px;font-weight:600;">${s.label}</div>
        <div style="font-size:11px;color:#888;">${labels[s.type]}</div>
      </div>
    </div>
  `).join('');
  el.style.display = 'block';
}

function selectSearchSuggestion(value, type) {
  const input = document.getElementById('expertSearchInput');
  if (input) input.value = value;
  hideSearchSuggestions();
  if (type === 'service') {
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    document.querySelector(`[data-service="${value}"]`)?.classList.add('active');
    loadExperts({ service: value });
  } else {
    loadExperts({ location: value });
  }
}

function hideSearchSuggestions() {
  const el = document.getElementById('searchSuggestions');
  if (el) el.style.display = 'none';
}
// ─── LANDING SEARCH ───
function landingSearch() {
  const service = document.getElementById('landingServiceInput')?.value.trim().toLowerCase();
  const location = document.getElementById('landingLocationInput')?.value.trim();

  const serviceMap = {
    'itr': 'itr', 'itr filing': 'itr', 'tax': 'itr',
    'gst': 'gst', 'gst services': 'gst',
    'accounting': 'accounting', 'bookkeeping': 'accounting',
    'audit': 'audit',
    'photography': 'photography', 'photo': 'photography',
    'development': 'development', 'dev': 'development', 'web': 'development'
  };

  const mappedService = serviceMap[service] || null;

  // Store so findProfessionals page can pick it up
  state.pendingSearch = { service: mappedService, location: location || null };

  showPage('findProfessionals');
}
// ═══════════════════════════════════════════════════════════
//  USER SUPPORT TICKET SYSTEM
// ═══════════════════════════════════════════════════════════

var _tkUserSelectedIssue = null;

var USER_TICKET_CATEGORIES = {
  expert: [
    { group: '🔐 Account & Login Issues', items: ['Unable to login', 'Forgot password / OTP not received', 'Account locked / suspended', 'Change phone/email', 'Delete account request', 'Profile update issue'] },
    { group: '💬 Expert Interaction Issues', items: ['Expert not responding', 'Received too many responses', 'Harassment / inappropriate behavior', 'Expert asking payment outside platform', 'Expert details incorrect', 'Fake expert suspected'] },
    { group: '💰 Payment & Refund Issues', items: ['Payment failed but amount deducted', 'Refund not received', 'Wrong charge applied', 'Payment confirmation not received', 'Need invoice / receipt', 'Payment method issue'] },
    { group: '⭐ Review & Rating Issues', items: ['Want to edit/remove review', 'Fake review posted about me', 'Rating incorrect'] },
    { group: '⚙️ Technical Issues', items: ['App/website not working', 'Page loading error', 'Feature not functioning', 'Bug report', 'Mobile app issue'] },
    { group: '❓ General Support', items: ['Need help using platform', 'Feature request', 'Feedback / suggestions', 'Other issue'] }
  ],
  client: [
    { group: '🔐 Account & Login Issues', items: ['Unable to login', 'Forgot password / OTP not received', 'Account locked / suspended', 'Change phone/email', 'Delete account request', 'Profile update issue'] },
    { group: '📋 Request / Job Issues', items: ['Unable to post request', 'Edit request issue', 'Request not visible to experts', 'Wrong category selected', 'Duplicate request created', 'Want to cancel request', 'Request marked completed incorrectly', 'Spam responses received'] },
    { group: '💬 Expert Interaction Issues', items: ['Expert not responding', 'Received too many responses', 'Harassment / inappropriate behavior', 'Expert asking payment outside platform', 'Expert details incorrect', 'Fake expert suspected'] },
    { group: '💰 Payment & Refund Issues', items: ['Payment failed but amount deducted', 'Refund not received', 'Wrong charge applied', 'Payment confirmation not received', 'Need invoice / receipt', 'Payment method issue'] },
    { group: '⭐ Review & Rating Issues', items: ['Unable to submit review', 'Want to edit/remove review', 'Fake review posted about me', 'Rating incorrect'] },
    { group: '🛡️ Safety & Abuse', items: ['Report fraud/scam', 'Threatening behavior', 'Privacy concern', 'Unauthorized use of my data'] },
    { group: '⚙️ Technical Issues', items: ['App/website not working', 'Page loading error', 'Feature not functioning', 'Bug report', 'Mobile app issue'] },
    { group: '❓ General Support', items: ['Need help using platform', 'Feature request', 'Feedback / suggestions', 'Other issue'] }
  ]
};

function openTicketModal() {
  _tkUserSelectedIssue = null;
  var role = state.user && state.user.role === 'expert' ? 'expert' : 'client';
  var cats = USER_TICKET_CATEGORIES[role] || USER_TICKET_CATEGORIES.client;

  // Build category list
  var html = '';
  cats.forEach(function(cat) {
    html += '<div style="font-size:11px; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.08em; padding:10px 4px 6px;">' + cat.group + '</div>';
    cat.items.forEach(function(item) {
      html += '<div class="tk-user-item" onclick="tkUserSelectIssue(this, \'' + item.replace(/'/g, "\\'") + '\')" style="padding:12px 14px; border:1.5px solid var(--border); border-radius:10px; cursor:pointer; font-size:14px; font-weight:500; color:var(--text); margin-bottom:6px; transition:all 0.2s;">' + item + '</div>';
    });
  });

  document.getElementById('tkUserCatList').innerHTML = html;
  document.getElementById('tkUserStep1').style.display = 'block';
  document.getElementById('tkUserStep2').style.display = 'none';
  document.getElementById('ticketModal').style.display = 'block';
  document.body.style.overflow = 'hidden';
}

function tkUserSelectIssue(el, issue) {
  _tkUserSelectedIssue = issue;
  document.getElementById('tkUserSelectedCat').textContent = issue;
  document.getElementById('tkUserDescription').value = '';
  document.getElementById('tkUserDescription').placeholder = 'Describe your issue: "' + issue + '"...';
  document.getElementById('tkUserStep1').style.display = 'none';
  document.getElementById('tkUserStep2').style.display = 'block';
}

function tkUserGoBack() {
  _tkUserSelectedIssue = null;
  document.getElementById('tkUserStep1').style.display = 'block';
  document.getElementById('tkUserStep2').style.display = 'none';
}

function closeTicketModal() {
  document.getElementById('ticketModal').style.display = 'none';
  document.body.style.overflow = '';
  _tkUserSelectedIssue = null;
}

async function submitUserTicket() {
  if (!_tkUserSelectedIssue) { showToast('Please select an issue category', 'error'); return; }

  var description = document.getElementById('tkUserDescription').value.trim();
  var priority = document.getElementById('tkUserPriority').value;

  var btn = document.getElementById('tkUserSubmitBtn');
  btn.disabled = true;
  btn.textContent = 'Submitting...';

  try {
    var res = await fetch(API_URL + '/users/tickets', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + state.token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        subject: _tkUserSelectedIssue,
        issueType: _tkUserSelectedIssue,
        description: description || _tkUserSelectedIssue,
        priority: priority
      })
    });

    var data = await res.json();
    btn.disabled = false;
    btn.textContent = '🎫 Submit Ticket';

    if (data.success) {
      closeTicketModal();
      showToast('Ticket raised successfully! We\'ll get back to you soon.', 'success');
    } else {
      showToast(data.message || 'Failed to raise ticket', 'error');
    }
  } catch (err) {
    btn.disabled = false;
    btn.textContent = '🎫 Submit Ticket';
    showToast('Network error. Please try again.', 'error');
  }
}

async function loadMyTickets() {
  var container = document.getElementById('myTicketsList');
  if (!container) return;

  try {
    var res = await fetch(API_URL + '/users/tickets', {
      headers: { 'Authorization': 'Bearer ' + state.token }
    });
    var data = await res.json();

    if (!data.success || !data.tickets || !data.tickets.length) {
      container.innerHTML = '<div style="text-align:center; padding:40px;"><div style="font-size:48px; margin-bottom:16px;">🎫</div><h3 style="color:var(--text);">No tickets yet</h3><p style="color:var(--text-muted); margin-top:8px;">Raise a ticket if you need help</p><button class="btn-primary" style="margin-top:20px; padding:12px 24px;" onclick="openTicketModal()">+ Raise a Ticket</button></div>';
      return;
    }

    var statusColor = { open: '#3b82f6', pending_review: '#f59e0b', resolved: '#22c55e', closed: '#6b7280' };
    var statusLabel = { open: 'Open', pending_review: 'Under Review', resolved: 'Resolved', closed: 'Closed' };

    container.innerHTML = data.tickets.map(function(t) {
      var sc = statusColor[t.status] || '#6b7280';
      var sl = statusLabel[t.status] || t.status;
      var date = t.createdAt ? new Date(t.createdAt).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }) : '-';
      return '<div style="background:var(--bg); border:1.5px solid var(--border); border-radius:14px; padding:16px; margin-bottom:12px;">' +
        '<div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">' +
          '<div style="font-size:15px; font-weight:700; color:var(--text); flex:1; margin-right:12px;">' + (t.issueType || t.subject || 'Support Ticket') + '</div>' +
          '<span style="padding:4px 10px; border-radius:20px; font-size:12px; font-weight:700; background:' + sc + '20; color:' + sc + ';">' + sl + '</span>' +
        '</div>' +
        (t.description && t.description !== t.subject ? '<p style="font-size:13px; color:var(--text-muted); margin-bottom:8px; line-height:1.5;">' + t.description.substring(0, 100) + (t.description.length > 100 ? '...' : '') + '</p>' : '') +
        '<div style="display:flex; justify-content:space-between; align-items:center;">' +
          '<span style="font-size:12px; color:var(--text-muted);">' + date + '</span>' +
          (t.adminNote ? '<span style="font-size:12px; color:#22c55e;">💬 Admin replied</span>' : '') +
        '</div>' +
        (t.adminNote ? '<div style="margin-top:10px; padding:10px; background:var(--bg-gray); border-radius:8px; font-size:13px; color:var(--text);"><strong>Admin:</strong> ' + t.adminNote + '</div>' : '') +
      '</div>';
    }).join('');
  } catch (err) {
    container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);">Failed to load tickets</div>';
  }
}

// Close modal when clicking backdrop
var ticketModalEl = document.getElementById('ticketModal');
if (ticketModalEl) {
  ticketModalEl.addEventListener('click', function(e) {
    if (e.target === this) closeTicketModal();
  });
}
// ═══════════════════════════════════════════════════════════
//  CLIENT EXPLORE TAB — HIRE / SHORTLIST / BLOCK
// ═══════════════════════════════════════════════════════════

var _clientExploreAll = [];       // all loaded experts
var _clientShortlisted = [];      // shortlisted expert IDs
var _clientBlocked = [];          // blocked expert IDs (local)
var _blockTargetId = null;
var _blockTargetName = null;
var _exploreFilter = 'all';

// ─── CLIENT INVITES TAB ───
async function loadClientInvites() {
  const container = document.getElementById('clientInvitesList');
  if (!container) return;

  container.innerHTML = '<div style="text-align:center;padding:40px;"><div class="spinner"></div></div>';

  try {
    const res = await fetch(`${API_URL}/users/my-invites`, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    const data = await res.json();

    if (!data.success || !data.invites || !data.invites.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📨</div>
          <h3 class="empty-title">No invites sent yet</h3>
          <p class="empty-text">Hire an expert from All Experts — they'll appear here with their response status</p>
        </div>`;
      return;
    }

    container.innerHTML = data.invites.map(inv => {
      const status = inv.unlocked ? 'accepted' : 'pending';
      const statusColor = inv.unlocked ? '#22c55e' : '#f59e0b';
      const statusBg = inv.unlocked ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)';
      const statusLabel = inv.unlocked ? '✅ Accepted' : '⏳ Pending';
      const expert = inv.expert || {};

      return `
        <div style="background:var(--bg); border:1.5px solid var(--border); border-radius:14px; padding:16px; margin-bottom:12px;">
          <div style="display:flex; align-items:center; gap:12px; margin-bottom:10px;">
            <div style="width:48px; height:48px; border-radius:50%; background:var(--primary); color:#fff; font-size:18px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; overflow:hidden;">
              ${expert.profilePhoto ? `<img src="${expert.profilePhoto}" style="width:100%;height:100%;object-fit:cover;">` : (expert.name || 'E').charAt(0).toUpperCase()}
            </div>
            <div style="flex:1;">
              <div style="font-size:15px; font-weight:700; color:var(--text);">${expert.name || 'Expert'}</div>
              <div style="font-size:12px; color:var(--text-muted);">${expert.specialization || ''}</div>
            </div>
            <span style="padding:4px 12px; border-radius:20px; font-size:12px; font-weight:700; background:${statusBg}; color:${statusColor};">${statusLabel}</span>
          </div>
          <div style="font-size:12px; color:var(--text-muted); padding-top:8px; border-top:1px solid var(--border);">
            📅 Sent ${formatDate(inv.createdAt)}
            <span style="margin-left:12px; color:${statusColor};">
              ${inv.unlocked ? 'Expert has viewed your contact details' : 'Waiting for expert to respond'}
            </span>
          </div>
          ${inv.unlocked && !inv.completed ? `
  <button onclick="confirmInviteComplete('${inv._id}', '${inv.expert?._id || ''}', '${(inv.expert?.name || 'Expert').replace(/'/g, '')}')"
    style="width:100%; margin-top:10px; padding:10px; border:1.5px solid #4CAF50; border-radius:10px; background:transparent; color:#4CAF50; font-size:13px; font-weight:600; cursor:pointer;">
    ✓ Service Received?
  </button>
` : inv.completed ? `
  <div style="width:100%; margin-top:10px; padding:10px; border-radius:10px; background:#f0fff4; color:#4CAF50; font-size:13px; font-weight:600; text-align:center;">
    ✅ Service Completed
  </div>
` : ''}
        </div>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);">Failed to load invites</div>';
  }
}
// ─── LOAD EXPLORE PAGE ───
async function loadClientExplorePage() {
  const grid = document.getElementById('clientExploreGrid');
  const empty = document.getElementById('clientExploreEmpty');
  if (!grid) return;
  
  grid.innerHTML = '<div style="text-align:center;padding:40px;"><div class="spinner"></div></div>';
  if (empty) empty.style.display = 'none';
  
  try {
    // Load blocked list from localStorage (persisted locally)
    _clientBlocked = JSON.parse(localStorage.getItem('blockedExperts_' + state.user._id) || '[]');
    
    // Load shortlisted
    const slRes = await fetch(`${API_URL}/users/shortlisted`, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    const slData = await slRes.json();
    if (slData.success) {
      _clientShortlisted = (slData.experts || []).map(e => e._id || e);
    }
    
    // Load experts
    const res = await fetch(`${API_URL}/users/experts?limit=50`, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    const data = await res.json();
    
    if (data.success) {
      // Filter out blocked
      _clientExploreAll = (data.experts || []).filter(e => 
        !_clientBlocked.includes(e._id)
      );
      renderClientExploreGrid(_clientExploreAll);
    }
  } catch (err) {
    console.error('Load explore error:', err);
    if (grid) grid.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);">Failed to load experts</div>';
  }
}

// ─── FILTER (all / shortlisted) ───
function filterClientExplore(filter) {
  _exploreFilter = filter;
  
  const allBtn = document.getElementById('exploreFilterAll');
  const slBtn = document.getElementById('exploreFilterShortlisted');
  const invBtn = document.getElementById('exploreFilterInvites');
  const searchBar = document.getElementById('exploreSearchBar');
  const grid = document.getElementById('clientExploreGrid');
  const empty = document.getElementById('clientExploreEmpty');
  const invPanel = document.getElementById('clientInvitesPanel');

  // Update button styles
  [
    { btn: allBtn, active: filter === 'all' },
    { btn: slBtn, active: filter === 'shortlisted' },
    { btn: invBtn, active: filter === 'invites' }
  ].forEach(({ btn, active }) => {
    if (!btn) return;
    btn.style.background = active ? 'var(--primary)' : 'transparent';
    btn.style.color = active ? '#fff' : 'var(--text)';
    btn.style.borderColor = active ? 'var(--primary)' : 'var(--border)';
  });

  if (filter === 'invites') {
    // Show invites panel, hide grid
    if (searchBar) searchBar.style.display = 'none';
    if (grid) grid.style.display = 'none';
    if (empty) empty.style.display = 'none';
    if (invPanel) invPanel.style.display = 'block';
    loadClientInvites();
  } else {
    // Show grid, hide invites
    if (searchBar) searchBar.style.display = 'flex';
    if (grid) grid.style.display = 'block';
    if (invPanel) invPanel.style.display = 'none';

    if (filter === 'shortlisted') {
      const shortlisted = _clientExploreAll.filter(e => _clientShortlisted.includes(e._id));
      renderClientExploreGrid(shortlisted);
    } else {
      renderClientExploreGrid(_clientExploreAll);
    }
  }
}

// ─── SEARCH ───
function searchClientExperts(value) {
  if (!value.trim()) {
    filterClientExplore(_exploreFilter);
    return;
  }
  const lower = value.toLowerCase();
  const filtered = _clientExploreAll.filter(e =>
    (e.name || '').toLowerCase().includes(lower) ||
    (e.specialization || '').toLowerCase().includes(lower) ||
    (e.profile?.specialization || '').toLowerCase().includes(lower) ||
    (e.location?.city || '').toLowerCase().includes(lower) ||
    (e.profile?.city || '').toLowerCase().includes(lower)
  );
  renderClientExploreGrid(filtered);
}

// ─── RENDER GRID ───
function renderClientExploreGrid(experts) {
  const grid = document.getElementById('clientExploreGrid');
  const empty = document.getElementById('clientExploreEmpty');
  if (!grid) return;
  
  if (!experts || !experts.length) {
    grid.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';
  
  grid.innerHTML = experts.map(expert => {
    const profile = expert.profile || {};
    const name = expert.name || 'Expert';
    const spec = profile.specialization || expert.specialization || 'Professional';
    const city = profile.city || expert.location?.city || '';
    const rating = expert.rating || 0;
    const reviews = expert.reviewCount || 0;
    const photo = expert.profilePhoto;
    const isShortlisted = _clientShortlisted.includes(expert._id);
    const bio = profile.bio || expert.bio || '';
    
    return `
      <div style="background:var(--bg); border:1.5px solid var(--border); border-radius:14px; padding:18px; margin-bottom:14px;">
        
        <!-- Header -->
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
          <div style="width:52px; height:52px; border-radius:50%; background:var(--primary); color:#fff; font-size:20px; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; overflow:hidden;">
            ${photo ? `<img src="${photo}" style="width:100%;height:100%;object-fit:cover;">` : name.charAt(0).toUpperCase()}
          </div>
          <div style="flex:1; min-width:0;">
            <div style="font-size:16px; font-weight:700; color:var(--text);">${name}</div>
            <div style="font-size:13px; color:var(--primary); font-weight:600;">${spec}</div>
            ${city ? `<div style="font-size:12px; color:var(--text-muted);">📍 ${city}</div>` : ''}
          </div>
          <div style="text-align:right;">
            <div style="font-size:14px; font-weight:700; color:var(--text);">⭐ ${rating ? parseFloat(rating).toFixed(1) : '—'}</div>
            <div style="font-size:11px; color:var(--text-muted);">${reviews} reviews</div>
          </div>
        </div>
        
        <!-- Bio -->
        ${bio ? `<p style="font-size:13px; color:var(--text-light); line-height:1.5; margin-bottom:12px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">${bio}</p>` : ''}
        
        <!-- Action Buttons -->
        <div style="display:flex; flex-direction:column; gap:8px;">
          
          <!-- View Profile -->
          <button onclick="viewExpertProfile('${expert._id}')"
            style="width:100%; padding:10px; border:1.5px solid var(--border); border-radius:10px; background:transparent; color:var(--text); font-size:13px; font-weight:600; cursor:pointer;">
            👤 View Profile
          </button>
          
          <!-- 3 action buttons -->
          <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px;">
            
            <button onclick="hireExpert('${expert._id}', '${name.replace(/'/g, '')}')"
              style="padding:10px 6px; border:none; border-radius:10px; background:#22c55e; color:#fff; font-size:12px; font-weight:700; cursor:pointer; text-align:center; line-height:1.3;">
              ✅ Hire
            </button>
            
            <button id="sl_${expert._id}" onclick="shortlistExpert('${expert._id}', '${name.replace(/'/g, '')}')"
              style="padding:10px 6px; border:1.5px solid ${isShortlisted ? '#e74c3c' : 'var(--border)'}; border-radius:10px; background:${isShortlisted ? 'rgba(231,76,60,0.1)' : 'transparent'}; color:${isShortlisted ? '#e74c3c' : 'var(--text)'}; font-size:12px; font-weight:700; cursor:pointer; text-align:center; line-height:1.3;">
              ${isShortlisted ? '❤️ Saved' : '🤍 Save'}
            </button>
            
            <button onclick="openBlockModal('${expert._id}', '${name.replace(/'/g, '')}')"
              style="padding:10px 6px; border:1.5px solid var(--border); border-radius:10px; background:transparent; color:var(--text-muted); font-size:12px; font-weight:600; cursor:pointer; text-align:center; line-height:1.3;">
              ❌ Block
            </button>
            
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ─── HIRE EXPERT ───
async function hireExpert(expertId, expertName) {
  // Show confirmation
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1002;padding:20px;';
  modal.onclick = e => { if (e.target === modal) modal.remove(); };
  
  modal.innerHTML = `
    <div style="background:var(--bg);border-radius:16px;max-width:360px;width:100%;padding:28px;text-align:center;">
      <div style="font-size:48px;margin-bottom:12px;">✅</div>
      <h3 style="font-size:18px;font-weight:700;margin-bottom:8px;">Hire ${expertName}?</h3>
      <p style="font-size:14px;color:var(--text-muted);margin-bottom:20px;line-height:1.5;">
        We'll notify this expert that you're interested in hiring them. They can spend credits to see your contact details.
      </p>
      <p style="font-size:13px;color:var(--text-muted);padding:10px;background:var(--bg-gray);border-radius:8px;margin-bottom:20px;">
        Your contact will show as:<br>
        <strong>📞 ${maskPhone(state.user.phone || '9999999999')}</strong><br>
        <strong>✉️ ${maskEmail(state.user.email || 'you@email.com')}</strong>
      </p>
      <div style="display:flex;gap:10px;">
        <button onclick="confirmHireExpert('${expertId}'); this.closest('[style*=fixed]').remove();"
          style="flex:1;padding:14px;background:#22c55e;color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;">
          ✅ Yes, Notify
        </button>
        <button onclick="this.closest('[style*=fixed]').remove()"
          style="flex:1;padding:14px;border:1.5px solid var(--border);border-radius:12px;background:transparent;color:var(--text);font-size:14px;font-weight:600;cursor:pointer;">
          Cancel
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

async function confirmHireExpert(expertId) {
  try {
    const res = await fetch(`${API_URL}/users/${expertId}/interest`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${state.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ type: 'hire' })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Expert notified! They will reach out soon.', 'success');
    } else {
      showToast(data.message || 'Failed', 'error');
    }
  } catch (err) {
    showToast('Network error', 'error');
  }
}

// ─── SHORTLIST EXPERT ───
async function shortlistExpert(expertId, expertName) {
  try {
    const isCurrentlyShortlisted = _clientShortlisted.includes(expertId);
    
    const res = await fetch(`${API_URL}/users/${expertId}/interest`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${state.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ type: 'shortlist' })
    });
    const data = await res.json();
    
    if (data.success) {
      if (isCurrentlyShortlisted) {
        _clientShortlisted = _clientShortlisted.filter(id => id !== expertId);
        showToast('Removed from shortlist', 'info');
      } else {
        _clientShortlisted.push(expertId);
        showToast(`${expertName} shortlisted!`, 'success');
      }
      // Re-render to update heart button
      filterClientExplore(_exploreFilter);
    }
  } catch (err) {
    showToast('Network error', 'error');
  }
}

// ─── BLOCK / REPORT ───
function openBlockModal(expertId, expertName) {
  _blockTargetId = expertId;
  _blockTargetName = expertName;
  
  const modal = document.getElementById('blockReportModal');
  document.getElementById('blockModalName').textContent = expertName;
  
  // Show/hide reason box based on selection
  document.querySelectorAll('input[name="blockType"]').forEach(radio => {
    radio.addEventListener('change', function() {
      const reasonBox = document.getElementById('blockReasonBox');
      if (reasonBox) reasonBox.style.display = this.value === 'report' ? 'block' : 'none';
    });
  });
  
  modal.style.display = 'flex';
}

function closeBlockModal() {
  document.getElementById('blockReportModal').style.display = 'none';
  _blockTargetId = null;
  _blockTargetName = null;
}

async function confirmBlock() {
  if (!_blockTargetId) return;
  
  const blockType = document.querySelector('input[name="blockType"]:checked')?.value || 'block';
  const reason = document.getElementById('blockReason')?.value || '';
  const isReport = blockType === 'report';
  
  try {
    const res = await fetch(`${API_URL}/users/${_blockTargetId}/block`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${state.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ report: isReport, reason })
    });
    const data = await res.json();
    
    if (data.success) {
      // Add to local blocked list
      _clientBlocked.push(_blockTargetId);
      localStorage.setItem('blockedExperts_' + state.user._id, JSON.stringify(_clientBlocked));
      
      // Remove from explore grid
      _clientExploreAll = _clientExploreAll.filter(e => e._id !== _blockTargetId);
      filterClientExplore(_exploreFilter);
      
      closeBlockModal();
      showToast(isReport ? 'Expert blocked and reported to admin' : 'Expert blocked', 'success');
    } else {
      showToast(data.message || 'Failed', 'error');
    }
  } catch (err) {
    showToast('Network error', 'error');
  }
}

// ─── MASK HELPERS ───
function maskPhone(phone) {
  const p = String(phone).replace(/\D/g, '');
  if (p.length < 4) return 'XXXXXXXXXX';
  return p.slice(0,2) + 'XXXXXX' + p.slice(-2);
}

function maskEmail(email) {
  const parts = String(email).split('@');
  if (parts.length < 2) return '****@****.com';
  return parts[0][0] + '****@' + parts[1];
}
// ─── UNLOCK CUSTOMER INTEREST ───
async function unlockInterest(notifId) {
  const btn = event.target;
  btn.disabled = true;
  btn.textContent = '⏳ Unlocking...';

  try {
    const res = await fetch(`${API_URL}/users/unlock-interest/${notifId}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    const data = await res.json();

    if (data.success) {
      showToast(`Unlocked! ${data.creditsSpent} credits spent. ${data.newBalance} remaining.`, 'success');
      // Update credits display
      if (state.user) {
        state.user.credits = data.newBalance;
        localStorage.setItem('user', JSON.stringify(state.user));
        document.querySelectorAll('.credit-display').forEach(el => {
          el.textContent = data.newBalance;
        });
      }
      // Reload to show full details
      loadMyApproaches();
    } else if (data.needCredits) {
      showToast(data.message, 'error');
      btn.disabled = false;
      btn.textContent = '🔓 Unlock for 5 Credits';
      // Open credit purchase modal
      setTimeout(() => openCreditModal(), 500);
    } else {
      showToast(data.message || 'Failed to unlock', 'error');
      btn.disabled = false;
      btn.textContent = '🔓 Unlock for 5 Credits';
    }
  } catch (err) {
    showToast('Network error', 'error');
    btn.disabled = false;
    btn.textContent = '🔓 Unlock for 5 Credits';
  }
}
// ─── VIEW DOCS FROM INTEREST UNLOCK ───
async function viewClientDocumentsFromInterest(clientId) {
  if (!clientId || clientId === 'undefined') { showToast('Client info not available', 'error'); return; }
  
  try {
    showToast('Loading documents...', 'info');
    
    const res = await fetch(`${API_URL}/documents/client/${clientId}/interest`, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    const data = await res.json();
    
    if (!data.success) {
      showToast(data.message || 'Could not load documents', 'error');
      return;
    }
    
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1001;padding:20px;';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    
    const docsHTML = data.documents && data.documents.length > 0 ? data.documents.map(doc => {
      const sizeKB = ((doc.fileSize || 0) / 1024).toFixed(1);
      const icon = doc.fileType === 'pdf' ? '📄' : doc.fileType === 'word' ? '📝' : doc.fileType === 'excel' ? '📊' : doc.fileType === 'image' ? '🖼️' : '📎';
      
      if (doc.hasAccess) {
        return `
          <div style="padding:16px;background:var(--bg-gray);border-radius:12px;margin-bottom:12px;">
            <div style="display:flex;align-items:center;gap:12px;">
              <span style="font-size:32px;">${icon}</span>
              <div style="flex:1;">
                <div style="font-size:15px;font-weight:600;color:var(--text);margin-bottom:2px;">${doc.originalFileName}</div>
                <div style="font-size:13px;color:var(--text-muted);">${sizeKB} KB • ${(doc.fileType||'').toUpperCase()}</div>
                <div style="font-size:12px;color:#4CAF50;margin-top:2px;">✅ Access granted</div>
              </div>
              <button onclick="downloadDocument('${doc._id}')" style="padding:8px 16px;background:var(--primary);color:#fff;border-radius:8px;font-size:13px;font-weight:600;border:none;cursor:pointer;">Download</button>
            </div>
          </div>`;
      } else {
        return `
          <div style="padding:16px;background:var(--bg-gray);border-radius:12px;margin-bottom:12px;">
            <div style="display:flex;align-items:center;gap:12px;">
              <span style="font-size:32px;filter:grayscale(1);opacity:0.5;">${icon}</span>
              <div style="flex:1;">
                <div style="font-size:15px;font-weight:600;color:var(--text);margin-bottom:2px;">${doc.originalFileName}</div>
                <div style="font-size:13px;color:var(--text-muted);">${sizeKB} KB • ${(doc.fileType||'').toUpperCase()}</div>
                <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">🔒 Access required</div>
              </div>
              <button onclick="requestDocumentAccessFromInterest('${doc._id}', '${clientId}')" style="padding:8px 12px;background:var(--primary);color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;">Request</button>
            </div>
          </div>`;
      }
    }).join('') : `
      <div style="text-align:center;padding:40px;">
        <div style="font-size:48px;margin-bottom:16px;">📁</div>
        <h3 style="font-size:18px;font-weight:600;color:var(--text);margin-bottom:8px;">No documents yet</h3>
        <p style="font-size:14px;color:var(--text-muted);">Client hasn't uploaded any documents</p>
      </div>`;
    
    modal.innerHTML = `
      <div style="background:var(--bg);border-radius:16px;max-width:500px;width:100%;max-height:80vh;overflow-y:auto;padding:24px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
          <h2 style="font-size:20px;font-weight:700;color:var(--text);">Client Documents</h2>
          <button onclick="this.closest('[style*=fixed]').remove()" style="border:none;background:none;font-size:24px;cursor:pointer;">×</button>
        </div>
        <div style="padding:12px;background:rgba(252,128,25,0.1);border-radius:8px;margin-bottom:20px;font-size:13px;color:var(--text-muted);">
          🔒 Documents require client approval before you can download them
        </div>
        ${docsHTML}
      </div>`;
    
    document.body.appendChild(modal);
  } catch (err) {
    console.error('View docs from interest error:', err);
    showToast('Could not load documents', 'error');
  }
}
async function requestDocumentAccessFromInterest(documentId, clientId) {
  try {
    const res = await fetch(`${API_URL}/documents/${documentId}/request-access`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${state.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message: 'I would like to access this document.' })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Access request sent to client!', 'success');
      document.querySelectorAll('[style*="position: fixed"]').forEach(m => {
        if (m.style.zIndex === '1001') m.remove();
      });
      viewClientDocumentsFromInterest(clientId);
    } else {
      showToast(data.message || 'Already requested or failed', 'error');
    }
  } catch (err) {
    showToast('Network error', 'error');
  }
}

// ─── MESSAGE CLIENT FROM INTEREST UNLOCK ───
async function messageClientFromInterest(clientId) {
  if (!clientId || clientId === 'undefined') { showToast('Client info not available', 'error'); return; }
  try {
    showToast('Opening chat...', 'info');
    // Use a direct chat endpoint that doesn't require a requestId
    const res = await fetch(`${API_URL}/chats/direct`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${state.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        expertId: state.user._id,
        clientId: clientId
      })
    });
    const data = await res.json();
    if (data.success) {
      document.querySelectorAll('[style*="position: fixed"]').forEach(m => m.remove());
      switchTab('chat');
      openChat(data.chat._id);
    } else {
      showToast(data.message || 'Could not start chat', 'error');
    }
  } catch (err) {
    showToast('Network error', 'error');
  }
}
async function confirmInviteComplete(notifId, expertId, expertName) {
  const confirmed = confirm(`Did ${expertName} complete the service for you?`);
  if (!confirmed) return;

  try {
    const res = await fetch(`${API_URL}/users/invite-complete/${notifId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${state.token}`,
        'Content-Type': 'application/json'
      }
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);

    // Refresh invites first
    loadClientInvites();

    // Open rating modal — set state vars then show modal
    state.ratingExpertId = expertId;
    state.ratingExpertName = expertName;
    state.ratingRequestId = null;
    state.ratingApproachId = null;

    const ratingModal = document.getElementById('ratingModal');
    document.getElementById('ratingExpertName').textContent = expertName;
    ratingModal.dataset.expertId = expertId;
    ratingModal.dataset.approachId = '';
    ratingModal.dataset.requestId = '';
    ratingModal.classList.add('open');
    
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}
// ═══════════════════════════════════════════════════════════
//  PAGINATION SYSTEM v1.0
//  Sections: clientRequests, expertBrowse, expertApproaches, findExperts
//  Style: Numbered pages only | 8 per page
// ═══════════════════════════════════════════════════════════

var PAGINATION = {
  clientRequests:   { page: 1, perPage: 8 },
  expertBrowse:     { page: 1, perPage: 8 },
  expertApproaches: { page: 1, perPage: 8 },
  findExperts:      { page: 1, perPage: 8 },
};

function paginate(items, section) {
  const { page, perPage } = PAGINATION[section];
  const start = (page - 1) * perPage;
  return items.slice(start, start + perPage);
}

function paginationControlsHTML(items, section) {
  const { page, perPage } = PAGINATION[section];
  const totalPages = Math.ceil(items.length / perPage);
  if (totalPages <= 1) return '';

  const start = (page - 1) * perPage + 1;
  const end   = Math.min(page * perPage, items.length);

  // Smart ellipsis: always show first, last, and ±2 around current
  const delta = 2;
  const range = [];
  const rangeWithDots = [];
  let l;

  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - delta && i <= page + delta)) {
      range.push(i);
    }
  }

  for (let i of range) {
    if (l) {
      if (i - l === 2) {
        rangeWithDots.push(l + 1); // fill single gap
      } else if (i - l > 2) {
        rangeWithDots.push('…');
      }
    }
    rangeWithDots.push(i);
    l = i;
  }

  const buttons = rangeWithDots.map(i => {
    if (i === '…') {
      return `<span style="padding:0 6px;color:var(--text-muted);line-height:36px;">…</span>`;
    }
    const isActive = i === page;
    return `
      <button
        onclick="changePage('${section}', ${i})"
        style="
          width:36px;height:36px;
          border:1.5px solid ${isActive ? 'var(--primary)' : 'var(--border)'};
          border-radius:8px;
          background:${isActive ? 'var(--primary)' : 'var(--bg)'};
          color:${isActive ? '#fff' : 'var(--text)'};
          font-size:14px;
          font-weight:${isActive ? '700' : '500'};
          cursor:pointer;
          transition:all 0.15s;
        ">
        ${i}
      </button>`;
  }).join('');

  return `
    <div style="margin-top:24px;padding-top:16px;border-top:1px solid var(--border);">
      <div style="font-size:12px;color:var(--text-muted);text-align:center;margin-bottom:10px;">
        Showing <strong>${start}–${end}</strong> of <strong>${items.length}</strong>
      </div>
      <div style="display:flex;align-items:center;justify-content:center;gap:6px;flex-wrap:wrap;">
        ${buttons}
      </div>
    </div>`;
}

function changePage(section, newPage) {
  const items = getItemsForSection(section);
  const totalPages = Math.ceil(items.length / PAGINATION[section].perPage);
  if (newPage < 1 || newPage > totalPages) return;

  PAGINATION[section].page = newPage;

  const renderers = {
    clientRequests:   renderClientRequests,
    expertBrowse:     renderAvailableRequests,
    expertApproaches: () => renderMyApproaches([]),
    findExperts:      renderExperts,
  };
  if (renderers[section]) renderers[section]();

  const scrollTargets = {
    clientRequests:   'requestsList',
    expertBrowse:     'browseTab',
    expertApproaches: 'approachesList',
    findExperts:      'expertGrid',
  };
  const el = document.getElementById(scrollTargets[section]);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function getItemsForSection(section) {
  const map = {
    clientRequests:   () => state.requests || [],
    expertBrowse:     () => state.availableRequests || [],
    expertApproaches: () => state.myApproaches || [],
    findExperts:      () => state.experts || [],
  };
  return (map[section] || (() => []))();
}
// ─── EXPERT SERVICE FILTER MODAL ───
function showServiceFilterModal(onComplete) {
  const services = [
    { value: 'itr',         label: 'ITR Filing',    icon: '📄' },
    { value: 'gst',         label: 'GST Services',  icon: '🧾' },
    { value: 'accounting',  label: 'Accounting',    icon: '📊' },
    { value: 'audit',       label: 'Audit',         icon: '🔍' },
    { value: 'photography', label: 'Photography',   icon: '📷' },
    { value: 'development', label: 'Development',   icon: '💻' },
  ];

  // Pre-select from profile if available
  const saved = state.user?.profile?.servicesOffered || [];

  const modal = document.createElement('div');
  modal.id = 'serviceFilterModal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:1010;padding:20px;';

  modal.innerHTML = `
    <div style="background:var(--bg);border-radius:20px;max-width:420px;width:100%;padding:28px;">
      <div style="text-align:center;margin-bottom:24px;">
        <div style="font-size:44px;margin-bottom:12px;">🎯</div>
        <h2 style="font-size:20px;font-weight:800;color:var(--text);margin-bottom:8px;">What services do you offer?</h2>
        <p style="font-size:14px;color:var(--text-muted);line-height:1.5;">Select your categories — you'll only see matching client requests in your Browse tab.</p>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:24px;" id="serviceFilterGrid">
        ${services.map(s => {
          const isSelected = saved.includes(s.value);
          return `
            <div onclick="toggleServiceFilter(this, '${s.value}')"
              data-service="${s.value}"
              style="padding:14px 12px;border:2px solid ${isSelected ? 'var(--primary)' : 'var(--border)'};
                     border-radius:12px;cursor:pointer;text-align:center;
                     background:${isSelected ? 'rgba(252,128,25,0.08)' : 'var(--bg)'};
                     transition:all 0.2s;"
              data-selected="${isSelected}">
              <div style="font-size:28px;margin-bottom:6px;">${s.icon}</div>
              <div style="font-size:13px;font-weight:700;color:${isSelected ? 'var(--primary)' : 'var(--text)'};">${s.label}</div>
            </div>`;
        }).join('')}
      </div>

      <div id="serviceFilterError" style="display:none;color:#e74c3c;font-size:13px;text-align:center;margin-bottom:12px;">
        Please select at least one service
      </div>

      <button onclick="confirmServiceFilter()" 
        style="width:100%;padding:15px;background:var(--primary);color:#fff;border:none;border-radius:12px;font-size:16px;font-weight:700;cursor:pointer;margin-bottom:10px;">
        Show Matching Requests →
      </button>

      <button onclick="skipServiceFilter()"
        style="width:100%;padding:12px;background:transparent;border:none;color:var(--text-muted);font-size:13px;cursor:pointer;">
        Skip — show all requests
      </button>
    </div>
  `;

  // Store callback
  modal._onComplete = onComplete;
  document.body.appendChild(modal);
}

function toggleServiceFilter(el, service) {
  const isSelected = el.dataset.selected === 'true';
  el.dataset.selected = !isSelected;
  el.style.borderColor = !isSelected ? 'var(--primary)' : 'var(--border)';
  el.style.background = !isSelected ? 'rgba(252,128,25,0.08)' : 'var(--bg)';
  el.querySelector('div:last-child').style.color = !isSelected ? 'var(--primary)' : 'var(--text)';
  document.getElementById('serviceFilterError').style.display = 'none';
}

function getSelectedServices() {
  return Array.from(document.querySelectorAll('#serviceFilterGrid [data-selected="true"]'))
    .map(el => el.dataset.service);
}

async function confirmServiceFilter() {
  const selected = getSelectedServices();
  if (!selected.length) {
    document.getElementById('serviceFilterError').style.display = 'block';
    return;
  }

  // Save preference to profile
  try {
    const updatedProfile = { ...(state.user.profile || {}), browseServiceFilter: selected };
    await fetch(`${API_URL}/users/profile`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${state.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ profile: updatedProfile })
    });
    state.user.profile = updatedProfile;
    localStorage.setItem('user', JSON.stringify(state.user));
  } catch (err) {
    console.error('Save filter error:', err);
  }

  document.getElementById('serviceFilterModal')?.remove();
  
  // Apply filter to browse
  applyBrowseServiceFilter(selected);
}

function skipServiceFilter() {
  document.getElementById('serviceFilterModal')?.remove();
  // Show all — no filter
  applyBrowseServiceFilter([]);
}

function applyBrowseServiceFilter(services) {
  state.browseServiceFilter = services;
  renderAvailableRequests();
  // Update the filter chips UI in browse tab
  updateBrowseFilterChips(services);
}

function updateBrowseFilterChips(selected) {
  document.querySelectorAll('.browse-filter-chip').forEach(chip => {
    const val = chip.dataset.service;
    const isActive = !selected.length || selected.includes(val) || val === 'all';
    chip.classList.toggle('active', isActive);
    chip.style.background = (val === 'all' ? !selected.length : selected.includes(val))
      ? 'var(--primary)' : 'transparent';
    chip.style.color = (val === 'all' ? !selected.length : selected.includes(val))
      ? '#fff' : 'var(--text)';
    chip.style.borderColor = (val === 'all' ? !selected.length : selected.includes(val))
      ? 'var(--primary)' : 'var(--border)';
  });
}
// ─── BROWSE TAB SERVICE FILTER ───
function setBrowseFilter(service) {
  let activeFilter = state.browseServiceFilter || [];

  if (service === 'all') {
    // Clear all filters — show everything
    activeFilter = [];
  } else {
    if (activeFilter.includes(service)) {
      // Deselect it
      activeFilter = activeFilter.filter(s => s !== service);
    } else {
      // Add it
      activeFilter = [...activeFilter, service];
    }
  }

  state.browseServiceFilter = activeFilter;
  PAGINATION.expertBrowse.page = 1;

  // Re-render chips and requests
  const filterBar = document.getElementById('browseFilterBar');
  if (filterBar) filterBar.innerHTML = renderBrowseFilterChips();
  renderAvailableRequests();
}
// ═══ END OF JAVASCRIPT ═══
