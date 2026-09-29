import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  MoreHorizontal, Edit, Trash2, Eye, Tags,
  Building2, Car, Truck, Hammer, Factory, Cpu, Wrench, ShoppingBag,
  Briefcase, Heart, GraduationCap, Home, Coffee, Camera, Music,
  Gamepad2, Book, Palette, MapPin, Plane, Ship, Train, Zap
} from "lucide-react";
import { Category } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Swal from 'sweetalert2';

interface CategoryDataTableProps {
  categories: Category[];
  onEdit: (category: Category) => void;
}

// Map of icon names to components
const iconMap = {
  Tags, Building2, Car, Truck, Hammer, Factory, Cpu, Wrench, ShoppingBag,
  Briefcase, Heart, GraduationCap, Home, Coffee, Camera, Music,
  Gamepad2, Book, Palette, MapPin, Plane, Ship, Train, Zap
};

export default function CategoryDataTable({ categories, onEdit }: CategoryDataTableProps) {
  const { toast } = useToast();

  // Function to render the correct icon
  const renderCategoryIcon = (category: Category) => {
    // If custom icon URL exists, use it
    if (category.iconoUrl) {
      return (
        <img
          src={category.iconoUrl}
          alt={category.nombreCategoria}
          className="w-5 h-5 object-cover rounded"
        />
      );
    }

    // Otherwise use Lucide icon
    const iconName = category.icono || "Tags";
    const IconComponent = iconMap[iconName as keyof typeof iconMap] || Tags;
    return <IconComponent className="w-5 h-5 text-primary" />;
  };

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

  const getBadgeVariant = (categoryName: string) => {
    switch (categoryName.toLowerCase()) {
      case "tecnología":
      case "tecnologia":
        return "default";
      case "manufactura":
        return "secondary";
      case "servicios":
        return "outline";
      case "comercio":
        return "secondary";
      default:
        return "outline";
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center space-x-2">
          <Tags className="h-5 w-5 text-primary" />
          <CardTitle>Categorías de Empresas</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {categories.length === 0 ? (
          <div className="text-center py-8">
            <Tags className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No hay categorías registradas</p>
            <p className="text-gray-400 text-sm">Crea la primera categoría para comenzar</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((category) => (
                  <TableRow key={category.id} className="hover:bg-gray-50">
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        {renderCategoryIcon(category)}
                        <Badge variant={getBadgeVariant(category.nombreCategoria)}>
                          {category.nombreCategoria}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-xs">
                        {category.descripcion ? (
                          <div 
                            className="text-sm text-gray-900 truncate prose prose-sm max-w-none"
                            dangerouslySetInnerHTML={{ __html: category.descripcion }}
                          />
                        ) : (
                          <p className="text-sm text-gray-900 truncate">Sin descripción</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        Activa
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onEdit(category)}>
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
  );
}