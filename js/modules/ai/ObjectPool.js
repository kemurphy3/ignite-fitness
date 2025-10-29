/**
 * ObjectPool - Generic object pooling for frequent allocations
 * Reduces garbage collection pressure by reusing objects
 */
class ObjectPool {
    constructor(createFn, resetFn, initialSize = 10, maxSize = 100) {
        this.createFn = createFn;
        this.resetFn = resetFn;
        this.maxSize = maxSize;
        this.pool = [];
        this.activeObjects = new Set();
        
        this.stats = {
            created: 0,
            reused: 0,
            destroyed: 0,
            peakActive: 0,
            currentActive: 0
        };
        
        this.logger = window.SafeLogger || console;
        
        // Pre-populate pool
        this.prePopulate(initialSize);
        
        this.logger.info('ObjectPool initialized', {
            initialSize,
            maxSize,
            type: createFn.name || 'anonymous'
        });
    }
    
    /**
     * Pre-populate pool with initial objects
     * @param {number} size - Number of objects to create
     */
    prePopulate(size) {
        for (let i = 0; i < size; i++) {
            const obj = this.createFn();
            this.pool.push(obj);
            this.stats.created++;
        }
    }
    
    /**
     * Get object from pool
     * @param {...any} args - Arguments to pass to reset function
     * @returns {Object} Pooled object
     */
    acquire(...args) {
        let obj;
        
        if (this.pool.length > 0) {
            // Reuse existing object
            obj = this.pool.pop();
            this.stats.reused++;
        } else {
            // Create new object if pool is empty
            obj = this.createFn();
            this.stats.created++;
        }
        
        // Reset object state
        if (this.resetFn) {
            this.resetFn(obj, ...args);
        }
        
        // Track active object
        this.activeObjects.add(obj);
        this.stats.currentActive = this.activeObjects.size;
        this.stats.peakActive = Math.max(this.stats.peakActive, this.stats.currentActive);
        
        return obj;
    }
    
    /**
     * Return object to pool
     * @param {Object} obj - Object to return
     */
    release(obj) {
        if (!this.activeObjects.has(obj)) {
            this.logger.warn('Attempted to release object not from this pool');
            return;
        }
        
        // Remove from active set
        this.activeObjects.delete(obj);
        this.stats.currentActive = this.activeObjects.size;
        
        // Add back to pool if not at max size
        if (this.pool.length < this.maxSize) {
            this.pool.push(obj);
        } else {
            // Pool is full, destroy object
            this.stats.destroyed++;
        }
    }
    
    /**
     * Release all active objects
     */
    releaseAll() {
        this.activeObjects.forEach(obj => {
            this.release(obj);
        });
    }
    
    /**
     * Clear entire pool
     */
    clear() {
        this.pool.length = 0;
        this.activeObjects.clear();
        this.stats.currentActive = 0;
        
        this.logger.info('ObjectPool cleared');
    }
    
    /**
     * Get pool statistics
     * @returns {Object} Pool statistics
     */
    getStats() {
        return {
            ...this.stats,
            poolSize: this.pool.length,
            maxSize: this.maxSize,
            utilizationRate: this.stats.currentActive / this.maxSize,
            reuseRate: this.stats.reused / (this.stats.reused + this.stats.created)
        };
    }
}

/**
 * Vector2D Pool - Specialized pool for 2D vectors
 */
class Vector2DPool extends ObjectPool {
    constructor(initialSize = 50, maxSize = 200) {
        super(
            () => ({ x: 0, y: 0 }),
            (vec, x = 0, y = 0) => {
                vec.x = x;
                vec.y = y;
            },
            initialSize,
            maxSize
        );
    }
}

/**
 * Vector3D Pool - Specialized pool for 3D vectors
 */
class Vector3DPool extends ObjectPool {
    constructor(initialSize = 50, maxSize = 200) {
        super(
            () => ({ x: 0, y: 0, z: 0 }),
            (vec, x = 0, y = 0, z = 0) => {
                vec.x = x;
                vec.y = y;
                vec.z = z;
            },
            initialSize,
            maxSize
        );
    }
}

/**
 * Matrix Pool - Specialized pool for transformation matrices
 */
class MatrixPool extends ObjectPool {
    constructor(initialSize = 20, maxSize = 100) {
        super(
            () => new Array(16).fill(0),
            (matrix, values = null) => {
                if (values) {
                    matrix.set(values);
                } else {
                    matrix.fill(0);
                }
            },
            initialSize,
            maxSize
        );
    }
}

/**
 * Event Pool - Specialized pool for event objects
 */
class EventPool extends ObjectPool {
    constructor(initialSize = 100, maxSize = 500) {
        super(
            () => ({
                type: '',
                target: null,
                data: null,
                timestamp: 0,
                preventDefault: false,
                stopPropagation: false
            }),
            (event, type = '', target = null, data = null) => {
                event.type = type;
                event.target = target;
                event.data = data;
                event.timestamp = Date.now();
                event.preventDefault = false;
                event.stopPropagation = false;
            },
            initialSize,
            maxSize
        );
    }
}

