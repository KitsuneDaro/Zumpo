// キャンバスのサイズ
const SCALE = Math.min(window.innerWidth / 3, window.innerHeight / 4);
const WIDTH = 3 * SCALE;
const HEIGHT = 4 * SCALE;
console.log(SCALE, screen.width);

// モジュール各種
const Engine = Matter.Engine;
const Render = Matter.Render;
const Runner = Matter.Runner;
const Body = Matter.Body;
const Bodies = Matter.Bodies;
const Bounds = Matter.Bounds;
const Common = Matter.Common;
const Composite = Matter.Composite;
const Composites = Matter.Composites;
const Constraint = Matter.Constraint;
const Events = Matter.Events;
const Mouse = Matter.Mouse;
const MouseConstraint = Matter.MouseConstraint;
const Vector = Matter.Vector;

window.addEventListener('load', () => {
    $.ajaxSetup({ async: false });
    new Main(document.getElementById('app'));
});

class Main {
    ZUNDAMON_PATH = {
        normal: './img/zundamon.png',
        danger: './img/zundamon_danger.png',
        feeling: './img/zundamon_feeling.png'
    };
    ZUNDAMON_ORIGIN = Vector.create(10 / 16 * SCALE, 45 / 16 * SCALE);
    ZUNDAMON_HEIGHT = 0.6 * HEIGHT;
    ZUNDAMON_SCALE = 0.4;

    ZUMPO_ORIGIN = Vector.create(0, 5 / 16 * SCALE);
    ZUMPO_TICKNESS = 5 / 16 * SCALE;
    ZUMPO_MIN_LEN = 1 / 2 * SCALE;
    ZUMPO_DAMP_ACC = 0.05 / 160 * SCALE;
    ZUMPO_MAX_DELTA_SITIMULATION = 0.1;
    ZUMPO_MAX_SITIMULATION = 4;
    ZUMPO_MAX_HOLDING_TIME = 2;

    ZUMPO_FEELING_UP_PERIOD = 1;
    ZUMPO_FEELING_UP_VEL = -Math.PI / 16;
    ZUMPO_FEELING_DOWN_VEL = Math.PI / 512;
    ZUMPO_FEELING_MAX_UP_NUM = 5;

    ZUMPO_NORMAL_COLOR = new Color(32, 32, 32);
    ZUMPO_MAX_COLOR = new Color(240, 32, 32);

    ZUNDAMOCHI_PATH = './img/zundamochi.png';
    ZUNDAMOCHI_SIZE = 1 / 2 * SCALE;

    constructor(elm) {
        this.engine = Engine.create();

        this.render = Render.create({
            element: elm,
            engine: this.engine,
            options: {
                width: WIDTH, height: HEIGHT,
                background: '#ffffff',
                showIds: false,
                showfixAnglecity: false,
                hasBounds: false,
                wireframes: false,
                showCollisions: false
            }
        });
        Render.run(this.render);

        this.runner = Runner.create();

        this.setMouse();

        this.makeZundamon();
        this.makeZumpo();

        this.zundamochiTime = 0;
        this.score = 0;

        for (let key in this.ZUNDAMON_PATH) {
            let img = new Image();
            img.src = this.ZUNDAMON_PATH[key];
        };

        Events.on(this.engine, 'afterUpdate', (function (event) {
            this.zundamochiTime += event.delta;

            if (this.zundamochiTime > 1000) {
                this.makeZundamochi(this.getZundamochiFirstPos());
                this.zundamochiTime = 0;
            }
        }).bind(this));

        this.updateScore();

        $('#result').hide();
        $('#explanation').hide();

        $('#tweet').on('click', () => {
            const score = this.score;
            if (score > 0) {
                var text = 'ずんぽを上下して' + score + '個ずんだもちを食べたのだ！！！\nみんなも挑戦してみるのだ！！\n';
            } else {
                var text = 'ずんぽではずんだもちを食べれなかったのだ……\nみんなも挑戦してみるのだ！！\n';
            }
            tweet(text);
        });

        $('#restart').on('click', () => {
            this.zumpoToNormal();
            this.updateScore();
            $('#result').hide();
        });

        $('#explanationButton').on('click', () => {
            $('#explanation').toggle();
        });

        this.setCollision();

        this.updateZumpoLength(2);

        Runner.run(this.runner, this.engine);
    }

