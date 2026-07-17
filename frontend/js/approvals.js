/* ============================================
   ApprovalFlow — Approvals Page Logic
   ============================================ */

let currentTab = 'pending';
let currentPage = 1;
let pendingAction = null;
let searchTimeout = null;

document.addEventListener('DOMContentLoaded', async () => {
  const authed = await App.requireAuth();
  if (!authed) return;

  const user = App.getUser();
  Sidebar.render(user);
  NotificationPanel.renderPanel();
  SocketClient.connect();
  SocketClient.updateNotificationBadge();

  if (user.role === 'Admin') {
    document.getElementById('dept-filter').classList.remove('hidden');
    document.getElementById('approvals-title').textContent = 'All Documents';
    document.getElementById('approvals-subtitle').textContent = 'View and manage all system documents';
  }

  if (user.role === 'Employee') {
    window.location.href = '/upload.html';
    return;
  }

  loadCurrentTab();
});

const switchTab = (tab) => {
  currentTab = tab;
  currentPage = 1;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
  loadCurrentTab();
};

const loadCurrentTab = () => {
  if (currentTab === 'pending') loadPending();
  else loadHistory();
};

const debouncedSearch = () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => { currentPage = 1; loadCurrentTab(); }, 300);
};

const buildQuery = (page) => {
  const search = document.getElementById('search-input').value.trim();
  const status = document.getElementById('status-filter').value;
  const dept = document.getElementById('dept-filter').value;

  let q = `page=${page}&limit=10`;
  if (search) q += `&search=${encodeURIComponent(search)}`;
  if (status) q += `&status=${status}`;
  if (dept) q += `&department=${dept}`;
  return q;
};

const loadPending = async (page = 1) => {
  currentPage = page;
  try {
    const data = await App.get(`/documents/pending?${buildQuery(page)}`);
    if (data && data.data) {
      renderDocuments(data.data.documents, true);
      if (data.meta) App.renderPagination(data.meta, 'pagination-container', loadPending);
    }
  } catch { /* handled */ }
};

const loadHistory = async (page = 1) => {
  currentPage = page;
  const user = App.getUser();
  const url = user.role === 'Admin' ? `/documents/all?${buildQuery(page)}` : `/documents/history?${buildQuery(page)}`;
  try {
    const data = await App.get(url);
    if (data && data.data) {
      renderDocuments(data.data.documents, false);
      if (data.meta) App.renderPagination(data.meta, 'pagination-container', loadHistory);
    }
  } catch { /* handled */ }
};

const renderDocuments = (docs, showActions) => {
  const container = document.getElementById('documents-list');
  if (docs.length === 0) {
    container.innerHTML = `
      <div class="card"><div class="card-body">
        <div class="empty-state"><div class="empty-icon">📋</div><h3>No documents found</h3><p>${showActions ? 'No pending documents to review' : 'No documents match your filters'}</p></div>
      </div></div>`;
    return;
  }

  const user = App.getUser();
  container.innerHTML = `
    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Submitted By</th>
            <th>Department</th>
            <th>Status</th>
            <th>Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${docs.map(doc => `
            <tr>
              <td>
                <div>
                  <strong style="cursor:pointer;color:var(--primary-600)" onclick="viewDocument('${doc._id}')">${doc.title}</strong>
                  <div style="font-size:12px;color:var(--text-tertiary)">${App.getFileIcon(doc.file.mimeType)} ${doc.file.originalName} • ${App.formatFileSize(doc.file.size)}</div>
                </div>
              </td>
              <td>
                <div style="display:flex;align-items:center;gap:8px">
                  ${doc.uploadedBy ? App.getAvatarHTML(doc.uploadedBy, 'avatar-sm') : ''}<span style="font-size:13px">${doc.uploadedBy ? doc.uploadedBy.name : 'Unknown'}</span>
                </div>
              </td>
              <td><span style="font-size:13px">${doc.department}</span></td>
              <td>${App.getStatusBadge(doc.status)}</td>
              <td style="font-size:13px;color:var(--text-tertiary)">${App.formatDate(doc.createdAt)}</td>
              <td>
                <div style="display:flex;gap:6px;flex-wrap:wrap">
                  <button class="btn btn-sm btn-ghost" onclick="viewDocument('${doc._id}')" title="View">👁️</button>
                  ${showActions && canApprove(doc, user) ? `
                    <button class="btn btn-sm btn-success" onclick="openAction('${doc._id}','approve','${doc.title}')">✅</button>
                    <button class="btn btn-sm btn-danger" onclick="openAction('${doc._id}','reject','${doc.title}')">❌</button>
                    <button class="btn btn-sm btn-warning" onclick="openAction('${doc._id}','revision','${doc.title}')">🔄</button>
                  ` : ''}
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
};

const canApprove = (doc, user) => {
  if (user.role === 'Admin') return doc.status === 'ManagerApproved';
  if (user.role === 'Manager') return ['Submitted', 'UnderReview'].includes(doc.status);
  if (user.role === 'Director') return doc.status === 'ManagerApproved';
  return false;
};

