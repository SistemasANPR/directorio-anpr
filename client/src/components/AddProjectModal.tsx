import { useState, useCallback, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { insertProjectSchema } from "@shared/schema";
import { IMAGE_MAX_BYTES, IMAGE_TOO_LARGE_MESSAGE } from "@shared/image-upload";
import MembershipLimitsValidator from "@/components/MembershipLimitsValidator";
import type { ProjectWithDetails, Category, CompanyWithDetails } from "@shared/schema";
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import BulletList from '@tiptap/extension-bullet-list';
import OrderedList from '@tiptap/extension-ordered-list';
import ListItem from '@tiptap/extension-list-item';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { Bold, Italic, List, ListOrdered, AlignLeft, AlignCenter, AlignRight, Link as LinkIcon, GripVertical, X, Upload } from "lucide-react";

// Crear el esquema dinámico basado en el límite de fotos
const createProjectFormSchema = (maxPhotos: number) => insertProjectSchema.extend({
  galeriaImagenes: z.array(z.instanceof(File)).max(
    maxPhotos === Infinity ? 999 : maxPhotos, 
    `Máximo ${maxPhotos === Infinity ? "ilimitadas" : maxPhotos} imágenes`
  ).optional(),
});

type ProjectFormData = z.infer<ReturnType<typeof createProjectFormSchema>>;

interface AddProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: number;
  project?: ProjectWithDetails;
  onSuccess?: () => void;
}

