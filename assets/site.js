// 스크롤로 들어오는 요소를 한 번만 나타나게 한다 (IntersectionObserver, 스크롤 이벤트 없음)
"use strict";
document.documentElement.classList.add("js");
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