const openAction = (docId, action, title) => {
  pendingAction = { docId, action };

  const labels = {
    approve: { title: 'Approve Document', desc: `Approve "${title}"?`, btn: 'Approve', class: 'btn-success' },
    reject: { title: 'Reject Document', desc: `Reject "${title}"? This cannot be undone.`, btn: 'Reject', class: 'btn-danger' },
    revision: { title: 'Request Revision', desc: `Request revision on "${title}"? The employee will need to edit and resubmit.`, btn: 'Request Revision', class: 'btn-warning' }
  };

  const label = labels[action];
  document.getElementById('action-modal-title').textContent = label.title;
  document.getElementById('action-modal-desc').textContent = label.desc;
  document.getElementById('action-comment').value = '';

  const btn = document.getElementById('action-confirm-btn');
  btn.textContent = label.btn;
  btn.className = `btn ${label.class}`;

  App.openModal('action-modal');
};

const confirmAction = async () => {
  if (!pendingAction) return;

  const comment = document.getElementById('action-comment').value.trim();
  App.showLoading();

  try {
    await App.put(`/documents/${pendingAction.docId}/${pendingAction.action}`, { comment });
    Toast.success(`Document ${pendingAction.action === 'revision' ? 'revision requested' : pendingAction.action + 'd'} successfully!`);
    App.closeModal('action-modal');
    loadCurrentTab();
  } catch { /* handled */ } finally {
    App.hideLoading();
    pendingAction = null;
  }
};

const viewDocument = async (id) => {
  App.showLoading();
  try {
    const data = await App.get(`/documents/${id}`);
    if (data && data.data) {
      const doc = data.data.document;
      const comments = data.data.comments || [];

      document.getElementById('detail-title').textContent = doc.title;

      let historyHTML = '';
      if (doc.approvalHistory && doc.approvalHistory.length > 0) {
        historyHTML = `
          <h4 style="margin:20px 0 12px;font-weight:700">Approval History</h4>
          <div class="timeline">
            ${doc.approvalHistory.map(h => `
              <div class="timeline-item">
                <div class="timeline-dot ${h.action === 'Approved' ? 'approved' : h.action === 'Rejected' ? 'rejected' : 'revision'}"></div>
                <div class="timeline-content">
                  <h5>${h.action} by ${h.user ? h.user.name : 'Unknown'}</h5>
                  <p>${h.comment || 'No comment'}</p>
                  <div class="timeline-meta">${h.role} • ${h.department} • ${App.formatDateTime(h.timestamp)}</div>
                </div>
              </div>
            `).join('')}
          </div>
        `;
      }

      let commentsHTML = '';
      if (comments.length > 0) {
        commentsHTML = `
          <h4 style="margin:20px 0 12px;font-weight:700">Comments</h4>
          ${comments.map(c => `
            <div class="activity-item">
              ${c.user ? App.getAvatarHTML(c.user, 'avatar-sm') : ''}
              <div class="activity-text">
                <p><strong>${c.user ? c.user.name : 'Unknown'}</strong> <span style="color:var(--text-tertiary)">(${c.role})</span></p>
                <p>${c.content}</p>
                <div class="activity-time">${App.formatDateTime(c.createdAt)}</div>
              </div>
            </div>
          `).join('')}
        `;
      }

      let previewHTML = '';
      if (doc.file.mimeType === 'application/pdf') {
        previewHTML = `<iframe src="${doc.file.path}" width="100%" height="400px" style="border:1px solid var(--border-color);border-radius:var(--radius-md);"></iframe>`;
      } else {
        previewHTML = `<div style="padding:20px;background:var(--bg-secondary);border-radius:var(--radius-md);text-align:center;">
          <p style="margin-bottom:10px;color:var(--text-secondary)">Preview not available. Please download the document.</p>
          <button class="btn btn-primary" onclick="window.location.href='/api/documents/${doc._id}/download'">Download</button>
        </div>`;
      }

      document.getElementById('detail-body').innerHTML = `
        <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:20px">
          <div style="flex:1;min-width:200px">
            <p style="font-size:13px;color:var(--text-tertiary)">Status</p>
            <p>${App.getStatusBadge(doc.status)}</p>
          </div>
          <div style="flex:1;min-width:200px">
            <p style="font-size:13px;color:var(--text-tertiary)">Department</p>
            <p style="font-weight:600">${doc.department}</p>
          </div>
          <div style="flex:1;min-width:200px">
            <p style="font-size:13px;color:var(--text-tertiary)">Uploaded By</p>
            <p style="font-weight:600">${doc.uploadedBy ? doc.uploadedBy.name : 'Unknown'}</p>
          </div>
          <div style="flex:1;min-width:200px">
            <p style="font-size:13px;color:var(--text-tertiary)">Version</p>
            <p style="font-weight:600">v${doc.version}</p>
          </div>
        </div>
        ${doc.description ? `<p style="color:var(--text-secondary);margin-bottom:16px">${doc.description}</p>` : ''}
        <div class="file-preview">
          <span class="file-icon">${App.getFileIcon(doc.file.mimeType)}</span>
          <div class="file-info">
            <div class="file-name">${doc.file.originalName}</div>
            <div class="file-size">${App.formatFileSize(doc.file.size)}</div>
          </div>
          <button class="btn btn-sm btn-outline" onclick="window.location.href='/api/documents/${doc._id}/download'">Download</button>
        </div>
        <div style="margin-top:20px;">
          ${previewHTML}
        </div>
        ${historyHTML}
        ${commentsHTML}
      `;
      App.openModal('detail-modal');
    }
  } catch { /* handled */ } finally { App.hideLoading(); }
};
