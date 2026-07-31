(function registerMechaRigidBody() {
  window.createMechaRigidBodyClass = function createMechaRigidBodyClass(THREE) {
    return class MechaRigidBody {
      constructor(object, options = {}) {
        this.object = object;
        this.mass = Math.max(1, options.mass || 18000);
        this.linearDamping = options.linearDamping ?? 4.8;
        this.velocity = new THREE.Vector3();
        this.desiredVelocity = new THREE.Vector3();
        this.externalVelocity = new THREE.Vector3();
        this.blockedX = false;
        this.blockedZ = false;
        object.userData.rigidBody = this;
      }

      drive(direction, speed, acceleration, dt) {
        if (direction?.lengthSq() > 0.0001 && speed > 0) {
          this.desiredVelocity.copy(direction).setY(0).normalize().multiplyScalar(speed);
        } else {
          this.desiredVelocity.set(0, 0, 0);
        }
        const response = 1 - Math.exp(-Math.max(0, acceleration) * dt);
        this.velocity.lerp(this.desiredVelocity, response);
      }

      applyImpulse(impulse) {
        if (!impulse) return;
        this.externalVelocity.addScaledVector(impulse, 1 / this.mass);
      }

      integrateAngularContact(state, currentAngle, targetAngle, dt, options = {}) {
        const stiffness = options.stiffness ?? 72;
        const damping = options.damping ?? 15;
        const inverseMass = 1 / Math.max(.1, options.mass ?? 1);
        const error = targetAngle - currentAngle;
        const acceleration = error * stiffness * inverseMass - state.angularVelocity * damping * inverseMass;
        state.angularVelocity += acceleration * dt;
        state.angularVelocity = THREE.MathUtils.clamp(state.angularVelocity, -4.5, 4.5);
        const nextAngle = currentAngle + state.angularVelocity * dt;
        if (Math.abs(error) < .001 && Math.abs(state.angularVelocity) < .01) {
          state.angularVelocity = 0;
          return targetAngle;
        }
        return nextAngle;
      }

      integrateHorizontal(dt, isBlocked) {
        this.externalVelocity.multiplyScalar(Math.exp(-this.linearDamping * dt));
        const totalX = this.velocity.x + this.externalVelocity.x;
        const totalZ = this.velocity.z + this.externalVelocity.z;
        this.blockedX = this.blockedZ = false;

        const nextX = this.object.position.x + totalX * dt;
        if (!isBlocked(nextX, this.object.position.z)) {
          this.object.position.x = nextX;
        } else {
          this.velocity.x = 0;
          this.externalVelocity.x *= -0.12;
          this.blockedX = true;
        }

        const nextZ = this.object.position.z + totalZ * dt;
        if (!isBlocked(this.object.position.x, nextZ)) {
          this.object.position.z = nextZ;
        } else {
          this.velocity.z = 0;
          this.externalVelocity.z *= -0.12;
          this.blockedZ = true;
        }
        return Math.hypot(totalX, totalZ);
      }

      stop() {
        this.velocity.set(0, 0, 0);
        this.desiredVelocity.set(0, 0, 0);
        this.externalVelocity.set(0, 0, 0);
      }
    };
  };
})();
