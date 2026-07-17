/* ============================================
   ApprovalFlow — Login Page Logic
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
  App.redirectIfAuth();

  const form = document.getElementById('login-form');
  const btn = document.getElementById('login-btn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!email || !password) {
      Toast.error('Please fill in all fields');
      return;
    }

    btn.disabled = true;
    btn.innerHTML = '<div class="spinner spinner-sm"></div> Signing in...';

    try {
      const data = await App.post('/auth/login', { email, password });

      if (data && data.data) {
        App.setToken(data.data.token);
        App.setUser(data.data.user);
        Toast.success('Login successful!');
        setTimeout(() => {
          window.location.href = '/dashboard.html';
        }, 500);
      }
    } catch (error) {
      btn.disabled = false;
      btn.textContent = 'Sign In';
    }
  });
});
