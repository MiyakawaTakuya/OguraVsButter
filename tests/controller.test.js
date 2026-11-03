import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {Game,SIZE,clamp,orientation} from '../engine.js';
function setup(){
 const elements=new Map(),listeners={},peers=[],timeouts=new Map();let now=0,next=0;
 const el=id=>{if(!elements.has(id))elements.set(id,{disabled:id==='calibrate',textContent:'',style:{},click(){if(!this.disabled)return this.onclick?.();}});return elements.get(id);};
 class Peer{constructor(){this.events={};this.c={open:false,events:{},sent:[],on(n,f){this.events[n]=f;},send(d){this.sent.push(d);},close(){this.open=false;this.events.close?.();}};peers.push(this);}on(n,f){this.events[n]=f;}connect(){return this.c;}destroy(){}}
 const context=vm.createContext({Game,SIZE,clamp,orientation,Peer,DeviceOrientationEvent:function(){},URLSearchParams,location:{search:'?join=host&team=0&token=secret'},document:{hidden:false,getElementById:el,addEventListener:(n,f)=>listeners[n]=f},window:{Peer,DeviceOrientationEvent:function(){},addEventListener:(n,f)=>listeners[n]=f},screen:{orientation:{angle:0}},navigator:{},isSecureContext:true,performance:{now:()=>now},setTimeout:(f,ms)=>{timeouts.set(++next,{f,ms});return next;},clearTimeout:id=>timeouts.delete(id),setInterval(){}});
 vm.runInContext(fs.readFileSync(new URL('../app.js',import.meta.url),'utf8').replace(/^import [^\n]*\n/,''),context);
 return {el,peers,timeouts,listeners,open(){const p=peers.at(-1);p.events.open();p.c.open=true;p.c.events.open();return p.c;}};
}
test('接続承認前は水平設定不可、水平設定で通信エラーを上書きしない',async()=>{
 const s=setup();await s.el('sensor').click();s.listeners.deviceorientation({beta:0,gamma:0});
 assert.equal(s.el('calibrate').disabled,true);
 const c=s.open();c.events.error({message:'Negotiation failed'});
 const error=s.el('controllerStatus').textContent;s.el('calibrate').onclick();
 assert.equal(s.el('controllerStatus').textContent,error);assert.match(error,/通信経路/);
});
test('水平設定は本体の受信確認まで待ち、古い接続の切断で新接続を壊さない',async()=>{
 const s=setup(),old=s.open();old.events.error({message:'failed'});
 const retry=[...s.timeouts.values()].find(t=>t.ms===1500);retry.f();const c=s.open();
 c.events.data({type:'accepted'});await s.el('sensor').click();s.listeners.deviceorientation({beta:0,gamma:0});
 assert.equal(s.el('calibrate').disabled,false);s.el('calibrate').click();
 assert.match(s.el('sensorStatus').textContent,/確認中/);assert.equal(c.sent.at(-1).calibration,true);
 c.events.data({type:'ready',ready:true});assert.match(s.el('sensorStatus').textContent,/本体が受信/);
 old.events.close();assert.equal(s.el('calibrate').disabled,false);assert.match(s.el('controllerStatus').textContent,/本体と接続済み/);
});
test('接続失敗の自動再試行は2回で止まる',()=>{
 const s=setup();for(let i=0;i<3;i++){const c=s.open();c.events.error({message:'failed'});if(i<2){const retry=[...s.timeouts.values()].find(t=>t.ms===1500*(i+1));s.timeouts.clear();retry.f();}}
 assert.equal(s.peers.length,3);assert.match(s.el('controllerStatus').textContent,/別のWi-Fi/);
});
