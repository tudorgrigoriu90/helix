import { describe, it, expect, vi } from 'vitest';
import {
  handleBudgetAlert,
  type BudgetPayload,
  type BillingClient,
} from './billing-cap-handler';

function makeClient(billingEnabled: boolean) {
  const getBillingInfo = vi.fn(() => Promise.resolve(billingEnabled));
  const disableBilling = vi.fn(() => Promise.resolve());
  const client: BillingClient = { getBillingInfo, disableBilling };
  return { client, getBillingInfo, disableBilling };
}

const OVER: BudgetPayload = { costAmount: 52, budgetAmount: 50, currencyCode: 'USD' };
const UNDER: BudgetPayload = { costAmount: 30, budgetAmount: 50, currencyCode: 'USD' };
const EXACT: BudgetPayload = { costAmount: 50, budgetAmount: 50, currencyCode: 'USD' };

describe('handleBudgetAlert — T-38', () => {
  it('returns under-budget and skips all API calls when cost is below cap', async () => {
    const { client, getBillingInfo, disableBilling } = makeClient(true);
    expect(await handleBudgetAlert(UNDER, client, 'test-project')).toBe('under-budget');
    expect(getBillingInfo).not.toHaveBeenCalled();
    expect(disableBilling).not.toHaveBeenCalled();
  });

  it('returns under-budget when cost equals the budget (strict > comparison)', async () => {
    const { client } = makeClient(true);
    expect(await handleBudgetAlert(EXACT, client, 'test-project')).toBe('under-budget');
  });

  it('disables billing when cost exceeds budget and billing is currently enabled', async () => {
    const { client, getBillingInfo, disableBilling } = makeClient(true);
    expect(await handleBudgetAlert(OVER, client, 'test-project')).toBe('disabled');
    expect(getBillingInfo).toHaveBeenCalledWith('projects/test-project');
    expect(disableBilling).toHaveBeenCalledWith('projects/test-project');
  });

  it('is idempotent: returns already-disabled without calling disableBilling again', async () => {
    const { client, getBillingInfo, disableBilling } = makeClient(false);
    expect(await handleBudgetAlert(OVER, client, 'test-project')).toBe('already-disabled');
    expect(getBillingInfo).toHaveBeenCalledOnce();
    expect(disableBilling).not.toHaveBeenCalled();
  });

  it('builds the projects/ path from the given projectId', async () => {
    const { client, getBillingInfo, disableBilling } = makeClient(true);
    await handleBudgetAlert(OVER, client, 'strand-descent');
    expect(getBillingInfo).toHaveBeenCalledWith('projects/strand-descent');
    expect(disableBilling).toHaveBeenCalledWith('projects/strand-descent');
  });
});
