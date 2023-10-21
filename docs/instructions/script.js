document.addEventListener("DOMContentLoaded", function () {
  const lazySVGs = [].slice.call(document.querySelectorAll("main table img"));

  if ("IntersectionObserver" in window) {
    let lazySVGObserver = new IntersectionObserver(function (
      entries,
      observer
    ) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          let lazySVG = entry.target;
          lazySVG.src = lazySVG.dataset.src;
          lazySVGObserver.unobserve(lazySVG);
        }
      });
    });

    lazySVGs.forEach(function (lazySVG) {
      lazySVGObserver.observe(lazySVG);
    });
  } else {
    // Fallback for browsers that don't support IntersectionObserver
    lazySVGs.forEach(function (lazySVG) {
      lazySVG.src = lazySVG.dataset.src;
    });
  }
});
