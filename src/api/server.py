from __future__ import annotations

import base64
import io
import json
import sqlite3
import threading
import uuid
from collections import deque
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import cv2
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from src.core.vehicle_dynamics import VehicleDynamicsAnalyzer
from src.core.multimodal_detector import MultiModalFusionEngine, DriverState
from src.data.mock_loader import ADSDataLoader
from src.utils.insurance_bridge import DrivingSession, InsuranceDataBridge
from src.utils.stakeholder_alerts import MultiStakeholderAlertSystem
from config.config import MODEL_PATH, PERCLOS_THRESHOLD, PERCLOS_WINDOW

EAR_THRESHOLD = 0.25
CONSEC_FRAMES = 20
LOW_LIGHT_LUMA_THRESHOLD = 110.0
CLAHE_CLIP_LIMIT = 2.0
CLAHE_TILE_GRID = (8, 8)
LEFT_EYE = [362, 385, 387, 263, 373, 380]
RIGHT_EYE = [33, 160, 158, 133, 153, 144]


class AnalyzeFrameRequest(BaseModel):
    session_id: Optional[str] = None
    image_base64: str


class AnalyzeFrameResponse(BaseModel):
    success: bool
    session_id: str
    face_detected: bool
    ear: Optional[float]
    frame_count_below_threshold: int
    drowsy: bool
    status: str
    perclos: float = 0.0
    risk_score: float = 0.0
    yaw: float = 0.0
    pitch: float = 0.0
    roll: float = 0.0
    mar: float = 0.0
    blink_rate: float = 0.0
    attention_score: float = 0.0
    cognitive_load: float = 0.0
    intoxication_score: float = 0.0
    distraction_score: float = 0.0
    yawn_score: float = 0.0
    driver_state: str = "Ready"
    detection_path: str = "raw"
    latency_ms: float = 0.0
    estimated_fps: float = 0.0
    state_duration_sec: float = 0.0
    landmarks: List[List[float]] = []


class UploadAnalyticsRequest(BaseModel):
    csv_content: str


class AlertSettingsUpdateRequest(BaseModel):
    alert_config: Optional[dict] = None
    stakeholder_config: Optional[dict] = None


class FaceSessionState:
    def __init__(self) -> None:
        now = datetime.now(timezone.utc)
        self.created_at = now
        self.last_update = now
        self.frame_count_below_threshold = 0
        self.analyzed_frames = 0
        self.drowsy_events = 0
        self.last_ear: Optional[float] = None
        self.last_perclos: float = 0.0
        self.last_risk: float = 0.0
        self.last_yaw: float = 0.0
        self.last_pitch: float = 0.0
        self.last_roll: float = 0.0
        self.last_mar: float = 0.0
        self.last_blink_rate: float = 0.0
        self.last_attention_score: float = 0.0
        self.last_cognitive_load: float = 0.0
        self.last_intoxication_score: float = 0.0
        self.last_distraction_score: float = 0.0
        self.last_yawn_score: float = 0.0
        self.last_detection_path: str = "raw"
        self.last_latency_ms: float = 0.0
        self.estimated_fps: float = 0.0
        self.last_status = "Ready"
        self.state_since = now
        self.closed_history: deque = deque(maxlen=PERCLOS_WINDOW)


