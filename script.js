// Shared Projectify GJU interactions: mobile navigation, active links, reveals, and counters.
const navToggle = document.querySelector(".nav-toggle");
const navLinks = document.querySelector("[data-nav-links]");

if (navToggle && navLinks) {
  navToggle.addEventListener("click", () => {
    const isOpen = navLinks.classList.toggle("open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
    document.body.classList.toggle("nav-open", isOpen);
  });

  navLinks.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      navLinks.classList.remove("open");
      navToggle.setAttribute("aria-expanded", "false");
      document.body.classList.remove("nav-open");
    });
  });
}

const currentPage = window.location.pathname.split("/").pop() || "index.html";
document.querySelectorAll(".nav-links a").forEach((link) => {
  const linkPage = link.getAttribute("href");
  if (linkPage === currentPage) {
    link.classList.add("active");
  }
});

const revealItems = document.querySelectorAll(".reveal");
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.16 }
);

revealItems.forEach((item) => revealObserver.observe(item));

const counters = document.querySelectorAll("[data-counter]");
const counterObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;

      const counter = entry.target;
      const target = Number(counter.dataset.counter);
      const duration = 900;
      const start = performance.now();

      function update(now) {
        const progress = Math.min((now - start) / duration, 1);
        counter.textContent = Math.floor(progress * target).toString();

        if (progress < 1) {
          requestAnimationFrame(update);
        } else {
          counter.textContent = `${target}+`;
        }
      }

      requestAnimationFrame(update);
      counterObserver.unobserve(counter);
    });
  },
  { threshold: 0.5 }
);

counters.forEach((counter) => counterObserver.observe(counter));

const contactForm = document.querySelector("[data-contact-form]");
if (contactForm) {
  contactForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const status = contactForm.querySelector("[data-form-status]");
    if (status) {
      status.textContent = "Thanks! Your message is ready to be sent to the Projectify team.";
    }
    contactForm.reset();
  });
}

const photoGallery = document.querySelector("[data-photo-gallery]");
if (photoGallery) {
  const emptyState = document.querySelector("[data-gallery-empty]");
  const photoCount = document.querySelector("[data-photo-count]");
  const lightbox = document.querySelector("[data-lightbox]");
  const lightboxImage = document.querySelector("[data-lightbox-image]");
  const lightboxClose = document.querySelector("[data-lightbox-close]");
  const discoveredPhotos = new Set(window.projectifyPhotos || []);
  const extensions = ["jpg", "jpeg", "png", "webp"];

  for (let index = 1; index <= 80; index += 1) {
    const padded = String(index).padStart(2, "0");
    extensions.forEach((extension) => {
      discoveredPhotos.add(`assets/photos/photo-${padded}.${extension}`);
      discoveredPhotos.add(`assets/photos/photo-${index}.${extension}`);
      discoveredPhotos.add(`assets/photos/projectify-${padded}.${extension}`);
      discoveredPhotos.add(`assets/photos/projectify-${index}.${extension}`);
    });
  }

  let loadedPhotos = 0;

  function openLightbox(source, alt) {
    if (!lightbox || !lightboxImage) return;
    lightboxImage.src = source;
    lightboxImage.alt = alt;
    lightbox.classList.add("open");
    lightbox.setAttribute("aria-hidden", "false");
  }

  function closeLightbox() {
    if (!lightbox || !lightboxImage) return;
    lightbox.classList.remove("open");
    lightbox.setAttribute("aria-hidden", "true");
    lightboxImage.src = "";
  }

  Array.from(discoveredPhotos).forEach((source) => {
    const image = new Image();
    image.src = source;
    image.alt = "Projectify GJU gallery photo";

    image.addEventListener("load", () => {
      const card = document.createElement("button");
      card.className = "photo-card";
      card.type = "button";
      card.setAttribute("aria-label", "Open Projectify gallery photo");
      card.appendChild(image);
      card.addEventListener("click", () => openLightbox(source, image.alt));
      photoGallery.appendChild(card);

      loadedPhotos += 1;
      if (emptyState) emptyState.style.display = "none";
      if (photoCount) photoCount.textContent = `${loadedPhotos} photo${loadedPhotos === 1 ? "" : "s"}`;
    });
  });

  if (lightboxClose) {
    lightboxClose.addEventListener("click", closeLightbox);
  }

  if (lightbox) {
    lightbox.addEventListener("click", (event) => {
      if (event.target === lightbox) closeLightbox();
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeLightbox();
  });
}
