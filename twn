// script.js
// Single-module entry: loads shared header/footer, UI interactions, and mounts Three.js chair viewer.
// Adds an automatic wrapper-centering routine that ensures equal left/right and top/bottom margins
// by projecting the model's bounding box to screen space and nudging the wrapper accordingly.

import * as THREE from 'https://unpkg.com/three@0.126.1/build/three.module.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.126.1/examples/jsm/loaders/GLTFLoader.js';

/* -----------------------------
   Shared includes + utilities
   ----------------------------- */

function loadSharedPart(id, file) {
  fetch(file)
    .then(res => {
      if (!res.ok) throw new Error(`Failed to fetch ${file}: ${res.status}`);
      return res.text();
    })
    .then(html => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = html;
    })
    .catch(err => console.error(`Error loading ${file}:`, err));
}

function updateProductImage(imgId, newSrc) {
  const imgElement = document.getElementById(imgId);
  if (imgElement) imgElement.src = newSrc;
}

/* -----------------------------
   Three.js viewer variables
   ----------------------------- */

let renderer, scene, camera;
let modelRoot = null;
let wrapper = null;        // wrapper Object3D placed at bottom-center pivot
let debugFrame = null;
let pivotDot = null;
let visualCenter = null;   // bounding-box center (world space) used for centering
let containerEl = null;

// Default wrapper nudge fractions (fractions of view width/height)
let wrapperAdjust = {
  shiftFractionX: 0.10,
  shiftFractionY: -0.04
};
window._wrapperAdjust = wrapperAdjust;

/* -----------------------------
   Helpers
   ----------------------------- */

function resizeRendererToContainer() {
  if (!containerEl || !renderer || !camera) return;
  const w = Math.max(1, containerEl.clientWidth);
  const h = Math.max(1, containerEl.clientHeight);
  const pr = renderer.getPixelRatio();
  if (renderer.domElement.width !== Math.floor(w * pr) || renderer.domElement.height !== Math.floor(h * pr)) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
}

/**
 * Project a world-space Vector3 to normalized device coordinates (NDC).
 * Returns a Vector3 where x,y in [-1,1], z is depth.
 */
function worldToNDC(vecWorld, cam) {
  const ndc = vecWorld.clone().project(cam);
  return ndc;
}

/**
 * Compute the 8 corners of a Box3 in world space.
 * Returns array of Vector3.
 */
function box3Corners(box) {
  const min = box.min;
  const max = box.max;
  return [
    new THREE.Vector3(min.x, min.y, min.z),
    new THREE.Vector3(min.x, min.y, max.z),
    new THREE.Vector3(min.x, max.y, min.z),
    new THREE.Vector3(min.x, max.y, max.z),
    new THREE.Vector3(max.x, min.y, min.z),
    new THREE.Vector3(max.x, min.y, max.z),
    new THREE.Vector3(max.x, max.y, min.z),
    new THREE.Vector3(max.x, max.y, max.z)
  ];
}

/**
 * Convert an NDC x or y value to world-space offset at a given distance from camera.
 * ndcX in [-1,1] -> world offset along camera right vector = ndcX * (viewWidth/2)
 * ndcY in [-1,1] -> world offset along camera up vector = ndcY * (viewHeight/2)
 */
function ndcToWorldOffset(ndcX, ndcY, cam, distance, container) {
  const fovRad = THREE.Math.degToRad(cam.fov);
  const viewHeight = 2 * Math.tan(fovRad / 2) * distance;
  const viewWidth = viewHeight * (container.clientWidth / container.clientHeight);
  const camDir = new THREE.Vector3(); cam.getWorldDirection(camDir);
  const camUp = cam.up.clone().normalize();
  const camRight = new THREE.Vector3().crossVectors(camDir, camUp).normalize();

  const worldOffset = new THREE.Vector3();
  worldOffset.addScaledVector(camRight, ndcX * (viewWidth / 2));
  worldOffset.addScaledVector(camUp, ndcY * (viewHeight / 2));
  return worldOffset;
}

/* -----------------------------
   Auto-centering routine
   ----------------------------- */

/**
 * autoCenterWrapper:
 * - Projects the model's bounding box corners to NDC (screen space).
 * - Computes left/right/top/bottom extents in NDC.
 * - Calculates the pixel (or NDC) offsets needed to make left/right margins equal and top/bottom margins equal.
 * - Converts those offsets into world-space and moves the wrapper accordingly.
 *
 * Options:
 *  - paddingFraction: fraction of view (0..0.5) to leave as padding on each side (optional)
 *  - applyManual: optional manual additional shift in fractions {x, y} (positive x moves model left, positive y moves model up)
 */
