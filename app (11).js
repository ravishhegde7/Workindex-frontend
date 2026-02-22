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
function showPage(pageId) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(page => {
    page.classList.remove('active');
  });
  
  // Show selected page
  const page = document.getElementById(pageId);
  if (page) {
    page.classList.add('active');
    state.currentPage = pageId;
    
    // Load data for specific pages
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
  if (state.user) {
    const dashPage = state.user.role === 'client' ? 'clientDash' : 'expertDash';
    showPage(dashPage);
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
    else if (tabName === 'access') loadAccessRequests();
    else if (tabName === 'ratings') loadMyRatings();
    else if (tabName === 'approaches' && isExpert) loadMyApproaches();
    else if (tabName === 'profile' && isExpert) renderExpertProfile();
    else if (tabName === 'chat') showChatList();  // ✅ works for both roles
  }
}

function showHowItWorks(type) {
  // Toggle between client and expert steps
  const clientSteps = document.getElementById('clientSteps');
  const expertSteps = document.getElementById('expertSteps');
  const buttons = document.querySelectorAll('.auth-toggle button');
  
  if (type === 'client') {
    clientSteps.style.display = 'block';
    expertSteps.style.display = 'none';
    buttons[0].classList.add('active');
    buttons[1].classList.remove('active');
  } else {
    clientSteps.style.display = 'none';
    expertSteps.style.display = 'block';
    buttons[0].classList.remove('active');
    buttons[1].classList.add('active');
  }
}

