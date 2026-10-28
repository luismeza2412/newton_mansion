/**
 * Sistema de partículas reutilizable (RF-72), con tope de partículas activas.
 */
(function () {
  'use strict';

  /**
   * Número aleatorio uniforme en [min, max]. Si min === max, devuelve ese valor.
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  /**
   * Crea un sistema de partículas con tope de partículas activas.
   * @param {number} maxParticles - Tope de partículas simultáneas (RNF-01).
   * @returns {{emit: function, update: function(number): void, render: function(CanvasRenderingContext2D): void, clear: function(): void, count: function(): number}}
   */
  function createSystem(maxParticles) {
    var particles = [];

    /**
     * Emite partículas desde un punto, con un emisor configurable.
     * @param {object} emitter
     * @param {number} emitter.x - Posición X de origen, en px.
     * @param {number} emitter.y - Posición Y de origen, en px.
     * @param {number} emitter.count - Cantidad de partículas a emitir.
     * @param {string} emitter.color - Color CSS de las partículas.
     * @param {number} emitter.size - Radio en px.
     * @param {number} emitter.life - Vida en s.
     * @param {number} [emitter.gravity] - Aceleración vertical en px/s².
     * @param {number} [emitter.speedMin] - Velocidad mínima en px/s.
     * @param {number} [emitter.speedMax] - Velocidad máxima en px/s.
     * @param {number} [emitter.angleMin] - Ángulo mínimo en radianes.
     * @param {number} [emitter.angleMax] - Ángulo máximo en radianes.
     */
    function emit(emitter) {
      var count = emitter.count || 1;
      var speedMin = emitter.speedMin || 0;
      var speedMax = emitter.speedMax || speedMin;
      var angleMin = emitter.angleMin || 0;
      var angleMax = emitter.angleMax || Math.PI * 2;

      for (var i = 0; i < count; i += 1) {
        if (particles.length >= maxParticles) {
          return;
        }
        var angle = randomBetween(angleMin, angleMax);
        var speed = randomBetween(speedMin, speedMax);
        particles.push({
          x: emitter.x,
          y: emitter.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: emitter.color,
          size: emitter.size,
          gravity: emitter.gravity || 0,
          life: emitter.life,
          age: 0,
        });
      }
    }

    /**
     * Avanza la simulación de todas las partículas un paso fijo.
     * @param {number} dt - Paso de tiempo en s.
     */
    function update(dt) {
      for (var i = particles.length - 1; i >= 0; i -= 1) {
        var p = particles[i];
        p.age += dt;
        if (p.age >= p.life) {
          particles.splice(i, 1);
          continue;
        }
        p.vy += p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
    }

    /**
     * Dibuja todas las partículas activas, con desvanecimiento por edad.
     * @param {CanvasRenderingContext2D} ctx
     */
    function render(ctx) {
      for (var i = 0; i < particles.length; i += 1) {
        var p = particles[i];
        var lifeRatio = Math.max(0, 1 - p.age / p.life);
        ctx.globalAlpha = lifeRatio;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    function clear() {
      particles.length = 0;
    }

    function count() {
      return particles.length;
    }

    return { emit: emit, update: update, render: render, clear: clear, count: count };
  }

  window.NM = window.NM || {};
  window.NM.particles = { createSystem: createSystem };
})();
