// 합성 데이터: 가상 프로젝트 "SpotCheck" (소형 비전 검사기 운영 프로그램, 실존하지 않음)
// 커밋 4주치 + 주제별 메모 + 미리 생성해 둔 요약(제목 · 3줄 · 흐름도)
(function (root) {
  "use strict";

  const LOG = `
@@a41c9e2|2026-10-19|[검사 결과 CSV 내보내기] 결과 테이블 → CSV 저장 기능
src/Report/CsvExporter.cs
src/Report/ResultTable.cs
@@b7d0f13|2026-10-20|오토 포커스 탐색 Phase 1 - 영상 선명도 점수 계산
src/Vision/Focus/SharpnessScore.cs
@@c2e8a55|2026-10-21|[검사 결과 CSV 내보내기] 날짜 범위 필터 추가
src/Report/ResultFilter.cs
src/UI/ExportDialog.xaml
@@d93b071|2026-10-21|[빌드 스크립트] 릴리스 빌드 한 번에 묶기
tools/build.ps1
@@e15f6c8|2026-10-22|오토 포커스 탐색 Phase 2 - 거친 탐색 → 세밀 탐색 2단계로 변경
src/Vision/Focus/AutoFocus.cs
src/Vision/Focus/FocusSearch.cs
@@f6a2d34|2026-10-23|[검사 결과 CSV 내보내기] 한글 깨짐 수정 (UTF-8 BOM)
src/Report/CsvExporter.cs
@@0b8e7a9|2026-10-23|[빌드 스크립트] 버전 번호 자동 증가
tools/version.ps1
tools/build.ps1
@@1c4d2f0|2026-10-26|[다크 테마] 색상 팔레트 분리 (ResourceDictionary)
src/UI/Theme/Colors.Dark.xaml
src/UI/Theme/Colors.Light.xaml
@@2d7e9b1|2026-10-27|[이력 검색] 날짜 · 모델 인덱스 추가
src/Report/History/HistoryRepository.cs
@@3e0a6c2|2026-10-28|[다크 테마] 차트 · 표 색상 적용
src/UI/Charts/ChartColors.cs
src/UI/ResultGrid.xaml
@@4f3b8d3|2026-10-29|오토 포커스 탐색 Phase 3 - 탐색 실패 시 재시도 · 알람
src/Vision/Focus/AutoFocus.cs
src/Vision/Alarm/AlarmCodes.cs
@@5a6c0e4|2026-10-29|[이력 검색] 전체 조회 → 페이지 단위 조회로 변경
src/Report/History/HistoryQuery.cs
src/UI/HistoryView.xaml
src/Report/History/HistoryRepository.cs
@@6b9d2f5|2026-10-30|[다크 테마] 설정에서 테마 전환
src/UI/SettingsView.xaml
@@7c1e4a6|2026-11-02|[PDF 보고서] 일별 요약 템플릿
src/Report/Pdf/DailyTemplate.cs
@@8d4f6b7|2026-11-03|[로그 정리] 30일 지난 로그 자동 압축
tools/logrotate.ps1
@@9e7a8c8|2026-11-03|[영상 뷰어] 마우스 휠 확대 · 드래그 이동
src/UI/ImageViewer/ZoomPanBehavior.cs
@@af0b9d9|2026-11-04|[PDF 보고서] 불량 상위 5개 표 추가
src/Report/Pdf/DefectTable.cs
@@b03cae0|2026-11-05|[로그 정리] 디스크 여유 공간 경고
tools/logrotate.ps1
tools/diskcheck.ps1
@@c16dbf1|2026-11-05|[영상 뷰어] 커서 위치 픽셀 값 표시
src/UI/ImageViewer/PixelProbe.cs
@@d29ec02|2026-11-06|[PDF 보고서] 인쇄 여백 수정
src/Report/Pdf/PageSetup.cs
@@e3c0d13|2026-11-09|[PDF 보고서] 주간 요약 페이지
src/Report/Pdf/WeeklyTemplate.cs
@@f4f1e24|2026-11-10|오토 포커스 탐색 Phase 4 - 모델별 탐색 범위 설정
src/Vision/Focus/FocusConfig.cs
src/Vision/Focus/AutoFocus.cs
src/UI/SettingsView.xaml
@@0a2f135|2026-11-11|[PDF 보고서] 그래프 축 단위 표시
src/Report/Pdf/ChartRenderer.cs
@@1b3a246|2026-11-12|README 설치 방법 갱신
docs/README.md
`;

  const CONFIG = {
    project: "SpotCheck",
    author: "검사 SW 파트 홍길동",
    rules: [
      { match: ["src/Vision/"], tag: "[비전]", section: "비전" },
      { match: ["src/Report/"], tag: "[보고서]", section: "보고서" },
      { match: ["src/UI/"], tag: "[화면]", section: "화면" },
      { match: ["tools/"], tag: "[도구]", section: "도구" },
    ],
    fallback: { tag: "[기타]", section: "기타" },
    order: ["비전", "보고서", "화면", "도구", "기타"],
  };

  // key = "주차ID|주제" — why/status 는 사람이 쓰는 메모, title/lines/steps 는 미리 생성해 둔 결과
  const MEMOS = {
    "2026-43|검사 결과 CSV 내보내기": {
      why: "결과를 엑셀로 옮길 때 화면을 보고 손으로 옮겨 적음",
      status: "완료: 저장 · 필터 동작 확인",
      title: "검사 결과 CSV 내보내기 추가",
      lines: [
        "결과를 화면에서 손으로 옮겨 적던 작업 → 결과 테이블을 CSV 로 바로 저장",
        "날짜 범위 필터 · 저장 대화상자 추가 · UTF-8 BOM 으로 한글 깨짐 수정",
        "저장 · 필터 동작 확인 완료",
      ],
      steps: ["날짜 범위 선택", "결과 필터링", "CSV 저장 (UTF-8 BOM)"],
    },
    "2026-43|오토 포커스 탐색": {
      why: "초점 탐색이 전 구간을 같은 간격으로 훑어 시간이 오래 걸림",
      status: "예정: 실제 장비에서 탐색 시간 측정",
      title: "오토 포커스 2단계 탐색 개발",
      lines: [
        "전 구간을 같은 간격으로 훑던 초점 탐색 → 선명도 점수 기반 2단계 탐색으로 변경",
        "영상 선명도 점수 계산 · 거친 탐색 후 최고점 주변만 세밀 탐색",
        "실제 장비에서 탐색 시간 측정 예정",
      ],
      steps: ["선명도 점수 계산", "거친 탐색", "최고점 주변 세밀 탐색", "초점 위치 확정"],
    },
    "2026-43|빌드 스크립트": {
      why: "릴리스마다 빌드 · 복사 · 압축을 손으로 반복",
      status: "완료: 릴리스 패키지 생성 확인",
      title: "릴리스 빌드 스크립트 추가",
      lines: [
        "릴리스마다 빌드 · 복사 · 압축을 손으로 반복하던 작업을 스크립트 하나로 묶음",
        "릴리스 빌드 단계 통합 · 버전 번호 자동 증가 추가",
        "릴리스 패키지 생성 확인 완료",
      ],
      steps: ["빌드", "파일 복사 · 압축", "버전 번호 증가"],
    },
    "2026-44|다크 테마": {
      why: "야간 라인에서 밝은 화면이 눈부시다는 요청",
      status: "완료: 주요 화면 3개 적용",
      title: "결과 화면 다크 테마 추가",
      lines: [
        "야간 라인에서 밝은 화면이 눈부시다는 요청 → 다크 테마 추가",
        "색상 팔레트 분리 (ResourceDictionary) · 차트 · 표 색상 적용 · 설정에서 테마 전환",
        "주요 화면 3개 적용 완료",
      ],
      steps: ["색상 팔레트 분리", "차트 · 표 색상 적용", "설정에서 테마 전환"],
    },
    "2026-44|이력 검색": {
      why: "이력이 쌓이면서 검색 한 번에 수 초씩 걸림",
      status: "확인: 1년치 합성 데이터로 조회 시간 비교 중",
      title: "검사 이력 검색 방식 개선",
      lines: [
        "이력이 쌓이면서 검색 한 번에 수 초씩 걸리던 문제 → 조회 방식 변경",
        "날짜 · 모델 인덱스 추가 · 전체 조회 → 페이지 단위 조회",
        "1년치 합성 데이터로 조회 시간 비교 중",
      ],
      steps: ["날짜 · 모델 인덱스", "페이지 단위 조회", "조회 시간 비교"],
    },
    "2026-44|오토 포커스 탐색": {
      why: "선명도 점수가 낮으면 잘못된 위치에서 멈춤",
      status: "예정: 실제 장비 검증",
      title: "오토 포커스 실패 처리 추가",
      lines: [
        "선명도 점수가 낮을 때 잘못된 위치에서 멈추는 문제 대응",
        "최고 점수가 기준 미달이면 범위를 넓혀 재시도 · 재시도 후에도 실패하면 알람",
        "실제 장비 검증 예정",
      ],
      steps: ["최고 점수 판정", "범위 넓혀 재시도", "실패 시 알람"],
    },
    "2026-45|PDF 보고서": {
      why: "매일 아침 회의용 요약을 손으로 만듦",
      status: "완료: 일별 요약 출력 · 예정: 주간 요약",
      title: "일별 PDF 보고서 출력 추가",
      lines: [
        "매일 아침 회의용 요약을 손으로 만들던 작업 → PDF 보고서로 출력",
        "일별 요약 템플릿 · 불량 상위 5개 표 · 인쇄 여백 수정",
        "일별 요약 출력 완료 · 주간 요약 예정",
      ],
      steps: ["일별 요약 템플릿", "불량 상위 5개 표", "인쇄 여백 정리"],
    },
    "2026-45|로그 정리": {
      why: "로그가 쌓여 디스크가 가득 차는 일이 있었음",
      status: "완료: 압축 · 경고 동작 확인",
      title: "오래된 로그 자동 정리",
      lines: [
        "로그가 쌓여 디스크가 가득 차던 문제 대응",
        "30일 지난 로그 자동 압축 · 디스크 여유 공간 경고 추가",
        "압축 · 경고 동작 확인 완료",
      ],
      steps: ["30일 지난 로그 찾기", "자동 압축", "여유 공간 경고"],
    },
    "2026-45|영상 뷰어": {
      why: "작은 결함을 보려면 영상을 따로 저장해 열어야 했음",
      status: "완료: 확대 · 이동 · 픽셀 값 표시",
      title: "영상 뷰어 확대 · 이동 추가",
      lines: [
        "작은 결함을 보려면 영상을 따로 저장해 열어야 하던 번거로움 해소",
        "마우스 휠 확대 · 드래그 이동 · 커서 위치 픽셀 값 표시",
        "확대 · 이동 · 픽셀 값 표시 완료",
      ],
      steps: ["휠 확대", "드래그 이동", "픽셀 값 표시"],
    },
    "2026-46|PDF 보고서": {
      why: "주간 회의에도 같은 요약이 필요",
      status: "완료: 주간 요약 페이지 · 예정: 자동 메일 발송 검토",
      title: "PDF 보고서 주간 요약 추가",
      lines: [
        "주간 회의용 요약도 같은 PDF 보고서에서 출력",
        "주간 요약 페이지 추가 · 그래프 축 단위 표시",
        "주간 요약 페이지 완료 · 자동 메일 발송 검토 예정",
      ],
      steps: ["주간 요약 페이지", "그래프 축 단위", "자동 메일 발송 (검토)"],
    },
    "2026-46|오토 포커스 탐색": {
      why: "모델마다 초점 위치가 달라 탐색 범위를 고정값으로 쓰기 어려움",
      status: "예정: 모델 3종 장비 검증",
      title: "오토 포커스 모델별 범위 설정",
      lines: [
        "모델마다 다른 초점 위치 → 탐색 범위를 모델별로 설정",
        "모델별 탐색 시작 · 끝 위치 설정 · 설정 화면에 항목 추가",
        "모델 3종 장비 검증 예정",
      ],
      steps: ["모델 선택", "탐색 범위 불러오기", "범위 안에서 2단계 탐색"],
    },
    // "README 설치 방법 갱신" 은 메모 없이 둔다 → 규칙 기반 요약 · 제외(skip) 를 보여주는 예
  };

  const api = { LOG, CONFIG, MEMOS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.WR_SAMPLE = api;
})(typeof window !== "undefined" ? window : globalThis);
