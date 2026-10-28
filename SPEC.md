# SPEC.md — Mansión de Newton

> Especificación para desarrollo guiado por especificaciones (SDD).
> Esta especificación es la fuente de verdad. Si el código y este documento difieren, se corrige el código o se propone un cambio explícito al documento. Nunca se desvía en silencio.

---

## 0. Instrucciones para Claude Code

### 0.1 Flujo de trabajo obligatorio

1. Lee este documento completo antes de escribir código.
2. Lee el diseño exportado de Stitch en `/design/stitch/` (HTML, CSS y capturas). Es la referencia visual. No inventes estilos que contradigan los tokens de la sección 5.
3. Trabaja **una fase a la vez** (sección 11). No avances a la siguiente fase hasta que se cumplan los criterios de aceptación de la actual.
4. Antes de implementar cada tarea: indica en 2-3 líneas qué vas a hacer y qué requisitos (`RF-xx`, `RNF-xx`) cubre.
5. Después de implementar cada tarea: verifica contra los criterios de aceptación, marca la casilla `[x]` en la sección 11 y haz un commit con el formato `fase-N: descripción corta (RF-xx)`.
6. Si algo es ambiguo o falta información, **pregunta** antes de asumir. Las decisiones pendientes están en la sección 14.
7. No agregues dependencias, frameworks ni herramientas de build que no estén listados en la sección 3.

### 0.2 Reglas de código

- JavaScript vanilla, sin transpilación, sin bundler, sin TypeScript.
- Scripts clásicos con `defer` y un único namespace global `NM` (ver sección 4). **No usar ES modules**, porque deben funcionar abriendo `index.html` con doble clic (`file://`).
- La física vive en funciones **puras** (sin acceso a DOM ni canvas) dentro de `js/physics/`, para poder probarlas con Node (sección 12).
- Todas las constantes físicas y de balance viven en `js/config.js`. Nada de números mágicos en la lógica.
- Comentarios y textos de interfaz en **español**. Nombres de variables y funciones en **inglés**.
- Funciones cortas, un solo propósito, JSDoc en las funciones públicas.

---

## 1. Contexto y objetivo

Trabajo de la asignatura **Física I** (ingeniería de software). Consigna: crear una animación, juego o herramienta didáctica que explique un tema del curso.

**Tema elegido:** Leyes de Newton (semana 5).

**Producto:** juego web educativo con temática de Halloween, de tres niveles (uno por ley), que enseña mediante la experimentación, mostrando fórmulas y datos en vivo, y evalúa con un quiz corto al terminar cada nivel.

**Público:** estudiantes universitarios de primer semestre.

**Objetivos de aprendizaje**

| Ley | Objetivo |
|---|---|
| 1.ª (inercia) | Entender que un objeto sin fuerza neta mantiene su velocidad, y que lo que lo detiene es una fuerza (la fricción), no "que se acabe el impulso". |
| 2.ª (F = m·a) | Entender que a igual fuerza, mayor masa implica menor aceleración, y calcular `a = F/m`. |
| 3.ª (acción-reacción) | Entender que las fuerzas entre dos cuerpos son iguales y opuestas, y que el cambio de velocidad depende de la masa de cada cuerpo. |

---

## 2. Alcance

**Dentro del alcance**
- Pantalla de inicio, 3 niveles, pantalla de explicación y quiz por nivel, pantalla final, modal "Cómo jugar".
- Simulación física propia en canvas 2D.
- Panel de datos en vivo y una gráfica en tiempo real (nivel 2).
- Sonidos simples opcionales con Web Audio API.
- Funcionamiento sin conexión a internet (ver RNF-06).

**Fuera del alcance**
- Backend, base de datos, cuentas de usuario, ranking en línea.
- Soporte móvil táctil completo (se pide escritorio; ver RNF-04).
- Más de 3 niveles o modos adicionales.

---

## 3. Stack y restricciones

| Elemento | Decisión |
|---|---|
| Lenguaje | HTML5, CSS3, JavaScript (ES2020), sin build |
| Render del juego | `<canvas>` 2D nativo |
| Gráfica en vivo | Chart.js (copia local en `/vendor/chart.umd.min.js`) |
| Colisiones de la torre (nivel 2) | Matter.js (copia local en `/vendor/matter.min.js`) |
| Fuentes | Creepster (títulos), Poppins (texto). Copias locales en `/assets/fonts/` |
| Audio | Web Audio API nativa, sin archivos de audio |
| Pruebas | Node.js con `node:assert`, sin framework |
| Almacenamiento | `localStorage` solo para progreso y puntaje (con `try/catch`) |

