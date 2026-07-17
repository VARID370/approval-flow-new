/* ============================================
   ApprovalFlow — Dynamic Sidebar
   ============================================ */

const Sidebar = (() => {
  const navConfig = {
    Employee: [
      { section: 'Main', items: [
        { label: 'Dashboard', icon: '📊', href: '/dashboard.html' },
        { label: 'Upload Document', icon: '📤', href: '/upload.html' },
        { label: 'My Documents', icon: '📁', href: '/upload.html' }
      ]},
      { section: 'Account', items: [
        { label: 'Profile', icon: '👤', href: '/profile.html' }
      ]}
    ],
    Manager: [
      { section: 'Main', items: [
        { label: 'Dashboard', icon: '📊', href: '/dashboard.html' },
        { label: 'Approvals', icon: '✅', href: '/approvals.html', badge: 'pendingCount' },
        { label: 'Analytics', icon: '📈', href: '/analytics.html' }
      ]},
      { section: 'Account', items: [
        { label: 'Profile', icon: '👤', href: '/profile.html' }
      ]}
    ],
    Director: [
      { section: 'Main', items: [
        { label: 'Dashboard', icon: '📊', href: '/dashboard.html' },
        { label: 'Approvals', icon: '✅', href: '/approvals.html', badge: 'pendingCount' },
        { label: 'Analytics', icon: '📈', href: '/analytics.html' }
      ]},
      { section: 'Account', items: [
        { label: 'Profile', icon: '👤', href: '/profile.html' }
      ]}
    ],
    Admin: [
      { section: 'Main', items: [
        { label: 'Dashboard', icon: '📊', href: '/dashboard.html' },
        { label: 'Users', icon: '👥', href: '/users.html' },
        { label: 'All Documents', icon: '📁', href: '/approvals.html' },
        { label: 'Analytics', icon: '📈', href: '/analytics.html' }
      ]},
      { section: 'Account', items: [
        { label: 'Profile', icon: '👤', href: '/profile.html' }
      ]}
    ]
  };

  const render = (user) => {
    const sidebarEl = document.getElementById('sidebar');
    if (!sidebarEl) return;

    const currentPage = window.location.pathname;
    const sections = navConfig[user.role] || navConfig.Employee;

    let navHTML = '';
    sections.forEach(section => {
      navHTML += `<div class="nav-section-title">${section.section}</div>`;
      section.items.forEach(item => {
        const isActive = currentPage === item.href || (item.href !== '/dashboard.html' && currentPage.includes(item.href));
        navHTML += `
          <a href="${item.href}" class="nav-item ${isActive ? 'active' : ''}">
            <span class="nav-icon">${item.icon}</span>
            <span>${item.label}</span>
            ${item.badge ? '<span class="nav-badge" id="sidebar-pending-badge" style="display:none">0</span>' : ''}
          </a>
        `;
      });
    });

    navHTML += `
      <div class="nav-section-title" style="margin-top:auto"></div>
      <a href="#" class="nav-item" id="sidebar-logout">
        <span class="nav-icon">🚪</span>
        <span>Logout</span>
      </a>
    `;

    sidebarEl.innerHTML = `
      <div class="sidebar-header">
        <div class="sidebar-logo">AF</div>
        <span class="sidebar-brand">ApprovalFlow</span>
      </div>
      <nav class="sidebar-nav">${navHTML}</nav>
      <div class="sidebar-footer">
        <a href="/profile.html" class="sidebar-user">
          <div class="sidebar-avatar">
            ${user.avatar ? `<img src="${user.avatar}" alt="${user.name}">` : App.getInitials(user.name)}
          </div>
          <div class="sidebar-user-info">
            <div class="sidebar-user-name">${user.name}</div>
            <div class="sidebar-user-role">${user.role} • ${user.department}</div>
          </div>
        </a>
      </div>
    `;

    document.getElementById('sidebar-logout').addEventListener('click', (e) => {
      e.preventDefault();
      App.logout();
    });

    loadPendingBadge(user);
  };

  const loadPendingBadge = async (user) => {
    if (user.role !== 'Manager' && user.role !== 'Director') return;
    try {
      const data = await App.get('/analytics/dashboard');
      if (data && data.data && data.data.stats) {
        const count = data.data.stats.pendingApprovals || 0;
        const badge = document.getElementById('sidebar-pending-badge');
        if (badge && count > 0) {
          badge.textContent = count;
          badge.style.display = 'inline';
        }
      }
    } catch { /* ignore */ }
  };

  return { render };
})();
