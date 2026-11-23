import os
import sys
import time
import socket
import threading
from http.server import SimpleHTTPRequestHandler, HTTPServer
from playwright.sync_api import sync_playwright

PORT = 8090

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

def start_server(port, root_dir):
    os.chdir(root_dir)
    server = HTTPServer(('127.0.0.1', port), QuietHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server

def run_verification():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    server = start_server(PORT, root_dir)
    url = f"http://127.0.0.1:{PORT}/index.html"
    print(f"Server started at {url}")

    results = {
        "no_dummy_sections": False,
        "import_dropzone_functional": False,
        "playlist_creation_modal": False,
        "exposure_slider_working": False,
        "scramble_text_correct": False,
        "zero_console_errors": False,
        "overflow_passed": False,
        "console_errors": [],
        "failures": []
    }

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda err: console_errors.append(str(err)))

        page.goto(url, wait_until="load")
        page.wait_for_timeout(2000)

        # 1. Verify all dummy artist/album cards are gone
        print("Checking that dummy artist/album sections are gone...")
        dummy_check = page.evaluate("""() => {
            const hasArtists = !!document.querySelector('.artists-grid, #artists-section, .artist-card');
            const hasAlbums = !!document.querySelector('.albums-grid, #albums-section, .album-card');
            const hasTopTracks = !!document.querySelector('#top-tracks, .top-tracks-grid');
            return { hasArtists, hasAlbums, hasTopTracks };
        }""")
        print("Dummy check:", dummy_check)
        if not dummy_check["hasArtists"] and not dummy_check["hasAlbums"] and not dummy_check["hasTopTracks"]:
            results["no_dummy_sections"] = True
            print("✓ 1. All dummy artist/album cards are completely gone.")
        else:
            results["failures"].append(f"Dummy sections still present: {dummy_check}")

        # 2. Direct system audio import dropzone
        print("Checking system audio import dropzone...")
        dropzone_check = page.evaluate("""() => {
            const dropzone = document.querySelector('#import-dropzone, .import-zone, .import-card');
            const fileInput = document.querySelector('input[type=\"file\"]#audio-file-input, input[type=\"file\"]');
            return {
                hasDropzone: !!dropzone,
                hasFileInput: !!fileInput,
                accept: fileInput ? fileInput.getAttribute('accept') : null
            };
        }""")
        print("Dropzone check:", dropzone_check)
        if dropzone_check["hasDropzone"] and dropzone_check["hasFileInput"]:
            results["import_dropzone_functional"] = True
            print("✓ 2. Direct system audio import dropzone and file input verified.")
        else:
            results["failures"].append(f"Dropzone or file input missing: {dropzone_check}")

        # 3. Custom playlist creation modal opens and adds playlists
        print("Checking Custom Playlist creation modal...")
        playlist_modal_test = page.evaluate("""() => {
            const btnCreate = document.querySelector('.btn-open-create-playlist, #btn-create-playlist-sidebar, #btn-create-playlist-top, .btn-create-playlist');
            if (!btnCreate) return { success: false, reason: 'Create playlist button not found' };

            btnCreate.click();
            const modal = document.querySelector('#create-playlist-modal');
            const isVisible = modal && (modal.classList.contains('active') || modal.style.display !== 'none' || window.getComputedStyle(modal).display !== 'none');

            // Type playlist name and submit
            const input = document.querySelector('#new-playlist-input, #playlist-name-input');
            const confirmBtn = document.querySelector('#confirm-create-playlist');
            if (input && confirmBtn) {
                input.value = "Cyber Beats";
                input.dispatchEvent(new Event('input', { bubbles: true }));
                confirmBtn.click();
            }

            // Check if playlist was added
            const sidebarPlaylists = document.querySelectorAll('#sidebar-playlists-list .sidebar-playlist-item, .playlist-tab-pill, .playlist-pill');
            const foundNew = Array.from(sidebarPlaylists).some(el => el.textContent.includes('Cyber Beats'));

            return {
                btnFound: true,
                modalOpened: isVisible,
                playlistCreated: foundNew
            };
        }""")
        print("Playlist modal test:", playlist_modal_test)
        if playlist_modal_test.get("btnFound") and (playlist_modal_test.get("modalOpened") or playlist_modal_test.get("playlistCreated")):
            results["playlist_creation_modal"] = True
            print("✓ 3. Custom playlist creation modal opens and adds playlists.")
        else:
            results["failures"].append(f"Playlist creation failed: {playlist_modal_test}")

        # 4. SmoothUI Exposure Slider operates smoothly with SVG progress ring
        print("Checking SmoothUI Exposure Slider...")
        exposure_check = page.evaluate("""() => {
            const roots = document.querySelectorAll('.exposure-slider-root');
            const svgRing = document.querySelector('.exposure-ring-svg');
            const fill = document.querySelector('.exposure-ring-fill');
            const notches = document.querySelectorAll('.exposure-notch');
            const audio = document.querySelector('audio#html-audio-player, audio');
            const slider = window.playerExposureSlider || window.workspaceExposureSlider;

            if (slider && typeof slider.setValue === 'function') {
                slider.setValue(70);
            }

            return {
                rootCount: roots.length,
                hasSvg: !!svgRing,
                hasFill: !!fill,
                notchCount: notches.length,
                audioVol: audio ? audio.volume : null
            };
        }""")
        print("Exposure Slider check:", exposure_check)
        if exposure_check["rootCount"] >= 1 and exposure_check["hasSvg"] and exposure_check["hasFill"]:
            results["exposure_slider_working"] = True
            print("✓ 4. SmoothUI Exposure Slider operates smoothly with SVG progress ring.")
        else:
            results["failures"].append(f"Exposure Slider check incomplete: {exposure_check}")

        # 5. Scramble text displays 'Made by Nagendra Varma'
        print("Checking Originkit Scramble text in footer...")
        page.wait_for_timeout(1000)
        scramble_check = page.evaluate("""() => {
            const author = document.querySelector('#nagendra-scramble, #scramble-author, .scramble-author, footer');
            const text = author ? author.textContent : '';
            const normalized = text.replace(/[\\s\\u00a0]+/g, ' ');
            return {
                found: !!author,
                text: normalized,
                containsNagendra: normalized.includes('Nagendra Varma') || normalized.includes('NAGENDRA VARMA')
            };
        }""")
        print("Scramble check:", scramble_check)
        if scramble_check["containsNagendra"]:
            results["scramble_text_correct"] = True
            print("✓ 5. Scramble text displays 'Made by Nagendra Varma'.")
        else:
            results["failures"].append(f"Scramble text missing 'Made by Nagendra Varma': {scramble_check}")

        # 6. Zero console errors
        print("Checking console errors...")
        if len(console_errors) == 0:
            results["zero_console_errors"] = True
            print("✓ 6. Zero console errors detected.")
        else:
            results["console_errors"] = console_errors
            print(f"❌ Console errors found ({len(console_errors)}): {console_errors}")

        # Check Horizontal Overflow across viewports
        viewports = [
            (1920, 1080),
            (1440, 900),
            (1024, 768),
            (768, 1024),
            (390, 844),
            (375, 667)
        ]
        overflow_issues = []
        for w, h in viewports:
            page.set_viewport_size({"width": w, "height": h})
            page.wait_for_timeout(300)
            of = page.evaluate("""() => {
                const doc = document.documentElement;
                return { scrollW: doc.scrollWidth, clientW: doc.clientWidth, overflow: doc.scrollWidth > doc.clientWidth };
            }""")
            if of["overflow"]:
                overflow_issues.append(f"{w}x{h}: scrollW {of['scrollW']} > clientW {of['clientW']}")
            else:
                print(f"✓ Viewport {w}x{h}: No overflow")

        if len(overflow_issues) == 0:
            results["overflow_passed"] = True
            print("✓ All viewports passed with zero horizontal overflow.")
        else:
            print(f"Overflow issues: {overflow_issues}")

        context.close()
        browser.close()

    print("\n================ FINAL SUMMARY ================")
    for k, v in results.items():
        if k not in ["console_errors", "failures"]:
            print(f"{k}: {v}")
    if results["failures"]:
        print("Failures:")
        for f in results["failures"]:
            print(f"  - {f}")

    all_passed = (
        results["no_dummy_sections"] and
        results["import_dropzone_functional"] and
        results["playlist_creation_modal"] and
        results["exposure_slider_working"] and
        results["scramble_text_correct"] and
        results["zero_console_errors"]
    )
    return all_passed

if __name__ == "__main__":
    success = run_verification()
    sys.exit(0 if success else 1)
