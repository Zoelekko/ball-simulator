// ════════════════════════════════════════════════
// PARTICLES
// ════════════════════════════════════════════════
import { ACX, ACY } from './constants.js';
import { ARENA, isInsideArena } from './arena.js';

export const parts = [];
// Dynamic cap — lowers under pressure (many active particles = spawn fewer)
function getMaxParts(){ return parts.length > 200 ? 250 : 400; }
export function burst(x, y, color, n=16) {
  const cap = getMaxParts();
  if(parts.length >= cap) return;
  // Under pressure: halve particle count
  const actual = parts.length > 150 ? Math.ceil(n/2) : n;
  for(let i=0;i<actual;i++){
    const a=Math.PI*2/actual*i+Math.random()*0.3, s=3+Math.random()*6;
    parts.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,r:3+Math.random()*5,color,life:55,max:55});
  }
}
export function ringBurst(x, y, color) {
  if(parts.length >= getMaxParts()) return;
  for(let i=0;i<8;i++){
    const a=Math.PI*2/8*i;
    parts.push({x,y,vx:Math.cos(a)*4,vy:Math.sin(a)*4,r:4,color,life:25,max:25});
  }
}
export function tickParts(){
  // Aggressive cleanup when over soft cap — kill oldest faster
  const overCap = parts.length > 200;
  for(let i=parts.length-1;i>=0;i--){
    const p=parts[i];
    p.x+=p.vx; p.y+=p.vy; p.vx*=0.90; p.vy*=0.90;
    p.life -= overCap ? 3 : 1; // decay 3x faster under pressure
    if(p.life<=0) parts.splice(i,1);
  }
}

// Late-binding deps for spawnOrb (needs ORB_TYPES, orbs, ORB_RADIUS, ORB_LIFETIME from abilities.js)
let _ORB_TYPES = null, _orbs = null, _ORB_RADIUS = 18, _ORB_LIFETIME = 600;
export function initParticles(deps){
  _ORB_TYPES = deps.ORB_TYPES;
  _orbs = deps.orbs;
  _ORB_RADIUS = deps.ORB_RADIUS;
  _ORB_LIFETIME = deps.ORB_LIFETIME;
}

export function spawnOrb(){
  const type=_ORB_TYPES[Math.floor(Math.random()*_ORB_TYPES.length)];
  // Rejection sampling — find a position inside the current arena shape
  const margin = _ORB_RADIUS * 2;
  const r = ARENA.r - margin;
  let x, y;
  let attempts = 0;
  do {
    x = ACX + (Math.random()*2-1)*r;
    y = ACY + (Math.random()*2-1)*r;
    attempts++;
  } while(!isInsideArena(x, y, ARENA.r, margin) && attempts < 100);
  _orbs.push({
    type, x, y,
    life:_ORB_LIFETIME, max:_ORB_LIFETIME,
    pulse:Math.random()*Math.PI*2,
  });
}
// ✅ COMPLETO
