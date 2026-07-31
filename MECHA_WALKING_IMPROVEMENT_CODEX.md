# MECHA WALKING IMPROVEMENT SPEC

## 0. 목적

현재 `index.html`에 구현된 메인 메카의 역관절 보행 애니메이션을 개선한다.

현재 시스템에는 이미 다음 기능이 존재한다.

- 이동 거리 기반 `walkCycle`
- 좌우 180도 위상차 보행
- stance / swing 구간
- 발 착지 위치 저장 `footPlantWorld`
- 지면 높이 Raycast
- 발목 지면 경사 보정
- 골반·허리 서스펜션
- 착지 충격과 발소리
- 역관절 허벅지·무릎·정강이·발목 연동

그러나 현재는 다리 루트 자체를 이동해 발을 고정하기 때문에 관절이 골반에서 빠져 보이거나, 보폭이 과장되고, 회전 및 후진 시 발이 미끄러지는 문제가 발생할 수 있다.

최종 목표는 다음과 같다.

1. 8m급 중장갑 메카답게 무겁고 안정적인 보행
2. 발바닥이 지면에 붙는 느낌 강화
3. 골반과 고관절의 분리 현상 제거
4. 전진·후진·제자리 회전을 각각 자연스럽게 처리
5. 낮은 프레임에서도 보행 위상이 무너지지 않도록 유지
6. 기존 전투, 점프, 대시, 부위 손상 시스템을 깨뜨리지 않음

---

# 1. 현재 코드에서 수정할 핵심 변수

현재 보행 코드에서 사용 중인 주요 값:

```js
const gaitDistanceRate = .58;
const stanceDuration = .76;
const WALK_STEP_LIFT = .62;
const pelvisStepYaw = (rightLift - leftLift) * .72;
const supportShift = leftLift > .025 ? .16 : rightLift > .025 ? -.16 : 0;
```

현재 발 고정 보정:

```js
leg.position.x += correctionX;
leg.position.z += correctionZ;
```

또는 실제 코드의 다음 구조:

```js
const currentFootWorld = joints.foot.getWorldPosition(new THREE.Vector3());
const plantDelta = footPlantWorld[index].clone().sub(currentFootWorld);
plantDelta.y = 0;

const parentInverseRotation = leg.parent
  .getWorldQuaternion(new THREE.Quaternion())
  .invert();

plantDelta.applyQuaternion(parentInverseRotation);

leg.position.x += THREE.MathUtils.clamp(
  plantDelta.x,
  -maxCorrection,
  maxCorrection
) * stanceWeight;

leg.position.z += THREE.MathUtils.clamp(
  plantDelta.z,
  -maxCorrection,
  maxCorrection
) * stanceWeight;
```

이 로직은 임시 보정으로는 효과가 있지만, 다리 전체 루트가 골반 연결점에서 이동하기 때문에 장기적으로 제거해야 한다.

---

# 2. 1단계: 즉시 체감되는 파라미터 수정

먼저 전체 구조를 크게 바꾸기 전에 보행 리듬부터 개선한다.

## 변경 전

```js
const stanceDuration = .76;
const WALK_STEP_LIFT = .62;
```

## 변경 후

```js
const stanceDuration = THREE.MathUtils.lerp(
  0.70,
  0.62,
  Math.min(1, speedRatio)
);

const WALK_STEP_LIFT = THREE.MathUtils.lerp(
  0.28,
  0.42,
  Math.min(1, speedRatio)
);
```

## 의도

- 저속에서는 한 발을 오래 지지해 무거운 느낌 유지
- 고속에서는 swing 시간을 확보해 발이 급하게 튀지 않게 함
- 발 높이를 과도하게 들지 않음
- 빠를수록 보폭과 발 높이를 조금만 증가시킴

## gaitDistanceRate 조정

현재:

```js
const gaitDistanceRate = .58;
```

추천:

```js
const gaitDistanceRate = THREE.MathUtils.lerp(
  0.46,
  0.58,
  Math.min(1, speedRatio)
);
```

저속에서는 발을 천천히 옮기고, 속도가 올라갈수록 현재 cadence에 가까워진다.

---

# 3. 2단계: 후진 보행 수정

현재는 후진 시 `walkCycle` 자체를 역방향으로 돌린다.

## 제거 대상

```js
if (walking) {
  walkCycle += actualGroundSpeed
    * dt
    * gaitDistanceRate
    * (isReversing ? -1 : 1);
}
```

