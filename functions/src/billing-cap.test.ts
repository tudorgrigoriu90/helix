import { describe, it, expect, vi } from 'vitest';
import {
  handleBudgetAlert,
  type BudgetPayload,
  type BillingClient,
} from './billing-cap-handler';

function makeClient(billingEnabled: boolean): BillingClient {
  return {
    getBillingInfo: vi.fn(async () => billingEnabled),
    disableBilling: vi.fn(async () => {}),
  };
}

const OVER: BudgetPayload = { costAmount: 52, budgetAmount: 50, currencyCode: 'USD' };
const UNDER: BudgetPayload = { costAmount: 30, budgetAmount: 50, currencyCode: 'USD' };
const EXACT: BudgetPayload = { costAmount: 50, budgetAmount: 50, currencyCode: 'USD' };

describe('handleBudgetAlert — T-38', () => {
  it('returns under-budget and skips all API calls when cost is below cap', async () => {
    const client = makeClient(true);
    expect(await handleBudgetAlert(UNDER, client, 'test-project')).toBe('under-budget');
    expect(client.getBillingInfo).not.toHaveBeenCalled();
    expect(client.disableBilling).not.toHaveBeenCalled();
  });

  it('returns under-budget when cost equals the budget (strict > comparison)', async () => {
    const client = makeClient(true);
    expect(await handleBudgetAlert(EXACT, client, 'test-project')).toBe('under-budget');
  });

  it('disables billing when cost exceeds budget and billing is currently enabled', async () => {
    const client = makeClient(true);
    expect(await handleBudgetAlert(OVER, client, 'test-project')).toBe('disabled');
    expect(client.getBillingInfo).toHaveBeenCalledWith('projects/test-project');
    expect(client.disableBilling).toHaveBeenCalledWith('projects/test-project');
  });

  it('is idempotent: returns already-disabled without calling disableBilling again', async () => {
    const client = makeClient(false);
    expect(await handleBudgetAlert(OVER, client, 'test-project')).toBe('already-disabled');
    expect(client.getBillingInfo).toHaveBeenCalledOnce();
    expect(client.disableBilling).not.toHaveBeenCalled();
  });

  it('builds the projects/ path from the given projectId', async () => {
    const client = makeClient(true);
    await handleBudgetAlert(OVER, client, 'strand-descent');
    expect(client.getBillingInfo).toHaveBeenCalledWith('projects/strand-descent');
    expect(client.disableBilling).toHaveBeenCalledWith('projects/strand-descent');
  });
});
