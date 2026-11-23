"""영문판 그림 생성기.

make_figures.py 를 그대로 돌리되, matplotlib 그림의 글자를 영어로 바꿔 assets/img/en/ 에 저장한다.
데이터와 계산은 한국어판과 같다 (같은 난수, 같은 검사 assert).
번역이 빠진 한글이 남으면 실패한다.

실행: python tools/make_figures_en.py
"""
import os
import re
import sys
import textwrap

import matplotlib

matplotlib.use("Agg")
from matplotlib.text import Text  # noqa: E402

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import make_figures as mf  # noqa: E402

EN = {
    "25분": "25 min", "2초": "2 s", "3.5GB, 파일 4,373개 백업 시간 (초)": "Backup time for 3.5 GB, 4,373 files (s)",
    "90° 돌아간 자재": "Wafer rotated 90°", "SonarQube 버그 (2025 상)": "SonarQube bugs (H1 2025)",
    "X 위치": "X position", "XY, Z 동시 이동": "XY and Z together", "Y 위치별 Z 보간 구동 후": "After Z interpolation by Y",
    "Z 높이": "Z height", "Z 먼저 올린 뒤 XY": "Z up first, then XY", "■ 멈춤   ": "■ stall   ", "■ 정상 시작": "■ normal start",
    "가정한 격자 회전각 (°)": "Assumed grid rotation (°)", "간섭 영역": "Interference zone",
    "감지 신호 (상대값)": "Sensing signal (relative)", "감지 임계값": "Detection threshold", "같은 조명값": "Same light level",
    "건수": "Count", "검사 전 버전 검증": "Pre-inspection version check", "검출력": "Detectability",
    "격자 일치 점수 (정규화)": "Grid match score (normalized)", "결과 파일": "Result file", "결과": "Result",
    "고해상도 시료 시인성": "High-res sample visibility", "공유 폴더": "Shared folder",
    "과검 (정상 위치에서 검출된 픽셀 수 + 1)": "Over-detection (pixels flagged at normal spots + 1)",
    "기존": "Before", "기준 영상": "Reference image", "높이 (µm)": "Height (µm)",
    "도구 3개로 나뉘어 있던 기능을 하나로": "Three separate tools merged into one", "도면에서 나눈 영역": "Regions from the drawing",
    "로그 화면을 끄면": "Log screen off", "모든 프레임을 차례로 그림": "Draw every frame in order", "목표": "Target",
    "미검률 (%)": "Miss rate (%)", "바닥": "Floor", "배선": "Wiring", "버전 저장소, 이력": "Version store, history",
    "버전 확인": "Version check", "보정 전": "Before correction", "복원, 기준 등록": "Restore, baseline",
    "블록별 밝기 편차 (%)": "Brightness deviation by block (%)", "빈 영역": "Blank",
    "빈 원: 기준 결함   채운 원: 검사 결함 (크기 = 결함 크기)   점선: 틀린 짝":
        "Hollow: reference defect   Filled: inspection defect (size = defect size)   Dashed: wrong pair",
    "서버 프로그램": "Server program", "수정": "After", "실제 접촉": "True contact",
    "연속 촬영 시간 (분)": "Continuous capture time (min)", "영상 선명도 (정규화)": "Image sharpness (normalized)",
    "왼쪽 아래로 갈수록 좋음": "Lower left is better", "요청 파일": "Request file", "요청": "Request",
    "위치만 보고 짝짓기": "Position only", "위치와 크기를 함께": "Position and size", "일괄 수정, 배포": "Batch edit, deploy",
    "임시 파일에 쓴 뒤 이름 바꾸기  ·  같은 요청은 한 번만 처리  ·  일시 오류만 재시도":
        "Write temp, then rename  ·  Each request handled once  ·  Retry transient errors only",
    "입자": "Particle", "장비 프로그램": "Tool program",
    "적외선 시료 반복성 평가 7건 (일주일)  ·  Glass 202매 평가 (2일)": "7 infrared repeatability evaluations (1 week)  ·  202 glass wafers (2 days)",
    "전송 시간 (초)": "Transfer time (s)", "접촉 감지로 잰 높이 (±2µm)": "Height by contact sensing (±2µm)",
    "정리 전": "Before", "정리 후": "After", "정상 방향": "Normal orientation",
    "정적 분석 경고 (2025 하)": "Static analysis warnings (H2 2025)", "채널 중앙값 밝기": "Channel median brightness",
    "채널별 보정": "Per-channel correction", "촬영 회차": "Shot", "최신 1장만 그림": "Draw latest frame only",
    "충돌": "Collision", "패드": "Pad", "하강 거리 (µm)": "Descent distance (µm)", "현재 영상": "Current image",
    "화면에 못 그린 프레임 (장)": "Frames not yet drawn", "무늬가 뚜렷한 바닥": "Well-textured floor",
    "무늬가 약한 바닥": "Weakly textured floor", "하나의 임계값": "Single threshold", "도면 영역별 임계값": "Region-wise thresholds",
    "복사를 비동기로 분리": "Async copy", "4분 20초": "4 min 20 s",
    "파일 이름 해시로 나눈 평가": "Split by file-name hash", "날짜 단위로 나눈 평가": "Split by date",
    "처음 보는 날짜의 실제 성능": "Real accuracy on unseen dates", "같은 분류기의 정확도 (%)": "Accuracy of the same classifier (%)",
    "기준 조건": "Baseline", "패턴 반사율 저하": "Lower pattern reflectance", "다층 (met1 + poly)": "Multilayer (met1 + poly)",
    "치명 결함 검출률 (%), 과검은 영상 1장당 1개 이하": "Killer defect detection (%), at most 1 false call per image",
    "현행 밝기 구역": "Current brightness zones", "도면 구역 + 구역별 임계값": "Drawing zones + per-zone thresholds",
    "주간 보고": "Weekly report", "설비 섹션 · 고른 슬라이드": "Tool section · chosen slides",
    "직전 Release Report": "Previous release report", "양식 · 이전 버전": "Template · previous version",
    "직전 Release Note": "Previous release note", "마지막 행 서식": "Format of the last row",
    "체크한 커밋": "Checked commits", "변경 · 추가 · 삭제": "Modified · added · deleted",
    "릴리스 묶음 도구": "Release pack builder", "슬라이드 이식 · 관계 재연결": "Move slides · relink parts",
    "버전 +1 · 날짜 · 파일명 치환": "Version +1 · date · file name", "변경 파일만 추출": "Changed files only",
    "외부 통신 없음": "No network access", "표지 · Overview · 본문": "Cover · overview · body",
    "1행 추가: No · Ver · 날짜": "One row added: No · Ver · date", "반입 폴더": "Patch folder",
}
RULES = [
    (r"^(\d+)초, 약 (\d+)MB/s$", r"\1 s, about \2 MB/s"),
    (r"^([\d.]+)µm 간격, 오차 \+([\d.]+)µm$", r"\1 µm step, error +\2 µm"),
    (r"^(\d+)점$", r"\1 pts"),
    (r"^삭제 목록: (.+)$", r"Delete on site: \1"),
    (r"^추정 ([\d.-]+)°$", r"Estimate \1°"),
    (r"^수정 전(\s+)200회 재시작 중 (\d+)회 멈춤$", r"Before fix\1\2 stalls in 200 restarts"),
    (r"^수정 후(\s+)200회 재시작 중 (\d+)회 멈춤$", r"After fix\1\2 stalls in 200 restarts"),
]
HANGUL = re.compile("[가-힣]")
missing = set()


