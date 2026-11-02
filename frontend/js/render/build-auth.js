function renderLoginPage(param, container) {
  const isSignup = window.location.hash.includes('signup');
  container.innerHTML = `
    <div class="noviq-page-section" style="padding-top:120px;min-height:100vh;display:flex;align-items:center;justify-content:center">
      <div class="noviq-auth-card">
        <div class="noviq-auth-header">
          <div class="noviq-auth-logo" dir="ltr">
            <svg class="noviq-logo-icon" viewBox="17 18 56 62" fill="none" style="width:32px;height:32px;overflow:visible;flex-shrink:0" aria-hidden="true">
              <g filter="url(#logoGlow)">
                <path d="M 28 73 C 28 45, 30 23, 40 23 C 48 23, 48 63, 58 70 C 66 77, 72 61, 72 27" stroke="url(#liquidBase)" stroke-width="15" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M 28 73 C 28 45, 30 23, 40 23 C 48 23, 48 63, 58 70 C 66 77, 72 61, 72 27" stroke="url(#liquidChrome)" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" opacity="0.95" />
                <path d="M 28 73 C 28 45, 30 23, 40 23 C 48 23, 48 63, 58 70 C 66 77, 72 61, 72 27" stroke="url(#specularGlow)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" />
              </g>
            </svg>
            <span style="font-family:var(--font-display);font-weight:600;font-size:24px;color:var(--text);direction:ltr">oviq</span>
          </div>
          <h1 style="font-size:22px;margin:16px 0 4px">${isSignup ? t('Create Account') : t('Welcome Back')}</h1>
          <p style="font-size:14px;color:var(--text-secondary);margin:0">${isSignup ? t('Sign up to get started with Noviq.') : t('Sign in to your Noviq account.')}</p>
        </div>
        <form id="auth-form" class="noviq-auth-form" autocomplete="off">
          ${isSignup ? `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="noviq-auth-field">
              <label for="auth-firstname">${t('First Name')}</label>
              <input type="text" id="auth-firstname" class="noviq-input" placeholder="${t('John')}" autocomplete="given-name" />
            </div>
            <div class="noviq-auth-field">
              <label for="auth-lastname">${t('Last Name')}</label>
              <input type="text" id="auth-lastname" class="noviq-input" placeholder="${t('Doe')}" autocomplete="family-name" />
            </div>
          </div>` : ''}
          <div class="noviq-auth-field">
            <label for="auth-email">${t('Email')}</label>
            <input type="email" id="auth-email" class="noviq-input" placeholder="${t('you@company.com')}" autocomplete="email" />
          </div>
          <div class="noviq-auth-field">
            <label for="auth-password">${t('Password')}</label>
            <input type="password" id="auth-password" class="noviq-input" placeholder="${isSignup ? t('Create a strong password') : '··········'}" autocomplete="${isSignup ? 'new-password' : 'current-password'}" />
            ${isSignup ? '' : `<a href="#/forgot-password" class="noviq-auth-link" style="font-size:12px;margin-top:6px;display:inline-block">${t('Forgot password?')}</a>`}
          </div>
          ${isSignup ? `
          <div class="noviq-auth-field">
            <label for="auth-confirm">${t('Confirm Password')}</label>
            <input type="password" id="auth-confirm" class="noviq-input" placeholder="${t('Repeat your password')}" autocomplete="new-password" />
          </div>` : ''}
          <button type="submit" class="noviq-btn-primary noviq-auth-submit" id="auth-submit">
            ${isSignup ? t('Create Account') : t('Sign In')}
            <i data-lucide="arrow-right" style="width:16px;height:16px"></i>
          </button>
        </form>
        <div class="noviq-auth-footer">
          <p style="font-size:13px;color:var(--text-secondary);margin:0">
            ${isSignup ? t('Already have an account?') : t("Don't have an account?")}
            <a href="${isSignup ? '#/login' : '#/signup'}" class="noviq-auth-link">${isSignup ? t('Sign In') : t('Create One')}</a>
          </p>
          ${isSignup ? '' : `<button type="button" id="auth-admin-toggle" class="noviq-auth-link" style="background:none;border:none;cursor:pointer;font-size:12.5px;margin-top:12px;display:inline-flex;align-items:center;gap:6px;opacity:.75"><i data-lucide="shield" style="width:14px;height:14px"></i><span>${t('Admin sign in')}</span></button>`}
        </div>
        <div id="auth-error" style="display:none;margin-top:16px;padding:12px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);border-radius:8px;color:#EF4444;text-align:center;font-size:13px"></div>
      </div>
    </div>`;
  if (typeof lucide !== 'undefined') lucide.createIcons();
  const form = document.getElementById('auth-form');
  const submitBtn = document.getElementById('auth-submit');
  const errorEl = document.getElementById('auth-error');
  /* ---- Discreet admin sign-in mode (site login page doubles as the admin gate).
     Posts to the rate-limited /api/admin/login (username OR email), stores the
     admin token under the same key the dashboard reads, then opens /admin/. ---- */
  let adminMode = false;
  const adminToggle = document.getElementById('auth-admin-toggle');
  const origTitle = document.querySelector('.noviq-auth-header h1')?.textContent || '';
  const origSubtitle = document.querySelector('.noviq-auth-header p')?.textContent || '';
  const origEmailLabel = document.querySelector('label[for="auth-email"]')?.textContent || '';
  if (adminToggle && !isSignup) {
    adminToggle.addEventListener('click', () => {
      adminMode = !adminMode;
      const emailLabel = document.querySelector('label[for="auth-email"]');
      const emailInput = document.getElementById('auth-email');
      const title = document.querySelector('.noviq-auth-header h1');
      const subtitle = document.querySelector('.noviq-auth-header p');
      const forgot = document.querySelector('a[href="#/forgot-password"]');
      if (adminMode) {
        if (emailLabel) emailLabel.textContent = t('Username or email');
        if (emailInput) { emailInput.placeholder = t('admin username or email'); emailInput.type = 'text'; emailInput.removeAttribute('required'); }
        if (title) title.textContent = t('Admin Sign In');
        if (subtitle) subtitle.textContent = t('Restricted area. Authorized administrators only.');
        if (forgot) forgot.style.display = 'none';
        adminToggle.querySelector('span').textContent = t('Back to user sign in');
        submitBtn.innerHTML = t('Sign In as Admin') + ' <i data-lucide="shield" style="width:16px;height:16px"></i>';
      } else {
        if (emailLabel) emailLabel.textContent = origEmailLabel;
        if (emailInput) { emailInput.placeholder = t('you@company.com'); emailInput.type = 'email'; }
        if (title) title.textContent = origTitle;
        if (subtitle) subtitle.textContent = origSubtitle;
        if (forgot) forgot.style.display = '';
        adminToggle.querySelector('span').textContent = t('Admin sign in');
        submitBtn.innerHTML = t('Sign In') + ' <i data-lucide="arrow-right" style="width:16px;height:16px"></i>';
      }
      errorEl.style.display = 'none';
      if (typeof lucide !== 'undefined') lucide.createIcons();
    });
  }
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.style.display = 'none';
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    if (!email || !password) { showAuthError(t('Please fill in all fields.')); return; }
    if (isSignup) {
      const name = document.getElementById('auth-firstname')?.value.trim();
      const confirm = document.getElementById('auth-confirm')?.value;
      if (!name) { showAuthError(t('Please enter your name.')); return; }
      if (password !== confirm) { showAuthError(t('Passwords do not match.')); return; }
      if (password.length < 8) { showAuthError(t('Password must be at least 8 characters.')); return; }
    }
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="noviq-spinner"></span>';
    try {
      if (adminMode && !isSignup) {
        const res = await fetch(NoviqAPI.url('/admin/login'), {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: email, password }),
        });
        const data = await res.json();
        if (data.error) { showAuthError(t(data.error)); submitBtn.disabled = false; submitBtn.innerHTML = t('Sign In as Admin') + ' <i data-lucide="shield" style="width:16px;height:16px"></i>'; if (typeof lucide !== 'undefined') lucide.createIcons(); return; }
        if (data.token) localStorage.setItem('noviq_admin_token', data.token);
        submitBtn.innerHTML = '<i data-lucide="check" style="width:16px;height:16px"></i> ' + t('Welcome, Admin!');
        if (typeof lucide !== 'undefined') lucide.createIcons();
        setTimeout(() => { window.location.href = '/admin/'; }, 800);
        return;
      }
      const endpoint = isSignup ? '/auth/register' : '/auth/login';
      const body = isSignup
        ? { firstName: document.getElementById('auth-firstname')?.value.trim(), lastName: document.getElementById('auth-lastname')?.value.trim(), email, password }
        : { email, password };
      const res = await fetch(NoviqAPI.url(endpoint), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.error) { showAuthError(t(data.error)); submitBtn.disabled = false; submitBtn.innerHTML = isSignup ? t('Create Account') + ' <i data-lucide="arrow-right" style="width:16px;height:16px"></i>' : t('Sign In') + ' <i data-lucide="arrow-right" style="width:16px;height:16px"></i>'; if (typeof lucide !== 'undefined') lucide.createIcons(); return; }
      if (data.token) { localStorage.setItem('noviq_token', data.token); localStorage.setItem('noviq_user', JSON.stringify(data.user || { email })); }
      submitBtn.innerHTML = '<i data-lucide="check" style="width:16px;height:16px"></i> ' + t('Success!');
      if (typeof lucide !== 'undefined') lucide.createIcons();
      try { updateAuthUI(); } catch {}
      setTimeout(() => navigateTo('home'), 800);
    } catch (err) {
      showAuthError(t('Connection error. Please try again.'));
      submitBtn.disabled = false;
      submitBtn.innerHTML = isSignup ? t('Create Account') + ' <i data-lucide="arrow-right" style="width:16px;height:16px"></i>' : t('Sign In') + ' <i data-lucide="arrow-right" style="width:16px;height:16px"></i>';
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
  });
  function showAuthError(msg) { errorEl.textContent = msg; errorEl.style.display = 'block'; }
}

