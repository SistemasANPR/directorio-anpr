import { useState, useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
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
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertCompanySchema, Category, MembershipType, Certificate, CompanyWithDetails, Tag } from "@shared/schema";
import TagSelector from "@/components/TagSelector";
import MembershipLimitsValidator from "@/components/MembershipLimitsValidator";
import { paisesAmericaLatina, estadosMexico, ciudadesPorEstado } from "@/lib/locationData";
import { 
  Upload, X, Building, Phone, Mail, Plus, FileText, Trash2, Facebook, Instagram, Linkedin, Twitter, Youtube, Globe, MapPin,
  Tags, Building2, Car, Truck, Hammer, Factory, Cpu, Wrench, ShoppingBag,
  Briefcase, Heart, GraduationCap, Home, Coffee, Camera, Music,
  Gamepad2, Book, Palette, Plane, Ship, Train, Zap, Search, Check, ChevronsUpDown, ExternalLink, User, Crown
} from "lucide-react";
import MapLocationPicker from "./MapLocationPicker";
import RichTextEditor from "./RichTextEditor";

// Schema completo para edición 
const companySchema = z.object({
  nombreEmpresa: z.string().min(1, "Nombre de empresa es requerido"),
  telefono1: z.string().min(1, "Teléfono principal es requerido"),
  telefono2: z.string().optional(),
  email1: z.string().email("Email inválido").min(1, "Email principal es requerido"),
  email2: z.string().email("Email inválido").optional().or(z.literal("")),
  sitioWeb: z.string().optional(),
  direccionFisica: z.string().min(1, "Dirección física es requerida"),
  descripcionEmpresa: z.string().min(1, "Descripción es requerida"),
  ubicacionPrincipal: z.string().optional(),
  ubicacionGeografica: z.string().optional(),
  representantesVentas: z.string().optional(),
  catalogoDigitalUrl: z.string().optional(),
  logotipoUrl: z.string().optional(),
  fotoPortadaUrl: z.string().optional(),
  membershipTypeId: z.number().min(1, "Tipo de membresía es requerido"),
  membershipPeriodicidad: z.string().optional(),
  formaPago: z.string().optional(),
  fechaInicioMembresia: z.string().optional(),
  fechaFinMembresia: z.string().optional(),
  notasMembresia: z.string().optional(),
  categoriesIds: z.array(z.number()).optional(),
  certificateIds: z.array(z.number()).optional(),
  tagIds: z.array(z.number()).optional(),
  paisesPresencia: z.array(z.string()).optional(),
  estadosPresencia: z.array(z.string()).optional(),
  ciudadesPresencia: z.array(z.string()).optional(),
  paisesPresenciaOtro: z.string().optional(),
  estadosPresenciaOtro: z.string().optional(),
  ciudadesPresenciaOtro: z.string().optional(),
  redesSociales: z.array(z.object({
    plataforma: z.string(),
    url: z.string()
  })).optional(),
  videosUrls: z.array(z.string()).optional(),
  galeriaProductosUrls: z.array(z.string()).optional(),
});

type CompanyFormData = z.infer<typeof companySchema>;

// Map of icon names to components  
const iconMap = {
  Tags, Building2, Car, Truck, Hammer, Factory, Cpu, Wrench, ShoppingBag,
  Briefcase, Heart, GraduationCap, Home, Coffee, Camera, Music,
  Gamepad2, Book, Palette, MapPin, Plane, Ship, Train, Zap
};

interface EditCompanyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company: CompanyWithDetails | null;
  userRole?: 'admin' | 'representante';
}

