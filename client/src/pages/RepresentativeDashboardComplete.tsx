import { useState, useEffect } from "react";
import DOMPurify from "dompurify";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useCurrency } from "@/lib/currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Building, 
  CreditCard, 
  Calendar, 
  Crown,
  Award,
  BarChart3,
  Briefcase,
  Check,
  Plus,
  Eye,
  Edit,
  Trash2,
  Package,
  X,
  Download,
  AlertTriangle,
  MessageSquare,
  RefreshCw,
  AlertCircle
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import EditCompanyModal from "@/components/EditCompanyModal";
import RepresentativeCertificateTable from "@/components/RepresentativeCertificateTable";
import RepresentativeReview from "@/components/RepresentativeReview";
import EditCertificateModal from "@/components/EditCertificateModal";
import MembershipLimitsDisplay from "@/components/MembershipLimitsDisplay";
import AddCertificateModal from "@/components/AddCertificateModal";
import AddProjectModal from "@/components/AddProjectModal";
import PaymentMethodCard from "@/components/PaymentMethodCard";
import EditProjectModal from "@/components/EditProjectModal";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Certificate, ProjectWithDetails } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Swal from 'sweetalert2';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const isEnterpriseMembership = (membership: any) => {
  const planName = String(membership?.nombrePlan ?? "").toLowerCase();
  return ["empresarial", "enterprise", "premium"].some((term) => planName.includes(term));
};

