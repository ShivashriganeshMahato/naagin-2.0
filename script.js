var Vector2 = Phaser.Math.Vector2;

var GRID_SIZE = 32;

var config = {
    type: Phaser.AUTO,
    width: 704,
    height: 704,
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

function Body(initX, initY, initVx, initVy, sprite) {
    this.pos = new Vector2(initX, initY);
    this.vel = new Vector2(initVx, initVy);
    this.sprite = sprite;
    this.init = function(phaser) {
        this.body = phaser.physics.add.image(this.pos.x, this.pos.y, this.sprite);
        this.body.setVelocity(this.vel.x, this.vel.y);
    }
}
function Food(sprite){
  this.body = new Body();

}

function Snake(sprite) {
    this.bodies = [new Body(GRID_SIZE / 2, GRID_SIZE / 2, 0, 0, sprite)];
    this.timer = 0;
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
    this.PERIOD = 10;
    this.bindKey = function(phaser, name, callback) {
        this.keys[name].forEach(key => {
            phaser.input.keyboard.on(key, callback);
        });
    }
    this.init = function(phaser) {
        this.bodies.forEach(body => {
            body.init(phaser);
        });

        let snake = this;
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
    }
    this.update = function(phaser) {
        let head = this.bodies[this.bodies.length - 1];
        if (this.direction !== null) {
            if (this.timer >= this.PERIOD) {
                let newBody = new Body(head.pos.x + GRID_SIZE * this.direction.x,
                    head.pos.y + GRID_SIZE * this.direction.y, 0, 0, sprite);
                newBody.init(phaser);
                this.bodies.push(newBody);
                this.bodies.splice(0, 1)[0].body.destroy();
                this.timer = 0;
            } else {
                this.timer++;
            }
            if(head.pos.x <= -1 || head.pos.x >= 705 || head.pos.y <= -1 || head.pos.y >= 705){
              murder();
            }
        }
    }
}

var game = new Phaser.Game(config);
var snake;
var food;
function murder(){
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
}

function update() {
    snake.update(this);
}
