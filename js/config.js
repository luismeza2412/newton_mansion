/**
 * Constantes físicas y de balance de Mansión de Newton (SPEC.md sección 8).
 * Único lugar permitido para números mágicos de la simulación.
 */
(function (root) {
  'use strict';

  var config = {
    INTEGRATION: {
      DT: 1 / 120, // paso fijo de integración, en s (RNF-02)
      MAX_FRAME_DT: 0.05, // tope de delta por fotograma, en s (RNF-02)
    },

    LEVEL1: {
      MASS_GHOST: 1, // kg
      GRAVITY: 9.8, // m/s²
      FRICTION_SLIDER_MAX: 0.6, // mu = slider(0..1) * este valor
      BLOW_V_MAX: 10, // m/s, velocidad inicial máxima del soplido
      BLOW_CHARGE_SECONDS: 1.2, // s para cargar la potencia de 0 a 100% manteniendo pulsado
      START_POSITION: 2, // m
      STOP_ZONE_MIN: 12.5, // m
      STOP_ZONE_MAX: 14, // m, posición de la puerta
      VELOCITY_EPSILON: 0.02, // m/s, umbral para fijar v = 0
      PX_PER_M: 50,
      MAX_ATTEMPTS: 3,
      STARS_BY_ATTEMPT: [3, 2, 1], // índice = intentos fallidos previos a la victoria
    },

    LEVEL2: {
      MASS_SMALL: 1, // kg
      MASS_MEDIUM: 3, // kg
      MASS_GIANT: 8, // kg
      FORCE_MIN: 50, // N
      FORCE_MAX: 500, // N
      FORCE_STEP: 10, // N
      PUSH_DT: 0.1, // s, duración del empuje de la catapulta
      LAUNCH_ANGLE_DEG: 35, // grados, fijo
      GRAVITY: 9.8, // m/s²
      PX_PER_M: 150,
      TOWER_DISTANCE_M: 4, // distancia catapulta-torre, en m
      MAX_ATTEMPTS: 3,
      STARS_BY_ATTEMPT: [3, 2, 1], // índice = lanzamientos previos a la victoria
      SKELETON_COUNT: 4,
      SKELETON_WIN_COUNT: 3, // mínimo de esqueletos derribados para ganar (RF-37)
      SKELETON_SPACING_M: 0.3, // separación entre esqueletos parados en la torre
      SKELETON_TOPPLE_ANGLE_RAD: 0.8, // ángulo de inclinación a partir del cual se considera "derribado"
      PUMPKIN_RADIUS_SMALL_M: 0.16,
      PUMPKIN_RADIUS_MEDIUM_M: 0.24,
      PUMPKIN_RADIUS_GIANT_M: 0.34,
      PUMPKIN_RESTITUTION: 0.15,
      PUMPKIN_FRICTION: 0.4,
      BLOCK_WIDTH_M: 0.45, // bloques estáticos de la torre (decorativos, no caen)
      BLOCK_HEIGHT_M: 0.35,
      BLOCK_FRICTION: 0.8,
      BLOCK_RESTITUTION: 0,
      SKELETON_WIDTH_M: 0.14,
      SKELETON_HEIGHT_M: 0.45,
      SKELETON_FRICTION: 0.3,
      SKELETON_RESTITUTION: 0.05,
      SKELETON_DENSITY: 0.0004, // livianos, para que el impacto los derribe con facilidad
      GROUND_FRICTION: 0.9,
    },

    LEVEL3: {
      MASS_WITCH: 40, // kg
      MASS_CANDY: 2, // kg
      MASS_CAULDRON: 8, // kg
      RELATIVE_LAUNCH_SPEED: 20, // m/s, u relativa a la bruja
      PUSH_DT: 0.1, // s, solo para mostrar la fuerza en las flechas
      GRAVITY: 0, // m/s², levitación
      PX_PER_M: 25,
      MAX_THROWS: 6,
      STARS_THRESHOLDS: [2, 4, 6], // máx. lanzamientos usados para 3★, 2★, 1★ (RF-47)
      WITCH_START_X_M: 4,
      WITCH_START_Y_M: 17,
      WITCH_RADIUS_M: 0.5,
      MOON_X_M: 34,
      MOON_Y_M: 3,
      MOON_RADIUS_M: 1.2,
      BOUNDS_MARGIN_M: 2, // margen fuera del lienzo antes de considerar "fuera del escenario"
      OBJECT_RADIUS_CANDY_M: 0.15,
      OBJECT_RADIUS_CAULDRON_M: 0.35,
      ARROW_DISPLAY_SECONDS: 1.5, // cuánto se muestran las flechas de fuerza tras lanzar
      THROW_LIFESPAN_S: 2.5, // cuánto dura animado el objeto lanzado
    },

    SCORING: {
      POINTS_PER_STAR: 100,
      QUIZ_POINTS: 20, // puntos al responder correctamente el quiz de una ley (RF-52)
    },

    ENGINE: {
      CANVAS_WIDTH: 960, // coordenadas lógicas (RNF-04)
      CANVAS_HEIGHT: 540,
      MAX_PARTICLES: 500, // tope de partículas activas (RF-72, RNF-01)
      STAR_COUNT: 60,
      FOG_LAYER_COUNT: 3,
      BAT_COUNT: 4,
      LIGHTNING_MIN_INTERVAL: 12, // s (RF-71)
      LIGHTNING_MAX_INTERVAL: 25, // s (RF-71)
      LIGHTNING_FLASH_DURATION: 0.15, // s
    },
  };

  root.NM = root.NM || {};
  root.NM.config = config;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = config;
  }
})(typeof window !== 'undefined' ? window : globalThis);
