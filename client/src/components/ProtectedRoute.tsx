import { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import Login from "@/pages/Login";

interface ProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
  disallowWordPressRepresentative?: boolean;
}

export default function ProtectedRoute({
  children,
  requireAdmin = false,
  disallowWordPressRepresentative = false,
}: ProtectedRouteProps) {
  const { user, loading, isAdmin, isWordPressSession } = useAuth();
  
  console.log("ProtectedRoute - loading:", loading, "user:", user, "isAdmin:", isAdmin, "requireAdmin:", requireAdmin);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center space-x-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Cargando...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  if (requireAdmin && !isAdmin) {
    // Redirect representatives automatically to their dashboard
    window.location.replace("/representative-dashboard?tab=overview");
    return null; // Don't render anything while redirecting
  }

  if (disallowWordPressRepresentative && isWordPressSession) {
    window.location.replace("/representative-dashboard?tab=overview");
    return null;
  }

  return <>{children}</>;
}
