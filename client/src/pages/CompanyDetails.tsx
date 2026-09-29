import { useState } from "react";
import DOMPurify from "dompurify";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import { ArrowLeft, MapPin, Phone, Mail, Globe, Video, FileText, Award, Star, MessageSquare, Calculator, Building, Grid3x3, Facebook, Linkedin, Twitter, Instagram, Heart, X, ChevronLeft, ChevronRight, FolderOpen, Plus, Calendar, User, Eye, Play, Edit, Trash2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import CompanyLocationMap from "@/components/CompanyLocationMap";
import ReviewModal from "@/components/ReviewModal";
import QuotationModal from "@/components/QuotationModal";

import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { CompanyWithDetails, ProjectWithDetails } from "@/../../shared/schema";

export default function CompanyDetails() {
  const { id } = useParams();
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [quotationModalOpen, setQuotationModalOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [currentVideoUrl, setCurrentVideoUrl] = useState("");
  const [selectedProject, setSelectedProject] = useState<ProjectWithDetails | null>(null);
  const [, setLocation] = useLocation();

  const { data: company, isLoading, isError, error } = useQuery({
    queryKey: ["/api/companies", id],
    queryFn: async () => {
      const response = await fetch(`/api/companies/${id}?view=public`);
      if (!response.ok) throw new Error("Company not found");
      return response.json();
    },
    retry: false, // Don't retry on error
  });



  // Function to get video ID from YouTube URLs
  const getYouTubeVideoId = (url: string) => {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
  };

  // Function to open video modal
  const openVideoModal = (videoUrl: string) => {
    setCurrentVideoUrl(videoUrl);
    setVideoModalOpen(true);
  };

  // Query para certificados
  const { data: certificates = [] } = useQuery({
    queryKey: ["/api/certificates"],
  });

  // Query para proyectos de la empresa
  const { data: projects = [] } = useQuery({
    queryKey: ["/api/companies", id, "projects"],
    queryFn: async () => {
      if (!id) return [];
      const response = await fetch(`/api/companies/${id}/projects?view=public`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!id,
  });

  // Query para empresas relacionadas
  const { data: relatedCompanies = [] } = useQuery({
    queryKey: ["/api/companies"],
    queryFn: async () => {
      const response = await fetch("/api/companies?limit=4");
      if (!response.ok) throw new Error("Failed to fetch companies");
      const data = await response.json();
      return data.companies.filter((c: any) => c.id !== parseInt(id || "0"));
    },
  });

  // Query para opiniones de la empresa
  const { data: companyOpinions = [] } = useQuery({
    queryKey: ["/api/opinions", { tipo: "empresa", companyId: id, estado: "aprobada" }],
    queryFn: async () => {
      if (!id) return [];
      const response = await fetch(`/api/opinions?tipo=empresa&companyId=${id}&estado=aprobada`);
      if (!response.ok) return [];
      const data = await response.json();
      return data.opinions || [];
    },
    enabled: !!id,
  });

  // Query para ubicaciones de la empresa
  const { data: companyLocations = [] } = useQuery({
    queryKey: ["/api/companies", id, "locations"],
    queryFn: async () => {
      if (!id) return [];
      const response = await fetch(`/api/companies/${id}/locations`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!id,
  });

  // Query para verificar URLs de PeepSo por emails
  const { data: emailPeepsoProfiles } = useQuery({
    queryKey: ["/api/emails/peepso-profiles", company?.email1, company?.email2],
    queryFn: async () => {
      if (!company) return null;
      const emails = [company.email1, company.email2].filter(Boolean);
      if (!emails.length) return null;
      
      const response = await fetch('/api/emails/peepso-profiles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ emails }),
      });
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!company && !!(company.email1 || company.email2),
    retry: false,
  });






  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando información de la empresa...</p>
        </div>
      </div>
    );
  }

  if (isError || !company) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Empresa no encontrada</h1>
          <p className="text-gray-600 mb-4">La empresa que buscas no existe o ha sido eliminada.</p>
          <Link href="/directorio">
            <Button>Volver al directorio</Button>
          </Link>
        </div>
      </div>
    );
  }




  const telefonos = [company.telefono1, company.telefono2].filter(Boolean);
  const emails = [company.email1, company.email2].filter(Boolean);
  const galeria = company.galeriaProductosUrls || [];
  const videos = company.videosUrls || [];
  const representantes = company.representantesVentas || [];
  const redesSociales = company.redesSociales || [];

  // Funciones para el lightbox
  const openLightbox = (index: number) => {
    setCurrentImageIndex(index);
    setLightboxOpen(true);
  };

  const closeLightbox = () => {
    setLightboxOpen(false);
  };

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % galeria.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + galeria.length) % galeria.length);
  };;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver al directorio
            </Button>
          </Link>
        </div>
      </div>

      {/* Hero Section */}
      <div className="relative overflow-hidden text-white">
        {/* Fondo con foto de portada */}
        <div className="absolute inset-0">
          {company.fotoPortadaUrl ? (
            <img
              src={company.fotoPortadaUrl}
              alt={`Portada de ${company.nombreEmpresa}`}
              className="w-full h-full object-cover"
            />
          ) : (
            <img
              src="/attached_assets/fondo_header_directorio.png"
              alt="Fondo header"
              className="w-full h-full object-cover"
            />
          )}
        </div>
        
        {/* Overlay azul marino transparente */}
        <div className="absolute inset-0 bg-slate-900/50"></div>
        
        {/* Contenido del header */}
        <div className="relative max-w-5xl mx-auto px-4 py-16">
          <div className="text-center">
            {/* Logo de la empresa como primer elemento */}
            <div className="flex justify-center mb-8">
              {company.logotipoUrl ? (
                <img
                  src={company.logotipoUrl}
                  alt={company.nombreEmpresa}
                  className="w-44 h-44 object-contain bg-white/10 rounded-full p-5 backdrop-blur-sm"
                />
              ) : (
                <div className="w-44 h-44 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-sm">
                  <span className="text-7xl font-bold">
                    {company.nombreEmpresa.charAt(0)}
                  </span>
                </div>
              )}
            </div>

            {/* Nombre de la empresa */}
            <h1 className="text-4xl mb-8 drop-shadow-lg text-white" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700 }}>{company.nombreEmpresa}</h1>







            {/* Iconos de contacto */}
            <div className="flex items-center justify-center gap-6">
              {emails[0] && (
                <a 
                  href={`mailto:${emails[0]}`} 
                  className="flex items-center justify-center w-12 h-12 bg-white/10 rounded-full hover:bg-white/20 transition-colors group"
                  title={`Enviar email a ${emails[0]}`}
                >
                  <Mail className="h-6 w-6 text-blue-200 group-hover:text-white" />
                </a>
              )}
              {telefonos[0] && (
                <a 
                  href={`tel:${telefonos[0]}`} 
                  className="flex items-center justify-center w-12 h-12 bg-white/10 rounded-full hover:bg-white/20 transition-colors group"
                  title={`Llamar a ${telefonos[0]}`}
                >
                  <Phone className="h-6 w-6 text-green-200 group-hover:text-white" />
                </a>
              )}
              {company.sitioWeb && (
                <a 
                  href={company.sitioWeb} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="flex items-center justify-center w-12 h-12 bg-white/10 rounded-full hover:bg-white/20 transition-colors group"
                  title="Visitar sitio web"
                >
                  <Globe className="h-6 w-6 text-purple-200 group-hover:text-white" />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Información Principal */}
          <div className="lg:col-span-2 space-y-8">
            {/* Descripción Detallada */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileText className="h-5 w-5 mr-2" />
                  Acerca de la Empresa
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div 
                  className="prose max-w-none [&_*]:!text-gray-900 dark:[&_*]:!text-gray-100"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(company.descripcionEmpresa || 'No hay descripción disponible.') }}
                />
              </CardContent>
            </Card>

            {/* Galería de Productos - Tipo Masonry */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Grid3x3 className="h-5 w-5 mr-2" />
                  Galería de Productos
                </CardTitle>
              </CardHeader>
              <CardContent>
                {galeria.length > 0 ? (
                  <div className="columns-1 md:columns-2 lg:columns-3 gap-4 space-y-4">
                    {galeria.map((imagen: string, index: number) => (
                      <div key={index} className="break-inside-avoid">
                        <img
                          src={imagen}
                          alt={`${company.nombreEmpresa} - Producto ${index + 1}`}
                          className="w-full rounded-lg hover:scale-105 transition-transform cursor-pointer shadow-md"
                          style={{ aspectRatio: 'auto' }}
                          onClick={() => openLightbox(index)}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Grid3x3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">Galería de productos próximamente disponible</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Portafolio de Proyectos */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FolderOpen className="h-5 w-5 mr-2" />
                  Portafolio de Proyectos
                </CardTitle>
              </CardHeader>
              <CardContent>
                {projects && projects.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {projects.map((project: ProjectWithDetails) => (
                      <div key={project.id} className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow bg-white">
                        {/* Imagen de portada */}
                        <div 
                          className="h-48 bg-gradient-to-br from-yellow-400 to-yellow-500 relative"
                          style={{
                            backgroundImage: project.galeriaImagenes && project.galeriaImagenes.length > 0 
                              ? `url(${project.galeriaImagenes[0]})`
                              : undefined,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center'
                          }}
                        >
                          {(!project.galeriaImagenes || project.galeriaImagenes.length === 0) && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <FolderOpen className="h-16 w-16 text-white/20" />
                            </div>
                          )}
                        </div>

                        {/* Contenido de la tarjeta */}
                        <div className="p-4">
                          <h4 className="font-semibold text-lg mb-2 line-clamp-2">{project.nombreProyecto}</h4>
                          
                          {/* Descripción con HTML renderizado */}
                          {project.descripcionProyecto && (
                            <div 
                              className="text-sm text-gray-900 mb-4 line-clamp-3 [&_*]:!text-gray-900"
                              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(project.descripcionProyecto) }}
                            />
                          )}

                          {/* Información adicional */}
                          <div className="space-y-2 mb-4">
                            {project.clienteContratante && (
                              <div className="flex items-center text-sm text-gray-500">
                                <User className="h-4 w-4 mr-2 flex-shrink-0" />
                                <span className="truncate">{project.clienteContratante}</span>
                              </div>
                            )}
                            {project.ubicacionCiudad && (
                              <div className="flex items-center text-sm text-gray-500">
                                <MapPin className="h-4 w-4 mr-2 flex-shrink-0" />
                                <span className="truncate">
                                  {project.ubicacionCiudad}
                                  {project.ubicacionEstado && `, ${project.ubicacionEstado}`}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Botón de acción */}
                          <div className="space-y-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="w-full"
                              onClick={() => setSelectedProject(project)}
                            >
                              Ver Detalles
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <FolderOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">Aún no hay proyectos registrados</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Videos */}
            {videos.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Video className="h-5 w-5 mr-2" />
                    Videos Corporativos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {videos.map((videoUrl: string, index: number) => {
                      const videoId = getYouTubeVideoId(videoUrl);
                      return (
                        <div key={index} className="aspect-video">
                          <iframe
                            src={videoId ? `https://www.youtube.com/embed/${videoId}` : videoUrl}
                            className="w-full h-full rounded-lg"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}



            {/* Reseñas de Clientes */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MessageSquare className="h-5 w-5 mr-2" />
                  Lo que dicen nuestros clientes
                </CardTitle>
              </CardHeader>
              <CardContent>
                {companyOpinions && companyOpinions.length > 0 ? (
                  <div className="space-y-6">
                    {companyOpinions.map((opinion: any) => (
                      <div key={opinion.id} className="border-l-4 border-blue-500 pl-4">
                        <div className="flex items-center mb-2">
                          {[...Array(opinion.calificacion || 5)].map((_, i) => (
                            <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          ))}
                          {opinion.calificacion < 5 && [...Array(5 - (opinion.calificacion || 5))].map((_, i) => (
                            <Star key={`empty-${i}`} className="h-4 w-4 text-gray-300" />
                          ))}
                        </div>
                        <p className="text-gray-700 mb-2">"{opinion.comentario}"</p>
                        <p className="text-sm text-gray-500">- {opinion.nombre}</p>
                        {opinion.fechaCreacion && (
                          <p className="text-xs text-gray-400 mt-1">
                            {new Date(opinion.fechaCreacion).toLocaleDateString('es-ES')}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500 mb-4">Aún no hay reseñas para esta empresa</p>
                    <p className="text-sm text-gray-400">
                      Sé el primero en compartir tu experiencia con {company.nombreEmpresa}
                    </p>
                  </div>
                )}
                
                <div className="mt-6 text-center">
                  <Button 
                    className="bg-blue-600 hover:bg-blue-700"
                    onClick={() => setReviewModalOpen(true)}
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Dejar una reseña
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* CTA - Solicitar Cotización */}
            <Card className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
              <CardContent className="p-8 text-center">
                <Calculator className="h-12 w-12 mx-auto mb-4 text-blue-200" />
                <h3 className="text-2xl font-bold mb-4 text-white" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 900, color: 'white' }}>¿Interesado en nuestros servicios?</h3>
                <p className="text-blue-100 mb-6 text-lg">
                  Obtén una cotización personalizada para tu proyecto. Nuestro equipo está listo para ayudarte.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button 
                    size="lg" 
                    className="bg-white text-blue-600 hover:bg-gray-100 font-semibold"
                    onClick={() => setQuotationModalOpen(true)}
                  >
                    <Calculator className="h-5 w-5 mr-2" />
                    Solicitar Cotización
                  </Button>
                  {company.telefono1 && (
                    <Button 
                      size="lg" 
                      asChild
                      className="bg-green-600 hover:bg-green-700 text-white font-semibold border-0"
                    >
                      <a href={`tel:${company.telefono1}`}>
                        <Phone className="h-5 w-5 mr-2" />
                        Llamar Ahora
                      </a>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Representantes de Ventas */}
            {representantes.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Equipo de Ventas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {representantes.map((rep: any, index: number) => (
                      <div key={index} className="p-4 border rounded-lg">
                        {typeof rep === 'object' && rep.telefono ? (
                          <div>
                            <h4 className="font-semibold">Representante {index + 1}</h4>
                            <p className="text-gray-600">{rep.telefono}</p>
                          </div>
                        ) : (
                          <div>
                            <h4 className="font-semibold">Representante {index + 1}</h4>
                            <p className="text-gray-600">{String(rep)}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Certificados y Reconocimientos */}
            {company.certificates && Array.isArray(company.certificates) && company.certificates.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Award className="h-5 w-5 mr-2" />
                    Certificados y Reconocimientos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {company.certificates.map((certificate: any) => (
                      <div key={certificate.id} className="border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow">
                        {/* Header con imagen e icono */}
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 flex-shrink-0">
                            <img
                              src={certificate.imagenUrl}
                              alt={certificate.nombreCertificado}
                              className="w-10 h-10 object-cover rounded-full"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-gray-900 text-sm leading-tight truncate">
                              {certificate.nombreCertificado}
                            </h4>
                          </div>
                        </div>
                        
                        {/* Información compacta */}
                        <div className="space-y-2 text-xs">
                          {certificate.fechaVencimiento && (
                            <div className="flex justify-between items-center">
                              <span className="text-gray-500">Válido hasta</span>
                              <span className="text-gray-900 font-medium">
                                {certificate.fechaVencimiento}
                              </span>
                            </div>
                          )}
                          
                          {certificate.entidadEmisora && (
                            <div className="flex justify-between items-center">
                              <span className="text-gray-500">Emitido por</span>
                              <span className="text-gray-900 font-medium text-right truncate">
                                {certificate.entidadEmisora}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Información de Contacto */}
            <Card>
              <CardHeader>
                <CardTitle>Información de Contacto</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Representante */}
                <div>
                  <h4 className="font-semibold mb-2 flex items-center">
                    <User className="h-4 w-4 mr-2" />
                    Representante
                  </h4>
                  <p className="text-gray-600">
                    {company.representantesVentas || company.user?.displayName || company.email1 || "Sin representante asignado"}
                  </p>
                </div>

                {/* Teléfonos */}
                {telefonos.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center">
                      <Phone className="h-4 w-4 mr-2" />
                      Teléfonos
                    </h4>
                    {telefonos.map((telefono, index) => (
                      <p key={index} className="text-gray-600">{telefono}</p>
                    ))}
                  </div>
                )}

                {/* Emails */}
                {emails.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center">
                      <Mail className="h-4 w-4 mr-2" />
                      Correos Electrónicos
                    </h4>
                    <div className="space-y-3">
                      {emails.map((email, index) => {
                        const peepsoProfile = emailPeepsoProfiles?.success && emailPeepsoProfiles?.profiles?.[email];
                        const hasProfile = peepsoProfile?.has_peepso_profile && peepsoProfile?.profile_url;
                        const peepsoUrl = hasProfile ? peepsoProfile.profile_url : null;
                        
                        return (
                          <div key={index} className="space-y-1">
                            <p className="text-gray-600">{email}</p>
                            {hasProfile && peepsoUrl && (
                              <div className="ml-0">
                                <a
                                  href={peepsoUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 transition-colors"
                                >
                                  <User className="h-3 w-3 mr-1" />
                                  Ver perfil en la Comunidad
                                  <ExternalLink className="h-3 w-3 ml-1" />
                                </a>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Sitio Web */}
                {company.sitioWeb && (
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center">
                      <Globe className="h-4 w-4 mr-2" />
                      Sitio Web
                    </h4>
                    <a
                      href={company.sitioWeb}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {company.sitioWeb}
                    </a>
                  </div>
                )}

                <Separator />

                {/* Redes Sociales */}
                {company.redesSociales && Array.isArray(company.redesSociales) && company.redesSociales.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-3">Redes Sociales</h4>
                    <div className="space-y-3">
                      {company.redesSociales.map((red: any, index: number) => (
                        <a
                          key={index}
                          href={red.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center text-gray-600 hover:text-blue-600 transition-colors group"
                        >
                          <div className="w-8 h-8 rounded-full bg-gray-100 group-hover:bg-blue-100 flex items-center justify-center mr-3 transition-colors">
                            {red.plataforma === 'Facebook' && <Facebook className="h-4 w-4" />}
                            {red.plataforma === 'LinkedIn' && <Linkedin className="h-4 w-4" />}
                            {(red.plataforma === 'Twitter' || red.plataforma === 'X' || red.plataforma === 'x' || red.plataforma === 'twitter') && <Twitter className="h-4 w-4" />}
                            {red.plataforma === 'Instagram' && <Instagram className="h-4 w-4" />}
                            {!['Facebook', 'LinkedIn', 'Twitter', 'X', 'x', 'twitter', 'Instagram'].includes(red.plataforma) && 
                              <Globe className="h-4 w-4" />
                            }
                          </div>
                          <span className="font-medium">{red.plataforma === 'Twitter' || red.plataforma === 'twitter' ? 'X' : red.plataforma}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

              </CardContent>
            </Card>

            {/* Videos Empresariales */}
            {videos.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Video className="h-5 w-5 mr-2" />
                    Videos Corporativos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {videos.map((videoUrl: string, index: number) => {
                      const videoId = getYouTubeVideoId(videoUrl);
                      const thumbnailUrl = videoId 
                        ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
                        : '/api/placeholder/300/200';
                      
                      return (
                        <div key={index} className="relative group">
                          <div className="relative overflow-hidden rounded-lg bg-gray-100">
                            <img 
                              src={thumbnailUrl}
                              alt={`Video ${index + 1}`}
                              className="w-full h-24 object-cover"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.src = '/api/placeholder/300/200';
                              }}
                            />
                            <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <Play className="h-8 w-8 text-white" />
                            </div>
                          </div>
                          <Button
                            onClick={() => openVideoModal(videoUrl)}
                            className="w-full mt-2 bg-[#bcce16] hover:bg-[#a8b814] text-black font-semibold"
                          >
                            <Play className="h-4 w-4 mr-2" />
                            Ver Video {index + 1}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Categorías */}
            {company.categories && Array.isArray(company.categories) && company.categories.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Grid3x3 className="h-5 w-5 mr-2" />
                    Categorías de Servicios
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    {company.categories.map((category: any) => (
                      <div 
                        key={category.id} 
                        className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer group"
                        onClick={() => setLocation(`/directorio?categoria=${category.id}`)}
                      >
                        <div className="flex-shrink-0">
                          {category.iconoUrl ? (
                            <img 
                              src={category.iconoUrl} 
                              alt={category.nombreCategoria}
                              className="w-8 h-8 object-contain"
                            />
                          ) : (
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                              <Grid3x3 className="h-4 w-4 text-blue-600" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                            {category.nombreCategoria}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Dirección */}
            {company.direccionFisica && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <MapPin className="h-5 w-5 mr-2" />
                    Dirección
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-700">{company.direccionFisica}</p>
                  </div>
                </CardContent>
              </Card>
            )}



            {/* Catálogo Digital */}
            {company.catalogoDigitalUrl && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <FileText className="h-5 w-5 mr-2" />
                    Catálogo Digital
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative group">
                    <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
                      <div className="flex items-center justify-center mb-4">
                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-md">
                          <FileText className="h-8 w-8 text-blue-600" />
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-gray-600 mb-2">Descarga nuestro catálogo completo</p>
                        <p className="text-xs text-gray-500">Productos y servicios detallados</p>
                      </div>
                    </div>
                    <Button 
                      className="w-full mt-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                      onClick={() => {
                        // Try to open in new tab first
                        const newWindow = window.open(company.catalogoDigitalUrl, '_blank', 'noopener,noreferrer');
                        
                        // If popup blocked, create a temporary link and click it
                        if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
                          const link = document.createElement('a');
                          link.href = company.catalogoDigitalUrl;
                          link.target = '_blank';
                          link.rel = 'noopener noreferrer';
                          link.download = `catalogo-${company.nombreEmpresa}.pdf`;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        }
                      }}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Ver Catálogo Digital
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}


          </div>
        </div>

        {/* Sección del Mapa - Nuestra Ubicación */}
        <div className="mt-12">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <MapPin className="h-5 w-5 mr-2" />
                Nuestra Ubicación
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {company.direccionFisica ? (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-gray-700 font-medium">{company.direccionFisica}</p>
                    {company.ciudad && company.estado && (
                      <p className="text-gray-600 text-sm mt-1">
                        {company.ciudad}, {company.estado}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-gray-500">Dirección o descripción no disponible</p>
                    {company.ciudad && company.estado && (
                      <p className="text-gray-600 text-sm mt-1">
                        {company.ciudad}, {company.estado}
                      </p>
                    )}
                  </div>
                )}
                
                {/* Mapa */}
                <CompanyLocationMap 
                  ubicacionGeografica={company.ubicacionGeografica}
                  direccionFisica={company.direccionFisica}
                  nombreEmpresa={company.nombreEmpresa}
                  ciudadesPresencia={company.ciudadesPresencia}
                  locations={companyLocations}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sección de Empresas Relacionadas */}
        {relatedCompanies.length > 0 && (
          <div className="mt-12">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Building className="h-5 w-5 mr-2" />
                  Explorar otras empresas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-center py-6">
                  <Button 
                    size="lg"
                    className="font-semibold px-8 py-4 text-lg"
                    style={{ backgroundColor: '#0f2161' }}
                    onClick={() => setLocation('/directorio')}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#1a2f7a';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#0f2161';
                    }}
                  >
                    Ver más empresas
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Modal de Reseñas */}
      <ReviewModal
        open={reviewModalOpen}
        onOpenChange={setReviewModalOpen}
        companyId={parseInt(id || "0")}
        companyName={company?.nombreEmpresa || ""}
      />

      <QuotationModal
        open={quotationModalOpen}
        onOpenChange={setQuotationModalOpen}
        companyEmail={company?.email1 || ""}
        companyName={company?.nombreEmpresa || ""}
      />



      {/* Modal de Video */}
      <Dialog open={videoModalOpen} onOpenChange={setVideoModalOpen}>
        <DialogContent className="max-w-4xl w-full">
          <DialogHeader>
            <DialogTitle>Video Empresarial</DialogTitle>
          </DialogHeader>
          <div className="aspect-video">
            {currentVideoUrl && (
              <iframe
                src={`https://www.youtube.com/embed/${getYouTubeVideoId(currentVideoUrl)}?autoplay=1`}
                title="Video empresarial"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="w-full h-full rounded-lg"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Lightbox Modal */}
      {lightboxOpen && galeria.length > 0 && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center"
          onClick={closeLightbox}
        >
          <div className="relative max-w-4xl max-h-full p-4">
            {/* Botón cerrar */}
            <button
              onClick={closeLightbox}
              className="absolute top-4 right-4 z-10 bg-black bg-opacity-50 text-white rounded-full p-2 hover:bg-opacity-70 transition-all"
            >
              <X className="h-6 w-6" />
            </button>

            {/* Navegación anterior */}
            {galeria.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  prevImage();
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-10 bg-black bg-opacity-50 text-white rounded-full p-2 hover:bg-opacity-70 transition-all"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
            )}

            {/* Navegación siguiente */}
            {galeria.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  nextImage();
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-10 bg-black bg-opacity-50 text-white rounded-full p-2 hover:bg-opacity-70 transition-all"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            )}

            {/* Imagen principal */}
            <img
              src={galeria[currentImageIndex]}
              alt={`${company?.nombreEmpresa} - Producto ${currentImageIndex + 1}`}
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />

            {/* Indicador de posición */}
            {galeria.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-sm">
                {currentImageIndex + 1} / {galeria.length}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de Detalles del Proyecto */}
      {selectedProject && (
        <Dialog open={!!selectedProject} onOpenChange={() => setSelectedProject(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">
                {selectedProject.nombreProyecto}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Imagen principal */}
              {selectedProject.galeriaImagenes && selectedProject.galeriaImagenes.length > 0 && (
                <div className="w-full h-64 rounded-lg overflow-hidden">
                  <img
                    src={selectedProject.galeriaImagenes[0]}
                    alt={selectedProject.nombreProyecto}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* Información básica */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedProject.clienteContratante && (
                  <div className="flex items-center space-x-2">
                    <User className="h-4 w-4 text-gray-400" />
                    <span className="text-sm">
                      <strong>Cliente:</strong> {selectedProject.clienteContratante}
                    </span>
                  </div>
                )}
                
                {selectedProject.fechaInicio && (
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span className="text-sm">
                      <strong>Fecha:</strong> {new Date(selectedProject.fechaInicio).toLocaleDateString()}
                    </span>
                  </div>
                )}
                
                {selectedProject.ubicacionCiudad && (
                  <div className="flex items-center space-x-2">
                    <MapPin className="h-4 w-4 text-gray-400" />
                    <span className="text-sm">
                      <strong>Ubicación:</strong> {selectedProject.ubicacionCiudad}
                      {selectedProject.ubicacionEstado && `, ${selectedProject.ubicacionEstado}`}
                    </span>
                  </div>
                )}
                
                {selectedProject.areaSuperficie && (
                  <div className="flex items-center space-x-2">
                    <Building className="h-4 w-4 text-gray-400" />
                    <span className="text-sm">
                      <strong>Área:</strong> {selectedProject.areaSuperficie}
                    </span>
                  </div>
                )}
              </div>

              {/* Descripción */}
              {selectedProject.descripcionProyecto && (
                <div>
                  <h3 className="font-semibold mb-2">Descripción del Proyecto</h3>
                  <div 
                    className="text-sm text-gray-700 prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selectedProject.descripcionProyecto) }}
                  />
                </div>
              )}

              {/* Servicios/Productos */}
              {selectedProject.serviciosProductos && selectedProject.serviciosProductos.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Servicios y Productos Utilizados</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedProject.serviciosProductos.map((servicio, index) => (
                      <Badge key={index} variant="outline">
                        {servicio}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Galería de imágenes */}
              {selectedProject.galeriaImagenes && selectedProject.galeriaImagenes.length > 1 && (
                <div>
                  <h3 className="font-semibold mb-2">Galería del Proyecto</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {selectedProject.galeriaImagenes.map((imagen, index) => (
                      <img
                        key={index}
                        src={imagen}
                        alt={`${selectedProject.nombreProyecto} - Imagen ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => {
                          // Aquí se podría implementar un lightbox
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Videos del proyecto */}
              {selectedProject.videoUrl && (
                <div>
                  <h3 className="font-semibold mb-2">Videos del Proyecto</h3>
                  <div className="space-y-2">
                    {[selectedProject.videoUrl].map((videoUrl: string, index: number) => (
                      <Button
                        key={index}
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => window.open(videoUrl, '_blank')}
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Ver Video {index + 1}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}