    test() {
        let pos = Vector.create(150, 20);
        let body = Bodies.rectangle(
            pos.x, pos.y,
            50, 80,
            {
                label: 'Test',
                isStatic: true,
                render: {
                    strokeStyle: "#ffffff"
                }
            }
        );
        Composite.add(this.engine.world, body);

        Body.rotate(body, Math.PI / 12, Vector.create(140, 0));
    }

    updateScore() {
        $('#score').text('ずんだもち:' + this.score);
    }

    setCollision() {
        Events.on(this.engine, 'collisionStart', (function (event) {
            let pairs = event.pairs;
            pairs.forEach((function (pair) {
                if (pair.bodyA.label == 'Zundamon Head' && pair.bodyB.label == 'Zundamochi') {
                    Composite.remove(this.engine.world, pair.bodyB);
                    this.score += 1;
                    this.updateScore();
                }
            }).bind(this));
        }).bind(this));
    }

    setMouse() {
        this.mouse = Mouse.create(this.render.canvas);
        this.mouseCon = MouseConstraint.create(this.engine, {
            mouse: this.mouse,
            constraint: {
                stiffness: 0.2,
                render: { visible: false }
            }
        });
        Composite.add(this.engine.world, this.mouseCon);

        this.mousePos = { x: 0, y: 0 };
        this.beforeMousePos = null;
        this.mouseDeltaPos = { x: 0, y: 0 };

        Events.on(this.mouseCon, 'mousemove', (function (event) {
            if (this.beforeMousePos != null) {
                this.beforeMousePos = Vector.clone(this.mousePos);
            } else {
                this.beforeMousePos = Vector.clone(event.mouse.position);
            }

            this.mousePos = Vector.clone(event.mouse.position);
            this.mouseDeltaPos = Vector.sub(this.beforeMousePos, this.mousePos);
        }).bind(this));

        Events.on(this.mouseCon, 'mouseleave', (function (event) {
            this.beforeMousePos = null;
        }).bind(this));
    }

    zumpoToNormal() {
        this.zumpo.body.collisionFilter.mask = 0x0005;
        this.score = 0;
        this.zumpo.time = 0;
        this.zumpo.nae.flag = false;
        this.zumpo.feeling.flag = false;
        this.zumpo.normal.flag = true;
        this.zumpo.sitimulation = 0;
        Body.setStatic(this.zumpo.body, true);
        this.changeZundamonTexture(this.ZUNDAMON_PATH.normal);
    }

    zumpoToFeeling() {
        this.zumpo.body.collisionFilter.mask = 0x0001;
        this.zumpo.time = 0;
        this.zumpo.normal.flag = false;
        this.zumpo.feeling.flag = true;
        Body.setAngularVelocity(this.zumpo.body, 0);
        Body.setStatic(this.zumpo.body, false);
        this.changeZundamonTexture(this.ZUNDAMON_PATH.feeling);
    }

    zumpoToNae() {
        this.zumpo.body.collisionFilter.mask = 0x0005;
        this.zumpo.time = 0;
        this.zumpo.feeling.upNum = 0;
        this.zumpo.feeling.flag = false;
        this.zumpo.nae.flag = true;
        this.zumpo.normal.flag = false;
        this.changeZundamonTexture(this.ZUNDAMON_PATH.normal);
    }

