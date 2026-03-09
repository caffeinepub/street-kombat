export type FighterState =
  | "idle"
  | "walkForward"
  | "walkBackward"
  | "jumping"
  | "crouching"
  | "punch"
  | "kick"
  | "crouchPunch"
  | "crouchKick"
  | "blocking"
  | "crouchBlock"
  | "specialMove"
  | "finisher"
  | "hit"
  | "knockdown"
  | "getUp"
  | "dead";

export type GamePhase =
  | "menu"
  | "characterSelect"
  | "roundStart"
  | "fighting"
  | "roundEnd"
  | "finisherSequence"
  | "matchEnd"
  | "leaderboard";

export interface Fighter {
  x: number;
  y: number;
  velX: number;
  velY: number;
  width: number;
  height: number;
  health: number;
  maxHealth: number;
  state: FighterState;
  facing: "left" | "right";
  isGrounded: boolean;
  comboBuffer: string[];
  lastComboTime: number;
  specialMeter: number;
  finisherAvailable: boolean;
  animFrame: number;
  animTimer: number;
  stunTimer: number;
  blockTimer: number;
  attackCooldown: number;
  isPlayer: boolean;
  color: string;
  name: string;
  roundsWon: number;
  lastAttackLanded: boolean;
  selectedCharacterId?: string;
}

export interface Projectile {
  x: number;
  y: number;
  velX: number;
  width: number;
  height: number;
  owner: "player" | "cpu";
  type: "fireball" | "energy";
  frame: number;
}

export interface Particle {
  x: number;
  y: number;
  velX: number;
  velY: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface HitEffect {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  type: "normal" | "special" | "finisher";
}

export interface GameState {
  phase: GamePhase;
  round: number;
  timer: number;
  timerAccum: number;
  player: Fighter;
  cpu: Fighter;
  projectiles: Projectile[];
  particles: Particle[];
  hitEffects: HitEffect[];
  overlayText: string;
  overlayTimer: number;
  overlaySubText: string;
  finisherStep: number;
  finisherTimer: number;
  screenFlash: number;
  slowMoTimer: number;
  menuAnimTimer: number;
  roundStartTimer: number;
  roundEndTimer: number;
  winner: "player" | "cpu" | "draw" | null;
  matchWinner: "player" | "cpu" | "draw" | null;
}

export interface LeaderboardEntry {
  principal: string;
  wins: number;
  losses: number;
  draws: number;
}
