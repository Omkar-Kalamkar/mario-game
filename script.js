/* ============================================================
   MARIO-STYLE PLATFORMER
   Day 6: lives, checkpoints and respawn invulnerability.

   All levels are described by data in the LEVELS array below.
   loadLevel() destroys the old entities and builds the new ones,
   so the gameplay code (movement, collision, enemies, power-ups)
   works exactly the same way for every level.

   Dying (enemy side hit or pit) costs exactly one life and
   respawns the player at the active checkpoint with a short
   invulnerability. At zero lives the run ends with GAME OVER.

   Day 7: Level 3 ends in a boss arena. The boss has 5 health,
   telegraphed charge attacks, and seals the final goal behind a
   gate until it is defeated by stomping.
   ============================================================ */

/* ===== ELEMENT REFERENCES ===== */

var player = document.getElementById("player");
var game = document.getElementById("game");
var entities = document.getElementById("entities");
var scoreEl = document.getElementById("score");
var coinCountEl = document.getElementById("coinCount");
var coinTotalEl = document.getElementById("coinTotal");
var levelNumEl = document.getElementById("levelNum");
var livesNumEl = document.getElementById("livesNum");
var livesHeartsEl = document.getElementById("livesHearts");
var messageEl = document.getElementById("message");
var messageTextEl = document.getElementById("messageText");
var messageInfoEl = document.getElementById("messageInfo");
var messageBtnEl = document.getElementById("messageBtn");
var powerNameEl = document.getElementById("powerName");
var powerTimerBar = document.getElementById("powerTimerBar");
var goalEl = document.getElementById("goal");
var bannerEl = document.getElementById("levelBanner");
var bossHudEl = document.getElementById("bossHud");
var bossSegsEl = document.getElementById("bossSegs");

/* ===== CONSTANTS ===== */

var PLAYER_W = 35;
var PLAYER_H = 45;
var GAME_W = 900;
var GAME_H = 500;
var GRAVITY = 0.8;
var JUMP_POWER = 15;
var ENEMY_W = 35;
var ENEMY_H = 30;
var COIN_SIZE = 25;

/* Falling this far below the screen means the player dropped
   into one of the pits in the ground (levels 2 and 3). */
var PIT_FALL_Y = -70;

var ACCELERATION = 0.55;
var DECELERATION = 0.45;
var MAX_SPEED = 5;

/* ===== LIVES / CHECKPOINTS ===== */

var START_LIVES = 3;             /* lives at the start of a new game */
var RESPAWN_INVULN_MS = 1800;    /* protection time after a respawn */
var DEATH_PAUSE_MS = 850;        /* short pause before respawning */
var CHECKPOINT_W = 16;           /* half-width of the flag touch zone */
var CHECKPOINT_H = 85;           /* height of the flag touch zone */
var CHECKPOINT_BONUS = 25;       /* points for raising a flag */

/* ===== POWER-UPS ===== */

var POWERUP_SIZE = 30;
var SUPER_JUMP_POWER = 21;
var SPEED_BOOST_MAX = 8;
var SUPER_JUMP_DURATION = 8000;
var SPEED_BOOST_DURATION = 7000;

var activePower = null;   /* "superjump", "speedboost" or null */
var powerEndTime = 0;     /* timestamp when the effect expires */

function currentJumpPower() {
    if (activePower === "superjump") return SUPER_JUMP_POWER;
    return JUMP_POWER;
}

function currentMaxSpeed() {
    if (activePower === "speedboost") return SPEED_BOOST_MAX;
    return MAX_SPEED;
}

function collectPowerUp(pu) {
    pu.collected = true;
    pu.el.style.display = "none";
    score += 100;
    scoreEl.textContent = score;

    activePower = pu.type;
    powerEndTime = performance.now() +
        (pu.type === "superjump" ? SUPER_JUMP_DURATION : SPEED_BOOST_DURATION);

    player.classList.remove("power-superjump", "power-speedboost");
    player.classList.add(pu.type === "superjump" ? "power-superjump" : "power-speedboost");
}

function expirePowerUp() {
    activePower = null;
    powerEndTime = 0;
    player.classList.remove("power-superjump", "power-speedboost");
}

function updatePowerHud() {
    if (!activePower) {
        powerNameEl.textContent = "NO POWER-UP";
        powerNameEl.className = "";
        powerTimerBar.style.width = "0%";
        return;
    }
    var total = activePower === "superjump" ? SUPER_JUMP_DURATION : SPEED_BOOST_DURATION;
    var remaining = powerEndTime - performance.now();
    if (remaining < 0) remaining = 0;
    var secondsLeft = Math.ceil(remaining / 1000);

    powerNameEl.textContent =
        (activePower === "superjump" ? "SUPER JUMP" : "SPEED BOOST") + ": " + secondsLeft + "s";
    powerNameEl.className = activePower === "superjump"
        ? "power-label-superjump" : "power-label-speedboost";
    powerTimerBar.style.width = Math.ceil((remaining / total) * 100) + "%";
}

/* ===== LIVES DISPLAY ===== */

/* Redraws the lives number and the CSS heart icons in the HUD */
function renderLives() {
    livesNumEl.textContent = lives;
    var html = "";
    for (var i = 0; i < START_LIVES; i++) {
        html += '<span class="heart' + (i < lives ? "" : " empty") + '"></span>';
    }
    livesHeartsEl.innerHTML = html;
}

/* ===== PLAYER / GAME STATE ===== */

var playerX = 80;
var playerY = 55;
var prevY = 55;
var velocityY = 0;
var playerVX = 0;
var isOnGround = true;
var gameOver = false;
var gameWon = false;

/* score and totalCoinsRun last for the whole game (all levels),
   coinCount only counts the coins of the current level. */
var score = 0;
var coinCount = 0;
var totalCoinsRun = 0;

var keys = { left: false, right: false };

/* Current level bookkeeping */
var currentLevelIndex = 0;   /* index into LEVELS (0 = level 1) */
var currentGoalX = 850;      /* flag position of the current level */

/* Loop handling: only ever one animation frame scheduled at a time */
var rafId = null;
var levelStartTimer = null;

