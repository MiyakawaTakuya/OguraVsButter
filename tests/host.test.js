import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {Game,SIZE,clamp,orientation} from '../engine.js';
function setup(GameClass=Game){
 const elements=new Map(),listeners={},texts=[],ctx=new Proxy({},{get:(_,key)=>key==='clearRect'?()=>{texts.length=0;}:key==='fillText'?text=>texts.push(String(text)):()=>{}}),peers=[],qrURLs=[],timeouts=[];
 class Peer{constructor(){this.events={};peers.push(this);}on(n,f){this.events[n]=f;}destroy(){}}
 const node=()=>({children:[],style:{},append(...children){this.children.push(...children);},replaceChildren(){this.children=[];},setAttribute(){}});
 const el=id=>{if(!elements.has(id))elements.set(id,{id,open:false,events:{},addEventListener(n,f){this.events[n]=f;},showModal(){this.open=true;},close(){this.open=false;this.events.close?.();},setAttribute(n,v){this[n]=v;},value:id==='mode'?'race':id==='duration'?'30':'',checked:false,hidden:false,disabled:false,textContent:'',style:{},getContext:()=>ctx,scrollIntoView(){},click(){if(!this.disabled)this.onclick?.();}});return elements.get(id);};
 let frame,now=0;
 Object.assign(el('links'),node());
 const context=vm.createContext({Game:GameClass,SIZE,clamp,orientation,Peer,crypto:{randomUUID:()=> 'test-token'},setTimeout:(f,ms)=>{timeouts.push({f,ms});return timeouts.length;},clearTimeout(){},URLSearchParams,URL,location:{search:'',href:'https://example.com/'},document:{getElementById:el,createElement:node,addEventListener:(n,f)=>listeners[n]=f},window:{Peer,qrcode:()=>({addData:url=>qrURLs.push(url),make(){},createSvgTag:()=>'<svg></svg>'}),addEventListener:(n,f)=>listeners[n]=f},navigator:{},performance:{now:()=>now},requestAnimationFrame:f=>frame=f,console});
 vm.runInContext(fs.readFileSync(new URL('../app.js',import.meta.url),'utf8').replace(/^import [^\n]*\n/,''),context);
 const phones=[];
 return {el,listeners,qrURLs,timeouts,texts,incoming(c){peers.at(-1).events.connection(c);},openRoom(){el('room').click();peers.at(-1).events.open('host-id');el('connectClose').click();},phone(team){const c={open:true,events:{},on(n,f){this.events[n]=f;},send(){},close(){this.open=false;this.events.close?.();}};peers.at(-1).events.connection(c);c.events.data({type:'hello',token:'test-token',team});c.input=(ready=true)=>c.events.data({type:'input',x:.5,y:0,ready});c.input();phones.push(c);return c;},advance(seconds,{heartbeat=false}={}){for(let i=0;i<Math.ceil(seconds*60);i++){now+=1000/60;if(heartbeat)phones.filter(c=>c.open).forEach(c=>c.input());frame(now);}}};
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

for(const mode of ['race','territory'])test(`${mode} トースト上に落下と3・2・1を表示し、全体の試合は続行`,()=>{
 class FallingGame extends Game{constructor(m){super(m);this.balls[0].x=SIZE-.01;this.balls[0].vx=30;}}
 const s=setup(FallingGame),e=s.el;e('mode').value=mode;e('mode').onchange();e('test').checked=true;e('test').onchange();e('start').click();
 s.advance(3.2);assert.equal(e('phase').textContent,'試合中');assert.ok(s.texts.includes('落下！！'));assert.ok(s.texts.includes('3'));
 s.advance(1);assert.ok(s.texts.includes('2'));s.advance(1);assert.ok(s.texts.includes('1'));
 e('pause').click();s.advance(2);assert.ok(s.texts.includes('1'));assert.equal(e('phase').textContent,'一時停止');
 e('pause').click();s.advance(4.2);assert.ok(!s.texts.includes('落下！！'));assert.equal(e('phase').textContent,'試合中');
});

test('QRを閉じて開き直しても部屋と接続リンクを維持する',()=>{
 const s=setup(),e=s.el;s.openRoom();const urls=[...s.qrURLs];e('room').click();assert.equal(e('connectDialog').open,true);assert.deepEqual(s.qrURLs,urls);e('connectClose').click();assert.equal(e('connectDialog').hidden,true);
});
test('接続済みスマホは開始前に塗らずに操作でき、開始時に中央へリセット',()=>{
 const games=[];class TrackedGame extends Game{constructor(...args){super(...args);games.push(this);}}
 const s=setup(TrackedGame),e=s.el;s.openRoom();s.phone(0);s.advance(1,{heartbeat:true});const practice=games.at(-1);assert.ok(practice.balls[0].x>48);assert.equal(e('score0').textContent,'0.0%');assert.equal(practice.balls[1].x,48);
 e('start').click();const match=games.at(-1);assert.notEqual(match,practice);for(const b of match.balls){assert.equal(b.x,48);assert.equal(b.y,48);assert.equal(b.vx,0);assert.equal(b.fallRemaining,0);}assert.deepEqual(match.scores(),[0,0]);
});
test('コンフィグは準備中に適用し、開始後は同じ値を保持して変更を無効化',()=>{
 const games=[];class TrackedGame extends Game{constructor(...args){super(...args);games.push(this);}}
 const s=setup(TrackedGame),e=s.el;e('configOpen').click();assert.equal(e('configDialog').open,true);e('friction').value='6';e('edgeFriction').value='20';e('friction').oninput();assert.equal(games.at(-1).settings.friction,6);assert.equal(games.at(-1).settings.edgeFriction,20);assert.equal(e('frictionValue').textContent,'6.0');e('configClose').click();e('test').checked=true;e('test').onchange();e('start').click();assert.equal(e('friction').disabled,true);assert.equal(games.at(-1).settings.friction,6);e('friction').value='2';e('friction').oninput();assert.equal(games.at(-1).settings.friction,6);
});
for(const [scores,name] of [[[80,20],'バター小倉トースト'],[[20,80],'小倉バタートースト'],[[50,50],'なかよし小倉バタートースト']])test(`結果ポップアップの名称 ${name} と閉じる・再表示`,()=>{
 class FixedScoreGame extends Game{scores(){return scores;}}
 const s=setup(FixedScoreGame),e=s.el;e('test').checked=true;e('test').onchange();e('start').click();s.advance(34);assert.equal(e('result').open,true);assert.equal(e('toastName').textContent,name);e('resultClose').click();assert.equal(e('result').hidden,true);assert.equal(e('phase').textContent,'終了');e('resultOpen').click();assert.equal(e('result').open,true);e('again').click();assert.equal(e('result').hidden,true);assert.equal(e('phase').textContent,'準備中');
});
