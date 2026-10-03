import { requiredEnv, HttpError, frontendURL, fetchJSON } from './backend.js';
export function webhookURL(){const url=requiredEnv('DISCORD_ORDER_WEBHOOK_URL');if(!/^https:\/\/discord\.com\/api(?:\/v\d+)?\/webhooks\/\d+\/[A-Za-z0-9_-]+$/.test(url))throw new HttpError(503,'The order notification service is not configured correctly.');return url;}
const clean=value=>String(value).replace(/@/g,'＠').replace(/[\\*_~`|<>\[\]]/g,c=>`\\${c}`);
function chunks(value,size=950){const result=[];for(let i=0;i<value.length;i+=size)result.push(value.slice(i,i+size));return result;}
export function orderEmbed(order){
  const d=order.details;const url=new URL('admin.html',frontendURL());url.searchParams.set('id',order.id);
  const contact=['email','discord','pulsedconnect'].filter(key=>d[key]).map(key=>`${key}: ${d[key]}`).join('\n');
  const fields=[{name:'Order ID',value:order.id,inline:true},{name:'Service / request type',value:clean(`${d.category} / ${d.service}`),inline:true},{name:'Status',value:order.status,inline:true},{name:'Customer contact',value:clean(contact),inline:false},{name:'Budget',value:clean(d.budget),inline:true},{name:'Deadline',value:clean(`${d.deadline}${d.flexible?` · ${d.flexible}`:''}`),inline:true}];
  const add=(name,value)=>chunks(clean(value)).forEach((part,i)=>fields.push({name:i?`${name} (continued)`:name,value:part,inline:false}));
  add('Requirements',d.requirements);
  const excluded=['category','service','title','description','requirements','budget','deadline','flexible','email','discord','pulsedconnect'];
  const extras=Object.entries(d).filter(([k])=>!excluded.includes(k)).map(([k,v])=>`${k}: ${v}`).join('\n');if(extras)add('Additional project details',extras);
  fields.push({name:'Private management',value:`[Review · Accept · Deny](${url.href})\nManagement key required.`,inline:false});
  // Escaping can increase length; reject instead of silently losing request details.
  const description=clean(`${d.title}\n\n${d.description}`);
  const count='Kuro’s Portfolio · Service Request'.length+description.length+fields.reduce((n,f)=>n+f.name.length+f.value.length,0)+65;
  if(count>5900||fields.length>25)throw new HttpError(400,'Please shorten special characters or project details so your request fits in Discord.');
  return{title:'Kuro’s Portfolio · Service Request',description,color:order.status==='Accepted'?0x91c9ac:order.status==='Denied'?0xd98996:0xc6a3eb,fields,timestamp:order.createdAt,footer:{text:'Save this order ID · Private review · No payment information'}};
}
export async function sendOrder(order){const url=new URL(webhookURL());url.searchParams.set('wait','true');const message=await fetchJSON(url.href,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:"Kuro's Portfolio",embeds:[orderEmbed(order)],allowed_mentions:{parse:[]}})});if(!message.id)throw new HttpError(502,'The notification could not be confirmed. Please contact Kuro directly.');return message.id;}
export async function editOrder(order){if(!order.messageId)return;await fetchJSON(`${webhookURL()}/messages/${order.messageId}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({embeds:[orderEmbed(order)],allowed_mentions:{parse:[]}})});}
