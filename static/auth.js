'use strict';

(function () {
  var STORAGE_KEY = 'auth_email_superior';
  var GAS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbyh9OKmQARm1aVw0CiclzTAwMqqgQeMEDq-WswVN7nHhs4-Dbk4N9fnPBkkZ6PZxy0-Xg/exec';

  // Runs synchronously in <head> — adds class before body renders to avoid flash
  if (!localStorage.getItem(STORAGE_KEY)) {
    document.documentElement.classList.add('auth-required');
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!document.documentElement.classList.contains('auth-required')) return;

    var loginBtn     = document.getElementById('auth-login-btn');
    var emailInput   = document.getElementById('auth-email');
    var passwordInput = document.getElementById('auth-password');
    var errorEl      = document.getElementById('auth-error');

    function showError(msg) { errorEl.textContent = msg; }

    function showApp() { document.documentElement.classList.remove('auth-required'); }

    async function login() {
      var email    = emailInput.value.trim();
      var password = passwordInput.value;

      if (!email || !password) {
        showError('メールアドレスとパスワードを入力してください。');
        return;
      }

      loginBtn.disabled = true;
      loginBtn.classList.add('btn--loading');
      showError('');

      try {
        var res = await fetch(GAS_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ email: email, password: password }),
          redirect: 'follow',
        });
        var data = await res.json();

        if (data.status === 'ok') {
          localStorage.setItem(STORAGE_KEY, email);
          showApp();
        } else {
          showError(data.message || 'メールアドレスまたはパスワードが正しくありません。');
        }
      } catch (_) {
        showError('通信エラーが発生しました。しばらく待ってから再試行してください。');
      } finally {
        loginBtn.disabled = false;
        loginBtn.classList.remove('btn--loading');
      }
    }

    loginBtn.addEventListener('click', login);
    emailInput.addEventListener('keydown',    function (e) { if (e.key === 'Enter') login(); });
    passwordInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') login(); });
  });
})();
