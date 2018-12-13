var Vector2 = Phaser.Math.Vector2;
var Vector3 = Phaser.Math.Vector3;

var alive = true;

var GRID_SIZE = 32;
var R = C = 22; // Rows, Columns

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
    doesUserExist: function(username) {
        return new Promise(resolve => {
            this.query(this.users, "username", "==", username, docs => {
                resolve(docs.length !== 0);
            });
        });
    },
    // callback accept boolean (was authentication successful?)
    authenticate: function(username, pwd, callback) {
        return new Promise(resolve => {
            this.query(this.users, "username", "==", username, docs => {
                if (docs.length === 0) {
                    resolve(false);
                    return;
                }
                resolve(docs[0].password == hex_sha1(pwd));
            });
        });
    },
    // then accept boolean (was user successfully created?)
    createUser: async function(username, pwd) {
        return new Promise(resolve => {
            let doesUserExist = this.doesUserExist(username);
            if (doesUserExist) {
                console.log("User with username " + username + " already exists")
                resolve(false);
            }
            this.users.add({
                username: username,
                password: hex_sha1(pwd)
            }).then(() => {
                resolve(true);
            }).catch(error => {
                console.error("Error writing document: ", error);
                resolve(false);
            })
            this.scores.add({
                username: username,
                score: 0
            });
        });
    },
    // then accept boolean (was score successfully updated?)
    setScore: async function(username, score) {
        return new Promise(resolve => {
            this.queryRaw(this.scores, "username", "==", username, snapshot => {
                let id = null;
                snapshot.forEach(doc => {
                    id = doc.id;
                })
                this.scores.doc(id).set({
                    username: username,
                    score: score
                }).then(() => {
                    resolve(true);
                }).catch(error => {
                    console.error("Error writing document: ", error);
                    resolve(false);
                })
            });
        });
    },
    // callback accepts array of non-zero scores
    getScores: async function(callback) {
        return new Promise(resolve => {
            this.scores.get().then(snapshot => {
                let scores = [];
                snapshot.forEach(doc => {
                    if (doc.data().score != 0) {
                        scores.push(doc.data());
                    }
                });
                resolve(scores);
            });
        });
    }
};

// initX and initY should be grid coordinates
function Body(initX, initY, initVx, initVy, sprite, initZ) {
    this.coors = new Vector3(initX, initY, initZ || 1);
    // Interpolate grid coordinates onto screen
    this.pos = new Vector2(10 + GRID_SIZE / 2 + GRID_SIZE * initX,
        10 + GRID_SIZE / 2 + GRID_SIZE * initY);
    this.vel = new Vector2(initVx, initVy);
    this.sprite = sprite;
}
Body.prototype.init = function(phaser) {
    // Create and add body to world
    this.body = phaser.physics.add.image(this.pos.x, this.pos.y, this.sprite);
    this.body.setVelocity(this.vel.x, this.vel.y);
    this.body.setDisplaySize(GRID_SIZE, GRID_SIZE);
}

function Portal(x, y, z, toX, toY, toZ, sprite) {
    // Call Body's constructor
    Body.call(this, x, y, 0, 0, sprite, z);
    this.to = new Vector3(toX, toY, toZ);
}
// Make Portal a child of Body
Portal.prototype = Object.create(Body.prototype);
Portal.prototype.connectTo = function(oPortal) {
    this.to.set(oPortal.coors.x, oPortal.coors.y, oPortal.coors.z);
    oPortal.to.set(this.coors.x, this.coors.y, this.coors.z);
};
Portal.prototype.update = function(phaser, snakes) {
    let isSnakeOnLevel = false;

    snakes.forEach(snake => {
        if (snake.z !== this.coors.z) {
            return;
        } else {
            isSnakeOnLevel = true;
        }

        let head = snake.bodies[snake.bodies.length - 1],
            h = head.pos,
            b = this.body,
            S = GRID_SIZE / 2;

        // Check collision
        if (!snake.isTeleporting && this.body.visible && h.x + S > b.x - S &&
            h.x - S < b.x + S && h.y + S > b.y - S && h.y - S < b.y + S) {
            // Teleport head, body will follow
            snake.z = this.to.z;
            head.coors.set(this.to.x, this.to.y, snake.z);
            head.pos.set(10 + GRID_SIZE / 2 + GRID_SIZE * this.to.x,
                10 + GRID_SIZE / 2 + GRID_SIZE * this.to.y);
            snake.isTeleporting = true;
        }
    });

    this.body.visible = isSnakeOnLevel;
};

