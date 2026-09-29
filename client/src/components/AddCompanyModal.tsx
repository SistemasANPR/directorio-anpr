import { useState, useCallback, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCurrency } from "@/lib/currency";
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
import { insertCompanySchema, Category, MembershipType, Certificate } from "@shared/schema";
import TagSelector from "@/components/TagSelector";
import MembershipLimitsDisplay from "@/components/MembershipLimitsDisplay";
import { paisesAmericaLatina, estadosMexico, ciudadesPorEstado } from "@/lib/locationData";
import { 
  Upload, X, Building, Phone, Mail, Plus, FileText, Trash2, Facebook, Instagram, Linkedin, Twitter, Youtube, Globe, MapPin,
  Tags, Building2, Car, Truck, Hammer, Factory, Cpu, Wrench, ShoppingBag,
  Briefcase, Heart, GraduationCap, Home, Coffee, Camera, Music,
  Gamepad2, Book, Palette, Plane, Ship, Train, Zap, Crown, Search, User, Check, ExternalLink, MessageCircle
} from "lucide-react";
import MapLocationPicker from "./MapLocationPicker";
import MultiLocationPicker from "./MultiLocationPicker";
import RichTextEditor from "./RichTextEditor";

const companySchema = insertCompanySchema.extend({
  telefono1: z.string().optional(),
  telefono2: z.string().optional(),
  email1: z.string().email("Email inválido"),
  email2: z.string().optional(),
  nombreEmpresa: z.string().min(1, "El nombre de la empresa es requerido"),
  sitioWeb: z.string().url("URL inválida").optional().or(z.literal("")),
  catalogoDigitalUrl: z.string().optional().or(z.literal("")),
  videosUrls: z.array(z.string()).optional(),
  categoriesIds: z.array(z.number()).optional(),
  tagIds: z.array(z.number()).optional(),
  certificateIds: z.array(z.number()).optional(),
  redesSociales: z.array(z.object({
    plataforma: z.string().min(1, "Selecciona una plataforma"),
    url: z.string().url("URL inválida"),
  })).optional(),
  direccionFisica: z.string().optional(),
  ubicacionGeografica: z.any().optional(),
  // Campos de membresía
  membershipTypeId: z.number().optional().nullable(),
  membershipPeriodicidad: z.enum(["mensual", "anual"]).optional(),
  formaPago: z.enum(["efectivo", "transferencia", "otro"]).optional(),
  fechaInicioMembresia: z.string().optional(),
  fechaFinMembresia: z.string().optional(),
  notasMembresia: z.string().optional(),
});

type CompanyFormData = z.infer<typeof companySchema>;

// Map of icon names to components
const iconMap = {
  Tags, Building2, Car, Truck, Hammer, Factory, Cpu, Wrench, ShoppingBag,
  Briefcase, Heart, GraduationCap, Home, Coffee, Camera, Music,
  Gamepad2, Book, Palette, MapPin, Plane, Ship, Train, Zap
};

interface AddCompanyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AddCompanyModal({ open, onOpenChange }: AddCompanyModalProps) {
  const { format: formatMoney } = useCurrency();
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

  const [direccionesPorCiudad, setDireccionesPorCiudad] = useState<{[ciudad: string]: string}>({});
  const [ubicacionesPorCiudad, setUbicacionesPorCiudad] = useState<{[ciudad: string]: { lat: number; lng: number; address: string }}>({});
  const [videosUrls, setVideosUrls] = useState<string[]>([]);
  
