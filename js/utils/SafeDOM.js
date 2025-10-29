/**
 * Safe DOM Utilities
 * Provides null-safe DOM operation helpers
 */

window.SafeDOM = {
    /**
     * Safely get element by ID
     * @param {string} id - Element ID
     * @returns {HTMLElement|null} Element or null
     */
    getElement(id) {
        return document.getElementById(id);
    },

    /**
     * Safely get element value
     * @param {string} id - Element ID
     * @param {*} defaultValue - Default value if element doesn't exist
     * @returns {string|*} Element value or default
     */
    getValue(id, defaultValue = '') {
        const el = document.getElementById(id);
        return el ? (el.value || defaultValue) : defaultValue;
    },

    /**
     * Safely set element value
     * @param {string} id - Element ID
     * @param {*} value - Value to set
     * @returns {boolean} Success status
     */
    setValue(id, value) {
        const el = document.getElementById(id);
        if (el && 'value' in el) {
            el.value = value;
            return true;
        }
        return false;
    },

    /**
     * Safely manipulate classList
     * @param {string} id - Element ID
     * @param {string} method - classList method ('add', 'remove', 'toggle')
     * @param {string} className - Class name
     * @returns {boolean} Success status
     */
    classList(id, method, className) {
        const el = document.getElementById(id);
        if (el && el.classList) {
            el.classList[method](className);
            return true;
        }
        return false;
    },

    /**
     * Safely set innerHTML
     * @param {string} id - Element ID
     * @param {string} html - HTML content
     * @returns {boolean} Success status
     */
    setHTML(id, html) {
        const el = document.getElementById(id);
        if (el) {
            el.innerHTML = html;
            return true;
        }
        return false;
    },

    /**
     * Safely set textContent
     * @param {string} id - Element ID
     * @param {string} text - Text content
     * @returns {boolean} Success status
     */
    setText(id, text) {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = text;
            return true;
        }
        return false;
    },

    /**
     * Safely set style property
     * @param {string} id - Element ID
     * @param {string} property - Style property
     * @param {string} value - Style value
     * @returns {boolean} Success status
     */
    setStyle(id, property, value) {
        const el = document.getElementById(id);
        if (el && el.style) {
            el.style[property] = value;
            return true;
        }
        return false;
    }
};

