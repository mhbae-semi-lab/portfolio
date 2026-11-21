// 세부 패널 안의 움직이는 그림. tools/make_figures.py 와 같은 원리를 합성 데이터로 브라우저에서 바로 계산한다.
// 패널의 <figure data-widget="focus|align|match"> 안 정적 그림은 스크립트가 없을 때의 대체용이다.
// 계산 검사: node tools/check_widgets.js
"use strict";

const COL = { ink: "#3a414b", muted: "#687180", line: "#c9ced6", blue: "#2f62d6", gray: "#9aa3ae", paper: "#f4f4f4", white: "#ffffff" };
const FONT = '"Pretendard Variable", "Malgun Gothic", sans-serif';

// 같은 그림이 매번 나오도록 시드가 있는 난수
function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function normal(r) {
  let u = 0;
  while (!u) u = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
}

// 분리형 가우시안 블러 (Float32Array, w x h)
function blur(src, w, h, s) {
  if (s < 0.3) return src.slice();
  const rad = Math.ceil(s * 3), k = new Float32Array(2 * rad + 1);
  let sum = 0;
  for (let i = -rad; i <= rad; i++) sum += (k[i + rad] = Math.exp((-i * i) / (2 * s * s)));
  for (let i = 0; i < k.length; i++) k[i] /= sum;
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let a = 0;
      for (let i = -rad; i <= rad; i++) a += src[y * w + Math.min(w - 1, Math.max(0, x + i))] * k[i + rad];
      tmp[y * w + x] = a;
    }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let a = 0;
      for (let i = -rad; i <= rad; i++) a += tmp[Math.min(h - 1, Math.max(0, y + i)) * w + x] * k[i + rad];
      out[y * w + x] = a;
    }
  return out;
}

// ROI 안 라플라시안 분산 (선명도)
function lapVar(img, w, x0, y0, n) {
  let s = 0, s2 = 0, c = 0;
  for (let y = y0 + 1; y < y0 + n - 1; y++)
    for (let x = x0 + 1; x < x0 + n - 1; x++) {
      const v = 4 * img[y * w + x] - img[y * w + x - 1] - img[y * w + x + 1] - img[(y - 1) * w + x] - img[(y + 1) * w + x];
      s += v; s2 += v * v; c++;
    }
  return s2 / c - (s / c) ** 2;
}

// ---------- 1. 입자 높이 Auto Focus ----------
function focusModel() {
  const S = 120, TOP = 60, r = rng(15);
  const noise = (n) => Float32Array.from({ length: n }, () => normal(r));
  const f0 = blur(noise(S * S), S, S, 1.3), p0 = blur(noise(S * S), S, S, 1.0), n0 = noise(S * S);
  const floor = new Float32Array(S * S), part = new Float32Array(S * S), mask = new Float32Array(S * S);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const i = y * S + x, d = Math.hypot(x - S / 2, y - S / 2);
      floor[i] = f0[i] * 60 + 105;
      part[i] = p0[i] * 45 + 185 - d * 1.5;
      mask[i] = d < 20 ? 1 : 0;
    }
  const roiP = [S / 2 - 8, S / 2 - 8, 16];
  const roiF = [[0, -40], [40, 0], [0, 40], [-40, 0]].map(([dx, dy]) => [S / 2 - 8 + dx, S / 2 - 8 + dy, 16]);
  const sig = (dz) => 0.35 + Math.abs(dz) / 6;
  function render(z) {
    const m = blur(mask, S, S, sig(z - TOP)), fl = blur(floor, S, S, sig(z)), pt = blur(part, S, S, sig(z - TOP));
    const t = new Float32Array(S * S);
    for (let i = 0; i < t.length; i++) t[i] = fl[i] * (1 - m[i]) + pt[i] * m[i] + n0[i] * 1.5;
    return t;
  }
  function sharp(t) {
    const p = lapVar(t, S, ...roiP);
    const f = roiF.reduce((a, roi) => a + lapVar(t, S, ...roi), 0) / roiF.length;
    return [p, f];
  }
  const zs = [], sp = [], sf = [];
  for (let z = 0; z <= 80; z += 2) {
    const [p, f] = sharp(render(z));
    zs.push(z); sp.push(p); sf.push(f);
  }
  const mp = Math.max(...sp), mf = Math.max(...sf);
  return { S, TOP, roiP, roiF, render, sharp, zs, sp: sp.map((v) => v / mp), sf: sf.map((v) => v / mf), mp, mf };
}