export default function AddProjectModal({ 
  open, 
  onOpenChange, 
  companyId, 
  project, 
  onSuccess 
}: AddProjectModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [canAddProducts, setCanAddProducts] = useState(false);
  const [canAddProjects, setCanAddProjects] = useState(false);

  useEffect(() => {
    if (!project) {
      setCanAddProjects(false);
    }
  }, [companyId, open, project]);

  // Callback para manejar cambios en los límites
  const handleLimitsChange = (canProducts: boolean, canProjects: boolean) => {
    setCanAddProducts(canProducts);
    setCanAddProjects(canProjects);
  };

  // Obtener información de la empresa y su plan de membresía
  const { data: companyData } = useQuery<CompanyWithDetails>({
    queryKey: [`/api/companies/${companyId}`],
    enabled: !!companyId,
  });

  // Obtener límite de fotos por proyecto basado en el plan de membresía
  const maxPhotos = (companyData?.membershipType?.cantidadFotosPorProyecto === -1 || companyData?.membershipType?.cantidadFotosPorProyecto == null)
    ? Infinity 
    : companyData.membershipType.cantidadFotosPorProyecto;

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      TextStyle,
      Color,
      BulletList,
      OrderedList,
      ListItem,
      Link.configure({
        openOnClick: false,
      }),
      Placeholder.configure({
        placeholder: 'Describe los detalles del proyecto...',
      }),
    ],
    content: project?.descripcionProyecto || '',
    onUpdate: ({ editor }) => {
      form.setValue('descripcionProyecto', editor.getHTML());
    },
  });



  // Funciones para drag and drop de imágenes
  const validateProjectImages = (files: Iterable<File>) => {
    if (Array.from(files).some((file) => file.size > IMAGE_MAX_BYTES)) {
      toast({ title: "Error", description: IMAGE_TOO_LARGE_MESSAGE, variant: "destructive" });
      return false;
    }
    return true;
  };
  const handleImageUpload = useCallback((files: FileList | null) => {
    if (!files) return;
    if (!validateProjectImages(files)) return;
    
    const maxAllowed = maxPhotos === Infinity ? 99 : maxPhotos;
    const newFiles = Array.from(files).slice(0, maxAllowed - imageFiles.length);
    setImageFiles(prev => [...prev, ...newFiles]);
  }, [imageFiles.length, maxPhotos, toast]);

  const removeImage = useCallback((index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null) return;

    const newImages = [...imageFiles];
    const draggedItem = newImages[draggedIndex];
    newImages.splice(draggedIndex, 1);
    newImages.splice(dropIndex, 0, draggedItem);
    
    setImageFiles(newImages);
    setDraggedIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  // Crear el esquema dinámico para validación
  const dynamicSchema = createProjectFormSchema(maxPhotos);
  
  const form = useForm<ProjectFormData>({
    resolver: zodResolver(dynamicSchema),
    defaultValues: {
      companyId,
      nombreProyecto: project?.nombreProyecto || "",
      descripcionProyecto: project?.descripcionProyecto || "",
      ubicacionPais: project?.ubicacionPais || "",
      ubicacionEstado: project?.ubicacionEstado || "",
      ubicacionCiudad: project?.ubicacionCiudad || "",
      clienteContratante: project?.clienteContratante || "",
      areaSuperficie: project?.areaSuperficie || "",
      serviciosProductos: project?.serviciosProductos || [],
      videoUrl: project?.videoUrl || "",
      estado: project?.estado || "publicado",
      galeriaImagenes: [],
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: ProjectFormData) => {
      if (!validateProjectImages(imageFiles)) throw new Error(IMAGE_TOO_LARGE_MESSAGE);
      console.log("Form data being submitted:", data);
      
      const formData = new FormData();
      
      // Agregar companyId primero
      formData.append('companyId', companyId.toString());
      
      // Agregar campos del proyecto
      Object.entries(data).forEach(([key, value]) => {
        if (key === 'galeriaImagenes') return; // Se maneja por separado
        if (key === 'companyId') return; // Ya se agregó arriba; duplicarlo lo convierte en arreglo y rompe la validación
        if (key === 'serviciosProductos') {
          formData.append(key, JSON.stringify(value || []));
        } else if (value !== undefined && value !== null) {
          formData.append(key, value.toString());
        }
      });

      // Agregar imágenes
      imageFiles.forEach((file) => {
        formData.append('galeriaImagenes', file);
      });

      // Debug: Log FormData contents
      console.log("FormData contents:");
      Array.from(formData.entries()).forEach(([key, value]) => {
        console.log(key, value);
      });

      const url = project ? `/api/projects/${project.id}` : "/api/projects";
      const method = project ? "PATCH" : "POST";
      
      return apiRequest(method, url, formData);
    },
    onSuccess: () => {
      toast({
        title: project ? "Proyecto actualizado" : "Proyecto creado",
        description: project 
          ? "El proyecto se ha actualizado exitosamente." 
          : "El proyecto se ha creado exitosamente.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/companies", companyId.toString()] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: [`/api/companies/${companyId}/limits`] });
      onOpenChange(false);
      form.reset();
      setImageFiles([]);
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Error al procesar el proyecto",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ProjectFormData) => {
    // Si no es un proyecto existente (editing), verificar límites antes de crear
    if (!project && !canAddProjects) {
      toast({
        title: "Límite de proyectos alcanzado",
        description: "Has alcanzado el límite de proyectos de tu plan de membresía. Actualiza tu plan para agregar más proyectos.",
        variant: "destructive",
      });
      return;
    }
    
    if (validateProjectImages(imageFiles)) mutation.mutate(data);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const maxAllowed = maxPhotos === Infinity ? 99 : maxPhotos;
    
    if (files.length > maxAllowed) {
      toast({
        title: "Error",
        description: `Máximo ${maxPhotos === Infinity ? "ilimitadas" : maxPhotos} imágenes permitidas según tu plan`,
        variant: "destructive",
      });
      return;
    }
    setImageFiles(files);
  };

  const addServiceProduct = () => {
    const currentServices = form.getValues("serviciosProductos") || [];
    form.setValue("serviciosProductos", [...currentServices, ""]);
  };

  const removeServiceProduct = (index: number) => {
    const currentServices = form.getValues("serviciosProductos") || [];
    form.setValue("serviciosProductos", currentServices.filter((_, i) => i !== index));
  };

  const updateServiceProduct = (index: number, value: string) => {
    const currentServices = form.getValues("serviciosProductos") || [];
    currentServices[index] = value;
    form.setValue("serviciosProductos", currentServices);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {project ? "Editar Proyecto" : "Agregar Nuevo Proyecto"}
          </DialogTitle>
          <DialogDescription>
            {project 
              ? "Modifica la información del proyecto." 
              : "Agrega un nuevo proyecto a tu empresa respetando el límite configurado en tu plan."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Membership Limits Validator */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <MembershipLimitsValidator
                companyId={companyId}
                additionalProducts={0}
                additionalProjects={project ? 0 : 1} // Solo validar límites si es un nuevo proyecto
                onLimitsChange={handleLimitsChange}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Información Básica */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Información Básica</h3>
                
                <FormField
                  control={form.control}
                  name="nombreProyecto"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre del Proyecto *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Ej: Modernización Plaza Central" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="descripcionProyecto"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descripción del Proyecto</FormLabel>
                      <FormControl>
                        <div className="border rounded-md">
                          {/* Editor Toolbar */}
                          <div className="border-b p-2 flex flex-wrap gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => editor?.chain().focus().toggleBold().run()}
                              className={editor?.isActive('bold') ? 'bg-gray-200' : ''}
                            >
                              <Bold className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => editor?.chain().focus().toggleItalic().run()}
                              className={editor?.isActive('italic') ? 'bg-gray-200' : ''}
                            >
                              <Italic className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => editor?.chain().focus().toggleBulletList().run()}
                              className={editor?.isActive('bulletList') ? 'bg-gray-200' : ''}
                            >
                              <List className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                              className={editor?.isActive('orderedList') ? 'bg-gray-200' : ''}
                            >
                              <ListOrdered className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => editor?.chain().focus().setTextAlign('left').run()}
                              className={editor?.isActive({ textAlign: 'left' }) ? 'bg-gray-200' : ''}
                            >
                              <AlignLeft className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => editor?.chain().focus().setTextAlign('center').run()}
                              className={editor?.isActive({ textAlign: 'center' }) ? 'bg-gray-200' : ''}
                            >
                              <AlignCenter className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => editor?.chain().focus().setTextAlign('right').run()}
                              className={editor?.isActive({ textAlign: 'right' }) ? 'bg-gray-200' : ''}
                            >
                              <AlignRight className="h-4 w-4" />
                            </Button>
                          </div>
                          {/* Editor Content */}
                          <EditorContent 
                            editor={editor} 
                            className="prose prose-sm max-w-none p-3 min-h-[120px] focus-within:outline-none"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />


              </div>

              {/* Información de Ubicación y Cliente */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Ubicación y Cliente</h3>
                
                <FormField
                  control={form.control}
                  name="clienteContratante"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cliente/Contratante</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Nombre del cliente o empresa contratante" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-3 gap-2">
                  <FormField
                    control={form.control}
                    name="ubicacionPais"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>País</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="México" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="ubicacionEstado"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estado</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Ej: CDMX" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="ubicacionCiudad"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ciudad</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Ej: Benito Juárez" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="areaSuperficie"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Área/Superficie</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Ej: 5000 m², 2 hectáreas" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="estado"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estado del Proyecto</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="borrador">Borrador</SelectItem>
                          <SelectItem value="publicado">Publicado</SelectItem>
                          <SelectItem value="archivado">Archivado</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Servicios/Productos */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Servicios/Productos Utilizados</h3>
                <Button type="button" variant="outline" onClick={addServiceProduct}>
                  Agregar Servicio
                </Button>
              </div>
              
              {form.watch("serviciosProductos")?.map((service, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={service}
                    onChange={(e) => updateServiceProduct(index, e.target.value)}
                    placeholder="Ej: Mobiliario urbano, Iluminación LED..."
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => removeServiceProduct(index)}
                  >
                    Eliminar
                  </Button>
                </div>
              ))}
            </div>

            {/* Multimedia */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Contenido Multimedia</h3>
              
              <div>
                <Label>Galería de Imágenes {maxPhotos === Infinity ? "(ilimitadas)" : `(máximo ${maxPhotos})`}</Label>
                <div className="space-y-4 mt-2">
                  {/* Upload Area */}
                  <div 
                    className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors"
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.add('border-blue-400', 'bg-blue-50');
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50');
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50');
                      handleImageUpload(e.dataTransfer.files);
                    }}
                  >
                    <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600 mb-2">
                      Arrastra imágenes aquí o haz clic para seleccionar
                    </p>
                    <Input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => handleImageUpload(e.target.files)}
                      className="hidden"
                      id="image-upload"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('image-upload')?.click()}
                      disabled={maxPhotos !== Infinity && imageFiles.length >= maxPhotos}
                    >
                      Seleccionar Imágenes
                    </Button>
                    <p className="text-xs text-gray-500 mt-1">
                      {imageFiles.length}/{maxPhotos === Infinity ? "∞" : maxPhotos} imágenes
                    </p>
                  </div>

                  {/* Image Preview with Drag and Drop */}
                  {imageFiles.length > 0 && (
                    <div className="grid grid-cols-2 gap-4">
                      {imageFiles.map((file, index) => (
                        <div
                          key={index}
                          className={`relative group border rounded-lg overflow-hidden ${
                            draggedIndex === index ? 'opacity-50' : ''
                          }`}
                          draggable
                          onDragStart={() => handleDragStart(index)}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, index)}
                          onDragEnd={handleDragEnd}
                        >
                          <img
                            src={URL.createObjectURL(file)}
                            alt={`Preview ${index + 1}`}
                            className="w-full h-24 object-cover"
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 flex items-center justify-center">
                            <div className="opacity-0 group-hover:opacity-100 flex gap-2">
                              <GripVertical className="h-4 w-4 text-white cursor-move" />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeImage(index)}
                                className="h-6 w-6 p-0 text-white hover:bg-red-500"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          <div className="absolute top-1 left-1 bg-black bg-opacity-50 text-white text-xs px-1 rounded">
                            {index + 1}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <FormField
                control={form.control}
                name="videoUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL del Video (YouTube/Vimeo)</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="https://www.youtube.com/watch?v=..." 
                        type="url"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={mutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={mutation.isPending || (!project && !canAddProjects)}
              >
                {mutation.isPending 
                  ? (project ? "Actualizando..." : "Creando...") 
                  : (project ? "Actualizar Proyecto" : "Crear Proyecto")
                }
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}