    makeZundamon() {
        let img = new Image();
        img.src = this.ZUNDAMON_PATH.normal;

        let scale = this.ZUNDAMON_HEIGHT / img.height;

        let body = Bodies.rectangle(
            this.ZUNDAMON_ORIGIN.x, this.ZUNDAMON_ORIGIN.y,
            img.width * scale, this.ZUNDAMON_HEIGHT,
            {
                label: 'Zundamon Body',
                collisionFilter: {
                    category: 0x0000,
                    mask: 0x0004
                },
                isStatic: true,
                render: {
                    strokeStyle: "#ffffff",
                    sprite: {
                        texture: this.ZUNDAMON_PATH.normal,
                        xScale: scale,
                        yScale: scale,
                    }
                }
            }
        );

        try {
            var head = Bodies.circle(
                this.ZUNDAMON_ORIGIN.x, this.ZUNDAMON_ORIGIN.y - this.ZUNDAMON_HEIGHT * this.ZUNDAMON_SCALE / 2,
                img.width * scale * this.ZUNDAMON_SCALE / 2,
                {
                    label: 'Zundamon Head',
                    collisionFilter: {
                        category: 0x0002,
                        mask: 0x0004
                    },
                    restitution: 0.8,
                    isStatic: true,
                    render: {
                        fillStyle: '#00000000'
                    }
                }
            );
        } catch (error) {
            window.location.reload();
        }

        this.zundamon = {
            img: img,
            scale: scale,
            body: body,
            head: head
        }

        Composite.add(this.engine.world, this.zundamon.body);
        Composite.add(this.engine.world, this.zundamon.head);
        Body.scale(this.zundamon.body, this.ZUNDAMON_SCALE, this.ZUNDAMON_SCALE);
    }

    changeZundamonTexture(path) {
        if (this.zundamon.body.render.sprite.texture != path) {
            this.zundamon.body.render.sprite.texture = path;
        }
    }

    makeZumpo() {
        this.zumpo = {
            len: this.ZUMPO_MIN_LEN,
            targetAngle: 0,
            beforeVel: 0,
            sitimulation: 0,
            beforeScale: 1,
            damp: 0,
            time: 0,
            normal: {
                flag: true
            },
            feeling: {
                flag: false,
                upNum: 0
            },
            nae: {
                flag: false
            }
        };

        let pos = this.getZumpoPos();

        let body = Bodies.rectangle(
            pos.x, pos.y, this.ZUMPO_MIN_LEN, this.ZUMPO_TICKNESS,
            {
                label: 'Zunpo',
                collisionFilter: {
                    category: 0x0001,
                    mask: 0x0005
                },
                isStatic: true,
                render: {
                    fillStyle: this.ZUMPO_NORMAL_COLOR.string
                }
            }
        );

        console.log(this.ZUMPO_NORMAL_COLOR.string);

        let joint = Constraint.create({
            bodyA: this.zundamon.body,
            bodyB: body,
            pointA: { x: 0, y: pos.y - this.ZUNDAMON_ORIGIN.y },
            pointB: this.getZumpoJointPos(),
            render: {
                visible: false
            }
        });

        this.zumpo.body = body;
        this.zumpo.joint = joint;

        Composite.add(this.engine.world, this.zumpo.body);
        Composite.add(this.engine.world, this.zumpo.joint);

        Events.on(this.mouseCon, 'mousemove', (function (event) {
            if (this.zumpo.normal.flag) {
                this.updateZumpoAngle(this.mousePos);
                this.updateZumpoSitimulation(this.mouseDeltaPos);
            }
        }).bind(this));

        Events.on(this.engine, 'afterUpdate', (function (event) {
            this.fixZumpoAngle();
            this.zumpo.targetAngle = this.fixAngle(this.zumpo.targetAngle);

            this.zumpo.damp += this.ZUMPO_DAMP_ACC * this.runner.delta / 1000;
            this.zumpo.sitimulation -= this.zumpo.damp;
            this.fixZumpoSitimulation();

            if (this.zumpo.nae.flag) {
                this.zumpo.time += this.runner.delta / 1000;
            } else if (this.zumpo.feeling.flag) {
                this.zumpo.time += this.runner.delta / 1000;

                if (this.zumpo.time > this.ZUMPO_FEELING_UP_PERIOD && Math.random() < 0.1) {
                    this.zumpo.feeling.upNum += 1;
                    this.zumpo.damp = 0;
                    this.zumpo.sitimulation = this.ZUMPO_MAX_SITIMULATION;
                    this.zumpo.time = 0;
                    Body.setAngularVelocity(this.zumpo.body, this.ZUMPO_FEELING_UP_VEL);

                    if (this.zumpo.feeling.upNum >= this.ZUMPO_FEELING_MAX_UP_NUM) {
                        this.zumpoToNae();
                    }
                }
            } else if (this.zumpo.normal.flag) {
                if (this.zumpo.sitimulation > this.ZUMPO_MAX_SITIMULATION - 1) {
                    this.zumpo.time += this.runner.delta / 1000;
                    this.changeZundamonTexture(this.ZUNDAMON_PATH.danger);

                    if (this.zumpo.time > this.ZUMPO_MAX_HOLDING_TIME) {
                        this.zumpoToFeeling();
                        $('#result').show();
                    }
                } else {
                    this.zumpo.time = 0;
                    this.changeZundamonTexture(this.ZUNDAMON_PATH.normal);
                }
            }

            const scale = this.getZumpoScale();
            this.updateZumpoLength(scale);
            this.updateZumpoColor();
        }).bind(this));
    }

