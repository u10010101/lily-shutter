/* 百合快门 V2.23：夜庭流霜循环战斗音乐与音效响度调整。 */
(()=>{'use strict';
const $=id=>document.getElementById(id), cvs=$('arena'),ctx=cvs.getContext('2d',{alpha:false});
if(!ctx){$('error').hidden=false;$('error').textContent='浏览器未启用 Canvas，无法运行游戏';return;}
const NAMES=["bai_li_main_v11","bai_li_dash_v9","bai_li_overload_v11","fox_basic","fox_basic2","fox_runner","fox_caster","fox_brute","fox_boss","fox_companion","fox_orb","rabbit_basic","rabbit_basic2","rabbit_runner","rabbit_caster","rabbit_brute","rabbit_boss"];
const ASSET_PATHS=window.__ASSETS;
const sprites={};let imagesLoaded=0;
const storyVideoLayer=$('story-video-layer'),storyVideo=$('story-video'),storyVideoSkip=$('story-video-skip');
let storyVideoWatchdog=null;
let activeStoryVideo=false,storyVideoDone=null,storyVideoToken=0,storyVideoKind=null,transition=null,chapterContinueLocked=false;
for(const name of NAMES){const im=new Image(); im.src=ASSET_PATHS[name];im.onload=()=>imagesLoaded++;im.onerror=()=>{};sprites[name]=im;}
const cap=(v,a,b)=>Math.max(a,Math.min(b,v)),rand=(a,b)=>a+Math.random()*(b-a),len=(x,y)=>Math.hypot(x,y),hyp=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const upgrades=[
 {id:'multi',icon:'❖',name:'双重曝光',desc:'每次射击增加一颗子弹，最多 5 枚',weight:10},
 {id:'rapid',icon:'⚡',name:'高速快门',desc:'射速提高 22%，连续拍个不停',weight:10},
 {id:'power',icon:'✹',name:'大光圈',desc:'每颗子弹的伤害提高 7 点',weight:10},
 {id:'crit',icon:'✧',name:'焦点锁定',desc:'暴击率增加 14%，暴击伤害更高',weight:9},
 {id:'pierce',icon:'➳',name:'穿透镜头',desc:'每颗子弹额外穿透 1 个敌人',weight:8},
 {id:'chain',icon:'⌁',name:'闪光连锁',desc:'命中时电弧弹射附近怪物',weight:7},
 {id:'blast',icon:'✺',name:'冲印爆破',desc:'命中时有概率引发小范围爆炸',weight:7},
 {id:'slow',icon:'❄',name:'冰晶滤镜',desc:'子弹让敌人减速，方便走位',weight:7},
 {id:'heart',icon:'♥',name:'旅行急救包',desc:'生命上限 +20，恢复 55 点生命',weight:7},
 {id:'armor',icon:'⬡',name:'轻便护盾',desc:'受到的伤害减少 2 点',weight:7},
 {id:'regen',icon:'☘',name:'甜点补给',desc:'持续缓慢回复生命，最多叠加 2 次',weight:5},
 {id:'speed',icon:'➠',name:'轻盈旅鞋',desc:'移动速度提高 16%',weight:6},
 {id:'bomb',icon:'❀',name:'花束空投',desc:'补充 1 次百合定格',weight:6},
];
const TYPES={
 basic:{hp:29,spd:72,r:17,damage:9,score:110,sprite:'fox_basic',size:[50,60]},
 basic2:{hp:33,spd:85,r:17,damage:9,score:110,sprite:'fox_basic2',size:[49,57]},
 runner:{hp:23,spd:147,r:16,damage:10,score:150,sprite:'fox_runner',size:[72,44]},
 caster:{hp:77,spd:53,r:23,damage:10,score:220,sprite:'fox_caster',size:[73,85]},
 brute:{hp:165,spd:40,r:28,damage:14,score:310,sprite:'fox_brute',size:[90,78]},
 boss:{hp:1080,spd:148,r:46,damage:18,score:4000,sprite:'fox_boss',size:[174,214]}
};
// Chapter 2 uses its own local wave index, while displaying wave 9–16.
function localWave(){return s?((s.wave-1)%8)+1:1;}
function isChapter2(){return !!(s&&s.chapter===2);}
function isFinalWave(){return localWave()===8;}
function foxPosition(){const p=s.p, side=p.x<112?1:-1;return{x:cap(p.x+side*73,35,W-35),y:cap(p.y-27+Math.sin(fxTime*2.6)*3,70,H-100)};}

// Chapter-two warnings and encounter pacing are isolated from the original eight waves.
let ringWarnings=[],splitWarnings=[],queuedFirstSpells=[],c2RingCooldown=0,c2FirstSpellCooldown=0,foxGuard=null,bossOpening=null,foxAssistFx=[];
const OVERLOAD_PASSIVE_REGEN_PER_SECOND=5; // %/s，第一、二章的实际战斗都有效
// Rabbit king cinematic: actual three impacts are mandatory, with a visible sacrifice or defeat finale.
const FOX_GUARD_DURATION=2;
const RABBIT_OPENER_HIT_DAMAGE=1000; // 每束兔王开场冰霜激光固定伤害；正常可获取生命值下一击必杀
const RABBIT_OPENER={land:.70,impacts:[1.24,1.94,2.64],vanishEnd:3.24,healStart:3.22,healEnd:3.70,end:4.05};
const C2_BALANCE={
 chargeWarning:.68,chargeSpeed:575,chargeDuration:.69,chargeRecover:.43,
 bossWarning:.94,bossSpeed:525,bossDuration:.78,bossRecover:.64,
 ringWarning:.68,splitWarning:.60,ringRadius:108,ringSpeed:67,ringCooldown:5.2,bossRingCooldown:4.16,
 splitDelay:1.00,hostileCap:135,foxAssistCooldown:3.1,enemyMoveScale:.8
};
const terrain=[];let s=null, W=390,H=844,DPR=1,screenScale=1,mode='menu',last=0,frame=0,noticeTTL=0,fxTime=0,shake=0,muted=false,introTimer=0,bossIntroTimer=0,waveClearTimer=0,waveClearInfo=null,bossDefeatTimer=0,phaseFlash=0;
let enemies=[],shots=[],hostile=[],particles=[],rings=[],texts=[],hazards=[],spawnLeft=0,spawnCd=0,bossCreated=false,selectedUpgrades=[],wavesTarget=0;
const touch={id:null,originX:0,originY:0,vx:0,vy:0};const soundCtx={context:null};
const MUSIC_VOLUME=.10,SFX_VOLUME_MULTIPLIER=2.6;
let musicEnabled=true,musicBuffer=null,musicGain=null,musicSource=null,musicLoading=false,musicError=false;
// Mobile: pointer-owned virtual stick. Desktop: keyboard directions. Each is independent of skill input.
const keysDown=new Set(), movementKeys=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ArrowDown','ArrowRight']);
let recentDirection={vx:0,vy:-1,at:-Infinity};
function movement(){
 let x=Number(keysDown.has('KeyD')||keysDown.has('ArrowRight'))-Number(keysDown.has('KeyA')||keysDown.has('ArrowLeft'));
 let y=Number(keysDown.has('KeyS')||keysDown.has('ArrowDown'))-Number(keysDown.has('KeyW')||keysDown.has('ArrowUp'));
 const mag=Math.hypot(x,y);
 return mag>0?{vx:x/mag,vy:y/mag}:{vx:touch.vx,vy:touch.vy};
}
function rememberDirection(v){if(Math.hypot(v.vx,v.vy)>.15){recentDirection={vx:v.vx,vy:v.vy,at:performance.now()};}return v;}

const ui=()=>{if(!s)return;
 $('hp-label').textContent=Math.ceil(s.p.hp)+' / '+s.p.max;
 $('hp-fill').style.width=(s.p.hp/s.p.max*100)+'%';$('boost-fill').style.width=s.p.charge+'%';$('charge-value').textContent=Math.floor(s.p.charge+1e-7)+'%';
 $('wave-label').textContent='WAVE '+String(s.wave).padStart(2,'0')+' / 16';$('wave-kills').textContent='击败 '+(s.kills+(s.chapter1Record?.kills||0)); $('score-label').textContent='得分 '+(s.score+(s.chapter1Record?.score||0)).toLocaleString('zh-CN');
 $('wave-progress-fill').style.width=(isFinalWave()?100:100*(wavesTarget-spawnLeft)/Math.max(1,wavesTarget)).toFixed(0)+'%';const fb=enemies.find(e=>e.type==='boss'&&e.finalBoss);$('boss-hud').hidden=!(isFinalWave()&&fb&&mode==='play');document.querySelector('.wave-progress').style.opacity=(isFinalWave()&&fb&&mode==='play')?'0':'1';if(fb){$('boss-health').style.width=(Math.max(0,fb.hp/fb.max)*100)+'%';$('boss-phase').textContent=isChapter2()?(fb.hp<fb.max*.55?'雪影兔王 · 月影形态':'雪影兔王 · 冰霜形态'):(fb.hp<fb.max*.55?'九尾妖王 · 业火形态':'九尾妖王 · 苏醒');}
 $('dash').disabled=mode!=='play'||s.p.dashCD>0;$('bomb').disabled=mode!=='play'||s.p.bombs<=0;$('burst').disabled=mode!=='play'||s.p.charge<100;
 $('bomb-count').textContent='定格×'+s.p.bombs; $('dash-cool').style.transform=`scaleY(${cap(s.p.dashCD/4.0,0,1)})`;
 $('burst-cool').style.transform=`scaleY(${s.p.charge<100?1-s.p.charge/100:0})`;
 $('dev-wave9').hidden=true;
 $('fox-status').hidden=true;
};
function note(msg,t=1.55){$('banner').textContent=msg;noticeTTL=t;$('banner').style.opacity='1'}
function show(content){content=content.replace(/src="assets\/([^"]+\.webp)"/g,(all,path)=>'src="'+((window.__ASSETS&&window.__ASSETS[path.slice(0,-5)])||('assets/'+path))+'"');$('modal').classList.toggle('end-modal',content.includes('data-ending'));$('shade').classList.toggle('end-shade',content.includes('data-ending'));$('modal').innerHTML=content;$('shade').classList.remove('hidden')}
function hide(){ $('shade').classList.add('hidden');$('shade').classList.remove('end-shade');$('modal').classList.remove('end-modal'); }
function finishStoryVideo(token=storyVideoToken){if(!activeStoryVideo||token!==storyVideoToken)return false;clearTimeout(storyVideoWatchdog);storyVideoWatchdog=null;const done=storyVideoDone;storyVideoDone=null;activeStoryVideo=false;storyVideoKind=null;if(storyVideo){try{storyVideo.pause&&storyVideo.pause()}catch(e){}storyVideo.onended=null;storyVideo.onerror=null;storyVideo.onplaying=null;storyVideo.onwaiting=null;}if(storyVideoLayer){storyVideoLayer.hidden=true;storyVideoLayer.classList.remove('visible');}$('app').classList.remove('video-cinematic');if(done)done();return true;}
function playStoryVideo(key,onDone){if(activeStoryVideo)return false;const src=ASSET_PATHS[key];if(!src||!storyVideo||typeof storyVideo.play!=='function'){if(onDone)onDone();return false;}const token=++storyVideoToken;storyVideoDone=onDone||null;storyVideoKind=key;activeStoryVideo=true;mode='storyVideo';hide();$('app').classList.add('video-cinematic');storyVideoLayer.hidden=false;try{storyVideo.currentTime=0;}catch(e){}storyVideo.muted=true;storyVideo.defaultMuted=true;storyVideo.playsInline=true;storyVideo.setAttribute?.('muted','');storyVideo.setAttribute?.('playsinline','');storyVideo.src=src;storyVideo.onended=()=>finishStoryVideo(token);storyVideo.onerror=()=>finishStoryVideo(token);storyVideo.onplaying=()=>{clearTimeout(storyVideoWatchdog);storyVideoWatchdog=null;};storyVideo.onwaiting=()=>{clearTimeout(storyVideoWatchdog);storyVideoWatchdog=setTimeout(()=>finishStoryVideo(token),4000);};storyVideoWatchdog=setTimeout(()=>finishStoryVideo(token),4000);try{const maybe=storyVideo.play();if(maybe&&typeof maybe.catch==='function')maybe.catch(()=>finishStoryVideo(token));}catch(e){finishStoryVideo(token);}return true;}
function skipStoryVideo(){if(activeStoryVideo){finishStoryVideo();return true;}return false;}
function resetInput(){touch.id=null;touch.vx=touch.vy=0;$('joystick').style.display='none'}
function loadMusic(){
 const a=soundCtx.context,data=window.__BATTLE_MUSIC_BASE64;
 if(!a||!data||musicLoading||musicBuffer||typeof a.decodeAudioData!=='function')return;
 musicLoading=true;
 try{
  const raw=atob(data),bytes=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
  Promise.resolve(a.decodeAudioData(bytes.buffer)).then(buffer=>{
   musicBuffer=buffer;window.__BATTLE_MUSIC_BASE64=null;musicLoading=false;
  }).catch(()=>{musicError=true;musicLoading=false;});
 }catch(e){musicError=true;musicLoading=false;}
}
function safeAudio(){try{if(!soundCtx.context) soundCtx.context=new(window.AudioContext||window.webkitAudioContext)();if(soundCtx.context.state==='suspended')soundCtx.context.resume().catch(()=>{});loadMusic();}catch(e){}}
function stopMusic(){if(musicGain)musicGain.gain.value=0;if(musicSource){try{musicSource.stop()}catch(e){}musicSource.disconnect();musicSource=null;}}
function updateMusic(dt){
 const a=soundCtx.context;
 if(!a||!musicBuffer)return;
 if(mode==='play'&&musicEnabled&&!musicSource){
  if(!musicGain){musicGain=a.createGain();musicGain.gain.value=0;musicGain.connect(a.destination);}
  musicSource=a.createBufferSource();musicSource.buffer=musicBuffer;musicSource.loop=true;
  musicSource.loopStart=0;musicSource.loopEnd=Math.min(64,musicBuffer.duration);
  musicSource.connect(musicGain);musicSource.start();
 }
 if(!musicGain)return;
 const target=mode==='play'&&musicEnabled&&!document.hidden?MUSIC_VOLUME:0;
 musicGain.gain.value+=(target-musicGain.gain.value)*Math.min(1,dt*6);
 if(mode==='menu'&&musicGain.gain.value<.001)stopMusic();
}
let lastSound=0;function beep(freq=480,dur=.045,type='sine',vol=.025){if(muted)return;try{const a=soundCtx.context;if(!a)return;if(a.currentTime-lastSound<.015)return;lastSound=a.currentTime;const o=a.createOscillator(),g=a.createGain();o.type=type;o.frequency.setValueAtTime(freq,a.currentTime);o.frequency.exponentialRampToValueAtTime(Math.max(90,freq*.72),a.currentTime+dur);g.gain.setValueAtTime(vol*SFX_VOLUME_MULTIPLIER,a.currentTime);g.gain.exponentialRampToValueAtTime(.001,a.currentTime+dur);o.connect(g);g.connect(a.destination);o.start();o.stop(a.currentTime+dur)}catch(e){}}
function vignette(){return '<div class="eyebrow">LILY SHUTTER · 妖狐花庭</div><div class="menu-poster"><img src="assets/menu_poster.webp" alt="花庭中的白璃"></div><h1>百合快门</h1><p>百合花庭，静候一束光。</p><button class="primary-btn" id="start">✦ 开始突围</button><p class="muted">手机竖屏 · 自动射击 · 两章共16关</p>'}
function menu(){if(activeStoryVideo){storyVideoDone=null;finishStoryVideo();}transition=null;mode='menu';stopMusic();$('dev-wave9').hidden=true;$('fox-status').hidden=true;show(vignette());}
function startTransition(kind,onFinish){transition={kind,t:0,duration:kind==='opening'?.88:kind==='victory'?.46:.75,done:false,onFinish};mode='transition';$('app').classList.add('transition-cinematic');$('app').style.setProperty?.('--scene-ui-opacity',kind==='victory'?1:0);hide();}
function finishTransition(){if(!transition||transition.done)return;const done=transition.onFinish;transition.done=true;transition=null;$('app').classList.remove('transition-cinematic');if(done)done();}
function startRun(){if(mode!=='menu'&&mode!=='lose'&&mode!=='win')return;safeAudio();chapterContinueLocked=false;playStoryVideo('ch1_opening_video',()=>{begin();startTransition('opening',()=>{mode='play';ui();});});}
function startIntro(){safeAudio();introTimer=0;fxTime=0;shake=0;mode='intro';resetInput();hide();$('app').classList.add('intro-cinematic');}
function finishIntro(){$('app').classList.remove('intro-cinematic');begin();}
function startBossIntro(){bossIntroTimer=0;mode='bossIntro';resetInput();hide();
 if(isChapter2()){
  const hp=Math.max(1,Math.ceil(s.p.hp));
  // Lock the narrative outcome at entry, independent of HP or the player's previous invulnerability.
  bossOpening={entryHP:hp,damage:RABBIT_OPENER_HIT_DAMAGE,hits:0,pulse:0,
   guarded:!!s.fox?.alive,foxVanish:false,healStarted:false,healFrom:hp,
   healTo:Math.max(hp,Math.ceil(s.p.max*.70)),fallen:false};
  noticeTTL=0;$('banner').style.opacity='0';
 }
}
function finishBossIntro(){
 if(isChapter2()){
  if(!bossOpening||bossOpening.hits!==3||bossIntroTimer<RABBIT_OPENER.end)return;
  if(!bossOpening.guarded){bossOpening=null;end(false);return;}
  s.p.hp=Math.max(s.p.hp,bossOpening.healTo);s.p.invuln=Math.max(s.p.invuln,.35);
  bossOpening=null;foxGuard=null;mode='play';ui();return;
 }
 mode='play';note('最终决战 · 九尾妖王',1.9);ui();}
function skipCinema(){if(activeStoryVideo){skipStoryVideo();return;}if(mode==='intro'){finishIntro()}else if(mode==='bossIntro'&&!isChapter2()){finishBossIntro()}}
function begin(chapter=1,previousChapter=null,chapter2Only=false){safeAudio();recentDirection={vx:0,vy:-1,at:-Infinity};keysDown.clear();mode='play';last=0;frame=0;fxTime=0;noticeTTL=0;shake=0;
 s={chapter,chapter2Only,wave:chapter===2?9:1,c2Events:{charges:0,chargeDashes:0,rings:0,splits:0,bossCharges:0},fox:chapter===2?{alive:true,cooldown:0,casts:0,saves:0}:null,waveStartKills:0,waveStartScore:0,score:0,kills:0,combo:0,bestCombo:0,comboTTL:0,clock:0,shotsFired:0,hitCount:0,damageTaken:0,dashUsed:0,bombUsed:0,burstUsed:0,bossDamage:0,upgrades:[],p:{x:195,y:H*.78,hp:120,max:120,speed:248,dmg:20,rate:.26,fire:.12,barrels:chapter===2?2:1,crit:.09,pierce:0,chain:false,blast:false,slow:false,armor:0,regen:0,bombs:1,charge:0,superTTL:0,superGlow:0,dashCD:0,dashTTL:0,dashVX:0,dashVY:0,invuln:0,hitTTL:0,recoil:0,anim:0,angle:-Math.PI/2,facing:1,lastShotOrigin:null}};
 s.chapter1Record=chapter===2?previousChapter:null;
 enemies=[];shots=[];hostile=[];ringWarnings=[];splitWarnings=[];queuedFirstSpells=[];c2RingCooldown=0;c2FirstSpellCooldown=0;foxGuard=null;bossOpening=null;foxAssistFx=[];particles=[];rings=[];texts=[];hazards=[];resetInput();beginWave();hide();note(chapter===2?'第二章 · 第 9 波 · 冲锋兔来袭！':'第 1 波 · 花庭初探！',2);ui();}
function runRecord(){return {score:s.score,kills:s.kills,clock:s.clock,damageTaken:s.damageTaken,shotsFired:s.shotsFired,hitCount:s.hitCount,dashUsed:s.dashUsed,bombUsed:s.bombUsed,burstUsed:s.burstUsed,bestCombo:s.bestCombo,upgrades:[...s.upgrades]};}
function totalRecord(){const first=s.chapter1Record, now=runRecord();if(!first)return now;for(const key of ['score','kills','clock','damageTaken','shotsFired','hitCount','dashUsed','bombUsed','burstUsed'])now[key]+=first[key];now.bestCombo=Math.max(now.bestCombo,first.bestCombo);now.upgrades=[...first.upgrades,...now.upgrades];return now;}
function beginChapter2(previousChapter=null,chapter2Only=false){begin(2,chapter2Only?null:previousChapter,chapter2Only);return true;}
function continueAdventure(){if(mode!=='chapterVictory'||chapterContinueLocked)return false;safeAudio();chapterContinueLocked=true;const record=runRecord();startTransition('chapter',()=>{beginChapter2(record);startTransition('reveal',()=>{mode='play';ui();});});return true;}
function retryChapter2(){if(mode!=='lose'||!isChapter2())return false;beginChapter2(null,true);return true;}
function restartRun(){mode='menu';startRun();return true;}
// V10 waves: weighted existing enemy types and spawn cadence; no changes to health, damage or boss logic.
const WAVE_RHYTHM={
 1:{weights:{basic:64,basic2:36},delay:[.30,.38]},
 2:{weights:{basic:50,basic2:28,runner:22},delay:[.27,.34]},
 3:{weights:{basic:26,basic2:19,runner:43,caster:12},delay:[.22,.28]},
 4:{weights:{basic:30,basic2:21,runner:15,caster:24,brute:10},delay:[.24,.31]},
 5:{weights:{basic:35,basic2:27,runner:18,caster:13,brute:7},delay:[.145,.20],lullEvery:12,lull:.48},
 6:{weights:{basic:28,basic2:23,runner:13,caster:20,brute:16},delay:[.24,.32]},
 7:{weights:{basic:30,basic2:23,runner:19,caster:16,brute:12},delay:[.14,.19],lullEvery:14,lull:.44}
};
// 9: charge, 10: enclosing ring, 11: split shot. Waves 12–16 mix all three.
const WAVE_RHYTHM_C2={
 1:{weights:{basic:45,basic2:29,runner:26},delay:[.28,.36],lullEvery:10,lull:.44},
 2:{weights:{basic:42,basic2:28,caster:30},delay:[.27,.35],lullEvery:11,lull:.45},
 3:{weights:{basic:37,basic2:30,caster:33},delay:[.26,.34],lullEvery:11,lull:.46},
 4:{weights:{basic:25,basic2:22,runner:23,caster:23,brute:7},delay:[.25,.33],lullEvery:12,lull:.48},
 5:{weights:{basic:26,basic2:23,runner:23,caster:21,brute:7},delay:[.22,.29],lullEvery:12,lull:.52},
 6:{weights:{basic:23,basic2:20,runner:26,caster:22,brute:9},delay:[.21,.29],lullEvery:13,lull:.53},
 7:{weights:{basic:22,basic2:19,runner:27,caster:23,brute:9},delay:[.20,.27],lullEvery:13,lull:.55}
};
function rhythm(){return isChapter2()?WAVE_RHYTHM_C2[localWave()]:WAVE_RHYTHM[s.wave];}
function waveEnemyKind(){const weights=rhythm()?.weights;if(!weights)return 'basic';let r=Math.random()*Object.values(weights).reduce((a,b)=>a+b,0);for(const [kind,weight] of Object.entries(weights)){r-=weight;if(r<0)return kind;}return 'basic2';}
function waveSpawnDelay(){const rule=rhythm();if(!rule)return rand(.20,.29);const spawned=wavesTarget-spawnLeft;return rule.lullEvery&&spawned>0&&spawned%rule.lullEvery===0?rule.lull:rand(...rule.delay);}
function beginWave(){const p=s.p,stage=localWave();s.waveStartKills=s.kills;s.waveStartScore=s.score;spawnLeft=stage===8?0:(isChapter2()?[0,25,32,39,46,51,58,64][stage]:16+stage*6);wavesTarget=Math.max(1,spawnLeft);spawnCd=.4;bossCreated=false;if(isChapter2()){ringWarnings=[];splitWarnings=[];queuedFirstSpells=[];c2RingCooldown=0;c2FirstSpellCooldown=0;}if(stage>1)p.dmg+=1.2;if(!(isChapter2()&&stage===8))p.hp=Math.min(p.max,p.hp+14);if(stage===4||stage===8)p.bombs=Math.min(3,p.bombs+1);if(stage===8){bossCreated=true;hostile=[];hazards=[];ringWarnings=[];splitWarnings=[];queuedFirstSpells=[];createEnemy('boss');startBossIntro();}}
function enemySpawnPoint(kind,rad){if(kind==='boss')return{x:W*.5,y:-120,side:'top',entry:.92};
 let roll=Math.random();
 if(kind==='runner')roll=Math.random()<.5?.18:.44;
 else if(kind==='caster'&&Math.random()<.55)roll=.72;
 else if(kind==='brute'&&Math.random()<.45)roll=Math.random()<.5?.16:.36;
 if(roll<.24)return{x:-rad-12,y:rand(H*.12,H*.34),side:'left',entry:.42};
 if(roll<.48)return{x:W+rad+12,y:rand(H*.12,H*.34),side:'right',entry:.42};
 return{x:rand(rad+24,W-rad-24),y:-rand(34,82),side:'top',entry:.48};}
function calculateBossHp(p){const raw=(p.dmg*(1+Math.min(5,p.barrels-1)*.47)*(1+p.crit*.45))/Math.max(.075,p.rate);return Math.round(cap(raw*13.2,6100,13000)/100)*100;}
function createEnemy(kind=null){if(!kind)kind=waveEnemyKind();
 const def=TYPES[kind],stage=localWave(),scale=isChapter2()?1.23+(stage-1)*.145:1+(s.wave-1)*.135;const rad=def.r,sp=enemySpawnPoint(kind,rad);
 const obj={id:++frame,type:kind,x:sp.x,y:sp.y,r:rad,hp:def.hp*scale,max:def.hp*scale,spd:def.spd*(isChapter2()?(1.10+(stage-1)*.038)*C2_BALANCE.enemyMoveScale:1+(s.wave-1)*.03),damage:def.damage,shot:rand(1.0,2.1),hit:0,stun:0,spin:rand(0,6.28),age:0,phase:0,charge:0,finalBoss:false,spawnSide:sp.side,entry:sp.entry,entryMax:sp.entry,
 c2Role:null,chargeState:null,chargeTimer:0,chargeVX:0,chargeVY:0,chargeTargetX:0,chargeTargetY:0,
 chargeCooldown:1.0+rand(0,.55),firstSkillDone:false,firstCastQueued:false};
 if(isChapter2()&&kind==='runner'&&(stage===1||stage>=4))obj.c2Role='charge';
 if(isChapter2()&&kind==='caster'&&stage>=2){obj.c2Role=stage===2?'ring':stage===3?'split':Math.random()<.5?'ring':'split';}
 if(obj.c2Role){obj.firstCastQueued=true;obj.shot=3.0;obj.hp*=1.30;obj.max=obj.hp;}
 if(kind==='boss'){obj.x=W*.5;obj.finalBoss=isFinalWave();obj.hp=obj.finalBoss?calculateBossHp(s.p)*2*(isChapter2()?1.15*1.5:1):def.hp*(isChapter2()?1.65:1.25);obj.max=obj.hp;if(isChapter2()){obj.skillHistory={charge:false,ring:false,split:false};}obj.shot=obj.finalBoss?.65:1.85;obj.damageInWindow=0;obj.damageWindow=.0;obj.phaseTransition=0;obj.attackCount=0;obj.targetX=W*.5;obj.targetY=H*.20;if(!(isChapter2()&&obj.finalBoss))note(isChapter2()?'⚠ 雪影兔王·前哨试炼！':(obj.finalBoss?'⚠ 九尾妖狐现身！':'⚠ 狐狸大王出现！'),2.1);shake=obj.finalBoss?12:8;}
 else{const col=kind==='caster'?'#ff8fc3':kind==='brute'?'#ffb094':'#f7d7ff';ring(cap(obj.x,22,W-22),cap(obj.y,22,H-22),col,10+rad*.25,140);sparkle(cap(obj.x,28,W-28),cap(obj.y,28,H-28),col,kind==='brute'?10:6,.55);}
 enemies.push(obj);
 if(obj.c2Role==='ring'||obj.c2Role==='split')queuedFirstSpells.push({source:obj,kind:obj.c2Role});
 return obj;
}
const HERO_BODY={sprite:'bai_li_main_v11',w:102.9,h:128.8,centerY:-22.4,muzzle:[0.825483,0.456993]};
const HERO_DASH={sprite:'bai_li_dash_v9',w:102.9,h:128.8,centerY:-22.4,muzzle:[.798828,.524958]};
const HERO_OVERLOAD={sprite:'bai_li_overload_v11',w:108.045,h:135.24,centerY:-25.62,muzzle:[0.824739,0.377197]};
function playerPose(p){if(p.dashTTL>0)return'dash';if(p.hitTTL>0)return'hit';const v=movement();if(Math.abs(v.vx)+Math.abs(v.vy)>.20)return'move';return'idle';}
function playerVisual(p){const pose=playerPose(p),dir=p.facing===-1?-1:1;
 if(pose==='dash')return{pose,...HERO_DASH,w:HERO_DASH.w*(p.superTTL>0?1.05:1),h:HERO_DASH.h*(p.superTTL>0?1.05:1),centerY:HERO_DASH.centerY-(p.superTTL>0?3.22:0),x:0,bob:0};
 const isOverload=p.superTTL>0;const style=isOverload?HERO_OVERLOAD:HERO_BODY;
 const bob=pose==='move'?Math.sin(p.anim*7.2)*.42:Math.sin(p.anim*2.15)*.24;
 const hit=pose==='hit'?Math.sin(cap((.14-p.hitTTL)/.14,0,1)*Math.PI):0;
 return{pose,sprite:style.sprite,w:style.w,h:style.h,muzzle:style.muzzle,x:-dir*hit*1.55,centerY:style.centerY+bob+hit*.35,bob};}
function weaponPivot(p){const v=playerVisual(p),dir=p.facing===-1?-1:1,m=v.muzzle||(v.pose==='dash'?HERO_DASH.muzzle:HERO_BODY.muzzle);return{baseX:p.x+v.x+dir*(m[0]-.5)*v.w,baseY:p.y+v.centerY+(m[1]-.5)*v.h,visual:v};}
function cameraMount(p){const pivot=weaponPivot(p),recoil=(p.recoil||0)*1.15,angle=Number.isFinite(p.angle)?p.angle:-Math.PI/2;return{baseX:pivot.baseX,baseY:pivot.baseY,muzzleX:pivot.baseX,muzzleY:pivot.baseY,angle,recoil,visual:pivot.visual};}
function sparkle(x,y,color='#ccf9ee',num=10,force=1){for(let i=0;i<num;i++){let a=rand(0,6.28),v=rand(45,185)*force;particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,color,t:rand(.2,.7),life:1,r:rand(1.4,3.9)})}if(particles.length>290)particles.splice(0,particles.length-290)}
function ring(x,y,color='#d7ebff',r=16,speed=300){rings.push({x,y,r,speed,color,life:.35,t:.35});if(rings.length>28)rings.shift()}
function hitText(x,y,msg,color='#fff'){texts.push({x,y,msg,color,life:.58});if(texts.length>45)texts.shift()}
function damageEnemy(e,amount,from='bullet'){if(!e||e.hp<=0)return;let actual=Math.max(1,amount);if(e.finalBoss){if(e.phaseTransition>0)actual*=.48;actual=Math.min(actual,Math.max(28,e.max*.012));}if(isChapter2()&&e.finalBoss&&e.skillHistory){const min=(!e.skillHistory.charge||!e.skillHistory.ring)?e.max*.55+1:!e.skillHistory.split?1:0;actual=Math.min(actual,Math.max(0,e.hp-min));}e.hp-=actual;e.hit=.1;if(e.finalBoss)s.bossDamage+=Math.min(actual,Math.max(0,e.hp+actual));
 if(from==='bullet'){s.hitCount++;if(s.p.slow&&actual>0)e.stun=.7;if(actual>0&&s.p.blast&&Math.random()<.19){ring(e.x,e.y,'#a8dfff',4,200);for(const f of enemies){if(f!==e&&hyp(f,e)<42&&f.hp>0)isChapter2()?damageEnemy(f,actual*.32,'splash'):f.hp-=actual*.32}}
 if(actual>0&&s.p.chain){const near=enemies.find(f=>f!==e&&f.hp>0&&hyp(f,e)<105);if(near){isChapter2()?damageEnemy(near,actual*.43,'chain'):near.hp-=actual*.43;sparkle(near.x,near.y,'#99d8ff',2,.5);}}
 }
 if(actual>0&&(Math.random()<.34||amount>=38))hitText(e.x+rand(-8,8),e.y-12,Math.round(actual).toString(),amount>=38?'#ffe8a1':'#fff8f1');
 if(e.hp<=0)kill(e);if(from==='bullet'&&actual>0)foxAssist(e);
}
function kill(e){if(e.hp>0||e.doomed)return;const k=enemies.indexOf(e);if(k<0)return;
 // Once the player has seen the charge line, its dash is committed even if the rabbit dies.
 const committedCharge=isChapter2()&&!e.finalBoss&&e.c2Role==='charge'&&
  (e.chargeState==='windup'||e.chargeState==='dash');
 ringWarnings=ringWarnings.filter(w=>w.source!==e||w.firstCast);
 splitWarnings=splitWarnings.filter(w=>w.source!==e||w.firstCast);
 if(committedCharge){e.doomed=true;e.stun=0;e.hit=0;e.hp=0;}
 else enemies.splice(k,1);
 s.kills++;s.combo++;s.bestCombo=Math.max(s.bestCombo,s.combo);s.comboTTL=2.1;s.score+=TYPES[e.type].score+Math.min(300,s.combo*6);s.p.charge=cap(s.p.charge+(e.type==='boss'?22:e.type==='brute'?9:3.4)*(s.p.superTTL>0?.5:1),0,100);
 sparkle(e.x,e.y,isChapter2()?'#d4efff':e.type==='boss'?'#ffb3d1':'#ffb4a0',e.type==='boss'?55:e.type==='brute'?20:9,e.type==='boss'?1.5:1);if(e.type==='boss')ring(e.x,e.y,isChapter2()?'#b5eaff':'#ffdae6',30,530);if(s.combo%12===0){note('✦ '+s.combo+' 连拍击破！',.85);beep(780,.09,'triangle',.05)}else if(Math.random()<.1)beep(390,.04,'sine',.012);
}
// Shared one-use rescue: nine-tailed fox transforms into an orbiting, visible 2s foxfire shield.
// In the rabbit opener, the same two-second effect is clocked by cinematic time instead of play ticks.
function triggerFoxGuard(opening=false){
 if(!isChapter2()||!s.fox?.alive)return false;
 const p=s.p,origin=opening?{x:cap(p.x+49,70,W-38),y:p.y-91}:foxPosition();
 s.fox.alive=false;s.fox.saves=1;foxAssistFx.length=0;
 foxGuard={ttl:FOX_GUARD_DURATION,duration:FOX_GUARD_DURATION,opening,originX:origin.x,originY:origin.y,impact:0,pulse:0};
 hostile.length=0;hazards.length=0;
 
 ringWarnings.length=0;splitWarnings.length=0;queuedFirstSpells.length=0;
 for(const e of [...enemies]){
  if(e.c2Role){e.firstCastQueued=false;e.firstSkillDone=true;}
  if(e.chargeState){returnChargeOrigin(e);e.chargeState=null;e.chargeCooldown=Math.max(e.chargeCooldown||0,1.7);}
 }
 enemies=enemies.filter(e=>!e.doomed);
 // During the cinematic the full recovery is animated after the shield disappears.
 if(!opening)p.hp=Math.max(p.hp,Math.ceil(p.max*.70));
 p.invuln=Math.max(p.invuln,opening?0:FOX_GUARD_DURATION);p.hitTTL=.14;
 noticeTTL=0;$('banner').style.opacity='0';shake=opening?13:11;
 sparkle(origin.x,origin.y,'#ffac70',42,1.25);
 sparkle(p.x,p.y-53,'#ffdd9e',25,.9);ring(p.x,p.y-48,'#ffcb86',14,420);
 beep(950,.18,'triangle',.075);ui();return true;
}
function updateFoxGuard(dt){
 if(!foxGuard||foxGuard.opening)return;
 foxGuard.ttl=Math.max(0,foxGuard.ttl-dt);
 foxGuard.pulse=Math.max(0,foxGuard.pulse-dt);
 if(foxGuard.ttl<=0){sparkle(s.p.x,s.p.y-53,'#ffd5a2',17,.45);foxGuard=null;}
}
function drawFoxGuard(){
 if(!foxGuard||foxGuard.ttl<=0||!s)return;
 const g=foxGuard,p=s.p,elapsed=g.duration-g.ttl,transform=.38;
 const cx=p.x,cy=p.y-47,spin=elapsed*5.3,arrival=cap(elapsed/transform,0,1),fade=cap(g.ttl/.34,0,1);
 ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=fade;
 // The actual companion visibly grows, flies to Bai Li and breaks into nine flames.
 if(elapsed<transform){const k=arrival,ox=g.originX+(cx-g.originX)*k,oy=g.originY+(cy-g.originY)*k;
  ctx.save();ctx.globalAlpha=1-k*.86;ctx.shadowColor='#ff9c66';ctx.shadowBlur=18+25*k;
  sprite('fox_companion',ox,oy,68+43*Math.sin(Math.PI*k),68+43*Math.sin(Math.PI*k),false,-k*.25);ctx.restore();}
 const flameAlpha=cap((elapsed-.18)/.25,0,1);ctx.globalAlpha=fade*flameAlpha;
 // Foxfire shape flows unevenly around the player; the impact pushes its leading edge inward.
 const impact=cap(g.pulse/.46,0,1);
 for(let i=0;i<9;i++){
  const a=spin+i*Math.PI*2/9,radX=(54+5*Math.sin(elapsed*9+i))*(1-impact*.14*Math.cos(a)),radY=70+5*Math.sin(elapsed*7+i*1.8);
  const fx=cx+Math.cos(a)*radX,fy=cy+Math.sin(a)*radY,sz=7.4+1.9*Math.sin(elapsed*12+i*1.9),trail=18+6*Math.sin(elapsed*10+i);
  ctx.save();ctx.translate(fx,fy);ctx.rotate(a+Math.PI*.5);
  ctx.shadowColor=i%2?'#ff7a65':'#ffd68a';ctx.shadowBlur=19;ctx.fillStyle=i%3===0?'#ffe4a1':'#ff995f';
  ctx.beginPath();ctx.moveTo(0,-sz*1.5);ctx.bezierCurveTo(sz*1.4,-sz*.4,sz*.8,sz*.9,0,trail);
  ctx.bezierCurveTo(-sz*.9,sz*.8,-sz*1.3,-sz*.2,0,-sz*1.5);ctx.fill();
  ctx.globalAlpha=.7;ctx.fillStyle='#fff6d8';ctx.beginPath();ctx.ellipse(0,-2,sz*.38,sz*.77,0,0,Math.PI*2);ctx.fill();ctx.restore();
  ctx.save();ctx.globalAlpha=.28+.20*Math.sin(elapsed*11+i);ctx.strokeStyle='#ffbd85';ctx.lineWidth=3;
  ctx.beginPath();ctx.moveTo(fx,fy);ctx.quadraticCurveTo(fx-Math.sin(a)*13,fy+Math.cos(a)*12,fx-Math.sin(a)*26,fy+Math.cos(a)*27);ctx.stroke();ctx.restore();
 }
 if(impact>0){ctx.save();ctx.globalAlpha=impact;ctx.shadowColor='#ffb36f';ctx.shadowBlur=32;ctx.strokeStyle='#ffe5b2';ctx.lineWidth=3+impact*7;
  ctx.beginPath();ctx.ellipse(cx,cy,52+(1-impact)*33,67+(1-impact)*27,-.13,0,Math.PI*2);ctx.stroke();ctx.restore();}
 ctx.restore();
}
function hurt(d){if(mode!=='play'||s.p.invuln>0)return;let n=Math.max(2,Math.round(d*4/3)-s.p.armor);
 if(isChapter2())n=Math.max(2,Math.round(n*1.15));
 if(isChapter2()&&s.fox?.alive&&n>=s.p.hp){triggerFoxGuard();return;}
 s.p.hp=Math.max(0,s.p.hp-n);s.p.invuln=.64;s.p.hitTTL=.14;s.damageTaken+=n;shake=Math.max(shake,7);
 sparkle(s.p.x,s.p.y,'#fa98b9',17);hitText(s.p.x,s.p.y-35,'-'+n,'#ff87a5');beep(190,.14,'sawtooth',.04);
 try{navigator.vibrate&&navigator.vibrate(24)}catch(e){}if(s.p.hp<=0)end(false);
}
function rabbitOpeningImpact(){
 if(!bossOpening||mode!=='bossIntro'||bossOpening.hits>=3)return;
 const o=bossOpening,p=s.p;
 o.hits++;o.pulse=.42;shake=o.hits===3?17:11;
 ring(p.x,p.y-42,o.guarded?'#ffd59b':'#b5eaff',o.guarded?34:17,410);
 sparkle(p.x,p.y-65,o.guarded?'#ffe2a6':'#bbebff',o.hits===3?45:25,1.1);
 if(o.guarded){sparkle(p.x-20,p.y-83,'#ffb882',13,1.1);sparkle(p.x+22,p.y-51,'#9ce3ff',15,1.2);}
 beep(195+o.hits*48,.17,'sawtooth',.052);
 if(o.guarded){
  // First lethal barrage converts the fox into foxfire. The same aura covers all 3 hits.
  if(o.hits===1)triggerFoxGuard(true);
  if(foxGuard){foxGuard.impact=o.hits;foxGuard.pulse=.46;}
  if(o.hits===3){
   sparkle(p.x,p.y-65,'#ffdd9f',42,1.35);
   ring(p.x,p.y-50,'#ffd69a',24,530);
  }
 }else{
  // Finish all three visible impacts before defeat, even if the first is fatal.
  const dealt=Math.min(p.hp,o.damage);
  p.hp=Math.max(0,p.hp-dealt);s.damageTaken+=dealt;p.hitTTL=.28;
  if(o.hits===3)o.fallen=true;
 }
 ui();
}
function useBomb(){if(mode!=='play'||s.p.bombs<1)return false;const p=s.p;s.p.bombs--;s.bombUsed++;s.p.invuln=.62;shake=15;ring(p.x,p.y,'#fff4d2',20,830);sparkle(p.x,p.y,'#d3e5ff',67,1.6);hostile=[];hazards=[];ringWarnings=[];splitWarnings=[];queuedFirstSpells=[];for(const e of [...enemies]){if(e.chargeState)returnChargeOrigin(e);e.chargeState=null;e.chargeCooldown=Math.max(e.chargeCooldown||0,1.2);e.firstCastQueued=false;if(e.c2Role)e.firstSkillDone=true;}enemies=enemies.filter(e=>!e.doomed);const rad=180;for(const e of [...enemies]){e.stun=Math.max(e.stun,e.finalBoss?.45:1.2);const d=Math.hypot(e.x-p.x,e.y-p.y);if(e.finalBoss){damageEnemy(e,135,'skill');}else if(d<rad){damageEnemy(e,58+localWave()*3.0,'skill');}}note('❀ 百合定格 · 弹幕消散！',1.35);beep(860,.24,'triangle',.10);ui();return true}
function useDash(){if(mode!=='play'||s.p.dashCD>0)return false;const p=s.p;p.dashCD=3.6;s.dashUsed++;const v=rememberDirection(movement()),mag=len(v.vx,v.vy),keepRecent=performance.now()-recentDirection.at<800;const vx=mag>.1?v.vx:keepRecent?recentDirection.vx:0,vy=mag>.1?v.vy:keepRecent?recentDirection.vy:-1;p.dashTTL=.18;p.dashVX=vx*760;p.dashVY=vy*760;p.invuln=.30;ring(p.x,p.y,'#bfe9fd',12,210);sparkle(p.x,p.y,'#b5d6ff',18,1.0);note('➤ 花步闪避！',.45);beep(620,.08,'sine',.035);ui();return true}
function useBurst(){if(mode!=='play'||s.p.charge<100)return false;s.p.charge=0;s.burstUsed++;s.p.superTTL=4.2;s.p.superGlow=1;s.p.invuln=.32;ring(s.p.x,s.p.y+17,'#c8cfff',16,290);sparkle(s.p.x,s.p.y+14,'#adc1ff',30,.88);note('✧ 超载连拍！',1.1);beep(1000,.2,'triangle',.07);ui();return true}
function updateFox(dt){if(isChapter2()&&s.fox?.alive)s.fox.cooldown=Math.max(0,s.fox.cooldown-dt);}
function foxAssist(hit){
 if(!isChapter2()||!s.fox?.alive||s.fox.cooldown>0)return false;
 const available=enemies.filter(e=>e.hp>0);
 if(!available.length)return false;
 const origin=foxPosition();
 const primary=available.includes(hit)?hit:available.reduce((a,b)=>hyp(b,hit)<hyp(a,hit)?b:a);
 const others=available.filter(e=>e!==primary&&hyp(e,primary)<145);
 const secondary=others.length?others.reduce((a,b)=>hyp(b,primary)<hyp(a,primary)?b:a):null;
 const primaryPos={x:primary.x,y:primary.y};
 s.fox.cooldown=C2_BALANCE.foxAssistCooldown;s.fox.casts++;
 damageEnemy(primary,Math.max(30,s.p.dmg*1.45),'fox');
 foxAssistFx.push({x1:origin.x,y1:origin.y,x2:primaryPos.x,y2:primaryPos.y,t:.23,life:.23});
 sparkle(primaryPos.x,primaryPos.y,'#ffc98a',9,.5);
 if(secondary&&secondary.hp>0){const x=secondary.x,y=secondary.y;
  damageEnemy(secondary,Math.max(16,s.p.dmg*.80),'fox');
  foxAssistFx.push({x1:primaryPos.x,y1:primaryPos.y,x2:x,y2:y,t:.23,life:.23});
  sparkle(x,y,'#ffe1ad',6,.4);
 }
 if(foxAssistFx.length>6)foxAssistFx.splice(0,foxAssistFx.length-6);
 beep(740,.07,'triangle',.023);return true;
}
function updateFoxAssistFx(dt){for(let i=foxAssistFx.length-1;i>=0;i--){foxAssistFx[i].t-=dt;if(foxAssistFx[i].t<=0)foxAssistFx.splice(i,1);}}
function drawFoxAssistFx(){for(const beam of foxAssistFx){ctx.save();ctx.globalCompositeOperation='screen';
 ctx.globalAlpha=cap(beam.t/beam.life,0,1);ctx.strokeStyle='#ffd19c';ctx.shadowColor='#ff9a6c';ctx.shadowBlur=12;ctx.lineWidth=5;
 ctx.beginPath();ctx.moveTo(beam.x1,beam.y1);ctx.quadraticCurveTo((beam.x1+beam.x2)/2,Math.min(beam.y1,beam.y2)-28,beam.x2,beam.y2);ctx.stroke();ctx.restore();}}
