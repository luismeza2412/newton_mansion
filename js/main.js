/**
 * Arranque de Mansión de Newton.
 * Por ahora solo monta el motor (fondo + partículas) sobre el canvas,
 * como banco de pruebas visual de la Fase 2. La navegación entre
 * pantallas y los niveles se conectan en fases posteriores.
 */
(function () {
  'use strict';

  function detectReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function main() {
    var canvas = document.getElementById('game-canvas');
    var ctx = canvas.getContext('2d');
    var config = window.NM.config.ENGINE;
    var reducedMotion = detectReducedMotion();

    var background = window.NM.background.createBackground({
      width: config.CANVAS_WIDTH,
      height: config.CANVAS_HEIGHT,
      reducedMotion: reducedMotion,
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

  window.addEventListener('DOMContentLoaded', main);
})();
