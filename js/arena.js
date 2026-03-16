// ════════════════════════════════════════════════
// ARENA
// ════════════════════════════════════════════════
import { ACX, ACY, AR, C } from './constants.js';

// ── Arena shape system ──
// shapes: 'circle','square','triangle','pentagon','hexagon','diamond'
export const ARENA_SHAPES = ['circle','circle','circle','square','triangle','pentagon','hexagon','diamond'];

// Returns polygon vertices for a regular n-gon inscribed in radius r, centered at (cx,cy)
// angleOffset rotates the whole shape
export function polyVerts(cx, cy, r, n, angleOffset=0){
  const pts=[];
  for(let i=0;i<n;i++){
    const a=angleOffset + (Math.PI*2/n)*i - Math.PI/2;
    pts.push({x:cx+Math.cos(a)*r, y:cy+Math.sin(a)*r});
  }
  return pts;
}

// Draw any arena shape as a canvas path
export function arenaPath(ctx, r){
  ctx.beginPath();
  if(ARENA.shape==='circle'){
    ctx.arc(ACX,ACY,r,0,Math.PI*2);
  } else {
    const verts=ARENA.getVerts(r);
    ctx.moveTo(verts[0].x,verts[0].y);
    for(let i=1;i<verts.length;i++) ctx.lineTo(verts[i].x,verts[i].y);
    ctx.closePath();
  }
}

// Push a ball inside the current arena boundary and reflect velocity
export function pushInsideArena(b, radius){
  if(ARENA.shape==='circle'){
    const dist=Math.hypot(b.x-ACX,b.y-ACY);
    const lim=radius-b.r;
    if(dist>lim){
      const nx=(b.x-ACX)/(dist||1), ny=(b.y-ACY)/(dist||1);
      b.x=ACX+nx*(lim-0.5); b.y=ACY+ny*(lim-0.5);
      const dot=b.vx*nx+b.vy*ny;
      if(dot>0){b.vx-=2*dot*nx; b.vy-=2*dot*ny;}
    }
  } else {
    // Polygon: find nearest edge, push inside and reflect
    const verts=ARENA.getVerts(radius);
    const n=verts.length;
    let minDist=Infinity, bestNx=0, bestNy=0, bestPx=b.x, bestPy=b.y;
    for(let i=0;i<n;i++){
      const a=verts[i], bv=verts[(i+1)%n];
      const ex=bv.x-a.x, ey=bv.y-a.y;
      const len=Math.hypot(ex,ey)||1;
      // Normal pointing inward (toward center)
      let inx=-ey/len, iny=ex/len;
      // Ensure normal points toward center
      const mx=(a.x+bv.x)/2-ACX, my=(a.y+bv.y)/2-ACY;
      if(inx*mx+iny*my > 0){ inx=-inx; iny=-iny; }
      // Signed distance from ball to this edge (positive = inside)
      const t=Math.max(0,Math.min(1,((b.x-a.x)*ex+(b.y-a.y)*ey)/(len*len)));
      const cx2=a.x+t*ex, cy2=a.y+t*ey;
      const dist2=Math.hypot(b.x-cx2,b.y-cy2);
      // Signed: negative = outside this edge
      const side=(b.x-cx2)*inx+(b.y-cy2)*iny;
      if(side<b.r && dist2<minDist){ minDist=dist2; bestNx=-inx; bestNy=-iny; bestPx=cx2; bestPy=cy2; }
    }
    // Check if ball is outside the polygon
    if(!isInsideArena(b.x,b.y,radius,b.r)){
      // Snap to closest edge point + reflect
      b.x=bestPx+(-bestNx)*(b.r+0.5); b.y=bestPy+(-bestNy)*(b.r+0.5);
      const dot=b.vx*bestNx+b.vy*bestNy;
      if(dot>0){b.vx-=2*dot*bestNx; b.vy-=2*dot*bestNy;}
    }
  }
}

// Returns true if point (px,py) is inside the arena with given radius (with optional margin)
export function isInsideArena(px, py, radius, margin=0){
  if(ARENA.shape==='circle'){
    return Math.hypot(px-ACX,py-ACY) <= radius-margin;
  }
  // Polygon point-in-polygon (ray casting) + edge distance check
  const verts=ARENA.getVerts(radius);
  const n=verts.length;
  let inside=false;
  for(let i=0,j=n-1;i<n;j=i++){
    const xi=verts[i].x,yi=verts[i].y,xj=verts[j].x,yj=verts[j].y;
    if(((yi>py)!==(yj>py))&&(px<(xj-xi)*(py-yi)/(yj-yi)+xi)) inside=!inside;
  }
  if(!inside) return false;
  if(margin>0){
    // Also check distance to each edge >= margin
    for(let i=0;i<n;i++){
      const a=verts[i], bv=verts[(i+1)%n];
      const ex=bv.x-a.x, ey=bv.y-a.y;
      const len=Math.hypot(ex,ey)||1;
      const t=Math.max(0,Math.min(1,((px-a.x)*ex+(py-a.y)*ey)/(len*len)));
      const cx2=a.x+t*ex, cy2=a.y+t*ey;
      if(Math.hypot(px-cx2,py-cy2)<margin) return false;
    }
  }
  return true;
}

