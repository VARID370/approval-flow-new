/* ============================================
   ApprovalFlow — Analytics Page Logic
   ============================================ */

document.addEventListener('DOMContentLoaded', async () => {
  const authed = await App.requireAuth();
  if (!authed) return;

  const user = App.getUser();
  Sidebar.render(user);
  NotificationPanel.renderPanel();
  SocketClient.connect();
  SocketClient.updateNotificationBadge();

  loadAnalytics();
});

const loadAnalytics = async () => {
  App.showLoading();
  try {
    const data = await App.get('/analytics/full');
    if (data && data.data) {
      const a = data.data.analytics;
      renderStats(a);
      drawStatusChart(a.documentsByStatus || []);
      drawDeptChart(a.documentsByDepartment || []);
      drawTrendChart(a.monthlyTrend || []);
    }
  } catch { /* handled */ } finally {
    App.hideLoading();
  }
};

const renderStats = (a) => {
  const el = document.getElementById('analytics-stats');
  el.innerHTML = `
    <div class="stat-card primary">
      <div class="stat-icon primary">👥</div>
      <div class="stat-info"><h4>Total Users</h4><div class="stat-value">${a.totalUsers || 0}</div></div>
    </div>
    <div class="stat-card info">
      <div class="stat-icon info">📄</div>
      <div class="stat-info"><h4>Total Documents</h4><div class="stat-value">${a.totalDocuments || 0}</div></div>
    </div>
    <div class="stat-card warning">
      <div class="stat-icon warning">⏳</div>
      <div class="stat-info"><h4>Pending</h4><div class="stat-value">${a.pendingDocuments || 0}</div></div>
    </div>
    <div class="stat-card success">
      <div class="stat-icon success">✅</div>
      <div class="stat-info"><h4>Completed</h4><div class="stat-value">${a.completedDocuments || 0}</div></div>
    </div>
    <div class="stat-card danger">
      <div class="stat-icon danger">❌</div>
      <div class="stat-info"><h4>Rejected</h4><div class="stat-value">${a.rejectedDocuments || 0}</div></div>
    </div>
    <div class="stat-card" style="overflow:visible">
      <div class="stat-icon" style="background:var(--primary-50);color:var(--primary-600)">⏱️</div>
      <div class="stat-info"><h4>Avg. Approval Time</h4><div class="stat-value">${a.avgApprovalTimeHours || 0}h</div></div>
    </div>
  `;
};

/* ── Canvas Chart Helpers ── */

const getThemeColors = () => {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  return {
    text: isDark ? '#94a3b8' : '#6b7280',
    grid: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
    bg: isDark ? '#1a1a3e' : '#ffffff'
  };
};

const statusColors = {
  'Draft': '#9ca3af', 'Submitted': '#3b82f6', 'UnderReview': '#f59e0b',
  'ManagerApproved': '#f97316', 'Completed': '#10b981', 'Rejected': '#ef4444',
  'RevisionRequested': '#a855f7'
};

const deptColors = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#14b8a6'];

const drawStatusChart = (data) => {
  const canvas = document.getElementById('status-chart');
  if (!canvas || data.length === 0) return;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const w = rect.width;
  const h = rect.height;
  const cx = w / 2;
  const cy = h / 2 - 10;
  const radius = Math.min(cx, cy) - 40;
  const total = data.reduce((sum, d) => sum + d.count, 0);

  let startAngle = -Math.PI / 2;
  data.forEach((d) => {
    const sliceAngle = (d.count / total) * 2 * Math.PI;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, startAngle, startAngle + sliceAngle);
    ctx.closePath();
    ctx.fillStyle = statusColors[d._id] || '#9ca3af';
    ctx.fill();
    startAngle += sliceAngle;
  });

  // Inner circle for donut effect
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.6, 0, Math.PI * 2);
  ctx.fillStyle = getThemeColors().bg;
  ctx.fill();

  // Center text
  ctx.fillStyle = getThemeColors().text;
  ctx.font = 'bold 24px Inter';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(total.toString(), cx, cy - 8);
  ctx.font = '12px Inter';
  ctx.fillText('Total', cx, cy + 12);

  // Legend
  let legendY = h - 20;
  let legendX = 10;
  ctx.font = '11px Inter';
  data.forEach((d) => {
    ctx.fillStyle = statusColors[d._id] || '#9ca3af';
    ctx.fillRect(legendX, legendY - 8, 10, 10);
    ctx.fillStyle = getThemeColors().text;
    ctx.textAlign = 'left';
    ctx.fillText(`${d._id} (${d.count})`, legendX + 14, legendY);
    legendX += ctx.measureText(`${d._id} (${d.count})`).width + 28;
    if (legendX > w - 80) { legendX = 10; legendY += 16; }
  });
};