class AnalyticsHistoryStore:
    def __init__(self, db_path: Path) -> None:
        self._db_path = db_path
        self._lock = threading.Lock()
        self._db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self._db_path))
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS analytics_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    created_at TEXT NOT NULL,
                    source TEXT NOT NULL,
                    scenario TEXT,
                    duration_sec INTEGER,
                    samples INTEGER NOT NULL,
                    steering_entropy REAL NOT NULL,
                    speed_variability REAL NOT NULL,
                    risk_score REAL NOT NULL,
                    risk_level TEXT NOT NULL,
                    warnings_json TEXT NOT NULL
                )
                """
            )
            conn.commit()

    def save_report(self, source: str, report: dict) -> None:
        metrics = report.get("metrics", {})
        warnings = metrics.get("warnings", [])
        created_at = datetime.now(timezone.utc).isoformat()

        with self._lock:
            with self._connect() as conn:
                conn.execute(
                    """
                    INSERT INTO analytics_history (
                        created_at, source, scenario, duration_sec, samples,
                        steering_entropy, speed_variability, risk_score, risk_level,
                        warnings_json
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        created_at,
                        source,
                        report.get("scenario"),
                        report.get("duration_sec"),
                        int(report.get("samples", 0)),
                        float(metrics.get("steering_entropy", 0.0)),
                        float(metrics.get("speed_variability", 0.0)),
                        float(metrics.get("risk_score", 0.0)),
                        str(metrics.get("risk_level", "UNKNOWN")),
                        json.dumps(warnings),
                    ),
                )
                conn.commit()

    def list_history(self, limit: int = 20) -> List[dict]:
        safe_limit = max(1, min(int(limit), 200))
        with self._lock:
            with self._connect() as conn:
                rows = conn.execute(
                    """
                    SELECT id, created_at, source, scenario, duration_sec, samples,
                           steering_entropy, speed_variability, risk_score, risk_level,
                           warnings_json
                    FROM analytics_history
                    ORDER BY id DESC
                    LIMIT ?
                    """,
                    (safe_limit,),
                ).fetchall()

        history: List[dict] = []
        for row in rows:
            history.append(
                {
                    "id": row["id"],
                    "created_at": row["created_at"],
                    "source": row["source"],
                    "scenario": row["scenario"],
                    "duration_sec": row["duration_sec"],
                    "samples": row["samples"],
                    "steering_entropy": row["steering_entropy"],
                    "speed_variability": row["speed_variability"],
                    "risk_score": row["risk_score"],
                    "risk_level": row["risk_level"],
                    "warnings": json.loads(row["warnings_json"] or "[]"),
                }
            )
        return history