## 교체

```js
if (walking) {
  walkCycle += actualGroundSpeed * dt * gaitDistanceRate;
}
```

보폭 방향만 뒤집는다.

```js
const movementDirection = isReversing ? -1 : 1;
const reverseStrideScale = isReversing ? 0.72 : 1.0;
const reverseLiftScale = isReversing ? 0.82 : 1.0;
```

발 목표 계산:

```js
const signedStride =
  gaitFore[index]
  * strideReach
  * strideScale
  * walkBlend
  * turnStrideScale
  * movementDirection
  * reverseStrideScale;

const targetZ =
  baseAttachment[2]
  + signedStride;
```

발 높이:

```js
const lift =
  gaitLift[index]
  * reverseLiftScale;
```

## 기대 결과

- 후진 시 애니메이션 역재생 느낌 제거
- 발목과 발끝 동작이 뒤집히지 않음
- 후진 보폭이 짧고 안정적으로 보임

---

# 4. 3단계: 발 궤적을 4단계로 분리

기존 stance / swing 2단계 보행을 다음 4단계로 분리한다.

1. Heel Strike
2. Full Support
3. Toe Off
4. Swing Recovery

## 신규 함수 추가

```js
function smooth01(value) {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function evaluateHeavyMechStep(
  phase,
  strideLength,
  stepHeight
) {
  let forward = 0;
  let lift = 0;
  let footPitch = 0;
  let toeCurl = 0;
  let supportWeight = 0;
  let swingProgress = 0;

  // 0.00 ~ 0.10 : 뒤꿈치 착지
  if (phase < 0.10) {
    const t = smooth01(phase / 0.10);

    forward = THREE.MathUtils.lerp(
      strideLength,
      strideLength * 0.82,
      t
    );

    lift = THREE.MathUtils.lerp(
      stepHeight * 0.14,
      0,
      t
    );

    footPitch = THREE.MathUtils.lerp(
      -0.18,
      0,
      t
    );

    supportWeight = t;
  }

  // 0.10 ~ 0.58 : 발바닥 전체 지지
  else if (phase < 0.58) {
    const t = (phase - 0.10) / 0.48;

    forward = THREE.MathUtils.lerp(
      strideLength * 0.82,
      -strideLength * 0.72,
      t
    );

    lift = 0;
    footPitch = 0;
    toeCurl = 0;
    supportWeight = 1;
  }

  // 0.58 ~ 0.68 : 발끝 밀기
  else if (phase < 0.68) {
    const t = smooth01(
      (phase - 0.58) / 0.10
    );

    forward = THREE.MathUtils.lerp(
      -strideLength * 0.72,
      -strideLength,
      t
    );

    lift = THREE.MathUtils.lerp(
      0,
      stepHeight * 0.12,
      t
    );

    footPitch = THREE.MathUtils.lerp(
      0,
      0.22,
      t
    );

    toeCurl = THREE.MathUtils.lerp(
      0,
      0.34,
      t
    );

    supportWeight = 1 - t;
  }

  // 0.68 ~ 1.00 : 발 회수 및 전진
  else {
    const t = smooth01(
      (phase - 0.68) / 0.32
    );

    swingProgress = t;

    forward = THREE.MathUtils.lerp(
      -strideLength,
      strideLength,
      t
    );

    lift =
      Math.pow(
        Math.sin(t * Math.PI),
        1.35
      ) * stepHeight;

    footPitch = THREE.MathUtils.lerp(
      0.22,
      -0.15,
      t
    );

    toeCurl = THREE.MathUtils.lerp(
      0.22,
      -0.08,
      t
    );

    supportWeight = 0;
  }

  return {
    forward,
    lift,
    footPitch,
    toeCurl,
    supportWeight,
    swingProgress
  };
}
```

## 기존 gait 배열 교체

기존:

```js
const gaitLift = [0, 0];
const gaitFore = [0, 0];
const gaitStance = [0, 0];
const gaitSwing = [0, 0];
```

교체:

```js
const gaitStates = [null, null];

for (let index = 0; index < 2; index++) {
  const phase = gaitCycles[index];

  const movementDirection =
    isReversing ? -1 : 1;

  const reverseStrideScale =
    isReversing ? 0.72 : 1;

  const reverseLiftScale =
    isReversing ? 0.82 : 1;

  gaitStates[index] = evaluateHeavyMechStep(
    phase,
    strideReach
      * strideScale
      * movementDirection
      * reverseStrideScale,
    WALK_STEP_LIFT
      * reverseLiftScale
  );
}
```

