/* ============================================================
   HERO BLACK HOLE - objective readout
   ------------------------------------------------------------
   verify-blackhole.mjs answers "does it render at all"; this answers
   "how bright, and how much is it actually moving", which is what you
   need to tune the gas. Emits a MACHINE-READABLE line so two builds
   can be diffed:

     spinSpeed 0.06 -> 0.115   (faster)
     brightness 1.75 -> 2.0, glow 1.5 -> 1.72, exposure 1.05 -> 1.12

   Two metrics, and the difference matters:
     meanLuma / pctLit  = intensity. Rises with brightness+glow+exposure.
     motionEnergy       = mean absolute luma delta between frames 250ms
       apart over a contiguous block. A proxy for speed, NOT a linear one:
       the outer disc lags hard (Kepler) and barely responds to spinSpeed,
       and raising brightness alone enlarges the per-pixel deltas. Use it
       to prove the frame is moving and to compare builds - never to
       compute a multiplier.

   Run: node scripts/measure-blackhole.mjs      (needs the site on :4321)
   ============================================================ */
/* One-off objective check of the hero black hole: luma + motion.
   Uses .noviq-hole-card (the stable hook Hero.tsx puts on the card) rather
   than .shadow-2xl, which is not unique to it.
   Run: node scripts/_measure-blackhole.mjs                                   */
import { chromium } from 'playwright';

const PORT = process.env.PORT || '4321';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`http://127.0.0.1:${PORT}/en`, { waitUntil: 'load', timeout: 45_000 });

/* the shader is a dynamic import and compiles 260 steps — wait for real */
await page.waitForSelector('.noviq-hole-card canvas', { timeout: 30_000 });
await page.waitForTimeout(6000);

/* Motion energy, not "how many points differ".
   Sampling isolated pixels and counting "changed by >3" is useless as a
   speed proxy: features ORBIT rather than translate, so a faster spin can
   land a pixel back near its starting value and score LOWER (classic
   aliasing), and sparse points mostly hit the slow outer disc that Kepler
   barely moves. Instead take a contiguous block, diff it frame-to-frame
   over a SHORT interval (250ms — short enough that nothing completes a
   full orbit), and average the absolute luma change. That rises with how
   far the pattern actually travelled. */
const grab = () =>
  page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => {
          const c = document.querySelector('.noviq-hole-card canvas');
          if (!c) return resolve(null);
          const gl = c.getContext('webgl2') || c.getContext('webgl');
          const w = c.width, h = c.height;
          const px = new Uint8Array(w * h * 4);
          gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
          /* luma plane, subsampled 2x for speed but still CONTIGUOUS */
          const lw = w >> 1, lh = h >> 1;
          const luma = new Float32Array(lw * lh);
          let sum = 0, max = 0, lit = 0, warm = 0, n = 0;
          for (let y = 0; y < lh; y++) {
            for (let x = 0; x < lw; x++) {
              const i = ((y * 2) * w + x * 2) * 4;
              const l = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114);
              luma[y * lw + x] = l;
              sum += l; if (l > max) max = l;
              if (l > 8) lit++;
              if (px[i] > px[i + 2] + 8) warm++;
              n++;
            }
          }
          resolve({ luma, lw, lh, meanLuma: +(sum / n).toFixed(1), maxLuma: Math.round(max),
                    pctLit: +((lit / n) * 100).toFixed(1), pctWarm: +((warm / n) * 100).toFixed(1) });
        });
      }),
  );

const energy = (p, q) => {
  if (!p || !q) return null;
  let d = 0, n = 0;
  for (let i = 0; i < p.luma.length; i++) { d += Math.abs(p.luma[i] - q.luma[i]); n++; }
  return +(d / n).toFixed(3);
};

/* three short-interval deltas, averaged — one sample is too noisy */
const deltas = [];
for (let k = 0; k < 3; k++) {
  const f1 = await grab();
  await page.waitForTimeout(250);
  const f2 = await grab();
  const e = energy(f1, f2);
  if (e !== null) deltas.push(e);
}
const a = await grab();
const motion = deltas.length ? +(deltas.reduce((s, v) => s + v, 0) / deltas.length).toFixed(3) : 0;

console.log('  mean luma       ', a.meanLuma);
console.log('  max luma        ', a.maxLuma);
console.log('  lit pixels      ', a.pctLit + '%');
console.log('  warm pixels     ', a.pctWarm + '%');
console.log(`  motion energy   ${motion} mean|Δluma| per 250ms  (samples: ${deltas.join(', ')})`);
console.log('  MACHINE-READABLE ' + JSON.stringify({
  meanLuma: a.meanLuma, maxLuma: a.maxLuma,
  pctLit: a.pctLit, pctWarm: a.pctWarm, motionEnergy: motion,
}));

await browser.close();
