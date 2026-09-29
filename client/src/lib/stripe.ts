import { loadStripe, type Stripe } from "@stripe/stripe-js";

let stripePromise: Promise<Stripe | null> | null = null;

export function getStripePromise(): Promise<Stripe | null> {
  if (!stripePromise) {
    stripePromise = fetch("/api/stripe-public-key")
      .then((res) => (res.ok ? res.json() : { publicKey: null }))
      .catch(() => ({ publicKey: null }))
      .then(({ publicKey }: { publicKey: string | null }) => {
        const key = publicKey || import.meta.env.VITE_STRIPE_PUBLIC_KEY;
        if (!key) {
          throw new Error("El sistema de pagos no está configurado");
        }
        return loadStripe(key);
      });
  }
  return stripePromise;
}
