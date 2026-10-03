import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
export class HttpError extends Error { constructor(status,message){super(message);this.status=status;} }
export const hash = value => createHash('sha256').update(value).digest('hex');
export const RETENTION = 90 * 24 * 60 * 60;
export function requiredEnv(name){const value=process.env[name]?.trim();if(!value)throw new HttpError(503,'This service is not configured yet. Please contact Kuro directly.');return value;}
export function frontendURL(){const url=new URL(requiredEnv('FRONTEND_URL'));if(url.protocol!=='https:' && !(process.env.NODE_ENV!=='production' && ['localhost','127.0.0.1'].includes(url.hostname)))throw new HttpError(503,'The service URL is not configured correctly.');url.search='';url.hash='';if(!url.pathname.endsWith('/'))url.pathname+='/';return url;}
export async function fetchJSON(url,options={}){const response=await fetch(url,{...options,signal:AbortSignal.timeout(10000)});if(!response.ok)throw new HttpError(502,'An upstream service could not complete the request. Please try again later.');return response.json();}
export async function redis(command){
  const url=requiredEnv('UPSTASH_REDIS_REST_URL');if(!url.startsWith('https://'))throw new HttpError(503,'Database configuration is invalid.');
  try{const body=await fetchJSON(url,{method:'POST',headers:{Authorization:`Bearer ${requiredEnv('UPSTASH_REDIS_REST_TOKEN')}`,'Content-Type':'application/json'},body:JSON.stringify(command)});if(body.error)throw new Error('Database operation failed');return body.result;}
  catch(error){if(error instanceof HttpError && error.status===503)throw error;throw new HttpError(503,'The request service is temporarily unavailable. Please try again later.');}
}
export async function rateLimit(req,res,bucket,limit,window=600){
  // Vercel controls this header. The local dev server sets it from the socket.
  const ip=req.headers['x-vercel-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  const key=`kuro:rate:${bucket}:${hash(String(ip))}:${Math.floor(Date.now()/1000/window)}`;
  const count=Number(await redis(['EVAL',"local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n",1,key,String(window)]));
  if(count>limit){res.setHeader('Retry-After',String(window));throw new HttpError(429,'Too many requests. Please wait a few minutes before trying again.');}
}
export function parseBody(req){
  if(!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || ''))throw new HttpError(415,'Send a JSON request.');
  let body=req.body;try{if(typeof body==='string' || Buffer.isBuffer(body))body=JSON.parse(String(body));}catch{throw new HttpError(400,'Invalid JSON request.');}
  if(!body || typeof body!=='object' || Array.isArray(body))throw new HttpError(400,'Invalid request body.');
  if(Buffer.byteLength(JSON.stringify(body))>24000)throw new HttpError(413,'The request is too large. Please shorten your details.');return body;
}
export function antiSpam(body){if(body.company)throw new HttpError(400,'The request could not be submitted.');if(!Number.isFinite(body.elapsed)||body.elapsed<2000||body.elapsed>86400000)throw new HttpError(400,'Please take a moment to review your form, then try again.');}
export function secureEqual(a,b){const x=Buffer.from(hash(a)),y=Buffer.from(hash(b));return timingSafeEqual(x,y);}
export function adminAuth(req){const key=requiredEnv('ORDER_ADMIN_KEY');if(key.length<32)throw new HttpError(503,'Management authentication is not configured correctly.');const auth=req.headers.authorization || '';if(!auth.startsWith('Bearer ')||!secureEqual(auth.slice(7),key))throw new HttpError(401,'Invalid management key.');}
export function identifier(id){if(typeof id!=='string'||!/^KURO-[A-F0-9]{16}$/.test(id))throw new HttpError(400,'Enter a valid order ID.');return id;}
export async function getOrder(id){const value=await redis(['GET',`kuro:order:${id}`]);return value?JSON.parse(value):null;}
export async function saveOrder(order){const remaining=Math.max(1,Math.ceil((new Date(order.createdAt).getTime()+RETENTION*1000-Date.now())/1000));await redis(['SET',`kuro:order:${order.id}`,JSON.stringify(order),'EX',remaining]);}
export function newIdentity(){return{id:`KURO-${randomBytes(8).toString('hex').toUpperCase()}`,token:randomBytes(32).toString('hex')};}
const scopes={'Minecraft Development':['Plugin','Skript'],'Web Development':['Website'],'Voice Acting':['YouTube']};
const extraFields={
  'Minecraft Development':{minecraftVersion:300,serverSoftware:300,commands:600,permissions:600,dependencies:300,references:600},
  'Web Development':{purpose:300,pages:10,sections:600,style:300,references:600,features:600},
  'Voice Acting':{channelName:300,channelUrl:300,character:300,characterDescription:600,wordCount:10,scriptStatus:300,voiceDirection:600}
};
function text(body,key,max,required=false){const value=body[key]??'';if(typeof value!=='string')throw new HttpError(400,`Invalid ${key}.`);const clean=value.trim();if(required&&!clean)throw new HttpError(400,`Please provide ${key}.`);if(clean.length>max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(clean))throw new HttpError(400,`${key} is too long or contains invalid characters.`);return clean;}
export function validateOrder(body){
  if(!scopes[body.category]?.includes(body.service))throw new HttpError(400,'Choose a valid category and service.');
  if(body.consent!==true)throw new HttpError(400,'Consent is required to send your request privately to Kuro.');
  const details={category:body.category,service:body.service,title:text(body,'title',120,true),description:text(body,'description',1800,true),requirements:text(body,'requirements',1800,true),budget:text(body,'budget',100,true),deadline:text(body,'deadline',10,true),flexible:text(body,'flexible',30),notes:text(body,'notes',1000),email:text(body,'email',254),discord:text(body,'discord',100),pulsedconnect:text(body,'pulsedconnect',100)};
  if(!details.email&&!details.discord&&!details.pulsedconnect)throw new HttpError(400,'Provide at least one contact method: Email, Discord, or PulsedConnect.');
  if(details.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(details.email))throw new HttpError(400,'Provide a valid email address.');
  const date=new Date(`${details.deadline}T00:00:00Z`);if(!/^\d{4}-\d{2}-\d{2}$/.test(details.deadline)||isNaN(date)||date.toISOString().slice(0,10)!==details.deadline||date.getTime()<Date.now()-86400000)throw new HttpError(400,'Choose a valid future deadline.');
  for(const[key,max]of Object.entries(extraFields[body.category])){const value=text(body,key,max);if(value)details[key]=value;}
  for(const key of ['pages','wordCount'])if(details[key]&&(!/^\d+$/.test(details[key])||Number(details[key])<1||Number(details[key])>(key==='pages'?1000:1000000)))throw new HttpError(400,`Provide a valid ${key==='pages'?'page count':'word count'}.`);
  if(details.channelUrl){let url;try{url=new URL(details.channelUrl);}catch{throw new HttpError(400,'Provide a valid YouTube channel URL.');}if(url.protocol!=='https:'||!['youtube.com','www.youtube.com','m.youtube.com','youtu.be'].includes(url.hostname))throw new HttpError(400,'Voice acting requests are for YouTube projects only. Use a YouTube channel URL.');}
  // Keeps all submitted content inside Discord's total 6,000-character embed limit.
  if(Object.values(details).reduce((n,v)=>n+v.length,0)>4500)throw new HttpError(400,'Please shorten your request to 4,500 characters in total so it can be sent to Discord.');
  return details;
}
export function handler(method,work){return async(req,res)=>{
  res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Vary','Origin');
  try{
    const origin=req.headers.origin;
    const allowed=requiredEnv('ALLOWED_ORIGINS').split(',').map(s=>s.trim()).filter(Boolean);
    if((!origin && method!=='GET') || (origin && !allowed.includes(origin)))throw new HttpError(403,'This website is not allowed to use the service.');
    if(origin)res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Access-Control-Allow-Methods',`${method}, OPTIONS`);res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');res.setHeader('Access-Control-Max-Age','600');
    if(req.method==='OPTIONS'){res.statusCode=204;res.end();return;}
    if(req.method!==method){res.setHeader('Allow',`${method}, OPTIONS`);throw new HttpError(405,'Method not allowed.');}
    const result=await work(req,res);if(!res.writableEnded){res.statusCode=200;res.end(JSON.stringify(result));}
  }catch(error){res.statusCode=error instanceof HttpError?error.status:500;res.end(JSON.stringify({error:error instanceof HttpError?error.message:'Something went wrong. Please try again or contact Kuro directly.'}));}
};}
