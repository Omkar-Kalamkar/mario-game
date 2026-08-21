var player = document.getElementById("player");
var game = document.getElementById("game");
var scoreEl = document.getElementById("score");
var coinCountEl = document.getElementById("coinCount");
var messageEl = document.getElementById("message");
var messageTextEl = document.getElementById("messageText");
var messageBtnEl = document.getElementById("messageBtn");
var powerNameEl = document.getElementById("powerName");
var powerTimerBar = document.getElementById("powerTimerBar");

var PLAYER_W = 35;
var PLAYER_H = 45;
var GAME_W = 900;
var GAME_H = 500;
var GRAVITY = 0.8;
var JUMP_POWER = 15;
var ENEMY_W = 35;
var ENEMY_H = 30;
var COIN_SIZE = 25;
var GOAL_X = 840;

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

var powerUpsData = [
    { x: 185, y: 135, type: "superjump", collected: false,
      el: document.getElementById("powerJump") },
    { x: 780, y: 170, type: "speedboost", collected: false,
      el: document.getElementById("powerSpeed") }
];

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

var playerX = 80;
var playerY = 55;
var prevY = 55;
var velocityY = 0;
var playerVX = 0;
var isOnGround = true;
var gameOver = false;
var gameWon = false;
var score = 0;
var coinCount = 0;

var keys = { left: false, right: false };

var staticPlatforms = [
    { left: 0, bottom: 0, width: 900, height: 55 },
    { left: 200, bottom: 130, width: 150, height: 25 },
    { left: 450, bottom: 210, width: 150, height: 25 },
    { left: 700, bottom: 130, width: 150, height: 25 }
];

var movingPlatforms = [
    {
        left: 320, bottom: 170, width: 100, height: 18,
        initLeft: 320, initBottom: 170,
        minX: 300, maxX: 480, minY: 170, maxY: 170,
        speedX: 1.5, speedY: 0, dirX: 1, dirY: 1,
        dx: 0, dy: 0, moving: true,
        el: document.getElementById("movingPlat1")
    },
    {
        left: 50, bottom: 70, width: 100, height: 18,
        initLeft: 50, initBottom: 70,
        minX: 50, maxX: 50, minY: 70, maxY: 230,
        speedX: 0, speedY: 1.2, dirX: 1, dirY: 1,
        dx: 0, dy: 0, moving: true,
        el: document.getElementById("movingPlat2")
    }
];

var platforms = staticPlatforms.concat(movingPlatforms);
var onMovingPlatform = null;

var coinsData = [
    { x: 250, y: 165, collected: false, el: document.getElementById("coin1") },
    { x: 500, y: 245, collected: false, el: document.getElementById("coin2") },
    { x: 750, y: 165, collected: false, el: document.getElementById("coin3") }
];

var enemiesData = [
    { x: 350, y: 55, dir: 1, speed: 2, alive: true, minX: 300, maxX: 430,
      el: document.getElementById("enemy1"), startX: 350, startDir: 1 },
    { x: 620, y: 55, dir: -1, speed: 2, alive: true, minX: 550, maxX: 700,
      el: document.getElementById("enemy2"), startX: 620, startDir: -1 }
];

/* ===== INPUT ===== */

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

/* ===== GAME LOOP ===== */