function drawFoxCompanion(){if(!isChapter2()||!s.fox?.alive)return;
 const f=foxPosition();ctx.save();ctx.globalAlpha=.82;ctx.fillStyle='#23142560';ctx.beginPath();ctx.ellipse(f.x,f.y+28,24,7,0,0,Math.PI*2);ctx.fill();ctx.restore();
 ctx.save();ctx.shadowColor='#ffbd85';ctx.shadowBlur=10;ctx.globalAlpha=.95;sprite('fox_companion',f.x,f.y,68,68,false,Math.sin(fxTime*2)*.027);ctx.restore();
}
function fire(){const p=s.p;if(!enemies.length)return;let target=null,best=-Infinity;
 for(const e of enemies){if(e.y>p.y+35||e.hp<=0)continue;const danger=180-len(e.x-p.x,e.y-p.y)*.65+e.y*.38+(e.type==='boss'?22:0)+(e.type==='runner'?24:0)+(isChapter2()&&e.chargeState==='windup'?150:0);if(danger>best){best=danger;target=e}}
 if(!target)return;
 p.facing=target.x<p.x-72?-1:target.x>p.x+72?1:(p.facing||1);const pivot=weaponPivot(p);p.angle=Math.atan2(target.y-pivot.baseY,target.x-pivot.baseX);p.muzzleFlash=.09;p.recoil=1;const superOn=p.superTTL>0,total=Math.min(7,p.barrels+(superOn?1:0)),base=p.angle,mount=cameraMount(p);p.lastShotOrigin={x:mount.muzzleX,y:mount.muzzleY,angle:p.angle,facing:p.facing};
 for(let i=0;i<total;i++){const tightPair=isChapter2()&&total===2;let angle=base+(i-(total-1)/2)*(tightPair?.06:.11+(total>4?.022:0))+rand(tightPair?-.012:-.025,tightPair?.012:.025);const crit=Math.random()<p.crit,spread=i-(total-1)/2,offset=superOn?spread*3.2:spread*2.2;const sx=mount.muzzleX+Math.cos(angle+Math.PI/2)*offset,sy=mount.muzzleY+Math.sin(angle+Math.PI/2)*offset;shots.push({x:sx,y:sy,vx:Math.cos(angle)*850,vy:Math.sin(angle)*850,life:1.08,r:crit?5:3.6,dmg:p.dmg*(crit?2.05:1)*(superOn?1.22:1),pierce:p.pierce,hit:[],volley:frame,volleyIndex:i,critical:crit,superShot:superOn,color:crit?'#ffdc84':(superOn?'#c29aff':'#76beff')});}
 sparkle(mount.muzzleX,mount.muzzleY,superOn?'#d7c5ff':'#d4edff',superOn?3:2,.20);s.shotsFired+=total;if(shots.length>240)shots.splice(0,shots.length-240);beep(superOn?620:480,.035,'triangle',.011);
}
function startWaveClear(){if(mode!=='play')return;mode='waveClear';waveClearTimer=1.42;waveClearInfo={wave:s.wave,kills:s.kills-s.waveStartKills,score:s.score-s.waveStartScore};hostile.length=0;shots.length=0;hazards.length=0;ringWarnings.length=0;splitWarnings.length=0;queuedFirstSpells.length=0;resetInput();beep(930,.17,'triangle',.065);sparkle(W/2,H*.44,'#fff4df',22,.85);note('✦ 第'+s.wave+'波 · 清剿完成',1.3);}
function startBossDefeat(){if(mode!=='play')return;mode='bossDefeat';bossDefeatTimer=2.30;resetInput();hostile.length=0;shots.length=0;hazards.length=0;ringWarnings.length=0;splitWarnings.length=0;queuedFirstSpells.length=0;shake=9;ring(W/2,H*.32,'#fff6d8',25,310);sparkle(W/2,H*.32,'#ffe9f3',50,1.3);beep(980,.26,'triangle',.06);}
function showChapterVictory(){
 if(!s||s.chapter!==1||mode==='chapterVictory')return;
 mode='chapterVictory';resetInput();chapterContinueLocked=false;
 show(`<div data-ending class="end-wrap chapter-victory success"><div class="end-scene"><img class="end-art-blur" src="assets/victory_cg.webp" alt=""><img class="end-art" src="assets/victory_cg.webp" alt="白璃驯服九尾妖王"><div class="end-bottom"><button class="primary-btn" id="continue-adventure">继续冒险</button></div></div></div>`);
 ui();
}
function advanceInterlude(dt){
 if(mode==='waveClear'){waveClearTimer-=dt;fxTime+=dt;if(waveClearTimer<=0){waveClearTimer=0;drawUpgrade();}}
 else if(mode==='bossDefeat'){bossDefeatTimer-=dt;fxTime+=dt;if(bossDefeatTimer<=0){bossDefeatTimer=0;
  if(!isChapter2()){startTransition('victory',()=>playStoryVideo('ch1_victory_video',showChapterVictory));}
  else end(true);
 }}
}
function drawUpgrade(){mode='upgrade';resetInput();const pool=upgrades.filter(u=>{
 const p=s.p;return !((u.id==='multi'&&p.barrels>=5)||(u.id==='chain'&&p.chain)||(u.id==='blast'&&p.blast)||(u.id==='slow'&&p.slow)||(u.id==='pierce'&&p.pierce>=3)||(u.id==='regen'&&p.regen>=2)||(u.id==='crit'&&p.crit>=.74)||(u.id==='rapid'&&p.rate<=.075)||(u.id==='bomb'&&p.bombs>=3));});
 const chosen=[];const offensive=['multi','rapid','power','crit','pierce','chain','blast'];const atkpool=pool.filter(u=>offensive.includes(u.id));if(atkpool.length){const first=atkpool[Math.floor(Math.random()*atkpool.length)];chosen.push(first);pool.splice(pool.indexOf(first),1);}while(chosen.length<3&&pool.length){let sum=pool.reduce((a,b)=>a+b.weight,0),r=rand(0,sum),k=0;for(;k<pool.length-1;k++){r-=pool[k].weight;if(r<=0)break}chosen.push(pool.splice(k,1)[0]);}
 selectedUpgrades=chosen;
 show(`<div class="eyebrow">WAVE ${s.wave} COMPLETE · STUDIO UPGRADE</div><h1>选一张强化照片</h1><p>你的摄影枪正在进化。选一个技能，${isChapter2()?'准备下一波兔妖攻势。':'继续迎接下一波狐狸怪。'}</p><div class="upgrade-list">${chosen.map((u,i)=>`<button class="upgrade-btn" data-up="${i}"><span class="upicon">${u.icon}</span><span><strong>${u.name}</strong><small>${u.desc}</small></span></button>`).join('')}</div><p class="muted">${localWave()===7?(isChapter2()?'下一波：月影祭坛 · 雪影兔王':'下一波将是九尾妖狐决战'):'第 '+(s.wave+1)+' 波即将开始'}</p>`);
}
function choose(i){if(mode!=='upgrade'||!selectedUpgrades[i])return false;safeAudio();const u=selectedUpgrades[i],p=s.p;
 switch(u.id){case'multi':p.barrels=Math.min(5,p.barrels+1);break;case'rapid':p.rate=Math.max(.075,p.rate*.78);break;case'power':p.dmg+=7;break;case'crit':p.crit=Math.min(.75,p.crit+.14);break;case'pierce':p.pierce++;break;case'chain':p.chain=true;break;case'blast':p.blast=true;break;case'slow':p.slow=true;break;case'heart':p.max+=20;p.hp=Math.min(p.max,p.hp+55);break;case'armor':p.armor+=2;break;case'regen':p.regen=Math.min(2,p.regen+1);break;case'speed':p.speed*=1.16;break;case'bomb':p.bombs=Math.min(3,p.bombs+1);break;}
 s.upgrades.push(u.name);s.wave++;beginWave();hide();if(mode!=='bossIntro'){mode='play';note('第 '+s.wave+' 波 · '+(isChapter2()?({10:'环阵初现！',11:'分裂弹初现！',12:'三招混战开始！'}[s.wave]||'霜境怪潮袭来！'):'更多狐狸怪！'),1.6);}ui();return true;}
