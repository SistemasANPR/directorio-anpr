import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { getStripePromise } from "@/lib/stripe";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  User, 
  Building, 
  CreditCard, 
  CheckCircle, 
  ArrowLeft, 
  ArrowRight,
  Crown,
  Star,
  Mail,
  Phone,
  MapPin,
  Camera,
  Upload
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import MultiLocationPicker from "@/components/MultiLocationPicker";
import { useCurrency } from "@/lib/currency";

const stripePromise = getStripePromise();

// Schemas for each step
const userSchema = z.object({
  nombre: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  telefono: z.string().min(10, "Teléfono debe tener al menos 10 dígitos"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  confirmPassword: z.string(),
  photoURL: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

const companySchema = z.object({
  nombreEmpresa: z.string().min(2, "El nombre de la empresa es requerido"),
  email1: z.string().email("Email inválido"),
  telefono1: z.string().min(10, "Teléfono debe tener al menos 10 dígitos"),
  descripcionEmpresa: z.string().min(20, "La descripción debe tener al menos 20 caracteres"),
  sitioWeb: z.string().url("URL inválida").optional().or(z.literal("")),
  locations: z.array(z.object({
    lat: z.number(),
    lng: z.number(),
    address: z.string(),
    isPrincipal: z.boolean()
  })).min(1, "Debes agregar al menos una ubicación"),
});

type UserFormData = z.infer<typeof userSchema>;
type CompanyFormData = z.infer<typeof companySchema>;

interface MembershipType {
  id: number;
  nombrePlan: string;
  descripcionPlan: string;
  opcionesPrecios: Array<{
    periodicidad: string;
    costo: number;
  }>;
  beneficios: string;
}

const steps = [
  { id: 1, title: "Datos Personales", icon: User },
  { id: 2, title: "Datos de Empresa", icon: Building },
  { id: 3, title: "Seleccionar Plan", icon: Crown },
  { id: 4, title: "Pago", icon: CreditCard },
  { id: 5, title: "Confirmación", icon: CheckCircle },
];

function PaymentForm({ 
  clientSecret, 
  onSuccess, 
  onError, 
  isProcessing,
  onGoBack
}: { 
  clientSecret: string;
  onSuccess: () => void;
  onError: (error: string) => void;
  isProcessing: boolean;
  onGoBack: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      onError("Sistema de pago no disponible. Por favor, recarga la página.");
      return;
    }

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/registro-exitoso`,
        },
        redirect: "if_required",
      });

      if (error) {
        console.error("Stripe payment error:", error);
        onError(error.message || "Error en el proceso de pago");
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        onSuccess();
      } else {
        onError("El pago no se completó correctamente. Por favor, inténtalo de nuevo.");
      }
    } catch (err) {
      console.error("Payment confirmation error:", err);
      onError("Error inesperado durante el pago. Por favor, inténtalo de nuevo.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      
      <div className="flex flex-col sm:flex-row gap-3">
        <Button 
          type="button"
          variant="outline"
          onClick={onGoBack}
          className="w-full sm:w-auto"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver a Editar
        </Button>
        <Button 
          type="submit" 
          disabled={!stripe || isProcessing}
          className="w-full sm:flex-1"
          style={{ backgroundColor: '#bcce16' }}
        >
          {isProcessing ? "Procesando..." : "Completar Pago"}
        </Button>
      </div>
    </form>
  );
}

export default function RegisterAndPay() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { format: formatMoney } = useCurrency();
  const [currentStep, setCurrentStep] = useState(1);
  const [userData, setUserData] = useState<UserFormData | null>(null);
  const [companyData, setCompanyData] = useState<CompanyFormData | null>(null);
  const [selectedMembership, setSelectedMembership] = useState<MembershipType | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<"mensual" | "anual">("anual");
  const [clientSecret, setClientSecret] = useState<string>("");
  const [subscriptionId, setSubscriptionId] = useState<string>("");
  const [stripeCustomerId, setStripeCustomerId] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [companyBannerUrl, setCompanyBannerUrl] = useState<string | null>(null);
  const [locations, setLocations] = useState<Array<{
    lat: number;
    lng: number;
    address: string;
    isPrincipal: boolean;
  }>>([]);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Scroll a la sección de planes cuando se llega al paso 3
  useEffect(() => {
    if (currentStep === 3) {
      setTimeout(() => {
        const planSection = document.getElementById('elige-plan-section');
        if (planSection) {
          const offset = 100; // Espacio desde el top
          const elementPosition = planSection.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.pageYOffset - offset;
          
          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
          });
        }
      }, 100);
    }
  }, [currentStep]);

  // Detectar si viene con un plan preseleccionado
  const urlParams = new URLSearchParams(window.location.search);
  const preselectedPlanId = urlParams.get('plan');

  const userForm = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      nombre: "",
      email: "",
      telefono: "",
      password: "",
      confirmPassword: "",
      photoURL: "",
    },
  });

  const companyForm = useForm<CompanyFormData>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      nombreEmpresa: "",
      email1: "",
      telefono1: "",
      descripcionEmpresa: "",
      sitioWeb: "",
      locations: [],
    },
  });

  // Efecto para limpiar campos cuando se llega al paso 2
  useEffect(() => {
    if (currentStep === 2) {
      companyForm.reset({
        nombreEmpresa: "",
        email1: userData?.email || "",
        telefono1: "",
        descripcionEmpresa: "",
        sitioWeb: "",
        locations: [],
      });
      setLocations([]);
      setLogoPreview(null);
      setCompanyLogoUrl(null);
      setBannerPreview(null);
      setCompanyBannerUrl(null);
    }
  }, [currentStep, companyForm, userData]);

  // Fetch membership types
  const { data: memberships = [], isLoading: isLoadingMemberships } = useQuery<MembershipType[]>({
    queryKey: ["/api/membership-types/public"],
  });

  // Effect para manejar plan preseleccionado
  useEffect(() => {
    if (preselectedPlanId && memberships.length > 0 && !selectedMembership) {
      const preselectedPlan = memberships.find((m: MembershipType) => m.id.toString() === preselectedPlanId);
      if (preselectedPlan) {
        setSelectedMembership(preselectedPlan);
      }
    }
  }, [preselectedPlanId, memberships, selectedMembership]);

  // Crear la SUSCRIPCIÓN recurrente (renovación automática) en vez de un cobro único.
  const createPaymentMutation = useMutation({
    mutationFn: async () => {
      if (!selectedMembership) throw new Error("No membership selected");
      if (!userData) throw new Error("Faltan datos del usuario");

      const response = await apiRequest("POST", "/api/create-subscription", {
        membershipTypeId: selectedMembership.id,
        selectedPeriod,
        email: userData.email,
        name: userData.nombre,
        autoRenewal: true,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setClientSecret(data.clientSecret);
      setSubscriptionId(data.subscriptionId || "");
      setStripeCustomerId(data.customerId || "");
      setCurrentStep(4);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al crear el pago",
        variant: "destructive",
      });
    },
  });

  // Complete registration
  const completeRegistrationMutation = useMutation({
    mutationFn: async () => {
      if (!userData || !companyData || !selectedMembership) {
        throw new Error("Datos incompletos");
      }

      const paymentIntentId = clientSecret.includes('_secret_') 
        ? clientSecret.split('_secret_')[0] 
        : clientSecret;

      // Step 1: Create Firebase account first
      let firebaseUid: string;
      try {
        if (!auth) {
          throw new Error("Firebase no está configurado correctamente");
        }
        
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          userData.email,
          userData.password
        );
        firebaseUid = userCredential.user.uid;
        console.log("Firebase account created with UID:", firebaseUid);
      } catch (firebaseError: any) {
        console.error("Firebase account creation error:", firebaseError);
        if (firebaseError.code === 'auth/email-already-in-use') {
          // El correo ya existe en el sistema de login. Puede ser una cuenta
          // "huérfana" de un intento anterior que no se completó. Intentamos
          // iniciar sesión con las mismas credenciales para reutilizarla.
          // Si funciona, el registro continúa; complete-registration rechazará
          // el caso de un usuario real ya existente en la base de datos.
          try {
            const signInCredential = await signInWithEmailAndPassword(
              auth,
              userData.email,
              userData.password
            );
            firebaseUid = signInCredential.user.uid;
            console.log("Reusing existing Firebase account with UID:", firebaseUid);
          } catch (signInError: any) {
            throw new Error(
              "Este correo ya tiene una cuenta. Si es tuya, inicia sesión; si olvidaste tu contraseña, usa la opción \"¿Olvidaste tu contraseña?\" en la pantalla de inicio de sesión."
            );
          }
        } else {
          throw new Error("Error al crear la cuenta: " + (firebaseError.message || "Error desconocido"));
        }
      }

      console.log("Completing registration with:", {
        userData,
        companyData,
        membershipTypeId: selectedMembership.id,
        selectedPeriod,
        paymentIntentId,
        firebaseUid
      });

      // Step 2: Complete registration with the Firebase UID
      const response = await apiRequest("POST", "/api/complete-registration", {
        userData,
        companyData,
        membershipTypeId: selectedMembership.id,
        selectedPeriod,
        paymentIntentId,
        firebaseUid,
        subscriptionId,
        stripeCustomerId,
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.userMessage || errorData.error || "Error al completar el registro";
        throw new Error(errorMessage);
      }

      return response.json();
    },
    onSuccess: () => {
      setCurrentStep(5);
      toast({
        title: "¡Registro Exitoso!",
        description: "Tu cuenta y empresa han sido creadas correctamente",
      });
    },
    onError: (error: any) => {
      console.error("Registration error:", error);
      toast({
        title: "Error en el Registro",
        description: error.message || "Error al completar el registro",
        variant: "destructive",
      });
      setIsProcessing(false);
    },
  });

  const handlePhotoUpload = async (file: File) => {
    if (!file) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Error",
        description: "Solo se permiten archivos de imagen",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "Error", 
        description: "La imagen supera el tamaño máximo permitido de 2 MB. Selecciona una imagen más ligera.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsUploadingPhoto(true);
      
      const formData = new FormData();
      formData.append('image', file);
      
      const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Error al subir la imagen');
      }
      
      const data = await response.json();
      
      // Set photo URL in form
      userForm.setValue('photoURL', data.imageUrl);
      
      // Set preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setPhotoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
      
      toast({
        title: "Foto subida exitosamente",
        description: "Tu foto de perfil ha sido guardada",
      });
    } catch (error: any) {
      toast({
        title: "Error al subir foto",
        description: error.message || "No se pudo subir la imagen",
        variant: "destructive",
      });
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleLogoUpload = async (file: File) => {
    if (!file) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Error",
        description: "Solo se permiten archivos de imagen",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "Error", 
        description: "La imagen supera el tamaño máximo permitido de 2 MB. Selecciona una imagen más ligera.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsUploadingLogo(true);
      
      const formData = new FormData();
      formData.append('image', file);
      
      const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Error al subir la imagen');
      }
      
      const data = await response.json();
      
      // Guardar la URL del logo
      setCompanyLogoUrl(data.imageUrl);
      
      // Set preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setLogoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
      
      toast({
        title: "Logo subido exitosamente",
        description: "El logo de tu empresa ha sido guardado",
      });
    } catch (error: any) {
      toast({
        title: "Error al subir logo",
        description: error.message || "No se pudo subir la imagen",
        variant: "destructive",
      });
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleBannerUpload = async (file: File) => {
    if (!file) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Error",
        description: "Solo se permiten archivos de imagen",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "Error", 
        description: "La imagen supera el tamaño máximo permitido de 2 MB. Selecciona una imagen más ligera.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsUploadingBanner(true);
      
      const formData = new FormData();
      formData.append('image', file);
      
      const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Error al subir la imagen');
      }
      
      const data = await response.json();
      
      // Guardar la URL del banner
      setCompanyBannerUrl(data.imageUrl);
      
      // Set preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setBannerPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
      
      toast({
        title: "Banner subido exitosamente",
        description: "La foto de portada de tu empresa ha sido guardada",
      });
    } catch (error: any) {
      toast({
        title: "Error al subir banner",
        description: error.message || "No se pudo subir la imagen",
        variant: "destructive",
      });
    } finally {
      setIsUploadingBanner(false);
    }
  };

  const handleUserSubmit = async (data: UserFormData) => {
    try {
      // Verificar si el correo ya está registrado
      const checkResponse = await apiRequest("POST", "/api/check-email", {
        email: data.email
      });
      
      const checkData = await checkResponse.json();
      
      if (checkData.exists) {
        toast({
          title: "Ya eres miembro de ANPR",
          description: "Este correo ya pertenece a una cuenta de miembro de ANPR. No necesitas registrarte de nuevo: inicia sesión con tu correo y contraseña. Si olvidaste tu contraseña, usa la opción \"¿Olvidaste tu contraseña?\" en la pantalla de inicio de sesión.",
          variant: "destructive",
        });
        return;
      }
      
      setUserData(data);
      setCurrentStep(2);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "No se pudo verificar el correo electrónico. Intenta nuevamente.",
        variant: "destructive",
      });
    }
  };

  const handleCompanySubmit = (data: CompanyFormData) => {
    // Encontrar la ubicación principal
    const principalLocation = data.locations.find(loc => loc.isPrincipal) || data.locations[0];
    const companyDataWithLocation = {
      ...data,
      direccionFisica: principalLocation?.address || "Ubicación seleccionada en el mapa",
      logotipoUrl: companyLogoUrl,
      fotoPortadaUrl: companyBannerUrl,
    };
    setCompanyData(companyDataWithLocation as any);
    // Siempre ir al paso 3 para verificación del plan
    setCurrentStep(3);
  };

  const handleMembershipSelect = (membership: MembershipType) => {
    setSelectedMembership(membership);
    // No ir automáticamente al pago, dejar que el usuario verifique primero
  };

  const handlePaymentSuccess = () => {
    setIsProcessing(true);
    completeRegistrationMutation.mutate();
  };

  const handlePaymentError = (error: string) => {
    toast({
      title: "Error en el Pago",
      description: error,
      variant: "destructive",
    });
  };

  const getSelectedPrice = (membership: MembershipType) => {
    const option = membership.opcionesPrecios.find(
      opt => opt.periodicidad.toLowerCase() === selectedPeriod
    ) || membership.opcionesPrecios[0];
    return option?.costo || 0;
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <Form {...userForm}>
            <form onSubmit={userForm.handleSubmit(handleUserSubmit)} className="space-y-4">
              <FormField
                control={userForm.control}
                name="nombre"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre Completo <span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                      <Input placeholder="Tu nombre completo" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={userForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email <span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="tu@email.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={userForm.control}
                name="telefono"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teléfono <span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                      <Input placeholder="+52 777 123 4567" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Photo Upload Field */}
              <FormField
                control={userForm.control}
                name="photoURL"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Foto de Perfil (Opcional)</FormLabel>
                    <FormControl>
                      <div
                        className="space-y-4"
                        onDrop={(e) => {
                          e.preventDefault();
                          const file = e.dataTransfer.files?.[0];
                          if (file && !isUploadingPhoto) handlePhotoUpload(file);
                        }}
                        onDragOver={(e) => e.preventDefault()}
                      >
                        {/* Photo Preview */}
                        <div className="flex justify-center">
                          <div className="relative">
                            <Avatar className="w-24 h-24">
                              <AvatarImage 
                                src={photoPreview || undefined} 
                                alt="Vista previa de foto"
                                data-testid="img-photo-preview"
                              />
                              <AvatarFallback className="bg-gray-100 text-gray-400">
                                <Camera className="w-8 h-8" />
                              </AvatarFallback>
                            </Avatar>
                            {isUploadingPhoto && (
                              <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                                <div 
                                  className="animate-spin w-6 h-6 border-2 border-white border-t-transparent rounded-full"
                                  data-testid="status-uploading"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Upload Button */}
                        <div className="flex justify-center">
                          <label className="relative cursor-pointer">
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  handlePhotoUpload(file);
                                }
                              }}
                              disabled={isUploadingPhoto}
                              data-testid="input-photo"
                            />
                            <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm text-gray-700 transition-colors">
                              <Upload className="w-4 h-4" />
                              {photoPreview ? 'Cambiar foto' : 'Subir foto'}
                            </div>
                          </label>
                        </div>
                        
                        <p className="text-xs text-gray-500 text-center">
                          Formatos: JPG, PNG, WEBP. Máximo 2 MB
                        </p>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={userForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contraseña <span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Mínimo 6 caracteres" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={userForm.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirmar Contraseña <span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Repite tu contraseña" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" style={{ backgroundColor: '#bcce16' }}>
                Continuar <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </form>
          </Form>
        );

      case 2:
        return (
          <Form {...companyForm}>
            {/* Campos falsos para engañar al navegador */}
            <div style={{ position: 'absolute', left: '-9999px', opacity: 0, pointerEvents: 'none' }}>
              <input type="text" name="fake_name" tabIndex={-1} autoComplete="off" />
              <input type="email" name="fake_email" tabIndex={-1} autoComplete="off" />
              <input type="tel" name="fake_phone" tabIndex={-1} autoComplete="off" />
            </div>
            <form onSubmit={companyForm.handleSubmit(handleCompanySubmit)} className="space-y-4" autoComplete="new-password">
              <FormField
                control={companyForm.control}
                name="nombreEmpresa"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre de la Empresa <span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Nombre de tu empresa" 
                        autoComplete="nope"
                        readOnly
                        onFocus={(e) => {
                          e.target.removeAttribute('readonly');
                        }}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={companyForm.control}
                name="email1"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email de la Empresa <span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                      <Input 
                        type="email" 
                        placeholder="contacto@empresa.com" 
                        autoComplete="nope"
                        readOnly
                        onFocus={(e) => {
                          e.target.removeAttribute('readonly');
                        }}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={companyForm.control}
                name="telefono1"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teléfono de la Empresa <span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="+52 777 123 4567" 
                        autoComplete="nope"
                        readOnly
                        onFocus={(e) => {
                          e.target.removeAttribute('readonly');
                        }}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Campo de Logo de la Empresa */}
              <div className="space-y-2">
                <FormLabel className="flex items-center gap-2">
                  <Camera className="w-5 h-5" />
                  Logo de la Empresa
                </FormLabel>
                <div
                  className="flex flex-col items-center gap-4 p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-[#bcce16] transition-colors"
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleLogoUpload(file);
                  }}
                  onDragOver={(e) => e.preventDefault()}
                >
                  {logoPreview ? (
                    <div className="relative">
                      <img 
                        src={logoPreview} 
                        alt="Logo preview" 
                        className="w-32 h-32 object-contain rounded-lg border"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setLogoPreview(null);
                          setCompanyLogoUrl(null);
                        }}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-24 h-24 bg-gray-100 rounded-lg flex items-center justify-center">
                        <Building className="w-12 h-12 text-gray-400" />
                      </div>
                      <p className="text-sm text-gray-500 text-center">
                        Arrastra una imagen o haz clic para seleccionar
                      </p>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          handleLogoUpload(e.target.files[0]);
                        }
                      }}
                      className="hidden"
                      id="logo-upload"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById('logo-upload')?.click()}
                      disabled={isUploadingLogo}
                    >
                      {isUploadingLogo ? (
                        <>
                          <div className="animate-spin w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full mr-2" />
                          Subiendo...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          {logoPreview ? 'Cambiar Logo' : 'Subir Logo'}
                        </>
                      )}
                    </Button>
                  </div>
                  {companyLogoUrl && (
                    <p className="text-sm text-green-600 flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" />
                      Logo guardado correctamente
                    </p>
                  )}
                </div>
              </div>

              {/* Campo de Banner/Foto de Portada de la Empresa */}
              <div className="space-y-2">
                <FormLabel className="flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Banner / Foto de Portada
                </FormLabel>
                <div
                  className="flex flex-col items-center gap-4 p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-[#bcce16] transition-colors"
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleBannerUpload(file);
                  }}
                  onDragOver={(e) => e.preventDefault()}
                >
                  {bannerPreview ? (
                    <div className="relative w-full">
                      <img 
                        src={bannerPreview} 
                        alt="Banner preview" 
                        className="w-full h-32 object-cover rounded-lg border"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setBannerPreview(null);
                          setCompanyBannerUrl(null);
                        }}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 w-full">
                      <div className="w-full h-24 bg-gray-100 rounded-lg flex items-center justify-center">
                        <div className="flex flex-col items-center">
                          <Upload className="w-8 h-8 text-gray-400" />
                          <span className="text-xs text-gray-400 mt-1">1200 x 400 px recomendado</span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-500 text-center">
                        Arrastra una imagen o haz clic para seleccionar
                      </p>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          handleBannerUpload(e.target.files[0]);
                        }
                      }}
                      className="hidden"
                      id="banner-upload"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => document.getElementById('banner-upload')?.click()}
                      disabled={isUploadingBanner}
                    >
                      {isUploadingBanner ? (
                        <>
                          <div className="animate-spin w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full mr-2" />
                          Subiendo...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          {bannerPreview ? 'Cambiar Banner' : 'Subir Banner'}
                        </>
                      )}
                    </Button>
                  </div>
                  {companyBannerUrl && (
                    <p className="text-sm text-green-600 flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" />
                      Banner guardado correctamente
                    </p>
                  )}
                </div>
              </div>

              {/* Sección de Selección de Ubicaciones en Mapa */}
              <FormField
                control={companyForm.control}
                name="locations"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <MapPin className="w-5 h-5" />
                      Ubicaciones de la Empresa <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <div className="space-y-4">
                        {/* Instrucciones */}
                        <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                          <p className="text-sm text-blue-700 dark:text-blue-300">
                            📍 Agrega una o más ubicaciones para tu empresa. La primera ubicación será marcada como principal por defecto.
                          </p>
                        </div>

                        {/* MultiLocationPicker */}
                        <MultiLocationPicker
                          initialLocations={locations}
                          onChange={(newLocations) => {
                            setLocations(newLocations);
                            field.onChange(newLocations);
                          }}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={companyForm.control}
                name="descripcionEmpresa"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descripción de la Empresa <span className="text-red-500">*</span></FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Describe tu empresa, servicios o productos..." 
                        rows={4}
                        autoComplete="nope"
                        readOnly
                        onFocus={(e) => {
                          e.target.removeAttribute('readonly');
                        }}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={companyForm.control}
                name="sitioWeb"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sitio Web (Opcional)</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="https://www.empresa.com" 
                        autoComplete="nope"
                        readOnly
                        onFocus={(e) => {
                          e.target.removeAttribute('readonly');
                        }}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-3">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setCurrentStep(1)}
                  className="flex-1"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Atrás
                </Button>
                <Button type="submit" className="flex-1" style={{ backgroundColor: '#bcce16' }}>
                  Continuar <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </form>
          </Form>
        );

      case 3:
        return (
          <div className="space-y-6" id="elige-plan-section">
            <div className="text-center mb-6">
              <h3 className="text-xl font-semibold mb-2">Verificar y Seleccionar Plan de Membresía</h3>
              <p className="text-gray-600">Confirma tu plan y elige la periodicidad de pago</p>
            </div>

            {isLoadingMemberships ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="animate-spin w-12 h-12 border-4 border-[#bcce16] border-t-transparent rounded-full mb-4"></div>
                <p className="text-gray-600">Cargando planes de membresía...</p>
              </div>
            ) : (
              <>
                <div className="flex gap-4 justify-center mb-6">
                  <Button
                    variant={selectedPeriod === "mensual" ? "default" : "outline"}
                    onClick={() => setSelectedPeriod("mensual")}
                  >
                    Mensual
                  </Button>
                  <Button
                    variant={selectedPeriod === "anual" ? "default" : "outline"}
                    onClick={() => setSelectedPeriod("anual")}
                    style={{ backgroundColor: selectedPeriod === "anual" ? '#bcce16' : undefined }}
                  >
                    Anual <Badge variant="secondary" className="ml-2">Ahorra 9%</Badge>
                  </Button>
                </div>

                {selectedMembership ? (
              // Mostrar plan preseleccionado con verificación
              <div className="space-y-6">
                {/* Selector de plan: permite cambiar entre Básico y Premium */}
                {(memberships as MembershipType[]).length > 1 && (
                  <div className="bg-white border-2 border-gray-200 rounded-lg p-4">
                    <p className="font-semibold text-gray-800 mb-3 text-center">
                      Elige tu plan
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {(memberships as MembershipType[]).map((membership) => {
                        const isSelected = selectedMembership.id === membership.id;
                        return (
                          <button
                            key={membership.id}
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() => setSelectedMembership(membership)}
                            className={`p-4 rounded-lg border-2 text-left transition-all ${
                              isSelected
                                ? 'border-[#bcce16] bg-green-50 ring-2 ring-[#bcce16]'
                                : 'border-gray-200 hover:border-[#bcce16]'
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <Crown className={`h-4 w-4 ${isSelected ? 'text-[#bcce16]' : 'text-gray-400'}`} />
                              <span className="font-bold">{membership.nombrePlan}</span>
                              {isSelected && <CheckCircle className="h-4 w-4 text-[#bcce16] ml-auto" />}
                            </div>
                            <p className="text-lg font-bold text-[#bcce16]">
                              {formatMoney(getSelectedPrice(membership))}
                              <span className="text-xs text-gray-500 font-normal ml-1">
                                {selectedPeriod === "anual" ? "/año" : "/mes"}
                              </span>
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-blue-600" />
                    <p className="text-blue-800 font-semibold">
                      Plan Preseleccionado - Verificar Antes de Pagar
                    </p>
                  </div>
                  <p className="text-blue-700 text-sm mt-1">
                    Revisa los detalles y cambia el plan o la periodicidad si lo deseas
                  </p>
                </div>
                
                {/* Verificación del plan seleccionado - NUEVA FUNCIONALIDAD */}
                <Card className="border-4 border-orange-400 bg-orange-50 shadow-lg">
                  <CardHeader className="bg-orange-100">
                    <CardTitle className="text-orange-800 flex items-center gap-2 text-lg">
                      <CheckCircle className="h-6 w-6" />
                      🔍 VERIFICAR TU SELECCIÓN
                    </CardTitle>
                    <p className="text-orange-700 text-sm">Confirma los detalles antes del pago</p>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="space-y-4 bg-white p-4 rounded-lg">
                      <div className="flex justify-between text-lg">
                        <span className="font-bold">Plan:</span>
                        <span className="text-[#bcce16] font-bold">{selectedMembership.nombrePlan}</span>
                      </div>
                      <div className="flex justify-between text-lg">
                        <span className="font-bold">Periodicidad:</span>
                        <span className="capitalize font-bold text-blue-600">{selectedPeriod}</span>
                      </div>
                      <div className="flex justify-between text-xl">
                        <span className="font-bold">Precio Final:</span>
                        <span className="font-bold text-[#bcce16] text-2xl">
                          {formatMoney(getSelectedPrice(selectedMembership))}{selectedPeriod === "anual" ? "/año" : "/mes"}
                        </span>
                      </div>
                      {selectedPeriod === "anual" && (
                        <div className="bg-green-100 p-3 rounded-lg">
                          <div className="text-green-800 font-bold text-center">
                            🎉 AHORRO ESPECIAL: 9% de descuento pagando anualmente
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                
                <Card className="border-2 border-[#bcce16] shadow-lg">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Crown className="h-5 w-5 text-[#bcce16]" />
                          {selectedMembership.nombrePlan}
                        </CardTitle>
                        <p className="text-gray-600 mt-1">{selectedMembership.descripcionPlan}</p>
                      </div>
                    </div>
                  </CardHeader>
                  {selectedMembership.beneficios && (
                    <CardContent>
                      <div className="space-y-2">
                        {(Array.isArray(selectedMembership.beneficios) ? selectedMembership.beneficios : selectedMembership.beneficios ? selectedMembership.beneficios.toString().split('\n') : []).map((benefit: string, idx: number) => (
                          <div key={idx} className="flex items-center gap-2 text-sm">
                            <Star className="h-4 w-4 text-[#bcce16]" />
                            {benefit}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  )}
                </Card>


              </div>
            ) : (
              // Mostrar todos los planes para selección
              <div className="grid gap-6">
                {(memberships as MembershipType[]).map((membership: MembershipType) => {
                  const price = getSelectedPrice(membership);
                  return (
                    <Card 
                      key={membership.id} 
                      className="cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-[#bcce16]"
                      onClick={() => handleMembershipSelect(membership)}
                    >
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="flex items-center gap-2">
                              <Crown className="h-5 w-5 text-[#bcce16]" />
                              {membership.nombrePlan}
                            </CardTitle>
                            <p className="text-gray-600 mt-1">{membership.descripcionPlan}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-[#bcce16]">
                              {formatMoney(price)}
                            </p>
                            <p className="text-sm text-gray-500">
                              {selectedPeriod === "anual" ? "por año" : "por mes"}
                            </p>
                          </div>
                        </div>
                      </CardHeader>
                      
                      {/* Opciones de precios disponibles */}
                      <CardContent className="pt-0">
                        <div className="space-y-3 mb-4">
                          <h4 className="text-sm font-medium text-gray-700">Opciones de Pago:</h4>
                          <div className="grid gap-2">
                            {membership.opcionesPrecios.map((opcion, index) => (
                              <div 
                                key={index}
                                className={`p-2 rounded border text-sm ${
                                  selectedPeriod === opcion.periodicidad 
                                    ? 'border-[#bcce16] bg-green-50 text-green-800' 
                                    : 'border-gray-200 text-gray-600'
                                }`}
                              >
                                <div className="flex justify-between items-center">
                                  <span className="capitalize font-medium">{opcion.periodicidad}</span>
                                  <span className="font-bold">{formatMoney(opcion.costo)}</span>
                                </div>
                                {opcion.periodicidad === "anual" && (
                                  <div className="text-xs text-green-600 mt-1">
                                    Ahorro recomendado
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        {membership.beneficios && (
                          <div className="space-y-2 border-t pt-3">
                            <h4 className="text-sm font-medium text-gray-700">Beneficios incluidos:</h4>
                            {(Array.isArray(membership.beneficios) 
                              ? membership.beneficios 
                              : membership.beneficios?.split('\n') || []
                            ).map((benefit: string, idx: number) => (
                              <div key={idx} className="flex items-center gap-2 text-sm">
                                <Star className="h-4 w-4 text-[#bcce16]" />
                                {benefit}
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            <div className="flex gap-4 mt-6">
              <Button 
                variant="outline" 
                onClick={() => setCurrentStep(2)}
                className="flex-1"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver a Datos de Empresa
              </Button>
              {selectedMembership && (
                <Button 
                  onClick={() => createPaymentMutation.mutate()}
                  className="flex-1"
                  style={{ backgroundColor: '#bcce16' }}
                  disabled={createPaymentMutation.isPending}
                >
                  {createPaymentMutation.isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Preparando...
                    </>
                  ) : (
                    <>
                      Proceder al Pago
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              )}
            </div>
          </>
        )}
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-xl font-semibold mb-2">Completa tu Pago</h3>
              <p className="text-gray-600">
                Plan: {selectedMembership?.nombrePlan} - {formatMoney(getSelectedPrice(selectedMembership!))} {selectedPeriod}
              </p>
            </div>

            {clientSecret ? (
              <Elements stripe={stripePromise} options={{ clientSecret }}>
                <PaymentForm
                  clientSecret={clientSecret}
                  onSuccess={handlePaymentSuccess}
                  onError={handlePaymentError}
                  isProcessing={isProcessing}
                  onGoBack={() => setCurrentStep(3)}
                />
              </Elements>
            ) : (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#bcce16] mx-auto mb-4"></div>
                <p className="text-gray-600">Preparando el sistema de pago...</p>
              </div>
            )}
          </div>
        );

      case 5:
        return (
          <div className="text-center space-y-6">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
            <div>
              <h3 className="text-2xl font-semibold mb-2">¡Registro Completado!</h3>
              <p className="text-gray-600 mb-4">
                Tu cuenta y empresa han sido creadas exitosamente
              </p>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-green-800">
                  <strong>Usuario:</strong> {userData?.nombre}<br />
                  <strong>Empresa:</strong> {companyData?.nombreEmpresa}<br />
                  <strong>Plan:</strong> {selectedMembership?.nombrePlan}
                </p>
              </div>
            </div>
            <Button 
              onClick={() => setLocation("/login-representante")}
              className="w-full"
              style={{ backgroundColor: '#bcce16' }}
            >
              Iniciar Sesión
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto max-w-2xl px-4">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = currentStep === step.id;
              const isCompleted = currentStep > step.id;
              
              return (
                <div key={step.id} className="flex items-center">
                  <div
                    className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                      isCompleted
                        ? "bg-[#bcce16] border-[#bcce16] text-white"
                        : isActive
                        ? "border-[#bcce16] text-[#bcce16]"
                        : "border-gray-300 text-gray-400"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`w-16 h-0.5 ml-2 ${
                        isCompleted ? "bg-[#bcce16]" : "bg-gray-300"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <Progress value={(currentStep / steps.length) * 100} className="h-2" />
        </div>

        {/* Main Content */}
        <Card>
          <CardHeader>
            <CardTitle className="text-center">
              {steps.find(s => s.id === currentStep)?.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {renderStepContent()}
          </CardContent>
        </Card>

        {/* Back to Home */}
        <div className="text-center mt-6">
          <Button variant="ghost" onClick={() => setLocation("/")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver al Inicio
          </Button>
        </div>
      </div>
    </div>
  );
}