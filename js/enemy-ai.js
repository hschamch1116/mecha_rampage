window.createConformalEnergyShield = window.createConformalEnergyShield || function createConformalEnergyShield(THREE, root, options = {}) {
  const color = new THREE.Color(options.color ?? 0x55dcff);
  const rimColor = new THREE.Color(options.rimColor ?? 0xd6fbff);
  const shellScale = options.shellScale ?? 1.035;
  const thickness = options.thickness ?? 0.045;
  const waveAmplitude = options.waveAmplitude ?? 0.028;

  const uniforms = {
    uTime: { value: 0 },
    uStrength: { value: 0 },
    uEnergyRatio: { value: 0 },
    uColor: { value: color },
    uRimColor: { value: rimColor },
    uHitPoint: { value: new THREE.Vector3(10000, 10000, 10000) },
    uHitTime: { value: -1000 },
    uHitIntensity: { value: 0 },
    uThickness: { value: thickness },
    uWaveAmplitude: { value: waveAmplitude }
  };

  const material = new THREE.ShaderMaterial({
    name: 'ConformalWaterEnergyShield',
    uniforms,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
    vertexShader: `
      uniform float uTime;
      uniform float uStrength;
      uniform float uThickness;
      uniform float uWaveAmplitude;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      varying float vWave;

      void main() {
        vec3 n = normalize(normal);
        vec4 baseWorld = modelMatrix * vec4(position, 1.0);
        float waveA = sin(baseWorld.y * 5.4 + baseWorld.x * 2.1 + uTime * 3.8);
        float waveB = sin(baseWorld.z * 6.7 - baseWorld.y * 1.6 - uTime * 3.1);
        float waveC = sin((baseWorld.x + baseWorld.z) * 4.2 + uTime * 2.4);
        float wave = (waveA + waveB + waveC) / 3.0;
        float displacement = uThickness + wave * uWaveAmplitude * (0.35 + 0.65 * uStrength);
        vec3 displaced = position + n * displacement;
        vec4 worldPosition = modelMatrix * vec4(displaced, 1.0);
        vWorldPosition = worldPosition.xyz;
        vWorldNormal = normalize(mat3(modelMatrix) * n);
        vWave = wave;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uStrength;
      uniform float uEnergyRatio;
      uniform vec3 uColor;
      uniform vec3 uRimColor;
      uniform vec3 uHitPoint;
      uniform float uHitTime;
      uniform float uHitIntensity;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      varying float vWave;

      void main() {
        if (uStrength <= 0.002) discard;

        vec3 normal = normalize(vWorldNormal);
        vec3 viewDir = normalize(cameraPosition - vWorldPosition);
        float facing = abs(dot(normal, viewDir));
        float fresnel = pow(1.0 - clamp(facing, 0.0, 1.0), 2.15);

        float flowA = sin(dot(vWorldPosition, vec3(2.6, 4.7, 1.9)) + uTime * 4.2);
        float flowB = sin(dot(vWorldPosition, vec3(-3.8, 2.3, 4.4)) - uTime * 3.4);
        float flowC = sin(dot(vWorldPosition, vec3(5.1, -1.7, 2.8)) + uTime * 2.65);
        float liquid = 0.5 + 0.5 * (flowA + flowB + flowC) / 3.0;
        float caustic = smoothstep(0.62, 0.96, liquid);
        float scan = pow(0.5 + 0.5 * sin(vWorldPosition.y * 10.0 - uTime * 5.8 + vWave * 2.6), 11.0);

        float hitAge = uTime - uHitTime;
        float hitRing = 0.0;
        if (hitAge >= 0.0 && hitAge < 1.35) {
          float hitDistance = distance(vWorldPosition, uHitPoint);
          float ringRadius = hitAge * 13.5;
          float ringShape = exp(-pow((hitDistance - ringRadius) * 2.25, 2.0));
          hitRing = ringShape * (1.0 - hitAge / 1.35) * uHitIntensity;
        }

        float breathing = 0.82 + 0.18 * sin(uTime * 2.0 + vWorldPosition.y * 0.9);
        float energyFloor = 0.58 + 0.42 * sqrt(max(uEnergyRatio, 0.0));
        float alpha = (0.018 + fresnel * 0.54 + caustic * 0.095 + scan * 0.075 + hitRing * 0.9)
                    * uStrength * breathing * energyFloor * 0.5;

        vec3 shieldColor = mix(uColor, uRimColor, clamp(fresnel * 0.9 + hitRing, 0.0, 1.0));
        float glow = 1.25 + fresnel * 4.4 + caustic * 1.35 + scan * 1.65 + hitRing * 7.5;
        shieldColor *= glow;

        gl_FragColor = vec4(shieldColor, clamp(alpha, 0.0, 0.92));
      }
    `
  });
  material.toneMapped = false;

  const sourceMeshes = [];
  root.traverse(object => {
    if (!object.isMesh || !object.geometry || object.userData?.energyShieldShell || object.userData?.excludeEnergyShield) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    const isJoint = object.userData?.isJoint || object.userData?.bodyJointId || object.userData?.gizmoAxis ||
      materials.some(m => m && (m === window.jointBallMat || m === window.jointGlowMat));
    if (isJoint) return;
    const additiveFx = materials.some(sourceMaterial =>
      sourceMaterial?.transparent && sourceMaterial?.blending === THREE.AdditiveBlending
    );
    if (!additiveFx) sourceMeshes.push(object);
  });

  const shells = sourceMeshes.map(source => {
    const shell = new THREE.Mesh(source.geometry, material);
    shell.name = `${source.name || 'MechPart'}_EnergyShield`;
    shell.scale.setScalar(shellScale);
    shell.renderOrder = 35;
    shell.frustumCulled = source.frustumCulled;
    shell.castShadow = false;
    shell.receiveShadow = false;
    shell.visible = false;
    shell.userData.energyShieldShell = true;
    shell.raycast = () => {};
    source.add(shell);
    return shell;
  });

  let energyRatio = 0;
  let visualStrength = 0;
  let impactEnvelope = 0;
  let forcedVisible = true;

  const setShellVisibility = visible => {
    for (const shell of shells) {
      const source = shell.parent;
      if (!source) {
        shell.visible = false;
        continue;
      }
      let sourceVisible = source.visible;
      if (sourceVisible && source.material) {
        if (Array.isArray(source.material)) sourceVisible = source.material.some(m => m && m.visible !== false);
        else sourceVisible = source.material.visible !== false;
      }
      if (sourceVisible) {
        let ancestor = source.parent;
        while (ancestor && ancestor !== root) {
          if (ancestor.visible === false) { sourceVisible = false; break; }
          ancestor = ancestor.parent;
        }
      }
      shell.visible = visible && Boolean(sourceVisible);
    }
  };

  const controller = {
    material,
    meshes: shells,
    uniforms,
    setStrength(value, immediate = false) {
      energyRatio = THREE.MathUtils.clamp(Number.isFinite(value) ? value : 0, 0, 1);
      uniforms.uEnergyRatio.value = energyRatio;
      if (immediate) {
        visualStrength = energyRatio > 0 ? 0.32 + 0.68 * Math.sqrt(energyRatio) : 0;
        uniforms.uStrength.value = visualStrength;
        setShellVisibility(forcedVisible && visualStrength > 0.002);
      }
    },
    hit(worldPoint, intensity = 1) {
      const fallback = root.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 4.2, 0));
      uniforms.uHitPoint.value.copy(worldPoint || fallback);
      uniforms.uHitTime.value = uniforms.uTime.value;
      uniforms.uHitIntensity.value = THREE.MathUtils.clamp(intensity, 0.25, 1.5);
      impactEnvelope = Math.max(impactEnvelope, 1);
      setShellVisibility(forcedVisible);
    },
    update(dt, value = energyRatio) {
      uniforms.uTime.value += dt;
      energyRatio = THREE.MathUtils.clamp(Number.isFinite(value) ? value : 0, 0, 1);
      uniforms.uEnergyRatio.value = energyRatio;
      impactEnvelope = Math.max(0, impactEnvelope - dt * 1.15);
      const energyVisual = energyRatio > 0 ? 0.32 + 0.68 * Math.sqrt(energyRatio) : 0;
      const impactVisual = impactEnvelope * 0.42;
      const target = Math.max(energyVisual, impactVisual);
      visualStrength = THREE.MathUtils.lerp(visualStrength, target, 1 - Math.exp(-dt * (target > visualStrength ? 14 : 7)));
      if (target <= 0.001 && visualStrength < 0.004) visualStrength = 0;
      uniforms.uStrength.value = visualStrength;
      setShellVisibility(forcedVisible && visualStrength > 0.002);
    },
    reset() {
      energyRatio = 0;
      visualStrength = 0;
      impactEnvelope = 0;
      uniforms.uStrength.value = 0;
      uniforms.uEnergyRatio.value = 0;
      uniforms.uHitTime.value = -1000;
      uniforms.uHitIntensity.value = 0;
      setShellVisibility(false);
    },
    dispose() {
      for (const shell of shells) shell.removeFromParent();
      material.dispose();
    }
  };

  Object.defineProperty(controller, 'visible', {
    get: () => forcedVisible && shells.some(shell => shell.visible),
    set: value => {
      forcedVisible = Boolean(value);
      setShellVisibility(forcedVisible && visualStrength > 0.002);
    }
  });

  controller.reset();
  return controller;
};

