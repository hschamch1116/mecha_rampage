# Mecha Rampage - Project Code Map & Index (`INDEX_MAP.md`)

This index file provides key line ranges, data structures, and function mappings for `index.html` and surrounding project files to optimize AI agent context usage and avoid reading large files repeatedly.

---

## 1. File Structure Overview
- `index.html`: Main game application (HTML structure, Three.js 3D rendering, Mecha procedural IK animation, Customizer UI, Hangar Scene, Battle Loop).
- `game.html`: Sub-route iframe wrapper for `index.html?mode=game`.
- `js/`: Core JavaScript Modules directory.
  - `js/enemy-ai.js`: Enemy Mecha AI logic, state machines, combat behavior (`EnemyAI` class).
  - `js/audio-manager.js`: Sound effects and background music system (`AudioManager`).
  - `js/cannon-physics.js`: Physics and projectile trajectory calculations (`CannonPhysicsContext`).
  - `js/weapon-system.js`: Weapon profiles, Gatling, Cannon, Laser, and Homing Missile mechanics.
  - `js/mecha-character.js`: Mecha part dimensions, materials, and `createMechaCharacterContext`.
  - `js/mecha-gait-controller.js`: Standalone Reverse-Joint Gait & IK Controller (`createMechaGaitController`).
  - `js/mecha-config-store.js`: Local storage persistence (`MechaConfigStore`).
  - `js/mecha-rigidbody.js`: Physics body integration (`MechaRigidBody`).
  - `js/level1-map.js`: Level 1 map terrain coordinates & constants.
- `mecha-preset.json` & `mecha-preset_2.json`: Preset JSON loadouts and part scale configurations.

---

## 2. Key Line Range Map for `index.html` (Total Lines: ~11,200)

### UI & Styling
- **L1 - L340**: CSS Styles, HUD, Vitals Overlay, Radar, Minimap, Loading Screen, Title Screen, Hangar UI Panel.

### HTML Structure
- **L340 - L550**: Hangar Overlay, Weapon Slot Selectors, Customizer Modal, Controls hint panels.

### Script Imports & Core Setup
- **L553 - L568**: Script tags (`js/mecha-config-store.js`, `js/weapon-system.js`, `js/mecha-rigidbody.js`, `js/cannon-physics.js`, `js/enemy-ai.js`, `js/mecha-character.js`, `js/audio-manager.js`) and importmap (`three`, `cannon-es`).

### Mecha Mesh Construction & Rigging
- **L1940 - L1965**: Leg root attachment setup (`playerLegs`, `REVERSE_LEG_GROUND_OFFSET`, `pelvis.add(leg)`).
- **L1966 - L2085**: Hip, Thigh, Knee, Shin, Calf, Ankle, Sole construction.
- **L2086 - L2110**: Toe Construction (`toeLayout`, 2 front toes + 1 rear toe pivot).
- **L2125 - L2350**: Dual Gatling Arms & Weapon Pods.
- **L2360 - L2410**: Missile Launcher Hardpoints.
- **L2875 - L3500**: Hangar Environment 3D Scene Construction (Drones, Gate, Platform, Lights, Steam).

### Hangar & Launch Sequence Logic
- **L3547 - L3660**: Hangar maintenance updates, Title screen camera/platform lift motion.
- **L3661 - L3717**: `hangarLaunching` update block (Gate open animation, `player.position.y` launch ascent, leg root snapping & flight pose lock).
- **L5757 - L5770**: `plantCustomizerFeet()` (Customizer sole level alignment).
- **L5981 - L6000**: `battleStartButton` click listener (Launch sequence trigger, leg position reset).

### Customizer Data Sync & Presets
- **L5784 - L5806**: `customSaveButton` and `customExportButton` event listeners (saving to `MechaConfigStore.saveCustomization` and `MechaConfigStore.saveLoadout`).

### Leg Motion, IK & Ground Adaptation Physics
- **L8358 - L8395**: Stride evaluation function (`evaluateHeavyMechStep`).
- **L8680 - L8740**: Stride cycle updates, ground speed calculation, footstep sound/particles.
- **L8770 - L8831**: Leg IK joint target interpolation (Hip, Knee, Shin, Ankle, Foot Pitch, Toe Curl).
- **L8833 - L8897**: Ground Adaptation & Raycasting (Sole height alignment, terrain pitch slope angle adaptation, toe curl).
- **L8930 - L8980**: Pelvic stance follow, hip socket carrier position sync, waist rotation isolation.

### Camera, Controls & Main Game Loop
- **L10010 - L10023**: Hangar maintenance & launch camera tracking logic.
- **L10765 - L10777**: `resetPlayerState()` (Leg and joint reset to neutral pose).
- **L11190 - L11215**: Main `animate()` requestAnimationFrame loop.

---

## 3. Key Data Contracts & Conventions
- `playerLegs`: Array containing `leftLeg` [0] and `rightLeg` [1] `THREE.Group` instances attached to `pelvis`.
- `mechaAttachments.leftLeg` / `mechaAttachments.rightLeg`: Local coordinate attachments `[-2.02, -0.07, 0]` and `[2.02, -0.07, 0]`.
- `toeLayout`: 2 front toes per foot (`{ x: -.38, z: .84, yaw: -.26 }` and `{ x: .38, z: .84, yaw: .26 }`).
- `hangarLaunching`: Boolean flag set to `true` during catapult launch out of hangar tunnel.
- `MechaConfigStore`: Storage manager for persistent player customization and weapon loadouts.
