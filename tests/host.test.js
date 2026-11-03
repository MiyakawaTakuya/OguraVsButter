import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {Game,SIZE,clamp,orientation} from '../engine.js';
function setup(){
 const elements=new Map(),listeners={},ctx=new Proxy({},{get:()=>()=>{}});
 const el=id=>{if(!elements.has(id))elements.set(id,{value:id==='mode'?'race':id==='duration'?'30':'',checked:false,hidden:false,disabled:false,textContent:'',style:{},getContext:()=>ctx,scrollIntoView(){},click(){if(!this.disabled)this.onclick?.();}});return elements.get(id);};
 let frame,now=0;
 const context=vm.createContext({Game,SIZE,clamp,orientation,URLSearchParams,URL,location:{search:'',href:'https://example.com/'},document:{getElementById:el,addEventListener:(n,f)=>listeners[n]=f},window:{addEventListener:(n,f)=>listeners[n]=f},navigator:{},performance:{now:()=>now},requestAnimationFrame:f=>frame=f,console});
 vm.runInContext(fs.readFileSync(new URL('../app.js',import.meta.url),'utf8').replace(/^import .*\n/,''),context);
 return {el,listeners,advance(seconds){for(let i=0;i<Math.ceil(seconds*60);i++){now+=1000/60;frame(now);}}};
}
test('机上操作で開始・停止・再開・時間切れ・結果・再試合まで進行する',()=>{
 const s=setup(),e=s.el;e('test').checked=true;e('test').onchange();e('start').click();s.advance(3.1);
 assert.equal(e('phase').textContent,'試合中');
 s.listeners.keydown({key:'d',target:{tagName:'BODY'},preventDefault(){}});s.advance(2);
 assert.notEqual(e('score0').textContent,'0.0%');
 e('pause').click();const remaining=e('time').textContent;s.advance(2);assert.equal(e('time').textContent,remaining);
 e('pause').click();s.advance(3.1);s.advance(31);assert.equal(e('phase').textContent,'終了');assert.equal(e('result').hidden,false);assert.match(e('resultText').textContent,/バター/);
 e('again').click();assert.equal(e('phase').textContent,'準備中');assert.equal(e('score0').textContent,'0.0%');
});
test('未接続では開始せず、机上テストでも画面切替で停止する',()=>{
 const s=setup(),e=s.el;e('start').click();assert.equal(e('phase').textContent,'準備中');assert.match(e('network').textContent,/水平設定/);
 e('test').checked=true;e('test').onchange();e('mode').value='territory';e('mode').onchange();e('start').click();s.advance(3.1);s.listeners.blur();assert.equal(e('phase').textContent,'一時停止');
});