/* Lives / checkpoint state */
var lives = START_LIVES;      /* remaining lives in this run */
var isDying = false;          /* true during the death pause */
var invulnUntil = 0;          /* timestamp until respawn protection ends */
var currentCheckpoint = null; /* active respawn point {x, y} */
var checkpointsData = [];     /* per-level checkpoint flags */
var respawnTimer = null;      /* pending respawn timeout */

/* ===== ENEMY CONSTANTS ===== */

var STOMP_SCORE = 150;          /* points for jumping on an enemy */
var STOMP_BOUNCE_FACTOR = 0.6;  /* bounce strength after a stomp */
var DEFEAT_ANIM_MS = 450;       /* how long the squash animation lasts */

/* Chaser detection ranges (in pixels).
   It starts chasing inside ENTER range and only gives up outside
   EXIT range, so it does not flip between states at the edge. */
var CHASE_ENTER_X = 160;
var CHASE_EXIT_X = 210;
var CHASE_RANGE_Y = 70;

/* ===== BOSS CONSTANTS (Day 7, used only in Level 3) ===== */

var BOSS_W = 72;                  /* hitbox size, matches the CSS */
var BOSS_H = 64;
var BOSS_HIT_SCORE = 300;         /* points per successful stomp */
var BOSS_DEFEAT_BONUS = 1000;     /* extra points when it dies */
var BOSS_STOMP_BOUNCE = 13;       /* upward bounce after a stomp */
var BOSS_TELEGRAPH_MS = 450;      /* warning flash before a charge */
var BOSS_CHARGE_MS = 700;         /* how long a charge lasts */
var BOSS_ATTACK_COOLDOWN_MS = 2200; /* rest time between attacks */
var BOSS_HIT_FLASH_MS = 220;      /* white flash after taking damage */
var BOSS_STAGGER_MS = 380;        /* the boss stands still while hurt */

/* ============================================================
   LEVEL DEFINITIONS

   Every level is a plain object:
     theme      CSS class on #game that sets the atmosphere
     start      player spawn point {x, y}
     goalX      x position of the goal flag (stands on the ground)
     platforms  static rectangles {left, bottom, width, height}
                (ground segments first, then floating platforms)
     movers     moving platforms {left, bottom, width, height,
                minX, maxX, minY, maxY, speedX, speedY}
     coins      coin positions {x, y} (y = bottom of the coin)
     powerUps   {x, y, type} with type "superjump" or "speedboost"
      enemies    {type, x, y, dir, speed, minX, maxX} and optional
                 chaseSpeed for chasers; they patrol between
                 minX and maxX and never leave their platform
      checkpoints {x, y} respawn flags; touching one lights it up
                 and moves the respawn point to that spot

   Jump reach: about 140px high and 180px far, so every gap and
   step below was checked to stay inside those limits.
   ============================================================ */