function gradeRun(win,totals){
 if(!win)return 'D';
 if(s.chapter2Only)return 'C';
 if(s.chapter1Record&&s.wave===16&&totals.damageTaken===0)return 'SSS';
 if(totals.score>=265000&&totals.bestCombo>=100&&totals.damageTaken<=160)return 'S';
 if(totals.score>=200000&&totals.damageTaken<=300)return 'A';
 return 'B';
}
function resultRows(totals){
 const timer=Math.floor(totals.clock/60)+':'+String(Math.floor(totals.clock%60)).padStart(2,'0');
 return [['击败敌人',totals.kills],['战斗用时',timer],['最终得分',totals.score.toLocaleString('zh-CN')],['最高连击',totals.bestCombo],['受到伤害',Math.round(totals.damageTaken)],['发射子弹数',totals.shotsFired],['到达关卡',s.wave+'/16'],['技能次数（闪避 / 超载 / 定格）',totals.dashUsed+' / '+totals.burstUsed+' / '+totals.bombUsed]];
}
function chapter2End(win){
 mode=win?'win':'lose';resetInput();$('dev-wave9').hidden=true;$('fox-status').hidden=true;
 const art=win?'victory_cg_ch2':'defeat_cg_ch2',totals=totalRecord(),timer=Math.floor(totals.clock/60)+':'+String(Math.floor(totals.clock%60)).padStart(2,'0');
 const rank=gradeRun(win,totals),rows=resultRows(totals),scope=s.chapter2Only?'第二章战绩':'全程战绩';
 show(`<div data-ending class="end-wrap ${win?'success':'failure'}"><div class="end-scene"><img class="end-art-blur" src="assets/${art}.webp" alt=""><img class="end-art" src="assets/${art}.webp" alt="${win?'白璃驯服雪影兔王':'雪影兔王制服白璃'}"><div class="end-cover"><span class="eyebrow">${win?'第二章 · 雪影契约':'第二章 · 霜境失守'}</span><h1>${win?'驯服成功':'挑战失败'}</h1><p>${win?'雪影兔王俯首，霜境归于白璃。':'雪影兔王夺回主导，白璃受困于霜境。'}</p></div><div class="end-ministats"><div class="end-mini rank"><span>评级</span><b>${rank}</b></div><div class="end-mini"><span>击破</span><b>${totals.kills}</b></div><div class="end-mini"><span>用时</span><b>${timer}</b></div><div class="end-mini"><span>分数</span><b>${(totals.score/1000).toFixed(1)}k</b></div></div><div class="end-bottom${win?'':' has-chapter-retry'}"><button class="primary-btn" id="restart">↻ 重新挑战</button>${win?'':'<button class="secondary-btn" id="retry-chapter2">从第9关挑战</button>'}<button class="secondary-btn" id="details">详细战绩</button><button class="secondary-btn" id="home">主页</button></div><section class="end-details" id="end-details" hidden><div class="end-details-head"><strong>${scope}</strong><button id="close-details">关闭</button></div><div class="end-details-grid">${rows.map(r=>`<div><span>${r[0]}</span><b>${r[1]}</b></div>`).join('')}</div></section></div></div>`);
 ui();beep(win?950:190,.3,win?'triangle':'sawtooth',.07);
}
function end(win){if(mode!=='play'&&!(win&&mode==='bossDefeat')&&!(!win&&isChapter2()&&mode==='bossIntro'))return;if(isChapter2()){chapter2End(win);return;}if(win){showChapterVictory();return;}mode='lose';resetInput();const totals=runRecord(),timer=Math.floor(totals.clock/60)+':'+String(Math.floor(totals.clock%60)).padStart(2,'0');const rows=[['击败敌人',s.kills],['战斗用时',timer],['最终得分',s.score.toLocaleString('zh-CN')],['最高连击',s.bestCombo],['受到伤害',Math.round(s.damageTaken)],['发射子弹数',s.shotsFired],['到达关卡',s.wave+'/8'],['技能次数（闪避 / 超载 / 定格）',s.dashUsed+' / '+s.burstUsed+' / '+s.bombUsed]];
 show(`<div data-ending class="end-wrap failure"><div class="end-scene"><img class="end-art-blur" src="assets/defeat_cg.webp" alt=""><img class="end-art" src="assets/defeat_cg.webp" alt="九尾妖王战胜白璃"><div class="end-cover"><span class="eyebrow">MISSION FAILED · 妖王反噬</span><h1>挑战失败</h1><p>镜头落下，妖王接管了花庭。</p></div><div class="end-ministats"><div class="end-mini rank"><span>评级</span><b>D</b></div><div class="end-mini"><span>击破</span><b>${s.kills}</b></div><div class="end-mini"><span>用时</span><b>${timer}</b></div><div class="end-mini"><span>分数</span><b>${(s.score/1000).toFixed(1)}k</b></div></div><div class="end-bottom"><button class="primary-btn" id="restart">↻ 再来一局</button><button class="secondary-btn" id="details">详细战绩</button><button class="secondary-btn" id="home">主页</button></div><section class="end-details" id="end-details" hidden><div class="end-details-head"><strong>本局详细战绩</strong><button id="close-details">关闭</button></div><div class="end-details-grid">${rows.map(r=>`<div><span>${r[0]}</span><b>${r[1]}</b></div>`).join('')}</div></section></div></div>`);ui();beep(190,.3,'sawtooth',.07);
}
function pause(){if(mode!=='play')return;mode='pause';resetInput();const ch2=isChapter2();
 show(`<div class="eyebrow">PAUSED · TAKE A BREAK</div><div class="hero-art"><img src="assets/bai_li_main_v11.webp" alt="白璃 · 持枪"><img src="assets/${ch2?'rabbit_basic2':'fox_basic2'}.webp" alt="${ch2?'普通兔妖':'普通狐狸怪'}"></div><h1>暂停拍摄</h1><p>${ch2?'霜境暂歇，看看下一步怎么走。':'狐灵们先停一下，你也喘口气。'}</p><button class="primary-btn" id="resume">▶ 继续游戏</button><button class="secondary-btn" id="music-toggle">♫ 音乐：${musicEnabled?'开':'关'}</button><button class="secondary-btn" id="restart">↻ 重新开始</button>`);}
