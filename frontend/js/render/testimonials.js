/* ============================================================
   TESTIMONIALS — auto-rotating quote carousel
   ============================================================ */

function initTestimonials() {
  const items = NOVIQ_CONTENT.testimonials;
  let idx = 0;
  const quote = document.getElementById("testimonial-quote");
  const name = document.getElementById("testimonial-name");
  const role = document.getElementById("testimonial-role");
  const dots = document.querySelectorAll(".noviq-dot");
  if (!quote) return;

  function show(i, immediate = false) {
    idx = i;
    const t = items[idx];
    const apply = () => {
      quote.textContent = `\u201C${localized(t,'quote') || t.quote}\u201D`;
      name.textContent = localized(t,'name') || t.name;
      role.textContent = localized(t,'role') || t.role;
      quote.style.opacity = "1";
    };
    if (immediate) {
      apply();
    } else {
      quote.style.opacity = "0";
      setTimeout(apply, 200);
    }
    dots.forEach((d, j) => d.classList.toggle("active", j === idx));
  }

  show(0, true); // populate immediately on load — don't wait for the first interval tick
  dots.forEach((d, i) => d.addEventListener("click", () => show(i)));

  let lastSwitch = performance.now();
  let _testActive = true;

  const testSection = document.querySelector('.noviq-testimonials, #testimonials');
  if (testSection) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { _testActive = e.isIntersecting; });
    }, { threshold: 0 });
    io.observe(testSection);
  }

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) lastSwitch = performance.now();
  });

  setInterval(() => {
    if (_testActive && !document.hidden && performance.now() - lastSwitch >= 5500) {
      show((idx + 1) % items.length);
      lastSwitch = performance.now();
    }
  }, 1000);
}
