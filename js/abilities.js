// ════════════════════════════════════════════════
// ABILITIES — ORB_TYPES, orbs, tickOrbs, applyOrb
// ════════════════════════════════════════════════
import { C, ACX, ACY, AR } from './constants.js';
import { ARENA, isInsideArena as ARENA_isInside, isInsideRect } from './arena.js';
import { Perf } from './perf.js';

// Late-binding deps
let _G = null, _FX = null, _CAM = null, _Snd = null, _burst = null, _isEnemy = null, _addDmg = null, _spawnOrb = null;
export function initAbilities(deps){
  _G = deps.G;
  _FX = deps.FX;
  _CAM = deps.CAM;
  _Snd = deps.Snd;
  _burst = deps.burst;
  _isEnemy = deps.isEnemy;
  _addDmg = deps.addDmg;
  _spawnOrb = deps.spawnOrb;
}

// ════════════════════════════════════════════════
// ORBS
// ════════════════════════════════════════════════
export const ORB_TYPES = [
  // ── Anime / user abilities ──
  { id:'gojo_blue',   emoji:'🔵', color:'#0044ff', name:'GOJO BLUE',    desc:'Atrae a los enemigos',        char:'GOJO SATORU'   },
  { id:'gojo_red',    emoji:'🔴', color:'#ff0022', name:'GOJO RED',     desc:'Explota y repele a todos',    char:'GOJO SATORU'   },
  { id:'gojo_purple', emoji:'🟣', color:'#7700ff', name:'HOLLOW PURPLE',desc:'Rayo void destruye todo',     char:'GOJO SATORU'   },
  { id:'sandevistan', emoji:'⏩', color:'#00ffff', name:'SANDEVISTAN',  desc:'El mundo va lento, tú no',    char:'V / SILVERHAND' },
  { id:'timestop',    emoji:'⏰', color:'#ffd700', name:'TIME STOP',    desc:'Congela el tiempo 3s',        char:'DIO BRANDO'     },
  { id:'rewind',      emoji:'⏪', color:'#cc00ff', name:'REWIND',       desc:'Retrocede tu posición',       char:'EKKO'          },
  { id:'toji_chain',  emoji:'⛓️', color:'#c0c0c0', name:'TOJI CHAIN',   desc:'Cadena golpea a todos',       char:'TOJI FUSHIGURO' },
  { id:'ekko_ult',    emoji:'🕐', color:'#00ff88', name:'CHRONOBREAK',  desc:'Retrocede + explosión AoE',   char:'EKKO'          },
  { id:'prison',      emoji:'🔒', color:'#ff6600', name:'PRISON',       desc:'Atrapa a un enemigo al azar', char:'ITADORI'       },
  { id:'portal',      emoji:'🌐', color:'#00ff44', name:'PORTAL',       desc:'Teletransporte instantáneo',  char:'ZERO TWO'      },
  // ── JJK ──
  { id:'sukuna_cleave', emoji:'🩸', color:'#cc0022', name:'MALEVOLENT SHRINE', desc:'Tajo X + zona de daño',       char:'RYOMEN SUKUNA'  },
  { id:'mahoraga',      emoji:'🐉', color:'#9933ff', name:'MAHORAGA',          desc:'Bestia maldita invocada',     char:'RYOMEN SUKUNA'  },
  { id:'piercing_blood',emoji:'💉', color:'#aa0000', name:'PIERCING BLOOD',    desc:'Chorros de sangre certeros',  char:'CHOSO'         },
  { id:'rika',          emoji:'👻', color:'#ccccff', name:'RIKA',              desc:'Espíritu jala enemigos',      char:'YUTA OKKOTSU'  },
  { id:'hakari',        emoji:'🎰', color:'#ff00ff', name:'PACHINKO',          desc:'Caos aleatorio total',        char:'HAKARI KINJI'  },
  // ── Naruto ──
  { id:'rasengan',    emoji:'🌀', color:'#0099ff', name:'RASENGAN',     desc:'Espiral que empuja todo',     char:'NARUTO'        },
  { id:'chidori',     emoji:'⚡', color:'#ffee00', name:'CHIDORI',      desc:'Rayo atraviesa enemigos',     char:'SASUKE'        },
  { id:'tsukuyomi',   emoji:'👁️', color:'#cc00aa', name:'TSUKUYOMI',    desc:'Ilusión atrapa y daña',       char:'ITACHI'        },
  { id:'hiraishin',   emoji:'🌟', color:'#ffaa00', name:'HIRAISHIN',    desc:'Teletransporte tras enemigo', char:'MINATO'        },
  { id:'sand_tsunami',emoji:'🏜️', color:'#cc9933', name:'SAND TSUNAMI', desc:'Ola de arena empuja todo',    char:'GAARA'         },
  // ── Black Clover ──
  { id:'hellfire',    emoji:'🔥', color:'#ff6600', name:'HELLFIRE',       desc:'Aura de fuego escala',        char:'MEREOLEONA'    },
  { id:'spatial_cube',emoji:'🟪', color:'#8800ff', name:'SPATIAL CUBE',   desc:'Cubos atrapan y suprimen',    char:'JULIUS NOVACHRONO'},
  { id:'zephyr',      emoji:'🌬️', color:'#aaddff', name:'SPIRIT OF ZEPHYR',desc:'Cuchilla de viento',         char:'YUNO'          },
  { id:'black_asta',  emoji:'⚫', color:'#111111', name:'BLACK ASTA',     desc:'Anti-magia devora todo',      char:'ASTA'          },
  { id:'yami_slash',  emoji:'🌑', color:'#220033', name:'DIMENSION SLASH',desc:'Corte dimensional',           char:'YAMI SUKEHIRO' },
  // ── Slime Isekai ──
  { id:'drago_nova',   emoji:'🌟', color:'#ffdd00', name:'DRAGO NOVA',    desc:'Explosión estelar',           char:'MILIM NAVA'    },
  { id:'megiddo',      emoji:'☀️', color:'#ffffff', name:'MEGIDDO',       desc:'Lluvia de rayos divinos',     char:'RIMURU TEMPEST'},
  { id:'veldora_storm',emoji:'🌪️', color:'#1a3aff', name:'BLACK STORM',   desc:'Tormenta que consume la arena',char:'VELDORA'      },
  { id:'prominence',   emoji:'🐉', color:'#dc143c', name:'PROMINENCE',    desc:'Dragón negro y rojo devasta', char:'MILIM NAVA'    },
  { id:'diablo_end',   emoji:'😈', color:'#6600cc', name:'CELESTIAL END', desc:'Vórtice absorbe y cura',      char:'DIABLO'        },
  // ── Chainsaw Man ──
  { id:'chainsaw_rev', emoji:'⚙️', color:'#ff2200', name:'CHAINSAW REV',  desc:'Sierra devora todo',          char:'DENJI'         },
  { id:'blood_rain',   emoji:'🩸', color:'#cc0022', name:'BLOOD RAIN',    desc:'Lluvia de lanzas de sangre',  char:'POWER'         },
  { id:'makima_chain', emoji:'⛓️', color:'#880000', name:'MAKIMA CHAINS', desc:'Cadenas de control',          char:'MAKIMA'        },
  { id:'future_devil', emoji:'👁️', color:'#440088', name:'FUTURE DEVIL',  desc:'Predice y contraataca',       char:'FUTURE DEVIL'  },
  { id:'pochita_core', emoji:'🔶', color:'#ff6600', name:'POCHITA CORE',  desc:'Explosión del diablo origen', char:'POCHITA'       },
  // ── One Punch Man ──
  { id:'serious_punch',emoji:'👊', color:'#ffff00', name:'SERIOUS PUNCH', desc:'Un golpe que lo borra todo',  char:'SAITAMA'       },
  { id:'incinerate',   emoji:'🔥', color:'#ff5500', name:'INCINERATE',    desc:'Cañón de incineración',       char:'GENOS'         },
  { id:'tornado_psy',  emoji:'🌀', color:'#44ff88', name:'TORNADO PSY',   desc:'Telekinesis devastadora',     char:'TATSUMAKI'     },
  { id:'silver_fang',  emoji:'🥋', color:'#aaddff', name:'SILVER FANG',   desc:'Onda de artes marciales',     char:'BANG'          },
  { id:'sonic_slash',  emoji:'⚡', color:'#ccffff', name:'SONIC SLASH',   desc:'Cortes sónicos invisibles',   char:'SONIC'         },
  // ── Frieren ──
  { id:'zoltraak',     emoji:'💠', color:'#8866ff', name:'ZOLTRAAK',      desc:'Magia ofensiva devastadora',    char:'FRIEREN'       },
  { id:'granat',       emoji:'🔮', color:'#ff88ff', name:'GRANAT',        desc:'Esfera mágica que implosiona',  char:'FRIEREN'       },
  { id:'aura_soul',    emoji:'💀', color:'#88ffdd', name:'SOUL DRAIN',    desc:'Drena vida de todos',           char:'AURA'          },
  { id:'stark_thunder',emoji:'⚔️', color:'#ffdd44', name:'STARK THUNDER', desc:'Explosión de aura guerrera',    char:'STARK'         },
  { id:'frieren_end',  emoji:'❄️', color:'#cceeff', name:'ALLMÄCHTIG',    desc:'Magia antigua congela y tritura',char:'FRIEREN'       },
  // ── The Eminence in Shadow ──
  { id:'i_am_atomic',  emoji:'💥', color:'#ffffff', name:'I AM ATOMIC',    desc:'Explosión total borra todo',         char:'CID KAGENOU'    },
  { id:'shadow_slash', emoji:'🌑', color:'#222244', name:'SHADOW SLASH',   desc:'Tajo de sombra atraviesa la arena',  char:'CID KAGENOU'    },
  { id:'delta_frenzy', emoji:'🩸', color:'#ff1144', name:'DELTA FRENZY',   desc:'Frenesí de golpes a todos',          char:'DELTA'          },
  { id:'gamma_laser',  emoji:'🔵', color:'#00aaff', name:'GAMMA LASER',    desc:'Rayo de precisión atraviesa todo',   char:'GAMMA'          },
  { id:'beta_twin',    emoji:'⚔️', color:'#cc88ff', name:'TWIN SWORDS',    desc:'Espadas gemelas barren la arena',    char:'BETA'           },
  // ── Overlord ──
  { id:'ainz_death',   emoji:'💀', color:'#330011', name:'GOAL OF ALL LIFE IS DEATH', desc:'Muerte instantánea en zona', char:'AINZ OOAL GOWN' },
  { id:'albedo_fort',  emoji:'🛡️', color:'#fffacc', name:'HERMES TRISMEGISTUS',desc:'Fortaleza indestructible',        char:'ALBEDO'         },
  { id:'shalltear_rage',emoji:'🩸',color:'#ff0055', name:'BLOOD FRENZY',   desc:'Absorbe vida y enloquece',           char:'SHALLTEAR'      },
  { id:'cocytus_freeze',emoji:'❄️',color:'#aaeeff', name:'FROST AURA',     desc:'Congela y tritura todo',             char:'COCYTUS'        },
  { id:'demiurge_hell', emoji:'😈', color:'#ff6600', name:'HELLFIRE OF GEHENNA',desc:'Infierno de legión daemónica',   char:'DEMIURGE'       },
  // ── Noragami ──
  { id:'yato_sekki',   emoji:'⚔️', color:'#4488ff', name:'SEKKI SLASH',    desc:'Tajo sagrado de 100 cortes',         char:'YATO'           },
  { id:'yukine_burst', emoji:'✨', color:'#ffee88', name:'REGALIA BURST',   desc:'Explosión de luz sagrada',           char:'YUKINE'         },
  { id:'bishamon_array',emoji:'⚡', color:'#ffaa00', name:'FIVE COMBINED',  desc:'Array de espadas cae del cielo',     char:'BISHAMON'       },
  { id:'nora_bind',    emoji:'🔴', color:'#cc2200', name:'NORA BIND',       desc:'Cuentas malditas atan enemigos',     char:'NORA'           },
  { id:'veena_storm',  emoji:'🌩️', color:'#ffdd44', name:'LIGHTNING ARRAY',desc:'Tormenta de relámpagos sagrados',    char:'VEENA'          },
  // ── Mushoku Tensei ──
  { id:'quagmire',     emoji:'🌀', color:'#8800cc', name:'QUAGMIRE',        desc:'Espacio-tiempo se colapsa',          char:'RUDEUS'         },
  { id:'north_god',    emoji:'⚡', color:'#ccccff', name:'NORTH GOD STYLE', desc:'Velocidad extrema + combo',          char:'ERIS'           },
  { id:'orsted_dragon',emoji:'🐉', color:'#00ff88', name:'DRAGON AURA',     desc:'Aura de dragón aplasta todo',        char:'ORSTED'         },
  { id:'roxy_water',   emoji:'💧', color:'#0088ff', name:'WATER CANNON',    desc:'Cañón de agua a alta presión',       char:'ROXY'           },
  { id:'sylphie_wind', emoji:'🌪️', color:'#88ffaa', name:'WIND STORM',      desc:'Tormenta de viento dispersa todo',  char:'SYLPHIE'        },
  // ── Date A Live ──
  { id:'zafkiel',      emoji:'🕰️', color:'#cc0000', name:'ZAFKIEL BULLET', desc:'Bala del tiempo roba vida',          char:'KURUMI TOKISAKI'},
  { id:'sandalphon',   emoji:'👑', color:'#ffcc00', name:'SANDALPHON',      desc:'Trono cae y aplasta la arena',       char:'TOHKA YATOGAMI' },
  { id:'origami_angel',emoji:'🪶', color:'#ffffff', name:'METATRON',        desc:'Lluvia de plumas de luz divina',     char:'ORIGAMI TOBIICHI'},
  { id:'shido_seal',   emoji:'💖', color:'#ff88cc', name:'SEALING KISS',    desc:'Sella poderes y atrae a todos',      char:'SHIDO ITSUKA'   },
  { id:'miku_gabriel', emoji:'🎵', color:'#cc44ff', name:'GABRIEL CONCERT', desc:'Ondas sónicas destrozan la arena',  char:'MIKU IZAYOI'    },
  // ── Arena powers ──
  { id:'arena_split', emoji:'✂️', color:'#ff4488', name:'ARENA SPLIT',  desc:'La arena se divide en 2',   char:'ARENA'         },
  { id:'arena_shrink',emoji:'💀', color:'#ff2200', name:'ARENA SHRINK', desc:'La arena se encoge',         char:'ARENA'         },
  { id:'arena_chaos', emoji:'🌪️', color:'#aa44ff', name:'CHAOS ZONE',   desc:'Gravedad caótica en arena',  char:'ARENA'         },
  // ── Dungeon heal pack (only spawns in dungeon mode) ──
  { id:'heal_pack',  emoji:'💚', color:'#22dd44', name:'HEAL PACK',   desc:'Recupera vida al héroe',     char:'DUNGEON'       },
];

