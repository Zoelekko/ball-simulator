// ════════════════════════════════════════════════
// TICKER — Web Worker that keeps 60fps even in background tabs
// ════════════════════════════════════════════════
// Chrome throttles requestAnimationFrame to ~1fps when tab is hidden.
// This Worker posts 'tick' at 60Hz regardless of tab visibility.

const blob = new Blob([`
  let id = null;
  onmessage = (e) => {
    if(e.data === 'start'){
      if(id) clearInterval(id);
      id = setInterval(() => postMessage('tick'), 16);
    }
    if(e.data === 'stop'){
      if(id){ clearInterval(id); id = null; }
    }
  };
`], { type: 'application/javascript' });

const worker = new Worker(URL.createObjectURL(blob));
let callback = null;
let useWorker = false;

worker.onmessage = () => {
  if(useWorker && callback) callback(performance.now());
};

export const Ticker = {
  // Start the loop — uses rAF when visible, Worker when hidden
  start(fn){
    callback = fn;
    // Always run rAF loop (handles visible state)
    const rafLoop = (t) => {
      requestAnimationFrame(rafLoop);
      if(!useWorker) callback(t);
    };
    requestAnimationFrame(rafLoop);

    // Worker kicks in when tab goes hidden
    worker.postMessage('start');

    document.addEventListener('visibilitychange', () => {
      useWorker = document.hidden;
    });
  },
};