class DrowsinessEngine:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._sessions: Dict[str, FaceSessionState] = {}
        self._landmarker = None
        self._init_error: Optional[str] = None
        self._fusion_engine = MultiModalFusionEngine()
        try:
            model_path = Path(MODEL_PATH)
            if not model_path.is_absolute():
                model_path = Path(__file__).resolve().parents[2] / model_path
            if not model_path.exists():
                raise FileNotFoundError(f"Model not found: {model_path}")

            base_options = python.BaseOptions(model_asset_path=str(model_path))
            options = vision.FaceLandmarkerOptions(
                base_options=base_options,
                output_face_blendshapes=False,
                output_facial_transformation_matrixes=False,
                num_faces=1,
            )
            self._landmarker = vision.FaceLandmarker.create_from_options(options)
        except Exception as exc:  # noqa: BLE001
            self._init_error = f"Failed to initialize FaceLandmarker: {exc}"

    @staticmethod
    def _distance(p1: Tuple[float, float], p2: Tuple[float, float]) -> float:
        return float(np.linalg.norm(np.array(p1) - np.array(p2)))

    def _calculate_ear(self, landmarks: List[Tuple[int, int]], eye_indices: List[int]) -> float:
        p1, p2 = landmarks[eye_indices[1]], landmarks[eye_indices[5]]
        p3, p4 = landmarks[eye_indices[2]], landmarks[eye_indices[4]]
        p5, p6 = landmarks[eye_indices[0]], landmarks[eye_indices[3]]

        vertical1 = self._distance(p1, p4)
        vertical2 = self._distance(p2, p5)
        horizontal = self._distance(p3, p6)

        if horizontal == 0:
            return 0.0
        return float((vertical1 + vertical2) / (2.0 * horizontal))

    @staticmethod
    def _estimate_head_pose(landmarks: List[Tuple[int, int]]) -> Tuple[float, float]:
        try:
            nose = landmarks[1]
            chin = landmarks[152]
            left_eye_outer = landmarks[263]
            right_eye_outer = landmarks[33]

            face_width = np.linalg.norm(np.array(left_eye_outer) - np.array(right_eye_outer))
            if face_width == 0:
                return 0.0, 0.0

            eye_mid_x = (left_eye_outer[0] + right_eye_outer[0]) / 2.0
            eye_mid_y = (left_eye_outer[1] + right_eye_outer[1]) / 2.0

            yaw = ((nose[0] - eye_mid_x) / face_width) * 200.0
            eye_to_nose = np.linalg.norm(np.array([eye_mid_x, eye_mid_y]) - np.array(nose))
            nose_to_chin = np.linalg.norm(np.array(nose) - np.array(chin))
            if nose_to_chin == 0:
                return float(yaw), 0.0
            ratio = eye_to_nose / nose_to_chin
            pitch = (ratio - 0.65) * 100.0
            return float(yaw), float(pitch)
        except Exception:
            return 0.0, 0.0

    @staticmethod
    def _sample_landmarks(face_landmarks: List[Tuple[int, int]]) -> List[List[float]]:
        keypoints = [33, 133, 263, 362, 1, 152, 61, 291, 199, 9]
        points: List[List[float]] = []
        for idx in keypoints:
            if idx < len(face_landmarks):
                x, y = face_landmarks[idx]
                points.append([float(x), float(y)])
        return points

    @staticmethod
    def _decode_base64_image(data: str) -> np.ndarray:
        if "," in data:
            data = data.split(",", 1)[1]

        try:
            raw = base64.b64decode(data)
        except Exception as exc:  # noqa: BLE001
            raise ValueError("Invalid base64 image payload") from exc

        np_arr = np.frombuffer(raw, np.uint8)
        image = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        if image is None:
            raise ValueError("Unable to decode image bytes")

        return image

    @staticmethod
    def _enhance_low_light(image_bgr: np.ndarray) -> Tuple[np.ndarray, bool]:
        """Apply CLAHE on luminance channel when frame is dark."""
        gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
        mean_luma = float(np.mean(gray))
        if mean_luma >= LOW_LIGHT_LUMA_THRESHOLD:
            return image_bgr, False

        lab = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2LAB)
        l_channel, a_channel, b_channel = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=CLAHE_CLIP_LIMIT, tileGridSize=CLAHE_TILE_GRID)
        l_enhanced = clahe.apply(l_channel)
        enhanced_lab = cv2.merge((l_enhanced, a_channel, b_channel))
        return cv2.cvtColor(enhanced_lab, cv2.COLOR_LAB2BGR), True

    def analyze(self, session_id: str, image_base64: str) -> AnalyzeFrameResponse:
        started = datetime.now(timezone.utc)
        if self._landmarker is None:
            latency_ms = (datetime.now(timezone.utc) - started).total_seconds() * 1000.0
            return AnalyzeFrameResponse(
                success=False,
                session_id=session_id,
                face_detected=False,
                ear=None,
                frame_count_below_threshold=0,
                drowsy=False,
                status=f"Engine Unavailable: {self._init_error}",
                perclos=0.0,
                risk_score=0.0,
                yaw=0.0,
                pitch=0.0,
                roll=0.0,
                mar=0.0,
                blink_rate=0.0,
                attention_score=0.0,
                cognitive_load=0.0,
                intoxication_score=0.0,
                distraction_score=0.0,
                yawn_score=0.0,
                driver_state="Unavailable",
                detection_path="raw",
                latency_ms=round(latency_ms, 2),
                estimated_fps=0.0,
                state_duration_sec=0.0,
                landmarks=[],
            )

        original_bgr = self._decode_base64_image(image_base64)
        enhanced_bgr, low_light_applied = self._enhance_low_light(original_bgr)

        with self._lock:
            if session_id not in self._sessions:
                self._sessions[session_id] = FaceSessionState()

            session = self._sessions[session_id]

            active_bgr = enhanced_bgr
            detection_path = "enhanced_clahe" if low_light_applied else "raw"
            image_rgb = cv2.cvtColor(active_bgr, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=image_rgb)
            detection_result = self._landmarker.detect(mp_image)

            # CLAHE helps in many dark scenes, but can over-amplify noise.
            # Fallback to raw frame if enhanced frame yields no face.
            if not detection_result.face_landmarks and enhanced_bgr is not original_bgr:
                active_bgr = original_bgr
                detection_path = "raw_fallback"
                image_rgb = cv2.cvtColor(active_bgr, cv2.COLOR_BGR2RGB)
                mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=image_rgb)
                detection_result = self._landmarker.detect(mp_image)

            if not detection_result.face_landmarks:
                session.frame_count_below_threshold = 0
                session.analyzed_frames += 1
                now = datetime.now(timezone.utc)
                elapsed = (now - session.created_at).total_seconds()
                session.estimated_fps = (session.analyzed_frames / elapsed) if elapsed > 0 else 0.0
                session.last_latency_ms = (now - started).total_seconds() * 1000.0
                if session.last_status != "No Face":
                    session.state_since = now
                session.last_status = "No Face"
                session.last_update = now
                return AnalyzeFrameResponse(
                    success=True,
                    session_id=session_id,
                    face_detected=False,
                    ear=None,
                    frame_count_below_threshold=0,
                    drowsy=False,
                    status="No Face",
                    perclos=session.last_perclos,
                    risk_score=session.last_risk,
                    yaw=session.last_yaw,
                    pitch=session.last_pitch,
                    roll=session.last_roll,
                    mar=session.last_mar,
                    blink_rate=session.last_blink_rate,
                    attention_score=session.last_attention_score,
                    cognitive_load=session.last_cognitive_load,
                    intoxication_score=session.last_intoxication_score,
                    distraction_score=session.last_distraction_score,
                    yawn_score=session.last_yawn_score,
                    driver_state="No Face",
                    detection_path=detection_path,
                    latency_ms=round(session.last_latency_ms, 2),
                    estimated_fps=round(session.estimated_fps, 2),
                    state_duration_sec=round((now - session.state_since).total_seconds(), 2),
                    landmarks=[],
                )

            face_landmarks = detection_result.face_landmarks[0]
            h, w, _ = active_bgr.shape
            landmarks = [(int(l.x * w), int(l.y * h)) for l in face_landmarks]

            fused_state, fused_metrics = self._fusion_engine.process_frame(landmarks, active_bgr.shape)
            ear = float(fused_metrics.ear)
            perclos = float(fused_metrics.perclos)
            pitch, yaw, roll = fused_metrics.head_pose
            mar = float(fused_metrics.mar)
            blink_rate = float(fused_metrics.blink_rate)
            attention_score = float(fused_metrics.attention_score)
            cognitive_load = float(fused_metrics.cognitive_load)

            signals = fused_metrics.signals or {}
            intoxication_score = float(
                np.clip(
                    (
                        signals.get("head_pose_drift", 0)
                        + signals.get("gaze_stability", 0)
                        + signals.get("blink_pattern", 0)
                        + signals.get("steering_instability", 0)
                    )
                    / 12.0,
                    0.0,
                    1.0,
                )
            )
            distraction_score = float(np.clip(signals.get("distraction", 0) / 3.0, 0.0, 1.0))
            yawn_score = float(np.clip(signals.get("yawning", 0) / 3.0, 0.0, 1.0))

            risk_score = float(np.clip(fused_metrics.confidence, 0.0, 1.0))
            status = str(fused_state.value)
            drowsy = fused_state in {DriverState.DROWSY, DriverState.ASLEEP, DriverState.HIGH_RISK}

            if ear < EAR_THRESHOLD:
                session.frame_count_below_threshold += 1
                session.closed_history.append(1)
            else:
                session.frame_count_below_threshold = 0
                session.closed_history.append(0)

            # Keep legacy micro-sleep condition as a hard safety override.
            if session.frame_count_below_threshold >= CONSEC_FRAMES and not drowsy:
                drowsy = True
                status = "Drowsy"
                risk_score = max(risk_score, 0.7)

            now = datetime.now(timezone.utc)
            session.analyzed_frames += 1
            session.last_ear = ear
            session.last_perclos = perclos
            session.last_risk = risk_score
            session.last_yaw = yaw
            session.last_pitch = pitch
            session.last_roll = roll
            session.last_mar = mar
            session.last_blink_rate = blink_rate
            session.last_attention_score = attention_score
            session.last_cognitive_load = cognitive_load
            session.last_intoxication_score = intoxication_score
            session.last_distraction_score = distraction_score
            session.last_yawn_score = yawn_score
            session.last_detection_path = detection_path
            elapsed = (now - session.created_at).total_seconds()
            session.estimated_fps = (session.analyzed_frames / elapsed) if elapsed > 0 else 0.0
            session.last_latency_ms = (now - started).total_seconds() * 1000.0
            if session.last_status != status:
                session.state_since = now
            session.last_status = status
            session.last_update = now
            if drowsy:
                session.drowsy_events += 1

            return AnalyzeFrameResponse(
                success=True,
                session_id=session_id,
                face_detected=True,
                ear=round(ear, 4),
                frame_count_below_threshold=session.frame_count_below_threshold,
                drowsy=drowsy,
                status=status,
                perclos=round(perclos, 4),
                risk_score=round(risk_score, 4),
                yaw=round(yaw, 2),
                pitch=round(pitch, 2),
                roll=round(roll, 2),
                mar=round(mar, 4),
                blink_rate=round(blink_rate, 2),
                attention_score=round(attention_score, 4),
                cognitive_load=round(cognitive_load, 4),
                intoxication_score=round(intoxication_score, 4),
                distraction_score=round(distraction_score, 4),
                yawn_score=round(yawn_score, 4),
                driver_state=status,
                detection_path=detection_path,
                latency_ms=round(session.last_latency_ms, 2),
                estimated_fps=round(session.estimated_fps, 2),
                state_duration_sec=round((now - session.state_since).total_seconds(), 2),
                landmarks=self._sample_landmarks(landmarks),
            )

    def get_session_summary(self, session_id: str) -> Optional[dict]:
        with self._lock:
            session = self._sessions.get(session_id)
            if not session:
                return None

            return {
                "session_id": session_id,
                "created_at": session.created_at.isoformat(),
                "last_update": session.last_update.isoformat(),
                "analyzed_frames": session.analyzed_frames,
                "frame_count_below_threshold": session.frame_count_below_threshold,
                "drowsy_events": session.drowsy_events,
                "last_ear": session.last_ear,
                "last_perclos": session.last_perclos,
                "last_risk": session.last_risk,
                "last_yaw": session.last_yaw,
                "last_pitch": session.last_pitch,
                "last_roll": session.last_roll,
                "last_mar": session.last_mar,
                "last_blink_rate": session.last_blink_rate,
                "last_attention_score": session.last_attention_score,
                "last_cognitive_load": session.last_cognitive_load,
                "last_intoxication_score": session.last_intoxication_score,
                "last_distraction_score": session.last_distraction_score,
                "last_yawn_score": session.last_yawn_score,
                "last_detection_path": session.last_detection_path,
                "last_latency_ms": session.last_latency_ms,
                "estimated_fps": session.estimated_fps,
                "last_status": session.last_status,
                "state_duration_sec": (session.last_update - session.state_since).total_seconds(),
            }

    def list_recent_sessions(self, limit: int = 20) -> List[dict]:
        safe_limit = max(1, min(int(limit), 200))
        with self._lock:
            rows = []
            for sid, s in self._sessions.items():
                rows.append(
                    {
                        "session_id": sid,
                        "created_at": s.created_at.isoformat(),
                        "last_update": s.last_update.isoformat(),
                        "analyzed_frames": s.analyzed_frames,
                        "drowsy_events": s.drowsy_events,
                        "last_ear": s.last_ear,
                        "last_perclos": s.last_perclos,
                        "last_risk": s.last_risk,
                        "last_latency_ms": s.last_latency_ms,
                        "estimated_fps": s.estimated_fps,
                        "last_status": s.last_status,
                    }
                )
            rows.sort(key=lambda r: r["last_update"], reverse=True)
            return rows[:safe_limit]


