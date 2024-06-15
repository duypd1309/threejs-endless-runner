import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { BasicCharacterController } from './character-manager.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

var scene;
var camera;
var renderer;
var controls;
var clock;
var charControls;
var ground;
var objectsParent;
var reflectionCube;
var reqAnimationFrameID;
var score = 0;
var highScore = 0;
var isPlaying = true;

const FPS = 60;
const NUM_OF_OBJECTS = 10; // number of initialized objects
const OBJECTS_DISTANCE_OFFSET = 50;
const CHARACTER_MOTION_SPEED = 2;
const GROUND_SPEED = 1.5;
const OBJECTS_SPEED = 60;

function init() {
  // the 3d scene
  scene = new THREE.Scene();

  // cubemap and background
  var path = '../resources/textures/cubes/landscape/';
  var format = '.png';
  var urls = [
    path + 'px' + format, path + 'nx' + format,
    path + 'py' + format, path + 'ny' + format,
    path + 'pz' + format, path + 'nz' + format
  ]

  reflectionCube = new THREE.CubeTextureLoader().load(urls);
  reflectionCube.format = THREE.RGBAFormat;

  scene.background = reflectionCube;

  // camera
  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth/window.innerHeight,
    0.1,
    1000
  );

  camera.position.set(0, 4.5, 9);
  camera.lookAt(new THREE.Vector3(0, 0, 0));
  
  // renderer
  renderer = new THREE.WebGLRenderer({
    antialias: true
  });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setSize( window.innerWidth, window.innerHeight );
  document.getElementById('webgl').appendChild( renderer.domElement );

  // clock
  clock = new THREE.Clock();

  //orbit controls
  // controls = new OrbitControls( camera, renderer.domElement );

  // lights
  var directionalLight = getDirectionalLight();
  directionalLight.position.set(10, 15, 7.5);

  var ambientLight = new THREE.AmbientLight(0xffffff, 1.5);

  // ground
  ground = getPlane(12, 400, 1, 1);
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = (-ground.geometry.parameters.height / 2) + 30;

  // objects
  objectsParent = new THREE.Group();
  objectsParent.position.z = -200;
  spawnObjects();

  // Load 3d model.
  var params = {
    camera: camera,
    scene: scene,
  };
  charControls = new BasicCharacterController(params);

  // gui
  // var gui = new dat.GUI();

  //  Display score.
  document.getElementById('score').innerHTML = ' x ' + score;

  // restart button
  document.getElementById('restart').addEventListener('click', restart);

  // Add everything to scene.
  scene.add(directionalLight);
  scene.add(ambientLight);
  scene.add(ground);
  scene.add(objectsParent);

  // Add enemy model.
  addEnemyModel();
  
  // const shadowHelper = new THREE.CameraHelper(directionalLight.shadow.camera);
  // scene.add(shadowHelper);

  update();
}

function spawnObjects() {
  // Initialize objects in different z positions.
  // Generate some rings at the beginning of the game.
  for (let i = 0; i < 3; i++) {
    loadRingObject(i);
  }

  // Generate random.
  var objects = ['ring', 'box', 'sphere', 'bomb'];
  for (let i = 3 ; i < NUM_OF_OBJECTS; i++) {
    // Pick a random obstacle.
    var randomObject = objects[Math.floor(Math.random()*objects.length)];
    if (randomObject == 'ring') {
      loadRingObject(i);
    }
    else if (randomObject == 'box') {
      loadBoxObject(i);
    }
    else if (randomObject == 'sphere') {
      loadSphereObject(i);
    }
    else if (randomObject == 'bomb') {
      loadBombObject(i);
    }
  }
}

function checkCollisions() {
  objectsParent.traverse((child) => {
    if (child.userData.type == 'bonus' || child.userData.type == 'obstacle' ) {
      // pos in world space
      var childZPos = child.position.z + objectsParent.position.z;

      if (charControls.getModel()) {
        var characterBB = charControls.getBoundingBox();
        var objBB = new THREE.Box3().setFromObject(child);
        if (characterBB.intersectsBox(objBB)) { 
          if (child.userData.type == 'bonus') {
            score += 1;
            // Update score in html.
            document.getElementById("score").innerHTML = " x " + score; 
            // Respawn ring.
            var lastChildZPos = getCurrentLastChildZPosition();
            setUpObject(child, -(child.userData.zIndex*OBJECTS_DISTANCE_OFFSET) + lastChildZPos);
          }
          else if (child.userData.type == 'obstacle') {
            isPlaying = false
            cancelAnimationFrame(reqAnimationFrameID);
            if (score > highScore)
              highScore = score;
            var resultString = `Your score: ${score}\nHigh score: ${highScore}\nClick restart button to try again.`;
          }
        }
      }
    }
  });
}

