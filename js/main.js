// ════════════════════════════════════════════════
// MAIN — entry point
// ════════════════════════════════════════════════
import { C, ACX, ACY, AR } from './constants.js';
import { Snd } from './audio.js';
import { Rec, autoBatchActive, autoBatchPart, forcedMode, autoBatchSequence, buildBatchSequence, setAutoBatchActive, setAutoBatchPart, setForcedMode, setAutoBatchSequence, initRec } from './recorder.js';
import { parts, burst, ringBurst, tickParts, spawnOrb, initParticles } from './particles.js';
import { CAM } from './camera.js';
import { ARENA, pushInsideArena, isInsideArena, pushInsideRect } from './arena.js';
import { FX, initFX } from './fx.js';
import { Ball, isEnemy, addDmg, initBall } from './ball.js';
import { G, initGame, getStall, setStall } from './game.js';
import { ORB_TYPES, orbs, ORB_RADIUS, ORB_LIFETIME, tickOrbs, initAbilities, setOrbSpawnTimer, setOrbRoundFrame, setStallOrbTimer, setStallOrbActive, setStallOrbCycle } from './abilities.js';
import { draw, pushToRec, triggerRoundTransition, initDraw, getFrame } from './draw.js';
import { Perf } from './perf.js';
import { Ticker } from './ticker.js';

// ════════════════════════════════════════════════
// CANVAS & LAYOUT
// ════════════════════════════════════════════════
const DC = document.getElementById('displayCanvas');
const dc = DC.getContext('2d', { alpha: false });
const RC = document.getElementById('recordCanvas');
const rc = RC.getContext('2d', { alpha: false });

// ════════════════════════════════════════════════
// PHYSICS
// ════════════════════════════════════════════════
let wallSndThrottle=0; // throttle wall sounds — max 1 per 3 frames
function wallBounce(b){
  // Dungeon mode: use rectangular room bounds
  if(G.dungeonMode && G.dungeonRoomRect){
    if(b.ghostFrames>0) return;
    const prevVx=b.vx, prevVy=b.vy;
    pushInsideRect(b, G.dungeonRoomRect);
    if(b.vx!==prevVx || b.vy!==prevVy){ b.wallSpeedUp(); if(wallSndThrottle<=0){ Snd.wall(); wallSndThrottle=3; } }
    return;
  }
  if(b.ghostFrames>0){
    const dg=Math.hypot(b.x-ACX,b.y-ACY);
    if(dg>AR+60){ const ng=(dg||1); b.x=ACX-(b.x-ACX)/ng*(AR-b.r*2); b.y=ACY-(b.y-ACY)/ng*(AR-b.r*2); }
    return;
  }
  if(isInsideArena(b.x, b.y, ARENA.r, b.r)) return;
  const prevVx=b.vx, prevVy=b.vy;
  pushInsideArena(b, ARENA.r);
  if(b.vx!==prevVx || b.vy!==prevVy){ b.wallSpeedUp(); if(wallSndThrottle<=0){ Snd.wall(); wallSndThrottle=3; } }
}