function Food(sprite) {
    Body.call(this, random(0, C - 1), random(0, R - 1), 0, 0, sprite);
}
Food.prototype = Object.create(Body.prototype);
Food.prototype.update = function(phaser, snakes) {
    snakes.forEach(snake => {
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
            this.body.setPosition(10 + GRID_SIZE / 2 + GRID_SIZE * x,
                10 + GRID_SIZE / 2 + GRID_SIZE * y);
        }
    });
}

function Snake(sprite) {
    this.z = 1;
    this.getSprite = function() {
        return sprite + this.z.toString();
    }
    this.bodies = [new Body(0, 0, 0, 0, this.getSprite()), new Body(1, 0, 0, 0, this.getSprite()), new Body(2, 0, 0, 0, this.getSprite())];
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
        left: ["keydown_A", "keydown_J", "keydown_left"],
        right: ["keydown_D", "keydown_L", "keydown_right"],
        up: ["keydown_W", "keydown_I", "keydown_up"],
        down: ["keydown_S", "keydown_K", "keydown_down"]
    };
    this.PERIOD = 7;
    this.headShade = "";
    this.bindKey = function(phaser, name, controlsID, callback) {
        // Bind appropriate key code to an action
        phaser.input.keyboard.on(this.keys[name][controlsID], callback);
    }
    this.init = function(phaser, controlsID) {
        this.bodies.forEach(body => {
            body.init(phaser);
        });

        let snake = this;

        // Delegate movement if possible in certain direction
        function canChangeDirection(oppositeDir) {
            return snake.direction === null || snake.bodies.length <= 1 ||
                !snake.direction.equals(oppositeDir);
        }
        this.bindKey(phaser, "left", controlsID, function() {
            if (canChangeDirection(snake.directions.RIGHT)) {
                snake.direction = snake.directions.LEFT;
            }
        })
        this.bindKey(phaser, "right", controlsID, function() {
            if (canChangeDirection(snake.directions.LEFT)) {
                snake.direction = snake.directions.RIGHT;
            }
        })
        this.bindKey(phaser, "up", controlsID, function() {
            if (canChangeDirection(snake.directions.DOWN)) {
                snake.direction = snake.directions.UP;
            }
        })
        this.bindKey(phaser, "down", controlsID, function() {
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
                switch (this.headShade) {
                    case "":
                        this.headShade = "Light";
                        break;
                    case "Light":
                        this.headShade = "Dark";
                        break;
                    case "Dark":
                        this.headShade = "";
                        break;
                }
                let newBody = new Body(head.coors.x + this.direction.x,
                    head.coors.y + this.direction.y, 0, 0, this.getSprite() + this.headShade);
                newBody.init(phaser);
                this.bodies.push(newBody);
                this.bodies.splice(0, 1)[0].body.destroy();
                this.isTeleporting = false;
                this.timer = 0;
            } else {
                this.timer++;
            }
            // Kill if out of bounds
            if (head.pos.x < 10 || head.pos.x > 714 || head.pos.y < 10 || head.pos.y > 714) {
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
        let newBody = new Body(tail.coors.x, tail.coors.y, 0, 0, this.getSprite());
        newBody.init(phaser);
        this.bodies.unshift(newBody);
    }
}

var snakes = [],
    food, portals = [],
    labels = [];

function generatePortals(phaser, levels) {
    let positions = [];

    // Check if position was already generated
    function positionExists(position) {
        let exists = false;

        positions.forEach(pos => {
            if (pos.equals(position)) exists = true;
        });

        return exists;
    }

    // Generate positions for 2 portals per level
    for (var i = 0; i < levels * 2; i++) {
        let position = new Vector2(random(0, C - 1), random(0, R - 1));

        while (positionExists(position)) {
            position = new Vector2(random(0, C - 1), random(0, R - 1))
        }

        positions.push(position);
    }

    // Generate portals from positions
    for (var l = 1, j = 0; l <= levels; l++, j += 2) {
        let pos1 = positions[j];
        let to1 = positions[j === 0 ? positions.length - 1 : j - 1];
        let toZ1 = l === 1 ? levels : l - 1;
        let pos2 = positions[j + 1];
        let to2 = positions[j === positions.length - 2 ? 0 : j + 2];
        let toZ2 = l === levels ? 1 : l + 1;

        let portal1 = new Portal(pos1.x, pos1.y, l,
            to1.x, to1.y, toZ1, 'portal' + l);
        portal1.init(phaser);
        portal1.body.setAngularVelocity(500);

        let portal2 = new Portal(pos2.x, pos2.y, l,
            to2.x, to2.y, toZ2, 'portal' + l);
        portal2.init(phaser);
        portal2.body.setAngularVelocity(500);

        portals.push(portal1);
        portals.push(portal2);
    }
}

var Game = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function() {
        Phaser.Scene.call(this, {
            key: 'game'
        });
    },

    preload: function() {
        this.load.image('sky', 'assets/grid.png');
        this.load.image('snake', 'assets/blue.png');
        this.load.image('food', 'assets/blueLight.png');
        this.load.image('portal', 'assets/bluePortal.png');

        this.load.image('sky', 'assets/skies/underwater1.png');
        this.load.image('snake1', 'assets/purple.png');
        this.load.image('snake1Light', 'assets/purpleLight.png');
        this.load.image('snake1Dark', 'assets/purpleDark.png');
        this.load.image('snake2', 'assets/blue.png');
        this.load.image('snake2Light', 'assets/blueLight.png');
        this.load.image('snake2Dark', 'assets/blueDark.png');
        this.load.image('snake3', 'assets/green.png');
        this.load.image('snake3Light', 'assets/greenLight.png');
        this.load.image('snake3Dark', 'assets/greenDark.png');
        this.load.image('snake4', 'assets/yellow.png');
        this.load.image('snake4Light', 'assets/yellowLight.png');
        this.load.image('snake4Dark', 'assets/yellowDark.png');
        this.load.image('snake5', 'assets/orange.png');
        this.load.image('snake5Light', 'assets/orangeLight.png');
        this.load.image('snake5Dark', 'assets/orangeDark.png');
        this.load.image('snake6', 'assets/red.png');
        this.load.image('snake6Light', 'assets/redLight.png');
        this.load.image('snake6Dark', 'assets/redDark.png');
        this.load.image('portal1', 'assets/purplePortal.png');
        this.load.image('portal2', 'assets/bluePortal.png');
        this.load.image('portal3', 'assets/greenPortal.png');
        this.load.image('portal4', 'assets/yellowPortal.png');
        this.load.image('portal5', 'assets/orangePortal.png');
        this.load.image('portal6', 'assets/redPortal.png');
    },
    create: async function() {
        this.add.image(362, 362, 'sky').setDisplaySize(724, 724);

        for (var i = 0; i < 2; i++) {
            snakes.push(new Snake('snake'));
            snakes[i].init(this, i);
            labels.push(this.add.text(30, 100 + 40 * i, 'Score: 0', {
                fontSize: '20px'
            }));
        }

        food = new Food('food');
        food.init(this);

        generatePortals(this, 6);
    },
    update: async function() {
        for (var i = 0; i < snakes.length; i++) {
            labels[i].setText('Snake ' + (i + 1) + ' Score: ' + (snakes[i].bodies.length - 1));
        }
        if (alive) {
            food.update(this, snakes);
            snakes.forEach(snake => {
                snake.update(this);
            });
            portals.forEach(portal => {
                portal.update(this, snakes);
            });
        } else {
            this.scene.start('egame');
            alive = true;
        }
    }
});

