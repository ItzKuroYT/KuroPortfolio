import { handler,parseBody,rateLimit,requiredEnv,frontendURL,HttpError,fetchJSON } from '../lib/backend.js';
export default handler('POST',async(req,res)=>{
  const body=parseBody(req);
  const value=body.amount;
  if(typeof value!=='string'||!/^\d{1,5}(\.\d{1,2})?$/.test(value))throw new HttpError(400,'Enter a valid donation amount with at most two decimal places.');
  const cents=Math.round(Number(value)*100);if(!Number.isSafeInteger(cents)||cents<100||cents>1000000)throw new HttpError(400,'Choose an amount from $1.00 to $10,000.00 USD.');
  const key=requiredEnv('STRIPE_SECRET_KEY');const base=frontendURL();await rateLimit(req,res,'donate',8);
  const params=new URLSearchParams({mode:'payment',submit_type:'donate',success_url:new URL('success.html',base).href,cancel_url:new URL('cancel.html',base).href,'line_items[0][quantity]':'1','line_items[0][price_data][currency]':'usd','line_items[0][price_data][unit_amount]':String(cents),'line_items[0][price_data][product_data][name]':"Support Kuro's Portfolio"});
  const session=await fetchJSON('https://api.stripe.com/v1/checkout/sessions',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/x-www-form-urlencoded'},body:params.toString()});
  if(!session.url||!session.url.startsWith('https://checkout.stripe.com/'))throw new HttpError(502,'Stripe could not create a secure checkout. Please try again.');
  return{url:session.url};
});
