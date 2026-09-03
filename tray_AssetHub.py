"""
AssetHub - 시스템 트레이 실행기
- 백그라운드에서 백엔드(FastAPI) 서버 실행 (프론트 빌드 결과물도 같은 포트로 서빙)
- 시스템 트레이 아이콘으로 상태 표시
- 우클릭 메뉴로 브라우저 열기 / 종료
"""
import subprocess
import sys
import os
import threading
import time
import webbrowser
from pathlib import Path

import pystray
from PIL import Image, ImageDraw

BASE_DIR    = Path(__file__).parent
BACKEND_DIR = BASE_DIR / "backend"
DIST_DIR    = BASE_DIR / "dist"
PYTHON      = r"c:\python314\python.exe"
PORT        = 8011
# 사내망 고정 IP에만 바인딩 — 0.0.0.0(전체 인터페이스)이나 도메인 접속은 쓰지 않는다.
# 이 PC의 IP가 바뀌면 서버가 기동되지 않으므로, 그때는 이 값을 새 IP로 고쳐야 한다.
HOST        = "192.168.0.189"
BASE_URL    = f"http://{HOST}:{PORT}"

# 실행 중인 프로세스
procs = {}


def make_icon(color="green"):
    """트레이 아이콘 이미지 생성"""
    from PIL import ImageFont
    img  = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    c = (14, 165, 233) if color == "green" else (239, 68, 68)  # sky / red
    draw.ellipse([2, 2, 62, 62], fill=c)
    # A 글자
    try:
        font = ImageFont.truetype(r"C:\Windows\Fonts\arialbd.ttf", 38)
    except Exception:
        font = ImageFont.load_default()
    bbox = draw.textbbox((0, 0), "A", font=font)
    x = (64 - (bbox[2] - bbox[0])) / 2 - bbox[0]
    y = (64 - (bbox[3] - bbox[1])) / 2 - bbox[1]
    draw.text((x, y), "A", fill="white", font=font)
    return img


def build_frontend_if_needed():
    """dist 결과물이 없으면 최초 1회 빌드 (있으면 스킵, 빠른 재시작)"""
    if DIST_DIR.exists():
        return
    subprocess.run(
        "npm run build",
        cwd=str(BASE_DIR),
        shell=True,
        creationflags=subprocess.CREATE_NO_WINDOW,
        capture_output=True,
    )


def start_servers():
    """백엔드 시작 (내부망 전용, 창 없음)"""
    runner = str(BASE_DIR / "_run_server.py")
    with open(runner, "w", encoding="utf-8") as f:
        f.write(f'''import sys, asyncio
sys.path.insert(0, r"{BACKEND_DIR}")
asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
import uvicorn
uvicorn.run("main:app", host="{HOST}", port={PORT}, log_level="warning")
''')

    procs["backend"] = subprocess.Popen(
        [PYTHON, runner],
        cwd=str(BACKEND_DIR),
        creationflags=subprocess.CREATE_NO_WINDOW,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        stdin=subprocess.DEVNULL,
    )


def stop_servers():
    """모든 서버 즉시 종료"""
    for name, proc in procs.items():
        try:
            proc.kill()  # terminate 대신 kill로 즉시 종료
        except Exception:
            pass
    try:
        subprocess.run(
            ["taskkill", "/F", "/T", "/PID", str(list(procs.values())[0].pid)],
            creationflags=subprocess.CREATE_NO_WINDOW,
            capture_output=True,
        )
    except Exception:
        pass


def open_browser(icon=None, item=None):
    webbrowser.open(BASE_URL)


def check_status():
    """서버 상태 확인 (백엔드 응답 여부)"""
    try:
        import urllib.request, urllib.error
        urllib.request.urlopen(f"{BASE_URL}/api/health", timeout=2)
        return True
    except urllib.error.HTTPError as e:
        return e.code in (401, 403)  # 서버 정상, 인증 필요 응답
    except Exception:
        return False


def quit_app(icon, item):
    stop_servers()
    icon.stop()
    os._exit(0)  # 즉시 프로세스 강제 종료


def setup_tray():
    """트레이 아이콘 설정 및 실행"""
    build_frontend_if_needed()

    start_servers()
    time.sleep(4)  # 서버 기동 대기

    webbrowser.open(BASE_URL)

    ok = check_status()
    icon_img = make_icon("green" if ok else "red")

    menu = pystray.Menu(
        pystray.MenuItem("AssetHub", None, enabled=False),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem("브라우저 열기", open_browser),
        pystray.MenuItem(f"접속주소: {HOST}:{PORT}", None, enabled=False),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem("종료", quit_app),
    )

    icon = pystray.Icon(
        name="AssetHub",
        icon=icon_img,
        title="AssetHub 실행 중",
        menu=menu,
    )

    def monitor():
        while True:
            time.sleep(10)
            try:
                ok = check_status()
                icon.icon  = make_icon("green" if ok else "red")
                if ok:
                    icon.title = f"AssetHub 실행 중\n{HOST}:{PORT}"
                else:
                    icon.title = "AssetHub - 연결 오류"
            except Exception:
                break

    t = threading.Thread(target=monitor, daemon=True)
    t.start()

    icon.run()


if __name__ == "__main__":
    setup_tray()
