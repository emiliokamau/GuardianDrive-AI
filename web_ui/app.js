const API_BASE = window.SAFE_MOTION_API_BASE || "http://127.0.0.1:8000";
const API_URL = `${API_BASE}/api`;
const VOICE_API_BASE = window.VOICE_BOT_API_BASE || "http://127.0.0.1:5005";

let EAR_THRESHOLD = 0.25;
let CONSEC_FRAMES = 20;
let PERCLOS_THRESHOLD = 0.3;
const INTOXICATION_ALERT_THRESHOLD = 0.75;
const LIVE_CHART_MAX_POINTS = 90;

const liveTabBtn = document.getElementById("liveTabBtn");
const analyticsTabBtn = document.getElementById("analyticsTabBtn");
const insuranceTabBtn = document.getElementById("insuranceTabBtn");
const alertsTabBtn = document.getElementById("alertsTabBtn");
const livePane = document.getElementById("livePane");
const analyticsPane = document.getElementById("analyticsPane");
const insurancePane = document.getElementById("insurancePane");
const alertsPane = document.getElementById("alertsPane");

const toggleBtn = document.getElementById("toggleBtn");
const inputVideo = document.getElementById("inputVideo");
const overlay = document.getElementById("overlay");
const stateBadge = document.getElementById("stateBadge");
const statusText = document.getElementById("statusText");
const stateLabel = document.getElementById("stateLabel");
const alarmAudio = document.getElementById("alarmAudio");
const soundToggle = document.getElementById("soundToggle");
const voiceToggle = document.getElementById("voiceToggle");
const darkToggle = document.getElementById("darkToggle");
const exportSessionBtn = document.getElementById("exportSessionBtn");
const voiceAssistBtn = document.getElementById("voiceAssistBtn");
const voiceTranscriptEl = document.getElementById("voiceTranscript");

const earThresholdEl = document.getElementById("earThreshold");
const alertFramesEl = document.getElementById("alertFrames");
const currentEarEl = document.getElementById("currentEar");
const marMetricEl = document.getElementById("marMetric");
const perclosMetricEl = document.getElementById("perclosMetric");
const riskMetricEl = document.getElementById("riskMetric");
const yawMetricEl = document.getElementById("yawMetric");
const pitchMetricEl = document.getElementById("pitchMetric");
const blinkMetricEl = document.getElementById("blinkMetric");
const attentionMetricEl = document.getElementById("attentionMetric");
const intoxicationMetricEl = document.getElementById("intoxicationMetric");
const distractionMetricEl = document.getElementById("distractionMetric");
const yawnMetricEl = document.getElementById("yawnMetric");
const cognitiveLoadMetricEl = document.getElementById("cognitiveLoadMetric");
const fatigueActionMetricEl = document.getElementById("fatigueActionMetric");
const fatigueConfidenceMetricEl = document.getElementById("fatigueConfidenceMetric");
const fatigueModelStatusMetricEl = document.getElementById("fatigueModelStatusMetric");
const hudEarEl = document.getElementById("hudEar");
const hudPerclosEl = document.getElementById("hudPerclos");
const hudRiskEl = document.getElementById("hudRisk");
const hudYawEl = document.getElementById("hudYaw");
const hudPitchEl = document.getElementById("hudPitch");
const riskStripEl = document.getElementById("riskStrip");
const fpsMetricEl = document.getElementById("fpsMetric");
const latencyMetricEl = document.getElementById("latencyMetric");
const stateDurationMetricEl = document.getElementById("stateDurationMetric");
const fatigueActionStatEl = document.getElementById("fatigueActionStat");
const fatigueConfidenceStatEl = document.getElementById("fatigueConfidenceStat");
const framesMetricEl = document.getElementById("framesMetric");
const eventsMetricEl = document.getElementById("eventsMetric");

const apiConnectionEl = document.getElementById("apiConnection");
const monitoringBadgeEl = document.getElementById("monitoringBadge");
const sessionSummaryEl = document.getElementById("sessionSummary");

const analyzeCsvBtn = document.getElementById("analyzeCsvBtn");
const csvFileInput = document.getElementById("csvFileInput");
const refreshHistoryBtn = document.getElementById("refreshHistoryBtn");
const analyticsInfo = document.getElementById("analyticsInfo");

const entropyMetric = document.getElementById("entropyMetric");
const speedVarMetric = document.getElementById("speedVarMetric");
const riskScoreMetric = document.getElementById("riskScoreMetric");
const riskLevelMetric = document.getElementById("riskLevelMetric");

const historyTable = document.getElementById("historyTable");
const historyBody = document.getElementById("historyBody");
const historyEmpty = document.getElementById("historyEmpty");
const liveEarChartCanvas = document.getElementById("liveEarChart");
const livePerclosChartCanvas = document.getElementById("livePerclosChart");
const liveIntoxicationChartCanvas = document.getElementById("liveIntoxicationChart");
const liveRiskChartCanvas = document.getElementById("liveRiskChart");
const graphWidthRange = document.getElementById("graphWidthRange");
const graphHeightRange = document.getElementById("graphHeightRange");
const resetGraphSizeBtn = document.getElementById("resetGraphSizeBtn");

const refreshInsuranceBtn = document.getElementById("refreshInsuranceBtn");
const insTotalSessions = document.getElementById("insTotalSessions");
const insDrivingHours = document.getElementById("insDrivingHours");
const insSafetyScore = document.getElementById("insSafetyScore");
const insRiskCategory = document.getElementById("insRiskCategory");
const insAdjustedPremium = document.getElementById("insAdjustedPremium");
const insDiscount = document.getElementById("insDiscount");
const insuranceInfo = document.getElementById("insuranceInfo");
const insuranceMonthInput = document.getElementById("insuranceMonthInput");
const loadInsuranceMonthBtn = document.getElementById("loadInsuranceMonthBtn");
const insuranceSessionTable = document.getElementById("insuranceSessionTable");
const insuranceSessionBody = document.getElementById("insuranceSessionBody");