engine = DrowsinessEngine()
app = FastAPI(title="Safe Motion API", version="1.0.0")
vehicle_analyzer = VehicleDynamicsAnalyzer(sample_rate_hz=10)
history_store = AnalyticsHistoryStore(Path(__file__).resolve().parents[2] / "data" / "safe_motion.db")
insurance_bridge = InsuranceDataBridge(driver_id="SAFE_MOTION_DRIVER")
insurance_api_key = insurance_bridge.generate_api_key("safe-motion-web")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict:
    return {
        "ok": True,
        "service": "safe-motion-api",
        "face_model_available": engine._landmarker is not None,
        "face_model_error": engine._init_error,
    }


@app.get("/api/config")
def config() -> dict:
    return {
        "ear_threshold": EAR_THRESHOLD,
        "consecutive_frames": CONSEC_FRAMES,
        "perclos_threshold": PERCLOS_THRESHOLD,
    }


@app.post("/api/analyze-frame", response_model=AnalyzeFrameResponse)
def analyze_frame(payload: AnalyzeFrameRequest) -> AnalyzeFrameResponse:
    session_id = payload.session_id or str(uuid.uuid4())

    try:
        return engine.analyze(session_id, payload.image_base64)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Analysis failed: {exc}") from exc


@app.get("/api/session/{session_id}")
def session_summary(session_id: str) -> dict:
    summary = engine.get_session_summary(session_id)
    if not summary:
        raise HTTPException(status_code=404, detail="Session not found")
    return summary


