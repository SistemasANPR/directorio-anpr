import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { 
  Building, 
  BarChart3, 
  Award,
  Menu,
  X,
  LogOut,
  Crown,
  CreditCard,
  Briefcase,
  MessageSquare,
  UserCog,
  Home,
  ArrowLeft
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";

interface RepresentativeSidebarProps {
  className?: string;
}

interface NavItem {
  name: string;
  href: string;
  icon: any;
  requireAdmin: boolean;
  external?: boolean;
}

const representativeNavItems: NavItem[] = [
  {
    name: "Resumen",
    href: "/representative-dashboard?tab=overview",
    icon: BarChart3,
    requireAdmin: false, // Disponible para todos los representantes
  },
  {
    name: "Mi Empresa",
    href: "/representative-dashboard?tab=company",
    icon: Building,
    requireAdmin: false,
  },
  {
    name: "Proyectos",
    href: "/representative-dashboard?tab=projects",
    icon: Briefcase,
    requireAdmin: false,
  },
  {
    name: "Certificados",
    href: "/representative-dashboard?tab=certificates",
    icon: Award,
    requireAdmin: false,
  },
  {
    name: "Mi Reseña",
    href: "/representative-dashboard?tab=review",
    icon: MessageSquare,
    requireAdmin: false,
  },
  {
    name: "Mi Plan",
    href: "/representative-dashboard?tab=membership",
    icon: Crown,
    requireAdmin: false,
  },
  {
    name: "Pagos",
    href: "/representative-dashboard?tab=payments",
    icon: CreditCard,
    requireAdmin: false,
  },
  {
    name: "Mi Cuenta",
    href: "/configurar-cuenta",
    icon: UserCog,
    requireAdmin: false,
    external: true,
  },
  {
    name: "Regresar al Menú",
    href: "/",
    icon: Home,
    requireAdmin: false,
    external: true,
  },
];

export default function RepresentativeSidebar({ className }: RepresentativeSidebarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [location, setLocation] = useLocation();
  const [currentTab, setCurrentTab] = useState('overview');
  const { user, originalUser, signOut, isWordPressSession, isImpersonating, impersonatedCompany, stopImpersonation } = useAuth();

  const handleExitImpersonation = () => {
    stopImpersonation();
    setLocation("/dashboard");
  };
  
  // Verificar si el usuario es administrador
  const isAdmin = user?.role === 'admin' || user?.role === 'administrator';

  // Update current tab when URL changes
  useEffect(() => {
    const updateCurrentTab = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const tabParam = urlParams.get('tab') || 'overview';
      setCurrentTab(tabParam);
    };

    updateCurrentTab();
    
    const handlePopState = () => {
      updateCurrentTab();
    };
    
    const handleTabNavigation = (event: CustomEvent) => {
      const tabName = event.detail?.tab;
      if (tabName) {
        setCurrentTab(tabName);
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('navigateTab', handleTabNavigation as EventListener);
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('navigateTab', handleTabNavigation as EventListener);
    };
  }, []);
  
  // Filtrar items de navegación basándose en el rol
  const filteredNavItems = representativeNavItems.filter(item => {
    // "Mi Cuenta" no se muestra para representantes miembros empresariales que
    // vienen de WordPress (sesión SSO): su cuenta se gestiona únicamente en
    // WordPress y no pueden editarla desde el directorio.
    if (item.href === '/configurar-cuenta' && isWordPressSession) {
      return false;
    }
    // Los pagos de la membresía empresarial proveniente de WordPress se
    // administran fuera de este dashboard.
    if (item.href === '/representative-dashboard?tab=payments' && isWordPressSession) {
      return false;
    }
    if (item.requireAdmin) {
      return isAdmin;
    }
    return true;
  });

  const handleSignOut = () => {
    signOut();
    window.location.href = '/login';
  };

  const isTabActive = (href: string) => {
    if (href.includes('?tab=')) {
      const tabFromHref = href.split('?tab=')[1];
      return currentTab === tabFromHref;
    }
    return location === href;
  };

  const SidebarContent = () => (
    <>
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-[#bcce16] rounded-lg flex items-center justify-center">
            <span className="text-black font-bold text-sm">A</span>
          </div>
          <h1 className="text-xl font-bold text-gray-800" style={{ fontFamily: 'Montserrat', fontWeight: 700 }}>
            Directorio de Proveedores de Equipamiento Urbano
          </h1>
        </div>
      </div>

      {/* Impersonation banner */}
      {isImpersonating && (
        <div className="mx-4 mt-4 p-3 rounded-md border border-amber-300 bg-amber-50">
          <p className="text-xs font-semibold text-amber-800">Modo Representante</p>
          <p className="text-sm text-amber-900 truncate" title={impersonatedCompany?.nombreEmpresa}>
            {impersonatedCompany?.nombreEmpresa || "Empresa"}
          </p>
          <p className="text-xs text-amber-700 mt-1 truncate">
            Admin: {originalUser?.displayName || originalUser?.email}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExitImpersonation}
            className="mt-2 w-full h-8 text-xs border-amber-400 text-amber-900 hover:bg-amber-100"
            data-testid="button-exit-impersonation"
          >
            <ArrowLeft className="w-3 h-3 mr-1" />
            Volver al panel admin
          </Button>
        </div>
      )}

      {/* Navigation */}
      <nav className="p-4 space-y-2 flex-1">
        {filteredNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = isTabActive(item.href);
          
          return (
            <div key={item.name}>
              <div
                className={`flex items-center space-x-3 px-3 py-2 rounded-sm transition-colors cursor-pointer ${
                  isActive
                    ? "bg-[#bcce16]/10 text-gray-900 border-r-2 border-[#bcce16]"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-800"
                }`}
                onClick={() => {
                  if (item.external || item.href === '/' || item.href === '/configurar-cuenta') {
                    // Handle external navigation for external links
                    window.location.href = item.href;
                  } else if (item.href.includes('/testimonials')) {
                    // Handle external navigation for testimonials
                    window.location.href = item.href;
                  } else {
                    // Handle dashboard tab navigation
                    const tabName = item.href.split('?tab=')[1];
                    setCurrentTab(tabName);
                    window.history.pushState({}, '', item.href);
                    
                    // Force re-render by dispatching a custom event
                    window.dispatchEvent(new CustomEvent('navigateTab', { detail: { tab: tabName } }));
                  }
                  setIsMobileMenuOpen(false);
                }}
              >
                <Icon className="w-5 h-5" />
                <span>{item.name}</span>
              </div>
            </div>
          );
        })}
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={user?.photoURL || ""} />
              <AvatarFallback>
                {user?.displayName?.[0] || user?.email?.[0] || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-700 truncate">
                {user?.displayName || "Representante"}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {user?.email}
              </p>
            </div>
          </div>
          {/* En sesiones de WordPress se oculta el logout: el único cierre de
              sesión válido es desde WordPress. */}
          {!isWordPressSession && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="p-1 text-gray-400 hover:text-gray-600 flex-shrink-0"
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
              data-testid="button-logout"
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
          <aside className="fixed left-0 top-0 h-full w-80 bg-white shadow-sm border-r border-gray-100 flex flex-col">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className={`hidden lg:flex w-80 bg-white shadow-sm border-r border-gray-100 fixed h-full overflow-y-auto flex-col z-10 ${className}`}>
        <SidebarContent />
      </aside>
    </>
  );
}