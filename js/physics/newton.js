/**
 * Funciones físicas puras de Mansión de Newton (SPEC.md sección 8).
 * Sin acceso a DOM ni canvas, para poder probarse con Node (tests/physics.test.js).
 */
(function (root) {
  'use strict';

  /**
   * Segunda ley de Newton: aceleración a partir de la fuerza neta y la masa.
   * @param {number} F - Fuerza neta en N.
   * @param {number} m - Masa en kg.
   * @returns {number} Aceleración en m/s².
   */
  function acceleration(F, m) {
    return F / m;
  }

  /**
   * Fuerza de fricción cinética, modelo de Coulomb.
   * @param {number} mu - Coeficiente de fricción cinética.
   * @param {number} m - Masa en kg.
   * @param {number} g - Aceleración de la gravedad en m/s².
   * @returns {number} Magnitud de la fuerza de fricción en N.
   */
  function kineticFriction(mu, m, g) {
    return mu * m * g;
  }

  /**
   * Distancia teórica de frenado por fricción, desde v0 hasta v = 0.
   * @param {number} v0 - Velocidad inicial en m/s.
   * @param {number} mu - Coeficiente de fricción cinética.
   * @param {number} g - Aceleración de la gravedad en m/s².
   * @returns {number} Distancia de frenado en m.
   */
  function stoppingDistance(v0, mu, g) {
    return (v0 * v0) / (2 * mu * g);
  }

  /**
   * Velocidad de salida tras un empuje de fuerza constante durante dt.
   * @param {number} F - Fuerza aplicada en N.
   * @param {number} m - Masa en kg.
   * @param {number} dt - Duración del empuje en s.
   * @returns {number} Velocidad resultante en m/s.
   */
  function launchVelocity(F, m, dt) {
    return acceleration(F, m) * dt;
  }

  /**
   * Magnitud del cambio de velocidad por retroceso (3.ª ley), por
   * conservación del momento lineal: Δv = m · u / M.
   * @param {number} m - Masa del objeto lanzado en kg.
   * @param {number} u - Velocidad de lanzamiento relativa al emisor en m/s.
   * @param {number} M - Masa del emisor que retrocede en kg.
   * @returns {number} Magnitud del cambio de velocidad del emisor en m/s.
   */
  function recoilDelta(m, u, M) {
    return (m * u) / M;
  }

  var api = {
    acceleration: acceleration,
    kineticFriction: kineticFriction,
    stoppingDistance: stoppingDistance,
    launchVelocity: launchVelocity,
    recoilDelta: recoilDelta,
  };

  root.NM = root.NM || {};
  root.NM.physics = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
