import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,SIZE,orientation} from '../engine.js';
test('水平設定と画面回転・入力制限',()=>{
 assert.deepEqual(orientation(10,5,0,{beta:10,gamma:5}),{x:0,y:0});
 assert.equal(orientation(0,18,0,{beta:0,gamma:0}).x,1);
 assert.equal(orientation(18,0,90,{beta:0,gamma:0}).x,1);
 assert.equal(orientation(0,80,0,{beta:0,gamma:0}).x,1);
});
test('別々のパンの面積を独立して集計する',()=>{
 const g=new Game('race');g.maps[0].fill(1);g.maps[1].fill(2,0,SIZE*SIZE/2);
 assert.deepEqual(g.scores(),[100,50]);
});
test('陣取りは上塗り後の所有者を数え、合計100%を超えない',()=>{
 const g=new Game('territory');g.maps[0].fill(1);g.maps[0].fill(2,0,SIZE*SIZE/4);
 assert.deepEqual(g.scores(),[75,25]);
 g.balls[1]={x:50,y:50,vx:0,vy:0};g.balls[0]={x:10,y:10,vx:0,vy:0};
 g.step([{x:0,y:0},{x:0,y:0}],1/60);assert.equal(g.maps[0][50*SIZE+50],2);
 assert.ok(g.scores().reduce((a,b)=>a+b)<=100);
});
for(const mode of ['race','territory'])for(const [axis,pos,velocity] of [['x',.01,-30],['x',SIZE-.01,30],['y',.01,-30],['y',SIZE-.01,30]])test(`${mode} ${axis}端${pos}で落下し、3秒の操作・塗布禁止後に復帰`,()=>{
 const g=new Game(mode),b=g.balls[0];b[axis]=pos;b[axis==='x'?'vx':'vy']=velocity;
 g.maps[0][0]=1;const inputs=[{x:1,y:1},{x:0,y:0,active:false}];
 g.step(inputs,1/60);assert.equal(b.fallRemaining,3);assert.equal(b.falls,1);assert.equal(b.vx,0);assert.equal(b.vy,0);
 const before=g.scores()[0],fallX=b.x,fallY=b.y;
 for(let n=0;n<179;n++)g.step(inputs,1/60);
 assert.ok(b.fallRemaining>0);assert.equal(b.x,fallX);assert.equal(b.y,fallY);assert.equal(g.scores()[0],before);
 g.step(inputs,1/60);assert.equal(b.fallRemaining,0);assert.equal(b.x,48);assert.equal(b.y,48);assert.equal(b.vx,0);assert.equal(b.vy,0);
 g.step(inputs,1/60);assert.ok(b.x>48);assert.ok(b.y>48);
});
test('未参加側は落下せず、落下中も相手は操作・塗布を続けられる',()=>{
 const g=new Game('territory');g.balls[0].x=SIZE-.01;g.balls[0].vx=30;
 const input=[{x:1,y:0},{x:-1,y:.5}];g.step(input,1/60);assert.equal(g.balls[0].fallRemaining,3);
 const x=g.balls[1].x;for(let i=0;i<60;i++)g.step(input,1/60);assert.ok(g.balls[1].x<x);assert.ok(g.scores()[1]>0);
 const h=new Game();h.balls[1].x=SIZE+1;h.step([{x:0,y:0},{x:1,y:0,active:false}],1/60);assert.equal(h.balls[1].fallRemaining,0);assert.equal(h.scores()[1],0);
});
test('中央へ向かう左右対称の操作で別パンの塗布率が一致する',()=>{
 const g=new Game();for(let n=0;n<120;n++)g.step([{x:.5,y:.2},{x:-.5,y:.2}],1/60);
 assert.equal(g.scores()[0],g.scores()[1]);
});

test('全体摩擦を上げると中央でも減速が強まる',()=>{
 const a=new Game('race',{friction:1,edgeFriction:0}),b=new Game('race',{friction:10,edgeFriction:0});
 a.balls[0].vx=b.balls[0].vx=20;const input=[{x:0,y:0},{x:0,y:0,active:false}];a.step(input,.1);b.step(input,.1);assert.ok(b.balls[0].vx<a.balls[0].vx);
});
test('端の追加摩擦は中央に影響せず、周辺ほど減速を強める',()=>{
 const speed=(x,edge)=>{const g=new Game('race',{friction:2.8,edgeFriction:edge});g.balls[0].x=x;g.balls[0].vx=10;g.step([{x:0,y:0},{x:0,y:0,active:false}],.1);return g.balls[0].vx;};
 assert.equal(speed(48,20),speed(48,0));assert.ok(speed(1,20)<speed(8,20));assert.ok(speed(8,20)<speed(8,0));
});
test('練習は動いても塗布せず、本番用の新規ゲームは全員中央・速度ゼロ',()=>{
 const g=new Game();for(let n=0;n<30;n++)g.step([{x:1,y:0},{x:0,y:0,active:false}],1/60,{paint:false});assert.ok(g.balls[0].x>48);assert.deepEqual(g.scores(),[0,0]);
 for(const b of new Game().balls){assert.equal(b.x,48);assert.equal(b.y,48);assert.equal(b.vx,0);assert.equal(b.vy,0);assert.equal(b.fallRemaining,0);}
});
