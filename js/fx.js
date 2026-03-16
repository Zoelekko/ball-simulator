// ════════════════════════════════════════════════
// FX — Active special effects (projectiles, zones, etc.)
// ════════════════════════════════════════════════
import { C, ACX, ACY, AR } from './constants.js';
import { ARENA } from './arena.js';

// Late-binding deps (resolved in main.js after all modules load)
let _isEnemy = null, _addDmg = null, _burst = null, _parts = null, _G = null, _CAM = null;
export function initFX(deps){
  _isEnemy = deps.isEnemy;
  _addDmg  = deps.addDmg;
  _burst   = deps.burst;
  _parts   = deps.parts;
  _G       = deps.G;
  _CAM     = deps.CAM;
}

// Aliases resolved at runtime
function isEnemy(a,b){ return _isEnemy(a,b); }
function addDmg(ball,amt){ return _addDmg(ball,amt); }
function burst(x,y,color,n){ return _burst(x,y,color,n); }
function getG(){ return _G; }
function getCAM(){ return _CAM; }
function getParts(){ return _parts; }

export const FX = {
  sandevistanFrames: 0,  // global slowmo active (which ball owns it)
  sandevistanOwner: -1,
  timestopFrames: 0,
  timestopOwner: -1,
  prisonTarget: -1,
  prisonFrames: 0,
  chains: [],      // {x1,y1,x2,y2,life,max,ownerId,targetId}
  voidBeam: null,  // {x,y,angle,life,max,ownerId} — Gojo Purple beam
  portals: [],     // {x,y,life,partnerId,color}
  rewindGhosts: [],// snapshot history for rewind [{balls:[{id,x,y,hp}]}, ...]
  ekkoGhosts: [],  // [{id,x,y,color,life}] ghost afterimages
  explosions: [],  // {x,y,r,maxR,life,max,color}
  // Black Clover
  hellfireZone: null,    // {x,y,r,life,max,ownerId,intensity}
  spatialCubes: [],      // [{x,y,size,angle,life,max,targetId}]
  zephyrBlade: null,     // {x,y,vx,vy,life,max,ownerId,angle,width}
  blackAstaFrames:0, blackAstaOwner:-1,
  yamiSlash: null,       // {x1,y1,x2,y2,life,max,ownerId,angle}
  // JJK
  sukunaShrine: null,   // {x,y,r,life,max,ownerId,angle}
  sukunaCleaves: [],    // [{x1,y1,x2,y2,life,max,ownerId}]
  mahoragaZone: null,   // {x,y,r,life,max,ownerId, adapted:[]}
  bloodStreams: [],      // [{x,y,vx,vy,life,max,ownerId,homed}]
  rikaZone: null,       // {ownerId,r,life,max}
  hakariFrames: 0, hakariOwner: -1, hakariJackpot: 0,
  // Naruto
  rasengan: null,  // {x,y,vx,vy,r,life,max,ownerId,angle}  — traveling spiral orb
  chidori: null,   // {x,y,angle,life,max,ownerId}  — piercing lightning bolt
  tsukuyomiTarget: -1, tsukuyomiFrames: 0, tsukuyomiOwner: -1,
  sandWave: null,  // {x,y,r,maxR,life,max,ownerId}  — expanding sand ring
  // Slime Isekai
  dragoNova: null,       // {x,y,r,maxR,life,max,ownerId, shards:[]}
  megiddoBeams: [],      // [{x,y,angle,life,max,ownerId}]
  veldoraStorm: null,    // {x,y,r,life,max,ownerId,angle}
  prominenceDragon: null,// {x,y,life,max,ownerId,angle,size}
  diabloVortex: null,    // {x,y,r,life,max,ownerId}
  // Chainsaw Man
  chainsawRev: null,     // {x,y,angle,life,max,ownerId,spokes:[]}
  bloodSpears: [],       // [{x,y,vx,vy,life,max,ownerId}]
  makimaChains: [],      // [{x,y,tx,ty,life,max,targetId,ownerId}]
  futureDevil: null,     // {ownerId,life,max,dodgeFrames,counterAngle}
  pochitaCore: null,     // {x,y,r,maxR,life,max,ownerId}
  // One Punch Man
  seriousPunch: null,    // {x,y,vx,vy,r,life,max,ownerId}
  incinerateBeam: null,  // {x,y,angle,life,max,ownerId,width}
  tornadoPsy: null,      // {ownerId,life,max,r,angle}
  silverFangWave: null,  // {x,y,r,maxR,life,max,ownerId}
  sonicSlashes: [],      // [{x1,y1,x2,y2,life,max,ownerId}]
  // Frieren
  zoltraakBeams: [],     // [{x,y,vx,vy,life,max,ownerId,r}]
  granatOrb: null,       // {x,y,r,maxR,life,max,ownerId,phase}
  auraSoul: null,        // {ownerId,life,max}
  starkThunder: null,    // {x,y,r,maxR,life,max,ownerId,rings:[]}
  frierenEnd: null,      // {x,y,r,maxR,life,max,ownerId,shards:[]}
  // Eminence in Shadow
  atomicBlast: null,     // {x,y,r,maxR,life,max,ownerId}
  shadowSlash: null,     // {x,y,angle,life,max,ownerId,len}
  deltaSlashes: [],      // [{x1,y1,x2,y2,life,max,ownerId}]
  gammaBeam: null,       // {x,y,angle,life,max,ownerId}
  betaBlades: [],        // [{x,y,angle,life,max,ownerId,side}]
  // Overlord
  ainzZone: null,        // {x,y,r,life,max,ownerId}
  albedoShield: null,    // {ownerId,life,max,r}
  shalltearAura: null,   // {ownerId,life,max,r}
  cocytusZone: null,     // {x,y,r,life,max,ownerId}
  demiurgeLegs: [],      // [{x,y,angle,life,max,ownerId}]
  // Noragami
  yatoCuts: [],          // [{x1,y1,x2,y2,life,max,ownerId}]
  yukinePulse: null,     // {x,y,r,maxR,life,max,ownerId}
  bishArr: [],           // [{x,y,vx,vy,life,max,ownerId}]
  noraBeads: [],         // [{x,y,targetId,life,max,ownerId}]
  veenaLightning: [],    // [{x1,y1,x2,y2,life,max,ownerId}]
  // Mushoku Tensei
  quagmireZone: null,    // {x,y,r,life,max,ownerId,angle}
  northGodDash: null,    // {ownerId,life,max}
  orstedAura: null,      // {ownerId,r,life,max}
  roxyBeam: null,        // {x,y,angle,life,max,ownerId}
  sylphieStorm: null,    // {x,y,r,life,max,ownerId,angle}
  // Date A Live
  zafkielBullet: null,   // {x,y,vx,vy,life,max,ownerId,targetId}
  sandalphonCrash: null, // {x,y,r,maxR,life,max,ownerId}
  origamiFeathers: [],   // [{x,y,vx,vy,life,max,ownerId}]
  shidoWave: null,       // {x,y,r,maxR,life,max,ownerId}
  mikusonic: null,       // {ownerId,life,max,r,angle}

  tick(balls, frame){
    const G = getG();
    const CAM = getCAM();
    const parts = getParts();
    // O(1) ball lookup — replaces all ballMap.get(X) calls
    const ballMap = new Map();
    for(const b of balls) ballMap.set(b.id, b);
    ARENA.tick(balls);
    if(this.sandevistanFrames>0) this.sandevistanFrames--;
    if(this.timestopFrames>0)    this.timestopFrames--;
    if(this.prisonFrames>0)      this.prisonFrames--;

    // Performance: count active effects — skip expensive checks on odd frames when overloaded
    const fxCount = this.chains.length + this.sukunaCleaves.length + this.bloodStreams.length
      + this.bloodSpears.length + this.sonicSlashes.length + this.zoltraakBeams.length
      + this.megiddoBeams.length + this.makimaChains.length + this.demiurgeLegs.length
      + this.bishArr.length + this.origamiFeathers.length + this.veenaLightning.length
      + this.betaBlades.length + this.deltaSlashes.length + this.yatoCuts.length
      + this.noraBeads.length + this.bloodSpears.length;
    // When overloaded: skip collision checks on odd frames for array-based effects
    const skipCollision = fxCount > 12 && (frame&1)===1;

    // Snapshot for rewind every 4 frames
    if(frame%4===0){
      this.rewindGhosts.push(balls.map(b=>({id:b.id,x:b.x,y:b.y,hp:b.hp,alive:b.alive})));
      if(this.rewindGhosts.length>75) this.rewindGhosts.shift();
    }

    // Chains
    for(let i=this.chains.length-1;i>=0;i--){
      const c=this.chains[i]; c.life--;
      if(c.life<=0){ this.chains.splice(i,1); continue; }
      // Chain deals damage tick
      if(c.targetId>=0 && c.life%20===0){
        const target=(()=>{const _bm=ballMap.get(c.targetId);return _bm&&_bm.alive?_bm:null;})();
        if(target){ target.hit(); const ownerBall=ballMap.get(c.ownerId); if(ownerBall) addDmg(ownerBall,15); else G.dmgFlash[c.ownerId]=8; }
      }
    }

    // Void beam
    if(this.voidBeam){
      this.voidBeam.life--;
      if(this.voidBeam.life<=0){ this.voidBeam=null; }
      else {
        // Beam hitbox: line from owner outward, damage anything in path
        const bm=this.voidBeam;
        const len=ARENA.r*1.5;
        const bm_owner=ballMap.get(bm.ownerId);
        for(const b of balls){
          if(!b.alive||(bm_owner?!isEnemy(bm_owner,b):b.id===bm.ownerId)) continue;
          // Point-to-line distance
          const dx=b.x-(ACX+Math.cos(bm.angle)*0), dy=b.y-(ACY+Math.sin(bm.angle)*0);
          const lx=Math.cos(bm.angle), ly=Math.sin(bm.angle);
          const proj=dx*lx+dy*ly;
          if(proj<0||proj>len) continue;
          const perp=Math.abs(dx*ly-dy*lx);
          if(perp<28 && bm.life%8===0){
            if(b.isDungeonPlayer || b.isDungeonBoss || b.isDungeonEnemy){ b.hit(10); } // dungeon entities: cap via hit()
            else { b.hp=0; b.alive=false; burst(b.x,b.y,b.color,24); G.eliminationOrder.push(b.id); }
          }
        }
      }
    }

    // Explosions
    for(let i=this.explosions.length-1;i>=0;i--){
      const e=this.explosions[i]; e.life--;
      e.r=e.maxR*(1-e.life/e.max);
      if(e.life<=0){ this.explosions.splice(i,1); }
    }

    // Portals
    for(let i=this.portals.length-1;i>=0;i--){
      this.portals[i].life--;
      if(this.portals[i].life<=0) this.portals.splice(i,1);
    }

    // Ekko ghosts fade
    for(let i=this.ekkoGhosts.length-1;i>=0;i--){
      this.ekkoGhosts[i].life--;
      if(this.ekkoGhosts[i].life<=0) this.ekkoGhosts.splice(i,1);
    }

    // ── Hellfire scaling aura ──
    if(this.hellfireZone){
      const hf=this.hellfireZone; hf.life--;
      hf.intensity=Math.min(3, hf.intensity+0.008); // scales up over time
      if(hf.life<=0){ this.hellfireZone=null; }
      else {
        const owner=(()=>{const _bm=ballMap.get(hf.ownerId);return _bm&&_bm.alive?_bm:null;})();
        if(owner){ hf.x=owner.x; hf.y=owner.y; }
        const effectR=hf.r*hf.intensity;
        for(const b of balls){
          if(!b.alive||(owner?!isEnemy(owner,b):b.id===hf.ownerId)) continue;
          const d=Math.hypot(b.x-hf.x,b.y-hf.y);
          if(d<effectR){
            // Push outward — stronger closer to center
            const nx=(b.x-hf.x)/(d||1),ny=(b.y-hf.y)/(d||1);
            b.vx+=nx*(1-d/effectR)*hf.intensity*3;
            b.vy+=ny*(1-d/effectR)*hf.intensity*3;
            if(hf.life%15===0){
              b.hit(); const ownerBall=ballMap.get(hf.ownerId); if(ownerBall) addDmg(ownerBall,12*hf.intensity|0); else G.dmgFlash[hf.ownerId]=8;
              burst(b.x,b.y,'#ff6600',6);
            }
          }
        }
        // Spawn fire particles
        if(frame%4===0){
          const a=Math.random()*Math.PI*2, r=Math.random()*effectR;
          parts.length<400&&parts.push({x:hf.x+Math.cos(a)*r,y:hf.y+Math.sin(a)*r,
            vx:(Math.random()-0.5)*3,vy:-2-Math.random()*3,
            r:3+Math.random()*4,color:['#ff6600','#ff4400','#ffaa00'][Math.floor(Math.random()*3)],life:25,max:25});
        }
      }
    }

    // ── Spatial cubes ──
    for(let i=this.spatialCubes.length-1;i>=0;i--){
      const cb=this.spatialCubes[i]; cb.life--; cb.angle+=0.03;
      if(cb.life<=0){ this.spatialCubes.splice(i,1); continue; }
      const target=(()=>{const _bm=ballMap.get(cb.targetId);return _bm&&_bm.alive?_bm:null;})();
      if(target){
        // Lock target in place
        if(cb.frozenVx===undefined){ cb.frozenVx=target.vx; cb.frozenVy=target.vy; }
        target.vx=0; target.vy=0;
        // Tick damage
        if(cb.life%30===0){ target.hit(); const ownerBall=ballMap.get(cb.ownerId); if(ownerBall) addDmg(ownerBall,18); else G.dmgFlash[cb.ownerId]=10; burst(target.x,target.y,'#8800ff',10); }
      }
    }
    // Restore velocity when cubes expire
    balls.forEach(b=>{
      const hasCube=this.spatialCubes.some(c=>c.targetId===b.id);
      if(!hasCube && b.cubeVx!==undefined){ b.vx=b.cubeVx; b.vy=b.cubeVy; b.cubeVx=undefined; b.cubeVy=undefined; }
      if(hasCube && b.cubeVx===undefined){
        b.cubeVx=Math.hypot(b.vx,b.vy)>0.1?b.vx:b.baseSpd*(Math.random()<0.5?1:-1);
        b.cubeVy=Math.hypot(b.vx,b.vy)>0.1?b.vy:b.baseSpd*(Math.random()<0.5?1:-1);
      }
    });

    // ── Zephyr wind blade ──
    if(this.zephyrBlade){
      const zb=this.zephyrBlade; zb.life--;
      zb.x+=zb.vx; zb.y+=zb.vy;
      CAM.setFollow(zb.x, zb.y);
      const zd=Math.hypot(zb.x-ACX,zb.y-ACY);
      if(zb.life<=0||zd>ARENA.r+50){ this.zephyrBlade=null; }
      else {
        const zb_owner=ballMap.get(zb.ownerId);
        for(const b of balls){
          if(!b.alive||(zb_owner?!isEnemy(zb_owner,b):b.id===zb.ownerId)) continue;
          if(Math.hypot(b.x-zb.x,b.y-zb.y)<zb.width+b.r){
            // Momentum transfer — push in blade direction, not away
            b.vx+=zb.vx*0.9; b.vy+=zb.vy*0.9;
            b.hit(); if(zb_owner) addDmg(zb_owner,28); else G.dmgFlash[zb.ownerId]=12;
            burst(b.x,b.y,'#aaddff',14);
            CAM.impact(b.x,b.y,'#aaddff','ZEPHYR!');
          }
        }
        // Star particles trailing
        if(frame%4===0) parts.length<400&&parts.push({x:zb.x+(Math.random()-0.5)*20,y:zb.y+(Math.random()-0.5)*20,
          vx:(Math.random()-0.5)*2,vy:(Math.random()-0.5)*2,r:3,color:'#ffffff',life:20,max:20});
      }
    }

    // ── Black Asta anti-magic ──
    if(this.blackAstaFrames>0){
      this.blackAstaFrames--;
      const owner=(()=>{const _bm=ballMap.get(this.blackAstaOwner);return _bm&&_bm.alive?_bm:null;})();
      if(owner){
        // Devour nearby FX — null existing projectiles
        if(this.rasengan && Math.hypot(this.rasengan.x-owner.x,this.rasengan.y-owner.y)<60){ this.rasengan=null; }
        if(this.zephyrBlade && Math.hypot(this.zephyrBlade.x-owner.x,this.zephyrBlade.y-owner.y)<60){ this.zephyrBlade=null; }
        if(this.chidori && Math.hypot(this.chidori.x-owner.x,this.chidori.y-owner.y)<60){ this.chidori=null; }
        // Short-range anti-magic burst every 20 frames
        if(this.blackAstaFrames%20===0){
          balls.forEach(b=>{
            if(!b.alive||!isEnemy(owner,b)) return;
            const d=Math.hypot(b.x-owner.x,b.y-owner.y);
            if(d<75){ b.hit(); addDmg(owner,20); b.vx+=(b.x-owner.x)/(d||1)*12; b.vy+=(b.y-owner.y)/(d||1)*12; burst(b.x,b.y,'#440000',10); CAM.impact(b.x,b.y,'#111111','ANTI-MAGIC!'); }
          });
        }
      }
    }

    // ── Yami dimension slash ──
    if(this.yamiSlash){
      const ys=this.yamiSlash; ys.life--;
      if(ys.life<=0){ this.yamiSlash=null; }
      else if(ys.life%3===0){
        const ys_owner=ballMap.get(ys.ownerId);
        for(const b of balls){
          if(!b.alive||(ys_owner?!isEnemy(ys_owner,b):b.id===ys.ownerId)) continue;
          const dx=ys.x2-ys.x1,dy=ys.y2-ys.y1,len=Math.hypot(dx,dy)||1;
          const t2=Math.max(0,Math.min(1,((b.x-ys.x1)*dx+(b.y-ys.y1)*dy)/(len*len)));
          const px=ys.x1+t2*dx,py=ys.y1+t2*dy;
          const perp=Math.hypot(b.x-px,b.y-py);
          if(perp<40){
            b.hit(); if(ys_owner) addDmg(ys_owner,35); else G.dmgFlash[ys.ownerId]=14;
            // Slash direction knock
            const sx=dx/len,sy=dy/len;
            b.vx+=sx*14; b.vy+=sy*14;
            burst(b.x,b.y,'#9900ff',16);
            CAM.impact(b.x,b.y,'#220033','DIMENSION CUT!');
            // Dimensional rift particles
            for(let pi=0;pi<6;pi++) parts.length<400&&parts.push({x:b.x+(Math.random()-0.5)*40,y:b.y+(Math.random()-0.5)*40,vx:(Math.random()-0.5)*6,vy:(Math.random()-0.5)*6,r:4,color:'#9900ff',life:30,max:30});
          }
        }
      }
    }

    // ── Sukuna shrine zone ──
    if(this.sukunaShrine){
      const sh = this.sukunaShrine; sh.life--; sh.angle += 0.03;
      if(sh.life <= 0){ this.sukunaShrine = null; }
      else {
        const sh_owner=ballMap.get(sh.ownerId);
        for(const b of balls){
          if(!b.alive||(sh_owner?!isEnemy(sh_owner,b):b.id===sh.ownerId)) continue;
          if(Math.hypot(b.x-sh.x, b.y-sh.y) < sh.r && sh.life%20===0){
            b.hit(); if(sh_owner) addDmg(sh_owner,15); else G.dmgFlash[sh.ownerId]=8;
            burst(b.x,b.y,'#cc0022',8);
          }
        }
      }
    }
    // Sukuna cleave lines
    for(let i=this.sukunaCleaves.length-1;i>=0;i--){
      const cl=this.sukunaCleaves[i]; cl.life--;
      if(cl.life<=0){ this.sukunaCleaves.splice(i,1); continue; }
      if(cl.life%5===0){
        const cl_owner=ballMap.get(cl.ownerId);
        if(skipCollision) continue;
        for(const b of balls){
          if(!b.alive||(cl_owner?!isEnemy(cl_owner,b):b.id===cl.ownerId)) continue;
          // Point-to-segment distance
          const dx=cl.x2-cl.x1, dy=cl.y2-cl.y1, len=Math.hypot(dx,dy)||1;
          const t=Math.max(0,Math.min(1,((b.x-cl.x1)*dx+(b.y-cl.y1)*dy)/(len*len)));
          const px=cl.x1+t*dx, py=cl.y1+t*dy;
          if(Math.hypot(b.x-px,b.y-py)<34){
            b.hit(); if(cl_owner) addDmg(cl_owner,25); else G.dmgFlash[cl.ownerId]=12;
            const nx=(b.x-px)/(Math.hypot(b.x-px,b.y-py)||1);
            const ny=(b.y-py)/(Math.hypot(b.x-px,b.y-py)||1);
            b.vx+=nx*10; b.vy+=ny*10;
            burst(b.x,b.y,'#ff0033',14);
            CAM.impact(b.x,b.y,'#cc0022','CLEAVE!');
          }
        }
      }
    }

    // ── Mahoraga zone ──
    if(this.mahoragaZone){
      const mz=this.mahoragaZone; mz.life--;
      if(mz.life<=0){ this.mahoragaZone=null; }
      else {
        const mz_owner=ballMap.get(mz.ownerId);
        for(const b of balls){
          if(!b.alive||(mz_owner?!isEnemy(mz_owner,b):b.id===mz.ownerId)) continue;
          if(Math.hypot(b.x-mz.x,b.y-mz.y)<mz.r){
            // Slow down
            b.vx*=0.92; b.vy*=0.92;
            const adapted=mz.adapted.includes(b.id);
            if(mz.life%25===0){
              const dmg=adapted?8:15;
              b.hit(); if(mz_owner) addDmg(mz_owner,dmg); else G.dmgFlash[mz.ownerId]=8;
              burst(b.x,b.y,'#9933ff',8);
              if(!adapted) mz.adapted.push(b.id);
            }
          }
        }
      }
    }

    // ── Blood streams (Choso) ──
    for(let i=this.bloodStreams.length-1;i>=0;i--){
      const bs=this.bloodStreams[i]; bs.life--;
      if(bs.life<=0){ this.bloodStreams.splice(i,1); continue; }
      // Slight homing
      const ownerBall_bs2=ballMap.get(bs.ownerId);
      let nearest_bs=null, nearDist_bs=Infinity;
      if(skipCollision) continue;
      for(const b of balls){
        if(!b.alive||(ownerBall_bs2?!isEnemy(ownerBall_bs2,b):b.id===bs.ownerId)) continue;
        const dd=Math.hypot(b.x-bs.x,b.y-bs.y);
        if(dd<nearDist_bs){ nearDist_bs=dd; nearest_bs=b; }
      }
      if(nearest_bs&&bs.homed<8){
        const ang=Math.atan2(nearest_bs.y-bs.y,nearest_bs.x-bs.x);
        const curAng=Math.atan2(bs.vy,bs.vx);
        let diff=ang-curAng; while(diff>Math.PI)diff-=Math.PI*2; while(diff<-Math.PI)diff+=Math.PI*2;
        const spd=Math.hypot(bs.vx,bs.vy);
        const newAng=curAng+diff*0.08;
        bs.vx=Math.cos(newAng)*spd; bs.vy=Math.sin(newAng)*spd; bs.homed++;
      }
      bs.x+=bs.vx; bs.y+=bs.vy;
      if(i===0) CAM.setFollow(bs.x, bs.y); // track first stream
      // Arena bounce (1 bounce max)
      const bd=Math.hypot(bs.x-ACX,bs.y-ACY);
      if(bd>ARENA.r-6){
        const nx=(bs.x-ACX)/bd,ny=(bs.y-ACY)/bd,dot=bs.vx*nx+bs.vy*ny;
        if(dot>0){bs.vx-=2*dot*nx;bs.vy-=2*dot*ny;}
        bs.x=ACX+nx*(ARENA.r-7);bs.y=ACY+ny*(ARENA.r-7);
        bs.bounced=(bs.bounced||0)+1; if(bs.bounced>1) bs.life=0;
      }
      // Hit check
      for(const b of balls){
        if(!b.alive||(ownerBall_bs2?!isEnemy(ownerBall_bs2,b):b.id===bs.ownerId)) continue;
        if(Math.hypot(b.x-bs.x,b.y-bs.y)<b.r+6){
          b.hit(); if(ownerBall_bs2) addDmg(ownerBall_bs2,20); else G.dmgFlash[bs.ownerId]=12;
          const nx=(b.x-bs.x)/(Math.hypot(b.x-bs.x,b.y-bs.y)||1);
          const ny=(b.y-bs.y)/(Math.hypot(b.x-bs.x,b.y-bs.y)||1);
          b.vx+=nx*8; b.vy+=ny*8;
          burst(b.x,b.y,'#aa0000',12);
          CAM.impact(b.x,b.y,'#aa0000','HIT!');
          bs.life=0; break;
        }
      }
    }

    // ── Rika zone (follows owner) ──
    if(this.rikaZone){
      const rz=this.rikaZone; rz.life--;
      if(rz.life<=0){ this.rikaZone=null; }
      else {
        const owner=(()=>{const _bm=ballMap.get(rz.ownerId);return _bm&&_bm.alive?_bm:null;})();
        if(owner){
          for(const b of balls){
            if(!b.alive||!isEnemy(owner,b)) continue;
            const d=Math.hypot(b.x-owner.x,b.y-owner.y);
            if(d<rz.r){
              // Pull toward owner
              const nx=(owner.x-b.x)/(d||1),ny=(owner.y-b.y)/(d||1);
              b.vx+=nx*1.2; b.vy+=ny*1.2;
              if(rz.life%30===0){
                b.hit(); addDmg(owner,18);
                burst(b.x,b.y,'#ccccff',10);
              }
            }
          }
        }
      }
    }

    // ── Hakari pachinko ──
    if(this.hakariFrames>0){
      this.hakariFrames--; this.hakariJackpot++;
      const owner=(()=>{const _bm=ballMap.get(this.hakariOwner);return _bm&&_bm.alive?_bm:null;})();
      if(owner && this.hakariJackpot%6===0){
        const roll=Math.floor(Math.random()*5);
        switch(roll){
          case 0: // speed burst
            owner.vx*=1.8; owner.vy*=1.8; break;
          case 1: // wild heal
            owner.hp=Math.min(owner.max,owner.hp+1); break;
          case 2: // chaos spread to enemies
            balls.forEach(b=>{ if(b.alive&&isEnemy(owner,b)){ b.vx+=(Math.random()-0.5)*10; b.vy+=(Math.random()-0.5)*10; } }); break;
          case 3: // pull enemies
            balls.forEach(b=>{ if(b.alive&&isEnemy(owner,b)){ const d=Math.hypot(b.x-owner.x,b.y-owner.y)||1; b.vx+=(owner.x-b.x)/d*6; b.vy+=(owner.y-b.y)/d*6; } }); break;
          case 4: // damage nearby
            balls.forEach(b=>{ if(b.alive&&isEnemy(owner,b)&&Math.hypot(b.x-owner.x,b.y-owner.y)<120){ b.hit(); addDmg(owner,10); burst(b.x,b.y,'#ff00ff',8); } }); break;
        }
        G.arenaFlash.color=['#ff00ff','#00ffff','#ffdd00','#ff0088','#00ff88'][roll];
        G.arenaFlash.alpha=0.18;
      }
    }

    // ── Rasengan projectile ──
    if(this.rasengan){
      const rs = this.rasengan;
      rs.life--;
      rs.angle += 0.35; // spinning
      rs.x += rs.vx; rs.y += rs.vy;
      CAM.setFollow(rs.x, rs.y);
      // Bounce off arena wall
      const rdist = Math.hypot(rs.x - ACX, rs.y - ACY);
      if(rdist > ARENA.r - rs.r){
        const nx = (rs.x-ACX)/rdist, ny = (rs.y-ACY)/rdist;
        const dot = rs.vx*nx + rs.vy*ny;
        if(dot>0){ rs.vx -= 2*dot*nx; rs.vy -= 2*dot*ny; }
        rs.x = ACX + nx*(ARENA.r - rs.r - 1);
        rs.y = ACY + ny*(ARENA.r - rs.r - 1);
        rs.bounces = (rs.bounces||0) + 1;
        if(rs.bounces > 3) rs.life = 0;
      }
      // Hitbox: damages enemies in radius
      const rs_owner=ballMap.get(rs.ownerId);
      for(const b of balls){
        if(!b.alive||(rs_owner?!isEnemy(rs_owner,b):b.id===rs.ownerId)) continue;
        const d = Math.hypot(b.x - rs.x, b.y - rs.y);
        if(d < rs.r + b.r){
          b.hit(); if(rs_owner) addDmg(rs_owner,30); else G.dmgFlash[rs.ownerId]=12;
          // Push outward from rasengan center
          const nx=(b.x-rs.x)/(d||1), ny=(b.y-rs.y)/(d||1);
          b.vx += nx*14; b.vy += ny*14;
          burst(b.x, b.y, '#0099ff', 16);
          CAM.impact(b.x, b.y, '#0099ff', 'RASENGAN!');
          rs.life = 0; // rasengan dies on hit
          break;
        }
      }
      if(rs.life <= 0) this.rasengan = null;
    }

    // ── Chidori beam ──
    if(this.chidori){
      const ch = this.chidori;
      ch.life--;
      if(ch.life <= 0){ this.chidori = null; }
      else if(ch.life % 4 === 0){
        const len = 260;
        const ch_owner=ballMap.get(ch.ownerId);
        for(const b of balls){
          if(!b.alive||(ch_owner?!isEnemy(ch_owner,b):b.id===ch.ownerId)) continue;
          // Point-to-line distance from chidori origin along angle
          const dx = b.x - ch.x, dy = b.y - ch.y;
          const lx = Math.cos(ch.angle), ly = Math.sin(ch.angle);
          const proj = dx*lx + dy*ly;
          if(proj < 0 || proj > len) continue;
          const perp = Math.abs(dx*ly - dy*lx);
          if(perp < 26){
            b.hit(); if(ch_owner) addDmg(ch_owner,20); else G.dmgFlash[ch.ownerId]=10;
            // Slow the target
            b.vx *= 0.6; b.vy *= 0.6;
            burst(b.x, b.y, '#ffee00', 12);
            CAM.impact(b.x, b.y, '#ffee00', 'CHIDORI!');
          }
        }
      }
    }

    // ── Tsukuyomi (genjutsu prison) ──
    if(this.tsukuyomiFrames > 0){
      this.tsukuyomiFrames--;
      const t = balls.find(b => b.id === this.tsukuyomiTarget && b.alive);
      if(t){
        if(t.tsukuVx === undefined){
          t.tsukuVx = Math.hypot(t.vx,t.vy)>0.1 ? t.vx : t.baseSpd*(Math.random()<0.5?1:-1);
          t.tsukuVy = Math.hypot(t.vx,t.vy)>0.1 ? t.vy : t.baseSpd*(Math.random()<0.5?1:-1);
        }
        t.vx = 0; t.vy = 0;
        // Tick damage every 40 frames
        if(this.tsukuyomiFrames % 40 === 0){
          t.hit(); const ownerBall_ts=ballMap.get(this.tsukuyomiOwner); if(ownerBall_ts) addDmg(ownerBall_ts,20); else G.dmgFlash[this.tsukuyomiOwner||0]=10;
          burst(t.x, t.y, '#cc00aa', 10);
        }
      } else if(this.tsukuyomiFrames === 0 && t){
        t.vx = t.tsukuVx||t.baseSpd; t.vy = t.tsukuVy||t.baseSpd;
        t.tsukuVx = undefined; t.tsukuVy = undefined;
      }
    } else {
      // Restore on expiry
      const t = balls.find(b => b.id === this.tsukuyomiTarget && b.alive);
      if(t && t.tsukuVx !== undefined){
        t.vx = t.tsukuVx; t.vy = t.tsukuVy;
        t.tsukuVx = undefined; t.tsukuVy = undefined;
      }
    }

    // ── Sand wave ──
    if(this.sandWave){
      const sw = this.sandWave;
      sw.life--;
      sw.r = sw.maxR * (1 - sw.life/sw.max); // expand
      if(sw.life <= 0){ this.sandWave = null; }
      else {
        const sw_owner=ballMap.get(sw.ownerId);
        for(const b of balls){
          if(!b.alive||(sw_owner?!isEnemy(sw_owner,b):b.id===sw.ownerId)) continue;
          const d = Math.hypot(b.x - sw.x, b.y - sw.y);
          // Hit when wave ring passes through ball
          if(d < sw.r + 20 && d > sw.r - 20 && sw.life % 6 === 0){
            const nx=(b.x-sw.x)/(d||1), ny=(b.y-sw.y)/(d||1);
            b.vx += nx*10; b.vy += ny*10;
            b.hit(); if(sw_owner) addDmg(sw_owner,15); else G.dmgFlash[sw.ownerId]=10;
            burst(b.x, b.y, '#cc9933', 10);
          }
        }
      }
    }

    // ── Drago Nova shards ──
    if(this.dragoNova){
      const dn=this.dragoNova; dn.life--;
      dn.r = dn.maxR * (1 - dn.life/dn.max);
      if(dn.life<=0){ this.dragoNova=null; }
      else {
        const ownerBall_dn2=ballMap.get(dn.ownerId);
        for(const sh of dn.shards){
          if(sh.hit) continue;
          sh.life--; sh.x+=sh.vx; sh.y+=sh.vy;
          if(sh.life<60){
            let nearest_dn=null, nearDist_dn=Infinity;
            for(const b of balls){
              if(!b.alive||(ownerBall_dn2?!isEnemy(ownerBall_dn2,b):b.id===dn.ownerId)) continue;
              const dd=Math.hypot(b.x-sh.x,b.y-sh.y);
              if(dd<nearDist_dn){ nearDist_dn=dd; nearest_dn=b; }
            }
            if(nearest_dn){
              const dx=nearest_dn.x-sh.x, dy=nearest_dn.y-sh.y, d=Math.hypot(dx,dy)||1;
              sh.vx+=(dx/d)*0.8; sh.vy+=(dy/d)*0.8;
              const spd=Math.hypot(sh.vx,sh.vy); if(spd>7){ sh.vx=sh.vx/spd*7; sh.vy=sh.vy/spd*7; }
            }
          }
          for(const b of balls){
            if(!b.alive||(ownerBall_dn2?!isEnemy(ownerBall_dn2,b):b.id===dn.ownerId)||sh.hit) continue;
            if(Math.hypot(b.x-sh.x,b.y-sh.y)<C.BALL_R+8){
              sh.hit=true; b.hit();
              if(ownerBall_dn2) addDmg(ownerBall_dn2,10); else G.dmgFlash[dn.ownerId]=8;
              burst(b.x,b.y,'#ffdd00',10);
            }
          }
        }
      }
    }

    // ── Megiddo beams ──
    for(let i=this.megiddoBeams.length-1;i>=0;i--){
      const mb=this.megiddoBeams[i];
      if(mb.delay>0){ mb.delay--; continue; }
      mb.life--;
      if(mb.life<=0){ this.megiddoBeams.splice(i,1); continue; }
      if(mb.life%8===0){
        const mb_owner=ballMap.get(mb.ownerId);
        if(skipCollision) continue;
        for(const b of balls){
          if(!b.alive||(mb_owner?!isEnemy(mb_owner,b):b.id===mb.ownerId)) continue;
          if(Math.hypot(b.x-mb.x,b.y-mb.y)<C.BALL_R+22){
            b.hit(); if(mb_owner) addDmg(mb_owner,12); else G.dmgFlash[mb.ownerId]=8;
            burst(b.x,b.y,'#ffffff',12);
          }
        }
      }
    }

    // ── Veldora storm ──
    if(this.veldoraStorm){
      const vs=this.veldoraStorm; vs.life--; vs.angle+=0.06;
      if(vs.life<=0){ this.veldoraStorm=null; }
      else {
        const vs_owner=ballMap.get(vs.ownerId);
        for(const b of balls){
          if(!b.alive||(vs_owner?!isEnemy(vs_owner,b):b.id===vs.ownerId)) continue;
          const dx=vs.x-b.x, dy=vs.y-b.y, d=Math.hypot(dx,dy)||1;
          if(d<vs.r){
            // Pull toward center + orbit spin
            b.vx+=(dx/d)*0.7; b.vy+=(dy/d)*0.7;
            // Rotational shear
            b.vx-=dy/d*0.4; b.vy+=dx/d*0.4;
            if(vs.life%10===0 && d<vs.r*0.5){
              b.hit(); if(vs_owner) addDmg(vs_owner,8); else G.dmgFlash[vs.ownerId]=6;
              burst(b.x,b.y,'#4466ff',8);
            }
          }
        }
      }
    }

    // ── Prominence dragon ──
    if(this.prominenceDragon){
      const pd=this.prominenceDragon; pd.life--;
      pd.angle+=0.04; pd.size=Math.min(2.5, pd.size+0.015);
      const owner=(()=>{const _bm=ballMap.get(pd.ownerId);return _bm&&_bm.alive?_bm:null;})();
      if(!owner||pd.life<=0){ this.prominenceDragon=null; }
      else {
        pd.x=owner.x; pd.y=owner.y;
        // Forward sweeping breath every 6 frames
        if(pd.life%6===0){
          for(const b of balls){
            if(!b.alive||!isEnemy(owner,b)) continue;
            const dx=b.x-pd.x, dy=b.y-pd.y, d=Math.hypot(dx,dy)||1;
            const ang=Math.atan2(dy,dx);
            const diff=Math.abs(((ang-pd.angle)+Math.PI*3)%(Math.PI*2)-Math.PI);
            if(diff<0.9 && d<180){
              b.hit(); addDmg(owner,10);
              b.vx+=Math.cos(pd.angle)*8; b.vy+=Math.sin(pd.angle)*8;
              burst(b.x,b.y,'#dc143c',10);
            }
          }
        }
      }
    }

    // ── Diablo vortex ──
    if(this.diabloVortex){
      const dv=this.diabloVortex; dv.life--;
      if(dv.life<=0){ this.diabloVortex=null; }
      else {
        const owner=(()=>{const _bm=ballMap.get(dv.ownerId);return _bm&&_bm.alive?_bm:null;})();
        if(owner){ dv.x=owner.x; dv.y=owner.y; }
        for(const b of balls){
          if(!b.alive||(owner?!isEnemy(owner,b):b.id===dv.ownerId)) continue;
          const dx=dv.x-b.x, dy=dv.y-b.y, d=Math.hypot(dx,dy)||1;
          if(d<dv.r){
            b.vx+=(dx/d)*1.5; b.vy+=(dy/d)*1.5;
            if(dv.life%8===0){
              b.hit(); if(owner) addDmg(owner,8);
              burst(b.x,b.y,'#aa00ff',8);
              if(owner && owner.hp<C.MAX_HP) owner.hp=Math.min(C.MAX_HP,owner.hp+0.3);
            }
          }
        }
      }
    }

    // ── Chainsaw Rev ──
    if(this.chainsawRev){
      const cr=this.chainsawRev; cr.life--;
      cr.angle+=0.18;
      const owner=(()=>{const _bm=ballMap.get(cr.ownerId);return _bm&&_bm.alive?_bm:null;})();
      if(!owner||cr.life<=0){ this.chainsawRev=null; }
      else {
        cr.x=owner.x; cr.y=owner.y;
        for(const sp of cr.spokes){
          sp.angle=cr.angle+cr.spokes.indexOf(sp)*Math.PI/2;
          const sx=cr.x+Math.cos(sp.angle)*sp.dist, sy=cr.y+Math.sin(sp.angle)*sp.dist;
          if(cr.life%4===0){
            parts.length<400&&parts.push({x:sx,y:sy,vx:(Math.random()-0.5)*5,vy:(Math.random()-0.5)*5,r:6,color:'#ff2200',life:15,max:15});
          }
          if(cr.life%6===0){ // rate-limit damage: every 6 frames instead of every frame
            for(const b of balls){
              if(!b.alive||!isEnemy(owner,b)) continue;
              if(Math.hypot(b.x-sx,b.y-sy)<C.BALL_R+14){
                b.hit(); addDmg(owner,10);
                b.vx+=Math.cos(sp.angle)*8; b.vy+=Math.sin(sp.angle)*8;
                burst(b.x,b.y,'#ff2200',8);
              }
            }
          }
        }
      }
    }

    // ── Blood spears ──
    for(let i=this.bloodSpears.length-1;i>=0;i--){
      const sp=this.bloodSpears[i]; sp.life--; sp.x+=sp.vx; sp.y+=sp.vy;
      if(sp.life<=0||sp.y>ACY+ARENA.r){ this.bloodSpears.splice(i,1); continue; }
      if(i===0) CAM.setFollow(sp.x, sp.y);
      const sp_owner=ballMap.get(sp.ownerId);
      if(skipCollision) continue;
      for(const b of balls){
        if(!b.alive||(sp_owner?!isEnemy(sp_owner,b):b.id===sp.ownerId)) continue;
        if(Math.hypot(b.x-sp.x,b.y-sp.y)<C.BALL_R+10){
          b.hit(); if(sp_owner) addDmg(sp_owner,15); else G.dmgFlash[sp.ownerId]=8;
          b.vx+=sp.vx*0.5; b.vy+=sp.vy*0.5;
          burst(b.x,b.y,'#cc0022',10);
          CAM.impact(b.x,b.y,'#cc0022','BLOOD!');
          this.bloodSpears.splice(i,1); break;
        }
      }
    }

    // ── Makima chains ──
    for(let i=this.makimaChains.length-1;i>=0;i--){
      const mc=this.makimaChains[i]; mc.life--;
      mc.extend=Math.min(1,(mc.max-mc.life)/(mc.max*0.4));
      if(mc.life<=0){ this.makimaChains.splice(i,1); continue; }
      if(mc.life===mc.max-8){
        const t=(()=>{const _bm=ballMap.get(mc.targetId);return _bm&&_bm.alive?_bm:null;})();
        if(t){ t.hit(); t.hit(); const ownerBall_mc=ballMap.get(mc.ownerId); if(ownerBall_mc) addDmg(ownerBall_mc,20); else G.dmgFlash[mc.ownerId]=10; burst(t.x,t.y,'#880000',14); }
      }
    }

    // ── Future Devil (dodge shield) ──
    if(this.futureDevil){
      const fd=this.futureDevil; fd.life--;
      if(fd.life<=0){ this.futureDevil=null; }
      else {
        const owner=(()=>{const _bm=ballMap.get(fd.ownerId);return _bm&&_bm.alive?_bm:null;})();
        if(owner){ owner.shieldFrames=Math.max(owner.shieldFrames||0, 2); }
        // Counter strike every 40 frames
        if(fd.life%40===0){
          for(const b of balls){
            if(!b.alive||(owner?!isEnemy(owner,b):b.id===fd.ownerId)) continue;
            if(Math.hypot(b.x-(owner?.x||ACX),b.y-(owner?.y||ACY))<160){
              b.hit(); if(owner) addDmg(owner,8); burst(b.x,b.y,'#8844ff',8);
            }
          }
        }
      }
    }

    // ── Pochita core ──
    if(this.pochitaCore){
      const pc=this.pochitaCore; pc.life--;
      pc.r=pc.maxR*(1-pc.life/pc.max);
      if(pc.life<=0){ this.pochitaCore=null; }
      else {
        const pc_owner=ballMap.get(pc.ownerId);
        for(const b of balls){
          if(!b.alive||(pc_owner?!isEnemy(pc_owner,b):b.id===pc.ownerId)) continue;
          const d=Math.hypot(b.x-pc.x,b.y-pc.y);
          if(d<pc.r+20&&d>pc.r-20&&pc.life%5===0){
            const nx=(b.x-pc.x)/(d||1), ny=(b.y-pc.y)/(d||1);
            b.vx+=nx*14; b.vy+=ny*14;
            b.hit(); if(pc_owner) addDmg(pc_owner,12); burst(b.x,b.y,'#ff6600',10);
          }
        }
      }
    }

    // ── Serious Punch ──
    if(this.seriousPunch){
      const sp=this.seriousPunch; sp.life--;
      sp.x+=sp.vx; sp.y+=sp.vy;
      CAM.setFollow(sp.x, sp.y);
      if(sp.life<=0){ this.seriousPunch=null; }
      else {
        const sp2_owner=ballMap.get(sp.ownerId);
        for(const b of balls){
          if(!b.alive||(sp2_owner?!isEnemy(sp2_owner,b):b.id===sp.ownerId)) continue;
          if(Math.hypot(b.x-sp.x,b.y-sp.y)<sp.r+C.BALL_R){
            b.hit(); b.hit(); b.hit();
            if(sp2_owner) addDmg(sp2_owner,30); else G.dmgFlash[sp.ownerId]=12;
            const nx=(b.x-sp.x)/(Math.hypot(b.x-sp.x,b.y-sp.y)||1);
            const ny=(b.y-sp.y)/(Math.hypot(b.x-sp.x,b.y-sp.y)||1);
            b.vx+=nx*20; b.vy+=ny*20;
            burst(b.x,b.y,'#ffff00',18);
            CAM.impact(b.x,b.y,'#ffff00','SERIOUS PUNCH!');
            this.seriousPunch=null; break;
          }
        }
      }
    }

    // ── Incinerate beam ──
    if(this.incinerateBeam){
      const ib=this.incinerateBeam; ib.life--;
      ib.width=Math.min(3, ib.width+0.025);
      const owner=(()=>{const _bm=ballMap.get(ib.ownerId);return _bm&&_bm.alive?_bm:null;})();
      if(!owner||ib.life<=0){ this.incinerateBeam=null; }
      else {
        ib.x=owner.x; ib.y=owner.y;
        ib.angle+=0.03;
        if(ib.life%5===0){
          for(const b of balls){
            if(!b.alive||!isEnemy(owner,b)) continue;
            const dx=b.x-ib.x, dy=b.y-ib.y, d=Math.hypot(dx,dy)||1;
            const ang=Math.atan2(dy,dx);
            const diff=Math.abs(((ang-ib.angle)+Math.PI*3)%(Math.PI*2)-Math.PI);
            if(diff<0.35*ib.width&&d<240){
              b.hit(); const ownerBall_ib=ballMap.get(ib.ownerId); if(ownerBall_ib) addDmg(ownerBall_ib,8); burst(b.x,b.y,'#ff5500',8);
            }
          }
        }
        // Particle trail
        if(ib.life%2===0){
          const len=200; const spread=0.3*ib.width;
          parts.length<400&&parts.push({x:ib.x+Math.cos(ib.angle+spread)*len*Math.random(),
            y:ib.y+Math.sin(ib.angle+spread)*len*Math.random(),
            vx:(Math.random()-0.5)*4,vy:(Math.random()-0.5)*4,r:7,color:'#ff5500',life:18,max:18});
        }
      }
    }

    // ── Tornado Psy ──
    if(this.tornadoPsy){
      const tp=this.tornadoPsy; tp.life--; tp.angle+=0.05;
      if(tp.life<=0){ this.tornadoPsy=null; }
      else {
        const owner=(()=>{const _bm=ballMap.get(tp.ownerId);return _bm&&_bm.alive?_bm:null;})();
        for(const b of balls){
          if(!b.alive||(owner?!isEnemy(owner,b):b.id===tp.ownerId)) continue;
          const dx=ACX-b.x, dy=ACY-b.y, d=Math.hypot(dx,dy)||1;
          // Orbit + slow lift
          b.vx+=(dx/d)*0.5; b.vy+=(dy/d)*0.5;
          b.vx-=dy/d*0.5; b.vy+=dx/d*0.5;
          if(tp.life%12===0){ b.hit(); const ownerBall_tp=ballMap.get(tp.ownerId); if(ownerBall_tp) addDmg(ownerBall_tp,6); burst(b.x,b.y,'#44ff88',6); }
        }
      }
    }

    // ── Silver Fang wave ──
    if(this.silverFangWave){
      const sf=this.silverFangWave; sf.life--;
      sf.r=sf.maxR*(1-sf.life/sf.max);
      if(sf.life<=0){ this.silverFangWave=null; }
      else {
        const sf_owner=ballMap.get(sf.ownerId);
        for(const b of balls){
          if(!b.alive||(sf_owner?!isEnemy(sf_owner,b):b.id===sf.ownerId)) continue;
          const d=Math.hypot(b.x-sf.x,b.y-sf.y);
          if(d<sf.r+22&&d>sf.r-22&&sf.life%5===0){
            const nx=(b.x-sf.x)/(d||1), ny=(b.y-sf.y)/(d||1);
            b.vx+=nx*12; b.vy+=ny*12;
            b.hit(); if(sf_owner) addDmg(sf_owner,12); burst(b.x,b.y,'#aaddff',10);
          }
        }
      }
    }

    // ── Sonic slashes ──
    for(let i=this.sonicSlashes.length-1;i>=0;i--){
      const ss=this.sonicSlashes[i]; ss.life--;
      if(ss.life<=0){ this.sonicSlashes.splice(i,1); continue; }
      if(ss.life%4===0){
        const ss_owner=ballMap.get(ss.ownerId);
        if(skipCollision) continue;
        for(const b of balls){
          if(!b.alive||(ss_owner?!isEnemy(ss_owner,b):b.id===ss.ownerId)) continue;
          // Distance from point to line segment
          const dx=ss.x2-ss.x1, dy=ss.y2-ss.y1, len=Math.hypot(dx,dy)||1;
          const t2=Math.max(0,Math.min(1,((b.x-ss.x1)*dx+(b.y-ss.y1)*dy)/(len*len)));
          const dist=Math.hypot(b.x-(ss.x1+t2*dx),b.y-(ss.y1+t2*dy));
          if(dist<C.BALL_R+10){
            b.hit(); if(ss_owner) addDmg(ss_owner,8); burst(b.x,b.y,'#ccffff',8);
          }
        }
      }
    }

    // ── Zoltraak beams ──
    for(let i=this.zoltraakBeams.length-1;i>=0;i--){
      const zb=this.zoltraakBeams[i]; zb.life--; zb.x+=zb.vx; zb.y+=zb.vy;
      if(i===0) CAM.setFollow(zb.x, zb.y);
      const ownerBall_zb3=ballMap.get(zb.ownerId);
      // Home in after 40 frames
      if(zb.life<60&&!zb.homed){
        let cnt_zb=0;
        if(skipCollision) continue;
        for(const b of balls){ if(b.alive&&(ownerBall_zb3?isEnemy(ownerBall_zb3,b):b.id!==zb.ownerId)) cnt_zb++; }
        if(cnt_zb>0){
          let pick_zb=Math.floor(Math.random()*cnt_zb), t_zb=null;
          for(const b of balls){
            if(!b.alive||(ownerBall_zb3?!isEnemy(ownerBall_zb3,b):b.id===zb.ownerId)) continue;
            if(pick_zb--===0){ t_zb=b; break; }
          }
          if(t_zb){
            const dx=t_zb.x-zb.x, dy=t_zb.y-zb.y, d=Math.hypot(dx,dy)||1;
            zb.vx+=(dx/d)*1.2; zb.vy+=(dy/d)*1.2;
            const spd=Math.hypot(zb.vx,zb.vy); if(spd>9){ zb.vx=zb.vx/spd*9; zb.vy=zb.vy/spd*9; }
          }
        }
        zb.homed=true;
      }
      if(zb.life<=0){ this.zoltraakBeams.splice(i,1); continue; }
      for(const b of balls){
        if(!b.alive||(ownerBall_zb3?!isEnemy(ownerBall_zb3,b):b.id===zb.ownerId)) continue;
        if(Math.hypot(b.x-zb.x,b.y-zb.y)<C.BALL_R+zb.r){
          b.hit(); if(ownerBall_zb3) addDmg(ownerBall_zb3,12); burst(b.x,b.y,'#8866ff',10);
          CAM.impact(b.x,b.y,'#8866ff','ZOLTRAAK!');
          this.zoltraakBeams.splice(i,1); break;
        }
      }
    }

    // ── Granat orb ──
    if(this.granatOrb){
      const go=this.granatOrb; go.life--;
      if(go.life<=0){ this.granatOrb=null; }
      else if(go.phase==='grow'){
        go.r=go.maxR*(1-(go.life/go.max));
        if(go.r>=go.maxR){ go.phase='explode'; }
        const go_owner=ballMap.get(go.ownerId);
        for(const b of balls){
          if(!b.alive||(go_owner?!isEnemy(go_owner,b):b.id===go.ownerId)) continue;
          if(Math.hypot(b.x-go.x,b.y-go.y)<go.r){
            b.vx*=0.85; b.vy*=0.85; // implosion pull
            if(go.life%12===0){ b.hit(); if(go_owner) addDmg(go_owner,6); }
          }
        }
      } else {
        // Explode phase
        const go_owner=ballMap.get(go.ownerId);
        for(const b of balls){
          if(!b.alive||(go_owner?!isEnemy(go_owner,b):b.id===go.ownerId)) continue;
          const d=Math.hypot(b.x-go.x,b.y-go.y);
          if(d<go.maxR+20&&go.life%6===0){
            const nx=(b.x-go.x)/(d||1), ny=(b.y-go.y)/(d||1);
            b.vx+=nx*16; b.vy+=ny*16;
            b.hit(); b.hit(); if(go_owner) addDmg(go_owner,20); burst(b.x,b.y,'#ff88ff',14);
          }
        }
        if(go.life<100) this.granatOrb=null;
      }
    }

    // ── Aura soul drain ──
    if(this.auraSoul){
      const as=this.auraSoul; as.life--;
      if(as.life<=0){ this.auraSoul=null; }
      else if(as.life%20===0){
        const owner=(()=>{const _bm=ballMap.get(as.ownerId);return _bm&&_bm.alive?_bm:null;})();
        for(const b of balls){
          if(!b.alive||(owner?!isEnemy(owner,b):b.id===as.ownerId)) continue;
          b.hit(); if(owner) addDmg(owner,5);
          burst(b.x,b.y,'#88ffdd',6);
          if(owner && owner.hp<C.MAX_HP) owner.hp=Math.min(C.MAX_HP,owner.hp+0.4);
        }
      }
    }

    // ── Stark thunder rings ──
    if(this.starkThunder){
      const st=this.starkThunder; st.life--;
      if(st.life<=0){ this.starkThunder=null; }
      else {
        for(const rg of st.rings){
          if(rg.life>0){ rg.life--; rg.r=rg.maxR*(1-rg.life/rg.max); }
          const st_owner=ballMap.get(st.ownerId);
          for(const b of balls){
            if(!b.alive||(st_owner?!isEnemy(st_owner,b):b.id===st.ownerId)) continue;
            const d=Math.hypot(b.x-st.x,b.y-st.y);
            if(d<rg.r+20&&d>rg.r-20&&rg.life%6===0){
              const nx=(b.x-st.x)/(d||1), ny=(b.y-st.y)/(d||1);
              b.vx+=nx*10; b.vy+=ny*10;
              b.hit(); if(st_owner) addDmg(st_owner,10); burst(b.x,b.y,'#ffdd44',10);
            }
          }
        }
      }
    }

    // ── Frieren Allmächtig ──
    if(this.frierenEnd){
      const fe=this.frierenEnd; fe.life--;
      fe.r=fe.maxR*(1-fe.life/fe.max);
      if(fe.life<=0){ this.frierenEnd=null; }
      else {
        const fe_owner=ballMap.get(fe.ownerId);
        for(const sh of fe.shards){
          if(sh.hit) continue;
          sh.life--; sh.x+=sh.vx; sh.y+=sh.vy;
          if(sh.life<60){
            let cnt_fe=0;
            for(const b of balls){ if(b.alive&&(fe_owner?isEnemy(fe_owner,b):b.id!==fe.ownerId)) cnt_fe++; }
            if(cnt_fe>0){
              let pick_fe=Math.floor(Math.random()*cnt_fe), t_fe=null;
              for(const b of balls){
                if(!b.alive||(fe_owner?!isEnemy(fe_owner,b):b.id===fe.ownerId)) continue;
                if(pick_fe--===0){ t_fe=b; break; }
              }
              if(t_fe){
                const dx=t_fe.x-sh.x, dy=t_fe.y-sh.y, d=Math.hypot(dx,dy)||1;
                sh.vx+=(dx/d)*0.9; sh.vy+=(dy/d)*0.9;
                const spd=Math.hypot(sh.vx,sh.vy); if(spd>8){ sh.vx=sh.vx/spd*8; sh.vy=sh.vy/spd*8; }
              }
            }
          }
          for(const b of balls){
            if(!b.alive||(fe_owner?!isEnemy(fe_owner,b):b.id===fe.ownerId)||sh.hit) continue;
            if(Math.hypot(b.x-sh.x,b.y-sh.y)<C.BALL_R+10){
              sh.hit=true; b.hit(); if(fe_owner) addDmg(fe_owner,10); burst(b.x,b.y,'#cceeff',10);
            }
          }
        }
        // Main wave damage
        for(const b of balls){
          if(!b.alive||(fe_owner?!isEnemy(fe_owner,b):b.id===fe.ownerId)) continue;
          const d=Math.hypot(b.x-fe.x,b.y-fe.y);
          if(d<fe.r+24&&d>fe.r-24&&fe.life%7===0){
            const nx=(b.x-fe.x)/(d||1), ny=(b.y-fe.y)/(d||1);
            b.vx+=nx*9; b.vy+=ny*9;
            b.hit(); if(fe_owner) addDmg(fe_owner,8); burst(b.x,b.y,'#cceeff',8);
          }
        }
      }
    }

    // ════════════════════════════════════════════════
    // EMINENCE IN SHADOW — tick
    // ════════════════════════════════════════════════
    if(this.atomicBlast){
      const ab=this.atomicBlast; ab.life--;
      ab.r=ab.maxR*(1-(ab.life/ab.max));
      if(ab.life<=0){ this.atomicBlast=null; }
      else {
        const ab_owner=ballMap.get(ab.ownerId);
        for(const b of balls){
          if(!b.alive||(ab_owner?!isEnemy(ab_owner,b):b.id===ab.ownerId)) continue;
          const d=Math.hypot(b.x-ab.x,b.y-ab.y);
          if(d<ab.r+30&&d>ab.r-30&&ab.life%5===0){
            const nx=(b.x-ab.x)/(d||1),ny=(b.y-ab.y)/(d||1);
            b.vx+=nx*14; b.vy+=ny*14; b.hit(); if(ab_owner) addDmg(ab_owner,15); burst(b.x,b.y,'#ffffff',8);
          }
        }
      }
    }

    if(this.shadowSlash){ this.shadowSlash.life--; if(this.shadowSlash.life<=0) this.shadowSlash=null; }

    for(let i=this.deltaSlashes.length-1;i>=0;i--){
      this.deltaSlashes[i].life--;
      if(this.deltaSlashes[i].life<=0) this.deltaSlashes.splice(i,1);
    }

    if(this.gammaBeam){ this.gammaBeam.life--; if(this.gammaBeam.life<=0) this.gammaBeam=null; }

    for(let i=this.betaBlades.length-1;i>=0;i--){
      this.betaBlades[i].life--;
      if(this.betaBlades[i].life<=0) this.betaBlades.splice(i,1);
    }

    // ════════════════════════════════════════════════
    // OVERLORD — tick
    // ════════════════════════════════════════════════
    if(this.ainzZone){
      const az=this.ainzZone; az.life--;
      if(az.life<=0){ this.ainzZone=null; }
      else if(az.life%18===0){
        const az_owner=ballMap.get(az.ownerId);
        for(const b of balls){
          if(!b.alive||(az_owner?!isEnemy(az_owner,b):b.id===az.ownerId)) continue;
          const d=Math.hypot(b.x-az.x,b.y-az.y);
          if(d<az.r){ b.hit(); if(az_owner) addDmg(az_owner,12); const nx=(b.x-az.x)/(d||1),ny=(b.y-az.y)/(d||1); b.vx+=nx*6; b.vy+=ny*6; burst(b.x,b.y,'#550022',8); }
        }
      }
    }

    if(this.albedoShield){ this.albedoShield.life--; if(this.albedoShield.life<=0) this.albedoShield=null; }

    if(this.shalltearAura){
      const sa=this.shalltearAura; sa.life--;
      if(sa.life<=0){ this.shalltearAura=null; }
      else if(sa.life%15===0){
        const sa_owner=ballMap.get(sa.ownerId);
        if(sa_owner&&sa_owner.alive){
          for(const b of balls){
            if(!b.alive||!isEnemy(sa_owner,b)) continue;
            const d=Math.hypot(b.x-sa_owner.x,b.y-sa_owner.y);
            if(d<sa.r){ b.hit(); addDmg(sa_owner,8); burst(b.x,b.y,'#ff0055',6); }
          }
        }
      }
    }

    if(this.cocytusZone){
      const cz=this.cocytusZone; cz.life--;
      if(cz.life<=0){ this.cocytusZone=null; }
      else if(cz.life%20===0){
        const cz_owner=ballMap.get(cz.ownerId);
        for(const b of balls){
          if(!b.alive||(cz_owner?!isEnemy(cz_owner,b):b.id===cz.ownerId)) continue;
          const d=Math.hypot(b.x-cz.x,b.y-cz.y);
          if(d<cz.r){ if(b.freezeFrames<10) b.freezeFrames=20; b.vx*=0.85; b.vy*=0.85; if(cz_owner) addDmg(cz_owner,6); burst(b.x,b.y,'#aaeeff',5); }
        }
      }
    }

    for(let i=this.demiurgeLegs.length-1;i>=0;i--){
      const dl=this.demiurgeLegs[i]; dl.life--;
      if(dl.life<=0){ this.demiurgeLegs.splice(i,1); continue; }
      if(dl.life%10===0){
        const dl_owner=ballMap.get(dl.ownerId);
        const ex=ACX+Math.cos(dl.angle)*(AR*0.9), ey=ACY+Math.sin(dl.angle)*(AR*0.9);
        if(skipCollision) continue;
        for(const b of balls){
          if(!b.alive||(dl_owner?!isEnemy(dl_owner,b):b.id===dl.ownerId)) continue;
          const d=Math.hypot(b.x-ex,b.y-ey);
          if(d<50){ b.hit(); if(dl_owner) addDmg(dl_owner,10); burst(b.x,b.y,'#ff6600',6); }
        }
      }
    }

    // ════════════════════════════════════════════════
    // NORAGAMI — tick
    // ════════════════════════════════════════════════
    for(let i=this.yatoCuts.length-1;i>=0;i--){
      this.yatoCuts[i].life--;
      if(this.yatoCuts[i].life<=0) this.yatoCuts.splice(i,1);
    }

    if(this.yukinePulse){ this.yukinePulse.life--; this.yukinePulse.r=this.yukinePulse.maxR*(1-this.yukinePulse.life/this.yukinePulse.max); if(this.yukinePulse.life<=0) this.yukinePulse=null; }

    for(let i=this.bishArr.length-1;i>=0;i--){
      const ba=this.bishArr[i]; ba.life--;
      ba.x+=ba.vx; ba.y+=ba.vy;
      if(ba.life<=0){ this.bishArr.splice(i,1); continue; }
      if(i===0) CAM.setFollow(ba.x, ba.y);
      const ba_owner=ballMap.get(ba.ownerId);
      if(skipCollision) continue;
      for(const b of balls){
        if(!b.alive||(ba_owner?!isEnemy(ba_owner,b):b.id===ba.ownerId)) continue;
        if(Math.hypot(b.x-ba.x,b.y-ba.y)<C.BALL_R+12){
          b.hit(); if(ba_owner) addDmg(ba_owner,20); burst(b.x,b.y,'#ffaa00',10); CAM.impact(b.x,b.y,'#ffaa00','FIVE COMBINED!'); this.bishArr.splice(i,1); break;
        }
      }
    }

    for(let i=this.noraBeads.length-1;i>=0;i--){
      const nb=this.noraBeads[i]; nb.life--;
      if(nb.life<=0){ this.noraBeads.splice(i,1); continue; }
      const tgt=(()=>{const _bm=ballMap.get(nb.targetId);return _bm&&_bm.alive?_bm:null;})();
      if(tgt){ nb.x=tgt.x; nb.y=tgt.y; }
    }

    for(let i=this.veenaLightning.length-1;i>=0;i--){
      this.veenaLightning[i].life--;
      if(this.veenaLightning[i].life<=0) this.veenaLightning.splice(i,1);
    }

    // ════════════════════════════════════════════════
    // MUSHOKU TENSEI — tick
    // ════════════════════════════════════════════════
    if(this.quagmireZone){
      const qz=this.quagmireZone; qz.life--; qz.angle+=0.05;
      if(qz.life<=0){ this.quagmireZone=null; }
      else if(qz.life%12===0){
        const qz_owner=ballMap.get(qz.ownerId);
        for(const b of balls){
          if(!b.alive||(qz_owner?!isEnemy(qz_owner,b):b.id===qz.ownerId)) continue;
          const d=Math.hypot(b.x-qz.x,b.y-qz.y);
          if(d<qz.r){ b.vx*=0.8; b.vy*=0.8; if(qz_owner) addDmg(qz_owner,8); burst(b.x,b.y,'#8800cc',5); }
        }
      }
    }

    if(this.northGodDash){
      const ng=this.northGodDash; ng.life--;
      if(ng.life<=0){ this.northGodDash=null; }
      else {
        const ng_owner=(()=>{const _bm=ballMap.get(ng.ownerId);return _bm&&_bm.alive?_bm:null;})();
        if(ng_owner&&ng.life%8===0) burst(ng_owner.x,ng_owner.y,'#ccccff',4);
      }
    }

    if(this.orstedAura){
      const oa=this.orstedAura; oa.life--;
      if(oa.life<=0){ this.orstedAura=null; }
      else if(oa.life%12===0){
        const oa_owner=(()=>{const _bm=ballMap.get(oa.ownerId);return _bm&&_bm.alive?_bm:null;})();
        if(oa_owner){
          for(const b of balls){
            if(!b.alive||!isEnemy(oa_owner,b)) continue;
            const d=Math.hypot(b.x-oa_owner.x,b.y-oa_owner.y);
            if(d<oa.r){ b.hit(); addDmg(oa_owner,10); burst(b.x,b.y,'#00ff88',6); }
          }
        }
      }
    }

    if(this.roxyBeam){ this.roxyBeam.life--; if(this.roxyBeam.life<=0) this.roxyBeam=null; }

    if(this.sylphieStorm){
      const ss=this.sylphieStorm; ss.life--; ss.angle+=0.07;
      if(ss.life<=0){ this.sylphieStorm=null; }
      else if(ss.life%10===0){
        const ss_owner=ballMap.get(ss.ownerId);
        for(const b of balls){
          if(!b.alive||(ss_owner?!isEnemy(ss_owner,b):b.id===ss.ownerId)) continue;
          const d=Math.hypot(b.x-ss.x,b.y-ss.y);
          if(d<ss.r){ const dx=b.x-ss.x,dy=b.y-ss.y; b.vx+=(-dy/(d||1))*5; b.vy+=(dx/(d||1))*5; if(ss_owner) addDmg(ss_owner,7); }
        }
      }
    }

    // ════════════════════════════════════════════════
    // DATE A LIVE — tick
    // ════════════════════════════════════════════════
    if(this.zafkielBullet){
      const zb=this.zafkielBullet; zb.life--;
      zb.x+=zb.vx; zb.y+=zb.vy;
      CAM.setFollow(zb.x, zb.y);
      // Home toward target
      const tgt=(()=>{const _bm=ballMap.get(zb.targetId);return _bm&&_bm.alive?_bm:null;})();
      if(tgt){ const dx=tgt.x-zb.x,dy=tgt.y-zb.y,d=Math.hypot(dx,dy)||1; zb.vx+=dx/d*0.8; zb.vy+=dy/d*0.8; const sp=Math.hypot(zb.vx,zb.vy); if(sp>16){zb.vx=zb.vx/sp*16;zb.vy=zb.vy/sp*16;} }
      if(zb.life<=0){ this.zafkielBullet=null; }
      else {
        const zb_owner=(()=>{const _bm=ballMap.get(zb.ownerId);return _bm&&_bm.alive?_bm:null;})();
        for(const b of balls){
          if(!b.alive||(zb_owner?!isEnemy(zb_owner,b):b.id===zb.ownerId)) continue;
          if(Math.hypot(b.x-zb.x,b.y-zb.y)<C.BALL_R+14){
            b.hit(); b.hit(); if(zb_owner) addDmg(zb_owner,50); burst(b.x,b.y,'#cc0000',16); burst(b.x,b.y,'#ff8888',10);
            CAM.impact(b.x,b.y,'#cc0000','ZAFKIEL!');
            this.zafkielBullet=null; break;
          }
        }
      }
    }

    if(this.sandalphonCrash){ this.sandalphonCrash.life--; this.sandalphonCrash.r=this.sandalphonCrash.maxR*(1-this.sandalphonCrash.life/this.sandalphonCrash.max); if(this.sandalphonCrash.life<=0) this.sandalphonCrash=null; }

    for(let i=this.origamiFeathers.length-1;i>=0;i--){
      const of_=this.origamiFeathers[i]; of_.life--;
      of_.x+=of_.vx; of_.y+=of_.vy;
      if(of_.life<=0){ this.origamiFeathers.splice(i,1); continue; }
      if(i===0) CAM.setFollow(of_.x, of_.y);
      const of_owner=ballMap.get(of_.ownerId);
      if(skipCollision) continue;
      for(const b of balls){
        if(!b.alive||(of_owner?!isEnemy(of_owner,b):b.id===of_.ownerId)) continue;
        if(Math.hypot(b.x-of_.x,b.y-of_.y)<C.BALL_R+10){ b.hit(); if(of_owner) addDmg(of_owner,15); burst(b.x,b.y,'#ccddff',8); CAM.impact(b.x,b.y,'#ffffff','METATRON!'); this.origamiFeathers.splice(i,1); break; }
      }
    }

    if(this.shidoWave){ this.shidoWave.life--; this.shidoWave.r=this.shidoWave.maxR*(1-this.shidoWave.life/this.shidoWave.max); if(this.shidoWave.life<=0) this.shidoWave=null; }

    if(this.mikusonic){
      const ms=this.mikusonic; ms.life--; ms.angle+=0.04;
      ms.r=Math.min(AR*0.9,(AR*0.9)*(1-ms.life/ms.max)*2);
      if(ms.life<=0){ this.mikusonic=null; }
      else if(ms.life%14===0){
        const ms_owner=ballMap.get(ms.ownerId);
        if(ms_owner){
          for(const b of balls){
            if(!b.alive||!isEnemy(ms_owner,b)) continue;
            const d=Math.hypot(b.x-ms_owner.x,b.y-ms_owner.y);
            if(d<ms.r+30&&d>ms.r-30){ const nx=(b.x-ms_owner.x)/(d||1),ny=(b.y-ms_owner.y)/(d||1); b.vx+=nx*8; b.vy+=ny*8; b.hit(); addDmg(ms_owner,12); burst(b.x,b.y,'#cc44ff',6); }
          }
        }
      }
    }
  },

  reset(){
    this.sandevistanFrames=0; this.sandevistanOwner=-1;
    this.timestopFrames=0; this.timestopOwner=-1;
    this.prisonFrames=0; this.prisonTarget=-1;
    this.chains.length=0; this.voidBeam=null;
    this.portals.length=0; this.rewindGhosts.length=0;
    this.ekkoGhosts.length=0; this.explosions.length=0;
    this.hellfireZone=null; this.spatialCubes.length=0;
    this.zephyrBlade=null; this.blackAstaFrames=0; this.blackAstaOwner=-1;
    this.yamiSlash=null;
    this.sukunaShrine=null; this.sukunaCleaves.length=0;
    this.mahoragaZone=null; this.bloodStreams.length=0;
    this.rikaZone=null; this.hakariFrames=0; this.hakariOwner=-1; this.hakariJackpot=0;
    this.rasengan=null; this.chidori=null;
    this.tsukuyomiTarget=-1; this.tsukuyomiFrames=0; this.tsukuyomiOwner=-1;
    this.sandWave=null;
    this.dragoNova=null; this.megiddoBeams.length=0;
    this.veldoraStorm=null; this.prominenceDragon=null; this.diabloVortex=null;
    this.chainsawRev=null; this.bloodSpears.length=0; this.makimaChains.length=0;
    this.futureDevil=null; this.pochitaCore=null;
    this.seriousPunch=null; this.incinerateBeam=null; this.tornadoPsy=null;
    this.silverFangWave=null; this.sonicSlashes.length=0;
    this.zoltraakBeams.length=0; this.granatOrb=null; this.auraSoul=null;
    this.starkThunder=null; this.frierenEnd=null;
    this.atomicBlast=null; this.shadowSlash=null; this.deltaSlashes.length=0; this.gammaBeam=null; this.betaBlades.length=0;
    this.ainzZone=null; this.albedoShield=null; this.shalltearAura=null; this.cocytusZone=null; this.demiurgeLegs.length=0;
    this.yatoCuts.length=0; this.yukinePulse=null; this.bishArr.length=0; this.noraBeads.length=0; this.veenaLightning.length=0;
    this.quagmireZone=null; this.northGodDash=null; this.orstedAura=null; this.roxyBeam=null; this.sylphieStorm=null;
    this.zafkielBullet=null; this.sandalphonCrash=null; this.origamiFeathers.length=0; this.shidoWave=null; this.mikusonic=null;
    ARENA.reset();
  }
};
// ✅ COMPLETO