function ballPair(a,b){
  const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),min=a.r+b.r;
  if(d>=min||d===0) return;
  const ov=(min-d)/2,nx=dx/d,ny=dy/d;
  a.x-=nx*ov;a.y-=ny*ov;b.x+=nx*ov;b.y+=ny*ov;
  const rel=(a.vx-b.vx)*nx+(a.vy-b.vy)*ny;
  if(rel>0){
    a.vx=(a.vx-rel*nx)*C.REST_B;a.vy=(a.vy-rel*ny)*C.REST_B;
    b.vx=(b.vx+rel*nx)*C.REST_B;b.vy=(b.vy+rel*ny)*C.REST_B;
    a.cap();b.cap();
  }
  const k=G.key(a,b);
  if(G.cd[k]===0){
    // Same team: push but no damage
    if(G.teamMode && a.teamId>=0 && a.teamId===b.teamId){ G.cd[k]=C.COOLDOWN; return; }
    // Dungeon mode: enemies don't damage each other
    if(G.dungeonMode && !a.isDungeonPlayer && !b.isDungeonPlayer){ G.cd[k]=C.COOLDOWN; return; }
    const aA=a.alive,bA=b.alive;
    // Dungeon mode: asymmetric damage — player vs enemies
    if(G.dungeonMode && (a.isDungeonPlayer||b.isDungeonPlayer)){
      const player=a.isDungeonPlayer?a:b, enemy=a.isDungeonPlayer?b:a;
      const playerDmg = enemy.isDungeonBoss ? C.DUNGEON.BOSS_DMG_TO_PLAYER : C.DUNGEON.ENEMY_DMG_TO_PLAYER;
      let enemyTake = enemy.isDungeonBoss ? C.DUNGEON.PLAYER_DMG_TO_BOSS : C.DUNGEON.PLAYER_DMG_TO_ENEMY;
      // Boss room rage escalation based on remaining time
      if(enemy.isDungeonBoss){
        const framesLeft = C.DUNGEON.BOSS_ROOM_FRAMES - G.dungeonRoomFrames;
        let heroMult = 1, bossMult = 1;
        if(framesLeft <= 600){       // 10s left: hero +50% more, boss +25% more (stacks)
          heroMult = 1.5 * 1.25 * 1.5; bossMult = 1.25 * 1.25;
        } else if(framesLeft <= 1200){ // 20s left: hero +25%, boss +25%
          heroMult = 1.5 * 1.25; bossMult = 1.25;
        } else if(framesLeft <= 1800){ // 30s left: hero +50%
          heroMult = 1.5;
        }
        enemyTake = enemyTake * heroMult;
        // boss dmg to player scales with bossMult (more pressure)
        player.hit(playerDmg * bossMult);
        enemy.hit(enemyTake);
      } else {
        player.hit(playerDmg);
        enemy.hit(enemyTake);
      }
      addDmg(player, enemyTake*10);
      G.cd[k] = enemy.isDungeonBoss ? 0 : C.COOLDOWN; Snd.hit();
      G.shakeFrames=Math.max(G.shakeFrames, 10); G.shakeAmt=Math.max(G.shakeAmt, 8);
      if(aA&&!a.alive){ Snd.kill(); Snd.onKill();
        if(a.isDungeonPlayer){ G.arenaFlash.color='#ff0000'; G.arenaFlash.alpha=0.8; G.shakeFrames=40; G.shakeAmt=30; }
      }
      if(bA&&!b.alive){ Snd.kill(); Snd.onKill();
        if(b.isDungeonPlayer){ G.arenaFlash.color='#ff0000'; G.arenaFlash.alpha=0.8; G.shakeFrames=40; G.shakeAmt=30; }
        else {
          // Enemy died: heal player slightly
          player.hp=Math.min(player.hp+8, player.max);
          G.arenaFlash.color=b.color; G.arenaFlash.alpha=0.45;
          G.shakeFrames=18; G.shakeAmt=14;
          G.dungeonKillsThisRoom++;
        }
      }
      if(aA&&!a.alive&&!a.isDungeonPlayer){
        player.hp=Math.min(player.hp+8, player.max);
        G.arenaFlash.color=a.color; G.arenaFlash.alpha=0.45;
        G.shakeFrames=18; G.shakeAmt=14;
        G.dungeonKillsThisRoom++;
      }
      return;
    }
    // Boss mode: asymmetric damage — boss hits harder, takes less per collision
    if(G.bossMode && (a.isBoss||b.isBoss)){
      const boss=a.isBoss?a:b, hunter=a.isBoss?b:a;
      addDmg(hunter, 25); // hunters get credit for damaging boss
      addDmg(boss, C.BOSS.DMG_OUT * 10); // boss gets credit for damage dealt to hunters
      boss.hit(C.BOSS.DMG_IN);    // boss takes reduced damage
      hunter.hit(C.BOSS.DMG_OUT); // hunter takes heavy damage
      G.cd[k]=C.COOLDOWN; Snd.hit();
      G.shakeFrames=Math.max(G.shakeFrames, 14); G.shakeAmt=Math.max(G.shakeAmt, 12);
      if(bA&&!b.alive&&b.isBoss){ // boss died
        G.arenaFlash.color='#ff8800'; G.arenaFlash.alpha=0.8;
        G.shakeFrames=40; G.shakeAmt=30;
        Snd.kill(); Snd.onKill();
      }
      if(aA&&!a.alive&&a.isBoss){ // boss died (a was boss)
        G.arenaFlash.color='#ff8800'; G.arenaFlash.alpha=0.8;
        G.shakeFrames=40; G.shakeAmt=30;
        Snd.kill(); Snd.onKill();
      }
      if(bA&&!b.alive&&!b.isBoss){ Snd.kill(); Snd.onKill(); } // hunter killed
      if(aA&&!a.alive&&!a.isBoss){ Snd.kill(); Snd.onKill(); }
      return;
    }
    addDmg(a,25); addDmg(b,25);
    // Score: damage dealt
    a.addScore(20); b.addScore(20);
    // Kamehame: next hit instant-kills target
    if(a.kamehame){ b.hp=0; b.bonusHp=0; a.kamehame=false; }
    if(b.kamehame){ a.hp=0; a.bonusHp=0; b.kamehame=false; }
    a.hit(); b.hit();
    G.cd[k]=C.COOLDOWN; Snd.hit();
    if(aA&&!b.alive){
      a.triggerRage(); a.streak++; a.addScore(100);
      // Full HP overheal on kill: set to double max, decay back
      a.hp=a.max*2; a.bonusHp=a.max; Snd.heal();
      G.shakeFrames=22; G.shakeAmt=18;
      G.arenaFlash.color=b.color; G.arenaFlash.alpha=0.55;
      Snd.kill(); Snd.onKill();
    }
    if(bA&&!a.alive){
      b.triggerRage(); b.streak++; b.addScore(100);
      // Full HP overheal on kill: set to double max, decay back
      b.hp=b.max*2; b.bonusHp=b.max; Snd.heal();
      G.shakeFrames=22; G.shakeAmt=18;
      G.arenaFlash.color=a.color; G.arenaFlash.alpha=0.55;
      Snd.kill(); Snd.onKill();
    }
  }
}

