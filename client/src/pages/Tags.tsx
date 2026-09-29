import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { 
  Plus, 
  Edit, 
  Trash2, 
  Tag as TagIcon, 
  AlertTriangle,
  Users,
  Search
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Swal from 'sweetalert2';

// Tag schema for validation
const tagSchema = z.object({
  nombre: z.string().min(1, "Nombre es requerido").max(50, "Máximo 50 caracteres"),
  descripcion: z.string().optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, "Color debe ser un hex válido")
});

type TagFormData = z.infer<typeof tagSchema>;

export default function Tags() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  // Fetch tags
  const { data: tags = [], isLoading } = useQuery({
    queryKey: ["/api/tags"],
    queryFn: async () => {
      const response = await fetch("/api/tags", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch tags");
      return response.json();
    },
  });

  // Fetch tags in use
  const { data: tagsInUse = [] } = useQuery({
    queryKey: ["/api/tags/in-use"],
    queryFn: async () => {
      const response = await fetch("/api/tags/in-use", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch tags in use");
      return response.json();
    },
  });

  // Form for create/edit
  const form = useForm<TagFormData>({
    resolver: zodResolver(tagSchema),
    defaultValues: {
      nombre: "",
      descripcion: "",
      color: "#3B82F6"
    },
  });

  // Create tag mutation
  const createTagMutation = useMutation({
    mutationFn: async (data: TagFormData) => {
      return await apiRequest("POST", "/api/tags", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
      setIsCreateOpen(false);
      toast({
        title: "Etiqueta creada",
        description: "La etiqueta ha sido creada exitosamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al crear la etiqueta",
        variant: "destructive",
      });
    },
  });

  // Update tag mutation
  const updateTagMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: TagFormData }) => {
      return await apiRequest("PUT", `/api/tags/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
      setIsCreateOpen(false);
      toast({
        title: "Etiqueta actualizada",
        description: "La etiqueta ha sido actualizada exitosamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al actualizar la etiqueta",
        variant: "destructive",
      });
    },
  });

  // Delete tag mutation
  const deleteTagMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/tags/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tags/in-use"] });
      toast({
        title: "Etiqueta eliminada",
        description: "La etiqueta ha sido eliminada exitosamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al eliminar la etiqueta",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (data: TagFormData) => {
    if (editingTag) {
      await updateTagMutation.mutateAsync({ id: editingTag.id, data });
    } else {
      await createTagMutation.mutateAsync(data);
    }
  };

  const handleEdit = (tag: any) => {
    setEditingTag(tag);
    form.reset({
      nombre: tag.nombre,
      descripcion: tag.descripcion || "",
      color: tag.color
    });
  };

  const resetFormToDefaults = () => {
    setEditingTag(null);
    // Reset form to default values
    form.reset({
      nombre: "",
      descripcion: "",
      color: "#3B82F6"
    });
  };

  const handleOpenCreateDialog = () => {
    resetFormToDefaults();
    setIsCreateOpen(true);
  };

  const handleDelete = async (id: number) => {
    const result = await Swal.fire({
      title: '¿Eliminar etiqueta?',
      text: 'Esta acción no se puede deshacer',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true
    });

    if (result.isConfirmed) {
      await deleteTagMutation.mutateAsync(id);
    }
  };

  // Filter tags based on search
  const filteredTags = tags.filter((tag: any) =>
    tag.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (tag.descripcion && tag.descripcion.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestión de Etiquetas</h1>
          <p className="text-gray-600">
            Administra las etiquetas para categorizar y mejorar la búsqueda de empresas
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) {
            resetFormToDefaults();
          }
        }}>
          <DialogTrigger asChild>
            <Button 
              className="bg-[#bcce16] hover:bg-[#a8b814] text-black"
              onClick={handleOpenCreateDialog}
            >
              <Plus className="h-4 w-4 mr-2" />
              Nueva Etiqueta
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingTag ? "Editar Etiqueta" : "Nueva Etiqueta"}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="nombre"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: Sustentabilidad" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="descripcion"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descripción (Opcional)</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Descripción de la etiqueta..."
                          rows={3}
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Color</FormLabel>
                      <FormControl>
                        <div className="flex gap-2 items-center">
                          <Input type="color" {...field} className="w-16 h-10" />
                          <Input 
                            {...field} 
                            placeholder="#3B82F6"
                            className="flex-1"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-2 pt-4">
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => setIsCreateOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit"
                    disabled={createTagMutation.isPending || updateTagMutation.isPending}
                    className="bg-[#bcce16] hover:bg-[#a8b814] text-black"
                  >
                    {editingTag ? "Actualizar" : "Crear"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Buscar etiquetas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tags Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TagIcon className="h-5 w-5" />
            Etiquetas ({filteredTags.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Cargando etiquetas...</div>
          ) : filteredTags.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {searchTerm ? "No se encontraron etiquetas" : "No hay etiquetas creadas"}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Etiqueta</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>En Uso</TableHead>
                  <TableHead>Fecha de Creación</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTags.map((tag: any) => {
                  const isInUse = tagsInUse.includes(tag.id);
                  return (
                    <TableRow key={tag.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge 
                            style={{ backgroundColor: tag.color, color: '#fff' }}
                            className="text-white"
                          >
                            {tag.nombre}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-600">
                        {tag.descripcion || "-"}
                      </TableCell>
                      <TableCell>
                        {isInUse ? (
                          <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                            <Users className="h-3 w-3" />
                            En uso
                          </Badge>
                        ) : (
                          <span className="text-gray-400">No utilizada</span>
                        )}
                      </TableCell>
                      <TableCell className="text-gray-600">
                        {new Date(tag.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              handleEdit(tag);
                              setIsCreateOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(tag.id)}
                            disabled={isInUse || deleteTagMutation.isPending}
                            className={isInUse ? "opacity-50 cursor-not-allowed" : "hover:bg-red-50 hover:text-red-600"}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Usage Warning */}
      {tagsInUse.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <h3 className="font-medium text-amber-800">Información sobre eliminación</h3>
                <p className="text-sm text-amber-700 mt-1">
                  Las etiquetas que están siendo utilizadas por empresas no pueden ser eliminadas. 
                  Para eliminar una etiqueta, primero debe removerla de todas las empresas que la utilizan.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}