/**
 * PeriodizationView - UI component for periodization planning
 * Displays phase pill, progress bar, and calendar with game dates
 */
class PeriodizationView {
  constructor() {
    this.logger = window.SafeLogger || console;
    this.storageManager = window.StorageManager;
    this.seasonalPrograms = window.SeasonalPrograms;
    this.eventBus = window.EventBus;

    this.currentPhase = null;
    this.periodizationData = null;
  }

  /**
   * Render periodization view
   * @returns {HTMLElement} Periodization view
   */
  render() {
    const view = document.createElement('div');
    view.className = 'periodization-view';

    this.loadPeriodizationData();

    view.innerHTML = `
            <div class="periodization-header">
                <h1>Training Plan</h1>
                <button class="btn-secondary" onclick="window.PeriodizationView.toggleCalendar()">
                    📅 Manage Games
                </button>
            </div>
            
            <!-- Phase Display -->
            <div class="phase-display">
                ${this.renderPhasePill()}
                ${this.renderProgressBar()}
            </div>
            
            <!-- Training Blocks -->
            <div class="training-blocks">
                ${this.renderTrainingBlocks()}
            </div>
            
            <!-- Recommendations -->
            <div class="periodization-recommendations">
                ${this.renderRecommendations()}
            </div>
        `;

    return view;
  }

  /**
   * Render phase pill
   * @returns {string} Phase pill HTML
   */
  renderPhasePill() {
    const phase = this.currentPhase || { name: 'Unknown', color: '#6c757d' };

    return `
            <div class="phase-pill" style="--phase-color: ${phase.color}">
                <span class="phase-emoji">${phase.emoji || '⚙️'}</span>
                <span class="phase-label">${phase.name}</span>
                <span class="phase-subtitle">${phase.duration || ''}</span>
            </div>
        `;
  }

  /**
   * Render progress bar
   * @returns {string} Progress bar HTML
   */
  renderProgressBar() {
    if (!this.periodizationData) {
      return '<div class="progress-placeholder">No periodization data</div>';
    }

    const progress = this.periodizationData.summary?.phaseProgress || {
      percentage: 0,
      currentWeek: 0,
      totalWeeks: 0,
    };

    return `
            <div class="progress-section">
                <div class="progress-header">
                    <span class="progress-label">Phase Progress</span>
                    <span class="progress-percentage">${progress.percentage.toFixed(0)}%</span>
                </div>
                <div class="progress-bar-container">
                    <div class="progress-bar" style="width: ${progress.percentage}%"></div>
                </div>
                <div class="progress-text">
                    Week ${progress.currentWeek} of ${progress.totalWeeks}
                </div>
            </div>
        `;
  }

  /**
   * Render training blocks
   * @returns {string} Training blocks HTML
   */
  renderTrainingBlocks() {
    if (!this.periodizationData || !this.periodizationData.blocks) {
      return '<div class="blocks-placeholder">Generating training blocks...</div>';
    }

    return `
            <div class="blocks-container">
                ${this.periodizationData.blocks
                  .map(
                    (block, index) => `
                    <div class="training-block" data-block="${index + 1}">
                        <div class="block-header">
                            <h3>Block ${block.blockNumber}</h3>
                            <span class="block-phase">${block.phase}</span>
                        </div>
                        <div class="weeks-container">
                            ${block.weeks.map((week, wIndex) => this.renderWeek(week, wIndex + 1)).join('')}
                        </div>
                    </div>
                `
                  )
                  .join('')}
            </div>
        `;
  }

  /**
   * Render week
   * @param {Object} week - Week data
   * @param {number} weekNumber - Week number
   * @returns {string} Week HTML
   */
  renderWeek(week, weekNumber) {
    const { isDeload } = week;
    const hasTaper = week.taper;
    const hasGame = week.gameConflict;

    let className = 'week';
    if (isDeload) {
      className += ' deload';
    }
    if (hasTaper) {
      className += ' taper';
    }
    if (hasGame) {
      className += ' game';
    }

    return `
            <div class="${className}">
                <div class="week-number">W${weekNumber}</div>
                <div class="week-load">
                    ${isDeload ? '🔄 Deload' : hasTaper ? '📉 Taper' : '💪 Normal'}
                </div>
                <div class="week-volume">Vol: ${(week.volumeMultiplier * 100).toFixed(0)}%</div>
                <div class="week-intensity">Int: ${(week.intensityMultiplier * 100).toFixed(0)}%</div>
                ${hasTaper && week.reason ? `<div class="week-reason">${week.reason}</div>` : ''}
            </div>
        `;
  }

  /**
   * Render recommendations
   * @returns {string} Recommendations HTML
   */
  renderRecommendations() {
    if (!this.periodizationData || !this.periodizationData.summary?.recommendations) {
      return '';
    }

    return `
            <div class="recommendations-header">
                <h3>💡 Recommendations</h3>
            </div>
            <ul class="recommendations-list">
                ${this.periodizationData.summary.recommendations
                  .map(
                    rec => `
                    <li>${rec}</li>
                `
                  )
                  .join('')}
            </ul>
        `;
  }