// ════════════════════════════════════════════════
// UI
// ════════════════════════════════════════════════
const soloBtn    = document.getElementById('soloBtn');
const teamBtn    = document.getElementById('teamBtn');
const bossBtn    = document.getElementById('bossBtn');
const dungeonBtn = document.getElementById('dungeonBtn');
const autoBtn    = document.getElementById('autoBtn');
const restartBtn = document.getElementById('restartBtn');
const statusEl   = document.getElementById('status');
function setStatus(cls,msg){ statusEl.textContent=msg; statusEl.className=cls; }

// ════════════════════════════════════════════════
// BEGIN / AUTO
// ════════════════════════════════════════════════
function begin(){
  setAutoBatchPart(autoBatchPart + 1);
  Perf.reset();
  G.start();
  const mode = G.dungeonMode ? 'DUNGEON' : G.bossMode ? 'BOSS' : G.teamMode ? 'TEAM' : 'SOLO';
  Perf.logStart({
    part: autoBatchPart,
    mode,
    balls: G.bossMode ? `${C.COUNT} hunters + 1 boss` : `${C.COUNT}`,
    shape: ARENA.shape.toUpperCase(),
    resolution: `${DC.width}x${DC.height}`,
    round: G.round,
  });
  soloBtn.disabled=true; teamBtn.disabled=true; bossBtn.disabled=true; dungeonBtn.disabled=true; restartBtn.disabled=true; autoBtn.disabled=true;
  setStatus('','⏳ Starting...');
}
function beginAuto(){
  setAutoBatchActive(true);
  setAutoBatchPart(0);
  setAutoBatchSequence(buildBatchSequence());
  begin();
}

