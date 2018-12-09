var Vector2 = Phaser.Math.Vector2;

var alive = true;

var GRID_SIZE = 32;
var R = C = 22; // Rows, Columns

var config = {
    type: Phaser.AUTO,
    width: C * GRID_SIZE,
    height: R * GRID_SIZE,
    physics: {
        default: 'arcade',
        arcade: {}
    },
    scene: {
        update: update,
        preload: preload,
        create: create
    }
};
var game = new Phaser.Game(config);

// Generates random number between a and b, inclusive
function random(a, b) {
    return Math.floor(Math.random() * b) + a;
}

var ScoreManager = {
    init: function() {
        // Initialize Firebase
        var config = {
            apiKey: "AIzaSyDTjFo9xNlY8YQ7vRlxpRMUwrGYXtfwtpc",
            authDomain: "naagin2-a23d2.firebaseapp.com",
            databaseURL: "https://naagin2-a23d2.firebaseio.com",
            projectId: "naagin2-a23d2",
            storageBucket: "naagin2-a23d2.appspot.com",
            messagingSenderId: "513168986921"
        };
        firebase.initializeApp(config);
        this.db = firebase.firestore();
        this.users = this.db.collection("users");
        this.scores = this.db.collection("scores");
    },
    // callback accepts snapshot object
    queryRaw: function(collection, field, comparator, value, callback) {
        collection.where(field, comparator, value).get().then(callback);
    },
    // callback accepts queried documents parsed into array
    query: function(collection, field, comparator, value, callback) {
        this.queryRaw(collection, field, comparator, value, snapshot => {
            let docs = [];
            snapshot.forEach(doc => {
                docs.push(doc.data());
            });
            callback(docs);
        })
    },
    // callback accepts boolean (does user exist?)
    doesUserExist: function(username, callback) {
        this.query(this.users, "username", "==", username, docs => {
            callback(docs.length !== 0);
        });
    },
    // callback accept boolean (was authentication successful?)
    authenticate: function(username, pwd, callback) {
        this.query(this.users, "username", "==", username, docs => {
            if (docs.length === 0) {
                callback(false);
                return;
            }
            callback(docs[0].password == hex_sha1(pwd));
        });
    },
    // then accept boolean (was user successfully created?)
    createUser: function(username, pwd, then) {
        this.doesUserExist(username, result => {
            if (result) {
                console.log("User with username " + username + " already exists")
                return;
            }
            this.users.add({
                username: username,
                password: hex_sha1(pwd)
            }).then(() => {
                if (then)
                    then(true);
            }).catch(error => {
                console.error("Error writing document: ", error);
                if (then)
                    then(false);
            })
            this.scores.add({
                username: username,
                score: 0
            });
        })
    },
    // then accept boolean (was score successfully updated?)
    setScore: function(username, score, then) {
        this.queryRaw(this.scores, "username", "==", username, snapshot => {
            let id = null;
            snapshot.forEach(doc => {
                id = doc.id;
            })
            this.scores.doc(id).set({
                username: username,
                score: score
            }).then(() => {
                if (then)
                    then(true);
            }).catch(error => {
                console.error("Error writing document: ", error);
                if (then)
                    then(false);
            })
        });
    },
    // callback accepts array of non-zero scores
    getScores: function(callback) {
        this.scores.get().then(snapshot => {
            let scores = [];
            snapshot.forEach(doc => {
                if (doc.data().score != 0) {
                    scores.push(doc.data());
                }
            });
            callback(scores);
        });
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
    Body.call(this, random(0, C - 1), random(0, R - 1), 0, 0, sprite);
}
Food.prototype = Object.create(Body.prototype);
Food.prototype.update = function(phaser, snake) {
    let head = snake.bodies[snake.bodies.length - 1],
        h = head.pos,
        b = this.body,
        S = GRID_SIZE / 2;
    // Check collision
    if (!snake.isTeleporting && h.x + S > b.x - S && h.x - S < b.x + S &&
        h.y + S > b.y - S && h.y - S < b.y + S) {
        snake.addBody(phaser);
        //this.body.destroy();
        let x = random(0, C - 1),
            y = random(0, R - 1);

        this.coors.set(x, y);
        this.body.setPosition(GRID_SIZE / 2 + GRID_SIZE * x,
            GRID_SIZE / 2 + GRID_SIZE * y);
    }
}

function Snake(sprite) {
    this.bodies = [new Body(0, 0, 0, 0, sprite)];
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
        phaser.input.keyboard.on("keydown_B", function() {
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
                alive = false;
            }
            let h = head.pos,
                S = GRID_SIZE / 2,
                c = this.bodies;
            // Check collision
            for (var i = c.length - 1; i >= 2; i--) {
                let b = c[i - 2].pos;
                if (h.x + S > b.x - S && h.x - S < b.x + S &&
                    h.y + S > b.y - S && h.y - S < b.y + S) {
                    alive = false;
                }
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

var snake, food, portal, endPortal;

function preload() {
    this.load.setBaseURL('http://labs.phaser.io');

    this.load.image('sky', 'assets/skies/underwater1.png');
    this.load.image('snake', 'assets/sprites/32x32.png');
    this.load.image('food', 'assets/sprites/aqua_ball.png');
    this.load.image('portal', 'assets/sprites/orb-green.png');
}

function create() {
    this.add.image(350, 350, 'sky');

    function create() {
        ScoreManager.init();
        ScoreManager.getScores(scores => {
            console.log(scores);
        });

        this.add.image(350, 350, 'sky');

        snake = new Snake('snake');
        snake.init(this);

        food = new Food('food');
        food.init(this);

        let portalX = random(0, C - 1),
            portalY = random(0, R - 1),
            portalTX = random(0, C - 1),
            portalTY = random(0, R - 1);
        while (portalX === portalTX && portalY === portalTY ||
            Math.sqrt(Math.pow(portalX - portalTX, 2) + Math.pow(portalY - portalTY, 2)) < 8) {
            portalTX = random(0, C - 1);
            portalTY = random(0, R - 1);
        }
        portal = new Portal(portalX, portalY, portalTX, portalTY, 'portal');
        portal.init(this, snake);
        endPortal = new Portal(portalTX, portalTY, portalX, portalY, 'portal');
        endPortal.init(this, snake);

        let portalX = random(0, C - 1),
            portalY = random(0, R - 1),
            portalTX = random(0, C - 1),
            portalTY = random(0, R - 1);
        while (portalX === portalTX && portalY === portalTY ||
            Math.sqrt(Math.pow(portalX - portalTX, 2) + Math.pow(portalY - portalTY, 2)) < 8) {
            portalTX = random(0, C - 1);
            portalTY = random(0, R - 1);
        }

        function update() {
            if (alive) {
                food.update(this, snake);
                snake.update(this);
                portal.update(this, snake);
                endPortal.update(this, snake);
            }
        }
