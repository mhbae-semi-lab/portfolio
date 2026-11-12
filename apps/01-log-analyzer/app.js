// 화면 · 타임라인 · 로그 뷰어 · Claude 원인 분석
"use strict";

const SDK_URL = "https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@1.3.0/+esm";
const MODELS = [
  { id: "claude-opus-5-5", label: "Claude Opus 5.5 (기본)", fallbacks: true },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5", fallbacks: true },
  { id: "claude-haiku-5-5", label: "Claude Haiku 5.5 (빠르고 저렴)", fallbacks: false },
];
const HOW = { example: "미리 생성한 예시", rule: "규칙 기반 (통계)", claude: "Claude 분석", fallback: "규칙 기반 (Claude 검증 실패 대체)" };
const LOOKBACKS = [2, 5, 10, 30];
const SAMPLE_NAME = "spotcheck_2026-11-10.log";

const S = {
  name: "", sample: true, entries: [], stats: null, badCount: 0, badLines: [],
  eps: [], clusters: [], sel: null, lookback: 10, gap: 120,
  results: {}, view: null, focus: null, highlight: new Set(),
  apiKey: "", model: MODELS[0].id, busy: false,
};

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const hms = (t) => new Date(t).toISOString().slice(11, 19);
const hmsms = (t) => new Date(t).toISOString().slice(11, 23);
const fmtN = (n) => n.toLocaleString("ko-KR");
const cluster = () => S.clusters.find((c) => c.code === S.sel);

// ---------- 불러오기 · 분석 ----------
function loadText(text, name, sample) {
  const p = LA.parseLog(text);
  Object.assign(S, { name, sample, entries: p.entries, badCount: p.badCount, badLines: p.badLines, stats: LA.stats(p.entries), results: {}, focus: null, highlight: new Set() });
  S.view = S.entries.length ? [S.stats.t0, S.stats.t1] : null;
  $("#f-module").innerHTML = `<option value="">모든 모듈</option>` + Object.keys(S.stats.modules).sort().map((m) => `<option>${esc(m)}</option>`).join("");
  analyze();
}

function analyze() {
  S.eps = LA.episodes(S.entries, S.gap * 1000);
  S.clusters = LA.clusters(S.eps);
  S.results = {};
  S.sel = S.clusters.length ? S.clusters[0].code : null;
  renderStats();
  renderClusters();
  selectCluster(S.sel);
}

// 군집별 계산 결과(직전 경고 · 근거 줄 · 원인 후보)는 lookback 이 바뀔 때만 다시 만든다
function ctx(c) {
  const lb = S.lookback * 60e3;
  let r = S.results[c.code];
  if (!r || r.lb !== lb) {
    const pre = LA.precursors(S.entries, c, lb);
    const pool = LA.evidencePool(S.entries, c, lb);
    const prompt = LA.promptFor(c, pre, pool);
    const old = r;
    r = { lb, pre, pool, prompt, log: old ? old.log : [] };
    if (old && old.how === "claude") Object.assign(r, { how: "claude", out: old.out });
    else if (S.sample && window.SAMPLE_CAUSES[c.code] && (!old || old.how === "example")) setExample(c, r);
    else setRule(c, r);
    S.results[c.code] = r;
  }
  return r;
}

function setExample(c, r) {
  const s = window.SAMPLE_CAUSES[c.code];
  r.out = { causes: s.causes.map((x) => ({ ...x, evidence: LA.resolvePatterns(r.pool, x.patterns) })), checks: s.checks };
  r.how = "example";
}
function setRule(c, r, how = "rule") {
  r.out = LA.ruleCauses(c, r.pre);
  r.how = how;
}

