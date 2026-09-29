import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { changeFirebasePassword } from "@/lib/auth";
import { ArrowLeft, Camera, Save, User, Mail, Shield, Lock, Eye, EyeOff } from "lucide-react";
import { Link } from "wouter";

// Schema para validación del formulario - incluye photoURL
const accountSchema = z.object({
  displayName: z.string().min(1, "El nombre es requerido").max(100, "El nombre es muy largo"),
  email: z.string().email("Email inválido"),
  photoURL: z.string().optional(),
});

type AccountFormData = z.infer<typeof accountSchema>;

// Schema para el cambio de contraseña
const passwordSchema = z.object({
  currentPassword: z.string().min(1, "La contraseña actual es requerida"),
  newPassword: z.string().min(8, "La nueva contraseña debe tener al menos 8 caracteres"),
  confirmPassword: z.string().min(1, "Confirma tu nueva contraseña"),
})
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "La nueva contraseña debe ser diferente a la actual",
    path: ["newPassword"],
  });

type PasswordFormData = z.infer<typeof passwordSchema>;

export default function ConfigurarCuenta() {
  const { toast } = useToast();
  const { user, isAdmin, firebaseUser, refreshUser } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // No necesitamos query adicional, usamos datos del contexto
  const isLoading = false;

  // Mutation para actualizar cuenta
  const updateAccountMutation = useMutation({
    mutationFn: async (data: AccountFormData & { photoURL?: string }) => {
      const response = await apiRequest("PATCH", "/api/users/me", data);
      return response.json();
    },
    onSuccess: async (updatedUser) => {
      toast({
        title: "Cuenta actualizada",
        description: "Tu información de cuenta ha sido actualizada correctamente.",
      });
      
      // Actualizar el estado local con los datos actualizados
      if (updatedUser.photoURL) {
        setCurrentPhotoURL(updatedUser.photoURL);
      }
      
      // Actualizar la información del usuario en el contexto con los datos devueltos por la API
      // Esto evita una llamada extra a la API y sincroniza inmediatamente
      await refreshUser(updatedUser);
      
      // Invalidar queries relacionadas para mantener la cache actualizada
      queryClient.invalidateQueries({ queryKey: ["/api/users/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar la cuenta",
        variant: "destructive",
      });
    },
  });

  const form = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      displayName: user?.displayName || "",
      email: user?.email || "",
      photoURL: user?.photoURL || "",
    },
  });

  // Formulario de cambio de contraseña
  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  // Mutation para cambiar la contraseña.
  // Detecta el tipo de cuenta: Firebase (firebaseUser presente) vs. cuenta
  // manual/temporal (login con tempPassword vía /api/change-temp-password).
  const changePasswordMutation = useMutation({
    mutationFn: async (data: PasswordFormData) => {
      if (firebaseUser) {
        // Usuario autenticado con Firebase: la contraseña vive en Firebase
        await changeFirebasePassword(data.currentPassword, data.newPassword);
        return;
      }

      // Usuario manual/temporal: la contraseña (bcrypt) vive en la base de datos
      const response = await apiRequest("POST", "/api/change-temp-password", {
        userId: user?.id,
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Contraseña actualizada",
        description: "Tu contraseña ha sido cambiada correctamente.",
      });
      passwordForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo cambiar la contraseña",
        variant: "destructive",
      });
    },
  });

  const onChangePassword = (data: PasswordFormData) => {
    changePasswordMutation.mutate(data);
  };

  // Estado para manejar la URL de la foto actual
  const [currentPhotoURL, setCurrentPhotoURL] = useState("");

  // Reset form when user data loads and update photo URL
  useEffect(() => {
    if (user) {
      form.reset({
        displayName: user.displayName || "",
        email: user.email || "",
        photoURL: user.photoURL || "",
      });
      // También actualizar la URL de la foto actual
      if (user.photoURL) {
        setCurrentPhotoURL(user.photoURL);
      }
    }
  }, [user, form]);

  const onSubmit = (data: AccountFormData) => {
    // Usar la foto actual o la del usuario - ahora currentPhotoURL se actualizará correctamente
    updateAccountMutation.mutate({
      ...data,
      photoURL: currentPhotoURL || user?.photoURL || ""
    });
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await uploadProfilePhoto(file);
  };

  const uploadProfilePhoto = async (file: File) => {
    // Validar tipo de archivo
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Error",
        description: "Por favor selecciona una imagen válida",
        variant: "destructive",
      });
      return;
    }

    // Validar tamaño (máximo 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "La imagen debe ser menor a 2MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "profile");

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let reason = "Error al subir la imagen";
        try {
          const body = await response.json();
          reason = body?.error || body?.message || reason;
        } catch {}
        throw new Error(reason);
      }

      const result = await response.json();
      setCurrentPhotoURL(result.url);
      
      toast({
        title: "Imagen subida",
        description: "Imagen de perfil actualizada correctamente",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo subir la imagen",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#bcce16] mx-auto mb-4"></div>
          <p>Cargando información de cuenta...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Encabezado */}
        <div className="mb-8">
          <Link href={isAdmin ? "/dashboard" : "/representative-dashboard"}>
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Regresar al Dashboard
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Configuración de Cuenta</h1>
          <p className="text-gray-600 mt-2">
            Gestiona tu información personal y configuración de cuenta
          </p>
        </div>

        {/* Información del usuario */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Información Personal
            </CardTitle>
            <CardDescription>
              Actualiza tu información de perfil
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Foto de perfil */}
                <div
                  className="flex items-center space-x-4"
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files?.[0];
                    if (file && !isUploading) uploadProfilePhoto(file);
                  }}
                  onDragOver={(e) => e.preventDefault()}
                >
                  <Avatar className="w-20 h-20">
                    <AvatarImage 
                      src={currentPhotoURL || user?.photoURL || ""} 
                      alt="Foto de perfil" 
                    />
                    <AvatarFallback className="text-lg">
                      {user?.displayName?.[0] || user?.email?.[0] || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <label htmlFor="photo-upload" className="cursor-pointer">
                      <Button type="button" variant="outline" disabled={isUploading} asChild>
                        <span>
                          <Camera className="w-4 h-4 mr-2" />
                          {isUploading ? "Subiendo..." : "Cambiar Foto"}
                        </span>
                      </Button>
                    </label>
                    <input
                      id="photo-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageUpload}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      PNG, JPG hasta 2MB
                    </p>
                  </div>
                </div>

                {/* Nombre completo */}
                <FormField
                  control={form.control}
                  name="displayName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre Completo</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Ingresa tu nombre completo"
                          {...field}
                          data-testid="input-display-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Email */}
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Correo Electrónico</FormLabel>
                      <FormControl>
                        <Input 
                          type="email"
                          placeholder="correo@ejemplo.com"
                          {...field}
                          data-testid="input-email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Botón de guardar */}
                <div className="flex justify-end">
                  <Button 
                    type="submit" 
                    disabled={updateAccountMutation.isPending}
                    data-testid="button-save-account"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {updateAccountMutation.isPending ? "Guardando..." : "Guardar Cambios"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Cambiar contraseña */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Cambiar Contraseña
            </CardTitle>
            <CardDescription>
              Actualiza tu contraseña de acceso. La nueva contraseña debe tener al menos 8 caracteres.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...passwordForm}>
              <form onSubmit={passwordForm.handleSubmit(onChangePassword)} className="space-y-6">
                {/* Contraseña actual */}
                <FormField
                  control={passwordForm.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contraseña Actual</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showCurrentPassword ? "text" : "password"}
                            placeholder="Ingresa tu contraseña actual"
                            className="pr-10"
                            autoComplete="current-password"
                            {...field}
                            data-testid="input-current-password"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                            tabIndex={-1}
                          >
                            {showCurrentPassword ? (
                              <EyeOff className="h-4 w-4 text-gray-400" />
                            ) : (
                              <Eye className="h-4 w-4 text-gray-400" />
                            )}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Nueva contraseña */}
                <FormField
                  control={passwordForm.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nueva Contraseña</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showNewPassword ? "text" : "password"}
                            placeholder="Mínimo 8 caracteres"
                            className="pr-10"
                            autoComplete="new-password"
                            {...field}
                            data-testid="input-new-password"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            tabIndex={-1}
                          >
                            {showNewPassword ? (
                              <EyeOff className="h-4 w-4 text-gray-400" />
                            ) : (
                              <Eye className="h-4 w-4 text-gray-400" />
                            )}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Confirmar nueva contraseña */}
                <FormField
                  control={passwordForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirmar Nueva Contraseña</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showConfirmPassword ? "text" : "password"}
                            placeholder="Repite tu nueva contraseña"
                            className="pr-10"
                            autoComplete="new-password"
                            {...field}
                            data-testid="input-confirm-password"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            tabIndex={-1}
                          >
                            {showConfirmPassword ? (
                              <EyeOff className="h-4 w-4 text-gray-400" />
                            ) : (
                              <Eye className="h-4 w-4 text-gray-400" />
                            )}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    disabled={changePasswordMutation.isPending}
                    data-testid="button-change-password"
                  >
                    <Lock className="w-4 h-4 mr-2" />
                    {changePasswordMutation.isPending ? "Cambiando..." : "Cambiar Contraseña"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Información de la cuenta */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Información de la Cuenta
            </CardTitle>
            <CardDescription>
              Detalles de tu cuenta y permisos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Rol</label>
                <p className="text-sm text-gray-900 mt-1">
                  {user?.role === 'admin' ? 'Administrador' : 
                   user?.role === 'representante' ? 'Representante' : 'Usuario'}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">ID de Usuario</label>
                <p className="text-sm text-gray-900 mt-1 font-mono">{user?.id}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Fecha de Creación</label>
                <p className="text-sm text-gray-900 mt-1">
                  {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('es-ES', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  }) : 'No disponible'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}