사용 예시:

```js
const leftLift = gaitStates[0].lift;
const rightLift = gaitStates[1].lift;
```

---

# 5. 4단계: 발 고정 히스테리시스 추가

현재는 stance / swing 구간만으로 `footPlantWorld`를 켜고 끈다.

이 방식은 경계 프레임에서 발이 빠르게 lock / unlock 되는 문제가 있다.

## 신규 상태 배열

```js
const footLocked = [false, false];
const previousFootWorld = [
  new THREE.Vector3(),
  new THREE.Vector3()
];

const footVelocityWorld = [
  new THREE.Vector3(),
  new THREE.Vector3()
];
```

## 설정값

```js
const FOOT_LOCK_HEIGHT = 0.055;
const FOOT_UNLOCK_HEIGHT = 0.18;
const FOOT_LOCK_MAX_HORIZONTAL_SPEED = 1.8;
const FOOT_LOCK_MAX_VERTICAL_SPEED = 0.20;
```

## 업데이트 함수

```js
function updateFootLockState(index, dt, gaitState) {
  const leg = playerLegs[index];
  const joints = leg.userData.joints;

  const currentFootWorld =
    joints.foot.getWorldPosition(
      new THREE.Vector3()
    );

  const velocity =
    footVelocityWorld[index];

  if (dt > 0) {
    velocity.copy(currentFootWorld)
      .sub(previousFootWorld[index])
      .divideScalar(dt);
  } else {
    velocity.set(0, 0, 0);
  }

  previousFootWorld[index].copy(
    currentFootWorld
  );

  const groundY =
    sampleFootGroundHeight(currentFootWorld);

  const footHeight =
    currentFootWorld.y - groundY;

  const horizontalSpeed =
    Math.hypot(
      velocity.x,
      velocity.z
    );

  if (!footLocked[index]) {
    const canPlant =
      grounded
      && gaitState.supportWeight > 0.65
      && footHeight <= FOOT_LOCK_HEIGHT
      && velocity.y <= FOOT_LOCK_MAX_VERTICAL_SPEED
      && horizontalSpeed <= FOOT_LOCK_MAX_HORIZONTAL_SPEED;

    if (canPlant) {
      footLocked[index] = true;

      footPlantWorld[index] =
        currentFootWorld.clone();

      playGameSound('footstep');
      spawnFootstepEffect(
        currentFootWorld
      );

      bodyBounceVelocity -=
        0.30
        + Math.min(0.65, speedRatio) * 0.26;
    }
  } else {
    const shouldRelease =
      gaitState.swingProgress > 0.04
      || footHeight >= FOOT_UNLOCK_HEIGHT
      || !grounded
      || dashing
      || turnRate > 0.78;

    if (shouldRelease) {
      footLocked[index] = false;
      footPlantWorld[index] = null;
    }
  }
}
```

## 호출 위치

보행 상태 계산 후, 실제 발 고정 보정을 하기 전에 호출한다.

```js
player.updateWorldMatrix(true, true);

for (let index = 0; index < 2; index++) {
  updateFootLockState(
    index,
    dt,
    gaitStates[index]
  );
}
```

## 초기화 코드에도 추가

리스폰, 레벨 재시작, 점프 시작 시:

```js
footLocked[0] = false;
footLocked[1] = false;

footPlantWorld[0] = null;
footPlantWorld[1] = null;

footVelocityWorld[0].set(0, 0, 0);
footVelocityWorld[1].set(0, 0, 0);
```

---

# 6. 5단계: 골반 이동을 연속 가중치 방식으로 변경

현재:

```js
const supportShift =
  leftLift > .025
    ? .16
    : rightLift > .025
      ? -.16
      : 0;
```

이 방식은 특정 높이를 넘는 순간 골반이 갑자기 이동한다.

## 제거

```js
const supportShift =
  leftLift > .025
    ? .16
    : rightLift > .025
      ? -.16
      : 0;
```

## 교체

```js
const leftSupport =
  gaitStates[0].supportWeight;

const rightSupport =
  gaitStates[1].supportWeight;

const totalSupport =
  Math.max(
    0.001,
    leftSupport + rightSupport
  );

const leftBaseX =
  mechaAttachments.leftLeg[0];

const rightBaseX =
  mechaAttachments.rightLeg[0];

const supportCenterX =
  (
    leftBaseX * leftSupport
    + rightBaseX * rightSupport
  ) / totalSupport;

const centerBaseX =
  (leftBaseX + rightBaseX) * 0.5;

const supportShift =
  THREE.MathUtils.clamp(
    (supportCenterX - centerBaseX) * 0.11,
    -0.13,
    0.13
  );
```

