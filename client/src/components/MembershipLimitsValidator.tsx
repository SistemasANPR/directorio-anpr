import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Package, Briefcase, Crown, CheckCircle, XCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface LimitsData {
  planName: string;
  projects: {
    limit: number;
    current: number;
    available: number;
  };
  products: {
    limit: number;
    current: number;
    available: number;
  };
}

interface MembershipLimitsValidatorProps {
  companyId: number;
  additionalProducts?: number; // Productos adicionales que se van a agregar
  additionalProjects?: number; // Proyectos adicionales que se van a agregar
  onLimitsChange?: (canAddProducts: boolean, canAddProjects: boolean) => void;
}

export default function MembershipLimitsValidator({ 
  companyId, 
  additionalProducts = 0, 
  additionalProjects = 0,
  onLimitsChange 
}: MembershipLimitsValidatorProps) {
  const [canAddProducts, setCanAddProducts] = useState(false);
  const [canAddProjects, setCanAddProjects] = useState(false);

  const { data: limits, isLoading, isFetching, error } = useQuery<LimitsData>({
    queryKey: [`/api/companies/${companyId}/limits`],
    enabled: !!companyId,
    staleTime: 0,
    refetchOnMount: "always",
  });

  useEffect(() => {
    if (limits && !isFetching && !error) {
      // Verificar si se pueden agregar productos adicionales
      const newCanAddProducts = limits.products.limit === -1 || 
        (limits.products.current + additionalProducts) <= limits.products.limit;
      
      // Verificar si se pueden agregar proyectos adicionales
      const newCanAddProjects = limits.projects.limit === -1 || 
        (limits.projects.current + additionalProjects) <= limits.projects.limit;
      
      setCanAddProducts(newCanAddProducts);
      setCanAddProjects(newCanAddProjects);
      
      // Notificar cambios al componente padre
      if (onLimitsChange) {
        onLimitsChange(newCanAddProducts, newCanAddProjects);
      }
    } else {
      setCanAddProducts(false);
      setCanAddProjects(false);
      onLimitsChange?.(false, false);
    }
  }, [limits, isFetching, error, additionalProducts, additionalProjects, onLimitsChange]);

  const getProgressColor = (current: number, limit: number): string => {
    if (limit === -1) return "#10b981"; // Verde para ilimitado
    if (limit === 0) return "#ef4444";
    const percentage = (current / limit) * 100;
    if (percentage >= 100) return "#ef4444"; // Rojo
    if (percentage >= 80) return "#f59e0b"; // Amarillo
    return "#10b981"; // Verde
  };

  const getValidationIcon = (canAdd: boolean) => {
    return canAdd ? 
      <CheckCircle className="h-4 w-4 text-green-600" /> : 
      <XCircle className="h-4 w-4 text-red-600" />;
  };

  const formatLimit = (limit: number): string => {
    return limit === -1 ? "Sin límite" : limit.toString();
  };

  const getProgressPercentage = (current: number, limit: number): number => {
    if (limit <= 0) return limit === 0 ? 100 : 0;
    return Math.min(100, Math.max(0, (current / limit) * 100));
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5" />
            Validación de Límites
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !limits) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5" />
            Validación de Límites
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              No se pudieron cargar los límites del plan de membresía.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Crown className="h-5 w-5" />
          Límites del Plan: {limits.planName}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Validación de Productos */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              <span className="font-medium">Productos</span>
              {getValidationIcon(canAddProducts)}
            </div>
            <Badge variant={canAddProducts ? "default" : "destructive"}>
              {limits.products.limit === -1 ? (
                "Sin límite"
              ) : (
                `${limits.products.current + additionalProducts}/${limits.products.limit}`
              )}
            </Badge>
          </div>
          
          {limits.products.limit !== -1 && (
            <>
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Actual: {limits.products.current}</span>
                {additionalProducts > 0 && (
                  <span>Agregando: +{additionalProducts}</span>
                )}
                <span>Límite: {formatLimit(limits.products.limit)}</span>
              </div>
              <div 
                className="w-full bg-gray-200 rounded-full h-2 mb-2"
                style={{
                  background: `linear-gradient(to right, ${getProgressColor(limits.products.current + additionalProducts, limits.products.limit)} 0%, ${getProgressColor(limits.products.current + additionalProducts, limits.products.limit)} ${getProgressPercentage(limits.products.current + additionalProducts, limits.products.limit)}%, #e5e7eb ${getProgressPercentage(limits.products.current + additionalProducts, limits.products.limit)}%, #e5e7eb 100%)`
                }}
              />
              {!canAddProducts && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Has alcanzado el límite de productos. Actualiza tu plan para agregar más productos.
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </div>

        {/* Validación de Proyectos */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              <span className="font-medium">Proyectos</span>
              {getValidationIcon(canAddProjects)}
            </div>
            <Badge variant={canAddProjects ? "default" : "destructive"}>
              {limits.projects.limit === -1 ? (
                "Sin límite"
              ) : (
                `${limits.projects.current + additionalProjects}/${limits.projects.limit}`
              )}
            </Badge>
          </div>
          
          {limits.projects.limit !== -1 && (
            <>
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Actual: {limits.projects.current}</span>
                {additionalProjects > 0 && (
                  <span>Agregando: +{additionalProjects}</span>
                )}
                <span>Límite: {formatLimit(limits.projects.limit)}</span>
              </div>
              <div 
                className="w-full bg-gray-200 rounded-full h-2 mb-2"
                style={{
                  background: `linear-gradient(to right, ${getProgressColor(limits.projects.current + additionalProjects, limits.projects.limit)} 0%, ${getProgressColor(limits.projects.current + additionalProjects, limits.projects.limit)} ${getProgressPercentage(limits.projects.current + additionalProjects, limits.projects.limit)}%, #e5e7eb ${getProgressPercentage(limits.projects.current + additionalProjects, limits.projects.limit)}%, #e5e7eb 100%)`
                }}
              />
              {!canAddProjects && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Has alcanzado el límite de proyectos. Actualiza tu plan para agregar más proyectos.
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </div>

        {/* Mensaje de validación general */}
        {additionalProducts > 0 || additionalProjects > 0 ? (
          <div className="mt-4 p-3 rounded-lg bg-blue-50 border border-blue-200">
            <div className="flex items-center gap-2 text-blue-800">
              {canAddProducts && canAddProjects ? (
                <>
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">Validación exitosa - Puedes continuar</span>
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">Límites excedidos - Actualiza tu plan</span>
                </>
              )}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}