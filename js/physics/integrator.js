/**
 * Paso de integración numérica con tiempo fijo (SPEC.md sección 8, RNF-02).
 * Reutilizable por cualquier nivel: no conoce reglas de juego, solo mecánica.
 */
(function (root) {
  'use strict';

  /**
   * Avanza el estado un paso de tiempo fijo usando Euler semi-implícito:
   * primero se actualiza la velocidad con la aceleración, luego la posición
   * con la velocidad ya actualizada.
   * @param {{x: number, v: number}} state - Estado actual (posición y velocidad).
   * @param {number} a - Aceleración constante durante el paso, en m/s².
   * @param {number} dt - Paso de tiempo en s.
   * @returns {{x: number, v: number}} Nuevo estado.
   */
  function step(state, a, dt) {
    var v = state.v + a * dt;
    var x = state.x + v * dt;
    return { x: x, v: v };
  }

  var api = {
    step: step,
  };

  root.NM = root.NM || {};
  root.NM.integrator = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
