import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { api } from '../js/api.js';
const source=await readFile(new URL('../js/api.js',import.meta.url),'utf8');
const {api:unconfiguredAPI}=await import(`data:text/javascript,${encodeURIComponent(source.replace("import { API_BASE_URL } from './config.js';", "const API_BASE_URL = '';"))}`);
test('Vercel deployment uses the same-origin API when public configuration is empty',async()=>{
  globalThis.location={hostname:'portfolio.vercel.app'};let called;
  globalThis.fetch=async(url)=>{called=url;return Response.json({url:'https://checkout.stripe.com/test'});};
  await unconfiguredAPI('create-checkout-session',{amount:'5'});assert.equal(called,'/api/create-checkout-session');
});
test('GitHub Pages reports a missing backend URL before attempting a payment request',async()=>{
  globalThis.location={hostname:'user.github.io'};let called=false;
  globalThis.fetch=async()=>{called=true;throw new Error();};
  await assert.rejects(()=>unconfiguredAPI('create-checkout-session',{amount:'5'}),/backend URL has not been configured/);assert.equal(called,false);
});
test('Production portfolio connects to its separately hosted Vercel API',async()=>{
  globalThis.location={hostname:'kuro.iconrealms.net'};let called;
  globalThis.fetch=async(url)=>{called=url;return Response.json({status:'Pending Review'});};
  await api('submit-order',{title:'Test request'});
  assert.equal(called,'https://kuroportfolio.vercel.app/api/submit-order');
});
