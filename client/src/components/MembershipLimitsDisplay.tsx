import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Package, Briefcase, Crown, CheckCircle, XCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface MembershipType {
  cantidadProductosAdmitidos?: number | null;
  cantidadProyectosAdmitidos?: number | null;
  nombrePlan?: string;
}

interface MembershipLimitsDisplayProps {
  membershipType: MembershipType;
  productCount: number;
  projectCount: number;
  className?: string;
}

export default function MembershipLimitsDisplay({ 
  membershipType, 
  productCount, 
  projectCount,
  className = "" 
}: MembershipLimitsDisplayProps) {
  
  const formatLimit = (limit: number | null | undefined): string => {
    if (limit === null || limit === undefined || limit === -1) {
      return "Sin límite";
    }
    return limit.toString();
  };

  const getProgressColor = (current: number, limit: number | null | undefined): string => {
    if (limit === null || limit === undefined || limit === -1) return "#10b981"; // Verde para ilimitado
    const percentage = (current / limit) * 100;
    if (percentage >= 100) return "#ef4444"; // Rojo
    if (percentage >= 80) return "#f59e0b"; // Amarillo
    return "#10b981"; // Verde
  };

  const getValidationIcon = (current: number, limit: number | null | undefined) => {
    if (limit === null || limit === undefined || limit === -1) {
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    }
    return current <= limit ? 
      <CheckCircle className="h-4 w-4 text-green-600" /> : 
      <XCircle className="h-4 w-4 text-red-600" />;
  };

  if (!membershipType) {
    return (
      <Alert className={className}>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          No se pudo cargar la información del plan de membresía.
        </AlertDescription>
      </Alert>
    );
  }

  const canAddProducts = membershipType.cantidadProductosAdmitidos === -1 || 
    membershipType.cantidadProductosAdmitidos === null || 
    productCount <= (membershipType.cantidadProductosAdmitidos || 0);

  const canAddProjects = membershipType.cantidadProyectosAdmitidos === -1 || 
    membershipType.cantidadProyectosAdmitidos === null || 
    projectCount <= (membershipType.cantidadProyectosAdmitidos || 0);

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Crown className="h-4 w-4" />
          Validación de Límites
          <Badge variant="outline">{membershipType.nombrePlan || "Plan no especificado"}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Validación de Productos */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              <span className="font-medium">Productos</span>
              {getValidationIcon(productCount, membershipType.cantidadProductosAdmitidos)}
            </div>
            <div className="text-sm text-gray-600">
              {productCount} de {formatLimit(membershipType.cantidadProductosAdmitidos)} usados
            </div>
          </div>

          {membershipType.cantidadProductosAdmitidos !== -1 && 
           membershipType.cantidadProductosAdmitidos !== null && 
           membershipType.cantidadProductosAdmitidos !== undefined ? (
            <>
              <div className="flex justify-between text-sm text-gray-600">
                <span>{productCount} de {membershipType.cantidadProductosAdmitidos} usados</span>
                <span>{Math.max(0, membershipType.cantidadProductosAdmitidos - productCount)} disponibles</span>
              </div>
              <Progress 
                value={(productCount / membershipType.cantidadProductosAdmitidos) * 100} 
                className="h-2 mt-2"
                style={{ backgroundColor: getProgressColor(productCount, membershipType.cantidadProductosAdmitidos) + "20" }}
              />
              {!canAddProducts && (
                <Alert className="mt-2">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Has alcanzado el límite de productos para tu plan actual.
                  </AlertDescription>
                </Alert>
              )}
            </>
          ) : (
            <div className="text-sm text-gray-600">
              Sin límite de productos en este plan
            </div>
          )}
        </div>

        {/* Validación de Proyectos */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              <span className="font-medium">Proyectos</span>
              {getValidationIcon(projectCount, membershipType.cantidadProyectosAdmitidos)}
            </div>
            <div className="text-sm text-gray-600">
              {projectCount} de {formatLimit(membershipType.cantidadProyectosAdmitidos)} usados
            </div>
          </div>

          {membershipType.cantidadProyectosAdmitidos !== -1 && 
           membershipType.cantidadProyectosAdmitidos !== null && 
           membershipType.cantidadProyectosAdmitidos !== undefined ? (
            <>
              <div className="flex justify-between text-sm text-gray-600">
                <span>{projectCount} de {membershipType.cantidadProyectosAdmitidos} usados</span>
                <span>{Math.max(0, membershipType.cantidadProyectosAdmitidos - projectCount)} disponibles</span>
              </div>
              <Progress 
                value={(projectCount / membershipType.cantidadProyectosAdmitidos) * 100} 
                className="h-2 mt-2"
                style={{ backgroundColor: getProgressColor(projectCount, membershipType.cantidadProyectosAdmitidos) + "20" }}
              />
              {!canAddProjects && (
                <Alert className="mt-2">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Has alcanzado el límite de proyectos para tu plan actual.
                  </AlertDescription>
                </Alert>
              )}
            </>
          ) : (
            <div className="text-sm text-gray-600">
              Sin límite de proyectos en este plan
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}