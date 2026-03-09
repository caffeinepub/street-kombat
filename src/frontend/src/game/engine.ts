import {
  type Fighter,
  FighterState,
  type GameState,
  type HitEffect,
  type Particle,
  type Projectile,
} from "../types/game";
import {
  ATTACK_DAMAGE,
  ATTACK_DURATION,
  ATTACK_RANGE,
  CANVAS_WIDTH,
  COMBO_WINDOW,
  CPU_BLOCK_CHANCE,
  CPU_CLOSE_RANGE,
  CPU_FINISHER_CHANCE,
  CPU_MID_RANGE,
  CPU_SPECIAL_CHANCE,
  CROUCH_ATTACK_DAMAGE,
  type CharacterDef,
  FIGHTER_HEIGHT,
  FIGHTER_WIDTH,
  FINISHER_HEALTH_THRESHOLD,
  FLOOR_Y,
  GRAVITY,
  HIT_STUN,
  JUMP_VEL,
  KNOCKDOWN_STUN,
  PROJECTILE_SPEED,
  ROUND_TIME,
  SPECIAL_COST,
  SPECIAL_DAMAGE,
  SPECIAL_METER_GAIN,
  WALK_SPEED,
} from "./constants";

// === FIGHTER INITIALIZATION ===
export function createPlayer(charDef?: CharacterDef): Fighter {
  return {
    x: 120,
    y: FLOOR_Y - FIGHTER_HEIGHT,
    velX: 0,
    velY: 0,
    width: FIGHTER_WIDTH,
    height: FIGHTER_HEIGHT,
    health: charDef?.maxHealth ?? 200,
    maxHealth: charDef?.maxHealth ?? 200,
    state: "idle",
    facing: "right",
    isGrounded: true,
    comboBuffer: [],
    lastComboTime: 0,
    specialMeter: 0,
    finisherAvailable: false,
    animFrame: 0,
    animTimer: 0,
    stunTimer: 0,
    blockTimer: 0,
    attackCooldown: 0,
    isPlayer: true,
    color: charDef?.color ?? "#1a6bff",
    name: charDef?.name ?? "KEN",
    roundsWon: 0,
    lastAttackLanded: false,
    selectedCharacterId: charDef?.id,
  };
}

export function createCPU(charDef?: CharacterDef): Fighter {
  return {
    x: 620,
    y: FLOOR_Y - FIGHTER_HEIGHT,
    velX: 0,
    velY: 0,
    width: FIGHTER_WIDTH,
    height: FIGHTER_HEIGHT,
    health: charDef?.maxHealth ?? 200,
    maxHealth: charDef?.maxHealth ?? 200,
    state: "idle",
    facing: "left",
    isGrounded: true,
    comboBuffer: [],
    lastComboTime: 0,
    specialMeter: 0,
    finisherAvailable: false,
    animFrame: 0,
    animTimer: 0,
    stunTimer: 0,
    blockTimer: 0,
    attackCooldown: 0,
    isPlayer: false,
    color: charDef?.color ?? "#cc1a1a",
    name: charDef?.name ?? "CPU RYU",
    roundsWon: 0,
    lastAttackLanded: false,
    selectedCharacterId: charDef?.id,
  };
}

// === PHYSICS ===
export function applyPhysics(fighter: Fighter, dt: number) {
  if (!fighter.isGrounded) {
    fighter.velY += GRAVITY * dt;
  }

  fighter.x += fighter.velX * dt;
  fighter.y += fighter.velY * dt;

  // Floor collision
  const floorY = FLOOR_Y - fighter.height;
  if (fighter.y >= floorY) {
    fighter.y = floorY;
    fighter.velY = 0;
    fighter.isGrounded = true;
    if (fighter.state === "jumping") {
      fighter.state = "idle";
    }
    if (fighter.state === "knockdown") {
      // Stay knocked down
    }
  }

  // Stage boundaries
  fighter.x = Math.max(0, Math.min(CANVAS_WIDTH - fighter.width, fighter.x));
}

// === FACING DIRECTION ===
export function updateFacing(player: Fighter, cpu: Fighter) {
  if (player.state !== "dead" && player.state !== "knockdown") {
    player.facing = player.x < cpu.x ? "right" : "left";
  }
  if (cpu.state !== "dead" && cpu.state !== "knockdown") {
    cpu.facing = cpu.x > player.x ? "left" : "right";
  }
}

