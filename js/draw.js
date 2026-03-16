// ════════════════════════════════════════════════
// DRAW MODULE
// ════════════════════════════════════════════════
import { iridGrad, iridColor, W, H, OUT_W, OUT_H, SCALE, ACX, ACY, AR, LB_X, LB_Y, LB_BAR_H, LB_BAR_GAP, LB_BAR_MAX, LB_BALL_R, C } from './constants.js';
import { CAM } from './camera.js';
import { ARENA, arenaPath, DUNGEON_ROOMS } from './arena.js';
import { FX } from './fx.js';
import { parts } from './particles.js';
import { orbs, ORB_RADIUS } from './abilities.js';

// Late-binding for G (game.js) — circular dep
let _G = null;
let _DC = null;
let _RC = null;

export function initDraw(deps){
  _G = deps.G;
  _DC = deps.DC;
  _RC = deps.RC;
}

// ════════════════════════════════════════════════
// STATIC BACKGROUND
// ════════════════════════════════════════════════
export const bgOff=new OffscreenCanvas(W,H);
const bgCtx=bgOff.getContext('2d');
(()=>{
  const g=bgCtx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,'#050508'); g.addColorStop(0.6,'#060508'); g.addColorStop(1,'#040305');
  bgCtx.fillStyle=g; bgCtx.fillRect(0,0,W,H);
  bgCtx.strokeStyle='rgba(100,60,140,0.055)'; bgCtx.lineWidth=1;
  for(let y=0;y<H;y+=60){bgCtx.beginPath();bgCtx.moveTo(0,y);bgCtx.lineTo(W,y);bgCtx.stroke();}
  for(let x=0;x<W;x+=60){bgCtx.beginPath();bgCtx.moveTo(x,0);bgCtx.lineTo(x,H);bgCtx.stroke();}
})();

// ════════════════════════════════════════════════
// SMOOTHED SHAKE STATE (arena only — UI never shakes)
// ════════════════════════════════════════════════
let _shakeX = 0, _shakeY = 0;
let _shakeTargetX = 0, _shakeTargetY = 0;
let _shakeRefresh = 0;


// ════════════════════════════════════════════════
// ROUND TRANSITION — glitch flash wipe
// ════════════════════════════════════════════════
let transitionFrames = 0;
const TRANS_DUR = 22;

export function triggerRoundTransition(){ transitionFrames = TRANS_DUR; }

function drawRoundTransition(ctx){
  if(transitionFrames <= 0) return;
  const t = transitionFrames / TRANS_DUR;
  const p = 1 - t; // progress 0→1
  transitionFrames--;

  // --- Phase 1: white flash (first 4 frames) ---
  if(transitionFrames > TRANS_DUR - 5){
    const flashT = (TRANS_DUR - transitionFrames) / 4;
    ctx.fillStyle = `rgba(255,255,255,${1 - flashT * flashT})`;
    ctx.fillRect(0, 0, W, H);
    return;
  }

  // --- Dark overlay ---
  ctx.fillStyle = `rgba(0,0,0,${t * 0.6})`;
  ctx.fillRect(0, 0, W, H);

  // --- Phase 2: horizontal glitch wipe bars ---
  const barSeed = _G.round * 7;
  const barCount = 8;
  const barAlpha = Math.max(0, 1 - p * 2.5);
  if(barAlpha > 0){
    ctx.save();
    ctx.globalAlpha = barAlpha;
    for(let i = 0; i < barCount; i++){
      const pseudo = ((barSeed + i * 137) % 100) / 100;
      const by = pseudo * H;
      const bh = 2 + (pseudo * 6) | 0;
      const bx = -W + p * W * 3 * (i % 2 === 0 ? 1 : -1) + W * (i % 2);
      const grad = iridGrad(ctx, bx, by, bx + W * 0.6, by, frame + i * 20);
      ctx.fillStyle = grad;
      ctx.fillRect(bx, by, W * 0.6, bh);
    }
    ctx.restore();
  }

  // --- Phase 5: radial energy burst behind text ---
  const burstAlpha = Math.sin(p * Math.PI) * 0.5;
  if(burstAlpha > 0.01){
    ctx.save();
    ctx.globalAlpha = burstAlpha;
    const burstR = 80 + p * 350;
    const radGrad = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, burstR);
    const ac = iridColor(frame);
    radGrad.addColorStop(0, ac);
    radGrad.addColorStop(0.4, `rgba(180,200,255,0.25)`);
    radGrad.addColorStop(1, `rgba(0,0,0,0)`);
    ctx.fillStyle = radGrad;
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, burstR, 0, Math.PI * 2);
    ctx.fill();

    // radial rays
    const rayCount = 12;
    ctx.strokeStyle = ac;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = burstAlpha * 0.6;
    for(let r = 0; r < rayCount; r++){
      const angle = (r / rayCount) * Math.PI * 2 + frame * 0.04;
      const inner = 60 + Math.sin(frame * 0.1 + r) * 20;
      const outer = burstR * (0.7 + Math.sin(frame * 0.15 + r * 2) * 0.3);
      ctx.beginPath();
      ctx.moveTo(W / 2 + Math.cos(angle) * inner, H / 2 + Math.sin(angle) * inner);
      ctx.lineTo(W / 2 + Math.cos(angle) * outer, H / 2 + Math.sin(angle) * outer);
      ctx.stroke();
    }
    ctx.restore();
  }

  // --- Phase 3: "ROUND X" text with elastic bounce scale ---
  const rawP = Math.min(1, p * 1.6);
  // elastic ease-out: overshoot then settle
  const elastic = rawP < 1
    ? 1 - Math.pow(2, -10 * rawP) * Math.cos(rawP * Math.PI * 3.5)
    : 1;
  const scale = 0.3 + elastic * 0.7;
  const textAlpha = Math.min(1, p * 4) * Math.min(1, t * 5);
  const label = _G.dungeonMode ? `ROOM ${_G.dungeonRoom}` : `ROUND ${_G.round}`;

  ctx.save();
  ctx.globalAlpha = textAlpha;
  ctx.translate(W / 2, H / 2);
  ctx.scale(scale, scale);
  ctx.font = 'bold 120px Rajdhani, Courier New';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // colored outline (iridescent stroke)
  const ac = iridColor(frame);
  ctx.strokeStyle = ac;
  ctx.lineWidth = 6;
  ctx.lineJoin = 'round';
  ctx.strokeText(label, 0, 0);

  // white fill with shadow glow
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = ac;
  ctx.shadowBlur = 40;
  ctx.fillText(label, 0, 0);
  // double glow pass for intensity
  ctx.shadowBlur = 80;
  ctx.shadowColor = 'rgba(180,220,255,0.7)';
  ctx.fillText(label, 0, 0);
  ctx.shadowBlur = 0;
  ctx.restore();

  // --- Phase 4: horizontal accent line sweep ---
  const sweepP = Math.min(1, Math.max(0, (p - 0.15) * 2.0));
  if(sweepP > 0 && sweepP < 1){
    ctx.save();
    const sx = -W * 0.1 + sweepP * W * 1.2;
    const lineW = W * 0.35;
    const lineGrad = iridGrad(ctx, sx - lineW / 2, H / 2, sx + lineW / 2, H / 2, frame);
    ctx.strokeStyle = lineGrad;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 1 - sweepP;
    ctx.beginPath();
    ctx.moveTo(sx - lineW / 2, H / 2 + 70);
    ctx.lineTo(sx + lineW / 2, H / 2 + 70);
    ctx.stroke();

    // mirror line above text
    ctx.beginPath();
    ctx.moveTo(W - (sx - lineW / 2), H / 2 - 70);
    ctx.lineTo(W - (sx + lineW / 2), H / 2 - 70);
    ctx.stroke();
    ctx.restore();
  }
}

// ════════════════════════════════════════════════
// DRAW: CINEMATIC MOMENT OVERLAY
// ════════════════════════════════════════════════
function drawCinematic(ctx, frame){
  if(!CAM.active) return;
  const phase=CAM.phase;

  const fadeAlpha = phase==='fadeout' ? Math.max(0,1-CAM.timer/40) : 1;
  const vigR=ctx.createRadialGradient(CAM.focX,CAM.focY,60,CAM.focX,CAM.focY,AR*1.1);
  vigR.addColorStop(0,'rgba(0,0,0,0)');
  vigR.addColorStop(1,`rgba(0,0,0,${0.5*fadeAlpha})`);
  ctx.fillStyle=vigR; ctx.fillRect(0,0,W,H);

  ctx.globalAlpha=0.10*fadeAlpha;
  ctx.fillStyle='#ff0033'; ctx.fillRect(0,0,6,H); ctx.fillRect(W-6,0,6,H);
  ctx.fillStyle='#0033ff'; ctx.fillRect(3,0,6,H); ctx.fillRect(W-12,0,6,H);
  ctx.globalAlpha=1;

  if(phase==='pickup'){
    const pt=Math.min(1,CAM.timer/55);

    if(pt<0.7){
      const la=(pt<0.3?pt/0.3:1-(pt-0.3)/0.4)*0.65;
      ctx.globalAlpha=la;
      ctx.strokeStyle='#ffffff'; ctx.lineWidth=1.2;
      for(let li=0;li<24;li++){
        const a=Math.PI*2/24*li+(frame*0.01);
        const r1=50+li*3, r2=r1+60+li*2;
        ctx.beginPath();
        ctx.moveTo(CAM.focX+Math.cos(a)*r1, CAM.focY+Math.sin(a)*r1);
        ctx.lineTo(CAM.focX+Math.cos(a)*r2, CAM.focY+Math.sin(a)*r2);
        ctx.stroke();
      }
      ctx.globalAlpha=1;
    }

    if(pt<0.4){
      const rr=(1-pt/0.4);
      ctx.globalAlpha=rr*0.6;
      ctx.strokeStyle=CAM.orbColor; ctx.lineWidth=6;
      ctx.beginPath(); ctx.arc(CAM.focX,CAM.focY,(1-rr)*120,0,Math.PI*2); ctx.stroke();
      ctx.globalAlpha=1;
    }
  }


  if(phase==='follow'){
    const ft=CAM.timer/90;
    const pulse=0.5+0.5*Math.sin(frame*0.25);
    ctx.globalAlpha=(0.5+0.3*pulse)*fadeAlpha;
    ctx.strokeStyle=CAM.orbColor; ctx.lineWidth=2.5;
    const sz=38, bsz=14;
    const tx=CAM.followX, ty=CAM.followY;
    [[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([sx,sy])=>{
      ctx.beginPath();
      ctx.moveTo(tx+sx*sz,ty+sy*(sz-bsz)); ctx.lineTo(tx+sx*sz,ty+sy*sz); ctx.lineTo(tx+sx*(sz-bsz),ty+sy*sz);
      ctx.stroke();
    });
    ctx.globalAlpha=0.7*fadeAlpha;
    ctx.fillStyle=CAM.orbColor;
    ctx.beginPath(); ctx.arc(tx,ty,4,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=1;
  }

  if(CAM.impactAlpha>0){
    ctx.globalAlpha=CAM.impactAlpha*0.35;
    ctx.fillStyle=CAM.impactColor; ctx.fillRect(0,0,W,H);
    ctx.globalAlpha=1;
  }

  if(CAM.resultText && CAM.resultTimer>0){
    const rt=CAM.resultTimer/70;
    const scale=rt>0.8?(1+(1-rt)*0.5):1;
    ctx.save();
    ctx.translate(CAM.tgtX, CAM.tgtY-70);
    ctx.scale(scale,scale);
    ctx.globalAlpha=rt;
    ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.font='bold 44px Rajdhani, Courier New';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(CAM.resultText,2,2);
    ctx.fillStyle=CAM.impactColor;
    ctx.fillText(CAM.resultText,0,0);
    ctx.restore();
  }

  ctx.globalAlpha=1;
}

function drawFX(ctx, frame){
  // ── Sandevistan world tint ──
  if(FX.sandevistanFrames>0){
    const sf=FX.sandevistanFrames/240;
    const pulse=0.5+0.5*Math.sin(frame*0.25);
    const pulse2=0.5+0.5*Math.sin(frame*0.13+1.2);
    const pulse3=0.5+0.5*Math.cos(frame*0.37);
    // Multi-layer dark tint with radial depth
    const tintGrad=ctx.createRadialGradient(ACX,ACY,AR*0.1,ACX,ACY,AR);
    tintGrad.addColorStop(0,`rgba(0,8,30,${0.10*sf})`);
    tintGrad.addColorStop(0.5,`rgba(0,12,40,${0.20*sf})`);
    tintGrad.addColorStop(1,`rgba(0,20,60,${0.30*sf})`);
    ctx.fillStyle=tintGrad;
    ctx.beginPath(); ctx.arc(ACX,ACY,AR,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=1;
    ctx.save();
    ctx.beginPath(); ctx.arc(ACX,ACY,AR,0,Math.PI*2); ctx.clip();
    // Chromatic aberration edge bands
    const chromW=AR*0.12;
    ctx.globalAlpha=0.06*sf*pulse;
    ctx.fillStyle='#ff0044';
    ctx.beginPath(); ctx.arc(ACX-3,ACY,AR,0,Math.PI*2); ctx.arc(ACX,ACY,AR-chromW,0,Math.PI*2); ctx.fill('evenodd');
    ctx.fillStyle='#0044ff';
    ctx.beginPath(); ctx.arc(ACX+3,ACY,AR,0,Math.PI*2); ctx.arc(ACX,ACY,AR-chromW,0,Math.PI*2); ctx.fill('evenodd');
    // Hexagonal grid overlay
    ctx.globalAlpha=0.04*sf*(0.6+0.4*pulse2);
    ctx.strokeStyle='#00ffff'; ctx.lineWidth=0.6;
    const hexR=36, hexH=hexR*Math.sqrt(3);
    for(let hy=ACY-AR;hy<ACY+AR;hy+=hexH){
      for(let hx=ACX-AR;hx<ACX+AR;hx+=hexR*3){
        const offY=(Math.floor((hy-ACY+AR)/hexH)%2)*hexR*1.5;
        const cx=hx+offY, cy=hy;
        if(Math.hypot(cx-ACX,cy-ACY)>AR-10) continue;
        ctx.beginPath();
        for(let hi=0;hi<6;hi++){
          const ha=Math.PI/3*hi-Math.PI/6;
          const hpx=cx+Math.cos(ha)*hexR*0.48, hpy=cy+Math.sin(ha)*hexR*0.48;
          hi===0?ctx.moveTo(hpx,hpy):ctx.lineTo(hpx,hpy);
        }
        ctx.closePath(); ctx.stroke();
      }
    }
    // Dense matrix rain data streams (triple density)
    for(let li=0;li<48;li++){
      const lx=ACX-AR+li*(AR*2/47);
      const speed=2.5+((li*7)%5)*0.8;
      const offset=((frame*speed+li*37)%(AR*2+120));
      const streamLen=40+((li*13)%40);
      const streamAlpha=0.12*sf*(0.5+0.5*Math.sin(frame*0.1+li*0.7));
      ctx.globalAlpha=streamAlpha*0.5;
      ctx.strokeStyle='#005577'; ctx.lineWidth=5;
      ctx.beginPath(); ctx.moveTo(lx,ACY-AR+offset); ctx.lineTo(lx,ACY-AR+offset+streamLen); ctx.stroke();
      ctx.globalAlpha=streamAlpha;
      ctx.strokeStyle='#00ffff'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(lx,ACY-AR+offset); ctx.lineTo(lx,ACY-AR+offset+streamLen); ctx.stroke();
      ctx.globalAlpha=streamAlpha*1.5;
      ctx.fillStyle='#aaffff';
      ctx.fillRect(lx-0.8,ACY-AR+offset+streamLen-3,1.6,3);
    }
    // Multi-speed scan lines
    const scanY1=ACY-AR+((frame*3)%(AR*2));
    const scanY2=ACY-AR+((frame*5+140)%(AR*2));
    const scanY3=ACY-AR+((frame*1.5+280)%(AR*2));
    ctx.globalAlpha=0.08*sf;
    ctx.fillStyle='#00ffff';
    ctx.fillRect(ACX-AR,scanY1-8,AR*2,16);
    ctx.globalAlpha=0.25*sf;
    ctx.strokeStyle='#00ffff'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(ACX-AR,scanY1); ctx.lineTo(ACX+AR,scanY1); ctx.stroke();
    ctx.globalAlpha=0.15*sf;
    ctx.strokeStyle='#44ffff'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(ACX-AR,scanY2); ctx.lineTo(ACX+AR,scanY2); ctx.stroke();
    ctx.globalAlpha=0.05*sf;
    ctx.fillStyle='#00aacc';
    ctx.fillRect(ACX-AR,scanY3-20,AR*2,40);
    // Data stream particles falling
    if(frame%4===0){
      const dpx=ACX+(Math.random()*2-1)*AR*0.9, dpy=ACY-AR+Math.random()*AR*0.3;
      parts.length<400&&parts.push({x:dpx,y:dpy,vx:(Math.random()-0.5)*0.3,vy:2+Math.random()*3,r:1+Math.random()*1.5,color:Math.random()<0.3?'#aaffff':'#00ffff',life:60,max:60});
    }
    ctx.restore();
    ctx.globalAlpha=1;
    // Multi-layer pulsing edge ring - bloom approximation
    ctx.globalAlpha=(0.06+0.04*pulse)*sf;
    ctx.strokeStyle='#003355'; ctx.lineWidth=28;
    ctx.beginPath(); ctx.arc(ACX,ACY,AR-2,0,Math.PI*2); ctx.stroke();
    ctx.globalAlpha=(0.10+0.08*pulse2)*sf;
    ctx.strokeStyle='#005588'; ctx.lineWidth=16;
    ctx.beginPath(); ctx.arc(ACX,ACY,AR-4,0,Math.PI*2); ctx.stroke();
    ctx.globalAlpha=(0.20+0.15*pulse)*sf;
    ctx.strokeStyle='#00ccff'; ctx.lineWidth=4+2*pulse3;
    ctx.beginPath(); ctx.arc(ACX,ACY,AR-6,0,Math.PI*2); ctx.stroke();
    ctx.globalAlpha=(0.30+0.12*pulse3)*sf;
    ctx.strokeStyle='#aaffff'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.arc(ACX,ACY,AR-7,0,Math.PI*2); ctx.stroke();
    // Energy crackle arcs at border
    ctx.globalAlpha=0.18*sf*pulse;
    ctx.strokeStyle='#00ffff'; ctx.lineWidth=1;
    for(let ai=0;ai<8;ai++){
      const aStart=ai*Math.PI/4+frame*0.02, aLen=0.15+0.1*Math.sin(frame*0.3+ai);
      ctx.beginPath(); ctx.arc(ACX,ACY,AR-8+3*Math.sin(frame*0.2+ai*2),aStart,aStart+aLen); ctx.stroke();
    }
    ctx.globalAlpha=1;
  }

  // ── Timestop golden zone ──
  if(FX.timestopFrames>0){
    const tp=FX.timestopFrames/180;
    const tPulse=0.5+0.5*Math.sin(frame*0.08);
    const tPulse2=0.5+0.5*Math.cos(frame*0.19+0.7);
    const tPulse3=0.5+0.5*Math.sin(frame*0.31);
    // Multi-layer golden vignette with depth
    const tsGrad=ctx.createRadialGradient(ACX,ACY,0,ACX,ACY,AR);
    tsGrad.addColorStop(0,'rgba(255,240,180,0)');
    tsGrad.addColorStop(0.3,`rgba(255,215,0,${0.04*tp})`);
    tsGrad.addColorStop(0.7,`rgba(255,180,0,${0.14*tp})`);
    tsGrad.addColorStop(1,`rgba(180,120,0,${0.30*tp})`);
    ctx.fillStyle=tsGrad;
    ctx.beginPath(); ctx.arc(ACX,ACY,AR,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=0.04*tp*tPulse;
    ctx.fillStyle='#ffcc00';
    ctx.beginPath(); ctx.arc(ACX,ACY,AR,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=1;
    // Frozen crack lines with glow and branching
    ctx.save();
    ctx.translate(ACX,ACY);
    for(let ci=0;ci<28;ci++){
      const a=ci*Math.PI*2/28;
      const len=(80+Math.sin(ci*2.3)*60+20*tPulse2)*tp;
      ctx.globalAlpha=0.12*tp;
      ctx.strokeStyle='#ffdd44'; ctx.lineWidth=5;
      ctx.beginPath(); ctx.moveTo(0,0);
      ctx.lineTo(Math.cos(a)*len*0.3,Math.sin(a)*len*0.3);
      ctx.lineTo(Math.cos(a+0.15)*(len*0.6),Math.sin(a+0.15)*(len*0.6));
      ctx.lineTo(Math.cos(a)*len,Math.sin(a)*len);
      ctx.stroke();
      ctx.globalAlpha=0.35*tp;
      ctx.strokeStyle='#ffe566'; ctx.lineWidth=1.5+0.5*tPulse;
      ctx.beginPath(); ctx.moveTo(0,0);
      ctx.lineTo(Math.cos(a)*len*0.3,Math.sin(a)*len*0.3);
      ctx.lineTo(Math.cos(a+0.15)*(len*0.6),Math.sin(a+0.15)*(len*0.6));
      ctx.lineTo(Math.cos(a)*len,Math.sin(a)*len);
      ctx.stroke();
      if(ci%2===0){
        const brA=a+0.3+0.1*Math.sin(ci), brLen=len*0.35;
        ctx.globalAlpha=0.2*tp;
        ctx.strokeStyle='#ffcc33'; ctx.lineWidth=1;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a+0.15)*(len*0.6),Math.sin(a+0.15)*(len*0.6));
        ctx.lineTo(Math.cos(brA)*(len*0.6+brLen),Math.sin(brA)*(len*0.6+brLen));
        ctx.stroke();
      }
    }
    // Multi-layer spinning outer ring - bloom
    ctx.rotate(frame*0.003);
    ctx.globalAlpha=0.10*tp;
    ctx.strokeStyle='#665500'; ctx.lineWidth=18;
    ctx.beginPath(); ctx.arc(0,0,AR-4,0,Math.PI*2); ctx.stroke();
    ctx.globalAlpha=0.20*tp;
    ctx.strokeStyle='#aa8800'; ctx.lineWidth=8;
    ctx.beginPath(); ctx.arc(0,0,AR-8,0,Math.PI*2); ctx.stroke();
    ctx.globalAlpha=0.40*tp*(0.8+0.2*tPulse);
    ctx.strokeStyle='#ffd700'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.arc(0,0,AR-10,0,Math.PI*2); ctx.stroke();
    ctx.globalAlpha=0.30*tp*tPulse3;
    ctx.strokeStyle='#fff8cc'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.arc(0,0,AR-11,0,Math.PI*2); ctx.stroke();
    // Clock hands with glow
    ctx.globalAlpha=0.25*tp;
    ctx.strokeStyle='#ffd700'; ctx.lineWidth=10; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,-(AR*0.5)); ctx.stroke();
    ctx.globalAlpha=0.6*tp;
    ctx.strokeStyle='#fff4aa'; ctx.lineWidth=4;
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,-(AR*0.5)); ctx.stroke();
    ctx.globalAlpha=0.20*tp;
    ctx.strokeStyle='#ffd700'; ctx.lineWidth=8;
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(AR*0.35,AR*0.12); ctx.stroke();
    ctx.globalAlpha=0.55*tp;
    ctx.strokeStyle='#fff4aa'; ctx.lineWidth=2.5;
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(AR*0.35,AR*0.12); ctx.stroke();
    // Center clock hub glow
    ctx.globalAlpha=0.5*tp;
    const hubGrad=ctx.createRadialGradient(0,0,0,0,0,20);
    hubGrad.addColorStop(0,'#ffffff');
    hubGrad.addColorStop(0.4,'#ffd700');
    hubGrad.addColorStop(1,'rgba(255,215,0,0)');
    ctx.fillStyle=hubGrad;
    ctx.beginPath(); ctx.arc(0,0,20,0,Math.PI*2); ctx.fill();
    // 12 tick marks with glow
    for(let ti=0;ti<12;ti++){
      const a=ti*Math.PI/6;
      ctx.globalAlpha=0.15*tp;
      ctx.strokeStyle='#ffcc00'; ctx.lineWidth=6;
      ctx.beginPath(); ctx.moveTo(Math.cos(a)*(AR-26),Math.sin(a)*(AR-26)); ctx.lineTo(Math.cos(a)*(AR-12),Math.sin(a)*(AR-12)); ctx.stroke();
      ctx.globalAlpha=0.50*tp;
      ctx.strokeStyle='#ffd700'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(Math.cos(a)*(AR-24),Math.sin(a)*(AR-24)); ctx.lineTo(Math.cos(a)*(AR-12),Math.sin(a)*(AR-12)); ctx.stroke();
    }
    // Floating golden dust particles
    if(frame%3===0){
      const ga=Math.random()*Math.PI*2, gd=Math.random()*AR*0.8;
      parts.length<400&&parts.push({x:ACX+Math.cos(ga)*gd,y:ACY+Math.sin(ga)*gd,vx:(Math.random()-0.5)*0.5,vy:-0.5-Math.random()*0.8,r:1+Math.random()*2,color:Math.random()<0.5?'#ffd700':'#fff4aa',life:50,max:50});
    }
    // Sepia time distortion rings
    ctx.globalAlpha=0.08*tp*tPulse2;
    ctx.strokeStyle='#ccaa44'; ctx.lineWidth=1;
    ctx.setLineDash([3,5]);
    ctx.beginPath(); ctx.arc(0,0,AR*0.5,0,Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0,0,AR*0.7,0,Math.PI*2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineCap='butt';
    ctx.restore();
    ctx.globalAlpha=1;
  }

  // ── Prison cage ──
  if(FX.prisonFrames>0 && FX.prisonTarget>=0){
    const prisoner=_G.balls.find(b=>b.id===FX.prisonTarget);
    if(prisoner){
      const px=prisoner.x, py=prisoner.y, sz=54;
      const pp=0.5+0.5*Math.sin(frame*0.15);
      const pp2=0.5+0.5*Math.cos(frame*0.22+0.8);
      const pp3=0.5+0.5*Math.sin(frame*0.35);
      const pf=FX.prisonFrames/180;
      // Multi-layer fiery floor glow
      const pgrd=ctx.createRadialGradient(px,py+sz,0,px,py,sz*1.8);
      pgrd.addColorStop(0,`rgba(255,160,30,${0.30*pf})`);
      pgrd.addColorStop(0.4,`rgba(255,80,0,${0.18*pf})`);
      pgrd.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=pgrd;
      ctx.fillRect(px-sz*2,py-sz*2,sz*4,sz*4);
      // Secondary heat haze glow
      const pgrd2=ctx.createRadialGradient(px,py,0,px,py,sz*1.2);
      pgrd2.addColorStop(0,`rgba(255,200,100,${0.08*pf*pp})`);
      pgrd2.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=pgrd2;
      ctx.fillRect(px-sz*1.5,py-sz*1.5,sz*3,sz*3);
      // 12 vertical energy bars with multi-layer glow
      for(let bi=0;bi<12;bi++){
        const a=bi*Math.PI/6;
        const bx=px+Math.cos(a)*sz*0.85;
        const barPulse=(0.65+0.25*Math.sin(frame*0.15+bi*0.5))*pf;
        const barWave=Math.sin(frame*0.1+bi*0.8)*3;
        // Wide soft bloom
        ctx.globalAlpha=barPulse*0.15;
        ctx.strokeStyle='#ff4400'; ctx.lineWidth=18;
        ctx.beginPath(); ctx.moveTo(bx,py-sz+barWave); ctx.lineTo(bx,py+sz-barWave); ctx.stroke();
        // Bar glow
        ctx.globalAlpha=barPulse*0.4;
        ctx.strokeStyle='#ffaa33'; ctx.lineWidth=8;
        ctx.beginPath(); ctx.moveTo(bx,py-sz+barWave); ctx.lineTo(bx,py+sz-barWave); ctx.stroke();
        // Bar core
        ctx.globalAlpha=barPulse;
        ctx.strokeStyle='#ff6600'; ctx.lineWidth=2.5+pp*1.5;
        ctx.beginPath(); ctx.moveTo(bx,py-sz+barWave); ctx.lineTo(bx,py+sz-barWave); ctx.stroke();
        // White-hot center thread
        ctx.globalAlpha=barPulse*0.6*pp2;
        ctx.strokeStyle='#ffeeaa'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(bx,py-sz+barWave); ctx.lineTo(bx,py+sz-barWave); ctx.stroke();
        // Energy crackle on bars
        if(bi%3===0){
          ctx.globalAlpha=barPulse*0.5*pp3;
          ctx.strokeStyle='#ffff88'; ctx.lineWidth=0.8;
          const crY=py-sz+Math.random()*sz*2;
          ctx.beginPath(); ctx.moveTo(bx-4,crY); ctx.lineTo(bx+4,crY+6); ctx.lineTo(bx-2,crY+12); ctx.stroke();
        }
      }
      ctx.globalAlpha=1;
      // Top ring with bloom
      ctx.globalAlpha=0.15*pf;
      ctx.strokeStyle='#ff4400'; ctx.lineWidth=14;
      ctx.beginPath(); ctx.ellipse(px,py-sz,sz*0.85,12,0,0,Math.PI*2); ctx.stroke();
      ctx.strokeStyle=`rgba(255,90,0,${(0.9+0.1*pp)*pf})`; ctx.lineWidth=4;
      ctx.beginPath(); ctx.ellipse(px,py-sz,sz*0.85,12,0,0,Math.PI*2); ctx.stroke();
      ctx.globalAlpha=(0.7+0.2*pp3)*pf;
      ctx.strokeStyle='#ffcc66'; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.ellipse(px,py-sz,sz*0.85,12,0,0,Math.PI*2); ctx.stroke();
      // Bottom ring with bloom
      ctx.globalAlpha=0.15*pf;
      ctx.strokeStyle='#ff4400'; ctx.lineWidth=14;
      ctx.beginPath(); ctx.ellipse(px,py+sz,sz*0.85,12,0,0,Math.PI*2); ctx.stroke();
      ctx.strokeStyle=`rgba(255,90,0,${(0.9+0.1*pp)*pf})`; ctx.lineWidth=4;
      ctx.beginPath(); ctx.ellipse(px,py+sz,sz*0.85,12,0,0,Math.PI*2); ctx.stroke();
      ctx.globalAlpha=(0.7+0.2*pp3)*pf;
      ctx.strokeStyle='#ffcc66'; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.ellipse(px,py+sz,sz*0.85,12,0,0,Math.PI*2); ctx.stroke();
      // Dual spinning energy rings
      ctx.save(); ctx.translate(px,py); ctx.rotate(frame*0.06);
      ctx.globalAlpha=(0.4+0.3*pp)*pf;
      ctx.strokeStyle='#ffcc44'; ctx.lineWidth=2;
      ctx.setLineDash([10,6]);
      ctx.beginPath(); ctx.ellipse(0,0,sz*0.85,14,0,0,Math.PI*2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      ctx.save(); ctx.translate(px,py); ctx.rotate(-frame*0.04+1);
      ctx.globalAlpha=(0.25+0.2*pp2)*pf;
      ctx.strokeStyle='#ff8844'; ctx.lineWidth=1.5;
      ctx.setLineDash([6,10]);
      ctx.beginPath(); ctx.ellipse(0,0,sz*0.7,20,0,0,Math.PI*2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      // Inner orange glow with gradient
      const innerGrd=ctx.createRadialGradient(px,py,0,px,py,sz*0.8);
      innerGrd.addColorStop(0,`rgba(255,180,60,${0.10*pf*pp})`);
      innerGrd.addColorStop(1,`rgba(255,80,0,${0.05*pf})`);
      ctx.fillStyle=innerGrd;
      ctx.beginPath(); ctx.ellipse(px,py,sz*0.8,sz,0,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha=1;
      // Triple ember particles rising
      if(frame%4===0){
        parts.length<400&&parts.push({x:px+(Math.random()*2-1)*sz*0.7,y:py+sz,vx:(Math.random()-0.5)*0.8,vy:-2.5-Math.random()*2,r:2+Math.random()*2,color:Math.random()<0.5?'#ff8833':'#ffcc44',life:40,max:40});
        parts.length<400&&parts.push({x:px+(Math.random()*2-1)*sz*0.5,y:py+sz*0.8,vx:(Math.random()-0.5)*1.2,vy:-1.5-Math.random()*1.5,r:1+Math.random()*1.5,color:Math.random()<0.3?'#ffff88':'#ff6600',life:30,max:30});
      }
      if(frame%4===0){
        parts.length<400&&parts.push({x:px+(Math.random()*2-1)*sz*0.3,y:py,vx:(Math.random()-0.5)*0.4,vy:-3-Math.random()*2,r:1+Math.random(),color:'#ffffff',life:20,max:20});
      }
    }
  }

  // ── Gojo Purple Void Beam ──
  if(FX.voidBeam){
    const bm=FX.voidBeam;
    const prog=bm.life/bm.max;
    const len=AR*2.2;
    const ex=bm.x+Math.cos(bm.angle)*len, ey=bm.y+Math.sin(bm.angle)*len;
    const shimmer=0.6+0.4*Math.sin(frame*0.4);
    const shimmer2=0.5+0.5*Math.sin(frame*0.65+1.0);
    const shimmer3=0.5+0.5*Math.cos(frame*0.23);
    const perpX=-Math.sin(bm.angle), perpY=Math.cos(bm.angle);
    // Ultra-wide ambient purple bloom
    ctx.globalAlpha=prog*0.10;
    ctx.strokeStyle='#220055'; ctx.lineWidth=140;
    ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(bm.x,bm.y); ctx.lineTo(ex,ey); ctx.stroke();
    // Wide outer purple glow
    ctx.globalAlpha=prog*0.20;
    ctx.strokeStyle='#5500bb'; ctx.lineWidth=80+10*shimmer;
    ctx.beginPath(); ctx.moveTo(bm.x,bm.y); ctx.lineTo(ex,ey); ctx.stroke();
    // Mid purple layer 1
    ctx.globalAlpha=prog*0.35;
    ctx.strokeStyle='#7711dd'; ctx.lineWidth=52;
    ctx.beginPath(); ctx.moveTo(bm.x,bm.y); ctx.lineTo(ex,ey); ctx.stroke();
    // Mid purple layer 2
    ctx.globalAlpha=prog*0.55;
    ctx.strokeStyle='#9922ff'; ctx.lineWidth=38;
    ctx.beginPath(); ctx.moveTo(bm.x,bm.y); ctx.lineTo(ex,ey); ctx.stroke();
    // Dark void edge
    ctx.globalAlpha=prog*0.7;
    ctx.strokeStyle='#110022'; ctx.lineWidth=28;
    ctx.beginPath(); ctx.moveTo(bm.x,bm.y); ctx.lineTo(ex,ey); ctx.stroke();
    // Black void core
    ctx.globalAlpha=prog*0.98;
    ctx.strokeStyle='#000000'; ctx.lineWidth=22;
    ctx.beginPath(); ctx.moveTo(bm.x,bm.y); ctx.lineTo(ex,ey); ctx.stroke();
    // Inner purple-white thread
    ctx.globalAlpha=prog*0.5*shimmer2;
    ctx.strokeStyle='#cc88ff'; ctx.lineWidth=6;
    ctx.beginPath(); ctx.moveTo(bm.x,bm.y); ctx.lineTo(ex,ey); ctx.stroke();
    // Inner white-hot thread
    ctx.globalAlpha=prog*0.85*shimmer;
    ctx.strokeStyle='#ffffff'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.moveTo(bm.x,bm.y); ctx.lineTo(ex,ey); ctx.stroke();
    // Bright center pulse
    ctx.globalAlpha=prog*0.4*shimmer3;
    ctx.strokeStyle='#eeddff'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(bm.x,bm.y); ctx.lineTo(ex,ey); ctx.stroke();
    // Dual magenta crackle edges with offset
    ctx.strokeStyle='#ff44ff'; ctx.lineWidth=1.5;
    ctx.globalAlpha=prog*shimmer*0.9;
    ctx.setLineDash([4,8]);
    for(let ci2=0;ci2<2;ci2++){
      const cOff=(ci2===0?1:-1)*(8+3*shimmer2);
      ctx.beginPath();
      ctx.moveTo(bm.x+perpX*cOff,bm.y+perpY*cOff);
      ctx.lineTo(ex+perpX*cOff,ey+perpY*cOff);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // Energy crackle lightning along beam edges
    ctx.globalAlpha=prog*0.6*shimmer;
    ctx.strokeStyle='#dd66ff'; ctx.lineWidth=1;
    for(let ck=0;ck<6;ck++){
      const ckT=ck/6;
      const ckX=bm.x+Math.cos(bm.angle)*len*ckT, ckY=bm.y+Math.sin(bm.angle)*len*ckT;
      const side=(ck%2===0?1:-1);
      const ckLen=12+8*Math.sin(frame*0.5+ck*2);
      ctx.beginPath();
      ctx.moveTo(ckX+perpX*side*12,ckY+perpY*side*12);
      ctx.lineTo(ckX+perpX*side*(12+ckLen*0.5)+Math.cos(bm.angle)*4,ckY+perpY*side*(12+ckLen*0.5)+Math.sin(bm.angle)*4);
      ctx.lineTo(ckX+perpX*side*(12+ckLen),ckY+perpY*side*(12+ckLen));
      ctx.stroke();
    }
    // Triple distortion particles along beam
    if(frame%4===0){
      for(let dp=0;dp<3;dp++){
        const t=Math.random();
        const bpx=bm.x+Math.cos(bm.angle)*len*t, bpy=bm.y+Math.sin(bm.angle)*len*t;
        const spread=25+dp*5;
        parts.length<400&&parts.push({x:bpx+(Math.random()-0.5)*spread,y:bpy+(Math.random()-0.5)*spread,vx:(Math.random()-0.5)*3,vy:(Math.random()-0.5)*3,r:1.5+Math.random()*3,color:['#aa00ff','#ff00ff','#cc44ff','#7700cc'][Math.floor(Math.random()*4)],life:22,max:22});
      }
    }
    // Impact point flash at beam origin
    ctx.globalAlpha=prog*0.4*shimmer2;
    const impGrad=ctx.createRadialGradient(bm.x,bm.y,0,bm.x,bm.y,35);
    impGrad.addColorStop(0,'#ffffff');
    impGrad.addColorStop(0.3,'#cc88ff');
    impGrad.addColorStop(1,'rgba(100,0,200,0)');
    ctx.fillStyle=impGrad;
    ctx.beginPath(); ctx.arc(bm.x,bm.y,35,0,Math.PI*2); ctx.fill();
    ctx.lineCap='butt';
    ctx.globalAlpha=1;
  }

  // ── Toji chains / Gojo Blue pull ──
  for(const c of FX.chains){
    const p=c.life/c.max;
    if(c.type==='toji'){
      const dx=c.x2-c.x1, dy=c.y2-c.y1;
      const len=Math.hypot(dx,dy)||1;
      const nx=dy/len, ny=-dx/len; // perpendicular
      const cPulse=0.5+0.5*Math.sin(frame*0.2);
      // Wide soft chain glow bloom
      ctx.globalAlpha=p*0.12;
      ctx.strokeStyle='#666666'; ctx.lineWidth=20;
      ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(c.x1,c.y1); ctx.lineTo(c.x2,c.y2); ctx.stroke();
      // Chain glow
      ctx.globalAlpha=p*0.35;
      ctx.strokeStyle='#aaaaaa'; ctx.lineWidth=9;
      ctx.beginPath(); ctx.moveTo(c.x1,c.y1); ctx.lineTo(c.x2,c.y2); ctx.stroke();
      // Draw chain links with metallic shading
      const linkCount=Math.floor(len/14);
      for(let li=0;li<=linkCount;li++){
        const t2=li/Math.max(1,linkCount);
        const lx=c.x1+dx*t2, ly=c.y1+dy*t2;
        const linkShine=0.7+0.3*Math.sin(frame*0.15+li*0.9);
        // Link shadow
        ctx.globalAlpha=p*0.3;
        ctx.strokeStyle='#444444'; ctx.lineWidth=4;
        ctx.beginPath(); ctx.ellipse(lx+1,ly+1,7,3.5,Math.atan2(dy,dx),0,Math.PI*2); ctx.stroke();
        // Link body
        ctx.globalAlpha=p*(0.7+0.3*(li%2));
        const lv=Math.round(180+40*linkShine);
        ctx.strokeStyle=li%2===0?('rgb('+lv+','+lv+','+lv+')'):'#888888'; ctx.lineWidth=2.5;
        ctx.beginPath(); ctx.ellipse(lx,ly,6,3,Math.atan2(dy,dx),0,Math.PI*2); ctx.stroke();
        // Link highlight
        ctx.globalAlpha=p*0.4*linkShine;
        ctx.strokeStyle='#ffffff'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.ellipse(lx-0.5,ly-0.5,5,2,Math.atan2(dy,dx),0,Math.PI); ctx.stroke();
      }
      // Spark particles along chain
      if(frame%4===0&&len>30){
        const st=Math.random();
        parts.length<400&&parts.push({x:c.x1+dx*st+nx*4,y:c.y1+dy*st-nx*4,vx:(Math.random()-0.5)*2,vy:(Math.random()-0.5)*2,r:1+Math.random(),color:Math.random()<0.5?'#ffffff':'#cccccc',life:15,max:15});
      }
      ctx.lineCap='butt';
      // Blade tip at target with glow
      const tipAngle=Math.atan2(dy,dx);
      ctx.save(); ctx.translate(c.x2,c.y2); ctx.rotate(tipAngle);
      ctx.globalAlpha=p*0.35;
      ctx.fillStyle='#aaaaff';
      ctx.beginPath(); ctx.moveTo(18,0); ctx.lineTo(-6,10); ctx.lineTo(-6,-10); ctx.closePath(); ctx.fill();
      ctx.globalAlpha=p;
      ctx.fillStyle='#ffffff';
      ctx.beginPath(); ctx.moveTo(14,0); ctx.lineTo(-4,6); ctx.lineTo(-4,-6); ctx.closePath(); ctx.fill();
      ctx.fillStyle='#ddeeff';
      ctx.beginPath(); ctx.moveTo(14,0); ctx.lineTo(4,3); ctx.lineTo(4,-3); ctx.closePath(); ctx.fill();
      ctx.globalAlpha=p*cPulse;
      ctx.fillStyle='#ffffff';
      ctx.beginPath(); ctx.arc(14,0,2,0,Math.PI*2); ctx.fill();
      ctx.restore();
    } else if(c.type==='blue_pull'){
      const bpPulse=0.5+0.5*Math.sin(frame*0.3);
      const bpPulse2=0.5+0.5*Math.cos(frame*0.18+0.5);
      const bpDx=c.x2-c.x1, bpDy=c.y2-c.y1;
      const bpLen=Math.hypot(bpDx,bpDy)||1;
      // Ultra-wide soft blue bloom
      ctx.globalAlpha=p*0.08;
      ctx.strokeStyle='#002266'; ctx.lineWidth=30;
      ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(c.x1,c.y1); ctx.lineTo(c.x2,c.y2); ctx.stroke();
      // Blue pull outer glow
      ctx.globalAlpha=p*0.25;
      ctx.strokeStyle='#0044aa'; ctx.lineWidth=14;
      ctx.beginPath(); ctx.moveTo(c.x1,c.y1); ctx.lineTo(c.x2,c.y2); ctx.stroke();
      // Main tether
      ctx.globalAlpha=p*0.4;
      ctx.strokeStyle='#0066ff'; ctx.lineWidth=8;
      ctx.beginPath(); ctx.moveTo(c.x1,c.y1); ctx.lineTo(c.x2,c.y2); ctx.stroke();
      // Bright inner
      ctx.globalAlpha=p*0.7;
      ctx.strokeStyle='#44aaff'; ctx.lineWidth=3;
      ctx.beginPath(); ctx.moveTo(c.x1,c.y1); ctx.lineTo(c.x2,c.y2); ctx.stroke();
      // White-hot core
      ctx.globalAlpha=p*0.35*bpPulse;
      ctx.strokeStyle='#aaddff'; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(c.x1,c.y1); ctx.lineTo(c.x2,c.y2); ctx.stroke();
      // Dual flowing dash layers
      ctx.globalAlpha=p*0.7;
      ctx.strokeStyle='#44aaff'; ctx.lineWidth=2;
      ctx.setLineDash([8,6]);
      ctx.lineDashOffset=-frame*3;
      ctx.beginPath(); ctx.moveTo(c.x1,c.y1); ctx.lineTo(c.x2,c.y2); ctx.stroke();
      ctx.globalAlpha=p*0.4;
      ctx.strokeStyle='#88ccff'; ctx.lineWidth=1;
      ctx.setLineDash([4,12]);
      ctx.lineDashOffset=-frame*5+7;
      ctx.beginPath(); ctx.moveTo(c.x1,c.y1); ctx.lineTo(c.x2,c.y2); ctx.stroke();
      ctx.setLineDash([]); ctx.lineDashOffset=0;
      // Flowing energy orbs along tether
      for(let fo=0;fo<4;fo++){
        const ft=((frame*0.03+fo*0.25)%1);
        const fox=c.x1+bpDx*ft, foy=c.y1+bpDy*ft;
        ctx.globalAlpha=p*0.5*(1-Math.abs(ft-0.5)*2);
        ctx.fillStyle='#66ccff';
        ctx.beginPath(); ctx.arc(fox,foy,3+bpPulse2,0,Math.PI*2); ctx.fill();
        ctx.globalAlpha=p*0.3;
        ctx.fillStyle='#ffffff';
        ctx.beginPath(); ctx.arc(fox,foy,1.5,0,Math.PI*2); ctx.fill();
      }
      // Pull vortex at target
      ctx.globalAlpha=p*0.2*bpPulse;
      ctx.strokeStyle='#44aaff'; ctx.lineWidth=1.5;
      for(let vi=0;vi<3;vi++){
        const va=frame*0.1+vi*Math.PI*2/3, vr=8+vi*5;
        ctx.beginPath(); ctx.arc(c.x2,c.y2,vr,va,va+1.2); ctx.stroke();
      }
      // Particles being pulled
      if(frame%3===0){
        const pa=Math.random()*Math.PI*2, pd=15+Math.random()*10;
        parts.length<400&&parts.push({x:c.x2+Math.cos(pa)*pd,y:c.y2+Math.sin(pa)*pd,vx:(c.x1-c.x2)/bpLen*2,vy:(c.y1-c.y2)/bpLen*2,r:1+Math.random(),color:Math.random()<0.5?'#44aaff':'#88ddff',life:18,max:18});
      }
      ctx.lineCap='butt';
    }
    ctx.globalAlpha=1;
  }

  // ── Explosions (Red/Ekko) ──
  for(const e of FX.explosions){
    const p=e.life/e.max;
    const ePulse=0.5+0.5*Math.sin(frame*0.5);
    // Ultra-wide ambient bloom
    ctx.globalAlpha=p*0.06;
    ctx.fillStyle=e.color;
    ctx.beginPath(); ctx.arc(e.x,e.y,e.r*1.5,0,Math.PI*2); ctx.fill();
    // Wide outer shockwave bloom
    ctx.globalAlpha=p*0.10;
    ctx.strokeStyle=e.color; ctx.lineWidth=35;
    ctx.beginPath(); ctx.arc(e.x,e.y,e.r,0,Math.PI*2); ctx.stroke();
    // Outer shockwave
    ctx.globalAlpha=p*0.25;
    ctx.strokeStyle=e.color; ctx.lineWidth=18;
    ctx.beginPath(); ctx.arc(e.x,e.y,e.r,0,Math.PI*2); ctx.stroke();
    // Secondary shockwave ring
    ctx.globalAlpha=p*0.18;
    ctx.lineWidth=8;
    ctx.beginPath(); ctx.arc(e.x,e.y,e.r*0.9,0,Math.PI*2); ctx.stroke();
    // Mid ring
    ctx.globalAlpha=p*0.55;
    ctx.lineWidth=5;
    ctx.beginPath(); ctx.arc(e.x,e.y,e.r*0.75,0,Math.PI*2); ctx.stroke();
    // Inner bright ring
    ctx.globalAlpha=p*0.9;
    ctx.lineWidth=3;
    ctx.strokeStyle='#ffffff';
    ctx.beginPath(); ctx.arc(e.x,e.y,e.r*0.4,0,Math.PI*2); ctx.stroke();
    // White-hot core
    ctx.globalAlpha=p*0.7;
    ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.arc(e.x,e.y,e.r*0.2,0,Math.PI*2); ctx.stroke();
    // Fill with radial gradient
    const exGrad=ctx.createRadialGradient(e.x,e.y,0,e.x,e.y,e.r);
    exGrad.addColorStop(0,'rgba(255,255,255,'+0.18*p+')');
    exGrad.addColorStop(0.3,'rgba(255,200,100,'+0.10*p+')');
    exGrad.addColorStop(1,'rgba(0,0,0,0)');
    ctx.globalAlpha=1;
    ctx.fillStyle=exGrad;
    ctx.beginPath(); ctx.arc(e.x,e.y,e.r,0,Math.PI*2); ctx.fill();
    // Original fill
    ctx.globalAlpha=p*0.12;
    ctx.fillStyle=e.color;
    ctx.beginPath(); ctx.arc(e.x,e.y,e.r,0,Math.PI*2); ctx.fill();
    // Radiating energy spokes
    ctx.globalAlpha=p*0.3*ePulse;
    ctx.strokeStyle=e.color; ctx.lineWidth=1.5;
    for(let si=0;si<8;si++){
      const sa=si*Math.PI/4+frame*0.02;
      ctx.beginPath();
      ctx.moveTo(e.x+Math.cos(sa)*e.r*0.2,e.y+Math.sin(sa)*e.r*0.2);
      ctx.lineTo(e.x+Math.cos(sa)*e.r*0.95,e.y+Math.sin(sa)*e.r*0.95);
      ctx.stroke();
    }
    // Debris particles on explosion
    if(p>0.7&&frame%4===0){
      for(let di=0;di<3;di++){
        const da=Math.random()*Math.PI*2, dspd=3+Math.random()*4;
        parts.length<400&&parts.push({x:e.x,y:e.y,vx:Math.cos(da)*dspd,vy:Math.sin(da)*dspd,r:1.5+Math.random()*2,color:Math.random()<0.3?'#ffffff':e.color,life:25,max:25});
      }
    }
    ctx.globalAlpha=1;
  }

  // ── Portals ──
  for(const po of FX.portals){
    const p=po.life/60;
    const pulse=0.5+0.5*Math.sin(frame*0.25);
    const pulse2=0.5+0.5*Math.cos(frame*0.17+0.6);
    const pulse3=0.5+0.5*Math.sin(frame*0.41);
    const dir=po.type==='in'?1:-1;
    ctx.save();
    ctx.translate(po.x,po.y);
    // Ultra-wide ambient glow
    ctx.globalAlpha=p*0.06;
    const ambGrad=ctx.createRadialGradient(0,0,10,0,0,75);
    ambGrad.addColorStop(0,po.color);
    ambGrad.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=ambGrad;
    ctx.beginPath(); ctx.arc(0,0,75,0,Math.PI*2); ctx.fill();
    // Outer glow halo bloom layers
    ctx.globalAlpha=p*0.12;
    ctx.fillStyle=po.color;
    ctx.beginPath(); ctx.arc(0,0,60,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=p*0.22;
    ctx.beginPath(); ctx.arc(0,0,48,0,Math.PI*2); ctx.fill();
    // Distortion ring
    ctx.globalAlpha=p*0.15*pulse2;
    ctx.strokeStyle=po.color; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(0,0,42+4*pulse3,0,Math.PI*2); ctx.stroke();
    // Rotating outer segments with glow
    ctx.save();
    ctx.rotate(frame*0.06*dir);
    ctx.globalAlpha=p*0.2;
    ctx.strokeStyle=po.color; ctx.lineWidth=10;
    ctx.setLineDash([12,8]);
    ctx.beginPath(); ctx.arc(0,0,34,0,Math.PI*2); ctx.stroke();
    ctx.globalAlpha=p*(0.7+0.25*pulse);
    ctx.lineWidth=4;
    ctx.beginPath(); ctx.arc(0,0,34,0,Math.PI*2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    // Counter-rotating inner ring with bloom
    ctx.save();
    ctx.rotate(-frame*0.12*dir+frame*0.06*dir);
    ctx.globalAlpha=p*0.3;
    ctx.strokeStyle=po.color; ctx.lineWidth=6;
    ctx.beginPath(); ctx.arc(0,0,22,0,Math.PI*2); ctx.stroke();
    ctx.globalAlpha=p*0.9;
    ctx.strokeStyle='#ffffff'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(0,0,22,0,Math.PI*2); ctx.stroke();
    ctx.restore();
    // Spiral arms (6 instead of 3) with varying width
    ctx.save();
    ctx.rotate(frame*0.08*dir);
    for(let si=0;si<6;si++){
      const sa=si*Math.PI*2/6;
      ctx.globalAlpha=p*0.3;
      ctx.strokeStyle=po.color; ctx.lineWidth=5;
      ctx.lineCap='round';
      ctx.beginPath();
      ctx.moveTo(Math.cos(sa)*24,Math.sin(sa)*24);
      ctx.quadraticCurveTo(Math.cos(sa+0.7)*16,Math.sin(sa+0.7)*16,0,0);
      ctx.stroke();
      ctx.globalAlpha=p*0.7;
      ctx.strokeStyle=si%2===0?po.color:'#ffffff'; ctx.lineWidth=2+pulse*1.5;
      ctx.beginPath();
      ctx.moveTo(Math.cos(sa)*22,Math.sin(sa)*22);
      ctx.quadraticCurveTo(Math.cos(sa+0.9)*14,Math.sin(sa+0.9)*14,0,0);
      ctx.stroke();
    }
    ctx.lineCap='butt';
    ctx.restore();
    // Black void center
    ctx.globalAlpha=p;
    ctx.fillStyle='#000000';
    ctx.beginPath(); ctx.arc(0,0,14,0,Math.PI*2); ctx.fill();
    // Dark ring around void
    ctx.globalAlpha=p*0.7;
    ctx.strokeStyle='#110022'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.arc(0,0,14,0,Math.PI*2); ctx.stroke();
    // Bright pulsing core with gradient
    ctx.globalAlpha=p*(0.5+0.4*pulse);
    const coreGrad=ctx.createRadialGradient(0,0,0,0,0,7);
    coreGrad.addColorStop(0,'#ffffff');
    coreGrad.addColorStop(0.5,po.color);
    coreGrad.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=coreGrad;
    ctx.beginPath(); ctx.arc(0,0,7,0,Math.PI*2); ctx.fill();
    // Portal particles
    if(frame%3===0){
      const pa2=Math.random()*Math.PI*2, pd2=20+Math.random()*20;
      const pvx=dir*Math.cos(pa2+Math.PI/2)*1.5, pvy=dir*Math.sin(pa2+Math.PI/2)*1.5;
      parts.length<400&&parts.push({x:po.x+Math.cos(pa2)*pd2,y:po.y+Math.sin(pa2)*pd2,vx:pvx-Math.cos(pa2)*0.8,vy:pvy-Math.sin(pa2)*0.8,r:1.5+Math.random(),color:Math.random()<0.4?'#ffffff':po.color,life:22,max:22});
    }
    ctx.restore();
    ctx.globalAlpha=1;
  }

  // ── Ekko ghost afterimages ──
  for(const eg of FX.ekkoGhosts){
    const p=eg.life/eg.max;
    const egPulse=0.5+0.5*Math.sin(frame*0.3+eg.x*0.01);
    const egPulse2=0.5+0.5*Math.cos(frame*0.22+eg.y*0.01);
    // Ultra-wide ambient glow
    ctx.globalAlpha=p*0.06;
    ctx.fillStyle='#00ff88';
    ctx.beginPath(); ctx.arc(eg.x,eg.y,C.BALL_R*2.8,0,Math.PI*2); ctx.fill();
    // Outer bloom glow
    ctx.globalAlpha=p*0.12;
    ctx.fillStyle='#00cc66';
    ctx.beginPath(); ctx.arc(eg.x,eg.y,C.BALL_R*2.2,0,Math.PI*2); ctx.fill();
    // Ghost glow gradient
    ctx.globalAlpha=p*0.25;
    const egGrad=ctx.createRadialGradient(eg.x,eg.y,0,eg.x,eg.y,C.BALL_R*1.6);
    egGrad.addColorStop(0,'#00ff88');
    egGrad.addColorStop(1,'rgba(0,255,136,0)');
    ctx.fillStyle=egGrad;
    ctx.beginPath(); ctx.arc(eg.x,eg.y,C.BALL_R*1.6,0,Math.PI*2); ctx.fill();
    // Ghost body with depth
    ctx.globalAlpha=p*0.35;
    ctx.fillStyle=eg.color;
    ctx.beginPath(); ctx.arc(eg.x,eg.y,C.BALL_R*1.1,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=p*0.55;
    ctx.fillStyle=eg.color;
    ctx.beginPath(); ctx.arc(eg.x,eg.y,C.BALL_R,0,Math.PI*2); ctx.fill();
    // Ghost outer ring bloom
    ctx.globalAlpha=p*0.25;
    ctx.strokeStyle='#00ff88'; ctx.lineWidth=6;
    ctx.beginPath(); ctx.arc(eg.x,eg.y,C.BALL_R,0,Math.PI*2); ctx.stroke();
    // Ghost ring core
    ctx.globalAlpha=p*0.7;
    ctx.strokeStyle='#00ff88'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(eg.x,eg.y,C.BALL_R,0,Math.PI*2); ctx.stroke();
    // Inner white highlight
    ctx.globalAlpha=p*0.3*egPulse;
    ctx.strokeStyle='#aaffcc'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.arc(eg.x,eg.y,C.BALL_R*0.85,0,Math.PI*2); ctx.stroke();
    // Temporal distortion arcs
    ctx.globalAlpha=p*0.35*egPulse2;
    ctx.strokeStyle='#00ff88'; ctx.lineWidth=1;
    for(let ta=0;ta<3;ta++){
      const taa=frame*0.05+ta*Math.PI*2/3+eg.x*0.02;
      ctx.beginPath(); ctx.arc(eg.x,eg.y,C.BALL_R*1.3+ta*2,taa,taa+0.8); ctx.stroke();
    }
    // Ghost trail particles
    if(frame%5===0&&p>0.3){
      parts.length<400&&parts.push({x:eg.x+(Math.random()-0.5)*C.BALL_R,y:eg.y+(Math.random()-0.5)*C.BALL_R,vx:(Math.random()-0.5)*1,vy:-0.5-Math.random()*0.8,r:1.5+Math.random(),color:Math.random()<0.5?'#00ff88':'#88ffcc',life:18,max:18});
    }
    ctx.globalAlpha=1;
  }

  // ── Sandevistan cyan trail on owner ──
  if(FX.sandevistanFrames>0){
    const owner=_G.balls.find(b=>b.id===FX.sandevistanOwner&&b.alive);
    if(owner){
      const tlen=owner.trail.length;
      for(let ti=0;ti<tlen;ti++){
        const tp=(ti+1)/(tlen+1);
        const tx=owner.trail[ti].x, ty=owner.trail[ti].y;
        const trailPulse=0.7+0.3*Math.sin(frame*0.2+ti*0.5);
        // Wide outer bloom on each afterimage
        ctx.globalAlpha=tp*0.15;
        const trGrad=ctx.createRadialGradient(tx,ty,0,tx,ty,owner.r*tp*1.4);
        trGrad.addColorStop(0,'#00ffff');
        trGrad.addColorStop(1,'rgba(0,255,255,0)');
        ctx.fillStyle=trGrad;
        ctx.beginPath(); ctx.arc(tx,ty,owner.r*tp*1.4,0,Math.PI*2); ctx.fill();
        // Cyan ghost with shrinking radius
        ctx.globalAlpha=tp*0.6;
        ctx.fillStyle='#00ffff';
        ctx.beginPath(); ctx.arc(tx,ty,owner.r*tp*0.95,0,Math.PI*2); ctx.fill();
        // Cyan ring outline on afterimage
        ctx.globalAlpha=tp*0.35*trailPulse;
        ctx.strokeStyle='#44ffff'; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.arc(tx,ty,owner.r*tp*0.95,0,Math.PI*2); ctx.stroke();
        // White afterburn core on recent trail
        if(ti>tlen*0.6){
          ctx.globalAlpha=tp*0.35;
          ctx.fillStyle='#ffffff';
          ctx.beginPath(); ctx.arc(tx,ty,owner.r*tp*0.45,0,Math.PI*2); ctx.fill();
          // Hot center spark
          ctx.globalAlpha=tp*0.5*trailPulse;
          ctx.fillStyle='#aaffff';
          ctx.beginPath(); ctx.arc(tx,ty,owner.r*tp*0.2,0,Math.PI*2); ctx.fill();
        }
        // Connecting energy wisps between trail points
        if(ti>0){
          const px2=owner.trail[ti-1].x, py2=owner.trail[ti-1].y;
          ctx.globalAlpha=tp*0.15;
          ctx.strokeStyle='#00cccc'; ctx.lineWidth=1;
          ctx.beginPath(); ctx.moveTo(px2,py2); ctx.lineTo(tx,ty); ctx.stroke();
        }
      }
      // Speed lines emanating from owner (doubled, with bloom)
      const sf=FX.sandevistanFrames/240;
      const spd=Math.hypot(owner.vx,owner.vy);
      if(spd>3){
        const sAngle=Math.atan2(owner.vy,owner.vx)+Math.PI;
        for(let sl=0;sl<10;sl++){
          const spread=(sl-4.5)*0.08;
          const slen=25+sl*12+10*Math.sin(frame*0.15+sl);
          const slAlpha=(0.15+0.15*Math.sin(frame*0.2+sl*0.8))*sf;
          // Speed line glow
          ctx.globalAlpha=slAlpha*0.5;
          ctx.strokeStyle='#005566'; ctx.lineWidth=4;
          ctx.beginPath();
          ctx.moveTo(owner.x,owner.y);
          ctx.lineTo(owner.x+Math.cos(sAngle+spread)*slen, owner.y+Math.sin(sAngle+spread)*slen);
          ctx.stroke();
          // Speed line core
          ctx.globalAlpha=slAlpha;
          ctx.strokeStyle='#00ffff'; ctx.lineWidth=1.5;
          ctx.beginPath();
          ctx.moveTo(owner.x,owner.y);
          ctx.lineTo(owner.x+Math.cos(sAngle+spread)*slen, owner.y+Math.sin(sAngle+spread)*slen);
          ctx.stroke();
        }
        // Motion blur particles behind owner
        if(frame%4===0){
          parts.length<400&&parts.push({x:owner.x+Math.cos(sAngle)*8,y:owner.y+Math.sin(sAngle)*8,vx:Math.cos(sAngle)*3+Math.random()-0.5,vy:Math.sin(sAngle)*3+Math.random()-0.5,r:2+Math.random()*2,color:Math.random()<0.3?'#aaffff':'#00ffff',life:18,max:18});
        }
      }
      ctx.globalAlpha=1;
    }
  }

  // ── Rewind purple ghost trail ──
  if(FX.rewindGhosts.length>0 && frame%12===0){
    // Show faint ghost of oldest snapshot position
  }

  // ── Hellfire aura ──
  if(FX.hellfireZone){
    const hf=FX.hellfireZone, prog=hf.life/hf.max;
    const effectR=hf.r*hf.intensity;
    const pulse=0.5+0.5*Math.sin(frame*0.14);
    const hfP2=0.5+0.5*Math.sin(frame*0.09+1.2), hfP3=0.5+0.5*Math.cos(frame*0.18), hfBr=0.85+0.15*Math.sin(frame*0.06);
    // L1: Wide soft bloom heat haze
    const hfBlR=effectR*1.6*hfBr;
    const hfBl=ctx.createRadialGradient(hf.x,hf.y,0,hf.x,hf.y,hfBlR);
    hfBl.addColorStop(0,`rgba(255,120,20,${prog*0.12*hfP2})`); hfBl.addColorStop(0.3,`rgba(255,60,0,${prog*0.09})`);
    hfBl.addColorStop(0.6,`rgba(180,20,0,${prog*0.05})`); hfBl.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=hfBl; ctx.fillRect(hf.x-hfBlR,hf.y-hfBlR,hfBlR*2,hfBlR*2);
    // L2: Main fire gradient with ember core
    const fireGrad=ctx.createRadialGradient(hf.x,hf.y,0,hf.x,hf.y,effectR);
    fireGrad.addColorStop(0,`rgba(255,255,180,${prog*0.5*pulse})`); fireGrad.addColorStop(0.15,`rgba(255,200,50,${prog*0.4})`);
    fireGrad.addColorStop(0.35,`rgba(255,120,0,${prog*0.3})`); fireGrad.addColorStop(0.6,`rgba(255,60,0,${prog*0.18})`);
    fireGrad.addColorStop(0.85,`rgba(140,20,0,${prog*0.08})`); fireGrad.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=fireGrad; ctx.fillRect(hf.x-effectR,hf.y-effectR,effectR*2,effectR*2);
    // L3: Spinning fire rings multi-layered
    ctx.save(); ctx.translate(hf.x,hf.y); ctx.rotate(frame*0.05);
    for(let ri=0;ri<5;ri++){
      ctx.globalAlpha=prog*(0.25+0.2*pulse)*(1-ri*0.12);
      ctx.strokeStyle=['#ffee44','#ff8800','#ff5500','#ff3300','#cc1100'][ri]; ctx.lineWidth=(4+ri*2.5)*hfBr;
      ctx.beginPath(); ctx.arc(0,0,effectR*(0.3+ri*0.15),ri*0.3,Math.PI*1.6+ri*0.2); ctx.stroke();
    }
    ctx.restore();
    // L4: Counter-rotating inner fire arcs
    ctx.save(); ctx.translate(hf.x,hf.y); ctx.rotate(-frame*0.08);
    for(let ri=0;ri<3;ri++){
      ctx.globalAlpha=prog*(0.2+0.15*hfP3); ctx.strokeStyle=['#ffcc00','#ff6600','#ff2200'][ri]; ctx.lineWidth=(2+ri*1.5)*hfBr;
      ctx.beginPath(); ctx.arc(0,0,effectR*(0.25+ri*0.12),ri*0.5,Math.PI*1.2+ri*0.3); ctx.stroke();
    }
    ctx.restore();
    // L5: Fire ember particles tripled
    if(frame%4===0){ for(let pi=0;pi<3;pi++){
      const ang=Math.random()*Math.PI*2, dist=effectR*(0.3+Math.random()*0.7);
      parts.length<400&&parts.push({x:hf.x+Math.cos(ang)*dist,y:hf.y+Math.sin(ang)*dist,vx:Math.cos(ang)*1.5+(Math.random()-0.5)*2,vy:-2-Math.random()*3,r:2+Math.random()*3,color:['#ffcc00','#ff8800','#ff4400','#ff2200'][pi%4],life:20+Math.random()*15|0,max:35});
    }}
    // L6: Bright inner core flicker
    const hfCR=effectR*0.15*hfP3;
    const hfCG=ctx.createRadialGradient(hf.x,hf.y,0,hf.x,hf.y,hfCR+10);
    hfCG.addColorStop(0,`rgba(255,255,255,${prog*0.4*pulse})`); hfCG.addColorStop(0.5,`rgba(255,220,100,${prog*0.2})`); hfCG.addColorStop(1,'rgba(255,100,0,0)');
    ctx.fillStyle=hfCG; ctx.fillRect(hf.x-hfCR-10,hf.y-hfCR-10,(hfCR+10)*2,(hfCR+10)*2);
    // L7: Energy crackle lines radiating outward
    ctx.save(); ctx.translate(hf.x,hf.y);
    ctx.globalAlpha=prog*(0.3+0.25*pulse); ctx.strokeStyle='#ffdd44'; ctx.lineWidth=1.5*hfBr;
    for(let ci=0;ci<8;ci++){
      const ca=ci*Math.PI/4+frame*0.03, innerR=effectR*0.4, outerR=effectR*(0.7+0.15*Math.sin(frame*0.2+ci));
      const midA=ca+0.1*Math.sin(frame*0.15+ci*2);
      ctx.beginPath(); ctx.moveTo(Math.cos(ca)*innerR,Math.sin(ca)*innerR);
      ctx.quadraticCurveTo(Math.cos(midA)*(innerR+outerR)*0.5+Math.sin(frame*0.1+ci)*8,Math.sin(midA)*(innerR+outerR)*0.5+Math.cos(frame*0.12+ci)*8,Math.cos(ca)*outerR,Math.sin(ca)*outerR);
      ctx.stroke();
    }
    ctx.restore();
    // Intensity label
    if(hf.intensity>1.5){
      ctx.globalAlpha=prog*(0.7+0.3*pulse);
      ctx.fillStyle='#ffdd00'; ctx.font='bold 18px Rajdhani, Courier New';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.shadowColor='#ff6600'; ctx.shadowBlur=12;
      ctx.fillText(`\u00d7${hf.intensity.toFixed(1)}`,hf.x,hf.y-hf.r-20);
      ctx.shadowBlur=0;
    }
    ctx.globalAlpha=1;
  }

  // ── Spatial cubes ──
  for(const cb of FX.spatialCubes){
    const prog=cb.life/cb.max, target=_G.balls.find(b=>b.id===cb.targetId&&b.alive);
    if(!target) continue;
    const s=cb.size;
    const cbP=0.5+0.5*Math.sin(frame*0.12+cb.angle), cbP2=0.5+0.5*Math.cos(frame*0.08), cbBr=0.9+0.1*Math.sin(frame*0.06);
    // L1: Outer spatial distortion bloom
    const spGrad=ctx.createRadialGradient(target.x,target.y,0,target.x,target.y,s*1.2);
    spGrad.addColorStop(0,`rgba(120,40,220,${prog*0.15*cbP})`); spGrad.addColorStop(0.5,`rgba(80,0,180,${prog*0.08})`); spGrad.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=spGrad; ctx.beginPath(); ctx.arc(target.x,target.y,s*1.2,0,Math.PI*2); ctx.fill();
    ctx.save(); ctx.translate(target.x,target.y); ctx.rotate(cb.angle);
    // L2: Outer glow cube soft wide border
    ctx.globalAlpha=prog*0.3*cbP; ctx.strokeStyle='#7733cc'; ctx.lineWidth=8*cbBr;
    ctx.strokeRect(-s/2,-s/2,s,s);
    // L3: Main cube wireframe sharp
    ctx.globalAlpha=prog*0.85; ctx.strokeStyle='#aa44ff'; ctx.lineWidth=2.5;
    ctx.strokeRect(-s/2,-s/2,s,s);
    // L4: Inner rotating square with afterimage trail
    for(let ghost=2;ghost>=0;ghost--){
      ctx.save(); ctx.rotate(frame*0.04-ghost*0.08);
      ctx.globalAlpha=prog*(0.5-ghost*0.15); ctx.strokeStyle=ghost===0?'#dd88ff':'#9944cc';
      ctx.lineWidth=(1.5-ghost*0.3)*cbBr; const gs=s*0.6;
      ctx.strokeRect(-gs/2,-gs/2,gs,gs); ctx.restore();
    }
    // L5: Third nested counter-rotating square
    ctx.save(); ctx.rotate(-frame*0.06);
    ctx.globalAlpha=prog*0.3*cbP2; ctx.strokeStyle='#eeccff'; ctx.lineWidth=1;
    const s3=s*0.35; ctx.strokeRect(-s3/2,-s3/2,s3,s3); ctx.restore();
    // L6: Corner energy nodes pulsing with glow
    [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(([sx,sy],ci)=>{
      const nP=0.6+0.4*Math.sin(frame*0.15+ci*1.5);
      const nG=ctx.createRadialGradient(sx*s/2,sy*s/2,0,sx*s/2,sy*s/2,12);
      nG.addColorStop(0,`rgba(200,100,255,${prog*0.6*nP})`); nG.addColorStop(1,'rgba(200,100,255,0)');
      ctx.fillStyle=nG; ctx.globalAlpha=prog; ctx.beginPath(); ctx.arc(sx*s/2,sy*s/2,12,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#eeddff'; ctx.globalAlpha=prog*nP;
      ctx.beginPath(); ctx.arc(sx*s/2,sy*s/2,4+2*nP,0,Math.PI*2); ctx.fill();
    });
    // L7: Diagonal energy lines + void gradient fill
    ctx.globalAlpha=prog*0.25*cbP; ctx.strokeStyle='#bb66ff'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(-s/2,-s/2); ctx.lineTo(s/2,s/2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s/2,-s/2); ctx.lineTo(-s/2,s/2); ctx.stroke();
    const vG=ctx.createRadialGradient(0,0,0,0,0,s*0.5);
    vG.addColorStop(0,`rgba(60,0,120,${prog*0.2})`); vG.addColorStop(1,`rgba(20,0,50,${prog*0.08})`);
    ctx.globalAlpha=prog*0.3; ctx.fillStyle=vG; ctx.fillRect(-s/2,-s/2,s,s);
    // Spatial rift particles
    if(frame%3===0){ const ang=Math.random()*Math.PI*2;
      parts.length<400&&parts.push({x:target.x+(Math.random()-0.5)*s,y:target.y+(Math.random()-0.5)*s,vx:Math.cos(ang)*2,vy:Math.sin(ang)*2,r:2+Math.random()*2,color:['#cc66ff','#9944dd','#eeccff'][Math.random()*3|0],life:18,max:18});
    }
    ctx.restore(); ctx.globalAlpha=1;
  }

  // ── Zephyr wind blade ──
  if(FX.zephyrBlade){
    const zb=FX.zephyrBlade, prog=zb.life/zb.max;
    const wP=0.5+0.5*Math.sin(frame*0.2), wP2=0.5+0.5*Math.cos(frame*0.15+0.8), wBr=0.9+0.1*Math.sin(frame*0.08);
    const bL=50*prog+20, bW=zb.width/2;
    ctx.save(); ctx.translate(zb.x,zb.y); ctx.rotate(zb.angle);
    // L1: Wide atmospheric wind bloom
    const wBl=ctx.createRadialGradient(0,0,0,0,0,bL*1.5);
    wBl.addColorStop(0,`rgba(180,220,255,${prog*0.1*wP})`); wBl.addColorStop(0.5,`rgba(100,180,255,${prog*0.05})`); wBl.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=wBl; ctx.beginPath(); ctx.arc(0,0,bL*1.5,0,Math.PI*2); ctx.fill();
    // L2: Afterimage trail 3 ghost blades
    for(let ghost=2;ghost>=0;ghost--){
      ctx.globalAlpha=prog*(0.15-ghost*0.04); ctx.fillStyle='rgba(150,200,255,0.3)';
      ctx.beginPath(); ctx.ellipse(-ghost*8,0,bL+ghost*5,bW+ghost*3,0,0,Math.PI*2); ctx.fill();
    }
    // L3: Outer glow blade
    ctx.globalAlpha=prog*0.35*wBr; ctx.fillStyle='rgba(120,190,255,0.5)';
    ctx.beginPath(); ctx.ellipse(0,0,bL+8,bW+6,0,0,Math.PI*2); ctx.fill();
    // L4: Main wind blade gradient fill
    const blGr=ctx.createLinearGradient(-bL,0,bL,0);
    blGr.addColorStop(0,`rgba(200,240,255,${prog*0.7})`); blGr.addColorStop(0.3,`rgba(140,210,255,${prog*0.9})`);
    blGr.addColorStop(0.7,`rgba(180,230,255,${prog*0.85})`); blGr.addColorStop(1,`rgba(220,245,255,${prog*0.6})`);
    ctx.globalAlpha=prog*0.9; ctx.fillStyle=blGr;
    ctx.beginPath(); ctx.ellipse(0,0,bL,bW,0,0,Math.PI*2); ctx.fill();
    // L5: Sharp white core inner blade
    ctx.globalAlpha=prog*(0.6+0.3*wP); ctx.fillStyle='rgba(255,255,255,0.8)';
    ctx.beginPath(); ctx.ellipse(0,0,bL*0.7,bW*0.4,0,0,Math.PI*2); ctx.fill();
    // L6: Edge shimmer stroke
    ctx.globalAlpha=prog*(0.7+0.2*wP2); ctx.strokeStyle='#ffffff'; ctx.lineWidth=(2+wP*1.5)*wBr;
    ctx.beginPath(); ctx.ellipse(0,0,bL,bW,0,0,Math.PI*2); ctx.stroke();
    // L7: Wind streak lines inside blade
    ctx.globalAlpha=prog*0.4; ctx.strokeStyle='rgba(255,255,255,0.6)'; ctx.lineWidth=1;
    for(let wi=0;wi<5;wi++){ const wy=(wi-2)*bW*0.3;
      ctx.beginPath(); ctx.moveTo(-bL*0.8,wy); ctx.quadraticCurveTo(0,wy+Math.sin(frame*0.2+wi)*4,bL*0.8,wy); ctx.stroke();
    }
    // Star sparkles tripled with cross sparkles
    for(let si=0;si<12;si++){
      const sx=(Math.random()-0.5)*bL*1.6, sy=(Math.random()-0.5)*bW*1.8;
      const sA=prog*(0.4+0.4*Math.random()), sR=1+Math.random()*3;
      ctx.fillStyle='#ffffff'; ctx.globalAlpha=sA;
      ctx.beginPath(); ctx.arc(sx,sy,sR,0,Math.PI*2); ctx.fill();
      if(sR>2){ ctx.strokeStyle='#ffffff'; ctx.lineWidth=0.5; ctx.globalAlpha=sA*0.6;
        ctx.beginPath(); ctx.moveTo(sx-sR*2,sy); ctx.lineTo(sx+sR*2,sy); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(sx,sy-sR*2); ctx.lineTo(sx,sy+sR*2); ctx.stroke();
      }
    }
    ctx.restore();
    // Orbiting wind stars doubled with glow
    ctx.save(); ctx.translate(zb.x,zb.y); ctx.rotate(frame*0.12);
    for(let oi=0;oi<10;oi++){
      const oa=oi*Math.PI*2/10, oR=30+10*Math.sin(frame*0.08+oi), sP=0.5+0.5*Math.sin(frame*0.18+oi*0.7);
      ctx.fillStyle=`rgba(180,220,255,${prog*0.3*sP})`; ctx.globalAlpha=prog*0.4;
      ctx.beginPath(); ctx.arc(Math.cos(oa)*oR,Math.sin(oa)*oR,6,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#ffffff'; ctx.globalAlpha=prog*(0.6+0.3*sP);
      ctx.beginPath(); ctx.arc(Math.cos(oa)*oR,Math.sin(oa)*oR,2+sP,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();
    // Wind trail particles
    if(frame%4===0){ const ang=zb.angle+((Math.random()-0.5)*0.5);
      parts.length<400&&parts.push({x:zb.x+(Math.random()-0.5)*30,y:zb.y+(Math.random()-0.5)*20,vx:Math.cos(ang)*4,vy:Math.sin(ang)*4,r:1.5+Math.random()*2,color:['#cceeff','#ffffff','#aaddff'][Math.random()*3|0],life:14,max:14});
    }
    ctx.globalAlpha=1;
  }

  // ── Black Asta anti-magic aura ──
  if(FX.blackAstaFrames>0){
    const owner=_G.balls.find(b=>b.id===FX.blackAstaOwner&&b.alive);
    if(owner){
      const prog=FX.blackAstaFrames/280, pulse=0.5+0.5*Math.sin(frame*0.2);
      const baP2=0.5+0.5*Math.cos(frame*0.13+0.5), baP3=0.5+0.5*Math.sin(frame*0.25+1.0), baBr=0.9+0.1*Math.sin(frame*0.07);
      const auraR=owner.r+50+10*Math.sin(frame*0.05);
      // L1: Wide darkness bloom screen-space shadow
      const dkBl=ctx.createRadialGradient(owner.x,owner.y,0,owner.x,owner.y,auraR*1.8);
      dkBl.addColorStop(0,`rgba(0,0,0,${prog*0.2*baP2})`); dkBl.addColorStop(0.4,`rgba(10,0,5,${prog*0.12})`);
      dkBl.addColorStop(0.7,`rgba(20,0,10,${prog*0.05})`); dkBl.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=dkBl; ctx.beginPath(); ctx.arc(owner.x,owner.y,auraR*1.8,0,Math.PI*2); ctx.fill();
      // L2: Main black void aura deep gradient
      const auraGrad=ctx.createRadialGradient(owner.x,owner.y,owner.r*0.5,owner.x,owner.y,auraR);
      auraGrad.addColorStop(0,'rgba(0,0,0,0.9)'); auraGrad.addColorStop(0.3,`rgba(15,0,5,${prog*0.7})`);
      auraGrad.addColorStop(0.6,`rgba(40,0,0,${prog*0.4})`); auraGrad.addColorStop(0.85,`rgba(30,0,10,${prog*0.15})`);
      auraGrad.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=auraGrad; ctx.beginPath(); ctx.arc(owner.x,owner.y,auraR,0,Math.PI*2); ctx.fill();
      // L3: Anti-magic crackling boundary ring
      ctx.save(); ctx.translate(owner.x,owner.y);
      ctx.globalAlpha=prog*(0.4+0.2*pulse); ctx.strokeStyle='#440000'; ctx.lineWidth=3*baBr;
      ctx.beginPath(); ctx.arc(0,0,auraR*0.85,0,Math.PI*2); ctx.stroke(); ctx.restore();
      // L4: Red crack lines jagged with energy crackle (10 lines)
      ctx.save(); ctx.translate(owner.x,owner.y); ctx.rotate(frame*0.06);
      for(let ci=0;ci<10;ci++){
        const ca=ci*Math.PI/5, crP=0.5+0.5*Math.sin(frame*0.2+ci*1.3);
        const midR=(owner.r+5+owner.r+40)*0.5, midA=ca+0.15*Math.sin(frame*0.12+ci);
        // Outer glow line
        ctx.globalAlpha=prog*(0.2+0.15*crP); ctx.strokeStyle='#880000'; ctx.lineWidth=5*baBr;
        ctx.beginPath(); ctx.moveTo(Math.cos(ca)*(owner.r+3),Math.sin(ca)*(owner.r+3));
        ctx.quadraticCurveTo(Math.cos(midA)*midR+Math.sin(frame*0.1+ci)*5,Math.sin(midA)*midR+Math.cos(frame*0.08+ci)*5,Math.cos(ca)*(owner.r+40*crP),Math.sin(ca)*(owner.r+40*crP));
        ctx.stroke();
        // Core crack line
        ctx.globalAlpha=prog*(0.6+0.3*crP); ctx.strokeStyle='#ff0000'; ctx.lineWidth=2*baBr;
        ctx.beginPath(); ctx.moveTo(Math.cos(ca)*(owner.r+3),Math.sin(ca)*(owner.r+3));
        ctx.quadraticCurveTo(Math.cos(midA)*midR+Math.sin(frame*0.1+ci)*5,Math.sin(midA)*midR+Math.cos(frame*0.08+ci)*5,Math.cos(ca)*(owner.r+40*crP),Math.sin(ca)*(owner.r+40*crP));
        ctx.stroke();
        // Bright tip
        ctx.globalAlpha=prog*0.7*crP; ctx.fillStyle='#ff4444';
        ctx.beginPath(); ctx.arc(Math.cos(ca)*(owner.r+40*crP),Math.sin(ca)*(owner.r+40*crP),2+crP*2,0,Math.PI*2); ctx.fill();
      }
      ctx.restore();
      // L5: Counter-rotating dark energy wisps
      ctx.save(); ctx.translate(owner.x,owner.y); ctx.rotate(-frame*0.04);
      ctx.globalAlpha=prog*0.3; ctx.strokeStyle='#330011'; ctx.lineWidth=2;
      for(let wi=0;wi<4;wi++){ const wa=wi*Math.PI/2;
        ctx.beginPath(); ctx.arc(0,0,owner.r+20+wi*5,wa,wa+Math.PI*0.6); ctx.stroke();
      }
      ctx.restore();
      // L6: Devil horns enhanced with glow
      ctx.save();
      const hGl=prog*(0.5+0.3*baP3);
      for(const hx of [-12,12]){
        const hG=ctx.createRadialGradient(owner.x+hx,owner.y-owner.r-12,0,owner.x+hx,owner.y-owner.r-12,14);
        hG.addColorStop(0,`rgba(200,0,0,${hGl})`); hG.addColorStop(1,'rgba(100,0,0,0)');
        ctx.fillStyle=hG; ctx.globalAlpha=prog; ctx.beginPath(); ctx.arc(owner.x+hx,owner.y-owner.r-12,14,0,Math.PI*2); ctx.fill();
        ctx.globalAlpha=prog*0.9; ctx.fillStyle='#110000';
        ctx.beginPath(); ctx.arc(owner.x+hx,owner.y-owner.r-12,7,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#ff2200'; ctx.globalAlpha=prog*0.7*pulse;
        ctx.beginPath(); ctx.arc(owner.x+hx+(hx>0?2:-2),owner.y-owner.r-18,3,0,Math.PI*2); ctx.fill();
      }
      ctx.restore();
      // L7: Anti-magic void particles
      if(frame%4===0){ for(let pi=0;pi<2;pi++){
        const ang=Math.random()*Math.PI*2, dist=owner.r+Math.random()*35;
        parts.length<400&&parts.push({x:owner.x+Math.cos(ang)*dist,y:owner.y+Math.sin(ang)*dist,vx:(Math.random()-0.5)*3,vy:-1-Math.random()*2,r:2+Math.random()*3,color:['#330000','#550000','#ff0000','#220000'][pi%4],life:18,max:18});
      }}
      ctx.globalAlpha=1;
    }
  }

  // ── Yami dimension slash ──
  if(FX.yamiSlash){
    const ys=FX.yamiSlash, prog=ys.life/ys.max;
    const ysP=0.5+0.5*Math.sin(frame*0.3), ysP2=0.5+0.5*Math.cos(frame*0.2+0.7), ysBr=0.85+0.15*Math.sin(frame*0.1);
    const ysDx=ys.x2-ys.x1, ysDy=ys.y2-ys.y1, ysLen=Math.sqrt(ysDx*ysDx+ysDy*ysDy)||1;
    const ysNx=-ysDy/ysLen, ysNy=ysDx/ysLen;
    // L1: Wide dimensional rift bloom ultra soft
    ctx.globalAlpha=prog*0.2*ysP2; ctx.strokeStyle='#220055'; ctx.lineWidth=70*ysBr;
    ctx.beginPath(); ctx.moveTo(ys.x1,ys.y1); ctx.lineTo(ys.x2,ys.y2); ctx.stroke();
    // L2: Secondary purple haze
    ctx.globalAlpha=prog*0.35; ctx.strokeStyle='#440088'; ctx.lineWidth=48*ysBr;
    ctx.beginPath(); ctx.moveTo(ys.x1,ys.y1); ctx.lineTo(ys.x2,ys.y2); ctx.stroke();
    // L3: Outer void glow
    ctx.globalAlpha=prog*0.5; ctx.strokeStyle='#5500aa'; ctx.lineWidth=32*ysBr;
    ctx.beginPath(); ctx.moveTo(ys.x1,ys.y1); ctx.lineTo(ys.x2,ys.y2); ctx.stroke();
    // L4: Dark matter mid-layer
    ctx.globalAlpha=prog*0.7; ctx.strokeStyle='#1a0033'; ctx.lineWidth=20;
    ctx.beginPath(); ctx.moveTo(ys.x1,ys.y1); ctx.lineTo(ys.x2,ys.y2); ctx.stroke();
    // L5: Black void core absolute dark
    ctx.globalAlpha=prog*0.95; ctx.strokeStyle='#000000'; ctx.lineWidth=12;
    ctx.beginPath(); ctx.moveTo(ys.x1,ys.y1); ctx.lineTo(ys.x2,ys.y2); ctx.stroke();
    // L6: Purple edge shimmer dual pulsing edges
    const ysShW=(2+ysP*2)*ysBr;
    ctx.globalAlpha=prog*(0.7+0.3*ysP); ctx.strokeStyle='#cc00ff'; ctx.lineWidth=ysShW;
    ctx.beginPath(); ctx.moveTo(ys.x1+ysNx*7,ys.y1+ysNy*7); ctx.lineTo(ys.x2+ysNx*7,ys.y2+ysNy*7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ys.x1-ysNx*7,ys.y1-ysNy*7); ctx.lineTo(ys.x2-ysNx*7,ys.y2-ysNy*7); ctx.stroke();
    // L7: Bright magenta core flash
    ctx.globalAlpha=prog*(0.3+0.4*ysP2); ctx.strokeStyle='#ff88ff'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(ys.x1,ys.y1); ctx.lineTo(ys.x2,ys.y2); ctx.stroke();
    // L8: Dimensional rift cracks perpendicular
    ctx.globalAlpha=prog*(0.25+0.2*ysP); ctx.strokeStyle='#8800cc'; ctx.lineWidth=1.5;
    for(let ci=0;ci<8;ci++){
      const t=0.1+0.8*(ci/7), cx=ys.x1+ysDx*t, cy=ys.y1+ysDy*t;
      const crL=12+10*Math.sin(frame*0.15+ci*2);
      ctx.beginPath(); ctx.moveTo(cx+ysNx*crL,cy+ysNy*crL); ctx.lineTo(cx-ysNx*crL,cy-ysNy*crL); ctx.stroke();
    }
    // Dimensional rift sparks tripled
    if(frame%4===0){ for(let pi=0;pi<3;pi++){
      const t3=Math.random(), sx=ys.x1+ysDx*t3, sy=ys.y1+ysDy*t3;
      const sDir=Math.random()>0.5?1:-1;
      parts.length<400&&parts.push({x:sx+ysNx*sDir*(Math.random()*8),y:sy+ysNy*sDir*(Math.random()*8),vx:ysNx*sDir*3+(Math.random()-0.5)*4,vy:ysNy*sDir*3+(Math.random()-0.5)*4,r:2+Math.random()*4,color:['#9900ff','#cc00ff','#6600cc','#ff44ff'][pi%4],life:18,max:18});
    }}
    // Endpoint energy bursts
    for(const ep of [{x:ys.x1,y:ys.y1},{x:ys.x2,y:ys.y2}]){
      const epG=ctx.createRadialGradient(ep.x,ep.y,0,ep.x,ep.y,18);
      epG.addColorStop(0,`rgba(200,0,255,${prog*0.5*ysP})`); epG.addColorStop(1,'rgba(80,0,160,0)');
      ctx.globalAlpha=prog*0.6; ctx.fillStyle=epG; ctx.beginPath(); ctx.arc(ep.x,ep.y,18,0,Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha=1;
  }

  // ── Sukuna shrine ──
  if(FX.sukunaShrine){
    const sh=FX.sukunaShrine, prog=sh.life/sh.max;
    const shP=0.5+0.5*Math.sin(frame*0.15), shP2=0.5+0.5*Math.cos(frame*0.1+0.6), shP3=0.5+0.5*Math.sin(frame*0.22+1.2), shBr=0.9+0.1*Math.sin(frame*0.07);
    // L1: Wide malevolent bloom red haze
    const shBl=ctx.createRadialGradient(sh.x,sh.y,0,sh.x,sh.y,sh.r*1.6);
    shBl.addColorStop(0,`rgba(200,0,30,${prog*0.12*shP})`); shBl.addColorStop(0.5,`rgba(120,0,20,${prog*0.06})`); shBl.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=shBl; ctx.beginPath(); ctx.arc(sh.x,sh.y,sh.r*1.6,0,Math.PI*2); ctx.fill();
    ctx.save(); ctx.translate(sh.x,sh.y); ctx.rotate(sh.angle);
    // L2: Outer glow octagon soft wide
    ctx.globalAlpha=prog*0.2*shP2; ctx.strokeStyle='#aa0022'; ctx.lineWidth=8*shBr;
    ctx.beginPath();
    for(let oi=0;oi<8;oi++){ const a=oi*Math.PI/4; oi===0?ctx.moveTo(Math.cos(a)*(sh.r+6),Math.sin(a)*(sh.r+6)):ctx.lineTo(Math.cos(a)*(sh.r+6),Math.sin(a)*(sh.r+6)); }
    ctx.closePath(); ctx.stroke();
    // L3: Main rotating octagon sharp
    ctx.strokeStyle=`rgba(200,0,34,${prog*0.7})`; ctx.lineWidth=(3+shP)*shBr;
    ctx.beginPath();
    for(let oi=0;oi<8;oi++){ const a=oi*Math.PI/4; oi===0?ctx.moveTo(Math.cos(a)*sh.r,Math.sin(a)*sh.r):ctx.lineTo(Math.cos(a)*sh.r,Math.sin(a)*sh.r); }
    ctx.closePath(); ctx.stroke();
    // L4: Inner counter-rotating octagon
    ctx.save(); ctx.rotate(-sh.angle*0.3+frame*0.02);
    ctx.globalAlpha=prog*0.4*shP3; ctx.strokeStyle='#ff2244'; ctx.lineWidth=1.5;
    const shIR=sh.r*0.65;
    ctx.beginPath();
    for(let oi=0;oi<8;oi++){ const a=oi*Math.PI/4+Math.PI/8; oi===0?ctx.moveTo(Math.cos(a)*shIR,Math.sin(a)*shIR):ctx.lineTo(Math.cos(a)*shIR,Math.sin(a)*shIR); }
    ctx.closePath(); ctx.stroke(); ctx.restore();
    // L5: Inner glowing fill gradient
    const shFG=ctx.createRadialGradient(0,0,0,0,0,sh.r);
    shFG.addColorStop(0,`rgba(220,0,40,${prog*0.15*shP})`); shFG.addColorStop(0.5,`rgba(160,0,30,${prog*0.08})`); shFG.addColorStop(1,`rgba(80,0,15,${prog*0.03})`);
    ctx.globalAlpha=prog*0.3; ctx.fillStyle=shFG;
    ctx.beginPath();
    for(let oi=0;oi<8;oi++){ const a=oi*Math.PI/4; oi===0?ctx.moveTo(Math.cos(a)*sh.r,Math.sin(a)*sh.r):ctx.lineTo(Math.cos(a)*sh.r,Math.sin(a)*sh.r); }
    ctx.closePath(); ctx.fill();
    // L6: Rune lines with energy pulse + traveling dots
    for(let ri=0;ri<4;ri++){
      const a=ri*Math.PI/4, rP=0.5+0.5*Math.sin(frame*0.18+ri*1.5);
      ctx.globalAlpha=prog*0.15*rP; ctx.strokeStyle='#ff4466'; ctx.lineWidth=5*shBr;
      ctx.beginPath(); ctx.moveTo(-sh.r*Math.cos(a),-sh.r*Math.sin(a)); ctx.lineTo(sh.r*Math.cos(a),sh.r*Math.sin(a)); ctx.stroke();
      ctx.globalAlpha=prog*(0.3+0.2*rP); ctx.strokeStyle='#ff0044'; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(-sh.r*Math.cos(a),-sh.r*Math.sin(a)); ctx.lineTo(sh.r*Math.cos(a),sh.r*Math.sin(a)); ctx.stroke();
      const dotT=((frame*0.02+ri*0.25)%1)*2-1;
      ctx.fillStyle='#ff6688'; ctx.globalAlpha=prog*0.6*rP;
      ctx.beginPath(); ctx.arc(dotT*sh.r*Math.cos(a),dotT*sh.r*Math.sin(a),3,0,Math.PI*2); ctx.fill();
    }
    // L7: Vertex energy nodes
    for(let vi=0;vi<8;vi++){
      const va=vi*Math.PI/4, vP=0.5+0.5*Math.sin(frame*0.2+vi);
      const vG=ctx.createRadialGradient(Math.cos(va)*sh.r,Math.sin(va)*sh.r,0,Math.cos(va)*sh.r,Math.sin(va)*sh.r,8);
      vG.addColorStop(0,`rgba(255,50,80,${prog*0.7*vP})`); vG.addColorStop(1,'rgba(200,0,30,0)');
      ctx.fillStyle=vG; ctx.globalAlpha=prog; ctx.beginPath(); ctx.arc(Math.cos(va)*sh.r,Math.sin(va)*sh.r,8,0,Math.PI*2); ctx.fill();
    }
    // Shrine particles
    if(frame%3===0){ const ang=Math.random()*Math.PI*2;
      parts.length<400&&parts.push({x:sh.x+Math.cos(ang)*sh.r*0.8,y:sh.y+Math.sin(ang)*sh.r*0.8,vx:(Math.random()-0.5)*2,vy:-1.5-Math.random()*2,r:2+Math.random()*2,color:['#ff0033','#cc0022','#ff4466'][Math.random()*3|0],life:20,max:20});
    }
    ctx.restore(); ctx.globalAlpha=1;
  }
  // Sukuna cleave slashes
  for(const cl of FX.sukunaCleaves){
    const prog=cl.life/cl.max;
    const clP=0.5+0.5*Math.sin(frame*0.25+cl.x1*0.01);
    const clDx=cl.x2-cl.x1, clDy=cl.y2-cl.y1, clLen=Math.sqrt(clDx*clDx+clDy*clDy)||1;
    const clNx=-clDy/clLen, clNy=clDx/clLen;
    // L1: Wide crimson bloom
    ctx.globalAlpha=prog*0.2; ctx.strokeStyle='rgba(200,0,40,0.4)'; ctx.lineWidth=22*prog;
    ctx.beginPath(); ctx.moveTo(cl.x1,cl.y1); ctx.lineTo(cl.x2,cl.y2); ctx.stroke();
    // L2: Mid red glow
    ctx.globalAlpha=prog*0.5; ctx.strokeStyle='#cc0022'; ctx.lineWidth=12*prog;
    ctx.beginPath(); ctx.moveTo(cl.x1,cl.y1); ctx.lineTo(cl.x2,cl.y2); ctx.stroke();
    // L3: Core red slash
    ctx.globalAlpha=prog; ctx.strokeStyle='#ff0033'; ctx.lineWidth=6*prog;
    ctx.beginPath(); ctx.moveTo(cl.x1,cl.y1); ctx.lineTo(cl.x2,cl.y2); ctx.stroke();
    // L4: White hot inner core
    ctx.strokeStyle='#ffffff'; ctx.lineWidth=2*prog;
    ctx.beginPath(); ctx.moveTo(cl.x1,cl.y1); ctx.lineTo(cl.x2,cl.y2); ctx.stroke();
    // L5: Pink edge shimmer dual edges
    ctx.globalAlpha=prog*(0.4+0.3*clP); ctx.strokeStyle='#ff6688'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(cl.x1+clNx*4,cl.y1+clNy*4); ctx.lineTo(cl.x2+clNx*4,cl.y2+clNy*4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cl.x1-clNx*4,cl.y1-clNy*4); ctx.lineTo(cl.x2-clNx*4,cl.y2-clNy*4); ctx.stroke();
    // Endpoint flares
    for(const ep of [{x:cl.x1,y:cl.y1},{x:cl.x2,y:cl.y2}]){
      const epG=ctx.createRadialGradient(ep.x,ep.y,0,ep.x,ep.y,10);
      epG.addColorStop(0,`rgba(255,100,120,${prog*0.6})`); epG.addColorStop(1,'rgba(200,0,30,0)');
      ctx.globalAlpha=prog*0.5; ctx.fillStyle=epG; ctx.beginPath(); ctx.arc(ep.x,ep.y,10,0,Math.PI*2); ctx.fill();
    }
    // Cleave spark particles
    if(frame%3===0&&prog>0.3){ const t=Math.random();
      parts.length<400&&parts.push({x:cl.x1+clDx*t,y:cl.y1+clDy*t,vx:clNx*(Math.random()>0.5?1:-1)*3,vy:clNy*(Math.random()>0.5?1:-1)*3,r:1.5+Math.random()*2,color:'#ff4466',life:10,max:10});
    }
    ctx.globalAlpha=1;
  }

  // ── Mahoraga zone ──
  if(FX.mahoragaZone){
    const mz=FX.mahoragaZone, prog=mz.life/mz.max, pulse=0.5+0.5*Math.sin(frame*0.1);
    const mP2=0.5+0.5*Math.cos(frame*0.07+0.5), mP3=0.5+0.5*Math.sin(frame*0.16+1.0), mBr=0.9+0.1*Math.sin(frame*0.05);
    // L1: Wide divine bloom soft outer haze
    const dvBl=ctx.createRadialGradient(mz.x,mz.y,0,mz.x,mz.y,mz.r*1.5);
    dvBl.addColorStop(0,`rgba(160,60,255,${prog*0.08*mP2})`); dvBl.addColorStop(0.4,`rgba(120,30,220,${prog*0.05})`);
    dvBl.addColorStop(0.7,`rgba(80,10,160,${prog*0.03})`); dvBl.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=dvBl; ctx.beginPath(); ctx.arc(mz.x,mz.y,mz.r*1.5,0,Math.PI*2); ctx.fill();
    // L2: Main zone fill radial gradient
    const znFl=ctx.createRadialGradient(mz.x,mz.y,0,mz.x,mz.y,mz.r);
    znFl.addColorStop(0,`rgba(180,80,255,${prog*0.18*pulse})`); znFl.addColorStop(0.5,`rgba(140,50,230,${prog*0.1})`);
    znFl.addColorStop(0.85,`rgba(100,30,200,${prog*0.06})`); znFl.addColorStop(1,'rgba(80,20,160,0)');
    ctx.fillStyle=znFl; ctx.beginPath(); ctx.arc(mz.x,mz.y,mz.r,0,Math.PI*2); ctx.fill();
    // L3: Outer boundary ring pulsing glow
    ctx.globalAlpha=prog*(0.15+0.1*mP2); ctx.strokeStyle='#bb66ff'; ctx.lineWidth=8*mBr;
    ctx.beginPath(); ctx.arc(mz.x,mz.y,mz.r,0,Math.PI*2); ctx.stroke();
    // L4: Main boundary ring sharp
    ctx.globalAlpha=prog*(0.4+0.2*pulse); ctx.strokeStyle='#9933ff'; ctx.lineWidth=3*mBr;
    ctx.beginPath(); ctx.arc(mz.x,mz.y,mz.r,0,Math.PI*2); ctx.stroke();
    // L5: Inner sacred geometry rings
    ctx.save(); ctx.translate(mz.x,mz.y);
    ctx.globalAlpha=prog*0.2*mP3; ctx.strokeStyle='#cc88ff'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.arc(0,0,mz.r*0.7,0,Math.PI*2); ctx.stroke();
    ctx.globalAlpha=prog*0.15*pulse; ctx.strokeStyle='#aa55ee'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.arc(0,0,mz.r*0.45,0,Math.PI*2); ctx.stroke();
    ctx.restore();
    // L6: Adaptation dharma wheel signature
    ctx.save(); ctx.translate(mz.x,mz.y); ctx.rotate(frame*0.015);
    ctx.globalAlpha=prog*(0.3+0.15*pulse); ctx.strokeStyle='#ffcc44'; ctx.lineWidth=2*mBr;
    for(let si=0;si<8;si++){ const sa=si*Math.PI/4;
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(Math.cos(sa)*mz.r*0.5,Math.sin(sa)*mz.r*0.5); ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(0,0,mz.r*0.5,0,Math.PI*2); ctx.stroke();
    ctx.globalAlpha=prog*0.4*mP3;
    const mHub=ctx.createRadialGradient(0,0,0,0,0,mz.r*0.12);
    mHub.addColorStop(0,`rgba(255,220,100,${prog*0.6})`); mHub.addColorStop(1,'rgba(255,170,0,0)');
    ctx.fillStyle=mHub; ctx.beginPath(); ctx.arc(0,0,mz.r*0.12,0,Math.PI*2); ctx.fill();
    ctx.restore();
    // L7: Gold runes orbiting enhanced with glow
    ctx.save(); ctx.translate(mz.x,mz.y); ctx.rotate(frame*0.02);
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ['\u534D','\u2295','\u5350','\u2726','\u2606','\u25C7'].forEach((r,i)=>{
      const a=i*Math.PI*2/6, rOrb=mz.r*0.7+5*Math.sin(frame*0.06+i), rP=0.5+0.5*Math.sin(frame*0.12+i*1.3);
      const rGl=ctx.createRadialGradient(Math.cos(a)*rOrb,Math.sin(a)*rOrb,0,Math.cos(a)*rOrb,Math.sin(a)*rOrb,18);
      rGl.addColorStop(0,`rgba(255,180,40,${prog*0.4*rP})`); rGl.addColorStop(1,'rgba(255,150,0,0)');
      ctx.fillStyle=rGl; ctx.globalAlpha=prog*0.5; ctx.beginPath(); ctx.arc(Math.cos(a)*rOrb,Math.sin(a)*rOrb,18,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha=prog*(0.5+0.3*rP); ctx.shadowColor='#ffaa00'; ctx.shadowBlur=8;
      ctx.fillStyle='#ffcc33'; ctx.font='bold 22px serif';
      ctx.fillText(r,Math.cos(a)*rOrb,Math.sin(a)*rOrb); ctx.shadowBlur=0;
    });
    ctx.restore();
    // L8: Adaptation energy crackle at boundary
    ctx.save(); ctx.translate(mz.x,mz.y);
    ctx.globalAlpha=prog*(0.2+0.15*mP3); ctx.strokeStyle='#ddaaff'; ctx.lineWidth=1;
    for(let ci=0;ci<12;ci++){
      const ca=ci*Math.PI/6+frame*0.008, bR=mz.r*(0.95+0.05*Math.sin(frame*0.1+ci)), oR=mz.r*(1.05+0.08*Math.sin(frame*0.15+ci*2));
      ctx.beginPath(); ctx.moveTo(Math.cos(ca)*bR,Math.sin(ca)*bR); ctx.lineTo(Math.cos(ca+0.03)*oR,Math.sin(ca+0.03)*oR); ctx.stroke();
    }
    ctx.restore();
    // Divine golden mote particles
    if(frame%3===0){ const ang=Math.random()*Math.PI*2, dist=mz.r*(0.3+Math.random()*0.7);
      parts.length<400&&parts.push({x:mz.x+Math.cos(ang)*dist,y:mz.y+Math.sin(ang)*dist,vx:(Math.random()-0.5)*1.5,vy:-1-Math.random()*1.5,r:1.5+Math.random()*2.5,color:['#ffcc44','#ddaaff','#ffaa00','#cc88ff'][Math.random()*4|0],life:22,max:22});
    }
    ctx.globalAlpha=1;
  }

  // ── Blood streams ──
  for(const bs of FX.bloodStreams){
    const prog=bs.life/bs.max;
    const pulse=0.5+0.5*Math.sin(frame*0.15+bs.x*0.1);
    // Outer crimson glow trail
    ctx.globalAlpha=prog*0.25;
    ctx.strokeStyle='#ff0000'; ctx.lineWidth=12+pulse*4;
    ctx.beginPath(); ctx.moveTo(bs.x,bs.y); ctx.lineTo(bs.x-bs.vx*8,bs.y-bs.vy*8); ctx.stroke();
    // Mid blood trail
    ctx.globalAlpha=prog*0.55;
    ctx.strokeStyle='#cc0000'; ctx.lineWidth=6+pulse*2;
    ctx.beginPath(); ctx.moveTo(bs.x,bs.y); ctx.lineTo(bs.x-bs.vx*7,bs.y-bs.vy*7); ctx.stroke();
    // Core bright trail
    ctx.globalAlpha=prog*0.85;
    ctx.strokeStyle='#ff3333'; ctx.lineWidth=2.5;
    ctx.beginPath(); ctx.moveTo(bs.x,bs.y); ctx.lineTo(bs.x-bs.vx*5,bs.y-bs.vy*5); ctx.stroke();
    // Main droplet with radial glow
    ctx.globalAlpha=prog*0.3;
    ctx.fillStyle='#ff0000';
    ctx.beginPath(); ctx.arc(bs.x,bs.y,10+pulse*3,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=prog*0.85;
    ctx.fillStyle='#cc0000';
    ctx.beginPath(); ctx.arc(bs.x,bs.y,5+pulse*1.5,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=prog;
    ctx.fillStyle='#ff6666';
    ctx.beginPath(); ctx.arc(bs.x,bs.y,2.5,0,Math.PI*2); ctx.fill();
    // Micro splatter particles
    if(frame%4===0) parts.length<400&&parts.push({x:bs.x+(Math.random()-0.5)*8, y:bs.y+(Math.random()-0.5)*8,
      vx:bs.vx*0.3+(Math.random()-0.5)*3, vy:bs.vy*0.3+(Math.random()-0.5)*3,
      r:2+Math.random()*2, color:'#aa0000', life:12, max:12});
    ctx.globalAlpha=1;
  }

  // ── Rika spirit zone ──
  if(FX.rikaZone){
    const rz=FX.rikaZone, prog=rz.life/rz.max;
    const owner=_G.balls.find(b=>b.id===rz.ownerId&&b.alive);
    if(owner){
      const pulse=0.5+0.5*Math.sin(frame*0.08);
      const pulse2=0.5+0.5*Math.sin(frame*0.13+1.2);
      const pulse3=0.5+0.5*Math.cos(frame*0.06);
      // Outermost ethereal bloom
      ctx.globalAlpha=prog*(0.06+0.04*pulse3);
      const bloomGrad=ctx.createRadialGradient(owner.x,owner.y,rz.r*0.3,owner.x,owner.y,rz.r*1.15);
      bloomGrad.addColorStop(0,'#aaaaff'); bloomGrad.addColorStop(0.6,'#6666cc'); bloomGrad.addColorStop(1,'transparent');
      ctx.fillStyle=bloomGrad;
      ctx.beginPath(); ctx.arc(owner.x,owner.y,rz.r*1.15,0,Math.PI*2); ctx.fill();
      // Spirit aura with gradient
      ctx.globalAlpha=prog*(0.14+0.1*pulse);
      const auraGrad=ctx.createRadialGradient(owner.x,owner.y,0,owner.x,owner.y,rz.r);
      auraGrad.addColorStop(0,'#ccccff'); auraGrad.addColorStop(0.5,'#8888ff'); auraGrad.addColorStop(1,'#4444aa');
      ctx.fillStyle=auraGrad;
      ctx.beginPath(); ctx.arc(owner.x,owner.y,rz.r,0,Math.PI*2); ctx.fill();
      // Pulsing outer ring
      ctx.globalAlpha=prog*(0.35+0.25*pulse); ctx.strokeStyle='#ccccff'; ctx.lineWidth=2+pulse2*2;
      ctx.beginPath(); ctx.arc(owner.x,owner.y,rz.r,0,Math.PI*2); ctx.stroke();
      // Inner energy ring
      ctx.globalAlpha=prog*(0.2+0.15*pulse2); ctx.strokeStyle='#aabbff'; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.arc(owner.x,owner.y,rz.r*0.65+pulse3*8,0,Math.PI*2); ctx.stroke();
      // Spirit tendrils radiating outward
      ctx.save(); ctx.translate(owner.x,owner.y);
      ctx.globalAlpha=prog*0.18;
      ctx.strokeStyle='#9999ff'; ctx.lineWidth=1.5;
      for(let ti=0;ti<8;ti++){
        const ta=ti*Math.PI*2/8+frame*0.015;
        const tLen=rz.r*(0.5+0.3*Math.sin(frame*0.05+ti));
        ctx.beginPath(); ctx.moveTo(0,0);
        ctx.quadraticCurveTo(Math.cos(ta+0.3)*tLen*0.6,Math.sin(ta+0.3)*tLen*0.6,
          Math.cos(ta)*tLen,Math.sin(ta)*tLen);
        ctx.stroke();
      }
      ctx.restore();
      // Ghost wisps orbiting — 6 wisps, dual layer
      ctx.save(); ctx.translate(owner.x,owner.y); ctx.rotate(frame*0.03);
      for(let wi=0;wi<6;wi++){
        const wa=wi*Math.PI*2/6;
        const wobble=Math.sin(frame*0.07+wi*1.5)*8;
        const wx=Math.cos(wa)*(rz.r*0.7+wobble), wy=Math.sin(wa)*(rz.r*0.7+wobble);
        // Wisp glow
        ctx.globalAlpha=prog*0.2;
        ctx.fillStyle='#aaaaff';
        ctx.beginPath(); ctx.arc(wx,wy,16+pulse*6,0,Math.PI*2); ctx.fill();
        // Wisp core
        ctx.globalAlpha=prog*0.65;
        ctx.fillStyle='rgba(210,210,255,0.8)';
        ctx.beginPath(); ctx.arc(wx,wy,8+pulse*3,0,Math.PI*2); ctx.fill();
        // Wisp bright center
        ctx.globalAlpha=prog*0.9;
        ctx.fillStyle='#ffffff';
        ctx.beginPath(); ctx.arc(wx,wy,3+pulse2*1.5,0,Math.PI*2); ctx.fill();
      }
      ctx.restore();
      // Spirit zone particles
      if(frame%3===0){
        const a=Math.random()*Math.PI*2;
        const dist=rz.r*(0.3+Math.random()*0.7);
        parts.length<400&&parts.push({x:owner.x+Math.cos(a)*dist, y:owner.y+Math.sin(a)*dist,
          vx:(Math.random()-0.5)*1.5, vy:-1-Math.random()*2,
          r:3+Math.random()*3, color:Math.random()>0.5?'#aaaaff':'#ccccff', life:25, max:25});
      }
      ctx.globalAlpha=1;
    }
  }

  // ── Hakari flashing chaos ──
  if(FX.hakariFrames>0){
    const prog=FX.hakariFrames/300;
    const hPulse=0.5+0.5*Math.sin(frame*0.2);
    const hPulse2=0.5+0.5*Math.cos(frame*0.14);
    const colors=['#ff00ff','#00ffff','#ffdd00','#ff0088','#88ff00','#ff4400'];
    // Rapid flashing color overlay with scanlines
    if(frame%4===0){
      ctx.globalAlpha=prog*0.12;
      ctx.fillStyle=colors[frame%colors.length];
      ctx.fillRect(0,ACY-ARENA.r,W,ARENA.r*2);
      // Scanline effect
      ctx.globalAlpha=prog*0.06;
      ctx.fillStyle='#000000';
      for(let sl=0;sl<ARENA.r*2;sl+=4){
        ctx.fillRect(0,ACY-ARENA.r+sl,W,2);
      }
    }
    // Diagonal flash streaks
    ctx.globalAlpha=prog*0.08;
    ctx.strokeStyle=colors[(frame+2)%colors.length]; ctx.lineWidth=3;
    for(let di=0;di<8;di++){
      const dx=-200+di*100+(frame*3%100);
      ctx.beginPath(); ctx.moveTo(dx,ACY-ARENA.r); ctx.lineTo(dx+200,ACY+ARENA.r); ctx.stroke();
    }
    // Rotating stars around owner — doubled count, multi-layer
    const owner=_G.balls.find(b=>b.id===FX.hakariOwner&&b.alive);
    if(owner){
      // Outer aura glow
      ctx.globalAlpha=prog*0.15;
      const hakGrad=ctx.createRadialGradient(owner.x,owner.y,10,owner.x,owner.y,80);
      hakGrad.addColorStop(0,'#ff00ff'); hakGrad.addColorStop(0.5,'#00ffff'); hakGrad.addColorStop(1,'transparent');
      ctx.fillStyle=hakGrad;
      ctx.beginPath(); ctx.arc(owner.x,owner.y,80,0,Math.PI*2); ctx.fill();
      ctx.save(); ctx.translate(owner.x,owner.y);
      // Outer ring — counter-rotating
      ctx.save(); ctx.rotate(-frame*0.1);
      for(let si=0;si<8;si++){
        const sa=si*Math.PI/4;
        ctx.globalAlpha=prog*0.35;
        ctx.fillStyle=colors[si%colors.length];
        ctx.beginPath(); ctx.arc(Math.cos(sa)*65,Math.sin(sa)*65,4+hPulse2*3,0,Math.PI*2); ctx.fill();
      }
      ctx.restore();
      // Inner ring — fast rotating
      ctx.save(); ctx.rotate(frame*0.2);
      for(let si=0;si<6;si++){
        const sa=si*Math.PI/3;
        const starR=7+hPulse*4;
        ctx.globalAlpha=prog*0.85;
        ctx.fillStyle=colors[si%3];
        // Draw a small star shape
        ctx.beginPath();
        for(let sp=0;sp<5;sp++){
          const spA=sa+sp*Math.PI*2/5-Math.PI/2;
          const sr=sp%2===0?starR:starR*0.4;
          const sx=Math.cos(sa)*45+Math.cos(spA)*sr;
          const sy=Math.sin(sa)*45+Math.sin(spA)*sr;
          sp===0?ctx.moveTo(sx,sy):ctx.lineTo(sx,sy);
        }
        ctx.closePath(); ctx.fill();
        // Star glow
        ctx.globalAlpha=prog*0.3;
        ctx.beginPath(); ctx.arc(Math.cos(sa)*45,Math.sin(sa)*45,12+hPulse*5,0,Math.PI*2); ctx.fill();
      }
      ctx.restore();
      // Energy crackle arcs between stars
      ctx.globalAlpha=prog*0.4; ctx.strokeStyle='#ffffff'; ctx.lineWidth=1;
      for(let ci=0;ci<4;ci++){
        const ca1=(ci*Math.PI/2+frame*0.15)%(Math.PI*2);
        const ca2=((ci+1)*Math.PI/2+frame*0.15)%(Math.PI*2);
        ctx.beginPath(); ctx.moveTo(Math.cos(ca1)*45,Math.sin(ca1)*45);
        const cmx=(Math.cos(ca1)+Math.cos(ca2))*0.5*45+(Math.random()-0.5)*20;
        const cmy=(Math.sin(ca1)+Math.sin(ca2))*0.5*45+(Math.random()-0.5)*20;
        ctx.quadraticCurveTo(cmx,cmy,Math.cos(ca2)*45,Math.sin(ca2)*45);
        ctx.stroke();
      }
      ctx.restore();
      // Jackpot particles
      if(frame%4===0){
        const a=Math.random()*Math.PI*2;
        parts.length<400&&parts.push({x:owner.x+Math.cos(a)*50, y:owner.y+Math.sin(a)*50,
          vx:(Math.random()-0.5)*5, vy:(Math.random()-0.5)*5-2,
          r:3+Math.random()*3, color:colors[Math.floor(Math.random()*colors.length)], life:18, max:18});
      }
    }
    ctx.globalAlpha=1;
  }

  // ── Rasengan projectile ──
  if(FX.rasengan){
    const rs = FX.rasengan;
    const prog = rs.life / rs.max;
    const rPulse = 0.5+0.5*Math.sin(frame*0.25);
    const rPulse2 = 0.5+0.5*Math.cos(frame*0.18);
    const spinRate = frame*0.35;
    ctx.save();
    ctx.translate(rs.x, rs.y);
    // Screen-space bloom — outermost soft glow
    ctx.globalAlpha = prog * 0.15;
    const bloomR = ctx.createRadialGradient(0,0,rs.r*0.3,0,0,rs.r*2.5);
    bloomR.addColorStop(0,'#4488ff'); bloomR.addColorStop(0.4,'#0044ff'); bloomR.addColorStop(1,'transparent');
    ctx.fillStyle = bloomR;
    ctx.beginPath(); ctx.arc(0, 0, rs.r*2.5, 0, Math.PI*2); ctx.fill();
    // Energy ring shell — pulsing outer boundary
    ctx.globalAlpha = prog * (0.4+0.2*rPulse);
    ctx.strokeStyle = '#0066ff'; ctx.lineWidth = 3+rPulse*2;
    ctx.beginPath(); ctx.arc(0, 0, rs.r+10+rPulse2*6, 0, Math.PI*2); ctx.stroke();
    // Second energy ring
    ctx.globalAlpha = prog * 0.25;
    ctx.strokeStyle = '#00aaff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, rs.r+18+rPulse*4, 0, Math.PI*2); ctx.stroke();
    // Outer glow fill with gradient
    ctx.globalAlpha = prog * 0.45;
    const outerGrad = ctx.createRadialGradient(0,0,rs.r*0.5,0,0,rs.r+14);
    outerGrad.addColorStop(0,'#0088ff'); outerGrad.addColorStop(0.7,'#0044dd'); outerGrad.addColorStop(1,'#001166');
    ctx.fillStyle = outerGrad;
    ctx.beginPath(); ctx.arc(0, 0, rs.r + 14, 0, Math.PI*2); ctx.fill();
    // Core with radial gradient
    ctx.globalAlpha = prog * 0.9;
    const coreGrad = ctx.createRadialGradient(0,0,0,0,0,rs.r);
    coreGrad.addColorStop(0,'#aaddff'); coreGrad.addColorStop(0.35,'#0099ff'); coreGrad.addColorStop(0.7,'#0066dd'); coreGrad.addColorStop(1,'#0033aa');
    ctx.fillStyle = coreGrad;
    ctx.beginPath(); ctx.arc(0, 0, rs.r, 0, Math.PI*2); ctx.fill();
    // White-hot center with pulsing glow
    ctx.globalAlpha = prog;
    const hotGrad = ctx.createRadialGradient(0,0,0,0,0,rs.r*0.5);
    hotGrad.addColorStop(0,'#ffffff'); hotGrad.addColorStop(0.5,'#ccddff'); hotGrad.addColorStop(1,'transparent');
    ctx.fillStyle = hotGrad;
    ctx.beginPath(); ctx.arc(0, 0, rs.r * (0.5+rPulse*0.1), 0, Math.PI*2); ctx.fill();
    // Multi-layer spiral arms (6 curved arms, rotating)
    ctx.save(); ctx.rotate(spinRate);
    for(let si=0; si<6; si++){
      const sa = si * Math.PI * 2/6;
      const armAlpha = 0.5 + 0.3*Math.sin(frame*0.12+si);
      ctx.globalAlpha = prog * armAlpha;
      ctx.strokeStyle = si%2===0 ? '#00ccff' : '#88ddff';
      ctx.lineWidth = 2.5+rPulse*(si%2===0?1.5:0.8);
      ctx.beginPath();
      // Curved spiral using quadratic bezier
      const innerR = 5;
      const outerR = rs.r+4;
      const curveBend = 0.6;
      const sx = Math.cos(sa)*innerR, sy = Math.sin(sa)*innerR;
      const ex = Math.cos(sa)*outerR, ey = Math.sin(sa)*outerR;
      const cpx = Math.cos(sa+curveBend)*(innerR+outerR)*0.5;
      const cpy = Math.sin(sa+curveBend)*(innerR+outerR)*0.5;
      ctx.moveTo(sx,sy);
      ctx.quadraticCurveTo(cpx,cpy,ex,ey);
      ctx.stroke();
    }
    ctx.restore();
    // Counter-rotating inner spirals
    ctx.save(); ctx.rotate(-spinRate*0.7);
    ctx.globalAlpha = prog * 0.3;
    ctx.strokeStyle = '#aaeeff'; ctx.lineWidth = 1;
    for(let si=0; si<4; si++){
      const sa = si * Math.PI/2;
      const iR = rs.r*0.7;
      ctx.beginPath();
      ctx.moveTo(Math.cos(sa)*3,Math.sin(sa)*3);
      ctx.quadraticCurveTo(Math.cos(sa+0.8)*iR*0.5,Math.sin(sa+0.8)*iR*0.5,
        Math.cos(sa)*iR,Math.sin(sa)*iR);
      ctx.stroke();
    }
    ctx.restore();
    // Velocity distortion lines (speed streaks behind)
    ctx.globalAlpha = prog * 0.25;
    ctx.strokeStyle = '#0088ff'; ctx.lineWidth = 1.5;
    const vAngle = rs.angle + Math.PI; // opposite of travel direction
    for(let vl=0;vl<5;vl++){
      const spread = (vl-2)*0.15;
      const lineLen = 20 + Math.random()*25;
      const sx = Math.cos(vAngle+spread)*rs.r;
      const sy = Math.sin(vAngle+spread)*rs.r;
      ctx.beginPath();
      ctx.moveTo(sx,sy);
      ctx.lineTo(sx+Math.cos(vAngle+spread)*lineLen, sy+Math.sin(vAngle+spread)*lineLen);
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    // Triple particle emission — trail, ring sparks, core wisps
    if(frame%4===0){
      // Trail particles
      parts.length<400&&parts.push({x:rs.x+(Math.random()*2-1)*10, y:rs.y+(Math.random()*2-1)*10,
        vx:-Math.cos(rs.angle)*2+(Math.random()-0.5)*3, vy:-Math.sin(rs.angle)*2+(Math.random()-0.5)*3,
        r:3+Math.random()*3, color:'#0088ff', life:18, max:18});
      // Ring sparks
      const sa=Math.random()*Math.PI*2;
      parts.length<400&&parts.push({x:rs.x+Math.cos(sa)*(rs.r+10), y:rs.y+Math.sin(sa)*(rs.r+10),
        vx:Math.cos(sa)*2+(Math.random()-0.5)*2, vy:Math.sin(sa)*2+(Math.random()-0.5)*2,
        r:2+Math.random()*2, color:'#00ccff', life:12, max:12});
    }
    if(frame%3===0){
      // Core wisps
      parts.length<400&&parts.push({x:rs.x+(Math.random()-0.5)*6, y:rs.y+(Math.random()-0.5)*6,
        vx:(Math.random()-0.5)*4, vy:(Math.random()-0.5)*4,
        r:2, color:'#ffffff', life:10, max:10});
    }
  }

  // ── Chidori beam ──
  if(FX.chidori){
    const ch = FX.chidori;
    const prog = ch.life / ch.max;
    const len = 260;
    const cPulse = 0.5+0.5*Math.sin(frame*0.3);
    const cPulse2 = 0.5+0.5*Math.cos(frame*0.22);
    const ex = ch.x + Math.cos(ch.angle)*len, ey = ch.y + Math.sin(ch.angle)*len;
    const perpX = -Math.sin(ch.angle), perpY = Math.cos(ch.angle);
    // Screen-space bloom — wide soft glow
    ctx.globalAlpha = prog * 0.12;
    ctx.strokeStyle = '#4444ff'; ctx.lineWidth = 60+cPulse*20;
    ctx.beginPath(); ctx.moveTo(ch.x, ch.y); ctx.lineTo(ex, ey); ctx.stroke();
    // Electric corona — outer crackling aura
    ctx.globalAlpha = prog * 0.25;
    ctx.strokeStyle = '#6666ff'; ctx.lineWidth = 35+cPulse2*10;
    ctx.beginPath(); ctx.moveTo(ch.x, ch.y); ctx.lineTo(ex, ey); ctx.stroke();
    // Outer electric glow — blue-white
    ctx.globalAlpha = prog * 0.35;
    ctx.strokeStyle = '#8888ff'; ctx.lineWidth = 22+cPulse*6;
    ctx.beginPath(); ctx.moveTo(ch.x, ch.y); ctx.lineTo(ex, ey); ctx.stroke();
    // Mid plasma layer
    ctx.globalAlpha = prog * 0.7;
    ctx.strokeStyle = '#aaccff'; ctx.lineWidth = 10+cPulse*3;
    ctx.beginPath(); ctx.moveTo(ch.x, ch.y); ctx.lineTo(ex, ey); ctx.stroke();
    // Bright core bolt
    ctx.globalAlpha = prog * 0.9;
    ctx.strokeStyle = '#ddeeff'; ctx.lineWidth = 5+cPulse2*2;
    ctx.beginPath(); ctx.moveTo(ch.x, ch.y); ctx.lineTo(ex, ey); ctx.stroke();
    // White-hot center line
    ctx.globalAlpha = prog;
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2+cPulse*1;
    ctx.beginPath(); ctx.moveTo(ch.x, ch.y); ctx.lineTo(ex, ey); ctx.stroke();
    // Jagged forking lightning with multi-segment branches
    ctx.globalAlpha = prog * 0.7;
    for(let fi=0; fi<10; fi++){
      const t = Math.random()*0.9+0.05;
      const forkX = ch.x + Math.cos(ch.angle)*len*t;
      const forkY = ch.y + Math.sin(ch.angle)*len*t;
      const fAng = ch.angle + (Math.random()-0.5)*1.6;
      const forkLen = 25 + Math.random()*45;
      const segments = 3 + Math.floor(Math.random()*3);
      // Main fork
      ctx.strokeStyle = fi%3===0 ? '#ffffff' : '#aaccff';
      ctx.lineWidth = 1+Math.random()*1.5;
      ctx.beginPath(); ctx.moveTo(forkX, forkY);
      let fxCur = forkX, fyCur = forkY;
      for(let seg=0; seg<segments; seg++){
        const segLen = forkLen/segments;
        const jitter = (Math.random()-0.5)*0.8;
        fxCur += Math.cos(fAng+jitter)*segLen;
        fyCur += Math.sin(fAng+jitter)*segLen;
        ctx.lineTo(fxCur, fyCur);
      }
      ctx.stroke();
      // Sub-branch from midpoint
      if(Math.random()>0.4){
        const subAng = fAng + (Math.random()-0.5)*1.5;
        const midX = (forkX+fxCur)*0.5, midY = (forkY+fyCur)*0.5;
        ctx.globalAlpha = prog * 0.4;
        ctx.strokeStyle = '#8899ff'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(midX, midY);
        ctx.lineTo(midX+Math.cos(subAng)*20, midY+Math.sin(subAng)*20);
        ctx.stroke();
      }
    }
    // Energy crackle pattern along the beam
    ctx.globalAlpha = prog * 0.35;
    ctx.strokeStyle = '#ccddff'; ctx.lineWidth = 0.8;
    for(let cr=0; cr<15; cr++){
      const t = cr/15;
      const cx = ch.x + Math.cos(ch.angle)*len*t;
      const cy = ch.y + Math.sin(ch.angle)*len*t;
      const jx = perpX * (Math.sin(frame*0.5+cr*2)*12+Math.random()*6);
      const jy = perpY * (Math.sin(frame*0.5+cr*2)*12+Math.random()*6);
      ctx.beginPath();
      ctx.moveTo(cx+jx, cy+jy);
      ctx.lineTo(cx-jx, cy-jy);
      ctx.stroke();
    }
    // Plasma core glow at source point
    ctx.globalAlpha = prog * 0.5;
    const srcGrad = ctx.createRadialGradient(ch.x,ch.y,0,ch.x,ch.y,25);
    srcGrad.addColorStop(0,'#ffffff'); srcGrad.addColorStop(0.3,'#aaccff'); srcGrad.addColorStop(1,'transparent');
    ctx.fillStyle = srcGrad;
    ctx.beginPath(); ctx.arc(ch.x,ch.y,25+cPulse*8,0,Math.PI*2); ctx.fill();
    // Impact flash at tip
    ctx.globalAlpha = prog * 0.6;
    const tipGrad = ctx.createRadialGradient(ex,ey,0,ex,ey,30);
    tipGrad.addColorStop(0,'#ffffff'); tipGrad.addColorStop(0.4,'#8899ff'); tipGrad.addColorStop(1,'transparent');
    ctx.fillStyle = tipGrad;
    ctx.beginPath(); ctx.arc(ex,ey,30+cPulse2*12,0,Math.PI*2); ctx.fill();
    // Triple spark emission — tip, along beam, and source
    if(frame%4===0){
      // Tip sparks
      parts.length<400&&parts.push({x:ex+(Math.random()-0.5)*25, y:ey+(Math.random()-0.5)*25,
        vx:(Math.random()-0.5)*8, vy:(Math.random()-0.5)*8, r:2+Math.random()*2, color:'#aaccff', life:12, max:12});
      // Along-beam sparks
      const bt=Math.random();
      parts.length<400&&parts.push({x:ch.x+Math.cos(ch.angle)*len*bt+perpX*(Math.random()-0.5)*15,
        y:ch.y+Math.sin(ch.angle)*len*bt+perpY*(Math.random()-0.5)*15,
        vx:perpX*(Math.random()-0.5)*6, vy:perpY*(Math.random()-0.5)*6,
        r:1.5+Math.random()*1.5, color:'#ffffff', life:8, max:8});
    }
    if(frame%4===0){
      // Source sparks
      parts.length<400&&parts.push({x:ch.x+(Math.random()-0.5)*15, y:ch.y+(Math.random()-0.5)*15,
        vx:(Math.random()-0.5)*5, vy:(Math.random()-0.5)*5, r:2.5, color:'#6688ff', life:15, max:15});
    }
    ctx.globalAlpha = 1;
  }

  // ── Tsukuyomi illusion trap ──
  if(FX.tsukuyomiFrames > 0){
    const target = _G.balls.find(b=>b.id===FX.tsukuyomiTarget && b.alive);
    if(target){
      const tp = FX.tsukuyomiFrames / 200;
      const pulse = 0.5 + 0.5*Math.sin(frame*0.12);
      const pulse2 = 0.5 + 0.5*Math.cos(frame*0.09);
      const pulse3 = 0.5 + 0.5*Math.sin(frame*0.17+0.8);
      // Blood-red reality overlay — screen-space vignette
      ctx.globalAlpha = tp * 0.08;
      const vigGrad = ctx.createRadialGradient(target.x,target.y,20,target.x,target.y,180);
      vigGrad.addColorStop(0,'transparent'); vigGrad.addColorStop(0.5,'#220000'); vigGrad.addColorStop(1,'#440011');
      ctx.fillStyle = vigGrad;
      ctx.beginPath(); ctx.arc(target.x,target.y,180,0,Math.PI*2); ctx.fill();
      // Warped reality distortion grid
      ctx.save();
      ctx.translate(target.x, target.y);
      ctx.globalAlpha = tp * 0.12;
      ctx.strokeStyle = '#ff0033'; ctx.lineWidth = 0.5;
      for(let gx=-4;gx<=4;gx++){
        for(let gy=-4;gy<=4;gy++){
          const dist = Math.sqrt(gx*gx+gy*gy);
          const warp = Math.sin(frame*0.06+dist*0.8)*5;
          const bx = gx*20+warp, by = gy*20+warp;
          if(gx<4){ ctx.beginPath(); ctx.moveTo(bx,by); ctx.lineTo(bx+20+warp*0.5,by); ctx.stroke(); }
          if(gy<4){ ctx.beginPath(); ctx.moveTo(bx,by); ctx.lineTo(bx,by+20+warp*0.5); ctx.stroke(); }
        }
      }
      ctx.restore();
      // Outer void — concentric sharingan-like rings
      ctx.save();
      ctx.translate(target.x, target.y);
      ctx.rotate(-frame * 0.04);
      // Outermost ring with bloom
      ctx.globalAlpha = tp * 0.2;
      ctx.strokeStyle = '#880044'; ctx.lineWidth = 8+pulse2*4;
      ctx.beginPath(); ctx.arc(0, 0, 72+pulse*10, 0, Math.PI*2); ctx.stroke();
      // Second ring
      ctx.globalAlpha = tp * 0.45;
      ctx.strokeStyle = '#cc0066'; ctx.lineWidth = 3+pulse*2;
      ctx.beginPath(); ctx.arc(0, 0, 58+pulse*8, 0, Math.PI*2); ctx.stroke();
      // Third inner ring
      ctx.globalAlpha = tp * 0.35;
      ctx.strokeStyle = '#ff0088'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 42+pulse2*6, 0, Math.PI*2); ctx.stroke();
      // Innermost ring
      ctx.globalAlpha = tp * 0.5;
      ctx.strokeStyle = '#ff3399'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 0, 26+pulse3*4, 0, Math.PI*2); ctx.stroke();
      // Sharingan tomoe segments — 3 comma shapes
      for(let si=0; si<3; si++){
        const sa = si * Math.PI*2/3 + frame*0.03;
        // Tomoe fill
        ctx.globalAlpha = tp * 0.4;
        ctx.fillStyle = '#aa0044';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, 48, sa, sa+0.9);
        ctx.closePath(); ctx.fill();
        // Tomoe dot (comma head)
        ctx.globalAlpha = tp * 0.7;
        ctx.fillStyle = '#ff0055';
        const dotX = Math.cos(sa+0.7)*38, dotY = Math.sin(sa+0.7)*38;
        ctx.beginPath(); ctx.arc(dotX, dotY, 5+pulse*2, 0, Math.PI*2); ctx.fill();
        // Tomoe tail — curved line
        ctx.globalAlpha = tp * 0.35;
        ctx.strokeStyle = '#cc0055'; ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, 38, sa+0.1, sa+0.7);
        ctx.stroke();
      }
      // Connecting spokes
      ctx.globalAlpha = tp * 0.2;
      ctx.strokeStyle = '#ff0066'; ctx.lineWidth = 1;
      for(let sp=0;sp<6;sp++){
        const spA = sp*Math.PI/3+frame*0.02;
        ctx.beginPath(); ctx.moveTo(Math.cos(spA)*15,Math.sin(spA)*15);
        ctx.lineTo(Math.cos(spA)*65,Math.sin(spA)*65); ctx.stroke();
      }
      ctx.restore();
      // Eye symbol — layered with gradients
      ctx.globalAlpha = tp * 0.3;
      const eyeBloom = ctx.createRadialGradient(target.x,target.y,0,target.x,target.y,22);
      eyeBloom.addColorStop(0,'#ff0055'); eyeBloom.addColorStop(0.5,'#aa0033'); eyeBloom.addColorStop(1,'transparent');
      ctx.fillStyle = eyeBloom;
      ctx.beginPath(); ctx.arc(target.x, target.y, 22+pulse*6, 0, Math.PI*2); ctx.fill();
      // Eye core
      ctx.globalAlpha = (0.7+0.3*pulse)*tp;
      ctx.fillStyle = '#ff0055';
      ctx.beginPath(); ctx.arc(target.x, target.y, 8+pulse*4, 0, Math.PI*2); ctx.fill();
      // Pupil
      ctx.globalAlpha = tp * 0.9;
      ctx.fillStyle = '#220000';
      ctx.beginPath(); ctx.arc(target.x, target.y, 3+pulse2*1.5, 0, Math.PI*2); ctx.fill();
      // Eye highlight
      ctx.globalAlpha = tp * 0.8;
      ctx.fillStyle = '#ff6699';
      ctx.beginPath(); ctx.arc(target.x-2, target.y-2, 1.5, 0, Math.PI*2); ctx.fill();
      // Glitch lines — more frequent, with horizontal displacement
      if(frame%3===0){
        ctx.globalAlpha = tp * 0.45;
        for(let gl=0; gl<8; gl++){
          const gy = target.y - 60 + gl*15 + (Math.random()-0.5)*12;
          const glitchOff = (Math.random()-0.5)*15;
          ctx.strokeStyle = gl%2===0 ? '#ff00cc' : '#cc0066';
          ctx.lineWidth = 0.5+Math.random()*1.5;
          ctx.beginPath();
          ctx.moveTo(target.x-60+glitchOff, gy);
          ctx.lineTo(target.x+60+glitchOff, gy);
          ctx.stroke();
        }
        // Vertical glitch bars
        ctx.globalAlpha = tp * 0.15;
        for(let vg=0; vg<3; vg++){
          const vgx = target.x - 40 + vg*30 + (Math.random()-0.5)*20;
          ctx.fillStyle = '#ff0044';
          ctx.fillRect(vgx, target.y-50, 4+Math.random()*6, 100);
        }
      }
      // Illusion particles — dark wisps spiraling inward
      if(frame%4===0){
        const a = Math.random()*Math.PI*2;
        const dist = 50+Math.random()*30;
        parts.length<400&&parts.push({x:target.x+Math.cos(a)*dist, y:target.y+Math.sin(a)*dist,
          vx:-Math.cos(a)*2, vy:-Math.sin(a)*2,
          r:2+Math.random()*3, color:Math.random()>0.5?'#ff0055':'#880033', life:20, max:20});
      }
      if(frame%4===0){
        parts.length<400&&parts.push({x:target.x+(Math.random()-0.5)*40, y:target.y+(Math.random()-0.5)*40,
          vx:(Math.random()-0.5)*2, vy:-1-Math.random()*2,
          r:2, color:'#ff00cc', life:15, max:15});
      }
      ctx.globalAlpha = 1;
    }
  }

  // ── Sand wave ──
  if(FX.sandWave){
    const sw = FX.sandWave;
    const prog = sw.life / sw.max;
    const sPulse = 0.5+0.5*Math.sin(frame*0.15);
    const sPulse2 = 0.5+0.5*Math.cos(frame*0.1);
    // Outermost dust bloom
    ctx.globalAlpha = prog * 0.1;
    const dustGrad = ctx.createRadialGradient(sw.x,sw.y,sw.r*0.6,sw.x,sw.y,sw.r+40);
    dustGrad.addColorStop(0,'#aa8833'); dustGrad.addColorStop(0.6,'#886622'); dustGrad.addColorStop(1,'transparent');
    ctx.fillStyle = dustGrad;
    ctx.beginPath(); ctx.arc(sw.x, sw.y, sw.r+40, 0, Math.PI*2); ctx.fill();
    // Outer glow ring
    ctx.globalAlpha = prog * 0.25;
    ctx.strokeStyle = '#ffdd66'; ctx.lineWidth = 32*prog+sPulse*8;
    ctx.beginPath(); ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI*2); ctx.stroke();
    // Main ring with gradient stroke simulation (triple layer)
    ctx.globalAlpha = prog * 0.5;
    ctx.strokeStyle = '#ddaa44'; ctx.lineWidth = 20*prog+sPulse2*4;
    ctx.beginPath(); ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI*2); ctx.stroke();
    ctx.globalAlpha = prog * 0.75;
    ctx.strokeStyle = '#cc9933'; ctx.lineWidth = 12*prog;
    ctx.beginPath(); ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI*2); ctx.stroke();
    ctx.globalAlpha = prog * 0.9;
    ctx.strokeStyle = '#eebb55'; ctx.lineWidth = 4*prog;
    ctx.beginPath(); ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI*2); ctx.stroke();
    // Inner wave ring
    ctx.globalAlpha = prog * 0.3;
    ctx.strokeStyle = '#bb8833'; ctx.lineWidth = 8*prog;
    ctx.beginPath(); ctx.arc(sw.x, sw.y, sw.r*0.7, 0, Math.PI*2); ctx.stroke();
    // Sand grain texture along ring
    ctx.globalAlpha = prog * 0.5;
    ctx.fillStyle = '#ddaa44';
    for(let sg=0; sg<24; sg++){
      const sa = sg*Math.PI*2/24 + Math.sin(frame*0.04+sg)*0.15;
      const sOff = (Math.sin(frame*0.08+sg*1.7)-0.5)*8;
      const gx = sw.x+Math.cos(sa)*(sw.r+sOff);
      const gy = sw.y+Math.sin(sa)*(sw.r+sOff);
      const gr = 2+Math.random()*2.5+sPulse*1.5;
      ctx.beginPath(); ctx.arc(gx,gy,gr,0,Math.PI*2); ctx.fill();
    }
    // Desert wind streaks radiating outward
    ctx.globalAlpha = prog * 0.2;
    ctx.strokeStyle = '#ccaa55'; ctx.lineWidth = 1.5;
    for(let ws=0; ws<12; ws++){
      const wa = ws*Math.PI*2/12 + frame*0.02;
      const wInner = sw.r - 8;
      const wOuter = sw.r + 15+Math.random()*10;
      ctx.beginPath();
      ctx.moveTo(sw.x+Math.cos(wa)*wInner, sw.y+Math.sin(wa)*wInner);
      ctx.lineTo(sw.x+Math.cos(wa)*wOuter, sw.y+Math.sin(wa)*wOuter);
      ctx.stroke();
    }
    // Triple sand particle emission
    if(frame%4===0){
      const a = Math.random()*Math.PI*2;
      // Main ring particles
      parts.length<400&&parts.push({x:sw.x+Math.cos(a)*sw.r, y:sw.y+Math.sin(a)*sw.r,
        vx:Math.cos(a)*4+Math.random()*2-1, vy:Math.sin(a)*4+Math.random()*2-1,
        r:3+Math.random()*3, color:'#cc9933', life:22, max:22});
      // Dust particles (smaller, slower)
      const a2 = Math.random()*Math.PI*2;
      parts.length<400&&parts.push({x:sw.x+Math.cos(a2)*(sw.r+Math.random()*15), y:sw.y+Math.sin(a2)*(sw.r+Math.random()*15),
        vx:Math.cos(a2)*2+(Math.random()-0.5)*2, vy:Math.sin(a2)*2+(Math.random()-0.5)*2,
        r:1.5+Math.random()*2, color:'#ddbb66', life:28, max:28});
    }
    if(frame%3===0){
      // Inner debris
      const a3 = Math.random()*Math.PI*2;
      const dist = sw.r*(0.3+Math.random()*0.5);
      parts.length<400&&parts.push({x:sw.x+Math.cos(a3)*dist, y:sw.y+Math.sin(a3)*dist,
        vx:Math.cos(a3)*3, vy:Math.sin(a3)*3,
        r:2+Math.random()*2, color:'#aa8822', life:16, max:16});
    }
    ctx.globalAlpha = 1;
  }

  // ── Arena split wall ──
  if(ARENA.splitActive && ARENA.splitFrames > 0){
    const sp = Math.min(1, ARENA.splitFrames/40);
    const nx = Math.cos(ARENA.splitAngle), ny = Math.sin(ARENA.splitAngle);
    const px = -ny, py = nx; // perpendicular = wall direction
    const wallLen = ARENA.r;
    const wPulse = 0.5+0.5*Math.sin(frame*0.18);
    const wPulse2 = 0.5+0.5*Math.cos(frame*0.12);
    const x1 = ACX - px*wallLen, y1 = ACY - py*wallLen;
    const x2 = ACX + px*wallLen, y2 = ACY + py*wallLen;
    // Outermost bloom glow
    ctx.globalAlpha = sp * 0.08;
    ctx.strokeStyle = '#ff0044'; ctx.lineWidth = 50+wPulse*15;
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    // Wide energy glow
    ctx.globalAlpha = sp * 0.18;
    ctx.strokeStyle = '#ff0066'; ctx.lineWidth = 28+wPulse2*8;
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    // Main wall with gradient
    const wallGrad = ctx.createLinearGradient(x1,y1,x2,y2);
    wallGrad.addColorStop(0,'#ff2288'); wallGrad.addColorStop(0.5,'#ff4488'); wallGrad.addColorStop(1,'#ff2288');
    ctx.globalAlpha = sp * 0.75;
    ctx.strokeStyle = wallGrad; ctx.lineWidth = 6+wPulse*2;
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    // Bright core line
    ctx.globalAlpha = sp * 0.9;
    ctx.strokeStyle = '#ffaacc'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
    // Energy crackle perpendicular to wall
    ctx.globalAlpha = sp * 0.3;
    ctx.strokeStyle = '#ff6699'; ctx.lineWidth = 1;
    for(let ec=0; ec<10; ec++){
      const t = ec/10;
      const ecx = x1+(x2-x1)*t, ecy = y1+(y2-y1)*t;
      const jLen = 8+Math.sin(frame*0.2+ec*1.5)*6;
      ctx.beginPath();
      ctx.moveTo(ecx+nx*jLen, ecy+ny*jLen);
      ctx.lineTo(ecx-nx*jLen, ecy-ny*jLen);
      ctx.stroke();
    }
    // Wall-end energy flares
    for(const end of [{x:x1,y:y1},{x:x2,y:y2}]){
      ctx.globalAlpha = sp * 0.35;
      const flGrad = ctx.createRadialGradient(end.x,end.y,0,end.x,end.y,18);
      flGrad.addColorStop(0,'#ffaacc'); flGrad.addColorStop(0.5,'#ff4488'); flGrad.addColorStop(1,'transparent');
      ctx.fillStyle = flGrad;
      ctx.beginPath(); ctx.arc(end.x,end.y,18+wPulse*6,0,Math.PI*2); ctx.fill();
    }
    // Wall particles
    if(frame%3===0){
      const t = Math.random();
      const wpx = x1+(x2-x1)*t, wpy = y1+(y2-y1)*t;
      parts.length<400&&parts.push({x:wpx+nx*(Math.random()-0.5)*10, y:wpy+ny*(Math.random()-0.5)*10,
        vx:nx*(Math.random()-0.5)*4, vy:ny*(Math.random()-0.5)*4,
        r:2+Math.random()*2, color:'#ff4488', life:15, max:15});
    }
    ctx.globalAlpha = 1;
  }

  // ── Arena shrink warning ring ──
  if(ARENA.shrinkFrames > 0 && ARENA.r < AR){
    const prog = 1 - ARENA.shrinkFrames/480;
    const pulse = 0.5 + 0.5*Math.sin(frame*0.18);
    const pulse2 = 0.5 + 0.5*Math.cos(frame*0.13);
    const pulse3 = 0.5 + 0.5*Math.sin(frame*0.25);
    // Outer danger bloom
    ctx.globalAlpha = 0.06+0.04*pulse;
    ctx.strokeStyle = '#ff0000'; ctx.lineWidth = 30+pulse2*15;
    arenaPath(ctx, ARENA.r); ctx.stroke();
    // Warning glow ring
    ctx.globalAlpha = 0.15+0.15*pulse2;
    ctx.strokeStyle = '#ff3300'; ctx.lineWidth = 14+pulse*6;
    arenaPath(ctx, ARENA.r); ctx.stroke();
    // Main pulsing danger ring
    ctx.globalAlpha = (0.35 + 0.45*pulse);
    ctx.strokeStyle = '#ff2200'; ctx.lineWidth = 5+pulse*4;
    arenaPath(ctx, ARENA.r); ctx.stroke();
    // Inner bright edge
    ctx.globalAlpha = 0.5+0.3*pulse3;
    ctx.strokeStyle = '#ff6644'; ctx.lineWidth = 1.5+pulse2;
    arenaPath(ctx, ARENA.r-2); ctx.stroke();
    // Inward-pointing warning chevrons
    ctx.globalAlpha = 0.2+0.15*pulse;
    ctx.strokeStyle = '#ff4422'; ctx.lineWidth = 2;
    for(let ch=0; ch<12; ch++){
      const ca = ch*Math.PI*2/12 + frame*0.03;
      const cx = ACX+Math.cos(ca)*ARENA.r;
      const cy = ACY+Math.sin(ca)*ARENA.r;
      const inX = -Math.cos(ca)*12, inY = -Math.sin(ca)*12;
      const perpX = -Math.sin(ca)*6, perpY = Math.cos(ca)*6;
      ctx.beginPath();
      ctx.moveTo(cx+perpX, cy+perpY);
      ctx.lineTo(cx+inX, cy+inY);
      ctx.lineTo(cx-perpX, cy-perpY);
      ctx.stroke();
    }
    // Danger particles on edge — doubled rate
    if(frame%4===0){
      const a = Math.random()*Math.PI*2;
      parts.length<400&&parts.push({x:ACX+Math.cos(a)*ARENA.r, y:ACY+Math.sin(a)*ARENA.r,
        vx:-Math.cos(a)*2+(Math.random()-0.5)*3, vy:-Math.sin(a)*2+(Math.random()-0.5)*3,
        r:3+Math.random()*3, color:'#ff2200', life:20, max:20});
      // Additional ember particles
      const a2 = Math.random()*Math.PI*2;
      parts.length<400&&parts.push({x:ACX+Math.cos(a2)*ARENA.r, y:ACY+Math.sin(a2)*ARENA.r,
        vx:(Math.random()-0.5)*2, vy:-1-Math.random()*3,
        r:1.5+Math.random()*2, color:'#ff6600', life:15, max:15});
    }
    ctx.globalAlpha = 1;
  }

  // ── Chaos gravity indicator ──
  if(ARENA.chaosFrames > 0){
    const cp = ARENA.chaosFrames/300;
    const chPulse = 0.5+0.5*Math.sin(frame*0.15);
    const chPulse2 = 0.5+0.5*Math.cos(frame*0.1);
    // Swirling edge vignette — multi-layer
    ctx.globalAlpha = 0.06 * cp;
    ctx.fillStyle = '#4400aa';
    ctx.beginPath(); ctx.arc(ACX, ACY, ARENA.r, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 0.1 * cp;
    const vigGrad = ctx.createRadialGradient(ACX,ACY,ARENA.r*0.6,ACX,ACY,ARENA.r);
    vigGrad.addColorStop(0,'transparent'); vigGrad.addColorStop(0.7,'#330088'); vigGrad.addColorStop(1,'#6600cc');
    ctx.fillStyle = vigGrad;
    ctx.beginPath(); ctx.arc(ACX, ACY, ARENA.r, 0, Math.PI*2); ctx.fill();
    // Gravity swirl lines around arena edge
    ctx.globalAlpha = 0.15 * cp;
    ctx.strokeStyle = '#8844ff'; ctx.lineWidth = 1.5;
    for(let sw=0; sw<8; sw++){
      const swa = sw*Math.PI/4 + frame*0.04;
      const swR = ARENA.r*0.85;
      ctx.beginPath();
      ctx.arc(ACX, ACY, swR, swa, swa+0.6);
      ctx.stroke();
    }
    // Rotating arrow showing gravity direction — enhanced
    const arrowLen = 50;
    ctx.save();
    ctx.translate(ACX, ACY);
    ctx.rotate(ARENA.chaosAngle);
    // Arrow glow bloom
    ctx.globalAlpha = cp * 0.15;
    ctx.strokeStyle = '#aa44ff'; ctx.lineWidth = 18+chPulse*8;
    ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(arrowLen+5, 0); ctx.stroke();
    // Arrow mid glow
    ctx.globalAlpha = cp * 0.35;
    ctx.strokeStyle = '#bb66ff'; ctx.lineWidth = 8+chPulse2*3;
    ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(arrowLen, 0); ctx.stroke();
    // Arrow core
    ctx.globalAlpha = 0.6 * cp;
    ctx.strokeStyle = '#cc88ff'; ctx.lineWidth = 3+chPulse;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(arrowLen, 0); ctx.stroke();
    // Arrow bright center line
    ctx.globalAlpha = 0.8 * cp;
    ctx.strokeStyle = '#eeccff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(arrowLen, 0); ctx.stroke();
    // Arrowhead — larger, glowing
    ctx.globalAlpha = cp * 0.25;
    ctx.fillStyle = '#aa44ff';
    ctx.beginPath(); ctx.moveTo(arrowLen+8, 0); ctx.lineTo(arrowLen-14, -12); ctx.lineTo(arrowLen-14, 12); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = cp * 0.7;
    ctx.fillStyle = '#cc88ff';
    ctx.beginPath(); ctx.moveTo(arrowLen, 0); ctx.lineTo(arrowLen-10, -6); ctx.lineTo(arrowLen-10, 6); ctx.closePath(); ctx.fill();
    // Energy crackle along arrow
    ctx.globalAlpha = cp * 0.3;
    ctx.strokeStyle = '#ddaaff'; ctx.lineWidth = 0.8;
    for(let ec=0; ec<5; ec++){
      const et = ec/5;
      const ecx = et*arrowLen;
      const jy = Math.sin(frame*0.3+ec*2)*6;
      ctx.beginPath(); ctx.moveTo(ecx, jy); ctx.lineTo(ecx+5, -jy); ctx.stroke();
    }
    ctx.restore();
    // Gravity field particles — spiraling inward in gravity direction
    if(frame%3===0){
      const gAngle = ARENA.chaosAngle + (Math.random()-0.5)*1.0;
      const dist = 30+Math.random()*ARENA.r*0.5;
      parts.length<400&&parts.push({x:ACX-Math.cos(ARENA.chaosAngle)*dist+(Math.random()-0.5)*40,
        y:ACY-Math.sin(ARENA.chaosAngle)*dist+(Math.random()-0.5)*40,
        vx:Math.cos(gAngle)*3, vy:Math.sin(gAngle)*3,
        r:2+Math.random()*2, color:Math.random()>0.5?'#aa44ff':'#7722cc', life:20, max:20});
    }
    ctx.globalAlpha = 1;
  }

  // ── Drago Nova explosion + shards ──
  if(FX.dragoNova){
    const dn=FX.dragoNova, prog=dn.life/dn.max;
    const dnP=0.5+0.5*Math.sin(frame*0.15), dnP2=0.5+0.5*Math.cos(frame*0.22);
    if(prog>0.85){ctx.globalAlpha=(prog-0.85)*6.6*0.4;const dnBl=ctx.createRadialGradient(dn.x,dn.y,0,dn.x,dn.y,dn.r*3);dnBl.addColorStop(0,'rgba(255,255,200,0.7)');dnBl.addColorStop(0.3,'rgba(255,200,50,0.3)');dnBl.addColorStop(1,'rgba(255,100,0,0)');ctx.fillStyle=dnBl;ctx.beginPath();ctx.arc(dn.x,dn.y,dn.r*3,0,Math.PI*2);ctx.fill();}
    ctx.globalAlpha=prog*0.22;const dnOg=ctx.createRadialGradient(dn.x,dn.y,dn.r*0.4,dn.x,dn.y,dn.r*1.6);dnOg.addColorStop(0,'rgba(255,180,0,0.5)');dnOg.addColorStop(0.5,'rgba(255,100,0,0.2)');dnOg.addColorStop(1,'rgba(200,50,0,0)');ctx.fillStyle=dnOg;ctx.beginPath();ctx.arc(dn.x,dn.y,dn.r*1.6,0,Math.PI*2);ctx.fill();
    ctx.globalAlpha=prog*0.7;ctx.strokeStyle='#ffdd00';ctx.lineWidth=10+4*dnP;ctx.beginPath();ctx.arc(dn.x,dn.y,dn.r,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='#ff8800';ctx.lineWidth=5+2*dnP2;ctx.globalAlpha=prog*0.5;ctx.beginPath();ctx.arc(dn.x,dn.y,dn.r*0.85,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='#ffffff';ctx.lineWidth=3;ctx.globalAlpha=prog*0.6;ctx.beginPath();ctx.arc(dn.x,dn.y,dn.r*0.7,0,Math.PI*2);ctx.stroke();
    ctx.globalAlpha=prog*0.5;ctx.strokeStyle='#ffee66';ctx.lineWidth=1.5+dnP;for(let dnc=0;dnc<8;dnc++){const dca=dnc*Math.PI/4+frame*0.03;ctx.beginPath();ctx.moveTo(dn.x+Math.cos(dca)*dn.r*0.3,dn.y+Math.sin(dca)*dn.r*0.3);ctx.lineTo(dn.x+Math.cos(dca+0.12)*dn.r*0.55+Math.sin(frame*0.4+dnc)*9,dn.y+Math.sin(dca+0.12)*dn.r*0.55+Math.cos(frame*0.35+dnc)*9);ctx.lineTo(dn.x+Math.cos(dca-0.05)*dn.r*0.75+Math.cos(frame*0.5+dnc)*6,dn.y+Math.sin(dca-0.05)*dn.r*0.75+Math.sin(frame*0.45+dnc)*6);ctx.lineTo(dn.x+Math.cos(dca)*dn.r*0.97,dn.y+Math.sin(dca)*dn.r*0.97);ctx.stroke();}
    for(const sh of dn.shards){if(sh.hit||sh.life<=0) continue;const sp=sh.life/sh.max;ctx.globalAlpha=sp*0.2;const dnTr=ctx.createRadialGradient(sh.x-sh.vx*2,sh.y-sh.vy*2,0,sh.x-sh.vx*2,sh.y-sh.vy*2,18);dnTr.addColorStop(0,'rgba(255,200,0,0.5)');dnTr.addColorStop(1,'rgba(255,100,0,0)');ctx.fillStyle=dnTr;ctx.beginPath();ctx.arc(sh.x-sh.vx*2,sh.y-sh.vy*2,18,0,Math.PI*2);ctx.fill();ctx.globalAlpha=sp*0.1;ctx.beginPath();ctx.arc(sh.x-sh.vx*4,sh.y-sh.vy*4,14,0,Math.PI*2);ctx.fill();ctx.globalAlpha=sp;const grad=ctx.createRadialGradient(sh.x,sh.y,0,sh.x,sh.y,22);grad.addColorStop(0,'#ffffff');grad.addColorStop(0.2,'#ffffcc');grad.addColorStop(0.5,'#ffee44');grad.addColorStop(1,'rgba(255,180,0,0)');ctx.fillStyle=grad;ctx.beginPath();ctx.arc(sh.x,sh.y,22,0,Math.PI*2);ctx.fill();ctx.globalAlpha=sp*0.35;const dnHl=ctx.createRadialGradient(sh.x,sh.y,14,sh.x,sh.y,32);dnHl.addColorStop(0,'rgba(255,180,0,0.3)');dnHl.addColorStop(1,'rgba(255,80,0,0)');ctx.fillStyle=dnHl;ctx.beginPath();ctx.arc(sh.x,sh.y,32,0,Math.PI*2);ctx.fill();parts.length<400&&parts.push({x:sh.x,y:sh.y,vx:(Math.random()-0.5)*3,vy:(Math.random()-0.5)*3,r:6,color:Math.random()<0.5?'#ffcc00':'#ff8800',life:16,max:16});if(frame%4===0) parts.length<400&&parts.push({x:sh.x+(Math.random()-0.5)*6,y:sh.y+(Math.random()-0.5)*6,vx:(Math.random()-0.5)*5,vy:(Math.random()-0.5)*5,r:3,color:'#ffffff',life:10,max:10});}
    ctx.globalAlpha=1;
  }

  // ── Megiddo divine beams ──
  for(const mb of FX.megiddoBeams){if(mb.delay>0) continue;const prog=mb.life/mb.max;const beamH=H*prog;const mbPulse=0.5+0.5*Math.sin(frame*0.25+mb.x*0.01);ctx.globalAlpha=Math.min(1,prog*3)*0.25;const mbWide=ctx.createLinearGradient(mb.x-30,0,mb.x+30,0);mbWide.addColorStop(0,'rgba(255,255,150,0)');mbWide.addColorStop(0.5,'rgba(255,255,180,0.4)');mbWide.addColorStop(1,'rgba(255,255,150,0)');ctx.fillStyle=mbWide;ctx.fillRect(mb.x-30,0,60,mb.y);ctx.globalAlpha=Math.min(1,prog*3)*0.8;const grad=ctx.createLinearGradient(mb.x,0,mb.x,mb.y);grad.addColorStop(0,'rgba(255,255,200,0)');grad.addColorStop(0.4,'rgba(255,255,160,0.6)');grad.addColorStop(0.7,'rgba(255,255,180,0.9)');grad.addColorStop(1,'rgba(255,255,255,1)');ctx.strokeStyle=grad;ctx.lineWidth=14+Math.sin(frame*0.3)*5+mbPulse*4;ctx.beginPath();ctx.moveTo(mb.x,0);ctx.lineTo(mb.x,mb.y);ctx.stroke();ctx.globalAlpha=Math.min(1,prog*3)*0.5;ctx.strokeStyle='#ffffff';ctx.lineWidth=4+mbPulse*2;ctx.beginPath();ctx.moveTo(mb.x,0);ctx.lineTo(mb.x,mb.y);ctx.stroke();ctx.globalAlpha=prog*0.9;const mbImp=ctx.createRadialGradient(mb.x,mb.y,0,mb.x,mb.y,40+mbPulse*10);mbImp.addColorStop(0,'rgba(255,255,255,0.9)');mbImp.addColorStop(0.3,'rgba(255,255,200,0.5)');mbImp.addColorStop(1,'rgba(255,255,150,0)');ctx.fillStyle=mbImp;ctx.beginPath();ctx.arc(mb.x,mb.y,40+mbPulse*10,0,Math.PI*2);ctx.fill();ctx.globalAlpha=prog*0.6;ctx.strokeStyle='#ffffcc';ctx.lineWidth=2;ctx.beginPath();ctx.arc(mb.x,mb.y,25+Math.sin(frame*0.2)*8,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=prog*0.5;ctx.strokeStyle='#ffffdd';ctx.lineWidth=2;const mbCross=18+mbPulse*6;ctx.beginPath();ctx.moveTo(mb.x-mbCross,mb.y);ctx.lineTo(mb.x+mbCross,mb.y);ctx.stroke();ctx.beginPath();ctx.moveTo(mb.x,mb.y-mbCross);ctx.lineTo(mb.x,mb.y+mbCross);ctx.stroke();if(frame%4===0) parts.length<400&&parts.push({x:mb.x+(Math.random()-0.5)*24,y:mb.y+(Math.random()-0.5)*24,vx:(Math.random()-0.5)*4,vy:-Math.random()*4,r:6,color:'#ffffaa',life:18,max:18});parts.length<400&&parts.push({x:mb.x+(Math.random()-0.5)*10,y:mb.y,vx:(Math.random()-0.5)*2,vy:-1-Math.random()*2,r:3,color:'#ffffff',life:12,max:12});}
  ctx.globalAlpha=1;

  // ── Veldora storm ──
  if(FX.veldoraStorm){const vs=FX.veldoraStorm,prog=vs.life/vs.max;const vsP=0.5+0.5*Math.sin(frame*0.1);ctx.save();ctx.globalAlpha=prog*0.35;const vsEye=ctx.createRadialGradient(vs.x,vs.y,0,vs.x,vs.y,vs.r*0.25);vsEye.addColorStop(0,'rgba(0,0,30,0.8)');vsEye.addColorStop(1,'rgba(0,10,60,0)');ctx.fillStyle=vsEye;ctx.beginPath();ctx.arc(vs.x,vs.y,vs.r*0.25,0,Math.PI*2);ctx.fill();ctx.globalAlpha=prog*0.22;const vsBody=ctx.createRadialGradient(vs.x,vs.y,vs.r*0.2,vs.x,vs.y,vs.r);vsBody.addColorStop(0,'rgba(0,20,80,0.6)');vsBody.addColorStop(0.5,'rgba(0,30,180,0.3)');vsBody.addColorStop(1,'rgba(0,10,100,0)');ctx.fillStyle=vsBody;ctx.beginPath();ctx.arc(vs.x,vs.y,vs.r,0,Math.PI*2);ctx.fill();ctx.globalAlpha=prog*0.55;for(let arm=0;arm<6;arm++){const aOff=arm*Math.PI*2/6;ctx.strokeStyle=arm%3===0?'#3355ff':arm%3===1?'#6699ff':'#ffffff';ctx.lineWidth=2+2*(arm%2)+vsP*2;ctx.beginPath();for(let t=0;t<vs.r;t+=5){const a=vs.angle+aOff+t*0.045;const wobble=Math.sin(frame*0.15+t*0.03)*4;const xp=vs.x+Math.cos(a)*(t+wobble),yp=vs.y+Math.sin(a)*(t+wobble);t===0?ctx.moveTo(xp,yp):ctx.lineTo(xp,yp);}ctx.stroke();}ctx.globalAlpha=prog*0.6;ctx.strokeStyle='#aaccff';ctx.lineWidth=1.5;for(let bolt=0;bolt<4;bolt++){const ba=vs.angle+bolt*Math.PI/2+frame*0.05;ctx.beginPath();let bx=vs.x+Math.cos(ba)*vs.r*0.15,by=vs.y+Math.sin(ba)*vs.r*0.15;ctx.moveTo(bx,by);for(let seg=0;seg<5;seg++){bx+=Math.cos(ba+Math.sin(frame*0.3+seg)*0.5)*vs.r*0.15+(Math.random()-0.5)*12;by+=Math.sin(ba+Math.sin(frame*0.3+seg)*0.5)*vs.r*0.15+(Math.random()-0.5)*12;ctx.lineTo(bx,by);}ctx.stroke();}ctx.globalAlpha=prog*0.6;ctx.strokeStyle='#6699ff';ctx.lineWidth=7+vsP*3;ctx.beginPath();ctx.arc(vs.x,vs.y,vs.r,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='#99bbff';ctx.lineWidth=2;ctx.globalAlpha=prog*0.3;ctx.beginPath();ctx.arc(vs.x,vs.y,vs.r*1.08,0,Math.PI*2);ctx.stroke();ctx.restore();if(frame%4===0){const a=Math.random()*Math.PI*2;parts.length<400&&parts.push({x:vs.x+Math.cos(a)*vs.r,y:vs.y+Math.sin(a)*vs.r,vx:-Math.sin(a)*6,vy:Math.cos(a)*6,r:7,color:'#3355ff',life:28,max:28});parts.length<400&&parts.push({x:vs.x+Math.cos(a+1)*vs.r*0.6,y:vs.y+Math.sin(a+1)*vs.r*0.6,vx:-Math.sin(a+1)*4,vy:Math.cos(a+1)*4,r:4,color:'#aaccff',life:18,max:18});}ctx.globalAlpha=1;}

  // ── Prominence dragon ──
  if(FX.prominenceDragon){const pd=FX.prominenceDragon,prog=pd.life/pd.max;const coneLen=160*pd.size,coneW=0.85;const pdP=0.5+0.5*Math.sin(frame*0.18);ctx.save();ctx.translate(pd.x,pd.y);ctx.rotate(pd.angle);ctx.globalAlpha=prog*0.2;const pdHaze=ctx.createLinearGradient(0,0,coneLen*1.2,0);pdHaze.addColorStop(0,'rgba(255,100,0,0.3)');pdHaze.addColorStop(0.5,'rgba(255,50,0,0.15)');pdHaze.addColorStop(1,'rgba(100,0,0,0)');ctx.fillStyle=pdHaze;ctx.beginPath();ctx.moveTo(-10,0);ctx.lineTo(coneLen*1.15*Math.cos(coneW*1.2),coneLen*1.15*Math.sin(coneW*1.2));ctx.quadraticCurveTo(coneLen*1.3,0,coneLen*1.15*Math.cos(-coneW*1.2),coneLen*1.15*Math.sin(-coneW*1.2));ctx.closePath();ctx.fill();ctx.globalAlpha=prog*0.8;const g=ctx.createLinearGradient(0,0,coneLen,0);g.addColorStop(0,'rgba(255,255,100,0.95)');g.addColorStop(0.15,'rgba(255,80,20,0.9)');g.addColorStop(0.4,'rgba(220,20,60,0.7)');g.addColorStop(0.7,'rgba(180,0,30,0.4)');g.addColorStop(1,'rgba(100,0,0,0)');ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(coneLen*Math.cos(coneW),coneLen*Math.sin(coneW));ctx.quadraticCurveTo(coneLen*1.1,0,coneLen*Math.cos(-coneW),coneLen*Math.sin(-coneW));ctx.closePath();ctx.fill();ctx.globalAlpha=prog*0.65;ctx.strokeStyle='#ffaa00';ctx.lineWidth=4+pdP*2;ctx.beginPath();for(let seg=0;seg<coneLen;seg+=8){const wave=Math.sin(frame*0.2+seg*0.05)*12*(seg/coneLen);seg===0?ctx.moveTo(seg,wave):ctx.lineTo(seg,wave);}ctx.stroke();ctx.strokeStyle='#ff4400';ctx.lineWidth=2;ctx.globalAlpha=prog*0.4;ctx.beginPath();for(let seg=0;seg<coneLen;seg+=8){const wave=Math.sin(frame*0.2+seg*0.05+1)*8*(seg/coneLen);seg===0?ctx.moveTo(seg,wave):ctx.lineTo(seg,wave);}ctx.stroke();ctx.globalAlpha=prog*0.9;ctx.strokeStyle='#ffffff';ctx.lineWidth=6+pdP*3;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(coneLen*0.5,0);ctx.stroke();ctx.strokeStyle='#ffffaa';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(coneLen*0.8,0);ctx.stroke();ctx.restore();if(frame%4===0){const spread=(Math.random()-0.5)*coneW*0.8;const dist=40+Math.random()*coneLen;parts.length<400&&parts.push({x:pd.x+Math.cos(pd.angle+spread)*dist,y:pd.y+Math.sin(pd.angle+spread)*dist,vx:(Math.random()-0.5)*5,vy:(Math.random()-0.5)*5-2,r:7,color:Math.random()<0.3?'#ffff44':Math.random()<0.5?'#dc143c':'#ff6600',life:22,max:22});}if(frame%3===0) parts.length<400&&parts.push({x:pd.x,y:pd.y,vx:(Math.random()-0.5)*3,vy:(Math.random()-0.5)*3,r:10,color:'#ffaa00',life:14,max:14});ctx.globalAlpha=1;}

  // ── Diablo vortex ──
  if(FX.diabloVortex){const dv=FX.diabloVortex,prog=dv.life/dv.max;const dvP=0.5+0.5*Math.sin(frame*0.12),dvP2=0.5+0.5*Math.cos(frame*0.18);ctx.save();ctx.globalAlpha=prog*0.3;const grd=ctx.createRadialGradient(dv.x,dv.y,0,dv.x,dv.y,dv.r*1.2);grd.addColorStop(0,'rgba(40,0,60,0.9)');grd.addColorStop(0.3,'rgba(120,0,220,0.6)');grd.addColorStop(0.6,'rgba(60,0,110,0.3)');grd.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=grd;ctx.beginPath();ctx.arc(dv.x,dv.y,dv.r*1.2,0,Math.PI*2);ctx.fill();ctx.globalAlpha=prog*0.5;const dvCore=ctx.createRadialGradient(dv.x,dv.y,0,dv.x,dv.y,dv.r*0.2);dvCore.addColorStop(0,'rgba(0,0,0,0.8)');dvCore.addColorStop(1,'rgba(60,0,120,0)');ctx.fillStyle=dvCore;ctx.beginPath();ctx.arc(dv.x,dv.y,dv.r*0.2,0,Math.PI*2);ctx.fill();ctx.globalAlpha=prog*0.65;for(let ri=0;ri<5;ri++){ctx.strokeStyle=ri%3===0?'#cc44ff':ri%3===1?'#8800cc':'#ffffff';ctx.lineWidth=(ri===4?1.5:ri%2===0?5+dvP*2:3+dvP2);const rOffset=frame*0.04*(ri%2===0?1:-0.7)+ri*0.8;ctx.beginPath();ctx.arc(dv.x,dv.y,dv.r*(0.25+ri*0.16),rOffset,rOffset+Math.PI*(1.2+0.3*dvP));ctx.stroke();}ctx.globalAlpha=prog*0.4;ctx.strokeStyle='#dd88ff';ctx.lineWidth=1.5;for(let tn=0;tn<6;tn++){const ta=tn*Math.PI/3+frame*0.02;ctx.beginPath();ctx.moveTo(dv.x,dv.y);let tx=dv.x,ty=dv.y;for(let ts=0;ts<4;ts++){tx+=Math.cos(ta+Math.sin(frame*0.2+ts)*0.6)*dv.r*0.2+(Math.random()-0.5)*8;ty+=Math.sin(ta+Math.sin(frame*0.2+ts)*0.6)*dv.r*0.2+(Math.random()-0.5)*8;ctx.lineTo(tx,ty);}ctx.stroke();}ctx.restore();if(frame%4===0){const a=Math.random()*Math.PI*2;const dist=dv.r*(0.5+Math.random()*0.5);parts.length<400&&parts.push({x:dv.x+Math.cos(a)*dist,y:dv.y+Math.sin(a)*dist,vx:(dv.x-(dv.x+Math.cos(a)*dist))*0.08-Math.sin(a)*2+(Math.random()-0.5)*2,vy:(dv.y-(dv.y+Math.sin(a)*dist))*0.08+Math.cos(a)*2+(Math.random()-0.5)*2,r:6,color:Math.random()<0.5?'#aa00ff':'#dd88ff',life:22,max:22});}ctx.globalAlpha=1;}

  // ── Chainsaw Rev ──
  if(FX.chainsawRev){const cr=FX.chainsawRev,prog=cr.life/cr.max;const crP=0.5+0.5*Math.sin(frame*0.3);ctx.globalAlpha=prog*0.2;const crGlow=ctx.createRadialGradient(cr.x,cr.y,0,cr.x,cr.y,100);crGlow.addColorStop(0,'rgba(255,50,0,0.5)');crGlow.addColorStop(0.5,'rgba(200,0,0,0.2)');crGlow.addColorStop(1,'rgba(100,0,0,0)');ctx.fillStyle=crGlow;ctx.beginPath();ctx.arc(cr.x,cr.y,100,0,Math.PI*2);ctx.fill();for(let si=0;si<cr.spokes.length;si++){const ang=cr.angle+si*Math.PI/2;const sx=cr.x+Math.cos(ang)*70,sy=cr.y+Math.sin(ang)*70;ctx.globalAlpha=prog*0.25;const trAng=ang-0.3;const tsx=cr.x+Math.cos(trAng)*70,tsy=cr.y+Math.sin(trAng)*70;ctx.fillStyle='rgba(255,100,0,0.3)';ctx.beginPath();ctx.moveTo(cr.x,cr.y);ctx.lineTo(tsx,tsy);ctx.lineTo(sx,sy);ctx.closePath();ctx.fill();ctx.save();ctx.translate(sx,sy);ctx.rotate(ang+Math.PI/4);ctx.globalAlpha=prog*0.35;ctx.fillStyle='rgba(255,80,0,0.5)';ctx.fillRect(-10,-28,20,56);ctx.globalAlpha=prog*0.9;ctx.fillStyle='#ff2200';ctx.fillRect(-6,-24,12,48);ctx.fillStyle='#ffaa00';ctx.fillRect(-3,-24,6,48);ctx.fillStyle='#ffffff';for(let t=0;t<5;t++){ctx.fillRect(-8+t*3.5,-26,3,6);}ctx.globalAlpha=prog*0.6*crP;ctx.fillStyle='#ffffff';ctx.fillRect(-1,-24,2,48);ctx.restore();ctx.globalAlpha=prog*0.3;ctx.strokeStyle='#ff8800';ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(cr.x,cr.y);ctx.lineTo(sx,sy);ctx.stroke();ctx.globalAlpha=prog*0.7;ctx.strokeStyle='#ff4400';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(cr.x,cr.y);ctx.lineTo(sx,sy);ctx.stroke();ctx.globalAlpha=prog*0.4;ctx.strokeStyle='#ffcc00';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(cr.x,cr.y);ctx.lineTo(sx,sy);ctx.stroke();if(frame%4===0) parts.length<400&&parts.push({x:sx,y:sy,vx:Math.cos(ang)*4+(Math.random()-0.5)*6,vy:Math.sin(ang)*4+(Math.random()-0.5)*6,r:4,color:'#ffaa00',life:10,max:10});}ctx.globalAlpha=prog*0.5;const cg=ctx.createRadialGradient(cr.x,cr.y,0,cr.x,cr.y,50);cg.addColorStop(0,'rgba(255,200,50,0.9)');cg.addColorStop(0.4,'rgba(255,80,0,0.5)');cg.addColorStop(1,'rgba(255,0,0,0)');ctx.fillStyle=cg;ctx.beginPath();ctx.arc(cr.x,cr.y,50,0,Math.PI*2);ctx.fill();ctx.globalAlpha=prog*0.4*crP;ctx.strokeStyle='#ffcc00';ctx.lineWidth=2;ctx.beginPath();ctx.arc(cr.x,cr.y,25+crP*10,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;}

  // ── Blood spears ──
  for(const sp of FX.bloodSpears){const prog=sp.life/sp.max;const bsP=0.5+0.5*Math.sin(frame*0.2+sp.x*0.01);ctx.save();ctx.translate(sp.x,sp.y);ctx.rotate(Math.PI/2);ctx.globalAlpha=prog*0.25;const bsMist=ctx.createRadialGradient(0,20,0,0,20,20);bsMist.addColorStop(0,'rgba(200,0,30,0.4)');bsMist.addColorStop(1,'rgba(100,0,15,0)');ctx.fillStyle=bsMist;ctx.beginPath();ctx.arc(0,20,20,0,Math.PI*2);ctx.fill();ctx.globalAlpha=prog*0.4;ctx.fillStyle='#ff2244';ctx.beginPath();ctx.moveTo(0,-24);ctx.lineTo(8,18);ctx.lineTo(-8,18);ctx.closePath();ctx.fill();ctx.globalAlpha=prog*0.9;ctx.fillStyle='#cc0022';ctx.beginPath();ctx.moveTo(0,-22);ctx.lineTo(5,15);ctx.lineTo(-5,15);ctx.closePath();ctx.fill();ctx.fillStyle='#ff4455';ctx.fillRect(-2,-22,4,32);ctx.globalAlpha=prog*0.6*bsP;ctx.fillStyle='#ffaaaa';ctx.fillRect(-0.5,-20,1,28);ctx.restore();parts.length<400&&parts.push({x:sp.x+(Math.random()-0.5)*4,y:sp.y,vx:(Math.random()-0.5)*2,vy:-Math.random()*3,r:5,color:'#cc0022',life:14,max:14});if(frame%4===0) parts.length<400&&parts.push({x:sp.x,y:sp.y+(Math.random()-0.5)*10,vx:(Math.random()-0.5)*3,vy:(Math.random()-0.5)*3,r:3,color:'#ff2244',life:10,max:10});ctx.globalAlpha=1;}

  // ── Makima chains ──
  for(const mc of FX.makimaChains){const prog=mc.extend;const ex=mc.ox+(mc.tx-mc.ox)*prog,ey=mc.oy+(mc.ty-mc.oy)*prog;const mcP=0.5+0.5*Math.sin(frame*0.15);const mcAlpha=Math.min(1,mc.life/20);ctx.globalAlpha=mcAlpha*0.2;ctx.strokeStyle='#440000';ctx.lineWidth=18;ctx.beginPath();ctx.moveTo(mc.ox,mc.oy);ctx.lineTo(ex,ey);ctx.stroke();ctx.globalAlpha=mcAlpha*0.85;ctx.strokeStyle='#880000';ctx.lineWidth=5+mcP;ctx.setLineDash([14,5]);ctx.beginPath();ctx.moveTo(mc.ox,mc.oy);ctx.lineTo(ex,ey);ctx.stroke();ctx.setLineDash([]);ctx.strokeStyle='#cc2222';ctx.lineWidth=3;ctx.globalAlpha=mcAlpha*0.6;ctx.setLineDash([8,8]);ctx.beginPath();ctx.moveTo(mc.ox,mc.oy);ctx.lineTo(ex,ey);ctx.stroke();ctx.setLineDash([]);ctx.strokeStyle='#ff6666';ctx.lineWidth=1.5;ctx.globalAlpha=mcAlpha*0.4;ctx.beginPath();ctx.moveTo(mc.ox,mc.oy);ctx.lineTo(ex,ey);ctx.stroke();ctx.globalAlpha=mcAlpha*0.7;const mcDist=Math.hypot(ex-mc.ox,ey-mc.oy);for(let cl=0;cl<mcDist;cl+=24){const t=cl/mcDist;const cx=mc.ox+(ex-mc.ox)*t,cy=mc.oy+(ey-mc.oy)*t;ctx.fillStyle='#aa1111';ctx.beginPath();ctx.arc(cx,cy,3.5,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=mcAlpha*0.5;const mcTip=ctx.createRadialGradient(ex,ey,0,ex,ey,15);mcTip.addColorStop(0,'rgba(255,50,50,0.6)');mcTip.addColorStop(1,'rgba(200,0,0,0)');ctx.fillStyle=mcTip;ctx.beginPath();ctx.arc(ex,ey,15,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;}

  // ── Future Devil aura ──
  if(FX.futureDevil){const fd=FX.futureDevil,prog=fd.life/fd.max;const owner=_G.balls.find(b=>b.id===fd.ownerId&&b.alive);if(owner){const pulse=0.5+0.5*Math.sin(frame*0.12);const pulse2=0.5+0.5*Math.cos(frame*0.08);ctx.globalAlpha=prog*0.12;const fdOuter=ctx.createRadialGradient(owner.x,owner.y,60,owner.x,owner.y,120);fdOuter.addColorStop(0,'rgba(136,68,255,0.3)');fdOuter.addColorStop(1,'rgba(40,0,80,0)');ctx.fillStyle=fdOuter;ctx.beginPath();ctx.arc(owner.x,owner.y,120,0,Math.PI*2);ctx.fill();ctx.globalAlpha=prog*(0.35+0.25*pulse);const fg=ctx.createRadialGradient(owner.x,owner.y,0,owner.x,owner.y,85);fg.addColorStop(0,'rgba(180,100,255,0.9)');fg.addColorStop(0.4,'rgba(136,68,255,0.5)');fg.addColorStop(1,'rgba(68,0,136,0)');ctx.fillStyle=fg;ctx.beginPath();ctx.arc(owner.x,owner.y,85,0,Math.PI*2);ctx.fill();ctx.globalAlpha=prog*0.35;ctx.strokeStyle='#cc88ff';ctx.lineWidth=1.5;for(let cm=0;cm<12;cm++){const ca=cm*Math.PI/6+frame*0.02;ctx.beginPath();ctx.moveTo(owner.x+Math.cos(ca)*55,owner.y+Math.sin(ca)*55);ctx.lineTo(owner.x+Math.cos(ca)*70,owner.y+Math.sin(ca)*70);ctx.stroke();}ctx.globalAlpha=prog*0.5;ctx.strokeStyle='#eeccff';ctx.lineWidth=2;const handA=frame*0.06;ctx.beginPath();ctx.moveTo(owner.x,owner.y);ctx.lineTo(owner.x+Math.cos(handA)*50,owner.y+Math.sin(handA)*50);ctx.stroke();ctx.globalAlpha=prog*0.8;const fdEyeG=ctx.createRadialGradient(owner.x,owner.y-owner.r-22,0,owner.x,owner.y-owner.r-22,18);fdEyeG.addColorStop(0,'rgba(220,160,255,0.8)');fdEyeG.addColorStop(1,'rgba(136,68,255,0)');ctx.fillStyle=fdEyeG;ctx.beginPath();ctx.arc(owner.x,owner.y-owner.r-22,18,0,Math.PI*2);ctx.fill();ctx.fillStyle='#cc88ff';ctx.beginPath();ctx.ellipse(owner.x,owner.y-owner.r-22,16+pulse2*3,9+pulse*2,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#220044';ctx.beginPath();ctx.arc(owner.x,owner.y-owner.r-22,5,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ffffff';ctx.globalAlpha=prog*0.9;ctx.beginPath();ctx.arc(owner.x-2,owner.y-owner.r-24,1.5,0,Math.PI*2);ctx.fill();if(frame%3===0) parts.length<400&&parts.push({x:owner.x+(Math.random()-0.5)*60,y:owner.y+(Math.random()-0.5)*60,vx:(Math.random()-0.5)*2,vy:-1-Math.random(),r:3,color:'#cc88ff',life:18,max:18});}ctx.globalAlpha=1;}

  // ── Pochita core ──
  if(FX.pochitaCore){const pc=FX.pochitaCore,prog=pc.life/pc.max;const pcP=0.5+0.5*Math.sin(frame*0.13),pcP2=0.5+0.5*Math.cos(frame*0.19);ctx.globalAlpha=prog*0.2;const pcBloom=ctx.createRadialGradient(pc.x,pc.y,pc.r*0.5,pc.x,pc.y,pc.r*1.5);pcBloom.addColorStop(0,'rgba(255,120,0,0.4)');pcBloom.addColorStop(0.5,'rgba(255,60,0,0.15)');pcBloom.addColorStop(1,'rgba(200,30,0,0)');ctx.fillStyle=pcBloom;ctx.beginPath();ctx.arc(pc.x,pc.y,pc.r*1.5,0,Math.PI*2);ctx.fill();ctx.globalAlpha=prog*0.8;ctx.strokeStyle='#ff6600';ctx.lineWidth=12+pcP*4;ctx.beginPath();ctx.arc(pc.x,pc.y,pc.r,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='#ffaa00';ctx.lineWidth=5+pcP2*2;ctx.globalAlpha=prog*0.55;ctx.beginPath();ctx.arc(pc.x,pc.y,pc.r*0.72,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='#ffdd44';ctx.lineWidth=3;ctx.globalAlpha=prog*0.4;ctx.beginPath();ctx.arc(pc.x,pc.y,pc.r*0.45,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='#ffffff';ctx.lineWidth=1.5;ctx.globalAlpha=prog*0.3;ctx.beginPath();ctx.arc(pc.x,pc.y,pc.r*0.25,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=prog*0.4;ctx.strokeStyle='#ffcc44';ctx.lineWidth=1.5;for(let pca=0;pca<6;pca++){const pcAng=pca*Math.PI/3+frame*0.04;ctx.beginPath();ctx.moveTo(pc.x+Math.cos(pcAng)*pc.r*0.45,pc.y+Math.sin(pcAng)*pc.r*0.45);ctx.quadraticCurveTo(pc.x+Math.cos(pcAng+0.2)*pc.r*0.7+Math.sin(frame*0.3+pca)*8,pc.y+Math.sin(pcAng+0.2)*pc.r*0.7+Math.cos(frame*0.3+pca)*8,pc.x+Math.cos(pcAng)*pc.r,pc.y+Math.sin(pcAng)*pc.r);ctx.stroke();}if(frame%4===0){const a=Math.random()*Math.PI*2;parts.length<400&&parts.push({x:pc.x+Math.cos(a)*pc.r,y:pc.y+Math.sin(a)*pc.r,vx:Math.cos(a)*7,vy:Math.sin(a)*7,r:8,color:'#ff6600',life:20,max:20});}if(frame%3===0) parts.length<400&&parts.push({x:pc.x+(Math.random()-0.5)*pc.r,y:pc.y+(Math.random()-0.5)*pc.r,vx:(Math.random()-0.5)*4,vy:(Math.random()-0.5)*4,r:5,color:'#ffaa00',life:14,max:14});ctx.globalAlpha=1;}

  // ── Serious Punch ──
  if(FX.seriousPunch){const sp=FX.seriousPunch,prog=sp.life/sp.max;const spP=0.5+0.5*Math.sin(frame*0.2);if(prog>0.8){ctx.globalAlpha=(prog-0.8)*5*0.35;ctx.fillStyle='rgba(255,255,200,0.4)';ctx.fillRect(0,0,W,H);}ctx.save();ctx.translate(sp.x,sp.y);ctx.rotate(sp.ang);ctx.globalAlpha=prog*0.25;ctx.beginPath();ctx.moveTo(-sp.r*0.5,0);ctx.lineTo(sp.r*3.5,sp.r*2);ctx.lineTo(sp.r*3.5,-sp.r*2);ctx.closePath();const spDistG=ctx.createLinearGradient(0,0,sp.r*3,0);spDistG.addColorStop(0,'rgba(255,255,200,0.3)');spDistG.addColorStop(1,'rgba(255,255,100,0)');ctx.fillStyle=spDistG;ctx.fill();ctx.globalAlpha=prog*0.95;const sgr=ctx.createRadialGradient(0,0,0,0,0,sp.r*1.2);sgr.addColorStop(0,'rgba(255,255,255,1)');sgr.addColorStop(0.2,'rgba(255,255,180,0.9)');sgr.addColorStop(0.5,'rgba(255,255,80,0.5)');sgr.addColorStop(1,'rgba(255,200,0,0)');ctx.fillStyle=sgr;ctx.beginPath();ctx.arc(0,0,sp.r*1.2,0,Math.PI*2);ctx.fill();ctx.globalAlpha=prog*0.5;ctx.strokeStyle='rgba(255,255,220,0.6)';ctx.lineWidth=2;for(let sr=1;sr<=3;sr++){ctx.beginPath();ctx.arc(sp.r*0.8*sr,0,20+sr*10,0,Math.PI*2);ctx.stroke();}ctx.strokeStyle='#ffffff';ctx.lineWidth=4+spP*2;ctx.globalAlpha=prog*0.8;for(let li=-5;li<=5;li++){ctx.beginPath();ctx.moveTo(-sp.r*0.3,li*12);ctx.lineTo(sp.r*3,li*20+Math.sin(frame*0.3+li)*5);ctx.stroke();}ctx.strokeStyle='#ffffaa';ctx.lineWidth=1.5;ctx.globalAlpha=prog*0.5;for(let li=-8;li<=8;li++){ctx.beginPath();ctx.moveTo(sp.r*0.5,li*8);ctx.lineTo(sp.r*4,li*12);ctx.stroke();}ctx.globalAlpha=prog*0.4;ctx.strokeStyle='#ffdd88';ctx.lineWidth=2;for(let gc=0;gc<8;gc++){const gca=gc*Math.PI/4;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(gca)*sp.r*1.5+Math.sin(frame*0.4+gc)*5,Math.sin(gca)*sp.r*1.5);ctx.stroke();}ctx.restore();for(let pi=0;pi<3;pi++){parts.length<400&&parts.push({x:sp.x,y:sp.y,vx:Math.cos(sp.ang)*10+(Math.random()-0.5)*14,vy:Math.sin(sp.ang)*10+(Math.random()-0.5)*14,r:8+Math.random()*6,color:Math.random()<0.3?'#ffffff':Math.random()<0.5?'#ffff44':'#ffdd00',life:18,max:18});}ctx.globalAlpha=1;}

  // ── Incinerate beam ──
  if(FX.incinerateBeam){const ib=FX.incinerateBeam,prog=ib.life/ib.max;const ibP=0.5+0.5*Math.sin(frame*0.2);ctx.save();ctx.translate(ib.x,ib.y);ctx.rotate(ib.angle);const beamLen=260;const beamW=22*ib.width;ctx.globalAlpha=prog*0.2;ctx.beginPath();ctx.moveTo(-5,-(beamW+20)/2);ctx.lineTo(beamLen+10,-(beamW+10)*0.3);ctx.lineTo(beamLen+10,(beamW+10)*0.3);ctx.lineTo(-5,(beamW+20)/2);ctx.closePath();const ibHaze=ctx.createLinearGradient(0,0,beamLen,0);ibHaze.addColorStop(0,'rgba(255,150,30,0.3)');ibHaze.addColorStop(1,'rgba(200,50,0,0)');ctx.fillStyle=ibHaze;ctx.fill();ctx.globalAlpha=prog*0.9;const ibg=ctx.createLinearGradient(0,0,beamLen,0);ibg.addColorStop(0,'rgba(255,255,150,1)');ibg.addColorStop(0.15,'rgba(255,200,50,0.95)');ibg.addColorStop(0.4,'rgba(255,100,0,0.8)');ibg.addColorStop(0.7,'rgba(220,40,0,0.4)');ibg.addColorStop(1,'rgba(200,30,0,0)');ctx.fillStyle=ibg;ctx.beginPath();ctx.moveTo(0,-beamW/2);ctx.lineTo(beamLen,-beamW*0.2);ctx.lineTo(beamLen,beamW*0.2);ctx.lineTo(0,beamW/2);ctx.closePath();ctx.fill();ctx.globalAlpha=prog*0.6;const ibg2=ctx.createLinearGradient(0,0,beamLen*0.7,0);ibg2.addColorStop(0,'rgba(255,255,200,0.8)');ibg2.addColorStop(1,'rgba(255,150,50,0)');ctx.fillStyle=ibg2;ctx.beginPath();ctx.moveTo(0,-beamW*0.3);ctx.lineTo(beamLen*0.7,-beamW*0.1);ctx.lineTo(beamLen*0.7,beamW*0.1);ctx.lineTo(0,beamW*0.3);ctx.closePath();ctx.fill();ctx.strokeStyle='#ffffff';ctx.lineWidth=(5+ibP*3)*ib.width;ctx.globalAlpha=prog*0.8;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(beamLen*0.85,0);ctx.stroke();ctx.globalAlpha=prog*0.3;ctx.strokeStyle='#ffcc66';ctx.lineWidth=1;for(let hw=-2;hw<=2;hw++){ctx.beginPath();for(let hx=0;hx<beamLen;hx+=10){const hy=hw*beamW*0.15+Math.sin(frame*0.3+hx*0.05)*4;hx===0?ctx.moveTo(hx,hy):ctx.lineTo(hx,hy);}ctx.stroke();}ctx.restore();if(frame%4===0){const ibDist=Math.random()*beamLen*0.8;const ibSpread=(Math.random()-0.5)*beamW*0.4;parts.length<400&&parts.push({x:ib.x+Math.cos(ib.angle)*ibDist-Math.sin(ib.angle)*ibSpread,y:ib.y+Math.sin(ib.angle)*ibDist+Math.cos(ib.angle)*ibSpread,vx:(Math.random()-0.5)*4,vy:-Math.random()*3,r:6,color:Math.random()<0.5?'#ffaa00':'#ff6600',life:14,max:14});}ctx.globalAlpha=1;}

  // ── Tornado Psy ──
  if(FX.tornadoPsy){const tp=FX.tornadoPsy,prog=tp.life/tp.max;const tpP=0.5+0.5*Math.sin(frame*0.1);ctx.save();ctx.globalAlpha=prog*0.1;const tpOuter=ctx.createRadialGradient(ACX,ACY,tp.r*0.3,ACX,ACY,tp.r*1.1);tpOuter.addColorStop(0,'rgba(68,255,136,0.3)');tpOuter.addColorStop(0.6,'rgba(40,200,100,0.15)');tpOuter.addColorStop(1,'rgba(20,100,50,0)');ctx.fillStyle=tpOuter;ctx.beginPath();ctx.arc(ACX,ACY,tp.r*1.1,0,Math.PI*2);ctx.fill();ctx.globalAlpha=prog*0.18;ctx.fillStyle='#44ff88';ctx.beginPath();ctx.arc(ACX,ACY,tp.r,0,Math.PI*2);ctx.fill();ctx.globalAlpha=prog*0.55;for(let arm=0;arm<6;arm++){const aOff=arm*Math.PI/3+tp.angle;ctx.strokeStyle=arm%3===0?'#44ff88':arm%3===1?'#88ffcc':'#aaffee';ctx.lineWidth=2+2*(arm%2)+tpP*2;ctx.beginPath();for(let t=0;t<tp.r;t+=6){const a=aOff+t*0.05;const wobble=Math.sin(frame*0.12+t*0.03)*3;const xp=ACX+Math.cos(a)*(t+wobble),yp=ACY+Math.sin(a)*(t+wobble);t===0?ctx.moveTo(xp,yp):ctx.lineTo(xp,yp);}ctx.stroke();}ctx.globalAlpha=prog*0.5;ctx.strokeStyle='#66ffaa';ctx.lineWidth=5+tpP*3;ctx.beginPath();ctx.arc(ACX,ACY,tp.r,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='#aaffdd';ctx.lineWidth=1.5;ctx.globalAlpha=prog*0.3;ctx.beginPath();ctx.arc(ACX,ACY,tp.r*1.06,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=prog*0.3;for(let db=0;db<5;db++){const dba=tp.angle*0.5+db*Math.PI*2/5;const dbr=tp.r*(0.3+db*0.12);ctx.fillStyle='#88ffcc';ctx.fillRect(ACX+Math.cos(dba)*dbr-3,ACY+Math.sin(dba)*dbr-3,6,6);}ctx.restore();if(frame%4===0){const a=Math.random()*Math.PI*2;parts.length<400&&parts.push({x:ACX+Math.cos(a)*tp.r,y:ACY+Math.sin(a)*tp.r,vx:-Math.sin(a)*7,vy:Math.cos(a)*7,r:7,color:'#44ff88',life:24,max:24});parts.length<400&&parts.push({x:ACX+Math.cos(a+1)*tp.r*0.5,y:ACY+Math.sin(a+1)*tp.r*0.5,vx:-Math.sin(a+1)*4,vy:Math.cos(a+1)*4,r:4,color:'#aaffcc',life:16,max:16});}ctx.globalAlpha=1;}

  // ── Silver Fang wave ──
  if(FX.silverFangWave){const sf=FX.silverFangWave,prog=sf.life/sf.max;const sfP=0.5+0.5*Math.sin(frame*0.16);ctx.globalAlpha=prog*0.15;const sfHaze=ctx.createRadialGradient(sf.x,sf.y,sf.r*0.8,sf.x,sf.y,sf.r*1.3);sfHaze.addColorStop(0,'rgba(170,220,255,0.3)');sfHaze.addColorStop(1,'rgba(100,150,200,0)');ctx.fillStyle=sfHaze;ctx.beginPath();ctx.arc(sf.x,sf.y,sf.r*1.3,0,Math.PI*2);ctx.fill();ctx.globalAlpha=prog*0.75;ctx.strokeStyle='#aaddff';ctx.lineWidth=10+sfP*4;ctx.beginPath();ctx.arc(sf.x,sf.y,sf.r,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='#cceeff';ctx.lineWidth=4+sfP*2;ctx.globalAlpha=prog*0.5;ctx.beginPath();ctx.arc(sf.x,sf.y,sf.r*0.82,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='#ffffff';ctx.lineWidth=2;ctx.globalAlpha=prog*0.4;ctx.beginPath();ctx.arc(sf.x,sf.y,sf.r*0.65,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=prog*0.35;ctx.strokeStyle='#ddeeff';ctx.lineWidth=1.5;for(let sl=0;sl<12;sl++){const sla=sl*Math.PI/6+frame*0.02;ctx.beginPath();ctx.moveTo(sf.x+Math.cos(sla)*sf.r*0.5,sf.y+Math.sin(sla)*sf.r*0.5);ctx.lineTo(sf.x+Math.cos(sla)*sf.r*1.05,sf.y+Math.sin(sla)*sf.r*1.05);ctx.stroke();}if(frame%4===0){const a=Math.random()*Math.PI*2;parts.length<400&&parts.push({x:sf.x+Math.cos(a)*sf.r,y:sf.y+Math.sin(a)*sf.r,vx:Math.cos(a)*6,vy:Math.sin(a)*6,r:7,color:'#aaddff',life:20,max:20});}if(frame%3===0) parts.length<400&&parts.push({x:sf.x+(Math.random()-0.5)*sf.r,y:sf.y+(Math.random()-0.5)*sf.r,vx:(Math.random()-0.5)*3,vy:(Math.random()-0.5)*3,r:4,color:'#ffffff',life:12,max:12});ctx.globalAlpha=1;}

  // ── Sonic slashes ──
  for(const ss of FX.sonicSlashes){const prog=ss.life/ss.max;const ssP=0.5+0.5*Math.sin(frame*0.3+ss.x1*0.01);ctx.globalAlpha=prog*0.3;ctx.strokeStyle='#88eeff';ctx.lineWidth=16;ctx.beginPath();ctx.moveTo(ss.x1,ss.y1);ctx.lineTo(ss.x2,ss.y2);ctx.stroke();ctx.globalAlpha=prog*0.9;ctx.strokeStyle='#ccffff';ctx.lineWidth=6+ssP*2;ctx.beginPath();ctx.moveTo(ss.x1,ss.y1);ctx.lineTo(ss.x2,ss.y2);ctx.stroke();ctx.strokeStyle='#ffffff';ctx.lineWidth=2.5;ctx.globalAlpha=prog*0.7;ctx.beginPath();ctx.moveTo(ss.x1,ss.y1);ctx.lineTo(ss.x2,ss.y2);ctx.stroke();const offX=(ss.y2-ss.y1)*0.04,offY=-(ss.x2-ss.x1)*0.04;ctx.globalAlpha=prog*0.2;ctx.strokeStyle='#aaeeff';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(ss.x1+offX,ss.y1+offY);ctx.lineTo(ss.x2+offX,ss.y2+offY);ctx.stroke();if(frame%4===0){const t=Math.random();parts.length<400&&parts.push({x:ss.x1+(ss.x2-ss.x1)*t,y:ss.y1+(ss.y2-ss.y1)*t,vx:(Math.random()-0.5)*5,vy:(Math.random()-0.5)*5,r:4,color:'#ccffff',life:10,max:10});}ctx.globalAlpha=1;}

  // ── Zoltraak beams ──
  for(const zb of FX.zoltraakBeams){const prog=zb.life/zb.max;const zbP=0.5+0.5*Math.sin(frame*0.15+zb.x*0.02);ctx.globalAlpha=prog*0.25;const zbOuter=ctx.createRadialGradient(zb.x,zb.y,0,zb.x,zb.y,zb.r*3.5);zbOuter.addColorStop(0,'rgba(180,120,255,0.4)');zbOuter.addColorStop(0.4,'rgba(120,60,220,0.15)');zbOuter.addColorStop(1,'rgba(60,0,160,0)');ctx.fillStyle=zbOuter;ctx.beginPath();ctx.arc(zb.x,zb.y,zb.r*3.5,0,Math.PI*2);ctx.fill();ctx.globalAlpha=prog*0.9;const zg=ctx.createRadialGradient(zb.x,zb.y,0,zb.x,zb.y,zb.r*2.2);zg.addColorStop(0,'rgba(255,255,255,1)');zg.addColorStop(0.2,'rgba(220,180,255,0.9)');zg.addColorStop(0.5,'rgba(136,102,255,0.6)');zg.addColorStop(1,'rgba(68,0,200,0)');ctx.fillStyle=zg;ctx.beginPath();ctx.arc(zb.x,zb.y,zb.r*2.2,0,Math.PI*2);ctx.fill();ctx.save();ctx.translate(zb.x,zb.y);ctx.rotate(frame*0.06);ctx.globalAlpha=prog*0.45;ctx.strokeStyle='#bb88ff';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,0,zb.r*2.8,0,Math.PI*2);ctx.stroke();for(let rn=0;rn<8;rn++){const rna=rn*Math.PI/4;ctx.beginPath();ctx.moveTo(Math.cos(rna)*zb.r*2.6,Math.sin(rna)*zb.r*2.6);ctx.lineTo(Math.cos(rna)*zb.r*3,Math.sin(rna)*zb.r*3);ctx.stroke();const rx=Math.cos(rna)*zb.r*3.2,ry=Math.sin(rna)*zb.r*3.2;ctx.fillStyle='#cc99ff';ctx.globalAlpha=prog*0.35;ctx.beginPath();ctx.moveTo(rx,ry-4);ctx.lineTo(rx+3,ry);ctx.lineTo(rx,ry+4);ctx.lineTo(rx-3,ry);ctx.closePath();ctx.fill();}ctx.rotate(-frame*0.12);ctx.globalAlpha=prog*0.3;ctx.strokeStyle='#9966dd';ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,0,zb.r*1.5,0,Math.PI*2);ctx.stroke();ctx.restore();parts.length<400&&parts.push({x:zb.x+(Math.random()-0.5)*zb.r*2,y:zb.y+(Math.random()-0.5)*zb.r*2,vx:(Math.random()-0.5)*4,vy:(Math.random()-0.5)*4,r:5,color:'#8866ff',life:14,max:14});if(frame%4===0) parts.length<400&&parts.push({x:zb.x,y:zb.y,vx:(Math.random()-0.5)*6,vy:(Math.random()-0.5)*6,r:3,color:'#ccaaff',life:10,max:10});ctx.globalAlpha=1;}

  // ── Granat orb ──
  if(FX.granatOrb){const go=FX.granatOrb,prog=go.life/go.max;const goP=0.5+0.5*Math.sin(frame*0.15);if(go.phase==='grow'){ctx.globalAlpha=prog*0.2;const goHaze=ctx.createRadialGradient(go.x,go.y,go.r*0.5,go.x,go.y,go.r*1.6);goHaze.addColorStop(0,'rgba(220,150,255,0.3)');goHaze.addColorStop(1,'rgba(150,0,200,0)');ctx.fillStyle=goHaze;ctx.beginPath();ctx.arc(go.x,go.y,go.r*1.6,0,Math.PI*2);ctx.fill();ctx.globalAlpha=prog*0.85;const gg=ctx.createRadialGradient(go.x-go.r*0.2,go.y-go.r*0.2,0,go.x,go.y,go.r);gg.addColorStop(0,'rgba(255,240,255,0.95)');gg.addColorStop(0.3,'rgba(255,200,255,0.8)');gg.addColorStop(0.6,'rgba(200,100,220,0.5)');gg.addColorStop(1,'rgba(150,0,200,0)');ctx.fillStyle=gg;ctx.beginPath();ctx.arc(go.x,go.y,go.r,0,Math.PI*2);ctx.fill();ctx.globalAlpha=prog*0.5;for(let gm=0;gm<4;gm++){const gma=gm*Math.PI/2+frame*0.08;ctx.fillStyle='#ffccff';ctx.beginPath();ctx.arc(go.x+Math.cos(gma)*go.r*0.7,go.y+Math.sin(gma)*go.r*0.7,3+goP*2,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=prog*0.4;ctx.strokeStyle='#dd88ff';ctx.lineWidth=2+goP;ctx.beginPath();ctx.arc(go.x,go.y,go.r,0,Math.PI*2);ctx.stroke();}else{ctx.globalAlpha=prog*0.3;ctx.fillStyle='rgba(255,200,255,0.3)';ctx.beginPath();ctx.arc(go.x,go.y,go.maxR*2,0,Math.PI*2);ctx.fill();ctx.globalAlpha=prog*0.9;const ex=ctx.createRadialGradient(go.x,go.y,0,go.x,go.y,go.maxR*1.4);ex.addColorStop(0,'rgba(255,255,255,1)');ex.addColorStop(0.15,'rgba(255,220,255,0.9)');ex.addColorStop(0.4,'rgba(255,150,255,0.6)');ex.addColorStop(1,'rgba(200,0,200,0)');ctx.fillStyle=ex;ctx.beginPath();ctx.arc(go.x,go.y,go.maxR*1.4,0,Math.PI*2);ctx.fill();ctx.globalAlpha=prog*0.6;ctx.strokeStyle='#ff88ff';ctx.lineWidth=4;ctx.beginPath();ctx.arc(go.x,go.y,go.maxR*1.2,0,Math.PI*2);ctx.stroke();if(frame%4===0) parts.length<400&&parts.push({x:go.x+(Math.random()-0.5)*go.maxR,y:go.y+(Math.random()-0.5)*go.maxR,vx:(Math.random()-0.5)*12,vy:(Math.random()-0.5)*12,r:10,color:Math.random()<0.5?'#ff88ff':'#ffaaff',life:22,max:22});if(frame%4===0) parts.length<400&&parts.push({x:go.x+(Math.random()-0.5)*go.maxR*0.5,y:go.y+(Math.random()-0.5)*go.maxR*0.5,vx:(Math.random()-0.5)*8,vy:(Math.random()-0.5)*8,r:6,color:'#ffffff',life:14,max:14});}ctx.globalAlpha=1;}

  // ── Aura soul drain ──
  if(FX.auraSoul){const as=FX.auraSoul,prog=as.life/as.max;const owner=_G.balls.find(b=>b.id===as.ownerId&&b.alive);if(owner){const asP=0.5+0.5*Math.sin(frame*0.1);ctx.globalAlpha=prog*0.12;const asFld=ctx.createRadialGradient(owner.x,owner.y,0,owner.x,owner.y,ARENA.r);asFld.addColorStop(0,'rgba(136,255,221,0.3)');asFld.addColorStop(0.5,'rgba(80,200,160,0.1)');asFld.addColorStop(1,'rgba(40,100,80,0)');ctx.fillStyle=asFld;ctx.beginPath();ctx.arc(owner.x,owner.y,ARENA.r,0,Math.PI*2);ctx.fill();ctx.globalAlpha=prog*0.3;const asOwnerG=ctx.createRadialGradient(owner.x,owner.y,0,owner.x,owner.y,50);asOwnerG.addColorStop(0,'rgba(136,255,221,0.6)');asOwnerG.addColorStop(1,'rgba(68,200,170,0)');ctx.fillStyle=asOwnerG;ctx.beginPath();ctx.arc(owner.x,owner.y,50,0,Math.PI*2);ctx.fill();for(const b of _G.balls){if(!b.alive||b.id===as.ownerId) continue;const dx=owner.x-b.x,dy=owner.y-b.y;ctx.globalAlpha=prog*0.15;ctx.strokeStyle='#aaffee';ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(b.x,b.y);ctx.quadraticCurveTo(b.x+dx*0.5+Math.sin(frame*0.08+b.x*0.01)*40,b.y+dy*0.5+Math.cos(frame*0.08+b.y*0.01)*40,owner.x,owner.y);ctx.stroke();ctx.globalAlpha=prog*0.4;ctx.strokeStyle='#88ffdd';ctx.lineWidth=2.5+asP;ctx.beginPath();ctx.moveTo(b.x,b.y);ctx.quadraticCurveTo(b.x+dx*0.5+Math.sin(frame*0.1+b.x*0.01)*50,b.y+dy*0.5+Math.cos(frame*0.1+b.y*0.01)*50,owner.x,owner.y);ctx.stroke();ctx.globalAlpha=prog*0.2;ctx.strokeStyle='#ccffee';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(b.x,b.y);ctx.quadraticCurveTo(b.x+dx*0.5+Math.sin(frame*0.12+b.x*0.01)*35,b.y+dy*0.5+Math.cos(frame*0.12+b.y*0.01)*35,owner.x,owner.y);ctx.stroke();if(frame%4===0) parts.length<400&&parts.push({x:b.x,y:b.y,vx:dx*0.03,vy:dy*0.03,r:4,color:'#88ffdd',life:20,max:20});}}ctx.globalAlpha=1;}

  // ── Stark thunder rings ──
  if(FX.starkThunder){const st=FX.starkThunder,prog=st.life/st.max;for(const rg of st.rings){if(rg.life<=0) continue;const rp=rg.life/rg.max;const stP=0.5+0.5*Math.sin(frame*0.2+rg.r*0.01);ctx.globalAlpha=rp*0.25;ctx.strokeStyle='#ffee88';ctx.lineWidth=18+stP*6;ctx.beginPath();ctx.arc(st.x,st.y,rg.r,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=rp*0.8;ctx.strokeStyle='#ffdd44';ctx.lineWidth=7+stP*3;ctx.beginPath();ctx.arc(st.x,st.y,rg.r,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='#ffffff';ctx.lineWidth=2.5;ctx.globalAlpha=rp*0.5;ctx.beginPath();ctx.arc(st.x,st.y,rg.r*0.92,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=rp*0.5;ctx.strokeStyle='#ffffaa';ctx.lineWidth=1.5;for(let lb=0;lb<6;lb++){const lba=lb*Math.PI/3+frame*0.05;ctx.beginPath();let lx=st.x+Math.cos(lba)*rg.r,ly=st.y+Math.sin(lba)*rg.r;ctx.moveTo(lx,ly);for(let ls=0;ls<3;ls++){lx+=Math.cos(lba+Math.PI/2)*rg.r*0.08+(Math.random()-0.5)*10;ly+=Math.sin(lba+Math.PI/2)*rg.r*0.08+(Math.random()-0.5)*10;ctx.lineTo(lx,ly);}ctx.stroke();}if(frame%4===0){const a=Math.random()*Math.PI*2;parts.length<400&&parts.push({x:st.x+Math.cos(a)*rg.r,y:st.y+Math.sin(a)*rg.r,vx:Math.cos(a)*6,vy:Math.sin(a)*6,r:8,color:'#ffdd44',life:18,max:18});parts.length<400&&parts.push({x:st.x+Math.cos(a+1)*rg.r*0.9,y:st.y+Math.sin(a+1)*rg.r*0.9,vx:Math.cos(a+1)*3,vy:Math.sin(a+1)*3,r:4,color:'#ffffff',life:10,max:10});}}ctx.globalAlpha=1;}

  // ── Frieren Allmachtig ──
  if(FX.frierenEnd){const fe=FX.frierenEnd,prog=fe.life/fe.max;const feP=0.5+0.5*Math.sin(frame*0.12),feP2=0.5+0.5*Math.cos(frame*0.09);if(prog>0.85){ctx.globalAlpha=(prog-0.85)*6.6*0.3;ctx.fillStyle='rgba(200,230,255,0.3)';ctx.fillRect(0,0,W,H);}ctx.globalAlpha=prog*0.15;const feHaze=ctx.createRadialGradient(fe.x,fe.y,fe.r*0.5,fe.x,fe.y,fe.r*1.5);feHaze.addColorStop(0,'rgba(200,230,255,0.3)');feHaze.addColorStop(0.5,'rgba(136,187,255,0.1)');feHaze.addColorStop(1,'rgba(100,150,220,0)');ctx.fillStyle=feHaze;ctx.beginPath();ctx.arc(fe.x,fe.y,fe.r*1.5,0,Math.PI*2);ctx.fill();ctx.globalAlpha=prog*0.7;ctx.strokeStyle='#cceeff';ctx.lineWidth=12+feP*4;ctx.beginPath();ctx.arc(fe.x,fe.y,fe.r,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='#99ccff';ctx.lineWidth=5+feP2*2;ctx.globalAlpha=prog*0.45;ctx.beginPath();ctx.arc(fe.x,fe.y,fe.r*0.78,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='#88bbff';ctx.lineWidth=3;ctx.globalAlpha=prog*0.35;ctx.beginPath();ctx.arc(fe.x,fe.y,fe.r*0.55,0,Math.PI*2);ctx.stroke();ctx.save();ctx.translate(fe.x,fe.y);ctx.rotate(frame*0.02);ctx.globalAlpha=prog*0.3;ctx.strokeStyle='#aaddff';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,0,fe.r*0.9,0,Math.PI*2);ctx.stroke();for(let rn=0;rn<6;rn++){const rna=rn*Math.PI/3;ctx.beginPath();ctx.moveTo(Math.cos(rna)*fe.r*0.85,Math.sin(rna)*fe.r*0.85);ctx.lineTo(Math.cos(rna)*fe.r*0.95,Math.sin(rna)*fe.r*0.95);ctx.stroke();const rcx=Math.cos(rna)*fe.r*0.98,rcy=Math.sin(rna)*fe.r*0.98;ctx.fillStyle='#ddeeff';ctx.globalAlpha=prog*0.4;ctx.beginPath();ctx.moveTo(rcx,rcy-6);ctx.lineTo(rcx+4,rcy);ctx.lineTo(rcx,rcy+6);ctx.lineTo(rcx-4,rcy);ctx.closePath();ctx.fill();}ctx.restore();for(const sh of fe.shards){if(sh.hit||sh.life<=0) continue;const sp=sh.life/sh.max;ctx.globalAlpha=sp*0.2;const feTr=ctx.createRadialGradient(sh.x-sh.vx*2,sh.y-sh.vy*2,0,sh.x-sh.vx*2,sh.y-sh.vy*2,16);feTr.addColorStop(0,'rgba(200,230,255,0.4)');feTr.addColorStop(1,'rgba(136,187,255,0)');ctx.fillStyle=feTr;ctx.beginPath();ctx.arc(sh.x-sh.vx*2,sh.y-sh.vy*2,16,0,Math.PI*2);ctx.fill();ctx.globalAlpha=sp*0.9;ctx.save();ctx.translate(sh.x,sh.y);ctx.rotate(sh.life*0.15);ctx.globalAlpha=sp*0.3;ctx.fillStyle='#aaddff';ctx.beginPath();ctx.moveTo(0,-18);ctx.lineTo(9,0);ctx.lineTo(0,18);ctx.lineTo(-9,0);ctx.closePath();ctx.fill();ctx.globalAlpha=sp*0.9;ctx.fillStyle='#cceeff';ctx.beginPath();ctx.moveTo(0,-14);ctx.lineTo(7,0);ctx.lineTo(0,14);ctx.lineTo(-7,0);ctx.closePath();ctx.fill();ctx.fillStyle='rgba(255,255,255,0.7)';ctx.beginPath();ctx.moveTo(0,-9);ctx.lineTo(4,0);ctx.lineTo(0,9);ctx.lineTo(-4,0);ctx.closePath();ctx.fill();ctx.restore();if(frame%4===0) parts.length<400&&parts.push({x:sh.x,y:sh.y,vx:(Math.random()-0.5)*4,vy:(Math.random()-0.5)*4,r:5,color:'#aaddff',life:16,max:16});parts.length<400&&parts.push({x:sh.x+(Math.random()-0.5)*6,y:sh.y+(Math.random()-0.5)*6,vx:(Math.random()-0.5)*2,vy:(Math.random()-0.5)*2,r:3,color:'#ddeeff',life:10,max:10});}ctx.globalAlpha=1;}

  // ════════════════════════════════════════════════
  // ANIME ABILITIES — draw (wrapped to prevent render breaks)
  // ════════════════════════════════════════════════
  try {
  // ── I AM ATOMIC — nuclear shockwave cascade ──
  if(FX.atomicBlast){
    const ab=FX.atomicBlast, prog=ab.life/ab.max;
    const p1=0.5+0.5*Math.sin(frame*0.12), p2=0.5+0.5*Math.sin(frame*0.18+1.2), p3=0.5+0.5*Math.cos(frame*0.07);
    // Chromatic aberration flash
    if(prog>0.7){
      const fa=(prog-0.7)/0.3;
      ctx.globalAlpha=fa*0.25; ctx.fillStyle='#ff0000'; ctx.fillRect(-4,0,W+8,H);
      ctx.globalAlpha=fa*0.25; ctx.fillStyle='#0000ff'; ctx.fillRect(4,0,W+8,H);
      ctx.globalAlpha=fa*0.9; ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,W,H);
    }
    // Screen-space bloom
    if(ab.r>1){
      const bl=ctx.createRadialGradient(ab.x,ab.y,0,ab.x,ab.y,ab.r*1.8);
      bl.addColorStop(0,`rgba(255,255,255,${prog*0.35})`); bl.addColorStop(0.3,`rgba(200,230,255,${prog*0.2})`);
      bl.addColorStop(0.6,`rgba(100,180,255,${prog*0.1})`); bl.addColorStop(1,'rgba(50,80,120,0)');
      ctx.globalAlpha=1; ctx.fillStyle=bl; ctx.beginPath(); ctx.arc(ab.x,ab.y,ab.r*1.8,0,Math.PI*2); ctx.fill();
    }
    // Primary shockwave — breathing width
    ctx.globalAlpha=prog*0.9; ctx.strokeStyle='#ffffff'; ctx.lineWidth=(18+4*p1)*prog;
    ctx.beginPath(); ctx.arc(ab.x,ab.y,ab.r,0,Math.PI*2); ctx.stroke();
    // Secondary glow layer
    ctx.globalAlpha=prog*0.4; ctx.strokeStyle='#88ccff'; ctx.lineWidth=(28+6*p2)*prog;
    ctx.beginPath(); ctx.arc(ab.x,ab.y,ab.r*1.05,0,Math.PI*2); ctx.stroke();
    // Inner rings pulsing
    ctx.globalAlpha=prog*(0.6+0.2*p1); ctx.strokeStyle='#aaddff'; ctx.lineWidth=(8+3*p2)*prog;
    ctx.beginPath(); ctx.arc(ab.x,ab.y,ab.r*0.65,0,Math.PI*2); ctx.stroke();
    ctx.globalAlpha=prog*(0.35+0.15*p3); ctx.strokeStyle='#ffffff'; ctx.lineWidth=4+2*p1;
    ctx.beginPath(); ctx.arc(ab.x,ab.y,ab.r*0.35,0,Math.PI*2); ctx.stroke();
    ctx.globalAlpha=prog*0.25; ctx.strokeStyle='#cceeff'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.arc(ab.x,ab.y,ab.r*0.18,0,Math.PI*2); ctx.stroke();
    // Debris ring orbiting shockwave
    ctx.save(); ctx.translate(ab.x,ab.y); ctx.rotate(frame*0.04);
    for(let di=0;di<20;di++){
      const dA=di*Math.PI*2/20, dD=ab.r*(0.95+0.08*Math.sin(frame*0.15+di*0.8));
      ctx.globalAlpha=prog*(0.5+0.3*Math.sin(frame*0.1+di*1.5));
      ctx.fillStyle=di%3===0?'#ffffff':di%3===1?'#aaddff':'#ffeecc';
      ctx.beginPath(); ctx.arc(Math.cos(dA)*dD,Math.sin(dA)*dD,3+2*Math.sin(frame*0.2+di),0,Math.PI*2); ctx.fill();
    }
    ctx.restore();
    // 32 radial rays with energy crackle
    ctx.save(); ctx.translate(ab.x,ab.y);
    for(let ri=0;ri<32;ri++){
      const ra=ri*Math.PI/16+Math.sin(frame*0.05+ri)*0.04;
      const iR=ab.r*0.1, oR=ab.r*(1.15+0.1*Math.sin(frame*0.12+ri*0.6));
      ctx.globalAlpha=prog*(0.3+0.35*(ri%2))*(0.7+0.3*Math.sin(frame*0.15+ri));
      ctx.strokeStyle=ri%4===0?'#ffffff':ri%4===1?'#aaddff':ri%4===2?'#ffeecc':'#88ccff';
      ctx.lineWidth=(ri%2===0?4:1.5)+p1*2;
      const mR=(iR+oR)/2, j1=Math.sin(frame*0.4+ri*2)*8, j2=Math.cos(frame*0.35+ri*3)*6;
      ctx.beginPath(); ctx.moveTo(Math.cos(ra)*iR,Math.sin(ra)*iR);
      ctx.lineTo(Math.cos(ra)*mR*0.5+j1,Math.sin(ra)*mR*0.5+j2);
      ctx.lineTo(Math.cos(ra)*mR-j2,Math.sin(ra)*mR+j1);
      ctx.lineTo(Math.cos(ra)*oR,Math.sin(ra)*oR); ctx.stroke();
    }
    ctx.restore();
    // Multi-layer white hot core
    if(ab.r>1){
      const cg2=ctx.createRadialGradient(ab.x,ab.y,0,ab.x,ab.y,ab.r*0.35);
      cg2.addColorStop(0,`rgba(255,255,255,${prog*0.95})`); cg2.addColorStop(0.3,`rgba(220,240,255,${prog*0.7})`);
      cg2.addColorStop(0.6,`rgba(150,200,255,${prog*0.35})`); cg2.addColorStop(1,'rgba(80,140,255,0)');
      ctx.globalAlpha=1; ctx.fillStyle=cg2; ctx.beginPath(); ctx.arc(ab.x,ab.y,ab.r*0.35,0,Math.PI*2); ctx.fill();
      const cg=ctx.createRadialGradient(ab.x,ab.y,0,ab.x,ab.y,ab.r*(0.12+0.03*p1));
      cg.addColorStop(0,'rgba(255,255,255,0.99)'); cg.addColorStop(0.4,'rgba(255,250,230,0.85)'); cg.addColorStop(1,'rgba(200,230,255,0)');
      ctx.globalAlpha=prog*0.95; ctx.fillStyle=cg; ctx.beginPath(); ctx.arc(ab.x,ab.y,ab.r*(0.12+0.03*p1),0,Math.PI*2); ctx.fill();
    }
    // Afterglow heat haze
    if(prog<0.4 && ab.r>1){
      const ag=ctx.createRadialGradient(ab.x,ab.y,ab.r*0.3,ab.x,ab.y,ab.r*1.2);
      ag.addColorStop(0,`rgba(255,200,100,${prog*0.3})`); ag.addColorStop(0.5,`rgba(255,120,50,${prog*0.15})`); ag.addColorStop(1,'rgba(255,60,20,0)');
      ctx.globalAlpha=1; ctx.fillStyle=ag; ctx.beginPath(); ctx.arc(ab.x,ab.y,ab.r*1.2,0,Math.PI*2); ctx.fill();
    }
    // Tripled debris particles
    for(let dp=0;dp<3;dp++){
      if((frame+dp)%2===0){
        const da=Math.random()*Math.PI*2, dist=ab.r*(0.6+Math.random()*0.5);
        parts.length<400&&parts.push({x:ab.x+Math.cos(da)*dist,y:ab.y+Math.sin(da)*dist,
          vx:Math.cos(da)*(6+Math.random()*6)+(Math.random()-0.5)*4,vy:Math.sin(da)*(6+Math.random()*6)+(Math.random()-0.5)*4,
          r:4+Math.random()*7,color:dp===0?'#ffffff':dp===1?'#aaddff':'#ffeecc',life:25,max:25});
      }
    }
    // Ground-zero scorch ring
    ctx.globalAlpha=prog*0.2; ctx.strokeStyle='#ff8844'; ctx.lineWidth=2;
    ctx.setLineDash([4,8]); ctx.beginPath(); ctx.arc(ab.x,ab.y,ab.r*0.9,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
    ctx.globalAlpha=1;
  }

  // ── Shadow slash — void tear in reality ──
  if(FX.shadowSlash){
    const ss=FX.shadowSlash, prog=ss.life/ss.max;
    const ex=ss.x+Math.cos(ss.angle)*ss.len, ey=ss.y+Math.sin(ss.angle)*ss.len;
    const sp1=0.5+0.5*Math.sin(frame*0.25);
    // Outer glow
    ctx.globalAlpha=prog*0.35; ctx.strokeStyle='#110044'; ctx.lineWidth=40+6*sp1;
    ctx.beginPath(); ctx.moveTo(ss.x,ss.y); ctx.lineTo(ex,ey); ctx.stroke();
    // Mid purple
    ctx.globalAlpha=prog*0.7; ctx.strokeStyle='#4422aa'; ctx.lineWidth=14;
    ctx.beginPath(); ctx.moveTo(ss.x,ss.y); ctx.lineTo(ex,ey); ctx.stroke();
    // Core
    ctx.globalAlpha=prog*0.95; ctx.strokeStyle='#ccbbff'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.moveTo(ss.x,ss.y); ctx.lineTo(ex,ey); ctx.stroke();
    if(frame%4===0){
      const t2=Math.random();
      parts.length<400&&parts.push({x:ss.x+(ex-ss.x)*t2,y:ss.y+(ey-ss.y)*t2,
        vx:(Math.random()-0.5)*5,vy:(Math.random()-0.5)*5,
        r:4,color:'#6644ff',life:18,max:18});
    }
    ctx.globalAlpha=1;
  }

  // ── Delta slashes ──
  for(const ds of FX.deltaSlashes){
    const prog=ds.life/ds.max;
    const dp1=0.5+0.5*Math.sin(frame*0.2+ds.x1*0.01);
    // Bloom layer
    ctx.globalAlpha=prog*0.25; ctx.strokeStyle='#ff0022'; ctx.lineWidth=24+4*dp1;
    ctx.beginPath(); ctx.moveTo(ds.x1,ds.y1); ctx.lineTo(ds.x2,ds.y2); ctx.stroke();
    // Blood-red outer glow breathing
    ctx.globalAlpha=prog*(0.55+0.15*dp1); ctx.strokeStyle='#ff0033'; ctx.lineWidth=12+3*dp1;
    ctx.beginPath(); ctx.moveTo(ds.x1,ds.y1); ctx.lineTo(ds.x2,ds.y2); ctx.stroke();
    // Dark crimson mid
    ctx.globalAlpha=prog*0.9; ctx.strokeStyle='#aa0022'; ctx.lineWidth=5+dp1*2;
    ctx.beginPath(); ctx.moveTo(ds.x1,ds.y1); ctx.lineTo(ds.x2,ds.y2); ctx.stroke();
    // White edge
    ctx.globalAlpha=prog*(0.7+0.2*dp1); ctx.strokeStyle='#ffaaaa'; ctx.lineWidth=1.5+dp1;
    ctx.beginPath(); ctx.moveTo(ds.x1,ds.y1); ctx.lineTo(ds.x2,ds.y2); ctx.stroke();
    // Sparks at endpoints
    if(frame%4===0){
      for(let ep=0;ep<2;ep++){
        const epx=ep===0?ds.x1:ds.x2, epy=ep===0?ds.y1:ds.y2;
        parts.length<400&&parts.push({x:epx,y:epy,vx:(Math.random()-0.5)*6,vy:(Math.random()-0.5)*6,
          r:3+Math.random()*3,color:Math.random()<0.5?'#ff4444':'#ffaaaa',life:14,max:14});
      }
    }
    ctx.globalAlpha=1;
  }

  // ── Gamma beam — precision laser ──
  if(FX.gammaBeam){
    const gb=FX.gammaBeam, prog=gb.life/gb.max;
    const beamLen=AR*2.2;
    const ex=gb.x+Math.cos(gb.angle)*beamLen, ey=gb.y+Math.sin(gb.angle)*beamLen;
    const gp1=0.5+0.5*Math.sin(frame*0.15), gp2=0.5+0.5*Math.cos(frame*0.22);
    // Bloom
    ctx.globalAlpha=prog*0.15; ctx.strokeStyle='#0066cc'; ctx.lineWidth=52+8*gp1;
    ctx.beginPath(); ctx.moveTo(gb.x,gb.y); ctx.lineTo(ex,ey); ctx.stroke();
    // Wide outer glow breathing
    ctx.globalAlpha=prog*(0.3+0.1*gp1); ctx.strokeStyle='#00aaff'; ctx.lineWidth=32+6*gp2;
    ctx.beginPath(); ctx.moveTo(gb.x,gb.y); ctx.lineTo(ex,ey); ctx.stroke();
    // Mid beam pulsing
    ctx.globalAlpha=prog*(0.8+0.15*gp2); ctx.strokeStyle='#00ddff'; ctx.lineWidth=10+3*gp1;
    ctx.beginPath(); ctx.moveTo(gb.x,gb.y); ctx.lineTo(ex,ey); ctx.stroke();
    // White core breathing
    ctx.globalAlpha=prog; ctx.strokeStyle='#ffffff'; ctx.lineWidth=3+gp1*1.5;
    ctx.beginPath(); ctx.moveTo(gb.x,gb.y); ctx.lineTo(ex,ey); ctx.stroke();
    // Energy crackle along beam
    const perp=gb.angle+Math.PI/2;
    for(let ck=0;ck<4;ck++){
      ctx.globalAlpha=prog*(0.3+0.2*Math.sin(frame*0.3+ck*1.5));
      ctx.strokeStyle=ck%2===0?'#00ffff':'#88eeff'; ctx.lineWidth=1+Math.sin(frame*0.35+ck)*0.8;
      ctx.beginPath();
      for(let cs=0;cs<8;cs++){
        const ct=cs/8;
        const cx=gb.x+(ex-gb.x)*ct+Math.cos(perp)*Math.sin(frame*0.5+cs*1.8+ck)*8;
        const cy=gb.y+(ey-gb.y)*ct+Math.sin(perp)*Math.sin(frame*0.5+cs*1.8+ck)*8;
        cs===0?ctx.moveTo(cx,cy):ctx.lineTo(cx,cy);
      }
      ctx.stroke();
    }
    // Tripled sparks
    for(let sp=0;sp<3;sp++){
      if((frame+sp)%2===0){
        const t3=Math.random(); const bx=gb.x+(ex-gb.x)*t3, by=gb.y+(ey-gb.y)*t3;
        parts.length<400&&parts.push({x:bx,y:by,vx:Math.cos(perp)*(Math.random()<0.5?5:-5)+(Math.random()-0.5)*2,
          vy:Math.sin(perp)*(Math.random()<0.5?5:-5)+(Math.random()-0.5)*2,
          r:3+Math.random()*3,color:sp===0?'#00ffff':sp===1?'#88eeff':'#ffffff',life:14,max:14});
      }
    }
    ctx.globalAlpha=1;
  }

  // ── Beta blades — twin purple slashes ──
  for(const bb of FX.betaBlades){
    const prog=bb.life/bb.max;
    const bp1=0.5+0.5*Math.sin(frame*0.22+bb.x1*0.01);
    // Bloom
    ctx.globalAlpha=prog*0.2; ctx.strokeStyle='#9944cc'; ctx.lineWidth=26+5*bp1;
    ctx.beginPath(); ctx.moveTo(bb.x1,bb.y1); ctx.lineTo(bb.x2,bb.y2); ctx.stroke();
    // Outer glow breathing
    ctx.globalAlpha=prog*(0.5+0.15*bp1); ctx.strokeStyle='#cc88ff'; ctx.lineWidth=14+3*bp1;
    ctx.beginPath(); ctx.moveTo(bb.x1,bb.y1); ctx.lineTo(bb.x2,bb.y2); ctx.stroke();
    ctx.globalAlpha=prog*0.9; ctx.strokeStyle='#9944cc'; ctx.lineWidth=5+bp1*2;
    ctx.beginPath(); ctx.moveTo(bb.x1,bb.y1); ctx.lineTo(bb.x2,bb.y2); ctx.stroke();
    ctx.globalAlpha=prog*(0.7+0.2*bp1); ctx.strokeStyle='#ffffff'; ctx.lineWidth=1.5+bp1;
    ctx.beginPath(); ctx.moveTo(bb.x1,bb.y1); ctx.lineTo(bb.x2,bb.y2); ctx.stroke();
    // Motion trail afterimage
    const dx=bb.x2-bb.x1, dy=bb.y2-bb.y1;
    const perpX=-dy*0.05, perpY=dx*0.05;
    ctx.globalAlpha=prog*0.2; ctx.strokeStyle='#cc88ff'; ctx.lineWidth=8;
    ctx.beginPath(); ctx.moveTo(bb.x1+perpX,bb.y1+perpY); ctx.lineTo(bb.x2+perpX,bb.y2+perpY); ctx.stroke();
    // Doubled particles
    for(let sp=0;sp<2;sp++){
      if((frame+sp)%2===0) parts.length<400&&parts.push({x:bb.x1+(bb.x2-bb.x1)*Math.random(),y:bb.y1+(bb.y2-bb.y1)*Math.random(),
        vx:(Math.random()-0.5)*5,vy:(Math.random()-0.5)*5,r:3+Math.random()*3,color:sp===0?'#cc88ff':'#ffffff',life:14,max:14});
    }
    ctx.globalAlpha=1;
  }

  // ════════════════════════════════════════════════
  // OVERLORD — draw
  // ════════════════════════════════════════════════
  // ── Ainz Death zone — necrotic soul field ──
  if(FX.ainzZone){
    const az=FX.ainzZone, prog=az.life/az.max;
    const pulse=0.5+0.5*Math.sin(frame*0.1);
    // Dark fill
    ctx.globalAlpha=prog*0.5;
    ctx.fillStyle='rgba(40,0,10,0.6)';
    ctx.beginPath(); ctx.arc(az.x,az.y,az.r,0,Math.PI*2); ctx.fill();
    // Border rings
    ctx.globalAlpha=prog*(0.4+0.2*pulse); ctx.strokeStyle='#cc0022'; ctx.lineWidth=6+pulse*3;
    ctx.beginPath(); ctx.arc(az.x,az.y,az.r,0,Math.PI*2); ctx.stroke();
    ctx.globalAlpha=prog*0.3; ctx.strokeStyle='#880011'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(az.x,az.y,az.r*0.7,0,Math.PI*2); ctx.stroke();
    // Skulls (3 instead of 6, no gradient)
    ctx.save(); ctx.translate(az.x,az.y); ctx.rotate(frame*0.015);
    ctx.font='24px serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    for(let ki=0;ki<3;ki++){
      const ka=ki*Math.PI*2/3;
      ctx.globalAlpha=prog*(0.5+0.2*Math.sin(frame*0.1+ki));
      ctx.fillStyle='#cc0022';
      ctx.fillText('\u{1F480}',Math.cos(ka)*az.r*0.55,Math.sin(ka)*az.r*0.55);
    }
    ctx.restore();
    if(frame%6===0){
      const pa=Math.random()*Math.PI*2;
      parts.length<400&&parts.push({x:az.x+Math.cos(pa)*az.r*0.6,y:az.y+Math.sin(pa)*az.r*0.6,
        vx:(Math.random()-0.5)*3,vy:-2-Math.random()*3,r:3,color:'#660022',life:25,max:25});
    }
    ctx.globalAlpha=1;
  }

  // ── Albedo shield — angelic fortress barrier ──
  if(FX.albedoShield){
    const as2=FX.albedoShield, prog=as2.life/as2.max, pulse=0.5+0.5*Math.sin(frame*0.12);
    const ap2=0.5+0.5*Math.cos(frame*0.08);
    const owner=_G.balls.find(b=>b.id===as2.ownerId&&b.alive);
    if(owner){
      // Multi-layer golden bloom
      if(as2.r>1){
        const blG=ctx.createRadialGradient(owner.x,owner.y,0,owner.x,owner.y,owner.r+70);
        blG.addColorStop(0,`rgba(255,250,200,${prog*0.3})`); blG.addColorStop(0.5,`rgba(255,220,100,${prog*0.15})`);
        blG.addColorStop(1,'rgba(0,0,0,0)');
        ctx.globalAlpha=1; ctx.fillStyle=blG; ctx.beginPath(); ctx.arc(owner.x,owner.y,owner.r+70,0,Math.PI*2); ctx.fill();
      }
      const shGrad=ctx.createRadialGradient(owner.x,owner.y,owner.r,owner.x,owner.y,owner.r+50);
      shGrad.addColorStop(0,`rgba(255,250,200,${prog*0.4})`); shGrad.addColorStop(0.5,`rgba(255,220,100,${prog*0.2})`);
      shGrad.addColorStop(1,'rgba(0,0,0,0)');
      ctx.globalAlpha=1; ctx.fillStyle=shGrad; ctx.beginPath(); ctx.arc(owner.x,owner.y,owner.r+50,0,Math.PI*2); ctx.fill();
      // Hexagonal shield segments rotating
      ctx.save(); ctx.translate(owner.x,owner.y); ctx.rotate(frame*0.025);
      ctx.globalAlpha=prog*(0.6+0.3*pulse); ctx.strokeStyle='#fffacc'; ctx.lineWidth=3+pulse*2;
      for(let hi=0;hi<6;hi++){
        const ha=hi*Math.PI/3;
        const hx=Math.cos(ha)*as2.r, hy=Math.sin(ha)*as2.r;
        const nx=Math.cos(ha+Math.PI/3)*as2.r, ny=Math.sin(ha+Math.PI/3)*as2.r;
        ctx.beginPath(); ctx.moveTo(hx,hy); ctx.lineTo(nx,ny); ctx.stroke();
        ctx.globalAlpha=prog*(0.3+0.2*Math.sin(frame*0.15+hi)); ctx.fillStyle='#ffffcc';
        ctx.beginPath(); ctx.arc(hx,hy,4+2*Math.sin(frame*0.2+hi),0,Math.PI*2); ctx.fill();
      }
      // Inner octagon breathing
      ctx.rotate(-frame*0.04); ctx.globalAlpha=prog*(0.4+0.2*pulse);
      ctx.strokeStyle='#ffdd88'; ctx.lineWidth=1.5+ap2;
      ctx.beginPath();
      for(let oi=0;oi<8;oi++){
        const oa=oi*Math.PI/4;
        oi===0?ctx.moveTo(Math.cos(oa)*as2.r*0.7,Math.sin(oa)*as2.r*0.7):
               ctx.lineTo(Math.cos(oa)*as2.r*0.7,Math.sin(oa)*as2.r*0.7);
      }
      ctx.closePath(); ctx.stroke();
      // Inner dodecagon
      ctx.rotate(frame*0.02); ctx.globalAlpha=prog*(0.25+0.15*ap2);
      ctx.strokeStyle='#ffcc55'; ctx.lineWidth=1;
      ctx.beginPath();
      for(let di=0;di<12;di++){
        const da=di*Math.PI/6;
        di===0?ctx.moveTo(Math.cos(da)*as2.r*0.45,Math.sin(da)*as2.r*0.45):
               ctx.lineTo(Math.cos(da)*as2.r*0.45,Math.sin(da)*as2.r*0.45);
      }
      ctx.closePath(); ctx.stroke();
      ctx.restore();
      // Doubled gold sparkles
      for(let gsp=0;gsp<2;gsp++){
        if((frame+gsp)%3===0) parts.length<400&&parts.push({x:owner.x+(Math.random()-0.5)*90,y:owner.y+(Math.random()-0.5)*90,
          vx:(Math.random()-0.5)*3,vy:-1-Math.random()*3,r:3+Math.random()*2,
          color:gsp===0?'#fffacc':'#ffdd88',life:22,max:22});
      }
    }
    ctx.globalAlpha=1;
  }

  // ── Shalltear aura — blood vampire rage ──
  if(FX.shalltearAura){
    const sa3=FX.shalltearAura, prog=sa3.life/sa3.max, pulse=0.5+0.5*Math.sin(frame*0.15);
    const owner=_G.balls.find(b=>b.id===sa3.ownerId&&b.alive);
    if(owner){
      // Bloom layer
      if(sa3.r>1){
        const sbG=ctx.createRadialGradient(owner.x,owner.y,0,owner.x,owner.y,sa3.r*1.2);
        sbG.addColorStop(0,`rgba(255,0,40,${prog*0.2})`); sbG.addColorStop(1,'rgba(100,0,15,0)');
        ctx.globalAlpha=1; ctx.fillStyle=sbG; ctx.beginPath(); ctx.arc(owner.x,owner.y,sa3.r*1.2,0,Math.PI*2); ctx.fill();
      }
      const saGrad=ctx.createRadialGradient(owner.x,owner.y,0,owner.x,owner.y,sa3.r);
      saGrad.addColorStop(0,`rgba(255,0,55,${prog*0.35})`); saGrad.addColorStop(0.6,`rgba(180,0,30,${prog*0.2})`);
      saGrad.addColorStop(1,'rgba(0,0,0,0)');
      ctx.globalAlpha=1; ctx.fillStyle=saGrad; ctx.beginPath(); ctx.arc(owner.x,owner.y,sa3.r,0,Math.PI*2); ctx.fill();
      // 5-layer spinning blood rings
      ctx.save(); ctx.translate(owner.x,owner.y); ctx.rotate(frame*0.08);
      for(let ri=0;ri<5;ri++){
        ctx.globalAlpha=prog*(0.35+0.2*pulse-ri*0.04);
        ctx.strokeStyle=ri%3===0?'#ff0055':ri%3===1?'#cc0033':'#880022';
        ctx.lineWidth=(ri===0?5:ri<3?3:1.5)+pulse;
        ctx.beginPath(); ctx.arc(0,0,sa3.r*(0.3+ri*0.15),ri*0.3,Math.PI*(1.6+ri*0.1)); ctx.stroke();
      }
      ctx.restore();
      // Tripled blood droplets
      for(let bd=0;bd<3;bd++){
        if((frame+bd)%3===0){
          const ba=Math.random()*Math.PI*2;
          parts.length<400&&parts.push({x:owner.x+Math.cos(ba)*sa3.r*0.5,y:owner.y+Math.sin(ba)*sa3.r*0.5,
            vx:Math.cos(ba)*5+(Math.random()-0.5)*3,vy:Math.sin(ba)*5+(Math.random()-0.5)*3,
            r:4+Math.random()*3,color:bd===0?'#ff0044':bd===1?'#cc0022':'#880011',life:22,max:22});
        }
      }
    }
    ctx.globalAlpha=1;
  }

  // ── Cocytus freeze zone — crystalline ice field ──
  if(FX.cocytusZone){
    const cz=FX.cocytusZone, prog=cz.life/cz.max, pulse=0.5+0.5*Math.sin(frame*0.08);
    const cp2=0.5+0.5*Math.cos(frame*0.06), cp3=0.5+0.5*Math.sin(frame*0.12+0.8);
    // Bloom frost haze
    if(cz.r>1){
      const czBl=ctx.createRadialGradient(cz.x,cz.y,0,cz.x,cz.y,cz.r*1.3);
      czBl.addColorStop(0,`rgba(180,240,255,${prog*0.15})`); czBl.addColorStop(0.5,`rgba(100,200,240,${prog*0.08})`);
      czBl.addColorStop(1,'rgba(50,100,140,0)');
      ctx.globalAlpha=1; ctx.fillStyle=czBl; ctx.beginPath(); ctx.arc(cz.x,cz.y,cz.r*1.3,0,Math.PI*2); ctx.fill();
    }
    // Multi-layer ice fill
    const czGrad=ctx.createRadialGradient(cz.x,cz.y,0,cz.x,cz.y,cz.r);
    czGrad.addColorStop(0,`rgba(200,245,255,${prog*0.3})`); czGrad.addColorStop(0.3,`rgba(150,230,255,${prog*0.2})`);
    czGrad.addColorStop(0.6,`rgba(80,180,220,${prog*0.12})`); czGrad.addColorStop(1,'rgba(0,0,0,0)');
    ctx.globalAlpha=1; ctx.fillStyle=czGrad; ctx.beginPath(); ctx.arc(cz.x,cz.y,cz.r,0,Math.PI*2); ctx.fill();
    // Fractal ice crystal pattern
    ctx.save(); ctx.translate(cz.x,cz.y); ctx.rotate(frame*0.008);
    for(let ci=0;ci<12;ci++){
      const ca=ci*Math.PI/6;
      ctx.globalAlpha=prog*(0.3+0.2*(ci%2));
      ctx.strokeStyle=ci%4===0?'#ccf0ff':ci%4===1?'#aaeeff':ci%4===2?'#88ccdd':'#ffffff';
      ctx.lineWidth=(ci%2===0?2.5:1)+cp2;
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(Math.cos(ca)*cz.r*0.85,Math.sin(ca)*cz.r*0.85); ctx.stroke();
      // Fractal branches
      for(let fb=1;fb<=3;fb++){
        const fd=cz.r*0.85*fb/4, brLen=12+8*Math.sin(frame*0.1+ci+fb);
        ctx.globalAlpha=prog*(0.2+0.1*Math.sin(frame*0.12+ci+fb)); ctx.lineWidth=1+0.5*cp3;
        ctx.beginPath(); ctx.moveTo(Math.cos(ca)*fd,Math.sin(ca)*fd);
        ctx.lineTo(Math.cos(ca)*fd+Math.cos(ca+0.5)*brLen,Math.sin(ca)*fd+Math.sin(ca+0.5)*brLen); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(Math.cos(ca)*fd,Math.sin(ca)*fd);
        ctx.lineTo(Math.cos(ca)*fd+Math.cos(ca-0.5)*brLen,Math.sin(ca)*fd+Math.sin(ca-0.5)*brLen); ctx.stroke();
      }
      // Crystal tip diamonds
      ctx.fillStyle='#ddf4ff'; ctx.globalAlpha=prog*(0.6+0.2*cp2);
      ctx.save(); ctx.translate(Math.cos(ca)*cz.r*0.8,Math.sin(ca)*cz.r*0.8); ctx.rotate(frame*0.05+ci);
      ctx.beginPath(); ctx.moveTo(0,-6); ctx.lineTo(4,0); ctx.lineTo(0,6); ctx.lineTo(-4,0); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
    // Frost creep tendrils from border
    ctx.save(); ctx.translate(cz.x,cz.y);
    for(let ft=0;ft<16;ft++){
      const ftA=ft*Math.PI*2/16+Math.sin(frame*0.03+ft)*0.15;
      const ftLen=15+10*Math.sin(frame*0.08+ft*0.7);
      ctx.globalAlpha=prog*(0.2+0.1*Math.sin(frame*0.1+ft));
      ctx.strokeStyle='#bbddee'; ctx.lineWidth=1.5+cp3;
      ctx.beginPath(); ctx.moveTo(Math.cos(ftA)*cz.r,Math.sin(ftA)*cz.r);
      ctx.lineTo(Math.cos(ftA)*(cz.r+ftLen),Math.sin(ftA)*(cz.r+ftLen)); ctx.stroke();
    }
    ctx.restore();
    // Outer border — double layer breathing
    ctx.globalAlpha=prog*(0.25+0.15*cp2); ctx.strokeStyle='#ddf4ff'; ctx.lineWidth=8+3*pulse;
    ctx.beginPath(); ctx.arc(cz.x,cz.y,cz.r,0,Math.PI*2); ctx.stroke();
    ctx.globalAlpha=prog*(0.5+0.3*pulse); ctx.strokeStyle='#aaeeff'; ctx.lineWidth=4+2*pulse;
    ctx.beginPath(); ctx.arc(cz.x,cz.y,cz.r,0,Math.PI*2); ctx.stroke();
    // Tripled ice particle shower
    for(let ip=0;ip<3;ip++){
      if((frame+ip)%2===0){
        const ia=Math.random()*Math.PI*2;
        parts.length<400&&parts.push({x:cz.x+Math.cos(ia)*cz.r*(0.3+Math.random()*0.6),
          y:cz.y+Math.sin(ia)*cz.r*(0.3+Math.random()*0.6),
          vx:(Math.random()-0.5)*3,vy:-1.5-Math.random()*3,
          r:3+Math.random()*3,color:ip===0?'#aaeeff':ip===1?'#ddf4ff':'#ffffff',life:24,max:24});
      }
    }
    ctx.globalAlpha=1;
  }

  // ── Demiurge legs — hellfire daemonic tentacles ──
  for(const dl of FX.demiurgeLegs){
    const prog=dl.life/dl.max;
    const segLen=80+prog*60; const segs=6;
    const dlp=0.5+0.5*Math.sin(frame*0.15+dl.angle);
    // Outer hellfire glow
    ctx.globalAlpha=prog*0.3; ctx.strokeStyle='#ff3300'; ctx.lineWidth=12+4*dlp;
    ctx.beginPath(); ctx.moveTo(dl.x,dl.y);
    for(let si=1;si<=segs;si++){
      const wiggle=Math.sin(frame*0.2+si*1.2)*18*(1-prog);
      ctx.lineTo(dl.x+Math.cos(dl.angle)*segLen*si/segs+Math.cos(dl.angle+Math.PI/2)*wiggle,
                 dl.y+Math.sin(dl.angle)*segLen*si/segs+Math.sin(dl.angle+Math.PI/2)*wiggle);
    }
    ctx.stroke();
    // Main tentacle
    ctx.globalAlpha=prog*0.85; ctx.strokeStyle='#ff6600'; ctx.lineWidth=5-prog*2+dlp;
    ctx.beginPath(); ctx.moveTo(dl.x,dl.y);
    for(let si=1;si<=segs;si++){
      const wiggle=Math.sin(frame*0.2+si*1.2)*18*(1-prog);
      ctx.lineTo(dl.x+Math.cos(dl.angle)*segLen*si/segs+Math.cos(dl.angle+Math.PI/2)*wiggle,
                 dl.y+Math.sin(dl.angle)*segLen*si/segs+Math.sin(dl.angle+Math.PI/2)*wiggle);
    }
    ctx.stroke();
    // Core bright line
    ctx.globalAlpha=prog*0.6; ctx.strokeStyle='#ffcc44'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(dl.x,dl.y);
    for(let si=1;si<=segs;si++){
      const wiggle=Math.sin(frame*0.2+si*1.2)*18*(1-prog);
      ctx.lineTo(dl.x+Math.cos(dl.angle)*segLen*si/segs+Math.cos(dl.angle+Math.PI/2)*wiggle,
                 dl.y+Math.sin(dl.angle)*segLen*si/segs+Math.sin(dl.angle+Math.PI/2)*wiggle);
    }
    ctx.stroke();
    // Tip with bloom
    const tipX=dl.x+Math.cos(dl.angle)*segLen, tipY=dl.y+Math.sin(dl.angle)*segLen;
    ctx.globalAlpha=prog*0.35; ctx.fillStyle='#ff4400';
    ctx.beginPath(); ctx.arc(tipX,tipY,14+4*dlp,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=prog*0.7; ctx.fillStyle='#ffaa00';
    ctx.beginPath(); ctx.arc(tipX,tipY,6+Math.sin(frame*0.3+dl.angle)*2,0,Math.PI*2); ctx.fill();
    // Doubled fire particles
    for(let fp=0;fp<2;fp++){
      if((frame+fp)%2===0) parts.length<400&&parts.push({x:tipX,y:tipY,vx:(Math.random()-0.5)*6,vy:-2-Math.random()*4,
        r:4+Math.random()*3,color:fp===0?(Math.random()<0.5?'#ff6600':'#ffaa00'):'#ffcc44',life:20,max:20});
    }
    ctx.globalAlpha=1;
  }

  // ════════════════════════════════════════════════
  // NORAGAMI — draw
  // ════════════════════════════════════════════════
  // ── Yato cuts — divine sacred slashes ──
  for(const yc of FX.yatoCuts){
    const prog=yc.life/yc.max;
    const yp1=0.5+0.5*Math.sin(frame*0.2+yc.x1*0.01);
    // Bloom
    ctx.globalAlpha=prog*0.2; ctx.strokeStyle='#0033aa'; ctx.lineWidth=32+5*yp1;
    ctx.beginPath(); ctx.moveTo(yc.x1,yc.y1); ctx.lineTo(yc.x2,yc.y2); ctx.stroke();
    ctx.globalAlpha=prog*(0.45+0.15*yp1); ctx.strokeStyle='#0055ff'; ctx.lineWidth=20+4*yp1;
    ctx.beginPath(); ctx.moveTo(yc.x1,yc.y1); ctx.lineTo(yc.x2,yc.y2); ctx.stroke();
    ctx.globalAlpha=prog*0.85; ctx.strokeStyle='#4488ff'; ctx.lineWidth=6+yp1*2;
    ctx.beginPath(); ctx.moveTo(yc.x1,yc.y1); ctx.lineTo(yc.x2,yc.y2); ctx.stroke();
    ctx.globalAlpha=prog*0.9; ctx.strokeStyle='#ffffff'; ctx.lineWidth=2+yp1;
    ctx.beginPath(); ctx.moveTo(yc.x1,yc.y1); ctx.lineTo(yc.x2,yc.y2); ctx.stroke();
    for(let sp=0;sp<2;sp++){
      if((frame+sp)%2===0){
        const t4=Math.random();
        parts.length<400&&parts.push({x:yc.x1+(yc.x2-yc.x1)*t4,y:yc.y1+(yc.y2-yc.y1)*t4,
          vx:(Math.random()-0.5)*7,vy:(Math.random()-0.5)*7,
          r:3+Math.random()*3,color:sp===0?'#aabbff':'#ffffff',life:16,max:16});
      }
    }
    ctx.globalAlpha=1;
  }

  // ── Yukine pulse — holy light blast ring ──
  if(FX.yukinePulse){
    const yp=FX.yukinePulse, prog=yp.life/yp.max;
    const ypp=0.5+0.5*Math.sin(frame*0.14);
    ctx.globalAlpha=prog*0.2; ctx.strokeStyle='#ccaa44'; ctx.lineWidth=38+6*ypp;
    ctx.beginPath(); ctx.arc(yp.x,yp.y,yp.r,0,Math.PI*2); ctx.stroke();
    ctx.globalAlpha=prog*(0.5+0.15*ypp); ctx.strokeStyle='#ffee88'; ctx.lineWidth=24+4*ypp;
    ctx.beginPath(); ctx.arc(yp.x,yp.y,yp.r,0,Math.PI*2); ctx.stroke();
    ctx.globalAlpha=prog*0.9; ctx.strokeStyle='#ffffff'; ctx.lineWidth=8+2*ypp;
    ctx.beginPath(); ctx.arc(yp.x,yp.y,yp.r,0,Math.PI*2); ctx.stroke();
    ctx.globalAlpha=prog*0.6; ctx.strokeStyle='#ffdd44'; ctx.lineWidth=3+ypp;
    ctx.beginPath(); ctx.arc(yp.x,yp.y,yp.r*0.7,0,Math.PI*2); ctx.stroke();
    ctx.globalAlpha=prog*0.3; ctx.strokeStyle='#ffffff'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.arc(yp.x,yp.y,yp.r*0.4,0,Math.PI*2); ctx.stroke();
    if(prog>0.6){
      for(let bp=0;bp<3;bp++){
        if((frame+bp)%2===0){
          const pa2=Math.random()*Math.PI*2;
          parts.length<400&&parts.push({x:yp.x+Math.cos(pa2)*yp.r,y:yp.y+Math.sin(pa2)*yp.r,
            vx:Math.cos(pa2)*8,vy:Math.sin(pa2)*8,
            r:5+Math.random()*3,color:bp===0?'#ffeeaa':bp===1?'#ffffff':'#ffdd44',life:20,max:20});
        }
      }
    }
    ctx.globalAlpha=1;
  }

  // ── Bishamon array — divine swords raining ──
  for(const ba of FX.bishArr){
    const prog=ba.life/ba.max;
    const bap=0.5+0.5*Math.sin(frame*0.18+ba.x*0.01);
    ctx.save(); ctx.translate(ba.x,ba.y); ctx.rotate(Math.PI/2);
    ctx.globalAlpha=prog*0.3; ctx.fillStyle='#ffcc44';
    ctx.beginPath(); ctx.moveTo(0,-22); ctx.lineTo(8,14); ctx.lineTo(-8,14); ctx.closePath(); ctx.fill();
    ctx.globalAlpha=prog*0.9; ctx.fillStyle='#ffaa00';
    ctx.beginPath(); ctx.moveTo(0,-18); ctx.lineTo(5,12); ctx.lineTo(-5,12); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='#ffffaa'; ctx.lineWidth=1.5+bap;
    ctx.beginPath(); ctx.moveTo(0,-18); ctx.lineTo(5,12); ctx.lineTo(-5,12); ctx.closePath(); ctx.stroke();
    ctx.globalAlpha=prog*0.6; ctx.strokeStyle='#ffffff'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(0,-16); ctx.lineTo(0,10); ctx.stroke();
    ctx.globalAlpha=prog*0.9; ctx.fillStyle='#8866aa'; ctx.fillRect(-7,10,14,7);
    ctx.restore();
    ctx.globalAlpha=prog*0.25; ctx.strokeStyle='#ffdd44'; ctx.lineWidth=6;
    ctx.beginPath(); ctx.moveTo(ba.x,ba.y-50); ctx.lineTo(ba.x,ba.y); ctx.stroke();
    ctx.globalAlpha=prog*0.5; ctx.strokeStyle='#ffdd44'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.moveTo(ba.x,ba.y-35); ctx.lineTo(ba.x,ba.y); ctx.stroke();
    for(let sp=0;sp<2;sp++){
      if((frame+sp)%2===0) parts.length<400&&parts.push({x:ba.x+(Math.random()-0.5)*14,y:ba.y-(Math.random())*25,
        vx:(Math.random()-0.5)*3,vy:-Math.random()*4,r:3+Math.random()*2,color:sp===0?'#ffaa00':'#ffffaa',life:14,max:14});
    }
    ctx.globalAlpha=1;
  }

  // ── Nora beads — cursed binding beads ──
  for(const nb of FX.noraBeads){
    const prog=nb.life/nb.max;
    const target=_G.balls.find(b=>b.id===nb.targetId&&b.alive);
    if(!target) continue;
    const nbp=0.5+0.5*Math.sin(frame*0.12);
    ctx.globalAlpha=prog*0.25; ctx.strokeStyle='#880000'; ctx.lineWidth=10+3*nbp;
    ctx.beginPath(); ctx.moveTo(nb.x,nb.y); ctx.lineTo(target.x,target.y); ctx.stroke();
    ctx.globalAlpha=prog*0.7; ctx.strokeStyle='#cc2200'; ctx.lineWidth=3+nbp;
    ctx.setLineDash([8,4]); ctx.beginPath(); ctx.moveTo(nb.x,nb.y); ctx.lineTo(target.x,target.y); ctx.stroke(); ctx.setLineDash([]);
    const bSteps=7;
    for(let bi=1;bi<bSteps;bi++){
      const bt=bi/bSteps, bx=nb.x+(target.x-nb.x)*bt, by=nb.y+(target.y-nb.y)*bt;
      const bSize=5+Math.sin(frame*0.2+bi)*2;
      ctx.globalAlpha=prog*0.3; ctx.fillStyle='#ff4400';
      ctx.beginPath(); ctx.arc(bx,by,bSize+5,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha=prog*0.9; ctx.fillStyle='#ff2200';
      ctx.beginPath(); ctx.arc(bx,by,bSize,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='#ffffff'; ctx.lineWidth=1; ctx.globalAlpha=prog*0.5;
      ctx.beginPath(); ctx.arc(bx,by,bSize,0,Math.PI*2); ctx.stroke();
    }
    ctx.globalAlpha=prog*(0.3+0.2*Math.sin(frame*0.15)); ctx.strokeStyle='#cc2200'; ctx.lineWidth=4+nbp*2;
    ctx.beginPath(); ctx.arc(target.x,target.y,target.r+12,0,Math.PI*2); ctx.stroke();
    ctx.globalAlpha=prog*(0.15+0.1*Math.sin(frame*0.2)); ctx.strokeStyle='#ff4400'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(target.x,target.y,target.r+20,0,Math.PI*2); ctx.stroke();
    if(frame%4===0) parts.length<400&&parts.push({x:target.x+(Math.random()-0.5)*20,y:target.y+(Math.random()-0.5)*20,
      vx:(Math.random()-0.5)*3,vy:-2-Math.random()*2,r:3,color:'#cc2200',life:16,max:16});
    ctx.globalAlpha=1;
  }

  // ── Veena lightning — sacred thunder array ──
  for(const vl of FX.veenaLightning){
    const prog=vl.life/vl.max;
    const vlp=0.5+0.5*Math.sin(frame*0.25+vl.x1*0.01);
    ctx.globalAlpha=prog*0.2; ctx.strokeStyle='#ccaa44'; ctx.lineWidth=24+5*vlp;
    ctx.beginPath(); ctx.moveTo(vl.x1,vl.y1); ctx.lineTo(vl.x2,vl.y2); ctx.stroke();
    ctx.globalAlpha=prog*(0.5+0.15*vlp); ctx.strokeStyle='#ffffaa'; ctx.lineWidth=14+4*vlp;
    ctx.beginPath(); ctx.moveTo(vl.x1,vl.y1); ctx.lineTo(vl.x2,vl.y2); ctx.stroke();
    ctx.globalAlpha=prog*0.9; ctx.strokeStyle='#ffdd44'; ctx.lineWidth=5+vlp*2;
    ctx.beginPath(); ctx.moveTo(vl.x1,vl.y1); ctx.lineTo(vl.x2,vl.y2); ctx.stroke();
    ctx.globalAlpha=prog*0.8; ctx.strokeStyle='#ffffff'; ctx.lineWidth=1.5+vlp;
    ctx.beginPath(); ctx.moveTo(vl.x1,vl.y1); ctx.lineTo(vl.x2,vl.y2); ctx.stroke();
    if(prog>0.3){
      for(let fk=0;fk<3;fk++){
        const ft=0.3+fk*0.25;
        const mx=vl.x1+(vl.x2-vl.x1)*ft+(Math.random()-0.5)*20, my=vl.y1+(vl.y2-vl.y1)*ft+(Math.random()-0.5)*20;
        ctx.globalAlpha=prog*(0.3+0.15*Math.sin(frame*0.3+fk));
        ctx.strokeStyle=fk%2===0?'#ffdd44':'#ffffaa'; ctx.lineWidth=1.5+vlp*0.5;
        ctx.beginPath(); ctx.moveTo(mx,my); ctx.lineTo(mx+(Math.random()-0.5)*40,my+15+Math.random()*25); ctx.stroke();
      }
    }
    if(frame%4===0) parts.length<400&&parts.push({x:vl.x2,y:vl.y2,vx:(Math.random()-0.5)*8,vy:(Math.random()-0.5)*8,
      r:4+Math.random()*2,color:Math.random()<0.5?'#ffdd44':'#ffffff',life:12,max:12});
    ctx.globalAlpha=1;
  }

  // ════════════════════════════════════════════════
  // MUSHOKU TENSEI — draw
  // ════════════════════════════════════════════════
  // ── Quagmire zone — spacetime collapse ──
  if(FX.quagmireZone){
    const qz=FX.quagmireZone, prog=qz.life/qz.max, pulse=0.5+0.5*Math.sin(frame*0.1);
    const qp2=0.5+0.5*Math.cos(frame*0.07), qp3=0.5+0.5*Math.sin(frame*0.15+1.5);
    // Gravitational lensing bloom
    if(qz.r>1){
      const qBl=ctx.createRadialGradient(qz.x,qz.y,0,qz.x,qz.y,qz.r*1.4);
      qBl.addColorStop(0,`rgba(30,0,60,${prog*0.4})`); qBl.addColorStop(0.4,`rgba(60,0,120,${prog*0.2})`);
      qBl.addColorStop(0.8,`rgba(20,0,40,${prog*0.08})`); qBl.addColorStop(1,'rgba(0,0,0,0)');
      ctx.globalAlpha=1; ctx.fillStyle=qBl; ctx.beginPath(); ctx.arc(qz.x,qz.y,qz.r*1.4,0,Math.PI*2); ctx.fill();
    }
    const qzGrad=ctx.createRadialGradient(qz.x,qz.y,0,qz.x,qz.y,qz.r);
    qzGrad.addColorStop(0,`rgba(100,0,180,${prog*0.6})`); qzGrad.addColorStop(0.5,`rgba(60,0,100,${prog*0.35})`);
    qzGrad.addColorStop(1,'rgba(0,0,0,0)');
    ctx.globalAlpha=1; ctx.fillStyle=qzGrad; ctx.beginPath(); ctx.arc(qz.x,qz.y,qz.r,0,Math.PI*2); ctx.fill();
    // Warped grid with gravitational lensing
    ctx.save(); ctx.translate(qz.x,qz.y); ctx.rotate(frame*0.02);
    const gridStep=20;
    for(let gx=-qz.r;gx<=qz.r;gx+=gridStep){
      const dist=Math.abs(gx)/qz.r;
      const warp=Math.sin(frame*0.1+gx*0.05)*(15+10*(1-dist));
      ctx.globalAlpha=prog*(0.2+0.1*(1-dist)); ctx.strokeStyle=dist<0.3?'#bb44ff':'#8800cc'; ctx.lineWidth=1+0.5*(1-dist);
      ctx.beginPath();
      for(let gy=-qz.r;gy<=qz.r;gy+=gridStep){
        const lw=warp*Math.sin(gy*0.03+frame*0.08);
        gy===-qz.r?ctx.moveTo(gx+lw,gy):ctx.lineTo(gx+lw,gy);
      }
      ctx.stroke();
    }
    for(let gy=-qz.r;gy<=qz.r;gy+=gridStep){
      const dist=Math.abs(gy)/qz.r;
      const warp=Math.sin(frame*0.1+gy*0.05)*(15+10*(1-dist));
      ctx.globalAlpha=prog*(0.2+0.1*(1-dist)); ctx.strokeStyle=dist<0.3?'#bb44ff':'#8800cc'; ctx.lineWidth=1+0.5*(1-dist);
      ctx.beginPath();
      for(let gx=-qz.r;gx<=qz.r;gx+=gridStep){
        const lw=warp*Math.cos(gx*0.03+frame*0.08);
        gx===-qz.r?ctx.moveTo(gx,gy+lw):ctx.lineTo(gx,gy+lw);
      }
      ctx.stroke();
    }
    ctx.restore();
    // Event horizon rings
    ctx.save(); ctx.translate(qz.x,qz.y); ctx.rotate(-frame*0.03);
    ctx.globalAlpha=prog*(0.6+0.3*pulse); ctx.strokeStyle='#aa00ff'; ctx.lineWidth=4+2*qp2;
    ctx.beginPath(); ctx.arc(0,0,qz.r,0,Math.PI*1.7); ctx.stroke();
    ctx.globalAlpha=prog*(0.3+0.2*qp3); ctx.strokeStyle='#dd66ff'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.arc(0,0,qz.r*1.05,0.5,Math.PI*1.5); ctx.stroke();
    ctx.strokeStyle='#7700cc'; ctx.lineWidth=2+qp2;
    ctx.beginPath(); ctx.arc(0,0,qz.r*0.75,Math.PI*0.3,Math.PI*2); ctx.stroke();
    ctx.restore();
    // Singularity core
    if(qz.r>1){
      const sCore=ctx.createRadialGradient(qz.x,qz.y,0,qz.x,qz.y,qz.r*0.2);
      sCore.addColorStop(0,`rgba(0,0,0,${prog*0.8})`); sCore.addColorStop(0.5,`rgba(50,0,100,${prog*0.4})`);
      sCore.addColorStop(1,'rgba(100,0,180,0)');
      ctx.globalAlpha=1; ctx.fillStyle=sCore; ctx.beginPath(); ctx.arc(qz.x,qz.y,qz.r*0.2,0,Math.PI*2); ctx.fill();
    }
    // Tripled void particles spiraling inward
    for(let vp=0;vp<3;vp++){
      if((frame+vp)%2===0){
        const qa=Math.random()*Math.PI*2;
        parts.length<400&&parts.push({x:qz.x+Math.cos(qa)*qz.r,y:qz.y+Math.sin(qa)*qz.r,
          vx:-Math.cos(qa)*3-Math.sin(qa)*3,vy:-Math.sin(qa)*3+Math.cos(qa)*3,
          r:4+Math.random()*3,color:vp===0?'#9900ff':vp===1?'#bb44ff':'#6600aa',life:28,max:28});
      }
    }
    ctx.globalAlpha=1;
  }

  // ── North God dash — extreme velocity aura ──
  if(FX.northGodDash){
    const ng=FX.northGodDash, prog=ng.life/ng.max;
    const ngp=0.5+0.5*Math.sin(frame*0.15);
    const owner=_G.balls.find(b=>b.id===ng.ownerId&&b.alive);
    if(owner){
      const spd=Math.hypot(owner.vx,owner.vy);
      const ngGrad=ctx.createRadialGradient(owner.x,owner.y,owner.r,owner.x,owner.y,owner.r+55);
      ngGrad.addColorStop(0,`rgba(200,200,255,${prog*0.5})`); ngGrad.addColorStop(0.5,`rgba(150,150,220,${prog*0.2})`);
      ngGrad.addColorStop(1,'rgba(0,0,0,0)');
      ctx.globalAlpha=1; ctx.fillStyle=ngGrad; ctx.beginPath(); ctx.arc(owner.x,owner.y,owner.r+55,0,Math.PI*2); ctx.fill();
      if(spd>3){
        const ang=Math.atan2(owner.vy,owner.vx)+Math.PI;
        for(let sl=0;sl<16;sl++){
          const spread=(sl-7.5)*0.06, slen=20+sl*8+spd*2;
          ctx.globalAlpha=prog*(0.35-sl*0.02)*(0.7+0.3*Math.sin(frame*0.2+sl));
          ctx.strokeStyle=sl%3===0?'#ccccff':sl%3===1?'#ffffff':'#aaaaee';
          ctx.lineWidth=2.5-sl*0.1+ngp;
          ctx.beginPath(); ctx.moveTo(owner.x,owner.y);
          ctx.lineTo(owner.x+Math.cos(ang+spread)*slen,owner.y+Math.sin(ang+spread)*slen); ctx.stroke();
        }
      }
      ctx.save(); ctx.translate(owner.x,owner.y); ctx.rotate(frame*0.1);
      for(let ri=0;ri<5;ri++){
        ctx.globalAlpha=prog*(0.3-ri*0.04)*(0.7+0.3*Math.sin(frame*0.15+ri));
        ctx.strokeStyle=ri%2===0?'#aaaaff':'#ccccff'; ctx.lineWidth=2+ngp-ri*0.3;
        ctx.beginPath(); ctx.arc(0,0,owner.r+8+ri*8,0,Math.PI*(0.7+ri*0.15)); ctx.stroke();
      }
      ctx.restore();
      if(spd>3 && frame%4===0) parts.length<400&&parts.push({x:owner.x+(Math.random()-0.5)*20,y:owner.y+(Math.random()-0.5)*20,
        vx:-owner.vx*0.3+(Math.random()-0.5)*2,vy:-owner.vy*0.3+(Math.random()-0.5)*2,
        r:3+Math.random()*3,color:'#ccccff',life:14,max:14});
    }
    ctx.globalAlpha=1;
  }

  // ── Orsted aura — dragon lord crushing field ──
  if(FX.orstedAura){
    const oa=FX.orstedAura, prog=oa.life/oa.max, pulse=0.5+0.5*Math.sin(frame*0.12);
    const op2=0.5+0.5*Math.cos(frame*0.08);
    const owner=_G.balls.find(b=>b.id===oa.ownerId&&b.alive);
    if(owner){
      if(oa.r>1){
        const oaBl=ctx.createRadialGradient(owner.x,owner.y,0,owner.x,owner.y,oa.r*1.2);
        oaBl.addColorStop(0,`rgba(0,200,80,${prog*0.2})`); oaBl.addColorStop(1,'rgba(0,80,30,0)');
        ctx.globalAlpha=1; ctx.fillStyle=oaBl; ctx.beginPath(); ctx.arc(owner.x,owner.y,oa.r*1.2,0,Math.PI*2); ctx.fill();
      }
      const oaGrad=ctx.createRadialGradient(owner.x,owner.y,0,owner.x,owner.y,oa.r);
      oaGrad.addColorStop(0,`rgba(0,255,100,${prog*0.4})`); oaGrad.addColorStop(0.5,`rgba(0,180,60,${prog*0.2})`);
      oaGrad.addColorStop(1,'rgba(0,0,0,0)');
      ctx.globalAlpha=1; ctx.fillStyle=oaGrad; ctx.beginPath(); ctx.arc(owner.x,owner.y,oa.r,0,Math.PI*2); ctx.fill();
      ctx.save(); ctx.translate(owner.x,owner.y);
      for(let ri=0;ri<5;ri++){
        ctx.rotate(frame*(0.03+ri*0.01)*(ri%2===0?1:-1));
        ctx.globalAlpha=prog*(0.35+0.2*pulse-ri*0.04);
        ctx.strokeStyle=ri%3===0?'#00ff88':ri%3===1?'#00cc55':'#004422';
        ctx.lineWidth=(ri===0?4:ri<3?2.5:1.5)+pulse;
        ctx.beginPath(); ctx.arc(0,0,oa.r*(0.3+ri*0.14),ri*0.4,Math.PI*(1.2+ri*0.2)); ctx.stroke();
      }
      ctx.restore();
      // Energy crackle arcs
      ctx.save(); ctx.translate(owner.x,owner.y);
      for(let ek=0;ek<3;ek++){
        ctx.globalAlpha=prog*(0.25+0.15*Math.sin(frame*0.2+ek));
        ctx.strokeStyle='#44ffaa'; ctx.lineWidth=1+op2*0.5;
        const ekA=frame*0.05+ek*Math.PI*2/3;
        ctx.beginPath();
        for(let es=0;es<6;es++){
          const ed=oa.r*(0.3+es*0.12), ej=Math.sin(frame*0.4+es*2+ek)*8;
          es===0?ctx.moveTo(Math.cos(ekA)*ed+ej,Math.sin(ekA)*ed-ej):ctx.lineTo(Math.cos(ekA)*ed+ej,Math.sin(ekA)*ed-ej);
        }
        ctx.stroke();
      }
      ctx.restore();
      for(let ds=0;ds<3;ds++){
        if((frame+ds)%2===0){
          const sa=Math.random()*Math.PI*2;
          parts.length<400&&parts.push({x:owner.x+Math.cos(sa)*oa.r*0.6,y:owner.y+Math.sin(sa)*oa.r*0.6,
            vx:Math.cos(sa)*7,vy:Math.sin(sa)*7,
            r:5+Math.random()*3,color:ds===0?'#00ff88':ds===1?'#004422':'#44ffaa',life:24,max:24});
        }
      }
    }
    ctx.globalAlpha=1;
  }

  // ── Roxy beam — water cannon ──
  if(FX.roxyBeam){
    const rb=FX.roxyBeam, prog=rb.life/rb.max;
    const beamLen=AR*2;
    const ex=rb.x+Math.cos(rb.angle)*beamLen, ey=rb.y+Math.sin(rb.angle)*beamLen;
    const rp1=0.5+0.5*Math.sin(frame*0.14), rp2=0.5+0.5*Math.cos(frame*0.2);
    ctx.globalAlpha=prog*0.12; ctx.strokeStyle='#0055aa'; ctx.lineWidth=54+8*rp1;
    ctx.beginPath(); ctx.moveTo(rb.x,rb.y); ctx.lineTo(ex,ey); ctx.stroke();
    ctx.globalAlpha=prog*(0.3+0.1*rp1); ctx.strokeStyle='#0088ff'; ctx.lineWidth=34+6*rp2;
    ctx.beginPath(); ctx.moveTo(rb.x,rb.y); ctx.lineTo(ex,ey); ctx.stroke();
    ctx.globalAlpha=prog*(0.8+0.1*rp2); ctx.strokeStyle='#00aaff'; ctx.lineWidth=12+3*rp1;
    ctx.beginPath(); ctx.moveTo(rb.x,rb.y); ctx.lineTo(ex,ey); ctx.stroke();
    ctx.globalAlpha=prog; ctx.strokeStyle='#aaddff'; ctx.lineWidth=4+rp1*1.5;
    ctx.beginPath(); ctx.moveTo(rb.x,rb.y); ctx.lineTo(ex,ey); ctx.stroke();
    const perp=rb.angle+Math.PI/2;
    for(let wv=0;wv<2;wv++){
      ctx.globalAlpha=prog*(0.2+0.1*Math.sin(frame*0.2+wv));
      ctx.strokeStyle=wv===0?'#44bbff':'#88ddff'; ctx.lineWidth=1.5;
      ctx.beginPath();
      for(let ws=0;ws<=10;ws++){
        const wt=ws/10;
        const wx=rb.x+(ex-rb.x)*wt+Math.cos(perp)*Math.sin(frame*0.4+ws*1.5+wv)*10;
        const wy=rb.y+(ey-rb.y)*wt+Math.sin(perp)*Math.sin(frame*0.4+ws*1.5+wv)*10;
        ws===0?ctx.moveTo(wx,wy):ctx.lineTo(wx,wy);
      }
      ctx.stroke();
    }
    for(let wd=0;wd<3;wd++){
      if((frame+wd)%2===0){
        const t5=Math.random(); const wx=rb.x+(ex-rb.x)*t5, wy=rb.y+(ey-rb.y)*t5;
        parts.length<400&&parts.push({x:wx,y:wy,vx:Math.cos(perp)*(Math.random()<0.5?4:-4)+(Math.random()-0.5)*2,
          vy:Math.sin(perp)*(Math.random()<0.5?4:-4)+(Math.random()-0.5)*2,
          r:4+Math.random()*3,color:wd===0?'#0088ff':wd===1?'#44bbff':'#aaddff',life:16,max:16});
      }
    }
    ctx.globalAlpha=1;
  }

  // ── Sylphie storm — wind vortex ──
  if(FX.sylphieStorm){
    const sv=FX.sylphieStorm, prog=sv.life/sv.max;
    const svp=0.5+0.5*Math.sin(frame*0.1);
    ctx.save();
    ctx.globalAlpha=prog*0.08; ctx.fillStyle='#66dd88';
    ctx.beginPath(); ctx.arc(sv.x,sv.y,sv.r*1.2,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=prog*0.15; ctx.fillStyle='#88ffaa';
    ctx.beginPath(); ctx.arc(sv.x,sv.y,sv.r,0,Math.PI*2); ctx.fill();
    for(let arm=0;arm<6;arm++){
      const aOff=arm*Math.PI/3+sv.angle;
      ctx.globalAlpha=prog*(0.45+0.15*Math.sin(frame*0.12+arm));
      ctx.strokeStyle=arm%3===0?'#88ffaa':arm%3===1?'#ccffdd':'#aaffcc'; ctx.lineWidth=2.5+svp;
      ctx.beginPath();
      for(let t6=0;t6<sv.r;t6+=6){
        const a=aOff+t6*0.05;
        const xp=sv.x+Math.cos(a)*t6, yp=sv.y+Math.sin(a)*t6;
        t6===0?ctx.moveTo(xp,yp):ctx.lineTo(xp,yp);
      }
      ctx.stroke();
    }
    ctx.globalAlpha=prog*(0.35+0.15*svp); ctx.strokeStyle='#88ffaa'; ctx.lineWidth=8+3*svp;
    ctx.beginPath(); ctx.arc(sv.x,sv.y,sv.r,0,Math.PI*2); ctx.stroke();
    ctx.globalAlpha=prog*(0.5+0.2*svp); ctx.strokeStyle='#aaffcc'; ctx.lineWidth=4+svp;
    ctx.beginPath(); ctx.arc(sv.x,sv.y,sv.r,0,Math.PI*2); ctx.stroke();
    ctx.restore();
    for(let wp=0;wp<3;wp++){
      if((frame+wp)%2===0){
        const wa=Math.random()*Math.PI*2;
        parts.length<400&&parts.push({x:sv.x+Math.cos(wa)*sv.r,y:sv.y+Math.sin(wa)*sv.r,
          vx:-Math.sin(wa)*8,vy:Math.cos(wa)*8,r:4+Math.random()*3,
          color:wp===0?'#88ffaa':wp===1?'#ccffdd':'#aaffcc',life:22,max:22});
      }
    }
    ctx.globalAlpha=1;
  }

  // ════════════════════════════════════════════════
  // DATE A LIVE — draw
  // ════════════════════════════════════════════════
  // ── Zafkiel bullet — clock time bullet ──
  if(FX.zafkielBullet){
    const zb2=FX.zafkielBullet, prog=zb2.life/zb2.max;
    const ang=Math.atan2(zb2.vy,zb2.vx);
    const zp1=0.5+0.5*Math.sin(frame*0.15), zp2=0.5+0.5*Math.cos(frame*0.2);
    // Temporal echo afterimages
    for(let echo=3;echo>=1;echo--){
      const eOff=echo*12;
      ctx.globalAlpha=prog*(0.15-echo*0.03); ctx.fillStyle=echo%2===0?'#880000':'#aa0000';
      ctx.beginPath(); ctx.arc(zb2.x-Math.cos(ang)*eOff,zb2.y-Math.sin(ang)*eOff,10+echo,0,Math.PI*2); ctx.fill();
    }
    ctx.save(); ctx.translate(zb2.x,zb2.y); ctx.rotate(ang);
    // Time distortion trail
    ctx.globalAlpha=prog*0.2; ctx.strokeStyle='#ff2222'; ctx.lineWidth=2+zp1;
    ctx.beginPath(); ctx.ellipse(-35,0,35,14+4*zp2,0,0,Math.PI*2); ctx.stroke();
    ctx.globalAlpha=prog*0.35; ctx.fillStyle='#ff0000';
    ctx.beginPath(); ctx.ellipse(-25,0,28+4*zp1,10+2*zp2,0,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=prog*0.2; ctx.fillStyle='#ff4444';
    ctx.beginPath(); ctx.ellipse(-30,0,35,12,0,0,Math.PI*2); ctx.fill();
    // Clock face — larger with detail
    ctx.globalAlpha=prog*0.3; ctx.fillStyle='#880000';
    ctx.beginPath(); ctx.arc(0,0,18+2*zp1,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=prog*0.9; ctx.fillStyle='#cc0000';
    ctx.beginPath(); ctx.arc(0,0,14,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='#ff4444'; ctx.lineWidth=2+zp2;
    ctx.beginPath(); ctx.arc(0,0,14,0,Math.PI*2); ctx.stroke();
    // Clock tick marks
    ctx.globalAlpha=prog*0.6; ctx.strokeStyle='#ffaaaa'; ctx.lineWidth=1;
    for(let ti=0;ti<12;ti++){
      const ta=ti*Math.PI/6;
      ctx.beginPath(); ctx.moveTo(Math.cos(ta)*11,Math.sin(ta)*11);
      ctx.lineTo(Math.cos(ta)*13,Math.sin(ta)*13); ctx.stroke();
    }
    // Clock hands
    ctx.strokeStyle='#ffffff'; ctx.lineWidth=1.5+zp1*0.5; ctx.globalAlpha=prog*0.85;
    const ht=frame*0.3;
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(Math.cos(ht)*9,Math.sin(ht)*9); ctx.stroke();
    ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(Math.cos(ht*3)*6,Math.sin(ht*3)*6); ctx.stroke();
    ctx.strokeStyle='#ff4444'; ctx.lineWidth=0.8;
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(Math.cos(ht*8)*10,Math.sin(ht*8)*10); ctx.stroke();
    ctx.fillStyle='#ffffff'; ctx.globalAlpha=prog*0.9;
    ctx.beginPath(); ctx.arc(0,0,2,0,Math.PI*2); ctx.fill();
    ctx.restore();
    // Clock HUD ring
    ctx.save(); ctx.translate(zb2.x,zb2.y); ctx.rotate(-frame*0.02);
    ctx.globalAlpha=prog*0.2; ctx.strokeStyle='#ff6666'; ctx.lineWidth=1;
    ctx.setLineDash([3,5]); ctx.beginPath(); ctx.arc(0,0,22,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
    for(let tp=0;tp<3;tp++){
      if((frame+tp)%2===0) parts.length<400&&parts.push({x:zb2.x-Math.cos(ang)*8*(tp+1)+(Math.random()-0.5)*6,
        y:zb2.y-Math.sin(ang)*8*(tp+1)+(Math.random()-0.5)*6,
        vx:(Math.random()-0.5)*3,vy:(Math.random()-0.5)*3,
        r:3+Math.random()*3,color:tp===0?'#cc0000':tp===1?'#ff4444':'#880000',life:16,max:16});
    }
    ctx.globalAlpha=1;
  }

  // ── Sandalphon crash — divine throne impact ──
  if(FX.sandalphonCrash){
    const sc2=FX.sandalphonCrash, prog=sc2.life/sc2.max;
    const scp=0.5+0.5*Math.sin(frame*0.12);
    ctx.globalAlpha=prog*0.25; ctx.strokeStyle='#cc9900'; ctx.lineWidth=22*prog+6*scp;
    ctx.beginPath(); ctx.arc(sc2.x,sc2.y,sc2.r,0,Math.PI*2); ctx.stroke();
    ctx.globalAlpha=prog*0.8; ctx.strokeStyle='#ffcc00'; ctx.lineWidth=(12+4*scp)*prog;
    ctx.beginPath(); ctx.arc(sc2.x,sc2.y,sc2.r,0,Math.PI*2); ctx.stroke();
    ctx.globalAlpha=prog*0.5; ctx.strokeStyle='#ffffff'; ctx.lineWidth=(5+2*scp)*prog;
    ctx.beginPath(); ctx.arc(sc2.x,sc2.y,sc2.r*0.6,0,Math.PI*2); ctx.stroke();
    ctx.globalAlpha=prog*0.3; ctx.strokeStyle='#ffdd44'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(sc2.x,sc2.y,sc2.r*0.3,0,Math.PI*2); ctx.stroke();
    // Radial rays
    ctx.save(); ctx.translate(sc2.x,sc2.y); ctx.rotate(frame*0.03);
    for(let dr=0;dr<12;dr++){
      const dra=dr*Math.PI/6;
      ctx.globalAlpha=prog*(0.25+0.15*Math.sin(frame*0.15+dr));
      ctx.strokeStyle=dr%2===0?'#ffcc00':'#ffffaa'; ctx.lineWidth=2+scp;
      ctx.beginPath(); ctx.moveTo(Math.cos(dra)*sc2.r*0.2,Math.sin(dra)*sc2.r*0.2);
      ctx.lineTo(Math.cos(dra)*sc2.r*0.95,Math.sin(dra)*sc2.r*0.95); ctx.stroke();
    }
    ctx.restore();
    if(prog>0.5){
      const pillarAlpha=(prog-0.5)*2;
      ctx.globalAlpha=pillarAlpha*0.3; ctx.fillStyle='#ffcc00'; ctx.fillRect(sc2.x-30,0,60,sc2.y);
      ctx.globalAlpha=pillarAlpha*0.7;
      const pillarGrad=ctx.createLinearGradient(sc2.x-20,0,sc2.x+20,sc2.y);
      pillarGrad.addColorStop(0,'rgba(255,255,200,0)'); pillarGrad.addColorStop(0.7,'rgba(255,220,80,0.7)');
      pillarGrad.addColorStop(1,'rgba(255,255,255,0.9)');
      ctx.fillStyle=pillarGrad; ctx.fillRect(sc2.x-20,0,40,sc2.y);
      ctx.strokeStyle='#ffffff'; ctx.lineWidth=6+2*scp;
      ctx.beginPath(); ctx.moveTo(sc2.x,0); ctx.lineTo(sc2.x,sc2.y); ctx.stroke();
      ctx.strokeStyle='#ffdd44'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(sc2.x-12,0); ctx.lineTo(sc2.x-12,sc2.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(sc2.x+12,0); ctx.lineTo(sc2.x+12,sc2.y); ctx.stroke();
    }
    for(let dp=0;dp<3;dp++){
      if((frame+dp)%2===0){
        const da2=Math.random()*Math.PI*2;
        parts.length<400&&parts.push({x:sc2.x+Math.cos(da2)*sc2.r,y:sc2.y+Math.sin(da2)*sc2.r,
          vx:Math.cos(da2)*7+(Math.random()-0.5)*4,vy:Math.sin(da2)*7+(Math.random()-0.5)*4,
          r:5+Math.random()*3,color:dp===0?'#ffcc00':dp===1?'#ffffff':'#ffdd44',life:24,max:24});
      }
    }
    ctx.globalAlpha=1;
  }

  // ── Origami feathers — divine light feather rain ──
  for(const of2 of FX.origamiFeathers){
    const prog=of2.life/of2.max;
    const ofp=0.5+0.5*Math.sin(frame*0.15+of2.x*0.02);
    ctx.save(); ctx.translate(of2.x,of2.y); ctx.rotate(of2.life*0.12+of2.x*0.01);
    ctx.globalAlpha=prog*0.25; ctx.fillStyle='#aaccff';
    ctx.beginPath(); ctx.moveTo(0,-18); ctx.bezierCurveTo(12,-8,12,8,0,18);
    ctx.bezierCurveTo(-12,8,-12,-8,0,-18); ctx.fill();
    ctx.globalAlpha=prog*0.9; ctx.fillStyle='#ffffff';
    ctx.beginPath(); ctx.moveTo(0,-14); ctx.bezierCurveTo(8,-6,8,6,0,14);
    ctx.bezierCurveTo(-8,6,-8,-6,0,-14); ctx.fill();
    ctx.globalAlpha=prog*(0.5+0.2*ofp); ctx.fillStyle='#ccddff';
    ctx.beginPath(); ctx.moveTo(0,-10); ctx.bezierCurveTo(5,-4,5,4,0,10);
    ctx.bezierCurveTo(-5,4,-5,-4,0,-10); ctx.fill();
    ctx.globalAlpha=prog*0.7; ctx.strokeStyle='rgba(200,220,255,0.8)'; ctx.lineWidth=1+ofp*0.5;
    ctx.beginPath(); ctx.moveTo(0,-14); ctx.lineTo(0,14); ctx.stroke();
    ctx.globalAlpha=prog*0.3; ctx.strokeStyle='rgba(200,220,255,0.5)'; ctx.lineWidth=0.8;
    for(let vi=0;vi<4;vi++){
      const vy2=-8+vi*5;
      ctx.beginPath(); ctx.moveTo(0,vy2); ctx.lineTo(4,vy2+3); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0,vy2); ctx.lineTo(-4,vy2+3); ctx.stroke();
    }
    ctx.restore();
    for(let sp=0;sp<2;sp++){
      if((frame+sp)%2===0) parts.length<400&&parts.push({x:of2.x+(Math.random()-0.5)*8,y:of2.y+(Math.random()-0.5)*8,
        vx:(Math.random()-0.5)*3,vy:(Math.random()-0.5)*3,r:2+Math.random()*2,color:sp===0?'#ccddff':'#ffffff',life:12,max:12});
    }
    ctx.globalAlpha=1;
  }

  // ── Shido wave — sealing pink pulse ──
  if(FX.shidoWave){
    const sw2=FX.shidoWave, prog=sw2.life/sw2.max;
    const swp=0.5+0.5*Math.sin(frame*0.14), swp2=0.5+0.5*Math.cos(frame*0.1);
    ctx.globalAlpha=prog*0.15; ctx.strokeStyle='#cc3388'; ctx.lineWidth=36+6*swp;
    ctx.beginPath(); ctx.arc(sw2.x,sw2.y,sw2.r,0,Math.PI*2); ctx.stroke();
    ctx.globalAlpha=prog*(0.45+0.15*swp); ctx.strokeStyle='#ff88cc'; ctx.lineWidth=22+4*swp;
    ctx.beginPath(); ctx.arc(sw2.x,sw2.y,sw2.r,0,Math.PI*2); ctx.stroke();
    ctx.globalAlpha=prog*0.85; ctx.strokeStyle='#ff44aa'; ctx.lineWidth=7+2*swp2;
    ctx.beginPath(); ctx.arc(sw2.x,sw2.y,sw2.r,0,Math.PI*2); ctx.stroke();
    ctx.globalAlpha=prog*0.5; ctx.strokeStyle='#ffffff'; ctx.lineWidth=2.5+swp;
    ctx.beginPath(); ctx.arc(sw2.x,sw2.y,sw2.r*0.7,0,Math.PI*2); ctx.stroke();
    ctx.globalAlpha=prog*0.25; ctx.strokeStyle='#ffaadd'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.arc(sw2.x,sw2.y,sw2.r*0.4,0,Math.PI*2); ctx.stroke();
    // Sealing sigils
    ctx.save(); ctx.translate(sw2.x,sw2.y); ctx.rotate(frame*0.03); ctx.globalAlpha=prog*0.3;
    for(let si=0;si<6;si++){
      const sa=si*Math.PI/3, sd=sw2.r*0.55;
      ctx.strokeStyle='#ff88cc'; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.arc(Math.cos(sa)*sd,Math.sin(sa)*sd,6+2*Math.sin(frame*0.15+si),0,Math.PI*2); ctx.stroke();
    }
    ctx.restore();
    for(let hp=0;hp<3;hp++){
      if((frame+hp)%3===0){
        const ha=Math.random()*Math.PI*2;
        parts.length<400&&parts.push({x:sw2.x+Math.cos(ha)*sw2.r,y:sw2.y+Math.sin(ha)*sw2.r,
          vx:(Math.random()-0.5)*5,vy:(Math.random()-0.5)*5,
          r:4+Math.random()*3,color:hp===0?'#ff88cc':hp===1?'#ff44aa':'#ffaadd',life:20,max:20});
      }
    }
    ctx.globalAlpha=1;
  }

  // ── Miku sonic — concert sonic waves ──
  if(FX.mikusonic){
    const ms2=FX.mikusonic, prog=ms2.life/ms2.max, pulse=0.5+0.5*Math.sin(frame*0.18);
    const mp2=0.5+0.5*Math.cos(frame*0.12);
    const owner=_G.balls.find(b=>b.id===ms2.ownerId&&b.alive);
    if(owner){
      if(ms2.r>1){
        const mBl=ctx.createRadialGradient(owner.x,owner.y,0,owner.x,owner.y,ms2.r*1.15);
        mBl.addColorStop(0,`rgba(180,60,255,${prog*0.15})`); mBl.addColorStop(1,'rgba(100,20,200,0)');
        ctx.globalAlpha=1; ctx.fillStyle=mBl; ctx.beginPath(); ctx.arc(owner.x,owner.y,ms2.r*1.15,0,Math.PI*2); ctx.fill();
      }
      for(let ri=0;ri<5;ri++){
        const rr=ms2.r*(0.25+ri*0.17)+Math.sin(frame*0.15+ri)*8;
        ctx.globalAlpha=prog*(0.35-ri*0.05)*(0.6+0.4*pulse);
        ctx.strokeStyle=ri%3===0?'#cc44ff':ri%3===1?'#aa22dd':'#ffffff';
        ctx.lineWidth=(7-ri)+pulse*2;
        ctx.beginPath(); ctx.arc(owner.x,owner.y,rr,0,Math.PI*2); ctx.stroke();
      }
      // Sound wave pattern
      ctx.save(); ctx.translate(owner.x,owner.y); ctx.rotate(ms2.angle);
      for(let sw=0;sw<4;sw++){
        const swA=sw*Math.PI/2;
        ctx.globalAlpha=prog*(0.2+0.1*Math.sin(frame*0.18+sw));
        ctx.strokeStyle='#dd66ff'; ctx.lineWidth=1.5+mp2;
        ctx.beginPath();
        for(let wp=0;wp<ms2.r;wp+=5){
          const wx=Math.cos(swA)*wp, wy=Math.sin(swA)*wp+Math.sin(wp*0.1+frame*0.3)*6;
          wp===0?ctx.moveTo(wx,wy):ctx.lineTo(wx,wy);
        }
        ctx.stroke();
      }
      ctx.restore();
      ctx.save(); ctx.translate(owner.x,owner.y); ctx.rotate(ms2.angle);
      ctx.globalAlpha=prog*(0.2+0.1*mp2);
      for(let vi=0;vi<12;vi++){
        const va=vi*Math.PI/6;
        ctx.strokeStyle=vi%3===0?'#cc44ff':vi%3===1?'#aa22dd':'#dd66ff';
        ctx.lineWidth=1.5+Math.sin(frame*0.2+vi)*0.5;
        ctx.beginPath(); ctx.moveTo(Math.cos(va)*owner.r,Math.sin(va)*owner.r);
        ctx.lineTo(Math.cos(va)*ms2.r,Math.sin(va)*ms2.r); ctx.stroke();
      }
      ctx.restore();
      for(let np=0;np<3;np++){
        if((frame+np)%3===0){
          const na=Math.random()*Math.PI*2;
          parts.length<400&&parts.push({x:owner.x+Math.cos(na)*ms2.r*0.6,y:owner.y+Math.sin(na)*ms2.r*0.6,
            vx:Math.cos(na)*4,vy:-3-Math.random()*4,
            r:5+Math.random()*3,color:np===0?'#cc44ff':np===1?'#dd66ff':'#aa22dd',life:30,max:30});
        }
      }
    }
    ctx.globalAlpha=1;
  }
  } catch(e){ ctx.globalAlpha=1; ctx.restore && ctx.restore(); }
}

function drawOrbs(ctx, frame){
  for(const o of orbs){
    const alpha=o.life<60?o.life/60:1;
    const pulse=0.5+0.5*Math.sin(o.pulse);
    ctx.globalAlpha=alpha*(0.7+0.3*pulse);
    // Outer glow ring
    ctx.fillStyle=o.type.color+'44';
    ctx.beginPath(); ctx.arc(o.x,o.y,ORB_RADIUS+8+pulse*6,0,Math.PI*2); ctx.fill();
    // Inner circle
    ctx.fillStyle=o.type.color+'cc';
    ctx.beginPath(); ctx.arc(o.x,o.y,ORB_RADIUS,0,Math.PI*2); ctx.fill();
    // Emoji
    ctx.globalAlpha=alpha;
    ctx.font=`${ORB_RADIUS+4}px serif`;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(o.type.emoji, o.x, o.y);
    // Name label below
    ctx.fillStyle=o.type.color;
    ctx.font='bold 11px Rajdhani, Courier New';
    ctx.fillText(o.type.name, o.x, o.y+ORB_RADIUS+12);
    ctx.globalAlpha=1;
  }
}

// ════════════════════════════════════════════════
// DRAW: WINNER CINEMATIC (plays during roundEndDelay)
// ════════════════════════════════════════════════
function drawWinnerCinematic(ctx, frame){
  const w = _G.roundWinner;
  if(!w) return;

  const total = 120; // cinematic window (after 30-frame free cam)
  const t = _G.roundEndDelayTimer; // counts DOWN 150→0
  // First 30 frames (t=150→120): free cam, abilities finish — no cinematic yet
  if(t > 120) return;
  const prog = 1 - t/total;      // 0→1 as cinematic progresses

  // ── Phase 1 (t=120→100): zoom in on winner + shockwave ──
  if(t > 100){
    const ph = (t-100)/20; // 1→0
    // Shockwave ring expanding from center
    const shockR = (1-ph)*200;
    ctx.globalAlpha = ph*0.6;
    ctx.strokeStyle = w.color; ctx.lineWidth = 8*ph;
    ctx.beginPath(); ctx.arc(W/2, ACY, shockR, 0, Math.PI*2); ctx.stroke();
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2*ph;
    ctx.beginPath(); ctx.arc(W/2, ACY, shockR*0.85, 0, Math.PI*2); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // ── Phase 2 (t=140→30): full screen darkening + winner spotlight ──
  if(t <= 140){
    const ph2 = Math.min(1,(110-t)/90); // 0→1

    // Dark overlay — fades in
    ctx.fillStyle = `rgba(0,0,0,${ph2*0.78})`;
    ctx.fillRect(0,0,W,H);

    // Spotlight cone — fixed at screen center
    const spotR = 260 + Math.sin(frame*0.08)*15;
    const spotGrad = ctx.createRadialGradient(W/2,ACY,0,W/2,ACY,spotR);
    spotGrad.addColorStop(0, `rgba(255,255,255,${ph2*0.18})`);
    spotGrad.addColorStop(0.5, `rgba(255,255,255,${ph2*0.06})`);
    spotGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle=spotGrad; ctx.fillRect(0,0,W,H);

    // Particle shower raining from top — centered
    if(frame%4===0 && ph2>0.3){
      for(let pi=0;pi<3;pi++){
        parts.length<400&&parts.push({x:W/2+(Math.random()-0.5)*260, y:ACY-220-Math.random()*180,
          vx:(Math.random()-0.5)*2, vy:4+Math.random()*4,
          r:3+Math.random()*4, color:w.color, life:40, max:40});
      }
    }

    // Winner ball glow — drawn at ball's real position (fine, it's in the arena)
    const haloPulse = 0.5+0.5*Math.sin(frame*0.15);
    ctx.globalAlpha = ph2*(0.4+0.3*haloPulse);
    ctx.fillStyle = w.color;
    ctx.beginPath(); ctx.arc(w.x,w.y,w.r+30+haloPulse*20,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha = ph2*(0.7+0.2*haloPulse);
    ctx.fillStyle = w.color;
    ctx.beginPath(); ctx.arc(w.x,w.y,w.r+14+haloPulse*8,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;

    // Rotating rays — multi-layer
    if(ph2 > 0.4){
      const crownAlpha = Math.min(1,(ph2-0.4)/0.4);
      ctx.save(); ctx.translate(W/2, ACY);
      // Slow outer rays
      ctx.rotate(frame*0.008);
      ctx.globalAlpha = crownAlpha*0.18;
      for(let ci=0;ci<16;ci++){
        const ca=ci*Math.PI/8;
        const rayGrad=ctx.createLinearGradient(Math.cos(ca)*60,Math.sin(ca)*60,Math.cos(ca)*360,Math.sin(ca)*360);
        rayGrad.addColorStop(0,w.color+'ff'); rayGrad.addColorStop(1,w.color+'00');
        ctx.strokeStyle=rayGrad; ctx.lineWidth=ci%2===0?8:3;
        ctx.beginPath(); ctx.moveTo(Math.cos(ca)*60,Math.sin(ca)*60); ctx.lineTo(Math.cos(ca)*360,Math.sin(ca)*360); ctx.stroke();
      }
      // Fast inner rays
      ctx.rotate(frame*0.02);
      ctx.globalAlpha = crownAlpha*0.12;
      ctx.strokeStyle='#ffffff'; ctx.lineWidth=1.5;
      for(let ci=0;ci<24;ci++){
        const ca=ci*Math.PI/12;
        ctx.beginPath(); ctx.moveTo(Math.cos(ca)*40,Math.sin(ca)*40); ctx.lineTo(Math.cos(ca)*200,Math.sin(ca)*200); ctx.stroke();
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }
    // Particle confetti shower
    if(ph2 > 0.6 && frame%4===0){
      for(let pi=0;pi<4;pi++){
        parts.length<400&&parts.push({x:W/2+(Math.random()-0.5)*320, y:ACY-280-Math.random()*120,
          vx:(Math.random()-0.5)*3, vy:5+Math.random()*5,
          r:3+Math.random()*5, color:Math.random()<0.5?w.color:'#ffffff', life:50,max:50});
      }
    }
  }

  // ── Phase 3 (t=100→0): WIN text slams in ──
  if(t <= 105){
    const ph3 = Math.min(1,(105-t)/105);
    const textScale = ph3 < 0.25 ? (1+(1-ph3/0.25)*2.0) : 1 + Math.sin(frame*0.1)*0.03;
    const textAlpha = Math.min(1, ph3*4);
    const cx=W/2, cy=ACY;

    ctx.save();
    ctx.globalAlpha=textAlpha;
    ctx.translate(cx, cy);
    ctx.scale(textScale,textScale);
    const winLabel = _G.bossMode
      ? (_G.bossWon ? 'BOSS WINS!' : 'HUNTERS WIN!')
      : `${w.name} WINS!`;
    const winColor = _G.bossMode&&_G.bossWon ? '#ff3300' : w.color;
    // Drop shadow
    ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.font='bold 92px Rajdhani, Courier New';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(winLabel,4,4);
    // Colored outline
    ctx.strokeStyle=winColor; ctx.lineWidth=3;
    ctx.strokeText(winLabel,0,0);
    // Main fill with glow
    ctx.shadowColor=winColor; ctx.shadowBlur=40;
    ctx.font='bold 92px Rajdhani, Courier New';
    ctx.fillStyle=winColor;
    ctx.fillText(winLabel,0,0);
    ctx.shadowBlur=0;
    ctx.restore();

    // Crown (skip for boss winner — use skull instead)
    if(ph3>0.4){
      const cA=Math.min(1,(ph3-0.4)/0.3);
      const bounce=Math.sin(frame*0.14)*8;
      ctx.globalAlpha=cA;
      ctx.font='70px serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(_G.bossMode&&_G.bossWon?'\u2620\ufe0f':'\ud83d\udc51',cx,cy-100+bounce);
      ctx.globalAlpha=1;
    }

    // Win progress dots — only in normal/team mode
    if(!_G.bossMode && ph3>0.6){
      const wA=Math.min(1,(ph3-0.6)/0.3);
      ctx.globalAlpha=wA;
      const wins=(_G.roundWins[w.id]??0)+1;
      for(let ri=0;ri<C.ROUNDS_TO_WIN;ri++){
        const filled=ri<wins;
        ctx.fillStyle=filled?w.color:'#1a1a2a';
        ctx.beginPath(); ctx.arc(cx+(ri-(C.ROUNDS_TO_WIN-1)/2)*46,cy+80,14,0,Math.PI*2); ctx.fill();
        if(filled){ ctx.strokeStyle='rgba(255,255,255,0.4)'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(cx+(ri-(C.ROUNDS_TO_WIN-1)/2)*46,cy+80,14,0,Math.PI*2); ctx.stroke(); }
      }
      ctx.globalAlpha=1;
    }
  }
}

// ════════════════════════════════════════════════
// DRAW: ROUND END SCREEN
// ════════════════════════════════════════════════
function drawRoundEnd(ctx, frame){
  const w=_G.roundWinner;
  const maxTimer=120;
  const prog=_G.roundTimer/maxTimer;
  const col=w?w.color:'#888';

  // Full arena dark overlay
  ctx.fillStyle='rgba(0,0,5,0.88)';
  ctx.beginPath(); ctx.arc(ACX,ACY,AR-3,0,Math.PI*2); ctx.fill();

  // Radial glow from winner color
  if(w){
    const glow=ctx.createRadialGradient(ACX,ACY,0,ACX,ACY,AR*0.8);
    glow.addColorStop(0,w.color+'18'); glow.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=glow; ctx.beginPath(); ctx.arc(ACX,ACY,AR,0,Math.PI*2); ctx.fill();
  }

  // ROUND OVER header pill
  const hp=0.5+0.5*Math.sin(frame*0.08);
  ctx.fillStyle='rgba(10,18,40,0.9)';
  ctx.beginPath(); ctx.roundRect(ACX-200,ACY-295,400,44,8); ctx.fill();
  ctx.strokeStyle=`rgba(80,140,255,${0.3+0.2*hp})`; ctx.lineWidth=1;
  ctx.beginPath(); ctx.roundRect(ACX-200,ACY-295,400,44,8); ctx.stroke();
  ctx.fillStyle=`rgba(120,170,255,0.8)`; ctx.font='700 28px Rajdhani, Courier New';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(`\u2014 ROUND ${_G.round} COMPLETE \u2014`, ACX, ACY-273);

  // Winner section
  if(w){
    // Outer glow pulse
    const wp=0.5+0.5*Math.sin(frame*0.12);
    ctx.globalAlpha=0.25+0.2*wp;
    ctx.fillStyle=w.color;
    ctx.beginPath(); ctx.arc(ACX,ACY-150,90,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=1;
    // Ball gradient
    const bg=ctx.createRadialGradient(ACX-20,ACY-170,0,ACX,ACY-150,64);
    bg.addColorStop(0,'#ffffff55'); bg.addColorStop(0.4,w.color); bg.addColorStop(1,w.color+'88');
    ctx.fillStyle=bg; ctx.beginPath(); ctx.arc(ACX,ACY-150,64,0,Math.PI*2); ctx.fill();
    // Specular
    ctx.globalAlpha=0.3; ctx.fillStyle='#fff';
    ctx.beginPath(); ctx.ellipse(ACX-20,ACY-168,22,13,-Math.PI/4,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=1;
    // Crown
    ctx.font='56px serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('\ud83d\udc51',ACX,ACY-150);
    // WIN text
    ctx.font='bold 58px Rajdhani, Courier New';
    ctx.fillStyle='rgba(0,0,0,0.4)';
    ctx.fillText(`${w.name} WINS!`,ACX+3,ACY-65+3);
    ctx.fillStyle=w.color;
    ctx.shadowColor=w.color; ctx.shadowBlur=20;
    ctx.fillText(`${w.name} WINS!`,ACX,ACY-65);
    ctx.shadowBlur=0;
  } else {
    ctx.fillStyle='#888'; ctx.font='bold 58px Rajdhani, Courier New';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('DRAW!',ACX,ACY-65);
  }

  // ── STANDINGS — full canvas, big animated rows ──
  const elapsed = maxTimer - _G.roundTimer; // frames since round end screen started (0→120)
  const ROW_H = 82, ROW_W = W - 60, ROW_X = 30;
  const medals = ['\ud83e\udd47','\ud83e\udd48','\ud83e\udd49'];

  // Header
  ctx.fillStyle='rgba(160,200,255,0.9)';
  ctx.font='700 30px Rajdhani, Courier New';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.shadowColor='rgba(100,180,255,0.6)'; ctx.shadowBlur=14;
  ctx.fillText('━━  S T A N D I N G S  ━━', W/2, ACY+14);
  ctx.shadowBlur=0;

  if(_G.teamMode){
    const sorted=[..._G.teams].sort((a,b)=>(_G.roundWins[b.id]??0)-(_G.roundWins[a.id]??0));
    const startY = ACY+56;
    sorted.forEach((t,i)=>{
      // Staggered slide-in: each row slides in 8 frames apart
      const rowElapsed = elapsed - i*8;
      const slideT = Math.min(1, Math.max(0, rowElapsed/18));
      const ease = 1-(1-slideT)*(1-slideT);
      const slideX = (1-ease)*(W*0.6);
      const y = startY + i*ROW_H;
      const isTop = i===0;
      const alive = _G.balls.filter(b=>b.alive&&b.teamId===t.id).length;
      ctx.save(); ctx.translate(slideX, 0);
      // Row bg
      ctx.globalAlpha=0.9*ease;
      ctx.fillStyle=isTop?`${t.color}22`:'rgba(20,20,40,0.7)';
      ctx.beginPath(); ctx.roundRect(ROW_X, y, ROW_W, ROW_H-6, 8); ctx.fill();
      if(isTop){
        ctx.strokeStyle=t.color+'66'; ctx.lineWidth=2;
        ctx.beginPath(); ctx.roundRect(ROW_X, y, ROW_W, ROW_H-6, 8); ctx.stroke();
      }
      ctx.globalAlpha=ease;
      // Medal
      ctx.font=`bold ${isTop?36:28}px Rajdhani, Courier New`;
      ctx.fillStyle=isTop?'#ffd700':i===1?'#c0c0c0':i===2?'#cd7f32':'rgba(255,255,255,0.35)';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(i<3?medals[i]:`#${i+1}`, ROW_X+36, y+ROW_H/2-3);
      // Color dot
      ctx.fillStyle=alive>0?t.color:'#333';
      ctx.beginPath(); ctx.arc(ROW_X+76, y+ROW_H/2-3, isTop?16:12, 0, Math.PI*2); ctx.fill();
      // Name
      ctx.font=`bold ${isTop?34:26}px Rajdhani, Courier New`;
      ctx.fillStyle=alive>0?(isTop?'#fff':t.color+'ee'):'#555';
      ctx.textAlign='left'; ctx.textBaseline='middle';
      ctx.fillText(`TEAM ${t.name}`, ROW_X+100, y+ROW_H/2-3);
      // Wins
      ctx.font=`bold ${isTop?30:24}px Rajdhani, Courier New`;
      ctx.fillStyle=isTop?t.color:'rgba(255,255,255,0.5)';
      ctx.textAlign='right';
      ctx.fillText(`${_G.roundWins[t.id]??0} / ${C.ROUNDS_TO_WIN}`, ROW_X+ROW_W-12, y+ROW_H/2-3);
      ctx.restore();
    });
  } else {
    const sorted=[..._G.balls].filter(b=>!b.isBoss).sort((a,b)=>(_G.roundWins[b.id]??0)-(_G.roundWins[a.id]??0)||(a.id-b.id));
    const showCount = Math.min(8, sorted.length);
    const startY = ACY + 50;
    sorted.slice(0, showCount).forEach((b,i)=>{
      const rowElapsed = elapsed - i*7;
      const slideT = Math.min(1, Math.max(0, rowElapsed/16));
      const ease = 1-(1-slideT)*(1-slideT);
      const slideX = (1-ease)*(W*0.65);
      const y = startY + i*(ROW_H);
      const isTop = i===0;
      ctx.save(); ctx.translate(slideX, 0);
      ctx.globalAlpha=0.92*ease;
      // Row bg
      ctx.fillStyle=isTop?`${b.color}22`:'rgba(16,16,32,0.75)';
      ctx.beginPath(); ctx.roundRect(ROW_X, y, ROW_W, ROW_H-6, 8); ctx.fill();
      if(isTop){
        ctx.strokeStyle=b.color+'66'; ctx.lineWidth=2;
        ctx.beginPath(); ctx.roundRect(ROW_X, y, ROW_W, ROW_H-6, 8); ctx.stroke();
      }
      ctx.globalAlpha=ease;
      // Medal
      ctx.font=`bold ${isTop?34:26}px Rajdhani, Courier New`;
      ctx.fillStyle=isTop?'#ffd700':i===1?'#c0c0c0':i===2?'#cd7f32':'rgba(255,255,255,0.3)';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(i<3?medals[i]:`#${i+1}`, ROW_X+34, y+ROW_H/2-3);
      // Ball dot
      const ballGrad=ctx.createRadialGradient(ROW_X+74,y+ROW_H/2-6,0,ROW_X+74,y+ROW_H/2-3,isTop?18:13);
      ballGrad.addColorStop(0,'#fff'); ballGrad.addColorStop(0.4,b.color); ballGrad.addColorStop(1,b.color+'88');
      ctx.fillStyle=b.alive?ballGrad:'#333';
      ctx.beginPath(); ctx.arc(ROW_X+74, y+ROW_H/2-3, isTop?18:13, 0, Math.PI*2); ctx.fill();
      // Name
      ctx.font=`bold ${isTop?32:24}px Rajdhani, Courier New`;
      ctx.fillStyle=b.alive?(isTop?'#fff':b.color+'ee'):'#555';
      ctx.textAlign='left'; ctx.textBaseline='middle';
      ctx.fillText(b.name, ROW_X+100, y+ROW_H/2-3);
      // Win dots
      const dotR = isTop?11:8, dotStartX = ROW_X+ROW_W-12-(C.ROUNDS_TO_WIN-1)*28;
      for(let r=0;r<C.ROUNDS_TO_WIN;r++){
        const dotX = dotStartX + r*28;
        ctx.fillStyle=r<(_G.roundWins[b.id]??0)?b.color:'#1a1a2e';
        ctx.strokeStyle=r<(_G.roundWins[b.id]??0)?b.color+'aa':'#333';
        ctx.lineWidth=1;
        ctx.beginPath(); ctx.arc(dotX, y+ROW_H/2-3, dotR, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      }
      // Dmg dealt this round (right of name, small)
      ctx.font=`700 ${isTop?20:15}px Rajdhani, Courier New`;
      ctx.fillStyle='rgba(255,255,255,0.35)';
      ctx.textAlign='left';
      ctx.fillText(`${_G.roundDmg[b.id]??0} dmg`, ROW_X+100, y+ROW_H/2+18);
      ctx.restore();
    });
  }

  // Countdown bar at bottom
  ctx.fillStyle='rgba(255,255,255,0.06)';
  ctx.beginPath(); ctx.roundRect(W/2-200, H-80, 400, 10, 5); ctx.fill();
  const barGrad=ctx.createLinearGradient(W/2-200,0,W/2-200+400*prog,0);
  barGrad.addColorStop(0,'#3366ff'); barGrad.addColorStop(1,'#88ccff');
  ctx.fillStyle=barGrad;
  ctx.beginPath(); ctx.roundRect(W/2-200, H-80, 400*prog, 10, 5); ctx.fill();
  ctx.fillStyle='rgba(120,180,255,0.55)'; ctx.font='700 20px Rajdhani, Courier New';
  ctx.textAlign='center'; ctx.textBaseline='top';
  ctx.fillText(`NEXT ROUND IN ${Math.ceil(_G.roundTimer/60)}s`, W/2, H-64);
}

// ════════════════════════════════════════════════
// DRAW: PODIUM SEQUENCE (player stats reveal)
// ════════════════════════════════════════════════
function drawPodium(ctx, frame){
  const sorted = _G.dungeonMode
    // Dungeon mode: only the player is shown on podium
    ? (_G.dungeonPlayer ? [_G.dungeonPlayer] : [])
    : _G.bossMode
      // Boss mode: hunters sorted by damage ascending (worst first), boss always last
      ? [..._G.balls.filter(b=>!b.isBoss).sort((a,b)=>(_G.totalDmg[a.id]??0)-(_G.totalDmg[b.id]??0)),
         _G.bossBall].filter(Boolean)
      : _G.teamMode
        ? [..._G.teams].sort((a,b)=>(_G.totalDmg[a.id]??0)-(_G.totalDmg[b.id]??0))
        : [..._G.balls].sort((a,b)=>(_G.totalDmg[a.id]??0)-(_G.totalDmg[b.id]??0));
  const current=sorted[_G.podiumSlot];
  if(!current) return;

  const total = _G.bossMode ? C.COUNT+1 : _G.teamMode ? _G.teams.length : C.COUNT;
  const place = total - _G.podiumSlot;
  const isChamp = _G.teamMode
    ? current.id === _G.champion?.id
    : current.id === _G.champion?.id;
  const prog=Math.min(1, _G.podiumPhase/20);
  const slideY=(1-prog)*H*0.35;
  const pulse=0.5+0.5*Math.sin(_G.podiumPhase*0.12);

  // Bg with color accent
  const bgGrad=ctx.createRadialGradient(W/2,H*0.4,0,W/2,H*0.4,H*0.6);
  bgGrad.addColorStop(0,current.color+'18'); bgGrad.addColorStop(0.5,current.color+'06'); bgGrad.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle='rgba(0,0,8,0.94)'; ctx.fillRect(0,0,W,H);
  ctx.fillStyle=bgGrad; ctx.fillRect(0,0,W,H);
  // Horizontal scan lines on background
  ctx.fillStyle='rgba(255,255,255,0.015)';
  for(let sy=0;sy<H;sy+=4) ctx.fillRect(0,sy,W,1);

  ctx.save();
  ctx.translate(0, slideY);

  // Place label top
  ctx.fillStyle='rgba(100,150,255,0.6)'; ctx.font='bold 32px Rajdhani, Courier New';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(`#${place} PLACE`, W/2, 160);

  // Big ball circle
  const ballR=isChamp?110:85;
  const ballPulse=isChamp?(0.5+0.5*Math.sin(_G.podiumPhase*0.15)):1;
  if(isChamp){
    ctx.globalAlpha=0.3+0.3*ballPulse;
    ctx.fillStyle=current.color;
    ctx.beginPath(); ctx.arc(W/2, 340, ballR+30+ballPulse*20, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha=1;
  }
  ctx.fillStyle=current.color;
  ctx.beginPath(); ctx.arc(W/2, 340, ballR, 0, Math.PI*2); ctx.fill();
  if(isChamp){
    ctx.font=`bold 64px Courier New`; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(_G.bossMode && current.isBoss ? '\u2620\ufe0f' : '\ud83d\udc51', W/2, 340);
  }

  // Name
  ctx.fillStyle=isChamp?current.color:'#fff';
  ctx.font=`bold ${isChamp?80:64}px Courier New`;
  ctx.textAlign='center'; ctx.textBaseline='middle';
  // Shadow
  ctx.fillStyle='rgba(0,0,0,0.5)';
  ctx.fillText(current.name, W/2+3, 480+3);
  ctx.fillStyle=isChamp?current.color:'#fff';
  ctx.fillText(current.name, W/2, 480);

  // Total damage — big number
  const dmgProg=Math.min(1,(_G.podiumPhase-10)/30);
  if(dmgProg>0){
    const displayDmg=Math.floor(_G.totalDmg[current.id]*dmgProg);
    ctx.globalAlpha=dmgProg;
    // Label
    ctx.fillStyle='rgba(180,180,180,0.7)'; ctx.font='bold 26px Rajdhani, Courier New';
    ctx.fillText('TOTAL DAMAGE', W/2, 580);
    // Number — very large
    ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.font='bold 100px Rajdhani, Courier New';
    ctx.fillText(`${displayDmg}`, W/2+4, 690+4);
    ctx.fillStyle=isChamp?'#ffdd33':'#fff';
    ctx.font='bold 100px Rajdhani, Courier New';
    ctx.fillText(`${displayDmg}`, W/2, 690);
    ctx.globalAlpha=1;
  }

  // Round wins — only in normal/team mode
  if(!_G.bossMode){
    const winsY=800;
    ctx.fillStyle='rgba(150,150,150,0.5)'; ctx.font='bold 22px Rajdhani, Courier New';
    ctx.fillText('ROUND WINS', W/2, winsY);
    for(let r=0;r<C.ROUNDS_TO_WIN;r++){
      const dotX=W/2-(C.ROUNDS_TO_WIN-1)*24+r*48;
      ctx.fillStyle=r<(_G.roundWins[current.id]??0)?current.color:'#222';
      ctx.beginPath(); ctx.arc(dotX, winsY+36, 16, 0, Math.PI*2); ctx.fill();
    }
  } else {
    // Boss mode: show role label instead
    const isBossSlot = current.isBoss;
    ctx.fillStyle = isBossSlot ? '#ff4400' : 'rgba(180,200,255,0.7)';
    ctx.font='bold 28px Rajdhani, Courier New';
    ctx.fillText(isBossSlot ? '\u2620 BOSS' : '\u2694 HUNTER', W/2, 820);
  }

  // Kill streak (solo en modo individual)
  if(!_G.teamMode && !_G.bossMode && current.streak>=2){
    const sc=current.streak>=5?'#ff8833':current.streak>=3?'#ffdd33':'#ff5555';
    ctx.fillStyle=sc; ctx.font='bold 28px Rajdhani, Courier New';
    ctx.fillText(`\ud83d\udc80 ${current.streak}x KILL STREAK`, W/2, 900);
  }
  // Team mode: show member count
  if(_G.teamMode){
    const members=_G.teams[current.id]?.memberIds.length??0;
    ctx.fillStyle='rgba(200,200,200,0.6)'; ctx.font='bold 24px Rajdhani, Courier New';
    ctx.fillText(`${members} MEMBERS`, W/2, 900);
  }

  // Progress dots bottom
  const dotCount=_G.bossMode?C.COUNT+1:_G.teamMode?_G.teams.length:Math.min(C.COUNT,15);
  const dotSpacing=Math.min(30, 400/dotCount);
  for(let i=0;i<dotCount;i++){
    ctx.fillStyle=i===_G.podiumSlot?'#fff':'#333';
    const dx=W/2-(dotCount-1)*dotSpacing/2+i*dotSpacing;
    ctx.beginPath(); ctx.arc(dx, 980, i===_G.podiumSlot?8:4, 0, Math.PI*2); ctx.fill();
  }

  ctx.restore();
}

// ════════════════════════════════════════════════
// DRAW: CHAMPION SCREEN
// ════════════════════════════════════════════════
function drawChampion(ctx, frame){
  const w=_G.champion;
  const pulse=0.5+0.5*Math.sin(frame*0.07);

  // Dark overlay with winner color radial glow
  ctx.fillStyle='rgba(0,0,5,0.9)';
  ctx.beginPath(); ctx.arc(ACX,ACY,AR-3,0,Math.PI*2); ctx.fill();
  if(w){
    const glow=ctx.createRadialGradient(ACX,ACY,0,ACX,ACY,AR);
    glow.addColorStop(0,w.color+'22'); glow.addColorStop(0.6,w.color+'08'); glow.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=glow; ctx.beginPath(); ctx.arc(ACX,ACY,AR,0,Math.PI*2); ctx.fill();
    // Slow rotating gold rays
    ctx.save(); ctx.translate(ACX,ACY); ctx.rotate(frame*0.005);
    for(let i=0;i<18;i++){
      const a=i*Math.PI/9;
      const rg=ctx.createLinearGradient(Math.cos(a)*80,Math.sin(a)*80,Math.cos(a)*380,Math.sin(a)*380);
      rg.addColorStop(0,'rgba(255,200,0,0.12)'); rg.addColorStop(1,'rgba(255,200,0,0)');
      ctx.strokeStyle=rg; ctx.lineWidth=i%3===0?6:2;
      ctx.beginPath(); ctx.moveTo(Math.cos(a)*80,Math.sin(a)*80); ctx.lineTo(Math.cos(a)*380,Math.sin(a)*380); ctx.stroke();
    }
    ctx.restore();
  }

  // CHAMPION header
  const champLabel = _G.dungeonMode
    ? (_G.dungeonVictory ? 'VICTORY!' : 'GAME OVER')
    : 'CHAMPION!';
  const champColor = _G.dungeonMode
    ? (_G.dungeonVictory ? '#ffd700' : '#ff2200')
    : '#ffd700';
  const champGlow = _G.dungeonMode
    ? (_G.dungeonVictory ? '#ffaa00' : '#ff0000')
    : '#ffaa00';
  ctx.save(); ctx.translate(ACX,ACY-258);
  const scale2=1+Math.sin(frame*0.06)*0.02;
  ctx.scale(scale2,scale2);
  ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.font='bold 70px Rajdhani, Courier New';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(champLabel,3,3);
  ctx.fillStyle=champColor;
  ctx.shadowColor=champGlow;
  ctx.shadowBlur=28;
  ctx.font='bold 70px Rajdhani, Courier New';
  ctx.fillText(champLabel,0,0);
  ctx.shadowBlur=0;
  ctx.restore();

  if(w){
    // Pulsing outer glow ball
    ctx.globalAlpha=0.2+0.15*pulse;
    ctx.fillStyle=w.color;
    ctx.beginPath(); ctx.arc(ACX,ACY-140,110,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=1;
    // Ball gradient
    const bg=ctx.createRadialGradient(ACX-25,ACY-165,0,ACX,ACY-140,80);
    bg.addColorStop(0,'rgba(255,255,255,0.5)'); bg.addColorStop(0.4,w.color); bg.addColorStop(1,w.color+'66');
    ctx.fillStyle=bg; ctx.beginPath(); ctx.arc(ACX,ACY-140,80,0,Math.PI*2); ctx.fill();
    // Specular
    ctx.globalAlpha=0.3; ctx.fillStyle='#fff';
    ctx.beginPath(); ctx.ellipse(ACX-26,ACY-158,28,16,-Math.PI/4,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=1;
    // Crown bounce
    const bounce=Math.sin(frame*0.1)*6;
    ctx.font='64px serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('\ud83d\udc51',ACX,ACY-140+bounce);
    // Name
    ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.font='bold 90px Rajdhani, Courier New';
    ctx.fillText(w.name,ACX+3,ACY-18+3);
    ctx.fillStyle=w.color; ctx.shadowColor=w.color; ctx.shadowBlur=20;
    ctx.fillText(w.name,ACX,ACY-18);
    ctx.shadowBlur=0;
    // Rounds won / Dungeon stats
    ctx.fillStyle='rgba(255,220,60,0.8)'; ctx.font='bold 26px Rajdhani, Courier New';
    if(_G.dungeonMode){
      ctx.fillText(_G.dungeonVictory
        ? `${_G.dungeonTotalRooms} ROOMS CLEARED`
        : `REACHED ROOM ${_G.dungeonRoom}`,ACX,ACY+52);
    } else {
      ctx.fillText(`${_G.roundWins[w.id]??0} ROUNDS WON`,ACX,ACY+52);
    }
  }

  // ── FINAL STANDINGS (champion screen) — skip for dungeon ──
  if(_G.dungeonMode){
    // Show dungeon summary instead
    const sumY = ACY + 90;
    ctx.fillStyle='rgba(180,200,255,0.95)';
    ctx.font='bold 30px Rajdhani, Courier New';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('DUNGEON SUMMARY', ACX, sumY);
    ctx.strokeStyle='rgba(120,160,255,0.45)'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.moveTo(ACX-160,sumY+18); ctx.lineTo(ACX+160,sumY+18); ctx.stroke();

    const stats = [
      `Rooms Cleared: ${_G.dungeonVictory ? _G.dungeonTotalRooms : _G.dungeonRoom - 1}`,
      `Final HP: ${_G.dungeonPlayer ? Math.ceil(Math.max(0,_G.dungeonPlayer.hp)) : 0} / ${C.DUNGEON.PLAYER_HP}`,
      _G.dungeonVictory ? 'DEMON LORD DEFEATED!' : 'HERO FELL IN BATTLE',
    ];
    stats.forEach((s,i)=>{
      ctx.font='bold 24px Rajdhani, Courier New';
      ctx.fillStyle = i===2 ? (_G.dungeonVictory ? '#22dd44' : '#ff4444') : 'rgba(200,210,255,0.85)';
      ctx.fillText(s, ACX, sumY + 50 + i*40);
    });
    return; // skip normal final standings
  }
  const finalSorted = _G.teamMode
    ? [..._G.teams].sort((a,b)=>(_G.totalDmg[b.id]??0)-(_G.totalDmg[a.id]??0))
    : [..._G.balls].filter(b=>!b.isBoss).sort((a,b)=>(_G.totalDmg[b.id]??0)-(_G.totalDmg[a.id]??0));
  const maxTotalDmg=Math.max(1,...finalSorted.map(x=>_G.totalDmg[x.id]??0));
  const showMax=Math.min(_G.teamMode?4:8, finalSorted.length);

  // Title
  const titleY = ACY + 90;
  ctx.fillStyle='rgba(180,200,255,0.95)';
  ctx.font='bold 30px Rajdhani, Courier New';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('FINAL STANDINGS', ACX, titleY);
  // Underline
  ctx.strokeStyle='rgba(120,160,255,0.45)'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(ACX-160,titleY+18); ctx.lineTo(ACX+160,titleY+18); ctx.stroke();

  const ROW_H = 72;
  const ROW_W = W - 40;
  const ROW_X = 20;
  const listTop = titleY + 30;

  // Panel bg
  ctx.fillStyle='rgba(0,0,14,0.85)';
  ctx.beginPath(); ctx.roundRect(ROW_X-4, listTop-4, ROW_W+8, showMax*ROW_H+8, 12); ctx.fill();
  ctx.strokeStyle='rgba(100,140,255,0.20)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.roundRect(ROW_X-4, listTop-4, ROW_W+8, showMax*ROW_H+8, 12); ctx.stroke();

  const placeColors=['#ffd700','#c0c0c0','#cd7f32','#aaaaaa','#999','#888','#777','#666'];

  finalSorted.slice(0,showMax).forEach((item,i)=>{
    const ry = listTop + i*ROW_H;
    const cy = ry + ROW_H/2;
    const dmg = _G.totalDmg[item.id]??0;
    const wins = _G.roundWins[item.id]??0;
    const isTop = i===0;

    // Row bg
    if(isTop){
      ctx.fillStyle=item.color+'33';
      ctx.beginPath(); ctx.roundRect(ROW_X, ry+2, ROW_W, ROW_H-4, 8); ctx.fill();
      ctx.strokeStyle=item.color+'88'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.roundRect(ROW_X, ry+2, ROW_W, ROW_H-4, 8); ctx.stroke();
    } else {
      ctx.fillStyle=i%2===0?'rgba(255,255,255,0.05)':'rgba(255,255,255,0.02)';
      ctx.beginPath(); ctx.roundRect(ROW_X, ry+2, ROW_W, ROW_H-4, 6); ctx.fill();
    }
    // Damage bar overlay
    const barW = Math.floor((dmg/maxTotalDmg)*(ROW_W));
    ctx.globalAlpha = isTop ? 0.22 : 0.13;
    ctx.fillStyle = item.color;
    ctx.beginPath(); ctx.roundRect(ROW_X, ry+2, barW, ROW_H-4, 6); ctx.fill();
    ctx.globalAlpha = 1;

    // Place label
    ctx.fillStyle = placeColors[i]??'#666';
    ctx.font = `bold ${isTop?28:22}px Rajdhani, Courier New`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(C.PLACE[i]??`${i+1}`, ROW_X+10, cy);

    // Color circle
    const ballR = isTop ? 20 : 15;
    const ballX = ROW_X + 66;
    const ballGrad = ctx.createRadialGradient(ballX-ballR*0.3, cy-ballR*0.3, 0, ballX, cy, ballR);
    ballGrad.addColorStop(0,'rgba(255,255,255,0.55)');
    ballGrad.addColorStop(0.35, item.color);
    ballGrad.addColorStop(1, item.color+'99');
    ctx.fillStyle = ballGrad;
    ctx.beginPath(); ctx.arc(ballX, cy, ballR, 0, Math.PI*2); ctx.fill();

    // Name
    ctx.fillStyle = isTop ? '#ffffff' : i<=2 ? '#dddddd' : '#aaaaaa';
    ctx.font = `bold ${isTop?28:22}px Rajdhani, Courier New`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(_G.teamMode?`TEAM ${item.name}`:item.name, ROW_X+94, cy - (isTop?5:4));

    // DMG
    ctx.fillStyle = isTop ? '#ffd700' : i<=2 ? '#cccccc' : '#888888';
    ctx.font = `bold ${isTop?24:18}px Rajdhani, Courier New`;
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText(`${dmg} DMG`, ROW_X+ROW_W-10, cy - (isTop?7:5));
    // Wins
    ctx.fillStyle = 'rgba(255,255,255,0.40)';
    ctx.font = `bold ${isTop?16:13}px Rajdhani, Courier New`;
    ctx.fillText(_G.teamMode?`${wins}W`:`${wins}W`, ROW_X+ROW_W-10, cy + (isTop?10:8));
  });
}

// ════════════════════════════════════════════════
// DRAW: BOSS HP BAR + DAMAGE RANKING
// ════════════════════════════════════════════════
function drawBossHpBar(ctx, frame){
  const boss = _G.bossBall;
  if(!boss) return;
  const pulse = 0.5+0.5*Math.sin(frame*0.12);

  // ── Panel background ──
  const PANEL_X = 20, PANEL_Y = 862, PANEL_W = W-40, PANEL_H = 390;
  ctx.fillStyle='rgba(0,0,8,0.88)';
  ctx.beginPath(); ctx.roundRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 12); ctx.fill();
  ctx.strokeStyle=`rgba(255,60,0,${0.25+0.15*pulse})`; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.roundRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 12); ctx.stroke();

  // ── BOSS HP BAR ──
  const BAR_X = PANEL_X+16, BAR_Y = PANEL_Y+52, BAR_W = PANEL_W-32, BAR_H = 52;

  // Boss skull label + HP numbers above bar
  ctx.fillStyle='#fff'; ctx.font='bold 26px Rajdhani, Courier New';
  ctx.textAlign='left'; ctx.textBaseline='middle';
  ctx.shadowColor='#ff2200'; ctx.shadowBlur=18;
  ctx.fillText('\u2620 BOSS', BAR_X, PANEL_Y+28);
  ctx.shadowBlur=0;

  const pct = Math.max(0, boss.hp / C.BOSS.HP);
  ctx.fillStyle = pct>0.5?'#ff8844':pct>0.25?'#ff5500':'#ff2200';
  ctx.font='bold 26px Rajdhani, Courier New';
  ctx.textAlign='right';
  ctx.fillText(`${Math.ceil(Math.max(0,boss.hp))} / ${C.BOSS.HP}`, BAR_X+BAR_W, PANEL_Y+28);

  // Bar track
  ctx.fillStyle='rgba(60,8,8,0.95)';
  ctx.beginPath(); ctx.roundRect(BAR_X, BAR_Y, BAR_W, BAR_H, 6); ctx.fill();

  // HP fill
  const fillW = BAR_W * pct;
  if(fillW > 2){
    const hpGrad = ctx.createLinearGradient(BAR_X, 0, BAR_X+BAR_W, 0);
    hpGrad.addColorStop(0,   pct>0.5?'#cc1100':'#880000');
    hpGrad.addColorStop(0.5, pct>0.5?'#ff3300':'#cc2200');
    hpGrad.addColorStop(1,   `rgba(255,${Math.floor(pct*100)},0,1)`);
    ctx.fillStyle=hpGrad;
    ctx.beginPath(); ctx.roundRect(BAR_X, BAR_Y, fillW, BAR_H, 6); ctx.fill();
    // Animated shine stripe
    const shineX = BAR_X + ((frame*3) % (fillW+60)) - 30;
    ctx.globalAlpha=0.18;
    ctx.fillStyle='#fff';
    ctx.beginPath(); ctx.roundRect(Math.max(BAR_X,shineX), BAR_Y, 28, BAR_H, 3); ctx.fill();
    ctx.globalAlpha=1;
    // Pulsing edge glow
    ctx.globalAlpha=0.5+0.35*pulse;
    ctx.strokeStyle='#ff5500'; ctx.lineWidth=2.5;
    ctx.beginPath(); ctx.roundRect(BAR_X, BAR_Y, fillW, BAR_H, 6); ctx.stroke();
    ctx.globalAlpha=1;
  }

  // ── HUNTERS ALIVE ──
  const hunters = _G.balls.filter(b=>!b.isBoss);
  const huntersAlive = hunters.filter(b=>b.alive).length;
  ctx.textAlign='center'; ctx.font=`bold 20px Rajdhani, Courier New`;
  ctx.fillStyle=`rgba(200,210,255,${0.8+0.15*pulse})`;
  ctx.textBaseline='middle';
  ctx.fillText(`\u2694 HUNTERS: ${huntersAlive} / ${C.COUNT} alive`, W/2, BAR_Y+BAR_H+22);

  // ── DMG RANKING (top 3 hunters by round damage) ──
  const RANK_TOP = BAR_Y + BAR_H + 48;
  const ranked = hunters
    .filter(b => (_G.roundDmg[b.id]??0) > 0 || b.alive)
    .sort((a,b)=>(_G.roundDmg[b.id]??0)-(_G.roundDmg[a.id]??0))
    .slice(0,3);

  if(ranked.length > 0){
    // Section title
    ctx.fillStyle='rgba(255,180,60,0.9)'; ctx.font='bold 18px Rajdhani, Courier New';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('TOP DAMAGE', W/2, RANK_TOP);

    const ROW_H = 72, ROW_W = PANEL_W-32, ROW_X = PANEL_X+16;
    const maxDmg = Math.max(1, _G.roundDmg[ranked[0].id]??0);
    const medals = ['\ud83e\udd47','\ud83e\udd48','\ud83e\udd49'];

    ranked.forEach((b, i)=>{
      const ry = RANK_TOP + 18 + i*ROW_H;
      const cy = ry + ROW_H/2;
      const dmg = _G.roundDmg[b.id]??0;
      const isFirst = i===0;

      // Row bg
      ctx.fillStyle = isFirst ? b.color+'28' : 'rgba(255,255,255,0.04)';
      ctx.beginPath(); ctx.roundRect(ROW_X, ry+3, ROW_W, ROW_H-6, 8); ctx.fill();
      if(isFirst){
        ctx.strokeStyle=b.color+'66'; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.roundRect(ROW_X, ry+3, ROW_W, ROW_H-6, 8); ctx.stroke();
      }

      // Damage bar fill
      const barW = Math.floor((dmg/maxDmg)*(ROW_W));
      ctx.globalAlpha = isFirst ? 0.20 : 0.12;
      ctx.fillStyle = b.color;
      ctx.beginPath(); ctx.roundRect(ROW_X, ry+3, barW, ROW_H-6, 8); ctx.fill();
      ctx.globalAlpha = 1;

      // Medal
      ctx.font=`${isFirst?28:22}px serif`; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(medals[i], ROW_X+22, cy);

      // Ball circle
      const ballR = isFirst?18:14, ballX = ROW_X+54;
      const bg = ctx.createRadialGradient(ballX-ballR*0.3,cy-ballR*0.3,0,ballX,cy,ballR);
      bg.addColorStop(0,'rgba(255,255,255,0.55)'); bg.addColorStop(0.35,b.color); bg.addColorStop(1,b.color+'88');
      ctx.fillStyle=bg; ctx.beginPath(); ctx.arc(ballX,cy,ballR,0,Math.PI*2); ctx.fill();

      // Name
      ctx.fillStyle = isFirst?'#ffffff':i===1?'#dddddd':'#aaaaaa';
      ctx.font=`bold ${isFirst?26:20}px Rajdhani, Courier New`;
      ctx.textAlign='left'; ctx.textBaseline='middle';
      ctx.fillText(b.name, ROW_X+80, cy - (isFirst?5:4));

      // Status dot (alive/dead)
      const statusColor = b.alive ? '#44ff88' : '#ff4444';
      ctx.fillStyle=statusColor;
      ctx.beginPath(); ctx.arc(ROW_X+80+ctx.measureText(b.name).width+14, cy-(isFirst?5:4), isFirst?6:5, 0, Math.PI*2); ctx.fill();

      // DMG value
      ctx.fillStyle = isFirst?'#ffd700':i===1?'#c0c0c0':'#cd7f32';
      ctx.font=`bold ${isFirst?24:19}px Rajdhani, Courier New`;
      ctx.textAlign='right'; ctx.textBaseline='middle';
      ctx.fillText(`${dmg} DMG`, ROW_X+ROW_W-10, cy);
    });
  }
}

// ════════════════════════════════════════════════
// DRAW: LEADERBOARD (race bar chart — shows round damage)
// ════════════════════════════════════════════════
function drawLeaderboard(ctx, frame){
  const lbH = (LB_BAR_H+LB_BAR_GAP)*4;

  // Glass panel background
  ctx.fillStyle='rgba(4,8,20,0.72)';
  ctx.beginPath(); ctx.roundRect(LB_X-12, LB_Y-32, W-LB_X*2+24, lbH+44, 10); ctx.fill();
  // Top border line
  const hdrGrad=ctx.createLinearGradient(LB_X,0,W-LB_X,0);
  hdrGrad.addColorStop(0,'rgba(60,120,255,0)');
  hdrGrad.addColorStop(0.5,'rgba(100,180,255,0.5)');
  hdrGrad.addColorStop(1,'rgba(60,120,255,0)');
  ctx.strokeStyle=hdrGrad; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(LB_X-12,LB_Y-32); ctx.lineTo(W-LB_X+12,LB_Y-32); ctx.stroke();

  // Section label
  ctx.fillStyle = iridGrad(ctx, LB_X, 0, LB_X+300, 0, frame, 0.7);
  ctx.font='700 18px Rajdhani, Courier New';
  ctx.textAlign='left'; ctx.textBaseline='middle';
  ctx.fillText(_G.teamMode ? `ROUND ${_G.round}  \u00b7  TEAMS` : `ROUND ${_G.round}  \u00b7  DMG RANKING`, LB_X, LB_Y-16);
  ctx.fillStyle = iridColor(frame+120, 80, 75, 0.5);
  ctx.font='600 14px Rajdhani, Courier New';
  ctx.textAlign='right';
  ctx.fillText(_G.teamMode ? `${_G.teams.length} TEAMS` : 'TOP 4', W-LB_X, LB_Y-16);

  // ── TEAM MODE leaderboard ──
  if(_G.teamMode){
    _G.teams.forEach((t,slot)=>{
      const barY = LB_Y + slot*(LB_BAR_H+LB_BAR_GAP);
      const barW = Math.max(8, _G.lbWidths[t.id]);
      const cy2 = barY + LB_BAR_H/2;
      const alive = _G.balls.filter(b=>b.alive&&b.teamId===t.id);
      const total = _G.teams[t.id].memberIds.length;
      const isLeader = slot===0;

      ctx.fillStyle='rgba(255,255,255,0.03)';
      ctx.beginPath(); ctx.roundRect(LB_X+20,barY,LB_BAR_MAX-20,LB_BAR_H,4); ctx.fill();

      if(barW>8){
        const grad=ctx.createLinearGradient(LB_X+20,0,LB_X+20+barW,0);
        grad.addColorStop(0, alive.length?t.color+'22':t.color+'08');
        grad.addColorStop(0.5, alive.length?t.color+'88':t.color+'20');
        grad.addColorStop(1, alive.length?t.color+'ee':t.color+'30');
        ctx.fillStyle=grad;
        ctx.beginPath(); ctx.roundRect(LB_X+20,barY,barW,LB_BAR_H,4); ctx.fill();
        ctx.fillStyle='rgba(255,255,255,0.06)';
        ctx.beginPath(); ctx.roundRect(LB_X+22,barY+2,barW-4,LB_BAR_H/3,3); ctx.fill();
      }

      // Team color dot + name
      ctx.fillStyle=alive.length?t.color:'#444';
      ctx.beginPath(); ctx.arc(LB_X+38,cy2,11,0,Math.PI*2); ctx.fill();
      ctx.font=`bold ${isLeader?20:17}px Rajdhani, Courier New`;
      ctx.fillStyle=alive.length?(isLeader?'#fff':t.color+'cc'):'rgba(255,255,255,0.3)';
      ctx.textAlign='left'; ctx.textBaseline='middle';
      ctx.fillText(`TEAM ${t.name}`, LB_X+56, cy2);

      // Members alive badge
      ctx.fillStyle=alive.length>0?'rgba(0,0,0,0.7)':'rgba(255,50,50,0.2)';
      ctx.beginPath(); ctx.roundRect(LB_X+56+110,cy2-10,52,20,10); ctx.fill();
      ctx.fillStyle=alive.length>0?t.color:'#ff5050';
      ctx.font='bold 13px Rajdhani, Courier New';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(`${alive.length}/${total}`, LB_X+56+136, cy2);

      // Damage total (integer, no decimals)
      const teamDmg = Math.floor(_G.roundDmg[t.id]||0);
      if(teamDmg>0){
        ctx.font=`bold ${isLeader?26:22}px Rajdhani, Courier New`;
        ctx.fillStyle=isLeader?'#fff':'rgba(255,255,255,0.85)';
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(`${teamDmg}`, LB_X+20+Math.max(barW*0.5,60), cy2);
      }

      // Round wins badge
      const bg2=ctx.createRadialGradient(LB_X-10+LB_BALL_R+barW+22,cy2,0,LB_X-10+LB_BALL_R+barW+22,cy2,LB_BALL_R);
      bg2.addColorStop(0,alive.length?t.color+'ff':'#555');
      bg2.addColorStop(1,alive.length?t.color+'88':'#222');
      ctx.fillStyle=bg2;
      ctx.beginPath(); ctx.arc(LB_X+20+barW+LB_BALL_R+2,cy2,LB_BALL_R,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='rgba(0,0,0,0.8)'; ctx.font='bold 11px Rajdhani, Courier New';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(_G.roundWins[t.id]??0, LB_X+20+barW+LB_BALL_R+2, cy2);
    });
    // Bottom border
    ctx.strokeStyle=hdrGrad; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(LB_X-12,LB_Y+lbH+12); ctx.lineTo(W-LB_X+12,LB_Y+lbH+12); ctx.stroke();
    return;
  }

  // Draw top 4 by damage — using animated lbY position
  const sorted=[..._G.balls].sort((a,b)=>a.lbRank-b.lbRank);
  ctx.save();
  ctx.beginPath(); ctx.rect(0, LB_Y-4, W, lbH+8); ctx.clip();
  sorted.forEach((b,slot)=>{
    if(b.lbRank >= 4 && b.lbY > LB_Y + lbH) return;
    const barY=b.lbY;
    const barW=Math.max(8, _G.lbWidths[b.id]);
    const isLeader=b.lbRank===0 && b.alive;
    const dfl=_G.dmgFlash[b.id];
    const rankFlash=b.lbRankUpFlash>0;
    const cy2=barY+LB_BAR_H/2;

    // Rank number badge
    const rankColors=['#ffd700','#c0c0c0','#cd7f32','#888'];
    const rankCol = b.lbRank<4 ? rankColors[b.lbRank] : '#444';
    ctx.fillStyle=rankFlash?'rgba(255,255,100,0.9)':`rgba(0,0,0,0.7)`;
    ctx.beginPath(); ctx.roundRect(LB_X-10, barY+4, 26, LB_BAR_H-8, 4); ctx.fill();
    ctx.fillStyle=rankCol;
    ctx.font=`bold 14px Rajdhani, Courier New`;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(`${b.lbRank+1}`, LB_X+3, cy2);

    // Bar track with scanline texture
    ctx.fillStyle='rgba(255,255,255,0.03)';
    ctx.beginPath(); ctx.roundRect(LB_X+20,barY,LB_BAR_MAX-20,LB_BAR_H,4); ctx.fill();

    // Bar fill
    if(barW>8){
      const grad=ctx.createLinearGradient(LB_X+20,0,LB_X+20+barW,0);
      grad.addColorStop(0, b.alive?b.color+'22':b.color+'08');
      grad.addColorStop(0.5, b.alive?b.color+'88':b.color+'20');
      grad.addColorStop(1, b.alive?b.color+'ee':b.color+'30');
      ctx.fillStyle=grad;
      ctx.beginPath(); ctx.roundRect(LB_X+20,barY,barW,LB_BAR_H,4); ctx.fill();
      // Shine top
      ctx.fillStyle='rgba(255,255,255,0.06)';
      ctx.beginPath(); ctx.roundRect(LB_X+22,barY+2,barW-4,LB_BAR_H/3,3); ctx.fill();
    }

    // Rank-up flash overlay
    if(rankFlash){
      ctx.globalAlpha=(b.lbRankUpFlash/25)*0.35;
      ctx.fillStyle=b.color;
      ctx.beginPath(); ctx.roundRect(LB_X+20,barY,LB_BAR_MAX-20,LB_BAR_H,4); ctx.fill();
      ctx.globalAlpha=1;
    }

    // Leader glow border — iridescent
    if(isLeader){
      const pulse=0.5+0.5*Math.sin(frame*0.12);
      ctx.strokeStyle = iridGrad(ctx, LB_X+20,0, LB_X+20+barW,0, frame, 0.4+0.4*pulse);
      ctx.lineWidth=2.5;
      ctx.beginPath(); ctx.roundRect(LB_X+20,barY,barW,LB_BAR_H,4); ctx.stroke();
    }

    // Damage flash tint
    if(dfl>0 && b.alive){
      ctx.globalAlpha=(dfl/12)*0.18;
      ctx.fillStyle='#fff';
      ctx.beginPath(); ctx.roundRect(LB_X+20,barY,barW,LB_BAR_H,4); ctx.fill();
      ctx.globalAlpha=1;
    }

    // Ball icon at bar tip
    const ballX=LB_X+20+barW+LB_BALL_R+2;
    const ballY=cy2;
    if(b.rage>0&&b.alive){
      const rp=0.5+0.5*Math.sin(frame*0.2);
      ctx.globalAlpha=0.5+0.3*rp; ctx.fillStyle='#ffcc00';
      ctx.beginPath(); ctx.arc(ballX,ballY,LB_BALL_R+4+rp*3,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha=1;
    }
    const bg2=ctx.createRadialGradient(ballX-4,ballY-4,0,ballX,ballY,LB_BALL_R);
    bg2.addColorStop(0,b.alive?b.color+'ff':'#555');
    bg2.addColorStop(1,b.alive?b.color+'88':'#222');
    ctx.fillStyle=bg2;
    ctx.beginPath(); ctx.arc(ballX,ballY,LB_BALL_R,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(0,0,0,0.8)'; ctx.font='bold 11px Rajdhani, Courier New';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(_G.roundWins[b.id],ballX,ballY);

    // Name
    const nameFont=`${isLeader?'bold ':''}${isLeader?19:16}px Rajdhani, Courier New`;
    ctx.font=nameFont;
    ctx.fillStyle=b.alive?(isLeader?'#fff':b.color+'cc'):'rgba(255,255,255,0.25)';
    ctx.textAlign='left'; ctx.textBaseline='middle';
    ctx.fillText(b.name, LB_X+30, cy2);

    // OUT badge
    if(!b.alive){
      ctx.fillStyle='rgba(255,50,50,0.15)';
      ctx.beginPath(); ctx.roundRect(LB_X+30+60,cy2-9,36,18,9); ctx.fill();
      ctx.fillStyle='#ff5050'; ctx.font='bold 12px Rajdhani, Courier New';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('OUT',LB_X+30+78,cy2);
    }
    // Streak badge
    if(b.streak>=2&&b.alive){
      const sc=b.streak>=5?'#ff8833':b.streak>=3?'#ffdd33':'#ff6666';
      ctx.fillStyle='rgba(0,0,0,0.6)';
      ctx.beginPath(); ctx.roundRect(LB_X+30+60,cy2-9,44,18,9); ctx.fill();
      ctx.fillStyle=sc; ctx.font='bold 13px Rajdhani, Courier New';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(`\ud83d\udc80${b.streak}`,LB_X+30+82,cy2);
    }

    // Damage number
    const dmg=_G.roundDmg[b.id];
    if(dmg>0){
      const dmgScale=dfl>0?1+(dfl/12)*0.35:1;
      const dmgSize=isLeader?26:22;
      const cx=LB_X+20+Math.max(barW*0.5,50);
      ctx.save(); ctx.translate(cx,cy2); ctx.scale(dmgScale,dmgScale);
      ctx.font=`bold ${dmgSize}px Rajdhani, Courier New`;
      const tw=ctx.measureText(`${dmg}`).width;
      ctx.fillStyle='rgba(0,0,0,0.65)';
      ctx.beginPath(); ctx.roundRect(-tw/2-6,-dmgSize/2-1,tw+12,dmgSize+2,5); ctx.fill();
      ctx.fillStyle=dfl>0?`rgba(255,220,50,1)`:(isLeader?'#fff':'rgba(255,255,255,0.85)');
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(`${dmg}`,0,0);
      ctx.restore();
    }
  });
  ctx.restore();

  // Bottom border
  ctx.strokeStyle=hdrGrad; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(LB_X-12,LB_Y+lbH+12); ctx.lineTo(W-LB_X+12,LB_Y+lbH+12); ctx.stroke();
}

// ════════════════════════════════════════════════
// DRAW: LAST 2 ALERT
// ════════════════════════════════════════════════
function drawLastTwo(ctx, frame){
  if(_G.lastTwoTimer<=0) return;
  const t=_G.lastTwoTimer;
  const scale=t>120?(1.4-(t-120)/30*0.4):t<30?(0.9+t/30*0.1):1.0;
  const alpha=t<30?t/30:1;
  const pulse=0.5+0.5*Math.sin(frame*0.25);
  ctx.save();
  ctx.globalAlpha=alpha;
  ctx.translate(ACX,ACY-100);
  ctx.scale(scale,scale);
  // Outer glow
  ctx.fillStyle=`rgba(255,0,0,${0.08+0.06*pulse})`;
  ctx.beginPath(); ctx.roundRect(-230,-58,460,116,18); ctx.fill();
  // Main pill
  const pillGrad=ctx.createLinearGradient(-220,0,220,0);
  pillGrad.addColorStop(0,'rgba(180,0,0,0.95)');
  pillGrad.addColorStop(0.5,'rgba(255,40,40,0.98)');
  pillGrad.addColorStop(1,'rgba(180,0,0,0.95)');
  ctx.fillStyle=pillGrad;
  ctx.beginPath(); ctx.roundRect(-210,-48,420,96,14); ctx.fill();
  // Shimmer top edge
  ctx.fillStyle=`rgba(255,255,255,${0.06+0.04*pulse})`;
  ctx.beginPath(); ctx.roundRect(-210,-48,420,18,14); ctx.fill();
  // Side accent lines
  ctx.strokeStyle=`rgba(255,150,150,${0.5+0.3*pulse})`; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(-220,-52); ctx.lineTo(-220,52); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(220,-52); ctx.lineTo(220,52); ctx.stroke();
  // Text shadow
  ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.font='bold 72px Rajdhani, Courier New';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('FINAL 2!',3,3);
  // Main text — iridescent
  ctx.font='bold 72px Rajdhani, Courier New';
  ctx.fillStyle = iridGrad(ctx, -200,0, 200,0, frame);
  ctx.shadowColor = iridColor(frame, 100, 72, 0.8);
  ctx.shadowBlur=18;
  ctx.fillText('FINAL 2!',0,0);
  ctx.shadowBlur=0;
  ctx.restore();
}

// ════════════════════════════════════════════════
// pushToRec
// ════════════════════════════════════════════════
export function pushToRec(){ _RC.drawImage(_DC,0,0); }

// ════════════════════════════════════════════════
// FPS COUNTER (display only — not recorded)
// ════════════════════════════════════════════════
let _fpsSamples = [], _fpsDisplay = 0;
export function drawFPS(ctx, now){
  _fpsSamples.push(now);
  while(_fpsSamples.length > 0 && now - _fpsSamples[0] > 1000) _fpsSamples.shift();
  _fpsDisplay = _fpsSamples.length;
  const fps = _fpsDisplay;
  const color = fps >= 55 ? '#00ff88' : fps >= 45 ? '#ffdd00' : '#ff3300';
  ctx.save();
  ctx.font = `bold ${30*SCALE|0}px monospace`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(OUT_W - 132*SCALE, 9*SCALE, 123*SCALE, 39*SCALE);
  ctx.fillStyle = color;
  ctx.fillText(`${fps} FPS`, OUT_W - 15*SCALE, 15*SCALE);
  ctx.restore();
}

// ════════════════════════════════════════════════
// DRAW: MAIN
// ════════════════════════════════════════════════
let frame=0;
export function getFrame(){ return frame; }
// ════════════════════════════════════════════════
// DRAW: DUNGEON ROOM VISUALS (replaces circular arena)
// ════════════════════════════════════════════════
function drawDungeonRoomVisuals(ctx, frame, rr, roomDef){
  const {left, top, right, bottom, w, h} = rr;
  const pulse = 0.5+0.5*Math.sin(frame*0.1);
  const isBossRoom = _G.dungeonRoom >= _G.dungeonTotalRooms;

  // ── Clip to room rect ──
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(left-2, top-2, w+4, h+4, 6);
  ctx.clip();

  // ── Floor ──
  ctx.fillStyle = roomDef.floor;
  ctx.fillRect(left, top, w, h);

  // Floor tile pattern
  const tileSize = 48;
  ctx.strokeStyle = `rgba(255,255,255,0.03)`;
  ctx.lineWidth = 0.5;
  for(let tx=left; tx<right; tx+=tileSize){
    ctx.beginPath(); ctx.moveTo(tx, top); ctx.lineTo(tx, bottom); ctx.stroke();
  }
  for(let ty=top; ty<bottom; ty+=tileSize){
    ctx.beginPath(); ctx.moveTo(left, ty); ctx.lineTo(right, ty); ctx.stroke();
  }
  // Darker tile alternating pattern
  ctx.fillStyle = 'rgba(0,0,0,0.06)';
  for(let tx=left; tx<right; tx+=tileSize){
    for(let ty=top; ty<bottom; ty+=tileSize){
      const txi = Math.floor((tx-left)/tileSize), tyi = Math.floor((ty-top)/tileSize);
      if((txi+tyi)%2===0) ctx.fillRect(tx, ty, tileSize, tileSize);
    }
  }

  // Floor vignette (darker edges)
  const vg = ctx.createRadialGradient(ACX, ACY, Math.min(w,h)*0.2, ACX, ACY, Math.max(w,h)*0.6);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.4)');
  ctx.fillStyle = vg;
  ctx.fillRect(left, top, w, h);

  // Boss room: red floor glow
  if(isBossRoom){
    const bg = ctx.createRadialGradient(ACX, ACY, 0, ACX, ACY, Math.max(w,h)*0.5);
    bg.addColorStop(0, `rgba(180,0,0,${0.12+0.06*pulse})`);
    bg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = bg;
    ctx.fillRect(left, top, w, h);
  }

  // ── Arena kill flash (inside room) ──
  if(_G.arenaFlash.alpha>0){
    ctx.globalAlpha=_G.arenaFlash.alpha;
    ctx.fillStyle=_G.arenaFlash.color;
    ctx.fillRect(left, top, w, h);
    ctx.globalAlpha=1;
    _G.arenaFlash.alpha=Math.max(0,_G.arenaFlash.alpha-0.03);
  }

  // ── Speed lines inside room ──
  const alive=_G.alive();
  const maxSpd=alive.length?Math.max(...alive.map(b=>Math.hypot(b.vx,b.vy))):0;
  if(maxSpd>6){
    const intensity=Math.min(1,(maxSpd-6)/10);
    ctx.strokeStyle=`rgba(255,255,255,${intensity*0.12})`; ctx.lineWidth=1;
    for(let i=0;i<12;i++){
      const a=(frame*0.02)+i*(Math.PI*2/12);
      const r1=40+Math.sin(frame*0.05+i)*20;
      ctx.beginPath(); ctx.moveTo(ACX+Math.cos(a)*r1,ACY+Math.sin(a)*r1);
      ctx.lineTo(ACX+Math.cos(a)*Math.max(w,h)*0.45,ACY+Math.sin(a)*Math.max(w,h)*0.45); ctx.stroke();
    }
  }

  // ── Particles ──
  for(const p of parts){
    ctx.globalAlpha=p.life/p.max;
    ctx.fillStyle=p.color;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r*(p.life/p.max),0,Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha=1;

  // ── Orbs ──
  drawOrbs(ctx, frame);

  // ── FX Effects ──
  drawFX(ctx, frame);

  // ── Balls ──
  for(const b of _G.balls){
    if(!b.alive) continue;
    // Trail
    for(let t=0;t<b.trail.length;t++){
      const a=(t+1)/(b.trail.length+1)*0.38;
      ctx.globalAlpha=a; ctx.fillStyle=b.color;
      ctx.beginPath(); ctx.arc(b.trail[t].x,b.trail[t].y,b.r*((t+1)/(b.trail.length+1)),0,Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha=1;
    const inRage=b.rage>0;
    if(inRage){
      const rp=0.5+0.5*Math.sin(frame*0.18);
      ctx.globalAlpha=0.5+0.45*rp;
      ctx.fillStyle='#ffcc00';
      ctx.beginPath(); ctx.arc(b.x,b.y,b.r+10+rp*8,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha=1;
    }
    // Ball body
    { const col = b.flash>0 ? '#ffffff' : b.color;
      const bg = ctx.createRadialGradient(b.x-b.r*0.3, b.y-b.r*0.3, b.r*0.05, b.x, b.y, b.r);
      bg.addColorStop(0, '#ffffff'); bg.addColorStop(0.15, col+'ff');
      bg.addColorStop(0.55, col+'cc'); bg.addColorStop(1, col+'33');
      ctx.fillStyle = bg;
      ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha = 0.38; ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.ellipse(b.x-b.r*0.25, b.y-b.r*0.28, b.r*0.42, b.r*0.26, -Math.PI/4, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    // Shield
    if(b.shieldFrames>0){
      const sp=0.5+0.5*Math.sin(frame*0.15);
      ctx.globalAlpha=0.6+0.3*sp; ctx.strokeStyle='#44aaff'; ctx.lineWidth=4;
      ctx.beginPath(); ctx.arc(b.x,b.y,b.r+8+sp*4,0,Math.PI*2); ctx.stroke(); ctx.globalAlpha=1;
    }
    // Ghost
    if(b.ghostFrames>0){ ctx.globalAlpha=0.35; ctx.fillStyle='#aaffee';
      ctx.beginPath(); ctx.arc(b.x,b.y,b.r+6,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1; }
    // Dungeon player glow
    if(b.isDungeonPlayer){
      const dp=0.5+0.5*Math.sin(frame*0.1);
      ctx.globalAlpha=0.25+0.15*dp; ctx.strokeStyle='#00eeff'; ctx.lineWidth=3+dp*2;
      ctx.beginPath(); ctx.arc(b.x,b.y,b.r+8+dp*4,0,Math.PI*2); ctx.stroke(); ctx.globalAlpha=1;
    }
    // Dungeon boss
    if(b.isDungeonBoss){
      const dbp=0.5+0.5*Math.sin(frame*0.08);
      ctx.globalAlpha=0.45+0.25*dbp; ctx.strokeStyle='#ff2200'; ctx.lineWidth=5+dbp*3;
      ctx.beginPath(); ctx.arc(b.x,b.y,b.r+12+dbp*6,0,Math.PI*2); ctx.stroke();
      ctx.globalAlpha=0.20+0.15*dbp; ctx.strokeStyle='#ff8800'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(b.x,b.y,b.r+22+dbp*8,0,Math.PI*2); ctx.stroke(); ctx.globalAlpha=1;
      ctx.font=`bold ${Math.floor(b.r*0.7)}px Rajdhani, Courier New`;
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillStyle='#ffdd00'; ctx.shadowColor='#ff8800'; ctx.shadowBlur=14;
      ctx.fillText('\u2620', b.x, b.y - b.r - 22); ctx.shadowBlur=0;
      ctx.font='bold 13px Rajdhani, Courier New'; ctx.fillStyle='#ff4400';
      ctx.fillText('BOSS', b.x, b.y - b.r - 40);
    }
    // Dungeon enemy indicator
    if(b.isDungeonEnemy && !b.isDungeonBoss){
      ctx.globalAlpha=0.3; ctx.strokeStyle='#ff4444'; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.arc(b.x,b.y,b.r+4,0,Math.PI*2); ctx.stroke(); ctx.globalAlpha=1;
    }
    if(inRage){
      ctx.globalAlpha=0.28+0.18*Math.sin(frame*0.22);
      ctx.fillStyle='#ffdd00';
      ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1;
    }
    // HP inside ball
    ctx.fillStyle = b.flash>0 ? b.color : 'rgba(0,0,0,0.75)';
    ctx.font = b.isDungeonBoss ? 'bold 20px Rajdhani, Courier New' : 'bold 15px Rajdhani, Courier New';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(Math.ceil(b.hp), b.x, b.y);
    // Name above
    if(!b.isDungeonBoss){
      ctx.font='bold 11px Rajdhani, Courier New'; ctx.fillStyle=b.color;
      ctx.fillText(b.name, b.x, b.y-b.r-18);
    }
    // HP bar
    { const bw=b.r*2.6, bh=6, bx=b.x-bw/2, by=b.y-b.r-13;
      const rat=b.hp/b.max;
      ctx.fillStyle='rgba(0,0,0,0.55)';
      ctx.beginPath(); ctx.roundRect(bx,by,bw,bh,3); ctx.fill();
      const fillW=bw*rat;
      const hpColor = b.isDungeonPlayer ? (rat>0.5?'#22dd44':rat>0.25?'#ddcc00':'#ee3333')
        : (rat>0.5?'#dd3333':rat>0.25?'#dd6633':'#dd9933');
      if(fillW>0){ ctx.fillStyle=hpColor; ctx.beginPath(); ctx.roundRect(bx,by,fillW,bh,3); ctx.fill(); }
      ctx.globalAlpha=0.22; ctx.fillStyle='#fff';
      if(fillW>0){ ctx.beginPath(); ctx.roundRect(bx,by,fillW,bh/2,{upperLeft:3,upperRight:3,lowerLeft:0,lowerRight:0}); ctx.fill(); }
      ctx.globalAlpha=1;
    }
  }

  ctx.restore(); // end room clip

  // ── Wall decorations (OUTSIDE clip, on top) ──
  const wallW = 14;
  // Stone walls — outer border
  ctx.fillStyle = roomDef.stone;
  ctx.fillRect(left-wallW, top-wallW, w+wallW*2, wallW); // top wall
  ctx.fillRect(left-wallW, bottom, w+wallW*2, wallW);     // bottom wall
  ctx.fillRect(left-wallW, top, wallW, h);                 // left wall
  ctx.fillRect(right, top, wallW, h);                      // right wall

  // Stone block texture on walls
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth=1;
  const blockW=32, blockH=wallW;
  for(let bx=left-wallW; bx<right+wallW; bx+=blockW){
    // Top wall blocks
    ctx.strokeRect(bx, top-wallW, blockW, blockH);
    // Bottom wall blocks
    ctx.strokeRect(bx, bottom, blockW, blockH);
  }
  for(let by=top; by<bottom; by+=blockW){
    ctx.strokeRect(left-wallW, by, wallW, blockW);
    ctx.strokeRect(right, by, wallW, blockW);
  }

  // Wall inner edge highlight
  ctx.strokeStyle = roomDef.accent; ctx.lineWidth=2;
  ctx.strokeRect(left-1, top-1, w+2, h+2);

  // Outer wall shadow
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth=3;
  ctx.strokeRect(left-wallW-1, top-wallW-1, w+wallW*2+2, h+wallW*2+2);

  // ── Corner pillars ──
  const pillarR = 12;
  [[left, top],[right, top],[left, bottom],[right, bottom]].forEach(([cx,cy])=>{
    const pg = ctx.createRadialGradient(cx-3,cy-3,0,cx,cy,pillarR);
    pg.addColorStop(0, '#888'); pg.addColorStop(0.4, roomDef.accent); pg.addColorStop(1, '#222');
    ctx.fillStyle=pg;
    ctx.beginPath(); ctx.arc(cx,cy,pillarR,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,0.6)'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(cx,cy,pillarR,0,Math.PI*2); ctx.stroke();
  });

  // ── Torch flames on walls ──
  const torchPositions = [];
  // Top wall torches
  torchPositions.push([left + w*0.25, top-4], [left + w*0.75, top-4]);
  // Bottom wall torches
  torchPositions.push([left + w*0.25, bottom+4], [left + w*0.75, bottom+4]);
  // Side wall torches
  if(h > 300) {
    torchPositions.push([left-4, top + h*0.5], [right+4, top + h*0.5]);
  }

  torchPositions.forEach(([tx,ty])=>{
    const flicker = 0.7 + 0.3*Math.sin(frame*0.3 + tx*0.1);
    const flicker2 = 0.5+0.5*Math.sin(frame*0.5+ty*0.2);
    // Flame glow
    const fg = ctx.createRadialGradient(tx,ty-6,0,tx,ty-2,18+flicker*6);
    fg.addColorStop(0, `rgba(255,200,50,${0.6*flicker})`);
    fg.addColorStop(0.3, `rgba(255,120,20,${0.3*flicker})`);
    fg.addColorStop(1, 'rgba(255,60,0,0)');
    ctx.fillStyle=fg;
    ctx.beginPath(); ctx.arc(tx,ty-4,18+flicker*6,0,Math.PI*2); ctx.fill();
    // Flame core
    ctx.fillStyle=`rgba(255,${Math.floor(200+55*flicker2)},${Math.floor(50+50*flicker2)},${0.9*flicker})`;
    ctx.beginPath();
    ctx.ellipse(tx, ty-8-flicker*3, 4+flicker2*2, 8+flicker*4, 0, 0, Math.PI*2);
    ctx.fill();
    // Torch base
    ctx.fillStyle='#554433';
    ctx.fillRect(tx-3, ty-2, 6, 8);
  });

  // ── Room name label ──
  ctx.globalAlpha = 0.25+0.1*pulse;
  ctx.font = 'bold 16px Rajdhani, Courier New';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = roomDef.accent;
  ctx.fillText(roomDef.name, ACX, top - wallW - 10);
  ctx.globalAlpha = 1;
}

// ════════════════════════════════════════════════
// DRAW: DUNGEON HUD
// ════════════════════════════════════════════════
function drawDungeonHUD(ctx, frame){
  const player = _G.dungeonPlayer;
  if(!player) return;
  const pulse = 0.5+0.5*Math.sin(frame*0.12);

  // ── Panel background ──
  const PANEL_X = 20, PANEL_Y = 862, PANEL_W = W-40, PANEL_H = 390;
  ctx.fillStyle='rgba(0,0,8,0.88)';
  ctx.beginPath(); ctx.roundRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 12); ctx.fill();
  ctx.strokeStyle=`rgba(0,220,255,${0.25+0.15*pulse})`; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.roundRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H, 12); ctx.stroke();

  // ── PLAYER HP BAR ──
  const BAR_X = PANEL_X+16, BAR_Y = PANEL_Y+52, BAR_W = PANEL_W-32, BAR_H = 48;

  // Player label + HP numbers
  ctx.fillStyle='#00eeff'; ctx.font='bold 26px Rajdhani, Courier New';
  ctx.textAlign='left'; ctx.textBaseline='middle';
  ctx.shadowColor='#00aaff'; ctx.shadowBlur=14;
  ctx.fillText(`\u2694 ${player.name}`, BAR_X, PANEL_Y+28);
  ctx.shadowBlur=0;

  const pct = Math.max(0, player.hp / player.max);
  ctx.fillStyle = pct>0.5?'#22dd44':pct>0.25?'#ddcc00':'#ee3333';
  ctx.font='bold 26px Rajdhani, Courier New';
  ctx.textAlign='right';
  ctx.fillText(`${Math.ceil(Math.max(0,player.hp))} / ${player.max}`, BAR_X+BAR_W, PANEL_Y+28);

  // Bar track
  ctx.fillStyle='rgba(8,30,20,0.95)';
  ctx.beginPath(); ctx.roundRect(BAR_X, BAR_Y, BAR_W, BAR_H, 6); ctx.fill();

  // HP fill
  const fillW = BAR_W * pct;
  if(fillW > 2){
    const hpGrad = ctx.createLinearGradient(BAR_X, 0, BAR_X+BAR_W, 0);
    if(pct>0.5){
      hpGrad.addColorStop(0, '#11aa33'); hpGrad.addColorStop(0.5, '#22dd44'); hpGrad.addColorStop(1, '#44ff66');
    } else if(pct>0.25){
      hpGrad.addColorStop(0, '#aa8800'); hpGrad.addColorStop(0.5, '#ddcc00'); hpGrad.addColorStop(1, '#ffee22');
    } else {
      hpGrad.addColorStop(0, '#881111'); hpGrad.addColorStop(0.5, '#cc2222'); hpGrad.addColorStop(1, '#ee4444');
    }
    ctx.fillStyle=hpGrad;
    ctx.beginPath(); ctx.roundRect(BAR_X, BAR_Y, fillW, BAR_H, 6); ctx.fill();
    // Shine stripe
    const shineX = BAR_X + ((frame*3) % (fillW+60)) - 30;
    ctx.globalAlpha=0.18;
    ctx.fillStyle='#fff';
    ctx.beginPath(); ctx.roundRect(Math.max(BAR_X,shineX), BAR_Y, 28, BAR_H, 3); ctx.fill();
    ctx.globalAlpha=1;
    // Pulsing edge glow
    ctx.globalAlpha=0.5+0.35*pulse;
    ctx.strokeStyle=pct>0.5?'#44ff66':pct>0.25?'#ffee22':'#ff4444'; ctx.lineWidth=2.5;
    ctx.beginPath(); ctx.roundRect(BAR_X, BAR_Y, fillW, BAR_H, 6); ctx.stroke();
    ctx.globalAlpha=1;
  }

  // ── ROOM PROGRESS ──
  const progY = BAR_Y + BAR_H + 20;
  ctx.textAlign='center'; ctx.font='bold 22px Rajdhani, Courier New';
  ctx.fillStyle=`rgba(200,210,255,${0.8+0.15*pulse})`;
  ctx.fillText(`ROOM ${_G.dungeonRoom} / ${_G.dungeonTotalRooms}`, W/2, progY);

  // Room dots
  const dotY = progY + 28;
  const dotR = 10, dotGap = 36;
  const totalDots = _G.dungeonTotalRooms;
  const startX = W/2 - (totalDots-1)*dotGap/2;
  for(let i=0; i<totalDots; i++){
    const dx = startX + i*dotGap;
    const roomNum = i+1;
    const isCurrent = roomNum === _G.dungeonRoom;
    const isCleared = roomNum < _G.dungeonRoom;
    const isBoss = roomNum === totalDots;

    if(isCleared){
      ctx.fillStyle='#22dd44';
      ctx.beginPath(); ctx.arc(dx, dotY, dotR, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle='#fff'; ctx.font='bold 12px Rajdhani, Courier New';
      ctx.fillText('\u2713', dx, dotY);
    } else if(isCurrent){
      ctx.fillStyle=`rgba(0,220,255,${0.6+0.4*pulse})`;
      ctx.beginPath(); ctx.arc(dx, dotY, dotR+2, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle='#00eeff'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(dx, dotY, dotR+5+pulse*3, 0, Math.PI*2); ctx.stroke();
      ctx.fillStyle='#fff'; ctx.font='bold 12px Rajdhani, Courier New';
      ctx.fillText(`${roomNum}`, dx, dotY);
    } else {
      ctx.fillStyle=isBoss?'rgba(255,34,0,0.5)':'rgba(100,100,120,0.5)';
      ctx.beginPath(); ctx.arc(dx, dotY, dotR, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle=isBoss?'#ff4444':'#666'; ctx.font='bold 12px Rajdhani, Courier New';
      ctx.fillText(isBoss?'\u2620':`${roomNum}`, dx, dotY);
    }
  }

  // ── ENEMIES ALIVE ──
  const enemies = _G.dungeonAliveEnemies();
  const enemyY = dotY + 36;
  ctx.textAlign='center'; ctx.font='bold 20px Rajdhani, Courier New';
  ctx.fillStyle=`rgba(255,${enemies.length>0?'100,100':'200,200'},${0.8+0.15*pulse})`;
  const isBossRoom = _G.dungeonRoom >= _G.dungeonTotalRooms;
  ctx.fillText(
    enemies.length>0
      ? `${isBossRoom?'\u2620':'\u2694'} ENEMIES: ${enemies.length} remaining`
      : '\u2713 ROOM CLEARED!',
    W/2, enemyY
  );

  // ── ENEMY HP BARS ──
  const miniBarY = enemyY + 20;
  const miniBarH = 14, miniBarW = PANEL_W - 80, miniBarGap = 20;

  if(isBossRoom){
    // Boss room: draw boss with a large prominent bar, minions with mini bars below
    const boss = enemies.find(e=>e.isDungeonBoss);
    const minions = enemies.filter(e=>!e.isDungeonBoss);

    if(boss){
      const BOSS_BAR_Y = miniBarY;
      const BOSS_BAR_H = 46;
      const epct = Math.max(0, boss.hp / boss.max);

      // Boss label + HP numbers
      ctx.shadowColor='#ff2200'; ctx.shadowBlur=16;
      ctx.fillStyle='#ff4444'; ctx.font='bold 24px Rajdhani, Courier New';
      ctx.textAlign='left'; ctx.textBaseline='middle';
      ctx.fillText(`\u2620 ${boss.name}`, BAR_X, BOSS_BAR_Y - 14);
      ctx.shadowBlur=0;

      ctx.fillStyle=epct>0.5?'#ff8866':epct>0.25?'#ff5522':'#ff2200';
      ctx.font='bold 24px Rajdhani, Courier New';
      ctx.textAlign='right';
      ctx.fillText(`${Math.ceil(Math.max(0,boss.hp))} / ${boss.max}`, BAR_X+BAR_W, BOSS_BAR_Y - 14);

      // Track
      ctx.fillStyle='rgba(60,8,8,0.95)';
      ctx.beginPath(); ctx.roundRect(BAR_X, BOSS_BAR_Y, BAR_W, BOSS_BAR_H, 6); ctx.fill();

      // HP fill with fire gradient
      const bFillW = BAR_W * epct;
      if(bFillW > 2){
        const bGrad = ctx.createLinearGradient(BAR_X, 0, BAR_X+BAR_W, 0);
        if(epct > 0.5){
          bGrad.addColorStop(0,'#aa1100'); bGrad.addColorStop(0.5,'#ff3300'); bGrad.addColorStop(1,'#ff6600');
        } else if(epct > 0.25){
          bGrad.addColorStop(0,'#880000'); bGrad.addColorStop(0.5,'#cc2200'); bGrad.addColorStop(1,'#ff4400');
        } else {
          bGrad.addColorStop(0,'#550000'); bGrad.addColorStop(0.5,'#991100'); bGrad.addColorStop(1,'#cc2200');
        }
        ctx.fillStyle=bGrad;
        ctx.beginPath(); ctx.roundRect(BAR_X, BOSS_BAR_Y, bFillW, BOSS_BAR_H, 6); ctx.fill();
        // Pulsing edge glow
        ctx.globalAlpha=0.45+0.35*pulse;
        ctx.strokeStyle='#ff2200'; ctx.lineWidth=2.5;
        ctx.beginPath(); ctx.roundRect(BAR_X, BOSS_BAR_Y, bFillW, BOSS_BAR_H, 6); ctx.stroke();
        ctx.globalAlpha=1;
      }

      // Minion mini bars below boss bar
      if(minions.length > 0){
        const minionStartY = BOSS_BAR_Y + BOSS_BAR_H + 18;
        minions.forEach((e, i) => {
          const by = minionStartY + i * (miniBarH + miniBarGap);
          const mpct = Math.max(0, e.hp / e.max);
          ctx.textAlign='left'; ctx.font='bold 13px Rajdhani, Courier New'; ctx.textBaseline='middle';
          ctx.fillStyle=e.color;
          ctx.fillText(e.name, PANEL_X+20, by+miniBarH/2);
          const mbx=PANEL_X+90, mbw=miniBarW-70;
          ctx.fillStyle='rgba(40,20,20,0.8)';
          ctx.beginPath(); ctx.roundRect(mbx, by, mbw, miniBarH, 3); ctx.fill();
          const mFillW = mbw * mpct;
          if(mFillW > 1){ ctx.fillStyle=mpct>0.5?'#dd4444':'#ff6644'; ctx.beginPath(); ctx.roundRect(mbx, by, mFillW, miniBarH, 3); ctx.fill(); }
          ctx.textAlign='right'; ctx.font='bold 12px Rajdhani, Courier New';
          ctx.fillStyle='#ddd';
          ctx.fillText(`${Math.ceil(e.hp)}`, PANEL_X+PANEL_W-20, by+miniBarH/2);
        });
      }
    }
  } else {
    // Normal rooms: mini bars for all enemies (up to 5)
    const visibleEnemies = enemies.slice(0, 5);
    visibleEnemies.forEach((e, i) => {
      const by = miniBarY + i * (miniBarH + miniBarGap);
      const epct = Math.max(0, e.hp / e.max);
      ctx.textAlign='left'; ctx.font='bold 13px Rajdhani, Courier New'; ctx.textBaseline='middle';
      ctx.fillStyle=e.color;
      ctx.fillText(e.name, PANEL_X+20, by+miniBarH/2);
      const mbx=PANEL_X+90, mbw=miniBarW-70;
      ctx.fillStyle='rgba(40,20,20,0.8)';
      ctx.beginPath(); ctx.roundRect(mbx, by, mbw, miniBarH, 3); ctx.fill();
      const eFillW = mbw * epct;
      if(eFillW > 1){ ctx.fillStyle=epct>0.5?'#dd4444':'#ff6644'; ctx.beginPath(); ctx.roundRect(mbx, by, eFillW, miniBarH, 3); ctx.fill(); }
      ctx.textAlign='right'; ctx.font='bold 12px Rajdhani, Courier New';
      ctx.fillStyle='#ddd';
      ctx.fillText(`${Math.ceil(e.hp)}`, PANEL_X+PANEL_W-20, by+miniBarH/2);
    });
    if(enemies.length > 5){
      ctx.textAlign='center'; ctx.font='bold 14px Rajdhani, Courier New';
      ctx.fillStyle='rgba(200,200,220,0.6)';
      ctx.fillText(`+${enemies.length-5} more`, W/2, miniBarY + 5*(miniBarH+miniBarGap));
    }
  }
}

// ════════════════════════════════════════════════
// DRAW: DUNGEON ROOM TRANSITION
// ════════════════════════════════════════════════
function drawDungeonRoomTransition(ctx, frame){
  const dur = C.DUNGEON.ROOM_TRANSITION_DUR;
  const remaining = _G.dungeonRoomTransFrame;
  const prog = 1 - remaining / dur; // 0→1

  // Dark overlay
  const darkAlpha = prog < 0.5 ? prog*2*0.85 : (1-prog)*2*0.85;
  ctx.fillStyle=`rgba(0,0,0,${darkAlpha})`;
  ctx.fillRect(0, 0, W, H);

  // Room cleared text (first half)
  if(prog < 0.55){
    const textAlpha = prog < 0.1 ? prog/0.1 : prog > 0.45 ? (0.55-prog)/0.1 : 1;
    ctx.save();
    ctx.globalAlpha = textAlpha;
    ctx.textAlign='center'; ctx.textBaseline='middle';

    // "ROOM CLEARED" text
    ctx.font='bold 72px Rajdhani, Courier New';
    const clearGrad = iridGrad(ctx, W/2-200, 0, W/2+200, 0, frame, 1);
    ctx.fillStyle=clearGrad;
    ctx.shadowColor='rgba(0,255,128,0.8)'; ctx.shadowBlur=30;
    ctx.fillText('ROOM CLEARED!', W/2, H*0.42);
    ctx.shadowBlur=0;

    // Room progress text
    ctx.font='bold 36px Rajdhani, Courier New';
    ctx.fillStyle='rgba(200,220,255,0.9)';
    ctx.fillText(`${_G.dungeonRoom} / ${_G.dungeonTotalRooms}`, W/2, H*0.52);

    ctx.restore();
  }

  // Next room text (second half)
  if(prog > 0.5){
    const textAlpha = prog < 0.6 ? (prog-0.5)/0.1 : prog > 0.9 ? (1-prog)/0.1 : 1;
    ctx.save();
    ctx.globalAlpha = textAlpha;
    ctx.textAlign='center'; ctx.textBaseline='middle';

    const nextRoom = _G.dungeonRoom;
    const isBoss = nextRoom >= _G.dungeonTotalRooms;

    ctx.font=`bold ${isBoss?80:64}px Rajdhani, Courier New`;
    ctx.fillStyle=isBoss?'#ff4444':'#ffffff';
    ctx.shadowColor=isBoss?'#ff0000':'rgba(100,200,255,0.8)'; ctx.shadowBlur=24;
    ctx.fillText(isBoss ? '\u2620 BOSS ROOM \u2620' : `ROOM ${nextRoom}`, W/2, H*0.42);
    ctx.shadowBlur=0;

    if(isBoss){
      ctx.font='bold 32px Rajdhani, Courier New';
      ctx.fillStyle='rgba(255,160,80,0.9)';
      ctx.fillText('DEFEAT THE DEMON LORD', W/2, H*0.52);
    }

    ctx.restore();
  }

  // Horizontal accent lines sliding
  const sweepAlpha = Math.sin(prog * Math.PI) * 0.4;
  if(sweepAlpha > 0.01){
    ctx.save();
    ctx.globalAlpha=sweepAlpha;
    const lineGrad = iridGrad(ctx, 0, 0, W, 0, frame, 0.8);
    ctx.strokeStyle=lineGrad; ctx.lineWidth=3;
    const ly1 = H*0.35 + prog*20;
    const ly2 = H*0.58 - prog*20;
    ctx.beginPath(); ctx.moveTo(W*prog*0.5, ly1); ctx.lineTo(W*(0.5+prog*0.5), ly1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W*(1-prog*0.5), ly2); ctx.lineTo(W*(0.5-prog*0.5), ly2); ctx.stroke();
    ctx.restore();
  }
}

export function draw(ctx){
  frame++;

  // ── HD upscale: game runs at 720x1280, canvas is 1080x1920 ──
  ctx.save();
  ctx.scale(SCALE, SCALE);

  // ── Cinematic zoom transform ──
  let camZoomed=false;
  if(CAM.active && CAM.zoom>1.01){
    ctx.save();
    ctx.translate(CAM.focX, CAM.focY);
    ctx.scale(CAM.zoom, CAM.zoom);
    ctx.translate(-CAM.focX, -CAM.focY);
    camZoomed=true;
  }

  ctx.drawImage(bgOff,0,0);

  // ── Dungeon room slide offset ──
  let dungeonSlid=false;
  if(_G.dungeonMode && _G.dungeonRoomSlideOffset !== 0){
    ctx.save();
    ctx.translate(_G.dungeonRoomSlideOffset, 0);
    dungeonSlid=true;
  }

  // ── Screen shake — arena only, UI stays fixed ──
  let shook=false;
  if(_G.shakeFrames>0){
    _G.shakeFrames--;
    const mag=_G.shakeAmt*(_G.shakeFrames/22);
    if(--_shakeRefresh<=0){
      _shakeRefresh=4;
      _shakeTargetX=(Math.random()*2-1)*mag;
      _shakeTargetY=(Math.random()*2-1)*mag;
    }
    _shakeX+=(_shakeTargetX-_shakeX)*0.55;
    _shakeY+=(_shakeTargetY-_shakeY)*0.55;
    ctx.save();
    ctx.translate(_shakeX, _shakeY);
    shook=true;
  } else {
    _shakeX=0; _shakeY=0; _shakeTargetX=0; _shakeTargetY=0; _shakeRefresh=0;
  }

  // ── Dungeon room rendering ──
  if(_G.dungeonMode && _G.dungeonRoomRect){
    const rr = _G.dungeonRoomRect;
    const roomDef = DUNGEON_ROOMS[_G.dungeonRoom] || DUNGEON_ROOMS[1];
    drawDungeonRoomVisuals(ctx, frame, rr, roomDef);
  } else {
  // ── Arena ring — multi-layer reactive ──
  const aliveNow = _G.alive();
  const maxSpdNow = aliveNow.length ? Math.max(...aliveNow.map(b=>Math.hypot(b.vx,b.vy))) : 0;
  const ringIntensity = Math.min(1, maxSpdNow / 12);
  const ringPulse = 0.5 + 0.5 * Math.sin(frame * 0.07);
  const sdRingPulse = _G.suddenDeathActive ? 0.5+0.5*Math.sin(frame*0.22) : 0;
  if(_G.suddenDeathActive){
    // Sudden death: crimson/red pulsing ring
    ctx.strokeStyle = `rgba(200,0,0,${0.25+0.20*sdRingPulse})`;
    ctx.lineWidth = 24; arenaPath(ctx,ARENA.r+12); ctx.stroke();
    ctx.strokeStyle = `rgba(255,${Math.floor(30+60*sdRingPulse)},0,${0.5+0.3*sdRingPulse})`;
    ctx.lineWidth = 4; arenaPath(ctx,ARENA.r); ctx.stroke();
    ctx.strokeStyle = `rgba(255,100,0,${0.12+0.10*sdRingPulse})`;
    ctx.lineWidth = 1; arenaPath(ctx,ARENA.r-6); ctx.stroke();
  } else {
    // Normal: for circle use rainbow segments, for polygon use solid iridescent stroke
    const glowH = (frame*0.8)%360;
    const ringLineW = 3 + ringIntensity * 4;
    const alpha = 0.35 + ringIntensity*0.45 + ringPulse*0.1;
    if(ARENA.shape==='circle'){
      const ringSegs = 60;
      for(let i=0;i<ringSegs;i++){
        const a1 = (Math.PI*2/ringSegs)*i;
        const a2 = (Math.PI*2/ringSegs)*(i+1)+0.01;
        const h = ((frame*0.8 + i*(360/ringSegs)) % 360);
        ctx.strokeStyle = `hsla(${h},100%,72%,${alpha})`;
        ctx.lineWidth = ringLineW;
        ctx.beginPath(); ctx.arc(ACX,ACY,ARENA.r,a1,a2); ctx.stroke();
      }
    } else {
      // Polygon: draw each side a different hue
      const verts=ARENA.getVerts(ARENA.r);
      const n=verts.length;
      for(let i=0;i<n;i++){
        const h=((frame*0.8 + i*(360/n))%360);
        ctx.strokeStyle=`hsla(${h},100%,72%,${alpha})`;
        ctx.lineWidth=ringLineW+2;
        ctx.lineCap='round';
        ctx.beginPath();
        ctx.moveTo(verts[i].x,verts[i].y);
        ctx.lineTo(verts[(i+1)%n].x,verts[(i+1)%n].y);
        ctx.stroke();
      }
      ctx.lineCap='butt';
    }
    // Outer soft glow
    ctx.strokeStyle = `hsla(${glowH},100%,70%,${0.10+ringIntensity*0.12})`;
    ctx.lineWidth = 18; arenaPath(ctx,ARENA.r+9); ctx.stroke();
    // Inner thin ring
    ctx.strokeStyle = `hsla(${(glowH+180)%360},100%,80%,${0.06+ringIntensity*0.12})`;
    ctx.lineWidth = 1; arenaPath(ctx,ARENA.r-6); ctx.stroke();
  }

  // ── Clip to arena ──
  ctx.save();
  arenaPath(ctx,ARENA.r-3); ctx.clip();

  ctx.fillStyle='#030306';
  arenaPath(ctx,ARENA.r-3); ctx.fill();

  // Arena kill flash
  if(_G.arenaFlash.alpha>0){
    ctx.globalAlpha=_G.arenaFlash.alpha;
    ctx.fillStyle=_G.arenaFlash.color;
    arenaPath(ctx,AR-3); ctx.fill();
    ctx.globalAlpha=1;
    _G.arenaFlash.alpha=Math.max(0,_G.arenaFlash.alpha-0.03);
  }

  // Speed lines — radiate outward when action is fast
  const alive=_G.alive();
  const maxSpd=alive.length?Math.max(...alive.map(b=>Math.hypot(b.vx,b.vy))):0;
  if(maxSpd>6){
    const intensity=Math.min(1,(maxSpd-6)/10);
    const ao=(frame*1.8)%(Math.PI*2);
    ctx.strokeStyle=`rgba(255,255,255,${intensity*0.22})`; ctx.lineWidth=1.2;
    for(let i=0;i<20;i++){
      const a=ao+i*(Math.PI*2/20);
      const r1=40+Math.sin(frame*0.05+i)*20;
      ctx.beginPath(); ctx.moveTo(ACX+Math.cos(a)*r1,ACY+Math.sin(a)*r1);
      ctx.lineTo(ACX+Math.cos(a)*(AR-20),ACY+Math.sin(a)*(AR-20)); ctx.stroke();
    }
  }

  // Beat pulse — subtle grid scanline that flashes every ~30 frames
  if(frame % 28 < 3 && maxSpd > 5){
    const bp = 1 - (frame%28)/3;
    ctx.strokeStyle=`rgba(100,200,255,${bp*0.12})`; ctx.lineWidth=1;
    for(let sy=ACY-AR;sy<ACY+AR;sy+=18){
      ctx.beginPath(); ctx.moveTo(ACX-AR,sy); ctx.lineTo(ACX+AR,sy); ctx.stroke();
    }
  }

  // Particles
  for(const p of parts){
    ctx.globalAlpha=p.life/p.max;
    ctx.fillStyle=p.color;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r*(p.life/p.max),0,Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha=1;

  // Orbs
  drawOrbs(ctx, frame);

  // ── FX Effects ──
  drawFX(ctx, frame);

  // ── Round countdown — big number in arena center when <=10s left ──
  if(_G.state==='running' && !_G.bossMode && !_G.dungeonMode){
    const ROUND_DURATION = 2700;
    const secsLeft = Math.max(0, Math.ceil((ROUND_DURATION - _G.roundFrames)/60));
    if(secsLeft <= 10 && secsLeft > 0){
      const urgency = 1 - secsLeft/10; // 0→1 as time runs out
      const cPulse  = 0.5 + 0.5*Math.sin(frame * (0.15 + urgency*0.3));
      const alpha   = 0.18 + 0.22*urgency + 0.12*cPulse;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `bold ${Math.floor(180 + urgency*80)}px Rajdhani, Courier New`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = secsLeft <= 3 ? '#ff2200' : secsLeft <= 6 ? '#ff8800' : '#ffffff';
      ctx.fillText(`${secsLeft}`, ACX, ACY);
      ctx.globalAlpha = 1;
      ctx.restore();
    }
  }

  // Trails + balls
  for(const b of _G.balls){
    if(!b.alive) continue;
    // Trail
    for(let t=0;t<b.trail.length;t++){
      const a=(t+1)/(b.trail.length+1)*0.38;
      ctx.globalAlpha=a;
      ctx.fillStyle=b.color;
      ctx.beginPath(); ctx.arc(b.trail[t].x,b.trail[t].y,b.r*((t+1)/(b.trail.length+1)),0,Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha=1;
    const inRage=b.rage>0;
    if(inRage){
      const pulse=0.5+0.5*Math.sin(frame*0.18);
      ctx.globalAlpha=0.5+0.45*pulse;
      ctx.fillStyle='#ffcc00';
      ctx.beginPath(); ctx.arc(b.x,b.y,b.r+10+pulse*8,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha=1;
    }
    // Ball body — 2-gradient optimized sphere
    { const col = b.flash>0 ? '#ffffff' : b.color;
      const bg = ctx.createRadialGradient(b.x-b.r*0.3, b.y-b.r*0.3, b.r*0.05, b.x, b.y, b.r);
      bg.addColorStop(0, '#ffffff');
      bg.addColorStop(0.15, col+'ff');
      bg.addColorStop(0.55, col+'cc');
      bg.addColorStop(1, col+'33');
      ctx.fillStyle = bg;
      ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,Math.PI*2); ctx.fill();
      // Specular highlight
      ctx.globalAlpha = 0.38;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.ellipse(b.x-b.r*0.25, b.y-b.r*0.28, b.r*0.42, b.r*0.26, -Math.PI/4, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    // Shield visual: blue ring
    if(b.shieldFrames>0){
      const sp=0.5+0.5*Math.sin(frame*0.15);
      ctx.globalAlpha=0.6+0.3*sp;
      ctx.strokeStyle='#44aaff';
      ctx.lineWidth=4;
      ctx.beginPath(); ctx.arc(b.x,b.y,b.r+8+sp*4,0,Math.PI*2); ctx.stroke();
      ctx.globalAlpha=1;
    }
    // Ghost visual: translucent
    if(b.ghostFrames>0){
      ctx.globalAlpha=0.35;
      ctx.fillStyle='#aaffee';
      ctx.beginPath(); ctx.arc(b.x,b.y,b.r+6,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha=1;
    }
    // Kamehame: yellow charge glow
    if(b.kamehame){
      const kp=0.5+0.5*Math.sin(frame*0.25);
      ctx.globalAlpha=0.5+0.4*kp;
      ctx.fillStyle='#ffff44';
      ctx.beginPath(); ctx.arc(b.x,b.y,b.r+12+kp*8,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha=1;
    }
    // Freeze aura
    if(b.freezeFrames>0){
      ctx.globalAlpha=0.3;
      ctx.fillStyle='#88ddff';
      ctx.beginPath(); ctx.arc(b.x,b.y,b.r+5,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha=1;
    }
    // Magnet aura: spinning lines
    if(b.magnetFrames>0){
      ctx.strokeStyle='#cc55ff';
      ctx.lineWidth=2;
      for(let mi=0;mi<4;mi++){
        const ma=frame*0.08+mi*Math.PI/2;
        ctx.globalAlpha=0.5;
        ctx.beginPath(); ctx.moveTo(b.x+Math.cos(ma)*(b.r+6),b.y+Math.sin(ma)*(b.r+6));
        ctx.lineTo(b.x+Math.cos(ma)*(b.r+18),b.y+Math.sin(ma)*(b.r+18)); ctx.stroke();
      }
      ctx.globalAlpha=1;
    }
    // Black hole: swirling dark ring
    if(b.blackHoleFrames>0){
      const bhp=0.5+0.5*Math.sin(frame*0.2);
      ctx.globalAlpha=0.7;
      ctx.strokeStyle='#cc00cc';
      ctx.lineWidth=3;
      ctx.beginPath(); ctx.arc(b.x,b.y,b.r+10+bhp*10,0,Math.PI*2); ctx.stroke();
      ctx.globalAlpha=1;
    }
    // Sandevistan owner: cyan chromatic ring
    if(FX.sandevistanFrames>0 && b.id===FX.sandevistanOwner){
      const sp=0.5+0.5*Math.sin(frame*0.3);
      ctx.globalAlpha=0.7+0.2*sp;
      ctx.strokeStyle='#00ffff'; ctx.lineWidth=3;
      ctx.beginPath(); ctx.arc(b.x,b.y,b.r+10+sp*6,0,Math.PI*2); ctx.stroke();
      ctx.globalAlpha=1;
    }
    // Timestop owner: golden halo
    if(FX.timestopFrames>0 && b.id===FX.timestopOwner){
      const tp=0.5+0.5*Math.sin(frame*0.15);
      ctx.globalAlpha=0.6+0.3*tp;
      ctx.strokeStyle='#ffd700'; ctx.lineWidth=4;
      ctx.beginPath(); ctx.arc(b.x,b.y,b.r+12+tp*5,0,Math.PI*2); ctx.stroke();
      ctx.globalAlpha=1;
    }
    // Prison target: orange shaking effect
    if(FX.prisonFrames>0 && b.id===FX.prisonTarget){
      ctx.globalAlpha=0.6;
      ctx.strokeStyle='#ff6600'; ctx.lineWidth=3;
      ctx.beginPath(); ctx.arc(b.x,b.y,b.r+6,0,Math.PI*2); ctx.stroke();
      ctx.globalAlpha=1;
    }
    if(inRage){
      ctx.globalAlpha=0.28+0.18*Math.sin(frame*0.22);
      ctx.fillStyle='#ffdd00';
      ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,Math.PI*2); ctx.fill();
      ctx.globalAlpha=1;
    }
    // Dungeon player glow
    if(b.isDungeonPlayer){
      const dp=0.5+0.5*Math.sin(frame*0.1);
      ctx.globalAlpha=0.25+0.15*dp;
      ctx.strokeStyle='#00eeff'; ctx.lineWidth=3+dp*2;
      ctx.beginPath(); ctx.arc(b.x,b.y,b.r+8+dp*4,0,Math.PI*2); ctx.stroke();
      ctx.globalAlpha=1;
    }
    // Dungeon boss visuals
    if(b.isDungeonBoss){
      const dbp=0.5+0.5*Math.sin(frame*0.08);
      ctx.globalAlpha=0.45+0.25*dbp;
      ctx.strokeStyle='#ff2200'; ctx.lineWidth=5+dbp*3;
      ctx.beginPath(); ctx.arc(b.x,b.y,b.r+12+dbp*6,0,Math.PI*2); ctx.stroke();
      ctx.globalAlpha=0.20+0.15*dbp;
      ctx.strokeStyle='#ff8800'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(b.x,b.y,b.r+22+dbp*8,0,Math.PI*2); ctx.stroke();
      ctx.globalAlpha=1;
      ctx.font=`bold ${Math.floor(b.r*0.7)}px Rajdhani, Courier New`;
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillStyle='#ffdd00'; ctx.shadowColor='#ff8800'; ctx.shadowBlur=14;
      ctx.fillText('\u2620', b.x, b.y - b.r - 22);
      ctx.shadowBlur=0;
      ctx.font='bold 13px Rajdhani, Courier New';
      ctx.fillStyle='#ff4400';
      ctx.fillText('BOSS', b.x, b.y - b.r - 40);
    }
    // Dungeon enemy small indicator
    if(b.isDungeonEnemy && !b.isDungeonBoss){
      ctx.globalAlpha=0.3;
      ctx.strokeStyle='#ff4444'; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.arc(b.x,b.y,b.r+4,0,Math.PI*2); ctx.stroke();
      ctx.globalAlpha=1;
    }
    // Boss-specific visuals
    if(b.isBoss){
      const bp = 0.5+0.5*Math.sin(frame*0.08);
      // Outer danger ring
      ctx.globalAlpha=0.5+0.3*bp;
      ctx.strokeStyle='#ff2200'; ctx.lineWidth=6+bp*4;
      ctx.beginPath(); ctx.arc(b.x,b.y,b.r+14+bp*6,0,Math.PI*2); ctx.stroke();
      // Second ring
      ctx.globalAlpha=0.25+0.2*bp;
      ctx.strokeStyle='#ff8800'; ctx.lineWidth=3;
      ctx.beginPath(); ctx.arc(b.x,b.y,b.r+26+bp*8,0,Math.PI*2); ctx.stroke();
      ctx.globalAlpha=1;
      // Crown ♛ above boss
      ctx.font=`bold ${Math.floor(b.r*0.9)}px Rajdhani, Courier New`;
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillStyle='#ffdd00';
      ctx.shadowColor='#ff8800'; ctx.shadowBlur=18;
      ctx.fillText('\u2620', b.x, b.y - b.r - 28);
      ctx.shadowBlur=0;
      // BOSS label
      ctx.font='bold 14px Rajdhani, Courier New';
      ctx.fillStyle='#ff4400';
      ctx.fillText('BOSS', b.x, b.y - b.r - 50);
    }
    // HP number inside ball
    ctx.fillStyle = b.flash>0 ? b.color : 'rgba(0,0,0,0.75)';
    ctx.font = b.isBoss ? `bold 22px Rajdhani, Courier New` : 'bold 15px Rajdhani, Courier New';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(Math.ceil(b.hp), b.x, b.y);
    // Name above (skip for boss — already shown via label above)
    if(!b.isBoss){
      ctx.font = 'bold 11px Rajdhani, Courier New';
      ctx.fillStyle = b.color;
      ctx.fillText(b.name, b.x, b.y - b.r - 18);
    }
    // HP bar — flat fills, no gradients, no shadowBlur
    if(!b.isBoss){
    const bw=b.r*2.6, bh=6, bx=b.x-bw/2, by=b.y-b.r-13;
    const rat=b.hp/b.max;
    // Background
    ctx.fillStyle='rgba(0,0,0,0.55)';
    ctx.beginPath(); ctx.roundRect(bx,by,bw,bh,3); ctx.fill();
    if(b.bonusHp>0){
      ctx.fillStyle='#22dd44';
      ctx.beginPath(); ctx.roundRect(bx,by,bw/2,bh,3); ctx.fill();
      const bonusW=(b.bonusHp/b.max)*(bw/2);
      ctx.fillStyle='#ffcc00';
      ctx.beginPath(); ctx.roundRect(bx+bw/2,by,bonusW,bh,3); ctx.fill();
    } else {
      const fillW=bw*rat;
      ctx.fillStyle=rat>0.5?'#33dd55':rat>0.25?'#ddcc00':'#ee3333';
      if(fillW>0){ ctx.beginPath(); ctx.roundRect(bx,by,fillW,bh,3); ctx.fill(); }
    }
    // Shine stripe (top half, single flat white)
    ctx.globalAlpha=0.22;
    ctx.fillStyle='#fff';
    const shW=b.bonusHp>0?bw/2+(b.bonusHp/b.max)*(bw/2):bw*rat;
    if(shW>0){ ctx.beginPath(); ctx.roundRect(bx,by,shW,bh/2,{upperLeft:3,upperRight:3,lowerLeft:0,lowerRight:0}); ctx.fill(); }
    ctx.globalAlpha=1;

    // Rage timer pill — no shadowBlur, flat fill
    if(inRage){
      ctx.fillStyle='#ff6600';
      ctx.beginPath(); ctx.roundRect(b.x-22,b.y-b.r-35,44,18,9); ctx.fill();
      ctx.fillStyle='#fff'; ctx.font='bold 12px Rajdhani, Courier New';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(`\ud83d\udd25${Math.ceil(b.rage/C.RAGE_FRAMES*5)}s`,b.x,b.y-b.r-26);
    }
    // Kill streak badge — no shadowBlur, flat fill
    if(b.streak>=2){
      const sc=b.streak>=5?'#ff8833':b.streak>=3?'#ffdd33':'#ff5555';
      const streakY=b.y-b.r-(inRage?52:42);
      ctx.fillStyle='rgba(0,0,0,0.75)';
      ctx.beginPath(); ctx.roundRect(b.x-28,streakY-10,56,20,10); ctx.fill();
      ctx.strokeStyle=sc; ctx.lineWidth=1;
      ctx.beginPath(); ctx.roundRect(b.x-28,streakY-10,56,20,10); ctx.stroke();
      ctx.fillStyle=sc; ctx.font='bold 14px Rajdhani, Courier New';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(`\ud83d\udc80${b.streak}`,b.x,streakY);
    }
    } // end if(!b.isBoss) HP bar block
  }

  ctx.restore(); // end arena clip
  } // end else (non-dungeon arena)

  // ── Close shake before HUD so UI is always stable ──
  if(shook){ ctx.restore(); shook=false; }

  // ── Close dungeon slide before HUD ──
  if(dungeonSlid){ ctx.restore(); dungeonSlid=false; }

  // ── Close cinematic zoom before HUD ──
  if(camZoomed){ ctx.restore(); camZoomed=false; }

  // ── Cinematic overlay (on top of everything, no zoom) ──
  if(CAM.active) drawCinematic(ctx, frame);

  // ── Title bar (outside zoom so it never shifts) ──
  { const titlePulse = 0.5 + 0.5 * Math.sin(frame * 0.04);
    const tbX = W/2 - 250, tbY = 22, tbW = 500, tbH = 100, tbR = 14;
    const cx = W/2;

    // -- Glass-morphism background with gradient --
    ctx.save();
    const glassBg = ctx.createLinearGradient(tbX, tbY, tbX + tbW, tbY + tbH);
    glassBg.addColorStop(0, 'rgba(8,6,28,0.92)');
    glassBg.addColorStop(0.5, 'rgba(16,10,40,0.88)');
    glassBg.addColorStop(1, 'rgba(10,4,30,0.92)');
    ctx.fillStyle = glassBg;
    ctx.beginPath(); ctx.roundRect(tbX, tbY, tbW, tbH, tbR); ctx.fill();

    // -- Glass inner highlight --
    const innerGlow = ctx.createLinearGradient(tbX, tbY, tbX, tbY + tbH * 0.4);
    innerGlow.addColorStop(0, 'rgba(120,100,255,0.08)');
    innerGlow.addColorStop(1, 'rgba(120,100,255,0)');
    ctx.fillStyle = innerGlow;
    ctx.beginPath(); ctx.roundRect(tbX + 2, tbY + 2, tbW - 4, tbH * 0.4, [tbR - 2, tbR - 2, 0, 0]); ctx.fill();

    // -- Outer border glow --
    ctx.shadowColor = iridColor(frame, 260, 80, 0.25);
    ctx.shadowBlur = 18;
    ctx.strokeStyle = 'rgba(100,80,200,0.15)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(tbX, tbY, tbW, tbH, tbR); ctx.stroke();
    ctx.shadowBlur = 0;

    // -- Top accent line (animated iridescent) --
    const topGrad = iridGrad(ctx, tbX + 20, 0, tbX + tbW - 20, 0, frame, 0.8 + 0.15 * titlePulse);
    ctx.strokeStyle = topGrad; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(tbX + 30, tbY + 2); ctx.lineTo(tbX + tbW - 30, tbY + 2); ctx.stroke();

    // -- Corner brackets (futuristic accents) --
    const bLen = 16, bOff = 6;
    ctx.strokeStyle = iridColor(frame, 220, 90, 0.5 + 0.15 * titlePulse);
    ctx.lineWidth = 2; ctx.lineCap = 'round';
    // top-left
    ctx.beginPath(); ctx.moveTo(tbX + bOff, tbY + bOff + bLen); ctx.lineTo(tbX + bOff, tbY + bOff); ctx.lineTo(tbX + bOff + bLen, tbY + bOff); ctx.stroke();
    // top-right
    ctx.beginPath(); ctx.moveTo(tbX + tbW - bOff - bLen, tbY + bOff); ctx.lineTo(tbX + tbW - bOff, tbY + bOff); ctx.lineTo(tbX + tbW - bOff, tbY + bOff + bLen); ctx.stroke();
    // bottom-left
    ctx.beginPath(); ctx.moveTo(tbX + bOff, tbY + tbH - bOff - bLen); ctx.lineTo(tbX + bOff, tbY + tbH - bOff); ctx.lineTo(tbX + bOff + bLen, tbY + tbH - bOff); ctx.stroke();
    // bottom-right
    ctx.beginPath(); ctx.moveTo(tbX + tbW - bOff - bLen, tbY + tbH - bOff); ctx.lineTo(tbX + tbW - bOff, tbY + tbH - bOff); ctx.lineTo(tbX + tbW - bOff, tbY + tbH - bOff - bLen); ctx.stroke();
    ctx.lineCap = 'butt';

    // -- Title text: multi-layer glow --
    const titleY = tbY + 36;
    ctx.font = 'bold 48px Rajdhani, Courier New';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

    // Layer 1: wide outer glow
    ctx.shadowColor = iridColor(frame, 270, 100, 0.5);
    ctx.shadowBlur = 32;
    ctx.fillStyle = 'rgba(0,0,0,0)';
    const titleText = _G.dungeonMode ? 'DUNGEON CRAWLER' : 'ARENA BALL ANIME';
    ctx.fillText(titleText, cx, titleY);

    // Layer 2: colored outline stroke
    ctx.shadowColor = iridColor(frame + 30, 200, 90, 0.4);
    ctx.shadowBlur = 12;
    const outlineGrad = iridGrad(ctx, cx - 210, 0, cx + 210, 0, frame, 0.9);
    ctx.strokeStyle = outlineGrad; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    ctx.strokeText(titleText, cx, titleY);

    // Layer 3: bright white fill with tight glow
    ctx.shadowColor = iridColor(frame, 180, 100, 0.7);
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#fff';
    ctx.fillText(titleText, cx, titleY);
    ctx.shadowBlur = 0;

    // -- Separator line between title and info --
    const sepY = tbY + 62;
    const sepGrad = iridGrad(ctx, cx - 160, 0, cx + 160, 0, frame + 40, 0.3);
    ctx.strokeStyle = sepGrad; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx - 160, sepY); ctx.lineTo(cx + 160, sepY); ctx.stroke();

    // -- Info line data --
    const ROUND_DURATION = _G.dungeonMode ? 99999 : _G.bossMode ? 8400 : 2700;
    const secsLeft = _G.dungeonMode
      ? (_G.state==='running' ? Math.max(0, Math.ceil(((_G.dungeonRoom >= _G.dungeonTotalRooms ? C.DUNGEON.BOSS_ROOM_FRAMES : C.DUNGEON.MAX_ROOM_FRAMES) - _G.dungeonRoomFrames)/60)) : 25)
      : _G.state==='running' ? Math.max(0, Math.ceil((ROUND_DURATION - _G.roundFrames)/60)) : (_G.bossMode ? 140 : 45);
    const modeLabel = _G.dungeonMode ? `DUNGEON` : _G.bossMode ? `BOSS FIGHT` : _G.teamMode ? `${_G.teams.length} TEAMS` : `${C.COUNT} PLAYERS`;
    const shapeLabel = _G.dungeonMode ? `${_G.dungeonAliveEnemies().length} ENEMIES` : ARENA.shape.toUpperCase();
    const roundLabel = _G.dungeonMode ? `ROOM ${_G.dungeonRoom} / ${_G.dungeonTotalRooms}` : _G.bossMode ? `ROUND 1 / 1` : `ROUND ${_G.round} / ${C.ROUNDS_TO_WIN}`;

    // -- Timer pulse red when < 10s --
    const timerUrgent = _G.state === 'running' && secsLeft <= 10;
    const timerPulse = timerUrgent ? 0.7 + 0.3 * Math.sin(frame * 0.15) : 0;

    // -- Info line rendering --
    const infoY = tbY + 82;
    ctx.font = '700 19px Rajdhani, Courier New';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

    // Build info segments with dot separators
    const dot = '  \u00b7  ';
    const timerStr = `${secsLeft}s`;

    // Measure segments to draw timer in red when urgent
    if (timerUrgent) {
      // Draw full line in base color, then overdraw timer in red
      ctx.fillStyle = iridColor(frame + 60, 80, 85, 0.7);
      const fullText = `${roundLabel}${dot}${timerStr}${dot}${modeLabel}${dot}${shapeLabel}`;
      ctx.fillText(fullText, cx, infoY);

      // Overdraw the timer portion in pulsing red
      const beforeTimer = `${roundLabel}${dot}`;
      const beforeW = ctx.measureText(beforeTimer).width;
      const timerW = ctx.measureText(timerStr).width;
      const fullW = ctx.measureText(fullText).width;
      const timerX = cx - fullW / 2 + beforeW + timerW / 2;

      ctx.fillStyle = `rgba(255,${Math.floor(60 + 40 * (1 - timerPulse))},${Math.floor(40 * (1 - timerPulse))},${0.8 + 0.2 * timerPulse})`;
      ctx.shadowColor = `rgba(255,40,20,${0.5 * timerPulse})`;
      ctx.shadowBlur = 10 * timerPulse;
      ctx.fillText(timerStr, timerX, infoY);
      ctx.shadowBlur = 0;
    } else {
      ctx.fillStyle = iridColor(frame + 60, 80, 85, 0.7);
      ctx.fillText(`${roundLabel}${dot}${timerStr}${dot}${modeLabel}${dot}${shapeLabel}`, cx, infoY);
    }

    // -- Bottom accent line --
    const botGrad = iridGrad(ctx, tbX + 40, 0, tbX + tbW - 40, 0, frame + 80, 0.6 + 0.2 * titlePulse);
    ctx.strokeStyle = botGrad; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(tbX + 40, tbY + tbH - 2); ctx.lineTo(tbX + tbW - 40, tbY + tbH - 2); ctx.stroke();

    ctx.restore();
  }

  // Leaderboard / Boss HP bar / Dungeon HUD — hide during transitions to avoid overlap
  if(_G.state!=='podium' && _G.state!=='champion' && _G.state!=='roundEnd' && _G.state!=='roundEndDelay'){
    if(_G.dungeonMode) drawDungeonHUD(ctx, frame);
    else if(_G.bossMode) drawBossHpBar(ctx, frame);
    else drawLeaderboard(ctx, frame);
  }

  // Countdown — dramatic "3", "2", "1", "GO!" across 180 frames (3s at 60fps)
  if(_G.state==='countdown'){
    const cd = _G.countdown; // 180→0
    // Phase: 3 = frames 180-121, 2 = 120-61, 1 = 60-21, GO = 20-0
    let label, phaseT, color, glowColor;
    if(cd > 120){
      label='3'; phaseT=(180-cd)/60; color='#ff4444'; glowColor='rgba(255,68,68,';
    } else if(cd > 60){
      label='2'; phaseT=(120-cd)/60; color='#ff8833'; glowColor='rgba(255,136,51,';
    } else if(cd > 20){
      label='1'; phaseT=(60-cd)/40; color='#ffffff'; glowColor='rgba(255,255,255,';
    } else {
      label='GO!'; phaseT=cd<=0?1:(20-cd)/20; color='#ffdd33'; glowColor='rgba(255,221,51,';
    }

    // Bounce ease: slam from 2.0 to 1.0 with overshoot
    const bounceEase = (t) => {
      if(t < 0.4) return 2.0 - t/0.4 * 1.3;        // 2.0 → 0.7 (overshoot past 1.0)
      if(t < 0.7) return 0.7 + (t-0.4)/0.3 * 0.45;  // 0.7 → 1.15 (bounce back up)
      if(t < 0.85) return 1.15 - (t-0.7)/0.15 * 0.2; // 1.15 → 0.95 (small undershoot)
      return 0.95 + (t-0.85)/0.15 * 0.05;             // 0.95 → 1.0 (settle)
    };
    const scale = label==='GO!'
      ? bounceEase(Math.min(1, phaseT*1.5)) * (1 + phaseT*0.3)
      : bounceEase(Math.min(1, phaseT*2.5));

    // Alpha: fade in fast, hold, then fade out at end of phase
    const alpha = label==='GO!'
      ? Math.min(1, phaseT*6) * (cd<=0 ? 0.3 : 1)
      : Math.min(1, phaseT*6) * Math.min(1, (label==='3'?(cd-120)/10 : label==='2'?(cd-60)/10 : (cd-20)/8) + 0.3);

    // Dim background during countdown
    ctx.save();
    ctx.fillStyle = `rgba(0,0,0,${0.25 * Math.min(1, (180-cd)/30)})`;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // Shockwave ring on each new number (first 25 frames of each phase)
    const phaseFrame = label==='3' ? 180-cd : label==='2' ? 120-cd : label==='1' ? 60-cd : 20-cd;
    if(phaseFrame < 25){
      const ringT = phaseFrame / 25;
      const ringR = ringT * AR * 0.9;
      const ringA = (1 - ringT) * 0.6;
      ctx.save();
      ctx.strokeStyle = glowColor + ringA + ')';
      ctx.lineWidth = 4 * (1 - ringT) + 1;
      ctx.beginPath(); ctx.arc(ACX, ACY, ringR, 0, Math.PI*2); ctx.stroke();
      // Inner ring trailing behind
      if(phaseFrame > 4){
        const innerT = (phaseFrame - 4) / 25;
        const innerR = innerT * AR * 0.7;
        const innerA = (1 - innerT) * 0.35;
        ctx.strokeStyle = `rgba(255,255,255,${innerA})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(ACX, ACY, innerR, 0, Math.PI*2); ctx.stroke();
      }
      ctx.restore();
    }

    // GO! special effects: multiple expanding energy rings + screen flash
    if(label === 'GO!'){
      ctx.save();
      // Screen flash at the start
      if(phaseFrame < 8){
        ctx.fillStyle = `rgba(255,221,51,${(1 - phaseFrame/8) * 0.35})`;
        ctx.fillRect(0, 0, W, H);
      }
      // Triple expanding rings staggered
      for(let i = 0; i < 3; i++){
        const rF = phaseFrame - i * 5;
        if(rF > 0 && rF < 22){
          const rT = rF / 22;
          const rR = rT * AR * (1.0 + i * 0.15);
          const rA = (1 - rT) * (0.7 - i * 0.15);
          ctx.strokeStyle = `rgba(255,221,51,${rA})`;
          ctx.lineWidth = (6 - i * 1.5) * (1 - rT) + 1;
          ctx.beginPath(); ctx.arc(ACX, ACY, rR, 0, Math.PI*2); ctx.stroke();
        }
      }
      // Particle burst — small dots radiating outward
      if(phaseFrame < 18){
        const pT = phaseFrame / 18;
        for(let a = 0; a < 12; a++){
          const angle = (a / 12) * Math.PI * 2 + phaseFrame * 0.02;
          const dist = pT * AR * 0.8;
          const px = ACX + Math.cos(angle) * dist;
          const py = ACY + Math.sin(angle) * dist;
          ctx.fillStyle = `rgba(255,238,100,${(1 - pT) * 0.8})`;
          ctx.beginPath(); ctx.arc(px, py, 3 * (1 - pT) + 1, 0, Math.PI*2); ctx.fill();
        }
      }
      ctx.restore();
    }

    // Draw the number/text
    ctx.save();
    ctx.globalAlpha = Math.min(1, Math.max(0, alpha));
    ctx.translate(ACX, ACY);
    ctx.scale(scale, scale);
    ctx.font = label==='GO!' ? 'bold 180px Courier New' : 'bold 200px Courier New';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

    // Outer glow (multiple shadow passes for intensity)
    ctx.shadowColor = color;
    ctx.shadowBlur = 60;
    ctx.fillStyle = color;
    ctx.fillText(label, 0, 0); // glow pass 1
    ctx.fillText(label, 0, 0); // glow pass 2 (stacks for brighter glow)

    // Dark drop shadow
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillText(label, 5, 5);

    // Colored stroke outline
    ctx.strokeStyle = color;
    ctx.lineWidth = label==='GO!' ? 5 : 4;
    ctx.lineJoin = 'round';
    ctx.strokeText(label, 0, 0);

    // White fill (or gold for GO!)
    ctx.fillStyle = label==='GO!' ? '#ffee88' : '#ffffff';
    ctx.fillText(label, 0, 0);

    // Bright highlight on top half for a shiny look
    ctx.globalAlpha = Math.min(1, Math.max(0, alpha)) * 0.3;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.rect(-300, -120, 600, 100);
    ctx.clip();
    ctx.fillText(label, 0, 0);

    ctx.restore();
  }

  // ── Match intro hype screen — shows during first 150 running frames so it's recorded ──
  // Recording starts when music starts (round 1 countdown→0 → running begins)
  // roundFrames counts from 0 once state='running'; intro shows frames 0→149
  if(_G.state==='running' && _G.round===1 && _G.roundFrames < 120 && (!_G.dungeonMode || _G.dungeonRoom===1)){
    const rf = _G.roundFrames; // 0→119
    const fadeIn  = rf < 10 ? rf/10 : 1;            // 0→1 in first 10 frames
    const fadeOut = rf > 100 ? (120-rf)/20 : 1;      // 1→0 in last 20 frames
    const alpha   = Math.min(fadeIn, fadeOut);
    const pulse   = 0.5+0.5*Math.sin(frame*0.2);
    const pulse2  = 0.5+0.5*Math.sin(frame*0.13+1.5);

    // Full black overlay
    ctx.globalAlpha = alpha * 0.92;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.textAlign='center'; ctx.textBaseline='middle';

    // ── Background glow vignette ──
    const vg=ctx.createRadialGradient(W/2,H*0.42,0,W/2,H*0.42,H*0.55);
    vg.addColorStop(0,`rgba(80,0,140,${0.45*alpha})`);
    vg.addColorStop(0.5,`rgba(20,0,60,${0.3*alpha})`);
    vg.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=vg; ctx.fillRect(0,0,W,H);

    // ── Animated scan lines ──
    ctx.globalAlpha=alpha*0.06;
    ctx.fillStyle='#ffffff';
    for(let sl=0;sl<H;sl+=4){ ctx.fillRect(0,sl,W,2); }
    ctx.globalAlpha=1;

    // ── Top label: mode + count ──
    const modeLabel = _G.dungeonMode ? 'DUNGEON CRAWLER' : _G.bossMode ? 'BOSS FIGHT' : _G.teamMode ? 'TEAM BATTLE' : 'FREE FOR ALL';
    const fighterLabel = _G.dungeonMode ? `${_G.dungeonTotalRooms} ROOMS  ·  1 HERO` : _G.bossMode ? `${C.COUNT} HUNTERS  vs  1 BOSS` : `${C.COUNT} FIGHTERS`;
    ctx.globalAlpha=alpha*0.7;
    ctx.font='700 24px Rajdhani, Courier New';
    ctx.fillStyle='rgba(160,160,255,1)';
    ctx.fillText(`${fighterLabel}  ·  ${modeLabel}`, W/2, H*0.18);

    // ── Horizontal accent lines ──
    ctx.globalAlpha=alpha*0.35;
    ctx.strokeStyle='rgba(200,150,255,0.8)'; ctx.lineWidth=1;
    const lineY1=H*0.22, lineY2=H*0.68;
    ctx.beginPath(); ctx.moveTo(W*0.08,lineY1); ctx.lineTo(W*0.92,lineY1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W*0.08,lineY2); ctx.lineTo(W*0.92,lineY2); ctx.stroke();

    // ── Corner brackets ──
    ctx.globalAlpha=alpha*0.5;
    ctx.strokeStyle='rgba(200,180,255,0.9)'; ctx.lineWidth=2;
    const bx1=W*0.06, bx2=W*0.94, by1=H*0.15, by2=H*0.72, bs=28;
    [[bx1,by1,1,1],[bx2,by1,-1,1],[bx1,by2,1,-1],[bx2,by2,-1,-1]].forEach(([cx,cy,sx,sy])=>{
      ctx.beginPath();
      ctx.moveTo(cx+sx*bs,cy); ctx.lineTo(cx,cy); ctx.lineTo(cx,cy+sy*bs);
      ctx.stroke();
    });

    // ── Subtitle: glitch iridescent ──
    const qs=1+pulse*0.025;
    ctx.save();
    ctx.translate(W/2, H*0.36);
    ctx.scale(qs,qs);
    // Glitch offset shadows
    ctx.globalAlpha=alpha*0.25;
    ctx.font='900 48px Rajdhani, Courier New';
    const introSub = _G.dungeonMode ? 'CLEAR EVERY ROOM' : 'ONLY ONE SURVIVES';
    ctx.fillStyle='#ff0088'; ctx.fillText(introSub,-3,0);
    ctx.fillStyle='#00ffff'; ctx.fillText(introSub,3,0);
    // Main iridescent text
    ctx.globalAlpha=alpha;
    const hg1=ctx.createLinearGradient(-300,0,300,0);
    hg1.addColorStop(0,  `hsl(${frame*3},100%,72%)`);
    hg1.addColorStop(0.25,`hsl(${frame*3+90},100%,80%)`);
    hg1.addColorStop(0.5, `hsl(${frame*3+180},100%,72%)`);
    hg1.addColorStop(0.75,`hsl(${frame*3+270},100%,80%)`);
    hg1.addColorStop(1,  `hsl(${frame*3+360},100%,72%)`);
    ctx.fillStyle=hg1;
    ctx.shadowColor='rgba(180,100,255,0.9)'; ctx.shadowBlur=30;
    ctx.fillText(introSub,0,0);
    ctx.shadowBlur=0;
    ctx.restore();

    // ── Main mega text ──
    const ms=1+pulse2*0.018;
    ctx.save();
    ctx.translate(W/2, H*0.47);
    ctx.scale(ms,ms);
    // Drop shadow
    ctx.globalAlpha=alpha*0.6;
    ctx.font='900 118px Rajdhani, Courier New';
    const introL1 = _G.dungeonMode ? 'CAN YOU' : 'WHO';
    const introL2 = _G.dungeonMode ? 'SURVIVE?' : 'WILL WIN?';
    ctx.fillStyle='rgba(0,0,0,0.9)'; ctx.fillText(introL1,4,4);
    ctx.fillStyle='rgba(0,0,0,0.9)'; ctx.fillText(introL2,4,118);
    // Gradient fill
    ctx.globalAlpha=alpha;
    const hg2=ctx.createLinearGradient(-300,-60,300,120);
    hg2.addColorStop(0,'#ffffff');
    hg2.addColorStop(0.4,`hsl(${frame*2+60},100%,85%)`);
    hg2.addColorStop(1,`hsl(${frame*2+180},100%,75%)`);
    ctx.fillStyle=hg2;
    ctx.shadowColor='rgba(255,255,255,0.5)'; ctx.shadowBlur=25;
    ctx.fillText(introL1,0,0);
    ctx.fillText(introL2,0,118);
    ctx.shadowBlur=0;
    ctx.restore();

    // ── Tagline bottom ──
    ctx.globalAlpha=alpha*(0.7+0.3*pulse);
    ctx.font='700 30px Rajdhani, Courier New';
    const tg=ctx.createLinearGradient(W/2-220,0,W/2+220,0);
    tg.addColorStop(0,'rgba(255,200,60,0.8)');
    tg.addColorStop(0.5,'rgba(255,255,180,1)');
    tg.addColorStop(1,'rgba(255,200,60,0.8)');
    ctx.fillStyle=tg;
    ctx.shadowColor='rgba(255,180,0,0.7)'; ctx.shadowBlur=16;
    ctx.fillText(_G.dungeonMode ? '\u2694  ENTER THE DUNGEON  \u00b7  DEFEAT THE BOSS  \u2694' : '\u2726  PICK YOUR BALL  \u00b7  PLACE YOUR BETS  \u2726', W/2, H*0.76);
    ctx.shadowBlur=0;

    // ── Pulsing energy orbs on sides ──
    ctx.globalAlpha=alpha*(0.4+0.3*pulse);
    [W*0.06, W*0.94].forEach((ox,i)=>{
      const og=ctx.createRadialGradient(ox,H*0.47,0,ox,H*0.47,40);
      og.addColorStop(0,`hsl(${frame*4+i*180},100%,80%)`);
      og.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=og; ctx.beginPath(); ctx.arc(ox,H*0.47,40,0,Math.PI*2); ctx.fill();
    });

    ctx.restore();
    ctx.globalAlpha=1;
  }

  // Dungeon room transition overlay
  if(_G.state==='roomTransition') drawDungeonRoomTransition(ctx, frame);

  // Winner cinematic during delay
  if(_G.state==='roundEndDelay') drawWinnerCinematic(ctx, frame);

  // Round end / champion / podium overlays
  if(_G.state==='roundEnd' && !_G.bossMode && !_G.dungeonMode) drawRoundEnd(ctx, frame);
  if(_G.state==='podium')   drawPodium(ctx, frame);
  if(_G.state==='champion') drawChampion(ctx, frame);

  // Last 2 alert (not relevant in boss mode)
  if(_G.lastTwoTimer>0 && !_G.bossMode && !_G.dungeonMode) drawLastTwo(ctx, frame);

  // Round transition glitch (on top of everything)
  drawRoundTransition(ctx);

  // Sudden death banner (not in dungeon mode)
  if(_G.suddenDeathActive && !_G.dungeonMode && (_G.state==='running'||_G.state==='roundEndDelay')){
    const sdPulse = 0.5+0.5*Math.sin(frame*0.18);
    // Red vignette on edges
    const vig = ctx.createRadialGradient(W/2,H/2,AR*0.5,W/2,H/2,AR*1.3);
    vig.addColorStop(0,'rgba(180,0,0,0)');
    vig.addColorStop(1,`rgba(200,0,0,${0.18+0.10*sdPulse})`);
    ctx.fillStyle=vig; ctx.fillRect(0,0,W,H);
    // Banner pill
    ctx.fillStyle=`rgba(140,0,0,${0.80+0.10*sdPulse})`;
    ctx.beginPath(); ctx.roundRect(W/2-230,126,460,42,8); ctx.fill();
    ctx.strokeStyle=`rgba(255,60,0,${0.8+0.2*sdPulse})`; ctx.lineWidth=2;
    ctx.beginPath(); ctx.roundRect(W/2-230,126,460,42,8); ctx.stroke();
    // SUDDEN DEATH text
    ctx.fillStyle=`rgba(255,${Math.floor(80+80*sdPulse)},0,1)`;
    ctx.font=`bold 22px Rajdhani, Courier New`;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.shadowColor='#ff0000'; ctx.shadowBlur=14;
    ctx.fillText(_G.bossMode ? '\u26a0 ZONE CLOSING \u26a0' : '\u26a0 SUDDEN DEATH \u26a0', W/2, 147);
    ctx.shadowBlur=0;
  }

  // REC dot hidden — recording is invisible to viewer

  // ── Close HD upscale transform ──
  ctx.restore();
}

// \u2705 COMPLETO