function resume(){if(mode!=='pause')return;safeAudio();mode='play';last=0;hide()}
// V2.2 patterns: all telegraphed, capped, and restricted to chapter two.
function c2ChargeStart(e){
 if(e.chargeState||e.entry>0||e.y<65||e.y>=s.p.y-80||(e.stun>0&&!(e.firstCastQueued&&!e.firstSkillDone)&&!(e.skillHistory&&!e.skillHistory.charge)))return false;
 const active=enemies.filter(f=>f.chargeState==='windup'||f.chargeState==='dash').length;
 if(active>=(e.type==='boss'?2:(localWave()>=6?2:1)))return false;
 const dx=s.p.x-e.x,dy=s.p.y-e.y,dist=Math.hypot(dx,dy)||1;
 e.chargeOriginX=e.x;e.chargeOriginY=e.y;e.chargeHit=false;
 e.chargeState='windup';e.chargeTimer=e.type==='boss'?C2_BALANCE.bossWarning:C2_BALANCE.chargeWarning;
 e.chargeVX=dx/dist;e.chargeVY=dy/dist;
 e.chargeTargetX=s.p.x;e.chargeTargetY=s.p.y;
 e.chargeCooldown=(e.finalBoss?.8:1)*(4.0+rand(0,1.8));
 s.c2Events.charges++;if(e.type==='boss')s.c2Events.bossCharges++;
 return true;
}
function returnChargeOrigin(e){if(Number.isFinite(e.chargeOriginX)&&Number.isFinite(e.chargeOriginY)){e.x=e.chargeOriginX;e.y=e.chargeOriginY;}}
function c2ChargeStep(e,dt){
 if(!e.chargeState)return false;
 if(e.stun>0&&!(e.firstCastQueued&&!e.firstSkillDone)&&!(e.skillHistory&&!e.skillHistory.charge)){returnChargeOrigin(e);e.chargeState=null;e.chargeCooldown=Math.max(e.chargeCooldown,1.3);return true;}
 e.chargeTimer-=dt;
 if(e.chargeState==='windup'){
  returnChargeOrigin(e); // Hold a stable target for the entire warning.
  if(e.chargeTimer<=0){e.chargeState='dash';e.firstCastQueued=false;e.firstSkillDone=true;if(e.skillHistory)e.skillHistory.charge=true;e.chargeTimer=e.type==='boss'?C2_BALANCE.bossDuration:C2_BALANCE.chargeDuration;
   ring(e.x,e.y,'#ffc58f',10,145);s.c2Events.chargeDashes++;}
  return true;
 }
 if(e.chargeState==='dash'){
  const speed=(e.type==='boss'?C2_BALANCE.bossSpeed:C2_BALANCE.chargeSpeed)*C2_BALANCE.enemyMoveScale;
  // Stop at the arena edges. The warning is fixed before movement, so the player can dodge it.
  e.x=cap(e.x+e.chargeVX*speed*dt,e.r,W-e.r);
  e.y=cap(e.y+e.chargeVY*speed*dt,-20,e.type==='boss'?H-145:H+e.r);
  if(e.chargeTimer<=0){if(e.doomed)e.chargeState=null;else{ returnChargeOrigin(e);e.chargeState='recover';e.chargeTimer=e.type==='boss'?C2_BALANCE.bossRecover:C2_BALANCE.chargeRecover;ring(e.x,e.y,'#bfe9ff',9,190);sparkle(e.x,e.y,'#d9f5ff',8,.45);}}
  return true;
 }
 if(e.chargeState==='recover'){
  if(e.chargeTimer<=0)e.chargeState=null;
  return true;
 }
 return false;
}
function c2RingAttack(e,firstCast=false){
 if((e.finalBoss?(e.ringCooldown||0):c2RingCooldown)>0||ringWarnings.length||hostile.some(b=>b.c2Kind==='ring'))return false;
 if(e.entry>0||e.y<50||e.y>=s.p.y-58)return false;
 const x=s.p.x,y=s.p.y;
 // Aim the opening toward accessible playfield, never into a wall.
 const gap=x<115?0:x>W-115?Math.PI:-Math.PI/2;
 ringWarnings.push({x,y,gap,t:C2_BALANCE.ringWarning,r:C2_BALANCE.ringRadius,source:e,firstCast});
 if(e.finalBoss)e.ringCooldown=C2_BALANCE.bossRingCooldown;else c2RingCooldown=C2_BALANCE.ringCooldown;
 if(firstCast)e.firstCastQueued=false;
 s.c2Events.rings++;
 return true;
}
function c2RingRelease(w){
 if(w.source){w.source.firstSkillDone=true;if(w.source.skillHistory)w.source.skillHistory.ring=true;}
 const count=12, gapCount=3;
 for(let k=0;k<count;k++){
  const theta=2*Math.PI*k/count-Math.PI/2;
  const delta=Math.atan2(Math.sin(theta-w.gap),Math.cos(theta-w.gap));
  if(Math.abs(delta)<Math.PI*gapCount/count)continue;
  const x=w.x+w.r*Math.cos(theta),y=w.y+w.r*Math.sin(theta);
  const vx=-Math.cos(theta)*C2_BALANCE.ringSpeed,vy=-Math.sin(theta)*C2_BALANCE.ringSpeed;
  hostile.push({x,y,vx,vy,life:2.0,r:5.5,damage:8,color:'#bba1ff',c2Kind:'ring'});
 }

}
function c2SplitAttack(e,amount=1,targetX=s.p.x,targetY=s.p.y){
 if(hostile.length>C2_BALANCE.hostileCap-22)return false;
 const a=Math.atan2(targetY-e.y,targetX-e.x);
 for(let i=0;i<amount;i++){
  const theta=a+(i-(amount-1)/2)*.32;
  hostile.push({x:e.x,y:e.y+16,vx:Math.cos(theta)*146,vy:Math.sin(theta)*146,
    life:3.0,r:9,damage:10,color:'#ffd59c',c2Kind:'split',splitIn:C2_BALANCE.splitDelay});
 }
 s.c2Events.splits+=amount;e.firstSkillDone=true;if(e.skillHistory)e.skillHistory.split=true;
 return true;
}
function c2SplitRelease(w){
 c2SplitAttack({x:w.x,y:w.y,firstSkillDone:false},1,w.targetX,w.targetY);
 if(w.source)w.source.firstSkillDone=true;
}
// Every bullet caster promises one telegraphed first shot. Death cannot erase that
// promise: queued spells still warn, then fire once from the visible upper lane.
function processFirstSpells(){
 if(c2FirstSpellCooldown>0)return;
 for(let i=0;i<queuedFirstSpells.length;){
  if(ringWarnings.length+splitWarnings.length>=2)break;
  const spell=queuedFirstSpells[i],e=spell.source;
  if(!enemies.includes(e)&&e.hp>0){queuedFirstSpells.splice(i,1);continue;}
  if(e.hp>0&&e.entry>0){i++;continue;}
  const x=cap(e.x,28,W-28),y=cap(e.y,62,H*.36),targetX=s.p.x,targetY=s.p.y;
  if(spell.kind==='ring'){
   const gap=targetX<115?0:targetX>W-115?Math.PI:-Math.PI/2;
   ringWarnings.push({x:targetX,y:targetY,gap,t:C2_BALANCE.ringWarning,r:C2_BALANCE.ringRadius,source:e,firstCast:true});
   c2RingCooldown=C2_BALANCE.ringCooldown;s.c2Events.rings++;
  }else{
   splitWarnings.push({x,y,targetX,targetY,t:C2_BALANCE.splitWarning,source:e,firstCast:true});
  }
  e.firstCastQueued=false;queuedFirstSpells.splice(i,1);
  c2FirstSpellCooldown=.35;return;
 }
}
// Body charges begin as soon as the rabbit finishes entering the upper lane.
function tryFirstSkill(e){
 if(!e.firstCastQueued||e.firstSkillDone||e.entry>0||e.y<50||e.y>=s.p.y-80)return false;
 if(e.c2Role==='charge'){
  if(e.chargeState)return true;
  e.chargeCooldown=0;return c2ChargeStart(e);
 }
 return false;
}
function c2BossAttack(e){
 const phase=e.finalBoss&&e.enraged?2:1;
 const pattern=e.phase++%(e.finalBoss?(phase===1?3:4):2);
 if(pattern===1&&c2ChargeStart(e))return;
 if(e.finalBoss&&pattern===2&&c2RingAttack(e))return;
 if(e.finalBoss&&phase===2&&pattern===3&&c2SplitAttack(e,2))return;
 // Reliable, lighter fan as a fallback, avoiding overlapping sudden wall attacks.
 const count=e.finalBoss?(phase===2?6:5):5;
 const a=Math.atan2(s.p.y-e.y,s.p.x-e.x);
 if(hostile.length>125)return;
 for(let i=0;i<count;i++){const ang=a+(i-(count-1)/2)*.19;
  hostile.push({x:e.x,y:e.y+18,vx:Math.cos(ang)*(phase===2?208:187),vy:Math.sin(ang)*(phase===2?208:187),life:4,r:6.5,damage:phase===2?10:9,color:'#a7dfff',c2Kind:'frost'});}
}
function attackPattern(e){if(isChapter2()){if(e.type==='boss'){c2BossAttack(e);return;}if(e.type==='caster'){if(e.c2Role==='ring'&&c2RingAttack(e))return;if(e.c2Role==='split'&&c2SplitAttack(e))return;}}if(e.type==='caster'){const a=Math.atan2(s.p.y-e.y,s.p.x-e.x);hostile.push({x:e.x,y:e.y,vx:Math.cos(a)*188,vy:Math.sin(a)*188,life:4,r:7,damage:10,color:isChapter2()?'#b7eaff':'#ff8abd',c2Kind:isChapter2()?'frost':null});return;}
const a=Math.atan2(s.p.y-e.y,s.p.x-e.x);
if(e.finalBoss){const phase=e.hp<e.max*.55?2:1;const pattern=e.phase++%(phase===1?2:3);
if(pattern===0){const count=phase===1?5:7;for(let k=0;k<count;k++){const theta=a+(k-(count-1)/2)*(phase===1?.18:.14);hostile.push({x:e.x,y:e.y+18,vx:Math.cos(theta)*(phase===1?205:225),vy:Math.sin(theta)*(phase===1?205:225),life:4.2,r:7,damage:phase===1?9:11,color:'#ff65a5'});}}
else if(pattern===1){const count=phase===1?9:13;const gap=Math.round(((Math.sin(e.age*.6)+1)/2)*(count-3))+1;for(let k=0;k<count;k++){if(k===gap||k===gap+1)continue;const theta=.13+(k-(count-1)/2)*.15;hostile.push({x:e.x,y:e.y+12,vx:Math.sin(theta)*(phase===1?145:170),vy:Math.cos(theta)*(phase===1?145:170)+30,life:4.5,r:6.5,damage:9,color:'#ff8abd'});}}
else{for(let m=0;m<12;m++){if(m%5===0)continue;const theta=Math.PI*2*m/12+e.age*.28;hostile.push({x:e.x,y:e.y+15,vx:Math.cos(theta)*162,vy:Math.sin(theta)*162+25,life:4.2,r:6.5,damage:10,color:'#ff93c4'});}hazards.push({x:cap(s.p.x,40,W-40),t:1.12,strike:false,damage:17});}
return;}
for(let k=-2;k<=2;k++){const theta=a+k*.19;hostile.push({x:e.x,y:e.y+23,vx:Math.cos(theta)*205,vy:Math.sin(theta)*205,life:3.6,r:7,damage:12,color:'#ff7ab7'});}hazards.push({x:cap(s.p.x+rand(-12,12),40,W-40),t:1.08,strike:false,damage:18});}
function update(dt){if(mode!=='play')return;dt=cap(dt,0,.055);s.clock+=dt;fxTime+=dt;updateFoxAssistFx(dt);updateFoxGuard(dt);const p=s.p;
 // 实际战斗期间自然恢复超载能量；暂停、升级、开场和结算不运行 update。
 p.charge=cap(p.charge+OVERLOAD_PASSIVE_REGEN_PER_SECOND*dt,0,100);
 if(p.charge>99.999999)p.charge=100; // 避免浮点尾差导致显示 100% 却不能释放
 p.fire-=dt;p.invuln=Math.max(0,p.invuln-dt);p.dashCD=Math.max(0,p.dashCD-dt);p.superTTL=Math.max(0,p.superTTL-dt);p.dashTTL=Math.max(0,p.dashTTL-dt);p.hitTTL=Math.max(0,(p.hitTTL||0)-dt);
 if(isChapter2()){c2RingCooldown=Math.max(0,c2RingCooldown-dt);c2FirstSpellCooldown=Math.max(0,c2FirstSpellCooldown-dt);}p.anim+=dt;p.muzzleFlash=Math.max(0,(p.muzzleFlash||0)-dt);p.recoil=Math.max(0,(p.recoil||0)-dt*11.5);const glowTarget=p.superTTL>0?1:0;p.superGlow+=(glowTarget-p.superGlow)*Math.min(1,dt*(glowTarget?13:5.5));p.hp=Math.min(p.max,p.hp+p.regen*.72*dt);s.comboTTL-=dt;if(s.comboTTL<=0)s.combo=0;
 if(p.dashTTL>0){p.x=cap(p.x+p.dashVX*dt,48,W-48);p.y=cap(p.y+p.dashVY*dt,H*.49,H-116);}else{const v=rememberDirection(movement());p.x=cap(p.x+v.vx*p.speed*dt,48,W-48);p.y=cap(p.y+v.vy*p.speed*dt,H*.49,H-116);}
 updateFox(dt);if(p.fire<=0){fire();p.fire=p.rate*(p.superTTL>0?.68:1)}
 if(spawnLeft>0){spawnCd-=dt;let c=0;while(spawnCd<=0&&spawnLeft>0&&c++<3){const reveal=isChapter2()&&spawnLeft===wavesTarget&&localWave()<=3?(['runner','caster','caster'][localWave()-1]):null;createEnemy(reveal);spawnLeft--;spawnCd+=waveSpawnDelay()}}
 if((localWave()===4||isFinalWave())&&!bossCreated&&spawnLeft<=wavesTarget*(isFinalWave()?.10:.40)){bossCreated=true;createEnemy('boss')}
 for(const e of [...enemies].reverse()){if(!enemies.includes(e))continue;e.age+=dt;e.hit=Math.max(0,e.hit-dt);e.stun=Math.max(0,e.stun-dt);e.entry=Math.max(0,(e.entry||0)-dt);e.ringCooldown=Math.max(0,(e.ringCooldown||0)-dt);if(e.doomed){
  const wasDash=e.chargeState==='dash',x0=e.x,y0=e.y;
  c2ChargeStep(e,dt);
  if(wasDash){const vx=e.x-x0,vy=e.y-y0,d=vx*vx+vy*vy;
   const f=d?cap(((p.x-x0)*vx+(p.y-y0)*vy)/d,0,1):0;
   if(Math.hypot(p.x-(x0+f*vx),p.y-(y0+f*vy))<e.r+15){
    enemies.splice(enemies.indexOf(e),1);hurt(e.damage);if(mode!=='play')return;continue;
   }
  }
  if(!e.chargeState||e.chargeState==='recover')enemies.splice(enemies.indexOf(e),1);
  continue;
 }
 if(e.hp<=0){kill(e);continue;}
 if(isChapter2()&&e.firstCastQueued)tryFirstSkill(e);
 if(e.hp<=0)continue;
 let sp=e.spd*(e.stun>0?.49:1)*(e.entry>0&&e.type!=='boss'?.85:1);
  if(isChapter2()&&e.c2Role==='charge'&&!e.chargeState&&!e.firstCastQueued){e.chargeCooldown-=dt;
    if(e.chargeCooldown<=0&&!c2ChargeStart(e))e.chargeCooldown=.34+rand(0,.5);}
  if(e.type==='runner'&&!e.chargeState)e.x+=Math.sin(e.age*7+e.spin)*37*dt*(isChapter2()?C2_BALANCE.enemyMoveScale:1);
 const safe=Math.max(e.r,TYPES[e.type].size[0]/2)+6;
 if(e.type==='boss'&&e.finalBoss){if(!e.enraged&&e.hp<e.max*.55){e.enraged=true;e.phaseTransition=1.35;e.shot=.38;phaseFlash=1.25;note(isChapter2()?'⚠ 雪影兔王 · 月影形态！':'⚠ 第二阶段 · 九尾业火！',2.0);shake=13;ring(e.x,e.y,isChapter2()?'#8fbaff':'#ff5aa2',40,430);sparkle(e.x,e.y,isChapter2()?'#b5ebff':'#ff9ddd',50,1.2);}e.phaseTransition=Math.max(0,(e.phaseTransition||0)-dt);if(!c2ChargeStep(e,dt)){const tx=W*.5+Math.sin(e.age*(e.enraged?1.3:.85)+e.spin)*118,ty=H*.32+Math.sin(e.age*1.4+e.spin)*24;e.x=cap(e.x+cap(tx-e.x,-sp*dt,sp*dt),safe,W-safe);e.y=cap(e.y+cap(ty-e.y,-sp*.7*dt,sp*.7*dt),H*.24,H*.40);}}else if(isChapter2()&&e.chargeState){c2ChargeStep(e,dt);}else if(isChapter2()&&e.type==='boss'){e.x=cap(e.x+cap(W*.5-e.x,-sp*dt,sp*dt),safe,W-safe);e.y=cap(e.y+cap(H*.29-e.y,-sp*1.85*dt,sp*1.85*dt),H*.20,H*.80);}else if(isChapter2()&&e.entry<=0&&e.c2Role&&!e.firstSkillDone&&(e.firstCastQueued||ringWarnings.some(w=>w.source===e)||splitWarnings.some(w=>w.source===e))){/* The first spell holds the caster in an upper lane. */ e.y=cap(e.y,e.c2Role==='charge'?65:50,H*.36);}else{const homeX=e.spawnSide==='left'?42:e.spawnSide==='right'?-42:0,moveScale=isChapter2()?C2_BALANCE.enemyMoveScale:1; e.x=cap(e.x+cap((p.x+homeX-e.x)*.40,-34,34)*dt*moveScale,safe,W-safe); if(e.spawnSide==='left'||e.spawnSide==='right'){e.y=cap(e.y+cap((Math.min(p.y-120,H*.58)-e.y)*.28,-18,18)*dt*moveScale+sp*.55*dt,-40,H+60);} else if(e.type==='boss') e.y+=e.y<H*.31?sp*dt:(Math.sin(e.age*2)*6*dt); else e.y+=sp*dt;}
 if(e.hp<=0)continue;
 if(e.type==='caster'||e.type==='boss'){
    if(!e.chargeState&&!(e.c2Role&&!e.firstSkillDone)){e.shot-=dt;if(e.shot<=0&&e.y>40&&e.y<p.y-55){attackPattern(e);
      e.shot=isChapter2()?(e.type==='boss'?(e.finalBoss?(e.enraged?1.24:1.56):2.05):2.55+rand(0,.55)):
        (e.type==='boss'?(e.finalBoss?(e.enraged?1.00:1.55):1.95):2.05);}}}
 if(Math.hypot(e.x-p.x,e.y-p.y)<e.r+(e.type==='boss'?23:15)){
  if(isChapter2()&&e.chargeState==='dash'){if(!e.chargeHit){e.chargeHit=true;hurt(e.damage);if(mode!=='play')return;}continue;}
 if(e.firstCastQueued){e.y=Math.min(e.y,H*.36);continue;}
  if(e.type!=='boss'){const idx=enemies.indexOf(e);if(idx>=0)enemies.splice(idx,1);}hurt(e.damage);if(mode!=='play')return;
 }
 else if(e.y>H+e.r+5){{const idx=enemies.indexOf(e);if(idx>=0)enemies.splice(idx,1);}hurt(e.type==='brute'?14:9);if(mode!=='play')return}
 }
 if(isChapter2())processFirstSpells();
 for(let i=shots.length-1;i>=0;i--){const b=shots[i],x0=b.x,y0=b.y;b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;let remove=b.life<=0||b.y<-40||b.y>H+60||b.x<-40||b.x>W+40;
 if(!remove){for(const e of [...enemies].reverse()){if(e.hp<=0||b.hit.includes(e))continue;const vx=b.x-x0,vy=b.y-y0,distSq=vx*vx+vy*vy,t=distSq?cap(((e.x-x0)*vx+(e.y-y0)*vy)/distSq,0,1):0;
 if(Math.hypot(e.x-(x0+t*vx),e.y-(y0+t*vy))<e.r+b.r){b.hit.push(e);damageEnemy(e,b.dmg*(e.finalBoss&&b.volleyIndex>0?.58:1),'bullet');sparkle(x0+t*vx,y0+t*vy,b.critical?'#ffe2a0':b.superShot?'#dec5ff':'#d5f7ff',2,.20);if(b.pierce<=0){remove=true;break}else b.pierce--;}}
 }if(remove)shots.splice(i,1);}
 for(let i=ringWarnings.length-1;i>=0;i--){const w=ringWarnings[i];w.t-=dt;
  if(w.t<=0){if(hostile.length>C2_BALANCE.hostileCap-10){w.t=.12;continue;}c2RingRelease(w);ringWarnings.splice(i,1);}}
 for(let i=splitWarnings.length-1;i>=0;i--){const w=splitWarnings[i];w.t-=dt;if(w.t<=0){if(hostile.length>C2_BALANCE.hostileCap-22){w.t=.12;continue;}c2SplitRelease(w);splitWarnings.splice(i,1);}}
 for(let i=hostile.length-1;i>=0;i--){const b=hostile[i];if(!b)continue;b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;
  if(b.c2Kind==='split'&&b.splitIn!=null){b.splitIn-=dt;
   if(b.splitIn<=0&&b.life>0){
    // Up close or at bullet cap, keep the original projectile rather than delete it.
    if(Math.hypot(b.x-p.x,b.y-p.y)>100&&hostile.length<C2_BALANCE.hostileCap-6){hostile.splice(i,1);
     const a=Math.atan2(b.vy,b.vx);for(const spread of [-.47,0,.47]){
      const t=a+spread;hostile.push({x:b.x,y:b.y,vx:Math.cos(t)*181,vy:Math.sin(t)*181,
       life:2.7,r:5.3,damage:8,color:'#ffcb85',c2Kind:'fragment'});}
     sparkle(b.x,b.y,'#ffe0a4',5,.3);
     continue;
    }
    b.splitIn=null; // Continue along the same trajectory and keep collision enabled.
   }
  }if(b.life<=0||b.x<-30||b.x>W+30||b.y>H+40){hostile.splice(i,1);continue}if(Math.hypot(b.x-p.x,b.y-p.y)<b.r+15){hostile.splice(i,1);hurt(b.damage);if(mode!=='play')return}}
 for(let i=hazards.length-1;i>=0;i--){const h=hazards[i];if(!h)continue;h.t-=dt;if(h.t<=0&&!h.strike){h.strike=true;if(Math.abs(p.x-h.x)<27){hurt(h.damage);if(mode!=='play')return;}}if(h.t<-.28)hazards.splice(i,1)}
 for(let i=particles.length-1;i>=0;i--){const f=particles[i];f.x+=f.vx*dt;f.y+=f.vy*dt;f.vx*=.96;f.vy*=.96;f.t-=dt;if(f.t<0)particles.splice(i,1)}
 for(let i=rings.length-1;i>=0;i--){const f=rings[i];f.r+=dt*f.speed;f.t-=dt;if(f.t<0)rings.splice(i,1)}
 for(let i=texts.length-1;i>=0;i--){const f=texts[i];f.y-=38*dt;f.life-=dt;if(f.life<0)texts.splice(i,1)}
 shake=Math.max(0,shake-dt*35);noticeTTL=Math.max(0,noticeTTL-dt);if(noticeTTL===0)$('banner').style.opacity='0';
 if(isFinalWave()){if(bossCreated&&!enemies.some(e=>e.finalBoss))startBossDefeat();}else if(spawnLeft<=0&&(!bossCreated&&localWave()===4 ? false : enemies.length===0)&&!queuedFirstSpells.length&&!ringWarnings.length&&!splitWarnings.length&&!hostile.length){startWaveClear();}
 if(!window.__QA_FAST)ui();
}
// Background is rendered procedurally to avoid blocking image loads on mobile; scene scrolls gently beneath combat sprites.
function flower(x,y,r=1,alpha=1,petalColor='#eef7ef',centerColor='#efc77a',stem='#739e82'){ctx.save();ctx.translate(x,y);ctx.globalAlpha=alpha;ctx.rotate(.2*Math.sin(x));ctx.strokeStyle=stem;ctx.lineWidth=1.4*r;ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(5*r,12*r,-3*r,22*r);ctx.stroke();ctx.fillStyle=petalColor;for(let i=0;i<5;i++){ctx.save();ctx.rotate(i*Math.PI*2/5);ctx.beginPath();ctx.ellipse(0,-5*r,3.2*r,7.2*r,0,0,6.29);ctx.fill();ctx.restore()}ctx.fillStyle=centerColor;ctx.beginPath();ctx.arc(0,0,2*r,0,6.29);ctx.fill();ctx.restore()}
function petal(x,y,size=1,color='#ffd8ef',alpha=.6,rot=0){ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.globalAlpha=alpha;ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(0,-7*size);ctx.bezierCurveTo(4*size,-5*size,5*size,2*size,0,8*size);ctx.bezierCurveTo(-5*size,2*size,-4*size,-5*size,0,-7*size);ctx.fill();ctx.restore()}
function drawTorii(x,y,s=1,color='#3b2a42',glow=0,broken=false){ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.globalAlpha=.92;if(glow>0){ctx.shadowColor='rgba(255,149,201,'+glow+')';ctx.shadowBlur=24;}ctx.fillStyle=color;ctx.fillRect(-5,-22,10,65);ctx.fillRect(-52,-16,10,58);ctx.fillRect(42,-16,10,58);ctx.fillRect(-68,-32,136,10);ctx.fillRect(-60,-42,120,8);ctx.fillRect(-30,-11,60,7);if(broken){ctx.clearRect(12,-16,32,10);ctx.clearRect(-52,18,10,14);}ctx.restore()}
function drawLantern(x,y,s=1,lit=1){ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.fillStyle='#2b2a37';ctx.fillRect(-3,0,6,26);ctx.fillStyle='#4f3446';ctx.fillRect(-12,-22,24,28);ctx.fillStyle='rgba(255,214,164,'+(.32+.35*lit)+')';ctx.fillRect(-9,-18,18,20);ctx.strokeStyle='rgba(255,241,223,'+(.25+.4*lit)+')';ctx.strokeRect(-9,-18,18,20);ctx.restore()}
function sceneIndex(){if(mode==='intro')return 0;if(mode==='bossIntro')return 3;const w=localWave();return w<=2?0:w<=4?1:w<=7?2:3}
const sideFlowers=Array.from({length:56},(_,i)=>{const side=i%2===0?0:1;return{x:side?rand(316,404):rand(-16,82),y:(i*89)%1100,size:rand(.56,1.34),alpha:rand(.20,.68),drift:rand(9,22)}});
const pathStones=Array.from({length:42},(_,i)=>({x:rand(110,280),y:(i*63)%980,w:rand(20,40),h:rand(14,30),r:rand(-.36,.36)}));
const nearPetals=Array.from({length:16},(_,i)=>({x:rand(0,W),y:rand(0,H),s:rand(.7,1.5),a:rand(.16,.44),v:rand(12,28)}));
const foxFires=Array.from({length:10},(_,i)=>({x:rand(44,W-44),y:(i*97)%900,r:rand(6,13),v:rand(10,26)}));

