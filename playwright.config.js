import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'./tests/browser',
  timeout:30000,
  fullyParallel:false,
  use:{baseURL:'http://localhost:3000',headless:true,channel:process.env.PLAYWRIGHT_CHANNEL || 'chrome'},
  webServer:{command:'npm run dev',url:'http://localhost:3000',reuseExistingServer:true},
  projects:[{name:'desktop',use:{viewport:{width:1440,height:1000}}},{name:'mobile',use:{viewport:{width:390,height:844}}}]
});
