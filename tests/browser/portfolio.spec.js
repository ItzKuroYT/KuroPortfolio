import { test, expect } from '@playwright/test';
test('Navigation and responsive pages work under a GitHub repository subpath',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const name of ['index','about','web','minecraft','voice','projects','donate','order','contact','order-status','success','cancel','privacy']){
    await page.goto(`/KuroPortfolio/${name}.html`);await expect(page.locator('h1')).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
    for(const link of await page.locator('a[href]').evaluateAll(els=>els.map(e=>e.getAttribute('href')).filter(h=>h.endsWith('.html')))){
      const response=await page.request.get(`/KuroPortfolio/${link}`);expect(response.status()).toBe(200);
    }
  }
  expect(errors).toEqual([]);
});
test('Mobile menu is keyboard friendly and closes with Escape',async({page},info)=>{
  test.skip(info.project.name!=='mobile');await page.goto('/');const toggle=page.locator('.menu-toggle');await toggle.click();await expect(toggle).toHaveAttribute('aria-expanded','true');await expect(page.getByRole('navigation').getByRole('link',{name:'Web Development',exact:true})).toBeVisible();await page.keyboard.press('Escape');await expect(toggle).toHaveAttribute('aria-expanded','false');await expect(toggle).toBeFocused();
});
test('Order form changes service fields and requires a customer contact method',async({page})=>{
  await page.goto('/order.html?service=Website');await expect(page.locator('#service')).toHaveValue('Website');await expect(page.getByLabel('Website purpose')).toBeVisible();await expect(page.locator('#service-scope')).toContainText('frontend development only');
  await page.getByLabel('Project title / name').fill('Test project');await page.getByLabel('Budget (USD or range)').fill('100 USD');await page.getByLabel('Detailed project description').fill('Test description');await page.getByLabel('Requirements / features').fill('Three pages');await page.getByLabel('Desired deadline').fill('2099-12-31');await page.locator('[name=consent]').check();await page.getByRole('button',{name:'Send my request'}).click();await expect(page.locator('#contact-error')).toContainText('at least one');
  await page.locator('[name=category][value="Voice Acting"]').check();await expect(page.getByLabel('YouTube channel URL')).toBeVisible();await expect(page.locator('#service-scope')).toContainText('YouTube projects only');
});
test('Order confirmation uses API result and keeps tracking token out of query',async({page})=>{
  await page.route('**/api/submit-order',route=>route.fulfill({json:{id:'KURO-1234567890ABCDEF',token:'a'.repeat(64),status:'Pending Review'}}));
  await page.goto('/order.html?service=Skript');await page.getByLabel('Project title / name').fill('Test server');await page.getByLabel('Budget (USD or range)').fill('50 USD');await page.getByLabel('Detailed project description').fill('Server request');await page.getByLabel('Requirements / features').fill('Some commands');await page.getByLabel('Desired deadline').fill('2099-12-31');await page.getByLabel('Discord username',{exact:true}).fill('testuser');await page.locator('[name=consent]').check();await page.getByRole('button',{name:'Send my request'}).click();await expect(page.locator('#received-id')).toHaveText('KURO-1234567890ABCDEF');await expect(page.locator('#received-token')).toHaveText('a'.repeat(64));expect(new URL(page.url()).search).toBe('');
});
test('Donation presets, custom amount validation and API error handling',async({page})=>{
  await page.goto('/donate.html');await page.locator('[name=preset][value="50"]').check();await expect(page.locator('#donation-total')).toContainText('$50.00');await page.getByLabel('Custom Amount (USD)').fill('0.50');await page.getByRole('button',{name:'Continue to Stripe'}).click();await expect(page.locator('#donation-message')).toContainText('$1.00');
  await page.route('**/api/create-checkout-session',route=>route.fulfill({status:503,json:{error:'Checkout is temporarily unavailable. Please try again.'}}));await page.getByLabel('Custom Amount (USD)').fill('12.50');await page.getByRole('button',{name:'Continue to Stripe'}).click();await expect(page.locator('#donation-message')).toContainText('temporarily unavailable');await expect(page.getByRole('button',{name:'Continue to Stripe'})).toBeEnabled();
});
test('MC status failure stays usable and untrusted MOTD never becomes HTML',async({page})=>{
  await page.route('**/api/mc-status?**',route=>route.fulfill({json:{available:true,online:true,players:3,max:20,version:'1.21',motd:'<img src=x onerror=alert(1)>',checkedAt:Date.now()}}));await page.goto('/minecraft.html');await expect(page.locator('[data-motd]').first()).toHaveText('<img src=x onerror=alert(1)>');expect(await page.locator('[data-motd] img').count()).toBe(0);
  await page.evaluate(()=>localStorage.clear());await page.route('**/api/mc-status?**',route=>route.fulfill({status:502,json:{error:'Unavailable'}}));await page.reload();await expect(page.locator('[data-state]').first()).toHaveText('Status unavailable');await expect(page.getByRole('button',{name:'Copy server address play.pulsedmc.net'})).toBeVisible();
});
test('Reduced motion disables screenshot transitions',async({page})=>{await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');expect(await page.locator('.hero-shot-front').evaluate(el=>getComputedStyle(el).transitionDuration)).toBe('0s');});
test('All six supplied screenshots load and the viewer works with keyboard navigation',async({page})=>{
  await page.goto('/web.html');
  const expected=['minecraftlisting','minestore','icongens','iconrealms','kioume','jjs-libraries'];
  const previews=page.locator('.project-preview');await expect(previews).toHaveCount(6);
  for(let i=0;i<expected.length;i++){
    const button=previews.nth(i);await button.scrollIntoViewIfNeeded();
    await expect(button.locator('img')).toHaveAttribute('src',`assets/images/projects/${expected[i]}.png`);
    await expect.poll(()=>button.locator('img').evaluate(img=>img.complete&&img.naturalWidth>0)).toBeTruthy();
  }
  const mineStore=page.getByRole('button',{name:'View MineStore screenshot',exact:true});await mineStore.click();
  const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();await expect(dialog.locator('img')).toHaveAttribute('src','assets/images/projects/minestore.png');
  await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();await expect(mineStore).toBeFocused();
});
test('Discord-only tracking token is displayed and fits the tracking form',async({page})=>{
  const token=`d1.${'b'.repeat(24)}.${'c'.repeat(250)}.${'d'.repeat(32)}`;
  await page.goto(`/request-received.html#id=KURO-1234567890ABCDEF&token=${token}`);
  await expect(page.locator('#received-token')).toHaveText(token);
  await page.goto('/order-status.html');await expect(page.locator('#trackingToken')).toHaveValue(token);await expect(page.locator('#trackingToken')).toHaveAttribute('maxlength','800');
  await page.route('**/api/manage-order',async route=>{
    const payload=route.request().postDataJSON();expect(payload.messageId).toBe('123456789');
    await route.fulfill({json:{id:'KURO-1234567890ABCDEF',status:'Pending Review',details:{service:'Website'}}});
  });
  await page.goto('/admin.html?id=KURO-1234567890ABCDEF&messageId=123456789');await page.getByLabel('Management key',{exact:true}).fill('private-test-key');await page.getByRole('button',{name:'Authenticate & review'}).click();await expect(page.locator('#admin-actions')).toBeVisible();
});
