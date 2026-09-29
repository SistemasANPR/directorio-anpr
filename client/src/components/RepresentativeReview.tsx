import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Star, MessageSquare, Edit, Trash2, Plus, Calendar } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface Review {
  id: number;
  comentario: string;
  calificacion: number;
  estado: string;
  tipo: string;
  companyId: number | null;
  userId: number;
  approvedBy: number | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: number;
    displayName: string;
    email: string;
  };
  approver?: {
    id: number;
    displayName: string;
  };
}

export default function RepresentativeReview() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingReview, setEditingReview] = useState<Review | null>(null);
  const [formData, setFormData] = useState({
    comentario: "",
    calificacion: 5
  });

  // Fetch user's platform review
  const { data: userReview, isLoading } = useQuery<Review | null>({
    queryKey: ['/api/opinions/user-review', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const response = await apiRequest("GET", `/api/opinions?userId=${user.id}&tipo=plataforma&limit=1`);
      const data = await response.json();
      return data.opinions.length > 0 ? data.opinions[0] : null;
    },
    enabled: !!user?.id,
  });

  // Create review mutation
  const createReviewMutation = useMutation({
    mutationFn: async (reviewData: { comentario: string; calificacion: number }) => {
      const response = await apiRequest("POST", "/api/opinions", {
        ...reviewData,
        tipo: 'plataforma',
        estado: 'pendiente',
        userId: user?.id,
        nombre: user?.displayName || user?.email || 'Usuario',
        email: user?.email || '',
        companyId: null // Platform reviews don't belong to a specific company
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/opinions/user-review'] });
      toast({
        title: "Reseña creada",
        description: "Tu reseña ha sido enviada y está pendiente de moderación.",
      });
      setIsModalOpen(false);
      setFormData({ comentario: "", calificacion: 5 });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo crear la reseña. Intenta nuevamente.",
        variant: "destructive",
      });
    },
  });

  // Update review mutation
  const updateReviewMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { comentario: string; calificacion: number } }) => {
      const response = await apiRequest("PUT", `/api/opinions/${id}`, {
        ...data,
        estado: 'pendiente', // Reset to pending when edited
        nombre: user?.displayName || user?.email || 'Usuario',
        email: user?.email || ''
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/opinions/user-review'] });
      toast({
        title: "Reseña actualizada",
        description: "Tu reseña ha sido actualizada y está pendiente de moderación.",
      });
      setIsModalOpen(false);
      setEditingReview(null);
      setFormData({ comentario: "", calificacion: 5 });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo actualizar la reseña. Intenta nuevamente.",
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
      queryClient.invalidateQueries({ queryKey: ['/api/opinions/user-review'] });
      toast({
        title: "Reseña eliminada",
        description: "Tu reseña ha sido eliminada exitosamente.",
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

  const renderStars = (rating: number, interactive = false, onChange?: (rating: number) => void) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star 
        key={i} 
        className={`w-6 h-6 ${
          i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
        } ${interactive ? 'cursor-pointer hover:text-yellow-400' : ''}`}
        onClick={interactive && onChange ? () => onChange(i + 1) : undefined}
      />
    ));
  };

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

  const handleOpenModal = (review?: Review) => {
    if (review) {
      setEditingReview(review);
      setFormData({
        comentario: review.comentario,
        calificacion: review.calificacion
      });
    } else {
      setEditingReview(null);
      setFormData({ comentario: "", calificacion: 5 });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.comentario.trim()) {
      toast({
        title: "Error",
        description: "El comentario es requerido.",
        variant: "destructive",
      });
      return;
    }

    if (editingReview) {
      updateReviewMutation.mutate({
        id: editingReview.id,
        data: formData
      });
    } else {
      createReviewMutation.mutate(formData);
    }
  };

  const handleDelete = (reviewId: number) => {
    deleteReviewMutation.mutate(reviewId);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Cargando...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Mi Reseña de la Plataforma</h2>
        {!userReview && (
          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenModal()}>
                <Plus className="w-4 h-4 mr-2" />
                Escribir Reseña
              </Button>
            </DialogTrigger>
          </Dialog>
        )}
      </div>

      {userReview ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                <MessageSquare className="w-5 h-5" />
                <span>Tu Reseña</span>
                {getStatusBadge(userReview.estado)}
              </CardTitle>
              <div className="flex items-center space-x-2">
                <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleOpenModal(userReview)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                  </DialogTrigger>
                </Dialog>
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="border-red-600 text-red-600 hover:bg-red-50">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Eliminar reseña?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta acción no se puede deshacer. Tu reseña será eliminada permanentemente.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDelete(userReview.id)}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        Eliminar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium">Calificación:</span>
                <div className="flex items-center space-x-1">
                  {renderStars(userReview.calificacion)}
                  <span className="text-sm text-gray-600 ml-2">
                    {userReview.calificacion}/5
                  </span>
                </div>
              </div>
              
              <div>
                <span className="text-sm font-medium">Comentario:</span>
                <p className="text-gray-700 mt-1 bg-gray-50 p-3 rounded-lg">
                  {userReview.comentario}
                </p>
              </div>
              
              <div className="flex items-center space-x-4 text-sm text-gray-500">
                <div className="flex items-center space-x-1">
                  <Calendar className="w-4 h-4" />
                  <span>
                    Creada: {format(new Date(userReview.createdAt), "PPP", { locale: es })}
                  </span>
                </div>
                {userReview.updatedAt !== userReview.createdAt && (
                  <span>
                    Actualizada: {format(new Date(userReview.updatedAt), "PPP", { locale: es })}
                  </span>
                )}
              </div>

              {userReview.estado === "rechazada" && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-red-800 text-sm">
                    Tu reseña fue rechazada. Puedes editarla y enviarla nuevamente.
                  </p>
                </div>
              )}

              {userReview.estado === "pendiente" && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-yellow-800 text-sm">
                    Tu reseña está pendiente de moderación por parte del equipo administrativo.
                  </p>
                </div>
              )}

              {userReview.estado === "aprobada" && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-green-800 text-sm">
                    ¡Tu reseña ha sido aprobada y es visible públicamente!
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6 text-center">
            <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No has escrito una reseña aún
            </h3>
            <p className="text-gray-600 mb-4">
              Comparte tu experiencia con la plataforma ANPR México
            </p>
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => handleOpenModal()}>
                  <Plus className="w-4 h-4 mr-2" />
                  Escribir Reseña
                </Button>
              </DialogTrigger>
            </Dialog>
          </CardContent>
        </Card>
      )}

      {/* Modal for Create/Edit Review */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingReview ? "Editar Reseña" : "Escribir Reseña"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="calificacion">Calificación</Label>
              <div className="flex items-center space-x-1 mt-2">
                {renderStars(
                  formData.calificacion, 
                  true, 
                  (rating) => setFormData(prev => ({ ...prev, calificacion: rating }))
                )}
                <span className="text-sm text-gray-600 ml-2">
                  {formData.calificacion}/5
                </span>
              </div>
            </div>
            
            <div>
              <Label htmlFor="comentario">Comentario</Label>
              <Textarea
                id="comentario"
                value={formData.comentario}
                onChange={(e) => setFormData(prev => ({ ...prev, comentario: e.target.value }))}
                placeholder="Comparte tu experiencia con la plataforma ANPR México..."
                rows={4}
                className="mt-1"
              />
            </div>
            
            <div className="flex space-x-2 pt-4">
              <Button
                onClick={handleSubmit}
                disabled={createReviewMutation.isPending || updateReviewMutation.isPending}
                className="flex-1"
              >
                {editingReview ? "Actualizar" : "Publicar"} Reseña
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}