import test from 'node:test';
import assert from 'node:assert/strict';
import { Route,formatTime } from '../src/route.ts';
import { VehiclePhysics,Controls } from '../src/physics.ts';
const route=new Route();
const none:Controls={throttle:0,brake:0,steer:0,handbrake:false};
function run(p:VehiclePhysics,seconds:number,input:Controls){for(let i=0;i<seconds*120;i++)p.update(1/120,input);}
function follow(p:VehiclePhysics,targetSpeed:number,seconds:number){
 for(let i=0;i<seconds*120;i++){
  const n=route.nearest(p.x,p.z),target=route.at(n.t+(7+Math.abs(p.speed)*.35)/route.length),desired=Math.atan2(target.x-p.x,target.z-p.z);
  const delta=Math.atan2(Math.sin(desired-p.heading),Math.cos(desired-p.heading));
  p.update(1/120,{throttle:p.speed<targetSpeed?1:0,brake:p.speed>targetSpeed+2?.25:0,steer:Math.max(-1,Math.min(1,-delta*3.8)),handbrake:false});
 }
}
test('route is a continuous 2–4 km loop with slopes, no pathological seams',()=>{
 assert.ok(route.length>2000&&route.length<4000);assert.ok(route.at(0).distanceTo(route.at(1))<.001);
 const a=route.tangent(.9999),b=route.tangent(.0001);assert.ok(a.dot(b)>.99);
 for(let i=0;i<1000;i++){const p=route.at(i/1000),n=route.nearest(p.x,p.z);assert.ok(n.distance<.1);assert.ok(Math.abs(n.height-p.y)<.1);assert.ok(Math.abs(n.grade)<.35);}
});
test('accelerates progressively, shifts gears, and reaches the speed-run target',()=>{
 const p=new VehiclePhysics(route);p.reset(.005);follow(p,65,11);
 assert.ok(p.topSpeed>160,`top speed ${p.topSpeed}`);assert.ok(p.gear>1);assert.ok(p.rpm>=850&&p.rpm<=7900);assert.ok(p.distance>150);
});
test('braking is substantially stronger than coasting',()=>{
 const a=new VehiclePhysics(route),b=new VehiclePhysics(route);a.speed=b.speed=23;
 run(a,1,{...none,brake:1});run(b,1,none);assert.ok(a.speed<b.speed-10);assert.ok(a.speed>=0);
});
test('brake transitions to controllable reverse at rest',()=>{
 const p=new VehiclePhysics(route);run(p,2,{...none,brake:1});assert.ok(p.speed<0&&p.speed>=-12);assert.equal(p.gear,-1);
});
test('handbrake gives rear slip; releasing it restores grip',()=>{
 const p=new VehiclePhysics(route);p.speed=18;run(p,.3,{...none,steer:.8,handbrake:true});const slide=Math.abs(p.lateral);assert.ok(slide>.2);
 run(p,1,{...none,steer:0});assert.ok(Math.abs(p.lateral)<slide);assert.ok(Number.isFinite(p.heading));
});
test('high-speed wall impacts cannot escape the safe corridor',()=>{
 const p=new VehiclePhysics(route);p.speed=78;run(p,3,{...none,throttle:1,steer:1});assert.ok(route.nearest(p.x,p.z).distance<7.5);assert.ok(Number.isFinite(p.speed));
});
test('reset restores a safe stationary road-aligned pose without deleting records',()=>{
 const p=new VehiclePhysics(route);follow(p,28,8);const distance=p.distance,top=p.topSpeed;p.reset(.43);const n=route.nearest(p.x,p.z);assert.ok(n.distance<.01);assert.equal(p.speed,0);assert.equal(p.lateral,0);assert.equal(p.distance,distance);assert.equal(p.topSpeed,top);assert.equal(p.gear,1);
});
test('a controlled complete lap is numerically stable over thousands of physics steps',()=>{
 const p=new VehiclePhysics(route);let travelled=0,last=p.roadT;
 for(let i=0;i<150;i++){follow(p,18,1);let delta=p.roadT-last;if(delta<-.5)delta+=1;if(delta>.5)delta-=1;travelled+=delta;last=p.roadT;assert.ok(Number.isFinite(p.x+p.y+p.z+p.rpm));assert.ok(route.nearest(p.x,p.z).distance<7.6);}
 assert.ok(travelled>.7,`lap progress ${travelled}`);
});
test('time formatter is stable at boundaries',()=>{assert.equal(formatTime(0),'00:00.00');assert.equal(formatTime(65.25),'01:05.25');assert.equal(formatTime(59.999),'01:00.00');});