골반 위치:

```js
pelvis.position.x =
  THREE.MathUtils.damp(
    pelvis.position.x,
    mechaMeshes.pelvis.position[0]
      + supportShift
      + pelvisSide * 0.018,
    7,
    dt
  );
```

---

# 7. 6단계: pelvisStepYaw 감소

현재:

```js
const pelvisStepYaw =
  (rightLift - leftLift) * .72;
```

과도한 회전값이므로 다음으로 교체한다.

```js
const pelvisStepYaw =
  THREE.MathUtils.clamp(
    (
      gaitStates[1].lift
      - gaitStates[0].lift
    ) * 0.24,
    -0.12,
    0.12
  );
```

중장갑 메카의 골반은 크게 흔들리지 않고, 다리가 골반 아래에서 움직이는 느낌이어야 한다.

## 골반 Roll 감소

현재 `pelvisSide` 기반 좌우 회전도 약간 줄인다.

추천:

```js
pelvis.rotation.z =
  THREE.MathUtils.damp(
    pelvis.rotation.z,
    -pelvisSide * 0.022,
    8,
    dt
  );
```

---

# 8. 7단계: 제자리 회전 보행 추가

현재는 회전 중 발 고정이 해제되고, 전진 보행 stride가 줄어드는 방식이다.

제자리 회전은 별도 gait 모드로 처리한다.

## 상태 판정

```js
const turningInPlace =
  grounded
  && actualGroundSpeed < 0.70
  && turnRate > 0.18
  && !dashing;
```

## 회전 전용 보폭

```js
const turnDirection =
  Math.sign(
    angleDelta(
      rotationBeforeMove,
      player.rotation.y
    )
  ) || 1;

const turnStepReach =
  THREE.MathUtils.clamp(
    turnRate * 0.72,
    0.18,
    0.68
  );
```

좌우 발을 반대 방향으로 이동시킨다.

```js
if (turningInPlace) {
  gaitStates[0].forward =
    -turnDirection
    * turnStepReach
    * Math.sin(walkCycle);

  gaitStates[1].forward =
    turnDirection
    * turnStepReach
    * Math.sin(walkCycle);

  gaitStates[0].lift *= 0.72;
  gaitStates[1].lift *= 0.72;
}
```

## 다리 Yaw

```js
const turnLegYaw =
  turningInPlace
    ? turnDirection * 0.12
    : 0;

playerLegs[0].rotation.y =
  THREE.MathUtils.damp(
    playerLegs[0].rotation.y,
    turnLegYaw,
    10,
    dt
  );

playerLegs[1].rotation.y =
  THREE.MathUtils.damp(
    playerLegs[1].rotation.y,
    -turnLegYaw,
    10,
    dt
  );
```

---

# 9. 8단계: 장기 개선 — 다리 루트 이동 제거

현재 발 고정은 다음 값을 직접 변경한다.

```js
leg.position.x
leg.position.y
leg.position.z
```

장기적으로는 고관절 root 위치를 고정하고, 발 목표 위치를 역관절 IK로 따라가게 해야 한다.

## 최종 구조

```text
pelvis
 ├─ leftHipRoot  // 위치 고정
 │   └─ thigh
 │       └─ knee
 │           └─ shin
 │               └─ ankle
 │                   └─ foot
 └─ rightHipRoot // 위치 고정
```

발 목표:

```text
footTargetWorld
 ├─ x: 좌우 stance 폭
 ├─ y: 지면 높이 + step lift
 └─ z: stride 앞뒤 위치
```

## 금지

다음 방식은 최종 단계에서 제거한다.

```js
leg.position.x += ...
leg.position.z += ...
leg.position.y += ...
```

단, IK 적용 전까지는 임시 fallback으로 유지할 수 있다.

---

# 10. 역관절 2-Bone IK 설계

## 신규 함수 인터페이스

```js
function solveReverseLegIK({
  legRoot,
  joints,
  footTargetWorld,
  poleTargetWorld,
  upperLength,
  lowerLength,
  dt
}) {
  // 구현
}
```

## 필요한 데이터

각 다리 생성 시 다음 값을 저장한다.

