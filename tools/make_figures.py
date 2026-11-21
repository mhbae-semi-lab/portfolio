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


# 5. Auto Focus: 높이를 바꿔 가며 잰 영상 선명도. 바닥 무늬가 약하면 곡선이 평평해져 봉우리를 못 믿는다
def fig_focus():
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    plt.rcParams["font.family"] = "Malgun Gothic"
    plt.rcParams["axes.unicode_minus"] = False

    base = RNG.normal(0, 1, (160, 160)).astype(np.float32)
    z = np.arange(-60, 61, 4)  # µm
    z0 = 6.0                    # 실제 바닥 높이

    def curve(texture):
        tex = cv2.GaussianBlur(base, (0, 0), 1.2) * texture + 128
        vals = []
        for zi in z:
            s = 0.4 + abs(zi - z0) / 9.0  # 초점에서 멀수록 흐림
            img = (cv2.GaussianBlur(tex, (0, 0), s) + RNG.normal(0, 2.2, tex.shape)).astype(np.float32)
            vals.append(cv2.Laplacian(img, cv2.CV_32F).var())
        v = np.array(vals)
        return (v - v.min()) / (v.max() - v.min())

    strong, weak = curve(40), curve(2.2)
    fig, ax = plt.subplots(figsize=(9, 6), dpi=100)
    ax.axvspan(z0 - 2, z0 + 2, color="#2f62d6", alpha=.12, lw=0)
    ax.axvline(z0, color="#2f62d6", lw=2)
    ax.plot(z, strong, color="#3a414b", lw=2.2, marker="o", ms=4, label="무늬가 뚜렷한 바닥")
    ax.plot(z, weak, color="#9aa3ae", lw=2.2, marker="o", ms=4, label="무늬가 약한 바닥")
    ax.text(z0 + 3, 1.03, "접촉 감지로 잰 높이 (±2µm)", color="#2f62d6", fontsize=13, va="bottom")
    ax.set_xlabel("높이 (µm)", fontsize=13, color="#3a414b")
    ax.set_ylabel("영상 선명도 (정규화)", fontsize=13, color="#3a414b")
    ax.set_ylim(-.05, 1.15)
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)
    for s in ("left", "bottom"):
        ax.spines[s].set_color("#c9ced6")
    ax.tick_params(colors="#687180", labelsize=11)
    ax.legend(frameon=False, fontsize=12, loc="upper left")
    fig.tight_layout()
    path = os.path.join(OUT, "_focus.png")
    fig.savefig(path, facecolor="#f4f4f4")
    plt.close(fig)
    save("fig-focus.webp", cv2.imread(path))
    os.remove(path)
    return strong, weak


# ---- 아래부터는 그림마다 따로 난수를 써서, 위 그림들의 결과를 바꾸지 않는다 ----
INK, MUTED, LINE, BLUE, PAPER = "#3a414b", "#687180", "#c9ced6", "#2f62d6", "#f4f4f4"


def _plt():
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    plt.rcParams["font.family"] = "Malgun Gothic"
    plt.rcParams["axes.unicode_minus"] = False
    return plt


def _clean(ax):
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)
    for s in ("left", "bottom"):
        ax.spines[s].set_color(LINE)
    ax.tick_params(colors=MUTED, labelsize=11)


def _save_plt(fig, name):
    plt = _plt()
    path = os.path.join(OUT, "_tmp.png")
    fig.savefig(path, facecolor=PAPER)
    plt.close(fig)
    save(name, cv2.imread(path))
    os.remove(path)


def _dashed_circle(img, c, r, color, seg=8):
    for a in range(0, 360, seg * 2):
        cv2.ellipse(img, c, (r, r), 0, a, a + seg, color, 2, cv2.LINE_AA)


