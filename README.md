# 배민혁 · 포트폴리오

반도체 검사 장비 SW · AI 응용 엔지니어 포트폴리오. 실무 사례(익명) + 누구나 자기 데이터로 쓰는 공개 앱. 앱은 저장소마다 따로 있고, 이 저장소는 소개 사이트만 담습니다.

**사이트**: https://mhbae-semi-lab.github.io/portfolio/

| 번호 | 앱 | 쓰기 | 저장소 | 상태 |
|---|---|---|---|---|
| 01 | 설비 로그 분석기 — 알람 군집 · 경고→알람 리드 타임 · 근거 줄이 붙은 원인 후보 (웹) | [열기](https://mhbae-semi-lab.github.io/log-analyzer/) | [log-analyzer](https://github.com/mhbae-semi-lab/log-analyzer) | v1.0.0 |
| 02 | 주간 보고 생성기 — git log → 주제별 3줄 요약 · 사실 검증 → PPTX (웹) | [열기](https://mhbae-semi-lab.github.io/weekly-report/) | [weekly-report](https://github.com/mhbae-semi-lab/weekly-report) | v1.0.0 |
| — | LLM Pulse — 내 구독 안에서 분야별 모델 추천 · 소스 불일치 경고 (Windows) | [설치 파일](https://github.com/mhbae-semi-lab/llm-pulse/releases/latest) | [llm-pulse](https://github.com/mhbae-semi-lab/llm-pulse) | v1.0.0 |
| 03 | Klarf 웨이퍼 맵 뷰어 — KLARF 1.2 · 1.8 · 맵 정의 검증 5종 · 겹치기 · 두 파일 비교 (웹) | [열기](https://mhbae-semi-lab.github.io/klarf-viewer/) | [klarf-viewer](https://github.com/mhbae-semi-lab/klarf-viewer) | v1.0.0 |
| 04 | 레시피 기준 관리 — 기준 등록 · 허용 오차 Diff · 장비 × 버전 현황판 · 배포 · 롤백 묶음 · 검사 전 검증 (웹) | [열기](https://mhbae-semi-lab.github.io/recipe-golden/) | [recipe-golden](https://github.com/mhbae-semi-lab/recipe-golden) | v1.0.0 |
| 06 | MDCV 메일 분류기 — 설비 · 알람 코드 분류 · 한국어 마감 → 기한순 할 일 (웹 + Docker 셀프호스트) | [열기](https://mhbae-semi-lab.github.io/mdcv/) | [mdcv](https://github.com/mhbae-semi-lab/mdcv) | v1.0.0 |
| 07 | 프롬프트 어드바이저 — 보내기 전 낭비 경고 · 장비 SW 요청 린트 (Windows) | [설치 파일](https://github.com/mhbae-semi-lab/prompt-advisor/releases/latest) | [prompt-advisor](https://github.com/mhbae-semi-lab/prompt-advisor) | v1.0.0 |
| 08 | 프레임 대기열 시뮬레이터 — 단계별 처리 시간 · 넘침 정책 · 메모리 한도 도달 시각 (웹) | [열기](https://mhbae-semi-lab.github.io/frame-backlog-sim/) | [frame-backlog-sim](https://github.com/mhbae-semi-lab/frame-backlog-sim) | v1.0.0 |
| 09 | 장비 SW 위험 코드 린트 — 장시간 운영 Down 패턴 Roslyn 분석기 · dotnet tool CLI · 브라우저 보고서 (NuGet) | [보고서 뷰어](https://mhbae-semi-lab.github.io/equip-sw-lint/viewer/) · [NuGet](https://www.nuget.org/packages/EquipSwLint.Analyzers) | [equip-sw-lint](https://github.com/mhbae-semi-lab/equip-sw-lint) | v1.0.1 |

## 원칙
- **데이터**: 합성 데이터 또는 공개 데이터셋만 씁니다. 실제 장비 로그 · 레시피 · 사내 양식은 들어 있지 않습니다.
- **LLM**: 앱은 사용자 본인 키 또는 로컬 Ollama 를 쓰고, 키가 없어도 규칙 기반으로 모든 기능이 동작합니다. 모델 출력은 매번 규칙으로 검증하고, 통과하지 못하면 규칙 기반 결과로 대체합니다.
- **서버 없음**: 빌드 단계 없는 정적 파일이고 GitHub Pages 로 배포합니다.

## 구조
```
index.html, assets/      포트폴리오 한 페이지, 카드를 누르면 #p-이름 으로 세부 패널이 열림
resume.html              단일 열 A4 이력서. #vision(기본), #control, #ax로 직무별 대표 사례 3개를 선택
resume-en.html           같은 사실과 직무 구성을 담은 영문판. 두 언어의 수치를 함께 갱신
assets/resume.css, assets/resume.js   이력서 인쇄 스타일, 직무·언어 이동, 제출용 PDF의 공개 프로젝트 링크
assets/resume*.pdf       비전은 기존 resume.pdf와 resume-en.pdf, 나머지는 resume-control[-en].pdf와 resume-ax[-en].pdf
notes/                   기술 노트. 현업 사례 노트는 make_figures.py 의 합성 데이터 그림, 공개 앱 노트는 앱 화면(합성 데이터)을 씀
notes/en/                기술 노트 영문판. 한국어 노트를 고치면 여기도 같이 고친다
tools/make_figures.py    합성 데이터로 사례 그림(assets/img/fig-*.webp)을 다시 만듦
en.html                  영문판. index.html 을 고치면 영문판의 같은 곳도 고친다 (상단 KO / EN 스위치, 고른 언어는 브라우저에 기억)
tools/make_figures_en.py 영문판 그림(assets/img/en/), 같은 데이터에 그림 글자만 영어로. 빠진 번역이 있으면 실패
apps/01-log-analyzer/    옛 데모 주소. 새 앱 주소로 넘기는 안내 페이지만 있음 (옛 코드는 git 이력에)
apps/02-weekly-report/   위와 같음
```

## 로컬에서 보기
정적 파일이라 index.html 을 바로 열어도 됩니다. 웹 서버로 보려면:
```
python -m http.server 8765
```
→ http://127.0.0.1:8765

## 올릴 때
`index.html` 의 `site.css?v=` 와 `site.js?v=` 값을 바꿉니다. 바꾸지 않으면 방문자 브라우저가 예전 스타일을 계속 씁니다.

국문·영문 이력서나 프로젝트 본문을 고치면 두 언어의 PDF를 함께 갱신합니다. 이력서는 직무별 A4 한 쪽, 포트폴리오는 해당 이력서의 사례 세 건을 한 쪽씩 담습니다. 그림, 검증 조건, 결과와 공개 사례 링크를 같은 언어의 원본에서 가져옵니다.

프로젝트 루트에서 Node.js와 Playwright를 사용할 수 있는 환경으로 다음 명령을 실행합니다. `PLAYWRIGHT_MODULE`로 Playwright 모듈 위치를, `EDGE_EXE`로 Edge 실행 파일을 지정할 수 있습니다.

```powershell
node tools/build_application_pdfs.cjs
```

`assets/resume*.pdf`와 `assets/portfolio*.pdf`에 비전, 장비 제어, 제조 자동화의 두 언어 파일이 생성됩니다. 직무별 이력서 화면에서 이력서와 같은 언어·직무의 포트폴리오 PDF를 내려받을 수 있습니다.

공개 사이트와 `resume.html` · `resume-en.html` 에는 구직 문구 · 병역 · 입사 시기를 쓰지 않습니다. 회사에 내는 서류에서만 적습니다.
