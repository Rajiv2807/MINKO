// Utility to load shared header/footer
function loadSharedPart(id, file) {
  fetch(file)
    .then(res => res.text())
    .then(html => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = html;
    })
    .catch(err => console.error(`Error loading ${file}:`, err));
}

// Product swatch image update: change a main product image by ID
function updateProductImage(imgId, newSrc) {
  const imgElement = document.getElementById(imgId);
  if (imgElement) {
    imgElement.src = newSrc;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  // Load shared parts
  loadSharedPart("site-header", "header.html");
  loadSharedPart("site-footer", "footer.html");

  // --- Swatch interactions ---
  // Expected markup example:
  // <div class="color-swatch" data-target="product-img-1" data-src="assets/products/sofa-walnut.jpg"></div>
  const swatches = document.querySelectorAll(".color-swatch[data-target][data-src]");
  swatches.forEach(swatch => {
    swatch.addEventListener("click", () => {
      const targetId = swatch.getAttribute("data-target");
      const newSrc = swatch.getAttribute("data-src");
      updateProductImage(targetId, newSrc);
      // Optional visual feedback
      const siblings = swatch.parentElement?.querySelectorAll(".color-swatch");
      siblings?.forEach(s => s.classList.remove("active"));
      swatch.classList.add("active");
    });
  });

  // --- Eight-slot scroll-driven gallery ---
  const gallerySection = document.querySelector(".eight-gallery");
  const slots = document.querySelectorAll(".gallery-slot img");
  const titleSpans = document.querySelectorAll(".gallery-title span");

  if (!gallerySection) return;

  window.addEventListener("scroll", () => {
    const rect = gallerySection.getBoundingClientRect();
    const windowHeight = window.innerHeight;

    // Progress: 0 at enter, 1 at center, back to 0 at exit
    const centerOffset = Math.abs(rect.top + rect.height / 2 - windowHeight / 2);
    const maxOffset = windowHeight / 2 + rect.height / 2;
    const progress = 1 - Math.min(centerOffset / maxOffset, 1);

    // Staggered zoom + fade for images
    slots.forEach((img, i) => {
      const delay = i * 0.08; // stagger factor per slot
      const slotProgress = Math.min(1, Math.max(0, progress - delay));
      img.style.transform = `scale(${slotProgress})`;
      img.style.opacity = slotProgress;
    });

    // Per-letter color animation: white -> black
    titleSpans.forEach((span, i) => {
      const delay = i * 0.05;
      const letterProgress = Math.min(1, Math.max(0, progress - delay));
      const grayValue = Math.floor(255 - letterProgress * 255);
      span.style.color = `rgb(${grayValue}, ${grayValue}, ${grayValue})`;
    });
  });
});
