import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, FileImage, Calendar, Building2, Shield, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import EditCertificateModal from "@/components/EditCertificateModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Certificate, CertificateFormData } from "@shared/schema";
import { certificateFormSchema } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Swal from "sweetalert2";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Certificates() {
  const [open, setOpen] = useState(false);
  const [editingCertificate, setEditingCertificate] = useState<Certificate | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [dragActive, setDragActive] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Usa el fetcher global de React Query, que adjunta la identidad del usuario
  // (header x-user-info). El backend deriva el rol de la sesión: un administrador
  // recibe todos los certificados. Ya no se depende del parámetro ?userRole.
  const { data: certificates = [], isLoading } = useQuery<Certificate[]>({
    queryKey: ["/api/certificates"],
  });

  const { data: membershipTypes = [] } = useQuery<any[]>({
    queryKey: ["/api/membership-types"],
  });

  const form = useForm<CertificateFormData>({
    resolver: zodResolver(certificateFormSchema),
    defaultValues: {
      nombreCertificado: "",
      imagenUrl: "",
      descripcion: "",
      fechaEmision: "",
      fechaVencimiento: "",
      entidadEmisora: "",
      estado: "activo",
      asignacionAutomatica: false,
      planesMembresia: [],
      creadoPorAdmin: true,
    },
  });


  const createMutation = useMutation({
    mutationFn: async (data: CertificateFormData) => {
      console.log("Enviando datos del certificado:", data);
      const response = await apiRequest("POST", "/api/certificates", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/certificates"] });
      toast({ title: "Certificado creado exitosamente" });
      setOpen(false);
      form.reset();
      setSelectedImage(null);
      setImagePreview("");
    },
    onError: (error: any) => {
      console.error("Error al crear certificado:", error);
      const errorMessage = error?.message || "Error al crear certificado";
      toast({ 
        title: "Error al crear certificado", 
        description: errorMessage,
        variant: "destructive" 
      });
    },
  });


  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/certificates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/certificates"] });
      toast({ title: "Certificado eliminado exitosamente" });
    },
    onError: () => {
      toast({ title: "Error al eliminar certificado", variant: "destructive" });
    },
  });

  const onSubmit = (data: CertificateFormData) => {
    createMutation.mutate(data);
  };


  const handleEdit = (certificate: Certificate) => {
    setEditingCertificate(certificate);
    setEditOpen(true);
  };

  const handleDelete = async (id: number) => {
    const result = await Swal.fire({
      title: '¿Eliminar certificado?',
      text: 'Esta acción no se puede deshacer',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true
    });

    if (result.isConfirmed) {
      await deleteMutation.mutateAsync(id);
    }
  };

  const validateImage = (file: File): Promise<boolean> => {
    return new Promise((resolve) => {
      if (file.size > 2 * 1024 * 1024) {
        toast({ title: "La imagen supera el tamaño máximo permitido de 2 MB. Selecciona una imagen más ligera.", variant: "destructive" });
        resolve(false);
        return;
      }

      if (!file.type.startsWith('image/')) {
        toast({ title: "Solo se permiten archivos de imagen", variant: "destructive" });
        resolve(false);
        return;
      }

      resolve(true);
    });
  };

  const processImageToSquare = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        const size = Math.min(img.width, img.height);
        canvas.width = size;
        canvas.height = size;
        
        const offsetX = (img.width - size) / 2;
        const offsetY = (img.height - size) / 2;
        
        ctx?.drawImage(img, offsetX, offsetY, size, size, 0, 0, size, size);
        const result = canvas.toDataURL('image/jpeg', 0.8);
        const base64 = result.slice(result.indexOf(',') + 1);
        const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
        const decodedBytes = Math.floor(base64.length * 3 / 4) - padding;
        if (decodedBytes > 2 * 1024 * 1024) {
          reject(new Error("La imagen supera el tamaño máximo permitido de 2 MB. Selecciona una imagen más ligera."));
          return;
        }
        resolve(result);
      };
      
      img.src = URL.createObjectURL(file);
    });
  };

  const handleImageChange = async (file: File) => {
    if (await validateImage(file)) {
      setSelectedImage(file);
      try {
        const processedImage = await processImageToSquare(file);
        setImagePreview(processedImage);
        form.setValue("imagenUrl", processedImage);
      } catch (error: any) {
        toast({ title: error.message, variant: "destructive" });
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleImageChange(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-32">Cargando certificados...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-[#4a4a49]">Certificados</h1>
          <p className="text-gray-600">Gestiona los certificados de la plataforma</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#0f2161] hover:bg-[#0f2161]/90">
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Certificado
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Crear Nuevo Certificado</DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="nombreCertificado">Nombre del Certificado</Label>
                <Input
                  id="nombreCertificado"
                  {...form.register("nombreCertificado")}
                  placeholder="Ej: ISO 9001:2015"
                />
                {form.formState.errors.nombreCertificado && (
                  <p className="text-sm text-red-500">{form.formState.errors.nombreCertificado.message}</p>
                )}
              </div>

              <div>
                <Label>Imagen del Certificado — Tamaño máximo: 2 MB</Label>
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    dragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
                  }`}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                >
                  {imagePreview ? (
                    <div className="space-y-4">
                      <img src={imagePreview} alt="Preview" className="max-w-xs mx-auto rounded-lg" />
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => {
                          setImagePreview("");
                          setSelectedImage(null);
                          form.setValue("imagenUrl", "");
                        }}
                      >
                        Cambiar imagen
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <FileImage className="h-12 w-12 mx-auto text-gray-400" />
                      <div>
                        <p className="text-gray-600">Arrastra una imagen aquí o</p>
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleImageChange(file);
                          }}
                          className="mt-2"
                        />
                      </div>
                      <p className="text-sm text-gray-500">Máximo 2 MB. Se recortará automáticamente a formato cuadrado.</p>
                    </div>
                  )}
                </div>
                {form.formState.errors.imagenUrl && (
                  <p className="text-sm text-red-500">{form.formState.errors.imagenUrl.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="descripcion">Descripción</Label>
                <Textarea
                  id="descripcion"
                  {...form.register("descripcion")}
                  placeholder="Descripción del certificado"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="fechaEmision">Fecha de Emisión</Label>
                  <Input
                    id="fechaEmision"
                    type="date"
                    {...form.register("fechaEmision")}
                  />
                </div>
                <div>
                  <Label htmlFor="fechaVencimiento">Fecha de Vencimiento</Label>
                  <Input
                    id="fechaVencimiento"
                    type="date"
                    {...form.register("fechaVencimiento")}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="entidadEmisora">Entidad Emisora</Label>
                <Input
                  id="entidadEmisora"
                  {...form.register("entidadEmisora")}
                  placeholder="Ej: Bureau Veritas"
                />
              </div>

              <div>
                <Label htmlFor="estado">Estado</Label>
                <Select
                  value={form.watch("estado") || "activo"}
                  onValueChange={(value) => form.setValue("estado", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="activo">Activo</SelectItem>
                    <SelectItem value="inactivo">Inactivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="asignacionAutomatica"
                    checked={form.watch("asignacionAutomatica") || false}
                    onCheckedChange={(checked) => form.setValue("asignacionAutomatica", !!checked)}
                  />
                  <div className="space-y-1">
                    <Label htmlFor="asignacionAutomatica" className="cursor-pointer">
                      Asignar automáticamente a planes de membresía
                    </Label>
                    <p className="text-sm text-gray-600">
                      Si está habilitado, este certificado se asignará automáticamente a las empresas de los planes seleccionados
                    </p>
                  </div>
                </div>

                {form.watch("asignacionAutomatica") && (
                  <div>
                    <Label className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Planes de Membresía Asociados
                    </Label>
                    <p className="text-sm text-gray-600 mb-3">
                      Selecciona los planes que tendrán acceso automático a este certificado
                    </p>
                    <div className="space-y-2 max-h-40 overflow-y-auto border rounded-md p-3">
                      {membershipTypes.map((plan: any) => (
                        <label key={plan.id} className="flex items-center space-x-2 cursor-pointer">
                          <Checkbox
                            checked={form.watch("planesMembresia")?.includes(String(plan.id)) || false}
                            onCheckedChange={(checked) => {
                              const currentIds = form.getValues("planesMembresia") || [];
                              if (checked) {
                                form.setValue("planesMembresia", [...currentIds, String(plan.id)]);
                              } else {
                                form.setValue("planesMembresia", currentIds.filter(id => id !== String(plan.id)));
                              }
                            }}
                          />
                          <span className="text-sm">{plan.nombrePlan}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-2 p-3 bg-blue-50 rounded-lg">
                <Shield className="h-5 w-5 text-blue-600" />
                <div>
                  <Label className="text-sm font-medium text-blue-900">Certificado Creado por Administrador</Label>
                  <p className="text-xs text-blue-700">
                    Este certificado solo será visible para administradores y se asignará automáticamente según los planes seleccionados
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creando..." : "Crear Certificado"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {certificates.map((certificate) => (
          <Card key={certificate.id} className="overflow-hidden">
            <CardHeader className="p-0">
              <div className="aspect-square overflow-hidden">
                <img 
                  src={certificate.imagenUrl} 
                  alt={certificate.nombreCertificado}
                  className="w-full h-full object-cover"
                />
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <CardTitle className="text-lg mb-2 text-[#4a4a49]">{certificate.nombreCertificado}</CardTitle>
              
              {certificate.descripcion && (
                <p className="text-gray-600 text-sm mb-3 line-clamp-2">{certificate.descripcion}</p>
              )}
              
              <div className="space-y-2 text-sm">
                {certificate.entidadEmisora && (
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-600">{certificate.entidadEmisora}</span>
                  </div>
                )}
                
                {certificate.fechaEmision && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-600">
                      Emitido: {new Date(certificate.fechaEmision).toLocaleDateString()}
                    </span>
                  </div>
                )}
                
                {certificate.fechaVencimiento && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-600">
                      Vence: {new Date(certificate.fechaVencimiento).toLocaleDateString()}
                    </span>
                  </div>
                )}

                {(certificate as any).membershipPlanIds && (certificate as any).membershipPlanIds.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-600">
                      {(certificate as any).membershipPlanIds.length} plan(es) asociado(s)
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between mt-4">
                <div className="flex gap-2">
                  <Badge variant={certificate.estado === "activo" ? "default" : "secondary"}>
                    {certificate.estado}
                  </Badge>
                  {(certificate as any).creadoPorAdmin && (
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                      <Shield className="h-3 w-3 mr-1" />
                      Admin
                    </Badge>
                  )}
                </div>
                
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleEdit(certificate)}
                  >
                    Editar
                  </Button>
                  <Button 
                    size="sm" 
                    variant="destructive"
                    onClick={() => handleDelete(certificate.id)}
                  >
                    Eliminar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {certificates.length === 0 && (
        <div className="text-center py-12">
          <FileImage className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No hay certificados</h3>
          <p className="text-gray-500 mb-4">Comienza creando tu primer certificado</p>
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Crear Certificado
          </Button>
        </div>
      )}

      {/* Modal de edición */}
      <EditCertificateModal
        open={editOpen}
        onOpenChange={setEditOpen}
        certificate={editingCertificate}
      />
    </div>
  );
}