// V12 full-screen painted backgrounds, bundled for offline play.
const BG_KEYS=['bg_lily_v12','bg_ruins_v12','bg_magic_v12','bg_shrine_v12'];
const BG_IMAGES=BG_KEYS.map(key=>{const image=new Image();image.src=(window.__ASSETS||{})[key]||('assets/'+key+'.webp');return image});
const BG_CH2_KEYS=['bg_ch2_1','bg_ch2_2','bg_ch2_3','bg_ch2_4'];
const BG_CH2_IMAGES=BG_CH2_KEYS.map(key=>{const image=new Image();image.src=(window.__ASSETS||{})[key]||('assets/'+key+'.webp');return image});
let v12Scene=-1,v12Previous=-1,v12BlendStart=0,v12Chapter=0;
function paintScene(scene,alpha=1){
 const image=(isChapter2()?BG_CH2_IMAGES:BG_IMAGES)[scene];
 ctx.save();ctx.globalAlpha=alpha;
 if(image&&image.complete&&image.naturalWidth){
   // Cover + a slight safe overscan: vertical camera drift, without fake non-seamless tiling.
   const scale=Math.max(W/image.width,H/image.height)*1.052;
   const sw=image.width*scale,sh=image.height*scale;
   const dy=Math.sin(fxTime*.16+scene*.7)*Math.min(9,(sh-H)/3);
   const dx=Math.cos(fxTime*.09+scene*.6)*Math.min(4,(sw-W)/3);
   ctx.drawImage(image,(W-sw)/2+dx,(H-sh)/2+dy,sw,sh);
 }else{
   ctx.fillStyle=['#ada5bb','#666174','#534267','#552b43'][scene]||'#55475c';ctx.fillRect(0,0,W,H);
 }
 ctx.restore();
}
function background(sceneOverride=null){
 const chapter=isChapter2()?2:1;
 if(chapter!==v12Chapter){v12Scene=-1;v12Previous=-1;v12Chapter=chapter;}
 const scene=sceneOverride==null?sceneIndex():sceneOverride;
 if(scene!==v12Scene){v12Previous=v12Scene;v12Scene=scene;v12BlendStart=fxTime;}
 paintScene(scene,1);
 // Soft transition; clip previous frame rather than fading to black.
 const fade=1-Math.min(1,Math.max(0,fxTime-v12BlendStart)/.72);
 if(fade>0&&v12Previous>=0&&v12Previous!==scene)paintScene(v12Previous,fade);
 // Keep the combat center quiet, preserve detailed flower beds on both sides.
 const centerShade=ctx.createLinearGradient(0,0,W,0);
 centerShade.addColorStop(0,'rgba(12,16,30,.025)');
 centerShade.addColorStop(.29,'rgba(20,22,40,.09)');
 centerShade.addColorStop(.5,'rgba(22,24,43,.14)');
 centerShade.addColorStop(.71,'rgba(20,22,40,.09)');
 centerShade.addColorStop(1,'rgba(12,16,30,.025)');
 ctx.fillStyle=centerShade;ctx.fillRect(0,0,W,H);
}
function sprite(name,x,y,w,h,flip=false,angle=0,alpha=1){const im=sprites[name];if(!im||!im.complete||!im.naturalWidth){ctx.fillStyle=name.startsWith('fox')?'#e9955c':'#657d6f';ctx.beginPath();ctx.ellipse(x,y,w/2,h/2,0,0,6.28);ctx.fill();return;}
 ctx.save();ctx.translate(x,y);ctx.globalAlpha=alpha;if(flip)ctx.scale(-1,1);ctx.rotate(angle);ctx.drawImage(im,-w/2,-h/2,w,h);ctx.restore();}
