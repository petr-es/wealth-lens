// Safe localStorage wrapper — survives private mode, disabled storage, and
// quota errors by falling back to an in-memory map.
const safeStorage = (function () {
  const mem = {};
  return {
    get(key) {
      try { return localStorage.getItem(key); }
      catch { return mem[key] ?? null; }
    },
    set(key, value) {
      try { localStorage.setItem(key, value); }
      catch { mem[key] = value; }
    },
    remove(key) {
      try { localStorage.removeItem(key); }
      catch { delete mem[key]; }
    },
  };
})();

const LANGS = { cs: LANG_CS, en: LANG_EN };
let LANG = LANGS[safeStorage.get('lang') || 'cs'];
