import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { requiredEnv, HttpError, RETENTION, fetchJSON, identifier } from './backend.js';
import { webhookURL } from './discord.js';

function encryptionKey(){
  const key=requiredEnv('ORDER_ADMIN_KEY');
  if(key.length<32)throw new HttpError(503,'Set ORDER_ADMIN_KEY to a random value of at least 32 characters.');
  return createHash('sha256').update(`kuro-tracking-v1:${key}`).digest();
}
export function checkTrackingConfiguration(){encryptionKey();}
export function sealReference(order){
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',encryptionKey(),iv);
  cipher.setAAD(Buffer.from('kuro-order-v1'));
  const ciphertext=Buffer.concat([cipher.update(JSON.stringify({id:order.id,messageId:order.messageId,expires:Date.parse(order.createdAt)+RETENTION*1000}),'utf8'),cipher.final()]);
  return `d1.${iv.toString('hex')}.${ciphertext.toString('hex')}.${cipher.getAuthTag().toString('hex')}`;
}
export function openReference(token,id){
  const key=encryptionKey();
  try{
    if(typeof token!=='string'||token.length>800||!/^d1\.[a-f0-9]{24}\.[a-f0-9]{2,700}\.[a-f0-9]{32}$/.test(token))throw new Error();
    const[,iv,text,tag]=token.split('.'),decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(iv,'hex'));
    decipher.setAAD(Buffer.from('kuro-order-v1'));decipher.setAuthTag(Buffer.from(tag,'hex'));
    const value=JSON.parse(Buffer.concat([decipher.update(Buffer.from(text,'hex')),decipher.final()]).toString('utf8'));
    if(value.id!==id||!Number.isFinite(value.expires)||value.expires<=Date.now())throw new Error();
    return value;
  }catch{throw new HttpError(404,'No request matches those tracking details, or it has expired.');}
}
export async function readDiscordOrder(id,messageId){
  identifier(id);
  if(typeof messageId!=='string'||!/^\d{1,22}$/.test(messageId))throw new HttpError(400,'Open the review link from the Discord order message, or enter its Discord message ID.');
  const message=await fetchJSON(`${webhookURL()}/messages/${messageId}`,{method:'GET'});
  const embed=message.embeds?.find(e=>e.title==='Kuro’s Portfolio · Service Request'&&e.fields?.some(f=>f.name==='Order ID'&&f.value===id));
  const status=embed?.fields?.find(f=>f.name==='Status')?.value;
  if(!embed||!['Pending Review','Accepted','Denied'].includes(status)||!embed.timestamp||Date.parse(embed.timestamp)+RETENTION*1000<=Date.now())throw new HttpError(404,'The request was not found or has expired.');
  const details={'Project description':embed.description};
  for(const field of embed.fields)if(!['Order ID','Status','Private management'].includes(field.name))details[field.name]=(details[field.name]?`${details[field.name]}\n`:'')+field.value;
  return{id,messageId,status,createdAt:embed.timestamp,details,embed};
}
const decisions=new Map();
export async function decideDiscordOrder(id,messageId,decision){
  const key=`${id}:${messageId}`;
  if(decisions.has(key))throw new HttpError(409,'A decision is being saved. Please review the order again in a moment.');
  decisions.set(key,true);
  try{
    const order=await readDiscordOrder(id,messageId);
    if(order.status!=='Pending Review')throw new HttpError(409,'This request already has a decision. Review it again to see its status.');
    const embed={...order.embed,color:decision==='Accepted'?0x91c9ac:0xd98996,fields:order.embed.fields.map(f=>f.name==='Status'?{...f,value:decision}:f)};
    await fetchJSON(`${webhookURL()}/messages/${messageId}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({embeds:[embed],allowed_mentions:{parse:[]}})});
    return{...order,status:decision};
  }finally{decisions.delete(key);}
}
