import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { 
  Building, 
  Save, 
  Edit, 
  X, 
  Upload, 
  Trash2, 
  MapPin, 
  Globe, 
  Phone, 
  Mail, 
  Tag, 
  Image as ImageIcon,
  Plus,
  Facebook,
  Instagram,
  Linkedin,
  Twitter,
  Youtube,
  Users,
  FileText,
  Camera
} from "lucide-react";
import type { CompanyWithDetails, Category } from "@shared/schema";

const companySchema = z.object({
  nombreEmpresa: z.string().min(1, "El nombre de la empresa es requerido"),
  telefono1: z.string().min(1, "El teléfono principal es requerido"),
  telefono2: z.string().optional(),
  email1: z.string().email("Email inválido").min(1, "El email principal es requerido"),
  email2: z.string().email("Email inválido").optional().or(z.literal("")),
  sitioWeb: z.string().url("URL inválida").optional().or(z.literal("")),
  direccionFisica: z.string().min(1, "La dirección física es requerida"),
  descripcionEmpresa: z.string().min(10, "La descripción debe tener al menos 10 caracteres"),
  catalogoDigitalUrl: z.string().url("URL inválida").optional().or(z.literal("")),
  categoriesIds: z.array(z.number()).optional(),
  paisesPresencia: z.array(z.string()).optional(),
  estadosPresencia: z.array(z.string()).optional(),
  ciudadesPresencia: z.array(z.string()).optional(),
  ubicacionPrincipal: z.string().optional(),
  representantesVentas: z.array(z.string()).optional(),
});

type CompanyFormData = z.infer<typeof companySchema>;

interface RepresentativeCompanyManagementProps {
  company: CompanyWithDetails;
}

// Países de América Latina
const PAISES_LATINOAMERICA = [
  "México", "Argentina", "Brasil", "Chile", "Colombia", "Perú", 
  "Venezuela", "Ecuador", "Bolivia", "Paraguay", "Uruguay", 
  "Costa Rica", "Panamá", "Guatemala", "Honduras", "El Salvador",
  "Nicaragua", "Cuba", "República Dominicana", "Puerto Rico"
];

// Estados de México
const ESTADOS_MEXICO = [
  "Aguascalientes", "Baja California", "Baja California Sur", "Campeche", 
  "Chiapas", "Chihuahua", "Coahuila", "Colima", "Durango", "Estado de México",
  "Guanajuato", "Guerrero", "Hidalgo", "Jalisco", "Michoacán", "Morelos",
  "Nayarit", "Nuevo León", "Oaxaca", "Puebla", "Querétaro", "Quintana Roo",
  "San Luis Potosí", "Sinaloa", "Sonora", "Tabasco", "Tamaulipas", "Tlaxcala",
  "Veracruz", "Yucatán", "Zacatecas", "Ciudad de México"
];

// Plataformas de redes sociales
const SOCIAL_PLATFORMS = [
  { name: "Facebook", icon: Facebook },
  { name: "Instagram", icon: Instagram },
  { name: "LinkedIn", icon: Linkedin },
  { name: "Twitter", icon: Twitter },
  { name: "YouTube", icon: Youtube },
  { name: "Sitio Web", icon: Globe },
];