# 6. 패턴 매칭 점수: 점수 맵을 자기 최소, 최대로 정규화하면 90° 돌아간 자재도 100점
def fig_score():
    rng = np.random.default_rng(11)
    plt = _plt()
    size, px, py = 240, 80, 48  # 직사각형 Die: 90° 돌면 가로, 세로 주기가 바뀐다
    pat = np.full((size, size), 84, np.float32)
    for y in range(0, size, py):
        for x in range(0, size, px):
            cv2.rectangle(pat, (x + 4, y + 4), (x + px - 5, y + py - 5), 138, -1)
            cv2.rectangle(pat, (x + 12, y + 10), (x + 46, y + 17), 205, -1)  # 방향이 있는 기준 무늬
            cv2.rectangle(pat, (x + 12, y + 10), (x + 19, y + 36), 205, -1)
    tpl = pat[30:150, 30:150].astype(np.uint8)
    shots = [np.clip(np.rot90(pat, k) + rng.normal(0, 8, pat.shape), 0, 255).astype(np.uint8) for k in (0, 1)]

    res = []
    for img in shots:
        m = cv2.matchTemplate(img, tpl, cv2.TM_CCOEFF_NORMED)
        _, peak, _, loc = cv2.minMaxLoc(m)
        old = (peak - m.min()) / (m.max() - m.min()) * 100  # 맵 자체로 정규화: 봉우리는 늘 100
        res.append((img, loc, old, max(peak, 0) * 100))

    fig = plt.figure(figsize=(9, 6), dpi=100)
    gs = fig.add_gridspec(2, 2, height_ratios=[3.3, 1], hspace=.25, wspace=.3)
    for i, (img, loc, old, new) in enumerate(res):
        ax = fig.add_subplot(gs[0, i])
        ax.imshow(img, cmap="gray", vmin=0, vmax=255)
        ax.add_patch(plt.Rectangle(loc, 120, 120, fill=False, ec=BLUE, lw=2.5))
        ax.set_title(("정상 방향", "90° 돌아간 자재")[i], fontsize=15, color=INK, pad=10)
        ax.axis("off")
        bx = fig.add_subplot(gs[1, i])
        bx.barh([1, 0], [old, new], color=["#9aa3ae", BLUE], height=.62)
        for y, v, lab in ((1, old, "기존"), (0, new, "수정")):
            bx.text(-3, y, lab, ha="right", va="center", fontsize=13, color=INK)
            bx.text(v + 2, y, f"{v:.0f}점", va="center", fontsize=13, color=INK)
        bx.set_xlim(0, 135)
        bx.axis("off")
    fig.subplots_adjust(left=.08, right=.97, top=.92, bottom=.04)
    _save_plt(fig, "fig-score.webp")
    return [(round(o), round(n)) for _, _, o, n in res]


