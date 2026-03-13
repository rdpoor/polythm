/**
 * presets.js – Preset storage via localStorage + JSON import/export
 */

(function () {
  const KEY_PREFIX = 'polythm_preset_';

  class Presets {
    save(name, engineState) {
      const key = KEY_PREFIX + name;
      localStorage.setItem(key, JSON.stringify(engineState));
    }

    load(name) {
      const key  = KEY_PREFIX + name;
      const raw  = localStorage.getItem(key);
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch (e) {
        return null;
      }
    }

    list() {
      const names = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(KEY_PREFIX)) {
          names.push(key.slice(KEY_PREFIX.length));
        }
      }
      return names.sort();
    }

    delete(name) {
      localStorage.removeItem(KEY_PREFIX + name);
    }

    exportJSON(name, engineState) {
      const json    = JSON.stringify(engineState, null, 2);
      const blob    = new Blob([json], { type: 'application/json' });
      const url     = URL.createObjectURL(blob);
      const anchor  = document.createElement('a');
      anchor.href   = url;
      anchor.download = (name || 'polythm-preset') + '.json';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    }

    importJSON(jsonStr) {
      return JSON.parse(jsonStr);
    }
  }

  window.Presets = Presets;
})();