def tr(s):
    if not isinstance(s, str) or not HANGUL.search(s):
        return s
    m = re.match(r"^(.+), 맞는 짝 (\d+)/(\d+)$", s)
    if m:
        return f"{tr(m.group(1))}, correct pairs {m.group(2)}/{m.group(3)}"
    if s in EN:
        return EN[s]
    for pat, rep in RULES:
        if re.match(pat, s):
            return re.sub(pat, rep, s)
    missing.add(s)
    return s


_orig = Text.set_text
Text.set_text = lambda self, s: _orig(self, tr(s))

if __name__ == "__main__":
    mf.OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "img", "en")
    src = open(mf.__file__, encoding="utf-8").read()
    body = src[src.index('if __name__ == "__main__":'):].split("\n", 1)[1]
    exec(textwrap.dedent(body), mf.__dict__)  # 한국어판과 같은 순서로 돌려 난수와 검사가 같다
    # 글자 없는 그림은 한국어판을 그대로 쓴다
    for name in ("fig-align", "fig-mark", "fig-recipe", "fig-crack", "fig-hough", "fig-interp", "fig-down"):
        p = os.path.join(mf.OUT, name + ".webp")
        if os.path.exists(p):
            os.remove(p)
    assert not missing, f"번역이 빠진 그림 글자: {sorted(missing)}"
    print("en figures ok")
