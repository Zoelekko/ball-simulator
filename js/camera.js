// ════════════════════════════════════════════════
// CINEMATIC MOMENT
// ════════════════════════════════════════════════
import { ACX, ACY } from './constants.js';

export const CAM = {
  // Phases: 'off' | 'pickup' | 'follow' | 'impact' | 'fadeout'
  phase: 'off',
  timer: 0,
  // Focus point (lerped smoothly each frame)
  focX: ACX, focY: ACY,
  // Target focus (where we want to look)
  tgtX: ACX, tgtY: ACY,
  zoom: 1.0, tgtZoom: 1.0,
  // Orb info
  ballId: -1, ballColor:'#fff',
  orbName:'', orbDesc:'', orbEmoji:'', orbColor:'#fff', orbChar:'',
  splashLines: [], // cached speed lines so they don't flicker
  totalTimer: 0,  // global cam lifetime — hard killed after max
  // Follow subject (ball id or fixed point)
  followBallId: -1,
  followX: ACX, followY: ACY,
  // Card visible
  showCard: false,
  // Impact flash
  impactColor:'#fff', impactAlpha:0,
  // Result text
  resultText:'', resultTimer:0,

  trigger(ball, type){
    this.phase='pickup'; this.timer=0;
    this.focX=ball.x; this.focY=ball.y;
    this.tgtX=ball.x; this.tgtY=ball.y;
    // Wide-shot abilities: zoom out to show the whole arena
    const wideAbils=['timestop','gojo_red','dimension_cut','mahoraga','sand_tsunami','black_storm','tornado_psy','arena_split','arena_shrink','chaos'];
    this.wideShot=wideAbils.includes(type.id);
    this.zoom=1.0; this.tgtZoom=this.wideShot ? 1.15 : 2.4;
    this.ballId=ball.id; this.ballColor=ball.color;
    this.orbName=type.name; this.orbDesc=type.desc;
    this.orbEmoji=type.emoji; this.orbColor=type.color; this.orbChar=type.char??'';
    // Pre-generate speed lines so they're stable across frames
    this.splashLines=[];
    for(let i=0;i<44;i++){
      this.splashLines.push({
        ang: (Math.PI*2/44)*i + (Math.random()-0.5)*0.08,
        inner: 80+Math.random()*60,
        outer: 480+Math.random()*220,
        lw: 0.5+Math.random()*3.5,
      });
    }
    this.followBallId=ball.id;
    this.followX=ball.x; this.followY=ball.y;
    this.showCard=false; this.totalTimer=0;
    this.resultText=''; this.resultTimer=0; this.impactAlpha=0;
    // Abilities that have projectiles/targets — transition to follow phase after pickup
    const projAbils=['gojo_blue','gojo_red','gojo_purple','toji_chain','ekko_ult','timestop','rewind','prison','portal','sandevistan',
      'rasengan','chidori','piercing_blood','zephyr','yami_slash','serious_punch','incinerate','sonic_slash',
      'zoltraak','blood_rain','bishamon_array','origami_angel','zafkiel','roxy_water','shadow_slash','gamma_laser'];
    this.hasFollow=projAbils.includes(type.id);
  },

  setFollow(x,y,ballId=-1){ this.followX=x; this.followY=y; this.followBallId=ballId; },

  impact(x,y,color,text='HIT!',targetBallId=-1){
    if(this.phase==='off') return; // don't reactivate after cam ended
    this.impactColor=color; this.impactAlpha=1;
    this.resultText=text; this.resultTimer=70;
    this.tgtX=x; this.tgtY=y;
    // Wide-shot abilities stay zoomed out even at impact
    this.tgtZoom=this.wideShot ? 1.2 : 2.8;
    // Follow the hit target ball dynamically during impact
    if(targetBallId>=0){ this.followBallId=targetBallId; }
    if(this.phase==='follow'||this.phase==='pickup') this.phase='impact';
  },

  physSpeed(){
    if(this.phase==='off') return 1;
    if(this.phase==='pickup') return 0.55;
    if(this.phase==='follow') return 0.65;
    if(this.phase==='impact') return 0.45;
    if(this.phase==='fadeout') return 0.75+(this.timer/40)*0.25;
    return 1;
  },

  tick(balls){
    if(this.phase==='off') return;
    this.timer++;

    // Hard safety timeout — if cam has been active >6s total, force off
    this.totalTimer++;
    if(this.totalTimer > 360){ this.phase='off'; this.zoom=1.0; this.focX=ACX; this.focY=ACY; return; }

    // Update follow target — if ball died, cut to fadeout
    if(this.followBallId>=0){
      const fb=balls.find(b=>b.id===this.followBallId&&b.alive);
      if(fb){ this.followX=fb.x; this.followY=fb.y; }
      else if(this.phase==='follow'||this.phase==='pickup'){ this.phase='fadeout'; this.timer=0; }
    }

    // Smooth lerp focus & zoom toward target
    const lspd= this.phase==='pickup'?0.22: this.phase==='impact'?0.28: this.phase==='follow'?0.16:0.14;
    this.focX+=(this.tgtX-this.focX)*lspd;
    this.focY+=(this.tgtY-this.focY)*lspd;
    this.zoom+=(this.tgtZoom-this.zoom)*0.18;

    // Impact flash decay
    if(this.impactAlpha>0) this.impactAlpha=Math.max(0,this.impactAlpha-0.045);
    if(this.resultTimer>0) this.resultTimer--;

    // Phase transitions
    if(this.phase==='pickup'){
      this.tgtX=this.followX; this.tgtY=this.followY;
      if(this.timer===8) this.showCard=true;
      if(this.timer>70){ // ~1.15s — splash fully visible before transitioning
        this.showCard=false;
        this.phase= this.hasFollow?'follow':'fadeout';
        this.timer=0; this.tgtZoom=this.wideShot ? 1.15 : 1.9;
      }
    }
    else if(this.phase==='follow'){
      this.tgtX=this.followX; this.tgtY=this.followY;
      if(this.timer>130){ this.phase='fadeout'; this.timer=0; } // ~2.2s max
    }
    else if(this.phase==='impact'){
      // Keep tracking the target ball during impact
      if(this.followBallId>=0){
        const fb=balls.find(b=>b.id===this.followBallId&&b.alive);
        if(fb){ this.tgtX=fb.x; this.tgtY=fb.y; }
      }
      if(this.timer>70){ this.phase='fadeout'; this.timer=0; } // 1.2s at impact
    }
    else if(this.phase==='fadeout'){
      this.tgtX=ACX; this.tgtY=ACY; this.tgtZoom=1.0;
      if(this.timer>40){ this.phase='off'; this.zoom=1.0; this.focX=ACX; this.focY=ACY; }
    }
  },

  get active(){ return this.phase!=='off'; },

  reset(){
    this.phase='off'; this.zoom=1.0; this.focX=ACX; this.focY=ACY;
    this.tgtX=ACX; this.tgtY=ACY; this.tgtZoom=1.0;
    this.timer=0; this.totalTimer=0; this.impactAlpha=0;
    this.resultText=''; this.resultTimer=0; this.showCard=false;
  },
};
// ✅ COMPLETO
