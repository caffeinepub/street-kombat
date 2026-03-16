import { Principal } from "@dfinity/principal";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AnimatePresence } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  CHARACTERS,
  ROUNDS_TO_WIN,
} from "../game/constants";
import {
  type InputState,
  applyPhysics,
  canExecuteFinisher,
  checkMeleeCollisions,
  checkProjectileCollisions,
  checkRoundEnd,
  createCPU,
  createPlayer,
  executeFinisher,
  processPlayerInput,
  resetRound,
  updateCPU,
  updateFacing,
  updateFighterTimers,
  updateHitEffects,
  updateParticles,
  updateProjectiles,
} from "../game/engine";
import {
  drawBackground,
  drawCharacterSelect,
  drawFighter,
  drawHUD,
  drawHitEffects,
  drawLeaderboard,
  drawMatchEnd,
  drawMenu,
  drawOverlayText,
  drawParticles,
  drawProjectile,
  drawScreenFlash,
} from "../game/renderer";
import { useActor } from "../hooks/useActor";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import type { GameState, LeaderboardEntry } from "../types/game";
import { rumble } from "../utils/rumble";
import OnlineLobby from "./OnlineLobby";

// Dummy CPU principal
const CPU_PRINCIPAL = "aaaaa-aa";

// Empty input for when remote player hasn't sent data yet
const EMPTY_INPUT: InputState = {
  left: false,
  right: false,
  up: false,
  down: false,
  punch: false,
  kick: false,
  block: false,
  crouchPunch: false,
  crouchKick: false,
  finisher: false,
};

// Generate a 6-char uppercase room code
function generateRoomCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Get room code from URL
function getRoomFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("room");
}

// Initialize game state
function initGameState(): GameState {
  return {
    phase: "menu",
    round: 1,
    timer: 99,
    timerAccum: 0,
    player: createPlayer(),
    cpu: createCPU(),
    projectiles: [],
    particles: [],
    hitEffects: [],
    overlayText: "",
    overlayTimer: 0,
    overlaySubText: "",
    finisherStep: 0,
    finisherTimer: 0,
    screenFlash: 0,
    slowMoTimer: 0,
    menuAnimTimer: 0,
    roundStartTimer: 0,
    roundEndTimer: 0,
    winner: null,
    matchWinner: null,
  };
}

