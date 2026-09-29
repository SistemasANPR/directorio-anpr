import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CompanyWithDetails } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, X, MapPin, Award, Tags, Camera } from "lucide-react";

// Schema completo para el formulario
const editCompanySchema = z.object({
  nombreEmpresa: z.string().min(1, "El nombre de la empresa es requerido"),
  telefono1: z.string().optional(),
  telefono2: z.string().optional(),
  email1: z.string().email("Email inválido").min(1, "El email es requerido"),
  email2: z.string().email("Email inválido").optional().or(z.literal("")),
  sitioWeb: z.string().url("URL inválida").optional().or(z.literal("")),
  descripcionEmpresa: z.string().optional(),
  direccionFisica: z.string().optional(),
  ubicacionPrincipal: z.string().optional(),
  catalogoDigitalUrl: z.string().url("URL inválida").optional().or(z.literal("")),
  // Redes sociales como strings individuales
  facebook: z.string().optional(),
  instagram: z.string().optional(),
  twitter: z.string().optional(),
  linkedin: z.string().optional(),
  youtube: z.string().optional(),
  whatsapp: z.string().optional(),
});

type EditCompanyFormData = z.infer<typeof editCompanySchema>;

interface EditCompanyModalSimpleProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company: CompanyWithDetails | null;
  userRole?: 'admin' | 'representante';
}