/**
 * DOM Element Pool - Specialized pool for DOM elements
 */
class DOMElementPool extends ObjectPool {
    constructor(tagName = 'div', initialSize = 20, maxSize = 100) {
        super(
            () => document.createElement(tagName),
            (element, attributes = {}) => {
                // Clear element
                element.innerHTML = '';
                element.className = '';
                
                // Reset attributes
                Array.from(element.attributes).forEach(attr => {
                    if (attr.name !== 'id') {
                        element.removeAttribute(attr.name);
                    }
                });
                
                // Set new attributes
                Object.entries(attributes).forEach(([key, value]) => {
                    element.setAttribute(key, value);
                });
            },
            initialSize,
            maxSize
        );
    }
}

/**
 * Calculation Pool - Specialized pool for calculation objects
 */
class CalculationPool extends ObjectPool {
    constructor(initialSize = 30, maxSize = 150) {
        super(
            () => ({
                result: 0,
                intermediate: [],
                errors: [],
                metadata: {}
            }),
            (calc, initialValue = 0) => {
                calc.result = initialValue;
                calc.intermediate.length = 0;
                calc.errors.length = 0;
                calc.metadata = {};
            },
            initialSize,
            maxSize
        );
    }
}

/**
 * PoolManager - Centralized management of all object pools
 */
class PoolManager {
    constructor() {
        this.pools = new Map();
        this.logger = window.SafeLogger || console;
        
        // Initialize common pools
        this.initializeCommonPools();
        
        this.logger.info('PoolManager initialized');
    }
    
    /**
     * Initialize common object pools
     */
    initializeCommonPools() {
        // Vector pools
        this.pools.set('vector2d', new Vector2DPool());
        this.pools.set('vector3d', new Vector3DPool());
        
        // Matrix pool
        this.pools.set('matrix', new MatrixPool());
        
        // Event pool
        this.pools.set('event', new EventPool());
        
        // DOM element pools
        this.pools.set('div', new DOMElementPool('div'));
        this.pools.set('span', new DOMElementPool('span'));
        this.pools.set('button', new DOMElementPool('button'));
        
        // Calculation pool
        this.pools.set('calculation', new CalculationPool());
    }
    
    /**
     * Get pool by name
     * @param {string} name - Pool name
     * @returns {ObjectPool} Pool instance
     */
    getPool(name) {
        return this.pools.get(name);
    }
    
    /**
     * Create new pool
     * @param {string} name - Pool name
     * @param {ObjectPool} pool - Pool instance
     */
    createPool(name, pool) {
        this.pools.set(name, pool);
        this.logger.info(`Pool created: ${name}`);
    }
    
    /**
     * Acquire object from pool
     * @param {string} poolName - Pool name
     * @param {...any} args - Arguments for reset function
     * @returns {Object} Pooled object
     */
    acquire(poolName, ...args) {
        const pool = this.pools.get(poolName);
        if (!pool) {
            this.logger.error(`Pool not found: ${poolName}`);
            return null;
        }
        
        return pool.acquire(...args);
    }
    
    /**
     * Release object to pool
     * @param {string} poolName - Pool name
     * @param {Object} obj - Object to release
     */
    release(poolName, obj) {
        const pool = this.pools.get(poolName);
        if (!pool) {
            this.logger.error(`Pool not found: ${poolName}`);
            return;
        }
        
        pool.release(obj);
    }
    
    /**
     * Release all objects from all pools
     */
    releaseAll() {
        this.pools.forEach(pool => {
            pool.releaseAll();
        });
    }
    
    /**
     * Clear all pools
     */
    clearAll() {
        this.pools.forEach(pool => {
            pool.clear();
        });
    }
    
    /**
     * Get statistics for all pools
     * @returns {Object} Combined statistics
     */
    getAllStats() {
        const stats = {};
        this.pools.forEach((pool, name) => {
            stats[name] = pool.getStats();
        });
        
        return stats;
    }
    
    /**
     * Get total memory usage estimate
     * @returns {number} Estimated memory usage in bytes
     */
    getTotalMemoryUsage() {
        let total = 0;
        this.pools.forEach(pool => {
            const poolStats = pool.getStats();
            total += poolStats.currentActive * 100; // Rough estimate
        });
        
        return total;
    }
}

// Global pool manager instance
const poolManager = new PoolManager();

// Export for use in other modules
window.ObjectPool = ObjectPool;
window.Vector2DPool = Vector2DPool;
window.Vector3DPool = Vector3DPool;
window.MatrixPool = MatrixPool;
window.EventPool = EventPool;
window.DOMElementPool = DOMElementPool;
window.CalculationPool = CalculationPool;
window.PoolManager = PoolManager;
window.poolManager = poolManager;
