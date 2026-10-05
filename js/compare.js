/**
 * compare.js - Interactive Before / After Image Comparison Slider
 * Accessible via range input, touch swipe, and mouse drag.
 */

function initCompareSliders() {
  const compareBoxes = document.querySelectorAll('.compare-box');

  compareBoxes.forEach(box => {
    const overlay = box.querySelector('.compare-overlay');
    const handle = box.querySelector('.compare-handle');
    const sliderInput = box.querySelector('.compare-slider-input');
    const overlayImg = overlay ? overlay.querySelector('.compare-img') : null;

    if (!overlay || !handle || !sliderInput) return;

    // Keep the overlay image width matching the parent container box width
    const updateDimensions = () => {
      const boxWidth = box.offsetWidth;
      if (overlayImg) {
        overlayImg.style.width = `${boxWidth}px`;
      }
    };

    const setPosition = (pos) => {
      const percentage = Math.max(0, Math.min(100, pos));
      overlay.style.width = `${percentage}%`;
      handle.style.left = `${percentage}%`;
      sliderInput.value = percentage;
    };

    // Update on slider input (range)
    sliderInput.addEventListener('input', (e) => {
      setPosition(parseFloat(e.target.value));
    });

    // Touch and mouse drag directly on the box
    let isDragging = false;

    const onPointerMove = (e) => {
      if (!isDragging) return;
      const rect = box.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const x = clientX - rect.left;
      const percentage = (x / rect.width) * 100;
      setPosition(percentage);
    };

    const stopDragging = () => {
      isDragging = false;
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', stopDragging);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', stopDragging);
    };

    const startDragging = (e) => {
      isDragging = true;
      onPointerMove(e);
      window.addEventListener('mousemove', onPointerMove, { passive: true });
      window.addEventListener('mouseup', stopDragging);
      window.addEventListener('touchmove', onPointerMove, { passive: true });
      window.addEventListener('touchend', stopDragging);
    };

    handle.addEventListener('mousedown', startDragging);
    handle.addEventListener('touchstart', startDragging, { passive: true });

    // Window resize observer
    const resizeObserver = new ResizeObserver(updateDimensions);
    resizeObserver.observe(box);
    updateDimensions();

    // Default start at 50%
    setPosition(50);
  });
}

document.addEventListener('DOMContentLoaded', initCompareSliders);
