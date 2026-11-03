import test from 'node:test';
import assert from 'node:assert/strict';
import { formatRupiah, formatQuantity, formatDateIndo, parseRupiahInput } from '../../client/src/utils/format.js';
import { useAppStore } from '../../client/src/store/useAppStore.js';

test('Tahap 1B: Formatting Utilities & Zustand Store', async (t) => {
  await t.test('formatRupiah', () => {
    assert.strictEqual(formatRupiah(null), 'Rp 0');
    assert.strictEqual(formatRupiah(undefined), 'Rp 0');
    assert.strictEqual(formatRupiah(NaN), 'Rp 0');
    assert.strictEqual(formatRupiah(0), 'Rp\u00a00');
    
    // Test large currency formatting (Intl id-ID uses non-breaking space after Rp)
    const formatted = formatRupiah(18500000);
    assert.ok(formatted.includes('18.500.000'), `Expected 18.500.000 in ${formatted}`);
    assert.ok(formatted.includes('Rp'), `Expected Rp in ${formatted}`);
  });

  await t.test('formatQuantity', () => {
    assert.strictEqual(formatQuantity(null), '0');
    assert.strictEqual(formatQuantity(undefined), '0');
    assert.strictEqual(formatQuantity(NaN), '0');
    assert.strictEqual(formatQuantity(10), '10');
    assert.strictEqual(formatQuantity(3.5), '3,5');
    assert.strictEqual(formatQuantity(3.14159), '3,14');
  });

  await t.test('parseRupiahInput', () => {
    assert.strictEqual(parseRupiahInput('Rp 1.500.000'), 1500000);
    assert.strictEqual(parseRupiahInput('75.000.000'), 75000000);
    assert.strictEqual(parseRupiahInput('abc'), 0);
    assert.strictEqual(parseRupiahInput(''), 0);
    assert.strictEqual(parseRupiahInput('Rp 250,000'), 250000);
  });

  await t.test('formatDateIndo', () => {
    assert.strictEqual(formatDateIndo(null), '-');
    assert.strictEqual(formatDateIndo(''), '-');
    const formatted = formatDateIndo('2026-10-28');
    assert.ok(formatted.includes('2026'));
    assert.ok(formatted.includes('28'));
  });

  await t.test('Zustand useAppStore Actions & State Transitions', () => {
    const store = useAppStore.getState();

    // Set user
    const sampleUser = {
      id: 'usr-1',
      name: 'Test Store User',
      email: 'teststore@example.com',
      systemRole: 'SUPER_ADMIN' as const,
      isActive: 1,
    };
    store.setUser(sampleUser);
    assert.deepStrictEqual(useAppStore.getState().user, sampleUser);

    // Set CSRF token
    store.setCsrfToken('csrf-token-123');
    assert.strictEqual(useAppStore.getState().csrfToken, 'csrf-token-123');

    // Set active group
    const sampleGroup = {
      id: 'grp-1',
      name: 'Workspace 1',
      slug: 'workspace-1',
      description: 'Desc',
      budgetLimit: 50000000,
      isArchived: 0,
      userRole: 'GROUP_MANAGER' as const,
      memberCount: 5,
      transactionCount: 20,
    };
    store.setActiveGroup(sampleGroup);
    assert.deepStrictEqual(useAppStore.getState().activeGroup, sampleGroup);
    assert.strictEqual(useAppStore.getState().activeGroupRole, 'GROUP_MANAGER');

    // Switch tabs
    store.setActiveTab('ledger');
    assert.strictEqual(useAppStore.getState().activeTab, 'ledger');

    // Toggle drawer
    assert.strictEqual(useAppStore.getState().isActivityDrawerOpen, false);
    store.toggleActivityDrawer();
    assert.strictEqual(useAppStore.getState().isActivityDrawerOpen, true);
    store.toggleActivityDrawer();
    assert.strictEqual(useAppStore.getState().isActivityDrawerOpen, false);

    // Logout reset
    store.logout();
    assert.strictEqual(useAppStore.getState().user, null);
    assert.strictEqual(useAppStore.getState().csrfToken, null);
    assert.strictEqual(useAppStore.getState().activeGroup, null);
    assert.strictEqual(useAppStore.getState().activeGroupRole, 'VIEWER');
    assert.strictEqual(useAppStore.getState().activeTab, 'dashboard');
  });
});

