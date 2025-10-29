/**
 * VirtualList - High-performance virtual scrolling for large lists
 * Renders only visible items to maintain 60fps scrolling performance
 */
class VirtualList {
    constructor(options = {}) {
        this.container = options.container;
        this.itemHeight = options.itemHeight || 60;
        this.overscan = options.overscan || 5; // Extra items to render outside viewport
        this.renderItem = options.renderItem; // Function to render each item
        this.items = options.items || [];
        this.filteredItems = [...this.items];
        
        // Performance tracking
        this.frameCount = 0;
        this.lastFrameTime = 0;
        this.fps = 0;
        
        // State
        this.scrollTop = 0;
        this.containerHeight = 0;
        this.isScrolling = false;
        this.scrollTimeout = null;
        
        // DOM elements
        this.scrollContainer = null;
        this.viewport = null;
        this.spacer = null;
        
        // Accessibility
        this.focusedIndex = -1;
        this.ariaLiveRegion = null;
        
        this.logger = window.SafeLogger || console;
        
        this.init();
    }
    
    /**
     * Initialize virtual list
     */
    init() {
        this.createDOM();
        this.bindEvents();
        this.update();
        
        this.logger.debug('VirtualList initialized', {
            itemCount: this.items.length,
            itemHeight: this.itemHeight,
            containerHeight: this.containerHeight
        });
    }
    
