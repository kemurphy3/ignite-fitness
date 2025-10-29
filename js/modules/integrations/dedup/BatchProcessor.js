/**
 * BatchProcessor - Processes activities in chunks with progress indicators
 * Prevents UI blocking during large data processing operations
 */
class BatchProcessor {
    constructor(options = {}) {
        this.batchSize = options.batchSize || 5;
        this.yieldInterval = options.yieldInterval || 16; // ~60fps
        this.progressCallback = options.progressCallback || null;
        this.completionCallback = options.completionCallback || null;
        this.errorCallback = options.errorCallback || null;
        
        this.isProcessing = false;
        this.currentBatch = 0;
        this.totalBatches = 0;
        this.processedItems = 0;
        this.totalItems = 0;
        this.results = [];
        this.errors = [];
        
        this.logger = window.SafeLogger || console;
    }
    
    /**
     * Process items in batches with progress tracking
     * @param {Array} items - Items to process
     * @param {Function} processor - Function to process each item
     * @param {Object} context - Additional context for processing
     * @returns {Promise} Promise resolving to processing results
     */
    async processBatch(items, processor, context = {}) {
        if (this.isProcessing) {
            throw new Error('Batch processing already in progress');
        }
        
        this.isProcessing = true;
        this.totalItems = items.length;
        this.totalBatches = Math.ceil(items.length / this.batchSize);
        this.currentBatch = 0;
        this.processedItems = 0;
        this.results = [];
        this.errors = [];
        
        this.logger.debug(`Starting batch processing: ${this.totalItems} items in ${this.totalBatches} batches`);
        
        try {
            // Process items in batches
            for (let i = 0; i < items.length; i += this.batchSize) {
                const batch = items.slice(i, i + this.batchSize);
                const batchIndex = Math.floor(i / this.batchSize);
                
                await this.processBatchChunk(batch, batchIndex, processor, context);
                
                // Yield to main thread
                await this.yieldToMainThread();
            }
            
            // Processing completed
            this.isProcessing = false;
            
            if (this.completionCallback) {
                this.completionCallback({
                    totalItems: this.totalItems,
                    processedItems: this.processedItems,
                    results: this.results,
                    errors: this.errors,
                    successRate: this.processedItems / this.totalItems
                });
            }
            
            return {
                totalItems: this.totalItems,
                processedItems: this.processedItems,
                results: this.results,
                errors: this.errors,
                successRate: this.processedItems / this.totalItems
            };
            
        } catch (error) {
            this.isProcessing = false;
            this.logger.error('Batch processing failed:', error);
            
            if (this.errorCallback) {
                this.errorCallback(error);
            }
            
            throw error;
        }
    }
    
    /**
     * Process a single batch chunk
     * @param {Array} batch - Batch of items to process
     * @param {number} batchIndex - Index of current batch
     * @param {Function} processor - Processing function
     * @param {Object} context - Processing context
     */
    async processBatchChunk(batch, batchIndex, processor, context) {
        this.currentBatch = batchIndex;
        
        this.logger.debug(`Processing batch ${batchIndex + 1}/${this.totalBatches} (${batch.length} items)`);
        
        // Process each item in the batch
        for (let i = 0; i < batch.length; i++) {
            const item = batch[i];
            const itemIndex = batchIndex * this.batchSize + i;
            
            try {
                const result = await processor(item, itemIndex, context);
                this.results.push(result);
                this.processedItems++;
                
                // Update progress
                this.updateProgress(itemIndex + 1);
                
            } catch (error) {
                this.logger.error(`Error processing item ${itemIndex}:`, error);
                this.errors.push({
                    itemIndex,
                    item,
                    error: error.message
                });
            }
        }
    }
    
    /**
     * Update progress and notify callback
     * @param {number} processed - Number of items processed
     */
    updateProgress(processed) {
        const progress = {
            processed,
            total: this.totalItems,
            percentage: Math.round((processed / this.totalItems) * 100),
            currentBatch: this.currentBatch + 1,
            totalBatches: this.totalBatches,
            batchProgress: Math.round(((this.currentBatch + 1) / this.totalBatches) * 100),
            estimatedTimeRemaining: this.estimateTimeRemaining(processed),
            processedPerSecond: this.calculateProcessingRate(processed)
        };
        
        if (this.progressCallback) {
            this.progressCallback(progress);
        }
    }
    
    /**
     * Yield control to main thread
     * @returns {Promise} Promise that resolves after yielding
     */
    yieldToMainThread() {
        return new Promise(resolve => {
            setTimeout(resolve, this.yieldInterval);
        });
    }
    
    /**
     * Estimate time remaining based on processing rate
     * @param {number} processed - Number of items processed
     * @returns {number} Estimated seconds remaining
     */
    estimateTimeRemaining(processed) {
        if (processed === 0) return 0;
        
        const startTime = this.startTime || (this.startTime = Date.now());
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = processed / elapsed;
        const remaining = this.totalItems - processed;
        
        return Math.round(remaining / rate);
    }
    
    /**
     * Calculate processing rate
     * @param {number} processed - Number of items processed
     * @returns {number} Items processed per second
     */
    calculateProcessingRate(processed) {
        if (processed === 0) return 0;
        
        const startTime = this.startTime || (this.startTime = Date.now());
        const elapsed = (Date.now() - startTime) / 1000;
        
        return Math.round(processed / elapsed);
    }
    
    /**
     * Cancel processing
     */
    cancel() {
        if (this.isProcessing) {
            this.isProcessing = false;
            this.logger.debug('Batch processing cancelled');
        }
    }
    
    /**
     * Reset processor state
     */
    reset() {
        this.isProcessing = false;
        this.currentBatch = 0;
        this.totalBatches = 0;
        this.processedItems = 0;
        this.totalItems = 0;
        this.results = [];
        this.errors = [];
        this.startTime = null;
    }
    
    /**
     * Get current processing status
     * @returns {Object} Current status
     */
    getStatus() {
        return {
            isProcessing: this.isProcessing,
            currentBatch: this.currentBatch,
            totalBatches: this.totalBatches,
            processedItems: this.processedItems,
            totalItems: this.totalItems,
            percentage: this.totalItems > 0 ? Math.round((this.processedItems / this.totalItems) * 100) : 0,
            results: this.results.length,
            errors: this.errors.length
        };
    }
}

// Export for use in other modules
window.BatchProcessor = BatchProcessor;
