import { API_BASE_URL } from './config.js';
export async function api(path, data, options = {}) {
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  if (!API_BASE_URL && !local) throw new Error('Online requests are not configured yet. Please email officialfnaffanstudios@gmail.com.');
  const base = API_BASE_URL.replace(/\/$/, '');
  const response = await fetch(`${base}/api/${path}`, {
    method: options.method || 'POST',
    headers: { ...(data ? {'Content-Type':'application/json'} : {}), ...options.headers },
    ...(data ? { body: JSON.stringify(data) } : {}),
    signal: AbortSignal.timeout(28000),
    credentials: 'omit',
    cache: 'no-store'
  });
  let body;
  try { body = await response.json(); } catch { throw new Error('The service returned an unexpected response. Please try again later.'); }
  if (!response.ok) throw new Error(body.error || 'The service is unavailable. Please try again later.');
  return body;
}
export function friendlyError(error) {
  if (error.name === 'TimeoutError' || error.name === 'AbortError') return 'The request timed out. Please try again, or contact Kuro directly.';
  if (error instanceof TypeError) return 'Could not connect. Check your connection and try again, or contact Kuro directly.';
  return error.message;
}
export function showMessage(element, message) { element.textContent = message; if (message) element.focus(); }
export function loading(button, state, text = 'Sending…') {
  if (state) { button.dataset.original = button.innerHTML; button.textContent = text; }
  else if (button.dataset.original) button.innerHTML = button.dataset.original;
  button.disabled = state;
  button.classList.toggle('is-loading', state);
}
