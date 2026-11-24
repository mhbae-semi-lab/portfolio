// Generate both languages from the same track order and the published case-study markup.
const fs = require("node:fs");
const path = require("node:path");
const {pathToFileURL} = require("node:url");
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const root = path.resolve(__dirname, "..");
const tracks = ["vision", "control", "ax"];
const labels = {
  ko: {title:"포트폴리오", vision:"비전 SW", control:"장비 제어", ax:"제조 자동화", problem:"과제", method:"구현", status:"적용 상태", evaluation:"검증 조건", source:"검증 자료", link:"프로젝트 상세 보기"},
  en: {title:"Portfolio", vision:"Machine vision", control:"Equipment control", ax:"Manufacturing automation", problem:"Problem", method:"Implementation", status:"Status", evaluation:"Evaluation", source:"Evidence", link:"View the full case study"}
};
const sheetCSS = fs.readFileSync(path.join(root,"assets","portfolio-print.css"),"utf8");

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
}

function readResume(track) {
  const list = document.querySelector('.projects[data-edition="' + track + '"]');
  if (!list || !list.offsetHeight) throw new Error("The requested resume is not visible: " + track);
  const portrait = document.querySelector(".resume-header .portrait");
  return {
    name:document.querySelector("h1").textContent,
    portrait:{src:portrait.currentSrc, alt:portrait.alt},
    publicPage:document.querySelector(".contact .portfolio").href,
    email:document.querySelector('.contact a[href^="mailto:"]').href,
    projects:[...list.children].map(li => ({
      id:li.querySelector("h3 a").hash.slice(1), title:li.querySelector("h3 a").textContent,
      year:li.querySelector(".year").textContent,
      result:Array.from(li.querySelector(".outcome").childNodes, node => ({
        text:node.textContent, metric:node.nodeType === Node.ELEMENT_NODE && node.matches("strong.metric")
      })),
      method:li.querySelector(".method").textContent, status:li.querySelector(".status").textContent
    }))
  };
}

// Each paired selector points to the same material in the Korean and English case studies.
function readCases({projects,lang,track}) {
  const selections = {
    "p-mark": [".d-step:nth-of-type(1) > p", ".d-step:nth-of-type(3) > p", "figure"],
    "p-align": [".d-step:nth-of-type(1) > p", ".d-step:nth-of-type(2) > p", "figure"],
    "p-crack": [".d-step:nth-of-type(1) > p", ".d-step:nth-of-type(3) > p", "figure"],
    "p-stable": [".d-step:nth-of-type(1) > p", ".d-step:nth-of-type(2) > p", "figure"],
    "p-interlock": [".sequence li:nth-child(1)", ".sequence li:nth-child(3)", "figure"],
    "p-focus": [".d-step:nth-of-type(1) > p", ".d-step:nth-of-type(2) > p", ".d-step:nth-of-type(2) figure"],
    "p-recipe": [".d-step:nth-of-type(1) > p", ".d-step:nth-of-type(2) > p", "figure"],
    "p-weekly": ["ul:first-of-type > li", "ul:nth-of-type(2) > li:nth-child(3)", "figure"]
  };
  // Include test conditions separately from deployment status. Sentence selection avoids repeating metrics.
  const evaluation = {
    "p-mark":[".d-step:nth-of-type(5) > p:nth-of-type(2)",1],
    "p-align":[".d-step:nth-of-type(3) > p:nth-of-type(2)",0,2],
    "p-crack":[".d-step:nth-of-type(2) > p:nth-of-type(2)",0],
    "p-stable":[".d-step:nth-of-type(3) > p:first-of-type",1,3],
    "p-interlock":[".sequence + p",-1],
    "p-focus":[".d-step:nth-of-type(3) > p:first-of-type",0],
    "p-recipe":[".d-step:nth-of-type(4) > p:first-of-type",0,1],
    "p-weekly":["table + p",-1]
  };
  const segmenter = new Intl.Segmenter(lang,{granularity:"sentence"});
  return projects.map(project => {
    const content = document.getElementById(project.id).content;
    const [problem,method,figureSelector] = selections[project.id];
    const text = selector => {
      const element = content.querySelector(selector);
      if (!element) throw new Error("Missing " + selector + " in " + project.id);
      const copy = element.cloneNode(true);
      if (element.matches(".sequence li")) copy.querySelector("b")?.remove();
      return copy.textContent.trim().replace(/\s+/g," ");
    };
    const figure = content.querySelector(figureSelector);
    const image = figure.querySelector("img");
    const source = text(".d-source").replace(/^(?:근거|Source|Evidence)\s*[·:]\s*/i,"");
    const [testSelector,start,end] = evaluation[project.id];
    const conditions = [...segmenter.segment(text(testSelector))].slice(start,end).map(s => s.segment).join("").trim();
    if (!conditions) throw new Error("Missing evaluation conditions for " + project.id);
    const implementation = track === "ax" && project.id === "p-mark"
      ? project.method + " " + [...segmenter.segment(text(method))][0].segment.trim()
      : text(method);
    const status = project.id === "p-interlock" ? text(".d-meta .st") : project.status;
    return {...project, problem:text(problem), implementation, conditions, status,
      image:new URL(image.getAttribute("src"),document.baseURI).href,
      alt:image.alt,caption:figure.querySelector("figcaption").textContent.trim(),source};
  });
}