```js
leg.userData.ik = {
  upperLength: thighLength,
  lowerLength: shinLength,
  poleDirection: new THREE.Vector3(
    0,
    0.2,
    -1
  ),
  footTargetWorld: new THREE.Vector3(),
  poleTargetWorld: new THREE.Vector3()
};
```

## 기본 IK 계산

```js
function solveReverseLegIK({
  legRoot,
  joints,
  footTargetWorld,
  poleTargetWorld,
  upperLength,
  lowerLength,
  dt
}) {
  const hipWorld =
    joints.thigh.getWorldPosition(
      new THREE.Vector3()
    );

  const targetVector =
    footTargetWorld.clone()
      .sub(hipWorld);

  const distance =
    THREE.MathUtils.clamp(
      targetVector.length(),
      0.001,
      upperLength + lowerLength - 0.02
    );

  const hipCos =
    THREE.MathUtils.clamp(
      (
        upperLength * upperLength
        + distance * distance
        - lowerLength * lowerLength
      ) / (
        2
        * upperLength
        * distance
      ),
      -1,
      1
    );

  const kneeCos =
    THREE.MathUtils.clamp(
      (
        upperLength * upperLength
        + lowerLength * lowerLength
        - distance * distance
      ) / (
        2
        * upperLength
        * lowerLength
      ),
      -1,
      1
    );

  const hipBend =
    Math.acos(hipCos);

  const kneeBend =
    Math.PI - Math.acos(kneeCos);

  const targetLocal =
    legRoot.worldToLocal(
      footTargetWorld.clone()
    );

  const targetPitch =
    Math.atan2(
      targetLocal.z,
      -targetLocal.y
    );

  const targetYaw =
    Math.atan2(
      targetLocal.x,
      targetLocal.z
    );

  const reverseKneeAngle =
    THREE.MathUtils.clamp(
      -kneeBend,
      THREE.MathUtils.degToRad(-118),
      THREE.MathUtils.degToRad(-18)
    );

  joints.thigh.rotation.x =
    THREE.MathUtils.damp(
      joints.thigh.rotation.x,
      targetPitch - hipBend,
      14,
      dt
    );

  joints.thigh.rotation.y =
    THREE.MathUtils.damp(
      joints.thigh.rotation.y,
      targetYaw,
      10,
      dt
    );

  joints.knee.rotation.x =
    THREE.MathUtils.damp(
      joints.knee.rotation.x,
      reverseKneeAngle,
      16,
      dt
    );

  joints.shin.rotation.x =
    THREE.MathUtils.damp(
      joints.shin.rotation.x,
      kneeBend * 0.72 - 0.48,
      15,
      dt
    );
}
```

## 주의

현재 메카의 실제 다리 계층은 `thigh`, `knee`, `shin`, `rearCalf`, `ankle`, `foot`으로 구성되어 있다.

단순 2-Bone IK 결과를 그대로 적용하지 말고 다음처럼 분배한다.

```js
const distributedKnee =
  reverseKneeAngle;

joints.knee.rotation.x =
  distributedKnee * 0.72;

joints.shin.rotation.x =
  -0.50
  - distributedKnee * 0.42;

joints.rearCalf.rotation.x =
  -0.42
  - distributedKnee * 0.22;
```

---

# 11. 발 목표 위치 생성

## 신규 함수

```js
function buildFootTargetWorld(
  index,
  gaitState,
  turningInPlace
) {
  const leg = playerLegs[index];

  const baseAttachment =
    index === 0
      ? mechaAttachments.leftLeg
      : mechaAttachments.rightLeg;

  const localTarget =
    new THREE.Vector3(
      baseAttachment[0],
      baseAttachment[1]
        + REVERSE_LEG_GROUND_OFFSET,
      baseAttachment[2]
        + gaitState.forward
    );

  if (turningInPlace) {
    localTarget.x +=
      index === 0
        ? gaitState.forward * 0.18
        : -gaitState.forward * 0.18;
  }

  const worldTarget =
    player.localToWorld(
      localTarget.clone()
    );

  const groundHeight =
    sampleFootGroundHeight(worldTarget);

  worldTarget.y =
    groundHeight
    + gaitState.lift;

  if (
    footLocked[index]
    && footPlantWorld[index]
  ) {
    worldTarget.x =
      footPlantWorld[index].x;

    worldTarget.z =
      footPlantWorld[index].z;

    worldTarget.y =
      sampleFootGroundHeight(
        footPlantWorld[index]
      );
  }

  return worldTarget;
}
```