function autoCenterWrapper({ paddingFraction = 0.0, applyManual = { x: 0, y: 0 } } = {}) {
  if (!wrapper || !modelRoot || !camera || !containerEl || !visualCenter) {
    console.warn('autoCenterWrapper: required objects not ready.');
    return;
  }

  // Compute world-space bounding box of the wrapper (which contains the model)
  const box = new THREE.Box3().setFromObject(wrapper);
  if (!box.isEmpty()) {
    // Get the 8 corners in world space
    const corners = box3Corners(box);

    // Project corners to NDC
    const ndcs = corners.map(c => worldToNDC(c, camera));

    // Compute min/max in NDC space (x and y)
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    ndcs.forEach(n => {
      if (n.x < minX) minX = n.x;
      if (n.x > maxX) maxX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.y > maxY) maxY = n.y;
    });

    // Apply padding fraction by shrinking the allowed extents
    // paddingFraction is fraction of view width/height to leave as margin on each side
    // We convert paddingFraction to NDC units: paddingNDC = paddingFraction * 2 (since NDC spans 2 units)
    const paddingNDCx = paddingFraction * 2;
    const paddingNDCy = paddingFraction * 2;

    // Compute current center in NDC of the projected bbox
    const bboxCenterNDCx = (minX + maxX) / 2;
    const bboxCenterNDCy = (minY + maxY) / 2;

    // Desired center is (0,0) in NDC, but we can also bias it by padding (we'll keep centered)
    const desiredCenterNDCx = 0;
    const desiredCenterNDCy = 0;

    // Compute delta in NDC to move bbox center to desired center
    const deltaNDCx = desiredCenterNDCx - bboxCenterNDCx;
    const deltaNDCy = desiredCenterNDCy - bboxCenterNDCy;

    // Convert NDC delta to world offset at the distance of the visual center
    const camToCenterDist = camera.position.distanceTo(visualCenter);
    const worldOffsetFromCenter = ndcToWorldOffset(deltaNDCx, deltaNDCy, camera, camToCenterDist, containerEl);

    // Apply the computed offset to wrapper (move wrapper so model shifts on screen)
    wrapper.position.add(worldOffsetFromCenter);

    // Now compute additional manual adjustments (fractions of view)
    // applyManual.x positive -> move model left (we move wrapper along -camRight)
    // applyManual.y positive -> move model up (we move wrapper along +camUp)
    if (applyManual && (applyManual.x !== 0 || applyManual.y !== 0)) {
      const fovRad = THREE.Math.degToRad(camera.fov);
      const viewHeight = 2 * Math.tan(fovRad / 2) * camToCenterDist;
      const viewWidth = viewHeight * (containerEl.clientWidth / containerEl.clientHeight);
      const camDir = new THREE.Vector3(); camera.getWorldDirection(camDir);
      const camUp = camera.up.clone().normalize();
      const camRight = new THREE.Vector3().crossVectors(camDir, camUp).normalize();

      const manualRightOffset = viewWidth * applyManual.x;
      const manualUpOffset = viewHeight * applyManual.y;

      wrapper.position.addScaledVector(camRight, -manualRightOffset);
      wrapper.position.addScaledVector(camUp, manualUpOffset);
    }

    // Update debug helpers if present
    if (debugFrame) {
      const camWorld = camera.getWorldPosition(new THREE.Vector3());
      const dist = camWorld.distanceTo(visualCenter);
      const fovRad = THREE.Math.degToRad(camera.fov);
      const height = 2 * Math.tan(fovRad / 2) * dist;
      const width = height * (containerEl.clientWidth / containerEl.clientHeight);
      debugFrame.geometry.dispose();
      debugFrame.geometry = new THREE.EdgesGeometry(new THREE.PlaneGeometry(width, height));
      debugFrame.position.copy(visualCenter);
      debugFrame.position.add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(-0.01 * dist));
      debugFrame.quaternion.copy(camera.quaternion);
    }

    console.log('autoCenterWrapper applied', {
      minX, maxX, minY, maxY,
      bboxCenterNDCx, bboxCenterNDCy,
      deltaNDCx, deltaNDCy,
      wrapperPos: wrapper.position.toArray()
    });
  } else {
    console.warn('autoCenterWrapper: computed empty bounding box.');
  }
}

/* -----------------------------
   Initialize Three.js viewer
   ----------------------------- */

