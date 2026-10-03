import { handler,redis,HttpError,fetchJSON,hasRedis } from '../lib/backend.js';
const servers=['play.pulsedmc.net','icongen.minehut.gg','iconminez.minehut.gg','iconmc.minehut.gg','originsmp.pulsedmc.net','play.MineralMountainMC.net'];
const int=n=>Number.isInteger(n)&&n>=0?n:null;
const localCache=new Map(),inflight=new Map();
async function loadStatus(address){
  try{
    const data=await fetchJSON(`https://api.mcstatus.io/v2/status/java/${encodeURIComponent(address)}?query=false`);
    if(typeof data.online!=='boolean')throw new Error('Invalid status');
    const icon=typeof data.icon==='string'&&data.icon.length<30000&&/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(data.icon)?data.icon:null;
    return{available:true,online:data.online,players:int(data.players?.online),max:int(data.players?.max),version:String(data.version?.name_clean || '').slice(0,100),motd:String(data.motd?.clean || '').slice(0,600),icon,checkedAt:Date.now()};
  }catch{return{available:false,checkedAt:Date.now()};}
}
export default handler('GET',async(req,res)=>{
  const address=new URL(req.url,'https://backend.invalid').searchParams.get('address');
  if(!servers.includes(address))throw new HttpError(400,'This server is not in the portfolio.');
  if(!hasRedis()){
    res.setHeader('Cache-Control','public, max-age=60, s-maxage=300');
    const cached=localCache.get(address);if(cached&&cached.expires>Date.now())return cached.data;
    if(inflight.has(address))return inflight.get(address);
    const pending=loadStatus(address).then(data=>{localCache.set(address,{data,expires:Date.now()+300000});return data;}).finally(()=>inflight.delete(address));
    inflight.set(address,pending);return pending;
  }
  const key=`kuro:mc:${address}`;let cached;try{cached=await redis(['GET',key]);}catch{}
  if(cached){res.setHeader('Cache-Control','public, max-age=60, s-maxage=300');return JSON.parse(cached);}
  // Shared lock prevents multiple cold serverless instances from flooding MCStatus.
  let locked;try{locked=await redis(['SET',`${key}:lock`,'1','NX','EX',15]);}catch{return{available:false};}
  if(!locked)return{available:false};
  let result;
  try{
    const data=await fetchJSON(`https://api.mcstatus.io/v2/status/java/${encodeURIComponent(address)}?query=false`);
    if(typeof data.online!=='boolean')throw new Error('Invalid status');
    const icon=typeof data.icon==='string'&&data.icon.length<30000&&/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(data.icon)?data.icon:null;
    result={available:true,online:data.online,players:int(data.players?.online),max:int(data.players?.max),version:String(data.version?.name_clean || '').slice(0,100),motd:String(data.motd?.clean || '').slice(0,600),icon,checkedAt:Date.now()};
  }catch{result={available:false,checkedAt:Date.now()};}
  try{await redis(['SET',key,JSON.stringify(result),'EX',300]);}catch{}
  res.setHeader('Cache-Control','public, max-age=60, s-maxage=300');return result;
});
