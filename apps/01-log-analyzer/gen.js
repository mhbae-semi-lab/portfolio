// 합성 설비 로그 생성기 — 가상 검사기 "SpotCheck" 의 하루 (07:00~19:00, 약 1만 줄)
// 모듈 5종 · 알람 코드 12종, 원인이 있는 알람 연쇄 3가지 + 단발성 알람 + 작업자 조작을 심어 둔다.
// 같은 seed 면 항상 같은 로그가 나온다. 실제 장비 · 사내 알람 코드와 무관.
(function (root) {
  "use strict";

  const DATE = "2026-11-10";
  const MODULES = ["LOADER", "STAGE", "ALIGN", "CAMERA", "LIGHT"];
  const ALARMS = {
    L101: "Cassette not detected", L102: "Slot mapping error", L103: "Wafer vacuum lost", L104: "Door open",
    S301: "Following error X", S302: "Servo off X", S305: "Wafer presence mismatch",
    A201: "Wafer position out of range", A202: "Align score low",
    C401: "Frame timeout", C402: "Image brightness out of range", G501: "Light controller comm error",
  };

  function rng(seed) { // mulberry32
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const H = (h, m, s = 0) => ((h * 60 + m) * 60 + s) * 1000;
  const pad = (n, w = 2) => String(n).padStart(w, "0");
  const clock = (t) => {
    const ms = Math.round(t) % 1000, s = Math.floor(t / 1000);
    return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}.${pad(ms, 3)}`;
  };

  function generate(seed = 20261110) {
    const R = rng(seed);
    const rnd = (a, b) => a + R() * (b - a);
    const ri = (a, b) => Math.floor(rnd(a, b + 1));
    const f = (x, d = 1) => x.toFixed(d);
    const E = [];
    const add = (t, level, module, msg) => E.push({ t: Math.round(t), level, module, msg });
    const START = H(7, 0), END = H(19, 0);

    // ---- 사건 일정 ----
    const EP = [
      { at: H(8, 3, 11), kind: "door" }, { at: H(13, 2, 40), kind: "door" },
      { at: H(9, 12, 40), kind: "vac" }, { at: H(11, 47, 5), kind: "vac" }, { at: H(16, 5, 30), kind: "vac" },
      { at: H(10, 20, 15), kind: "stage" }, { at: H(17, 45, 50), kind: "stage" },
      { at: H(14, 31, 12), kind: "lamp" }, { at: H(15, 52, 48), kind: "lamp" }, { at: H(17, 10, 3), kind: "lamp" }, { at: H(18, 22, 37), kind: "lamp" },
    ];
    for (const h of [7.9, 9.6, 12.4, 14.05, 15.3, 18.7]) EP.push({ at: h * 3600000 + ri(0, 600000), kind: "frame" });
    EP.sort((a, b) => a.at - b.at);
    const pauses = [];
    const before = (kind, t, span) => EP.find((e) => e.kind === kind && t <= e.at && t > e.at - span);

    // ---- 상태값 곡선 (하트비트 · 사이클에 쓰임) ----
    const vacuum = (t) => {
      const e = before("vac", t, H(0, 10));
      const base = -78 + rnd(-1.5, 1.5);
      return e ? base + (18 * (1 - (e.at - t) / H(0, 10))) : base; // 10분 동안 -78 → -60 쪽으로
    };
    const lamp = (t) => (t < H(12, 0) ? 100 : 100 - 16 * (t - H(12, 0)) / (END - H(12, 0))) + rnd(-0.6, 0.6); // 오후부터 열화
    const motorTemp = (t) => {
      const e = before("stage", t, H(0, 6));
      const base = 45 + rnd(-1.5, 1.5);
      return e ? base + 25 * Math.pow(1 - (e.at - t) / H(0, 6), 1.6) : base;
    };

    // ---- 사건별 로그 ----
    for (const e of EP) {
      const a = e.at;
      if (e.kind === "vac") {
        const n = ri(3, 6);
        const ts = Array.from({ length: n }, () => a - rnd(30e3, 8 * 60e3)).sort((x, y) => x - y);
        ts.forEach((t, i) => add(t, "WARN", "LOADER", `Vacuum pressure low (P=${f(-66 + i * 1.2 + rnd(0, 1))} kPa < -65.0 kPa)`));
        add(a, "ALARM", "LOADER", `L103 ${ALARMS.L103} (P=${f(rnd(-45, -38))} kPa)`);
        add(a + rnd(1500, 4000), "ALARM", "ALIGN", `A201 ${ALARMS.A201} (dx=${f(rnd(0.6, 1.1), 2)} mm)`);
        add(a + rnd(5000, 9000), "ALARM", "STAGE", `S305 ${ALARMS.S305} (expected=1, sensor=0)`);
        recover(a, "LOADER", "L103", rnd(3, 6));
      } else if (e.kind === "lamp") {
        for (let k = ri(1, 2); k > 0; k--) add(a - rnd(20e3, 170e3), "WARN", "CAMERA", `Exposure auto-adjusted (gain=+${f(rnd(2.5, 4.5))} dB)`);
        add(a, "ALARM", "CAMERA", `C402 ${ALARMS.C402} (mean=${ri(92, 106)}, min=110)`);
        add(a + rnd(2000, 5000), "ALARM", "ALIGN", `A202 ${ALARMS.A202} (score=${f(rnd(0.38, 0.52), 2)}, min=0.60)`);
        recover(a, "CAMERA", "C402", rnd(2, 4));
      } else if (e.kind === "stage") {
        const n = ri(2, 4);
        Array.from({ length: n }, () => a - rnd(20e3, 4 * 60e3)).sort((x, y) => x - y)
          .forEach((t) => add(t, "WARN", "STAGE", `Motor temp high (X=${f(Math.max(65.2, motorTemp(t)))}C > 65.0C)`));
        add(a, "ALARM", "STAGE", `S301 ${ALARMS.S301} (err=0.0${ri(31, 58)} mm > 0.020 mm)`);
        add(a + rnd(500, 2000), "ALARM", "STAGE", `S302 ${ALARMS.S302}`);
        recover(a, "STAGE", "S301", rnd(6, 9));
      } else if (e.kind === "door") {
        add(a - rnd(20e3, 50e3), "INFO", "LOADER", `Operator login (id=OP-${pad(ri(1, 30))})`);
        add(a, "ALARM", "LOADER", `L104 ${ALARMS.L104}`);
        const back = a + rnd(40e3, 120e3);
        add(back, "INFO", "LOADER", "Door closed");
        add(back + rnd(3e3, 10e3), "INFO", "LOADER", "Alarm reset by operator (L104)");
        add(back + rnd(12e3, 20e3), "INFO", "LOADER", "Process resumed");
        pauses.push([a, back + 20e3]);
      } else if (e.kind === "frame") {
        add(a, "ALARM", "CAMERA", `C401 ${ALARMS.C401} (wait=500 ms)`);
        add(a + rnd(400, 900), "INFO", "CAMERA", "Frame retry ok (attempt=2)");
        add(a + rnd(1000, 1500), "INFO", "CAMERA", "Alarm auto-cleared (C401)");
      }
    }
    function recover(a, mod, code, minutes) {
      add(a + 300, "INFO", mod, `Process paused by alarm ${code}`);
      const end = a + minutes * 60e3;
      add(end, "INFO", mod, `Alarm reset by operator (${code})`);
      add(end + rnd(5e3, 15e3), "INFO", mod, "Process resumed");
      pauses.push([a, end + 15e3]);
    }

    // ---- 평소 잡음 경고 (원인과 무관) ----
    for (let k = 0; k < 16; k++) add(rnd(START, END), "WARN", "CAMERA", `Exposure auto-adjusted (gain=+${f(rnd(0.3, 1.8))} dB)`);
    for (let k = 0; k < 14; k++) add(rnd(START, END), "WARN", "LOADER", `Cassette slot skipped (slot=${pad(ri(1, 25))} empty)`);
    for (let k = 0; k < 22; k++) add(rnd(START, END), "WARN", "ALIGN", `Align retry (score=0.6${ri(1, 9)})`);
    for (let k = 0; k < 2; k++) add(rnd(H(7, 30), H(8, 30)) + k * H(5, 0), "WARN", "LOADER", `Vacuum pressure low (P=-64.${ri(1, 9)} kPa < -65.0 kPa)`);
    add(H(13, 40, 22), "WARN", "STAGE", "Motor temp high (X=65.4C > 65.0C)");

    // 램프 열화 경고: 광량이 95% 아래로 내려간 뒤 10~14분마다
    for (let t = H(12, 0); t < END; t += rnd(10, 14) * 60e3) {
      const v = lamp(t);
      if (v < 95) add(t, "WARN", "LIGHT", `Lamp intensity drift (${f(v - 100)}% from ref)`);
    }

    // ---- 하트비트 ----
    for (let t = START + 15e3; t < END; t += 60e3) {
      add(t + rnd(0, 500), "INFO", "LOADER", `Status vacuum=${f(vacuum(t))} kPa`);
      add(t + rnd(1000, 1500), "INFO", "STAGE", `Status motorX temp=${f(motorTemp(t))}C`);
      add(t + rnd(2000, 2500), "INFO", "LIGHT", `Status lamp=${f(lamp(t))}%`);
      if ((t - START) % 120e3 < 60e3) add(t + rnd(3000, 3500), "INFO", "CAMERA", `Status fps=${ri(58, 60)} temp=${f(rnd(38, 41))}C`);
    }

    // ---- 웨이퍼 사이클 ----
    const paused = (t) => pauses.find(([a, b]) => t >= a && t < b);
    let t = START + 5e3, slot = 0, lot = 0;
    while (t < END - 80e3) {
      const p = paused(t) || paused(t + 70e3);
      if (p) { t = p[1] + rnd(2e3, 6e3); continue; }
      if (slot === 0) { lot++; add(t, "INFO", "LOADER", `Lot start (lot=SC${pad(1100 + lot, 6)}, wafers=25)`); t += 800; }
      slot++;
      const c = t;
      const score = Math.min(0.99, 0.96 - (100 - lamp(c)) * 0.012 + rnd(-0.02, 0.02));
      add(c, "INFO", "LOADER", `Wafer load start (slot=${pad(slot)})`);
      add(c + rnd(300, 600), "INFO", "LOADER", `Vacuum on (P=${f(vacuum(c))} kPa)`);
      add(c + rnd(2500, 3500), "INFO", "LOADER", `Wafer load done (t=${ri(2400, 3300)} ms)`);
      add(c + rnd(4000, 5000), "INFO", "STAGE", `Move done (axis=XY, t=${ri(380, 520)} ms)`);
      add(c + rnd(5200, 5600), "INFO", "ALIGN", "Align start");
      add(c + rnd(5700, 6100), "INFO", "CAMERA", `Frame captured (exp=${f(rnd(1.8, 2.4) * 100 / lamp(c), 2)} ms)`);
      add(c + rnd(6500, 7500), "INFO", "ALIGN", `Align done (score=${f(score, 2)}, dx=${f(rnd(-0.03, 0.03), 3)} mm, dy=${f(rnd(-0.03, 0.03), 3)} mm)`);
      const dies = ri(380, 420);
      add(c + rnd(8000, 8500), "INFO", "STAGE", `Inspection scan start (dies=${dies})`);
      add(c + rnd(52e3, 56e3), "INFO", "CAMERA", `Frames captured (n=${dies})`);
      add(c + rnd(57e3, 59e3), "INFO", "STAGE", `Inspection scan done (t=${ri(48, 51)} s)`);
      add(c + rnd(59.5e3, 61e3), "INFO", "CAMERA", `Defect detection done (defects=${ri(0, 9)})`);
      add(c + rnd(62e3, 63e3), "INFO", "LOADER", "Wafer unload start");
      add(c + rnd(63.5e3, 64e3), "INFO", "LOADER", "Vacuum off");
      add(c + rnd(66e3, 68e3), "INFO", "LOADER", "Wafer unload done");
      t = c + rnd(72e3, 80e3);
      if (slot === 25) { add(t - 2e3, "INFO", "LOADER", `Lot end (lot=SC${pad(1100 + lot, 6)})`); slot = 0; }
    }

    E.sort((a, b) => a.t - b.t);
    return E.map((e) => `${DATE} ${clock(e.t)} ${e.level.padEnd(5)} [${e.module}] ${e.msg}`).join("\n") + "\n";
  }

  const api = { generate, MODULES, ALARMS, DATE };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.LOGGEN = api;
})(typeof window !== "undefined" ? window : globalThis);
