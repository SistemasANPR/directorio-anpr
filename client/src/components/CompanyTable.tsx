import { useState } from "react";
import { useLocation } from "wouter";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Eye, Edit, Trash2, MoreHorizontal, Building, UserCheck, Tag, Code, Cog, ShoppingCart, Truck, Heart, Home, Users, Briefcase, Factory, Hammer, Lightbulb, Globe, Wrench, Calendar, Coffee, MapPin } from "lucide-react";
import { CompanyWithDetails } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";

interface CompanyTableProps {
  companies: CompanyWithDetails[];
  onEdit: (company: CompanyWithDetails) => void;
  onDelete: (companyId: number) => void;
  onView: (company: CompanyWithDetails) => void;
  onImpersonate?: (company: CompanyWithDetails) => void;
}

const getMembershipBadgeColor = (membershipType?: string) => {
  switch (membershipType?.toLowerCase()) {
    case "enterprise":
      return "bg-orange-100 text-orange-800";
    case "premium":
      return "bg-yellow-100 text-yellow-800";
    case "básico":
    case "basico":
      return "bg-gray-100 text-gray-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

const getCategoryBadgeColor = (category?: string) => {
  switch (category?.toLowerCase()) {
    case "tecnología":
    case "tecnologia":
      return "bg-blue-100 text-blue-800";
    case "manufactura":
      return "bg-green-100 text-green-800";
    case "servicios":
      return "bg-purple-100 text-purple-800";
    case "comercio":
      return "bg-indigo-100 text-indigo-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

const getCountryFromLocation = (ubicacionGeografica: any, direccionFisica?: string): string | null => {
  let address = '';
  
  if (ubicacionGeografica) {
    address = ubicacionGeografica.address || ubicacionGeografica.direccion || '';
  }
  
  if (!address && direccionFisica) {
    address = direccionFisica;
  }
  
  if (!address) return null;
  
  const addressParts = address.split(',').map((part: string) => part.trim());
  if (addressParts.length === 0) return null;
  
  const lastPart = addressParts[addressParts.length - 1];
  if (lastPart && lastPart.length > 1) {
    return lastPart;
  }
  
  return null;
};

const getCategoryIcon = (iconName?: string, iconUrl?: string) => {
  // If there's a custom icon URL, use it as an image
  if (iconUrl) {
    return <img src={iconUrl} alt="Category" className="w-4 h-4 object-contain" />;
  }
  
  // Otherwise, use Lucide icons
  const iconMap: Record<string, React.ComponentType<any>> = {
    'Tags': Tag,
    'Code': Code,
    'Cog': Cog,
    'ShoppingCart': ShoppingCart,
    'Truck': Truck,
    'Heart': Heart,
    'Home': Home,
    'Users': Users,
    'Briefcase': Briefcase,
    'Factory': Factory,
    'Hammer': Hammer,
    'Lightbulb': Lightbulb,
    'Globe': Globe,
    'Wrench': Wrench,
    'Calendar': Calendar,
    'Coffee': Coffee,
    'Building': Building,
    'Zap': Lightbulb,
  };
  
  const IconComponent = iconMap[iconName || 'Tags'] || Tag;
  return <IconComponent className="w-4 h-4" />;
};

export default function CompanyTable({ companies, onEdit, onDelete, onView, onImpersonate }: CompanyTableProps) {
  const { isAdmin, user } = useAuth();
  const [, setLocation] = useLocation();

  if (companies.length === 0) {
    return (
      <div className="text-center py-8">
        <Building className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">No se encontraron empresas</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-left py-3 px-4 font-semibold text-gray-700">
              Empresa
            </TableHead>
            <TableHead className="text-left py-3 px-4 font-semibold text-gray-700">
              Categoría
            </TableHead>
            <TableHead className="text-left py-3 px-4 font-semibold text-gray-700">
              Ubicación
            </TableHead>
            <TableHead className="text-left py-3 px-4 font-semibold text-gray-700">
              Plan
            </TableHead>
            <TableHead className="text-left py-3 px-4 font-semibold text-gray-700">
              Representante
            </TableHead>
            <TableHead className="text-left py-3 px-4 font-semibold text-gray-700">
              Estado
            </TableHead>
            <TableHead className="text-left py-3 px-4 font-semibold text-gray-700">
              Acciones
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {companies.map((company) => {
            const canEdit = isAdmin || company.userId === user?.id;
            
            return (
              <TableRow key={company.id} className="hover:bg-gray-50">
                <TableCell className="py-4 px-4">
                  <div className="flex items-center space-x-3">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={company.logotipoUrl || ""} alt={company.nombreEmpresa} />
                      <AvatarFallback>
                        <Building className="w-5 h-5" />
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-gray-900">{company.nombreEmpresa}</p>
                      <p className="text-sm text-gray-500">{company.email1}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="py-4 px-4">
                  {company.categories && company.categories.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {company.categories.slice(0, 3).map((category) => (
                        <div key={category.id} className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors" title={category.nombreCategoria}>
                          {getCategoryIcon(category.icono ?? undefined, category.iconoUrl ?? undefined)}
                        </div>
                      ))}
                      {company.categories.length > 3 && (
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-xs text-gray-600" title={`${company.categories.length - 3} categorías más`}>
                          +{company.categories.length - 3}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400">Sin categorías</span>
                  )}
                </TableCell>
                <TableCell className="py-4 px-4 text-gray-600">
                  {(() => {
                    const country = getCountryFromLocation(company.ubicacionGeografica, company.direccionFisica);
                    if (country) {
                      return (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-gray-400" />
                          <span className="text-sm">{country}</span>
                        </div>
                      );
                    }
                    return <span className="text-sm text-gray-400">No especificada</span>;
                  })()}
                </TableCell>
                <TableCell className="py-4 px-4">
                  {company.membershipType && (
                    <div className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getMembershipBadgeColor(company.membershipType.nombrePlan)}`}>
                      {company.membershipType.nombrePlan}
                    </div>
                  )}
                </TableCell>
                <TableCell className="py-4 px-4">
                  {company.user ? (
                    <div className="flex items-center space-x-2">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="text-xs">
                          {company.user.displayName?.charAt(0).toUpperCase() || company.user.email.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{company.user.displayName || company.user.email}</p>
                        <p className="text-xs text-gray-500">{company.user.email}</p>
                      </div>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400">Sin asignar</span>
                  )}
                </TableCell>
                <TableCell className="py-4 px-4">
                  <div className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-green-100 text-green-800">
                    {company.estado === "activo" ? "Activo" : company.estado}
                  </div>
                </TableCell>
                <TableCell className="py-4 px-4">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setLocation(`/empresa/${company.id}`)}>
                        <Eye className="mr-2 h-4 w-4" />
                        Ver
                      </DropdownMenuItem>
                      {canEdit && (
                        <DropdownMenuItem onClick={() => onEdit(company)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                      )}
                      {isAdmin && onImpersonate && (
                        <DropdownMenuItem onClick={() => onImpersonate(company)}>
                          <UserCheck className="mr-2 h-4 w-4" />
                          Actuar como Representante
                        </DropdownMenuItem>
                      )}
                      {isAdmin && (
                        <DropdownMenuItem 
                          onClick={() => onDelete(company.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Eliminar
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
