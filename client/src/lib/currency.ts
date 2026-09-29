import { useQuery } from "@tanstack/react-query";

export interface CurrencySettings {
  currency: string;
  currencySymbol: string;
}

const CURRENCY_LOCALES: Record<string, string> = {
  MXN: "es-MX",
  USD: "en-US",
  EUR: "es-ES",
  COP: "es-CO",
  ARS: "es-AR",
  CLP: "es-CL",
  PEN: "es-PE",
  BRL: "pt-BR",
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  MXN: "$",
  COP: "$",
  ARS: "$",
  CLP: "$",
  EUR: "€",
  PEN: "S/.",
  BRL: "R$",
  CAD: "C$",
  GBP: "£",
  JPY: "¥",
  CNY: "¥",
};

export function formatAmount(
  amount: number | string | null | undefined,
  code: string,
  symbol?: string,
): string {
  const n =
    typeof amount === "string" ? parseFloat(amount) || 0 : amount ?? 0;
  const upper = (code || "USD").toUpperCase();
  const locale = CURRENCY_LOCALES[upper] || "es-MX";
  const noDecimals = upper === "CLP" || upper === "JPY";
  const formatted = n.toLocaleString(locale, {
    minimumFractionDigits: noDecimals ? 0 : 2,
    maximumFractionDigits: noDecimals ? 0 : 2,
  });
  return `${symbol || CURRENCY_SYMBOLS[upper] || "$"}${formatted} ${upper}`;
}

/**
 * Moneda global configurada en el panel de administración
 * (system_settings.currency / currencySymbol vía /api/public/currency).
 * Única fuente de verdad para mostrar precios en el frontend.
 */
export function useCurrency() {
  const { data } = useQuery<CurrencySettings>({
    queryKey: ["/api/public/currency"],
    staleTime: 5 * 60 * 1000,
  });

  const code = (data?.currency || "USD").toUpperCase();
  const symbol = data?.currencySymbol || "$";

  // Formatea un monto. Si el pago tiene su propia moneda registrada
  // (p. ej. un pago histórico), se puede pasar como override.
  const format = (
    amount: number | string | null | undefined,
    overrideCode?: string | null,
  ) => {
    const useCode = (overrideCode || code).toUpperCase();
    const useSymbol =
      useCode === code ? symbol : CURRENCY_SYMBOLS[useCode] || "$";
    return formatAmount(amount, useCode, useSymbol);
  };

  return { code, symbol, format };
}
