import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
const localChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export default defineConfig({
  testDir:'./tests/browser',workers:1,fullyParallel:false,timeout:60000,retries:0,
  use:{baseURL:process.env.PLAYWRIGHT_BASE_URL??'http://127.0.0.1:3000',viewport:{width:1440,height:1000},trace:'retain-on-failure',screenshot:'only-on-failure',launchOptions:{executablePath:process.env.PLAYWRIGHT_CHROMIUM_PATH ?? (existsSync(localChrome) ? localChrome : undefined),args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']}},
  reporter:[['list'],['html',{open:'never'}]],
});
