import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building, Users, Plus, DollarSign, TrendingUp, Activity, BarChart3, PieChart, UserPlus } from "lucide-react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
} from 'chart.js';
import { Bar, Pie, Line } from 'react-chartjs-2';
import StatCard from "@/components/StatCard";
import CompanyTable from "@/components/CompanyTable";
import AddCompanyModal from "@/components/AddCompanyModal";
import EditCompanyModal from "@/components/EditCompanyModal";
import AddUserModal from "@/components/AddUserModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CompanyWithDetails, Category, MembershipType } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import Swal from 'sweetalert2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
);

interface StatisticsData {
  totalCompanies: number;
  activeUsers: number;
  newRegistrations: number;
  totalRevenue: number;
}

export default function Dashboard() {
  const { isAdmin, user, loading } = useAuth();

  // Immediate redirect for representatives - no delay
  if (!loading && user && !isAdmin) {
    window.location.replace("/representative-dashboard?tab=overview");
    return null; // Don't render anything while redirecting
  }

  // Show loading while checking authentication
  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return <DashboardContent />;
}

function DashboardContent() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<CompanyWithDetails | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const { toast } = useToast();
  const { isAdmin } = useAuth();

  // Queries
  const { data: statistics, isLoading: statisticsLoading } = useQuery<StatisticsData>({
    queryKey: ["/api/statistics"],
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: companiesData, isLoading: companiesLoading } = useQuery({
    queryKey: ["/api/companies", { 
      search: searchTerm, 
      categoryId: selectedCategory === "all" ? undefined : selectedCategory,
      page: currentPage 
    }],
    queryFn: async () => {
      const params = new URLSearchParams({
        search: searchTerm,
        page: currentPage.toString(),
        limit: "10"
      });
      
      if (selectedCategory !== "all") {
        params.append("categoryId", selectedCategory);
      }
      
      // Panel de administración: usa el endpoint admin, que incluye TODAS las
      // empresas (también inactivas y con membresía vencida). El endpoint público
      // /api/companies oculta las inactivas, por eso no aparecían todas aquí.
      // El queryKey se mantiene en "/api/companies" para que las invalidaciones
      // de caché de los modales (agregar/editar/eliminar) sigan refrescando esta lista.
      const response = await fetch(`/api/admin/companies?${params.toString()}`);
      return response.json();
    },
  });

  // Mutations
  const deleteCompanyMutation = useMutation({
    mutationFn: async (companyId: number) => {
      return await apiRequest(`/api/companies/${companyId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/statistics"] });
      toast({
        title: "Éxito",
        description: "Empresa eliminada correctamente",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "No se pudo eliminar la empresa",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (company: CompanyWithDetails) => {
    setSelectedCompany(company);
    setIsEditModalOpen(true);
  };

  const handleDelete = async (companyId: number) => {
    const result = await Swal.fire({
      title: '¿Eliminar empresa?',
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
      deleteCompanyMutation.mutate(companyId);
    }
  };

  const handleView = (company: CompanyWithDetails) => {
    console.log("Viewing company:", company);
    toast({
      title: "Ver empresa",
      description: `Mostrando detalles de ${company.nombreEmpresa}`,
    });
  };

  const companies = companiesData?.companies || [];
  const totalPages = companiesData?.totalPages || 1;

  // Chart data configurations
  const companiesBarData = {
    labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'],
    datasets: [
      {
        label: 'Empresas Registradas',
        data: [5, 8, 12, 15, 18, statistics?.totalCompanies || 0],
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 2,
      },
    ],
  };

  const usersPieData = {
    labels: ['Usuarios Activos', 'Nuevos Registros', 'Usuarios Inactivos'],
    datasets: [
      {
        data: [
          statistics?.activeUsers || 0,
          statistics?.newRegistrations || 0,
          Math.max(0, (statistics?.totalCompanies || 0) - (statistics?.activeUsers || 0))
        ],
        backgroundColor: [
          'rgba(34, 197, 94, 0.8)',
          'rgba(59, 130, 246, 0.8)',
          'rgba(156, 163, 175, 0.8)',
        ],
        borderColor: [
          'rgba(34, 197, 94, 1)',
          'rgba(59, 130, 246, 1)',
          'rgba(156, 163, 175, 1)',
        ],
        borderWidth: 2,
      },
    ],
  };

  const revenueLineData = {
    labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'],
    datasets: [
      {
        label: 'Ingresos ($)',
        data: [15000, 18000, 22000, 28000, 32000, statistics?.totalRevenue || 0],
        fill: false,
        borderColor: 'rgba(16, 185, 129, 1)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.4,
        pointBackgroundColor: 'rgba(16, 185, 129, 1)',
        pointBorderColor: 'rgba(16, 185, 129, 1)',
        pointRadius: 5,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
      },
      title: {
        display: false,
      },
    },
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary">Dashboard</h1>
          <p className="text-gray-600 mt-1">Resumen general de la plataforma</p>
        </div>
        {/* Botones de administración - Solo para administradores */}
        {isAdmin && (
          <div className="flex items-center gap-3">
            <Button 
              onClick={() => setIsAddUserModalOpen(true)} 
              variant="outline"
              className="flex items-center space-x-2"
              data-testid="button-new-user"
            >
              <UserPlus className="w-4 h-4" />
              <span>Nuevo Usuario</span>
            </Button>
            <Button 
              onClick={() => setIsAddModalOpen(true)} 
              className="flex items-center space-x-2 bg-secondary text-secondary-foreground hover:bg-secondary/90"
              data-testid="button-new-company"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Empresa</span>
            </Button>
          </div>
        )}
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Empresas"
          value={statisticsLoading ? "..." : statistics?.totalCompanies || 0}
          icon={Building}
          trend={{ value: 12, isPositive: true }}
        />
        <StatCard
          title="Usuarios Activos"
          value={statisticsLoading ? "..." : statistics?.activeUsers || 0}
          icon={Users}
          trend={{ value: 8, isPositive: true }}
        />
        <StatCard
          title="Nuevos Registros"
          value={statisticsLoading ? "..." : statistics?.newRegistrations || 0}
          icon={Activity}
          trend={{ value: 23, isPositive: true }}
        />
        <StatCard
          title="Ingresos Totales"
          value={statisticsLoading ? "..." : `$${statistics?.totalRevenue?.toLocaleString() || 0}`}
          icon={DollarSign}
          trend={{ value: 15, isPositive: true }}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Companies Growth Chart */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-medium">Crecimiento de Empresas</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              {statisticsLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-gray-500">Cargando gráfico...</div>
                </div>
              ) : (
                <Bar data={companiesBarData} options={chartOptions} />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Users Distribution Chart */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-medium">Distribución de Usuarios</CardTitle>
            <PieChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              {statisticsLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-gray-500">Cargando gráfico...</div>
                </div>
              ) : (
                <Pie data={usersPieData} options={pieOptions} />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Trend Chart */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base font-medium">Tendencia de Ingresos</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            {statisticsLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-gray-500">Cargando gráfico...</div>
              </div>
            ) : (
              <Line data={revenueLineData} options={chartOptions} />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Company Directory Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Directorio de Empresas</CardTitle>
            <div className="flex items-center space-x-3">
              <Input
                placeholder="Buscar empresas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-80"
              />
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Todas las categorías" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las categorías</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id.toString()}>
                      {category.nombreCategoria}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {companiesLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-gray-500">Cargando empresas...</div>
            </div>
          ) : (
            <>
              <CompanyTable
                companies={companies}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onView={handleView}
              />
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6">
                  <p className="text-sm text-gray-700">
                    Página {currentPage} de {totalPages}
                  </p>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      <AddCompanyModal
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
      />

      <EditCompanyModal
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        company={selectedCompany}
      />

      <AddUserModal
        isOpen={isAddUserModalOpen}
        onClose={() => setIsAddUserModalOpen(false)}
      />
    </div>
  );
}