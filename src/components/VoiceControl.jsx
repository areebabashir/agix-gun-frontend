import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Mic,
  MicOff,
  LockKeyhole,
  Shield,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Radio,
} from "lucide-react";

const DEFAULT_API = (
  import.meta.env.VITE_API_URL || "https://agix-gun-bakend.vercel.app"
).replace(/\/$/, "");

const TARGET_DEVICE_ID = "AEGIS-X-ESP32";

const COMMANDS = [
  {
    id: "ENABLE_TRAINING",
    label: "Enable Training",
    phrase: '"enable training"',
    icon: Shield,
    variant: "mint",
  },
  {
    id: "LOCK_SYSTEM",
    label: "Lock System",
    phrase: '"lock system"',
    icon: LockKeyhole,
    variant: "neutral",
  },
  {
    id: "RESET_COUNTER",
    label: "Reset Counter",
    phrase: '"reset counter"',
    icon: RotateCcw,
    variant: "neutral",
  },
  {
    id: "EMERGENCY_LOCK",
    label: "Emergency Lock",
    phrase: '"emergency lock"',
    icon: AlertTriangle,
    variant: "danger",
  },
];

function parseVoiceCommand(transcript) {
  const text = String(transcript || "").toLowerCase().trim();
  if (!text) return null;

  if (
    /\b(emergency|abort|halt|stop all|panic|red alert)\b/.test(text) ||
    text.includes("emergency lock")
  ) {
    return "EMERGENCY_LOCK";
  }

  if (
    /\b(lock|disarm|disable training|safe mode|secure system)\b/.test(text)
  ) {
    return "LOCK_SYSTEM";
  }

  if (
    /\b(enable training|start training|training mode|training|unlock)\b/.test(
      text
    )
  ) {
    return "ENABLE_TRAINING";
  }

  if (/\b(reset|reload|refill|reset counter|clear counter)\b/.test(text)) {
    return "RESET_COUNTER";
  }

  return null;
}

const fmtTime = (t) =>
  t
    ? new Date(t).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "—";

