# Street Kombat

## Current State
A full-screen canvas fighting game with:
- Player character (KEN, blue) vs CPU (RYU, red)
- Arrow keys + A/S/D/Z/X/F for movement and attacks
- Special moves via combo inputs (Dragon Blast, Rising Storm, Cyclone Kick)
- Finisher sequence (SUPREME FINISH) when CPU is at low health + player has full special meter
- Mobile landscape controls with D-pad and action buttons
- Portrait-lock overlay asking to rotate phone
- Online VS Friend mode via BroadcastChannel + room code URL
- Haptic rumble on hits/KOs
- Leaderboard via backend actor

## Requested Changes (Diff)

### Add
- **Character select screen** (new `characterSelect` game phase): shown before each match starts, displayed for both P1 and P2
- **3+ playable characters** with distinct stats, colors, names, and special moves:
  - KEN (blue) — current player; fast, fireball, rising storm
  - RYU (red) — balanced; fireball, spin kick  
  - SCORPION (orange/yellow) — slow but powerful; teleport throw, hellfire projectile
- Each character has different: base HP, walk speed, attack damage multiplier, and one unique special move palette
- **Character icons/cards** rendered on a character select canvas (stylized arcade-style)
- Player selects character with left/right arrows + Enter (or tap on mobile)
- CPU picks a random character (or P2 selects their own in online mode)
- Selected character name/color applied to the fighter at game start
- **P2 character select** in online mode: both players see the select screen, P1 picks, P2 picks; game starts when both confirm

### Modify
- `initGameState` and `startGame` to respect chosen character for P1 and CPU/P2
- `createPlayer` / `createCPU` to accept a character definition parameter
- Game phase enum extended with `characterSelect`
- `renderer.ts`: add `drawCharacterSelect` function rendering the character select screen on canvas
- `engine.ts`: character stats baked into Fighter on creation
- `FightingGame.tsx`: new state for selected characters; keyboard/touch handlers for character select navigation
- `constants.ts`: add per-character stat definitions

### Remove
- Nothing removed

## Implementation Plan
1. Add character definitions to `constants.ts` (name, color, stats, special set)
2. Extend game types in `types/game.ts` to add `characterSelect` phase and character info
3. Update `engine.ts` `createPlayer`/`createCPU` to accept a character parameter
4. Add `drawCharacterSelect` to `renderer.ts`
5. Update `FightingGame.tsx`:
   - Add `characterSelect` phase handling in game loop
   - Keyboard navigation for character select (left/right to cycle, Enter to confirm)
   - Touch/tap support for mobile character select
   - P1 selects, then CPU picks random (vs-cpu) or P2 selects (vs-online)
   - Pass selected characters into `startGame`
6. Update `OnlineLobby` / broadcast logic to sync P2 character choice
