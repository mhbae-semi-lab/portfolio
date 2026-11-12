// 화면 · Claude 호출 · PPT 내보내기
"use strict";

const W = window.WR, SAMPLE = window.WR_SAMPLE;
const SDK_URL = "https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@1.3.0/+esm";
const PPTX_URL = "https://cdnjs.cloudflare.com/ajax/libs/pptxgenjs/3.12.0/pptxgen.bundle.js";
const MODELS = [
  { id: "claude-opus-5-5", label: "Claude Opus 5.5 (기본)", fallbacks: true },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5", fallbacks: true },
  { id: "claude-haiku-5-5", label: "Claude Haiku 5.5 (빠르고 저렴)", fallbacks: false },
];
const HOW = { example: "미리 생성한 예시", rule: "규칙 기반", claude: "Claude 생성", edited: "직접 수정", fallback: "규칙 기반 (검증 실패 대체)" };

const S = {
  source: "sample", commits: [], weeks: [], week: null, topics: [], sel: 0,
  cfg: structuredClone(SAMPLE.CONFIG), apiKey: "", model: MODELS[0].id, busy: false,
};

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const cur = () => S.topics[S.sel];
const check = (t) => W.validate({ title: t.title, lines: t.lines }, W.sourceOf(t));
const weekInfo = () => S.weeks.find((w) => w.id === S.week);

// ---------- 데이터 흐름 ----------
function loadCommits(commits, source) {
  S.commits = commits;
  S.source = source;
  S.weeks = W.weeksOf(commits);
  selectWeek(S.weeks.length ? S.weeks[S.weeks.length - 1].id : null);
}

function selectWeek(id) {
  S.week = id;
  const wc = S.commits.filter((c) => W.isoWeek(c.date).id === id);
  S.topics = W.groupTopics(wc, S.cfg).map((t) => prep(t, id));
  S.sel = 0;
  renderAll();
}

function prep(t, wid) {
  const m = S.source === "sample" && SAMPLE.MEMOS[wid + "|" + t.key];
  if (m) {
    Object.assign(t, { why: m.why, status: m.status, title: m.title, lines: [...m.lines], steps: [...m.steps], how: "example" });
    t.example = m;
  } else {
    applyRule(t);
    t.steps = W.defaultSteps(t.what);
  }
  t.log = [];
  return t;
}

function applyRule(t, how = "rule") {
  const r = W.ruleSummary(t);
  t.title = r.title;
  t.lines = r.lines;
  t.how = how;
}

// ---------- 렌더링 ----------
function renderAll() {
  renderSource();
  renderTopics();
  renderEditor();
  renderExport();
}

function renderSource() {
  $("#weeks").innerHTML = S.weeks.map((w) => {
    const [a, b] = W.weekRange(w.year, w.week);
    return `<button type="button" class="chip-btn ${w.id === S.week ? "on" : ""}" data-week="${esc(w.id)}">
      ${w.week}주차 <small>${a.slice(5).replace("-", "/")}~${b.slice(5).replace("-", "/")} · 커밋 ${w.count}</small></button>`;
  }).join("") || `<span class="hint">불러온 커밋이 없습니다.</span>`;
  const w = weekInfo();
  $("#stats").textContent = w ? `${w.year}년 ${w.week}주차 · 커밋 ${w.count}개 → 주제 ${S.topics.length}개` : "";
}

function topicState(t) {
  if (t.skip) return { cls: "skip", text: "제외" };
  const bad = check(t);
  return bad.length ? { cls: "bad", text: "검증 " + bad.length } : { cls: "ok", text: "통과" };
}

function renderTopics() {
  $("#topic-list").innerHTML = S.topics.map((t, i) => {
    const st = topicState(t);
    return `<li><button type="button" class="topic ${i === S.sel ? "on" : ""} ${t.skip ? "is-skip" : ""}" data-topic="${i}">
      <span class="t-tag">${esc(t.tag)}</span>
      <span class="t-key">${esc(t.key)}</span>
      <span class="t-meta">커밋 ${t.commits.length} · ${esc(HOW[t.how] || "")}</span>
      <span class="state ${st.cls}">${st.text}</span>
    </button></li>`;
  }).join("") || `<li class="hint">이 주차에는 주제가 없습니다.</li>`;
}

