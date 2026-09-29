import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/lib/currency";
import { 
  CreditCard, 
  RefreshCw, 
  CheckCircle, 
  XCircle,
  Info,
  Calendar,
  DollarSign
} from "lucide-react";

interface AutoRenewalToggleProps {
  userId: number;
  currentlyEnabled: boolean;
  subscriptionId?: string;
  planName: string;
  nextBillingDate?: string;
  amount?: number;
  currency?: string;
}

export default function AutoRenewalToggle({
  userId,
  currentlyEnabled,
  subscriptionId,
  planName,
  nextBillingDate,
  amount,
  currency
}: AutoRenewalToggleProps) {
  const { toast } = useToast();
  const { format: formatMoney } = useCurrency();
  const [isOpen, setIsOpen] = useState(false);

  const toggleAutoRenewalMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const response = await apiRequest("PATCH", `/api/users/${userId}/auto-renewal`, {
        autoRenewal: enabled,
        subscriptionId
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: data.autoRenewal ? "Renovación automática activada" : "Renovación automática desactivada",
        description: data.autoRenewal 
          ? "Tu membresía se renovará automáticamente antes del vencimiento"
          : "Deberás renovar manualmente tu membresía antes del vencimiento",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users", userId] });
      setIsOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error al actualizar configuración",
        description: error.message || "No se pudo cambiar la configuración de renovación automática",
        variant: "destructive",
      });
    },
  });

  const handleToggle = () => {
    setIsOpen(true);
  };

  const confirmToggle = (newValue: boolean) => {
    toggleAutoRenewalMutation.mutate(newValue);
  };

  return (
    <>
      <div className="flex items-center justify-between p-4 border rounded-lg">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-full ${currentlyEnabled ? 'bg-green-100' : 'bg-gray-100'}`}>
            {currentlyEnabled ? (
              <RefreshCw className="h-4 w-4 text-green-600" />
            ) : (
              <CreditCard className="h-4 w-4 text-gray-600" />
            )}
          </div>
          <div>
            <div className="font-medium">Renovación Automática</div>
            <div className="text-sm text-gray-600">
              {currentlyEnabled ? "Activada" : "Desactivada"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={currentlyEnabled ? "default" : "secondary"}>
            {currentlyEnabled ? "ON" : "OFF"}
          </Badge>
          <Switch
            checked={currentlyEnabled}
            onCheckedChange={handleToggle}
            disabled={toggleAutoRenewalMutation.isPending}
          />
        </div>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {currentlyEnabled ? "Desactivar" : "Activar"} Renovación Automática
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Información del Plan</AlertTitle>
              <AlertDescription>
                <div className="space-y-2 mt-2">
                  <div className="flex justify-between">
                    <span>Plan:</span>
                    <span className="font-medium">{planName}</span>
                  </div>
                  {amount && (
                    <div className="flex justify-between">
                      <span>Monto:</span>
                      <span className="font-medium">{formatMoney(amount, currency)}</span>
                    </div>
                  )}
                  {nextBillingDate && (
                    <div className="flex justify-between">
                      <span>Próximo cobro:</span>
                      <span className="font-medium">
                        {new Date(nextBillingDate).toLocaleDateString('es-MX')}
                      </span>
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>

            {currentlyEnabled ? (
              <Alert>
                <XCircle className="h-4 w-4" />
                <AlertTitle>Desactivar Renovación Automática</AlertTitle>
                <AlertDescription>
                  Si desactivas la renovación automática:
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>No se realizarán cargos automáticos</li>
                    <li>Deberás renovar manualmente antes del vencimiento</li>
                    <li>Recibirás recordatorios por email</li>
                    <li>Tu membresía se suspenderá si no renuevas a tiempo</li>
                  </ul>
                </AlertDescription>
              </Alert>
            ) : (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertTitle>Activar Renovación Automática</AlertTitle>
                <AlertDescription>
                  Al activar la renovación automática:
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Tu membresía se renovará automáticamente</li>
                    <li>Se cargará el monto a tu método de pago guardado</li>
                    <li>No tendrás que preocuparte por fechas de vencimiento</li>
                    <li>Puedes cancelar en cualquier momento</li>
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <Separator />

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setIsOpen(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={() => confirmToggle(!currentlyEnabled)}
                disabled={toggleAutoRenewalMutation.isPending}
                className="flex-1"
              >
                {toggleAutoRenewalMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    {currentlyEnabled ? (
                      <>
                        <XCircle className="h-4 w-4 mr-2" />
                        Desactivar
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Activar
                      </>
                    )}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}