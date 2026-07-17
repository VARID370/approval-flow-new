/* ============================================
   ApprovalFlow — Upload / My Documents Logic
   ============================================ */

let currentPage = 1;
let selectedFile = null;
let searchTimeout = null;

document.addEventListener('DOMContentLoaded', async () => {
  const authed = await App.requireAuth();
  if (!authed) return;

  const user = App.getUser();
  if (user.role === 'Admin') {
    window.location.href = '/dashboard.html';
    return;
  }

  Sidebar.render(user);
  NotificationPanel.renderPanel();
  SocketClient.connect();
  SocketClient.updateNotificationBadge();

  setupDragDrop();
  loadDocuments();
});

const setupDragDrop = () => {
  const zone = document.getElementById('upload-zone');
  const input = document.getElementById('doc-file');

  zone.addEventListener('click', () => input.click());
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) handleFileSelect(e.dataTransfer.files[0]);
  });

  input.addEventListener('change', (e) => {
    if (e.target.files.length > 0) handleFileSelect(e.target.files[0]);
  });
};

const handleFileSelect = (file) => {
  const allowed = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  if (!allowed.includes(file.type)) {
    Toast.error('Only PDF, DOC, and DOCX files are allowed');
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    Toast.error('File size must be under 10 MB');
    return;
  }
  selectedFile = file;
  document.getElementById('file-preview-area').innerHTML = `
    <div class="file-preview">
      <span class="file-icon">${App.getFileIcon(file.type)}</span>
      <div class="file-info">
        <div class="file-name">${file.name}</div>
        <div class="file-size">${App.formatFileSize(file.size)}</div>
      </div>
      <button class="file-remove" onclick="removeFile()">✕</button>
    </div>
  `;
};

const removeFile = () => {
  selectedFile = null;
  document.getElementById('file-preview-area').innerHTML = '';
  document.getElementById('doc-file').value = '';
};

const showUploadForm = () => document.getElementById('upload-card').classList.remove('hidden');
const hideUploadForm = () => {
  document.getElementById('upload-card').classList.add('hidden');
  document.getElementById('upload-form').reset();
  removeFile();
};

const submitUpload = async (saveAsDraft) => {
  const title = document.getElementById('doc-title').value.trim();
  if (!title || title.length < 3) { Toast.error('Title must be at least 3 characters'); return; }
  if (!selectedFile) { Toast.error('Please select a file'); return; }

  const formData = new FormData();
  formData.append('title', title);
  formData.append('description', document.getElementById('doc-description').value.trim());
  formData.append('file', selectedFile);
  formData.append('saveAsDraft', saveAsDraft);

  App.showLoading();
  try {
    const data = await App.post('/documents/upload', formData);
    if (data) {
      Toast.success(saveAsDraft === 'true' ? 'Draft saved!' : 'Document submitted!');
      hideUploadForm();
      loadDocuments();
    }
  } catch { /* handled by App */ } finally { App.hideLoading(); }
};

const loadDocuments = async (page = 1) => {
  currentPage = page;
  const search = document.getElementById('search-input').value.trim();
  const status = document.getElementById('status-filter').value;

  let url = `/documents/my?page=${page}&limit=10`;
  if (search) url += `&search=${encodeURIComponent(search)}`;
  if (status) url += `&status=${status}`;

  try {
    const data = await App.get(url);
    if (data && data.data) {
      renderDocuments(data.data.documents);
      if (data.meta) App.renderPagination(data.meta, 'pagination-container', loadDocuments);
    }
  } catch { /* handled */ }
};

const debouncedSearch = () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => loadDocuments(), 300);
};

const renderDocuments = (docs) => {
  const tbody = document.getElementById('documents-tbody');
  if (docs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">📄</div><h3>No documents found</h3><p>Upload your first document to get started</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = docs.map(doc => `
    <tr>
      <td><strong class="truncate" style="max-width:200px;display:inline-block">${doc.title}</strong></td>
      <td>
        <span style="display:flex;align-items:center;gap:6px">
          ${App.getFileIcon(doc.file.mimeType)}
          <span style="font-size:12px;color:var(--text-tertiary)">${App.formatFileSize(doc.file.size)}</span>
        </span>
      </td>
      <td>${App.getStatusBadge(doc.status)}</td>
      <td style="color:var(--text-tertiary)">v${doc.version}</td>
      <td style="font-size:13px;color:var(--text-tertiary)">${App.formatDate(doc.createdAt)}</td>
      <td>
        <div style="display:flex;gap:6px">
          ${doc.file.mimeType === 'application/pdf' ? `<button class="btn btn-sm btn-ghost" onclick="previewDoc('${doc._id}','${doc.title}','${doc.file.path}')" title="Preview">👁️</button>` : ''}
          <button class="btn btn-sm btn-ghost" onclick="downloadDoc('${doc._id}')" title="Download">⬇️</button>
          ${doc.status === 'Draft' || doc.status === 'RevisionRequested' ? `
            <button class="btn btn-sm btn-ghost" onclick="editDoc('${doc._id}')" title="Edit">✏️</button>
            <button class="btn btn-sm btn-ghost" onclick="submitDoc('${doc._id}')" title="Submit">📤</button>
          ` : ''}
          ${doc.status === 'Draft' ? `<button class="btn btn-sm btn-ghost" style="color:var(--danger-500)" onclick="deleteDoc('${doc._id}')" title="Delete">🗑️</button>` : ''}
        </div>
      </td>
    </tr>
  `).join('');
};

const previewDoc = (id, title, filePath) => {
  document.getElementById('preview-title').textContent = title;
  document.getElementById('preview-body').innerHTML = `<iframe src="${filePath}" class="doc-preview-frame"></iframe>`;
  App.openModal('preview-modal');
};

const downloadDoc = (id) => {
  window.location.href = `/api/documents/${id}/download`;
  Toast.success('Download started');
};

const editDoc = async (id) => {
  try {
    const data = await App.get(`/documents/${id}`);
    if (data && data.data) {
      const doc = data.data.document;
      document.getElementById('edit-doc-id').value = doc._id;
      document.getElementById('edit-title').value = doc.title;
      document.getElementById('edit-description').value = doc.description || '';
      App.openModal('edit-modal');
    }
  } catch { /* handled */ }
};

const saveEdit = async () => {
  const id = document.getElementById('edit-doc-id').value;
  const title = document.getElementById('edit-title').value.trim();
  if (!title) { Toast.error('Title is required'); return; }

  const formData = new FormData();
  formData.append('title', title);
  formData.append('description', document.getElementById('edit-description').value.trim());

  const file = document.getElementById('edit-file').files[0];
  if (file) formData.append('file', file);

  App.showLoading();
  try {
    const data = await App.put(`/documents/${id}`, formData);
    if (data) {
      Toast.success('Document updated!');
      App.closeModal('edit-modal');
      loadDocuments(currentPage);
    }
  } catch { /* handled */ } finally { App.hideLoading(); }
};

const submitDoc = async (id) => {
  if (!confirm('Submit this document for approval?')) return;
  App.showLoading();
  try {
    await App.put(`/documents/${id}/submit`);
    Toast.success('Document submitted for approval!');
    loadDocuments(currentPage);
  } catch { /* handled */ } finally { App.hideLoading(); }
};

const deleteDoc = async (id) => {
  if (!confirm('Delete this draft permanently?')) return;
  App.showLoading();
  try {
    await App.del(`/documents/${id}`);
    Toast.success('Document deleted');
    loadDocuments(currentPage);
  } catch { /* handled */ } finally { App.hideLoading(); }
};
