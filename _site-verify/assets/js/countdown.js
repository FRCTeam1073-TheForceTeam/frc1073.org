class CountdownTimer {
  constructor(elementId, targetDate, options = {}) {
    this.elementId = elementId;
    this.targetDate = new Date(targetDate);
    this.element = document.getElementById(elementId);
    this.options = {
      showDays: true,
      showHours: true,
      showMinutes: true,
      showSeconds: true,
      ...options
    };

    if (!this.element) {
      console.error(`CountdownTimer: Element with id "${elementId}" not found`);
      return;
    }

    this.start();
  }

  formatTime(value) {
    return String(value).padStart(2, '0');
  }

  updateDisplay() {
    const now = new Date();
    const diff = this.targetDate - now;

    if (diff <= 0) {
      this.element.innerHTML = '<div class="countdown-complete">The drawing has begun!</div>';
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    let html = '<div class="countdown-timer">';

    if (this.options.showDays && days > 0) {
      html += `<div class="countdown-item"><span class="countdown-value">${this.formatTime(days)}</span><span class="countdown-label">Day${days !== 1 ? 's' : ''}</span></div>`;
    }

    if (this.options.showHours) {
      html += `<div class="countdown-item"><span class="countdown-value">${this.formatTime(hours)}</span><span class="countdown-label">Hour${hours !== 1 ? 's' : ''}</span></div>`;
    }

    if (this.options.showMinutes) {
      html += `<div class="countdown-item"><span class="countdown-value">${this.formatTime(minutes)}</span><span class="countdown-label">Minute${minutes !== 1 ? 's' : ''}</span></div>`;
    }

    if (this.options.showSeconds) {
      html += `<div class="countdown-item"><span class="countdown-value">${this.formatTime(seconds)}</span><span class="countdown-label">Second${seconds !== 1 ? 's' : ''}</span></div>`;
    }

    html += '</div>';
    this.element.innerHTML = html;
  }

  start() {
    this.updateDisplay();
    this.intervalId = setInterval(() => this.updateDisplay(), 1000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }
}