@app.get("/api/analytics/live-sessions")
def live_sessions(limit: int = 20) -> dict:
    return {"sessions": engine.list_recent_sessions(limit=limit)}


def _analytics_payload_from_df(df: pd.DataFrame) -> dict:
    required = {"timestamp", "steering_angle", "speed_kmh"}
    if not required.issubset(set(df.columns)):
        missing = sorted(list(required - set(df.columns)))
        raise ValueError(f"Missing required columns: {', '.join(missing)}")

    metrics = vehicle_analyzer.analyze(
        steering_angles=df["steering_angle"].to_numpy(),
        speed_kmh=df["speed_kmh"].to_numpy(),
    )

    return {
        "samples": len(df),
        "series": {
            "timestamp": df["timestamp"].round(3).tolist(),
            "steering_angle": df["steering_angle"].round(4).tolist(),
            "speed_kmh": df["speed_kmh"].round(4).tolist(),
        },
        "metrics": {
            "steering_entropy": round(metrics.steering_entropy, 4),
            "speed_variability": round(metrics.speed_variability, 4),
            "risk_score": round(metrics.risk_score, 4),
            "risk_level": metrics.risk_level,
            "is_valid": metrics.is_valid,
            "warnings": metrics.warnings,
        },
    }


@app.post("/api/analytics/upload")
def analytics_upload(payload: UploadAnalyticsRequest) -> dict:
    if not payload.csv_content.strip():
        raise HTTPException(status_code=400, detail="CSV content cannot be empty")

    try:
        file_like = io.StringIO(payload.csv_content)
        df = ADSDataLoader.load_csv(file_like)
        if df.empty:
            raise ValueError("Unable to parse CSV or CSV is empty")

        report = _analytics_payload_from_df(df)
        report["scenario"] = "uploaded_csv"
        report["duration_sec"] = None
        history_store.save_report("upload", report)
        return report
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Upload analysis failed: {exc}") from exc


