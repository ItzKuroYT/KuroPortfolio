import { handler,parseBody,rateLimit,requiredEnv,frontendURL,HttpError } from '../lib/backend.js';
import { createStripeCheckout } from '../lib/stripe.js';
export default handler('POST',async(req,res)=>{
  const body=parseBody(req);
  const value=body.amount;
  if(typeof value!=='string'||!/^\d{1,5}(\.\d{1,2})?$/.test(value))throw new HttpError(400,'Enter a valid donation amount with at most two decimal places.');
  const cents=Math.round(Number(value)*100);if(!Number.isSafeInteger(cents)||cents<100||cents>1000000)throw new HttpError(400,'Choose an amount from $1.00 to $10,000.00 USD.');
  const key=requiredEnv('STRIPE_SECRET_KEY');const base=frontendURL();await rateLimit(req,res,'donate',8);
  const automaticTax=process.env.STRIPE_AUTOMATIC_TAX?.trim()||'false';
  if(!['true','false'].includes(automaticTax))throw new HttpError(503,'Set STRIPE_AUTOMATIC_TAX to true or false in Vercel.');
  // Cash support gives the donor no goods or services. It is outside Managed Payments' supported digital sales.
  const params=new URLSearchParams({mode:'payment',submit_type:'donate',success_url:new URL('success.html',base).href,cancel_url:new URL('cancel.html',base).href,
    'managed_payments[enabled]':'false','automatic_tax[enabled]':automaticTax,
    'line_items[0][quantity]':'1','line_items[0][price_data][currency]':'usd','line_items[0][price_data][unit_amount]':String(cents),
    'line_items[0][price_data][tax_behavior]':'inclusive',
    'line_items[0][price_data][product_data][name]':"Support Kuro's Portfolio",
    'line_items[0][price_data][product_data][tax_code]':'txcd_90000001'});
  return createStripeCheckout(params,key);
});
