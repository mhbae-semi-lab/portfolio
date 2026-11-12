// 포트폴리오 단일 페이지: projects.json → 해시 라우팅 (#/, #/apps, #/app/02, #/resume)
"use strict";

const STATUS = { live: "데모 공개", wip: "제작 중", planned: "예정" };
let DATA = null;

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const isTodo = (s) => typeof s === "string" && s.startsWith("TODO");
// 채워야 할 값(TODO…)은 점선 상자로 표시해 빠뜨리지 않게 한다
const t = (s) => (isTodo(s) ? `<span class="todo">${esc(s)}</span>` : esc(s));

// 로컬에서는 채울 칸(TODO)을 점선 상자로 보여주고, 공개 주소에서는 아예 빼서 미완성 칸이 보이지 않게 한다
const LOCAL = location.protocol === "file:" || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
function publicView(d) {
  if (isTodo(d.profile.summary)) d.profile.summary = "";
  d.profile.links = d.profile.links.filter((l) => !isTodo(l.href));
  d.cases = d.cases.filter((c) => !isTodo(c.title));
}

function badge(app) {
  return `<span class="badge st-${esc(app.status)}">${STATUS[app.status] || esc(app.status)}</span>`;
}

function links(app, cls = "") {
  const a = [];
  if (app.demo) a.push(`<a class="btn ${cls}" href="${esc(app.demo)}" target="_blank" rel="noopener">데모 열기</a>`);
  if (app.repo) a.push(`<a class="btn ghost ${cls}" href="${esc(app.repo)}" target="_blank" rel="noopener">소스</a>`);
  if (!a.length) a.push(`<span class="btn disabled ${cls}">데모 준비 중</span>`);
  return a.join("");
}