var LEVELS = [

    /* ---- LEVEL 1: EASY ------------------------------------
       Wide safe ground, big platforms, slow patrols, plenty of
       easy coins. Introduces both power-ups. */
    {
        theme: "theme-1",
        start: { x: 60, y: 55 },
        goalX: 850,
        platforms: [
            { left: 0,   bottom: 0,   width: 900, height: 55 },
            { left: 180, bottom: 125, width: 140, height: 22 },
            { left: 420, bottom: 200, width: 140, height: 22 },
            { left: 660, bottom: 125, width: 140, height: 22 }
        ],
        movers: [
            /* Slow elevator on the left: carries you up to a bonus coin */
            { left: 40,  bottom: 80,  width: 110, height: 18,
              minX: 40, maxX: 40, minY: 80, maxY: 240, speedX: 0,   speedY: 1.2 },
            /* Low horizontal taxi under the middle platform */
            { left: 330, bottom: 120, width: 100, height: 18,
              minX: 300, maxX: 480, minY: 120, maxY: 120, speedX: 1.5, speedY: 0 }
        ],
        coins: [
            { x: 120, y: 62 },
            { x: 245, y: 152 },
            { x: 485, y: 227 },
            { x: 720, y: 152 },
            { x: 85,  y: 265 }
        ],
        powerUps: [
            { x: 760, y: 182, type: "superjump" },
            { x: 530, y: 235, type: "speedboost" }
        ],
        enemies: [
            { type: "patrol", x: 310, y: 55, dir: -1, speed: 1.5, minX: 250, maxX: 380 },
            { type: "patrol", x: 600, y: 55, dir: -1, speed: 1.8, minX: 550, maxX: 640 }
        ],
        checkpoints: [
            { x: 430, y: 55 }   /* after the first enemy zone */
        ]
    },

    /* ---- LEVEL 2: MEDIUM ----------------------------------
       The ground is broken into three islands with two deadly
       pits. More platforms, more enemies, a chaser guarding the
       goal and an elevator hiding a super jump power-up. */
    {
        theme: "theme-2",
        start: { x: 50, y: 55 },
        goalX: 855,
        platforms: [
            { left: 0,   bottom: 0,   width: 270, height: 55 },
            { left: 360, bottom: 0,   width: 220, height: 55 },
            { left: 660, bottom: 0,   width: 240, height: 55 },
            { left: 90,  bottom: 130, width: 120, height: 22 },
            { left: 300, bottom: 190, width: 110, height: 22 },
            { left: 450, bottom: 260, width: 110, height: 22 },
            { left: 620, bottom: 200, width: 120, height: 22 }
        ],
        movers: [
            /* High shuttle above the third platform (bonus route) */
            { left: 340, bottom: 300, width: 90,  height: 18,
              minX: 340, maxX: 520, minY: 300, maxY: 300, speedX: 1.8, speedY: 0 },
            /* Elevator on the right: secret ride up to a power-up */
            { left: 760, bottom: 90,  width: 100, height: 18,
              minX: 760, maxX: 760, minY: 90, maxY: 250, speedX: 0, speedY: 1.4 }
        ],
        coins: [
            { x: 150, y: 157 },
            { x: 335, y: 217 },
            { x: 490, y: 287 },
            { x: 665, y: 227 },
            { x: 305, y: 115 },   /* floats over the first pit */
            { x: 830, y: 62 }
        ],
        powerUps: [
            { x: 105, y: 168, type: "speedboost" },
            { x: 790, y: 290, type: "superjump" }
        ],
        enemies: [
            { type: "patrol", x: 230, y: 55,  dir: -1, speed: 2,   minX: 120, maxX: 250 },
            { type: "patrol", x: 400, y: 55,  dir: 1,  speed: 2.2, minX: 370, maxX: 560 },
            { type: "chaser", x: 860, y: 55,  dir: -1, speed: 1.8, chaseSpeed: 3.2,
              minX: 670, maxX: 860 },
            { type: "patrol", x: 690, y: 222, dir: -1, speed: 1.6, minX: 622, maxX: 703 }
        ],
        checkpoints: [
            { x: 362, y: 55 },   /* after the first pit */
            { x: 662, y: 55 }    /* after the second pit, before the chaser */
        ]
    },

    /* ---- LEVEL 3: HARD ------------------------------------
       Four small islands, long pits, stepping stones over the
       gaps and a ferry platform across the wide middle pit.
       The level ends in a BOSS ARENA: one wide floor with two
       perch platforms for safe stomping. The boss patrols the
       arena and an energy gate seals the goal flag until the
       boss is defeated.

       Boss config (only levels with a "boss" object get one):
         x, y          spawn spot (right side, away from the door)
         minX / maxX   patrol limits; maxX is the boss's right EDGE,
                       so it can never touch the gate or the goal
         speed         patrol speed
         chaseSpeed    speed while walking toward the player
         health        stomps needed to win (5)
         aggroEnterX / aggroExitX  start/stop following the player
         attackTriggerX  distance at which a charge attack begins
         chargeSpeed   speed of the charge dash
         gateX         x position of the goal-sealing energy gate
         arenaEnterX   player x that triggers "DEFEAT THE BOSS!" */
    {
        theme: "theme-3",
        start: { x: 50, y: 55 },
        goalX: 855,
        platforms: [
            { left: 0,   bottom: 0,   width: 200, height: 55 },
            { left: 340, bottom: 0,   width: 160, height: 55 },
            /* Boss arena: one continuous floor, no pits to fall in */
            { left: 640, bottom: 0,   width: 260, height: 55 },
            { left: 225, bottom: 130, width: 60,  height: 18 },
            { left: 360, bottom: 140, width: 90,  height: 20 },
            { left: 470, bottom: 210, width: 80,  height: 20 },
            { left: 380, bottom: 280, width: 90,  height: 20 },
            { left: 560, bottom: 250, width: 80,  height: 20 },
            /* Arena perches: hop on these to stomp the boss safely.
               Both are reachable from the floor (~93px and ~133px). */
            { left: 655, bottom: 130, width: 105, height: 18 },
            { left: 800, bottom: 170, width: 80,  height: 18 }
        ],
        movers: [
            /* Lift over the first pit (alternative to the stone) */
            { left: 250, bottom: 60,  width: 90,  height: 18,
              minX: 250, maxX: 250, minY: 60, maxY: 200, speedX: 0, speedY: 1.6 },
            /* Ferry across the wide middle pit - time your jump! */
            { left: 480, bottom: 120, width: 100, height: 18,
              minX: 480, maxX: 560, minY: 120, maxY: 120, speedX: 1.6, speedY: 0 }
        ],
        coins: [
            { x: 245, y: 153 },
            { x: 395, y: 165 },
            { x: 500, y: 235 },
            { x: 410, y: 305 },
            { x: 585, y: 275 },
            { x: 700, y: 156 },   /* on the first arena perch */
            { x: 808, y: 196 },   /* on the high arena perch */
            { x: 760, y: 62 }     /* low over the arena floor */
        ],
        powerUps: [
            { x: 410, y: 336, type: "superjump" },
            { x: 662, y: 158, type: "speedboost" }
        ],
        enemies: [
            { type: "patrol", x: 180, y: 55,  dir: -1, speed: 2.4, minX: 115, maxX: 192 },
            { type: "chaser", x: 470, y: 55,  dir: -1, speed: 1.8, chaseSpeed: 3.4,
              minX: 345, maxX: 462 },
            { type: "patrol", x: 530, y: 230, dir: -1, speed: 1.8, minX: 472, maxX: 512 },
            { type: "patrol", x: 650, y: 55,  dir: -1, speed: 2.2, minX: 644, maxX: 700 }
        ],
        checkpoints: [
            { x: 350, y: 55 },    /* after the long first pit */
            { x: 700, y: 148 }    /* on the first arena perch, above the boss */
        ],
        boss: {
            x: 762, y: 55,
            minX: 706, maxX: 830,      /* maxX = right edge, before the gate */
            speed: 1.3, chaseSpeed: 2.6,
            health: 5,
            aggroEnterX: 190, aggroExitX: 260,
            attackTriggerX: 170,
            chargeSpeed: 5.4,
            gateX: 836,
            arenaEnterX: 600
        }
    }
];

/* ===== LEVEL ENTITY STATE (rebuilt for every level) ===== */

var staticPlatforms = [];
var movingPlatforms = [];
var platforms = [];          /* static + moving, used by collisions */
var coinsData = [];
var powerUpsData = [];
var enemiesData = [];
var onMovingPlatform = null;

/* Day 7: boss state (null in levels without a boss) and a flag so
   the "DEFEAT THE BOSS!" banner + health bar only appear once */
var bossData = null;
var bossEncounterStarted = false;

/* Small helper: create a positioned div for one entity */
function makeEntity(className, x, y, w, h) {
    var el = document.createElement("div");
    el.className = className;
    el.style.left = x + "px";
    el.style.bottom = y + "px";
    if (w !== undefined) el.style.width = w + "px";
    if (h !== undefined) el.style.height = h + "px";
    entities.appendChild(el);
    return el;
}

