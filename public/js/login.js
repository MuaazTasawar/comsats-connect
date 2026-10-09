'use strict';

(function () {
  const { session, api, el } = window.Connect;

  // Demo accounts created by `npm run seed`. Remove this list for a real deployment.
  const DEMO_PASSWORD = 'Comsats@123';
  const DEMO_ACCOUNTS = [
    { loginId: 'admin.it', name: 'IT Administrator', note: 'Admin' },
    { loginId: 'exam.cell', name: 'Exam Cell Office', note: 'Admin' },
    { loginId: 'dr.ahmed', name: 'Dr. Ahmed Raza', note: 'Faculty, Computer Science' },
    { loginId: 'FA23-BCS-050', name: 'Muaaz Tasawar', note: 'Student, Computer Science' },
    { loginId: 'FA22-BEE-031', name: 'Fatima Noor', note: 'Student, Electrical Eng.' },
  ];

  const form = document.getElementById('login-form');
  const loginInput = document.getElementById('loginId');
  const passwordInput = document.getElementById('password');
  const button = document.getElementById('login-button');
  const errorBox = document.getElementById('form-error');
  const demoList = document.getElementById('demo-list');

  function showError(message) {
    errorBox.textContent = message;
    errorBox.hidden = false;
  }

  function hideError() {
    errorBox.hidden = true;
  }

  function setBusy(busy) {
    button.disabled = busy;
    button.textContent = busy ? 'Signing in...' : 'Sign in';
  }

  /* ---------- Demo account chips ---------- */

  DEMO_ACCOUNTS.forEach((account) => {
    demoList.append(
      el(
        'button',
        {
          type: 'button',
          class: 'demo-chip',
          onclick: () => {
            loginInput.value = account.loginId;
            passwordInput.value = DEMO_PASSWORD;
            hideError();
            button.focus();
          },
        },
        el('span', { text: account.name }),
        el('small', { text: account.loginId + ', ' + account.note })
      )
    );
  });

  /* ---------- Skip the form if a valid session already exists in this tab ---------- */

  async function resumeIfSignedIn() {
    if (!session.token()) return;
    try {
      await api('/api/auth/me', { skipAuthRedirect: true });
      location.replace('/chat.html');
    } catch (err) {
      session.clear();
    }
  }

  if (new URLSearchParams(location.search).get('expired')) {
    showError('Your session ended. Please sign in again.');
  } else {
    resumeIfSignedIn();
  }

  /* ---------- Submit ---------- */

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    hideError();

    const loginId = loginInput.value.trim();
    const password = passwordInput.value;
    if (!loginId || !password) {
      showError('Enter your login ID and password.');
      return;
    }

    setBusy(true);
    try {
      session.clear();
      const data = await api('/api/auth/login', {
        method: 'POST',
        body: { loginId, password },
        skipAuthRedirect: true,
      });
      session.save(data.token, data.user);
      location.assign('/chat.html');
    } catch (err) {
      showError(err.message);
      setBusy(false);
      passwordInput.focus();
      passwordInput.select();
    }
  });
})();
