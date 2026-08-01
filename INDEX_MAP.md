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

## 2. Key Line Range Map for `index.html` (Total Lines: ~13,380)

### UI & Styling
- **L1 - L265**: CSS Styles, HUD, Vitals Overlay, Radar, Minimap, Loading Screen, Title Screen, Hangar UI Panel.
- **L176**: `.settings-panel` CSS style (`max-height: calc(100vh - 48px); overflow-y: auto;`).

### HTML Structure
- **L340 - L560**: Hangar Overlay, Weapon Slot Selectors, Customizer Modal, Controls hint panels.
- **L533 - L548**: Visual Settings Modal Panel (`#visualSettings`), containing Hangar Atmosphere & Fog Controls (Fog Mode, Color, Density, Near/Far, Steam, Dust).

### Script Imports & Core Setup
- **L600 - L615**: Script tags (`js/mecha-config-store.js`, `js/weapon-system.js`, `js/mecha-rigidbody.js`, `js/cannon-physics.js`, `js/enemy-ai.js`, `js/mecha-character.js`, `js/audio-manager.js`) and importmap (`three`, `cannon-es`).

### Mecha Mesh Construction & Rigging
- **L1970 - L1995**: Leg root attachment setup (`playerLegs`, `REVERSE_LEG_GROUND_OFFSET`, `pelvis.add(leg)`).
- **L1996 - L2115**: Hip, Thigh, Knee, Shin, Calf, Ankle, Sole construction.
- **L2116 - L2140**: Toe Construction (`toeLayout`, 2 front toes + 1 rear toe pivot).
- **L2155 - L2380**: Dual Gatling Arms & Weapon Pods.
- **L2390 - L2440**: Missile Launcher Hardpoints.
- **L3660 - L4430**: Hangar Environment 3D Scene Construction (Platform, Lights, GDI Emblem, Enclosure Box, Sci-Fi Scaffolding Railings, Hanging Cables).
- **L4431 - L5140**: High-Detail Industrial Robot Arms, Hangar Floor Cable Bundles (`CatmullRomCurve3`) & Junction Boxes (outside elevator radius R > 3.2m), Linear Hangar Fog (`THREE.Fog`), 3D Quadcopter Drones.

### Hangar & Launch Sequence Logic
- **L5145 - L5550**: `updateHangar` maintenance updates, Elevator Platform Arrival & 1-Second Delayed Safety Fence Lowering sequence (`fenceLowerProgress`), Quadcopter Drone Motion Blending Physics.
- **L5785 - L5800**: `plantCustomizerFeet()` (Customizer sole level alignment).
- **L6195 - L6245**: Visual Settings Modal Event Listeners & Hangar Fog/Atmosphere Update Logic.

### Customizer Data Sync & Presets
- **L5840 - L5865**: `customSaveButton` and `customExportButton` event listeners (saving to `MechaConfigStore.saveCustomization` and `MechaConfigStore.saveLoadout`).

### Leg Motion, IK & Ground Adaptation Physics
- **L8415 - L8450**: Stride evaluation function (`evaluateHeavyMechStep`).
- **L8740 - L8800**: Stride cycle updates, ground speed calculation, footstep sound/particles.
- **L8830 - L8890**: Leg IK joint target interpolation (Hip, Knee, Shin, Ankle, Foot Pitch, Toe Curl).
- **L8891 - L8955**: Ground Adaptation & Raycasting (Sole height alignment, terrain pitch slope angle adaptation, toe curl).
- **L8990 - L9040**: Pelvic stance follow, hip socket carrier position sync, waist rotation isolation.

### Camera, Controls & Main Game Loop
- **L7770 - L7800**: Hangar & Title screen mouse/touch Drag Event Listeners (Yaw & Vertical Pitch camera orbit control).
- **L11755 - L11795**: `updateCamera()` Hangar & Title screen camera tracking interpolation (Yaw + Pitch height rotation).
- **L10825 - L10840**: `resetPlayerState()` (Leg and joint reset to neutral pose).
- **L11270 - L11340**: Main `animate()` requestAnimationFrame loop.

---

## 3. Key Data Contracts & Conventions
- `playerLegs`: Array containing `leftLeg` [0] and `rightLeg` [1] `THREE.Group` instances attached to `pelvis`.
- `mechaAttachments.leftLeg` / `mechaAttachments.rightLeg`: Local coordinate attachments `[-2.02, -0.07, 0]` and `[2.02, -0.07, 0]`.
- `toeLayout`: 2 front toes per foot (`{ x: -.38, z: .84, yaw: -.26 }` and `{ x: .38, z: .84, yaw: .26 }`).
- `hangarLaunching`: Boolean flag set to `true` during catapult launch out of hangar tunnel.
- `MechaConfigStore`: Storage manager for persistent player customization and weapon loadouts.