function portfolioHtml(lang, track, resume, cases) {
  const t=labels[lang], h=escapeHtml;
  const portrait = '<img class="portrait" src="' + h(resume.portrait.src) + '" alt="' + h(resume.portrait.alt) + '">';
  const outcome = parts => parts.map(part => part.metric
    ? '<strong class="metric">' + h(part.text) + '</strong>' : h(part.text)).join("");
  const pages = cases.map((c,i) =>
    '<article class="sheet"><header class="folio"><strong>' + h(t[track] + " · " + t.title) +
    '</strong><a href="' + h(resume.email) + '">' + h(resume.name) + '</a></header>' +
    '<div' + (i === 0 ? ' class="with-portrait"' : '') + '><div><h1>' + h(c.title) +
    '</h1><p class="outcome">' + outcome(c.result) + '</p></div>' + (i === 0 ? portrait : '') + '</div>' +
    '<figure><img alt="' + h(c.alt) + '" src="' + h(c.image) + '"><figcaption>' + h(c.caption) + '</figcaption></figure>' +
    '<section class="notes"><h2>' + h(t.problem) + '</h2><p>' + h(c.problem) + '</p><h2>' + h(t.method) +
    '</h2><p>' + h(c.implementation) + '</p><h2>' + h(t.evaluation) + '</h2><p>' + h(c.conditions) +
    '</p><h2>' + h(t.status) + '</h2><p>' + h(c.status) + '</p></section>' +
    '<p class="sources"><b>' + h(t.source) + '</b> · ' + h(c.source) + '</p>' +
    '<footer><a href="' + h(resume.publicPage + "#" + c.id) + '">' + h(t.link) + '</a><span>' +
    h(c.year) + '　·　' + (i+1) + ' / ' + cases.length + '</span></footer></article>'
  );
  return '<!doctype html><html lang="' + lang + '"><head><meta charset="utf-8"><title>' +
    h(resume.name + " · " + t[track] + " · " + t.title) + '</title><style>' + sheetCSS +
    '</style></head><body>' + pages.join("") + '</body></html>';
}

async function build() {
  const browser = await chromium.launch(process.env.EDGE_EXE ?
    {executablePath:process.env.EDGE_EXE,headless:true} : {channel:"msedge",headless:true});
  try {
    for (const lang of ["ko","en"]) {
      const suffix = lang === "ko" ? "" : "-en";
      const context = await browser.newContext({locale:lang,viewport:{width:1180,height:900},reducedMotion:"reduce"});
      // The bundled fonts and figures are enough to rebuild without a network connection.
      await context.route(/^https?:\/\//,route => route.abort());
      const resumePage = await context.newPage();
      const detailPage = await context.newPage();
      const printPage = await context.newPage();
      const local = f => pathToFileURL(path.join(root,f)).href;
      await detailPage.goto(local(lang === "ko" ? "index.html" : "en.html"));
      const printOptions = {preferCSSPageSize:true,printBackground:true,displayHeaderFooter:false,tagged:true};
      for (const track of tracks) {
        await resumePage.goto(local("resume"+suffix+".html")+"#"+track);
        await resumePage.waitForFunction(track => document.querySelector(".tracks a[aria-current]")?.id === track,track);
        await resumePage.evaluate(async () => {
          await document.fonts.ready;
          await document.querySelector(".resume-header .portrait").decode();
        });
        const resume = await resumePage.evaluate(readResume,track);
        const cases = await detailPage.evaluate(readCases,{projects:resume.projects,lang,track});
        if (cases.length !== 3) throw new Error("Expected three cases in " + track);
        const edition = (track === "vision" ? "" : "-"+track) + suffix;
        await resumePage.pdf({...printOptions,path:path.join(root,"assets","resume"+edition+".pdf")});
        // Opening a local page gives the print document permission to load the local figure files.
        await printPage.goto(local(lang === "ko" ? "index.html" : "en.html"));
        await printPage.setContent(portfolioHtml(lang,track,resume,cases),{waitUntil:"load"});
        await printPage.evaluate(async () => {
          await document.fonts.ready;
          await Promise.all([...document.images].map(img => img.decode()));
          for (const sheet of document.querySelectorAll(".sheet")) {
            const footer = sheet.querySelector("footer");
            if (sheet.scrollHeight > sheet.clientHeight + 1 ||
                sheet.querySelector(".sources").getBoundingClientRect().bottom > footer.getBoundingClientRect().top + 1)
              throw new Error("Portfolio content overflows the page: " + sheet.querySelector("h1").textContent);
          }
        });
        await printPage.pdf({...printOptions,path:path.join(root,"assets","portfolio"+edition+".pdf")});
        console.log(lang,track,cases.map(c => c.id).join(", "));
      }
      await context.close();
    }
  } finally { await browser.close(); }
}
build().catch(error => { console.error(error); process.exitCode = 1; });