---

# 12. 발목과 발바닥 지면 정렬

기존 지면 경사 보정은 유지하되 IK 이후에 적용한다.

## 지면 Pitch 계산

```js
function getFootTerrainPitch(joints) {
  const heelWorld =
    joints.foot.localToWorld(
      new THREE.Vector3(
        0,
        -0.31,
        -0.72
      )
    );

  const frontWorld =
    joints.foot.localToWorld(
      new THREE.Vector3(
        0,
        -0.31,
        1.02
      )
    );

  const heelGround =
    sampleFootGroundHeight(heelWorld);

  const frontGround =
    sampleFootGroundHeight(frontWorld);

  return -Math.atan2(
    frontGround - heelGround,
    1.74
  );
}
```

## 최종 Foot Pitch

```js
const terrainPitch =
  getFootTerrainPitch(joints);

const gaitFootPitch =
  gaitState.footPitch;

const targetFootPitch =
  THREE.MathUtils.clamp(
    REVERSE_FOOT_LEVEL_PITCH
      + terrainPitch
      + gaitFootPitch,
    -0.65,
    0.65
  );

joints.foot.rotation.x =
  THREE.MathUtils.damp(
    joints.foot.rotation.x,
    targetFootPitch,
    footLocked[index] ? 18 : 11,
    dt
  );
```

## Toe

```js
for (
  const toePivot
  of joints.toePivots
) {
  toePivot.userData.baseCurl =
    gaitState.toeCurl;

  const toeBody =
    toePivot.userData.rigidContact ||= {
      angularVelocity: 0
    };

  toePivot.rotation.x =
    playerRigidBody.integrateAngularContact(
      toeBody,
      toePivot.rotation.x,
      gaitState.toeCurl,
      dt,
      {
        stiffness: footLocked[index]
          ? 92
          : 62,
        damping: footLocked[index]
          ? 18
          : 13,
        mass: 0.92
      }
    );
}
```

---

# 13. 골반 높이 보정

IK를 적용하면 양쪽 발 목표에 따라 골반 높이를 제한해야 한다.

## 신규 계산

```js
function calculatePelvisHeightOffset(
  leftTarget,
  rightTarget
) {
  const averageGround =
    (
      leftTarget.y
      + rightTarget.y
    ) * 0.5;

  const baseGround = 0;

  return THREE.MathUtils.clamp(
    averageGround - baseGround,
    -0.18,
    0.24
  );
}
```

## 적용

```js
const pelvisGroundOffset =
  calculatePelvisHeightOffset(
    footTargets[0],
    footTargets[1]
  );

const targetPelvisY =
  mechaMeshes.pelvis.position[1]
  + pelvisGroundOffset
  - footPlant * 0.05
  - impactNow * 0.10;

pelvis.position.y =
  THREE.MathUtils.damp(
    pelvis.position.y,
    targetPelvisY,
    10,
    dt
  );
```

---

# 14. 보행 업데이트 권장 순서

매 프레임 보행 계산은 아래 순서로 진행한다.

```text
1. 실제 이동 거리 계산
2. walking / turningInPlace / reversing 상태 판정
3. walkCycle 업데이트
4. 좌우 gait phase 계산
5. 4단계 발 궤적 계산
6. foot lock 상태 갱신
7. 좌우 footTargetWorld 생성
8. 골반 위치 및 중심 이동 계산
9. 역관절 IK 적용
10. 발목 지면 경사 보정
11. 발가락 접촉 보정
12. 착지 효과와 body suspension 적용
13. 상체·무장 흔들림 적용
```

---

# 15. 권장 코드 구조 분리

현재 `index.html` 내부에 보행 코드가 길게 들어가 있다.

다음 파일로 분리하는 것을 권장한다.

```text
mecha-gait-controller.js
```

## 공개 API

```js
window.createMechaGaitController = function(
  THREE,
  options
) {
  return {
    update,
    reset,
    setEnabled,
    debug
  };
};
```

## 생성 옵션

```js
const gaitController =
  window.createMechaGaitController(
    THREE,
    {
      player,
      playerLegs,
      pelvis,
      pelvisVisualRig,
      hipSocketCarriers,
      waistRig,
      waistCoreAssembly,
      mechaAttachments,
      mechaMeshes,
      playerRigidBody,
      sampleFootGroundHeight,
      spawnFootstepEffect,
      playFootstepSound:
        () => playGameSound('footstep'),
      reverseLegGroundOffset:
        REVERSE_LEG_GROUND_OFFSET,
      reverseFootLevelPitch:
        REVERSE_FOOT_LEVEL_PITCH
    }
  );
```

