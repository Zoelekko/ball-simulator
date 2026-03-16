// ════════════════════════════════════════════════
// IRIDESCENT HELPERS
// ════════════════════════════════════════════════
// hue shifts over time — call with frame to get a live rainbow gradient
export function iridGrad(ctx, x1, y1, x2, y2, t, alpha=1) {
  const g = ctx.createLinearGradient(x1, y1, x2, y2);
  const stops = 7;
  for(let i=0;i<=stops;i++){
    const h = ((t*0.8 + i*(360/stops)) % 360);
    g.addColorStop(i/stops, `hsla(${h},100%,72%,${alpha})`);
  }
  return g;
}
// Solid iridescent color at a point in time
export function iridColor(t, sat=100, light=72, alpha=1) {
  return `hsla(${(t*0.8)%360},${sat}%,${light}%,${alpha})`;
}

// ════════════════════════════════════════════════
// CANVAS & LAYOUT
// ════════════════════════════════════════════════
// Internal game resolution — all code uses this coordinate space
export const W = 720, H = 1280;
// Output resolution — canvas is larger, draw() applies scale transform
export const OUT_W = 1080, OUT_H = 1920;
export const SCALE = OUT_W / W; // 1.5

// Layout zones (9:16 vertical)
// [0 - 130]      Title bar
// [130 - 820]    Arena  (690px tall, circle r=310 centered at 475)
// [820 - 1240]   Leaderboard (race bars)
// [1240 - 1280]  Footer
export const ACX = W/2, ACY = 490, AR = 360;

// Leaderboard zone
export const LB_X   = 40;          // bar left edge
export const LB_Y   = 940;         // first bar top
export const LB_BAR_H   = 58;      // bar height
export const LB_BAR_GAP = 16;      // gap between bars
export const LB_BAR_MAX = W - 80;  // max bar width
export const LB_BALL_R  = 22;      // ball icon radius on bar tip

// ════════════════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════════════════
export const C = {
  BALL_R: 28, MAX_HP: 25,
  MIN_SPD: 4.0, MAX_SPD: 7.5,
  REST_B: 0.98, FLASH: 10, COOLDOWN: 20,
  WALL_SPD_INC: 0.05, BASE_SPD_CAP: 14,
  RAGE_MULT: 3.5, RAGE_FRAMES: 300,
  STALL_FRAMES: 360,
  TRAIL_LEN: 10,
  ROUNDS_TO_WIN: 3,
  COLORS: [
    '#ff4444','#44aaff','#44ee77','#ffdd33',
    '#ff88ff','#ff8800','#00ffcc','#cc88ff',
    '#ff4488','#88ff44','#4488ff','#ffcc00',
    '#ff6644','#44ffee','#cc44ff',
  ],
  NAMES: [
    'Red','Blue','Green','Yellow',
    'Pink','Orange','Cyan','Purple',
    'Rose','Lime','Sky','Gold',
    'Coral','Mint','Violet',
  ],
  PLACE: ['1st','2nd','3rd','4th','5th','6th','7th','8th','9th','10th','11th','12th','13th','14th','15th'],
  TEAM_COLORS: ['#ff4444','#44aaff','#44ee77','#ffdd33'],
  TEAM_NAMES:  ['RED','BLUE','GREEN','GOLD'],
  get COUNT(){ return this._count ?? 4; },
  set COUNT(v){ this._count = v; },
  BOSS: {
    R:       80,   // boss radius (vs normal 28)
    HP:     500,   // boss starting HP
    DMG_OUT:  2,   // damage boss deals per hit to hunters
    DMG_IN:   1,   // damage hunters deal per hit to boss (collision)
    DMG_IN_CAP: 3, // max damage boss takes per any single hit (caps ability damage)
    COLOR: '#ff2200',
    NAME:  'BOSS',
    SPEED_MULT: 0.55, // boss moves slower (big and heavy)
  },
  DUNGEON: {
    TOTAL_ROOMS:   6,       // 5 normal + 1 boss room
    PLAYER_HP:   100,       // player starts with 100 HP
    PLAYER_R:     32,       // slightly larger than normal balls
    PLAYER_COLOR: '#00eeff',
    PLAYER_NAME:  'HERO',
    BOSS_HP:     300,       // dungeon boss HP
    BOSS_R:       60,       // dungeon boss radius
    BOSS_COLOR:  '#ff2200',
    BOSS_NAME:   'DEMON LORD',
    ENEMY_BASE_HP: 12,      // base enemy HP (scales with room)
    ENEMY_R:      26,        // enemy radius (slightly smaller)
    HEAL_AMOUNT:   30,       // HP restored per heal pack
    HEAL_SPAWN_RATE: 1600,   // spawn heal pack every ~27s (25% less frequent than before)
    ROOM_TRANSITION_DUR: 100,// frames for room transition animation (~1.7s)
    MAX_ROOM_FRAMES: 1500,   // 25s max per normal room
    BOSS_ROOM_FRAMES: 3600,  // 60s max for boss room (doubled)
    ENEMY_ABILITY_INTERVAL: 480, // 8s between enemy auto-abilities
    BOSS_ABILITY_INTERVAL: 420,  // 7s between boss ability uses
    PLAYER_DMG_TO_ENEMY: 2,    // player deals 2 damage per collision
    ENEMY_DMG_TO_PLAYER: 1.25, // enemies deal 1.25 damage per collision (25% more)
    BOSS_DMG_TO_PLAYER:  2.5,  // boss deals 2.5 damage per collision (25% more)
    PLAYER_DMG_TO_BOSS:  6,    // player deals 6 damage to boss per collision
    HIT_CAP_PLAYER:     15,  // max ability damage player can take per hit
  },
};
// ✅ COMPLETO