export default function EditCompanyModalSimple({ 
  open, 
  onOpenChange, 
  company, 
  userRole = 'admin' 
}: EditCompanyModalSimpleProps) {
  const { toast } = useToast();

  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [selectedCertificates, setSelectedCertificates] = useState<number[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [galeriaFiles, setGaleriaFiles] = useState<File[]>([]);
  const [galeriaPreviews, setGaleriaPreviews] = useState<string[]>([]);
  const [paisesPresencia, setPaisesPresencia] = useState<string[]>([]);
  const [estadosPresencia, setEstadosPresencia] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);

  // Fetch categories
  const { data: categoriesData } = useQuery({
    queryKey: ["/api/categories"],
    queryFn: () => apiRequest("GET", "/api/categories").then(res => res.json()),
  });

  // Fetch certificates
  const { data: certificatesData } = useQuery({
    queryKey: ["/api/certificates"],
    queryFn: () => apiRequest("GET", "/api/certificates", {
      headers: { 'X-User-Role': userRole }
    }).then(res => res.json()),
  });

  // Fetch tags
  const { data: tagsData } = useQuery({
    queryKey: ["/api/tags"],
    queryFn: () => apiRequest("GET", "/api/tags").then(res => res.json()),
  });

  useEffect(() => {
    if (categoriesData?.categories) {
      setCategories(categoriesData.categories);
    }
  }, [categoriesData]);

  useEffect(() => {
    if (certificatesData) {
      setCertificates(Array.isArray(certificatesData) ? certificatesData : certificatesData.certificates || []);
    }
  }, [certificatesData]);

  useEffect(() => {
    if (tagsData?.tags) {
      setTags(tagsData.tags);
    }
  }, [tagsData]);

  const form = useForm<EditCompanyFormData>({
    resolver: zodResolver(editCompanySchema),
    defaultValues: {
      nombreEmpresa: "",
      telefono1: "",
      telefono2: "",
      email1: "",
      email2: "",
      sitioWeb: "",
      descripcionEmpresa: "",
      direccionFisica: "",
      ubicacionPrincipal: "",
      catalogoDigitalUrl: "",
      facebook: "",
      instagram: "",
      twitter: "",
      linkedin: "",
      youtube: "",
      whatsapp: "",
    },
  });

  // Populate form when company data changes
  useEffect(() => {
    if (company) {
      // Extract social media from redesSociales object
      const redes = company.redesSociales as any || {};
      
      form.reset({
        nombreEmpresa: company.nombreEmpresa || "",
        telefono1: company.telefono1 || "",
        telefono2: company.telefono2 || "",
        email1: company.email1 || "",
        email2: company.email2 || "",
        sitioWeb: company.sitioWeb || "",
        descripcionEmpresa: company.descripcionEmpresa || "",
        direccionFisica: company.direccionFisica || "",
        ubicacionPrincipal: company.ubicacionPrincipal || "",
        catalogoDigitalUrl: company.catalogoDigitalUrl || "",
        facebook: redes.facebook || "",
        instagram: redes.instagram || "",
        twitter: redes.twitter || "",
        linkedin: redes.linkedin || "",
        youtube: redes.youtube || "",
        whatsapp: redes.whatsapp || "",
      });

      // Set selected categories
      if (company.categoriesIds) {
        setSelectedCategories(Array.isArray(company.categoriesIds) ? company.categoriesIds : []);
      }

      // Set selected certificates
      if (company.certificateIds) {
        setSelectedCertificates(Array.isArray(company.certificateIds) ? company.certificateIds : []);
      }

      // Set selected tags
      if (company.tagIds) {
        setSelectedTags(Array.isArray(company.tagIds) ? company.tagIds : []);
      }

      // Set gallery images
      if (company.galeriaProductosUrls) {
        const urls = Array.isArray(company.galeriaProductosUrls) ? company.galeriaProductosUrls : [];
        setGaleriaPreviews(urls);
      }

      // Set presence locations
      if (company.paisesPresencia) {
        setPaisesPresencia(Array.isArray(company.paisesPresencia) ? company.paisesPresencia : []);
      }
      if (company.estadosPresencia) {
        setEstadosPresencia(Array.isArray(company.estadosPresencia) ? company.estadosPresencia : []);
      }
    }
  }, [company, form]);

  // Image handling functions
  const handleGaleriaUpload = (files: FileList | null) => {
    if (!files) return;
    
    const newFiles = Array.from(files);
    setGaleriaFiles(prev => [...prev, ...newFiles]);
    
    newFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          setGaleriaPreviews(prev => [...prev, e.target.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeGaleriaImage = (index: number) => {
    setGaleriaFiles(prev => prev.filter((_, i) => i !== index));
    setGaleriaPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleGaleriaDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    handleGaleriaUpload(e.dataTransfer.files);
  };

  const updateCompanyMutation = useMutation({
    mutationFn: async (data: EditCompanyFormData) => {
      let galeriaUrls = galeriaPreviews;

      // Upload new images if any
      if (galeriaFiles.length > 0) {
        setUploadingImages(true);
        
        const formData = new FormData();
        galeriaFiles.forEach((file) => {
          formData.append('images', file);
        });

        try {
          const uploadResponse = await apiRequest("POST", "/api/upload/gallery", formData);
          const uploadResult = await uploadResponse.json();
          
          if (uploadResult.imageUrls) {
            galeriaUrls = [...galeriaPreviews.filter(url => !url.startsWith('data:')), ...uploadResult.imageUrls];
          }
        } catch (error) {
          console.error("Error uploading images:", error);
          throw error;
        } finally {
          setUploadingImages(false);
        }
      }

      // Prepare data for submission
      const submitData = {
        ...data,
        categoriesIds: selectedCategories,
        certificateIds: selectedCertificates,
        tagIds: selectedTags,
        paisesPresencia,
        estadosPresencia,
        galeriaProductosUrls: galeriaUrls,
        redesSociales: {
          facebook: data.facebook || "",
          instagram: data.instagram || "",
          twitter: data.twitter || "",
          linkedin: data.linkedin || "",
          youtube: data.youtube || "",
          whatsapp: data.whatsapp || "",
        }
      };

      const response = await apiRequest("PUT", `/api/companies/${company?.id}`, submitData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Empresa actualizada",
        description: "La información de la empresa ha sido actualizada exitosamente.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      queryClient.invalidateQueries({ queryKey: [`/api/representative/dashboard/${company?.userId}`] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error al actualizar",
        description: error.message || "Hubo un error al actualizar la empresa.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: EditCompanyFormData) => {
    updateCompanyMutation.mutate(data);
  };

  const toggleCategory = (categoryId: number) => {
    setSelectedCategories(prev => 
      prev.includes(categoryId) 
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const toggleCertificate = (certificateId: number) => {
    setSelectedCertificates(prev => 
      prev.includes(certificateId) 
        ? prev.filter(id => id !== certificateId)
        : [...prev, certificateId]
    );
  };

  const toggleTag = (tagId: number) => {
    setSelectedTags(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const addPais = (pais: string) => {
    if (pais.trim() && !paisesPresencia.includes(pais.trim())) {
      setPaisesPresencia(prev => [...prev, pais.trim()]);
    }
  };

  const removePais = (pais: string) => {
    setPaisesPresencia(prev => prev.filter(p => p !== pais));
  };

  const addEstado = (estado: string) => {
    if (estado.trim() && !estadosPresencia.includes(estado.trim())) {
      setEstadosPresencia(prev => [...prev, estado.trim()]);
    }
  };

  const removeEstado = (estado: string) => {
    setEstadosPresencia(prev => prev.filter(e => e !== estado));
  };

  if (!company) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            {userRole === 'admin' ? 'Editar Empresa' : 'Editar Mi Empresa'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="basic">Básico</TabsTrigger>
              <TabsTrigger value="contact">Contacto</TabsTrigger>
              <TabsTrigger value="location">Ubicación</TabsTrigger>
              <TabsTrigger value="multimedia">Multimedia</TabsTrigger>
              <TabsTrigger value="categories">Categorías</TabsTrigger>
              <TabsTrigger value="social">Redes</TabsTrigger>
            </TabsList>

            {/* Basic Information Tab */}
            <TabsContent value="basic" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Información Básica</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="nombreEmpresa">Nombre de la Empresa *</Label>
                      <Input
                        id="nombreEmpresa"
                        {...form.register("nombreEmpresa")}
                        disabled={updateCompanyMutation.isPending}
                      />
                      {form.formState.errors.nombreEmpresa && (
                        <p className="text-sm text-red-600 mt-1">
                          {form.formState.errors.nombreEmpresa.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="sitioWeb">Sitio Web</Label>
                      <Input
                        id="sitioWeb"
                        placeholder="https://ejemplo.com"
                        {...form.register("sitioWeb")}
                        disabled={updateCompanyMutation.isPending}
                      />
                      {form.formState.errors.sitioWeb && (
                        <p className="text-sm text-red-600 mt-1">
                          {form.formState.errors.sitioWeb.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="catalogoDigitalUrl">Catálogo Digital</Label>
                      <Input
                        id="catalogoDigitalUrl"
                        placeholder="https://ejemplo.com/catalogo.pdf"
                        {...form.register("catalogoDigitalUrl")}
                        disabled={updateCompanyMutation.isPending}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="descripcionEmpresa">Descripción de la Empresa</Label>
                    <Textarea
                      id="descripcionEmpresa"
                      rows={4}
                      placeholder="Describe tu empresa, servicios y especialidades..."
                      {...form.register("descripcionEmpresa")}
                      disabled={updateCompanyMutation.isPending}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Contact Information Tab */}
            <TabsContent value="contact" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Información de Contacto</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="email1">Email Principal *</Label>
                      <Input
                        id="email1"
                        type="email"
                        {...form.register("email1")}
                        disabled={updateCompanyMutation.isPending}
                      />
                      {form.formState.errors.email1 && (
                        <p className="text-sm text-red-600 mt-1">
                          {form.formState.errors.email1.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="email2">Email Secundario</Label>
                      <Input
                        id="email2"
                        type="email"
                        {...form.register("email2")}
                        disabled={updateCompanyMutation.isPending}
                      />
                    </div>

                    <div>
                      <Label htmlFor="telefono1">Teléfono Principal</Label>
                      <Input
                        id="telefono1"
                        {...form.register("telefono1")}
                        disabled={updateCompanyMutation.isPending}
                      />
                    </div>

                    <div>
                      <Label htmlFor="telefono2">Teléfono Secundario</Label>
                      <Input
                        id="telefono2"
                        {...form.register("telefono2")}
                        disabled={updateCompanyMutation.isPending}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="direccionFisica">Dirección Física</Label>
                    <Input
                      id="direccionFisica"
                      placeholder="Calle, número, colonia, ciudad, estado"
                      {...form.register("direccionFisica")}
                      disabled={updateCompanyMutation.isPending}
                    />
                  </div>

                  <div>
                    <Label htmlFor="ubicacionPrincipal">Ubicación Principal</Label>
                    <Input
                      id="ubicacionPrincipal"
                      placeholder="Ciudad principal de operaciones"
                      {...form.register("ubicacionPrincipal")}
                      disabled={updateCompanyMutation.isPending}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Location Tab */}
            <TabsContent value="location" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Información de Ubicación
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Países donde opera (separados por coma)</Label>
                      <Input
                        placeholder="México, Estados Unidos, Guatemala"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const value = (e.target as HTMLInputElement).value;
                            if (value.trim()) {
                              addPais(value);
                              (e.target as HTMLInputElement).value = '';
                            }
                          }
                        }}
                        disabled={updateCompanyMutation.isPending}
                      />
                      {paisesPresencia.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {paisesPresencia.map((pais, index) => (
                            <Badge key={index} variant="secondary" className="flex items-center gap-1">
                              {pais}
                              <X 
                                className="h-3 w-3 cursor-pointer" 
                                onClick={() => removePais(pais)}
                              />
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <Label>Estados/Provincias donde opera</Label>
                      <Input
                        placeholder="CDMX, Jalisco, Nuevo León"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const value = (e.target as HTMLInputElement).value;
                            if (value.trim()) {
                              addEstado(value);
                              (e.target as HTMLInputElement).value = '';
                            }
                          }
                        }}
                        disabled={updateCompanyMutation.isPending}
                      />
                      {estadosPresencia.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {estadosPresencia.map((estado, index) => (
                            <Badge key={index} variant="secondary" className="flex items-center gap-1">
                              {estado}
                              <X 
                                className="h-3 w-3 cursor-pointer" 
                                onClick={() => removeEstado(estado)}
                              />
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Multimedia Tab */}
            <TabsContent value="multimedia" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Camera className="h-5 w-5" />
                    Galería de Productos
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Current Images */}
                  {galeriaPreviews.length > 0 && (
                    <div>
                      <Label className="text-sm font-medium text-gray-500 mb-3 block">
                        Imágenes Actuales ({galeriaPreviews.length})
                      </Label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {galeriaPreviews.map((preview, index) => (
                          <div key={index} className="relative group">
                            <img
                              src={preview}
                              alt={`Galería ${index + 1}`}
                              className="w-full h-32 object-cover rounded-lg border border-gray-200"
                            />
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              className="absolute -top-2 -right-2 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => removeGaleriaImage(index)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Upload Area */}
                  <div
                    className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary transition-colors"
                    onDrop={handleGaleriaDrop}
                    onDragOver={(e) => e.preventDefault()}
                  >
                    <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600 mb-2">
                      Arrastra imágenes aquí o haz clic para seleccionar
                    </p>
                    <Input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={(e) => handleGaleriaUpload(e.target.files)}
                      className="hidden"
                      id="galeria-upload"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('galeria-upload')?.click()}
                      disabled={uploadingImages}
                    >
                      {uploadingImages ? "Subiendo..." : "Seleccionar Imágenes"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Tags Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Tags className="h-5 w-5" />
                    Etiquetas y Palabras Clave
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {tags.map((tag) => (
                      <div key={tag.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`tag-${tag.id}`}
                          checked={selectedTags.includes(tag.id)}
                          onCheckedChange={() => toggleTag(tag.id)}
                          disabled={updateCompanyMutation.isPending}
                        />
                        <Label
                          htmlFor={`tag-${tag.id}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          <Badge variant="outline" style={{ backgroundColor: tag.color + '20', borderColor: tag.color }}>
                            {tag.nombre}
                          </Badge>
                        </Label>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Certificates Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5" />
                    Certificados y Reconocimientos
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {certificates.map((certificate) => (
                      <div key={certificate.id} className="flex items-center space-x-2 p-3 border rounded-lg">
                        <Checkbox
                          id={`cert-${certificate.id}`}
                          checked={selectedCertificates.includes(certificate.id)}
                          onCheckedChange={() => toggleCertificate(certificate.id)}
                          disabled={updateCompanyMutation.isPending}
                        />
                        <div className="flex-1">
                          <Label
                            htmlFor={`cert-${certificate.id}`}
                            className="text-sm font-medium"
                          >
                            {certificate.nombreCertificado}
                          </Label>
                          {certificate.descripcion && (
                            <p className="text-xs text-gray-500">{certificate.descripcion}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Categories Tab */}
            <TabsContent value="categories" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Categorías de Servicios</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {categories.map((category) => (
                      <div key={category.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`category-${category.id}`}
                          checked={selectedCategories.includes(category.id)}
                          onCheckedChange={() => toggleCategory(category.id)}
                          disabled={updateCompanyMutation.isPending}
                        />
                        <Label
                          htmlFor={`category-${category.id}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {category.nombreCategoria}
                        </Label>
                      </div>
                    ))}
                  </div>
                  {selectedCategories.length > 0 && (
                    <div className="mt-4">
                      <Label className="text-sm font-medium">Categorías Seleccionadas:</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {selectedCategories.map((categoryId) => {
                          const category = categories.find(c => c.id === categoryId);
                          return category ? (
                            <Badge key={categoryId} variant="secondary">
                              {category.nombreCategoria}
                            </Badge>
                          ) : null;
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Social Media Tab */}
            <TabsContent value="social" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Redes Sociales</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="facebook">Facebook</Label>
                      <Input
                        id="facebook"
                        placeholder="https://facebook.com/tuempresa"
                        {...form.register("facebook")}
                        disabled={updateCompanyMutation.isPending}
                      />
                    </div>

                    <div>
                      <Label htmlFor="instagram">Instagram</Label>
                      <Input
                        id="instagram"
                        placeholder="https://instagram.com/tuempresa"
                        {...form.register("instagram")}
                        disabled={updateCompanyMutation.isPending}
                      />
                    </div>

                    <div>
                      <Label htmlFor="twitter">X (Twitter)</Label>
                      <Input
                        id="twitter"
                        placeholder="https://x.com/tuempresa"
                        {...form.register("twitter")}
                        disabled={updateCompanyMutation.isPending}
                      />
                    </div>

                    <div>
                      <Label htmlFor="linkedin">LinkedIn</Label>
                      <Input
                        id="linkedin"
                        placeholder="https://linkedin.com/company/tuempresa"
                        {...form.register("linkedin")}
                        disabled={updateCompanyMutation.isPending}
                      />
                    </div>

                    <div>
                      <Label htmlFor="youtube">YouTube</Label>
                      <Input
                        id="youtube"
                        placeholder="https://youtube.com/tuempresa"
                        {...form.register("youtube")}
                        disabled={updateCompanyMutation.isPending}
                      />
                    </div>

                    <div>
                      <Label htmlFor="whatsapp">WhatsApp</Label>
                      <Input
                        id="whatsapp"
                        placeholder="+52 55 1234 5678"
                        {...form.register("whatsapp")}
                        disabled={updateCompanyMutation.isPending}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Form Actions */}
          <div className="flex justify-end space-x-4 pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={updateCompanyMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-[#bcce16] hover:bg-[#a8b814] text-black"
              disabled={updateCompanyMutation.isPending}
            >
              {updateCompanyMutation.isPending ? "Actualizando..." : "Actualizar Empresa"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}