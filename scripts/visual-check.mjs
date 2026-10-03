import { chromium } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
await mkdir('test-results',{recursive:true});
const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
await page.goto('http://localhost:3000');await page.screenshot({path:'test-results/home-desktop.png',fullPage:true});await page.screenshot({path:'test-results/hero-desktop.png'});
await page.setViewportSize({width:390,height:844});
for(const name of ['index','about','web','minecraft','voice','projects','donate','order','contact','order-status']){
  await page.goto(`http://localhost:3000/${name}.html`);
  const overflow=await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1&&getComputedStyle(e).position!=='absolute').map(e=>({tag:e.tagName,cls:e.className,right:Math.round(e.getBoundingClientRect().right)})));
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))console.log(name,JSON.stringify(overflow.slice(0,20)),await page.evaluate(()=>({width:innerWidth,doc:document.documentElement.scrollWidth,body:document.body.scrollWidth,all:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1||e.getBoundingClientRect().left< -1).map(e=>({cls:e.className,tag:e.tagName,x:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right,scroll:e.scrollWidth,overflow:getComputedStyle(e).overflow})).slice(0,30)})));
}
await page.goto('http://localhost:3000');await page.screenshot({path:'test-results/home-mobile.png',fullPage:true});await page.screenshot({path:'test-results/hero-mobile.png'});
for(const width of [320,768]){
  await page.setViewportSize({width,height:900});
  for(const name of ['index','web','minecraft','voice','donate','order','contact','order-status']){
    await page.goto(`http://localhost:3000/${name}.html`);
    if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)){console.log(await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).map(e=>({cls:e.className,tag:e.tagName,right:e.getBoundingClientRect().right})).slice(0,25)));throw new Error(`${name} overflows at ${width}px`);}
  }
}
console.log('Visual layout checks passed at 320px, 390px, 768px and 1440px.');
await page.setViewportSize({width:1200,height:630});
const svg=await readFile('assets/images/social.svg','utf8');
await page.setContent(`<body style="margin:0">${svg}</body>`);await page.screenshot({path:'assets/images/social.png'});
await browser.close();
