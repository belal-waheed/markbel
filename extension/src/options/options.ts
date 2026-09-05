/**
 * Markbel Extension - Settings Controller (TypeScript)
 */

import {
  DEFAULT_API_BASE,
  getApiBase,
  clearSession,
  login,
  verifySession,
  normalizeApiUrl
} from '../api';

// DOM Elements
const accountLoggedIn = document.getElementById('account-logged-in') as HTMLElement;
const accountLoggedOut = document.getElementById('account-logged-out') as HTMLElement;
const userEmail = document.getElementById('user-email') as HTMLElement;
const btnLogout = document.getElementById('btn-logout') as HTMLButtonElement;

const formOptionsLogin = document.getElementById('form-options-login') as HTMLFormElement;
const optEmail = document.getElementById('opt-email') as HTMLInputElement;
const optPassword = document.getElementById('opt-password') as HTMLInputElement;
const btnOptLogin = document.getElementById('btn-opt-login') as HTMLButtonElement;
const optAuthError = document.getElementById('opt-auth-error') as HTMLElement;

const formApiConfig = document.getElementById('form-api-config') as HTMLFormElement;
const inputApiUrl = document.getElementById('input-api-url') as HTMLInputElement;
const btnResetApi = document.getElementById('btn-reset-api') as HTMLButtonElement;
const apiStatusBanner = document.getElementById('api-status-banner') as HTMLElement;

/**
 * Initialize Settings Page
 */
async function init(): Promise<void> {
  setupEventListeners();

  // Load configured API URL
  const currentBase = await getApiBase();
  inputApiUrl.value = currentBase;

  // Check auth session
  await renderSessionState();
}

/**
 * Render Session UI
 */
async function renderSessionState(): Promise<void> {
  const session = await verifySession();
  if (session && session.email) {
    userEmail.textContent = session.email;
    accountLoggedIn.classList.remove('hidden');
    accountLoggedOut.classList.add('hidden');
  } else {
    accountLoggedIn.classList.add('hidden');
    accountLoggedOut.classList.remove('hidden');
  }
}

/**
 * Event Listeners
 */
function setupEventListeners(): void {
  // Save API URL
  formApiConfig.addEventListener('submit', async (e) => {
    e.preventDefault();
    const cleanUrl = normalizeApiUrl(inputApiUrl.value);
    inputApiUrl.value = cleanUrl;

    await chrome.storage.local.set({ apiUrl: cleanUrl });
    showBanner(apiStatusBanner, 'API endpoint saved successfully.', 'success');
  });

  // Reset API URL
  btnResetApi.addEventListener('click', async () => {
    inputApiUrl.value = DEFAULT_API_BASE;
    await chrome.storage.local.set({ apiUrl: DEFAULT_API_BASE });
    showBanner(apiStatusBanner, 'API endpoint reset to default edge server.', 'success');
  });

  // Login
  formOptionsLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    optAuthError.classList.add('hidden');
    btnOptLogin.disabled = true;
    btnOptLogin.textContent = 'Signing in...';

    try {
      await login(optEmail.value.trim(), optPassword.value);
      optPassword.value = '';
      await renderSessionState();
    } catch (err: any) {
      optAuthError.textContent = err?.message || 'Authentication failed';
      optAuthError.classList.remove('hidden');
    } finally {
      btnOptLogin.disabled = false;
      btnOptLogin.textContent = 'Sign In';
    }
  });

  // Logout
  btnLogout.addEventListener('click', async () => {
    await clearSession();
    await renderSessionState();
  });
}

function showBanner(bannerEl: HTMLElement, message: string, type: 'error' | 'success'): void {
  bannerEl.textContent = message;
  bannerEl.className = `banner banner-${type}`;
  bannerEl.classList.remove('hidden');

  setTimeout(() => {
    bannerEl.classList.add('hidden');
  }, 3000);
}

// Boot Controller
init();