export default function RepresentativeCompanyManagement({ company }: RepresentativeCompanyManagementProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [selectedPaises, setSelectedPaises] = useState<string[]>([]);
  const [selectedEstados, setSelectedEstados] = useState<string[]>([]);
  const [selectedCiudades, setSelectedCiudades] = useState<string[]>([]);
  const [representantes, setRepresentantes] = useState<string[]>([]);
  const [redesSociales, setRedesSociales] = useState<Array<{plataforma: string, url: string}>>([]);
  const [galeriaFiles, setGaleriaFiles] = useState<File[]>([]);
  const [galeriaPreviews, setGaleriaPreviews] = useState<string[]>([]);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>("");
  const [videosUrls, setVideosUrls] = useState<string[]>([]);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<CompanyFormData>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      nombreEmpresa: company.nombreEmpresa || "",
      telefono1: company.telefono1 || "",
      telefono2: company.telefono2 || "",
      email1: company.email1 || "",
      email2: company.email2 || "",
      sitioWeb: company.sitioWeb || "",
      direccionFisica: company.direccionFisica || "",
      descripcionEmpresa: company.descripcionEmpresa || "",
      catalogoDigitalUrl: company.catalogoDigitalUrl || "",
      categoriesIds: (company.categoriesIds as number[]) || [],
      paisesPresencia: (company.paisesPresencia as string[]) || [],
      estadosPresencia: (company.estadosPresencia as string[]) || [],
      ciudadesPresencia: (company.ciudadesPresencia as string[]) || [],
      ubicacionPrincipal: company.ubicacionPrincipal || "",
      representantesVentas: (company.representantesVentas as string[]) || [],
    },
  });

  // Load categories
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  // Initialize state when editing starts
  useEffect(() => {
    if (isEditing && company) {
      setSelectedCategories((company.categoriesIds as number[]) || []);
      setSelectedPaises((company.paisesPresencia as string[]) || []);
      setSelectedEstados((company.estadosPresencia as string[]) || []);
      setSelectedCiudades((company.ciudadesPresencia as string[]) || []);
      setRepresentantes((company.representantesVentas as string[]) || []);
      setRedesSociales((company.redesSociales as Array<{plataforma: string, url: string}>) || []);
      setGaleriaPreviews((company.galeriaProductosUrls as string[]) || []);
      setLogoPreview(company.logotipoUrl || "");
      setVideosUrls((company.videosUrls as string[]) || []);
    }
  }, [isEditing, company]);

  const updateCompanyMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("PUT", `/api/companies/${company.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      queryClient.invalidateQueries({ queryKey: [`/api/companies/${company.id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/representative/dashboard"] });
      toast({
        title: "Empresa actualizada",
        description: "La información de la empresa ha sido actualizada exitosamente",
      });
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error al actualizar empresa",
        description: error.message || "Ocurrió un error inesperado",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: CompanyFormData) => {
    try {
      const formData = new FormData();
      
      // Agregar todos los campos del formulario
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            formData.append(key, JSON.stringify(value));
          } else {
            formData.append(key, value.toString());
          }
        }
      });

      // Agregar arrays adicionales
      formData.append('categoriesIds', JSON.stringify(selectedCategories));
      formData.append('paisesPresencia', JSON.stringify(selectedPaises));
      formData.append('estadosPresencia', JSON.stringify(selectedEstados));
      formData.append('ciudadesPresencia', JSON.stringify(selectedCiudades));
      formData.append('representantesVentas', JSON.stringify(representantes));
      formData.append('redesSociales', JSON.stringify(redesSociales));
      formData.append('videosUrls', JSON.stringify(videosUrls));

      // Agregar logo si existe
      if (logoFile) {
        formData.append('logotipo', logoFile);
      }

      // Agregar galería si existe
      galeriaFiles.forEach((file, index) => {
        formData.append(`galeria_${index}`, file);
      });

      await updateCompanyMutation.mutateAsync(formData);
    } catch (error) {
      console.error("Error al actualizar empresa:", error);
    }
  };

  const handleCancel = () => {
    form.reset();
    setIsEditing(false);
    setSelectedCategories((company.categoriesIds as number[]) || []);
    setSelectedPaises((company.paisesPresencia as string[]) || []);
    setSelectedEstados((company.estadosPresencia as string[]) || []);
    setSelectedCiudades((company.ciudadesPresencia as string[]) || []);
    setRepresentantes((company.representantesVentas as string[]) || []);
    setRedesSociales((company.redesSociales as Array<{plataforma: string, url: string}>) || []);
    setGaleriaFiles([]);
    setGaleriaPreviews((company.galeriaProductosUrls as string[]) || []);
    setLogoFile(null);
    setLogoPreview(company.logotipoUrl || "");
    setVideosUrls((company.videosUrls as string[]) || []);
  };

  // Category selection handlers
  const handleCategoryChange = (categoryId: number, checked: boolean) => {
    if (checked) {
      setSelectedCategories([...selectedCategories, categoryId]);
    } else {
      setSelectedCategories(selectedCategories.filter(id => id !== categoryId));
    }
  };

  // File upload handlers
  const validateImage = (file: File): boolean => {
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "La imagen supera el tamaño máximo permitido de 2 MB. Selecciona una imagen más ligera.",
        variant: "destructive",
      });
      return false;
    }

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Error",
        description: "Solo se permiten archivos de imagen",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && validateImage(file)) {
      setLogoFile(file);
      const url = URL.createObjectURL(file);
      setLogoPreview(url);
    }
  };

  const handleGaleriaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    if (galeriaFiles.length + files.length > 10) {
      toast({
        title: "Error",
        description: "Solo se permiten máximo 10 imágenes en la galería",
        variant: "destructive",
      });
      return;
    }

    const validFiles = files.filter(validateImage);
    
    if (validFiles.length > 0) {
      setGaleriaFiles([...galeriaFiles, ...validFiles]);
      const newPreviews = validFiles.map(file => URL.createObjectURL(file));
      setGaleriaPreviews([...galeriaPreviews, ...newPreviews]);
    }
  };

  const removeGaleriaImage = (index: number) => {
    const newFiles = galeriaFiles.filter((_, i) => i !== index);
    const newPreviews = galeriaPreviews.filter((_, i) => i !== index);
    setGaleriaFiles(newFiles);
    setGaleriaPreviews(newPreviews);
  };

  // Social media handlers
  const addRedSocial = () => {
    setRedesSociales([...redesSociales, { plataforma: "", url: "" }]);
  };

  const removeRedSocial = (index: number) => {
    setRedesSociales(redesSociales.filter((_, i) => i !== index));
  };

  const updateRedSocial = (index: number, field: 'plataforma' | 'url', value: string) => {
    const newRedes = [...redesSociales];
    newRedes[index][field] = value;
    setRedesSociales(newRedes);
  };

  // Representatives handlers
  const addRepresentante = () => {
    if (representantes.length < 3) {
      setRepresentantes([...representantes, ""]);
    }
  };

  const removeRepresentante = (index: number) => {
    setRepresentantes(representantes.filter((_, i) => i !== index));
  };

  const updateRepresentante = (index: number, value: string) => {
    const newRepresentantes = [...representantes];
    newRepresentantes[index] = value;
    setRepresentantes(newRepresentantes);
  };

  // Videos handlers
  const addVideo = () => {
    setVideosUrls([...videosUrls, ""]);
  };

  const removeVideo = (index: number) => {
    setVideosUrls(videosUrls.filter((_, i) => i !== index));
  };

  const updateVideo = (index: number, value: string) => {
    const newVideos = [...videosUrls];
    newVideos[index] = value;
    setVideosUrls(newVideos);
  };

  if (!isEditing) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Información Completa de la Empresa
            </CardTitle>
            <Button
              variant="outline"
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-2"
            >
              <Edit className="h-4 w-4" />
              Editar
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Información básica */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-sm font-medium text-gray-600">Nombre de la Empresa</label>
                <p className="text-sm font-semibold text-gray-900 mt-1">{company.nombreEmpresa}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Teléfono Principal</label>
                <p className="text-sm text-gray-900 mt-1">{company.telefono1}</p>
              </div>
              {company.telefono2 && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Teléfono Secundario</label>
                  <p className="text-sm text-gray-900 mt-1">{company.telefono2}</p>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-gray-600">Email Principal</label>
                <p className="text-sm text-gray-900 mt-1">{company.email1}</p>
              </div>
              {company.email2 && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Email Secundario</label>
                  <p className="text-sm text-gray-900 mt-1">{company.email2}</p>
                </div>
              )}
              {company.sitioWeb && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Sitio Web</label>
                  <p className="text-sm text-gray-900 mt-1">
                    <a href={company.sitioWeb} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      {company.sitioWeb}
                    </a>
                  </p>
                </div>
              )}
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-600">Dirección Física</label>
              <p className="text-sm text-gray-900 mt-1">{company.direccionFisica}</p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-600">Descripción de la Empresa</label>
              <p className="text-sm text-gray-900 mt-1">{company.descripcionEmpresa}</p>
            </div>

            {/* Categorías */}
            {company.categories && company.categories.length > 0 && (
              <div>
                <label className="text-sm font-medium text-gray-600">Categorías</label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {company.categories.map((category: any) => (
                    <Badge key={category.id} variant="secondary">
                      {category.nombreCategoria}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Logo */}
            {company.logotipoUrl && (
              <div>
                <label className="text-sm font-medium text-gray-600">Logotipo</label>
                <div className="mt-2">
                  <img 
                    src={company.logotipoUrl} 
                    alt="Logo de la empresa" 
                    className="w-32 h-32 object-contain border rounded-lg"
                  />
                </div>
              </div>
            )}

            {/* Galería */}
            {company.galeriaProductosUrls && (company.galeriaProductosUrls as string[]).length > 0 && (
              <div>
                <label className="text-sm font-medium text-gray-600">Galería de Productos</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                  {(company.galeriaProductosUrls as string[]).map((url, index) => (
                    <img 
                      key={index}
                      src={url} 
                      alt={`Producto ${index + 1}`} 
                      className="w-full h-24 object-cover border rounded-lg"
                    />
                  ))}
                </div>
              </div>
            )}
            
            {company.catalogoDigitalUrl && (
              <div>
                <label className="text-sm font-medium text-gray-600">Catálogo Digital</label>
                <p className="text-sm text-gray-900 mt-1">
                  <a href={company.catalogoDigitalUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    {company.catalogoDigitalUrl}
                  </a>
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building className="h-5 w-5" />
          Editar Información Completa de la Empresa
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Información básica */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Building className="h-5 w-5" />
                Información Básica
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="nombreEmpresa"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre de la Empresa *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Nombre de la empresa" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="telefono1"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Teléfono Principal *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="+52 777 123 4567" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="telefono2"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Teléfono Secundario</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="+52 777 987 6543" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="email1"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Principal *</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} placeholder="contacto@empresa.com" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="email2"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Secundario</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} placeholder="ventas@empresa.com" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="sitioWeb"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sitio Web</FormLabel>
                      <FormControl>
                        <Input type="url" {...field} placeholder="https://www.empresa.com" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="direccionFisica"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dirección Física *</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Dirección completa de la empresa" rows={3} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="descripcionEmpresa"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descripción de la Empresa *</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Descripción detallada de la empresa, servicios y productos" rows={4} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="catalogoDigitalUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Catálogo Digital</FormLabel>
                    <FormControl>
                      <Input type="url" {...field} placeholder="https://catalogo.empresa.com" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Categorías */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Tag className="h-5 w-5" />
                Categorías
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {categories.map((category) => (
                  <div key={category.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`category-${category.id}`}
                      checked={selectedCategories.includes(category.id)}
                      onCheckedChange={(checked) => handleCategoryChange(category.id, !!checked)}
                    />
                    <label
                      htmlFor={`category-${category.id}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {category.nombreCategoria}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Logo */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                Logotipo
              </h3>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                {logoPreview ? (
                  <div className="space-y-4">
                    <img 
                      src={logoPreview} 
                      alt="Logo preview" 
                      className="w-32 h-32 object-contain mx-auto border rounded-lg"
                    />
                    <div className="flex justify-center">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setLogoFile(null);
                          setLogoPreview("");
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Eliminar Logo
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center">
                    <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-sm text-gray-600 mb-4">
                      Arrastra y suelta tu logo aquí, o haz clic para seleccionar
                    </p>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoSelect}
                      className="hidden"
                      id="logo-upload"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('logo-upload')?.click()}
                    >
                      Seleccionar Logo
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Galería */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Galería de Productos (Máximo 10 imágenes)
              </h3>
              <div className="space-y-4">
                {galeriaPreviews.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {galeriaPreviews.map((preview, index) => (
                      <div key={index} className="relative">
                        <img 
                          src={preview} 
                          alt={`Producto ${index + 1}`} 
                          className="w-full h-24 object-cover border rounded-lg"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="absolute top-1 right-1 p-1 h-6 w-6"
                          onClick={() => removeGaleriaImage(index)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                
                {galeriaPreviews.length < 10 && (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                    <div className="text-center">
                      <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-sm text-gray-600 mb-4">
                        Arrastra y suelta imágenes aquí, o haz clic para seleccionar
                      </p>
                      <Input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleGaleriaSelect}
                        className="hidden"
                        id="galeria-upload"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById('galeria-upload')?.click()}
                      >
                        Agregar Imágenes
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Redes Sociales */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Redes Sociales
              </h3>
              <div className="space-y-3">
                {redesSociales.map((red, index) => (
                  <div key={index} className="flex gap-3 items-center">
                    <Select
                      value={red.plataforma}
                      onValueChange={(value) => updateRedSocial(index, 'plataforma', value)}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Plataforma" />
                      </SelectTrigger>
                      <SelectContent>
                        {SOCIAL_PLATFORMS.map((platform) => (
                          <SelectItem key={platform.name} value={platform.name}>
                            {platform.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="URL de la red social"
                      value={red.url}
                      onChange={(e) => updateRedSocial(index, 'url', e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeRedSocial(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={addRedSocial}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Red Social
                </Button>
              </div>
            </div>

            {/* Representantes de Ventas */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Users className="h-5 w-5" />
                Representantes de Ventas (Máximo 3)
              </h3>
              <div className="space-y-3">
                {representantes.map((rep, index) => (
                  <div key={index} className="flex gap-3 items-center">
                    <Input
                      placeholder="Nombre del representante"
                      value={rep}
                      onChange={(e) => updateRepresentante(index, e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeRepresentante(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {representantes.length < 3 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addRepresentante}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar Representante
                  </Button>
                )}
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                className="flex items-center gap-2"
              >
                <X className="h-4 w-4" />
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={updateCompanyMutation.isPending}
                className="bg-[#bcce16] hover:bg-[#a8b814] text-black flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                {updateCompanyMutation.isPending ? "Guardando..." : "Guardar Cambios"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}