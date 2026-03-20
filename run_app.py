import argparse
import os
import sys
from streamlit.web import cli as stcli


def pick_default_app() -> str:
    candidates = [
        os.path.join("streamlit_app", "streamlit_app_pwa.py"),
        os.path.join("streamlit_app", "streamlit_app.py"),
        os.path.join("src", "app", "app.py"),
    ]
    for path in candidates:
        if os.path.exists(path):
            return path
    return candidates[0]


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run GuardianDrive Streamlit app")
    parser.add_argument("--app", default=pick_default_app(), help="Path to Streamlit app")
    parser.add_argument("--port", default="8501", help="Port to bind Streamlit server")
    args = parser.parse_args()

    # This keeps Streamlit bound to the same Python interpreter used for this script.
    sys.argv = ["streamlit", "run", args.app, "--server.port", str(args.port)]
    sys.exit(stcli.main())