function renderEditor() {
  const t = cur();
  const ed = $("#editor");
  if (!t) { ed.innerHTML = `<p class="hint">왼쪽에서 주제를 고르세요.</p>`; return; }
  ed.innerHTML = `
    <div class="panel-head">
      <h2><span class="t-tag">${esc(t.tag)}</span> ${esc(t.key)}</h2>
      <label class="check"><input type="checkbox" data-f="skip" ${t.skip ? "checked" : ""}> 보고서에서 제외</label>
    </div>

    <details class="commits">
      <summary>커밋 ${t.commits.length}개</summary>
      <ul>${t.commits.map((c) => `<li><code>${esc(c.hash)}</code> ${esc(c.date)} ${esc(c.subject)}
        <small>${c.files.map(esc).join(" · ")}</small></li>`).join("")}</ul>
    </details>

    <div class="grid2">
      <div>
        <h3>메모 <small>요약의 근거 — 여기에 없는 숫자 · 상태어는 요약에 쓸 수 없습니다</small></h3>
        <label class="field">왜 <input data-f="why" value="${esc(t.why)}" placeholder="이 작업을 한 이유"></label>
        <label class="field">무엇을 <textarea data-f="what" rows="3">${esc(t.what)}</textarea></label>
        <label class="field">상태 <input data-f="status" value="${esc(t.status)}" placeholder="${esc(W.DEFAULT_STATUS)}">
          <small>"완료: …" "예정: …" "확인: …" 형식이 배지가 됩니다. 비우면 "${esc(W.DEFAULT_STATUS)}"</small></label>
        <label class="field">흐름도 카드 <textarea data-f="steps" rows="3" placeholder="한 줄에 하나, 2~6개">${esc((t.steps || []).join("\n"))}</textarea></label>
      </div>
      <div>
        <h3>요약 <small id="how">${esc(HOW[t.how] || "")}</small></h3>
        <div class="gen-row">
          <button class="btn sm" type="button" id="gen-one">Claude 로 생성</button>
          <button class="btn ghost sm" type="button" id="rule-one">규칙 기반</button>
          ${t.example ? `<button class="btn ghost sm" type="button" id="example-one">예시로 되돌리기</button>` : ""}
        </div>
        <label class="field">제목 <span class="count" id="c-title"></span>
          <input data-f="title" value="${esc(t.title)}"></label>
        ${t.lines.map((l, i) => `<label class="field">${i + 1}줄 <span class="count" id="c-l${i}"></span>
          <input data-f="line" data-i="${i}" value="${esc(l)}"></label>`).join("")}
        <div id="checks" class="checks"></div>
        <pre id="gen-log" class="log" ${t.log.length ? "" : "hidden"}>${esc(t.log.join("\n"))}</pre>
      </div>
    </div>

    <h3>슬라이드 미리보기</h3>
    <div id="preview" class="slide"></div>`;
  refreshLive();
}

// 입력 중에는 편집기 전체를 다시 그리지 않고 결과 부분만 갱신한다
function refreshLive() {
  const t = cur();
  if (t) {
    $("#c-title").textContent = `${t.title.length}/25`;
    $("#c-title").classList.toggle("over", t.title.length > 25);
    t.lines.forEach((l, i) => {
      const c = $("#c-l" + i);
      c.textContent = `${l.length}/80`;
      c.classList.toggle("over", l.length > 80);
    });
    const bad = check(t);
    $("#checks").innerHTML = bad.length
      ? `<p class="state bad">검증 실패</p><ul>${bad.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>`
      : `<p class="state ok">검증 통과</p><small>3줄 · 줄당 80자 · 마침표 없음 · 한글 비율 · 입력에 없는 숫자 · 상태어 · 효과어</small>`;
    $("#how").textContent = HOW[t.how] || "";
    renderSlidePreview(t, $("#preview"));
  }
  renderTopics();
  renderExport();
}

