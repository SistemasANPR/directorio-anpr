import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Edit, Building, Award, MapPin, Phone, Mail, Globe, Calendar, ExternalLink } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CompanyWithDetails, Certificate } from "@shared/schema";
import EditCompanyModal from "@/components/EditCompanyModal";
import AddCertificateModal from "@/components/AddCertificateModal";
import EditCertificateModal from "@/components/EditCertificateModal";
import CertificateTable from "@/components/CertificateTable";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Swal from 'sweetalert2';

export default function MyCompany() {
  const { user, impersonatedCompany } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddCertificateModalOpen, setIsAddCertificateModalOpen] = useState(false);
  const [isEditCertificateModalOpen, setIsEditCertificateModalOpen] = useState(false);
  const [selectedCertificate, setSelectedCertificate] = useState<Certificate | null>(null);

  // Fetch the company data - use impersonated company if available, otherwise user's company
  const { data: company, isLoading: companyLoading } = useQuery({
    queryKey: impersonatedCompany ? ["/api/companies", impersonatedCompany.id] : ["/api/companies/by-user", user?.id],
    enabled: !!(impersonatedCompany?.id || user?.id),
  });

  // Fetch certificates for this company
  const { data: certificates = [], isLoading: certificatesLoading } = useQuery({
    queryKey: ["/api/certificates"],
  });

  // Delete certificate mutation
  const deleteCertificateMutation = useMutation({
    mutationFn: async (certificateId: number) => {
      return apiRequest("DELETE", `/api/certificates/${certificateId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/certificates"] });
      toast({
        title: "Certificado eliminado",
        description: "El certificado ha sido eliminado exitosamente",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo eliminar el certificado",
        variant: "destructive",
      });
    },
  });

  const handleEditCompany = () => {
    setIsEditModalOpen(true);
  };


  const handleEditCertificate = (certificate: Certificate) => {
    setSelectedCertificate(certificate);
    setIsEditCertificateModalOpen(true);
  };

  const handleDeleteCertificate = async (certificateId: number) => {
    const result = await Swal.fire({
      title: '¿Estás seguro?',
      text: 'Esta acción eliminará el certificado permanentemente',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true
    });

    if (result.isConfirmed) {
      deleteCertificateMutation.mutate(certificateId);
    }
  };

  if (companyLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Cargando información de la empresa...</div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="text-center py-12">
        <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay empresa asociada</h3>
        <p className="text-gray-500">
          {impersonatedCompany 
            ? "No se pudo encontrar la empresa seleccionada"
            : "Tu usuario no está asociado a ninguna empresa"
          }
        </p>
      </div>
    );
  }

  const companyData = impersonatedCompany || company;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary">
            {impersonatedCompany ? `Actuando como: ${companyData.nombreEmpresa}` : "Mi Empresa"}
          </h1>
          <p className="text-gray-600 mt-1">
            {impersonatedCompany 
              ? "Gestiona la información de esta empresa como su representante"
              : "Gestiona la información y certificados de tu empresa"
            }
          </p>
        </div>
        <Button onClick={handleEditCompany} className="bg-[#bcce16] hover:bg-[#a8b814] text-black">
          <Edit className="w-4 h-4 mr-2" />
          Editar Empresa
        </Button>
      </div>

      <Tabs defaultValue="info" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="info">Información de la Empresa</TabsTrigger>
          <TabsTrigger value="certificates">Certificados y Premios</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="space-y-6">
          {/* Company Information Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={companyData.logotipoUrl || ""} alt={companyData.nombreEmpresa} />
                  <AvatarFallback>
                    <Building className="h-8 w-8" />
                  </AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-2xl">{companyData.nombreEmpresa}</CardTitle>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge 
                      variant={companyData.estado === 'activo' ? 'default' : 'secondary'}
                      className={companyData.estado === 'activo' ? 'bg-green-100 text-green-800' : ''}
                    >
                      {companyData.estado?.charAt(0).toUpperCase() + companyData.estado?.slice(1)}
                    </Badge>
                    {companyData.membershipType && (
                      <Badge variant="outline">
                        {companyData.membershipType.nombrePlan}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Contact Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Información de Contacto</h3>
                  
                  {companyData.email1 && (
                    <div className="flex items-center space-x-3">
                      <Mail className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-500">Email Principal</p>
                        <p className="font-medium">{companyData.email1}</p>
                      </div>
                    </div>
                  )}

                  {companyData.telefono1 && (
                    <div className="flex items-center space-x-3">
                      <Phone className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-500">Teléfono Principal</p>
                        <p className="font-medium">{companyData.telefono1}</p>
                      </div>
                    </div>
                  )}

                  {companyData.sitioWeb && (
                    <div className="flex items-center space-x-3">
                      <Globe className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-500">Sitio Web</p>
                        <a 
                          href={companyData.sitioWeb} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="font-medium text-blue-600 hover:text-blue-800"
                        >
                          {companyData.sitioWeb}
                        </a>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Ubicación</h3>
                  
                  {companyData.direccionFisica && (
                    <div className="flex items-start space-x-3">
                      <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-500">Dirección Física</p>
                        <p className="font-medium">{companyData.direccionFisica}</p>
                      </div>
                    </div>
                  )}

                  {companyData.ciudadesPresencia && companyData.ciudadesPresencia.length > 0 && (
                    <div className="flex items-start space-x-3">
                      <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-500">Ciudades de Presencia</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {companyData.ciudadesPresencia.slice(0, 3).map((ciudad, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {ciudad}
                            </Badge>
                          ))}
                          {companyData.ciudadesPresencia.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{companyData.ciudadesPresencia.length - 3} más
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Categories */}
              {companyData.categories && companyData.categories.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-lg">Categorías</h3>
                  <div className="flex flex-wrap gap-2">
                    {companyData.categories.map((category) => (
                      <Badge key={category.id} variant="secondary">
                        {category.nombreCategoria}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Membership Information */}
              {companyData.membershipType && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-lg">Información de Membresía</h3>
                    <Button
                      onClick={() => setLocation("/")}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2 hover:bg-[#bcce16] hover:text-black hover:border-[#bcce16] transition-colors"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Ver en Directorio
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-center space-x-3">
                      <Calendar className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-500">Inicio de Membresía</p>
                        <p className="font-medium">
                          {companyData.fechaInicioMembresia ? 
                            new Date(companyData.fechaInicioMembresia).toLocaleDateString() : 
                            'No especificado'
                          }
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Calendar className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-500">Fin de Membresía</p>
                        <p className="font-medium">
                          {companyData.fechaFinMembresia ? 
                            new Date(companyData.fechaFinMembresia).toLocaleDateString() : 
                            'No especificado'
                          }
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Award className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-500">Periodicidad</p>
                        <p className="font-medium capitalize">
                          {companyData.membershipPeriodicidad || 'No especificado'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="certificates" className="space-y-6">
          {/* Certificates Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  Certificados y Premios
                </CardTitle>
                <Button 
                  onClick={() => setIsAddCertificateModalOpen(true)}
                  className="bg-[#bcce16] hover:bg-[#a8b814] text-black"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Agregar Certificado
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {certificatesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-gray-500">Cargando certificados...</div>
                </div>
              ) : (
                <CertificateTable
                  certificates={certificates}
                  onDelete={handleDeleteCertificate}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <EditCompanyModal
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        company={companyData}
      />

      <AddCertificateModal
        open={isAddCertificateModalOpen}
        onOpenChange={setIsAddCertificateModalOpen}
        companyId={(companyData as any)?.id}
      />

      <EditCertificateModal
        open={isEditCertificateModalOpen}
        onOpenChange={setIsEditCertificateModalOpen}
        certificate={selectedCertificate}
      />

    </div>
  );
}