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

  // Corner gallery zoom logic
  const slots = document.querySelectorAll(".corner-slot img");
  const images = [
    "assets/interior/1.jpg","assets/interior/2.jpg","assets/interior/3.jpg","assets/interior/4.jpg",
    "assets/interior/5.jpg","assets/interior/6.jpg","assets/interior/7.jpg","assets/interior/8.jpg"
  ];

  const minScale = 1;   // minimum zoom scale
  const maxScale = 4;   // maximum zoom scale
  let lastScroll = window.scrollY;

  // initialize dataset scale
  slots.forEach((img, i) => {
    img.dataset.scale = (minScale + i * 0.2).toString(); // different start sizes
    img.style.transform = `scale(${img.dataset.scale})`;
  });

  window.addEventListener("scroll", () => {
    const currentScroll = window.scrollY;
    const direction = currentScroll > lastScroll ? "down" : "up";
    lastScroll = currentScroll;

    slots.forEach((img, i) => {
      let currentScale = parseFloat(img.dataset.scale || minScale);
      const speed = 0.05 + i * 0.01; // staggered zoom speeds

      if (direction === "down") {
        currentScale += speed;
        if (currentScale >= maxScale) {
          // cycle to next image
          const nextIndex = Math.floor(Math.random() * images.length);
          img.src = images[nextIndex];
          currentScale = minScale + i * 0.2; // reset to start size
        }
      } else {
        currentScale -= speed;
        if (currentScale <= minScale) {
          // cycle to next image
          const nextIndex = Math.floor(Math.random() * images.length);
          img.src = images[nextIndex];
          currentScale = maxScale; // reset to max size for zooming out
        }
      }

      img.style.transform = `scale(${currentScale})`;
      img.dataset.scale = currentScale.toString();
    });
  });
});