// ─── AUTHENTICATION ─── 
async function login(email, password) {
  try {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
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
}

function logout() {
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
  window.open(`${API_URL}/documents/${docId}/download`, '_blank');
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


// ─── FIND PROFESSIONALS ─── 
async function loadExperts(filters = {}) {
  const loading = document.getElementById('expertsLoading');
  const grid = document.getElementById('expertGrid');
  const empty = document.getElementById('expertsEmpty');
  
  loading.style.display = 'block';
  grid.innerHTML = '';
  empty.style.display = 'none';
  
  try {
    const params = new URLSearchParams(filters);
    const res = await fetch(`${API_URL}/users/experts?${params}`);
    const data = await res.json();
    
    loading.style.display = 'none';
    
    if (data.success && data.experts.length > 0) {
      state.experts = data.experts;
      renderExperts();
    } else {
      empty.style.display = 'block';
    }
  } catch (error) {
    console.error('Load experts error:', error);
    loading.style.display = 'none';
    empty.style.display = 'block';
  }
}

function renderExperts() {
  const grid = document.getElementById('expertGrid');
  
  grid.innerHTML = state.experts.map(expert => `
    <div class="expert-card" onclick="viewExpertProfile('${expert._id}')">
      <div class="expert-card-header">
        <div class="avatar avatar-lg">
          ${expert.profilePhoto ? 
            `<img src="${expert.profilePhoto}" alt="${expert.name}">` : 
            expert.name.substring(0, 2).toUpperCase()
          }
        </div>
        <div class="expert-card-info">
          <div class="expert-card-name">${expert.name}</div>
          <div class="expert-card-specialty">${expert.specialization || 'Professional'}</div>
        </div>
      </div>
      
      <div class="expert-card-rating">
        <div class="rating-stars">
          ${renderStars(Math.floor(expert.rating || 0))}
        </div>
        <span style="font-size: 14px; color: var(--text-muted);">
          ${expert.rating || '0.0'} (${expert.reviewCount || 0} reviews)
        </span>
      </div>
      
      ${expert.bio ? `
        <div class="expert-card-bio">${expert.bio}</div>
      ` : ''}
      
      ${expert.servicesOffered && expert.servicesOffered.length > 0 ? `
        <div class="expert-card-tags">
          ${expert.servicesOffered.slice(0, 3).map(service => 
            `<span class="badge badge-primary">${service}</span>`
          ).join('')}
        </div>
      ` : ''}
      
      <div class="expert-card-footer">
        ${expert.location ? `
          <div class="expert-location">
            📍 ${expert.location.city || 'India'}
          </div>
        ` : ''}
        <button class="btn-primary" style="padding: 8px 16px; font-size: 14px;">
          View Profile
        </button>
      </div>
    </div>
  `).join('');
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
async function viewExpertProfile(expertId) {
  try {
    const res = await fetch(`${API_URL}/users/expert/${expertId}`, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });
    
    const data = await res.json();
    if (!data.success) { showToast('Could not load profile', 'error'); return; }
    
    const expert = data.expert || data.user;
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

    const locationLabels = {
      online: '💻 Online / Remote only',
      local: '📍 Local (in-person)',
      both: '🌐 Both online & in-person'
    };
    const serviceLabels = {
      itr: 'ITR Filing', gst: 'GST Services',
      accounting: 'Accounting', audit: 'Audit',
      photography: 'Photography', development: 'Development'
    };

    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1001; padding: 20px;';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    modal.innerHTML = `
      <div style="background: var(--bg); border-radius: 16px; max-width: 480px; width: 100%; max-height: 85vh; overflow-y: auto; padding: 24px;">
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h2 style="font-size: 20px; font-weight: 700; color: var(--text);">Expert Profile</h2>
          <button onclick="this.closest('[style*=fixed]').remove()" style="border: none; background: none; font-size: 24px; cursor: pointer; color: var(--text-muted);">×</button>
        </div>
        
        <!-- Avatar + Name -->
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
        </div>
        
        <!-- Stats Row -->
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

        <!-- Services -->
        ${services.length > 0 ? `
          <div style="margin-bottom: 20px;">
            <h4 style="font-size: 14px; font-weight: 700; color: var(--text-muted); margin-bottom: 10px;">SERVICES OFFERED</h4>
            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
              ${services.map(s => `<span style="padding: 6px 12px; background: rgba(252,128,25,0.1); color: var(--primary); border-radius: 20px; font-size: 13px; font-weight: 600;">${serviceLabels[s] || s}</span>`).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Bio -->
        ${bio ? `
          <div style="margin-bottom: 20px;">
            <h4 style="font-size: 14px; font-weight: 700; color: var(--text-muted); margin-bottom: 10px;">ABOUT</h4>
            <p style="font-size: 14px; color: var(--text-light); line-height: 1.6;">${bio}</p>
          </div>
        ` : ''}

        <!-- Company -->
        ${companyName ? `
          <div style="margin-bottom: 20px;">
            <h4 style="font-size: 14px; font-weight: 700; color: var(--text-muted); margin-bottom: 10px;">COMPANY</h4>
            <div style="font-size: 14px; color: var(--text);">🏢 ${companyName}${companySize ? ` · ${companySize} employees` : ''}</div>
            ${hasWebsite && websiteUrl ? `<a href="${websiteUrl}" target="_blank" style="font-size: 13px; color: var(--primary);">🌐 ${websiteUrl}</a>` : ''}
          </div>
        ` : ''}

        <!-- Certifications -->
        ${certifications.length > 0 ? `
          <div style="margin-bottom: 20px;">
            <h4 style="font-size: 14px; font-weight: 700; color: var(--text-muted); margin-bottom: 10px;">CERTIFICATIONS</h4>
            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
              ${certifications.map(c => `<span style="padding: 6px 12px; background: var(--bg-gray); border-radius: 20px; font-size: 13px;">🏅 ${c}</span>`).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Service Location -->
        ${locationType ? `
          <div style="margin-bottom: 20px;">
            <h4 style="font-size: 14px; font-weight: 700; color: var(--text-muted); margin-bottom: 10px;">SERVICE LOCATION</h4>
            <div style="font-size: 14px; color: var(--text);">${locationLabels[locationType] || locationType}</div>
          </div>
        ` : ''}

         <!-- Customer Reviews -->
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
        <button onclick="this.closest('[style*=fixed]').remove()" style="width: 100%; padding: 14px; border: 1.5px solid var(--border); border-radius: 10px; background: transparent; color: var(--text); font-size: 15px; font-weight: 600; cursor: pointer;">Close</button>
      </div>
    `;
    
    document.body.appendChild(modal);
    
  } catch (error) {
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
      body: JSON.stringify({ credits })
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
  
  if (!state.requests || state.requests.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <h3 class="empty-title">No requests yet</h3>
        <p class="empty-text">Click "+ New Request" above to post your first request</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = state.requests.map(req => {
    const statusColors = {
      pending: 'badge-warning',
      active: 'badge-primary',
      completed: 'badge-success',
      cancelled: 'badge-danger'
    };
    
    const statusLabels = {
      pending: 'Pending',
      active: 'Active',
      completed: 'Completed',
      cancelled: 'Cancelled'
    };
    
    // ✅ NEW: Get client name
    const clientName = req.client?.name || state.user?.name || 'You';
    
    return `
      <div class="request-card" style="background: var(--bg); border: 1px solid var(--border); border-radius: 12px; padding: 20px; margin-bottom: 16px; cursor: pointer;" onclick="showRequestDetail('${req._id}')">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
          <div style="flex: 1;">
            <h3 style="font-size: 18px; font-weight: 700; color: var(--text); margin-bottom: 4px;">${req.title}</h3>
            <p style="font-size: 14px; color: var(--text-muted);">${req.service.toUpperCase()}</p>
            <p style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">
              Posted by: <strong>${clientName}</strong>
            </p>
          </div>
          <span class="badge ${statusColors[req.status] || 'badge-warning'}">${statusLabels[req.status] || 'Pending'}</span>
        </div>
        
        <p style="font-size: 14px; color: var(--text-light); margin-bottom: 16px; line-height: 1.5;">${req.description || 'No description'}</p>
        
        <div style="display: flex; gap: 20px; font-size: 13px; color: var(--text-muted);">
          <span>📍 ${req.location || 'Not specified'}</span>
          <span>💰 ₹${req.budget ? req.budget.toLocaleString('en-IN') : 'Not set'}</span>
          <span>👁️ ${req.viewCount || 0} views</span>
        </div>
        
        ${(req.approachCount && req.approachCount > 0) ? `
          <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border);">
            <span style="font-size: 13px; font-weight: 600; color: var(--primary);">${req.approachCount} professional${req.approachCount > 1 ? 's' : ''} approached</span>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
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
  
  // Load available requests for experts
  try {
    const res = await fetch(`${API_URL}/requests/available`, {
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
    console.error('Load expert data error:', error);
  }
  
  switchTab('browse');
}

// ─── RENDER AVAILABLE REQUESTS FOR EXPERTS ───
function renderAvailableRequests() {
  const container = document.getElementById('browseTab');
  if (!container) return;
  
  if (!state.availableRequests || state.availableRequests.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <h3 class="empty-title">No requests available</h3>
        <p class="empty-text">New requests will appear here</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = state.availableRequests.map(req => {
    // ✅ NEW: Calculate approach progress
    const currentApproaches = req.currentApproaches || 0;
    const maxApproaches = req.maxApproaches || 5;
    const progressPercent = (currentApproaches / maxApproaches) * 100;
    const spotsLeft = maxApproaches - currentApproaches;
    
    // Color based on how full it is
    const progressColor = currentApproaches >= 4 ? '#f39c12' : 
                          currentApproaches >= 3 ? '#3498db' : 
                          'var(--primary)';
    
    return `
      <div class="request-card" style="background: var(--bg); border: 1px solid var(--border); border-radius: 12px; padding: 20px; margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
          <div style="flex: 1;">
            <h3 style="font-size: 18px; font-weight: 700; color: var(--text); margin-bottom: 4px;">${req.title}</h3>
<p style="font-size: 14px; color: var(--text-muted);">${req.service.toUpperCase()}</p>
<p style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">👤 <strong>${req.client?.name || 'Client'}</strong></p>
          </div>
          <span class="badge badge-primary">${req.credits || 20} credits</span>
        </div>
        
        <p style="font-size: 14px; color: var(--text-light); margin-bottom: 16px; line-height: 1.5;">${req.description}</p>
        
        <div style="display: flex; gap: 20px; font-size: 13px; color: var(--text-muted); margin-bottom: 12px;">
          <span>📍 ${req.location || 'Online'}</span>
          <span>💰 ₹${req.budget ? req.budget.toLocaleString('en-IN') : 'Budget negotiable'}</span>
          <span>⏱️ ${req.timeline || 'Flexible'}</span>
        </div>
        
        <div style="margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span style="font-size: 13px; font-weight: 600; color: var(--text-muted);">
              👥 Approaches
            </span>
            <span style="font-size: 14px; font-weight: 700; color: ${progressColor};">
              ${currentApproaches}/${maxApproaches}
            </span>
          </div>
          <div style="height: 8px; background: var(--bg-gray); border-radius: 4px; overflow: hidden; margin-bottom: 4px;">
            <div style="height: 100%; width: ${progressPercent}%; background: ${progressColor}; transition: width 0.3s;"></div>
          </div>
          ${currentApproaches >= 4 ? `
            <div style="font-size: 12px; color: #e74c3c; font-weight: 600;">
              ⚠️ Only ${spotsLeft} spot${spotsLeft === 1 ? '' : 's'} left!
            </div>
          ` : currentApproaches >= 3 ? `
            <div style="font-size: 12px; color: #f39c12;">
              ${spotsLeft} spots remaining
            </div>
          ` : ''}
        </div>
        
        <div style="display: flex; gap: 12px;">
          <button onclick="showExpertRequestDetail('${req._id}')" style="flex: 1; padding: 12px; border: 1.5px solid var(--primary); border-radius: 10px; background: transparent; color: var(--primary); font-size: 14px; font-weight: 600; cursor: pointer;">View Details</button>
          <button onclick="approachClient('${req._id}')" style="flex: 1; padding: 12px; border: none; border-radius: 10px; background: var(--primary); color: #fff; font-size: 14px; font-weight: 700; cursor: pointer;">Approach Client</button>
        </div>
      </div>
    `;
  }).join('');
}

// ─── SHOW REQUEST DETAIL FOR EXPERT ───
async function showExpertRequestDetail(requestId) {
  const req = state.availableRequests.find(r => r._id === requestId);
  if (!req) return;
  
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
async function approachClient(requestId) {
  if (!confirm('Spend credits to approach this client?')) return;
  
  try {
    const res = await fetch(`${API_URL}/approaches`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${state.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        request: requestId,
        message: 'I am interested in helping with your request.'
      })
    });
    
    const data = await res.json();
    
    if (data.success) {
      showToast('Approach sent successfully!', 'success');
      loadExpertData(); // Refresh available requests
      loadExpertCredits(); // Update credits
    } else {
      showToast(data.message || 'Failed to send approach', 'error');
    }
  } catch (error) {
    console.error('Approach error:', error);
    showToast('Failed to send approach', 'error');
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
        <p style="font-size: 14px; color: var(--text-light); margin-bottom: 12px;">${app.message}</p>
        <div style="display: flex; gap: 8px;">
          <button onclick="viewExpertProfile('${expert._id}')" style="flex: 1; padding: 10px; border: 1.5px solid var(--primary); border-radius: 8px; background: transparent; color: var(--primary); font-size: 13px; font-weight: 600; cursor: pointer;">View Profile</button>
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
    const res = await fetch(`${API_URL}/approaches`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${state.token}`
      }
    });
    
    const data = await res.json();
    
    if (data.success) {
      state.myApproaches = data.approaches || [];
      renderMyApproaches();
    }
  } catch (error) {
    console.error('Load my approaches error:', error);
  }
}

// ─── RENDER EXPERT'S APPROACHES ───
function renderMyApproaches() {
  const container = document.getElementById('approachesTab');
  if (!container) return;
  
  if (!state.myApproaches || state.myApproaches.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">💼</div>
        <h3 class="empty-title">No approaches yet</h3>
        <p class="empty-text">Approach requests to see them here</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = state.myApproaches.map(app => {
    const req = app.request;
    const statusColors = {
      pending: 'badge-warning',
      accepted: 'badge-success',
      rejected: 'badge-danger'
    };
    
    return `
      <div class="request-card" style="background: var(--bg); border: 1px solid var(--border); border-radius: 12px; padding: 20px; margin-bottom: 16px; cursor: pointer;" onclick="showMyApproachDetail('${app._id}')">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
          <div style="flex: 1;">
            <h3 style="font-size: 18px; font-weight: 700; color: var(--text); margin-bottom: 4px;">${req.title}</h3>
            <p style="font-size: 14px; color: var(--text-muted);">${req.service.toUpperCase()}</p>
          </div>
          <span class="badge ${statusColors[app.status]}">${app.status.toUpperCase()}</span>
        </div>
        
        <p style="font-size: 14px; color: var(--text-light); margin-bottom: 12px;">${req.description}</p>
        
        <div style="display: flex; gap: 20px; font-size: 13px; color: var(--text-muted);">
          <span>💰 ${app.creditsSpent} credits spent</span>
          <span>📅 ${new Date(app.createdAt).toLocaleDateString()}</span>
        </div>
      </div>
    `;
  }).join('');
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
              <a href="${doc.fileUrl}" download="${doc.originalFileName}" style="padding: 8px 16px; background: var(--primary); color: #fff; border-radius: 8px; text-decoration: none; font-size: 13px; font-weight: 600;">Download</a>
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
  
  // Check if user is logged in
  if (state.token && state.user) {
    enterDashboard();
  } else {
    showPage('landing');
  }
});
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
// ─── RENDER EXPERT PROFILE ───
function renderExpertProfile() {
  console.log('🔍 Rendering profile with user data:', state.user);
  
  if (!state.user) {
    console.log('❌ No user data in state!');
    return;
  }
  
  const user = state.user;
const profile = user.profile || {};  // ✅ ADD THIS LINE
  
  // Update basic info
  document.getElementById('expertProfileName').textContent = user.name || 'Expert';
  document.getElementById('expertProfileEmail').textContent = user.email || '';
  
  const avatar = document.getElementById('expertProfileAvatar');
  if (user.profilePhoto) {
    avatar.innerHTML = '<img src="' + user.profilePhoto + '" alt="' + user.name + '">';
  } else {
    avatar.textContent = (user.name || 'E').substring(0, 2).toUpperCase();
  }
  
  // Check if profile tab already has content sections
  const profileTab = document.getElementById('expertProfileTab');
  const existingSections = profileTab.querySelectorAll('.settings-section');
  
  // Remove old sections (keep only avatar section)
  existingSections.forEach(function(section) {
    section.remove();
  });
  
// Build profile details HTML
var profileHTML = '';

// Services Offered - READ FROM PROFILE
if (profile.servicesOffered && profile.servicesOffered.length > 0) {  // ✅ CHANGED
  var serviceLabels = {
    itr: 'ITR Filing',
    gst: 'GST Services',
    accounting: 'Accounting',
    audit: 'Audit',
    photography: 'Photography',
    development: 'Development'
  };
  
  var serviceBadges = profile.servicesOffered.map(function(s) {  // ✅ CHANGED
    return '<span class="badge badge-primary">' + (serviceLabels[s] || s) + '</span>';
  }).join('');
  
  profileHTML += '<div class="settings-section"><h3 class="settings-section-title">Services Offered</h3><div style="display: flex; flex-wrap: wrap; gap: 8px;">' + serviceBadges + '</div></div>';
}

// Specialization & Experience
profileHTML += '<div class="settings-section"><h3 class="settings-section-title">Professional Details</h3>';

if (profile.specialization) {  // ✅ CHANGED
  profileHTML += '<div style="padding: 12px 0; border-bottom: 1px solid var(--border);"><div style="font-size: 13px; color: var(--text-muted); margin-bottom: 4px;">Specialization</div><div style="font-size: 15px; font-weight: 600;">' + profile.specialization + '</div></div>';
}

if (profile.experience) {  // ✅ CHANGED
  profileHTML += '<div style="padding: 12px 0; border-bottom: 1px solid var(--border);"><div style="font-size: 13px; color: var(--text-muted); margin-bottom: 4px;">Experience</div><div style="font-size: 15px; font-weight: 600;">' + profile.experience + '</div></div>';
}

profileHTML += '<div style="padding: 12px 0; border-bottom: 1px solid var(--border);"><div style="font-size: 13px; color: var(--text-muted); margin-bottom: 4px;">Rating</div><div style="font-size: 15px; font-weight: 600;">⭐ ' + (user.rating || '0.0') + ' (' + (user.reviewCount || 0) + ' reviews)</div></div>';

profileHTML += '<div style="padding: 12px 0;"><div style="font-size: 13px; color: var(--text-muted); margin-bottom: 4px;">Credits Balance</div><div style="font-size: 15px; font-weight: 600;">💎 ' + (user.credits || 0) + ' credits</div></div>';

profileHTML += '</div>';

// Bio - READ FROM PROFILE
if (profile.bio) {  // ✅ CHANGED
  profileHTML += '<div class="settings-section"><h3 class="settings-section-title">About</h3><p style="font-size: 15px; color: var(--text-light); line-height: 1.6;">' + profile.bio + '</p></div>';
}

// Service Location Type - READ FROM PROFILE
if (profile.serviceLocationType) {  // ✅ CHANGED
  var locationLabels = {
    online: '💻 Online / Remote only',
    local: '📍 Local (in-person available)',
    both: '🌐 Both online and in-person'
  };
  
  profileHTML += '<div class="settings-section"><h3 class="settings-section-title">Service Location</h3><div style="font-size: 15px; font-weight: 600;">' + (locationLabels[profile.serviceLocationType] || profile.serviceLocationType) + '</div></div>';
}

// Rest stays same (user.phone, user.createdAt)
  
  // Contact Info
  profileHTML += '<div class="settings-section"><h3 class="settings-section-title">Contact Information</h3><div style="padding: 12px 0; border-bottom: 1px solid var(--border);"><div style="font-size: 13px; color: var(--text-muted); margin-bottom: 4px;">Phone</div><div style="font-size: 15px; font-weight: 600;">' + (user.phone || 'Not provided') + '</div></div>';
  
  var memberSince = 'Recently joined';
  if (user.createdAt) {
    var date = new Date(user.createdAt);
    memberSince = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }
  
  profileHTML += '<div style="padding: 12px 0;"><div style="font-size: 13px; color: var(--text-muted); margin-bottom: 4px;">Member Since</div><div style="font-size: 15px; font-weight: 600;">' + memberSince + '</div></div></div>';
  
  // Insert all sections after the avatar section
  const avatarSection = profileTab.querySelector('[style*="text-align: center"]');
  if (avatarSection) {
    avatarSection.insertAdjacentHTML('afterend', profileHTML);
  }
}
// ─── CHAT STATE ───
let currentChatId = null;
let chatPollingInterval = null;

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
      const stateStr = post.State;
      
      // Auto-fill city if empty
      const cityInput = document.getElementById('q_city');
      if (cityInput && !cityInput.value) {
        cityInput.value = city;
        qState.answers['city'] = city;
      }
      
      // Show confirmation
      document.getElementById('pincodeResult').innerHTML = 
        `<div style="font-size: 13px; color: #4CAF50; margin-top: 6px;">
          📍 ${area}, ${city}, ${stateStr}
        </div>`;
    } else {
      document.getElementById('pincodeResult').innerHTML = 
        `<div style="font-size: 13px; color: #e74c3c; margin-top: 6px;">Invalid pincode</div>`;
    }
  } catch (err) {
    console.error('Pincode lookup error:', err);
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

  // ✅ If experts not loaded yet, load them then retry
  if (!state.experts || state.experts.length === 0) {
    loadExperts().then(() => {
      if (document.getElementById('expertSearchInput')?.value === value) {
        showSearchSuggestions(value);
      }
    });
  }

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
// ─── LANDING PAGE SUGGESTIONS ───
function showLandingSuggestions(value) {
  const el = document.getElementById('landingSuggestions');
  if (!el) return;
  if (!value || value.length < 2) { hideLandingSuggestions(); return; }

  const lower = value.toLowerCase();
  const matches = SEARCH_SUGGESTIONS.services.filter(s =>
    s.label.toLowerCase().includes(lower)
  );

  if (!matches.length) { hideLandingSuggestions(); return; }

  el.innerHTML = matches.map(s => `
    <div onclick="selectLandingSuggestion('${s.value}', '${s.label}')"
      style="padding:12px 16px;cursor:pointer;display:flex;align-items:center;gap:10px;border-bottom:1px solid #f0f0f0;"
      onmouseover="this.style.background='#f5f5f5'" onmouseout="this.style.background='transparent'">
      <span style="font-size:18px;">🔧</span>
      <div>
        <div style="font-size:14px;font-weight:600;color:#333;">${s.label}</div>
        <div style="font-size:11px;color:#888;">Service</div>
      </div>
    </div>
  `).join('');
  el.style.display = 'block';
}

function selectLandingSuggestion(value, label) {
  document.getElementById('landingServiceInput').value = label;
  hideLandingSuggestions();
  state.pendingSearch = { service: value, location: null };
  showPage('findProfessionals');
}

function hideLandingSuggestions() {
  const el = document.getElementById('landingSuggestions');
  if (el) el.style.display = 'none';
}
// ═══════════════════════════════════════════════════════════
//  WORKINDEX SUPPORT CHATBOT - Frontend JS
//  Add this entire block to the end of your app.js
// ═══════════════════════════════════════════════════════════

// ─── CHATBOT STATE ───
const supportChat = {
  isOpen: false,
  step: 'start',
  userType: null,       // 'customer' or 'expert'
  issueType: null,      // 'credits', 'approach', 'technical', etc.
  subIssue: null,
  geminiContext: [],    // conversation history for Gemini
  evaluationResult: null,
  ticketId: null
};

// ─── GEMINI API CONFIG ───
// Replace with your actual Gemini API key from Google AI Studio
const GEMINI_API_KEY = 'AIzaSyAYPil53zqpeD3tCnF5u7k6USi4ZBqJFgk';

const WORKINDEX_SYSTEM_CONTEXT = `You are a helpful support assistant for WorkIndex, an Indian platform that connects clients with verified professionals (CAs, GST consultants, photographers, developers, etc.).

Key facts about WorkIndex:
- Experts buy credits to approach client requests (15-35 credits per approach)
- Credits are NOT automatically refunded — refunds are evaluated case by case
- If a client doesn't respond within 7 days, it may qualify for a goodwill credit refund
- Clients post requests, experts approach them by spending credits
- Services: ITR Filing, GST, Accounting, Audit, Photography, App/Web Development

Tone: Friendly, empathetic, professional. Keep responses SHORT (2-3 sentences max). 
If someone is very frustrated, acknowledge their feelings first before solving.
Always end with a question or next step.`;

// ─── TOGGLE CHAT WIDGET ───
function toggleSupportChat() {
  const widget = document.getElementById('supportChatWidget');
  supportChat.isOpen = !supportChat.isOpen;

  if (supportChat.isOpen) {
    widget.style.display = 'flex';
    document.getElementById('supportChatIcon').textContent = '×';
    document.getElementById('supportUnreadDot').style.display = 'none';

    // Only initialize if fresh start
    if (supportChat.step === 'start') {
      initSupportChat();
    }
  } else {
    widget.style.display = 'none';
    document.getElementById('supportChatIcon').textContent = '💬';
  }
}

// ─── INITIALIZE CHAT ───
function initSupportChat() {
  clearSupportMessages();

  setTimeout(() => {
    addBotMessage("Hi there! 👋 I'm here to help you with WorkIndex.");
  }, 300);

  setTimeout(() => {
    addBotMessage("Who are you today?");
    showSupportOptions([
      { label: '👤 I\'m a Customer', value: 'customer' },
      { label: '⭐ I\'m a Professional', value: 'expert' }
    ], (val) => handleUserTypeSelect(val));
  }, 900);
}

// ─── HANDLE USER TYPE SELECTION ───
function handleUserTypeSelect(type) {
  supportChat.userType = type;
  addUserMessage(type === 'customer' ? '👤 I\'m a Customer' : '⭐ I\'m a Professional');
  clearSupportOptions();

  setTimeout(() => {
    if (type === 'expert') {
      addBotMessage("Got it! What's the issue you're facing?");
      showSupportOptions([
        { label: '💎 Credits & Billing', value: 'credits' },
        { label: '📨 My Approaches', value: 'approaches' },
        { label: '⭐ Reviews & Ratings', value: 'reviews' },
        { label: '🔧 Technical Problem', value: 'technical' },
        { label: '❓ Something Else', value: 'other' }
      ], (val) => handleExpertIssue(val));
    } else {
      addBotMessage("Sure! What do you need help with?");
      showSupportOptions([
        { label: '🔍 Finding the right expert', value: 'finding' },
        { label: '📋 About my request', value: 'request' },
        { label: '😟 Problem with an expert', value: 'expert_problem' },
        { label: '🔧 Technical Problem', value: 'technical' },
        { label: '❓ Something Else', value: 'other' }
      ], (val) => handleClientIssue(val));
    }
  }, 600);
}

// ─── HANDLE EXPERT ISSUES ───
function handleExpertIssue(issue) {
  supportChat.issueType = issue;

  const labels = {
    credits: '💎 Credits & Billing',
    approaches: '📨 My Approaches',
    reviews: '⭐ Reviews & Ratings',
    technical: '🔧 Technical Problem',
    other: '❓ Something Else'
  };
  addUserMessage(labels[issue]);
  clearSupportOptions();

  setTimeout(() => {
    if (issue === 'credits') {
      addBotMessage("I understand — credits are important! What exactly happened?");
      showSupportOptions([
        { label: '😔 Experts didn\'t respond after I approached', value: 'no_response' },
        { label: '💸 I was charged the wrong amount', value: 'wrong_charge' },
        { label: '🔄 I want to buy credits but it\'s not working', value: 'cant_buy' },
        { label: '📊 My credit balance looks wrong', value: 'wrong_balance' }
      ], (val) => handleCreditIssue(val));

    } else if (issue === 'approaches') {
      addBotMessage("Let me help with your approaches. What's the problem?");
      showSupportOptions([
        { label: '❌ Client contact details not showing', value: 'no_contact' },
        { label: '🚫 Approach button not working', value: 'cant_approach' },
        { label: '📭 Client hasn\'t responded', value: 'no_reply' }
      ], (val) => handleApproachIssue(val));

    } else if (issue === 'technical') {
      handleTechnicalIssue();

    } else {
      // Fall through to Gemini for open-ended issues
      showFreeTextInput("Please describe your issue and I'll do my best to help:");
    }
  }, 600);
}

// ─── HANDLE CREDIT ISSUES (THE MAIN CASE) ───
async function handleCreditIssue(subIssue) {
  supportChat.subIssue = subIssue;

  const labels = {
    no_response: '😔 Experts didn\'t respond after I approached',
    wrong_charge: '💸 Wrong amount charged',
    cant_buy: '🔄 Can\'t buy credits',
    wrong_balance: '📊 Wrong balance showing'
  };
  addUserMessage(labels[subIssue]);
  clearSupportOptions();

  if (subIssue === 'no_response') {
    setTimeout(() => {
      addBotMessage("That's really frustrating — spending credits and getting no response. 😞");
    }, 500);

    setTimeout(() => {
      addBotMessage("How many clients didn't respond to you?");
      showSupportOptions([
        { label: '1 client', value: 1 },
        { label: '2 clients', value: 2 },
        { label: '3 or more clients', value: 3 }
      ], async (count) => {
        addUserMessage(`${count === 3 ? '3 or more' : count} client${count > 1 ? 's' : ''}`);
        clearSupportOptions();
        await evaluateAndRespond(count);
      });
    }, 1200);

  } else if (subIssue === 'cant_buy') {
    setTimeout(() => {
      addBotMessage("Let's fix this! Try these steps:\n\n1. Refresh the page and try again\n2. Make sure your payment method is valid\n3. Try a different browser");
    }, 500);
    setTimeout(() => {
      addBotMessage("Did any of those work?");
      showSupportOptions([
        { label: '✅ Yes, it worked!', value: 'resolved' },
        { label: '❌ Still not working', value: 'unresolved' }
      ], (val) => {
        if (val === 'resolved') {
          addUserMessage('✅ Yes, it worked!');
          showResolved("Great! Happy to help. Anything else? 😊");
        } else {
          addUserMessage('❌ Still not working');
          offerCallEscalation("Let me connect you with our team to sort this out.");
        }
      });
    }, 1500);

  } else {
    // For wrong charge / wrong balance — always escalate
    setTimeout(() => {
      addBotMessage("For billing discrepancies, our team needs to verify your account directly.");
      offerCallEscalation("I'll connect you with support right away.");
    }, 600);
  }
}

// ─── EVALUATE COMPLAINT AGAINST BACKEND ───
async function evaluateAndRespond(clientCount) {
  // Show thinking state
  addBotMessage("⏳ Let me check your account details...", 'thinking');

  try {
    // Call backend evaluation API
    const res = await fetch(`${API_URL}/support/evaluate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(state.token ? { 'Authorization': `Bearer ${state.token}` } : {})
      },
      body: JSON.stringify({
        userId: state.user?._id,
        issueType: 'no_response',
        clientCount: clientCount
      })
    });

    const data = await res.json();
    supportChat.evaluationResult = data.decision;
    supportChat.ticketId = data.ticketId;

    // Remove thinking message
    removeThinkingMessage();

    setTimeout(() => {
      if (data.decision === 'AUTO_REFUND') {
        handleAutoRefund(data);
      } else if (data.decision === 'CLOSE_CHAT') {
        handleCloseChat(data);
      } else {
        handleEscalateCall(data);
      }
    }, 500);

  } catch (err) {
    removeThinkingMessage();
    // If backend fails, default to escalation
    setTimeout(() => {
      offerCallEscalation("I wasn't able to verify your account automatically. Let me connect you with our team.");
    }, 500);
  }
}

// ─── DECISION HANDLERS ───
function handleAutoRefund(data) {
  addBotMessage(`✅ Good news! We reviewed your account and confirmed that ${data.inactiveCount || 'some'} clients were inactive.`);

  setTimeout(() => {
    addBotMessage(`We'll add **${data.creditsToRefund} credits** back to your account as a goodwill gesture within 24 hours. 🎉`);
  }, 800);

  setTimeout(() => {
    addBotMessage("Is there anything else I can help you with?");
    showSupportOptions([
      { label: '👍 No, that\'s great! Thank you', value: 'done' },
      { label: '📞 I still want to speak to someone', value: 'call' }
    ], (val) => {
      if (val === 'done') {
        addUserMessage("👍 No, that's great! Thank you");
        showResolved("You're welcome! Have a great day! 😊");
      } else {
        addUserMessage("📞 I still want to speak to someone");
        offerCallEscalation("Of course! Let me connect you.");
      }
    });
  }, 1600);
}

function handleCloseChat(data) {
  addBotMessage("Thank you for reaching out. We've reviewed your account history.");

  setTimeout(() => {
    addBotMessage("Our team will review this and contact you via email within 48 hours with a resolution.");
  }, 800);

  setTimeout(() => {
    addBotMessage("We appreciate your patience! 🙏");
    showSupportOptions([
      { label: '✅ Okay, thank you', value: 'done' }
    ], () => {
      addUserMessage("✅ Okay, thank you");
      clearSupportOptions();
      addBotMessage("Take care! Feel free to reach out anytime. 😊");
    });
  }, 1600);
}

function handleEscalateCall(data) {
  addBotMessage("We understand your frustration and want to make this right. 💛");

  setTimeout(() => {
    addBotMessage("Our team would like to speak with you directly about this.");
    offerCallEscalation();
  }, 800);
}

// ─── OFFER CALL / ESCALATION ───
function offerCallEscalation(preMessage) {
  if (preMessage) {
    setTimeout(() => addBotMessage(preMessage), 300);
  }

  setTimeout(() => {
    addBotMessage("How would you like us to reach you?");
    showSupportOptions([
      { label: '📞 Call me now', value: 'call_now' },
      { label: '📅 Schedule a call', value: 'schedule' },
      { label: '📧 Email me instead', value: 'email' },
      { label: '💬 Continue chatting', value: 'chat' }
    ], (val) => handleEscalationChoice(val));
  }, preMessage ? 1000 : 300);
}

function handleEscalationChoice(choice) {
  const labels = {
    call_now: '📞 Call me now',
    schedule: '📅 Schedule a call',
    email: '📧 Email me instead',
    chat: '💬 Continue chatting'
  };
  addUserMessage(labels[choice]);
  clearSupportOptions();

  if (choice === 'call_now') {
    setTimeout(() => {
      addBotMessage("Connecting you now! Our support number is:");
      addBotMessage(`📞 **+91-XXXXX-XXXXX**\n\nOr tap to call directly:`);
      showSupportOptions([
        { label: '📞 Tap to Call', value: 'dial', isCall: true },
        { label: '🔙 Back to chat', value: 'back' }
      ], (val) => {
        if (val === 'dial') {
          window.location.href = 'tel:+91XXXXXXXXXX';
        } else {
          initSupportChat();
        }
      });
    }, 600);

  } else if (choice === 'schedule') {
    setTimeout(() => {
      addBotMessage("Please share your preferred time and we'll call you back:");
      showFreeTextInput("e.g. Tomorrow 10am-12pm", async (text) => {
        addBotMessage(`✅ Got it! We'll call you at **${text}**.\n\nYour ticket ID: **#${supportChat.ticketId || 'WI' + Date.now().toString().slice(-6)}**`);
        setTimeout(() => showResolved("We'll be in touch soon! 😊"), 1000);
      });
    }, 600);

  } else if (choice === 'email') {
    const userEmail = state.user?.email || '';
    setTimeout(() => {
      addBotMessage(`We'll send a detailed response to **${userEmail || 'your registered email'}** within 4 hours.`);
      setTimeout(() => showResolved("Keep an eye on your inbox! 📧"), 800);
    }, 600);

  } else {
    // Continue chatting — open Gemini
    showFreeTextInput("Sure! Ask me anything:");
  }
}

// ─── CLIENT ISSUE HANDLERS ───
function handleClientIssue(issue) {
  const labels = {
    finding: '🔍 Finding the right expert',
    request: '📋 About my request',
    expert_problem: '😟 Problem with an expert',
    technical: '🔧 Technical Problem',
    other: '❓ Something Else'
  };
  addUserMessage(labels[issue]);
  clearSupportOptions();

  if (issue === 'finding') {
    setTimeout(() => {
      addBotMessage("I can help! What service are you looking for?");
      showSupportOptions([
        { label: '📄 ITR Filing', value: 'itr' },
        { label: '🏢 GST Services', value: 'gst' },
        { label: '📊 Accounting', value: 'accounting' },
        { label: '📸 Photography', value: 'photography' },
        { label: '💻 Development', value: 'development' },
        { label: '🔍 Other', value: 'other' }
      ], (val) => {
        addUserMessage(val);
        clearSupportOptions();
        setTimeout(() => {
          addBotMessage(`Great! You can find ${val} experts by going to **Find Professionals** and searching for "${val}". Filter by your city or pincode for local experts! 🎯`);
          setTimeout(() => askIfResolved(), 1000);
        }, 500);
      });
    }, 600);

  } else if (issue === 'expert_problem') {
    setTimeout(() => {
      addBotMessage("I'm sorry to hear that. What happened?");
      showSupportOptions([
        { label: '🚫 Expert was unprofessional', value: 'unprofessional' },
        { label: '💸 Dispute over payment', value: 'payment' },
        { label: '📵 Expert stopped responding', value: 'ghosted' },
        { label: '⚠️ Fake or fraudulent profile', value: 'fraud' }
      ], (val) => {
        addUserMessage(val);
        clearSupportOptions();
        if (val === 'fraud') {
          setTimeout(() => {
            addBotMessage("⚠️ Thank you for reporting this. We take fraud very seriously.");
            offerCallEscalation("Our trust & safety team will investigate immediately.");
          }, 500);
        } else {
          setTimeout(() => offerCallEscalation("This needs our team's attention."), 500);
        }
      });
    }, 600);

  } else {
    showFreeTextInput("Please describe your issue:");
  }
}

// ─── APPROACH ISSUE HANDLER ───
function handleApproachIssue(issue) {
  const labels = {
    no_contact: '❌ Client contact details not showing',
    cant_approach: '🚫 Approach button not working',
    no_reply: '📭 Client hasn\'t responded'
  };
  addUserMessage(labels[issue]);
  clearSupportOptions();

  if (issue === 'no_contact') {
    setTimeout(() => {
      addBotMessage("Contact details appear after your approach is accepted by the client.");
      addBotMessage("If credits were deducted but contact is still hidden, that's a bug. Let me escalate.");
      setTimeout(() => offerCallEscalation(), 800);
    }, 500);
  } else if (issue === 'no_reply') {
    setTimeout(() => {
      addBotMessage("Clients have 7 days to respond. If they don't, you may be eligible for a credit refund.");
      addBotMessage("Has it been more than 7 days?");
      showSupportOptions([
        { label: '✅ Yes, more than 7 days', value: 'yes' },
        { label: '⏳ Not yet', value: 'no' }
      ], (val) => {
        if (val === 'yes') {
          addUserMessage('✅ Yes, more than 7 days');
          clearSupportOptions();
          evaluateAndRespond(1);
        } else {
          addUserMessage('⏳ Not yet');
          clearSupportOptions();
          setTimeout(() => {
            addBotMessage("Please wait the full 7 days. If there's still no response, come back and we'll review your case! 😊");
            setTimeout(() => showResolved(), 800);
          }, 500);
        }
      });
    }, 600);
  } else {
    offerCallEscalation("Let me connect you with technical support.");
  }
}

// ─── TECHNICAL ISSUE HANDLER ───
function handleTechnicalIssue() {
  addBotMessage("Technical issues are usually quick to fix! Try these first:");

  setTimeout(() => {
    addBotMessage("1️⃣ Refresh the page\n2️⃣ Clear browser cache\n3️⃣ Try a different browser\n4️⃣ Check your internet connection");
  }, 600);

  setTimeout(() => {
    addBotMessage("Did that fix it?");
    showSupportOptions([
      { label: '✅ Yes, working now!', value: 'fixed' },
      { label: '❌ Still broken', value: 'broken' }
    ], (val) => {
      if (val === 'fixed') {
        addUserMessage('✅ Yes, working now!');
        showResolved("Excellent! 🎉 Let me know if anything else comes up.");
      } else {
        addUserMessage('❌ Still broken');
        clearSupportOptions();
        showFreeTextInput("Please describe what's happening and I'll escalate to our tech team:");
      }
    });
  }, 1400);
}

// ─── GEMINI AI FALLBACK ───
async function askGemini(userMessage) {
  // Add to context
  supportChat.geminiContext.push({ role: 'user', content: userMessage });

  addBotMessage("🤔 Let me look into that...", 'thinking');

  try {
    const conversationText = supportChat.geminiContext
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n');

    const prompt = `${WORKINDEX_SYSTEM_CONTEXT}\n\nConversation so far:\n${conversationText}\n\nAssistant:`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 200, temperature: 0.7 }
        })
      }
    );

    const data = await res.json();
    removeThinkingMessage();

    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "I'm not sure about that. Let me connect you with our team.";
    supportChat.geminiContext.push({ role: 'assistant', content: reply });

    addBotMessage(reply);

    // After Gemini reply, ask if resolved
    setTimeout(() => askIfResolved(), 1000);

  } catch (err) {
    removeThinkingMessage();
    addBotMessage("I had trouble fetching an answer. Let me connect you with our team instead.");
    setTimeout(() => offerCallEscalation(), 600);
  }
}