const drawDeptChart = (data) => {
  const canvas = document.getElementById('dept-chart');
  if (!canvas || data.length === 0) return;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const w = rect.width;
  const h = rect.height;
  const theme = getThemeColors();
  const padding = { top: 20, right: 20, bottom: 60, left: 50 };
  const chartW = w - padding.left - padding.right;
  const chartH = h - padding.top - padding.bottom;
  const maxVal = Math.max(...data.map(d => d.count), 1);
  const barWidth = Math.min(50, (chartW / data.length) * 0.6);
  const gap = (chartW - barWidth * data.length) / (data.length + 1);

  // Grid lines
  ctx.strokeStyle = theme.grid;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(w - padding.right, y);
    ctx.stroke();

    ctx.fillStyle = theme.text;
    ctx.font = '11px Inter';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(maxVal - (maxVal / 4) * i), padding.left - 8, y + 4);
  }

  // Bars
  data.forEach((d, i) => {
    const x = padding.left + gap + i * (barWidth + gap);
    const barH = (d.count / maxVal) * chartH;
    const y = padding.top + chartH - barH;

    const gradient = ctx.createLinearGradient(x, y, x, y + barH);
    const color = deptColors[i % deptColors.length];
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, color + '88');
    ctx.fillStyle = gradient;

    ctx.beginPath();
    ctx.roundRect(x, y, barWidth, barH, [4, 4, 0, 0]);
    ctx.fill();

    // Label
    ctx.fillStyle = theme.text;
    ctx.font = '11px Inter';
    ctx.textAlign = 'center';
    ctx.save();
    ctx.translate(x + barWidth / 2, padding.top + chartH + 16);
    ctx.rotate(-0.4);
    ctx.fillText(d._id, 0, 0);
    ctx.restore();

    // Value
    ctx.fillStyle = color;
    ctx.font = 'bold 12px Inter';
    ctx.textAlign = 'center';
    ctx.fillText(d.count, x + barWidth / 2, y - 6);
  });
};

const drawTrendChart = (data) => {
  const canvas = document.getElementById('trend-chart');
  if (!canvas || data.length === 0) return;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const w = rect.width;
  const h = rect.height;
  const theme = getThemeColors();
  const padding = { top: 20, right: 20, bottom: 50, left: 50 };
  const chartW = w - padding.left - padding.right;
  const chartH = h - padding.top - padding.bottom;

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const maxVal = Math.max(...data.map(d => d.total), 1);

  // Grid
  ctx.strokeStyle = theme.grid;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(w - padding.right, y);
    ctx.stroke();

    ctx.fillStyle = theme.text;
    ctx.font = '11px Inter';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(maxVal - (maxVal / 4) * i), padding.left - 8, y + 4);
  }

  const drawLine = (values, color) => {
    if (values.length === 0) return;
    const stepX = chartW / Math.max(values.length - 1, 1);

    // Fill
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top + chartH);
    values.forEach((v, i) => {
      const x = padding.left + i * stepX;
      const y = padding.top + chartH - (v / maxVal) * chartH;
      ctx.lineTo(x, y);
    });
    ctx.lineTo(padding.left + (values.length - 1) * stepX, padding.top + chartH);
    ctx.closePath();
    ctx.fillStyle = color + '15';
    ctx.fill();

    // Line
    ctx.beginPath();
    values.forEach((v, i) => {
      const x = padding.left + i * stepX;
      const y = padding.top + chartH - (v / maxVal) * chartH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Points
    values.forEach((v, i) => {
      const x = padding.left + i * stepX;
      const y = padding.top + chartH - (v / maxVal) * chartH;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fillStyle = theme.bg;
      ctx.fill();
    });
  };

  drawLine(data.map(d => d.total), '#6366f1');
  drawLine(data.map(d => d.completed), '#10b981');
  drawLine(data.map(d => d.rejected), '#ef4444');

  // X Labels
  const stepX = chartW / Math.max(data.length - 1, 1);
  ctx.fillStyle = theme.text;
  ctx.font = '11px Inter';
  ctx.textAlign = 'center';
  data.forEach((d, i) => {
    const x = padding.left + i * stepX;
    ctx.fillText(months[d._id.month - 1] + ' ' + d._id.year, x, padding.top + chartH + 20);
  });

  // Legend
  const legendY = h - 10;
  ctx.font = '11px Inter';
  [{ label: 'Total', color: '#6366f1' }, { label: 'Completed', color: '#10b981' }, { label: 'Rejected', color: '#ef4444' }].forEach((item, i) => {
    const x = padding.left + i * 100;
    ctx.fillStyle = item.color;
    ctx.fillRect(x, legendY - 8, 10, 10);
    ctx.fillStyle = theme.text;
    ctx.textAlign = 'left';
    ctx.fillText(item.label, x + 14, legendY);
  });
};
