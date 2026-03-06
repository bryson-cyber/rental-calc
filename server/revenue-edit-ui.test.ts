/**
 * Tests that the HeroRevenueCard in TeslaDashboard supports inline
 * revenue editing — admin can click the revenue number to type a custom value.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const DASHBOARD_PATH = path.resolve(__dirname, '../client/src/components/TeslaDashboard.tsx');

describe('Revenue Inline Editing UI', () => {
  let source: string;
  source = fs.readFileSync(DASHBOARD_PATH, 'utf-8');

  it('should import Pencil and Check icons for edit mode', () => {
    expect(source).toContain('Pencil');
    expect(source).toContain('Check');
  });

  it('should have isEditingRevenue state for inline editing', () => {
    expect(source).toContain('isEditingRevenue');
    expect(source).toContain('setIsEditingRevenue');
  });

  it('should have editValue state for the typed number', () => {
    expect(source).toContain('editValue');
    expect(source).toContain('setEditValue');
  });

  it('should render an input with inputMode numeric when editing', () => {
    expect(source).toContain('inputMode="numeric"');
    expect(source).toContain('autoFocus');
  });

  it('should handle Enter key to confirm the typed value', () => {
    expect(source).toContain("e.key === 'Enter'");
    // Should parse the value and call onRevenueOverride
    expect(source).toContain('onRevenueOverride(numericValue)');
  });

  it('should handle Escape key to cancel editing', () => {
    expect(source).toContain("e.key === 'Escape'");
  });

  it('should handle blur to confirm the value', () => {
    expect(source).toContain('onBlur');
  });

  it('should strip non-numeric characters when parsing input', () => {
    // The onChange handler strips non-digits
    expect(source).toContain("replace(/[^0-9]/g, '')");
  });

  it('should show a pencil icon on the revenue number for admin', () => {
    expect(source).toContain('Pencil className=');
    expect(source).toContain('Click to type a custom revenue amount');
  });

  it('should hide +/- buttons while editing', () => {
    // The decrement and increment buttons should check !isEditingRevenue
    const decrementSection = source.slice(
      source.indexOf('Owner override controls: decrement'),
      source.indexOf('Revenue display: click to edit')
    );
    expect(decrementSection).toContain('!isEditingRevenue');

    const incrementSection = source.slice(
      source.indexOf('Owner override controls: increment'),
      source.indexOf('Owner reset button when override is active')
    );
    expect(incrementSection).toContain('!isEditingRevenue');
  });

  it('should only show editing UI for owner/admin users', () => {
    // The click handler checks isOwner && onRevenueOverride
    expect(source).toContain('isOwner && onRevenueOverride && isEditingRevenue');
  });
});
