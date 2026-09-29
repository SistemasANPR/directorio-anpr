import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getStripePromise } from "@/lib/stripe";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditCard, AlertTriangle, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CardInfo {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

interface MembershipInfo {
  fechaFinMembresia: string | null;
  autoRenewal: boolean;
  membershipCancelled: boolean;
  companyEstado: string;
  inactiveReason: string | null;
}

const BRAND_NAMES: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "American Express",
  discover: "Discover",
  diners: "Diners Club",
  jcb: "JCB",
  unionpay: "UnionPay",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    return new Date(`${dateStr}T12:00:00`).toLocaleDateString("es-MX", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function ChangeCardForm({
  companyId,
  onSuccess,
  onCancel,
}: {
  companyId: number;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || isSaving) return;
    setIsSaving(true);
    try {
      const result = await stripe.confirmSetup({
        elements,
        redirect: "if_required",
      });
      if (result.error) {
        throw new Error(result.error.message || "No se pudo validar la tarjeta");
      }
      const setupIntent = result.setupIntent;
      const paymentMethodId =
        typeof setupIntent?.payment_method === "string"
          ? setupIntent.payment_method
          : (setupIntent?.payment_method as any)?.id;
      if (!paymentMethodId) {
        throw new Error("No se pudo obtener la nueva tarjeta");
      }
      await apiRequest("POST", `/api/companies/${companyId}/payment-method`, {
        paymentMethodId,
      });
      toast({
        title: "Tarjeta guardada",
        description: "Los próximos cobros se harán con esta tarjeta.",
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/companies/${companyId}/payment-method`],
      });
      onSuccess();
    } catch (error: any) {
      toast({
        title: "No se pudo guardar la tarjeta",
        description: error.message || "Intenta de nuevo",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!stripe || isSaving}>
          {isSaving ? "Guardando..." : "Guardar tarjeta"}
        </Button>
      </div>
    </form>
  );
}

export default function PaymentMethodCard({ companyId }: { companyId: number }) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ card: CardInfo | null; membership?: MembershipInfo }>({
    queryKey: [`/api/companies/${companyId}/payment-method`],
    enabled: !!companyId,
    retry: false,
  });

  const setupMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(
        "POST",
        `/api/companies/${companyId}/payment-method/setup-intent`,
      );
      return res.json();
    },
    onSuccess: (result: { clientSecret: string }) => {
      setClientSecret(result.clientSecret);
      setDialogOpen(true);
    },
    onError: (error: any) => {
      toast({
        title: "No se pudo iniciar el registro de tarjeta",
        description: error.message || "Intenta de nuevo",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", `/api/companies/${companyId}/payment-method`);
      return res.json();
    },
    onSuccess: () => {
      setDeleteDialogOpen(false);
      toast({
        title: "Tarjeta eliminada",
        description:
          "Tu membresía sigue vigente hasta su fecha de vencimiento. La renovación automática quedó desactivada.",
      });
      queryClient.invalidateQueries({
        queryKey: [`/api/companies/${companyId}/payment-method`],
      });
    },
    onError: (error: any) => {
      toast({
        title: "No se pudo eliminar la tarjeta",
        description: error.message || "Intenta de nuevo",
        variant: "destructive",
      });
    },
  });

  const card = data?.card || null;
  const membership = data?.membership;
  const isInactive = membership?.companyEstado === "inactivo";
  const fechaFin = membership?.fechaFinMembresia || null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Método de Pago
        </CardTitle>
        <p className="text-gray-600">Tarjeta con la que se paga tu plan</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <>
            {/* Empresa inactiva: pantalla clara de recuperación */}
            {isInactive && (
              <Alert variant="destructive" data-testid="alert-company-inactive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Tu empresa está inactiva</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>
                    {membership?.inactiveReason ||
                      "Tu membresía terminó y el último pago no se completó o no había una tarjeta registrada."}
                  </p>
                  <p>
                    Para reactivar tu empresa: 1) agrega una tarjeta y 2) renueva o paga tu
                    membresía desde la sección "Mi Plan". Tu empresa volverá a estar activa
                    cuando se confirme el pago.
                  </p>
                </AlertDescription>
              </Alert>
            )}

            {/* Sin tarjeta y con membresía vigente: alerta persistente */}
            {!card && !isInactive && fechaFin && (
              <Alert data-testid="alert-no-card" className="border-amber-300 bg-amber-50 text-amber-900">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertTitle>No hay una tarjeta registrada</AlertTitle>
                <AlertDescription>
                  Si no agregas una tarjeta antes del{" "}
                  <span className="font-semibold">{formatDate(fechaFin)}</span>, la renovación no
                  podrá procesarse y tu empresa será inactivada al vencer la membresía.
                </AlertDescription>
              </Alert>
            )}

            {/* Estado de membresía y renovación */}
            {membership && (
              <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
                <span>
                  Membresía vigente hasta:{" "}
                  <span className="font-medium text-gray-900">{formatDate(fechaFin)}</span>
                </span>
                <Badge variant={membership.autoRenewal && card ? "default" : "secondary"}>
                  {membership.autoRenewal && card
                    ? "Renovación automática activa"
                    : "Renovación automática desactivada"}
                </Badge>
                <Badge variant={isInactive ? "destructive" : "outline"}>
                  {isInactive ? "Empresa inactiva" : "Empresa activa"}
                </Badge>
              </div>
            )}

            {card ? (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="bg-gray-100 rounded-lg p-3">
                    <CreditCard className="h-6 w-6 text-gray-600" />
                  </div>
                  <div>
                    <p className="font-medium">
                      {BRAND_NAMES[card.brand] || card.brand?.toUpperCase()} •••• {card.last4}
                    </p>
                    <p className="text-sm text-gray-600">
                      Vence {String(card.expMonth).padStart(2, "0")}/{card.expYear}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setupMutation.mutate()}
                    disabled={setupMutation.isPending}
                    data-testid="button-change-card"
                  >
                    {setupMutation.isPending ? "Preparando..." : "Cambiar tarjeta"}
                  </Button>
                  <Button
                    variant="outline"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => setDeleteDialogOpen(true)}
                    disabled={deleteMutation.isPending}
                    data-testid="button-delete-card"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Eliminar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <p className="text-gray-600">
                  No hay una tarjeta registrada para pagos automáticos.
                </p>
                <Button
                  onClick={() => setupMutation.mutate()}
                  disabled={setupMutation.isPending}
                  data-testid="button-add-card"
                >
                  {setupMutation.isPending ? "Preparando..." : "Agregar método de pago"}
                </Button>
              </div>
            )}
          </>
        )}

        {/* Confirmación de eliminación */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar método de pago?</AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <span className="block">
                  Vas a eliminar la tarjeta{" "}
                  <span className="font-semibold">
                    {card ? `${BRAND_NAMES[card.brand] || card.brand?.toUpperCase()} terminación ${card.last4}` : ""}
                  </span>
                  .
                </span>
                <span className="block">
                  Al eliminar este método de pago no se cancelará inmediatamente tu membresía.
                  Podrás continuar utilizando el servicio hasta el final del periodo pagado
                  {fechaFin ? (
                    <> (<span className="font-semibold">{formatDate(fechaFin)}</span>)</>
                  ) : null}
                  .
                </span>
                <span className="block">
                  Si no agregas otro método de pago antes del vencimiento, la renovación no podrá
                  procesarse y la empresa será inactivada.
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700"
                disabled={deleteMutation.isPending}
                onClick={(e) => {
                  e.preventDefault();
                  if (!deleteMutation.isPending) deleteMutation.mutate();
                }}
                data-testid="button-confirm-delete-card"
              >
                {deleteMutation.isPending ? "Eliminando..." : "Eliminar método de pago"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{card ? "Cambiar tarjeta" : "Agregar tarjeta"}</DialogTitle>
              <DialogDescription>
                {card
                  ? "Ingresa los datos de la nueva tarjeta. Los próximos cobros se harán con ella."
                  : "Ingresa los datos de tu tarjeta. Registrarla no genera ningún cobro inmediato."}
              </DialogDescription>
            </DialogHeader>
            {clientSecret && (
              <Elements stripe={getStripePromise()} options={{ clientSecret, locale: "es" }}>
                <ChangeCardForm
                  companyId={companyId}
                  onSuccess={() => setDialogOpen(false)}
                  onCancel={() => setDialogOpen(false)}
                />
              </Elements>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
