// script.js
// Single-module entry: loads shared header/footer, UI interactions, and mounts Three.js chair viewer.
// Shadowing tuned to be subtle: softer directional shadows + a gentle blob contact shadow.

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
let wrapper = null;
let debugFrame = null;
let pivotDot = null;
let visualCenter = null;
let containerEl = null;
let blobShadow = null; // soft contact shadow mesh

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

/* -----------------------------
   Create a soft radial gradient texture for blob shadow
   ----------------------------- */
function createBlobTexture(size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  // radial gradient: center dark -> transparent edges
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2;
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  grad.addColorStop(0, 'rgba(0,0,0,0.65)');
  grad.addColorStop(0.35, 'rgba(0,0,0,0.35)');
  grad.addColorStop(0.6, 'rgba(0,0,0,0.12)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.encoding = THREE.sRGBEncoding;
  return tex;
}

/* -----------------------------
   Wrapper nudge helper (keeps existing API)
   ----------------------------- */
function nudgeWrapper(shiftFractionX = 0.06, shiftFractionY = 0.04) {
  if (!wrapper || !camera || !visualCenter || !containerEl) {
    console.warn('nudgeWrapper: required objects not ready.');
    return;
  }
  const camToCenterDist = camera.position.distanceTo(visualCenter);
  const fovRad = THREE.Math.degToRad(camera.fov);
  const viewHeight = 2 * Math.tan(fovRad / 2) * camToCenterDist;
  const viewWidth = viewHeight * (containerEl.clientWidth / containerEl.clientHeight);
  const camDir = new THREE.Vector3(); camera.getWorldDirection(camDir);
  const camUp = camera.up.clone().normalize();
  const camRight = new THREE.Vector3().crossVectors(camDir, camUp).normalize();
  const manualRightOffset = viewWidth * shiftFractionX;
  const manualUpOffset = viewHeight * shiftFractionY;
  wrapper.position.addScaledVector(camRight, -manualRightOffset);
  wrapper.position.addScaledVector(camUp, manualUpOffset);
  console.log('nudgeWrapper applied', { shiftFractionX, shiftFractionY, wrapperPos: wrapper.position.toArray() });
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

  // Lighting tuned for subtle shadows
  // Lower hemisphere intensity so ambient fill is gentle
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.55);
  scene.add(hemi);

  // Directional light provides the main shadow but softened and dimmed
  const dir = new THREE.DirectionalLight(0xffffff, 0.6); // reduced intensity
  dir.position.set(3, 5, 5);

  // Shadow settings: softer, lower resolution to avoid harsh edges
  dir.castShadow = true;
  dir.shadow.mapSize.set(512, 512); // smaller map for softer look
  // radius softens the shadow edges (works with PCFSoftShadowMap)
  if ('radius' in dir.shadow) dir.shadow.radius = 8;
  // adjust camera for shadow caster to cover model area
  const d = 6;
  dir.shadow.camera.left = -d;
  dir.shadow.camera.right = d;
  dir.shadow.camera.top = d;
  dir.shadow.camera.bottom = -d;
  dir.shadow.camera.near = 0.5;
  dir.shadow.camera.far = 30;
  scene.add(dir);

  // Very subtle ambient to lift darkest parts
  const ambient = new THREE.AmbientLight(0xffffff, 0.12);
  scene.add(ambient);

  // Ground shadow catcher with low opacity
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.ShadowMaterial({ opacity: 0.08 }) // subtle shadow catcher
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.5;
  ground.receiveShadow = true;
  scene.add(ground);

  // GLTF loader
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

      // compute bounding box and center
      const box = new THREE.Box3().setFromObject(modelRoot);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      visualCenter = center.clone();

      // bottom-center pivot
      const bottomCenter = new THREE.Vector3(center.x, box.min.y, center.z);

      // wrapper at bottom-center and reparent model into wrapper
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

      // Create a soft blob shadow sized to the model footprint
      // Blob plane sits just above the ground to avoid z-fighting
      const footprintSize = Math.max(size.x, size.z) * 1.15; // slightly larger than model footprint
      const blobTex = createBlobTexture(512);
      const blobMat = new THREE.MeshBasicMaterial({
        map: blobTex,
        transparent: true,
        opacity: 0.28, // subtle darkness
        depthWrite: false
      });
      blobShadow = new THREE.Mesh(new THREE.PlaneGeometry(footprintSize, footprintSize), blobMat);
      blobShadow.rotation.x = -Math.PI / 2;
      // place blob slightly above ground (use bottomCenter.y + small offset)
      blobShadow.position.set(bottomCenter.x, bottomCenter.y + 0.001, bottomCenter.z);
      // ensure it doesn't cast shadows and doesn't receive them (it's a fake)
      blobShadow.receiveShadow = false;
      blobShadow.castShadow = false;
      scene.add(blobShadow);

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

      // Expose for debugging
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

  // Animation loop
  function animate() {
    requestAnimationFrame(animate);
    resizeRendererToContainer();

    if (wrapper) {
      let deltaY = targetRotationY - wrapper.rotation.y;
      deltaY = ((deltaY + Math.PI) % (2 * Math.PI)) - Math.PI;
      wrapper.rotation.y += deltaY * 0.08;
      wrapper.rotation.x += (targetRotationX - wrapper.rotation.x) * 0.08;
    }

    // Keep blob shadow positioned under wrapper (in case wrapper is nudged)
    if (blobShadow && wrapper) {
      // blob should follow wrapper X/Z and sit at wrapper.position.y (bottom center)
      blobShadow.position.x = wrapper.position.x;
      blobShadow.position.z = wrapper.position.z;
      // keep it just above ground
      // wrapper.position.y is bottom-center Y; place blob slightly above that
      blobShadow.position.y = wrapper.position.y + 0.001;
    }

    renderer.render(scene, camera);
  }
  animate();

  // Keep debug helpers updated on resize
  window.addEventListener('resize', () => {
    resizeRendererToContainer();
    if (debugFrame && visualCenter) {
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
   - window.nudgeWrapper(x,y) to nudge model
   - window.setBlobOpacity(v) to tweak blob darkness at runtime
   ----------------------------- */

window.nudgeWrapper = function(shiftX = 0.06, shiftY = 0.04) {
  nudgeWrapper(shiftX, shiftY);
};

window.setBlobOpacity = function(op) {
  if (blobShadow && blobShadow.material) {
    blobShadow.material.opacity = Math.max(0, Math.min(1, op));
    console.log('blob opacity set to', blobShadow.material.opacity);
  } else {
    console.warn('blobShadow not ready');
  }
};