function setUpObject(obj, refZPos=0) {
  var xPos = [-3, 0, 3];
  obj.position.x = xPos[Math.floor(Math.random()*xPos.length)];
  obj.position.z = refZPos - getRandomFloat(20, 30);
  objectsParent.add(obj);
}

function getCurrentLastChildZPosition() {
  var lastChildZPos;
  objectsParent.traverse((child) => {
    if ((child.userData.type == 'bonus' || child.userData.type == 'obstacle') && (child.userData.zIndex == NUM_OF_OBJECTS - 1)) {
      lastChildZPos = child.position.z;
    }
  });
  return lastChildZPos;
}

function loadRingObject(zIndex) {
  var loader = new GLTFLoader();
  loader.setPath("../resources/models/ring/");
  loader.load("scene.gltf", (gltf) => {
    var ringObject = gltf.scene;
    ringObject.traverse(function (object) { 
      if (object.isMesh) {
        object.castShadow = true;
        object.material.envMap = reflectionCube;
      } 
    });
    ringObject.userData = {
      name: 'ring',
      type: 'bonus',
      zIndex: zIndex
    };
    ringObject.position.y = 1.2;
    ringObject.scale.set(0.7, 0.7, 0.7);
    ringObject.rotation.y = Math.PI / 4;
    setUpObject(ringObject, -(zIndex*OBJECTS_DISTANCE_OFFSET));
  });
}

function loadBombObject(zIndex) {
  var loader = new GLTFLoader();
  loader.setPath("../resources/models/bomb/");
  loader.load("scene.gltf", (gltf) => {
    var bombObject = gltf.scene;
    bombObject.traverse(function (object) { 
      if (object.isMesh) {
        object.castShadow = true;
        object.material.envMap = reflectionCube;
      } 
    });
    bombObject.userData = {
      name: 'bomb',
      type: 'obstacle',
      zIndex: zIndex
    };
    bombObject.position.y = 3.5;
    bombObject.scale.set(0.7, 0.7, 0.7);
    setUpObject(bombObject, -(zIndex*OBJECTS_DISTANCE_OFFSET));
  });
}

function loadBoxObject(zIndex) {
  var geometry = new THREE.BoxGeometry( 1, 1, 1 ); 
  var material = new THREE.MeshPhongMaterial({
    map: new THREE.TextureLoader().load('../resources/textures/wood.jpg')
  }); 
  var box = new THREE.Mesh( geometry, material );

  box.scale.set(2, 2, 2);
  box.position.y = box.scale.y * 0.5;
  box.castShadow = true;

  box.userData = {
    name: 'box',
    type: 'obstacle',
    zIndex: zIndex,
  };

  setUpObject(box, -(zIndex*OBJECTS_DISTANCE_OFFSET));
}

function loadSphereObject(zIndex) {
  var geometry = new THREE.SphereGeometry(0.8, 24, 24);
  var material = new THREE.MeshPhysicalMaterial({
    roughness: 0,
    metalness: 0.5,
    envMap: reflectionCube,
    transmission: 1,
    ior: 2.33,
  });

  var sphere = new THREE.Mesh(geometry, material);
  sphere.position.y = sphere.geometry.parameters.radius;
  sphere.castShadow = true;

  sphere.userData = {
    name: 'sphere',
    type: 'obstacle',
    zIndex: zIndex,
  };

  setUpObject(sphere, -(zIndex*OBJECTS_DISTANCE_OFFSET));
}