    makeZundamochi(pos) {
        let img = new Image();
        img.src = this.ZUNDAMOCHI_PATH;

        const scale = this.ZUNDAMOCHI_SIZE / img.width;

        const zundamochi = Bodies.circle(pos.x, pos.y, this.ZUNDAMOCHI_SIZE / 2, {
            label: 'Zundamochi',
            collisionFilter: {
                category: 0x0004,
                mask: 0x0007
            },
            restitution: 0.8,
            mass: 0,
            render: {
                sprite: {
                    texture: this.ZUNDAMOCHI_PATH,
                    xScale: scale,
                    yScale: scale,
                }
            }
        });

        Composite.add(this.engine.world, zundamochi);
    }

    updateZumpoLength(scale) {
        this.zumpo.len = this.ZUMPO_MIN_LEN * scale;
        let angle = this.zumpo.body.angle;

        Body.rotate(this.zumpo.body, -angle, Vector.add(this.ZUMPO_ORIGIN, this.ZUNDAMON_ORIGIN));
        Body.scale(this.zumpo.body, scale / this.zumpo.beforeScale, 1);
        Body.setPosition(this.zumpo.body, this.getZumpoPos());
        this.zumpo.joint.pointB = this.getZumpoJointPos();
        Body.rotate(this.zumpo.body, angle, Vector.add(this.ZUMPO_ORIGIN, this.ZUNDAMON_ORIGIN));

        this.zumpo.beforeScale = scale;
    }

    updateZumpoAngle(pos) {
        this.zumpo.targetAngle = this.getZumpoTargetAngle(pos);
        Body.rotate(this.zumpo.body, this.zumpo.targetAngle - this.zumpo.body.angle, Vector.add(this.ZUMPO_ORIGIN, this.ZUNDAMON_ORIGIN));
    }

    updateZumpoSitimulation(deltaPos) {
        const zumpoAnglePos = Vector.create(Math.cos(this.zumpo.body.angle), Math.sin(this.zumpo.body.angle));
        const vel = Vector.dot(zumpoAnglePos, deltaPos);
        const acc = vel - this.zumpo.beforeVel;

        if (acc * vel > 0) {
            this.zumpo.sitimulation += Math.min(Math.abs(acc) * 2 / SCALE, this.ZUMPO_MAX_DELTA_SITIMULATION);
        } else {
            this.zumpo.damp = 0;
        }

        this.fixZumpoSitimulation();

        this.zumpo.beforeVel = vel;
    }

