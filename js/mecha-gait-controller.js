// Standalone Mecha Gait & Reverse-Joint IK Controller
// Based on mecha_reverse_joint_walk.html sine-wave T-Rex walk system
// with cascading per-joint blend speeds and real-time tuning parameters.

window.createMechaGaitController = function createMechaGaitController(THREE, options = {}) {
  const {
    player,
    playerLegs,
    pelvis,
    pelvisVisualRig,
    hipSocketCarriers,
    waistRig,
    mechaAttachments,
    mechaMeshes,
    playerRigidBody,
    sampleFootGroundHeight,
    spawnFootstepEffect,
    playFootstepSound,
    reverseLegGroundOffset = -0.32,
    reverseFootLevelPitch = 0.78
  } = options;

  const baseWaistY = waistRig ? waistRig.position.y : 0;
  let enabled = true;
  let walkCycle = 0;
  let lastActiveStride = 0;
  const gaitCycles = [0, 0.5];

  // Foot Lock Hysteresis State
  const footLocked = [false, false];
  const footPlantWorld = [null, null];
  const previousFootWorld = [new THREE.Vector3(), new THREE.Vector3()];
  const footVelocityWorld = [new THREE.Vector3(), new THREE.Vector3()];

  // Constants
  const FOOT_LOCK_HEIGHT = 0.4;
  const FOOT_UNLOCK_HEIGHT = 0.18;
  const FOOT_LOCK_MAX_HORIZONTAL_SPEED = 1.8;
  const FOOT_LOCK_MAX_VERTICAL_SPEED = 0.20;

  // ====== REAL-TIME TUNING PARAMETERS (adjustable via UI sliders) ======
  // Based on mecha_reverse_joint_walk.html params
  const gaitParams = {
    walkSpeed: 0.35,      // 보행 속도 배율 (0.2 ~ 3.0)
    strideScale: 0.3,    // 보폭 배율 (0.3 ~ 2.0)
    bodyLean: 0.16,      // 몸통 전방 기울임 (0 ~ 0.3 rad)
    weightFeel: 0.8,     // 중량감/묵직함 (0.2 ~ 2.0)
    hipSwingAmount: 0.5, // 힙 스윙 각도 (0.1 ~ 1.2 rad)
    kneeBaseBend: 0.42,  // 무릎 기본 굽힘 (0.1 ~ 0.8 rad)
    kneeLiftBend: 1.15,  // 무릎 리프트 추가 굽힘 (0.5 ~ 3.0)
    bounceAmount: 0.18,  // 바운스 기본 세기 (0 ~ 0.5)
    rollAmount: 0.15,    // 좌우 롤 세기 (0 ~ 0.15)
    stepBounceAmount: 1.0, // 발 딛음 수직 바운스 세기 (0.0 ~ 1.0)
    sideShiftAmount: 0.52,  // 발 딛음 좌우 상체 이동 세기 (0.0 ~ 0.8)
    baseFootHeight: 0.60,   // 기본 발 높이 오프셋 (-1.5 ~ 1.5 m)
    stepHeightScale: 1.5,  // 보행 발 들림 높이 배율 (0.2 ~ 2.5)
    kneePosOffset: -0.22,  // 허벅지 아래 다리 길이 오프셋 (-1.5 ~ 1.5 m)
    shinLengthScale: 1.0,  // 정강이 다리 길이 배율 (0.5 ~ 2.0)
    // ====== 관절별 각도 수치 상세 조절 ======
    thighAngleOffset: -0.58, // 허벅지 각도 오프셋 (-1.0 ~ 0.5 rad)
    thighAngleScale: 1.05, // 허벅지 스윙 비율 (0.2 ~ 2.0)
    kneeAngleOffset: 0.0,  // 무릎 각도 오프셋 (-1.5 ~ 1.5 rad)
    shinAngleMult: 0.55,   // 정강이 연동 비율 (0.0 ~ 1.5)
    calfAngleMult: 0.30,   // 종아리 연동 비율 (0.0 ~ 1.0)
    footAngleOffset: -0.8,  // 발바닥 각도 오프셋 (-0.8 ~ 0.8 rad)
    toeCurlOffset: 0.08,    // 발가락 굽힘 오프셋 (-0.5 ~ 0.8 rad)
    toeCurlMult: 2.0,      // 발가락 굽힘 비율 (0.0 ~ 2.0)
  };
  // Expose globally for UI sliders
  window.mechaGaitParams = gaitParams;

  // Pre-allocated Vector & Quaternion Pool to prevent GC thrashing
  const pool = {
    footWorld: new THREE.Vector3(),
    currentFootWorld: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    localTarget: new THREE.Vector3(),
    worldTarget: new THREE.Vector3(),
    targetVector: new THREE.Vector3(),
    hipWorld: new THREE.Vector3(),
    targetLocal: new THREE.Vector3(),
    heelWorld: new THREE.Vector3(),
    frontWorld: new THREE.Vector3(),
    parentInvQuat: new THREE.Quaternion()
  };

  function smooth01(value) {
    const t = THREE.MathUtils.clamp(value, 0, 1);
    return t * t * (3 - 2 * t);
  }

  // Phase B: Sine-wave T-Rex Walk Trajectory
  // Based on mecha_reverse_joint_walk.html — proven sine-wave approach
  // hipSwing = sin(phase) * hipSwingAmount * stride
  // lift = pow(max(0, sin(phase)), 1.6) — snap feel on landing
  // kneeBend = baseBend + lift * liftBend — deep flex on swing, straighten on stance
  function evaluateTyrannoStep(phase, strideLength, stepHeight) {
    const { hipSwingAmount, kneeBaseBend, kneeLiftBend, weightFeel } = gaitParams;

    // Sine-wave driven hip swing (forward/backward)
    const hipSwing = Math.sin(phase) * hipSwingAmount * strideLength;

    // Lift: only positive half of sine, pow(1.6) gives snap on landing
    const liftRaw = Math.max(0, Math.sin(phase));
    const lift = Math.pow(liftRaw, 1.6) * stepHeight;

    // Reverse-joint knee: base bend + extra flex during swing
    const kneeBend = kneeBaseBend + lift / Math.max(0.01, stepHeight) * kneeLiftBend;

    // Ankle counter-rotation: flat on ground, toe-up during swing
    const anklePitch = -kneeBend * 0.6 + (lift / Math.max(0.01, stepHeight)) * 0.4;

    // Toe curl follows lift
    const toeCurl = (lift / Math.max(0.01, stepHeight)) * 0.35;

    // Support weight: inverse of lift (on ground = 1, in air = 0)
    const supportWeight = 1.0 - Math.min(1, lift / Math.max(0.01, stepHeight));

    // Foot pitch for IK target
    const footPitch = anklePitch * 0.5;

    return {
      forward: hipSwing,
      lift: lift * weightFeel * 0.35, // Scale lift for hip position
      kneeBend,
      anklePitch,
      footPitch,
      toeCurl,
      supportWeight,
      swingProgress: Math.max(0, lift / Math.max(0.01, stepHeight)),
      hipDrop: (1 - liftRaw) * 0.22 * weightFeel * supportWeight, // Drop when foot lands
      liftNormalized: lift / Math.max(0.01, stepHeight) // 0~1 normalized lift
    };
  }

  // Phase C: Foot Lock Hysteresis Update
  function updateFootLockState(index, dt, gaitState, grounded, dashing, turnRate, speedRatio, locomotionActive) {
    if (!playerLegs || !playerLegs[index]) return;
    const leg = playerLegs[index];
    const joints = leg.userData?.joints;
    if (!joints || !joints.foot) return;

    joints.foot.getWorldPosition(pool.currentFootWorld);
    const velocity = footVelocityWorld[index];

    if (dt > 0) {
      velocity.copy(pool.currentFootWorld).sub(previousFootWorld[index]).divideScalar(dt);
    } else {
      velocity.set(0, 0, 0);
    }
    previousFootWorld[index].copy(pool.currentFootWorld);

    const groundY = sampleFootGroundHeight ? sampleFootGroundHeight(pool.currentFootWorld) : 0;
    const footHeight = pool.currentFootWorld.y - groundY;
    const horizontalSpeed = Math.hypot(velocity.x, velocity.z);

    const baseHeightOffset = gaitParams.baseFootHeight || 0;
    const lockMaxHeight = Math.max(0.65, FOOT_LOCK_HEIGHT + baseHeightOffset);
    const unlockMaxHeight = Math.max(0.85, FOOT_UNLOCK_HEIGHT + baseHeightOffset + 0.35);

    if (!footLocked[index]) {
      const canPlant = grounded &&
        gaitState.supportWeight > 0.45 &&
        footHeight <= lockMaxHeight &&
        velocity.y <= FOOT_LOCK_MAX_VERTICAL_SPEED &&
        horizontalSpeed <= FOOT_LOCK_MAX_HORIZONTAL_SPEED;

      if (canPlant) {
        footLocked[index] = true;
        footPlantWorld[index] = pool.currentFootWorld.clone();
        // Settling a stationary foot is not a step. Keep the lock, but only
        // emit audio and the ground shockwave while locomotion is active.
        if (locomotionActive) {
          if (typeof playFootstepSound === 'function') playFootstepSound();
          if (typeof spawnFootstepEffect === 'function') spawnFootstepEffect(pool.currentFootWorld);
        }
      }
    } else {
      const shouldRelease = gaitState.swingProgress > 0.08 ||
        footHeight >= unlockMaxHeight ||
        !grounded ||
        dashing ||
        turnRate > 0.78;

      if (shouldRelease) {
        footLocked[index] = false;
        footPlantWorld[index] = null;
      }
    }
  }

  // Foot Terrain Pitch Calculation
  function getFootTerrainPitch(joints) {
    if (!joints || !joints.foot || typeof sampleFootGroundHeight !== 'function') return 0;
    joints.foot.localToWorld(pool.heelWorld.set(0, -0.31, -0.72));
    joints.foot.localToWorld(pool.frontWorld.set(0, -0.31, 1.02));

    const heelGround = sampleFootGroundHeight(pool.heelWorld);
    const frontGround = sampleFootGroundHeight(pool.frontWorld);

    return -Math.atan2(frontGround - heelGround, 1.74);
  }

  // Phase E: Direct Joint Drive (from mecha_reverse_joint_walk.html)
  // Instead of IK solver, directly apply kneeBend and anklePitch from gait state
  // Each joint has DIFFERENT response speed = cascading articulated motion
  function applyDirectJointDrive(joints, gaitState, dt) {
    if (!joints || !joints.thigh || !joints.knee || !joints.shin) return;

    const {
      thighAngleOffset = 0, thighAngleScale = 1.0,
      kneeAngleOffset = 0,
      kneePosOffset = 0.0,
      shinLengthScale = 1.0,
      shinAngleMult = 0.55,
      calfAngleMult = 0.30,
      footAngleOffset = 0,
      toeCurlOffset = 0, toeCurlMult = 1.0
    } = gaitParams;

    // ====== CASCADING BLEND SPEEDS (the key to visible articulation) ======
    const thighBlend = 1 - Math.exp(-12 * dt);  // Fastest — hip actuator
    const kneeBlend = 1 - Math.exp(-7 * dt);   // Medium — heavy knee actuator
    const shinBlend = 1 - Math.exp(-4.5 * dt);  // Slow — trailing segment
    const calfBlend = 1 - Math.exp(-3.5 * dt);  // Slowest — whip trail
    const footBlend = 1 - Math.exp(-4 * dt);   // Slow — trailing foot
    const toeBlend = 1 - Math.exp(-3 * dt);    // Slowest — toe trail

    // Thigh: hip swing drives primary stride (from gaitState.forward as angle)
    const thighTarget = gaitState.forward * thighAngleScale + thighAngleOffset;
    joints.thigh.rotation.x = THREE.MathUtils.lerp(joints.thigh.rotation.x, thighTarget, thighBlend);
    joints.thigh.rotation.y = 0;
    joints.thigh.rotation.z = 0;

    // Knee: position offset along thigh (directly below thigh) & reverse-joint bend
    if (joints.knee.userData.basePosY === undefined) {
      joints.knee.userData.basePosY = joints.knee.position.y;
    }
    const targetKneePosY = joints.knee.userData.basePosY - kneePosOffset;
    joints.knee.position.y = THREE.MathUtils.lerp(joints.knee.position.y, targetKneePosY, kneeBlend);

    const kneeTarget = gaitState.kneeBend + kneeAngleOffset;
    joints.knee.rotation.x = THREE.MathUtils.lerp(joints.knee.rotation.x, kneeTarget, kneeBlend);
    joints.knee.rotation.y = 0;
    joints.knee.rotation.z = 0;

    // Shin: length scale & counter-flex to maintain Z-silhouette
    if (joints.ankle && joints.ankle.userData.basePosY === undefined) {
      joints.ankle.userData.basePosY = joints.ankle.position.y;
    }
    if (joints.ankle) {
      const targetAnklePosY = joints.ankle.userData.basePosY * shinLengthScale;
      joints.ankle.position.y = THREE.MathUtils.lerp(joints.ankle.position.y, targetAnklePosY, shinBlend);
    }

    const shinTarget = -kneeTarget * shinAngleMult;
    joints.shin.rotation.x = THREE.MathUtils.lerp(joints.shin.rotation.x, shinTarget, shinBlend);
    joints.shin.rotation.y = 0;
    joints.shin.rotation.z = 0;

    // RearCalf: trailing whip segment
    if (joints.rearCalf) {
      const calfTarget = -kneeTarget * calfAngleMult;
      joints.rearCalf.rotation.x = THREE.MathUtils.lerp(joints.rearCalf.rotation.x, calfTarget, calfBlend);
      joints.rearCalf.rotation.y = 0;
      joints.rearCalf.rotation.z = 0;
    }

    // Foot: ankle counter-rotation (flat on ground, toe-up on swing)
    if (joints.foot) {
      const terrainPitch = getFootTerrainPitch(joints);
      // Ground contact factor: 1.0 when planted on ground, 0.0 when swinging in air
      const groundContact = THREE.MathUtils.clamp(1.0 - (gaitState.liftNormalized || 0) * 3.0, 0, 1);

      // Swing pitch: reference anklePitch tilt during airborne phase
      const swingPitch = reverseFootLevelPitch + gaitState.anklePitch + footAngleOffset;
      // Planted pitch: cancels all parent leg rotations (thigh, knee, shin) to keep sole 100% flat on ground
      const totalParentPitch = joints.thigh.rotation.x + joints.knee.rotation.x + joints.shin.rotation.x;
      const plantedPitch = reverseFootLevelPitch - totalParentPitch + terrainPitch + footAngleOffset;
      const footTarget = THREE.MathUtils.lerp(swingPitch, plantedPitch, groundContact);

      joints.foot.rotation.x = THREE.MathUtils.lerp(joints.foot.rotation.x, footTarget, footBlend);
      joints.foot.rotation.y = 0;
      joints.foot.rotation.z = 0;
    }

    // Toes: curl trail
    if (joints.toePivots) {
      const targetToeCurl = gaitState.toeCurl * toeCurlMult + toeCurlOffset;
      for (const toePivot of joints.toePivots) {
        toePivot.rotation.x = THREE.MathUtils.lerp(toePivot.rotation.x, targetToeCurl, toeBlend);
      }
    }
  }

  // Main Gait Controller Update Call
  function update(params = {}) {
    if (!enabled || !playerLegs || playerLegs.length < 2) return;

    const {
      dt = 0.016,
      actualGroundSpeed = 0,
      locomotionSpeed = 0,
      grounded = true,
      dashing = false,
      isReversing = false,
      turnRate = 0,
      turnStability = 1,
      landingImpact = 0,
      speedRatio = 0,
      rotationBeforeMove = 0
    } = params;

    const { walkSpeed, strideScale: userStride, bodyLean, weightFeel,
      bounceAmount, rollAmount, baseFootHeight = 0.0, stepHeightScale = 1.0 } = gaitParams;

    // Phase A: Cycle timing — continuous phase persistence (no snap-reset to 0 on stop)
    const walking = actualGroundSpeed > 0.35 && grounded;
    const turningInPlace = grounded && actualGroundSpeed < 0.70 && turnRate > 0.18 && !dashing;
    const gaitRate = THREE.MathUtils.lerp(0.18, 0.28, Math.min(1, speedRatio)) * walkSpeed;

    if (walking || turningInPlace) {
      const advanceSpeed = walking ? actualGroundSpeed : turnRate * 2.0;
      walkCycle += advanceSpeed * dt * gaitRate;
    }
    // Note: walkCycle is NOT reset to 0 when stopping; it holds the exact step phase.

    // Convert walkCycle to radians (continuous sine phase, NOT modular 0~1)
    const cyclePhase = walkCycle * Math.PI * 1.6;

    const strideScale = THREE.MathUtils.lerp(0.82, 1.0, Math.min(1, speedRatio)) * userStride * (dashing ? 1.05 : 1);
    const walkBlend = THREE.MathUtils.clamp((locomotionSpeed - 0.25) / 2.2, 0, 1);
    const strideReach = THREE.MathUtils.lerp(1.2, 3.5, Math.min(1, speedRatio));
    const stepHeight = THREE.MathUtils.lerp(0.55, 0.85, Math.min(1, speedRatio)) * stepHeightScale;

    const movementDirection = isReversing ? -1 : 1;
    const turnDirection = Math.sign(angleDelta(rotationBeforeMove, player ? player.rotation.y : 0)) || 1;
    const turnStepReach = THREE.MathUtils.clamp(turnRate * 0.72, 0.18, 0.68);
    const turnStrideScale = THREE.MathUtils.lerp(0.28, 1, turnStability);

    // Track active stride while walking/turning; hold current stance stride when stopping
    if (walking || turningInPlace) {
      lastActiveStride = strideReach * strideScale * Math.max(0.35, walkBlend) * turnStrideScale * movementDirection;
    }
    const effectiveStride = (walking || turningInPlace)
      ? strideReach * strideScale * walkBlend * turnStrideScale * movementDirection
      : lastActiveStride;

    // Evaluate gait for each leg
    const gaitStates = [
      evaluateTyrannoStep(cyclePhase, effectiveStride, stepHeight),
      evaluateTyrannoStep(cyclePhase + Math.PI, effectiveStride, stepHeight)
    ];

    // When stopped, smoothly settle any airborne foot down onto the ground while keeping stance
    if (!walking && !turningInPlace) {
      const settleFactor = Math.exp(-10 * dt);
      gaitStates[0].lift *= settleFactor;
      gaitStates[1].lift *= settleFactor;
      gaitStates[0].swingProgress *= settleFactor;
      gaitStates[1].swingProgress *= settleFactor;
      gaitStates[0].supportWeight = 1.0;
      gaitStates[1].supportWeight = 1.0;
    }

    // In-Place Turning
    if (turningInPlace) {
      const turnPhase = walkCycle * Math.PI * 2;
      gaitStates[0].forward = -turnDirection * turnStepReach * Math.sin(turnPhase);
      gaitStates[1].forward = turnDirection * turnStepReach * Math.sin(turnPhase);
      gaitStates[0].lift *= 0.72;
      gaitStates[1].lift *= 0.72;
    }

    // Foot Lock Update
    player.updateWorldMatrix(true, true);
    for (let index = 0; index < 2; index++) {
      updateFootLockState(index, dt, gaitStates[index], grounded, dashing, turnRate, speedRatio, walking || turningInPlace || dashing);
    }

    // ====== ENHANCED T-REX PELVIS BOUNCE & UPPER BODY WEIGHT SHIFT ======
    if (pelvis && pelvisVisualRig) {
      const { bounceAmount = 0.18, rollAmount = 0.05, stepBounceAmount = 0.35, sideShiftAmount = 0.25 } = gaitParams;

      // 1. Dual-Phase Vertical Bounce Dynamics:
      // - Landing Down-bounce: sharp dip when foot impacts ground (weight acceptance / heel strike)
      // - Rear-leg Swing Up-bounce: vaulting rise when rear leg swings forward past stance leg (mid-stance passing)
      const landingPulse = Math.pow(Math.abs(Math.sin(cyclePhase)), 1.6);
      const vaultingPulse = Math.max(0, Math.cos(cyclePhase * 2));

      const downBounce = -landingPulse * stepBounceAmount * 0.45 * weightFeel * walkBlend;
      const upBounce = vaultingPulse * bounceAmount * 0.55 * weightFeel * walkBlend;
      const verticalBounce = downBounce + upBounce;
      window.mechaGaitBounce = verticalBounce;

      const pelvisBaseY = mechaMeshes.pelvis.position[1];
      pelvis.position.y = THREE.MathUtils.lerp(
        pelvis.position.y,
        pelvisBaseY + verticalBounce,
        1 - Math.exp(-9 * dt) // Responsive impact compression & vaulting rise
      );

      // 2. Center of Gravity (COG) Lateral Weight Shift (Upper body / Pelvis moves towards planted foot)
      const lateralPhase = Math.sin(cyclePhase);
      const lateralShiftX = lateralPhase * sideShiftAmount * 1.2 * weightFeel * walkBlend;

      pelvis.position.x = THREE.MathUtils.lerp(
        pelvis.position.x,
        mechaMeshes.pelvis.position[0] + lateralShiftX,
        1 - Math.exp(-6 * dt)
      );

      // 3. Pelvic Yaw & Torso Counter-rotation
      const strideForwardDiff = gaitStates[0].forward - gaitStates[1].forward;
      const pelvisStepYaw = THREE.MathUtils.clamp(-strideForwardDiff * 0.35, -0.48, 0.48);
      pelvis.rotation.y = THREE.MathUtils.lerp(pelvis.rotation.y, pelvisStepYaw, 1 - Math.exp(-5 * dt));
      pelvisVisualRig.rotation.y = THREE.MathUtils.lerp(pelvisVisualRig.rotation.y, pelvisStepYaw * 0.45, 1 - Math.exp(-6 * dt));

      // Upper Body (waistRig) sway & counter-tilt & vertical bounce coordination
      if (waistRig) {
        waistRig.position.y = THREE.MathUtils.lerp(
          waistRig.position.y,
          baseWaistY + baseFootHeight + verticalBounce * 0.65,
          1 - Math.exp(-9 * dt)
        );
        waistRig.rotation.y = THREE.MathUtils.lerp(waistRig.rotation.y, -pelvis.rotation.y * 0.85, 1 - Math.exp(-8 * dt));
        // Upper body COG side shift + counter roll
        waistRig.position.x = THREE.MathUtils.lerp(waistRig.position.x, lateralShiftX * 0.45, 1 - Math.exp(-6 * dt));
        waistRig.rotation.z = THREE.MathUtils.lerp(waistRig.rotation.z, -lateralPhase * rollAmount * 1.8 * weightFeel * walkBlend, 1 - Math.exp(-5 * dt));
      }

      // 4. Side-to-side Roll (dinosaur / heavy mech weight sway)
      pelvis.rotation.z = THREE.MathUtils.lerp(
        pelvis.rotation.z,
        lateralPhase * rollAmount * weightFeel * walkBlend,
        1 - Math.exp(-4.5 * dt)
      );

      // 5. Forward Pitch Wobble
      const pitchTarget = bodyLean * walkBlend + Math.sin(cyclePhase * 2) * 0.04 * weightFeel * walkBlend;
      pelvis.rotation.x = THREE.MathUtils.lerp(pelvis.rotation.x, pitchTarget, 1 - Math.exp(-5 * dt));
    }

    // 1. Initial leg root positioning & joint drive evaluation
    for (let index = 0; index < 2; index++) {
      const attachment = index === 0 ? mechaAttachments.leftLeg : mechaAttachments.rightLeg;
      const leg = playerLegs[index];

      // Base leg position
      leg.position.set(attachment[0], attachment[1] + reverseLegGroundOffset, attachment[2]);

      // Swing lift during airborne phase
      leg.position.y += gaitStates[index].lift * weightFeel * walkBlend;

      const turnLegYaw = turningInPlace ? (index === 0 ? turnDirection * 0.12 : -turnDirection * 0.12) : 0;
      leg.rotation.set(0, -pelvis.rotation.y + turnLegYaw, 0);
    }

    // Direct Joint Drive — apply thigh, knee, shin, foot angles first
    for (let index = 0; index < 2; index++) {
      const leg = playerLegs[index];
      const joints = leg.userData?.joints;
      if (joints) {
        applyDirectJointDrive(joints, gaitStates[index], dt);
      }
    }

    // 2. Post-Joint-Drive Ground Stance Clamping (Safe, Bounded Y Ground Contact)
    player.updateWorldMatrix(true, true);
    for (let index = 0; index < 2; index++) {
      const leg = playerLegs[index];
      const joints = leg.userData?.joints;

      if (joints && joints.foot && grounded) {
        joints.foot.getWorldPosition(pool.currentFootWorld);
        const groundY = sampleFootGroundHeight ? sampleFootGroundHeight(pool.currentFootWorld) : 0;
        const currentFootY = pool.currentFootWorld.y;
        const footHeightError = currentFootY - groundY;

        const stanceWeight = gaitStates[index].supportWeight || 0;
        if (stanceWeight > 0.01) {
          // Bounded Y Height Correction: Prevents any matrix feedback corruption or leg disappearance
          const safeCorrectionY = THREE.MathUtils.clamp(footHeightError, -0.6, 0.8) * stanceWeight * 0.95;
          leg.position.y -= safeCorrectionY;
        }
      }
    }

    player.updateWorldMatrix(true, true);

    if (hipSocketCarriers) {
      for (let index = 0; index < hipSocketCarriers.length; index++) {
        const carrier = hipSocketCarriers[index];
        carrier.position.set(0, 0, 0);
        carrier.rotation.set(0, 0, 0);
      }
    }
  }

  function angleDelta(current, target) {
    let diff = (target - current) % (Math.PI * 2);
    if (diff < -Math.PI) diff += Math.PI * 2;
    if (diff > Math.PI) diff -= Math.PI * 2;
    return diff;
  }

  function reset() {
    walkCycle = 0;
    lastActiveStride = 0;
    footLocked[0] = false;
    footLocked[1] = false;
    footPlantWorld[0] = null;
    footPlantWorld[1] = null;
    previousFootWorld[0].set(0, 0, 0);
    previousFootWorld[1].set(0, 0, 0);
    footVelocityWorld[0].set(0, 0, 0);
    footVelocityWorld[1].set(0, 0, 0);

    if (playerLegs && mechaAttachments) {
      for (let index = 0; index < playerLegs.length; index++) {
        const leg = playerLegs[index];
        if (!leg) continue;
        const initialPos = index === 0 ? mechaAttachments.leftLeg : mechaAttachments.rightLeg;
        if (initialPos) {
          leg.position.fromArray(initialPos);
          leg.position.y += reverseLegGroundOffset;
        }
        leg.rotation.set(0, 0, 0);

        const joints = leg.userData?.joints;
        if (joints) {
          const restoreJoint = (joint) => {
            if (!joint) return;
            if (joint.userData.initialPosition) joint.position.copy(joint.userData.initialPosition);
            if (joint.userData.initialRotation) joint.rotation.copy(joint.userData.initialRotation);
          };
          restoreJoint(joints.thigh);
          restoreJoint(joints.knee);
          restoreJoint(joints.shin);
          restoreJoint(joints.rearCalf);
          restoreJoint(joints.ankle);
          restoreJoint(joints.foot);
          for (const toePivot of joints.toePivots || []) restoreJoint(toePivot);
          if (joints.knee?.userData.initialPosition) {
            joints.knee.userData.basePosY = joints.knee.userData.initialPosition.y;
          }
          if (joints.ankle?.userData.initialPosition) {
            joints.ankle.userData.basePosY = joints.ankle.userData.initialPosition.y;
          }
        }
      }
    }

    if (pelvis) pelvis.rotation.set(0, 0, 0);
    if (pelvisVisualRig) {
      pelvisVisualRig.position.set(0, 0, 0);
      pelvisVisualRig.rotation.set(0, 0, 0);
    }
    if (hipSocketCarriers) {
      for (const carrier of hipSocketCarriers) {
        carrier.position.set(0, 0, 0);
        carrier.rotation.set(0, 0, 0);
      }
    }
  }

  return {
    update,
    reset,
    setEnabled: (val) => { enabled = !!val; },
    getFootLockedState: () => [...footLocked]
  };
};