    /**
     * Create DOM structure
     */
    createDOM() {
        // Clear container
        this.container.innerHTML = '';
        
        // Create scroll container
        this.scrollContainer = document.createElement('div');
        this.scrollContainer.className = 'virtual-list-container';
        this.scrollContainer.style.cssText = `
            height: 100%;
            overflow-y: auto;
            overflow-x: hidden;
            position: relative;
            scroll-behavior: smooth;
        `;
        
        // Create viewport
        this.viewport = document.createElement('div');
        this.viewport.className = 'virtual-list-viewport';
        this.viewport.style.cssText = `
            position: relative;
            width: 100%;
        `;
        
        // Create spacer for total height
        this.spacer = document.createElement('div');
        this.spacer.className = 'virtual-list-spacer';
        this.spacer.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            pointer-events: none;
        `;
        
        // Create items container
        this.itemsContainer = document.createElement('div');
        this.itemsContainer.className = 'virtual-list-items';
        this.itemsContainer.style.cssText = `
            position: relative;
            width: 100%;
        `;
        
        // Assemble DOM
        this.viewport.appendChild(this.spacer);
        this.viewport.appendChild(this.itemsContainer);
        this.scrollContainer.appendChild(this.viewport);
        this.container.appendChild(this.scrollContainer);
        
        // Create accessibility elements
        this.createAccessibilityElements();
    }
    
    /**
     * Create accessibility elements
     */
    createAccessibilityElements() {
        // ARIA live region for announcements
        this.ariaLiveRegion = document.createElement('div');
        this.ariaLiveRegion.setAttribute('aria-live', 'polite');
        this.ariaLiveRegion.setAttribute('aria-atomic', 'true');
        this.ariaLiveRegion.className = 'sr-only';
        this.ariaLiveRegion.style.cssText = `
            position: absolute;
            left: -10000px;
            width: 1px;
            height: 1px;
            overflow: hidden;
        `;
        this.container.appendChild(this.ariaLiveRegion);
        
        // Set ARIA attributes
        this.scrollContainer.setAttribute('role', 'listbox');
        this.scrollContainer.setAttribute('aria-label', 'Exercise list');
        this.scrollContainer.setAttribute('tabindex', '0');
    }
    
    /**
     * Bind event listeners
     */
    bindEvents() {
        // Scroll events
        this.scrollContainer.addEventListener('scroll', this.handleScroll.bind(this));
        
        // Keyboard navigation
        this.scrollContainer.addEventListener('keydown', this.handleKeydown.bind(this));
        
        // Focus management
        this.scrollContainer.addEventListener('focus', this.handleFocus.bind(this));
        this.scrollContainer.addEventListener('blur', this.handleBlur.bind(this));
        
        // Resize observer
        if (window.ResizeObserver) {
            this.resizeObserver = new ResizeObserver(this.handleResize.bind(this));
            this.resizeObserver.observe(this.container);
        }
        
        // Performance monitoring
        this.startPerformanceMonitoring();
    }
    
    /**
     * Handle scroll events
     */
    handleScroll(event) {
        this.scrollTop = event.target.scrollTop;
        this.isScrolling = true;
        
        // Clear previous timeout
        if (this.scrollTimeout) {
            clearTimeout(this.scrollTimeout);
        }
        
        // Set timeout to detect scroll end
        this.scrollTimeout = setTimeout(() => {
            this.isScrolling = false;
            this.announceScrollPosition();
        }, 150);
        
        this.update();
    }
    
    /**
     * Handle keyboard navigation
     */
    handleKeydown(event) {
        const { key } = event;
        
        switch (key) {
            case 'ArrowDown':
                event.preventDefault();
                this.focusNext();
                break;
            case 'ArrowUp':
                event.preventDefault();
                this.focusPrevious();
                break;
            case 'Home':
                event.preventDefault();
                this.focusFirst();
                break;
            case 'End':
                event.preventDefault();
                this.focusLast();
                break;
            case 'Enter':
            case ' ':
                event.preventDefault();
                this.selectFocused();
                break;
        }
    }
    
    /**
     * Handle focus events
     */
    handleFocus() {
        if (this.focusedIndex === -1) {
            this.focusFirst();
        }
    }
    
    /**
     * Handle blur events
     */
    handleBlur() {
        this.focusedIndex = -1;
    }
    
    /**
     * Handle resize events
     */
    handleResize(entries) {
        const entry = entries[0];
        this.containerHeight = entry.contentRect.height;
        this.update();
    }
    
    /**
     * Update virtual list
     */
    update() {
        if (!this.containerHeight) {
            this.containerHeight = this.container.offsetHeight;
        }
        
        const totalHeight = this.filteredItems.length * this.itemHeight;
        const visibleCount = Math.ceil(this.containerHeight / this.itemHeight);
        
        // Calculate visible range
        const startIndex = Math.max(0, Math.floor(this.scrollTop / this.itemHeight) - this.overscan);
        const endIndex = Math.min(
            this.filteredItems.length - 1,
            startIndex + visibleCount + this.overscan * 2
        );
        
        // Update spacer height
        this.spacer.style.height = `${totalHeight}px`;
        
        // Update items container position
        this.itemsContainer.style.transform = `translateY(${startIndex * this.itemHeight}px)`;
        
        // Render visible items
        this.renderVisibleItems(startIndex, endIndex);
        
        // Update accessibility
        this.updateAccessibility(startIndex, endIndex);
    }
    
    /**
     * Render visible items
     */
    renderVisibleItems(startIndex, endIndex) {
        // Clear existing items
        this.itemsContainer.innerHTML = '';
        
        // Create document fragment for performance
        const fragment = document.createDocumentFragment();
        
        for (let i = startIndex; i <= endIndex; i++) {
            const item = this.filteredItems[i];
            if (!item) continue;
            
            const itemElement = this.createItemElement(item, i);
            fragment.appendChild(itemElement);
        }
        
        this.itemsContainer.appendChild(fragment);
    }
    
    /**
     * Create item element
     */
    createItemElement(item, index) {
        const element = document.createElement('div');
        element.className = 'virtual-list-item';
        element.style.cssText = `
            height: ${this.itemHeight}px;
            display: flex;
            align-items: center;
            padding: 0 16px;
            border-bottom: 1px solid var(--color-border);
            cursor: pointer;
            transition: background-color 0.2s ease;
        `;
        
        element.setAttribute('role', 'option');
        element.setAttribute('aria-posinset', index + 1);
        element.setAttribute('aria-setsize', this.filteredItems.length);
        element.setAttribute('data-index', index);
        
        // Render item content
        if (this.renderItem) {
            const content = this.renderItem(item, index);
            if (typeof content === 'string') {
                element.innerHTML = content;
            } else if (content instanceof HTMLElement) {
                element.appendChild(content);
            }
        } else {
            element.textContent = item.name || item.title || `Item ${index + 1}`;
        }
        
        // Add hover effects
        element.addEventListener('mouseenter', () => {
            element.style.backgroundColor = 'var(--color-surface-hover)';
        });
        
        element.addEventListener('mouseleave', () => {
            element.style.backgroundColor = '';
        });
        
        // Add click handler
        element.addEventListener('click', () => {
            this.selectItem(index);
        });
        
        return element;
    }
    
    /**
     * Update accessibility attributes
     */
    updateAccessibility(startIndex, endIndex) {
        // Update aria-setsize for all visible items
        const items = this.itemsContainer.querySelectorAll('.virtual-list-item');
        items.forEach((item, i) => {
            const index = parseInt(item.dataset.index);
            item.setAttribute('aria-posinset', index + 1);
            item.setAttribute('aria-setsize', this.filteredItems.length);
        });
        
        // Update focused item
        if (this.focusedIndex >= 0) {
            const focusedItem = this.itemsContainer.querySelector(`[data-index="${this.focusedIndex}"]`);
            if (focusedItem) {
                focusedItem.setAttribute('aria-selected', 'true');
                focusedItem.style.backgroundColor = 'var(--color-primary-light)';
            }
        }
    }
    
    /**
     * Focus next item
     */
    focusNext() {
        if (this.focusedIndex < this.filteredItems.length - 1) {
            this.focusedIndex++;
            this.scrollToFocused();
        }
    }
    
    /**
     * Focus previous item
     */
    focusPrevious() {
        if (this.focusedIndex > 0) {
            this.focusedIndex--;
            this.scrollToFocused();
        }
    }
    
    /**
     * Focus first item
     */
    focusFirst() {
        this.focusedIndex = 0;
        this.scrollToFocused();
    }
    
    /**
     * Focus last item
     */
    focusLast() {
        this.focusedIndex = this.filteredItems.length - 1;
        this.scrollToFocused();
    }
    
    /**
     * Scroll to focused item
     */
    scrollToFocused() {
        if (this.focusedIndex >= 0) {
            const targetScrollTop = this.focusedIndex * this.itemHeight;
            this.scrollContainer.scrollTop = targetScrollTop;
        }
    }
    
    /**
     * Select focused item
     */
    selectFocused() {
        if (this.focusedIndex >= 0) {
            this.selectItem(this.focusedIndex);
        }
    }
    
    /**
     * Select item by index
     */
    selectItem(index) {
        const item = this.filteredItems[index];
        if (item) {
            this.dispatchEvent('itemSelected', { item, index });
        }
    }
    
    /**
     * Filter items
     */
    filter(predicate) {
        this.filteredItems = this.items.filter(predicate);
        this.focusedIndex = -1;
        this.scrollTop = 0;
        this.scrollContainer.scrollTop = 0;
        this.update();
        
        this.announceFilterResults();
    }
    
    /**
     * Set items
     */
    setItems(items) {
        this.items = items;
        this.filteredItems = [...items];
        this.focusedIndex = -1;
        this.scrollTop = 0;
        this.scrollContainer.scrollTop = 0;
        this.update();
    }
    
    /**
     * Scroll to item
     */
    scrollToItem(index) {
        const targetScrollTop = index * this.itemHeight;
        this.scrollContainer.scrollTop = targetScrollTop;
    }
    
    /**
     * Announce scroll position for screen readers
     */
    announceScrollPosition() {
        const visibleStart = Math.floor(this.scrollTop / this.itemHeight) + 1;
        const visibleEnd = Math.min(
            this.filteredItems.length,
            visibleStart + Math.ceil(this.containerHeight / this.itemHeight) - 1
        );
        
        this.announce(`Showing items ${visibleStart} to ${visibleEnd} of ${this.filteredItems.length}`);
    }
    
    /**
     * Announce filter results
     */
    announceFilterResults() {
        this.announce(`${this.filteredItems.length} items found`);
    }
    
    /**
     * Announce message to screen readers
     */
    announce(message) {
        if (this.ariaLiveRegion) {
            this.ariaLiveRegion.textContent = message;
        }
    }
    
    /**
     * Start performance monitoring
     */
    startPerformanceMonitoring() {
        const monitor = () => {
            this.frameCount++;
            const now = performance.now();
            
            if (now - this.lastFrameTime >= 1000) {
                this.fps = Math.round((this.frameCount * 1000) / (now - this.lastFrameTime));
                this.frameCount = 0;
                this.lastFrameTime = now;
                
                if (this.fps < 30) {
                    this.logger.warn(`Low FPS detected: ${this.fps}`);
                }
            }
            
            requestAnimationFrame(monitor);
        };
        
        requestAnimationFrame(monitor);
    }
    
    /**
     * Dispatch custom events
     */
    dispatchEvent(eventName, detail) {
        const event = new CustomEvent(eventName, { detail });
        this.container.dispatchEvent(event);
    }
    
    /**
     * Get performance stats
     */
    getPerformanceStats() {
        return {
            fps: this.fps,
            itemCount: this.filteredItems.length,
            visibleItems: Math.ceil(this.containerHeight / this.itemHeight),
            memoryUsage: this.estimateMemoryUsage()
        };
    }
    
    /**
     * Estimate memory usage
     */
    estimateMemoryUsage() {
        const visibleItems = Math.ceil(this.containerHeight / this.itemHeight) + this.overscan * 2;
        return visibleItems * 1024; // Rough estimate in bytes
    }
    
    /**
     * Destroy virtual list
     */
    destroy() {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        
        if (this.scrollTimeout) {
            clearTimeout(this.scrollTimeout);
        }
        
        this.container.innerHTML = '';
    }
}

// Export for use in other modules
window.VirtualList = VirtualList;
