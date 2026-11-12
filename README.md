# 배민혁 · 포트폴리오

반도체 검사 장비 SW 엔지니어 포트폴리오. AX 앱 2종 + 반도체 도메인 데모 3종을 서버 없는 웹으로 만듭니다.

**사이트**: https://mhbae-semi-lab.github.io/portfolio/

| 번호 | 앱 | 데모 | 상태 |
|---|---|---|---|
| 01 | 설비 로그 분석기 — 로그 드롭 → 타임라인 · 알람 군집 · 직전 경고 · 원인 후보와 근거 줄 | [열기](https://mhbae-semi-lab.github.io/portfolio/apps/01-log-analyzer/) | 제작 중 |
| 02 | 주간 보고 자동 생성기 — git 커밋 + 메모 → 요약 3줄 · 사실 검증 → 양식 PPT | [열기](https://mhbae-semi-lab.github.io/portfolio/apps/02-weekly-report/) | 제작 중 |
| 03 | Klarf / Wafer Map 뷰어 | — | 예정 |
| 04 | 레시피 Diff · 버전 관리 | — | 예정 |
| 05 | 브라우저 ADC 데모 | — | 예정 |

## 원칙
- **데이터**: 합성 데이터 또는 공개 데이터셋만 씁니다. 실제 장비 로그 · 레시피 · 사내 양식은 들어 있지 않습니다.
- **LLM**: 기본 화면은 미리 생성해 둔 결과를 보여줍니다. 방문자가 자기 Anthropic API 키를 넣으면 브라우저에서 바로 호출합니다 (키는 메모리에만, 저장하지 않음). 모델 출력은 매번 규칙으로 검증하고, 통과하지 못하면 규칙 기반 결과로 대체합니다.
- **서버 없음**: 빌드 단계 없는 정적 파일이고 GitHub Pages 로 배포합니다.

## 구조
```
index.html, assets/      포트폴리오 (해시 라우팅 단일 페이지, 인쇄 스타일 → PDF)
projects.json            앱 · 사례 · 프로필 (웹과 PDF 가 같은 데이터를 씀)
apps/01-log-analyzer/    gen.js 합성 로그 · analyze.js 파싱 · 군집 · 검증 · app.js 화면
apps/02-weekly-report/   core.js 주제 묶기 · 검증 · deck.js PPT · app.js 화면
```
`analyze.js`, `core.js`, `deck.js` 는 node 에서도 `require` 로 쓸 수 있어 화면 없이 검증할 수 있습니다.

## 로컬에서 보기
`fetch` 를 쓰므로 웹 서버가 필요합니다.
```
python -m http.server 8765
```
→ http://127.0.0.1:8765 (로컬에서는 아직 채우지 않은 칸이 빨간 점선으로 보입니다)
