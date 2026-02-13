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
  approachedRequests: []
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
      loadExperts();
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
  
  // Update tab buttons
  document.querySelectorAll('.dash-tab').forEach(tab => {
    tab.classList.remove('active');
  });
  document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');
  
  // Update tab content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.style.display = 'none';
  });
  
  const contentId = tabName + 'Tab';
  const content = document.getElementById(contentId);
  if (content) {
    content.style.display = 'block';
    
    // Load data for specific tabs
    if (tabName === 'documents') {
      loadDocuments();
    } else if (tabName === 'access') {
      loadAccessRequests();
    } else if (tabName === 'ratings') {
      loadMyRatings();
    }
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
      localStorage.setItem('user', JSON.stringify(data.user));
      
      showToast('Registration successful!', 'success');
      enterDashboard();
    } else {
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
