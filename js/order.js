import { api, friendlyError, loading, showMessage } from './api.js';
const form=document.querySelector('#order-form'), service=form.elements.service, startedAt=Date.now();
const categories={'Minecraft Development':['Plugin','Skript'],'Web Development':['Website'],'Voice Acting':['YouTube']};
const scope={'Minecraft Development':'Minecraft plugin or Skript development.','Web Development':'HTML, CSS, JavaScript — frontend development only.','Voice Acting':'YouTube projects only.'};
const specs={
  'Minecraft Development':[['minecraftVersion','Minecraft version'],['serverSoftware','Server software'],['commands','Commands needed','area'],['permissions','Permissions needed','area'],['dependencies','Dependencies'],['references','Example / reference servers','area']],
  'Web Development':[['purpose','Website purpose'],['pages','Number of pages','number'],['sections','Requested sections','area'],['style','Preferred design / style'],['references','Reference websites','area'],['features','Required features','area']],
  'Voice Acting':[['channelName','Project / channel name'],['channelUrl','YouTube channel URL','url'],['character','Character'],['characterDescription','Character description','area'],['wordCount','Approximate word count','number'],['scriptStatus','Script status'],['voiceDirection','Voice direction','area']]
};
function render(category, selected) {
  service.replaceChildren(...categories[category].map(text=>{ const o=document.createElement('option'); o.value=text; o.textContent=text; return o; }));
  if (categories[category].includes(selected)) service.value=selected;
  document.querySelector('#service-scope').textContent=scope[category];
  const container=document.querySelector('#service-fields'); container.replaceChildren();
  for(const [name,text,type] of specs[category]) {
    const wrap=document.createElement('div'); wrap.className='field'+(type==='area'?' full':'');
    const label=document.createElement('label');label.htmlFor=name;label.textContent=text;
    const input=document.createElement(type==='area'?'textarea':'input'); input.id=name;input.name=name;
    if(type==='area'){input.rows=3;input.maxLength=600;}else{input.type=type || 'text';if(type==='number'){input.min=1;input.max=name==='pages'?1000:1000000;input.step=1;}else input.maxLength=300;}
    wrap.append(label,input);container.append(wrap);
  }
}
form.querySelectorAll('[name=category]').forEach(radio=>radio.addEventListener('change',()=>render(radio.value)));
const preselect=new URLSearchParams(location.search).get('service');
const initial=Object.keys(categories).find(key=>categories[key].includes(preselect)) || 'Minecraft Development';
form.querySelectorAll('[name=category]').forEach(r=>r.checked=r.value===initial);render(initial,preselect);
// Local date prevents a UTC conversion from moving the earliest date by a day.
const today=new Date();form.elements.deadline.min=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
const contactError=document.querySelector('#contact-error');
for(const name of ['email','discord','pulsedconnect']) form.elements[name].addEventListener('input',()=>{contactError.textContent='';form.elements[name].removeAttribute('aria-invalid');});
form.addEventListener('submit',async event=>{
  event.preventDefault();const message=document.querySelector('#order-message');showMessage(message,'');
  if(!form.reportValidity())return;
  const data=Object.fromEntries(new FormData(form));
  if(!['email','discord','pulsedconnect'].some(key=>data[key]?.trim())) {
    contactError.textContent='Add at least one contact method: Email, Discord, or PulsedConnect.';
    form.elements.email.setAttribute('aria-invalid','true');form.elements.email.setAttribute('aria-describedby','contact-error');form.elements.email.focus();return;
  }
  for(const name of ['title','description','requirements','budget']) {if(!data[name].trim()){showMessage(message,`Please add ${name==='title'?'a project title':name}.`);form.elements[name].focus();return;}}
  data.elapsed=Date.now()-startedAt;data.consent=data.consent==='on';
  const button=form.querySelector('[type=submit]');loading(button,true,'Sending your request…');
  try {
    const result=await api('submit-order',data);
    // Fragment keeps the private token out of server logs, referral headers and queries.
    const fragment=new URLSearchParams({id:result.id,token:result.token});
    try{sessionStorage.setItem('kuro-request',JSON.stringify({id:result.id,token:result.token}));}catch{}
    location.assign(`request-received.html#${fragment}`);
  }catch(error){showMessage(message,friendlyError(error));loading(button,false);}
});
