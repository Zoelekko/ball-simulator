// ════════════════════════════════════════════════
// TEAM HELPERS + BALL
// ════════════════════════════════════════════════
import { C, ACX, ACY, LB_Y, LB_BAR_H, LB_BAR_GAP } from './constants.js';

// Late-binding deps
let _G = null, _CAM = null, _FX = null, _burst = null, _getStall = null, _setStall = null;
export function initBall(deps){
  _G = deps.G;
  _CAM = deps.CAM;
  _FX = deps.FX;
  _burst = deps.burst;
  _getStall = deps.getStall;
  _setStall = deps.setStall;
}

// ════════════════════════════════════════════════
// TEAM HELPERS
// ════════════════════════════════════════════════
export function isEnemy(actor, target){
  if(_G.dungeonMode){
    // Player fights all enemies; enemies fight only the player
    if(actor.isDungeonPlayer) return !target.isDungeonPlayer;
    if(target.isDungeonPlayer) return true;
    return false; // enemies don't fight each other
  }
  if(_G.bossMode){
    // Hunters only target the boss; boss targets hunters
    if(actor.isBoss) return !target.isBoss;
    return target.isBoss;
  }
  if(!_G.teamMode) return target.id !== actor.id;
  return target.teamId !== actor.teamId;
}
export function addDmg(ball, amount){
  const key = _G.teamMode ? ball.teamId : ball.id;
  if(key === undefined || key < 0) return;
  _G.roundDmg[key] = (_G.roundDmg[key]||0) + amount;
  _G.dmgFlash[ball.id] = 12;
}

