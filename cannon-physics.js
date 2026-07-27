(function registerCannonPhysicsContext() {
  window.createCannonPhysicsContext = function createCannonPhysicsContext(CANNON, THREE) {
    const GROUP_GROUND = 1;
    const GROUP_DYNAMIC = 2;
    const GROUP_MECHA = 4;
    const world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -19, 0),
      allowSleep: true
    });
    world.broadphase = new CANNON.SAPBroadphase(world);
    world.solver.iterations = 8;
    world.solver.tolerance = 0.001;

    const groundMaterial = new CANNON.Material('ground');
    const debrisMaterial = new CANNON.Material('debris');
    const mechaMaterial = new CANNON.Material('mecha');
    world.addContactMaterial(new CANNON.ContactMaterial(groundMaterial, debrisMaterial, {
      friction: 0.62,
      restitution: 0.2,
      contactEquationStiffness: 8e7
    }));
    world.addContactMaterial(new CANNON.ContactMaterial(mechaMaterial, debrisMaterial, {
      friction: 0.48,
      restitution: 0.08
    }));
    world.defaultContactMaterial.friction = 0.5;
    world.defaultContactMaterial.restitution = 0.12;

    const groundBody = new CANNON.Body({
      mass: 0,
      material: groundMaterial,
      collisionFilterGroup: GROUP_GROUND,
      collisionFilterMask: GROUP_DYNAMIC
    });
    groundBody.addShape(new CANNON.Plane());
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    world.addBody(groundBody);

    const dynamicMeshes = new Map();
    const kinematicBodies = new Map();
    const worldPosition = new THREE.Vector3();
    const worldQuaternion = new THREE.Quaternion();
    const parentQuaternion = new THREE.Quaternion();
    const localQuaternion = new THREE.Quaternion();
    const worldBox = new THREE.Box3();
    const worldSize = new THREE.Vector3();

    function copyThreeToCannon(vector, target) {
      target.set(vector.x, vector.y, vector.z);
    }

    function registerDynamic(mesh, options = {}) {
      if (!mesh || dynamicMeshes.has(mesh)) return dynamicMeshes.get(mesh);
      mesh.updateWorldMatrix(true, false);
      mesh.getWorldPosition(worldPosition);
      mesh.getWorldQuaternion(worldQuaternion);
      worldBox.setFromObject(mesh);
      worldBox.getSize(worldSize);
      const halfExtents = new CANNON.Vec3(
        Math.max(0.08, worldSize.x * 0.5),
        Math.max(0.08, worldSize.y * 0.5),
        Math.max(0.08, worldSize.z * 0.5)
      );
      const volume = Math.max(0.05, worldSize.x * worldSize.y * worldSize.z);
      const body = new CANNON.Body({
        mass: Math.max(0.25, options.mass ?? mesh.userData.mass ?? volume * 1.35),
        material: debrisMaterial,
        position: new CANNON.Vec3(worldPosition.x, worldPosition.y, worldPosition.z),
        quaternion: new CANNON.Quaternion(worldQuaternion.x, worldQuaternion.y, worldQuaternion.z, worldQuaternion.w),
        linearDamping: options.linearDamping ?? 0.08,
        angularDamping: options.angularDamping ?? 0.16,
        allowSleep: true,
        sleepSpeedLimit: 0.12,
        sleepTimeLimit: 0.65,
        collisionFilterGroup: GROUP_DYNAMIC,
        collisionFilterMask: GROUP_GROUND | GROUP_DYNAMIC | GROUP_MECHA
      });
      body.addShape(new CANNON.Box(halfExtents));
      const velocity = mesh.userData.velocity;
      const angularVelocity = mesh.userData.angularVelocity;
      if (velocity) copyThreeToCannon(velocity, body.velocity);
      if (angularVelocity) copyThreeToCannon(angularVelocity, body.angularVelocity);
      world.addBody(body);
      dynamicMeshes.set(mesh, body);
      mesh.userData.cannonBody = body;
      return body;
    }

    function syncDynamicMesh(mesh, body) {
      worldPosition.set(body.position.x, body.position.y, body.position.z);
      worldQuaternion.set(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w);
      if (mesh.parent) {
        mesh.position.copy(worldPosition);
        mesh.parent.worldToLocal(mesh.position);
        mesh.parent.getWorldQuaternion(parentQuaternion);
        localQuaternion.copy(parentQuaternion).invert().multiply(worldQuaternion);
        mesh.quaternion.copy(localQuaternion);
      } else {
        mesh.position.copy(worldPosition);
        mesh.quaternion.copy(worldQuaternion);
      }
      if (mesh.userData.velocity) {
        mesh.userData.velocity.set(body.velocity.x, body.velocity.y, body.velocity.z);
      }
      if (mesh.userData.angularVelocity) {
        mesh.userData.angularVelocity.set(body.angularVelocity.x, body.angularVelocity.y, body.angularVelocity.z);
      }
    }

    function syncKinematic(key, object, radius = 2, height = 8, enabled = true) {
      let body = kinematicBodies.get(key);
      if (!body) {
        body = new CANNON.Body({
          type: CANNON.Body.KINEMATIC,
          mass: 0,
          material: mechaMaterial,
          collisionFilterGroup: GROUP_MECHA,
          collisionFilterMask: GROUP_DYNAMIC,
          fixedRotation: true
        });
        body.addShape(new CANNON.Box(new CANNON.Vec3(radius, height * 0.5, radius)));
        world.addBody(body);
        kinematicBodies.set(key, body);
      }
      body.collisionResponse = enabled;
      body.position.set(object.position.x, object.position.y + height * 0.5, object.position.z);
      body.quaternion.setFromEuler(0, object.rotation.y, 0);
      body.velocity.set(0, 0, 0);
      body.angularVelocity.set(0, 0, 0);
      body.aabbNeedsUpdate = true;
    }

    function removeMesh(mesh) {
      const body = dynamicMeshes.get(mesh);
      if (!body) return;
      world.removeBody(body);
      dynamicMeshes.delete(mesh);
      delete mesh.userData.cannonBody;
    }

    function clearDynamics() {
      for (const [mesh, body] of dynamicMeshes) {
        world.removeBody(body);
        delete mesh.userData.cannonBody;
      }
      dynamicMeshes.clear();
    }

    function applyRadialImpulse(center, radius, strength) {
      for (const body of dynamicMeshes.values()) {
        const dx = body.position.x - center.x;
        const dy = body.position.y - center.y;
        const dz = body.position.z - center.z;
        const distance = Math.hypot(dx, dy, dz);
        if (distance <= 0.001 || distance >= radius) continue;
        const falloff = 1 - distance / radius;
        const impulseScale = strength * falloff;
        body.applyImpulse(new CANNON.Vec3(
          dx / distance * impulseScale,
          Math.max(0.24, dy / distance) * impulseScale,
          dz / distance * impulseScale
        ));
        body.wakeUp();
      }
    }

    function step(dt) {
      world.step(1 / 60, Math.min(dt, 0.05), 3);
      for (const [mesh, body] of dynamicMeshes) syncDynamicMesh(mesh, body);
    }

    return {
      world,
      registerDynamic,
      syncKinematic,
      removeMesh,
      clearDynamics,
      applyRadialImpulse,
      step,
      get dynamicCount() { return dynamicMeshes.size; }
    };
  };
})();