export default function FightingGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const gameStateRef = useRef<GameState | null>(null);
  const inputRef = useRef<InputState>({ ...EMPTY_INPUT });
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const prevPunchRef = useRef(false);
  const prevKickRef = useRef(false);
  const prevCrouchPunchRef = useRef(false);
  const prevCrouchKickRef = useRef(false);
  const prevFinisherRef = useRef(false);
  const prevUpRef = useRef(false);

  // Online multiplayer refs
  const gameModeRef = useRef<"vs-cpu" | "vs-online">("vs-cpu");
  const playerSlotRef = useRef<1 | 2>(1);
  const remoteInputRef = useRef<InputState>({ ...EMPTY_INPUT });
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  const [phase, setPhase] = useState<GameState["phase"]>("menu");
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>(
    [],
  );

  // Character select state + refs (refs for game loop access)
  const [p1CharIndex, setP1CharIndex] = useState(0);
  const [_p2CharIndex, setP2CharIndex] = useState(1);
  const [p1Confirmed, setP1Confirmed] = useState(false);
  const [p2Confirmed, setP2Confirmed] = useState(false);
  const p1CharIndexRef = useRef(0);
  const p2CharIndexRef = useRef(1);
  const p1ConfirmedRef = useRef(false);
  const p2ConfirmedRef = useRef(false);
  const leaderboardDataRef = useRef<typeof leaderboardData>([]);
  const recordMatchMutationRef = useRef<typeof recordMatchMutation | null>(
    null,
  );

  // Mobile / responsive state
  const [scale, setScale] = useState(1);
  const [isMobile, setIsMobile] = useState(false);
  const [isPortrait, setIsPortrait] = useState(false);
  const [mobileButtons, setMobileButtons] = useState<Record<string, boolean>>(
    {},
  );

  // Online lobby state
  const [showLobby, setShowLobby] = useState(false);
  const [lobbyRoomCode, setLobbyRoomCode] = useState("");
  const [lobbyPlayerSlot, setLobbyPlayerSlot] = useState<1 | 2>(1);

  const { actor } = useActor();
  const { identity } = useInternetIdentity();

  // === CANVAS SCALING + PORTRAIT DETECTION ===
  useEffect(() => {
    const update = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      // Reserve 40px for the keyboard legend on desktop, 0 on mobile
      const isTouchDevice =
        "ontouchstart" in window || navigator.maxTouchPoints > 0;
      const legendPad = isTouchDevice || vw < 900 ? 0 : 40;
      const computedScale = Math.min(
        vw / CANVAS_WIDTH,
        (vh - legendPad) / CANVAS_HEIGHT,
      );
      setScale(computedScale);

      const mobile = vw < 900 || isTouchDevice;
      setIsMobile(mobile);
      setIsPortrait(mobile && vh > vw);
    };

    // orientationchange fires before dimensions update — delay to get correct values
    const handleOrientation = () => setTimeout(update, 150);

    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", handleOrientation);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", handleOrientation);
    };
  }, []);

  // === CHECK URL FOR ROOM CODE (P2 joining) ===
  useEffect(() => {
    const roomCode = getRoomFromUrl();
    if (roomCode) {
      // Auto-join as P2
      const code = roomCode.toUpperCase();
      const channel = new BroadcastChannel(`street-kombat-${code}`);
      broadcastChannelRef.current = channel;

      // Listen for inputs from P1
      channel.onmessage = (e) => {
        if (e.data?.type === "input" && e.data.player === 1) {
          remoteInputRef.current = e.data.input;
        }
        // Online char select sync — P2 receives P1's selection
        if (e.data?.type === "charSelect" && e.data.index !== undefined) {
          const idx = Math.max(
            0,
            Math.min(CHARACTERS.length - 1, e.data.index),
          );
          // P2 sees P1's selection reflected in p1's slot (their opponent)
          p1CharIndexRef.current = idx;
          setP1CharIndex(idx);
        }
        if (e.data?.type === "charConfirm" && e.data.index !== undefined) {
          const idx = Math.max(
            0,
            Math.min(CHARACTERS.length - 1, e.data.index),
          );
          p1CharIndexRef.current = idx;
          setP1CharIndex(idx);
          p1ConfirmedRef.current = true;
          setP1Confirmed(true);
        }
      };

      gameModeRef.current = "vs-online";
      playerSlotRef.current = 2;
      setLobbyRoomCode(code);
      setLobbyPlayerSlot(2);
      setShowLobby(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Leaderboard query
  const { refetch: fetchLeaderboard } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: async () => {
      if (!actor) return [];
      const raw = await actor.getLeaderboard();
      return raw.map(([principal, stats]) => ({
        principal: principal.toString(),
        wins: Number(stats.wins),
        losses: Number(stats.losses),
        draws: Number(stats.draws),
      }));
    },
    enabled: false,
  });

  // Record match mutation
  const recordMatchMutation = useMutation({
    mutationFn: async (params: { result: "player" | "cpu" | "draw" }) => {
      if (!actor) return;
      const cpuPrincipal = Principal.fromText(CPU_PRINCIPAL);
      const rounds = BigInt(gameStateRef.current?.round ?? 1);
      if (params.result === "player") {
        await actor.recordMatch(cpuPrincipal, rounds);
      } else if (params.result === "draw") {
        await actor.recordDraw(cpuPrincipal);
      }
    },
  });

  const startGame = useCallback(() => {
    // Reset char select
    setP1CharIndex(0);
    p1CharIndexRef.current = 0;
    setP2CharIndex(1);
    p2CharIndexRef.current = 1;
    setP1Confirmed(false);
    p1ConfirmedRef.current = false;
    setP2Confirmed(false);
    p2ConfirmedRef.current = false;

    const gs = initGameState();
    gs.phase = "characterSelect";
    gs.menuAnimTimer = 0;
    gameStateRef.current = gs;
    setPhase("characterSelect");
  }, []);

  const proceedFromCharSelect = useCallback(() => {
    const p1Char = CHARACTERS[p1CharIndexRef.current];
    const p2Char = CHARACTERS[p2CharIndexRef.current];
    const gs = gameStateRef.current;
    if (!gs) return;

    gs.player = createPlayer(p1Char);
    gs.cpu = createCPU(p2Char);

    if (gameModeRef.current === "vs-online") {
      gs.cpu.name =
        playerSlotRef.current === 1 ? `P2 ${p2Char.name}` : `P1 ${p1Char.name}`;
    }

    gs.phase = "roundStart";
    gs.round = 1;
    gs.overlayText = "ROUND 1";
    gs.overlayTimer = 1500;
    gs.roundStartTimer = 1500;
    gameStateRef.current = gs;
    setPhase("roundStart");
  }, []);

  // Handle VS FRIEND button
  const handleVsFriend = useCallback(() => {
    const code = generateRoomCode();
    const channel = new BroadcastChannel(`street-kombat-${code}`);
    broadcastChannelRef.current = channel;

    // Listen for inputs from P2
    channel.onmessage = (e) => {
      if (e.data?.type === "input" && e.data.player === 2) {
        remoteInputRef.current = e.data.input;
      }
      // Also respond to ping
      if (e.data?.type === "ping") {
        channel.postMessage({ type: "ping", player: 1 });
      }
      // Online char select sync — P1 receives P2's selection
      if (e.data?.type === "charSelect" && e.data.index !== undefined) {
        const idx = Math.max(0, Math.min(CHARACTERS.length - 1, e.data.index));
        p2CharIndexRef.current = idx;
        setP2CharIndex(idx);
      }
      if (e.data?.type === "charConfirm" && e.data.index !== undefined) {
        const idx = Math.max(0, Math.min(CHARACTERS.length - 1, e.data.index));
        p2CharIndexRef.current = idx;
        setP2CharIndex(idx);
        p2ConfirmedRef.current = true;
        setP2Confirmed(true);
      }
    };

    gameModeRef.current = "vs-online";
    playerSlotRef.current = 1;
    setLobbyRoomCode(code);
    setLobbyPlayerSlot(1);
    setShowLobby(true);
  }, []);

  // When lobby starts the game
  const handleLobbyStart = useCallback(() => {
    setShowLobby(false);
    startGame();
  }, [startGame]);

  const handleLobbyCancel = useCallback(() => {
    setShowLobby(false);
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.close();
      broadcastChannelRef.current = null;
    }
    gameModeRef.current = "vs-cpu";
    // Remove room param from URL if joining
    if (getRoomFromUrl()) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Mobile input handlers
  const handleMobileDown = useCallback((key: string) => {
    setMobileButtons((prev) => ({ ...prev, [key]: true }));
    const inp = inputRef.current;
    if (key === "left") inp.left = true;
    else if (key === "right") inp.right = true;
    else if (key === "up") inp.up = true;
    else if (key === "down") inp.down = true;
    else if (key === "punch") inp.punch = true;
    else if (key === "kick") inp.kick = true;
    else if (key === "block") inp.block = true;
    else if (key === "crouchPunch") inp.crouchPunch = true;
    else if (key === "crouchKick") inp.crouchKick = true;
    else if (key === "finisher") inp.finisher = true;
  }, []);

  const handleMobileUp = useCallback((key: string) => {
    setMobileButtons((prev) => ({ ...prev, [key]: false }));
    const inp = inputRef.current;
    if (key === "left") inp.left = false;
    else if (key === "right") inp.right = false;
    else if (key === "up") inp.up = false;
    else if (key === "down") inp.down = false;
    else if (key === "punch") inp.punch = false;
    else if (key === "kick") inp.kick = false;
    else if (key === "block") inp.block = false;
    else if (key === "crouchPunch") inp.crouchPunch = false;
    else if (key === "crouchKick") inp.crouchKick = false;
    else if (key === "finisher") inp.finisher = false;
  }, []);

  // Keyboard events
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const inp = inputRef.current;
      const gs = gameStateRef.current;

      // Character select keyboard handling
      if (gs?.phase === "characterSelect") {
        if (e.code === "ArrowLeft" && !p1ConfirmedRef.current) {
          const newIdx =
            (p1CharIndexRef.current - 1 + CHARACTERS.length) %
            CHARACTERS.length;
          p1CharIndexRef.current = newIdx;
          setP1CharIndex(newIdx);
          // Broadcast in online mode
          if (
            gameModeRef.current === "vs-online" &&
            broadcastChannelRef.current
          ) {
            broadcastChannelRef.current.postMessage({
              type: "charSelect",
              index: newIdx,
            });
          }
          e.preventDefault();
          return;
        }
        if (e.code === "ArrowRight" && !p1ConfirmedRef.current) {
          const newIdx = (p1CharIndexRef.current + 1) % CHARACTERS.length;
          p1CharIndexRef.current = newIdx;
          setP1CharIndex(newIdx);
          if (
            gameModeRef.current === "vs-online" &&
            broadcastChannelRef.current
          ) {
            broadcastChannelRef.current.postMessage({
              type: "charSelect",
              index: newIdx,
            });
          }
          e.preventDefault();
          return;
        }
        if (
          (e.code === "Enter" || e.code === "KeyF") &&
          !p1ConfirmedRef.current
        ) {
          p1ConfirmedRef.current = true;
          setP1Confirmed(true);
          if (
            gameModeRef.current === "vs-online" &&
            broadcastChannelRef.current
          ) {
            broadcastChannelRef.current.postMessage({
              type: "charConfirm",
              index: p1CharIndexRef.current,
            });
          }
          // In CPU mode, CPU picks after short delay
          if (gameModeRef.current === "vs-cpu") {
            setTimeout(() => {
              const cpuPick = Math.floor(Math.random() * CHARACTERS.length);
              p2CharIndexRef.current = cpuPick;
              setP2CharIndex(cpuPick);
              p2ConfirmedRef.current = true;
              setP2Confirmed(true);
              // Proceed after another short delay
              setTimeout(() => {
                proceedFromCharSelect();
              }, 400);
            }, 500);
          }
          e.preventDefault();
          return;
        }
        e.preventDefault();
        return;
      }

      switch (e.code) {
        case "ArrowLeft":
          inp.left = true;
          e.preventDefault();
          break;
        case "ArrowRight":
          inp.right = true;
          e.preventDefault();
          break;
        case "ArrowUp":
          inp.up = true;
          e.preventDefault();
          break;
        case "ArrowDown":
          inp.down = true;
          e.preventDefault();
          break;
        case "KeyA":
          inp.punch = true;
          e.preventDefault();
          break;
        case "KeyS":
          inp.kick = true;
          e.preventDefault();
          break;
        case "KeyD":
          inp.block = true;
          e.preventDefault();
          break;
        case "KeyZ":
          inp.crouchPunch = true;
          e.preventDefault();
          break;
        case "KeyX":
          inp.crouchKick = true;
          e.preventDefault();
          break;
        case "KeyF":
          inp.finisher = true;
          e.preventDefault();
          break;
        case "Enter":
          if (gs?.phase === "menu") {
            startGame();
          } else if (gs?.phase === "matchEnd") {
            startGame();
          }
          e.preventDefault();
          break;
        case "KeyR":
          if (gs?.phase === "matchEnd") {
            startGame();
          }
          break;
        case "KeyL":
          if (gs?.phase === "matchEnd") {
            const curGs = gs;
            curGs.phase = "leaderboard";
            gameStateRef.current = curGs;
            setPhase("leaderboard");
            fetchLeaderboard().then((r) => {
              if (r.data) setLeaderboardData(r.data as LeaderboardEntry[]);
            });
          }
          break;
        case "Escape":
          if (gs?.phase === "leaderboard") {
            gs.phase = "matchEnd";
            gameStateRef.current = gs;
            setPhase("matchEnd");
          }
          break;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const inp = inputRef.current;
      switch (e.code) {
        case "ArrowLeft":
          inp.left = false;
          break;
        case "ArrowRight":
          inp.right = false;
          break;
        case "ArrowUp":
          inp.up = false;
          break;
        case "ArrowDown":
          inp.down = false;
          break;
        case "KeyA":
          inp.punch = false;
          break;
        case "KeyS":
          inp.kick = false;
          break;
        case "KeyD":
          inp.block = false;
          break;
        case "KeyZ":
          inp.crouchPunch = false;
          break;
        case "KeyX":
          inp.crouchKick = false;
          break;
        case "KeyF":
          inp.finisher = false;
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [startGame, fetchLeaderboard, proceedFromCharSelect]);

  // === BROADCAST OWN INPUT (online mode) ===
  useEffect(() => {
    // Broadcast our input every 50ms while in online mode
    const id = setInterval(() => {
      if (gameModeRef.current !== "vs-online") return;
      const ch = broadcastChannelRef.current;
      if (!ch) return;
      const gs = gameStateRef.current;
      if (gs?.phase !== "fighting" && gs?.phase !== "finisherSequence") return;

      ch.postMessage({
        type: "input",
        player: playerSlotRef.current,
        input: { ...inputRef.current },
      });
    }, 50);

    return () => clearInterval(id);
  }, []);

  // Handle online charConfirm: when both players have confirmed, proceed
  useEffect(() => {
    if (
      p1Confirmed &&
      p2Confirmed &&
      gameStateRef.current?.phase === "characterSelect" &&
      gameModeRef.current === "vs-online"
    ) {
      setTimeout(() => {
        proceedFromCharSelect();
      }, 600);
    }
  }, [p1Confirmed, p2Confirmed, proceedFromCharSelect]);

  // Keep refs in sync
  useEffect(() => {
    leaderboardDataRef.current = leaderboardData;
  }, [leaderboardData]);
  useEffect(() => {
    recordMatchMutationRef.current = recordMatchMutation;
  }, [recordMatchMutation]);

  // Main game loop
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (!gameStateRef.current) {
      gameStateRef.current = initGameState();
    }

    let isRunning = true;

    const gameLoop = (timestamp: number) => {
      if (!isRunning) return;

      const rawDt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = timestamp;

      const gs = gameStateRef.current!;
      const slowMo = gs.slowMoTimer > 0 ? 0.2 : 1.0;
      const dt = rawDt * slowMo;

      gs.menuAnimTimer += rawDt;
      gs.slowMoTimer = Math.max(0, gs.slowMoTimer - rawDt);
      gs.screenFlash = Math.max(0, gs.screenFlash - rawDt * 3);

      // === PHASE STATE MACHINE ===
      if (gs.phase === "menu") {
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        drawMenu(ctx, gs.menuAnimTimer);
      } else if (gs.phase === "characterSelect") {
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        drawCharacterSelect(
          ctx,
          CHARACTERS,
          p1CharIndexRef.current,
          p2CharIndexRef.current,
          p1ConfirmedRef.current,
          p2ConfirmedRef.current,
          gs.menuAnimTimer,
          gameModeRef.current === "vs-online",
        );
      } else if (gs.phase === "roundStart") {
        gs.roundStartTimer -= rawDt * 1000;

        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        drawBackground(ctx, gs.menuAnimTimer);
        drawFighter(ctx, gs.player, gs.menuAnimTimer);
        drawFighter(ctx, gs.cpu, gs.menuAnimTimer);
        drawHUD(ctx, gs, gs.menuAnimTimer);

        if (gs.roundStartTimer > 500) {
          drawOverlayText(
            ctx,
            `ROUND ${gs.round}`,
            "",
            gs.menuAnimTimer,
            gs.phase,
          );
        } else if (gs.roundStartTimer > 0) {
          drawOverlayText(ctx, "FIGHT!", "", gs.menuAnimTimer, gs.phase);
        } else {
          gs.phase = "fighting";
          setPhase("fighting");
        }
      } else if (gs.phase === "fighting") {
        // === PLAYER INPUT ===
        const inp = inputRef.current;

        const punchPulse = inp.punch && !prevPunchRef.current;
        const kickPulse = inp.kick && !prevKickRef.current;
        const crouchPunchPulse = inp.crouchPunch && !prevCrouchPunchRef.current;
        const crouchKickPulse = inp.crouchKick && !prevCrouchKickRef.current;
        const finisherPulse = inp.finisher && !prevFinisherRef.current;
        const upPulse = inp.up && !prevUpRef.current;

        prevPunchRef.current = inp.punch;
        prevKickRef.current = inp.kick;
        prevCrouchPunchRef.current = inp.crouchPunch;
        prevCrouchKickRef.current = inp.crouchKick;
        prevFinisherRef.current = inp.finisher;
        prevUpRef.current = inp.up;

        const singleFrameInput: InputState = {
          ...inp,
          punch: punchPulse,
          kick: kickPulse,
          crouchPunch: crouchPunchPulse,
          crouchKick: crouchKickPulse,
          finisher: finisherPulse,
          up: upPulse,
        };

        // Check finisher trigger
        if (finisherPulse && canExecuteFinisher(gs.player, gs.cpu)) {
          gs.phase = "finisherSequence";
          gs.finisherStep = 0;
          gs.finisherTimer = 0;
          gs.slowMoTimer = 3;
          gs.screenFlash = 0.8;
          gs.overlayText = "FINISH HIM!";
          gs.overlayTimer = 2000;
          setPhase("finisherSequence");
          // Rumble: entering finisher sequence
          rumble([200, 100, 200, 100, 200]);
        } else {
          processPlayerInput(
            gs.player,
            singleFrameInput,
            gs.projectiles,
            gs.particles,
            gs.hitEffects,
            timestamp,
          );
        }

        // === CPU / P2 CONTROL ===
        if (gameModeRef.current === "vs-online") {
          // Use remote input for the "cpu" fighter
          const remoteInp = remoteInputRef.current;
          const remoteEdgeInput: InputState = { ...remoteInp };
          processPlayerInput(
            gs.cpu,
            remoteEdgeInput,
            gs.projectiles,
            gs.particles,
            gs.hitEffects,
            timestamp,
          );
        } else {
          // Normal CPU AI
          updateCPU(
            gs.cpu,
            gs.player,
            gs.projectiles,
            gs.particles,
            gs.hitEffects,
            dt,
            timestamp,
          );

          // CPU finisher trigger
          if (
            gs.cpu.state === "finisher" &&
            canExecuteFinisher(gs.cpu, gs.player)
          ) {
            executeFinisher(gs.cpu, gs.player, gs.particles, gs.hitEffects, 0);
            executeFinisher(gs.cpu, gs.player, gs.particles, gs.hitEffects, 4);
            gs.cpu.state = "idle";
            gs.screenFlash = 0.5;
          } else if (gs.cpu.state === "finisher") {
            gs.cpu.state = "idle";
          }
        }

        // === PHYSICS ===
        applyPhysics(gs.player, dt);
        applyPhysics(gs.cpu, dt);
        updateFacing(gs.player, gs.cpu);

        // === COLLISION + RUMBLE ===
        const hitPlayer = checkMeleeCollisions(
          gs.player,
          gs.cpu,
          gs.particles,
          gs.hitEffects,
        );
        const hitCpu = checkMeleeCollisions(
          gs.cpu,
          gs.player,
          gs.particles,
          gs.hitEffects,
        );

        if (hitPlayer.hit) {
          if (hitPlayer.type === "knockdown") {
            rumble([150, 50, 150]);
          } else {
            rumble(60);
          }
        }
        if (hitCpu.hit) {
          if (hitCpu.type === "knockdown") {
            rumble([150, 50, 150]);
          } else {
            rumble(100);
          }
        }

        gs.projectiles = checkProjectileCollisions(
          gs.projectiles,
          gs.player,
          gs.cpu,
          gs.particles,
          gs.hitEffects,
        );

        // === TIMERS ===
        updateFighterTimers(gs.player, dt);
        updateFighterTimers(gs.cpu, dt);

        // === UPDATE EFFECTS ===
        gs.particles = updateParticles(gs.particles, dt);
        gs.hitEffects = updateHitEffects(gs.hitEffects, dt);
        gs.projectiles = updateProjectiles(gs.projectiles, dt);

        // === ROUND TIMER ===
        gs.timerAccum += dt;
        if (gs.timerAccum >= 1) {
          gs.timerAccum -= 1;
          gs.timer = Math.max(0, gs.timer - 1);
        }

        // === FINISH HIM PROMPT ===
        if (canExecuteFinisher(gs.player, gs.cpu)) {
          gs.overlayText = "FINISH HIM!";
          gs.overlayTimer = 500;
        }

        // === ROUND END CHECK ===
        const roundResult = checkRoundEnd(gs);
        if (roundResult) {
          const cpuLabel = gameModeRef.current === "vs-online" ? "P2" : "CPU";
          if (roundResult === "player") {
            gs.player.roundsWon++;
            gs.overlayText = gs.cpu.health === 0 ? "KO!" : "TIME!";
            gs.overlaySubText = `${gs.player.name} WINS!`;
          } else if (roundResult === "cpu") {
            gs.cpu.roundsWon++;
            gs.overlayText = gs.player.health === 0 ? "KO!" : "TIME!";
            gs.overlaySubText = `${cpuLabel} ${gs.cpu.name} WINS!`;
            if (gs.player.health <= 0 && gs.cpu.health === gs.cpu.maxHealth) {
              gs.overlaySubText = "PERFECT!";
            }
          } else {
            gs.overlayText = "DRAW!";
            gs.overlaySubText = "";
          }
          gs.phase = "roundEnd";
          gs.roundEndTimer = 2500;
          gs.winner = roundResult;
          setPhase("roundEnd");
          // Rumble on KO
          rumble([100, 50, 100, 50, 200]);
        }

        // === RENDER ===
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        drawBackground(ctx, gs.menuAnimTimer);
        drawParticles(ctx, gs.particles);
        for (const proj of gs.projectiles)
          drawProjectile(ctx, proj, gs.menuAnimTimer);
        drawFighter(ctx, gs.player, gs.menuAnimTimer);
        drawFighter(ctx, gs.cpu, gs.menuAnimTimer);
        drawHitEffects(ctx, gs.hitEffects);
        drawHUD(ctx, gs, gs.menuAnimTimer);
        if (canExecuteFinisher(gs.player, gs.cpu)) {
          drawOverlayText(ctx, "FINISH HIM!", "", gs.menuAnimTimer, gs.phase);
        }
        drawScreenFlash(ctx, gs.screenFlash);
      } else if (gs.phase === "roundEnd") {
        gs.roundEndTimer -= rawDt * 1000;

        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        drawBackground(ctx, gs.menuAnimTimer);
        drawFighter(ctx, gs.player, gs.menuAnimTimer);
        drawFighter(ctx, gs.cpu, gs.menuAnimTimer);
        drawHUD(ctx, gs, gs.menuAnimTimer);
        drawOverlayText(
          ctx,
          gs.overlayText,
          gs.overlaySubText,
          gs.menuAnimTimer,
          gs.phase,
        );
        drawScreenFlash(ctx, gs.screenFlash);

        if (gs.roundEndTimer <= 0) {
          if (gs.player.roundsWon >= ROUNDS_TO_WIN) {
            gs.matchWinner = "player";
            gs.phase = "matchEnd";
            setPhase("matchEnd");
            recordMatchMutationRef.current?.mutate({ result: "player" });
          } else if (gs.cpu.roundsWon >= ROUNDS_TO_WIN) {
            gs.matchWinner = "cpu";
            gs.phase = "matchEnd";
            setPhase("matchEnd");
          } else if (gs.winner === "draw" && gs.round >= 3) {
            gs.matchWinner = "draw";
            gs.phase = "matchEnd";
            setPhase("matchEnd");
            recordMatchMutationRef.current?.mutate({ result: "draw" });
          } else {
            gs.round++;
            const p1CharDef = CHARACTERS[p1CharIndexRef.current];
            const p2CharDef = CHARACTERS[p2CharIndexRef.current];
            const { player, cpu } = resetRound(
              gs.player,
              gs.cpu,
              p1CharDef,
              p2CharDef,
            );
            gs.player = player;
            gs.cpu = cpu;
            gs.timer = 99;
            gs.timerAccum = 0;
            gs.projectiles = [];
            gs.particles = [];
            gs.hitEffects = [];
            gs.overlayText = `ROUND ${gs.round}`;
            gs.overlaySubText = "";
            gs.roundStartTimer = 1500;
            gs.phase = "roundStart";
            setPhase("roundStart");
          }
        }
      } else if (gs.phase === "finisherSequence") {
        gs.finisherTimer -= rawDt * 1000;

        if (gs.finisherTimer <= 0) {
          if (gs.finisherStep < 5) {
            executeFinisher(
              gs.player,
              gs.cpu,
              gs.particles,
              gs.hitEffects,
              gs.finisherStep,
            );
            gs.finisherStep++;
            gs.finisherTimer = gs.finisherStep < 5 ? 400 : 800;
            gs.screenFlash = 0.6;

            // Rumble on each finisher step
            if (gs.finisherStep >= 5) {
              gs.overlayText = "SUPREME FINISH!";
              gs.overlaySubText = `${gs.player.name} WINS!`;
              gs.overlayTimer = 2000;
              // Big rumble for SUPREME FINISH
              rumble([300, 100, 300, 100, 500]);
            } else {
              rumble([100, 50, 100]);
            }
          } else {
            gs.player.roundsWon++;
            gs.phase = "roundEnd";
            gs.roundEndTimer = 2500;
            gs.slowMoTimer = 0;
            setPhase("roundEnd");
          }
        }

        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        drawBackground(ctx, gs.menuAnimTimer);
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        drawParticles(ctx, gs.particles);
        drawFighter(ctx, gs.player, gs.menuAnimTimer);
        drawFighter(ctx, gs.cpu, gs.menuAnimTimer);
        drawHitEffects(ctx, gs.hitEffects);
        drawHUD(ctx, gs, gs.menuAnimTimer);
        drawOverlayText(
          ctx,
          gs.overlayText,
          gs.overlaySubText,
          gs.menuAnimTimer,
          gs.phase,
        );
        drawScreenFlash(ctx, gs.screenFlash);

        gs.particles = updateParticles(gs.particles, dt);
        gs.hitEffects = updateHitEffects(gs.hitEffects, dt);
        applyPhysics(gs.cpu, dt);
        updateFighterTimers(gs.cpu, dt);
      } else if (gs.phase === "matchEnd") {
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        drawBackground(ctx, gs.menuAnimTimer);
        drawFighter(ctx, gs.player, gs.menuAnimTimer);
        drawFighter(ctx, gs.cpu, gs.menuAnimTimer);
        drawMatchEnd(ctx, gs.matchWinner, gs.menuAnimTimer);
      } else if (gs.phase === "leaderboard") {
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        drawBackground(ctx, gs.menuAnimTimer);
        drawLeaderboard(ctx, leaderboardDataRef.current, gs.menuAnimTimer);
      }

      rafRef.current = requestAnimationFrame(gameLoop);
    };

    rafRef.current = requestAnimationFrame((ts) => {
      lastTimeRef.current = ts;
      rafRef.current = requestAnimationFrame(gameLoop);
    });

    return () => {
      isRunning = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Overlay text clearing
  // biome-ignore lint/correctness/useExhaustiveDependencies: we use phase as a trigger to read gameStateRef imperatively
  useEffect(() => {
    const gs = gameStateRef.current;
    if (!gs) return;
    if (gs.overlayTimer > 0) {
      const timeout = setTimeout(() => {
        if (gameStateRef.current) {
          gameStateRef.current.overlayText = "";
          gameStateRef.current.overlaySubText = "";
          gameStateRef.current.overlayTimer = 0;
        }
      }, gs.overlayTimer);
      return () => clearTimeout(timeout);
    }
  }, [phase]);

  const handleStartClick = useCallback(() => {
    const gs = gameStateRef.current;
    if (!gs) return;
    if (gs.phase === "menu") {
      startGame();
    } else if (gs.phase === "matchEnd") {
      startGame();
    }
  }, [startGame]);

  const handleLeaderboardClick = useCallback(() => {
    const gs = gameStateRef.current;
    if (!gs || gs.phase !== "matchEnd") return;
    gs.phase = "leaderboard";
    gameStateRef.current = gs;
    setPhase("leaderboard");
    fetchLeaderboard().then((r) => {
      if (r.data) setLeaderboardData(r.data as LeaderboardEntry[]);
    });
  }, [fetchLeaderboard]);

  // Calculate scaled positions for overlay buttons
  const wrapperW = CANVAS_WIDTH * scale;
  const wrapperH = CANVAS_HEIGHT * scale;

  // Mobile controls visibility: show whenever in game phases, even if not mobile
  // (mobile detection via touch / screen width)
  const showMobileControls =
    isMobile && (phase === "fighting" || phase === "finisherSequence");
  const showMobileCharSelect = isMobile && phase === "characterSelect";

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "radial-gradient(ellipse at center, #0d0d1a 0%, #0a0a0f 70%)",
        position: "relative",
      }}
    >
      {/* Portrait lock overlay */}
      {isPortrait && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "#040408",
            zIndex: 9999,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "'Geist Mono', monospace",
            gap: 24,
          }}
          data-ocid="rotate.panel"
        >
          {/* Animated rotation icon */}
          <div
            style={{
              position: "relative",
              width: 80,
              height: 80,
            }}
          >
            <svg
              viewBox="0 0 80 80"
              width="80"
              height="80"
              role="img"
              aria-label="Rotate your device to landscape"
              style={{ animation: "rotatePhone 2s ease-in-out infinite" }}
            >
              <style>{`
                @keyframes rotatePhone {
                  0% { transform: rotate(0deg); }
                  40% { transform: rotate(90deg); }
                  60% { transform: rotate(90deg); }
                  100% { transform: rotate(90deg); }
                }
              `}</style>
              {/* Phone outline */}
              <rect
                x="20"
                y="8"
                width="40"
                height="64"
                rx="6"
                fill="none"
                stroke="#00d4ff"
                strokeWidth="3"
                style={{ filter: "drop-shadow(0 0 6px #00d4ff)" }}
              />
              {/* Screen */}
              <rect
                x="25"
                y="16"
                width="30"
                height="44"
                rx="2"
                fill="rgba(0,212,255,0.1)"
                stroke="rgba(0,212,255,0.4)"
                strokeWidth="1"
              />
              {/* Home button */}
              <circle
                cx="40"
                cy="66"
                r="4"
                fill="none"
                stroke="#00d4ff"
                strokeWidth="2"
              />
              {/* Rotation arrow */}
              <path
                d="M 8 20 Q 4 40 8 60 Q 10 68 18 70"
                fill="none"
                stroke="#ff00aa"
                strokeWidth="2.5"
                strokeLinecap="round"
                style={{ filter: "drop-shadow(0 0 4px #ff00aa)" }}
              />
              <polygon
                points="14,64 18,70 22,65"
                fill="#ff00aa"
                style={{ filter: "drop-shadow(0 0 4px #ff00aa)" }}
              />
            </svg>
          </div>

          <div
            style={{
              textAlign: "center",
              maxWidth: 240,
            }}
          >
            <div
              style={{
                fontSize: 18,
                fontWeight: 900,
                letterSpacing: "0.08em",
                color: "#00d4ff",
                textShadow: "0 0 15px #00d4ff",
                marginBottom: 8,
              }}
            >
              ROTATE YOUR DEVICE
            </div>
            <div
              style={{
                fontSize: 13,
                color: "rgba(255,238,0,0.8)",
                letterSpacing: "0.05em",
                textShadow: "0 0 8px rgba(255,238,0,0.4)",
              }}
            >
              TO PLAY
            </div>
          </div>

          {/* Grid background */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage:
                "linear-gradient(rgba(0,212,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.03) 1px, transparent 1px)",
              backgroundSize: "30px 30px",
              pointerEvents: "none",
            }}
          />
        </div>
      )}

      {/* Online lobby overlay */}
      <AnimatePresence>
        {showLobby && (
          <OnlineLobby
            roomCode={lobbyRoomCode}
            playerSlot={lobbyPlayerSlot}
            onStart={handleLobbyStart}
            onCancel={handleLobbyCancel}
            channelRef={broadcastChannelRef}
          />
        )}
      </AnimatePresence>

      {/* Game wrapper — scaled to fit viewport */}
      <div
        ref={wrapperRef}
        style={{
          position: "relative",
          width: CANVAS_WIDTH,
          height: CANVAS_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          marginLeft: (window.innerWidth - wrapperW) / 2,
          marginTop: (window.innerHeight - wrapperH) / 2,
          touchAction: "none",
          userSelect: "none",
        }}
        className="game-wrapper-scaled"
      >
        {/* CRT scanline overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)",
            pointerEvents: "none",
            zIndex: 10,
          }}
        />

        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          style={{
            display: "block",
            width: CANVAS_WIDTH,
            height: CANVAS_HEIGHT,
            imageRendering: "pixelated",
            border: "2px solid #00d4ff",
            boxShadow:
              "0 0 20px #00d4ff, 0 0 60px rgba(0,212,255,0.15), inset 0 0 20px rgba(0,212,255,0.05)",
            cursor: "none",
          }}
          data-ocid="game.canvas_target"
          tabIndex={0}
          onFocus={() => {}}
        />

        {/* Invisible click overlay for menu / matchEnd */}
        {phase === "menu" && (
          <button
            type="button"
            style={{
              position: "absolute",
              inset: 0,
              opacity: 0,
              cursor: "pointer",
              zIndex: 20,
              width: "100%",
              height: "100%",
            }}
            onClick={handleStartClick}
            data-ocid="menu.primary_button"
            aria-label="Press Enter to Fight"
          />
        )}

        {/* VS FRIEND button on menu */}
        {phase === "menu" && (
          <button
            type="button"
            onClick={handleVsFriend}
            data-ocid="menu.vs_friend_button"
            style={{
              position: "absolute",
              bottom: 60,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 25,
              background: "rgba(255,0,170,0.15)",
              border: "2px solid #ff00aa",
              color: "#ff00aa",
              fontFamily: "'Geist Mono', monospace",
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: "0.1em",
              padding: "8px 20px",
              cursor: "pointer",
              boxShadow: "0 0 12px rgba(255,0,170,0.3)",
              transition: "all 0.15s",
              pointerEvents: "auto",
            }}
            aria-label="Play with a friend online"
          >
            ⚡ VS FRIEND
          </button>
        )}

        {phase === "matchEnd" && (
          <>
            <button
              type="button"
              style={{
                position: "absolute",
                opacity: 0,
                zIndex: 20,
                left: "calc(50% - 120px)",
                top: "60%",
                width: 100,
                height: 36,
              }}
              onClick={handleStartClick}
              data-ocid="match_end.primary_button"
              aria-label="Play Again"
            />
            <button
              type="button"
              style={{
                position: "absolute",
                opacity: 0,
                zIndex: 20,
                left: "calc(50% + 20px)",
                top: "60%",
                width: 110,
                height: 36,
              }}
              onClick={handleLeaderboardClick}
              data-ocid="match_end.secondary_button"
              aria-label="View Leaderboard"
            />
          </>
        )}

        {phase === "leaderboard" && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 5,
              pointerEvents: "none",
            }}
            data-ocid="leaderboard.panel"
          />
        )}

        {/* Mobile controls — landscape phone layout */}
        {showMobileControls && (
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              padding: "6px 10px 8px",
              background: "rgba(6, 6, 18, 0)",
              borderTop: "none",
              zIndex: 20,
              gap: 8,
            }}
            data-ocid="mobile_controls.panel"
          >
            {/* D-Pad */}
            <DPad
              mobileButtons={mobileButtons}
              handleMobileDown={handleMobileDown}
              handleMobileUp={handleMobileUp}
            />

            {/* Action buttons — 2 rows × 3 cols */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 62px)",
                gridTemplateRows: "repeat(2, 62px)",
                gap: 6,
              }}
            >
              <MobileActionBtn
                label="PUNCH"
                symbol="Y"
                active={!!mobileButtons.punch}
                onDown={() => handleMobileDown("punch")}
                onUp={() => handleMobileUp("punch")}
                color="#ffee00"
                data-ocid="mobile_controls.button"
              />
              <MobileActionBtn
                label="KICK"
                symbol="B"
                active={!!mobileButtons.kick}
                onDown={() => handleMobileDown("kick")}
                onUp={() => handleMobileUp("kick")}
                color="#ff2244"
              />
              <MobileActionBtn
                label="BLOCK"
                symbol="A"
                active={!!mobileButtons.block}
                onDown={() => handleMobileDown("block")}
                onUp={() => handleMobileUp("block")}
                color="#00ff88"
              />
              <MobileActionBtn
                label="C.PCH"
                symbol="X"
                active={!!mobileButtons.crouchPunch}
                onDown={() => handleMobileDown("crouchPunch")}
                onUp={() => handleMobileUp("crouchPunch")}
                color="#00d4ff"
              />
              <MobileActionBtn
                label="C.KCK"
                symbol="ZL"
                active={!!mobileButtons.crouchKick}
                onDown={() => handleMobileDown("crouchKick")}
                onUp={() => handleMobileUp("crouchKick")}
                color="#00d4ff"
              />
              <MobileActionBtn
                label="FINISH"
                symbol="ZR"
                active={!!mobileButtons.finisher}
                onDown={() => handleMobileDown("finisher")}
                onUp={() => handleMobileUp("finisher")}
                color="#ff2244"
                pulse
              />
            </div>
          </div>
        )}

        {/* Mobile character select controls */}
        {showMobileCharSelect && (
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "10px 12px 12px",
              background: "rgba(6, 6, 18, 0.95)",
              borderTop: "none",
              zIndex: 20,
              gap: 8,
              fontFamily: "'Geist Mono', monospace",
            }}
            data-ocid="char_select.panel"
          >
            {/* Character name display */}
            <div
              style={{
                fontSize: 14,
                fontWeight: 800,
                color: CHARACTERS[p1CharIndex]?.color ?? "#00d4ff",
                letterSpacing: "0.1em",
                textShadow: `0 0 10px ${CHARACTERS[p1CharIndex]?.accentColor ?? "#00d4ff"}`,
              }}
            >
              {CHARACTERS[p1CharIndex]?.name ?? ""}
              {" — "}
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>
                {CHARACTERS[p1CharIndex]?.description ?? ""}
              </span>
            </div>
            {/* Nav + pick buttons */}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                data-ocid="char_select.button"
                disabled={p1Confirmed}
                onTouchStart={(e) => {
                  e.preventDefault();
                  if (p1Confirmed) return;
                  const newIdx =
                    (p1CharIndexRef.current - 1 + CHARACTERS.length) %
                    CHARACTERS.length;
                  p1CharIndexRef.current = newIdx;
                  setP1CharIndex(newIdx);
                }}
                onMouseDown={() => {
                  if (p1Confirmed) return;
                  const newIdx =
                    (p1CharIndexRef.current - 1 + CHARACTERS.length) %
                    CHARACTERS.length;
                  p1CharIndexRef.current = newIdx;
                  setP1CharIndex(newIdx);
                }}
                style={{
                  padding: "10px 18px",
                  fontSize: 18,
                  background: "rgba(0,212,255,0.1)",
                  border: "2px solid #00d4ff",
                  color: "#00d4ff",
                  fontFamily: "'Geist Mono', monospace",
                  cursor: "pointer",
                  opacity: p1Confirmed ? 0.3 : 1,
                }}
              >
                ◀
              </button>
              <button
                type="button"
                data-ocid="char_select.primary_button"
                disabled={p1Confirmed}
                onTouchStart={(e) => {
                  e.preventDefault();
                  if (p1Confirmed) return;
                  p1ConfirmedRef.current = true;
                  setP1Confirmed(true);
                  if (gameModeRef.current === "vs-cpu") {
                    setTimeout(() => {
                      const cpuPick = Math.floor(
                        Math.random() * CHARACTERS.length,
                      );
                      p2CharIndexRef.current = cpuPick;
                      setP2CharIndex(cpuPick);
                      p2ConfirmedRef.current = true;
                      setP2Confirmed(true);
                      setTimeout(() => proceedFromCharSelect(), 400);
                    }, 500);
                  }
                }}
                onMouseDown={() => {
                  if (p1Confirmed) return;
                  p1ConfirmedRef.current = true;
                  setP1Confirmed(true);
                  if (gameModeRef.current === "vs-cpu") {
                    setTimeout(() => {
                      const cpuPick = Math.floor(
                        Math.random() * CHARACTERS.length,
                      );
                      p2CharIndexRef.current = cpuPick;
                      setP2CharIndex(cpuPick);
                      p2ConfirmedRef.current = true;
                      setP2Confirmed(true);
                      setTimeout(() => proceedFromCharSelect(), 400);
                    }, 500);
                  }
                }}
                style={{
                  padding: "10px 24px",
                  fontSize: 13,
                  fontWeight: 800,
                  background: p1Confirmed
                    ? "rgba(0,255,136,0.2)"
                    : "rgba(0,212,255,0.15)",
                  border: `2px solid ${p1Confirmed ? "#00ff88" : "#00d4ff"}`,
                  color: p1Confirmed ? "#00ff88" : "#00d4ff",
                  fontFamily: "'Geist Mono', monospace",
                  letterSpacing: "0.08em",
                  cursor: "pointer",
                  opacity: p1Confirmed ? 0.6 : 1,
                }}
              >
                {p1Confirmed ? "✓ READY!" : "PICK!"}
              </button>
              <button
                type="button"
                data-ocid="char_select.button"
                disabled={p1Confirmed}
                onTouchStart={(e) => {
                  e.preventDefault();
                  if (p1Confirmed) return;
                  const newIdx =
                    (p1CharIndexRef.current + 1) % CHARACTERS.length;
                  p1CharIndexRef.current = newIdx;
                  setP1CharIndex(newIdx);
                }}
                onMouseDown={() => {
                  if (p1Confirmed) return;
                  const newIdx =
                    (p1CharIndexRef.current + 1) % CHARACTERS.length;
                  p1CharIndexRef.current = newIdx;
                  setP1CharIndex(newIdx);
                }}
                style={{
                  padding: "10px 18px",
                  fontSize: 18,
                  background: "rgba(0,212,255,0.1)",
                  border: "2px solid #00d4ff",
                  color: "#00d4ff",
                  fontFamily: "'Geist Mono', monospace",
                  cursor: "pointer",
                  opacity: p1Confirmed ? 0.3 : 1,
                }}
              >
                ▶
              </button>
            </div>
          </div>
        )}

        {/* Desktop keyboard legend */}
        {!isMobile &&
          (phase === "fighting" || phase === "finisherSequence") && (
            <div
              style={{
                position: "absolute",
                bottom: 8,
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 20,
                display: "flex",
                gap: 20,
                alignItems: "center",
                background: "rgba(4, 4, 14, 0.75)",
                border: "1px solid rgba(0,212,255,0.25)",
                borderRadius: 6,
                padding: "6px 16px",
                backdropFilter: "blur(6px)",
                fontFamily: "'Geist Mono', monospace",
                fontSize: 10,
                letterSpacing: "0.05em",
                color: "rgba(200,230,255,0.65)",
                pointerEvents: "none",
                whiteSpace: "nowrap",
              }}
              data-ocid="desktop_controls.panel"
            >
              <span
                style={{
                  color: "rgba(0,212,255,0.8)",
                  fontWeight: 700,
                  fontSize: 9,
                  letterSpacing: "0.12em",
                }}
              >
                P1
              </span>
              {[
                ["←→", "Move"],
                ["↑", "Jump"],
                ["↓", "Crouch"],
                ["A", "Punch"],
                ["S", "Kick"],
                ["D", "Block"],
                ["F", "Finish"],
              ].map(([key, label]) => (
                <span
                  key={key}
                  style={{ display: "flex", alignItems: "center", gap: 4 }}
                >
                  <kbd
                    style={{
                      background: "rgba(0,212,255,0.12)",
                      border: "1px solid rgba(0,212,255,0.35)",
                      borderRadius: 3,
                      padding: "1px 5px",
                      fontSize: 10,
                      color: "#00d4ff",
                      fontFamily: "'Geist Mono', monospace",
                    }}
                  >
                    {key}
                  </kbd>
                  <span style={{ opacity: 0.6 }}>{label}</span>
                </span>
              ))}
            </div>
          )}

        {/* Desktop character select hint */}
        {!isMobile && phase === "characterSelect" && (
          <div
            style={{
              position: "absolute",
              bottom: 8,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 20,
              display: "flex",
              gap: 16,
              alignItems: "center",
              background: "rgba(4, 4, 14, 0.75)",
              border: "1px solid rgba(0,212,255,0.25)",
              borderRadius: 6,
              padding: "6px 16px",
              backdropFilter: "blur(6px)",
              fontFamily: "'Geist Mono', monospace",
              fontSize: 10,
              letterSpacing: "0.05em",
              color: "rgba(200,230,255,0.65)",
              pointerEvents: "none",
              whiteSpace: "nowrap",
            }}
            data-ocid="desktop_char_select.panel"
          >
            {[
              ["← →", "Select"],
              ["Enter", "Confirm"],
            ].map(([key, label]) => (
              <span
                key={key}
                style={{ display: "flex", alignItems: "center", gap: 4 }}
              >
                <kbd
                  style={{
                    background: "rgba(0,212,255,0.12)",
                    border: "1px solid rgba(0,212,255,0.35)",
                    borderRadius: 3,
                    padding: "1px 5px",
                    fontSize: 10,
                    color: "#00d4ff",
                    fontFamily: "'Geist Mono', monospace",
                  }}
                >
                  {key}
                </kbd>
                <span style={{ opacity: 0.6 }}>{label}</span>
              </span>
            ))}
          </div>
        )}

        {/* Desktop menu hint */}
        {!isMobile && (phase === "menu" || phase === "matchEnd") && (
          <div
            style={{
              position: "absolute",
              bottom: 12,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 20,
              background: "rgba(4, 4, 14, 0.75)",
              border: "1px solid rgba(0,212,255,0.25)",
              borderRadius: 6,
              padding: "5px 14px",
              backdropFilter: "blur(6px)",
              fontFamily: "'Geist Mono', monospace",
              fontSize: 10,
              letterSpacing: "0.1em",
              color: "rgba(200,230,255,0.65)",
              pointerEvents: "none",
              whiteSpace: "nowrap",
            }}
            data-ocid="desktop_menu.panel"
          >
            <kbd
              style={{
                background: "rgba(0,212,255,0.12)",
                border: "1px solid rgba(0,212,255,0.35)",
                borderRadius: 3,
                padding: "1px 6px",
                fontSize: 10,
                color: "#00d4ff",
                fontFamily: "'Geist Mono', monospace",
              }}
            >
              Enter
            </kbd>
            <span style={{ marginLeft: 6 }}>
              {phase === "menu" ? "Start Game" : "Play Again"}
            </span>
          </div>
        )}

        {/* Mobile start buttons */}
        {isMobile && (phase === "menu" || phase === "matchEnd") && (
          <div
            style={{
              position: "absolute",
              bottom: 16,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 30,
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            <button
              type="button"
              style={{
                padding: "10px 20px",
                fontSize: 13,
                fontWeight: 800,
                background: "rgba(0,212,255,0.15)",
                border: "2px solid #00d4ff",
                color: "#00d4ff",
                fontFamily: "'Geist Mono', monospace",
                letterSpacing: "0.08em",
              }}
              onClick={handleStartClick}
              data-ocid="menu.primary_button"
            >
              {phase === "menu" ? "FIGHT!" : "PLAY AGAIN"}
            </button>
            {phase === "menu" && (
              <button
                type="button"
                style={{
                  padding: "10px 20px",
                  fontSize: 13,
                  fontWeight: 800,
                  background: "rgba(255,0,170,0.15)",
                  border: "2px solid #ff00aa",
                  color: "#ff00aa",
                  fontFamily: "'Geist Mono', monospace",
                  letterSpacing: "0.08em",
                }}
                onClick={handleVsFriend}
                data-ocid="menu.vs_friend_button"
              >
                ⚡ VS FRIEND
              </button>
            )}
            {phase === "matchEnd" && (
              <button
                type="button"
                style={{
                  padding: "10px 20px",
                  fontSize: 13,
                  fontWeight: 800,
                  background: "rgba(255,238,0,0.15)",
                  border: "2px solid #ffee00",
                  color: "#ffee00",
                  fontFamily: "'Geist Mono', monospace",
                  letterSpacing: "0.08em",
                }}
                onClick={handleLeaderboardClick}
              >
                SCORES
              </button>
            )}
          </div>
        )}
      </div>

      {/* Login prompt for score saving */}
      {!identity && phase === "matchEnd" && (
        <div
          style={{
            position: "fixed",
            bottom: 20,
            right: 20,
            background: "rgba(10,10,20,0.9)",
            border: "1px solid rgba(0,212,255,0.3)",
            padding: "8px 12px",
            borderRadius: 4,
            fontFamily: "'Geist Mono', monospace",
            fontSize: 11,
            color: "rgba(0,212,255,0.7)",
            zIndex: 50,
          }}
        >
          Login to save scores
        </div>
      )}
    </div>
  );
}