Navegadores objetivo: últimas versiones de Chrome, Edge y Firefox.

---

## 4. Estructura del proyecto

```
mansion-newton/
├── index.html
├── SPEC.md
├── css/
│   ├── tokens.css          # variables CSS (sección 5)
│   ├── base.css            # reset, tipografía, layout general
│   ├── components.css      # botones, paneles, sliders, modales, tarjetas
│   └── screens.css         # estilos por pantalla
├── js/
│   ├── config.js           # constantes físicas y de balance
│   ├── physics/
│   │   ├── newton.js       # funciones puras (aceleración, fricción, impulso)
│   │   └── integrator.js   # paso de integración
│   ├── engine/
│   │   ├── loop.js         # bucle con paso fijo
│   │   ├── particles.js    # sistema de partículas reutilizable
│   │   ├── background.js   # luna, estrellas, niebla, murciélagos, relámpagos
│   │   └── audio.js        # sonidos sintetizados
│   ├── levels/
│   │   ├── level1.js
│   │   ├── level2.js
│   │   └── level3.js
│   ├── ui/
│   │   ├── screens.js      # navegación entre pantallas
│   │   ├── hud.js          # panel de datos en vivo
│   │   ├── chart.js        # envoltorio de Chart.js
│   │   └── quiz.js
│   ├── data/
│   │   └── content.js      # textos de explicaciones y preguntas
│   ├── state.js            # estado global y persistencia
│   └── main.js             # arranque
├── vendor/                 # librerías locales
├── assets/fonts/
├── design/stitch/          # exportación de Stitch (solo referencia)
└── tests/
    └── physics.test.js
```

**Namespace:** cada archivo se registra como `NM.<modulo>` (por ejemplo `NM.physics`, `NM.config`, `NM.levels.level1`). El orden de los `<script defer>` en `index.html` debe respetar las dependencias.

---

## 5. Diseño visual (tokens)

Fuente: diseño de Stitch en `/design/stitch/`. Si hay diferencias entre el diseño y estos tokens, **prevalece el diseño exportado** y se actualiza `tokens.css`.

```css
:root {
  --color-bg-deep: #1a0b2e;
  --color-bg-black: #0b0614;
  --color-primary: #ff7518;      /* naranja calabaza */
  --color-secondary: #7cfc00;    /* verde tóxico */
  --color-glow: #9b5de5;         /* morado */
  --color-text: #f4f1ff;
  --color-ok: #7cfc00;
  --color-error: #ff3b5c;
  --font-display: "Creepster", cursive;
  --font-body: "Poppins", sans-serif;
  --radius: 14px;
  --glass: rgba(26, 11, 46, 0.65);
}
```

**Componentes comunes** (clases reutilizables): `.btn`, `.btn--primary`, `.btn--ghost`, `.panel` (efecto cristal), `.slider`, `.modal`, `.card`, `.hud`.
Todos con estados `:hover`, `:active`, `:focus-visible` y `:disabled`.

---

## 6. Flujo de pantallas y estado

```
Inicio ──► [Cómo jugar (modal)]
  │
  ▼
Nivel 1 ─► Explicación 1 ─► Quiz 1 ─► Nivel 2 ─► Explicación 2 ─► Quiz 2 ─► Nivel 3 ─► Explicación 3 ─► Quiz 3 ─► Final
```

**Estado global (`NM.state`)**

```js
{
  currentScreen: "home",
  unlockedLevel: 1,            // 1..3
  levels: {
    1: { completed: false, stars: 0, score: 0, attempts: 0 },
    2: { completed: false, stars: 0, score: 0, attempts: 0 },
    3: { completed: false, stars: 0, score: 0, attempts: 0 }
  },
  totalScore: 0,
  soundOn: true
}
```

Se persiste en `localStorage` bajo la clave `mansionNewton.v1`.

---

## 7. Requisitos funcionales

### 7.1 General

