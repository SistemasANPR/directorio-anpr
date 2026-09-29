import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Building, 
  CreditCard, 
  Calendar, 
  Crown,
  Edit,
  Award,
  BarChart3,
  Package,
  Briefcase,
  Eye,
  Check,
  Save,
  X,
  Plus,
  Trash2
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Schema for company editing
const companySchema = z.object({
  nombreEmpresa: z.string().min(1, "El nombre de la empresa es requerido"),
  telefono1: z.string().min(1, "El teléfono es requerido"),
  telefono2: z.string().optional(),
  email1: z.string().email("Email inválido").min(1, "El email es requerido"),
  email2: z.string().email("Email inválido").optional().or(z.literal("")),
  sitioWeb: z.string().url("URL inválida").optional().or(z.literal("")),
  direccionFisica: z.string().min(1, "La dirección es requerida"),
  descripcionEmpresa: z.string().min(1, "La descripción es requerida"),
  catalogoDigitalUrl: z.string().url("URL inválida").optional().or(z.literal("")),
});

// Schema for projects
const projectSchema = z.object({
  nombreProyecto: z.string().min(1, "El nombre del proyecto es requerido"),
  descripcionProyecto: z.string().min(1, "La descripción es requerida"),
  fechaInicio: z.string().min(1, "La fecha de inicio es requerida"),
  fechaFin: z.string().optional(),
  estadoProyecto: z.enum(["planificacion", "en_progreso", "completado", "pausado"]),
  presupuesto: z.string().optional(),
  cliente: z.string().optional(),
  ubicacion: z.string().optional(),
});

type CompanyFormData = z.infer<typeof companySchema>;
type ProjectFormData = z.infer<typeof projectSchema>;