@app.get("/api/analytics/history")
def analytics_history(limit: int = 20) -> dict:
    return {"history": history_store.list_history(limit=limit)}


def _session_duration_minutes(session: dict) -> float:
    try:
        start = datetime.fromisoformat(session["created_at"])
        end = datetime.fromisoformat(session["last_update"])
        return max(0.0, (end - start).total_seconds() / 60.0)
    except Exception:
        return 0.0


def _sync_insurance_sessions() -> List[dict]:
    raw_sessions = engine.list_recent_sessions(limit=200)
    insurance_bridge.sessions = []

    for s in raw_sessions:
        duration_minutes = _session_duration_minutes(s)
        start_ts = datetime.fromisoformat(s["created_at"]).timestamp() if s.get("created_at") else 0.0
        end_ts = datetime.fromisoformat(s["last_update"]).timestamp() if s.get("last_update") else 0.0

        driving = DrivingSession(
            session_id=s.get("session_id", "unknown"),
            start_time=start_ts,
            end_time=end_ts,
            duration_minutes=round(duration_minutes, 3),
            distance_km=0.0,
            alerts_triggered=int(s.get("drowsy_events") or 0),
            drowsy_events=int(s.get("drowsy_events") or 0),
            distraction_events=0,
            harsh_brakes=0,
            speeding_events=0,
            safety_score=0.0,
        )
        driving.safety_score = insurance_bridge.calculate_safety_score(driving)
        insurance_bridge.log_session(driving)

    return raw_sessions


