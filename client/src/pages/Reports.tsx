import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { 
  Building, 
  Users, 
  CreditCard, 
  TrendingUp, 
  Calendar,
  Download,
  BarChart3,
  PieChart,
  Activity,
  DollarSign,
  FileText,
  Filter
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import * as XLSX from 'xlsx';
import { useCurrency } from "@/lib/currency";

interface ReportData {
  overview: {
    totalCompanies: number;
    activeCompanies: number;
    totalUsers: number;
    totalRevenue: number;
    monthlyRevenue: number;
    newCompaniesThisMonth: number;
    renewalsThisMonth: number;
  };
  membershipStats: Array<{
    planName: string;
    totalCompanies: number;
    revenue: number;
    percentage: number;
  }>;
  userStats: {
    totalUsers: number;
    adminUsers: number;
    representativeUsers: number;
    newUsersThisMonth: number;
  };
  revenueByMonth: Array<{
    month: string;
    revenue: number;
    transactions: number;
  }>;
  topCategories: Array<{
    categoryName: string;
    companyCount: number;
  }>;
}

export default function Reports() {
  const { format: formatMoney, code: currencyCode } = useCurrency();
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [selectedPeriod, setSelectedPeriod] = useState("last30days");
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch report data
  const { data: reportData, isLoading } = useQuery<ReportData>({
    queryKey: ["/api/reports", selectedPeriod, dateRange],
  });

  const { data: companiesResponse } = useQuery({
    queryKey: ["/api/companies"],
  });

  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["/api/payments/all"],
  });

  // Extract companies array from the API response structure
  const companies = Array.isArray(companiesResponse?.companies) ? companiesResponse.companies : [];

  const handleExportToExcel = (data: any[], filename: string) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte");
    XLSX.writeFile(wb, `${filename}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const exportCompaniesReport = () => {
    const companiesData = companies.map((company: any) => ({
      'Nombre de Empresa': company.nombreEmpresa,
      'Email': company.email1,
      'Teléfono': company.telefono1,
      'Plan de Membresía': company.membershipType?.nombrePlan || 'N/A',
      'Estado': company.estado,
      'Fecha de Inicio': company.fechaInicioMembresia ? format(new Date(company.fechaInicioMembresia), 'dd/MM/yyyy') : 'N/A',
      'Fecha de Fin': company.fechaFinMembresia ? format(new Date(company.fechaFinMembresia), 'dd/MM/yyyy') : 'N/A',
      'Fecha de Registro': format(new Date(company.createdAt), 'dd/MM/yyyy'),
    }));
    handleExportToExcel(companiesData, 'reporte_empresas');
  };

  const exportUsersReport = () => {
    const usersData = users.map((user: any) => ({
      'Nombre': user.displayName || 'N/A',
      'Email': user.email,
      'Rol': user.role || 'N/A',
      'Estado': user.isActive ? 'Activo' : 'Inactivo',
      'Fecha de Registro': format(new Date(user.createdAt), 'dd/MM/yyyy'),
      'Último Acceso': user.lastLoginAt ? format(new Date(user.lastLoginAt), 'dd/MM/yyyy HH:mm') : 'Nunca',
    }));
    handleExportToExcel(usersData, 'reporte_usuarios');
  };

  const exportPaymentsReport = () => {
    const paymentsData = payments.map((payment: any) => ({
      'ID Transacción': payment.id,
      'Empresa': payment.company?.nombreEmpresa || 'N/A',
      'Monto': formatMoney(payment.amount, payment.currency),
      'Estado': payment.status,
      'Plan': payment.membershipType?.nombrePlan || 'N/A',
      'Método de Pago': payment.paymentMethod || 'N/A',
      'Fecha': format(new Date(payment.createdAt), 'dd/MM/yyyy HH:mm'),
    }));
    handleExportToExcel(paymentsData, 'reporte_pagos');
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Reportes y Análisis</h1>
          <p className="text-muted-foreground">
            Panel de control con métricas del sistema y análisis de negocio
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="last7days">Últimos 7 días</SelectItem>
              <SelectItem value="last30days">Últimos 30 días</SelectItem>
              <SelectItem value="last90days">Últimos 3 meses</SelectItem>
              <SelectItem value="lastyear">Último año</SelectItem>
              <SelectItem value="custom">Período personalizado</SelectItem>
            </SelectContent>
          </Select>
          {selectedPeriod === "custom" && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-muted-foreground">Filtro de fechas próximamente disponible</span>
            </div>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Resumen General</TabsTrigger>
          <TabsTrigger value="companies">Empresas</TabsTrigger>
          <TabsTrigger value="users">Usuarios</TabsTrigger>
          <TabsTrigger value="revenue">Ingresos</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Empresas</CardTitle>
                <Building className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{companies.length}</div>
                <p className="text-xs text-muted-foreground">
                  {companies.filter((c: any) => c.estado === 'activo').length} activas
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Usuarios</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{users.length}</div>
                <p className="text-xs text-muted-foreground">
                  {users.filter((u: any) => u.role === 'representante').length} representantes
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Pagos</CardTitle>
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{payments.length}</div>
                <p className="text-xs text-muted-foreground">
                  {payments.filter((p: any) => p.status === 'completed').length} completados
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatMoney(payments
                    .filter((p: any) => p.status === 'completed')
                    .reduce((sum: number, p: any) => sum + parseFloat(p.amount || '0'), 0))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {currencyCode}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Acciones Rápidas</CardTitle>
              <CardDescription>
                Exportar reportes y realizar análisis detallados
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-4">
              <Button onClick={exportCompaniesReport} variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Exportar Empresas
              </Button>
              <Button onClick={exportUsersReport} variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Exportar Usuarios
              </Button>
              <Button onClick={exportPaymentsReport} variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Exportar Pagos
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="companies" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Distribución por Plan de Membresía</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(
                    companies.reduce((acc: any, company: any) => {
                      const planName = company.membershipType?.nombrePlan || 'Sin Plan';
                      acc[planName] = (acc[planName] || 0) + 1;
                      return acc;
                    }, {})
                  ).map(([plan, count]) => (
                    <div key={plan} className="flex justify-between items-center">
                      <span className="text-sm font-medium">{plan}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{count as number}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {((count as number / companies.length) * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Estados de Empresas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(
                    companies.reduce((acc: any, company: any) => {
                      const estado = company.estado || 'Desconocido';
                      acc[estado] = (acc[estado] || 0) + 1;
                      return acc;
                    }, {})
                  ).map(([estado, count]) => (
                    <div key={estado} className="flex justify-between items-center">
                      <span className="text-sm font-medium capitalize">{estado}</span>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={estado === 'activo' ? 'default' : 'secondary'}
                        >
                          {count as number}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {((count as number / companies.length) * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Empresas Recientes</CardTitle>
              <CardDescription>
                Últimas 10 empresas registradas en el sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {companies
                  .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .slice(0, 10)
                  .map((company: any) => (
                    <div key={company.id} className="flex justify-between items-center p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{company.nombreEmpresa}</p>
                        <p className="text-sm text-muted-foreground">{company.email1}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant={company.estado === 'activo' ? 'default' : 'secondary'}>
                          {company.membershipType?.nombrePlan || 'Sin Plan'}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(company.createdAt), 'dd/MM/yyyy', { locale: es })}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Distribución por Rol</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(
                    users.reduce((acc: any, user: any) => {
                      const role = user.role || 'Sin Rol';
                      acc[role] = (acc[role] || 0) + 1;
                      return acc;
                    }, {})
                  ).map(([role, count]) => (
                    <div key={role} className="flex justify-between items-center">
                      <span className="text-sm font-medium capitalize">{role}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{count as number}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {((count as number / users.length) * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Actividad de Usuarios</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Usuarios Activos</span>
                    <Badge variant="default">
                      {users.filter((u: any) => u.isActive !== false).length}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Usuarios Inactivos</span>
                    <Badge variant="secondary">
                      {users.filter((u: any) => u.isActive === false).length}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Usuarios Recientes</CardTitle>
              <CardDescription>
                Últimos 10 usuarios registrados en el sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {users
                  .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .slice(0, 10)
                  .map((user: any) => (
                    <div key={user.id} className="flex justify-between items-center p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{user.displayName || 'Sin nombre'}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant={user.role === 'admin' ? 'default' : 'outline'}>
                          {user.role || 'Sin rol'}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(user.createdAt), 'dd/MM/yyyy', { locale: es })}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="revenue" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Resumen de Ingresos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Total de Transacciones</span>
                    <Badge variant="outline">{payments.length}</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Transacciones Completadas</span>
                    <Badge variant="default">
                      {payments.filter((p: any) => p.status === 'completed').length}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Ingresos Totales</span>
                    <Badge variant="default">
                      {formatMoney(payments
                        .filter((p: any) => p.status === 'completed')
                        .reduce((sum: number, p: any) => sum + parseFloat(p.amount || '0'), 0))}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Estados de Pago</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(
                    payments.reduce((acc: any, payment: any) => {
                      const status = payment.status || 'Desconocido';
                      acc[status] = (acc[status] || 0) + 1;
                      return acc;
                    }, {})
                  ).map(([status, count]) => (
                    <div key={status} className="flex justify-between items-center">
                      <span className="text-sm font-medium capitalize">{status}</span>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={status === 'completed' ? 'default' : 'secondary'}
                        >
                          {count as number}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {((count as number / payments.length) * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Transacciones Recientes</CardTitle>
              <CardDescription>
                Últimas 10 transacciones procesadas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {payments
                  .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .slice(0, 10)
                  .map((payment: any) => (
                    <div key={payment.id} className="flex justify-between items-center p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">
                          {formatMoney(payment.amount, payment.currency)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {payment.company?.nombreEmpresa || 'Empresa desconocida'}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge 
                          variant={payment.status === 'completed' ? 'default' : 'secondary'}
                        >
                          {payment.status}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(payment.createdAt), 'dd/MM/yyyy HH:mm', { locale: es })}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}