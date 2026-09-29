import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import EditCompanyModalComplete from "@/components/EditCompanyModalComplete";
import { 
  Building, 
  CreditCard, 
  Calendar, 
  Crown,
  Edit,
  Star,
  Award,
  Settings,
  BarChart3,
  Package,
  Target,
  Briefcase,
  Eye,
  Phone,
  Mail,
  MapPin,
  Check
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function RepresentativeDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [editModalOpen, setEditModalOpen] = useState(false);

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

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const primaryCompany = dashboardData?.companies?.[0] as any;
  const currentMembership = dashboardData?.currentMembership as any;
  const stats = dashboardData?.stats as any;

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
              {/* Quick Stats */}
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
                    <Target className="h-8 w-8 text-[#bcce16]" />
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
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  Gestión de Mi Empresa
                </CardTitle>
                <p className="text-gray-600">Administra la información completa de tu empresa</p>
              </CardHeader>
              <CardContent>
                {primaryCompany ? (
                  <div className="space-y-6">
                    {/* Company Info Display */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-medium text-gray-500">Nombre de la Empresa</label>
                          <p className="text-lg font-semibold">{primaryCompany.nombreEmpresa}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">Email Principal</label>
                          <p>{primaryCompany.email1 || 'No configurado'}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">Teléfono Principal</label>
                          <p>{primaryCompany.telefono1 || 'No configurado'}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">Sitio Web</label>
                          <p>{primaryCompany.sitioWeb || 'No configurado'}</p>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-medium text-gray-500">Estado</label>
                          <Badge variant={primaryCompany.estado === 'activo' ? 'default' : 'secondary'}>
                            {primaryCompany.estado === 'activo' ? 'Activa' : 'Inactiva'}
                          </Badge>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">Plan de Membresía</label>
                          <p className="font-medium text-[#bcce16]">{currentMembership?.nombrePlan}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">Periodicidad</label>
                          <p>{primaryCompany.membershipPeriodicidad}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">Vencimiento</label>
                          <p>{format(new Date(primaryCompany.fechaFinMembresia), 'dd/MM/yyyy', { locale: es })}</p>
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    <div>
                      <label className="text-sm font-medium text-gray-500">Descripción de la Empresa</label>
                      <p className="mt-1 text-gray-700">{primaryCompany.descripcionEmpresa || 'No configurada'}</p>
                    </div>

                    {/* Address */}
                    <div>
                      <label className="text-sm font-medium text-gray-500">Dirección Física</label>
                      <p className="mt-1 text-gray-700">{primaryCompany.direccionFisica || 'No configurada'}</p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4 border-t">
                      <Button 
                        className="bg-[#bcce16] hover:bg-[#a8b814] text-black"
                        onClick={() => setEditModalOpen(true)}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Editar Información
                      </Button>
                      <Button variant="outline">
                        <Eye className="h-4 w-4 mr-2" />
                        Ver en Directorio
                      </Button>
                    </div>
                  </div>
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
                <p className="text-gray-600">Administra el portafolio de proyectos de tu empresa</p>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Proyectos</h3>
                  <p className="text-gray-600 mb-6">
                    Esta sección estará disponible próximamente para gestionar el portafolio de proyectos
                  </p>
                  <Button variant="outline" disabled>
                    <Settings className="h-4 w-4 mr-2" />
                    Configurar Proyectos
                  </Button>
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
                <p className="text-gray-600">Gestiona los certificados y reconocimientos de tu empresa</p>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <Star className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Certificados</h3>
                  <p className="text-gray-600 mb-6">
                    Esta sección estará disponible próximamente para gestionar certificados y premios
                  </p>
                  <Button variant="outline" disabled>
                    <Settings className="h-4 w-4 mr-2" />
                    Configurar Certificados
                  </Button>
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
                <p className="text-gray-600">Gestiona tu plan actual y opciones de cambio</p>
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

                      <div className="flex gap-3">
                        <Button variant="outline">
                          <Settings className="h-4 w-4 mr-2" />
                          Cambiar Plan
                        </Button>
                        <Button variant="outline">
                          Cancelar Suscripción
                        </Button>
                      </div>
                    </div>

                    {/* Benefits */}
                    <div>
                      <h4 className="font-semibold mb-3">Beneficios incluidos:</h4>
                      <div className="space-y-2">
                        {(Array.isArray(currentMembership.beneficios) ? currentMembership.beneficios : currentMembership.beneficios ? currentMembership.beneficios.toString().split('\n') : []).map((benefit: string, index: number) => (
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
                    <p className="text-gray-600 mb-6">Selecciona un plan para activar tu membresía</p>
                    <Button className="bg-[#bcce16] hover:bg-[#a8b814] text-black">
                      Ver Planes Disponibles
                    </Button>
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
                <p className="text-gray-600">Revisa todos tus pagos y transacciones</p>
              </CardHeader>
              <CardContent>
                {dashboardData?.payments && dashboardData.payments.length > 0 ? (
                  <div className="space-y-6">
                    {/* Payment Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                        <div className="flex items-center gap-2">
                          <Check className="h-5 w-5 text-green-600" />
                          <span className="text-sm font-medium text-green-800">Pagos Exitosos</span>
                        </div>
                        <p className="text-2xl font-bold text-green-900 mt-1">
                          {dashboardData.payments.filter((p: any) => p.status === 'succeeded').length}
                        </p>
                      </div>
                      
                      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-5 w-5 text-blue-600" />
                          <span className="text-sm font-medium text-blue-800">Total Pagado</span>
                        </div>
                        <p className="text-2xl font-bold text-blue-900 mt-1">
                          ${dashboardData.payments
                            .filter((p: any) => p.status === 'succeeded')
                            .reduce((sum: number, p: any) => sum + (parseFloat(p.amount) || 0), 0)
                            .toFixed(2)} USD
                        </p>
                      </div>
                      
                      <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-5 w-5 text-purple-600" />
                          <span className="text-sm font-medium text-purple-800">Último Pago</span>
                        </div>
                        <p className="text-lg font-semibold text-purple-900 mt-1">
                          {dashboardData.payments.length > 0 ? 
                            format(new Date(dashboardData.payments[0].createdAt), 'dd/MM/yyyy', { locale: es }) : 
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
                            {dashboardData.payments.map((payment: any, index: number) => (
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
                                  {membershipTypes?.find((mt: any) => mt.id === payment.membershipTypeId)?.nombrePlan || 'Plan básico'}
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
                    <p className="text-gray-600 mb-6">
                      No se han registrado pagos en tu cuenta aún
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modal de edición completo */}
      {dashboardData?.companies && dashboardData.companies.length > 0 && (
        <EditCompanyModalComplete
          open={editModalOpen}
          onOpenChange={setEditModalOpen}
          company={dashboardData.companies[0]}
          userRole="representante"
        />
      )}
    </div>
  );
}