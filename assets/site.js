// 포트폴리오: 스크롤 나타나기 + 세부 내용 시트(#p-이름 해시로 열고 닫음, 링크 공유 가능)
"use strict";
document.documentElement.classList.add("js");

// 스크롤로 들어오는 요소를 한 번만 나타나게 (스크롤 이벤트 없이 IntersectionObserver)
const items = document.querySelectorAll(".reveal");
items.forEach((el) => {
  const sib = [...el.parentElement.children].filter((c) => c.classList.contains("reveal"));
  el.style.setProperty("--i", sib.indexOf(el));
});
if ("IntersectionObserver" in window) {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
  }, { rootMargin: "0px 0px -8% 0px" });
  items.forEach((el) => io.observe(el));
} else {
  items.forEach((el) => el.classList.add("in"));
}

// 세부 내용 시트
const dlg = document.getElementById("detail");
const body = dlg.querySelector(".sheet-body");
const ids = [...document.querySelectorAll("template[id^='p-']")].map((t) => t.id);
let lastFocus = null;

function show(id) {
  body.replaceChildren(document.getElementById(id).content.cloneNode(true));
  const i = ids.indexOf(id);
  for (const [dir, j] of [["prev", i - 1], ["next", i + 1]]) {
    const a = dlg.querySelector(`[data-dir="${dir}"]`);
    a.hidden = !ids[j];
    if (ids[j]) a.href = "#" + ids[j];
  }
  if (!dlg.open) { lastFocus = document.activeElement; dlg.showModal(); }
  dlg.scrollTop = 0;
}

function route() {
  const id = location.hash.slice(1);
  if (ids.includes(id)) show(id);
  else if (dlg.open) dlg.close();
}

// 닫으면 주소의 #p-이름 을 지워 새로고침해도 시트가 다시 열리지 않게 한다
dlg.addEventListener("close", () => {
  if (ids.includes(location.hash.slice(1))) history.replaceState(null, "", location.pathname + location.search);
  lastFocus?.focus?.();
});
dlg.querySelector(".sheet-close").addEventListener("click", () => dlg.close());
dlg.addEventListener("click", (e) => { // 시트 바깥(배경)을 누르면 닫힘
  const r = dlg.getBoundingClientRect();
  if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dlg.close();
});
window.addEventListener("hashchange", route);
route();
