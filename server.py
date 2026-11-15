import mimetypes
import os
import shutil
import subprocess
from pathlib import Path
from flask import Flask, jsonify, request, send_from_directory

# ensure 3D model MIME types resolve consistently on both Linux and Windows
mimetypes.add_type("model/gltf-binary", ".glb")
mimetypes.add_type("model/gltf+json", ".gltf")

BASE_DIR = Path(__file__).resolve().parent
BACKEND_DIR = BASE_DIR / "backend"
FRONTEND_DIR = BASE_DIR / "frontend"

IS_WINDOWS = os.name == "nt"
SOLVER_BIN = BACKEND_DIR / ("solver.exe" if IS_WINDOWS else "solver")

app = Flask(__name__, static_folder=str(FRONTEND_DIR), static_url_path="")


def needs_build() -> bool:
    if not SOLVER_BIN.exists():
        return True

    bin_mtime = SOLVER_BIN.stat().st_mtime
    sources = list(BACKEND_DIR.glob("*.cpp")) + list(BACKEND_DIR.glob("*.hpp"))
    return any(src.stat().st_mtime > bin_mtime for src in sources)


def ensure_solver_built() -> None:
    if not needs_build():
        return

    make_cmd = shutil.which("make") or shutil.which("mingw32-make")
    if not make_cmd:
        raise RuntimeError("Neither 'make' nor 'mingw32-make' was found in PATH.")

    print("Building C++ solver...")
    subprocess.run([make_cmd], cwd=BASE_DIR, check=True)


@app.get("/")
def index():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.post("/api/move")
def get_move():
    try:
        ensure_solver_built()
    except (RuntimeError, subprocess.CalledProcessError) as exc:
        return jsonify({"error": f"Build failed: {exc}"}), 500

    payload = request.get_json(force=True)
    board_flat = " ".join(str(cell) for row in payload["board"] for cell in row)
    solver_input = (
        f"{payload['algorithm']} "
        f"{payload['color']} "
        f"{payload['max_levels']} "
        f"{board_flat}\n"
    )

    try:
        result = subprocess.run(
            [str(SOLVER_BIN)],
            input=solver_input,
            text=True,
            capture_output=True,
            check=True,
            timeout=15,
        )
        stdout = result.stdout.strip()
        if not stdout:
            return jsonify({"error": "Solver returned empty output"}), 500
        return app.response_class(stdout, mimetype="application/json")
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as exc:
        return jsonify({"error": str(exc)}), 500


if __name__ == "__main__":
    ensure_solver_built()
    app.run(host="127.0.0.1", port=8000, debug=True)
