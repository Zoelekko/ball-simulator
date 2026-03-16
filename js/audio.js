// ════════════════════════════════════════════════
// AUDIO
// ════════════════════════════════════════════════
export const Snd = (() => {
  let ctx = null, dest = null;
  // Music state
  let killCount = 0;
  const MUSIC_VOL_BASE = 0.45;
  const MUSIC_VOL_MAX  = 0.90;
  const MUSIC_KILL_STEP = 0.055;   // volume step per kill
  const MUSIC_ORB_STEP  = 0.025;   // half step on orb pickup

  // All music files in music/ folder
  // Music list — loaded dynamically from server
  let MUSIC_FILES = [];

  let musicSrc = null;   // BufferSourceNode (http mode)
  let musicGainNode = null;
  let musicReadyResolve = null;
  let musicReady = new Promise(r => { musicReadyResolve = r; });

  async function scanMusicFolder() {
    if(MUSIC_FILES.length > 0) return; // already scanned
    try {
      const resp = await fetch('music/');
      const html = await resp.text();
      // Server directory listing: extract .mp3 hrefs
      const matches = html.match(/href="([^"]+\.mp3)"/gi) || [];
      MUSIC_FILES = matches.map(m => 'music/' + decodeURIComponent(m.match(/href="([^"]+)"/i)[1]));
      if(MUSIC_FILES.length === 0) throw new Error('no mp3 found');
    } catch(e) {
      // Fallback: try known files
      const known = [
        'music/SpotiDown.App - BACK_ - c152.mp3',
        'music/SpotiDown.App - Bad Habits - c152.mp3',
        'music/SpotiDown.App - DRIFT - PHXNK MXCH_NE.mp3',
        'music/SpotiDown.App - Drift Anthem - c152.mp3',
        'music/SpotiDown.App - PHONK DXNCE 2 - c152.mp3',
        'music/SpotiDown.App - REAL G - c152.mp3',
        'music/SpotiDown.App - assault - mislaid.mp3',
      ];
      // Probe which actually exist
      const checks = await Promise.all(known.map(f => fetch(f, {method:'HEAD'}).then(r=>r.ok?f:null).catch(()=>null)));
      MUSIC_FILES = checks.filter(Boolean);
    }
    console.log(`Music: ${MUSIC_FILES.length} tracks found`);
  }

  async function loadAndPlayMusic() {
    if(musicSrc){ try{ musicSrc.stop(); }catch(e){} musicSrc=null; }

    if(!ctx) return;
    await scanMusicFolder();
    if(MUSIC_FILES.length === 0){ if(musicReadyResolve){ musicReadyResolve(); musicReadyResolve=null; } return; }
    const raw = MUSIC_FILES[Math.floor(Math.random()*MUSIC_FILES.length)];
    try {
      const resp = await fetch(raw);
      if(!resp.ok) throw new Error(`HTTP ${resp.status}: ${raw}`);
      const ab = await resp.arrayBuffer();
      const buf = await ctx.decodeAudioData(ab);
      musicGainNode = ctx.createGain();
      musicGainNode.gain.value = MUSIC_VOL_BASE;
      musicGainNode.connect(ctx.destination);
      musicGainNode.connect(dest); // CRITICAL: routes into MediaRecorder
      musicSrc = ctx.createBufferSource();
      musicSrc.buffer = buf; musicSrc.loop = true;
      musicSrc.connect(musicGainNode);
      // Start at second 10 so the beat is already going from frame 1
      const startOffset = Math.min(10, buf.duration * 0.2);
      musicSrc.start(0, startOffset);
      if(musicReadyResolve){ musicReadyResolve(); musicReadyResolve=null; }
      console.log('Music loaded:', raw);
    } catch(e){
      console.warn('Music load failed:', e);
      if(musicReadyResolve){ musicReadyResolve(); musicReadyResolve=null; }
    }
  }

  function stopMusic() {
    if(musicSrc){ try{ musicSrc.stop(); }catch(e){} musicSrc=null; }
    if(musicGainNode && ctx){
      musicGainNode.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
    }
  }

  function resetMusicVolume() {
    killCount = 0;
    if(musicGainNode && ctx){
      musicGainNode.gain.cancelScheduledValues(ctx.currentTime);
      musicGainNode.gain.setTargetAtTime(MUSIC_VOL_BASE, ctx.currentTime, 0.8);
    }
  }

  function onKill() {
    killCount++;
    if(!musicGainNode || !ctx) return;
    const cur = musicGainNode.gain.value;
    const next = Math.min(MUSIC_VOL_MAX, cur + MUSIC_KILL_STEP);
    musicGainNode.gain.cancelScheduledValues(ctx.currentTime);
    musicGainNode.gain.setValueAtTime(cur, ctx.currentTime);
    musicGainNode.gain.linearRampToValueAtTime(next, ctx.currentTime + 0.15);
  }

  function onOrbPickup() {
    if(!musicGainNode || !ctx) return;
    const cur = musicGainNode.gain.value;
    const next = Math.min(MUSIC_VOL_MAX, cur + MUSIC_ORB_STEP);
    musicGainNode.gain.cancelScheduledValues(ctx.currentTime);
    musicGainNode.gain.setValueAtTime(cur, ctx.currentTime);
    musicGainNode.gain.linearRampToValueAtTime(next, ctx.currentTime + 0.1);
  }

  // Called synchronously inside a user click — creates AudioContext while gesture is active
  function initCtx() {
    if(ctx && ctx.state !== 'closed') return; // already alive
    ctx  = new AudioContext();
    dest = ctx.createMediaStreamDestination();
    // Silence node: keeps audio track alive in MediaRecorder from frame 0
    const silBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const silSrc = ctx.createBufferSource();
    silSrc.buffer = silBuf; silSrc.loop = true;
    const silG = ctx.createGain(); silG.gain.value = 0;
    silSrc.connect(silG); silG.connect(dest); silSrc.start();
  }

  async function create() {
    // Close previous AudioContext to avoid browser limit (~6 concurrent)
    if(ctx && ctx.state !== 'closed'){ try{ await ctx.close(); }catch(e){} ctx=null; }
    // Re-init fresh context (must be called from user gesture, handled by initCtx in button click)
    ctx  = new AudioContext();
    dest = ctx.createMediaStreamDestination();
    const silBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const silSrc = ctx.createBufferSource();
    silSrc.buffer = silBuf; silSrc.loop = true;
    const silG = ctx.createGain(); silG.gain.value = 0;
    silSrc.connect(silG); silG.connect(dest); silSrc.start();
    killCount = 0;
    musicReady = new Promise(r => { musicReadyResolve = r; });
    await loadAndPlayMusic();
  }

  function tone(freq, dur, type='sine', vol=0.22) {
    if (!ctx || ctx.state==='closed' || ctx.state==='suspended') return;
    const o=ctx.createOscillator(), g=ctx.createGain();
    o.type=type; o.frequency.value=freq;
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime+dur);
    o.connect(g); g.connect(ctx.destination); g.connect(dest);
    o.start(); o.stop(ctx.currentTime+dur);
  }
  // Noise burst for punchy impacts
  function noise(dur, vol=0.18) {
    if (!ctx || ctx.state==='closed') return;
    const buf=ctx.createBuffer(1,ctx.sampleRate*dur,ctx.sampleRate);
    const d=buf.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1);
    const src=ctx.createBufferSource(); src.buffer=buf;
    const flt=ctx.createBiquadFilter(); flt.type='bandpass'; flt.frequency.value=300; flt.Q.value=0.5;
    const g=ctx.createGain();
    g.gain.setValueAtTime(vol,ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001,ctx.currentTime+dur);
    src.connect(flt); flt.connect(g); g.connect(ctx.destination); g.connect(dest);
    src.start(); src.stop(ctx.currentTime+dur);
  }
  return {
    initCtx,
    create,
    stream() { return dest?.stream ?? null; },
    stopMusic,
    resetMusicVolume,
    onKill,
    onOrbPickup,
    get musicReady(){ return musicReady; },
    wall()      { tone(110,0.08,'sine',0.28); noise(0.05,0.12); },
    hit()       {
      noise(0.06,0.22);
      tone(280,0.08,'triangle',0.32);
      setTimeout(()=>tone(180,0.12,'sine',0.18),50);
    },
    kill()      {
      noise(0.04,0.28);
      tone(150,0.18,'sawtooth',0.30);
      setTimeout(()=>tone(300,0.14,'sine',0.22),70);
      setTimeout(()=>tone(600,0.12,'sine',0.18),150);
      setTimeout(()=>tone(900,0.10,'sine',0.14),230);
    },
    heal()      {
      tone(880,0.12,'sine',0.26);
      setTimeout(()=>tone(1100,0.10,'sine',0.22),80);
      setTimeout(()=>tone(1320,0.14,'sine',0.20),160);
    },
    win()       { [330,440,550,660,770].forEach((f,i)=>setTimeout(()=>tone(f,0.45,'sine',0.28),i*130)); },
    roundEnd()  { tone(440,0.22,'sine',0.28); setTimeout(()=>tone(550,0.28,'sine',0.30),200); },
    champion()  { [330,440,550,660,770,880].forEach((f,i)=>setTimeout(()=>tone(f,0.55,'sine',0.32),i*110)); },
    lastTwo()   {
      tone(880,0.14,'square',0.28);
      setTimeout(()=>tone(1100,0.20,'sine',0.30),150);
      setTimeout(()=>tone(1320,0.16,'sine',0.26),280);
    },
    rankUp()    { tone(660,0.10,'sine',0.24); setTimeout(()=>tone(880,0.10,'sine',0.20),80); },
    countdown() { tone(660,0.09,'sine',0.30); noise(0.04,0.10); },
    orbPickup(id){
      switch(id){
        case 'gojo_blue':  tone(60,0.3,'sine',0.28); setTimeout(()=>tone(40,0.4,'sine',0.22),200); break;
        case 'gojo_red':   tone(880,0.05,'sawtooth',0.12); setTimeout(()=>tone(55,0.5,'sawtooth',0.35),80); break;
        case 'gojo_purple':[80,60,40].forEach((f,i)=>setTimeout(()=>tone(f,0.4,'sine',0.25+i*0.05),i*150)); break;
        case 'sandevistan':tone(1200,0.06,'square',0.28); setTimeout(()=>tone(800,0.08,'sine',0.22),80); setTimeout(()=>tone(400,0.3,'sine',0.18),160); noise(0.04,0.15); break;
        case 'timestop':   [1760,1320,880,660].forEach((f,i)=>setTimeout(()=>tone(f,0.14,'sine',0.26),i*60)); break;
        case 'rewind':     [880,660,440,220].forEach((f,i)=>setTimeout(()=>tone(f,0.10,'sawtooth',0.24),i*50)); break;
        case 'toji_chain': tone(800,0.04,'square',0.22); setTimeout(()=>tone(1200,0.06,'triangle',0.18),60); setTimeout(()=>tone(200,0.15,'sine',0.20),120); break;
        case 'ekko_ult':   tone(440,0.08,'sine',0.20); setTimeout(()=>tone(330,0.1,'sine',0.18),100); setTimeout(()=>tone(55,0.5,'sawtooth',0.30),300); break;
        case 'prison':     tone(200,0.1,'square',0.18); setTimeout(()=>tone(150,0.08,'square',0.16),100); setTimeout(()=>tone(100,0.3,'sawtooth',0.22),200); break;
        case 'portal':     tone(100,0.05,'sine',0.10); setTimeout(()=>tone(200,0.05,'sine',0.14),80); setTimeout(()=>tone(400,0.06,'sine',0.18),160); setTimeout(()=>tone(800,0.15,'sine',0.22),240); break;
        // Black Clover
        case 'hellfire':      tone(80,0.1,'sawtooth',0.20); setTimeout(()=>tone(120,0.08,'sawtooth',0.22),100); setTimeout(()=>tone(60,0.5,'sine',0.25),250); break;
        case 'spatial_cube':  [300,400,500,600].forEach((f,i)=>setTimeout(()=>tone(f,0.06,'square',0.16),i*50)); setTimeout(()=>tone(200,0.3,'square',0.20),300); break;
        case 'zephyr':        tone(1200,0.04,'sine',0.12); setTimeout(()=>tone(1600,0.05,'sine',0.14),60); setTimeout(()=>tone(2000,0.06,'sine',0.16),120); setTimeout(()=>tone(800,0.2,'sine',0.18),250); break;
        case 'black_asta':    tone(60,0.06,'sawtooth',0.25); setTimeout(()=>tone(40,0.08,'sawtooth',0.28),80); setTimeout(()=>tone(30,0.4,'sawtooth',0.32),200); break;
        case 'yami_slash':    tone(100,0.04,'sawtooth',0.18); setTimeout(()=>tone(80,0.06,'sawtooth',0.22),80); setTimeout(()=>tone(60,0.08,'sawtooth',0.26),160); setTimeout(()=>tone(40,0.5,'sine',0.30),300); break;
        // JJK
        case 'sukuna_cleave':  tone(80,0.06,'sawtooth',0.22); setTimeout(()=>tone(40,0.3,'sawtooth',0.30),100); setTimeout(()=>tone(60,0.2,'sine',0.18),300); break;
        case 'mahoraga':       [110,88,66,44,33].forEach((f,i)=>setTimeout(()=>tone(f,0.25,'sine',0.18),i*80)); setTimeout(()=>tone(55,0.5,'sawtooth',0.25),500); break;
        case 'piercing_blood': tone(800,0.03,'square',0.14); setTimeout(()=>tone(600,0.04,'square',0.16),40); setTimeout(()=>tone(400,0.04,'sawtooth',0.18),80); setTimeout(()=>tone(200,0.15,'sine',0.20),160); break;
        case 'rika':           [440,550,660,880,1100].forEach((f,i)=>setTimeout(()=>tone(f,0.14,'sine',0.20),i*60)); setTimeout(()=>tone(220,0.4,'sine',0.26),400); break;
        case 'hakari':         [800,1200,600,1600,400,800].forEach((f,i)=>setTimeout(()=>tone(f,0.08,'square',0.24),i*40)); noise(0.05,0.18); break;
        // Naruto
        case 'rasengan':    tone(220,0.10,'sine',0.26); setTimeout(()=>tone(440,0.08,'sine',0.28),80); setTimeout(()=>tone(880,0.14,'sine',0.30),160); setTimeout(()=>tone(1760,0.10,'square',0.22),240); noise(0.05,0.18); break;
        case 'chidori':     noise(0.04,0.25); tone(2000,0.05,'sawtooth',0.26); setTimeout(()=>tone(1500,0.07,'sawtooth',0.28),50); setTimeout(()=>tone(800,0.09,'square',0.26),100); setTimeout(()=>tone(200,0.18,'sawtooth',0.32),180); break;
        case 'tsukuyomi':   [880,660,440,220,110].forEach((f,i)=>setTimeout(()=>tone(f,0.20,'sine',0.22-i*0.01),i*80)); setTimeout(()=>tone(55,0.55,'sine',0.30),500); break;
        case 'hiraishin':   tone(1800,0.04,'sine',0.20); setTimeout(()=>tone(900,0.05,'sine',0.24),40); setTimeout(()=>tone(450,0.06,'sine',0.28),80); setTimeout(()=>tone(1800,0.10,'triangle',0.32),200); noise(0.03,0.12); break;
        case 'sand_tsunami':tone(80,0.05,'sawtooth',0.18); setTimeout(()=>tone(60,0.08,'sawtooth',0.22),100); setTimeout(()=>tone(40,0.4,'sine',0.28),200); break;
        // Slime Isekai
        case 'drago_nova':    tone(880,0.06,'sine',0.18); setTimeout(()=>tone(1760,0.08,'sine',0.22),80); setTimeout(()=>tone(3520,0.10,'sine',0.25),180); setTimeout(()=>tone(220,0.4,'sawtooth',0.28),350); break;
        case 'megiddo':       [1200,1400,1600,1800,2000].forEach((f,i)=>setTimeout(()=>tone(f,0.07,'sine',0.18),i*60)); setTimeout(()=>tone(440,0.4,'square',0.25),400); break;
        case 'veldora_storm': tone(100,0.06,'sawtooth',0.20); setTimeout(()=>tone(200,0.08,'sawtooth',0.24),80); setTimeout(()=>tone(400,0.05,'sawtooth',0.18),160); setTimeout(()=>tone(60,0.5,'sine',0.30),300); break;
        case 'prominence':    tone(60,0.06,'sawtooth',0.22); setTimeout(()=>tone(80,0.08,'sawtooth',0.26),80); setTimeout(()=>tone(120,0.06,'sawtooth',0.20),160); setTimeout(()=>tone(300,0.4,'sine',0.28),250); break;
        case 'diablo_end':    [440,330,220,110,55].forEach((f,i)=>setTimeout(()=>tone(f,0.15,'sine',0.16+i*0.02),i*70)); setTimeout(()=>tone(30,0.6,'sawtooth',0.32),450); break;
        // Chainsaw Man
        case 'chainsaw_rev':  tone(80,0.08,'sawtooth',0.24); [100,120,140,160].forEach((f,i)=>setTimeout(()=>tone(f,0.06,'sawtooth',0.20),i*30)); setTimeout(()=>tone(60,0.4,'sawtooth',0.30),250); break;
        case 'blood_rain':    [600,500,400,300,200].forEach((f,i)=>setTimeout(()=>tone(f,0.07,'square',0.18),i*45)); setTimeout(()=>tone(100,0.3,'sawtooth',0.25),300); break;
        case 'makima_chain':  tone(200,0.05,'square',0.16); setTimeout(()=>tone(150,0.07,'square',0.20),80); setTimeout(()=>tone(100,0.08,'square',0.24),160); setTimeout(()=>tone(50,0.4,'sine',0.28),280); break;
        case 'future_devil':  [880,660,440,220].forEach((f,i)=>setTimeout(()=>tone(f,0.10,'sine',0.14),i*60)); setTimeout(()=>tone(110,0.4,'triangle',0.22),320); break;
        case 'pochita_core':  tone(440,0.06,'sine',0.16); setTimeout(()=>tone(880,0.08,'sine',0.20),80); setTimeout(()=>tone(1760,0.10,'sine',0.24),160); setTimeout(()=>tone(120,0.5,'sawtooth',0.32),280); break;
        // One Punch Man
        case 'serious_punch': tone(60,0.08,'sawtooth',0.28); setTimeout(()=>tone(40,0.10,'sawtooth',0.32),60); setTimeout(()=>tone(30,0.5,'sine',0.38),120); setTimeout(()=>tone(20,0.6,'sine',0.40),300); break;
        case 'incinerate':    tone(200,0.06,'sawtooth',0.20); setTimeout(()=>tone(400,0.08,'sawtooth',0.24),60); setTimeout(()=>tone(800,0.10,'sawtooth',0.28),120); setTimeout(()=>tone(1600,0.06,'sawtooth',0.18),200); break;
        case 'tornado_psy':   [330,440,550,660].forEach((f,i)=>setTimeout(()=>tone(f,0.10,'sine',0.24),i*50)); setTimeout(()=>tone(220,0.45,'sine',0.30),300); break;
        case 'silver_fang':   noise(0.05,0.20); tone(120,0.08,'triangle',0.28); setTimeout(()=>tone(180,0.10,'triangle',0.30),60); setTimeout(()=>tone(240,0.12,'triangle',0.32),120); setTimeout(()=>tone(80,0.45,'sine',0.35),220); break;
        case 'sonic_slash':   noise(0.03,0.22); tone(2000,0.05,'sawtooth',0.26); setTimeout(()=>tone(1500,0.06,'sawtooth',0.28),30); setTimeout(()=>tone(1000,0.07,'sawtooth',0.28),60); setTimeout(()=>tone(500,0.10,'sine',0.26),120); break;
        // Frieren
        case 'zoltraak':      tone(660,0.08,'sine',0.28); setTimeout(()=>tone(880,0.10,'sine',0.30),60); setTimeout(()=>tone(1100,0.12,'sine',0.32),120); setTimeout(()=>tone(440,0.35,'triangle',0.28),250); break;
        case 'granat':        [440,550,660,880,1100,880,660].forEach((f,i)=>setTimeout(()=>tone(f,0.09,'sine',0.24),i*40)); setTimeout(()=>tone(110,0.55,'sine',0.34),380); noise(0.04,0.16); break;
        case 'aura_soul':     [220,176,132,110,88].forEach((f,i)=>setTimeout(()=>tone(f,0.16,'sine',0.24+i*0.01),i*80)); setTimeout(()=>tone(55,0.55,'sine',0.32),500); break;
        case 'stark_thunder': tone(150,0.07,'sawtooth',0.22); setTimeout(()=>tone(300,0.09,'sawtooth',0.26),70); setTimeout(()=>tone(600,0.07,'square',0.20),140); setTimeout(()=>tone(80,0.4,'sine',0.30),250); break;
        case 'frieren_end':   tone(1200,0.04,'sine',0.16); setTimeout(()=>tone(900,0.06,'sine',0.20),80); setTimeout(()=>tone(600,0.08,'sine',0.24),160); setTimeout(()=>tone(300,0.10,'sine',0.28),240); setTimeout(()=>tone(100,0.5,'sine',0.32),400); break;
        // Arena powers
        case 'arena_split': tone(300,0.04,'square',0.16); setTimeout(()=>tone(150,0.08,'sawtooth',0.22),80); setTimeout(()=>tone(75,0.3,'sawtooth',0.28),200); break;
        case 'arena_shrink':[440,330,220,110,55].forEach((f,i)=>setTimeout(()=>tone(f,0.12,'sawtooth',0.18),i*60)); break;
        case 'arena_chaos': tone(200,0.05,'triangle',0.14); setTimeout(()=>tone(400,0.05,'triangle',0.16),60); setTimeout(()=>tone(600,0.05,'triangle',0.18),120); setTimeout(()=>tone(300,0.3,'sine',0.20),200); break;
        default:           tone(660,0.12,'sine',0.28); noise(0.03,0.12);
      }
    },
  };
})();
// ✅ COMPLETO