export const orbs = [];   // active orbs on the arena
export let orbSpawnTimer = 0;
export let orbRoundFrame = 0; // frames elapsed since round start (for burst spawning)
export let stallOrbTimer = 0; // frames since last damage — triggers orb flood
export let stallOrbActive = false;
export let stallOrbCycle = 0; // how many force-trigger cycles have fired this round
export const ORB_SPAWN_INTERVAL = 300; // spawn one orb every 5s (normal rate)
export const ORB_SPAWN_FAST    = 55;   // spawn rate during first 5s (one every ~0.9s)
export const ORB_BURST_FRAMES  = 300;  // first 5s of each round = fast spawn
export const ORB_STALL_TRIGGER = 150;  // 2.5s no damage → flood mode
export const ORB_STALL_RATE    = 40;   // spawn every ~0.67s in flood mode
export const ORB_FORCE_TRIGGER = 360;  // 6s no damage → force-apply ability on each alive ball
export const ORB_RADIUS = 18;
export const ORB_LIFETIME = 600; // 10s before disappearing

// Setters for exported lets (modules can't reassign exported lets from outside)
export function setOrbSpawnTimer(v){ orbSpawnTimer = v; }
export function setOrbRoundFrame(v){ orbRoundFrame = v; }
export function setStallOrbTimer(v){ stallOrbTimer = v; }
export function setStallOrbActive(v){ stallOrbActive = v; }
export function setStallOrbCycle(v){ stallOrbCycle = v; }

// List of abilities safe for dungeon enemies (no instant-kills, no global freezes)
const DUNGEON_ENEMY_SAFE_ABILITIES = [
  'gojo_blue','gojo_red','sandevistan','toji_chain','prison','portal',
  'rasengan','chidori','hellfire','zephyr','sand_tsunami',
  'chainsaw_rev','tornado_psy','sonic_slash','zoltraak',
  'stark_thunder','north_god','roxy_water','sylphie_wind',
];

export function tickOrbs(balls){
  orbSpawnTimer++;
  orbRoundFrame++;
  stallOrbTimer++;

  // ── Dungeon mode: heal packs + enemy abilities ──
  if(_G.dungeonMode){
    // Spawn heal packs periodically (max 1 on screen at a time)
    _G.dungeonHealTimer++;
    if(_G.dungeonHealTimer >= C.DUNGEON.HEAL_SPAWN_RATE){
      _G.dungeonHealTimer = 0;
      const alreadyHasHeal = orbs.some(o=>o.type.id==='heal_pack');
      if(!alreadyHasHeal){
        const healType = ORB_TYPES.find(t=>t.id==='heal_pack');
        if(healType) spawnSpecificOrb(healType);
      }
    }
    // Boss abilities — dungeon boss uses powerful abilities against the player
    if(_G.dungeonBoss && _G.dungeonBoss.alive){
      _G.dungeonBossAbilityTimer++;
      if(_G.dungeonBossAbilityTimer >= C.DUNGEON.BOSS_ABILITY_INTERVAL){
        _G.dungeonBossAbilityTimer = 0;
        const BOSS_POOL = [
          'timestop','prison','toji_chain','gojo_red','mahoraga',
          'hellfire','sand_tsunami','chainsaw_rev','blood_rain',
          'makima_chain','rasengan','chidori','tsukuyomi','gojo_blue',
        ];
        const typeId = BOSS_POOL[Math.floor(Math.random()*BOSS_POOL.length)];
        const type = ORB_TYPES.find(t=>t.id===typeId);
        if(type) applyOrb(_G.dungeonBoss, type);
      }
    }
    // Enemy auto-abilities: enemies periodically get speed boosts and visual effects
    // (no orb-based abilities to avoid friendly-fire from FX system)
    _G.dungeonEnemyAbilityTimer++;
    if(_G.dungeonEnemyAbilityTimer >= C.DUNGEON.ENEMY_ABILITY_INTERVAL){
      _G.dungeonEnemyAbilityTimer = 0;
      const enemies = _G.dungeonAliveEnemies();
      if(enemies.length > 0){
        const enemy = enemies[Math.floor(Math.random()*enemies.length)];
        // Simple safe effects: speed boost, rage, or shield
        const effect = Math.random();
        if(effect < 0.4){
          // Speed rage — rush toward player
          enemy.rage = 180;
          const spd = Math.hypot(enemy.vx,enemy.vy)||enemy.baseSpd;
          const t = Math.max(spd, enemy.baseSpd)*2.5;
          if(_G.dungeonPlayer && _G.dungeonPlayer.alive){
            const dx=_G.dungeonPlayer.x-enemy.x, dy=_G.dungeonPlayer.y-enemy.y, d=Math.hypot(dx,dy)||1;
            enemy.vx=(dx/d)*t; enemy.vy=(dy/d)*t;
          }
          _burst(enemy.x, enemy.y, '#ffcc00', 16);
          _G.arenaFlash.color='#ffcc00'; _G.arenaFlash.alpha=0.2;
        } else if(effect < 0.7){
          // Shield — blocks one hit
          enemy.shieldFrames = 180;
          _burst(enemy.x, enemy.y, '#44aaff', 12);
        } else {
          // Giant mode — grows bigger temporarily
          enemy.r = C.DUNGEON.ENEMY_R * 1.6;
          enemy.giantActive = true;
          enemy.giantFrames = 240;
          _burst(enemy.x, enemy.y, '#ff8800', 16);
          _G.shakeFrames=10; _G.shakeAmt=8;
        }
        _Snd.hit();
      }
    }
    // Spawn orbs faster in dungeon mode (player needs abilities to clear rooms)
    const dungeonInterval = orbRoundFrame < ORB_BURST_FRAMES ? ORB_SPAWN_FAST : Math.floor(ORB_SPAWN_INTERVAL * 0.6);
    if(orbSpawnTimer >= dungeonInterval){
      orbSpawnTimer = 0;
      // Filter out heal_pack and arena powers from random spawn
      const combatOrbs = ORB_TYPES.filter(t=>t.id!=='heal_pack' && !t.id.startsWith('arena_'));
      const type = combatOrbs[Math.floor(Math.random()*combatOrbs.length)];
      spawnSpecificOrb(type);
    }
    // Orb collision — in dungeon, only player picks up orbs
    for(let i=orbs.length-1;i>=0;i--){
      const o=orbs[i];
      o.life--; o.pulse+=0.08;
      if(o.life<=0){ orbs.splice(i,1); continue; }
      const p = _G.dungeonPlayer;
      if(p && p.alive){
        const dx=p.x-o.x, dy=p.y-o.y;
        if(Math.hypot(dx,dy)<p.r+ORB_RADIUS){
          applyOrb(p, o.type);
          _burst(o.x, o.y, o.type.color, 20);
          orbs.splice(i,1);
        }
      }
    }
    return;
  }

  // ── Normal modes below ──
  // 2.5s no damage → flood with orbs
  if(stallOrbTimer >= ORB_STALL_TRIGGER && !stallOrbActive){
    stallOrbActive = true;
    _spawnOrb(); _spawnOrb();
  }
  // 6s no damage → force-apply a random ability directly on every alive ball
  if(stallOrbTimer === ORB_FORCE_TRIGGER){
    stallOrbTimer = ORB_STALL_TRIGGER; // reset to keep flood mode active after
    stallOrbCycle++;
    for(const b of balls){
      if(!b.alive || b.isBoss) continue;
      const type = ORB_TYPES[Math.floor(Math.random()*ORB_TYPES.length)];
      _Snd.orbPickup(type.id);
      applyOrb(b, type);
      _G.arenaFlash.color = type.color; _G.arenaFlash.alpha = 0.4;
      _burst(b.x, b.y, type.color, 20);
    }
    // On 2nd+ cycle (12s+ no death): also randomize velocities to unstick everyone
    if(stallOrbCycle >= 2){
      for(const b of balls){
        if(!b.alive) continue;
        const spd = C.MIN_SPD*2 + Math.random()*(C.MAX_SPD-C.MIN_SPD)*1.8;
        const ang = Math.random()*Math.PI*2;
        b.vx = Math.cos(ang)*spd; b.vy = Math.sin(ang)*spd;
      }
      _G.arenaFlash.color='#ffffff'; _G.arenaFlash.alpha=0.7;
      _G.shakeFrames=40; _G.shakeAmt=28;
    }
  }
  const baseInterval = _G.bossMode ? Math.floor(ORB_SPAWN_INTERVAL / 2) : ORB_SPAWN_INTERVAL;
  const spawnInterval = stallOrbActive ? ORB_STALL_RATE
    : orbRoundFrame < ORB_BURST_FRAMES ? ORB_SPAWN_FAST : baseInterval;
  if(orbSpawnTimer>=spawnInterval){ orbSpawnTimer=0; _spawnOrb(); }

  for(let i=orbs.length-1;i>=0;i--){
    const o=orbs[i];
    o.life--;
    o.pulse+=0.08;
    if(o.life<=0){ orbs.splice(i,1); continue; }

    // Check collision with each alive ball (boss never picks up orbs)
    for(const b of balls){
      if(!b.alive || b.isBoss) continue;
      const dx=b.x-o.x, dy=b.y-o.y;
      if(Math.hypot(dx,dy)<b.r+ORB_RADIUS){
        applyOrb(b, o.type);
        // Pickup burst
        _burst(o.x, o.y, o.type.color, 20);
        orbs.splice(i,1);
        break;
      }
    }
  }
}