const reloadAlertSettingsBtn = document.getElementById("reloadAlertSettingsBtn");
const saveAlertSettingsBtn = document.getElementById("saveAlertSettingsBtn");
const cfgEarThreshold = document.getElementById("cfgEarThreshold");
const cfgConsecutiveFrames = document.getElementById("cfgConsecutiveFrames");
const cfgFamilyThreshold = document.getElementById("cfgFamilyThreshold");
const cfgPoliceThreshold = document.getElementById("cfgPoliceThreshold");
const cfgAmbulanceThreshold = document.getElementById("cfgAmbulanceThreshold");
const cfgAutoVerifyCritical = document.getElementById("cfgAutoVerifyCritical");
const cfgPoliceEnabled = document.getElementById("cfgPoliceEnabled");
const cfgAmbulanceEnabled = document.getElementById("cfgAmbulanceEnabled");
const alertSettingsInfo = document.getElementById("alertSettingsInfo");

let mediaStream = null;
let detectionOn = false;
let sessionId = `session-${Date.now()}`;
let requestInFlight = false;
let alarmMutedUntil = 0;
let soundEnabled = true;
let pollHandle = null;
let summaryHandle = null;
let steeringChart = null;
let speedChart = null;
let liveEarChart = null;
let livePerclosChart = null;
let liveIntoxicationChart = null;
let liveRiskChart = null;
let lastFatigueAction = "--";
let lastFatigueConfidence = "--";
let lastFatigueStatus = "--";
let lastFatigueUpdated = "--";
let voiceEnabled = false;
let voiceListening = false;
let voiceRecognition = null;
const liveTelemetry = {
  labels: [],
  ear: [],
  perclos: [],
  intoxication: [],
  risk: [],
};

const DEFAULT_GRAPH_WIDTH_CM = 9;
const DEFAULT_GRAPH_HEIGHT_CM = 5;

function setApiConnection(connected, details = "") {
  apiConnectionEl.classList.remove("connected", "disconnected");
  apiConnectionEl.classList.add(connected ? "connected" : "disconnected");
  apiConnectionEl.textContent = connected
    ? "API: Connected"
    : `API: Disconnected${details ? ` (${details})` : ""}`;
}

function setStatus(text, cssClass) {
  statusText.className = cssClass;
  statusText.textContent = text;
  stateLabel.textContent = text;
  stateBadge.textContent = `Status: ${text}`;
}

function setMonitoringBadge(state, text) {
  if (!monitoringBadgeEl) return;
  monitoringBadgeEl.classList.remove("active", "inactive", "error");
  monitoringBadgeEl.classList.add(state);
  monitoringBadgeEl.textContent = `Monitoring: ${text}`;
}

function applyGraphSize(widthCm, heightCm) {
  document.documentElement.style.setProperty("--graph-width-cm", String(widthCm));
  document.documentElement.style.setProperty("--graph-height-cm", String(heightCm));
}

function setInsuranceInfo(msg, isError = false) {
  if (!insuranceInfo) return;
  insuranceInfo.textContent = msg;
  insuranceInfo.style.color = isError ? "#ff5d73" : "#a6b0cc";
}

function setAlertSettingsInfo(msg, isError = false) {
  if (!alertSettingsInfo) return;
  alertSettingsInfo.textContent = msg;
  alertSettingsInfo.style.color = isError ? "#ff5d73" : "#a6b0cc";
}

function playAlarm() {
  if (!soundEnabled) return;
  const now = Date.now();
  if (now < alarmMutedUntil) return;
  alarmMutedUntil = now + 2500;
  alarmAudio.currentTime = 0;
  alarmAudio.play().catch(() => {});
}

function setVoiceTranscript(text) {
  if (!voiceTranscriptEl) return;
  voiceTranscriptEl.textContent = text;
}

function stopVoiceRecognition() {
  if (!voiceRecognition || !voiceListening) return;
  voiceListening = false;
  try {
    voiceRecognition.stop();
  } catch {
    // Ignore stop errors from already-stopped recognition.
  }
  if (voiceAssistBtn) voiceAssistBtn.textContent = "Hold To Talk";
}

function speakAssistantReply(text) {
  if (!voiceEnabled || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1.0;
    utter.pitch = 1.0;
    window.speechSynthesis.speak(utter);
  } catch {
    // Speech synthesis unavailable in some browsers.
  }
}

