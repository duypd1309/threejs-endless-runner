import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export class BasicCharacterController {
  constructor(params) {
    this._init(params);
  }

  _init(params) {
    this._params = params;
    this._animations = {};
    this._input = new BasicCharacterControllerInput();
    this._stateMachine = new CharacterFSM(this._animations);

    this._loadModel("sonic");
  }

  getModel() {
    return this._model;
  }

  getBoundingBox() {
    var bbox = new THREE.Box3().setFromObject( this._model );
    if (this._stateMachine._currentState instanceof BallState)
      bbox.set(bbox.min, bbox.max.divide(new THREE.Vector3(1., 1.5, 1.)));
    return bbox;
  }

  getAnimations() {
    return this._animations;
  }

  _loadModel(modelName) {
    this._manager = new THREE.LoadingManager();
    this._manager.onLoad = () => {
      this._stateMachine.setState("run");
    };

    const loader = new GLTFLoader(this._manager);
    loader.setPath("../resources/models/");
    loader.load(modelName + "/scene.gltf", (gltf) => {
      // model
      this._model = gltf.scene;
      this._model.traverse(function (object) {
        if (object.isMesh) {
          // cast shadow
          object.castShadow = true;
        } 
      });
      this._model.rotateY(Math.PI);
      this._params.scene.add(this._model);

      // animations
      this._animName = ["run", "boost", "ball", "jump"];
      this._mixer = new THREE.AnimationMixer(this._model);
      for (let i = 0; i < 5; i++) {
        const clip = gltf.animations[i];
        const action = this._mixer.clipAction(clip);

        this._animations[this._animName[i]] = {
          clip: clip,
          action: action,
        };
      }
    });
  }

  update(timeInSeconds) {
    if (!this._model) {
      return;
    }

    this._stateMachine.update(timeInSeconds, this._input);

    if (this._mixer) {
      this._mixer.update(timeInSeconds);
    }

    TWEEN.update();
  }
}

class BasicCharacterControllerInput {
  constructor() {
    this._init();
  }

  _init() {
    this._keys = {
      left: false,
      up: false,
      right: false,
      down: false,
    };
    document.addEventListener("keydown", (e) => this._onKeyDown(e));
    document.addEventListener("keyup", (e) => this._onKeyUp(e));
  }

  _onKeyDown(event) {
    switch (event.keyCode) {
      case 37: // LEFT
        this._keys.left = true;
        break;
      case 38: // UP
        this._keys.up = true;
        break;
      case 39: // RIGHT
        this._keys.right = true;
        break;
      case 40: // DOWN
        this._keys.down = true;
        break;
    }
  }

  _onKeyUp(event) {
    switch (event.keyCode) {
      case 37: // LEFT
        this._keys.left = false;
        break;
      case 38: // UP
        this._keys.up = false;
        break;
      case 39: // RIGHT
        this._keys.right = false;
        break;
      case 40: // DOWN
        this._keys.down = false;
        break;
    }
  }
}
class FiniteStateMachine {
  constructor() {
    this._states = {};
    this._currentState = null;
  }

  _addState(name, type) {
    this._states[name] = type;
  }

  setState(name) {
    const prevState = this._currentState;

    if (prevState) {
      if (prevState.Name == name) {
        return;
      }
      prevState.exit();
    }

    const state = new this._states[name](this);

    this._currentState = state;
    state.enter(prevState);
  }

  update(timeElapsed, input) {
    if (this._currentState) {
      this._currentState.update(timeElapsed, input);
    }
  }
}

class CharacterFSM extends FiniteStateMachine {
  constructor(animations) {
    super();
    this._animations = animations;
    this._init();
  }

  _init() {
    this._addState("run", RunState);
    this._addState("boost", BoostState);
    this._addState("ball", BallState);
    this._addState("jump", JumpState);
  }
}

class State {
  constructor(stateMachine) {
    this._stateMachine = stateMachine;
  }

  enter() {}
  exit() {}
  update() {}
}

class RunState extends State {
  constructor(stateMachine) {
    super(stateMachine);

    // Get model.
    this._model = this._stateMachine._animations["run"].action.getMixer().getRoot();

    // To control move left and right input.
    this._enableInput = true;
  }

  get Name() {
    return "run";
  }

  enter(prevState) {
    const curAction = this._stateMachine._animations["run"].action;

    if (prevState) {
      const prevAction = this._stateMachine._animations[prevState.Name].action;
      curAction.reset();
      curAction.crossFadeFrom(prevAction, 0, true);
      curAction.play();
    } else {
      curAction.play();
    }
  }

  exit() {}

  update(timeElapsed, input) {
    if (input._keys.left) {
      if (this._model.position.x > -3  && this._enableInput) {
        this._enableInput = false;
        var tweenMoveLeft = new TWEEN.Tween(this._model.position).to({ x: '-3'}, 200);
        tweenMoveLeft.onComplete(() => {
          this._enableInput = true;
        });
        tweenMoveLeft.start();
        }
    }
    else if (input._keys.right) {
      if (this._model.position.x < 3 && this._enableInput) {
        this._enableInput = false;
        var tweenMoveRight = new TWEEN.Tween(this._model.position).to({ x: '+3'}, 200);
        tweenMoveRight.onComplete(() => {
          this._enableInput = true;
        });
        tweenMoveRight.start();
      }
    }
    else if (input._keys.up) this._stateMachine.setState("jump");
    else if (input._keys.down) this._stateMachine.setState("ball");
  }
}

class BoostState extends State {
  constructor(stateMachine) {
    super(stateMachine);
  }

  get Name() {
    return "boost";
  }

  enter(prevState) {
    const curAction = this._stateMachine._animations["boost"].action;
    curAction.play();
  }

  exit() {}

  update() {}
}

class JumpState extends State {
  constructor(stateMachine) {
    super(stateMachine);
  }

  get Name() {
    return "jump";
  }

  enter(prevState) {
    const curAction = this._stateMachine._animations["jump"].action;

    if (prevState) {
      const prevAction = this._stateMachine._animations[prevState.Name].action;
      curAction.reset();
      curAction.crossFadeFrom(prevAction, 0.1, true);
      curAction.play();
    } else {
      curAction.play();
    }

    const model = curAction.getMixer().getRoot();
    const tweenJump = new TWEEN.Tween(model.position)
      .to({ y: 3 }, 300)
      .easing(TWEEN.Easing.Quadratic.Out);
    const tweenFall = new TWEEN.Tween(model.position)
      .to({ y: 0 }, 250)
      .easing(TWEEN.Easing.Quadratic.In);
    tweenJump.chain(tweenFall);
    tweenFall.onComplete(() => {
      this._stateMachine.setState("run");
    });
    tweenJump.start();
  }

  exit() {}

  update(timeElapsed, input) {}
}

class BallState extends State {
  constructor(stateMachine) {
    super(stateMachine);
  }

  get Name() {
    return "ball";
  }

  enter(prevState) {
    const curAction = this._stateMachine._animations["ball"].action;

    if (prevState) {
      const prevAction = this._stateMachine._animations[prevState.Name].action;
      curAction.reset();
      curAction.crossFadeFrom(prevAction, 0.1);
      curAction.setEffectiveTimeScale(0.5);
      curAction.play();
    } else {
      curAction.play();
    }
  }

  exit() {}

  update(timeElapsed, input) {
    if (!input._keys.down) this._stateMachine.setState("run");
  }
}
