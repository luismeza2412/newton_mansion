/**
 * Contenido didáctico: leyes de Newton, preguntas de quiz y pistas (sección
 * 10 de SPEC.md). Namespace: NM.content
 */
(function () {
  'use strict';

  var content = {
    laws: {
      1: {
        name: 'Primera ley de Newton (ley de inercia)',
        statement:
          'Un cuerpo permanece en reposo o en movimiento rectilíneo uniforme ' +
          'mientras la fuerza neta sobre él sea cero.',
        formula: 'ΣF = 0 ⇒ v = constante',
        example: 'Un disco de hockey sobre hielo que se desliza largo tiempo sin detenerse.',
      },
      2: {
        name: 'Segunda ley de Newton',
        statement:
          'La aceleración de un cuerpo es proporcional a la fuerza neta que recibe ' +
          'e inversamente proporcional a su masa.',
        formula: 'F = m · a',
        example: 'Empujar un carrito de supermercado vacío y otro lleno con la misma fuerza.',
      },
      3: {
        name: 'Tercera ley de Newton (acción y reacción)',
        statement:
          'Si un cuerpo ejerce una fuerza sobre otro, el segundo ejerce sobre el ' +
          'primero una fuerza de igual magnitud y sentido opuesto.',
        formula: 'F₁₂ = -F₂₁',
        example: 'Un cohete que expulsa gases hacia atrás para avanzar hacia adelante.',
      },
    },

    quiz: {
      1: {
        question: 'Un fantasma se desliza sin parar sobre un piso sin fricción. ¿Qué fuerza neta actúa sobre él?',
        options: [
          'Cero: por eso mantiene su velocidad constante.',
          'Una fuerza de frenado, porque se le acaba el impulso.',
          'Una fuerza igual a su peso, empujándolo hacia adelante.',
          'No se puede saber sin conocer su masa.',
        ],
        correctIndex: 0,
        explanation:
          'Sin fricción no hay fuerza neta, así que por la 1.ª ley el fantasma sigue con velocidad constante para siempre.',
      },
      2: {
        question: 'Con la misma fuerza, ¿qué calabaza adquiere mayor aceleración?',
        options: [
          'La más pequeña, porque a = F/m y a menor masa, mayor aceleración.',
          'La más grande, porque tiene más inercia para acelerar.',
          'Todas aceleran igual si la fuerza es la misma.',
          'Depende del color de la calabaza.',
        ],
        correctIndex: 0,
        explanation: 'La 2.ª ley dice a = F/m: con la misma fuerza, la masa más chica produce la aceleración más grande.',
      },
      3: {
        question:
          'Cuando la bruja lanza un caldero hacia atrás, ¿qué ocurre con la fuerza sobre la bruja respecto a la que recibe el caldero?',
        options: [
          'Es igual en magnitud y de sentido contrario.',
          'Es más débil, porque la bruja pesa más que el caldero.',
          'Es más fuerte, porque la bruja hace el esfuerzo.',
          'No hay fuerza sobre la bruja, solo sobre el caldero.',
        ],
        correctIndex: 0,
        explanation: 'La 3.ª ley: toda acción genera una reacción igual y opuesta, sin importar las masas involucradas.',
      },
    },

    hints: {
      level1Fail: 'Hay que revisar la combinación de potencia y fricción: el fantasma necesita frenar justo sobre la alfombra.',
      level2Fail: 'Hay que ajustar la fuerza según la masa de la calabaza: recordar que a = F/m.',
      level3Fail: 'Hay que elegir bien qué lanzar y en qué dirección: la bruja retrocede exactamente al revés.',
      frictionZero: 'Sin fricción no hay fuerza que frene al fantasma: por la 1.ª ley, seguirá para siempre.',
    },
  };

  window.NM = window.NM || {};
  window.NM.content = content;
})();
