/**
 * Transaction Rollback Manager
 * Provides compensating transactions for failed activity merges
 */

const { createLogger } = require('./safe-logging');

class TransactionRollbackManager {
    constructor(supabase) {
        this.supabase = supabase;
        this.logger = createLogger('TransactionRollbackManager');
        this.compensatingActions = new Map(); // Track actions for rollback
    }

    /**
     * Start tracking a transaction for potential rollback
     * @param {string} transactionId - Unique transaction identifier
     * @param {Object} initialState - Initial state before transaction
     */
    startTransaction(transactionId, initialState = {}) {
        this.compensatingActions.set(transactionId, {
            initialState,
            actions: [],
            startedAt: new Date().toISOString()
        });
        this.logger.debug(`Started tracking transaction ${transactionId}`);
    }

    /**
     * Record an action that needs to be compensated if transaction fails
     * @param {string} transactionId - Transaction identifier
     * @param {string} actionType - Type of action (insert, update, delete)
     * @param {Object} actionData - Data needed for compensation
     */
    recordAction(transactionId, actionType, actionData) {
        const transaction = this.compensatingActions.get(transactionId);
        if (!transaction) {
            this.logger.error(`No transaction found for ID ${transactionId}`);
            return;
        }

        transaction.actions.push({
            type: actionType,
            data: actionData,
            timestamp: new Date().toISOString()
        });

        this.logger.debug(`Recorded ${actionType} action for transaction ${transactionId}`);
    }

    /**
     * Execute compensating transactions to restore original state
     * @param {string} transactionId - Transaction identifier
     * @returns {Promise<boolean>} Success status
     */
    async executeRollback(transactionId) {
        const transaction = this.compensatingActions.get(transactionId);
        if (!transaction) {
            this.logger.error(`No transaction found for rollback ${transactionId}`);
            return false;
        }

        this.logger.info(`Starting rollback for transaction ${transactionId} with ${transaction.actions.length} actions`);

        try {
            // Execute compensating actions in reverse order
            for (let i = transaction.actions.length - 1; i >= 0; i--) {
                const action = transaction.actions[i];
                await this.executeCompensatingAction(action);
            }

            // Clean up transaction tracking
            this.compensatingActions.delete(transactionId);
            this.logger.info(`Successfully rolled back transaction ${transactionId}`);
            return true;
        } catch (error) {
            this.logger.error(`Failed to rollback transaction ${transactionId}:`, error);
            return false;
        }
    }

    /**
     * Execute a single compensating action
     * @param {Object} action - Action to compensate
     */
    async executeCompensatingAction(action) {
        switch (action.type) {
            case 'insert':
                await this.compensateInsert(action.data);
                break;
            case 'update':
                await this.compensateUpdate(action.data);
                break;
            case 'delete':
                await this.compensateDelete(action.data);
                break;
            default:
                this.logger.error(`Unknown action type for compensation: ${action.type}`);
        }
    }

    /**
     * Compensate an insert by deleting the inserted record
     * @param {Object} data - Insert action data
     */
    async compensateInsert(data) {
        try {
            const { error } = await this.supabase
                .from(data.table)
                .delete()
                .eq('id', data.id);

            if (error) {
                throw new Error(`Failed to compensate insert: ${error.message}`);
            }

            this.logger.debug(`Compensated insert in ${data.table} for ID ${data.id}`);
        } catch (error) {
            this.logger.error('Error compensating insert:', error);
            throw error;
        }
    }

    /**
     * Compensate an update by restoring original values
     * @param {Object} data - Update action data
     */
    async compensateUpdate(data) {
        try {
            const { error } = await this.supabase
                .from(data.table)
                .update(data.originalValues)
                .eq('id', data.id);

            if (error) {
                throw new Error(`Failed to compensate update: ${error.message}`);
            }

            this.logger.debug(`Compensated update in ${data.table} for ID ${data.id}`);
        } catch (error) {
            this.logger.error('Error compensating update:', error);
            throw error;
        }
    }

    /**
     * Compensate a delete by reinserting the deleted record
     * @param {Object} data - Delete action data
     */
    async compensateDelete(data) {
        try {
            const { error } = await this.supabase
                .from(data.table)
                .insert(data.originalRecord);

            if (error) {
                throw new Error(`Failed to compensate delete: ${error.message}`);
            }

            this.logger.debug(`Compensated delete in ${data.table} for ID ${data.id}`);
        } catch (error) {
            this.logger.error('Error compensating delete:', error);
            throw error;
        }
    }

    /**
     * Complete a transaction successfully
     * @param {string} transactionId - Transaction identifier
     */
    completeTransaction(transactionId) {
        this.compensatingActions.delete(transactionId);
        this.logger.debug(`Completed transaction ${transactionId}`);
    }

    /**
     * Get transaction status
     * @param {string} transactionId - Transaction identifier
     * @returns {Object|null} Transaction status or null if not found
     */
    getTransactionStatus(transactionId) {
        const transaction = this.compensatingActions.get(transactionId);
        if (!transaction) {return null;}

        return {
            id: transactionId,
            startedAt: transaction.startedAt,
            actionCount: transaction.actions.length,
            isActive: true
        };
    }

    /**
     * Clean up old transactions
     * @param {number} maxAgeMs - Maximum age in milliseconds
     */
    cleanupOldTransactions(maxAgeMs = 24 * 60 * 60 * 1000) { // 24 hours default
        const now = new Date();
        const cutoff = new Date(now.getTime() - maxAgeMs);

        for (const [transactionId, transaction] of this.compensatingActions.entries()) {
            const startedAt = new Date(transaction.startedAt);
            if (startedAt < cutoff) {
                this.compensatingActions.delete(transactionId);
                this.logger.debug(`Cleaned up old transaction ${transactionId}`);
            }
        }
    }
}

module.exports = TransactionRollbackManager;
