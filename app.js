import {Game,SIZE,clamp,orientation} from './engine.js?v=6';
const $=id=>document.getElementById(id),names=['バター','小倉'],colors=['#f3c94b','#874354'];
const params=new URLSearchParams(location.search),isController=params.has('join');
let peer,conn,wake;
function newPeer(){if(!window.Peer)throw Error('接続ライブラリを読み込めません。インターネット接続を確認してください。');return new Peer();}
async function keepAwake(){try{wake=await navigator.wakeLock?.request('screen');}catch{}}
if(isController) controller();else host();
function controller(){
 $('host').hidden=true;$('controller').hidden=false;
 const team=Number(params.get('team'));if(![0,1].includes(team)||!params.get('token')){$('controllerStatus').textContent='参加リンクが不正です。PCのリンクを開き直してください。';return;}
 $('teamName').textContent=(team===0?'🧈 ':'🫘 ')+names[team];
 let raw=null,zero=null,lastSensor=0,filtered={x:0,y:0},enabled=false,ready=false,accepted=false,generation=0,retries=0,retryTimer,connectTimer,calibrationAngle=screen.orientation?.angle??window.orientation??0;
 function send(d){if(conn?.open&&accepted)conn.send(d);}
 function setSensorStatus(text){$('sensorStatus').textContent=text;}
 function invalidate(){ready=false;zero=null;$('calibrate').disabled=!accepted||!raw;setSensorStatus('水平設定が必要です。');send({type:'input',x:0,y:0,ready:false});}
 function fail(message,attempt){
  if(attempt!==generation)return;
  // Invalidate callbacks before closing: late events from an old attempt must not touch the new connection.
  generation++;accepted=false;clearTimeout(connectTimer);clearTimeout(retryTimer);invalidate();conn?.close();peer?.destroy();
  $('controllerStatus').textContent=message;
  if(retries<2&&!document.hidden){retries++;$('controllerStatus').textContent+=` 自動再接続 ${retries}/2…`;retryTimer=setTimeout(()=>connect(false),1500*retries);}
  else $('controllerStatus').textContent+=' 本体で部屋を作り直して新しいQRを開いてください。それでも失敗する場合は、別のWi-Fiまたは本体をスマホのテザリングへ接続して確認してください。';
 }
 function connect(manual=true){
  if(manual)retries=0;
  const attempt=++generation;clearTimeout(retryTimer);clearTimeout(connectTimer);accepted=false;invalidate();conn?.close();peer?.destroy();$('controllerStatus').textContent='本体との通信を接続中…（最大35秒）';
  connectTimer=setTimeout(()=>fail('本体への接続がタイムアウトしました。',attempt),35000);
  try{
   const currentPeer=newPeer();peer=currentPeer;
   currentPeer.on('open',()=>{
    if(attempt!==generation)return;
    const currentConn=currentPeer.connect(params.get('join'),{reliable:true});conn=currentConn;
    currentConn.on('open',()=>{if(attempt!==generation)return;$('controllerStatus').textContent='通信経路を確立。本体の応答待ち…';currentConn.send({type:'hello',team,token:params.get('token')});});
    currentConn.on('data',d=>{
     if(attempt!==generation||!d||typeof d!=='object')return;
     if(d.type==='accepted'){accepted=true;clearTimeout(connectTimer);$('controllerStatus').textContent='本体と接続済み。センサー許可 → 水平設定をしてください。';$('calibrate').disabled=!raw;keepAwake();}
     if(d.type==='ready'&&ready&&d.ready)setSensorStatus('水平設定を本体が受信しました。開始できます。');
     if(d.type==='state')$('remotePhase').textContent=d.text;
     if(d.type==='reject'){retries=2;fail(d.text,attempt);}
    });
    currentConn.on('close',()=>fail('本体との通信が切断されました。',attempt));
    currentConn.on('error',e=>fail('本体との通信経路を確立できませんでした：'+e.message,attempt));
   });
   currentPeer.on('error',e=>fail('接続エラー：'+e.type+'。'+(e.message||''),attempt));
  }catch(e){fail(e.message,attempt);}
 }
 $('reconnect').onclick=()=>connect();
 $('sensor').onclick=async()=>{try{if(!isSecureContext)throw Error('HTTPSで開いてください。');if(!window.DeviceOrientationEvent)throw Error('この端末は傾きセンサーに対応していません。');if(typeof DeviceOrientationEvent.requestPermission==='function'&&await DeviceOrientationEvent.requestPermission()!=='granted')throw Error('センサーが許可されませんでした。ブラウザの設定を確認してください。');enabled=true;setSensorStatus('センサーの応答待ち…');keepAwake();setTimeout(()=>{if(!raw)setSensorStatus('センサーの応答がありません。対応スマホのSafari／Chromeで開いてください。');},3000);}catch(e){setSensorStatus(e.message);}};
 window.addEventListener('deviceorientation',e=>{if(!enabled||!Number.isFinite(e.beta)||!Number.isFinite(e.gamma))return;raw={beta:e.beta,gamma:e.gamma};lastSensor=performance.now();$('calibrate').disabled=!accepted;});
 $('calibrate').onclick=()=>{if(!accepted||!conn?.open){setSensorStatus('水平設定の前に本体との接続が必要です。');return;}if(!raw)return;calibrationAngle=screen.orientation?.angle??window.orientation??0;zero={...raw};filtered={x:0,y:0};ready=true;setSensorStatus('水平設定済み。本体への送信を確認中…');send({type:'input',x:0,y:0,ready:true,calibration:true});};
 $('stop').onclick=()=>{send({type:'stop'});invalidate();setSensorStatus('緊急停止しました。安全確認後、水平を再設定してください。');};
 document.addEventListener('visibilitychange',()=>{invalidate();if(!document.hidden)keepAwake();});
 // Sensor coordinates are tied to the physical phone. Freeze the board axes at calibration;
 // a CSS/screen rotation must not erase the calibration or rotate the control axes.
 setInterval(()=>{const fresh=performance.now()-lastSensor<1000;

 let v={x:0,y:0};if(ready&&zero&&raw&&fresh)v=orientation(raw.beta,raw.gamma,calibrationAngle,zero);v.x*=$('invertX').checked?-1:1;v.y*=$('invertY').checked?-1:1;if(!fresh)filtered={x:0,y:0};else{filtered.x+=(v.x-filtered.x)*.3;filtered.y+=(v.y-filtered.y)*.3;}
 $('dot').style.transform=`translate(${filtered.x*60}px,${filtered.y*60}px)`;
 if(raw)$('angles').textContent=ready?(fresh?`左右 ${Math.round(filtered.x*100)} / 前後 ${Math.round(filtered.y*100)}`:'新しいセンサー通知待ち：入力をゼロにしています。少し傾けると操作に戻ります。'):'水平設定が必要です';
 send({type:'input',x:filtered.x,y:filtered.y,ready:ready&&!document.hidden});},50);connect();
}
function host(){
 const canvas=$('board'),ctx=canvas.getContext('2d'),keys=new Set();let game=new Game(),state='idle',remaining=60,acc=0,last=performance.now(),countdown=0,connections=[null,null],roomToken='',test=false,participants=[false,false];
 const settings={friction:2.8,edgeFriction:8};let activeDialog=null;
 const inputs=[{x:0,y:0,ready:false,last:0},{x:0,y:0,ready:false,last:0}];
 function closeDialog(id){const dialog=$(id);if(dialog.open)dialog.close();dialog.hidden=true;if(activeDialog===dialog)activeDialog=null;}
 function openDialog(id){keys.clear();if(activeDialog&&activeDialog.id!==id){if(activeDialog.open)activeDialog.close();activeDialog.hidden=true;}const dialog=$(id);dialog.hidden=false;if(!dialog.open)dialog.showModal();activeDialog=dialog;}
 for(const [id,button] of [['connectDialog','connectClose'],['configDialog','configClose'],['result','resultClose'],['helpDialog','helpClose']]){$(button).onclick=()=>closeDialog(id);$(id).addEventListener('close',()=>{$(id).hidden=true;if(activeDialog===$(id))activeDialog=null;});}
 $('configOpen').onclick=()=>openDialog('configDialog');$('helpOpen').onclick=()=>openDialog('helpDialog');$('resultOpen').onclick=()=>openDialog('result');
 function syncSettings(){
  const f=Number.parseFloat($('friction').value),edge=Number.parseFloat($('edgeFriction').value);
  settings.friction=Number.isFinite(f)?clamp(f,.2,12):2.8;settings.edgeFriction=Number.isFinite(edge)?clamp(edge,0,30):8;
  $('frictionValue').textContent=settings.friction.toFixed(1);$('edgeFrictionValue').textContent=settings.edgeFriction.toFixed(1);
  game.settings={...settings};
 }
 $('friction').oninput=$('edgeFriction').oninput=()=>{if(state==='idle')syncSettings();};
 $('configDefault').onclick=()=>{if(state!=='idle')return;$('friction').value=2.8;$('edgeFriction').value=8;syncSettings();};
 function freshInputs(preview=false){return test?[{x:+keys.has('d')-keys.has('a'),y:+keys.has('s')-keys.has('w')},{x:+keys.has('arrowright')-keys.has('arrowleft'),y:+keys.has('arrowdown')-keys.has('arrowup')}]:inputs.map((input,i)=>({...input,x:performance.now()-input.last<300?input.x:0,y:performance.now()-input.last<300?input.y:0,active:preview?teamReady(i):participants[i]}));}
 const textState=()=>({idle:'準備中',countdown:'まもなくスタート',running:'試合中',paused:'一時停止',finished:'終了'})[state];
 function broadcast(){for(const c of connections)if(c?.open)c.send({type:'state',text:`${textState()} ／ 残り ${Math.ceil(remaining)}秒${state==='paused'?' ／ '+$('network').textContent:''}`});}
 function pause(reason){if(state==='running'||state==='countdown'){state='paused';$('network').textContent=reason;update();broadcast();}}
 function update(){ $('startHelp').textContent=$('network').textContent;$('phase').textContent=state==='countdown'?`スタートまで ${Math.ceil(countdown)}`:textState();$('time').textContent=Math.ceil(remaining);$('pause').disabled=!['running','paused','countdown'].includes(state);$('pause').textContent=state==='paused'?'再開':'一時停止';$('start').disabled=state!=='idle';for(const id of ['mode','duration','test','friction','edgeFriction','configDefault','newRoom'])$(id).disabled=state!=='idle';}
 function reset(){$('network').textContent='準備中：接続・水平設定後に動きを確認できます。練習では塗らず、試合開始時に中央へ戻ります。';participants=[false,false];keys.clear();for(let i=0;i<2;i++)$('score'+i).textContent='0.0%';state='idle';remaining=Number($('duration').value);game=new Game($('mode').value,settings);acc=0;closeDialog('result');$('resultOpen').hidden=true;$('rule').textContent=game.mode==='race'?'別々のトーストで塗布率勝負。端を越えると落下して3秒お休み！':'共通トーストを上塗りして陣取り。端を越えると落下して3秒お休み！';update();broadcast();}
 function teamReady(i){return !!(connections[i]?.open&&inputs[i].ready&&performance.now()-inputs[i].last<3000);}
 function available(){return test||(participants.some(Boolean)&&participants.every((active,i)=>!active||teamReady(i)));}
 $('start').onclick=()=>{test=$('test').checked;participants=inputs.map((_,i)=>teamReady(i));if(!available()){$('network').textContent='どちらか1チームの接続・センサー許可・水平設定が必要です。スマホなしなら「キーボード試遊」を選んでください。';return;}$('network').textContent=test?'机上テストを開始します。':participants.map((active,i)=>active?names[i]+'：参加':names[i]+'：お休み').join(' ／ ');game=new Game($('mode').value,settings);acc=0;state='countdown';countdown=3;keepAwake();update();broadcast();};
 $('pause').onclick=()=>{if(state==='paused'){if(!available()){$('network').textContent='試合に参加しているチームの接続・水平設定を確認してください。';return;}state='countdown';countdown=3;last=performance.now();update();broadcast();}else pause('進行役が停止しました。');};
 $('reset').onclick=reset;$('again').onclick=reset;$('mode').onchange=reset;$('duration').onchange=reset;$('test').onchange=()=>{test=$('test').checked;};
 $('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('host').requestFullscreen();}catch{$('network').textContent='このブラウザでは全画面にできません。';}};
 $('room').onclick=()=>{openDialog('connectDialog');if(!peer||peer.destroyed)createRoom();};
 $('newRoom').onclick=()=>createRoom();
 function createRoom(){if(state!=='idle')return;connections.forEach(c=>c?.close());connections=[null,null];inputs.forEach(input=>{input.ready=false;input.x=0;input.y=0;});peer?.destroy();$('links').replaceChildren();roomToken=crypto.randomUUID();$('network').textContent='接続用リンクを作成中…';
 try{peer=newPeer();peer.on('open',id=>{$('network').textContent='チーム別リンクをスマホで開き、センサー許可 → 水平設定をしてください。';for(let i=0;i<2;i++){const url=new URL(location.href);url.search='';url.hash='';url.searchParams.set('join',id);url.searchParams.set('team',i);url.searchParams.set('token',roomToken);const a=document.createElement('article'),title=document.createElement('b'),link=document.createElement('a'),copy=document.createElement('button');title.textContent=names[i]+'のスマホ';link.href=url.href;link.textContent=url.href;link.target='_blank';link.rel='noopener';copy.textContent='リンクをコピー';copy.onclick=async()=>{try{await navigator.clipboard.writeText(url.href);copy.textContent='コピーしました';}catch{copy.textContent='リンクを長押ししてコピー';}};const qr=document.createElement('div');qr.className='join-qr';qr.setAttribute('role','img');qr.setAttribute('aria-label',names[i]+'の接続QRコード');try{if(typeof window.qrcode!=='function')throw Error('QRコードを読み込めませんでした。上のリンクを使ってください。');const code=window.qrcode(0,'M');code.addData(url.href);code.make();qr.innerHTML=code.createSvgTag({cellSize:4,margin:16,scalable:true});}catch(error){qr.textContent=error.message;}a.append(title,qr,link,copy);$('links').append(a);}});
 peer.on('connection',c=>{let team=null,timeout;c.on('open',()=>{timeout=setTimeout(()=>{if(team===null)c.close();},10000);});c.on('data',d=>{if(!d||typeof d!=='object')return;if(team===null){if(d.type!=='hello'||d.token!==roomToken||![0,1].includes(d.team))return c.close();if(connections[d.team]?.open){c.send({type:'reject',text:'このチームは接続済みです。前のスマホを閉じてから再接続してください。'});setTimeout(()=>c.close(),300);return;}team=d.team;clearTimeout(timeout);connections[team]=c;c.send({type:'accepted'});broadcast();return;}if(d.type==='stop')pause(names[team]+'が緊急停止しました。');if(d.type==='input'&&Number.isFinite(d.x)&&Number.isFinite(d.y)){const changed=inputs[team].ready!==(d.ready===true);inputs[team]={x:clamp(d.x,-1,1),y:clamp(d.y,-1,1),ready:d.ready===true,last:performance.now()};if(changed||d.calibration===true)c.send({type:'ready',ready:inputs[team].ready});}});c.on('close',()=>{clearTimeout(timeout);if(team!==null&&connections[team]===c){connections[team]=null;inputs[team].ready=false;if(!test&&participants[team])pause(names[team]+'の接続が切れました。');}});c.on('error',()=>pause('通信エラー。接続を確認してください。'));});peer.on('error',e=>{$('network').textContent='接続エラー：'+e.type+'。再度「スマホを接続する」を押すか、机上テストを使用してください。';pause('接続仲介サービスとの通信に失敗しました。');});}catch(e){$('network').textContent=e.message;}};
 window.addEventListener('keydown',e=>{if(activeDialog?.open||/INPUT|SELECT|BUTTON/.test(e.target.tagName))return;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();keys.add(e.key.toLowerCase());if(e.key===' '&&!e.repeat)$('pause').click();});window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>{keys.clear();if(test)pause('キーボード試遊の画面から離れたため停止しました。');});document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.clear();pause('画面が非表示になったため停止しました。');}});
 function finish(){
  state='finished';const scores=game.scores(),tie=Math.abs(scores[0]-scores[1])<.05,winner=scores[0]>scores[1]?0:1;
  $('winner').textContent=tie?'引き分け！':names[winner]+'の勝ち！';
  $('resultLine').textContent=tie?'どちらも主役。仲よく、おいしく！':winner===0?'バターが主役！とろける勝利！':'小倉が主役！あんこたっぷりの勝利！';
  $('toastName').textContent=tie?'なかよし小倉バタートースト':winner===0?'バター小倉トースト':'小倉バタートースト';
  $('result').setAttribute('data-winner',tie?'tie':winner===0?'butter':'ogura');
  $('resultText').textContent=`バター ${scores[0].toFixed(1)}% ／ 小倉 ${scores[1].toFixed(1)}%`;
  $('resultOpen').hidden=false;openDialog('result');update();broadcast();
 }

 function drawFall(b,i){
  const ball=game.balls[i];if(!(ball.fallRemaining>0))return;
  const x=game.mode==='race'?b.x+b.w/2:b.x+b.w*(i===0?.25:.75),y=b.y+b.h/2;
  ctx.save();ctx.translate(x,y);ctx.fillStyle='#fffaf2f2';ctx.strokeStyle=colors[i];ctx.lineWidth=5;
  ctx.beginPath();ctx.roundRect(-112,-100,224,200,22);ctx.fill();ctx.stroke();
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=i===0?'#8c5e0d':'#874354';
  ctx.font='bold 18px sans-serif';ctx.fillText(names[i],0,-71);
  ctx.font='900 30px sans-serif';ctx.fillText('落下！！',0,-34);
  ctx.font='900 64px sans-serif';ctx.fillText(Math.ceil(ball.fallRemaining),0,25);
  ctx.font='14px sans-serif';ctx.fillText('復帰まで操作できません',0,76);ctx.restore();
 }
 function draw(){ctx.clearRect(0,0,1200,650);const boards=game.mode==='race'?[{x:70,y:70,w:500,h:500,i:0},{x:630,y:70,w:500,h:500,i:1}]:[{x:350,y:50,w:550,h:550,i:0}];for(const b of boards){ctx.fillStyle='#a55e2e';ctx.beginPath();ctx.roundRect(b.x-20,b.y-20,b.w+40,b.h+40,60);ctx.fill();ctx.fillStyle='#f4d79c';ctx.beginPath();ctx.roundRect(b.x-8,b.y-8,b.w+16,b.h+16,42);ctx.fill();ctx.fillStyle='#f9e6b9';ctx.fillRect(b.x,b.y,b.w,b.h);const map=game.maps[b.i],s=b.w/SIZE;for(let j=0;j<map.length;j++)if(map[j]){ctx.fillStyle=colors[map[j]-1];ctx.fillRect(b.x+j%SIZE*s,b.y+Math.floor(j/SIZE)*s,s+.3,s+.3);}for(let i=0;i<2;i++){if(game.mode==='race'&&i!==b.i)continue;const ball=game.balls[i];if(ball.fallRemaining>0)continue;ctx.save();ctx.translate(b.x+ball.x*s,b.y+ball.y*s);ctx.shadowColor='#40271455';ctx.shadowBlur=12;ctx.fillStyle=colors[i];ctx.strokeStyle=i===0?'#fff6cb':'#e4a9af';ctx.lineWidth=4;ctx.beginPath();ctx.roundRect(-19,-19,38,38,i===0?8:18);ctx.fill();ctx.stroke();ctx.fillStyle=i===0?'#6c4c12':'#fff0df';ctx.font='bold 17px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(i===0?'B':'O',0,1);ctx.restore();}for(let i=0;i<2;i++){if(game.mode==='race'&&i!==b.i)continue;drawFall(b,i);}}
 if(state==='countdown'||state==='paused'){ctx.fillStyle='#38281faa';ctx.fillRect(0,0,1200,650);ctx.fillStyle='#fff9e9';ctx.font='900 70px sans-serif';ctx.textAlign='center';ctx.fillText(state==='countdown'?Math.ceil(countdown):'PAUSE',600,340);}}
 let lastBroadcast=0;function frame(now){const elapsed=(now-last)/1000;last=now;if(elapsed>2)pause('画面の処理が中断されたため停止しました。');if(['running','countdown'].includes(state)&&!available())pause('参加チームの通信が3秒以上途切れたか、画面消灯・切替・緊急停止で水平設定が解除されました。スマホの接続と水平設定を確認して再開してください。');if(state==='countdown'){countdown-=Math.min(elapsed,.1);if(countdown<=0){state='running';broadcast();}}
 if(state==='running'){acc+=Math.min(elapsed,.1);while(acc>=1/60&&state==='running'){const v=freshInputs();game.step(v,1/60);remaining=Math.max(0,remaining-1/60);acc-=1/60;if(remaining<=0)finish();}}
 if(state==='idle'&&!document.hidden){acc+=Math.min(elapsed,.1);while(acc>=1/60){game.step(freshInputs(true),1/60,{paint:false});acc-=1/60;}}
 game.scores().forEach((n,i)=>{$('score'+i).textContent=n.toFixed(1)+'%';$('status'+i).textContent=test?'机上テスト':connections[i]?.open?(inputs[i].ready&&now-inputs[i].last<3000?'接続・水平設定 OK':'水平設定／センサー待ち'):'未接続（片方だけでも開始OK）';});update();draw();if(now-lastBroadcast>500){broadcast();lastBroadcast=now;}requestAnimationFrame(frame);}
 syncSettings();reset();requestAnimationFrame(frame);
}