// ---------- 슬라이드 미리보기 (PPT 와 같은 배치값) ----------
const px = (v, axis) => (v / (axis === "x" ? W.SLIDE.w : W.SLIDE.h) * 100).toFixed(3) + "%";
const pt = (n) => (n / 72 / W.SLIDE.w * 100).toFixed(3) + "cqw";
const box = (b) => `left:${px(b.x, "x")};top:${px(b.y, "y")};width:${px(b.w, "x")};${b.h ? `height:${px(b.h, "y")};` : ""}`;

function renderSlidePreview(t, el) {
  const L = W.contentLayout(t);
  const bs = W.badges(W.statusOf(t));
  const w = weekInfo();
  el.innerHTML = `
    <div class="s-title" style="${box(L.title)}font-size:${pt(22)}">${esc(t.tag)} ${esc(t.title)}</div>
    <div class="s-rule" style="${box(L.rule)}"></div>
    <ul class="s-body" style="${box(L.body)}font-size:${pt(14)}">${t.lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>
    ${bs.map((b, i) => `<span class="s-badge ${b.filled ? "fill" : ""}" style="${box({ x: W.SLIDE.left + i * (L.badge.w + L.badge.gap), y: L.badgeY, w: L.badge.w, h: L.badge.h })}font-size:${pt(12)}">${b.word}</span>`).join("")}
    ${L.cards.map((c, i) => `
      <div class="s-card" style="${box(c)}font-size:${pt(c.w < 2.2 ? 11 : 13)}">${esc(c.text)}</div>
      <span class="s-num" style="${box({ x: c.x + c.w / 2 - 0.22, y: c.y - 0.22, w: 0.44, h: 0.44 })}font-size:${pt(12)}">${i + 1}</span>
      ${c.last ? "" : `<span class="s-arrow" style="${box({ x: c.x + c.w + 0.08, y: c.y + c.h / 2 - 0.17, w: c.gap - 0.16, h: 0.34 })}"></span>`}`).join("")}
    <div class="s-foot" style="${box(L.foot)}font-size:${pt(9)}">${esc(S.source === "sample" ? S.cfg.project : "주간 보고")} · ${w ? `${w.year}년 ${w.week}주차` : ""}</div>
    ${t.skip ? `<div class="s-skip">보고서에서 제외됨</div>` : ""}`;
}

function renderExport() {
  const live = S.topics.filter((t) => !t.skip);
  const bad = live.filter((t) => check(t).length);
  const secs = W.sectionGroups(live, S.cfg.order);
  $("#export-stats").innerHTML = live.length
    ? `슬라이드 ${2 + secs.length + live.length}장 (표지 · 구역 ${secs.length} · 내용 ${live.length} · 끝) · 검증 통과 ${live.length - bad.length}/${live.length}` +
      (bad.length ? ` · <b class="warn">실패 ${bad.length}</b>` : "")
    : "내보낼 주제가 없습니다.";
  $("#export").disabled = !live.length || S.busy;
  $("#gen-all").disabled = !live.length || S.busy;
}

// ---------- 편집 이벤트 ----------
document.addEventListener("input", (e) => {
  const f = e.target.dataset?.f;
  const t = cur();
  if (!f || !t) return;
  const v = e.target.value;
  if (f === "title") { t.title = v; t.how = "edited"; }
  else if (f === "line") { t.lines[+e.target.dataset.i] = v; t.how = "edited"; }
  else if (f === "steps") t.steps = v.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 6);
  else if (f === "skip") t.skip = e.target.checked;
  else t[f] = v; // why / what / status
  refreshLive();
});

