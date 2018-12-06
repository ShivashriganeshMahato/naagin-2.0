var Vector2 = Phaser.Math.Vector2;

var GRID_SIZE = 32;
var R = C = 22; // Rows, Columns

// Generates random number between a and b, inclusive
function random(a, b) {
    return Math.floor(Math.random() * b) + a;
}

var config = {
    type: Phaser.AUTO,
    width: C * GRID_SIZE,
    height: R * GRID_SIZE,
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

// initX and initY should be grid coordinates
function Body(initX, initY, initVx, initVy, sprite) {
    this.coors = new Vector2(initX, initY);
    // Interpolate grid coordinates onto screen
    this.pos = new Vector2(GRID_SIZE / 2 + GRID_SIZE * initX,
        GRID_SIZE / 2 + GRID_SIZE * initY);
    this.vel = new Vector2(initVx, initVy);
    this.sprite = sprite;
}
Body.prototype.init = function(phaser) {
    // Create and add body to world
    this.body = phaser.physics.add.image(this.pos.x, this.pos.y, this.sprite);
    this.body.setVelocity(this.vel.x, this.vel.y);
}

function Portal(x, y, toX, toY, sprite) {
    // Call Body's constructor
    Body.call(this, x, y, 0, 0, sprite);
    this.to = new Vector2(toX, toY);
}
// Make Portal a child of Body
Portal.prototype = Object.create(Body.prototype);
Portal.prototype.update = function(phaser, snake) {
    let head = snake.bodies[snake.bodies.length - 1],
        h = head.pos,
        b = this.body,
        S = GRID_SIZE / 2;

    // Check collision
    if (!snake.isTeleporting && h.x + S > b.x - S && h.x - S < b.x + S &&
        h.y + S > b.y - S && h.y - S < b.y + S) {
        // Teleport head, body will follow
        head.coors.set(this.to.x, this.to.y);
        head.pos.set(GRID_SIZE / 2 + GRID_SIZE * this.to.x,
            GRID_SIZE / 2 + GRID_SIZE * this.to.y);
        snake.isTeleporting = true;
    }
};

function Food(sprite) {
    this.body = new Body();
}

function Snake(sprite) {
    this.bodies = [new Body(0, 0, 0, 0, sprite), new Body(1, 0, 0, 0, sprite), new Body(2, 0, 0, 0, sprite)];
    this.timer = 0;
    this.isTeleporting = false;
    this.direction = null;
    this.directions = {
        LEFT: new Vector2(-1, 0),
        RIGHT: new Vector2(1, 0),
        UP: new Vector2(0, -1),
        DOWN: new Vector2(0, 1)
    };
    this.keys = {
        left: ["keydown_A", "keydown_left"],
        right: ["keydown_D", "keydown_right"],
        up: ["keydown_W", "keydown_up"],
        down: ["keydown_S", "keydown_down"]
    };
    this.PERIOD = 7;
    this.bindKey = function(phaser, name, callback) {
        // Bind all key codes to an action
        this.keys[name].forEach(key => {
            phaser.input.keyboard.on(key, callback);
        });
    }
    this.init = function(phaser) {
        this.bodies.forEach(body => {
            body.init(phaser);
        });

        let snake = this;

        // Delegate movement if possible in certain direction
        function canChangeDirection(oppositeDir) {
            return snake.direction === null || snake.bodies.length <= 1 ||
                !snake.direction.equals(oppositeDir);
        }
        this.bindKey(phaser, "left", function() {
            if (canChangeDirection(snake.directions.RIGHT)) {
                snake.direction = snake.directions.LEFT;
            }
        })
        this.bindKey(phaser, "right", function() {
            if (canChangeDirection(snake.directions.LEFT)) {
                snake.direction = snake.directions.RIGHT;
            }
        })
        this.bindKey(phaser, "up", function() {
            if (canChangeDirection(snake.directions.DOWN)) {
                snake.direction = snake.directions.UP;
            }
        })
        this.bindKey(phaser, "down", function() {
            if (canChangeDirection(snake.directions.UP)) {
                snake.direction = snake.directions.DOWN;
            }
        })
        phaser.input.keyboard.on("keydown_B", function () {
            snake.addBody(phaser);
        });
    }
    this.update = function(phaser) {
        let head = this.bodies[this.bodies.length - 1];
        if (this.direction !== null) {
            if (this.timer >= this.PERIOD) {
                // Every this.PERIOD frames, move snake by moving tail to desired new head position
                let newBody = new Body(head.coors.x + this.direction.x,
                    head.coors.y + this.direction.y, 0, 0, sprite);
                newBody.init(phaser);
                this.bodies.push(newBody);
                this.bodies.splice(0, 1)[0].body.destroy();
                this.isTeleporting = false;
                this.timer = 0;
            } else {
                this.timer++;
            }
            // Kill if out of bounds
            if (head.pos.x <= -1 || head.pos.x >= 705 || head.pos.y <= -1 || head.pos.y >= 705) {
                murder();
            }
        }
    }
    this.addBody = function(phaser) {
        let tail = this.bodies[0];
        let newBody = new Body(tail.coors.x, tail.coors.y, 0, 0, sprite);
        newBody.init(phaser);
        this.bodies.unshift(newBody);
    }
}

var game = new Phaser.Game(config);
var snake, food, portal, endPortal;

function murder() {
    console.log('hi');
}

function preload() {
    this.load.setBaseURL('http://labs.phaser.io');

    this.load.image('sky', 'assets/skies/underwater1.png');
    this.load.image('snake', 'assets/sprites/32x32.png');
}

function create() {
    this.add.image(350, 350, 'sky');

    snake = new Snake('snake');
    snake.init(this);

    food = new Food('food');

    let portalX = random(0, C - 1), portalY = random(0, R - 1),
        portalTX = random(0, C - 1), portalTY = random(0, R - 1);
    while (portalX === portalTX && portalY === portalTY ||
        Math.sqrt(Math.pow(portalX - portalTX, 2) + Math.pow(portalY - portalTY, 2)) < 8) {
        portalTX = random(0, C - 1);
        portalTY = random(0, R - 1);
    }
    portal = new Portal(portalX, portalY, portalTX, portalTY, 'snake');
    portal.init(this, snake);
    endPortal = new Portal(portalTX, portalTY, portalX, portalY, 'snake');
    endPortal.init(this, snake);
}

function update() {
    snake.update(this);
    portal.update(this, snake);
    endPortal.update(this, snake);
}
