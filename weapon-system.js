// Authoritative combat values shared by the player and every CPU pilot.
// Damage is expressed directly in health/shield points; no faction multiplier
// is applied after a hit.
(function createSharedWeaponSystem() {
  const profiles = Object.freeze({
    gatling: Object.freeze({
      damage: 2.4,
      speed: 84,
      range: 82,
      gravity: 0,
      cooldown: 0.075,
      radius: 0.16,
      splashRadius: 0,
      splashMultiplier: 0,
      color: 0xffd063,
      emissive: 0xff6500
    }),
    cannon: Object.freeze({
      damage: 14,
      speed: 44,
      range: 92,
      gravity: 0,
      cooldown: 0.34,
      radius: 0.34,
      splashRadius: 3.4,
      splashMultiplier: 0.55,
      color: 0xff9f1c,
      emissive: 0xff5a00
    }),
    homing: Object.freeze({
      damage: 13,
      speed: 52,
      range: 105,
      gravity: 3,
      cooldown: 0.9,
      radius: 0.35,
      splashRadius: 6.5,
      splashMultiplier: 0.72,
      color: 0x6cff68,
      emissive: 0x159c37
    }),
    laser: Object.freeze({
      damage: 2,
      speed: Infinity,
      range: 90,
      gravity: 0,
      cooldown: 0.09,
      radius: 0.105,
      splashRadius: 0,
      splashMultiplier: 0,
      color: 0xff3045,
      emissive: 0xff3045
    })
  });

  function get(type, powerLevel = 0) {
    const base = profiles[type] || profiles.cannon;
    const level = Math.max(0, Math.min(3, Number(powerLevel) || 0));
    return {
      ...base,
      damage: base.damage * (1 + level * 0.22),
      speed: Number.isFinite(base.speed) ? base.speed + level * 8 : base.speed,
      splashRadius: base.splashRadius + (base.splashRadius > 0 ? level * 0.6 : 0)
    };
  }

  window.MECHA_WEAPON_SYSTEM = Object.freeze({ profiles, get });
})();