    updateZumpoColor() {
        let ratio = 0;
        if (this.zumpo.feeling.flag) {
            ratio = this.zumpo.time / this.ZUMPO_FEELING_UP_PERIOD;
        } else if (this.zumpo.normal.flag) {
            ratio = this.zumpo.time / this.ZUMPO_MAX_HOLDING_TIME;
        }

        ratio = Math.min(ratio, 1);

        this.zumpo.body.render.fillStyle = Color.mix(this.ZUMPO_MAX_COLOR, this.ZUMPO_NORMAL_COLOR, ratio).string;
    }

    getZumpoPos() {
        const len = this.getZumpoLen();
        return Vector.create(
            this.ZUMPO_ORIGIN.x + this.ZUNDAMON_ORIGIN.x + len,
            this.ZUMPO_ORIGIN.y + this.ZUNDAMON_ORIGIN.y
        );
    }

    getZumpoJointPos() {
        const len = this.getZumpoLen();
        return Vector.create(
            -len, 0
        );
    }

    getZumpoLen() {
        return (this.zumpo.len - this.ZUMPO_TICKNESS) / 2;
    }

    getZumpoTargetAngle(pos) {
        return Vector.angle(Vector.add(this.ZUMPO_ORIGIN, this.ZUNDAMON_ORIGIN), pos);
    }

    getZumpoScale() {
        return this.zumpo.sitimulation + 1;
    }

    fixZumpoSitimulation() {
        if (this.zumpo.sitimulation < 0) {
            this.zumpo.sitimulation = 0;
        } else if (this.zumpo.sitimulation > this.ZUMPO_MAX_SITIMULATION) {
            this.zumpo.sitimulation = this.ZUMPO_MAX_SITIMULATION;
        }
    }

    fixAngle(angle) {
        if (angle > Math.PI / 4) {
            return Math.PI / 4;
        } else if (angle < -Math.PI / 4) {
            return -Math.PI / 4;
        }

        return angle;
    }

    fixAngularVelocity(angularVelocity) {
        if (angularVelocity > this.ZUMPO_FEELING_DOWN_VEL) {
            return this.ZUMPO_FEELING_DOWN_VEL;
        }

        return angularVelocity;
    }

    fixZumpoAngle() {
        const angle = this.zumpo.body.angle;
        const fixedAngle = this.fixAngle(angle);
        if (angle != fixedAngle) {
            Body.rotate(this.zumpo.body, fixedAngle - angle, Vector.add(this.ZUMPO_ORIGIN, this.ZUNDAMON_ORIGIN));
            if ((fixedAngle - angle) * this.zumpo.body.angularVelocity < 0) {
                Body.setAngularVelocity(this.zumpo.body, 0);
            }
        }

        if (this.zumpo.feeling.flag) {
            const angularVelocity = this.zumpo.body.angularVelocity;
            const fixedAngularVelocity = this.fixAngularVelocity(angularVelocity);
            if (angularVelocity != fixedAngularVelocity) {
                Body.setAngularVelocity(this.zumpo.body, fixedAngularVelocity);
            }
        }
    }

    getZundamochiFirstPos() {
        return Vector.create((1 + Math.random()) * WIDTH / 2, -this.ZUNDAMOCHI_SIZE);
    }
}

class Color {
    constructor(r, g, b, a = 255) {
        this.r = r;
        this.g = g;
        this.b = b;
        this.a = a;
        this.string = this.toString();
    }

    static mix(color1, color2, ratio) {
        return new Color(
            color1.r * ratio + color2.r * (1 - ratio),
            color1.g * ratio + color2.g * (1 - ratio),
            color1.b * ratio + color2.b * (1 - ratio),
            color1.a * ratio + color2.a * (1 - ratio)
        );
    }

    toString() {
        return Color.toString(this.r, this.g, this.b, this.a);
    }

    static toString(r, g, b, a) {
        return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
    }
}

function tweet(text) {
    const this_url = document.location.href;
    const tweet_url = 'http://twitter.com/intent/tweet?url=' + encodeURIComponent(this_url) + '&text=' + encodeURIComponent(text);
    window.open(tweet_url);
}