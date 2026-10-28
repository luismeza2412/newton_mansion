/**
 * Fondo animado común a todas las pantallas de juego (RF-70, RF-71).
 * Luna con brillo, estrellas que parpadean, niebla en capas y murciélagos
 * con trayectoria senoidal. El relámpago respeta `reducedMotion` (RNF-05).
 */
(function () {
  'use strict';

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function createStars(count, width, height) {
    var stars = [];
    for (var i = 0; i < count; i += 1) {
      stars.push({
        x: randomBetween(0, width),
        y: randomBetween(0, height * 0.7),
        radius: randomBetween(0.5, 1.8),
        phase: randomBetween(0, Math.PI * 2),
        speed: randomBetween(1, 2.5),
      });
    }
    return stars;
  }

  function createFogLayers(count, width, height) {
    var layers = [];
    for (var i = 0; i < count; i += 1) {
      layers.push({
        y: height * (0.6 + i * 0.12),
        heightPx: height * 0.22,
        opacity: 0.08 + i * 0.03,
        offsetX: 0,
        speed: 6 + i * 4,
      });
    }
    return layers;
  }

  function createBats(count, width, height) {
    var bats = [];
    for (var i = 0; i < count; i += 1) {
      bats.push({
        baseY: randomBetween(height * 0.1, height * 0.4),
        amplitude: randomBetween(10, 25),
        frequency: randomBetween(1.5, 3),
        phase: randomBetween(0, Math.PI * 2),
        x: randomBetween(0, width),
        speed: randomBetween(25, 45),
      });
    }
    return bats;
  }

  function createLightningState(reducedMotion, minInterval, maxInterval) {
    return {
      enabled: !reducedMotion,
      timer: randomBetween(minInterval, maxInterval),
      minInterval: minInterval,
      maxInterval: maxInterval,
      flashTime: 0,
    };
  }

  /**
   * Crea el fondo animado. Las partículas de clima (niebla, estrellas,
   * murciélagos) se generan una vez y se actualizan en cada paso.
   * @param {object} options
   * @param {number} options.width - Ancho lógico del canvas, en px.
   * @param {number} options.height - Alto lógico del canvas, en px.
   * @param {boolean} [options.reducedMotion] - Si es true, desactiva el relámpago (RNF-05).
   * @param {number} [options.flashDuration] - Duración del destello, en s.
   */
  function createBackground(options) {
    var width = options.width;
    var height = options.height;
    var flashDuration = options.flashDuration || 0.15;

    var stars = createStars(window.NM.config.ENGINE.STAR_COUNT, width, height);
    var fogLayers = createFogLayers(window.NM.config.ENGINE.FOG_LAYER_COUNT, width, height);
    var bats = createBats(window.NM.config.ENGINE.BAT_COUNT, width, height);
    var lightning = createLightningState(
      options.reducedMotion,
      window.NM.config.ENGINE.LIGHTNING_MIN_INTERVAL,
      window.NM.config.ENGINE.LIGHTNING_MAX_INTERVAL
    );

    function updateStars(dt) {
      for (var i = 0; i < stars.length; i += 1) {
        stars[i].phase += dt * stars[i].speed;
      }
    }

    function updateFog(dt) {
      for (var i = 0; i < fogLayers.length; i += 1) {
        var layer = fogLayers[i];
        layer.offsetX = (layer.offsetX + dt * layer.speed) % width;
      }
    }

    function updateBats(dt) {
      for (var i = 0; i < bats.length; i += 1) {
        var bat = bats[i];
        bat.phase += dt * bat.frequency;
        bat.x = (bat.x + dt * bat.speed) % (width + 40);
      }
    }

    function updateLightning(dt) {
      if (!lightning.enabled) {
        return;
      }
      if (lightning.flashTime > 0) {
        lightning.flashTime = Math.max(0, lightning.flashTime - dt);
        return;
      }
      lightning.timer -= dt;
      if (lightning.timer <= 0) {
        lightning.flashTime = flashDuration;
        lightning.timer = randomBetween(lightning.minInterval, lightning.maxInterval);
      }
    }

    function update(dt) {
      updateStars(dt);
      updateFog(dt);
      updateBats(dt);
      updateLightning(dt);
    }

    function renderSky(ctx) {
      var gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, '#0d0517');
      gradient.addColorStop(1, '#1a0b2e');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    }

    function renderMoon(ctx) {
      var moonX = width * 0.82;
      var moonY = height * 0.18;
      var moonRadius = 46;

      var glow = ctx.createRadialGradient(moonX, moonY, moonRadius * 0.5, moonX, moonY, moonRadius * 3);
      glow.addColorStop(0, 'rgba(244, 241, 255, 0.35)');
      glow.addColorStop(1, 'rgba(244, 241, 255, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(moonX - moonRadius * 3, moonY - moonRadius * 3, moonRadius * 6, moonRadius * 6);

      ctx.fillStyle = '#f4f1ff';
      ctx.beginPath();
      ctx.arc(moonX, moonY, moonRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    function renderStars(ctx) {
      for (var i = 0; i < stars.length; i += 1) {
        var star = stars[i];
        var brightness = 0.4 + 0.6 * ((Math.sin(star.phase) + 1) / 2);
        ctx.globalAlpha = brightness;
        ctx.fillStyle = '#f4f1ff';
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    function renderFog(ctx) {
      for (var i = 0; i < fogLayers.length; i += 1) {
        var layer = fogLayers[i];
        ctx.fillStyle = 'rgba(168, 155, 185, ' + layer.opacity + ')';
        ctx.fillRect(-layer.offsetX, layer.y, width + 40, layer.heightPx);
        ctx.fillRect(width - layer.offsetX, layer.y, width + 40, layer.heightPx);
      }
    }

    function renderBats(ctx) {
      ctx.font = '16px sans-serif';
      ctx.textBaseline = 'middle';
      for (var i = 0; i < bats.length; i += 1) {
        var bat = bats[i];
        var y = bat.baseY + Math.sin(bat.phase) * bat.amplitude;
        ctx.fillText('\u{1F987}', bat.x, y);
      }
    }

    function renderLightning(ctx) {
      if (lightning.flashTime <= 0) {
        return;
      }
      var alpha = (lightning.flashTime / flashDuration) * 0.6;
      ctx.fillStyle = 'rgba(255, 255, 255, ' + alpha + ')';
      ctx.fillRect(0, 0, width, height);
    }

    function render(ctx) {
      renderSky(ctx);
      renderMoon(ctx);
      renderStars(ctx);
      renderFog(ctx);
      renderBats(ctx);
      renderLightning(ctx);
    }

    return { update: update, render: render };
  }

  window.NM = window.NM || {};
  window.NM.background = { createBackground: createBackground };
})();
