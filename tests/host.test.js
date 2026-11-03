import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {Game,SIZE,clamp,orientation} from '../engine.js';
function setup(){
 const elements=new Map(),listeners={},ctx=new Proxy({},{get:()=>()=>{}}),peers=[],qrURLs=[],timeouts=[];
 class Peer{constructor(){this.events={};peers.push(this);}on(n,f){this.events[n]=f;}destroy(){}}
 const node=()=>({children:[],style:{},append(...children){this.children.push(...children);},replaceChildren(){this.children=[];},setAttribute(){}});
 const el=id=>{if(!elements.has(id))elements.set(id,{value:id==='mode'?'race':id==='duration'?'30':'',checked:false,hidden:false,disabled:false,textContent:'',style:{},getContext:()=>ctx,scrollIntoView(){},click(){if(!this.disabled)this.onclick?.();}});return elements.get(id);};
 let frame,now=0;
 Object.assign(el('links'),node());
 const context=vm.createContext({Game,SIZE,clamp,orientation,Peer,crypto:{randomUUID:()=> 'test-token'},setTimeout:(f,ms)=>{timeouts.push({f,ms});return timeouts.length;},clearTimeout(){},URLSearchParams,URL,location:{search:'',href:'https://example.com/'},document:{getElementById:el,createElement:node,addEventListener:(n,f)=>listeners[n]=f},window:{Peer,qrcode:()=>({addData:url=>qrURLs.push(url),make(){},createSvgTag:()=>'<svg></svg>'}),addEventListener:(n,f)=>listeners[n]=f},navigator:{},performance:{now:()=>now},requestAnimationFrame:f=>frame=f,console});
 vm.runInContext(fs.readFileSync(new URL('../app.js',import.meta.url),'utf8').replace(/^import [^\n]*\n/,''),context);
 const phones=[];
 return {el,listeners,qrURLs,timeouts,incoming(c){peers.at(-1).events.connection(c);},openRoom(){el('room').click();peers.at(-1).events.open('host-id');},phone(team){const c={open:true,events:{},on(n,f){this.events[n]=f;},send(){},close(){this.open=false;this.events.close?.();}};peers.at(-1).events.connection(c);c.events.data({type:'hello',token:'test-token',team});c.input=(ready=true)=>c.events.data({type:'input',x:.5,y:0,ready});c.input();phones.push(c);return c;},advance(seconds,{heartbeat=false}={}){for(let i=0;i<Math.ceil(seconds*60);i++){now+=1000/60;if(heartbeat)phones.filter(c=>c.open).forEach(c=>c.input());frame(now);}}};
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
for(const team of [0,1])test(`${team===0?'バター':'小倉'}だけで開始し、未参加側は0%、参加側の切断で停止`,()=>{
 const s=setup(),e=s.el;s.openRoom();const phone=s.phone(team);e('start').click();s.advance(4,{heartbeat:true});
 assert.equal(e('phase').textContent,'試合中');assert.notEqual(e('score'+team).textContent,'0.0%');assert.equal(e('score'+(1-team)).textContent,'0.0%');
 phone.close();assert.equal(e('phase').textContent,'一時停止');e('pause').click();assert.equal(e('phase').textContent,'一時停止');
 s.phone(team);e('pause').click();s.advance(3.2,{heartbeat:true});assert.equal(e('phase').textContent,'試合中');
});
test('2チーム参加中の片方のセンサー停止では一時停止',()=>{
 const s=setup(),e=s.el;s.openRoom();s.phone(0);const phone=s.phone(1);e('start').click();s.advance(3.2,{heartbeat:true});phone.input(false);s.advance(.02);assert.equal(e('phase').textContent,'一時停止');
});
test('両チームのQRにチーム別リンクを渡して描画する',()=>{
 const s=setup();s.openRoom();assert.equal(s.qrURLs.length,2);
 s.qrURLs.forEach((url,i)=>{const u=new URL(url);assert.equal(u.searchParams.get('team'),String(i));assert.equal(u.searchParams.get('join'),'host-id');assert.equal(u.searchParams.get('token'),'test-token');const article=s.el('links').children[i];assert.equal(article.children[1].innerHTML,'<svg></svg>');assert.equal(article.children[2].href,url);});
});

test('通信確立前は認証タイマーで切断せず、確立後に開始する',()=>{
 const s=setup();s.openRoom();const c={open:false,events:{},on(n,f){this.events[n]=f;},close(){this.closed=true;},send(){}};
 s.incoming(c);assert.equal(s.timeouts.length,0);
 s.advance(12);assert.equal(c.closed,undefined);
 c.open=true;c.events.open();assert.equal(s.timeouts[0].ms,10000);
 s.timeouts[0].f();assert.equal(c.closed,true);
});

test('スマホ操作では本体のフォーカス移動だけで停止せず、3秒の通信断で停止',()=>{
 const s=setup(),e=s.el;s.openRoom();s.phone(0);e('start').click();s.advance(3.2,{heartbeat:true});s.listeners.blur();assert.equal(e('phase').textContent,'試合中');
 s.advance(2);assert.equal(e('phase').textContent,'試合中');s.advance(1.2);assert.equal(e('phase').textContent,'一時停止');
});
