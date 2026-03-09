import type {
  Fighter,
  GameState,
  HitEffect,
  Particle,
  Projectile,
} from "../types/game";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  type CharacterDef,
  FIGHTER_CROUCH_HEIGHT,
  FIGHTER_HEIGHT,
  FLOOR_Y,
} from "./constants";

// === BACKGROUND RENDERING ===
export function drawBackground(ctx: CanvasRenderingContext2D, timer: number) {
  // Sky gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, FLOOR_Y);
  skyGrad.addColorStop(0, "#020210");
  skyGrad.addColorStop(0.5, "#050518");
  skyGrad.addColorStop(1, "#0a0820");
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, CANVAS_WIDTH, FLOOR_Y);

  // Stars
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  const starPositions = [
    [40, 20],
    [120, 35],
    [200, 15],
    [310, 40],
    [390, 25],
    [470, 18],
    [550, 38],
    [620, 12],
    [700, 30],
    [760, 22],
    [80, 55],
    [250, 50],
    [440, 48],
    [630, 52],
    [740, 45],
  ];
  for (const [sx, sy] of starPositions) {
    const flicker = Math.sin(timer * 2 + sx) * 0.3 + 0.7;
    ctx.globalAlpha = flicker * 0.6;
    ctx.fillRect(sx, sy, 1, 1);
  }
  ctx.globalAlpha = 1;

  // Distant buildings silhouette
  ctx.fillStyle = "#0d0d1f";
  const buildings = [
    { x: 0, w: 50, h: 120 },
    { x: 55, w: 40, h: 90 },
    { x: 100, w: 60, h: 140 },
    { x: 165, w: 35, h: 80 },
    { x: 620, w: 45, h: 110 },
    { x: 670, w: 55, h: 95 },
    { x: 730, w: 40, h: 130 },
    { x: 775, w: 30, h: 85 },
  ];
  for (const b of buildings) {
    ctx.fillRect(b.x, FLOOR_Y - b.h, b.w, b.h);
    // Windows
    ctx.fillStyle = "#1a1a30";
    for (let wy = FLOOR_Y - b.h + 10; wy < FLOOR_Y - 15; wy += 18) {
      for (let wx = b.x + 6; wx < b.x + b.w - 6; wx += 12) {
        const litChance = Math.sin(wx * 7 + wy * 3) > 0;
        if (litChance) {
          ctx.fillStyle = Math.sin(timer + wx) > 0.5 ? "#ffcc00" : "#ff6600";
          ctx.fillRect(wx, wy, 5, 7);
        }
      }
    }
    ctx.fillStyle = "#0d0d1f";
  }

  // NEON SIGNS
  drawNeonSign(ctx, 190, 80, "KOMBAT BAR", "#ff00aa", timer);
  drawNeonSign(ctx, 530, 65, "NOODLE HOUSE", "#00d4ff", timer);
  drawNeonSign(ctx, 350, 90, "★ ARCADE ★", "#ffee00", timer);

  // Brick wall
  const wallGrad = ctx.createLinearGradient(0, FLOOR_Y - 150, 0, FLOOR_Y);
  wallGrad.addColorStop(0, "#1a0a08");
  wallGrad.addColorStop(1, "#240c0a");
  ctx.fillStyle = wallGrad;
  ctx.fillRect(0, FLOOR_Y - 150, CANVAS_WIDTH, 150);

  // Brick pattern
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 32; col++) {
      const offset = row % 2 === 0 ? 0 : 12;
      const bx = col * 26 + offset;
      const by = FLOOR_Y - 150 + row * 18;
      ctx.strokeStyle = "rgba(80, 30, 20, 0.4)";
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, by, 24, 16);
    }
  }

  // Floor
  const floorGrad = ctx.createLinearGradient(0, FLOOR_Y, 0, CANVAS_HEIGHT);
  floorGrad.addColorStop(0, "#1a1030");
  floorGrad.addColorStop(1, "#0d0820");
  ctx.fillStyle = floorGrad;
  ctx.fillRect(0, FLOOR_Y, CANVAS_WIDTH, CANVAS_HEIGHT - FLOOR_Y);

  // Floor perspective lines
  ctx.strokeStyle = "rgba(0, 212, 255, 0.08)";
  ctx.lineWidth = 1;
  const vanishX = CANVAS_WIDTH / 2;
  const vanishY = FLOOR_Y + 20;
  for (let i = 0; i <= 12; i++) {
    const startX = (CANVAS_WIDTH / 12) * i;
    ctx.beginPath();
    ctx.moveTo(startX, CANVAS_HEIGHT);
    ctx.lineTo(vanishX, vanishY);
    ctx.stroke();
  }

  // Floor horizontal lines
  for (let fy = FLOOR_Y + 15; fy < CANVAS_HEIGHT; fy += 25) {
    ctx.strokeStyle = `rgba(0, 212, 255, ${0.04 + (fy - FLOOR_Y) * 0.0005})`;
    ctx.beginPath();
    ctx.moveTo(0, fy);
    ctx.lineTo(CANVAS_WIDTH, fy);
    ctx.stroke();
  }

  // Floor edge glow
  const floorGlow = ctx.createLinearGradient(0, FLOOR_Y - 2, 0, FLOOR_Y + 10);
  floorGlow.addColorStop(0, "rgba(0, 212, 255, 0.4)");
  floorGlow.addColorStop(1, "rgba(0, 212, 255, 0)");
  ctx.fillStyle = floorGlow;
  ctx.fillRect(0, FLOOR_Y - 2, CANVAS_WIDTH, 12);

  // Crowd silhouettes
  drawCrowd(ctx, timer);
}

function drawNeonSign(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  color: string,
  timer: number,
) {
  const flicker = Math.sin(timer * 3.7 + x) > 0.85 ? 0.3 : 1;
  ctx.globalAlpha = flicker;

  const padding = 8;
  ctx.font = "bold 11px 'Geist Mono', monospace";
  const textWidth = ctx.measureText(text).width;
  const boxW = textWidth + padding * 2;
  const boxH = 22;

  // Sign background
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fillRect(x - boxW / 2, y - boxH / 2, boxW, boxH);

  // Neon border
  ctx.shadowColor = color;
  ctx.shadowBlur = 8;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x - boxW / 2, y - boxH / 2, boxW, boxH);

  // Text
  ctx.fillStyle = color;
  ctx.shadowBlur = 12;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);

  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}

function drawCrowd(ctx: CanvasRenderingContext2D, timer: number) {
  const crowdY = FLOOR_Y + 5;
  const crowdCount = 20;

  for (let i = 0; i < crowdCount; i++) {
    const cx = (CANVAS_WIDTH / crowdCount) * i + 20;
    const bobOffset = Math.sin(timer * 2 + i * 1.3) * 3;
    const crowdH = 30 + Math.sin(i * 2.1) * 10;

    ctx.fillStyle = `rgba(${20 + i * 3}, ${10 + i}, ${30 + i * 2}, 0.8)`;

    // Body
    ctx.beginPath();
    ctx.ellipse(
      cx,
      crowdY + crowdH / 2 + bobOffset,
      8,
      crowdH / 2,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();

    // Head
    ctx.beginPath();
    ctx.arc(cx, crowdY + bobOffset - 5, 5, 0, Math.PI * 2);
    ctx.fill();

    // Raised arms occasionally
    if (Math.sin(timer * 1.5 + i) > 0.3) {
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 4, crowdY + 5 + bobOffset);
      ctx.lineTo(cx - 12, crowdY - 8 + bobOffset);
      ctx.stroke();
    }
  }
}

