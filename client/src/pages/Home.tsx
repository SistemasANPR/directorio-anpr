import { useQuery } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import * as LucideIcons from "lucide-react";
import { estadosMexico } from "@/lib/locationData";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Función para limpiar HTML tags
function stripHtml(html: string): string {
  const tmp = document.createElement("DIV");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
}

function CategoryIcon({ category, className = "w-5 h-5" }: { category: any; className?: string }) {
  // Si hay una URL de icono personalizado, usarla
  if (category.iconoUrl) {
    return <img src={category.iconoUrl} alt={category.nombreCategoria} className={className} />;
  }
  
  // Si hay un nombre de icono de Lucide, usarlo
  if (category.icono) {
    const IconComponent = (LucideIcons as any)[category.icono];
    if (IconComponent) {
      return <IconComponent className={className} />;
    }
  }
  
  // Fallback a icono genérico
  const Building = LucideIcons.Building;
  return <Building className={className} />;
}

function TestimonialsSection() {
  const { data: reviews, isLoading } = useQuery({
    queryKey: ["/api/opinions", { tipo: "plataforma", estado: "aprobada" }],
    queryFn: () => fetch("/api/opinions?tipo=plataforma&estado=aprobada").then(res => res.json()),
  });

  const renderStars = (rating: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <span key={i} style={{ 
          color: i <= rating ? "#bcce16" : "#d1d5db", 
          fontSize: "1.2rem" 
        }}>
          ★
        </span>
      );
    }
    return stars;
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
  };

  if (isLoading) {
    return (
      <div style={{ padding: "4rem 2rem", backgroundColor: "white" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", textAlign: "center" }}>
          <div style={{ fontSize: "1.2rem", color: "#6b7280" }}>
            Cargando reseñas...
          </div>
        </div>
      </div>
    );
  }

  const approvedReviews = reviews?.opinions || [];
  const displayReviews = approvedReviews.slice(0, 6); // Mostrar máximo 6 reseñas

  if (displayReviews.length === 0) {
    return (
      <div style={{ padding: "4rem 2rem", backgroundColor: "white" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <h2 style={{
            fontSize: "2rem",
            fontWeight: "bold",
            marginBottom: "1rem",
            textAlign: "center",
            color: "#0f2161",
            fontFamily: "'Montserrat', sans-serif"
          }}>
            Escuche a Nuestra Comunidad: Proyectos Reales, Experiencias Auténticas
          </h2>
          
          <p style={{
            fontSize: "1.1rem",
            textAlign: "center",
            color: "#6b7280",
            marginBottom: "3rem",
            maxWidth: "900px",
            margin: "0 auto 3rem auto"
          }}>
            Lea reseñas auténticas de productos y proveedores, comparta sus opiniones y conéctese con sus pares.
          </p>

          <div style={{
            textAlign: "center",
            backgroundColor: "#f8fafc",
            borderRadius: "12px",
            padding: "3rem",
            border: "1px solid #e5e7eb"
          }}>
            <p style={{ 
              fontSize: "1.1rem", 
              color: "#6b7280",
              marginBottom: "1rem" 
            }}>
              Próximamente aparecerán aquí las reseñas de nuestra comunidad
            </p>
            <p style={{ 
              fontSize: "0.9rem", 
              color: "#9ca3af" 
            }}>
              Sea el primero en compartir su experiencia con la plataforma
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "4rem 2rem", backgroundColor: "white" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <h2 style={{
          fontSize: "2rem",
          fontWeight: "bold",
          marginBottom: "1rem",
          textAlign: "center",
          color: "#0f2161",
          fontFamily: "'Montserrat', sans-serif"
        }}>
          Historias reales, resultados comprobados.
        </h2>
        
        <p style={{
          fontSize: "1.1rem",
          textAlign: "center",
          color: "#6b7280",
          marginBottom: "3rem",
          maxWidth: "900px",
          margin: "0 auto 3rem auto"
        }}>
          Lee opiniones de profesionales como tú, comparte tu experiencia y contribuye a construir una comunidad que eleva los estándares del sector.
        </p>

        {/* Grid de reseñas */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))",
          gap: "2rem",
          marginBottom: "3rem"
        }}>
          {displayReviews.map((review: any, index: number) => (
            <div key={review.id || index} style={{
              backgroundColor: "#f8fafc",
              borderRadius: "12px",
              padding: "2rem",
              boxShadow: "0 4px 6px rgba(0,0,0,0.05)",
              border: "1px solid #e5e7eb"
            }}>
              <div style={{
                display: "flex",
                marginBottom: "1rem"
              }}>
                {renderStars(review.calificacion || 5)}
              </div>
              
              <p style={{
                fontSize: "1rem",
                lineHeight: "1.6",
                color: "#374151",
                marginBottom: "1.5rem",
                fontStyle: "italic"
              }}>
                "{review.comentario}"
              </p>
              
              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <div style={{
                  width: "50px",
                  height: "50px",
                  borderRadius: "50%",
                  backgroundColor: "#0f2161",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  fontSize: "1.2rem",
                  fontWeight: "bold"
                }}>
                  {getInitials(review.nombre || "Usuario")}
                </div>
                <div>
                  <div style={{
                    fontWeight: "600",
                    color: "#0f2161",
                    fontSize: "0.9rem"
                  }}>
                    {review.nombre}
                  </div>
                  <div style={{
                    color: "#6b7280",
                    fontSize: "0.8rem"
                  }}>
                    {review.cargo || "Miembro de la comunidad"}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Enlace a ver más reseñas */}
        {approvedReviews.length > 6 && (
          <div style={{ textAlign: "center" }}>
            <Link href="/testimonials">
              <button style={{
                backgroundColor: "#bcce16",
                color: "#0f2161",
                border: "none",
                padding: "12px 24px",
                borderRadius: "8px",
                fontSize: "1rem",
                fontWeight: "600",
                cursor: "pointer",
                transition: "background-color 0.2s ease"
              }}
              onMouseEnter={(e) => (e.target as HTMLButtonElement).style.backgroundColor = "#a8b814"}
              onMouseLeave={(e) => (e.target as HTMLButtonElement).style.backgroundColor = "#bcce16"}
              >
                Ver Más Reseñas
              </button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function CompanyCard({ company }: { company: any }) {
  return (
    <Link href={`/empresa/${company.id}`}>
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "12px",
          boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
          overflow: "hidden",
          transition: "transform 0.2s ease, box-shadow 0.2s ease",
          cursor: "pointer",
          aspectRatio: "1",
          display: "flex",
          flexDirection: "column",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-4px)";
          e.currentTarget.style.boxShadow = "0 8px 25px rgba(0,0,0,0.15)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = "0 4px 6px rgba(0,0,0,0.1)";
        }}
      >
        <div
          style={{
            height: "100%",
            background: company.galeriaProductosUrls && company.galeriaProductosUrls.length > 0
              ? `url(${company.galeriaProductosUrls[0]}) center/cover`
              : company.imagenPortada
              ? `url(${company.imagenPortada}) center/cover`
              : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            position: "relative",
          }}
        >
          {/* Logo sobrepuesto */}
          {company.logotipoUrl && (
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                width: "140px",
                height: "140px",
                backgroundColor: "rgba(255, 255, 255, 0.7)",
                backdropFilter: "blur(10px)",
                borderRadius: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 15px rgba(0, 0, 0, 0.1)",
              }}
            >
              <div
                style={{
                  width: "120px",
                  height: "120px",
                  backgroundImage: `url(${company.logotipoUrl})`,
                  backgroundPosition: "center",
                  backgroundSize: "contain",
                  backgroundRepeat: "no-repeat",
                }}
              />
            </div>
          )}
          {!company.galeriaProductosUrls?.length && !company.imagenPortada && !company.logotipoUrl && (
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                width: "60px",
                height: "60px",
                backgroundColor: "rgba(255,255,255,0.2)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.5rem",
                fontWeight: "bold",
                color: "white",
              }}
            >
              {company.nombreEmpresa?.charAt(0) || "?"}
            </div>
          )}

          {company.membershipType && (
            <div
              style={{
                position: "absolute",
                top: "0.75rem",
                right: "0.75rem",
                backgroundColor: company.membershipType.nombreTipo === "Premium" 
                  ? "#eab308" : company.membershipType.nombreTipo === "Pro" 
                  ? "#3b82f6" : "#6b7280",
                color: "white",
                padding: "0.25rem 0.5rem",
                borderRadius: "12px",
                fontSize: "0.7rem",
                fontWeight: "600",
              }}
            >
              DESTACADO
            </div>
          )}
        </div>


      </div>
    </Link>
  );
}

