import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  CheckCircle,
  XCircle,
  Loader2,
  Globe,
  Users,
  RefreshCw,
  Key,
  AlertTriangle,
  Info,
  Settings,
  Save,
} from "lucide-react";

const integrationSchema = z.object({
  wordpressUrl: z.string().url("Debe ser una URL válida (ej: https://misitio.com)"),
  apiKey: z.string().min(1, "El API Key es requerido"),
  apiSecret: z.string().min(1, "El API Secret es requerido"),
  authMethod: z.enum(["jwt", "rest_api"], {
    required_error: "Selecciona un método de autenticación",
  }),
  syncEnabled: z.boolean().default(true),
  syncFrequency: z.enum(["manual", "hourly", "daily"], {
    required_error: "Selecciona la frecuencia de sincronización",
  }),
  memberPressEnabled: z.boolean().default(true),
  allowedRoles: z.array(z.string()).min(1, "Selecciona al menos un rol"),
});

type IntegrationFormData = z.infer<typeof integrationSchema>;

export default function IntegrationSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [connectionError, setConnectionError] = useState<string>("");
  const [lastSync, setLastSync] = useState<Date | null>(null);

  // Fetch current integration settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ["/api/integration-settings"],
  });

  const form = useForm<IntegrationFormData>({
    resolver: zodResolver(integrationSchema),
    defaultValues: {
      wordpressUrl: "",
      apiKey: "",
      apiSecret: "",
      authMethod: "rest_api",
      syncEnabled: true,
      syncFrequency: "daily",
      memberPressEnabled: true,
      allowedRoles: ["subscriber", "member"],
    },
  });

  // Reset form when settings are loaded
  useEffect(() => {
    if (settings && typeof settings === 'object') {
      const settingsData = settings as any;
      form.reset({
        wordpressUrl: settingsData.wordpressUrl || "",
        apiKey: settingsData.apiKey || "",
        apiSecret: settingsData.apiSecret || "",
        authMethod: settingsData.authMethod || "rest_api",
        syncEnabled: settingsData.syncEnabled ?? true,
        syncFrequency: settingsData.syncFrequency || "daily",
        memberPressEnabled: settingsData.memberPressEnabled ?? true,
        allowedRoles: settingsData.allowedRoles || ["subscriber", "member"],
      });
      setLastSync(settingsData.lastSync ? new Date(settingsData.lastSync) : null);
      
      // Set connection status based on whether we have saved configuration
      if (settingsData.wordpressUrl && settingsData.apiKey && settingsData.apiSecret) {
        setConnectionStatus('success');
      } else {
        setConnectionStatus('idle');
      }
    }
  }, [settings, form]);

  // Test connection mutation
  const testConnectionMutation = useMutation({
    mutationFn: async (data: IntegrationFormData) => {
      return apiRequest("POST", "/api/integration-settings/test-connection", data);
    },
    onMutate: () => {
      setConnectionStatus('testing');
      setConnectionError("");
    },
    onSuccess: async (response, variables) => {
      setConnectionStatus('success');
      // Auto-save configuration after successful connection test
      try {
        await saveSettingsMutation.mutateAsync(variables);
        toast({
          title: "Conexión exitosa y configuración guardada",
          description: "La conexión con WordPress se estableció correctamente y la configuración se guardó automáticamente",
        });
      } catch (saveError) {
        toast({
          title: "Conexión exitosa",
          description: "La conexión fue exitosa, pero hubo un error al guardar la configuración automáticamente",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      setConnectionStatus('error');
      setConnectionError(error.message || "Error al conectar con WordPress");
      toast({
        title: "Error de conexión",
        description: error.message || "No se pudo conectar con WordPress",
        variant: "destructive",
      });
    },
  });

  // Save settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async (data: IntegrationFormData) => {
      return apiRequest("PUT", "/api/integration-settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integration-settings"] });
      toast({
        title: "Configuración guardada",
        description: "Los ajustes de integración se guardaron correctamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error al guardar",
        description: error.message || "No se pudo guardar la configuración",
        variant: "destructive",
      });
    },
  });

  // Sync users mutation
  const syncUsersMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/integration-settings/sync-users");
    },
    onSuccess: (response: any) => {
      setLastSync(new Date());
      toast({
        title: "Sincronización completada",
        description: `Se sincronizaron ${(response as any).syncedUsers || 0} usuarios`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error en sincronización",
        description: error.message || "Error al sincronizar usuarios",
        variant: "destructive",
      });
    },
  });

  const handleTestConnection = () => {
    const formData = form.getValues();
    testConnectionMutation.mutate(formData);
  };

  const handleSaveSettings = (data: IntegrationFormData) => {
    saveSettingsMutation.mutate(data);
  };

  const handleSyncUsers = () => {
    syncUsersMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary">Integración WordPress</h1>
          <p className="text-gray-600 mt-1">
            Configura la conexión con tu sitio WordPress y MemberPress
          </p>
        </div>
        <Badge variant={connectionStatus === 'success' ? 'default' : 'secondary'}>
          {connectionStatus === 'success' ? 'Conectado' : 'Desconectado'}
        </Badge>
        {connectionStatus === 'success' && (
          <p className="text-sm text-green-600 mt-1">
            ✓ Configuración guardada y lista para usar
          </p>
        )}
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Esta configuración permite sincronizar automáticamente los miembros de tu sitio WordPress 
          con el directorio empresarial. Los usuarios con membresías activas en MemberPress 
          tendrán acceso automático al sistema.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Configuration Form - Left Column */}
        <div className="lg:col-span-2">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSaveSettings)} className="space-y-6">
              {/* WordPress Connection Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    Configuración de WordPress
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="wordpressUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>URL del sitio WordPress *</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="https://misitio.com"
                            type="url"
                          />
                        </FormControl>
                        <FormDescription>
                          Ingresa la URL completa de tu sitio WordPress (incluye https://)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="apiKey"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>API Key *</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="password"
                              placeholder="Tu API Key de WordPress"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="apiSecret"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>API Secret *</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="password"
                              placeholder="Tu API Secret de WordPress"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="authMethod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Método de Autenticación *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona el método de autenticación" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="rest_api">REST API con Token</SelectItem>
                            <SelectItem value="jwt">JWT (JSON Web Token)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          REST API es más sencillo para la mayoría de sitios WordPress
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Connection Test */}
                  <div className="pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleTestConnection}
                      disabled={testConnectionMutation.isPending}
                      className="w-full"
                    >
                      {testConnectionMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : connectionStatus === 'success' ? (
                        <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                      ) : connectionStatus === 'error' ? (
                        <XCircle className="h-4 w-4 mr-2 text-red-600" />
                      ) : (
                        <Key className="h-4 w-4 mr-2" />
                      )}
                      {testConnectionMutation.isPending ? 'Probando conexión...' : 'Probar Conexión'}
                    </Button>

                    {connectionStatus === 'error' && connectionError && (
                      <Alert className="mt-3" variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>{connectionError}</AlertDescription>
                      </Alert>
                    )}

                    {connectionStatus === 'success' && (
                      <Alert className="mt-3">
                        <CheckCircle className="h-4 w-4" />
                        <AlertDescription>
                          Conexión establecida correctamente. WordPress es accesible.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* MemberPress Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Configuración de MemberPress
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="memberPressEnabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel>Habilitar integración con MemberPress</FormLabel>
                          <FormDescription>
                            Sincroniza solo usuarios con membresías activas
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="allowedRoles"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Roles de usuario permitidos *</FormLabel>
                        <FormDescription>
                          Selecciona qué roles de WordPress pueden acceder al sistema
                        </FormDescription>
                        <div className="grid grid-cols-2 gap-2 pt-2">
                          {['subscriber', 'member', 'contributor', 'author', 'editor'].map((role) => (
                            <Label key={role} className="flex items-center space-x-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={field.value.includes(role)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    field.onChange([...field.value, role]);
                                  } else {
                                    field.onChange(field.value.filter(r => r !== role));
                                  }
                                }}
                              />
                              <span className="capitalize">{role}</span>
                            </Label>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Sync Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <RefreshCw className="h-5 w-5" />
                    Configuración de Sincronización
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="syncEnabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel>Sincronización automática</FormLabel>
                          <FormDescription>
                            Mantener usuarios sincronizados automáticamente
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="syncFrequency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Frecuencia de sincronización</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona la frecuencia" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="manual">Manual</SelectItem>
                            <SelectItem value="hourly">Cada hora</SelectItem>
                            <SelectItem value="daily">Diario</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          La sincronización automática se ejecutará según la frecuencia seleccionada
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-blue-900">Estado de Sincronización</h4>
                        <p className="text-sm text-blue-800">
                          {lastSync ? `Última sincronización: ${lastSync.toLocaleString()}` : 'No se ha sincronizado'}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleSyncUsers}
                        disabled={syncUsersMutation.isPending || connectionStatus !== 'success'}
                      >
                        {syncUsersMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4 mr-2" />
                        )}
                        Sincronizar ahora
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-2">
                <Button
                  type="submit"
                  disabled={saveSettingsMutation.isPending}
                  className="bg-[#bcce16] hover:bg-[#a8b814] text-black"
                >
                  {saveSettingsMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Settings className="h-4 w-4 mr-2" />
                  )}
                  Guardar Configuración
                </Button>
              </div>
            </form>
          </Form>
        </div>

        {/* Instructions Panel - Right Column */}
        <div className="lg:col-span-1">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5" />
                Instrucciones de Configuración
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-2">🔑 Cómo obtener las credenciales de WordPress:</h4>
                  <ol className="text-sm text-blue-800 space-y-2">
                    <li>1. <strong>Instalar plugin:</strong> Ve a Plugins → Añadir nuevo → Busca "Application Passwords" o "JWT Authentication"</li>
                    <li>2. <strong>Activar REST API:</strong> En Ajustes → Enlaces permanentes, asegúrate de tener URLs amigables</li>
                    <li>3. <strong>Crear credenciales:</strong> Ve a Usuarios → Tu perfil → Contraseñas de aplicación</li>
                    <li>4. <strong>API Key:</strong> Tu nombre de usuario de WordPress</li>
                    <li>5. <strong>API Secret:</strong> La contraseña de aplicación generada</li>
                    <li>6. <strong>Verificar permisos:</strong> El usuario debe tener permisos para gestionar usuarios</li>
                  </ol>
                </div>
                
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-medium text-green-900 mb-2">📋 Para MemberPress (opcional):</h4>
                  <ul className="text-sm text-green-800 space-y-1">
                    <li>• Instala y activa el plugin MemberPress</li>
                    <li>• Ve a MemberPress → Opciones → API → Habilitar API</li>
                    <li>• Copia la clave API generada automáticamente</li>
                    <li>• Configura los niveles de membresía que deseas sincronizar</li>
                  </ul>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <h4 className="font-medium text-amber-900 mb-2">⚠️ Importante:</h4>
                  <ul className="text-sm text-amber-800 space-y-1">
                    <li>• Usa HTTPS en tu sitio WordPress para mayor seguridad</li>
                    <li>• Las credenciales deben tener permisos de administrador o editor</li>
                    <li>• Prueba la conexión antes de activar la sincronización automática</li>
                    <li>• Los usuarios sincronizados tendrán acceso como "representantes"</li>
                  </ul>
                </div>

                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h4 className="font-medium text-purple-900 mb-2">🔗 URLs de prueba comunes:</h4>
                  <ul className="text-sm text-purple-800 space-y-1">
                    <li>• REST API: <code>https://tusitio.com/wp-json/wp/v2/users</code></li>
                    <li>• MemberPress: <code>https://tusitio.com/wp-json/mp/v1/members</code></li>
                    <li>• Verificar API: <code>https://tusitio.com/wp-json/</code></li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}