async function sendVoiceMessage(transcript) {
  if (!transcript) return;
  setVoiceTranscript(`You: ${transcript}`);

  const context = {
    driver_state: stateLabel?.textContent || "Unknown",
    fatigue_action: lastFatigueAction,
    fatigue_confidence: lastFatigueConfidence,
    fatigue_model_status: lastFatigueStatus,
  };

  try {
    const response = await fetch(`${VOICE_API_BASE}/voice/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: transcript, context }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const reply = data.reply || "Please keep your eyes on the road. I did not catch that.";
    setVoiceTranscript(`Assistant: ${reply}`);
    speakAssistantReply(reply);
  } catch (error) {
    const fallback = `Voice bot unavailable (${error.message}). Check Flask voice service.`;
    setVoiceTranscript(fallback);
    setAnalyticsInfo(fallback, true);
  }
}

function initVoiceRecognition() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    setVoiceTranscript("Speech recognition not supported in this browser.");
    return;
  }

  voiceRecognition = new Recognition();
  voiceRecognition.lang = "en-US";
  voiceRecognition.interimResults = false;
  voiceRecognition.continuous = false;

  voiceRecognition.onresult = (event) => {
    const transcript = event.results?.[0]?.[0]?.transcript?.trim() || "";
    void sendVoiceMessage(transcript);
  };

  voiceRecognition.onerror = (event) => {
    setVoiceTranscript(`Voice error: ${event.error}`);
  };

  voiceRecognition.onend = () => {
    voiceListening = false;
    if (voiceAssistBtn) voiceAssistBtn.textContent = "Hold To Talk";
  };
}

function startVoiceRecognition() {
  if (!voiceEnabled) {
    setVoiceTranscript("Enable Voice Alerts first.");
    return;
  }
  if (!voiceRecognition) {
    initVoiceRecognition();
  }
  if (!voiceRecognition || voiceListening) return;

  try {
    voiceListening = true;
    setVoiceTranscript("Listening...");
    if (voiceAssistBtn) voiceAssistBtn.textContent = "Listening...";
    voiceRecognition.start();
  } catch {
    voiceListening = false;
  }
}

async function fetchConfig() {
  try {
    const response = await fetch(`${API_URL}/config`);
    if (!response.ok) return;
    const cfg = await response.json();
    if (typeof cfg.ear_threshold === "number") EAR_THRESHOLD = cfg.ear_threshold;
    if (typeof cfg.consecutive_frames === "number") CONSEC_FRAMES = cfg.consecutive_frames;
    if (typeof cfg.perclos_threshold === "number") PERCLOS_THRESHOLD = cfg.perclos_threshold;
    earThresholdEl.textContent = EAR_THRESHOLD.toFixed(2);
    alertFramesEl.textContent = String(CONSEC_FRAMES);
  } catch {
    // Keep defaults.
  }
}

async function checkHealth() {
  try {
    const response = await fetch(`${API_URL}/health`);
    if (!response.ok) {
      setApiConnection(false, `HTTP ${response.status}`);
      return;
    }
    const data = await response.json();
    if (data.ok && data.face_model_available) {
      setApiConnection(true);
    } else {
      setApiConnection(false, data.face_model_error || "model unavailable");
    }
  } catch {
    setApiConnection(false, "server unreachable");
  }
}

function switchTab(tab) {
  const isLive = tab === "live";
  const isAnalytics = tab === "analytics";
  const isInsurance = tab === "insurance";
  const isAlerts = tab === "alerts";

  if (livePane) livePane.classList.toggle("hidden", !isLive);
  if (analyticsPane) analyticsPane.classList.toggle("hidden", !isAnalytics);
  if (insurancePane) insurancePane.classList.toggle("hidden", !isInsurance);
  if (alertsPane) alertsPane.classList.toggle("hidden", !isAlerts);

  if (liveTabBtn) liveTabBtn.classList.toggle("active", isLive);
  if (analyticsTabBtn) analyticsTabBtn.classList.toggle("active", isAnalytics);
  if (insuranceTabBtn) insuranceTabBtn.classList.toggle("active", isInsurance);
  if (alertsTabBtn) alertsTabBtn.classList.toggle("active", isAlerts);
}

function getInitialTabFromUrl() {
  const path = window.location.pathname.toLowerCase();
  if (path === "/analytics") return "analytics";
  if (path === "/insurance") return "insurance";
  if (path === "/alert-settings" || path === "/alerts") return "alerts";
  if (path === "/live" || path === "/") return "live";

  // Backward-compatible fallback for older deep links.
  const params = new URLSearchParams(window.location.search);
  const page = (params.get("page") || "live").toLowerCase();
  if (page === "insurance") return "insurance";
  if (page === "alerts") return "alerts";
  return page === "analytics" ? "analytics" : "live";
}

function tabToPath(tab) {
  if (tab === "analytics") return "/analytics";
  if (tab === "insurance") return "/insurance";
  if (tab === "alerts") return "/alert-settings";
  return "/live";
}

function navigateToTab(tab, options = {}) {
  const { updateHistory = true, replaceHistory = false } = options;
  switchTab(tab);

  if (!updateHistory || !window.history || !window.history.pushState) return;

  const targetPath = tabToPath(tab);
  if (window.location.pathname === targetPath) return;

  const method = replaceHistory ? "replaceState" : "pushState";
  window.history[method]({ tab }, "", targetPath);
}

function drawOverlay(points) {
  const ctx = overlay.getContext("2d");
  overlay.width = inputVideo.videoWidth || 0;
  overlay.height = inputVideo.videoHeight || 0;
  ctx.clearRect(0, 0, overlay.width, overlay.height);

  if (!points || points.length === 0) return;

  ctx.strokeStyle = "rgba(46, 167, 255, 0.95)";
  ctx.lineWidth = 2;
  for (let i = 0; i < points.length; i += 1) {
    const [x, y] = points[i];
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function frameToBase64() {
  const w = inputVideo.videoWidth;
  const h = inputVideo.videoHeight;
  if (!w || !h) return null;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  c.getContext("2d").drawImage(inputVideo, 0, 0, w, h);
  return c.toDataURL("image/jpeg", 0.78);
}

function updateLiveMetrics(payload) {
  pushLiveTelemetry(payload);

  if (typeof payload.ear === "number") currentEarEl.textContent = payload.ear.toFixed(2);
  if (typeof payload.mar === "number" && marMetricEl) marMetricEl.textContent = payload.mar.toFixed(2);
  const perclosPercent = ((payload.perclos || 0) * 100).toFixed(1);
  const riskPercent = Math.round((payload.risk_score || 0) * 100);
  const attentionPercent = Math.round((payload.attention_score || 0) * 100);
  const intoxicationPercent = Math.round((payload.intoxication_score || 0) * 100);
  const distractionPercent = Math.round((payload.distraction_score || 0) * 100);
  const yawnPercent = Math.round((payload.yawn_score || 0) * 100);
  const cognitivePercent = Math.round((payload.cognitive_load || 0) * 100);
  const fatigueAction = payload.fatigue_action || "unknown";
  const fatigueLevel = payload.fatigue_level || "low";
  const fatigueConfidenceSource = typeof payload.fatigue_level_score === "number"
    ? payload.fatigue_level_score
    : payload.fatigue_confidence;
  const fatigueStatusRaw = String(payload.fatigue_model_status || "unavailable");
  const fatigueLastUpdateRaw = String(payload.fatigue_last_update || "").trim();
  const fatigueModelReady = fatigueStatusRaw.toLowerCase().startsWith("ready");
  const fatigueActionKnown = fatigueAction === "fatigue" || fatigueAction === "nonfatigue";
  const fatigueAnalyticsLive = fatigueModelReady && fatigueActionKnown;
  const fatigueConfidence = typeof fatigueConfidenceSource === "number"
    ? `${Math.round(fatigueConfidenceSource * 100)}%`
    : "--";
  const fatigueStatus = fatigueAnalyticsLive ? "Real Analytics" : "Loading";
  const yawText = `${(payload.yaw || 0).toFixed(1)} deg`;
  const pitchText = `${(payload.pitch || 0).toFixed(1)} deg`;
  const blinkText = `${(payload.blink_rate || 0).toFixed(1)}/min`;

  perclosMetricEl.textContent = `${perclosPercent}%`;
  riskMetricEl.textContent = `${riskPercent}%`;
  yawMetricEl.textContent = yawText;
  pitchMetricEl.textContent = pitchText;
  if (blinkMetricEl) blinkMetricEl.textContent = blinkText;
  if (attentionMetricEl) attentionMetricEl.textContent = `${attentionPercent}%`;
  if (intoxicationMetricEl) intoxicationMetricEl.textContent = `${intoxicationPercent}%`;
  if (distractionMetricEl) distractionMetricEl.textContent = `${distractionPercent}%`;
  if (yawnMetricEl) yawnMetricEl.textContent = `${yawnPercent}%`;
  if (cognitiveLoadMetricEl) cognitiveLoadMetricEl.textContent = `${cognitivePercent}%`;
  if (fatigueActionMetricEl) fatigueActionMetricEl.textContent = fatigueAnalyticsLive ? `${fatigueAction} (${fatigueLevel})` : "Loading...";
  if (fatigueConfidenceMetricEl) fatigueConfidenceMetricEl.textContent = fatigueAnalyticsLive ? fatigueConfidence : "--";
  if (fatigueModelStatusMetricEl) fatigueModelStatusMetricEl.textContent = fatigueStatus;

  if (hudEarEl) hudEarEl.textContent = typeof payload.ear === "number" ? payload.ear.toFixed(2) : "--";
  if (hudPerclosEl) hudPerclosEl.textContent = `${perclosPercent}%`;
  if (hudRiskEl) hudRiskEl.textContent = `${riskPercent}%`;
  if (hudYawEl) hudYawEl.textContent = yawText;
  if (hudPitchEl) hudPitchEl.textContent = pitchText;
  if (riskStripEl) riskStripEl.style.width = `${Math.max(0, Math.min(100, riskPercent))}%`;
  fpsMetricEl.textContent = `${(payload.estimated_fps || 0).toFixed(1)}`;
  latencyMetricEl.textContent = `${(payload.latency_ms || 0).toFixed(0)} ms`;
  stateDurationMetricEl.textContent = `${(payload.state_duration_sec || 0).toFixed(1)}s`;
  if (fatigueActionStatEl) fatigueActionStatEl.textContent = fatigueAnalyticsLive ? `${fatigueAction} (${fatigueLevel})` : "Loading...";
  if (fatigueConfidenceStatEl) fatigueConfidenceStatEl.textContent = fatigueAnalyticsLive ? fatigueConfidence : "--";
  lastFatigueAction = fatigueAnalyticsLive ? `${fatigueAction} (${fatigueLevel})` : "Loading...";
  lastFatigueConfidence = fatigueAnalyticsLive ? fatigueConfidence : "--";
  lastFatigueStatus = fatigueStatus;
  if (fatigueLastUpdateRaw) {
    const fatigueUpdatedDate = new Date(fatigueLastUpdateRaw);
    lastFatigueUpdated = Number.isNaN(fatigueUpdatedDate.getTime())
      ? fatigueLastUpdateRaw
      : fatigueUpdatedDate.toLocaleTimeString();
  }

  const driverState = (payload.driver_state || "").toLowerCase();
  if (payload.drowsy || driverState === "asleep" || driverState === "high risk" || driverState === "drowsy") {
    setStatus("Drowsy", "danger");
    setMonitoringBadge("active", "Active - Alert");
    playAlarm();
  } else if (driverState.includes("distracted")) {
    setStatus("Distracted", "warn");
    setMonitoringBadge("active", "Active - Distracted");
  } else if (intoxicationPercent >= INTOXICATION_ALERT_THRESHOLD * 100) {
    setStatus("Intoxication Risk", "danger");
    setMonitoringBadge("active", "Active - Alert");
    playAlarm();
  } else if (payload.face_detected) {
    setStatus("Normal", "ok");
    setMonitoringBadge("active", "Active");
  } else {
    setStatus("Scanning", "warn");
    setMonitoringBadge("active", "Active - Scanning");
  }
}

async function analyzeFrame() {
  if (!detectionOn || requestInFlight) return;
  const imageBase64 = frameToBase64();
  if (!imageBase64) return;

  requestInFlight = true;
  try {
    const response = await fetch(`${API_URL}/analyze-frame`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, image_base64: imageBase64 }),
    });

    if (!response.ok) {
      setApiConnection(false, `analyze HTTP ${response.status}`);
      setStatus("API Error", "danger");
      return;
    }

    const data = await response.json();
    if (!data.success) {
      const detail = (data.status || "model unavailable").slice(0, 120);
      setApiConnection(false, detail);
      setStatus("Model Error", "danger");
      sessionSummaryEl.textContent = `Detection halted: ${data.status || "Model unavailable"}`;
      stopDetection();
      return;
    }

    setApiConnection(true);
    if (data.session_id) sessionId = data.session_id;
    updateLiveMetrics(data);
    drawOverlay(data.landmarks || []);
  } catch {
    setApiConnection(false, "analyze request failed");
    setStatus("Connection Error", "danger");
  } finally {
    requestInFlight = false;
  }
}

async function refreshSessionSummary() {
  if (!sessionId) return;
  try {
    const response = await fetch(`${API_URL}/session/${encodeURIComponent(sessionId)}`);
    if (!response.ok) return;
    const s = await response.json();
    framesMetricEl.textContent = `${s.analyzed_frames || 0}`;
    eventsMetricEl.textContent = `${s.drowsy_events || 0}`;
    fpsMetricEl.textContent = `${(s.estimated_fps || 0).toFixed(1)}`;
    latencyMetricEl.textContent = `${(s.last_latency_ms || 0).toFixed(0)} ms`;
    stateDurationMetricEl.textContent = `${(s.state_duration_sec || 0).toFixed(1)}s`;
    sessionSummaryEl.textContent = `Session ${s.session_id} | Frames: ${s.analyzed_frames} | Drowsy events: ${s.drowsy_events} | Last EAR: ${s.last_ear == null ? "--" : s.last_ear.toFixed(3)} | Attention: ${s.last_attention_score == null ? "--" : (s.last_attention_score * 100).toFixed(0)}% | Intoxication: ${s.last_intoxication_score == null ? "--" : (s.last_intoxication_score * 100).toFixed(0)}% | Fatigue action: ${lastFatigueAction} (${lastFatigueConfidence}) | Fatigue model: ${lastFatigueStatus} | Fatigue updated: ${lastFatigueUpdated} | Detect path: ${s.last_detection_path || "raw"} | Last status: ${s.last_status}`;
  } catch {
    // ignore summary errors
  }
}

async function startDetection() {
  if (detectionOn) return;
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    inputVideo.srcObject = mediaStream;
    await inputVideo.play();
    detectionOn = true;
    toggleBtn.textContent = "Stop";
    setMonitoringBadge("active", "Active");

    pollHandle = setInterval(() => {
      void analyzeFrame();
    }, 220);

    summaryHandle = setInterval(() => {
      void refreshSessionSummary();
    }, 1500);
  } catch {
    setStatus("Camera Denied", "danger");
    setMonitoringBadge("error", "Camera Denied");
  }
}

function stopDetection() {
  detectionOn = false;
  toggleBtn.textContent = "Start";
  if (pollHandle) clearInterval(pollHandle);
  if (summaryHandle) clearInterval(summaryHandle);
  pollHandle = null;
  summaryHandle = null;
  if (mediaStream) {
    mediaStream.getTracks().forEach((t) => t.stop());
    mediaStream = null;
  }
  inputVideo.srcObject = null;
  overlay.getContext("2d").clearRect(0, 0, overlay.width, overlay.height);
  if (riskStripEl) riskStripEl.style.width = "0%";
  setStatus("Ready", "ok");
  setMonitoringBadge("inactive", "Off");
}

async function exportSessionSnapshot() {
  if (!sessionId) return;
  try {
    const response = await fetch(`${API_URL}/session/${encodeURIComponent(sessionId)}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `safe-motion-session-${sessionId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    setAnalyticsInfo(`Export failed: ${error.message}`, true);
  }
}

function setAnalyticsInfo(msg, isError = false) {
  analyticsInfo.textContent = msg;
  analyticsInfo.style.color = isError ? "#ff5d73" : "#a6b0cc";
}

function setRiskClass(level) {
  const normalized = (level || "").toUpperCase();
  riskLevelMetric.className = "";
  if (normalized === "NORMAL") riskLevelMetric.classList.add("ok");
  else if (normalized === "POSSIBLE_IMPAIRMENT") riskLevelMetric.classList.add("warn");
  else riskLevelMetric.classList.add("danger");
}

function upsertChart(targetId, label, labels, values, color, chartRef) {
  const ctx = document.getElementById(targetId).getContext("2d");
  if (chartRef) {
    chartRef.data.labels = labels;
    chartRef.data.datasets[0].data = values;
    chartRef.update();
    return chartRef;
  }
  return new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{ label, data: values, borderColor: color, pointRadius: 0, borderWidth: 2, tension: 0.2 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "nearest", axis: "x", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: true,
          callbacks: {
            title: (items) => `Time: ${items[0]?.label || "-"}`,
            label: (item) => `${item.dataset.label}: ${Number(item.raw).toFixed(3)}`,
          },
        },
      },
    },
  });
}

function upsertThresholdChart(targetCanvas, label, labels, values, threshold, color, thresholdColor, chartRef, yMin = 0, yMax = 1) {
  if (!targetCanvas) return chartRef;
  const ctx = targetCanvas.getContext("2d");
  const thresholdSeries = labels.map(() => threshold);

  if (chartRef) {
    chartRef.data.labels = labels;
    chartRef.data.datasets[0].data = values;
    chartRef.data.datasets[1].data = thresholdSeries;
    chartRef.update();
    return chartRef;
  }

  return new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        { label, data: values, borderColor: color, pointRadius: 0, borderWidth: 2, tension: 0.2 },
        {
          label: "Threshold",
          data: thresholdSeries,
          borderColor: thresholdColor,
          pointRadius: 0,
          borderWidth: 1.5,
          borderDash: [6, 4],
          tension: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "nearest", axis: "x", intersect: false },
      plugins: {
        legend: { display: true, labels: { color: "#a6b0cc", boxWidth: 10 } },
        tooltip: {
          enabled: true,
          callbacks: {
            title: (items) => `Time: ${items[0]?.label || "-"}`,
            label: (item) => `${item.dataset.label}: ${Number(item.raw).toFixed(3)}`,
          },
        },
      },
      scales: {
        x: { ticks: { color: "#8190b7", maxRotation: 0, autoSkip: true, maxTicksLimit: 6 }, grid: { color: "#1d2a47" } },
        y: { ticks: { color: "#8190b7" }, grid: { color: "#1d2a47" }, min: yMin, max: yMax },
      },
    },
  });
}

function upsertLiveRiskChart(labels, values) {
  if (!liveRiskChartCanvas) return;
  const ctx = liveRiskChartCanvas.getContext("2d");

  if (liveRiskChart) {
    liveRiskChart.data.labels = labels;
    liveRiskChart.data.datasets[0].data = values;
    liveRiskChart.update();
    return;
  }

  liveRiskChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{ label: "Risk", data: values, borderColor: "#ffad33", pointRadius: 0, borderWidth: 2, tension: 0.2 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "nearest", axis: "x", intersect: false },
      plugins: {
        legend: { display: true, labels: { color: "#a6b0cc", boxWidth: 10 } },
        tooltip: {
          enabled: true,
          callbacks: {
            title: (items) => `Time: ${items[0]?.label || "-"}`,
            label: (item) => `${item.dataset.label}: ${Number(item.raw).toFixed(3)}`,
          },
        },
      },
      scales: {
        x: { ticks: { color: "#8190b7", maxRotation: 0, autoSkip: true, maxTicksLimit: 6 }, grid: { color: "#1d2a47" } },
        y: { ticks: { color: "#8190b7" }, grid: { color: "#1d2a47" }, min: 0, max: 1 },
      },
    },
  });
}

function renderLiveTelemetryCharts() {
  liveEarChart = upsertThresholdChart(
    liveEarChartCanvas,
    "EAR",
    liveTelemetry.labels,
    liveTelemetry.ear,
    EAR_THRESHOLD,
    "#2ea7ff",
    "#ff5d73",
    liveEarChart,
    0,
    0.5,
  );

  livePerclosChart = upsertThresholdChart(
    livePerclosChartCanvas,
    "PERCLOS",
    liveTelemetry.labels,
    liveTelemetry.perclos,
    PERCLOS_THRESHOLD,
    "#16c784",
    "#ff5d73",
    livePerclosChart,
    0,
    1,
  );

  liveIntoxicationChart = upsertThresholdChart(
    liveIntoxicationChartCanvas,
    "Intoxication",
    liveTelemetry.labels,
    liveTelemetry.intoxication,
    INTOXICATION_ALERT_THRESHOLD,
    "#ffad33",
    "#ff5d73",
    liveIntoxicationChart,
    0,
    1,
  );

  upsertLiveRiskChart(liveTelemetry.labels, liveTelemetry.risk);
}

function pushLiveTelemetry(payload) {
  const stamp = new Date().toLocaleTimeString([], { hour12: false, minute: "2-digit", second: "2-digit" });

  liveTelemetry.labels.push(stamp);
  liveTelemetry.ear.push(typeof payload.ear === "number" ? payload.ear : null);
  liveTelemetry.perclos.push(typeof payload.perclos === "number" ? payload.perclos : 0);
  liveTelemetry.intoxication.push(typeof payload.intoxication_score === "number" ? payload.intoxication_score : 0);
  liveTelemetry.risk.push(typeof payload.risk_score === "number" ? payload.risk_score : 0);

  if (liveTelemetry.labels.length > LIVE_CHART_MAX_POINTS) {
    liveTelemetry.labels.shift();
    liveTelemetry.ear.shift();
    liveTelemetry.perclos.shift();
    liveTelemetry.intoxication.shift();
    liveTelemetry.risk.shift();
  }

  renderLiveTelemetryCharts();
}

function renderAnalytics(report) {
  const m = report.metrics || {};
  entropyMetric.textContent = typeof m.steering_entropy === "number" ? m.steering_entropy.toFixed(3) : "--";
  speedVarMetric.textContent = typeof m.speed_variability === "number" ? `${m.speed_variability.toFixed(2)}%` : "--";
  riskScoreMetric.textContent = typeof m.risk_score === "number" ? m.risk_score.toFixed(3) : "--";
  riskLevelMetric.textContent = m.risk_level || "--";
  setRiskClass(m.risk_level);

  const ts = report.series?.timestamp || [];
  steeringChart = upsertChart("steeringChart", "Steering", ts, report.series?.steering_angle || [], "#2ea7ff", steeringChart);
  speedChart = upsertChart("speedChart", "Speed", ts, report.series?.speed_kmh || [], "#16c784", speedChart);

  setAnalyticsInfo(`CSV analyzed. Samples: ${report.samples}. Risk: ${m.risk_level || "Unknown"}`);
}

function renderHistoryRows(history) {
  historyBody.innerHTML = "";
  if (!history || history.length === 0) {
    historyTable.classList.add("hidden");
    historyEmpty.classList.remove("hidden");
    return;
  }

  historyEmpty.classList.add("hidden");
  historyTable.classList.remove("hidden");

  history.forEach((row) => {
    const tr = document.createElement("tr");
    const dt = row.created_at ? new Date(row.created_at).toISOString().replace("T", " ").slice(0, 19) : "--";
    tr.innerHTML = `
      <td>${dt}</td>
      <td>${row.source || "--"}</td>
      <td>${row.scenario || "--"}</td>
      <td>${row.samples ?? "--"}</td>
      <td>${typeof row.steering_entropy === "number" ? row.steering_entropy.toFixed(3) : "--"}</td>
      <td>${typeof row.speed_variability === "number" ? row.speed_variability.toFixed(2) : "--"}</td>
      <td>${row.risk_level || "--"}</td>
    `;
    historyBody.appendChild(tr);
  });
}

async function loadAnalyticsHistory() {
  try {
    const response = await fetch(`${API_URL}/analytics/history?limit=20`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    renderHistoryRows(data.history || []);
  } catch {
    historyTable.classList.add("hidden");
    historyEmpty.classList.remove("hidden");
    historyEmpty.textContent = "History unavailable.";
  }
}

async function analyzeCsv() {
  const file = csvFileInput.files[0];
  if (!file) {
    setAnalyticsInfo("Select a CSV file first.", true);
    return;
  }

  try {
    setAnalyticsInfo("Analyzing CSV...");
    const text = await file.text();
    const response = await fetch(`${API_URL}/analytics/upload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv_content: text }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.detail || `HTTP ${response.status}`);
    }

    const report = await response.json();
    renderAnalytics(report);
    await loadAnalyticsHistory();
  } catch (error) {
    setAnalyticsInfo(`CSV analysis failed: ${error.message}`, true);
  }
}

