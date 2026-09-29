import { useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, ArrowRight, Home, User } from "lucide-react";

export default function RegistroExitoso() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Auto-redirect after 10 seconds
    const timer = setTimeout(() => {
      setLocation("/login-representante");
    }, 10000);

    return () => clearTimeout(timer);
  }, [setLocation]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-8">
      <div className="container mx-auto max-w-2xl px-4">
        <Card className="text-center">
          <CardHeader className="pb-4">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl font-bold text-green-800">
              ¡Registro Completado Exitosamente!
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <h3 className="font-semibold text-green-800 mb-3">¿Qué sigue?</h3>
              <div className="space-y-2 text-sm text-green-700">
                <p>✓ Tu cuenta de representante ha sido creada</p>
                <p>✓ Tu empresa ha sido registrada en el directorio</p>
                <p>✓ Tu pago ha sido procesado correctamente</p>
                <p>✓ Tu membresía está activa</p>
              </div>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-blue-800 text-sm">
                <strong>Información importante:</strong> Recibirás un email de confirmación con los detalles de tu cuenta y factura en los próximos minutos.
              </p>
            </div>

            <div className="space-y-3">
              <Button 
                onClick={() => setLocation("/login-representante")}
                className="w-full"
                style={{ backgroundColor: '#bcce16' }}
              >
                <User className="w-4 h-4 mr-2" />
                Iniciar Sesión Ahora
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              
              <Button 
                variant="outline"
                onClick={() => setLocation("/")}
                className="w-full"
              >
                <Home className="w-4 h-4 mr-2" />
                Volver al Inicio
              </Button>
            </div>

            <p className="text-xs text-gray-500">
              Serás redirigido automáticamente al login en 10 segundos...
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}