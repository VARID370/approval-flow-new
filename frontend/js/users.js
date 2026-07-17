/* ============================================
   ApprovalFlow — User Management Logic
   ============================================ */

let currentPage = 1;
let selectedUserId = null;
let searchTimeout = null;

document.addEventListener('DOMContentLoaded', async () => {
  const authed = await App.requireAuth();
  if (!authed) return;

  const user = App.getUser();
  if (user.role !== 'Admin') {
    window.location.href = '/dashboard.html';
    return;
  }

  Sidebar.render(user);
  NotificationPanel.renderPanel();
  SocketClient.connect();
  SocketClient.updateNotificationBadge();
  loadUsers();
});

const loadUsers = async (page = 1) => {
  currentPage = page;
  const search = document.getElementById('search-input').value.trim();
  const role = document.getElementById('role-filter').value;
  const dept = document.getElementById('dept-filter').value;
  const status = document.getElementById('status-filter').value;
  const sort = document.getElementById('sort-filter').value;
  let url = `/users?page=${page}&limit=10`;
  if (search) url += `&search=${encodeURIComponent(search)}`;
  if (role) url += `&role=${role}`;
  if (dept) url += `&department=${dept}`;
  if (status) url += `&isActive=${status}`;
  if (sort) url += `&sort=${sort}`;

  try {
    const data = await App.get(url);
    if (data && data.data) {
      renderUsers(data.data.users);
      if (data.meta) App.renderPagination(data.meta, 'pagination-container', loadUsers);
    }
  } catch { /* handled */ }
};

const debouncedSearch = () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => { currentPage = 1; loadUsers(); }, 300);
};

const renderUsers = (users) => {
  const tbody = document.getElementById('users-tbody');
  if (users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">👥</div><h3>No users found</h3></div></td></tr>`;
    return;
  }

  const currentUserId = App.getUser()._id || App.getUser().id;

  tbody.innerHTML = users.map(u => {
    const userId = u._id || u.id;
    const isSelf = userId === currentUserId;
    return `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          ${App.getAvatarHTML(u, 'avatar-sm')}
          <strong>${u.name}</strong>
        </div>
      </td>
      <td style="font-size:13px;color:var(--text-secondary)">${u.email}</td>
      <td>${App.getRoleBadge(u.role)}</td>
      <td style="font-size:13px">${u.department}</td>
      <td>
        <span class="badge ${u.isActive ? 'badge-success' : 'badge-danger'}">
          ${u.isActive ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td style="font-size:13px;color:var(--text-tertiary)">${App.formatDate(u.createdAt)}</td>
      <td>
        ${isSelf ? '<span style="font-size:12px;color:var(--text-tertiary)">You</span>' : `
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="btn btn-sm btn-outline" onclick="openEditUserModal('${userId}', '${u.name}', '${u.email}', '${u.department}')" title="Edit User">✏️</button>
            <button class="btn btn-sm btn-outline" onclick="openRoleModal('${userId}','${u.name}','${u.role}')" title="Change Role">👤</button>
            <button class="btn btn-sm btn-outline" onclick="toggleStatus('${userId}', ${u.isActive})" title="${u.isActive ? 'Deactivate' : 'Activate'}">${u.isActive ? '⏸️' : '▶️'}</button>
            <button class="btn btn-sm btn-outline" onclick="openResetModal('${userId}')" title="Reset Password">🔑</button>
            <button class="btn btn-sm btn-danger" onclick="openDeleteModal('${userId}', '${u.name.replace(/'/g, "\\'")}', '${u.email.replace(/'/g, "\\'")}')" title="Delete">🗑️</button>
          </div>
        `}
      </td>
    </tr>
  `;}).join('');
};

const openRoleModal = (id, name, currentRole) => {
  selectedUserId = id;
  document.getElementById('role-modal-user').textContent = `Change role for: ${name} (currently ${currentRole})`;
  document.getElementById('new-role').value = currentRole;
  App.openModal('role-modal');
};

