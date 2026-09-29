import { useStripe, Elements, PaymentElement, useElements } from '@stripe/react-stripe-js';
import { getStripePromise } from "@/lib/stripe";
import { useEffect, useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CreditCard, Shield, CheckCircle, User, UserPlus } from "lucide-react";

const stripePromise = getStripePromise();

const CheckoutForm = ({ company, membershipType }: { company: any; membershipType: any }) => {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [, setLocation] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsLoading(true);

    // URL de retorno según el tipo de checkout
    const returnUrl = company 
      ? `${window.location.origin}/empresa/${company.id}?payment=success`
      : `${window.location.origin}/planes?payment=success`;

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: returnUrl,
      },
    });

    if (error) {
      toast({
        title: "Error en el pago",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Pago exitoso",
        description: "Su membresía ha sido activada correctamente.",
      });
      setLocation(`/empresa/${company.id}`);
    }

    setIsLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      
      <div className="flex gap-4">
        <Button 
          type="button" 
          variant="outline" 
          onClick={() => setLocation(`/empresa/${company.id}`)}
          className="flex-1"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Cancelar
        </Button>
        <Button 
          type="submit" 
          disabled={!stripe || isLoading}
          className="flex-1"
        >
          {isLoading ? (
            <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
          ) : (
            <CreditCard className="h-4 w-4 mr-2" />
          )}
          {isLoading ? 'Procesando...' : `Pagar ${membershipType.costo}`}
        </Button>
      </div>
    </form>
  );
};

export default function MembershipCheckout() {
  const { companyId, membershipTypeId } = useParams();
  const [clientSecret, setClientSecret] = useState("");
  const { toast } = useToast();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  
  // Detectar si es una compra nueva de membresía (desde /planes) o actualización de empresa
  const isNewMembership = !companyId;

  // Fetch company details (solo si hay companyId)
  const { data: company, isLoading: companyLoading } = useQuery({
    queryKey: ["/api/companies", companyId],
    queryFn: async () => {
      const response = await fetch(`/api/companies/${companyId}`);
      if (!response.ok) throw new Error("Company not found");
      return response.json();
    },
    enabled: !!companyId, // Solo ejecutar si hay companyId
  });

  // Fetch membership type details
  const { data: membershipType, isLoading: membershipLoading } = useQuery({
    queryKey: ["/api/membership-types", membershipTypeId],
    queryFn: async () => {
      const response = await fetch(`/api/membership-types/${membershipTypeId}`);
      if (!response.ok) throw new Error("Membership type not found");
      return response.json();
    },
  });

  useEffect(() => {
    if (membershipTypeId && !clientSecret) {
      if (isNewMembership) {
        // Alta sin empresa (flujo alterno): mantiene el cobro único.
        apiRequest("POST", "/api/create-payment-intent", {
          membershipTypeId: parseInt(membershipTypeId),
        })
          .then((res) => res.json())
          .then((data) => {
            setClientSecret(data.clientSecret);
          })
          .catch((error) => {
            console.error("Error creating payment intent:", error);
            toast({
              title: "Error",
              description: "No se pudo inicializar el pago. Intente nuevamente.",
              variant: "destructive",
            });
          });
        return;
      }

      // Empresa existente: crear SUSCRIPCIÓN recurrente (renovación automática).
      apiRequest("POST", "/api/create-subscription", {
        companyId: parseInt(companyId),
        membershipTypeId: parseInt(membershipTypeId),
        autoRenewal: true,
      })
        .then((res) => res.json())
        .then((data) => {
          setClientSecret(data.clientSecret);
        })
        .catch((error) => {
          console.error("Error creating subscription:", error);
          toast({
            title: "Error",
            description: "No se pudo inicializar el pago. Intente nuevamente.",
            variant: "destructive",
          });
        });
    }
  }, [companyId, membershipTypeId, clientSecret, toast, isNewMembership]);

  if ((companyId && companyLoading) || membershipLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600">Cargando información del pago...</p>
        </div>
      </div>
    );
  }

  if (!membershipType || (companyId && !company)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Error al cargar datos</h1>
          <p className="text-gray-600 mb-4">
            {!membershipType ? "El tipo de membresía no fue encontrado." : "La empresa no fue encontrada."}
          </p>
          <Button onClick={() => window.history.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
        </div>
      </div>
    );
  }

  if (!clientSecret) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600">Preparando el pago...</p>
        </div>
      </div>
    );
  }

  const appearance = {
    theme: 'stripe' as const,
    variables: {
      colorPrimary: '#0f2161',
      colorBackground: '#ffffff',
      colorText: '#1f2937',
      colorDanger: '#dc2626',
      fontFamily: 'system-ui, sans-serif',
      spacingUnit: '4px',
      borderRadius: '8px',
    },
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {isNewMembership ? "Comprar Membresía" : "Actualizar Membresía"}
              </h1>
              <p className="text-sm text-gray-600">
                {isNewMembership 
                  ? `Procesar pago para plan ${membershipType.nombrePlan}`
                  : `Procesar pago para ${company?.nombreEmpresa}`
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Order Summary */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Shield className="h-5 w-5 mr-2" />
                  Resumen del Pedido
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!isNewMembership && company && (
                  <div className="flex items-center space-x-4">
                    {company.logotipoUrl && (
                      <img
                        src={company.logotipoUrl}
                        alt={company.nombreEmpresa}
                        className="w-12 h-12 object-contain rounded-lg border"
                      />
                    )}
                    <div>
                      <h3 className="font-semibold">{company.nombreEmpresa}</h3>
                      <p className="text-sm text-gray-600">Empresa</p>
                    </div>
                  </div>
                )}
                
                {isNewMembership && (
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <CreditCard className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Nueva Membresía</h3>
                      <p className="text-sm text-gray-600">Compra de plan</p>
                    </div>
                  </div>
                )}

                <div className="border-t pt-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium">{membershipType.nombrePlan}</h4>
                      <p className="text-sm text-gray-600">{membershipType.descripcionPlan}</p>
                      <Badge variant="secondary" className="mt-2">
                        Membresía Premium
                      </Badge>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-green-600">{membershipType.costo}</p>
                      <p className="text-sm text-gray-500">Pago único</p>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4 space-y-3">
                  <div className="flex items-center text-sm">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    <span>Acceso completo a todas las funciones</span>
                  </div>
                  <div className="flex items-center text-sm">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    <span>Soporte prioritario</span>
                  </div>
                  <div className="flex items-center text-sm">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    <span>Estadísticas avanzadas</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Información de Seguridad</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center text-sm">
                  <Shield className="h-4 w-4 text-green-500 mr-2" />
                  <span>Pagos seguros con Stripe</span>
                </div>
                <div className="flex items-center text-sm">
                  <Shield className="h-4 w-4 text-green-500 mr-2" />
                  <span>Encriptación SSL de 256 bits</span>
                </div>
                <div className="flex items-center text-sm">
                  <Shield className="h-4 w-4 text-green-500 mr-2" />
                  <span>No almacenamos información de tarjetas</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Payment Form */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CreditCard className="h-5 w-5 mr-2" />
                  Información de Pago
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Elements 
                  stripe={stripePromise} 
                  options={{ 
                    clientSecret,
                    appearance,
                  }}
                >
                  <CheckoutForm company={company} membershipType={membershipType} />
                </Elements>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}