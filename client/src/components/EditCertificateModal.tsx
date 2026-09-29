import { useEffect, useState, useCallback } from "react";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
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
import { certificateFormSchema, Certificate, CertificateFormData } from "@shared/schema";
import { Award, Upload, X, Users } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";

interface EditCertificateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  certificate: Certificate | null;
}

export default function EditCertificateModal({ open, onOpenChange, certificate }: EditCertificateModalProps) {
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  
  // Estados para manejar archivos de imagen
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");

  // Funciones para manejar archivos de imagen
  const validateImage = (file: File): string | null => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    const maxSize = 2 * 1024 * 1024;

    if (!allowedTypes.includes(file.type)) {
      return 'Solo se permiten archivos de imagen (JPG, PNG, GIF)';
    }

    if (file.size > maxSize) {
      return 'La imagen supera el tamaño máximo permitido de 2 MB. Selecciona una imagen más ligera.';
    }

    return null;
  };

  const handleImageChange = (file: File | null) => {
    if (!file) {
      setImageFile(null);
      setImagePreview("");
      form.setValue("imagenUrl", "");
      return;
    }

    const validationError = validateImage(file);
    if (validationError) {
      toast({
        title: "Error en el archivo",
        description: validationError,
        variant: "destructive",
      });
      return;
    }

    setImageFile(file);
    
    // Crear preview de la imagen
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Limpiar el campo de URL ya que ahora usaremos el archivo
    form.setValue("imagenUrl", "");
  };

  const handleImageDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      handleImageChange(file);
    }
  }, []);

  const handleImageDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  // Obtener tipos de membresía para la selección
  const { data: membershipTypes = [] } = useQuery<any[]>({
    queryKey: ["/api/membership-types"],
    enabled: isAdmin // Solo cargar si es admin
  });

  const form = useForm<CertificateFormData>({
    resolver: zodResolver(certificateFormSchema),
    defaultValues: {
      nombreCertificado: "",
      descripcion: "",
      entidadEmisora: "",
      fechaEmision: "",
      fechaVencimiento: "",
      imagenUrl: "",
      estado: "activo",
      asignacionAutomatica: false,
      planesMembresia: [],
      creadoPorAdmin: true,
    },
  });

  useEffect(() => {
    if (certificate?.id && open) {
      const fechaEmision = certificate.fechaEmision 
        ? new Date(certificate.fechaEmision).toISOString().split('T')[0]
        : "";
      const fechaVencimiento = certificate.fechaVencimiento 
        ? new Date(certificate.fechaVencimiento).toISOString().split('T')[0]
        : "";

      // Normalizar planesMembresia a strings (siempre array de strings)
      const normalizedPlanIds = Array.isArray(certificate.membershipPlanIds) 
        ? certificate.membershipPlanIds.map(id => String(id))
        : [];

      console.log('🔄 Hidratando modal de editar:', {
        certificateId: certificate.id,
        asignacionAutomatica: certificate.asignacionAutomatica,
        membershipPlanIds: certificate.membershipPlanIds,
        normalizedPlanIds
      });

      const formData = {
        nombreCertificado: certificate.nombreCertificado || "",
        descripcion: certificate.descripcion || "",
        entidadEmisora: certificate.entidadEmisora || "",
        fechaEmision,
        fechaVencimiento,
        imagenUrl: certificate.imagenUrl || "",
        estado: certificate.estado || "activo",
        asignacionAutomatica: !!certificate.asignacionAutomatica,
        planesMembresia: normalizedPlanIds,
        creadoPorAdmin: certificate.creadoPorAdmin !== undefined ? certificate.creadoPorAdmin : true,
      };

      console.log('✅ Datos para form.reset:', formData);
      form.reset(formData);

      // Limpiar estados de archivo de imagen al cargar certificado existente
      setImageFile(null);
      setImagePreview("");
    }
  }, [certificate?.id, open]);

  const updateCertificateMutation = useMutation({
    mutationFn: async (data: CertificateFormData) => {
      if (!certificate) throw new Error("No certificate selected");
      
      // Si hay archivo de imagen nuevo, usar FormData
      if (imageFile) {
        const formData = new FormData();
        
        // Agregar todos los campos del formulario (sin imagenUrl ya que estamos subiendo nuevo archivo)
        Object.entries(data).forEach(([key, value]) => {
          if (key === 'imagenUrl') return; // Omitir imagenUrl cuando hay nuevo archivo
          if (key === 'planesMembresia' && Array.isArray(value)) {
            formData.append(key, JSON.stringify(value));
          } else if (key === 'asignacionAutomatica' || key === 'creadoPorAdmin') {
            formData.append(key, value ? 'true' : 'false');
          } else if (value !== undefined && value !== null && value !== '') {
            formData.append(key, value.toString());
          }
        });
        
        // Agregar fechas en formato ISO yyyy-mm-dd (ya vienen así del input date)
        if (data.fechaEmision) {
          formData.append("fechaEmision", data.fechaEmision);
        }
        if (data.fechaVencimiento) {
          formData.append("fechaVencimiento", data.fechaVencimiento);
        }
        
        // Agregar archivo de imagen
        formData.append("imageFile", imageFile);

        console.log('Enviando FormData con archivo de imagen nuevo');
        const response = await apiRequest("PUT", `/api/certificates/${certificate.id}`, formData);
        return response.json();
      } else {
        // Sin archivo nuevo, usar JSON y mantener imagenUrl existente
        const certificateData = {
          ...data,
          // Mantener imagenUrl existente si no cambió la imagen
          imagenUrl: data.imagenUrl || certificate.imagenUrl,
          // Fechas ya vienen en formato yyyy-mm-dd del input date
          fechaEmision: data.fechaEmision || null,
          fechaVencimiento: data.fechaVencimiento || null,
          planesMembresia: data.planesMembresia || [],
          asignacionAutomatica: data.asignacionAutomatica || false,
          creadoPorAdmin: data.creadoPorAdmin || true,
        };
        console.log('Enviando datos de actualización (sin cambiar imagen):', certificateData);
        const response = await apiRequest("PUT", `/api/certificates/${certificate.id}`, certificateData);
        return response.json();
      }
    },
    onSuccess: (updatedCertificate) => {
      console.log('Certificado actualizado exitosamente:', updatedCertificate);
      // Invalidar todas las queries relacionadas con certificados
      queryClient.invalidateQueries({ queryKey: ["/api/certificates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/certificates", { userRole: 'admin' }] });
      // El dashboard del representante muestra los certificados desde los datos
      // de la empresa, así que se invalidan también esas queries.
      queryClient.invalidateQueries({
        predicate: (q) =>
          typeof q.queryKey[0] === "string" &&
          (q.queryKey[0] as string).startsWith("/api/representative/dashboard"),
      });
      toast({
        title: "Certificado actualizado",
        description: "El certificado ha sido actualizado exitosamente",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error al actualizar certificado",
        description: error.message || "Ocurrió un error inesperado",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CertificateFormData) => {
    updateCertificateMutation.mutate(data);
  };

  if (!certificate) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Editar Certificado
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="nombreCertificado"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre del Certificado *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Ej: Certificación ISO 9001"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="descripcion"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      value={field.value || ""}
                      placeholder="Descripción del certificado o premio obtenido"
                      className="min-h-[100px]"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="entidadEmisora"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Entidad Emisora</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value || ""}
                      placeholder="Organización que emitió el certificado"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="fechaEmision"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha de Emisión</FormLabel>
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
                name="fechaVencimiento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fecha de Vencimiento</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value || ""}
                        type="date"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Campo de imagen con drag and drop y preview */}
            <div>
              <FormLabel>Imagen del Certificado</FormLabel>
              <FormDescription className="mb-2">
                Sube una imagen del certificado o premio (JPG, PNG, GIF • Máximo 2 MB)
              </FormDescription>
              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors cursor-pointer bg-gray-50 hover:bg-gray-100"
                onDrop={handleImageDrop}
                onDragOver={handleImageDragOver}
                onClick={() => document.getElementById('image-input')?.click()}
              >
                {imageFile ? (
                  <div className="space-y-4">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="h-40 w-auto mx-auto rounded-lg object-cover shadow-md"
                    />
                    <div className="flex items-center justify-center gap-3">
                      <div>
                        <p className="font-medium">{imageFile.name}</p>
                        <p className="text-sm text-gray-500">
                          {(imageFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleImageChange(null);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : form.watch("imagenUrl") ? (
                  <div className="space-y-4">
                    <img
                      src={form.watch("imagenUrl")}
                      alt="Imagen actual"
                      className="h-40 w-auto mx-auto rounded-lg object-cover shadow-md"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    <div className="flex items-center justify-center gap-3">
                      <div className="text-center">
                        <p className="font-medium text-green-700">Imagen actual del certificado</p>
                        <p className="text-xs text-gray-500">Haz clic para cambiar la imagen</p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          form.setValue("imagenUrl", "");
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Upload className="h-12 w-12 text-gray-400 mx-auto" />
                    <div>
                      <p className="text-sm text-gray-600">
                        Arrastra y suelta tu imagen aquí, o{" "}
                        <span className="text-primary cursor-pointer hover:underline">
                          selecciona archivo
                        </span>
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        JPG, PNG, GIF • Máximo 2 MB
                      </p>
                    </div>
                  </div>
                )}
                <input
                  id="image-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleImageChange(file);
                    }
                  }}
                />
              </div>

              {/* Campo de URL alternativo - oculto por defecto, más cómodo */}
              {!imageFile && !form.watch("imagenUrl") && (
                <details className="mt-4">
                  <summary className="text-sm text-gray-600 cursor-pointer hover:text-gray-800 transition-colors">
                    ¿Prefieres ingresar una URL? (Opcional)
                  </summary>
                  <div className="mt-2 p-3 bg-gray-50 rounded">
                    <FormField
                      control={form.control}
                      name="imagenUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm">URL de la imagen:</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              value={field.value || ""}
                              type="url"
                              placeholder="https://ejemplo.com/certificado.jpg"
                              onChange={(e) => {
                                field.onChange(e);
                                // Si ingresa URL, limpiar archivo
                                if (e.target.value) {
                                  setImageFile(null);
                                  setImagePreview("");
                                }
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </details>
              )}
            </div>

            <FormField
              control={form.control}
              name="estado"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estado</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona el estado" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="activo">Activo</SelectItem>
                      <SelectItem value="inactivo">Inactivo</SelectItem>
                      <SelectItem value="vencido">Vencido</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Campos de asignación automática - Solo para administradores */}
            {isAdmin && (
              <div className="border rounded-lg p-4 space-y-3">
                <FormField
                  control={form.control}
                  name="asignacionAutomatica"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-start space-x-3">
                        <FormControl>
                          <Checkbox
                            id="asignacionAutomatica"
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1">
                          <Label htmlFor="asignacionAutomatica" className="cursor-pointer">
                            Asignar automáticamente a planes de membresía
                          </Label>
                          <p className="text-sm text-gray-600">
                            Si está habilitado, este certificado se asignará automáticamente a las empresas de los planes seleccionados
                          </p>
                        </div>
                      </div>
                    </FormItem>
                  )}
                />

                {form.watch("asignacionAutomatica") && (
                  <FormField
                    control={form.control}
                    name="planesMembresia"
                    render={({ field }) => (
                      <FormItem>
                        <Label className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Planes de Membresía Asociados
                        </Label>
                        <p className="text-sm text-gray-600 mb-3">
                          Selecciona los planes que tendrán acceso automático a este certificado
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {membershipTypes.map((plan: any) => (
                            <div key={plan.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={`edit-plan-${plan.id}`}
                                checked={(field.value || []).includes(String(plan.id))}
                                onCheckedChange={(checked) => {
                                  const currentIds = field.value || [];
                                  if (checked) {
                                    field.onChange([...currentIds, String(plan.id)]);
                                  } else {
                                    field.onChange(currentIds.filter((id: string) => id !== String(plan.id)));
                                  }
                                }}
                              />
                              <label
                                htmlFor={`edit-plan-${plan.id}`}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                              >
                                {plan.nombrePlan}
                              </label>
                            </div>
                          ))}
                        </div>
                      </FormItem>
                    )}
                  />
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={updateCertificateMutation.isPending}
                className="bg-[#bcce16] hover:bg-[#a8b814] text-black"
              >
                {updateCertificateMutation.isPending ? "Actualizando..." : "Guardar Cambios"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}