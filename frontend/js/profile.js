/* ============================================
   ApprovalFlow — Profile Page Logic
   ============================================ */

document.addEventListener('DOMContentLoaded', async () => {
  const authed = await App.requireAuth();
  if (!authed) return;

  const user = App.getUser();
  Sidebar.render(user);
  NotificationPanel.renderPanel();
  SocketClient.connect();
  SocketClient.updateNotificationBadge();

  renderProfileHeader(user);
  populateForm(user);
  setupForms();
  loadActivity();
});

const renderProfileHeader = (user) => {
  const el = document.getElementById('profile-header');
  el.innerHTML = `
    <div class="profile-avatar-wrapper">
      ${App.getAvatarHTML(user, 'avatar-xl')}
    </div>
    <div class="profile-info">
      <h2>${user.name}</h2>
      <p>${user.email}</p>
      <div class="profile-meta">
        <span>${App.getRoleBadge(user.role)}</span>
        <span>🏢 ${user.department}</span>
        <span>📅 Joined ${App.formatDate(user.createdAt)}</span>
      </div>
    </div>
  `;
};

const populateForm = (user) => {
  document.getElementById('edit-name').value = user.name;
  document.getElementById('edit-email').value = user.email;
};

const setupForms = () => {
  document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('edit-name').value.trim();
    const email = document.getElementById('edit-email').value.trim();

    if (!name || !email) { Toast.error('Name and email are required'); return; }

    App.showLoading();
    try {
      // Update profile
      const data = await App.put('/auth/profile', { name, email });
      if (data && data.data) {
        App.setUser(data.data.user);
        renderProfileHeader(data.data.user);
        Sidebar.render(data.data.user);
        Toast.success('Profile updated!');
      }

      // Upload avatar if selected
      const avatarFile = document.getElementById('avatar-file').files[0];
      if (avatarFile) {
        const formData = new FormData();
        formData.append('avatar', avatarFile);
        const avatarData = await App.put('/auth/avatar', formData);
        if (avatarData && avatarData.data) {
          App.setUser(avatarData.data.user);
          renderProfileHeader(avatarData.data.user);
          Sidebar.render(avatarData.data.user);
        }
      }
    } catch { /* handled */ } finally { App.hideLoading(); }
  });

  document.getElementById('password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (!currentPassword || !newPassword || !confirmPassword) {
      Toast.error('All fields are required');
      return;
    }

    if (newPassword.length < 6) { Toast.error('New password must be at least 6 characters'); return; }
    if (!/\d/.test(newPassword)) { Toast.error('New password must contain a number'); return; }
    if (newPassword !== confirmPassword) { Toast.error('Passwords do not match'); return; }

    App.showLoading();
    try {
      const data = await App.put('/auth/password', { currentPassword, newPassword });
      if (data && data.data) {
        App.setToken(data.data.token);
        Toast.success('Password changed!');
        document.getElementById('password-form').reset();
      }
    } catch { /* handled */ } finally { App.hideLoading(); }
  });
};

const loadActivity = async (page = 1) => {
  try {
    const data = await App.get(`/activity/my?page=${page}&limit=10`);
    if (data && data.data) {
      const container = document.getElementById('activity-list');
      const activities = data.data.activities;

      if (activities.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><h3>No activity yet</h3></div>';
        return;
      }

      const actionIcons = {
        'Login': '🔑', 'Logout': '🚪', 'Upload': '📤', 'Download': '⬇️',
        'Approve': '✅', 'Reject': '❌', 'Revision': '🔄', 'Delete': '🗑️',
        'Submit': '📤', 'Update': '✏️', 'Register': '📝', 'ProfileUpdate': '👤',
        'PasswordChange': '🔒', 'RoleChange': '👤', 'StatusChange': '🔐'
      };

      const actionColors = {
        'Login': 'var(--info-50)', 'Logout': 'var(--gray-100)', 'Upload': 'var(--primary-50)',
        'Approve': 'var(--success-50)', 'Reject': 'var(--danger-50)', 'Revision': 'var(--warning-50)',
        'Delete': 'var(--danger-50)', 'Submit': 'var(--info-50)', 'Download': 'var(--primary-50)'
      };

      container.innerHTML = activities.map(a => `
        <div class="activity-item">
          <div class="activity-icon" style="background:${actionColors[a.action] || 'var(--gray-100)'}">
            ${actionIcons[a.action] || '📋'}
          </div>
          <div class="activity-text">
            <p>${a.details || a.action}</p>
            <div class="activity-time">${App.formatDateTime(a.createdAt)}</div>
          </div>
        </div>
      `).join('');

      if (data.meta) {
        App.renderPagination(data.meta, 'activity-pagination', loadActivity);
      }
    }
  } catch { /* handled */ }
};
