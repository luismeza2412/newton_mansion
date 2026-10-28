/**
 * Pruebas del núcleo físico puro (SPEC.md sección 8.1 a 8.3).
 * Ejecutar con: node tests/physics.test.js
 */
'use strict';

const assert = require('node:assert/strict');
const config = require('../js/config.js');
const physics = require('../js/physics/newton.js');
const integrator = require('../js/physics/integrator.js');

/**
 * Compara dos números con una tolerancia, por errores de punto flotante.
 * @param {number} actual - Valor obtenido.
 * @param {number} expected - Valor esperado.
 * @param {string} message - Descripción del caso.
 * @param {number} [epsilon] - Tolerancia absoluta.
 */
function assertClose(actual, expected, message, epsilon = 1e-9) {
  assert.ok(
    Math.abs(actual - expected) < epsilon,
    `${message} (esperado ${expected}, obtenido ${actual})`
  );
}

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

// --- 8.2 Nivel 2 (2.ª ley): a = F / m ---
test('acceleration: a = F/m con fuerza y masa del catapulta', () => {
  const a = physics.acceleration(300, config.LEVEL2.MASS_MEDIUM);
  assert.strictEqual(a, 100);
});

test('launchVelocity: v = F·dt/m con los valores de empuje del nivel 2', () => {
  const v = physics.launchVelocity(
    config.LEVEL2.FORCE_MAX,
    config.LEVEL2.MASS_SMALL,
    config.LEVEL2.PUSH_DT
  );
  assertClose(v, 50, 'launchVelocity con fuerza máxima y masa pequeña');
});

// --- 8.1 Nivel 1 (1.ª ley): fricción y distancia de frenado ---
test('kineticFriction: f = mu·m·g', () => {
  const f = physics.kineticFriction(0.5, 2, 10);
  assert.strictEqual(f, 10);
});

test('stoppingDistance: d = v0² / (2·mu·g)', () => {
  const d = physics.stoppingDistance(6, 0.3, 10);
  assertClose(d, 6, 'distancia de frenado con valores de ejemplo');
});

test('frenado hasta cero sin velocidad negativa (simulación nivel 1)', () => {
  const { MASS_GHOST, GRAVITY, VELOCITY_EPSILON } = config.LEVEL1;
  const dt = config.INTEGRATION.DT;
  const v0 = (50 / 100) * config.LEVEL1.BLOW_V_MAX; // potencia 50% -> 5 m/s
  const mu = 0.5 * config.LEVEL1.FRICTION_SLIDER_MAX; // slider 0.5 -> mu = 0.3

  let state = { x: 0, v: v0 };
  let stopped = false;

  for (let i = 0; i < 2000; i += 1) {
    if (Math.abs(state.v) < VELOCITY_EPSILON) {
      state = { x: state.x, v: 0 };
      stopped = true;
      break;
    }
    const friction = physics.kineticFriction(mu, MASS_GHOST, GRAVITY);
    const a = -Math.sign(state.v) * physics.acceleration(friction, MASS_GHOST);
    state = integrator.step(state, a, dt);
  }

  assert.ok(stopped, 'el fantasma debe detenerse dentro del límite de pasos');
  assert.strictEqual(state.v, 0, 'la velocidad final debe quedar fijada en 0, no negativa');

  const theoreticalDistance = physics.stoppingDistance(v0, mu, GRAVITY);
  assertClose(
    state.x,
    theoreticalDistance,
    'la distancia simulada debe acercarse a la distancia teórica',
    0.05
  );
});

// --- 8.3 Nivel 3 (3.ª ley): conservación del momento ---
test('recoilDelta: Δv del caramelo = 1 m/s con los valores iniciales', () => {
  const dv = physics.recoilDelta(
    config.LEVEL3.MASS_CANDY,
    config.LEVEL3.RELATIVE_LAUNCH_SPEED,
    config.LEVEL3.MASS_WITCH
  );
  assert.strictEqual(dv, 1);
});

test('recoilDelta: Δv del caldero = 4 m/s con los valores iniciales', () => {
  const dv = physics.recoilDelta(
    config.LEVEL3.MASS_CAULDRON,
    config.LEVEL3.RELATIVE_LAUNCH_SPEED,
    config.LEVEL3.MASS_WITCH
  );
  assert.strictEqual(dv, 4);
});

// --- Integrador ---
test('integrator.step: Euler semi-implícito (v += a·dt, x += v·dt)', () => {
  const result = integrator.step({ x: 0, v: 0 }, 10, 0.1);
  assertClose(result.v, 1, 'velocidad tras un paso con a=10, dt=0.1');
  assertClose(result.x, 0.1, 'posición tras un paso con a=10, dt=0.1');
});

let passed = 0;
for (const { name, fn } of tests) {
  fn();
  passed += 1;
  console.log(`OK  ${name}`);
}

console.log(`\n${passed}/${tests.length} pruebas pasaron.`);
