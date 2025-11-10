/**
 * FormValidationManager - Manages accessible form validation with screen reader announcements
 * Provides comprehensive form validation with proper error handling and announcements
 */
class FormValidationManager {
    constructor() {
        this.logger = window.SafeLogger || console;
        this.forms = new Map();
        this.validationRules = new Map();
        this.errorMessages = new Map();

        this.init();
    }

    /**
     * Initialize form validation manager
     */
    init() {
        this.setupEventListeners();
        this.setupDefaultValidationRules();
        this.logger.debug('FormValidationManager initialized');
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Listen for form events
        EventBus.subscribe('form:submit', this.handleFormSubmit.bind(this));
        EventBus.subscribe('form:validate', this.handleFormValidate.bind(this));
        EventBus.subscribe('form:clear', this.handleFormClear.bind(this));
    }

    /**
     * Setup default validation rules
     */
    setupDefaultValidationRules() {
        // Email validation
        this.addValidationRule('email', {
            pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            message: 'Please enter a valid email address',
            required: true
        });

        // Password validation
        this.addValidationRule('password', {
            minLength: 8,
            pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
            message: 'Password must be at least 8 characters with uppercase, lowercase, number, and special character',
            required: true
        });

        // Required field validation
        this.addValidationRule('required', {
            required: true,
            message: 'This field is required'
        });

        // Number validation
        this.addValidationRule('number', {
            pattern: /^\d+$/,
            message: 'Please enter a valid number',
            required: false
        });

        // Phone validation
        this.addValidationRule('phone', {
            pattern: /^[\+]?[1-9][\d]{0,15}$/,
            message: 'Please enter a valid phone number',
            required: false
        });
    }

    /**
     * Add validation rule
     * @param {string} ruleName - Rule name
     * @param {Object} rule - Rule configuration
     */
    addValidationRule(ruleName, rule) {
        this.validationRules.set(ruleName, rule);
    }

    /**
     * Register form for validation
     * @param {string} formId - Form ID
     * @param {Object} options - Form options
     */
    registerForm(formId, options = {}) {
        const form = document.getElementById(formId);
        if (!form) {
            this.logger.warn('Form not found:', formId);
            return;
        }

        const formData = {
            form,
            options: {
                validateOnBlur: true,
                validateOnInput: false,
                announceErrors: true,
                showInlineErrors: true,
                ...options
            },
            fields: new Map(),
            errors: new Map(),
            isValid: true
        };

        // Setup form event listeners
        this.setupFormEventListeners(formData);

        // Register form
        this.forms.set(formId, formData);

        this.logger.debug('Form registered:', formId);
    }

