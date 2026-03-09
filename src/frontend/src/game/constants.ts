export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 450;
export const FLOOR_Y = 350;
export const GRAVITY = 1800;
export const JUMP_VEL = -550;
export const WALK_SPEED = 160;
export const ROUND_TIME = 99;
export const ROUNDS_TO_WIN = 2;
export const MAX_ROUNDS = 3;
export const COMBO_WINDOW = 800;
export const ATTACK_DAMAGE = 8;
export const CROUCH_ATTACK_DAMAGE = 6;
export const SPECIAL_DAMAGE = 18;
export const FINISHER_DAMAGE = 999;
export const PROJECTILE_SPEED = 300;
export const FIGHTER_WIDTH = 60;
export const FIGHTER_HEIGHT = 100;
export const FIGHTER_CROUCH_HEIGHT = 70;
export const ATTACK_RANGE = 80;
export const ATTACK_DURATION = 300;
export const HIT_STUN = 350;
export const KNOCKDOWN_STUN = 900;
export const BLOCK_DURATION = 500;
export const SPECIAL_METER_GAIN = 12;
export const SPECIAL_COST = 40;
export const FINISHER_HEALTH_THRESHOLD = 0.15;

// CPU AI constants
export const CPU_THINK_INTERVAL = 400;
export const CPU_CLOSE_RANGE = 100;
export const CPU_MID_RANGE = 200;
export const CPU_BLOCK_CHANCE = 0.25;
export const CPU_SPECIAL_CHANCE = 0.12;
export const CPU_FINISHER_CHANCE = 0.7;

// === CHARACTER DEFINITIONS ===
export interface CharacterDef {
  id: string;
  name: string;
  color: string; // primary color hex
  accentColor: string; // secondary/glow color
  maxHealth: number;
  walkSpeed: number; // multiplier on WALK_SPEED
  attackMult: number; // multiplier on ATTACK_DAMAGE
  specialMoves: string[]; // which special moves this character can use
  description: string; // short tagline
}

export const CHARACTERS: CharacterDef[] = [
  {
    id: "ken",
    name: "KEN",
    color: "#1a6bff",
    accentColor: "#00d4ff",
    maxHealth: 180,
    walkSpeed: 1.2,
    attackMult: 1.0,
    specialMoves: ["dragonBlast", "risingStorm"],
    description: "SWIFT STRIKER",
  },
  {
    id: "ryu",
    name: "RYU",
    color: "#cc1a1a",
    accentColor: "#ff4444",
    maxHealth: 200,
    walkSpeed: 1.0,
    attackMult: 1.1,
    specialMoves: ["dragonBlast", "cycloneKick"],
    description: "BALANCED WARRIOR",
  },
  {
    id: "scorpion",
    name: "SCORPION",
    color: "#cc8800",
    accentColor: "#ffee00",
    maxHealth: 220,
    walkSpeed: 0.8,
    attackMult: 1.3,
    specialMoves: ["hellfireBlast", "risingStorm"],
    description: "HELLFIRE BEAST",
  },
];
