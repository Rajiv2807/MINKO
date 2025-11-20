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

  const minSize = 150; // px
  const maxSize = 400; // px
  let lastScroll = window.scrollY;

  // initialize dataset size with staggered start sizes
  slots.forEach((img, i) => {
    let startSize = minSize + i * 30; // staggered start sizes
    img.style.width = startSize + "px";
    img.style.height = startSize + "px";
    img.dataset.size = startSize;
  });

  window.addEventListener("scroll", () => {
    const currentScroll = window.scrollY;
    const direction = currentScroll > lastScroll ? "down" : "up";
    lastScroll = currentScroll;

    slots.forEach((img, i) => {
      let currentSize = parseFloat(img.dataset.size);
      const speed = 5 + i * 2; // staggered zoom speeds

      if (direction === "down") {
        currentSize += speed;
        if (currentSize >= maxSize) {
          // cycle to next image
          const nextIndex = Math.floor(Math.random() * images.length);
          img.src = images[nextIndex];
          currentSize = minSize + i * 30; // reset to start size
        }
      } else {
        currentSize -= speed;
        if (currentSize <= minSize) {
          // cycle to next image
          const nextIndex = Math.floor(Math.random() * images.length);
          img.src = images[nextIndex];
          currentSize = maxSize; // reset to max size for zooming out
        }
      }

      img.style.width = currentSize + "px";
      img.style.height = currentSize + "px";
      img.dataset.size = currentSize;
    });
  });
});
