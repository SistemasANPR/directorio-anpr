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
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertCompanySchema, Category, MembershipType, Certificate, CompanyWithDetails, Tag } from "@shared/schema";
import TagSelector from "@/components/TagSelector";
import MembershipLimitsDisplay from "@/components/MembershipLimitsDisplay";
import { paisesAmericaLatina, estadosMexico, ciudadesPorEstado } from "@/lib/locationData";
import { 
  Upload, X, Building, Phone, Mail, Plus, FileText, Trash2, Facebook, Instagram, Linkedin, Twitter, Youtube, Globe, MapPin,
  Tags, Building2, Car, Truck, Hammer, Factory, Cpu, Wrench, ShoppingBag,
  Briefcase, Heart, GraduationCap, Home, Coffee, Camera, Music,
  Gamepad2, Book, Palette, Plane, Ship, Train, Zap, Search, Check, ChevronsUpDown, ExternalLink, User, Crown
} from "lucide-react";
import MapLocationPicker from "./MapLocationPicker";
import MultiLocationPicker from "./MultiLocationPicker";
import RichTextEditor from "./RichTextEditor";

// Schema completo para edición 
const companySchema = z.object({
  id: z.number().optional(),
  nombreEmpresa: z.string().min(1, "Nombre de empresa es requerido"),
  telefono1: z.string().optional(),
  telefono2: z.string().optional(),
  email1: z.string().email("Email inválido").optional().or(z.literal("")),
  email2: z.string().email("Email inválido").optional().or(z.literal("")),
  sitioWeb: z.string().optional(),
  direccionFisica: z.string().optional(), // Made optional to prevent blocking
  descripcionEmpresa: z.string().optional(), // Made optional - companies may not have description initially
  // ubicacionPrincipal: z.string().optional(), // Removed - obsolete field
  ubicacionGeografica: z.any().optional(), // Can be string, JSON object, or null
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
  // paisesPresencia: z.array(z.string()).optional(), // Removed - obsolete field
  // estadosPresencia: z.array(z.string()).optional(), // Removed - obsolete field  
  // ciudadesPresencia: z.array(z.string()).optional(), // Removed - obsolete field
  redesSociales: z.object({
    facebook: z.string().optional(),
    instagram: z.string().optional(),
    twitter: z.string().optional(),
    linkedin: z.string().optional(),
    youtube: z.string().optional(),
    whatsapp: z.string().optional()
  }).optional(),
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
  const [redesSociales, setRedesSociales] = useState<{
    facebook?: string;
    instagram?: string;
    twitter?: string;
    linkedin?: string;
    youtube?: string;
    whatsapp?: string;
  }>({});
  const [galeriaFiles, setGaleriaFiles] = useState<File[]>([]);
  const [galeriaPreviews, setGaleriaPreviews] = useState<string[]>([]);
  const [videosUrls, setVideosUrls] = useState<string[]>([]);
  
  // Estado para ubicaciones múltiples
  const [companyLocations, setCompanyLocations] = useState<any[]>([]);
  
  // Estados para el buscador de usuarios de WordPress
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
      // ubicacionPrincipal: "", // Removed - obsolete field
      ubicacionGeografica: null, // Can be object or string
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
      // paisesPresencia: [], // Removed - obsolete field
      // estadosPresencia: [], // Removed - obsolete field
      // ciudadesPresencia: [], // Removed - obsolete field
      redesSociales: {},
      videosUrls: [],
      galeriaProductosUrls: [],
      logotipoUrl: "",
      fotoPortadaUrl: "",
    },
  });

  // Redes sociales disponibles - eliminado: ahora se usan campos discretos

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

  // Function to render the correct icon for categories
  const renderCategoryIcon = (category: Category) => {
    if (category.iconoUrl) {
      return (
        <img
          src={category.iconoUrl}
          alt={category.nombreCategoria}
          className="w-4 h-4 object-contain"
        />
      );
    } else {
      const IconComponent = iconMap[category.icono as keyof typeof iconMap] || Tags;
      return <IconComponent className="w-4 h-4" />;
    }
  };

  // Function to load user transactions
  const loadUserTransactions = async (userId: string) => {
    setIsLoadingTransactions(true);
    try {
      const response = await fetch(`/api/wordpress-user-transactions/${userId}`);
      if (response.ok) {
        const data = await response.json();
        setUserTransactions(data.transactions || []);
        
        // Auto llenar fecha de finalización con la más reciente
        if (data.transactions && data.transactions.length > 0) {
          const latestTransaction = data.transactions.find((t: any) => t.expires_at);
          if (latestTransaction && latestTransaction.expires_at) {
            const expirationDate = new Date(latestTransaction.expires_at).toISOString().split('T')[0];
            form.setValue("fechaFinMembresia", expirationDate);
            
            // También calcular fecha de inicio (un año antes)
            const startDate = new Date(latestTransaction.expires_at);
            startDate.setFullYear(startDate.getFullYear() - 1);
            form.setValue("fechaInicioMembresia", startDate.toISOString().split('T')[0]);
            
            toast({
              title: "Fechas de membresía actualizadas",
              description: `Se establecieron las fechas basadas en la transacción más reciente`,
            });
          }
        }
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

  // Estados adicionales para búsqueda de WordPress
  const [isLoadingWordPressUsers, setIsLoadingWordPressUsers] = useState(false);
  const [wordPressUsers, setWordPressUsers] = useState<any[]>([]);

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
          setWordPressUsers(filteredUsers.slice(0, 10)); // Limitar a 10 resultados
        })
        .catch(error => {
          console.error('Error fetching WordPress users:', error);
          setWordPressUsers([]);
        })
        .finally(() => {
          setIsLoadingWordPressUsers(false);
        });
    } else {
      setWordPressUsers([]);
      setIsLoadingWordPressUsers(false);
    }
  }, [wordPressUserSearch]);

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

  const handleLogoUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && validateImage(file)) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setLogoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const handleFotoPortadaUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && validateImage(file)) {
      setFotoPortadaFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setFotoPortadaPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  // Funciones para galería de productos
  const addGaleriaFiles = useCallback((files: File[]) => {
    if (files.length === 0) return;
    
    // Verificar límites del plan de membresía actual
    const selectedMembershipId = form.watch("membershipTypeId");
    const selectedMembership = membershipTypes.find(m => m.id === selectedMembershipId);
    
    if (selectedMembership) {
      const maxProducts = selectedMembership.cantidadProductosAdmitidos;
      
      // Verificar límite de productos (usando galería como productos)
      if (maxProducts !== -1 && maxProducts !== null && galeriaPreviews.length + files.length > maxProducts) {
        toast({
          title: "Límite de productos excedido",
          description: `Tu plan "${selectedMembership.nombrePlan}" permite máximo ${maxProducts} productos. Actualmente tienes ${galeriaPreviews.length}.`,
          variant: "destructive",
        });
        return;
      }
    } else {
      // Fallback al límite estándar si no hay plan seleccionado
      if (galeriaPreviews.length + files.length > 10) {
        toast({
          title: "Límite excedido",
          description: "Máximo 10 imágenes permitidas en la galería",
          variant: "destructive",
        });
        return;
      }
    }

    const validFiles = files.filter(validateImage);
    
    validFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setGaleriaPreviews(prev => [...prev, e.target?.result as string]);
        setGaleriaFiles(prev => [...prev, file]);
      };
      reader.readAsDataURL(file);
    });
  }, [galeriaPreviews.length]);

  const handleGaleriaSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    addGaleriaFiles(Array.from(event.target.files || []));
    event.target.value = "";
  }, [addGaleriaFiles]);

  const handleGaleriaDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    addGaleriaFiles(Array.from(event.dataTransfer.files || []));
  }, [addGaleriaFiles]);

  const removeGaleriaImage = useCallback((index: number) => {
    setGaleriaPreviews(prev => prev.filter((_, i) => i !== index));
    setGaleriaFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Funciones para redes sociales
  const updateRedSocial = (platform: string, value: string) => {
    const updated = { ...redesSociales, [platform]: value };
    setRedesSociales(updated);
    form.setValue("redesSociales", updated);
  };

  // Funciones para videos
  const addVideo = () => {
    setVideosUrls([...videosUrls, ""]);
  };

  const removeVideo = (index: number) => {
    const updated = videosUrls.filter((_, i) => i !== index);
    setVideosUrls(updated);
    form.setValue("videosUrls", updated);
  };

  const updateVideo = (index: number, value: string) => {
    const updated = videosUrls.map((video, i) => i === index ? value : video);
    setVideosUrls(updated);
    form.setValue("videosUrls", updated);
  };

  // Drag and drop para catálogo digital
  const handleCatalogoDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const files = Array.from(event.dataTransfer.files);
    const pdfFile = files.find(file => file.type === 'application/pdf');
    
    if (pdfFile) {
      setCatalogoFile(pdfFile);
      form.setValue("catalogoDigitalUrl", pdfFile.name);
    } else {
      toast({
        title: "Formato no válido",
        description: "Solo se permiten archivos PDF para el catálogo digital",
        variant: "destructive",
      });
    }
  }, [form]);

  const handleCatalogoDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  }, []);

  const handleCatalogoSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setCatalogoFile(file);
      form.setValue("catalogoDigitalUrl", file.name);
    } else {
      toast({
        title: "Formato no válido",
        description: "Solo se permiten archivos PDF",
        variant: "destructive",
      });
    }
  }, [form]);

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
        // ubicacionPrincipal: company.ubicacionPrincipal || "", // Property no longer exists
        ubicacionGeografica: company.ubicacionGeografica || null, // Preserve as-is (object or string)
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
        // paisesPresencia: Array.isArray(company.paisesPresencia) ? company.paisesPresencia : [], // Property no longer exists
        // estadosPresencia: Array.isArray(company.estadosPresencia) ? company.estadosPresencia : [], // Property no longer exists
        // ciudadesPresencia: Array.isArray(company.ciudadesPresencia) ? company.ciudadesPresencia : [], // Property no longer exists
        redesSociales: (() => {
          // Manejar caso donde redesSociales puede ser string, array o objeto
          let parsed = company.redesSociales;
          if (typeof parsed === 'string') {
            if (parsed === '[object Object]' || parsed === '') {
              return {};
            }
            try {
              parsed = JSON.parse(parsed);
            } catch {
              return {};
            }
          }
          // Convertir de formato array [{url, plataforma}] a objeto {facebook, instagram, etc.}
          if (Array.isArray(parsed)) {
            const redesObj: Record<string, string> = {};
            parsed.forEach((red: { url?: string; plataforma?: string }) => {
              if (red.plataforma && red.url) {
                const key = red.plataforma.toLowerCase();
                redesObj[key] = red.url;
              }
            });
            return redesObj;
          }
          return (typeof parsed === 'object' && parsed !== null) ? parsed : {};
        })(),
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
      
      // Set gallery previews if exist - SOLUCIONADO: Cargar imágenes existentes
      if (company.galeriaProductosUrls) {
        const urls = Array.isArray(company.galeriaProductosUrls) 
          ? company.galeriaProductosUrls 
          : [];
        setGaleriaPreviews(urls);
      }

      // Set redes sociales - SOLUCIONADO: Cargar redes sociales existentes
      if (company.redesSociales) {
        let parsedRedesSociales = company.redesSociales;
        
        // Si es un string, intentar parsearlo como JSON
        if (typeof parsedRedesSociales === 'string') {
          if (parsedRedesSociales === '[object Object]' || parsedRedesSociales === '') {
            parsedRedesSociales = {};
          } else {
            try {
              parsedRedesSociales = JSON.parse(parsedRedesSociales);
            } catch {
              parsedRedesSociales = {};
            }
          }
        }
        
        // Convertir de formato array [{url, plataforma}] a objeto {facebook, instagram, etc.}
        if (Array.isArray(parsedRedesSociales)) {
          const redesObj: Record<string, string> = {};
          parsedRedesSociales.forEach((red: { url?: string; plataforma?: string }) => {
            if (red.plataforma && red.url) {
              const key = red.plataforma.toLowerCase();
              redesObj[key] = red.url;
            }
          });
          setRedesSociales(redesObj);
        } else if (typeof parsedRedesSociales === 'object' && parsedRedesSociales !== null) {
          setRedesSociales(parsedRedesSociales);
        }
      }

      // Set videos URLs
      if (company.videosUrls) {
        setVideosUrls(Array.isArray(company.videosUrls) ? company.videosUrls : []);
      }

      // Set estados and ciudades if they exist
      // if (company.estadosPresencia) {
      //   const estados = Array.isArray(company.estadosPresencia) ? company.estadosPresencia : [];
      //   setSelectedEstados(estados);
      // } // Property no longer exists
      
      // if (company.ciudadesPresencia) {
      //   const ciudades = Array.isArray(company.ciudadesPresencia) ? company.ciudadesPresencia : [];
      //   setSelectedCiudades(ciudades);
      // } // Property no longer exists
    }
  }, [company, open, form]);

  // Cargar ubicaciones existentes de la empresa
  useEffect(() => {
    const loadCompanyLocations = async () => {
      if (company?.id && open) {
        try {
          const response = await fetch(`/api/companies/${company.id}/locations`);
          if (response.ok) {
            const locations = await response.json();
            setCompanyLocations(locations);
          }
        } catch (error) {
          console.error('Error loading company locations:', error);
          setCompanyLocations([]);
        }
      }
    };
    
    loadCompanyLocations();
  }, [company?.id, open]);

  // Queries para obtener datos
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

  // Obtener el tipo de membresía actual para mostrar límites
  const currentMembershipType = membershipTypes.find(type => type.id === form.watch("membershipTypeId"));

  // Mutación para actualizar empresa
  const updateCompanyMutation = useMutation({
    mutationFn: async (data: CompanyFormData) => {
      const formData = new FormData();
      
      // Add all form fields, but skip catalogoDigitalUrl if we have a new file
      // (the backend will generate the correct URL from the uploaded file)
      Object.entries(data).forEach(([key, value]) => {
        // Skip catalogoDigitalUrl if we have a new file to upload
        if (key === 'catalogoDigitalUrl' && catalogoFile) {
          return;
        }
        
        if (Array.isArray(value)) {
          formData.append(key, JSON.stringify(value));
        } else if (value !== null && typeof value === 'object') {
          // Objetos (p. ej. redesSociales) deben viajar como JSON, no como "[object Object]"
          formData.append(key, JSON.stringify(value));
        } else if (value !== undefined && value !== null) {
          formData.append(key, value.toString());
        }
      });
      
      // Add files
      if (logoFile) formData.append("logoFile", logoFile);
      if (fotoPortadaFile) formData.append("fotoPortadaFile", fotoPortadaFile);
      if (catalogoFile) formData.append("catalogoFile", catalogoFile);
      
      // Add gallery files
      galeriaFiles.forEach((file, index) => {
        formData.append(`galeriaFiles`, file);
      });

      // Add WordPress user if selected
      if (selectedWordPressUser) {
        formData.append("wordpressUser", JSON.stringify(selectedWordPressUser));
      }

      const response = await apiRequest(
        "PATCH",
        `/api/companies/${company?.id}`,
        formData,
      );
      
      return response.json();
    },
    onSuccess: async () => {
      // Actualizar las ubicaciones: filtrar vacías, eliminar existentes y crear nuevas
      const validLocations = companyLocations.filter(loc => 
        loc.address && loc.address.trim().length > 0
      );
      
      if (company?.id) {
        try {
          // Primero, eliminar todas las ubicaciones existentes
          const existingLocations = await fetch(`/api/companies/${company.id}/locations`);
          if (existingLocations.ok) {
            const locations = await existingLocations.json();
            for (const location of locations) {
              await apiRequest(
                "DELETE",
                `/api/companies/${company.id}/locations/${location.id}`,
              );
            }
          }
          
          // Luego, crear las nuevas ubicaciones válidas
          if (validLocations.length > 0) {
            // Asegurar que al menos una ubicación sea principal
            const hasPrincipal = validLocations.some(loc => loc.isPrincipal);
            
            for (let i = 0; i < validLocations.length; i++) {
              const location = validLocations[i];
              await apiRequest(
                "POST",
                `/api/companies/${company.id}/locations`,
                {
                  lat: location.lat,
                  lng: location.lng,
                  address: location.address,
                  country: location.country,
                  state: location.state,
                  city: location.city,
                  isPrincipal: hasPrincipal ? location.isPrincipal : (i === 0)
                },
              );
            }
          }
        } catch (error) {
          console.error('Error updating company locations:', error);
        }
      }
      
      toast({
        title: "Empresa actualizada",
        description: "La información de la empresa ha sido actualizada exitosamente",
      });
      // Invalidate general company lists
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/companies"] });
      // Invalidate the specific company data
      queryClient.invalidateQueries({ queryKey: ["/api/companies", company?.id] });
      // Invalidate representative dashboard that might show this company.
      // El dashboard usa claves tipo [`/api/representative/dashboard/${userId}`] (un solo string),
      // así que el prefijo por elementos no las alcanza; usamos un predicate.
      queryClient.invalidateQueries({
        predicate: (query) =>
          typeof query.queryKey[0] === 'string' &&
          query.queryKey[0].startsWith('/api/representative/dashboard'),
      });
      // Invalidate company locations for map updates
      queryClient.invalidateQueries({ queryKey: ["/api/companies/locations/all"] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      console.error("Error updating company:", error);
      toast({
        title: "Error al actualizar empresa",
        description: error.message || "Ocurrió un error inesperado",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CompanyFormData) => {
    console.log("🚀 SUBMIT EJECUTÁNDOSE - datos:", data);
    console.log("🔍 redesSociales en submit:", data.redesSociales);
    updateCompanyMutation.mutate(data);
  };

  // ✅ FUNCTION TO BYPASS REACT HOOK FORM IF NEEDED
  const handleDirectSubmit = () => {
    console.log("🔥🔥🔥 DIRECT SUBMIT - BYPASSING FORM VALIDATION");
    
    if (!company) {
      console.error("❌ Company data not available");
      return;
    }
    
    try {
      // Get current form values directly
      const formValues = form.getValues();
      console.log("📝 Form values from getValues():", formValues);

      // Create update payload using form values and company data as fallback
      const updateData: CompanyFormData = {
        id: company.id,
        nombreEmpresa: formValues.nombreEmpresa || company.nombreEmpresa || "",
        telefono1: formValues.telefono1 || company.telefono1 || "",
        telefono2: formValues.telefono2 || company.telefono2 || "",
        email1: formValues.email1 || company.email1 || "",
        email2: formValues.email2 || company.email2 || "",
        sitioWeb: formValues.sitioWeb || company.sitioWeb || "",
        direccionFisica: formValues.direccionFisica || company.direccionFisica || "",
        descripcionEmpresa: formValues.descripcionEmpresa || company.descripcionEmpresa || "",
        ubicacionGeografica: formValues.ubicacionGeografica || company.ubicacionGeografica || null,
        representantesVentas:
          typeof formValues.representantesVentas === "string"
            ? formValues.representantesVentas
            : typeof company.representantesVentas === "string"
              ? company.representantesVentas
              : "",
        catalogoDigitalUrl: formValues.catalogoDigitalUrl || company.catalogoDigitalUrl || "",
        categoriesIds: formValues.categoriesIds || (Array.isArray(company.categoriesIds) ? company.categoriesIds : []) || [],
        certificateIds: formValues.certificateIds || (Array.isArray(company.certificateIds) ? company.certificateIds : []) || [],
        tagIds: formValues.tagIds || (Array.isArray(company.tagIds) ? company.tagIds : []) || [],
        membershipTypeId: formValues.membershipTypeId || company.membershipTypeId || 1,
        membershipPeriodicidad: formValues.membershipPeriodicidad || company.membershipPeriodicidad || "",
        formaPago: formValues.formaPago || company.formaPago || "",
        fechaInicioMembresia: formValues.fechaInicioMembresia || company.fechaInicioMembresia || "",
        fechaFinMembresia: formValues.fechaFinMembresia || company.fechaFinMembresia || "",
        notasMembresia: formValues.notasMembresia || company.notasMembresia || "",
        redesSociales: formValues.redesSociales || (typeof company.redesSociales === 'object' ? company.redesSociales : {}) || {},
        videosUrls: formValues.videosUrls || (Array.isArray(company.videosUrls) ? company.videosUrls : []) || [],
        galeriaProductosUrls: formValues.galeriaProductosUrls || (Array.isArray(company.galeriaProductosUrls) ? company.galeriaProductosUrls : []) || [],
        logotipoUrl: formValues.logotipoUrl || company.logotipoUrl || "",
        fotoPortadaUrl: formValues.fotoPortadaUrl || company.fotoPortadaUrl || "",
      };

      console.log("📤 DIRECT SUBMIT - Sending to mutation:", updateData);
      updateCompanyMutation.mutate(updateData);
    } catch (error) {
      console.error("❌ DIRECT SUBMIT ERROR:", error);
    }
  };
  
  // DEBUG: Mostrar errores de validación
  console.log("❌ ERRORES DEL FORMULARIO:", form.formState.errors);
  console.log("📝 ESTADO DEL FORMULARIO:", form.formState);

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
            
            {/* DEBUG: Mostrar errores de validación */}
            {Object.keys(form.formState.errors).length > 0 && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                <strong>❌ ERRORES DE VALIDACIÓN:</strong>
                <pre className="mt-2 text-xs">
                  {JSON.stringify(form.formState.errors, null, 2)}
                </pre>
              </div>
            )}
            
            {/* INFORMACIÓN DEL USUARIO WORDPRESS (SI EXISTE) */}
            {company?.user && (
              <div className="bg-blue-100 p-4 rounded-lg border-2 border-blue-300 shadow-md">
                <div className="flex items-center gap-2 mb-3">
                  <User className="h-5 w-5 text-blue-600" />
                  <h4 className="font-bold text-blue-800">👤 Usuario Vinculado</h4>
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
                            🔗 Esta empresa está vinculada a este usuario como representante
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sección de transacciones - SOLUCIONADO: Visualizar transacciones */}
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

              {/* BUSCADOR DE WORDPRESS - UBICADO EN INFORMACIÓN DE CONTACTO */}
              <div className="bg-blue-100 p-4 rounded-lg border-2 border-blue-300 shadow-md">
                <div className="flex items-center gap-2 mb-3">
                  <ExternalLink className="h-5 w-5 text-blue-600" />
                  <h4 className="font-bold text-blue-800">🔗 Actualizar Usuario de WordPress</h4>
                </div>
                <p className="text-blue-700 mb-4 text-sm">
                  Busca y selecciona un usuario existente de WordPress para actualizar el representante de esta empresa. Los datos se actualizarán automáticamente.
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
                                // Auto-llenar campos
                                if (user.email) {
                                  form.setValue("email1", user.email);
                                }

                                // Auto-configurar campos de membresía
                                // Buscar "membresía empresarial" en los tipos de membresía
                                const membershipEmpresarial = membershipTypes.find(mt => 
                                  mt.nombrePlan?.toLowerCase().includes('empresarial')
                                );
                                if (membershipEmpresarial) {
                                  form.setValue("membershipTypeId", membershipEmpresarial.id);
                                }
                                form.setValue("membershipPeriodicidad", "anual");
                                form.setValue("formaPago", "otro");
                                
                                // Cargar transacciones del usuario seleccionado
                                if (user.id) {
                                  loadUserTransactions(user.id.toString());
                                }
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
                                <Button
                                  type="button"
                                  size="sm"
                                  className="bg-blue-600 hover:bg-blue-700"
                                >
                                  Seleccionar
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
                              ✨ Campos actualizados: Email, Enlace a perfil profesional, y configuración de membresía
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

                        {isLoadingTransactions ? (
                          <div className="text-center py-4 text-gray-500">
                            Cargando transacciones...
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
                                      <div>🔖 ID: {transaction.transaction_id || transaction.id}</div>
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
                            <div className="text-xs text-gray-500 text-center pt-2 border-t">
                              💡 Las fechas de membresía se actualizaron con la transacción más reciente
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-4 text-gray-500">
                            <div className="text-4xl mb-2">📄</div>
                            <div>No se encontraron transacciones válidas</div>
                            <div className="text-xs mt-1">
                              Solo se muestran transacciones completadas con fechas de vencimiento
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Nombre de la empresa */}
                <FormField
                  control={form.control}
                  name="nombreEmpresa"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre de la Empresa *</FormLabel>
                      <FormControl>
                        <Input placeholder="Ejemplo de Empresa Parques" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Teléfono principal */}
                <FormField
                  control={form.control}
                  name="telefono1"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Teléfono Principal *</FormLabel>
                      <FormControl>
                        <Input placeholder="Teléfono principal" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Teléfono secundario */}
                <FormField
                  control={form.control}
                  name="telefono2"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Teléfono Secundario</FormLabel>
                      <FormControl>
                        <Input placeholder="+52 55 8765 4321" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Email principal */}
                <FormField
                  control={form.control}
                  name="email1"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Principal *</FormLabel>
                      <FormControl>
                        <Input placeholder="contacto@empresa.com" type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Email secundario */}
                <FormField
                  control={form.control}
                  name="email2"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Secundario</FormLabel>
                      <FormControl>
                        <Input placeholder="ventas@empresa.com" type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Sitio Web */}
                <FormField
                  control={form.control}
                  name="sitioWeb"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Sitio Web</FormLabel>
                      <FormControl>
                        <Input placeholder="https://www.empresa.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Ubicaciones Geográficas - Múltiples */}
                <div className="md:col-span-2 mb-8">
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <MapPin className="h-5 w-5" />
                      Ubicaciones de la Empresa
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Agrega una o más ubicaciones físicas de tu empresa. La ubicación principal será la destacada en búsquedas y en el perfil.
                    </p>
                  </div>
                  <MultiLocationPicker
                    companyId={company?.id}
                    initialLocations={companyLocations}
                    onChange={(locations) => {
                      setCompanyLocations(locations);
                      // Actualizar direccionFisica con la ubicación principal
                      const principalLocation = locations.find(loc => loc.isPrincipal);
                      if (principalLocation && principalLocation.address) {
                        form.setValue("direccionFisica", principalLocation.address);
                      }
                    }}
                  />
                </div>

                {/* Email adicional */}
                <FormField
                  control={form.control}
                  name="email2"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Adicional</FormLabel>
                      <FormControl>
                        <Input placeholder="email2@empresa.com" type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Teléfono adicional */}
                <FormField
                  control={form.control}
                  name="telefono2"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Teléfono Adicional</FormLabel>
                      <FormControl>
                        <Input placeholder="+52 55 1234 5679" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Representantes de ventas */}
                <FormField
                  control={form.control}
                  name="representantesVentas"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Enlaces a Perfiles Profesionales</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Enlaces a perfiles de PeepSo, LinkedIn, etc. (uno por línea)"
                          className="min-h-[80px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Sección: Información de la Empresa */}
            <div className="space-y-6">
              <div className="border-b pb-4">
                <h3 className="text-lg font-semibold text-primary">Información de la Empresa</h3>
                <p className="text-sm text-gray-600">Multimedia y contenido de la empresa</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Logotipo con drag and drop */}
                <div className="md:col-span-2">
                  <FormLabel>Logotipo de la Empresa</FormLabel>
                  <div
                    className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary transition-colors"
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files[0];
                      if (file && file.type.startsWith('image/')) {
                        setLogoFile(file);
                        const reader = new FileReader();
                        reader.onload = (e) => {
                          setLogoPreview(e.target?.result as string);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    onDragOver={(e) => e.preventDefault()}
                  >
                    {logoPreview ? (
                      <div className="relative">
                        <img
                          src={logoPreview}
                          alt="Preview"
                          className="max-h-32 mx-auto rounded-lg"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="absolute top-2 right-2"
                          onClick={() => {
                            setLogoFile(null);
                            setLogoPreview("");
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <Upload className="h-12 w-12 text-gray-400 mx-auto" />
                        <div>
                          <p className="text-sm text-gray-600">
                            Arrastra y suelta tu logotipo aquí, o{" "}
                            <label className="text-primary cursor-pointer hover:underline">
                              selecciona un archivo
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file && file.type.startsWith('image/')) {
                                    setLogoFile(file);
                                    const reader = new FileReader();
                                    reader.onload = (e) => {
                                      setLogoPreview(e.target?.result as string);
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                }}
                              />
                            </label>
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Formatos: JPG, PNG, GIF (máx. 2 MB)
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Foto de Portada con drag and drop */}
                <div className="md:col-span-2">
                  <FormLabel>Foto de Portada de la Empresa</FormLabel>
                  <div
                    className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary transition-colors"
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files[0];
                      if (file && file.type.startsWith('image/')) {
                        setFotoPortadaFile(file);
                        const reader = new FileReader();
                        reader.onload = (e) => {
                          setFotoPortadaPreview(e.target?.result as string);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    onDragOver={(e) => e.preventDefault()}
                  >
                    {fotoPortadaPreview ? (
                      <div className="relative">
                        <img
                          src={fotoPortadaPreview}
                          alt="Preview Portada"
                          className="max-h-40 w-full object-cover mx-auto rounded-lg"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="absolute top-2 right-2"
                          onClick={() => {
                            setFotoPortadaFile(null);
                            setFotoPortadaPreview("");
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <Upload className="h-12 w-12 text-gray-400 mx-auto" />
                        <div>
                          <p className="text-sm text-gray-600">
                            Arrastra y suelta tu foto de portada aquí, o{" "}
                            <label className="text-primary cursor-pointer hover:underline">
                              selecciona un archivo
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file && file.type.startsWith('image/')) {
                                    setFotoPortadaFile(file);
                                    const reader = new FileReader();
                                    reader.onload = (e) => {
                                      setFotoPortadaPreview(e.target?.result as string);
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                }}
                              />
                            </label>
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Imagen para mostrar como banner principal de la empresa<br />
                            Formatos: JPG, PNG, GIF (máx. 2 MB) - Recomendado: 1200x400px
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Videos dinámicos */}
                <div className="md:col-span-2 space-y-4">
                  <div className="flex items-center justify-between">
                    <FormLabel>Videos de la Empresa</FormLabel>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addVideo}
                      disabled={videosUrls.length >= 5}
                      className="flex items-center gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Agregar Video ({videosUrls.length}/5)
                    </Button>
                  </div>
                  
                  {videosUrls.map((video, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        placeholder="https://youtube.com/watch?v=..."
                        value={video}
                        onChange={(e) => updateVideo(index, e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeVideo(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  
                  {videosUrls.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No hay videos agregados. Haz clic en "Agregar Video" para añadir enlaces de YouTube, Vimeo, etc.
                    </p>
                  )}
                </div>
              </div>
              
              <FormField
                control={form.control}
                name="descripcionEmpresa"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descripción de la Empresa *</FormLabel>
                    <FormDescription>
                      Describe los servicios, productos y experiencia de tu empresa
                    </FormDescription>
                    <FormControl>
                      <RichTextEditor
                        value={field.value || ""}
                        onChange={field.onChange}
                        placeholder="Describe tu empresa, servicios principales, experiencia en el mercado..."
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
                    <FormLabel>Categorías *</FormLabel>
                    <FormDescription>
                      Selecciona las categorías que mejor describan tu empresa
                    </FormDescription>
                    <FormControl>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {categories.map((category) => (
                          <div
                            key={category.id}
                            className={`border-2 rounded-lg p-3 cursor-pointer transition-all hover:bg-gray-50 ${
                              field.value?.includes(category.id)
                                ? "border-primary bg-primary/5"
                                : "border-gray-200"
                            }`}
                            onClick={() => {
                              const currentValues = field.value || [];
                              const newValues = currentValues.includes(category.id)
                                ? currentValues.filter(id => id !== category.id)
                                : [...currentValues, category.id];
                              field.onChange(newValues);
                            }}
                          >
                            <div className="flex flex-col items-center text-center space-y-2">
                              {renderCategoryIcon(category)}
                              <span className="text-sm font-medium">{category.nombreCategoria}</span>
                            </div>
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
                      Selecciona etiquetas que describan mejor tus productos y servicios
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

              {/* Galería de Productos - SOLUCIONADO: Cargar imágenes existentes */}
              <div>
                <FormLabel>Galería de Productos</FormLabel>
                <FormDescription>
                  Sube imágenes de tus productos (máximo 10 imágenes)
                  {currentMembershipType && (
                    <MembershipLimitsDisplay
                      membershipType={currentMembershipType}
                      productCount={galeriaPreviews.length}
                      projectCount={0}
                      className="mt-2"
                    />
                  )}
                </FormDescription>
                <div className="mt-2">
                  {galeriaPreviews.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-4">
                      {galeriaPreviews.map((preview, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={preview}
                            alt={`Producto ${index + 1}`}
                            className="w-full h-32 object-cover rounded-lg border border-gray-200"
                          />
                          <button
                            type="button"
                            onClick={() => removeGaleriaImage(index)}
                            className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div
                    className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors"
                    onDrop={handleGaleriaDrop}
                    onDragOver={(e) => e.preventDefault()}
                  >
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
                  </div>
                </div>
              </div>
            </div>

            {/* Redes Sociales - SOLUCIONADO: Mostrar el tipo correcto en todas las opciones */}
            <div className="space-y-6">
              <div className="border-b pb-4">
                <h3 className="text-lg font-semibold text-primary">Redes Sociales y Multimedia</h3>
                <p className="text-sm text-gray-600">Enlaces a redes sociales y contenido multimedia</p>
              </div>
              
              <div>
                <FormLabel>Redes Sociales</FormLabel>
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div>
                    <FormLabel>Facebook</FormLabel>
                    <Input
                      placeholder="https://facebook.com/..."
                      value={redesSociales.facebook || ''}
                      onChange={(e) => updateRedSocial('facebook', e.target.value)}
                    />
                  </div>
                  <div>
                    <FormLabel>Instagram</FormLabel>
                    <Input
                      placeholder="https://instagram.com/..."
                      value={redesSociales.instagram || ''}
                      onChange={(e) => updateRedSocial('instagram', e.target.value)}
                    />
                  </div>
                  <div>
                    <FormLabel>X</FormLabel>
                    <Input
                      placeholder="https://x.com/..."
                      value={redesSociales.twitter || ''}
                      onChange={(e) => updateRedSocial('twitter', e.target.value)}
                    />
                  </div>
                  <div>
                    <FormLabel>LinkedIn</FormLabel>
                    <Input
                      placeholder="https://linkedin.com/..."
                      value={redesSociales.linkedin || ''}
                      onChange={(e) => updateRedSocial('linkedin', e.target.value)}
                    />
                  </div>
                  <div>
                    <FormLabel>YouTube</FormLabel>
                    <Input
                      placeholder="https://youtube.com/..."
                      value={redesSociales.youtube || ''}
                      onChange={(e) => updateRedSocial('youtube', e.target.value)}
                    />
                  </div>
                  <div>
                    <FormLabel>WhatsApp</FormLabel>
                    <Input
                      placeholder="https://wa.me/..."
                      value={redesSociales.whatsapp || ''}
                      onChange={(e) => updateRedSocial('whatsapp', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Catálogo Digital - SOLUCIONADO: Drag and drop */}
              <div>
                <FormLabel>Catálogo Digital</FormLabel>
                <FormDescription>
                  Sube un PDF con el catálogo de productos de tu empresa
                </FormDescription>
                <div
                  className="mt-2 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors cursor-pointer"
                  onDrop={handleCatalogoDrop}
                  onDragOver={handleCatalogoDragOver}
                  onClick={() => document.getElementById('catalogo-input')?.click()}
                >
                  {catalogoFile ? (
                    <div className="flex items-center justify-center gap-3">
                      <FileText className="h-8 w-8 text-red-500" />
                      <div>
                        <p className="font-medium">{catalogoFile.name}</p>
                        <p className="text-sm text-gray-500">
                          {(catalogoFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCatalogoFile(null);
                          form.setValue("catalogoDigitalUrl", "");
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : form.watch("catalogoDigitalUrl") ? (
                    <div className="flex items-center justify-center gap-3">
                      <FileText className="h-8 w-8 text-red-500" />
                      <div>
                        <p className="font-medium">Catálogo actual</p>
                        <p className="text-sm text-gray-500">
                          {form.watch("catalogoDigitalUrl")}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <FileText className="h-12 w-12 text-gray-400 mx-auto" />
                      <div>
                        <p className="text-sm text-gray-600">
                          Arrastra y suelta tu catálogo PDF aquí, o{" "}
                          <span className="text-primary cursor-pointer hover:underline">
                            selecciona archivo
                          </span>
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Solo archivos PDF • Máximo 10MB
                        </p>
                      </div>
                    </div>
                  )}
                  <input
                    id="catalogo-input"
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={handleCatalogoSelect}
                  />
                </div>
              </div>
            </div>

            {/* Certificados - oculto a petición del cliente (los valores se conservan al guardar) */}
            <div className="hidden space-y-6">
              <div className="border-b pb-4">
                <h3 className="text-lg font-semibold text-primary">Certificados y Reconocimientos</h3>
                <p className="text-sm text-gray-600">Certificados que respaldan la calidad de la empresa</p>
              </div>
              
              <FormField
                control={form.control}
                name="certificateIds"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Certificados y Reconocimientos</FormLabel>
                    <FormDescription>
                      Selecciona los certificados que posee tu empresa
                    </FormDescription>
                    <FormControl>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {certificates.map((certificate) => (
                          <div
                            key={certificate.id}
                            className={`border-2 rounded-lg p-4 cursor-pointer transition-all hover:bg-gray-50 ${
                              field.value?.includes(certificate.id)
                                ? "border-primary bg-primary/5"
                                : "border-gray-200"
                            }`}
                            onClick={() => {
                              const currentValues = field.value || [];
                              const newValues = currentValues.includes(certificate.id)
                                ? currentValues.filter(id => id !== certificate.id)
                                : [...currentValues, certificate.id];
                              field.onChange(newValues);
                            }}
                          >
                            <div className="flex items-start space-x-3">
                              {field.value?.includes(certificate.id) ? (
                                <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                              ) : (
                                <div className="h-5 w-5 border-2 border-gray-300 rounded mt-0.5 flex-shrink-0" />
                              )}
                              <div className="flex-1">
                                <h4 className="font-medium text-sm">{certificate.nombreCertificado}</h4>
                                {certificate.descripcion && (
                                  <p className="text-xs text-gray-600 mt-1">{certificate.descripcion}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Sección: Información de Membresía - SOLUCIONADO: Mostrar límites según el plan */}
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
                        <FormControl>
                          <Select value={field.value?.toString()} onValueChange={(value) => field.onChange(parseInt(value))}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Selecciona tipo de membresía" />
                            </SelectTrigger>
                            <SelectContent>
                              {membershipTypes.map((type) => (
                                <SelectItem key={type.id} value={type.id.toString()}>
                                  <div className="flex items-center gap-2">
                                    <Crown className="h-4 w-4 text-yellow-500" />
                                    {type.nombrePlan}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="membershipPeriodicidad"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Periodicidad</FormLabel>
                        <FormControl>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona periodicidad" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="mensual">Mensual</SelectItem>
                              <SelectItem value="trimestral">Trimestral</SelectItem>
                              <SelectItem value="semestral">Semestral</SelectItem>
                              <SelectItem value="anual">Anual</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="fechaInicioMembresia"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fecha de Inicio</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
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
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Mostrar límites del plan seleccionado */}
                {currentMembershipType && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                      <Crown className="h-4 w-4" />
                      Límites del Plan: {currentMembershipType.nombrePlan}
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="bg-white p-3 rounded border">
                        <div className="font-medium text-gray-700">Productos</div>
                        <div className="text-lg font-bold text-blue-600">
                          {currentMembershipType.cantidadProductosAdmitidos === -1 ? "Sin límite" : (currentMembershipType.cantidadProductosAdmitidos || "Sin límite")}
                        </div>
                      </div>
                      <div className="bg-white p-3 rounded border">
                        <div className="font-medium text-gray-700">Proyectos</div>
                        <div className="text-lg font-bold text-blue-600">
                          {currentMembershipType.cantidadProyectosAdmitidos === -1 ? "Sin límite" : (currentMembershipType.cantidadProyectosAdmitidos || "Sin límite")}
                        </div>
                      </div>
                      <div className="bg-white p-3 rounded border">
                        <div className="font-medium text-gray-700">Fotos</div>
                        <div className="text-lg font-bold text-blue-600">
                          {currentMembershipType.cantidadProductosAdmitidos === -1 ? "Sin límite" : (currentMembershipType.cantidadProductosAdmitidos || "Sin límite")}
                        </div>
                      </div>
                      <div className="bg-white p-3 rounded border">
                        <div className="font-medium text-gray-700">Visibilidad</div>
                        <div className="text-lg font-bold text-blue-600 capitalize">
                          {currentMembershipType.visibilidad}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Botones de acción */}
            <div className="flex justify-end space-x-4 pt-6 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button 
                type="button" 
                disabled={updateCompanyMutation.isPending}
                className="bg-primary hover:bg-primary/90"
                onClick={(e) => {
                  console.log("🔥🔥🔥 BOTÓN CLICKED - USANDO DIRECT SUBMIT");
                  e.preventDefault(); // Prevent any form submission
                  handleDirectSubmit(); // Use our direct submit function
                }}
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