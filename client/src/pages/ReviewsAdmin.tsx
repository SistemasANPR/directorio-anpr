import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Eye, Check, X, Trash2, Search, Star, MessageSquare, User, Calendar, Building } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

interface Review {
  id: number;
  comentario: string;
  calificacion: number;
  estado: string;
  tipo: string;
  companyId: number | null;
  userId: number;
  nombre: string;
  email: string;
  cargo?: string;
  approvedBy: number | null;
  fechaCreacion: string;
  fechaAprobacion?: string;
  createdAt: string;
  updatedAt: string;
  company?: {
    id: number;
    nombreEmpresa: string;
  };
  user?: {
    id: number;
    displayName: string;
    email: string;
  };
  approver?: {
    id: number;
    displayName: string;
  };
}

interface ReviewsResponse {
  opinions: Review[];
  total: string | number;
}

interface CompaniesResponse {
  companies: Array<{
    id: number;
    nombreEmpresa: string;
  }>;
}

export default function ReviewsAdmin() {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [calificationFilter, setCalificationFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch all reviews unless an explicit review type is selected.
  const { data: reviewsData, isLoading } = useQuery<ReviewsResponse>({
    queryKey: ['/api/opinions', { 
      page: currentPage, 
      limit: pageSize,
      search: searchTerm,
      estado: statusFilter !== "all" ? statusFilter : undefined,
      calificacion: calificationFilter !== "all" ? calificationFilter : undefined,
      tipo: typeFilter !== "all" ? typeFilter : undefined
    }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: pageSize.toString()
      });
      
      if (searchTerm) params.append('search', searchTerm);
      if (typeFilter !== "all") params.append('tipo', typeFilter);
      if (statusFilter !== "all") params.append('estado', statusFilter);
      if (calificationFilter !== "all") params.append('calificacion', calificationFilter);
      
      const response = await apiRequest("GET", `/api/opinions?${params}`);
      return response.json();
    },
  });

  // Moderate review mutation
  const moderateReviewMutation = useMutation({
    mutationFn: async ({ id, estado }: { id: number; estado: string }) => {
      const response = await apiRequest("PATCH", `/api/opinions/${id}/moderate`, { estado });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/opinions'] });
      toast({
        title: "Reseña moderada",
        description: "La reseña ha sido moderada exitosamente.",
      });
      setSelectedReview(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo moderar la reseña. Intenta nuevamente.",
        variant: "destructive",
      });
    },
  });

  // Delete review mutation
  const deleteReviewMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/opinions/${id}`);
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/opinions'] });
      toast({
        title: "Reseña eliminada",
        description: "La reseña ha sido eliminada exitosamente.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo eliminar la reseña. Intenta nuevamente.",
        variant: "destructive",
      });
    },
  });

  const reviews = reviewsData?.opinions || [];
  const shouldLoadCompanies = reviews.some(
    (review) => review.tipo === "empresa" && review.companyId && !review.company?.nombreEmpresa,
  );
  const { data: companiesData } = useQuery<CompaniesResponse>({
    queryKey: ["/api/companies", { limit: 1000 }],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/companies?limit=1000");
      return response.json();
    },
    enabled: shouldLoadCompanies,
    staleTime: 5 * 60 * 1000,
  });
  const companyNames = new Map(
    (companiesData?.companies || []).map((company) => [company.id, company.nombreEmpresa]),
  );
  const totalReviews = Number(reviewsData?.total) || 0;
  const totalPages = Math.ceil(totalReviews / pageSize);

  const getStatusBadge = (estado: string) => {
    switch (estado) {
      case "pendiente":
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Pendiente</Badge>;
      case "aprobada":
        return <Badge variant="default" className="bg-green-100 text-green-800">Aprobada</Badge>;
      case "rechazada":
        return <Badge variant="destructive" className="bg-red-100 text-red-800">Rechazada</Badge>;
      default:
        return <Badge variant="outline">{estado}</Badge>;
    }
  };

  const getTypeBadge = (tipo: string) => {
    if (tipo === "empresa") {
      return <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-800">Empresa</Badge>;
    }
    if (tipo === "plataforma") {
      return <Badge variant="outline" className="border-purple-200 bg-purple-50 text-purple-800">Plataforma</Badge>;
    }
    return <Badge variant="outline">{tipo}</Badge>;
  };

  const getCompanyName = (review: Review) =>
    review.company?.nombreEmpresa ||
    (review.companyId ? companyNames.get(review.companyId) : undefined);

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star 
        key={i} 
        className={`w-4 h-4 ${i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} 
      />
    ));
  };

  const handleApprove = (review: Review) => {
    moderateReviewMutation.mutate({
      id: review.id,
      estado: "aprobada"
    });
  };

  const handleReject = (review: Review) => {
    moderateReviewMutation.mutate({
      id: review.id,
      estado: "rechazada"
    });
  };

  const handleDelete = (reviewId: number) => {
    deleteReviewMutation.mutate(reviewId);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Gestión de Reseñas</h1>
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <MessageSquare className="w-4 h-4" />
          <span>Total: {totalReviews} reseñas</span>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtros de Búsqueda</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Buscar por comentario o usuario..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-10"
              />
            </div>

            <Select
              value={typeFilter}
              onValueChange={(value) => {
                setTypeFilter(value);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Tipo de reseña" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                <SelectItem value="empresa">De empresas</SelectItem>
                <SelectItem value="plataforma">De la plataforma</SelectItem>
              </SelectContent>
            </Select>
            
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="pendiente">Pendientes</SelectItem>
                <SelectItem value="aprobada">Aprobadas</SelectItem>
                <SelectItem value="rechazada">Rechazadas</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={calificationFilter}
              onValueChange={(value) => {
                setCalificationFilter(value);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Calificación" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las calificaciones</SelectItem>
                <SelectItem value="5">5 estrellas</SelectItem>
                <SelectItem value="4">4 estrellas</SelectItem>
                <SelectItem value="3">3 estrellas</SelectItem>
                <SelectItem value="2">2 estrellas</SelectItem>
                <SelectItem value="1">1 estrella</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex justify-end">
              <Button 
                onClick={() => {
                  setSearchTerm("");
                  setTypeFilter("all");
                  setStatusFilter("all");
                  setCalificationFilter("all");
                  setCurrentPage(1);
                }}
                variant="outline"
              >
                Limpiar Filtros
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reviews List */}
      <div className="grid gap-4">
        {isLoading ? (
          <Card>
            <CardContent className="p-6">
              <div className="text-center">Cargando reseñas...</div>
            </CardContent>
          </Card>
        ) : reviews.length === 0 ? (
          <Card>
            <CardContent className="p-6">
              <div className="text-center text-gray-500">
                No se encontraron reseñas con los filtros aplicados.
              </div>
            </CardContent>
          </Card>
        ) : (
          reviews.map((review) => (
            <Card key={review.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      {getTypeBadge(review.tipo)}
                      <div className="flex items-center space-x-2">
                        <User className="w-4 h-4 text-gray-500" />
                        <span className="font-medium">{review.nombre}</span>
                        <span className="text-sm text-gray-500">({review.email})</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        {renderStars(review.calificacion)}
                        <span className="text-sm text-gray-600 ml-2">
                          {review.calificacion}/5
                        </span>
                      </div>
                      {getStatusBadge(review.estado)}
                    </div>

                    {review.tipo === "empresa" && (
                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <Building className="w-4 h-4" />
                        <span>
                          Empresa: {getCompanyName(review) || `ID ${review.companyId ?? "no disponible"}`}
                        </span>
                      </div>
                    )}

                    <div className="bg-gray-50 p-3 rounded-lg">
                      <p className="text-gray-800">{review.comentario}</p>
                    </div>

                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-4 h-4" />
                        <span>
                          {format(new Date(review.fechaCreacion), "PPP", { locale: es })}
                        </span>
                      </div>
                      {review.approver && (
                        <span>
                          Moderada por: {review.approver.displayName}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedReview(review)}
                          title={`Ver detalle de reseña de ${review.tipo === "empresa" ? "empresa" : "la plataforma"}`}
                        >
                          <Eye className="w-4 h-4" />
                          <span className="sr-only">Ver detalle de reseña</span>
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>
                            Detalle de reseña de {selectedReview?.tipo === "empresa" ? "empresa" : "la plataforma"}
                          </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-sm font-medium text-gray-700">Usuario:</label>
                              <p className="text-sm">{selectedReview?.nombre} ({selectedReview?.email})</p>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-gray-700">Calificación:</label>
                              <div className="flex items-center space-x-1">
                                {selectedReview && renderStars(selectedReview.calificacion)}
                                <span className="text-sm ml-2">{selectedReview?.calificacion}/5</span>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-sm font-medium text-gray-700">Tipo:</label>
                              <div className="mt-1">
                                {selectedReview && getTypeBadge(selectedReview.tipo)}
                              </div>
                            </div>
                            {selectedReview?.tipo === "empresa" && (
                              <div>
                                <label className="text-sm font-medium text-gray-700">Empresa:</label>
                                <p className="text-sm mt-1">
                                  {getCompanyName(selectedReview) || `ID ${selectedReview.companyId ?? "no disponible"}`}
                                </p>
                              </div>
                            )}
                          </div>
                          
                          <div>
                            <label className="text-sm font-medium text-gray-700">Comentario:</label>
                            <p className="text-sm bg-gray-50 p-3 rounded mt-1">{selectedReview?.comentario}</p>
                          </div>

                          <div>
                            <label className="text-sm font-medium text-gray-700">Estado actual:</label>
                            <div className="mt-1">
                              {selectedReview && getStatusBadge(selectedReview.estado)}
                            </div>
                          </div>

                          {selectedReview?.estado === "pendiente" && (
                            <div className="flex space-x-2 pt-4">
                              <Button
                                onClick={() => selectedReview && handleApprove(selectedReview)}
                                disabled={moderateReviewMutation.isPending}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <Check className="w-4 h-4 mr-2" />
                                Aprobar
                              </Button>
                              <Button
                                onClick={() => selectedReview && handleReject(selectedReview)}
                                disabled={moderateReviewMutation.isPending}
                                variant="destructive"
                              >
                                <X className="w-4 h-4 mr-2" />
                                Rechazar
                              </Button>
                            </div>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>

                    {review.estado === "pendiente" && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedReview(review);
                            handleApprove(review);
                          }}
                          disabled={moderateReviewMutation.isPending}
                          className="border-green-600 text-green-600 hover:bg-green-50"
                          title={`Aprobar reseña de ${review.tipo === "empresa" ? "empresa" : "la plataforma"}`}
                        >
                          <Check className="w-4 h-4" />
                          <span className="sr-only">Aprobar reseña</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedReview(review);
                            handleReject(review);
                          }}
                          disabled={moderateReviewMutation.isPending}
                          className="border-red-600 text-red-600 hover:bg-red-50"
                          title={`Rechazar reseña de ${review.tipo === "empresa" ? "empresa" : "la plataforma"}`}
                        >
                          <X className="w-4 h-4" />
                          <span className="sr-only">Rechazar reseña</span>
                        </Button>
                      </>
                    )}

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-red-600 text-red-600 hover:bg-red-50"
                          title={`Eliminar reseña de ${review.tipo === "empresa" ? "empresa" : "la plataforma"}`}
                        >
                          <Trash2 className="w-4 h-4" />
                          <span className="sr-only">Eliminar reseña</span>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Eliminar reseña?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta acción no se puede deshacer. La reseña será eliminada permanentemente.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(review.id)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Eliminar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Mostrando {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, totalReviews)} de {totalReviews} reseñas
          </div>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
            >
              Anterior
            </Button>
            
            <div className="flex space-x-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNum = i + 1;
                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    onClick={() => setCurrentPage(pageNum)}
                    size="sm"
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>

            <Button
              variant="outline"
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}