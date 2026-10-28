/**
 * Bucle de juego con paso de tiempo fijo y acumulador (RNF-02).
 * El delta de cada fotograma se limita para evitar saltos al cambiar de pestaña.
 */
(function () {
  'use strict';

  /**
   * Crea un bucle controlado por requestAnimationFrame.
   * @param {object} options
   * @param {number} options.dt - Paso fijo de simulación, en s.
   * @param {number} options.maxFrameDt - Tope del delta real por fotograma, en s.
   * @param {function(number): void} options.update - Recibe `dt`; puede llamarse varias veces por fotograma.
   * @param {function(number): void} options.render - Recibe `alpha` (0 a 1), la fracción hacia el próximo paso.
   * @returns {{start: function(): void, stop: function(): void, isRunning: function(): boolean}}
   */
  function createLoop(options) {
    var dt = options.dt;
    var maxFrameDt = options.maxFrameDt;
    var update = options.update;
    var render = options.render;

    var rafId = null;
    var lastTime = 0;
    var accumulator = 0;

    function frame(time) {
      var frameDt = Math.min((time - lastTime) / 1000, maxFrameDt);
      lastTime = time;
      accumulator += frameDt;

      while (accumulator >= dt) {
        update(dt);
        accumulator -= dt;
      }

      render(accumulator / dt);
      rafId = window.requestAnimationFrame(frame);
    }

    function start() {
      lastTime = window.performance.now();
      accumulator = 0;
      rafId = window.requestAnimationFrame(frame);
    }

    function stop() {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
    }

    function isRunning() {
      return rafId !== null;
    }

    return { start: start, stop: stop, isRunning: isRunning };
  }

  window.NM = window.NM || {};
  window.NM.loop = { createLoop: createLoop };
})();