/* ============================================================
   AUTH STATE — navbar icon + account page + logout
   ============================================================ */
function getAuthUser() {
  try {
    const token = localStorage.getItem('noviq_token');
    if (!token) return null;
    return JSON.parse(localStorage.getItem('noviq_user') || 'null');
  } catch { return null; }
}

function updateAuthUI() {
  const icon = document.getElementById('login-nav-icon');
  if (!icon) return;
  const user = getAuthUser();
  if (user) {
    icon.setAttribute('href', '#/account');
    icon.setAttribute('title', (user.firstName ? user.firstName + ' — ' : '') + t('My Account'));
    icon.style.color = 'var(--secondary)';
    icon.innerHTML = '<i data-lucide="user-check" style="width:22px;height:22px"></i>';
  } else {
    icon.setAttribute('href', '#/login');
    icon.setAttribute('title', 'Login / Sign up');
    icon.style.color = '';
    icon.innerHTML = '<i data-lucide="circle-user-round" style="width:22px;height:22px"></i>';
  }
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function noviqLogout() {
  try {
    localStorage.removeItem('noviq_token');
    localStorage.removeItem('noviq_user');
  } catch {}
  updateAuthUI();
  navigateTo('home');
}

function renderAccountPage(param, container) {
  const user = getAuthUser();
  if (!user) { navigateTo('login'); return; }
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
  const initial = (user.firstName || user.email || 'U').charAt(0).toUpperCase();
  container.innerHTML = `
    <div class="noviq-page-section" style="padding-top:140px;min-height:80vh;display:flex;align-items:flex-start;justify-content:center">
      <div class="noviq-auth-card" style="max-width:480px">
        <div class="noviq-auth-header">
          <div style="width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,var(--primary),var(--accent));display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:700;color:#fff;margin:0 auto 16px;box-shadow:var(--shadow-glow)">${initial}</div>
          <h1 style="font-size:22px;margin:0 0 4px">${name}</h1>
          <p style="font-size:14px;color:var(--text-secondary);margin:0;direction:ltr">${user.email || ''}</p>
        </div>
        <div style="display:flex;flex-direction:column;gap:12px;position:relative">
          <div class="noviq-glass-card" style="padding:16px 20px;display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:13px;color:var(--text-secondary)">${t('Account type')}</span>
            <span class="noviq-badge" style="background:rgba(139,92,246,0.12);color:var(--secondary);padding:4px 12px;border-radius:999px;font-size:12px">${user.role === 'admin' ? 'Admin' : t('Member')}</span>
          </div>
          ${user.role === 'admin' ? `<a class="noviq-btn-secondary" href="/admin/" style="width:100%;justify-content:center;text-decoration:none">
            <i data-lucide="layout-dashboard" style="width:15px;height:15px"></i> Admin Dashboard
          </a>` : ''}
          <button class="noviq-btn-secondary" style="width:100%;justify-content:center" onclick="navigateTo('contact')">
            <i data-lucide="message-square" style="width:15px;height:15px"></i> ${t('Contact Support')}
          </button>
          <button class="noviq-btn-primary" style="width:100%;justify-content:center;background:linear-gradient(135deg,#7f1d1d,#dc2626)" onclick="noviqLogout()">
            <i data-lucide="log-out" style="width:15px;height:15px"></i> ${t('Sign Out')}
          </button>
        </div>
      </div>
    </div>`;
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

/* ============================================================
   FORGOT PASSWORD — two steps: request code, then reset
   ============================================================ */
function renderForgotPasswordPage(param, container) {
  let step = 1;
  let savedEmail = '';

  const draw = () => {
    container.innerHTML = `
    <div class="noviq-page-section" style="padding-top:120px;min-height:100vh;display:flex;align-items:center;justify-content:center">
      <div class="noviq-auth-card">
        <div class="noviq-auth-header">
          <h1 style="font-size:22px;margin:16px 0 4px">${t('Reset Password')}</h1>
          <p style="font-size:14px;color:var(--text-secondary);margin:0">${step === 1 ? t('Enter your email and we will send you a reset code.') : t('Enter the 6-digit code and your new password.')}</p>
        </div>
        <form id="fp-form" class="noviq-auth-form" autocomplete="off">
          <div class="noviq-auth-field">
            <label for="fp-email">${t('Email')}</label>
            <input type="email" id="fp-email" class="noviq-input" placeholder="${t('you@company.com')}" value="${savedEmail}" ${step === 2 ? 'readonly' : ''} autocomplete="email" />
          </div>
          ${step === 2 ? `
          <div class="noviq-auth-field">
            <label for="fp-code">${t('Reset Code')}</label>
            <input type="text" id="fp-code" class="noviq-input" placeholder="123456" inputmode="numeric" maxlength="6" style="letter-spacing:6px;text-align:center;font-size:18px" />
          </div>
          <div class="noviq-auth-field">
            <label for="fp-password">${t('New Password')}</label>
            <input type="password" id="fp-password" class="noviq-input" placeholder="${t('Create a strong password')}" autocomplete="new-password" />
          </div>` : ''}
          <button type="submit" class="noviq-btn-primary noviq-auth-submit" id="fp-submit">
            ${step === 1 ? t('Send Code') : t('Reset Password')}
            <i data-lucide="arrow-right" style="width:16px;height:16px"></i>
          </button>
        </form>
        <div class="noviq-auth-footer">
          <p style="font-size:13px;color:var(--text-secondary);margin:0">
            <a href="#/login" class="noviq-auth-link">${t('Back to Sign In')}</a>
          </p>
        </div>
        <div id="fp-msg" style="display:none;margin-top:16px;padding:12px;border-radius:8px;text-align:center;font-size:13px"></div>
      </div>
    </div>`;
    if (typeof lucide !== 'undefined') lucide.createIcons();

    const form = document.getElementById('fp-form');
    const btn = document.getElementById('fp-submit');
    const msg = document.getElementById('fp-msg');
    const show = (text, ok) => {
      msg.style.display = 'block';
      msg.textContent = text;
      msg.style.background = ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)';
      msg.style.border = ok ? '1px solid rgba(34,197,94,0.2)' : '1px solid rgba(239,68,68,0.2)';
      msg.style.color = ok ? '#22C55E' : '#EF4444';
    };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      msg.style.display = 'none';
      const email = document.getElementById('fp-email').value.trim();
      if (!email || !email.includes('@')) { show(t('Please enter a valid email address.'), false); return; }
      btn.disabled = true;
      btn.innerHTML = '<span class="noviq-spinner"></span>';
      try {
        if (step === 1) {
          const res = await fetch(NoviqAPI.url('/auth/forgot-password'), {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }),
          });
          const data = await res.json();
          if (data.error) { show(t(data.error), false); btn.disabled = false; draw._restoreBtn(btn); return; }
          savedEmail = email;
          step = 2;
          draw();
        } else {
          const code = document.getElementById('fp-code').value.trim();
          const password = document.getElementById('fp-password').value;
          if (code.length !== 6) { show(t('Please enter the 6-digit code.'), false); btn.disabled = false; draw._restoreBtn(btn); return; }
          if (password.length < 8) { show(t('Password must be at least 8 characters.'), false); btn.disabled = false; draw._restoreBtn(btn); return; }
          const res = await fetch(NoviqAPI.url('/auth/reset-password'), {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, code, password }),
          });
          const data = await res.json();
          if (data.error) { show(t(data.error), false); btn.disabled = false; draw._restoreBtn(btn); return; }
          show(t('Password updated. You can now sign in.'), true);
          setTimeout(() => navigateTo('login'), 1500);
        }
      } catch {
        show(t('Connection error. Please try again.'), false);
        btn.disabled = false;
        draw._restoreBtn(btn);
      }
    });
  };

  draw._restoreBtn = (btn) => {
    btn.innerHTML = (step === 1 ? t('Send Code') : t('Reset Password')) + ' <i data-lucide="arrow-right" style="width:16px;height:16px"></i>';
    if (typeof lucide !== 'undefined') lucide.createIcons();
  };

  draw();
}

if (typeof window !== 'undefined') {
  window.updateAuthUI = updateAuthUI;
  window.noviqLogout = noviqLogout;
  window.renderAccountPage = renderAccountPage;
  window.getAuthUser = getAuthUser;
  window.renderForgotPasswordPage = renderForgotPasswordPage;
}