- **RF-01** Al abrir `index.html` se muestra la pantalla de inicio con título, subtítulo, botones "Comenzar", "Cómo jugar", "Créditos" y las tres tarjetas de nivel.
- **RF-02** Las tarjetas de nivel muestran estado bloqueado, desbloqueado o completado (con estrellas). Solo se puede entrar a niveles desbloqueados.
- **RF-03** El botón "Comenzar" lleva al primer nivel no completado.
- **RF-04** El modal "Cómo jugar" explica controles y objetivo de cada nivel, y se cierra con botón, tecla `Esc` o clic fuera.
- **RF-05** Existe un botón para silenciar/activar sonido, accesible en todas las pantallas de juego.
- **RF-06** El progreso (niveles completados, estrellas, puntaje) se guarda y se recupera al recargar. Hay una opción "Reiniciar progreso" en créditos.

### 7.2 Estructura común de los niveles

- **RF-10** Cada nivel tiene: barra superior (nombre, puntaje, vidas/intentos), canvas central, panel "Datos en vivo", controles inferiores y tarjeta de misión.
- **RF-11** Botón "Reiniciar" que restablece el nivel sin consumir intento.
- **RF-12** Al ganar el nivel se calcula puntaje y estrellas, y se pasa a la pantalla de explicación.
- **RF-13** Al perder todos los intentos se muestra un mensaje con una pista didáctica y se ofrece reintentar el nivel completo.
- **RF-14** Todos los valores del panel de datos se actualizan al menos 10 veces por segundo y se muestran con unidades del SI.

### 7.3 Nivel 1: El fantasma que no se detiene (1.ª ley)

- **RF-20** Un fantasma se desplaza horizontalmente sobre un cementerio. A la derecha hay una puerta de la mansión; justo antes de ella hay una **zona de parada** (alfombra) de 1.5 m.
- **RF-21** Slider "Fricción (niebla)" con rango 0 a 1 que se traduce a un coeficiente `μ` (ver sección 8.1). Solo se puede modificar antes del soplido.
- **RF-22** Botón "Soplar" con **carga de potencia**: mantener pulsado llena una barra de 0 a 100 %; al soltar se aplica el impulso inicial. También funciona con la tecla `Espacio`.
- **RF-23** El panel muestra velocidad, aceleración, fuerza neta y fuerza de fricción en vivo.
- **RF-24** Victoria: el fantasma **se detiene dentro de la zona de parada**. Derrota del intento: sale por la derecha de la pantalla, o se detiene fuera de la zona.
- **RF-25** Con `μ = 0` el fantasma nunca se detiene. Cuando esto ocurre se muestra un mensaje didáctico: "Sin fuerza neta, la velocidad no cambia".
- **RF-26** 3 intentos por nivel. Estrellas: 3 al primer intento, 2 al segundo, 1 al tercero.

### 7.4 Nivel 2: Catapulta de calabazas (2.ª ley)

- **RF-30** Una catapulta a la izquierda lanza calabazas contra una torre de bloques con esqueletos y murciélagos a la derecha.
- **RF-31** Selector de calabaza (pequeña, mediana, gigante) mostrando su masa en kg.
- **RF-32** Slider de fuerza en newtons (rango y paso en `config.js`).
- **RF-33** Al pulsar "Lanzar", se calcula `a = F/m`, la velocidad de salida `v = a·Δt` (ver 8.2) y se lanza la calabaza en trayectoria parabólica con gravedad.
- **RF-34** El panel muestra masa, fuerza, aceleración y velocidad de salida **antes** de lanzar (vista previa en vivo al mover los controles).
- **RF-35** Gráfica en vivo de velocidad vs. tiempo de la calabaza durante el vuelo (Chart.js).
- **RF-36** La fórmula `a = F / m` se muestra en un marco con brillo, y los valores actuales se sustituyen en ella (por ejemplo `a = 150 N / 3 kg = 50 m/s²`).
- **RF-37** La torre se simula con Matter.js. Victoria: derribar al menos 3 de los 4 esqueletos con máximo 3 lanzamientos.
- **RF-38** Estrellas: 3 si se gana con 1 lanzamiento, 2 con 2, 1 con 3.

### 7.5 Nivel 3: La bruja y su escoba (3.ª ley)