// === ATTACK HITBOXES ===
function getAttackHitbox(
  attacker: Fighter,
): { x: number; y: number; w: number; h: number } | null {
  const dir = attacker.facing === "right" ? 1 : -1;
  const cx = attacker.x + attacker.width / 2;

  if (attacker.state === "punch") {
    return {
      x: cx + dir * 20,
      y: attacker.y + attacker.height * 0.2,
      w: ATTACK_RANGE,
      h: 40,
    };
  }
  if (attacker.state === "kick") {
    return {
      x: cx + dir * 20,
      y: attacker.y + attacker.height * 0.4,
      w: ATTACK_RANGE + 20,
      h: 30,
    };
  }
  if (attacker.state === "crouchPunch") {
    return {
      x: cx + dir * 20,
      y: attacker.y + attacker.height * 0.5,
      w: ATTACK_RANGE - 10,
      h: 30,
    };
  }
  if (attacker.state === "crouchKick") {
    return {
      x: cx + dir * 10,
      y: attacker.y + attacker.height * 0.7,
      w: ATTACK_RANGE + 30,
      h: 25,
    };
  }
  return null;
}

function getDefenderHurtbox(defender: Fighter): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  const isCrouching = [
    "crouching",
    "crouchPunch",
    "crouchKick",
    "crouchBlock",
  ].includes(defender.state);
  return {
    x: defender.x,
    y: isCrouching ? defender.y + defender.height * 0.3 : defender.y,
    w: defender.width,
    h: isCrouching ? defender.height * 0.7 : defender.height,
  };
}

function boxesOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}

// === COLLISION DETECTION ===
export function checkMeleeCollisions(
  attacker: Fighter,
  defender: Fighter,
  particles: Particle[],
  hitEffects: HitEffect[],
): { hit: boolean; damage: number; type: "normal" | "special" | "knockdown" } {
  if (attacker.attackCooldown > 0)
    return { hit: false, damage: 0, type: "normal" };
  if (defender.stunTimer > 0 && defender.state === "hit")
    return { hit: false, damage: 0, type: "normal" };

  const hitbox = getAttackHitbox(attacker);
  if (!hitbox) return { hit: false, damage: 0, type: "normal" };

  const hurtbox = getDefenderHurtbox(defender);
  if (!boxesOverlap(hitbox, hurtbox))
    return { hit: false, damage: 0, type: "normal" };

  // Check if defender is blocking
  const isBlocking =
    defender.state === "blocking" || defender.state === "crouchBlock";
  if (isBlocking) {
    // Block reduces damage by 80%
    const blockedDamage = Math.floor(ATTACK_DAMAGE * 0.2);
    defender.health = Math.max(0, defender.health - blockedDamage);
    attacker.attackCooldown = ATTACK_DURATION;
    spawnParticles(particles, hitbox.x, hitbox.y + hitbox.h / 2, "#00d4ff", 5);
    addHitEffect(hitEffects, hitbox.x, hitbox.y + hitbox.h / 2, "normal");
    return { hit: false, damage: blockedDamage, type: "normal" };
  }

  // Hit!
  let damage = ATTACK_DAMAGE;
  let type: "normal" | "special" | "knockdown" = "normal";

  if (attacker.state === "crouchPunch" || attacker.state === "crouchKick") {
    damage = CROUCH_ATTACK_DAMAGE;
  }

  if (attacker.state === "specialMove") {
    damage = SPECIAL_DAMAGE;
    type = "special";
  }

  defender.health = Math.max(0, defender.health - damage);
  attacker.attackCooldown = ATTACK_DURATION;
  attacker.specialMeter = Math.min(
    100,
    attacker.specialMeter + SPECIAL_METER_GAIN,
  );

  // Hit reaction
  if (damage >= SPECIAL_DAMAGE || Math.random() < 0.3) {
    defender.state = "knockdown";
    defender.stunTimer = KNOCKDOWN_STUN;
    type = "knockdown";
  } else {
    defender.state = "hit";
    defender.stunTimer = HIT_STUN;
  }

  // Knockback
  const knockDir = defender.x > attacker.x ? 1 : -1;
  defender.velX = knockDir * (type === "knockdown" ? 200 : 80);
  if (type === "knockdown") {
    defender.velY = -150;
    defender.isGrounded = false;
  }

  spawnParticles(
    particles,
    hitbox.x,
    hitbox.y + hitbox.h / 2,
    type === "special" ? "#00d4ff" : "#ffcc00",
    type === "special" ? 12 : 8,
  );
  addHitEffect(
    hitEffects,
    hitbox.x,
    hitbox.y + hitbox.h / 2,
    type === "special" ? "special" : "normal",
  );

  return { hit: true, damage, type };
}