  /**
   * Load periodization data
   */
  loadPeriodizationData() {
    try {
      const authManager = window.AuthManager;
      const userId = authManager?.getCurrentUsername();

      if (!userId) {
        return;
      }

      // Get current season phase
      const seasonPhase = window.SeasonPhase?.getCurrentPhase();
      if (seasonPhase) {
        this.currentPhase = {
          name: seasonPhase.config.label,
          emoji: seasonPhase.config.emoji,
          color: seasonPhase.config.color,
          duration: seasonPhase.currentPhase?.expectedDuration,
        };
      }

      // Generate periodization plan
      const sport = this.getUserSport();
      const season = seasonPhase?.name || 'off-season';

      const periodization = this.generatePeriodization(sport, season);
      this.periodizationData = periodization;
    } catch (error) {
      this.logger.error('Failed to load periodization data', error);
    }
  }

  /**
   * Generate periodization plan
   * @param {string} sport - Sport type
   * @param {string} season - Season phase
   * @returns {Object} Periodization plan
   */
  generatePeriodization(sport, season) {
    // Use seasonal programs if available
    if (this.seasonalPrograms) {
      const phase = this.seasonalPrograms.getSeasonalPhase(sport, season);
      if (phase) {
        return this.generateBlocksFromPhase(phase);
      }
    }

    // Fallback generation
    return this.generateBasicPeriodization(sport, season);
  }

  /**
   * Generate blocks from phase
   * @param {Object} phase - Phase configuration
   * @returns {Object} Periodization plan
   */
  generateBlocksFromPhase(phase) {
    const blocks = [];
    const totalBlocks = this.calculateTotalBlocks(phase.duration);

    for (let i = 1; i <= totalBlocks; i++) {
      const block = this.seasonalPrograms.generateMicrocycle(phase, i);
      blocks.push(block);
    }

    return {
      sport: 'soccer',
      season: phase.name,
      blocks,
      summary: {
        totalWeeks: totalBlocks * 4,
        phaseProgress: {
          percentage: 0,
          currentWeek: 1,
          totalWeeks: totalBlocks * 4,
        },
      },
    };
  }

  /**
   * Calculate total blocks from duration
   * @param {string} duration - Duration string
   * @returns {number} Total blocks
   */
  calculateTotalBlocks(duration) {
    const match = duration.match(/(\d+)-(\d+)\s*weeks/);
    if (match) {
      const weeks = parseInt(match[2] || match[1]);
      return Math.ceil(weeks / 4);
    }
    return 3; // Default 3 blocks
  }

  /**
   * Generate basic periodization
   * @param {string} sport - Sport type
   * @param {string} season - Season phase
   * @returns {Object} Basic periodization
   */
  generateBasicPeriodization(sport, season) {
    return {
      sport,
      season,
      blocks: [],
      summary: {
        totalWeeks: 12,
        phaseProgress: { percentage: 0, currentWeek: 1, totalWeeks: 12 },
      },
    };
  }

  /**
   * Get user sport
   * @returns {string} Sport ID
   */
  getUserSport() {
    try {
      const username = this.authManager?.getCurrentUsername();
      if (!username) {
        return 'soccer';
      }

      const users = JSON.parse(localStorage.getItem('ignitefitness_users') || '{}');
      const user = users[username];
      if (!user) {
        return 'soccer';
      }

      return user.onboardingData?.sport?.id || 'soccer';
    } catch (error) {
      return 'soccer';
    }
  }

  /**
   * Toggle calendar view
   */
  toggleCalendar() {
    this.logger.debug('Toggle calendar view');
    // If modal exists, remove it (toggle behavior)
    const existing = document.getElementById('periodization-calendar-modal');
    if (existing) {
      existing.remove();
      return;
    }

    // Build modal
    const modal = document.createElement('div');
    modal.id = 'periodization-calendar-modal';
    modal.className = 'if-modal-overlay';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'periodization-calendar-title');
    modal.innerHTML = `
            <div class="if-modal">
                <div class="if-modal-header">
                    <h2 id="periodization-calendar-title">Periodization Calendar</h2>
                    <button class="if-modal-close" aria-label="Close calendar" data-close>&times;</button>
                </div>
                <div class="if-modal-body">
                    ${this.renderCalendarGrid(new Date())}
                </div>
                <div class="if-modal-footer">
                    <button class="btn-secondary" data-prev>Previous</button>
                    <button class="btn-secondary" data-today>Today</button>
                    <button class="btn-secondary" data-next>Next</button>
                    <button class="btn-primary" data-close>Close</button>
                </div>
            </div>
        `;