// V2.3 enemy visual layer only. Do not alter first-chapter sprite mapping or balance.
const CH2_SPRITES={basic:'rabbit_basic',basic2:'rabbit_basic2',runner:'rabbit_runner',caster:'rabbit_caster',brute:'rabbit_brute',boss:'rabbit_boss'};
const CH2_SIZES={basic:[58,54],basic2:[58,54],runner:[85,59],caster:[82,65],brute:[108,70],boss:[216,169]};
function drawEnemy(e){
 const def=TYPES[e.type],ch2art=isChapter2(),art=ch2art?(CH2_SPRITES[e.type]||def.sprite):def.sprite,artSize=ch2art?(CH2_SIZES[e.type]||def.size):def.size,w=artSize[0],h=artSize[1],entryPct=e.entryMax?cap(1-e.entry/e.entryMax,0,1):1;
 const t=e.age+(e.spin||0),isBoss=e.type==='boss',hit=e.hit>0;
 let bob=0,tilt=0,motion=1;
 // The art never changes; movement stays far below character-scale animation.
 if(e.entry<=0){
   if(e.type==='basic'||e.type==='basic2'){
     bob=-Math.max(0,Math.sin(t*7.2))*2.0;
     tilt=Math.sin(t*6.1)*.035;
   }else if(e.type==='runner'){
     bob=-Math.abs(Math.sin(t*13))*1.3;
     tilt=(e.spawnSide==='left'?.045:e.spawnSide==='right'?-.045:0)+Math.sin(t*11)*.037;
   }else if(e.type==='caster'){
     bob=Math.sin(t*2.7)*1.7;motion=1+Math.sin(t*3.8)*.009;
   }else if(e.type==='brute'){
     bob=Math.sin(t*2.3)*.65;tilt=Math.sin(t*1.8)*.015;
   }else if(isBoss){
     bob=Math.sin(t*1.7)*1.35;motion=1+Math.sin(t*1.9)*.012;
   }
 }
 if(hit){motion*=.988;bob+=.6;}
 const yy=e.y+bob,baseScale=isBoss?(isFinalWave()?1.10:1):1;
 const sc=baseScale*(.92+.08*entryPct)*motion;
 ctx.save();ctx.globalAlpha=isBoss?1:cap(.35+entryPct*.65,0,1);
 ctx.fillStyle='#25353852';ctx.beginPath();ctx.ellipse(e.x,e.y+e.r*.83,e.r*.90,e.r*.27,0,0,Math.PI*2);ctx.fill();
 if(e.entry>0&&!isBoss){ctx.save();ctx.globalAlpha=cap(.22+.38*entryPct,0,.55);ctx.strokeStyle=e.type==='caster'?'#ff9bca':e.type==='brute'?'#ffc6a9':'#f3d4ff';ctx.lineWidth=2.4;ctx.beginPath();ctx.ellipse(e.x,e.y,e.r*1.05+entryPct*8,e.r*.45+entryPct*4,0,0,6.28);ctx.stroke();ctx.restore();}
 if(isBoss){ctx.save();ctx.shadowColor=ch2art?(e.enraged?'#9bb7ff':'#9ce8ff'):(e.enraged?'#ff5d85':'#f564ba');ctx.shadowBlur=e.enraged?30:17;ctx.strokeStyle=ch2art?(e.enraged?'#c4b6ff99':'#b4f0ff88'):(e.enraged?'#ff887e70':'#fda4d344');ctx.lineWidth=2;ctx.beginPath();ctx.arc(e.x,yy,e.r+11+Math.sin(t*2.2)*2,0,Math.PI*2);ctx.stroke();ctx.restore();}
 if(e.type==='caster'&&e.shot<.32&&e.entry<=0){
   const a=cap((.32-e.shot)/.32,0,1);
   ctx.save();ctx.globalAlpha=a*.7;ctx.strokeStyle='#ffcaef';ctx.shadowColor='#d78dff';ctx.shadowBlur=9;ctx.lineWidth=1.4;ctx.beginPath();ctx.arc(e.x,yy,e.r*(1.05+.14*a),0,Math.PI*2);ctx.stroke();ctx.restore();
 }
 if(e.c2Role==='charge'&&!e.chargeState){ctx.save();ctx.globalAlpha=.42;ctx.strokeStyle='#ffd39e';ctx.lineWidth=1.6;ctx.beginPath();ctx.arc(e.x,yy,e.r+2,0,6.28);ctx.stroke();ctx.restore();}
 if(e.chargeState==='dash'){ctx.save();ctx.globalAlpha=.26;ctx.strokeStyle='#ffe0aa';ctx.lineWidth=3;ctx.beginPath();ctx.arc(e.x,e.y,e.r+8,0,Math.PI*2);ctx.stroke();ctx.restore();}
 if(e.type==='runner'&&e.entry<=0){ctx.save();ctx.globalAlpha=.12;sprite(art,e.x,yy+4,w*sc,h*sc,false,tilt,.12);ctx.restore();}
 sprite(art,e.x,yy,w*sc,h*sc,false,tilt,hit?.80:1);
 if(hit){ctx.save();ctx.globalAlpha=cap(e.hit/.1,0,1)*.7;ctx.strokeStyle='#fff7ed';ctx.lineWidth=2;ctx.beginPath();ctx.arc(e.x,yy,e.r+3,0,Math.PI*2);ctx.stroke();ctx.restore();}
 if((isBoss||e.hp<e.max)&&!e.doomed){const bh=e.y-h*.48-12,bw=e.r*2.3;ctx.fillStyle='#493249b5';ctx.fillRect(e.x-bw/2,bh,bw,5);ctx.fillStyle=ch2art?'#a8dfff':'#ff91b7';ctx.fillRect(e.x-bw/2,bh,bw*cap(e.hp/e.max,0,1),5);}
 ctx.restore();
}
function drawOverloadBack(p,glow){if(glow<=.01)return;ctx.save();ctx.globalAlpha=glow;const pulse=1+.035*Math.sin(fxTime*7);ctx.strokeStyle='#aabfff8f';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(p.x,p.y+17,41*pulse,14*pulse,0,0,6.28);ctx.stroke();for(let i=0;i<5;i++){const a=fxTime*2.4+i*1.256;ctx.fillStyle=i%2?'#e4c9ff':'#bceaff';ctx.globalAlpha=glow*(.36+.18*Math.sin(a*2));ctx.beginPath();ctx.ellipse(p.x+Math.cos(a)*40,p.y+17+Math.sin(a)*12,3.4,2.0,a,0,6.28);ctx.fill()}ctx.restore()}
function drawWeaponFx(p,mount){const glow=cap(p.superGlow||0,0,1),flash=cap((p.muzzleFlash||0)/.09,0,1);ctx.save();ctx.translate(mount.muzzleX,mount.muzzleY);ctx.rotate(mount.angle);ctx.globalCompositeOperation='screen';ctx.shadowColor=glow>.05?'#c7a8ff':'#76dcff';ctx.shadowBlur=5+glow*9+flash*3;ctx.globalAlpha=.42+.34*glow+.18*flash;ctx.fillStyle=glow>.05?'#d8c5ff':'#bceeff';ctx.beginPath();ctx.ellipse(-mount.recoil*.55,0,2.7+glow*1.3,3.5+glow*1.4,0,0,6.28);ctx.fill();if(glow>.02){ctx.globalAlpha=.22*glow;ctx.strokeStyle='#d8c6ff';ctx.lineWidth=1.2;ctx.beginPath();ctx.arc(0,0,7+Math.sin(fxTime*8)*1.2,0,6.28);ctx.stroke()}if(flash>0){ctx.globalAlpha=flash*(.72+.16*glow);ctx.fillStyle=glow>.05?'#ead5ff':'#e0f8ff';ctx.beginPath();ctx.moveTo(0,-3.8*flash);ctx.lineTo(9.5*flash,0);ctx.lineTo(0,3.8*flash);ctx.closePath();ctx.fill();ctx.globalAlpha=flash*.86;ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(0,0,1.7+flash,0,6.28);ctx.fill()}ctx.restore()}
function drawPlayer(){if(!s)return;const p=s.p,v=playerVisual(p),dir=p.facing===-1?-1:1,mount=cameraMount(p),hitBlink=v.pose==='hit'&&Math.floor(fxTime*28)%2===0;
 ctx.save();ctx.fillStyle='#12132399';ctx.beginPath();ctx.ellipse(p.x,p.y+29,24,6.5,0,0,6.28);ctx.fill();
 if(v.pose==='dash'){for(let i=2;i>=1;i--){ctx.save();ctx.globalAlpha=i===2?.11:.20;ctx.shadowColor='#bca7ff';ctx.shadowBlur=6;sprite(v.sprite,p.x-i*p.dashVX*.017,p.y+v.centerY-i*p.dashVY*.017,v.w,v.h,dir<0);ctx.restore()}}
 ctx.save();ctx.shadowColor='#111522';ctx.shadowBlur=4.5;ctx.shadowOffsetY=2;sprite(v.sprite,p.x+v.x,p.y+v.centerY,v.w,v.h,dir<0,0,hitBlink?.58:1);ctx.restore();
 if(v.pose==='hit'){ctx.save();ctx.globalAlpha=.36;ctx.strokeStyle='#ffbad1';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(p.x,p.y-8,31,0,6.28);ctx.stroke();ctx.restore()}
 drawWeaponFx(p,mount);ctx.restore();}
function cinemaBars(alpha=.9){ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle='#05070d';ctx.fillRect(0,0,W,54);ctx.fillRect(0,H-54,W,54);ctx.restore()}
function drawCinemaText(title,sub,small='轻触屏幕可跳过'){ctx.save();ctx.textAlign='center';ctx.shadowColor='#000';ctx.shadowBlur=16;ctx.fillStyle='#fff8ef';ctx.font='900 26px system-ui';ctx.fillText(title,W/2,H-108);ctx.font='700 12px system-ui';ctx.fillStyle='#f4deec';ctx.fillText(sub,W/2,H-84);ctx.font='700 11px system-ui';ctx.fillStyle='#d8cfe3';ctx.fillText(small,W/2,30);ctx.restore()}
function drawIntro(){const t=introTimer;const scene=sceneIndex();ctx.save();background(scene);if(t<2.15){ctx.save();ctx.globalAlpha=cap(t/.9,0,1);ctx.fillStyle='rgba(255,255,255,.12)';ctx.beginPath();ctx.arc(W*.5,H*.4,44+Math.sin(t*3)*4,0,6.28);ctx.fill();ctx.restore();drawCinemaText('百合花庭','白雾安静，狐火正在苏醒');ctx.save();ctx.globalAlpha=.95;ctx.textAlign='center';ctx.fillStyle='#fff';ctx.font='900 36px system-ui';ctx.fillText('百合快门',W/2,H*.52);ctx.font='700 14px system-ui';ctx.fillStyle='#ffe7f3';ctx.fillText('LILY SHUTTER',W/2,H*.52+28);ctx.restore();}
 else if(t<4.45){const k=cap((t-2.15)/1.2,0,1);ctx.save();ctx.globalAlpha=.38+.62*k;sprite('fox_boss',W*.5,H*.35-16*Math.cos(t*2),220+40*k,250+48*k,false,0);ctx.restore();ctx.save();ctx.fillStyle='rgba(255,98,160,'+(.18+.12*Math.sin(t*5))+')';ctx.fillRect(0,0,W,H);ctx.restore();drawCinemaText('狐火苏醒','九尾妖王在花庭深处睁眼');}
 else{const k=cap((t-4.45)/1.4,0,1);ctx.save();ctx.globalAlpha=.55+.45*k;sprite('fox_boss',W*.72,H*.28,195,220,true,0);ctx.restore();const introW=130+10*k,introH=introW*HERO_BODY.h/HERO_BODY.w,introX=W*.29,introY=H*.64+(1-k)*15;ctx.save();ctx.globalAlpha=.45+.55*k;sprite('bai_li_main_v11',introX,introY,introW,introH,false,0);ctx.restore();ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=.25+.55*k;ctx.shadowColor='#7db9ff';ctx.shadowBlur=9+9*k;ctx.fillStyle='#c8e9ff';ctx.beginPath();ctx.arc(introX+(HERO_BODY.muzzle[0]-.5)*introW,introY+(HERO_BODY.muzzle[1]-.5)*introH,3.8+1.3*k,0,6.283);ctx.fill();ctx.restore();drawCinemaText('举起快门','把疯狂的花庭，拍成自己的战场');}
 cinemaBars(.92);const flash=t>6.65?cap((t-6.65)/.5,0,1):0;if(flash>0){ctx.fillStyle='rgba(255,255,255,'+(flash*.85)+')';ctx.fillRect(0,0,W,H)}ctx.restore()}
