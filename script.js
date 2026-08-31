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
var soundBtnEl = document.getElementById("soundBtn");

/* Day 9: extra HUD + pause menu elements */
var powerTimeEl = document.getElementById("powerTime");
var livesStatEl = document.getElementById("livesStat");
var pauseBtnEl = document.getElementById("pauseBtn");
var pauseMenuEl = document.getElementById("pauseMenu");
var resumeBtnEl = document.getElementById("resumeBtn");
var restartBtnEl = document.getElementById("restartBtn");
var pauseSoundBtnEl = document.getElementById("pauseSoundBtn");

/* Day 10: persistent records + HUD elements */
var highScoreEl = document.getElementById("highScore");
var bestLevelEl = document.getElementById("bestLevel");
var highScoreStatEl = document.getElementById("highScoreStat");
var levelStatEl = document.getElementById("levelStat");
var bestLevelStatEl = document.getElementById("bestLevelStat");
var newRecordTagEl = document.getElementById("newRecordTag");
var newLevelTagEl = document.getElementById("newLevelTag");
var recordNoticeEl = document.getElementById("recordNotice");
var resetRecordsBtnEl = document.getElementById("resetRecordsBtn");

/* Day 11: combo HUD + milestone elements */
var comboValueEl = document.getElementById("comboValue");
var comboTimeEl = document.getElementById("comboTime");
var comboTimerBar = document.getElementById("comboTimerBar");
var comboMilestoneEl = document.getElementById("comboMilestone");

/* Day 12: shield HUD element */
var shieldValueEl = document.getElementById("shieldValue");
var doubleJumpValueEl = document.getElementById("doubleJumpValue");
var doubleJumpTimeEl = document.getElementById("doubleJumpTime");

/* ===== SOUND SYSTEM (Web Audio API) ===== */

var audioCtx = null;      /* created lazily on first user gesture */
var soundEnabled = true;  /* toggle controlled by the HUD button */