/* Build all DOM elements and data objects for one level */
function buildLevel(def) {
    staticPlatforms = [];
    movingPlatforms = [];
    coinsData = [];
    powerUpsData = [];
    enemiesData = [];
    checkpointsData = [];

    /* Static platforms and ground segments */
    for (var i = 0; i < def.platforms.length; i++) {
        var pd = def.platforms[i];
        makeEntity("platform", pd.left, pd.bottom, pd.width, pd.height);
        staticPlatforms.push({
            left: pd.left, bottom: pd.bottom,
            width: pd.width, height: pd.height
        });
    }

    /* Moving platforms */
    for (i = 0; i < def.movers.length; i++) {
        var md = def.movers[i];
        var mel = makeEntity("moving-platform", md.left, md.bottom, md.width, md.height);
        movingPlatforms.push({
            left: md.left, bottom: md.bottom,
            width: md.width, height: md.height,
            initLeft: md.left, initBottom: md.bottom,
            minX: md.minX, maxX: md.maxX, minY: md.minY, maxY: md.maxY,
            speedX: md.speedX, speedY: md.speedY,
            dirX: 1, dirY: 1, dx: 0, dy: 0, moving: true,
            el: mel
        });
    }

    platforms = staticPlatforms.concat(movingPlatforms);

    /* Coins */
    for (i = 0; i < def.coins.length; i++) {
        var cd = def.coins[i];
        var cel = makeEntity("coin", cd.x, cd.y);
        coinsData.push({ x: cd.x, y: cd.y, collected: false, el: cel });
    }

    /* Power-ups */
    for (i = 0; i < def.powerUps.length; i++) {
        var pud = def.powerUps[i];
        var puClass = pud.type === "superjump" ? "super-jump" : "speed-boost";
        var puel = makeEntity("powerup " + puClass, pud.x, pud.y);
        powerUpsData.push({
            x: pud.x, y: pud.y, type: pud.type,
            collected: false, el: puel
        });
    }

    /* Enemies (with their runtime values filled in) */
    for (i = 0; i < def.enemies.length; i++) {
        var ed = def.enemies[i];
        var eel = makeEntity("enemy " + ed.type, ed.x, ed.y);
        enemiesData.push({
            type: ed.type,
            x: ed.x, y: ed.y,
            dir: ed.dir, speed: ed.speed,
            minX: ed.minX, maxX: ed.maxX,
            chaseSpeed: ed.chaseSpeed || 0,
            alive: true, chasing: false, defeatedAt: 0,
            startX: ed.x, startDir: ed.dir, faceLeft: ed.dir < 0,
            el: eel
        });
    }

    /* Checkpoints (flag poles the player can raise) */
    for (i = 0; i < def.checkpoints.length; i++) {
        var ckd = def.checkpoints[i];
        var ckel = makeEntity("checkpoint", ckd.x, ckd.y);
        checkpointsData.push({ x: ckd.x, y: ckd.y, active: false, el: ckel });
    }

    /* Day 7: only levels with a "boss" entry get a boss and a gate */
    if (def.boss) {
        initBoss(def.boss);
    }
}

/* Raise a checkpoint flag: it becomes the new respawn point */
function activateCheckpoint(ck) {
    ck.active = true;
    ck.el.classList.add("active", "just-hit");
    currentCheckpoint = ck;

    /* Only the newest flag is the current respawn point */
    for (var j = 0; j < checkpointsData.length; j++) {
        checkpointsData[j].el.classList.toggle(
            "current", checkpointsData[j] === ck);
    }

    score += CHECKPOINT_BONUS;
    scoreEl.textContent = score;
}

/* One enemy AI step: patrol boundaries, chase logic for chasers */
function updateEnemies() {
    for (var i = 0; i < enemiesData.length; i++) {
        var e = enemiesData[i];

        /* Defeated enemies just wait until their animation is over */
        if (!e.alive) {
            if (e.defeatedAt !== 0 &&
                performance.now() - e.defeatedAt > DEFEAT_ANIM_MS) {
                e.el.style.display = "none";
                e.defeatedAt = 0;
            }
            continue;
        }

        var moveDir = e.dir;
        var moveSpeed = e.speed;

        if (e.type === "chaser") {
            var playerCx = playerX + PLAYER_W / 2;
            var enemyCx = e.x + ENEMY_W / 2;
            var distX = Math.abs(playerCx - enemyCx);
            var distY = Math.abs((playerY + PLAYER_H / 2) - (e.y + ENEMY_H / 2));

            if (!e.chasing && distX <= CHASE_ENTER_X && distY <= CHASE_RANGE_Y) {
                e.chasing = true;
            } else if (e.chasing &&
                       (distX > CHASE_EXIT_X || distY > CHASE_RANGE_Y)) {
                e.chasing = false;   /* player escaped: back to patrolling */
            }

            if (e.chasing) {
                moveDir = playerCx < enemyCx ? -1 : 1;
                moveSpeed = e.chaseSpeed;
            }
        }

        e.x += moveDir * moveSpeed;

        /* Turn around at the edges of the enemy's own area */
        if (e.x <= e.minX) { e.x = e.minX; moveDir = 1; }
        if (e.x >= e.maxX) { e.x = e.maxX; moveDir = -1; }

        if (!e.chasing) e.dir = moveDir;
        e.faceLeft = moveDir < 0;
    }
}

/* Player jumped on an enemy: squash it, award points, bounce up */
function defeatEnemy(e) {
    e.alive = false;          /* also blocks any second stomp on this enemy */
    e.chasing = false;
    e.defeatedAt = performance.now();
    e.el.classList.add("defeated");

    score += STOMP_SCORE;
    scoreEl.textContent = score;

    velocityY = currentJumpPower() * STOMP_BOUNCE_FACTOR;
    isOnGround = false;
    onMovingPlatform = null;
}

/* ============================================================
   DAY 7: BOSS BATTLE (Level 3 only)

   The boss has five states, all visible through CSS classes so
   the player can read and dodge it:
     patrol    walks back and forth inside the arena
     chase     walks toward the player when they are nearby
     telegraph stops and flashes for a moment (attack warning)
     charge    short fast dash in the stored direction
     recover   tired pause after charging (= attack cooldown)

   Stomping it costs it 1 health; side contact kills the player
   through the normal lives system. At 0 health it dies, the
   energy gate in front of the goal shatters, and the level can
   be finished.
   ============================================================ */