// ---------- 2. Wafer Align 격자 점수 ----------
function alignModel() {
  const S = 220, P = 44, TH = 1.8, r = rng(12), c = S / 2;
  const th = (TH * Math.PI) / 180, ct = Math.cos(th), st = Math.sin(th);
  const stripes = Float32Array.from({ length: S }, () => normal(r) * 5);
  const img = new Float32Array(S * S);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const u = (x - c) * ct + (y - c) * st + 1000, v = -(x - c) * st + (y - c) * ct + 1000;
      const a = ((u % P) + P) % P, b = ((v % P) + P) % P;
      let g = 74;
      if (a > 4 && a < P - 4 && b > 4 && b < P - 4) g = 132;
      if (a > 9 && a < P - 9 && (Math.abs(b - 13) < 1.2 || Math.abs(b - 22) < 1.2 || Math.abs(b - 31) < 1.2)) g = 112;
      img[y * S + x] = g + normal(r) * 7 + stripes[x];
    }
  // 가정한 각도 a 로 행을 따라 평균낸 프로파일의 분산: 격자 각도와 맞으면 Die 사이 틈이 또렷해져 커진다
  function score(adeg) {
    const a = (adeg * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a), R = 70;
    const rows = [];
    for (let i = -R; i <= R; i++) {
      let s = 0;
      for (let j = -R; j <= R; j++) {
        const x = c + j * ca - i * sa, y = c + j * sa + i * ca; // 이웃 네 픽셀 보간
        const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, q = y0 * S + x0;
        s += (img[q] * (1 - fx) + img[q + 1] * fx) * (1 - fy) + (img[q + S] * (1 - fx) + img[q + S + 1] * fx) * fy;
      }
      rows.push(s / (2 * R + 1));
    }
    const m = rows.reduce((p, q) => p + q, 0) / rows.length;
    return rows.reduce((p, q) => p + (q - m) ** 2, 0) / rows.length;
  }
  const as = [], sc = [];
  for (let k = -50; k <= 50; k++) { as.push(k / 10); sc.push(score(k / 10)); }
  const lo = Math.min(...sc), hi = Math.max(...sc);
  const norm = sc.map((v) => (v - lo) / (hi - lo));
  const peak = as[norm.indexOf(1)];
  return { S, P, TH, img, score, as, norm, peak, lo, hi };
}

// ---------- 3. 결함 좌표 매칭 ----------
function matchModel() {
  const r = rng(23), n = 46, k = 7;
  const centers = Array.from({ length: k }, () => [12 + r() * 76, 12 + r() * 76]);
  const ref = [], size = [];
  for (let i = 0; i < n; i++) {
    const c = centers[Math.floor(r() * k)];
    ref.push([c[0] + normal(r) * 3.2, c[1] + normal(r) * 3.2]);
    size.push(Math.exp(1.1 + 0.65 * normal(r)));
  }
  const idx = [];
  for (let i = 0; i < n; i++) if (r() > 0.1) idx.push(i);
  const jit = idx.map(() => [normal(r) * 1.3, normal(r) * 1.3]);
  const isize = idx.map((i) => size[i] * (1 + 0.07 * normal(r)));

  function greedy(cost, limit) {
    const cand = [];
    cost.forEach((row, i) => row.forEach((v, j) => { if (v <= limit) cand.push([v, i, j]); }));
    cand.sort((a, b) => a[0] - b[0]);
    const pairs = new Map(), usedR = new Set();
    for (const [, i, j] of cand) if (!pairs.has(i) && !usedR.has(j)) { pairs.set(i, j); usedR.add(j); }
    return pairs;
  }
  // e: 장비 사이 위치 오차 배율 (1 이 그림 기본값)
  function run(e) {
    const ins = idx.map((i, q) => [ref[i][0] + e * (1.6 + jit[q][0]), ref[i][1] + e * (-1.1 + jit[q][1])]);
    const d = ins.map((p) => ref.map((q) => Math.hypot(p[0] - q[0], p[1] - q[1])));
    const byPos = greedy(d, 4.0);
    const byBoth = greedy(d.map((row, i) => row.map((v, j) => (v < 6 ? v / 6 + Math.abs(Math.log(isize[i] / size[j])) / 0.25 : Infinity))), 2.0);
    const ok = (pairs) => [...pairs].filter(([i, j]) => j === idx[i]).length;
    return { ins, byPos, byBoth, okPos: ok(byPos), okBoth: ok(byBoth) };
  }
  return { ref, size, idx, isize, run, n: idx.length };
}

