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
                    * uStrength * breathing * energyFloor;

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
    for (const shell of shells) shell.visible = visible;
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
class EnemyAI {
  constructor({ scene, target, isBlocked, isProjectileBlocked, getBuildingTarget, getPickupTarget, getCoverPoint, canSeeTarget, getSpawnPosition, onPlayerHit, onStatus, onMessage, onDestroyed, isDamageImmune }) {
    this.scene = scene;
    this.target = target;
    this.isBlocked = isBlocked;
    this.isProjectileBlocked = isProjectileBlocked;
    this.getBuildingTarget = getBuildingTarget;
    this.getPickupTarget = getPickupTarget;
    this.getCoverPoint = getCoverPoint;
    this.canSeeTarget = canSeeTarget;
    this.getSpawnPosition = getSpawnPosition;
    this.onPlayerHit = onPlayerHit;
    this.onStatus = onStatus;
    this.onMessage = onMessage;
    this.isDamageImmune = isDamageImmune;
    this.onDestroyed = onDestroyed;
    this.maxHealth = 100;
    this.health = 100;
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
    this.energy = 100;
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
    this.lastDamageTime = -Infinity;
    this.strafeBias = Math.random() * Math.PI * 2;

    this.group = this.createModel();
    this.scene.add(this.group);
    this.reset();
  }

