/* ============================================
   ApprovalFlow — Notification Panel
   ============================================ */

const NotificationPanel = (() => {
  let isOpen = false;
  let notifications = [];

  const toggle = () => {
    isOpen = !isOpen;
    const panel = document.getElementById('notification-panel');
    if (panel) panel.classList.toggle('open', isOpen);
    if (isOpen) load();
  };

  const close = () => {
    isOpen = false;
    const panel = document.getElementById('notification-panel');
    if (panel) panel.classList.remove('open');
  };

  const load = async (page = 1) => {
    const list = document.getElementById('notification-list');
    if (!list) return;

    try {
      const data = await App.get(`/notifications?page=${page}&limit=20`);
      if (data && data.data) {
        notifications = data.data.notifications;
        renderList(list);
      }
    } catch { /* ignore */ }
  };

  const renderList = (container) => {
    if (notifications.length === 0) {
      container.innerHTML = `
        <div class="notification-empty">
          <span>🔔</span>
          <p>No notifications yet</p>
        </div>
      `;
      return;
    }

    const typeStyles = {
      'Approved': { bg: 'var(--success-50)', color: 'var(--success-600)', icon: '✅' },
      'Rejected': { bg: 'var(--danger-50)', color: 'var(--danger-600)', icon: '❌' },
      'Revision': { bg: 'var(--warning-50)', color: 'var(--warning-600)', icon: '🔄' },
      'Completed': { bg: 'var(--primary-50)', color: 'var(--primary-600)', icon: '🎉' },
      'Submitted': { bg: 'var(--info-50)', color: 'var(--info-600)', icon: '📤' },
      'NewUpload': { bg: 'var(--info-50)', color: 'var(--info-600)', icon: '📄' },
      'RoleChanged': { bg: 'var(--warning-50)', color: 'var(--warning-600)', icon: '👤' },
      'AccountStatus': { bg: 'var(--danger-50)', color: 'var(--danger-600)', icon: '🔐' }
    };

    container.innerHTML = notifications.map(n => {
      const style = typeStyles[n.type] || { bg: 'var(--gray-100)', color: 'var(--gray-600)', icon: 'ℹ️' };
      return `
        <div class="notification-item ${n.isRead ? '' : 'unread'}" data-id="${n._id}" onclick="NotificationPanel.markRead('${n._id}')">
          <div class="notification-icon-wrapper" style="background:${style.bg}; color:${style.color}">
            ${style.icon}
          </div>
          <div class="notification-text">
            <p>${n.message}</p>
            <div class="notification-time">${App.timeAgo(n.createdAt)}</div>
          </div>
        </div>
      `;
    }).join('');
  };

  const markRead = async (id) => {
    try {
      await App.put(`/notifications/${id}/read`);
      const item = document.querySelector(`.notification-item[data-id="${id}"]`);
      if (item) item.classList.remove('unread');
      SocketClient.updateNotificationBadge();
    } catch { /* ignore */ }
  };

  const markAllRead = async () => {
    try {
      await App.put('/notifications/read-all');
      document.querySelectorAll('.notification-item.unread').forEach(el => el.classList.remove('unread'));
      SocketClient.updateNotificationBadge();
      Toast.success('All notifications marked as read');
    } catch { /* ignore */ }
  };

  const refresh = () => { if (isOpen) load(); };

  const renderPanel = () => {
    const existing = document.getElementById('notification-panel');
    if (existing) return;

    const panel = document.createElement('div');
    panel.className = 'notification-panel';
    panel.id = 'notification-panel';
    panel.innerHTML = `
      <div class="notification-panel-header">
        <h3>Notifications</h3>
        <div style="display:flex;gap:8px">
          <button class="btn btn-sm btn-ghost" onclick="NotificationPanel.markAllRead()">Mark all read</button>
          <button class="modal-close" onclick="NotificationPanel.close()">✕</button>
        </div>
      </div>
      <div class="notification-list" id="notification-list">
        <div class="notification-empty"><span>🔔</span><p>Loading...</p></div>
      </div>
    `;
    document.body.appendChild(panel);
  };

  return { toggle, close, load, markRead, markAllRead, refresh, renderPanel, isOpen: () => isOpen };
})();
