/**
 * Estado global de la partida y su persistencia en localStorage (RF-06).
 * Namespace: NM.state
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'mansionNewton.v1';

  function createDefaultState() {
    return {
      currentScreen: 'home',
      unlockedLevel: 1,
      levels: {
        1: { completed: false, stars: 0, score: 0, attempts: 0 },
        2: { completed: false, stars: 0, score: 0, attempts: 0 },
        3: { completed: false, stars: 0, score: 0, attempts: 0 },
      },
      totalScore: 0,
      soundOn: true,
    };
  }

  function mergeWithDefaults(saved) {
    var defaults = createDefaultState();
    if (!saved || typeof saved !== 'object') {
      return defaults;
    }
    defaults.currentScreen = saved.currentScreen || defaults.currentScreen;
    defaults.unlockedLevel = saved.unlockedLevel || defaults.unlockedLevel;
    defaults.totalScore = saved.totalScore || defaults.totalScore;
    defaults.soundOn = typeof saved.soundOn === 'boolean' ? saved.soundOn : defaults.soundOn;
    if (saved.levels) {
      for (var level in defaults.levels) {
        if (saved.levels[level]) {
          defaults.levels[level] = saved.levels[level];
        }
      }
    }
    return defaults;
  }

  function load() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? mergeWithDefaults(JSON.parse(raw)) : createDefaultState();
    } catch (error) {
      return createDefaultState();
    }
  }

  function persist() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      // almacenamiento no disponible (modo privado o cuota excedida); se sigue en memoria
    }
  }

  var state = load();
  var listeners = [];

  function notify() {
    for (var i = 0; i < listeners.length; i += 1) {
      listeners[i](state);
    }
  }

  /**
   * @returns {object} El estado global actual.
   */
  function getState() {
    return state;
  }

  /**
   * Mezcla `patch` sobre el estado actual, persiste en localStorage y notifica
   * a los suscriptores.
   * @param {object} patch
   */
  function setState(patch) {
    for (var key in patch) {
      if (Object.prototype.hasOwnProperty.call(patch, key)) {
        state[key] = patch[key];
      }
    }
    persist();
    notify();
  }

  /**
   * Borra el progreso guardado y vuelve al estado inicial ("Reiniciar progreso", RF-06).
   */
  function resetProgress() {
    state = createDefaultState();
    persist();
    notify();
  }

  /**
   * Suscribe una función a los cambios de estado.
   * @param {function(object): void} listener
   * @returns {function(): void} Función para cancelar la suscripción.
   */
  function subscribe(listener) {
    listeners.push(listener);
    return function unsubscribe() {
      var index = listeners.indexOf(listener);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    };
  }

  window.NM = window.NM || {};
  window.NM.state = {
    getState: getState,
    setState: setState,
    resetProgress: resetProgress,
    subscribe: subscribe,
  };
})();