// === PROJECTILE COLLISION ===
export function checkProjectileCollisions(
  projectiles: Projectile[],
  player: Fighter,
  cpu: Fighter,
  particles: Particle[],
  hitEffects: HitEffect[],
): Projectile[] {
  const surviving: Projectile[] = [];

  for (const proj of projectiles) {
    const target = proj.owner === "player" ? cpu : player;
    const targetBox = getDefenderHurtbox(target);
    const projBox = { x: proj.x, y: proj.y, w: proj.width, h: proj.height };

    if (boxesOverlap(projBox, targetBox)) {
      const isBlocking =
        target.state === "blocking" || target.state === "crouchBlock";
      const damage = isBlocking
        ? Math.floor(SPECIAL_DAMAGE * 0.15)
        : SPECIAL_DAMAGE;

      target.health = Math.max(0, target.health - damage);
      if (!isBlocking) {
        target.state = "hit";
        target.stunTimer = HIT_STUN;
        const knockDir =
          target.x > (proj.owner === "player" ? player.x : cpu.x) ? 1 : -1;
        target.velX = knockDir * 100;

        if (proj.owner === "player") {
          player.specialMeter = Math.min(
            100,
            player.specialMeter + SPECIAL_METER_GAIN,
          );
        }
      }

      spawnParticles(
        particles,
        proj.x + proj.width / 2,
        proj.y + proj.height / 2,
        "#ff8800",
        15,
      );
      addHitEffect(
        hitEffects,
        proj.x + proj.width / 2,
        proj.y + proj.height / 2,
        "special",
      );
      // Don't add to surviving — projectile is destroyed
    } else {
      surviving.push(proj);
    }
  }

  return surviving;
}

// === PARTICLES ===
export function spawnParticles(
  particles: Particle[],
  x: number,
  y: number,
  color: string,
  count: number,
) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 80 + Math.random() * 180;
    particles.push({
      x,
      y,
      velX: Math.cos(angle) * speed,
      velY: Math.sin(angle) * speed - 50,
      life: 0.5 + Math.random() * 0.5,
      maxLife: 0.5 + Math.random() * 0.5,
      color,
      size: 2 + Math.random() * 4,
    });
  }
}

export function spawnFinisherParticles(
  particles: Particle[],
  x: number,
  y: number,
) {
  const colors = ["#ffee00", "#ff8800", "#ff2244", "#ff00aa", "#00d4ff"];
  for (let i = 0; i < 50; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 100 + Math.random() * 400;
    const color = colors[Math.floor(Math.random() * colors.length)];
    particles.push({
      x,
      y,
      velX: Math.cos(angle) * speed,
      velY: Math.sin(angle) * speed - 200,
      life: 0.8 + Math.random() * 0.8,
      maxLife: 0.8 + Math.random() * 0.8,
      color,
      size: 4 + Math.random() * 8,
    });
  }
}

export function addHitEffect(
  hitEffects: HitEffect[],
  x: number,
  y: number,
  type: "normal" | "special" | "finisher",
) {
  hitEffects.push({
    x,
    y,
    life: 0.4,
    maxLife: 0.4,
    type,
  });
}

export function updateParticles(particles: Particle[], dt: number): Particle[] {
  return particles
    .map((p) => ({
      ...p,
      x: p.x + p.velX * dt,
      y: p.y + p.velY * dt,
      velY: p.velY + 200 * dt, // gravity
      life: p.life - dt,
    }))
    .filter((p) => p.life > 0);
}

export function updateHitEffects(
  effects: HitEffect[],
  dt: number,
): HitEffect[] {
  return effects
    .map((e) => ({ ...e, life: e.life - dt }))
    .filter((e) => e.life > 0);
}

