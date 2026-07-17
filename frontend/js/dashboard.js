/* ============================================
   ApprovalFlow — Dashboard Logic
   ============================================ */

document.addEventListener('DOMContentLoaded', async () => {
  const authed = await App.requireAuth();
  if (!authed) return;

  const user = App.getUser();
  Sidebar.render(user);
  NotificationPanel.renderPanel();
  SocketClient.connect();
  SocketClient.updateNotificationBadge();

  document.getElementById('dashboard-greeting').textContent = `Welcome back, ${user.name.split(' ')[0]}!`;
  document.getElementById('dashboard-subtitle').textContent = `${user.role} • ${user.department} Department`;

  loadDashboard(user);
});

const loadDashboard = async (user) => {
  App.showLoading();
  try {
    const data = await App.get('/analytics/dashboard');
    if (!data || !data.data) return;

    const stats = data.data.stats;
    const role = user.role;

    if (role === 'Employee') renderEmployeeDashboard(stats);
    else if (role === 'Manager') renderManagerDashboard(stats);
    else if (role === 'Director') renderDirectorDashboard(stats);
    else if (role === 'Admin') renderAdminDashboard(stats);
  } catch (error) {
    console.error('Dashboard error:', error);
  } finally {
    App.hideLoading();
  }
};

const renderEmployeeDashboard = (stats) => {
  const grid = document.getElementById('stats-grid');
  grid.innerHTML = `
    <div class="stat-card primary">
      <div class="stat-icon primary">📄</div>
      <div class="stat-info"><h4>Total Documents</h4><div class="stat-value">${stats.totalDocuments || 0}</div></div>
    </div>
    <div class="stat-card info">
      <div class="stat-icon info">📝</div>
      <div class="stat-info"><h4>Drafts</h4><div class="stat-value">${stats.drafts || 0}</div></div>
    </div>
    <div class="stat-card warning">
      <div class="stat-icon warning">⏳</div>
      <div class="stat-info"><h4>Under Review</h4><div class="stat-value">${(stats.submitted || 0) + (stats.underReview || 0)}</div></div>
    </div>
    <div class="stat-card success">
      <div class="stat-icon success">✅</div>
      <div class="stat-info"><h4>Completed</h4><div class="stat-value">${stats.completed || 0}</div></div>
    </div>
    <div class="stat-card danger">
      <div class="stat-icon danger">❌</div>
      <div class="stat-info"><h4>Rejected</h4><div class="stat-value">${stats.rejected || 0}</div></div>
    </div>
    <div class="stat-card" style="--stat-color: #a855f7;">
      <div class="stat-icon" style="background: #faf5ff; color: #a855f7;">🔄</div>
      <div class="stat-info"><h4>Needs Revision</h4><div class="stat-value">${stats.revisionRequested || 0}</div></div>
    </div>
  `;

  const content = document.getElementById('dashboard-content');
  let recentHTML = '<div class="empty-state"><div class="empty-icon">📄</div><h3>No documents yet</h3><p>Upload your first document to get started</p><a href="/upload.html" class="btn btn-primary">Upload Document</a></div>';
  if (stats.recentDocuments && stats.recentDocuments.length > 0) {
    recentHTML = stats.recentDocuments.map(doc => `
      <div class="activity-item">
        <div class="activity-icon" style="background:var(--primary-50);color:var(--primary-600);">📄</div>
        <div class="activity-text">
          <p><strong>${doc.title}</strong></p>
          <div class="activity-time">${App.getStatusBadge(doc.status)} • ${App.timeAgo(doc.updatedAt)}</div>
        </div>
      </div>
    `).join('');
  }

  content.innerHTML = `
    <div class="card">
      <div class="card-header"><h3>Recent Documents</h3><a href="/upload.html" class="btn btn-sm btn-primary">Upload New</a></div>
      <div class="card-body">${recentHTML}</div>
    </div>
    <div class="card">
      <div class="card-header"><h3>Quick Actions</h3></div>
      <div class="card-body">
        <a href="/upload.html" class="btn btn-primary" style="width:100%;margin-bottom:12px">📤 Upload Document</a>
        <a href="/profile.html" class="btn btn-outline" style="width:100%">👤 Edit Profile</a>
      </div>
    </div>
  `;
};

