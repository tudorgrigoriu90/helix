/** Google Cloud Billing API client abstraction — injected so the handler is unit-testable. */
export interface BillingClient {
  getBillingInfo(projectName: string): Promise<boolean>;
  disableBilling(projectName: string): Promise<void>;
}

/** Shape of the Pub/Sub message that Cloud Billing budget alerts publish. */
export interface BudgetPayload {
  readonly costAmount: number;
  readonly budgetAmount: number;
  readonly currencyCode: string;
  readonly alertThresholdExceeded?: number;
  readonly budgetDisplayName?: string;
}

export type HandlerResult = 'under-budget' | 'already-disabled' | 'disabled';

/**
 * Core billing-cap logic (TDD §11.7, T-38).
 *
 * Detaches the billing account from `projectId` when `costAmount` exceeds
 * `budgetAmount`. Idempotent: if billing is already off, returns
 * `'already-disabled'` without calling the API again.
 *
 * The strict `>` comparison means cost === budget is treated as on-budget so
 * the $50 alert threshold fires before the kill (alerts fire at 100% of
 * budget, kill fires the moment cost crosses above it).
 */
export async function handleBudgetAlert(
  payload: BudgetPayload,
  client: BillingClient,
  projectId: string,
): Promise<HandlerResult> {
  const { costAmount, budgetAmount } = payload;

  if (costAmount <= budgetAmount) return 'under-budget';

  const name = `projects/${projectId}`;
  const billingEnabled = await client.getBillingInfo(name);
  if (!billingEnabled) return 'already-disabled';

  await client.disableBilling(name);
  return 'disabled';
}