// === PROJECTILE UPDATE ===
export function updateProjectiles(
  projectiles: Projectile[],
  dt: number,
): Projectile[] {
  return projectiles
    .map((p) => ({
      ...p,
      x: p.x + p.velX * dt,
      frame: p.frame + dt * 10,
    }))
    .filter((p) => p.x > -50 && p.x < CANVAS_WIDTH + 50);
}

// === COMBO INPUT DETECTION ===
export function addComboInput(fighter: Fighter, input: string, now: number) {
  // Clear old combo
  if (now - fighter.lastComboTime > COMBO_WINDOW) {
    fighter.comboBuffer = [];
  }
  fighter.comboBuffer.push(input);
  fighter.lastComboTime = now;

  // Keep buffer limited
  if (fighter.comboBuffer.length > 6) {
    fighter.comboBuffer = fighter.comboBuffer.slice(-6);
  }
}

export function detectSpecialMove(fighter: Fighter): string | null {
  const buf = fighter.comboBuffer;
  const str = buf.join(",");

  // Dragon Blast: down, forward, punch
  if (str.includes("down,right,punch") || str.endsWith("down,right,punch"))
    return "dragonBlast";

  // Rising Storm: forward, down, forward, punch
  if (str.includes("right,down,right,punch")) return "risingStorm";

  // Cyclone Kick: back, back, kick
  if (str.includes("left,left,kick")) return "cycloneKick";

  // Hellfire Blast: down, down, punch
  if (str.includes("down,down,punch")) return "hellfireBlast";

  return null;
}

export function executeSpecialMove(
  fighter: Fighter,
  moveName: string,
  projectiles: Projectile[],
  particles: Particle[],
  hitEffects: HitEffect[],
) {
  if (fighter.specialMeter < SPECIAL_COST) return;
  fighter.specialMeter -= SPECIAL_COST;
  fighter.comboBuffer = [];
  fighter.state = "specialMove";
  fighter.animTimer = 600;

  const dir = fighter.facing === "right" ? 1 : -1;

  if (moveName === "dragonBlast") {
    // Spawn fireball
    projectiles.push({
      x: fighter.x + (dir === 1 ? fighter.width : -20),
      y: fighter.y + fighter.height * 0.3,
      velX: PROJECTILE_SPEED * dir,
      width: 22,
      height: 22,
      owner: fighter.isPlayer ? "player" : "cpu",
      type: "fireball",
      frame: 0,
    });
    spawnParticles(
      particles,
      fighter.x + fighter.width / 2,
      fighter.y + fighter.height * 0.3,
      "#ff8800",
      8,
    );
  } else if (moveName === "risingStorm") {
    // Uppercut leap
    fighter.velY = JUMP_VEL * 1.1;
    fighter.isGrounded = false;
    fighter.velX = dir * 120;
    spawnParticles(
      particles,
      fighter.x + fighter.width / 2,
      fighter.y + fighter.height,
      "#ffee00",
      10,
    );
    addHitEffect(
      hitEffects,
      fighter.x + fighter.width / 2,
      fighter.y + fighter.height * 0.3,
      "special",
    );
  } else if (moveName === "cycloneKick") {
    // Spin kick - dash forward and hit
    fighter.velX = dir * 400;
    spawnParticles(
      particles,
      fighter.x + fighter.width / 2,
      fighter.y + fighter.height * 0.5,
      "#00d4ff",
      12,
    );
  } else if (moveName === "hellfireBlast") {
    // Slow-moving large orange/yellow fireball
    projectiles.push({
      x: fighter.x + (dir === 1 ? fighter.width : -36),
      y: fighter.y + fighter.height * 0.3,
      velX: 180 * dir,
      width: 36,
      height: 36,
      owner: fighter.isPlayer ? "player" : "cpu",
      type: "fireball",
      frame: 0,
    });
    spawnParticles(
      particles,
      fighter.x + fighter.width / 2,
      fighter.y + fighter.height * 0.3,
      "#ff8800",
      12,
    );
    spawnParticles(
      particles,
      fighter.x + fighter.width / 2,
      fighter.y + fighter.height * 0.3,
      "#ffee00",
      6,
    );
  }
}