    /**
     * Setup form event listeners
     * @param {Object} formData - Form data object
     */
    setupFormEventListeners(formData) {
        const { form, options } = formData;

        // Form submit
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleFormSubmit({ formId: form.id });
        });

        // Field blur validation
        if (options.validateOnBlur) {
            form.addEventListener('blur', (e) => {
                if (e.target.matches('input, select, textarea')) {
                    this.validateField(e.target, formData);
                }
            }, true);
        }

        // Field input validation
        if (options.validateOnInput) {
            form.addEventListener('input', (e) => {
                if (e.target.matches('input, select, textarea')) {
                    this.validateField(e.target, formData);
                }
            });
        }

        // Field focus
        form.addEventListener('focus', (e) => {
            if (e.target.matches('input, select, textarea')) {
                this.handleFieldFocus(e.target, formData);
            }
        }, true);
    }

    /**
     * Register field for validation
     * @param {string} formId - Form ID
     * @param {string} fieldName - Field name
     * @param {Object} rules - Validation rules
     */
    registerField(formId, fieldName, rules) {
        const formData = this.forms.get(formId);
        if (!formData) {
            this.logger.warn('Form not registered:', formId);
            return;
        }

        const field = formData.form.querySelector(`[name="${fieldName}"]`);
        if (!field) {
            this.logger.warn('Field not found:', fieldName);
            return;
        }

        const fieldData = {
            field,
            rules,
            isValid: true,
            errors: []
        };

        formData.fields.set(fieldName, fieldData);

        this.logger.debug('Field registered:', fieldName);
    }

    /**
     * Validate field
     * @param {HTMLElement} field - Field element
     * @param {Object} formData - Form data object
     */
    validateField(field, formData) {
        const fieldName = field.name;
        const fieldData = formData.fields.get(fieldName);

        if (!fieldData) {
            return;
        }

        const value = field.value.trim();
        const errors = [];

        // Check each rule
        fieldData.rules.forEach(ruleName => {
            const rule = this.validationRules.get(ruleName);
            if (!rule) {
                this.logger.warn('Validation rule not found:', ruleName);
                return;
            }

            const error = this.validateFieldRule(field, value, rule);
            if (error) {
                errors.push(error);
            }
        });

        // Update field validation state
        fieldData.errors = errors;
        fieldData.isValid = errors.length === 0;

        // Update form validation state
        this.updateFormValidationState(formData);

        // Show/hide errors
        this.updateFieldErrorDisplay(field, errors, formData);

        // Announce errors
        if (formData.options.announceErrors && errors.length > 0) {
            this.announceFieldErrors(field, errors);
        }

        return fieldData.isValid;
    }

    /**
     * Validate field against specific rule
     * @param {HTMLElement} field - Field element
     * @param {string} value - Field value
     * @param {Object} rule - Validation rule
     * @returns {string|null} Error message or null
     */
    validateFieldRule(field, value, rule) {
        // Required validation
        if (rule.required && (!value || value.length === 0)) {
            return rule.message || 'This field is required';
        }

        // Skip other validations if field is empty and not required
        if (!value || value.length === 0) {
            return null;
        }

        // Pattern validation
        if (rule.pattern && !rule.pattern.test(value)) {
            return rule.message || 'Invalid format';
        }

        // Minimum length validation
        if (rule.minLength && value.length < rule.minLength) {
            return rule.message || `Minimum length is ${rule.minLength} characters`;
        }

        // Maximum length validation
        if (rule.maxLength && value.length > rule.maxLength) {
            return rule.message || `Maximum length is ${rule.maxLength} characters`;
        }

        // Minimum value validation
        if (rule.min !== undefined && parseFloat(value) < rule.min) {
            return rule.message || `Minimum value is ${rule.min}`;
        }

        // Maximum value validation
        if (rule.max !== undefined && parseFloat(value) > rule.max) {
            return rule.message || `Maximum value is ${rule.max}`;
        }

        return null;
    }

    /**
     * Update form validation state
     * @param {Object} formData - Form data object
     */
    updateFormValidationState(formData) {
        let isValid = true;
        const errors = new Map();

        formData.fields.forEach((fieldData, fieldName) => {
            if (!fieldData.isValid) {
                isValid = false;
                errors.set(fieldName, fieldData.errors);
            }
        });

        formData.isValid = isValid;
        formData.errors = errors;

        // Update form ARIA attributes
        formData.form.setAttribute('aria-invalid', !isValid);
    }

    /**
     * Update field error display
     * @param {HTMLElement} field - Field element
     * @param {Array} errors - Error messages
     * @param {Object} formData - Form data object
     */
    updateFieldErrorDisplay(field, errors, formData) {
        const fieldName = field.name;
        const errorContainerId = `${fieldName}-error`;
        let errorContainer = document.getElementById(errorContainerId);

        // Remove existing error container
        if (errorContainer) {
            errorContainer.remove();
        }

        // Create new error container if there are errors
        if (errors.length > 0 && formData.options.showInlineErrors) {
            errorContainer = document.createElement('div');
            errorContainer.id = errorContainerId;
            errorContainer.className = 'field-error';
            errorContainer.setAttribute('role', 'alert');
            errorContainer.setAttribute('aria-live', 'polite');

            // Add error messages
            errors.forEach(error => {
                const errorElement = document.createElement('div');
                errorElement.className = 'error-message';
                errorElement.textContent = error;
                errorContainer.appendChild(errorElement);
            });

            // Insert after field
            field.parentNode.insertBefore(errorContainer, field.nextSibling);
        }

        // Update field ARIA attributes
        field.setAttribute('aria-invalid', errors.length > 0);
        field.setAttribute('aria-describedby', errors.length > 0 ? errorContainerId : '');
    }

    /**
     * Announce field errors to screen readers
     * @param {HTMLElement} field - Field element
     * @param {Array} errors - Error messages
     */
    announceFieldErrors(field, errors) {
        if (window.LiveRegionManager) {
            const errorMessage = errors.join('. ');
            window.LiveRegionManager.handleErrorAnnouncement({
                error: {
                    type: 'validation',
                    message: errorMessage
                },
                context: {
                    field: field.name,
                    fieldType: field.type
                }
            });
        }
    }

    /**
     * Handle field focus
     * @param {HTMLElement} field - Field element
     * @param {Object} formData - Form data object
     */
    handleFieldFocus(field, formData) {
        const fieldName = field.name;
        const fieldData = formData.fields.get(fieldName);

        if (fieldData && fieldData.errors.length > 0) {
            // Announce existing errors when field is focused
            this.announceFieldErrors(field, fieldData.errors);
        }
    }

    /**
     * Handle form submit
     * @param {Object} data - Form data
     */
    handleFormSubmit(data) {
        const { formId } = data;
        const formData = this.forms.get(formId);

        if (!formData) {
            this.logger.warn('Form not registered:', formId);
            return;
        }

        // Validate all fields
        let isValid = true;
        formData.fields.forEach((fieldData, fieldName) => {
            const {field} = fieldData;
            const fieldValid = this.validateField(field, formData);
            if (!fieldValid) {
                isValid = false;
            }
        });

        if (isValid) {
            // Form is valid, proceed with submission
            this.handleValidForm(formData);
        } else {
            // Form has errors, show validation summary
            this.showValidationSummary(formData);
        }
    }

    /**
     * Handle valid form submission
     * @param {Object} formData - Form data object
     */
    handleValidForm(formData) {
        // Clear any existing errors
        this.clearFormErrors(formData);

        // Announce success
        if (window.LiveRegionManager) {
            window.LiveRegionManager.handleSuccessAnnouncement({
                type: 'form-submitted',
                message: 'Form submitted successfully'
            });
        }

        // Publish success event
        EventBus.publish('form:valid', { formId: formData.form.id });
    }

    /**
     * Show validation summary
     * @param {Object} formData - Form data object
     */
    showValidationSummary(formData) {
        const summaryId = `${formData.form.id}-validation-summary`;
        let summary = document.getElementById(summaryId);

        // Remove existing summary
        if (summary) {
            summary.remove();
        }

        // Create validation summary
        summary = document.createElement('div');
        summary.id = summaryId;
        summary.className = 'validation-summary';
        summary.setAttribute('role', 'alert');
        summary.setAttribute('aria-live', 'assertive');

        const summaryTitle = document.createElement('h3');
        summaryTitle.textContent = 'Please correct the following errors:';
        summary.appendChild(summaryTitle);

        const errorList = document.createElement('ul');
        errorList.className = 'error-list';

        formData.errors.forEach((errors, fieldName) => {
            const fieldData = formData.fields.get(fieldName);
            if (fieldData) {
                errors.forEach(error => {
                    const listItem = document.createElement('li');
                    const link = document.createElement('a');
                    link.href = `#${fieldName}`;
                    link.textContent = `${fieldData.field.getAttribute('aria-label') || fieldName}: ${error}`;
                    link.addEventListener('click', (e) => {
                        e.preventDefault();
                        fieldData.field.focus();
                    });
                    listItem.appendChild(link);
                    errorList.appendChild(listItem);
                });
            }
        });

        summary.appendChild(errorList);

        // Insert at beginning of form
        formData.form.insertBefore(summary, formData.form.firstChild);

        // Focus on summary
        summary.focus();

        // Announce validation summary
        if (window.LiveRegionManager) {
            const errorCount = Array.from(formData.errors.values()).reduce((sum, errors) => sum + errors.length, 0);
            window.LiveRegionManager.handleErrorAnnouncement({
                error: {
                    type: 'validation',
                    message: `Form has ${errorCount} validation errors`
                }
            });
        }
    }

    /**
     * Clear form errors
     * @param {Object} formData - Form data object
     */
    clearFormErrors(formData) {
        // Clear field errors
        formData.fields.forEach((fieldData, fieldName) => {
            const {field} = fieldData;
            const errorContainerId = `${fieldName}-error`;
            const errorContainer = document.getElementById(errorContainerId);

            if (errorContainer) {
                errorContainer.remove();
            }

            field.setAttribute('aria-invalid', 'false');
            field.removeAttribute('aria-describedby');
        });

        // Clear validation summary
        const summaryId = `${formData.form.id}-validation-summary`;
        const summary = document.getElementById(summaryId);
        if (summary) {
            summary.remove();
        }

        // Reset form validation state
        formData.isValid = true;
        formData.errors.clear();
        formData.form.setAttribute('aria-invalid', 'false');
    }

    /**
     * Handle form validate event
     * @param {Object} data - Form data
     */
    handleFormValidate(data) {
        const { formId } = data;
        const formData = this.forms.get(formId);

        if (!formData) {
            return;
        }

        // Validate all fields
        formData.fields.forEach((fieldData, fieldName) => {
            const {field} = fieldData;
            this.validateField(field, formData);
        });
    }

    /**
     * Handle form clear event
     * @param {Object} data - Form data
     */
    handleFormClear(data) {
        const { formId } = data;
        const formData = this.forms.get(formId);

        if (!formData) {
            return;
        }

        this.clearFormErrors(formData);
    }

    /**
     * Get form validation state
     * @param {string} formId - Form ID
     * @returns {Object} Form validation state
     */
    getFormValidationState(formId) {
        const formData = this.forms.get(formId);
        if (!formData) {
            return null;
        }

        return {
            isValid: formData.isValid,
            errors: formData.errors,
            fields: formData.fields
        };
    }

    /**
     * Get field validation state
     * @param {string} formId - Form ID
     * @param {string} fieldName - Field name
     * @returns {Object} Field validation state
     */
    getFieldValidationState(formId, fieldName) {
        const formData = this.forms.get(formId);
        if (!formData) {
            return null;
        }

        const fieldData = formData.fields.get(fieldName);
        if (!fieldData) {
            return null;
        }

        return {
            isValid: fieldData.isValid,
            errors: fieldData.errors
        };
    }
}

// Create global instance
window.FormValidationManager = new FormValidationManager();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FormValidationManager;
}