// ─── ASK IF RESOLVED ───
function askIfResolved() {
  addBotMessage("Did that answer your question?");
  showSupportOptions([
    { label: '✅ Yes, thanks!', value: 'yes' },
    { label: '❓ I have another question', value: 'more' },
    { label: '📞 I need more help', value: 'escalate' }
  ], (val) => {
    if (val === 'yes') {
      addUserMessage('✅ Yes, thanks!');
      showResolved("Wonderful! Have a great day! 😊");
    } else if (val === 'more') {
      addUserMessage('❓ I have another question');
      clearSupportOptions();
      showFreeTextInput("Go ahead, ask anything:");
    } else {
      addUserMessage('📞 I need more help');
      clearSupportOptions();
      offerCallEscalation();
    }
  });
}

// ─── SHOW RESOLVED STATE ───
function showResolved(message) {
  clearSupportOptions();
  if (message) addBotMessage(message);

  setTimeout(() => {
    const optionsEl = document.getElementById('supportOptions');
    optionsEl.innerHTML = `
      <button onclick="restartSupportChat()"
        style="width:100%; padding:12px; background:var(--bg-gray,#f5f5f5); border:1.5px solid var(--border,#eee); border-radius:10px; font-size:14px; font-weight:600; cursor:pointer; color:var(--text,#333);">
        🔄 Start New Conversation
      </button>
    `;
  }, 800);
}