- **RF-40** Una bruja flota en el cielo nocturno sin gravedad (ver 8.3). La luna llena en la parte superior derecha es la meta.
- **RF-41** Selector de objeto a lanzar (caramelos, caldero) mostrando su masa.
- **RF-42** Control de dirección de lanzamiento (ángulo de 0° a 360°, con una flecha visible sobre la bruja). La bruja recibe el empuje en sentido contrario.
- **RF-43** Al pulsar "Lanzar hacia atrás": el objeto sale en la dirección elegida y la bruja cambia su velocidad según conservación del momento (ver 8.3). Se anima el objeto lanzado y partículas.
- **RF-44** Dos flechas de fuerza, **iguales en magnitud y de sentido opuesto**, se muestran en el instante del lanzamiento (una sobre el objeto, otra sobre la bruja), con la magnitud en newtons.
- **RF-45** Panel con masa del objeto, masa de la bruja, velocidad de la bruja (vector y módulo) y contador de lanzamientos usados / disponibles.
- **RF-46** Victoria: la bruja toca la luna. Si sale de los límites del escenario, el intento se pierde y el nivel se reinicia consumiendo un intento. La bruja conserva su velocidad entre lanzamientos (1.ª ley).
- **RF-47** Máximo de lanzamientos en `config.js`. Estrellas según lanzamientos usados (umbrales en `config.js`).

### 7.6 Explicación y quiz

- **RF-50** Tras cada nivel se muestra un modal con: nombre de la ley, enunciado en palabras simples, fórmula en grande, un ejemplo de la vida real y botón "Continuar al quiz". El contenido está en `js/data/content.js`.
- **RF-51** Cada quiz tiene una pregunta de opción múltiple con 4 respuestas. Al responder se muestra retroalimentación (verde/rojo) con una explicación breve.
- **RF-52** Una respuesta correcta suma puntos (`QUIZ_POINTS` en config). Una incorrecta no bloquea el avance, pero se muestra la respuesta correcta.
- **RF-53** Tras el quiz, el botón "Siguiente nivel" lleva al siguiente nivel o a la pantalla final.

### 7.7 Pantalla final

- **RF-60** Muestra puntaje total, estrellas por nivel y un resumen de las tres leyes en tres tarjetas.
- **RF-61** Botones "Jugar de nuevo" (reinicia el progreso tras confirmar) y "Volver al inicio".

---

## 8. Especificación física

**Unidades:** SI (m, kg, s, N). **Escala de pantalla:** definida por nivel en `config.js` (`PX_PER_M`). **Integración:** paso fijo `dt = 1/120 s` con acumulador (RNF-02), método Euler semi-implícito:

```
v += a * dt
x += v * dt
```

### 8.1 Nivel 1 (1.ª ley)

| Parámetro | Valor inicial (ajustable) |
|---|---|
| Masa del fantasma `m` | 1 kg |
| Gravedad `g` | 9.8 m/s² |
| Rango de fricción | `μ = slider × 0.6` (slider de 0 a 1) |
| Velocidad máxima del soplido `v_max` | 10 m/s |
| Velocidad inicial | `v0 = (potencia / 100) × v_max` |
| Posición inicial | 2 m |
| Zona de parada | 12.5 m a 14 m (la puerta está en 14 m) |
| Escala | 50 px/m |

Fricción cinética: `f = μ · m · g`, siempre opuesta al movimiento.
Aceleración: `a = -sign(v) · f / m`.
Cuando `|v|` cruza por cero (o es menor que `0.02 m/s`), se fija `v = 0`.
Distancia de frenado teórica (para mostrar en pistas y en pruebas): `d = v0² / (2 · μ · g)`.

**Criterio de balance:** con los valores iniciales debe existir al menos una combinación `(μ, potencia)` que lleve al fantasma a la zona de parada, y el rango de soluciones válidas no debe ser tan estrecho que dependa de cambios de 1 % en la potencia.

### 8.2 Nivel 2 (2.ª ley)

| Parámetro | Valor inicial (ajustable) |
|---|---|
| Masas | pequeña 1 kg, mediana 3 kg, gigante 8 kg |
| Rango de fuerza | 50 N a 500 N, paso 10 N |
| Tiempo de empuje de la catapulta `Δt` | 0.1 s |
| Ángulo de lanzamiento | 35° (fijo) |
| Gravedad | 9.8 m/s² |

Aceleración durante el empuje: `a = F / m`.
Velocidad de salida: `v = a · Δt = F · Δt / m`.
Componentes: `vx = v·cos(θ)`, `vy = v·sin(θ)`.
Momento lineal mostrado en el panel: `p = m · v`.

