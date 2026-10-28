/**
 * Arranque de Mansión de Newton: fondo ambiental persistente detrás de la UI,
 * más la inicialización de estado y navegación entre pantallas.
 */
(function () {
  'use strict';

  function detectReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /**
   * Monta el fondo animado (luna, estrellas, niebla, murciélagos, relámpago)
   * y lo deja corriendo detrás de todas las pantallas (RF-70, RF-71).
   * @param {CanvasRenderingContext2D} ctx
   */
  function startAmbientBackground(ctx) {
    var config = window.NM.config.ENGINE;

    var background = window.NM.background.createBackground({
      width: config.CANVAS_WIDTH,
      height: config.CANVAS_HEIGHT,
      reducedMotion: detectReducedMotion(),
      flashDuration: config.LIGHTNING_FLASH_DURATION,
    });

    var particles = window.NM.particles.createSystem(config.MAX_PARTICLES);

    var loop = window.NM.loop.createLoop({
      dt: window.NM.config.INTEGRATION.DT,
      maxFrameDt: window.NM.config.INTEGRATION.MAX_FRAME_DT,
      update: function (dt) {
        background.update(dt);
        particles.update(dt);
      },
      render: function () {
        background.render(ctx);
        particles.render(ctx);
      },
    });

    loop.start();
  }

  function main() {
    var canvas = document.getElementById('game-canvas');
    startAmbientBackground(canvas.getContext('2d'));
    window.NM.quiz.init();
    window.NM.levels.level1.init();
    window.NM.levels.level2.init();
    window.NM.screens.init();
  }

  window.addEventListener('DOMContentLoaded', main);
})();
