// ════════════════════════════════════════════════
// GAME STATE
// ════════════════════════════════════════════════
import { C, ACX, ACY, AR, LB_X, LB_Y, LB_BAR_H, LB_BAR_GAP, LB_BAR_MAX, LB_BALL_R } from './constants.js';
import { ARENA } from './arena.js';
import { isInsideArena, getDungeonRoomRect, isInsideRect } from './arena.js';

// Late-binding deps
let _Ball = null, _parts = null, _orbs = null, _FX = null, _CAM = null, _Snd = null,
    _ringBurst = null, _isInsideArena = null, _triggerRoundTransition = null,
    _getAutoBatch = null, _resetOrbTimers = null;
let _stallOrbTimer = 0, _stallOrbActive = false, _stallOrbCycle = 0,
    _orbSpawnTimer = 0, _orbRoundFrame = 0;

export function initGame(deps){
  _Ball = deps.Ball;
  _parts = deps.parts;
  _orbs = deps.orbs;
  _FX = deps.FX;
  _CAM = deps.CAM;
  _Snd = deps.Snd;
  _ringBurst = deps.ringBurst;
  _triggerRoundTransition = deps.triggerRoundTransition;
  _getAutoBatch = deps.getAutoBatch;
  _resetOrbTimers = deps.resetOrbTimers;
}

// Stall orb state accessors (used by Ball.hit() via initBall setStall)
export function getStall(){ return { stallOrbTimer: _stallOrbTimer, stallOrbActive: _stallOrbActive, stallOrbCycle: _stallOrbCycle }; }
export function setStall(timer, active, cycle){ _stallOrbTimer=timer; _stallOrbActive=active; _stallOrbCycle=cycle; }
export function getOrbTimers(){ return { orbSpawnTimer: _orbSpawnTimer, orbRoundFrame: _orbRoundFrame, stallOrbTimer: _stallOrbTimer, stallOrbActive: _stallOrbActive, stallOrbCycle: _stallOrbCycle }; }
export function setOrbTimers(v){ _orbSpawnTimer=v.orbSpawnTimer; _orbRoundFrame=v.orbRoundFrame; _stallOrbTimer=v.stallOrbTimer; _stallOrbActive=v.stallOrbActive; _stallOrbCycle=v.stallOrbCycle; }