var MainMenu = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function() {
        Phaser.Scene.call(this, {
            key: 'mgame'
        });
    },
    preload: function() {
        this.load.image('msky', 'assets/title.png');
        this.load.image('snake', 'assets/blue.png');
    },
    create: function() {
        this.add.image(362, 362, 'msky').setDisplaySize(724, 724);

        const greeting = this.add.text(30, 100, 'WELCOME TO NAAGIN 2.0', {
            fontSize: '50px'
        });

        const clickButton = this.add.text(200, 300, 'Let us Play!', {
                fill: '#0000FF',
                fontSize: '32px'
            })
            .setInteractive()
            .on('pointerdown', function(event) {
                this.scene.start('game');
            }, this);
    },
    update: function() {}
});

var GameOver = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function() {
        Phaser.Scene.call(this, {
            key: 'egame'
        });
    },
    preload: function() {
        this.load.setBaseURL('http://labs.phaser.io');
        this.load.image('msky', 'assets/skies/gradient11.png');
    },
    create: function() {
        this.add.image(362, 362, 'msky').setDisplaySize(724, 724);
        let clickCount = 0;
        this.clickCountText = this.add.text(100, 200, '');

        const alert = this.add.text(150, 100, 'YOU ARE DEAD', {
            fontSize: '50px'
        });

        const clickButton = this.add.text(220, 300, 'Play Again?', {
                fontSize: '32px'
            })
            .setInteractive()
            .on('pointerdown', function(event) {
                this.scene.start('mgame');
            }, this);
    },
    update: function() {}
});


var config = {
    type: Phaser.AUTO,
    width: C * GRID_SIZE + 20,
    height: R * GRID_SIZE + 20,
    physics: {
        default: 'arcade',
        arcade: {}
    },
    scene: [MainMenu, Game, GameOver]
};

var game = new Phaser.Game(config);
