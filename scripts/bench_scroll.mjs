// Scroll benchmark for the Flutter calculators (2026-11-12).
// Launches the local Google Chrome headless (it still uses the real GPU),
// opens a page that embeds a Flutter app in an iframe, waits for it to
// settle, then scrolls the app with synthetic wheel events, one per frame,
// 240 frames x 4 runs, and prints the frame intervals as JSON. A frame over
// 20 ms missed 60 fps. Run 1 is the cold run; compare runs 2-4 between builds.
//
// Why not the browser pane: a hidden pane throttles requestAnimationFrame to
// 2 fps, so its timings are meaningless.
//
// usage: node scripts/bench_scroll.mjs <url> <label> [--w=1440 --h=900]
//          [--luopan=off] [--trace] [--shot] [--headful] [--out=DIR]
//   --luopan=off  stores the BaZi app's "Background Luopan" switch as off first
//   --trace       writes <label>.trace.json (Chrome trace; GPU vs main thread)
//   --shot        writes <label>.png after the runs (scroll ends at the top)
// Outputs go to --out (default: a fresh folder under the system temp dir).
// Serve local builds on a fresh port each time: main.dart.js has no hash.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const url = args[0];
const label = args[1] || 'run';
const opt = Object.fromEntries(args.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true];
}));
const W = +(opt.w || 1440), H = +(opt.h || 900);
const here = opt.out || mkdtempSync(path.join(tmpdir(), 'sow-bench-'));
const profile = mkdtempSync(path.join(tmpdir(), 'sow-bench-prof-'));
const port = 9300 + Math.floor(Math.random() * 500);
const chromeArgs = [
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--disable-extensions',
  `--window-size=${W},${H}`, '--force-device-scale-factor=2',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows',
];
if (!opt.headful) chromeArgs.push('--headless=new');
if (opt.headful) chromeArgs.push('--window-position=0,0');
chromeArgs.push('about:blank');
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', chromeArgs, { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));

let wsUrl;
for (let i = 0; i < 50 && !wsUrl; i++) {
  await sleep(200);
  try {
    const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    wsUrl = list.find(t => t.type === 'page')?.webSocketDebuggerUrl;
  } catch {}
}
const ws = new WebSocket(wsUrl);
await new Promise(r => ws.addEventListener('open', r));
let id = 0; const pending = new Map(); const events = [];
ws.addEventListener('message', m => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  else events.push(msg);
});
const send = (method, params = {}) => new Promise(r => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails));
  return r.result?.result?.value;
};

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 2, mobile: false });
if (opt.luopan === 'off') {
  // The app reads SharedPreferences = localStorage key 'flutter.bazi_background_luopan'.
  const origin = new URL(url).origin;
  await send('Page.navigate', { url: origin + '/robots.txt' });
  await sleep(1500);
  await ev(`localStorage.setItem('flutter.bazi_background_luopan','false'); 1`);
}
await send('Page.navigate', { url });
// Wait for the app and the calendar.
for (let i = 0; i < 120; i++) {
  await sleep(500);
  const ok = await ev(`(()=>{try{const d=document.querySelector('iframe').contentDocument;return !!d.querySelector('flutter-view')}catch(e){return false}})()`);
  if (ok) break;
}
await sleep(6000); // fonts, images, first frames settle

const gpu = await ev(`(()=>{const c=document.createElement('canvas').getContext('webgl2');const e=c.getExtension('WEBGL_debug_renderer_info');return e?c.getParameter(e.UNMASKED_RENDERER_WEBGL):'?'})()`);

const bench = `(async (frames, dy) => {
  const w = document.querySelector('iframe').contentWindow, d = w.document;
  const fv = d.querySelector('flutter-view'); const rect = fv.getBoundingClientRect();
  const x = rect.left + rect.width*0.4, y = rect.top + rect.height*0.6;
  const deltas = []; let last = 0;
  await new Promise(res => { let i = 0; function step(t){ if (last) deltas.push(t-last); last = t;
    if (i++ >= frames) return res();
    const dir = (Math.floor(i/60)%2) ? -1 : 1;
    fv.dispatchEvent(new w.WheelEvent('wheel',{deltaY:dy*dir,deltaMode:0,clientX:x,clientY:y,bubbles:true,cancelable:true,composed:true}));
    w.requestAnimationFrame(step);} w.requestAnimationFrame(step); });
  const s = [...deltas].sort((a,b)=>a-b); const q = p => +s[Math.floor(p*(s.length-1))].toFixed(1);
  return { n: s.length, mean: +(deltas.reduce((a,b)=>a+b,0)/deltas.length).toFixed(1), p50: q(.5), p90: q(.9), p99: q(.99), max: q(1), over20: deltas.filter(v=>v>20).length, over34: deltas.filter(v=>v>34).length };
})`;

const out = { label, url, W, H, gpu, runs: [] };
if (opt.trace) {
  await send('Tracing.start', { categories: 'devtools.timeline,disabled-by-default-devtools.timeline,blink,gpu,cc,viz', options: 'record-as-much-as-possible', transferMode: 'ReturnAsStream' });
}
for (let r = 0; r < 4; r++) out.runs.push(await ev(`${bench}(240, 25)`));
if (opt.trace) {
  const done = new Promise(r => { const t = setInterval(() => { const e = events.find(e => e.method === 'Tracing.tracingComplete'); if (e) { clearInterval(t); r(e); } }, 100); });
  await send('Tracing.end');
  const tc = await done; const handle = tc.params.stream; let data = '';
  for (;;) { const c = await send('IO.read', { handle, size: 1 << 20 }); data += c.result.data; if (c.result.eof) break; }
  writeFileSync(path.join(here, `${label}.trace.json`), data);
}
if (opt.shot) {
  const s = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(path.join(here, `${label}.png`), Buffer.from(s.result.data, 'base64'));
}
console.log(JSON.stringify(out));
ws.close(); chrome.kill();
await sleep(500);
rmSync(profile, { recursive: true, force: true });
