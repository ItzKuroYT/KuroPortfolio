import { handler,parseBody,rateLimit,adminAuth,identifier,getOrder,redis,HttpError } from '../lib/backend.js';
import { editOrder } from '../lib/discord.js';
export default handler('POST',async(req,res)=>{
  const body=parseBody(req);await rateLimit(req,res,'admin',20);adminAuth(req);identifier(body.id);
  let order=await getOrder(body.id);if(!order?.delivered)throw new HttpError(404,'The request was not found or is not ready for review.');
  let warning;
  if(body.decision){
    if(!['Accepted','Denied'].includes(body.decision))throw new HttpError(400,'Choose Accepted or Denied.');
    // Atomic compare-and-update: simultaneous clicks cannot overwrite a decision.
    const result=await redis(['EVAL',"local raw=redis.call('GET',KEYS[1]); if not raw then return 'missing' end; local o=cjson.decode(raw); if o.status~='Pending Review' then return 'decided' end; o.status=ARGV[1]; o.updatedAt=ARGV[2]; redis.call('SET',KEYS[1],cjson.encode(o),'KEEPTTL'); return 'ok'",1,`kuro:order:${order.id}`,body.decision,new Date().toISOString()]);
    if(result!=='ok')throw new HttpError(409,'This request already has a decision. Review it again to see the current status.');
    order=await getOrder(body.id);
  }
  // A subsequent authenticated review retries notification if an edit failed earlier.
  if(order.status!=='Pending Review')try{await editOrder(order);}catch{warning='The status was saved, but Discord could not be updated. Authenticate & review again to retry the message update.';}
  return{id:order.id,status:order.status,details:{...order.details,submitted:order.createdAt},...(warning?{warning}:{})};
});
