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

// Product swatch image update
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
  // Example markup:
  // <div class="color-swatch walnut" data-target="product-img-1" data-src="assets/products/sofa-walnut.jpg"></div>
  const swatches = document.querySelectorAll(".color-swatch[data-target][data-src]");
  swatches.forEach(swatch => {
    swatch.addEventListener("click", () => {
      const targetId = swatch.getAttribute("data-target");
      const newSrc = swatch.getAttribute("data-src");
      updateProductImage(targetId, newSrc);

      // Visual feedback
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

    // Staggered zoom + fade for images (row-based)
    slots.forEach((img, i) => {
      const columns = 4;                  // grid columns
      const rowIndex = Math.floor(i / columns);
      const rowDelay = rowIndex * 0.2;    // stagger rows (top row first)
      const slotProgress = Math.min(1, Math.max(0, progress - rowDelay));

      img.style.transform = `scale(${slotProgress})`;
      //img.style.opacity = slotProgress;
    });

    // Animate text color per letter
    titleSpans.forEach((span, i) => {
      const delay = i * 0.05;
      const letterProgress = Math.min(1, Math.max(0, progress - delay));
      const grayValue = Math.floor(255 - letterProgress * 255);
      span.style.color = `rgb(${grayValue}, ${grayValue}, ${grayValue})`;
    });
  });
});
