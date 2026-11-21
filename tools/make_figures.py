"""포트폴리오 프로젝트 그림 생성기.

모든 그림은 합성 데이터에 실제 처리(FFT 각도 추정, 템플릿 매칭, 오버샘플링, 밴드 마스크)를
돌린 결과다. 사내 영상 · 설계 데이터는 쓰지 않는다.

실행: python tools/make_figures.py   (numpy, opencv-python, pillow 필요)
출력: assets/img/fig-*.webp
"""
import math
import os

import cv2
import numpy as np

OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "img")
ACCENT = (214, 98, 47)  # BGR, 사이트 강조색 #2f62d6
RNG = np.random.default_rng(7)


def save(name, img):
    cv2.imwrite(os.path.join(OUT, name), img, [cv2.IMWRITE_WEBP_QUALITY, 82])


def noisy(gray, sigma=6.0, stripes=0.0):
    """센서 잡음 + 열 방향 고정 패턴 잡음(stripes)."""
    g = gray.astype(np.float32)
    g += RNG.normal(0, sigma, g.shape)
    if stripes:
        g += RNG.normal(0, stripes, (1, g.shape[1]))
    return np.clip(g, 0, 255).astype(np.uint8)


# 1. Wafer Align: 회전된 Die 격자 → FFT 로 격자 각도 추정 → 추정 격자를 겹쳐 그림
def fig_align():
    h, w, pitch, theta = 750, 1200, 92, 1.8
    big = np.full((h * 2, w * 2), 74, np.uint8)
    for y in range(0, h * 2, pitch):
        for x in range(0, w * 2, pitch):
            cv2.rectangle(big, (x + 6, y + 6), (x + pitch - 6, y + pitch - 6), 132, -1)
            for k in range(3):
                yy = y + 22 + k * 18
                cv2.line(big, (x + 18, yy), (x + pitch - 18, yy), 112, 2)
    m = cv2.getRotationMatrix2D((w, h), theta, 1.0)
    rot = cv2.warpAffine(big, m, (w * 2, h * 2))[h // 2: h // 2 + h, w // 2: w // 2 + w]
    img = noisy(rot, sigma=7, stripes=5)

    # 격자 각도 추정: 되돌려 돌린 영상의 행 평균 프로파일이 가장 뚜렷한 각도.
    # 열 방향 고정 잡음은 행 평균에서 거의 지워져 각도를 끌고 가지 못한다.
    small = cv2.resize(img, (w // 2, h // 2)).astype(np.float32)
    c = (w // 4, h // 4)

    def sharp(a):
        r = cv2.warpAffine(small, cv2.getRotationMatrix2D(c, a, 1.0), (w // 2, h // 2))
        prof = r[h // 8: -h // 8, w // 8: -w // 8].mean(axis=1)
        return float(prof.var())

    coarse = max(np.arange(-5, 5, 0.1), key=sharp)
    best = max(np.arange(coarse - 0.1, coarse + 0.1, 0.01), key=sharp)
    est = -best  # 되돌린 각도의 반대가 격자 회전각

    out = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
    t = math.radians(est)
    ux, uy = math.cos(t), -math.sin(t)  # 회전된 x 축 (영상 좌표, y 아래)
    vx, vy = math.sin(t), math.cos(t)   # 회전된 y 축
    dx, dy = w - (w // pitch) * pitch, h - (h // pitch) * pitch  # 회전 중심과 Die 경계의 거리
    ox = w / 2 - dx * ux - dy * vx
    oy = h / 2 - dx * uy - dy * vy
    # 추정 격자는 가운데 일부 영역(4 x 3 Die)에만 그려 원본 영상이 보이게 한다
    lay = out.copy()
    for k in range(-2, 3):
        a0, a1 = ox + ux * -2 * pitch + vx * k * pitch, oy + uy * -2 * pitch + vy * k * pitch
        b0, b1 = ox + ux * 2 * pitch + vx * k * pitch, oy + uy * 2 * pitch + vy * k * pitch
        if abs(k) <= 1 or True:
            cv2.line(lay, (int(a0), int(a1)), (int(b0), int(b1)), ACCENT, 2, cv2.LINE_AA)
    for k in range(-2, 3):
        a0, a1 = ox + ux * k * pitch + vx * -2 * pitch, oy + uy * k * pitch + vy * -2 * pitch
        b0, b1 = ox + ux * k * pitch + vx * 2 * pitch, oy + uy * k * pitch + vy * 2 * pitch
        cv2.line(lay, (int(a0), int(a1)), (int(b0), int(b1)), ACCENT, 2, cv2.LINE_AA)
    for i in range(-2, 3):
        for j in range(-2, 3):
            px = ox + ux * i * pitch + vx * j * pitch
            py = oy + uy * i * pitch + vy * j * pitch
            cv2.circle(lay, (int(px), int(py)), 6, (255, 255, 255), -1, cv2.LINE_AA)
            cv2.circle(lay, (int(px), int(py)), 6, ACCENT, 2, cv2.LINE_AA)
    out = cv2.addWeighted(lay, 0.9, out, 0.1, 0)
    save("fig-align.webp", out)
    return est


# 2. 정렬 마크: 비슷한 패턴 사이 십자 마크 → 템플릿 매칭(규칙) → 상관 맵과 검출 결과
def fig_mark():
    h, w = 600, 900
    img = np.full((h, w), 96, np.uint8)
    for y in range(20, h, 60):
        for x in range(20, w, 60):
            cv2.rectangle(img, (x, y), (x + 22, y + 22), 140, -1)  # 마크와 헷갈리는 패드
    tpl = np.full((48, 48), 96, np.uint8)
    cv2.line(tpl, (24, 4), (24, 44), 210, 5)
    cv2.line(tpl, (4, 24), (44, 24), 210, 5)
    marks = [((170, 190), 0, 1.0), ((520, 330), 0, 1.0), ((760, 140), 3.2, 0.32)]
    for (x, y), blur, contrast in marks:
        m = tpl.astype(np.float32)
        m = 96 + (m - 96) * contrast
        if blur:
            m = cv2.GaussianBlur(m, (0, 0), blur)
        img[y - 24: y + 24, x - 24: x + 24] = np.clip(m, 0, 255).astype(np.uint8)
    img = noisy(img, sigma=9)

    score = cv2.matchTemplate(img, tpl, cv2.TM_CCOEFF_NORMED)
    out = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
    th = 0.7  # 규칙 판정 임계값: 흐린 마크(약 0.62)는 미달
    for (x, y), _, _ in marks:
        s = float(score[y - 24, x - 24])
        p1, p2 = (x - 30, y - 30), (x + 30, y + 30)
        if s >= th:
            cv2.rectangle(out, p1, p2, ACCENT, 2, cv2.LINE_AA)
        else:  # 규칙 점수 미달: 점선으로 표시 (보조 검출이 맡는 경우)
            for k in range(p1[0], p2[0], 10):
                cv2.line(out, (k, p1[1]), (min(k + 5, p2[0]), p1[1]), ACCENT, 2)
                cv2.line(out, (k, p2[1]), (min(k + 5, p2[0]), p2[1]), ACCENT, 2)
            for k in range(p1[1], p2[1], 10):
                cv2.line(out, (p1[0], k), (p1[0], min(k + 5, p2[1])), ACCENT, 2)
                cv2.line(out, (p2[0], k), (p2[0], min(k + 5, p2[1])), ACCENT, 2)
    heat = cv2.normalize(np.clip(score, 0, 1), None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
    heat = cv2.applyColorMap(cv2.resize(heat, (300, 200)), cv2.COLORMAP_CIVIDIS)
    cv2.rectangle(heat, (0, 0), (299, 199), (230, 230, 230), 2)
    out[h - 220: h - 20, w - 320: w - 20] = heat
    save("fig-mark.webp", out)


# 3. Recipe 자동 생성: 미세 원형 패턴을 단순 변환 vs 좌표 Snapping + Oversampling
def fig_recipe():
    n, r, cell = 8, 2.7, 7.37
    s = int(math.ceil(n * cell)) + 2

    def naive():
        # 실수 좌표를 그대로 1배 해상도에 찍음: 픽셀 위상에 따라 원이 찌그러지고 위치가 흔들림
        c = np.zeros((s, s), np.uint8)
        for i in range(n):
            for j in range(n):
                cx, cy = (i + 0.5) * cell + 0.6, (j + 0.5) * cell + 0.6
                cv2.circle(c, (int(cx * 16), int(cy * 16)), int(r * 16), 255, -1, cv2.LINE_8, 4)
        return c

    def fixed(over=8):
        # 좌표 Snapping(중심을 픽셀 격자로) + 8배 Oversampling + Threshold
        c = np.zeros((s * over, s * over), np.uint8)
        for i in range(n):
            for j in range(n):
                cx = round((i + 0.5) * cell + 0.6)
                cy = round((j + 0.5) * cell + 0.6)
                cv2.circle(c, (int(cx * over), int(cy * over)), int(r * over), 255, -1, cv2.LINE_AA)
        c = cv2.resize(c, (s, s), interpolation=cv2.INTER_AREA)
        return np.where(c > 100, 255, 0).astype(np.uint8)

    side = 420
    za = cv2.resize(naive(), (side, side), interpolation=cv2.INTER_NEAREST)
    zb = cv2.resize(fixed(), (side, side), interpolation=cv2.INTER_NEAREST)
    canvas = np.full((side + 60, side * 2 + 60), 245, np.uint8)
    canvas[30: 30 + side, 20: 20 + side] = 255 - za // 2
    canvas[30: 30 + side, 40 + side: 40 + side * 2] = 255 - zb // 2
    out = cv2.cvtColor(canvas, cv2.COLOR_GRAY2BGR)
    out[30: 30 + side, 40 + side: 40 + side * 2][zb > 0] = ACCENT
    save("fig-recipe.webp", out)


# 4. Crack 검출: Die 가장자리 검사 밴드 + 제외 Mask + 검출된 Crack
def fig_crack():
    h, w = 600, 900
    img = np.full((h, w), 70, np.uint8)
    cv2.rectangle(img, (120, 80), (w - 60, h + 40), 150, -1)  # Die
    for y in range(110, h, 34):
        cv2.line(img, (170, y), (w - 110, y), 140, 3)
    x, y = 520.0, 82.0
    pts = []
    for _ in range(40):  # 가장자리에서 안쪽으로 뻗는 Crack (random walk)
        x += RNG.normal(1.2, 2.0)
        y += abs(RNG.normal(2.6, 1.2))
        pts.append((int(x), int(y)))
    cv2.polylines(img, [np.array(pts)], False, 92, 2, cv2.LINE_AA)
    img = noisy(img, sigma=6)
    out = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)

    band = out.copy()
    cv2.rectangle(band, (120, 80), (w - 60, 200), ACCENT, -1)
    cv2.rectangle(band, (120, 80), (240, h), ACCENT, -1)
    out = cv2.addWeighted(band, 0.16, out, 0.84, 0)
    hatch = out.copy()  # 검사 제외(Mask) 영역: 밴드 안쪽 Die 내부를 빗금으로
    for k in range(-h, w + h, 22):
        cv2.line(hatch, (k, h), (k + h, 0), (110, 110, 110), 1, cv2.LINE_AA)
    inner = np.zeros((h, w), bool)
    inner[200:, 240: w - 60] = True
    out[inner] = cv2.addWeighted(hatch, 0.5, out, 0.5, 0)[inner]
    xs, ys = zip(*pts)
    cv2.rectangle(out, (min(xs) - 10, min(ys) - 10), (max(xs) + 10, max(ys) + 10), ACCENT, 2, cv2.LINE_AA)
    save("fig-crack.webp", out)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    est = fig_align()
    fig_mark()
    fig_recipe()
    fig_crack()
    assert abs(abs(est) - 1.8) < 0.2, f"격자 각도 추정이 틀림: {est}"
    print("ok, theta estimate", round(abs(est), 2))