const confirmRoleChange = async () => {
  if (!selectedUserId) return;
  const role = document.getElementById('new-role').value;

  if (!confirm('Are you sure you want to change this user\'s role?')) return;

  App.showLoading();
  try {
    await App.put(`/users/${selectedUserId}/role`, { role });
    Toast.success('Role updated successfully');
    App.closeModal('role-modal');
    loadUsers(currentPage);
  } catch { /* handled */ } finally {
    App.hideLoading();
    selectedUserId = null;
  }
};


const openDeleteModal = (id, name, email) => {
  selectedUserId = id;
  document.getElementById('delete-user-name').textContent = name;
  document.getElementById('delete-user-email').textContent = email;
  App.openModal('delete-modal');
};

const confirmDeleteUser = async () => {
  if (!selectedUserId) return;
  App.showLoading();
  try {
    const data = await App.del(`/users/${selectedUserId}`);
    if (data) Toast.success(data.message || 'User deleted successfully');
    App.closeModal('delete-modal');
    loadUsers(currentPage);
  } catch { /* handled */ } finally {
    App.hideLoading();
    selectedUserId = null;
  }
};

const toggleStatus = async (id, isActive) => {
  if (!confirm(`Are you sure you want to ${isActive ? 'deactivate' : 'activate'} this user?`)) return;
  App.showLoading();
  try {
    await App.put(`/users/${id}/toggle-status`);
    Toast.success(`User ${isActive ? 'deactivated' : 'activated'} successfully`);
    loadUsers(currentPage);
  } catch { /* handled */ } finally { App.hideLoading(); }
};

const openCreateUserModal = () => {
  selectedUserId = null;
  document.getElementById('user-modal-title').textContent = 'Create User';
  document.getElementById('user-form').reset();
  document.getElementById('user-password-group').style.display = 'block';
  document.getElementById('user-password').required = true;
  document.getElementById('user-role-group').style.display = 'block';
  App.openModal('user-modal');
};

const openEditUserModal = (id, name, email, dept) => {
  selectedUserId = id;
  document.getElementById('user-modal-title').textContent = 'Edit User';
  document.getElementById('user-name').value = name;
  document.getElementById('user-email').value = email;
  document.getElementById('user-dept').value = dept;
  document.getElementById('user-password-group').style.display = 'none';
  document.getElementById('user-password').required = false;
  document.getElementById('user-role-group').style.display = 'none';
  App.openModal('user-modal');
};

const saveUser = async () => {
  const name = document.getElementById('user-name').value;
  const email = document.getElementById('user-email').value;
  const department = document.getElementById('user-dept').value;
  
  if (!name || !email || !department) return Toast.error('Please fill all required fields');
  
  App.showLoading();
  try {
    if (selectedUserId) {
      await App.put(`/users/${selectedUserId}`, { name, email, department });
      Toast.success('User updated successfully');
    } else {
      const password = document.getElementById('user-password').value;
      const role = document.getElementById('user-role').value;
      if (!password) return Toast.error('Password is required');
      await App.post('/users', { name, email, password, department, role });
      Toast.success('User created successfully');
    }
    App.closeModal('user-modal');
    loadUsers(currentPage);
  } catch { /* handled */ } finally { App.hideLoading(); }
};

const openResetModal = (id) => {
  selectedUserId = id;
  document.getElementById('reset-password').value = '';
  App.openModal('reset-modal');
};

const confirmResetPassword = async () => {
  if (!selectedUserId) return;
  const password = document.getElementById('reset-password').value;
  if (!password) return Toast.error('Please enter a new password');
  
  App.showLoading();
  try {
    await App.put(`/users/${selectedUserId}/reset-password`, { password });
    Toast.success('Password reset successfully');
    App.closeModal('reset-modal');
  } catch { /* handled */ } finally { App.hideLoading(); }
};