  // Estados para buscador de WordPress
  const [wordPressUserSearch, setWordPressUserSearch] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [selectedWordPressUser, setSelectedWordPressUser] = useState<any>(null);
  const [isLoadingWordPressUsers, setIsLoadingWordPressUsers] = useState(false);
  const [wordPressUsers, setWordPressUsers] = useState<any[]>([]);
  const [canAddProducts, setCanAddProducts] = useState(true);
  const [canAddProjects, setCanAddProjects] = useState(true);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  
  // Estados para transacciones de WordPress
  const [userTransactions, setUserTransactions] = useState<any[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const { toast, dismiss } = useToast();
  
  // Estado para ubicaciones múltiples
  const [companyLocations, setCompanyLocations] = useState<any[]>([]);
  
  // Ref para trackear el estado anterior del modal
  const previousOpenRef = useRef(open);

  // Función para cargar transacciones de un usuario
  const loadUserTransactions = async (userId: string) => {
    setIsLoadingTransactions(true);
    try {
      const response = await fetch(`/api/wordpress-user-transactions/${userId}`);
      if (response.ok) {
        const data = await response.json();
        setUserTransactions(data.transactions || []);
        
        // Buscar la transacción activa primero, luego la más reciente con fechas
        const activeTransaction = data.active_transaction;
        const transactionToUse = activeTransaction || data.transactions?.find((t: any) => t.expires_at);
        
        if (transactionToUse && transactionToUse.expires_at) {
          const expirationDate = new Date(transactionToUse.expires_at).toISOString().split('T')[0];
          form.setValue("fechaFinMembresia", expirationDate);
          
          // Usar fecha de inicio real si está disponible, sino usar created_at
          if (transactionToUse.starts_at) {
            const startDate = new Date(transactionToUse.starts_at).toISOString().split('T')[0];
            form.setValue("fechaInicioMembresia", startDate);
          } else if (transactionToUse.created_at) {
            const startDate = new Date(transactionToUse.created_at).toISOString().split('T')[0];
            form.setValue("fechaInicioMembresia", startDate);
          }
          
          toast({
            title: "Fechas de membresía actualizadas",
            description: activeTransaction 
              ? `Se encontró una membresía activa: ${transactionToUse.membership_name}`
              : `Se establecieron las fechas basadas en la transacción más reciente`,
          });
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

  // Function to render the correct icon for categories
  const renderCategoryIcon = (category: Category) => {
    // If custom icon URL exists, use it
    if (category.iconoUrl) {
      return (
        <img
          src={category.iconoUrl}
          alt={category.nombreCategoria}
          className="w-5 h-5 object-cover rounded"
        />
      );
    }

    // Otherwise use Lucide icon
    const iconName = category.icono || "Tags";
    const IconComponent = iconMap[iconName as keyof typeof iconMap] || Tags;
    return <IconComponent className="w-5 h-5 text-primary" />;
  };

  // Plataformas de redes sociales disponibles
  const socialPlatforms = [
    { name: "Facebook", icon: Facebook },
    { name: "Instagram", icon: Instagram },
    { name: "LinkedIn", icon: Linkedin },
    { name: "X", icon: Twitter },
    { name: "YouTube", icon: Youtube },
    { name: "WhatsApp", icon: MessageCircle },
  ];

  const form = useForm<CompanyFormData>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      nombreEmpresa: "",
      telefono1: "",
      telefono2: "",
      email1: "",
      email2: "",
      sitioWeb: "",
      videosUrls: [],
      descripcionEmpresa: "",
      direccionFisica: "",
      categoriesIds: [],
      tagIds: [],
      certificateIds: [],
      redesSociales: [],
      membershipTypeId: undefined,
      membershipPeriodicidad: undefined,
      formaPago: undefined,
      fechaInicioMembresia: new Date().toISOString().split('T')[0], // Fecha actual
      fechaFinMembresia: "",
      notasMembresia: "",
      // CRITICAL FIX: Add ubicacionGeografica to default values
      ubicacionGeografica: null,
    },
  });

  // Reset form and set current date when modal opens (SOLO cuando pasa de cerrado a abierto)
  useEffect(() => {
    // Solo resetear cuando el modal transiciona de cerrado (false) a abierto (true)
    const justOpened = !previousOpenRef.current && open;
    const justClosed = previousOpenRef.current && !open;
    
    if (justOpened) {
      // El modal ACABA de abrirse - resetear el formulario
      const currentDate = new Date().toISOString().split('T')[0];
      form.reset({
        nombreEmpresa: "",
        email1: "",
        telefono1: "",
        sitioWeb: "",
        videosUrls: [],
        descripcionEmpresa: "",
        direccionFisica: "",
        categoriesIds: [],
        tagIds: [],
        certificateIds: [],
        redesSociales: [],
        membershipTypeId: undefined,
        membershipPeriodicidad: undefined,
        formaPago: undefined,
        fechaInicioMembresia: currentDate,
        fechaFinMembresia: "",
        notasMembresia: "",
        ubicacionGeografica: null,
      });
      
      // Reset all state variables
      setLogoFile(null);
      setLogoPreview("");
      setFotoPortadaFile(null);
      setFotoPortadaPreview("");
      setSelectedEstados([]);
      setSelectedCiudades([]);
      setCatalogoFile(null);
      setRedesSociales([]);
      setGaleriaFiles([]);
      setGaleriaPreviews([]);
      setDireccionesPorCiudad({});
      setUbicacionesPorCiudad({});
      setVideosUrls([]);
    } else if (justClosed) {
      // El modal ACABA de cerrarse - limpiar toasts y búsqueda
      dismiss();
      setWordPressUserSearch("");
      setDebouncedSearchTerm("");
      setSelectedWordPressUser(null);
      setWordPressUsers([]);
      setIsLoadingWordPressUsers(false);
    }
    
    // Actualizar el ref para el siguiente render
    previousOpenRef.current = open;
  }, [open, form, dismiss]);

  // Function to calculate end date automatically
  const calculateEndDate = (startDate: string, periodicidad: string) => {
    if (!startDate || !periodicidad) return "";
    
    const start = new Date(startDate);
    const end = new Date(start);
    
    if (periodicidad.toLowerCase() === "mensual") {
      end.setMonth(end.getMonth() + 1);
    } else if (periodicidad.toLowerCase() === "anual") {
      end.setFullYear(end.getFullYear() + 1);
    }
    
    return end.toISOString().split('T')[0];
  };

  // Watch for changes in membership fields to auto-calculate dates
  const watchedFechaInicio = form.watch("fechaInicioMembresia");
  const watchedPeriodicidad = form.watch("membershipPeriodicidad");
  const watchedMembershipTypeId = form.watch("membershipTypeId");

  useEffect(() => {
    if (watchedFechaInicio && watchedPeriodicidad) {
      const endDate = calculateEndDate(watchedFechaInicio, watchedPeriodicidad);
      form.setValue("fechaFinMembresia", endDate, { shouldValidate: false, shouldDirty: false });
    }
    // Removed form from dependencies to avoid unnecessary re-renders
  }, [watchedFechaInicio, watchedPeriodicidad]);

  // Debounce effect para evitar búsquedas mientras el usuario escribe
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(wordPressUserSearch);
    }, 400); // 400ms de delay