function ensureAudioCtx() {
    if (!audioCtx) {
        try {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (err) {
            audioCtx = null;
        }
    }
    /* Resume if suspended (Chrome autoplay policy) */
    if (audioCtx && audioCtx.state === "suspended") {
        audioCtx.resume();
    }
    return audioCtx;
}

/* Helper: play a short oscillator tone */
function playTone(type, freq, dur, vol, rampEnd) {
    if (!soundEnabled) return;
    var ctx = ensureAudioCtx();
    if (!ctx) return;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (rampEnd !== undefined) {
        osc.frequency.linearRampToValueAtTime(rampEnd, ctx.currentTime + dur);
    }
    gain.gain.setValueAtTime(vol || 0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + dur);
}

/* Helper: play a noise burst (for percussive sounds) */
function playNoise(dur, vol) {
    if (!soundEnabled) return;
    var ctx = ensureAudioCtx();
    if (!ctx) return;
    var bufLen = ctx.sampleRate * dur;
    var buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < bufLen; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var gain = ctx.createGain();
    gain.gain.setValueAtTime(vol || 0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start(ctx.currentTime);
    src.stop(ctx.currentTime + dur);
}

/* --- Individual sound effects --- */

function sfxJump() {
    playTone("square", 250, 0.15, 0.18, 600);
}

function sfxCoin() {
    playTone("sine", 988, 0.08, 0.25);
    setTimeout(function() { playTone("sine", 1319, 0.15, 0.25); }, 80);
}

function sfxPowerUp() {
    playTone("square", 440, 0.12, 0.2, 660);
    setTimeout(function() { playTone("square", 660, 0.12, 0.2, 880); }, 100);
    setTimeout(function() { playTone("square", 880, 0.2, 0.22, 1100); }, 200);
}

function sfxEnemyStomp() {
    playNoise(0.08, 0.2);
    playTone("sine", 300, 0.1, 0.2, 100);
}

function sfxCheckpoint() {
    playTone("sine", 523, 0.12, 0.25);
    setTimeout(function() { playTone("sine", 659, 0.12, 0.25); }, 100);
    setTimeout(function() { playTone("sine", 784, 0.2, 0.3); }, 200);
}

function sfxDeath() {
    playTone("square", 400, 0.15, 0.2, 200);
    setTimeout(function() { playTone("square", 200, 0.25, 0.2, 80); }, 150);
}

function sfxLevelComplete() {
    var notes = [523, 659, 784, 1047];
    for (var i = 0; i < notes.length; i++) {
        (function(freq, delay) {
            setTimeout(function() { playTone("square", freq, 0.18, 0.22); }, delay);
        })(notes[i], i * 110);
    }
}

function sfxBossHit() {
    playNoise(0.12, 0.25);
    playTone("square", 150, 0.15, 0.25, 80);
}

function sfxBossDefeated() {
    playNoise(0.2, 0.2);
    var notes = [262, 330, 392, 523, 659, 784];
    for (var i = 0; i < notes.length; i++) {
        (function(freq, delay) {
            setTimeout(function() { playTone("sine", freq, 0.2, 0.2); }, delay);
        })(notes[i], i * 100 + 150);
    }
}

function sfxGameOver() {
    var notes = [392, 349, 330, 262];
    for (var i = 0; i < notes.length; i++) {
        (function(freq, delay) {
            setTimeout(function() { playTone("square", freq, 0.3, 0.2); }, delay);
        })(notes[i], i * 250);
    }
}

function sfxVictory() {
    var notes = [523, 659, 784, 1047, 784, 1047, 1319];
    for (var i = 0; i < notes.length; i++) {
        (function(freq, delay) {
            setTimeout(function() { playTone("square", freq, 0.2, 0.22); }, delay);
        })(notes[i], i * 130);
    }
}

/* --- Day 12: new sound effects --- */

function sfxShieldCollect() {
    playTone("sine", 440, 0.1, 0.2, 880);
    setTimeout(function() { playTone("sine", 880, 0.15, 0.25, 1320); }, 80);
}

function sfxShieldBlock() {
    playNoise(0.1, 0.2);
    playTone("triangle", 300, 0.15, 0.25, 150);
}

function sfxShieldBreak() {
    playNoise(0.15, 0.25);
    playTone("square", 200, 0.2, 0.2, 80);
}

function sfxDoubleJumpCollect() {
    playTone("sine", 523, 0.08, 0.2);
    setTimeout(function() { playTone("sine", 784, 0.08, 0.2); }, 60);
    setTimeout(function() { playTone("sine", 1047, 0.15, 0.25); }, 120);
}

function sfxDoubleJumpActivate() {
    playTone("square", 400, 0.1, 0.15, 800);
}

/* --- Sound toggle (HUD button + pause menu share one handler).
   onclicks are used instead of addEventListener so a button can
   never collect duplicate listeners. --- */

function toggleSound() {
    ensureAudioCtx();
    soundEnabled = !soundEnabled;
    updateSoundUI();
}

/* Keep both sound buttons in sync with the current setting */
function updateSoundUI() {
    soundBtnEl.textContent = soundEnabled ? "\uD83D\uDD0A SOUND ON" : "\uD83D\uDD07 SOUND OFF";
    soundBtnEl.classList.toggle("off", !soundEnabled);
    pauseSoundBtnEl.textContent = soundEnabled ? "\uD83D\uDD0A SOUND: ON" : "\uD83D\uDD07 SOUND: OFF";
    pauseSoundBtnEl.classList.toggle("off", !soundEnabled);
}

soundBtnEl.onclick = toggleSound;
pauseSoundBtnEl.onclick = toggleSound;
updateSoundUI();

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

/* Day 9: how long the "LEVEL X READY!" banner shows before the
   level actually starts (also the pauseable level-start timer) */
var BANNER_WAIT_MS = 1000;

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

/* Day 12: Shield and Double Jump constants */
var DOUBLE_JUMP_DURATION = 10000;      /* 10 seconds */
var DOUBLE_JUMP_POWER_RATIO = 0.75;    /* second jump is 75% of first */
var SHIELD_BONUS_SCORE = 150;          /* points for collecting a shield */
var DOUBLE_JUMP_BONUS_SCORE = 150;     /* points for collecting double jump */
var SHIELD_KNOCKBACK = 6;              /* horizontal knockback when shield absorbs hit */

/* ===== COMBO / STREAK SYSTEM (Day 11) ===== */

var COMBO_MAX = 10;               /* hard cap, never goes above this */
var COMBO_WINDOW_MS = 2500;       /* time to chain the next action */
var COMBO_BONUS_FACTOR = 0.5;     /* bonus = base * (combo-1) * factor */

/* Current combo (combo value) and when the chain window expires.
   combo always starts/resets to 1 and the window only ticks while
   real gameplay is running (not paused / game over / won). */
var combo = 1;
var comboEndTime = 0;

var activePower = null;   /* "superjump", "speedboost", "doublejump" or null */
var powerEndTime = 0;     /* timestamp when the effect expires */

/* Day 12: shield and double-jump state */
var shieldActive = false;       /* player has a shield that absorbs one hit */
var doubleJumpUsed = false;     /* has the second jump been used since landing */

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

    /* Shield is instant-use and not part of the timed power-up system */
    if (pu.type === "shield") {
        if (!shieldActive) {
            activateShield();
            awardComboScore(SHIELD_BONUS_SCORE, pu.x + POWERUP_SIZE / 2, pu.y + POWERUP_SIZE + 4);
            sfxShieldCollect();
        } else {
            /* Already shielded: small bonus but no stacking */
            awardComboScore(50, pu.x + POWERUP_SIZE / 2, pu.y + POWERUP_SIZE + 4);
            sfxCoin();
        }
        return;
    }

    /* Double jump refresh: if already active, just restart the timer */
    if (pu.type === "doublejump" && activePower === "doublejump") {
        powerEndTime = performance.now() + DOUBLE_JUMP_DURATION;
        doubleJumpUsed = false;
        awardComboScore(50, pu.x + POWERUP_SIZE / 2, pu.y + POWERUP_SIZE + 4);
        sfxPowerUp();
        updatePowerHud();
        return;
    }

    /* Standard timed power-up collection */
    /* Day 11: power-ups feed the combo too (each counts only once) */
    var bonus = pu.type === "doublejump" ? DOUBLE_JUMP_BONUS_SCORE : 100;
    awardComboScore(bonus, pu.x + POWERUP_SIZE / 2, pu.y + POWERUP_SIZE + 4);

    if (pu.type === "doublejump") {
        activateDoubleJump();
        sfxDoubleJumpCollect();
        return;
    }

    activePower = pu.type;
    var duration = pu.type === "superjump" ? SUPER_JUMP_DURATION :
                   SPEED_BOOST_DURATION;
    powerEndTime = performance.now() + duration;

    player.classList.remove("power-superjump", "power-speedboost", "power-doublejump");
    if (pu.type === "superjump") player.classList.add("power-superjump");
    else player.classList.add("power-speedboost");

    doubleJumpUsed = false;
    sfxPowerUp();
}

function expirePowerUp() {
    activePower = null;
    powerEndTime = 0;
    player.classList.remove("power-superjump", "power-speedboost", "power-doublejump");
    /* Double jump ability gone: fail the flag so no second jump */
    doubleJumpUsed = true;
    updateDoubleJumpHud();
}

function updatePowerHud() {
    if (!activePower) {
        powerNameEl.textContent = "POWER-UP: NONE";
        powerNameEl.className = "";
        powerTimeEl.textContent = "";
        powerTimerBar.style.width = "0%";
        return;
    }

    var total = activePower === "superjump" ? SUPER_JUMP_DURATION :
                activePower === "speedboost" ? SPEED_BOOST_DURATION :
                DOUBLE_JUMP_DURATION;
    var remaining = powerEndTime - performance.now();
    if (remaining < 0) remaining = 0;

    /* Smooth one-decimal timer, refreshed every frame */
    var secondsLeft = (remaining / 1000).toFixed(1);

    var nameMap = {
        "superjump": "SUPER JUMP",
        "speedboost": "SPEED BOOST",
        "doublejump": "DOUBLE JUMP"
    };
    var classMap = {
        "superjump": "power-label-superjump",
        "speedboost": "power-label-speedboost",
        "doublejump": "power-label-doublejump"
    };
    powerNameEl.textContent = nameMap[activePower];
    powerNameEl.className = classMap[activePower];
    powerTimeEl.textContent = "TIME: " + secondsLeft + "s";
    powerTimerBar.style.width = Math.ceil((remaining / total) * 100) + "%";
}

/* ===== Day 12: Shield system ===== */

/* Refresh the Shield HUD cell */
function updateShieldHud() {
    shieldValueEl.textContent = shieldActive ? "ACTIVE" : "NONE";
    shieldValueEl.classList.toggle("active", shieldActive);
}

/* Refresh the Double Jump HUD cell (status + remaining time) */
function updateDoubleJumpHud() {
    if (activePower === "doublejump") {
        var remaining = powerEndTime - performance.now();
        if (remaining < 0) remaining = 0;
        doubleJumpValueEl.textContent = "ACTIVE";
        doubleJumpValueEl.classList.add("active");
        doubleJumpTimeEl.textContent = "TIME: " + (remaining / 1000).toFixed(1) + "s";
    } else {
        doubleJumpValueEl.textContent = "OFF";
        doubleJumpValueEl.classList.remove("active");
        doubleJumpTimeEl.textContent = "";
    }
}

/* Clear both temporary (non-persistent) power-up states: the
   shield and the double jump ability, plus their visuals. Used on
   death, respawn, level transitions and restart. */
function resetTemporaryPowerUps() {
    shieldActive = false;
    player.classList.remove("shielded");
    updateShieldHud();
    expirePowerUp();
    doubleJumpUsed = true;
    updateDoubleJumpHud();
}

/* Give the player a shield (used on collection and on respawn reset) */
function activateShield() {
    shieldActive = true;
    player.classList.add("shielded");
    updateShieldHud();
}

/* Consume the shield after it absorbs a hit: remove it, play the
   break effect, knock the player back */
function consumeShield(fromX, knockDir) {
    shieldActive = false;
    player.classList.remove("shielded");
    updateShieldHud();
    spawnShieldBreakFx(playerX + PLAYER_W / 2, playerY + PLAYER_H / 2);

    /* Small knockback away from the thing that hit the player:
       a little bounce even when on the ground, plus a horizontal push
       while airborne */
    if (isOnGround) {
        velocityY = 4;
    } else {
        playerVX = (knockDir || 1) * SHIELD_KNOCKBACK;
        velocityY = 3;
    }
    sfxShieldBlock();
    sfxShieldBreak();
    spawnFloatingText("SHIELD!", playerX + PLAYER_W / 2, playerY + PLAYER_H + 8);
}

/* Small expanding ring where the shield broke */
function spawnShieldBreakFx(cx, bottomY) {
    var fx = document.createElement("div");
    fx.className = "shield-break-fx";
    fx.style.left = (cx - 25) + "px";
    fx.style.bottom = (bottomY - 25) + "px";
    fx.addEventListener("animationend", function() {
        if (fx.parentNode) fx.parentNode.removeChild(fx);
    });
    entities.appendChild(fx);
}

/* ===== Day 12: Double Jump system ===== */

/* Activate the double jump ability for its timed duration */
function activateDoubleJump() {
    activePower = "doublejump";
    powerEndTime = performance.now() + DOUBLE_JUMP_DURATION;
    doubleJumpUsed = false;
    player.classList.remove("power-superjump", "power-speedboost");
    player.classList.add("power-doublejump");
    updatePowerHud();
    updateDoubleJumpHud();
    sfxDoubleJumpActivate();
}

/* Small burst at the player's feet when the second jump happens */
function spawnDoubleJumpFx(cx, bottomY) {
    var fx = document.createElement("div");
    fx.className = "double-jump-fx";
    fx.style.left = (cx - 13) + "px";
    fx.style.bottom = bottomY + "px";
    fx.addEventListener("animationend", function() {
        if (fx.parentNode) fx.parentNode.removeChild(fx);
    });
    entities.appendChild(fx);
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

/*    Day 9: explicit game state so the pause menu can only appear
   during real gameplay. Values: "banner", "playing", "dying",
   "levelcomplete", "gameover", "win".

   Day 10: persistent high score and best level records. Scores
   and level progress are saved to browser localStorage so they
   survive restarts, game over, winning and closing the page.
   ============================================================ */
var gameState = "banner";
var paused = false;       /* true while the pause menu is open */
var pausedStartMs = 0;    /* timestamp when the current pause began */

/* score and totalCoinsRun last for the whole game (all levels),
   coinCount only counts the coins of the current level. */
var score = 0;
var coinCount = 0;
var totalCoinsRun = 0;
var newHighAwarded = false;   /* Day 10: did this run beat the record? */

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
            { x: 150, y: 62, type: "shield" },
            { x: 760, y: 182, type: "superjump" },
            { x: 210, y: 152, type: "doublejump" },
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
            { x: 390, y: 217, type: "shield" },
            { x: 520, y: 287, type: "doublejump" },
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
            { x: 625, y: 275, type: "shield" },
            { x: 450, y: 305, type: "doublejump" },
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
        var puClass = pud.type === "superjump" ? "super-jump"
                    : pud.type === "speedboost" ? "speed-boost"
                    : pud.type === "shield" ? "shield"
                    : "doublejump";
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
    flashScore();
    updateHighScore();
    sfxCheckpoint();
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

    /* Day 11: enemy stomp feeds the combo */
    awardComboScore(STOMP_SCORE, e.x + ENEMY_W / 2, e.y + ENEMY_H + 4);

    velocityY = currentJumpPower() * STOMP_BOUNCE_FACTOR;
    isOnGround = false;
    onMovingPlatform = null;
    sfxEnemyStomp();
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

    /* Day 11: each boss hit feeds the combo (counted once per hit) */
    awardComboScore(BOSS_HIT_SCORE, b.x + BOSS_W / 2, b.y + BOSS_H + 8);

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

    spawnBossHitFx(b.x + BOSS_W / 2, b.y + BOSS_H - 6);
    sfxBossHit();

    if (b.health <= 0) {
        defeatBoss(b);
    }
}

/* Boss reached 0 health: disable it, open the gate, celebrate */
function defeatBoss(b) {
    b.alive = false;
    b.health = 0;
    updateBossHud();

    /* Day 11: a significant, combo-aware bonus for taking down the boss */
    awardComboScore(BOSS_DEFEAT_BONUS, b.x + BOSS_W / 2, b.y + BOSS_H + 8);

    b.el.classList.remove("telegraph", "charging", "hit-flash");
    b.el.classList.add("defeated");
    if (b.gateEl) b.gateEl.classList.add("destroyed");

    bossHudEl.classList.add("boss-defeated");
    showBanner("BOSS DEFEATED!");
    spawnBossHitFx(b.x + BOSS_W / 2, b.y + BOSS_H);
    sfxBossDefeated();
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

    if (text) spawnFloatingText(text, cx - 20, bottomY + 12);
}

/* ===== INPUT ===== */
/* These listeners are registered exactly once for the whole game.
   Changing levels never adds new ones. */

document.addEventListener("keydown", function(e) {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight" ||
        e.key === "ArrowUp" || e.key === " ") {
        e.preventDefault();
    }

    /* Day 9: P or Escape toggles the pause menu */
    if (e.key === "Escape" || e.key === "p" || e.key === "P") {
        e.preventDefault();
        togglePause();
        return;
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
    if (gameOver || gameWon || isDying || paused) return;

    if (isOnGround) {
        /* Ground jump: normal power (super jump when that power is active) */
        velocityY = currentJumpPower();
        isOnGround = false;
        onMovingPlatform = null;
        doubleJumpUsed = false;   /* freshly airborne: second jump available */
        sfxJump();
    } else if (activePower === "doublejump" && !doubleJumpUsed) {
        /* Airborne second jump, only while double jump is active */
        velocityY = currentJumpPower() * DOUBLE_JUMP_POWER_RATIO;
        doubleJumpUsed = true;
        spawnDoubleJumpFx(playerX + PLAYER_W / 2, playerY);
        sfxJump();
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
   so clicking the button can never stack duplicate listeners.
   The optional recordText is shown under the info line (used for
   "NEW HIGH SCORE!" on the game over / win screens). */
function showMessage(text, infoText, btnLabel, btnAction, btnClass, recordText) {
    messageTextEl.textContent = text;
    if (infoText) {
        messageInfoEl.textContent = infoText;
        messageInfoEl.style.display = "block";
    } else {
        messageInfoEl.style.display = "none";
    }
    if (recordText) {
        recordNoticeEl.textContent = recordText;
        recordNoticeEl.style.display = "block";
    } else {
        recordNoticeEl.style.display = "none";
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
        clearPausableTimer(levelStartTimer);
        levelStartTimer = null;
    }
    if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
    }
    if (respawnTimer !== null) {
        clearPausableTimer(respawnTimer);
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
                            "power-speedboost", "power-doublejump",
                            "shielded", "invulnerable", "dying");

    /* Reset temporary power-up state and timers (shield + double jump) */
    resetTemporaryPowerUps();
    updatePowerHud();

    /* Day 11: the combo carries over between levels. Refresh its
       window here so no time is silently lost during the transition. */
    if (combo > 1) comboEndTime = performance.now() + COMBO_WINDOW_MS;
    updateComboHud();

    /* Coins are per-level: reset the counter, show the new total */
    coinCount = 0;
    coinCountEl.textContent = "0";
    coinTotalEl.textContent = def.coins.length;
    levelNumEl.textContent = index + 1;
    scoreEl.textContent = score;   /* score carries over between levels */

    /* Day 10: reaching a new level updates the best-level record.
       loadLevel(0) for level 1 never raises it (default is 1). */
    updateBestLevel();

    /* Hide overlays and show the level banner */
    messageEl.style.display = "none";
    showBanner("LEVEL " + (index + 1) + " READY!");

    /* Give the banner a moment before the action starts. This
       timer is pauseable, so pausing during the splash keeps the
       remaining wait time intact. */
    gameState = "banner";
    levelStartTimer = startPausableTimer(function() {
        gameState = "playing";
        startLoop();
    }, BANNER_WAIT_MS);
}

/* Reached the flag: either advance or win the whole game */
function completeLevel() {
    /* Safety net (the gate already blocks the way): while the
       boss is alive the final goal stays locked */
    if (bossData && bossData.alive) return;

    gameWon = true;

    if (currentLevelIndex === LEVELS.length - 1) {
        gameState = "win";
        sfxVictory();
        renderRecords();
        showMessage(
            "YOU WIN!",
            "FINAL SCORE: " + score + "  |  HIGH SCORE: " + savedHighScore +
                "  |  BEST LEVEL: " + LEVELS.length +
                "  |  Coins collected: " + totalCoinsRun,
            "Restart Game",
            restartGame,
            "",
            newHighAwarded ? "NEW HIGH SCORE!" : ""
        );
    } else {
        gameState = "levelcomplete";
        sfxLevelComplete();
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
    gameState = "dying";
    renderLives();
    flashLives();   /* Day 9: HUD feedback for the lost life */

    /* Temporary power-ups wear off and movement stops */
    resetTemporaryPowerUps();
    /* Day 11: losing a life breaks the streak */
    resetCombo();
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
    sfxDeath();

    if (lives <= 0) {
        gameOver = true;
        gameState = "gameover";
        isDying = false;
        sfxGameOver();
        renderRecords();
        showMessage(
            "GAME OVER",
            "SCORE: " + score + "  |  HIGH SCORE: " + savedHighScore +
                "  |  BEST LEVEL: " + savedBestLevel +
                "  |  Coins collected: " + totalCoinsRun,
            "Restart Game",
            restartGame,
            "",
            newHighAwarded ? "NEW HIGH SCORE!" : ""
        );
        return;
    }

    /* Brief pause, then back to the checkpoint. This timer is
       pauseable so the death hop can be frozen too. */
    respawnTimer = startPausableTimer(respawnPlayer, DEATH_PAUSE_MS);
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

    /* Day 12: shield and double jump are temporary and don't survive
       death; the checkpoint itself stays active (Day 6) */
    resetTemporaryPowerUps();

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
    gameState = "playing";
    startLoop();
}

/* Complete reset: fresh score, full lives, all checkpoints inactive.
   Sound preference (Day 8) intentionally carries over. */
function restartGame() {
    score = 0;
    totalCoinsRun = 0;
    lives = START_LIVES;
    isDying = false;
    newHighAwarded = false;
    invulnUntil = 0;
    resetCombo();   /* Day 11: a fresh restart starts a fresh streak */

    /* Close any pause menu and cancel every pending gameplay
       timer before rebuilding Level 1 */
    paused = false;
    pausedStartMs = 0;
    game.classList.remove("paused");
    hidePauseMenu();

    if (respawnTimer !== null) {
        clearPausableTimer(respawnTimer);
        respawnTimer = null;
    }
    if (levelStartTimer !== null) {
        clearPausableTimer(levelStartTimer);
        levelStartTimer = null;
    }
    if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
    }

    renderLives();
    loadLevel(0);
}

/* ============================================================
   DAY 9: HUD FEEDBACK ANIMATIONS

   Tiny helpers that replay a CSS animation whenever a value
   changes, plus small floating "+N" texts on the game field.
   ============================================================ */

/* Restart a CSS animation on an element (remove, force reflow, add) */
function bumpFlash(el, className) {
    el.classList.remove(className);
    void el.offsetWidth;
    el.classList.add(className);
}

function flashScore() { bumpFlash(scoreEl, "flash"); }
function flashCoins() { bumpFlash(coinCountEl, "flash"); }
function flashLives() { bumpFlash(livesStatEl, "lost"); }

/* A short floating text (like "+50") that rises and fades out.
   It removes itself via animationend, so no timers are tracked. */
function spawnFloatingText(text, cx, bottomY) {
    var pop = document.createElement("div");
    pop.className = "score-pop";
    pop.textContent = text;
    pop.style.left = (cx - 20) + "px";
    pop.style.bottom = bottomY + "px";
    pop.addEventListener("animationend", function() {
        if (pop.parentNode) pop.parentNode.removeChild(pop);
    });
    entities.appendChild(pop);
    return pop;
}

/* ============================================================
   DAY 11: COMBO / STREAK SYSTEM

   Reward skilled play by chaining successful actions (coin,
   enemy stomp, boss hit, power-up). Getting another successful
   action inside COMBO_WINDOW_MS raises the combo (up to
   COMBO_MAX). The combo multiplies the points awarded by each
   action as a bonus, so the base scores stay untouched but the
   total grows as the streak grows.

   Combo callbacks that everyone above calls:
     increaseCombo()   raise the combo + reset the timer
     awardComboScore() add base + combo bonus, show floating text
   ============================================================ */

/* Bonus points for an action worth "base" points. Uses the
   CURRENT combo (so it scales after increaseCombo() nudges it).
   At combo 1 there is no bonus; each extra combo step adds
   base * 0.5 points for an easy to understand, fair progression. */
function comboBonusFor(base) {
    return Math.round(base * (combo - 1) * COMBO_BONUS_FACTOR);
}

/* Refresh the combo HUD (value, timer, emphasis) */
function updateComboHud() {
    comboValueEl.textContent = "x" + combo;
    comboValueEl.classList.toggle("high", combo >= 5);
    bumpFlash(comboValueEl, "pop");
    /* The timer readout/bar are refreshed each frame by
       updateComboTimer() and cleared by resetCombo(). */
}

/* Raise the combo by one (up to the cap) and restart its timer.
   Also fires milestone feedback when a special combo is reached. */
function increaseCombo() {
    if (combo < COMBO_MAX) combo++;
    comboEndTime = performance.now() + COMBO_WINDOW_MS;
    updateComboHud();
    checkComboMilestone();
    if (combo > 1 && soundEnabled) {
        playTone("triangle", 700 + combo * 60, 0.06, 0.12);
    }
}

/* Bring the combo back to x1 and stop its timer */
function resetCombo() {
    combo = 1;
    comboEndTime = 0;
    comboValueEl.classList.remove("high");
    comboTimeEl.textContent = "TIME: --";
    comboTimerBar.style.width = "0%";
    comboValueEl.textContent = "x1";
    hideComboMilestone();
}

/* Called every frame while playing: count the combo window down
   and reset the streak if the player was too slow */
function updateComboTimer() {
    if (combo <= 1) {
        return;
    }
    var remaining = comboEndTime - performance.now();
    if (remaining <= 0) {
        resetCombo();
        return;
    }
    comboTimeEl.textContent = "TIME: " + (remaining / 1000).toFixed(1) + "s";
    comboTimerBar.style.width =
        Math.ceil((remaining / COMBO_WINDOW_MS) * 100) + "%";
}

/* Milestone feedback at x3 / x5 / x10. Non-blocking: it just
   flashes a word and plays a tone, gameplay keeps running. */
function checkComboMilestone() {
    var text = null;
    if (combo >= 10) { text = "COMBO MASTER!"; }
    else if (combo === 5) { text = "GREAT!"; }
    else if (combo === 3) { text = "NICE!"; }

    if (text) {
        comboMilestoneEl.textContent = text;
        bumpFlash(comboMilestoneEl, "show");
        if (soundEnabled) {
            playTone("square", 880, 0.12, 0.2, 1320);
            setTimeout(function() { playTone("square", 1100, 0.15, 0.2, 1650); }, 90);
        }
    }
}

function hideComboMilestone() {
    comboMilestoneEl.classList.remove("show");
}

/* Floating score text that shows the total (base + combo bonus)
   and annotates it with "COMBO!" whenever a bonus was granted */
function showFloatingScore(total, bonus, cx, bottomY) {
    var label = "+" + total;
    if (bonus > 0) label += " COMBO!";
    var pop = spawnFloatingText(label, cx, bottomY);
    if (bonus > 0) pop.classList.add("combo");
    return pop;
}

/* The single scoring entry point for combo-eligible actions.
   Adds the base score plus the growing combo bonus, bumps the
   combo, refreshes the HUD and shows a floating score. */
function awardComboScore(base, cx, bottomY) {
    increaseCombo();
    var bonus = comboBonusFor(base);
    var total = base + bonus;
    score += total;
    scoreEl.textContent = score;
    flashScore();
    updateHighScore();
    return showFloatingScore(total, bonus, cx, bottomY);
}

/* ============================================================
   DAY 9: PAUSE SYSTEM

   Pausing cancels the animation frame and suspends every
   setTimeout that drives gameplay. On resume the timeouts are
   re-scheduled with the time they had left, and all absolute
   timestamps (power-up timers, respawn invulnerability, boss
   timers...) are pushed forward by the time spent paused, so
   nothing ever "loses" time while the game is frozen.
   ============================================================ */

/* Running pauseable timeouts that know how much time is left */
var pausableTimers = [];

/* The timeout fired or was cleared: drop it from the list and
   make sure its "levelStartTimer"/"respawnTimer" handle is null */
function firePausableTimer(t) {
    var idx = pausableTimers.indexOf(t);
    if (idx !== -1) pausableTimers.splice(idx, 1);
    if (levelStartTimer === t) levelStartTimer = null;
    if (respawnTimer === t) respawnTimer = null;
    t.fn();
}

/* Start a pauseable timer, tracking how much time was left */
function startPausableTimer(fn, ms) {
    var t = { fn: fn, remaining: ms, startedAt: performance.now(), id: null };
    pausableTimers.push(t);
    t.id = setTimeout(function() {
        firePausableTimer(t);
    }, ms);
    return t;
}

/* Cancel a pauseable timer (also removes it from the list) */
function clearPausableTimer(t) {
    if (!t) return;
    if (t.id !== null) {
        clearTimeout(t.id);
        t.id = null;
    }
    var idx = pausableTimers.indexOf(t);
    if (idx !== -1) pausableTimers.splice(idx, 1);
}

/* On pause: record the remaining time of every running timer,
   then clear its timeout so nothing can fire while frozen */
function suspendPausableTimers() {
    for (var i = 0; i < pausableTimers.length; i++) {
        var t = pausableTimers[i];
        if (t.id === null) continue;
        var elapsed = performance.now() - t.startedAt;
        t.remaining = elapsed >= t.remaining ? 0 : t.remaining - elapsed;
        clearTimeout(t.id);
        t.id = null;
    }
}

/* On resume: re-arm every suspended timer with the time it had
   left; a timer whose time ran out during the pause fires soon */
function resumePausableTimers() {
    for (var i = 0; i < pausableTimers.length; i++) {
        var t = pausableTimers[i];
        if (t.id !== null) continue;
        t.startedAt = performance.now();
        t.id = setTimeout(function() {
            firePausableTimer(t);
        }, Math.max(0, t.remaining));
    }
}

/* Push all absolute timestamps forward by the paused duration so
   their remaining time is preserved exactly across the pause */
function shiftTimestamps(delta) {
    if (activePower && powerEndTime > 0) powerEndTime += delta;
    if (invulnUntil > 0) invulnUntil += delta;
    if (comboEndTime > 0) comboEndTime += delta;   /* Day 11: pause-free combo timer */

    for (var i = 0; i < enemiesData.length; i++) {
        var e = enemiesData[i];
        if (e.defeatedAt !== 0) e.defeatedAt += delta;
    }

    if (bossData) {
        var b = bossData;
        if (b.telegraphEnd !== 0) b.telegraphEnd += delta;
        if (b.chargeEnd !== 0) b.chargeEnd += delta;
        if (b.nextAttackOk !== 0) b.nextAttackOk += delta;
        if (b.staggerUntil !== 0) b.staggerUntil += delta;
        if (b.hitFlashUntil !== 0) b.hitFlashUntil += delta;
    }
}

/* Pause is only allowed during real gameplay, never over a
   GAME OVER / LEVEL COMPLETE / YOU WIN overlay */
function canPauseNow() {
    if (messageEl.style.display === "flex") return false;
    if (gameOver || gameWon || paused) return false;
    return true;
}

function showPauseMenu() {
    pauseMenuEl.classList.add("show");
}

function hidePauseMenu() {
    pauseMenuEl.classList.remove("show");
}

/* on: pause the game, off: resume it from exactly where it froze */
function setPaused(on) {
    if (on === paused) return;

    if (on) {
        if (!canPauseNow()) return;
        paused = true;
        pausedStartMs = performance.now();
        game.classList.add("paused");

        /* Release held keys so nothing gets stuck while frozen */
        keys.left = false;
        keys.right = false;

        /* Freeze the loop: no new frames get scheduled at all */
        if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }

        /* Suspend pending level-banner / death-hop timeouts so no
           time is accidentally counted while paused */
        suspendPausableTimers();

        showPauseMenu();
    } else {
        /* Advance every gameplay timestamp by the paused time so
           power-ups, invulnerability and the boss keep the exact
           time they had when the pause started */
        shiftTimestamps(performance.now() - pausedStartMs);

        paused = false;
        game.classList.remove("paused");
        hidePauseMenu();

        resumePausableTimers();

        /* Restart the loop only for states that run gameplay;
           "banner" and "dying" wait for their (re-armed) timer */
        if (gameState === "playing") startLoop();
    }
}

function togglePause() {
    setPaused(!paused);
}

/* PAUSE button in the HUD and the pause menu buttons */
pauseBtnEl.onclick = togglePause;
resumeBtnEl.onclick = togglePause;
restartBtnEl.onclick = restartGame;

/* ============================================================
   DAY 10: PERSISTENT RECORDS (HIGH SCORE + BEST LEVEL)

   The only persistent data is the player's high score and best
   level. Records are read from / written to localStorage under
   clearly-namespaced keys so they never touch unrelated storage.

   Every access is guarded with try/catch so the game keeps
   working even when localStorage is unavailable (private
   browsing, storage blocked, etc.). Stored values are always
   validated before use so malformed data can never break the
   game - bad or missing values fall back to sensible defaults.
   ============================================================ */

var HIGH_SCORE_KEY = "marioGameHighScore";
var BEST_LEVEL_KEY = "marioGameBestLevel";

/* Safely read a number from a localStorage key. Returns fallback
   (default 0) if the key is missing, unreadable, or not a finite
   non-negative number. */
function readNumber(key, fallback) {
    if (fallback === undefined) fallback = 0;
    try {
        var raw = window.localStorage.getItem(key);
        if (raw === null) return fallback;
        var n = Number(raw);
        if (!isFinite(n) || n < 0) return fallback;
        return Math.floor(n);
    } catch (err) {
        return fallback;
    }
}

/* Safely write a number to a localStorage key. Swallows any error
   (e.g. quota exceeded) so persistence failing never breaks play. */
function writeNumber(key, value) {
    try {
        window.localStorage.setItem(key, String(value));
    } catch (err) {
        /* persistence unavailable: the game simply continues in-memory */
    }
}

/* The persistent high score and best level held in memory. */
var savedHighScore = 0;
var savedBestLevel = 1;

/* Load both records from localStorage and refresh the HUD. Called
   once at startup, and again after a record reset. */
function loadRecords() {
    savedHighScore = readNumber(HIGH_SCORE_KEY, 0);
    savedBestLevel = readNumber(BEST_LEVEL_KEY, 1);
    if (savedBestLevel < 1) savedBestLevel = 1;
    if (savedBestLevel > LEVELS.length) savedBestLevel = LEVELS.length;
    renderRecords();
}

/* Write both records back to localStorage (only when they differ,
   to avoid pointless writes). */
function persistRecords() {
    if (savedHighScore > readNumber(HIGH_SCORE_KEY, 0)) {
        writeNumber(HIGH_SCORE_KEY, savedHighScore);
    }
    if (savedBestLevel > readNumber(BEST_LEVEL_KEY, 1)) {
        writeNumber(BEST_LEVEL_KEY, savedBestLevel);
    }
}

/* Refresh the HUD cells for high score and best level. */
function renderRecords() {
    highScoreEl.textContent = savedHighScore;
    bestLevelEl.textContent = savedBestLevel;
}

/* Check whether the current run's score beats the saved high
   score. If it does, update the high score immediately, save it,
   refresh the HUD and play the "NEW RECORD!" animation. Called
   after every scoring event. */
function updateHighScore() {
    if (score > savedHighScore) {
        savedHighScore = score;
        newHighAwarded = true;
        persistRecords();
        renderRecords();
        highScoreStatEl.classList.add("new-high");
        bumpFlash(newRecordTagEl, "show");
        /* The HUD glow fades on its own after a moment */
        setTimeout(function() {
            highScoreStatEl.classList.remove("new-high");
        }, 2000);
    }
}

/* Record the highest level actually reached. Called when a new
   level begins. Never lowers the best level and never records a
   level the player has not actually started. */
function updateBestLevel() {
    var reached = currentLevelIndex + 1;   /* current level is 1-based */
    if (reached > savedBestLevel) {
        savedBestLevel = reached;
        persistRecords();
        renderRecords();
        bestLevelStatEl.classList.add("new-level");
        bumpFlash(newLevelTagEl, "show");
        setTimeout(function() {
            bestLevelStatEl.classList.remove("new-level");
        }, 2000);
    }
}

/* Clear the saved records (high score -> 0, best level -> 1)
   after a confirmation. Only the records are removed; game code,
   files and unrelated storage are untouched. On success the HUD
   refreshes immediately. */
function resetRecords() {
    if (!window.confirm(
        "Reset all saved records?\n\n" +
        "This clears your HIGH SCORE and BEST LEVEL.\n" +
        "Your current game is not affected."
    )) {
        return;   /* cancelled: don't touch anything */
    }

    savedHighScore = 0;
    savedBestLevel = 1;
    try {
        window.localStorage.removeItem(HIGH_SCORE_KEY);
        window.localStorage.removeItem(BEST_LEVEL_KEY);
    } catch (err) {
        /* storage unavailable: still reset the in-memory values */
    }
    renderRecords();
    highScoreStatEl.classList.remove("new-high");
    bestLevelStatEl.classList.remove("new-level");

    /* Brief visual confirmation that the records were cleared */
    bumpFlash(highScoreEl, "flash");
    bumpFlash(bestLevelEl, "flash");
}

resetRecordsBtnEl.onclick = resetRecords;

/* ===== GAME LOOP ===== */

function startLoop() {
    if (rafId !== null) cancelAnimationFrame(rafId);   /* never two loops */
    rafId = requestAnimationFrame(gameLoop);
}

function gameLoop() {
    /* No new frames run while paused or outside active gameplay */
    if (paused || gameState !== "playing") { rafId = null; return; }

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
            /* Day 12: landing re-arms the double jump for next time */
            doubleJumpUsed = false;
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
            coinCount++;
            totalCoinsRun++;
            coinCountEl.textContent = coinCount;
            flashCoins();
            /* Day 11: coin feeds the combo (scored once thanks to
               the collected flag above) */
            awardComboScore(50, c.x + COIN_SIZE / 2, c.y + COIN_SIZE + 4);
            sfxCoin();
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
    updateShieldHud();
    updateDoubleJumpHud();

    /* Day 11: count down the combo window every frame; if it runs
       out the streak resets to x1 */
    updateComboTimer();

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
        } else if (shieldActive) {
            /* Day 12: a shield absorbs one side hit and pushes the
               player clear so they do not immediately take a second hit */
            var dir = playerX < e.x ? -1 : 1;
            if (dir < 0) playerX = e.x - PLAYER_W;
            else playerX = e.x + ENEMY_W;
            consumeShield(e.x, dir);
            return;
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
            } else if (shieldActive) {
                /* Day 12: a shield absorbs one boss contact; push the
                   player clear of the boss so they don't catch a second hit */
                var bdir = playerX < bd.x ? -1 : 1;
                if (bdir < 0) playerX = bd.x - PLAYER_W;
                else playerX = bd.x + BOSS_W;
                consumeShield(bd.x, bdir);
                return;
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

/* Day 10: restore the saved high score and best level before the
   HUD is drawn on the first level. */
loadRecords();
renderLives();
loadLevel(0);