const renderManagerDashboard = (stats) => {
  const grid = document.getElementById('stats-grid');
  grid.innerHTML = `
    <div class="stat-card warning">
      <div class="stat-icon warning">⏳</div>
      <div class="stat-info"><h4>Pending Approvals</h4><div class="stat-value">${stats.pendingApprovals || 0}</div></div>
    </div>
    <div class="stat-card success">
      <div class="stat-icon success">✅</div>
      <div class="stat-info"><h4>Approved</h4><div class="stat-value">${stats.approved || 0}</div></div>
    </div>
    <div class="stat-card danger">
      <div class="stat-icon danger">❌</div>
      <div class="stat-info"><h4>Rejected</h4><div class="stat-value">${stats.rejected || 0}</div></div>
    </div>
    <div class="stat-card primary">
      <div class="stat-icon primary">📁</div>
      <div class="stat-info"><h4>Department Docs</h4><div class="stat-value">${stats.totalDepartmentDocs || 0}</div></div>
    </div>
  `;

  const content = document.getElementById('dashboard-content');
  let pendingHTML = '<div class="empty-state"><div class="empty-icon">✅</div><h3>All caught up!</h3><p>No pending approvals at the moment</p></div>';
  if (stats.recentPending && stats.recentPending.length > 0) {
    pendingHTML = stats.recentPending.map(doc => `
      <div class="activity-item">
        <div class="activity-icon" style="background:var(--warning-50);color:var(--warning-600);">⏳</div>
        <div class="activity-text">
          <p><strong>${doc.title}</strong></p>
          <div class="activity-time">by ${doc.uploadedBy ? doc.uploadedBy.name : 'Unknown'} • ${App.timeAgo(doc.createdAt)}</div>
        </div>
      </div>
    `).join('');
  }

  content.innerHTML = `
    <div class="card">
      <div class="card-header"><h3>Pending Reviews</h3><a href="/approvals.html" class="btn btn-sm btn-primary">View All</a></div>
      <div class="card-body">${pendingHTML}</div>
    </div>
    <div class="card">
      <div class="card-header"><h3>Quick Actions</h3></div>
      <div class="card-body">
        <a href="/approvals.html" class="btn btn-primary" style="width:100%;margin-bottom:12px">✅ Review Documents</a>
        <a href="/analytics.html" class="btn btn-outline" style="width:100%">📊 View Analytics</a>
      </div>
    </div>
  `;
};

const renderDirectorDashboard = (stats) => {
  const grid = document.getElementById('stats-grid');
  grid.innerHTML = `
    <div class="stat-card warning">
      <div class="stat-icon warning">⏳</div>
      <div class="stat-info"><h4>Pending Final Approval</h4><div class="stat-value">${stats.pendingApprovals || 0}</div></div>
    </div>
    <div class="stat-card success">
      <div class="stat-icon success">🎉</div>
      <div class="stat-info"><h4>Completed</h4><div class="stat-value">${stats.completed || 0}</div></div>
    </div>
    <div class="stat-card danger">
      <div class="stat-icon danger">❌</div>
      <div class="stat-info"><h4>Rejected</h4><div class="stat-value">${stats.rejected || 0}</div></div>
    </div>
    <div class="stat-card primary">
      <div class="stat-icon primary">📁</div>
      <div class="stat-info"><h4>Department Total</h4><div class="stat-value">${stats.totalDepartmentDocs || 0}</div></div>
    </div>
  `;

  const content = document.getElementById('dashboard-content');
  let pendingHTML = '<div class="empty-state"><div class="empty-icon">✅</div><h3>All caught up!</h3><p>No pending approvals</p></div>';
  if (stats.recentPending && stats.recentPending.length > 0) {
    pendingHTML = stats.recentPending.map(doc => `
      <div class="activity-item">
        <div class="activity-icon" style="background:var(--warning-50);color:var(--warning-600);">⏳</div>
        <div class="activity-text">
          <p><strong>${doc.title}</strong></p>
          <div class="activity-time">by ${doc.uploadedBy ? doc.uploadedBy.name : 'Unknown'} • ${App.timeAgo(doc.createdAt)}</div>
        </div>
      </div>
    `).join('');
  }

  content.innerHTML = `
    <div class="card">
      <div class="card-header"><h3>Awaiting Your Approval</h3><a href="/approvals.html" class="btn btn-sm btn-primary">View All</a></div>
      <div class="card-body">${pendingHTML}</div>
    </div>
    <div class="card">
      <div class="card-header"><h3>Quick Actions</h3></div>
      <div class="card-body">
        <a href="/approvals.html" class="btn btn-primary" style="width:100%;margin-bottom:12px">✅ Review Documents</a>
        <a href="/analytics.html" class="btn btn-outline" style="width:100%">📊 View Analytics</a>
      </div>
    </div>
  `;
};