## 업데이트 호출

```js
gaitController.update({
  dt,
  actualGroundSpeed,
  locomotionSpeed,
  grounded,
  dashing,
  isReversing,
  turnRate,
  turnStability,
  landingImpact,
  speedRatio
});
```

## 리셋

```js
gaitController.reset();
```

리스폰, 타이틀 복귀, 레벨 변경 시 반드시 호출한다.

---

# 16. 디버그 모드

보행 개선 중 다음 디버그 표시를 추가한다.

```js
const GAIT_DEBUG = false;
```

## 표시할 요소

- 좌우 발 목표 위치
- 현재 lock 위치
- 고관절 위치
- 무릎 pole 방향
- 지면 Raycast
- supportWeight 값
- swingProgress 값

## 예시

```js
function createDebugMarker(
  color,
  radius = 0.12
) {
  return new THREE.Mesh(
    new THREE.SphereGeometry(
      radius,
      10,
      8
    ),
    new THREE.MeshBasicMaterial({
      color,
      depthTest: false
    })
  );
}
```

색상:

```text
왼발 목표: Cyan
오른발 목표: Magenta
발 Lock: Yellow
고관절: White
Pole Target: Red
```

---

# 17. 성능 규칙

매 프레임 새로운 객체 생성을 최소화한다.

## 금지

```js
new THREE.Vector3()
new THREE.Quaternion()
new THREE.Euler()
```

을 보행 루프 내부에서 과도하게 생성하지 않는다.

## 재사용 벡터

```js
const gaitTemp = {
  footWorld: new THREE.Vector3(),
  plantDelta: new THREE.Vector3(),
  localTarget: new THREE.Vector3(),
  worldTarget: new THREE.Vector3(),
  targetVector: new THREE.Vector3(),
  hipWorld: new THREE.Vector3(),
  quaternion: new THREE.Quaternion(),
  euler: new THREE.Euler()
};
```

---

# 18. 안전한 단계별 적용 순서

Codex는 모든 변경을 한 번에 적용하지 말고 아래 순서대로 적용한다.

## Phase A — 리듬 수정

- `stanceDuration` 동적화
- `WALK_STEP_LIFT` 감소
- `pelvisStepYaw` 감소
- `supportShift` 연속화
- 후진 walkCycle 역재생 제거

이 단계에서 기존 발 고정 보정은 유지한다.

## Phase B — 발 궤적 개선

- `evaluateHeavyMechStep()` 추가
- Heel Strike / Support / Toe Off / Swing 적용
- Foot Pitch와 Toe Curl 연동

## Phase C — Foot Lock 안정화

- `footLocked` 상태 추가
- lock / unlock 히스테리시스
- 발 속도 검사
- 회전 및 점프 시 안정적으로 해제

## Phase D — 제자리 회전

- `turningInPlace` 상태
- 좌우 반대 stride
- 발 Yaw 추가

## Phase E — IK 전환

- 발 목표 위치 생성
- 역관절 IK 구현
- `leg.position.x/z` 기반 보정 제거
- 다리 root를 골반 연결점에 고정

각 Phase 완료 후 게임 실행 테스트를 진행한다.

---

# 19. 기존 시스템과 반드시 호환할 항목

다음 기능을 손상시키지 않는다.

- `playerRigidBody.drive()`
- `playerRigidBody.integrateHorizontal()`
- 대시
- 점프
- 제트팩
- 착지 충격
- 부위 손상
- 다리 파괴 시 이동 불가
- 리스폰
- 스폰 실드
- 커스터마이징된 다리 크기와 위치
- `REVERSE_LEG_GROUND_OFFSET`
- `REVERSE_FOOT_LEVEL_PITCH`
- 발소리
- 발 착지 파티클
- 골반 장갑과 hip socket carrier
- 상체 조준과 무장 반동

---

# 20. 테스트 체크리스트

## 정지

- [ ] 정지 시 다리가 떨리지 않음
- [ ] 발 위치가 서서히 기본 위치로 복귀
- [ ] 골반이 갑자기 중앙으로 튀지 않음

## 저속 전진

- [ ] 발이 지나치게 높이 들리지 않음
- [ ] 한 발이 바닥을 확실히 지지
- [ ] 골반이 좌우로 덜컥거리지 않음
- [ ] 고관절이 골반 장갑 밖으로 빠지지 않음

