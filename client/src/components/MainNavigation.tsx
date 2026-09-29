import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { 
  Home, 
  Building2, 
  CreditCard, 
  User, 
  Menu, 
  X,
  ChevronDown,
  Settings,
  LogOut,
  HelpCircle
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function MainNavigation() {
  const [location] = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, signOut, isAdmin, isWordPressSession } = useAuth();

  const navigationItems = [
    { href: "/", label: "Inicio", icon: Home },
    { href: "/directorio", label: "Directorio", icon: Building2 },
    { href: "/planes", label: "Registrar Empresa", icon: CreditCard, isButton: true },
  ];

  const isActive = (href: string) => {
    if (href === "/" && location === "/") return true;
    if (href !== "/" && location.startsWith(href)) return true;
    return false;
  };

  return (
    <nav className="bg-white shadow-lg border-b sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/">
            <div className="flex items-center space-x-3 cursor-pointer">
              <img 
                src="https://anpr.org.mx/wp-content/uploads/2021/06/anpr.png" 
                alt="ANPR Logo" 
                className="h-12 w-auto object-contain"
              />
              <span className="text-xl font-bold text-gray-900">Directorio ANPR</span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isButton = (item as any).isButton;
              
              if (isButton) {
                return (
                  <Link key={item.href} href={item.href}>
                    <div 
                      className="flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-semibold transition-all cursor-pointer text-white hover:opacity-90"
                      style={{ backgroundColor: 'rgb(188, 206, 22)' }}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </div>
                  </Link>
                );
              }
              
              return (
                <Link key={item.href} href={item.href}>
                  <div className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                    isActive(item.href)
                      ? "text-blue-600 bg-blue-50"
                      : "text-gray-700 hover:text-blue-600 hover:bg-gray-50"
                  }`}>
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* User Menu / Login */}
          <div className="hidden md:flex items-center space-x-4">
            <a
              href="/manual-directorio-anpr.pdf"
              download="Manual_Directorio_ANPR.pdf"
              title="Descargar manual del directorio"
              aria-label="Descargar manual del directorio"
              className="flex items-center justify-center p-2 rounded-full text-gray-500 hover:text-blue-600 hover:bg-gray-100 transition-colors"
            >
              <HelpCircle className="h-5 w-5" />
            </a>
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center space-x-2 px-3 py-2">
                    <Avatar className="w-8 h-8">
                      <AvatarImage 
                        src={user.photoURL || undefined} 
                        alt={user.displayName || user.email || 'Usuario'}
                      />
                      <AvatarFallback className="bg-blue-100 text-blue-700 text-sm font-semibold">
                        {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium text-gray-700">
                      {user.displayName || user.email}
                    </span>
                    <ChevronDown className="h-4 w-4 text-gray-500" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <Link href={isAdmin ? "/dashboard" : "/representative-dashboard"}>
                    <DropdownMenuItem className="cursor-pointer">
                      <Settings className="h-4 w-4 mr-2" />
                      {isAdmin ? "Dashboard Administrador" : "Dashboard Representante"}
                    </DropdownMenuItem>
                  </Link>
                  {/* Logout oculto en sesiones de WordPress (único logout: WordPress). */}
                  {!isWordPressSession && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={signOut}
                        className="cursor-pointer text-red-600 focus:text-red-600"
                      >
                        <LogOut className="h-4 w-4 mr-2" />
                        Cerrar Sesión
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link href="/login">
                <Button size="sm">
                  <User className="h-4 w-4 mr-2" />
                  Acceder
                </Button>
              </Link>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center space-x-1">
            <a
              href="/manual-directorio-anpr.pdf"
              download="Manual_Directorio_ANPR.pdf"
              title="Descargar manual del directorio"
              aria-label="Descargar manual del directorio"
              className="flex items-center justify-center p-2 rounded-full text-gray-500 hover:text-blue-600 hover:bg-gray-100 transition-colors"
            >
              <HelpCircle className="h-5 w-5" />
            </a>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden border-t bg-white">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const isButton = (item as any).isButton;
                
                if (isButton) {
                  return (
                    <Link key={item.href} href={item.href}>
                      <div 
                        className="flex items-center space-x-2 px-3 py-2 rounded-md text-base font-semibold cursor-pointer text-white hover:opacity-90"
                        style={{ backgroundColor: 'rgb(188, 206, 22)' }}
                        onClick={() => setIsMenuOpen(false)}
                      >
                        <Icon className="h-5 w-5" />
                        <span>{item.label}</span>
                      </div>
                    </Link>
                  );
                }
                
                return (
                  <Link key={item.href} href={item.href}>
                    <div 
                      className={`flex items-center space-x-2 px-3 py-2 rounded-md text-base font-medium cursor-pointer ${
                        isActive(item.href)
                          ? "text-blue-600 bg-blue-50"
                          : "text-gray-700 hover:text-blue-600 hover:bg-gray-50"
                      }`}
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <Icon className="h-5 w-5" />
                      <span>{item.label}</span>
                    </div>
                  </Link>
                );
              })}
              
              {/* Mobile User Menu / Login */}
              <div className="border-t pt-3 mt-3 space-y-2">
                {user ? (
                  <>
                    {/* User Info */}
                    <div className="flex items-center space-x-3 px-3 py-2">
                      <Avatar className="w-10 h-10">
                        <AvatarImage 
                          src={user.photoURL || undefined} 
                          alt={user.displayName || user.email || 'Usuario'}
                        />
                        <AvatarFallback className="bg-blue-100 text-blue-700 text-sm font-semibold">
                          {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {user.displayName || user.email}
                        </p>
                        <p className="text-xs text-gray-500">{isAdmin ? "Administrador" : "Representante"}</p>
                      </div>
                    </div>
                    
                    {/* Dashboard Link */}
                    <Link href={isAdmin ? "/dashboard" : "/representative-dashboard"}>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        className="w-full justify-start" 
                        onClick={() => setIsMenuOpen(false)}
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        {isAdmin ? "Dashboard Administrador" : "Dashboard Representante"}
                      </Button>
                    </Link>
                    
                    {/* Logout oculto en sesiones de WordPress (único logout: WordPress). */}
                    {!isWordPressSession && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => {
                          signOut();
                          setIsMenuOpen(false);
                        }}
                      >
                        <LogOut className="h-4 w-4 mr-2" />
                        Cerrar Sesión
                      </Button>
                    )}
                  </>
                ) : (
                  <Link href="/login">
                    <Button size="sm" className="w-full justify-start" onClick={() => setIsMenuOpen(false)}>
                      <User className="h-4 w-4 mr-2" />
                      Acceder
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}