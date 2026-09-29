import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { auth } from "@/lib/firebase";
import { getEffectiveAuthIdentityHeader } from "@/lib/impersonation";
import { 
  CreditCard, 
  Shield, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Settings,
  Zap,
  RefreshCw,
  ExternalLink,
  Info,
  Key,
  Webhook,
  RotateCcw
} from "lucide-react";

// Petición autenticada de administrador. Envía la identidad normal de la app
// (header x-user-info) y, además, el ID token de Firebase cuando el admin entró
// por Firebase. El servidor confirma el rol de administrador en la base de datos.
async function adminApiRequest(method: string, url: string, data?: unknown): Promise<Response> {
  const headers: Record<string, string> = {};

  const identity = getEffectiveAuthIdentityHeader();
  if (identity) {
    headers["x-user-info"] = identity;
  }

  try {
    const currentUser = auth?.currentUser;
    if (currentUser) {
      const idToken = await currentUser.getIdToken();
      headers["Authorization"] = `Bearer ${idToken}`;
    }
  } catch {
    /* sin token de Firebase: se usa la identidad de la app */
  }

  if (data) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
  return res;
}

interface StripeConfig {
  id?: number;
  publicKey: string;
  secretKey?: string;
  webhookSecret?: string;
  environment: "test" | "live";
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export default function StripeConfiguration() {
  const { toast } = useToast();
  const [formData, setFormData] = useState<StripeConfig>({
    publicKey: "",
    secretKey: "",
    webhookSecret: "",
    environment: "test",
    isActive: true,
  });
  const [showSecrets, setShowSecrets] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  // Fetch current configuration
  const { data: currentConfig, isLoading } = useQuery({
    queryKey: ["/api/stripe-configuration"],
    queryFn: async () => {
      const response = await fetch("/api/stripe-configuration");
      return response.json();
    },
  });

  useEffect(() => {
    if (currentConfig && currentConfig.id) {
      setFormData({
        ...currentConfig,
        secretKey: "", // Don't pre-fill secret key for security
        webhookSecret: "", // El servidor ya no envía este secreto al frontend
      });
    }
  }, [currentConfig]);

  // Save configuration mutation
  const saveConfigMutation = useMutation({
    mutationFn: async (config: StripeConfig) => {
      const response = await adminApiRequest("POST", "/api/stripe-configuration", config);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Configuración guardada",
        description: "La configuración de Stripe se ha guardado correctamente.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/stripe-configuration"] });
      setFormData(prev => ({ ...prev, secretKey: "" })); // Clear secret key after save
    },
    onError: (error: any) => {
      toast({
        title: "Error al guardar",
        description: error.message || "No se pudo guardar la configuración",
        variant: "destructive",
      });
    },
  });

  // Test connection mutation
  const testConnectionMutation = useMutation({
    mutationFn: async (config: StripeConfig) => {
      const response = await adminApiRequest("POST", "/api/stripe-configuration/test", config);
      return response.json();
    },
    onSuccess: (data) => {
      setTestResult(data);
      if (data.success) {
        toast({
          title: "Conexión exitosa",
          description: "Se ha establecido conexión con Stripe correctamente.",
        });
      } else {
        toast({
          title: "Error de conexión",
          description: data.message,
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error al probar conexión",
        description: error.message || "No se pudo probar la conexión",
        variant: "destructive",
      });
    },
  });

  // Sync products mutation
  const syncProductsMutation = useMutation({
    mutationFn: async () => {
      const response = await adminApiRequest("POST", "/api/stripe-configuration/sync-products");
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Sincronización completa",
        description: data.message || "Productos sincronizados con Stripe",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error en sincronización",
        description: error.message || "No se pudieron sincronizar los productos",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (!formData.publicKey || !formData.secretKey) {
      toast({
        title: "Campos requeridos",
        description: "Las claves pública y secreta son requeridas",
        variant: "destructive",
      });
      return;
    }

    // Validate key formats
    if (!formData.publicKey.startsWith('pk_')) {
      toast({
        title: "Clave pública inválida",
        description: "La clave pública debe comenzar con 'pk_'",
        variant: "destructive",
      });
      return;
    }

    if (!formData.secretKey.startsWith('sk_')) {
      toast({
        title: "Clave secreta inválida", 
        description: "La clave secreta debe comenzar con 'sk_'",
        variant: "destructive",
      });
      return;
    }

    saveConfigMutation.mutate(formData);
  };

  const handleTest = () => {
    if (!formData.publicKey || !formData.secretKey) {
      toast({
        title: "Campos requeridos",
        description: "Las claves pública y secreta son requeridas para probar la conexión",
        variant: "destructive",
      });
      return;
    }
    testConnectionMutation.mutate(formData);
  };

  const isConfigured = currentConfig && currentConfig.id;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full" />
          <span>Cargando configuración...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Configuración de Stripe</h1>
          <p className="text-gray-600">
            Configura las claves de API de Stripe para procesar pagos
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <Badge variant={isConfigured ? "default" : "secondary"}>
              {isConfigured ? "Conectado" : "Desconectado"}
            </Badge>
            {isConfigured && (
              <Badge variant={currentConfig.environment === "live" ? "default" : "secondary"}>
                {currentConfig.environment === "live" ? "Producción" : "Pruebas"}
              </Badge>
            )}
            {isConfigured && (
              <Badge variant={currentConfig.isActive ? "default" : "secondary"}>
                {currentConfig.isActive ? "Activo" : "Inactivo"}
              </Badge>
            )}
          </div>
          {isConfigured && (
            <p className="text-sm text-green-600">
              ✓ Configuración guardada y procesando pagos
            </p>
          )}
        </div>
      </div>

      {/* Status Alert */}
      {!isConfigured ? (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Stripe no configurado</AlertTitle>
          <AlertDescription>
            El sistema de pagos no está configurado. Necesitas agregar las claves de API de Stripe
            para procesar pagos automáticos y suscripciones.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertTitle>Stripe configurado</AlertTitle>
          <AlertDescription>
            Sistema de pagos activo. Última actualización: {" "}
            {new Date(currentConfig.updatedAt).toLocaleDateString('es-MX')}
          </AlertDescription>
        </Alert>
      )}

      {/* Setup Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Instrucciones de Configuración
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">🔑 Cómo obtener las claves de Stripe:</h4>
              <ol className="text-sm text-blue-800 space-y-2">
                <li>1. Ve a <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer" className="underline font-medium">dashboard.stripe.com/apikeys</a></li>
                <li>2. <strong>Clave Pública:</strong> Copia tu "Publishable key" (comienza con pk_)</li>
                <li>3. <strong>Clave Secreta:</strong> Copia tu "Secret key" (comienza con sk_)</li>
                <li>4. Para webhooks: Ve a "Webhooks" y crea un endpoint con tu URL</li>
              </ol>
            </div>
            
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h4 className="font-medium text-amber-900 mb-2">⚠️ Importante:</h4>
              <ul className="text-sm text-amber-800 space-y-1">
                <li>• Usa claves de <strong>prueba</strong> (test) durante desarrollo</li>
                <li>• Cambia a <strong>producción</strong> (live) solo cuando esté listo</li>
                <li>• Nunca compartas la clave secreta</li>
                <li>• <strong>Normal:</strong> La clave secreta se borra después de guardar por seguridad</li>
                <li>• Sincroniza productos después de guardar la configuración</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configuration Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Claves de API
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Environment Selection */}
          <div className="space-y-2">
            <Label>Entorno</Label>
            <Select
              value={formData.environment}
              onValueChange={(value: "test" | "live") => 
                setFormData(prev => ({ ...prev, environment: value }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="test">Pruebas (Test)</SelectItem>
                <SelectItem value="live">Producción (Live)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-gray-600">
              {formData.environment === "test" 
                ? "Usa claves de prueba para desarrollo" 
                : "⚠️ Usa claves de producción para pagos reales"
              }
            </p>
          </div>

          {/* Public Key */}
          <div className="space-y-2">
            <Label>Clave Pública (Publishable Key)</Label>
            <Input
              type="text"
              placeholder={`pk_${formData.environment}_...`}
              value={formData.publicKey}
              onChange={(e) => setFormData(prev => ({ ...prev, publicKey: e.target.value }))}
            />
            <p className="text-sm text-gray-600">
              Comienza con pk_{formData.environment}_. Esta clave es segura para usar en el frontend.
            </p>
          </div>

          {/* Secret Key */}
          <div className="space-y-2">
            <Label>Clave Secreta (Secret Key)</Label>
            <div className="relative">
              <Input
                type={showSecrets ? "text" : "password"}
                placeholder={`sk_${formData.environment}_...`}
                value={formData.secretKey}
                onChange={(e) => setFormData(prev => ({ ...prev, secretKey: e.target.value }))}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 transform -translate-y-1/2"
                onClick={() => setShowSecrets(!showSecrets)}
              >
                {showSecrets ? "Ocultar" : "Mostrar"}
              </Button>
            </div>
            <p className="text-sm text-gray-600">
              Comienza con sk_{formData.environment}_. Mantén esta clave segura y privada.
            </p>
          </div>

          {/* Webhook Secret */}
          <div className="space-y-2">
            <Label>Webhook Secret (Opcional)</Label>
            <Input
              type={showSecrets ? "text" : "password"}
              placeholder="whsec_..."
              value={formData.webhookSecret}
              onChange={(e) => setFormData(prev => ({ ...prev, webhookSecret: e.target.value }))}
            />
            <p className="text-sm text-gray-600">
              Para verificar webhooks de Stripe. Se configura en el dashboard de Stripe.
            </p>
          </div>

          {/* Active Status */}
          <div className="flex items-center justify-between">
            <div>
              <Label>Estado Activo</Label>
              <p className="text-sm text-gray-600">
                Activa o desactiva el procesamiento de pagos
              </p>
            </div>
            <Switch
              checked={formData.isActive}
              onCheckedChange={(checked) => 
                setFormData(prev => ({ ...prev, isActive: checked }))
              }
            />
          </div>

          <Separator />

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              onClick={handleTest}
              variant="outline"
              disabled={testConnectionMutation.isPending}
              className="flex items-center gap-2"
            >
              {testConnectionMutation.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              Probar Conexión
            </Button>

            <Button
              onClick={handleSave}
              disabled={saveConfigMutation.isPending}
              className="flex items-center gap-2"
            >
              {saveConfigMutation.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Shield className="h-4 w-4" />
              )}
              Guardar Configuración
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Test Results */}
      {testResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {testResult.success ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              Resultado de la Prueba
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className={`p-3 rounded-lg ${
                testResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
              }`}>
                {testResult.message}
              </div>
              
              {testResult.success && testResult.details && (
                <div className="bg-gray-50 p-3 rounded-lg">
                  <h4 className="font-medium mb-2">Detalles de la cuenta:</h4>
                  <div className="space-y-1 text-sm">
                    <div><strong>ID de cuenta:</strong> {testResult.details.accountId}</div>
                    <div><strong>Nombre del negocio:</strong> {testResult.details.businessName}</div>
                    <div><strong>País:</strong> {testResult.details.country}</div>
                    <div><strong>Moneda:</strong> {testResult.details.currency?.toUpperCase()}</div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Product Sync */}
      {isConfigured && currentConfig.isActive && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5" />
              Sincronización de Productos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600">
              Sincroniza los planes de membresía locales con los productos de Stripe para 
              habilitar suscripciones automáticas.
            </p>
            
            <Button
              onClick={() => syncProductsMutation.mutate()}
              disabled={syncProductsMutation.isPending}
              variant="outline"
              className="flex items-center gap-2"
            >
              {syncProductsMutation.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              Sincronizar Productos
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Setup Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Instrucciones de Configuración
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">1. Obtener claves de API de Stripe:</h4>
              <ul className="space-y-1 text-sm text-gray-600 ml-4">
                <li>• Ve a <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">dashboard.stripe.com/apikeys</a></li>
                <li>• Copia la "Publishable key" (empieza con pk_)</li>
                <li>• Copia la "Secret key" (empieza con sk_)</li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium mb-2">2. Configurar webhooks (opcional pero recomendado):</h4>
              <ul className="space-y-1 text-sm text-gray-600 ml-4">
                <li>• Ve a <a href="https://dashboard.stripe.com/webhooks" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">dashboard.stripe.com/webhooks</a></li>
                <li>• Crea un nuevo endpoint con URL: <code className="bg-gray-100 px-1 rounded">{window.location.origin}/api/webhooks/stripe</code></li>
                <li>• Selecciona eventos: customer.subscription.*, invoice.payment_*</li>
                <li>• Copia el "Signing secret" (empieza con whsec_)</li>
              </ul>
            </div>

            <div>
              <h4 className="font-medium mb-2">3. Entornos:</h4>
              <ul className="space-y-1 text-sm text-gray-600 ml-4">
                <li>• <strong>Pruebas:</strong> Usa para desarrollo, las tarjetas de prueba no generan cargos reales</li>
                <li>• <strong>Producción:</strong> Usa solo cuando estés listo para recibir pagos reales</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}