function initThree(container) {
  containerEl = container;

  scene = new THREE.Scene();
  scene.background = null;

  camera = new THREE.PerspectiveCamera(
    45,
    Math.max(1, container.clientWidth) / Math.max(1, container.clientHeight),
    0.1,
    1000
  );
  camera.position.set(0, 2.6, 6);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.display = 'block';
  if (!container.contains(renderer.domElement)) container.appendChild(renderer.domElement);

  resizeRendererToContainer();

  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.9);
  scene.add(hemi);

  const dir = new THREE.DirectionalLight(0xffffff, 1.0);
  dir.position.set(3, 5, 5);
  dir.castShadow = true;
  dir.shadow.mapSize.set(1024, 1024);
  dir.shadow.camera.near = 0.5;
  dir.shadow.camera.far = 30;
  scene.add(dir);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 20),
    new THREE.ShadowMaterial({ opacity: 0.28 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.5;
  ground.receiveShadow = true;
  scene.add(ground);

  const loader = new GLTFLoader();
  loader.load(
    'models/chair.glb',
    (gltf) => {
      modelRoot = gltf.scene;

      modelRoot.traverse((n) => {
        if (n.isMesh) {
          n.castShadow = true;
          n.receiveShadow = true;
          if (n.material) n.material.needsUpdate = true;
        }
      });

      const box = new THREE.Box3().setFromObject(modelRoot);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      visualCenter = center.clone();

      const bottomCenter = new THREE.Vector3(center.x, box.min.y, center.z);

      wrapper = new THREE.Object3D();
      wrapper.position.copy(bottomCenter);
      modelRoot.position.sub(bottomCenter);
      wrapper.add(modelRoot);
      scene.add(wrapper);

      // initial camera framing
      const fovFactor = 1.8;
      const z = Math.max(5.5, size.y * fovFactor);
      const camY = bottomCenter.y + size.y * 0.28;
      camera.position.set(bottomCenter.x, camY, z);
      camera.lookAt(bottomCenter);

      // First try: auto-center wrapper with optional small manual tweak
      // You can call window.autoCenterWrapper(...) later with different parameters.
      autoCenterWrapper({ paddingFraction: 0.0, applyManual: { x: wrapperAdjust.shiftFractionX, y: wrapperAdjust.shiftFractionY } });

      // Debug pivot dot
      pivotDot = new THREE.Mesh(
        new THREE.SphereGeometry(0.02),
        new THREE.MeshBasicMaterial({ color: 0xff9900 })
      );
      pivotDot.position.copy(wrapper.position);
      scene.add(pivotDot);
      window._pivotDot = pivotDot;

      // Debug frame
      const camWorld = camera.getWorldPosition(new THREE.Vector3());
      const dist = camWorld.distanceTo(visualCenter);
      const fovRad = THREE.Math.degToRad(camera.fov);
      const height = 2 * Math.tan(fovRad / 2) * dist;
      const width = height * (containerEl.clientWidth / containerEl.clientHeight);
      debugFrame = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.PlaneGeometry(width, height)),
        new THREE.LineBasicMaterial({ color: 0xff9900 })
      );
      debugFrame.position.copy(visualCenter);
      debugFrame.position.add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(-0.01 * dist));
      debugFrame.quaternion.copy(camera.quaternion);
      scene.add(debugFrame);

      window._modelWrapper = wrapper;
      window._visualCenter = visualCenter.clone();

      console.log('Chair loaded. bbox center:', center, 'size:', size, 'bottomCenter:', bottomCenter);
    },
    undefined,
    (err) => {
      console.error('GLTF load error', err);
    }
  );

  // Interaction: rotate wrapper
  let targetRotationX = 0;
  let targetRotationY = Math.PI;

  container.addEventListener('mousemove', (e) => {
    if (!wrapper) return;
    const rect = container.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    targetRotationY = (px - 0.5) * Math.PI * 2;
    targetRotationX = (py - 0.5) * (Math.PI / 2);
  });

  container.addEventListener('mouseleave', () => {
    targetRotationX = 0;
    targetRotationY = Math.PI;
  });

  function animate() {
    requestAnimationFrame(animate);
    resizeRendererToContainer();

    if (wrapper) {
      let deltaY = targetRotationY - wrapper.rotation.y;
      deltaY = ((deltaY + Math.PI) % (2 * Math.PI)) - Math.PI;
      wrapper.rotation.y += deltaY * 0.08;
      wrapper.rotation.x += (targetRotationX - wrapper.rotation.x) * 0.08;
    }

    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener('resize', () => {
    resizeRendererToContainer();
    if (debugFrame && wrapper && visualCenter) {
      const center = new THREE.Box3().setFromObject(wrapper).getCenter(new THREE.Vector3());
      const camWorld = camera.getWorldPosition(new THREE.Vector3());
      const dist = camWorld.distanceTo(center);
      const fov = THREE.Math.degToRad(camera.fov);
      const height = 2 * Math.tan(fov / 2) * dist;
      const width = height * (containerEl.clientWidth / containerEl.clientHeight);
      debugFrame.geometry.dispose();
      debugFrame.geometry = new THREE.EdgesGeometry(new THREE.PlaneGeometry(width, height));
      debugFrame.position.copy(center);
      debugFrame.quaternion.copy(camera.quaternion);
    }
    if (pivotDot && wrapper) pivotDot.position.copy(wrapper.position);
  });
}

