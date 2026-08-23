/* ============================================================
   MARIO-STYLE PLATFORMER
   Day 5: multiple levels and level progression.

   All levels are described by data in the LEVELS array below.
   loadLevel() destroys the old entities and builds the new ones,
   so the gameplay code (movement, collision, enemies, power-ups)
   works exactly the same way for every level.
   ============================================================ */

/* ===== ELEMENT REFERENCES ===== */

var player = document.getElementById("player");
var game = document.getElementById("game");
var entities = document.getElementById("entities");
var scoreEl = document.getElementById("score");
var coinCountEl = document.getElementById("coinCount");
var coinTotalEl = document.getElementById("coinTotal");
var levelNumEl = document.getElementById("levelNum");
var messageEl = document.getElementById("message");
var messageTextEl = document.getElementById("messageText");
var messageInfoEl = document.getElementById("messageInfo");
var messageBtnEl = document.getElementById("messageBtn");
var powerNameEl = document.getElementById("powerName");
var powerTimerBar = document.getElementById("powerTimerBar");
var goalEl = document.getElementById("goal");
var bannerEl = document.getElementById("levelBanner");

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
        ]
    },

    /* ---- LEVEL 3: HARD ------------------------------------
       Four small islands, long pits, stepping stones over the
       gaps, a ferry platform across the wide middle pit and two
       chasers (one guarding the goal). Few safe areas. */
    {
        theme: "theme-3",
        start: { x: 50, y: 55 },
        goalX: 855,
        platforms: [
            { left: 0,   bottom: 0,   width: 200, height: 55 },
            { left: 340, bottom: 0,   width: 160, height: 55 },
            { left: 640, bottom: 0,   width: 90,  height: 55 },
            { left: 770, bottom: 0,   width: 130, height: 55 },
            { left: 225, bottom: 130, width: 60,  height: 18 },
            { left: 360, bottom: 140, width: 90,  height: 20 },
            { left: 470, bottom: 210, width: 80,  height: 20 },
            { left: 380, bottom: 280, width: 90,  height: 20 },
            { left: 560, bottom: 250, width: 80,  height: 20 },
            { left: 690, bottom: 155, width: 70,  height: 18 },
            { left: 790, bottom: 225, width: 70,  height: 18 }
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
            { x: 712, y: 178 },
            { x: 812, y: 248 }
        ],
        powerUps: [
            { x: 410, y: 336, type: "superjump" },
            { x: 660, y: 150, type: "speedboost" }
        ],
        enemies: [
            { type: "patrol", x: 180, y: 55,  dir: -1, speed: 2.4, minX: 115, maxX: 192 },
            { type: "chaser", x: 470, y: 55,  dir: -1, speed: 1.8, chaseSpeed: 3.4,
              minX: 345, maxX: 462 },
            { type: "patrol", x: 530, y: 230, dir: -1, speed: 1.8, minX: 472, maxX: 512 },
            { type: "patrol", x: 650, y: 55,  dir: 1,  speed: 2.6, minX: 642, maxX: 692 },
            { type: "chaser", x: 872, y: 55,  dir: -1, speed: 1.8, chaseSpeed: 3.4,
              minX: 772, maxX: 862 }
        ]
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
    if (isOnGround && !gameOver && !gameWon) {
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
    player.style.left = playerX + "px";
    player.style.bottom = playerY + "px";
    player.style.transform = "";
    player.classList.remove("airborne", "power-superjump", "power-speedboost");

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

/* Touched an enemy sideways or fell into a pit */
function loseGame() {
    gameOver = true;
    showMessage("GAME OVER", null, "Restart", restartGame);
}

/* Complete reset: back to level 1 with a fresh score */
function restartGame() {
    score = 0;
    totalCoinsRun = 0;
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
       once the player is fully below the screen the run is over */
    if (playerY < PIT_FALL_Y) {
        loseGame();
        return;
    }

    /* Enemy AI */
    updateEnemies();

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

    /* Power-up timer expiry (checked every frame, no setTimeout) */
    if (activePower && performance.now() >= powerEndTime) {
        expirePowerUp();
    }
    updatePowerHud();

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
        } else {
            loseGame();
            return;
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

    for (i = 0; i < movingPlatforms.length; i++) {
        mp = movingPlatforms[i];
        mp.el.style.left = mp.left + "px";
        mp.el.style.bottom = mp.bottom + "px";
    }

    rafId = requestAnimationFrame(gameLoop);
}

/* ===== INIT ===== */

loadLevel(0);