function drawBossIntro(){
 if(!isChapter2())return drawBossIntroCh1();
 const o=bossOpening,p=s.p,t=bossIntroTimer;
 ctx.save();if(shake>0)ctx.translate(rand(-shake,shake),rand(-shake,shake));background(3);
 const b=enemies.find(e=>e.finalBoss);if(b)drawEnemy(b);
 if(o){
  // Charge flashes clearly precede each of the three ice strikes.
  const next=o.hits<3?RABBIT_OPENER.impacts[o.hits]:Infinity;
  if(next-t<.37&&next>t){const a=cap(1-(next-t)/.37,0,1);
   ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=.23+.49*a;
   ctx.strokeStyle='#afeaff';ctx.shadowColor='#a1e3ff';ctx.shadowBlur=16+12*a;
   ctx.lineWidth=3+5*a;ctx.beginPath();ctx.arc(b?.x??W*.5,(b?.y??H*.27)+35,21+18*a,0,Math.PI*2);ctx.stroke();ctx.restore();
  }
  if(o.guarded){
   // Before the first strike the fox is visible; on contact it becomes the shared foxfire ring.
   if(o.hits===0){const fx=cap(p.x+49,70,W-38),fy=p.y-91;
    ctx.save();ctx.globalAlpha=.93;ctx.shadowColor='#ffb36f';ctx.shadowBlur=20;
    sprite('fox_companion',fx,fy,84,84,false,Math.sin(t*5)*.03);ctx.restore();}
   if(o.healStarted){
    const a=cap((t-RABBIT_OPENER.healStart)/(RABBIT_OPENER.healEnd-RABBIT_OPENER.healStart),0,1);
    ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=(1-a)*.47;
    ctx.fillStyle='#ffd59b';ctx.beginPath();ctx.ellipse(p.x,p.y-40,48+78*a,48+95*a,0,0,Math.PI*2);ctx.fill();ctx.restore();
   }
  }
  if(o.fallen){
   ctx.save();ctx.globalAlpha=.34+.11*Math.sin(t*9);ctx.fillStyle='#a6dfff';
   ctx.beginPath();ctx.ellipse(p.x,p.y-9,47,15,0,0,Math.PI*2);ctx.fill();ctx.restore();
  }
 }
 ctx.save();if(o?.fallen){ctx.globalAlpha=.62;ctx.translate(p.x,p.y-15);ctx.rotate(-.17);ctx.translate(-p.x,-(p.y-15));}
 drawPlayer();ctx.restore();
 drawFoxGuard();
 // Cinematic beams have three rising power levels, with icy shards and a distinct shield clash.
 const pulse=o?.pulse||0;
 if(pulse>0){
  const a=cap(pulse/.42,0,1),guarded=!!o?.guarded,hit=o?.hits||1;
  const srcX=b?.x??W*.5,srcY=(b?.y??H*.28)+48,dstX=p.x,dstY=p.y-66;
  const width=[0,11,19,31][hit]||11;
  ctx.save();ctx.globalCompositeOperation='screen';
  ctx.fillStyle='rgba(161,220,255,'+(a*(hit===3?.24:.085))+')';ctx.fillRect(0,0,W,H);
  ctx.lineCap='round';ctx.shadowColor='#83dfff';ctx.shadowBlur=29+hit*13;
  ctx.strokeStyle='#66d3ff';ctx.lineWidth=width+17;
  ctx.beginPath();ctx.moveTo(srcX,srcY);ctx.lineTo(dstX,dstY);ctx.stroke();
  ctx.shadowColor='#d5f7ff';ctx.shadowBlur=23;ctx.strokeStyle='#c4f1ff';ctx.lineWidth=width;
  ctx.beginPath();ctx.moveTo(srcX,srcY);ctx.lineTo(dstX,dstY);ctx.stroke();
  ctx.strokeStyle='#ffffff';ctx.shadowBlur=8;ctx.lineWidth=3+hit*2;
  ctx.beginPath();ctx.moveTo(srcX,srcY);ctx.lineTo(dstX,dstY);ctx.stroke();
  ctx.strokeStyle=guarded?'#ffe4a4':'#daeeff';ctx.shadowColor=guarded?'#ff9d6c':'#a3e3ff';ctx.shadowBlur=24;
  ctx.lineWidth=3+hit*3;ctx.beginPath();ctx.arc(dstX,dstY,29+hit*5+(1-a)*36,0,Math.PI*2);ctx.stroke();
  // Ice splinters burst radially around the guarded player, with a larger third-hit shatter.
  for(let j=0;j<7+hit*5;j++){
   const ang=j*2.399963+hit*.77,rad=(26+hit*5)+(1-a)*(45+hit*22),x=dstX+Math.cos(ang)*rad,y=dstY+Math.sin(ang)*rad;
   ctx.save();ctx.translate(x,y);ctx.rotate(ang);ctx.fillStyle=j%3===0?'#f3fdff':'#9de5ff';
   ctx.beginPath();ctx.moveTo(12+hit*3,0);ctx.lineTo(-8,-2.5);ctx.lineTo(-5,3);ctx.closePath();ctx.fill();ctx.restore();
  }
  ctx.restore();
 }
 if(o?.guarded&&o.hits===3&&t-RABBIT_OPENER.impacts[2]<.14){
  const hold=1-(t-RABBIT_OPENER.impacts[2])/.14;
  ctx.save();ctx.globalCompositeOperation='screen';ctx.fillStyle=`rgba(255,225,191,${.16*hold})`;ctx.fillRect(0,0,W,H);
  ctx.strokeStyle='#fff1c4';ctx.shadowColor='#ff9d77';ctx.shadowBlur=30;ctx.lineWidth=3+7*hold;
  ctx.beginPath();ctx.arc(p.x,p.y-66,41+46*(1-hold),0,Math.PI*2);ctx.stroke();ctx.restore();
 }
 for(const f of rings){ctx.save();ctx.globalAlpha=cap(f.t/f.life,0,1);ctx.strokeStyle=f.color;ctx.lineWidth=4;ctx.beginPath();ctx.arc(f.x,f.y,f.r,0,6.283);ctx.stroke();ctx.restore();}
 for(const f of particles){ctx.save();ctx.globalAlpha=cap(f.t*2,0,1);ctx.fillStyle=f.color;ctx.beginPath();ctx.ellipse(f.x,f.y,f.r,f.r*.5,0,0,6.283);ctx.fill();ctx.restore();}
 ctx.restore();
}
function drawBossIntroCh1(){ctx.save();background(3);const b=enemies.find(e=>e.finalBoss)||enemies.find(e=>e.type==='boss');if(b)drawEnemy(b);drawPlayer();for(const f of particles){ctx.save();ctx.globalAlpha=cap(f.t*2,0,1);ctx.fillStyle=f.color;ctx.translate(f.x,f.y);ctx.rotate(f.vx*.01);ctx.beginPath();ctx.ellipse(0,0,f.r,f.r*.43,0,0,6.28);ctx.fill();ctx.restore()}cinemaBars(.88);ctx.save();ctx.textAlign='center';ctx.shadowColor='#000';ctx.shadowBlur=18;ctx.fillStyle='#ffcfe5';ctx.font='800 13px system-ui';ctx.fillText('FINAL ENCOUNTER',W/2,H*.66);ctx.fillStyle='#fff6ea';ctx.font='900 30px system-ui';ctx.fillText(isChapter2()?'雪影兔王':'九尾妖王',W/2,H*.66+34);ctx.fillStyle='#ffd6e8';ctx.font='700 13px system-ui';ctx.fillText(isChapter2()?'霜境之主 · 月影苏醒':'花庭之主 · 业焰苏醒',W/2,H*.66+58);ctx.fillStyle='#d8cfe3';ctx.font='700 11px system-ui';ctx.fillText('轻触屏幕可跳过',W/2,30);ctx.restore();ctx.restore()}
function drawGame(){ctx.save();if(shake>0){ctx.translate(rand(-shake,shake),rand(-shake,shake))}background();
 for(const h of hazards){ctx.save();ctx.globalAlpha=h.strike?.87:.26+.16*Math.sin(fxTime*22);ctx.fillStyle=h.strike?'#ff437a':'#ef4c8e';ctx.fillRect(h.x-(h.strike?20:13),0,h.strike?40:26,H);ctx.strokeStyle='#ffc5d7';ctx.lineWidth=2;ctx.setLineDash([13,11]);ctx.beginPath();ctx.moveTo(h.x,0);ctx.lineTo(h.x,H);ctx.stroke();ctx.setLineDash([]);ctx.restore()}
 // Warnings are visually different from old pink hazards, and can always be dodged.
 for(const w of ringWarnings){const progress=cap(1-w.t/C2_BALANCE.ringWarning,0,1);
  ctx.save();ctx.globalAlpha=.4+.45*progress;ctx.strokeStyle='#d9c2ff';ctx.lineWidth=3;
  ctx.setLineDash([7,6]);ctx.beginPath();ctx.arc(w.x,w.y,w.r,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
  ctx.lineWidth=5;ctx.strokeStyle='#b5ffd6';ctx.beginPath();ctx.arc(w.x,w.y,w.r-3,w.gap-.35,w.gap+.35);ctx.stroke();ctx.restore();}
 for(const w of splitWarnings){const progress=cap(1-w.t/C2_BALANCE.splitWarning,0,1);
  ctx.save();ctx.globalAlpha=.45+.50*progress;ctx.strokeStyle='#ffd6a6';ctx.shadowColor='#ffbb77';ctx.shadowBlur=12;
  ctx.lineWidth=4;ctx.setLineDash([8,7]);ctx.beginPath();ctx.moveTo(w.x,w.y+16);ctx.lineTo(w.targetX,w.targetY);ctx.stroke();ctx.setLineDash([]);
  ctx.beginPath();ctx.arc(w.x,w.y,13+8*progress,0,Math.PI*2);ctx.stroke();ctx.restore();}
 for(const e of enemies){if(e.chargeState==='windup'){
   const progress=cap(1-e.chargeTimer/(e.type==='boss'?C2_BALANCE.bossWarning:C2_BALANCE.chargeWarning),0,1);
   ctx.save();ctx.globalAlpha=.48+.42*progress;ctx.strokeStyle='#ffe1a0';ctx.shadowColor='#ffb564';ctx.shadowBlur=7;
   ctx.lineWidth=(e.type==='boss'?22:11);ctx.setLineDash([13,10]);ctx.beginPath();ctx.moveTo(e.x,e.y);
   const reach=(e.type==='boss'?C2_BALANCE.bossSpeed*C2_BALANCE.bossDuration:C2_BALANCE.chargeSpeed*C2_BALANCE.chargeDuration)*C2_BALANCE.enemyMoveScale;
   ctx.lineTo(e.x+e.chargeVX*reach,e.y+e.chargeVY*reach);ctx.stroke();ctx.setLineDash([]);
   ctx.strokeStyle='#fff4d2';ctx.lineWidth=2;ctx.beginPath();ctx.arc(e.x,e.y,e.r+5+3*progress,0,Math.PI*2);ctx.stroke();ctx.restore();
  }}
 for(const e of enemies)drawEnemy(e);
 drawFoxCompanion();drawFoxAssistFx();
 for(const b of shots){
   // compact shutter droplet: white hot leading tip + colored tapered light trail
   const speed=Math.hypot(b.vx,b.vy)||1,ux=b.vx/speed,uy=b.vy/speed;
   const overloaded=b.superShot,crit=b.critical;
   const L=overloaded?16:crit?14:12,R=overloaded?3.5:crit?3.1:2.6;
   const x=b.x,y=b.y;
   ctx.save();ctx.translate(x,y);ctx.rotate(Math.atan2(uy,ux));
   ctx.shadowColor=b.color;ctx.shadowBlur=overloaded?10:6;
   ctx.globalAlpha=.68;ctx.fillStyle=b.color;
   ctx.beginPath();ctx.moveTo(3.2,0);ctx.quadraticCurveTo(-L*.46,R,-L,0);ctx.quadraticCurveTo(-L*.46,-R,3.2,0);ctx.fill();
   ctx.shadowBlur=3;ctx.globalAlpha=.97;ctx.fillStyle=crit?'#fff3d7':'#f5fcff';ctx.beginPath();ctx.ellipse(1.7,0,3.1,1.9,0,0,Math.PI*2);ctx.fill();ctx.restore();
 }
 for(const b of hostile){
  if(b.c2Kind){ctx.save();ctx.shadowColor=b.c2Kind==='ring'?'#a890ff':b.c2Kind==='frost'?'#8feaff':'#ffc36c';ctx.shadowBlur=9;
   ctx.fillStyle=b.c2Kind==='ring'?'#d3bdff':b.c2Kind==='frost'?'#bbf2ff':b.c2Kind==='split'?'#ffe4b1':'#ffd59c';
   ctx.beginPath();ctx.arc(b.x,b.y,b.c2Kind==='split'?9:5.8,0,6.28);ctx.fill();
   ctx.fillStyle='#fff7e5';ctx.beginPath();ctx.arc(b.x,b.y,2.4,0,6.28);ctx.fill();ctx.restore();
  }else if(isChapter2()){ctx.save();ctx.shadowColor='#8cdbff';ctx.shadowBlur=13;ctx.fillStyle='#a9e9ff';ctx.beginPath();ctx.moveTo(b.x,b.y-10);ctx.lineTo(b.x+8,b.y);ctx.lineTo(b.x,b.y+10);ctx.lineTo(b.x-8,b.y);ctx.closePath();ctx.fill();ctx.restore();}else{sprite('fox_orb',b.x,b.y,24,23,false,fxTime*2);ctx.save();ctx.strokeStyle='#ff81be87';ctx.shadowColor='#ff56a8';ctx.shadowBlur=10;ctx.lineWidth=2;ctx.beginPath();ctx.arc(b.x,b.y,8,0,6.29);ctx.stroke();ctx.restore();}}

 drawPlayer();drawFoxGuard();
 for(const e of rings){ctx.save();ctx.globalAlpha=cap(e.t/e.life,0,1);ctx.strokeStyle=e.color;ctx.lineWidth=4;ctx.beginPath();ctx.arc(e.x,e.y,e.r,0,6.28);ctx.stroke();ctx.restore()}
 for(const f of particles){ctx.save();ctx.globalAlpha=cap(f.t*2,0,1);ctx.fillStyle=f.color;ctx.translate(f.x,f.y);ctx.rotate(f.vx*.01);ctx.beginPath();ctx.ellipse(0,0,f.r,f.r*.43,0,0,6.28);ctx.fill();ctx.restore()}
 for(const f of texts){ctx.save();ctx.globalAlpha=cap(f.life*2,0,1);ctx.fillStyle=f.color;ctx.shadowColor='#343b58';ctx.shadowBlur=4;ctx.font='900 16px system-ui';ctx.textAlign='center';ctx.fillText(f.msg,f.x,f.y);ctx.restore()}
 ctx.restore();}
function drawWaveClear(){drawGame();ctx.save();const t=waveClearTimer;ctx.fillStyle='rgba(17,18,33,'+(0.25+0.18*Math.sin((1.42-t)*2))+')';ctx.fillRect(0,0,W,H);ctx.textAlign='center';ctx.shadowColor='#030511';ctx.shadowBlur=14;ctx.fillStyle='#ffe7f4';ctx.font='800 13px system-ui';ctx.fillText('WAVE '+String(waveClearInfo?.wave||1).padStart(2,'0')+' COMPLETE',W*.5,H*.32);ctx.fillStyle='#fff6e6';ctx.font='900 29px system-ui';ctx.fillText('第'+(waveClearInfo?.wave||1)+'波 · 清剿完成',W*.5,H*.38);ctx.font='700 15px system-ui';ctx.fillStyle='#e2eaf4';ctx.fillText('击破 '+(waveClearInfo?.kills||0)+(isChapter2()&&localWave()===7?'  ·  带着当前生命迎战兔王':'  ·  下一波生命恢复 +14'),W*.5,H*.44);if([2,4,7].includes(((waveClearInfo?.wave||1)-1)%8+1)){ctx.font='700 13px system-ui';ctx.fillStyle='#f9b9dd';const stage=((waveClearInfo.wave-1)%8)+1;const next=isChapter2()?(stage===7?'下一波：月影祭坛 · 雪影兔王':stage===4?'下一波：风雪回廊': '下一波：分裂弹兔妖'):(stage===2?'下一波：高速狐突袭 · 破碎庭院':stage===4?'下一波：密集狐潮 · 幻影花海':'最终目标：九尾祭坛');ctx.fillText(next,W*.5,H*.49);}ctx.restore();}
function drawBossDefeat(){drawGame();ctx.save();ctx.globalAlpha=.90;sprite(isChapter2()?'rabbit_boss':'fox_boss',W*.5,H*.34+14*(1-bossDefeatTimer/2.3),isChapter2()?216:180,isChapter2()?169:195,false,0,.9);ctx.restore();ctx.save();const progress=1-bossDefeatTimer/2.3;ctx.fillStyle='rgba(255,235,247,'+(progress<.3?progress*.72:.18)+')';ctx.fillRect(0,0,W,H);ctx.textAlign='center';ctx.shadowColor='#000';ctx.shadowBlur=15;ctx.fillStyle='#fff0e2';ctx.font='900 34px system-ui';ctx.fillText(isChapter2()?'雪影契约 · 缔结':'九尾契约 · 缔结',W/2,H*.35);ctx.fillStyle='#fde6f1';ctx.font='700 14px system-ui';ctx.fillText(isChapter2()?'雪影兔王俯首，霜境归于白璃。':'九尾妖王俯首，花庭归于白璃。',W/2,H*.40);ctx.restore();}
function drawTransition(){
 if(!transition)return;const {kind,t,duration}=transition,k=cap(t/duration,0,1);
 ctx.save();
 if(kind==='opening'){ctx.fillStyle=`rgba(244,251,255,${k<.23?1:Math.pow(1-(k-.23)/.77,1.5)})`;ctx.fillRect(0,0,W,H);
  ctx.globalAlpha=(1-k)*.82;ctx.shadowColor='#85c9ff';ctx.shadowBlur=35;ctx.fillStyle='#e7f8ff';ctx.beginPath();ctx.arc(s.p.x,s.p.y-65,15+100*k,0,Math.PI*2);ctx.fill();}
 else if(kind==='victory'){ctx.fillStyle=`rgba(252,176,205,${.08+.65*k})`;ctx.fillRect(0,0,W*k,H);for(let i=0;i<9;i++){ctx.fillStyle=i%2?'#ffc492':'#ffdfb9';ctx.globalAlpha=.25+.5*k;ctx.beginPath();ctx.ellipse(W*k-30-i*18,(i+.5)*H/9,25+30*k,45+25*k,.6,0,Math.PI*2);ctx.fill();}}
 else {const alpha=kind==='chapter'?.85*k:.78*(1-k);ctx.fillStyle=`rgba(206,223,253,${alpha})`;ctx.fillRect(0,0,W,H);ctx.globalAlpha=alpha;for(let i=0;i<11;i++){ctx.fillStyle=i%2?'#f6aed7':'#b3e6ff';ctx.beginPath();ctx.arc((i*83+t*160)%W,(i*129)%H,8+i%3*6,0,Math.PI*2);ctx.fill();}}
 ctx.restore();
}
function draw(){if(mode==='waveClear')return drawWaveClear();if(mode==='bossDefeat')return drawBossDefeat();if(mode==='intro')return drawIntro();if(mode==='bossIntro')return drawBossIntro();drawGame();if(mode==='transition')drawTransition();}
function updateCinema(dt){fxTime+=dt;
 if(mode==='transition'){if(!transition)return;transition.t+=Math.min(dt,.055);const k=cap(transition.t/transition.duration,0,1);$('app').style.setProperty?.('--scene-ui-opacity',transition.kind==='victory'?1-k:transition.kind==='chapter'?0:k);if(transition.t>=transition.duration)finishTransition();return;}
 if(mode==='bossIntro'&&isChapter2()){
  bossIntroTimer+=dt;
  s.p.hitTTL=Math.max(0,s.p.hitTTL-dt);shake=Math.max(0,shake-dt*60);
  for(let i=particles.length-1;i>=0;i--){const f=particles[i];f.x+=f.vx*dt;f.y+=f.vy*dt;f.t-=dt;if(f.t<=0)particles.splice(i,1);}
  for(let i=rings.length-1;i>=0;i--){const f=rings[i];f.r+=f.speed*dt;f.t-=dt;if(f.t<=0)rings.splice(i,1);}
  const b=enemies.find(e=>e.finalBoss);
  if(b){b.age+=dt;b.entry=0;b.x=W*.5;b.y=-120+Math.min(1,bossIntroTimer/RABBIT_OPENER.land)*(H*.27+120);}
  if(bossOpening){
   const o=bossOpening;
   o.pulse=Math.max(0,o.pulse-dt);
   while(o.hits<3&&bossIntroTimer>=RABBIT_OPENER.impacts[o.hits])rabbitOpeningImpact();
   if(foxGuard?.opening){
    foxGuard.ttl=Math.max(0,FOX_GUARD_DURATION-(bossIntroTimer-RABBIT_OPENER.impacts[0]));
    foxGuard.pulse=Math.max(0,foxGuard.pulse-dt);
    if(foxGuard.ttl<=0){foxGuard=null;sparkle(s.p.x,s.p.y-49,'#ffdda8',22,.58);}
   }
   if(o.guarded&&o.hits===3&&bossIntroTimer>=RABBIT_OPENER.healStart){
    o.healStarted=true;
    const a=cap((bossIntroTimer-RABBIT_OPENER.healStart)/(RABBIT_OPENER.healEnd-RABBIT_OPENER.healStart),0,1);
    s.p.hp=o.healFrom+(o.healTo-o.healFrom)*a;
    ui();
   }
   if(bossIntroTimer>=RABBIT_OPENER.end)finishBossIntro();
  }
  return;
 }
 if(mode==='intro'){introTimer+=dt;if(introTimer>=7.1)finishIntro();return;}
 if(mode==='bossIntro'){bossIntroTimer+=dt;const b=enemies.find(e=>e.finalBoss)||enemies.find(e=>e.type==='boss');if(b){b.age+=dt;b.entry=0;b.x=W*.5+Math.sin(Math.max(0,bossIntroTimer-1.2)*1.2)*40;b.y=Math.min(H*.30,-90+Math.min(1,bossIntroTimer/.9)*(H*.30+90));if(bossIntroTimer>.9&&particles.length<140&&Math.random()<.6)sparkle(b.x+rand(-30,30),b.y+rand(-10,40),'#ff9ccf',3,.45)}if(bossIntroTimer>=3.4)finishBossIntro();}
}
function resize(){const rect=cvs.getBoundingClientRect();if(!rect.width||!rect.height)return;let nextH=390*rect.height/rect.width;H=nextH;const d=Math.min(window.devicePixelRatio||1,2);DPR=d;const iw=Math.max(1,Math.round(rect.width*d)),ih=Math.max(1,Math.round(rect.height*d));if(cvs.width!==iw||cvs.height!==ih){cvs.width=iw;cvs.height=ih;}ctx.setTransform(iw/W,0,0,ih/H,0,0);if(s){s.p.y=cap(s.p.y,H*.49,H-115);s.p.x=cap(s.p.x,48,W-48)}}
function loop(ts){const dt=last?cap((ts-last)/1000,0,.04):.016;last=ts;try{if(mode==='intro'||mode==='bossIntro'||mode==='transition')updateCinema(dt);else if(mode==='waveClear'||mode==='bossDefeat')advanceInterlude(dt);else update(dt);updateMusic(dt);if(!['storyVideo','error'].includes(mode))draw();}catch(e){console.error('game loop:',e);$('error').hidden=false;$('error').textContent='游戏遇到错误：'+(e.message||e);mode='error';}requestAnimationFrame(loop)}
function pos(ev){const r=cvs.getBoundingClientRect();return {x:(ev.clientX-r.left)/r.width*W,y:(ev.clientY-r.top)/r.height*H,rx:ev.clientX-r.left,ry:ev.clientY-r.top}}
function changeTouch(ev){if(mode!=='play'||touch.id!==ev.pointerId)return;const p=pos(ev),dx=p.x-touch.originX,dy=p.y-touch.originY,m=len(dx,dy);const strength=Math.min(1,m/39);touch.vx=m?dx/m*strength:0;touch.vy=m?dy/m*strength:0;rememberDirection(movement());$('stick-knob').style.transform=`translate(${touch.vx*30}px,${touch.vy*30}px)`}
cvs.addEventListener('pointerdown',ev=>{if(mode==='intro'||mode==='bossIntro'){ev.preventDefault();skipCinema();return;}if(mode!=='play'||touch.id!==null)return;ev.preventDefault();const p=pos(ev);touch.id=ev.pointerId;touch.originX=p.x;touch.originY=p.y;$('joystick').style.left=p.rx+'px';$('joystick').style.top=p.ry+'px';$('joystick').style.display='block';$('touch-help').style.opacity='.24';try{cvs.setPointerCapture(ev.pointerId)}catch(e){}changeTouch(ev)});
cvs.addEventListener('pointermove',changeTouch);for(const event of ['pointerup','pointercancel','lostpointercapture'])cvs.addEventListener(event,ev=>{if(touch.id===ev.pointerId)resetInput()});
// Fire skills as soon as a second finger touches them, without releasing the movement pointer.
function activateSkill(id){if(id==='dash')return useDash();if(id==='bomb')return useBomb();if(id==='burst')return useBurst();return false;}
$('skills').addEventListener('pointerdown',ev=>{const b=ev.target.closest('button.skill');if(!b||b.disabled||ev.button>0)return;ev.preventDefault();ev.stopPropagation();activateSkill(b.id);});
if(storyVideoLayer&&storyVideoSkip){storyVideoLayer.addEventListener('pointerdown',ev=>{if(ev.target===storyVideoSkip)return;ev.preventDefault();skipStoryVideo();});storyVideoSkip.addEventListener('pointerdown',ev=>{ev.preventDefault();ev.stopPropagation();skipStoryVideo();});}
// `click` is kept for keyboard/screen-reader activation, but not repeated after pointerdown.
$('app').addEventListener('click',ev=>{const b=ev.target.closest('button');if(!b)return;const id=b.id;if(id==='start')startRun();else if(id==='continue-adventure')continueAdventure();else if(id==='retry-chapter2')retryChapter2();else if(id==='restart')restartRun();else if(id==='home')menu();else if(id==='details')$('end-details').hidden=false;else if(id==='close-details')$('end-details').hidden=true;else if(id==='resume')resume();else if(id==='music-toggle'){musicEnabled=!musicEnabled;b.textContent='♫ 音乐：'+(musicEnabled?'开':'关');if(!musicEnabled&&musicGain)musicGain.gain.value=0;}else if(id==='pause')pause();else if(id==='dash'||id==='bomb'||id==='burst'){if(ev.detail===0)activateSkill(id);}else if(b.dataset.up!=null)choose(Number(b.dataset.up));});
// WASD/arrows move; Space=Dash, J=Freeze, K=Overload. Does not interfere with touch.
document.addEventListener('keydown',ev=>{const code=ev.code;if(!movementKeys.has(code)&&!['Space','KeyJ','KeyK'].includes(code))return;if(ev.ctrlKey||ev.metaKey||ev.altKey||mode!=='play')return;if(ev.target&&ev.target.closest('input,textarea,select,[contenteditable]'))return;ev.preventDefault();if(movementKeys.has(code)){keysDown.add(code);rememberDirection(movement());return;}if(ev.repeat)return;if(code==='Space')useDash();else if(code==='KeyJ')useBomb();else if(code==='KeyK')useBurst();});
document.addEventListener('keyup',ev=>{if(movementKeys.has(ev.code))keysDown.delete(ev.code);});
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(musicGain)musicGain.gain.value=0;if(mode==='play'){keysDown.clear();pause();}}});window.addEventListener('blur',()=>{keysDown.clear();if(musicGain)musicGain.gain.value=0;if(mode==='play')pause()});window.addEventListener('resize',resize);
// Read-only QA/automated-play interface; time can be simulated without a running animation frame.
window.__gameQA={start:begin,chapter2:beginChapter2,continueAdventure,retryChapter2,showChapterVictory,startRun,finishStoryVideo,chapter2Grade:gradeRun,chapter2Result:chapter2End,testHit:(d)=>{hurt(d);return s?.p.hp},testHP:(hp)=>{if(s){s.p.hp=cap(hp,1,s.p.max);ui();return s.p.hp;}return null},debugDamage:(index,amount)=>{const e=enemies[index];if(!e)return false;damageEnemy(e,amount,'skill');return true},debugStun:(index,seconds)=>{if(enemies[index])enemies[index].stun=seconds},debugNoFire:(seconds)=>{s.p.fire=seconds},debugMoveFoe:(i,x,y)=>{const e=enemies[i];if(!e)return false;e.x=x;e.y=y;e.entry=0;return true},restart:restartRun,debugSetBombs:(n)=>{s.p.bombs=n;ui()},debugAddHostile:(b)=>{hostile.push({...b});},debugClearBoss:()=>{if(mode!=='play')return false;s.wave=8;enemies=[];spawnLeft=0;bossCreated=true;startBossDefeat();return true},debugBulletHit:(index,amount)=>{const e=enemies[index];if(!e)return false;damageEnemy(e,amount,'bullet');return true},pause,debugMaxHP:(max,hp)=>{s.p.max=max;s.p.hp=hp;ui()},debugEnterBoss:()=>{if(!isChapter2())return false;s.wave=16;enemies=[];hostile=[];shots=[];spawnLeft=0;bossCreated=true;createEnemy('boss');startBossIntro();ui();return true},testSpawn:(kind='basic')=>{if(mode==='play'){const e=createEnemy(kind);e.x=W*.52;e.y=H*.42;e.entry=0;return e.type;}return null},naturalSpawn:(kind='runner')=>{if(mode!=='play')return null;return createEnemy(kind).type;},cinema:startRun,skipCinema,previewIntro:(t=5.4)=>{startIntro();introTimer=t;draw();return true},uiDetails:()=>{const e=$('end-details');return e?{hidden:e.hidden}:null},previewEnd:(win)=>end(!!win),render:draw,debugFire:()=>{if(s&&mode==='play'){fire();return true}return false},debugBurst:()=>{if(s){s.p.charge=100;ui();return useBurst()}return false},debugHit:()=>{if(s&&mode==='play'){s.p.hitTTL=.14;return true}return false},debugFacing:(dir)=>{if(s){s.p.facing=dir<0?-1:1;return s.p.facing}return 0},tick:(dt)=>{if(mode==='waveClear'||mode==='bossDefeat')advanceInterlude(dt);else if(mode==='intro'||mode==='bossIntro'||mode==='transition')updateCinema(dt);else update(dt);updateMusic(dt)},audio:()=>({enabled:musicEnabled,loaded:!!musicBuffer,playing:!!musicSource,gain:musicGain?.gain.value||0,loadError:musicError,musicVolume:MUSIC_VOLUME,sfxMultiplier:SFX_VOLUME_MULTIPLIER}),choose,useBomb,useDash,useBurst,move:(x,y)=>{touch.vx=cap(x,-1,1);touch.vy=cap(y,-1,1)},state:()=>({mode,wave:s?.wave||0,chapter:s?.chapter||1,localWave:s?localWave():0,foxAlive:!!s?.fox?.alive,foxSaves:s?.fox?.saves||0,foxCasts:s?.fox?.casts||0,foxAssistBeams:foxAssistFx.length,foxCooldown:s?.fox?.cooldown||0,ringWarnings:ringWarnings.length,splitWarnings:splitWarnings.length,queuedFirstSpells:queuedFirstSpells.length,doomedCharges:enemies.filter(e=>e.doomed).length,videoActive:activeStoryVideo,videoKind:storyVideoKind,chapter2Only:!!s?.chapter2Only,transitionKind:transition?.kind||null,guardSparks:particles.length,guardActive:!!foxGuard,guardHold:!!foxGuard?.opening,guardTTL:foxGuard?.ttl||0,guardImpact:foxGuard?.impact||0,invuln:s?.p.invuln||0,opening:bossOpening?{...bossOpening}:null,c2Events:s?.c2Events||null,c2RingCooldown,charging:enemies.filter(e=>e.chargeState==='windup'||e.chargeState==='dash').length,clock:s?.clock||0,score:s?.score||0,kills:s?.kills||0,spawnLeft,bossCreated,waveClearTimer,bossDefeatTimer,hp:s?.p.hp||0,maxHp:s?.p.max||0,charge:s?.p.charge||0,superTTL:s?.p.superTTL||0,bombs:s?.p.bombs||0,player:s?.p?{x:s.p.x,y:s.p.y,hp:s.p.hp,rate:s.p.rate,dmg:s.p.dmg,crit:s.p.crit,barrels:s.p.barrels,dashCD:s.p.dashCD,dashTTL:s.p.dashTTL,hitTTL:s.p.hitTTL,recoil:s.p.recoil,angle:s.p.angle,facing:s.p.facing||1,pose:playerPose(s.p),sprite:playerVisual(s.p).sprite,lastShotOrigin:s.p.lastShotOrigin}:null,enemies:enemies.length,bullets:shots.length,bad:hostile.length,hazards:hazards.length,options:selectedUpgrades.map(x=>x.id),chapter1Record:s?.chapter1Record?{...s.chapter1Record}:null,totals:s?totalRecord():null,stats:s?{shotsFired:s.shotsFired,hits:s.hitCount,damageTaken:s.damageTaken,upgrades:s.upgrades.length,dashes:s.dashUsed,bombs:s.bombUsed,bursts:s.burstUsed,bestCombo:s.bestCombo,bossDamage:s.bossDamage}:null}),visual:()=>{if(!s)return null;const v=playerVisual(s.p),m=cameraMount(s.p);return{pose:v.pose,sprite:v.sprite,w:v.w,h:v.h,centerX:s.p.x+v.x,centerY:s.p.y+v.centerY,muzzleX:m.muzzleX,muzzleY:m.muzzleY,baseX:m.baseX,baseY:m.baseY,recoil:m.recoil,superGlow:s.p.superGlow,lastShotOrigin:s.p.lastShotOrigin}},projectiles:()=>shots.map(b=>({x:b.x,y:b.y,vx:b.vx,vy:b.vy,volley:b.volley,volleyIndex:b.volleyIndex})),foes:()=>enemies.map(e=>({x:e.x,y:e.y,type:e.type,hp:e.hp,max:e.max,doomed:!!e.doomed,phaseTransition:e.phaseTransition||0,finalBoss:!!e.finalBoss,phase:e.enraged?2:1,r:e.r,entry:e.entry||0,c2Role:e.c2Role,chargeState:e.chargeState,chargeTimer:e.chargeTimer,firstSkillDone:!!e.firstSkillDone,firstCastQueued:!!e.firstCastQueued,ringCooldown:e.ringCooldown||0,chargeCooldown:e.chargeCooldown,shot:e.shot,skillHistory:e.skillHistory?{...e.skillHistory}:null})),hostiles:()=>hostile.map(b=>({x:b.x,y:b.y,vx:b.vx,vy:b.vy,r:b.r,damage:b.damage,c2Kind:b.c2Kind||null,splitIn:b.splitIn||null})),valid:()=>{const vals=[s?.p.x,s?.p.y,s?.p.hp,s?.p.charge,...enemies.flatMap(e=>[e.x,e.y,e.hp]),...hostile.flatMap(b=>[b.x,b.y])].filter(x=>x!=null);return vals.every(Number.isFinite)&&enemies.length<130&&shots.length<250&&hostile.length<180&&ringWarnings.length<=2&&splitWarnings.length<=2&&queuedFirstSpells.length<85},c2Debug:{bossCharge:()=>{if(!isChapter2()||mode!=='play')return false;const boss=enemies.find(e=>e.finalBoss);return boss?c2ChargeStart(boss):false;},charge:()=>{if(!isChapter2()||mode!=='play')return false;const e=createEnemy('runner');e.x=W*.52;e.y=H*.38;e.entry=0;e.chargeCooldown=0;return c2ChargeStart(e);},ring:()=>{if(!isChapter2()||mode!=='play')return false;c2RingCooldown=0;ringWarnings=[];return c2RingAttack({entry:0,y:H*.22});},split:()=>{if(!isChapter2()||mode!=='play')return false;return c2SplitAttack({x:W*.45,y:H*.22},1);},phase2:()=>{if(!isChapter2()||mode!=='play')return false;const e=enemies.find(e=>e.finalBoss);if(!e)return false;e.hp=e.max*.53;e.shot=.03;return true;},forceStage:(n)=>{if(!isChapter2()||mode!=='play')return false;s.wave=cap(n,9,16);enemies=[];shots=[];hostile=[];hazards=[];ringWarnings=[];splitWarnings=[];queuedFirstSpells=[];spawnLeft=0;bossCreated=true;return s.wave;},clear:()=>{hostile=[];ringWarnings=[];splitWarnings=[];queuedFirstSpells=[];return true;}},forceBoss:()=>{if(mode!=='play')return false;s.wave=isChapter2()?16:8;enemies=[];shots=[];hostile=[];hazards=[];ringWarnings=[];splitWarnings=[];queuedFirstSpells=[];spawnLeft=0;wavesTarget=1;bossCreated=true;createEnemy('boss');ui();return true;},forceWave:()=>{if(mode!=='play')return;spawnLeft=0;for(const e of enemies)e.hp=0;enemies.length=0;bossCreated=true},debugStress:(count=36)=>{if(mode!=='play')return false;enemies=[];shots=[];hostile=[];particles=[];spawnLeft=0;bossCreated=true;const kinds=['basic','basic2','runner','caster','brute'];for(let i=0;i<cap(count,1,60);i++){const e=createEnemy(kinds[i%kinds.length]);e.entry=0;e.x=30+(i%6)*(W-60)/5;e.y=86+Math.floor(i/6)*58;e.shot=999;e.hp*=2.5;e.max=e.hp}for(let i=0;i<48;i++)hostile.push({x:28+(i%8)*(W-56)/7,y:125+Math.floor(i/8)*57,vx:0,vy:0,life:8,r:6,damage:0,color:'#ff8abd'});return true},metrics:()=>({version:'V2.23 MUSIC + SFX MIX',W,H,imagesLoaded,expectedImages:NAMES.length,heroSprite:HERO_BODY.sprite,dashSprite:HERO_DASH.sprite,heroWidth:HERO_BODY.w,heroHeight:HERO_BODY.h,overloadSprite:HERO_OVERLOAD.sprite,overloadScale:HERO_OVERLOAD.h/HERO_BODY.h,usesFloatingBarrel:false})};
resize();menu();requestAnimationFrame(loop);
window.__V12_DEBUG={getScenes:()=>BG_IMAGES.map(i=>!!(i.complete&&i.naturalWidth)),renderScene:(n)=>{ctx.save();background(Math.max(0,Math.min(3,n)));ctx.restore()},setWave:(n)=>{if(s){s.wave=Math.max(1,Math.min(8,n));v12Scene=-1;return s.wave;}return 0}};
})();
