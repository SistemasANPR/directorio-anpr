import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { UserPlus, MoreHorizontal, Edit, Trash2, Users as UsersIcon, User, Search, Filter, ExternalLink, ChevronLeft, ChevronRight, Building, Phone, Mail, Globe, MapPin, KeyRound, UserCheck } from "lucide-react";
import { User as UserType, MembershipType } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Swal from 'sweetalert2';
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const userSchema = z.object({
  displayName: z.string().min(1, "El nombre es requerido"),
  email: z.string().email("Email inválido"),
  role: z.string().min(1, "El rol es requerido"),
  companyId: z.string().optional(),
});

type UserFormData = z.infer<typeof userSchema>;

const createUserSchema = z.object({
  displayName: z.string().min(1, "El nombre es requerido"),
  email: z.string().email("Email inválido"),
  role: z.string().min(1, "El rol es requerido"),
  nombreEmpresa: z.string().optional(),
  telefono1: z.string().optional(),
  direccionFisica: z.string().optional(),
  descripcionEmpresa: z.string().optional(),
  sitioWeb: z.string().optional(),
  membershipTypeId: z.number().optional(),
  membershipPeriodicidad: z.enum(["mensual", "anual"]).optional(),
});

type CreateUserFormData = z.infer<typeof createUserSchema>;

const isRepresentativeRole = (role: unknown) => {
  const normalizedRole = String(role || "").trim().toLowerCase();
  return normalizedRole === "representante" || normalizedRole === "representative";
};

