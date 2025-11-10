/**
 * ComponentLibrary - React-like component library for creating UI elements
 * Provides reusable, sport-themed components
 */
class ComponentLibrary {
    constructor() {
        this.logger = window.SafeLogger || console;
        this.components = this.initializeComponents();
    }

    /**
     * Initialize component library
     * @returns {Object} Components
     */
    initializeComponents() {
        return {
            Button: this.createButton.bind(this),
            Card: this.createCard.bind(this),
            Input: this.createInput.bind(this),
            Badge: this.createBadge.bind(this),
            LoadingSpinner: this.createLoadingSpinner.bind(this),
            ProgressBar: this.createProgressBar.bind(this),
            Modal: this.createModal.bind(this),
            Toast: this.showToast.bind(this)
        };
    }

    /**
     * Create button component
     * @param {Object} props - Button properties
     * @returns {HTMLElement} Button element
     */
    createButton(props) {
        const {
            text = '',
            variant = 'primary',
            size = 'base',
            fullWidth = false,
            onClick = null,
            disabled = false,
            icon = null,
            loading = false
        } = props;

        const button = document.createElement('button');
        button.className = `btn btn-${variant} btn-${size} ${fullWidth ? 'btn-full' : ''}`;
        button.disabled = disabled || loading;

        if (loading) {
            button.innerHTML = `
                <span class="loading loading-sm"></span>
                Loading...
            `;
        } else {
            const iconHTML = icon ? `<span class="btn-icon">${icon}</span>` : '';
            button.innerHTML = `${iconHTML}${text}`;
        }

        if (onClick) {
            button.addEventListener('click', onClick);
        }

        return button;
    }

    /**
     * Create card component
     * @param {Object} props - Card properties
     * @returns {HTMLElement} Card element
     */
    createCard(props) {
        const {
            title = '',
            subtitle = '',
            content = '',
            variant = 'default',
            onClick = null,
            actions = null,
            badge = null
        } = props;

        const card = document.createElement('div');
        card.className = `card card-${variant}`;

        const header = title || subtitle ? `
            <div class="card-header">
                ${title ? `<h3 class="card-title">${title}</h3>` : ''}
                ${subtitle ? `<p class="card-subtitle">${subtitle}</p>` : ''}
                ${badge ? `<span class="badge badge-${badge.variant}">${badge.text}</span>` : ''}
            </div>
        ` : '';

        const contentHTML = content ? `<div class="card-content">${content}</div>` : '';

        const footerHTML = actions ? `
            <div class="card-footer">
                ${actions.map(action =>
                    `<button class="btn btn-${action.variant || 'secondary'}" onclick="${action.onClick}">
                        ${action.icon || ''} ${action.text}
                    </button>`
                ).join('')}
            </div>
        ` : '';

        card.innerHTML = `${header}${contentHTML}${footerHTML}`;

        if (onClick) {
            card.style.cursor = 'pointer';
            card.addEventListener('click', (e) => {
                if (!e.target.classList.contains('btn')) {
                    onClick(e, card);
                }
            });
        }

        return card;
    }

    /**
     * Create input component
     * @param {Object} props - Input properties
     * @returns {HTMLElement} Input element
     */
    createInput(props) {
        const {
            type = 'text',
            label = '',
            placeholder = '',
            value = '',
            required = false,
            error = '',
            onChange = null
        } = props;

        const container = document.createElement('div');
        container.className = 'form-group';

        if (label) {
            const labelEl = document.createElement('label');
            labelEl.className = `label${ required ? ' label-required' : ''}`;
            labelEl.textContent = label;
            labelEl.setAttribute('for', `input-${Date.now()}`);
            container.appendChild(labelEl);
        }

        const input = document.createElement('input');
        input.type = type;
        input.className = 'input';
        input.id = label ? `input-${Date.now()}` : undefined;
        input.placeholder = placeholder;
        input.value = value;
        input.required = required;

        if (error) {
            input.classList.add('error');
        }

        if (onChange) {
            input.addEventListener('input', (e) => onChange(e.target.value));
        }

        container.appendChild(input);

        if (error) {
            const errorEl = document.createElement('span');
            errorEl.className = 'error-message';
            errorEl.textContent = error;
            container.appendChild(errorEl);
        }

        return container;
    }

    /**
     * Create badge component
     * @param {Object} props - Badge properties
     * @returns {HTMLElement} Badge element
     */
    createBadge(props) {
        const { text, variant = 'primary', icon = null } = props;

        const badge = document.createElement('span');
        badge.className = `badge badge-${variant}`;
        badge.textContent = text;

        if (icon) {
            badge.innerHTML = `${icon} ${text}`;
        }

        return badge;
    }

