import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Settings, 
  Palette, 
  Image, 
  Globe, 
  DollarSign,
  Save,
  Eye,
  Plus,
  Trash2,
  Mail,
  Phone,
  Upload,
  RefreshCw,
  X,
  Linkedin
} from "lucide-react";
import { SiFacebook, SiX, SiInstagram, SiYoutube, SiWhatsapp, SiTiktok, SiTelegram } from "react-icons/si";
import Swal from "sweetalert2";

const socialMediaSchema = z.object({
  platform: z.string().min(1, "Plataforma requerida"),
  url: z.string().url("URL vÃ¡lida requerida"),
  iconColor: z.string().min(1, "Color de Ã­cono requerido"),
});

const notificationEmailSchema = z.object({
  email: z.string().email("Email vÃ¡lido requerido"),
});

const systemSettingsSchema = z.object({
  systemName: z.string().min(1, "Nombre del sistema es requerido"),
  systemDescription: z.string().optional(),
  primaryColor: z.string().min(1, "Color primario es requerido"),
  secondaryColor: z.string().min(1, "Color secundario es requerido"),
  logoUrl: z.string().optional(),
  faviconUrl: z.string().optional(),
  currency: z.string().min(1, "Moneda es requerida"),
  contactEmail: z.string().email("Email vÃ¡lido requerido").optional(),
  contactPhone: z.string().optional(),
  socialMediaList: z.array(socialMediaSchema).optional(),
  notificationEmailsList: z.array(notificationEmailSchema).optional(),
});

type SystemSettingsFormData = z.infer<typeof systemSettingsSchema>;

interface SystemSettingsData {
  systemName?: string;
  systemDescription?: string;
  primaryColor?: string;
  secondaryColor?: string;
  logoUrl?: string;
  faviconUrl?: string;
  currency?: string;
  contactEmail?: string;
  contactPhone?: string;
  socialMedia?: string;
  notificationEmails?: string[];
}

const socialMediaPlatforms = [
  { value: "facebook", label: "Facebook", icon: SiFacebook, defaultColor: "#1877F2" },
  { value: "twitter", label: "X", icon: SiX, defaultColor: "#000000" },
  { value: "instagram", label: "Instagram", icon: SiInstagram, defaultColor: "#E4405F" },
  { value: "youtube", label: "YouTube", icon: SiYoutube, defaultColor: "#FF0000" },
  { value: "linkedin", label: "LinkedIn", icon: Linkedin, defaultColor: "#0077B5" },
  { value: "whatsapp", label: "WhatsApp", icon: SiWhatsapp, defaultColor: "#25D366" },
  { value: "tiktok", label: "TikTok", icon: SiTiktok, defaultColor: "#000000" },
  { value: "telegram", label: "Telegram", icon: SiTelegram, defaultColor: "#0088CC" },
];

const currencies = [
  { value: "USD", label: "USD - DÃ³lar Estadounidense", symbol: "$" },
  { value: "EUR", label: "EUR - Euro", symbol: "â‚¬" },
  { value: "MXN", label: "MXN - Peso Mexicano", symbol: "$" },
  { value: "COP", label: "COP - Peso Colombiano", symbol: "$" },
  { value: "ARS", label: "ARS - Peso Argentino", symbol: "$" },
  { value: "CLP", label: "CLP - Peso Chileno", symbol: "$" },
  { value: "PEN", label: "PEN - Sol Peruano", symbol: "S/." },
  { value: "BRL", label: "BRL - Real BrasileÃ±o", symbol: "R$" },
  { value: "CAD", label: "CAD - DÃ³lar Canadiense", symbol: "C$" },
  { value: "GBP", label: "GBP - Libra Esterlina", symbol: "Â£" },
  { value: "JPY", label: "JPY - Yen JaponÃ©s", symbol: "Â¥" },
  { value: "CNY", label: "CNY - Yuan Chino", symbol: "Â¥" },
];