/* Create the boss DOM element, its data object and the health bar */
function initBoss(bc) {
    bossData = {
        x: bc.x, y: bc.y,
        startX: bc.x, startDir: -1,
        dir: -1, faceLeft: true,
        minX: bc.minX, maxX: bc.maxX,
        speed: bc.speed, chaseSpeed: bc.chaseSpeed,
        health: bc.health, maxHealth: bc.health,
        aggroEnterX: bc.aggroEnterX, aggroExitX: bc.aggroExitX,
        attackTriggerX: bc.attackTriggerX,
        chargeSpeed: bc.chargeSpeed, chargeDir: -1,
        state: "patrol",
        nextAttackOk: 0, telegraphEnd: 0, chargeEnd: 0,
        staggerUntil: 0, hitFlashUntil: 0,
        gateX: bc.gateX, arenaEnterX: bc.arenaEnterX,
        alive: true,
        el: makeEntity("boss", bc.x, bc.y, BOSS_W, BOSS_H)
    };

    /* Energy gate that seals the goal while the boss is alive.
       It stands on the arena floor (top of the ground = 55px). */
    bossData.gateEl = makeEntity("boss-gate", bc.gateX, 55);

    /* Build the segmented health bar (one segment per hit point) */
    bossSegsEl.innerHTML = "";
    for (var i = 0; i < bc.health; i++) {
        var seg = document.createElement("span");
        seg.className = "boss-seg";
        bossSegsEl.appendChild(seg);
    }
}

/* Reflect remaining health as lit/unlit bar segments */
function updateBossHud() {
    if (!bossData) return;
    var segs = bossSegsEl.children;
    for (var i = 0; i < segs.length; i++) {
        segs[i].classList.toggle("lost", i >= bossData.health);
    }
}

/* Begin an attack: flash first (fair warning), then dash */
function startBossTelegraph(b, dx) {
    b.state = "telegraph";
    b.telegraphEnd = performance.now() + BOSS_TELEGRAPH_MS;
    b.chargeDir = dx < 0 ? -1 : 1;   /* dash toward where the player was */
    /* cooldown covers telegraph + charge + rest, so attacks come
       at a steady, learnable rhythm */
    b.nextAttackOk = b.telegraphEnd + BOSS_CHARGE_MS + BOSS_ATTACK_COOLDOWN_MS;
}

/* One AI step per frame. Timestamp-based, no setTimeout needed. */
function updateBoss() {
    if (!bossData || !bossData.alive) return;

    var b = bossData;
    var now = performance.now();

    /* While staggered from a stomp the boss stands still */
    if (now < b.staggerUntil) return;

    var bossCx = b.x + BOSS_W / 2;
    var playerCx = playerX + PLAYER_W / 2;
    var dx = playerCx - bossCx;          /* signed distance to the player */
    var distX = Math.abs(dx);

    switch (b.state) {

        case "patrol":
            b.x += b.dir * b.speed;
            if (b.x <= b.minX) { b.x = b.minX; b.dir = 1; }
            if (b.x + BOSS_W >= b.maxX) { b.x = b.maxX - BOSS_W; b.dir = -1; }
            if (distX <= b.aggroEnterX) {
                b.state = "chase";
            } else if (distX <= b.attackTriggerX && now >= b.nextAttackOk) {
                startBossTelegraph(b, dx);
            }
            break;

        case "chase":
            b.dir = dx < 0 ? -1 : 1;
            b.x += b.dir * b.chaseSpeed;
            if (b.x <= b.minX) { b.x = b.minX; }
            if (b.x + BOSS_W >= b.maxX) { b.x = b.maxX - BOSS_W; }
            if (distX > b.aggroExitX) {
                b.state = "patrol";      /* player escaped */
            } else if (distX <= b.attackTriggerX && now >= b.nextAttackOk) {
                startBossTelegraph(b, dx);
            }
            break;

        case "telegraph":
            if (now >= b.telegraphEnd) {
                b.state = "charge";
                b.chargeEnd = now + BOSS_CHARGE_MS;
            }
            break;

        case "charge":
            b.x += b.chargeDir * b.chargeSpeed;
            /* Hitting a wall ends the charge early */
            if (b.x <= b.minX) { b.x = b.minX; b.state = "recover"; }
            if (b.x + BOSS_W >= b.maxX) { b.x = b.maxX - BOSS_W; b.state = "recover"; }
            if (b.state === "charge" && now >= b.chargeEnd) {
                b.state = "recover";
            }
            break;

        case "recover":
            /* Tired pause; once the cooldown is over it chases again */
            if (now >= b.nextAttackOk) b.state = "chase";
            break;
    }

    b.faceLeft = (b.state === "charge") ? b.chargeDir < 0 : b.dir < 0;
}

/* Player stomped the boss: damage, points, bounce and hit effect */
function hitBoss(b) {
    b.health--;
    updateBossHud();

    score += BOSS_HIT_SCORE;
    scoreEl.textContent = score;

    /* Strong bounce so the player clears the boss after a hit */
    velocityY = BOSS_STOMP_BOUNCE;
    isOnGround = false;
    onMovingPlatform = null;

    var now = performance.now();
    b.hitFlashUntil = now + BOSS_HIT_FLASH_MS;
    b.staggerUntil = now + BOSS_STAGGER_MS;
    b.state = "patrol";
    /* A successful stomp also buys the player attack-free time */
    b.nextAttackOk = now + BOSS_ATTACK_COOLDOWN_MS;

    spawnBossHitFx(b.x + BOSS_W / 2, b.y + BOSS_H - 6, "+" + BOSS_HIT_SCORE);

    if (b.health <= 0) {
        defeatBoss(b);
    }
}

/* Boss reached 0 health: disable it, open the gate, celebrate */
function defeatBoss(b) {
    b.alive = false;
    b.health = 0;
    updateBossHud();

    score += BOSS_DEFEAT_BONUS;
    scoreEl.textContent = score;

    b.el.classList.remove("telegraph", "charging", "hit-flash");
    b.el.classList.add("defeated");
    if (b.gateEl) b.gateEl.classList.add("destroyed");

    bossHudEl.classList.add("boss-defeated");
    showBanner("BOSS DEFEATED!");
    spawnBossHitFx(b.x + BOSS_W / 2, b.y + BOSS_H, "+" + BOSS_DEFEAT_BONUS);
}

/* Small one-shot visual effects for boss hits. Everything removes
   itself via animationend, so no timers have to be tracked. */
