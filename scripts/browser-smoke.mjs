// Deterministic browser integration tests. Graphics submissions are suppressed here;
// inspect-browser.mjs separately exercises real WebGL rendering and screenshots.
import { launchBrowser } from './browser-runtime.mjs';
import assert from 'node:assert/strict';
const browser=await launchBrowser();
const page=await browser.newPage({viewport:{width:1280,height:800},hasTouch:true}),errors=[];
page.setDefaultTimeout(90000);
page.on('pageerror',e=>{errors.push(e.message);console.log('ERROR',e.message);});
await page.addInitScript(()=>{
 window.__virtualTime=performance.now();window.__rafQueue=[];window.requestAnimationFrame=cb=>{window.__rafQueue.push(cb);return 1;};window.__nextFrame=t=>{const callbacks=window.__rafQueue.splice(0);callbacks.forEach(cb=>cb(t));};
 for(const type of [WebGLRenderingContext,WebGL2RenderingContext])for(const method of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced','clear'])if(type.prototype[method])type.prototype[method]=function(){};
});
const state=()=>page.evaluate(()=>window.__alpine.state);
const step=async n=>page.evaluate(n=>{window.__virtualTime=Math.max(window.__virtualTime,performance.now());for(let i=0;i<n;i++){window.__virtualTime+=1000/60;window.__nextFrame(window.__virtualTime);}},n);
const click=selector=>page.locator(selector+":visible").first().click({force:true});
try{
 await page.goto('http://localhost:5173');await page.waitForFunction(()=>window.__alpine?.state.screen==='menu',null,{polling:100});await step(2);
 assert.equal((await state()).modelLoaded,true);console.log('PASS original Porsche loads; menu opens');
 await click('[data-action="challenges"]');assert.equal(await page.locator('.challenge-card').count(),4);await click('[data-action="close"]');
 await click('[data-action="settings"]');await click('[data-weather="Overcast"]');assert.equal((await state()).weather,'Overcast');await click('[data-unit="mph"]');await click('[data-quality="Balanced"]');await click('[data-action="close"]');console.log('PASS challenges menu and all settings selectors');
 await click('[data-action="garage"]');await step(2);assert.equal((await state()).screen,'garage');await click('[data-action="garage-angle"]');await click('[data-weather="Clear"]');await click('[data-action="back"]');await step(1);console.log('PASS garage orbit preset and environment');
 await click('[data-action="drive"]');await page.keyboard.down('w');await step(200);await page.keyboard.up('w');let s=await state();console.log('DRIVE STATE',s);assert.ok(s.speed>20);assert.ok(s.gear>1);assert.equal(await page.locator('#speed-unit').textContent(),'MPH');console.log('PASS keyboard acceleration, gears, RPM and live HUD');
 const movingPos=s.position;await page.keyboard.press('Escape');assert.equal((await state()).paused,true);await step(120);assert.deepEqual((await state()).position,movingPos);await click('[data-action="resume"]');console.log('PASS pause freezes physics');
 for(let i=1;i<=4;i++){await page.keyboard.press('c');await step(1);assert.equal((await state()).cameraMode,i%4);}console.log('PASS all four driving cameras');
 await page.keyboard.press('p');assert.equal((await state()).screen,'photo');const photoPos=(await state()).position;await step(120);assert.deepEqual((await state()).position,photoPos);await click('[data-action="grid"]');assert.equal(await page.locator('#photo-grid').getAttribute('class'),'photo-grid show');await page.locator('#photo-fov').evaluate(el=>{el.value='32';el.dispatchEvent(new Event('input',{bubbles:true}));});assert.equal(await page.locator('#fov-value').textContent(),'32°');const downloadPromise=page.waitForEvent('download');await click('[data-action="capture"]');const download=await downloadPromise;assert.ok(download.suggestedFilename().endsWith('.png'));await page.keyboard.press('p');assert.equal((await state()).screen,'drive');console.log('PASS photo freeze, framing grid, FOV and PNG export');
 await page.keyboard.press('r');await page.waitForTimeout(300);await step(1);assert.ok(Math.abs((await state()).speed)<.2);await page.keyboard.down('s');await step(90);await page.keyboard.up('s');assert.ok((await state()).speed<0);assert.equal((await state()).gear,-1);console.log('PASS recovery and reverse');
 await page.keyboard.press('Escape');await click('[data-action="challenges"]');await click('[data-activity="speed"]');assert.ok((await state()).countdown>0);await step(230);assert.equal((await state()).countdown,0);
 // Drive the speed-run through the real keyboard event handlers, using route look-ahead.
 const result=await page.evaluate(async()=>{
  const {Route}=await import('/src/route.ts');const route=new Route();const held=new Set();
  const key=(code,on)=>{if(on&&!held.has(code)){document.dispatchEvent(new KeyboardEvent('keydown',{code,bubbles:true}));held.add(code);}if(!on&&held.has(code)){document.dispatchEvent(new KeyboardEvent('keyup',{code,bubbles:true}));held.delete(code);}};
  for(let i=0;i<1800;i++){
   const s=window.__alpine.state;if(s.modal==='finish')break;
   const n=route.nearest(s.position[0],s.position[2]),target=route.at(n.t+(10+s.speed*.45)/route.length),desired=Math.atan2(target.x-s.position[0],target.z-s.position[2]),delta=Math.atan2(Math.sin(desired-s.heading),Math.cos(desired-s.heading));
   key('KeyW',true);key('KeyA',delta>.015);key('KeyD',delta<-.015);
   window.__virtualTime+=1000/60;window.__nextFrame(window.__virtualTime);
  }
  for(const code of held)document.dispatchEvent(new KeyboardEvent('keyup',{code,bubbles:true}));return window.__alpine.state;
 });
 console.log('SPEED RUN RESULT',JSON.stringify(result));assert.equal(result.modal,'finish');assert.equal(result.checkpoint,3);assert.ok(result.records.completed>=1);assert.ok(result.records.best.speed>=160);console.log('PASS ordered checkpoints, target, finish screen and personal best');
 await click('[data-action="restart"]');assert.equal((await state()).checkpoint,0);assert.equal((await state()).elapsed,0);assert.ok((await state()).countdown>0);console.log('PASS instant challenge restart');
 for(const id of ['time','corner','scenic']){
  await page.keyboard.press('Escape');await click('[data-action="challenges"]');await click(`[data-activity="${id}"]`);await step(230);
  const completed=await page.evaluate(async()=>{
   const {Route}=await import('/src/route.ts');const route=new Route(),held=new Set();
   const key=(code,on)=>{if(on&&!held.has(code)){document.dispatchEvent(new KeyboardEvent('keydown',{code,bubbles:true}));held.add(code);}if(!on&&held.has(code)){document.dispatchEvent(new KeyboardEvent('keyup',{code,bubbles:true}));held.delete(code);}};
   for(let i=0;i<15000;i++){
    const s=window.__alpine.state;if(s.modal==='finish')break;
    const n=route.nearest(s.position[0],s.position[2]),target=route.at(n.t+(8+Math.abs(s.speed)*.35)/route.length),desired=Math.atan2(target.x-s.position[0],target.z-s.position[2]),delta=Math.atan2(Math.sin(desired-s.heading),Math.cos(desired-s.heading));
    key('KeyW',s.speed<20);key('KeyS',s.speed>22);key('KeyA',delta>.013);key('KeyD',delta<-.013);
    window.__virtualTime+=1000/60;window.__nextFrame(window.__virtualTime);
   }
   for(const code of held)document.dispatchEvent(new KeyboardEvent('keyup',{code,bubbles:true}));return window.__alpine.state;
  });
  assert.equal(completed.modal,'finish',`${id} must finish`);assert.ok(completed.records.best[id]!==undefined,`${id} must meet target`);console.log(`PASS ${id} complete playable route, checkpoints and target (${completed.elapsed.toFixed(2)}s)`);
  await click('[data-action="free"]');
 }
 await page.keyboard.press('Escape');await click('[data-action="menu"]');const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('alpine.records.v1')));assert.ok(saved.distance>0&&saved.completed>0);await page.reload();await page.waitForFunction(()=>window.__alpine?.state.screen==='menu',null,{polling:100});assert.equal((await state()).records.completed,saved.completed);assert.equal((await state()).weather,'Clear');console.log('PASS progression and settings survive reload');
 await page.setViewportSize({width:390,height:844});await step(1);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390);assert.ok(await page.locator('.start-drive').isVisible());console.log('PASS narrow-screen layout has no horizontal overflow');
 await click('[data-action="drive"]');const pedal=await page.locator('[data-touch="throttle"]').boundingBox();assert.ok(pedal);await page.mouse.move(pedal.x+pedal.width/2,pedal.y+pedal.height/2);await page.mouse.down();await step(100);await page.mouse.up();assert.ok((await state()).speed>8);console.log('PASS touch/pointer throttle and pointer-capture release');
 await page.keyboard.press('r');await page.waitForTimeout(300);await page.evaluate(()=>{const buttons=Array.from({length:16},()=>({pressed:false,value:0}));buttons[7]={pressed:true,value:.8};window.__testGamepad={connected:true,axes:[.2,0,0,0],buttons};Object.defineProperty(navigator,'getGamepads',{value:()=>[window.__testGamepad],configurable:true});});await step(100);assert.ok((await state()).speed>5);assert.equal(await page.locator('#controller-status').textContent(),'CONTROLLER CONNECTED');await page.evaluate(()=>{window.__testGamepad.buttons[9]={pressed:true,value:1};});await step(1);assert.equal((await state()).paused,true);console.log('PASS simulated standard-gamepad analog input and Start pause');
 assert.deepEqual(errors,[]);console.log('ALL BROWSER INTEGRATION CHECKS PASSED');
}finally{await browser.close();}