// === FINISHER EXECUTION ===
export function canExecuteFinisher(player: Fighter, cpu: Fighter): boolean {
  return (
    cpu.health / cpu.maxHealth <= FINISHER_HEALTH_THRESHOLD &&
    player.specialMeter >= 100
  );
}

export function executeFinisher(
  player: Fighter,
  cpu: Fighter,
  particles: Particle[],
  hitEffects: HitEffect[],
  step: number,
) {
  const finisherHits = [15, 15, 20, 20, 999];
  if (step < finisherHits.length) {
    const dmg = finisherHits[step];
    cpu.health = Math.max(0, cpu.health - dmg);
    cpu.state = "hit";
    cpu.stunTimer = 300;

    const cx = (player.x + cpu.x) / 2;
    const cy = player.y + player.height * 0.4;

    spawnParticles(particles, cx, cy, "#ffee00", 12);
    addHitEffect(hitEffects, cx, cy, "finisher");

    if (step === finisherHits.length - 1) {
      // Final blow
      cpu.state = "knockdown";
      cpu.stunTimer = 9999;
      const dir = cpu.x > player.x ? 1 : -1;
      cpu.velX = dir * 500;
      cpu.velY = -300;
      cpu.isGrounded = false;
      spawnFinisherParticles(particles, cx, cy);
    }
  }

  player.specialMeter = 0;
}

// === ANIMATION TIMERS ===
export function updateFighterTimers(fighter: Fighter, dt: number) {
  fighter.animTimer = Math.max(0, fighter.animTimer - dt * 1000);
  fighter.stunTimer = Math.max(0, fighter.stunTimer - dt * 1000);
  fighter.blockTimer = Math.max(0, fighter.blockTimer - dt * 1000);
  fighter.attackCooldown = Math.max(0, fighter.attackCooldown - dt * 1000);
  fighter.animFrame = (fighter.animFrame + dt * 8) % 8;

  // State recovery
  if (fighter.stunTimer <= 0) {
    if (fighter.state === "hit") {
      fighter.state = "idle";
      fighter.velX = 0;
    }
    if (fighter.state === "knockdown") {
      fighter.state = "getUp";
      fighter.stunTimer = 600;
    }
    if (fighter.state === "getUp") {
      fighter.state = "idle";
    }
  }

  if (fighter.animTimer <= 0) {
    if (
      fighter.state === "punch" ||
      fighter.state === "kick" ||
      fighter.state === "crouchPunch" ||
      fighter.state === "crouchKick"
    ) {
      fighter.state = "idle";
      fighter.velX = 0;
    }
    if (fighter.state === "specialMove") {
      fighter.state = "idle";
      fighter.velX = 0;
    }
  }

  if (fighter.blockTimer <= 0 && fighter.state === "blocking") {
    fighter.state = "idle";
  }
  if (fighter.blockTimer <= 0 && fighter.state === "crouchBlock") {
    fighter.state = "crouching";
  }

  // Update finisher availability
  fighter.finisherAvailable = fighter.specialMeter >= 100;
}

// === CPU AI ===
let cpuThinkTimer = 0;

