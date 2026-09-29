import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import RichTextEditor from "@/components/RichTextEditor";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Plus, MoreHorizontal, Edit, Trash2, Tags, Table as TableIcon, Grid, Eye,
  Building2, Car, Truck, Hammer, Factory, Cpu, Wrench, ShoppingBag,
  Briefcase, Heart, GraduationCap, Home, Coffee, Camera, Music,
  Gamepad2, Book, Palette, MapPin, Plane, Ship, Train, Zap,
  Download, Upload, X
} from "lucide-react";
import { Category } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Swal from 'sweetalert2';
import CategoryDataTable from "@/components/CategoryDataTable";
import * as XLSX from 'xlsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Available icons for categories
const availableIcons = [
  { name: "Tags", component: Tags, label: "Etiqueta" },
  { name: "Building2", component: Building2, label: "Edificio" },
  { name: "Car", component: Car, label: "Automóvil" },
  { name: "Truck", component: Truck, label: "Camión" },
  { name: "Hammer", component: Hammer, label: "Herramientas" },
  { name: "Factory", component: Factory, label: "Fábrica" },
  { name: "Cpu", component: Cpu, label: "Tecnología" },
  { name: "Wrench", component: Wrench, label: "Mantenimiento" },
  { name: "ShoppingBag", component: ShoppingBag, label: "Comercio" },
  { name: "Briefcase", component: Briefcase, label: "Negocios" },
  { name: "Heart", component: Heart, label: "Salud" },
  { name: "GraduationCap", component: GraduationCap, label: "Educación" },
  { name: "Home", component: Home, label: "Hogar" },
  { name: "Coffee", component: Coffee, label: "Restaurantes" },
  { name: "Camera", component: Camera, label: "Fotografía" },
  { name: "Music", component: Music, label: "Música" },
  { name: "Gamepad2", component: Gamepad2, label: "Entretenimiento" },
  { name: "Book", component: Book, label: "Libros" },
  { name: "Palette", component: Palette, label: "Arte" },
  { name: "MapPin", component: MapPin, label: "Ubicación" },
  { name: "Plane", component: Plane, label: "Viajes" },
  { name: "Ship", component: Ship, label: "Marítimo" },
  { name: "Train", component: Train, label: "Transporte" },
  { name: "Zap", component: Zap, label: "Energía" }
];

const categorySchema = z.object({
  nombreCategoria: z.string().min(1, "El nombre de la categoría es requerido"),
  descripcion: z.string().optional(),
  icono: z.string().default("Tags"),
  iconoUrl: z.string().optional(),
});

type CategoryFormData = z.infer<typeof categorySchema>;

