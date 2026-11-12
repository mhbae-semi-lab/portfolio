// 로그 분석: 파싱 → 알람 발생 묶음(에피소드) → 같은 첫 알람끼리 군집 → 직전 경고 통계 → 원인 후보
// 브라우저: window.LA, node: module.exports
(function (root) {
  "use strict";

  const SEV = { TRACE: 0, DEBUG: 0, INFO: 1, NOTICE: 1, WARN: 2, WARNING: 2, ERROR: 3, ALARM: 3, FATAL: 3, CRITICAL: 3 };
  const LINE_RE = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:[.,](\d{1,6}))?\s+\[?([A-Za-z]+)\]?\s+(?:\[([^\]]+)\]\s*)?(.*)$/;
  const CODE_RE = /\b([A-Z]{1,3}-?\d{2,5})\b/;
  const CONF = ["높음", "중간", "낮음"];

  // 숫자를 # 로 바꿔 같은 종류의 메시지를 한 묶음으로 본다
  const template = (msg) => msg.replace(/[-+]?\d+(?:\.\d+)?/g, "#").replace(/\s+/g, " ").trim();

  function parseLog(text) {
    const entries = [], bad = [];
    const lines = String(text).split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      if (!raw.trim()) continue;
      const m = raw.match(LINE_RE);
      const lv = m && m[8].toUpperCase();
      if (!m || !(lv in SEV)) { if (bad.length < 50) bad.push(i + 1); else bad.push(null); continue; }
      const ms = m[7] ? Number((m[7] + "000").slice(0, 3)) : 0;
      const t = Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6], ms);
      const sev = SEV[lv];
      const msg = m[10].trim();
      const e = { n: i + 1, t, level: lv === "WARNING" ? "WARN" : lv, sev, module: (m[9] || "-").trim(), msg, raw };
      e.tpl = template(msg);
      if (sev === 3) {
        const c = msg.match(CODE_RE);
        e.code = c ? c[1] : e.tpl.slice(0, 40);
        e.name = c ? msg.replace(c[0], "").replace(/\(.*\)\s*$/, "").trim() : e.tpl;
      }
      entries.push(e);
    }
    entries.sort((a, b) => a.t - b.t || a.n - b.n);
    return { entries, badCount: bad.length, badLines: bad.filter(Boolean) };
  }

  function stats(entries) {
    const levels = {}, modules = {};
    for (const e of entries) {
      levels[e.level] = (levels[e.level] || 0) + 1;
      modules[e.module] = (modules[e.module] || 0) + 1;
    }
    return { levels, modules, t0: entries.length ? entries[0].t : 0, t1: entries.length ? entries[entries.length - 1].t : 0 };
  }

  // 알람 사이 간격이 gap 보다 짧으면 한 발생(에피소드)으로 묶는다
  function episodes(entries, gap = 120e3) {
    const out = [];
    let cur = null;
    for (const e of entries) {
      if (e.sev < 3) continue;
      if (!cur || e.t - cur.t1 > gap) { cur = { alarms: [], t0: e.t, t1: e.t }; out.push(cur); }
      cur.alarms.push(e);
      cur.t1 = e.t;
    }
    for (const ep of out) {
      ep.trigger = ep.alarms[0];
      const seen = [];
      for (const a of ep.alarms) if (!seen.includes(a.code)) seen.push(a.code);
      ep.codes = seen;
      ep.signature = seen.join(" → ");
    }
    return out;
  }

  // 첫 알람 코드가 같은 발생끼리 = 같은 원인으로 의심되는 군집
  function clusters(eps) {
    const m = new Map();
    for (const ep of eps) {
      const k = ep.trigger.code;
      if (!m.has(k)) m.set(k, { code: k, name: ep.trigger.name, module: ep.trigger.module, episodes: [], signatures: new Map() });
      const c = m.get(k);
      c.episodes.push(ep);
      c.signatures.set(ep.signature, (c.signatures.get(ep.signature) || 0) + 1);
    }
    // 후속 알람이 따라붙는 군집(연쇄)을 먼저, 그 안에서는 많이 난 순서
    const chained = (c) => (c.episodes.some((ep) => ep.codes.length > 1) ? 1 : 0);
    return [...m.values()].sort((a, b) => chained(b) - chained(a) || b.episodes.length - a.episodes.length || a.episodes[0].t0 - b.episodes[0].t0);
  }

  // 직전 경고 통계: 각 발생의 첫 알람 앞 lookback 안에 나온 경고 종류별로
  //   coverage = 몇 번의 발생 앞에 나왔나, spec = 그 경고 전체 중 알람 직전에 몰린 비율
  function precursors(entries, cluster, lookback = 10 * 60e3) {
    const warns = entries.filter((e) => e.sev === 2);
    const total = new Map();
    for (const w of warns) { const k = w.module + "\u0000" + w.tpl; total.set(k, (total.get(k) || 0) + 1); }
    const E = cluster.episodes.length;
    const res = new Map();
    const inAny = new Set();
    cluster.episodes.forEach((ep, i) => {
      const lo = ep.t0 - lookback;
      for (const w of warns) {
        if (w.t < lo || w.t >= ep.t0) continue;
        const k = w.module + "\u0000" + w.tpl;
        if (!res.has(k)) res.set(k, { module: w.module, tpl: w.tpl, eps: new Set(), lines: [], last: new Map() });
        const r = res.get(k);
        r.eps.add(i);
        r.last.set(i, w.n);
        if (!inAny.has(w.n)) { inAny.add(w.n); r.lines.push(w.n); }
      }
    });
    return [...res.values()].map((r) => {
      const all = total.get(r.module + "\u0000" + r.tpl);
      const coverage = r.eps.size;
      const spec = r.lines.length / all;
      return { module: r.module, tpl: r.tpl, coverage, of: E, inWin: r.lines.length, total: all, spec,
        score: (coverage / E) * spec, evidence: [...r.last.values()] };
    }).sort((a, b) => b.score - a.score || b.coverage - a.coverage);
  }

  const pct = (x) => Math.round(x * 100);

  // 모델 없이 통계만으로 고른 원인 후보
  function ruleCauses(cluster, pre) {
    const E = cluster.episodes.length;
    const out = [];
    for (const p of pre) {
      if (out.length >= 2) break;
      if (p.coverage / E < 0.5 || p.spec < 0.2) continue;
      out.push({
        cause: `[${p.module}] '${p.tpl}' 경고가 첫 알람 직전에 반복됨`,
        reasoning: `${E}번 발생 중 ${p.coverage}번 앞에 나타났고, 이 경고 ${p.total}건 중 ${p.inWin}건(${pct(p.spec)}%)이 알람 직전에 몰려 있음`,
        evidence: p.evidence.slice(0, 4),
        confidence: p.score >= 0.5 ? "높음" : p.score >= 0.25 ? "중간" : "낮음",
      });
    }
    const withFollow = cluster.episodes.filter((ep) => ep.codes.length > 1);
    const follow = withFollow.flatMap((ep) => ep.alarms.filter((a) => a.code !== cluster.code));
    if (follow.length) {
      const codes = [...new Set(follow.map((a) => a.code))];
      const k = withFollow.length;
      out.push({
        cause: `${codes.join(" · ")} 는 ${cluster.code} 뒤에 따라오는 2차 알람으로 보임`,
        reasoning: `${E}번 발생 중 ${k}번 ${cluster.code} 다음에 같은 발생 안에서 뒤따름 — 따로 원인을 찾기보다 ${cluster.code} 의 원인을 먼저 확인`,
        evidence: withFollow.slice(0, 3).map((ep) => ep.alarms.find((a) => a.code !== cluster.code).n),
        confidence: k === E ? "중간" : "낮음",
      });
    }
    if (!out.length || (out.length === 1 && follow.length)) {
      out.unshift({
        cause: "알람 직전에 반복되는 경고가 없음 — 단발성이거나 로그에 남지 않는 원인",
        reasoning: `${E}번 발생 앞 구간에서 공통된 경고를 찾지 못함`,
        evidence: cluster.episodes.slice(0, 3).map((ep) => ep.trigger.n),
        confidence: "낮음",
      });
    }
    return { causes: out.slice(0, 3), checks: [] };
  }

  // Claude 에 보낼 근거 줄: 각 발생 앞뒤의 경고 · 알람 + 첫 알람 모듈의 주변 정보 줄
  function evidencePool(entries, cluster, lookback = 10 * 60e3, cap = 80) {
    const pick = new Map();
    const eps = cluster.episodes.slice(0, 6);
    for (const ep of eps) {
      for (const e of entries) {
        if (e.t < ep.t0 - lookback || e.t > ep.t1 + 150e3) continue;
        const near = e.t >= ep.t0 - 60e3 && e.t <= ep.t1 + 150e3;
        let pri = -1;
        if (e.sev === 3 && e.t >= ep.t0 && e.t <= ep.t1) pri = 3;
        else if (e.sev >= 2 && e.t <= ep.t1 + 30e3) pri = 2;
        else if (near && e.sev === 1 && e.module === ep.trigger.module) pri = 1;
        if (pri < 0) continue;
        const dist = Math.abs(e.t - ep.t0);
        const old = pick.get(e.n);
        if (!old || old.pri < pri) pick.set(e.n, { e, pri, dist });
      }
    }
    let list = [...pick.values()];
    if (list.length > cap) list = list.sort((a, b) => b.pri - a.pri || a.dist - b.dist).slice(0, cap);
    return list.map((x) => x.e).sort((a, b) => a.n - b.n);
  }

  // 미리 만든 원인 후보는 줄 번호 대신 문구 패턴을 들고 있어, 근거 줄에서 찾아 번호로 바꾼다
  function resolvePatterns(pool, patterns, perPattern = 3) {
    const out = [];
    for (const p of patterns) {
      const picked = [];
      for (const e of pool) {
        if (!(e.msg.includes(p) || e.code === p)) continue;
        if (picked.some((t) => Math.abs(t - e.t) < 15 * 60e3)) continue; // 15분 안에 이미 고른 줄이 있으면 건너뜀 → 발생마다 고루
        picked.push(e.t);
        out.push(e.n);
        if (picked.length >= perPattern) break;
      }
    }
    return [...new Set(out)];
  }

  const fmtTime = (t) => new Date(t).toISOString().slice(11, 19);

  function promptFor(cluster, pre, pool) {
    const eps = cluster.episodes;
    return [
      "다음은 설비 로그에서 같은 첫 알람으로 시작한 알람 발생들이다. 원인 후보를 고른다.",
      "",
      `[알람] ${cluster.code} ${cluster.name} (모듈 ${cluster.module}) — ${eps.length}회 발생`,
      "발생 시각: " + eps.map((ep) => fmtTime(ep.t0)).join(", "),
      "알람 연쇄: " + [...cluster.signatures].map(([s, n]) => `${s} (${n}회)`).join(" / "),
      "",
      "[첫 알람 직전 경고 통계] (coverage = 발생 중 몇 번 앞에 나왔나, 집중도 = 그 경고 전체 중 알람 직전 비율)",
      ...(pre.length ? pre.slice(0, 6).map((p) => `- [${p.module}] ${p.tpl} : coverage ${p.coverage}/${p.of}, 집중도 ${pct(p.spec)}% (${p.inWin}/${p.total})`) : ["- 없음"]),
      "",
      "[근거 줄] (줄번호: 원문)",
      ...pool.map((e) => `${e.n}: ${e.raw}`),
      "",
      "규칙:",
      "- 원인 후보 1~3개, 가능성이 높은 순서",
      "- 각 후보의 evidence 에는 위 [근거 줄] 목록에 있는 줄번호만 1~5개",
      "- 로그에 없는 부품명 · 수치를 지어내지 않는다. 수치는 근거 줄에 있는 것만 쓴다",
      "- confidence 는 높음 / 중간 / 낮음 중 하나",
      "- cause 는 한 문장 80자 이내, reasoning 은 근거 줄과 통계로 설명 (120자 이내)",
      "- checks 에는 현장에서 확인할 항목 2~3개",
    ].join("\n");
  }

  const SYSTEM = "설비 로그의 알람 군집을 보고 원인 후보를 고르는 엔지니어 보조. 제공된 줄과 통계만 근거로 쓴다. 한국어로 쓴다.";
  const OUTPUT_SCHEMA = {
    type: "object",
    properties: {
      causes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            cause: { type: "string" },
            reasoning: { type: "string" },
            evidence: { type: "array", items: { type: "integer" } },
            confidence: { type: "string", enum: CONF },
          },
          required: ["cause", "reasoning", "evidence", "confidence"],
          additionalProperties: false,
        },
      },
      checks: { type: "array", items: { type: "string" } },
    },
    required: ["causes", "checks"],
    additionalProperties: false,
  };

  const nums = (s) => new Set(String(s).match(/\d+(?:\.\d+)?/g) || []);

  // 원인 후보 검증: 줄 번호는 근거 목록 안에서만, 수치는 프롬프트에 있던 것만
  function validateCauses(out, pool, promptText) {
    const bad = [];
    const causes = out && out.causes;
    if (!Array.isArray(causes) || !causes.length) return ["원인 후보 없음"];
    if (causes.length > 3) bad.push(`후보 ${causes.length}개 (최대 3개)`);
    const ok = new Set(pool.map((e) => e.n));
    const known = nums(promptText);
    causes.forEach((c, i) => {
      const k = `${i + 1}번`;
      if (!c.cause || !String(c.cause).trim()) bad.push(`${k} 원인 문장 없음`);
      if (String(c.cause || "").length > 100) bad.push(`${k} 원인 문장 100자 초과`);
      if (!CONF.includes(c.confidence)) bad.push(`${k} 확신도 형식`);
      const ev = Array.isArray(c.evidence) ? c.evidence : [];
      if (!ev.length) bad.push(`${k} 근거 줄 없음`);
      const fake = ev.filter((n) => !ok.has(n));
      if (fake.length) bad.push(`${k} 근거 목록에 없는 줄 ${fake.join(", ")}`);
      const extra = [...nums(c.cause + " " + c.reasoning)].filter((n) => !known.has(n));
      if (extra.length) bad.push(`${k} 근거에 없는 수치 ${extra.join(", ")}`);
    });
    return bad;
  }

  const api = { parseLog, stats, episodes, clusters, precursors, ruleCauses, evidencePool, resolvePatterns,
    promptFor, SYSTEM, OUTPUT_SCHEMA, validateCauses, template, fmtTime, CONF };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.LA = api;
})(typeof window !== "undefined" ? window : globalThis);
