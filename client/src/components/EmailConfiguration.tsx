import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
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
  Mail, 
  Send, 
  Settings, 
  Shield, 
  Eye, 
  EyeOff, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  FileText,
  TestTube,
  Server,
  Lock,
  Globe,
  User,
  Key,
  Edit3,
  Save,
  Calendar,
  Info
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

// Email configuration schema
const emailConfigSchema = z.object({
  provider: z.string().min(1, "Selecciona un proveedor"),
  fromEmail: z.string().email("Email inválido"),
  fromName: z.string().min(1, "Nombre del remitente requerido"),
  smtpHost: z.string().min(1, "Servidor SMTP requerido"),
  smtpPort: z.coerce.number().min(1, "Puerto inválido").max(65535, "Puerto inválido"),
  encryption: z.enum(["none", "ssl", "tls", "starttls"]),
  username: z.string().min(1, "Usuario requerido"),
  password: z.string().min(1, "Contraseña requerida"),
  testEmail: z.string().email("Email de prueba inválido").optional().or(z.literal("")),
});

type EmailConfigData = z.infer<typeof emailConfigSchema>;

// Email template schema
const emailTemplateSchema = z.object({
  type: z.string(),
  subject: z.string().min(1, "Asunto requerido"),
  htmlContent: z.string().min(1, "Contenido requerido"),
  variables: z.array(z.string()).optional(),
  notificationTiming: z.object({
    enabled: z.boolean().default(false),
    value: z.number().min(1, "Valor debe ser mayor a 0").max(365, "Valor máximo 365"),
    unit: z.enum(["days", "weeks", "months"])
  }).optional()
});

type EmailTemplateData = z.infer<typeof emailTemplateSchema>;

// Predefined providers
const emailProviders = [
  {
    id: "gmail",
    name: "Gmail",
    smtpHost: "smtp.gmail.com",
    smtpPort: 587,
    encryption: "starttls",
    description: "Usar cuenta Gmail personal o G Suite"
  },
  {
    id: "outlook",
    name: "Outlook 365",
    smtpHost: "smtp-mail.outlook.com",
    smtpPort: 587,
    encryption: "starttls",
    description: "Cuentas Outlook.com, Hotmail, Live"
  },
  {
    id: "sendgrid",
    name: "SendGrid",
    smtpHost: "smtp.sendgrid.net",
    smtpPort: 587,
    encryption: "starttls",
    description: "Servicio profesional de envío de emails"
  },
  {
    id: "mailgun",
    name: "Mailgun",
    smtpHost: "smtp.mailgun.org",
    smtpPort: 587,
    encryption: "starttls",
    description: "API de correo para desarrolladores"
  },
  {
    id: "custom",
    name: "Servidor personalizado",
    smtpHost: "",
    smtpPort: 587,
    encryption: "starttls",
    description: "Configuración manual de servidor SMTP"
  }
];

// Email templates types
const emailTemplateTypes = [
  { 
    id: "welcome", 
    name: "Bienvenida", 
    description: "Cuando un representante es asignado o compra un plan",
    variables: ["{{nombre_usuario}}", "{{nombre_empresa}}", "{{plan_nombre}}", "{{fecha_inicio}}"],
    supportsScheduling: false
  },
  { 
    id: "renewal", 
    name: "Renovación", 
    description: "Cuando el sistema renueva el plan automáticamente",
    variables: ["{{nombre_usuario}}", "{{nombre_empresa}}", "{{plan_nombre}}", "{{fecha_vencimiento}}"],
    supportsScheduling: true
  },
  { 
    id: "cancellation", 
    name: "Cancelación", 
    description: "Cuando se cancela un plan de membresía",
    variables: ["{{nombre_usuario}}", "{{nombre_empresa}}", "{{plan_nombre}}", "{{fecha_cancelacion}}"],
    supportsScheduling: false
  },
  { 
    id: "notification", 
    name: "Notificación de Vencimiento", 
    description: "Recordatorio antes del vencimiento de membresía",
    variables: ["{{nombre_usuario}}", "{{nombre_empresa}}", "{{plan_nombre}}", "{{fecha_vencimiento}}", "{{dias_restantes}}"],
    supportsScheduling: true
  }
];

