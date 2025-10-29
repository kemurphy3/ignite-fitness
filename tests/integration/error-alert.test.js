/**
 * Tests for ErrorAlert Component
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import ErrorAlert from '../../js/modules/ui/components/ErrorAlert.js';

// Mock DOM environment
const mockDocument = {
    createElement: vi.fn(() => ({
        id: '',
        className: '',
        style: {},
        innerHTML: '',
        appendChild: vi.fn(),
        removeChild: vi.fn(),
        parentNode: null
    })),
    getElementById: vi.fn(() => null),
    body: {
        appendChild: vi.fn()
    },
    head: {
        appendChild: vi.fn()
    }
};

const mockWindow = {
    ErrorAlert: null
};

// Mock global objects
global.document = mockDocument;
global.window = mockWindow;

describe('ErrorAlert', () => {
    let errorAlert;

    beforeEach(() => {
        errorAlert = new ErrorAlert();
        vi.clearAllMocks();
    });

    describe('Initialization', () => {
        it('should initialize with default container', () => {
            errorAlert.init();
            expect(errorAlert.container).toBeTruthy();
        });

        it('should create container if it does not exist', () => {
            mockDocument.getElementById = vi.fn(() => null);
            errorAlert.init('test-container');
            expect(mockDocument.createElement).toHaveBeenCalledWith('div');
        });
    });

    describe('Expert Failure Alerts', () => {
        beforeEach(() => {
            errorAlert.init();
        });

        it('should show expert failure alert', () => {
            const alertId = errorAlert.showExpertFailureAlert({
                expertType: 'physio',
                errorMessage: 'Test error',
                fallbackMessage: 'Test fallback',
                severity: 'error'
            });

            expect(alertId).toBeTruthy();
            expect(alertId).toContain('alert_physio_');
            expect(errorAlert.getActiveAlertsCount()).toBe(1);
        });

        it('should show different severity levels', () => {
            const errorId = errorAlert.showExpertFailureAlert({
                expertType: 'physio',
                severity: 'error'
            });

            const warningId = errorAlert.showExpertFailureAlert({
                expertType: 'strength',
                severity: 'warning'
            });

            const infoId = errorAlert.showExpertFailureAlert({
                expertType: 'nutrition',
                severity: 'info'
            });

            expect(errorAlert.getActiveAlertsCount()).toBe(3);
        });

        it('should auto-dismiss alerts after duration', async () => {
            const alertId = errorAlert.showExpertFailureAlert({
                expertType: 'physio',
                duration: 100 // 100ms for testing
            });

            expect(errorAlert.getActiveAlertsCount()).toBe(1);

            // Wait for auto-dismiss
            await new Promise(resolve => setTimeout(resolve, 150));

            expect(errorAlert.getActiveAlertsCount()).toBe(0);
        });
    });

    describe('Alert Management', () => {
        beforeEach(() => {
            errorAlert.init();
        });

        it('should dismiss specific alert', () => {
            const alertId = errorAlert.showExpertFailureAlert({
                expertType: 'physio'
            });

            expect(errorAlert.getActiveAlertsCount()).toBe(1);

            errorAlert.dismissAlert(alertId);

            expect(errorAlert.getActiveAlertsCount()).toBe(0);
        });

        it('should dismiss all alerts', () => {
            errorAlert.showExpertFailureAlert({ expertType: 'physio' });
            errorAlert.showExpertFailureAlert({ expertType: 'strength' });
            errorAlert.showExpertFailureAlert({ expertType: 'nutrition' });

            expect(errorAlert.getActiveAlertsCount()).toBe(3);

            errorAlert.dismissAllAlerts();

            expect(errorAlert.getActiveAlertsCount()).toBe(0);
        });

        it('should handle dismissing non-existent alert gracefully', () => {
            expect(() => {
                errorAlert.dismissAlert('non-existent');
            }).not.toThrow();
        });
    });

    describe('Alert Filtering', () => {
        beforeEach(() => {
            errorAlert.init();
        });

        it('should filter alerts by expert type', () => {
            errorAlert.showExpertFailureAlert({ expertType: 'physio' });
            errorAlert.showExpertFailureAlert({ expertType: 'strength' });
            errorAlert.showExpertFailureAlert({ expertType: 'physio' });

            const physioAlerts = errorAlert.getAlertsByExpertType('physio');
            expect(physioAlerts).toHaveLength(2);

            const strengthAlerts = errorAlert.getAlertsByExpertType('strength');
            expect(strengthAlerts).toHaveLength(1);
        });
    });

    describe('General Alert Methods', () => {
        beforeEach(() => {
            errorAlert.init();
        });

        it('should show error alert', () => {
            const alertId = errorAlert.showErrorAlert({
                errorMessage: 'Test error',
                fallbackMessage: 'Test fallback'
            });

            expect(alertId).toBeTruthy();
            expect(errorAlert.getActiveAlertsCount()).toBe(1);
        });

        it('should show warning alert', () => {
            const alertId = errorAlert.showWarningAlert({
                errorMessage: 'Test warning',
                fallbackMessage: 'Test fallback'
            });

            expect(alertId).toBeTruthy();
            expect(errorAlert.getActiveAlertsCount()).toBe(1);
        });

        it('should show info alert', () => {
            const alertId = errorAlert.showInfoAlert({
                errorMessage: 'Test info',
                fallbackMessage: 'Test fallback'
            });

            expect(alertId).toBeTruthy();
            expect(errorAlert.getActiveAlertsCount()).toBe(1);
        });
    });

    describe('Cleanup', () => {
        beforeEach(() => {
            errorAlert.init();
        });

        it('should clean up old alerts', () => {
            // Mock old alert by setting timestamp to past
            const alertId = errorAlert.showExpertFailureAlert({
                expertType: 'physio'
            });

            const alert = errorAlert.alerts.get(alertId);
            alert.timestamp = Date.now() - 400000; // 400 seconds ago

            errorAlert.cleanupOldAlerts(300000); // 300 seconds max age

            expect(errorAlert.getActiveAlertsCount()).toBe(0);
        });

        it('should not clean up recent alerts', () => {
            errorAlert.showExpertFailureAlert({ expertType: 'physio' });

            errorAlert.cleanupOldAlerts(300000); // 300 seconds max age

            expect(errorAlert.getActiveAlertsCount()).toBe(1);
        });
    });

    describe('Helper Methods', () => {
        it('should get correct expert display names', () => {
            expect(errorAlert.getExpertDisplayName('physio')).toBe('Physio');
            expect(errorAlert.getExpertDisplayName('strength')).toBe('Strength');
            expect(errorAlert.getExpertDisplayName('unknown')).toBe('Unknown');
        });

        it('should get correct severity colors', () => {
            expect(errorAlert.getSeverityColor('error')).toBe('#ef4444');
            expect(errorAlert.getSeverityColor('warning')).toBe('#f59e0b');
            expect(errorAlert.getSeverityColor('info')).toBe('#3b82f6');
        });

        it('should get correct expert icons', () => {
            expect(errorAlert.getExpertIcon('physio')).toContain('🏥');
            expect(errorAlert.getExpertIcon('strength')).toContain('💪');
            expect(errorAlert.getExpertIcon('unknown')).toContain('❓');
        });
    });
});