// === FIGHTER RENDERING ===
export function drawFighter(
  ctx: CanvasRenderingContext2D,
  fighter: Fighter,
  timer: number,
) {
  const { x, y, state, facing, isPlayer, animFrame } = fighter;
  const isRight = facing === "right";

  ctx.save();

  // Flip context for facing direction
  if (!isRight) {
    ctx.translate(x + fighter.width, y);
    ctx.scale(-1, 1);
    ctx.translate(-fighter.width, 0);
  } else {
    ctx.translate(x, y);
  }

  const isCrouching =
    state === "crouching" ||
    state === "crouchPunch" ||
    state === "crouchKick" ||
    state === "crouchBlock";
  const charHeight = isCrouching ? FIGHTER_CROUCH_HEIGHT : FIGHTER_HEIGHT;
  const heightOffset = FIGHTER_HEIGHT - charHeight;

  const primaryColor = fighter.color;
  // Darken the primary color for secondary
  const secondaryColor = isPlayer ? "#0044cc" : "#880000";
  const skinColor = "#f5c89a";
  const hairColor = isPlayer ? "#2a1a00" : "#1a0000";
  const beltColor = "#ffaa00";

  // Hit flash
  if (state === "hit" || fighter.stunTimer > 0) {
    ctx.globalAlpha = Math.sin(timer * 20) > 0 ? 0.5 : 1;
  }

  // Shadow on ground
  ctx.globalAlpha *= 0.3;
  ctx.fillStyle = "#000000";
  ctx.beginPath();
  ctx.ellipse(30, FIGHTER_HEIGHT - heightOffset - 2, 25, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha =
    state === "hit" || fighter.stunTimer > 0
      ? Math.sin(timer * 20) > 0
        ? 0.5
        : 1
      : 1;

  if (state === "dead" || state === "knockdown") {
    drawKnockedDown(
      ctx,
      fighter,
      primaryColor,
      secondaryColor,
      skinColor,
      beltColor,
    );
  } else if (state === "jumping") {
    drawJumping(
      ctx,
      fighter,
      primaryColor,
      secondaryColor,
      skinColor,
      hairColor,
      beltColor,
      charHeight,
      heightOffset,
    );
  } else if (isCrouching) {
    drawCrouching(
      ctx,
      fighter,
      primaryColor,
      secondaryColor,
      skinColor,
      hairColor,
      beltColor,
      state,
    );
  } else if (state === "punch") {
    drawPunching(
      ctx,
      fighter,
      primaryColor,
      secondaryColor,
      skinColor,
      hairColor,
      beltColor,
      charHeight,
      heightOffset,
    );
  } else if (state === "kick") {
    drawKicking(
      ctx,
      fighter,
      primaryColor,
      secondaryColor,
      skinColor,
      hairColor,
      beltColor,
      charHeight,
      heightOffset,
    );
  } else if (state === "blocking") {
    drawBlocking(
      ctx,
      fighter,
      primaryColor,
      secondaryColor,
      skinColor,
      hairColor,
      beltColor,
      charHeight,
      heightOffset,
    );
  } else if (state === "specialMove") {
    drawSpecial(
      ctx,
      fighter,
      primaryColor,
      secondaryColor,
      skinColor,
      hairColor,
      beltColor,
      charHeight,
      heightOffset,
      animFrame,
    );
  } else {
    // Idle / walk: slight bob
    const bob =
      state === "idle" ? Math.sin(timer * 3) * 2 : Math.sin(timer * 6) * 1;
    drawIdle(
      ctx,
      fighter,
      primaryColor,
      secondaryColor,
      skinColor,
      hairColor,
      beltColor,
      bob,
      charHeight,
      heightOffset,
    );
  }

  ctx.restore();
}

function drawIdle(
  ctx: CanvasRenderingContext2D,
  fighter: Fighter,
  primary: string,
  secondary: string,
  skin: string,
  hair: string,
  belt: string,
  bob: number,
  charHeight: number,
  heightOffset: number,
) {
  const baseY = heightOffset + bob;

  // Legs
  ctx.fillStyle = primary;
  ctx.fillRect(14, baseY + charHeight - 40, 14, 40);
  ctx.fillRect(32, baseY + charHeight - 40, 14, 40);

  // Leg wraps
  ctx.fillStyle = secondary;
  ctx.fillRect(14, baseY + charHeight - 12, 14, 6);
  ctx.fillRect(32, baseY + charHeight - 12, 14, 6);

  // Body (gi top)
  ctx.fillStyle = primary;
  ctx.fillRect(10, baseY + charHeight - 80, 40, 45);

  // Belt
  ctx.fillStyle = belt;
  ctx.fillRect(10, baseY + charHeight - 38, 40, 6);

  // Gi lapels
  ctx.fillStyle = secondary;
  ctx.beginPath();
  ctx.moveTo(30, baseY + charHeight - 80);
  ctx.lineTo(22, baseY + charHeight - 40);
  ctx.lineTo(30, baseY + charHeight - 45);
  ctx.lineTo(38, baseY + charHeight - 40);
  ctx.closePath();
  ctx.fill();

  // Arms
  ctx.fillStyle = skin;
  ctx.fillRect(2, baseY + charHeight - 80, 10, 35);
  ctx.fillRect(48, baseY + charHeight - 80, 10, 35);

  // Fists
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(7, baseY + charHeight - 45, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(53, baseY + charHeight - 45, 7, 0, Math.PI * 2);
  ctx.fill();

  // Neck
  ctx.fillStyle = skin;
  ctx.fillRect(24, baseY + charHeight - 88, 12, 12);

  // Head
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.roundRect(15, baseY + charHeight - 115, 30, 30, 8);
  ctx.fill();

  // Hair / headband
  ctx.fillStyle = hair;
  ctx.fillRect(15, baseY + charHeight - 115, 30, 10);

  // Headband
  ctx.fillStyle = fighter.isPlayer ? "#ff4400" : "#ffcc00";
  ctx.fillRect(15, baseY + charHeight - 108, 30, 5);

  // Eyes
  ctx.fillStyle = "#fff";
  ctx.fillRect(20, baseY + charHeight - 105, 6, 5);
  ctx.fillRect(34, baseY + charHeight - 105, 6, 5);
  ctx.fillStyle = "#333";
  ctx.fillRect(22, baseY + charHeight - 104, 3, 3);
  ctx.fillRect(36, baseY + charHeight - 104, 3, 3);

  // Determined expression
  ctx.fillStyle = "#555";
  ctx.fillRect(20, baseY + charHeight - 97, 6, 2);
  ctx.fillRect(34, baseY + charHeight - 97, 6, 2);
}

function drawPunching(
  ctx: CanvasRenderingContext2D,
  fighter: Fighter,
  primary: string,
  secondary: string,
  skin: string,
  hair: string,
  belt: string,
  charHeight: number,
  heightOffset: number,
) {
  const baseY = heightOffset;

  // Legs
  ctx.fillStyle = primary;
  ctx.fillRect(14, baseY + charHeight - 40, 14, 40);
  ctx.fillRect(32, baseY + charHeight - 40, 14, 40);
  ctx.fillStyle = secondary;
  ctx.fillRect(14, baseY + charHeight - 12, 14, 6);
  ctx.fillRect(32, baseY + charHeight - 12, 14, 6);

  // Body
  ctx.fillStyle = primary;
  ctx.fillRect(10, baseY + charHeight - 80, 40, 45);
  ctx.fillStyle = belt;
  ctx.fillRect(10, baseY + charHeight - 38, 40, 6);
  ctx.fillStyle = secondary;
  ctx.beginPath();
  ctx.moveTo(30, baseY + charHeight - 80);
  ctx.lineTo(22, baseY + charHeight - 40);
  ctx.lineTo(30, baseY + charHeight - 45);
  ctx.lineTo(38, baseY + charHeight - 40);
  ctx.closePath();
  ctx.fill();

  // Left arm pulled back
  ctx.fillStyle = skin;
  ctx.fillRect(2, baseY + charHeight - 78, 10, 30);
  ctx.beginPath();
  ctx.arc(7, baseY + charHeight - 48, 7, 0, Math.PI * 2);
  ctx.fill();

  // Right arm EXTENDED (punch!)
  ctx.fillStyle = skin;
  ctx.fillRect(48, baseY + charHeight - 72, 25, 10);

  // Punch fist with glow
  ctx.shadowColor = "#00d4ff";
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(78, baseY + charHeight - 67, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Neck + head
  ctx.fillStyle = skin;
  ctx.fillRect(24, baseY + charHeight - 88, 12, 12);
  ctx.beginPath();
  ctx.roundRect(15, baseY + charHeight - 115, 30, 30, 8);
  ctx.fill();
  ctx.fillStyle = hair;
  ctx.fillRect(15, baseY + charHeight - 115, 30, 10);
  ctx.fillStyle = fighter.isPlayer ? "#ff4400" : "#ffcc00";
  ctx.fillRect(15, baseY + charHeight - 108, 30, 5);

  // Eyes (focused)
  ctx.fillStyle = "#fff";
  ctx.fillRect(20, baseY + charHeight - 105, 6, 5);
  ctx.fillRect(34, baseY + charHeight - 105, 6, 5);
  ctx.fillStyle = "#333";
  ctx.fillRect(22, baseY + charHeight - 104, 3, 3);
  ctx.fillRect(36, baseY + charHeight - 104, 3, 3);
}

function drawKicking(
  ctx: CanvasRenderingContext2D,
  fighter: Fighter,
  primary: string,
  secondary: string,
  skin: string,
  hair: string,
  belt: string,
  charHeight: number,
  heightOffset: number,
) {
  const baseY = heightOffset;

  // Standing leg
  ctx.fillStyle = primary;
  ctx.fillRect(14, baseY + charHeight - 40, 14, 40);
  ctx.fillStyle = secondary;
  ctx.fillRect(14, baseY + charHeight - 12, 14, 6);

  // Kicking leg extended horizontally
  ctx.fillStyle = primary;
  ctx.fillRect(30, baseY + charHeight - 50, 45, 14);
  ctx.fillStyle = secondary;
  ctx.fillRect(68, baseY + charHeight - 50, 10, 14);

  // Foot
  ctx.fillStyle = skin;
  ctx.fillRect(78, baseY + charHeight - 52, 14, 12);

  // Body
  ctx.fillStyle = primary;
  ctx.fillRect(10, baseY + charHeight - 80, 40, 45);
  ctx.fillStyle = belt;
  ctx.fillRect(10, baseY + charHeight - 38, 40, 6);

  // Arms balanced
  ctx.fillStyle = skin;
  ctx.fillRect(-8, baseY + charHeight - 80, 10, 30);
  ctx.fillRect(48, baseY + charHeight - 80, 10, 30);
  ctx.beginPath();
  ctx.arc(-3, baseY + charHeight - 50, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(53, baseY + charHeight - 50, 7, 0, Math.PI * 2);
  ctx.fill();

  // Neck + head
  ctx.fillStyle = skin;
  ctx.fillRect(24, baseY + charHeight - 88, 12, 12);
  ctx.beginPath();
  ctx.roundRect(15, baseY + charHeight - 115, 30, 30, 8);
  ctx.fill();
  ctx.fillStyle = hair;
  ctx.fillRect(15, baseY + charHeight - 115, 30, 10);
  ctx.fillStyle = fighter.isPlayer ? "#ff4400" : "#ffcc00";
  ctx.fillRect(15, baseY + charHeight - 108, 30, 5);
  ctx.fillStyle = "#fff";
  ctx.fillRect(20, baseY + charHeight - 105, 6, 5);
  ctx.fillRect(34, baseY + charHeight - 105, 6, 5);
  ctx.fillStyle = "#333";
  ctx.fillRect(22, baseY + charHeight - 104, 3, 3);
  ctx.fillRect(36, baseY + charHeight - 104, 3, 3);
}

function drawCrouching(
  ctx: CanvasRenderingContext2D,
  fighter: Fighter,
  primary: string,
  secondary: string,
  skin: string,
  hair: string,
  belt: string,
  state: string,
) {
  const baseY = FIGHTER_HEIGHT - FIGHTER_CROUCH_HEIGHT;

  // Crouched legs
  ctx.fillStyle = primary;
  ctx.fillRect(5, baseY + FIGHTER_CROUCH_HEIGHT - 30, 18, 30);
  ctx.fillRect(37, baseY + FIGHTER_CROUCH_HEIGHT - 30, 18, 30);

  // Knees bent (visual detail)
  ctx.fillStyle = secondary;
  ctx.fillRect(5, baseY + FIGHTER_CROUCH_HEIGHT - 30, 18, 8);
  ctx.fillRect(37, baseY + FIGHTER_CROUCH_HEIGHT - 30, 18, 8);

  // Crouched body
  ctx.fillStyle = primary;
  ctx.fillRect(8, baseY + FIGHTER_CROUCH_HEIGHT - 50, 44, 28);
  ctx.fillStyle = belt;
  ctx.fillRect(8, baseY + FIGHTER_CROUCH_HEIGHT - 25, 44, 5);

  // Arms
  ctx.fillStyle = skin;
  if (state === "crouchPunch") {
    // Punch extended
    ctx.fillRect(50, baseY + FIGHTER_CROUCH_HEIGHT - 50, 22, 10);
    ctx.shadowColor = "#00d4ff";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(76, baseY + FIGHTER_CROUCH_HEIGHT - 45, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  } else {
    ctx.fillRect(0, baseY + FIGHTER_CROUCH_HEIGHT - 50, 10, 20);
    ctx.fillRect(50, baseY + FIGHTER_CROUCH_HEIGHT - 50, 10, 20);
  }

  // Head (lower)
  ctx.fillStyle = skin;
  ctx.fillRect(24, baseY + FIGHTER_CROUCH_HEIGHT - 70, 12, 12);
  ctx.beginPath();
  ctx.roundRect(15, baseY + FIGHTER_CROUCH_HEIGHT - 88, 30, 25, 8);
  ctx.fill();
  ctx.fillStyle = hair;
  ctx.fillRect(15, baseY + FIGHTER_CROUCH_HEIGHT - 88, 30, 8);
  ctx.fillStyle = fighter.isPlayer ? "#ff4400" : "#ffcc00";
  ctx.fillRect(15, baseY + FIGHTER_CROUCH_HEIGHT - 82, 30, 4);
  ctx.fillStyle = "#fff";
  ctx.fillRect(20, baseY + FIGHTER_CROUCH_HEIGHT - 78, 5, 4);
  ctx.fillRect(34, baseY + FIGHTER_CROUCH_HEIGHT - 78, 5, 4);
  ctx.fillStyle = "#333";
  ctx.fillRect(21, baseY + FIGHTER_CROUCH_HEIGHT - 77, 3, 3);
  ctx.fillRect(35, baseY + FIGHTER_CROUCH_HEIGHT - 77, 3, 3);
}

function drawJumping(
  ctx: CanvasRenderingContext2D,
  fighter: Fighter,
  primary: string,
  secondary: string,
  skin: string,
  hair: string,
  belt: string,
  charHeight: number,
  heightOffset: number,
) {
  const baseY = heightOffset;

  // Tucked legs
  ctx.fillStyle = primary;
  ctx.fillRect(10, baseY + charHeight - 35, 14, 28);
  ctx.fillRect(36, baseY + charHeight - 35, 14, 28);

  // Feet
  ctx.fillStyle = secondary;
  ctx.fillRect(6, baseY + charHeight - 10, 16, 10);
  ctx.fillRect(38, baseY + charHeight - 10, 16, 10);

  // Body
  ctx.fillStyle = primary;
  ctx.fillRect(10, baseY + charHeight - 75, 40, 45);
  ctx.fillStyle = belt;
  ctx.fillRect(10, baseY + charHeight - 35, 40, 6);

  // Arms raised
  ctx.fillStyle = skin;
  ctx.fillRect(-2, baseY + charHeight - 90, 12, 30);
  ctx.fillRect(50, baseY + charHeight - 90, 12, 30);
  ctx.beginPath();
  ctx.arc(4, baseY + charHeight - 90, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(56, baseY + charHeight - 90, 7, 0, Math.PI * 2);
  ctx.fill();

  // Head
  ctx.fillStyle = skin;
  ctx.fillRect(24, baseY + charHeight - 83, 12, 12);
  ctx.beginPath();
  ctx.roundRect(15, baseY + charHeight - 110, 30, 30, 8);
  ctx.fill();
  ctx.fillStyle = hair;
  ctx.fillRect(15, baseY + charHeight - 110, 30, 10);
  ctx.fillStyle = fighter.isPlayer ? "#ff4400" : "#ffcc00";
  ctx.fillRect(15, baseY + charHeight - 103, 30, 4);
  ctx.fillStyle = "#fff";
  ctx.fillRect(20, baseY + charHeight - 100, 6, 5);
  ctx.fillRect(34, baseY + charHeight - 100, 6, 5);
  ctx.fillStyle = "#333";
  ctx.fillRect(22, baseY + charHeight - 99, 3, 3);
  ctx.fillRect(36, baseY + charHeight - 99, 3, 3);
}

function drawBlocking(
  ctx: CanvasRenderingContext2D,
  fighter: Fighter,
  primary: string,
  secondary: string,
  skin: string,
  hair: string,
  belt: string,
  charHeight: number,
  heightOffset: number,
) {
  const baseY = heightOffset;

  // Legs wide stance
  ctx.fillStyle = primary;
  ctx.fillRect(8, baseY + charHeight - 40, 14, 40);
  ctx.fillRect(38, baseY + charHeight - 40, 14, 40);
  ctx.fillStyle = secondary;
  ctx.fillRect(8, baseY + charHeight - 12, 14, 6);
  ctx.fillRect(38, baseY + charHeight - 12, 14, 6);

  // Body
  ctx.fillStyle = primary;
  ctx.fillRect(10, baseY + charHeight - 80, 40, 45);
  ctx.fillStyle = belt;
  ctx.fillRect(10, baseY + charHeight - 38, 40, 6);

  // Arms crossed in front (blocking)
  ctx.fillStyle = skin;
  ctx.fillRect(10, baseY + charHeight - 90, 40, 18);

  // Shield effect
  ctx.strokeStyle = "rgba(0, 212, 255, 0.6)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(30, baseY + charHeight - 80, 32, -Math.PI * 0.8, -Math.PI * 0.2);
  ctx.stroke();

  // Head ducked
  ctx.fillStyle = skin;
  ctx.fillRect(24, baseY + charHeight - 90, 12, 10);
  ctx.beginPath();
  ctx.roundRect(15, baseY + charHeight - 115, 30, 28, 8);
  ctx.fill();
  ctx.fillStyle = hair;
  ctx.fillRect(15, baseY + charHeight - 115, 30, 10);
  ctx.fillStyle = fighter.isPlayer ? "#ff4400" : "#ffcc00";
  ctx.fillRect(15, baseY + charHeight - 108, 30, 4);
}

function drawKnockedDown(
  ctx: CanvasRenderingContext2D,
  _fighter: Fighter,
  primary: string,
  _secondary: string,
  skin: string,
  _belt: string,
) {
  // Lying flat
  const fy = FIGHTER_HEIGHT - 20;

  ctx.fillStyle = primary;
  ctx.fillRect(0, fy - 8, 60, 16);

  // Head
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(8, fy, 12, 0, Math.PI * 2);
  ctx.fill();

  // X eyes
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(4, fy - 4);
  ctx.lineTo(8, fy);
  ctx.moveTo(8, fy - 4);
  ctx.lineTo(4, fy);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(10, fy - 4);
  ctx.lineTo(14, fy);
  ctx.moveTo(14, fy - 4);
  ctx.lineTo(10, fy);
  ctx.stroke();
}

function drawSpecial(
  ctx: CanvasRenderingContext2D,
  fighter: Fighter,
  primary: string,
  _secondary: string,
  skin: string,
  hair: string,
  belt: string,
  charHeight: number,
  heightOffset: number,
  animFrame: number,
) {
  const baseY = heightOffset;
  const energyColor = fighter.isPlayer ? "#00d4ff" : "#ff6600";

  // Energy aura
  ctx.globalAlpha = 0.4;
  ctx.shadowColor = energyColor;
  ctx.shadowBlur = 20;
  ctx.fillStyle = energyColor;
  ctx.beginPath();
  ctx.ellipse(
    30,
    baseY + charHeight - 50,
    35 + animFrame * 2,
    55 + animFrame * 2,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;

  // Fighter in power pose
  ctx.fillStyle = primary;
  ctx.fillRect(14, baseY + charHeight - 40, 14, 40);
  ctx.fillRect(32, baseY + charHeight - 40, 14, 40);
  ctx.fillRect(10, baseY + charHeight - 80, 40, 45);
  ctx.fillStyle = belt;
  ctx.fillRect(10, baseY + charHeight - 38, 40, 6);

  // Arms raised with energy
  ctx.fillStyle = skin;
  ctx.fillRect(-5, baseY + charHeight - 95, 12, 40);
  ctx.fillRect(53, baseY + charHeight - 95, 12, 40);

  // Glowing fists
  ctx.shadowColor = energyColor;
  ctx.shadowBlur = 15;
  ctx.beginPath();
  ctx.arc(1, baseY + charHeight - 95, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(59, baseY + charHeight - 95, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = skin;
  ctx.fillRect(24, baseY + charHeight - 88, 12, 12);
  ctx.beginPath();
  ctx.roundRect(15, baseY + charHeight - 115, 30, 30, 8);
  ctx.fill();
  ctx.fillStyle = hair;
  ctx.fillRect(15, baseY + charHeight - 115, 30, 10);
  ctx.fillStyle = fighter.isPlayer ? "#ff4400" : "#ffcc00";
  ctx.fillRect(15, baseY + charHeight - 108, 30, 5);

  // Glowing eyes during special
  ctx.fillStyle = energyColor;
  ctx.shadowColor = energyColor;
  ctx.shadowBlur = 8;
  ctx.fillRect(20, baseY + charHeight - 105, 6, 5);
  ctx.fillRect(34, baseY + charHeight - 105, 6, 5);
  ctx.shadowBlur = 0;
}

// === PROJECTILES ===
export function drawProjectile(
  ctx: CanvasRenderingContext2D,
  proj: Projectile,
  timer: number,
) {
  ctx.save();
  const rotation = timer * 8;

  ctx.translate(proj.x + proj.width / 2, proj.y + proj.height / 2);
  ctx.rotate(rotation);

  // Outer glow
  ctx.shadowColor = "#ff8800";
  ctx.shadowBlur = 20;

  // Core fire ball
  const fireGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, proj.width / 2);
  fireGrad.addColorStop(0, "#ffffff");
  fireGrad.addColorStop(0.3, "#ffee00");
  fireGrad.addColorStop(0.7, "#ff6600");
  fireGrad.addColorStop(1, "rgba(255, 50, 0, 0)");
  ctx.fillStyle = fireGrad;
  ctx.beginPath();
  ctx.arc(0, 0, proj.width / 2, 0, Math.PI * 2);
  ctx.fill();

  // Flame tendrils
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const len = proj.width * 0.6 + Math.sin(timer * 10 + i) * 4;
    ctx.strokeStyle = `rgba(255, ${100 + i * 20}, 0, 0.7)`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(angle) * len, Math.sin(angle) * len);
    ctx.stroke();
  }

  ctx.shadowBlur = 0;
  ctx.restore();
}

// === PARTICLES ===
export function drawParticles(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
) {
  for (const p of particles) {
    const alpha = p.life / p.maxLife;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 5;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

// === HIT EFFECTS ===
export function drawHitEffects(
  ctx: CanvasRenderingContext2D,
  effects: HitEffect[],
) {
  for (const e of effects) {
    const alpha = e.life / e.maxLife;
    const scale = 1 + (1 - alpha) * 0.5;
    const radius = 25 * scale;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(e.x, e.y);
    ctx.scale(scale, scale);

    if (e.type === "finisher") {
      // Star burst for finisher hits
      ctx.strokeStyle = "#ffee00";
      ctx.lineWidth = 3;
      ctx.shadowColor = "#ffee00";
      ctx.shadowBlur = 15;
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(
          Math.cos(angle) * radius * 1.5,
          Math.sin(angle) * radius * 1.5,
        );
        ctx.stroke();
      }

      const starGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
      starGrad.addColorStop(0, "rgba(255, 255, 255, 0.9)");
      starGrad.addColorStop(0.4, "rgba(255, 238, 0, 0.6)");
      starGrad.addColorStop(1, "rgba(255, 100, 0, 0)");
      ctx.fillStyle = starGrad;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.type === "special") {
      ctx.shadowColor = "#00d4ff";
      ctx.shadowBlur = 20;
      ctx.strokeStyle = "#00d4ff";
      ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
        ctx.stroke();
      }

      const specGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 0.8);
      specGrad.addColorStop(0, "rgba(255, 255, 255, 0.8)");
      specGrad.addColorStop(0.5, "rgba(0, 212, 255, 0.5)");
      specGrad.addColorStop(1, "rgba(0, 100, 200, 0)");
      ctx.fillStyle = specGrad;
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.8, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Normal hit - yellow spark
      ctx.shadowColor = "#ffcc00";
      ctx.shadowBlur = 10;
      const hitGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 0.7);
      hitGrad.addColorStop(0, "rgba(255, 255, 200, 0.9)");
      hitGrad.addColorStop(0.6, "rgba(255, 200, 0, 0.5)");
      hitGrad.addColorStop(1, "rgba(255, 100, 0, 0)");
      ctx.fillStyle = hitGrad;
      ctx.beginPath();
      ctx.arc(0, 0, radius * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

// === HUD ===
export function drawHUD(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  timer: number,
) {
  const { player, cpu, round } = state;

  const barW = 280;
  const barH = 20;
  const barY = 15;
  const padding = 10;

  // Player 1 Health Bar (left)
  drawHealthBar(
    ctx,
    padding,
    barY,
    barW,
    barH,
    player.health / player.maxHealth,
    "left",
    player.name,
  );

  // Player 2 Health Bar (right)
  drawHealthBar(
    ctx,
    CANVAS_WIDTH - padding - barW,
    barY,
    barW,
    barH,
    cpu.health / cpu.maxHealth,
    "right",
    cpu.name,
  );

  // Special meters
  const meterW = barW;
  const meterH = 8;
  const meterY = barY + barH + 5;

  drawSpecialMeter(
    ctx,
    padding,
    meterY,
    meterW,
    meterH,
    player.specialMeter / 100,
    "left",
    player.finisherAvailable,
  );
  drawSpecialMeter(
    ctx,
    CANVAS_WIDTH - padding - meterW,
    meterY,
    meterW,
    meterH,
    cpu.specialMeter / 100,
    "right",
    cpu.finisherAvailable,
  );

  // Round indicators
  const indicatorY = barY + barH + meterH + 15;
  drawRoundIndicators(ctx, player.roundsWon, cpu.roundsWon, indicatorY);

  // Timer
  const timerX = CANVAS_WIDTH / 2;
  const timerY = 15;

  // Timer box
  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.fillRect(timerX - 25, timerY - 2, 50, 36);
  ctx.strokeStyle = "#00d4ff";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(timerX - 25, timerY - 2, 50, 36);

  const timerVal = Math.ceil(state.timer);
  const timerColor = timerVal <= 10 ? "#ff4444" : "#00d4ff";
  ctx.fillStyle = timerColor;
  ctx.shadowColor = timerColor;
  ctx.shadowBlur = timerVal <= 10 ? 10 * Math.sin(timer * 8) : 6;
  ctx.font = "bold 28px 'Geist Mono', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(timerVal.toString().padStart(2, "0"), timerX, timerY + 2);
  ctx.shadowBlur = 0;

  // Round display
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(timerX - 30, timerY + 38, 60, 16);
  ctx.fillStyle = "#888";
  ctx.font = "bold 10px 'Geist Mono', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(`ROUND ${round}`, timerX, timerY + 40);
}

function drawHealthBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  ratio: number,
  side: "left" | "right",
  name: string,
) {
  const clampedRatio = Math.max(0, Math.min(1, ratio));

  // Background
  ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
  ctx.fillRect(x, y, w, h);

  // Border
  ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);

  // Health gradient color
  let barColor: string;
  if (clampedRatio > 0.6) {
    barColor = "#00ff44";
  } else if (clampedRatio > 0.3) {
    barColor = "#ffcc00";
  } else {
    barColor = "#ff2244";
  }

  const filledW = w * clampedRatio;
  const barX = side === "left" ? x : x + w - filledW;

  const healthGrad = ctx.createLinearGradient(x, y, x, y + h);
  healthGrad.addColorStop(0, barColor);
  healthGrad.addColorStop(0.5, "rgba(255,255,255,0.3)");
  healthGrad.addColorStop(1, barColor);

  ctx.fillStyle = healthGrad;
  ctx.fillRect(barX, y + 1, filledW - 1, h - 2);

  // Glow
  if (clampedRatio > 0.05) {
    ctx.shadowColor = barColor;
    ctx.shadowBlur = 6;
    ctx.fillRect(barX, y + 1, filledW - 1, h - 2);
    ctx.shadowBlur = 0;
  }

  // Name label
  ctx.fillStyle = "#fff";
  ctx.font = "bold 10px 'Geist Mono', monospace";
  ctx.textAlign = side === "left" ? "left" : "right";
  ctx.textBaseline = "bottom";
  ctx.fillText(name, side === "left" ? x : x + w, y - 2);
}

function drawSpecialMeter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  ratio: number,
  _side: "left" | "right",
  finisherAvailable: boolean,
) {
  const clampedRatio = Math.max(0, Math.min(1, ratio));

  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(x, y, w, h);

  if (clampedRatio > 0) {
    const specialColor = finisherAvailable ? "#ff2244" : "#ffee00";
    const specialGrad = ctx.createLinearGradient(x, y, x + w * clampedRatio, y);
    specialGrad.addColorStop(0, specialColor);
    specialGrad.addColorStop(1, finisherAvailable ? "#ff8800" : "#ffaa00");

    ctx.fillStyle = specialGrad;
    ctx.fillRect(x + 1, y + 1, w * clampedRatio - 2, h - 2);

    if (finisherAvailable) {
      ctx.shadowColor = "#ff2244";
      ctx.shadowBlur = 8;
      ctx.fillRect(x + 1, y + 1, w * clampedRatio - 2, h - 2);
      ctx.shadowBlur = 0;
    }
  }

  ctx.strokeStyle = finisherAvailable ? "#ff2244" : "rgba(255,238,0,0.4)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);

  // Label
  ctx.fillStyle = finisherAvailable ? "#ff2244" : "rgba(255,200,0,0.7)";
  ctx.font = "bold 7px 'Geist Mono', monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(finisherAvailable ? "✦ FINISH HIM!" : "SP", x + 2, y + h / 2);
}

function drawRoundIndicators(
  ctx: CanvasRenderingContext2D,
  p1Wins: number,
  p2Wins: number,
  y: number,
) {
  const cx = CANVAS_WIDTH / 2;
  const radius = 6;
  const gap = 16;

  // P1 indicators (left of center)
  for (let i = 0; i < 2; i++) {
    const ix = cx - 30 - i * gap;
    ctx.beginPath();
    ctx.arc(ix, y, radius, 0, Math.PI * 2);
    if (i < p1Wins) {
      ctx.fillStyle = "#00d4ff";
      ctx.shadowColor = "#00d4ff";
      ctx.shadowBlur = 8;
    } else {
      ctx.fillStyle = "rgba(0,212,255,0.15)";
      ctx.shadowBlur = 0;
    }
    ctx.fill();
    ctx.strokeStyle = "#00d4ff";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // P2 indicators (right of center)
  for (let i = 0; i < 2; i++) {
    const ix = cx + 30 + i * gap;
    ctx.beginPath();
    ctx.arc(ix, y, radius, 0, Math.PI * 2);
    if (i < p2Wins) {
      ctx.fillStyle = "#ff2244";
      ctx.shadowColor = "#ff2244";
      ctx.shadowBlur = 8;
    } else {
      ctx.fillStyle = "rgba(255,34,68,0.15)";
      ctx.shadowBlur = 0;
    }
    ctx.fill();
    ctx.strokeStyle = "#ff2244";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
}

// === OVERLAY TEXTS ===
export function drawOverlayText(
  ctx: CanvasRenderingContext2D,
  text: string,
  subText: string,
  timer: number,
  _phase: string,
) {
  if (!text) return;

  const cx = CANVAS_WIDTH / 2;
  const cy = CANVAS_HEIGHT / 2;

  // Dramatic background pulse
  const pulse = Math.abs(Math.sin(timer * 4)) * 0.3;
  ctx.fillStyle = `rgba(0, 0, 0, ${0.4 + pulse})`;
  ctx.fillRect(0, cy - 70, CANVAS_WIDTH, 140);

  // Main text
  let color = "#ffee00";
  let shadowColor = "#ff8800";

  if (
    text.includes("KO") ||
    text.includes("FINISH") ||
    text.includes("SUPREME")
  ) {
    color = "#ff2244";
    shadowColor = "#ff0000";
  } else if (text.includes("ROUND")) {
    color = "#00d4ff";
    shadowColor = "#0088ff";
  } else if (text.includes("FIGHT")) {
    color = "#00ff88";
    shadowColor = "#00aa55";
  } else if (text.includes("PERFECT")) {
    color = "#ff00aa";
    shadowColor = "#aa0077";
  }

  const scale = 1 + Math.sin(timer * 6) * 0.02;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  ctx.shadowColor = shadowColor;
  ctx.shadowBlur = 30;
  ctx.fillStyle = color;
  ctx.font = `bold 56px 'Geist Mono', monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 0, 0);

  // Second pass for extra glow
  ctx.shadowBlur = 60;
  ctx.globalAlpha = 0.5;
  ctx.fillText(text, 0, 0);
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;

  if (subText) {
    ctx.font = `bold 22px 'Geist Mono', monospace`;
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(255,255,255,0.5)";
    ctx.shadowBlur = 10;
    ctx.fillText(subText, 0, 45);
    ctx.shadowBlur = 0;
  }

  ctx.restore();

  // "FINISH HIM" specific pulsing bars
  if (text === "FINISH HIM!" || text === "FINISH HER!") {
    const barAlpha = Math.abs(Math.sin(timer * 6)) * 0.8;
    ctx.fillStyle = `rgba(255, 34, 68, ${barAlpha})`;
    ctx.fillRect(0, cy - 70, CANVAS_WIDTH, 4);
    ctx.fillRect(0, cy + 66, CANVAS_WIDTH, 4);
  }
}

// === SCREEN FLASH ===
export function drawScreenFlash(
  ctx: CanvasRenderingContext2D,
  intensity: number,
) {
  if (intensity <= 0) return;
  ctx.fillStyle = `rgba(255, 255, 255, ${intensity})`;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

// === MENU SCREEN ===
export function drawMenu(ctx: CanvasRenderingContext2D, timer: number) {
  // Background
  const bgGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  bgGrad.addColorStop(0, "#040408");
  bgGrad.addColorStop(1, "#0a0818");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Grid effect
  ctx.strokeStyle = "rgba(0, 212, 255, 0.05)";
  ctx.lineWidth = 1;
  for (let gx = 0; gx < CANVAS_WIDTH; gx += 40) {
    ctx.beginPath();
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx, CANVAS_HEIGHT);
    ctx.stroke();
  }
  for (let gy = 0; gy < CANVAS_HEIGHT; gy += 40) {
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(CANVAS_WIDTH, gy);
    ctx.stroke();
  }

  const cx = CANVAS_WIDTH / 2;

  // Title glow ring
  const ringPulse = Math.abs(Math.sin(timer * 1.5)) * 0.4 + 0.1;
  ctx.strokeStyle = `rgba(255, 0, 170, ${ringPulse})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, 140, 120 + Math.sin(timer) * 5, 0, Math.PI * 2);
  ctx.stroke();

  // STREET KOMBAT title
  ctx.shadowColor = "#ff00aa";
  ctx.shadowBlur = 30;
  ctx.fillStyle = "#ff00aa";
  ctx.font = "bold 60px 'Geist Mono', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("STREET", cx, 100);

  ctx.shadowColor = "#ffee00";
  ctx.shadowBlur = 30;
  ctx.fillStyle = "#ffee00";
  ctx.font = "bold 72px 'Geist Mono', monospace";
  ctx.fillText("KOMBAT", cx, 165);
  ctx.shadowBlur = 0;

  // Subtitle
  ctx.fillStyle = "rgba(0,212,255,0.7)";
  ctx.font = "bold 14px 'Geist Mono', monospace";
  ctx.fillText("ARCADE EDITION", cx, 205);

  // Separator
  const sepAlpha = Math.abs(Math.sin(timer * 2)) * 0.4 + 0.3;
  ctx.strokeStyle = `rgba(0, 212, 255, ${sepAlpha})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - 160, 225);
  ctx.lineTo(cx + 160, 225);
  ctx.stroke();

  // Controls
  const controls = [
    ["MOVE", "← → ↑ ↓"],
    ["PUNCH", "A  |  KICK: S  |  BLOCK: D"],
    ["CROUCH ATK", "Z (punch)  X (kick)"],
    ["DRAGON BLAST", "↓ → A"],
    ["RISING STORM", "→ ↓ → A"],
    ["CYCLONE KICK", "← ← S"],
    ["FINISHER", "F  (when FINISH HIM! appears)"],
  ];

  ctx.font = "10px 'Geist Mono', monospace";
  for (let i = 0; i < controls.length; i++) {
    const cy2 = 248 + i * 18;
    ctx.fillStyle = "rgba(255,200,0,0.6)";
    ctx.textAlign = "right";
    ctx.fillText(controls[i][0], cx - 10, cy2);
    ctx.fillStyle = "rgba(200,200,200,0.8)";
    ctx.textAlign = "left";
    ctx.fillText(controls[i][1], cx + 10, cy2);
  }

  // PRESS ENTER
  const enterAlpha = Math.abs(Math.sin(timer * 2.5)) * 0.5 + 0.5;
  ctx.globalAlpha = enterAlpha;
  ctx.shadowColor = "#00ff88";
  ctx.shadowBlur = 15;
  ctx.fillStyle = "#00ff88";
  ctx.font = "bold 22px 'Geist Mono', monospace";
  ctx.textAlign = "center";
  ctx.fillText("▶ PRESS ENTER TO FIGHT", cx, 408);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;

  // Version
  ctx.fillStyle = "rgba(100,100,120,0.5)";
  ctx.font = "9px 'Geist Mono', monospace";
  ctx.fillText("v1.0 • caffeine.ai", cx, 435);
}

// === MATCH END SCREEN ===
export function drawMatchEnd(
  ctx: CanvasRenderingContext2D,
  winner: "player" | "cpu" | "draw" | null,
  timer: number,
) {
  // Dark overlay
  ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  const cx = CANVAS_WIDTH / 2;

  // Winner announcement
  const winText =
    winner === "player" ? "YOU WIN!" : winner === "cpu" ? "CPU WINS!" : "DRAW!";
  const winColor =
    winner === "player" ? "#00ff88" : winner === "cpu" ? "#ff2244" : "#ffee00";

  const scale = 1 + Math.sin(timer * 3) * 0.03;
  ctx.save();
  ctx.translate(cx, 160);
  ctx.scale(scale, scale);

  ctx.shadowColor = winColor;
  ctx.shadowBlur = 40;
  ctx.fillStyle = winColor;
  ctx.font = "bold 68px 'Geist Mono', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(winText, 0, 0);
  ctx.shadowBlur = 0;
  ctx.restore();

  // Subtitle
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "18px 'Geist Mono', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (winner === "player") {
    ctx.fillText("SUPREME VICTORY!", cx, 215);
  } else if (winner === "cpu") {
    ctx.fillText("TRY AGAIN, WARRIOR!", cx, 215);
  } else {
    ctx.fillText("WELL FOUGHT!", cx, 215);
  }

  // Button hints
  const btn1Alpha = Math.abs(Math.sin(timer * 2)) * 0.3 + 0.7;
  ctx.globalAlpha = btn1Alpha;
  ctx.strokeStyle = "#00d4ff";
  ctx.lineWidth = 2;
  ctx.strokeRect(cx - 120, 270, 100, 36);
  ctx.fillStyle = "rgba(0, 212, 255, 0.1)";
  ctx.fillRect(cx - 120, 270, 100, 36);
  ctx.fillStyle = "#00d4ff";
  ctx.font = "bold 14px 'Geist Mono', monospace";
  ctx.fillText("PLAY AGAIN", cx - 70, 288);

  ctx.strokeStyle = "#ffee00";
  ctx.strokeRect(cx + 20, 270, 110, 36);
  ctx.fillStyle = "rgba(255, 238, 0, 0.1)";
  ctx.fillRect(cx + 20, 270, 110, 36);
  ctx.fillStyle = "#ffee00";
  ctx.fillText("LEADERBOARD", cx + 75, 288);

  ctx.globalAlpha = 1;

  // Press hints
  ctx.fillStyle = "rgba(200,200,200,0.5)";
  ctx.font = "11px 'Geist Mono', monospace";
  ctx.fillText("[R] PLAY AGAIN    [L] LEADERBOARD    [ENTER] PLAY", cx, 330);
}

// === CHARACTER SELECT SCREEN ===
export function drawCharacterSelect(
  ctx: CanvasRenderingContext2D,
  characters: CharacterDef[],
  p1Index: number,
  p2Index: number,
  p1Confirmed: boolean,
  p2Confirmed: boolean,
  animTimer: number,
  isOnline: boolean,
) {
  // Background
  const bgGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  bgGrad.addColorStop(0, "#040408");
  bgGrad.addColorStop(1, "#0a0818");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Animated grid lines
  ctx.strokeStyle = "rgba(0, 212, 255, 0.04)";
  ctx.lineWidth = 1;
  for (let gx = 0; gx < CANVAS_WIDTH; gx += 40) {
    ctx.beginPath();
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx, CANVAS_HEIGHT);
    ctx.stroke();
  }
  for (let gy = 0; gy < CANVAS_HEIGHT; gy += 40) {
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(CANVAS_WIDTH, gy);
    ctx.stroke();
  }

  // Horizontal scanning line animation
  const scanY = (animTimer * 80) % CANVAS_HEIGHT;
  const scanGrad = ctx.createLinearGradient(0, scanY - 4, 0, scanY + 4);
  scanGrad.addColorStop(0, "rgba(0,212,255,0)");
  scanGrad.addColorStop(0.5, "rgba(0,212,255,0.06)");
  scanGrad.addColorStop(1, "rgba(0,212,255,0)");
  ctx.fillStyle = scanGrad;
  ctx.fillRect(0, scanY - 4, CANVAS_WIDTH, 8);

  const cx = CANVAS_WIDTH / 2;

  // Title
  const titlePulse = Math.abs(Math.sin(animTimer * 1.8)) * 0.2 + 0.8;
  ctx.globalAlpha = titlePulse;
  ctx.shadowColor = "#ff00aa";
  ctx.shadowBlur = 20;
  ctx.fillStyle = "#ff00aa";
  ctx.font = "bold 12px 'Geist Mono', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("SELECT YOUR FIGHTER", cx, 30);

  ctx.shadowColor = "#ffee00";
  ctx.shadowBlur = 15;
  ctx.fillStyle = "#ffee00";
  ctx.font = "bold 28px 'Geist Mono', monospace";
  ctx.fillText("CHARACTER SELECT", cx, 58);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;

  // Separator line
  const sepAlpha = Math.abs(Math.sin(animTimer * 2)) * 0.3 + 0.3;
  ctx.strokeStyle = `rgba(0, 212, 255, ${sepAlpha})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - 180, 78);
  ctx.lineTo(cx + 180, 78);
  ctx.stroke();

  // Character cards layout — 3 cards centered
  const cardW = 180;
  const cardH = 230;
  const cardGap = 24;
  const totalW = characters.length * cardW + (characters.length - 1) * cardGap;
  const startX = cx - totalW / 2;
  const cardY = 88;

  for (let i = 0; i < characters.length; i++) {
    const char = characters[i];
    const cardX = startX + i * (cardW + cardGap);

    const isP1Selected = i === p1Index;
    const isP2Selected = i === p2Index;
    const isHighlighted = isP1Selected || isP2Selected;

    // Card glow based on selection
    let glowColor = "rgba(255,255,255,0.05)";
    if (isP1Selected && isP2Selected) {
      glowColor = "rgba(255,170,0,0.15)";
    } else if (isP1Selected) {
      glowColor = "rgba(0,212,255,0.12)";
    } else if (isP2Selected) {
      glowColor = "rgba(255,34,68,0.12)";
    }

    // Card background
    ctx.fillStyle = isHighlighted ? glowColor : "rgba(0,0,0,0.5)";
    ctx.fillRect(cardX, cardY, cardW, cardH);

    // Card border
    let borderColor = "rgba(255,255,255,0.1)";
    if (isP1Selected && isP2Selected) {
      borderColor = "#ffaa00";
    } else if (isP1Selected) {
      borderColor = "#00d4ff";
    } else if (isP2Selected) {
      borderColor = "#ff2244";
    }

    ctx.strokeStyle = borderColor;
    ctx.lineWidth = isHighlighted ? 2 : 1;
    if (isHighlighted) {
      ctx.shadowColor = borderColor;
      ctx.shadowBlur = 10;
    }
    ctx.strokeRect(cardX, cardY, cardW, cardH);
    ctx.shadowBlur = 0;

    // Fighter silhouette preview area (top portion of card)
    const previewH = 130;
    const charColor = char.color;

    // Preview background
    const previewGrad = ctx.createLinearGradient(
      cardX,
      cardY,
      cardX,
      cardY + previewH,
    );
    previewGrad.addColorStop(0, `${charColor}22`);
    previewGrad.addColorStop(1, `${charColor}08`);
    ctx.fillStyle = previewGrad;
    ctx.fillRect(cardX + 1, cardY + 1, cardW - 2, previewH - 1);

    // Draw mini fighter silhouette using canvas paths
    drawMiniFighter(
      ctx,
      cardX + cardW / 2,
      cardY + previewH - 8,
      char,
      animTimer,
    );

    // Separator between preview and info
    ctx.strokeStyle = `${char.color}44`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cardX + 8, cardY + previewH);
    ctx.lineTo(cardX + cardW - 8, cardY + previewH);
    ctx.stroke();

    // Character name
    ctx.shadowColor = char.accentColor;
    ctx.shadowBlur = isHighlighted ? 12 : 6;
    ctx.fillStyle = char.color;
    ctx.font = `bold ${char.name.length > 6 ? "13" : "15"}px 'Geist Mono', monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(char.name, cardX + cardW / 2, cardY + previewH + 16);
    ctx.shadowBlur = 0;

    // Description
    ctx.fillStyle = `${char.accentColor}cc`;
    ctx.font = "bold 8px 'Geist Mono', monospace";
    ctx.fillText(char.description, cardX + cardW / 2, cardY + previewH + 32);

    // HP bar
    const hpBarW = cardW - 24;
    const hpBarH = 6;
    const hpBarX = cardX + 12;
    const hpBarY = cardY + previewH + 44;
    const hpRatio = char.maxHealth / 220; // normalize to max possible

    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(hpBarX, hpBarY, hpBarW, hpBarH);

    const hpGrad = ctx.createLinearGradient(
      hpBarX,
      hpBarY,
      hpBarX + hpBarW * hpRatio,
      hpBarY,
    );
    hpGrad.addColorStop(0, char.color);
    hpGrad.addColorStop(1, char.accentColor);
    ctx.fillStyle = hpGrad;
    ctx.fillRect(hpBarX, hpBarY, hpBarW * hpRatio, hpBarH);

    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    ctx.strokeRect(hpBarX, hpBarY, hpBarW, hpBarH);

    // HP label
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "7px 'Geist Mono', monospace";
    ctx.textAlign = "left";
    ctx.fillText("HP", hpBarX, hpBarY - 4);
    ctx.textAlign = "right";
    ctx.fillText(`${char.maxHealth}`, hpBarX + hpBarW, hpBarY - 4);

    // Speed / attack stats
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.font = "7px 'Geist Mono', monospace";
    ctx.textAlign = "left";
    ctx.fillText(
      `SPD ${Math.round(char.walkSpeed * 10)}`,
      hpBarX,
      hpBarY + hpBarH + 10,
    );
    ctx.textAlign = "right";
    ctx.fillText(
      `ATK ${Math.round(char.attackMult * 10)}`,
      hpBarX + hpBarW,
      hpBarY + hpBarH + 10,
    );

    // P1/P2 cursor indicators
    const cursorY = cardY + cardH + 6;
    if (isP1Selected) {
      const p1Alpha = Math.abs(Math.sin(animTimer * 3)) * 0.4 + 0.6;
      ctx.globalAlpha = p1Alpha;
      ctx.fillStyle = "#00d4ff";
      ctx.shadowColor = "#00d4ff";
      ctx.shadowBlur = 8;
      ctx.font = "bold 9px 'Geist Mono', monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      if (p1Confirmed) {
        ctx.fillText("P1 ✓ READY!", cardX + cardW / 2, cursorY + 8);
      } else {
        ctx.fillText("▲ P1", cardX + cardW / 2, cursorY + 8);
      }
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }

    if (isP2Selected) {
      const p2LabelY = isP1Selected ? cursorY + 22 : cursorY + 8;
      const p2Alpha = Math.abs(Math.sin(animTimer * 3 + 1)) * 0.4 + 0.6;
      ctx.globalAlpha = p2Alpha;
      ctx.fillStyle = "#ff2244";
      ctx.shadowColor = "#ff2244";
      ctx.shadowBlur = 8;
      ctx.font = "bold 9px 'Geist Mono', monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const p2Label = isOnline ? "P2" : "CPU";
      if (p2Confirmed) {
        ctx.fillText(`${p2Label} ✓ READY!`, cardX + cardW / 2, p2LabelY);
      } else {
        ctx.fillText(`▲ ${p2Label}`, cardX + cardW / 2, p2LabelY);
      }
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }
  }

  // P2 index = -1: CPU hasn't picked yet
  if (p2Index === -1 && !isOnline) {
    const pulseAlpha = Math.abs(Math.sin(animTimer * 4)) * 0.5 + 0.3;
    ctx.globalAlpha = pulseAlpha;
    ctx.fillStyle = "#ff2244";
    ctx.font = "bold 11px 'Geist Mono', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("CPU CHOOSING...", cx, cardY + cardH + 28);
    ctx.globalAlpha = 1;
  }

  // Bottom controls hints
  const hintY = CANVAS_HEIGHT - 20;
  const hintAlpha = Math.abs(Math.sin(animTimer * 2.5)) * 0.3 + 0.5;
  ctx.globalAlpha = hintAlpha;
  ctx.fillStyle = "#00ff88";
  ctx.shadowColor = "#00ff88";
  ctx.shadowBlur = 8;
  ctx.font = "bold 11px 'Geist Mono', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("◀ ▶ SELECT    ENTER / F = CONFIRM", cx, hintY);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;

  // VS divider in the center
  ctx.fillStyle = "rgba(255,238,0,0.15)";
  ctx.font = "bold 36px 'Geist Mono', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "#ffee00";
  ctx.shadowBlur = 20;
  ctx.fillStyle = "#ffee0044";
  ctx.fillText("VS", cx, cardY + cardH / 2);
  ctx.shadowBlur = 0;
}

// Draw a mini fighter silhouette (scaled ~80px tall) for character select cards
function drawMiniFighter(
  ctx: CanvasRenderingContext2D,
  cx: number,
  baseY: number,
  char: CharacterDef,
  animTimer: number,
) {
  const scale = 0.75;
  const color = char.color;
  const accent = char.accentColor;
  const skin = "#f5c89a";
  const bob = Math.sin(animTimer * 3) * 2;

  ctx.save();
  ctx.translate(cx, baseY);

  // Shadow
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.ellipse(0, 0, 22 * scale, 6 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  const h = 100 * scale;
  const w = 60 * scale;
  const hw = w / 2;

  // Legs
  ctx.fillStyle = color;
  ctx.fillRect(-hw + 14 * scale, -40 * scale + bob, 14 * scale, 40 * scale);
  ctx.fillRect(-hw + 32 * scale, -40 * scale + bob, 14 * scale, 40 * scale);

  // Leg wraps
  ctx.fillStyle = accent;
  ctx.fillRect(-hw + 14 * scale, -12 * scale + bob, 14 * scale, 5 * scale);
  ctx.fillRect(-hw + 32 * scale, -12 * scale + bob, 14 * scale, 5 * scale);

  // Body
  ctx.fillStyle = color;
  ctx.fillRect(-hw + 10 * scale, -80 * scale + bob, 40 * scale, 45 * scale);

  // Belt
  ctx.fillStyle = "#ffaa00";
  ctx.fillRect(-hw + 10 * scale, -38 * scale + bob, 40 * scale, 5 * scale);

  // Gi lapels
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.moveTo(0, -80 * scale + bob);
  ctx.lineTo(-8 * scale, -40 * scale + bob);
  ctx.lineTo(0, -45 * scale + bob);
  ctx.lineTo(8 * scale, -40 * scale + bob);
  ctx.closePath();
  ctx.fill();

  // Arms
  ctx.fillStyle = skin;
  ctx.fillRect(-hw + 2 * scale, -80 * scale + bob, 10 * scale, 35 * scale);
  ctx.fillRect(-hw + 48 * scale, -80 * scale + bob, 10 * scale, 35 * scale);

  // Fists glow
  ctx.shadowColor = accent;
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.arc(-hw + 7 * scale, -45 * scale + bob, 7 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-hw + 53 * scale, -45 * scale + bob, 7 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Neck
  ctx.fillStyle = skin;
  ctx.fillRect(-hw + 24 * scale, -88 * scale + bob, 12 * scale, 12 * scale);

  // Head
  ctx.beginPath();
  ctx.roundRect(-hw + 15 * scale, -h + bob, 30 * scale, 28 * scale, 6 * scale);
  ctx.fill();

  // Hair
  ctx.fillStyle =
    char.id === "scorpion"
      ? "#1a1a00"
      : char.id === "ken"
        ? "#2a1a00"
        : "#1a0000";
  ctx.fillRect(-hw + 15 * scale, -h + bob, 30 * scale, 9 * scale);

  // Headband
  ctx.fillStyle =
    char.id === "scorpion"
      ? "#ffee00"
      : char.id === "ken"
        ? "#ff4400"
        : "#ffcc00";
  ctx.fillRect(-hw + 15 * scale, -h + 8 * scale + bob, 30 * scale, 4 * scale);

  // Eyes
  ctx.fillStyle = "#fff";
  ctx.fillRect(-hw + 20 * scale, (-h + 12) * scale + bob, 6 * scale, 4 * scale);
  ctx.fillRect(-hw + 34 * scale, (-h + 12) * scale + bob, 6 * scale, 4 * scale);
  ctx.fillStyle = "#333";
  ctx.fillRect(-hw + 22 * scale, (-h + 13) * scale + bob, 3 * scale, 3 * scale);
  ctx.fillRect(-hw + 36 * scale, (-h + 13) * scale + bob, 3 * scale, 3 * scale);

  // Character-specific accent glow aura
  const auraAlpha = Math.abs(Math.sin(animTimer * 2)) * 0.15 + 0.05;
  ctx.globalAlpha = auraAlpha;
  ctx.fillStyle = accent;
  ctx.shadowColor = accent;
  ctx.shadowBlur = 20;
  ctx.beginPath();
  ctx.ellipse(0, -h / 2 + bob, 35 * scale, 55 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;

  ctx.restore();
}

// === LEADERBOARD SCREEN ===
export function drawLeaderboard(
  ctx: CanvasRenderingContext2D,
  entries: Array<{
    principal: string;
    wins: number;
    losses: number;
    draws: number;
  }>,
  timer: number,
) {
  ctx.fillStyle = "rgba(0,0,0,0.9)";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  const cx = CANVAS_WIDTH / 2;

  ctx.shadowColor = "#ffee00";
  ctx.shadowBlur = 20;
  ctx.fillStyle = "#ffee00";
  ctx.font = "bold 36px 'Geist Mono', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("LEADERBOARD", cx, 50);
  ctx.shadowBlur = 0;

  // Column headers
  ctx.fillStyle = "rgba(0, 212, 255, 0.8)";
  ctx.font = "bold 11px 'Geist Mono', monospace";
  ctx.textAlign = "center";
  ctx.fillText("#", 80, 95);
  ctx.fillText("PLAYER", cx - 40, 95);
  ctx.fillText("W", cx + 80, 95);
  ctx.fillText("L", cx + 110, 95);
  ctx.fillText("D", cx + 140, 95);

  ctx.strokeStyle = "rgba(0,212,255,0.3)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(40, 103);
  ctx.lineTo(CANVAS_WIDTH - 40, 103);
  ctx.stroke();

  const displayEntries = entries.slice(0, 8);

  for (let i = 0; i < displayEntries.length; i++) {
    const e = displayEntries[i];
    const rowY = 120 + i * 32;

    // Row highlight on hover
    if (i % 2 === 0) {
      ctx.fillStyle = "rgba(0,212,255,0.03)";
      ctx.fillRect(40, rowY - 12, CANVAS_WIDTH - 80, 28);
    }

    const rankColors = ["#ffee00", "#aaaaaa", "#cc8844", "#888888"];
    ctx.fillStyle = rankColors[Math.min(i, 3)];
    ctx.font = `bold 13px 'Geist Mono', monospace`;
    ctx.textAlign = "center";

    if (i === 0) {
      ctx.shadowColor = "#ffee00";
      ctx.shadowBlur = 8;
    }

    ctx.fillText(`${i + 1}`, 80, rowY);
    ctx.shadowBlur = 0;

    ctx.fillStyle = i === 0 ? "#ffee00" : "#cccccc";
    ctx.font = `12px 'Geist Mono', monospace`;
    ctx.textAlign = "center";
    const shortPrincipal =
      e.principal.length > 16
        ? `${e.principal.slice(0, 8)}...${e.principal.slice(-4)}`
        : e.principal;
    ctx.fillText(shortPrincipal, cx - 40, rowY);

    ctx.fillStyle = "#00ff88";
    ctx.fillText(e.wins.toString(), cx + 80, rowY);
    ctx.fillStyle = "#ff4444";
    ctx.fillText(e.losses.toString(), cx + 110, rowY);
    ctx.fillStyle = "#aaaaaa";
    ctx.fillText(e.draws.toString(), cx + 140, rowY);
  }

  if (entries.length === 0) {
    ctx.fillStyle = "rgba(200,200,200,0.4)";
    ctx.font = "14px 'Geist Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText("NO SCORES YET — BE THE FIRST!", cx, 200);
  }

  // Back button
  const backAlpha = Math.abs(Math.sin(timer * 2)) * 0.3 + 0.7;
  ctx.globalAlpha = backAlpha;
  ctx.strokeStyle = "#00d4ff";
  ctx.lineWidth = 2;
  ctx.strokeRect(cx - 80, 400, 160, 36);
  ctx.fillStyle = "rgba(0, 212, 255, 0.1)";
  ctx.fillRect(cx - 80, 400, 160, 36);
  ctx.fillStyle = "#00d4ff";
  ctx.font = "bold 14px 'Geist Mono', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("◀ BACK  [ESC]", cx, 418);
  ctx.globalAlpha = 1;
}
