/* ============================================
   ApprovalFlow — Socket.IO Client
   ============================================ */

const SocketClient = (() => {
  let socket = null;
  let connected = false;

  const connect = () => {
    const token = App.getToken();
    if (!token || socket) return;

    socket = io({
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10
    });

    socket.on('connect', () => {
      connected = true;
      console.log('Socket.IO connected');
    });

    socket.on('disconnect', () => {
      connected = false;
      console.log('Socket.IO disconnected');
    });

    socket.on('notification', (notification) => {
      handleNotification(notification);
    });

    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
    });
  };

  const handleNotification = (notification) => {
    updateNotificationBadge();

    const typeIcons = {
      'NewUpload': '📄', 'Approved': '✅', 'Rejected': '❌',
      'Revision': '🔄', 'Completed': '🎉', 'Submitted': '📤',
      'RoleChanged': '👤', 'AccountStatus': '🔐'
    };
    const icon = typeIcons[notification.type] || 'ℹ️';
    Toast.info(`${icon} ${notification.message}`);

    if (typeof NotificationPanel !== 'undefined' && NotificationPanel.isOpen()) {
      NotificationPanel.refresh();
    }
  };

  const updateNotificationBadge = async () => {
    try {
      const data = await App.get('/notifications/unread-count');
      if (data && data.data) {
        const badge = document.getElementById('notification-badge');
        if (badge) {
          const count = data.data.count;
          badge.textContent = count > 99 ? '99+' : count;
          badge.classList.toggle('hidden', count === 0);
        }
      }
    } catch { /* ignore */ }
  };

  const disconnect = () => {
    if (socket) {
      socket.disconnect();
      socket = null;
      connected = false;
    }
  };

  return { connect, disconnect, updateNotificationBadge, isConnected: () => connected };
})();