// ════════════════════════════════════════════════
// LOOP
// ════════════════════════════════════════════════
let lastT=0;
const TARGET_MS=1000/60;

function loop(t){
  if(t-lastT<TARGET_MS-0.5) return;
  lastT=t;

  // ── Dungeon room transition ──
  if(G.state==='roomTransition'){
    tickParts();
    G.dungeonRoomTransFrame--;
    // Slide animation offset
    const prog = 1 - G.dungeonRoomTransFrame / C.DUNGEON.ROOM_TRANSITION_DUR;
    if(prog < 0.5){
      G.dungeonRoomSlideOffset = -prog * 2 * 800; // slide out left
    } else {
      G.dungeonRoomSlideOffset = (1 - (prog-0.5)*2) * 800; // slide in from right
    }
    if(G.dungeonRoomTransFrame === Math.floor(C.DUNGEON.ROOM_TRANSITION_DUR/2)){
      // Midpoint: spawn new room
      G.startDungeonRoom();
    }
    if(G.dungeonRoomTransFrame <= 0){
      G.dungeonRoomSlideOffset = 0;
      G.state = 'running';
    }
  }

  if(G.state==='roundEndDelay'){
    // Keep drawing FX but don't run physics — let effects finish
    tickParts();
    if(--G.roundEndDelayTimer<=0) G.resolveRoundEnd();
  }
  if(G.state==='roundEnd'){
    if(--G.roundTimer<=0){ G.startRound(); Perf.logRound(G.round, G.alive().length); }
  }
  if(G.state==='podium'){
    G.podiumTimer++;
    G.podiumPhase++;
    // Slot duration: 45f (0.75s) — fast enough so podium + champion fits in remaining time
    const slotDur=45;
    if(G.podiumPhase>=slotDur){
      G.podiumPhase=0;
      G.podiumSlot++;
      const podiumTotal = G.dungeonMode ? 1 : G.bossMode ? C.COUNT+1 : G.teamMode ? G.teams.length : C.COUNT;
      if(G.podiumSlot<podiumTotal) Snd.countdown();
      if(G.podiumSlot>=podiumTotal){
        G.state='champion';
        G.championTimer=0;
        Snd.champion();
      }
    }
  }
  if(G.state==='champion'){
    if(++G.championTimer===180){ // 3s of champion screen then stop
      Rec.stop();
      const w = G.roundWinner;
      Perf.logEnd({ winner: G.dungeonMode ? (G.dungeonVictory ? 'VICTORY' : 'GAME OVER') : w ? (G.bossMode ? (G.bossWon ? 'BOSS' : 'HUNTERS') : w.name) : 'DRAW' });
      if(!autoBatchActive){ restartBtn.disabled=false; autoBtn.disabled=false; soloBtn.disabled=false; teamBtn.disabled=false; bossBtn.disabled=false; dungeonBtn.disabled=false; }
    }
  }
  if(G.state==='countdown'){
    const prev=G.countdown;
    G.countdown--;
    // Beep at start (frame 60→59) and GO flash
    if(prev===60) Snd.countdown();
    if(G.countdown<=0){
      G.state='running';
      // Only create AudioContext and start recording on the FIRST round
      if(G.round===1){
        // Await music load so it's routed into MediaRecorder stream before Rec.start()
        Snd.create().then(()=>{ Rec.start(); });
      }
    }
  }
  if(G.state==='running'){
    const a=G.alive();

    // ── Dungeon room timer ──
    if(G.dungeonMode){
      G.dungeonRoomFrames++;
      const isBossRoom = G.dungeonRoom >= G.dungeonTotalRooms;
      const maxFrames = isBossRoom ? C.DUNGEON.BOSS_ROOM_FRAMES : C.DUNGEON.MAX_ROOM_FRAMES;
      // Force damage to enemies if room takes too long (after 80% of max time)
      // Boss room: no forced damage — player must earn the kill
      if(G.dungeonRoomFrames > maxFrames * 0.8 && !isBossRoom){
        const enemies = G.dungeonAliveEnemies();
        for(const e of enemies){
          if(G.dungeonRoomFrames % 30 === 0) e.hit(2); // tick damage every 0.5s
        }
      }
      // Hard timeout: normal rooms force-clear; boss room kills the player (demon lord wins)
      if(G.dungeonRoomFrames >= maxFrames){
        if(isBossRoom){
          const p = G.dungeonPlayer;
          if(p && p.alive){ p.hp=0; p.alive=false; burst(p.x,p.y,p.color); }
        } else {
          const enemies = G.dungeonAliveEnemies();
          for(const e of enemies){ e.hp=0; e.alive=false; burst(e.x,e.y,e.color); }
        }
      }
    }

    // ── Round timer ──
    const ROUND_DURATION = G.bossMode ? 8400 : G.dungeonMode ? 99999 : 2700; // dungeon has no round timer
    const SD_START       = G.bossMode ? 6600 : G.dungeonMode ? 99999 : 1500;
    G.roundFrames++;

    // Activate sudden death
    if(!G.suddenDeathActive && G.roundFrames >= SD_START){
      G.suddenDeathActive = true;
      G.shakeFrames = 50; G.shakeAmt = 25;
      G.arenaFlash.color='#ff2200'; G.arenaFlash.alpha=0.7;
      Perf.logEvent(`SUDDEN DEATH activated — arena shrinking`);
    }

    // Sudden death: arena shrinks continuously toward a tiny radius
    if(G.suddenDeathActive){
      const elapsed   = G.roundFrames - SD_START;
      const shrinkDur = ROUND_DURATION - SD_START;
      const prog      = Math.min(1, elapsed / shrinkDur);
      const minR      = AR * 0.15;
      ARENA.r = AR - (AR - minR) * prog;
      for(const b of a) pushInsideArena(b, ARENA.r);
    }

    // Round time up → end round
    if(G.roundFrames >= ROUND_DURATION){
      if(G.bossMode){
        // Time limit reached — boss survives, boss wins
        G.bossWon = true;
        G.roundWinner = G.bossBall;
        G.state='roundEndDelay'; G.roundEndDelayTimer=150;
      } else if(G.teamMode){
        // Winner = team with most total HP alive
        const teamHp = G.teams.map(t=>({
          team:t,
          hp: G.balls.filter(b=>b.alive&&b.teamId===t.id).reduce((s,b)=>s+b.hp,0)
        }));
        teamHp.sort((a,b)=>b.hp-a.hp);
        G.roundWinner = teamHp[0]?.team ?? null;
        G.state='roundEndDelay'; G.roundEndDelayTimer=150;
      } else {
        const sorted = [...G.balls].sort((a,b)=>{
          if(a.alive !== b.alive) return a.alive ? -1 : 1;
          return G.roundDmg[b.id] - G.roundDmg[a.id];
        });
        G.roundWinner = sorted[0] ?? null;
        G.state='roundEndDelay'; G.roundEndDelayTimer=150;
      }
    }

    CAM.tick(a);
    if(wallSndThrottle>0) wallSndThrottle--;
    // Physics runs every frame; Ball.move() scales velocity by CAM.physSpeed() for smooth slowmo
    for(const b of a) b.move();
    for(const b of a) wallBounce(b);
    for(let i=0;i<a.length;i++) for(let j=i+1;j<a.length;j++) ballPair(a[i],a[j]);
    tickOrbs(a);
    FX.tick(a, getFrame());
    for(const k in G.cd) if(G.cd[k]>0) G.cd[k]--;
    tickParts();
    G.updateLeaderboard();
    for(let i=0;i<G.dmgFlash.length;i++) if(G.dmgFlash[i]>0) G.dmgFlash[i]--;
    if(G.lastTwoTimer>0) G.lastTwoTimer--;
    if(G.dungeonMode) G.checkDungeonEnd();
    else G.checkEnd();
  } else {
    tickParts();
    if(G.lastTwoTimer>0) G.lastTwoTimer--;
  }

  draw(dc);
  pushToRec();

  // Performance monitor
  const fxActive = FX.chains.length + FX.sukunaCleaves.length + FX.bloodStreams.length
    + FX.bloodSpears.length + FX.sonicSlashes.length + FX.zoltraakBeams.length
    + FX.megiddoBeams.length + FX.makimaChains.length + FX.demiurgeLegs.length
    + FX.bishArr.length + FX.origamiFeathers.length + FX.deltaSlashes.length
    + FX.betaBlades.length + FX.yatoCuts.length + FX.noraBeads.length
    + FX.veenaLightning.length
    + (FX.voidBeam?1:0) + (FX.hellfireZone?1:0) + (FX.zephyrBlade?1:0)
    + (FX.rasengan?1:0) + (FX.chidori?1:0) + (FX.seriousPunch?1:0)
    + (FX.incinerateBeam?1:0) + (FX.tornadoPsy?1:0) + (FX.sandevistanFrames>0?1:0)
    + (FX.timestopFrames>0?1:0);
  Perf.tick(t, {
    frame: getFrame(),
    particles: parts.length,
    fxCount: fxActive,
    alive: G.alive().length,
    arenaR: ARENA.r,
    arenaMax: AR,
    state: G.state,
  });
}

