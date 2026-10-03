import { handler,parseBody,antiSpam,validateOrder,rateLimit,newIdentity,hash,saveOrder,redis,HttpError } from '../lib/backend.js';
import { sendOrder,webhookURL,orderEmbed } from '../lib/discord.js';
export default handler('POST',async(req,res)=>{
  const body=parseBody(req);antiSpam(body);const details=validateOrder(body);webhookURL();
  await rateLimit(req,res,'order',4,900);
  const {id,token}=newIdentity();const order={id,tokenHash:hash(token),details,status:'Pending Review',createdAt:new Date().toISOString(),delivered:false};
  orderEmbed(order);await saveOrder(order);
  try{order.messageId=await sendOrder(order);order.delivered=true;await saveOrder(order);}
  catch(error){
    if(!order.messageId){try{await redis(['DEL',`kuro:order:${id}`]);}catch{}throw error;}
    // Never tell a customer to resubmit a message that Discord already received.
    throw new HttpError(503,`Discord received request ${id}, but tracking could not be finalized. Save this ID and contact Kuro before submitting again.`);
  }
  return{id,token,status:order.status};
});
