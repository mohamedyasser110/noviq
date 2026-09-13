/* ============================================================
   BUILD MONITOR — live site traffic monitoring page
   ============================================================ */

function renderMonitorPage(param, container) {
  // Module-level timer to avoid duplicate polls
  if (renderMonitorPage._timer) {
    clearInterval(renderMonitorPage._timer);
    renderMonitorPage._timer = null;
  }

  // Last known data for fallback
  let lastData = null;

  // Helper to get API URL
  const getApiUrl = (path) => {
    if (typeof NoviqAPI !== 'undefined') {
      return NoviqAPI.url(path);
    }
    return ((window.NOVIQ_API_URL || '') + '/api' + (path || ''));
  };

  // Helper to check if t() function exists
  const translate = (key) => {
    return typeof t !== 'undefined' ? t(key) : key;
  };

  // Initial HTML structure
  container.innerHTML = `
    <div class="noviq-page-hero">
      <div class="noviq-breadcrumb"><a href="#/home">${translate('Home')}</a> <span>/</span> <span>${translate('Live Monitor')}</span></div>
      <div class="reveal noviq-hero-badge"><i data-lucide="activity" style="width:14px;height:14px"></i> ${translate('Real-time')}</div>
      <h1>${translate('Live Site Monitor')}</h1>
      <p>${translate('Track active visitors, page views, and traffic patterns in real-time.')}</p>
    </div>
    <div class="noviq-page-section">
      <div style="max-width:1200px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:24px">
        <!-- Active Visitors Card -->
        <div class="noviq-glass-card" style="padding:28px;position:relative">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
            <div class="noviq-icon-badge" style="background:var(--primary);color:white"><i data-lucide="users" style="width:18px;height:18px"></i></div>
            <h3 style="margin:0;font-size:14px;color:var(--text-secondary)">${translate('Active Visitors')}</h3>
          </div>
          <div style="display:flex;align-items:baseline;gap:8px">
            <span id="active-visitors" style="font-size:36px;font-weight:700;color:var(--text)">0</span>
            <span id="active-pulse" style="width:8px;height:8px;background:var(--primary);border-radius:50%;opacity:0;transition:opacity 0.5s,transform 0.5s"></span>
          </div>
          <div style="margin-top:8px;font-size:12px;color:var(--text-secondary)">${translate('Updated just now')}</div>
        </div>

        <!-- Total Views Card -->
        <div class="noviq-glass-card" style="padding:28px">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
            <div class="noviq-icon-badge" style="background:var(--success);color:white"><i data-lucide="eye" style="width:18px;height:18px"></i></div>
            <h3 style="margin:0;font-size:14px;color:var(--text-secondary)">${translate('Total Views')}</h3>
          </div>
          <div style="font-size:36px;font-weight:700;color:var(--text)">
            <span id="total-views">0</span>
          </div>
          <div style="margin-top:8px;font-size:12px;color:var(--text-secondary)">${translate('All time')}</div>
        </div>

        <!-- Top Pages Card -->
        <div class="noviq-glass-card" style="padding:28px">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
            <div class="noviq-icon-badge" style="background:var(--warning);color:white"><i data-lucide="file-text" style="width:18px;height:18px"></i></div>
            <h3 style="margin:0;font-size:14px;color:var(--text-secondary)">${translate('Top Pages')}</h3>
          </div>
          <div id="top-pages" style="display:flex;flex-direction:column;gap:8px">
            <div style="font-size:12px;color:var(--text-secondary);padding:8px 0">${translate('Loading...')}</div>
          </div>
        </div>

        <!-- Recent Activity Card -->
        <div class="noviq-glass-card" style="padding:28px">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
            <div class="noviq-icon-badge" style="background:var(--info);color:white"><i data-lucide="clock" style="width:18px;height:18px"></i></div>
            <h3 style="margin:0;font-size:14px;color:var(--text-secondary)">${translate('Recent Activity')}</h3>
          </div>
          <div id="recent-activity" style="display:flex;flex-direction:column;gap:8px;max-height:120px;overflow-y:auto">
            <div style="font-size:12px;color:var(--text-secondary);padding:8px 0">${translate('Loading...')}</div>
          </div>
        </div>
      </div>

      <!-- Per-Minute Traffic Chart -->
      <div class="noviq-glass-card" style="padding:28px;margin-top:24px;max-width:1200px;margin-left:auto;margin-right:auto">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
          <div class="noviq-icon-badge" style="background:var(--primary);color:white"><i data-lucide="bar-chart-3" style="width:18px;height:18px"></i></div>
          <h3 style="margin:0;font-size:14px;color:var(--text-secondary)">${translate('Traffic Last 60 Minutes')}</h3>
        </div>
        <div id="traffic-chart" style="display:flex;align-items:flex-end;gap:4px;height:120px">
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:10px;color:var(--text-secondary)">
          <span>0</span>
          <span>10</span>
          <span>20</span>
          <span>30</span>
          <span>40</span>
          <span>50</span>
          <span>60</span>
        </div>
      </div>

      <!-- Status indicator -->
      <div id="monitor-status" style="text-align:center;margin-top:20px;font-size:12px;color:var(--text-secondary)"></div>
    </div>`;

  // Function to update the dashboard
  const updateDashboard = (data) => {
    lastData = data;

    // Update active visitors with pulse effect
    const activeEl = container.querySelector('#active-visitors');
    const pulseEl = container.querySelector('#active-pulse');
    if (activeEl && data.activeVisitors !== undefined) {
      const current = parseInt(activeEl.textContent) || 0;
      const next = data.activeVisitors || 0;
      if (current !== next) {
        activeEl.textContent = next;
        // Trigger pulse animation
        if (pulseEl) {
          pulseEl.style.opacity = '1';
          pulseEl.style.transform = 'scale(1)';
          setTimeout(() => {
            pulseEl.style.opacity = '0';
            pulseEl.style.transform = 'scale(0.5)';
          }, 300);
        }
      }
    }

    // Update total views
    const totalEl = container.querySelector('#total-views');
    if (totalEl && data.totalViews !== undefined) {
      totalEl.textContent = data.totalViews || 0;
    }

    // Update top pages
    const topPagesEl = container.querySelector('#top-pages');
    if (topPagesEl && data.topPages) {
      const topPages = data.topPages.slice(0, 5); // Show top 5
      if (topPages.length === 0) {
        topPagesEl.innerHTML = `<div style="font-size:12px;color:var(--text-secondary);padding:8px 0">${translate('No data yet')}</div>`;
      } else {
        topPagesEl.innerHTML = topPages.map((page, index) => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);${index === topPages.length - 1 ? 'border-bottom:none' : ''}">
            <span style="font-size:13px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:180px">${page.path || translate('Unknown')}</span>
            <span style="font-size:12px;color:var(--primary);font-weight:600">${page.views || 0}</span>
          </div>
        `).join('');
      }
    }

    // Update recent activity
    const recentEl = container.querySelector('#recent-activity');
    if (recentEl && data.recent) {
      const recent = data.recent.slice(0, 8); // Show last 8
      if (recent.length === 0) {
        recentEl.innerHTML = `<div style="font-size:12px;color:var(--text-secondary);padding:8px 0">${translate('No recent activity')}</div>`;
      } else {
        recentEl.innerHTML = recent.map(activity => {
          const timeAgo = activity.at ? new Date(activity.at).toLocaleTimeString() : translate('Just now');
          return `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;font-size:12px">
              <span style="color:var(--text-secondary)">${activity.path || translate('Unknown')}</span>
              <span style="color:var(--text-tertiary)">${timeAgo}</span>
            </div>
          `;
        }).join('');
      }
    }

    // Update traffic chart
    const chartEl = container.querySelector('#traffic-chart');
    if (chartEl && data.perMinute) {
      const maxValue = Math.max(...data.perMinute.filter(v => typeof v === 'number'), 1);
      const bars = data.perMinute.map((value, index) => {
        if (typeof value !== 'number') return '';
        const height = Math.min((value / maxValue) * 100, 100);
        const opacity = 0.3 + (0.7 * (value / maxValue));
        return `
          <div style="flex:1;height:${height}%;background:var(--primary);border-radius:4px 4px 0 0;opacity:${opacity};transition:height 0.3s" title="${value} views"></div>
        `;
      }).join('');
      chartEl.innerHTML = bars || '<div style="color:var(--text-secondary)">' + translate('No data') + '</div>';
    }

    // Update status
    const statusEl = container.querySelector('#monitor-status');
    if (statusEl) {
      statusEl.textContent = translate('Live — updating every 5 seconds');
      statusEl.style.color = 'var(--success)';
    }
  };

  // Function to show reconnecting state
  const showReconnecting = () => {
    const statusEl = container.querySelector('#monitor-status');
    if (statusEl) {
      statusEl.textContent = translate('Reconnecting...') + ' ' + translate('Using cached data');
      statusEl.style.color = 'var(--warning)';
    }
    // Restore last known data if available
    if (lastData) {
      updateDashboard(lastData);
    }
  };

  // Initial fetch and setup polling
  const fetchLiveData = async () => {
    try {
      const API = getApiUrl('/analytics/live');
      const response = await fetch(API, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error('Network error');
      const data = await response.json();
      updateDashboard(data);
    } catch (error) {
      showReconnecting();
    }
  };

  // Start polling
  fetchLiveData();
  renderMonitorPage._timer = setInterval(fetchLiveData, 5000);

  // Create icons if lucide is available
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}