function renderInsuranceSessions(sessions) {
  if (!insuranceSessionBody || !insuranceSessionTable) return;
  insuranceSessionBody.innerHTML = "";

  if (!sessions || sessions.length === 0) {
    insuranceSessionTable.classList.add("hidden");
    return;
  }

  insuranceSessionTable.classList.remove("hidden");
  sessions.forEach((row) => {
    const tr = document.createElement("tr");
    const updated = row.last_update ? new Date(row.last_update).toISOString().replace("T", " ").slice(0, 19) : "--";
    tr.innerHTML = `
      <td>${row.session_id || "--"}</td>
      <td>${row.last_status || "--"}</td>
      <td>${row.analyzed_frames ?? "--"}</td>
      <td>${row.drowsy_events ?? "--"}</td>
      <td>${typeof row.last_risk === "number" ? row.last_risk.toFixed(3) : "--"}</td>
      <td>${updated}</td>
    `;
    insuranceSessionBody.appendChild(tr);
  });
}

async function loadInsuranceOverview() {
  if (!insTotalSessions) return;

  try {
    const response = await fetch(`${API_URL}/insurance/overview`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    renderInsuranceSessions(data.sessions || []);

    if (!data.has_data) {
      insTotalSessions.textContent = "0";
      insDrivingHours.textContent = "0.0";
      insSafetyScore.textContent = "--";
      insRiskCategory.textContent = "--";
      insAdjustedPremium.textContent = "--";
      insDiscount.textContent = "--";
      setInsuranceInfo(data.message || "No insurance data available yet.", false);
      return;
    }

    const profile = data.profile || {};
    const premium = data.premium || {};

    insTotalSessions.textContent = `${profile.total_sessions ?? 0}`;
    insDrivingHours.textContent = `${profile.total_driving_hours ?? 0}`;
    insSafetyScore.textContent = typeof profile.average_safety_score === "number" ? profile.average_safety_score.toFixed(2) : "--";
    insRiskCategory.textContent = profile.risk_category || "--";
    insAdjustedPremium.textContent = typeof premium.adjusted_premium === "number" ? premium.adjusted_premium.toFixed(2) : "--";
    insDiscount.textContent = typeof premium.discount_percentage === "number" ? `${premium.discount_percentage.toFixed(1)}%` : "--";
    setInsuranceInfo(`Insurance profile refreshed. Recommendation: ${premium.recommendation || "unknown"}.`);
  } catch (error) {
    setInsuranceInfo(`Insurance overview failed: ${error.message}`, true);
  }
}

async function loadInsuranceMonthly() {
  if (!insuranceMonthInput || !insuranceMonthInput.value) {
    setInsuranceInfo("Select a month first.", true);
    return;
  }

  const [year, month] = insuranceMonthInput.value.split("-");
  try {
    const response = await fetch(`${API_URL}/insurance/monthly?month=${Number(month)}&year=${Number(year)}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    if (!data.has_data) {
      setInsuranceInfo(data.message || "No monthly records found.", false);
      return;
    }

    const s = data.summary || {};
    setInsuranceInfo(`Monthly summary ${s.month}/${s.year}: trips ${s.total_trips}, score ${s.average_safety_score}, alerts ${s.total_alerts}.`);
  } catch (error) {
    setInsuranceInfo(`Monthly summary failed: ${error.message}`, true);
  }
}

function applyAlertSettingsToForm(payload) {
  const alertCfg = payload.alert_config || {};
  const stakeholder = payload.stakeholder_config || {};
  const detection = alertCfg.detection_parameters || {};
  const rules = stakeholder.alert_rules || {};
  const services = stakeholder.emergency_services || {};

  if (cfgEarThreshold) cfgEarThreshold.value = detection.ear_threshold ?? "";
  if (cfgConsecutiveFrames) cfgConsecutiveFrames.value = detection.consecutive_frames ?? "";
  if (cfgFamilyThreshold) cfgFamilyThreshold.value = rules.family_alert_threshold || "moderate";
  if (cfgPoliceThreshold) cfgPoliceThreshold.value = rules.police_alert_threshold || "severe";
  if (cfgAmbulanceThreshold) cfgAmbulanceThreshold.value = rules.ambulance_alert_threshold || "critical";
  if (cfgAutoVerifyCritical) cfgAutoVerifyCritical.checked = !!rules.auto_verify_critical;
  if (cfgPoliceEnabled) cfgPoliceEnabled.checked = !!services.police?.enabled;
  if (cfgAmbulanceEnabled) cfgAmbulanceEnabled.checked = !!services.ambulance?.enabled;
}

async function loadAlertSettings() {
  if (!cfgEarThreshold) return;

  try {
    const response = await fetch(`${API_URL}/alerts/settings`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    applyAlertSettingsToForm(data);
    setAlertSettingsInfo("Alert settings loaded from backend.");
  } catch (error) {
    setAlertSettingsInfo(`Loading settings failed: ${error.message}`, true);
  }
}

async function saveAlertSettings() {
  if (!cfgEarThreshold) return;

  try {
    const current = await fetch(`${API_URL}/alerts/settings`).then((r) => r.json());

    const alertConfig = { ...(current.alert_config || {}) };
    alertConfig.detection_parameters = { ...(alertConfig.detection_parameters || {}) };
    alertConfig.detection_parameters.ear_threshold = Number(cfgEarThreshold.value || 0.25);
    alertConfig.detection_parameters.consecutive_frames = Number(cfgConsecutiveFrames.value || 20);

    const stakeholderConfig = { ...(current.stakeholder_config || {}) };
    stakeholderConfig.alert_rules = { ...(stakeholderConfig.alert_rules || {}) };
    stakeholderConfig.alert_rules.family_alert_threshold = cfgFamilyThreshold.value;
    stakeholderConfig.alert_rules.police_alert_threshold = cfgPoliceThreshold.value;
    stakeholderConfig.alert_rules.ambulance_alert_threshold = cfgAmbulanceThreshold.value;
    stakeholderConfig.alert_rules.auto_verify_critical = !!cfgAutoVerifyCritical.checked;

    stakeholderConfig.emergency_services = { ...(stakeholderConfig.emergency_services || {}) };
    stakeholderConfig.emergency_services.police = { ...(stakeholderConfig.emergency_services.police || {}) };
    stakeholderConfig.emergency_services.ambulance = { ...(stakeholderConfig.emergency_services.ambulance || {}) };
    stakeholderConfig.emergency_services.police.enabled = !!cfgPoliceEnabled.checked;
    stakeholderConfig.emergency_services.ambulance.enabled = !!cfgAmbulanceEnabled.checked;

    const response = await fetch(`${API_URL}/alerts/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        alert_config: alertConfig,
        stakeholder_config: stakeholderConfig,
      }),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const updated = await response.json();
    applyAlertSettingsToForm(updated);
    setAlertSettingsInfo("Alert settings saved successfully.");
  } catch (error) {
    setAlertSettingsInfo(`Saving settings failed: ${error.message}`, true);
  }
}

