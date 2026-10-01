/**
 * Loads Google Identity Services (the "Sign in with Google" button) on
 * demand, only on the admin login page and only when the server has Google
 * sign-in enabled. https://developers.google.com/identity/gsi/web
 */

const SCRIPT_URL = 'https://accounts.google.com/gsi/client';

/** The parts of the `google.accounts.id` API we use. */
export interface GoogleIdentityApi {
  initialize(config: {
    client_id: string;
    callback: (response: { credential: string }) => void;
    ux_mode?: 'popup' | 'redirect';
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
  }): void;
  renderButton(
    parent: HTMLElement,
    options: {
      type?: 'standard' | 'icon';
      theme?: 'outline' | 'filled_blue' | 'filled_black';
      size?: 'large' | 'medium' | 'small';
      text?: 'signin_with' | 'continue_with';
      shape?: 'rectangular' | 'pill';
      width?: number;
      logo_alignment?: 'left' | 'center';
    },
  ): void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdentityApi } };
  }
}

let loading: Promise<GoogleIdentityApi> | undefined;

/** Resolves with `google.accounts.id` once the script has loaded. */
export function loadGoogleIdentity(): Promise<GoogleIdentityApi> {
  if (window.google?.accounts?.id) {
    return Promise.resolve(window.google.accounts.id);
  }
  loading ??= new Promise<GoogleIdentityApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () =>
      window.google?.accounts?.id ? resolve(window.google.accounts.id) : reject(new Error('Google sign-in is unavailable'));
    script.onerror = () => {
      loading = undefined; // allow a retry on the next visit to the page
      script.remove();
      reject(new Error('Could not load Google sign-in'));
    };
    document.head.appendChild(script);
  });
  return loading;
}