// ---------- 렌더링 ----------
function renderStats() {
  const st = S.stats;
  if (!S.entries.length) {
    $("#stats").innerHTML = `<p class="msg err">읽은 줄이 없습니다. 형식을 확인하세요${S.badLines.length ? ` (예: ${S.badLines.slice(0, 3).join(", ")}번 줄)` : ""}.</p>`;
    return;
  }
  const lv = st.levels;
  const alarms = S.eps.reduce((n, e) => n + e.alarms.length, 0);
  $("#stats").innerHTML = `
    <div><b>${esc(S.name)}</b><small>${hms(st.t0)} ~ ${hms(st.t1)} · ${new Date(st.t0).toISOString().slice(0, 10)}</small></div>
    <div><b>${fmtN(S.entries.length)}</b><small>줄${S.badCount ? ` · 읽지 못한 줄 ${fmtN(S.badCount)}` : ""}</small></div>
    <div><b>${fmtN(lv.INFO || 0)}</b><small>정보</small></div>
    <div><b class="c-warn">${fmtN(lv.WARN || 0)}</b><small>경고</small></div>
    <div><b class="c-alarm">${fmtN(alarms)}</b><small>알람</small></div>
    <div class="arrow">→</div>
    <div><b>${S.eps.length}</b><small>발생</small></div>
    <div class="arrow">→</div>
    <div><b>${S.clusters.length}</b><small>군집</small></div>`;
}

function renderClusters() {
  $("#cluster-list").innerHTML = S.clusters.map((c) => {
    const main = [...c.signatures].sort((a, b) => b[1] - a[1])[0][0];
    const top = ctx(c).out.causes[0];
    return `<li><button type="button" class="cl ${c.code === S.sel ? "on" : ""}" data-cl="${esc(c.code)}">
      <span class="cl-head"><b>${esc(c.code)}</b> <span class="cl-n">${c.episodes.length}회</span></span>
      <span class="cl-name">${esc(c.name)} <small>${esc(c.module)}</small></span>
      <span class="cl-chain">${esc(main)}</span>
      <span class="cl-times">${c.episodes.map((e) => hms(e.t0).slice(0, 5)).join(" · ")}</span>
      <span class="cl-top"><i class="conf c-${esc(top.confidence)}">${esc(top.confidence)}</i> ${esc(top.cause)}</span>
    </button></li>`;
  }).join("") || `<li class="hint">알람이 없습니다.</li>`;
}

function selectCluster(code, focusEp = 0) {
  S.sel = code;
  const c = cluster();
  renderClusters();
  renderDetail();
  if (c) {
    const r = ctx(c);
    S.highlight = new Set(r.out.causes.flatMap((x) => x.evidence));
    S.focus = c.episodes[focusEp].trigger.n;
  }
  drawTimeline();
  renderRows(true);
}

