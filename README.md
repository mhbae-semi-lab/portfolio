# 배민혁 · 포트폴리오

반도체 검사 장비 SW · AI 응용 엔지니어 포트폴리오. 실무 사례(익명) + AX 앱 + 반도체 도메인 데모. 웹 데모는 서버 없는 정적 웹, 데스크톱 앱은 화면으로 보여줍니다.

**사이트**: https://mhbae-semi-lab.github.io/portfolio/

| 번호 | 앱 | 데모 | 상태 |
|---|---|---|---|
| 01 | 설비 로그 분석기 — 로그 드롭 → 타임라인 · 알람 군집 · 직전 경고 · 원인 후보와 근거 줄 | [열기](https://mhbae-semi-lab.github.io/portfolio/apps/01-log-analyzer/) | 제작 중 |
| 02 | 주간 보고 자동 생성기 — git 커밋 + 메모 → 요약 3줄 · 사실 검증 → 양식 PPT | [열기](https://mhbae-semi-lab.github.io/portfolio/apps/02-weekly-report/) | 제작 중 |
| 03 | Klarf / Wafer Map 뷰어 | — | 예정 |
| 04 | 레시피 기준 관리 — 기준 등록 · Diff · 배포 · 롤백 · 검사 전 검증 | — | 예정 |
| 05 | 정렬 마크 검출 비교 — 규칙 vs CNN(브라우저 ONNX) vs 결합 정책 | — | 예정 |
| 06 | 메일 분류 · 검증기 — 규칙 1차 + LLM 보강, 중요도 근거 · 마감 | — | 예정 |
| 07 | 프롬프트 어드바이저 — 낭비 경고 · 토큰 예측 · 모델 추천 (Windows 앱, 화면 공개) | — | 예정 |

## 원칙
- **데이터**: 합성 데이터 또는 공개 데이터셋만 씁니다. 실제 장비 로그 · 레시피 · 사내 양식은 들어 있지 않습니다.
- **LLM**: 기본 화면은 미리 생성해 둔 결과를 보여줍니다. 방문자가 자기 Anthropic API 키를 넣으면 브라우저에서 바로 호출합니다 (키는 메모리에만, 저장하지 않음). 모델 출력은 매번 규칙으로 검증하고, 통과하지 못하면 규칙 기반 결과로 대체합니다.
- **서버 없음**: 빌드 단계 없는 정적 파일이고 GitHub Pages 로 배포합니다.

## 구조
```
index.html, assets/      포트폴리오 한 페이지, 카드를 누르면 #p-이름 으로 세부 패널이 열림
resume.html              1장 이력서 (인쇄하면 A4 1쪽 PDF). index.html 수치를 바꾸면 여기도 같이 바꿈
notes/                   기술 노트 (한국어만). 그림은 make_figures.py 가 만든 합성 데이터 그림을 같이 씀
tools/make_figures.py    합성 데이터로 사례 그림(assets/img/fig-*.webp)을 다시 만듦
en.html                  영문판. index.html 을 고치면 영문판의 같은 곳도 고친다 (상단 KO / EN 스위치, 고른 언어는 브라우저에 기억)
tools/make_figures_en.py 영문판 그림(assets/img/en/), 같은 데이터에 그림 글자만 영어로. 빠진 번역이 있으면 실패
apps/01-log-analyzer/    gen.js 합성 로그 · analyze.js 파싱 · 군집 · 검증 · app.js 화면
apps/02-weekly-report/   core.js 주제 묶기 · 검증 · deck.js PPT · app.js 화면
```
`analyze.js`, `core.js`, `deck.js` 는 node 에서도 `require` 로 쓸 수 있어 화면 없이 검증할 수 있습니다.

## 로컬에서 보기
정적 파일이라 index.html 을 바로 열어도 됩니다. 웹 서버로 보려면:
```
python -m http.server 8765
```
→ http://127.0.0.1:8765

## 올릴 때
`index.html` 의 `site.css?v=` 와 `site.js?v=` 값을 바꿉니다. 바꾸지 않으면 방문자 브라우저가 예전 스타일을 계속 씁니다.
