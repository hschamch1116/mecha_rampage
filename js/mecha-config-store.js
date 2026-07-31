(function createMechaConfigStore(global) {
  'use strict';

  const STORAGE_KEY = 'mechaCustomization';
  const LOADOUT_KEY = 'mechaLoadout';
  const VISUAL_KEY = 'mechaVisualSettings';

  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
  const object = value => value != null && typeof value === 'object' && !Array.isArray(value);
  function merge(base, saved) {
    const output = clone(base || {});
    if (!object(saved)) return output;
    for (const [key, value] of Object.entries(saved)) {
      output[key] = object(value) && object(output[key]) ? merge(output[key], value) : clone(value);
    }
    return output;
  }
  function load(key, fallback) {
    try { return merge(fallback, JSON.parse(localStorage.getItem(key) || 'null')); }
    catch { return clone(fallback); }
  }
  function save(key, value) { localStorage.setItem(key, JSON.stringify(value)); return clone(value); }

  global.MechaConfigStore = {
    deepClone: clone,
    loadCustomization: fallback => load(STORAGE_KEY, fallback),
    saveCustomization: value => save(STORAGE_KEY, { ...value, schemaVersion: 1, updatedAt: Date.now() }),
    loadLoadout: (fallback = ['laser', 'cannon', 'homing', 'homing']) => {
      const value = load(LOADOUT_KEY, fallback);
      return Array.isArray(value) && value.length === 4 ? value.map(String) : [...fallback];
    },
    saveLoadout: value => save(LOADOUT_KEY, value),
    loadVisualSettings: fallback => load(VISUAL_KEY, fallback),
    saveVisualSettings: value => save(VISUAL_KEY, value),
    resetCustomization: () => localStorage.removeItem(STORAGE_KEY),
    resetAll: () => [STORAGE_KEY, LOADOUT_KEY, VISUAL_KEY].forEach(key => localStorage.removeItem(key))
  };
  global.MECHA_CUSTOMIZATION = global.MechaConfigStore.loadCustomization(global.MECHA_CUSTOMIZATION || {});
})(window);