function gameLoop() {
    if (gameOver || gameWon) return;

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
        for (var i = 0; i < platforms.length; i++) {
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

    /* Clamp below ground */
    if (playerY < 0) {
        playerY = 0;
        velocityY = 0;
        isOnGround = true;
        onMovingPlatform = null;
    }

    /* Enemies patrol */
    for (var i = 0; i < enemiesData.length; i++) {
        var e = enemiesData[i];
        if (!e.alive) continue;
        e.x += e.speed * e.dir;
        if (e.x <= e.minX) { e.x = e.minX; e.dir = 1; }
        if (e.x >= e.maxX) { e.x = e.maxX; e.dir = -1; }
    }

    /* Coin collection */
    for (var i = 0; i < coinsData.length; i++) {
        var c = coinsData[i];
        if (c.collected) continue;
        if (playerX + PLAYER_W > c.x && playerX < c.x + COIN_SIZE &&
            playerY + PLAYER_H > c.y && playerY < c.y + COIN_SIZE) {
            c.collected = true;
            c.el.style.display = "none";
            score += 50;
            coinCount++;
            scoreEl.textContent = score;
            coinCountEl.textContent = coinCount;
        }
    }

    /* Power-up collection */
    for (var i = 0; i < powerUpsData.length; i++) {
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

    /* Enemy collisions */
    for (var i = 0; i < enemiesData.length; i++) {
        var e = enemiesData[i];
        if (!e.alive) continue;
        if (playerX + PLAYER_W > e.x && playerX < e.x + ENEMY_W &&
            playerY + PLAYER_H > e.y && playerY < e.y + ENEMY_H) {
            if (velocityY < 0 && playerY >= e.y + ENEMY_H * 0.5) {
                e.alive = false;
                e.el.style.display = "none";
                score += 100;
                scoreEl.textContent = score;
                velocityY = currentJumpPower() * 0.6;
                onMovingPlatform = null;
            } else {
                gameOver = true;
                showMessage("GAME OVER");
                return;
            }
        }
    }

    /* Win condition */
    if (playerX + PLAYER_W >= GOAL_X) {
        gameWon = true;
        showMessage("YOU WIN!");
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

    for (var i = 0; i < enemiesData.length; i++) {
        var e = enemiesData[i];
        if (e.alive) e.el.style.left = e.x + "px";
    }

    for (var i = 0; i < movingPlatforms.length; i++) {
        var mp = movingPlatforms[i];
        mp.el.style.left = mp.left + "px";
        mp.el.style.bottom = mp.bottom + "px";
    }

    requestAnimationFrame(gameLoop);
}

/* ===== MESSAGE ===== */

function showMessage(text) {
    messageTextEl.textContent = text;
    messageEl.style.display = "flex";
    messageBtnEl.textContent = "Restart";
}

/* ===== RESTART ===== */

function restartGame() {
    playerX = 80;
    playerY = 55;
    prevY = 55;
    velocityY = 0;
    playerVX = 0;
    isOnGround = true;
    gameOver = false;
    gameWon = false;
    score = 0;
    coinCount = 0;
    keys.left = false;
    keys.right = false;
    onMovingPlatform = null;

    /* Reset power-ups and active effects */
    activePower = null;
    powerEndTime = 0;
    player.classList.remove("power-superjump", "power-speedboost");

    for (var i = 0; i < powerUpsData.length; i++) {
        powerUpsData[i].collected = false;
        powerUpsData[i].el.style.display = "block";
    }
    updatePowerHud();

    for (var i = 0; i < coinsData.length; i++) {
        coinsData[i].collected = false;
        coinsData[i].el.style.display = "block";
    }

    for (var i = 0; i < enemiesData.length; i++) {
        var e = enemiesData[i];
        e.alive = true;
        e.x = e.startX;
        e.dir = e.startDir;
        e.el.style.display = "block";
        e.el.style.left = e.x + "px";
    }

    for (var i = 0; i < movingPlatforms.length; i++) {
        var mp = movingPlatforms[i];
        mp.left = mp.initLeft;
        mp.bottom = mp.initBottom;
        mp.dirX = 1;
        mp.dirY = 1;
        mp.dx = 0;
        mp.dy = 0;
        mp.el.style.left = mp.left + "px";
        mp.el.style.bottom = mp.bottom + "px";
    }

    scoreEl.textContent = "0";
    coinCountEl.textContent = "0";
    messageEl.style.display = "none";

    player.style.left = playerX + "px";
    player.style.bottom = playerY + "px";
    player.style.transform = "";
    player.classList.remove("airborne");

    requestAnimationFrame(gameLoop);
}

/* ===== INIT ===== */

player.style.left = playerX + "px";
player.style.bottom = playerY + "px";

requestAnimationFrame(gameLoop);