export default function RepresentativeDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [isEditingCompany, setIsEditingCompany] = useState(false);
  const [isAddingProject, setIsAddingProject] = useState(false);
  const { toast } = useToast();

  // Handle URL parameters for direct tab navigation
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    if (tabParam && ['overview', 'company', 'projects', 'certificates', 'membership', 'payments'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, []);

  // Fetch dashboard data
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: [`/api/representative/dashboard/${user?.id}`],
    enabled: !!user?.id,
  });

  // Fetch membership types
  const { data: membershipTypes } = useQuery({
    queryKey: ['/api/membership-types'],
  });

  const primaryCompany = dashboardData?.companies?.[0];
  const currentMembership = dashboardData?.currentMembership;
  const payments = dashboardData?.payments || [];

  // Fetch projects for the company
  const { data: projects = [] } = useQuery({
    queryKey: [`/api/projects/company/${primaryCompany?.id}`],
    enabled: !!primaryCompany?.id,
  });

  // Company form
  const companyForm = useForm<CompanyFormData>({
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
      catalogoDigitalUrl: "",
    },
  });

  // Project form
  const projectForm = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      nombreProyecto: "",
      descripcionProyecto: "",
      fechaInicio: "",
      fechaFin: "",
      estadoProyecto: "planificacion",
      presupuesto: "",
      cliente: "",
      ubicacion: "",
    },
  });

  // Load company data into form when editing
  useEffect(() => {
    if (primaryCompany && isEditingCompany) {
      companyForm.reset({
        nombreEmpresa: primaryCompany.nombreEmpresa || "",
        telefono1: primaryCompany.telefono1 || "",
        telefono2: primaryCompany.telefono2 || "",
        email1: primaryCompany.email1 || "",
        email2: primaryCompany.email2 || "",
        sitioWeb: primaryCompany.sitioWeb || "",
        direccionFisica: primaryCompany.direccionFisica || "",
        descripcionEmpresa: primaryCompany.descripcionEmpresa || "",
        catalogoDigitalUrl: primaryCompany.catalogoDigitalUrl || "",
      });
    }
  }, [primaryCompany, isEditingCompany, companyForm]);

  // Update company mutation
  const updateCompanyMutation = useMutation({
    mutationFn: async (data: CompanyFormData) => {
      const response = await apiRequest("PUT", `/api/companies/${primaryCompany?.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Empresa actualizada",
        description: "La información se ha actualizado correctamente",
      });
      setIsEditingCompany(false);
      queryClient.invalidateQueries({ queryKey: [`/api/representative/dashboard/${user?.id}`] });
    },
    onError: (error: any) => {
      toast({
        title: "Error al actualizar",
        description: error.message || "Error al actualizar la empresa",
        variant: "destructive",
      });
    },
  });

  // Create project mutation
  const createProjectMutation = useMutation({
    mutationFn: async (data: ProjectFormData) => {
      const projectData = {
        ...data,
        companyId: primaryCompany?.id,
        estado: "activo",
        estadoModeracion: "pendiente",
      };
      const response = await apiRequest("POST", "/api/projects", projectData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Proyecto creado",
        description: "El proyecto se ha creado correctamente",
      });
      setIsAddingProject(false);
      projectForm.reset();
      queryClient.invalidateQueries({ queryKey: [`/api/projects/company/${primaryCompany?.id}`] });
    },
    onError: (error: any) => {
      toast({
        title: "Error al crear proyecto",
        description: error.message || "Error al crear el proyecto",
        variant: "destructive",
      });
    },
  });

  // Delete project mutation
  const deleteProjectMutation = useMutation({
    mutationFn: async (projectId: number) => {
      await apiRequest("DELETE", `/api/projects/${projectId}`, {});
    },
    onSuccess: () => {
      toast({
        title: "Proyecto eliminado",
        description: "El proyecto se ha eliminado correctamente",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/company/${primaryCompany?.id}`] });
    },
    onError: (error: any) => {
      toast({
        title: "Error al eliminar",
        description: error.message || "Error al eliminar el proyecto",
        variant: "destructive",
      });
    },
  });

  // Form handlers
  const onSubmitCompany = (data: CompanyFormData) => {
    updateCompanyMutation.mutate(data);
  };

  const onSubmitProject = (data: ProjectFormData) => {
    createProjectMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const primaryCompany = dashboardData?.companies?.[0];
  const currentMembership = dashboardData?.currentMembership;
  const payments = dashboardData?.payments || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Panel del Representante</h1>
          <p className="text-gray-600 mt-2">
            Bienvenido, {user?.displayName || user?.email}
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-6 mb-8">
            <TabsTrigger value="overview">
              <BarChart3 className="h-4 w-4 mr-2" />
              Resumen
            </TabsTrigger>
            <TabsTrigger value="company">
              <Building className="h-4 w-4 mr-2" />
              Mi Empresa
            </TabsTrigger>
            <TabsTrigger value="projects">
              <Briefcase className="h-4 w-4 mr-2" />
              Proyectos
            </TabsTrigger>
            <TabsTrigger value="certificates">
              <Award className="h-4 w-4 mr-2" />
              Certificados
            </TabsTrigger>
            <TabsTrigger value="membership">
              <Crown className="h-4 w-4 mr-2" />
              Mi Plan
            </TabsTrigger>
            <TabsTrigger value="payments">
              <CreditCard className="h-4 w-4 mr-2" />
              Pagos
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Empresa Activa</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {primaryCompany ? '1' : '0'}
                      </p>
                    </div>
                    <Building className="h-8 w-8 text-[#bcce16]" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Plan Actual</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {currentMembership?.nombrePlan || 'Sin plan'}
                      </p>
                    </div>
                    <Crown className="h-8 w-8 text-[#bcce16]" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Estado</p>
                      <Badge variant={primaryCompany?.estado === 'activo' ? 'default' : 'secondary'}>
                        {primaryCompany?.estado === 'activo' ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </div>
                    <Check className="h-8 w-8 text-[#bcce16]" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Vencimiento</p>
                      <p className="text-sm font-medium text-gray-900">
                        {primaryCompany?.fechaFinMembresia 
                          ? format(new Date(primaryCompany.fechaFinMembresia), 'dd/MM/yyyy', { locale: es })
                          : 'N/A'
                        }
                      </p>
                    </div>
                    <Calendar className="h-8 w-8 text-[#bcce16]" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Welcome Card */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Bienvenido a tu Panel de Representante</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">
                  Desde aquí puedes gestionar toda la información de tu empresa, proyectos, certificados y plan de membresía.
                </p>
                <div className="flex gap-3">
                  <Button 
                    onClick={() => setActiveTab('company')}
                    className="bg-[#bcce16] hover:bg-[#a8b814] text-black"
                  >
                    <Building className="h-4 w-4 mr-2" />
                    Ver Mi Empresa
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => setActiveTab('membership')}
                  >
                    <Crown className="h-4 w-4 mr-2" />
                    Gestionar Plan
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Company Management Tab */}
          <TabsContent value="company">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Building className="h-5 w-5" />
                    Información de Mi Empresa
                  </CardTitle>
                  <p className="text-gray-600">Administra la información completa de tu empresa</p>
                </div>
                {primaryCompany && (
                  <Button
                    onClick={() => setIsEditingCompany(!isEditingCompany)}
                    variant={isEditingCompany ? "outline" : "default"}
                    className={isEditingCompany ? "" : "bg-[#bcce16] hover:bg-[#a8b814] text-black"}
                  >
                    {isEditingCompany ? (
                      <>
                        <X className="h-4 w-4 mr-2" />
                        Cancelar
                      </>
                    ) : (
                      <>
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                      </>
                    )}
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {primaryCompany ? (
                  !isEditingCompany ? (
                    /* View Mode */
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div>
                            <Label className="text-sm font-medium text-gray-500">Nombre de la Empresa</Label>
                            <p className="text-lg font-semibold">{primaryCompany.nombreEmpresa}</p>
                          </div>
                          <div>
                            <Label className="text-sm font-medium text-gray-500">Email Principal</Label>
                            <p>{primaryCompany.email1 || 'No configurado'}</p>
                          </div>
                          <div>
                            <Label className="text-sm font-medium text-gray-500">Email Secundario</Label>
                            <p>{primaryCompany.email2 || 'No configurado'}</p>
                          </div>
                          <div>
                            <Label className="text-sm font-medium text-gray-500">Teléfono Principal</Label>
                            <p>{primaryCompany.telefono1 || 'No configurado'}</p>
                          </div>
                          <div>
                            <Label className="text-sm font-medium text-gray-500">Teléfono Secundario</Label>
                            <p>{primaryCompany.telefono2 || 'No configurado'}</p>
                          </div>
                        </div>
                        
                        <div className="space-y-4">
                          <div>
                            <Label className="text-sm font-medium text-gray-500">Sitio Web</Label>
                            <p>{primaryCompany.sitioWeb || 'No configurado'}</p>
                          </div>
                          <div>
                            <Label className="text-sm font-medium text-gray-500">Catálogo Digital</Label>
                            <p>{primaryCompany.catalogoDigitalUrl || 'No configurado'}</p>
                          </div>
                          <div>
                            <Label className="text-sm font-medium text-gray-500">Estado</Label>
                            <Badge variant={primaryCompany.estado === 'activo' ? 'default' : 'secondary'}>
                              {primaryCompany.estado === 'activo' ? 'Activa' : 'Inactiva'}
                            </Badge>
                          </div>
                          <div>
                            <Label className="text-sm font-medium text-gray-500">Plan de Membresía</Label>
                            <p className="font-medium text-[#bcce16]">{currentMembership?.nombrePlan}</p>
                          </div>
                          <div>
                            <Label className="text-sm font-medium text-gray-500">Vencimiento</Label>
                            <p>{format(new Date(primaryCompany.fechaFinMembresia), 'dd/MM/yyyy', { locale: es })}</p>
                          </div>
                        </div>
                      </div>

                      <div>
                        <Label className="text-sm font-medium text-gray-500">Descripción de la Empresa</Label>
                        <p className="mt-1 text-gray-700">{primaryCompany.descripcionEmpresa || 'No configurada'}</p>
                      </div>

                      <div>
                        <Label className="text-sm font-medium text-gray-500">Dirección Física</Label>
                        <p className="mt-1 text-gray-700">{primaryCompany.direccionFisica || 'No configurada'}</p>
                      </div>

                      <div className="flex gap-3 pt-4 border-t">
                        <Button variant="outline">
                          <Eye className="h-4 w-4 mr-2" />
                          Ver en Directorio
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* Edit Mode */
                    <Form {...companyForm}>
                      <form onSubmit={companyForm.handleSubmit(onSubmitCompany)} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-4">
                            <FormField
                              control={companyForm.control}
                              name="nombreEmpresa"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Nombre de la Empresa</FormLabel>
                                  <FormControl>
                                    <Input {...field} />
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
                                  <FormLabel>Email Principal</FormLabel>
                                  <FormControl>
                                    <Input type="email" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={companyForm.control}
                              name="email2"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Email Secundario</FormLabel>
                                  <FormControl>
                                    <Input type="email" {...field} />
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
                                  <FormLabel>Teléfono Principal</FormLabel>
                                  <FormControl>
                                    <Input {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={companyForm.control}
                              name="telefono2"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Teléfono Secundario</FormLabel>
                                  <FormControl>
                                    <Input {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          
                          <div className="space-y-4">
                            <FormField
                              control={companyForm.control}
                              name="sitioWeb"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Sitio Web</FormLabel>
                                  <FormControl>
                                    <Input type="url" placeholder="https://ejemplo.com" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={companyForm.control}
                              name="catalogoDigitalUrl"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Catálogo Digital</FormLabel>
                                  <FormControl>
                                    <Input type="url" placeholder="https://catalogo.ejemplo.com" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={companyForm.control}
                              name="direccionFisica"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Dirección Física</FormLabel>
                                  <FormControl>
                                    <Textarea {...field} rows={3} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </div>

                        <FormField
                          control={companyForm.control}
                          name="descripcionEmpresa"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Descripción de la Empresa</FormLabel>
                              <FormControl>
                                <Textarea {...field} rows={4} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="flex gap-3 pt-4 border-t">
                          <Button 
                            type="submit" 
                            className="bg-[#bcce16] hover:bg-[#a8b814] text-black"
                            disabled={updateCompanyMutation.isPending}
                          >
                            <Save className="h-4 w-4 mr-2" />
                            {updateCompanyMutation.isPending ? 'Guardando...' : 'Guardar Cambios'}
                          </Button>
                          <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => setIsEditingCompany(false)}
                          >
                            <X className="h-4 w-4 mr-2" />
                            Cancelar
                          </Button>
                        </div>
                      </form>
                    </Form>
                  )
                ) : (
                  <div className="text-center py-12">
                    <Building className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No hay empresa registrada</h3>
                    <p className="text-gray-600 mb-6">Registra tu empresa para completar tu perfil</p>
                    <Button className="bg-[#bcce16] hover:bg-[#a8b814] text-black">
                      Registrar empresa
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Projects Tab */}
          <TabsContent value="projects">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5" />
                  Gestión de Proyectos
                </CardTitle>
                <p className="text-gray-600">Próximamente: portafolio de proyectos de tu empresa</p>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Proyectos</h3>
                  <p className="text-gray-600 mb-6">
                    Esta función estará disponible próximamente
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Certificates Tab */}
          <TabsContent value="certificates">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  Certificados y Premios
                </CardTitle>
                <p className="text-gray-600">Próximamente: gestión de certificaciones</p>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <Award className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Certificados</h3>
                  <p className="text-gray-600 mb-6">
                    Esta función estará disponible próximamente
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Membership Tab */}
          <TabsContent value="membership">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="h-5 w-5" />
                  Plan de Membresía
                </CardTitle>
                <p className="text-gray-600">Información de tu plan actual</p>
              </CardHeader>
              <CardContent>
                {currentMembership && primaryCompany ? (
                  <div className="space-y-6">
                    <div className="bg-gradient-to-r from-[#bcce16]/10 to-[#bcce16]/5 p-6 rounded-lg border">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-xl font-bold text-gray-900">{currentMembership.nombrePlan}</h3>
                          <p className="text-gray-600">Plan actual</p>
                        </div>
                        <Badge className="bg-[#bcce16] text-black">Activo</Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                          <p className="text-sm text-gray-500">Periodicidad</p>
                          <p className="font-semibold">{primaryCompany.membershipPeriodicidad}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Inicio</p>
                          <p className="font-semibold">
                            {format(new Date(primaryCompany.fechaInicioMembresia), 'dd/MM/yyyy', { locale: es })}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Vencimiento</p>
                          <p className="font-semibold">
                            {format(new Date(primaryCompany.fechaFinMembresia), 'dd/MM/yyyy', { locale: es })}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Benefits */}
                    <div>
                      <h4 className="font-semibold mb-3">Beneficios incluidos:</h4>
                      <div className="space-y-2">
                        {(Array.isArray(currentMembership.beneficios) 
                          ? currentMembership.beneficios 
                          : currentMembership.beneficios?.split('\n') || []
                        ).map((benefit: string, index: number) => (
                          <div key={index} className="flex items-start gap-2">
                            <div className="w-2 h-2 rounded-full bg-[#bcce16] mt-2 flex-shrink-0" />
                            <p className="text-gray-700">{benefit}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Crown className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold mb-2">Sin plan activo</h3>
                    <p className="text-gray-600">No se encontró información del plan</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Historial de Pagos
                </CardTitle>
                <p className="text-gray-600">Historial completo de transacciones</p>
              </CardHeader>
              <CardContent>
                {payments.length > 0 ? (
                  <div className="space-y-6">
                    {/* Payment Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                        <div className="flex items-center gap-2">
                          <Check className="h-5 w-5 text-green-600" />
                          <span className="text-sm font-medium text-green-800">Pagos Exitosos</span>
                        </div>
                        <p className="text-2xl font-bold text-green-900 mt-1">
                          {payments.filter(p => p.status === 'succeeded').length}
                        </p>
                      </div>
                      
                      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-5 w-5 text-blue-600" />
                          <span className="text-sm font-medium text-blue-800">Total Pagado</span>
                        </div>
                        <p className="text-2xl font-bold text-blue-900 mt-1">
                          ${payments
                            .filter(p => p.status === 'succeeded')
                            .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
                            .toFixed(2)} USD
                        </p>
                      </div>
                      
                      <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-5 w-5 text-purple-600" />
                          <span className="text-sm font-medium text-purple-800">Último Pago</span>
                        </div>
                        <p className="text-lg font-semibold text-purple-900 mt-1">
                          {payments.length > 0 ? 
                            format(new Date(payments[0].createdAt), 'dd/MM/yyyy', { locale: es }) : 
                            'N/A'
                          }
                        </p>
                      </div>
                    </div>

                    {/* Payment History Table */}
                    <div className="border rounded-lg overflow-hidden">
                      <div className="bg-gray-50 px-6 py-3 border-b">
                        <h3 className="font-semibold text-gray-900">Transacciones</h3>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Fecha
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Monto
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Estado
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Plan
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {payments.map((payment, index) => (
                              <tr key={payment.id || index}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {format(new Date(payment.createdAt), 'dd/MM/yyyy HH:mm', { locale: es })}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                  ${parseFloat(payment.amount || '0').toFixed(2)} {payment.currency?.toUpperCase() || 'USD'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <Badge 
                                    variant={payment.status === 'succeeded' ? 'default' : 
                                            payment.status === 'pending' ? 'secondary' : 'destructive'}
                                  >
                                    {payment.status === 'succeeded' ? 'Exitoso' : 
                                     payment.status === 'pending' ? 'Pendiente' : 'Fallido'}
                                  </Badge>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {membershipTypes?.find(mt => mt.id === payment.membershipTypeId)?.nombrePlan || 'Plan básico'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <CreditCard className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold mb-2">Sin historial de pagos</h3>
                    <p className="text-gray-600">No se han registrado pagos en tu cuenta</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}