/**
 * Markbel Extension - Popup HUD Authentication Controller
 * Session verification, web vault tab sync, and login form handler.
 */

import { login, getSession, verifySession, syncSessionFromActiveVaultTab } from '../api';

export interface CredentialsValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate user login credentials before dispatching network request
 */
export function validateLoginCredentials(email: string, password: string): CredentialsValidationResult {
  const trimmedEmail = email.trim();
  if (!trimmedEmail) {
    return { valid: false, error: 'Email address is required.' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    return { valid: false, error: 'Please enter a valid email address.' };
  }
  if (!password) {
    return { valid: false, error: 'Password is required.' };
  }
  return { valid: true };
}

/**
 * Format auth errors safely for user presentation
 */
export function formatAuthError(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  if (typeof err === 'string') {
    return err;
  }
  return 'Authentication failed. Please check your credentials.';
}

/**
 * Verify existing session or synchronize from open web vault tab
 */
export async function verifyAndSyncSession(): Promise<boolean> {
  try {
    const session = await getSession();
    if (session.isAuthenticated && session.user) {
      verifySession().catch(() => {});
      return true;
    }

    let activeSession = await verifySession();
    if (!activeSession) {
      const tabSync = await syncSessionFromActiveVaultTab();
      if (tabSync.success) {
        activeSession = await verifySession();
      }
    }
    return !!activeSession;
  } catch (err) {
    console.warn('[Markbel Popup Auth] Session verification error:', err);
    return false;
  }
}

/**
 * Initialize Auth View event handlers
 */
export function initAuthView(callbacks: { onAuthenticated: () => Promise<void> }): void {
  if (typeof document === 'undefined') return;

  const formLogin = document.getElementById('form-login') as HTMLFormElement | null;
  const inputEmail = document.getElementById('input-email') as HTMLInputElement | null;
  const inputPassword = document.getElementById('input-password') as HTMLInputElement | null;
  const authError = document.getElementById('auth-error') as HTMLElement | null;
  const btnLoginSubmit = document.getElementById('btn-login-submit') as HTMLButtonElement | null;
  const btnSyncVaultTab = document.getElementById('btn-sync-vault-tab') as HTMLButtonElement | null;

  // Form login submission
  if (formLogin && inputEmail && inputPassword) {
    formLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      authError?.classList.add('hidden');

      const email = inputEmail.value.trim();
      const password = inputPassword.value;
      const validation = validateLoginCredentials(email, password);

      if (!validation.valid) {
        if (authError) {
          authError.textContent = validation.error || 'Invalid credentials';
          authError.classList.remove('hidden');
        }
        return;
      }

      if (btnLoginSubmit) {
        btnLoginSubmit.disabled = true;
        btnLoginSubmit.textContent = 'Signing in...';
      }

      try {
        await login(email, password);
        await callbacks.onAuthenticated();
      } catch (err: unknown) {
        if (authError) {
          authError.textContent = formatAuthError(err);
          authError.classList.remove('hidden');
        }
      } finally {
        if (btnLoginSubmit) {
          btnLoginSubmit.disabled = false;
          btnLoginSubmit.textContent = 'Sign In';
        }
      }
    });
  }

  // Sync session from open web vault tab
  if (btnSyncVaultTab) {
    btnSyncVaultTab.addEventListener('click', async () => {
      authError?.classList.add('hidden');
      btnSyncVaultTab.disabled = true;
      btnSyncVaultTab.textContent = 'Connecting to Vault Tab...';

      try {
        const result = await syncSessionFromActiveVaultTab();
        if (result.success) {
          const session = await verifySession();
          if (session) {
            await callbacks.onAuthenticated();
            return;
          }
        }
        if (authError) {
          authError.textContent = result.error || 'Could not find an authenticated Markbel tab.';
          authError.classList.remove('hidden');
        }
      } catch (err: unknown) {
        if (authError) {
          authError.textContent = formatAuthError(err);
          authError.classList.remove('hidden');
        }
      } finally {
        btnSyncVaultTab.disabled = false;
        btnSyncVaultTab.textContent = 'Sync Session from Open Web Vault Tab';
      }
    });
  }
}
