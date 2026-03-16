# Street Kombat

## Current State
The game has mobile/desktop detection, a landscape-only layout, a 'rotate your device' overlay shown in portrait on mobile, touch controls for mobile landscape, and keyboard controls for desktop.

## Requested Changes (Diff)

### Add
- On mobile portrait: clear, styled 'rotate to play' prompt with animated phone icon (already exists, ensure it's polished)
- Ensure CSS/meta viewport prevents unwanted scaling or pinch-zoom on mobile

### Modify
- Mobile: game is playable in landscape (rotated phone) — ensure the canvas and controls scale correctly to fill the rotated landscape viewport without letterboxing or cutoff
- PC: game plays upright in normal landscape monitor orientation — no rotation needed, keyboard controls shown at bottom, canvas centered and fills available horizontal space
- Orientation change events: re-evaluate scale and layout correctly after phone rotation

### Remove
- Nothing removed

## Implementation Plan
1. Audit the `updateLayout` function — ensure it correctly computes scale for both desktop landscape and mobile landscape (post-rotation)
2. On mobile landscape (isPortrait === false, isMobile === true): canvas fills viewport width minus safe areas, controls overlay at bottom
3. On desktop (isMobile === false): canvas centered, fills available height minus keyboard legend bar
4. Ensure `<meta name=viewport>` in index.html has `user-scalable=no` and `viewport-fit=cover` for mobile
5. Orientation-change listener fires layout recalculation after a short delay (100ms) to let the browser reflow first