document.addEventListener("click", async (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.week) return selectWeek(b.dataset.week);
  if (b.dataset.topic) { S.sel = +b.dataset.topic; renderTopics(); renderEditor(); return; }
  if (b.dataset.src) {
    const paste = b.dataset.src === "paste";
    $("#paste-box").hidden = !paste;
    document.querySelectorAll("[data-src]").forEach((x) => x.classList.toggle("on", x === b));
    if (!paste && S.source !== "sample") { S.cfg = structuredClone(SAMPLE.CONFIG); $("#author").value = S.cfg.author; loadCommits(W.parseGitLog(SAMPLE.LOG), "sample"); }
    return;
  }
  switch (b.id) {
    case "rule-one": applyRule(cur()); cur().log = []; return renderEditor();
    case "example-one": { const t = cur(); Object.assign(t, { title: t.example.title, lines: [...t.example.lines], steps: [...t.example.steps], how: "example", log: [] }); return renderEditor(); }
    case "gen-one": return generateTopics([cur()]);
    case "gen-all": return generateTopics(S.topics.filter((t) => !t.skip));
    case "paste-load": return loadPaste();
    case "export": return exportPptx();
    case "open-settings": return openSettings();
  }
});

function loadPaste() {
  const commits = W.parseGitLog($("#paste-text").value);
  if (!commits.length) {
    $("#stats").textContent = "읽은 커밋이 없습니다. '@@해시|날짜|제목' 형식인지 확인하세요.";
    return;
  }
  loadCommits(commits, "paste");
}

// ---------- 설정 ----------
function openSettings() {
  $("#api-key").value = S.apiKey;
  $("#model").innerHTML = MODELS.map((m) => `<option value="${m.id}" ${m.id === S.model ? "selected" : ""}>${esc(m.label)}</option>`).join("");
  $("#rules").value = JSON.stringify({ rules: S.cfg.rules, fallback: S.cfg.fallback, order: S.cfg.order }, null, 2);
  $("#settings-err").textContent = "";
  $("#settings").showModal();
}

$("#settings-save").addEventListener("click", (e) => {
  let r;
  try {
    r = JSON.parse($("#rules").value);
    if (!Array.isArray(r.rules) || !r.fallback?.tag || !r.fallback?.section) throw new Error("rules 배열과 fallback.tag / fallback.section 이 필요합니다");
    r.rules.forEach((x) => { if (!Array.isArray(x.match) || !x.tag || !x.section) throw new Error("각 규칙에 match 배열 · tag · section 이 필요합니다"); });
  } catch (err) {
    e.preventDefault();
    $("#settings-err").textContent = "영역 규칙 오류: " + err.message;
    return;
  }
  S.apiKey = $("#api-key").value.trim();
  S.model = $("#model").value;
  const changed = JSON.stringify(r) !== JSON.stringify({ rules: S.cfg.rules, fallback: S.cfg.fallback, order: S.cfg.order });
  Object.assign(S.cfg, { rules: r.rules, fallback: r.fallback, order: r.order || [] });
  if (changed && S.week) selectWeek(S.week);
});

