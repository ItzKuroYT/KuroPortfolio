import { api, friendlyError, loading, showMessage } from './api.js';
const form = document.querySelector('#donation-form'), custom = form.elements.amount, total = document.querySelector('#donation-total');
function amount() { return custom.value.trim() || form.querySelector('[name=preset]:checked')?.value || ''; }
function update() { const value = Number(amount()); total.textContent = Number.isFinite(value) && value > 0 ? `$${value.toFixed(2)} USD` : 'Choose an amount'; }
form.querySelectorAll('[name=preset]').forEach(radio => radio.addEventListener('change', () => { custom.value=''; custom.setCustomValidity(''); update(); }));
custom.addEventListener('input', () => { if (custom.value) form.querySelectorAll('[name=preset]').forEach(r => r.checked = false); custom.setCustomValidity(''); update(); });
form.addEventListener('submit', async event => {
  event.preventDefault(); const value = amount(), msg = document.querySelector('#donation-message'); showMessage(msg,'');
  if (!/^\d+(\.\d{1,2})?$/.test(value) || Number(value) < 1 || Number(value) > 10000) { showMessage(msg,'Choose a donation from $1.00 to $10,000.00 USD with at most two decimal places.'); custom.focus(); return; }
  if (!form.reportValidity()) return;
  const button = form.querySelector('[type=submit]'); loading(button,true,'Creating secure checkout…');
  try {
    const response = await api('create-checkout-session',{ amount: value });
    const url = new URL(response.url); if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com') throw new Error('Checkout returned an invalid payment link. Please contact Kuro.');
    location.assign(url.href);
  } catch(error) { showMessage(msg,friendlyError(error)); loading(button,false); }
});
