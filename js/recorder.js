// ════════════════════════════════════════════════
// RECORDER
// ════════════════════════════════════════════════
// ── Auto-batch: run up to 10 matches back-to-back ──
export let autoBatchActive = false;
export let autoBatchPart   = 0;
export const AUTO_BATCH_MAX = 10;
// null = random, 'solo' = force individual, 'team' = force team, 'boss' = force boss
export let forcedMode = null;
// For auto batch: pre-shuffled sequence guaranteeing ≥3 solo, ≥3 team, ≥3 boss in 10
export let autoBatchSequence = [];
export function buildBatchSequence(){
  // 10 slots: 2 solo + 2 team + 2 boss + 2 dungeon, 2 random
  const modes = ['solo','team','boss','dungeon'];
  const rand1 = modes[Math.floor(Math.random()*modes.length)];
  const rand2 = modes[Math.floor(Math.random()*modes.length)];
  const slots = ['solo','solo','team','team','boss','boss','dungeon','dungeon', rand1, rand2];
  // shuffle
  for(let i=slots.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [slots[i],slots[j]]=[slots[j],slots[i]];
  }
  return slots;
}

// Setters for mutable exports (modules can't reassign exported lets from outside)
export function setAutoBatchActive(v){ autoBatchActive = v; }
export function setAutoBatchPart(v){ autoBatchPart = v; }
export function setForcedMode(v){ forcedMode = v; }
export function setAutoBatchSequence(v){ autoBatchSequence = v; }

// Late-binding deps
let _RC = null, _Snd = null, _setStatus = null, _soloBtn = null, _teamBtn = null,
    _bossBtn = null, _dungeonBtn = null, _autoBtn = null, _restartBtn = null, _begin = null;

export function initRec(deps){
  _RC = deps.RC; _Snd = deps.Snd; _setStatus = deps.setStatus;
  _soloBtn = deps.soloBtn; _teamBtn = deps.teamBtn; _bossBtn = deps.bossBtn;
  _dungeonBtn = deps.dungeonBtn; _autoBtn = deps.autoBtn; _restartBtn = deps.restartBtn;
  _begin = deps.begin;
}

export const Rec = (() => {
  let mr=null, chunks=[];

  function pickMime() {
    // Prefer highest quality codecs — H.264 High Profile > Main > Baseline > VP9
    return [
      'video/mp4;codecs=avc1.640028,mp4a.40.2',  // H.264 High Profile L4.0
      'video/mp4;codecs=avc1.4D4028,mp4a.40.2',  // H.264 Main Profile L4.0
      'video/mp4;codecs=avc1.42E01E,mp4a.40.2',  // H.264 Baseline
      'video/mp4;codecs=avc1,mp4a.40.2',
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ].find(m=>MediaRecorder.isTypeSupported(m)) ?? '';
  }

  function start() {
    if (mr&&mr.state!=='inactive') mr.stop();
    chunks=[];
    const mime=pickMime();
    const tracks=[..._RC.captureStream(60).getTracks(),...(_Snd.stream()?.getTracks()??[])];
    // 12 Mbps — high quality for 1080x1920 @ 60fps
    const opts={videoBitsPerSecond:12_000_000};
    if(mime) opts.mimeType=mime;
    mr=new MediaRecorder(new MediaStream(tracks),opts);
    mr.ondataavailable=e=>e.data.size>0&&chunks.push(e.data);
    mr.onstop=()=>{
      const usedMime=mr.mimeType||mime||'video/webm';
      const isMP4=usedMime.includes('mp4'), ext=isMP4?'mp4':'webm';
      const blob=new Blob(chunks,{type:usedMime});
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');
      a.href=url;
      a.download=`${autoBatchPart}.${ext}`;
      a.click();
      setTimeout(()=>URL.revokeObjectURL(url),15000);
      const sizeMB=(blob.size/1024/1024).toFixed(1);
      const codecInfo=usedMime.split(';')[0].split('/')[1]?.toUpperCase()||ext.toUpperCase();
      if(autoBatchActive && autoBatchPart < AUTO_BATCH_MAX){
        _setStatus('done',`✓ Part ${autoBatchPart} (${sizeMB}MB ${codecInfo}) — iniciando Part ${autoBatchPart+1}...`);
        setTimeout(()=>{ _begin(); },2500);
      } else {
        autoBatchActive=false;
        _setStatus('done',`✓ Listo — ${autoBatchPart} partidas (${sizeMB}MB ${codecInfo})`);
        _soloBtn.disabled=false; _teamBtn.disabled=false; if(_bossBtn) _bossBtn.disabled=false; if(_dungeonBtn) _dungeonBtn.disabled=false; _autoBtn.disabled=false; _restartBtn.disabled=false;
      }
    };
    mr.start(100); // flush every 100ms for smoother data capture
    _setStatus('rec',`● REC — Part ${autoBatchPart} / ${AUTO_BATCH_MAX}`);
  }

  function stop() { if(mr&&mr.state!=='inactive') mr.stop(); }
  return { start, stop };
})();
// ✅ COMPLETO
