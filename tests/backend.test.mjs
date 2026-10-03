import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import checkout from '../api/create-checkout-session.js';
import submit from '../api/submit-order.js';
import status from '../api/order-status.js';
import manage from '../api/manage-order.js';
import mc from '../api/mc-status.js';
import { validateOrder } from '../lib/backend.js';
const origin='https://kuro.example';
const valid=()=>({category:'Web Development',service:'Website',title:'Test website',description:'A portfolio website for a test project.',requirements:'Three pages and accessible navigation.',budget:'100 USD',deadline:'2099-12-31',email:'customer@example.com',consent:true,elapsed:4000});
let store,calls,rate,failDiscord,failRedis,failMC,messages;
beforeEach(()=>{
  process.env.ALLOWED_ORIGINS=origin;process.env.FRONTEND_URL=`${origin}/portfolio/`;
  process.env.STRIPE_SECRET_KEY='test-only-key';process.env.ORDER_ADMIN_KEY='test-management-key-that-is-long-enough';
  process.env.DISCORD_ORDER_WEBHOOK_URL='https://discord.com/api/webhooks/123/test-token';
  process.env.UPSTASH_REDIS_REST_URL='https://database.example';process.env.UPSTASH_REDIS_REST_TOKEN='test-only-redis';
  store=new Map();messages=new Map();calls=[];rate=1;failDiscord=failRedis=failMC=false;
  globalThis.fetch=async(url,options={})=>{
    calls.push({url:String(url),...options});let result;
    if(String(url)==='https://database.example'){
      if(failRedis)return new Response('fail',{status:500});
      const c=JSON.parse(options.body),op=c[0];
      if(op==='GET')result=store.get(c[1])||null;
      if(op==='SET'){if(c.includes('NX')&&store.has(c[1]))result=null;else{store.set(c[1],c[2]);result='OK';}}
      if(op==='DEL'){store.delete(c[1]);result=1;}
      if(op==='EVAL'){
        if(c[1].includes('INCR'))result=rate;
        else{const raw=store.get(c[3]);if(!raw)result='missing';else{const order=JSON.parse(raw);if(order.status!=='Pending Review')result='decided';else{order.status=c[4];order.updatedAt=c[5];store.set(c[3],JSON.stringify(order));result='ok';}}}
      }
      return Response.json({result});
    }
    if(String(url).startsWith('https://api.stripe.com'))return Response.json({url:'https://checkout.stripe.com/c/pay/test'});
    if(String(url).startsWith('https://discord.com')){
      if(failDiscord)return new Response('fail',{status:502});
      if(options.method==='GET')return messages.has('123456789')?Response.json(messages.get('123456789')):new Response('not found',{status:404});
      const message={id:'123456789',...JSON.parse(options.body)};messages.set(message.id,message);return Response.json(message);
    }
    if(String(url).startsWith('https://api.mcstatus.io'))return failMC?new Response('fail',{status:503}):Response.json({online:true,players:{online:3,max:40},version:{name_clean:'1.21'},motd:{clean:'<script>alert(1)</script>Test server'}});
    throw new Error(`Unexpected network request: ${url}`);
  };
});
async function invoke(fn,body={},extra={}){
  const req={method:'POST',body,headers:{origin,'content-type':'application/json','x-vercel-forwarded-for':'127.0.0.1',...extra.headers},url:extra.url||'/api',...extra};
  req.headers={origin,'content-type':'application/json','x-vercel-forwarded-for':'127.0.0.1',...extra.headers};
  const res={headers:{},statusCode:200,writableEnded:false,setHeader(k,v){this.headers[k]=v;},end(value){this.value=value;this.writableEnded=true;}};
  await fn(req,res);return{status:res.statusCode,headers:res.headers,body:res.value?JSON.parse(res.value):null};
}
test('Checkout sends integer cents, USD and configured GitHub subpath URLs to Stripe',async()=>{
  const response=await invoke(checkout,{amount:'15.25',elapsed:4000});assert.equal(response.status,200);
  const call=calls.find(c=>c.url.startsWith('https://api.stripe.com'));const params=new URLSearchParams(call.body);
  assert.equal(params.get('line_items[0][price_data][unit_amount]'),'1525');assert.equal(params.get('line_items[0][price_data][currency]'),'usd');assert.equal(params.get('success_url'),`${origin}/portfolio/success.html`);assert.equal(params.get('cancel_url'),`${origin}/portfolio/cancel.html`);
});
test('Donation validates bounds and precision on the server',async()=>{for(const amount of ['0','0.99','10000.01','1.234','-1','NaN',100])assert.equal((await invoke(checkout,{amount,elapsed:4000})).status,400);});
test('CORS allows exact configured origin, handles preflight and rejects unknown origin',async()=>{
  assert.equal((await invoke(checkout,{}, {method:'OPTIONS'})).status,204);
  const denied=await invoke(checkout,{}, {headers:{origin:'https://evil.example'}});assert.equal(denied.status,403);assert.equal(denied.headers['Access-Control-Allow-Origin'],undefined);
  assert.equal((await invoke(checkout,{}, {method:'GET'})).status,405);
});
test('Order validates service, contact, length, YouTube URLs and consent',()=>{
  assert.throws(()=>validateOrder({...valid(),email:''}));assert.throws(()=>validateOrder({...valid(),service:'Backend'}));assert.throws(()=>validateOrder({...valid(),consent:false}));assert.throws(()=>validateOrder({...valid(),title:'x'.repeat(121)}));assert.throws(()=>validateOrder({...valid(),category:'Voice Acting',service:'YouTube',channelUrl:'https://evil.example'}));assert.throws(()=>validateOrder({...valid(),deadline:'2099-02-30'}));
});
test('Order delivery, private tracking, authorized acceptance and Discord message update',async()=>{
  const received=await invoke(submit,valid());assert.equal(received.status,200);assert.match(received.body.id,/^KURO-[A-F0-9]{16}$/);assert.equal(received.body.token.length,64);
  const webhook=calls.find(c=>c.url.includes('discord.com'));const message=JSON.parse(webhook.body);assert.deepEqual(message.allowed_mentions,{parse:[]});assert.ok(message.embeds[0].fields.some(f=>f.name==='Private management'));assert.ok(!webhook.body.includes(process.env.ORDER_ADMIN_KEY));
  const check=await invoke(status,{id:received.body.id,token:received.body.token});assert.equal(check.body.status,'Pending Review');assert.equal(check.body.details,undefined);
  assert.equal((await invoke(status,{id:received.body.id,token:'f'.repeat(64)})).status,404);
  assert.equal((await invoke(manage,{id:received.body.id,decision:'Accepted'})).status,401);
  const accepted=await invoke(manage,{id:received.body.id,decision:'Accepted'},{headers:{authorization:`Bearer ${process.env.ORDER_ADMIN_KEY}`}});assert.equal(accepted.body.status,'Accepted');assert.ok(calls.some(c=>c.method==='PATCH'&&c.url.includes('discord.com')));
  assert.equal((await invoke(status,{id:received.body.id,token:received.body.token})).body.status,'Accepted');
  assert.equal((await invoke(manage,{id:received.body.id,decision:'Denied'},{headers:{authorization:`Bearer ${process.env.ORDER_ADMIN_KEY}`}})).status,409);
});
test('Deny works and failed Discord edits preserve the durable decision',async()=>{
  const received=await invoke(submit,valid());failDiscord=true;const denied=await invoke(manage,{id:received.body.id,decision:'Denied'},{headers:{authorization:`Bearer ${process.env.ORDER_ADMIN_KEY}`}});assert.equal(denied.body.status,'Denied');assert.ok(denied.body.warning);assert.equal((await invoke(status,{id:received.body.id,token:received.body.token})).body.status,'Denied');
});
test('Webhook failures produce a useful error and no false confirmation',async()=>{failDiscord=true;const response=await invoke(submit,valid());assert.equal(response.status,502);assert.equal(response.body.id,undefined);assert.ok(![...store.keys()].some(k=>k.startsWith('kuro:order:')));});
test('Rate limit, honeypot and missing database fail closed before external writes',async()=>{
  assert.equal((await invoke(submit,{...valid(),company:'spam'})).status,400);
  assert.equal((await invoke(submit,{...valid(),elapsed:10})).status,400);
  rate=5;assert.equal((await invoke(submit,valid())).status,429);assert.ok(!calls.some(c=>c.url.includes('discord.com')));
  failRedis=true;assert.equal((await invoke(checkout,{amount:'5',elapsed:4000})).status,503);assert.ok(!calls.some(c=>c.url.includes('stripe.com')));
});
test('MCStatus uses an allowlist, cached results and clean text; failures degrade gracefully',async()=>{
  const opts={method:'GET',url:'/api/mc-status?address=play.pulsedmc.net'};let result=await invoke(mc,{},opts);assert.equal(result.body.online,true);assert.equal(result.body.players,3);assert.equal(result.body.motd,'<script>alert(1)</script>Test server');
  result=await invoke(mc,{},opts);assert.equal(result.body.online,true);assert.equal(calls.filter(c=>c.url.includes('api.mcstatus.io')).length,1);
  assert.equal((await invoke(mc,{}, {method:'GET',url:'/api/mc-status?address=localhost'})).status,400);
  failMC=true;result=await invoke(mc,{}, {method:'GET',url:'/api/mc-status?address=iconmc.minehut.gg'});assert.equal(result.body.available,false);
});
function withoutRedis(){delete process.env.UPSTASH_REDIS_REST_URL;delete process.env.UPSTASH_REDIS_REST_TOKEN;}
test('Checkout works without Redis and never contacts a database',async()=>{
  withoutRedis();const result=await invoke(checkout,{amount:'10',elapsed:4000},{headers:{'x-vercel-forwarded-for':'donation-fallback-test'}});
  assert.equal(result.status,200);assert.ok(!calls.some(c=>c.url==='https://database.example'));
});
test('Discord storage supports private tracking and authenticated review without Redis',async()=>{
  withoutRedis();const received=await invoke(submit,valid(),{headers:{'x-vercel-forwarded-for':'order-fallback-test'}});assert.equal(received.status,200);assert.ok(received.body.token.startsWith('d1.'));
  assert.ok(messages.get('123456789').embeds[0].fields.find(f=>f.name==='Private management').value.includes('messageId=123456789'));
  const response=await invoke(status,{id:received.body.id,token:received.body.token});assert.equal(response.body.status,'Pending Review');assert.equal(response.body.details,undefined);
  const altered=received.body.token.slice(0,-1)+(received.body.token.endsWith('a')?'b':'a');assert.equal((await invoke(status,{id:received.body.id,token:altered})).status,404);
  assert.equal((await invoke(status,{id:'KURO-FFFFFFFFFFFFFFFF',token:received.body.token})).status,404);
  assert.equal((await invoke(manage,{id:received.body.id,messageId:'123456789',decision:'Denied'})).status,401);
  const denied=await invoke(manage,{id:received.body.id,messageId:'123456789',decision:'Denied'},{headers:{authorization:`Bearer ${process.env.ORDER_ADMIN_KEY}`}});assert.equal(denied.body.status,'Denied');
  assert.equal((await invoke(status,{id:received.body.id,token:received.body.token})).body.status,'Denied');
  assert.equal((await invoke(manage,{id:received.body.id,messageId:'123456789',decision:'Accepted'},{headers:{authorization:`Bearer ${process.env.ORDER_ADMIN_KEY}`}})).status,409);
});
test('Per-instance rate limiting still rejects excess checkout requests without Redis',async()=>{
  withoutRedis();let response;for(let i=0;i<9;i++)response=await invoke(checkout,{amount:'5',elapsed:4000},{headers:{'x-vercel-forwarded-for':'rate-fallback-test'}});assert.equal(response.status,429);
});
test('Minecraft status works without Redis and reuses cached upstream data',async()=>{
  withoutRedis();const opts={method:'GET',url:'/api/mc-status?address=play.MineralMountainMC.net'};
  assert.equal((await invoke(mc,{},opts)).body.online,true);assert.equal((await invoke(mc,{},opts)).body.online,true);
  assert.equal(calls.filter(c=>c.url.includes('api.mcstatus.io')).length,1);assert.ok(!calls.some(c=>c.url==='https://database.example'));
});