La calabaza se crea como cuerpo de Matter.js con masa `m` y velocidad inicial `(vx, vy)`. El daño a la torre lo resuelve el motor de colisiones. Los valores de fricción, restitución y masa de los bloques se ajustan en `config.js`.

**Criterio de balance:** debe ser posible ganar con la calabaza mediana y con la gigante usando fuerzas distintas, y la pequeña debe ser claramente menos eficaz. El nivel debe poder ganarse en 1 lanzamiento con la combinación correcta.

### 8.3 Nivel 3 (3.ª ley)

| Parámetro | Valor inicial (ajustable) |
|---|---|
| Masa de la bruja `M` | 40 kg |
| Caramelos | 2 kg |
| Caldero | 8 kg |
| Velocidad de lanzamiento relativa a la bruja `u` | 20 m/s |
| Duración del empuje `Δt_lanzamiento` (solo para mostrar fuerza) | 0.1 s |
| Gravedad | 0 (levitación) |
| Escala | 25 px/m |
| Máximo de lanzamientos | 6 |

Conservación del momento al lanzar un objeto de masa `m` con velocidad relativa `u` en dirección unitaria `d̂`:

```
Δv_bruja = -(m · u / M) · d̂
v_objeto = v_bruja_antes + u · d̂      (velocidad absoluta del objeto)
```

Fuerza mostrada en las flechas (iguales y opuestas): `F = m · u / Δt_lanzamiento`.
Con los valores iniciales: caramelos `Δv = 1 m/s`, caldero `Δv = 4 m/s`.

**Criterio de balance:** la luna debe estar alcanzable con 2 a 4 lanzamientos óptimos. Mínimo recomendado de distancia bruja-luna: 25 m.

---

## 9. Requisitos visuales y de animación

- **RF-70** Fondo común: luna grande con brillo, estrellas que parpadean, niebla en capas semitransparentes que se desplazan lento y murciélagos (🦇 o silueta vectorial) con trayectoria senoidal.
- **RF-71** Relámpago ocasional (destello blanco breve en el canvas), con intervalo aleatorio de 12 a 25 s. Debe poder desactivarse (ver RNF-05).
- **RF-72** Sistema de partículas reutilizable (`NM.particles`) con emisores configurables: color, velocidad, vida, tamaño y gravedad. Con un tope de partículas activas (`MAX_PARTICLES` en config).
- **RF-73** Vectores de fuerza dibujados como flechas con etiqueta (nombre y valor). Colores consistentes: fuerza aplicada = naranja, fricción = morado, reacción = verde.
- **RF-74** Los personajes pueden dibujarse con emojis (👻 🎃 🧙‍♀️ 💀 🦇) o formas vectoriales simples. No se requieren imágenes externas.

---

## 10. Contenido didáctico

Los textos viven en `js/data/content.js` con esta forma:

```js
NM.content = {
  laws: {
    1: { name, statement, formula, example },
    2: { ... },
    3: { ... }
  },
  quiz: {
    1: { question, options: [a, b, c, d], correctIndex, explanation },
    2: { ... },
    3: { ... }
  },
  hints: { level1Fail, level2Fail, level3Fail, frictionZero }
};
```

**Contenido base (puede refinarse):**

1. **Primera ley.** *Un cuerpo permanece en reposo o en movimiento rectilíneo uniforme mientras la fuerza neta sobre él sea cero.* Fórmula: `ΣF = 0 ⇒ v = constante`. Ejemplo: un disco de hockey sobre hielo que se desliza largo tiempo.
2. **Segunda ley.** *La aceleración de un cuerpo es proporcional a la fuerza neta y inversamente proporcional a su masa.* Fórmula: `F = m · a`. Ejemplo: empujar un carrito de supermercado vacío y otro lleno con la misma fuerza.
3. **Tercera ley.** *Si un cuerpo ejerce una fuerza sobre otro, el segundo ejerce sobre el primero una fuerza de igual magnitud y sentido opuesto.* Fórmula: `F₁₂ = -F₂₁`. Ejemplo: un cohete que expulsa gases para avanzar.

**Preguntas del quiz (base):**