@app.get("/api/insurance/overview")
def insurance_overview() -> dict:
    sessions = _sync_insurance_sessions()
    profile = insurance_bridge.get_driver_profile(insurance_api_key)
    premium = insurance_bridge.get_premium_recommendation(insurance_api_key)

    if not profile or not premium:
        return {
            "has_data": False,
            "message": "No completed monitoring sessions yet.",
            "sessions": sessions[:10],
        }

    return {
        "has_data": True,
        "profile": profile,
        "premium": premium,
        "sessions": sessions[:10],
    }


@app.get("/api/insurance/monthly")
def insurance_monthly(month: int, year: int) -> dict:
    _sync_insurance_sessions()
    summary = insurance_bridge.get_monthly_summary(insurance_api_key, month=month, year=year)
    if not summary:
        return {"has_data": False, "message": "No monthly records found."}
    return {"has_data": True, "summary": summary}


REPO_ROOT = Path(__file__).resolve().parents[2]
WEB_UI_DIR = REPO_ROOT / "web_ui"
ALARM_WAV = REPO_ROOT / "alarm.wav"
ALARM_MP3 = REPO_ROOT / "alarm.mp3"
INDEX_HTML = WEB_UI_DIR / "index.html"
ALERT_CONFIG_PATH = REPO_ROOT / "config" / "alert_config.json"
STAKEHOLDER_CONFIG_PATH = REPO_ROOT / "config" / "stakeholder_config.json"
stakeholder_alerts = MultiStakeholderAlertSystem(config_path=str(STAKEHOLDER_CONFIG_PATH))


def _load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def _write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=2)


@app.get("/api/alerts/settings")
def alerts_settings() -> dict:
    return {
        "alert_config": _load_json(ALERT_CONFIG_PATH),
        "stakeholder_config": _load_json(STAKEHOLDER_CONFIG_PATH),
    }


@app.put("/api/alerts/settings")
def update_alerts_settings(payload: AlertSettingsUpdateRequest) -> dict:
    if payload.alert_config is not None:
        _write_json(ALERT_CONFIG_PATH, payload.alert_config)
    if payload.stakeholder_config is not None:
        _write_json(STAKEHOLDER_CONFIG_PATH, payload.stakeholder_config)

    stakeholder_alerts.config = stakeholder_alerts.load_config(str(STAKEHOLDER_CONFIG_PATH))
    return {
        "ok": True,
        "alert_config": _load_json(ALERT_CONFIG_PATH),
        "stakeholder_config": _load_json(STAKEHOLDER_CONFIG_PATH),
    }


@app.get("/alarm.wav")
def alarm_wav() -> FileResponse:
    if not ALARM_WAV.exists():
        raise HTTPException(status_code=404, detail="alarm.wav not found")
    return FileResponse(str(ALARM_WAV), media_type="audio/wav")


@app.get("/alarm.mp3")
def alarm_mp3() -> FileResponse:
    if not ALARM_MP3.exists():
        raise HTTPException(status_code=404, detail="alarm.mp3 not found")
    return FileResponse(str(ALARM_MP3), media_type="audio/mpeg")


@app.get("/live")
def live_page() -> FileResponse:
    if not INDEX_HTML.exists():
        raise HTTPException(status_code=404, detail="web_ui/index.html not found")
    return FileResponse(str(INDEX_HTML), media_type="text/html")


@app.get("/analytics")
def analytics_page() -> FileResponse:
    if not INDEX_HTML.exists():
        raise HTTPException(status_code=404, detail="web_ui/index.html not found")
    return FileResponse(str(INDEX_HTML), media_type="text/html")


@app.get("/insurance")
def insurance_page() -> FileResponse:
    if not INDEX_HTML.exists():
        raise HTTPException(status_code=404, detail="web_ui/index.html not found")
    return FileResponse(str(INDEX_HTML), media_type="text/html")


@app.get("/alert-settings")
@app.get("/alerts")
def alert_settings_page() -> FileResponse:
    if not INDEX_HTML.exists():
        raise HTTPException(status_code=404, detail="web_ui/index.html not found")
    return FileResponse(str(INDEX_HTML), media_type="text/html")

if WEB_UI_DIR.exists():
    # Mount static UI files at root so /styles.css and /app.js resolve correctly.
    app.mount("/", StaticFiles(directory=str(WEB_UI_DIR), html=True), name="web")
