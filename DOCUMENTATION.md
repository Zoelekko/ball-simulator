# Arena Ball Anime — Documentación Técnica Completa

> **Estructura:** ES Modules (`index.html` + `js/` con 12 módulos)
> **Archivo de entrada:** `index.html` → carga `js/main.js` como `type="module"`
> **Propósito:** Simulación animada de combate entre bolas en una arena, con habilidades de anime, física 2D, grabación en vídeo automática y modo auto-batch para producir contenido en TikTok/YouTube Shorts.

> **Última actualización:** 2026-03-16 — Resolution upgrade to 1080x1920, boss mode complete, aimbot projectiles, camera tracking, performance optimizations.

---

## Índice

1. [¿Qué es este proyecto?](#1-qué-es-este-proyecto)
2. [Estructura del archivo](#2-estructura-del-archivo)
3. [Cómo ejecutar](#3-cómo-ejecutar)
4. [Interfaz de usuario](#4-interfaz-de-usuario)
5. [Constantes configurables (C)](#5-constantes-configurables-c)
6. [Layout del canvas](#6-layout-del-canvas)
7. [Sistema de física](#7-sistema-de-física)
8. [Clase Ball](#8-clase-ball)
9. [Estado del juego (G)](#9-estado-del-juego-g)
10. [Modos de juego](#10-modos-de-juego)
11. [Sistema de rondas](#11-sistema-de-rondas)
12. [Arena — formas y poderes](#12-arena--formas-y-poderes)
13. [Orbs (habilidades)](#13-orbs-habilidades)
14. [Lista completa de habilidades](#14-lista-completa-de-habilidades)
15. [Sistema FX](#15-sistema-fx)
16. [Cámara cinemática (CAM)](#16-cámara-cinemática-cam)
17. [Partículas](#17-partículas)
18. [Sistema de audio (Snd)](#18-sistema-de-audio-snd)
19. [Grabación de vídeo (Rec)](#19-grabación-de-vídeo-rec)
20. [Modo Auto-batch](#20-modo-auto-batch)
21. [Sistema de leaderboard](#21-sistema-de-leaderboard)
22. [Pipeline de render (draw)](#22-pipeline-de-render-draw)
23. [Loop principal](#23-loop-principal)
24. [Cómo añadir una nueva habilidad](#24-cómo-añadir-una-nueva-habilidad)
25. [Cómo añadir una nueva forma de arena](#25-cómo-añadir-una-nueva-forma-de-arena)
26. [Cómo cambiar el número de jugadores](#26-cómo-cambiar-el-número-de-jugadores)
27. [Cómo cambiar la música](#27-cómo-cambiar-la-música)
28. [Errores comunes y soluciones](#28-errores-comunes-y-soluciones)
29. [Dependencias externas](#29-dependencias-externas)
30. [Glosario](#30-glosario)
31. [Requisitos para ejecutar el proyecto](#31-requisitos-para-ejecutar-el-proyecto)
32. [Guía de refactorización — Cómo dividir en módulos ES](#32-guía-de-refactorización--cómo-dividir-original_gamehtml-en-módulos-es)
33. [Performance optimizations](#33-performance-optimizations)
34. [Aimbot projectiles](#34-aimbot-projectiles)
35. [UI improvements](#35-ui-improvements)
36. [Historial de problemas conocidos](#36-historial-de-problemas-conocidos)

---

## 1. ¿Qué es este proyecto?

Un simulador de combate arena 100% en HTML5 Canvas sin frameworks externos. Las "bolas" representan personajes de anime, cada una con un color, nombre, HP y habilidades especiales. La simulación corre automáticamente (sin input del jugador) y se graba en vídeo MP4/WebM para subirla a redes sociales.

**Flujo de una partida:**
```
Inicio → Countdown (1s) → Running (45s) → RoundEndDelay → RoundEnd → [siguiente ronda]
                                                                    → [podium + champion si alguien llegó a N victorias]
```

**Características principales:**
- 6–15 jugadores por partida (aleatorio)
- Modo individual (FFA) o por equipos (2–4 equipos)
- 110+ habilidades únicas de anime con efectos visuales completos
- Animes: JJK, Naruto, Black Clover, Slime Isekai, Chainsaw Man, One Punch Man, Frieren, Eminence in Shadow, Overlord, Noragami, Mushoku Tensei, Date A Live
- Física 2D con rebotes elásticos, trails, partículas
- Cámara cinemática con zoom/follow al activarse habilidades
- Música dinámica que sube de volumen con cada kill
- Grabación automática a MP4 o WebM
- Pantalla de intro "WHO WILL WIN?" al inicio de cada partida (grabada, primeros 2s)
- Modo Auto × 10: graba 10 partidas seguidas sin intervención
- Estructura modular ES (12 módulos JS, no single-file)

---

## 2. Estructura del proyecto (ES Modules)

El proyecto fue refactorizado de un único `original_game.html` (~6400 líneas) a una estructura modular:

```
ball simulator/
├── index.html          ← HTML + CSS + <script type="module" src="js/main.js">
├── DOCUMENTATION.md    ← esta documentación
├── music/              ← 10 archivos MP3 de música phonk
└── js/
    ├── constants.js    ← iridGrad, iridColor, W, H, ACX, ACY, AR, C, constantes LB
    ├── audio.js        ← Snd (Web Audio API: música + efectos + MediaStreamDestination)
    ├── recorder.js     ← Rec, autoBatch*, initRec
    ├── particles.js    ← parts[], burst(), ringBurst(), tickParts(), spawnOrb(), initParticles
    ├── camera.js       ← CAM (trigger, setFollow, impact, physSpeed, tick)
    ├── arena.js        ← ARENA_SHAPES, ARENA, arenaPath, pushInsideArena, isInsideArena
    ├── fx.js           ← FX (estado + tick + reset de todos los efectos visuales)
    ├── ball.js         ← class Ball, isEnemy, addDmg, initBall
    ├── game.js         ← G (estado del juego), initGame, getStall/setStall, getOrbTimers
    ├── abilities.js    ← ORB_TYPES[], orbs[], tickOrbs(), applyOrb(), initAbilities, setters
    ├── draw.js         ← draw(), drawFX(), drawOrbs(), bgOff, triggerRoundTransition, initDraw
    └── main.js         ← canvas, physics, loop, event listeners, todos los initX()
```

### Dependencias circulares — patrón late-binding

Los módulos tienen deps circulares (e.g. `ball.js` necesita `G`, `G` necesita `Ball`). Se resuelven con funciones `initX(deps)` llamadas desde `main.js` después de que todos los módulos están cargados:

```javascript
// main.js — orden de init (después de todos los imports)
initBall({ G, CAM, FX, burst, getStall, setStall: ... });
initFX({ isEnemy, addDmg, burst, parts, G, CAM });
initGame({ Ball, parts, orbs, FX, CAM, Snd, ringBurst, triggerRoundTransition, getAutoBatch, resetOrbTimers });
initAbilities({ G, FX, CAM, Snd, burst, isEnemy, addDmg, spawnOrb });
initParticles({ ORB_TYPES, orbs, ORB_RADIUS, ORB_LIFETIME });
initDraw({ G, DC, RC: rc });
initRec({ RC, Snd, setStatus, soloBtn, teamBtn, autoBtn, restartBtn, begin });
```

### `frame` counter

`frame` vive en `draw.js`, se incrementa en `draw(ctx)`, y se exporta como `getFrame()`. Se pasa a `FX.tick(balls, getFrame())` desde `main.js`.

---

## 3. Cómo ejecutar

**Requiere un servidor HTTP local** (los módulos ES y fetch de audio no funcionan desde `file://`).

```bash
# Opción 1: Python (incluido en Windows/Mac/Linux)
cd "ruta/al/proyecto"
python -m http.server 8080

# Opción 2: Node.js
npx serve .

# Opción 3: usar el archivo servidor.bat (incluido en el proyecto)
servidor.bat
```

Luego abrir: `http://127.0.0.1:8080/index.html`

> **Nota:** Usar `127.0.0.1` y NO `localhost`. En Python 3.12+ en Windows, `localhost` puede resolver a IPv6 causando `ERR_EMPTY_RESPONSE`. El `servidor.bat` incluido ya usa `--bind 127.0.0.1` para evitar esto.

**Estructura de carpetas necesaria:**
```
ball simulator/
├── index.html
├── js/               ← 12 módulos ES (ver sección 2)
├── music/            ← archivos MP3 de música phonk
│   └── ... (10 archivos MP3, prefijo SpotiDown.App)
└── DOCUMENTATION.md
```

> Los vídeos grabados se descargan automáticamente al directorio de descargas del navegador.

---

## 4. Interfaz de usuario

| Botón | Función |
|---|---|
| **▶ Individual** | Inicia partida en modo FFA (todos contra todos) |
| **▶ Team** | Inicia partida en modo equipos (2–4 equipos) |
| **⚡ Auto × 10** | Graba automáticamente 10 partidas seguidas (mix de modos) |
| **↺ Restart** | Para la grabación actual e inicia una nueva partida |

**Indicador de estado (`#status`):**
- `Press START` — en espera
- `⏳ Starting...` — inicializando
- `● REC — Part X / 10` — grabando (texto rojo parpadeante)
- `✓ Listo — N partidas grabadas` — batch completado (texto verde)

---

## 5. Constantes configurables (C)

```javascript
const C = {
  BALL_R: 42,          // Radio de cada bola (píxeles)
  MAX_HP: 25,          // HP máximo inicial
  MIN_SPD: 6.0,        // Velocidad mínima al spawnear
  MAX_SPD: 11.25,      // Velocidad máxima al spawnear
  REST_B: 0.98,        // Restitución en colisión (0=sin rebote, 1=perfectamente elástico)
  FLASH: 10,           // Frames de flash blanco al recibir daño
  COOLDOWN: 20,        // Frames de cooldown entre colisiones del mismo par
  WALL_SPD_INC: 0.05,  // Incremento de velocidad base por rebote en pared
  BASE_SPD_CAP: 21,    // Velocidad base máxima (antes de rage)
  RAGE_MULT: 3.5,      // Multiplicador de velocidad en modo rage
  RAGE_FRAMES: 300,    // Duración del rage (frames, 60fps → 5 segundos)
  STALL_FRAMES: 360,   // Frames sin acción antes de forzar orb
  TRAIL_LEN: 10,       // Longitud del trail visual de cada bola
  ROUNDS_TO_WIN: 3,    // Victorias necesarias para ser campeón
  COUNT: 4,            // Jugadores por partida (se sobreescribe aleatoriamente en start())
  COLORS: [...],       // 15 colores posibles para bolas
  NAMES: [...],        // 15 nombres posibles (Red, Blue, Green...)
  TEAM_COLORS: [...],  // 4 colores de equipos
  TEAM_NAMES: [...],   // 4 nombres de equipos (RED, BLUE, GREEN, GOLD)
};
```

**Para cambiar rápidamente:**
- Más HP → `MAX_HP: 40`
- Partidas más largas → `ROUNDS_TO_WIN: 5`
- Bolas más grandes → `BALL_R: 50`
- Siempre 8 jugadores → cambiar `6 + Math.floor(Math.random() * 10)` por `8` en `G.start()`

---

## 6. Layout del canvas

```
Canvas: 1080 × 1920 px (resolución interna, mostrado a 540×960 en pantalla)
Ratio: 9:16 (vertical, ideal para TikTok/Shorts)

┌────────────────────────┐ Y=0
│      TITLE BAR         │ Y=0–195
│  "ARENA BALL ANIME"    │
│  Round X / N · Timer  │
├────────────────────────┤ Y=195
│                        │
│       ARENA            │ Centro: ACX=540, ACY=735
│   (círculo o polígono) │ Radio: AR=540
│                        │
├────────────────────────┤ Y=1230
│                        │
│     LEADERBOARD        │ LB_Y=1410, barras de daño
│   (top 4 barras)       │ LB_BAR_H=87, LB_BAR_GAP=24
│                        │
└────────────────────────┘ Y=1920

Constantes de layout:
  ACX = W/2 = 540    (centro X de arena)
  ACY = 735          (centro Y de arena)
  AR  = 540          (radio máximo de arena)
  LB_X = 60          (borde izquierdo del leaderboard)
  LB_Y = 1410        (Y del primer bar)
  LB_BAR_H = 87      (altura de cada barra)
  LB_BAR_GAP = 24    (espacio entre barras)
  LB_BAR_MAX = 960   (ancho máximo de barra = W-120)
  LB_BALL_R = 33     (radio del icono de bola en la punta de la barra)
```

---

## 7. Sistema de física

### Colisiones bola-pared (`wallBounce`)
- Llama a `isInsideArena()` para comprobar si la bola está dentro de la forma activa
- Si está fuera, llama a `pushInsideArena()` que la reposiciona y refleja la velocidad
- Al rebotar: `wallSpeedUp()` incrementa `baseSpd` en un 5%, sonido de pared
- Excepción: si `ghostFrames > 0`, la bola atraviesa la pared (se teletransporta al otro lado si se aleja demasiado)

### Colisiones bola-bola (`ballPair`)
- Detección por distancia: `d < a.r + b.r`
- Resolución: separación por solapamiento, intercambio de impulsos elástico
- Cooldown de 20 frames entre el mismo par (evita daño múltiple)
- Daño: cada colisión resta 1 HP a ambas bolas (`ball.hit()`)
- Al morir: la bola superviviente entra en `rage` (velocidad x3.5 durante 5s), +1 kill streak, HP doble (se decae a base en 5s)
- Equipos: bolas del mismo equipo no se dañan (solo se empujan)

### Velocidad
- Al spawnear: velocidad aleatoria entre `MIN_SPD` y `MAX_SPD`, apuntando al centro ±45°
- Cada rebote en pared aumenta `baseSpd` ligeramente (cap en `BASE_SPD_CAP`)
- Hard cap en 28 px/frame (previene bolas que se escapan del layout)
- `REST_B = 0.98`: pequeña pérdida de energía por colisión (evita velocidad infinita)

---

## 8. Clase Ball

```javascript
class Ball {
  // Identidad
  id          // índice único (0..COUNT-1)
  name        // nombre del personaje (Red, Blue, etc.)
  color       // color hexadecimal
  teamId      // id del equipo (-1 en modo solo)

  // Física
  x, y        // posición
  vx, vy      // velocidad
  r           // radio (C.BALL_R por defecto, crece con giant)
  baseSpd     // velocidad base actual (aumenta con rebotes)
  trail[]     // últimas 10 posiciones (para el trail visual)

  // Estado de combate
  alive       // boolean — false cuando hp <= 0
  hp          // HP actual
  max         // HP máximo
  bonusHp     // HP extra por kill (decae en 5s)
  flash       // frames de flash blanco al ser golpeado
  rage        // frames restantes de rage
  streak      // kills consecutivos sin morir

  // Habilidades activas (contadores de frames)
  shieldFrames    // escudo activo — absorbe el siguiente golpe
  ghostFrames     // atraviesa paredes
  giantFrames     // tamaño aumentado
  giantActive     // boolean
  magnetFrames    // atrae a otras bolas
  freezeFrames    // ralentizado
  blackHoleFrames // atrae todas las bolas al centro
  kamehame        // boolean — próximo golpe es kill instantáneo

  // Leaderboard
  score           // kills*100 + daño
  lbRank          // posición actual en el ranking
  lbY             // posición Y animada en las barras
  lbRankUpFlash   // frames de flash al subir de posición
}
```

**Métodos importantes:**

| Método | Descripción |
|---|---|
| `move()` | Actualiza posición, trail, timers, aplica efectos de timestop/prison/sandevistan/freeze/magnet/blackhole |
| `hit()` | Resta 1 HP. Si hay escudo, absorbe y no hace daño. Si HP llega a 0, marca `alive=false` |
| `triggerRage()` | Activa rage: velocidad multiplicada por `RAGE_MULT` durante `RAGE_FRAMES` |
| `wallSpeedUp()` | Aumenta `baseSpd` un 5% al rebotar en pared |
| `cap()` | Limita velocidad al cap según si está en rage o no |
| `addScore(pts)` | Suma puntos al score |

---

## 9. Estado del juego (G)

El objeto `G` es el estado global de la partida. Sus propiedades más importantes:

```javascript
const G = {
  // Estado general
  state: 'idle'      // 'idle' | 'countdown' | 'running' | 'roundEndDelay' |
                     // 'roundEnd' | 'podium' | 'champion'
  balls: []          // array de Ball activos
  teamMode: false    // modo equipos

  // Rondas
  round: 0           // ronda actual (1-based)
  rounds_to_win: 3   // definido en C.ROUNDS_TO_WIN
  roundWins: []      // victorias por id (ball.id o team.id)
  roundTimer: 0      // timer de pausa entre rondas (cuenta atrás)
  roundWinner: null  // ganador de la ronda actual (Ball o team object)
  roundFrames: 0     // frames transcurridos en la ronda actual
  champion: null     // campeón de la partida

  // Daño
  roundDmg: []       // daño total en la ronda por id
  totalDmg: []       // daño acumulado en la partida por id
  dmgFlash: []       // frames de flash en barra al recibir daño

  // Efectos
  shakeFrames: 0     // frames de shake de pantalla
  shakeAmt: 0        // intensidad del shake
  arenaFlash: {color, alpha}  // flash de color en la arena

  // Sudden Death (a los 25s)
  suddenDeathActive: false   // true cuando el arena empieza a encogerse

  // Podio
  podiumSlot: 0      // índice actual en la secuencia del podio
  podiumPhase: 0     // frame dentro del slot actual
  podiumTimer: 0     // timer total del podio

  // Leaderboard
  lbWidths: []       // anchos animados de las barras (lerped)
  lbTargets: []      // anchos objetivo de las barras
}
```

**Máquina de estados:**

```
idle
 └─ begin() ──→ countdown (1s)
                 └─ countdown termina ──→ running (45s máx)
                                           ├─ todos eliminados ──→ roundEndDelay (2.5s)
                                           │                        └─ resolveRoundEnd()
                                           │                            ├─ si hay campeón ──→ podium → champion
                                           │                            └─ si no ──→ roundEnd (1.5s) → startRound() → countdown
                                           └─ tiempo agotado ──→ roundEndDelay
```

---

## 10. Modos de juego

### Modo Individual (FFA)
- Todos contra todos
- El ganador de cada ronda es el último sobreviviente
- Si se agota el tiempo: ganador = el que tenga más HP vivo; en empate = más daño en la ronda
- Leaderboard muestra top 4 por daño en la ronda actual

### Modo Equipos
- 2–4 equipos con colores: ROJO, AZUL, VERDE, DORADO
- Distribución aleatoria de jugadores (al menos 1 por equipo)
- Bolas del mismo equipo no se dañan entre sí
- Ganador de ronda = último equipo con miembros vivos
- Leaderboard muestra equipos con contador de miembros vivos

### Modo Boss

Un jugador aleatorio se convierte en el boss; el resto son hunters que cooperan para derrotarlo.

**Constantes del boss:**
- `BOSS.R`: 120 (radio del boss, 3x una bola normal)
- `BOSS.HP`: 500
- `BOSS.DMG_OUT`: 2 (daño que el boss inflige a hunters)
- `BOSS.DMG_IN`: 1 (daño que el boss recibe por colisión)
- `BOSS.DMG_IN_CAP`: 3 (cap de daño por habilidad burst, limita la ráfaga de abilities)
- Hard speed cap: 42

**Hunters:**
- HP = `MAX_HP * 5` = 125 HP
- Solo atacan al boss (`isEnemy` filtra: hunters target boss, boss targets hunters)

**Mecánicas:**
- Boss timer: 8400 frames (2:20 a 60fps)
- Sudden death at 6600 frames (1:50)
- Boss no recoge orbs (se salta en el collision loop)
- Boss no recibe habilidades forzadas durante stall
- Orbs spawn 2x más rápido (`ORB_SPAWN_INTERVAL / 2`)
- Winner text: "HUNTERS WIN!" / "BOSS WINS!" (no nombre individual)

---

## 11. Sistema de rondas

### Duración
- **45 segundos** por ronda (`ROUND_DURATION = 2700` frames a 60fps)
- **Sudden Death** se activa a los **25 segundos** (`SD_START = 1500` frames)

### Sudden Death
- La arena empieza a encogerse progresivamente
- Al acabar los 45s, el radio se reduce al **15% del original** (`minR = AR * 0.15`)
- Los balls quedan apretados inevitablemente — fuerza el fin de la ronda

### Countdown
- Full 3-2-1-GO sequence with bounce easing, per-number colors, and shockwave rings
- La música y grabación solo inician en la primera ronda

### Transición
- Elastic bounce animation, glitch wipe bars, iridescent accents al inicio de cada ronda
- Muestra "ROUND X" en texto gigante que escala desde el centro

### Fin de ronda
- **roundEndDelay** (2.5s): la física se congela, los FX terminan, se reproduce cinemática del ganador
- **roundEnd** (1.5s): pantalla de resultados con standings, barras de progreso de victorias
- Si alguien llega a `ROUNDS_TO_WIN` victorias → **podium** → **champion**

### Podio
- Secuencia de 0.75s por jugador, de peor a mejor
- Muestra bola, nombre, daño total, victorias de ronda
- Al terminar: pantalla de campeón (3s) → para la grabación

---

## 12. Arena — formas y poderes

### Formas disponibles
```javascript
const ARENA_SHAPES = [
  'circle',    // ponderado x3 (más común)
  'square',
  'triangle',
  'pentagon',
  'hexagon',
  'diamond',
];
```

La forma se elige aleatoriamente al inicio de cada **partida** (no cambia entre rondas). Para polígonos, `ARENA.getVerts(r)` devuelve los vértices según la forma activa.

### Poderes de arena (orbs especiales)

| ID | Efecto |
|---|---|
| `arena_split` | Divide la arena en 2 zonas con una pared resplandeciente durante ~40 frames |
| `arena_shrink` | Activa `ARENA.shrinkFrames` que encoge gradualmente la arena durante 480 frames |
| `arena_chaos` | Activa `ARENA.chaosFrames` que aplica gravedad caótica aleatoria durante 300 frames |

### Objeto ARENA
```javascript
ARENA = {
  shape: 'circle',     // forma actual
  r: AR,               // radio actual (puede encogerse)
  splitActive: false,  // split activo
  splitFrames: 0,      // frames restantes del split
  splitAngle: 0,       // ángulo de la línea divisoria
  shrinkFrames: 0,     // frames restantes del shrink
  chaosFrames: 0,      // frames restantes del chaos
  chaosAngle: 0,       // dirección de gravedad caótica
  getVerts(r): []      // devuelve vértices del polígono para radio r
  pick()               // elige forma aleatoria para nueva partida
}
```

---

## 13. Orbs (habilidades)

### ¿Qué es un orb?
Un orb es un objeto flotante en la arena que cualquier bola puede recoger al colisionar con él. Al recogerlo se ejecuta la habilidad del orb sobre esa bola.

### Ciclo de vida de un orb
1. **Spawn**: `spawnOrb()` crea un orb en posición aleatoria dentro de la arena (rejection sampling con `isInsideArena()`, usa `ARENA.r` — radio vivo — en lugar de `AR` constante)
2. **Flotación**: pulsa visualmente con `o.pulse` (fase aleatoria por orb)
3. **Recogida**: `tickOrbs()` detecta colisión bola-orb → llama `applyOrb(ball, orb.type)` → elimina el orb
4. **Caducidad**: `ORB_LIFETIME = 600` frames (10s), luego desaparece

### Tasas de spawn
| Situación | Intervalo | Variable |
|---|---|---|
| Normal | 1 orb cada 5s | `ORB_SPAWN_INTERVAL = 300` |
| Primeros 5s de ronda | 1 orb cada ~0.9s | `ORB_SPAWN_FAST = 55` |
| Modo flood (estancamiento) | 1 orb cada ~0.67s | `ORB_STALL_RATE = 40` |

### Anti-stall (anti-estancamiento)
Si pasan **2.5 segundos sin daño** (`OBR_STALL_TRIGGER = 150` frames), el sistema activa el modo flood que genera orbs masivamente. Si pasan **6 segundos sin daño** (`ORB_FORCE_TRIGGER = 360` frames), se fuerza la aplicación de una habilidad aleatoria a cada bola viva.

---

## 14. Lista completa de habilidades

### GOJO SATORU (JJK)
| ID | Nombre | Efecto |
|---|---|---|
| `gojo_blue` | GOJO BLUE | Atrae a todos los enemigos hacia la bola |
| `gojo_red` | GOJO RED | Explosión que repele a todos + daño AoE |
| `gojo_purple` | HOLLOW PURPLE | Rayo void que atraviesa la arena de extremo a extremo |

### VARIOS (JJK / League of Legends / Cyberpunk)
| ID | Nombre | Efecto |
|---|---|---|
| `sandevistan` | SANDEVISTAN | El mundo se ralentiza al 50%, el owner no. Dura 4s. Activa trail cyan |
| `timestop` | TIME STOP | Congela a todos los enemigos. El owner puede golpearlos libremente |
| `rewind` | REWIND | Retrocede la posición de la bola ~2s atrás (usa historial de posiciones) |
| `toji_chain` | TOJI CHAIN | Cadenas que golpean a todos los enemigos cercanos |
| `ekko_ult` | CHRONOBREAK | Retrocede posición + explosión AoE al regresar |
| `prison` | PRISON | Atrapa a un enemigo aleatorio en una jaula de barras de fuego |
| `portal` | PORTAL | Teletransporta la bola a una posición aleatoria de la arena |

### JJK (Jujutsu Kaisen)
| ID | Efecto resumido |
|---|---|
| `sukuna_cleave` | Tajo en X + zona de maldición rotante |
| `mahoraga` | Zona de adaptación que aplica daño continuo |
| `piercing_blood` | Chorros de sangre en todas direcciones |
| `rika` | Espíritu que jala y daña enemigos cercanos |
| `hakari` | Caos visual total, rotación de estrellas de colores |

### NARUTO
| ID | Efecto resumido |
|---|---|
| `rasengan` | Proyectil espiral que empuja al impactar |
| `chidori` | Rayo eléctrico que atraviesa en línea recta |
| `tsukuyomi` | Ilusión que atrapa al objetivo en loop durante 3s |
| `hiraishin` | Teletransporte instantáneo al lado del enemigo más cercano |
| `sand_tsunami` | Ola de arena que empuja a todos los enemigos |

### BLACK CLOVER
| ID | Efecto resumido |
|---|---|
| `hellfire` | Aura de fuego que escala en intensidad con cada tick |
| `spatial_cube` | Cubos que aprisionan a enemigos suprimiendo sus habilidades |
| `zephyr` | Cuchilla de viento giratoria con estrellas orbitales |
| `black_asta` | Aura anti-magia que devora habilidades enemigas cercanas |
| `yami_slash` | Tajo dimensional void de extremo a extremo |

### SLIME ISEKAI (Tensura)
| ID | Efecto resumido |
|---|---|
| `drago_nova` | Explosión estelar con fragmentos que persiguen enemigos |
| `megiddo` | Lluvia de rayos divinos desde el techo |
| `veldora_storm` | Tormenta espiral que consume la arena |
| `prominence` | Cono de fuego de dragón en la dirección del enemigo |
| `diablo_end` | Vórtice oscuro que absorbe y cura al owner |

### CHAINSAW MAN
| ID | Efecto resumido |
|---|---|
| `chainsaw_rev` | Sierra giratoria con 4 brazos que devora todo |
| `blood_rain` | Lluvia de lanzas de sangre desde arriba |
| `makima_chain` | Cadenas de control que conectan al owner con todos los enemigos |
| `future_devil` | Aura que predice y contraataca golpes entrantes |
| `pochita_core` | Explosión del diablo origen: nova de fuego naranja |

### ONE PUNCH MAN
| ID | Efecto resumido |
|---|---|
| `serious_punch` | Un golpe que genera shockwave masivo hacia adelante |
| `incinerate` | Cañón de incineración en línea recta |
| `tornado_psy` | Telekinesis: espiral que arrastra todo al centro |
| `silver_fang` | Onda de artes marciales expansiva |
| `sonic_slash` | Múltiples cortes sónicos en todas direcciones |

### FRIEREN
| ID | Efecto resumido |
|---|---|
| `zoltraak` | Orbes mágicos devastadores en todas direcciones |
| `granat` | Esfera mágica que crece y explota al máximo radio |
| `aura_soul` | Drena vida de todos los enemigos hacia el owner |
| `stark_thunder` | Rings de trueno expansivos que electrocutan al contacto |
| `frieren_end` | Allmächtig: anillo de hielo con fragmentos que persiguen |

### THE EMINENCE IN SHADOW
| ID | Efecto resumido |
|---|---|
| `i_am_atomic` | Explosión total que borra todo en la arena |
| `shadow_slash` | Tajo de sombra diagonal que atraviesa la arena |
| `delta_frenzy` | 3 slashes simultáneos a cada enemigo |
| `gamma_laser` | Rayo de precisión al enemigo más cercano |
| `beta_twin` | Espadas gemelas barren a todos los enemigos |

### OVERLORD
| ID | Efecto resumido |
|---|---|
| `ainz_death` | Zona de muerte instantánea en el centro |
| `albedo_fort` | Escudo indestructible durante 4s |
| `shalltear_rage` | Aura de furia que absorbe vida cercana |
| `cocytus_freeze` | Zona de hielo que congela a todos los enemigos |
| `demiurge_hell` | 8 tentáculos del infierno que irradian desde el centro |

### NORAGAMI
| ID | Efecto resumido |
|---|---|
| `yato_sekki` | 8 cortes sagrados radiales + daño doble |
| `yukine_burst` | Explosión de luz sagrada pulsante |
| `bishamon_array` | Array de 5 espadas que caen desde arriba |
| `nora_bind` | Cuentas malditas que congelan a los enemigos |
| `veena_storm` | Tormenta de relámpagos sagrados en 10 puntos |

### MUSHOKU TENSEI
| ID | Efecto resumido |
|---|---|
| `quagmire` | Zona de colapso espacio-temporal que ralentiza y daña |
| `north_god` | Velocidad extrema + combo de golpes múltiples |
| `orsted_dragon` | Aura de dragón que aplasta a todos cercanos |
| `roxy_water` | Cañón de agua en línea recta |
| `sylphie_wind` | Tormenta de viento que dispersa a todos |

### DATE A LIVE
| ID | Efecto resumido |
|---|---|
| `zafkiel` | Bala del tiempo que roba HP al objetivo |
| `sandalphon` | Trono que cae y aplasta la arena |
| `origami_angel` | Lluvia de plumas de luz que dañan al contacto |
| `shido_seal` | Sella poderes y atrae a todos hacia el owner |
| `miku_gabriel` | Ondas sónicas que destrozan la arena |

---

## 15. Sistema FX

El objeto `FX` almacena el estado de todos los efectos visuales activos. Tiene tres secciones:

### FX (propiedades — estado activo de efectos)
Cada habilidad con efecto visual tiene su propiedad correspondiente:
```javascript
FX = {
  // Efectos de zona/aura
  sandevistanFrames: 0,   // frames restantes de sandevistan
  sandevistanOwner: -1,   // ball.id del owner
  timestopFrames: 0,
  timestopOwner: -1,
  hellfireZone: null,     // {x,y,r,intensity,life,max}
  rikaZone: null,
  mahoragaZone: null,
  quagmireZone: null,
  // ... etc para cada habilidad

  // Arrays de efectos múltiples
  explosions: [],         // [{x,y,r,color,life,max}]
  chains: [],             // [{x1,y1,x2,y2,type,life,max}]
  portals: [],            // [{x,y,color,type,life}]
  ekkoGhosts: [],
  deltaSlashes: [],
  yatoCuts: [],
  bishArr: [],            // flechas de bishamon
  // ... etc

  tick(balls)             // actualiza todos los efectos cada frame
  reset()                 // resetea todo al inicio de ronda
}
```

### FX.tick(balls)
Se llama cada frame durante `G.state === 'running'`. Para cada efecto activo:
- Decrementa `life` o `frames`
- Aplica efectos físicos (atracción, daño de zona, movimiento de proyectiles)
- Genera partículas secundarias
- Cuando `life <= 0`: lo pone a `null` o lo elimina del array

### FX.reset()
Se llama en `G.spawnBalls()` al iniciar cada ronda. Pone todos los efectos a null/0/[].

---

## 16. Cámara cinemática (CAM)

El sistema de cámara (`CAM`) crea momentos cinemáticos cuando una bola recoge un orb poderoso.

### Fases de la cámara
```
off → pickup (0.9s) → follow (1.5s) → impact (variable) → fadeout (0.67s) → off
```

| Fase | Efecto | Velocidad física |
|---|---|---|
| `off` | Sin efecto | 1.0x (normal) |
| `pickup` | Zoom in hacia la bola que recoge el orb | 0.55x |
| `follow` | Sigue al objetivo con reticle | 0.65x |
| `impact` | Zoom + flash + texto de resultado | 0.45x |
| `fadeout` | Desenfoca y vuelve a normal | 0.75x → 1.0x |

### Efectos visuales de la cámara (`drawCinematic`)
- **Viñeta**: gradiente radial oscuro desde el foco
- **Aberración cromática**: franjas roja/azul en los bordes
- **Speed lines**: líneas radiales desde el foco (en fase pickup)
- **Flash ring**: anillo de color que se expande (en fase pickup)
- **Targeting reticle**: 4 corchetes + punto central que sigue al objetivo (en fase follow)
- **Impact flash**: overlay de color de la habilidad
- **Texto de resultado**: "HIT!", "MISS!", "LASER!", etc. con escala

### Wide-shot vs zoom
- **Wide-shot** (`tgtZoom = 1.15`): habilidades de área (timestop, gojo_red, mahoraga, tornado_psy, arena_split/shrink/chaos)
- **Zoom normal** (`tgtZoom = 2.4`): habilidades dirigidas (chains, lasers, slashes)

### hasFollow list
26 abilities trigger camera follow on pickup.

### Projectile tracking
Projectiles tracked dynamically in `fx.js` tick — camera follows them in flight:
`rasengan`, `seriousPunch`, `zafkielBullet`, `bloodStreams`, `bloodSpears`, `zoltraakBeams`, `bishArr`, `origamiFeathers`, `zephyrBlade`

### CAM.impact on hit
`CAM.impact` is triggered when these projectiles connect:
`bloodSpears`, `seriousPunch`, `zoltraakBeams`, `bishArr`, `origamiFeathers`, `zafkielBullet`

### Fixed camera abilities
These abilities use a fixed camera (no follow/tracking):
`megiddo`, `blood_rain`, `sonic_slash`, `i_am_atomic`, `makima_chain`, `nora_bind`

---

## 17. Partículas

Sistema minimalista de partículas tipo sprite:

```javascript
// Estructura de cada partícula
{ x, y,          // posición actual
  vx, vy,        // velocidad
  r,             // radio
  color,         // color hexadecimal
  life,          // frames restantes
  max }          // frames totales (para calcular alpha = life/max)
```

### Funciones

| Función | Descripción |
|---|---|
| `burst(x, y, color, n=16)` | Explosión de N partículas en forma de estrella |
| `ringBurst(x, y, color)` | 8 partículas en ring (usado para rank-up en leaderboard) |
| `tickParts()` | Mueve todas las partículas, aplica fricción (0.90), elimina las que caducan |

Las partículas se renderizan dentro del clip de la arena (no salen de ella).

---

## 18. Sistema de audio (Snd)

IIFE que encapsula toda la lógica de audio:

### Música
- **10 pistas MP3** en la carpeta `music/`
- Se elige una aleatoriamente al inicio de cada partida
- Volumen base: 0.35, máximo: 0.80
- **Sube de volumen con cada kill** (`+0.055` por kill)
- **Sube ligeramente con cada orb recogido** (`+0.025`)
- Se detiene y resetea al iniciar nueva partida

### Efectos de sonido (Web Audio API)
Todos los sonidos se generan proceduralmente con osciladores:

| Método | Cuándo suena |
|---|---|
| `Snd.wall()` | Rebote en pared |
| `Snd.hit()` | Colisión entre bolas |
| `Snd.kill()` | Eliminación |
| `Snd.heal()` | HP overheal tras kill |
| `Snd.win()` | Victoria de ronda |
| `Snd.champion()` | Campeón coronado |
| `Snd.countdown()` | Beep de countdown |
| `Snd.lastTwo()` | "FINAL 2!" |
| `Snd.rankUp()` | Bola sube en el leaderboard |
| `Snd.orbPickup(id)` | Sonido único por cada habilidad (80+ sonidos distintos) |

### Grabación de audio
`Snd.create()` crea un `MediaStreamDestination` que se mezcla con el stream del canvas para que el MP4 tenga audio. Esto es lo que hace que el botón "Auto" deba esperar a que `musicReady` se resuelva antes de iniciar `Rec.start()`.

### Inicialización
- `initCtx()` se llama síncronamente dentro de los click handlers de los botones (user gesture requerido por el navegador)
- `create()` cierra el `AudioContext` anterior antes de crear uno nuevo (evita leaks de contextos acumulados)

---

## 19. Grabación de vídeo (Rec)

```javascript
Rec.start()   // inicia MediaRecorder con canvas + audio stream
Rec.stop()    // detiene la grabación y dispara la descarga del archivo
```

### Formato
- Prueba formatos en orden: `mp4/avc1`, `mp4`, `webm/vp9`, `webm/vp8`, `webm`
- Bitrate de vídeo: 8 Mbps
- Resolución: 1080×1920
- FPS objetivo: 60fps (aunque el tab limitará esto según el hardware)
- Canvas de grabación (`#recordCanvas`) es idéntico al display pero oculto

### Descarga
- Nombre del archivo: `grabaciones/Arena Ball Anime - Part N.mp4`
- La carpeta `grabaciones/` debe existir en el servidor (o la descarga irá al directorio de descargas del navegador)

---

## 20. Modo Auto-batch

Graba hasta 10 partidas consecutivas sin intervención.

```javascript
// Variables de control
autoBatchActive   // boolean — batch en curso
autoBatchPart     // número de partida actual (1..10)
AUTO_BATCH_MAX    // 10 (constante)
autoBatchSequence // array pre-generado de ['solo','team',...]
forcedMode        // 'solo' | 'team' | null
```

### `buildBatchSequence()`
Genera un array de 10 elementos con al menos 3 'solo', 3 'team', 3 'boss' y 1 random, luego los baraja. Esto garantiza diversidad de contenido en el batch.

### Flujo
1. `beginAuto()` → `autoBatchActive=true`, genera secuencia, llama `begin()`
2. Cada partida usa `autoBatchSequence[autoBatchPart-1]` para decidir el modo
3. Al terminar cada partida (estado `champion` + 3s), `Rec.stop()` dispara descarga
4. En `mr.onstop`: si aún hay partes, espera 2.5s y llama `begin()` de nuevo
5. Al llegar a `AUTO_BATCH_MAX`: `autoBatchActive=false`, habilita botones

---

## 21. Sistema de leaderboard

Barras animadas en la parte inferior del canvas:

### Modo individual
- Muestra top 4 por **daño infligido en la ronda actual**
- Las barras se animan con interpolación suave: `lbWidths[id] += (target - lbWidths[id]) * 0.08`
- Las barras se ordenan verticalmente de forma animada cuando cambia el ranking
- Flash dorado al subir de posición (`lbRankUpFlash`)
- Indicadores: nombre, daño, victorias de ronda, badge "OUT" si está eliminado, badge de streak

### Modo equipos
- Muestra todos los equipos con contador de miembros vivos (`X/N`)
- Barras por daño total del equipo en la ronda
- Las barras de equipos eliminados (0 miembros) se oscurecen

---

## 22. Pipeline de render (draw)

La función `draw(ctx)` se llama cada frame y renderiza todo en orden:

```
1. Screen shake (ctx.translate — scoped to arena content only; title bar, leaderboard, boss HP bar never shake)
2. Cinematic zoom (ctx.scale alrededor del foco)
3. bgOff (fondo estático pre-renderizado)
4. Arena ring (rainbow iridiscente o crimson en sudden death)
5. ctx.clip() — todo lo siguiente se recorta a la arena
6. Arena fill (#030306)
7. Arena flash (overlay de color al recibir daño)
8. Speed lines (si velocidad > 6)
9. Beat pulse scanlines (cada 28 frames si hay velocidad)
10. Partículas
11. drawOrbs() — orbs flotantes
12. drawFX() — efectos de habilidades
13. Countdown timer (número grande si quedan ≤10s)
14. Trails de bolas
15. Cuerpos de bolas (gradiente radial + specular)
16. Efectos sobre bolas: shield ring, ghost glow, kamehame glow, freeze aura, magnet lines, black hole ring, sandevistan ring, timestop halo, prison highlight
17. Texto dentro de la bola (HP)
18. Nombre sobre la bola
19. Barra de HP
20. ctx.restore() — fin del clip de arena
21. ctx.restore() — fin del zoom cinemático
22. drawCinematic() — overlay cinemático (viñeta, speed lines, reticle, texto)
23. Title bar (nombre del juego + round + timer)
24. drawLeaderboard() — si no es podium/champion
25. Countdown "1" / "GO!" overlay
26. Intro hype screen — "WHO WILL WIN?" overlay (solo round 1, primeros 120 frames de `running`, grabado)
27. drawWinnerCinematic() — durante roundEndDelay
28. drawRoundEnd() — durante roundEnd
29. drawPodium() — durante podium
30. drawChampion() — durante champion
31. drawLastTwo() — "FINAL 2!" banner
32. drawRoundTransition() — flash de inicio de ronda
33. Sudden death banner (si aplica)
34. ctx.restore() — fin del screen shake
```

---

## 23. Loop principal

```javascript
let lastT = 0;
const TARGET_MS = 1000/60;  // ~16.67ms para 60fps

function loop(t) {
  requestAnimationFrame(loop);
  if(t - lastT < TARGET_MS - 0.5) return;  // frame skip
  lastT = t;

  // Lógica por estado:
  // roundEndDelay: tickParts, decrementar timer, llamar resolveRoundEnd
  // roundEnd: decrementar roundTimer, llamar startRound
  // podium: avanzar podiumPhase/podiumSlot, transición a champion
  // champion: timer, parar Rec a los 3s
  // countdown: decrementar, crear AudioContext y Rec.start() en round 1
  // running: CAM.tick, b.move(), wallBounce, ballPair, tickOrbs, FX.tick,
  //          cooldowns, tickParts, updateLeaderboard, dmgFlash, lastTwoTimer, checkEnd

  draw(dc);       // render al canvas display
  pushToRec();    // copiar display al canvas de grabación
}

requestAnimationFrame(loop);
```

**El frame counter (`frame`)** es una variable global que se incrementa dentro de `draw()` cada frame. Se usa en todos los efectos visuales para animaciones basadas en tiempo (sin `Date.now()`).

---

## 24. Cómo añadir una nueva habilidad

La arquitectura usa 3 módulos principales. Los cambios se hacen en este orden:

| Paso | Archivo | Sección |
|------|---------|---------|
| 1 | `js/abilities.js` | Array `ORB_TYPES[]` |
| 2 | `js/audio.js` | `Snd.orbPickup()` switch |
| 3 | `js/fx.js` | Objeto `FX` (estado + tick + reset) |
| 4 | `js/abilities.js` | `applyOrb()` switch |
| 5 | `js/draw.js` | `drawFX()` function |

### Paso 1: Definición en `js/abilities.js` → `ORB_TYPES[]`
Añadir al final del array (antes del `]`):
```javascript
{ id:'mi_habilidad',
  emoji:'⚡',
  color:'#ff0099',
  name:'MI HABILIDAD',
  desc:'Descripción corta',
  char:'NOMBRE PERSONAJE'
},
```

### Paso 2: Sonido en `js/audio.js` → `Snd.orbPickup()`
Añadir un `case` en el switch de `orbPickup()`:
```javascript
case 'mi_habilidad':
  tone(440, 0.1, 'sine', 0.18);
  setTimeout(()=>tone(880, 0.15, 'sine', 0.22), 100);
  break;
```

### Paso 3: Estado en `js/fx.js` → objeto `FX`
Si la habilidad tiene efecto visual persistente, hay 3 lugares dentro de `fx.js`:
```javascript
// 1. En las propiedades del objeto FX (junto a los demás campos):
miEfecto: null,  // {x, y, r, life, max, ownerId}

// 2. En FX.tick(balls, frame):
if(this.miEfecto){
  this.miEfecto.life--;
  // lógica de daño/movimiento aquí
  if(this.miEfecto.life <= 0) this.miEfecto = null;
}

// 3. En FX.reset():
this.miEfecto = null;
```

### Paso 4: Lógica de activación en `js/abilities.js` → `applyOrb()`
Añadir un `case` en el switch de `applyOrb()`:
```javascript
case 'mi_habilidad':
  { // Crear el efecto
    FX.miEfecto = {x: ball.x, y: ball.y, r: 0, life: 120, max: 120, ownerId: ball.id};
    // Daño inmediato si aplica
    G.balls.forEach(b => {
      if(!b.alive || !isEnemy(ball, b)) return;
      const d = Math.hypot(b.x - ball.x, b.y - ball.y);
      if(d < 150) { b.hit(); addDmg(ball, 20); }
    });
    // Partículas
    burst(ball.x, ball.y, '#ff0099', 24);
    // Shake y flash
    G.arenaFlash.color = '#ff0099'; G.arenaFlash.alpha = 0.4;
    G.shakeFrames = 20; G.shakeAmt = 14;
    // Cámara
    CAM.setFollow(ball.x, ball.y, ball.id);
    setTimeout(() => {
      const bk = G.balls.find(b => b.id === ball.id);
      if(bk) CAM.impact(bk.x, bk.y, '#ff0099', 'MI TEXTO!', ball.id);
    }, 250);
  } break;
```

### Paso 5: Render en `js/draw.js` → `drawFX()`
Añadir el bloque de dibujo dentro de `drawFX(ctx, frame)`, junto a las demás habilidades de la misma sección temática:
```javascript
// ── Mi habilidad ──
if(FX.miEfecto) {
  const me = FX.miEfecto, prog = me.life / me.max;
  ctx.globalAlpha = prog * 0.8;
  ctx.strokeStyle = '#ff0099'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.arc(me.x, me.y, me.r, 0, Math.PI*2); ctx.stroke();
  // partículas por frame
  if(frame % 3 === 0) parts.push({
    x: me.x + (Math.random()-0.5)*me.r,
    y: me.y + (Math.random()-0.5)*me.r,
    vx: (Math.random()-0.5)*3, vy: (Math.random()-0.5)*3,
    r: 5, color: '#ff0099', life: 15, max: 15
  });
  ctx.globalAlpha = 1;
}
```

---

## 25. Cómo añadir una nueva forma de arena

### Paso 1: Añadir el nombre en `ARENA_SHAPES` (`js/arena.js`)
```javascript
const ARENA_SHAPES = ['circle','circle','circle','square','triangle','pentagon','hexagon','diamond', 'star'];
// Repetir más veces para que salga con más frecuencia
```

### Paso 2: Añadir la lógica de vértices en `ARENA.getVerts()` (dentro del objeto ARENA)
```javascript
getVerts(r) {
  switch(this.shape) {
    case 'star':
      // Estrella de 5 puntas: alterna radios
      const pts = [];
      for(let i = 0; i < 10; i++) {
        const a = (Math.PI*2/10)*i - Math.PI/2;
        const radius = i % 2 === 0 ? r : r * 0.45;
        pts.push({ x: ACX + Math.cos(a)*radius, y: ACY + Math.sin(a)*radius });
      }
      return pts;
    // ... otros cases
  }
}
```

`arenaPath()`, `pushInsideArena()` e `isInsideArena()` funcionan automáticamente para cualquier polígono devuelto por `getVerts()` sin cambios adicionales.

---

## 26. Cómo cambiar el número de jugadores

### Número fijo
En `G.start()` (`js/game.js`), cambiar:
```javascript
C.COUNT = 6 + Math.floor(Math.random() * 10); // aleatorio 6-15
// por:
C.COUNT = 8; // siempre 8 jugadores
```

### Rango personalizado
```javascript
C.COUNT = 4 + Math.floor(Math.random() * 12); // 4-15 jugadores
```

### Límites prácticos
- **Mínimo recomendado:** 4 (con menos, los combates son muy cortos)
- **Máximo recomendado:** 15 (más de 15 puede saturar visualmente la arena)
- Los colores y nombres están definidos para 15: `C.COLORS` y `C.NAMES` tienen 15 entradas cada uno

---

## 27. Cómo cambiar la música

Los archivos de música están en la carpeta `music/` y se listan en:

```javascript
const MUSIC_FILES = [
  'music/SpotiDown.App - BACK_ - c152.mp3',
  'music/SpotiDown.App - Bad Habits - c152.mp3',
  // ... 10 archivos en total
];
```

**Para añadir canciones:**
1. Copiar el archivo MP3 a la carpeta `music/`
2. Añadir la ruta al array `MUSIC_FILES`

**Para usar solo una canción:**
```javascript
const MUSIC_FILES = ['music/mi_cancion.mp3'];
```

**Para cambiar el volumen base:**
```javascript
const MUSIC_VOL_BASE = 0.35;  // 0.0 (silencio) a 1.0 (máximo)
const MUSIC_VOL_MAX  = 0.80;  // máximo que puede llegar con kills
```

---

## 28. Errores comunes y soluciones

### `fetch` falla / música no carga
**Causa:** Abrir el archivo directamente en el navegador (`file://`) en lugar de desde un servidor HTTP.
**Solución:** Usar `python -m http.server 8080` y abrir `http://localhost:8080`.

### El vídeo no tiene audio
**Causa:** El `AudioContext` no se crea hasta el primer click del usuario (política del navegador).
**Solución:** El código espera `Snd.create()` (que se llama en el primer click a un botón) antes de iniciar `Rec.start()`. Asegurarse de que el usuario hace click en un botón para iniciar.

### La grabación produce un `.webm` en vez de `.mp4`
**Causa:** El navegador no soporta el codec `avc1` para MP4.
**Solución:** Usar Chrome/Edge (mejor soporte de MP4). Firefox suele producir WebM.

### Los efectos visuales de una habilidad no aparecen
**Causa más común:** Error de JavaScript en `drawFX()` que rompe el render silenciosamente (el `requestAnimationFrame` continúa pero saltándose parte del draw).
**Solución:** Abrir la consola del navegador (F12) y revisar errores. Añadir `try/catch` alrededor de la sección del efecto problemático.

### Las bolas se salen de la arena
**Causa:** Una habilidad modifica `b.x` / `b.y` directamente a coordenadas fuera de la arena sin llamar `pushInsideArena()`.
**Solución:** Después de cualquier teletransporte: `pushInsideArena(b, ARENA.r)`.

### El juego se congela (loop para)
**Causa:** Un error sin `try/catch` dentro de `loop()` o `draw()` hace que `requestAnimationFrame` deje de llamarse.
**Solución:** Envolver `draw(dc)` en un `try/catch` en el loop. Ver la consola para el error original.

### Los orbs no aparecen
**Causa:** `ORB_TYPES` está vacío o `spawnOrb()` lanza un error.
**Verificar:** `ORB_TYPES.length > 0` en consola.

---

## 29. Dependencias externas

| Dependencia | Uso | CDN / Local |
|---|---|---|
| Google Fonts (Rajdhani 600/700) | Tipografía de todo el texto en canvas | CDN (requiere internet) |
| Web Audio API | Sonidos procedurales + música | Nativa del navegador |
| Canvas 2D API | Todo el render | Nativa del navegador |
| MediaRecorder API | Grabación de vídeo | Nativa del navegador |
| OffscreenCanvas | Fondo estático pre-renderizado | Nativa del navegador |

**Sin frameworks.** No hay React, Vue, jQuery, Three.js ni ninguna librería de terceros. Todo está escrito en JavaScript vanilla.

**Compatibilidad de navegadores:**
- ✅ Chrome 90+ (recomendado, mejor soporte MP4)
- ✅ Edge 90+
- ⚠️ Firefox (produce WebM en lugar de MP4)
- ❌ Safari (MediaRecorder muy limitado)

---

## 30. Glosario

| Término | Definición |
|---|---|
| **Orb** | Objeto flotante en la arena que otorga una habilidad al recogerlo |
| **FX** | Objeto global que almacena el estado de todos los efectos visuales activos |
| **CAM** | Sistema de cámara cinemática con zoom y follow |
| **G** | Objeto de estado del juego (game state) |
| **C** | Objeto de constantes de juego (config) |
| **Snd** | IIFE de audio (sonidos y música) |
| **Rec** | IIFE de grabación (MediaRecorder) |
| **parts** | Array global de partículas activas |
| **orbs** | Array global de orbs activos en la arena |
| **ACX, ACY** | Centro de la arena (360, 490) |
| **AR** | Radio máximo de la arena (360px) |
| **dc** | Context 2D del canvas display (#displayCanvas) |
| **rc** | Context 2D del canvas de grabación (#recordCanvas) |
| **DC** | Elemento HTML del canvas display |
| **RC** | Elemento HTML del canvas de grabación |
| **bgOff** | OffscreenCanvas con el fondo estático pre-renderizado |
| **frame** | Contador global de frames (se incrementa en draw()) |
| **burst()** | Crea una explosión de N partículas en un punto |
| **FFA** | Free-For-All (todos contra todos, modo individual) |
| **Rage** | Estado de una bola tras hacer un kill: velocidad multiplicada |
| **Sudden Death** | Los últimos 20s de ronda donde la arena encoge |
| **Anti-stall** | Sistema que genera más orbs si no hay acción durante 2.5s |
| **Auto-batch** | Modo automático que graba 10 partidas consecutivas |
| **Wide-shot** | Habilidad que hace que la cámara haga zoom-out en lugar de zoom-in |
| **lbRank** | Posición en el leaderboard (0 = líder) |
| **lbY** | Posición Y animada de la barra del leaderboard |
| **roundDmg** | Daño total infligido en la ronda actual por bola/equipo |
| **totalDmg** | Daño total acumulado en toda la partida por bola/equipo |
| **podiumSlot** | Índice del jugador actualmente mostrado en el podio |
| **physSpeed()** | Factor de velocidad física de la cámara (0.45–1.0) |
| **applyOrb()** | Función que ejecuta la habilidad de un orb recogido |
| **tickOrbs()** | Función que actualiza la física de los orbs cada frame |
| **drawFX()** | Función que dibuja todos los efectos visuales cada frame |
| **ARENA_SHAPES** | Array de formas posibles de la arena |
| **wallBounce(b)** | Aplica rebote de una bola contra la pared de la arena |
| **ballPair(a,b)** | Resuelve colisión elástica entre dos bolas |
| **pushToRec()** | Copia el displayCanvas al recordCanvas cada frame |
| **triggerRoundTransition()** | Activa el flash de transición al inicio de ronda |
| **drawRoundTransition(ctx)** | Renderiza el flash blanco + texto "ROUND X" |
| **drawWinnerCinematic(ctx)** | Renderiza el spotlight del ganador durante roundEndDelay |
| **drawRoundEnd(ctx)** | Renderiza la pantalla de resultados de ronda |
| **drawPodium(ctx)** | Renderiza la secuencia de podio jugador por jugador |
| **drawChampion(ctx)** | Renderiza la pantalla del campeón final |
| **drawLeaderboard(ctx,frame)** | Renderiza las barras de daño animadas en la parte baja |
| **drawLastTwo(ctx)** | Renderiza el banner "FINAL 2!" cuando quedan 2 bolas |
| **begin()** | Inicia una nueva partida (incrementa autoBatchPart, llama G.start()) |
| **beginAuto()** | Activa auto-batch y lanza la primera partida |
| **G.start()** | Inicializa el juego: elige modo, cuenta jugadores, spawna bolas, inicia countdown |
| **G.startRound()** | Inicia una nueva ronda: resetea FX, spawna bolas, llama triggerRoundTransition |
| **G.checkEnd()** | Comprueba si queda 1 (o 0) bola viva y transiciona a roundEndDelay |
| **G.resolveRoundEnd()** | Decide ganador de ronda, actualiza roundWins, decide si hay campeón |
| **G.updateLeaderboard()** | Recalcula lbWidths y lbRank cada frame durante running |
| **iridGrad(ctx,x1,y1,x2,y2,frame,alpha)** | Crea un LinearGradient arcoíris animado (usado en leaderboard y título) |
| **iridColor(frame,s,l,alpha)** | Devuelve un color HSL animado que cicla según el frame |

---

## 31. Requisitos para ejecutar el proyecto

### Software obligatorio

| Requisito | Versión mínima | Para qué sirve |
|---|---|---|
| **Python** | 3.6+ (recomendado 3.12) | Servidor HTTP local (`servidor.bat`) |
| **Chrome o Edge** | 90+ | Único navegador con soporte completo de MP4 vía MediaRecorder |

### Instalación de Python

1. Descargar desde https://python.org/downloads
2. En el instalador marcar **"Add Python to PATH"** (obligatorio)
3. Verificar en CMD: `python --version` → debe mostrar `Python 3.x.x`

### Versiones probadas y compatibles

| Software | Versión probada | Notas |
|---|---|---|
| **Python** | 3.12.10 | Versión con la que fue desarrollado y probado |
| **Chrome** | 120+ | Navegador principal de desarrollo |
| **Edge** | 120+ | Compatible, produce MP4 igual que Chrome |
| **Windows** | 10 / 11 | Sistema operativo de desarrollo |
| **Node.js** | ❌ No se usa | El proyecto no usa Node.js en absoluto |
| **npm/yarn** | ❌ No se usa | Sin gestión de paquetes |
| **pip** | ❌ No se usa | Sin dependencias de Python más allá de la librería estándar |

### No se necesita instalar nada más

- Sin `npm install`
- Sin `pip install` de ningún paquete — Python solo se usa para `python -m http.server` que viene incluido en la instalación estándar
- Sin frameworks, sin bundlers (Webpack, Vite, Rollup), sin transpiladores (Babel)
- Sin Node.js — el proyecto es 100% HTML/CSS/JS vanilla que corre directamente en el navegador
- Sin extensiones de VS Code obligatorias (aunque se recomienda ver abajo)

### Extensiones de VS Code recomendadas (opcionales)

| Extensión | ID | Para qué sirve |
|---|---|---|
| **Claude Code** | `anthropic.claude-code` | IA para modificar el código |
| **Live Server** | `ritwickdey.liveserver` | Alternativa al servidor.bat (clic derecho → Open with Live Server) |
| **JavaScript (ES6)** | Viene integrado en VS Code | Syntax highlighting del JS en el HTML |

### Cómo arrancar (paso a paso)

1. Abrir la carpeta `ball simulator/` en VS Code
2. Ejecutar `servidor.bat` (doble clic) — la ventana CMD debe quedarse **abierta** mostrando `Serving HTTP on 127.0.0.1 port 8080`
3. Abrir Chrome/Edge y navegar a: `http://127.0.0.1:8080/index.html`
4. Si sale `ERR_EMPTY_RESPONSE`: el servidor no está corriendo, volver al paso 2
5. Si sale `ERR_CONNECTION_REFUSED`: mismo problema, el servidor no arrancó

> **Importante:** Usar siempre `http://127.0.0.1:8080` y NO `http://localhost:8080`. En Python 3.12+ en Windows, `localhost` puede resolver a IPv6 (`::1`) mientras el servidor escucha en IPv4 (`127.0.0.1`), causando que el navegador no encuentre nada.

---

## 32. Guía de refactorización — Cómo dividir original_game.html en módulos ES

> **Estado:** La refactorización ya está completa. El proyecto funciona en ES Modules (`js/`). Esta sección queda como referencia histórica y para cualquier IA o desarrollador que necesite entender la estructura o hacer cambios estructurales futuros. Contiene las reglas estrictas que se deben seguir para no romper nada.

### Principio fundamental

> **Nunca inventar código. Solo mover código.**
>
> El 100% de la lógica ya existe y funciona en `original_game.html`. La refactorización consiste únicamente en **cortar secciones del HTML y pegarlas en archivos `.js` separados**, añadiendo `export`/`import` donde corresponde. Cualquier función que se reescriba desde cero (aunque parezca equivalente) tiene alta probabilidad de romper el juego porque los efectos visuales y la lógica están profundamente interconectados.

### Requisitos técnicos para módulos ES

- El servidor HTTP es **obligatorio** — los módulos ES (`<script type="module">`) no funcionan con `file://`
- El `index.html` debe tener `<script type="module" src="js/main.js">` como único entry point
- Todos los archivos `.js` deben estar en `js/` y usar `import`/`export` de ES Modules estándar
- No usar CommonJS (`require`/`module.exports`) — el navegador no lo soporta sin bundler

### Estructura de módulos propuesta

```
js/
├── constants.js     — C, W, H, ACX, ACY, AR, DC, RC, dc, rc, LB_*, iridGrad, iridColor
├── audio.js         — Snd IIFE completo
├── recorder.js      — Rec IIFE, autoBatch vars, buildBatchSequence
├── particles.js     — parts[], burst(), ringBurst(), tickParts(), spawnOrb()
├── camera.js        — CAM objeto completo
├── arena.js         — ARENA, ARENA_SHAPES, ORB_TYPES, orbs[], arenaPath(), polyVerts(), pushInsideArena(), isInsideArena(), stall vars + setters
├── fx.js            — FX objeto completo (campos, tick(), reset())
├── ball.js          — isEnemy(), addDmg(), clase Ball
├── game.js          — G objeto completo, wallBounce(), ballPair()
├── abilities.js     — tickOrbs(), applyOrb() switch completo
├── draw.js          — bgOff, drawCinematic(), drawFX(), drawOrbs(), triggerRoundTransition(), drawRoundTransition(), drawWinnerCinematic(), drawRoundEnd(), drawPodium(), drawChampion(), drawLeaderboard(), drawLastTwo(), draw()
└── main.js          — frame, loop(), pushToRec(), begin(), beginAuto(), UI event listeners
```

### Líneas de referencia en original_game.html

| Sección | Línea inicio | Línea fin | Módulo destino |
|---|---|---|---|
| Constantes (C, W, H, ACX…) | ~5 | ~120 | `constants.js` |
| Canvas (DC, RC, dc, rc) | ~121 | ~140 | `constants.js` |
| iridGrad, iridColor | ~141 | ~160 | `constants.js` |
| Snd (audio) | ~162 | ~355 | `audio.js` |
| Rec (grabación) | ~356 | ~430 | `recorder.js` |
| parts[], burst(), spawnOrb() | ~399 | ~434 | `particles.js` |
| CAM objeto | ~439 | ~570 | `camera.js` |
| tickOrbs() | ~572 | ~628 | `abilities.js` |
| applyOrb() switch | ~630 | ~1670 | `abilities.js` |
| drawCinematic() | ~1672 | ~1766 | `draw.js` |
| drawFX() | ~1768 | ~2990 | `draw.js` |
| drawOrbs() | ~2992 | ~3014 | `draw.js` |
| ORB_TYPES array | ~3019 | ~3107 | `arena.js` |
| orbs[], stall vars, constantes orb | ~3109 | ~3126 | `arena.js` |
| ARENA_SHAPES, polyVerts() | ~3127 | ~3138 | `arena.js` |
| arenaPath(), pushInsideArena(), isInsideArena() | ~3140 | ~3283 | `arena.js` |
| ARENA objeto | ~3224 | ~3283 | `arena.js` |
| FX objeto (campos + tick + reset) | ~3286 | ~4541 | `fx.js` |
| isEnemy(), addDmg() | ~4543 | ~4555 | `ball.js` |
| clase Ball | ~4560 | ~4697 | `ball.js` |
| G objeto | ~4702 | ~4906 | `game.js` |
| wallBounce(), ballPair() | ~4911 | ~4965 | `game.js` |
| bgOff OffscreenCanvas | ~4970 | ~4979 | `draw.js` |
| transitionFrames, triggerRoundTransition() | ~4984 | ~5022 | `draw.js` |
| drawWinnerCinematic() | ~5027 | ~5170 | `draw.js` |
| drawRoundEnd() | ~5175 | ~5316 | `draw.js` |
| drawPodium() | ~5321 | ~5430 | `draw.js` |
| drawChampion() | ~5435 | ~5564 | `draw.js` |
| drawLeaderboard() | ~5569 | ~5787 | `draw.js` |
| drawLastTwo() | ~5793 | ~5832 | `draw.js` |
| draw() función principal | ~5838 | ~6256 | `draw.js` |
| pushToRec(), loop() | ~6258 | ~6382 | `main.js` |
| UI handlers, begin(), beginAuto() | ~6384 | ~6413 | `main.js` |

### Dependencias circulares — cómo resolverlas

El mayor problema de la modularización es que varios módulos se necesitan mutuamente. La solución es **late-binding con funciones init**:

```js
// En fx.js — FX necesita G, isEnemy, addDmg pero no puede importarlos directamente
let _G = null, _isEnemy = null, _addDmg = null;
export function initFX(G, isEnemy, addDmg) { _G = G; _isEnemy = isEnemy; _addDmg = addDmg; }
// Dentro de FX.tick() usar _G en lugar de G
```

```js
// En ball.js — Ball necesita G
let _G = null;
export function initBall(G) { _G = G; }
```

```js
// En game.js — G.startRound() llama triggerRoundTransition() que está en draw.js
let _triggerRoundTransition = null;
export function initGameExtras(fn) { _triggerRoundTransition = fn; }
// En G.startRound(): _triggerRoundTransition?.()
```

```js
// En main.js — conectar todo al inicio
import { initFX } from './fx.js';
import { initBall } from './ball.js';
import { initGameExtras } from './game.js';
import { initRecorder } from './recorder.js';
import { triggerRoundTransition } from './draw.js';
import { G } from './game.js';
import { isEnemy, addDmg } from './ball.js';

initFX(G, isEnemy, addDmg);
initBall(G);
initGameExtras(triggerRoundTransition);
initRecorder(begin, setStatus);
```

### Variables let exportadas — usar setters

Las variables `let` en ES Modules no se pueden mutar desde fuera. Para variables que otros módulos necesitan modificar, exportar setters:

```js
// En arena.js
export let orbSpawnTimer = 0;
export function setOrbSpawnTimer(v) { orbSpawnTimer = v; }

export let stallOrbTimer = 0;
export function setStallOrbTimer(v) { stallOrbTimer = v; }
// etc.
```

### La variable `frame`

- Vive en `main.js` como `let frame = 0`
- Se incrementa en `loop()`: `frame++`
- Se pasa como parámetro a todas las funciones que la necesitan: `draw(dc, frame)`, `drawFX(ctx, frame)`, `drawCinematic(ctx, frame)`, etc.
- **No** existe como global en la versión modular

### Reglas estrictas para la IA que haga la refactorización

1. **Leer el archivo completo antes de escribir cualquier módulo.** No asumir que una función hace X sin leerla.
2. **Copiar el código exactamente.** No simplificar, no reescribir, no "limpiar". Ni un solo carácter de lógica debe cambiar.
3. **No convertir a clases.** El original usa objetos literales (`const G = {...}`) y funciones. Mantener esa estructura.
4. **No añadir manejo de errores extra.** El original no tiene `try/catch` en la mayoría de funciones — no añadirlo.
5. **No cambiar nombres de variables.** `parts`, `orbs`, `FX`, `G`, `CAM`, etc. deben mantener sus nombres exactos.
6. **Verificar que cada import esté justificado.** Cada `import { X } from './y.js'` debe corresponder a un uso real de `X` en el archivo.
7. **No usar `window.X` como sustituto de imports.** Asignar globals a `window` es la señal de que se está evitando resolver dependencias correctamente.
8. **Verificar el juego en el navegador después de cada módulo.** No esperar a terminar todos los módulos para probar.

### Señales de que algo salió mal

- La pantalla aparece en negro → `draw()` no se ejecuta o hay un error en las primeras líneas
- Los botones no hacen nada → los event listeners no están conectados o `begin()` falla
- El juego arranca pero no se mueven las bolas → `loop()` corre pero `G.state` nunca pasa a `'running'`
- Las habilidades no tienen efecto visual → `drawFX()` está incompleto o `FX` no está inicializado
- La consola muestra `Cannot read properties of null` → un `initX()` no fue llamado antes de usar la variable

---

## 33. Performance optimizations

### ballMap (O(1) lookup)
- `ballMap` (Map<id, Ball>) created at start of `FX.tick()` each frame
- Replaced 62 `balls.find()` calls with `ballMap.get(id)` — O(1) instead of O(n)

### Zero-allocation loops
- `balls.filter()` replaced with manual `for` loops in 5 effect ticks (zero allocation per frame)

### Particle cap
- `parts` array capped at 400 particles maximum
- `burst()` skips entirely when the array is full
- All `parts.push()` calls are guarded by the cap check

### Ball rendering
- Reduced from 5 radial gradients to 2 per ball (sphere gradient + specular highlight)

### HP bars
- No `shadowBlur` (expensive composite operation removed)
- Flat fills instead of gradients

### Particle spawn rate
- Ambient particle spawn reduced: `frame%1` and `frame%2` changed to `frame%4`

---

## 34. Aimbot projectiles

8 abilities have aimbot targeting — they find the nearest enemy and aim the projectile/beam toward them:

1. `gojo_purple`
2. `yami_slash`
3. `serious_punch`
4. `incinerate`
5. `sonic_slash`
6. `zoltraak`
7. `shadow_slash`
8. `roxy_water`

**Pattern:** on activation, find nearest enemy ball, compute angle toward it, set projectile velocity/direction accordingly.

---

## 35. UI improvements

- **Shake scoped to arena content only** — title bar, leaderboard, and boss HP bar never shake
- **FPS counter** — display-only, drawn after `pushToRec()` so it is not recorded
- **Countdown** — full 3-2-1-GO sequence with bounce easing, per-number colors, shockwave rings
- **Round transition** — elastic bounce animation, glitch wipe bars, iridescent accents
- **Title bar** — glassmorphism style, corner brackets, multi-layer text, pulsing red timer when <10s remain
- **Auto-batch** — guaranteed 3 solo + 3 team + 3 boss + 1 random in 10 slots

---

## 36. Historial de problemas conocidos

| Problema | Causa | Solución aplicada |
|---|---|---|
| Loop se rompe permanentemente | Error en `drawFX()` sin `try/catch` dentro del `requestAnimationFrame` | Envolver `draw(dc)` en `try/catch` en `loop()` |
| `localhost:8080` no conecta en Python 3.12+ Windows | Python abre IPv6 (`::`) por defecto, Chrome resuelve `localhost` como IPv4 | Añadir `--bind 127.0.0.1` al comando del servidor |
| Refactorización rompe el juego | La IA reescribió funciones en lugar de copiarlas | Usar la documentación para forzar copia exacta del código original |
| Habilidades de EiS/Overlord/Noragami/Mushoku Tensei/Date A Live invisibles | Las 25 habilidades tenían lógica completa en `abilities.js` y `fx.js` pero faltaba todo el código de dibujo en `drawFX()` de `draw.js` | Añadidos ~750 líneas de draw code en `draw.js` (todas las 25 habilidades) |
| Camera shake se veía a 4fps | Shake usaba `Math.random()` nuevo cada frame → jitter de alta frecuencia visible | Reemplazado por offset suavizado con lerp (target se renueva cada 4 frames, offset se acerca a 0.55) |
| Movimiento de bolas se sentía lento durante habilidades | `physSpeed()` devolvía 0.25 en impact y 0.35 en pickup → demasiado slow-mo | Subidos a 0.45 (impact), 0.55 (pickup), 0.65 (follow), zoom lerp 0.12→0.18 |
| Intro screen no aparecía en la grabación | La intro se mostraba durante `countdown > 60` pero la grabación solo empieza cuando `running` comienza | Movida la intro a `roundFrames < 120` (primeros 2s del estado `running`) |
