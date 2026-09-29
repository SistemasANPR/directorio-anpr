import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { 
  Building, 
  BarChart3, 
  Users, 
  Tags, 
  Tag,
  Crown, 
  FileText,
  Award,
  Menu,
  X,
  LogOut,
  User,
  ChevronDown,
  ChevronRight,
  Shield,
  MessageSquare,
  Settings,
  Globe,
  Mail,
  CreditCard,
  UserCog,
  Home,
  Package
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { signOutUser } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";

interface SidebarProps {
  className?: string;
}

interface SubItem {
  name: string;
  href: string;
  requireAdmin: boolean;
}

interface NavigationItem {
  name: string;
  href: string;
  icon: any;
  requireAdmin: boolean;
  subItems?: SubItem[];
  // Cuando es true, el ítem navega a una URL EXTERNA con recarga completa (un
  // ancla normal, no el router interno). Se usa para "Regresar al Menú", que
  // pasa por el puente de SSO de WordPress y así no pierde la sesión.
  external?: boolean;
}

// Enlace puente al menú de WordPress. Reentra por el SSO (?anpr_go_directorio=1)
// para que el representante vuelva al directorio sin perder su sesión.
const MENU_BRIDGE_URL = "https://anpr.org.mx/?anpr_go_directorio=1";

const navigationItems: NavigationItem[] = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: BarChart3,
    requireAdmin: false,
  },
  {
    name: "Directorio de Empresas",
    href: "/empresas",
    icon: Building,
    requireAdmin: false,
    subItems: [
      {
        name: "Empresas",
        href: "/empresas",
        requireAdmin: false,
      },
      {
        name: "Categorías",
        href: "/categorias",
        requireAdmin: false,
      },
      {
        name: "Etiquetas",
        href: "/etiquetas",
        requireAdmin: true,
      },
      {
        name: "Planes",
        href: "/membresias",
        requireAdmin: false,
      },
      {
        name: "Certificados",
        href: "/certificados",
        requireAdmin: false,
      },
      {
        name: "Gestión de Reseñas",
        href: "/admin/reviews",
        requireAdmin: true,
      },
    ],
  },
  {
    name: "Gestión de Usuarios",
    href: "/usuarios",
    icon: Users,
    requireAdmin: true,
  },
  {
    name: "Roles del Sistema",
    href: "/roles",
    icon: Shield,
    requireAdmin: true,
  },
  {
    name: "Reportes",
    href: "/reportes",
    icon: FileText,
    requireAdmin: true,
  },
  {
    name: "Exportar Directorio",
    href: "/exportar-directorio",
    icon: Package,
    requireAdmin: true,
  },
  {
    name: "Mi Cuenta",
    href: "/configurar-cuenta",
    icon: UserCog,
    requireAdmin: false,
  },
  {
    name: "Regresar al Menú",
    href: MENU_BRIDGE_URL,
    icon: Home,
    requireAdmin: false,
    external: true,
  },
  {
    name: "Configuración",
    href: "/configuracion",
    icon: Settings,
    requireAdmin: true,
    subItems: [
      {
        name: "Configuración General",
        href: "/configuracion-sistema",
        requireAdmin: true,
      },
      {
        name: "Configuración PDF",
        href: "/configuracion-pdf",
        requireAdmin: true,
      },
      {
        name: "Configuración de Correos",
        href: "/admin/email-config",
        requireAdmin: true,
      },
      {
        name: "Configuración de Pagos",
        href: "/admin/configuracion-stripe",
        requireAdmin: true,
      },
      {
        name: "Integración WordPress",
        href: "/integracion",
        requireAdmin: true,
      },
      {
        name: "Configuración Frontend",
        href: "/configuracion-frontend",
        requireAdmin: true,
      },
      {
        name: "Prueba Membresías WordPress",
        href: "/wordpress-membership-test",
        requireAdmin: true,
      },
    ],
  },
];

