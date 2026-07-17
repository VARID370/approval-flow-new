/* ============================================
   ApprovalFlow — Register Page Logic
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
  App.redirectIfAuth();

  const form = document.getElementById('register-form');
  const btn = document.getElementById('register-btn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const department = document.getElementById('department').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (!name || !email || !department || !password || !confirmPassword) {
      Toast.error('Please fill in all fields');
      return;
    }

    if (password.length < 6) {
      Toast.error('Password must be at least 6 characters');
      return;
    }

    if (!/\d/.test(password)) {
      Toast.error('Password must contain at least one number');
      return;
    }

    if (password !== confirmPassword) {
      Toast.error('Passwords do not match');
      return;
    }

    btn.disabled = true;
    btn.innerHTML = '<div class="spinner spinner-sm"></div> Creating account...';

    try {
      const data = await App.post('/auth/register', { name, email, password, department });

      if (data && data.data) {
        App.setToken(data.data.token);
        App.setUser(data.data.user);
        Toast.success('Account created successfully!');
        setTimeout(() => {
          window.location.href = '/dashboard.html';
        }, 500);
      }
    } catch (error) {
      btn.disabled = false;
      btn.textContent = 'Create Account';
    }
  });
});
