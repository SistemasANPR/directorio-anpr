import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TagSelector from "@/components/TagSelector";
import { Link, useLocation } from "wouter";
import { 
  MapPin, 
  Phone, 
  Mail, 
  Building2, 
  Search, 
  ExternalLink,
  Grid3X3,
  List,
  Layers,
  ArrowUpDown
} from "lucide-react";
import DirectoryMap from "@/components/DirectoryMap";
import type { CompanyWithDetails, Category } from "@/../../shared/schema";

// Función para limpiar HTML
const stripHtml = (html: string): string => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || "";
};

// Función para extraer el estado del address
const extractStateFromAddress = (address: string | null | undefined): string | null => {
  if (!address) return null;
  
  // Lista de estados de México
  const mexicanStates = [
    'Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche', 'Chiapas',
    'Chihuahua', 'Ciudad de México', 'Coahuila', 'Colima', 'Durango', 'Estado de México',
    'Guanajuato', 'Guerrero', 'Hidalgo', 'Jalisco', 'Michoacán', 'Morelos', 'Nayarit',
    'Nuevo León', 'Oaxaca', 'Puebla', 'Querétaro', 'Quintana Roo', 'San Luis Potosí',
    'Sinaloa', 'Sonora', 'Tabasco', 'Tamaulipas', 'Tlaxcala', 'Veracruz', 'Yucatán', 'Zacatecas'
  ];
  
  // Abreviaciones comunes
  const stateAbbreviations: { [key: string]: string } = {
    'Yuc.': 'Yucatán',
    'Yuc': 'Yucatán',
    'Q. Roo': 'Quintana Roo',
    'QRoo': 'Quintana Roo',
    'CDMX': 'Ciudad de México',
    'Pue.': 'Puebla',
    'Pue': 'Puebla'
  };
  
  // Buscar abreviaciones
  for (const [abbr, fullName] of Object.entries(stateAbbreviations)) {
    if (address.includes(abbr)) {
      return fullName;
    }
  }
  
  // Buscar nombres completos
  for (const state of mexicanStates) {
    if (address.includes(state)) {
      return state;
    }
  }
  
  return null;
};

// Función para renderizar iconos de categorías
const CategoryIcon = ({ category }: { category: Category }) => {
  if (category.iconoUrl) {
    return (
      <img 
        src={category.iconoUrl} 
        alt={category.nombreCategoria}
        className="w-4 h-4 object-contain"
      />
    );
  }

  // Fallback a iconos por defecto si no hay icono en la BD
  const iconProps = {
    className: "w-4 h-4 text-gray-600"
  };

  switch (category.nombreCategoria?.toLowerCase()) {
    case 'mobiliario urbano':
      return <Grid3X3 {...iconProps} />;
    case 'iluminación':
      return <Building2 {...iconProps} />;
    case 'señalización':
      return <MapPin {...iconProps} />;
    case 'jardinería':
      return <Building2 {...iconProps} />;
    case 'pavimentación':
      return <Grid3X3 {...iconProps} />;
    case 'seguridad':
      return <Building2 {...iconProps} />;
    default:
      return <Building2 {...iconProps} />;
  }
};

