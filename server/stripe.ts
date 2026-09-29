import Stripe from "stripe";
import { storage } from "./storage";

interface StripeContext {
  stripe: Stripe;
  source: "panel" | "env";
  publicKey: string | null;
  webhookSecret: string | null;
}

let cachedContext: StripeContext | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

export function invalidateStripeCache(): void {
  cachedContext = null;
  cachedAt = 0;
}

export async function getStripeContext(): Promise<StripeContext> {
  if (cachedContext && Date.now() - cachedAt < CACHE_TTL_MS) return cachedContext;

  try {
    const config = await storage.getStripeConfiguration();
    if (config && config.isActive && config.secretKey) {
      // Modo panel: usar SOLO las llaves del panel para no mezclar
      // llave pública y secreta de cuentas de Stripe distintas.
      cachedContext = {
        stripe: new Stripe(config.secretKey, { apiVersion: "2023-10-16" as any }),
        source: "panel",
        publicKey: config.publicKey || null,
        webhookSecret: config.webhookSecret || null,
      };
      cachedAt = Date.now();
      return cachedContext;
    }
  } catch (error) {
    console.error("Error loading Stripe configuration from panel, falling back to env:", error);
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error(
      "Stripe no está configurado. Guarda las llaves en el panel de administrador (Configuración Stripe) o en los Secretos del proyecto."
    );
  }

  cachedContext = {
    stripe: new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" as any }),
    source: "env",
    publicKey: process.env.VITE_STRIPE_PUBLIC_KEY || null,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || null,
  };
  cachedAt = Date.now();
  return cachedContext;
}

export async function getStripe(): Promise<Stripe> {
  return (await getStripeContext()).stripe;
}

// --- Compatibilidad con versiones de la API de Stripe (2023-10-16 vs 2025+basil) ---
// A partir de la versión "basil", varios campos cambiaron de lugar:
//  - invoice.subscription        -> invoice.parent.subscription_details.subscription
//  - invoice.payment_intent      -> (eliminado; se usa invoice.id como clave única)
//  - subscription.current_period_end/_start -> subscription.items.data[0].current_period_*
// Estos helpers leen AMBAS ubicaciones para funcionar sin importar la versión con
// la que Stripe serialice los eventos (los webhooks usan la versión de la cuenta).

export function getInvoiceSubscriptionId(invoice: any): string | null {
  const legacy = typeof invoice?.subscription === 'string'
    ? invoice.subscription
    : invoice?.subscription?.id;
  if (legacy) return legacy;
  const parentSub = invoice?.parent?.subscription_details?.subscription;
  if (typeof parentSub === 'string') return parentSub;
  if (parentSub?.id) return parentSub.id;
  // Fallback: buscar en las líneas de la factura.
  const lineSub = invoice?.lines?.data?.[0]?.parent?.subscription_item_details?.subscription
    || invoice?.lines?.data?.[0]?.subscription;
  return typeof lineSub === 'string' ? lineSub : (lineSub?.id || null);
}

export function getInvoiceSubscriptionMetadata(invoice: any): Record<string, string> | null {
  return invoice?.parent?.subscription_details?.metadata || null;
}

export function getSubscriptionPeriodEnd(subscription: any): number | null {
  return subscription?.current_period_end
    ?? subscription?.items?.data?.[0]?.current_period_end
    ?? null;
}

export function getSubscriptionPeriodStart(subscription: any): number | null {
  return subscription?.current_period_start
    ?? subscription?.items?.data?.[0]?.current_period_start
    ?? null;
}

// Obtiene (o crea) un Price RECURRENTE de Stripe para un plan+periodicidad.
// Se reutiliza por lookup_key para no acumular precios duplicados y para que la
// misma combinación (plan, periodo, monto, moneda, intervalo) apunte siempre al
// mismo Price. Crea el Producto inline (product_data) en la primera vez.
export async function getOrCreateRecurringPrice(
  stripe: Stripe,
  opts: {
    productName: string;
    unitAmount: number; // en centavos
    currency: string;
    interval: "month" | "year";
    lookupKey: string;
  }
): Promise<Stripe.Price> {
  const { productName, unitAmount, currency, interval, lookupKey } = opts;

  const existing = await stripe.prices.list({
    lookup_keys: [lookupKey],
    active: true,
    limit: 1,
  });
  if (existing.data.length > 0) {
    return existing.data[0];
  }

  return stripe.prices.create({
    currency,
    unit_amount: unitAmount,
    recurring: { interval },
    product_data: { name: productName },
    lookup_key: lookupKey,
  });
}
