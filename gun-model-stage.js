import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function makeOption(value, label) {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = label;
  return option;
}

export function createGunViewport(stage) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  stage.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, .005, 100);
  const viewmodelCamera = new THREE.PerspectiveCamera(63, 1, .008, 30);
  let viewpoint;
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  function draw() {
    if (!viewpoint) return renderer.render(scene, camera);
    viewpoint.getWorldPosition(viewmodelCamera.position);
    viewpoint.getWorldQuaternion(viewmodelCamera.quaternion);
    viewmodelCamera.translateZ(.06);
    viewmodelCamera.rotateX(-Math.PI / 18);
    renderer.render(scene, viewmodelCamera);
  }
  controls.addEventListener('change', draw);
  scene.add(new THREE.HemisphereLight(0xe2eeff, 0x69635c, 2.55));
  const key = new THREE.DirectionalLight(0xffeddd, 2.25);
  key.position.set(4, 4, 2);
  const fill = new THREE.DirectionalLight(0xd9e6ff, 1.8);
  fill.position.set(-4, 1, -2);
  scene.add(key, fill);

  function sizeViewport() {
    if (!stage.clientWidth || !stage.clientHeight) return;
    const aspect = stage.clientWidth / stage.clientHeight;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    viewmodelCamera.aspect = aspect;
    viewmodelCamera.updateProjectionMatrix();
    renderer.setSize(stage.clientWidth, stage.clientHeight, false);
    draw();
  }
  const observer = new ResizeObserver(sizeViewport);
  observer.observe(stage);
  sizeViewport();

  function fit(model, motion = false) {
    if (!model) return;
    model.updateWorldMatrix(true, true);
    const bounds = new THREE.Box3();
    model.traverseVisible(node => {
      if (!node.isMesh) return;
      if (node.isSkinnedMesh || node.isInstancedMesh) {
        node.computeBoundingBox();
        bounds.union(node.boundingBox.clone().applyMatrix4(node.matrixWorld));
      } else {
        node.geometry.computeBoundingBox();
        bounds.union(node.geometry.boundingBox.clone().applyMatrix4(node.matrixWorld));
      }
    });
    if (bounds.isEmpty()) return;
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z, .05);
    const spread = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const motionDistance = motion ? size.length() * .71 / (spread * Math.min(1, camera.aspect)) : 0;
    const distance = Math.max(radius * 1.12, size.x * .67 / (spread * camera.aspect),
      (size.y + size.z * .27) * .65 / spread, motionDistance);
    controls.target.copy(center);
    camera.position.copy(center).add(new THREE.Vector3(distance * -.28, distance * .26, distance));
    camera.near = radius / 400;
    camera.far = distance + radius * 6;
    camera.updateProjectionMatrix();
    controls.minDistance = radius * .32;
    controls.maxDistance = Math.max(radius * 5, distance * 1.2);
    controls.update();
    draw();
  }

  return {
    scene, draw, fit,
    setViewpoint(node) {
      viewpoint = node;
      controls.enabled = !node;
      renderer.domElement.classList.toggle('gun-first-person', Boolean(node));
      draw();
    },
    dispose() {
      observer.disconnect();
      controls.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    }
  };
}
