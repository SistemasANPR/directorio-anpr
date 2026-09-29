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
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Building, 
  Edit, 
  Save, 
  X, 
  Upload, 
  Globe, 
  Phone, 
  Mail, 
  MapPin,
  Camera,
  FileText,
  Tag,
  Award,
  Briefcase,
  Search,
  User,
  Check,
  ExternalLink
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import DynamicSocialMedia from "@/components/DynamicSocialMedia";

const companyUpdateSchema = z.object({
  nombreEmpresa: z.string().min(1, "El nombre de la empresa es requerido"),
  email1: z.string().email("Email inválido"),
  email2: z.string().email("Email inválido").optional().or(z.literal("")),
  telefono1: z.string().min(1, "El teléfono principal es requerido"),
  telefono2: z.string().optional(),
  sitioWeb: z.string().url("URL inválida").optional().or(z.literal("")),
  direccionFisica: z.string().min(1, "La dirección es requerida"),
  descripcionEmpresa: z.string().min(10, "La descripción debe tener al menos 10 caracteres"),
  paisesPresencia: z.array(z.string()).optional(),
  estadosPresencia: z.array(z.string()).optional(),
  ciudadesPresencia: z.array(z.string()).optional(),
  ubicacionPrincipal: z.string().optional(),
  representantesVentas: z.array(z.string()).optional(),
  catalogoDigitalUrl: z.string().url("URL inválida").optional().or(z.literal("")),
  redesSociales: z.record(z.string()).optional(),
  // Campo para vincular usuario de WordPress
  userId: z.number().optional().nullable(),
});

type CompanyUpdateData = z.infer<typeof companyUpdateSchema>;

interface CompanyManagementProps {
  companyId: number;
}