export default function Users() {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState<UserType | null>(null);
  const [newResetPassword, setNewResetPassword] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserType | null>(null);
  // Asignación común de representantes locales o provenientes de WordPress.
  const [isAssignCompanyOpen, setIsAssignCompanyOpen] = useState(false);
  const [assignWpUser, setAssignWpUser] = useState<any | null>(null);
  const [assignCompanyId, setAssignCompanyId] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const usersPerPage = 50;
  const { toast } = useToast();
  const { isAdmin, impersonateCompany } = useAuth();
  const [, navigate] = useLocation();

  const editForm = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      displayName: "",
      email: "",
      role: "user",
      companyId: "",
    },
  });

  const createForm = useForm<CreateUserFormData>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      displayName: "",
      email: "",
      role: "representante",
      nombreEmpresa: "",
      telefono1: "",
      direccionFisica: "",
      descripcionEmpresa: "",
      sitioWeb: "",
      membershipTypeId: undefined,
      membershipPeriodicidad: "anual",
    },
  });

  // Fetch users with filters
  const { data: users = [], isLoading } = useQuery<UserType[]>({
    queryKey: ["/api/users", { search: searchTerm, role: selectedRole }],
    queryFn: async () => {
      const response = await fetch("/api/users", {
        credentials: "include",
      });
      
      if (!response.ok) throw new Error("Failed to fetch users");
      const allUsers = await response.json();
      
      // Apply client-side filtering since the API doesn't support it yet
      let filteredUsers = allUsers;
      
      if (searchTerm) {
        filteredUsers = filteredUsers.filter((user: UserType) =>
          user.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.email.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }
      
      if (selectedRole && selectedRole !== "all") {
        filteredUsers = filteredUsers.filter((user: UserType) => user.role === selectedRole);
      }
      
      return filteredUsers;
    },
  });

  // Fetch WordPress users (without filtering in query)
  const { data: rawWordpressData, isLoading: isLoadingWordPress } = useQuery({
    queryKey: ["/api/wordpress-users"],
    queryFn: async () => {
      const response = await fetch("/api/wordpress-users", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch WordPress users");
      return response.json();
    },
  });

  // Apply filtering and pagination to WordPress users in memory
  const wordpressData = useMemo(() => {
    if (!rawWordpressData?.users) return { ...rawWordpressData, paginatedUsers: [], totalPages: 0, currentPage: 1 };
    
    let filteredUsers = rawWordpressData.users;
    
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filteredUsers = filteredUsers.filter((wpUser: any) =>
        wpUser.name?.toLowerCase().includes(searchLower) ||
        wpUser.email?.toLowerCase().includes(searchLower) ||
        wpUser.slug?.toLowerCase().includes(searchLower) ||
        wpUser.username?.toLowerCase().includes(searchLower) ||
        wpUser.first_name?.toLowerCase().includes(searchLower) ||
        wpUser.last_name?.toLowerCase().includes(searchLower) ||
        (wpUser.first_name && wpUser.last_name && 
         `${wpUser.first_name} ${wpUser.last_name}`.toLowerCase().includes(searchLower))
      );
    }
    
    if (selectedRole && selectedRole !== "all") {
      // For WordPress users, we can filter by their WordPress roles
      if (selectedRole === "admin") {
        filteredUsers = filteredUsers.filter((wpUser: any) => 
          wpUser.roles && wpUser.roles.includes("administrator")
        );
      } else if (selectedRole === "user") {
        filteredUsers = filteredUsers.filter((wpUser: any) => 
          wpUser.roles && (wpUser.roles.includes("subscriber") || wpUser.roles.includes("customer"))
        );
      } else if (selectedRole === "representante") {
        filteredUsers = filteredUsers.filter((wpUser: any) => 
          wpUser.roles && (wpUser.roles.includes("editor") || wpUser.roles.includes("author"))
        );
      }
    }
    
    // Calculate pagination
    const totalPages = Math.ceil(filteredUsers.length / usersPerPage);
    const startIndex = (currentPage - 1) * usersPerPage;
    const endIndex = startIndex + usersPerPage;
    const paginatedUsers = filteredUsers.slice(startIndex, endIndex);
    
    return { 
      ...rawWordpressData, 
      users: filteredUsers, // Keep all filtered users for count
      paginatedUsers, // Users for current page
      totalPages,
      currentPage,
      totalFiltered: filteredUsers.length
    };
  }, [rawWordpressData, searchTerm, selectedRole, currentPage, usersPerPage]);

  // Fetch roles for user assignment
  const { data: roles = [] } = useQuery({
    queryKey: ["/api/roles"],
    queryFn: async () => {
      const response = await fetch("/api/roles", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch roles");
      return response.json();
    },
  });

  // Fetch companies for representative assignment
  const { data: companiesData = [] } = useQuery({
    queryKey: ["/api/companies"],
    queryFn: async () => {
      const response = await fetch("/api/companies?limit=1000", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch companies");
      const data = await response.json();
      console.log("Debug - Companies loaded for dropdown:", data.companies?.length, "empresas");
      console.log("Debug - Companies names:", data.companies?.map((c: any) => c.nombreEmpresa));
      return data.companies || [];
    },
  });

  // Ensure companies is always an array
  const companies = Array.isArray(companiesData) ? companiesData : [];

  const { data: representativeAssignmentData } = useQuery<{
    assignments: Array<{ representativeUserId: number; company: any }>;
  }>({
    queryKey: ["/api/admin/representative-company-associations"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/representative-company-associations");
      return response.json();
    },
    enabled: isAdmin,
  });

  const representativeCompaniesByUser = useMemo(() => {
    const grouped = new Map<number, any[]>();
    for (const assignment of representativeAssignmentData?.assignments || []) {
      const current = grouped.get(assignment.representativeUserId) || [];
      current.push(assignment.company);
      grouped.set(assignment.representativeUserId, current);
    }
    return grouped;
  }, [representativeAssignmentData]);

  // Fetch membership types for create user modal
  const { data: membershipTypes = [] } = useQuery<MembershipType[]>({
    queryKey: ["/api/membership-types"],
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (data: CreateUserFormData) => {
      // Only include company data if company name is provided and not empty
      const hasCompanyData = Boolean(data.nombreEmpresa?.trim());
      
      const response = await apiRequest("POST", "/api/admin/create-user-with-company", {
        userData: {
          email: data.email,
          displayName: data.displayName,
          role: data.role,
        },
        companyData: hasCompanyData ? {
          nombreEmpresa: data.nombreEmpresa!.trim(),
          email1: data.email,
          telefono1: data.telefono1 || "",
          direccionFisica: data.direccionFisica || "",
          descripcionEmpresa: data.descripcionEmpresa || "",
          sitioWeb: data.sitioWeb || "",
        } : null,
        membershipTypeId: hasCompanyData ? data.membershipTypeId : null,
        membershipPeriodicidad: hasCompanyData ? data.membershipPeriodicidad : null,
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/representative-company-associations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wordpress-users"] });
      
      if (data.user?.tempPassword) {
        Swal.fire({
          title: 'Usuario Creado',
          html: `
            <div class="text-left">
              <p><strong>Email:</strong> ${data.user.email}</p>
              <p><strong>Nombre:</strong> ${data.user.displayName}</p>
              ${data.company ? `<p><strong>Empresa:</strong> ${data.company.nombreEmpresa}</p>` : ''}
              <div class="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                <p class="font-bold text-red-600">Contraseña Temporal:</p>
                <p class="font-mono text-lg">${data.user.tempPassword}</p>
                <p class="text-xs text-gray-600 mt-2">Guarda esta contraseña. El usuario deberá cambiarla en su primer inicio de sesión.</p>
              </div>
            </div>
          `,
          icon: 'success',
          confirmButtonText: 'Entendido',
          width: '500px',
        });
      } else {
        toast({
          title: "Usuario creado",
          description: "El usuario ha sido creado exitosamente",
        });
      }
      
      createForm.reset();
      setIsCreateModalOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo crear el usuario",
        variant: "destructive",
      });
    },
  });

  const onCreateSubmit = (data: CreateUserFormData) => {
    if (isRepresentativeRole(data.role) && !data.nombreEmpresa?.trim()) {
      createForm.setError("nombreEmpresa", {
        message: "La empresa inicial es obligatoria para un representante",
      });
      return;
    }
    createUserMutation.mutate(data);
  };

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async (data: UserFormData) => {
      if (!selectedUser) throw new Error("No user selected");
      const response = await apiRequest("PUT", `/api/users/${selectedUser.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      toast({
        title: "Usuario actualizado",
        description: "El usuario ha sido actualizado exitosamente",
      });
      editForm.reset();
      setIsEditModalOpen(false);
      setSelectedUser(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo actualizar el usuario",
        variant: "destructive",
      });
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await apiRequest("DELETE", `/api/users/${userId}`);
      // Puede venir sin cuerpo en algunos casos; lo leemos con tolerancia.
      try {
        return await res.json();
      } catch {
        return { success: true } as any;
      }
    },
    onSuccess: (data: any) => {
      // La eliminación desvincula empresas, así que refrescamos también empresas.
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      toast({
        title: "Usuario eliminado",
        description:
          data?.message || "La cuenta ha sido eliminada correctamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "No se pudo eliminar el usuario",
        variant: "destructive",
      });
    },
  });

  // Reset password mutation (only for manual accounts)
  const resetPasswordMutation = useMutation({
    mutationFn: async ({ userId, newPassword }: { userId: number; newPassword: string }) => {
      const res = await apiRequest("POST", "/api/admin/reset-user-password", { userId, newPassword });
      return res.json();
    },
    onSuccess: () => {
      setIsResetPasswordOpen(false);
      setNewResetPassword("");
      setResetPasswordUser(null);
      toast({
        title: "Contraseña restablecida",
        description: "La contraseña ha sido restablecida. El usuario deberá cambiarla al iniciar sesión.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo restablecer la contraseña",
        variant: "destructive",
      });
    },
  });

  // Agrega cualquier representante a una empresa. WordPress conserva su flujo
  // de alta únicamente cuando todavía no existe una cuenta local reutilizable.
  const assignCompanyMutation = useMutation({
    mutationFn: async ({ companyId, wpUser }: { companyId: number; wpUser: any }) => {
      if (wpUser.localUserId && isRepresentativeRole(wpUser.localRole)) {
        const res = await apiRequest(
          "POST",
          `/api/admin/users/${wpUser.localUserId}/companies`,
          { companyId },
        );
        return res.json();
      }

      const fd = new FormData();
      fd.append(
        "wordpressUser",
        JSON.stringify({
          id: wpUser.id,
          name: wpUser.name,
          username: wpUser.username,
          email: wpUser.email,
        }),
      );
      const res = await apiRequest("PATCH", `/api/companies/${companyId}`, fd);
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wordpress-users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/representative-company-associations"] });
      const company = companies.find((c: any) => c.id === variables.companyId);
      toast({
        title: "Empresa agregada",
        description: `Representante agregado${company ? ` a ${company.nombreEmpresa}` : ""}.`,
      });
      setIsAssignCompanyOpen(false);
      setAssignWpUser(null);
      setAssignCompanyId("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo agregar el usuario a la empresa",
        variant: "destructive",
      });
    },
  });

  const removeCompanyMutation = useMutation({
    mutationFn: async ({ userId, companyId }: { userId: number; companyId: number }) => {
      const res = await apiRequest(
        "DELETE",
        `/api/admin/users/${userId}/companies/${companyId}`,
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wordpress-users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/representative-company-associations"] });
      toast({
        title: "Empresa retirada",
        description: "La asociación se retiró sin afectar las demás empresas.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo retirar la empresa",
        variant: "destructive",
      });
    },
  });

  const getAssignedCompaniesForWpUser = (wpUser: any) =>
    Array.isArray(wpUser?.assignedCompanies) ? wpUser.assignedCompanies : [];

  const getAssignedCompanyCount = (wpUser: any) =>
    typeof wpUser?.assignedCompanyCount === "number"
      ? wpUser.assignedCompanyCount
      : getAssignedCompaniesForWpUser(wpUser).length;

  const getAssignedCompaniesForUser = (user: UserType) =>
    representativeCompaniesByUser.get(user.id) || [];

  const openAssignCompany = (wpUser: any) => {
    setAssignWpUser(wpUser);
    setAssignCompanyId("");
    setIsAssignCompanyOpen(true);
  };

  const assignedCompaniesForModal = getAssignedCompaniesForWpUser(assignWpUser);
  const assignedCompanyIdsForModal = new Set(
    assignedCompaniesForModal.map((company: any) => String(company.id)),
  );
  const availableCompaniesForModal = companies.filter(
    (company: any) => !assignedCompanyIdsForModal.has(String(company.id)),
  );

  const handleResetPassword = (user: UserType) => {
    setResetPasswordUser(user);
    setNewResetPassword("");
    setIsResetPasswordOpen(true);
  };

  const onEditSubmit = (data: UserFormData) => {
    if (
      selectedUser &&
      !isRepresentativeRole(selectedUser.role) &&
      isRepresentativeRole(data.role) &&
      !data.companyId
    ) {
      editForm.setError("companyId", {
        message: "Selecciona la primera empresa del representante",
      });
      return;
    }
    updateUserMutation.mutate(data);
  };

  // Impersonar exige escoger una empresa de la asociación normalizada.
  const handleImpersonate = (u: { id: number }, company: any) => {
    impersonateCompany(company, u.id);
    toast({
      title: "Modo representante activado",
      description: `Ahora está actuando como representante de ${company.nombreEmpresa}`,
    });
    navigate("/representative-dashboard");
  };

  const handleRemoveCompany = async (userId: number, company: any) => {
    const result = await Swal.fire({
      title: "¿Retirar esta empresa?",
      text: `Se retirará ${company.nombreEmpresa || company.name} de este representante. Las demás asociaciones no cambiarán.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, retirar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc2626",
    });
    if (result.isConfirmed) {
      removeCompanyMutation.mutate({ userId, companyId: company.id });
    }
  };

  const handleEdit = (user: UserType) => {
    setSelectedUser(user);
    editForm.reset({
      displayName: user.displayName || "",
      email: user.email,
      role: user.role,
      companyId: "",
    });
    setIsEditModalOpen(true);
  };

  const handleDelete = async (userId: number) => {
    const result = await Swal.fire({
      title: '¿Eliminar usuario?',
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
      deleteUserMutation.mutate(userId);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-red-100 text-red-800";
      case "user":
        return "bg-blue-100 text-blue-800";
      case "representante":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case "admin":
        return "Administrador";
      case "user":
        return "Usuario";
      case "representante":
        return "Representante";
      default:
        return role;
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedRole("all");
    setCurrentPage(1);
  };

  // Reset to page 1 when filters change
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleRoleChange = (value: string) => {
    setSelectedRole(value);
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary">Gestión de Usuarios</h1>
          <p className="text-gray-600 mt-1">Administra los usuarios del sistema y sus permisos</p>
        </div>
        <Button 
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2"
          data-testid="button-create-user"
        >
          <UserPlus className="h-4 w-4" />
          Crear Usuario
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="w-5 h-5" />
            <span>Filtros de búsqueda</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar en ambas listas..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={selectedRole} onValueChange={handleRoleChange}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por rol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los roles</SelectItem>
                {roles
                  .filter((role: any) => role.estado === "activo")
                  .map((role: any) => (
                    <SelectItem key={role.id} value={role.nombre.toLowerCase()}>
                      {role.nombre}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>

            <Button 
              variant="outline" 
              onClick={clearFilters}
              className={searchTerm || selectedRole ? "border-orange-200 bg-orange-50" : ""}
            >
              Limpiar filtros
            </Button>
          </div>
          
          {(searchTerm || selectedRole) && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-800">
                <strong>Filtros activos:</strong>
                {searchTerm && <span className="ml-2">Búsqueda: "{searchTerm}"</span>}
                {selectedRole && selectedRole !== "all" && <span className="ml-2">Rol: {getRoleDisplayName(selectedRole)}</span>}
              </p>
              <p className="text-xs text-blue-600 mt-1">
                Los filtros se aplican tanto a usuarios del sistema como a usuarios de WordPress
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Usuarios del sistema ({users.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-gray-500">Cargando usuarios...</div>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12">
              <UsersIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">
                {searchTerm || selectedRole ? "No se encontraron usuarios" : "No hay usuarios registrados"}
              </p>
              <p className="text-gray-400 text-sm">
                {searchTerm || selectedRole 
                  ? "Intenta cambiar los filtros de búsqueda" 
                  : "Los usuarios aparecerán aquí cuando se registren"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Empresas</TableHead>
                    <TableHead>Fecha de Registro</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={user.photoURL || ""} alt={user.displayName || ""} />
                            <AvatarFallback>
                              <User className="w-4 h-4" />
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-gray-900">
                              {user.displayName || "Sin nombre"}
                            </p>
                            <p className="text-xs text-gray-500">
                              ID: {user.firebaseUid.substring(0, 8)}...
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <div className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getRoleBadgeColor(user.role)}`}>
                          {getRoleDisplayName(user.role)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {isRepresentativeRole(user.role) ? (
                          (() => {
                            const assignedCompanies = getAssignedCompaniesForUser(user);
                            const hasReachedCompanyLimit = assignedCompanies.length >= 3;
                            return (
                              <div className="min-w-[220px] space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs font-medium text-gray-600">
                                    {assignedCompanies.length}/3 asignadas
                                  </span>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={hasReachedCompanyLimit}
                                    onClick={() => openAssignCompany({
                                      ...user,
                                      name: user.displayName,
                                      localUserId: user.id,
                                      localRole: user.role,
                                      assignedCompanies,
                                      assignedCompanyCount: assignedCompanies.length,
                                      source: "local",
                                    })}
                                  >
                                    <Building className="mr-1 h-3 w-3" />
                                    {assignedCompanies.length > 0 ? "Asignar otra" : "Asignar"}
                                  </Button>
                                </div>
                                {assignedCompanies.length > 0 ? (
                                  <div className="space-y-1">
                                    {assignedCompanies.map((company: any) => (
                                      <div
                                        key={company.id}
                                        className="flex items-center justify-between gap-2 rounded border px-2 py-1 text-xs"
                                      >
                                        <span className="max-w-[160px] truncate" title={company.nombreEmpresa}>
                                          {company.nombreEmpresa}
                                        </span>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 w-6 p-0 text-destructive"
                                          onClick={() => handleRemoveCompany(user.id, company)}
                                          disabled={
                                            removeCompanyMutation.isPending ||
                                            assignedCompanies.length <= 1
                                          }
                                          title={
                                            assignedCompanies.length <= 1
                                              ? "Cambia el rol para retirar la última empresa"
                                              : "Retirar empresa"
                                          }
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-400">Sin empresas asignadas</span>
                                )}
                              </div>
                            );
                          })()
                        ) : (
                          <span className="text-xs text-gray-400">No aplica</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(user.createdAt).toLocaleDateString('es-ES')}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(user)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            {isAdmin && getAssignedCompaniesForUser(user).map((company: any) => (
                              <DropdownMenuItem
                                key={company.id}
                                onClick={() => handleImpersonate(user, company)}
                              >
                                <UserCheck className="mr-2 h-4 w-4" />
                                Actuar en {company.nombreEmpresa}
                              </DropdownMenuItem>
                            ))}
                            {(user.firebaseUid?.startsWith("manual_") || user.firebaseUid?.startsWith("admin-created-")) && (
                              <DropdownMenuItem onClick={() => handleResetPassword(user)}>
                                <KeyRound className="mr-2 h-4 w-4" />
                                Restablecer contraseña
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem 
                              onClick={() => handleDelete(user.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* WordPress Users Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ExternalLink className="h-5 w-5" />
                Usuarios de WordPress ({wordpressData?.totalFiltered || wordpressData?.users?.length || 0})
              </CardTitle>
              <p className="text-sm text-gray-500">
                Usuarios sincronizados desde WordPress. Puedes asignarlos como representante de una empresa con el botón "Asignar a empresa".
                {wordpressData?.totalPages > 1 && (
                  <span className="ml-2 font-medium">
                    Página {currentPage} de {wordpressData.totalPages} 
                    (mostrando {usersPerPage} por página)
                  </span>
                )}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingWordPress ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-gray-500">Cargando usuarios de WordPress...</div>
            </div>
          ) : !wordpressData || wordpressData.totalFiltered === 0 ? (
            <div className="text-center py-8">
              <UsersIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                {searchTerm || selectedRole ? "No se encontraron usuarios" : "Sin usuarios de WordPress"}
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {searchTerm || selectedRole 
                  ? "Intenta cambiar los filtros de búsqueda para ver más resultados"
                  : "No se encontraron usuarios en WordPress o la sincronización no está configurada."
                }
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead>Fecha de registro</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead className="text-right">Empresa / Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(wordpressData?.paginatedUsers || wordpressData?.users || []).map((wpUser: any) => (
                    <TableRow key={wpUser.id}>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          <div className="bg-blue-100 text-blue-600 rounded-full p-2">
                            <ExternalLink className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {wpUser.name || wpUser.first_name && wpUser.last_name 
                                ? `${wpUser.first_name || ''} ${wpUser.last_name || ''}`.trim()
                                : wpUser.username || wpUser.slug || 'Usuario sin nombre'
                              }
                            </p>
                            <p className="text-sm text-gray-500">
                              {wpUser.username ? `@${wpUser.username}` : `Slug: ${wpUser.slug}`}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={wpUser.email === 'No disponible' ? 'text-gray-400 italic' : ''}>
                          {wpUser.email}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {wpUser.roles && wpUser.roles.length > 0 ? (
                            wpUser.roles.map((role: string) => (
                              <div key={role} className="inline-flex items-center rounded-full border border-gray-300 px-2.5 py-0.5 text-xs font-semibold bg-white text-gray-700">
                                {role}
                              </div>
                            ))
                          ) : (
                            <span className="text-gray-400 text-sm">Sin roles</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {wpUser.registered_date ? (
                          new Date(wpUser.registered_date).toLocaleDateString('es-ES')
                        ) : (
                          <span className="text-gray-400">No disponible</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {wpUser.username ? (
                          <a 
                            href={`https://anpr.org.mx/profile-2/?${wpUser.username}/`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                          >
                            Ver perfil de Comunidad
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-gray-400">No disponible</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {wpUser.email && wpUser.email !== 'No disponible' ? (
                          (() => {
                            const assignedCompanies = getAssignedCompaniesForWpUser(wpUser);
                            const assignedCompanyCount = getAssignedCompanyCount(wpUser);
                            const hasReachedCompanyLimit = assignedCompanyCount >= 3;
                            const hasIncompatibleLocalRole =
                              !!wpUser.localUserId && !isRepresentativeRole(wpUser.localRole);
                            return (
                              <div className="flex flex-col items-end gap-1">
                                {assignedCompanies.length > 0 && (
                                  <div className="flex min-w-[220px] flex-col items-stretch gap-1 text-xs text-gray-500">
                                    {assignedCompanies.map((company: any) => (
                                      <div
                                        key={company.id}
                                        className="flex items-center justify-between gap-2 rounded border px-2 py-1"
                                      >
                                        <span className="max-w-[130px] truncate">
                                          {company.nombreEmpresa || company.name}
                                        </span>
                                        {wpUser.localUserId && (
                                          <div className="flex items-center gap-1">
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-6 px-1.5"
                                              onClick={() => handleImpersonate(
                                                { id: wpUser.localUserId },
                                                company,
                                              )}
                                              title="Actuar como representante"
                                            >
                                              <UserCheck className="h-3 w-3" />
                                            </Button>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-6 w-6 p-0 text-destructive"
                                              onClick={() => handleRemoveCompany(wpUser.localUserId, company)}
                                              disabled={
                                                removeCompanyMutation.isPending ||
                                                assignedCompanies.length <= 1
                                              }
                                              title={
                                                assignedCompanies.length <= 1
                                                  ? "Cambia el rol para retirar la última empresa"
                                                  : "Retirar empresa"
                                              }
                                            >
                                              <Trash2 className="h-3 w-3" />
                                            </Button>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {hasIncompatibleLocalRole && (
                                  <span className="max-w-[220px] text-xs text-red-600">
                                    La cuenta local existente no tiene rol de representante.
                                  </span>
                                )}
                                {hasReachedCompanyLimit && (
                                  <span className="text-xs text-amber-600">
                                    Máximo de 3 empresas alcanzado
                                  </span>
                                )}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openAssignCompany(wpUser)}
                                  disabled={hasReachedCompanyLimit || hasIncompatibleLocalRole}
                                  data-testid={`button-assign-company-${wpUser.id}`}
                                >
                                  <Building className="h-3 w-3 mr-1" />
                                  {hasReachedCompanyLimit
                                    ? "Máximo alcanzado"
                                    : assignedCompanyCount > 0
                                      ? "Asignar otra empresa"
                                      : "Asignar a empresa"}
                                </Button>
                              </div>
                            );
                          })()
                        ) : (
                          <span className="text-gray-400 text-xs italic">Sin email</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination Controls for WordPress Users */}
          {!isLoadingWordPress && wordpressData && wordpressData.totalPages > 1 && (
            <div className="border-t px-6 py-4 flex items-center justify-between bg-gray-50">
              <div className="text-sm text-gray-600">
                Mostrando {((currentPage - 1) * usersPerPage) + 1} a {Math.min(currentPage * usersPerPage, wordpressData.totalFiltered)} de {wordpressData.totalFiltered} usuarios
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(currentPage - 1, 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Anterior
                </Button>
                
                <span className="px-3 py-1 text-sm bg-white border rounded font-medium">
                  {currentPage} de {wordpressData.totalPages}
                </span>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.min(currentPage + 1, wordpressData.totalPages))}
                  disabled={currentPage === wordpressData.totalPages}
                >
                  Siguiente
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuario</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre *</FormLabel>
                    <FormControl>
                      <Input placeholder="Nombre completo del usuario" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email *</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="usuario@email.com" {...field} disabled />
                    </FormControl>
                    <FormMessage />
                    <p className="text-xs text-gray-500">
                      El email no puede ser modificado ya que está vinculado a Firebase
                    </p>
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rol *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar rol" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {roles
                          .filter((role: any) => role.estado === "activo")
                          .map((role: any) => (
                            <SelectItem key={role.id} value={role.nombre}>
                              {role.nombre}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                    <p className="text-xs text-gray-500">
                      Cada rol tiene permisos específicos en el sistema
                    </p>
                  </FormItem>
                )}
              />

              {selectedUser &&
                !isRepresentativeRole(selectedUser.role) &&
                isRepresentativeRole(editForm.watch("role")) && (
                  <FormField
                    control={editForm.control}
                    name="companyId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Primera empresa *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar empresa" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {companies.map((company: any) => (
                              <SelectItem key={company.id} value={String(company.id)}>
                                {company.nombreEmpresa}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                        <p className="text-xs text-gray-500">
                          Después podrás asignarle hasta dos empresas adicionales.
                        </p>
                      </FormItem>
                    )}
                  />
                )}

              <div className="flex items-center justify-end space-x-2 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setSelectedUser(null);
                  }}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={updateUserMutation.isPending}>
                  {updateUserMutation.isPending ? "Actualizando..." : "Actualizar Usuario"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Create User Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Crear Nuevo Usuario
            </DialogTitle>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-6">
              <Tabs defaultValue="user" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="user">Datos del Usuario</TabsTrigger>
                  <TabsTrigger value="company">Datos de la Empresa</TabsTrigger>
                </TabsList>
                
                <TabsContent value="user" className="space-y-4 mt-4">
                  <FormField
                    control={createForm.control}
                    name="displayName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre Completo *</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                            <Input placeholder="Nombre del usuario" {...field} className="pl-10" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={createForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Correo Electrónico *</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                            <Input type="email" placeholder="correo@ejemplo.com" {...field} className="pl-10" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={createForm.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rol *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar rol" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {roles
                              .filter((role: any) => role.estado === "activo")
                              .map((role: any) => (
                                <SelectItem key={role.id} value={role.nombre.toLowerCase()}>
                                  {role.nombre}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <p className="text-sm text-blue-800">
                      Se generará una contraseña temporal que deberás compartir con el usuario. 
                      El usuario deberá cambiarla en su primer inicio de sesión.
                    </p>
                  </div>
                </TabsContent>
                
                <TabsContent value="company" className="space-y-4 mt-4">
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md mb-4">
                    <p className="text-sm text-yellow-800">
                      Si el rol es "Representante", puedes asignarle una empresa. 
                      Deja vacío si solo quieres crear el usuario sin empresa.
                    </p>
                  </div>

                  <FormField
                    control={createForm.control}
                    name="nombreEmpresa"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre de la Empresa</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Building className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                            <Input placeholder="Nombre de la empresa" {...field} className="pl-10" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={createForm.control}
                      name="telefono1"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Teléfono</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                              <Input placeholder="Teléfono" {...field} className="pl-10" />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={createForm.control}
                      name="sitioWeb"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sitio Web</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Globe className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                              <Input placeholder="https://..." {...field} className="pl-10" />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={createForm.control}
                    name="direccionFisica"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Dirección</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <MapPin className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                            <Input placeholder="Dirección física" {...field} className="pl-10" />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={createForm.control}
                    name="descripcionEmpresa"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descripción</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Breve descripción de la empresa..." 
                            {...field} 
                            rows={3}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={createForm.control}
                      name="membershipTypeId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo de Membresía</FormLabel>
                          <Select 
                            onValueChange={(value) => field.onChange(parseInt(value))} 
                            value={field.value?.toString() || ""}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccionar plan" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {membershipTypes.map((type) => (
                                <SelectItem key={type.id} value={type.id.toString()}>
                                  {type.nombrePlan}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={createForm.control}
                      name="membershipPeriodicidad"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Periodicidad</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ""}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccionar" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="mensual">Mensual</SelectItem>
                              <SelectItem value="anual">Anual</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                    <p className="text-sm text-green-800">
                      Esta membresía será creada de forma gratuita (sin pago requerido).
                    </p>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex items-center justify-end space-x-2 pt-4 border-t">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    createForm.reset();
                  }}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={createUserMutation.isPending}>
                  {createUserMutation.isPending ? "Creando..." : "Crear Usuario"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Reset Password Modal */}
      <Dialog open={isResetPasswordOpen} onOpenChange={setIsResetPasswordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Restablecer Contraseña
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Establece una nueva contraseña para <strong>{resetPasswordUser?.displayName || resetPasswordUser?.email}</strong>.
              El usuario deberá cambiarla en su próximo inicio de sesión.
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium">Nueva contraseña</label>
              <Input
                type="text"
                placeholder="Mínimo 8 caracteres"
                value={newResetPassword}
                onChange={(e) => setNewResetPassword(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsResetPasswordOpen(false);
                  setNewResetPassword("");
                  setResetPasswordUser(null);
                }}
              >
                Cancelar
              </Button>
              <Button
                disabled={newResetPassword.length < 8 || resetPasswordMutation.isPending}
                onClick={() => {
                  if (resetPasswordUser) {
                    resetPasswordMutation.mutate({ userId: resetPasswordUser.id, newPassword: newResetPassword });
                  }
                }}
              >
                {resetPasswordMutation.isPending ? "Guardando..." : "Restablecer"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign any representative to an additional company */}
      <Dialog
        open={isAssignCompanyOpen}
        onOpenChange={(open) => {
          setIsAssignCompanyOpen(open);
          if (!open) {
            setAssignWpUser(null);
            setAssignCompanyId("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Agregar empresa
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Agrega a{" "}
              <strong>
                {assignWpUser?.name || assignWpUser?.displayName || assignWpUser?.username}
              </strong>
              {assignWpUser?.email ? ` (${assignWpUser.email})` : ""} como
              representante de una empresa adicional.
              {assignWpUser?.source === "wordpress" && !assignWpUser?.localUserId
                ? " Se creará la cuenta local de representante porque todavía no existe."
                : " Se reutilizará la cuenta existente sin reemplazar sus otras empresas."}
            </p>
            <p className="text-sm font-medium text-gray-700">
              Empresas asignadas: {getAssignedCompanyCount(assignWpUser)}/3
            </p>
            {assignedCompaniesForModal.length > 0 && (
              <div className="rounded-md bg-muted p-3 text-sm text-gray-600">
                <p className="mb-1 font-medium text-gray-700">Ya asignadas</p>
                <ul className="list-disc pl-5">
                  {assignedCompaniesForModal.map((company: any) => (
                    <li key={company.id}>{company.nombreEmpresa || company.name}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">Empresa</label>
              <Select value={assignCompanyId} onValueChange={setAssignCompanyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar empresa" />
                </SelectTrigger>
                <SelectContent>
                  {availableCompaniesForModal.map((company: any) => (
                    <SelectItem key={company.id} value={company.id.toString()}>
                      {company.nombreEmpresa}
                    </SelectItem>
                  ))}
                  {availableCompaniesForModal.length === 0 && (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      No hay empresas disponibles para agregar.
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsAssignCompanyOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                disabled={
                  !assignCompanyId ||
                  assignCompanyMutation.isPending ||
                  getAssignedCompanyCount(assignWpUser) >= 3
                }
                onClick={() => {
                  if (assignWpUser && assignCompanyId) {
                    assignCompanyMutation.mutate({
                      companyId: parseInt(assignCompanyId),
                      wpUser: assignWpUser,
                    });
                  }
                }}
                data-testid="button-confirm-assign-company"
              >
                {assignCompanyMutation.isPending ? "Agregando..." : "Agregar empresa"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
