/**
 * PayPal REST API v2 Live Engine for Trinity
 * Implements production PayPal checkout, order creation, and capture.
 * Credentials (PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET) are read exclusively on the backend.
 */
import { HttpError } from './security.js';

const PAYPAL_LIVE_API = 'https://api-m.paypal.com';
const PAYPAL_SANDBOX_API = 'https://api-m.sandbox.paypal.com';

export function getPayPalBaseUrl(env) {
  return (env.PAYPAL_MODE || 'live').toLowerCase() === 'sandbox' ? PAYPAL_SANDBOX_API : PAYPAL_LIVE_API;
}

export function isPayPalConfigured(env) {
  return Boolean(env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET);
}

export async function getPayPalAccessToken(env) {
  const clientId = env.PAYPAL_CLIENT_ID;
  const clientSecret = env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new HttpError(503, 'PayPal REST API nie je nakonfigurované. Zadaj PAYPAL_CLIENT_ID a PAYPAL_CLIENT_SECRET do backendových Secrets.');
  }

  const baseUrl = getPayPalBaseUrl(env);
  const auth = btoa(`${clientId}:${clientSecret}`);

  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new HttpError(response.status, `PayPal autentifikácia zlyhala: ${errorText.slice(0, 200)}`);
  }

  const data = await response.json();
  return data.access_token;
}

export async function createPayPalOrder(env, { amountEur, description, referenceId, returnUrl, cancelUrl }) {
  const amount = Number(amountEur);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new HttpError(400, 'Neplatná suma v EUR.');
  }

  const token = await getPayPalAccessToken(env);
  const baseUrl = getPayPalBaseUrl(env);

  const payload = {
    intent: 'CAPTURE',
    purchase_units: [
      {
        reference_id: referenceId || crypto.randomUUID(),
        description: (description || 'Trinity Platform Order').slice(0, 120),
        amount: {
          currency_code: 'EUR',
          value: amount.toFixed(2)
        }
      }
    ],
    application_context: {
      brand_name: 'Trinity Basterix',
      landing_page: 'BILLING',
      user_action: 'PAY_NOW',
      ...(returnUrl ? { return_url: returnUrl } : {}),
      ...(cancelUrl ? { cancel_url: cancelUrl } : {})
    }
  };

  const response = await fetch(`${baseUrl}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const err = await response.text();
    throw new HttpError(response.status, `Vytvorenie PayPal objednávky zlyhalo: ${err.slice(0, 200)}`);
  }

  const order = await response.json();
  const approveLink = order.links?.find(l => l.rel === 'approve')?.href || null;

  return {
    order_id: order.id,
    status: order.status,
    amount_eur: amount,
    currency: 'EUR',
    approve_url: approveLink,
    mode: (env.PAYPAL_MODE || 'live').toLowerCase(),
    created_at: new Date().toISOString()
  };
}

export async function capturePayPalOrder(env, orderId) {
  if (!orderId || typeof orderId !== 'string') {
    throw new HttpError(400, 'Zadaj platné PayPal Order ID.');
  }

  const token = await getPayPalAccessToken(env);
  const baseUrl = getPayPalBaseUrl(env);

  const response = await fetch(`${baseUrl}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const err = await response.text();
    throw new HttpError(response.status, `Zachytenie PayPal platby zlyhalo: ${err.slice(0, 200)}`);
  }

  const data = await response.json();
  const captureUnit = data.purchase_units?.[0]?.payments?.captures?.[0];

  return {
    order_id: data.id,
    status: data.status, // e.g. "COMPLETED"
    capture_id: captureUnit?.id || null,
    amount_eur: captureUnit?.amount?.value ? Number(captureUnit.amount.value) : null,
    payer: data.payer ? { email: data.payer.email_address, name: data.payer.name?.given_name } : null,
    completed: data.status === 'COMPLETED',
    verified_at: new Date().toISOString()
  };
}

export async function getPayPalOrderStatus(env, orderId) {
  if (!orderId || typeof orderId !== 'string') {
    throw new HttpError(400, 'Zadaj platné PayPal Order ID.');
  }

  const token = await getPayPalAccessToken(env);
  const baseUrl = getPayPalBaseUrl(env);

  const response = await fetch(`${baseUrl}/v2/checkout/orders/${encodeURIComponent(orderId)}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new HttpError(response.status, `Kontrola PayPal objednávky zlyhala.`);
  }

  const order = await response.json();
  const approveLink = order.links?.find(l => l.rel === 'approve')?.href || null;

  return {
    order_id: order.id,
    status: order.status,
    amount_eur: order.purchase_units?.[0]?.amount?.value ? Number(order.purchase_units[0].amount.value) : null,
    approve_url: approveLink
  };
}

export function paypalDiagnostics(env) {
  const configured = isPayPalConfigured(env);
  const clientId = env.PAYPAL_CLIENT_ID || null;
  const maskedClientId = clientId ? `${clientId.slice(0, 6)}...${clientId.slice(-4)}` : null;

  return {
    configured,
    mode: (env.PAYPAL_MODE || 'live').toLowerCase(),
    api_endpoint: getPayPalBaseUrl(env),
    client_id_configured: Boolean(clientId),
    client_id_masked: maskedClientId,
    secret_configured: Boolean(env.PAYPAL_CLIENT_SECRET),
    real_money: true,
    simulation_disabled: true
  };
}