1. Un fantasma se desliza sin parar sobre un piso sin fricción. ¿Qué fuerza neta actúa sobre él? → *Cero; por eso mantiene su velocidad.*
2. Con la misma fuerza, ¿qué calabaza adquiere mayor aceleración? → *La de menor masa.*
3. Cuando la bruja lanza un caldero hacia atrás, ¿qué ocurre con la fuerza sobre la bruja respecto a la que recibe el caldero? → *Es igual en magnitud y de sentido contrario.*

Cada pregunta lleva distractores plausibles (por ejemplo, "se detiene porque se acabó el impulso") y explicación.

---

## 11. Requisitos no funcionales

- **RNF-01** Mantener 60 FPS en un equipo de gama media con Chrome (≤ 500 partículas activas).
- **RNF-02** La simulación usa paso de tiempo fijo con acumulador; el delta de cada fotograma se limita a 50 ms para evitar saltos al cambiar de pestaña.
- **RNF-03** La física es determinista: el mismo estado inicial y las mismas entradas producen el mismo resultado.
- **RNF-04** Diseño orientado a escritorio (≥ 1280×720). El canvas escala manteniendo la relación de aspecto 16:9 mediante coordenadas lógicas de 960×540.
- **RNF-05** Respetar `prefers-reduced-motion`: desactivar relámpagos y reducir partículas.
- **RNF-06** Funciona sin conexión: ninguna dependencia por CDN en producción.
- **RNF-07** Accesibilidad básica: botones navegables con teclado, `focus-visible` visible, contraste de texto AA, `aria-label` en controles sin texto, `aria-live` en el panel de retroalimentación del quiz.
- **RNF-08** Código legible: sin funciones de más de ~50 líneas, sin duplicación entre niveles (lo común vive en `engine/` y `ui/`).
- **RNF-09** Sin errores ni advertencias en la consola del navegador durante una partida completa.

---

## 12. Plan de implementación (fases)

Marca cada casilla al completar. Cada fase termina con un commit.

### Fase 0: Preparación
- [x] Crear la estructura de carpetas y archivos vacíos (sección 4).
- [x] Copiar librerías y fuentes a `/vendor` y `/assets/fonts`.
- [x] Importar a `design/stitch/` la exportación de Stitch.
- [x] Crear `tokens.css` a partir del diseño y de la sección 5.

**Aceptación:** `index.html` abre sin errores en consola y muestra una página en blanco con el fondo oscuro.

### Fase 1: Núcleo de física y pruebas
- [x] `physics/newton.js`: `acceleration(F, m)`, `kineticFriction(mu, m, g)`, `stoppingDistance(v0, mu, g)`, `launchVelocity(F, m, dt)`, `recoilDelta(m, u, M)`.
- [x] `physics/integrator.js`: paso Euler semi-implícito.
- [x] `tests/physics.test.js` con casos de las secciones 8.1 a 8.3.

**Aceptación:** `node tests/physics.test.js` termina con código 0. Se prueban al menos: `a = F/m`, frenado hasta cero sin velocidad negativa, `Δv` del caramelo = 1 m/s y del caldero = 4 m/s con los valores iniciales.

### Fase 2: Motor y ambiente visual
- [x] `engine/loop.js` con paso fijo y acumulador.
- [x] `engine/background.js`: luna, estrellas, niebla, murciélagos, relámpago.
- [x] `engine/particles.js` con tope de partículas.
- [x] Canvas con escalado 16:9 y coordenadas lógicas 960×540.

**Aceptación:** una página de prueba muestra el fondo animado a 60 FPS, redimensionable sin deformarse.

### Fase 3: UI base y navegación
- [x] `components.css`, `screens.css` según el diseño de Stitch.
- [x] `ui/screens.js`: navegación entre pantallas.
- [x] `state.js` con persistencia y recuperación.
- [x] Pantalla de inicio, modal "Cómo jugar" y créditos (RF-01 a RF-06).

**Aceptación:** se navega entre todas las pantallas, el modal se cierra con `Esc`, y el progreso sobrevive a recargar.

### Fase 4: Nivel 1
- [ ] HUD y panel de datos en vivo (`ui/hud.js`).
- [ ] Lógica de `level1.js` según RF-20 a RF-26 y la sección 8.1.
- [ ] Mensajes didácticos para `μ = 0` y para derrota.

**Aceptación:** existe una combinación ganadora; con `μ = 0` el fantasma nunca se detiene y aparece el mensaje; los intentos y estrellas funcionan.

