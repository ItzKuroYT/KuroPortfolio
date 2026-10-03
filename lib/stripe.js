import { HttpError } from './backend.js';

const safeIdentifier=value=>typeof value==='string'&&/^[A-Za-z0-9_.\[\]-]{1,160}$/.test(value)?value:undefined;

export async function createStripeCheckout(params,key){
  let response;
  try{
    response=await fetch('https://api.stripe.com/v1/checkout/sessions',{
      method:'POST',
      headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/x-www-form-urlencoded','Stripe-Version':'2025-03-31.basil'},
      body:params.toString(),signal:AbortSignal.timeout(10000)
    });
  }catch{throw new HttpError(502,'Could not connect to Stripe. Please try again in a moment.');}
  let body;
  try{body=await response.json();}catch{throw new HttpError(502,'Stripe returned an unexpected response. Please try again later.');}
  if(!response.ok){
    const error=body?.error||{},requestId=safeIdentifier(response.headers.get('request-id'));
    const code=safeIdentifier(error.code),parameter=safeIdentifier(error.param);
    // Stripe can echo invalid credentials in errors. Never log keys or send raw errors to visitors.
    const message=String(error.message||'No error detail provided').split(key).join('[redacted]')
      .replace(/\b(?:sk|rk|pk)_(?:test|live)_[A-Za-z0-9*_.-]+/g,'[redacted]')
      .replace(/Bearer\s+\S+/gi,'Bearer [redacted]').slice(0,1200);
    console.error('Stripe Checkout rejected',{status:response.status,requestId,code,parameter,message});
    const reference=requestId?` Reference: ${requestId}.`:'';
    if(response.status===401||response.status===403)throw new HttpError(503,`Stripe checkout is not configured with a valid authorized secret key. Kuro needs to check the Vercel Stripe setting.${reference}`);
    if(response.status===429)throw new HttpError(503,`Stripe is receiving too many requests. Please try again shortly.${reference}`);
    if(/tax/i.test(parameter||'')||/tax/i.test(code||''))throw new HttpError(503,`Stripe rejected the tax configuration. Kuro needs to check the Stripe Tax settings and request logs.${reference}`);
    if(response.status===400)throw new HttpError(503,`Stripe rejected the checkout configuration${parameter?` (${parameter})`:''}. Kuro needs to check the Stripe request logs.${reference}`);
    throw new HttpError(502,`Stripe could not create checkout. Please try again later.${reference}`);
  }
  let url;
  try{url=new URL(body.url);}catch{throw new HttpError(502,'Stripe did not return a payment link. Please try again.');}
  if(url.protocol!=='https:'||url.hostname!=='checkout.stripe.com')throw new HttpError(502,'Stripe returned an invalid payment link. Please contact Kuro.');
  return{url:url.href};
}
