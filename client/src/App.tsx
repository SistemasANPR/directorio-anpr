import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import Sidebar from "@/components/Sidebar";
import RepresentativeSidebar from "@/components/RepresentativeSidebar";
import { useAuth } from "@/hooks/useAuth";
import Dashboard from "@/pages/Dashboard";
import Companies from "@/pages/Companies";
import MyCompany from "@/pages/MyCompany";
import Categories from "@/pages/Categories";
import Tags from "@/pages/Tags";
import MembershipsNew from "@/pages/MembershipsNew";
import Users from "@/pages/Users";
import Certificates from "@/pages/Certificates";
import Roles from "@/pages/Roles";
import Reports from "@/pages/Reports";
import Testimonials from "@/pages/Testimonials";
import ReviewsAdmin from "@/pages/ReviewsAdmin";
import Login from "@/pages/Login";
import Home from "@/pages/Home";
import CompanyDetails from "@/pages/CompanyDetails";
import PublicMemberships from "@/pages/PublicMemberships";
import Directory from "@/pages/Directory";
import MembershipCheckout from "@/pages/MembershipCheckout";
import RepresentativeLogin from "@/pages/RepresentativeLogin";
import RepresentativeDashboard from "@/pages/RepresentativeDashboardComplete";
import RegisterAndPay from "@/pages/RegisterAndPay";
import RegistroExitoso from "@/pages/RegistroExitoso";
import SystemSettings from "@/pages/SystemSettings";
import PdfSettings from "@/pages/PdfSettings";
import EmailConfigurationPage from "@/pages/EmailConfigurationPage";
import StripeConfiguration from "@/pages/StripeConfiguration";
import FrontendConfiguration from "@/pages/FrontendConfiguration";
import ConfigurarCuenta from "@/pages/ConfigurarCuenta";
import ActivarCuenta from "@/pages/ActivarCuenta";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";

import ExportarDirectorio from "@/pages/ExportarDirectorio";
import IntegrationSettings from "@/pages/IntegrationSettings";
import WordPressMembershipTest from "@/pages/WordPressMembershipTest";
import MainNavigation from "@/components/MainNavigation";
import Footer from "@/components/Footer";
import TestHome from "@/TestHome";
import NotFound from "@/pages/not-found";
import PasswordChangeWrapper from "@/components/PasswordChangeWrapper";
import ScrollRestoration from "@/components/ScrollRestoration";

function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin } = useAuth();
  
  return (
    <div className="min-h-screen flex bg-background">
      {isAdmin ? <Sidebar /> : <RepresentativeSidebar />}
      <main className="flex-1 ml-0 lg:ml-64 min-w-0 w-full">
        <div className="p-6 pt-20 lg:pt-6 w-full">
          {children}
        </div>
      </main>
    </div>
  );
}

function RepresentativeLayout({ children }: { children: React.ReactNode }) {
  console.log("RepresentativeLayout rendering with children:", children);
  return (
    <div className="min-h-screen flex bg-background">
      <RepresentativeSidebar />
      <main className="flex-1 ml-0 lg:ml-80 min-w-0 w-full">
        <div className="p-6 pt-20 lg:pt-6 w-full">
          {children}
        </div>
      </main>
    </div>
  );
}

function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <MainNavigation />
      <main>
        {children}
      </main>
      <Footer />
    </div>
  );
}

