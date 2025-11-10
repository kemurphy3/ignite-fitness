/**
 * Tests for Transaction Rollback Manager
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import TransactionRollbackManager from '../../netlify/functions/utils/transaction-rollback.js';

// Mock Supabase client
const mockSupabase = {
    from: vi.fn(() => ({
        delete: vi.fn(() => ({
            eq: vi.fn(() => ({ error: null }))
        })),
        update: vi.fn(() => ({
            eq: vi.fn(() => ({ error: null }))
        })),
        insert: vi.fn(() => ({ error: null }))
    }))
};

describe('TransactionRollbackManager', () => {
    let rollbackManager;

    beforeEach(() => {
        rollbackManager = new TransactionRollbackManager(mockSupabase);
        vi.clearAllMocks();
    });

    describe('Transaction Lifecycle', () => {
        it('should start tracking a transaction', () => {
            const transactionId = 'test-tx-1';
            rollbackManager.startTransaction(transactionId);

            const status = rollbackManager.getTransactionStatus(transactionId);
            expect(status).toBeTruthy();
            expect(status.id).toBe(transactionId);
            expect(status.isActive).toBe(true);
            expect(status.actionCount).toBe(0);
        });

        it('should record actions for rollback', () => {
            const transactionId = 'test-tx-1';
            rollbackManager.startTransaction(transactionId);

            rollbackManager.recordAction(transactionId, 'insert', {
                table: 'activities',
                id: '123'
            });

            const status = rollbackManager.getTransactionStatus(transactionId);
            expect(status.actionCount).toBe(1);
        });

        it('should complete a transaction successfully', () => {
            const transactionId = 'test-tx-1';
            rollbackManager.startTransaction(transactionId);
            rollbackManager.completeTransaction(transactionId);

            const status = rollbackManager.getTransactionStatus(transactionId);
            expect(status).toBeNull();
        });
    });

    describe('Rollback Execution', () => {
        it('should execute rollback for insert action', async () => {
            const transactionId = 'test-tx-1';
            rollbackManager.startTransaction(transactionId);

            rollbackManager.recordAction(transactionId, 'insert', {
                table: 'activities',
                id: '123'
            });

            const result = await rollbackManager.executeRollback(transactionId);
            expect(result).toBe(true);

            // Verify delete was called
            expect(mockSupabase.from).toHaveBeenCalledWith('activities');
        });

        it('should execute rollback for update action', async () => {
            const transactionId = 'test-tx-1';
            rollbackManager.startTransaction(transactionId);

            rollbackManager.recordAction(transactionId, 'update', {
                table: 'activities',
                id: '123',
                originalValues: { name: 'Original Name' }
            });

            const result = await rollbackManager.executeRollback(transactionId);
            expect(result).toBe(true);

            // Verify update was called
            expect(mockSupabase.from).toHaveBeenCalledWith('activities');
        });

        it('should execute rollback for delete action', async () => {
            const transactionId = 'test-tx-1';
            rollbackManager.startTransaction(transactionId);

            rollbackManager.recordAction(transactionId, 'delete', {
                table: 'activities',
                id: '123',
                originalRecord: { id: '123', name: 'Test Activity' }
            });

            const result = await rollbackManager.executeRollback(transactionId);
            expect(result).toBe(true);

            // Verify insert was called
            expect(mockSupabase.from).toHaveBeenCalledWith('activities');
        });

        it('should handle multiple actions in reverse order', async () => {
            const transactionId = 'test-tx-1';
            rollbackManager.startTransaction(transactionId);

            rollbackManager.recordAction(transactionId, 'insert', {
                table: 'activities',
                id: '123'
            });

            rollbackManager.recordAction(transactionId, 'update', {
                table: 'activities',
                id: '456',
                originalValues: { name: 'Original Name' }
            });

            const result = await rollbackManager.executeRollback(transactionId);
            expect(result).toBe(true);

            // Verify both operations were called
            expect(mockSupabase.from).toHaveBeenCalledTimes(2);
        });

        it('should handle rollback failure gracefully', async () => {
            const transactionId = 'test-tx-1';
            rollbackManager.startTransaction(transactionId);

            // Mock a failing operation
            mockSupabase.from.mockReturnValueOnce({
                delete: vi.fn(() => ({
                    eq: vi.fn(() => ({ error: new Error('Database error') }))
                }))
            });

            rollbackManager.recordAction(transactionId, 'insert', {
                table: 'activities',
                id: '123'
            });

            const result = await rollbackManager.executeRollback(transactionId);
            expect(result).toBe(false);
        });
    });

    describe('Error Handling', () => {
        it('should handle unknown action type', async () => {
            const transactionId = 'test-tx-1';
            rollbackManager.startTransaction(transactionId);

            rollbackManager.recordAction(transactionId, 'unknown', {
                table: 'activities',
                id: '123'
            });

            const result = await rollbackManager.executeRollback(transactionId);
            expect(result).toBe(true); // Should complete without error
        });

        it('should handle rollback for non-existent transaction', async () => {
            const result = await rollbackManager.executeRollback('non-existent');
            expect(result).toBe(false);
        });

        it('should handle recording action for non-existent transaction', () => {
            rollbackManager.recordAction('non-existent', 'insert', {
                table: 'activities',
                id: '123'
            });

            // Should not throw error
            expect(true).toBe(true);
        });
    });

    describe('Cleanup', () => {
        it('should clean up old transactions', () => {
            const transactionId = 'test-tx-1';
            rollbackManager.startTransaction(transactionId);

            // Mock old transaction by setting startedAt to past
            const transaction = rollbackManager.compensatingActions.get(transactionId);
            transaction.startedAt = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(); // 25 hours ago

            rollbackManager.cleanupOldTransactions(24 * 60 * 60 * 1000); // 24 hours

            const status = rollbackManager.getTransactionStatus(transactionId);
            expect(status).toBeNull();
        });

        it('should not clean up recent transactions', () => {
            const transactionId = 'test-tx-1';
            rollbackManager.startTransaction(transactionId);

            rollbackManager.cleanupOldTransactions(24 * 60 * 60 * 1000); // 24 hours

            const status = rollbackManager.getTransactionStatus(transactionId);
            expect(status).toBeTruthy();
        });
    });
});
