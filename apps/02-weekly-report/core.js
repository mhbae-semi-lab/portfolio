// 주간 보고 생성기 핵심 로직 (사내용 weekly_report.py 를 JS 로 옮긴 것)
// 브라우저에서는 window.WR, node 에서는 module.exports 로 쓴다.
(function (root) {
  "use strict";

  const STATUS_WORDS = ["완료", "확인", "적용", "검증", "해결"];
  const EFFECT_WORDS = ["효율", "향상", "강화", "증대", "정확도", "안정성", "최적화", "편의"];
  const GENERIC_TAGS = ["feat", "fix", "add", "update", "refactor", "기능", "수정", "추가"];
  const SKIP_SUBJ = /^(index on |On |WIP on |Merge )/;
  const DEFAULT_STATUS = "예정: 검증";

  // ---------- git log ----------
  // 형식: git log --no-merges --date=short --name-only --format="@@%h|%ad|%s"
  function parseGitLog(text) {
    const out = [];
    let cur = null;
    for (const raw of String(text).split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) continue;
      if (line.startsWith("@@")) {
        const [hash, date, ...rest] = line.slice(2).split("|");
        const subject = rest.join("|").trim();
        cur = null;
        if (!hash || !/^\d{4}-\d{2}-\d{2}$/.test((date || "").trim()) || SKIP_SUBJ.test(subject)) continue;
        cur = { hash: hash.trim(), date: date.trim(), subject, files: [] };
        out.push(cur);
      } else if (cur) {
        cur.files.push(line.replace(/\\/g, "/"));
      }
    }
    return out;
  }

  function isoWeek(dateStr) {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    const day = dt.getUTCDay() || 7;
    dt.setUTCDate(dt.getUTCDate() + 4 - day); // 그 주의 목요일
    const year = dt.getUTCFullYear();
    const week = Math.ceil(((dt - Date.UTC(year, 0, 1)) / 864e5 + 1) / 7);
    return { year, week, id: year + "-" + String(week).padStart(2, "0") };
  }

  function weekRange(year, week) {
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const mon = new Date(jan4);
    mon.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() || 7) - 1) + (week - 1) * 7);
    const sun = new Date(mon);
    sun.setUTCDate(mon.getUTCDate() + 6);
    const f = (x) => x.toISOString().slice(0, 10);
    return [f(mon), f(sun)];
  }

  function weeksOf(commits) {
    const m = new Map();
    for (const c of commits) {
      const w = isoWeek(c.date);
      const e = m.get(w.id) || { ...w, count: 0 };
      e.count++;
      m.set(w.id, e);
    }
    return [...m.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
  }

  // ---------- 주제 묶기 ----------
  function topicKey(subj) {
    let m = subj.match(/^\[([^\]]+)\]\s*:?\s*(.*)$/);
    if (m) {
      if (!GENERIC_TAGS.includes(m[1].toLowerCase())) return m[1].trim();
      subj = m[2] || subj;
    }
    // Conventional Commits 접두어 (fix: / feat(ui): …) 는 주제 이름에서 뺀다
    subj = subj.replace(/^(feat|fix|add|update|refactor|chore|docs|style|test|perf|build|ci)(\([^)]*\))?!?:\s*/i, "") || subj;
    m = subj.match(/^(.+?)\s+Phase\s*\d+/);
    if (m) return m[1].trim();
    return subj.split(/\s*(?:\(| - )/)[0].trim().slice(0, 40);
  }

  function areaOf(cfg, files) {
    const cnt = new Map();
    for (const f of files) {
      for (const r of cfg.rules) {
        if (r.match.some((p) => f.startsWith(p))) {
          const k = r.tag + "\u0000" + r.section;
          cnt.set(k, (cnt.get(k) || 0) + 1);
          break;
        }
      }
    }
    let best = null, n = 0;
    for (const [k, v] of cnt) if (v > n) { best = k; n = v; } // 동률이면 먼저 나온 영역
    if (!best) return { tag: cfg.fallback.tag, section: cfg.fallback.section };
    const [tag, section] = best.split("\u0000");
    return { tag, section };
  }

  function groupTopics(commits, cfg) {
    const groups = new Map();
    for (const c of commits) {
      const k = topicKey(c.subject);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(c);
    }
    return [...groups].map(([key, cms]) => {
      const files = cms.flatMap((c) => c.files);
      const { tag, section } = areaOf(cfg, files);
      return {
        key, tag, section, skip: false,
        why: "", what: cms.map((c) => c.subject).join("\n"), status: "",
        commits: cms, steps: [], title: "", lines: ["", "", ""], how: "",
      };
    });
  }

  function sectionGroups(items, order) {
    const secs = new Map();
    for (const it of items) {
      if (!secs.has(it.section)) secs.set(it.section, []);
      secs.get(it.section).push(it);
    }
    const idx = (s) => (order.includes(s) ? order.indexOf(s) : 99);
    return [...secs].sort((a, b) => b[1].length - a[1].length || idx(a[0]) - idx(b[0]));
  }

  // ---------- 요약 · 검증 ----------
  const statusOf = (t) => (t.status || "").trim() || DEFAULT_STATUS;
  const sourceOf = (t) => [t.key, t.why, t.what, statusOf(t)].join(" ");
  const nums = (s) => new Set(String(s).match(/\d+/g) || []);

  // 실패 항목 문자열 목록을 돌려준다 (빈 배열 = 통과)
  function validate(out, src) {
    const bad = [];
    const lines = out.lines || [];
    if (!Array.isArray(lines) || lines.length !== 3 || lines.some((l) => !String(l).trim())) return ["요약이 3줄이 아님"];
    const title = String(out.title || "").trim();
    if (!title) bad.push("제목 없음");
    else if (title.length > 40) bad.push("제목 40자 초과");
    else if (title.endsWith(".")) bad.push("제목 마침표");
    lines.forEach((l, i) => {
      l = String(l);
      if (l.length > 80) bad.push(`${i + 1}줄 80자 초과 (${l.length}자)`);
      if (l.trimEnd().endsWith(".")) bad.push(`${i + 1}줄 마침표`);
      if (l.includes("입력 필요")) bad.push(`${i + 1}줄 내용 비어 있음 (메모를 채우거나 직접 수정)`);
      const letters = l.match(/[A-Za-z가-힣]/g) || [];
      const ko = l.match(/[가-힣]/g) || [];
      if (letters.length && ko.length / letters.length < 0.15) bad.push(`${i + 1}줄 한글 부족`);
    });
    const full = title + " " + lines.join(" ");
    const srcNums = nums(src);
    const extra = [...nums(full)].filter((n) => !srcNums.has(n)).sort();
    if (extra.length) bad.push("입력에 없는 숫자 " + extra.join(", "));
    for (const w of STATUS_WORDS.concat(EFFECT_WORDS)) {
      if (full.includes(w) && !src.includes(w)) bad.push("근거 없는 단어 '" + w + "'");
    }
    return bad;
  }

  const cleanSubj = (s) => s.replace(/^\[[^\]]*\]\s*:?\s*/, "").slice(0, 78).replace(/[ .]+$/, "");

  // 모델 없이 입력만으로 만드는 규칙 기반 요약 (항상 검증을 통과하는 대신 문장이 거칠다)
  function ruleSummary(t) {
    const what = t.what.split("\n").map((x) => x.trim()).filter(Boolean);
    const l1 = cleanSubj(t.why || what[0] || t.key);
    let l2 = cleanSubj(what.length > 1 ? what.slice(1).map(cleanSubj).join(" · ") : what[0] || t.key);
    if (l2.length > 78) l2 = l2.slice(0, 77).replace(/\s*\S*$/, "") || l2.slice(0, 77);
    if (l2 === l1) l2 = "(세부 내용 입력 필요)";
    return { title: cleanSubj(t.key).slice(0, 25), lines: [l1, l2, cleanSubj(statusOf(t))] };
  }

  function defaultSteps(what) {
    const ls = what.split("\n").map((x) => x.replace(/^\[[^\]]*\]\s*:?\s*|^[①-⑩]\s*/, "").trim()).filter(Boolean);
    return ls.length >= 2 ? ls.slice(0, 6).map((x) => x.slice(0, 36)) : [];
  }

  // 상태 문자열에서 배지: 완료/해결 = 채움, 예정/확인 = 테두리
  function badges(status) {
    return [...String(status).matchAll(/(완료|해결|예정|확인)\s*:/g)].map((m) => ({
      word: m[1], filled: m[1] === "완료" || m[1] === "해결",
    }));
  }

  const SYSTEM = "주간업무보고 슬라이드 하나의 '제목 본문'과 '요약 3줄'을 쓴다. 입력에 적힌 사실만 쓴다.";
  function prompt(t, retryNote) {
    return [
      "규칙:",
      "- 제목 본문 25자 이내, 명사형 끝(개선/수정/추가/이식/개발/평가), 대괄호 태그와 마침표 없음",
      "- 요약 정확히 3줄. 1줄 무엇을 왜, 2줄 어떻게(구체 내용), 3줄 현재 상태",
      "- 한 줄 80자 이내, 라벨('목적:' 등) 없이 명사형으로, 마침표 없음, 구분은 ' · ', 흐름은 '→'",
      "- 입력에 없는 숫자·날짜·성능 수치·효과(효율/향상/강화/정확도)를 쓰지 않는다",
      "- 완료/확인/적용/검증/해결 같은 상태어는 입력 '상태'에 있을 때만, 그 의미 그대로 쓴다",
      "- 영어 기술 용어는 원문 그대로",
      "",
      "[입력]",
      "태그: " + t.tag,
      "주제: " + t.key,
      "왜: " + (t.why || "(없음)"),
      "무엇을:",
      t.what,
      "상태: " + statusOf(t),
      retryNote ? "\n" + retryNote : "",
    ].join("\n");
  }

  const OUTPUT_SCHEMA = {
    type: "object",
    properties: {
      title: { type: "string" },
      lines: { type: "array", items: { type: "string" } },
    },
    required: ["title", "lines"],
    additionalProperties: false,
  };

  // 슬라이드 배치 (인치, 13.333 x 7.5) — 미리보기와 PPT 가 같은 값을 쓴다
  const SLIDE = { w: 13.333, h: 7.5, left: 0.6, width: 12.13 };
  function contentLayout(t) {
    const L = {
      title: { x: SLIDE.left, y: 0.38, w: SLIDE.width, h: 0.62 },
      rule: { x: SLIDE.left, y: 1.06, w: SLIDE.width },
      body: { x: SLIDE.left, y: 1.25, w: SLIDE.width, h: 1.55 },
      badgeY: 2.95, badge: { w: 0.95, h: 0.34, gap: 0.12 },
      cards: [],
      foot: { x: SLIDE.left, y: 7.0, w: SLIDE.width, h: 0.3 },
    };
    const steps = (t.steps || []).filter(Boolean).slice(0, 6);
    if (steps.length >= 2) {
      const n = steps.length, gap = 0.42, y = 4.05, h = 1.7;
      const w = (SLIDE.width - gap * (n - 1)) / n;
      L.cards = steps.map((s, i) => ({ text: s, x: SLIDE.left + i * (w + gap), y, w, h, last: i === n - 1, gap }));
    }
    return L;
  }

  const api = {
    DEFAULT_STATUS, parseGitLog, isoWeek, weekRange, weeksOf, topicKey, areaOf, groupTopics,
    sectionGroups, statusOf, sourceOf, validate, ruleSummary, defaultSteps, badges,
    SYSTEM, prompt, OUTPUT_SCHEMA, SLIDE, contentLayout,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.WR = api;
})(typeof window !== "undefined" ? window : globalThis);