// ---------- 화면 ----------
function makeUI(fig, { label, min, max, step, value, unit, aspect }) {
  const img = fig.querySelector("img");
  const cv = document.createElement("canvas");
  cv.width = 1200; cv.height = Math.round(1200 * aspect);
  cv.setAttribute("role", "img");
  const ctl = document.createElement("div");
  ctl.className = "widget-ctl";
  const id = "w" + Math.random().toString(36).slice(2, 8);
  ctl.innerHTML = `<label for="${id}">${label}</label><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}"><output for="${id}"></output>`;
  const read = document.createElement("p");
  read.className = "widget-read";
  read.setAttribute("aria-live", "polite");
  if (img) img.replaceWith(cv); else fig.prepend(cv);
  cv.after(ctl, read);
  fig.classList.add("widget");
  const input = ctl.querySelector("input"), out = ctl.querySelector("output");
  const g = cv.getContext("2d");
  return { cv, g, input, out, read, unit };
}

function drawGray(g, data, S, x, y, size) {
  const off = document.createElement("canvas");
  off.width = off.height = S;
  const im = off.getContext("2d").createImageData(S, S);
  for (let i = 0; i < S * S; i++) {
    const v = Math.max(0, Math.min(255, data[i]));
    im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v;
    im.data[i * 4 + 3] = 255;
  }
  off.getContext("2d").putImageData(im, 0, 0);
  g.imageSmoothingEnabled = true;
  g.drawImage(off, x, y, size, size);
}

function chart(g, box, xs, series, xLabel, marker, xFmt) {
  const [X, Y, W, H] = box, x0 = xs[0], x1 = xs[xs.length - 1];
  const px = (v) => X + ((v - x0) / (x1 - x0)) * W, py = (v) => Y + H - v * H * 0.88;
  g.strokeStyle = COL.line; g.lineWidth = 2;
  g.beginPath(); g.moveTo(X, Y); g.lineTo(X, Y + H); g.lineTo(X + W, Y + H); g.stroke();
  g.fillStyle = COL.muted; g.font = `22px ${FONT}`; g.textAlign = "center";
  for (const t of [x0, (x0 + x1) / 2, x1]) g.fillText(xFmt(t), px(t), Y + H + 30);
  g.fillStyle = COL.ink; g.font = `24px ${FONT}`;
  g.fillText(xLabel, X + W / 2, Y + H + 64);
  for (const s of series) {
    g.strokeStyle = s.color; g.lineWidth = 4; g.beginPath();
    s.ys.forEach((v, i) => (i ? g.lineTo(px(xs[i]), py(v)) : g.moveTo(px(xs[i]), py(v))));
    g.stroke();
    if (s.label) {
      const k = s.ys.indexOf(Math.max(...s.ys));
      g.fillStyle = s.color; g.font = `600 24px ${FONT}`; g.textAlign = "center";
      g.fillText(s.label, px(xs[k]), py(s.ys[k]) - 14);
    }
  }
  g.strokeStyle = COL.ink; g.lineWidth = 2.5; g.setLineDash([8, 6]);
  g.beginPath(); g.moveTo(px(marker), Y); g.lineTo(px(marker), Y + H); g.stroke();
  g.setLineDash([]);
}

function throttle(fn) {
  let queued = false;
  return () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; fn(); }); } };
}

let FM, AM, MM; // 모델은 처음 쓸 때 한 번만 만든다