function spawnBossHitFx(cx, bottomY, text) {
    var burst = document.createElement("div");
    burst.className = "spark-burst";
    burst.style.left = cx + "px";
    burst.style.bottom = bottomY + "px";

    for (var s = 0; s < 7; s++) {
        var sp = document.createElement("div");
        sp.className = "spark";
        var ang = (Math.PI * 2 * s) / 7 + Math.random() * 0.6;
        var dist = 26 + Math.random() * 22;
        sp.style.setProperty("--sx", Math.round(Math.cos(ang) * dist) + "px");
        sp.style.setProperty("--sy", Math.round(Math.sin(ang) * dist) + "px");
        burst.appendChild(sp);
    }
    burst.addEventListener("animationend", function() {
        if (burst.parentNode) burst.parentNode.removeChild(burst);
    });
    entities.appendChild(burst);

    var pop = document.createElement("div");
    pop.className = "score-pop";
    pop.textContent = text;
    pop.style.left = (cx - 24) + "px";
    pop.style.bottom = (bottomY + 12) + "px";
    pop.addEventListener("animationend", function() {
        if (pop.parentNode) pop.parentNode.removeChild(pop);
    });
    entities.appendChild(pop);
}

/* ===== INPUT ===== */
/* These listeners are registered exactly once for the whole game.
   Changing levels never adds new ones. */

document.addEventListener("keydown", function(e) {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight" ||
        e.key === "ArrowUp" || e.key === " ") {
        e.preventDefault();
    }
    if (e.key === "ArrowLeft") keys.left = true;
    if (e.key === "ArrowRight") keys.right = true;
    if (e.key === "ArrowUp" || e.key === " ") doJump();
});

document.addEventListener("keyup", function(e) {
    if (e.key === "ArrowLeft") keys.left = false;
    if (e.key === "ArrowRight") keys.right = false;
    if ((e.key === "ArrowUp" || e.key === " ") && velocityY > 5) {
        velocityY = 5;
    }
});

/* ===== JUMP ===== */

function doJump() {
    if (isOnGround && !gameOver && !gameWon && !isDying) {
        velocityY = currentJumpPower();
        isOnGround = false;
        onMovingPlatform = null;
    }
}

/* ===== LEVEL LOADING / TRANSITIONS ===== */

/* Short "LEVEL X" splash at the start of every level */
function showBanner(text) {
    bannerEl.textContent = text;
    bannerEl.classList.remove("show");
    void bannerEl.offsetWidth;   /* forces a reflow so the animation restarts */
    bannerEl.classList.add("show");
}

/* Shows the overlay. btnAction is stored as onclick (a property),
   so clicking the button can never stack duplicate listeners. */
function showMessage(text, infoText, btnLabel, btnAction, btnClass) {
    messageTextEl.textContent = text;
    if (infoText) {
        messageInfoEl.textContent = infoText;
        messageInfoEl.style.display = "block";
    } else {
        messageInfoEl.style.display = "none";
    }
    messageBtnEl.textContent = btnLabel;
    messageBtnEl.className = btnClass ? btnClass : "";
    messageBtnEl.onclick = btnAction;
    messageEl.style.display = "flex";
}

/* Load a level by index: clear everything, rebuild it, reset state */
function loadLevel(index) {
    currentLevelIndex = index;
    var def = LEVELS[index];

    /* Stop anything still running from the previous level */
    if (levelStartTimer !== null) {
        clearTimeout(levelStartTimer);
        levelStartTimer = null;
    }
    if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
    }
    if (respawnTimer !== null) {
        clearTimeout(respawnTimer);
        respawnTimer = null;
    }

    /* Day 7: tear down the previous boss and hide its health bar.
       Levels without a "boss" entry simply stay bar-less. */
    bossData = null;
    bossEncounterStarted = false;
    bossHudEl.classList.add("hidden");
    bossHudEl.classList.remove("boss-defeated");

    /* Remove all old entities (platforms, coins, enemies, ...) */
    entities.innerHTML = "";

    /* Build the new level */
    buildLevel(def);

    /* Visual atmosphere for this level */
    game.classList.remove("theme-1", "theme-2", "theme-3");
    game.classList.add(def.theme);

    /* Move the goal flag */
    currentGoalX = def.goalX;
    goalEl.style.left = def.goalX + "px";

    /* Reset the player */
    playerX = def.start.x;
    playerY = def.start.y;
    prevY = playerY;
    velocityY = 0;
    playerVX = 0;
    isOnGround = true;
    keys.left = false;
    keys.right = false;
    onMovingPlatform = null;
    gameOver = false;
    gameWon = false;
    isDying = false;
    invulnUntil = 0;

    /* The level's start position is the first respawn point */
    currentCheckpoint = { x: def.start.x, y: def.start.y };

    player.style.left = playerX + "px";
    player.style.bottom = playerY + "px";
    player.style.transform = "";
    player.classList.remove("airborne", "power-superjump",
                            "power-speedboost", "invulnerable", "dying");

    /* Reset power-up state and timers */
    activePower = null;
    powerEndTime = 0;
    updatePowerHud();

    /* Coins are per-level: reset the counter, show the new total */
    coinCount = 0;
    coinCountEl.textContent = "0";
    coinTotalEl.textContent = def.coins.length;
    levelNumEl.textContent = index + 1;
    scoreEl.textContent = score;   /* score carries over between levels */

    /* Hide overlays and show the level banner */
    messageEl.style.display = "none";
    showBanner("LEVEL " + (index + 1));

    /* Give the banner a moment before the action starts */
    levelStartTimer = setTimeout(function() {
        levelStartTimer = null;
        startLoop();
    }, 1000);
}

/* Reached the flag: either advance or win the whole game */
function completeLevel() {
    /* Safety net (the gate already blocks the way): while the
       boss is alive the final goal stays locked */
    if (bossData && bossData.alive) return;

    gameWon = true;

    if (currentLevelIndex === LEVELS.length - 1) {
        showMessage(
            "YOU WIN!",
            "Final score: " + score + "  |  Coins collected: " + totalCoinsRun,
            "Restart Game",
            restartGame
        );
    } else {
        showMessage(
            "LEVEL " + (currentLevelIndex + 1) + " COMPLETE!",
            "Score so far: " + score,
            "Next Level",
            function() { loadLevel(currentLevelIndex + 1); },
            "green"
        );
    }
}

/* Touched an enemy sideways or fell into a pit: lose exactly one
   life. With lives left, pause briefly and respawn at the active
   checkpoint; at zero lives the run ends with GAME OVER. */
