/**
 * Global type definitions for Ignite Fitness application
 */

declare global {
  interface Window {
    // Core systems
    SafeLogger: any;
    ExpertCoordinator: any;
    OverrideBar: any;
    AuthManager: any;
    LiveRegionManager: any;
    CoachChat: any;
    ContextAwareAI: any;

    // Authentication
    currentUser: string | null;
    isLoggedIn: boolean;
    users: Record<string, any>;

    // UI functions
    showUserDashboard: () => void;
    loadUserData: (user: string) => void;
    showSuccess: (message: string) => void;
    showError: (element: HTMLElement, message: string) => void;
    hideLoginForm: () => void;

    // Utility functions
    createHTMLTemplate: (template: TemplateStringsArray, ...values: any[]) => string;
    setContentSafely: (element: HTMLElement, content: string) => void;
  }

  // Global constants
  const CLAUDE_API_KEY: string;
  const OPENAI_API_KEY: string;
  const GEMINI_API_KEY: string;
}

// Module declarations for missing imports
declare module '@neondatabase/serverless' {
  export function neon(connectionString: string): any;
  export const Pool: any;
}

declare module 'jsonwebtoken' {
  export function sign(payload: any, secret: string, options?: any): string;
  export function verify(token: string, secret: string, options?: any): any;
  export function decode(token: string, options?: any): any;
}

declare module 'ajv' {
  export default class Ajv {
    constructor(options?: any);
    compile(schema: any): (data: any) => boolean;
    addKeyword(keyword: string, definition: any): void;
  }
}

declare module 'moment-timezone' {
  export function tz(date?: any): any;
  export namespace tz {
    export function names(): string[];
    export function zone(name: string): any;
  }
}

// Test framework globals
declare global {
  var describe: (name: string, fn: () => void) => void;
  var test: (name: string, fn: () => void | Promise<void>) => void;
  var it: (name: string, fn: () => void | Promise<void>) => void;
  var expect: (actual: any) => any;
  var beforeEach: (fn: () => void | Promise<void>) => void;
  var afterEach: (fn: () => void | Promise<void>) => void;
  var beforeAll: (fn: () => void | Promise<void>) => void;
  var afterAll: (fn: () => void | Promise<void>) => void;
  var jest: any;
  var vi: any; // Vitest
}

// Netlify Function types
export interface NetlifyEvent {
  httpMethod: string;
  path: string;
  queryStringParameters: Record<string, string> | null;
  headers: Record<string, string>;
  body: string | null;
  isBase64Encoded: boolean;
}

export interface NetlifyContext {
  functionName: string;
  functionVersion: string;
  invokedFunctionArn: string;
  memoryLimitInMB: number;
  getRemainingTimeInMillis: () => number;
}

export interface NetlifyResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
  isBase64Encoded?: boolean;
}

export {};