function linkList(items) {
  return items.map((l) => isTodo(l.href)
    ? `<span>${esc(l.label)} ${t(l.href)}</span>`
    : `<a href="${esc(l.href)}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join("");
}

function appCard(a) {
  return `
  <a class="card app-card" href="#/app/${esc(a.id)}">
    <div class="card-head"><span class="num">${esc(a.id)}</span><span class="tag">${esc(a.tag)}</span></div>
    <h3>${esc(a.name)}</h3>
    <p class="short">${esc(a.short)}</p>
    <div class="card-foot">${badge(a)}<span class="more">자세히 →</span></div>
  </a>`;
}

function caseBlock(c) {
  return `
  <article class="case">
    <div class="case-head"><h3>${t(c.title)}</h3><span class="period">${t(c.period)}</span></div>
    <dl class="rows">
      <dt>문제</dt><dd>${t(c.problem)}</dd>
      <dt>한 일</dt><dd>${t(c.action)}</dd>
      <dt>결과</dt><dd>${t(c.result)}</dd>
    </dl>
    ${c.tags?.length ? `<div class="chips">${c.tags.map((x) => `<span>${esc(x)}</span>`).join("")}</div>` : ""}
  </article>`;
}

function skills(p) {
  return `<div class="skills">${p.skills.map((g) =>
    `<div><h4>${esc(g.group)}</h4><div class="chips">${g.items.map((x) => `<span>${esc(x)}</span>`).join("")}</div></div>`
  ).join("")}</div>`;
}

// ---------- pages ----------
function home() {
  const p = DATA.profile;
  return `
  <section class="hero">
    <p class="eyebrow">${esc(p.role)}</p>
    <h1>${esc(p.name)}</h1>
    ${p.summary ? `<p class="lead">${t(p.summary)}</p>` : ""}
    <div class="hero-links">${linkList(p.links)}</div>
  </section>
  <section>
    <div class="sec-head"><h2>앱 5종</h2><a href="#/apps">전체 보기 →</a></div>
    <div class="grid">${DATA.apps.map(appCard).join("")}</div>
  </section>
  ${DATA.cases.length ? `<section>
    <div class="sec-head"><h2>실무 사례</h2></div>
    <p class="note">사내 코드 · 화면 · 데이터 없이 익명화한 서술만 싣습니다.</p>
    ${DATA.cases.map(caseBlock).join("")}
  </section>` : ""}
  <section>
    <div class="sec-head"><h2>기술</h2></div>
    ${skills(p)}
  </section>`;
}

function apps() {
  return `
  <section>
    <div class="sec-head"><h2>앱 5종</h2></div>
    <p class="note">AX 2종 + 반도체 도메인 데모 3종. 모두 서버 없는 웹이고 합성 · 공개 데이터만 사용합니다.</p>
    <div class="grid">${DATA.apps.map(appCard).join("")}</div>
  </section>`;
}

function app(id) {
  const a = DATA.apps.find((x) => x.id === id);
  if (!a) return notFound();
  const i = DATA.apps.indexOf(a);
  const prev = DATA.apps[i - 1], next = DATA.apps[i + 1];
  return `
  <a class="back" href="#/apps">← 앱 목록</a>
  <section class="app-head">
    <div class="title-row"><span class="num big">${esc(a.id)}</span><h1>${esc(a.name)}</h1></div>
    <div class="meta"><span class="tag">${esc(a.tag)}</span>${badge(a)}</div>
    <p class="pitch">${esc(a.pitch)}</p>
    <div class="actions">${links(a)}</div>
  </section>
  <dl class="rows summary">
    <dt>문제</dt><dd>${esc(a.problem)}</dd>
    <dt>만든 것</dt><dd>${esc(a.build)}</dd>
    <dt>결과물</dt><dd>${esc(a.result)}</dd>
  </dl>
  <section>
    <h2 class="h-small">동작 흐름</h2>
    <ol class="flow">${a.flow.map((f, k) =>
      `<li><span class="dot">${k + 1}</span><strong>${esc(f.t)}</strong><small>${esc(f.sub)}</small></li>`).join("")}</ol>
  </section>
  <section class="two">
    <div>
      <h2 class="h-small">핵심 기능</h2>
      <ol class="feats">${a.features.map((f) => `<li>${esc(f)}</li>`).join("")}</ol>
    </div>
    <div>
      <h2 class="h-small">스택</h2>
      <div class="chips">${a.stack.map((x) => `<span>${esc(x)}</span>`).join("")}</div>
      <h2 class="h-small">데이터</h2>
      <p>${esc(a.data)}</p>
    </div>
  </section>
  <nav class="pager">
    ${prev ? `<a href="#/app/${esc(prev.id)}">← ${esc(prev.id)} ${esc(prev.name)}</a>` : "<span></span>"}
    ${next ? `<a href="#/app/${esc(next.id)}">${esc(next.id)} ${esc(next.name)} →</a>` : "<span></span>"}
  </nav>`;
}

// 인쇄용: 한 페이지에 프로필 · 사례 · 앱 · 기술을 모아 브라우저 인쇄로 PDF 저장
function resume() {
  const p = DATA.profile;
  return `
  <div class="print-bar">
    <p>이 페이지를 그대로 PDF 로 저장합니다 (A4, 머리글 · 바닥글 끄기 권장).</p>
    <button class="btn" type="button" onclick="window.print()">PDF 로 저장</button>
  </div>
  <article class="resume">
    <header class="r-head">
      <div><h1>${esc(p.name)}</h1><p class="eyebrow">${esc(p.role)}</p></div>
      <div class="r-links">${linkList(p.links)}</div>
    </header>
    ${p.summary ? `<p class="lead">${t(p.summary)}</p>` : ""}
    ${DATA.cases.length ? `<h2>실무 사례</h2>${DATA.cases.map(caseBlock).join("")}` : ""}
    <h2>앱 5종</h2>
    <div class="r-apps">${DATA.apps.map((a) => `
      <div class="r-app">
        <div class="r-app-head"><span class="num">${esc(a.id)}</span><strong>${esc(a.name)}</strong>${badge(a)}</div>
        <p>${esc(a.problem)} → ${esc(a.build)}</p>
        <p class="r-stack">${a.stack.map(esc).join(" · ")}${a.demo ? ` · <a href="${esc(a.demo)}">${esc(new URL(a.demo, location.href.split("#")[0]).href)}</a>` : ""}</p>
      </div>`).join("")}</div>
    <h2>기술</h2>
    ${skills(p)}
  </article>`;
}

function notFound() {
  return `<section class="hero"><h1>페이지를 찾을 수 없습니다</h1><p><a href="#/">홈으로</a></p></section>`;
}

const ROUTES = { "": home, apps, app, resume };

function route() {
  const [page = "", arg] = location.hash.replace(/^#\/?/, "").split("/");
  const fn = ROUTES[page] || notFound;
  $("#main").innerHTML = fn(arg);
  document.querySelectorAll("[data-nav]").forEach((el) => {
    const n = el.dataset.nav;
    el.classList.toggle("on", n === (page || "home") || (n === "apps" && page === "app"));
  });
  const a = page === "app" && DATA.apps.find((x) => x.id === arg);
  document.title = a ? `${a.name} · ${DATA.profile.name}` :
    page === "resume" ? `${DATA.profile.name} · 이력서` : `${DATA.profile.name} · 포트폴리오`;
  window.scrollTo(0, 0);
}

async function init() {
  try {
    const r = await fetch("projects.json", { cache: "no-cache" });
    if (!r.ok) throw new Error(r.status);
    DATA = await r.json();
    if (!LOCAL) publicView(DATA);
  } catch (e) {
    $("#main").innerHTML = `<p class="loading">projects.json 을 불러오지 못했습니다 (${esc(e.message)}). 로컬에서는 웹 서버로 열어 주세요.</p>`;
    return;
  }
  window.addEventListener("hashchange", route);
  route();
}

init();
