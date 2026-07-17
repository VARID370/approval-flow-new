/* ============================================
   ApprovalFlow — Core Application Module
   ============================================ */

const App = (() => {
  const API_BASE = '/api';
  const TOKEN_KEY = 'af_token';

  // ── Fetch Wrapper ──
  const request = async (url, options = {}) => {
    const token = localStorage.getItem(TOKEN_KEY);
    const headers = { ...options.headers };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    const config = { ...options, headers };

    try {
      const response = await fetch(`${API_BASE}${url}`, config);
      const data = await response.json();

      if (response.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
        window.location.href = '/login.html';
        return null;
      }

      if (!response.ok) {
        throw new Error(data.message || 'Something went wrong');
      }

      return data;
    } catch (error) {
      if (error.message !== 'Failed to fetch') {
        Toast.error(error.message);
      } else {
        Toast.error('Network error. Please check your connection.');
      }
      throw error;
    }
  };

  const get = (url) => request(url, { method: 'GET' });

  const post = (url, body) => {
    const options = { method: 'POST' };
    if (body instanceof FormData) {
      options.body = body;
    } else {
      options.body = JSON.stringify(body);
    }
    return request(url, options);
  };

  const put = (url, body) => {
    const options = { method: 'PUT' };
    if (body instanceof FormData) {
      options.body = body;
    } else {
      options.body = JSON.stringify(body || {});
    }
    return request(url, options);
  };

  const del = (url) => request(url, { method: 'DELETE' });

  // ── Auth Helpers ──
  const getToken = () => localStorage.getItem(TOKEN_KEY);
  const setToken = (token) => localStorage.setItem(TOKEN_KEY, token);
  const removeToken = () => localStorage.removeItem(TOKEN_KEY);
  const isAuthenticated = () => !!getToken();

  let currentUser = null;
  const getUser = () => currentUser;
  const setUser = (user) => { currentUser = user; };

  const requireAuth = async () => {
    if (!isAuthenticated()) {
      window.location.href = '/login.html';
      return false;
    }
    try {
      const data = await get('/auth/me');
      if (data && data.data) {
        currentUser = data.data.user;
        return true;
      }
    } catch {
      removeToken();
      window.location.href = '/login.html';
    }
    return false;
  };

  const redirectIfAuth = () => {
    if (isAuthenticated()) {
      window.location.href = '/dashboard.html';
    }
  };

  const logout = async () => {
    try {
      await post('/auth/logout');
    } catch { /* ignore */ }
    removeToken();
    currentUser = null;
    window.location.href = '/login.html';
  };

  // ── Theme ──
  const initTheme = () => {
    const saved = localStorage.getItem('af_theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    updateThemeIcon(saved);
  };

  const toggleTheme = () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('af_theme', next);
    updateThemeIcon(next);
  };

  const updateThemeIcon = (theme) => {
    const btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.innerHTML = theme === 'dark' ? '☀️' : '🌙';
    }
  };

  // ── Sidebar ──
  const toggleSidebar = () => {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    if (sidebar) sidebar.classList.toggle('open');
    if (overlay) overlay.classList.toggle('active');
  };

  const closeSidebar = () => {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
  };

  // ── Loading Spinner ──
  const showLoading = () => {
    const el = document.getElementById('loading-spinner');
    if (el) el.classList.add('active');
  };

  const hideLoading = () => {
    const el = document.getElementById('loading-spinner');
    if (el) el.classList.remove('active');
  };

  // ── Utilities ──
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const timeAgo = (dateStr) => {
    const now = new Date();
    const past = new Date(dateStr);
    const diffMs = now - past;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return formatDate(dateStr);
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getStatusBadge = (status) => {
    const map = {
      'Draft': { class: 'badge-draft', label: 'Draft', icon: '📝' },
      'Submitted': { class: 'badge-submitted', label: 'Submitted', icon: '📤' },
      'UnderReview': { class: 'badge-under-review', label: 'Under Review', icon: '🔍' },
      'ManagerApproved': { class: 'badge-manager-approved', label: 'Manager Approved', icon: '✅' },
      'Completed': { class: 'badge-completed', label: 'Completed', icon: '🎉' },
      'Rejected': { class: 'badge-rejected', label: 'Rejected', icon: '❌' },
      'RevisionRequested': { class: 'badge-revision', label: 'Revision', icon: '🔄' }
    };
    const s = map[status] || { class: 'badge-draft', label: status, icon: '📄' };
    return `<span class="badge ${s.class}">${s.icon} ${s.label}</span>`;
  };

  const getRoleBadge = (role) => {
    const map = {
      'Employee': 'badge-employee',
      'Manager': 'badge-manager',
      'Director': 'badge-director',
      'Admin': 'badge-admin'
    };
    return `<span class="badge-role ${map[role] || ''}">${role}</span>`;
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  const getAvatarHTML = (user, sizeClass = '') => {
    if (user.avatar) {
      return `<div class="avatar ${sizeClass}"><img src="${user.avatar}" alt="${user.name}"></div>`;
    }
    return `<div class="avatar ${sizeClass}">${getInitials(user.name)}</div>`;
  };

  const getFileIcon = (mimeType) => {
    if (mimeType === 'application/pdf') return '📕';
    if (mimeType === 'application/msword' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return '📘';
    return '📄';
  };

  // ── Pagination Renderer ──
  const renderPagination = (meta, containerId, onPageChange) => {
    const container = document.getElementById(containerId);
    if (!container || !meta || meta.totalPages <= 1) {
      if (container) container.innerHTML = '';
      return;
    }

    let html = '<div class="pagination">';
    html += `<button class="pagination-btn" ${meta.page <= 1 ? 'disabled' : ''} data-page="${meta.page - 1}">‹</button>`;

    const start = Math.max(1, meta.page - 2);
    const end = Math.min(meta.totalPages, meta.page + 2);

    if (start > 1) {
      html += `<button class="pagination-btn" data-page="1">1</button>`;
      if (start > 2) html += `<span class="pagination-info">…</span>`;
    }

    for (let i = start; i <= end; i++) {
      html += `<button class="pagination-btn ${i === meta.page ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }

    if (end < meta.totalPages) {
      if (end < meta.totalPages - 1) html += `<span class="pagination-info">…</span>`;
      html += `<button class="pagination-btn" data-page="${meta.totalPages}">${meta.totalPages}</button>`;
    }

    html += `<button class="pagination-btn" ${meta.page >= meta.totalPages ? 'disabled' : ''} data-page="${meta.page + 1}">›</button>`;
    html += '</div>';

    container.innerHTML = html;
    container.querySelectorAll('.pagination-btn:not(:disabled)').forEach(btn => {
      btn.addEventListener('click', () => onPageChange(parseInt(btn.dataset.page)));
    });
  };

  // ── Modal ──
  const openModal = (id) => {
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
  };

  const closeModal = (id) => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
  };

  // ── Init ──
  const init = () => {
    initTheme();

    document.addEventListener('click', (e) => {
      if (e.target.closest('.sidebar-overlay')) closeSidebar();

      document.querySelectorAll('.action-dropdown.open').forEach(dd => {
        if (!dd.parentElement.contains(e.target)) {
          dd.classList.remove('open');
        }
      });
    });
  };

  return {
    API_BASE, TOKEN_KEY,
    get, post, put, del,
    getToken, setToken, removeToken, isAuthenticated,
    getUser, setUser, requireAuth, redirectIfAuth, logout,
    initTheme, toggleTheme,
    toggleSidebar, closeSidebar,
    showLoading, hideLoading,
    formatDate, formatDateTime, timeAgo, formatFileSize,
    getStatusBadge, getRoleBadge, getInitials, getAvatarHTML, getFileIcon,
    renderPagination, openModal, closeModal,
    init
  };
})();

/* ── Toast Module ── */
const Toast = (() => {
  let container = null;

  const getContainer = () => {
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      container.id = 'toast-container';
      document.body.appendChild(container);
    }
    return container;
  };

  const show = (type, title, message, duration = 4000) => {
    const icons = {
      success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️'
    };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${icons[type]}</span>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        ${message ? `<div class="toast-message">${message}</div>` : ''}
      </div>
      <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
    `;
    getContainer().appendChild(toast);

    setTimeout(() => {
      toast.classList.add('removing');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  };

  return {
    success: (msg, detail) => show('success', msg, detail),
    error: (msg, detail) => show('error', msg, detail),
    warning: (msg, detail) => show('warning', msg, detail),
    info: (msg, detail) => show('info', msg, detail)
  };
})();

document.addEventListener('DOMContentLoaded', App.init);
