import { api, friendlyError, loading, showMessage } from './api.js';
import { copy } from './main.js';
let request;
try{request=JSON.parse(sessionStorage.getItem('kuro-request'));}catch{}
if(location.hash){const p=new URLSearchParams(location.hash.slice(1));if(p.get('id')&&p.get('token'))request={id:p.get('id'),token:p.get('token')};history.replaceState(null,'',location.pathname+location.search);try{sessionStorage.setItem('kuro-request',JSON.stringify(request));}catch{}}
const confirmation=document.querySelector('#confirmation');
if(confirmation){
  if(request && /^KURO-[A-F0-9]{16}$/.test(request.id) && /^(?:[a-f0-9]{64}|d1\.[a-f0-9]{24}\.[a-f0-9]{2,700}\.[a-f0-9]{32})$/.test(request.token)) {
    document.querySelector('#received-id').textContent=request.id;document.querySelector('#received-token').textContent=request.token;
    document.querySelector('#copy-tracking').addEventListener('click',()=>copy(`Order ID: ${request.id}\nTracking token: ${request.token}`));
  } else {
    document.querySelector('#received-id').textContent='No submitted request in this tab.';document.querySelector('#received-status').textContent='Submission not verified';document.querySelector('#copy-tracking').hidden=true;
  }
}
const statusForm=document.querySelector('#status-form');
if(statusForm){
  if(request){statusForm.elements.orderId.value=request.id;statusForm.elements.trackingToken.value=request.token;}
  statusForm.addEventListener('submit',async e=>{
    e.preventDefault();if(!statusForm.reportValidity())return;
    const button=statusForm.querySelector('[type=submit]'),msg=document.querySelector('#status-message'),result=document.querySelector('#status-result');showMessage(msg,'');result.hidden=true;loading(button,true,'Checking…');
    try{const data=await api('order-status',{id:statusForm.elements.orderId.value.trim().toUpperCase(),token:statusForm.elements.trackingToken.value.trim()});result.replaceChildren();const title=document.createElement('h3');title.textContent=data.id;const status=document.createElement('span');status.className='status-pill';status.textContent=data.status;const date=document.createElement('p');date.textContent=`Submitted ${new Date(data.createdAt).toLocaleString()}`;result.append(title,status,date);result.hidden=false;}
    catch(error){showMessage(msg,friendlyError(error));}finally{loading(button,false);}
  });
}
const admin=document.querySelector('#admin-form');
if(admin){
  admin.elements.adminId.value=new URLSearchParams(location.search).get('id') || '';let authenticated=null;
  admin.elements.adminMessageId.value=new URLSearchParams(location.search).get('messageId') || '';
  async function act(decision){
    const msg=document.querySelector('#admin-message'),result=document.querySelector('#admin-result'),actions=document.querySelector('#admin-actions');showMessage(msg,'');
    const controls=admin.querySelectorAll('button');controls.forEach(b=>b.disabled=true);
    try{
      const data=await api('manage-order',{id:admin.elements.adminId.value.trim().toUpperCase(),...(admin.elements.adminMessageId.value.trim()?{messageId:admin.elements.adminMessageId.value.trim()}:{}),...(decision?{decision}:{})},{headers:{Authorization:`Bearer ${admin.elements.adminKey.value}`}});
      authenticated=data.id;result.replaceChildren();const title=document.createElement('h3');title.textContent=`${data.id} · ${data.status}`;result.append(title);
      const list=document.createElement('dl');for(const [key,value] of Object.entries(data.details)){const dt=document.createElement('dt');dt.textContent=key;const dd=document.createElement('dd');dd.textContent=String(value);list.append(dt,dd);}result.append(list);result.hidden=false;actions.hidden=data.status!=='Pending Review';
      if(data.warning)showMessage(msg,data.warning);
    }catch(error){authenticated=null;actions.hidden=true;result.hidden=true;showMessage(msg,friendlyError(error));}finally{controls.forEach(b=>b.disabled=false);}
  }
  admin.addEventListener('submit',e=>{e.preventDefault();if(admin.reportValidity())act();});
  for(const control of [admin.elements.adminId,admin.elements.adminMessageId,admin.elements.adminKey])control.addEventListener('input',()=>{authenticated=null;document.querySelector('#admin-actions').hidden=true;document.querySelector('#admin-result').hidden=true;});
  admin.querySelectorAll('[data-decision]').forEach(b=>b.addEventListener('click',()=>{if(authenticated && confirm(`Mark ${authenticated} as ${b.dataset.decision}?`))act(b.dataset.decision);}));
}