function renderDetail() {
  const c = cluster();
  const el = $("#detail");
  if (!c) { el.innerHTML = `<p class="hint">알람 군집이 없습니다.</p>`; return; }
  const r = ctx(c);
  const bad = LA.validateCauses(r.out, r.pool, r.prompt);
  el.innerHTML = `
    <div class="panel-head">
      <h2><span class="code">${esc(c.code)}</span> ${esc(c.name)}</h2>
      <span class="hint">${esc(c.module)} · ${c.episodes.length}회</span>
    </div>
    <div class="chains">${[...c.signatures].map(([s, n]) => `<span class="chain">${s.split(" → ").map((x, i) => `<b class="${i ? "" : "first"}">${esc(x)}</b>`).join("<i>→</i>")}<small>${n}회</small></span>`).join("")}</div>

    <h3>발생</h3>
    <div class="eps">${c.episodes.map((ep, i) => `<button type="button" class="ep" data-ep="${i}">
      <b>${hms(ep.t0)}</b><small>${ep.alarms.length}개 알람 · ${Math.max(1, Math.round((ep.t1 - ep.t0) / 1000))}초 · ${ep.trigger.n}번 줄</small></button>`).join("")}</div>

    <h3>첫 알람 직전 경고
      <select id="lookback">${LOOKBACKS.map((m) => `<option value="${m}" ${m === S.lookback ? "selected" : ""}>${m}분 전부터</option>`).join("")}</select></h3>
    ${r.pre.length ? `<table class="pre"><thead><tr><th>모듈</th><th>경고 (숫자는 #)</th><th title="몇 번의 발생 앞에 나왔나">발생 앞</th><th title="그 경고 전체 중 알람 직전에 나온 비율">집중도</th></tr></thead><tbody>
      ${r.pre.slice(0, 6).map((p) => `<tr><td>${esc(p.module)}</td><td>${esc(p.tpl)}</td><td>${p.coverage}/${p.of}</td>
        <td><span class="meter"><span style="width:${Math.round(p.spec * 100)}%"></span></span>${Math.round(p.spec * 100)}% <small>(${p.inWin}/${p.total})</small></td></tr>`).join("")}
      </tbody></table>` : `<p class="hint">이 구간에 경고가 없습니다.</p>`}

    <h3>원인 후보 <small>${esc(HOW[r.how])}</small></h3>
    <div class="gen-row">
      <button class="btn sm" type="button" id="gen">Claude 로 분석</button>
      <button class="btn ghost sm" type="button" id="use-rule">규칙 기반</button>
      ${S.sample && window.SAMPLE_CAUSES[c.code] ? `<button class="btn ghost sm" type="button" id="use-example">예시로 되돌리기</button>` : ""}
    </div>
    <ol class="causes">${r.out.causes.map((x, i) => `<li>
      <div class="c-head"><span class="rank">${i + 1}</span><i class="conf c-${esc(x.confidence)}">${esc(x.confidence)}</i><b>${esc(x.cause)}</b></div>
      <p>${esc(x.reasoning)}</p>
      <div class="ev">근거 줄 ${x.evidence.map((n) => `<button type="button" class="ln" data-ln="${n}">${n}</button>`).join("")}</div>
    </li>`).join("")}</ol>
    ${r.out.checks?.length ? `<h3>현장 확인</h3><ul class="checks-list">${r.out.checks.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
    <div class="verdict">${bad.length
      ? `<p class="state bad">검증 실패</p><ul>${bad.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>` +
        (r.how === "example" ? `<small>직전 구간을 줄이면 예시가 기대는 경고가 근거 목록에서 빠질 수 있습니다. 구간을 넓히거나 규칙 기반 · Claude 로 다시 고르세요.</small>` : "")
      : `<p class="state ok">검증 통과</p><small>근거 줄은 보낸 목록(${r.pool.length}줄) 안에서만 · 수치는 로그 · 통계에 있던 것만</small>`}</div>
    <pre class="log" ${r.log.length ? "" : "hidden"}>${esc(r.log.join("\n"))}</pre>`;
}

// ---------- 타임라인 (canvas) ----------
const TL = { left: 78, right: 12, top: 24, lane: 30 };
const COL = { alarm: "#c00000", warn: "#c27c0e", info: "#9e9e9e", band: "rgba(192,0,0,.11)", band2: "rgba(0,0,0,.05)", grid: "#e6e6e6", text: "#595959" };
let tlDrag = null;

function lanes() { return S.stats ? Object.keys(S.stats.modules).sort() : []; }

function drawTimeline(sel) {
  const cv = $("#timeline");
  const L = lanes();
  const w = cv.parentElement.clientWidth;
  const h = TL.top + Math.max(1, L.length) * TL.lane + 6;
  const dpr = window.devicePixelRatio || 1;
  cv.width = w * dpr; cv.height = h * dpr;
  cv.style.width = w + "px"; cv.style.height = h + "px";
  const g = cv.getContext("2d");
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  if (!S.view) return;
  const [a, b] = S.view;
  const pw = w - TL.left - TL.right;
  const X = (t) => TL.left + (t - a) / (b - a) * pw;
  g.font = "12px Pretendard, 'Malgun Gothic', sans-serif";

  // 레인 · 시간 눈금
  L.forEach((m, i) => {
    const y = TL.top + i * TL.lane;
    g.fillStyle = i % 2 ? "#fafafa" : "#fff";
    g.fillRect(TL.left, y, pw, TL.lane);
    g.fillStyle = COL.text;
    g.textBaseline = "middle";
    g.fillText(m.length > 9 ? m.slice(0, 8) + "…" : m, 6, y + TL.lane / 2);
  });
  const span = b - a;
  const step = [60e3, 300e3, 600e3, 1800e3, 3600e3, 7200e3].find((s) => span / s <= Math.max(4, pw / 90)) || 7200e3;
  g.textBaseline = "alphabetic";
  for (let t = Math.ceil(a / step) * step; t <= b; t += step) {
    const x = X(t);
    g.strokeStyle = COL.grid; g.beginPath(); g.moveTo(x, TL.top); g.lineTo(x, h - 6); g.stroke();
    g.fillStyle = COL.text; g.fillText(hms(t).slice(0, 5), x - 15, 15);
  }

  // 발생 구간
  const c = cluster();
  for (const ep of S.eps) {
    if (ep.t1 < a || ep.t0 > b) continue;
    const mine = c && ep.trigger.code === c.code;
    g.fillStyle = mine ? COL.band : COL.band2;
    const x0 = X(ep.t0) - 3, x1 = Math.max(X(ep.t1) + 3, x0 + 6);
    g.fillRect(x0, TL.top, x1 - x0, L.length * TL.lane);
  }

  // 정보 밀도 → 경고 → 알람 순으로
  const li = new Map(L.map((m, i) => [m, i]));
  const bins = L.map(() => new Uint16Array(Math.ceil(pw) + 1));
  let max = 1;
  for (const e of S.entries) {
    if (e.sev !== 1 || e.t < a || e.t > b) continue;
    const k = Math.floor((e.t - a) / (b - a) * pw);
    const v = ++bins[li.get(e.module)][k];
    if (v > max) max = v;
  }
  g.fillStyle = COL.info;
  bins.forEach((arr, i) => {
    const y = TL.top + (i + 1) * TL.lane - 2;
    for (let k = 0; k < arr.length; k++) if (arr[k]) { const hh = 2 + (TL.lane * 0.4) * Math.min(1, arr[k] / max); g.fillRect(TL.left + k, y - hh, 1, hh); }
  });
  for (const lvl of [2, 3]) {
    g.fillStyle = lvl === 3 ? COL.alarm : COL.warn;
    for (const e of S.entries) {
      if (e.sev !== lvl || e.t < a || e.t > b) continue;
      const y = TL.top + li.get(e.module) * TL.lane;
      const x = X(e.t);
      if (lvl === 3) g.fillRect(x - 1.5, y + 3, 3, TL.lane - 6);
      else g.fillRect(x - 1, y + 8, 2, TL.lane - 16);
    }
  }
  // 포커스 줄
  const f = S.focus && S.entries.find((e) => e.n === S.focus);
  if (f && f.t >= a && f.t <= b) {
    const x = X(f.t);
    g.strokeStyle = "#262626"; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(x, TL.top - 4); g.lineTo(x, h - 6); g.stroke(); g.setLineDash([]);
  }
  if (sel) { g.fillStyle = "rgba(38,38,38,.12)"; g.fillRect(Math.min(sel[0], sel[1]), TL.top, Math.abs(sel[1] - sel[0]), L.length * TL.lane); }
  $("#range").textContent = `${hms(a)} ~ ${hms(b)}${a !== S.stats.t0 || b !== S.stats.t1 ? " (확대됨)" : ""}`;
}

function tAt(x) {
  const w = $("#timeline").clientWidth - TL.left - TL.right;
  const [a, b] = S.view;
  return a + Math.min(1, Math.max(0, (x - TL.left) / w)) * (b - a);
}
function nearest(x, y, minSev) {
  const [a, b] = S.view;
  const w = $("#timeline").clientWidth - TL.left - TL.right;
  const lane = lanes()[Math.floor((y - TL.top) / TL.lane)];
  let best = null, bd = 9;
  for (const e of S.entries) {
    if (e.sev < minSev || e.t < a || e.t > b) continue;
    const d = Math.abs(TL.left + (e.t - a) / (b - a) * w - x) + (lane && e.module !== lane ? 4 : 0);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

const cv = $("#timeline");
cv.addEventListener("pointerdown", (e) => { if (!S.view) return; tlDrag = [e.offsetX, e.offsetX]; cv.setPointerCapture(e.pointerId); });
cv.addEventListener("pointermove", (e) => {
  if (!S.view) return;
  if (tlDrag) { tlDrag[1] = e.offsetX; drawTimeline(tlDrag); return; }
  const n = nearest(e.offsetX, e.offsetY, 2);
  const tip = $("#tip");
  tip.hidden = false;
  tip.innerHTML = n ? `<b>${n.n}</b> ${hmsms(n.t)} <i class="lv lv-${n.level}">${n.level}</i> [${esc(n.module)}] ${esc(n.msg)}` : hms(tAt(e.offsetX));
  tip.style.left = Math.min(e.offsetX + 12, cv.clientWidth - tip.offsetWidth - 4) + "px";
  tip.style.top = e.offsetY + 14 + "px";
});
cv.addEventListener("pointerleave", () => { $("#tip").hidden = true; });
cv.addEventListener("pointerup", (e) => {
  if (!tlDrag) return;
  const [x0, x1] = tlDrag;
  tlDrag = null;
  if (Math.abs(x1 - x0) > 6) {
    const a = tAt(Math.min(x0, x1)), b = tAt(Math.max(x0, x1));
    if (b - a > 5e3) S.view = [a, b];
    drawTimeline();
    renderRows(true);
    return;
  }
  const al = nearest(e.offsetX, e.offsetY, 3);
  if (al) {
    const c = S.clusters.find((c) => c.episodes.some((ep) => ep.alarms.includes(al)));
    S.sel = c.code;
    renderClusters(); renderDetail();
    S.highlight = new Set(ctx(c).out.causes.flatMap((x) => x.evidence));
    focusLine(al.n);
    return;
  }
  const w = nearest(e.offsetX, e.offsetY, 2);
  if (w) focusLine(w.n); else drawTimeline();
});
cv.addEventListener("dblclick", () => resetView());
function resetView() { if (!S.stats) return; S.view = [S.stats.t0, S.stats.t1]; drawTimeline(); renderRows(true); }
new ResizeObserver(() => drawTimeline()).observe(cv.parentElement);

// ---------- 로그 뷰어 ----------
function filtered() {
  const lv = +$("#f-level").value, mod = $("#f-module").value, q = $("#f-text").value.trim().toLowerCase();
  const [a, b] = S.view || [0, Infinity];
  return S.entries.filter((e) => e.t >= a && e.t <= b && e.sev >= lv && (!mod || e.module === mod) && (!q || e.raw.toLowerCase().includes(q)));
}

function renderRows(scroll) {
  const list = filtered();
  let i0 = 0;
  const fi = S.focus ? list.findIndex((e) => e.n === S.focus) : -1;
  if (fi >= 0) i0 = Math.max(0, fi - 120);
  const shown = list.slice(i0, i0 + 400);
  $("#viewer-count").textContent = `${fmtN(list.length)}줄${list.length > shown.length ? ` 중 ${shown.length}줄 표시 (${shown.length ? shown[0].n : 0}번 줄부터)` : ""}`;
  $("#rows").innerHTML = shown.map((e) => `<div class="r ${e.n === S.focus ? "focus" : ""} ${S.highlight.has(e.n) ? "hl" : ""} sev${e.sev}" data-row="${e.n}">
    <span class="n">${e.n}</span><span class="t">${hmsms(e.t)}</span><span class="lv lv-${e.level}">${e.level}</span><span class="m">${esc(e.module)}</span><span class="tx">${esc(e.msg)}</span></div>`).join("")
    || `<p class="hint pad">조건에 맞는 줄이 없습니다.</p>`;
  if (scroll) {
    const box = $("#rows"), row = box.querySelector(".r.focus");
    box.scrollTop = row ? row.offsetTop - box.clientHeight / 2 + row.clientHeight / 2 : 0;
  }
}

function focusLine(n) {
  S.focus = n;
  const e = S.entries.find((x) => x.n === n);
  if (e && S.view && (e.t < S.view[0] || e.t > S.view[1])) S.view = [S.stats.t0, S.stats.t1];
  const lv = +$("#f-level").value;
  if (e && (e.sev < lv || ($("#f-module").value && $("#f-module").value !== e.module))) { $("#f-level").value = "0"; $("#f-module").value = ""; }
  drawTimeline();
  renderRows(true);
  $("#rows").closest(".viewer").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

for (const id of ["f-level", "f-module"]) $("#" + id).addEventListener("change", () => renderRows(true));
$("#f-text").addEventListener("input", () => renderRows(false));

// ---------- 클릭 ----------
document.addEventListener("click", (e) => {
  const b = e.target.closest("button, .r");
  if (!b) return;
  if (b.dataset.cl) return selectCluster(b.dataset.cl);
  if (b.dataset.ep) { const c = cluster(); focusLine(c.episodes[+b.dataset.ep].trigger.n); return; }
  if (b.dataset.ln) return focusLine(+b.dataset.ln);
  if (b.dataset.row) { S.focus = +b.dataset.row; drawTimeline(); renderRows(false); return; }
  switch (b.id) {
    case "load-sample": return loadSample();
    case "download-sample": return downloadSample();
    case "reset-view": return resetView();
    case "open-settings": return openSettings();
    case "use-rule": { const c = cluster(), r = ctx(c); setRule(c, r); r.log = []; return refreshCluster(); }
    case "use-example": { const c = cluster(), r = ctx(c); setExample(c, r); r.log = []; return refreshCluster(); }
    case "gen": return analyzeWithClaude(cluster());
  }
});
document.addEventListener("change", (e) => {
  if (e.target.id === "lookback") { S.lookback = +e.target.value; refreshCluster(); }
});

function refreshCluster() {
  const c = cluster();
  renderClusters();
  renderDetail();
  S.highlight = new Set(ctx(c).out.causes.flatMap((x) => x.evidence));
  renderRows(false);
}

// ---------- 파일 ----------
let sampleText = null;
function loadSample() {
  sampleText = sampleText || LOGGEN.generate();
  $("#load-sample").classList.add("on");
  loadText(sampleText, SAMPLE_NAME, true);
}
function downloadSample() {
  sampleText = sampleText || LOGGEN.generate();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([sampleText], { type: "text/plain" }));
  a.download = SAMPLE_NAME;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function readFile(file) {
  if (!file) return;
  if (file.size > 50 * 1024 * 1024) { $("#stats").innerHTML = `<p class="msg err">50MB 가 넘는 파일은 브라우저에서 다루기 어렵습니다. 기간을 나눠 주세요.</p>`; return; }
  const fr = new FileReader();
  fr.onload = () => { $("#load-sample").classList.remove("on"); loadText(fr.result, file.name, false); };
  fr.readAsText(file);
}
$("#file").addEventListener("change", (e) => readFile(e.target.files[0]));
document.addEventListener("dragover", (e) => { e.preventDefault(); document.body.classList.add("dragging"); });
document.addEventListener("dragleave", (e) => { if (!e.relatedTarget) document.body.classList.remove("dragging"); });
document.addEventListener("drop", (e) => { e.preventDefault(); document.body.classList.remove("dragging"); readFile(e.dataTransfer.files[0]); });

// ---------- 설정 ----------
function openSettings() {
  $("#api-key").value = S.apiKey;
  $("#model").innerHTML = MODELS.map((m) => `<option value="${m.id}" ${m.id === S.model ? "selected" : ""}>${esc(m.label)}</option>`).join("");
  $("#gap").value = S.gap;
  $("#settings-err").textContent = "";
  $("#settings").showModal();
}
$("#settings-save").addEventListener("click", (e) => {
  const gap = +$("#gap").value;
  if (!(gap >= 10 && gap <= 3600)) { e.preventDefault(); $("#settings-err").textContent = "발생 묶기 간격은 10~3600초 사이로 넣어 주세요."; return; }
  S.apiKey = $("#api-key").value.trim();
  S.model = $("#model").value;
  if (gap !== S.gap) { S.gap = gap; analyze(); }
});

// ---------- Claude ----------
let sdk = null;
async function client() {
  if (!sdk) sdk = (await import(SDK_URL)).default;
  return new sdk({ apiKey: S.apiKey, dangerouslyAllowBrowser: true }); // 방문자 본인 키, 메모리에만
}
function errText(err) {
  if (!sdk) return "SDK 를 불러오지 못했습니다: " + err.message;
  if (err instanceof sdk.AuthenticationError) return "API 키가 올바르지 않습니다 (401)";
  if (err instanceof sdk.PermissionDeniedError) return "이 키로는 해당 모델을 쓸 수 없습니다 (403)";
  if (err instanceof sdk.RateLimitError) return "요청 한도를 넘었습니다. 잠시 후 다시 시도하세요 (429)";
  if (err instanceof sdk.BadRequestError) return "요청 오류 (400): " + err.message;
  if (err instanceof sdk.APIConnectionError) return "네트워크 연결 실패: " + err.message;
  if (err instanceof sdk.APIError) return `API 오류 (${err.status ?? "?"}): ${err.message}`;
  return err.message || String(err);
}

async function callClaude(c, r, note) {
  const m = MODELS.find((x) => x.id === S.model) || MODELS[0];
  const params = {
    model: m.id,
    max_tokens: 16000,
    system: LA.SYSTEM,
    messages: [{ role: "user", content: r.prompt + (note ? "\n\n" + note : "") }],
    output_config: { effort: "medium", format: { type: "json_schema", schema: LA.OUTPUT_SCHEMA } },
  };
  // Opus 5.5 · Sonnet 5.5: 안전 분류기가 거절하면 서버가 다른 모델로 이어서 처리 (Haiku 5.5 는 미지원)
  const res = m.fallbacks
    ? await c.beta.messages.create({ ...params, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" })
    : await c.messages.create(params);
  if (res.stop_reason === "refusal") throw new Error("모델이 요청을 거절했습니다" + (res.stop_details?.category ? ` (${res.stop_details.category})` : ""));
  if (res.stop_reason === "max_tokens") throw new Error("출력이 길이 한도에서 잘렸습니다");
  const out = JSON.parse(res.content.filter((b) => b.type === "text").map((b) => b.text).join(""));
  out.model = res.model;
  return out;
}

// 분석 → 근거 검증 → 실패 이유를 알려 1회 재시도 → 그래도 실패하면 규칙 기반으로 대체
async function analyzeWithClaude(c) {
  if (!S.apiKey) { openSettings(); $("#settings-err").textContent = "Claude 로 분석하려면 본인 API 키가 필요합니다. 키 없이도 예시 · 규칙 기반 원인 후보는 볼 수 있습니다."; return; }
  if (S.busy) return;
  S.busy = true;
  const btn = $("#gen");
  btn.disabled = true; btn.classList.add("loading");
  const r = ctx(c);
  r.log = [`[${new Date().toLocaleTimeString()}] ${S.model} · 근거 줄 ${r.pool.length}개 전송`];
  let note = "", done = false;
  try {
    const cl = await client();
    for (let attempt = 1; attempt <= 2 && !done; attempt++) {
      try {
        const out = await callClaude(cl, r, note);
        const bad = LA.validateCauses(out, r.pool, r.prompt);
        r.log.push(`시도${attempt}: ${bad.length ? bad.join("; ") : "통과"}${out.model !== S.model ? ` (응답 모델 ${out.model})` : ""}`);
        if (!bad.length) { r.out = out; r.how = "claude"; done = true; }
        else note = `이전 출력의 문제: ${bad.join("; ")}. 고쳐서 다시 쓴다.`;
      } catch (err) {
        r.log.push(`시도${attempt} 오류: ${errText(err)}`);
        if (sdk && err instanceof sdk.AuthenticationError) break;
      }
    }
  } catch (err) {
    r.log.push("오류: " + errText(err));
  }
  if (!done) { setRule(c, r, "fallback"); r.log.push("→ 규칙 기반 원인 후보로 대체"); }
  S.busy = false;
  if (cluster() === c) refreshCluster(); else renderClusters();
}

// ---------- 시작 ----------
loadSample();
