import { onMessagePublished } from 'firebase-functions/v2/pubsub';
import { GoogleAuth } from 'google-auth-library';
import { google } from 'googleapis';
import { handleBudgetAlert, type BillingClient, type BudgetPayload } from './billing-cap-handler';

const PROJECT_ID =
  process.env['GCLOUD_PROJECT'] ?? process.env['GOOGLE_CLOUD_PROJECT'] ?? '';

function makeGoogleBillingClient(): BillingClient {
  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-billing'],
  });
  const api = google.cloudbilling({ version: 'v1', auth });

  return {
    async getBillingInfo(name: string): Promise<boolean> {
      const { data } = await api.projects.getBillingInfo({ name });
      return data.billingEnabled ?? false;
    },
    async disableBilling(name: string): Promise<void> {
      await api.projects.updateBillingInfo({
        name,
        requestBody: { billingAccountName: '' },
      });
    },
  };
}

/**
 * Hard billing cap (TDD §11.7, T-38).
 *
 * Triggered by a Cloud Billing budget alert Pub/Sub message. When
 * `costAmount > budgetAmount` (i.e. spending has crossed the $50 cap),
 * the billing account is detached from the project — dropping it to free-tier
 * limits immediately. The function is idempotent and never throws.
 *
 * Prerequisites (Director to configure):
 *   1. Upgrade project to Blaze plan.
 *   2. Create budget "Monthly Cap" at $50 with Pub/Sub topic `billing-budget`.
 *   3. Grant the default Cloud Functions service account
 *      `roles/billing.projectManager` on the billing account.
 *   4. Deploy: `firebase deploy --only functions`.
 */
export const billingCap = onMessagePublished(
  { topic: 'billing-budget', region: 'us-central1' },
  async (event) => {
    const raw = Buffer.from(event.data.message.data ?? '', 'base64').toString();

    let payload: BudgetPayload;
    try {
      payload = JSON.parse(raw) as BudgetPayload;
    } catch {
      console.error('[billing-cap] malformed Pub/Sub payload:', raw.slice(0, 200));
      return;
    }

    const { costAmount, budgetAmount, currencyCode } = payload;
    console.warn(`[billing-cap] cost=$${costAmount} budget=$${budgetAmount} ${currencyCode}`);

    let result: Awaited<ReturnType<typeof handleBudgetAlert>>;
    try {
      result = await handleBudgetAlert(payload, makeGoogleBillingClient(), PROJECT_ID);
    } catch (err) {
      console.error('[billing-cap] Cloud Billing API error:', err);
      return;
    }

    switch (result) {
      case 'under-budget':
        console.warn('[billing-cap] under budget — no action');
        break;
      case 'already-disabled':
        console.warn('[billing-cap] billing already disabled — no-op');
        break;
      case 'disabled':
        console.error(
          `[billing-cap] BILLING DISABLED on ${PROJECT_ID}. ` +
            `Cost $${costAmount} exceeded cap $${budgetAmount} ${currencyCode}.`,
        );
        break;
    }
  },
);