export default function Home() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedLocation, setSelectedLocation] = useState("all");
  const sliderRef = useRef<HTMLDivElement>(null);
  const categorySliderRef = useRef<HTMLDivElement>(null);

  const {
    data: companiesResponse,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["/api/companies", { limit: 1000 }],
    queryFn: () => fetch("/api/companies?limit=1000").then(res => res.json()),
  });

  const {
    data: categoriesResponse,
    isLoading: categoriesLoading,
  } = useQuery({
    queryKey: ["/api/categories"],
  });

  // Separate query for "Empresas líderes" slider - all companies, random selection
  const {
    data: allCompaniesResponse,
    isLoading: allCompaniesLoading,
  } = useQuery({
    queryKey: ["/api/companies", { allCompanies: true }],
    queryFn: () => fetch("/api/companies?limit=100").then(res => res.json()),
  });

  const companies = (companiesResponse as any)?.companies || [];
  const categories = (categoriesResponse as any) || [];
  const allCompanies = (allCompaniesResponse as any)?.companies || [];
  
  // Random selection of up to 15 companies for "Empresas líderes" slider
  const shuffleArray = (array: any[]) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };
  
  const leaderCompanies = shuffleArray(allCompanies).slice(0, 15);

  // Auto-scroll para el carrusel de empresas líderes
  useEffect(() => {
    const slider = categorySliderRef.current;
    if (!slider || leaderCompanies.length <= 1) return;

    const scrollInterval = setInterval(() => {
      if (slider.scrollLeft + slider.clientWidth >= slider.scrollWidth) {
        slider.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        slider.scrollBy({ left: 350, behavior: 'smooth' });
      }
    }, 4000); // Cambia cada 4 segundos

    return () => clearInterval(scrollInterval);
  }, [leaderCompanies]);

  const searchResults = companies
    .filter((company: any) => {
      const matchesSearch = searchTerm.trim() === "" || 
        company.nombreEmpresa?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        company.descripcionEmpresa?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        company.categories?.some((cat: any) => cat.nombreCategoria?.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesCategory = selectedCategory === "" || selectedCategory === "all" || 
        company.categories?.some((cat: any) => cat.id?.toString() === selectedCategory);
      
      const matchesLocation = selectedLocation === "" || selectedLocation === "all" || 
        (company.estadosPresencia && company.estadosPresencia.includes(selectedLocation));
      
      // Si NO hay búsqueda activa (sin filtros), mostrar solo empresas con membresía Empresarial
      const hasActiveSearch = searchTerm.trim() !== "" || 
                             (selectedCategory !== "" && selectedCategory !== "all") || 
                             (selectedLocation !== "" && selectedLocation !== "all");
      
      const matchesMembership = hasActiveSearch || 
        company.membershipType?.nombrePlan?.toLowerCase().includes('empresarial');
      
      return matchesSearch && matchesCategory && matchesLocation && matchesMembership;
    })
    .sort((a: any, b: any) => {
      // Priorizar empresas con membresía empresarial
      const aHasEmpresarial = a.membershipType?.nombrePlan?.toLowerCase().includes('empresarial');
      const bHasEmpresarial = b.membershipType?.nombrePlan?.toLowerCase().includes('empresarial');
      
      if (aHasEmpresarial && !bHasEmpresarial) return -1;
      if (!aHasEmpresarial && bHasEmpresarial) return 1;
      return 0;
    });

  const scrollLeft = () => {
    if (sliderRef.current) {
      sliderRef.current.scrollBy({ left: -350, behavior: "smooth" });
    }
  };

  const scrollRight = () => {
    if (sliderRef.current) {
      sliderRef.current.scrollBy({ left: 350, behavior: "smooth" });
    }
  };

  const scrollCategoryLeft = () => {
    if (categorySliderRef.current) {
      categorySliderRef.current.scrollBy({ left: -620, behavior: "smooth" });
    }
  };

  const scrollCategoryRight = () => {
    if (categorySliderRef.current) {
      categorySliderRef.current.scrollBy({ left: 620, behavior: "smooth" });
    }
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f8fafc" }}>
      {/* Header */}
      <div className="relative text-center text-white" style={{ padding: "5rem 1rem 3rem 1rem" }}>
        {/* Background Image */}
        <div className="absolute inset-0">
          <img
            src="/attached_assets/fondo_header_directorio.png"
            alt="Fondo header"
            className="w-full h-full object-cover"
            style={{ objectPosition: "center" }}
          />
        </div>
        
        {/* Overlay */}
        <div className="absolute inset-0 bg-slate-900/50"></div>

        <div style={{ position: "relative", zIndex: 2, maxWidth: "900px", marginLeft: "2rem", paddingRight: "2rem" }}>
          <h1
            className="text-2xl md:text-4xl lg:text-5xl xl:text-6xl font-bold mb-4"
            style={{
              textShadow: "2px 2px 4px rgba(0,0,0,0.3)",
              textAlign: "left",
              color: "#ffffff",
            }}
          >
            El Directorio de Equipamiento
          </h1>
          <p
            className="text-sm md:text-lg lg:text-xl mb-8 opacity-95"
            style={{
              textShadow: "1px 1px 2px rgba(0,0,0,0.3)",
              textAlign: "left",
              color: "#ffffff",
            }}
          >
            Explora todas las empresas registradas en nuestra plataforma. Encuentra proveedores, servicios y oportunidades de negocio.
          </p>

          <div>
            <div className="flex flex-col md:flex-row gap-4 mb-4">
              {/* Campo de búsqueda - SIN LUPA */}
              <div className="flex-1 md:flex-2 relative">
                <input
                  type="text"
                  placeholder="Buscar Empresas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 text-sm md:text-lg rounded-lg border-none outline-none text-gray-700"
                  style={{
                    height: "52px",
                    boxShadow: "0 8px 25px rgba(0,0,0,0.15)",
                    backgroundColor: "rgba(255,255,255,0.95)",
                    backdropFilter: "blur(10px)",
                    borderRadius: "8px",
                  }}
                />
              </div>
              
              {/* Filtro de categoría */}
              <div className="flex-1" style={{ color: "#374151 !important" }}>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger 
                    className="w-full px-4 text-sm md:text-lg rounded-lg cursor-pointer border-none focus:ring-0 focus:ring-offset-0 [&>span]:!text-[#374151] [&>span]:font-normal [&_svg]:!text-[#374151] data-[placeholder]:!text-[#374151] !text-[#374151]"
                    style={{
                      height: "52px",
                      boxShadow: "0 8px 25px rgba(0,0,0,0.15)",
                      backgroundColor: "rgba(255,255,255,0.95)",
                      backdropFilter: "blur(10px)",
                      borderRadius: "8px",
                      border: "none",
                      color: "#374151 !important",
                    }}
                  >
                    <SelectValue placeholder="Todas las categorías" style={{ color: "#374151 !important" }} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <div className="flex items-center gap-2">
                        <LucideIcons.Layers className="w-4 h-4" />
                        <span>Todas las categorías</span>
                      </div>
                    </SelectItem>
                    {categories.map((category: any) => (
                      <SelectItem key={category.id} value={category.id.toString()}>
                        <div className="flex items-center gap-2">
                          <CategoryIcon category={category} className="w-4 h-4" />
                          <span>{category.nombreCategoria}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Filtro de ubicación */}
              <div className="flex-1">
                <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                  <SelectTrigger 
                    className="w-full px-4 text-sm md:text-lg rounded-lg cursor-pointer border-none focus:ring-0 focus:ring-offset-0 [&>span]:!text-[#374151] [&>span]:font-normal [&_svg]:!text-[#374151] data-[placeholder]:!text-[#374151] !text-[#374151]"
                    style={{
                      height: "52px",
                      boxShadow: "0 8px 25px rgba(0,0,0,0.15)",
                      backgroundColor: "rgba(255,255,255,0.95)",
                      backdropFilter: "blur(10px)",
                      borderRadius: "8px",
                      border: "none",
                      color: "#374151 !important",
                    }}
                  >
                    <SelectValue placeholder="Todas las ubicaciones" style={{ color: "#374151 !important" }} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las ubicaciones</SelectItem>
                    {estadosMexico.map((state) => (
                      <SelectItem key={state} value={state}>
                        {state}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="py-8 md:py-16 px-4 max-w-6xl mx-auto">
        {isLoading && (
          <div className="text-center py-12">
            <div className="w-12 h-12 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600 text-lg">
              Cargando empresas...
            </p>
          </div>
        )}

        {error && (
          <div className="text-center py-12">
            <p className="text-red-600 text-lg">
              Error al cargar las empresas: {String(error)}
            </p>
          </div>
        )}

        {!isLoading && !error && (
          <>
            <h2 className="text-xl md:text-2xl lg:text-3xl font-bold text-center text-[#0f2161] font-['Montserrat'] leading-tight mb-4">
              Empresas destacadas
            </h2>
            
            <p className="text-sm md:text-lg text-center text-gray-500 mb-6 max-w-4xl mx-auto px-4">
              {searchTerm
                ? `Resultados de búsqueda (${searchResults.length})`
                : `Descubre a las empresas que están marcando tendencia en la creación y mejora de parques y espacios públicos.`}
            </p>

            <div className="text-right mb-8">
              <Link href="/directorio">
                <button
                  data-testid="button-ver-todas-empresas"
                  className="bg-[#bcce16] hover:bg-[#a8b914] text-[#0f2161] font-bold py-1 px-4 rounded-full transition-colors duration-200 font-['Montserrat'] text-xs md:text-sm"
                >
                  Ver todas
                </button>
              </Link>
            </div>

            {searchResults.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600 text-lg md:text-xl">
                  {searchTerm
                    ? "No se encontraron empresas que coincidan con tu búsqueda."
                    : "No hay empresas registradas."}
                </p>
              </div>
            ) : (
              <div className="relative">
                {companies.length > 3 && (
                  <button
                    onClick={scrollLeft}
                    className="hidden md:flex absolute left-0 top-1/2 transform -translate-y-1/2 z-10 bg-white border-2 border-gray-200 rounded-full w-12 h-12 items-center justify-center cursor-pointer shadow-lg text-xl text-blue-500 hover:bg-gray-50"
                  >
                    ‹
                  </button>
                )}

                <div
                  ref={sliderRef}
                  className="flex gap-4 md:gap-6 overflow-x-auto scroll-smooth pb-4 scrollbar-hide px-0 md:px-5"
                  style={{
                    scrollbarWidth: "none",
                    msOverflowStyle: "none",
                  }}
                >
                  {searchResults.slice(0, 5).map((company: any) => (
                    <div
                      key={company.id}
                      className="min-w-[280px] md:min-w-[320px] lg:min-w-[280px] max-w-[280px] md:max-w-[320px] lg:max-w-[280px] flex-shrink-0"
                    >
                      <CompanyCard company={company} />
                    </div>
                  ))}
                </div>

                {companies.length > 3 && (
                  <button
                    onClick={scrollRight}
                    className="hidden md:flex absolute right-0 top-1/2 transform -translate-y-1/2 z-10 bg-white border-2 border-gray-200 rounded-full w-12 h-12 items-center justify-center cursor-pointer shadow-lg text-xl text-blue-500 hover:bg-gray-50"
                  >
                    ›
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
      {/* Nueva sección: Empresas líderes por categoría */}
      <div className="py-8 md:py-16 px-4 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-4 text-center text-[#0f2161] font-['Montserrat']">Productos confiables para sus proyectos</h2>
          
          <p className="text-sm md:text-lg text-center text-gray-500 mb-8 md:mb-12 max-w-4xl mx-auto px-4">
            Haz clic y descubre más sobre las empresas líderes y cómo colaborar con ellas.
          </p>

          {/* Slider de empresas por categoría */}
          <div className="relative">
            {/* Botones de navegación */}
            <button
              onClick={scrollCategoryLeft}
              className="hidden md:flex absolute left-0 top-1/2 transform -translate-y-1/2 bg-white border-2 border-gray-200 rounded-full w-10 h-10 items-center justify-center cursor-pointer shadow-lg z-10 text-[#0f2161] hover:bg-gray-50"
            >
              ‹
            </button>

            <button
              onClick={scrollCategoryRight}
              className="hidden md:flex absolute right-0 top-1/2 transform -translate-y-1/2 bg-white border-2 border-gray-200 rounded-full w-10 h-10 items-center justify-center cursor-pointer shadow-lg z-10 text-[#0f2161] hover:bg-gray-50"
            >
              ›
            </button>

            <div 
              ref={categorySliderRef}
              className="flex gap-4 md:gap-8 overflow-x-auto scroll-smooth pb-4 px-0 md:px-5"
              style={{
                scrollbarWidth: "none",
                msOverflowStyle: "none",
                WebkitOverflowScrolling: "touch"
              }}>
              {leaderCompanies.map((categoryCompany: any, index: number) => {
                if (!categoryCompany) return null;
                
                return (
                  <div key={categoryCompany.id} className="min-w-[280px] md:min-w-[320px] lg:min-w-[350px] max-w-[280px] md:max-w-[320px] lg:max-w-[350px] flex-shrink-0">
                    <div className="relative rounded-xl shadow-lg overflow-hidden h-[280px] md:h-[320px] lg:h-[350px]">
                      {/* Imagen de fondo */}
                      <div style={{
                        width: "100%",
                        height: "100%",
                        background: categoryCompany.galeriaProductosUrls && categoryCompany.galeriaProductosUrls.length > 0
                          ? `url(${categoryCompany.galeriaProductosUrls[0]}) center/cover`
                          : categoryCompany.fotoPortadaUrl
                          ? `url(${categoryCompany.fotoPortadaUrl}) center/cover`
                          : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                        position: "relative"
                      }}>
                        
                        {/* Overlay oscuro para mejorar visibilidad del botón */}
                        <div style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          background: "linear-gradient(to bottom, rgba(0,0,0,0.2), rgba(0,0,0,0.4))"
                        }}></div>
                        
                        {/* Logo en la esquina inferior izquierda */}
                        {categoryCompany.logotipoUrl && (
                          <div
                            style={{
                              position: "absolute",
                              bottom: "1rem",
                              left: "1rem",
                              width: "50px",
                              height: "35px",
                              backgroundColor: "rgba(255, 255, 255, 0.7)",
                              backdropFilter: "blur(10px)",
                              borderRadius: "8px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              boxShadow: "0 4px 15px rgba(0, 0, 0, 0.1)",
                              zIndex: 10
                            }}
                          >
                            <div
                              style={{
                                width: "45px",
                                height: "30px",
                                backgroundImage: `url(${categoryCompany.logotipoUrl})`,
                                backgroundPosition: "center",
                                backgroundSize: "contain",
                                backgroundRepeat: "no-repeat",
                              }}
                            />
                          </div>
                        )}
                        
                        {/* Botón Ver más en la esquina inferior derecha */}
                        <div style={{
                          position: "absolute",
                          bottom: "1rem",
                          right: "1rem",
                          zIndex: 10
                        }}>
                          <Link href={`/empresa/${categoryCompany.id}`}>
                            <button style={{
                              backgroundColor: "#bcce16",
                              color: "#0f2161",
                              border: "none",
                              borderRadius: "50px",
                              padding: "0.5rem 1.5rem",
                              fontSize: "0.85rem",
                              fontFamily: "'Montserrat', sans-serif",
                              fontWeight: "700",
                              cursor: "pointer",
                              transition: "all 0.3s ease",
                              boxShadow: "0 4px 12px rgba(0,0,0,0.3)"
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = "#a8b914";
                              e.currentTarget.style.transform = "scale(1.05)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = "#bcce16";
                              e.currentTarget.style.transform = "scale(1)";
                            }}>
                              Ver más
                            </button>
                          </Link>
                        </div>
                        
                        {!categoryCompany.galeriaProductosUrls?.length && !categoryCompany.fotoPortadaUrl && (
                          <div style={{
                            position: "absolute",
                            top: "50%",
                            left: "50%",
                            transform: "translate(-50%, -50%)",
                            width: "100px",
                            height: "100px",
                            backgroundColor: "rgba(255,255,255,0.2)",
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "2.5rem",
                            fontWeight: "bold",
                            color: "white",
                            zIndex: 1
                          }}>
                            {categoryCompany.nombreEmpresa?.charAt(0) || "?"}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      {/* Sección de reseñas */}
      {/* <TestimonialsSection /> */}
      {/* Sección de beneficios */}
      <div style={{ 
        padding: "4rem 2rem", 
        backgroundColor: "#0f2161",
        color: "white" 
      }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          <h2 style={{
            fontSize: "2rem",
            fontWeight: "bold",
            marginBottom: "3rem",
            fontFamily: "'Montserrat', sans-serif",
            color: "white",
            textAlign: "center"
          }}>
            ¿Por qué unirte al Directorio de Proveedores de Equipamiento Urbano?
          </h2>
          
          {/* Grid de beneficios */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "2.5rem",
            marginBottom: "3rem"
          }}>
            {/* Beneficio 1 */}
            <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
              <div style={{ flexShrink: 0 }}>
                <img 
                  src="https://anpr.org.mx/wp-content/uploads/2025/11/lapiz.jpg"
                  alt="Tu marca donde importa"
                  style={{ width: "60px", height: "60px" }}
                />
              </div>
              <div>
                <h3 style={{
                  fontSize: "1.1rem",
                  fontWeight: "700",
                  marginBottom: "0.5rem",
                  color: "white",
                  fontFamily: "'Montserrat', sans-serif"
                }}>
                  Tu marca donde importa:
                </h3>
                <p style={{
                  fontSize: "0.95rem",
                  lineHeight: "1.5",
                  color: "#e5e7eb"
                }}>
                  Llega a quienes toman decisiones reales.
                </p>
              </div>
            </div>

            {/* Beneficio 2 */}
            <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
              <div style={{ flexShrink: 0 }}>
                <img 
                  src="https://anpr.org.mx/wp-content/uploads/2025/11/Corazon.jpg"
                  alt="Presencia que convierte"
                  style={{ width: "60px", height: "60px" }}
                />
              </div>
              <div>
                <h3 style={{
                  fontSize: "1.1rem",
                  fontWeight: "700",
                  marginBottom: "0.5rem",
                  color: "white",
                  fontFamily: "'Montserrat', sans-serif"
                }}>
                  Presencia que convierte:
                </h3>
                <p style={{
                  fontSize: "0.95rem",
                  lineHeight: "1.5",
                  color: "#e5e7eb"
                }}>
                  Transforma tu visibilidad digital en oportunidades de negocio.
                </p>
              </div>
            </div>

            {/* Beneficio 3 */}
            <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
              <div style={{ flexShrink: 0 }}>
                <img 
                  src="https://anpr.org.mx/wp-content/uploads/2025/11/Tierra.jpg"
                  alt="Visibilidad regional"
                  style={{ width: "60px", height: "60px" }}
                />
              </div>
              <div>
                <h3 style={{
                  fontSize: "1.1rem",
                  fontWeight: "700",
                  marginBottom: "0.5rem",
                  color: "white",
                  fontFamily: "'Montserrat', sans-serif"
                }}>
                  Visibilidad regional:
                </h3>
                <p style={{
                  fontSize: "0.95rem",
                  lineHeight: "1.5",
                  color: "#e5e7eb"
                }}>
                  Desde México hasta Argentina, haz que te vean.
                </p>
              </div>
            </div>

            {/* Beneficio 4 */}
            <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
              <div style={{ flexShrink: 0 }}>
                <img 
                  src="https://anpr.org.mx/wp-content/uploads/2025/11/lupa.jpg"
                  alt="Aparición en buscadores"
                  style={{ width: "60px", height: "60px" }}
                />
              </div>
              <div>
                <h3 style={{
                  fontSize: "1.1rem",
                  fontWeight: "700",
                  marginBottom: "0.5rem",
                  color: "white",
                  fontFamily: "'Montserrat', sans-serif"
                }}>
                  Aparición en buscadores:
                </h3>
                <p style={{
                  fontSize: "0.95rem",
                  lineHeight: "1.5",
                  color: "#e5e7eb"
                }}>
                  Aprovecha el SEO de tu micrositio especializado.
                </p>
              </div>
            </div>

            {/* Beneficio 5 */}
            <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
              <div style={{ flexShrink: 0 }}>
                <img 
                  src="https://anpr.org.mx/wp-content/uploads/2025/11/voz.jpg"
                  alt="Promoción cruzada"
                  style={{ width: "60px", height: "60px" }}
                />
              </div>
              <div>
                <h3 style={{
                  fontSize: "1.1rem",
                  fontWeight: "700",
                  marginBottom: "0.5rem",
                  color: "white",
                  fontFamily: "'Montserrat', sans-serif"
                }}>
                  Promoción cruzada:
                </h3>
                <p style={{
                  fontSize: "0.95rem",
                  lineHeight: "1.5",
                  color: "#e5e7eb"
                }}>
                  Posible presencia en eventos, webinars y medios aliados.
                </p>
              </div>
            </div>

            {/* Beneficio 6 */}
            <div style={{ display: "flex", gap: "1rem", alignItems: "flex-start" }}>
              <div style={{ flexShrink: 0 }}>
                <img 
                  src="https://anpr.org.mx/wp-content/uploads/2025/11/engranaje.jpg"
                  alt="Atención personalizada"
                  style={{ width: "60px", height: "60px" }}
                />
              </div>
              <div>
                <h3 style={{
                  fontSize: "1.1rem",
                  fontWeight: "700",
                  marginBottom: "0.5rem",
                  color: "white",
                  fontFamily: "'Montserrat', sans-serif"
                }}>
                  Atención personalizada:
                </h3>
                <p style={{
                  fontSize: "0.95rem",
                  lineHeight: "1.5",
                  color: "#e5e7eb"
                }}>
                  Asesoría cercana para maximizar tu impacto.
                </p>
              </div>
            </div>
          </div>

          {/* Botón CTA */}
          <div style={{ textAlign: "center" }}>
            <Link href="/planes">
              <button style={{
                backgroundColor: "#bcce16",
                color: "#0f2161",
                border: "none",
                borderRadius: "50px",
                padding: "1.2rem 2.5rem",
                fontSize: "1.1rem",
                fontFamily: "'Montserrat', sans-serif",
                fontWeight: "700",
                cursor: "pointer",
                transition: "background-color 0.2s ease",
                boxShadow: "0 4px 6px rgba(0,0,0,0.2)"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#a8b914";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#bcce16";
              }}>
                Regístrate como empresa
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}