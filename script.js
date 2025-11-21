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

  if (!gallerySection) return;

  window.addEventListener("scroll", () => {
    const rect = gallerySection.getBoundingClientRect();
    const windowHeight = window.innerHeight;

    // Progress: 0 at enter, 1 at center, back to 0 at exit
    const centerOffset = Math.abs(rect.top + rect.height / 2 - windowHeight / 2);
    const maxOffset = windowHeight / 2 + rect.height / 2;
    const progress = 1 - Math.min(centerOffset / maxOffset, 1);

    // Staggered zoom for images (row + column based)
    slots.forEach((img, i) => {
      const columns = 4;
      const rowIndex = Math.floor(i / columns);
      const colIndex = i % columns;

      const rowDelay = rowIndex * 0.2;
      const colDelay = colIndex * 0.1;
      const totalDelay = rowDelay + colDelay;

      const slotProgress = Math.min(1, Math.max(0, progress - totalDelay));
      img.style.transform = `scale(${slotProgress})`;
    });
  });

  // --- Title slide-in animation (scroll-triggered) ---
  const title = document.querySelector(".gallery-title");
  if (title) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            title.classList.add("active");
          } else {
            title.classList.remove("active"); // reset so it replays
          }
        });
      },
      { threshold: 0.3 }
    );
    observer.observe(title);
  }
});
