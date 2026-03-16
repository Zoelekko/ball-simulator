// ════════════════════════════════════════════════
// PERFORMANCE MONITOR — debug panel (not recorded)
// ════════════════════════════════════════════════

const logEl    = document.getElementById('perfLog');
const clearBtn = document.getElementById('perfClear');
const els = {
  fps:    document.getElementById('pFps'),
  fpsMin: document.getElementById('pFpsMin'),
  parts:  document.getElementById('pParts'),
  fx:     document.getElementById('pFx'),
  balls:  document.getElementById('pBalls'),
  arena:  document.getElementById('pArena'),
  frame:  document.getElementById('pFrame'),
  state:  document.getElementById('pState'),
};

let samples = [];
let fpsMin = 999;
let logLines = 0;
const MAX_LOG = 200;
let lastAbility = '';
let lastAbilityFrame = 0;
let lastDropLog = 0;

// Session tracking
let sessionStart = 0;
let sessionMode = '';
let sessionBalls = 0;
let sessionShape = '';
let sessionRound = 0;

const copyBtn  = document.getElementById('perfCopy');
if(clearBtn) clearBtn.onclick = () => { logEl.innerHTML = ''; logLines = 0; fpsMin = 999; };
if(copyBtn) copyBtn.onclick = () => {
  const text = Array.from(logEl.children).map(el => el.textContent).join('\n');
  navigator.clipboard.writeText(text).then(() => {
    copyBtn.textContent = 'COPIED!';
    setTimeout(() => { copyBtn.textContent = 'COPY'; }, 1500);
  });
};

function timeStr(){
  const d = new Date();
  return `${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}.${String(d.getMilliseconds()).padStart(3,'0')}`;
}

function formatDuration(ms){
  const s = Math.floor(ms/1000);
  const m = Math.floor(s/60);
  const sec = s%60;
  return `${m}m${String(sec).padStart(2,'0')}s`;
}

function addLog(cls, msg){
  if(!logEl) return;
  const line = document.createElement('div');
  line.className = cls;
  line.innerHTML = `<span class="time">${timeStr()}</span>${msg}`;
  logEl.appendChild(line);
  logLines++;
  while(logLines > MAX_LOG && logEl.firstChild){ logEl.removeChild(logEl.firstChild); logLines--; }
  logEl.scrollTop = logEl.scrollHeight;
}

export const Perf = {
  tick(now, data){
    if(data.state === 'idle') return;

    samples.push(now);
    while(samples.length > 0 && now - samples[0] > 1000) samples.shift();
    const fps = samples.length;

    if(fps > 0 && fps < fpsMin) fpsMin = fps;
    if(data.frame % 300 === 0) fpsMin = fps;

    if(els.fps){
      els.fps.textContent = fps;
      els.fps.className = fps >= 55 ? 'val' : fps >= 45 ? 'val warn' : 'val bad';
    }
    if(els.fpsMin){
      els.fpsMin.textContent = fpsMin;
      els.fpsMin.className = fpsMin >= 55 ? 'val' : fpsMin >= 45 ? 'val warn' : 'val bad';
    }
    if(els.parts)  els.parts.textContent  = data.particles;
    if(els.fx)     els.fx.textContent     = data.fxCount;
    if(els.balls)  els.balls.textContent  = data.alive;
    if(els.arena)  els.arena.textContent  = `${Math.round(data.arenaR)} (${Math.round(data.arenaR/data.arenaMax*100)}%)`;
    if(els.frame)  els.frame.textContent  = data.frame;
    if(els.state)  els.state.textContent  = data.state;

    // FPS drop detection (max 1 log per second, ignore first 3 seconds)
    if(fps < 50 && fps > 10 && data.frame > 180 && now - lastDropLog > 1000){
      lastDropLog = now;
      addLog('drop',
        `FPS DROP: ${fps} fps | parts=${data.particles} fx=${data.fxCount} alive=${data.alive} arena=${Math.round(data.arenaR)}px` +
        (lastAbility ? ` | last: ${lastAbility}` : '')
      );
    }

    if(data.particles > 300 && data.frame % 60 === 0){
      addLog('warn', `High particles: ${data.particles}`);
    }

    if(data.fxCount > 12 && data.frame % 60 === 0){
      addLog('warn', `FX overload: ${data.fxCount} effects`);
    }
  },

  logAbility(ballName, abilityName, frame){
    lastAbility = `${abilityName} by ${ballName}`;
    lastAbilityFrame = frame;
    addLog('info', `ABILITY: ${ballName} used ${abilityName}`);
  },

  logEvent(msg){
    addLog('ok', msg);
  },

  // Call at game start with full context
  logStart(data){
    sessionStart = performance.now();
    sessionMode = data.mode;
    sessionBalls = data.balls;
    sessionShape = data.shape;
    sessionRound = data.round || 1;
    fpsMin = 999;
    samples = [];
    lastAbility = '';
    addLog('ok', `════════════════════════════════`);
    addLog('ok', `NEW GAME — Part ${data.part}`);
    addLog('ok', `Mode: ${data.mode} | Balls: ${data.balls} | Shape: ${data.shape}`);
    addLog('ok', `Resolution: ${data.resolution} | Round: ${sessionRound}`);
    addLog('ok', `════════════════════════════════`);
  },

  // Call when a round starts
  logRound(round, alive){
    sessionRound = round;
    addLog('ok', `ROUND ${round} START — ${alive} alive`);
  },

  // Call when game ends
  logEnd(data){
    const duration = formatDuration(performance.now() - sessionStart);
    addLog('ok', `────────────────────────────────`);
    addLog('ok', `GAME OVER — duration: ${duration}`);
    addLog('ok', `Winner: ${data.winner} | Mode: ${sessionMode} | Rounds: ${sessionRound}`);
    addLog('ok', `Min FPS: ${fpsMin} | Shape: ${sessionShape} | Balls: ${sessionBalls}`);
    addLog('ok', `────────────────────────────────`);
  },

  reset(){
    fpsMin = 999;
    samples = [];
  },
};