liveTabBtn.addEventListener("click", (event) => {
  event.preventDefault();
  navigateToTab("live");
});

analyticsTabBtn.addEventListener("click", (event) => {
  event.preventDefault();
  navigateToTab("analytics");
});

if (insuranceTabBtn) {
  insuranceTabBtn.addEventListener("click", (event) => {
    event.preventDefault();
    navigateToTab("insurance");
  });
}

if (alertsTabBtn) {
  alertsTabBtn.addEventListener("click", (event) => {
    event.preventDefault();
    navigateToTab("alerts");
  });
}

if (toggleBtn) {
  toggleBtn.addEventListener("click", () => {
    if (detectionOn) stopDetection();
    else void startDetection();
  });
}

if (analyzeCsvBtn) {
  analyzeCsvBtn.addEventListener("click", () => {
    void analyzeCsv();
  });
}

if (refreshHistoryBtn) {
  refreshHistoryBtn.addEventListener("click", () => {
    void loadAnalyticsHistory();
  });
}

if (refreshInsuranceBtn) {
  refreshInsuranceBtn.addEventListener("click", () => {
    void loadInsuranceOverview();
  });
}

if (loadInsuranceMonthBtn) {
  loadInsuranceMonthBtn.addEventListener("click", () => {
    void loadInsuranceMonthly();
  });
}