// ─── RESTART CHAT ───
function restartSupportChat() {
  supportChat.step = 'start';
  supportChat.userType = null;
  supportChat.issueType = null;
  supportChat.subIssue = null;
  supportChat.geminiContext = [];
  supportChat.evaluationResult = null;
  clearSupportMessages();
  hideInputArea();
  initSupportChat();
}

// ─── FREE TEXT INPUT ───
function showFreeTextInput(placeholder, onSend) {
  clearSupportOptions();
  const inputArea = document.getElementById('supportInputArea');
  const input = document.getElementById('supportTextInput');
  inputArea.style.display = 'block';
  input.placeholder = placeholder || 'Type your message...';
  input.focus();

  // Store callback
  supportChat._textCallback = onSend || null;
}

function hideInputArea() {
  document.getElementById('supportInputArea').style.display = 'none';
  document.getElementById('supportTextInput').value = '';
}

async function sendSupportMessage() {
  const input = document.getElementById('supportTextInput');
  const text = input.value.trim();
  if (!text) return;

  addUserMessage(text);
  input.value = '';

  if (supportChat._textCallback) {
    const cb = supportChat._textCallback;
    supportChat._textCallback = null;
    hideInputArea();
    cb(text);
  } else {
    hideInputArea();
    await askGemini(text);
  }
}