# 7. 웨이퍼 외곽 원: 고정 파라미터는 대비가 큰 안쪽 격자 원을 잡고, 고친 파라미터는 외곽을 잡는다
def fig_hough():
    rng = np.random.default_rng(12)
    h, w, c, R = 600, 900, (450, 300), 262
    # 배경 조명이 오른쪽으로 갈수록 밝아져 외곽 원 오른쪽은 대비가 거의 없다
    img = np.tile(np.linspace(28, 112, w, dtype=np.float32), (h, 1))
    cv2.circle(img, c, R, 120, -1, cv2.LINE_AA)
    pitch = 30
    for y in range(c[1] - 240, c[1] + 240, pitch):
        for x in range(c[0] - 240, c[0] + 240, pitch):
            if all(math.hypot(px - c[0], py - c[1]) < 200 for px in (x, x + pitch) for py in (y, y + pitch)):
                cv2.rectangle(img, (x + 3, y + 3), (x + pitch - 4, y + pitch - 4), 128, -1)
    cv2.circle(img, c, 212, 182, 3, cv2.LINE_AA)  # 격자 경계 원: 외곽보다 대비가 크다
    img = np.clip(img + rng.normal(0, 5, img.shape), 0, 255).astype(np.uint8)

    def find(blur, canny, rmin, rmax, dp):
        b = cv2.GaussianBlur(img, (blur, blur), 0)
        cs = cv2.HoughCircles(b, cv2.HOUGH_GRADIENT, dp=dp, minDist=300, param1=canny, param2=30,
                              minRadius=rmin, maxRadius=rmax)
        return None if cs is None else cs[0][0]

    old = find(3, 100, 100, 400, 1)  # 고정 임계값, 넓은 반경 범위
    otsu, _ = cv2.threshold(cv2.GaussianBlur(img, (15, 15), 0), 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    new = find(15, float(otsu), int(R * .9), int(R * 1.1), 1.5)  # 큰 Blur, Otsu 임계값, 웨이퍼 크기로 좁힌 반경

    # 왼쪽 기존(점선, 안쪽 격자 원), 오른쪽 수정(실선, 외곽)
    out = np.full((600, 900, 3), (53, 47, 43), np.uint8)
    for i, (cx, cy, r) in enumerate((old, new)):
        p = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
        if i == 0:
            _dashed_circle(p, (int(cx), int(cy)), int(r), ACCENT, seg=6)
        else:
            cv2.circle(p, (int(cx), int(cy)), int(r), ACCENT, 3, cv2.LINE_AA)
        p = cv2.resize(p[:, 150:750], (420, 420), interpolation=cv2.INTER_AREA)
        out[90:510, 20 + i * 440: 440 + i * 440] = p
    save("fig-hough.webp", out)
    return old, new


# 8. 조명 보정: 세 채널에 같은 조명값을 쓰면 색이 틀어지고, 채널별 이분 탐색은 한 번 촬영으로 셋을 함께 맞춘다
def fig_rgb():
    rng = np.random.default_rng(13)
    plt = _plt()
    refl = rng.uniform(.3, .85, (4, 6, 3))
    refl[1] = np.linspace(.3, .85, 6)[:, None]  # 무채색 줄
    scene = cv2.resize(refl, (300, 200), interpolation=cv2.INTER_NEAREST)
    gain = np.array([.62, 1.0, 1.34])  # B, G, R 채널 감도 차이

    def shoot(L):
        x = np.clip(scene * gain * (np.asarray(L, float) / 255) * 1.5, 0, 1) ** (1 / 2.2)
        return np.clip(x * 255 + rng.normal(0, 2, x.shape), 0, 255).astype(np.uint8)

    target = 128
    lo, hi = 0.0, 255.0  # 기존: 조명 하나로 전체 밝기만 맞춤
    for _ in range(9):
        L = round((lo + hi) / 2)
        if np.median(shoot([L] * 3)) < target:
            lo = L
        else:
            hi = L
    before = shoot([L] * 3)

    lo, hi, hist = np.zeros(3), np.full(3, 255.0), []  # 수정: 채널별 이분 탐색
    for _ in range(9):
        L = np.round((lo + hi) / 2)
        med = np.median(shoot(L).reshape(-1, 3), axis=0)  # 한 장에서 세 채널을 함께 잰다
        hist.append(med)
        lo, hi = np.where(med < target, L, lo), np.where(med < target, hi, L)
    after = shoot(L)
    hist = np.array(hist)

    fig = plt.figure(figsize=(9, 6), dpi=100)
    gs = fig.add_gridspec(2, 2, width_ratios=[1, 1.35], wspace=.18, hspace=.3)
    for i, (img, t) in enumerate(((before, "같은 조명값"), (after, "채널별 보정"))):
        ax = fig.add_subplot(gs[i, 0])
        ax.imshow(img[:, :, ::-1])
        ax.set_title(t, fontsize=14, color=INK, pad=8)
        ax.axis("off")
    ax = fig.add_subplot(gs[:, 1])
    ax.axhline(target, color=MUTED, lw=1.2, ls="--")
    ax.text(.9, target - 3, "목표", color=MUTED, fontsize=12, va="top")
    it = np.arange(1, len(hist) + 1)
    for ch, col, lab in ((2, "#c0504d", "R"), (1, "#4e9a57", "G"), (0, BLUE, "B")):
        ax.plot(it, hist[:, ch], color=col, lw=2.2, marker="o", ms=5)
        ax.text(1.15, hist[0, ch], lab, color=col, fontsize=13, va="center")
    ax.set_xlabel("촬영 회차", fontsize=13, color=INK)
    ax.set_ylabel("채널 중앙값 밝기", fontsize=13, color=INK)
    ax.set_xticks(it)
    _clean(ax)
    fig.subplots_adjust(left=.03, right=.97, top=.93, bottom=.11)
    _save_plt(fig, "fig-rgb.webp")
    return hist[-1]


# 9. 보간 좌표 처리: 같은 영상을 좌표 반올림과 절삭으로 줄이면 작은 결함이 다르게 남는다
def fig_interp():
    rng = np.random.default_rng(14)
    h, w = 300, 450
    src = np.full((h, w), 92, np.float32) + rng.normal(0, 3, (h, w))
    for _ in range(420):  # 1~2 픽셀 크기 결함
        y, x = rng.uniform(4, h - 4), rng.uniform(4, w - 4)
        amp, s = rng.uniform(40, 75), rng.uniform(.45, .85)
        y0, x0 = int(y) - 3, int(x) - 3
        yy, xx = np.mgrid[y0:y0 + 7, x0:x0 + 7]
        src[y0:y0 + 7, x0:x0 + 7] += amp * np.exp(-((yy - y) ** 2 + (xx - x) ** 2) / (2 * s * s))
    scale = .7
    H, W = int(h * scale), int(w * scale)

    def shrink(fn):
        yi = np.clip(fn(np.arange(H) / scale), 0, h - 1).astype(int)
        xi = np.clip(fn(np.arange(W) / scale), 0, w - 1).astype(int)
        return np.clip(src[np.ix_(yi, xi)], 0, 255).astype(np.uint8)

    def detect(img):
        n, _, st, _ = cv2.connectedComponentsWithStats((img > 125).astype(np.uint8), connectivity=8)
        return st[1:, :4]

    imgs = [shrink(np.round), shrink(np.floor)]
    boxes = [detect(i) for i in imgs]
    k, cell = 42, 10  # 차이가 가장 많은 42 x 42 구간을 10배로 키워 보여준다

    def in_win(b, y, x):
        return [r for r in b if x <= r[0] < x + k - r[2] and y <= r[1] < y + k - r[3]]

    best = max(((y, x) for y in range(0, H - k, 6) for x in range(0, W - k, 6)),
               key=lambda p: abs(len(in_win(boxes[0], *p)) - len(in_win(boxes[1], *p)))
               + .01 * len(in_win(boxes[0], *p)))
    y, x = best
    out = np.full((600, 900, 3), (53, 47, 43), np.uint8)  # --fig-dark
    for i, (img, b) in enumerate(zip(imgs, boxes)):
        z = cv2.resize(img[y:y + k, x:x + k], (k * cell, k * cell), interpolation=cv2.INTER_NEAREST)
        z = cv2.cvtColor(z, cv2.COLOR_GRAY2BGR)
        for bx, by, bw, bh in in_win(b, y, x):
            p1 = ((bx - x) * cell - 3, (by - y) * cell - 3)
            p2 = ((bx - x + bw) * cell + 2, (by - y + bh) * cell + 2)
            cv2.rectangle(z, p1, p2, ACCENT, 2, cv2.LINE_AA)
        ox = 30 + i * (k * cell + 20)
        out[90:90 + k * cell, ox:ox + k * cell] = z
    save("fig-interp.webp", out)
    return len(boxes[0]), len(boxes[1])


# 10. 입자 높이 영상 AF: 초점 높이를 바꾸며 입자와 주변 네 방향 바닥의 선명도를 함께 잰다
def fig_focus_stack():
    rng = np.random.default_rng(15)
    plt = _plt()
    s, top = 200, 60  # 입자 윗면 높이 60µm, 바닥 0µm
    yy, xx = np.mgrid[0:s, 0:s]
    d = np.hypot(yy - s / 2, xx - s / 2)
    floor = cv2.GaussianBlur(rng.normal(0, 1, (s, s)).astype(np.float32), (0, 0), 1.3) * 60 + 105
    part = cv2.GaussianBlur(rng.normal(0, 1, (s, s)).astype(np.float32), (0, 0), 1.0) * 45 + 185 - d * .9
    mask = (d < 34).astype(np.float32)
    zs = [0, 15, 30, 45, 60]
    roi_p = (s // 2 - 14, s // 2 - 14, 28)
    roi_f = [(s // 2 - 14 + dx, s // 2 - 14 + dy, 28) for dx, dy in ((0, -66), (66, 0), (0, 66), (-66, 0))]

    def blur(img, dz):
        return cv2.GaussianBlur(img, (0, 0), .35 + abs(dz) / 6)

    def lap(img, r):
        x, y, n = r
        return float(cv2.Laplacian(img[y:y + n, x:x + n], cv2.CV_32F).var())

    tiles, sp, sf = [], [], []
    for z in zs:
        m = blur(mask, z - top)
        t = blur(floor, z) * (1 - m) + blur(part, z - top) * m + rng.normal(0, 1.5, (s, s))
        t = t.astype(np.float32)
        tiles.append(t)
        sp.append(lap(t, roi_p))
        sf.append(np.mean([lap(t, r) for r in roi_f]))
    sp, sf = np.array(sp) / max(sp), np.array(sf) / max(sf)

    fig = plt.figure(figsize=(10, 4.4), dpi=100)
    gs = fig.add_gridspec(2, 5, height_ratios=[3, .8], hspace=.02, wspace=.08)
    for i, (z, t) in enumerate(zip(zs, tiles)):
        ax = fig.add_subplot(gs[0, i])
        ax.imshow(np.clip(t, 0, 255), cmap="gray", vmin=0, vmax=255)
        x, y, n = roi_p
        ax.add_patch(plt.Rectangle((x, y), n, n, fill=False, ec=BLUE, lw=2))
        for x, y, n in roi_f:
            ax.add_patch(plt.Rectangle((x, y), n, n, fill=False, ec="#e8eaee", lw=1.4, ls="--"))
        ax.set_title(f"{z}µm", fontsize=13, color=INK, pad=6)
        ax.axis("off")
        bx = fig.add_subplot(gs[1, i])
        bx.barh([1, 0], [sp[i], sf[i]], color=[BLUE, "#9aa3ae"], height=.6)
        bx.set_xlim(0, 1.05)
        bx.axis("off")
    fig.text(.012, .19, "입자", color=BLUE, fontsize=12, va="center")
    fig.text(.012, .09, "바닥", color=MUTED, fontsize=12, va="center")
    fig.subplots_adjust(left=.06, right=.99, top=.9, bottom=.03)
    _save_plt(fig, "fig-focus-stack.webp")
    return zs[int(np.argmax(sp))] - zs[int(np.argmax(sf))]


# 11. 접촉 감지 AF: 하강 간격이 촘촘할수록 임계값을 넘는 순간을 실제 접촉 높이 가까이에서 잡는다
def fig_focus_contact():
    rng = np.random.default_rng(16)
    plt = _plt()
    zc, th = 73.4, 1.6

    def sig(z):
        return .2 + 3.0 / (1 + np.exp(-(z - zc) / .6))

    fig, ax = plt.subplots(figsize=(9, 5.4), dpi=100)
    zz = np.linspace(40, 100, 600)
    ax.plot(zz, sig(zz), color=LINE, lw=6, solid_capstyle="round")
    ax.axhline(th, color=MUTED, lw=1.2, ls="--")
    ax.text(41, th + .08, "감지 임계값", color=MUTED, fontsize=12)
    found = {}
    for step, col, mk in ((8.0, "#9aa3ae", "s"), (1.0, BLUE, "o")):
        z = np.arange(40, 101, step)
        v = sig(z) + rng.normal(0, .03, z.size)
        hit = z[np.argmax(v > th)]
        found[step] = hit - zc
        ax.plot(z, v, color=col, lw=0, marker=mk, ms=7 if step > 1 else 4.5, label=f"{step:g}µm 간격, 오차 +{hit - zc:.1f}µm")
        ax.axvline(hit, color=col, lw=1.6)
    ax.axvline(zc, color=INK, lw=1.2, ls=":")
    ax.text(zc - .6, 3.35, "실제 접촉", color=INK, fontsize=12, ha="right")
    ax.set_xlabel("하강 거리 (µm)", fontsize=13, color=INK)
    ax.set_ylabel("감지 신호 (상대값)", fontsize=13, color=INK)
    ax.set_ylim(0, 3.6)
    ax.legend(frameon=False, fontsize=12, loc="center right")
    _clean(ax)
    fig.tight_layout()
    _save_plt(fig, "fig-focus-contact.webp")
    return found


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    est = fig_align()
    fig_mark()
    fig_recipe()
    fig_crack()
    strong, weak = fig_focus()
    score = fig_score()
    old, new = fig_hough()
    rgb = fig_rgb()
    n_round, n_floor = fig_interp()
    dh = fig_focus_stack()
    contact = fig_focus_contact()
    print("score (old, new) per shot", score)
    print("hough old r", round(float(old[2])), "new r", round(float(new[2])))
    print("rgb final medians BGR", rgb)
    print("interp defects round", n_round, "floor", n_floor)
    print("focus stack height", dh, "contact error", contact)
    assert score[0][0] == 100 and score[1][0] == 100 and score[1][1] < score[0][1] - 30, "점수 그림이 기존 100점 고정을 재현하지 못함"
    assert abs(float(old[2]) - 212) < 12 and abs(float(new[2]) - 262) < 12, "외곽 원 그림: 기존은 안쪽, 수정은 외곽이어야 함"
    assert np.all(np.abs(rgb - 128) <= 3), "채널별 보정이 목표에 수렴하지 않음"
    assert n_round != n_floor, "보간 그림: 두 방식의 결함 수가 같음"
    assert dh == 60, "영상 AF 그림: 입자와 바닥 선명도 봉우리 차이가 실제 높이와 다름"
    assert contact[1.0] < contact[8.0], "접촉 감지 그림: 촘촘한 간격이 더 정확해야 함"
    # 뚜렷한 바닥은 봉우리가 실제 높이 근처, 약한 바닥은 곡선이 평평(봉우리 대비 주변이 높음)
    assert abs(int(np.argmax(strong)) * 4 - 60 - 6) <= 4, "뚜렷한 바닥의 선명도 봉우리가 실제 높이에서 벗어남"
    assert abs(abs(est) - 1.8) < 0.2, f"격자 각도 추정이 틀림: {est}"
    print("ok, theta estimate", round(abs(est), 2))