// === MOBILE BUTTON HELPERS ===

// ─── Joy-Con Style D-Pad ────────────────────────────────────────────────────
interface DPadProps {
  mobileButtons: Record<string, boolean | undefined>;
  handleMobileDown: (key: string) => void;
  handleMobileUp: (key: string) => void;
}

function DPad({ mobileButtons, handleMobileDown, handleMobileUp }: DPadProps) {
  const size = 148;
  const armW = 46;
  const armH = 58;
  const center = size / 2;

  const makeArm = (key: string, style: React.CSSProperties, arrow: string) => {
    const active = !!mobileButtons[key];
    return (
      <div
        key={key}
        onTouchStart={(e) => {
          e.preventDefault();
          handleMobileDown(key);
        }}
        onTouchEnd={(e) => {
          e.preventDefault();
          handleMobileUp(key);
        }}
        onMouseDown={() => handleMobileDown(key)}
        onMouseUp={() => handleMobileUp(key)}
        onMouseLeave={() => handleMobileUp(key)}
        style={{
          position: "absolute",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 6,
          cursor: "pointer",
          userSelect: "none",
          WebkitTapHighlightColor: "transparent",
          touchAction: "manipulation",
          background: active ? "rgba(0,212,255,0.38)" : "rgba(0,212,255,0.10)",
          border: `1.5px solid ${active ? "#00d4ff" : "rgba(0,212,255,0.35)"}`,
          boxShadow: active
            ? "0 0 14px #00d4ff, inset 0 0 8px rgba(0,212,255,0.4)"
            : "inset 0 0 4px rgba(0,212,255,0.15)",
          transition: "all 0.07s ease",
          color: active ? "#00d4ff" : "rgba(0,212,255,0.6)",
          fontSize: 14,
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          transform: active ? "scale(0.94)" : "scale(1)",
          ...style,
        }}
      >
        {arrow}
      </div>
    );
  };

  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        flexShrink: 0,
      }}
    >
      {/* Outer disc */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: "rgba(0,0,0,0.45)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          border: "2px solid rgba(0,212,255,0.25)",
          boxShadow:
            "0 4px 24px rgba(0,0,0,0.5), inset 0 0 20px rgba(0,212,255,0.05)",
        }}
      />
      {/* Up */}
      {makeArm(
        "up",
        {
          width: armW,
          height: armH,
          top: center - armH - armW / 2 + armW / 2,
          left: center - armW / 2,
        },
        "▲",
      )}
      {/* Down */}
      {makeArm(
        "down",
        {
          width: armW,
          height: armH,
          bottom: center - armH - armW / 2 + armW / 2,
          left: center - armW / 2,
        },
        "▼",
      )}
      {/* Left */}
      {makeArm(
        "left",
        {
          width: armH,
          height: armW,
          left: center - armH - armW / 2 + armW / 2,
          top: center - armW / 2,
        },
        "◀",
      )}
      {/* Right */}
      {makeArm(
        "right",
        {
          width: armH,
          height: armW,
          right: center - armH - armW / 2 + armW / 2,
          top: center - armW / 2,
        },
        "▶",
      )}
      {/* Center nub */}
      <div
        style={{
          position: "absolute",
          width: armW,
          height: armW,
          top: center - armW / 2,
          left: center - armW / 2,
          borderRadius: "50%",
          background: "rgba(0,20,30,0.7)",
          border: "1.5px solid rgba(0,212,255,0.3)",
          boxShadow: "inset 0 2px 6px rgba(0,0,0,0.6)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

// ─── Joy-Con Action Button ───────────────────────────────────────────────────
interface MobileActionBtnProps {
  label: string;
  symbol: string;
  active: boolean;
  onDown: () => void;
  onUp: () => void;
  color: string;
  pulse?: boolean;
  "data-ocid"?: string;
}

function MobileActionBtn({
  label,
  symbol,
  active,
  onDown,
  onUp,
  color,
  pulse,
  "data-ocid": ocid,
}: MobileActionBtnProps) {
  const rgb = hexToRgb(color);
  return (
    <button
      type="button"
      data-ocid={ocid}
      onTouchStart={(e) => {
        e.preventDefault();
        onDown();
      }}
      onTouchEnd={(e) => {
        e.preventDefault();
        onUp();
      }}
      onMouseDown={onDown}
      onMouseUp={onUp}
      onMouseLeave={onUp}
      style={{
        borderRadius: "50%",
        width: "100%",
        height: "100%",
        background: active ? `rgba(${rgb},0.40)` : `rgba(${rgb},0.10)`,
        border: `2px solid ${active ? color : `rgba(${rgb},0.45)`}`,
        boxShadow: active
          ? `0 0 16px ${color}, 0 0 40px rgba(${rgb},0.3), inset 0 0 10px rgba(${rgb},0.25)`
          : pulse
            ? `0 0 10px rgba(${rgb},0.5), inset 0 0 6px rgba(${rgb},0.1)`
            : `inset 0 0 6px rgba(${rgb},0.08)`,
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        userSelect: "none",
        WebkitTapHighlightColor: "transparent",
        touchAction: "manipulation",
        transform: active ? "scale(0.88)" : "scale(1)",
        transition: "all 0.08s ease",
        animation:
          pulse && !active ? "joyconPulse 1.2s ease-in-out infinite" : "none",
        position: "relative",
        overflow: "hidden",
        gap: 1,
      }}
    >
      <style>{`
        @keyframes joyconPulse {
          0%, 100% { box-shadow: 0 0 8px rgba(${rgb},0.4), inset 0 0 6px rgba(${rgb},0.1); border-color: rgba(${rgb},0.45); }
          50% { box-shadow: 0 0 20px ${color}, 0 0 40px rgba(${rgb},0.3), inset 0 0 10px rgba(${rgb},0.25); border-color: ${color}; }
        }
      `}</style>
      {/* Symbol circle */}
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: active ? color : `rgba(${rgb},0.25)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 10,
          fontWeight: 900,
          fontFamily: "'Geist Mono', monospace",
          color: active ? "#000" : color,
          transition: "all 0.08s",
          boxShadow: active ? `0 0 8px ${color}` : "none",
          flexShrink: 0,
        }}
      >
        {symbol}
      </div>
      {/* Label */}
      <span
        style={{
          fontSize: 7,
          fontWeight: 700,
          fontFamily: "'Geist Mono', monospace",
          color: active ? color : `rgba(${rgb},0.6)`,
          letterSpacing: "0.04em",
          lineHeight: 1,
        }}
      >
        {label}
      </span>
    </button>
  );
}

// Helper: hex color to r,g,b string
function hexToRgb(hex: string): string {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}