export default function EmailConfiguration() {
  const [activeTab, setActiveTab] = useState("smtp");
  const [showPassword, setShowPassword] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState("gmail");
  const [testingConnection, setTestingConnection] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [testingTemplate, setTestingTemplate] = useState<string | null>(null);
  const { toast } = useToast();

  // Fetch current email configuration
  const { data: emailConfig, isLoading: configLoading } = useQuery({
    queryKey: ["/api/email-config"],
    queryFn: async () => {
      const response = await fetch("/api/email-config", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch email config");
      return response.json();
    },
  });

  // Fetch email templates
  const { data: emailTemplates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ["/api/email-templates"],
    queryFn: async () => {
      const response = await fetch("/api/email-templates", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch email templates");
      return response.json();
    },
  });

  // SMTP Configuration form
  const configForm = useForm<EmailConfigData>({
    resolver: zodResolver(emailConfigSchema),
    defaultValues: {
      provider: "gmail",
      fromEmail: "",
      fromName: "",
      smtpHost: "smtp.gmail.com",
      smtpPort: 587,
      encryption: "starttls",
      username: "",
      password: "",
      testEmail: "",
    },
  });

  // Template form
  const templateForm = useForm<EmailTemplateData>({
    resolver: zodResolver(emailTemplateSchema),
    defaultValues: {
      type: "welcome",
      subject: "",
      htmlContent: "",
      variables: [],
      notificationTiming: {
        enabled: false,
        value: 7,
        unit: "days"
      }
    },
  });

  // Update form when config loads
  useEffect(() => {
    if (emailConfig) {
      configForm.reset({
        provider: emailConfig.provider || "gmail",
        fromEmail: emailConfig.fromEmail || "",
        fromName: emailConfig.fromName || "",
        smtpHost: emailConfig.smtpHost || "smtp.gmail.com",
        smtpPort: emailConfig.smtpPort || 587,
        encryption: emailConfig.encryption || "starttls",
        username: emailConfig.username || "",
        password: emailConfig.password || "",
        testEmail: emailConfig.testEmail || "",
      });
      setSelectedProvider(emailConfig.provider || "gmail");
    }
  }, [emailConfig, configForm]);

  // Handle provider change
  const handleProviderChange = (providerId: string) => {
    setSelectedProvider(providerId);
    const provider = emailProviders.find(p => p.id === providerId);
    if (provider && provider.id !== "custom") {
      configForm.setValue("smtpHost", provider.smtpHost);
      configForm.setValue("smtpPort", provider.smtpPort);
      configForm.setValue("encryption", provider.encryption as any);
    }
    configForm.setValue("provider", providerId);
  };

  // Save SMTP configuration
  const saveConfigMutation = useMutation({
    mutationFn: async (data: EmailConfigData) => {
      const response = await apiRequest("POST", "/api/email-config", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Configuración guardada",
        description: "La configuración de correo se ha guardado correctamente",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/email-config"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al guardar la configuración",
        variant: "destructive",
      });
    },
  });

  // Test email connection
  const testConnectionMutation = useMutation({
    mutationFn: async (data: EmailConfigData) => {
      const response = await apiRequest("POST", "/api/email-config/test", data);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "✅ Correo de prueba enviado",
        description: data.message || "La configuración de correo funciona correctamente",
      });
      setTestingConnection(false);
    },
    onError: (error: any) => {
      console.error("Email test error:", error);
      const errorMessage = error.message || "No se pudo enviar el correo de prueba";
      
      toast({
        title: "❌ Error en la prueba",
        description: errorMessage,
        variant: "destructive",
        duration: 8000, // Show error longer
      });
      setTestingConnection(false);
    },
  });

  // Save email template
  const saveTemplateMutation = useMutation({
    mutationFn: async (data: EmailTemplateData) => {
      const response = await apiRequest("POST", "/api/email-templates", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Plantilla guardada",
        description: "La plantilla de correo se ha guardado correctamente",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/email-templates"] });
      setEditingTemplate(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al guardar la plantilla",
        variant: "destructive",
      });
    },
  });

  // Test email template
  const testTemplateMutation = useMutation({
    mutationFn: async (templateType: string) => {
      const testEmail = emailConfig?.testEmail || emailConfig?.fromEmail;
      const response = await apiRequest("POST", `/api/email-templates/test/${templateType}`, { testEmail });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "✅ Correo de prueba enviado",
        description: data.message || "El correo de prueba se ha enviado correctamente",
      });
      setTestingTemplate(null);
    },
    onError: (error: any) => {
      toast({
        title: "❌ Error al enviar prueba",
        description: error.message || "No se pudo enviar el correo de prueba",
        variant: "destructive",
      });
      setTestingTemplate(null);
    },
  });

  const onTestTemplate = (templateType: string) => {
    setTestingTemplate(templateType);
    testTemplateMutation.mutate(templateType);
  };

  const onConfigSubmit = (data: EmailConfigData) => {
    saveConfigMutation.mutate(data);
  };

  const onTestConnection = () => {
    const data = configForm.getValues();
    setTestingConnection(true);
    testConnectionMutation.mutate(data);
  };

  const onTemplateSubmit = (data: EmailTemplateData) => {
    saveTemplateMutation.mutate(data);
  };

  const selectedProviderInfo = emailProviders.find(p => p.id === selectedProvider);

  if (configLoading || templatesLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#bcce16]"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Left Column - Configuration Forms */}
      <div className="w-full lg:w-2/3 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-6 w-6" />
            Configuración de Correos Transaccionales
          </CardTitle>
          <p className="text-gray-600">
            Configura el sistema de envío de correos electrónicos para notificaciones automáticas
          </p>
        </CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="smtp" className="flex items-center gap-2">
            <Server className="h-4 w-4" />
            Configuración SMTP
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Plantillas de Correo
          </TabsTrigger>
        </TabsList>

        {/* SMTP Configuration Tab */}
        <TabsContent value="smtp">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Configuración del Servidor SMTP
              </CardTitle>
              <p className="text-sm text-gray-600">
                Configura las credenciales y parámetros para el envío de correos
              </p>
            </CardHeader>
            <CardContent>
              <Form {...configForm}>
                <form onSubmit={configForm.handleSubmit(onConfigSubmit)} className="space-y-6">
                  {/* Provider Selection */}
                  <FormField
                    control={configForm.control}
                    name="provider"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Globe className="h-4 w-4" />
                          Proveedor de Correo
                        </FormLabel>
                        <Select onValueChange={handleProviderChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona un proveedor" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {emailProviders.map((provider) => (
                              <SelectItem key={provider.id} value={provider.id}>
                                <div className="flex flex-col">
                                  <span className="font-medium">{provider.name}</span>
                                  <span className="text-xs text-gray-500">{provider.description}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          {selectedProviderInfo?.description}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* From Email */}
                    <FormField
                      control={configForm.control}
                      name="fromEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            Email Remitente
                          </FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="correo@empresa.com" {...field} />
                          </FormControl>
                          <FormDescription>
                            Dirección que aparecerá como remitente
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* From Name */}
                    <FormField
                      control={configForm.control}
                      name="fromName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            Nombre Remitente
                          </FormLabel>
                          <FormControl>
                            <Input placeholder="Directorio ANPR" {...field} />
                          </FormControl>
                          <FormDescription>
                            Nombre que aparecerá junto al email
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* SMTP Host */}
                    <FormField
                      control={configForm.control}
                      name="smtpHost"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <Server className="h-4 w-4" />
                            Servidor SMTP
                          </FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="smtp.ejemplo.com" 
                              {...field} 
                              disabled={selectedProvider !== "custom"}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* SMTP Port */}
                    <FormField
                      control={configForm.control}
                      name="smtpPort"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Puerto</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="587" 
                              {...field} 
                              disabled={selectedProvider !== "custom"}
                            />
                          </FormControl>
                          <FormDescription>
                            587 (STARTTLS) o 465 (SSL)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Encryption */}
                    <FormField
                      control={configForm.control}
                      name="encryption"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <Shield className="h-4 w-4" />
                            Cifrado
                          </FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            value={field.value}
                            disabled={selectedProvider !== "custom"}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="starttls">STARTTLS (Recomendado)</SelectItem>
                              <SelectItem value="ssl">SSL/TLS</SelectItem>
                              <SelectItem value="tls">TLS</SelectItem>
                              <SelectItem value="none">Ninguno (No recomendado)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Username */}
                    <FormField
                      control={configForm.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            Usuario / API Key
                          </FormLabel>
                          <FormControl>
                            <Input placeholder="usuario@ejemplo.com" {...field} />
                          </FormControl>
                          <FormDescription>
                            Para Gmail: tu email. Para servicios como SendGrid: API Key
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Password */}
                    <FormField
                      control={configForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <Key className="h-4 w-4" />
                            Contraseña / API Secret
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input 
                                type={showPassword ? "text" : "password"} 
                                placeholder="••••••••" 
                                {...field} 
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                onClick={() => setShowPassword(!showPassword)}
                              >
                                {showPassword ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </FormControl>
                          <FormDescription>
                            Para Gmail: contraseña de aplicación. Para APIs: secret key
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Test Email */}
                  <FormField
                    control={configForm.control}
                    name="testEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <TestTube className="h-4 w-4" />
                          Email de Prueba
                        </FormLabel>
                        <FormControl>
                          <Input 
                            type="email" 
                            placeholder="prueba@ejemplo.com" 
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription>
                          Email donde enviar el mensaje de prueba (opcional - si no se especifica, se enviará al email remitente)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Provider-specific configuration tips */}
                  {selectedProviderInfo && selectedProviderInfo.id !== "custom" && (
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertTitle>Configuración para {selectedProviderInfo.name}</AlertTitle>
                      <AlertDescription>
                        {selectedProviderInfo.id === "gmail" && (
                          <>
                            <strong>Para Gmail:</strong><br />
                            • Habilita la verificación en 2 pasos<br />
                            • Genera una "Contraseña de aplicación" específica<br />
                            • Usa tu email completo como usuario<br />
                            • Si hay problemas, intenta habilitar "Acceso de apps menos seguras"
                          </>
                        )}
                        {selectedProviderInfo.id === "outlook" && (
                          <>
                            <strong>Para Outlook/Hotmail:</strong><br />
                            • Usa tu email completo como usuario<br />
                            • Usa tu contraseña normal de la cuenta<br />
                            • Asegúrate de tener habilitado SMTP<br />
                            • Puerto 587 con STARTTLS es recomendado
                          </>
                        )}
                        {selectedProviderInfo.id === "sendgrid" && (
                          <>
                            <strong>Para SendGrid:</strong><br />
                            • Usuario: "apikey" (literalmente)<br />
                            • Contraseña: Tu API Key de SendGrid<br />
                            • Asegúrate de tener un dominio verificado
                          </>
                        )}
                        {selectedProviderInfo.id === "mailgun" && (
                          <>
                            <strong>Para Mailgun:</strong><br />
                            • Usuario: Tu usuario SMTP de Mailgun<br />
                            • Contraseña: Tu contraseña SMTP de Mailgun<br />
                            • Verifica tu dominio en Mailgun
                          </>
                        )}
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Security Alert */}
                  <Alert>
                    <Lock className="h-4 w-4" />
                    <AlertTitle>Seguridad</AlertTitle>
                    <AlertDescription>
                      Las credenciales se almacenan de forma segura y cifrada. Para Gmail, se recomienda usar contraseñas de aplicación en lugar de tu contraseña principal.
                    </AlertDescription>
                  </Alert>

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-4 border-t">
                    <Button 
                      type="button"
                      variant="outline"
                      onClick={onTestConnection}
                      disabled={testingConnection || testConnectionMutation.isPending}
                    >
                      {testingConnection || testConnectionMutation.isPending ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2" />
                          Conectando... (puede tomar hasta 60s)
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Probar y Enviar Email
                        </>
                      )}
                    </Button>
                    <Button 
                      type="submit"
                      disabled={saveConfigMutation.isPending}
                      className="bg-[#bcce16] hover:bg-[#a8b814] text-black"
                    >
                      {saveConfigMutation.isPending ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black mr-2" />
                          Guardando...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Guardar Configuración
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Email Templates Tab */}
        <TabsContent value="templates">
          <div className="space-y-6">
            {emailTemplateTypes.map((templateType) => {
              const existingTemplate = emailTemplates.find((t: any) => t.type === templateType.id);
              const isEditing = editingTemplate === templateType.id;

              return (
                <Card key={templateType.id}>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        {templateType.name}
                      </CardTitle>
                      <p className="text-sm text-gray-600">{templateType.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {existingTemplate && (
                        <Badge variant="secondary">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Configurado
                        </Badge>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onTestTemplate(templateType.id)}
                        disabled={testingTemplate === templateType.id}
                        data-testid={`btn-test-template-${templateType.id}`}
                      >
                        {testingTemplate === templateType.id ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2" />
                            Enviando...
                          </>
                        ) : (
                          <>
                            <TestTube className="h-4 w-4 mr-2" />
                            Probar
                          </>
                        )}
                      </Button>
                      <Button
                        variant={isEditing ? "outline" : "default"}
                        size="sm"
                        onClick={() => {
                          if (isEditing) {
                            setEditingTemplate(null);
                          } else {
                            setEditingTemplate(templateType.id);
                            if (existingTemplate) {
                              templateForm.reset({
                                type: existingTemplate.type,
                                subject: existingTemplate.subject,
                                htmlContent: existingTemplate.htmlContent,
                                variables: templateType.variables,
                                notificationTiming: existingTemplate.notificationTiming || {
                                  enabled: false,
                                  value: 7,
                                  unit: "days"
                                }
                              });
                            } else {
                              templateForm.reset({
                                type: templateType.id,
                                subject: "",
                                htmlContent: "",
                                variables: templateType.variables,
                                notificationTiming: {
                                  enabled: false,
                                  value: 7,
                                  unit: "days"
                                }
                              });
                            }
                          }
                        }}
                        className={!isEditing ? "bg-[#bcce16] hover:bg-[#a8b814] text-black" : ""}
                      >
                        {isEditing ? (
                          <>
                            <XCircle className="h-4 w-4 mr-2" />
                            Cancelar
                          </>
                        ) : (
                          <>
                            <Edit3 className="h-4 w-4 mr-2" />
                            {existingTemplate ? "Editar" : "Configurar"}
                          </>
                        )}
                      </Button>
                    </div>
                  </CardHeader>

                  {isEditing && (
                    <CardContent>
                      <Form {...templateForm}>
                        <form onSubmit={templateForm.handleSubmit(onTemplateSubmit)} className="space-y-4">
                          {/* Subject */}
                          <FormField
                            control={templateForm.control}
                            name="subject"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Asunto del Correo</FormLabel>
                                <FormControl>
                                  <Input 
                                    placeholder="Ej: Bienvenido a {{nombre_empresa}}"
                                    {...field} 
                                  />
                                </FormControl>
                                <FormDescription>
                                  Puedes usar variables dinámicas: {templateType.variables.join(", ")}
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          {/* HTML Content */}
                          <FormField
                            control={templateForm.control}
                            name="htmlContent"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Contenido del Correo</FormLabel>
                                <FormControl>
                                  <Textarea 
                                    rows={12}
                                    placeholder={`Estimado/a {{nombre_usuario}},

¡Bienvenido/a al Directorio de Proveedores de Equipamiento Urbano!

Tu empresa {{nombre_empresa}} ha sido registrada exitosamente con el plan {{plan_nombre}}.

Fecha de inicio: {{fecha_inicio}}

Puedes acceder a tu panel de control en: https://directorio-ANPR.replit.app/dashboard

¡Gracias por confiar en nosotros!

Equipo del Directorio ANPR`}
                                    {...field} 
                                  />
                                </FormControl>
                                <FormDescription>
                                  Contenido HTML del correo. Variables disponibles: {templateType.variables.join(", ")}
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          {/* Notification Timing Configuration - Only for supported templates */}
                          {templateType.supportsScheduling && (
                            <div className="space-y-4 p-4 border rounded-lg bg-blue-50">
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-blue-600" />
                                <h4 className="font-medium text-blue-900">Configuración de Envío</h4>
                              </div>
                              
                              <FormField
                                control={templateForm.control}
                                name="notificationTiming.enabled"
                                render={({ field }) => (
                                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                                    <div className="space-y-0.5">
                                      <FormLabel className="text-base">
                                        Programar envío automático
                                      </FormLabel>
                                      <FormDescription>
                                        Enviar esta notificación antes del vencimiento de la membresía
                                      </FormDescription>
                                    </div>
                                    <FormControl>
                                      <input
                                        type="checkbox"
                                        checked={field.value}
                                        onChange={field.onChange}
                                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                                      />
                                    </FormControl>
                                  </FormItem>
                                )}
                              />

                              {templateForm.watch("notificationTiming.enabled") && (
                                <div className="grid grid-cols-2 gap-4">
                                  <FormField
                                    control={templateForm.control}
                                    name="notificationTiming.value"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Cantidad</FormLabel>
                                        <FormControl>
                                          <Input 
                                            type="number" 
                                            min="1" 
                                            max="365" 
                                            placeholder="7" 
                                            {...field}
                                            onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                  
                                  <FormField
                                    control={templateForm.control}
                                    name="notificationTiming.unit"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Período</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                          <FormControl>
                                            <SelectTrigger>
                                              <SelectValue />
                                            </SelectTrigger>
                                          </FormControl>
                                          <SelectContent>
                                            <SelectItem value="days">Días</SelectItem>
                                            <SelectItem value="weeks">Semanas</SelectItem>
                                            <SelectItem value="months">Meses</SelectItem>
                                          </SelectContent>
                                        </Select>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </div>
                              )}

                              {templateForm.watch("notificationTiming.enabled") && (
                                <Alert>
                                  <CheckCircle className="h-4 w-4" />
                                  <AlertDescription>
                                    Esta notificación se enviará {templateForm.watch("notificationTiming.value")} {
                                      templateForm.watch("notificationTiming.unit") === "days" ? "días" :
                                      templateForm.watch("notificationTiming.unit") === "weeks" ? "semanas" : "meses"
                                    } antes del vencimiento de la membresía.
                                  </AlertDescription>
                                </Alert>
                              )}
                            </div>
                          )}

                          {/* Variables Help */}
                          <Alert>
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Variables Disponibles</AlertTitle>
                            <AlertDescription>
                              <div className="grid grid-cols-2 gap-2 mt-2">
                                {templateType.variables.map((variable) => (
                                  <code key={variable} className="text-xs bg-gray-100 px-2 py-1 rounded">
                                    {variable}
                                  </code>
                                ))}
                              </div>
                            </AlertDescription>
                          </Alert>

                          <div className="flex justify-end gap-2 pt-4 border-t">
                            <Button 
                              type="button" 
                              variant="outline"
                              onClick={() => setEditingTemplate(null)}
                            >
                              Cancelar
                            </Button>
                            <Button 
                              type="submit"
                              disabled={saveTemplateMutation.isPending}
                              className="bg-[#bcce16] hover:bg-[#a8b814] text-black"
                            >
                              {saveTemplateMutation.isPending ? (
                                <>
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black mr-2" />
                                  Guardando...
                                </>
                              ) : (
                                <>
                                  <Save className="h-4 w-4 mr-2" />
                                  Guardar Plantilla
                                </>
                              )}
                            </Button>
                          </div>
                        </form>
                      </Form>
                    </CardContent>
                  )}

                  {!isEditing && existingTemplate && (
                    <CardContent>
                      <div className="space-y-3">
                        <div>
                          <label className="text-sm font-medium text-gray-500">Asunto:</label>
                          <p className="text-gray-700">{existingTemplate.subject}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">Contenido:</label>
                          <div className="max-h-32 overflow-y-auto bg-gray-50 p-3 rounded text-sm text-gray-700">
                            {existingTemplate.htmlContent}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
      </div>
      
      {/* Right Column - Configuration Guide */}
      <div className="w-full lg:w-1/3 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-blue-600" />
              Guía de Configuración SMTP
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold text-sm mb-2">📧 Proveedores Comunes</h3>
              <div className="grid grid-cols-1 gap-3 text-sm">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <strong>Gmail</strong>
                  <div className="text-gray-600 mt-1">
                    • Host: smtp.gmail.com<br />
                    • Puerto: 587 (STARTTLS)<br />
                    • Requiere contraseña de aplicación
                  </div>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <strong>Outlook/Hotmail</strong>
                  <div className="text-gray-600 mt-1">
                    • Host: smtp-mail.outlook.com<br />
                    • Puerto: 587 (STARTTLS)<br />
                    • Usa tu contraseña normal
                  </div>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg">
                  <strong>SendGrid</strong>
                  <div className="text-gray-600 mt-1">
                    • Host: smtp.sendgrid.net<br />
                    • Puerto: 587 (STARTTLS)<br />
                    • Usuario: "apikey", Contraseña: API Key
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-sm mb-2">🔧 Solución de Problemas</h3>
              <div className="text-sm text-gray-600 space-y-2">
                <div className="p-3 bg-yellow-50 rounded-lg">
                  <strong>Error "Greeting never received":</strong>
                  <ul className="mt-1 space-y-1 text-xs">
                    <li>• Verifica el servidor SMTP y puerto</li>
                    <li>• Comprueba la configuración de firewall</li>
                    <li>• Intenta un puerto diferente (25, 465, 587, 2525)</li>
                    <li>• Verifica el tipo de cifrado (SSL/TLS/STARTTLS)</li>
                  </ul>
                </div>
                <div className="p-3 bg-red-50 rounded-lg">
                  <strong>Error de autenticación:</strong>
                  <ul className="mt-1 space-y-1 text-xs">
                    <li>• Confirma usuario y contraseña</li>
                    <li>• Para Gmail: usa contraseña de aplicación</li>
                    <li>• Verifica que SMTP esté habilitado</li>
                  </ul>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-sm mb-2">⚙️ Configuraciones Recomendadas</h3>
              <div className="text-sm text-gray-600 space-y-2">
                <div className="flex justify-between">
                  <span>Timeout de conexión:</span>
                  <span className="font-mono">60 segundos</span>
                </div>
                <div className="flex justify-between">
                  <span>Cifrado más seguro:</span>
                  <span className="font-mono">STARTTLS</span>
                </div>
                <div className="flex justify-between">
                  <span>Puerto estándar:</span>
                  <span className="font-mono">587</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}