// ════════════════════════════════════════════════
// BALL
// ════════════════════════════════════════════════
export class Ball {
  constructor(id,x,y,vx,vy){
    this.id=id; this.x=x; this.y=y; this.vx=vx; this.vy=vy;
    this.r=C.BALL_R; this.hp=this.max=C.MAX_HP; this.bonusHp=0;
    if(_G.teamMode){
      const t=_G.teams.find(t=>t.memberIds.includes(id));
      this.teamId=t?t.id:-1;
      this.color=t?C.TEAM_COLORS[t.id]:C.COLORS[id];
      this.name=C.NAMES[id];
    } else {
      this.teamId=-1;
      this.color=C.COLORS[id]; this.name=C.NAMES[id];
    }
    this.isBoss=false;
    this.isDungeonPlayer=false;
    this.isDungeonEnemy=false;
    this.isDungeonBoss=false;
    this.alive=true; this.flash=0; this.rage=0;
    this.baseSpd=Math.hypot(vx,vy);
    this.trail=[]; this.streak=0;
    // Leaderboard
    this.score=0;           // kills*100 + damage dealt
    this.lbX=0;             // current animated bar width (px)
    this.lbRank=id;         // current rank (0=leader)
    this.lbPrevRank=id;
    this.lbRankUpFlash=0;   // frames of rank-up flash
    this.lbY=LB_Y+id*(LB_BAR_H+LB_BAR_GAP); // animated Y position
    // Orb abilities
    this.shieldFrames=0; this.ghostFrames=0; this.giantActive=false;
    this.giantFrames=0; this.magnetFrames=0; this.freezeFrames=0;
    this.blackHoleFrames=0; this.kamehame=false;
  }
  move(){
    // Hard speed cap — prevents runaway velocity from breaking the layout
    const spd=Math.hypot(this.vx,this.vy);
    if(spd>28){ const s=28/spd; this.vx*=s; this.vy*=s; }
    this.trail.push({x:this.x,y:this.y});
    if(this.trail.length>C.TRAIL_LEN) this.trail.shift();
    // Dungeon: enemies drift toward player for constant combat
    if(_G.dungeonMode && (this.isDungeonEnemy || this.isDungeonBoss) && _G.dungeonPlayer && _G.dungeonPlayer.alive){
      const dx=_G.dungeonPlayer.x-this.x, dy=_G.dungeonPlayer.y-this.y, d=Math.hypot(dx,dy)||1;
      const homingStr = this.isDungeonBoss ? 0.25 : 0.18;
      this.vx += (dx/d)*homingStr; this.vy += (dy/d)*homingStr;
    }
    // Cinematic slowmo: scale movement by physSpeed (runs every frame for smooth 60fps)
    const sm = _CAM.active ? _CAM.physSpeed() : 1;
    this.x+=this.vx*sm; this.y+=this.vy*sm;
    if(this.flash>0) this.flash--;
    if(this.rage>0)  this.rage--;
    if(this.lbRankUpFlash>0) this.lbRankUpFlash--;
    // Decay bonus HP back to base (full bonus decays over ~5s)
    if(this.bonusHp>0){
      const rate=C.MAX_HP/(60*5); // lose all bonus in 5 seconds
      this.bonusHp=Math.max(0,this.bonusHp-rate);
      this.hp=Math.max(this.max, this.max+this.bonusHp);
    }
    if(this.shieldFrames>0) this.shieldFrames--;
    if(this.ghostFrames>0)  this.ghostFrames--;
    if(this.magnetFrames>0) this.magnetFrames--;
    if(this.freezeFrames>0) this.freezeFrames--;
    if(this.blackHoleFrames>0) this.blackHoleFrames--;
    if(this.giantFrames>0){ this.giantFrames--; if(this.giantFrames===0){ this.r=C.BALL_R; this.giantActive=false; } }
    // Timestop: freeze if not the owner — save velocity on entry, restore on exit
    if(this.id!==_FX.timestopOwner){
      if(_FX.timestopFrames>0){
        // Save velocity the first frame we get frozen (frozenVx undefined = not yet saved)
        if(this.frozenVx===undefined){
          this.frozenVx = Math.hypot(this.vx,this.vy)>0.1 ? this.vx : (this.baseSpd*(Math.random()<0.5?1:-1));
          this.frozenVy = Math.hypot(this.vx,this.vy)>0.1 ? this.vy : (this.baseSpd*(Math.random()<0.5?1:-1));
        }
        this.vx=0; this.vy=0;
      } else if(this.frozenVx!==undefined){
        // Timestop just ended — restore saved velocity
        this.vx=this.frozenVx; this.vy=this.frozenVy;
        this.frozenVx=undefined; this.frozenVy=undefined;
      }
    }
    // Prison: frozen if targeted — save/restore velocity same as timestop
    if(this.id===_FX.prisonTarget){
      if(_FX.prisonFrames>0){
        if(this.prisonVx===undefined){
          this.prisonVx = Math.hypot(this.vx,this.vy)>0.1 ? this.vx : this.baseSpd*(Math.random()<0.5?1:-1);
          this.prisonVy = Math.hypot(this.vx,this.vy)>0.1 ? this.vy : this.baseSpd*(Math.random()<0.5?1:-1);
        }
        this.vx=0; this.vy=0;
      } else if(this.prisonVx!==undefined){
        this.vx=this.prisonVx; this.vy=this.prisonVy;
        this.prisonVx=undefined; this.prisonVy=undefined;
      }
    }
    // Sandevistan: slow others — but don't let speed decay to 0, floor at baseSpd*0.15
    if(_FX.sandevistanFrames>0 && this.id!==_FX.sandevistanOwner){
      this.vx*=0.5; this.vy*=0.5;
      const s=Math.hypot(this.vx,this.vy);
      const floor=this.baseSpd*0.15;
      if(s>0&&s<floor){ this.vx=this.vx/s*floor; this.vy=this.vy/s*floor; }
    }
    // Freeze slows velocity
    if(this.freezeFrames>0){ this.vx*=0.92; this.vy*=0.92; }
    // Magnet: pull other alive balls toward this one
    if(this.magnetFrames>0){
      for(const ob of _G.balls){
        if(!ob.alive||ob.id===this.id) continue;
        const dx=this.x-ob.x, dy=this.y-ob.y, d=Math.hypot(dx,dy);
        if(d>0&&d<200){ ob.vx+=dx/d*0.8; ob.vy+=dy/d*0.8; }
      }
    }
    // Black hole: pull everyone to center of arena
    if(this.blackHoleFrames>0){
      for(const ob of _G.balls){
        if(!ob.alive) continue;
        const dx=ACX-ob.x, dy=ACY-ob.y, d=Math.hypot(dx,dy);
        if(d>0){ ob.vx+=dx/d*2.5; ob.vy+=dy/d*2.5; }
      }
    }
  }
  hit(dmg=1){
    if(this.shieldFrames>0){ this.flash=C.FLASH; return; } // shield absorbs hit
    if(this.isBoss) dmg=Math.min(dmg, C.BOSS.DMG_IN_CAP); // boss resists ability burst damage
    if(this.isDungeonPlayer) dmg=Math.min(dmg, C.DUNGEON.HIT_CAP_PLAYER); // dungeon player resists burst
    if(this.isDungeonBoss) dmg=Math.min(dmg, 6); // cap per-hit so no single tick one-shots
    this.hp-=dmg;
    // Reset stall detection — someone got hit, action is happening
    _setStall(0, false, 0);
    if(this.bonusHp>0) this.bonusHp=Math.max(0,this.bonusHp-dmg);
    if(this.hp<=0){ this.alive=false; _burst(this.x,this.y,this.color); _G.eliminationOrder.push(this.id); }
    this.flash=C.FLASH;
  }
  addScore(pts){
    this.score+=pts;
  }
  triggerRage(){
    this.rage=C.RAGE_FRAMES;
    const s=Math.hypot(this.vx,this.vy)||this.baseSpd;
    const t=Math.max(s,this.baseSpd)*C.RAGE_MULT;
    this.vx=this.vx/s*t; this.vy=this.vy/s*t;
  }
  wallSpeedUp(){
    this.baseSpd=Math.min(this.baseSpd*(1+C.WALL_SPD_INC), C.BASE_SPD_CAP);
    const cur=Math.hypot(this.vx,this.vy);
    if(cur>0){
      const ns=this.rage>0?Math.max(cur,this.baseSpd*C.RAGE_MULT):Math.max(cur*(1+C.WALL_SPD_INC),this.baseSpd);
      this.vx=this.vx/cur*ns; this.vy=this.vy/cur*ns;
    }
  }
  cap(){
    const limit=this.rage>0?C.BASE_SPD_CAP*C.RAGE_MULT:C.BASE_SPD_CAP;
    const s=Math.hypot(this.vx,this.vy);
    if(s>limit){this.vx=this.vx/s*limit;this.vy=this.vy/s*limit;}
  }
}
// ✅ COMPLETO
