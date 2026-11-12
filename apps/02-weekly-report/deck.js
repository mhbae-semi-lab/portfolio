// PPT 생성 (PptxGenJS). 브라우저: window.WR_DECK, node: module.exports — 같은 코드로 화면 밖에서도 검사한다
(function (root) {
  "use strict";
  const W = typeof module !== "undefined" && module.exports ? require("./core.js") : root.WR;
  const RED = "C00000", INK = "262626", GRAY = "7F7F7F", PALE = "F2F2F2", LINE = "BFBFBF";
  const FONT = "맑은 고딕";
  const T = (o) => ({ fontFace: FONT, color: INK, margin: 0, ...o });

  // d: { topics (제외 뺀 목록), year, week, project, author, order }
  function build(PptxGenJS, d) {
    const pptx = new PptxGenJS();
    pptx.layout = "LAYOUT_WIDE";
    pptx.title = `${d.year}년 ${d.week}주차 업무 보고`;
    const [a, b] = W.weekRange(d.year, d.week);

    // 표지
    let s = pptx.addSlide();
    s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.35, h: 7.5, fill: { color: RED }, line: { color: RED } });
    s.addText("주간 업무 보고", T({ x: 1.0, y: 2.3, w: 11, h: 1.0, fontSize: 40, bold: true }));
    s.addText(`${d.year}년 ${d.week}주차  (${a} ~ ${b})`, T({ x: 1.0, y: 3.35, w: 11, h: 0.5, fontSize: 20, color: "595959" }));
    s.addText(`${d.project}  ·  ${d.author}`, T({ x: 1.0, y: 6.3, w: 11, h: 0.4, fontSize: 14, color: GRAY }));

    // 구역 간지 + 내지
    const foot = `${d.project} · ${d.year}년 ${d.week}주차`;
    W.sectionGroups(d.topics, d.order).forEach(([name, items], n) => {
      s = pptx.addSlide();
      s.addText(String(n + 1).padStart(2, "0"), T({ x: 1.0, y: 2.6, w: 3, h: 1.2, fontSize: 60, bold: true, color: RED }));
      s.addShape(pptx.ShapeType.line, { x: 1.0, y: 3.95, w: 11.3, h: 0, line: { color: INK, width: 1.5 } });
      s.addText(name, T({ x: 1.0, y: 4.15, w: 11, h: 0.8, fontSize: 32, bold: true }));
      for (const t of items) content(pptx, t, foot);
    });

    // 끝
    s = pptx.addSlide();
    s.addText("끝", T({ x: 0, y: 3.2, w: 13.333, h: 1, fontSize: 28, bold: true, align: "center", color: GRAY }));
    return pptx;
  }

  function content(pptx, t, foot) {
    const L = W.contentLayout(t);
    const s = pptx.addSlide();
    s.addText(`${t.tag} ${t.title}`, T({ ...L.title, fontSize: 22, bold: true, valign: "middle" }));
    s.addShape(pptx.ShapeType.line, { x: L.rule.x, y: L.rule.y, w: L.rule.w, h: 0, line: { color: INK, width: 1.25 } });
    s.addText(t.lines.map((l) => ({ text: l, options: { bullet: { indent: 18 }, paraSpaceBefore: 6 } })),
      T({ ...L.body, fontSize: 14, valign: "top", lineSpacingMultiple: 1.25 }));
    W.badges(W.statusOf(t)).forEach((b, i) => {
      s.addText(b.word, T({
        shape: pptx.ShapeType.roundRect, rectRadius: 0.08,
        x: W.SLIDE.left + i * (L.badge.w + L.badge.gap), y: L.badgeY, w: L.badge.w, h: L.badge.h,
        fill: { color: b.filled ? RED : "FFFFFF" }, line: { color: RED, width: 1.25 },
        color: b.filled ? "FFFFFF" : RED, fontSize: 12, bold: true, align: "center", valign: "middle",
      }));
    });
    L.cards.forEach((c, i) => {
      s.addText(c.text, T({
        shape: pptx.ShapeType.roundRect, rectRadius: 0.1, x: c.x, y: c.y, w: c.w, h: c.h,
        fill: { color: PALE }, line: { color: LINE, width: 0.75 },
        fontSize: c.w < 2.2 ? 11 : 13, align: "center", valign: "middle", margin: [18, 6, 6, 6],
      }));
      s.addText(String(i + 1), T({
        shape: pptx.ShapeType.ellipse, x: c.x + c.w / 2 - 0.22, y: c.y - 0.22, w: 0.44, h: 0.44,
        fill: { color: RED }, line: { color: RED }, color: "FFFFFF", fontSize: 12, bold: true, align: "center", valign: "middle",
      }));
      if (!c.last) s.addShape(pptx.ShapeType.chevron, { x: c.x + c.w + 0.08, y: c.y + c.h / 2 - 0.17, w: c.gap - 0.16, h: 0.34, fill: { color: RED }, line: { color: RED } });
    });
    s.addText(foot, T({ ...L.foot, fontSize: 9, color: GRAY }));
  }

  const api = { build };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.WR_DECK = api;
})(typeof window !== "undefined" ? window : globalThis);