// 화면 문구 (페이지 <html lang> 으로 고른다)
const TXT = {
  ko: {
    fLabel: "초점 높이", fAria: "초점 높이에 따른 합성 입자 영상과 입자, 바닥 선명도 곡선", floor: "바닥", part: "입자", fAxis: "초점 높이 (µm)",
    fRead: (p, f, pz, fz) => `지금 선명도 입자 ${p}%, 바닥 ${f}%. 가장 선명한 높이 입자 ${pz}µm, 바닥 ${fz}µm, 차이 ${pz - fz}µm 가 입자 높이입니다.`,
    aLabel: "가정한 회전각", aAria: "합성 Die 격자 위에 가정한 각도의 선을 겹친 그림과 격자 일치 점수 곡선",
    aPeak: (v) => `최고점 ${v}°`, aAxis: "가정한 격자 회전각 (°)",
    aRead: (s, v) => `격자 일치 점수 ${s}% (최고점 대비). 선이 Die 사이 틈과 나란해지는 ${v}° 에서 점수가 가장 높습니다.`,
    mLabel: "장비 사이 위치 오차", mAria: "기준 결함과 검사 결함을 위치만으로, 위치와 크기를 함께 써서 짝지은 두 그림",
    mPos: "위치만 보고 짝짓기", mBoth: "위치와 크기를 함께", mTitle: (t, ok, n) => `${t}, 맞는 짝 ${ok}/${n}`,
    mRead: (a, b) => `빈 원은 기준 결함, 채운 원은 검사 결함, 점선은 틀린 짝입니다. 위치만 ${a}쌍, 위치와 크기 ${b}쌍이 맞습니다. 오차를 키우면 위치만 쓰는 쪽이 먼저 무너집니다.`,
  },
  en: {
    fLabel: "Focus height", fAria: "Synthetic particle image at the chosen focus height, with particle and floor sharpness curves", floor: "Floor", part: "Particle", fAxis: "Focus height (µm)",
    fRead: (p, f, pz, fz) => `Sharpness now: particle ${p}%, floor ${f}%. Sharpest at ${pz}µm for the particle and ${fz}µm for the floor; the ${pz - fz}µm gap is the particle height.`,
    aLabel: "Assumed angle", aAria: "Lines at the assumed angle over a synthetic die grid, with the grid match score curve",
    aPeak: (v) => `Peak ${v}°`, aAxis: "Assumed grid rotation (°)",
    aRead: (s, v) => `Grid match score ${s}% of the peak. The score is highest at ${v}°, where the lines run parallel to the gaps between dies.`,
    mLabel: "Position error between tools", mAria: "Reference and inspection defects paired by position only, and by position and size",
    mPos: "Position only", mBoth: "Position and size", mTitle: (t, ok, n) => `${t}, correct pairs ${ok}/${n}`,
    mRead: (a, b) => `Hollow circles are reference defects, filled circles are inspection defects, dashed lines are wrong pairs. Position only: ${a} correct; position and size: ${b}. As the error grows, position-only matching breaks down first.`,
  },
};
const L = TXT[typeof document !== "undefined" && document.documentElement.lang === "en" ? "en" : "ko"];
const WIDGETS = {
  focus(fig) {
    FM = FM || focusModel();
    const ui = makeUI(fig, { label: L.fLabel, min: 0, max: 80, step: 1, value: 30, unit: "µm", aspect: 0.47 });
    const { g } = ui;
    ui.cv.setAttribute("aria-label", L.fAria);
    const draw = () => {
      const z = +ui.input.value, t = FM.render(z), [p, f] = FM.sharp(t);
      g.fillStyle = COL.paper; g.fillRect(0, 0, 1200, 564);
      drawGray(g, t, FM.S, 30, 30, 500);
      const k = 500 / FM.S, box = (roi, color, dash) => {
        g.strokeStyle = color; g.lineWidth = 4; g.setLineDash(dash);
        g.strokeRect(30 + roi[0] * k, 30 + roi[1] * k, roi[2] * k, roi[2] * k);
        g.setLineDash([]);
      };
      box(FM.roiP, COL.blue, []);
      FM.roiF.forEach((roi) => box(roi, "#e8eaee", [10, 8]));
      chart(g, [620, 40, 540, 400], FM.zs, [
        { ys: FM.sf, color: COL.gray, label: L.floor },
        { ys: FM.sp, color: COL.blue, label: L.part },
      ], L.fAxis, z, (v) => `${v}`);
      ui.out.value = `${z}µm`;
      const pz = FM.zs[FM.sp.indexOf(1)], fz = FM.zs[FM.sf.indexOf(1)];
      ui.read.textContent = L.fRead(Math.round((p / FM.mp) * 100), Math.round((f / FM.mf) * 100), pz, fz);
    };
    ui.input.addEventListener("input", throttle(draw));
    draw();
  },

  align(fig) {
    AM = AM || alignModel();
    const ui = makeUI(fig, { label: L.aLabel, min: -5, max: 5, step: 0.1, value: -2, unit: "°", aspect: 0.47 });
    const { g } = ui;
    ui.cv.setAttribute("aria-label", L.aAria);
    const draw = () => {
      const a = +ui.input.value, s = (AM.score(a) - AM.lo) / (AM.hi - AM.lo);
      g.fillStyle = COL.paper; g.fillRect(0, 0, 1200, 564);
      drawGray(g, AM.img, AM.S, 30, 30, 500);
      const k = 500 / AM.S, cx = 30 + 250, cy = 30 + 250, ra = (a * Math.PI) / 180;
      g.save(); g.beginPath(); g.rect(30, 30, 500, 500); g.clip();
      g.strokeStyle = "rgba(47, 98, 214, .85)"; g.lineWidth = 3;
      for (let i = -6; i <= 6; i++) {
        const off = ((((-1000 % AM.P) + AM.P) % AM.P) + i * AM.P) * k, L = 420; // Die 사이 틈 위치
        const ox = cx - Math.sin(ra) * off, oy = cy + Math.cos(ra) * off;
        g.beginPath(); g.moveTo(ox - Math.cos(ra) * L, oy - Math.sin(ra) * L); g.lineTo(ox + Math.cos(ra) * L, oy + Math.sin(ra) * L); g.stroke();
      }
      g.restore();
      chart(g, [620, 40, 540, 400], AM.as, [{ ys: AM.norm, color: COL.ink, label: L.aPeak(AM.peak.toFixed(1)) }],
        L.aAxis, a, (v) => `${v}`);
      ui.out.value = `${a.toFixed(1)}°`;
      ui.read.textContent = L.aRead(Math.round(s * 100), AM.peak.toFixed(1));
    };
    ui.input.addEventListener("input", throttle(draw));
    draw();
  },

  match(fig) {
    MM = MM || matchModel();
    const ui = makeUI(fig, { label: L.mLabel, min: 0, max: 3, step: 0.1, value: 1, unit: "배", aspect: 0.5 });
    const { g } = ui;
    ui.cv.setAttribute("aria-label", L.mAria);
    const xs = MM.ref.map((p) => p[0]), ys = MM.ref.map((p) => p[1]);
    const bx = [Math.min(...xs) - 8, Math.max(...xs) + 8], by = [Math.min(...ys) - 8, Math.max(...ys) + 8];
    const draw = () => {
      const e = +ui.input.value, R = MM.run(e);
      g.fillStyle = COL.paper; g.fillRect(0, 0, 1200, 600);
      [[R.byPos, R.okPos, L.mPos, 20], [R.byBoth, R.okBoth, L.mBoth, 610]].forEach(([pairs, ok, title, X]) => {
        const W = 570, H = 500, Y = 70;
        const px = (v) => X + ((v - bx[0]) / (bx[1] - bx[0])) * W, py = (v) => Y + ((v - by[0]) / (by[1] - by[0])) * H;
        g.fillStyle = COL.white; g.fillRect(X, Y, W, H);
        g.strokeStyle = COL.line; g.lineWidth = 2; g.strokeRect(X, Y, W, H);
        g.fillStyle = COL.ink; g.font = `600 28px ${FONT}`; g.textAlign = "center";
        g.fillText(L.mTitle(title, ok, MM.n), X + W / 2, 46);
        MM.ref.forEach((p, i) => {
          g.strokeStyle = COL.gray; g.lineWidth = 2.5; g.beginPath();
          g.arc(px(p[0]), py(p[1]), 3 + MM.size[i] * 1.6, 0, 7); g.stroke();
        });
        R.ins.forEach((p, q) => {
          g.fillStyle = "rgba(47, 98, 214, .5)"; g.beginPath();
          g.arc(px(p[0]), py(p[1]), 3 + MM.isize[q] * 1.6, 0, 7); g.fill();
        });
        pairs.forEach((j, q) => {
          const good = j === MM.idx[q];
          g.strokeStyle = good ? COL.blue : COL.ink; g.lineWidth = good ? 3 : 4; g.setLineDash(good ? [] : [7, 5]);
          g.beginPath(); g.moveTo(px(R.ins[q][0]), py(R.ins[q][1])); g.lineTo(px(MM.ref[j][0]), py(MM.ref[j][1])); g.stroke();
        });
        g.setLineDash([]);
      });
      ui.out.value = `×${e.toFixed(1)}`;
      ui.read.textContent = L.mRead(R.okPos, R.okBoth);
    };
    ui.input.addEventListener("input", throttle(draw));
    draw();
  },
};

function initWidgets(root) {
  root.querySelectorAll("figure[data-widget]:not(.widget)").forEach((fig) => {
    const make = WIDGETS[fig.dataset.widget];
    try { if (make) make(fig); } catch (e) { console.error(e); } // 실패하면 정적 그림이 그대로 남는다
  });
}

if (typeof module !== "undefined") module.exports = { focusModel, alignModel, matchModel };
else window.initWidgets = initWidgets;