export default function CompanyManagement({ companyId }: CompanyManagementProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  // Estados para buscador de WordPress
  const [wordPressUserSearch, setWordPressUserSearch] = useState("");
  const [selectedWordPressUser, setSelectedWordPressUser] = useState<any>(null);
  const [isLoadingWordPressUsers, setIsLoadingWordPressUsers] = useState(false);
  const [wordPressUsers, setWordPressUsers] = useState<any[]>([]);
  const [userTransactions, setUserTransactions] = useState<any[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const { toast } = useToast();

  // Fetch company data
  const { data: company, isLoading } = useQuery({
    queryKey: ["/api/companies", companyId],
    queryFn: async () => {
      const response = await fetch(`/api/companies/${companyId}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch company");
      return response.json();
    },
  });

  // Fetch categories for selection
  const { data: categories = [] } = useQuery({
    queryKey: ["/api/categories"],
    queryFn: async () => {
      const response = await fetch("/api/categories", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch categories");
      return response.json();
    },
  });

  // Fetch certificates for selection
  const { data: certificates = [] } = useQuery({
    queryKey: ["/api/certificates"],
    queryFn: async () => {
      const response = await fetch("/api/certificates", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch certificates");
      return response.json();
    },
  });


  const form = useForm<CompanyUpdateData>({
    resolver: zodResolver(companyUpdateSchema),
    defaultValues: {
      nombreEmpresa: "",
      email1: "",
      email2: "",
      telefono1: "",
      telefono2: "",
      sitioWeb: "",
      direccionFisica: "",
      descripcionEmpresa: "",
      catalogoDigitalUrl: "",
      redesSociales: {
        facebook: "",
        twitter: "",
        instagram: "",
        linkedin: "",
        youtube: "",
        whatsapp: "",
      },
      userId: null,
    },
  });

  // Reset form when company data loads
  useEffect(() => {
    if (company) {
      form.reset({
        nombreEmpresa: company.nombreEmpresa || "",
        email1: company.email1 || "",
        email2: company.email2 || "",
        telefono1: company.telefono1 || "",
        telefono2: company.telefono2 || "",
        sitioWeb: company.sitioWeb || "",
        direccionFisica: company.direccionFisica || "",
        descripcionEmpresa: company.descripcionEmpresa || "",
        catalogoDigitalUrl: company.catalogoDigitalUrl || "",
        redesSociales: company.redesSociales || {
          facebook: "",
          twitter: "",
          instagram: "",
          linkedin: "",
          youtube: "",
          whatsapp: "",
        },
        userId: company.userId || null,
      });
      
      // Si la empresa ya tiene un usuario vinculado, establecer el selectedWordPressUser
      if (company.user) {
        setSelectedWordPressUser(company.user);
      }
    }
  }, [company, form]);

  // Función para cargar transacciones de un usuario
  const loadUserTransactions = async (userId: string) => {
    setIsLoadingTransactions(true);
    try {
      const response = await fetch(`/api/wordpress-user-transactions/${userId}`);
      if (response.ok) {
        const data = await response.json();
        setUserTransactions(data.transactions || []);
        
        toast({
          title: "Transacciones cargadas",
          description: `Se encontraron ${data.transactions.length} transacciones del usuario`,
        });
      } else {
        setUserTransactions([]);
      }
    } catch (error) {
      console.error('Error loading user transactions:', error);
      setUserTransactions([]);
    } finally {
      setIsLoadingTransactions(false);
    }
  };

  // Función para buscar usuarios de WordPress
  useEffect(() => {
    if (wordPressUserSearch.length >= 3) {
      setIsLoadingWordPressUsers(true);
      
      fetch('/api/wordpress-users')
        .then(response => response.json())
        .then(data => {
          const searchLower = wordPressUserSearch.toLowerCase();
          const filteredUsers = data.users.filter((user: any) => 
            (user.name && user.name.toLowerCase().includes(searchLower)) ||
            (user.email && user.email.toLowerCase().includes(searchLower)) ||
            (user.username && user.username.toLowerCase().includes(searchLower)) ||
            (user.first_name && user.first_name.toLowerCase().includes(searchLower)) ||
            (user.last_name && user.last_name.toLowerCase().includes(searchLower))
          );
          setWordPressUsers(filteredUsers);
          setIsLoadingWordPressUsers(false);
        })
        .catch(error => {
          console.error('Error fetching WordPress users:', error);
          setWordPressUsers([]);
          setIsLoadingWordPressUsers(false);
        });
    } else {
      setWordPressUsers([]);
      setIsLoadingWordPressUsers(false);
    }
  }, [wordPressUserSearch]);

  // Update company mutation
  const updateCompanyMutation = useMutation({
    mutationFn: async (data: CompanyUpdateData) => {
      const response = await apiRequest("PUT", `/api/companies/${companyId}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Empresa actualizada",
        description: "La información de tu empresa se ha actualizado correctamente",
      });
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ["/api/companies", companyId] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al actualizar la empresa",
        variant: "destructive",
      });
    },
  });

  // Upload images mutation
  const uploadImagesMutation = useMutation({
    mutationFn: async (files: FileList) => {
      const formData = new FormData();
      Array.from(files).forEach(file => {
        formData.append('galeriaImagenes', file);
      });

      const response = await fetch(`/api/companies/${companyId}/images`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) throw new Error("Error al subir imágenes");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Imágenes subidas",
        description: "Las imágenes se han subido correctamente",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/companies", companyId] });
      setUploadingImages(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al subir imágenes",
        variant: "destructive",
      });
      setUploadingImages(false);
    },
  });

  const onSubmit = (data: CompanyUpdateData) => {
    updateCompanyMutation.mutate(data);
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      setUploadingImages(true);
      uploadImagesMutation.mutate(files);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#bcce16]"></div>
      </div>
    );
  }

  if (!company) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No se encontró información de la empresa</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Company Overview Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-6 w-6" />
              {company.nombreEmpresa}
            </CardTitle>
            <p className="text-gray-600 mt-1">Información general de tu empresa</p>
          </div>
          <Button
            onClick={() => setIsEditing(!isEditing)}
            variant={isEditing ? "outline" : "default"}
            className={isEditing ? "" : "bg-[#bcce16] hover:bg-[#a8b814] text-black"}
          >
            {isEditing ? (
              <>
                <X className="h-4 w-4 mr-2" />
                Cancelar
              </>
            ) : (
              <>
                <Edit className="h-4 w-4 mr-2" />
                Editar
              </>
            )}
          </Button>
        </CardHeader>
        <CardContent>
          {!isEditing ? (
            /* View Mode */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-gray-500">Información de Contacto</Label>
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-gray-400" />
                      <span>{company.email1}</span>
                    </div>
                    {company.email2 && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-gray-400" />
                        <span>{company.email2}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-gray-400" />
                      <span>{company.telefono1}</span>
                    </div>
                    {company.telefono2 && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <span>{company.telefono2}</span>
                      </div>
                    )}
                    {company.sitioWeb && (
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-gray-400" />
                        <a href={company.sitioWeb} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          {company.sitioWeb}
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-500">Ubicación</Label>
                  <div className="mt-2">
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-gray-400 mt-1" />
                      <span className="text-sm">{company.direccionFisica}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-gray-500">Descripción</Label>
                  <p className="mt-2 text-sm text-gray-700">{company.descripcionEmpresa}</p>
                </div>

                {company.catalogoDigitalUrl && (
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Catálogo Digital</Label>
                    <div className="mt-2">
                      <a 
                        href={company.catalogoDigitalUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-blue-600 hover:underline"
                      >
                        <FileText className="h-4 w-4" />
                        Ver catálogo
                      </a>
                    </div>
                  </div>
                )}

                {/* Categories */}
                {company.categories && company.categories.length > 0 && (
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Categorías</Label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {company.categories.map((category: any) => (
                        <Badge key={category.id} variant="secondary">
                          <Tag className="h-3 w-3 mr-1" />
                          {category.nombreCategoria}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Certificates */}
                {company.certificates && company.certificates.length > 0 && (
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Certificados</Label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {company.certificates.map((certificate: any) => (
                        <Badge key={certificate.id} variant="secondary">
                          <Award className="h-3 w-3 mr-1" />
                          {certificate.nombreCertificado}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Edit Mode */
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Sección: Información de Contacto */}
                <div className="space-y-6">
                  <div className="border-b pb-4">
                    <h3 className="text-lg font-semibold text-primary">Información de Contacto</h3>
                    <p className="text-sm text-gray-600">Datos de contacto y representantes</p>
                  </div>

                  {/* BUSCADOR DE WORDPRESS - UBICADO EN INFORMACIÓN DE CONTACTO */}
                  <div className="bg-blue-100 p-4 rounded-lg border-2 border-blue-300 shadow-md">
                    <div className="flex items-center gap-2 mb-3">
                      <ExternalLink className="h-5 w-5 text-blue-600" />
                      <h4 className="font-bold text-blue-800">🔗 Vincular Usuario de WordPress</h4>
                    </div>
                    <p className="text-blue-700 mb-4 text-sm">
                      Busca y selecciona un usuario existente de WordPress para asociar con esta empresa. Los datos se llenarán automáticamente.
                    </p>
                    
                    <div className="space-y-3">
                      {/* Campo de búsqueda */}
                      <div className="relative">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                        <Input
                          placeholder="Buscar usuario por nombre, email o usuario... (mín. 3 caracteres)"
                          value={wordPressUserSearch}
                          onChange={(e) => setWordPressUserSearch(e.target.value)}
                          className="pl-10 border-2 border-blue-200 focus:border-blue-500 bg-white"
                        />
                      </div>

                      {/* Resultados de búsqueda */}
                      {wordPressUserSearch.length >= 3 && (
                        <div className="border-2 border-blue-200 rounded-lg bg-white max-h-48 overflow-y-auto shadow-lg">
                          {isLoadingWordPressUsers ? (
                            <div className="p-3 text-center text-gray-600">
                              <div className="flex items-center justify-center gap-2">
                                <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                                <span>Buscando usuarios...</span>
                              </div>
                            </div>
                          ) : wordPressUsers.length > 0 ? (
                            <div className="space-y-0">
                              {wordPressUsers.map((user: any) => (
                                <div
                                  key={user.id}
                                  className="p-3 hover:bg-blue-50 cursor-pointer flex items-center gap-3 transition-colors"
                                  onClick={() => {
                                    setSelectedWordPressUser(user);
                                    setWordPressUserSearch("");
                                    
                                    // Auto-llenar campos disponibles en formulario de edición (proteger sobrescritura)
                                    if (user.email && !form.getValues("email1")) {
                                      form.setValue("email1", user.email);
                                    }
                                    
                                    // Auto-llenar otros campos si el usuario tiene datos
                                    if (user.first_name || user.last_name) {
                                      const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ');
                                      if (fullName && !form.getValues("descripcionEmpresa")) {
                                        form.setValue("descripcionEmpresa", `Representante: ${fullName}`);
                                      }
                                    }
                                    
                                    // Establecer la vinculación del usuario
                                    form.setValue("userId", user.id);
                                    
                                    // Cargar transacciones del usuario seleccionado
                                    if (user.id) {
                                      loadUserTransactions(user.id.toString());
                                    }
                                    
                                    toast({
                                      title: "Usuario vinculado exitosamente",
                                      description: `Se vinculó el usuario ${user.name || user.username} y se auto-llenaron los campos disponibles`,
                                    });
                                  }}
                                >
                                  <User className="h-5 w-5 text-blue-600 flex-shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium text-gray-900 truncate">
                                      {user.name || user.username}
                                    </div>
                                    <div className="text-sm text-gray-600 truncate">
                                      📧 {user.email}
                                      {user.roles && user.roles.length > 0 && (
                                        <span className="ml-2 text-blue-600">• {user.roles.join(", ")}</span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        // URL del perfil de PeepSo: /profile-2/?username/
                                        window.open(`https://anpr.org.mx/profile-2/?${user.username}/`, '_blank');
                                      }}
                                      className="text-blue-600 hover:text-blue-700 border-blue-300"
                                    >
                                      <ExternalLink className="h-3 w-3 mr-1" />
                                      Ver Perfil
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="p-3 text-center text-gray-600">
                              <User className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                              <p>No se encontraron usuarios</p>
                              <p className="text-xs text-gray-500">Intenta con otros términos de búsqueda</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Usuario seleccionado */}
                      {selectedWordPressUser && (
                        <div className="bg-green-100 border-2 border-green-300 p-3 rounded-lg shadow-md">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Check className="h-4 w-4 text-green-700" />
                                <span className="font-bold text-green-800">✅ Usuario vinculado exitosamente</span>
                              </div>
                              <div className="text-sm space-y-1">
                                <div className="font-medium text-gray-900">{selectedWordPressUser.name || selectedWordPressUser.username}</div>
                                <div className="text-gray-700">📧 {selectedWordPressUser.email}</div>
                                {selectedWordPressUser.roles && (
                                  <div className="text-xs text-gray-600">
                                    👤 Roles: {selectedWordPressUser.roles.join(", ")}
                                  </div>
                                )}
                                <div className="text-xs text-green-700 font-medium mt-1">
                                  ✨ Campo auto-llenado: Email principal
                                </div>
                                <div className="pt-2">
                                  <Button
                                    type="button"
                                    variant="link"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      window.open(`https://anpr.org.mx/profile-2/?${selectedWordPressUser.username}/`, '_blank');
                                    }}
                                    className="p-0 h-auto text-blue-600 hover:text-blue-700"
                                  >
                                    <ExternalLink className="h-3 w-3 mr-1" />
                                    Ver Perfil en PeepSo
                                  </Button>
                                </div>
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedWordPressUser(null);
                                setUserTransactions([]);
                                // Limpiar la vinculación del formulario
                                form.setValue("userId", null);
                                toast({
                                  title: "Usuario desvinculado",
                                  description: "Se eliminó la vinculación del usuario de WordPress",
                                });
                              }}
                              className="text-red-600 hover:text-red-800"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Transacciones de MemberPress */}
                      {selectedWordPressUser && (
                        <div className="space-y-4">
                          <div className="border rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="font-medium text-gray-900 flex items-center gap-2">
                                💳 Transacciones de MemberPress
                              </h4>
                              {isLoadingTransactions && (
                                <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                              )}
                            </div>
                            {userTransactions.length > 0 ? (
                              <div className="space-y-2">
                                {userTransactions.map((transaction: any) => (
                                  <div key={transaction.id} className="text-sm p-2 bg-gray-50 rounded">
                                    <div className="font-medium">{transaction.membership_title}</div>
                                    <div className="text-gray-600">
                                      Expira: {new Date(transaction.expires_at).toLocaleDateString()}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-gray-600">No se encontraron transacciones activas.</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="nombreEmpresa"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nombre de la Empresa</FormLabel>
                          <FormControl>
                            <Input {...field} />
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
                          <FormLabel>Email Principal</FormLabel>
                          <FormControl>
                            <Input type="email" {...field} />
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
                          <FormLabel>Email Secundario (Opcional)</FormLabel>
                          <FormControl>
                            <Input type="email" {...field} />
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
                          <FormLabel>Teléfono Principal</FormLabel>
                          <FormControl>
                            <Input {...field} />
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
                          <FormLabel>Teléfono Secundario (Opcional)</FormLabel>
                          <FormControl>
                            <Input {...field} />
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
                          <FormLabel>Sitio Web (Opcional)</FormLabel>
                          <FormControl>
                            <Input placeholder="https://www.ejemplo.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="direccionFisica"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Dirección Física</FormLabel>
                          <FormControl>
                            <Textarea {...field} rows={3} />
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
                          <FormLabel>Descripción de la Empresa</FormLabel>
                          <FormControl>
                            <Textarea {...field} rows={4} />
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
                          <FormLabel>Catálogo Digital (Opcional)</FormLabel>
                          <FormControl>
                            <Input placeholder="https://www.ejemplo.com/catalogo" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Social Media Section */}
                    <div className="col-span-2">
                      <FormField
                        control={form.control}
                        name="redesSociales"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <DynamicSocialMedia
                                value={field.value || {}}
                                onChange={field.onChange}
                                disabled={updateCompanyMutation.isPending}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={updateCompanyMutation.isPending}
                    className="bg-[#bcce16] hover:bg-[#a8b814] text-black"
                  >
                    {updateCompanyMutation.isPending ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black mr-2" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Guardar Cambios
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>

      {/* Image Gallery Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Galería de Productos
          </CardTitle>
          <p className="text-sm text-gray-600">Gestiona las imágenes de tus productos y servicios</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                id="image-upload"
              />
              <label htmlFor="image-upload">
                <Button 
                  asChild
                  variant="outline"
                  disabled={uploadingImages}
                  className="cursor-pointer"
                >
                  <span>
                    {uploadingImages ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2" />
                        Subiendo...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Subir Imágenes
                      </>
                    )}
                  </span>
                </Button>
              </label>
              <p className="text-sm text-gray-500">Máximo 4 imágenes, formatos JPG, PNG</p>
            </div>

            {company.galeriaProductosUrls && company.galeriaProductosUrls.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {company.galeriaProductosUrls.map((url: string, index: number) => (
                  <div key={index} className="relative">
                    <img
                      src={url}
                      alt={`Producto ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg border"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}