// ---------- Claude ----------
let sdk = null;
async function client() {
  if (!sdk) sdk = (await import(SDK_URL)).default;
  // 방문자 본인의 키를 브라우저에서 직접 쓴다 — 키는 메모리에만 있고 이 사이트 서버는 없다
  return new sdk({ apiKey: S.apiKey, dangerouslyAllowBrowser: true });
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

async function callClaude(c, t, note) {
  const m = MODELS.find((x) => x.id === S.model) || MODELS[0];
  const params = {
    model: m.id,
    max_tokens: 8000,
    system: W.SYSTEM,
    messages: [{ role: "user", content: W.prompt(t, note) }],
    output_config: { effort: "low", format: { type: "json_schema", schema: W.OUTPUT_SCHEMA } },
  };
  // Opus 5.5 · Sonnet 5.5: 안전 분류기가 거절하면 서버가 다른 모델로 이어서 처리 (Haiku 5.5 는 미지원)
  const res = m.fallbacks
    ? await c.beta.messages.create({ ...params, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" })
    : await c.messages.create(params);
  if (res.stop_reason === "refusal") throw new Error("모델이 요청을 거절했습니다" + (res.stop_details?.category ? ` (${res.stop_details.category})` : ""));
  if (res.stop_reason === "max_tokens") throw new Error("출력이 길이 한도에서 잘렸습니다");
  const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  const out = JSON.parse(text);
  return {
    title: String(out.title || "").replace(/^(\[[^\]]*\]\s*)+/, "").trim(),
    lines: (out.lines || []).map((s) => String(s).trim()),
    model: res.model,
  };
}

// 생성 → 검증 → 실패하면 이유를 알려 1회 재시도 → 그래도 실패하면 규칙 기반으로 대체 (사내 CLI 와 같은 흐름)
async function generateTopics(list) {
  if (!S.apiKey) { openSettings(); $("#settings-err").textContent = "Claude 로 생성하려면 본인 API 키가 필요합니다. 키 없이도 예시 · 규칙 기반 요약은 쓸 수 있습니다."; return; }
  S.busy = true;
  renderExport();
  setBusyButtons(true);
  try {
    const c = await client();
    for (const t of list) {
      t.log = [`[${new Date().toLocaleTimeString()}] ${S.model}`];
      let note = "", done = false;
      for (let attempt = 1; attempt <= 2 && !done; attempt++) {
        try {
          const out = await callClaude(c, t, note);
          const bad = W.validate(out, W.sourceOf(t));
          t.log.push(`시도${attempt}: ${bad.length ? bad.join("; ") : "통과"}${out.model !== S.model ? ` (응답 모델 ${out.model})` : ""}`);
          t.log.push(`  ${out.title}`, ...out.lines.map((l) => "  - " + l));
          if (!bad.length) { Object.assign(t, { title: out.title, lines: out.lines, how: "claude" }); done = true; }
          else note = `이전 출력의 문제: ${bad.join("; ")}. 고쳐서 다시 쓴다.`;
        } catch (err) {
          t.log.push(`시도${attempt} 오류: ${errText(err)}`);
          if (sdk && err instanceof sdk.AuthenticationError) { refreshAfterGen(t); throw err; } // 키 오류면 나머지 주제도 멈춘다
        }
      }
      if (!done) { applyRule(t, "fallback"); t.log.push("→ 규칙 기반 문장으로 대체 (직접 다듬어 주세요)"); }
      refreshAfterGen(t);
    }
  } catch (err) {
    $("#export-msg").textContent = errText(err);
  } finally {
    S.busy = false;
    setBusyButtons(false);
    renderExport();
  }
}

function refreshAfterGen(t) {
  if (t === cur()) renderEditor(); else renderTopics();
}

function setBusyButtons(on) {
  for (const id of ["gen-one", "gen-all"]) {
    const b = document.getElementById(id);
    if (b) { b.disabled = on; b.classList.toggle("loading", on); }
  }
}

// ---------- PPT ----------
function loadScript(src) {
  return new Promise((ok, fail) => {
    const s = document.createElement("script");
    s.src = src; s.onload = ok; s.onerror = () => fail(new Error("스크립트를 불러오지 못했습니다: " + src));
    document.head.appendChild(s);
  });
}

async function exportPptx() {
  const live = S.topics.filter((t) => !t.skip);
  const bad = live.filter((t) => check(t).length);
  if (bad.length && !confirm(`검증에 실패한 주제가 ${bad.length}개 있습니다. 그대로 내보낼까요?`)) return;
  $("#export-msg").textContent = "PPT 만드는 중…";
  try {
    if (!window.PptxGenJS) await loadScript(PPTX_URL);
    const w = weekInfo();
    const project = S.source === "sample" ? S.cfg.project : "주간 보고";
    const author = $("#author").value.trim() || "작성자";
    const pptx = window.WR_DECK.build(window.PptxGenJS, { topics: live, year: w.year, week: w.week, project, author, order: S.cfg.order });
    const file = `${w.year}년_${w.week}주차_업무보고.pptx`;
    await pptx.writeFile({ fileName: file });
    $("#export-msg").textContent = `${file} 저장됨 (${live.length}개 주제)`;
  } catch (err) {
    $("#export-msg").textContent = "내보내기 실패: " + err.message;
  }
}

// ---------- 시작 ----------
$("#author").value = S.cfg.author;
loadCommits(W.parseGitLog(SAMPLE.LOG), "sample");