export const G = {
  balls:[], state:'idle', winner:null, cd:{},
  countdown:0,
  // Team mode
  teamMode: false,
  teams: [],   // [{id, color, name, memberIds:[]}]
  // Boss mode
  bossMode: false,
  bossBall: null,      // reference to the boss Ball object
  bossWon: false,      // true if boss survived, false if hunters won
  // Dungeon mode
  dungeonMode: false,
  dungeonRoom: 0,          // current room (1-based)
  dungeonTotalRooms: 6,    // total rooms
  dungeonPlayer: null,     // reference to player Ball
  dungeonBoss: null,       // reference to dungeon boss Ball (last room)
  dungeonRoomTransFrame: 0,// countdown for room transition animation
  dungeonGameOver: false,  // true if player died
  dungeonVictory: false,   // true if boss defeated
  dungeonHealTimer: 0,     // frames since last heal pack spawn
  dungeonRoomFrames: 0,    // frames elapsed in current room
  dungeonEnemyAbilityTimer: 0, // frames since last enemy ability
  dungeonBossAbilityTimer: 0,  // frames since last boss ability
  dungeonKillsThisRoom: 0,    // enemies killed in current room
  dungeonTotalEnemiesInRoom: 0,// total enemies spawned in current room
  dungeonRoomSlideOffset: 0,   // pixel offset for room slide animation
  dungeonRoomRect: null,       // current room bounds {left,top,right,bottom,w,h,name,...}
  // Rounds
  round:0,            // current round number (1-based)
  roundWins:[],       // wins per team/ball id
  roundTimer:0,       // inter-round pause timer
  roundWinner:null,   // winner of the last round (ball or team object)
  champion:null,      // overall champion
  eliminationOrder:[],
  shakeFrames:0, shakeAmt:0,
  arenaFlash:{color:'#fff',alpha:0},
  lastTwoTimer:0, lastTwoShown:false,
  stallTimer:0,
  lbTargets:[], lbWidths:[],
  roundDmg:[],   // damage dealt this round per team/ball id
  dmgFlash:[],   // frames of damage flash per ball id (always by ball.id)
  totalDmg:[],   // total damage across all rounds
  roundEndDelayTimer:0,
  podiumTimer:0,
  podiumSlot:0,
  championTimer:0,
  podiumPhase:0,
  roundFrames: 0,
  suddenDeathActive: false,

  buildTeams(){
    const numTeams = 2 + Math.floor(Math.random()*3); // 2-4 teams
    this.teams = [];
    for(let t=0;t<numTeams;t++) this.teams.push({id:t, color:C.TEAM_COLORS[t], name:C.TEAM_NAMES[t], memberIds:[]});
    // Distribute players randomly (at least 1 per team, rest random)
    const ids = Array.from({length:C.COUNT},(_,i)=>i);
    // First guarantee 1 per team
    const shuffled = ids.sort(()=>Math.random()-0.5);
    for(let t=0;t<numTeams;t++) this.teams[t].memberIds.push(shuffled[t]);
    // Rest go to random teams
    for(let i=numTeams;i<C.COUNT;i++) this.teams[Math.floor(Math.random()*numTeams)].memberIds.push(shuffled[i]);
  },

  spawnBalls(){
    this.balls=[]; this.cd={}; _parts.length=0;
    _orbs.length=0; _orbSpawnTimer=0; _orbRoundFrame=0; _stallOrbTimer=0; _stallOrbActive=false; _stallOrbCycle=0;
    if(_resetOrbTimers) _resetOrbTimers();
    _FX.reset();
    // Hard-reset camera so no leftover zoom/focus from previous round
    _CAM.phase='off'; _CAM.zoom=1.0; _CAM.tgtZoom=1.0;
    _CAM.focX=ACX; _CAM.focY=ACY; _CAM.tgtX=ACX; _CAM.tgtY=ACY;
    _CAM.timer=0; _CAM.showCard=false; _CAM.impactAlpha=0; _CAM.resultTimer=0;
    this.eliminationOrder=[];
    this.lastTwoShown=false; this.lastTwoTimer=0;
    this.stallTimer=0; this.arenaFlash.alpha=0;
    const sz = this.bossMode ? C.COUNT+1 : this.teamMode ? this.teams.length : C.COUNT;
    this.lbTargets=new Array(sz).fill(0);
    this.lbWidths=new Array(sz).fill(0);
    this.roundDmg=new Array(sz).fill(0);
    this.dmgFlash=new Array(sz).fill(0);
    this.bossBall=null;
    for(let i=0;i<C.COUNT;i++){
      let x,y,ok,t=0;
      do{
        ok=true;
        const a=Math.random()*Math.PI*2, r=Math.random()*(AR-C.BALL_R*2.5)*0.75;
        x=ACX+Math.cos(a)*r; y=ACY+Math.sin(a)*r;
        if(!isInsideArena(x,y,ARENA.r,C.BALL_R*1.5)){ok=false;}
        else for(const b of this.balls) if(Math.hypot(b.x-x,b.y-y)<C.BALL_R*2.8){ok=false;break;}
      }while(!ok&&++t<300);
      // Aim toward arena center with ±45° random spread — guarantees early collisions
      const toCenterA = Math.atan2(ACY-y, ACX-x);
      const spread = (Math.random()-0.5) * Math.PI * 0.7;
      const d = toCenterA + spread;
      const s=C.MIN_SPD+Math.random()*(C.MAX_SPD-C.MIN_SPD);
      const hunter = new _Ball(i,x,y,Math.cos(d)*s,Math.sin(d)*s);
      // In boss mode hunters get triple HP so the fight lasts at least 90s
      if(this.bossMode){ hunter.hp = hunter.max = C.MAX_HP * 5; }
      this.balls.push(hunter);
    }
    // Boss spawn — placed at arena center with id=C.COUNT
    if(this.bossMode){
      const bossId=C.COUNT;
      const bs=C.MIN_SPD*C.BOSS.SPEED_MULT;
      const ba=Math.random()*Math.PI*2;
      const boss=new _Ball(bossId, ACX, ACY, Math.cos(ba)*bs, Math.sin(ba)*bs);
      boss.isBoss=true;
      boss.r=C.BOSS.R;
      boss.hp=boss.max=C.BOSS.HP;
      boss.bonusHp=0;
      boss.color=C.BOSS.COLOR;
      boss.name=C.BOSS.NAME;
      boss.teamId=-1;
      this.balls.push(boss);
      this.bossBall=boss;
      // Add cooldown slots for boss vs all hunters
      for(let i=0;i<C.COUNT;i++) this.cd[`${i}:${bossId}`]=0;
    }
    for(let a=0;a<C.COUNT;a++) for(let b=a+1;b<C.COUNT;b++) this.cd[`${a}:${b}`]=0;
  },

  // Full session start (resets everything including round wins)
  start(){
    this.round=0;
    ARENA.pick(); // choose arena shape for this match
    C.COUNT = 6 + Math.floor(Math.random() * 9); // random 6–14 players (boss mode needs room)
    // forcedMode: 'solo'=individual, 'team'=team, 'boss'=boss fight, 'dungeon'=dungeon crawler, null=random
    const ab = _getAutoBatch();
    const modeHint = ab.autoBatchActive ? ab.autoBatchSequence[ab.autoBatchPart-1] : ab.forcedMode;
    this.dungeonMode = modeHint==='dungeon';
    this.bossMode = !this.dungeonMode && modeHint==='boss';
    this.teamMode = this.bossMode||this.dungeonMode ? false : modeHint==='team' ? true : modeHint==='solo' ? false : Math.random()<0.5;
    this.bossWon = false;
    if(this.dungeonMode){
      ARENA.shape='circle'; ARENA.r=AR; // dungeon always uses circle arena
      this.dungeonRoom=0;
      this.dungeonTotalRooms=C.DUNGEON.TOTAL_ROOMS;
      this.dungeonPlayer=null;
      this.dungeonBoss=null;
      this.dungeonGameOver=false;
      this.dungeonVictory=false;
      this.dungeonHealTimer=0;
      this.dungeonEnemyAbilityTimer=0;
      this.dungeonBossAbilityTimer=0;
      this.dungeonRoomSlideOffset=0;
      this.teams=[];
      C.COUNT=1; // only player in "count"
      const sz=20; // max possible balls
      this.roundWins=new Array(sz).fill(0);
      this.champion=null;
      this.totalDmg=new Array(sz).fill(0);
      this.roundFrames=0;
      this.suddenDeathActive=false;
      try{ _Snd.stopMusic(); }catch(e){}
      this.startDungeonRoom();
      return;
    }
    if(this.teamMode) this.buildTeams();
    else this.teams=[];
    const sz = this.bossMode ? C.COUNT+1 : this.teamMode ? this.teams.length : C.COUNT;
    this.roundWins=new Array(sz).fill(0);
    this.champion=null;
    this.totalDmg=new Array(sz).fill(0);
    this.roundFrames=0;
    this.suddenDeathActive=false;
    // Reset music intensity
    try{ _Snd.stopMusic(); }catch(e){}
    this.startRound();
  },

  // ════════════════════════════════════════════════
  // DUNGEON MODE
  // ════════════════════════════════════════════════
  startDungeonRoom(){
    this.dungeonRoom++;
    this.roundWinner=null;
    this.winner=null;
    this.dungeonRoomFrames=0;
    this.dungeonHealTimer=0;
    this.dungeonEnemyAbilityTimer=0;
    this.dungeonBossAbilityTimer=0;
    this.dungeonKillsThisRoom=0;
    this.spawnDungeonRoom();
    if(this.dungeonRoom===1){
      this.state='countdown';
      this.countdown=60;
      this.round=1;
      _triggerRoundTransition();
    }
    // For rooms > 1, state stays as 'roomTransition' — main loop sets it to 'running' when animation ends
  },

  spawnDungeonRoom(){
    // Clear FX, particles, orbs, cooldowns
    this.cd={};
    _orbs.length=0; _orbSpawnTimer=0; _orbRoundFrame=0; _stallOrbTimer=0; _stallOrbActive=false; _stallOrbCycle=0;
    if(_resetOrbTimers) _resetOrbTimers();
    _FX.reset();
    _CAM.phase='off'; _CAM.zoom=1.0; _CAM.tgtZoom=1.0;
    _CAM.focX=ACX; _CAM.focY=ACY; _CAM.tgtX=ACX; _CAM.tgtY=ACY;
    _CAM.timer=0; _CAM.showCard=false; _CAM.impactAlpha=0; _CAM.resultTimer=0;
    this.eliminationOrder=[];
    this.lastTwoShown=false; this.lastTwoTimer=0;
    this.stallTimer=0; this.arenaFlash.alpha=0;
    _parts.length=0;
    ARENA.r=AR; // reset arena radius
    this.suddenDeathActive=false;

    const room = this.dungeonRoom;
    const isBossRoom = room === this.dungeonTotalRooms;
    // Set room rect bounds
    this.dungeonRoomRect = getDungeonRoomRect(room);

    // ── Calculate enemies for this room ──
    let numEnemies, enemyHp;
    if(isBossRoom){
      numEnemies = 1; // just the boss (+ 2 minions maybe)
      enemyHp = C.DUNGEON.BOSS_HP;
    } else {
      // Scale: room 1→2 enemies, room 5→8 enemies
      numEnemies = Math.min(10, 1 + room + Math.floor(Math.random()*2));
      // More enemies = less HP each (balance)
      const hpMult = numEnemies <= 3 ? 1.2 : numEnemies <= 5 ? 1.0 : numEnemies <= 7 ? 0.8 : 0.65;
      enemyHp = Math.max(5, Math.floor(C.DUNGEON.ENEMY_BASE_HP * hpMult * (1 + room*0.1)));
      // Also consider player current HP — if player is low, fewer/weaker enemies
      if(this.dungeonPlayer && this.dungeonPlayer.hp < C.DUNGEON.PLAYER_HP * 0.3){
        numEnemies = Math.max(2, numEnemies - 2);
        enemyHp = Math.max(5, Math.floor(enemyHp * 0.7));
      }
    }
    this.dungeonTotalEnemiesInRoom = isBossRoom ? numEnemies + 2 : numEnemies; // boss room adds 2 minions

    // ── Preserve or create player ──
    const oldBalls = this.balls;
    this.balls = [];

    if(this.dungeonRoom === 1){
      // Create player ball
      const s = C.MIN_SPD + Math.random()*(C.MAX_SPD-C.MIN_SPD);
      const a = Math.random()*Math.PI*2;
      const player = new _Ball(0, ACX, ACY, Math.cos(a)*s, Math.sin(a)*s);
      player.isDungeonPlayer = true;
      player.hp = player.max = C.DUNGEON.PLAYER_HP;
      player.r = C.DUNGEON.PLAYER_R;
      player.color = C.DUNGEON.PLAYER_COLOR;
      player.name = C.DUNGEON.PLAYER_NAME;
      player.bonusHp = 0;
      this.dungeonPlayer = player;
      this.balls.push(player);
    } else {
      // Keep existing player
      const p = this.dungeonPlayer;
      p.id = 0;
      p.trail = [];
      // Move player to center of new room
      p.x = ACX; p.y = ACY;
      const s = C.MIN_SPD + Math.random()*(C.MAX_SPD-C.MIN_SPD);
      const a = Math.random()*Math.PI*2;
      p.vx = Math.cos(a)*s; p.vy = Math.sin(a)*s;
      p.flash = 0; p.rage = 0;
      p.shieldFrames = 0; p.ghostFrames = 0; p.giantActive = false;
      p.giantFrames = 0; p.magnetFrames = 0; p.freezeFrames = 0;
      p.blackHoleFrames = 0; p.kamehame = false;
      this.balls.push(p);
    }

    // ── Spawn enemies ──
    const rr = this.dungeonRoomRect;
    for(let i=0; i<numEnemies; i++){
      const eid = i + 1;
      let x, y, ok, t=0;
      const margin = C.DUNGEON.ENEMY_R * 2;
      do {
        ok=true;
        // Spawn in outer zone of the rectangular room
        x = rr.left + margin + Math.random()*(rr.w - margin*2);
        y = rr.top + margin + Math.random()*(rr.h - margin*2);
        // Keep away from center (where player spawns)
        if(Math.hypot(x-ACX,y-ACY) < 80) ok=false;
        else for(const b of this.balls) if(Math.hypot(b.x-x,b.y-y)<(C.DUNGEON.ENEMY_R+b.r)*1.5){ok=false;break;}
      } while(!ok && ++t<200);
      // Aim toward player
      const toCenter = Math.atan2(ACY-y, ACX-x) + (Math.random()-0.5)*Math.PI*0.5;
      const s = C.MIN_SPD + Math.random()*(C.MAX_SPD-C.MIN_SPD);
      const enemy = new _Ball(eid, x, y, Math.cos(toCenter)*s, Math.sin(toCenter)*s);
      enemy.isDungeonEnemy = true;
      enemy.r = isBossRoom && i===0 ? C.DUNGEON.BOSS_R : C.DUNGEON.ENEMY_R;
      enemy.hp = enemy.max = isBossRoom && i===0 ? enemyHp : enemyHp;
      enemy.color = isBossRoom && i===0 ? C.DUNGEON.BOSS_COLOR : C.COLORS[(eid)%C.COLORS.length];
      enemy.name = isBossRoom && i===0 ? C.DUNGEON.BOSS_NAME : `E${eid}`;
      if(isBossRoom && i===0){
        enemy.isDungeonBoss = true;
        enemy.isDungeonEnemy = false;
        this.dungeonBoss = enemy;
      }
      this.balls.push(enemy);
    }
    // Boss room: add 2 minions
    if(isBossRoom){
      for(let m=0; m<2; m++){
        const mid = numEnemies + 1 + m;
        const margin2 = C.DUNGEON.ENEMY_R * 3;
        let x = rr.left + margin2 + Math.random()*(rr.w - margin2*2);
        let y = rr.top + margin2 + Math.random()*(rr.h - margin2*2);
        const s = C.MIN_SPD + Math.random()*(C.MAX_SPD-C.MIN_SPD);
        const minion = new _Ball(mid, x, y, Math.cos(ea+Math.PI)*s, Math.sin(ea+Math.PI)*s);
        minion.isDungeonEnemy = true;
        minion.r = C.DUNGEON.ENEMY_R;
        minion.hp = minion.max = Math.floor(C.DUNGEON.ENEMY_BASE_HP * 1.5);
        minion.color = C.COLORS[(mid+3)%C.COLORS.length];
        minion.name = `GUARD${m+1}`;
        this.balls.push(minion);
      }
    }

    // Setup cooldowns
    for(let a=0;a<this.balls.length;a++) for(let b=a+1;b<this.balls.length;b++) this.cd[`${this.balls[a].id}:${this.balls[b].id}`]=0;

    // Leaderboard/dmg arrays sized for all balls
    const sz = this.balls.length;
    this.lbTargets=new Array(sz).fill(0);
    this.lbWidths=new Array(sz).fill(0);
    // Accumulate previous room's damage into totalDmg before resetting
    if(this.totalDmg && this.roundDmg) for(let i=0;i<20;i++) this.totalDmg[i]=(this.totalDmg[i]||0)+(this.roundDmg[i]||0);
    this.roundDmg=new Array(20).fill(0);
    this.dmgFlash=new Array(20).fill(0);
    this.roundFrames=0;
  },

  dungeonAliveEnemies(){
    return this.balls.filter(b=>b.alive && !b.isDungeonPlayer);
  },

  checkDungeonEnd(){
    if(!this.dungeonMode) return;
    const player = this.dungeonPlayer;
    if(!player || !player.alive){
      // Player died — game over
      this.dungeonGameOver = true;
      this.roundWinner = null;
      this.state='roundEndDelay'; this.roundEndDelayTimer=120;
      return;
    }
    const enemies = this.dungeonAliveEnemies();
    if(enemies.length === 0){
      // Room cleared!
      if(this.dungeonRoom >= this.dungeonTotalRooms){
        // Boss room cleared — VICTORY
        this.dungeonVictory = true;
        this.roundWinner = player;
        this.state='roundEndDelay'; this.roundEndDelayTimer=120;
      } else {
        // Move to next room
        this.state='roomTransition';
        this.dungeonRoomTransFrame = C.DUNGEON.ROOM_TRANSITION_DUR;
        this.dungeonRoomSlideOffset = 0;
      }
    }
  },

  // Start next round
  startRound(){
    this.round++;
    this.roundWinner=null;
    this.winner=null;
    this.spawnBalls();
    this.state='countdown';
    this.countdown = 60; // intro screen now shown during early running frames (so it's recorded)
    this.roundFrames = 0;
    this.suddenDeathActive = false;
    _triggerRoundTransition();
  },

  alive(){ return this.balls.filter(b=>b.alive); },
  key(a,b){ return a.id<b.id?`${a.id}:${b.id}`:`${b.id}:${a.id}`; },

  updateLeaderboard(){
    if(this.bossMode || this.dungeonMode) return; // boss/dungeon mode use dedicated HP bars
    if(this.teamMode){
      // Team leaderboard: damage dealt this round
      const maxDmgT=Math.max(1,...this.teams.map(t=>this.roundDmg[t.id]||0));
      this.teams.forEach(t=>{
        const target=((this.roundDmg[t.id]||0)/maxDmgT)*LB_BAR_MAX;
        this.lbTargets[t.id]=target;
        this.lbWidths[t.id]+=(target-this.lbWidths[t.id])*0.08;
      });
    } else {
      const maxDmg=Math.max(1,...this.roundDmg);
      this.balls.forEach(b=>{
        const target=(this.roundDmg[b.id]/maxDmg)*LB_BAR_MAX;
        this.lbTargets[b.id]=target;
        this.lbWidths[b.id]+=(target-this.lbWidths[b.id])*0.08;
      });
      const sorted=[...this.balls].sort((a,b)=>{
        const da=this.roundDmg[a.id], db=this.roundDmg[b.id];
        if(da!==db) return db-da;
        return a.id-b.id;
      });
      sorted.forEach((b,rank)=>{
        b.lbPrevRank=b.lbRank;
        b.lbRank=rank;
        const targetY = rank < 4
          ? LB_Y + rank*(LB_BAR_H+LB_BAR_GAP)
          : LB_Y + 4*(LB_BAR_H+LB_BAR_GAP) + 60;
        b.lbY += (targetY - b.lbY) * 0.1;
        if(rank<b.lbPrevRank && rank<4){
          b.lbRankUpFlash=25;
          _ringBurst(LB_X+this.lbWidths[b.id]+LB_BALL_R, b.lbY+LB_BAR_H/2, b.color);
          _Snd.rankUp();
        }
      });
    }
  },

  checkEnd(){
    const a=this.alive();
    if(this.bossMode){
      // Boss mode: ends when boss dies OR all hunters die
      const bossAlive = this.bossBall && this.bossBall.alive;
      const huntersAlive = a.filter(b=>!b.isBoss);
      if(this.state==='running'){
        if(!bossAlive){
          // Hunters win
          this.bossWon=false;
          this.roundWinner = huntersAlive.length>0 ? huntersAlive[0] : null;
          this.state='roundEndDelay'; this.roundEndDelayTimer=150;
        } else if(huntersAlive.length===0){
          // Boss wins
          this.bossWon=true;
          this.roundWinner = this.bossBall;
          this.state='roundEndDelay'; this.roundEndDelayTimer=150;
        }
      }
      return;
    }
    if(this.teamMode){
      const aliveTeams=[...new Set(a.map(b=>b.teamId))];
      if(!this.lastTwoShown && aliveTeams.length===2 && this.state==='running'){
        this.lastTwoShown=true; this.lastTwoTimer=150; _Snd.lastTwo();
      }
      if(aliveTeams.length<=1 && this.state==='running'){
        const winTeamId=aliveTeams[0]??-1;
        this.roundWinner=winTeamId>=0?this.teams[winTeamId]:null;
        this.state='roundEndDelay'; this.roundEndDelayTimer=150;
      }
    } else {
      if(!this.lastTwoShown&&a.length===2&&this.state==='running'){
        this.lastTwoShown=true; this.lastTwoTimer=150; _Snd.lastTwo();
      }
      if(a.length<=1&&this.state==='running'){
        this.roundWinner=a[0]??null;
        this.state='roundEndDelay'; this.roundEndDelayTimer=150;
      }
    }
  },

  resolveRoundEnd(){
    // Dungeon mode: skip podium, go straight to champion screen
    if(this.dungeonMode){
      if(this.totalDmg && this.roundDmg) for(let i=0;i<20;i++) this.totalDmg[i]=(this.totalDmg[i]||0)+(this.roundDmg[i]||0);
      _Snd.roundEnd(); _Snd.resetMusicVolume();
      this.champion = this.dungeonVictory ? this.dungeonPlayer : null;
      this.state='champion';
      this.championTimer=0;
      return;
    }
    const sz = this.bossMode ? C.COUNT+1 : this.teamMode ? this.teams.length : C.COUNT;
    for(let i=0;i<sz;i++) this.totalDmg[i]=(this.totalDmg[i]||0)+(this.roundDmg[i]||0);
    if(this.roundWinner){
      const wid = this.roundWinner.id;
      if(wid !== undefined && wid >= 0) this.roundWins[wid]=(this.roundWins[wid]||0)+1;
    }
    this.updateLeaderboard();
    _Snd.roundEnd(); _Snd.resetMusicVolume();
    // Boss mode: always single round → go straight to champion screen
    if(this.bossMode){
      this.champion = this.bossWon ? this.bossBall : (this.balls.find(b=>!b.isBoss&&b.alive) ?? this.balls.find(b=>!b.isBoss));
      this.state='podium';
      this.podiumTimer=0; this.podiumSlot=0; this.podiumPhase=0;
      return;
    }
    if(this.round >= C.ROUNDS_TO_WIN){
      // Winner = most round wins; tie-break = most total damage
      if(this.teamMode){
        const sorted=[...this.teams].sort((a,b)=>{
          const wDiff=(this.roundWins[b.id]??0)-(this.roundWins[a.id]??0);
          return wDiff!==0 ? wDiff : (this.totalDmg[b.id]??0)-(this.totalDmg[a.id]??0);
        });
        this.champion=sorted[0];
      } else {
        const sorted=[...this.balls].sort((a,b)=>{
          const wDiff=(this.roundWins[b.id]??0)-(this.roundWins[a.id]??0);
          return wDiff!==0 ? wDiff : (this.totalDmg[b.id]??0)-(this.totalDmg[a.id]??0);
        });
        this.champion=sorted[0];
      }
      this.state='podium';
      this.podiumTimer=0; this.podiumSlot=0; this.podiumPhase=0;
      return;
    }
    this.state='roundEnd';
    this.roundTimer=90;
  },
};
// ✅ COMPLETO