export default function RepresentativeDashboard() {
  const { user, impersonatedCompany, isWordPressSession } = useAuth();
  const { format: formatMoney, code: currencyCode } = useCurrency();
  const effectiveUserId = impersonatedCompany?.userId ?? user?.id;
  // Los representantes de membresías empresariales provenientes de WordPress
  // gestionan sus pagos fuera de este dashboard.
  const restrictWordPressRepresentative = isWordPressSession;
  const allowedTabs = restrictWordPressRepresentative
    ? ['overview', 'company', 'projects', 'certificates', 'membership', 'review']
    : ['overview', 'company', 'projects', 'certificates', 'membership', 'payments', 'review'];
  const [activeTab, setActiveTab] = useState("overview");
  // Esta selección pertenece al representante, no a la suplantación de un
  // administrador. Se guarda por pestaña para conservar el contexto al recargar.
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  
  console.log("RepresentativeDashboard - Current user:", user);
  
  // Certificate management states
  const [isAddCertificateModalOpen, setIsAddCertificateModalOpen] = useState(false);
  const [isEditCertificateModalOpen, setIsEditCertificateModalOpen] = useState(false);
  const [selectedCertificate, setSelectedCertificate] = useState<Certificate | null>(null);
  
  // Project management states
  const [isAddProjectModalOpen, setIsAddProjectModalOpen] = useState(false);
  const [isEditProjectModalOpen, setIsEditProjectModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectWithDetails | null>(null);
  
  // Plan management states
  const [isChangePlanModalOpen, setIsChangePlanModalOpen] = useState(false);
  const [isCancelPlanModalOpen, setIsCancelPlanModalOpen] = useState(false);
  const [selectedNewPlan, setSelectedNewPlan] = useState<any>(null);
  const [selectedPeriodicidad, setSelectedPeriodicidad] = useState<"mensual" | "anual">("mensual");
  const [showPlanConfirmation, setShowPlanConfirmation] = useState(false);
  
  // Company edit modal state
  const [isEditCompanyModalOpen, setIsEditCompanyModalOpen] = useState(false);
  
  const { toast } = useToast();

  // Handle URL parameters for direct tab navigation
  useEffect(() => {
    const updateTab = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const tabParam = urlParams.get('tab');
      if (tabParam && allowedTabs.includes(tabParam)) {
        setActiveTab(tabParam);
      } else if (tabParam) {
        setActiveTab('overview');
        window.history.replaceState({}, '', '/representative-dashboard?tab=overview');
      }
    };
    
    const handleTabNavigation = (event: CustomEvent) => {
      const tabName = event.detail?.tab;
      if (tabName && allowedTabs.includes(tabName)) {
        setActiveTab(tabName);
      }
    };
    
    updateTab();
    window.addEventListener('popstate', updateTab);
    window.addEventListener('navigateTab', handleTabNavigation as EventListener);
    
    return () => {
      window.removeEventListener('popstate', updateTab);
      window.removeEventListener('navigateTab', handleTabNavigation as EventListener);
    };
  }, [restrictWordPressRepresentative]);

  // Fetch dashboard data
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: [`/api/representative/dashboard/${effectiveUserId}`],
    enabled: !!effectiveUserId,
  });

  // Fetch membership types (only public plans for non-admin users)
  const { data: membershipTypes } = useQuery({
    queryKey: ['/api/membership-types/public'],
  });

  // Los certificados de la empresa (incluido el oficial ANPR asignado por el
  // admin) ya vienen dentro de la empresa en los datos del dashboard, por lo que
  // no se piden a un endpoint global aparte: ese endpoint excluía los
  // certificados creados por admin para los representantes y, además, no estaba
  // acotado por empresa. Se derivan de `primaryCompany.certificates` más abajo.

  // Extract company data — when an admin impersonates a company, prefer the
  // impersonated record so the dashboard renders even if the API has no rows
  // tied to that user. Pero si los datos frescos del dashboard incluyen esa
  // misma empresa, se usan esos (así las invalidaciones de cache tras
  // agregar/editar/eliminar certificados refrescan la lista en impersonación).
  const dashboardCompanies = (dashboardData as any)?.companies as any[] | undefined;
  const companySelectionStorageKey = effectiveUserId
    ? `representativeDashboard:selectedCompany:${effectiveUserId}`
    : null;

  // Al recibir las empresas, se conserva primero una elección guardada; en la
  // primera visita se prefiere la empresa principal de WordPress y finalmente
  // la primera asignación válida.
  // La suplantación conserva su comportamiento independiente y no se usa como
  // estado de selección de representante.
  useEffect(() => {
    if (impersonatedCompany || !dashboardCompanies?.length) return;

    const isAssociatedCompany = (companyId: number | null) =>
      companyId !== null && dashboardCompanies.some((company) => company.id === companyId);
    const wordpressCompanyId = Number((user as any)?.companyId);
    let persistedCompanyId: number | null = null;

    try {
      const persisted = companySelectionStorageKey
        ? sessionStorage.getItem(companySelectionStorageKey)
        : null;
      const parsed = persisted ? Number(persisted) : NaN;
      persistedCompanyId = Number.isInteger(parsed) ? parsed : null;
    } catch {
      // sessionStorage puede no estar disponible en contextos embebidos.
    }

    const nextCompanyId =
      (isAssociatedCompany(selectedCompanyId) && selectedCompanyId) ||
      (isAssociatedCompany(persistedCompanyId) && persistedCompanyId) ||
      (isAssociatedCompany(wordpressCompanyId) && wordpressCompanyId) ||
      dashboardCompanies[0].id;

    if (selectedCompanyId !== nextCompanyId) {
      setSelectedCompanyId(nextCompanyId);
    }
  }, [
    companySelectionStorageKey,
    dashboardCompanies,
    impersonatedCompany,
    selectedCompanyId,
    (user as any)?.companyId,
  ]);

  useEffect(() => {
    if (impersonatedCompany || !companySelectionStorageKey || selectedCompanyId === null) return;
    try {
      sessionStorage.setItem(companySelectionStorageKey, String(selectedCompanyId));
    } catch {
      // La selección seguirá funcionando durante la sesión actual.
    }
  }, [companySelectionStorageKey, impersonatedCompany, selectedCompanyId]);

  const freshImpersonatedCompany = impersonatedCompany
    ? dashboardCompanies?.find((c) => c.id === impersonatedCompany.id)
    : undefined;
  const selectedCompany = dashboardCompanies?.find((company) => company.id === selectedCompanyId);
  const primaryCompany = freshImpersonatedCompany ?? impersonatedCompany ?? selectedCompany ?? dashboardCompanies?.[0];
  // El campo global del endpoint procede históricamente de la primera empresa.
  // Cada empresa enriquecida incluye su propio plan, que es el dato correcto.
  const currentMembership = (primaryCompany as any)?.membershipType ?? (dashboardData as any)?.currentMembership;
  const canChangePlan = !isEnterpriseMembership(currentMembership);
  const isMembershipCancelled = !!(primaryCompany as any)?.membershipCancelled;
  // Cambio de plan PROGRAMADO (si existe). Los datos vienen de la empresa.
  const pendingPlanId = (primaryCompany as any)?.pendingMembershipTypeId as number | null | undefined;
  const hasScheduledChange = !!pendingPlanId;
  const pendingPlan = hasScheduledChange
    ? (Array.isArray(membershipTypes) ? (membershipTypes as any[]) : []).find((mt: any) => mt.id === pendingPlanId)
    : null;
  const pendingPeriodicidad = (primaryCompany as any)?.pendingMembershipPeriodicidad as string | null | undefined;
  const pendingPrice = (primaryCompany as any)?.pendingMembershipPrice as string | null | undefined;
  const pendingEffectiveDate = (primaryCompany as any)?.pendingChangeEffectiveDate as string | null | undefined;
  const pendingPaymentStatus = (primaryCompany as any)?.pendingPaymentStatus as string | null | undefined;
  const pendingPaymentFailed = pendingPaymentStatus === "fallido";
  const payments = (dashboardData as any)?.payments || [];

  // Fetch projects for the company
  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: [`/api/companies/${primaryCompany?.id}/projects`],
    enabled: !!primaryCompany?.id,
  });

  // Type projects data properly
  const typedProjects = Array.isArray(projects) ? projects as ProjectWithDetails[] : [];
  
  // Type the responses properly. Los certificados salen de la empresa (incluye
  // el oficial ANPR asignado por el admin), no de un endpoint global.
  const typedCertificates = Array.isArray((primaryCompany as any)?.certificates)
    ? ((primaryCompany as any).certificates as Certificate[])
    : [];
  const typedMembershipTypes = Array.isArray(membershipTypes) ? membershipTypes as any[] : [];

  // Delete certificate mutation
  const deleteCertificateMutation = useMutation({
    mutationFn: async (certificateId: number) => {
      return apiRequest("DELETE", `/api/certificates/${certificateId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/certificates"] });
      // Los certificados se muestran desde los datos del dashboard (empresa).
      queryClient.invalidateQueries({ queryKey: [`/api/representative/dashboard/${effectiveUserId}`] });
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

  // Delete project mutation
  const deleteProjectMutation = useMutation({
    mutationFn: async (projectId: number) => {
      const response = await apiRequest("DELETE", `/api/projects/${projectId}`);
      if (!response.ok) {
        throw new Error("Error al eliminar el proyecto");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/companies/${primaryCompany?.id}/projects`] });
      toast({
        title: "Proyecto eliminado",
        description: "El proyecto se ha eliminado correctamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al eliminar el proyecto",
        variant: "destructive",
      });
    },
  });

  // Cancel plan mutation
  const cancelPlanMutation = useMutation({
    mutationFn: async () => {
      // Detiene SOLO la renovación automática; el plan sigue activo hasta la
      // fecha de vencimiento (no desactiva la empresa).
      const response = await apiRequest("POST", `/api/companies/${primaryCompany?.id}/cancel-membership`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/representative/dashboard/${effectiveUserId}`] });
      toast({
        title: "Renovación cancelada",
        description: "Tu plan seguirá activo hasta la fecha de vencimiento.",
      });
      setIsCancelPlanModalOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo cancelar la renovación",
        variant: "destructive",
      });
    },
  });

  const resumeMembershipMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/companies/${primaryCompany?.id}/resume-membership`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/representative/dashboard/${effectiveUserId}`] });
      toast({
        title: "Renovación reanudada",
        description: "Tu plan continuará renovándose normalmente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo reanudar la renovación",
        variant: "destructive",
      });
    },
  });

  // Change plan mutation
  const changePlanMutation = useMutation({
    mutationFn: async ({ targetPlanId, periodicidad }: { targetPlanId: number; periodicidad: string }) => {
      const response = await apiRequest("POST", `/api/companies/${primaryCompany?.id}/change-plan`, {
        targetPlanId,
        periodicidad
      });
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: [`/api/representative/dashboard/${effectiveUserId}`] });
      queryClient.invalidateQueries({ queryKey: ['/api/membership-types/public'] });
      setIsChangePlanModalOpen(false);
      setShowPlanConfirmation(false);
      setSelectedNewPlan(null);

      const fechaVencimiento = data?.effectiveDate
        ? format(new Date(data.effectiveDate), "dd/MM/yyyy", { locale: es })
        : "tu fecha de vencimiento";

      toast({
        title: "Plan cambiado exitosamente",
        description: `Tu cambio al plan ${data?.pendingPlanName ?? ""} ha sido programado. Continuarás con tu plan actual hasta el ${fechaVencimiento}. El nuevo plan se aplicará en tu próxima facturación.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error al cambiar plan",
        description: error.message || "No se pudo cambiar el plan. Inténtalo de nuevo.",
        variant: "destructive",
      });
    },
  });

  const cancelScheduledChangeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/companies/${primaryCompany?.id}/cancel-scheduled-change`, {});
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/representative/dashboard/${effectiveUserId}`] });
      toast({
        title: "Cambio de plan cancelado",
        description: "Seguirás con tu plan actual. No se aplicará ningún cambio.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error al cancelar el cambio",
        description: error.message || "No se pudo cancelar el cambio. Inténtalo de nuevo.",
        variant: "destructive",
      });
    },
  });


  // Helper functions for plan comparison
  const isPlanUpgrade = (currentPlan: any, targetPlan: any) => {
    const currentPrice = currentPlan?.precioMensual || 0;
    const targetPrice = targetPlan?.precioMensual || 0;
    return targetPrice > currentPrice;
  };

  const isPlanDowngrade = (currentPlan: any, targetPlan: any) => {
    const currentPrice = currentPlan?.precioMensual || 0;
    const targetPrice = targetPlan?.precioMensual || 0;
    return targetPrice < currentPrice;
  };

  const getUpgradeMotivation = (targetPlan: any) => {
    return [
      "🚀 Acceso a funciones Premium exclusivas",
      "📈 Mayor visibilidad en el directorio",
      "🎯 Herramientas avanzadas de marketing",
      "⭐ Soporte prioritario 24/7",
      "💼 Más proyectos y productos permitidos"
    ];
  };

  const getDowngradeLimitations = (currentPlan: any, targetPlan: any) => {
    const limitations = [];
    
    if (currentPlan?.cantidadProductosAdmitidos > targetPlan?.cantidadProductosAdmitidos) {
      limitations.push(`🔴 Productos: Máximo ${targetPlan?.cantidadProductosAdmitidos || 0} (actualmente tienes ${currentPlan?.cantidadProductosAdmitidos || 0})`);
    }
    
    if (currentPlan?.cantidadProyectosAdmitidos > targetPlan?.cantidadProyectosAdmitidos) {
      limitations.push(`🔴 Proyectos: Máximo ${targetPlan?.cantidadProyectosAdmitidos || 0} (actualmente tienes ${currentPlan?.cantidadProyectosAdmitidos || 0})`);
    }
    
    if (currentPlan?.cantidadFotosPorProyecto > targetPlan?.cantidadFotosPorProyecto) {
      limitations.push(`🔴 Fotos por proyecto: Máximo ${targetPlan?.cantidadFotosPorProyecto || 5} (actualmente ${currentPlan?.cantidadFotosPorProyecto || 5})`);
    }
    
    return limitations;
  };

  const handlePlanSelection = (plan: any) => {
    if (!canChangePlan) return;
    setSelectedNewPlan(plan);
    setShowPlanConfirmation(true);
  };

  const handleConfirmPlanChange = () => {
    if (selectedNewPlan && canChangePlan) {
      changePlanMutation.mutate({
        targetPlanId: selectedNewPlan.id,
        periodicidad: selectedPeriodicidad
      });
    }
  };

  const getPlanPrice = (plan: any, periodicidad: string) => {
    const opcionesPrecios = Array.isArray(plan.opcionesPrecios) ? plan.opcionesPrecios : [];
    const precioOption = opcionesPrecios.find((op: any) => 
      op.periodicidad?.toLowerCase() === periodicidad.toLowerCase()
    );
    return precioOption ? precioOption.costo : plan.precioMensual;
  };

  const handleEditCertificate = (certificate: Certificate) => {
    setSelectedCertificate(certificate);
    setIsEditCertificateModalOpen(true);
  };

  const handleDeleteCertificate = async (certificateId: number) => {
    // Check if this is an admin-assigned certificate
    const certificate = typedCertificates.find(cert => cert.id === certificateId);
    if (certificate) {
      const adminCertificateNames = [
        "Miembro Oficial ANPR México 2025",
        "Certificación ANPR",
        "Miembro Activo ANPR",
        "Reconocimiento ANPR"
      ];
      
      const isAdminCertificate = adminCertificateNames.some(name => 
        certificate.nombreCertificado.toLowerCase().includes(name.toLowerCase())
      );
      
      if (isAdminCertificate) {
        await Swal.fire({
          title: 'Certificado protegido',
          text: 'Este certificado fue asignado por ANPR y no puede ser eliminado',
          icon: 'warning',
          confirmButtonText: 'Entendido'
        });
        return;
      }
    }

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

  const handleEditProject = (project: ProjectWithDetails) => {
    setSelectedProject(project);
    setIsEditProjectModalOpen(true);
  };

  const handleDeleteProject = async (projectId: number) => {
    const result = await Swal.fire({
      title: '¿Estás seguro?',
      text: 'Esta acción eliminará el proyecto permanentemente',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true
    });

    if (result.isConfirmed) {
      deleteProjectMutation.mutate(projectId);
    }
  };

  const handleCancelPlan = async () => {
    const result = await Swal.fire({
      title: '¿Cancelar renovación?',
      text: 'Tu plan seguirá activo hasta la fecha de vencimiento. Solo se detendrá la renovación automática.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sí, cancelar renovación',
      cancelButtonText: 'No',
      reverseButtons: true
    });

    if (result.isConfirmed) {
      cancelPlanMutation.mutate();
    }
  };

  const handleResumePlan = () => {
    resumeMembershipMutation.mutate();
  };

  const handleViewInDirectory = () => {
    if (primaryCompany) {
      window.open(`/directorio/empresas/${primaryCompany.id}`, '_blank');
    } else {
      window.open('/directorio', '_blank');
    }
  };

  const exportPaymentHistory = () => {
    // Create CSV content
    const csvContent = [
      ['Fecha', 'Monto', 'Estado', 'Plan'],
      ...payments.map((payment: any) => [
        format(new Date(payment.createdAt), 'dd/MM/yyyy', { locale: es }),
        formatMoney(payment.amount, payment.currency),
        payment.status === 'succeeded' ? 'Exitoso' : payment.status,
        currentMembership?.nombrePlan || 'N/A'
      ])
    ].map(row => row.join(',')).join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `historial_pagos_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Download individual payment receipt as PDF
  const downloadPaymentReceipt = async (payment: any) => {
    const membershipType = typedMembershipTypes.find((mt: any) => mt.id === payment.membershipTypeId);
    const paymentDate = format(new Date(payment.createdAt), 'dd/MM/yyyy HH:mm', { locale: es });
    const company = primaryCompany;

    try {
      // Import jsPDF dynamically
      const { jsPDF } = await import('jspdf');
      
      // Create new PDF document
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      // Set font
      pdf.setFont('helvetica');
      
      // Header section
      pdf.setFillColor(188, 206, 22); // #bcce16
      pdf.rect(0, 0, 210, 30, 'F');
      
      // Company name
      pdf.setFontSize(22);
      pdf.setTextColor(0, 0, 0);
      pdf.text('ANPR México', 20, 20);
      
      // Subtitle
      pdf.setFontSize(10);
      pdf.setTextColor(80, 80, 80);
      pdf.text('Asociación Nacional de Profesionales en Relaciones Públicas', 20, 26);
      
      // Receipt title and number
      pdf.setFontSize(20);
      pdf.setTextColor(0, 0, 0);
      pdf.text('RECIBO', 150, 20);
      
      pdf.setFontSize(10);
      pdf.setTextColor(80, 80, 80);
      pdf.text(`# ${payment.id}`, 150, 26);
      pdf.text(paymentDate, 150, 30);
      
      // Customer information section
      let yPos = 50;
      pdf.setFillColor(247, 250, 252); // #f7fafc
      pdf.rect(20, yPos, 170, 40, 'F');
      
      pdf.setFontSize(14);
      pdf.setTextColor(45, 55, 72);
      pdf.text('Información del Cliente', 25, yPos + 10);
      
      pdf.setFontSize(10);
      pdf.setTextColor(74, 85, 104);
      
      // Left column
      pdf.text('Empresa:', 25, yPos + 20);
      pdf.setTextColor(45, 55, 72);
      pdf.text(company?.nombreEmpresa || 'N/A', 25, yPos + 25);
      
      pdf.setTextColor(74, 85, 104);
      pdf.text('Email:', 25, yPos + 32);
      pdf.setTextColor(45, 55, 72);
      pdf.text(company?.email1 || 'N/A', 25, yPos + 37);
      
      // Right column
      pdf.setTextColor(74, 85, 104);
      pdf.text('Plan contratado:', 110, yPos + 20);
      pdf.setTextColor(45, 55, 72);
      pdf.text(membershipType?.nombrePlan || 'Plan básico', 110, yPos + 25);
      
      pdf.setTextColor(74, 85, 104);
      pdf.text('Estado:', 110, yPos + 32);
      pdf.setTextColor(45, 55, 72);
      const statusText = payment.status === 'succeeded' ? 'Exitoso' : 
                        payment.status === 'pending' ? 'Pendiente' : 'Fallido';
      pdf.text(statusText, 110, yPos + 37);
      
      // Amount section
      yPos += 60;
      pdf.setFillColor(188, 206, 22); // #bcce16
      pdf.rect(20, yPos, 170, 25, 'F');
      
      pdf.setFontSize(12);
      pdf.setTextColor(0, 0, 0);
      pdf.text('MONTO TOTAL PAGADO', 105, yPos + 8, { align: 'center' });
      
      pdf.setFontSize(24);
      const amountText = formatMoney(payment.amount, payment.currency);
      pdf.text(amountText, 105, yPos + 20, { align: 'center' });
      
      // Transaction details
      yPos += 40;
      pdf.setFillColor(247, 250, 252); // #f7fafc
      pdf.rect(20, yPos, 170, 30, 'F');
      
      pdf.setFontSize(12);
      pdf.setTextColor(45, 55, 72);
      pdf.text('Detalles de la Transacción', 25, yPos + 10);
      
      pdf.setFontSize(10);
      pdf.setTextColor(74, 85, 104);
      pdf.text('ID de transacción:', 25, yPos + 18);
      pdf.setTextColor(45, 55, 72);
      pdf.text(payment.stripePaymentIntentId || 'N/A', 25, yPos + 23);
      
      pdf.setTextColor(74, 85, 104);
      pdf.text('Teléfono:', 110, yPos + 18);
      pdf.setTextColor(45, 55, 72);
      pdf.text(company?.telefono1 || 'N/A', 110, yPos + 23);
      
      // Service description
      yPos += 45;
      pdf.setFillColor(247, 250, 252); // #f7fafc
      pdf.rect(20, yPos, 170, 35, 'F');
      
      pdf.setFontSize(12);
      pdf.setTextColor(45, 55, 72);
      pdf.text('Descripción del Servicio', 25, yPos + 10);
      
      pdf.setFontSize(10);
      pdf.setTextColor(45, 55, 72);
      const serviceDescription = membershipType?.beneficios || 'Servicios de membresía empresarial en el directorio ANPR México.';
      
      // Split long text into multiple lines
      const lines = pdf.splitTextToSize(serviceDescription, 160);
      let lineY = yPos + 18;
      lines.forEach((line: string) => {
        if (lineY < yPos + 30) { // Keep within the box
          pdf.text(line, 25, lineY);
          lineY += 5;
        }
      });
      
      // Footer
      yPos += 50;
      pdf.setDrawColor(226, 232, 240); // #e2e8f0
      pdf.line(20, yPos, 190, yPos);
      
      pdf.setFontSize(9);
      pdf.setTextColor(113, 128, 150);
      const currentDate = format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es });
      pdf.text(`Este recibo fue generado automáticamente el ${currentDate}`, 105, yPos + 8, { align: 'center' });
      pdf.text('ANPR México - Directorio Empresarial | www.anpr.org.mx', 105, yPos + 15, { align: 'center' });
      
      // Save the PDF
      const fileName = `recibo-pago-${payment.id}-${format(new Date(payment.createdAt), 'yyyy-MM-dd')}.pdf`;
      pdf.save(fileName);
      
      toast({
        title: "Recibo descargado",
        description: "El recibo de pago PDF se ha descargado correctamente",
      });
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Error",
        description: "No se pudo generar el recibo PDF",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Panel del Representante</h1>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-gray-600">
              Bienvenido, {user?.displayName || user?.email}
            </p>
            {!impersonatedCompany && (dashboardCompanies?.length ?? 0) > 1 && primaryCompany && (
              <div className="flex items-center gap-2">
                <label htmlFor="representative-company-selector" className="text-sm font-medium text-gray-700">
                  Empresa que estás gestionando:
                </label>
                <Select
                  value={String(primaryCompany.id)}
                  onValueChange={(value) => {
                    const companyId = Number(value);
                    if (!Number.isInteger(companyId)) return;
                    setSelectedCompanyId(companyId);
                    setSelectedCertificate(null);
                    setSelectedProject(null);
                    setIsEditCertificateModalOpen(false);
                    setIsEditProjectModalOpen(false);
                  }}
                >
                  <SelectTrigger id="representative-company-selector" className="w-[260px]">
                    <SelectValue placeholder="Selecciona una empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {dashboardCompanies!.map((company) => (
                      <SelectItem key={company.id} value={String(company.id)}>
                        {company.nombreEmpresa || `Empresa #${company.id}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(tab) => {
            if (allowedTabs.includes(tab)) setActiveTab(tab);
          }}
        >
          <TabsList className={`grid w-full ${restrictWordPressRepresentative ? "grid-cols-6" : "grid-cols-7"} mb-8`}>
            <TabsTrigger value="overview">
              <BarChart3 className="h-4 w-4 mr-2" />
              Resumen
            </TabsTrigger>
            <TabsTrigger value="company">
              <Building className="h-4 w-4 mr-2" />
              Mi Empresa
            </TabsTrigger>
            <TabsTrigger value="projects">
              <Briefcase className="h-4 w-4 mr-2" />
              Proyectos
            </TabsTrigger>
            <TabsTrigger value="certificates">
              <Award className="h-4 w-4 mr-2" />
              Certificados
            </TabsTrigger>
            <TabsTrigger value="membership">
              <Crown className="h-4 w-4 mr-2" />
              Mi Plan
            </TabsTrigger>
            {!restrictWordPressRepresentative && (
              <TabsTrigger value="payments">
                <CreditCard className="h-4 w-4 mr-2" />
                Pagos
              </TabsTrigger>
            )}
            <TabsTrigger value="review">
              <MessageSquare className="h-4 w-4 mr-2" />
              Mi Reseña
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Empresa Activa</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {primaryCompany ? '1' : '0'}
                      </p>
                    </div>
                    <Building className="h-8 w-8 text-[#bcce16]" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Plan Actual</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {currentMembership?.nombrePlan || 'Sin plan'}
                      </p>
                    </div>
                    <Crown className="h-8 w-8 text-[#bcce16]" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Estado</p>
                      <Badge variant={primaryCompany?.estado === 'activo' ? 'default' : 'secondary'}>
                        {primaryCompany?.estado === 'activo' ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </div>
                    <Check className="h-8 w-8 text-[#bcce16]" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Vencimiento</p>
                      <p className="text-sm font-medium text-gray-900">
                        {primaryCompany?.fechaFinMembresia 
                          ? format(new Date(primaryCompany.fechaFinMembresia), 'dd/MM/yyyy', { locale: es })
                          : 'N/A'
                        }
                      </p>
                    </div>
                    <Calendar className="h-8 w-8 text-[#bcce16]" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Membership Limits Display */}
            {primaryCompany && (primaryCompany as any).membershipType && (
              <div className="mb-6">
                <MembershipLimitsDisplay
                  membershipType={(primaryCompany as any).membershipType}
                  productCount={Array.isArray((primaryCompany as any).galeriaProductosUrls) ? (primaryCompany as any).galeriaProductosUrls.length : 0}
                  projectCount={typedProjects.length}
                />
              </div>
            )}

            {/* Welcome Card */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Bienvenido a tu Panel de Representante</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">
                  Desde aquí puedes gestionar toda la información de tu empresa, proyectos, certificados y plan de membresía.
                </p>
                <div className="flex gap-3">
                  <Button
                    onClick={() => setActiveTab('company')}
                    className="bg-[#bcce16] hover:bg-[#a8b814] text-black"
                  >
                    <Building className="h-4 w-4 mr-2" />
                    Ver Mi Empresa
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setActiveTab('membership')}
                  >
                    <Crown className="h-4 w-4 mr-2" />
                    Gestionar Plan
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Company Management Tab - Using dedicated representative component */}
          <TabsContent value="company">
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Montserrat', fontWeight: 700 }}>
                  Mi Empresa
                </h2>
                <p className="text-gray-600 mt-2">
                  Gestiona la información básica de tu empresa
                </p>
              </div>
              
              {primaryCompany ? (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                    <CardTitle className="text-xl font-semibold">Información de la Empresa</CardTitle>
                    <Button
                      onClick={() => setIsEditCompanyModalOpen(true)}
                      className="bg-[#bcce16] hover:bg-[#a8b814] text-black"
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Editar Empresa
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-medium text-gray-900">Nombre de la Empresa</h4>
                        <p className="text-gray-600">{primaryCompany.nombreEmpresa}</p>
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">Teléfono</h4>
                        <p className="text-gray-600">{primaryCompany.telefono1 || 'No especificado'}</p>
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">Email</h4>
                        <p className="text-gray-600">{primaryCompany.email1 || 'No especificado'}</p>
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">Sitio Web</h4>
                        <p className="text-gray-600">{primaryCompany.sitioWeb || 'No especificado'}</p>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">Descripción</h4>
                      {primaryCompany.descripcionEmpresa ? (
                        <div
                          className="text-gray-600 prose prose-sm max-w-none [&_p]:my-1"
                          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(primaryCompany.descripcionEmpresa) }}
                        />
                      ) : (
                        <p className="text-gray-600">No especificada</p>
                      )}
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">Dirección</h4>
                      <p className="text-gray-600">{primaryCompany.direccionFisica || 'No especificada'}</p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="text-center py-12">
                    <Building className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No hay empresa registrada</h3>
                    <p className="text-gray-600 mb-4">Tu empresa debe ser registrada por un administrador del sistema</p>
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 max-w-md mx-auto">
                      <div className="flex items-center justify-center mb-2">
                        <AlertTriangle className="h-5 w-5 text-amber-600 mr-2" />
                        <span className="text-sm font-medium text-amber-800">Información importante</span>
                      </div>
                      <p className="text-sm text-amber-700 text-center">
                        Los representantes no pueden crear empresas directamente. 
                        Contacta al administrador para que registre tu empresa en el sistema.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Projects Tab */}
          <TabsContent value="projects">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Briefcase className="h-5 w-5" />
                    Gestión de Proyectos
                  </CardTitle>
                  <p className="text-gray-600">Administra el portafolio de proyectos de tu empresa</p>
                </div>
                {primaryCompany && (
                  <Button
                    onClick={() => setIsAddProjectModalOpen(true)}
                    className="bg-[#bcce16] hover:bg-[#a8b814] text-black"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Nuevo Proyecto
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {projectsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-gray-500">Cargando proyectos...</div>
                  </div>
                ) : typedProjects.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {typedProjects.map((project: ProjectWithDetails) => (
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
                          <div className="absolute top-3 right-3 flex gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleEditProject(project)}
                              className="bg-white/90 hover:bg-white"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteProject(project.id)}
                              disabled={deleteProjectMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        
                        {/* Información del proyecto */}
                        <div className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            <h3 className="font-semibold text-lg text-gray-900 line-clamp-1">
                              {project.nombreProyecto}
                            </h3>
                            <Badge variant={project.estado === 'publicado' ? 'default' : 'secondary'}>
                              {project.estado}
                            </Badge>
                          </div>
                          
                          {project.descripcionProyecto && (
                            <div 
                              className="text-gray-900 text-sm mb-3 line-clamp-2 [&_*]:!text-gray-900"
                              dangerouslySetInnerHTML={{ __html: project.descripcionProyecto }}
                            />
                          )}
                          
                          <div className="space-y-2 text-sm text-gray-500">
                            {project.clienteContratante && (
                              <div className="flex items-center gap-2">
                                <Building className="h-4 w-4" />
                                <span>{project.clienteContratante}</span>
                              </div>
                            )}
                            
                            {project.fechaInicio && (
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4" />
                                <span>{format(new Date(project.fechaInicio), 'MMM yyyy', { locale: es })}</span>
                              </div>
                            )}
                            
                            <div className="flex items-center gap-4 pt-2 border-t">
                              <div className="flex items-center gap-1">
                                <Eye className="h-4 w-4" />
                                <span>{project.vistas || 0}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold mb-2">Sin proyectos</h3>
                    <p className="text-gray-600 mb-6">
                      Agrega tu primer proyecto para mostrar tu portafolio
                    </p>
                    {primaryCompany && (
                      <Button 
                        onClick={() => setIsAddProjectModalOpen(true)}
                        className="bg-[#bcce16] hover:bg-[#a8b814] text-black"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Agregar Proyecto
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Certificates Tab - Using exact admin component */}
          <TabsContent value="certificates">
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
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-gray-500">Cargando certificados...</div>
                  </div>
                ) : (
                  <RepresentativeCertificateTable
                    certificates={typedCertificates}
                    onEdit={handleEditCertificate}
                    onDelete={handleDeleteCertificate}
                    userCompanyId={primaryCompany?.id}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Membership Tab */}
          <TabsContent value="membership">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="h-5 w-5" />
                  Plan de Membresía
                </CardTitle>
                <p className="text-gray-600">Información de tu plan actual</p>
              </CardHeader>
              <CardContent>
                {currentMembership && primaryCompany ? (
                  <div className="space-y-6">
                    <div className="bg-gradient-to-r from-[#bcce16]/10 to-[#bcce16]/5 p-6 rounded-lg border">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="text-xl font-bold text-gray-900">{currentMembership.nombrePlan}</h3>
                          <p className="text-gray-600">Plan actual</p>
                        </div>
                        <Badge className={isMembershipCancelled ? "bg-orange-100 text-orange-800" : "bg-[#bcce16] text-black"}>
                          {isMembershipCancelled ? "Cancelación programada" : "Activo"}
                        </Badge>
                      </div>

                      {isMembershipCancelled && (
                        <div className="mb-4 flex items-start gap-2 rounded-md border border-orange-200 bg-orange-50 p-3">
                          <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-orange-800">
                            La renovación automática está cancelada. Tu plan seguirá activo hasta el{' '}
                            {format(new Date(primaryCompany.fechaFinMembresia), 'dd/MM/yyyy', { locale: es })}. Puedes reanudarla cuando quieras.
                          </p>
                        </div>
                      )}

                      {hasScheduledChange && (
                        <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 p-4">
                          <div className="flex items-start gap-2 mb-3">
                            <RefreshCw className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="font-semibold text-blue-900">Cambio de plan programado</p>
                              <p className="text-sm text-blue-800">
                                Continuarás con tu plan actual hasta la fecha del cambio. El nuevo plan se aplicará en tu próxima facturación.
                              </p>
                            </div>
                          </div>
                          {pendingPaymentFailed && (
                            <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 p-3">
                              <div className="flex items-start gap-2">
                                <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                                <p className="text-sm text-amber-800">
                                  El cobro de la renovación no se pudo completar. Tu plan actual sigue vigente sin cambios. Intentaremos cobrarlo de nuevo automáticamente; cuando el pago se confirme, el nuevo plan se activará.
                                </p>
                              </div>
                            </div>
                          )}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                            <div>
                              <p className="text-xs text-blue-700">Plan actual</p>
                              <p className="font-semibold text-blue-900">{currentMembership?.nombrePlan || '—'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-blue-700">Próximo plan</p>
                              <p className="font-semibold text-blue-900">{pendingPlan?.nombrePlan || '—'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-blue-700">Se aplicará el</p>
                              <p className="font-semibold text-blue-900">
                                {pendingEffectiveDate
                                  ? format(new Date(pendingEffectiveDate), 'dd/MM/yyyy', { locale: es })
                                  : '—'}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-blue-700">Periodicidad</p>
                              <p className="font-semibold text-blue-900 capitalize">{pendingPeriodicidad || '—'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-blue-700">Precio próxima renovación</p>
                              <p className="font-semibold text-blue-900">
                                {pendingPrice != null ? formatMoney(pendingPrice) : '—'}
                                {pendingPeriodicidad ? `/${pendingPeriodicidad === 'anual' ? 'año' : 'mes'}` : ''}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => cancelScheduledChangeMutation.mutate()}
                            disabled={cancelScheduledChangeMutation.isPending}
                            className="border-blue-300 text-blue-800 hover:bg-blue-100"
                            data-testid="button-cancel-scheduled-change"
                          >
                            <X className="h-4 w-4 mr-2" />
                            Cancelar cambio programado
                          </Button>
                        </div>
                      )}
                      
                      <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-4">
                        <div>
                          <p className="text-sm text-gray-500">Periodicidad</p>
                          <p className="font-semibold">{primaryCompany.membershipPeriodicidad}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Inicio</p>
                          <p className="font-semibold">
                            {format(new Date(primaryCompany.fechaInicioMembresia), 'dd/MM/yyyy', { locale: es })}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Vencimiento</p>
                          <p className="font-semibold">
                            {format(new Date(primaryCompany.fechaFinMembresia), 'dd/MM/yyyy', { locale: es })}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Productos Permitidos</p>
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {(currentMembership.cantidadProductosAdmitidos === -1 || currentMembership.cantidadProductosAdmitidos == null) ? 'Ilimitado' : currentMembership.cantidadProductosAdmitidos}
                            </span>
                          </div>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Proyectos Permitidos</p>
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              {(currentMembership.cantidadProyectosAdmitidos === -1 || currentMembership.cantidadProyectosAdmitidos == null) ? 'Ilimitado' : currentMembership.cantidadProyectosAdmitidos}
                            </span>
                          </div>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Fotos por Proyecto</p>
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                              {(currentMembership.cantidadFotosPorProyecto === -1 || currentMembership.cantidadFotosPorProyecto == null) ? 'Ilimitado' : currentMembership.cantidadFotosPorProyecto}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Benefits */}
                    <div>
                      <h4 className="font-semibold mb-3">Beneficios incluidos:</h4>
                      <div className="space-y-2">
                        {(Array.isArray(currentMembership.beneficios) 
                          ? currentMembership.beneficios 
                          : currentMembership.beneficios?.split('\n') || []
                        ).map((benefit: string, index: number) => (
                          <div key={index} className="flex items-start gap-2">
                            <div className="w-2 h-2 rounded-full bg-[#bcce16] mt-2 flex-shrink-0" />
                            <p className="text-gray-700">{benefit}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-3 pt-4 border-t">
                      <Button variant="outline" onClick={handleViewInDirectory}>
                        <Eye className="h-4 w-4 mr-2" />
                        Ver en Directorio
                      </Button>
                      {isMembershipCancelled ? (
                        <Button
                          onClick={handleResumePlan}
                          disabled={resumeMembershipMutation.isPending}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Reanudar plan
                        </Button>
                      ) : (
                        <>
                          {canChangePlan && (
                            <Button
                              variant="outline"
                              onClick={() => setIsChangePlanModalOpen(true)}
                            >
                              <Crown className="h-4 w-4 mr-2" />
                              Cambiar Plan
                            </Button>
                          )}
                          <Button 
                            variant="destructive" 
                            onClick={handleCancelPlan}
                            disabled={cancelPlanMutation.isPending}
                          >
                            <X className="h-4 w-4 mr-2" />
                            Cancelar Plan
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Crown className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold mb-2">Sin plan activo</h3>
                    <p className="text-gray-600">No se encontró información del plan</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments">
            <div className="space-y-6">
            {primaryCompany?.id && <PaymentMethodCard companyId={primaryCompany.id} />}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Historial de Pagos
                </CardTitle>
                <p className="text-gray-600">Historial completo de transacciones</p>
              </CardHeader>
              <CardContent>
                {payments.length > 0 ? (
                  <div className="space-y-6">
                    {/* Payment Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                        <div className="flex items-center gap-2">
                          <Check className="h-5 w-5 text-green-600" />
                          <span className="text-sm font-medium text-green-800">Pagos Exitosos</span>
                        </div>
                        <p className="text-2xl font-bold text-green-900 mt-1">
                          {payments.filter((p: any) => p.status === 'succeeded').length}
                        </p>
                      </div>
                      
                      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-5 w-5 text-blue-600" />
                          <span className="text-sm font-medium text-blue-800">Total Pagado</span>
                        </div>
                        <p className="text-2xl font-bold text-blue-900 mt-1">
                          {formatMoney(payments
                            .filter((p: any) => p.status === 'succeeded')
                            .reduce((sum: number, p: any) => sum + (parseFloat(p.amount) || 0), 0))}
                        </p>
                      </div>
                      
                      <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-5 w-5 text-purple-600" />
                          <span className="text-sm font-medium text-purple-800">Último Pago</span>
                        </div>
                        <p className="text-lg font-semibold text-purple-900 mt-1">
                          {payments.length > 0 ? 
                            format(new Date(payments[0].createdAt), 'dd/MM/yyyy', { locale: es }) : 
                            'N/A'
                          }
                        </p>
                      </div>
                    </div>

                    {/* Payment History Table */}
                    <div className="border rounded-lg overflow-hidden">
                      <div className="bg-gray-50 px-6 py-3 border-b flex justify-between items-center">
                        <h3 className="font-semibold text-gray-900">Transacciones</h3>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={exportPaymentHistory}
                          className="gap-2"
                        >
                          <Download className="h-4 w-4" />
                          Exportar CSV
                        </Button>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Fecha
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Monto
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Estado
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Plan
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Acciones
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {payments.map((payment: any, index: number) => (
                              <tr key={payment.id || index}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {format(new Date(payment.createdAt), 'dd/MM/yyyy HH:mm', { locale: es })}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                  {formatMoney(payment.amount, payment.currency)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <Badge 
                                    variant={payment.status === 'succeeded' ? 'default' : 
                                            payment.status === 'pending' ? 'secondary' : 'destructive'}
                                  >
                                    {payment.status === 'succeeded' ? 'Exitoso' : 
                                     payment.status === 'pending' ? 'Pendiente' : 'Fallido'}
                                  </Badge>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                  {typedMembershipTypes.find((mt: any) => mt.id === payment.membershipTypeId)?.nombrePlan || 'Plan básico'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => downloadPaymentReceipt(payment)}
                                    className="gap-2"
                                  >
                                    <Download className="h-4 w-4" />
                                    Descargar PDF
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <CreditCard className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold mb-2">Sin historial de pagos</h3>
                    <p className="text-gray-600">No se han registrado pagos en tu cuenta</p>
                  </div>
                )}
              </CardContent>
            </Card>
            </div>
          </TabsContent>

          {/* Review Tab */}
          <TabsContent value="review">
            <RepresentativeReview />
          </TabsContent>
        </Tabs>

        {/* Modals - Using exact admin modals */}
        <AddCertificateModal
          open={isAddCertificateModalOpen}
          onOpenChange={setIsAddCertificateModalOpen}
          companyId={primaryCompany?.id}
        />

        <EditCertificateModal
          open={isEditCertificateModalOpen}
          onOpenChange={setIsEditCertificateModalOpen}
          certificate={selectedCertificate}
        />


        {primaryCompany && (
          <>
            <AddProjectModal
              open={isAddProjectModalOpen}
              onOpenChange={setIsAddProjectModalOpen}
              companyId={primaryCompany.id}
            />

            {selectedProject && isEditProjectModalOpen && (
              <EditProjectModal
                open={isEditProjectModalOpen}
                onOpenChange={setIsEditProjectModalOpen}
                project={selectedProject}
                companyId={primaryCompany.id}
              />
            )}
          </>
        )}

        {/* Plan Change Modal */}
        <Dialog open={canChangePlan && isChangePlanModalOpen} onOpenChange={setIsChangePlanModalOpen}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            {!showPlanConfirmation ? (
              <>
                <DialogHeader>
                  <DialogTitle>Cambiar Plan de Membresía</DialogTitle>
                  <DialogDescription>
                    Selecciona un nuevo plan para tu empresa
                  </DialogDescription>
                </DialogHeader>
                
                {/* Periodicidad Selector */}
                <div className="mb-6">
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Periodicidad de pago:
                  </label>
                  <Select 
                    value={selectedPeriodicidad} 
                    onValueChange={(value: "mensual" | "anual") => setSelectedPeriodicidad(value)}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mensual">Mensual</SelectItem>
                      <SelectItem value="anual">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 py-6">
                  {typedMembershipTypes.map((plan: any) => {
                    const planPrice = getPlanPrice(plan, selectedPeriodicidad);
                    const isCurrentPlan = plan.id === currentMembership?.id;
                    const isUpgrade = isPlanUpgrade(currentMembership, plan);
                    const isDowngrade = isPlanDowngrade(currentMembership, plan);
                    
                    return (
                      <div 
                        key={plan.id} 
                        className={`border rounded-lg p-6 cursor-pointer transition-all hover:shadow-md relative ${
                          isCurrentPlan ? 'border-[#bcce16] bg-[#bcce16]/5' : 'border-gray-200'
                        } ${isUpgrade ? 'border-green-300 bg-green-50' : ''} ${isDowngrade ? 'border-orange-300 bg-orange-50' : ''}`}
                      >
                        {/* Upgrade/Downgrade indicator */}
                        {isUpgrade && (
                          <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                            <span className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-medium">
                              ✨ UPGRADE
                            </span>
                          </div>
                        )}
                        {isDowngrade && (
                          <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                            <span className="bg-orange-500 text-white px-3 py-1 rounded-full text-xs font-medium">
                              ⚠️ DOWNGRADE
                            </span>
                          </div>
                        )}
                        
                        <div className="text-center">
                          <h3 className="font-bold text-xl mb-2">{plan.nombrePlan}</h3>
                          <div className="text-3xl font-bold text-[#bcce16] mb-4">
                            {formatMoney(planPrice)}
                            <span className="text-sm text-gray-500 font-normal">/{selectedPeriodicidad === 'anual' ? 'año' : 'mes'}</span>
                          </div>
                          
                          {/* Plan limits */}
                          <div className="space-y-2 text-sm mb-4 bg-gray-50 p-3 rounded-lg">
                            <div className="flex justify-between">
                              <span>Productos:</span>
                              <span className="font-medium">{plan.cantidadProductosAdmitidos === -1 ? '∞' : plan.cantidadProductosAdmitidos}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Proyectos:</span>
                              <span className="font-medium">{plan.cantidadProyectosAdmitidos === -1 ? '∞' : plan.cantidadProyectosAdmitidos}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Fotos/proyecto:</span>
                              <span className="font-medium">{plan.cantidadFotosPorProyecto === -1 ? '∞' : plan.cantidadFotosPorProyecto}</span>
                            </div>
                          </div>
                          
                          <div className="space-y-2 text-sm text-gray-600 mb-6">
                            {(Array.isArray(plan.beneficios) 
                              ? plan.beneficios 
                              : plan.beneficios?.split('\n') || []
                            ).slice(0, 4).map((benefit: string, index: number) => (
                              <div key={index} className="flex items-start gap-2">
                                <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                                <span>{benefit}</span>
                              </div>
                            ))}
                          </div>
                          
                          {isCurrentPlan ? (
                            <Badge className="bg-[#bcce16] text-black">Plan Actual</Badge>
                          ) : (
                            <Button 
                              className="w-full bg-[#bcce16] hover:bg-[#a8b814] text-black"
                              onClick={() => handlePlanSelection(plan)}
                              data-testid={`button-select-plan-${plan.id}`}
                            >
                              {isUpgrade ? '⬆️ Upgrade a ' : isDowngrade ? '⬇️ Cambiar a ' : 'Seleccionar '}
                              {plan.nombrePlan}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>
                    {isPlanUpgrade(currentMembership, selectedNewPlan) ? '🚀 ¡Upgrade tu Plan!' : '⚠️ Confirmar Cambio de Plan'}
                  </DialogTitle>
                  <DialogDescription>
                    {isPlanUpgrade(currentMembership, selectedNewPlan) 
                      ? 'Estás a punto de actualizar a un plan superior'
                      : 'Revisa los cambios antes de confirmar'
                    }
                  </DialogDescription>
                </DialogHeader>

                <div className="py-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Current Plan */}
                    <div className="border rounded-lg p-4">
                      <h4 className="font-semibold mb-2 text-gray-700">Plan Actual</h4>
                      <div className="space-y-2">
                        <p className="font-bold text-lg">{currentMembership?.nombrePlan}</p>
                        <p className="text-2xl font-bold text-gray-600">
                          {formatMoney(getPlanPrice(currentMembership, currentMembership?.periodicidad || selectedPeriodicidad))}
                          /{currentMembership?.periodicidad === 'anual' ? 'año' : 'mes'}
                        </p>
                      </div>
                    </div>

                    {/* New Plan */}
                    <div className="border rounded-lg p-4 border-[#bcce16] bg-[#bcce16]/5">
                      <h4 className="font-semibold mb-2 text-[#bcce16]">Nuevo Plan</h4>
                      <div className="space-y-2">
                        <p className="font-bold text-lg">{selectedNewPlan?.nombrePlan}</p>
                        <p className="text-2xl font-bold text-[#bcce16]">
                          {formatMoney(getPlanPrice(selectedNewPlan, selectedPeriodicidad))}
                          /{selectedPeriodicidad === 'anual' ? 'año' : 'mes'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Upgrade Benefits or Downgrade Warnings */}
                  {isPlanUpgrade(currentMembership, selectedNewPlan) ? (
                    <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
                      <h4 className="font-semibold text-green-800 mb-3">🎉 ¡Beneficios de tu upgrade!</h4>
                      <div className="space-y-2">
                        {getUpgradeMotivation(selectedNewPlan).map((benefit, index) => (
                          <div key={index} className="flex items-start gap-2 text-green-700">
                            <span>{benefit}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : isPlanDowngrade(currentMembership, selectedNewPlan) ? (
                    <div className="mt-6 bg-orange-50 border border-orange-200 rounded-lg p-4">
                      <h4 className="font-semibold text-orange-800 mb-3">⚠️ Limitaciones del nuevo plan</h4>
                      <div className="space-y-2">
                        {getDowngradeLimitations(currentMembership, selectedNewPlan).map((limitation, index) => (
                          <div key={index} className="flex items-start gap-2 text-orange-700">
                            <span>{limitation}</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 p-3 bg-orange-100 rounded border">
                        <p className="text-sm text-orange-800">
                          <strong>Nota:</strong> El cambio es programado: seguirás con tu plan actual hasta el vencimiento
                          y el nuevo plan se aplicará en tu próxima facturación. Tus datos existentes no se borran; en el
                          directorio público solo se mostrará hasta el límite del plan activo.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="font-semibold text-blue-800 mb-3">ℹ️ Información del cambio</h4>
                      <p className="text-blue-700">
                        El cambio es programado: seguirás con tu plan actual hasta el vencimiento y el nuevo plan
                        se aplicará en tu próxima facturación.
                      </p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-4 mt-6">
                    <Button 
                      variant="outline" 
                      onClick={() => setShowPlanConfirmation(false)}
                      className="flex-1"
                    >
                      ← Volver a planes
                    </Button>
                    <Button 
                      onClick={handleConfirmPlanChange}
                      disabled={changePlanMutation.isPending}
                      className={`flex-1 ${
                        isPlanUpgrade(currentMembership, selectedNewPlan) 
                          ? 'bg-green-600 hover:bg-green-700' 
                          : 'bg-[#bcce16] hover:bg-[#a8b814] text-black'
                      }`}
                      data-testid="button-confirm-plan-change"
                    >
                      {changePlanMutation.isPending ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          Procesando...
                        </div>
                      ) : (
                        <>
                          {isPlanUpgrade(currentMembership, selectedNewPlan) ? '🚀 ¡Confirmar Upgrade!' : '✅ Confirmar Cambio'}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Company Modal */}
        <EditCompanyModal
          open={isEditCompanyModalOpen}
          onOpenChange={setIsEditCompanyModalOpen}
          company={primaryCompany}
          userRole="representante"
        />
      </div>
    </div>
  );
}