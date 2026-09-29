import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
  Palette, 
  Layout, 
  Menu, 
  Image as ImageIcon, 
  Globe, 
  Phone, 
  Mail, 
  MapPin,
  Facebook,
  Twitter,
  Instagram,
  Youtube,
  MessageCircle,
  Music,
  Plus,
  Trash2,
  Upload,
  Eye,
  EyeOff,
  Settings,
  Save,
  Monitor
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

// Schema for form validation
const frontendConfigSchema = z.object({
  // Header Configuration
  headerBackgroundColor: z.string().optional(),
  headerBackgroundImage: z.string().optional(),
  headerTextColor: z.string().optional(),
  logoUrl: z.string().optional(),
  logoAltText: z.string().optional(),
  siteName: z.string().min(1, "Nombre del sitio es requerido"),
  siteSlogan: z.string().optional(),
  
  // Menu Configuration
  menuBackgroundColor: z.string().optional(),
  menuTextColor: z.string().optional(),
  menuHoverColor: z.string().optional(),
  showLoginButton: z.boolean().optional(),
  showRegisterButton: z.boolean().optional(),
  
  // Footer Configuration
  footerBackgroundColor: z.string().optional(),
  footerTextColor: z.string().optional(),
  footerBackgroundImage: z.string().optional(),
  showFooterLogo: z.boolean().optional(),
  
  // Contact Information
  companyName: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().email("Email inválido").optional().or(z.literal("")),
  contactAddress: z.string().optional(),
  contactHours: z.string().optional(),
  
  // General Style
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  accentColor: z.string().optional(),
  fontFamily: z.string().optional(),
  borderRadius: z.string().optional(),
  
  // Footer Text
  copyrightText: z.string().optional(),
  privacyPolicyUrl: z.string().optional(),
  termsOfServiceUrl: z.string().optional(),
  
  // Custom CSS
  customCss: z.string().optional(),
  customHead: z.string().optional(),
});

type FormData = z.infer<typeof frontendConfigSchema>;

interface MenuItem {
  id: string;
  label: string;
  href: string;
  icon?: string;
  isVisible: boolean;
  order: number;
  isExternal?: boolean;
}

interface SocialMediaItem {
  id: string;
  platform: string;
  url: string;
  icon: string;
  isVisible: boolean;
  order: number;
}

const iconOptions = [
  "Home", "Building2", "CreditCard", "Users", "Settings", "Info", "Contact", 
  "Phone", "Mail", "MapPin", "Calendar", "Clock", "Star", "Shield", "Award"
];

const socialMediaIcons = {
  facebook: Facebook,
  twitter: Twitter,
  instagram: Instagram,
  youtube: Youtube,
  whatsapp: MessageCircle,
  spotify: Music,
};