    /**
     * Create loading spinner
     * @param {Object} props - Loading properties
     * @returns {HTMLElement} Loading element
     */
    createLoadingSpinner(props) {
        const { size = 'base', text = 'Loading...' } = props;

        const container = document.createElement('div');
        container.className = 'loading-container';
        container.innerHTML = `
            <span class="loading loading-${size}"></span>
            ${text ? `<p class="loading-text">${text}</p>` : ''}
        `;

        return container;
    }

    /**
     * Create progress bar
     * @param {Object} props - Progress properties
     * @returns {HTMLElement} Progress element
     */
    createProgressBar(props) {
        const {
            value = 0,
            max = 100,
            size = 'base',
            showLabel = false,
            color = null
        } = props;

        const percentage = (value / max * 100).toFixed(0);

        const container = document.createElement('div');
        container.className = 'progress-container';

        const progressBar = document.createElement('div');
        progressBar.className = `progress-bar progress-${size}`;

        const progressFill = document.createElement('div');
        progressFill.className = 'progress-fill';
        progressFill.style.width = `${percentage}%`;

        if (color) {
            progressFill.style.background = color;
        }

        progressBar.appendChild(progressFill);
        container.appendChild(progressBar);

        if (showLabel) {
            const label = document.createElement('span');
            label.className = 'progress-label';
            label.textContent = `${percentage}%`;
            container.appendChild(label);
        }

        return container;
    }

    /**
     * Create modal component
     * @param {Object} props - Modal properties
     * @returns {Object} Modal controller
     */
    createModal(props) {
        const {
            title = '',
            content = '',
            onClose = null,
            actions = []
        } = props;

        const backdrop = document.createElement('div');
        backdrop.className = 'modal-backdrop';

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-header">
                <h2 class="modal-title">${title}</h2>
                <button class="modal-close" onclick="modalInstance.close()">×</button>
            </div>
            <div class="modal-body">${content}</div>
            <div class="modal-footer">
                ${actions.map((action, idx) =>
                    `<button class="btn btn-${action.variant || 'primary'}" onclick="modalInstance.executeAction(${idx})">
                        ${action.text}
                    </button>`
                ).join('')}
            </div>
        `;

        backdrop.appendChild(modal);
        document.body.appendChild(backdrop);

        const modalInstance = {
            close: () => {
                document.body.removeChild(backdrop);
                if (onClose) {onClose();}
            },
            executeAction: (index) => {
                if (actions[index] && actions[index].onClick) {
                    actions[index].onClick();
                }
            }
        };

        return modalInstance;
    }

    /**
     * Show toast notification
     * @param {Object} props - Toast properties
     */
    showToast(props) {
        const {
            message = '',
            type = 'info',
            duration = 3000
        } = props;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'toast-slide-down 0.3s ease-out forwards';
            setTimeout(() => {
                if (toast.parentNode) {
                    document.body.removeChild(toast);
                }
            }, 300);
        }, duration);
    }

    /**
     * Create sport-themed icon
     * @param {string} sport - Sport ID
     * @param {string} size - Icon size
     * @returns {HTMLElement} Icon element
     */
    createSportIcon(sport, size = 'base') {
        const sportIcons = {
            soccer: '⚽',
            basketball: '🏀',
            running: '🏃‍♂️',
            general: '💪'
        };

        const icon = document.createElement('div');
        icon.className = `sport-icon sport-icon-${size}`;
        icon.textContent = sportIcons[sport] || '💪';

        return icon;
    }

    /**
     * Create empty state
     * @param {Object} props - Empty state properties
     * @returns {HTMLElement} Empty state element
     */
    createEmptyState(props) {
        const { icon = '📭', title = 'No data', description = '' } = props;

        const container = document.createElement('div');
        container.className = 'empty-state';
        container.innerHTML = `
            <div class="empty-state-icon">${icon}</div>
            <h3 class="empty-state-title">${title}</h3>
            ${description ? `<p class="empty-state-description">${description}</p>` : ''}
        `;

        return container;
    }

    /**
     * Render component
     * @param {string} componentName - Component name
     * @param {Object} props - Component properties
     * @returns {HTMLElement} Rendered component
     */
    render(componentName, props = {}) {
        const component = this.components[componentName];
        if (!component) {
            this.logger.error('Component not found:', componentName);
            return document.createElement('div');
        }

        return component(props);
    }
}

// Create global instance
window.ComponentLibrary = new ComponentLibrary();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ComponentLibrary;
}
