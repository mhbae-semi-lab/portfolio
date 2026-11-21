// 움직이는 그림(assets/widgets.js)의 계산 검사. 실행: node tools/check_widgets.js
const assert = require("assert");
const { focusModel, alignModel, matchModel } = require("../assets/widgets.js");

const f = focusModel();
const pz = f.zs[f.sp.indexOf(1)], fz = f.zs[f.sf.indexOf(1)];
assert.strictEqual(pz - fz, 60, `초점: 입자와 바닥 봉우리 차이가 60µm 가 아님 (${pz}, ${fz})`);

const a = alignModel();
assert(Math.abs(a.peak - a.TH) <= 0.1, `Align: 점수 봉우리 ${a.peak}° 가 실제 ${a.TH}° 와 다름`);

const m = matchModel();
const r0 = m.run(0), r1 = m.run(1), r3 = m.run(3);
assert(r0.okPos === m.n && r0.okBoth === m.n, "매칭: 오차 0 이면 둘 다 전부 맞아야 함");
assert(r1.okBoth >= r1.okPos + 8, `매칭: 기본 오차에서 크기를 함께 본 쪽이 나아야 함 (${r1.okPos}, ${r1.okBoth})`);
assert(r3.okPos < r1.okPos, "매칭: 오차를 키우면 위치만 쓰는 쪽이 나빠져야 함");
console.log("ok", { focus: [pz, fz], alignPeak: a.peak, match: [r1.okPos, r1.okBoth, m.n], match3: [r3.okPos, r3.okBoth] });