/* -----------------------------
   DOM ready: wire UI + start viewer
   ----------------------------- */

document.addEventListener("DOMContentLoaded", () => {
  loadSharedPart("site-header", "header.html");
  loadSharedPart("site-footer", "footer.html");

  // swatches
  const swatches = document.querySelectorAll(".color-swatch[data-target][data-src]");
  swatches.forEach(swatch => {
    swatch.addEventListener("click", () => {
      const targetId = swatch.getAttribute("data-target");
      const newSrc = swatch.getAttribute("data-src");
      updateProductImage(targetId, newSrc);
      const siblings = swatch.parentElement?.querySelectorAll(".color-swatch");
      siblings?.forEach(s => s.classList.remove("active"));
      swatch.classList.add("active");
    });
  });

  // gallery observer
  const slots = document.querySelectorAll(".gallery-slot img");
  if (slots.length) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) entry.target.classList.add("scaled");
        else entry.target.classList.remove("scaled");
      });
    }, { threshold: 0.3 });

    slots.forEach((img, i) => {
      const rowIndex = Math.floor(i / 4);
      const colIndex = i % 4;
      const delay = rowIndex * 0.2 + colIndex * 0.1;
      img.style.setProperty("--delay", `${delay}s`);
      observer.observe(img);
    });
  }

  const title = document.querySelector(".gallery-title");
  if (title) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) title.classList.add("active");
        else title.classList.remove("active");
      });
    }, { threshold: 0.3 });
    observer.observe(title);
  }

  const container = document.getElementById('chair-canvas');
  if (container) {
    try { initThree(container); }
    catch (err) { console.error('Failed to initialize 3D viewer:', err); }
  } else {
    console.warn('#chair-canvas not found — 3D viewer not initialized.');
  }
});

/* -----------------------------
   Runtime helpers
   - window.autoCenterWrapper({ paddingFraction, applyManual: {x,y} })
   - window.nudgeWrapper(x,y) to apply simple fraction nudges (keeps existing wrapper position)
   - window.resetWrapper() to reload page (simple reset)
   ----------------------------- */

window.autoCenterWrapper = function(opts = {}) {
  autoCenterWrapper(opts);
};

window.nudgeWrapper = function(shiftX = wrapperAdjust.shiftFractionX, shiftY = wrapperAdjust.shiftFractionY) {
  if (!wrapper || !camera || !visualCenter || !containerEl) {
    console.warn('nudgeWrapper: required objects not ready.');
    return;
  }
  // reuse nudge logic: positive shiftX moves model left, positive shiftY moves model up
  const camToCenterDist = camera.position.distanceTo(visualCenter);
  const fovRad = THREE.Math.degToRad(camera.fov);
  const viewHeight = 2 * Math.tan(fovRad / 2) * camToCenterDist;
  const viewWidth = viewHeight * (containerEl.clientWidth / containerEl.clientHeight);
  const camDir = new THREE.Vector3(); camera.getWorldDirection(camDir);
  const camUp = camera.up.clone().normalize();
  const camRight = new THREE.Vector3().crossVectors(camDir, camUp).normalize();
  const manualRightOffset = viewWidth * shiftX;
  const manualUpOffset = viewHeight * shiftY;
  wrapper.position.addScaledVector(camRight, -manualRightOffset);
  wrapper.position.addScaledVector(camUp, manualUpOffset);
  console.log('nudgeWrapper applied', { shiftX, shiftY, wrapperPos: wrapper.position.toArray() });
};

window.resetWrapper = function() {
  console.log('To reset wrapper to original bottom-center, reload the page.');
};