export function updateCPU(
  cpu: Fighter,
  player: Fighter,
  projectiles: Projectile[],
  particles: Particle[],
  hitEffects: HitEffect[],
  dt: number,
  now: number,
) {
  cpuThinkTimer -= dt * 1000;

  // Can't act while stunned or in animation
  if (
    cpu.stunTimer > 0 ||
    cpu.state === "hit" ||
    cpu.state === "knockdown" ||
    cpu.state === "getUp" ||
    cpu.state === "dead"
  ) {
    return;
  }

  // Stop attack states by timer
  if (
    cpu.state === "punch" ||
    cpu.state === "kick" ||
    cpu.state === "specialMove" ||
    cpu.state === "crouchPunch"
  ) {
    return;
  }

  if (cpuThinkTimer > 0) {
    // Continue current behavior - movement
    const dist = Math.abs(cpu.x - player.x);
    if (dist > CPU_MID_RANGE && cpu.state !== "blocking") {
      const dir = player.x > cpu.x ? 1 : -1;
      cpu.velX = dir * WALK_SPEED * 0.85;
      cpu.state = dir === 1 ? "walkForward" : "walkBackward";
    }
    return;
  }

  cpuThinkTimer = 200 + Math.random() * 300;

  const dist = Math.abs(cpu.x - player.x);
  const random = Math.random();

  // Finisher check
  if (
    player.health / player.maxHealth <= FINISHER_HEALTH_THRESHOLD &&
    cpu.specialMeter >= 100 &&
    random < CPU_FINISHER_CHANCE
  ) {
    cpu.state = "finisher";
    return;
  }

  // React to incoming projectiles
  const incomingProj = projectiles.find(
    (p) => p.owner === "player" && Math.abs(p.x - cpu.x) < 200,
  );
  if (incomingProj) {
    if (Math.random() < 0.6) {
      cpu.state = "blocking";
      cpu.blockTimer = 600;
    } else if (cpu.isGrounded) {
      cpu.velY = JUMP_VEL;
      cpu.isGrounded = false;
      cpu.state = "jumping";
    }
    return;
  }

  // Close range — attack
  if (dist < CPU_CLOSE_RANGE) {
    // Occasionally block
    if (random < CPU_BLOCK_CHANCE && !player.isGrounded) {
      cpu.state = "blocking";
      cpu.blockTimer = 400;
      cpu.velX = 0;
      return;
    }

    // Special move
    if (cpu.specialMeter >= SPECIAL_COST && random < CPU_SPECIAL_CHANCE) {
      executeSpecialMove(
        cpu,
        "dragonBlast",
        projectiles,
        particles,
        hitEffects,
      );
      cpu.animTimer = 500;
      return;
    }

    // Basic attack
    cpu.velX = 0;
    if (random < 0.5) {
      cpu.state = "punch";
      cpu.animTimer = ATTACK_DURATION;
      addComboInput(cpu, "punch", now);
    } else {
      cpu.state = "kick";
      cpu.animTimer = ATTACK_DURATION;
      addComboInput(cpu, "kick", now);
    }
    return;
  }

  // Mid range — approach or special
  if (dist < CPU_MID_RANGE) {
    if (cpu.specialMeter >= SPECIAL_COST && random < CPU_SPECIAL_CHANCE * 1.5) {
      executeSpecialMove(
        cpu,
        "dragonBlast",
        projectiles,
        particles,
        hitEffects,
      );
      return;
    }

    // Move forward
    const dir = player.x > cpu.x ? 1 : -1;
    cpu.velX = dir * WALK_SPEED * 0.85;
    cpu.state = dir === 1 ? "walkForward" : "walkBackward";
    return;
  }

  // Far range — approach
  const dir = player.x > cpu.x ? 1 : -1;
  cpu.velX = dir * WALK_SPEED * 0.85;
  cpu.state = dir === 1 ? "walkForward" : "walkBackward";

  // Occasional jump
  if (random < 0.08 && cpu.isGrounded) {
    cpu.velY = JUMP_VEL;
    cpu.isGrounded = false;
    cpu.state = "jumping";
    cpu.velX = dir * WALK_SPEED * 0.5;
  }
}

// === PLAYER INPUT PROCESSING ===
export interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  punch: boolean;
  kick: boolean;
  block: boolean;
  crouchPunch: boolean;
  crouchKick: boolean;
  finisher: boolean;
}