if (reloadAlertSettingsBtn) {
  reloadAlertSettingsBtn.addEventListener("click", () => {
    void loadAlertSettings();
  });
}

if (saveAlertSettingsBtn) {
  saveAlertSettingsBtn.addEventListener("click", () => {
    void saveAlertSettings();
  });
}

if (soundToggle) {
  soundToggle.addEventListener("change", (event) => {
    soundEnabled = !!event.target.checked;
  });
}

if (voiceToggle) {
  voiceToggle.addEventListener("change", (event) => {
    voiceEnabled = !!event.target.checked;
    setVoiceTranscript(voiceEnabled ? "Voice assistant enabled." : "Voice assistant disabled.");
    if (!voiceEnabled) {
      stopVoiceRecognition();
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    }
  });
}

if (voiceAssistBtn) {
  voiceAssistBtn.addEventListener("mousedown", () => {
    startVoiceRecognition();
  });
  voiceAssistBtn.addEventListener("mouseup", () => {
    stopVoiceRecognition();
  });
  voiceAssistBtn.addEventListener("mouseleave", () => {
    stopVoiceRecognition();
  });
  voiceAssistBtn.addEventListener("touchstart", (event) => {
    event.preventDefault();
    startVoiceRecognition();
  }, { passive: false });
  voiceAssistBtn.addEventListener("touchend", (event) => {
    event.preventDefault();
    stopVoiceRecognition();
  }, { passive: false });
}

