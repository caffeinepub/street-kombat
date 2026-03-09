import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

interface OnlineLobbyProps {
  /** The generated room code (6 chars uppercase) */
  roomCode: string;
  /** Which player slot we are: 1 = host, 2 = joining */
  playerSlot: 1 | 2;
  /** Called when an opponent connects and both are ready to start */
  onStart: () => void;
  /** Called when user cancels / backs out */
  onCancel: () => void;
  /** BroadcastChannel ref from FightingGame (shared) */
  channelRef: React.RefObject<BroadcastChannel | null>;
}

export default function OnlineLobby({
  roomCode,
  playerSlot,
  onStart,
  onCancel,
  channelRef,
}: OnlineLobbyProps) {
  const [copied, setCopied] = useState(false);
  const [opponentReady, setOpponentReady] = useState(false);
  const [dots, setDots] = useState(".");

  // Animated waiting dots
  useEffect(() => {
    const id = setInterval(() => {
      setDots((d) => (d.length >= 3 ? "." : `${d}.`));
    }, 500);
    return () => clearInterval(id);
  }, []);

  // Listen for opponent presence ping on the channel
  useEffect(() => {
    const ch = channelRef.current;
    if (!ch) return;

    const handleMsg = (e: MessageEvent) => {
      if (e.data?.type === "ping" || e.data?.type === "input") {
        setOpponentReady(true);
      }
    };

    ch.addEventListener("message", handleMsg);
    return () => ch.removeEventListener("message", handleMsg);
  }, [channelRef]);

  // When we detect the opponent, auto-start after a brief delay
  useEffect(() => {
    if (opponentReady) {
      const timer = setTimeout(() => {
        onStart();
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [opponentReady, onStart]);

  // If we are P2, announce presence immediately
  useEffect(() => {
    if (playerSlot === 2 && channelRef.current) {
      channelRef.current.postMessage({ type: "ping", player: 2 });
    }
  }, [playerSlot, channelRef]);

  const shareUrl = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select the text manually
      const el = document.createElement("textarea");
      el.value = shareUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(4, 4, 15, 0.97)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Geist Mono', monospace",
        overflow: "hidden",
      }}
      data-ocid="online_lobby.panel"
    >
      {/* Animated grid background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(0,212,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.04) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          pointerEvents: "none",
        }}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.88 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        style={{
          position: "relative",
          width: "min(480px, 90vw)",
          background: "rgba(8, 8, 22, 0.95)",
          border: "2px solid #00d4ff",
          boxShadow:
            "0 0 40px rgba(0,212,255,0.3), 0 0 80px rgba(0,212,255,0.1), inset 0 0 30px rgba(0,212,255,0.03)",
          padding: "36px 32px 28px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 0,
        }}
      >
        {/* Title */}
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.2em",
            color: "rgba(0,212,255,0.5)",
            marginBottom: 8,
          }}
        >
          {playerSlot === 1 ? "HOST" : "JOINING"}
        </div>
        <div
          style={{
            fontSize: "clamp(20px, 5vw, 28px)",
            fontWeight: 900,
            color: "#00d4ff",
            textShadow: "0 0 20px #00d4ff, 0 0 40px rgba(0,212,255,0.5)",
            letterSpacing: "0.05em",
            marginBottom: 28,
          }}
        >
          VS FRIEND MODE
        </div>

        {/* Room Code */}
        <div
          style={{
            width: "100%",
            background: "rgba(0,212,255,0.06)",
            border: "1px solid rgba(0,212,255,0.3)",
            padding: "16px 24px",
            marginBottom: 16,
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: "rgba(255,238,0,0.6)",
              letterSpacing: "0.15em",
              marginBottom: 6,
            }}
          >
            ROOM CODE
          </div>
          <div
            style={{
              fontSize: "clamp(32px, 8vw, 48px)",
              fontWeight: 900,
              letterSpacing: "0.2em",
              color: "#ffee00",
              textShadow: "0 0 20px #ffee00, 0 0 40px rgba(255,238,0,0.4)",
            }}
          >
            {roomCode}
          </div>
        </div>

        {/* Share link */}
        {playerSlot === 1 && (
          <>
            <div
              style={{
                width: "100%",
                background: "rgba(10,10,22,0.6)",
                border: "1px solid rgba(0,212,255,0.15)",
                padding: "8px 12px",
                marginBottom: 12,
                display: "flex",
                alignItems: "center",
                gap: 8,
                overflow: "hidden",
              }}
            >
              <span
                style={{
                  flex: 1,
                  fontSize: 10,
                  color: "rgba(200,200,220,0.5)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {shareUrl}
              </span>
            </div>

            <button
              type="button"
              onClick={handleCopy}
              data-ocid="online_lobby.primary_button"
              style={{
                width: "100%",
                padding: "12px",
                background: copied
                  ? "rgba(0,255,136,0.15)"
                  : "rgba(0,212,255,0.1)",
                border: `2px solid ${copied ? "#00ff88" : "#00d4ff"}`,
                color: copied ? "#00ff88" : "#00d4ff",
                fontSize: 14,
                fontWeight: 800,
                letterSpacing: "0.1em",
                cursor: "pointer",
                transition: "all 0.15s",
                fontFamily: "'Geist Mono', monospace",
                marginBottom: 24,
              }}
            >
              {copied ? "✓ LINK COPIED!" : "COPY INVITE LINK"}
            </button>
          </>
        )}

        {/* Status */}
        <AnimatePresence mode="wait">
          {opponentReady ? (
            <motion.div
              key="ready"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                padding: "12px 24px",
                background: "rgba(0,255,136,0.1)",
                border: "1px solid #00ff88",
                color: "#00ff88",
                fontSize: 16,
                fontWeight: 700,
                letterSpacing: "0.08em",
                marginBottom: 20,
                textShadow: "0 0 12px #00ff88",
              }}
            >
              ⚡ OPPONENT CONNECTED — STARTING!
            </motion.div>
          ) : (
            <motion.div
              key="waiting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{
                padding: "12px 24px",
                color: "rgba(0,212,255,0.6)",
                fontSize: 14,
                letterSpacing: "0.06em",
                marginBottom: 20,
              }}
            >
              {playerSlot === 1
                ? `WAITING FOR PLAYER 2${dots}`
                : `CONNECTING TO ROOM${dots}`}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Instructions */}
        <div
          style={{
            width: "100%",
            padding: "12px 16px",
            background: "rgba(255,238,0,0.04)",
            border: "1px solid rgba(255,238,0,0.15)",
            marginBottom: 20,
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: "rgba(255,238,0,0.6)",
              marginBottom: 6,
              letterSpacing: "0.1em",
            }}
          >
            HOW TO PLAY
          </div>
          {playerSlot === 1 ? (
            <div
              style={{
                fontSize: 10,
                color: "rgba(200,200,200,0.5)",
                lineHeight: 1.7,
              }}
            >
              • Copy the invite link and send to your friend
              <br />• They open it in their browser or tab
              <br />• Game starts automatically when they join
              <br />• You control: Arrow keys + A/S/D/Z/X/F
            </div>
          ) : (
            <div
              style={{
                fontSize: 10,
                color: "rgba(200,200,200,0.5)",
                lineHeight: 1.7,
              }}
            >
              • You are Player 2 (Red Fighter)
              <br />• Use Arrow keys + A/S/D/Z/X/F to fight
              <br />• Works across tabs on the same device
              <br />• Connecting to your opponent now...
            </div>
          )}
        </div>

        {/* Cancel */}
        <button
          type="button"
          onClick={onCancel}
          data-ocid="online_lobby.cancel_button"
          style={{
            padding: "8px 24px",
            background: "transparent",
            border: "1px solid rgba(255,34,68,0.4)",
            color: "rgba(255,34,68,0.7)",
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.08em",
            cursor: "pointer",
            fontFamily: "'Geist Mono', monospace",
            transition: "all 0.15s",
          }}
        >
          CANCEL
        </button>
      </motion.div>
    </div>
  );
}