### Fase 5: Explicación y quiz
- [ ] `data/content.js` con el contenido de la sección 10.
- [ ] Modal de explicación y pantalla de quiz con estados de retroalimentación (RF-50 a RF-53).
- [ ] Integración con el nivel 1 y desbloqueo del nivel 2.

**Aceptación:** al ganar el nivel 1 se recorre explicación → quiz → nivel 2 desbloqueado.

### Fase 6: Nivel 2
- [ ] `ui/chart.js` (velocidad vs. tiempo con Chart.js).
- [ ] Catapulta, calabazas, torre con Matter.js (RF-30 a RF-38).
- [ ] Vista previa en vivo de `a = F/m` con valores sustituidos.

**Aceptación:** la gráfica se actualiza durante el vuelo; con distintas masas y la misma fuerza se observan aceleraciones distintas y la vista previa coincide con el cálculo real.

### Fase 7: Nivel 3
- [ ] Bruja, objetos lanzables, control de dirección (RF-40 a RF-47).
- [ ] Flechas de acción y reacción iguales y opuestas (RF-44).
- [ ] Conservación de velocidad entre lanzamientos y reinicio por salir del escenario.

**Aceptación:** la suma de momentos antes y después del lanzamiento se conserva (verificar por prueba automática y en pantalla); las flechas muestran el mismo valor en newtons.

### Fase 8: Pantalla final, sonido y pulido
- [ ] Pantalla final (RF-60, RF-61).
- [ ] `engine/audio.js` con sonidos sintetizados y botón de silencio.
- [ ] Relámpagos, `prefers-reduced-motion`, accesibilidad por teclado (RNF-05, RNF-07).
- [ ] Revisión de balance de los tres niveles con partidas de prueba.

**Aceptación:** una partida completa de principio a fin sin errores en consola (RNF-09).

### Fase 9: Entrega
- [ ] README con instrucciones para abrir el proyecto y resumen de la física.
- [ ] Revisión final de todos los `RF-xx` y `RNF-xx` contra este documento.
- [ ] Capturas de pantalla y, opcionalmente, un GIF de cada nivel para el informe.

---

## 13. Pruebas y verificación

**Automáticas (Node):** `node tests/physics.test.js`. Cubre las funciones puras de `physics/`.

**Manuales (lista de comprobación):**
- [ ] Nivel 1 con `μ = 0`: el fantasma no se detiene y sale de pantalla.
- [ ] Nivel 1: potencia y fricción correctas lo detienen en la alfombra.
- [ ] Nivel 2: con igual fuerza, la aceleración mostrada baja al aumentar la masa.
- [ ] Nivel 3: lanzamiento de caldero produce 4× el cambio de velocidad que los caramelos.
- [ ] Nivel 3: las dos flechas muestran exactamente el mismo valor de fuerza.
- [ ] Recarga de página conserva el progreso.
- [ ] Cambiar de pestaña y volver no rompe la simulación.
- [ ] Todo se puede operar con teclado.

---

## 14. Definición de terminado (DoD)

Una tarea está terminada cuando:
1. Cumple todos los criterios de aceptación de su fase.
2. No produce errores ni advertencias en consola.
3. La física no tiene números mágicos fuera de `config.js`.
4. Las pruebas automáticas pasan.
5. La casilla correspondiente en la sección 12 está marcada y existe el commit.

El proyecto está terminado cuando se cumplen todos los `RF-xx` y `RNF-xx`, el flujo completo se juega sin errores y el README está redactado.

---

## 15. Decisiones pendientes

Preguntar al usuario antes de asumir:

1. ¿El diseño de Stitch incluye un control de **ángulo de lanzamiento** para el nivel 3? Si no, se añade (RF-42) respetando el estilo de los demás controles.
2. ¿El nivel 1 usa fricción cinética tipo Coulomb (`f = μ·m·g`, como en 8.1) o una resistencia proporcional a la velocidad (`f = -b·v`)? Se asumió Coulomb por ser más simple de explicar.
3. ¿Se necesita una versión del juego traducida al inglés? Se asume que no.
4. ¿Se entregará solo el código o también un informe tipo artículo para el protocolo colaborativo? Si es así, añadir una fase de documentación.
5. ¿Hay límite de tamaño o formato de entrega (ZIP, repositorio, enlace publicado)? Si se publica en la web, considerar GitHub Pages.