const renderAdminDashboard = (stats) => {
  const grid = document.getElementById('stats-grid');
  grid.innerHTML = `
    <div class="stat-card primary">
      <div class="stat-icon primary">👥</div>
      <div class="stat-info"><h4>Total Users</h4><div class="stat-value">${stats.totalUsers || 0}</div></div>
    </div>
    <div class="stat-card success">
      <div class="stat-icon success">👤</div>
      <div class="stat-info"><h4>Active Users</h4><div class="stat-value">${stats.activeUsers || 0}</div></div>
    </div>
    <div class="stat-card info">
      <div class="stat-icon info">📄</div>
      <div class="stat-info"><h4>Total Documents</h4><div class="stat-value">${stats.totalDocuments || 0}</div></div>
    </div>
    <div class="stat-card warning">
      <div class="stat-icon warning">⏳</div>
      <div class="stat-info"><h4>Pending</h4><div class="stat-value">${stats.pendingDocuments || 0}</div></div>
    </div>
    <div class="stat-card success">
      <div class="stat-icon success">✅</div>
      <div class="stat-info"><h4>Completed</h4><div class="stat-value">${stats.completedDocuments || 0}</div></div>
    </div>
    <div class="stat-card danger">
      <div class="stat-icon danger">❌</div>
      <div class="stat-info"><h4>Rejected</h4><div class="stat-value">${stats.rejectedDocuments || 0}</div></div>
    </div>
  `;

  const content = document.getElementById('dashboard-content');
  let rolesHTML = '';
  if (stats.usersByRole && stats.usersByRole.length > 0) {
    rolesHTML = stats.usersByRole.map(r => `
      <div class="activity-item">
        <div class="activity-icon" style="background:var(--primary-50);color:var(--primary-600);">👤</div>
        <div class="activity-text">
          <p><strong>${r._id}</strong></p>
          <div class="activity-time">${r.count} user${r.count !== 1 ? 's' : ''}</div>
        </div>
      </div>
    `).join('');
  }

  content.innerHTML = `
    <div class="card">
      <div class="card-header"><h3>Users by Role</h3><a href="/users.html" class="btn btn-sm btn-primary">Manage Users</a></div>
      <div class="card-body">${rolesHTML || '<p style="color:var(--text-tertiary)">No data</p>'}</div>
    </div>
    <div class="card">
      <div class="card-header"><h3>Quick Actions</h3></div>
      <div class="card-body">
        <a href="/users.html" class="btn btn-primary" style="width:100%;margin-bottom:12px">👥 Manage Users</a>
        <a href="/analytics.html" class="btn btn-outline" style="width:100%;margin-bottom:12px">📊 View Analytics</a>
        <a href="/approvals.html" class="btn btn-outline" style="width:100%">📁 All Documents</a>
      </div>
    </div>
  `;
};