  createModel() {
    const group = new THREE.Group();
    group.userData.unitClass = '8M ASSAULT PLATFORM';

    const armor = new THREE.MeshStandardMaterial({ color: 0x551923, roughness: .31, metalness: .8 });
    const armorLight = new THREE.MeshStandardMaterial({ color: 0x9a3947, roughness: .29, metalness: .72 });
    const glow = new THREE.MeshStandardMaterial({ color: 0xff4964, emissive: 0xb3092d, emissiveIntensity: 2.7, roughness: .16, metalness: .28 });
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

    const pelvis = makeBox(3.35, 1.02, 2.35, dark);
    pelvis.position.set(0, 3.68, -.04);
    group.add(pelvis);
    const waist = makeCylinder(.72, .82, .54, armorLight, 20);
    waist.position.y = 4.26;
    group.add(waist);
    const waistCore = makeCylinder(.38, .45, .68, glow, 16);
    waistCore.position.y = 4.27;
    group.add(waistCore);

    for (const side of [-1, 1]) {
      const skirt = makeBox(1.18, 1.22, 1.72, armor);
      skirt.position.set(side * 1.7, 3.62, .05);
      skirt.rotation.z = side * -.08;
      group.add(skirt);
    }

    const torso = new THREE.Group();
    torso.position.y = 5.18;
    group.add(torso);
    this.torso = torso;

    const body = makeBox(4.9, 2.08, 2.88, armor);
    body.position.z = -.02;
    torso.add(body);
    const lowerChest = makeBox(3.9, .72, 2.95, dark);
    lowerChest.position.set(0, -.82, .02);
    torso.add(lowerChest);
    const front = makeBox(3.75, 1.28, .5, armorLight);
    front.position.set(0, -.06, 1.61);
    front.rotation.x = -.12;
    torso.add(front);
    const sensorArmor = makeBox(1.72, .9, .56, dark);
    sensorArmor.position.set(0, .3, 1.84);
    sensorArmor.rotation.x = -.18;
    torso.add(sensorArmor);
    const sensorLens = makeBox(.78, .22, .08, glow);
    sensorLens.position.set(0, .34, 2.14);
    torso.add(sensorLens);
    const counterweight = makeBox(3.9, 1.5, .72, dark);
    counterweight.position.set(0, .02, -1.65);
    torso.add(counterweight);

    for (const side of [-1, 1]) {
      const shoulder = makeBox(1.15, 1.68, 2.74, armor);
      shoulder.position.set(side * 2.35, .06, -.02);
      torso.add(shoulder);
      const outer = makeBox(.72, 1.2, 2.82, armorLight);
      outer.position.set(side * 2.75, .06, 0);
      outer.rotation.z = side * -.16;
      torso.add(outer);
      const stripe = makeBox(.16, 1.34, 2.9, brass);
      stripe.position.set(side * 2.83, .05, .02);
      torso.add(stripe);
    }

    const headGroup = new THREE.Group();
    headGroup.position.set(-.55, 6.76, .02);
    group.add(headGroup);
    const turntable = makeCylinder(.48, .58, .3, dark, 18);
    headGroup.add(turntable);
    const sensorHead = makeBox(1.35, .72, 1.45, armorLight);
    sensorHead.position.set(0, .42, .18);
    headGroup.add(sensorHead);
    const visor = makeBox(.72, .2, .1, glow);
    visor.position.set(0, .46, .94);
    headGroup.add(visor);
    const scoutGun = makeCylinder(.11, .16, 1.75, dark, 12);
    scoutGun.rotation.x = Math.PI / 2;
    scoutGun.position.set(0, .48, 1.45);
    headGroup.add(scoutGun);

    this.legs = [];
    for (const side of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(side * 1.18, 3.62, 0);
      group.add(leg);
      this.legs.push(leg);

      const hip = makeCylinder(.63, .63, .82, dark, 18);
      hip.rotation.z = Math.PI / 2;
      leg.add(hip);
      const thigh = makeBox(1.2, 1.78, 1.48, armor);
      thigh.position.set(0, -.78, .42);
      thigh.rotation.x = -.36;
      leg.add(thigh);
      const knee = makeBox(1.3, .58, 1.58, brass);
      knee.position.set(0, -1.62, .92);
      knee.rotation.x = .18;
      leg.add(knee);
      const shin = makeBox(1.24, 1.92, 1.5, armorLight);
      shin.position.set(0, -2.48, .18);
      shin.rotation.x = .56;
      leg.add(shin);
      const calf = makeBox(.86, 1.08, .5, dark);
      calf.position.set(0, -2.62, -.73);
      calf.rotation.x = -.18;
      leg.add(calf);
      for (const pistonX of [-.33, .33]) {
        const piston = makeCylinder(.08, .1, 1.28, hydraulic, 10);
        piston.position.set(pistonX, -2.32, -.48);
        piston.rotation.x = -.26;
        leg.add(piston);
      }
      const foot = makeBox(1.58, .62, 2.28, dark);
      foot.position.set(0, -3.55, .24);
      leg.add(foot);
      const toe = makeBox(1.18, .34, .72, armorLight);
      toe.position.set(0, -3.44, 1.31);
      leg.add(toe);
    }

    this.arms = [];
    this.weaponMuzzles = [];
    this.barrelGroups = [];
    for (const side of [-1, 1]) {
      const pod = new THREE.Group();
      pod.position.set(side * 2.82, 5.42, .12);
      group.add(pod);
      this.arms.push(pod);

      const joint = makeCylinder(.63, .63, .82, dark, 18);
      joint.rotation.z = Math.PI / 2;
      pod.add(joint);
      const housing = makeBox(1.55, 1.34, 2.18, armor);
      housing.position.z = .48;
      pod.add(housing);
      const face = makeBox(1.18, .82, .2, armorLight);
      face.position.set(0, .02, 1.62);
      pod.add(face);
      const bearing = makeCylinder(.5, .56, .58, dark, 18);
      bearing.rotation.x = Math.PI / 2;
      bearing.position.z = 1.73;
      pod.add(bearing);

      const barrels = new THREE.Group();
      barrels.position.z = 1.78;
      pod.add(barrels);
      this.barrelGroups.push(barrels);
      for (let index = 0; index < 6; index++) {
        const angle = index / 6 * Math.PI * 2;
        const barrel = makeCylinder(.075, .095, 3.05, dark, 9);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(Math.cos(angle) * .25, Math.sin(angle) * .25, 1.525);
        barrels.add(barrel);
      }
      const center = makeCylinder(.12, .16, 3.18, hydraulic, 12);
      center.rotation.x = Math.PI / 2;
      center.position.z = 1.55;
      barrels.add(center);
      const ring = makeCylinder(.39, .39, .22, brass, 20);
      ring.rotation.x = Math.PI / 2;
      ring.position.z = 3.08;
      barrels.add(ring);
      const muzzle = new THREE.Object3D();
      muzzle.position.z = 3.28;
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
    for (let row = 0; row < 3; row++) {
      for (let column = 0; column < 4; column++) {
        const port = makeCylinder(.13, .13, .23, portMat, 12);
        port.rotation.x = Math.PI / 2;
        port.position.set((column - 1.5) * .43, (1 - row) * .3, 1.6);
        missileRack.add(port);
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
    this.energy = 100;
    this.seekCoverTimer = 0;
    this.retreatMode = false;
    this.targetMemory = 0;
    this.searchScanTimer = 0;
    this.activeWeapon = 'cannon';
    this.weaponSwapTimer = 0;
    if (this.jetpack) this.jetpack.visible = false;
    this.targetVelocity.set(0, 0, 0);
    this.lastTargetPosition.copy(this.group.position);
    this.lastKnownTargetPosition.copy(this.group.position).add(new THREE.Vector3(Math.random() * 12 - 6, 0, Math.random() * 12 - 6));
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
    this.jetpackEquipped = true;
    if (this.jetpack) this.jetpack.visible = true;
    this.onMessage?.('CPU JETPACK EQUIPPED!');
  }

  applyHealth(amount = 40) {
    this.health = Math.min(this.maxHealth, this.health + amount);
    this.drawHealth();
    this.onMessage?.(`CPU HEALTH +${amount}`);
  }

  applyShield(amount = 60) {
    this.shield = Math.min(100, this.shield + amount);
    this.shieldBubble.setStrength(this.shield / 100);
    this.shieldBubble.hit(this.group.position.clone().add(new THREE.Vector3(0, 4.25, 0)), .55);
    this.onMessage?.(`CPU SHIELD +${amount}`);
  }

  takeDamage(damage, impulse, impactPosition = null) {
    if (!this.alive) return false;
    if (performance.now() < (this.spawnProtectedUntil || 0) || this.isDamageImmune?.(this.group.position)) {
      this.onMessage?.('CPU SAFE ZONE // DAMAGE BLOCKED');
      return false;
    }
    let incomingDamage = damage * 7;
    const absorbed = Math.min(this.shield, incomingDamage);
    this.shield -= absorbed;
    incomingDamage -= absorbed;
    if (absorbed > 0) {
      const shieldImpact = impactPosition || this.group.position.clone().add(new THREE.Vector3(0, 4.25, 0));
      this.shieldBubble.hit(shieldImpact, .4 + Math.min(1, absorbed / 24));
    }
    this.shieldBubble.setStrength(this.shield / 100);
    this.health = Math.max(0, this.health - incomingDamage);
    this.group.position.addScaledVector(impulse, Math.min(1.2, damage * .2));
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
      const dashDir = new THREE.Vector3();
      if (impulse.lengthSq() > 0.01) {
        // Perpendicular to impulse on XZ plane
        dashDir.set(-impulse.z, 0, impulse.x).normalize();
      } else {
        // Perpendicular to player direction
        const toPlayer = this.target.position.clone().sub(this.group.position);
        toPlayer.y = 0;
        toPlayer.normalize();
        dashDir.set(-toPlayer.z, 0, toPlayer.x).normalize();
      }
      if (Math.random() < 0.5) dashDir.negate();
      this.dashTimer = 0.25; // Dash duration
      this.dashDirection.copy(dashDir);
      this.dashCooldown = 3.5 + Math.random() * 1.5;
      this.onMessage?.('CPU: EVADING!');
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

  checkPlayerShellHit(position, damage, impulse) {
    if (!this.alive) return false;
    const dx = position.x - this.group.position.x;
    const dz = position.z - this.group.position.z;
    const localY = position.y - this.group.position.y;
    if (dx * dx + dz * dz > 9.2 || localY < .1 || localY > 8.55) return false;
    return this.takeDamage(damage, impulse, position);
  }

  fireHomingMissile() {
    if (!this.alive) return;
    this.group.updateWorldMatrix(true, true);
    
    // Get world position of current port
    const portLocal = this.missilePorts[this.nextMissilePortIndex];
    this.nextMissilePortIndex = (this.nextMissilePortIndex + 1) % this.missilePorts.length;
    const origin = this.missileRack.localToWorld(portLocal.clone());
    
    // Create missile (glowing red sphere)
    const missile = new THREE.Mesh(
      new THREE.SphereGeometry(0.35, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xff3b5c, emissive: 0xff003c, emissiveIntensity: 2.2 })
    );
    missile.position.copy(origin);
    
    // Physics - initial upward thrust, then curves towards player
    const toPlayer = this.target.position.clone().sub(this.group.position).setY(0).normalize();
    const velocity = toPlayer.clone().multiplyScalar(10);
    velocity.y = 18 + Math.random() * 6; // pop up!
    
    missile.userData.velocity = velocity;
    missile.userData.damage = 13 + this.powerLevel * 3;
    missile.userData.splashRadius = 7.5;
    missile.userData.splashMultiplier = .72;
    missile.userData.life = 3.2;
    missile.userData.homing = true;
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

  fire(targetPoint = null, trackPlayer = false) {
    if (this.energy < 12) return;
    this.group.updateWorldMatrix(true, true);
    const muzzle = this.weaponMuzzles?.[this.nextMuzzleIndex];
    const origin = muzzle
      ? muzzle.getWorldPosition(new THREE.Vector3())
      : this.group.position.clone().add(new THREE.Vector3(0, 5.35, 0));
    this.lastFiredMuzzleIndex = this.nextMuzzleIndex;
    this.nextMuzzleIndex = (this.nextMuzzleIndex + 1) % Math.max(1, this.weaponMuzzles?.length || 1);
    this.weaponSpin = 1;
    targetPoint = targetPoint || this.target.position.clone().add(new THREE.Vector3(0, 4.65, 0));
    const delta = targetPoint.clone().sub(origin);
    const horizontal = new THREE.Vector3(delta.x, 0, delta.z);
    const distance = Math.max(.1, horizontal.length());
    const gatlingShot = this.activeWeapon === 'gatling';
    const speed = gatlingShot ? this.shellSpeed * 1.32 : this.shellSpeed;
    const gravity = 12;
    const discriminant = speed ** 4 - gravity * (gravity * distance * distance + 2 * delta.y * speed * speed);
    let angle = .18;
    if (discriminant >= 0) angle = Math.atan((speed * speed - Math.sqrt(discriminant)) / (gravity * distance));
    const direction = horizontal.normalize();
    const velocity = direction.clone().multiplyScalar(speed * Math.cos(angle));
    velocity.y = speed * Math.sin(angle);

    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(gatlingShot ? .16 : .3, 10, 8),
      new THREE.MeshStandardMaterial({ color: gatlingShot ? 0xffd063 : 0xff405a, emissive: gatlingShot ? 0xff6500 : 0xb60025, emissiveIntensity: 1.7 })
    );
    shell.position.copy(origin).addScaledVector(direction, .35);
    shell.userData.velocity = velocity;
    shell.userData.damage = gatlingShot ? 4 + this.powerLevel : 12 + this.powerLevel * 4;
    shell.userData.splashRadius = gatlingShot ? 0 : 4.2 + this.powerLevel * .45;
    shell.userData.splashMultiplier = gatlingShot ? 0 : .62;
    shell.userData.life = gatlingShot ? .68 : 4;
    shell.userData.trackPlayer = trackPlayer;
    this.scene.add(shell);
    this.shells.push(shell);
    this.energy = Math.max(0, this.energy - (gatlingShot ? 5 : 12));
  }

  updateShells(dt) {
    const targetPoint = this.lastKnownTargetPosition.clone().add(new THREE.Vector3(0, 4.65, 0));
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const shell = this.shells[i];
      shell.userData.life -= dt;
      const previousPosition = shell.position.clone();
      
      if (shell.userData.homing) {
        // AI Upgrade: Homing missile physics (3D bending)
        const targetPos = this.target.position.clone().add(new THREE.Vector3(0, 4.25, 0));
        const speed = Math.max(20, shell.userData.velocity.length());
        const desiredVelocity = targetPos.sub(shell.position).normalize().multiplyScalar(speed);
        shell.userData.velocity.lerp(desiredVelocity, 1 - Math.pow(.18, dt));
        
        // Spawn colored smoke trail
        shell.userData.trailTimer = (shell.userData.trailTimer || 0) - dt;
        if (shell.userData.trailTimer <= 0) {
          this.spawnMissileTrail(shell.position);
          shell.userData.trailTimer = 0.035;
        }
        
        shell.userData.velocity.y -= 5 * dt;
      } else {
        // Standard shell physics
        if (shell.userData.trackPlayer) {
          const desiredHorizontal = targetPoint.clone().sub(shell.position);
          desiredHorizontal.y = 0;
          const horizontalSpeed = Math.hypot(shell.userData.velocity.x, shell.userData.velocity.z);
          if (desiredHorizontal.lengthSq() > .01 && horizontalSpeed > 0) {
            desiredHorizontal.setLength(horizontalSpeed);
            const correction = 1 - Math.pow(.18, dt);
            shell.userData.velocity.x = THREE.MathUtils.lerp(shell.userData.velocity.x, desiredHorizontal.x, correction);
            shell.userData.velocity.z = THREE.MathUtils.lerp(shell.userData.velocity.z, desiredHorizontal.z, correction);
          }
        }
        shell.userData.velocity.y -= 12 * dt;
      }

      shell.position.addScaledVector(shell.userData.velocity, dt);
      const segment = shell.position.clone().sub(previousPosition);
      const segmentLengthSq = segment.lengthSq();
      const hitT = segmentLengthSq > 0
        ? THREE.MathUtils.clamp(targetPoint.clone().sub(previousPosition).dot(segment) / segmentLengthSq, 0, 1)
        : 0;
      const closestPoint = previousPosition.clone().addScaledVector(segment, hitT);
      
      if (this.isProjectileBlocked?.(shell.position, shell.userData.velocity)) {
        this.applyShellExplosion(shell, shell.position);
        shell.userData.life = 0;
      } else if ((shell.userData.trackPlayer || shell.userData.homing) && closestPoint.distanceTo(targetPoint) < 1.55) {
        // A direct hit deals its full payload. The blast is intentionally not
        // applied a second time to the same target.
        this.onPlayerHit?.(shell.userData.damage, closestPoint);
        shell.userData.life = 0;
      }
      
      if (shell.position.y <= .2 && shell.userData.life > 0) {
        this.applyShellExplosion(shell, shell.position);
        shell.userData.life = 0;
      }
      if (shell.userData.life <= 0) {
        this.scene.remove(shell);
        this.shells.splice(i, 1);
      }
    }
  }

  applyShellExplosion(shell, position) {
    const radius = shell.userData.splashRadius || 0;
    if (shell.userData.exploded || radius <= 0) return;
    shell.userData.exploded = true;
    const targetCenter = this.target.position.clone().add(new THREE.Vector3(0, 3.5, 0));
    const distance = targetCenter.distanceTo(position);
    if (distance > radius) return;
    const falloff = 1 - distance / radius;
    const damage = shell.userData.damage * (shell.userData.splashMultiplier || .6) * Math.max(.18, falloff);
    this.onPlayerHit?.(damage, position);
  }

  chooseMoveDirection(desired) {
    if (desired.lengthSq() < .001) return new THREE.Vector3();
    desired.normalize();
    const angles = [0, Math.PI / 6, -Math.PI / 6, Math.PI / 3, -Math.PI / 3, Math.PI / 2, -Math.PI / 2, Math.PI];
    const up = new THREE.Vector3(0, 1, 0);
    let best = null;
    let bestScore = -Infinity;
    for (const angle of angles) {
      const candidate = desired.clone().applyAxisAngle(up, angle);
      const probeNear = this.group.position.clone().addScaledVector(candidate, 1.2);
      const probeFar = this.group.position.clone().addScaledVector(candidate, 2.5);
      if (this.isBlocked?.(probeNear.x, probeNear.z, this.group.position.y, 2.05)) continue;
      if (this.isBlocked?.(probeFar.x, probeFar.z, this.group.position.y, 2.05)) continue;
      const directionScore = candidate.dot(desired) * 4;
      const continuityScore = candidate.dot(this.lastMoveDirection) * 1.2;
      const sidePreference = Math.sin(this.time * .7) * Math.sign(angle) * .12;
      const score = directionScore + continuityScore + sidePreference;
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }
    return best || desired.clone().applyAxisAngle(up, Math.sin(this.time) > 0 ? Math.PI / 2 : -Math.PI / 2);
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
    this.shieldBubble.update(dt, spawnProtected ? 1 : this.shield / 100);
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
    this.seekCoverTimer = Math.max(0, this.seekCoverTimer - dt);
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.missileCooldown = Math.max(0, this.missileCooldown - dt);
    this.weaponSwapTimer = Math.max(0, this.weaponSwapTimer - dt);
    this.stateDecisionTimer = Math.max(0, this.stateDecisionTimer - dt);
    this.retreatTimer = Math.max(0, this.retreatTimer - dt);
    this.resupplyTimer = Math.max(0, this.resupplyTimer - dt);

    // Visual line-of-sight is still required for firing, but a long-range
    // combat sensor keeps the AI pursuing a walker that is far away or briefly
    // hidden behind city geometry.
    const targetVisible = this.canSeeTarget?.(this.group.position, this.target.position) ?? true;
    const directTargetDistance = this.target.position.clone().sub(this.group.position).setY(0).length();
    const radarContact = directTargetDistance < 118;
    const targetDetected = targetVisible || radarContact;
    if (targetVisible) {
      const observedVelocity = this.target.position.clone().sub(this.lastTargetPosition).multiplyScalar(1 / Math.max(dt, .001));
      if (observedVelocity.length() > 12) observedVelocity.setLength(12);
      this.targetVelocity.lerp(observedVelocity, 1 - Math.pow(.02, dt));
      this.lastTargetPosition.copy(this.target.position);
      this.lastKnownTargetPosition.lerp(this.target.position, 1 - Math.pow(.015, dt));
      this.targetMemory = 7.5;
    } else if (radarContact) {
      // A distant signal supplies only a rough bearing. The CPU periodically
      // searches an imprecise sector; it never receives the exact player point
      // until it establishes line-of-sight again.
      this.searchScanTimer = Math.max(0, this.searchScanTimer - dt);
      if (this.searchScanTimer <= 0) {
        const bearing = this.target.position.clone().sub(this.group.position).setY(0);
        if (bearing.lengthSq() > .01) {
          bearing.normalize();
          const estimatedDistance = THREE.MathUtils.clamp(directTargetDistance + THREE.MathUtils.randFloat(-18, 18), 16, 118);
          const side = new THREE.Vector3(-bearing.z, 0, bearing.x).multiplyScalar(THREE.MathUtils.randFloat(-16, 16));
          this.lastKnownTargetPosition.copy(this.group.position).addScaledVector(bearing, estimatedDistance).add(side);
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
    const distanceToPlayer = predictedTarget.clone().sub(this.group.position).setY(0).length();
    const desiredWeapon = distanceToPlayer < 18 ? 'gatling' : distanceToPlayer < 38 ? 'cannon' : 'missile';
    if (this.weaponSwapTimer <= 0 && desiredWeapon !== this.activeWeapon) {
      this.activeWeapon = desiredWeapon;
      this.weaponSwapTimer = 2.4 + Math.random() * 1.2;
      this.onMessage?.(`CPU WEAPON // ${desiredWeapon.toUpperCase()}`);
    }

    // Proactive combat dash: evade the player's firing line or rapidly open
    // space at close range instead of waiting to be hit first.
    if (this.dashCooldown <= 0 && this.dashTimer <= 0 && targetVisible && this.energy >= 22 && distanceToPlayer < 34) {
      const dashChance = distanceToPlayer < 15 ? 1.15 : .48;
      if (Math.random() < dt * dashChance) {
        const away = this.group.position.clone().sub(predictedTarget).setY(0).normalize();
        const lateral = new THREE.Vector3(-away.z, 0, away.x).multiplyScalar(this.orbitDirection);
        this.dashDirection.copy(lateral.multiplyScalar(.82).addScaledVector(away, distanceToPlayer < 13 ? .72 : .18)).normalize();
        this.dashTimer = .3;
        this.dashCooldown = 2.7 + Math.random() * 1.4;
        this.energy = Math.max(0, this.energy - 22);
        this.orbitDirection *= -1;
      }
    }

    // Re-evaluate tactics at a controlled cadence so the CPU does not flicker
    // between pickup, chase and retreat every render frame.
    const healthRatio = this.health / this.maxHealth;
    const coverPoint = this.getCoverPoint?.(this.group.position, perceivedTarget);
    const pickupTarget = this.getPickupTarget?.(this.group.position);
    const pickupDist = pickupTarget ? pickupTarget.position.distanceTo(this.group.position) : Infinity;
    const wantsResupply = pickupTarget && pickupDist < 44 && this.resupplyTimer > 0 && distanceToPlayer > 18;
    const recentlyDamaged = this.time - this.lastDamageTime < 1.35;
    // Cover is a short emergency reset, not the default response to taking a
    // hit. At close range the CPU keeps fighting and uses dashes instead.
    const needsCover = coverPoint && distanceToPlayer > 14 && (this.state !== 'RETREAT' || this.retreatTimer > 0) && (
      healthRatio < .26 ||
      (recentlyDamaged && healthRatio < .38 && this.shield < 24)
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
        nextState = targetVisible && distanceToPlayer >= 15 && distanceToPlayer < 38 ? 'ENGAGE' : 'CHASE';
      } else {
        nextState = this.targetMemory > 0 ? 'SEARCH' : 'PATROL';
      }
      if (nextState !== this.state) {
        this.state = nextState;
        if (nextState === 'RETREAT') this.retreatTimer = 2.2 + Math.random() * .8;
        this.strafeBias = Math.random() * Math.PI * 2;
      }
      this.stateDecisionTimer = this.state === 'RETREAT' ? .32 : .5 + Math.random() * .22;
    }

    // AI Upgrade: Dynamic Navigation Target Selection
    let navigationTarget = predictedTarget;
    if (this.state === 'RETREAT') {
      const escapeDirection = this.group.position.clone().sub(perceivedTarget).setY(0);
      if (escapeDirection.lengthSq() < .01) escapeDirection.set(1, 0, 0);
      const escapePoint = this.group.position.clone().add(escapeDirection.normalize().multiplyScalar(18));
      navigationTarget = coverPoint || escapePoint;
    } else if (this.state === 'HUNT_PICKUP' && pickupTarget) {
      navigationTarget = pickupTarget.position;
    } else if (this.state === 'SEARCH') {
      navigationTarget = this.lastKnownTargetPosition;
    } else if (this.state === 'PATROL') {
      if (!this.patrolPoint || this.group.position.distanceTo(this.patrolPoint) < 4.0) {
        this.patrolPoint = new THREE.Vector3(
          Math.random() * 100 - 50,
          0,
          Math.random() * 100 - 50
        );
      }
      navigationTarget = this.patrolPoint;
    }

    const toTarget = navigationTarget.clone().sub(this.group.position);
    toTarget.y = 0;
    const navigationDistance = toTarget.length();

    // AI Upgrade: Jetpack Flight airborne state
    if (this.jetpackEquipped) {
      if (this.energy < 20) {
        this.isAirborne = false;
      } else if (this.energy > 58 && this.state !== 'RETREAT' && (this.state === 'CHASE' || this.state === 'SEARCH' || distanceToPlayer > 28)) {
        this.isAirborne = true;
      }
    } else {
      this.isAirborne = false;
    }

    // Movement Steering calculations
    let moved = false;
    if (this.dashTimer > 0) {
      // Active evading perpendicular dash
      this.dashTimer -= dt;
      const speed = 26; // High dash speed
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
      const right = new THREE.Vector3(-forward.z, 0, forward.x);
      const desired = new THREE.Vector3();

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
        const baseSpeed = this.jetpackEquipped && this.isAirborne ? 15 : 10.5;
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

        // Reverse orbit direction if movement is blocked to get unstuck
        if (!moved && this.state === 'ENGAGE') {
          this.orbitDirection = -this.orbitDirection;
          this.orbitTimer = 4.0 + Math.random() * 3.0;
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

    // Periodically flip orbiting direction
    if (this.state === 'ENGAGE' && this.orbitTimer <= 0) {
      this.orbitDirection = -this.orbitDirection;
      this.orbitTimer = 4.0 + Math.random() * 3.0;
    }

    // Hovering must read as a boost, not as walking in mid-air.
    const stride = moved && !this.isAirborne ? Math.sin(this.time * 8.2) : 0;
    const blend = 1 - Math.pow(.001, dt);
    if (this.legs?.length === 2) {
      this.legs[0].rotation.x = THREE.MathUtils.lerp(this.legs[0].rotation.x, -stride * .58, blend);
      this.legs[1].rotation.x = THREE.MathUtils.lerp(this.legs[1].rotation.x, stride * .58, blend);
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

    // AI Upgrade: airborne height calculations
    let desiredY = 0;
    if (this.jetpackEquipped && this.isAirborne) {
      // If dashing (swoop dash), drop altitude, otherwise hover high
      desiredY = (this.dashTimer > 0) ? 4.0 : 16.0;
    }
    this.group.position.y = THREE.MathUtils.lerp(this.group.position.y, desiredY, 1 - Math.pow(.12, dt));

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
      this.energy = Math.min(100, this.energy + 26 * dt);
      if (this.shield < 100) {
        this.shield = Math.min(100, this.shield + 15 * dt);
        this.shieldBubble.setStrength(this.shield / 100);
      }
      if (this.health < this.maxHealth) {
        this.health = Math.min(this.maxHealth, this.health + 8 * dt);
        this.drawHealth();
      }
    } else if (this.isAirborne) {
      this.energy = Math.max(0, this.energy - 10 * dt);
    } else if (moved) {
      this.energy = isRetreating
        ? Math.min(100, this.energy + 4 * dt)
        : Math.max(0, this.energy - 4 * dt);
    } else {
      this.energy = Math.min(100, this.energy + 12 * dt);
    }

    // AI Upgrade: Homing missile barrage launcher
    if (this.missileCooldown <= 0 && this.activeWeapon === 'missile' && (this.state === 'ENGAGE' || this.state === 'CHASE') && targetVisible && distanceToPlayer > 24 && this.missileSalvoLeft === 0) {
      this.missileSalvoLeft = 3;
      this.missileSalvoTimer = 0.15;
      this.missileCooldown = 12.0 + Math.random() * 4.0;
      this.onMessage?.('CPU: MISSILE SALVO!');
    }

    if (this.missileSalvoLeft > 0) {
      this.missileSalvoTimer -= dt;
      if (this.missileSalvoTimer <= 0) {
        this.fireHomingMissile();
        this.missileSalvoLeft--;
        this.missileSalvoTimer = 0.15;
      }
    }

    this.fireCooldown -= dt;
    // Basic cannons remain independent of the shoulder-missile salvo.
    if (this.fireCooldown <= 0 && this.activeWeapon !== 'missile' && !isRetreating && this.state !== 'HUNT_PICKUP' && this.energy >= 12) {
      const buildingTarget = this.getBuildingTarget?.(this.group.position);
      const attackBuilding = buildingTarget && Math.random() < .25;
      if ((targetVisible && distanceToPlayer < 52) || attackBuilding) {
        const relativeX = perceivedTarget.x - this.group.position.x;
        const relativeZ = perceivedTarget.z - this.group.position.z;
        const velocityX = this.targetVelocity.x;
        const velocityZ = this.targetVelocity.z;
        const a = velocityX * velocityX + velocityZ * velocityZ - this.shellSpeed * this.shellSpeed;
        const b = 2 * (relativeX * velocityX + relativeZ * velocityZ);
        const c = relativeX * relativeX + relativeZ * relativeZ;
        let leadTime = Math.sqrt(c) / this.shellSpeed;
        const discriminant = b * b - 4 * a * c;
        if (discriminant >= 0 && Math.abs(a) > .001) {
          const t1 = (-b - Math.sqrt(discriminant)) / (2 * a);
          const t2 = (-b + Math.sqrt(discriminant)) / (2 * a);
          const validTimes = [t1, t2].filter(time => time > 0);
          if (validTimes.length) leadTime = Math.min(...validTimes);
        }
        leadTime = THREE.MathUtils.clamp(leadTime, .2, 1.8);
        // Add limited range-dependent error: an AI should lead a target, not
        // become a perfect hitscan turret whenever line of sight is restored.
        const aimError = Math.min(3.2, Math.max(.35, distanceToPlayer * .045));
        const lateralError = new THREE.Vector3(-relativeZ, 0, relativeX).normalize()
          .multiplyScalar(Math.sin(this.time * 2.1 + this.strafeBias) * aimError);
        const predictedPlayerAim = perceivedTarget.clone()
          .addScaledVector(this.targetVelocity, leadTime)
          .add(lateralError)
          .add(new THREE.Vector3(0, 4.65, 0));
        this.fire(attackBuilding ? buildingTarget : predictedPlayerAim, targetVisible && !attackBuilding);
        this.fireCooldown = this.activeWeapon === 'gatling'
          ? .2 + Math.random() * .08
          : this.missileSalvoLeft > 0 ? .72 + Math.random() * .35 : 1 + Math.random() * .6;
      }
    }
  }
}

return EnemyAI;
};