// ════════════════════════════════════════════════
// EVENT LISTENERS
// ════════════════════════════════════════════════
soloBtn.addEventListener('click',()=>{ Snd.initCtx(); setAutoBatchActive(false); setAutoBatchPart(0); setForcedMode('solo'); begin(); });
teamBtn.addEventListener('click',()=>{ Snd.initCtx(); setAutoBatchActive(false); setAutoBatchPart(0); setForcedMode('team'); begin(); });
bossBtn.addEventListener('click',()=>{ Snd.initCtx(); setAutoBatchActive(false); setAutoBatchPart(0); setForcedMode('boss'); begin(); });
dungeonBtn.addEventListener('click',()=>{ Snd.initCtx(); setAutoBatchActive(false); setAutoBatchPart(0); setForcedMode('dungeon'); begin(); });
restartBtn.addEventListener('click',()=>{
  Snd.initCtx(); setAutoBatchActive(false); Rec.stop(); restartBtn.disabled=true;
  setTimeout(begin,400);
});
autoBtn.addEventListener('click',()=>{ Snd.initCtx(); beginAuto(); });

// ════════════════════════════════════════════════
// WIRE UP LATE-BINDING DEPENDENCIES
// ════════════════════════════════════════════════
initBall({ G, CAM, FX, burst, getStall, setStall: (t,a,c) => { setStall(t,a,c); setStallOrbTimer(t); setStallOrbActive(a); setStallOrbCycle(c); } });
initFX({ isEnemy, addDmg, burst, parts, G, CAM });
initGame({ Ball, parts, orbs, FX, CAM, Snd, ringBurst, triggerRoundTransition, getAutoBatch: () => ({ autoBatchActive, autoBatchPart, autoBatchSequence, forcedMode }), resetOrbTimers: () => { setOrbSpawnTimer(0); setOrbRoundFrame(0); setStallOrbTimer(0); setStallOrbActive(false); setStallOrbCycle(0); } });
initAbilities({ G, FX, CAM, Snd, burst, isEnemy, addDmg, spawnOrb });
initParticles({ ORB_TYPES, orbs, ORB_RADIUS, ORB_LIFETIME });
initDraw({ G, DC, RC: rc });
initRec({ RC, Snd, setStatus, soloBtn, teamBtn, bossBtn, dungeonBtn, autoBtn, restartBtn, begin });

// ════════════════════════════════════════════════
// START
// ════════════════════════════════════════════════
Ticker.start(loop);
// ✅ COMPLETO