function killPlayer() {
    if (isDying || gameOver || gameWon) return;   /* one life per death */

    isDying = true;
    lives--;
    renderLives();

    /* Temporary power-ups wear off and movement stops */
    expirePowerUp();
    keys.left = false;
    keys.right = false;
    velocityY = 0;
    playerVX = 0;
    onMovingPlatform = null;

    /* Freeze the loop and play the little death hop */
    if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
    }
    player.classList.remove("airborne", "invulnerable");
    player.classList.add("dying");

    if (lives <= 0) {
        gameOver = true;
        isDying = false;
        showMessage(
            "GAME OVER",
            "Final score: " + score + "  |  Coins collected: " + totalCoinsRun,
            "Restart Game",
            restartGame
        );
        return;
    }

    /* Brief pause, then back to the checkpoint */
    respawnTimer = setTimeout(function() {
        respawnTimer = null;
        respawnPlayer();
    }, DEATH_PAUSE_MS);
}

/* Bring the player back at the active checkpoint (or the level's
   start if none was reached) and grant a short invulnerability.
   Level, score and collected coins are preserved. */
function respawnPlayer() {
    isDying = false;

    var cp = currentCheckpoint || LEVELS[currentLevelIndex].start;
    playerX = cp.x;
    playerY = cp.y + 2;      /* tiny drop so the player lands cleanly */
    prevY = playerY;
    velocityY = 0;
    playerVX = 0;
    isOnGround = false;
    onMovingPlatform = null;
    keys.left = false;
    keys.right = false;

    /* Send surviving enemies back home so nothing can occupy the
       spawn point; defeated enemies stay defeated */
    for (var i = 0; i < enemiesData.length; i++) {
        var en = enemiesData[i];
        if (!en.alive) continue;
        en.x = en.startX;
        en.dir = en.startDir;
        en.faceLeft = en.startDir < 0;
        en.chasing = false;
        en.el.style.left = en.x + "px";
        en.el.classList.remove("chasing");
    }

    /* Day 7: send a living boss back to its spawn spot too, but
       keep its current health - the fight resumes where it was */
    if (bossData && bossData.alive) {
        var bd = bossData;
        bd.x = bd.startX;
        bd.dir = bd.startDir;
        bd.faceLeft = bd.startDir < 0;
        bd.state = "patrol";
        bd.staggerUntil = 0;
        bd.hitFlashUntil = 0;
        bd.nextAttackOk = 0;
    }

    /* Protected for a moment: blinking player, deadly contact off */
    invulnUntil = performance.now() + RESPAWN_INVULN_MS;
    player.classList.remove("dying");
    player.classList.add("invulnerable");

    player.style.left = playerX + "px";
    player.style.bottom = playerY + "px";
    player.style.transform = "";

    showBanner("LIVES LEFT: " + lives);
    startLoop();
}

/* Complete reset: fresh score, full lives, all checkpoints inactive */
function restartGame() {
    score = 0;
    totalCoinsRun = 0;
    lives = START_LIVES;
    isDying = false;
    invulnUntil = 0;
    if (respawnTimer !== null) {
        clearTimeout(respawnTimer);
        respawnTimer = null;
    }
    renderLives();
    loadLevel(0);
}

/* ===== GAME LOOP ===== */

function startLoop() {
    if (rafId !== null) cancelAnimationFrame(rafId);   /* never two loops */
    rafId = requestAnimationFrame(gameLoop);
}