// Spawn a specific orb type at a random position in the arena/room
function spawnSpecificOrb(type){
  const margin = ORB_RADIUS * 2;
  let x, y, attempts = 0;
  if(_G.dungeonMode && _G.dungeonRoomRect){
    const rr = _G.dungeonRoomRect;
    do {
      x = rr.left + margin + Math.random()*(rr.w - margin*2);
      y = rr.top + margin + Math.random()*(rr.h - margin*2);
      attempts++;
    } while(attempts < 50);
  } else {
    const r = ARENA.r - margin;
    do {
      x = ACX + (Math.random()*2-1)*r;
      y = ACY + (Math.random()*2-1)*r;
      attempts++;
    } while(!ARENA_isInside(x, y, ARENA.r, margin) && attempts < 100);
  }
  orbs.push({ type, x, y, life: ORB_LIFETIME, max: ORB_LIFETIME, pulse: Math.random()*Math.PI*2 });
}

export function applyOrb(ball, type){
  if(ball.isBoss) return; // boss does not pick up orbs
  Perf.logAbility(ball.name, type.name, _G.roundFrames);
  _CAM.trigger(ball, type);
  _Snd.orbPickup(type.id);
  _Snd.onOrbPickup();
  switch(type.id){
    case 'gojo_blue':
      // Pull all others toward ball — camera follows the nearest pulled enemy
      { const angle=Math.random()*Math.PI*2;
        _FX.chains.push({x1:ball.x,y1:ball.y,
          x2:ball.x+Math.cos(angle)*AR,y2:ball.y+Math.sin(angle)*AR,
          life:40,max:40,ownerId:ball.id,targetId:-1,type:'blue_pull'});
        let closestTarget=null, closestDist=Infinity;
        _G.balls.forEach(b=>{ if(b.alive&&_isEnemy(ball,b)){
          const dx=ball.x-b.x,dy=ball.y-b.y,d=Math.hypot(dx,dy)||1;
          b.vx+=dx/d*8; b.vy+=dy/d*8;
          if(d<closestDist){ closestDist=d; closestTarget=b; }
        }});
        _burst(ball.x,ball.y,'#0044ff',24);
        _G.arenaFlash.color='#001aff'; _G.arenaFlash.alpha=0.3;
        if(closestTarget){
          _CAM.setFollow(closestTarget.x, closestTarget.y, closestTarget.id);
          const tid=closestTarget.id;
          setTimeout(()=>{ const bt=_G.balls.find(b=>b.id===tid); if(bt) _CAM.impact(bt.x,bt.y,'#0044ff','PULLED!',tid); },400);
        }
      } break;

    case 'gojo_red':
      // Explosive repulsion — camera focuses on the explosion center
      { let hitCount=0;
        _G.balls.forEach(b=>{ if(b.alive&&_isEnemy(ball,b)){
          const dx=b.x-ball.x,dy=b.y-ball.y,d=Math.hypot(dx,dy)||1;
          b.vx+=dx/d*16; b.vy+=dy/d*16;
          b.hit(); hitCount++;
        }});
        _FX.explosions.push({x:ball.x,y:ball.y,r:0,maxR:160,life:25,max:25,color:'#ff2244'});
        _burst(ball.x,ball.y,'#ff0022',32);
        _G.shakeFrames=30; _G.shakeAmt=22;
        _G.arenaFlash.color='#ff0000'; _G.arenaFlash.alpha=0.5;
        _CAM.setFollow(ball.x, ball.y);
        setTimeout(()=>_CAM.impact(ball.x,ball.y,'#ff2244', hitCount>0?'REPULSE!':'MISS!'),250);
      } break;

    case 'gojo_purple':
      // Void beam — camera follows along the beam direction
      { const _nearest_gp=_G.balls.filter(b=>b.alive&&_isEnemy(ball,b)).sort((a,b)=>Math.hypot(a.x-ball.x,a.y-ball.y)-Math.hypot(b.x-ball.x,b.y-ball.y))[0];
        const angle=_nearest_gp?Math.atan2(_nearest_gp.y-ball.y,_nearest_gp.x-ball.x):Math.random()*Math.PI*2;
        _FX.voidBeam={x:ball.x,y:ball.y,angle,life:120,max:120,ownerId:ball.id};
        _burst(ball.x,ball.y,'#7700ff',28);
        _G.arenaFlash.color='#4400aa'; _G.arenaFlash.alpha=0.4;
        // Camera follows beam midpoint clamped inside arena
        const vpCamD=Math.min(ARENA.r*0.6, Math.max(40, ARENA.r-Math.hypot(ball.x-ACX,ball.y-ACY))*0.8);
        const beamMidX=ball.x+Math.cos(angle)*vpCamD, beamMidY=ball.y+Math.sin(angle)*vpCamD;
        _CAM.setFollow(beamMidX, beamMidY);
        setTimeout(()=>_CAM.impact(beamMidX,beamMidY,'#7700ff','VOID HIT!'),600);
      } break;

    case 'sandevistan':
      // Camera follows the owner as they blitz around
      _FX.sandevistanFrames=240; _FX.sandevistanOwner=ball.id;
      ball.rage=240;
      { const s=Math.hypot(ball.vx,ball.vy)||ball.baseSpd;
        ball.vx=ball.vx/s*s*4; ball.vy=ball.vy/s*s*4; }
      _burst(ball.x,ball.y,'#00ffff',20);
      _CAM.setFollow(ball.x, ball.y, ball.id); // followBallId tracks owner moving
      // Impact fires after ~0.3s once they've blitzed past someone
      setTimeout(()=>{ const b2=_G.balls.find(b=>b.id===ball.id); if(b2) _CAM.impact(b2.x,b2.y,'#00ffff','SANDEVISTAN!',ball.id); },300);
      break;

    case 'timestop':
      // Camera pans to center to show the golden freeze zone
      _FX.timestopFrames=180; _FX.timestopOwner=ball.id;
      _burst(ball.x,ball.y,'#ffd700',20);
      _G.arenaFlash.color='#ffd700'; _G.arenaFlash.alpha=0.25;
      _CAM.setFollow(ACX, ACY);
      setTimeout(()=>_CAM.impact(ACX,ACY,'#ffd700','TIME STOP!'),350);
      break;

    case 'rewind':
      // Snap back to old position — camera follows to the new (old) position
      { const snap=_FX.rewindGhosts.length>0?_FX.rewindGhosts[0]:null;
        if(snap){
          const old=snap.find(s=>s.id===ball.id);
          if(old){
            const destX=old.x, destY=old.y;
            _CAM.setFollow(destX, destY);
            ball.x=destX; ball.y=destY; ball.hp=Math.min(ball.max,old.hp+2);
            setTimeout(()=>_CAM.impact(destX,destY,'#cc00ff','REWOUND!'),300);
          }
        } else {
          _CAM.setFollow(ball.x, ball.y);
        }
        _burst(ball.x,ball.y,'#cc00ff',24);
        _G.arenaFlash.color='#cc00ff'; _G.arenaFlash.alpha=0.3;
        for(let gi=0;gi<6;gi++) _FX.ekkoGhosts.push({x:ball.x+Math.random()*60-30,y:ball.y+Math.random()*60-30,color:'#cc00ff',life:30,max:30});
      } break;

    case 'toji_chain':
      // Chain to all enemies — camera follows to the first target
      { const targets=_G.balls.filter(b=>b.alive&&_isEnemy(ball,b));
        let firstTarget=null;
        targets.forEach((t,idx)=>{
          _FX.chains.push({x1:ball.x,y1:ball.y,x2:t.x,y2:t.y,
            life:50,max:50,ownerId:ball.id,targetId:t.id,type:'toji'});
          t.hit(); _addDmg(ball,25);
          if(idx===0) firstTarget=t;
        });
        _burst(ball.x,ball.y,'#c0c0c0',16);
        _G.shakeFrames=18; _G.shakeAmt=14;
        if(firstTarget){
          const ftid=firstTarget.id, ftlen=targets.length;
          _CAM.setFollow(firstTarget.x, firstTarget.y, firstTarget.id);
          setTimeout(()=>{ const bt=_G.balls.find(b=>b.id===ftid); if(bt) _CAM.impact(bt.x,bt.y,'#c0c0c0',ftlen>1?`${ftlen} HIT!`:'HIT!',ftid); },350);
        }
      } break;

    case 'ekko_ult':
      // Teleport to old position + explosion — camera follows to landing spot
      { const snap=_FX.rewindGhosts.length>0?_FX.rewindGhosts[0]:null;
        const oldPos=snap?.find(s=>s.id===ball.id);
        const lx=oldPos?oldPos.x:ball.x, ly=oldPos?oldPos.y:ball.y;
        _FX.ekkoGhosts.push({x:ball.x,y:ball.y,color:ball.color,life:60,max:60});
        ball.x=lx; ball.y=ly;
        ball.hp=Math.min(ball.max,ball.hp+3);
        _FX.explosions.push({x:lx,y:ly,r:0,maxR:140,life:30,max:30,color:'#00ff88'});
        let hitCount=0;
        _G.balls.forEach(b=>{ if(b.alive&&_isEnemy(ball,b)){
          const dx=b.x-lx,dy=b.y-ly,d=Math.hypot(dx,dy);
          if(d<140){ b.hit(); b.vx+=dx/(d||1)*10; b.vy+=dy/(d||1)*10; _addDmg(ball,25); hitCount++; }
        }});
        _burst(lx,ly,'#00ff88',28);
        _G.shakeFrames=25; _G.shakeAmt=18;
        _G.arenaFlash.color='#00ff88'; _G.arenaFlash.alpha=0.35;
        _CAM.setFollow(lx, ly, ball.id);
        setTimeout(()=>{ const bk=_G.balls.find(b=>b.id===ball.id); if(bk) _CAM.impact(bk.x,bk.y,'#00ff88', hitCount>0?'CHRONOBREAK!':'BLINK!',ball.id); },250);
      } break;

    case 'prison':
      // Trap a random enemy — camera follows to the trapped ball
      { const targets=_G.balls.filter(b=>b.alive&&_isEnemy(ball,b));
        if(targets.length>0){
          const t=targets[Math.floor(Math.random()*targets.length)];
          _FX.prisonTarget=t.id; _FX.prisonFrames=180;
          _burst(t.x,t.y,'#ff6600',20);
          _G.arenaFlash.color='#ff6600'; _G.arenaFlash.alpha=0.25;
          const tid2=t.id;
          _CAM.setFollow(t.x, t.y, t.id);
          setTimeout(()=>{ const bt=_G.balls.find(b=>b.id===tid2); if(bt) _CAM.impact(bt.x,bt.y,'#ff6600','TRAPPED!',tid2); },350);
        }
      } break;

    case 'portal':
      // Teleport next to the nearest enemy and launch toward them
      { const enemies = _G.balls.filter(b=>b.alive&&_isEnemy(ball,b));
        if(enemies.length > 0){
          // Find nearest enemy
          let nearest = enemies[0], nearDist = Infinity;
          enemies.forEach(e=>{ const d=Math.hypot(e.x-ball.x,e.y-ball.y); if(d<nearDist){nearDist=d;nearest=e;} });
          // Teleport just behind the target (offset so we don't overlap)
          const ang = Math.atan2(ball.y-nearest.y, ball.x-nearest.x); // approach from behind
          const tx = nearest.x + Math.cos(ang) * (nearest.r + ball.r + 8);
          const ty = nearest.y + Math.sin(ang) * (nearest.r + ball.r + 8);
          // Keep inside arena
          const distFromCenter = Math.hypot(tx-ACX, ty-ACY);
          const clampR = Math.min(1, (AR-ball.r-4)/Math.max(1,distFromCenter));
          const ftx = distFromCenter>AR-ball.r-4 ? ACX+(tx-ACX)*clampR : tx;
          const fty = distFromCenter>AR-ball.r-4 ? ACY+(ty-ACY)*clampR : ty;
          // Portals FX
          _FX.portals.push({x:ball.x,y:ball.y,life:60,color:'#00ff44',type:'out'});
          _FX.portals.push({x:ftx,y:fty,life:60,color:'#00ff44',type:'in'});
          _burst(ball.x,ball.y,'#00ff44',16);
          _burst(ftx,fty,'#00ff44',16);
          ball.x=ftx; ball.y=fty;
          // Launch toward the target
          const toEnemy = Math.atan2(nearest.y-fty, nearest.x-ftx);
          const spd = Math.max(Math.hypot(ball.vx,ball.vy), ball.baseSpd*1.5);
          ball.vx = Math.cos(toEnemy)*spd;
          ball.vy = Math.sin(toEnemy)*spd;
          _CAM.setFollow(ftx, fty, ball.id);
          const eid = nearest.id;
          setTimeout(()=>{ const bt=_G.balls.find(b=>b.id===eid); if(bt) _CAM.impact(bt.x,bt.y,'#00ff44','PORTAL!',eid); },250);
        }
      } break;

    // ══════════════════════════════════════
    // BLACK CLOVER ABILITIES
    // ══════════════════════════════════════
    case 'hellfire':
      _FX.hellfireZone={x:ball.x,y:ball.y,r:110,life:360,max:360,ownerId:ball.id,intensity:1};
      _burst(ball.x,ball.y,'#ff6600',28);
      _G.arenaFlash.color='#ff4400'; _G.arenaFlash.alpha=0.45;
      _G.shakeFrames=16; _G.shakeAmt=14;
      _CAM.setFollow(ball.x,ball.y,ball.id);
      setTimeout(()=>_CAM.impact(ball.x,ball.y,'#ff6600','HELLFIRE!'),300);
      break;

    case 'spatial_cube':
      { const enemies=_G.balls.filter(b=>b.alive&&_isEnemy(ball,b));
        enemies.forEach(t=>{
          _FX.spatialCubes.push({x:t.x,y:t.y,size:55,angle:0,life:200,max:200,targetId:t.id,ownerId:ball.id});
        });
        _burst(ball.x,ball.y,'#8800ff',22);
        _G.arenaFlash.color='#5500aa'; _G.arenaFlash.alpha=0.4;
        _G.shakeFrames=18; _G.shakeAmt=14;
        if(enemies.length){
          const t=enemies[0];
          _CAM.setFollow(t.x,t.y,t.id);
          setTimeout(()=>_CAM.impact(t.x,t.y,'#8800ff','SPATIAL CUBE!'),300);
        }
      } break;

    case 'zephyr':
      { const enemies=_G.balls.filter(b=>b.alive&&_isEnemy(ball,b));
        const target=enemies.length?enemies.reduce((c,b)=>Math.hypot(b.x-ball.x,b.y-ball.y)<Math.hypot(c.x-ball.x,c.y-ball.y)?b:c):null;
        const ang=target?Math.atan2(target.y-ball.y,target.x-ball.x):Math.random()*Math.PI*2;
        _FX.zephyrBlade={x:ball.x,y:ball.y,vx:Math.cos(ang)*12,vy:Math.sin(ang)*12,
          life:90,max:90,ownerId:ball.id,angle:ang,width:30};
        _burst(ball.x,ball.y,'#aaddff',22);
        _G.arenaFlash.color='#88ccff'; _G.arenaFlash.alpha=0.3;
        _G.shakeFrames=10; _G.shakeAmt=8;
        if(target){ _CAM.setFollow(target.x,target.y,target.id); const tid=target.id; setTimeout(()=>{ const bt=_G.balls.find(b=>b.id===tid); if(bt) _CAM.impact(bt.x,bt.y,'#aaddff','ZEPHYR!'); },400); }
      } break;

    case 'black_asta':
      _FX.blackAstaFrames=280; _FX.blackAstaOwner=ball.id;
      _burst(ball.x,ball.y,'#111111',24);
      // Black explosion
      _FX.explosions.push({x:ball.x,y:ball.y,r:0,maxR:100,life:20,max:20,color:'#330000'});
      _G.arenaFlash.color='#000000'; _G.arenaFlash.alpha=0.6;
      _G.shakeFrames=22; _G.shakeAmt=18;
      _CAM.setFollow(ball.x,ball.y,ball.id);
      setTimeout(()=>_CAM.impact(ball.x,ball.y,'#ff0000','BLACK ASTA!'),200);
      break;

    case 'yami_slash':
      { const _nearest_ys=_G.balls.filter(b=>b.alive&&_isEnemy(ball,b)).sort((a,b)=>Math.hypot(a.x-ball.x,a.y-ball.y)-Math.hypot(b.x-ball.x,b.y-ball.y))[0];
        const ang=_nearest_ys?Math.atan2(_nearest_ys.y-ball.y,_nearest_ys.x-ball.x):Math.random()*Math.PI;
        const len=ARENA.r*2.2;
        _FX.yamiSlash={
          x1:ACX-Math.cos(ang)*len,y1:ACY-Math.sin(ang)*len,
          x2:ACX+Math.cos(ang)*len,y2:ACY+Math.sin(ang)*len,
          life:80,max:80,ownerId:ball.id,angle:ang
        };
        _burst(ACX,ACY,'#9900ff',30);
        _G.arenaFlash.color='#110022'; _G.arenaFlash.alpha=0.65;
        _G.shakeFrames=28; _G.shakeAmt=22;
        _CAM.setFollow(ACX,ACY);
        setTimeout(()=>_CAM.impact(ACX,ACY,'#9900ff','DIMENSION CUT!'),300);
      } break;

    // ══════════════════════════════════════
    // JJK ABILITIES
    // ══════════════════════════════════════
    case 'sukuna_cleave':
      // Twin X-slash lines + malevolent shrine zone
      { const a1=Math.random()*Math.PI, a2=a1+Math.PI/2;
        [a1,a2].forEach(ang=>{
          _FX.sukunaCleaves.push({
            x1:ball.x-Math.cos(ang)*280, y1:ball.y-Math.sin(ang)*280,
            x2:ball.x+Math.cos(ang)*280, y2:ball.y+Math.sin(ang)*280,
            life:60,max:60,ownerId:ball.id
          });
        });
        _FX.sukunaShrine={x:ball.x,y:ball.y,r:180,life:240,max:240,ownerId:ball.id,angle:0};
        _burst(ball.x,ball.y,'#cc0022',30);
        _G.arenaFlash.color='#880000'; _G.arenaFlash.alpha=0.55;
        _G.shakeFrames=22; _G.shakeAmt=18;
        _CAM.setFollow(ball.x,ball.y,ball.id);
        setTimeout(()=>_CAM.impact(ball.x,ball.y,'#cc0022','MALEVOLENT SHRINE!'),300);
      } break;

    case 'mahoraga':
      // Summon zone — slows + damages enemies inside, adaptation mechanic
      _FX.mahoragaZone={x:ACX,y:ACY,r:220,life:300,max:300,ownerId:ball.id,adapted:[]};
      _burst(ACX,ACY,'#9933ff',28);
      _G.arenaFlash.color='#4400aa'; _G.arenaFlash.alpha=0.4;
      _G.shakeFrames=20; _G.shakeAmt=16;
      _CAM.setFollow(ACX,ACY);
      setTimeout(()=>_CAM.impact(ACX,ACY,'#9933ff','MAHORAGA!'),400);
      break;

    case 'piercing_blood':
      // 5 homing blood projectiles in a fan
      { const baseAng = _G.balls.filter(b=>b.alive&&_isEnemy(ball,b)).length
          ? Math.atan2(_G.balls.filter(b=>b.alive&&_isEnemy(ball,b))
              .reduce((c,b)=>Math.hypot(b.x-ball.x,b.y-ball.y)<Math.hypot(c.x-ball.x,c.y-ball.y)?b:c).y-ball.y,
              _G.balls.filter(b=>b.alive&&_isEnemy(ball,b))
              .reduce((c,b)=>Math.hypot(b.x-ball.x,b.y-ball.y)<Math.hypot(c.x-ball.x,c.y-ball.y)?b:c).x-ball.x)
          : Math.random()*Math.PI*2;
        const spd=10;
        for(let si=-2;si<=2;si++){
          const ang=baseAng+si*0.28;
          _FX.bloodStreams.push({x:ball.x,y:ball.y,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd,
            life:90,max:90,ownerId:ball.id,homed:0,bounced:0});
        }
        _burst(ball.x,ball.y,'#aa0000',20);
        _G.arenaFlash.color='#880000'; _G.arenaFlash.alpha=0.35;
        _CAM.setFollow(ball.x,ball.y,ball.id);
      } break;

    case 'rika':
      // Spirit zone that follows owner and pulls+damages enemies
      _FX.rikaZone={ownerId:ball.id,r:150,life:240,max:240};
      _burst(ball.x,ball.y,'#ccccff',22);
      _G.arenaFlash.color='#8888ff'; _G.arenaFlash.alpha=0.3;
      _CAM.setFollow(ball.x,ball.y,ball.id);
      setTimeout(()=>_CAM.impact(ball.x,ball.y,'#ccccff','RIKA!'),350);
      break;

    case 'hakari':
      // Pachinko — random chaos effects for 5 seconds
      _FX.hakariFrames=300; _FX.hakariOwner=ball.id; _FX.hakariJackpot=0;
      _burst(ball.x,ball.y,'#ff00ff',24);
      _G.arenaFlash.color='#ff00ff'; _G.arenaFlash.alpha=0.5;
      _G.shakeFrames=15; _G.shakeAmt=12;
      _CAM.setFollow(ball.x,ball.y,ball.id);
      setTimeout(()=>_CAM.impact(ball.x,ball.y,'#ff00ff','JACKPOT!'),200);
      break;

    // ══════════════════════════════════════
    // NARUTO ABILITIES
    // ══════════════════════════════════════
    case 'rasengan':
      // Traveling spiral orb — shoots toward nearest enemy
      { const enemies = _G.balls.filter(b=>b.alive&&_isEnemy(ball,b));
        const target = enemies.length ? enemies.reduce((c,b)=>Math.hypot(b.x-ball.x,b.y-ball.y)<Math.hypot(c.x-ball.x,c.y-ball.y)?b:c) : null;
        const ang = target ? Math.atan2(target.y-ball.y, target.x-ball.x) : Math.random()*Math.PI*2;
        const spd = 9;
        _FX.rasengan = {x:ball.x, y:ball.y, vx:Math.cos(ang)*spd, vy:Math.sin(ang)*spd,
                       r:26, life:120, max:120, ownerId:ball.id, angle:0, bounces:0};
        _burst(ball.x, ball.y, '#0099ff', 20);
        _G.arenaFlash.color='#0044ff'; _G.arenaFlash.alpha=0.25;
        _G.shakeFrames=8; _G.shakeAmt=8;
        if(target){ _CAM.setFollow(target.x, target.y, target.id); }
      } break;

    case 'chidori':
      // Lightning beam in direction of nearest enemy — pierces, stuns
      { const enemies = _G.balls.filter(b=>b.alive&&_isEnemy(ball,b));
        const target = enemies.length ? enemies.reduce((c,b)=>Math.hypot(b.x-ball.x,b.y-ball.y)<Math.hypot(c.x-ball.x,c.y-ball.y)?b:c) : null;
        const ang = target ? Math.atan2(target.y-ball.y, target.x-ball.x) : Math.random()*Math.PI*2;
        _FX.chidori = {x:ball.x, y:ball.y, angle:ang, life:50, max:50, ownerId:ball.id};
        _burst(ball.x, ball.y, '#ffee00', 24);
        _G.arenaFlash.color='#ffee00'; _G.arenaFlash.alpha=0.4;
        _G.shakeFrames=14; _G.shakeAmt=14;
        // Speed up owner toward target
        if(target){
          const d = Math.hypot(target.x-ball.x, target.y-ball.y)||1;
          ball.vx = (target.x-ball.x)/d * 16; ball.vy = (target.y-ball.y)/d * 16;
          _CAM.setFollow(target.x, target.y, target.id);
          const tid = target.id;
          setTimeout(()=>{ const bt=_G.balls.find(b=>b.id===tid); if(bt) _CAM.impact(bt.x,bt.y,'#ffee00','CHIDORI!'); },300);
        }
      } break;

    case 'tsukuyomi':
      // Genjutsu: traps nearest enemy in illusion — frozen + periodic damage
      { const enemies = _G.balls.filter(b=>b.alive&&_isEnemy(ball,b));
        if(enemies.length>0){
          const t = enemies.reduce((c,b)=>Math.hypot(b.x-ball.x,b.y-ball.y)<Math.hypot(c.x-ball.x,c.y-ball.y)?b:c);
          _FX.tsukuyomiTarget = t.id; _FX.tsukuyomiFrames = 200; _FX.tsukuyomiOwner = ball.id;
          _burst(t.x, t.y, '#cc00aa', 22);
          _G.arenaFlash.color='#880066'; _G.arenaFlash.alpha=0.35;
          _CAM.setFollow(t.x, t.y, t.id);
          const tid = t.id;
          setTimeout(()=>{ const bt=_G.balls.find(b=>b.id===tid); if(bt) _CAM.impact(bt.x,bt.y,'#cc00aa','TSUKUYOMI!'); },300);
        }
      } break;

    case 'hiraishin':
      // Flying Thunder God: teleport behind nearest enemy + slash attack
      { const enemies = _G.balls.filter(b=>b.alive&&_isEnemy(ball,b));
        if(enemies.length>0){
          const target = enemies.reduce((c,b)=>Math.hypot(b.x-ball.x,b.y-ball.y)<Math.hypot(c.x-ball.x,c.y-ball.y)?b:c);
          // Ghost at old position
          _FX.ekkoGhosts.push({x:ball.x, y:ball.y, color:'#ffaa00', life:50, max:50});
          // Teleport BEHIND target
          const ang = Math.atan2(target.y-ACY, target.x-ACX);
          const tx = target.x - Math.cos(ang)*(target.r+ball.r+6);
          const ty = target.y - Math.sin(ang)*(target.r+ball.r+6);
          const clamp = Math.min(1,(ARENA.r-ball.r-4)/Math.max(1,Math.hypot(tx-ACX,ty-ACY)));
          ball.x = Math.hypot(tx-ACX,ty-ACY)>ARENA.r-ball.r-4 ? ACX+(tx-ACX)*clamp : tx;
          ball.y = Math.hypot(tx-ACX,ty-ACY)>ARENA.r-ball.r-4 ? ACY+(ty-ACY)*clamp : ty;
          // Launch into target at high speed
          const toTgt = Math.atan2(target.y-ball.y, target.x-ball.x);
          ball.vx = Math.cos(toTgt)*18; ball.vy = Math.sin(toTgt)*18;
          // Golden portals
          _FX.portals.push({x:ball.x, y:ball.y, life:50, color:'#ffaa00', type:'in'});
          _burst(ball.x, ball.y, '#ffaa00', 18);
          _G.arenaFlash.color='#ffaa00'; _G.arenaFlash.alpha=0.3;
          _G.shakeFrames=12; _G.shakeAmt=12;
          _CAM.setFollow(ball.x, ball.y, ball.id);
          const tid = target.id;
          setTimeout(()=>{ const bt=_G.balls.find(b=>b.id===tid); if(bt) _CAM.impact(bt.x,bt.y,'#ffaa00','HIRAISHIN!'); },200);
        }
      } break;

    case 'sand_tsunami':
      // Expanding sand wave ring from owner — pushes and damages on contact
      _FX.sandWave = {x:ball.x, y:ball.y, r:0, maxR:ARENA.r*1.1, life:80, max:80, ownerId:ball.id};
      _burst(ball.x, ball.y, '#cc9933', 28);
      _G.arenaFlash.color='#aa7700'; _G.arenaFlash.alpha=0.3;
      _G.shakeFrames=20; _G.shakeAmt=16;
      _CAM.setFollow(ACX, ACY);
      setTimeout(()=>_CAM.impact(ACX, ACY, '#cc9933', 'SAND TSUNAMI!'), 400);
      break;

    // ══════════════════════════════════════
    // SLIME ISEKAI
    // ══════════════════════════════════════
    case 'drago_nova':
      // Milim's star explosion that splits into 6 homing shards
      { const shards=[];
        for(let i=0;i<6;i++){
          const a=Math.PI*2/6*i;
          shards.push({x:ball.x,y:ball.y,vx:Math.cos(a)*5,vy:Math.sin(a)*5,life:80,max:80,hit:false});
        }
        _FX.dragoNova={x:ball.x,y:ball.y,r:0,maxR:80,life:100,max:100,ownerId:ball.id,shards};
        _burst(ball.x,ball.y,'#ffdd00',30);
        _G.arenaFlash.color='#ffcc00'; _G.arenaFlash.alpha=0.5;
        _G.shakeFrames=20; _G.shakeAmt=18;
        _CAM.impact(ball.x,ball.y,'#ffdd00','DRAGO NOVA!');
      } break;

    case 'megiddo':
      // Rimuru's divine light beams rain from above — 5 strikes over 3s
      { for(let i=0;i<5;i++){
          const tx=ACX+(Math.random()-0.5)*ARENA.r*1.6;
          const ty=ACY+(Math.random()-0.5)*ARENA.r*1.6;
          const dist=Math.hypot(tx-ACX,ty-ACY);
          if(dist>ARENA.r*0.9) continue;
          _FX.megiddoBeams.push({x:tx,y:ty,life:90+i*15,max:90+i*15,ownerId:ball.id,delay:i*18});
        }
        _burst(ball.x,ball.y,'#ffffff',26);
        _G.arenaFlash.color='#ffffcc'; _G.arenaFlash.alpha=0.6;
        _G.shakeFrames=12; _G.shakeAmt=10;
        _CAM.setFollow(ACX,ACY);
        setTimeout(()=>_CAM.impact(ACX,ACY,'#ffffff','MEGIDDO!'),150);
      } break;

    case 'veldora_storm':
      // Veldora's black tempest — massive spinning storm that pulls and shreds
      _FX.veldoraStorm={x:ACX,y:ACY,r:ARENA.r*0.8,life:300,max:300,ownerId:ball.id,angle:0};
      _burst(ACX,ACY,'#1a3aff',30);
      _G.arenaFlash.color='#001aff'; _G.arenaFlash.alpha=0.5;
      _G.shakeFrames=25; _G.shakeAmt=20;
      _CAM.setFollow(ACX,ACY);
      setTimeout(()=>_CAM.impact(ACX,ACY,'#1a3aff','BLACK STORM!'),200);
      break;

    case 'prominence':
      // Milim/Benimaru's crimson dragon flame — sweeping dragon beam
      _FX.prominenceDragon={x:ball.x,y:ball.y,life:200,max:200,ownerId:ball.id,angle:Math.atan2(ball.vy,ball.vx),size:1};
      _burst(ball.x,ball.y,'#dc143c',28);
      _G.arenaFlash.color='#cc0000'; _G.arenaFlash.alpha=0.5;
      _G.shakeFrames=22; _G.shakeAmt=18;
      _CAM.setFollow(ball.x,ball.y,ball.id);
      setTimeout(()=>_CAM.impact(ball.x,ball.y,'#dc143c','PROMINENCE!'),200);
      break;

    case 'diablo_end':
      // Diablo's celestial vortex — absorbs nearby balls, heals owner
      _FX.diabloVortex={x:ball.x,y:ball.y,r:120,life:240,max:240,ownerId:ball.id};
      _burst(ball.x,ball.y,'#6600cc',30);
      _G.arenaFlash.color='#440088'; _G.arenaFlash.alpha=0.55;
      _G.shakeFrames=20; _G.shakeAmt=16;
      _CAM.impact(ball.x,ball.y,'#6600cc','CELESTIAL END!');
      break;

    // ══════════════════════════════════════
    // CHAINSAW MAN
    // ══════════════════════════════════════
    case 'chainsaw_rev':
      // Denji's chainsaw spin — orbiting blade spokes that shred on contact
      { const spokes=[];
        for(let i=0;i<4;i++) spokes.push({angle:Math.PI/2*i,dist:70});
        _FX.chainsawRev={x:ball.x,y:ball.y,angle:0,life:240,max:240,ownerId:ball.id,spokes};
        _burst(ball.x,ball.y,'#ff2200',28);
        _G.arenaFlash.color='#ff0000'; _G.arenaFlash.alpha=0.6;
        _G.shakeFrames=20; _G.shakeAmt=16;
        _CAM.setFollow(ball.x,ball.y,ball.id);
        setTimeout(()=>_CAM.impact(ball.x,ball.y,'#ff2200','CHAINSAW!!'),150);
      } break;

    case 'blood_rain':
      // Power's blood spears — 8 spears rain from above onto random targets
      { const enemies=_G.balls.filter(b=>b.alive&&_isEnemy(ball,b));
        for(let i=0;i<8;i++){
          const tx=ACX+(Math.random()-0.5)*ARENA.r*1.6;
          const ty=ACY+(Math.random()-0.5)*ARENA.r*1.6;
          const d=Math.hypot(tx-ACX,ty-ACY);
          if(d>ARENA.r*0.95) continue;
          const spd=10+Math.random()*4;
          const ang=Math.atan2(ty-(ACY-1280*0.4),tx-tx);
          _FX.bloodSpears.push({x:tx,y:ACY-500-i*40,vx:0,vy:spd,life:80,max:80,ownerId:ball.id,tx,ty});
        }
        _burst(ball.x,ball.y,'#cc0022',24);
        _G.arenaFlash.color='#aa0000'; _G.arenaFlash.alpha=0.5;
        _G.shakeFrames=18; _G.shakeAmt=14;
        _CAM.setFollow(ACX,ACY);
        setTimeout(()=>_CAM.impact(ACX,ACY,'#cc0022','BLOOD RAIN!'),200);
      } break;

    case 'makima_chain':
      // Makima's control — chains burst from owner hitting all alive enemies
      { const enemies=_G.balls.filter(b=>b.alive&&_isEnemy(ball,b));
        for(const t of enemies){
          _FX.makimaChains.push({ox:ball.x,oy:ball.y,tx:t.x,ty:t.y,life:80,max:80,targetId:t.id,ownerId:ball.id,extend:0});
        }
        const firstTarget=enemies[0];
        _burst(ball.x,ball.y,'#880000',26);
        _G.arenaFlash.color='#660000'; _G.arenaFlash.alpha=0.55;
        _G.shakeFrames=22; _G.shakeAmt=18;
        if(firstTarget) _CAM.setFollow(firstTarget.x,firstTarget.y,firstTarget.id);
        else _CAM.setFollow(ball.x,ball.y,ball.id);
        setTimeout(()=>_CAM.impact(firstTarget?firstTarget.x:ball.x,firstTarget?firstTarget.y:ball.y,'#880000','CONTROL!',firstTarget?firstTarget.id:ball.id),200);
      } break;

    case 'future_devil':
      // Future Devil — owner briefly dodges all hits + counter-punches attacker
      _FX.futureDevil={ownerId:ball.id,life:300,max:300,dodgeFrames:0,counterAngle:0};
      _burst(ball.x,ball.y,'#440088',22);
      _G.arenaFlash.color='#220044'; _G.arenaFlash.alpha=0.4;
      _CAM.setFollow(ball.x,ball.y,ball.id);
      setTimeout(()=>_CAM.impact(ball.x,ball.y,'#8844ff','THE FUTURE...'),300);
      break;

    case 'pochita_core':
      // Pochita's heart — massive expanding burst of pure orange energy
      _FX.pochitaCore={x:ball.x,y:ball.y,r:0,maxR:ARENA.r*1.05,life:90,max:90,ownerId:ball.id};
      _burst(ball.x,ball.y,'#ff6600',34);
      _G.arenaFlash.color='#ff4400'; _G.arenaFlash.alpha=0.7;
      _G.shakeFrames=30; _G.shakeAmt=28;
      _CAM.impact(ball.x,ball.y,'#ff6600','POCHITA!!');
      break;

    // ══════════════════════════════════════
    // ONE PUNCH MAN
    // ══════════════════════════════════════
    case 'serious_punch':
      // Saitama — one giant shockwave that splits the air in two
      { const _nearest_sp=_G.balls.filter(b=>b.alive&&_isEnemy(ball,b)).sort((a,b)=>Math.hypot(a.x-ball.x,a.y-ball.y)-Math.hypot(b.x-ball.x,b.y-ball.y))[0];
        const ang=_nearest_sp?Math.atan2(_nearest_sp.y-ball.y,_nearest_sp.x-ball.x):Math.atan2(ball.vy,ball.vx);
        _FX.seriousPunch={x:ball.x,y:ball.y,vx:Math.cos(ang)*18,vy:Math.sin(ang)*18,r:40,life:60,max:60,ownerId:ball.id,ang};
        _burst(ball.x,ball.y,'#ffff00',36);
        _G.arenaFlash.color='#ffffaa'; _G.arenaFlash.alpha=0.8;
        _G.shakeFrames=35; _G.shakeAmt=30;
        _CAM.impact(ball.x,ball.y,'#ffff00','SERIOUS PUNCH!!');
      } break;

    case 'incinerate':
      // Genos — sweeping incineration beam
      { const _nearest_inc=_G.balls.filter(b=>b.alive&&_isEnemy(ball,b)).sort((a,b)=>Math.hypot(a.x-ball.x,a.y-ball.y)-Math.hypot(b.x-ball.x,b.y-ball.y))[0];
        const ang=_nearest_inc?Math.atan2(_nearest_inc.y-ball.y,_nearest_inc.x-ball.x):Math.atan2(ball.vy,ball.vx);
        _FX.incinerateBeam={x:ball.x,y:ball.y,angle:ang,life:120,max:120,ownerId:ball.id,width:1};
        _burst(ball.x,ball.y,'#ff5500',28);
        _G.arenaFlash.color='#ff4400'; _G.arenaFlash.alpha=0.55;
        _G.shakeFrames=20; _G.shakeAmt=16;
        _CAM.setFollow(ball.x,ball.y,ball.id);
        setTimeout(()=>_CAM.impact(ball.x,ball.y,'#ff6600','INCINERATE!'),150);
      } break;

    case 'tornado_psy':
      // Tatsumaki — psychic lift, all enemies float up then slam down
      { _FX.tornadoPsy={ownerId:ball.id,life:240,max:240,r:ARENA.r*0.85,angle:0};
        const enemies=_G.balls.filter(b=>b.alive&&_isEnemy(ball,b));
        for(const e of enemies){ e.vx*=0.1; e.vy=-12-Math.random()*4; }
        _burst(ball.x,ball.y,'#44ff88',30);
        _G.arenaFlash.color='#00cc44'; _G.arenaFlash.alpha=0.45;
        _G.shakeFrames=22; _G.shakeAmt=18;
        _CAM.setFollow(ACX,ACY);
        setTimeout(()=>_CAM.impact(ACX,ACY,'#44ff88','TORNADO PSY!'),200);
      } break;

    case 'silver_fang':
      // Bang — martial arts shockwave ring that crushes everything inside
      _FX.silverFangWave={x:ball.x,y:ball.y,r:0,maxR:ARENA.r*1.05,life:70,max:70,ownerId:ball.id};
      _burst(ball.x,ball.y,'#aaddff',28);
      _G.arenaFlash.color='#88aacc'; _G.arenaFlash.alpha=0.4;
      _G.shakeFrames=22; _G.shakeAmt=18;
      _CAM.impact(ball.x,ball.y,'#aaddff','SILVER FANG!');
      break;

    case 'sonic_slash':
      // Sonic — 6 invisible slashes in rapid succession across the arena
      { const _nearest_ss=_G.balls.filter(b=>b.alive&&_isEnemy(ball,b)).sort((a,b)=>Math.hypot(a.x-ball.x,a.y-ball.y)-Math.hypot(b.x-ball.x,b.y-ball.y))[0];
        const _base_ang_ss=_nearest_ss?Math.atan2(_nearest_ss.y-ball.y,_nearest_ss.x-ball.x):Math.random()*Math.PI*2;
        for(let i=0;i<6;i++){
          const ang=_base_ang_ss + (i-2.5)*(Math.PI/6);
          const len=ARENA.r*2;
          setTimeout(()=>{
            _FX.sonicSlashes.push({
              x1:ACX-Math.cos(ang)*len,y1:ACY-Math.sin(ang)*len,
              x2:ACX+Math.cos(ang)*len,y2:ACY+Math.sin(ang)*len,
              life:30,max:30,ownerId:ball.id
            });
          },i*80);
        }
        _burst(ball.x,ball.y,'#ccffff',22);
        _G.arenaFlash.color='#aaffff'; _G.arenaFlash.alpha=0.4;
        _G.shakeFrames=15; _G.shakeAmt=12;
        _CAM.setFollow(ACX,ACY);
        setTimeout(()=>_CAM.impact(ACX,ACY,'#ccffff','SONIC SLASH!'),200);
      } break;

    // ══════════════════════════════════════
    // FRIEREN
    // ══════════════════════════════════════
    case 'zoltraak':
      // Frieren — 5 tracking magic bolts
      { const enemies=_G.balls.filter(b=>b.alive&&_isEnemy(ball,b));
        const _nearest_zol=enemies.sort((a,b)=>Math.hypot(a.x-ball.x,a.y-ball.y)-Math.hypot(b.x-ball.x,b.y-ball.y))[0];
        const _base_ang_zol=_nearest_zol?Math.atan2(_nearest_zol.y-ball.y,_nearest_zol.x-ball.x):Math.atan2(ball.vy,ball.vx);
        for(let i=0;i<5;i++){
          const ang=Math.PI*2/5*i + _base_ang_zol;
          const spd=8+i*0.5;
          _FX.zoltraakBeams.push({x:ball.x,y:ball.y,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd,
            life:100,max:100,ownerId:ball.id,r:10,homed:false});
        }
        _burst(ball.x,ball.y,'#8866ff',24);
        _G.arenaFlash.color='#6644cc'; _G.arenaFlash.alpha=0.4;
        _G.shakeFrames=12; _G.shakeAmt=10;
        setTimeout(()=>_CAM.impact(ball.x,ball.y,'#8866ff','ZOLTRAAK!'),150);
      } break;

    case 'granat':
      // Serie's destruction sphere — implodes then explodes
      _FX.granatOrb={x:ball.x,y:ball.y,r:0,maxR:130,life:150,max:150,ownerId:ball.id,phase:'grow'};
      _burst(ball.x,ball.y,'#ff88ff',26);
      _G.arenaFlash.color='#cc44cc'; _G.arenaFlash.alpha=0.45;
      _G.shakeFrames=18; _G.shakeAmt=14;
      _CAM.impact(ball.x,ball.y,'#ff88ff','GRANAT!!');
      break;

    case 'aura_soul':
      // Aura's soul drain — saps HP from all enemies slowly
      _FX.auraSoul={ownerId:ball.id,life:360,max:360};
      _burst(ball.x,ball.y,'#88ffdd',22);
      _G.arenaFlash.color='#44ddaa'; _G.arenaFlash.alpha=0.35;
      _CAM.setFollow(ball.x,ball.y,ball.id);
      setTimeout(()=>_CAM.impact(ball.x,ball.y,'#88ffdd','SOUL DRAIN!'),300);
      break;

    case 'stark_thunder':
      // Stark's warrior aura — explosion of kinetic force rings
      { const rings=[];
        for(let i=0;i<3;i++) rings.push({r:0,maxR:ARENA.r*(0.5+i*0.25),life:50+i*10,max:50+i*10});
        _FX.starkThunder={x:ball.x,y:ball.y,r:0,maxR:ARENA.r,life:80,max:80,ownerId:ball.id,rings};
        _burst(ball.x,ball.y,'#ffdd44',30);
        _G.arenaFlash.color='#ffcc00'; _G.arenaFlash.alpha=0.55;
        _G.shakeFrames=28; _G.shakeAmt=24;
        _CAM.impact(ball.x,ball.y,'#ffdd44','STARK THUNDER!!');
      } break;

    case 'frieren_end':
      // Allmächtig — ancient magic expands and shatters everything, enormous range
      { const shards=[];
        for(let i=0;i<12;i++){
          const a=Math.PI*2/12*i;
          shards.push({x:ball.x,y:ball.y,vx:Math.cos(a)*6,vy:Math.sin(a)*6,life:90,max:90,hit:false});
        }
        _FX.frierenEnd={x:ball.x,y:ball.y,r:0,maxR:ARENA.r*1.05,life:120,max:120,ownerId:ball.id,shards};
        _burst(ball.x,ball.y,'#cceeff',32);
        _G.arenaFlash.color='#aaddff'; _G.arenaFlash.alpha=0.65;
        _G.shakeFrames=30; _G.shakeAmt=26;
        _CAM.impact(ball.x,ball.y,'#cceeff','ALLMÄCHTIG!!');
      } break;

    // ══════════════════════════════════════
    // ARENA POWERS
    // ══════════════════════════════════════
    case 'arena_split':
      // Arena splits visually — random wall divides the arena briefly
      { ARENA.splitActive = true;
        ARENA.splitAngle = Math.random() * Math.PI;
        ARENA.splitFrames = 280;
        _burst(ACX, ACY, '#ff4488', 30);
        _G.arenaFlash.color='#ff0066'; _G.arenaFlash.alpha=0.5;
        _G.shakeFrames=25; _G.shakeAmt=20;
        _CAM.setFollow(ACX, ACY);
        setTimeout(()=>_CAM.impact(ACX,ACY,'#ff4488','ARENA SPLIT!'),200);
        // Push balls away from split line
        _G.balls.forEach(b=>{
          if(!b.alive) return;
          const side = Math.cos(ARENA.splitAngle)*(b.x-ACX) + Math.sin(ARENA.splitAngle)*(b.y-ACY);
          const push = side > 0 ? 1 : -1;
          b.vx += Math.cos(ARENA.splitAngle+Math.PI/2)*push*12;
          b.vy += Math.sin(ARENA.splitAngle+Math.PI/2)*push*12;
        });
      } break;

    case 'arena_shrink':
      // Arena shrinks for 8 seconds, crushing balls together
      ARENA.shrinkFrames = 480;
      _burst(ACX, ACY, '#ff2200', 32);
      _G.arenaFlash.color='#ff2200'; _G.arenaFlash.alpha=0.55;
      _G.shakeFrames=30; _G.shakeAmt=25;
      _CAM.setFollow(ACX, ACY);
      setTimeout(()=>_CAM.impact(ACX,ACY,'#ff2200','SHRINK!'),300);
      break;

    // ══════════════════════════════════════
    // THE EMINENCE IN SHADOW
    // ══════════════════════════════════════
    case 'i_am_atomic':
      { _FX.atomicBlast={x:ball.x,y:ball.y,r:0,maxR:AR*1.1,life:50,max:50,ownerId:ball.id};
        _burst(ball.x,ball.y,'#ffffff',60);
        _G.arenaFlash.color='#ffffff'; _G.arenaFlash.alpha=1.0;
        _G.shakeFrames=60; _G.shakeAmt=40;
        _G.balls.forEach(b=>{ if(b.alive&&_isEnemy(ball,b)){
          const dx=b.x-ball.x,dy=b.y-ball.y,d=Math.hypot(dx,dy)||1;
          b.vx+=dx/d*22; b.vy+=dy/d*22; b.hit(); b.hit(); _addDmg(ball,60);
        }});
        _CAM.setFollow(ball.x,ball.y,ball.id);
        setTimeout(()=>_CAM.impact(ball.x,ball.y,'#ffffff','I AM ATOMIC!!',ball.id),200);
      } break;

    case 'shadow_slash':
      { const _nearest_shd=_G.balls.filter(b=>b.alive&&_isEnemy(ball,b)).sort((a,b)=>Math.hypot(a.x-ball.x,a.y-ball.y)-Math.hypot(b.x-ball.x,b.y-ball.y))[0];
        const angle=_nearest_shd?Math.atan2(_nearest_shd.y-ball.y,_nearest_shd.x-ball.x):Math.random()*Math.PI*2;
        // Clamp slash length so it stays inside the arena
        const distToEdge=Math.max(40, ARENA.r - Math.hypot(ball.x-ACX,ball.y-ACY));
        _FX.shadowSlash={x:ball.x,y:ball.y,angle,life:40,max:40,ownerId:ball.id,len:distToEdge*1.4};
        _burst(ball.x,ball.y,'#222244',24);
        _G.arenaFlash.color='#111122'; _G.arenaFlash.alpha=0.7;
        _G.shakeFrames=20; _G.shakeAmt=15;
        _G.balls.forEach(b=>{ if(!b.alive||!_isEnemy(ball,b)) return;
          const dx=b.x-ball.x,dy=b.y-ball.y;
          const proj=dx*Math.cos(angle)+dy*Math.sin(angle);
          const perp=Math.abs(-dx*Math.sin(angle)+dy*Math.cos(angle));
          if(perp<45&&proj>-20&&proj<distToEdge*1.4){ b.hit(); b.vx+=Math.cos(angle)*12; b.vy+=Math.sin(angle)*12; _addDmg(ball,30); }
        });
        // Camera follows midpoint of slash, clamped inside arena
        const camDist=Math.min(distToEdge*0.6, ARENA.r*0.7);
        _CAM.setFollow(ball.x+Math.cos(angle)*camDist, ball.y+Math.sin(angle)*camDist);
        setTimeout(()=>_CAM.impact(ball.x+Math.cos(angle)*camDist,ball.y+Math.sin(angle)*camDist,'#4444ff','SHADOW!'),300);
      } break;

    case 'delta_frenzy':
      { let hits=0;
        _G.balls.forEach(b=>{ if(!b.alive||!_isEnemy(ball,b)) return;
          for(let i=0;i<3;i++){
            _FX.deltaSlashes.push({x1:ball.x,y1:ball.y,x2:b.x+(Math.random()-0.5)*40,y2:b.y+(Math.random()-0.5)*40,life:20,max:20,ownerId:ball.id});
          }
          b.hit(); b.vx+=(Math.random()-0.5)*16; b.vy+=(Math.random()-0.5)*16; _addDmg(ball,20); hits++;
        });
        _burst(ball.x,ball.y,'#ff1144',28);
        _G.arenaFlash.color='#ff0033'; _G.arenaFlash.alpha=0.5;
        _G.shakeFrames=25; _G.shakeAmt=18;
        _CAM.setFollow(ball.x,ball.y,ball.id);
        setTimeout(()=>{ const bk=_G.balls.find(b=>b.id===ball.id); if(bk) _CAM.impact(bk.x,bk.y,'#ff1144',hits>0?`${hits}x HIT!`:'MISS!',ball.id); },250);
      } break;

    case 'gamma_laser':
      { const target=_G.balls.filter(b=>b.alive&&_isEnemy(ball,b)).sort((a,b2)=>Math.hypot(a.x-ball.x,a.y-ball.y)-Math.hypot(b2.x-ball.x,b2.y-ball.y))[0];
        if(target){
          const angle=Math.atan2(target.y-ball.y,target.x-ball.x);
          _FX.gammaBeam={x:ball.x,y:ball.y,angle,life:60,max:60,ownerId:ball.id};
          _burst(ball.x,ball.y,'#00aaff',20); _burst(target.x,target.y,'#00aaff',20);
          _G.arenaFlash.color='#0044ff'; _G.arenaFlash.alpha=0.4;
          target.hit(); _addDmg(ball,35);
          _CAM.setFollow(target.x,target.y,target.id);
          const tid=target.id;
          setTimeout(()=>{ const bt=_G.balls.find(b=>b.id===tid); if(bt) _CAM.impact(bt.x,bt.y,'#00aaff','LASER!',tid); },300);
        }
      } break;

    case 'beta_twin':
      { const enemies=_G.balls.filter(b=>b.alive&&_isEnemy(ball,b));
        for(let i=0;i<Math.min(enemies.length,3);i++){
          const t=enemies[i];
          _FX.betaBlades.push({x1:ball.x-20,y1:ball.y,x2:t.x,y2:t.y,life:35,max:35,ownerId:ball.id,side:0});
          _FX.betaBlades.push({x1:ball.x+20,y1:ball.y,x2:t.x,y2:t.y,life:35,max:35,ownerId:ball.id,side:1});
          t.hit(); _addDmg(ball,22);
          _burst(t.x,t.y,'#cc88ff',14);
        }
        _G.shakeFrames=18; _G.shakeAmt=14;
        _G.arenaFlash.color='#cc88ff'; _G.arenaFlash.alpha=0.35;
        _CAM.setFollow(ball.x,ball.y,ball.id);
        setTimeout(()=>{ const bk=_G.balls.find(b=>b.id===ball.id); if(bk) _CAM.impact(bk.x,bk.y,'#cc88ff','TWIN SWORDS!',ball.id); },300);
      } break;

    // ══════════════════════════════════════
    // OVERLORD
    // ══════════════════════════════════════
    case 'ainz_death':
      { _FX.ainzZone={x:ACX,y:ACY,r:AR*0.55,life:180,max:180,ownerId:ball.id};
        _burst(ACX,ACY,'#330011',36);
        _G.arenaFlash.color='#110000'; _G.arenaFlash.alpha=0.8;
        _G.shakeFrames=30; _G.shakeAmt=22;
        _CAM.setFollow(ACX,ACY);
        setTimeout(()=>_CAM.impact(ACX,ACY,'#550022','GOAL OF ALL LIFE IS DEATH!'),300);
      } break;

    case 'albedo_fort':
      { _FX.albedoShield={ownerId:ball.id,life:240,max:240,r:ball.r+32};
        ball.shieldFrames=240;
        _burst(ball.x,ball.y,'#fffacc',24);
        _G.arenaFlash.color='#fffacc'; _G.arenaFlash.alpha=0.3;
        _CAM.setFollow(ball.x,ball.y,ball.id);
        setTimeout(()=>{ const bk=_G.balls.find(b=>b.id===ball.id); if(bk) _CAM.impact(bk.x,bk.y,'#fffacc','FORTRESS!',ball.id); },300);
      } break;

    case 'shalltear_rage':
      { _FX.shalltearAura={ownerId:ball.id,life:200,max:200,r:90};
        ball.rage=200;
        _G.balls.forEach(b=>{ if(b.alive&&_isEnemy(ball,b)){
          const d=Math.hypot(b.x-ball.x,b.y-ball.y);
          if(d<150){ b.hit(); _addDmg(ball,20); const nx=(b.x-ball.x)/(d||1); const ny=(b.y-ball.y)/(d||1); b.vx+=nx*10; b.vy+=ny*10; }
        }});
        _burst(ball.x,ball.y,'#ff0055',32);
        _G.arenaFlash.color='#ff0033'; _G.arenaFlash.alpha=0.5;
        _G.shakeFrames=25; _G.shakeAmt=18;
        _CAM.setFollow(ball.x,ball.y,ball.id);
        setTimeout(()=>{ const bk=_G.balls.find(b=>b.id===ball.id); if(bk) _CAM.impact(bk.x,bk.y,'#ff0055','BLOOD FRENZY!',ball.id); },250);
      } break;

    case 'cocytus_freeze':
      { _FX.cocytusZone={x:ACX,y:ACY,r:AR*0.7,life:180,max:180,ownerId:ball.id};
        _G.balls.forEach(b=>{ if(b.alive&&_isEnemy(ball,b)){ b.freezeFrames=90; b.vx*=0.3; b.vy*=0.3; _addDmg(ball,15); }});
        _burst(ACX,ACY,'#aaeeff',36);
        _G.arenaFlash.color='#88ccff'; _G.arenaFlash.alpha=0.5;
        _G.shakeFrames=20; _G.shakeAmt=14;
        _CAM.setFollow(ACX,ACY);
        setTimeout(()=>_CAM.impact(ACX,ACY,'#aaeeff','FROST AURA!'),300);
      } break;

    case 'demiurge_hell':
      { for(let i=0;i<8;i++){
          const a=i*Math.PI/4+Math.random()*0.3;
          _FX.demiurgeLegs.push({x:ACX+Math.cos(a)*40,y:ACY+Math.sin(a)*40,angle:a,life:120,max:120,ownerId:ball.id});
        }
        _G.balls.forEach(b=>{ if(b.alive&&_isEnemy(ball,b)){ b.hit(); _addDmg(ball,18); }});
        _burst(ACX,ACY,'#ff6600',30);
        _G.arenaFlash.color='#aa2200'; _G.arenaFlash.alpha=0.55;
        _G.shakeFrames=28; _G.shakeAmt=20;
        _CAM.setFollow(ACX,ACY);
        setTimeout(()=>_CAM.impact(ACX,ACY,'#ff6600','GEHENNA!'),300);
      } break;

    // ══════════════════════════════════════
    // NORAGAMI
    // ══════════════════════════════════════
    case 'yato_sekki':
      { for(let i=0;i<8;i++){
          const a=i*Math.PI/4+Math.random()*0.2;
          const len=60+Math.random()*80;
          _FX.yatoCuts.push({x1:ball.x+Math.cos(a)*20,y1:ball.y+Math.sin(a)*20,x2:ball.x+Math.cos(a)*len,y2:ball.y+Math.sin(a)*len,life:25,max:25,ownerId:ball.id});
        }
        _G.balls.forEach(b=>{ if(!b.alive||!_isEnemy(ball,b)) return;
          const d=Math.hypot(b.x-ball.x,b.y-ball.y);
          if(d<120){ b.hit(); b.hit(); _addDmg(ball,35); _burst(b.x,b.y,'#4488ff',12); }
        });
        _burst(ball.x,ball.y,'#4488ff',24);
        _G.arenaFlash.color='#2244aa'; _G.arenaFlash.alpha=0.4;
        _G.shakeFrames=22; _G.shakeAmt=16;
        _CAM.setFollow(ball.x,ball.y,ball.id);
        setTimeout(()=>{ const bk=_G.balls.find(b=>b.id===ball.id); if(bk) _CAM.impact(bk.x,bk.y,'#4488ff','SEKKI!!',ball.id); },250);
      } break;

    case 'yukine_burst':
      { _FX.yukinePulse={x:ball.x,y:ball.y,r:0,maxR:180,life:30,max:30,ownerId:ball.id};
        _G.balls.forEach(b=>{ if(!b.alive||!_isEnemy(ball,b)) return;
          const d=Math.hypot(b.x-ball.x,b.y-ball.y);
          if(d<180){ b.hit(); const nx=(b.x-ball.x)/(d||1),ny=(b.y-ball.y)/(d||1); b.vx+=nx*14; b.vy+=ny*14; _addDmg(ball,25); }
        });
        _burst(ball.x,ball.y,'#ffee88',32); _burst(ball.x,ball.y,'#ffffff',16);
        _G.arenaFlash.color='#ffffcc'; _G.arenaFlash.alpha=0.55;
        _G.shakeFrames=22; _G.shakeAmt=16;
        _CAM.setFollow(ball.x,ball.y,ball.id);
        setTimeout(()=>{ const bk=_G.balls.find(b=>b.id===ball.id); if(bk) _CAM.impact(bk.x,bk.y,'#ffee88','REGALIA!',ball.id); },250);
      } break;

    case 'bishamon_array':
      { const enemies=_G.balls.filter(b=>b.alive&&_isEnemy(ball,b));
        enemies.forEach(t=>{
          for(let i=0;i<3;i++) _FX.bishArr.push({x:t.x+(Math.random()-0.5)*60,y:ACY-AR-20,vx:(Math.random()-0.5)*2,vy:16+Math.random()*6,life:30,max:30,ownerId:ball.id,targetId:t.id});
        });
        _burst(ACX,ACY-AR*0.6,'#ffaa00',24);
        _G.arenaFlash.color='#ffaa00'; _G.arenaFlash.alpha=0.45;
        _G.shakeFrames=20; _G.shakeAmt=15;
        _CAM.setFollow(ACX,ACY);
        setTimeout(()=>_CAM.impact(ACX,ACY,'#ffaa00','FIVE COMBINED!'),300);
      } break;

    case 'nora_bind':
      { const enemies=_G.balls.filter(b=>b.alive&&_isEnemy(ball,b));
        enemies.forEach(t=>{
          _FX.noraBeads.push({x:ball.x,y:ball.y,targetId:t.id,life:120,max:120,ownerId:ball.id,bound:false});
          t.freezeFrames=80; _addDmg(ball,15);
        });
        const target=enemies[0];
        _burst(ball.x,ball.y,'#cc2200',20);
        _G.arenaFlash.color='#880000'; _G.arenaFlash.alpha=0.35;
        if(target) _CAM.setFollow(target.x,target.y,target.id);
        else _CAM.setFollow(ball.x,ball.y,ball.id);
        setTimeout(()=>_CAM.impact(target?target.x:ball.x,target?target.y:ball.y,'#cc2200','BOUND!',target?target.id:ball.id),300);
      } break;

    case 'veena_storm':
      { for(let i=0;i<10;i++){
          const tx=ACX+(Math.random()-0.5)*AR*1.5, ty=ACY+(Math.random()-0.5)*AR*1.5;
          _FX.veenaLightning.push({x1:tx,y1:ACY-AR,x2:tx+(Math.random()-0.5)*30,y2:ty,life:12,max:12,ownerId:ball.id});
          _G.balls.forEach(b=>{ if(!b.alive||!_isEnemy(ball,b)) return;
            if(Math.hypot(b.x-tx,b.y-ty)<50){ b.hit(); _addDmg(ball,18); }
          });
        }
        _burst(ACX,ACY,'#ffdd44',30);
        _G.arenaFlash.color='#ffffaa'; _G.arenaFlash.alpha=0.6;
        _G.shakeFrames=30; _G.shakeAmt=22;
        _CAM.setFollow(ACX,ACY);
        setTimeout(()=>_CAM.impact(ACX,ACY,'#ffdd44','LIGHTNING!'),200);
      } break;

    // ══════════════════════════════════════
    // MUSHOKU TENSEI
    // ══════════════════════════════════════
    case 'quagmire':
      { _FX.quagmireZone={x:ball.x,y:ball.y,r:120,life:180,max:180,ownerId:ball.id,angle:0};
        _burst(ball.x,ball.y,'#8800cc',28);
        _G.arenaFlash.color='#440066'; _G.arenaFlash.alpha=0.5;
        _G.shakeFrames=22; _G.shakeAmt=16;
        _CAM.setFollow(ball.x,ball.y,ball.id);
        setTimeout(()=>{ const bk=_G.balls.find(b=>b.id===ball.id); if(bk) _CAM.impact(bk.x,bk.y,'#8800cc','QUAGMIRE!',ball.id); },300);
      } break;

    case 'north_god':
      { _FX.northGodDash={ownerId:ball.id,life:150,max:150};
        ball.rage=150;
        const s=Math.hypot(ball.vx,ball.vy)||ball.baseSpd;
        ball.vx=ball.vx/s*s*5; ball.vy=ball.vy/s*s*5;
        _burst(ball.x,ball.y,'#ccccff',22);
        _G.arenaFlash.color='#aaaaff'; _G.arenaFlash.alpha=0.35;
        _CAM.setFollow(ball.x,ball.y,ball.id);
        setTimeout(()=>{ const bk=_G.balls.find(b=>b.id===ball.id); if(bk) _CAM.impact(bk.x,bk.y,'#ccccff','NORTH GOD!',ball.id); },300);
      } break;

    case 'orsted_dragon':
      { _FX.orstedAura={ownerId:ball.id,r:100,life:200,max:200};
        _G.balls.forEach(b=>{ if(!b.alive||!_isEnemy(ball,b)) return;
          const d=Math.hypot(b.x-ball.x,b.y-ball.y);
          if(d<160){ b.hit(); b.hit(); b.vx+=(b.x-ball.x)/(d||1)*18; b.vy+=(b.y-ball.y)/(d||1)*18; _addDmg(ball,40); }
        });
        _burst(ball.x,ball.y,'#00ff88',32); _burst(ball.x,ball.y,'#004422',16);
        _G.arenaFlash.color='#004422'; _G.arenaFlash.alpha=0.5;
        _G.shakeFrames=35; _G.shakeAmt=25;
        _CAM.setFollow(ball.x,ball.y,ball.id);
        setTimeout(()=>{ const bk=_G.balls.find(b=>b.id===ball.id); if(bk) _CAM.impact(bk.x,bk.y,'#00ff88','DRAGON AURA!',ball.id); },250);
      } break;

    case 'roxy_water':
      { const _nearest_rw=_G.balls.filter(b=>b.alive&&_isEnemy(ball,b)).sort((a,b)=>Math.hypot(a.x-ball.x,a.y-ball.y)-Math.hypot(b.x-ball.x,b.y-ball.y))[0];
        const angle=_nearest_rw?Math.atan2(_nearest_rw.y-ball.y,_nearest_rw.x-ball.x):(ball.vx!==0||ball.vy!==0?Math.atan2(ball.vy,ball.vx):Math.random()*Math.PI*2);
        _FX.roxyBeam={x:ball.x,y:ball.y,angle,life:50,max:50,ownerId:ball.id};
        _G.balls.forEach(b=>{ if(!b.alive||!_isEnemy(ball,b)) return;
          const dx=b.x-ball.x,dy=b.y-ball.y;
          const proj=dx*Math.cos(angle)+dy*Math.sin(angle);
          const perp=Math.abs(-dx*Math.sin(angle)+dy*Math.cos(angle));
          if(perp<35&&proj>0&&proj<AR*2){ b.hit(); b.vx+=Math.cos(angle)*15; b.vy+=Math.sin(angle)*15; _addDmg(ball,28); _burst(b.x,b.y,'#0088ff',12); }
        });
        _burst(ball.x,ball.y,'#0088ff',20);
        _G.arenaFlash.color='#0044aa'; _G.arenaFlash.alpha=0.4;
        _G.shakeFrames=18; _G.shakeAmt=12;
        _CAM.setFollow(ball.x+Math.cos(angle)*AR*0.6,ball.y+Math.sin(angle)*AR*0.6);
        setTimeout(()=>_CAM.impact(ball.x+Math.cos(angle)*AR*0.5,ball.y+Math.sin(angle)*AR*0.5,'#0088ff','WATER CANNON!'),250);
      } break;

    case 'sylphie_wind':
      { _FX.sylphieStorm={x:ACX,y:ACY,r:AR*0.6,life:200,max:200,ownerId:ball.id,angle:0};
        _G.balls.forEach(b=>{ if(!b.alive||!_isEnemy(ball,b)) return;
          const dx=b.x-ACX,dy=b.y-ACY,d=Math.hypot(dx,dy)||1;
          b.vx+=(-dy/d)*14; b.vy+=(dx/d)*14; _addDmg(ball,15);
        });
        _burst(ACX,ACY,'#88ffaa',30);
        _G.arenaFlash.color='#44aa66'; _G.arenaFlash.alpha=0.4;
        _G.shakeFrames=22; _G.shakeAmt=16;
        _CAM.setFollow(ACX,ACY);
        setTimeout(()=>_CAM.impact(ACX,ACY,'#88ffaa','WIND STORM!'),300);
      } break;

    // ══════════════════════════════════════
    // DATE A LIVE
    // ══════════════════════════════════════
    case 'zafkiel':
      { const targets=_G.balls.filter(b=>b.alive&&_isEnemy(ball,b));
        if(targets.length){
          const t=targets[Math.floor(Math.random()*targets.length)];
          const angle=Math.atan2(t.y-ball.y,t.x-ball.x);
          const spd=14;
          _FX.zafkielBullet={x:ball.x,y:ball.y,vx:Math.cos(angle)*spd,vy:Math.sin(angle)*spd,life:90,max:90,ownerId:ball.id,targetId:t.id};
          _burst(ball.x,ball.y,'#cc0000',18);
          _G.arenaFlash.color='#880000'; _G.arenaFlash.alpha=0.4;
          _CAM.setFollow(ball.x,ball.y,ball.id);
          const tid=t.id;
          setTimeout(()=>{ const bt=_G.balls.find(b=>b.id===tid); if(bt) _CAM.impact(bt.x,bt.y,'#cc0000','ZAFKIEL!',tid); },400);
        }
      } break;

    case 'sandalphon':
      { _FX.sandalphonCrash={x:ACX,y:ACY,r:0,maxR:AR*0.85,life:40,max:40,ownerId:ball.id};
        _G.balls.forEach(b=>{ if(!b.alive||!_isEnemy(ball,b)) return;
          b.hit(); b.hit(); const dx=b.x-ACX,dy=b.y-ACY,d=Math.hypot(dx,dy)||1; b.vx+=dx/d*16; b.vy+=dy/d*16; _addDmg(ball,45);
        });
        _burst(ACX,ACY,'#ffcc00',40); _burst(ACX,ACY,'#ffffff',20);
        _G.arenaFlash.color='#ffee44'; _G.arenaFlash.alpha=0.8;
        _G.shakeFrames=45; _G.shakeAmt=35;
        _CAM.setFollow(ACX,ACY);
        setTimeout(()=>_CAM.impact(ACX,ACY,'#ffcc00','SANDALPHON!!'),200);
      } break;

    case 'origami_angel':
      { for(let i=0;i<20;i++){
          const a=Math.random()*Math.PI*2;
          const r=Math.random()*AR*0.9;
          _FX.origamiFeathers.push({x:ACX+Math.cos(a)*r,y:ACY-AR,vx:(Math.random()-0.5)*2,vy:8+Math.random()*8,life:35,max:35,ownerId:ball.id});
        }
        _burst(ACX,ACY-AR*0.5,'#ffffff',30); _burst(ACX,ACY-AR*0.5,'#ccddff',20);
        _G.arenaFlash.color='#ccddff'; _G.arenaFlash.alpha=0.5;
        _G.shakeFrames=25; _G.shakeAmt=18;
        _CAM.setFollow(ACX,ACY);
        setTimeout(()=>_CAM.impact(ACX,ACY,'#ffffff','METATRON!'),300);
      } break;

    case 'shido_seal':
      { _FX.shidoWave={x:ball.x,y:ball.y,r:0,maxR:220,life:35,max:35,ownerId:ball.id};
        _G.balls.forEach(b=>{ if(!b.alive||!_isEnemy(ball,b)) return;
          const dx=ball.x-b.x,dy=ball.y-b.y,d=Math.hypot(dx,dy)||1;
          b.vx+=dx/d*10; b.vy+=dy/d*10; _addDmg(ball,15);
        });
        _burst(ball.x,ball.y,'#ff88cc',28); _burst(ball.x,ball.y,'#ffffff',14);
        _G.arenaFlash.color='#ff88cc'; _G.arenaFlash.alpha=0.45;
        _G.shakeFrames=15; _G.shakeAmt=10;
        _CAM.setFollow(ball.x,ball.y,ball.id);
        setTimeout(()=>{ const bk=_G.balls.find(b=>b.id===ball.id); if(bk) _CAM.impact(bk.x,bk.y,'#ff88cc','SEALING KISS!',ball.id); },300);
      } break;

    case 'miku_gabriel':
      { _FX.mikusonic={ownerId:ball.id,life:200,max:200,r:0,angle:0};
        _G.balls.forEach(b=>{ if(!b.alive||!_isEnemy(ball,b)) return;
          const d=Math.hypot(b.x-ball.x,b.y-ball.y);
          if(d<AR){ b.hit(); const nx=(b.x-ball.x)/(d||1),ny=(b.y-ball.y)/(d||1); b.vx+=nx*12; b.vy+=ny*12; _addDmg(ball,20); }
        });
        _burst(ball.x,ball.y,'#cc44ff',28); _burst(ball.x,ball.y,'#ff88ff',14);
        _G.arenaFlash.color='#9922ff'; _G.arenaFlash.alpha=0.5;
        _G.shakeFrames=30; _G.shakeAmt=22;
        _CAM.setFollow(ball.x,ball.y,ball.id);
        setTimeout(()=>{ const bk=_G.balls.find(b=>b.id===ball.id); if(bk) _CAM.impact(bk.x,bk.y,'#cc44ff','GABRIEL!!',ball.id); },250);
      } break;

    case 'arena_chaos':
      // Chaos gravity — gravity direction rotates for 5 seconds
      ARENA.chaosFrames = 300; ARENA.chaosAngle = Math.random()*Math.PI*2;
      _burst(ACX, ACY, '#aa44ff', 28);
      _G.arenaFlash.color='#6600cc'; _G.arenaFlash.alpha=0.4;
      _G.shakeFrames=18; _G.shakeAmt=14;
      _CAM.setFollow(ACX, ACY);
      setTimeout(()=>_CAM.impact(ACX,ACY,'#aa44ff','CHAOS!'),250);
      break;
    case 'heal_pack':
      // Dungeon heal — restore player HP
      { const healAmt = C.DUNGEON.HEAL_AMOUNT;
        ball.hp = Math.min(ball.hp + healAmt, ball.max);
        _burst(ball.x, ball.y, '#22dd44', 24);
        _G.arenaFlash.color='#22dd44'; _G.arenaFlash.alpha=0.35;
        _CAM.setFollow(ball.x, ball.y, ball.id);
        setTimeout(()=>_CAM.impact(ball.x,ball.y,'#22dd44',`+${healAmt} HP`,ball.id),200);
      }
      break;
  }
}
// ✅ COMPLETO