## 고속 전진

- [ ] 보폭이 증가하지만 무릎이 꺾이지 않음
- [ ] 발이 바닥에서 미끄러지지 않음
- [ ] swing 발이 너무 빠르게 순간 이동하지 않음

## 후진

- [ ] 애니메이션 역재생처럼 보이지 않음
- [ ] 발끝 동작이 뒤집히지 않음
- [ ] 전진보다 보폭이 짧음

## 제자리 회전

- [ ] 양발이 같은 방향으로 미끄러지지 않음
- [ ] 좌우 발이 반대 방향으로 stepping
- [ ] 회전 중 발 lock이 무한 유지되지 않음

## 경사면

- [ ] 발바닥이 지면 경사에 맞음
- [ ] 발목이 과도하게 꺾이지 않음
- [ ] 발가락이 지면 아래로 파고들지 않음

## 점프 / 제트팩

- [ ] 공중에서는 foot lock 해제
- [ ] 착지 후 lock 정상 복구
- [ ] 착지 충격이 한 번만 발생
- [ ] 공중에서 다리 root가 이상하게 이동하지 않음

## 낮은 FPS

- [ ] 30 FPS에서도 발이 크게 미끄러지지 않음
- [ ] 큰 `dt`에서 보행 위상이 폭주하지 않음
- [ ] 착지 효과가 중복 실행되지 않음

---

# 21. 완료 조건

다음 조건을 모두 만족하면 작업 완료로 판단한다.

1. 발이 월드 지면에 안정적으로 접촉한다.
2. 골반과 고관절 연결이 시각적으로 유지된다.
3. 전진, 후진, 회전 보행이 서로 다르게 동작한다.
4. 역관절 실루엣이 유지된다.
5. 발목과 발가락이 지면에 자연스럽게 대응한다.
6. 기존 대시, 점프, 전투, 리스폰 기능이 정상 동작한다.
7. 콘솔 오류가 없다.
8. 매 프레임 과도한 객체 할당이 없다.
9. 8m 중장갑 메카다운 느리고 강한 체중 이동이 표현된다.

---

# 22. Codex 최종 작업 지시문

아래 내용을 그대로 Codex에 전달한다.

```text
첨부된 index.html의 메인 플레이어 메카 보행 시스템을 개선하라.

현재 walkCycle, gaitCycles, gaitLift, gaitFore, footPlantWorld,
playerLegs, pelvis, waistRig, hipSocketCarriers 구조는 유지하되,
보행을 더 무겁고 자연스러운 역관절 메카 움직임으로 변경한다.

우선 stanceDuration, WALK_STEP_LIFT, pelvisStepYaw, supportShift,
후진 위상 처리부터 안전하게 수정한다.

이후 발 궤적을 Heel Strike, Full Support, Toe Off,
Swing Recovery의 4단계로 분리한다.

footPlantWorld에는 lock / unlock 히스테리시스를 추가하고,
발의 수평·수직 속도와 지면 높이를 검사하여 착지 여부를 판정한다.

후진 시 walkCycle을 역방향으로 재생하지 말고,
보폭 방향과 크기만 반전한다.

제자리 회전 시 좌우 발이 서로 반대 방향으로 stepping하도록
turningInPlace 전용 보행을 추가한다.

최종적으로는 leg.position.x/y/z를 직접 움직여 발을 고정하는 방식을
역관절 IK 기반 foot target 방식으로 교체한다.
고관절 root는 mechaAttachments.leftLeg / rightLeg 위치에 고정한다.

현재 thigh, knee, shin, rearCalf, ankle, foot 계층을 유지하고,
IK 결과를 각 관절에 분배한다.

기존 대시, 점프, 제트팩, 리스폰, 발소리, 착지 파티클,
다리 부위 손상, 커스터마이징, 상체 조준 시스템을 깨뜨리지 않는다.

변경은 Phase A부터 Phase E까지 순서대로 적용하고,
각 단계마다 실행 가능한 상태를 유지한다.

가능하면 보행 로직을 mecha-gait-controller.js로 분리하되,
현재 file:// 실행 방식과 classic script 로딩 구조를 유지한다.

최종 결과물에는 다음을 포함한다.

1. 수정된 index.html
2. 필요 시 신규 mecha-gait-controller.js
3. 변경 사항 요약
4. 테스트한 항목
5. 남아 있는 한계
```
