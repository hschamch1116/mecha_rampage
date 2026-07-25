// Single entry point for player-mecha identity, dimensions and shared materials.
// Mesh construction in index.html consumes this returned context so gameplay
// systems keep stable references while the character definition stays isolated.
window.createMechaCharacterContext = function createMechaCharacterContext(THREE, overrides = {}) {
  try {
    const saved = JSON.parse(localStorage.getItem('mechaCustomization') || '{}');
    overrides = { ...saved, ...overrides, meshes: { ...(saved.meshes || {}), ...(overrides.meshes || {}) } };
  } catch (_) {}
  const defaults = {
    hiddenParts: { head: true },
    colors: { body: '#34373a', armorLight: '#a3a09a' },
    dimensions: {
    height: 8.7,
    radius: 2.7,
    bodyBaseY: 4.92,
    upperPivotY: 4.18
    },
    meshes: {
      pelvis: { size: [3.45, 0.92, 2.72], position: [0, -0.68, -0.06] },
      hipSkirt: { size: [1.18, 1.18, 1.92], position: [1.72, -0.08, 0.08] },
      torso: { size: [5.8, 2.35, 3.65], position: [0, 0.08, -0.12] },
      lowerChest: { size: [4.45, 0.72, 3.15], position: [0, -0.95, -0.04] },
      frontArmor: { size: [4.25, 1.32, 0.62], position: [0, -0.02, 1.96] },
      head: { size: [0.85, 0.42, 0.92], position: [0, 0.12, 0.22] },
      legRoot: { position: [1.52, -0.08, 0] },
      thigh: { size: [1.25, 1.42, 1.38], position: [0, -0.68, 0.14] },
      knee: { size: [1.05, 1.08, 0.72], position: [0, -0.02, 0.65] },
      calf: { size: [1.18, 1.7, 1.28], position: [0, -0.88, -0.08] },
      rearCalf: { size: [0.82, 1.28, 0.55], position: [0, -0.86, -0.9] },
      foot: { size: [1.95, 0.58, 2.65], position: [0, 0, 0.34] },
      toe: { size: [0.54, 0.34, 1.05], position: [0.48, 0.02, 1.25] }
    }
  };
  const merge = (base, custom) => Object.fromEntries(Object.entries(base).map(([key, value]) => [
    key,
    value && typeof value === 'object' && !Array.isArray(value)
      ? merge(value, custom?.[key] || {})
      : custom?.[key] ?? value
  ]));
  const customization = merge(defaults, overrides);
  const dimensions = customization.dimensions;

  const player = new THREE.Group();
  player.name = 'PlayerMecha';
  player.userData.unitClass = 'MK486DX MEDIUM BATTLE WALKER';

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

  return { player, dimensions, materials, meshes: customization.meshes, hiddenParts: customization.hiddenParts || {}, colors: customization.colors };
};