function getPlane(width, height, widthSegments, heightSegments) {
  var geometry = new THREE.PlaneGeometry(width, height, widthSegments, heightSegments);

  var material = new THREE.ShaderMaterial({
    uniforms: {
        ...THREE.UniformsLib.lights,
        time: {
          value: 0
        },
        image: {
          type: 't',
          value: new THREE.TextureLoader().load('./resources/textures/texture-grass-field.jpg')
        },
        textureRepeat: {
          value: [3, 40]
        }
      },
    vertexShader: `
      #include <common>
      #include <shadowmap_pars_vertex>

      varying vec2 vUv; 
    
      void main() {
        #include <beginnormal_vertex>
        #include <defaultnormal_vertex>

        #include <begin_vertex>

        #include <worldpos_vertex>
        #include <shadowmap_vertex>

        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      #include <common>
      #include <packing>
      #include <lights_pars_begin>
      #include <shadowmap_pars_fragment>
      #include <shadowmask_pars_fragment>

      uniform float time;
      uniform sampler2D image;
      uniform vec2 textureRepeat;

      varying vec2 vUv;

      void main() {
        vec3 finalColor = vec3(0, 0.75, 0);
        vec3 shadowColor = vec3(0, 0, 0);
        float shadowPower = 1.;

        vec2 uv = vUv;
        uv = fract(uv * textureRepeat);
        uv.y = uv.y + time;
        if (uv.y > 1.)
          uv.y = uv.y - 1.;
        vec4 texture = texture2D(image, uv);
        vec3 texture_rgb = vec3(texture.r, texture.g, texture.b);
        gl_FragColor = vec4(texture_rgb * mix(finalColor, shadowColor, (1.0 - getShadowMask()) * shadowPower), 1.);
      }
    `,
    lights: true,
  });

  var plane = new THREE.Mesh(geometry, material);
  plane.receiveShadow = true;

  return plane;
}

function addEnemyModel() {
  var loader = new GLTFLoader();
  loader.setPath("../resources/models/eggmobile/");
  loader.load("scene.gltf", (gltf) => {
    var enemyModel = gltf.scene;
    enemyModel.traverse(function (object) { 
      if (object.isMesh) {
        object.material.envMap = reflectionCube;
      } 
    });
    enemyModel.position.y = -2;
    enemyModel.position.z = -350;
    enemyModel.scale.set(1.2, 1.2, 1.2);
    enemyModel.rotation.y = -Math.PI / 5;
    scene.add(enemyModel);
  });
}

function getDirectionalLight(intensity=1, color=0xffffff) {
    var light = new THREE.DirectionalLight(color, intensity);
    
    // shadow properties
    light.castShadow = true;

    light.shadow.bias = 0.001;

    light.shadow.mapSize.width = 512;
    light.shadow.mapSize.height = 512;

    light.shadow.camera.left = -200;
    light.shadow.camera.bottom = -200;
    light.shadow.camera.right = 200;
    light.shadow.camera.top = 200;
    
    return light;
}

function getRandomFloat(min, max) {
  return Math.random() * (max - min) + min;
}

function restart() {
  document.getElementById('restart').removeEventListener('click', restart);
  score = 0;
  document.getElementById('score').innerHTML = ' x ' + score;
  charControls.getModel().position.x = 0;
  objectsParent.clear();

  if (!isPlaying) {
    isPlaying = true;
    update();
  }

  spawnObjects();
  objectsParent.position.z = -200;

  setTimeout(() => {
    document.getElementById('restart').addEventListener('click', restart);
  }, 2500);
}

function update() {
  var dt = clock.getDelta();

  ground.material.uniforms.time.value += dt*GROUND_SPEED;
  while (ground.material.uniforms.time.value > 1.)
    ground.material.uniforms.time.value -= 1.;
  
  charControls.update(dt * CHARACTER_MOTION_SPEED);

  // controls.update();

  objectsParent.position.z += dt*OBJECTS_SPEED;

  objectsParent.traverse((child) => {
    if (child.userData.type == 'bonus' || child.userData.type == 'obstacle') {
      // animations
      if (child.userData.name == 'bomb') {
        child.rotation.x += dt*10;
      }

      if (child.userData.name == 'ring') {
        child.rotation.y += dt*2;
      }

      // pos in world space
      var childZPos = child.position.z + objectsParent.position.z;
      if (childZPos > 10) {
        // Respawn objects.
        var lastChildZPos = getCurrentLastChildZPosition();
        setUpObject(child, -(child.userData.zIndex*OBJECTS_DISTANCE_OFFSET) + lastChildZPos);
      }
    }
  });

  checkCollisions();

  renderer.render(scene, camera);
  
  if (isPlaying)
    setTimeout(() => {
      reqAnimationFrameID = requestAnimationFrame(update);
    }, 1000/FPS); 
}

init();

