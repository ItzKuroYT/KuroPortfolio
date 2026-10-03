import { handler,parseBody,rateLimit,identifier,getOrder,hash,secureEqual,HttpError } from '../lib/backend.js';
export default handler('POST',async(req,res)=>{
  const body=parseBody(req);await rateLimit(req,res,'status',30);
  identifier(body.id);if(typeof body.token!=='string'||! /^[a-f0-9]{64}$/.test(body.token))throw new HttpError(404,'No request matches those tracking details, or it has expired.');
  const order=await getOrder(body.id);
  if(!order?.delivered||!secureEqual(hash(body.token),order.tokenHash))throw new HttpError(404,'No request matches those tracking details, or it has expired.');
  return{id:order.id,status:order.status,createdAt:order.createdAt};
});