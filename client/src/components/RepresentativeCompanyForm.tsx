import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Building, Save, Edit, X, Upload, Trash2, MapPin, Globe, Phone, Mail, Tag, Image as ImageIcon } from "lucide-react";
import type { CompanyWithDetails, Category, MembershipType } from "@shared/schema";

const representativeCompanySchema = z.object({
  nombreEmpresa: z.string().min(1, "El nombre de la empresa es requerido"),
  telefono1: z.string().min(1, "El teléfono principal es requerido"),
  telefono2: z.string().optional(),
  email1: z.string().email("Email inválido").min(1, "El email principal es requerido"),
  email2: z.string().email("Email inválido").optional().or(z.literal("")),
  sitioWeb: z.string().url("URL inválida").optional().or(z.literal("")),
  direccionFisica: z.string().min(1, "La dirección física es requerida"),
  descripcionEmpresa: z.string().min(10, "La descripción debe tener al menos 10 caracteres"),
  catalogoDigitalUrl: z.string().url("URL inválida").optional().or(z.literal("")),
  categoriesIds: z.array(z.number()).optional(),
  paisesPresencia: z.array(z.string()).optional(),
  estadosPresencia: z.array(z.string()).optional(),
  ciudadesPresencia: z.array(z.string()).optional(),
  ubicacionPrincipal: z.string().optional(),
  representantesVentas: z.array(z.string()).optional(),
  redesSociales: z.array(z.object({
    plataforma: z.string(),
    url: z.string().url()
  })).optional(),
  videosUrls: z.array(z.string().url()).optional(),
  galeriaProductosUrls: z.array(z.string()).optional(),
});

type RepresentativeCompanyFormData = z.infer<typeof representativeCompanySchema>;

interface RepresentativeCompanyFormProps {
  company: CompanyWithDetails;
}

export default function RepresentativeCompanyForm({ company }: RepresentativeCompanyFormProps) {
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<RepresentativeCompanyFormData>({
    resolver: zodResolver(representativeCompanySchema),
    defaultValues: {
      nombreEmpresa: company.nombreEmpresa || "",
      telefono1: company.telefono1 || "",
      telefono2: company.telefono2 || "",
      email1: company.email1 || "",
      email2: company.email2 || "",
      sitioWeb: company.sitioWeb || "",
      direccionFisica: company.direccionFisica || "",
      descripcionEmpresa: company.descripcionEmpresa || "",
      catalogoDigitalUrl: company.catalogoDigitalUrl || "",
    },
  });

  const updateCompanyMutation = useMutation({
    mutationFn: async (data: RepresentativeCompanyFormData) => {
      const response = await apiRequest("PUT", `/api/companies/${company.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      queryClient.invalidateQueries({ queryKey: [`/api/companies/${company.id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/representative/dashboard"] });
      toast({
        title: "Empresa actualizada",
        description: "La información de la empresa ha sido actualizada exitosamente",
      });
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error al actualizar empresa",
        description: error.message || "Ocurrió un error inesperado",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: RepresentativeCompanyFormData) => {
    updateCompanyMutation.mutate(data);
  };

  const handleCancel = () => {
    form.reset({
      nombreEmpresa: company.nombreEmpresa || "",
      telefono1: company.telefono1 || "",
      telefono2: company.telefono2 || "",
      email1: company.email1 || "",
      email2: company.email2 || "",
      sitioWeb: company.sitioWeb || "",
      direccionFisica: company.direccionFisica || "",
      descripcionEmpresa: company.descripcionEmpresa || "",
      catalogoDigitalUrl: company.catalogoDigitalUrl || "",
    });
    setIsEditing(false);
  };

  if (!isEditing) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Información de la Empresa
            </CardTitle>
            <Button
              variant="outline"
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-2"
            >
              <Edit className="h-4 w-4" />
              Editar
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-sm font-medium text-gray-600">Nombre de la Empresa</label>
                <p className="text-sm font-semibold text-gray-900 mt-1">{company.nombreEmpresa}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Teléfono Principal</label>
                <p className="text-sm text-gray-900 mt-1">{company.telefono1}</p>
              </div>
              {company.telefono2 && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Teléfono Secundario</label>
                  <p className="text-sm text-gray-900 mt-1">{company.telefono2}</p>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-gray-600">Email Principal</label>
                <p className="text-sm text-gray-900 mt-1">{company.email1}</p>
              </div>
              {company.email2 && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Email Secundario</label>
                  <p className="text-sm text-gray-900 mt-1">{company.email2}</p>
                </div>
              )}
              {company.sitioWeb && (
                <div>
                  <label className="text-sm font-medium text-gray-600">Sitio Web</label>
                  <p className="text-sm text-gray-900 mt-1">
                    <a href={company.sitioWeb} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      {company.sitioWeb}
                    </a>
                  </p>
                </div>
              )}
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-600">Dirección Física</label>
              <p className="text-sm text-gray-900 mt-1">{company.direccionFisica}</p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-600">Descripción de la Empresa</label>
              <p className="text-sm text-gray-900 mt-1">{company.descripcionEmpresa}</p>
            </div>
            
            {company.catalogoDigitalUrl && (
              <div>
                <label className="text-sm font-medium text-gray-600">Catálogo Digital</label>
                <p className="text-sm text-gray-900 mt-1">
                  <a href={company.catalogoDigitalUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    {company.catalogoDigitalUrl}
                  </a>
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building className="h-5 w-5" />
          Editar Información de la Empresa
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="nombreEmpresa"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre de la Empresa *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Nombre de la empresa" />
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
                    <FormLabel>Teléfono Principal *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="+52 777 123 4567" />
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
                      <Input {...field} placeholder="+52 777 987 6543" />
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
                    <FormLabel>Email Principal *</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} placeholder="contacto@empresa.com" />
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
                      <Input type="email" {...field} placeholder="ventas@empresa.com" />
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
                    <FormLabel>Sitio Web</FormLabel>
                    <FormControl>
                      <Input type="url" {...field} placeholder="https://www.empresa.com" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="direccionFisica"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dirección Física *</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Dirección completa de la empresa" rows={3} />
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
                  <FormLabel>Descripción de la Empresa *</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Descripción detallada de la empresa, servicios y productos" rows={4} />
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
                  <FormLabel>Catálogo Digital</FormLabel>
                  <FormControl>
                    <Input type="url" {...field} placeholder="https://catalogo.empresa.com" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                className="flex items-center gap-2"
              >
                <X className="h-4 w-4" />
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={updateCompanyMutation.isPending}
                className="bg-[#bcce16] hover:bg-[#a8b814] text-black flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                {updateCompanyMutation.isPending ? "Guardando..." : "Guardar Cambios"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}