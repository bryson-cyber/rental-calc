/**
 * Tests that rental procedures properly propagate admin context
 * via runWithRequestContext so the AirDNA rate limiter can detect
 * admin status deep in the call chain.
 * 
 * Bug: getPropertyReport, getAIPropertyReport, getMarketReport, and
 * getSubmarketReport were NOT wrapping their logic in runWithRequestContext,
 * causing all requests to be treated as non-admin and blocked at the 400-call
 * soft limit even when the admin user was making the request.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const RENTAL_ROUTER_PATH = path.resolve(__dirname, 'routers/rental.ts');

describe('Admin Context Propagation in Rental Router', () => {
  let rentalRouterSource: string;

  // Read the source file once
  rentalRouterSource = fs.readFileSync(RENTAL_ROUTER_PATH, 'utf-8');

  it('should import runWithRequestContext', () => {
    expect(rentalRouterSource).toContain("import { runWithRequestContext } from");
  });

  it('getPropertyReport should wrap logic in runWithRequestContext', () => {
    // Find the getPropertyReport procedure and verify it uses runWithRequestContext
    const procedureStart = rentalRouterSource.indexOf('getPropertyReport:');
    expect(procedureStart).toBeGreaterThan(-1);

    // Get the section after getPropertyReport up to the next procedure
    const sectionEnd = rentalRouterSource.indexOf('getAIPropertyReport:', procedureStart);
    const section = rentalRouterSource.slice(procedureStart, sectionEnd);

    expect(section).toContain('runWithRequestContext');
    expect(section).toContain("ctx.user?.role === 'admin'");
  });

  it('getAIPropertyReport should wrap logic in runWithRequestContext', () => {
    const procedureStart = rentalRouterSource.indexOf('getAIPropertyReport:');
    expect(procedureStart).toBeGreaterThan(-1);

    const sectionEnd = rentalRouterSource.indexOf('getMarketReport:', procedureStart);
    const section = rentalRouterSource.slice(procedureStart, sectionEnd);

    expect(section).toContain('runWithRequestContext');
    expect(section).toContain("ctx.user?.role === 'admin'");
  });

  it('getMarketReport should wrap logic in runWithRequestContext', () => {
    const procedureStart = rentalRouterSource.indexOf('getMarketReport:');
    expect(procedureStart).toBeGreaterThan(-1);

    const sectionEnd = rentalRouterSource.indexOf('getSubmarketReport:', procedureStart);
    const section = rentalRouterSource.slice(procedureStart, sectionEnd);

    expect(section).toContain('runWithRequestContext');
    expect(section).toContain("ctx.user?.role === 'admin'");
  });

  it('getSubmarketReport should wrap logic in runWithRequestContext', () => {
    const procedureStart = rentalRouterSource.indexOf('getSubmarketReport:');
    expect(procedureStart).toBeGreaterThan(-1);

    const sectionEnd = rentalRouterSource.indexOf('exploreSubmarkets:', procedureStart);
    const section = rentalRouterSource.slice(procedureStart, sectionEnd);

    expect(section).toContain('runWithRequestContext');
    expect(section).toContain("ctx.user?.role === 'admin'");
  });

  it('should have global error handlers in server entry point', () => {
    const indexPath = path.resolve(__dirname, '_core/index.ts');
    const indexSource = fs.readFileSync(indexPath, 'utf-8');

    expect(indexSource).toContain("process.on('unhandledRejection'");
    expect(indexSource).toContain("process.on('uncaughtException'");
  });

  it('airdna.ts should re-throw AirDNARateLimitError in market data catch blocks', () => {
    const airdnaPath = path.resolve(__dirname, 'airdna.ts');
    const airdnaSource = fs.readFileSync(airdnaPath, 'utf-8');

    // Find the market data catch block
    const marketCatchIdx = airdnaSource.indexOf('catch (marketErr)');
    expect(marketCatchIdx).toBeGreaterThan(-1);

    // Get the section after the catch
    const section = airdnaSource.slice(marketCatchIdx, marketCatchIdx + 300);
    expect(section).toContain('AirDNARateLimitError');
    expect(section).toContain('throw marketErr');
  });
});