export default function Directory() {
  const [location, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedState, setSelectedState] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState<string>("default");

  // Parse URL parameters and set initial filter states
  useEffect(() => {
    // Extract search parameters from current URL
    const params = new URLSearchParams(window.location.search);
    const categoryId = params.get('categoria');
    
    if (categoryId) {
      setSelectedCategory(categoryId);
    } else {
      // Reset category if no URL parameter
      setSelectedCategory("all");
    }
  }, [location]);

  const { data: companiesData, isLoading: companiesLoading } = useQuery({
    queryKey: ["/api/companies", "limit=1000"],
    queryFn: async () => {
      const response = await fetch("/api/companies?limit=1000");
      if (!response.ok) throw new Error("Failed to fetch companies");
      return response.json();
    },
  });

  const { data: categories } = useQuery({
    queryKey: ["/api/categories"],
    queryFn: async () => {
      const response = await fetch("/api/categories");
      if (!response.ok) throw new Error("Failed to fetch categories");
      return response.json();
    },
  });

  const companies = companiesData?.companies || [];
  
  // Extraer estados únicos de las direcciones de las empresas
  const allStates = companies
    .map((company: CompanyWithDetails) => {
      const ubicacion = company.ubicacionGeografica as any;
      const address = ubicacion?.address || company.direccionFisica;
      return extractStateFromAddress(address);
    })
    .filter((state: any): state is string => state !== null);
  
  const states = Array.from(new Set(allStates)).sort();
  
  const filteredCompanies = companies
    .filter((company: CompanyWithDetails) => {
      const matchesSearch = company.nombreEmpresa.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (company.descripcionEmpresa && company.descripcionEmpresa.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesCategory = !selectedCategory || selectedCategory === "all" || 
                             (company.categories && Array.isArray(company.categories) && 
                              company.categories.some((cat: any) => cat.id === parseInt(selectedCategory)));
      
      const ubicacion = company.ubicacionGeografica as any;
      const address = ubicacion?.address || company.direccionFisica;
      const companyState = extractStateFromAddress(address);
      const matchesState = !selectedState || selectedState === "all" || companyState === selectedState;
      
      return matchesSearch && matchesCategory && matchesState;
    })
    .sort((a: any, b: any) => {
      // Aplicar ordenamiento según selección
      switch (sortBy) {
        case "name-asc":
          return a.nombreEmpresa.localeCompare(b.nombreEmpresa);
        case "name-desc":
          return b.nombreEmpresa.localeCompare(a.nombreEmpresa);
        case "default":
        default:
          // Priorizar empresas con membresía empresarial
          const aHasEmpresarial = a.membershipType?.nombrePlan?.toLowerCase().includes('empresarial');
          const bHasEmpresarial = b.membershipType?.nombrePlan?.toLowerCase().includes('empresarial');
          
          if (aHasEmpresarial && !bHasEmpresarial) return -1;
          if (!aHasEmpresarial && bHasEmpresarial) return 1;
          return 0;
      }
    });

  if (companiesLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 py-16">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Cargando directorio...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="relative overflow-hidden text-white">
        {/* Background Image */}
        <div className="absolute inset-0">
          <img
            src="/attached_assets/fondo_header_directorio.png"
            alt="Fondo directorio"
            className="w-full h-full object-cover"
          />
        </div>
        
        {/* Overlay */}
        <div className="absolute inset-0 bg-slate-900/50"></div>
        
        {/* Content */}
        <div className="relative max-w-7xl mx-auto px-4 py-16">
          <p className="text-xl text-blue-100 max-w-3xl leading-relaxed">
            Explora todas las empresas registradas en nuestra plataforma. 
            Encuentra proveedores, servicios y oportunidades de negocio.
          </p>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-4 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Buscar empresas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full sm:w-48 [&_svg]:hidden [&>span]:!text-[#374151] data-[placeholder]:!text-[#374151]">
                  <SelectValue placeholder="Categorías" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4" />
                      <span>Todas las categorías</span>
                    </div>
                  </SelectItem>
                  {categories?.map((category: Category) => (
                    <SelectItem key={category.id} value={category.id.toString()}>
                      <div className="flex items-center gap-2">
                        <CategoryIcon category={category} />
                        <span>{category.nombreCategoria}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedState} onValueChange={setSelectedState}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  {states.map((state: any) => (
                    <SelectItem key={state} value={state}>
                      {state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-44">
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Ordenar por" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Por defecto</SelectItem>
                  <SelectItem value="name-asc">Nombre (A-Z)</SelectItem>
                  <SelectItem value="name-desc">Nombre (Z-A)</SelectItem>
                </SelectContent>
              </Select>

              <Button 
                variant="default" 
                size="sm"
                className="hidden"
                onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
              >
                {viewMode === "grid" ? (
                  <>
                    <List className="h-4 w-4 mr-2" />
                    Lista
                  </>
                ) : (
                  <>
                    <Grid3X3 className="h-4 w-4 mr-2" />
                    Cuadricular
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              {filteredCompanies.length} empresa{filteredCompanies.length !== 1 ? 's' : ''} encontrada{filteredCompanies.length !== 1 ? 's' : ''}
            </p>
            {(searchTerm || (selectedCategory && selectedCategory !== "all") || (selectedState && selectedState !== "all")) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchTerm("");
                  setSelectedCategory("all");
                  setSelectedState("all");
                }}
              >
                Limpiar filtros
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCompanies.map((company: CompanyWithDetails) => (
              <Card key={company.id} className="hover:shadow-lg transition-shadow group flex flex-col h-full">
                <CardHeader className="pb-4">
                  <div className="w-full h-40 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden mb-3">
                    {company.logotipoUrl ? (
                      <img
                        src={company.logotipoUrl}
                        alt={`Logo de ${company.nombreEmpresa}`}
                        className="max-w-full max-h-full object-contain p-2"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                        <Building2 className="h-12 w-12 text-white" />
                      </div>
                    )}
                  </div>
                  <CardTitle className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors text-center">
                    {company.nombreEmpresa}
                  </CardTitle>
                </CardHeader>
                
                <CardContent className="pt-0 flex flex-col flex-1 pb-6">
                  {company.descripcionEmpresa && (
                    <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                      {stripHtml(company.descripcionEmpresa)}
                    </p>
                  )}
                  
                  <div className="space-y-2 mb-4">
                    {company.telefono1 && (
                      <div className="flex items-center text-sm text-gray-500">
                        <Phone className="h-4 w-4 mr-2 flex-shrink-0" />
                        <span>{company.telefono1}</span>
                      </div>
                    )}
                    {company.email1 && (
                      <div className="flex items-center text-sm text-gray-500">
                        <Mail className="h-4 w-4 mr-2 flex-shrink-0" />
                        <span className="truncate">{company.email1}</span>
                      </div>
                    )}
                  </div>

                  {/* Iconos de categorías */}
                  {Array.isArray(company.categories) && company.categories.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {company.categories.slice(0, 4).map((category: Category) => (
                        <div key={category.id} className="flex items-center justify-center w-8 h-8 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors" title={category.nombreCategoria}>
                          <CategoryIcon category={category} />
                        </div>
                      ))}
                      {company.categories.length > 4 && (
                        <div className="flex items-center justify-center w-8 h-8 bg-gray-100 rounded-full text-xs text-gray-600">
                          +{company.categories.length - 4}
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="flex justify-center mt-auto pt-4">
                    <Link href={`/empresa/${company.id}`}>
                      <Button className="w-full" size="sm">
                        Ver Detalles
                        <ExternalLink className="h-4 w-4 ml-2" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredCompanies.map((company: CompanyWithDetails) => (
              <Card key={company.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Logo */}
                    <div className="flex-shrink-0">
                      {company.logotipoUrl ? (
                        <img
                          src={company.logotipoUrl}
                          alt={`Logo de ${company.nombreEmpresa}`}
                          className="w-20 h-20 rounded-lg object-cover border-2 border-gray-100"
                        />
                      ) : (
                        <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                          <Building2 className="h-10 w-10 text-white" />
                        </div>
                      )}
                    </div>

                    {/* Información */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-gray-900 mb-2">
                        {company.nombreEmpresa}
                      </h3>
                      
                      {company.descripcionEmpresa && (
                        <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                          {stripHtml(company.descripcionEmpresa)}
                        </p>
                      )}
                      
                      <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                        {company.telefono1 && (
                          <div className="flex items-center">
                            <Phone className="h-4 w-4 mr-1.5 flex-shrink-0" />
                            <span>{company.telefono1}</span>
                          </div>
                        )}
                        {company.email1 && (
                          <div className="flex items-center">
                            <Mail className="h-4 w-4 mr-1.5 flex-shrink-0" />
                            <span className="truncate max-w-xs">{company.email1}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Categorías e iconos */}
                    <div className="hidden md:flex items-center gap-2 flex-shrink-0">
                      {Array.isArray(company.categories) && company.categories.length > 0 && (
                        <div className="flex gap-2">
                          {company.categories.slice(0, 5).map((category: Category) => (
                            <div key={category.id} className="flex items-center justify-center w-8 h-8 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors" title={category.nombreCategoria}>
                              <CategoryIcon category={category} />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Botón */}
                    <div className="flex-shrink-0">
                      <Link href={`/empresa/${company.id}`}>
                        <Button size="sm" className="whitespace-nowrap">
                          Ver Detalles
                          <ExternalLink className="h-4 w-4 ml-2" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {filteredCompanies.length === 0 && (
          <div className="text-center py-16">
            <Building2 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No se encontraron empresas
            </h3>
            <p className="text-gray-600 max-w-md mx-auto">
              Intenta ajustar los filtros de búsqueda o explora diferentes categorías.
            </p>
          </div>
        )}
      </div>

      {/* Map Section */}
      <div className="bg-white border-t">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4" style={{ color: '#0f2161' }}>
              Mapa de Empresas
            </h2>
            <p className="text-gray-600 mb-8">
              Visualiza la ubicación de todas las empresas registradas
            </p>
            <DirectoryMap companies={filteredCompanies} />
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gradient-to-r from-blue-900 to-blue-800">
        <div className="max-w-7xl mx-auto px-4 py-16">
          <div className="text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
              ¿Es Usted un Proveedor de Equipamiento<br />
              Urbano o Parques?
            </h2>
            <p className="text-blue-100 text-lg md:text-xl mb-8 max-w-3xl mx-auto leading-relaxed">
              Regístrese y conecte con miles de proyectos y clientes potenciales en todo América 
              Latina. Muestre sus soluciones a la audiencia correcta.
            </p>
            <Button 
              size="lg" 
              className="font-bold px-8 py-4 text-lg rounded-full transition-all duration-300 transform hover:scale-105 shadow-lg text-blue-900"
              style={{
                backgroundColor: 'rgb(188, 206, 22)',
                borderColor: 'rgb(188, 206, 22)'
              }}
              onClick={() => {
                setLocation('/planes');
                setTimeout(() => window.scrollTo(0, 0), 0);
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgb(170, 186, 20)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgb(188, 206, 22)';
              }}
            >
              Regístrate como empresa
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}