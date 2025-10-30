/**
 * LoadingOverlay - reusable delayed loading indicator (500ms threshold)
 */
(function() {
  class LoadingOverlay {
    constructor() {
      this.visible = false;
      this.timer = null;
      this.container = null;
    }

    show(target = document.body, delayMs = 500, message = 'Loading...') {
      this.clear();
      this.timer = setTimeout(() => {
        this.visible = true;
        this.container = document.createElement('div');
        this.container.className = 'if-loading-overlay';
        this.container.setAttribute('aria-live', 'polite');
        this.container.innerHTML = `
          <div class="if-loading-backdrop"></div>
          <div class="if-loading-content" role="status">
            <div class="if-spinner"></div>
            <span class="if-loading-text">${message}</span>
          </div>
        `;
        (target || document.body).appendChild(this.container);
      }, Math.max(0, delayMs || 0));
    }

    hide() {
      this.clear();
      if (this.container && this.container.parentNode) {
        this.container.parentNode.removeChild(this.container);
      }
      this.container = null;
      this.visible = false;
    }

    clear() {
      if (this.timer) {
        clearTimeout(this.timer);
        this.timer = null;
      }
    }
  }

  // Lightweight styles (scoped class names)
  const style = document.createElement('style');
  style.textContent = `
    .if-loading-overlay { position: fixed; inset: 0; z-index: 9998; display: flex; align-items: center; justify-content: center; }
    .if-loading-backdrop { position: absolute; inset: 0; background: rgba(0,0,0,0.35); backdrop-filter: blur(1px); }
    .if-loading-content { position: relative; z-index: 1; background: #111827; color: #e5e7eb; padding: 12px 16px; border-radius: 8px; display: flex; gap: 10px; align-items: center; font-size: 14px; box-shadow: 0 4px 16px rgba(0,0,0,0.3); }
    .if-spinner { width: 16px; height: 16px; border: 2px solid #93c5fd; border-top-color: transparent; border-radius: 50%; animation: ifspin 0.9s linear infinite; }
    @keyframes ifspin { to { transform: rotate(360deg); } }
  `;
  document.head.appendChild(style);

  // Export
  window.LoadingOverlay = LoadingOverlay;
})();


