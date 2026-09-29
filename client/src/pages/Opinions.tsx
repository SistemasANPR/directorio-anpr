import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CheckCircle, XCircle, Clock, Star, MessageSquare, Building2, Calendar, User } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { type Opinion } from "@shared/schema";

interface OpinionWithDetails extends Opinion {
  company?: {
    id: number;
    nombreEmpresa: string;
    logotipoUrl?: string;
  };
  user?: {
    id: number;
    displayName: string;
    email: string;
  };
}

export default function Opinions() {
  const [selectedOpinion, setSelectedOpinion] = useState<OpinionWithDetails | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: opinionsData, isLoading } = useQuery({
    queryKey: ["/api/opinions", { estado: filterStatus === "all" ? undefined : filterStatus }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterStatus !== "all") {
        params.append("estado", filterStatus);
      }
      const response = await apiRequest(`/api/opinions?${params.toString()}`);
      return response.json();
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (opinionId: number) => {
      const response = await apiRequest(`/api/opinions/${opinionId}/approve`, "POST", {
        approvedBy: user?.id
      });
      if (!response.ok) {
        throw new Error("Error al aprobar la opinión");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/opinions"] });
      setIsDetailModalOpen(false);
      toast({
        title: "Opinión aprobada",
        description: "La opinión ha sido aprobada y será visible públicamente",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo aprobar la opinión",
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (opinionId: number) => {
      const response = await apiRequest(`/api/opinions/${opinionId}/reject`, "POST", {
        approvedBy: user?.id
      });
      if (!response.ok) {
        throw new Error("Error al rechazar la opinión");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/opinions"] });
      setIsDetailModalOpen(false);
      toast({
        title: "Opinión rechazada",
        description: "La opinión ha sido rechazada y no será visible públicamente",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo rechazar la opinión",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (opinionId: number) => {
      const response = await apiRequest(`/api/opinions/${opinionId}`, "DELETE");
      if (!response.ok) {
        throw new Error("Error al eliminar la opinión");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/opinions"] });
      setIsDetailModalOpen(false);
      toast({
        title: "Opinión eliminada",
        description: "La opinión ha sido eliminada permanentemente",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo eliminar la opinión",
        variant: "destructive",
      });
    },
  });

  const handleViewDetails = (opinion: OpinionWithDetails) => {
    setSelectedOpinion(opinion);
    setIsDetailModalOpen(true);
  };

  const handleApprove = (opinionId: number) => {
    approveMutation.mutate(opinionId);
  };

  const handleReject = (opinionId: number) => {
    rejectMutation.mutate(opinionId);
  };

  const handleDelete = (opinionId: number) => {
    if (confirm("¿Estás seguro de que deseas eliminar esta opinión permanentemente?")) {
      deleteMutation.mutate(opinionId);
    }
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${i < rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
      />
    ));
  };

  const getStatusColor = (estado: string) => {
    switch (estado) {
      case "aprobada":
        return "bg-green-100 text-green-800";
      case "rechazada":
        return "bg-red-100 text-red-800";
      case "pendiente":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (estado: string) => {
    switch (estado) {
      case "aprobada":
        return <CheckCircle className="h-4 w-4" />;
      case "rechazada":
        return <XCircle className="h-4 w-4" />;
      case "pendiente":
        return <Clock className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const filteredOpinions = (opinionsData?.opinions || []).filter((opinion: OpinionWithDetails) =>
    opinion.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    opinion.comentario.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (opinion.company?.nombreEmpresa || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const pendingOpinions = filteredOpinions.filter((op: OpinionWithDetails) => op.estado === "pendiente");
  const approvedOpinions = filteredOpinions.filter((op: OpinionWithDetails) => op.estado === "aprobada");
  const rejectedOpinions = filteredOpinions.filter((op: OpinionWithDetails) => op.estado === "rechazada");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Cargando opiniones...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Gestión de Opiniones</h1>
          <p className="text-gray-600">Modera y gestiona las opiniones de las empresas</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Buscar por nombre, comentario o empresa..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filtrar por estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="pendiente">Pendientes</SelectItem>
            <SelectItem value="aprobada">Aprobadas</SelectItem>
            <SelectItem value="rechazada">Rechazadas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Estadísticas rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-yellow-600" />
              <div>
                <p className="text-2xl font-bold">{pendingOpinions.length}</p>
                <p className="text-sm text-gray-600">Pendientes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{approvedOpinions.length}</p>
                <p className="text-sm text-gray-600">Aprobadas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <XCircle className="h-8 w-8 text-red-600" />
              <div>
                <p className="text-2xl font-bold">{rejectedOpinions.length}</p>
                <p className="text-sm text-gray-600">Rechazadas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <MessageSquare className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{filteredOpinions.length}</p>
                <p className="text-sm text-gray-600">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs para organizar opiniones */}
      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Pendientes ({pendingOpinions.length})
          </TabsTrigger>
          <TabsTrigger value="approved" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Aprobadas ({approvedOpinions.length})
          </TabsTrigger>
          <TabsTrigger value="rejected" className="flex items-center gap-2">
            <XCircle className="h-4 w-4" />
            Rechazadas ({rejectedOpinions.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {pendingOpinions.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No hay opiniones pendientes de moderación</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pendingOpinions.map((opinion: OpinionWithDetails) => (
                <Card key={opinion.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback>
                            {opinion.nombre.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <CardTitle className="text-sm">{opinion.nombre}</CardTitle>
                          <CardDescription className="text-xs">
                            {opinion.company?.nombreEmpresa}
                          </CardDescription>
                        </div>
                      </div>
                      <div className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getStatusColor(opinion.estado)}`}>
                        {getStatusIcon(opinion.estado)}
                        {opinion.estado}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-1">
                      {renderStars(opinion.calificacion)}
                      <span className="text-sm text-gray-600 ml-2">
                        {opinion.calificacion}/5
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 line-clamp-3">
                      {opinion.comentario}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Calendar className="h-3 w-3" />
                      {new Date(opinion.fechaCreacion).toLocaleDateString()}
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewDetails(opinion)}
                        className="flex-1"
                      >
                        Ver detalles
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleApprove(opinion.id)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleReject(opinion.id)}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="approved" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {approvedOpinions.map((opinion: OpinionWithDetails) => (
              <Card key={opinion.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback>
                          {opinion.nombre.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="text-sm">{opinion.nombre}</CardTitle>
                        <CardDescription className="text-xs">
                          {opinion.company?.nombreEmpresa}
                        </CardDescription>
                      </div>
                    </div>
                    <div className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getStatusColor(opinion.estado)}`}>
                      {getStatusIcon(opinion.estado)}
                      {opinion.estado}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-1">
                    {renderStars(opinion.calificacion)}
                    <span className="text-sm text-gray-600 ml-2">
                      {opinion.calificacion}/5
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 line-clamp-3">
                    {opinion.comentario}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Calendar className="h-3 w-3" />
                    {new Date(opinion.fechaCreacion).toLocaleDateString()}
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleViewDetails(opinion)}
                      className="flex-1"
                    >
                      Ver detalles
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(opinion.id)}
                    >
                      Eliminar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="rejected" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rejectedOpinions.map((opinion: OpinionWithDetails) => (
              <Card key={opinion.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback>
                          {opinion.nombre.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="text-sm">{opinion.nombre}</CardTitle>
                        <CardDescription className="text-xs">
                          {opinion.company?.nombreEmpresa}
                        </CardDescription>
                      </div>
                    </div>
                    <div className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getStatusColor(opinion.estado)}`}>
                      {getStatusIcon(opinion.estado)}
                      {opinion.estado}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-1">
                    {renderStars(opinion.calificacion)}
                    <span className="text-sm text-gray-600 ml-2">
                      {opinion.calificacion}/5
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 line-clamp-3">
                    {opinion.comentario}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Calendar className="h-3 w-3" />
                    {new Date(opinion.fechaCreacion).toLocaleDateString()}
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleViewDetails(opinion)}
                      className="flex-1"
                    >
                      Ver detalles
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleApprove(opinion.id)}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      Aprobar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(opinion.id)}
                    >
                      Eliminar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal de detalles */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalles de la Opinión</DialogTitle>
            <DialogDescription>
              Información completa de la opinión y acciones disponibles
            </DialogDescription>
          </DialogHeader>
          {selectedOpinion && (
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="text-lg">
                    {selectedOpinion.nombre.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold">{selectedOpinion.nombre}</h3>
                    <div className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getStatusColor(selectedOpinion.estado)}`}>
                      {getStatusIcon(selectedOpinion.estado)}
                      {selectedOpinion.estado}
                    </div>
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      {selectedOpinion.email}
                    </div>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      {selectedOpinion.company?.nombreEmpresa}
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {new Date(selectedOpinion.fechaCreacion).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">Calificación</label>
                  <div className="flex items-center gap-2 mt-1">
                    {renderStars(selectedOpinion.calificacion)}
                    <span className="text-lg font-semibold">
                      {selectedOpinion.calificacion}/5
                    </span>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Comentario</label>
                  <div className="mt-1 p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm">{selectedOpinion.comentario}</p>
                  </div>
                </div>

                {selectedOpinion.fechaAprobacion && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      Fecha de {selectedOpinion.estado}
                    </label>
                    <p className="text-sm text-gray-600 mt-1">
                      {new Date(selectedOpinion.fechaAprobacion).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setIsDetailModalOpen(false)}>
              Cerrar
            </Button>
            {selectedOpinion?.estado === "pendiente" && (
              <>
                <Button
                  onClick={() => handleApprove(selectedOpinion.id)}
                  className="bg-green-600 hover:bg-green-700"
                  disabled={approveMutation.isPending}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {approveMutation.isPending ? "Aprobando..." : "Aprobar"}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleReject(selectedOpinion.id)}
                  disabled={rejectMutation.isPending}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  {rejectMutation.isPending ? "Rechazando..." : "Rechazar"}
                </Button>
              </>
            )}
            {selectedOpinion?.estado === "rechazada" && (
              <Button
                onClick={() => handleApprove(selectedOpinion.id)}
                className="bg-green-600 hover:bg-green-700"
                disabled={approveMutation.isPending}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                {approveMutation.isPending ? "Aprobando..." : "Aprobar"}
              </Button>
            )}
            <Button
              variant="destructive"
              onClick={() => handleDelete(selectedOpinion?.id || 0)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}