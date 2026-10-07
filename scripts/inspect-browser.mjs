// Real WebGL visual review. Freeze between deliberately rendered frames so
// screenshots are deterministic even in a software-rendered CI environment.
import { launchBrowser } from './browser-runtime.mjs';
import fs from 'node:fs';
const browser=await launchBrowser();
const page=await browser.newPage({viewport:{width:1440,height:900}});
page.setDefaultTimeout(120000);
await page.addInitScript(()=>{const raf=window.requestAnimationFrame;let frames=0;window.requestAnimationFrame=cb=>{if(cb.name!=='animate')return raf(cb);window.__pendingFrame=cb;if(window.__manual)return 0;return raf(t=>{if(window.__alpine?.state.screen==='menu'){frames++;if(frames>2){window.__manual=true;return;}}cb(t);});};});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
fs.mkdirSync('.cache/screenshots',{recursive:true});
const frame=()=>page.evaluate(()=>{window.__manual=true;window.__pendingFrame(performance.now());});
const shot=name=>page.screenshot({timeout:120000,path:`.cache/screenshots/${name}.png`});
const click=selector=>page.locator(selector+':visible').first().click({force:true});
try{
 await page.goto('http://localhost:5173');await page.waitForFunction(()=>window.__alpine?.state.screen==='menu',null,{polling:100});await frame();await shot('menu-desktop');console.log('CAPTURED desktop menu');
 await click('[data-action="drive"]');await frame();await shot('drive-final');console.log('CAPTURED driving');
 await page.keyboard.press('c');await frame();await frame();await shot('cockpit');console.log('CAPTURED cockpit');
 await page.keyboard.press('Escape');await click('[data-action="challenges"]');await shot('challenges');console.log('CAPTURED challenges');
 await page.keyboard.press('Escape');await page.keyboard.press('Escape');await click('[data-action="menu"]');
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(150);await frame();await frame();await shot('menu-mobile');console.log('CAPTURED mobile menu');
 console.log('RENDER STATE',await page.evaluate(()=>window.__alpine.state));console.log('ERRORS',errors);if(errors.length)process.exitCode=1;
}finally{await browser.close();}