// ─── UI HELPERS ───
function addBotMessage(text, type) {
  const container = document.getElementById('supportMessages');
  const div = document.createElement('div');
  div.style.cssText = 'display:flex; gap:8px; align-items:flex-start;';
  div.className = type === 'thinking' ? 'thinking-msg' : '';

  const formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');

  div.innerHTML = `
    <div style="width:28px; height:28px; background:var(--primary,#FC8019); border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:14px; flex-shrink:0; margin-top:2px;">🤖</div>
    <div style="background:var(--bg,#fff); padding:10px 14px; border-radius:4px 16px 16px 16px; font-size:14px; line-height:1.5; color:var(--text,#333); max-width:80%; box-shadow:0 1px 4px rgba(0,0,0,0.08);">
      ${type === 'thinking' ? '<span style="opacity:0.6;">⏳ ' + formatted + '</span>' : formatted}
    </div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function addUserMessage(text) {
  const container = document.getElementById('supportMessages');
  const div = document.createElement('div');
  div.style.cssText = 'display:flex; justify-content:flex-end;';
  div.innerHTML = `
    <div style="background:var(--primary,#FC8019); color:#fff; padding:10px 14px; border-radius:16px 4px 16px 16px; font-size:14px; line-height:1.5; max-width:80%;">
      ${text}
    </div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function showSupportOptions(options, callback) {
  const el = document.getElementById('supportOptions');
  el.innerHTML = options.map((opt, i) => `
    <button onclick="supportOptionClick(${i})"
      style="display:block; width:100%; text-align:left; padding:10px 14px; margin-bottom:6px; background:var(--bg,#fff); border:1.5px solid var(--border,#eee); border-radius:10px; font-size:13px; font-weight:600; cursor:pointer; color:var(--text,#333); transition:all 0.2s;"
      onmouseover="this.style.borderColor='var(--primary,#FC8019)'; this.style.background='rgba(252,128,25,0.05)'"
      onmouseout="this.style.borderColor='var(--border,#eee)'; this.style.background='var(--bg,#fff)'">
      ${opt.label}
    </button>
  `).join('');

  // Store callback and options
  supportChat._optionsCallback = callback;
  supportChat._currentOptions = options;
}

function supportOptionClick(index) {
  const opt = supportChat._currentOptions[index];
  const cb = supportChat._optionsCallback;
  if (cb && opt) {
    clearSupportOptions();
    cb(opt.value);
  }
}

function clearSupportOptions() {
  const el = document.getElementById('supportOptions');
  if (el) el.innerHTML = '';
}

function clearSupportMessages() {
  const el = document.getElementById('supportMessages');
  if (el) el.innerHTML = '';
}

function removeThinkingMessage() {
  document.querySelectorAll('.thinking-msg').forEach(el => el.remove());
}

// ─── Show unread dot when chat is closed ───
function notifyUserNewMessage() {
  if (!supportChat.isOpen) {
    document.getElementById('supportUnreadDot').style.display = 'block';
  }
}
// ═══ END OF CHATBOT JS ═══
// ═══ END OF JAVASCRIPT ═══
