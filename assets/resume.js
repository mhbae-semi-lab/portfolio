const tracks = [...document.querySelectorAll(".tracks a")];
const languageLink = document.querySelector(".actions a[hreflang]");
const alternate = languageLink.getAttribute("href");
const resumeTitle = document.title;

function selectTrack() {
  const current = tracks.find(link => link.hash === location.hash) || tracks[0];
  for (const link of tracks) {
    if (link === current) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  languageLink.href = alternate + current.hash;
  document.title = resumeTitle + " · " + current.textContent;
}
selectTrack();
window.addEventListener("hashchange", selectTrack);
window.addEventListener("pageshow", () => {
  try { localStorage.setItem("lang", document.documentElement.lang); }
  catch { /* Language-specific links also work without storage. */ }
});

// Printed copies must open the public case study even when printed from a local preview.
const publicPortfolio = document.querySelector(".contact .portfolio").href;
const projectLinks = [...document.querySelectorAll(".projects h3 a")];
const localPaths = projectLinks.map(link => link.getAttribute("href"));
window.addEventListener("beforeprint", () => {
  for (const link of projectLinks) link.href = publicPortfolio + link.hash;
});
window.addEventListener("afterprint", () => {
  projectLinks.forEach((link, i) => { link.href = localPaths[i]; });
});