export default function FrontendConfigurationForm() {
  const { toast } = useToast();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [socialMedia, setSocialMedia] = useState<SocialMediaItem[]>([]);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [headerBgFile, setHeaderBgFile] = useState<File | null>(null);
  const [footerBgFile, setFooterBgFile] = useState<File | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(frontendConfigSchema),
    defaultValues: {
      siteName: "Directorio de Proveedores de Equipamiento Urbano",
      headerBackgroundColor: "#ffffff",
      headerTextColor: "#000000",
      menuBackgroundColor: "#ffffff",
      menuTextColor: "#000000",
      menuHoverColor: "#3B82F6",
      showLoginButton: true,
      showRegisterButton: true,
      footerBackgroundColor: "#1e3a8a",
      footerTextColor: "#ffffff",
      showFooterLogo: true,
      companyName: "ANPR México",
      primaryColor: "#3B82F6",
      secondaryColor: "#10B981",
      accentColor: "#F59E0B",
      fontFamily: "Inter",
      borderRadius: "8px",
      copyrightText: "© 2025 Todos los derechos reservados",
      privacyPolicyUrl: "/privacy",
      termsOfServiceUrl: "/terms",
    }
  });

  // Fetch current configuration
  const { data: config, isLoading } = useQuery({
    queryKey: ["/api/frontend-config"],
    queryFn: async () => {
      const response = await fetch("/api/frontend-config");
      return await response.json();
    },
  });

  // Save configuration mutation
  const saveConfigMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/frontend-config", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Configuración guardada",
        description: "La configuración visual se ha guardado correctamente",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/frontend-config"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "No se pudo guardar la configuración",
        variant: "destructive",
      });
    },
  });

  // Upload file mutation
  const uploadFileMutation = useMutation({
    mutationFn: async ({ file, endpoint }: { file: File; endpoint: string }) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });
      return await response.json();
    },
    onSuccess: (data, variables) => {
      if (variables.endpoint.includes('logo')) {
        form.setValue('logoUrl', data.logoUrl || data.imageUrl);
      } else if (variables.endpoint.includes('header')) {
        form.setValue('headerBackgroundImage', data.imageUrl);
      } else if (variables.endpoint.includes('footer')) {
        form.setValue('footerBackgroundImage', data.imageUrl);
      }
      toast({
        title: "Imagen subida",
        description: "La imagen se ha subido correctamente",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo subir la imagen",
        variant: "destructive",
      });
    },
  });

  // Load configuration data when available
  useEffect(() => {
    if (config) {
      form.reset(config);
      setMenuItems(config.menuItems || []);
      setSocialMedia(config.socialMediaConfig || []);
    }
  }, [config, form]);

  const onSubmit = (data: FormData) => {
    const configData = {
      ...data,
      menuItems: menuItems,
      socialMediaConfig: socialMedia,
    };
    saveConfigMutation.mutate(configData);
  };

  const handleFileUpload = (file: File, endpoint: string) => {
    uploadFileMutation.mutate({ file, endpoint });
  };

  const addMenuItem = () => {
    const newItem: MenuItem = {
      id: Date.now().toString(),
      label: "Nuevo Item",
      href: "/",
      icon: "Home",
      isVisible: true,
      order: menuItems.length + 1,
      isExternal: false,
    };
    setMenuItems([...menuItems, newItem]);
  };

  const updateMenuItem = (id: string, updates: Partial<MenuItem>) => {
    setMenuItems(items => items.map(item => 
      item.id === id ? { ...item, ...updates } : item
    ));
  };

  const removeMenuItem = (id: string) => {
    setMenuItems(items => items.filter(item => item.id !== id));
  };

  const addSocialMedia = () => {
    const newItem: SocialMediaItem = {
      id: Date.now().toString(),
      platform: "Facebook",
      url: "https://facebook.com/",
      icon: "facebook",
      isVisible: true,
      order: socialMedia.length + 1,
    };
    setSocialMedia([...socialMedia, newItem]);
  };

  const updateSocialMedia = (id: string, updates: Partial<SocialMediaItem>) => {
    setSocialMedia(items => items.map(item => 
      item.id === id ? { ...item, ...updates } : item
    ));
  };

  const removeSocialMedia = (id: string) => {
    setSocialMedia(items => items.filter(item => item.id !== id));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Monitor className="h-8 w-8 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configuración Visual del Frontend</h1>
          <p className="text-gray-600">Configura la apariencia y elementos del sitio web público</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Tabs defaultValue="header" className="w-full">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="header">Header</TabsTrigger>
              <TabsTrigger value="menu">Menú</TabsTrigger>
              <TabsTrigger value="footer">Footer</TabsTrigger>
              <TabsTrigger value="contact">Contacto</TabsTrigger>
              <TabsTrigger value="social">Redes Sociales</TabsTrigger>
              <TabsTrigger value="styles">Estilos</TabsTrigger>
            </TabsList>

            {/* Header Configuration */}
            <TabsContent value="header" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Layout className="h-5 w-5" />
                    Configuración del Header
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="siteName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nombre del Sitio</FormLabel>
                          <FormControl>
                            <Input placeholder="Directorio de Proveedores..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="siteSlogan"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Eslogan</FormLabel>
                          <FormControl>
                            <Input placeholder="Tu directorio de confianza..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <FormField
                      control={form.control}
                      name="headerBackgroundColor"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Color de Fondo</FormLabel>
                          <div className="flex gap-2">
                            <FormControl>
                              <Input type="color" {...field} className="w-16 h-10" />
                            </FormControl>
                            <FormControl>
                              <Input placeholder="#ffffff" {...field} />
                            </FormControl>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="headerTextColor"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Color de Texto</FormLabel>
                          <div className="flex gap-2">
                            <FormControl>
                              <Input type="color" {...field} className="w-16 h-10" />
                            </FormControl>
                            <FormControl>
                              <Input placeholder="#000000" {...field} />
                            </FormControl>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="logoAltText"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Texto Alternativo del Logo</FormLabel>
                          <FormControl>
                            <Input placeholder="Logo de la empresa" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Logo</h3>
                    <div className="flex items-center gap-4">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            setLogoFile(e.target.files[0]);
                            handleFileUpload(e.target.files[0], "/api/frontend-config/upload-logo");
                          }
                        }}
                        className="hidden"
                        id="logo-upload"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById('logo-upload')?.click()}
                        className="flex items-center gap-2"
                      >
                        <Upload className="h-4 w-4" />
                        Subir Logo
                      </Button>
                      {form.watch('logoUrl') && (
                        <div className="flex items-center gap-2">
                          <img 
                            src={form.watch('logoUrl')} 
                            alt="Logo preview" 
                            className="h-10 w-auto"
                          />
                          <span className="text-sm text-green-600">✓ Logo cargado</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Imagen de Fondo del Header</h3>
                    <div className="flex items-center gap-4">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            setHeaderBgFile(e.target.files[0]);
                            handleFileUpload(e.target.files[0], "/api/frontend-config/upload-header-image");
                          }
                        }}
                        className="hidden"
                        id="header-bg-upload"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById('header-bg-upload')?.click()}
                        className="flex items-center gap-2"
                      >
                        <ImageIcon className="h-4 w-4" />
                        Subir Imagen de Fondo
                      </Button>
                      {form.watch('headerBackgroundImage') && (
                        <span className="text-sm text-green-600">✓ Imagen de fondo cargada</span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Menu Configuration */}
            <TabsContent value="menu" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Menu className="h-5 w-5" />
                    Configuración del Menú
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <FormField
                      control={form.control}
                      name="menuBackgroundColor"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Color de Fondo</FormLabel>
                          <div className="flex gap-2">
                            <FormControl>
                              <Input type="color" {...field} className="w-16 h-10" />
                            </FormControl>
                            <FormControl>
                              <Input placeholder="#ffffff" {...field} />
                            </FormControl>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="menuTextColor"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Color de Texto</FormLabel>
                          <div className="flex gap-2">
                            <FormControl>
                              <Input type="color" {...field} className="w-16 h-10" />
                            </FormControl>
                            <FormControl>
                              <Input placeholder="#000000" {...field} />
                            </FormControl>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="menuHoverColor"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Color Hover</FormLabel>
                          <div className="flex gap-2">
                            <FormControl>
                              <Input type="color" {...field} className="w-16 h-10" />
                            </FormControl>
                            <FormControl>
                              <Input placeholder="#3B82F6" {...field} />
                            </FormControl>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex gap-6">
                    <FormField
                      control={form.control}
                      name="showLoginButton"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Mostrar Botón de Login</FormLabel>
                            <FormDescription>
                              Muestra el botón de acceso en el menú
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
                      name="showRegisterButton"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Mostrar Botón de Registro</FormLabel>
                            <FormDescription>
                              Muestra el botón de registro en el menú
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
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium">Items del Menú</h3>
                      <Button type="button" onClick={addMenuItem} className="flex items-center gap-2">
                        <Plus className="h-4 w-4" />
                        Agregar Item
                      </Button>
                    </div>

                    <div className="space-y-3">
                      {menuItems.map((item) => (
                        <div key={item.id} className="flex items-center gap-3 p-3 border rounded-lg">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => updateMenuItem(item.id, { isVisible: !item.isVisible })}
                              className="text-gray-500 hover:text-gray-700"
                            >
                              {item.isVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                            </button>
                          </div>
                          
                          <Input
                            value={item.label}
                            onChange={(e) => updateMenuItem(item.id, { label: e.target.value })}
                            placeholder="Texto del menú"
                            className="flex-1"
                          />
                          
                          <Input
                            value={item.href}
                            onChange={(e) => updateMenuItem(item.id, { href: e.target.value })}
                            placeholder="/ruta"
                            className="flex-1"
                          />
                          
                          <Select
                            value={item.icon}
                            onValueChange={(value) => updateMenuItem(item.id, { icon: value })}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {iconOptions.map((icon) => (
                                <SelectItem key={icon} value={icon}>
                                  {icon}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          
                          <Input
                            type="number"
                            value={item.order}
                            onChange={(e) => updateMenuItem(item.id, { order: parseInt(e.target.value) || 0 })}
                            placeholder="Orden"
                            className="w-20"
                          />
                          
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeMenuItem(item.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Footer Configuration */}
            <TabsContent value="footer" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Layout className="h-5 w-5" />
                    Configuración del Footer
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <FormField
                      control={form.control}
                      name="footerBackgroundColor"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Color de Fondo</FormLabel>
                          <div className="flex gap-2">
                            <FormControl>
                              <Input type="color" {...field} className="w-16 h-10" />
                            </FormControl>
                            <FormControl>
                              <Input placeholder="#1e3a8a" {...field} />
                            </FormControl>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="footerTextColor"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Color de Texto</FormLabel>
                          <div className="flex gap-2">
                            <FormControl>
                              <Input type="color" {...field} className="w-16 h-10" />
                            </FormControl>
                            <FormControl>
                              <Input placeholder="#ffffff" {...field} />
                            </FormControl>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="showFooterLogo"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Mostrar Logo</FormLabel>
                            <FormDescription>
                              Muestra el logo en el footer
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
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <FormField
                      control={form.control}
                      name="copyrightText"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Texto de Copyright</FormLabel>
                          <FormControl>
                            <Input placeholder="© 2025 Todos los derechos reservados" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="privacyPolicyUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>URL Aviso de Privacidad</FormLabel>
                          <FormControl>
                            <Input placeholder="/privacy" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="termsOfServiceUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>URL Términos de Servicio</FormLabel>
                          <FormControl>
                            <Input placeholder="/terms" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Imagen de Fondo del Footer</h3>
                    <div className="flex items-center gap-4">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            setFooterBgFile(e.target.files[0]);
                            handleFileUpload(e.target.files[0], "/api/frontend-config/upload-footer-image");
                          }
                        }}
                        className="hidden"
                        id="footer-bg-upload"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById('footer-bg-upload')?.click()}
                        className="flex items-center gap-2"
                      >
                        <ImageIcon className="h-4 w-4" />
                        Subir Imagen de Fondo
                      </Button>
                      {form.watch('footerBackgroundImage') && (
                        <span className="text-sm text-green-600">✓ Imagen de fondo cargada</span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Contact Configuration */}
            <TabsContent value="contact" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Phone className="h-5 w-5" />
                    Información de Contacto
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="companyName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nombre de la Empresa</FormLabel>
                          <FormControl>
                            <Input placeholder="ANPR México" {...field} />
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
                          <FormLabel>Teléfono de Contacto</FormLabel>
                          <FormControl>
                            <Input placeholder="+52 999 123 4567" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="contactEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email de Contacto</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="contacto@empresa.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="contactHours"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Horarios de Atención</FormLabel>
                          <FormControl>
                            <Input placeholder="Lun-Vie 9:00-18:00" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="contactAddress"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Dirección</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Calle Ejemplo #123, Colonia, Ciudad, Estado, CP"
                            className="min-h-[80px]"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Social Media Configuration */}
            <TabsContent value="social" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    Redes Sociales
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">Configuración de Redes Sociales</h3>
                    <Button type="button" onClick={addSocialMedia} className="flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      Agregar Red Social
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {socialMedia.map((item) => (
                      <div key={item.id} className="flex items-center gap-3 p-3 border rounded-lg">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => updateSocialMedia(item.id, { isVisible: !item.isVisible })}
                            className="text-gray-500 hover:text-gray-700"
                          >
                            {item.isVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                          </button>
                        </div>
                        
                        <Select
                          value={item.platform}
                          onValueChange={(value) => updateSocialMedia(item.id, { platform: value, icon: value.toLowerCase() })}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Facebook">Facebook</SelectItem>
                            <SelectItem value="Twitter">Twitter</SelectItem>
                            <SelectItem value="Instagram">Instagram</SelectItem>
                            <SelectItem value="YouTube">YouTube</SelectItem>
                            <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                            <SelectItem value="Spotify">Spotify</SelectItem>
                          </SelectContent>
                        </Select>
                        
                        <Input
                          value={item.url}
                          onChange={(e) => updateSocialMedia(item.id, { url: e.target.value })}
                          placeholder="https://..."
                          className="flex-1"
                        />
                        
                        <Input
                          type="number"
                          value={item.order}
                          onChange={(e) => updateSocialMedia(item.id, { order: parseInt(e.target.value) || 0 })}
                          placeholder="Orden"
                          className="w-20"
                        />
                        
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeSocialMedia(item.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Styles Configuration */}
            <TabsContent value="styles" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Palette className="h-5 w-5" />
                    Estilos Generales
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <FormField
                      control={form.control}
                      name="primaryColor"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Color Primario</FormLabel>
                          <div className="flex gap-2">
                            <FormControl>
                              <Input type="color" {...field} className="w-16 h-10" />
                            </FormControl>
                            <FormControl>
                              <Input placeholder="#3B82F6" {...field} />
                            </FormControl>
                          </div>
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
                          <div className="flex gap-2">
                            <FormControl>
                              <Input type="color" {...field} className="w-16 h-10" />
                            </FormControl>
                            <FormControl>
                              <Input placeholder="#10B981" {...field} />
                            </FormControl>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="accentColor"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Color de Acento</FormLabel>
                          <div className="flex gap-2">
                            <FormControl>
                              <Input type="color" {...field} className="w-16 h-10" />
                            </FormControl>
                            <FormControl>
                              <Input placeholder="#F59E0B" {...field} />
                            </FormControl>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="fontFamily"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Familia de Fuentes</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccionar fuente" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Inter">Inter</SelectItem>
                              <SelectItem value="Roboto">Roboto</SelectItem>
                              <SelectItem value="Open Sans">Open Sans</SelectItem>
                              <SelectItem value="Lato">Lato</SelectItem>
                              <SelectItem value="Poppins">Poppins</SelectItem>
                              <SelectItem value="Arial">Arial</SelectItem>
                              <SelectItem value="Helvetica">Helvetica</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="borderRadius"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Radio de Bordes</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccionar radio" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="0px">Sin redondeo (0px)</SelectItem>
                              <SelectItem value="4px">Ligero (4px)</SelectItem>
                              <SelectItem value="8px">Medio (8px)</SelectItem>
                              <SelectItem value="12px">Redondeado (12px)</SelectItem>
                              <SelectItem value="16px">Muy redondeado (16px)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">CSS Personalizado</h3>
                    <FormField
                      control={form.control}
                      name="customCss"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CSS Personalizado</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="/* Estilos CSS personalizados */"
                              className="min-h-[120px] font-mono text-sm"
                              {...field} 
                            />
                          </FormControl>
                          <FormDescription>
                            Agrega CSS personalizado que se aplicará a todo el sitio
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="customHead"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>HTML Personalizado (Head)</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="<meta>, <script>, <link> etc."
                              className="min-h-[120px] font-mono text-sm"
                              {...field} 
                            />
                          </FormControl>
                          <FormDescription>
                            Código HTML que se insertará en el &lt;head&gt; del documento
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end">
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
    </div>
  );
}