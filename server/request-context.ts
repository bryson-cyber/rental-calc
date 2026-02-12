/**
 * Request-scoped context using AsyncLocalStorage.
 * 
 * This allows deep functions (like the AirDNA rate limiter) to know
 * who is making the request without threading user info through every
 * function parameter.
 * 
 * Usage at the tRPC procedure level:
 *   import { runWithRequestContext } from './request-context';
 *   return runWithRequestContext({ isAdmin: ctx.user.role === 'admin', userId: ctx.user.id }, async () => {
 *     // all nested calls can now check isAdminRequest()
 *   });
 * 
 * Deep in the call chain:
 *   import { isAdminRequest } from './request-context';
 *   const admin = isAdminRequest();
 */

import { AsyncLocalStorage } from 'async_hooks';

interface RequestContext {
  isAdmin: boolean;
  userId?: number;
}

const requestContextStorage = new AsyncLocalStorage<RequestContext>();

/**
 * Run a function with request context attached.
 * All async code within the callback can access the context.
 */
export function runWithRequestContext<T>(
  context: RequestContext,
  fn: () => T | Promise<T>
): T | Promise<T> {
  return requestContextStorage.run(context, fn);
}

/**
 * Check if the current request is from an admin user.
 * Returns false if no context is set (e.g., background jobs, cron tasks).
 */
export function isAdminRequest(): boolean {
  const ctx = requestContextStorage.getStore();
  return ctx?.isAdmin ?? false;
}

/**
 * Get the current request context, or null if not in a request scope.
 */
export function getRequestContext(): RequestContext | null {
  return requestContextStorage.getStore() ?? null;
}