    // Minimal styles (scoped)
    const styleId = 'if-modal-calendar-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
                .if-modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:9999}
                .if-modal{background:#0b1220;color:#e5e7eb;min-width:320px;max-width:720px;width:90%;border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,.5)}
                .if-modal-header{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid #1f2937}
                .if-modal-body{padding:12px 16px}
                .if-modal-footer{display:flex;gap:8px;justify-content:flex-end;padding:12px 16px;border-top:1px solid #1f2937}
                .if-modal-close{background:transparent;border:none;color:#9ca3af;font-size:22px;cursor:pointer}
                .btn-secondary{background:#1f2937;border:none;color:#e5e7eb;padding:8px 12px;border-radius:8px;cursor:pointer}
                .btn-primary{background:#2563eb;border:none;color:white;padding:8px 12px;border-radius:8px;cursor:pointer}
                .if-cal{display:grid;grid-template-rows:auto auto 1fr;gap:8px}
                .if-cal-header{display:flex;align-items:center;justify-content:space-between}
                .if-cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}
                .if-cal-cell{min-height:60px;border:1px solid #1f2937;border-radius:8px;padding:6px;position:relative;background:#0f172a}
                .if-cal-cell[aria-current="date"]{outline:2px solid #2563eb}
                .if-cal-cell .day{font-size:12px;color:#9ca3af}
                .if-cal-badge{position:absolute;bottom:6px;left:6px;font-size:11px;background:#10b981;color:#052e1c;padding:2px 6px;border-radius:999px}
            `;
      document.head.appendChild(style);
    }

    document.body.appendChild(modal);

    // Focus management
    const focusable = modal.querySelectorAll(
      '[data-close], [data-prev], [data-next], [data-today], .if-cal-cell'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first?.focus();
    modal.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        modal.remove();
      } else if (e.key === 'Tab') {
        // trap focus
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });

    // Navigation state
    let current = new Date();
    const bodyEl = modal.querySelector('.if-modal-body');
    const rerender = () => {
      bodyEl.innerHTML = this.renderCalendarGrid(current);
      this.wireCalendarCells(modal, current);
    };

    // Wire controls
    modal
      .querySelectorAll('[data-close]')
      .forEach(btn => btn.addEventListener('click', () => modal.remove()));
    modal.querySelector('[data-prev]').addEventListener('click', () => {
      current = new Date(current.getFullYear(), current.getMonth() - 1, 1);
      rerender();
    });
    modal.querySelector('[data-next]').addEventListener('click', () => {
      current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
      rerender();
    });
    modal.querySelector('[data-today]').addEventListener('click', () => {
      current = new Date();
      rerender();
    });

    // Wire initial cells
    this.wireCalendarCells(modal, current);
  }

  renderCalendarGrid(baseDate) {
    const year = baseDate.getFullYear();
    const month = baseDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startWeekday = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();

    // Fake events from periodizationData if available
    const events = this.periodizationData?.events || [];
    const eventByDay = new Map();
    events.forEach(ev => {
      try {
        const d = new Date(ev.date);
        if (d.getFullYear() === year && d.getMonth() === month) {
          eventByDay.set(d.getDate(), ev);
        }
      } catch {}
    });

    let cells = '';
    for (let i = 0; i < startWeekday; i++) {
      cells += '<div class="if-cal-cell" aria-disabled="true"></div>';
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const isToday =
        d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
      const ev = eventByDay.get(d);
      cells += `
                <button class="if-cal-cell" ${isToday ? 'aria-current="date"' : ''} data-day="${d}" aria-label="${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}${ev ? ', event present' : ''}">
                    <div class="day">${d}</div>
                    ${ev ? `<span class="if-cal-badge">${ev.label || 'Event'}</span>` : ''}
                </button>
            `;
    }

    const monthName = baseDate.toLocaleString(undefined, { month: 'long', year: 'numeric' });
    return `
            <div class="if-cal" aria-label="${monthName} calendar">
                <div class="if-cal-header">
                    <strong>${monthName}</strong>
                </div>
                <div class="if-cal-grid" role="grid">${cells}</div>
            </div>
        `;
  }

  wireCalendarCells(modal, baseDate) {
    modal.querySelectorAll('.if-cal-cell[data-day]').forEach(btn => {
      btn.addEventListener('click', () => {
        const day = parseInt(btn.getAttribute('data-day'), 10);
        const dateStr = `${baseDate.getFullYear()}-${String(baseDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        // Emit select event for integrations (load mgmt, readiness, planner)
        this.eventBus.emit('calendar:dateSelected', { date: dateStr });
        this.showToast?.(`Selected ${dateStr}`);
        window.LiveRegionManager?.announce(`Selected ${dateStr}`, 'polite');
      });
    });
  }

  /**
   * Sync with load management and readiness
   */
  syncWithLoadManagement() {
    // Listen for readiness updates
    this.eventBus.on(this.eventBus.TOPICS.READINESS_UPDATED, data => {
      this.updateBasedOnReadiness(data);
    });

    // Listen for load changes
    this.eventBus.on('load:management_updated', data => {
      this.updateBasedOnLoad(data);
    });
  }

  /**
   * Update based on readiness
   * @param {Object} data - Readiness data
   */
  updateBasedOnReadiness(data) {
    // Adjust periodization based on readiness scores
    // Reduce volume/intensity if readiness consistently low
  }

  /**
   * Update based on load
   * @param {Object} data - Load data
   */
  updateBasedOnLoad(data) {
    // Adjust periodization based on load trends
  }
}

// Create global instance
window.PeriodizationView = new PeriodizationView();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PeriodizationView;
}
