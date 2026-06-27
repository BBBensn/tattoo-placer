import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';

export function initScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a2e);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100);
  camera.position.set(0, 0.9, 2.8);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 0.9, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 0.5;
  controls.maxDistance = 8;

  const ambient = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0xfff5e0, 1.4);
  key.position.set(1.5, 3, 2);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x8899ff, 0.4);
  fill.position.set(-2, 1, -1);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xffffff, 0.3);
  rim.position.set(0, 2, -3);
  scene.add(rim);

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  (function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  })();

  return { renderer, scene, camera, controls };
}

export function loadBodyMesh(scene) {
  return new Promise((resolve, reject) => {
    new GLTFLoader().load('assets/body.glb', (gltf) => {
      const model = gltf.scene;
      let bodyMesh = null;

      model.traverse((child) => {
        if (child.isMesh && !bodyMesh) {
          bodyMesh = child;
          child.material = new THREE.MeshStandardMaterial({
            color: 0xc4956a,
            roughness: 0.75,
            metalness: 0.0,
          });
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      if (!bodyMesh) { reject(new Error('No mesh found in body.glb')); return; }

      const box = new THREE.Box3().setFromObject(model);
      const height = box.max.y - box.min.y;
      model.scale.setScalar(1.76 / height);

      box.setFromObject(model);
      model.position.y = -box.min.y;

      scene.add(model);
      model.updateMatrixWorld(true);

      resolve(bodyMesh);
    }, undefined, reject);
  });
}

export function buildDecalMesh(bodyMesh, spec, texture) {
  const pos = new THREE.Vector3(...spec.position);
  const norm = new THREE.Vector3(...spec.normal);

  const helper = new THREE.Object3D();
  helper.position.copy(pos);
  helper.lookAt(pos.clone().add(norm));
  helper.rotation.z += spec.rotation;

  const s = spec.size;
  const geom = new DecalGeometry(bodyMesh, pos, helper.rotation, new THREE.Vector3(s, s, s * 0.5));

  const mat = new THREE.MeshStandardMaterial({
    map: texture,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });

  return new THREE.Mesh(geom, mat);
}

export function createTexture(url) {
  return new THREE.TextureLoader().load(url);
}

export function raycastBody(event, camera, renderer, bodyMesh) {
  const rect = renderer.domElement.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
  const hits = raycaster.intersectObject(bodyMesh, false);
  return hits.length > 0 ? hits[0] : null;
}