export function processPlayerInput(
  player: Fighter,
  input: InputState,
  projectiles: Projectile[],
  particles: Particle[],
  hitEffects: HitEffect[],
  now: number,
) {
  // Can't input while stunned
  if (
    player.stunTimer > 200 ||
    player.state === "hit" ||
    player.state === "knockdown" ||
    player.state === "getUp" ||
    player.state === "dead"
  ) {
    return;
  }

  // Can't input during attack or special
  if (
    player.state === "punch" ||
    player.state === "kick" ||
    player.state === "crouchPunch" ||
    player.state === "crouchKick" ||
    player.state === "specialMove" ||
    player.state === "finisher"
  ) {
    return;
  }

  const isCrouching = input.down && player.isGrounded;

  // Block
  if (input.block) {
    player.state = isCrouching ? "crouchBlock" : "blocking";
    player.blockTimer = 100;
    player.velX = 0;
    return;
  }

  // Combo input tracking for direction keys
  if (input.down) addComboInput(player, "down", now);
  if (player.facing === "right" && input.right)
    addComboInput(player, "right", now);
  if (player.facing === "right" && input.left)
    addComboInput(player, "left", now);
  if (player.facing === "left" && input.left)
    addComboInput(player, "right", now);
  if (player.facing === "left" && input.right)
    addComboInput(player, "left", now);

  // Finisher
  if (input.finisher && player.finisherAvailable && player.isPlayer) {
    player.state = "finisher";
    return;
  }

  // Crouch attacks
  if (isCrouching) {
    if (input.crouchPunch && player.attackCooldown <= 0) {
      player.state = "crouchPunch";
      player.animTimer = ATTACK_DURATION;
      player.velX = 0;
      addComboInput(player, "punch", now);
      const special = detectSpecialMove(player);
      if (special) {
        executeSpecialMove(player, special, projectiles, particles, hitEffects);
      }
      return;
    }
    if (input.crouchKick && player.attackCooldown <= 0) {
      player.state = "crouchKick";
      player.animTimer = ATTACK_DURATION;
      player.velX = 0;
      addComboInput(player, "kick", now);
      return;
    }
    player.state = "crouching";
    player.velX = 0;
    return;
  }

  // Standing attacks
  if (input.punch && player.attackCooldown <= 0) {
    addComboInput(player, "punch", now);
    const special = detectSpecialMove(player);
    if (special && player.specialMeter >= SPECIAL_COST) {
      executeSpecialMove(player, special, projectiles, particles, hitEffects);
    } else {
      player.state = "punch";
      player.animTimer = ATTACK_DURATION;
      player.velX = 0;
    }
    return;
  }

  if (input.kick && player.attackCooldown <= 0) {
    addComboInput(player, "kick", now);
    const special = detectSpecialMove(player);
    if (special && player.specialMeter >= SPECIAL_COST) {
      executeSpecialMove(player, special, projectiles, particles, hitEffects);
    } else {
      player.state = "kick";
      player.animTimer = ATTACK_DURATION;
      player.velX = 0;
    }
    return;
  }

  // Movement
  if (input.up && player.isGrounded) {
    player.velY = JUMP_VEL;
    player.isGrounded = false;
    player.state = "jumping";
    if (input.left) player.velX = -WALK_SPEED * 0.7;
    else if (input.right) player.velX = WALK_SPEED * 0.7;
    return;
  }

  if (input.left) {
    player.velX = -WALK_SPEED;
    player.state = player.facing === "left" ? "walkForward" : "walkBackward";
    return;
  }

  if (input.right) {
    player.velX = WALK_SPEED;
    player.state = player.facing === "right" ? "walkForward" : "walkBackward";
    return;
  }

  // Standing idle
  if (player.isGrounded) {
    player.velX = 0;
    player.state = "idle";
  }
}

// === STATE TRANSITIONS ===
export type RoundResult = "player" | "cpu" | "draw" | null;

export function checkRoundEnd(gs: GameState): RoundResult {
  if (gs.phase !== "fighting") return null;

  if (gs.player.health <= 0 && gs.cpu.health <= 0) return "draw";
  if (gs.player.health <= 0) return "cpu";
  if (gs.cpu.health <= 0) return "player";
  if (gs.timer <= 0) {
    if (gs.player.health > gs.cpu.health) return "player";
    if (gs.cpu.health > gs.player.health) return "cpu";
    return "draw";
  }

  return null;
}

export function resetRound(
  player: Fighter,
  cpu: Fighter,
  playerCharDef?: CharacterDef,
  cpuCharDef?: CharacterDef,
) {
  const p = createPlayer(playerCharDef);
  const c = createCPU(cpuCharDef);

  // Preserve round wins
  p.roundsWon = player.roundsWon;
  c.roundsWon = cpu.roundsWon;

  // If no charDef passed, preserve color/name from existing fighters
  if (!playerCharDef) {
    p.color = player.color;
    p.name = player.name;
    p.selectedCharacterId = player.selectedCharacterId;
    p.maxHealth = player.maxHealth;
    p.health = player.maxHealth;
  }
  if (!cpuCharDef) {
    c.color = cpu.color;
    c.name = cpu.name;
    c.selectedCharacterId = cpu.selectedCharacterId;
    c.maxHealth = cpu.maxHealth;
    c.health = cpu.maxHealth;
  }

  return { player: p, cpu: c };
}