export default function VoiceControl({
  token: tokenProp,
  apiUrl = DEFAULT_API,
  onCommandSent,
}) {
  const token = tokenProp ?? sessionStorage.getItem("aegis_token") ?? "";
  const recognitionRef = useRef(null);

  const SpeechRecognition =
    typeof window !== "undefined"
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : null;

  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [feedback, setFeedback] = useState(null); // { type: 'ok' | 'warn' | 'err', text: string }
  const [history, setHistory] = useState([]);

  const fetchHistory = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${apiUrl}/api/voice/history`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) return;
      const rows = await res.json();
      if (Array.isArray(rows)) setHistory(rows);
    } catch {
      // Non-blocking background refresh
    }
  }, [apiUrl, token]);

  useEffect(() => {
    fetchHistory();
    if (!token) return;
    const timer = setInterval(fetchHistory, 5000);
    return () => clearInterval(timer);
  }, [fetchHistory, token]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Ignore cleanup error
        }
      }
    };
  }, []);

  const sendCommand = useCallback(
    async (command, spokenText = "") => {
      if (!token) {
        setFeedback({ type: "err", text: "Sign in required to send commands." });
        return;
      }

      setBusy(true);
      setFeedback(null);

      try {
        const res = await fetch(`${apiUrl}/api/voice/command`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            deviceId: TARGET_DEVICE_ID,
            command,
          }),
        });

        let data;
        try {
          data = await res.json();
        } catch {
          data = { error: "Invalid server response" };
        }

        if (!res.ok) {
          throw new Error(data.error || `Command failed (${res.status})`);
        }

        setFeedback({
          type: "ok",
          text: spokenText
            ? `Heard "${spokenText}" → queued ${command} for ${TARGET_DEVICE_ID}`
            : `Queued ${command} for ${TARGET_DEVICE_ID}`,
        });

        await fetchHistory();
        if (typeof onCommandSent === "function") {
          onCommandSent();
        }
      } catch (err) {
        setFeedback({
          type: "err",
          text: err.message || "Unable to queue command",
        });
      } finally {
        setBusy(false);
      }
    },
    [apiUrl, fetchHistory, onCommandSent, token]
  );

  const toggleListening = () => {
    if (!SpeechRecognition) {
      setFeedback({
        type: "warn",
        text: "Web Speech API is not supported in this browser. Use the command buttons below.",
      });
      return;
    }

    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setListening(true);
      setTranscript("");
      setFeedback({
        type: "warn",
        text: 'Listening… say "enable training", "lock system", "reset counter", or "emergency lock".',
      });
    };

    recognition.onresult = (event) => {
      const spoken = event.results?.[0]?.[0]?.transcript || "";
      setTranscript(spoken);
      const matched = parseVoiceCommand(spoken);

      if (!matched) {
        setFeedback({
          type: "warn",
          text: `Unrecognized phrase "${spoken}". Try "enable training", "lock system", "reset counter", or "emergency lock".`,
        });
        return;
      }

      sendCommand(matched, spoken);
    };

    recognition.onerror = (event) => {
      setListening(false);
      setFeedback({
        type: "err",
        text:
          event.error === "not-allowed"
            ? "Microphone access denied. Allow mic permissions in your browser."
            : `Voice recognition error: ${event.error || "unknown"}`,
      });
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (err) {
      setListening(false);
      setFeedback({
        type: "err",
        text: err.message || "Could not start voice recognition",
      });
    }
  };

  const chipLabel = listening
    ? "LISTENING"
    : !SpeechRecognition
      ? "BUTTON MODE"
      : busy
        ? "QUEUING"
        : "VOICE READY";

  return (
    <section className="panel voice-panel">
      <div className="panel-title">
        <div>
          <span className="eyebrow">
            VOICE COMMAND INTERFACE · {TARGET_DEVICE_ID}
          </span>
          <h2>Voice Control &amp; Device Command Queue</h2>
        </div>
        <span className={`chip ${listening ? "voice-live" : ""}`}>
          {chipLabel}
        </span>
      </div>

      <div className="voice-top">
        <button
          type="button"
          className={`voice-mic-btn ${listening ? "active" : ""}`}
          onClick={toggleListening}
          disabled={busy}
        >
          {listening ? <MicOff size={20} /> : <Mic size={20} />}
          <span>
            {listening ? "Stop Listening" : "Start Voice Command"}
          </span>
        </button>

        <div className="voice-transcript">
          <span>LAST TRANSCRIPT</span>
          <strong>
            {transcript ? `"${transcript}"` : "Awaiting voice input…"}
          </strong>
        </div>
      </div>

      {feedback && (
        <div className={`voice-feedback ${feedback.type}`}>
          {feedback.type === "ok" ? (
            <CheckCircle2 size={16} />
          ) : (
            <AlertTriangle size={16} />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      <div className="voice-cmd-grid">
        {COMMANDS.map(({ id, label, phrase, icon: Icon, variant }) => (
          <button
            key={id}
            type="button"
            disabled={busy}
            className={`voice-cmd-btn ${variant}`}
            onClick={() => sendCommand(id)}
          >
            <Icon size={18} />
            <strong>{label}</strong>
            <small>Say {phrase}</small>
          </button>
        ))}
      </div>

      <div className="voice-queue">
        <div className="voice-queue-header">
          <span>
            <Radio size={13} /> RECENT QUEUE ({TARGET_DEVICE_ID})
          </span>
          <small>ESP32 polls GET /api/voice/next</small>
        </div>

        {history.length ? (
          <div className="voice-queue-list">
            {history.slice(0, 5).map((item) => (
              <div className="voice-queue-row" key={item._id}>
                <b>{item.command}</b>
                <span className={`voice-badge ${item.status}`}>
                  {item.status === "delivered" ? (
                    <CheckCircle2 size={12} />
                  ) : (
                    <Clock size={12} />
                  )}
                  {item.status}
                </span>
                <small>{fmtTime(item.createdAt)}</small>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted-text voice-empty">
            No queued voice commands yet. Use the microphone or click a command
            above.
          </p>
        )}
      </div>
    </section>
  );
}