    return () => {
      clearTimeout(timer);
    };
  }, [wordPressUserSearch]);

  // Función para buscar usuarios de WordPress (usando el término debounced)
  useEffect(() => {
    if (debouncedSearchTerm.length >= 3) {
      setIsLoadingWordPressUsers(true);
      
      fetch('/api/wordpress-users')
        .then(response => response.json())
        .then(data => {
          const searchLower = debouncedSearchTerm.toLowerCase();
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
  }, [debouncedSearchTerm]);

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: membershipTypes = [] } = useQuery<MembershipType[]>({
    queryKey: ["/api/membership-types"], // Admin component - can see all membership types
  });

  const { data: certificates = [] } = useQuery<Certificate[]>({
    queryKey: ["/api/certificates"],
  });

  const { data: tags = [] } = useQuery<any[]>({
    queryKey: ["/api/tags"],
  });

  // Get the selected membership type to use its limits
  const selectedMembershipType = membershipTypes.find(type => type.id === watchedMembershipTypeId);
  
  // Calculate dynamic limits based on selected plan
  const maxProductImages = selectedMembershipType?.cantidadProductosAdmitidos === -1 
    ? Infinity 
    : (selectedMembershipType?.cantidadProductosAdmitidos || 10);
  
  const maxProjects = selectedMembershipType?.cantidadProyectosAdmitidos === -1 
    ? Infinity 
    : (selectedMembershipType?.cantidadProyectosAdmitidos || 5);

  // Auto-load certificates when membership type changes
  useEffect(() => {
    if (watchedMembershipTypeId && certificates.length > 0) {
      // Find certificates assigned to this membership plan
      const membershipCertificates = certificates.filter(cert => {
        if (!cert.membershipPlanIds) return false;
        
        // Handle both array and string JSON formats
        let planIds = [];
        try {
          if (typeof cert.membershipPlanIds === 'string') {
            planIds = JSON.parse(cert.membershipPlanIds);
          } else if (Array.isArray(cert.membershipPlanIds)) {
            planIds = cert.membershipPlanIds;
          }
          return planIds.includes(watchedMembershipTypeId);
        } catch (error) {
          console.error('Error parsing membershipPlanIds:', error);
          return false;
        }
      });

      // Set the certificate IDs in the form
      const certificateIds = membershipCertificates.map(cert => cert.id);
      form.setValue("certificateIds", certificateIds, { shouldValidate: false, shouldDirty: false });
      
      // Show toast notification if certificates were loaded
      if (certificateIds.length > 0) {
        toast({
          title: "Certificados cargados",
          description: `Se han cargado ${certificateIds.length} certificado(s) del plan seleccionado.`,
        });
      }
    }
    // Removed form and toast from dependencies to avoid unnecessary re-renders
  }, [watchedMembershipTypeId, certificates]);

  // Note: Location fields removed from schema, keeping only direccionFisica and ubicacionGeografica

  // Location sync effects removed - only using direccionFisica and ubicacionGeografica now

  const createCompanyMutation = useMutation({
    mutationFn: async (data: CompanyFormData) => {
      // DEBUG: Log ubicacionGeografica to check if it's being captured
      console.log("[DEBUG] FormData before processing:", {
        ubicacionGeografica: data.ubicacionGeografica,
        ubicacionGeograficaType: typeof data.ubicacionGeografica,
        allFormData: data
      });
      
      // Crear FormData para enviar archivos
      const formData = new FormData();
      
      // CRITICAL FIX: Proper FormData serialization for objects and arrays
      Object.entries(data).forEach(([key, value]) => {
        // Skip catalogoDigitalUrl if we have a new file to upload
        // (the backend will generate the correct URL from the uploaded file)
        if (key === 'catalogoDigitalUrl' && catalogoFile) {
          return;
        }
        
        if (Array.isArray(value)) {
          formData.append(key, JSON.stringify(value));
        } else if (typeof value === 'object' && value !== null) {
          // CRITICAL FIX: Serialize objects as JSON instead of "[object Object]"
          const jsonValue = JSON.stringify(value);
          formData.append(key, jsonValue);
          // DEBUG: Log ubicacionGeografica serialization specifically
          if (key === 'ubicacionGeografica') {
            console.log("[DEBUG] ubicacionGeografica serialized:", {
              originalValue: value,
              serializedValue: jsonValue
            });
          }
        } else if (value !== undefined && value !== null) {
          formData.append(key, value.toString());
        }
      });
      
      // Agregar archivos
      if (logoFile) formData.append("logoFile", logoFile);
      if (fotoPortadaFile) formData.append("fotoPortadaFile", fotoPortadaFile);
      if (catalogoFile) formData.append("catalogoFile", catalogoFile);
      
      // Agregar archivos de galería
      galeriaFiles.forEach((file) => {
        formData.append(`galeriaFiles`, file);
      });

      // Agregar usuario de WordPress si existe
      if (selectedWordPressUser) {
        formData.append("wordpressUser", JSON.stringify(selectedWordPressUser));
      }

      const response = await apiRequest(
        "POST",
        "/api/companies/with-files",
        formData,
      );
      
      return response.json();
    },
    onSuccess: async (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/statistics"] });
      
      // Guardar las ubicaciones si existen - filtrar ubicaciones vacías o sin dirección válida
      console.log('📍 companyLocations al guardar:', JSON.stringify(companyLocations, null, 2));
      
      const validLocations = companyLocations.filter(loc => 
        loc.address && loc.address.trim().length > 0
      );
      
      console.log('📍 validLocations después de filtrar:', JSON.stringify(validLocations, null, 2));
      
      if (validLocations.length > 0 && data.id) {
        try {
          // Asegurar que al menos una ubicación sea principal
          const hasPrincipal = validLocations.some(loc => loc.isPrincipal);
          
          for (let i = 0; i < validLocations.length; i++) {
            const location = validLocations[i];
            await apiRequest(
              "POST",
              `/api/companies/${data.id}/locations`,
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
          // Invalidate company locations for map updates
          queryClient.invalidateQueries({ queryKey: ["/api/companies/locations/all"] });
        } catch (error) {
          console.error('Error saving company locations:', error);
        }
      }
      
      // Also invalidate locations cache even if no locations were saved (company with ubicacionGeografica)
      queryClient.invalidateQueries({ queryKey: ["/api/companies/locations/all"] });
      
      // Si se creó un nuevo usuario desde WordPress, mostrar la contraseña temporal
      if (data.newUserCreated) {
        toast({
          title: "Éxito - Usuario creado",
          description: (
            <div className="space-y-2">
              <p>Empresa registrada correctamente</p>
              <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
                <p className="font-semibold">Nuevo representante creado:</p>
                <p className="text-sm">Email: {data.newUserCreated.email}</p>
                <p className="text-sm">Nombre: {data.newUserCreated.displayName}</p>
                <p className="text-sm font-bold text-red-600 dark:text-red-400">
                  Contraseña temporal: {data.newUserCreated.tempPassword}
                </p>
                <p className="text-xs mt-1 text-gray-600 dark:text-gray-400">
                  ⚠️ Guarda esta contraseña - el usuario deberá cambiarla en su primer inicio de sesión
                </p>
              </div>
            </div>
          ),
          duration: 15000, // 15 segundos para dar tiempo a copiar la contraseña
        });
      } else {
        toast({
          title: "Éxito",
          description: "Empresa registrada correctamente",
        });
      }
      
      onOpenChange(false);
      form.reset();
      setLogoFile(null);
      setLogoPreview("");
      setFotoPortadaFile(null);
      setFotoPortadaPreview("");
      setSelectedEstados([]);
      setSelectedCiudades([]);
      setVideosUrls([]);
      setGaleriaFiles([]);
      setGaleriaPreviews([]);
      setDireccionesPorCiudad({});
      setUbicacionesPorCiudad({});
      setCompanyLocations([]);
    },
    onError: (error) => {
      console.error("Error en onError:", error);
      toast({
        title: "Error",
        description: `No se pudo registrar la empresa: ${error.message || 'Error desconocido'}`,
        variant: "destructive",
        duration: 5000, // Auto-cerrar después de 5 segundos
      });
    },
  });

  const onSubmit = async (data: CompanyFormData) => {
    // Verificar límites antes de enviar
    if (selectedCompanyId && galeriaFiles.length > 0 && !canAddProducts) {
      toast({
        title: "Error en validación de límites",
        description: "Has excedido los límites de productos de tu plan de membresía. Reduce el número de productos o actualiza tu plan.",
        variant: "destructive",
        duration: 5000,
      });
      return;
    }

    try {
      // Filtrar y validar videos
      const videosValidos = videosUrls
        .filter(video => video && video.trim() !== "")
        .filter(video => {
          try {
            new URL(video);
            return true;
          } catch {
            return false;
          }
        });

      // Combinar direcciones adicionales si existen
      let direccionCompleta = data.direccionFisica || "";
      const direccionesAdicionales = Object.entries(direccionesPorCiudad)
        .filter(([_, direccion]) => direccion && direccion.trim())
        .map(([ciudad, direccion]) => `${ciudad}: ${direccion}`)
        .join("; ");
      
      if (direccionesAdicionales) {
        direccionCompleta = direccionCompleta 
          ? `${direccionCompleta}; ${direccionesAdicionales}`
          : direccionesAdicionales;
      }

      // DEBUG: Log raw form data before processing
      console.log("[DEBUG] Raw form data in onSubmit:", {
        ubicacionGeografica: data.ubicacionGeografica,
        ubicacionGeograficaExists: !!data.ubicacionGeografica,
        ubicacionGeograficaType: typeof data.ubicacionGeografica
      });
      
      // Filtrar redes sociales que tengan tanto plataforma como URL
      const redesSocialesValidas = redesSociales.filter(
        red => red.plataforma && red.plataforma.trim() !== "" && red.url && red.url.trim() !== ""
      );

      const companyData = {
        ...data,
        // Convertir membershipTypeId a null si es undefined o string vacío
        membershipTypeId: data.membershipTypeId && typeof data.membershipTypeId === 'number' ? data.membershipTypeId : null,
        videosUrls: videosValidos,
        // FIXED: Use the actual ubicacionGeografica from the form field, not computed value
        ubicacionGeografica: data.ubicacionGeografica,
        direccionFisica: direccionCompleta,

        // Agregar galería de productos
        galeriaProductosUrls: galeriaPreviews,
        // Agregar redes sociales válidas
        redesSociales: redesSocialesValidas,
        // Agregar logo si existe
        logotipoUrl: logoPreview || null,
        // Agregar foto de portada si existe
        fotoPortadaUrl: fotoPortadaPreview || null,
        // NOTA: wordpressUser NO se incluye aquí. Se agrega una sola vez al FormData
        // en el mutationFn (append dedicado). Incluirlo también aquí provocaba un
        // doble-append: Express/multer colapsa los campos duplicados en un array,
        // el JSON.parse del servidor fallaba y el representante quedaba "Sin asignar".
      };
      
      createCompanyMutation.mutate(companyData);
    } catch (error) {
      console.error("Error al procesar datos de la empresa:", error);
    }
  };

  // Manejo del logo con drag and drop
  const handleLogoDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      if (!validateImage(file)) return;
      
      try {
        const imageUrl = await uploadImageToServer(file);
        setLogoFile(file);
        setLogoPreview(imageUrl);
      } catch (error) {
        toast({
          title: "Error",
          description: "Error al subir el logo al servidor",
          variant: "destructive",
        });
      }
    }
  }, [toast]);

  const handleLogoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!validateImage(file)) return;
      
      try {
        const imageUrl = await uploadImageToServer(file);
        setLogoFile(file);
        setLogoPreview(imageUrl);
      } catch (error) {
        toast({
          title: "Error",
          description: "Error al subir el logo al servidor",
          variant: "destructive",
        });
      }
    }
  };

  const removeLogo = () => {
    setLogoFile(null);
    setLogoPreview("");
  };

  // Manejo de la foto de portada con drag and drop
  const handleFotoPortadaDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/') && file.size <= 2 * 1024 * 1024) {
      try {
        const imageUrl = await uploadImageToServer(file);
        setFotoPortadaFile(file);
        setFotoPortadaPreview(imageUrl);
      } catch (error) {
        toast({
          title: "Error",
          description: "Error al subir la foto de portada al servidor",
          variant: "destructive",
        });
      }
    }
  }, [toast]);

  const handleFotoPortadaSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const imageUrl = await uploadImageToServer(file);
        setFotoPortadaFile(file);
        setFotoPortadaPreview(imageUrl);
      } catch (error) {
        toast({
          title: "Error",
          description: "Error al subir la foto de portada al servidor",
          variant: "destructive",
        });
      }
    }
  };

  const removeFotoPortada = () => {
    setFotoPortadaFile(null);
    setFotoPortadaPreview("");
  };

  // Manejo del catálogo PDF con drag and drop
  const handleCatalogoDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf' && file.size <= 10 * 1024 * 1024) { // 10MB
      setCatalogoFile(file);
    } else {
      toast({
        title: "Error",
        description: "Solo se permiten archivos PDF de máximo 10MB",
        variant: "destructive",
      });
    }
  }, [toast]);

  const handleCatalogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type === 'application/pdf' && file.size <= 10 * 1024 * 1024) {
        setCatalogoFile(file);
      } else {
        toast({
          title: "Error",
          description: "Solo se permiten archivos PDF de máximo 10MB",
          variant: "destructive",
        });
      }
    }
  };

  const removeCatalogo = () => {
    setCatalogoFile(null);
  };

  // Funciones para redes sociales dinámicas
  const addRedSocial = () => {
    const newSocial = { plataforma: "", url: "" };
    setRedesSociales([...redesSociales, newSocial]);
  };

  const removeRedSocial = (index: number) => {
    const newRedes = redesSociales.filter((_, i) => i !== index);
    setRedesSociales(newRedes);
    form.setValue("redesSociales", newRedes);
  };

  const updateRedSocial = (index: number, field: 'plataforma' | 'url', value: string) => {
    const newRedes = [...redesSociales];
    newRedes[index][field] = value;
    setRedesSociales(newRedes);
    form.setValue("redesSociales", newRedes);
  };

  // Funciones para galería de fotografías
  const validateImage = (file: File): boolean => {
    // Validar tamaño de la imagen (máx. 2 MiB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "La imagen supera el tamaño máximo permitido de 2 MB. Selecciona una imagen más ligera.",
        variant: "destructive",
      });
      return false;
    }

    // Validar tipo de archivo
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

  const handleGaleriaDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    
    // Verificar si hay plan seleccionado
    if (!selectedMembershipType) {
      toast({
        title: "Error",
        description: "Selecciona un plan de membresía antes de agregar imágenes",
        variant: "destructive",
      });
      return;
    }

    const currentLimit = maxProductImages === Infinity ? 999 : maxProductImages;
    if (galeriaFiles.length + files.length > currentLimit) {
      toast({
        title: "Error",
        description: `Solo se permiten máximo ${maxProductImages === Infinity ? 'ilimitadas' : maxProductImages} imágenes según tu plan de membresía`,
        variant: "destructive",
      });
      return;
    }

    // Verificar límites de plan de membresía para productos
    if (selectedCompanyId && !canAddProducts) {
      toast({
        title: "Límite de productos alcanzado",
        description: "Has alcanzado el límite de productos de tu plan de membresía. Actualiza tu plan para agregar más productos.",
        variant: "destructive",
      });
      return;
    }

    const validFiles = files.filter(validateImage);
    if (validFiles.length === 0) return;

    try {
      const imageUrls = await uploadMultipleImages(validFiles);
      
      setGaleriaFiles([...galeriaFiles, ...validFiles]);
      setGaleriaPreviews([...galeriaPreviews, ...imageUrls]);
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al subir las imágenes al servidor",
        variant: "destructive",
      });
    }
  }, [galeriaFiles, galeriaPreviews, toast, selectedMembershipType, maxProductImages]);

  // Callback para manejar cambios en los límites
  const handleLimitsChange = (canProducts: boolean, canProjects: boolean) => {
    setCanAddProducts(canProducts);
    setCanAddProjects(canProjects);
  };

  const handleGaleriaSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    // Verificar límites del plan de membresía seleccionado
    const selectedMembershipId = form.watch("membershipTypeId");
    const selectedMembership = membershipTypes.find(m => m.id === selectedMembershipId);
    
    if (selectedMembership) {
      const maxProducts = selectedMembership.cantidadProductosAdmitidos;
      
      // Verificar límite de productos (usando galería como productos)
      if (maxProducts !== -1 && maxProducts !== null && galeriaFiles.length + files.length > maxProducts) {
        toast({
          title: "Límite de productos excedido",
          description: `Tu plan "${selectedMembership.nombrePlan}" permite máximo ${maxProducts} productos. Actualmente tienes ${galeriaFiles.length}.`,
          variant: "destructive",
        });
        return;
      }
    } else {
      toast({
        title: "Error",
        description: "Selecciona un plan de membresía antes de agregar imágenes",
        variant: "destructive",
      });
      return;
    }

    const validFiles = files.filter(validateImage);
    if (validFiles.length === 0) return;

    try {
      const imageUrls = await uploadMultipleImages(validFiles);
      
      setGaleriaFiles([...galeriaFiles, ...validFiles]);
      setGaleriaPreviews([...galeriaPreviews, ...imageUrls]);
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

  const removeGaleriaImage = (index: number) => {
    const newFiles = galeriaFiles.filter((_, i) => i !== index);
    const newPreviews = galeriaPreviews.filter((_, i) => i !== index);
    setGaleriaFiles(newFiles);
    setGaleriaPreviews(newPreviews);
  };



  // Funciones para manejar videos
  const addVideo = () => {
    if (videosUrls.length < 5) {
      setVideosUrls([...videosUrls, ""]);
    }
  };

  const removeVideo = (index: number) => {
    const newVideos = videosUrls.filter((_, i) => i !== index);
    setVideosUrls(newVideos);
  };

  const updateVideo = (index: number, value: string) => {
    const newVideos = [...videosUrls];
    newVideos[index] = value;
    setVideosUrls(newVideos);
  };

  // Función para direcciones por ciudad
  const updateDireccionCiudad = (ciudad: string, direccion: string) => {
    setDireccionesPorCiudad(prev => ({
      ...prev,
      [ciudad]: direccion
    }));
  };

  // Función para ubicaciones del mapa
  const updateUbicacionCiudad = (ciudad: string, ubicacion: { lat: number; lng: number; address: string }) => {
    setUbicacionesPorCiudad(prev => ({
      ...prev,
      [ciudad]: ubicacion
    }));
  };

  // Obtener ciudades disponibles basadas en estados seleccionados
  const getAvailableCiudades = () => {
    return selectedEstados.flatMap(estado => 
      ciudadesPorEstado[estado]?.map(ciudad => `${ciudad}, ${estado}`) || []
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Registrar Nueva Empresa
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            
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
                  {(wordPressUserSearch.length >= 3 || debouncedSearchTerm.length >= 3) && (
                    <div className="border-2 border-blue-200 rounded-lg bg-white max-h-48 overflow-y-auto shadow-lg">
                      {isLoadingWordPressUsers || (wordPressUserSearch !== debouncedSearchTerm && wordPressUserSearch.length >= 3) ? (
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
                                
                                // Auto-llenar campos de contacto
                                if (user.email) {
                                  form.setValue("email1", user.email);
                                }
                                
                                // Auto-llenar nombre de empresa con el nombre del usuario
                                if (user.name || user.first_name || user.username) {
                                  const companyName = user.name || `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.username;
                                  form.setValue("nombreEmpresa", companyName);
                                }
                                
                                // Auto-llenar teléfonos si están disponibles en el perfil
                                if (user.phone || user.meta?.phone || user.meta?.billing_phone) {
                                  const phoneNumber = user.phone || user.meta?.phone || user.meta?.billing_phone;
                                  form.setValue("telefono1", phoneNumber);
                                }
                                
                                // Auto-llenar sitio web si está disponible
                                if (user.url || user.meta?.website || user.user_url) {
                                  const websiteUrl = user.url || user.meta?.website || user.user_url;
                                  if (websiteUrl && websiteUrl !== 'http://') {
                                    form.setValue("sitioWeb", websiteUrl);
                                  }
                                }
                                
                                // Auto-llenar descripción si está disponible
                                if (user.description || user.meta?.description) {
                                  const description = user.description || user.meta?.description;
                                  form.setValue("descripcionEmpresa", description);
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
                                
                                // Mostrar notificación de auto-completado
                                toast({
                                  title: "✅ Usuario vinculado y datos completados",
                                  description: "Se han llenado automáticamente los campos disponibles del usuario de WordPress y se creará su cuenta de representante con contraseña '12345678'.",
                                });
                                
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
                              ✨ Campos auto-llenados: Nombre de empresa, Email, Teléfono, Sitio web, Descripción y configuración de membresía (Empresarial/Anual/Otro)
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
                          <div className="space-y-3 max-h-72 overflow-y-auto">
                            {userTransactions.map((transaction: any, index: number) => (
                              <div key={transaction.id} className={`p-3 border rounded-lg ${
                                transaction.is_active 
                                  ? 'bg-green-50 border-green-300' 
                                  : index === 0 
                                    ? 'bg-blue-50 border-blue-200' 
                                    : 'bg-gray-50'
                              }`}>
                                <div className="flex justify-between items-start">
                                  <div className="flex-1">
                                    <div className="font-medium text-gray-900 flex flex-wrap items-center gap-2">
                                      {transaction.membership_name}
                                      {transaction.is_active && (
                                        <span className="px-2 py-1 text-xs bg-green-600 text-white rounded-full">
                                          ✓ Activa
                                        </span>
                                      )}
                                      {!transaction.is_active && index === 0 && (
                                        <span className="px-2 py-1 text-xs bg-blue-600 text-white rounded-full">
                                          Más reciente
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-sm text-gray-600 space-y-1 mt-2">
                                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                        <div>💰 Total: {formatMoney(transaction.total || transaction.amount, transaction.currency)}</div>
                                        <div>💳 {transaction.payment_method || 'No especificado'}</div>
                                        {transaction.starts_at && (
                                          <div className="text-green-700">
                                            📅 Inicia: {new Date(transaction.starts_at).toLocaleDateString('es-ES')}
                                          </div>
                                        )}
                                        {transaction.expires_at && (
                                          <div className={transaction.is_active ? 'text-green-700 font-medium' : 'text-red-600 font-medium'}>
                                            ⏰ Vence: {new Date(transaction.expires_at).toLocaleDateString('es-ES')}
                                          </div>
                                        )}
                                      </div>
                                      <div className="text-xs text-gray-500 mt-1">
                                        🔖 ID: {transaction.transaction_id}
                                        {transaction.subscription_id && ` | Sub: ${transaction.subscription_id}`}
                                      </div>
                                    </div>
                                  </div>
                                  <span className={`px-2 py-1 text-xs rounded-full shrink-0 ${
                                    transaction.status === 'complete' || transaction.status === 'confirmed'
                                      ? 'bg-green-100 text-green-800' 
                                      : transaction.status === 'active'
                                        ? 'bg-blue-100 text-blue-800'
                                        : 'bg-yellow-100 text-yellow-800'
                                  }`}>
                                    {transaction.status === 'complete' ? 'Completada' : 
                                     transaction.status === 'confirmed' ? 'Confirmada' :
                                     transaction.status === 'active' ? 'Activa' : transaction.status}
                                  </span>
                                </div>
                              </div>
                            ))}
                            <div className="text-xs text-gray-500 text-center pt-2 border-t">
                              💡 Las fechas de membresía se auto-completaron con la transacción activa o más reciente
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-4 text-gray-500">
                            <div className="text-4xl mb-2">📄</div>
                            <div>No se encontraron transacciones válidas</div>
                            <div className="text-xs mt-1">
                              Solo se muestran transacciones completadas, confirmadas o activas
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
                        <Input placeholder="+52 55 1234 5678" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Teléfono secundario - Agregar campo faltante */}
                <FormField
                  control={form.control}
                  name="telefono2"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Teléfono Secundario</FormLabel>
                      <FormControl>
                        <Input placeholder="+52 55 8765 4321" {...field} value={field.value || ""} />
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

                {/* Email secundario - Agregar campo faltante */}
                <FormField
                  control={form.control}
                  name="email2"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Secundario</FormLabel>
                      <FormControl>
                        <Input placeholder="ventas@empresa.com" type="email" {...field} value={field.value || ""} />
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
                        <Input placeholder="https://www.empresa.com" {...field} value={field.value || ""} />
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
                <FormItem className="md:col-span-2">
                  <FormLabel>Logotipo de la Empresa</FormLabel>
                  <div
                    className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary transition-colors"
                    onDrop={handleLogoDrop}
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
                          onClick={removeLogo}
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
                                onChange={handleLogoSelect}
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
                </FormItem>

                {/* Foto de Portada con drag and drop */}
                <FormItem className="md:col-span-2">
                  <FormLabel>Foto de Portada de la Empresa</FormLabel>
                  <div
                    className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-primary transition-colors"
                    onDrop={handleFotoPortadaDrop}
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
                          onClick={removeFotoPortada}
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
                                onChange={handleFotoPortadaSelect}
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
                </FormItem>

                {/* Videos dinámicos */}
                <div className="space-y-4">
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

                {/* Categorías */}
                <FormField
                  control={form.control}
                  name="categoriesIds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categorías *</FormLabel>
                      <div className="grid grid-cols-2 gap-3 mt-2">
                        {categories.map((category) => (
                          <div key={category.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`category-${category.id}`}
                              checked={field.value?.includes(category.id) || false}
                              onCheckedChange={(checked) => {
                                const currentValues = field.value || [];
                                if (checked) {
                                  field.onChange([...currentValues, category.id]);
                                } else {
                                  field.onChange(currentValues.filter(id => id !== category.id));
                                }
                              }}
                            />
                            <label
                              htmlFor={`category-${category.id}`}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex items-center gap-2"
                            >
                              {renderCategoryIcon(category)}
                              {category.nombreCategoria}
                            </label>
                          </div>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Etiquetas */}
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

                {/* Certificados */}
                <FormField
                  control={form.control}
                  name="certificateIds"
                  render={({ field }) => {
                    const selectedMembershipId = form.watch("membershipTypeId");
                    const selectedMembership = membershipTypes.find(m => m.id === selectedMembershipId);
                    
                    return (
                      <FormItem className="md:col-span-2">
                        <FormLabel className="flex items-center gap-2">
                          Certificados Disponibles
                          {selectedMembership && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                              Plan: {selectedMembership.nombrePlan}
                            </span>
                          )}
                        </FormLabel>
                        {certificates.length > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2 max-h-48 overflow-y-auto border rounded-lg p-4">
                            {certificates.map((certificate) => (
                              <div key={certificate.id} className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-gray-50">
                                <Checkbox
                                  id={`certificate-${certificate.id}`}
                                  checked={field.value?.includes(certificate.id) || false}
                                  onCheckedChange={(checked) => {
                                    const currentValues = field.value || [];
                                    if (checked) {
                                      field.onChange([...currentValues, certificate.id]);
                                    } else {
                                      field.onChange(currentValues.filter(id => id !== certificate.id));
                                    }
                                  }}
                                />
                                <div className="flex-1 min-w-0">
                                  <label
                                    htmlFor={`certificate-${certificate.id}`}
                                    className="text-sm font-medium leading-none cursor-pointer block"
                                  >
                                    {certificate.nombreCertificado}
                                  </label>
                                  {certificate.entidadEmisora && (
                                    <p className="text-xs text-gray-500 mt-1">
                                      Emisor: {certificate.entidadEmisora}
                                    </p>
                                  )}
                                </div>
                                {certificate.imagenUrl && (
                                  <img 
                                    src={certificate.imagenUrl} 
                                    alt={certificate.nombreCertificado}
                                    className="w-8 h-8 object-cover rounded"
                                  />
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-6 text-gray-500">
                            <FileText className="mx-auto h-12 w-12 text-gray-400" />
                            <p className="mt-2 text-sm">No hay certificados disponibles</p>
                            <p className="text-xs">Crea certificados primero en la sección correspondiente</p>
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />




                {/* COMMENTED OUT: Ubicación Principal - field removed from schema */}
                {/*
                <FormField
                  control={form.control}
                  name="ubicacionPrincipal"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Ubicación Principal (Opcional)</FormLabel>
                      <FormDescription>
                        Si tienes presencia en múltiples ciudades, selecciona cuál es la principal
                      </FormDescription>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona la ciudad principal" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(form.watch("ciudadesPresencia") || []).map((ciudad) => (
                            <SelectItem key={ciudad} value={ciudad}>
                              {ciudad}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                */}

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

                {/* Sección: Información de Membresía */}
                <div className="md:col-span-2 mt-16 space-y-6 p-6 bg-white border-2 border-blue-200 rounded-lg shadow-sm">
                  <div className="border-b border-gray-200 pb-4">
                    <h3 className="text-lg font-semibold text-blue-900 flex items-center gap-2">
                      <Crown className="h-5 w-5 text-blue-600" />
                      Información del Plan
                    </h3>
                    <p className="text-sm text-gray-600">Configuración del plan y método de pago</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Tipo de Membresía */}
                    <FormField
                      control={form.control}
                      name="membershipTypeId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo de Membresía</FormLabel>
                          <Select onValueChange={(value) => {
                            field.onChange(value ? parseInt(value) : undefined);
                            // Reset periodicidad when membership type changes
                            form.setValue("membershipPeriodicidad", undefined);
                            form.setValue("fechaFinMembresia", "");
                          }} value={field.value?.toString()}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecciona un tipo de membresía" />
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

                    {/* Mostrar límites del plan seleccionado */}
                    {(() => {
                      const selectedMembershipId = form.watch("membershipTypeId");
                      const currentMembershipType = membershipTypes.find(m => m.id === selectedMembershipId);
                      
                      return currentMembershipType ? (
                        <div className="md:col-span-2 bg-blue-50 border border-blue-200 rounded-lg p-4">
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
                                Sin límite
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
                      ) : null;
                    })()}

                    {/* Periodicidad de Membresía */}
                    <FormField
                      control={form.control}
                      name="membershipPeriodicidad"
                      render={({ field }) => {
                        const selectedMembershipId = form.watch("membershipTypeId");
                        const selectedMembership = membershipTypes.find(m => m.id === selectedMembershipId);
                        let opcionesPrecios = [];
                        if (selectedMembership && selectedMembership.opcionesPrecios) {
                          try {
                            if (typeof selectedMembership.opcionesPrecios === 'string') {
                              opcionesPrecios = JSON.parse(selectedMembership.opcionesPrecios);
                            } else if (Array.isArray(selectedMembership.opcionesPrecios)) {
                              opcionesPrecios = selectedMembership.opcionesPrecios;
                            }
                          } catch (error) {
                            console.error("Error parsing opcionesPrecios:", error);
                            opcionesPrecios = [];
                          }
                        }

                        return (
                          <FormItem>
                            <FormLabel>Periodicidad</FormLabel>
                            <Select 
                              onValueChange={field.onChange}
                              value={field.value}
                              disabled={!selectedMembershipId}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecciona periodicidad" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {opcionesPrecios.map((opcion: any, index: number) => (
                                  <SelectItem key={index} value={opcion.periodicidad.toLowerCase()}>
                                    {opcion.periodicidad.charAt(0).toUpperCase() + opcion.periodicidad.slice(1)} - {formatMoney(opcion.costo)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        );
                      }}
                    />

                    {/* Forma de Pago */}
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
                              <SelectItem value="efectivo">Efectivo</SelectItem>
                              <SelectItem value="transferencia">Transferencia</SelectItem>
                              <SelectItem value="otro">Otro</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Fecha de Inicio */}
                    <FormField
                      control={form.control}
                      name="fechaInicioMembresia"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Fecha de Inicio</FormLabel>
                          <FormControl>
                            <Input 
                              type="date" 
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Fecha de Finalización */}
                    <FormField
                      control={form.control}
                      name="fechaFinMembresia"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Fecha de Finalización</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Notas de Membresía */}
                    <FormField
                      control={form.control}
                      name="notasMembresia"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Notas del Plan</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Notas adicionales sobre el plan, condiciones especiales, etc."
                              rows={3}
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>



                {/* Redes Sociales Dinámicas */}
                <div className="md:col-span-2 space-y-4">
                  <FormLabel>Redes Sociales</FormLabel>
                  {redesSociales.map((red, index) => (
                    <div key={index} className="flex gap-3 items-start">
                      <Select 
                        value={red.plataforma} 
                        onValueChange={(value) => updateRedSocial(index, 'plataforma', value)}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue placeholder="Plataforma" />
                        </SelectTrigger>
                        <SelectContent>
                          {socialPlatforms.map((platform) => {
                            const Icon = platform.icon;
                            return (
                              <SelectItem key={platform.name} value={platform.name}>
                                <div className="flex items-center gap-2">
                                  <Icon className="h-4 w-4" />
                                  {platform.name}
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder="https://..."
                        value={red.url}
                        onChange={(e) => updateRedSocial(index, 'url', e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeRedSocial(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addRedSocial}
                    className="flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Agregar Red Social
                  </Button>
                </div>

                {/* Catálogo de Productos PDF */}
                <div className="md:col-span-2">
                  <FormLabel>Catálogo de Productos (PDF)</FormLabel>
                  <div
                    className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary transition-colors mt-2"
                    onDrop={handleCatalogoDrop}
                    onDragOver={(e) => e.preventDefault()}
                  >
                    {catalogoFile ? (
                      <div className="flex items-center justify-between bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center gap-3">
                          <FileText className="h-8 w-8 text-red-600" />
                          <div className="text-left">
                            <p className="font-medium text-gray-900">{catalogoFile.name}</p>
                            <p className="text-sm text-gray-500">
                              {(catalogoFile.size / (1024 * 1024)).toFixed(2)} MB
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={removeCatalogo}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <FileText className="h-12 w-12 text-gray-400 mx-auto" />
                        <div>
                          <p className="text-sm text-gray-600">
                            Arrastra y suelta tu catálogo PDF aquí, o{" "}
                            <label className="text-primary cursor-pointer hover:underline">
                              selecciona un archivo
                              <input
                                type="file"
                                accept=".pdf"
                                className="hidden"
                                onChange={handleCatalogoSelect}
                              />
                            </label>
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Solo archivos PDF (máx. 10MB)
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Galería de Fotografías */}
                <div className="md:col-span-2">
                  <FormLabel>
                    Galería de Fotografías (máx. {maxProductImages === Infinity ? 'sin límite' : maxProductImages} imágenes)
                    {!selectedMembershipType && (
                      <span className="text-sm text-gray-500 ml-2">- Selecciona un plan de membresía primero</span>
                    )}
                  </FormLabel>
                  <div
                    className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary transition-colors mt-2"
                    onDrop={handleGaleriaDrop}
                    onDragOver={(e) => e.preventDefault()}
                  >
                    {galeriaFiles.length > 0 ? (
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
                          {galeriaFiles.length < (maxProductImages === Infinity ? 999 : maxProductImages) && selectedMembershipType && (
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
                          {galeriaFiles.length}/{maxProductImages === Infinity ? 'sin límite' : maxProductImages} imágenes • Arrastra más imágenes o haz clic en + para agregar
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
                            {selectedMembershipType 
                              ? `Máximo ${maxProductImages === Infinity ? 'sin límite' : maxProductImages} imágenes • Cada imagen: máx. 2 MB, min. 800x800px, formato 1:1`
                              : 'Selecciona un plan de membresía para ver los límites'
                            }
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Sección: Validación de Límites de Membresía */}
            {watchedMembershipTypeId && (
              <div className="space-y-6">
                <div className="border-b pb-4">
                  <h3 className="text-lg font-semibold text-primary">Validación de Límites del Plan</h3>
                  <p className="text-sm text-gray-600">Verificación de límites según el plan de membresía seleccionado</p>
                </div>
                {selectedMembershipType && (
                  <MembershipLimitsDisplay
                    membershipType={selectedMembershipType}
                    productCount={galeriaFiles.length}
                    projectCount={0}
                    className="mb-4"
                  />
                )}
              </div>
            )}





            {/* Botones */}
            <div className="flex justify-end space-x-4 pt-6 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={createCompanyMutation.isPending}
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={createCompanyMutation.isPending}
                className="bg-primary hover:bg-primary/90"
                onClick={() => {
                  // Debug: Show validation errors when clicking submit
                  const errors = form.formState.errors;
                  if (Object.keys(errors).length > 0) {
                    console.log("🚨 ERRORES DE VALIDACIÓN AL HACER CLIC:", errors);
                    const errorMessages = Object.entries(errors)
                      .map(([field, error]: [string, any]) => `${field}: ${error?.message || 'Error desconocido'}`)
                      .join('\n');
                    alert(`Errores de validación:\n${errorMessages}`);
                  } else {
                    console.log("✅ No hay errores de validación, intentando enviar...");
                  }
                }}
              >
                {createCompanyMutation.isPending ? "Registrando..." : "Registrar Empresa"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}