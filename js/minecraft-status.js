import { api } from './api.js';
const TTL=300000;
function render(card,data) {
  const state=card.querySelector('[data-state]');state.className='server-state';
  state.textContent=data.available===false?'Status unavailable':data.online?'Online':'Offline';
  if(data.available!==false)state.classList.add(data.online?'online':'offline');
  card.querySelector('[data-players]').textContent=data.online?`${data.players ?? '—'} / ${data.max ?? '—'}`:'— / —';
  card.querySelector('[data-version]').textContent=data.version || '—';
  card.querySelector('[data-motd]').textContent=data.motd || (data.available===false?'Live status couldn’t be checked. You can still copy the server address.':data.online?'No MOTD provided.':'The server was reported offline at the last check.');
  card.querySelector('[data-updated]').textContent=data.checkedAt?`Last checked ${new Date(data.checkedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`:'';
  if(data.icon && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(data.icon)) {const img=document.createElement('img');img.src=data.icon;img.alt=`${card.dataset.server} server icon`;img.width=64;img.height=64;card.querySelector('.server-icon').replaceChildren(img);}
}
for(const card of document.querySelectorAll('[data-server]')) {
  const key=`kuro-mc:${card.dataset.server}`;let cached;
  try{cached=JSON.parse(localStorage.getItem(key));}catch{}
  if(cached && Date.now()-cached.savedAt<TTL){render(card,cached.data);continue;}
  try{const data=await api(`mc-status?address=${encodeURIComponent(card.dataset.server)}`,null,{method:'GET'});render(card,data);try{localStorage.setItem(key,JSON.stringify({savedAt:Date.now(),data}));}catch{}}
  catch{render(card,{available:false});}
  // Sequential requests respect the upstream API's per-IP limit.
}
