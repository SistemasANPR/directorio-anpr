import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import RichTextEditor from "@/components/RichTextEditor";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, MoreHorizontal, Edit, Trash2, Crown, Check, Grid, Table as TableIcon } from "lucide-react";
import { MembershipType } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Swal from 'sweetalert2';
import MembershipDataTable from "@/components/MembershipDataTable";
import { useCurrency } from "@/lib/currency";
import { TestMembershipForm } from "@/components/TestMembershipForm";

const membershipSchema = z.object({
  nombrePlan: z.string().min(1, "El nombre del plan es requerido"),
  costo: z.number().min(0, "El costo debe ser mayor a 0"),
  periodicidad: z.string().min(1, "La periodicidad es requerida"),
  descripcionPlan: z.string().optional(),
  beneficios: z.string().optional(),
  visibilidad: z.enum(["publica", "privada"]).default("publica"),
  cantidadProductosAdmitidos: z.number().min(0, "La cantidad de productos debe ser mayor o igual a 0").default(0),
  cantidadProyectosAdmitidos: z.number().min(0, "La cantidad de proyectos debe ser mayor o igual a 0").default(0),
});

type MembershipFormData = z.infer<typeof membershipSchema>;

export default function Memberships() {
  const { format: formatMoney } = useCurrency();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "table">("table");
  const [selectedMembership, setSelectedMembership] = useState<MembershipType | null>(null);
  const { toast } = useToast();

  const form = useForm<MembershipFormData>({
    resolver: zodResolver(membershipSchema),
    defaultValues: {
      nombrePlan: "",
      costo: 0,
      periodicidad: "",
      descripcionPlan: "",
      beneficios: "",
      visibilidad: "publica",
      cantidadProductosAdmitidos: 0,
      cantidadProyectosAdmitidos: 0,
    },
  });

  const editForm = useForm<MembershipFormData>({
    resolver: zodResolver(membershipSchema),
    defaultValues: {
      nombrePlan: "",
      costo: 0,
      periodicidad: "",
      descripcionPlan: "",
      beneficios: "",
      visibilidad: "publica",
      cantidadProductosAdmitidos: 0,
      cantidadProyectosAdmitidos: 0,
    },
  });

  // Fetch memberships (admin component - can see all memberships including private ones)
  const { data: memberships = [], isLoading } = useQuery<MembershipType[]>({
    queryKey: ["/api/membership-types"],
  });

  // Create membership mutation
  const createMembershipMutation = useMutation({
    mutationFn: async (data: MembershipFormData) => {
      const membershipData = {
        nombrePlan: data.nombrePlan,
        descripcionPlan: data.descripcionPlan,
        opcionesPrecios: [{ periodicidad: data.periodicidad, costo: data.costo }],
        beneficios: data.beneficios ? data.beneficios.split('\n').filter(b => b.trim()) : [],
        visibilidad: data.visibilidad,
        cantidadProductosAdmitidos: data.cantidadProductosAdmitidos,
        cantidadProyectosAdmitidos: data.cantidadProyectosAdmitidos,
      };
      const response = await apiRequest("POST", "/api/membership-types", membershipData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/membership-types"] });
      toast({
        title: "Membresía creada",
        description: "El tipo de membresía ha sido creado exitosamente",
      });
      form.reset();
      setIsAddModalOpen(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo crear el tipo de membresía",
        variant: "destructive",
      });
    },
  });

  // Update membership mutation
  const updateMembershipMutation = useMutation({
    mutationFn: async (data: MembershipFormData) => {
      if (!selectedMembership) throw new Error("No membership selected");
      const membershipData = {
        nombrePlan: data.nombrePlan,
        descripcionPlan: data.descripcionPlan,
        opcionesPrecios: [{ periodicidad: data.periodicidad, costo: data.costo }],
        beneficios: data.beneficios ? data.beneficios.split('\n').filter(b => b.trim()) : [],
        visibilidad: data.visibilidad,
        cantidadProductosAdmitidos: data.cantidadProductosAdmitidos,
        cantidadProyectosAdmitidos: data.cantidadProyectosAdmitidos,
      };
      const response = await apiRequest("PUT", `/api/membership-types/${selectedMembership.id}`, membershipData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/membership-types"] });
      toast({
        title: "Membresía actualizada",
        description: "El tipo de membresía ha sido actualizado exitosamente",
      });
      editForm.reset();
      setIsEditModalOpen(false);
      setSelectedMembership(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo actualizar el tipo de membresía",
        variant: "destructive",
      });
    },
  });

  // Delete membership mutation
  const deleteMembershipMutation = useMutation({
    mutationFn: async (membershipId: number) => {
      await apiRequest("DELETE", `/api/membership-types/${membershipId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/membership-types"] });
      toast({
        title: "Membresía eliminada",
        description: "El tipo de membresía ha sido eliminado exitosamente",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo eliminar el tipo de membresía",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: MembershipFormData) => {
    createMembershipMutation.mutate(data);
  };

  const onEditSubmit = (data: MembershipFormData) => {
    updateMembershipMutation.mutate(data);
  };

  const handleEdit = (membership: MembershipType) => {
    setSelectedMembership(membership);
    const beneficiosText = Array.isArray(membership.beneficios) 
      ? membership.beneficios.join('\n') 
      : '';
    
    // Extract first pricing option for form
    const firstPricing = Array.isArray(membership.opcionesPrecios) && membership.opcionesPrecios.length > 0 
      ? membership.opcionesPrecios[0] 
      : { periodicidad: "", costo: 0 };
    
    editForm.reset({
      nombrePlan: membership.nombrePlan,
      costo: firstPricing.costo || 0,
      periodicidad: firstPricing.periodicidad || "",
      descripcionPlan: membership.descripcionPlan || "",
      beneficios: beneficiosText,
      visibilidad: membership.visibilidad || "publica",
      cantidadProductosAdmitidos: membership.cantidadProductosAdmitidos || 0,
      cantidadProyectosAdmitidos: membership.cantidadProyectosAdmitidos || 0,
    });
    setIsEditModalOpen(true);
  };

  const handleView = (membership: MembershipType) => {
    setSelectedMembership(membership);
    setIsViewModalOpen(true);
  };

  const handleDelete = async (membershipId: number) => {
    const result = await Swal.fire({
      title: '¿Eliminar membresía?',
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
      deleteMembershipMutation.mutate(membershipId);
    }
  };

  const getPlanBadgeColor = (planName: string) => {
    switch (planName.toLowerCase()) {
      case "enterprise":
        return "bg-orange-100 text-orange-800";
      case "premium":
        return "bg-yellow-100 text-yellow-800";
      case "básico":
      case "basico":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-blue-100 text-blue-800";
    }
  };

  return (
    <div className="space-y-6">


      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary">Planes</h1>
          <p className="text-gray-600 mt-1">Administra los planes disponibles para las empresas</p>
        </div>
        <div className="flex items-center space-x-3">
          {/* View Toggle */}
          <div className="flex items-center border rounded-lg p-1">
            <Button
              variant={viewMode === "table" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("table")}
              className="h-8 px-3"
            >
              <TableIcon className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === "grid" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("grid")}
              className="h-8 px-3"
            >
              <Grid className="w-4 h-4" />
            </Button>
          </div>
          
          <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center space-x-2">
                <Plus className="w-4 h-4" />
                <span>Nuevo Plan</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Agregar Nuevo Tipo de Membresía</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="nombrePlan"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre del Plan *</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej. Básico, Premium, Enterprise..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="costo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Costo *</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01" 
                            placeholder="99.00"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="periodicidad"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Periodicidad *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="monthly">Mensual</SelectItem>
                            <SelectItem value="yearly">Anual</SelectItem>
                            <SelectItem value="quarterly">Trimestral</SelectItem>
                            <SelectItem value="biannual">Semestral</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="visibilidad"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Visibilidad</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar visibilidad" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="publica">Pública - Visible para todos</SelectItem>
                          <SelectItem value="privada">Privada - Solo administradores</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg bg-green-50">
                  <FormField
                    control={form.control}
                    name="cantidadProductosAdmitidos"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-green-800 font-semibold">Límite de Productos</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            placeholder="0"
                            className="border-green-300"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            value={field.value || 0}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="cantidadProyectosAdmitidos"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-green-800 font-semibold">Límite de Proyectos</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            placeholder="0"
                            className="border-green-300"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            value={field.value || 0}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="descripcionPlan"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descripción del Plan</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Descripción breve del plan de membresía..."
                          className="min-h-[120px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="beneficios"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Beneficios</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe los beneficios del plan de membresía (cada línea será un beneficio)..."
                          className="min-h-[150px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex items-center justify-end space-x-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createMembershipMutation.isPending}>
                    {createMembershipMutation.isPending ? "Creando..." : "Crear Plan"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Content Area */}
      {viewMode === "table" ? (
        <MembershipDataTable 
          memberships={memberships} 
          onEdit={handleEdit}
          onView={handleView}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <div className="col-span-full flex items-center justify-center py-12">
            <div className="text-gray-500">Cargando tipos de membresía...</div>
          </div>
        ) : memberships.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <Crown className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No hay tipos de membresía registrados</p>
            <p className="text-gray-400 text-sm">Crea el primer tipo de membresía para comenzar</p>
          </div>
        ) : (
          memberships.map((membership) => (
            <Card key={membership.id} className="relative">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Crown className="h-5 w-5 text-primary" />
                    <CardTitle className="text-xl">{membership.nombrePlan}</CardTitle>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEdit(membership)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleDelete(membership.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge className={getPlanBadgeColor(membership.nombrePlan)}>
                    {membership.nombrePlan}
                  </Badge>
                  <span className="text-2xl font-bold text-primary">
                    {formatMoney(membership.costo)}
                  </span>
                  <span className="text-gray-500">
                    /{membership.periodicidad === 'monthly' ? 'mes' : 
                      membership.periodicidad === 'yearly' ? 'año' :
                      membership.periodicidad === 'quarterly' ? 'trimestre' :
                      membership.periodicidad === 'biannual' ? 'semestre' : membership.periodicidad}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                {membership.descripcionPlan && (
                  <p className="text-gray-600 mb-4">{membership.descripcionPlan}</p>
                )}
                
                {Array.isArray(membership.beneficios) && membership.beneficios.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Beneficios incluidos:</h4>
                    <ul className="space-y-1">
                      {membership.beneficios.map((benefit, index) => (
                        <li key={index} className="flex items-start space-x-2 text-sm">
                          <Check className="h-4 w-4 text-secondary mt-0.5 flex-shrink-0" />
                          <span>{benefit}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
        </div>
      )}

      {/* View Modal */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalles de la Membresía</DialogTitle>
          </DialogHeader>
          {selectedMembership && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Crown className="h-5 w-5 text-primary" />
                <h3 className="text-xl font-semibold">{selectedMembership.nombrePlan}</h3>
                <Badge>{selectedMembership.nombrePlan}</Badge>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Costo</label>
                  <p className="text-lg font-semibold text-primary">{formatMoney(selectedMembership.costo)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Periodicidad</label>
                  <p className="text-sm">{selectedMembership.periodicidad}</p>
                </div>
              </div>

              {selectedMembership.descripcionPlan && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Descripción</label>
                  <p className="text-sm text-gray-700">{selectedMembership.descripcionPlan}</p>
                </div>
              )}

              {Array.isArray(selectedMembership.beneficios) && selectedMembership.beneficios.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Beneficios incluidos</label>
                  <ul className="mt-2 space-y-1">
                    {selectedMembership.beneficios.map((benefit, index) => (
                      <li key={index} className="flex items-start space-x-2 text-sm">
                        <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                        <span>{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Productos Permitidos</label>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {selectedMembership.cantidadProductosAdmitidos === -1 ? "Sin límite" : (selectedMembership.cantidadProductosAdmitidos || 0)}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Proyectos Permitidos</label>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      {selectedMembership.cantidadProyectosAdmitidos === -1 ? "Sin límite" : (selectedMembership.cantidadProyectosAdmitidos || 0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Tipo de Membresía</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="nombrePlan"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre del Plan *</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej. Básico, Premium, Enterprise..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="costo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Costo *</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej. 99.00" type="number" step="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={editForm.control}
                name="periodicidad"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Periodicidad *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar periodicidad" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="monthly">Mensual</SelectItem>
                        <SelectItem value="yearly">Anual</SelectItem>
                        <SelectItem value="quarterly">Trimestral</SelectItem>
                        <SelectItem value="biannual">Semestral</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg bg-green-50">
                <FormField
                  control={editForm.control}
                  name="cantidadProductosAdmitidos"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-green-800 font-semibold">Límite de Productos</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          placeholder="0"
                          className="border-green-300"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          value={field.value || 0}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="cantidadProyectosAdmitidos"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-green-800 font-semibold">Límite de Proyectos</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0"
                          placeholder="0"
                          className="border-green-300"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          value={field.value || 0}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={editForm.control}
                name="descripcionPlan"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descripción del Plan</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Descripción breve del plan de membresía..."
                        className="min-h-[120px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="beneficios"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Beneficios</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe los beneficios del plan de membresía (cada línea será un beneficio)..."
                        className="min-h-[150px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="cantidadProductosAdmitidos"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cantidad de Productos Admitidos</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="0"
                          min="0"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          value={field.value || 0}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="cantidadProyectosAdmitidos"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cantidad de Proyectos Admitidos</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="0"
                          min="0"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          value={field.value || 0}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setSelectedMembership(null);
                  }}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={updateMembershipMutation.isPending}>
                  {updateMembershipMutation.isPending ? "Actualizando..." : "Actualizar Membresía"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