window.createEnemyAIClass = function createEnemyAIClass(THREE) {
const WEAPONS = window.MECHA_WEAPON_SYSTEM;
const MechaRigidBody = window.createMechaRigidBodyClass(THREE);
const AI_CONFIG = {
  ENERGY: {
    MAX: 200,
    GATLING: 5,
    CANNON: 12,
    DASH: 22,
    REGEN_COVER: 35,
    REGEN_MOVING_RETREAT: 15,
    REGEN_MOVING_NORMAL: 10,
    REGEN_IDLE: 15,
    JETPACK_DRAIN: 10,
    JETPACK_DURATION: 60,
    AIRBORNE_MIN: 20,
    AIRBORNE_START: 58
  },
  HEALTH: {
    MAX: 200,
    REGEN_COVER: 12,
    RESUPPLY_THRESHOLD: 0.76,
    RETREAT_LOW_HEALTH: 0.26,
    RETREAT_DAMAGED_HEALTH: 0.38
  },
  SHIELD: {
    MAX: 200,
    REGEN_COVER: 25
  },
  COOLDOWNS: {
    DASH_MIN: 2.7,
    DASH_MAX: 4.1,
    DASH_HIT_MIN: 3.5,
    DASH_HIT_MAX: 5.0,
    MISSILE_MIN: 5.5,
    MISSILE_MAX: 8.5,
    WEAPON_SWAP_MIN: 2.4,
    WEAPON_SWAP_MAX: 3.6
  },
  SPEEDS: {
    BASE_GROUND: 10.5,
    BASE_AIR: 15.0,
    DASH: 26.0,
    SHELL_BASE: 48
  },
  DISTANCES: {
    RADAR: 135,
    ENGAGE_MAX: 80,
    ENGAGE_MIN: 12,
    DASH_TRIGGER: 34,
    DASH_CLOSE: 15,
    MISSILE_TRIGGER: 24
  },
  PATHFINDING: {
    GRID_SIZE: 4,
    ARENA_LIMIT: 78,
    REPLAN_INTERVAL: .65,
    TARGET_MOVE_THRESHOLD: 6,
    WAYPOINT_RADIUS: 2.2
  }
};

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _tempSelfPos = new THREE.Vector3();
const _tempTargetPos = new THREE.Vector3();
const _tempDir = new THREE.Vector3();
const _tempPrevPos = new THREE.Vector3();
const _tempSegment = new THREE.Vector3();

class EnemyAI {
  constructor({ scene, target, isBlocked, isProjectileBlocked, getBuildingTarget, getPickupTarget, getCoverPoint, canSeeTarget, getSpawnPosition, onPlayerHit, onStatus, onMessage, onDestroyed, isDamageImmune, weaponSlot1 = 'gatling', weaponSlot2 = 'cannon', getCTFTargetPos = null }) {
    this.scene = scene;
    this.target = target;
    this.isBlocked = isBlocked;
    this.isProjectileBlocked = isProjectileBlocked;
    this.getBuildingTarget = getBuildingTarget;
    this.getPickupTarget = getPickupTarget;
    this.getCoverPoint = getCoverPoint;
    this.canSeeTarget = canSeeTarget;
    this.getSpawnPosition = getSpawnPosition;
    this.getCTFTargetPos = getCTFTargetPos;
    this.onPlayerHit = onPlayerHit;
    this.onStatus = onStatus;
    this.onMessage = onMessage;
    this.isDamageImmune = isDamageImmune;
    this.onDestroyed = onDestroyed;
    this.weaponSlot1 = weaponSlot1;
    this.weaponSlot2 = weaponSlot2;
    this.nextWeaponSlot = 1;
    this.maxHealth = AI_CONFIG.HEALTH.MAX;
    this.health = AI_CONFIG.HEALTH.MAX;
    this.shield = 0;
    this.healthBarTimer = 0;
    this.alive = true;
    this.respawnTimer = 0;
    this.deathSequenceTimer = 0;
    this.deathPosition = new THREE.Vector3();
    this.fireCooldown = 1.2;
    this.shellSpeed = 33;
    this.powerLevel = 0;
    this.jetpackEquipped = false;
    this.jetpackReadyAt = Infinity;
    this.jetpackTimeRemaining = 0;
    this.energy = AI_CONFIG.ENERGY.MAX;
    this.seekCoverTimer = 0;
    this.retreatMode = false;
    this.targetMemory = 0;
    this.searchScanTimer = 0;
    this.activeWeapon = 'cannon';
    this.weaponSwapTimer = 0;
    this.time = 0;
    this.targetVelocity = new THREE.Vector3();
    this.lastTargetPosition = target.position.clone();
    this.lastKnownTargetPosition = target.position.clone();
    this.lastMoveDirection = new THREE.Vector3(0, 0, -1);
    this.shells = [];
    
    // AI Upgrade Variables
    this.state = 'PATROL';
    this.orbitDirection = Math.random() < 0.5 ? 1 : -1;
    this.orbitTimer = 0;
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.dashDirection = new THREE.Vector3();
    this.missileCooldown = 5.0; // Wait a bit after spawn before first missile barrage
    this.missileSalvoLeft = 0;
    this.missileSalvoTimer = 0;
    this.nextMissilePortIndex = 0;
    this.isAirborne = false;
    this.patrolPoint = null;
    this.missileTrails = [];
    this.missilePorts = [];
    this.thrusterFlames = [];
    this.thrusterLights = [];
    this.stateDecisionTimer = 0;
    this.retreatTimer = 0;
    this.resupplyTimer = 0;
    this.strafeBias = Math.random() * Math.PI * 2;
    this.stuckTimer = 0;
    this.lastPosCheck = new THREE.Vector3();
    this.progressAnchor = new THREE.Vector3();
    this.progressTimer = 0;
    this.progressStartDistance = Infinity;
    this.navigationPath = [];
    this.navigationPathIndex = 0;
    this.pathDestination = new THREE.Vector3();
    this.pathReplanTimer = 0;

    this.group = this.createModel();
    this.rigidBody = new MechaRigidBody(this.group, { mass: 22000, linearDamping: 5.2 });
    this.gaitPhase = 0;
    this.lastGaitPosition = this.group.position.clone();
    this.bodyBounceOffset = 0;
    this.bodyBounceVelocity = 0;
    this.gaitFeetAirborne = [false, false];
    this.scene.add(this.group);
    this.reset();
  }

  tryDash(direction = null, energyCost = 0) {
    if (this.dashCooldown > 0 || !this.alive) return false;
    if (energyCost > 0 && this.energy < energyCost) return false;
    if (direction && direction.lengthSq() > 0.001) {
      this.dashDirection.copy(direction).setY(0).normalize();
    } else {
      const toPlayer = _v1.copy(this.target.position).sub(this.group.position).setY(0);
      if (toPlayer.lengthSq() > 0.001) toPlayer.normalize();
      else toPlayer.set(0, 0, -1);
      this.dashDirection.set(-toPlayer.z, 0, toPlayer.x).normalize();
      if (Math.random() < 0.5) this.dashDirection.negate();
    }
    const clearDirection = this.findClearDirection(this.dashDirection, 5.5);
    if (!clearDirection) return false;
    this.dashDirection.copy(clearDirection);
    if (energyCost > 0) {
      this.energy = Math.max(0, this.energy - energyCost);
    }
    this.dashTimer = 0.28;
    this.dashCooldown = AI_CONFIG.COOLDOWNS.DASH_MIN + Math.random() * (AI_CONFIG.COOLDOWNS.DASH_MAX - AI_CONFIG.COOLDOWNS.DASH_MIN);
    return true;
  }

  findClearDirection(preferredDirection, clearance = 3.2) {
    const preferred = _v1.copy(preferredDirection).setY(0);
    if (preferred.lengthSq() < .001) preferred.set(0, 0, 1);
    preferred.normalize();
    const angles = [0, Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2, Math.PI * .75, -Math.PI * .75, Math.PI];
    for (const angle of angles) {
      const candidate = _v2.copy(preferred).applyAxisAngle(_v3.set(0, 1, 0), angle);
      let clear = true;
      for (const distance of [1.4, 2.8, clearance]) {
        const probe = _tempDir.copy(this.group.position).addScaledVector(candidate, distance);
        if (this.isBlocked?.(probe.x, probe.z, this.group.position.y, 2.05)) {
          clear = false;
          break;
        }
      }
      if (clear) return candidate.clone();
    }
    return null;
  }

  recoverFromEmbeddedPosition(preferredDirection = this.lastMoveDirection, force = false) {
    if (!force && !this.isBlocked?.(this.group.position.x, this.group.position.z, this.group.position.y, 2.05)) return false;
    const preferred = _v1.copy(preferredDirection).setY(0);
    if (preferred.lengthSq() < .001) preferred.set(0, 0, 1);
    preferred.normalize();
    const originX = this.group.position.x;
    const originZ = this.group.position.z;
    let bestPosition = null;
    let bestScore = -Infinity;

    for (let radius = 3; radius <= 30; radius += 3) {
      for (let index = 0; index < 24; index++) {
        const angle = index / 24 * Math.PI * 2;
        const direction = _v2.set(Math.sin(angle), 0, Math.cos(angle));
        const x = originX + direction.x * radius;
        const z = originZ + direction.z * radius;
        if (this.isBlocked?.(x, z, 0, 2.05)) continue;
        const forwardProbeX = x + preferred.x * 3.5;
        const forwardProbeZ = z + preferred.z * 3.5;
        const hasForwardExit = !this.isBlocked?.(forwardProbeX, forwardProbeZ, 0, 2.05);
        const score = direction.dot(preferred) * 2 + (hasForwardExit ? 1.5 : 0) - radius * .08;
        if (score > bestScore) {
          bestScore = score;
          bestPosition = new THREE.Vector3(x, 0, z);
        }
      }
      if (bestPosition) break;
    }
    if (!bestPosition) return false;

    this.group.position.copy(bestPosition);
    this.lastPosCheck.copy(bestPosition);
    this.lastMoveDirection.copy(bestPosition).sub(_v3.set(originX, 0, originZ)).normalize();
    this.dashTimer = 0;
    this.stuckTimer = 0;
    this.patrolPoint = null;
    this.progressAnchor.copy(bestPosition);
    this.progressTimer = 0;
    this.progressStartDistance = Infinity;
    this.navigationPath.length = 0;
    this.navigationPathIndex = 0;
    this.pathDestination.copy(this.group.position);
    this.pathReplanTimer = 0;
    this.rigidBody.stop();
    return true;
  }

  createModel() {
    const group = new THREE.Group();
    group.userData.unitClass = '8M ASSAULT PLATFORM';

    const armor = new THREE.MeshStandardMaterial({ color: 0x941423, roughness: .31, metalness: .8 });
    const armorLight = new THREE.MeshStandardMaterial({ color: 0xeb3445, roughness: .29, metalness: .72 });
    const glow = new THREE.MeshStandardMaterial({ color: 0xff2e43, emissive: 0xd60927, emissiveIntensity: 2.7, roughness: .16, metalness: .28 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x11151c, roughness: .27, metalness: .9 });
    const brass = new THREE.MeshStandardMaterial({ color: 0xe18a37, roughness: .32, metalness: .74 });
    const hydraulic = new THREE.MeshStandardMaterial({ color: 0xb0b6bc, roughness: .22, metalness: .92 });
    const portMat = new THREE.MeshStandardMaterial({ color: 0x080a0e, roughness: .4, metalness: .88 });

    const makeBox = (width, height, depth, material) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      return mesh;
    };
    const makeCylinder = (top, bottom, height, material, segments = 14) => {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(top, bottom, height, segments), material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      return mesh;
    };

    const pelvis = makeBox(3.72, 1.08, 2.62, dark);
    pelvis.position.set(0, 3.68, -.02);
    group.add(pelvis);
    const pelvisFrontGuard = makeBox(1.74, .86, .54, armorLight);
    pelvisFrontGuard.position.set(0, 3.18, 1.34);
    pelvisFrontGuard.rotation.x = -.12;
    group.add(pelvisFrontGuard);
    const pelvisCenterPlate = makeBox(.84, .62, .18, armor);
    pelvisCenterPlate.position.set(0, 3.13, 1.66);
    group.add(pelvisCenterPlate);

    const waist = makeCylinder(.7, .78, .26, dark, 20);
    waist.position.y = 4.26;
    group.add(waist);
    const waistCore = makeCylinder(.4, .48, .44, glow, 16);
    waistCore.position.y = 4.27;
    group.add(waistCore);

    for (const side of [-1, 1]) {
      const skirt = makeBox(1.18, 1.3, 1.76, armor);
      skirt.position.set(side * 1.76, 3.56, .02);
      skirt.rotation.z = side * -.08;
      group.add(skirt);
    }

    const torso = new THREE.Group();
    torso.position.y = 5.18;
    group.add(torso);
    this.torso = torso;

    const body = makeBox(6.34, 2.08, 3.48, armor);
    body.position.set(0, .18, -.18);
    torso.add(body);
    const lowerChest = makeBox(4.22, .76, 2.94, dark);
    lowerChest.position.set(0, -.74, -.22);
    torso.add(lowerChest);
    const front = makeBox(4.72, 1.12, .68, armorLight);
    front.position.set(0, .16, 1.64);
    front.rotation.x = -.12;
    torso.add(front);
    const sensorArmor = makeBox(2.12, 1.1, .72, dark);
    sensorArmor.position.set(0, .48, 1.84);
    sensorArmor.rotation.x = -.18;
    torso.add(sensorArmor);
    const sensorLens = makeBox(.94, .28, .1, glow);
    sensorLens.position.set(0, .52, 2.18);
    torso.add(sensorLens);
    const counterweight = makeBox(4.9, 1.8, .88, dark);
    counterweight.position.set(0, .18, -1.85);
    torso.add(counterweight);

    for (const side of [-1, 1]) {
      const shoulder = makeBox(1.42, 1.95, 3.12, armor);
      shoulder.position.set(side * 3.15, .18, -.06);
      torso.add(shoulder);
      const outer = makeBox(.88, 1.45, 3.22, armorLight);
      outer.position.set(side * 3.65, .18, -.04);
      outer.rotation.z = side * -.16;
      torso.add(outer);
      const stripe = makeBox(.2, 1.62, 3.32, brass);
      stripe.position.set(side * 3.75, .17, -.02);
      torso.add(stripe);
    }

    const headGroup = new THREE.Group();
    headGroup.position.set(0, 6.76, .02);
    group.add(headGroup);
    const turntable = makeCylinder(.58, .68, .36, dark, 18);
    headGroup.add(turntable);
    const sensorHead = makeBox(1.65, .88, 1.78, armorLight);
    sensorHead.position.set(0, .5, .18);
    headGroup.add(sensorHead);
    const visor = makeBox(.88, .24, .14, glow);
    visor.position.set(0, .54, 1.04);
    headGroup.add(visor);
    const scoutGun = makeCylinder(.14, .18, 2.05, dark, 12);
    scoutGun.rotation.x = Math.PI / 2;
    scoutGun.position.set(0, .56, 1.62);
    headGroup.add(scoutGun);

    this.legs = [];
    for (const side of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(side * 2.02, 3.62, 0);
      group.add(leg);
      this.legs.push(leg);

      const hip = makeCylinder(.78, .78, .98, dark, 18);
      hip.rotation.z = Math.PI / 2;
      leg.add(hip);
      const thigh = makeBox(1.54, 2.25, 1.63, armor);
      thigh.position.set(0, -1.0, .14);
      thigh.rotation.x = -.36;
      leg.add(thigh);
      const knee = makeBox(1.32, 1.15, 0.94, brass);
      knee.position.set(0, -1.85, 1.0);
      knee.rotation.x = .18;
      leg.add(knee);
      const shin = makeBox(1.3, 3.05, 1.42, armorLight);
      shin.position.set(0, -2.85, .13);
      shin.rotation.x = .56;
      leg.add(shin);
      const calf = makeBox(.82, 2.35, .65, dark);
      calf.position.set(0, -2.80, -.98);
      calf.rotation.x = -.18;
      leg.add(calf);
      for (const pistonX of [-.4, .4]) {
        const piston = makeCylinder(.11, .14, 1.58, hydraulic, 10);
        piston.position.set(pistonX, -2.65, -.62);
        piston.rotation.x = -.26;
        leg.add(piston);
      }
      const foot = makeBox(1.56, .53, 2.06, dark);
      foot.position.set(0, -3.85, .19);
      leg.add(foot);
      const toe = makeBox(.5, .36, 1.54, armorLight);
      toe.position.set(side * .28, -3.83, 1.18);
      leg.add(toe);
      leg.userData.basePosition = leg.position.clone();
      leg.userData.joints = { thigh, knee, shin, calf, foot, toe };
    }

    this.arms = [];
    this.weaponMuzzles = [];
    this.barrelGroups = [];
    for (const side of [-1, 1]) {
      const pod = new THREE.Group();
      pod.position.set(side * 3.15, 5.35, .12);
      group.add(pod);
      this.arms.push(pod);

      const joint = makeCylinder(.78, .78, .98, dark, 18);
      joint.rotation.z = Math.PI / 2;
      pod.add(joint);
      const housing = makeBox(1.85, 1.58, 2.62, armor);
      housing.position.z = .48;
      pod.add(housing);
      const face = makeBox(1.42, .98, .24, armorLight);
      face.position.set(0, .02, 1.78);
      pod.add(face);
      const bearing = makeCylinder(.62, .68, .72, dark, 18);
      bearing.rotation.x = Math.PI / 2;
      bearing.position.z = 1.92;
      pod.add(bearing);

      const barrels = new THREE.Group();
      barrels.position.z = 1.98;
      pod.add(barrels);
      this.barrelGroups.push(barrels);
      for (let index = 0; index < 6; index++) {
        const angle = index / 6 * Math.PI * 2;
        const barrel = makeCylinder(.09, .115, 3.65, dark, 9);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(Math.cos(angle) * .32, Math.sin(angle) * .32, 1.825);
        barrels.add(barrel);
      }
      const center = makeCylinder(.15, .2, 3.82, hydraulic, 12);
      center.rotation.x = Math.PI / 2;
      center.position.z = 1.85;
      barrels.add(center);
      const ring = makeCylinder(.48, .48, .28, brass, 20);
      ring.rotation.x = Math.PI / 2;
      ring.position.z = 3.62;
      barrels.add(ring);
      const muzzle = new THREE.Object3D();
      muzzle.position.z = 3.85;
      barrels.add(muzzle);
      this.weaponMuzzles.push(muzzle);
    }

    const missileRack = new THREE.Group();
    missileRack.position.set(1.42, 7.05, -.2);
    group.add(missileRack);
    const rackBody = makeBox(2.28, 1.12, 2.72, armor);
    missileRack.add(rackBody);
    const rackFace = makeBox(2.02, .92, .22, dark);
    rackFace.position.z = 1.45;
    missileRack.add(rackFace);
    this.missilePorts = [];
    for (let row = 0; row < 3; row++) {
      for (let column = 0; column < 4; column++) {
        const portPos = new THREE.Vector3((column - 1.5) * .43, (1 - row) * .3, 1.6);
        const port = makeCylinder(.13, .13, .23, portMat, 12);
        port.rotation.x = Math.PI / 2;
        port.position.copy(portPos);
        missileRack.add(port);
        this.missilePorts.push(portPos);
      }
    }
    this.missileRack = missileRack;

    const jetpack = new THREE.Group();
    const jetMat = new THREE.MeshStandardMaterial({ color: 0x302036, emissive: 0x250d31, emissiveIntensity: .65, metalness: .82, roughness: .27 });
    const pack = makeBox(2.9, 1.65, .78, jetMat);
    pack.position.set(0, 5.02, -1.74);
    jetpack.add(pack);
    for (const side of [-1, 1]) {
      const tank = makeCylinder(.42, .54, 2.2, jetMat, 14);
      tank.position.set(side * .88, 4.7, -1.93);
      jetpack.add(tank);
      const nozzle = makeCylinder(.5, .31, .58, dark, 14);
      nozzle.position.set(side * .88, 3.32, -1.93);
      jetpack.add(nozzle);
      
      // Upgrade: 3D Thruster Flame Cones for Jetpack Nozzles
      const flameMat = new THREE.MeshBasicMaterial({
        color: 0x57eaff,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        toneMapped: false
      });
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.46, 2.35, 10), flameMat);
      flame.rotation.x = Math.PI; // point down
      flame.position.set(side * .88, 2.2, -1.93); // position below nozzle
      flame.visible = false;
      jetpack.add(flame);
      this.thrusterFlames.push(flame);
      const thrusterLight = new THREE.PointLight(0x51dfff, 0, 10, 2);
      thrusterLight.position.set(side * .88, 2.9, -1.93);
      jetpack.add(thrusterLight);
      this.thrusterLights.push(thrusterLight);
    }
    jetpack.visible = false;
    group.add(jetpack);
    this.jetpack = jetpack;

    // Save ports local coords for sequential launch
    this.missilePorts = [];
    for (let row = 0; row < 3; row++) {
      for (let column = 0; column < 4; column++) {
        this.missilePorts.push(new THREE.Vector3((column - 1.5) * .43, (1 - row) * .3, 1.6));
      }
    }

    const upperPivot = new THREE.Group();
    upperPivot.position.y = 4.28;
    group.add(upperPivot);
    group.updateMatrixWorld(true);
    for (const upperPart of [torso, headGroup, ...this.arms, missileRack, jetpack]) {
      upperPivot.attach(upperPart);
    }
    this.upperPivot = upperPivot;
    this.upperPivotBaseY = upperPivot.position.y;
    this.headGroup = headGroup;
    this.cannonMount = this.arms[1];
    this.torsoBaseY = torso.position.y;
    this.nextMuzzleIndex = 0;
    this.lastFiredMuzzleIndex = 1;
    this.weaponSpin = 0;

    this.shieldBubble = window.createConformalEnergyShield(THREE, group, {
      color: 0xff365f,
      rimColor: 0xffd2dc,
      shellScale: 1.035,
      thickness: .052,
      waveAmplitude: .032
    });

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 48;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const bar = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: true, depthWrite: false }));
    bar.position.y = 9.35;
    bar.scale.set(7.1, 1.15, 1);
    bar.renderOrder = 110;
    bar.userData.canvas = canvas;
    bar.userData.texture = texture;
    bar.userData.basePositionX = 0;
    bar.userData.basePositionY = 9.35;
    bar.userData.baseScaleX = 7.1;
    bar.userData.baseScaleY = 1.15;
    bar.visible = false;
    group.add(bar);
    this.healthBar = bar;
    return group;
  }

  drawHealth() {
    const canvas = this.healthBar.userData.canvas;
    const ctx = canvas.getContext('2d');
    const ratio = Math.max(0, this.health / this.maxHealth);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(12, 5, 9, .9)';
    ctx.fillRect(2, 2, 252, 44);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`CPU  ${Math.ceil(this.health)}%`, 128, 18);
    ctx.fillStyle = 'rgba(255,255,255,.16)';
    ctx.fillRect(14, 26, 228, 12);
    ctx.fillStyle = '#ff405a';
    ctx.fillRect(14, 26, 228 * ratio, 12);
    this.healthBar.userData.texture.needsUpdate = true;
    this.onStatus?.(this.health);
  }

  reset() {
    this.spawnProtectedUntil = performance.now() + 10000;
    for (const shell of this.shells) this.scene.remove(shell);
    this.shells.length = 0;
    const spawn = this.getSpawnPosition?.() || new THREE.Vector3(-11, 0, 12);
    this.group.position.copy(spawn);
    this.group.visible = true;
    this.health = this.maxHealth;
    this.shield = 0;
    this.shieldBubble.reset();
    this.alive = true;
    this.respawnTimer = 0;
    this.deathSequenceTimer = 0;
    this.fireCooldown = 1.4;
    this.powerLevel = 0;
    this.shellSpeed = 33;
    this.jetpackEquipped = false;
    this.jetpackReadyAt = Infinity;
    this.jetpackTimeRemaining = 0;
    this.energy = AI_CONFIG.ENERGY.MAX;
    this.seekCoverTimer = 0;
    this.retreatMode = false;
    this.targetMemory = 0;
    this.searchScanTimer = 0;
    this.activeWeapon = 'cannon';
    this.weaponSwapTimer = 0;
    if (this.jetpack) this.jetpack.visible = false;
    this.targetVelocity.set(0, 0, 0);
    this.lastTargetPosition.copy(this.target.position);
    this.lastKnownTargetPosition.copy(this.target.position);
    this.lastMoveDirection.set(0, 0, -1);
    this.group.rotation.set(0, 0, 0);
    this.upperPivot?.rotation.set(0, 0, 0);
    this.healthBar.position.set(this.healthBar.userData.basePositionX, this.healthBar.userData.basePositionY, 0);
    this.healthBar.scale.set(this.healthBar.userData.baseScaleX, this.healthBar.userData.baseScaleY, 1);
    this.headGroup?.rotation.set(0, 0, 0);
    this.nextMuzzleIndex = 0;
    this.lastFiredMuzzleIndex = 1;
    this.weaponSpin = 0;
    for (const pod of this.arms || []) pod.rotation.set(0, 0, 0);
    for (const barrels of this.barrelGroups || []) barrels.rotation.z = 0;
    if (this.torso) this.torso.position.y = this.torsoBaseY;
    
    // Reset AI variables
    this.state = 'PATROL';
    this.orbitDirection = Math.random() < 0.5 ? 1 : -1;
    this.orbitTimer = 0;
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.dashDirection.set(0, 0, 0);
    this.missileCooldown = 5.0;
    this.missileSalvoLeft = 0;
    this.missileSalvoTimer = 0;
    this.nextMissilePortIndex = 0;
    this.isAirborne = false;
    this.patrolPoint = null;
    this.stateDecisionTimer = 0;
    this.retreatTimer = 0;
    this.resupplyTimer = 0;
    this.lastDamageTime = -Infinity;
    this.strafeBias = Math.random() * Math.PI * 2;
    this.stuckTimer = 0;
    this.lastPosCheck.copy(this.group.position);
    this.progressAnchor.copy(this.group.position);
    this.progressTimer = 0;
    this.progressStartDistance = Infinity;
    this.navigationPath.length = 0;
    this.navigationPathIndex = 0;
    this.pathDestination.copy(this.group.position);
    this.pathReplanTimer = 0;
    this.rigidBody.stop();
    this.gaitPhase = 0;
    this.lastGaitPosition.copy(this.group.position);
    this.bodyBounceOffset = 0;
    this.bodyBounceVelocity = 0;
    this.gaitFeetAirborne[0] = this.gaitFeetAirborne[1] = false;
    if (this.upperPivot) this.upperPivot.position.y = this.upperPivotBaseY;
    for (const leg of this.legs || []) {
      leg.position.copy(leg.userData.basePosition);
      leg.rotation.set(0, 0, 0);
    }

    if (this.missileTrails) {
      for (const trail of this.missileTrails) {
        this.scene.remove(trail);
        trail.geometry?.dispose();
        trail.material?.dispose();
      }
      this.missileTrails.length = 0;
    } else {
      this.missileTrails = [];
    }

    if (this.thrusterFlames) {
      for (const flame of this.thrusterFlames) flame.visible = false;
    }
    if (this.thrusterLights) {
      for (const light of this.thrusterLights) light.intensity = 0;
    }

    this.drawHealth();
    this.healthBarTimer = 0;
    this.healthBar.visible = false;
  }

  applyPowerUp() {
    this.powerLevel = Math.min(3, this.powerLevel + 1);
    this.shellSpeed = 33 + this.powerLevel * 5;
    this.onMessage?.(`CPU POWER UP! LEVEL ${this.powerLevel}`);
  }

  applyJetpack() {
    if (this.jetpackEquipped) return false;
    this.jetpackEquipped = true;
    this.jetpackReadyAt = performance.now() + 900;
    this.jetpackTimeRemaining = AI_CONFIG.ENERGY.JETPACK_DURATION;
    this.isAirborne = false;
    if (this.jetpack) this.jetpack.visible = true;
    this.onMessage?.('CPU JETPACK EQUIPPED!');
    return true;
  }

  applyHealth(amount = 40) {
    this.health = Math.min(this.maxHealth, this.health + amount);
    this.drawHealth();
    this.onMessage?.(`CPU HEALTH +${amount}`);
  }

  applyShield(amount = 60) {
    this.shield = Math.min(AI_CONFIG.SHIELD.MAX, this.shield + amount);
    this.shieldBubble.setStrength(this.shield / AI_CONFIG.SHIELD.MAX);
    this.shieldBubble.hit(this.group.position.clone().add(new THREE.Vector3(0, 4.25, 0)), .55);
    this.onMessage?.(`CPU SHIELD +${amount}`);
  }

  takeDamage(damage, impulse, impactPosition = null) {
    if (!this.alive) return false;
    if (performance.now() < (this.spawnProtectedUntil || 0) || this.isDamageImmune?.(this.group.position)) {
      this.onMessage?.('CPU SAFE ZONE // DAMAGE BLOCKED');
      return false;
    }
    let incomingDamage = damage;
    const absorbed = Math.min(this.shield, incomingDamage);
    this.shield -= absorbed;
    incomingDamage -= absorbed;
    if (absorbed > 0) {
      const shieldImpact = impactPosition || this.group.position.clone().add(new THREE.Vector3(0, 4.25, 0));
      this.shieldBubble.hit(shieldImpact, .4 + Math.min(1, absorbed / 24));
    }
    this.shieldBubble.setStrength(this.shield / AI_CONFIG.SHIELD.MAX);
    this.health = Math.max(0, this.health - incomingDamage);
    if (impulse?.lengthSq() > .001) {
      const hitImpulse = _v1.copy(impulse).setY(0).normalize()
        .multiplyScalar(this.rigidBody.mass * Math.min(2.2, .3 + damage * .04));
      this.rigidBody.applyImpulse(hitImpulse);
    }
    this.drawHealth();
    this.healthBarTimer = 3;
    this.healthBar.visible = true;
    this.healthBar.material.opacity = 1;
    this.seekCoverTimer = Math.max(this.seekCoverTimer, 3.5);
    this.lastDamageTime = this.time;
    // A wounded pilot should not keep trading shots forever. Break contact,
    // grab nearby salvage, then return once the short tactical reset expires.
    if (this.health / this.maxHealth < .76) {
      this.resupplyTimer = Math.max(this.resupplyTimer, 3.8 + Math.random() * 1.6);
    }
    
    // AI Upgrade: Evading/Boosting on Hit
    if (this.dashCooldown <= 0 && this.health > 0) {
      const dashDir = _v1.set(0, 0, 0);
      if (impulse.lengthSq() > 0.01) {
        dashDir.set(-impulse.z, 0, impulse.x).normalize();
      } else {
        const toPlayer = _v2.copy(this.target.position).sub(this.group.position).setY(0);
        if (toPlayer.lengthSq() > 0.001) toPlayer.normalize();
        dashDir.set(-toPlayer.z, 0, toPlayer.x).normalize();
      }
      if (Math.random() < 0.5) dashDir.negate();
      if (this.tryDash(dashDir, 0)) {
        this.dashCooldown = AI_CONFIG.COOLDOWNS.DASH_HIT_MIN + Math.random() * (AI_CONFIG.COOLDOWNS.DASH_HIT_MAX - AI_CONFIG.COOLDOWNS.DASH_HIT_MIN);
        this.onMessage?.('CPU: EVADING!');
      }
    }

    if (this.health <= 0) {
      this.alive = false;
      this.deathPosition.copy(this.group.position);
      this.deathSequenceTimer = .72;
      this.respawnTimer = 5.72;
      this.fireCooldown = Number.POSITIVE_INFINITY;
      
      // Clean up active missile trails
      if (this.missileTrails) {
        for (const trail of this.missileTrails) {
          this.scene.remove(trail);
          trail.geometry?.dispose();
          trail.material?.dispose();
        }
        this.missileTrails.length = 0;
      }

    }
    return true;
  }

  checkPlayerShellHit(position, damage, impulse, prevPosition = null) {
    if (!this.alive) return false;
    const center = _v1.copy(this.group.position).add(_v2.set(0, 4.2, 0));
    
    // 1. Direct sphere hit check (radius 4.0m)
    if (position.distanceToSquared(center) <= 16.0) {
      return this.takeDamage(damage, impulse, position);
    }
    
    // 2. Swept segment hit check between prevPosition and position to catch fast projectiles
    if (prevPosition) {
      const seg = _v2.copy(position).sub(prevPosition);
      const segLenSq = seg.lengthSq();
      if (segLenSq > 0.001) {
        const t = THREE.MathUtils.clamp(_v3.copy(center).sub(prevPosition).dot(seg) / segLenSq, 0, 1);
        const closestPointOnSeg = _v3.copy(prevPosition).addScaledVector(seg, t);
        if (closestPointOnSeg.distanceToSquared(center) <= 16.0) {
          return this.takeDamage(damage, impulse, closestPointOnSeg);
        }
      }
    }
    return false;
  }

  fireHomingMissile() {
    if (!this.alive || !this.missileRack) return;
    this.group.updateWorldMatrix(true, true);
    
    const ports = (this.missilePorts && this.missilePorts.length > 0)
      ? this.missilePorts
      : [new THREE.Vector3(0, 0, 1.6)];
    const portIndex = this.nextMissilePortIndex % ports.length;
    const portLocal = ports[portIndex];
    this.nextMissilePortIndex = (this.nextMissilePortIndex + 1) % ports.length;
    const origin = this.missileRack.localToWorld(_v1.copy(portLocal));
    
    const stats = WEAPONS.get('homing', this.powerLevel);
    // CPU and player missiles deliberately share size, color and combat values.
    const missile = new THREE.Mesh(
      new THREE.SphereGeometry(stats.radius, 10, 8),
      new THREE.MeshStandardMaterial({ color: stats.color, emissive: stats.emissive, emissiveIntensity: 2.2 })
    );
    missile.position.copy(origin);
    
    // Fan out from the rack first, then converge on the live player position.
    const targetCenter = _v2.copy(this.target.position).add(_v3.set(0, 2.5, 0));
    const launchDir = _tempDir.copy(targetCenter).sub(origin);
    if (launchDir.lengthSq() > 0.001) launchDir.normalize(); else launchDir.set(0, 0, -1);
    const column = portIndex % 4;
    const row = Math.floor(portIndex / 4);
    const side = (column - 1.5) * 0.22;
    const lift = 0.08 + (1 - row) * 0.18;
    const launchRight = _v3.set(launchDir.z, 0, -launchDir.x);
    if (launchRight.lengthSq() > 0.001) launchRight.normalize();
    launchDir.addScaledVector(launchRight, side);
    launchDir.y += lift;
    launchDir.normalize();
    
    const launchSpeed = stats.speed * 0.42;
    const velocity = launchDir.multiplyScalar(launchSpeed).clone();
    
    missile.userData.velocity = velocity;
    missile.userData.speed = stats.speed;
    missile.userData.gravity = stats.gravity;
    missile.userData.origin = origin.clone();
    missile.userData.maxRange = stats.range;
    missile.userData.damage = stats.damage;
    missile.userData.splashRadius = stats.splashRadius;
    missile.userData.splashMultiplier = stats.splashMultiplier;
    missile.userData.life = stats.range / stats.speed + 1.35;
    missile.userData.homing = true;
    missile.userData.homingLaunchDelay = 1.0;
    missile.userData.trailTimer = 0;
    
    this.scene.add(missile);
    this.shells.push(missile);
  }

  spawnMissileTrail(position) {
    const trail = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 6, 5),
      new THREE.MeshBasicMaterial({
        color: 0xff3b5c,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    trail.position.copy(position);
    trail.userData.life = 0.42;
    this.scene.add(trail);
    this.missileTrails.push(trail);
  }

  updateMissileTrails(dt) {
    if (!this.missileTrails) return;
    for (let i = this.missileTrails.length - 1; i >= 0; i--) {
      const trail = this.missileTrails[i];
      trail.userData.life -= dt;
      const ratio = Math.max(0, trail.userData.life / 0.42);
      trail.material.opacity = ratio * 0.8;
      trail.scale.setScalar(0.5 + (1 - ratio) * 1.6);
      if (trail.userData.life <= 0) {
        this.scene.remove(trail);
        trail.geometry?.dispose();
        trail.material?.dispose();
        this.missileTrails.splice(i, 1);
      }
    }
  }

  fire(targetPoint = null, trackPlayer = false, weaponType = null) {
    if (!this.alive) return;
    const currentWeapon = weaponType || (this.nextWeaponSlot === 1 ? this.weaponSlot1 : this.weaponSlot2);
    this.nextWeaponSlot = this.nextWeaponSlot === 1 ? 2 : 1;

    if (currentWeapon === 'laser') {
      this.fireLaser(targetPoint);
      return;
    }
    if (currentWeapon === 'homing') {
      this.fireHomingMissile();
      return;
    }

    const gatlingShot = currentWeapon === 'gatling';
    const stats = WEAPONS.get(currentWeapon, this.powerLevel);
    const requiredEnergy = gatlingShot ? AI_CONFIG.ENERGY.GATLING : AI_CONFIG.ENERGY.CANNON;
    if (this.energy < requiredEnergy) return;
    const resolvedTarget = targetPoint
      ? targetPoint.clone()
      : this.target.position.clone().add(new THREE.Vector3(0, 3.5, 0));
    this.group.updateWorldMatrix(true, true);
    const muzzle = this.weaponMuzzles?.[this.nextMuzzleIndex];
    const origin = muzzle
      ? muzzle.getWorldPosition(_v1)
      : _v1.copy(this.group.position).add(_v2.set(0, 5.35, 0));
    this.lastFiredMuzzleIndex = this.nextMuzzleIndex;
    this.nextMuzzleIndex = (this.nextMuzzleIndex + 1) % Math.max(1, this.weaponMuzzles?.length || 1);
    this.weaponSpin = 1;
    const delta = _v3.copy(resolvedTarget).sub(origin);
    const speed = stats.speed;
    const direction = delta.normalize();
    const velocity = direction.clone().multiplyScalar(speed);

    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(stats.radius, 10, 8),
      new THREE.MeshStandardMaterial({ color: stats.color, emissive: stats.emissive, emissiveIntensity: 1.7 })
    );
    shell.position.copy(origin).addScaledVector(direction, .35);
    shell.userData.origin = origin.clone();
    shell.userData.velocity = velocity;
    shell.userData.speed = stats.speed;
    shell.userData.gravity = stats.gravity;
    shell.userData.maxRange = stats.range;
    shell.userData.damage = stats.damage;
    shell.userData.splashRadius = stats.splashRadius;
    shell.userData.splashMultiplier = stats.splashMultiplier;
    shell.userData.life = stats.range / stats.speed + 0.1;
    shell.userData.trackPlayer = false;
    this.scene.add(shell);
    this.shells.push(shell);
    this.energy = Math.max(0, this.energy - requiredEnergy);
  }

  fireLaser(targetPoint = null) {
    if (!this.alive || this.energy < 12) return;
    const resolvedTarget = targetPoint
      ? targetPoint.clone()
      : this.target.position.clone().add(new THREE.Vector3(0, 3.5, 0));
    this.group.updateWorldMatrix(true, true);
    const muzzle = this.weaponMuzzles?.[this.nextMuzzleIndex];
    const origin = muzzle
      ? muzzle.getWorldPosition(_v1)
      : _v1.copy(this.group.position).add(_v2.set(0, 5.35, 0));
    this.lastFiredMuzzleIndex = this.nextMuzzleIndex;
    this.nextMuzzleIndex = (this.nextMuzzleIndex + 1) % Math.max(1, this.weaponMuzzles?.length || 1);
    this.weaponSpin = 1.5;

    const stats = WEAPONS.get('laser', this.powerLevel);
    const dir = _v3.copy(resolvedTarget).sub(origin);
    const dist = Math.min(stats.range, Math.max(1, dir.length()));
    dir.normalize();

    // Laser Beam visual mesh (cyan/blue glowing cylinder)
    const beamGeo = new THREE.CylinderGeometry(stats.radius, stats.radius, dist, 8);
    const beamMat = new THREE.MeshBasicMaterial({
      color: stats.color,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    
    // Position at midpoint and orient along ray direction
    const midpoint = _v2.copy(origin).addScaledVector(dir, dist * 0.5);
    beam.position.copy(midpoint);
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    this.scene.add(beam);

    // Laser hit registration against player torso
    const playerCenter = _v2.copy(this.target.position).add(_v3.set(0, 3.8, 0));
    const vecToPlayer = _v3.copy(playerCenter).sub(origin);
    const proj = vecToPlayer.dot(dir);
    if (proj > 0 && proj <= dist) {
      const closestPt = _v2.copy(origin).addScaledVector(dir, proj);
      if (closestPt.distanceToSquared(playerCenter) <= 16.0) {
        this.onPlayerHit?.(stats.damage, closestPt);
      }
    }

    this.energy = Math.max(0, this.energy - 12);

    // Fade out and remove beam
    let opacityTimer = 0.16;
    const fade = () => {
      opacityTimer -= 0.016;
      beamMat.opacity = Math.max(0, opacityTimer / 0.16);
      if (opacityTimer <= 0) {
        this.scene.remove(beam);
        beamGeo.dispose();
        beamMat.dispose();
      } else {
        requestAnimationFrame(fade);
      }
    };
    requestAnimationFrame(fade);
  }

  updateShells(dt) {
    const targetPoint = _tempTargetPos.copy(this.lastKnownTargetPosition).add(_v1.set(0, 4.65, 0));
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const shell = this.shells[i];
      shell.userData.life -= dt;
      _tempPrevPos.copy(shell.position);
      
      if (shell.userData.homing) {
        shell.userData.homingLaunchDelay = Math.max(0, (shell.userData.homingLaunchDelay || 0) - dt);
        if (shell.userData.homingLaunchDelay <= 0) {
          // Reacquire the player's live torso position after the visible fan-out.
          const targetPos = _v1.copy(this.target.position).add(_v2.set(0, 3.2, 0));
          const desiredDir = _v3.copy(targetPos).sub(shell.position);
          const distToTarget = desiredDir.length();
          if (distToTarget > 0.1) {
            desiredDir.normalize();
            const currentDir = _v2.copy(shell.userData.velocity).normalize();
            const turnRate = 1 - Math.pow(0.00018, dt);
            currentDir.lerp(desiredDir, turnRate);
            if (currentDir.lengthSq() > 0.001) currentDir.normalize();
            shell.userData.velocity.copy(currentDir).multiplyScalar(shell.userData.speed);
          }
        }
        
        // Spawn colored smoke trail
        shell.userData.trailTimer = (shell.userData.trailTimer || 0) - dt;
        if (shell.userData.trailTimer <= 0) {
          this.spawnMissileTrail(shell.position);
          shell.userData.trailTimer = 0.035;
        }
        
        shell.userData.velocity.y -= shell.userData.gravity * dt;
      } else {
        // Standard shell physics
        if (shell.userData.trackPlayer) {
          const desiredHorizontal = _v1.copy(targetPoint).sub(shell.position);
          desiredHorizontal.y = 0;
          const horizontalSpeed = Math.hypot(shell.userData.velocity.x, shell.userData.velocity.z);
          if (desiredHorizontal.lengthSq() > .01 && horizontalSpeed > 0) {
            desiredHorizontal.setLength(horizontalSpeed);
            const correction = 1 - Math.pow(.18, dt);
            shell.userData.velocity.x = THREE.MathUtils.lerp(shell.userData.velocity.x, desiredHorizontal.x, correction);
            shell.userData.velocity.z = THREE.MathUtils.lerp(shell.userData.velocity.z, desiredHorizontal.z, correction);
          }
        }
        shell.userData.velocity.y -= shell.userData.gravity * dt;
      }

      shell.position.addScaledVector(shell.userData.velocity, dt);
      if (shell.userData.origin && shell.position.distanceTo(shell.userData.origin) >= shell.userData.maxRange) {
        shell.userData.life = 0;
      }
      const segment = _tempSegment.copy(shell.position).sub(_tempPrevPos);
      const segmentLengthSq = segment.lengthSq();
      
      const playerCenter = _v1.copy(this.target.position).add(_v2.set(0, 3.8, 0));
      const hitRadiusSq = 14.5; // 3.8m radius around player torso

      let hitT = 0;
      if (segmentLengthSq > 0.001) {
        hitT = THREE.MathUtils.clamp(_v2.copy(playerCenter).sub(_tempPrevPos).dot(segment) / segmentLengthSq, 0, 1);
      }
      const closestPointOnSeg = _v2.copy(_tempPrevPos).addScaledVector(segment, hitT);
      
      let playerHit = false;
      if (closestPointOnSeg.distanceToSquared(playerCenter) <= hitRadiusSq) {
        playerHit = true;
      } else if (shell.position.distanceToSquared(playerCenter) <= hitRadiusSq) {
        playerHit = true;
      }

      const shellOrigin = shell.userData.origin || _v3.copy(this.group.position).add(_v2.set(0, 5.35, 0));
      const originDistSq = shell.position.distanceToSquared(shellOrigin);
      const canHitEnv = originDistSq > 3.0; // Must travel away from muzzle before hitting env

      if (playerHit && shell.userData.life > 0) {
        this.onPlayerHit?.(shell.userData.damage, closestPointOnSeg);
        this.applyShellExplosion(shell, closestPointOnSeg);
        shell.userData.life = 0;
      } else if (canHitEnv && this.isProjectileBlocked?.(shell.position, shell.userData.velocity)) {
        this.applyShellExplosion(shell, shell.position);
        shell.userData.life = 0;
      }
      
      if (shell.position.y <= .2 && shell.userData.life > 0) {
        this.applyShellExplosion(shell, shell.position);
        shell.userData.life = 0;
      }
      if (shell.userData.life <= 0) {
        this.scene.remove(shell);
        this.shells[i] = this.shells[this.shells.length - 1];
        this.shells.pop();
      }
    }
  }

  applyShellExplosion(shell, position) {
    const radius = shell.userData.splashRadius || 0;
    if (shell.userData.exploded || radius <= 0) return;
    shell.userData.exploded = true;
    const targetCenter = _v1.copy(this.target.position).add(_v2.set(0, 3.5, 0));
    const distance = targetCenter.distanceTo(position);
    if (distance > radius) return;
    const falloff = 1 - distance / radius;
    const damage = shell.userData.damage * (shell.userData.splashMultiplier || .6) * Math.max(.18, falloff);
    this.onPlayerHit?.(damage, position);
  }

  isNavigationLineClear(from, to) {
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const distance = Math.hypot(dx, dz);
    if (distance < .1) return true;
    const steps = Math.ceil(distance / 1.6);
    for (let step = 1; step <= steps; step++) {
      const ratio = step / steps;
      const x = from.x + dx * ratio;
      const z = from.z + dz * ratio;
      if (this.isBlocked?.(x, z, 0, 2.05)) return false;
    }
    return true;
  }

  buildNavigationPath(destination) {
    const gridSize = AI_CONFIG.PATHFINDING.GRID_SIZE;
    const limit = AI_CONFIG.PATHFINDING.ARENA_LIMIT;
    const width = Math.floor(limit * 2 / gridSize) + 1;
    const nodeCount = width * width;
    const toId = (xIndex, zIndex) => zIndex * width + xIndex;
    const toWorld = (index) => -limit + index * gridSize;
    const clampIndex = value => THREE.MathUtils.clamp(Math.round((value + limit) / gridSize), 0, width - 1);
    const blockedCache = new Int8Array(nodeCount);
    blockedCache.fill(-1);
    const isGridBlocked = (xIndex, zIndex) => {
      if (xIndex < 0 || zIndex < 0 || xIndex >= width || zIndex >= width) return true;
      const id = toId(xIndex, zIndex);
      if (blockedCache[id] < 0) {
        blockedCache[id] = this.isBlocked?.(toWorld(xIndex), toWorld(zIndex), 0, 2.05) ? 1 : 0;
      }
      return blockedCache[id] === 1;
    };
    const nearestOpenNode = position => {
      const centerX = clampIndex(position.x);
      const centerZ = clampIndex(position.z);
      for (let ring = 0; ring <= 5; ring++) {
        let best = null;
        let bestDistanceSq = Infinity;
        for (let dz = -ring; dz <= ring; dz++) {
          for (let dx = -ring; dx <= ring; dx++) {
            if (ring > 0 && Math.abs(dx) !== ring && Math.abs(dz) !== ring) continue;
            const xIndex = centerX + dx;
            const zIndex = centerZ + dz;
            if (isGridBlocked(xIndex, zIndex)) continue;
            const worldX = toWorld(xIndex);
            const worldZ = toWorld(zIndex);
            const distanceSq = (worldX - position.x) ** 2 + (worldZ - position.z) ** 2;
            if (distanceSq < bestDistanceSq) {
              bestDistanceSq = distanceSq;
              best = { xIndex, zIndex, id: toId(xIndex, zIndex) };
            }
          }
        }
        if (best) return best;
      }
      return null;
    };

    const start = nearestOpenNode(this.group.position);
    const goal = nearestOpenNode(destination);
    if (!start || !goal) return [];
    if (start.id === goal.id) return [new THREE.Vector3(toWorld(goal.xIndex), 0, toWorld(goal.zIndex))];

    const scores = new Float64Array(nodeCount);
    scores.fill(Infinity);
    const cameFrom = new Int32Array(nodeCount);
    cameFrom.fill(-1);
    const closed = new Uint8Array(nodeCount);
    const heap = [];
    const pushHeap = entry => {
      heap.push(entry);
      let index = heap.length - 1;
      while (index > 0) {
        const parent = (index - 1) >> 1;
        if (heap[parent].priority <= entry.priority) break;
        heap[index] = heap[parent];
        index = parent;
      }
      heap[index] = entry;
    };
    const popHeap = () => {
      const root = heap[0];
      const tail = heap.pop();
      if (heap.length && tail) {
        let index = 0;
        while (true) {
          const left = index * 2 + 1;
          if (left >= heap.length) break;
          const right = left + 1;
          const child = right < heap.length && heap[right].priority < heap[left].priority ? right : left;
          if (heap[child].priority >= tail.priority) break;
          heap[index] = heap[child];
          index = child;
        }
        heap[index] = tail;
      }
      return root;
    };
    const heuristic = (xIndex, zIndex) => {
      const dx = Math.abs(goal.xIndex - xIndex);
      const dz = Math.abs(goal.zIndex - zIndex);
      return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz);
    };

    scores[start.id] = 0;
    pushHeap({ id: start.id, xIndex: start.xIndex, zIndex: start.zIndex, priority: heuristic(start.xIndex, start.zIndex) });
    const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    let found = false;
    while (heap.length) {
      const current = popHeap();
      if (closed[current.id]) continue;
      closed[current.id] = 1;
      if (current.id === goal.id) {
        found = true;
        break;
      }
      for (const [dx, dz] of neighbors) {
        const nextX = current.xIndex + dx;
        const nextZ = current.zIndex + dz;
        if (isGridBlocked(nextX, nextZ)) continue;
        if (dx !== 0 && dz !== 0 &&
            (isGridBlocked(current.xIndex + dx, current.zIndex) ||
             isGridBlocked(current.xIndex, current.zIndex + dz))) continue;
        const nextId = toId(nextX, nextZ);
        if (closed[nextId]) continue;
        const tentativeScore = scores[current.id] + (dx !== 0 && dz !== 0 ? Math.SQRT2 : 1);
        if (tentativeScore >= scores[nextId]) continue;
        scores[nextId] = tentativeScore;
        cameFrom[nextId] = current.id;
        pushHeap({
          id: nextId,
          xIndex: nextX,
          zIndex: nextZ,
          priority: tentativeScore + heuristic(nextX, nextZ)
        });
      }
    }
    if (!found) return [];

    const reversedPath = [];
    let currentId = goal.id;
    while (currentId !== start.id && currentId >= 0) {
      const xIndex = currentId % width;
      const zIndex = Math.floor(currentId / width);
      reversedPath.push(new THREE.Vector3(toWorld(xIndex), 0, toWorld(zIndex)));
      currentId = cameFrom[currentId];
    }
    reversedPath.reverse();

    // String-pull across visible nodes so the walker follows natural broad
    // turns instead of visibly stepping through every grid cell.
    const smoothedPath = [];
    let anchor = this.group.position;
    let index = 0;
    while (index < reversedPath.length) {
      let furthest = index;
      for (let candidate = reversedPath.length - 1; candidate > index; candidate--) {
        if (this.isNavigationLineClear(anchor, reversedPath[candidate])) {
          furthest = candidate;
          break;
        }
      }
      smoothedPath.push(reversedPath[furthest]);
      anchor = reversedPath[furthest];
      index = furthest + 1;
    }
    return smoothedPath;
  }

  resolveNavigationTarget(destination, dt) {
    this.pathReplanTimer = Math.max(0, this.pathReplanTimer - dt);
    if (this.isNavigationLineClear(this.group.position, destination)) {
      this.navigationPath.length = 0;
      this.navigationPathIndex = 0;
      this.pathDestination.copy(destination);
      return destination;
    }

    const destinationMoved = this.pathDestination.distanceToSquared(destination) >
      AI_CONFIG.PATHFINDING.TARGET_MOVE_THRESHOLD ** 2;
    const pathFinished = this.navigationPathIndex >= this.navigationPath.length;
    const currentWaypoint = this.navigationPath[this.navigationPathIndex];
    const pathBlocked = currentWaypoint && !this.isNavigationLineClear(this.group.position, currentWaypoint);
    if (this.pathReplanTimer <= 0 && (destinationMoved || pathFinished || pathBlocked || !this.navigationPath.length)) {
      this.navigationPath = this.buildNavigationPath(destination);
      this.navigationPathIndex = 0;
      this.pathDestination.copy(destination);
      this.pathReplanTimer = AI_CONFIG.PATHFINDING.REPLAN_INTERVAL + Math.random() * .18;
    }

    while (this.navigationPathIndex < this.navigationPath.length - 1) {
      const waypoint = this.navigationPath[this.navigationPathIndex];
      if (this.group.position.distanceToSquared(waypoint) >
          AI_CONFIG.PATHFINDING.WAYPOINT_RADIUS ** 2) break;
      this.navigationPathIndex++;
    }
    while (this.navigationPathIndex < this.navigationPath.length - 1 &&
           this.isNavigationLineClear(this.group.position, this.navigationPath[this.navigationPathIndex + 1])) {
      this.navigationPathIndex++;
    }
    return this.navigationPath[this.navigationPathIndex] || destination;
  }

  chooseMoveDirection(desired) {
    if (desired.lengthSq() < .001) return _v1.set(0, 0, 0);
    desired.normalize();
    const angles = [0, Math.PI / 6, -Math.PI / 6, Math.PI / 3, -Math.PI / 3, Math.PI / 2, -Math.PI / 2, Math.PI];
    let best = null;
    let bestScore = -Infinity;
    for (const angle of angles) {
      const candidate = desired.clone().applyAxisAngle(_v3.set(0, 1, 0), angle);
      let pathClear = true;
      for (const distance of [1.2, 2.5]) {
        const probe = _tempDir.copy(this.group.position).addScaledVector(candidate, distance);
        if (this.isBlocked?.(probe.x, probe.z, this.group.position.y, 2.05)) {
          pathClear = false;
          break;
        }
      }
      if (!pathClear) continue;
      const directionScore = candidate.dot(desired) * 4;
      const continuityScore = candidate.dot(this.lastMoveDirection) * 1.2;
      const sidePreference = Math.sin(this.time * .7) * Math.sign(angle) * .12;
      const score = directionScore + continuityScore + sidePreference;
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }
    return best || desired.clone().applyAxisAngle(_v3.set(0, 1, 0), Math.sin(this.time) > 0 ? Math.PI / 2 : -Math.PI / 2);
  }

  update(dt) {
    const spawnProtected = performance.now() < (this.spawnProtectedUntil || 0);
    if (spawnProtected) {
      this.shieldBubble.uniforms.uColor.value.setHex(0xffc928);
      this.shieldBubble.uniforms.uRimColor.value.setHex(0xfff7ae);
    } else {
      this.shieldBubble.uniforms.uColor.value.setHex(0xff365f);
      this.shieldBubble.uniforms.uRimColor.value.setHex(0xffd2dc);
    }
    this.shieldBubble.update(dt, spawnProtected ? 1 : this.shield / AI_CONFIG.SHIELD.MAX);
    this.updateShells(dt);
    this.updateMissileTrails(dt);

    if (this.healthBarTimer > 0) {
      this.healthBarTimer = Math.max(0, this.healthBarTimer - dt);
      this.healthBar.material.opacity = THREE.MathUtils.clamp(this.healthBarTimer * 2, 0, 1);
      if (this.healthBarTimer <= 0) this.healthBar.visible = false;
    }
    if (!this.alive) {
      this.respawnTimer -= dt;
      if (this.deathSequenceTimer > 0) {
        this.deathSequenceTimer = Math.max(0, this.deathSequenceTimer - dt);
        const progress = 1 - this.deathSequenceTimer / .72;
        const wobble = Math.sin(progress * 44) * (.06 + progress * .32);
        this.group.rotation.z = wobble;
        this.group.rotation.x = -wobble * .42;
        this.upperPivot?.rotation.set(Math.sin(progress * 32) * .14, 0, -wobble * .35);
        const barWobble = Math.sin(progress * 59) * (.12 + progress * .34);
        this.healthBar.position.x = this.healthBar.userData.basePositionX + barWobble;
        this.healthBar.position.y = this.healthBar.userData.basePositionY + Math.abs(barWobble) * .38;
        this.healthBar.scale.set(
          this.healthBar.userData.baseScaleX * (1 + Math.abs(barWobble) * .16),
          this.healthBar.userData.baseScaleY * (1 - Math.abs(barWobble) * .1),
          1
        );
        if (this.deathSequenceTimer <= 0) {
          this.group.visible = false;
          this.group.rotation.set(0, 0, 0);
          this.upperPivot?.rotation.set(0, 0, 0);
          this.healthBar.position.set(this.healthBar.userData.basePositionX, this.healthBar.userData.basePositionY, 0);
          this.healthBar.scale.set(this.healthBar.userData.baseScaleX, this.healthBar.userData.baseScaleY, 1);
          this.onDestroyed?.(this.deathPosition.clone());
          this.onMessage?.('CPU DESTROYED! +500');
        }
      }
      if (this.respawnTimer <= 0) {
        this.reset();
        this.onMessage?.('CPU RESPAWN');
      }
      return;
    }

    this.time += dt;
    _tempTargetPos.copy(this.target.position);
    const recoveryDirection = _v1.copy(_tempTargetPos).sub(this.group.position).setY(0);
    this.recoverFromEmbeddedPosition(recoveryDirection);
    _tempSelfPos.copy(this.group.position);

    this.seekCoverTimer = Math.max(0, this.seekCoverTimer - dt);
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.missileCooldown = Math.max(0, this.missileCooldown - dt);
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    this.weaponSwapTimer = Math.max(0, this.weaponSwapTimer - dt);
    this.stateDecisionTimer = Math.max(0, this.stateDecisionTimer - dt);
    this.retreatTimer = Math.max(0, this.retreatTimer - dt);
    this.resupplyTimer = Math.max(0, this.resupplyTimer - dt);

    // Visual line-of-sight is still required for firing, but a long-range
    // combat sensor keeps the AI pursuing a walker that is far away or briefly
    // hidden behind city geometry.
    const targetVisible = this.canSeeTarget?.(_tempSelfPos, _tempTargetPos) ?? true;
    const directTargetDistance = _v1.copy(_tempTargetPos).sub(_tempSelfPos).setY(0).length();
    const radarContact = directTargetDistance < AI_CONFIG.DISTANCES.RADAR;
    const targetDetected = targetVisible || radarContact;
    if (targetVisible) {
      const observedVelocity = _v1.copy(_tempTargetPos).sub(this.lastTargetPosition).multiplyScalar(1 / Math.max(dt, .001));
      if (observedVelocity.length() > 12) observedVelocity.setLength(12);
      this.targetVelocity.lerp(observedVelocity, 1 - Math.pow(.02, dt));
      this.lastTargetPosition.copy(_tempTargetPos);
      this.lastKnownTargetPosition.copy(_tempTargetPos);
      this.targetMemory = 7.5;
    } else if (radarContact) {
      // A distant signal supplies only a rough bearing. The CPU periodically
      // searches an imprecise sector; it never receives the exact player point
      // until it establishes line-of-sight again.
      this.searchScanTimer = Math.max(0, this.searchScanTimer - dt);
      if (this.searchScanTimer <= 0) {
        const bearing = _v1.copy(_tempTargetPos).sub(_tempSelfPos).setY(0);
        if (bearing.lengthSq() > .01) {
          bearing.normalize();
          const estimatedDistance = THREE.MathUtils.clamp(directTargetDistance + THREE.MathUtils.randFloat(-18, 18), 16, AI_CONFIG.DISTANCES.RADAR);
          const side = _v2.set(-bearing.z, 0, bearing.x).multiplyScalar(THREE.MathUtils.randFloat(-16, 16));
          this.lastKnownTargetPosition.copy(_tempSelfPos).addScaledVector(bearing, estimatedDistance).add(side);
        }
        this.searchScanTimer = 1.4 + Math.random() * 1.1;
      }
      this.targetVelocity.multiplyScalar(Math.pow(.3, dt));
      this.targetMemory = Math.max(this.targetMemory, 5.5);
    } else {
      this.targetMemory = Math.max(0, this.targetMemory - dt);
      this.targetVelocity.multiplyScalar(Math.pow(.12, dt));
    }
    const uncertainty = targetVisible ? .45 : radarContact ? 8.5 : Math.min(18, (7.5 - this.targetMemory) * 3.2);
    const perceivedTarget = this.lastKnownTargetPosition.clone().add(new THREE.Vector3(
      Math.sin(this.time * .71) * uncertainty,
      0,
      Math.cos(this.time * .53) * uncertainty
    ));
    const predictedTarget = perceivedTarget.clone().addScaledVector(this.targetVelocity, this.targetMemory > 0 ? .65 : 0);
    const distanceToPlayer = _v2.copy(predictedTarget).sub(_tempSelfPos).setY(0).length();
    const laserEquipped = this.weaponSlot1 === 'laser' || this.weaponSlot2 === 'laser';
    const laserWindow = laserEquipped && Math.floor(this.time / 3.2) % 2 === 0;
    const desiredWeapon = distanceToPlayer < 18
      ? 'gatling'
      : distanceToPlayer < 38
        ? (laserWindow ? 'laser' : 'cannon')
        : 'homing';
    if (this.weaponSwapTimer <= 0 && desiredWeapon !== this.activeWeapon) {
      this.activeWeapon = desiredWeapon;
      this.weaponSwapTimer = AI_CONFIG.COOLDOWNS.WEAPON_SWAP_MIN + Math.random() * (AI_CONFIG.COOLDOWNS.WEAPON_SWAP_MAX - AI_CONFIG.COOLDOWNS.WEAPON_SWAP_MIN);
      this.onMessage?.(`CPU WEAPON // ${desiredWeapon.toUpperCase()}`);
    }

    // Proactive combat dash: evade firing line or open space using tryDash and Poisson rate probability
    if (this.dashCooldown <= 0 && this.dashTimer <= 0 && targetVisible && this.energy >= AI_CONFIG.ENERGY.DASH && distanceToPlayer < AI_CONFIG.DISTANCES.DASH_TRIGGER) {
      const dashChance = distanceToPlayer < AI_CONFIG.DISTANCES.DASH_CLOSE ? 1.15 : .48;
      const dashProb = 1 - Math.exp(-dashChance * dt);
      if (Math.random() < dashProb) {
        const away = _v2.copy(_tempSelfPos).sub(predictedTarget).setY(0).normalize();
        const lateral = _v3.set(-away.z, 0, away.x).multiplyScalar(this.orbitDirection);
        const dashDir = lateral.multiplyScalar(.82).addScaledVector(away, distanceToPlayer < 13 ? .72 : .18).normalize();
        if (this.tryDash(dashDir, AI_CONFIG.ENERGY.DASH)) {
          this.orbitDirection *= -1;
        }
      }
    }

    // Re-evaluate tactics at a controlled cadence so the CPU does not flicker
    const healthRatio = this.health / this.maxHealth;
    const coverPoint = this.getCoverPoint?.(_tempSelfPos, perceivedTarget);
    const pickupTarget = this.getPickupTarget?.(_tempSelfPos);
    const pickupDist = pickupTarget ? pickupTarget.position.distanceTo(_tempSelfPos) : Infinity;
    const wantsResupply = pickupTarget && pickupDist < 44 && this.resupplyTimer > 0 && distanceToPlayer > 18;
    const recentlyDamaged = this.time - this.lastDamageTime < 1.35;
    const needsCover = coverPoint && distanceToPlayer > 14 && (this.state !== 'RETREAT' || this.retreatTimer > 0) && (
      healthRatio < AI_CONFIG.HEALTH.RETREAT_LOW_HEALTH ||
      (recentlyDamaged && healthRatio < AI_CONFIG.HEALTH.RETREAT_DAMAGED_HEALTH && this.shield < 24)
    );
    const recoveredEnough = healthRatio > .5 || this.retreatTimer <= 0;
    if (this.stateDecisionTimer <= 0 || (this.state === 'RETREAT' && recoveredEnough)) {
      let nextState = this.state;
      if (this.state === 'RETREAT' && this.retreatTimer > 0 && !recoveredEnough) {
        nextState = 'RETREAT';
      } else if (needsCover && distanceToPlayer < 62) {
        nextState = 'RETREAT';
      } else if (wantsResupply || (pickupTarget && pickupDist < 22 && (!targetVisible || distanceToPlayer > 34 || healthRatio < .55))) {
        nextState = 'HUNT_PICKUP';
      } else if (targetDetected) {
        nextState = targetVisible && distanceToPlayer >= AI_CONFIG.DISTANCES.ENGAGE_MIN && distanceToPlayer < AI_CONFIG.DISTANCES.ENGAGE_MAX ? 'ENGAGE' : 'CHASE';
      } else {
        nextState = this.targetMemory > 0 ? 'SEARCH' : 'PATROL';
      }
      if (nextState !== this.state) {
        this.state = nextState;
        if (nextState === 'RETREAT') this.retreatTimer = 2.2 + Math.random() * .8;
        this.strafeBias = Math.random() * Math.PI * 2;
        this.navigationPath.length = 0;
        this.navigationPathIndex = 0;
        this.pathReplanTimer = 0;
      }
      this.stateDecisionTimer = this.state === 'RETREAT' ? .32 : .5 + Math.random() * .22;
    }

    // AI Upgrade: Dynamic Navigation Target Selection
    let navigationTarget = predictedTarget;
    const ctfTarget = this.state !== 'RETREAT' && this.getCTFTargetPos?.(_tempSelfPos);
    if (ctfTarget) {
      navigationTarget = ctfTarget;
    } else if (this.state === 'RETREAT') {
      const escapeDirection = _v2.copy(_tempSelfPos).sub(perceivedTarget).setY(0);
      if (escapeDirection.lengthSq() < .01) escapeDirection.set(1, 0, 0);
      const escapePoint = _v3.copy(_tempSelfPos).add(escapeDirection.normalize().multiplyScalar(18));
      navigationTarget = coverPoint || escapePoint;
    } else if (this.state === 'HUNT_PICKUP' && pickupTarget) {
      navigationTarget = pickupTarget.position;
    } else if (this.state === 'SEARCH') {
      navigationTarget = this.lastKnownTargetPosition;
    } else if (this.state === 'PATROL') {
      if (!this.patrolPoint || _tempSelfPos.distanceTo(this.patrolPoint) < 4.0) {
        this.patrolPoint = new THREE.Vector3(
          Math.random() * 100 - 50,
          0,
          Math.random() * 100 - 50
        );
      }
      navigationTarget = this.patrolPoint;
    }

    const routeDestination = navigationTarget;
    navigationTarget = this.resolveNavigationTarget(routeDestination, dt);
    const toTarget = _v2.copy(navigationTarget).sub(_tempSelfPos);
    toTarget.y = 0;
    const navigationDistance = toTarget.length();

    // AI Upgrade: Jetpack Flight airborne state
    const jetpackReady = this.jetpackEquipped && performance.now() >= this.jetpackReadyAt;
    if (jetpackReady) {
      if (this.energy < AI_CONFIG.ENERGY.AIRBORNE_MIN) {
        this.isAirborne = false;
      } else if (this.energy > AI_CONFIG.ENERGY.AIRBORNE_START && this.state !== 'RETREAT' && (this.state === 'CHASE' || this.state === 'SEARCH' || distanceToPlayer > 28)) {
        this.isAirborne = true;
      }
    } else {
      this.isAirborne = false;
    }
    if (this.isAirborne) {
      this.jetpackTimeRemaining = Math.max(0, this.jetpackTimeRemaining - dt);
      if (this.jetpackTimeRemaining <= 0) {
        this.jetpackEquipped = false;
        this.jetpackReadyAt = Infinity;
        this.isAirborne = false;
        if (this.jetpack) this.jetpack.visible = false;
        this.onMessage?.('CPU JETPACK TIME EXPIRED');
      }
    }

    // Movement Steering calculations
    let moved = false;
    if (this.dashTimer > 0) {
      // Active evading perpendicular dash
      this.dashTimer -= dt;
      const speed = AI_CONFIG.SPEEDS.DASH;
      const step = speed * dt;
      const nextX = this.group.position.x + this.dashDirection.x * step;
      const nextZ = this.group.position.z + this.dashDirection.z * step;
      
      if (!this.isBlocked?.(nextX, this.group.position.z, this.group.position.y, 2.05)) {
        this.group.position.x = nextX;
        moved = true;
      }
      if (!this.isBlocked?.(this.group.position.x, nextZ, this.group.position.y, 2.05)) {
        this.group.position.z = nextZ;
        moved = true;
      }

      // Visual: scale up thrusters on dash
      if (this.thrusterFlames) {
        for (let index = 0; index < this.thrusterFlames.length; index++) {
          const flame = this.thrusterFlames[index];
          flame.visible = true;
          flame.scale.set(1.5, 2.0 + Math.sin(this.time * 25) * 0.3, 1.5);
          if (this.thrusterLights?.[index]) this.thrusterLights[index].intensity = 6;
        }
      }
    } else if (navigationDistance > 0.01) {
      // Normal pathing/steering
      const forward = toTarget.clone().normalize();
      const right = _v3.set(-forward.z, 0, forward.x);
      const desired = _v2.set(0, 0, 0);

      if (this.state === 'RETREAT') {
        if (navigationDistance > 2.3) desired.add(forward);
      } else if (this.state === 'HUNT_PICKUP') {
        desired.add(forward);
      } else if (this.state === 'ENGAGE') {
        // Circle-strafing orbit math
        this.orbitTimer -= dt;
        const orbitVec = right.clone().multiplyScalar(this.orbitDirection);
        const targetRadius = this.activeWeapon === 'gatling' ? 15 : this.activeWeapon === 'cannon' ? 23 : 30;
        const radialAdjustment = (navigationDistance - targetRadius) * 0.5;
        desired.copy(orbitVec).addScaledVector(forward, radialAdjustment);
      } else if (this.state === 'SEARCH') {
        if (navigationDistance > 2.5) desired.add(forward);
        desired.addScaledVector(right, Math.sin(this.time * 1.4) * .4);
      } else if (this.state === 'PATROL') {
        desired.add(forward);
      } else {
        // CHASE state
        if (navigationDistance > 16) desired.add(forward);
        else if (navigationDistance < 9) desired.sub(forward);
        else desired.addScaledVector(right, Math.sin(this.time * .9));
      }
      desired.addScaledVector(right, Math.sin(this.time * .55 + this.strafeBias) * .22);

      const move = this.chooseMoveDirection(desired);
      if (move.lengthSq() > .01) {
        move.normalize();
        this.lastMoveDirection.lerp(move, 1 - Math.pow(.05, dt)).normalize();
        const baseSpeed = this.jetpackEquipped && this.isAirborne ? AI_CONFIG.SPEEDS.BASE_AIR : AI_CONFIG.SPEEDS.BASE_GROUND;
        const step = (navigationDistance > 38 ? baseSpeed + 3.5 : navigationDistance > 28 ? baseSpeed + 2 : baseSpeed) * dt;
        const nextX = this.group.position.x + move.x * step;
        if (!this.isBlocked?.(nextX, this.group.position.z, this.group.position.y, 2.05)) {
          this.group.position.x = nextX;
          moved = true;
        }
        const nextZ = this.group.position.z + move.z * step;
        if (!this.isBlocked?.(this.group.position.x, nextZ, this.group.position.y, 2.05)) {
          this.group.position.z = nextZ;
          moved = true;
        }

        // Universal stuck tracking & auto-unstuck escape routine
        const distMoved = _v1.copy(this.group.position).sub(this.lastPosCheck).setY(0).length();
        this.lastPosCheck.copy(this.group.position);

        if (navigationDistance > 2.5 && distMoved < 0.1 * dt * AI_CONFIG.SPEEDS.BASE_GROUND) {
          this.stuckTimer = (this.stuckTimer || 0) + dt;
        } else {
          this.stuckTimer = Math.max(0, (this.stuckTimer || 0) - dt * 2.5);
        }

        if (this.stuckTimer > 0.42) {
          this.stuckTimer = 0;
          this.orbitDirection = -this.orbitDirection;
          this.strafeBias = Math.random() * Math.PI * 2;
          this.patrolPoint = null;

          const randomAngle = Math.random() * Math.PI * 2;
          const escapeDir = _v2.set(Math.sin(randomAngle), 0, Math.cos(randomAngle));

          if (!this.tryDash(escapeDir, 0)) {
            const clearDirection = this.findClearDirection(escapeDir, 2.8);
            if (clearDirection) {
              this.group.position.addScaledVector(clearDirection, 2.8);
              this.lastMoveDirection.copy(clearDirection);
              this.lastPosCheck.copy(this.group.position);
            } else {
              this.recoverFromEmbeddedPosition(escapeDir);
            }
          }
        }
      }

      // Handle jetpack thruster flame scales
      if (this.thrusterFlames) {
        const showFlames = this.jetpackEquipped && this.isAirborne;
        for (let index = 0; index < this.thrusterFlames.length; index++) {
          const flame = this.thrusterFlames[index];
          flame.visible = showFlames;
          if (showFlames) {
            flame.scale.set(1.08, 1.45 + Math.sin(this.time * 20 + index) * .25, 1.08);
          }
          if (this.thrusterLights?.[index]) this.thrusterLights[index].intensity = showFlames ? 4.5 : 0;
        }
      }
    }

    // Detect corridor deadlocks and short back-and-forth loops. Per-frame
    // movement alone is not proof of progress: a CPU can pace inside a narrow
    // gap forever while its old stuck timer repeatedly resets.
    if (navigationDistance > 2.5) {
      if (!Number.isFinite(this.progressStartDistance)) {
        this.progressAnchor.copy(this.group.position);
        this.progressStartDistance = navigationDistance;
        this.progressTimer = 0;
      }
      this.progressTimer += dt;
      if (this.progressTimer >= 1.8) {
        const netTravel = _v1.copy(this.group.position).sub(this.progressAnchor).setY(0).length();
        const distanceImprovement = this.progressStartDistance - navigationDistance;
        const orbitProgress = this.state === 'ENGAGE' && netTravel >= 3.5;
        const routeProgress = this.state !== 'ENGAGE' && (distanceImprovement >= .8 || netTravel >= 4);
        if (!orbitProgress && !routeProgress) {
          const forcedDirection = _v2.copy(navigationTarget).sub(this.group.position).setY(0);
          this.recoverFromEmbeddedPosition(forcedDirection, true);
          moved = false;
        }
        this.progressAnchor.copy(this.group.position);
        this.progressStartDistance = this.group.position.distanceTo(navigationTarget);
        this.progressTimer = 0;
      }
    } else {
      this.progressAnchor.copy(this.group.position);
      this.progressStartDistance = navigationDistance;
      this.progressTimer = 0;
    }

    // Periodically flip orbiting direction
    if (this.state === 'ENGAGE' && this.orbitTimer <= 0) {
      this.orbitDirection = -this.orbitDirection;
      this.orbitTimer = 4.0 + Math.random() * 3.0;
    }

    const impactSpeed = this.rigidBody.externalVelocity.length();
    if (impactSpeed > .01) {
      this.rigidBody.integrateHorizontal(
        dt,
        (x, z) => this.isBlocked?.(x, z, this.group.position.y, 2.05) ?? false
      );
      moved = true;
    }

    // Drive the gait from actual ground travel so feet do not skate when speed changes.
    const gaitDelta = _v1.copy(this.group.position).sub(this.lastGaitPosition).setY(0).length();
    this.lastGaitPosition.copy(this.group.position);
    const groundedMotion = moved && !this.isAirborne && gaitDelta > 0.001;
    if (groundedMotion) this.gaitPhase += gaitDelta * 1.32;
    const gaitBlend = groundedMotion
      ? THREE.MathUtils.clamp(gaitDelta / Math.max(dt * 5.5, 0.001), 0, 1)
      : 0;
    const blend = 1 - Math.exp(-(groundedMotion ? 12 : 7) * dt);
    if (this.legs?.length === 2) {
      for (let index = 0; index < this.legs.length; index++) {
        const leg = this.legs[index];
        const joints = leg.userData.joints;
        const phase = this.gaitPhase + index * Math.PI;
        const stride = Math.sin(phase) * gaitBlend;
        const swingLift = Math.pow(Math.max(0, Math.sin(phase)), 0.75) * gaitBlend;
        const stanceCompression = Math.pow(Math.max(0, -Math.sin(phase)), 1.35) * gaitBlend;
        const footAirborne = groundedMotion && Math.sin(phase) > .05;
        if (this.gaitFeetAirborne[index] && !footAirborne) {
          this.bodyBounceVelocity -= .82;
        }
        this.gaitFeetAirborne[index] = footAirborne;
        leg.rotation.x = THREE.MathUtils.lerp(leg.rotation.x, stride * .38, blend);
        leg.position.y = THREE.MathUtils.lerp(
          leg.position.y,
          leg.userData.basePosition.y + swingLift * .25 - stanceCompression * .07,
          blend
        );
        leg.position.z = THREE.MathUtils.lerp(
          leg.position.z,
          leg.userData.basePosition.z - stride * .2,
          blend
        );
        joints.thigh.rotation.x = THREE.MathUtils.lerp(joints.thigh.rotation.x, -.36 + stride * .18, blend);
        joints.knee.rotation.x = THREE.MathUtils.lerp(joints.knee.rotation.x, .18 + swingLift * .48 + stanceCompression * .1, blend);
        joints.shin.rotation.x = THREE.MathUtils.lerp(joints.shin.rotation.x, .56 - swingLift * .24, blend);
        joints.calf.rotation.x = THREE.MathUtils.lerp(joints.calf.rotation.x, -.18 - swingLift * .12, blend);
        joints.foot.rotation.x = THREE.MathUtils.lerp(joints.foot.rotation.x, -swingLift * .2 + stanceCompression * .06, blend);
        joints.toe.rotation.x = THREE.MathUtils.lerp(joints.toe.rotation.x, -swingLift * .12 + stanceCompression * .16, blend);
      }
      const bounceAcceleration = -74 * this.bodyBounceOffset - 12 * this.bodyBounceVelocity;
      this.bodyBounceVelocity += bounceAcceleration * dt;
      this.bodyBounceOffset += this.bodyBounceVelocity * dt;
      this.bodyBounceOffset = THREE.MathUtils.clamp(this.bodyBounceOffset, -.3, .12);
      const weightDrop = Math.pow(Math.abs(Math.cos(this.gaitPhase)), 6) * gaitBlend;
      this.upperPivot.position.y = THREE.MathUtils.lerp(
        this.upperPivot.position.y,
        this.upperPivotBaseY - weightDrop * .08 + this.bodyBounceOffset * gaitBlend,
        1 - Math.exp(-15 * dt)
      );
    }
    const verticalWeaponAim = Math.atan2(
      predictedTarget.y + 4.65 - (this.group.position.y + 5.25),
      Math.max(1, distanceToPlayer)
    );
    this.weaponSpin = Math.max(0, (this.weaponSpin || 0) - dt * 2.8);
    if (this.arms?.length === 2) {
      for (let index = 0; index < this.arms.length; index++) {
        const recoil = this.lastFiredMuzzleIndex === index ? this.weaponSpin * .11 : 0;
        const targetPitch = THREE.MathUtils.clamp(-verticalWeaponAim * .7 + recoil, -.7, .5);
        this.arms[index].rotation.x = THREE.MathUtils.lerp(this.arms[index].rotation.x, targetPitch, 1 - Math.exp(-15 * dt));
        this.arms[index].rotation.z = THREE.MathUtils.lerp(
          this.arms[index].rotation.z,
          Math.sin(this.time * 8.2) * .015 * (index === 0 ? -1 : 1),
          blend
        );
        if (this.barrelGroups?.[index]) this.barrelGroups[index].rotation.z += (this.activeWeapon === 'gatling' ? (this.weaponSpin > 0 ? 29 : 7) : 1.2) * dt;
      }
    }
    if (this.torso) {
      this.torso.position.y = this.torsoBaseY + (moved ? Math.abs(Math.sin(this.time * 8.2)) * .1 : 0);
      this.torso.rotation.z = moved ? Math.sin(this.time * 4.1) * .022 : THREE.MathUtils.lerp(this.torso.rotation.z, 0, blend);
    }

    // Airborne height & ground collision calculations
    let desiredY = 0;
    if (this.jetpackEquipped && this.isAirborne) {
      desiredY = (this.dashTimer > 0) ? 4.0 : 16.0;
    }
    const nextY = THREE.MathUtils.lerp(this.group.position.y, desiredY, 1 - Math.pow(.12, dt));
    if (!this.isAirborne && nextY < 2.0) {
      if (this.isBlocked?.(this.group.position.x, this.group.position.z, 0, 2.05)) {
        // Keep slightly elevated if ground landing position is inside obstacle
      }
    }
    this.group.position.y = nextY;

    const angleDelta = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
    if (moved && this.dashTimer <= 0) {
      const lowerTargetYaw = Math.atan2(this.lastMoveDirection.x, this.lastMoveDirection.z);
      this.group.rotation.y += angleDelta(this.group.rotation.y, lowerTargetYaw) * (1 - Math.exp(-9 * dt));
    }
    if (this.upperPivot) {
      const aimYaw = Math.atan2(predictedTarget.x - this.group.position.x, predictedTarget.z - this.group.position.z);
      const relativeAim = THREE.MathUtils.clamp(angleDelta(this.group.rotation.y, aimYaw), -2.25, 2.25);
      this.upperPivot.rotation.y += angleDelta(this.upperPivot.rotation.y, relativeAim) * (1 - Math.exp(-13 * dt));
      const verticalAim = verticalWeaponAim;
      this.upperPivot.rotation.x = THREE.MathUtils.lerp(
        this.upperPivot.rotation.x,
        THREE.MathUtils.clamp(-verticalAim * .22, -.2, .2),
        1 - Math.exp(-10 * dt)
      );
      if (this.headGroup) {
        this.headGroup.rotation.x = THREE.MathUtils.lerp(
          this.headGroup.rotation.x,
          THREE.MathUtils.clamp(-verticalAim * .35, -.34, .3),
          1 - Math.exp(-12 * dt)
        );
      }
    }

    // AI Upgrade: Shield & health regeneration when stationary in cover
    const isRetreating = this.state === 'RETREAT';
    if (isRetreating && coverPoint && navigationDistance < 3 && !moved) {
      this.energy = Math.min(AI_CONFIG.ENERGY.MAX, this.energy + AI_CONFIG.ENERGY.REGEN_COVER * dt);
      if (this.shield < AI_CONFIG.SHIELD.MAX) {
        this.shield = Math.min(AI_CONFIG.SHIELD.MAX, this.shield + AI_CONFIG.SHIELD.REGEN_COVER * dt);
        this.shieldBubble.setStrength(this.shield / AI_CONFIG.SHIELD.MAX);
      }
      if (this.health < AI_CONFIG.HEALTH.MAX) {
        this.health = Math.min(AI_CONFIG.HEALTH.MAX, this.health + AI_CONFIG.HEALTH.REGEN_COVER * dt);
        this.drawHealth();
      }
    } else if (this.isAirborne) {
      this.energy = Math.max(0, this.energy - AI_CONFIG.ENERGY.JETPACK_DRAIN * dt);
    } else if (moved) {
      this.energy = isRetreating
        ? Math.min(AI_CONFIG.ENERGY.MAX, this.energy + AI_CONFIG.ENERGY.REGEN_MOVING_RETREAT * dt)
        : Math.max(0, this.energy + AI_CONFIG.ENERGY.REGEN_MOVING_NORMAL * dt);
    } else {
      this.energy = Math.min(AI_CONFIG.ENERGY.MAX, this.energy + AI_CONFIG.ENERGY.REGEN_IDLE * dt);
    }

    // AI Upgrade: Homing missile barrage launcher
    if (this.missileCooldown <= 0 && this.activeWeapon === 'homing' && (this.state === 'ENGAGE' || this.state === 'CHASE') && targetVisible && distanceToPlayer > AI_CONFIG.DISTANCES.MISSILE_TRIGGER && distanceToPlayer <= WEAPONS.profiles.homing.range && this.missileSalvoLeft === 0) {
      this.missileSalvoLeft = 4;
      this.missileSalvoTimer = 0.08;
      this.missileCooldown = AI_CONFIG.COOLDOWNS.MISSILE_MIN + Math.random() * (AI_CONFIG.COOLDOWNS.MISSILE_MAX - AI_CONFIG.COOLDOWNS.MISSILE_MIN);
      this.onMessage?.('CPU: MISSILE SALVO!');
    }

    if (this.missileSalvoLeft > 0) {
      this.missileSalvoTimer -= dt;
      if (this.missileSalvoTimer <= 0) {
        this.fireHomingMissile();
        this.missileSalvoLeft--;
        this.missileSalvoTimer = 0.38;
      }
    }

    const effectiveWeapon = this.activeWeapon === 'homing'
      ? (distanceToPlayer < 22 ? 'gatling' : laserWindow ? 'laser' : 'cannon')
      : this.activeWeapon;
    const requiredEnergy = effectiveWeapon === 'gatling' ? AI_CONFIG.ENERGY.GATLING : AI_CONFIG.ENERGY.CANNON;

    if (this.fireCooldown <= 0 && !isRetreating && this.state !== 'HUNT_PICKUP' && this.energy >= requiredEnergy) {
      const buildingTarget = this.getBuildingTarget?.(this.group.position);
      const attackBuilding = buildingTarget && Math.random() < .25;
      const activeStats = WEAPONS.get(effectiveWeapon, this.powerLevel);
      if ((targetVisible && distanceToPlayer <= activeStats.range) || attackBuilding) {
        const relativeX = perceivedTarget.x - this.group.position.x;
        const relativeZ = perceivedTarget.z - this.group.position.z;
        const velocityX = this.targetVelocity.x;
        const velocityZ = this.targetVelocity.z;
        const speed = activeStats.speed;
        const a = velocityX * velocityX + velocityZ * velocityZ - speed * speed;
        const b = 2 * (relativeX * velocityX + relativeZ * velocityZ);
        const c = relativeX * relativeX + relativeZ * relativeZ;
        let leadTime = Number.isFinite(speed) ? Math.sqrt(c) / speed : 0;
        const discriminant = b * b - 4 * a * c;
        if (discriminant >= 0 && Math.abs(a) > .001) {
          const t1 = (-b - Math.sqrt(discriminant)) / (2 * a);
          const t2 = (-b + Math.sqrt(discriminant)) / (2 * a);
          const validTimes = [t1, t2].filter(time => time > 0);
          if (validTimes.length) leadTime = Math.min(...validTimes);
        }
        leadTime = THREE.MathUtils.clamp(leadTime, .2, 1.8);
        const aimError = Math.min(.65, Math.max(.08, distanceToPlayer * .007));
        const lateralError = _v3.set(-relativeZ, 0, relativeX).normalize()
          .multiplyScalar(Math.sin(this.time * 2.1 + this.strafeBias) * aimError);
        const predictedPlayerAim = perceivedTarget.clone()
          .addScaledVector(this.targetVelocity, leadTime)
          .add(lateralError)
          .add(_v2.set(0, 3.5, 0));

        const originalWeapon = this.activeWeapon;
        this.activeWeapon = effectiveWeapon;
        this.fire(attackBuilding ? buildingTarget : predictedPlayerAim, targetVisible && !attackBuilding, effectiveWeapon);
        this.activeWeapon = originalWeapon;

        // Mechanical cooldown is identical to the player. A small trigger
        // hesitation models a human pilot without changing weapon capability.
        this.fireCooldown = activeStats.cooldown + (effectiveWeapon === 'gatling'
          ? Math.random() * .09
          : .08 + Math.random() * .22);
      }
    }
  }
}

return EnemyAI;
};
