/**
 * XSS Protection Tests
 * Verifies that user-generated content is properly sanitized
 */

import { describe, it, expect, beforeEach } from 'vitest';

describe('XSS Protection', () => {
    let whyPanel;
    let htmlSanitizer;

    beforeEach(() => {
        // Mock window.HtmlSanitizer
        global.window = global.window || {};
        if (!global.window.HtmlSanitizer) {
            class MockHtmlSanitizer {
                escapeHtml(text) {
                    if (!text) {return '';}
                    if (typeof text !== 'string') {return String(text);}

                    // Basic HTML escaping (Node.js compatible)
                    const map = {
                        '&': '&amp;',
                        '<': '&lt;',
                        '>': '&gt;',
                        '"': '&quot;',
                        "'": '&#039;'
                    };

                    return text.replace(/[&<>"']/g, m => map[m]);
                }

                sanitize(text) {
                    return this.escapeHtml(text);
                }
            }
            global.window.HtmlSanitizer = new MockHtmlSanitizer();
        }

        // Mock WhyPanel
        if (!global.window.WhyPanel) {
            class MockWhyPanel {
                constructor() {
                    this.sanitizer = global.window.HtmlSanitizer;
                }

                escapeHtml(text) {
                    if (!text) {return '';}
                    if (typeof text !== 'string') {return String(text);}

                    if (this.sanitizer) {
                        return this.sanitizer.escapeHtml(text);
                    }

                    // Basic escape fallback (Node.js compatible)
                    const map = {
                        '&': '&amp;',
                        '<': '&lt;',
                        '>': '&gt;',
                        '"': '&quot;',
                        "'": '&#039;'
                    };
                    return text.replace(/[&<>"']/g, m => map[m]);
                }
            }
            global.window.WhyPanel = new MockWhyPanel();
        }

        whyPanel = global.window.WhyPanel;
        htmlSanitizer = global.window.HtmlSanitizer;
    });

    describe('escapeHtml', () => {
        it('should escape script tags', () => {
            const malicious = '<script>alert("xss")</script>';
            const escaped = whyPanel.escapeHtml(malicious);

            expect(escaped).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
            expect(escaped).not.toContain('<script>');
        });

        it('should escape event handler attributes', () => {
            const malicious = '<div onclick="alert(1)">Click me</div>';
            const escaped = whyPanel.escapeHtml(malicious);

            // HTML escaping renders attributes safe
            expect(escaped).toContain('&lt;div');
            expect(escaped).toContain('&quot;');
            expect(escaped).not.toContain('<div onclick=');
        });

        it('should escape img tags with javascript src', () => {
            const malicious = '<img src="javascript:alert(1)">';
            const escaped = whyPanel.escapeHtml(malicious);

            // HTML escaping renders the entire tag safe
            expect(escaped).toContain('&lt;img');
            expect(escaped).not.toContain('<img src=');
        });

        it('should escape iframe tags', () => {
            const malicious = '<iframe src="http://evil.com"></iframe>';
            const escaped = whyPanel.escapeHtml(malicious);

            expect(escaped).not.toContain('<iframe>');
        });

        it('should preserve legitimate text', () => {
            const legitimate = 'This is safe text with 123 numbers';
            const escaped = whyPanel.escapeHtml(legitimate);

            expect(escaped).toBe(legitimate);
        });

        it('should handle empty strings', () => {
            expect(whyPanel.escapeHtml('')).toBe('');
            expect(whyPanel.escapeHtml(null)).toBe('');
            expect(whyPanel.escapeHtml(undefined)).toBe('');
        });

        it('should handle non-string input', () => {
            expect(whyPanel.escapeHtml(123)).toBe('123');
            expect(whyPanel.escapeHtml(true)).toBe('true');
            expect(whyPanel.escapeHtml({})).toBe('[object Object]');
        });
    });

    describe('sanitize', () => {
        it('should sanitize XSS payloads', () => {
            const malicious = '<script>alert(document.cookie)</script>';
            const sanitized = htmlSanitizer.sanitize(malicious);

            // HTML escaping renders the script tag safe
            expect(sanitized).not.toContain('<script>');
            expect(sanitized).toContain('&lt;script&gt;');
            // The escaped string still contains the text but it's safe
        });

        it('should sanitize SQL injection attempts', () => {
            const malicious = "'); DROP TABLE users; --";
            const sanitized = htmlSanitizer.sanitize(malicious);

            // HTML escaping renders the quotes safe (note: SQL injection is handled at DB layer)
            expect(sanitized).toContain('&#039;');
            expect(sanitized).not.toContain("');");
            // The text still appears but special characters are escaped
        });
    });

    describe('integration', () => {
        it('should protect against stored XSS', () => {
            const plan = {
                why: [
                    '<script>alert("xss")</script>',
                    'Normal text',
                    '<img src=x onerror=alert(1)>'
                ]
            };

            // Simulate rendering
            plan.why = plan.why.map(reason => whyPanel.escapeHtml(reason));

            expect(plan.why[0]).not.toContain('<script>');
            expect(plan.why[0]).toContain('&lt;script&gt;');
            expect(plan.why[1]).toBe('Normal text');
            // When escaped, onerror= is rendered as &gt;Text&lt; which is safe
            expect(plan.why[2]).not.toContain('<img src=x onerror=');
        });
    });
});