if (darkToggle) {
  darkToggle.addEventListener("change", (event) => {
    document.body.style.filter = event.target.checked ? "none" : "saturate(0.85) brightness(1.08)";
  });
}

if (exportSessionBtn) {
  exportSessionBtn.addEventListener("click", () => {
    void exportSessionSnapshot();
  });
}

if (graphWidthRange) {
  graphWidthRange.addEventListener("input", (event) => {
    const width = Number(event.target.value || DEFAULT_GRAPH_WIDTH_CM);
    const height = Number(graphHeightRange?.value || DEFAULT_GRAPH_HEIGHT_CM);
    applyGraphSize(width, height);
  });
}

if (graphHeightRange) {
  graphHeightRange.addEventListener("input", (event) => {
    const width = Number(graphWidthRange?.value || DEFAULT_GRAPH_WIDTH_CM);
    const height = Number(event.target.value || DEFAULT_GRAPH_HEIGHT_CM);
    applyGraphSize(width, height);
  });
}

if (resetGraphSizeBtn) {
  resetGraphSizeBtn.addEventListener("click", () => {
    if (graphWidthRange) graphWidthRange.value = String(DEFAULT_GRAPH_WIDTH_CM);
    if (graphHeightRange) graphHeightRange.value = String(DEFAULT_GRAPH_HEIGHT_CM);
    applyGraphSize(DEFAULT_GRAPH_WIDTH_CM, DEFAULT_GRAPH_HEIGHT_CM);
  });
}

void fetchConfig();
void checkHealth();
void loadAnalyticsHistory();
void loadInsuranceOverview();
void loadAlertSettings();
renderLiveTelemetryCharts();

setMonitoringBadge("inactive", "Off");
applyGraphSize(Number(graphWidthRange?.value || DEFAULT_GRAPH_WIDTH_CM), Number(graphHeightRange?.value || DEFAULT_GRAPH_HEIGHT_CM));

if (insuranceMonthInput && !insuranceMonthInput.value) {
  insuranceMonthInput.value = new Date().toISOString().slice(0, 7);
}

navigateToTab(getInitialTabFromUrl(), { updateHistory: false });

window.addEventListener("popstate", () => {
  navigateToTab(getInitialTabFromUrl(), { updateHistory: false });
});

setInterval(() => {
  void checkHealth();
}, 5000);
