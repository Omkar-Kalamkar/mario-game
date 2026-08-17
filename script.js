var player = document.getElementById("player");
var game = document.getElementById("game");
var scoreEl = document.getElementById("score");
var coinCountEl = document.getElementById("coinCount");
var messageEl = document.getElementById("message");
var messageTextEl = document.getElementById("messageText");
var messageBtnEl = document.getElementById("messageBtn");

var PLAYER_W = 35;
var PLAYER_H = 45;
var GAME_W = 900;
var GRAVITY = 0.8;
var JUMP_POWER = 15;
var MOVE_SPEED = 5;
var ENEMY_W = 35;
var ENEMY_H = 30;
var COIN_SIZE = 25;
var GOAL_X = 840;

var playerX = 80;
var playerY = 55;
var prevY = 55;
var velocityY = 0;
var isOnGround = true;
var gameOver = false;
var gameWon = false;
var score = 0;
var coinCount = 0;

var keys = { left: false, right: false };

var platforms = [
    { left: 0, bottom: 0, width: 900, height: 55 },
    { left: 200, bottom: 130, width: 150, height: 25 },
    { left: 450, bottom: 210, width: 150, height: 25 },
    { left: 700, bottom: 130, width: 150, height: 25 }
];

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
});

/* ===== JUMP ===== */

function doJump() {
    if (isOnGround && !gameOver && !gameWon) {
        velocityY = JUMP_POWER;
        isOnGround = false;
    }
}

/* ===== GAME LOOP ===== */

function gameLoop() {
    if (gameOver || gameWon) return;

    /* Movement */
    if (keys.left) playerX -= MOVE_SPEED;
    if (keys.right) playerX += MOVE_SPEED;
    if (playerX < 0) playerX = 0;
    if (playerX > GAME_W - PLAYER_W) playerX = GAME_W - PLAYER_W;

    /* Physics */
    prevY = playerY;
    velocityY -= GRAVITY;
    playerY += velocityY;

    /* Platform collisions (one-way, from above) */
    isOnGround = false;
    if (velocityY <= 0) {
        var bestTop = -1;
        for (var i = 0; i < platforms.length; i++) {
            var p = platforms[i];
            var platTop = p.bottom + p.height;
            if (playerX + PLAYER_W > p.left && playerX < p.left + p.width) {
                if (prevY >= platTop && playerY < platTop) {
                    if (platTop > bestTop) bestTop = platTop;
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
                velocityY = JUMP_POWER * 0.6;
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
    for (var i = 0; i < enemiesData.length; i++) {
        var e = enemiesData[i];
        if (e.alive) e.el.style.left = e.x + "px";
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
    isOnGround = true;
    gameOver = false;
    gameWon = false;
    score = 0;
    coinCount = 0;
    keys.left = false;
    keys.right = false;

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

    scoreEl.textContent = "0";
    coinCountEl.textContent = "0";
    messageEl.style.display = "none";

    player.style.left = playerX + "px";
    player.style.bottom = playerY + "px";

    requestAnimationFrame(gameLoop);
}

/* ===== INIT ===== */

player.style.left = playerX + "px";
player.style.bottom = playerY + "px";

requestAnimationFrame(gameLoop);