export default function Sidebar({ className = "" }: SidebarProps) {
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const { user, isAdmin, isWordPressSession, isImpersonating, impersonatedCompany, stopImpersonation } = useAuth();

  // Contador de todas las reseñas pendientes de moderación (solo admins).
  const { data: pendingReviewsData } = useQuery<{ total: number }>({
    queryKey: ['/api/opinions', 'pending-count'],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/opinions?estado=pendiente&limit=1");
      return res.json();
    },
    enabled: isAdmin,
    refetchInterval: 60000,
  });
  const pendingReviewsCount = Number(pendingReviewsData?.total) || 0;

  const handleSignOut = async () => {
    try {
      // Clear temporary user data first
      localStorage.removeItem('tempUser');
      
      // Sign out from Firebase if authenticated
      await signOutUser();
      
      // Force redirect to login page
      window.location.href = '/login';
    } catch (error) {
      console.error("Error signing out:", error);
      // Force redirect even if there's an error
      localStorage.removeItem('tempUser');
      window.location.href = '/login';
    }
  };

  // Define navigation for company representatives
  const representativeNavItems: NavigationItem[] = [
    {
      name: "Mi Dashboard",
      href: "/representative-dashboard",
      icon: BarChart3,
      requireAdmin: false,
    },
    {
      name: "Mi Empresa",
      href: "/representative-dashboard?tab=company",
      icon: Building,
      requireAdmin: false,
    },
    {
      name: "Ver Directorio",
      href: "/directorio",
      icon: Globe,
      requireAdmin: false,
    },
    {
      name: "Mi Cuenta",
      href: "/configurar-cuenta",
      icon: UserCog,
      requireAdmin: false,
    },
    {
      name: "Regresar al Menú",
      href: MENU_BRIDGE_URL,
      icon: Home,
      requireAdmin: false,
      external: true,
    },
  ];



  // Determine if user is a representative
  const isRepresentative = user?.role === 'representante';

  // Use different navigation based on user role - prioritize representative check
  const currentNavItems = isRepresentative ? representativeNavItems : navigationItems;
  
  const filteredNavItems = currentNavItems.filter(item => 
    isRepresentative ? !item.requireAdmin : (!item.requireAdmin || isAdmin)
  );

  const toggleExpanded = (itemName: string) => {
    setExpandedItems(prev => 
      prev.includes(itemName) 
        ? prev.filter(name => name !== itemName)
        : [...prev, itemName]
    );
  };

  const SidebarContent = () => (
    <>
      {/* Header */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center space-x-3">
          <h1 className="text-xl font-medium text-gray-800">Directorio de Proveedores de Equipamiento Urbano</h1>
        </div>
      </div>

      {/* Navigation - with scroll */}
      <nav className="p-4 space-y-2 flex-1 overflow-y-auto">
        {filteredNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href;
          const hasSubItems = item.subItems && item.subItems.length > 0;
          const isExpanded = expandedItems.includes(item.name);
          const isSubItemActive = hasSubItems && item.subItems?.some((subItem: SubItem) => location === subItem.href);
          
          return (
            <div key={item.name}>
              {/* Main Item */}
              {hasSubItems ? (
                <div
                  className={`flex items-center space-x-3 px-3 py-2 rounded-sm transition-colors cursor-pointer ${
                    isActive || isSubItemActive
                      ? "bg-gray-100 text-gray-900 border-r-2 border-gray-800"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-800"
                  }`}
                  onClick={() => toggleExpanded(item.name)}
                >
                  <Icon className="w-5 h-5" />
                  <span className="flex-1">{item.name}</span>
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </div>
              ) : item.external ? (
                <a href={item.href}>
                  <div
                    className="flex items-center space-x-3 px-3 py-2 rounded-sm transition-colors cursor-pointer text-gray-600 hover:bg-gray-50 hover:text-gray-800"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.name}</span>
                  </div>
                </a>
              ) : (
                <Link href={item.href}>
                  <div
                    className={`flex items-center space-x-3 px-3 py-2 rounded-sm transition-colors cursor-pointer ${
                      isActive
                        ? "bg-gray-100 text-gray-900 border-r-2 border-gray-800"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-800"
                    }`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.name}</span>
                  </div>
                </Link>
              )}
              
              {/* Sub Items */}
              {hasSubItems && isExpanded && (
                <div className="ml-8 mt-1 space-y-1">
                  {item.subItems?.filter((subItem: SubItem) => !subItem.requireAdmin || isAdmin).map((subItem: SubItem) => {
                    const isSubActive = location === subItem.href;
                    
                    return (
                      <Link key={subItem.name} href={subItem.href}>
                        <div
                          className={`flex items-center space-x-3 px-3 py-2 rounded-sm transition-colors cursor-pointer ${
                            isSubActive
                              ? "bg-gray-100 text-gray-900 border-r-2 border-gray-800"
                              : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                          }`}
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          <span>{subItem.name}</span>
                          {subItem.href === "/admin/reviews" && pendingReviewsCount > 0 && (
                            <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-semibold">
                              {pendingReviewsCount}
                            </span>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Impersonation Status */}
      {isImpersonating && (
        <div className="p-3 mx-3 mb-3 bg-orange-50 border border-orange-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-orange-800">
                Modo Representante
              </p>
              <p className="text-xs text-orange-600 truncate">
                {impersonatedCompany?.nombreEmpresa || "Empresa"}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={stopImpersonation}
              className="p-1 text-orange-600 hover:text-orange-800"
              title="Salir del modo representante"
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        </div>
      )}

      {/* User Profile */}
      <div className="p-4 border-t border-gray-100">
        <div className="flex items-center space-x-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-700 truncate">
              {user?.displayName || "Usuario"}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {user?.email}
            </p>
          </div>
          {/* El logout se oculta en sesiones de WordPress: el único cierre de
              sesión válido es desde WordPress. */}
          {!isWordPressSession && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="p-1 text-gray-400 hover:text-gray-600"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </Button>
      </div>

      {/* Mobile sidebar */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setIsMobileMenuOpen(false)} />
          <aside className="fixed left-0 top-0 h-screen w-64 bg-white shadow-sm border-r border-gray-100 flex flex-col overflow-hidden">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className={`hidden lg:flex w-64 bg-white shadow-sm border-r border-gray-100 fixed h-screen flex-col overflow-hidden z-10 ${className}`}>
        <SidebarContent />
      </aside>
    </>
  );
}
