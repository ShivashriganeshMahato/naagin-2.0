var Vector2 = Phaser.Math.Vector2;

var config = {
    type: Phaser.AUTO,
    width: 700,
    height: 700,
    physics: {
        default: 'arcade',
        arcade: {}
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

function Body (initX, initY, initVx, initVy, sprite) {
    this.pos = new Vector2(initX, initY);
    this.vel = new Vector2(initVx, initVy);
    this.sprite = sprite;

}
Body.prototype.init = function (phaser, game) {
    this.body = phaser.physics.add.image(this.pos.x, this.pos.y, this.sprite);
    this.body.setVelocity(this.vel.x, this.vel.y);
    this.keys = {
        left: ["keydown_A", "keydown_left"],
        right: ["keydown_D", "keydown_right"],
        up: ["keydown_W", "keydown_up"],
        down: ["keydown_S", "keydown_down"]
    };
}
Body.prototype.update = function () {
    this.body.setVelocity(this.vel.x, this.vel.y);
}
Body.prototype.bindKey = function (phaser, name, callback) {
    this.keys[name].forEach(key => {
        phaser.input.keyboard.on(key, callback);
    });
}

function Snake (sprite) {
    // Call Body's constructor
    Body.call(this, 25, 25, 0, 0, sprite);
    this.SPEED = 50;
    this.vLEFT = new Vector2(-this.SPEED, 0);
    this.vRIGHT = new Vector2(this.SPEED, 0);
    this.vUP = new Vector2(0, -this.SPEED,);
    this.vDOWN = new Vector2(0, this.SPEED);
}
// Make Snake a child of Body, inheriting its functions
Snake.prototype = Object.create(Body.prototype);
Snake.prototype.init = function (phaser, game) {
    // Call Body's init
    Body.prototype.init.call(this, phaser, game);
    let snake = this;
    Body.prototype.bindKey.call(this, phaser, "left", function () {
        if (!snake.vel.equals(snake.vRIGHT)) {
            snake.vel.set(snake.vLEFT.x, snake.vLEFT.y);
        }
    })
    Body.prototype.bindKey.call(this, phaser, "right", function () {
        if (!snake.vel.equals(snake.vLEFT)) {
            snake.vel.set(snake.vRIGHT.x, snake.vRIGHT.y);
        }
    })
    Body.prototype.bindKey.call(this, phaser, "up", function () {
        if (!snake.vel.equals(snake.vDOWN)) {
            snake.vel.set(snake.vUP.x, snake.vUP.y);
        }
    })
    Body.prototype.bindKey.call(this, phaser, "down", function () {
        if (!snake.vel.equals(snake.vUP)) {
            snake.vel.set(snake.vDOWN.x, snake.vDOWN.y);
        }
    })
}

var game = new Phaser.Game(config);
var snake;

function preload() {
    this.load.setBaseURL('http://labs.phaser.io');

    this.load.image('sky', 'assets/skies/underwater1.png');
    this.load.image('snake', 'assets/sprites/50x50-white.png');
}

function create() {
    this.add.image(350, 350, 'sky');

    snake = new Snake('snake');
    snake.init(this, game);
}

function update() {
    snake.update();
}