export default function SystemSettings() {
  const { toast } = useToast();
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [faviconPreview, setFaviconPreview] = useState<string | null>(null);
  const [isTestingNotifications, setIsTestingNotifications] = useState(false);
  const [isEditingAdminTemplate, setIsEditingAdminTemplate] = useState(false);
  const [adminTemplateSubject, setAdminTemplateSubject] = useState("");
  const [adminTemplateContent, setAdminTemplateContent] = useState("");
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [isTestingAdminTemplate, setIsTestingAdminTemplate] = useState(false);

  const { data: settings, isLoading } = useQuery<SystemSettingsData>({
    queryKey: ["/api/system-settings"],
  });

  const { data: adminTemplate } = useQuery({
    queryKey: ["/api/email-templates", "admin_notification"],
    queryFn: async () => {
      const response = await fetch("/api/email-templates/admin_notification", { credentials: "include" });
      if (!response.ok) return null;
      return response.json();
    },
  });

  useEffect(() => {
    if (adminTemplate) {
      setAdminTemplateSubject(adminTemplate.subject || "");
      setAdminTemplateContent(adminTemplate.htmlContent || "");
    }
  }, [adminTemplate]);

  // Parse existing social media data
  const parseSocialMedia = (socialMediaJson: string) => {
    try {
      if (!socialMediaJson) return [];
      const parsed = JSON.parse(socialMediaJson);
      return Object.entries(parsed).map(([platform, url]) => ({
        platform,
        url: url as string,
        iconColor: socialMediaPlatforms.find(p => p.value === platform)?.defaultColor || "#000000"
      }));
    } catch {
      return [];
    }
  };

  // Update previews when settings load
  useEffect(() => {
    if (settings) {
      if (settings.logoUrl) {
        setLogoPreview(`/uploads/system-logos/${settings.logoUrl}`);
      }
      if (settings.faviconUrl) {
        setFaviconPreview(`/uploads/system-favicons/${settings.faviconUrl}`);
      }
    }
  }, [settings]);

  // Parse notification emails array to form format
  const parseNotificationEmails = (emails: string[] | undefined) => {
    if (!emails || !Array.isArray(emails)) return [];
    return emails.map(email => ({ email }));
  };

  const form = useForm<SystemSettingsFormData>({
    resolver: zodResolver(systemSettingsSchema),
    values: settings ? {
      systemName: settings.systemName || "Mi OrganizaciÃ³n",
      systemDescription: settings.systemDescription || "",
      primaryColor: settings.primaryColor || "#3b82f6",
      secondaryColor: settings.secondaryColor || "#64748b",
      logoUrl: settings.logoUrl || "",
      faviconUrl: settings.faviconUrl || "",
      currency: settings.currency || "USD",
      contactEmail: settings.contactEmail || "",
      contactPhone: settings.contactPhone || "",
      socialMediaList: parseSocialMedia(settings.socialMedia || ""),
      notificationEmailsList: parseNotificationEmails(settings.notificationEmails),
    } : {
      systemName: "Mi OrganizaciÃ³n",
      systemDescription: "",
      primaryColor: "#3b82f6",
      secondaryColor: "#64748b",
      logoUrl: "",
      faviconUrl: "",
      currency: "USD",
      contactEmail: "",
      contactPhone: "",
      socialMediaList: [],
      notificationEmailsList: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "socialMediaList",
  });

  const { fields: notificationFields, append: appendNotification, remove: removeNotification } = useFieldArray({
    control: form.control,
    name: "notificationEmailsList",
  });

  const updateMutation = useMutation({
    mutationFn: async (data: SystemSettingsFormData) => {
      // Convert socialMediaList back to JSON format for backend compatibility
      const socialMediaJson = data.socialMediaList?.reduce((acc, item) => {
        acc[item.platform] = item.url;
        return acc;
      }, {} as Record<string, string>);

      // Convert notificationEmailsList to array of strings
      const notificationEmailsArray = data.notificationEmailsList?.map(item => item.email) || [];

      // Guardar tambiÃ©n el sÃ­mbolo correspondiente a la moneda seleccionada,
      // para que toda la plataforma lo use de forma consistente.
      const selectedCurrency = currencies.find((c) => c.value === data.currency);

      const apiData = {
        ...data,
        currencySymbol: selectedCurrency?.symbol || "$",
        socialMedia: JSON.stringify(socialMediaJson || {}),
        socialMediaList: undefined, // Remove this field from API call
        notificationEmails: notificationEmailsArray,
        notificationEmailsList: undefined, // Remove this field from API call
      };

      const response = await apiRequest("PUT", "/api/system-settings", apiData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/system-settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/public/currency"] });
      Swal.fire({
        title: "Â¡Ã‰xito!",
        text: "ConfiguraciÃ³n actualizada correctamente",
        icon: "success",
        confirmButtonText: "Aceptar",
        confirmButtonColor: "#10b981",
      });
    },
    onError: (error: any) => {
      Swal.fire({
        title: "Error",
        text: error.message || "Error al actualizar la configuraciÃ³n",
        icon: "error",
        confirmButtonText: "Aceptar",
        confirmButtonColor: "#ef4444",
      });
    },
  });

  const onSubmit = async (data: SystemSettingsFormData) => {
    updateMutation.mutate(data);
  };

  // Test notification emails
  const handleTestNotifications = async () => {
    setIsTestingNotifications(true);
    try {
      const response = await fetch('/api/test-notification-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      
      const result = await response.json();
      
      if (result.success) {
        Swal.fire({
          title: "Â¡Correos enviados!",
          html: `
            <p>${result.message}</p>
            <div style="margin-top: 15px; text-align: left;">
              ${result.results?.map((r: any) => `
                <div style="padding: 8px; margin: 4px 0; background: ${r.success ? '#d1fae5' : '#fee2e2'}; border-radius: 4px;">
                  <strong>${r.email}</strong>: ${r.success ? 'âœ“ Enviado' : 'âœ— Fallido - ' + r.error}
                </div>
              `).join('')}
            </div>
          `,
          icon: "success",
          confirmButtonText: "Aceptar",
          confirmButtonColor: "#10b981",
        });
      } else {
        // Show detailed error with SMTP config info if available
        let errorHtml = `<p>${result.message || result.error || "No se pudieron enviar los correos de prueba"}</p>`;
        
        if (result.smtpConfig) {
          errorHtml += `
            <div style="margin-top: 15px; padding: 12px; background: #fef3c7; border-radius: 8px; text-align: left;">
              <strong>ConfiguraciÃ³n SMTP actual:</strong><br/>
              <small>Host: ${result.smtpConfig.host}</small><br/>
              <small>Puerto: ${result.smtpConfig.port}</small><br/>
              <small>EncriptaciÃ³n: ${result.smtpConfig.encryption}</small>
            </div>
            <p style="margin-top: 10px; font-size: 14px; color: #666;">
              Ve a <strong>Email â†’ ConfiguraciÃ³n SMTP</strong> para verificar o corregir estos valores.
            </p>
          `;
        }
        
        if (result.results && result.results.length > 0) {
          errorHtml += `
            <div style="margin-top: 15px; text-align: left;">
              ${result.results.map((r: any) => `
                <div style="padding: 8px; margin: 4px 0; background: #fee2e2; border-radius: 4px; font-size: 12px;">
                  <strong>${r.email}</strong>: âœ— Fallido
                </div>
              `).join('')}
            </div>
          `;
        }
        
        Swal.fire({
          title: "Error de ConexiÃ³n SMTP",
          html: errorHtml,
          icon: "error",
          confirmButtonText: "Entendido",
          confirmButtonColor: "#ef4444",
          width: 500,
        });
      }
    } catch (error: any) {
      Swal.fire({
        title: "Error",
        text: error.message || "Error al enviar correos de prueba",
        icon: "error",
        confirmButtonText: "Aceptar",
        confirmButtonColor: "#ef4444",
      });
    } finally {
      setIsTestingNotifications(false);
    }
  };

  // Save admin notification template
  const handleSaveAdminTemplate = async () => {
    setIsSavingTemplate(true);
    try {
      const response = await apiRequest("POST", "/api/email-templates", {
        type: "admin_notification",
        subject: adminTemplateSubject,
        htmlContent: adminTemplateContent,
        variables: ["{{nombre_empresa}}", "{{email_empresa}}", "{{telefono_empresa}}", "{{direccion_empresa}}", "{{plan_nombre}}", "{{periodicidad}}", "{{monto_pagado}}", "{{fecha_inicio}}", "{{fecha_vencimiento}}", "{{nombre_representante}}", "{{email_representante}}"],
        notificationTiming: { enabled: false, value: 0, unit: "days" }
      });
      
      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ["/api/email-templates", "admin_notification"] });
        toast({
          title: "Plantilla guardada",
          description: "La plantilla de notificaciÃ³n se ha guardado correctamente",
        });
        setIsEditingAdminTemplate(false);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Error al guardar la plantilla",
        variant: "destructive",
      });
    } finally {
      setIsSavingTemplate(false);
    }
  };

  // Test admin notification template
  const handleTestAdminTemplate = async () => {
    setIsTestingAdminTemplate(true);
    try {
      const response = await apiRequest("POST", "/api/email-templates/test/admin_notification", {});
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "âœ… Correo de prueba enviado",
          description: result.message,
        });
      } else {
        toast({
          title: "Error",
          description: result.error || "No se pudo enviar el correo de prueba",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Error al enviar correo de prueba",
        variant: "destructive",
      });
    } finally {
      setIsTestingAdminTemplate(false);
    }
  };

  // Handle file upload for logos and favicons
  const handleFileUpload = useCallback(async (file: File, type: 'logo' | 'favicon') => {
    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Error",
        description: "Solo se permiten archivos PNG, JPG, JPEG o SVG",
        variant: "destructive",
      });
      return;
    }

    // Validate image size (2 MiB max)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "Error", 
        description: "La imagen supera el tamaÃ±o mÃ¡ximo permitido de 2 MB. Selecciona una imagen mÃ¡s ligera.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);

      const response = await fetch('/api/system-settings/upload-image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Error uploading file');
      }

      const result = await response.json();
      
      if (type === 'logo') {
        form.setValue('logoUrl', result.filename);
        setLogoPreview(`/uploads/system-logos/${result.filename}`);
      } else {
        form.setValue('faviconUrl', result.filename);
        setFaviconPreview(`/uploads/system-favicons/${result.filename}`);
      }

      toast({
        title: "Ã‰xito",
        description: `${type === 'logo' ? 'Logo' : 'Favicon'} subido correctamente`,
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Error",
        description: "Error al subir el archivo",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  }, [form, toast]);

  // Handle drag and drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, type: 'logo' | 'favicon') => {
    e.preventDefault();
    e.stopPropagation();
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0], type);
    }
  }, [handleFileUpload]);

  const addSocialMedia = () => {
    append({
      platform: "facebook",
      url: "",
      iconColor: "#1877F2"
    });
  };

  const applyPreview = () => {
    const formData = form.getValues();
    const root = document.documentElement;
    
    if (isPreviewMode) {
      root.style.setProperty('--primary', formData.primaryColor);
      root.style.setProperty('--secondary', formData.secondaryColor);
      document.title = formData.systemName;
      
      if (formData.faviconUrl) {
        let favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
        if (!favicon) {
          favicon = document.createElement('link');
          favicon.rel = 'icon';
          document.head.appendChild(favicon);
        }
        favicon.href = formData.faviconUrl;
      }
    } else {
      root.style.removeProperty('--primary');
      root.style.removeProperty('--secondary');
      document.title = settings?.systemName || "Mi OrganizaciÃ³n";
    }
  };

  const togglePreview = () => {
    setIsPreviewMode(!isPreviewMode);
    setTimeout(applyPreview, 100);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Settings className="h-8 w-8" />
            ConfiguraciÃ³n del Sistema
          </h1>
          <p className="text-muted-foreground mt-2">
            Personaliza la apariencia y configuraciÃ³n de tu organizaciÃ³n
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={isPreviewMode ? "default" : "outline"}
            onClick={togglePreview}
          >
            <Eye className="h-4 w-4 mr-2" />
            {isPreviewMode ? "Aplicando Vista Previa" : "Vista Previa"}
          </Button>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* InformaciÃ³n General */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  InformaciÃ³n General
                </CardTitle>
                <CardDescription>
                  Configura la informaciÃ³n bÃ¡sica de tu organizaciÃ³n
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="systemName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre del Sistema</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Mi OrganizaciÃ³n" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="systemDescription"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>DescripciÃ³n</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field} 
                          placeholder="DescripciÃ³n de tu organizaciÃ³n"
                          rows={3}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Apariencia */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  Apariencia
                </CardTitle>
                <CardDescription>
                  Personaliza los colores y tema visual
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="primaryColor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Color Primario</FormLabel>
                      <FormControl>
                        <div className="flex gap-2">
                          <Input 
                            {...field} 
                            type="color" 
                            className="w-16 h-10 p-1 rounded"
                          />
                          <Input 
                            {...field} 
                            placeholder="#3b82f6"
                            className="flex-1"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="secondaryColor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Color Secundario</FormLabel>
                      <FormControl>
                        <div className="flex gap-2">
                          <Input 
                            {...field} 
                            type="color" 
                            className="w-16 h-10 p-1 rounded"
                          />
                          <Input 
                            {...field} 
                            placeholder="#64748b"
                            className="flex-1"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="currency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Moneda
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona una moneda" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {currencies.map((currency) => (
                            <SelectItem key={currency.value} value={currency.value}>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm">{currency.symbol}</span>
                                <span>{currency.label}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* ImÃ¡genes */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Image className="h-5 w-5" />
                  ImÃ¡genes
                </CardTitle>
                <CardDescription>
                  Logo y favicon de tu organizaciÃ³n
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Logo Upload */}
                <FormField
                  control={form.control}
                  name="logoUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Logo Principal</FormLabel>
                      <FormControl>
                        <div className="space-y-3">
                          <div 
                            className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-gray-400 transition-colors"
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, 'logo')}
                            onClick={() => document.getElementById('logo-upload')?.click()}
                          >
                            {logoPreview ? (
                              <div className="space-y-3">
                                <img 
                                  src={logoPreview} 
                                  alt="Logo preview" 
                                  className="mx-auto w-24 h-24 object-contain border rounded"
                                />
                                <div className="space-y-1">
                                  <p className="text-sm text-green-600 font-medium">âœ“ Logo cargado correctamente</p>
                                  <p className="text-xs text-gray-500">Haz clic o arrastra un archivo para cambiar</p>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                                <div className="space-y-1">
                                  <p className="text-sm font-medium text-gray-700">
                                    Arrastra tu logo aquÃ­ o haz clic para seleccionar
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    PNG, JPG, JPEG, SVG hasta 2 MB
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                          <input
                            id="logo-upload"
                            type="file"
                            accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleFileUpload(file, 'logo');
                              }
                            }}
                            className="hidden"
                          />
                          {logoPreview && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setLogoPreview(null);
                                form.setValue('logoUrl', '');
                              }}
                              className="w-full"
                            >
                              <X className="h-4 w-4 mr-2" />
                              Remover Logo
                            </Button>
                          )}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Favicon Upload */}
                <FormField
                  control={form.control}
                  name="faviconUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Favicon</FormLabel>
                      <FormControl>
                        <div className="space-y-3">
                          <div 
                            className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-gray-400 transition-colors"
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, 'favicon')}
                            onClick={() => document.getElementById('favicon-upload')?.click()}
                          >
                            {faviconPreview ? (
                              <div className="space-y-2">
                                <img 
                                  src={faviconPreview} 
                                  alt="Favicon preview" 
                                  className="mx-auto w-8 h-8 object-contain border rounded"
                                />
                                <div className="space-y-1">
                                  <p className="text-sm text-green-600 font-medium">âœ“ Favicon cargado</p>
                                  <p className="text-xs text-gray-500">Haz clic para cambiar</p>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <Upload className="mx-auto h-8 w-8 text-gray-400" />
                                <div className="space-y-1">
                                  <p className="text-sm font-medium text-gray-700">Subir favicon</p>
                                  <p className="text-xs text-gray-500">32x32px recomendado</p>
                                </div>
                              </div>
                            )}
                          </div>
                          <input
                            id="favicon-upload"
                            type="file"
                            accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                handleFileUpload(file, 'favicon');
                              }
                            }}
                            className="hidden"
                          />
                          {faviconPreview && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setFaviconPreview(null);
                                form.setValue('faviconUrl', '');
                              }}
                              className="w-full"
                            >
                              <X className="h-4 w-4 mr-2" />
                              Remover Favicon
                            </Button>
                          )}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Contacto */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  InformaciÃ³n de Contacto
                </CardTitle>
                <CardDescription>
                  Datos de contacto de la organizaciÃ³n
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="contactEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email de Contacto</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" placeholder="contacto@mi-organizacion.com" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="contactPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>TelÃ©fono de Contacto</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="+1 234 567 8900" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Correos de NotificaciÃ³n */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Notificaciones de Nuevos Registros
                </CardTitle>
                <CardDescription>
                  Correos electrÃ³nicos que recibirÃ¡n alertas cuando se registre una nueva empresa
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {notificationFields.map((field, index) => (
                  <div key={field.id} className="flex gap-3 items-end">
                    <FormField
                      control={form.control}
                      name={`notificationEmailsList.${index}.email`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel className={index > 0 ? "sr-only" : ""}>
                            Email de NotificaciÃ³n
                          </FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              type="email" 
                              placeholder="conexion@anpr.org.mx" 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => removeNotification(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                {notificationFields.length === 0 && (
                  <div className="text-center py-6 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
                    <Mail className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm">No hay correos de notificaciÃ³n configurados</p>
                    <p className="text-xs text-gray-400 mt-1">Agrega correos para recibir alertas de nuevos registros</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => appendNotification({ email: "" })}
                    className="flex-1"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar Correo
                  </Button>
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={handleTestAdminTemplate}
                    disabled={isTestingAdminTemplate || notificationFields.length === 0}
                    className="flex-1 bg-[#0f2161] hover:bg-[#1a3280] text-white"
                  >
                    {isTestingAdminTemplate ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Mail className="h-4 w-4 mr-2" />
                        Enviar Prueba
                      </>
                    )}
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditingAdminTemplate(true)}
                  className="w-full"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Editar Plantilla de Correo
                </Button>
                {notificationFields.length > 0 && (
                  <p className="text-xs text-gray-500 text-center">
                    Guarda los cambios antes de enviar una prueba si has agregado nuevos correos
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Dialog para editar plantilla de notificaciÃ³n */}
          <Dialog open={isEditingAdminTemplate} onOpenChange={setIsEditingAdminTemplate}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Plantilla de Correo de NotificaciÃ³n
                </DialogTitle>
                <DialogDescription>
                  Personaliza el correo que reciben los administradores cuando se registra una nueva empresa
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Asunto del Correo</label>
                  <Input
                    value={adminTemplateSubject}
                    onChange={(e) => setAdminTemplateSubject(e.target.value)}
                    placeholder="Nueva Empresa Registrada: {{nombre_empresa}}"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Contenido HTML</label>
                  <Textarea
                    value={adminTemplateContent}
                    onChange={(e) => setAdminTemplateContent(e.target.value)}
                    rows={15}
                    placeholder="<div>Contenido HTML del correo...</div>"
                    className="font-mono text-xs"
                  />
                </div>
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                  <p className="text-xs text-blue-800 font-medium mb-1">Variables disponibles:</p>
                  <p className="text-xs text-blue-600">
                    {"{{nombre_empresa}}, {{email_empresa}}, {{telefono_empresa}}, {{direccion_empresa}}, {{plan_nombre}}, {{periodicidad}}, {{monto_pagado}}, {{fecha_inicio}}, {{fecha_vencimiento}}, {{nombre_representante}}, {{email_representante}}"}
                  </p>
                </div>
                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsEditingAdminTemplate(false)}
                    className="flex-1"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    variant="default"
                    onClick={handleSaveAdminTemplate}
                    disabled={isSavingTemplate}
                    className="flex-1 bg-[#bcce16] hover:bg-[#a8b814] text-black"
                  >
                    {isSavingTemplate ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
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
              </div>
            </DialogContent>
          </Dialog>

          {/* Redes Sociales */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Redes Sociales
              </CardTitle>
              <CardDescription>
                Configura las redes sociales de tu organizaciÃ³n con colores personalizados
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {fields.map((field, index) => {
                const selectedPlatform = socialMediaPlatforms.find(p => p.value === form.watch(`socialMediaList.${index}.platform`));
                const IconComponent = selectedPlatform?.icon;

                return (
                  <div key={field.id} className="flex gap-4 items-end p-4 border rounded-lg">
                    <FormField
                      control={form.control}
                      name={`socialMediaList.${index}.platform`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel>Plataforma</FormLabel>
                          <Select 
                            onValueChange={(value) => {
                              field.onChange(value);
                              const platform = socialMediaPlatforms.find(p => p.value === value);
                              if (platform) {
                                form.setValue(`socialMediaList.${index}.iconColor`, platform.defaultColor);
                              }
                            }} 
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecciona plataforma" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {socialMediaPlatforms.map((platform) => (
                                <SelectItem key={platform.value} value={platform.value}>
                                  <div className="flex items-center gap-2">
                                    <platform.icon className="h-4 w-4" />
                                    <span>{platform.label}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`socialMediaList.${index}.url`}
                      render={({ field }) => (
                        <FormItem className="flex-2">
                          <FormLabel>URL</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="https://..." />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`socialMediaList.${index}.iconColor`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Color</FormLabel>
                          <FormControl>
                            <div className="flex gap-2 items-center">
                              <Input 
                                {...field} 
                                type="color" 
                                className="w-12 h-10 p-1 rounded"
                              />
                              {IconComponent && (
                                <IconComponent 
                                  className="h-5 w-5" 
                                  style={{ color: field.value }}
                                />
                              )}
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => remove(index)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}

              <Button
                type="button"
                variant="outline"
                onClick={addSocialMedia}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                Agregar Red Social
              </Button>
            </CardContent>
          </Card>

          {/* InformaciÃ³n sobre Vista Previa */}
          {isPreviewMode && (
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-blue-800">
                  <Eye className="h-5 w-5" />
                  <span className="font-medium">Modo Vista Previa Activo</span>
                </div>
                <p className="text-blue-700 text-sm mt-1">
                  Los cambios de colores y tÃ­tulo se estÃ¡n aplicando temporalmente. 
                  Guarda los cambios para aplicarlos permanentemente.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Acciones */}
          <div className="flex justify-end gap-4">
            <Button
              type="submit"
              disabled={updateMutation.isPending || isUploading}
              className="min-w-32 bg-[#bcce16] hover:bg-[#a8b814] text-black"
            >
              {isUploading ? (
                <>
                  <Upload className="h-4 w-4 mr-2 animate-bounce" />
                  Subiendo archivos...
                </>
              ) : updateMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Guardar ConfiguraciÃ³n
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

