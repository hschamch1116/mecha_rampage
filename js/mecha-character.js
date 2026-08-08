// Single entry point for player-mecha identity, dimensions and shared materials.
// Mesh construction in index.html consumes this returned context so gameplay
// systems keep stable references while the character definition stays isolated.
window.createMechaCharacterContext = function createMechaCharacterContext(THREE, overrides = {}) {
  try {
    const saved = JSON.parse(localStorage.getItem('mechaCustomization') || '{}');
    const migratedSaved = saved.designVersion === 8
      ? saved
      : { colors: saved.colors, hiddenParts: saved.hiddenParts, hiddenBodyJoints: saved.hiddenBodyJoints, hideAllJoints: saved.hideAllJoints };
    overrides = {
      ...migratedSaved,
      ...overrides,
      meshes: { ...(migratedSaved.meshes || {}), ...(overrides.meshes || {}) }
    };
  } catch (_) {}
  const defaults = {
    designVersion: 8,
    hiddenParts: { head: true },
    hiddenBodyJoints: {
      backpack: true,
      leftArm: true,
      rightArm: true,
      leftSub: true,
      rightSub: true,
      lowerLink: true
    },
    hideAllJoints: true,
    colors: { body: '#2a3038', armorLight: '#6f7782' },
    dimensions: {
    height: 10.75,
    radius: 2.9,
    bodyBaseY: 6.67,
    upperPivotY: 5.83
    },
    attachments: {
      leftArm: [-3.5348411865234373, 7.452799926757812, 0.12], rightArm: [3.5348411865234373, 7.452799926757812, 0.12],
      leftWeapon: [-2.126160791015626, 9.711599945068361, 0.46400000000000063],
      rightWeapon: [2.126160791015626, 9.711599945068361, 0.46400000000000063],
      backpack: [0, 3.47519989013672, -0.9888002929687505],
      leftHoming: [-3.5348411865234373, 7.452799926757812, 0.12],
      rightHoming: [3.5348411865234373, 7.452799926757812, 0.12],
      leftCannon: [-1.42, 7.05, -0.2], rightCannon: [1.42, 7.05, -0.2], leftGatling: [-1.42, 7.05, -0.2], rightGatling: [1.42, 7.05, -0.2], leftLaser: [-1.42, 7.05, -0.2], rightLaser: [1.42, 7.05, -0.2],
      slot3Mount: [-2.126160791015626, 9.711599945068361, 0.46400000000000063],
      slot4Mount: [2.126160791015626, 9.711599945068361, 0.46400000000000063],
      leftLeg: [-2.02, -0.07, 0], rightLeg: [2.02, -0.07, 0]
    },
    ballJointSize: 1,
    ballJointLayout: {
      backpack: [0, 0.8551998901367189, -2.4388002929687502],
      leftArm: [-3.9276013183593745, -0.18720007324218763, 0.12],
      rightArm: [3.9276013183593745, -0.18720007324218763, 0.12],
      leftSub: [-2.362400878906251, 2.0715999450683604, 0.46400000000000063],
      rightSub: [2.362400878906251, 2.0715999450683613, 0.46400000000000063],
      lowerLink: [0, -1.5, -0.02]
    },
    partJointOffsets: {
      backpack: [0, 5.02, -1.45], leftArm: [0, 0, 0], rightArm: [0, 0, 0],
      leftWeapon: [0, 0, 0], rightWeapon: [0, 0, 0], leftLeg: [0, 0, 0], rightLeg: [0, 0, 0],
      leftCannon: [0, 0, 0], rightCannon: [0, 0, 0], leftGatling: [0, 0, 0], rightGatling: [0, 0, 0],
      leftLaser: [0, 0, 0], rightLaser: [0, 0, 0], leftHoming: [0, 0, 0], rightHoming: [0, 0, 0]
      , slot3Mount: [0, 0, 0], slot4Mount: [0, 0, 0]
    },
    meshes: {
      pelvis: { size: [3.72, 1.08, 2.62], position: [0, -0.64, -0.02] },
      hipSkirt: { size: [1.18, 1.3, 1.76], position: [1.76, -0.12, 0.02] },
      torso: { size: [5.34, 2.08, 3.48], position: [0, 0.18, -0.18] },
      lowerChest: { size: [4.22, 0.76, 2.94], position: [0, -0.92, -0.04] },
      frontArmor: { size: [4.85, 1.12, 0.68], position: [0, -0.02, 1.82] },
      // Match the gameplay pivot at rest; the customizer can raise it further.
      upperBody: { position: [0, 6.8, 0] },
      leftArm: { rotation: [-0.06, 0.08, -0.08] },
      rightArm: { rotation: [-0.06, -0.08, 0.08] },
      head: { size: [0.76, 0.34, 0.82], position: [0, 0.06, 0.18] },
      legRoot: { position: [2.02, -0.07, 0] },
      thigh: { size: [1.54, 2.25, 1.63], position: [0, -1.0, 0.14] },
      knee: { size: [1.32, 1.15, 0.94], position: [0, -0.04, 0.86] },
      calf: { size: [1.3, 3.05, 1.42], position: [0, -1.43, -0.05] },
      rearCalf: { size: [0.82, 2.35, 0.65], position: [0, -1.38, -0.98] },
      foot: { size: [1.56, 0.53, 2.06], position: [0, 0, 0.19] },
      toe: { size: [0.5, 0.36, 1.54], position: [0.58, 0.02, 1.18] }
    }
  };
  const merge = (base, custom) => Object.fromEntries(Object.entries(base).map(([key, value]) => [
    key,
    value && typeof value === 'object' && !Array.isArray(value)
      ? merge(value, custom?.[key] || {})
      : custom?.[key] ?? value
  ]));
  const customization = merge(defaults, overrides);
  if (customization.attachments) {
    customization.attachments.leftLeg = [-2.02, -0.07, 0];
    customization.attachments.rightLeg = [2.02, -0.07, 0];
  }
  const dimensions = customization.dimensions;

  const player = new THREE.Group();
  player.name = 'PlayerMecha';
  player.userData.unitClass = 'MK486DX HEAVY ASSAULT WALKER';

  const materials = {
    armorMat: new THREE.MeshStandardMaterial({ color: customization.colors.body, roughness: .42, metalness: .62 }),
    armorLightMat: new THREE.MeshStandardMaterial({ color: customization.colors.armorLight, roughness: .36, metalness: .55 }),
    gunmetalMat: new THREE.MeshStandardMaterial({ color: 0x0b0e12, roughness: .32, metalness: .88 }),
    accentMat: new THREE.MeshStandardMaterial({ color: 0x9d2028, roughness: .34, metalness: .62 }),
    glowMat: new THREE.MeshStandardMaterial({ color: 0x61efff, emissive: 0x08a9d2, emissiveIntensity: 2.7, roughness: .12, metalness: .3 }),
    eyeGreenMat: new THREE.MeshStandardMaterial({ color: 0x8efff5, emissive: 0x10d9d0, emissiveIntensity: 3.1, roughness: .1, metalness: .18 }),
    warningMat: new THREE.MeshStandardMaterial({ color: 0xff9d3b, emissive: 0xc74708, emissiveIntensity: 1.75, roughness: .23, metalness: .46 }),
    missilePortMat: new THREE.MeshStandardMaterial({ color: 0x090c10, roughness: .38, metalness: .88 }),
    hydraulicMat: new THREE.MeshStandardMaterial({ color: 0x9ba5ad, roughness: .22, metalness: .92 }),
    jointBallMat: new THREE.MeshStandardMaterial({ color: 0xd6e3e8, emissive: 0x173b44, emissiveIntensity: .75, roughness: .12, metalness: 1 }),
    jointGlowMat: new THREE.MeshBasicMaterial({ color: 0x55e9ff, toneMapped: false })
  };

  return { player, dimensions, materials, meshes: customization.meshes, attachments: customization.attachments, ballJointSize: customization.ballJointSize, ballJointLayout: customization.ballJointLayout, partJointOffsets: customization.partJointOffsets, hiddenParts: customization.hiddenParts || {}, hiddenBodyJoints: customization.hiddenBodyJoints || {}, hideAllJoints: !!customization.hideAllJoints, colors: customization.colors };
};