// ── Dungeon room rectangular bounds ──
// Each room is a rectangle {left, top, right, bottom} in game coords
// Centered around ACX,ACY with varying sizes
export const DUNGEON_ROOMS = [
  null, // index 0 unused (rooms are 1-based)
  // Room 1: Small stone chamber — ENTRANCE
  { w:380, h:340, name:'ENTRANCE',     stone:'#3a3028', floor:'#1a1510', accent:'#5a4a38' },
  // Room 2: Wide corridor
  { w:480, h:300, name:'CORRIDOR',      stone:'#33302a', floor:'#181412', accent:'#5a5040' },
  // Room 3: Great hall
  { w:540, h:420, name:'GREAT HALL',    stone:'#2e2820', floor:'#161210', accent:'#6a5838' },
  // Room 4: Narrow passage
  { w:580, h:280, name:'THE PASSAGE',   stone:'#2a2424', floor:'#141010', accent:'#5a3838' },
  // Room 5: Ritual chamber
  { w:460, h:460, name:'RITUAL ROOM',   stone:'#282030', floor:'#120e18', accent:'#5a3870' },
  // Room 6: Throne room (boss)
  { w:620, h:460, name:'THRONE ROOM',   stone:'#301818', floor:'#180a0a', accent:'#7a2828' },
];

export function getDungeonRoomRect(roomNum){
  const def = DUNGEON_ROOMS[roomNum] || DUNGEON_ROOMS[1];
  return {
    left:   ACX - def.w/2,
    right:  ACX + def.w/2,
    top:    ACY - def.h/2,
    bottom: ACY + def.h/2,
    w: def.w, h: def.h,
    name: def.name,
    stone: def.stone,
    floor: def.floor,
    accent: def.accent,
  };
}

export function isInsideRect(px, py, rect, margin=0){
  return px-margin >= rect.left && px+margin <= rect.right &&
         py-margin >= rect.top && py+margin <= rect.bottom;
}

export function pushInsideRect(b, rect){
  if(b.x - b.r < rect.left)  { b.x = rect.left + b.r;  const dot=b.vx; if(dot<0){ b.vx=-dot*C.REST_B; } }
  if(b.x + b.r > rect.right) { b.x = rect.right - b.r;  const dot=b.vx; if(dot>0){ b.vx=-dot*C.REST_B; } }
  if(b.y - b.r < rect.top)   { b.y = rect.top + b.r;    const dot=b.vy; if(dot<0){ b.vy=-dot*C.REST_B; } }
  if(b.y + b.r > rect.bottom){ b.y = rect.bottom - b.r;  const dot=b.vy; if(dot>0){ b.vy=-dot*C.REST_B; } }
}

export const ARENA = {
  r: AR,
  shape: 'circle',  // chosen randomly each match
  splitActive: false,
  splitAngle: 0,
  splitFrames: 0,
  chaosFrames: 0,
  chaosAngle: 0,
  shrinkFrames: 0,
  shrinkOwner: -1,
  getVerts(r){
    const s=this.shape;
    if(s==='square')   return polyVerts(ACX,ACY,r,4, Math.PI/4);
    if(s==='triangle') return polyVerts(ACX,ACY,r,3, 0);
    if(s==='pentagon') return polyVerts(ACX,ACY,r,5, 0);
    if(s==='hexagon')  return polyVerts(ACX,ACY,r,6, 0);
    if(s==='diamond')  return polyVerts(ACX,ACY,r,4, 0);
    return [];
  },
  reset(){
    this.r = AR;
    this.splitActive = false; this.splitFrames = 0;
    this.chaosFrames = 0;
    this.shrinkFrames = 0; this.shrinkOwner = -1;
  },
  pick(){
    this.shape = ARENA_SHAPES[Math.floor(Math.random()*ARENA_SHAPES.length)];
    this.r = AR;
  },
  tick(balls){
    if(this.splitFrames > 0) this.splitFrames--;
    else this.splitActive = false;

    if(this.chaosFrames > 0){
      this.chaosFrames--;
      this.chaosAngle += 0.04;
      for(const b of balls){
        if(!b.alive) continue;
        b.vx += Math.cos(this.chaosAngle) * 0.6;
        b.vy += Math.sin(this.chaosAngle) * 0.6;
      }
    }

    if(this.shrinkFrames > 0){
      this.shrinkFrames--;
      const minR = AR * 0.45;
      if(this.shrinkFrames > 240){
        this.r = Math.max(minR, this.r - 0.5);
      } else {
        this.r = Math.min(AR, this.r + 0.5);
      }
      for(const b of balls){
        if(!b.alive) continue;
        pushInsideArena(b, this.r);
      }
    } else if(this.r < AR){
      this.r = Math.min(AR, this.r + 0.5);
    }
  }
};
// ✅ COMPLETO
