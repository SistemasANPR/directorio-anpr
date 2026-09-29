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
import { insertCertificateSchema } from "@shared/schema";
import { Award } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";

interface AddCertificateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId?: number;
}

const formSchema = insertCertificateSchema.extend({
  fechaEmision: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export default function AddCertificateModal({ open, onOpenChange, companyId }: AddCertificateModalProps) {
  const { toast } = useToast();
  const { isAdmin } = useAuth();

  // Obtener tipos de membresía para la selección
  const { data: membershipTypes = [] } = useQuery<any[]>({
    queryKey: ["/api/membership-types"],
    enabled: isAdmin // Solo cargar si es admin
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nombreCertificado: "",
      imagenUrl: "",
      descripcion: "",
      entidadEmisora: "",
      fechaEmision: "",
      fechaVencimiento: "",
      estado: "activo",
      asignacionAutomatica: false,
      membershipPlanIds: [],
    },
  });

  const createCertificateMutation = useMutation({
    mutationFn: async (data: FormData) => {
      // Para representantes con varias empresas se envía la empresa activa; el
      // backend valida que pertenezca realmente al usuario autenticado.
      const certificateData = {
        ...data,
        companyId,
        fechaEmision: data.fechaEmision ? new Date(data.fechaEmision).toISOString() : null,
        fechaVencimiento: data.fechaVencimiento ? new Date(data.fechaVencimiento).toISOString() : null,
      };
      return apiRequest("POST", "/api/certificates", certificateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/certificates"] });
      // El dashboard del representante muestra los certificados desde los datos
      // de la empresa, así que se invalidan también esas queries.
      queryClient.invalidateQueries({
        predicate: (q) =>
          typeof q.queryKey[0] === "string" &&
          (q.queryKey[0] as string).startsWith("/api/representative/dashboard"),
      });
      toast({
        title: "Certificado creado",
        description: "El certificado ha sido agregado exitosamente",
      });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error al crear certificado",
        description: error.message || "Ocurrió un error inesperado",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    createCertificateMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Nuevo Certificado
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

            <FormField
              control={form.control}
              name="imagenUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL de la Imagen del Certificado</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value || ""}
                      type="url"
                      placeholder="https://ejemplo.com/certificado.jpg"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="estado"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estado</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
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
              <div className="space-y-4 border-t pt-4">
                <h3 className="text-lg font-semibold text-gray-900">Asignación Automática</h3>
                
                <FormField
                  control={form.control}
                  name="asignacionAutomatica"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>
                          Asignar automáticamente a planes de membresía
                        </FormLabel>
                        <div className="text-sm text-gray-500">
                          Si está habilitado, este certificado se asignará automáticamente a las empresas de los planes seleccionados
                        </div>
                      </div>
                    </FormItem>
                  )}
                />

                {form.watch("asignacionAutomatica") && (
                  <FormField
                    control={form.control}
                    name="membershipPlanIds"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Planes de Membresía</FormLabel>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {membershipTypes.map((membershipType: any) => (
                            <div key={membershipType.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={`plan-${membershipType.id}`}
                                checked={Array.isArray(field.value) && field.value.includes(membershipType.id)}
                                onCheckedChange={(checked) => {
                                  const currentValues = Array.isArray(field.value) ? field.value : [];
                                  if (checked) {
                                    field.onChange([...currentValues, membershipType.id]);
                                  } else {
                                    field.onChange(currentValues.filter((id: number) => id !== membershipType.id));
                                  }
                                }}
                              />
                              <label
                                htmlFor={`plan-${membershipType.id}`}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                              >
                                {membershipType.nombrePlan}
                              </label>
                            </div>
                          ))}
                        </div>
                        <FormMessage />
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
                disabled={createCertificateMutation.isPending}
                className="bg-[#bcce16] hover:bg-[#a8b814] text-black"
              >
                {createCertificateMutation.isPending ? "Guardando..." : "Crear"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}