export default function Categories() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "table">("table");
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const { toast } = useToast();

  const form = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      nombreCategoria: "",
      descripcion: "",
      icono: "Tags",
      iconoUrl: "",
    },
  });

  const editForm = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      nombreCategoria: "",
      descripcion: "",
      icono: "Tags",
      iconoUrl: "",
    },
  });

  // Fetch categories
  const { data: categories = [], isLoading } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  // Create category mutation
  const createCategoryMutation = useMutation({
    mutationFn: async (data: CategoryFormData) => {
      const response = await apiRequest("POST", "/api/categories", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      toast({
        title: "Categoría creada",
        description: "La categoría ha sido creada exitosamente",
      });
      form.reset();
      setIsAddModalOpen(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo crear la categoría",
        variant: "destructive",
      });
    },
  });

  // Update category mutation
  const updateCategoryMutation = useMutation({
    mutationFn: async (data: CategoryFormData) => {
      if (!selectedCategory) throw new Error("No category selected");
      const response = await apiRequest("PUT", `/api/categories/${selectedCategory.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      toast({
        title: "Categoría actualizada",
        description: "La categoría ha sido actualizada exitosamente",
      });
      editForm.reset();
      setIsEditModalOpen(false);
      setSelectedCategory(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo actualizar la categoría",
        variant: "destructive",
      });
    },
  });

  // Delete category mutation
  const deleteCategoryMutation = useMutation({
    mutationFn: async (categoryId: number) => {
      await apiRequest("DELETE", `/api/categories/${categoryId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      toast({
        title: "Categoría eliminada",
        description: "La categoría ha sido eliminada exitosamente",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo eliminar la categoría",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CategoryFormData) => {
    createCategoryMutation.mutate(data);
  };

  const onEditSubmit = (data: CategoryFormData) => {
    updateCategoryMutation.mutate(data);
  };

  const handleEdit = (category: Category) => {
    setSelectedCategory(category);
    editForm.reset({
      nombreCategoria: category.nombreCategoria,
      descripcion: category.descripcion || "",
      icono: category.icono || "Tags",
      iconoUrl: category.iconoUrl || "",
    });
    setIsEditModalOpen(true);
  };

  const handleView = (category: Category) => {
    setSelectedCategory(category);
    setIsViewModalOpen(true);
  };

  const handleDelete = async (categoryId: number) => {
    const result = await Swal.fire({
      title: '¿Eliminar categoría?',
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
      deleteCategoryMutation.mutate(categoryId);
    }
  };

  // Función para exportar categorías a CSV
  const exportCategoriesToCSV = () => {
    if (!categories) return;
    
    const headers = ['Nombre de Categoría', 'Descripción', 'Ícono', 'URL del Ícono'];
    
    const rows = categories.map(category => [
      category.nombreCategoria || '',
      category.descripcion || '',
      category.icono || '',
      category.iconoUrl || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `categorias_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Exportación exitosa",
      description: `Se han exportado ${categories.length} categorías a CSV`,
    });
  };

  // Función para exportar categorías a Excel
  const exportCategoriesToExcel = () => {
    if (!categories) return;
    
    const dataToExport = categories.map(category => ({
      'Nombre de Categoría': category.nombreCategoria || '',
      'Descripción': category.descripcion || '',
      'Ícono': category.icono || '',
      'URL del Ícono': category.iconoUrl || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Categorías');
    
    XLSX.writeFile(workbook, `categorias_${new Date().toISOString().split('T')[0]}.xlsx`);

    toast({
      title: "Exportación exitosa",
      description: `Se han exportado ${categories.length} categorías a Excel`,
    });
  };

  // Función para importar categorías desde datos procesados
  const importCategories = async (headers: string[], dataRows: any[]) => {
    let successCount = 0;
    let errorCount = 0;

    try {
      for (const row of dataRows) {
        if (!row || row.length === 0) continue;

        try {
          // Mapear los datos según las columnas del archivo
          const categoryData: any = {};
          
          // Buscar las columnas relevantes (flexible para diferentes formatos)
          headers.forEach((header, index) => {
            const value = row[index];
            const normalizedHeader = header.toLowerCase().trim();
            
            if (normalizedHeader.includes('categoria') || normalizedHeader.includes('nombre')) {
              categoryData.nombreCategoria = value;
            } else if (normalizedHeader.includes('descripcion')) {
              categoryData.descripcion = value;
            } else if (normalizedHeader.includes('icono') && !normalizedHeader.includes('url')) {
              categoryData.icono = value;
            } else if (normalizedHeader.includes('url') || normalizedHeader.includes('img')) {
              categoryData.iconoUrl = value;
            }
          });

          // Validar que tengamos al menos el nombre
          if (!categoryData.nombreCategoria || categoryData.nombreCategoria.trim() === '') {
            continue;
          }

          // Limpiar datos
          categoryData.nombreCategoria = categoryData.nombreCategoria.toString().trim();
          if (categoryData.descripcion) {
            categoryData.descripcion = categoryData.descripcion.toString().trim();
          }

          // Crear la categoría
          await apiRequest("POST", '/api/categories', {
            nombreCategoria: categoryData.nombreCategoria,
            descripcion: categoryData.descripcion || null,
            icono: categoryData.icono || 'Tags',
            iconoUrl: categoryData.iconoUrl || null
          });
          
          successCount++;
        } catch (error) {
          errorCount++;
          console.error('Error importing category:', row, error);
        }
      }

      // Actualizar la lista de categorías
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });

      toast({
        title: "Importación completada",
        description: `Importadas: ${successCount}, Errores: ${errorCount}`,
      });

    } catch (error) {
      toast({
        title: "Error de importación",
        description: "Error al procesar el archivo. Verifica el formato.",
        variant: "destructive"
      });
    }
  };

  // Función para procesar CSV
  const processCSV = async (csvText: string) => {
    try {
      const lines = csvText.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
      const dataRows = lines.slice(1);

      await importCategories(headers, dataRows);
    } catch (error) {
      toast({
        title: "Error en importación",
        description: "No se pudo procesar el archivo CSV",
        variant: "destructive",
      });
    }
  };

  // Función para procesar Excel
  const processExcel = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (jsonData.length === 0) {
          toast({
            title: "Error en importación",
            description: "El archivo Excel está vacío",
            variant: "destructive",
          });
          return;
        }

        const headers = jsonData[0] as string[];
        const dataRows = jsonData.slice(1);

        await importCategories(headers, dataRows);
      } catch (error) {
        toast({
          title: "Error en importación",
          description: "No se pudo procesar el archivo Excel",
          variant: "destructive",
        });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Función para manejar importación de archivos
  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    
    if (fileExtension === 'csv') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        processCSV(text);
      };
      reader.readAsText(file);
    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      processExcel(file);
    } else {
      toast({
        title: "Formato no compatible",
        description: "Solo se admiten archivos CSV y Excel (.xlsx, .xls)",
        variant: "destructive",
      });
    }
    
    event.target.value = '';
  };

  // Función para importar categorías
  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const importedData = JSON.parse(text);

      if (!Array.isArray(importedData)) {
        throw new Error("El archivo debe contener un array de categorías");
      }

      let successCount = 0;
      let errorCount = 0;

      for (const categoryData of importedData) {
        try {
          if (!categoryData.nombreCategoria) {
            throw new Error("Falta el nombre de la categoría");
          }

          await apiRequest("POST", '/api/categories', {
            nombreCategoria: categoryData.nombreCategoria,
            descripcion: categoryData.descripcion || null,
            icono: categoryData.icono || null,
            iconoUrl: categoryData.iconoUrl || null
          });
          successCount++;
        } catch (error) {
          errorCount++;
          console.error('Error importing category:', categoryData, error);
        }
      }

      // Actualizar la lista
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });

      toast({
        title: "Importación completada",
        description: `Importadas: ${successCount}, Errores: ${errorCount}`,
      });

    } catch (error) {
      toast({
        title: "Error de importación",
        description: "Error al procesar el archivo. Verifica el formato.",
        variant: "destructive"
      });
    }

    // Limpiar el input
    event.target.value = '';
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-primary">Gestión de Categorías</h1>
          <p className="text-gray-600 mt-1">Administra las categorías de empresas del directorio</p>
        </div>
        <div className="flex items-center space-x-3">
          {/* View Toggle */}
          <div className="flex items-center border rounded-lg p-1">
            <Button
              variant={viewMode === "table" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("table")}
              className="h-8 px-3"
            >
              <TableIcon className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === "grid" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("grid")}
              className="h-8 px-3"
            >
              <Grid className="w-4 h-4" />
            </Button>
          </div>
          
          {/* Import/Export Buttons */}
          <div className="flex items-center space-x-2">
            {/* Dropdown para exportar */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="flex items-center space-x-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Exportar</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={exportCategoriesToCSV}>
                  Exportar como CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportCategoriesToExcel}>
                  Exportar como Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <div className="relative">
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileImport}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                id="import-file"
              />
              <Button 
                variant="outline" 
                size="sm"
                className="flex items-center space-x-2"
                asChild
              >
                <label htmlFor="import-file" className="cursor-pointer">
                  <Upload className="w-4 h-4" />
                  <span>Importar</span>
                </label>
              </Button>
            </div>
          </div>
          
          <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center space-x-2 !text-white" style={{ color: 'white' }}>
                <Plus className="w-4 h-4" />
                <span className="!text-white" style={{ color: 'white' }}>Nueva Categoría</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Agregar Nueva Categoría</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="nombreCategoria"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre de la Categoría *</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej. Tecnología, Manufactura..." {...field} />
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
                      <FormLabel>Descripción</FormLabel>
                      <FormControl>
                        <RichTextEditor
                          value={field.value || ""}
                          onChange={field.onChange}
                          placeholder="Descripción de la categoría..."
                          height={120}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="icono"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Icono</FormLabel>
                      <FormControl>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona un icono">
                              {field.value && (() => {
                                const selectedIcon = availableIcons.find(icon => icon.name === field.value);
                                if (selectedIcon) {
                                  const IconComponent = selectedIcon.component;
                                  return (
                                    <div className="flex items-center gap-2">
                                      <IconComponent className="w-4 h-4" />
                                      <span>{selectedIcon.label}</span>
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {availableIcons.map((icon) => {
                              const IconComponent = icon.component;
                              return (
                                <SelectItem key={icon.name} value={icon.name}>
                                  <div className="flex items-center gap-2">
                                    <IconComponent className="w-4 h-4" />
                                    <span>{icon.label}</span>
                                  </div>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="iconoUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Icono Personalizado (Opcional)</FormLabel>
                      <FormControl>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  // Convert to base64 for preview
                                  const reader = new FileReader();
                                  reader.onloadend = () => {
                                    field.onChange(reader.result as string);
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                              className="hidden"
                              id="icon-upload"
                            />
                            <Label
                              htmlFor="icon-upload"
                              className="flex items-center gap-2 px-4 py-2 border border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50"
                            >
                              <Upload className="w-4 h-4" />
                              Subir Icono
                            </Label>
                            {field.value && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => field.onChange("")}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                          {field.value && (
                            <div className="flex items-center gap-2">
                              <img
                                src={field.value}
                                alt="Preview"
                                className="w-8 h-8 object-cover rounded"
                              />
                              <span className="text-sm text-gray-500">Vista previa del icono</span>
                            </div>
                          )}
                          <p className="text-xs text-gray-500">
                            Sube un icono personalizado (PNG, JPG, SVG). Recomendado: 32x32px
                          </p>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex items-center justify-end space-x-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={createCategoryMutation.isPending}>
                    {createCategoryMutation.isPending ? "Creando..." : "Crear Categoría"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Content Area */}
      {viewMode === "table" ? (
        <CategoryDataTable 
          categories={categories} 
          onEdit={handleEdit}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Categorías registradas ({categories.length})</CardTitle>
          </CardHeader>
          <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-gray-500">Cargando categorías...</div>
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-12">
              <Tags className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No hay categorías registradas</p>
              <p className="text-gray-400 text-sm">Crea la primera categoría para comenzar</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Fecha de Creación</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((category) => (
                    <TableRow key={category.id}>
                      <TableCell className="font-medium">
                        {category.nombreCategoria}
                      </TableCell>
                      <TableCell>
                        {category.descripcion ? (
                          <div 
                            className="text-sm prose prose-sm max-w-none"
                            dangerouslySetInnerHTML={{ __html: category.descripcion }}
                          />
                        ) : (
                          "Sin descripción"
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(category.createdAt).toLocaleDateString('es-ES')}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(category)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDelete(category.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
        </Card>
      )}

      {/* View Modal */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalles de la Categoría</DialogTitle>
          </DialogHeader>
          {selectedCategory && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Tags className="h-5 w-5 text-primary" />
                <h3 className="text-xl font-semibold">{selectedCategory.nombreCategoria}</h3>
              </div>
              
              {selectedCategory.descripcion && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Descripción</label>
                  <div 
                    className="text-sm text-gray-700 prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: selectedCategory.descripcion }}
                  />
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Categoría</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="nombreCategoria"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre de la Categoría *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ej. Tecnología, Manufactura..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="descripcion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descripción</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Descripción de la categoría..."
                        rows={3}
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="icono"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Icono</FormLabel>
                    <FormControl>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un icono">
                            {field.value && (() => {
                              const selectedIcon = availableIcons.find(icon => icon.name === field.value);
                              if (selectedIcon) {
                                const IconComponent = selectedIcon.component;
                                return (
                                  <div className="flex items-center gap-2">
                                    <IconComponent className="w-4 h-4" />
                                    <span>{selectedIcon.label}</span>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {availableIcons.map((icon) => {
                            const IconComponent = icon.component;
                            return (
                              <SelectItem key={icon.name} value={icon.name}>
                                <div className="flex items-center gap-2">
                                  <IconComponent className="w-4 h-4" />
                                  <span>{icon.label}</span>
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="iconoUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Icono Personalizado (Opcional)</FormLabel>
                    <FormControl>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                // Convert to base64 for preview
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  field.onChange(reader.result as string);
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                            className="hidden"
                            id="edit-icon-upload"
                          />
                          <Label
                            htmlFor="edit-icon-upload"
                            className="flex items-center gap-2 px-4 py-2 border border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50"
                          >
                            <Upload className="w-4 h-4" />
                            Subir Icono
                          </Label>
                          {field.value && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => field.onChange("")}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                        {field.value && (
                          <div className="flex items-center gap-2">
                            <img
                              src={field.value}
                              alt="Preview"
                              className="w-8 h-8 object-cover rounded"
                            />
                            <span className="text-sm text-gray-500">Vista previa del icono</span>
                          </div>
                        )}
                        <p className="text-xs text-gray-500">
                          Sube un icono personalizado (PNG, JPG, SVG). Recomendado: 32x32px
                        </p>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center justify-end space-x-2 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setSelectedCategory(null);
                  }}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={updateCategoryMutation.isPending}>
                  {updateCategoryMutation.isPending ? "Actualizando..." : "Actualizar Categoría"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