function gameLoop() {
    if (gameOver || gameWon) { rafId = null; return; }

    /* Update moving platforms */
    for (var i = 0; i < movingPlatforms.length; i++) {
        var mp = movingPlatforms[i];
        var oldLeft = mp.left;
        var oldBottom = mp.bottom;

        mp.left += mp.speedX * mp.dirX;
        mp.bottom += mp.speedY * mp.dirY;

        if (mp.left <= mp.minX) { mp.left = mp.minX; mp.dirX = 1; }
        if (mp.left >= mp.maxX) { mp.left = mp.maxX; mp.dirX = -1; }
        if (mp.bottom <= mp.minY) { mp.bottom = mp.minY; mp.dirY = 1; }
        if (mp.bottom >= mp.maxY) { mp.bottom = mp.maxY; mp.dirY = -1; }

        mp.dx = mp.left - oldLeft;
        mp.dy = mp.bottom - oldBottom;
    }

    /* If standing on a moving platform, ride it */
    if (onMovingPlatform) {
        playerX += onMovingPlatform.dx;
        playerY += onMovingPlatform.dy;
        if (playerX < 0) playerX = 0;
        if (playerX > GAME_W - PLAYER_W) playerX = GAME_W - PLAYER_W;
        if (playerY < 0) playerY = 0;
    }

    /* Horizontal movement with acceleration and deceleration */
    if (keys.left) {
        playerVX -= ACCELERATION;
        if (playerVX < -currentMaxSpeed()) playerVX = -currentMaxSpeed();
    }
    if (keys.right) {
        playerVX += ACCELERATION;
        if (playerVX > currentMaxSpeed()) playerVX = currentMaxSpeed();
    }
    if (!keys.left && !keys.right) {
        if (Math.abs(playerVX) < DECELERATION) {
            playerVX = 0;
        } else {
            playerVX -= Math.sign(playerVX) * DECELERATION;
        }
    }

    playerX += playerVX;
    if (playerX < 0) { playerX = 0; playerVX = 0; }
    if (playerX > GAME_W - PLAYER_W) { playerX = GAME_W - PLAYER_W; playerVX = 0; }

    /* Day 7: while the boss lives, the energy gate seals the final
       goal - the player simply cannot walk past it */
    if (bossData && bossData.alive && playerX + PLAYER_W > bossData.gateX) {
        playerX = bossData.gateX - PLAYER_W;
        if (playerVX > 0) playerVX = 0;
    }

    /* Physics */
    prevY = playerY;
    velocityY -= GRAVITY;
    playerY += velocityY;

    /* Platform collisions (one-way, from above only) */
    isOnGround = false;
    onMovingPlatform = null;

    if (velocityY <= 0) {
        var bestTop = -1;
        for (i = 0; i < platforms.length; i++) {
            var p = platforms[i];
            var platTop = p.bottom + p.height;
            if (playerX + PLAYER_W > p.left && playerX < p.left + p.width) {
                if (prevY >= platTop - 1 && playerY < platTop) {
                    if (platTop > bestTop) {
                        bestTop = platTop;
                        if (p.moving) {
                            onMovingPlatform = p;
                        }
                    }
                }
            }
        }
        if (bestTop >= 0) {
            playerY = bestTop;
            velocityY = 0;
            isOnGround = true;
        }
    }

    /* Fell into a pit (levels 2 and 3 have gaps in the ground):
       costs one life, respawn follows the normal lives system */
    if (playerY < PIT_FALL_Y) {
        killPlayer();
        return;
    }

    /* Enemy AI */
    updateEnemies();

    /* Day 7: boss AI */
    updateBoss();

    /* Coin collection */
    for (i = 0; i < coinsData.length; i++) {
        var c = coinsData[i];
        if (c.collected) continue;
        if (playerX + PLAYER_W > c.x && playerX < c.x + COIN_SIZE &&
            playerY + PLAYER_H > c.y && playerY < c.y + COIN_SIZE) {
            c.collected = true;
            c.el.style.display = "none";
            score += 50;
            coinCount++;
            totalCoinsRun++;
            scoreEl.textContent = score;
            coinCountEl.textContent = coinCount;
        }
    }

    /* Power-up collection */
    for (i = 0; i < powerUpsData.length; i++) {
        var pu = powerUpsData[i];
        if (pu.collected) continue;
        if (playerX + PLAYER_W > pu.x && playerX < pu.x + POWERUP_SIZE &&
            playerY + PLAYER_H > pu.y && playerY < pu.y + POWERUP_SIZE) {
            collectPowerUp(pu);
        }
    }

    /* Checkpoint flags: walking into one raises it and moves the
       respawn point there */
    for (i = 0; i < checkpointsData.length; i++) {
        var ck = checkpointsData[i];
        if (ck.active) continue;
        if (playerX + PLAYER_W > ck.x - CHECKPOINT_W &&
            playerX < ck.x + CHECKPOINT_W &&
            playerY + PLAYER_H > ck.y &&
            playerY < ck.y + CHECKPOINT_H) {
            activateCheckpoint(ck);
        }
    }

    /* Day 7: entering the boss arena starts the encounter - show
       the health bar and warn the player once */
    if (bossData && bossData.alive && !bossEncounterStarted &&
        playerX + PLAYER_W >= bossData.arenaEnterX) {
        bossEncounterStarted = true;
        bossHudEl.classList.remove("hidden");
        showBanner("DEFEAT THE BOSS!");
    }

    /* Power-up timer expiry (checked every frame, no setTimeout) */
    if (activePower && performance.now() >= powerEndTime) {
        expirePowerUp();
    }
    updatePowerHud();

    /* Post-respawn invulnerability: blink while it lasts */
    var invulnerable = performance.now() < invulnUntil;
    player.classList.toggle("invulnerable", invulnerable);

    /* Enemy collisions (stomp from above vs. side hit) */
    for (i = 0; i < enemiesData.length; i++) {
        var e = enemiesData[i];
        if (!e.alive) continue;   /* never collide with a defeated enemy */

        var horizontalHit =
            playerX + PLAYER_W > e.x && playerX < e.x + ENEMY_W;
        var verticalHit =
            playerY + PLAYER_H > e.y && playerY < e.y + ENEMY_H;
        if (!horizontalHit || !verticalHit) continue;

        var enemyTop = e.y + ENEMY_H;

        /* Reliable stomp check: the player must be falling and its feet
           must have been above the enemy's head in the previous frame.
           Using prevY makes this work even when falling very fast. */
        if (velocityY < 0 && prevY >= enemyTop - 4) {
            defeatEnemy(e);
        } else if (!invulnerable) {
            killPlayer();
            return;
        }
        /* While invulnerable the player passes through enemies */
    }

    /* Day 7: boss collision. Stomping from above damages the boss;
       side contact kills the player through the normal lives system.
       While invulnerable (after a respawn) the boss is harmless. */
    if (bossData && bossData.alive && !isDying) {
        var bd = bossData;
        var bossHorizontalHit =
            playerX + PLAYER_W > bd.x && playerX < bd.x + BOSS_W;
        var bossVerticalHit =
            playerY + PLAYER_H > bd.y && playerY < bd.y + BOSS_H;

        if (bossHorizontalHit && bossVerticalHit) {
            var bossTop = bd.y + BOSS_H;
            if (velocityY < 0 && prevY >= bossTop - 6) {
                hitBoss(bd);          /* clean stomp from above */
            } else if (!invulnerable) {
                killPlayer();         /* side or bottom touch */
                return;
            }
        }
    }

    /* Goal reached: finish this level (or win the whole game) */
    if (playerX + PLAYER_W >= currentGoalX) {
        completeLevel();
        return;
    }

    /* Update DOM */
    player.style.left = playerX + "px";
    player.style.bottom = playerY + "px";

    var tiltDeg = playerVX * 1.5;
    var squashScale = 1;
    if (!isOnGround) {
        squashScale = velocityY > 0 ? 1.06 : 0.94;
    }
    player.style.transform = "rotate(" + tiltDeg + "deg) scaleY(" + squashScale + ")";

    if (!isOnGround) {
        player.classList.add("airborne");
    } else {
        player.classList.remove("airborne");
    }

    /* Draw enemies: position, facing direction and chase glow */
    for (i = 0; i < enemiesData.length; i++) {
        e = enemiesData[i];
        e.el.classList.toggle("face-left", e.alive && e.faceLeft);
        if (e.type === "chaser") {
            e.el.classList.toggle("chasing", e.alive && e.chasing);
        }
        if (e.alive) e.el.style.left = e.x + "px";
    }

    /* Day 7: draw the boss - position, facing and state classes */
    if (bossData && bossData.alive) {
        var bs = bossData;
        bs.el.style.left = bs.x + "px";
        bs.el.classList.toggle("face-left", bs.faceLeft);
        bs.el.classList.toggle("telegraph", bs.state === "telegraph");
        bs.el.classList.toggle("charging", bs.state === "charge");
        bs.el.classList.toggle("hit-flash",
            performance.now() < bs.hitFlashUntil);
    }

    for (i = 0; i < movingPlatforms.length; i++) {
        mp = movingPlatforms[i];
        mp.el.style.left = mp.left + "px";
        mp.el.style.bottom = mp.bottom + "px";
    }

    rafId = requestAnimationFrame(gameLoop);
}

/* ===== INIT ===== */

renderLives();
loadLevel(0);