function Router() {
  return (
    <div>
      <Route path="/login">
        <Login />
      </Route>
      
      <Route path="/activar-cuenta">
        <ActivarCuenta />
      </Route>

      <Route path="/recuperar-contrasena">
        <ForgotPassword />
      </Route>

      <Route path="/restablecer-contrasena">
        <ResetPassword />
      </Route>

      <Route path="/dashboard">
        <ProtectedRoute>
          <AppLayout>
            <Dashboard />
          </AppLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/empresas">
        <ProtectedRoute>
          <AppLayout>
            <Companies />
          </AppLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/mi-empresa">
        <ProtectedRoute>
          <AppLayout>
            <MyCompany />
          </AppLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/categorias">
        <ProtectedRoute>
          <AppLayout>
            <Categories />
          </AppLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/etiquetas">
        <ProtectedRoute requireAdmin>
          <AppLayout>
            <Tags />
          </AppLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/membresias">
        <ProtectedRoute>
          <AppLayout>
            <MembershipsNew />
          </AppLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/usuarios">
        <ProtectedRoute requireAdmin>
          <AppLayout>
            <Users />
          </AppLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/certificados">
        <ProtectedRoute>
          <AppLayout>
            <Certificates />
          </AppLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/configurar-cuenta">
        <ProtectedRoute disallowWordPressRepresentative>
          <ConfigurarCuenta />
        </ProtectedRoute>
      </Route>
      
      <Route path="/roles">
        <ProtectedRoute requireAdmin>
          <AppLayout>
            <Roles />
          </AppLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/reportes">
        <ProtectedRoute requireAdmin>
          <AppLayout>
            <Reports />
          </AppLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/testimonios">
        <ProtectedRoute>
          <AppLayout>
            <Testimonials />
          </AppLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/admin/reviews">
        <ProtectedRoute requireAdmin>
          <AppLayout>
            <ReviewsAdmin />
          </AppLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/configuracion">
        <ProtectedRoute requireAdmin>
          <AppLayout>
            <SystemSettings />
          </AppLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/configuracion-pdf">
        <ProtectedRoute requireAdmin>
          <AppLayout>
            <PdfSettings />
          </AppLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/admin/email-config">
        <ProtectedRoute requireAdmin>
          <AppLayout>
            <EmailConfigurationPage />
          </AppLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/admin/configuracion-stripe">
        <ProtectedRoute requireAdmin>
          <AppLayout>
            <StripeConfiguration />
          </AppLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/configuracion-sistema">
        <ProtectedRoute requireAdmin>
          <AppLayout>
            <SystemSettings />
          </AppLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/exportar-directorio">
        <ProtectedRoute requireAdmin>
          <AppLayout>
            <ExportarDirectorio />
          </AppLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/integracion">
        <ProtectedRoute requireAdmin>
          <AppLayout>
            <IntegrationSettings />
          </AppLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/wordpress-membership-test">
        <ProtectedRoute requireAdmin>
          <AppLayout>
            <WordPressMembershipTest />
          </AppLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/configuracion-frontend">
        <ProtectedRoute requireAdmin>
          <AppLayout>
            <FrontendConfiguration />
          </AppLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/empresa/:id">
        <PublicLayout>
          <CompanyDetails />
        </PublicLayout>
      </Route>
      
      <Route path="/directorio/empresas/:id">
        <PublicLayout>
          <CompanyDetails />
        </PublicLayout>
      </Route>
      
      <Route path="/checkout/:companyId/:membershipTypeId">
        <PublicLayout>
          <MembershipCheckout />
        </PublicLayout>
      </Route>
      
      <Route path="/checkout-plan/:membershipTypeId">
        <PublicLayout>
          <MembershipCheckout />
        </PublicLayout>
      </Route>
      
      
      <Route path="/registro-y-pago">
        <PublicLayout>
          <RegisterAndPay />
        </PublicLayout>
      </Route>
      
      <Route path="/registro-exitoso">
        <PublicLayout>
          <RegistroExitoso />
        </PublicLayout>
      </Route>
      
      <Route path="/login-representante">
        <PublicLayout>
          <RepresentativeLogin />
        </PublicLayout>
      </Route>
      
      <Route path="/representative-dashboard">
        <ProtectedRoute>
          <RepresentativeLayout>
            <RepresentativeDashboard />
          </RepresentativeLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/dashboard-representante">
        <ProtectedRoute>
          <RepresentativeLayout>
            <RepresentativeDashboard />
          </RepresentativeLayout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/directorio">
        <PublicLayout>
          <Directory />
        </PublicLayout>
      </Route>
      
      <Route path="/planes">
        <PublicLayout>
          <PublicMemberships />
        </PublicLayout>
      </Route>
      
      <Route path="/">
        <PublicLayout>
          <Home />
        </PublicLayout>
      </Route>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PasswordChangeWrapper>
          <TooltipProvider>
            <ScrollRestoration />
            <Toaster />
            <Router />
          </TooltipProvider>
        </PasswordChangeWrapper>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