export default function EditCompanyModal({ open, onOpenChange, company, userRole = 'admin' }: EditCompanyModalProps) {
  const { toast } = useToast();
  
  // Estados para manejar archivos y selecciones
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>("");
  const [fotoPortadaFile, setFotoPortadaFile] = useState<File | null>(null);
  const [fotoPortadaPreview, setFotoPortadaPreview] = useState<string>("");
  const [selectedEstados, setSelectedEstados] = useState<string[]>([]);
  const [selectedCiudades, setSelectedCiudades] = useState<string[]>([]);
  const [catalogoFile, setCatalogoFile] = useState<File | null>(null);
  const [redesSociales, setRedesSociales] = useState<Array<{plataforma: string, url: string}>>([]);
  const [galeriaFiles, setGaleriaFiles] = useState<File[]>([]);
  const [galeriaPreviews, setGaleriaPreviews] = useState<string[]>([]);
  const [emailsAdicionales, setEmailsAdicionales] = useState<string[]>([]);
  const [telefonosAdicionales, setTelefonosAdicionales] = useState<string[]>([]);
  const [representantes, setRepresentantes] = useState<string[]>([]);
  const [direccionesPorCiudad, setDireccionesPorCiudad] = useState<{[ciudad: string]: string}>({});
  const [ubicacionesPorCiudad, setUbicacionesPorCiudad] = useState<{[ciudad: string]: { lat: number; lng: number; address: string }}>({});
  const [videosUrls, setVideosUrls] = useState<string[]>([]);
  
  // Estados para el buscador de usuarios de WordPress
  const [isWordPressUserOpen, setIsWordPressUserOpen] = useState(false);
  const [wordPressUserSearch, setWordPressUserSearch] = useState("");
  const [selectedWordPressUser, setSelectedWordPressUser] = useState<any>(null);
  const [userTransactions, setUserTransactions] = useState<any[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const [canAddProducts, setCanAddProducts] = useState(true);
  const [canAddProjects, setCanAddProjects] = useState(true);

  const form = useForm<CompanyFormData>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      nombreEmpresa: "",
      telefono1: "",
      telefono2: "",
      email1: "",
      email2: "",
      sitioWeb: "",
      direccionFisica: "",
      descripcionEmpresa: "",
      ubicacionPrincipal: "",
      ubicacionGeografica: "",
      representantesVentas: "",
      catalogoDigitalUrl: "",
      categoriesIds: [],
      certificateIds: [],
      tagIds: [],
      membershipTypeId: 1,
      membershipPeriodicidad: "",
      formaPago: "",
      fechaInicioMembresia: "",
      fechaFinMembresia: "",
      notasMembresia: "",
      paisesPresencia: [],
      estadosPresencia: [],
      ciudadesPresencia: [],
      paisesPresenciaOtro: "",
      estadosPresenciaOtro: "",
      ciudadesPresenciaOtro: "",
      redesSociales: [],
      videosUrls: [],
      galeriaProductosUrls: [],
      logotipoUrl: "",
      fotoPortadaUrl: "",
    },
  });

  // Watch for membership type changes to auto-calculate dates
  const watchedFechaInicio = form.watch("fechaInicioMembresia");
  const watchedPeriodicidad = form.watch("membershipPeriodicidad");

  // Calculate end date based on start date and periodicity
  const calculateEndDate = (startDate: string, periodicity: string): string => {
    if (!startDate || !periodicity) return "";
    
    const start = new Date(startDate);
    const end = new Date(start);
    
    switch (periodicity.toLowerCase()) {
      case 'mensual':
        end.setMonth(end.getMonth() + 1);
        break;
      case 'trimestral':
        end.setMonth(end.getMonth() + 3);
        break;
      case 'semestral':
        end.setMonth(end.getMonth() + 6);
        break;
      case 'anual':
        end.setFullYear(end.getFullYear() + 1);
        break;
      default:
        return startDate;
    }
    
    return end.toISOString().split('T')[0];
  };

  // Auto-calculate end date when start date or periodicity changes
  useEffect(() => {
    if (watchedFechaInicio && watchedPeriodicidad) {
      const endDate = calculateEndDate(watchedFechaInicio, watchedPeriodicidad);
      form.setValue("fechaFinMembresia", endDate);
    }
  }, [watchedFechaInicio, watchedPeriodicidad, form]);

  // Function to render the correct icon for categories
  const renderCategoryIcon = (category: Category) => {
    if (category.iconoUrl) {
      return (
        <img
          src={category.iconoUrl}
          alt={category.nombreCategoria}
          className="w-5 h-5 object-cover rounded"
        />
      );
    }

    const iconName = category.icono || "Tags";
    const IconComponent = iconMap[iconName as keyof typeof iconMap] || Tags;
    return <IconComponent className="w-5 h-5 text-primary" />;
  };

  // Plataformas de redes sociales disponibles
  const socialPlatforms = [
    { name: "Facebook", icon: Facebook },
    { name: "Instagram", icon: Instagram },
    { name: "LinkedIn", icon: Linkedin },
    { name: "Twitter", icon: Twitter },
    { name: "YouTube", icon: Youtube },
    { name: "TikTok", icon: Music },
    { name: "WhatsApp", icon: Phone },
  ];

  // Helper function to strip HTML tags and decode entities
  const stripHtmlAndDecode = (str: string): string => {
    if (!str) return "";
    
    // Create a temporary div to decode HTML entities
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = str;
    const decoded = tempDiv.textContent || tempDiv.innerText || "";
    
    // Remove any remaining HTML tags
    return decoded.replace(/<[^>]*>/g, "");
  };

  // Poblar formulario cuando se abre con empresa
  useEffect(() => {
    if (company && open) {
      const currentDate = new Date().toISOString().split('T')[0];
      
      // Clean description from HTML tags
      const cleanDescription = stripHtmlAndDecode(String(company.descripcionEmpresa || ""));
      const cleanRepresentantes = stripHtmlAndDecode(String(company.representantesVentas || ""));
      
      form.reset({
        nombreEmpresa: company.nombreEmpresa || "",
        telefono1: company.telefono1 || "",
        telefono2: company.telefono2 || "",
        email1: company.email1 || "",
        email2: company.email2 || "",
        sitioWeb: company.sitioWeb || "",
        direccionFisica: company.direccionFisica || "",
        descripcionEmpresa: cleanDescription,
        ubicacionPrincipal: company.ubicacionPrincipal || "",
        ubicacionGeografica: company.ubicacionGeografica || "",
        representantesVentas: cleanRepresentantes,
        catalogoDigitalUrl: String(company.catalogoDigitalUrl || ""),
        categoriesIds: Array.isArray(company.categoriesIds) ? company.categoriesIds : [],
        certificateIds: Array.isArray(company.certificateIds) ? company.certificateIds : [],
        tagIds: Array.isArray(company.tagIds) ? company.tagIds : [],
        membershipTypeId: company.membershipTypeId || 1,
        membershipPeriodicidad: company.membershipPeriodicidad || "",
        formaPago: company.formaPago || "",
        fechaInicioMembresia: company.fechaInicioMembresia || currentDate,
        fechaFinMembresia: company.fechaFinMembresia || "",
        notasMembresia: company.notasMembresia || "",
        paisesPresencia: Array.isArray(company.paisesPresencia) ? company.paisesPresencia : [],
        estadosPresencia: Array.isArray(company.estadosPresencia) ? company.estadosPresencia : [],
        ciudadesPresencia: Array.isArray(company.ciudadesPresencia) ? company.ciudadesPresencia : [],
        paisesPresenciaOtro: "",
        estadosPresenciaOtro: "",
        ciudadesPresenciaOtro: "",
        redesSociales: Array.isArray(company.redesSociales) ? company.redesSociales : [],
        videosUrls: Array.isArray(company.videosUrls) ? company.videosUrls : [],
        galeriaProductosUrls: Array.isArray(company.galeriaProductosUrls) ? company.galeriaProductosUrls : [],
        logotipoUrl: company.logotipoUrl || "",
        fotoPortadaUrl: company.fotoPortadaUrl || "",
      });
      
      // Set logo preview if exists
      if (company.logotipoUrl) {
        setLogoPreview(company.logotipoUrl);
      }
      
      // Set foto portada preview if exists
      if (company.fotoPortadaUrl) {
        setFotoPortadaPreview(company.fotoPortadaUrl);
      }
      
      // Set gallery previews if exist
      if (company.galeriaProductosUrls) {
        const urls = Array.isArray(company.galeriaProductosUrls) 
          ? company.galeriaProductosUrls 
          : [];
        setGaleriaPreviews(urls);
      }

      // Set redes sociales
      if (company.redesSociales) {
        setRedesSociales(Array.isArray(company.redesSociales) ? company.redesSociales : []);
      }

      // Set estados and ciudades if they exist
      if (company.estadosPresencia) {
        const estados = Array.isArray(company.estadosPresencia) ? company.estadosPresencia : [];
        setSelectedEstados(estados);
      }
      
      if (company.ciudadesPresencia) {
        const ciudades = Array.isArray(company.ciudadesPresencia) ? company.ciudadesPresencia : [];
        setSelectedCiudades(ciudades);
      }

      // Set videos URLs
      if (company.videosUrls) {
        setVideosUrls(Array.isArray(company.videosUrls) ? company.videosUrls : []);
      }
    }
  }, [company, open, form]);

  // Update available cities when estados change
  useEffect(() => {
    if (selectedEstados.length > 0) {
      const newCiudades = selectedEstados.flatMap(estado => 
        ciudadesPorEstado[estado] || []
      );
      // Only update if current selected cities are no longer valid
      const validCiudades = selectedCiudades.filter(ciudad => 
        newCiudades.includes(ciudad)
      );
      if (validCiudades.length !== selectedCiudades.length) {
        setSelectedCiudades(validCiudades);
        form.setValue("ciudadesPresencia", validCiudades);
      }
    }
  }, [selectedEstados, selectedCiudades, form]);

  // Fetch data
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
    enabled: open,
  });

  const { data: membershipTypes = [] } = useQuery<MembershipType[]>({
    queryKey: ["/api/membership-types"],
    enabled: open,
  });

  const { data: certificates = [] } = useQuery<Certificate[]>({
    queryKey: ["/api/certificates"],
    enabled: open,
  });

  const { data: tags = [] } = useQuery<Tag[]>({
    queryKey: ["/api/tags"],
    enabled: open,
  });

  // Función para cargar transacciones del usuario
  const loadUserTransactions = async (userId: string) => {
    setIsLoadingTransactions(true);
    try {
      const response = await fetch(`/api/wordpress-user-transactions/${userId}`);
      if (response.ok) {
        const data = await response.json();
        setUserTransactions(data.transactions || []);
        
        // Auto-completar fechas de membresía si hay transacciones
        if (data.transactions && data.transactions.length > 0) {
          const latestTransaction = data.transactions[0];
          if (latestTransaction.expires_at) {
            const expirationDate = new Date(latestTransaction.expires_at);
            const creationDate = new Date(latestTransaction.created_at);
            
            form.setValue("fechaInicioMembresia", creationDate.toISOString().split('T')[0]);
            form.setValue("fechaFinMembresia", expirationDate.toISOString().split('T')[0]);
          }
        }
      }
    } catch (error) {
      console.error('Error loading user transactions:', error);
    } finally {
      setIsLoadingTransactions(false);
    }
  };

  // Query para obtener usuarios de WordPress
  const { data: wordPressUsers = [], isLoading: isLoadingWordPressUsers } = useQuery<any[]>({
    queryKey: ["/api/wordpress-users", wordPressUserSearch],
    enabled: open && wordPressUserSearch.length > 2,
    select: (data: any) => {
      if (!data?.users) return [];
      return data.users.filter((user: any) => 
        user.name?.toLowerCase().includes(wordPressUserSearch.toLowerCase()) ||
        user.email?.toLowerCase().includes(wordPressUserSearch.toLowerCase()) ||
        user.username?.toLowerCase().includes(wordPressUserSearch.toLowerCase())
      ).slice(0, 10); // Limitar a 10 resultados
    }
  });

  // File upload functions
  const validateImage = (file: File): boolean => {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const maxSize = 2 * 1024 * 1024;
    
    if (!validTypes.includes(file.type)) {
      toast({
        title: "Formato no válido",
        description: "Solo se permiten archivos JPG, PNG y WebP",
        variant: "destructive",
      });
      return false;
    }
    
    if (file.size > maxSize) {
      toast({
        title: "Archivo muy grande",
        description: "La imagen supera el tamaño máximo permitido de 2 MB. Selecciona una imagen más ligera.",
        variant: "destructive",
      });
      return false;
    }
    
    return true;
  };

  const uploadImageToServer = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('image', file);
    
    const response = await fetch('/api/upload-image', {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error('Error al subir la imagen al servidor');
    }
    
    const result = await response.json();
    return result.imageUrl;
  };

  const uploadMultipleImages = async (files: File[]): Promise<string[]> => {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('images', file);
    });
    
    const response = await fetch('/api/upload-images', {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      throw new Error('Error al subir las imágenes al servidor');
    }
    
    const result = await response.json();
    return result.images.map((img: any) => img.imageUrl);
  };

  // Logo handling
  const handleLogoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !validateImage(file)) return;

    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setLogoPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    try {
      const imageUrl = await uploadImageToServer(file);
      form.setValue("logotipoUrl", imageUrl);
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al subir el logo al servidor",
        variant: "destructive",
      });
    }
  };

  // Foto portada handling
  const handleFotoPortadaSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !validateImage(file)) return;

    setFotoPortadaFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setFotoPortadaPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    try {
      const imageUrl = await uploadImageToServer(file);
      form.setValue("fotoPortadaUrl", imageUrl);
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al subir la foto de portada al servidor",
        variant: "destructive",
      });
    }
  };

  // Gallery handling
  const handleGaleriaSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    if (galeriaPreviews.length + files.length > 10) {
      toast({
        title: "Error",
        description: "Solo se permiten máximo 10 imágenes en la galería",
        variant: "destructive",
      });
      return;
    }

    const validFiles = files.filter(validateImage);
    if (validFiles.length === 0) return;

    try {
      const imageUrls = await uploadMultipleImages(validFiles);
      
      const newPreviews = [...galeriaPreviews, ...imageUrls];
      setGaleriaPreviews(newPreviews);
      form.setValue("galeriaProductosUrls", newPreviews);
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al subir las imágenes al servidor",
        variant: "destructive",
      });
    }

    // Limpiar el input
    if (e.target) {
      e.target.value = '';
    }
  };

  const handleGaleriaDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    
    if (galeriaPreviews.length + files.length > 10) {
      toast({
        title: "Error",
        description: "Solo se permiten máximo 10 imágenes en la galería",
        variant: "destructive",
      });
      return;
    }

    const validFiles = files.filter(validateImage);
    if (validFiles.length === 0) return;

    try {
      const imageUrls = await uploadMultipleImages(validFiles);
      
      const newPreviews = [...galeriaPreviews, ...imageUrls];
      setGaleriaPreviews(newPreviews);
      form.setValue("galeriaProductosUrls", newPreviews);
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al subir las imágenes al servidor",
        variant: "destructive",
      });
    }
  }, [galeriaPreviews, toast, form]);

  const removeGaleriaImage = (index: number) => {
    const newPreviews = galeriaPreviews.filter((_, i) => i !== index);
    setGaleriaPreviews(newPreviews);
    form.setValue("galeriaProductosUrls", newPreviews);
  };

  // Social media handling
  const addRedSocial = () => {
    setRedesSociales([...redesSociales, { plataforma: "", url: "" }]);
  };

  const updateRedSocial = (index: number, field: 'plataforma' | 'url', value: string) => {
    const updated = redesSociales.map((red, i) => 
      i === index ? { ...red, [field]: value } : red
    );
    setRedesSociales(updated);
    form.setValue("redesSociales", updated);
  };

  const removeRedSocial = (index: number) => {
    const updated = redesSociales.filter((_, i) => i !== index);
    setRedesSociales(updated);
    form.setValue("redesSociales", updated);
  };

  // Videos handling
  const addVideo = () => {
    setVideosUrls([...videosUrls, ""]);
  };

  const updateVideo = (index: number, value: string) => {
    const updated = videosUrls.map((url, i) => i === index ? value : url);
    setVideosUrls(updated);
    form.setValue("videosUrls", updated);
  };

  const removeVideo = (index: number) => {
    const updated = videosUrls.filter((_, i) => i !== index);
    setVideosUrls(updated);
    form.setValue("videosUrls", updated);
  };

  const updateCompanyMutation = useMutation({
    mutationFn: async (data: CompanyFormData) => {
      if (!company) throw new Error("No hay empresa para actualizar");
      
      // Prepare data for submission
      const submissionData = {
        ...data,
        paisesPresencia: selectedEstados.length > 0 ? ["México"] : data.paisesPresencia,
        estadosPresencia: selectedEstados,
        ciudadesPresencia: selectedCiudades,
        redesSociales: redesSociales.filter(red => red.plataforma && red.url),
        videosUrls: videosUrls.filter(url => url.trim()),
        galeriaProductosUrls: galeriaPreviews,
        representantesVentas: representantes.join('\n'),
      };

      const response = await apiRequest("PUT", `/api/companies/${company.id}`, submissionData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Empresa actualizada",
        description: "La información se ha actualizado correctamente.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/companies"] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error al actualizar empresa",
        description: error.message || "Ocurrió un error inesperado",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CompanyFormData) => {
    updateCompanyMutation.mutate(data);
  };

  if (!company) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1000px] max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Editar Información de la Empresa - {company.nombreEmpresa}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            
            {/* INFORMACIÓN DEL USUARIO WORDPRESS (SI EXISTE) */}
            {company?.user && (
              <div className="bg-blue-100 p-4 rounded-lg border-2 border-blue-300 shadow-md">
                <div className="flex items-center gap-2 mb-3">
                  <User className="h-5 w-5 text-blue-600" />
                  <h4 className="font-bold text-blue-800">👤 Usuario de WordPress Vinculado</h4>
                </div>
                
                <div className="space-y-3">
                  <div className="bg-green-100 border-2 border-green-300 p-3 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Check className="h-4 w-4 text-green-700" />
                          <span className="font-bold text-green-800">✅ Usuario vinculado</span>
                        </div>
                        <div className="text-sm space-y-1">
                          <div className="font-medium text-gray-900">{company.user.displayName || company.user.email}</div>
                          <div className="text-gray-700">📧 {company.user.email}</div>
                          <div className="text-xs text-gray-600">
                            👤 Rol: {company.user.role}
                          </div>
                          <div className="text-xs text-green-700 font-medium mt-1">
                            🔗 Esta empresa está vinculada a un usuario de WordPress
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sección de transacciones */}
                  <div className="space-y-4">
                    <div className="border rounded-lg p-4 bg-white">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-900 flex items-center gap-2">
                          💳 Información de Membresía
                        </h4>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (company.user?.id) {
                              loadUserTransactions(company.user.id.toString());
                            }
                          }}
                          className="text-blue-600 hover:text-blue-700"
                        >
                          <Search className="h-3 w-3 mr-1" />
                          Verificar Transacciones
                        </Button>
                      </div>

                      {isLoadingTransactions ? (
                        <div className="text-center py-4 text-gray-500">
                          <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2"></div>
                          Cargando información de membresía...
                        </div>
                      ) : userTransactions.length > 0 ? (
                        <div className="space-y-3 max-h-64 overflow-y-auto">
                          {userTransactions.map((transaction: any, index: number) => (
                            <div key={transaction.id} className={`p-3 border rounded-lg ${index === 0 ? 'bg-blue-50 border-blue-200' : 'bg-gray-50'}`}>
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <div className="font-medium text-gray-900">
                                    {transaction.membership_name}
                                    {index === 0 && (
                                      <span className="ml-2 px-2 py-1 text-xs bg-blue-600 text-white rounded-full">
                                        Más reciente
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-sm text-gray-600 space-y-1 mt-1">
                                    <div>💰 Total: ${transaction.total || transaction.amount}</div>
                                    <div>📅 Creada: {new Date(transaction.created_at).toLocaleDateString('es-ES')}</div>
                                    {transaction.expires_at && (
                                      <div className="font-medium text-red-600">
                                        ⏰ Vence: {new Date(transaction.expires_at).toLocaleDateString('es-ES')}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <span className={`px-2 py-1 text-xs rounded-full ${
                                  transaction.status === 'complete' 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {transaction.status}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-4 text-gray-500">
                          <div className="text-2xl mb-2">📄</div>
                          <div>Información de membresía desde WordPress</div>
                          <div className="text-xs mt-1">
                            Click en "Verificar Transacciones" para cargar datos
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Sección: Información de Contacto */}
            <div className="space-y-6">
              <div className="border-b pb-4">
                <h3 className="text-lg font-semibold text-primary">Información de Contacto</h3>
                <p className="text-sm text-gray-600">Datos de contacto y representantes</p>
              </div>
              
              {/* Buscador de Usuario de WordPress - UBICADO AQUÍ PARA MÁXIMA VISIBILIDAD */}
              <div className="bg-blue-100 p-4 rounded-lg border-2 border-blue-300 shadow-md">
                <div className="flex items-center gap-2 mb-3">
                  <ExternalLink className="h-6 w-6 text-blue-600" />
                  <h4 className="text-lg font-bold text-blue-800">🔗 Vincular Usuario de WordPress</h4>
                </div>
                <p className="text-sm text-blue-700 mb-4 font-medium">
                  Busca y selecciona un usuario existente de WordPress para asociar con esta empresa.
                </p>
                
                <div className="space-y-3">
                  {/* Campo de búsqueda */}
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-5 w-5 text-gray-500" />
                    <Input
                      placeholder="Buscar usuario por nombre, email o usuario... (mín. 3 caracteres)"
                      value={wordPressUserSearch}
                      onChange={(e) => setWordPressUserSearch(e.target.value)}
                      className="pl-12 text-base py-3 border-2 border-blue-200 focus:border-blue-400"
                    />
                  </div>

                  {/* Resultados de búsqueda */}
                  {wordPressUserSearch.length >= 3 && (
                    <div className="border-2 border-blue-200 rounded-lg bg-white max-h-60 overflow-y-auto shadow-lg">
                      {isLoadingWordPressUsers ? (
                        <div className="p-4 text-center text-gray-600">
                          <div className="flex items-center justify-center gap-3">
                            <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                            <span className="text-base">Buscando usuarios...</span>
                          </div>
                        </div>
                      ) : wordPressUsers.length === 0 ? (
                        <div className="p-4 text-center text-gray-600">
                          <span className="text-base">No se encontraron usuarios que coincidan con "{wordPressUserSearch}"</span>
                        </div>
                      ) : (
                        <div className="divide-y divide-gray-200">
                          {wordPressUsers.map((user: any) => (
                            <div
                              key={user.id}
                              className="p-4 hover:bg-blue-50 cursor-pointer flex items-center gap-3 transition-colors"
                              onClick={() => {
                                setSelectedWordPressUser(user);
                                setWordPressUserSearch("");
                                // Auto-llenar campos
                                if (!form.getValues("email1") && user.email) {
                                  form.setValue("email1", user.email);
                                }
                                if (!form.getValues("nombreEmpresa") && user.name) {
                                  form.setValue("nombreEmpresa", user.name);
                                }
                              }}
                            >
                              <User className="h-6 w-6 text-blue-600 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-gray-900 text-base truncate">
                                  {user.name || user.username}
                                </div>
                                <div className="text-sm text-gray-600 truncate">
                                  📧 {user.email}
                                  {user.roles && user.roles.length > 0 && (
                                    <span className="ml-2 text-blue-600">• {user.roles.join(", ")}</span>
                                  )}
                                </div>
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                className="bg-blue-600 hover:bg-blue-700"
                              >
                                Seleccionar
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Usuario seleccionado */}
                  {selectedWordPressUser && (
                    <div className="bg-green-100 border-2 border-green-300 p-4 rounded-lg shadow-md">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Check className="h-5 w-5 text-green-700" />
                            <span className="font-bold text-green-800 text-base">✅ Usuario vinculado exitosamente</span>
                          </div>
                          <div className="text-sm space-y-1">
                            <div className="font-semibold text-gray-900">{selectedWordPressUser.name || selectedWordPressUser.username}</div>
                            <div className="text-gray-700">📧 {selectedWordPressUser.email}</div>
                            {selectedWordPressUser.roles && (
                              <div className="text-xs text-gray-600">
                                👤 Roles: {selectedWordPressUser.roles.join(", ")}
                              </div>
                            )}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedWordPressUser(null)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <X className="h-5 w-5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <FormField
                control={form.control}
                name="nombreEmpresa"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre de la Empresa *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Nombre de la empresa"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="telefono1"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Teléfono Principal *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value || ""}
                          placeholder="+52 777 123 4567"
                        />
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
                        <Input
                          {...field}
                          value={field.value || ""}
                          placeholder="+52 777 123 4568"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="email1"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Principal *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value || ""}
                          type="email"
                          placeholder="contacto@empresa.com"
                        />
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
                        <Input
                          {...field}
                          value={field.value || ""}
                          type="email"
                          placeholder="ventas@empresa.com"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>



              <FormField
                control={form.control}
                name="sitioWeb"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sitio Web</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value || ""}
                        type="url"
                        placeholder="https://www.empresa.com"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="direccionFisica"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dirección Física *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value || ""}
                        placeholder="Dirección completa de la empresa"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Sección: Información de la Empresa */}
            <div className="space-y-6">
              <div className="border-b pb-4">
                <h3 className="text-lg font-semibold text-primary">Información de la Empresa</h3>
                <p className="text-sm text-gray-600">Datos básicos y descripción de la empresa</p>
              </div>
              
              <FormField
                control={form.control}
                name="descripcionEmpresa"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descripción de la Empresa *</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        value={field.value || ""}
                        placeholder="Descripción detallada de la empresa, sus servicios y especialidades"
                        className="min-h-[120px]"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="representantesVentas"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Representantes de Ventas</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        value={field.value || ""}
                        placeholder="Información de contacto de representantes de ventas"
                        className="min-h-[80px]"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Sección: Galería de Productos */}
            <div className="space-y-6">
              <div className="border-b pb-4">
                <h3 className="text-lg font-semibold text-primary">Galería de Productos</h3>
                <p className="text-sm text-gray-600">Categorías, etiquetas y galería de productos</p>
              </div>
              
              <FormField
                control={form.control}
                name="categoriesIds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categorías de Servicios</FormLabel>
                    <FormDescription>
                      Selecciona las categorías que mejor describan los servicios de tu empresa
                    </FormDescription>
                    <FormControl>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-60 overflow-y-auto border rounded-md p-3">
                        {categories.map((category) => (
                          <div key={category.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`category-${category.id}`}
                              checked={field.value?.includes(category.id) || false}
                              onCheckedChange={(checked) => {
                                const updatedIds = checked
                                  ? [...(field.value || []), category.id]
                                  : (field.value || []).filter((id) => id !== category.id);
                                field.onChange(updatedIds);
                              }}
                            />
                            <label
                              htmlFor={`category-${category.id}`}
                              className="flex items-center gap-2 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                            >
                              {renderCategoryIcon(category)}
                              {category.nombreCategoria}
                            </label>
                          </div>
                        ))}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tagIds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Etiquetas</FormLabel>
                    <FormDescription>
                      Agrega etiquetas que ayuden a los usuarios a encontrar tu empresa
                    </FormDescription>
                    <FormControl>
                      <TagSelector
                        selectedTagIds={field.value || []}
                        onTagsChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* SECCIÓN 4: UBICACIÓN Y PRESENCIA */}
            <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Ubicación y Presencia</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="estadosPresencia"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estados donde opera</FormLabel>
                      <FormDescription>Selecciona los estados donde tu empresa tiene presencia</FormDescription>
                      <FormControl>
                        <div className="max-h-40 overflow-y-auto border rounded-md p-2">
                          {estadosMexico.map((estado) => (
                            <div key={estado} className="flex items-center space-x-2 py-1">
                              <Checkbox
                                id={`estado-${estado}`}
                                checked={selectedEstados.includes(estado)}
                                onCheckedChange={(checked) => {
                                  const updatedEstados = checked
                                    ? [...selectedEstados, estado]
                                    : selectedEstados.filter((e) => e !== estado);
                                  setSelectedEstados(updatedEstados);
                                  field.onChange(updatedEstados);
                                }}
                              />
                              <label
                                htmlFor={`estado-${estado}`}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                              >
                                {estado}
                              </label>
                            </div>
                          ))}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {selectedEstados.length > 0 && (
                  <FormField
                    control={form.control}
                    name="ciudadesPresencia"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ciudades donde opera</FormLabel>
                        <FormDescription>Selecciona las ciudades específicas</FormDescription>
                        <FormControl>
                          <div className="max-h-40 overflow-y-auto border rounded-md p-2">
                            {selectedEstados.flatMap(estado => 
                              ciudadesPorEstado[estado] || []
                            ).map((ciudad) => (
                              <div key={ciudad} className="flex items-center space-x-2 py-1">
                                <Checkbox
                                  id={`ciudad-${ciudad}`}
                                  checked={selectedCiudades.includes(ciudad)}
                                  onCheckedChange={(checked) => {
                                    const updatedCiudades = checked
                                      ? [...selectedCiudades, ciudad]
                                      : selectedCiudades.filter((c) => c !== ciudad);
                                    setSelectedCiudades(updatedCiudades);
                                    field.onChange(updatedCiudades);
                                  }}
                                />
                                <label
                                  htmlFor={`ciudad-${ciudad}`}
                                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                >
                                  {ciudad}
                                </label>
                              </div>
                            ))}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
            </div>

            {/* SECCIÓN 5: IMÁGENES Y MULTIMEDIA */}
            <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Imágenes y Multimedia</h3>
              
              {/* Logo */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <FormLabel>Logo de la Empresa</FormLabel>
                  <div className="mt-2 space-y-2">
                    {logoPreview && (
                      <div className="relative inline-block">
                        <img
                          src={logoPreview}
                          alt="Preview del logo"
                          className="w-24 h-24 object-cover rounded-lg border border-gray-200"
                        />
                      </div>
                    )}
                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoSelect}
                        className="hidden"
                        id="logo-upload"
                      />
                      <label
                        htmlFor="logo-upload"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50"
                      >
                        <Upload className="h-4 w-4" />
                        {logoPreview ? "Cambiar Logo" : "Subir Logo"}
                      </label>
                    </div>
                  </div>
                </div>

                {/* Foto de Portada */}
                <div>
                  <FormLabel>Foto de Portada</FormLabel>
                  <div className="mt-2 space-y-2">
                    {fotoPortadaPreview && (
                      <div className="relative inline-block">
                        <img
                          src={fotoPortadaPreview}
                          alt="Preview de foto de portada"
                          className="w-32 h-20 object-cover rounded-lg border border-gray-200"
                        />
                      </div>
                    )}
                    <div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFotoPortadaSelect}
                        className="hidden"
                        id="portada-upload"
                      />
                      <label
                        htmlFor="portada-upload"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-md cursor-pointer hover:bg-gray-50"
                      >
                        <Upload className="h-4 w-4" />
                        {fotoPortadaPreview ? "Cambiar Portada" : "Subir Portada"}
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Galería de Productos */}
              <div>
                <FormLabel>Galería de Productos (máx. 10 imágenes)</FormLabel>
                <div
                  className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary transition-colors mt-2"
                  onDrop={handleGaleriaDrop}
                  onDragOver={(e) => e.preventDefault()}
                >
                  {galeriaPreviews.length > 0 ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {galeriaPreviews.map((preview, index) => (
                          <div key={index} className="relative group">
                            <img
                              src={preview}
                              alt={`Galería ${index + 1}`}
                              className="w-full h-24 object-cover rounded-lg border border-gray-200"
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
                        {galeriaPreviews.length < 10 && (
                          <label className="w-full h-24 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center cursor-pointer hover:border-primary transition-colors">
                            <Plus className="h-8 w-8 text-gray-400" />
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              className="hidden"
                              onChange={handleGaleriaSelect}
                            />
                          </label>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        {galeriaPreviews.length}/10 imágenes • Arrastra más imágenes o haz clic en + para agregar
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <Upload className="h-12 w-12 text-gray-400 mx-auto" />
                      <div>
                        <p className="text-sm text-gray-600">
                          Arrastra y suelta tus imágenes aquí, o{" "}
                          <label className="text-primary cursor-pointer hover:underline">
                            selecciona archivos
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              className="hidden"
                              onChange={handleGaleriaSelect}
                            />
                          </label>
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Máximo 10 imágenes • Cada imagen: máx. 2 MB, min. 800x800px, formato 1:1
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* SECCIÓN 6: REDES SOCIALES Y VIDEOS */}
            <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Redes Sociales y Multimedia</h3>
              
              {/* Redes Sociales */}
              <div>
                <FormLabel>Redes Sociales</FormLabel>
                <div className="space-y-3 mt-2">
                  {redesSociales.map((red, index) => (
                    <div key={index} className="flex gap-2 items-end">
                      <div className="flex-1">
                        <Select
                          value={red.plataforma}
                          onValueChange={(value) => updateRedSocial(index, 'plataforma', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona plataforma" />
                          </SelectTrigger>
                          <SelectContent>
                            {socialPlatforms.map((platform) => (
                              <SelectItem key={platform.name} value={platform.name}>
                                <div className="flex items-center gap-2">
                                  <platform.icon className="h-4 w-4" />
                                  {platform.name}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex-2">
                        <Input
                          placeholder="https://..."
                          value={red.url}
                          onChange={(e) => updateRedSocial(index, 'url', e.target.value)}
                        />
                      </div>
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

              {/* Videos */}
              <div>
                <FormLabel>Videos de la Empresa</FormLabel>
                <FormDescription>
                  Agrega URLs de videos de YouTube, Vimeo u otras plataformas
                </FormDescription>
                <div className="space-y-2 mt-2">
                  {videosUrls.map((video, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        placeholder="https://www.youtube.com/watch?v=..."
                        value={video}
                        onChange={(e) => updateVideo(index, e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeVideo(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addVideo}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Agregar Video
                  </Button>
                </div>
              </div>

              <FormField
                control={form.control}
                name="catalogoDigitalUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Catálogo Digital</FormLabel>
                    <FormDescription>
                      URL de tu catálogo digital o página de productos
                    </FormDescription>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value || ""}
                        type="url"
                        placeholder="https://www.empresa.com/catalogo"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* SECCIÓN 7: CERTIFICADOS */}
            <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Certificados y Reconocimientos</h3>
              
              <FormField
                control={form.control}
                name="certificateIds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Certificados</FormLabel>
                    <FormDescription>
                      Selecciona los certificados y reconocimientos de tu empresa
                    </FormDescription>
                    <FormControl>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto border rounded-md p-3">
                        {certificates.map((certificate) => (
                          <div key={certificate.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`certificate-${certificate.id}`}
                              checked={field.value?.includes(certificate.id) || false}
                              onCheckedChange={(checked) => {
                                const updatedIds = checked
                                  ? [...(field.value || []), certificate.id]
                                  : (field.value || []).filter((id) => id !== certificate.id);
                                field.onChange(updatedIds);
                              }}
                            />
                            <label
                              htmlFor={`certificate-${certificate.id}`}
                              className="flex items-center gap-2 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                            >
                              <FileText className="h-4 w-4 text-blue-600" />
                              {certificate.nombreCertificado}
                            </label>
                          </div>
                        ))}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Sección: Información de Membresía */}
            {userRole === 'admin' && (
              <div className="space-y-6">
                <div className="border-b pb-4">
                  <h3 className="text-lg font-semibold text-primary">Información de Membresía</h3>
                  <p className="text-sm text-gray-600">Configuración de plan y fechas de membresía</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="membershipTypeId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Membresía *</FormLabel>
                        <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value?.toString()}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona tipo de membresía" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {membershipTypes.map((type) => (
                              <SelectItem key={type.id} value={type.id.toString()}>
                                {type.nombrePlan}
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
                    name="membershipPeriodicidad"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Periodicidad de Pago</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona periodicidad" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="mensual">Mensual</SelectItem>
                            <SelectItem value="trimestral">Trimestral</SelectItem>
                            <SelectItem value="semestral">Semestral</SelectItem>
                            <SelectItem value="anual">Anual</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="fechaInicioMembresia"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fecha de Inicio</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="date"
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="fechaFinMembresia"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fecha de Fin</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="date"
                            value={field.value || ""}
                            readOnly
                          />
                        </FormControl>
                        <FormDescription>
                          Se calcula automáticamente según la periodicidad
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="formaPago"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Forma de Pago</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona forma de pago" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="tarjeta">Tarjeta de Crédito/Débito</SelectItem>
                          <SelectItem value="transferencia">Transferencia Bancaria</SelectItem>
                          <SelectItem value="efectivo">Efectivo</SelectItem>
                          <SelectItem value="cheque">Cheque</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notasMembresia"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notas de Membresía</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          value={field.value || ""}
                          placeholder="Notas adicionales sobre la membresía"
                          className="min-h-[80px]"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* BOTONES DE ACCIÓN */}
            <div className="flex justify-end space-x-2 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={updateCompanyMutation.isPending}
                className="bg-[#bcce16] hover:bg-[#a8b814] text-black"
              >
                {updateCompanyMutation.isPending ? "Actualizando..." : "Actualizar Empresa"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}