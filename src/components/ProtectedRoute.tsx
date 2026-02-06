import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: "admin" | "volunteer";
}

export function ProtectedRoute({ children, requiredRole = "admin" }: ProtectedRouteProps) {
  const { user, role, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }

  if (requiredRole && role !== requiredRole) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-display font-bold text-destructive">Acceso Denegado</h2>
          <p className="text-muted-foreground">No tienes permisos para acceder a esta sección.</p>
          <a href="/" className="text-primary hover:underline text-sm">Volver al inicio</a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
