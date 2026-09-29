import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Building, Mail, Lock, Loader2 } from "lucide-react";
import { signInWithEmail } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "La contraseña es requerida"),
  rememberMe: z.boolean().default(false),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function RepresentativeLogin() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    
    try {
      // First try the temporary login for newly registered users
      const tempLoginResponse = await fetch("/api/login-temp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          email: data.email,
          password: data.password,
        }),
      });

      if (tempLoginResponse.ok) {
        const userData = await tempLoginResponse.json();
        
        // Store user data in localStorage for session management
        localStorage.setItem('tempUser', JSON.stringify(userData.user));
        
        console.log("User role detected:", userData.user.roleId, "Full user:", userData.user);
        console.log("Redirecting to representative dashboard");
        
        toast({
          title: "Sesión iniciada exitosamente",
          description: data.rememberMe 
            ? "Bienvenido de vuelta. Tu sesión será recordada."
            : "Bienvenido de vuelta",
        });
        
        queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
        
        // Force immediate redirect using window.location
        window.location.href = "/representative-dashboard?tab=overview";
        return;
      }

      // If temp login fails, try Firebase authentication (without Google)
      try {
        await signInWithEmail(data.email, data.password, data.rememberMe);
        
        toast({
          title: "Sesión iniciada exitosamente",
          description: data.rememberMe 
            ? "Bienvenido de vuelta. Tu sesión será recordada."
            : "Bienvenido de vuelta",
        });
        
        queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
        setLocation("/representative-dashboard?tab=overview");
      } catch (firebaseError) {
        throw new Error("Email o contraseña incorrectos");
      }
      
    } catch (error: any) {
      let errorMessage = "Ha ocurrido un error";
      
      if (error.code === "auth/user-not-found") {
        errorMessage = "No existe una cuenta con este email";
      } else if (error.code === "auth/wrong-password" || error.message.includes("incorrectos")) {
        errorMessage = "Contraseña incorrecta";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Email inválido";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Error al iniciar sesión",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4" data-testid="representative-login-page">
      <Card className="w-full max-w-md bg-white border border-gray-200 shadow-lg">
        <CardHeader className="space-y-1">
          {/* Icono AdminPlat */}
          <div className="flex items-center justify-center mb-4">
            <div className="w-12 h-12 bg-[#1e40af] rounded-lg flex items-center justify-center">
              <Building className="text-white text-xl" />
            </div>
          </div>
          
          {/* Título AdminPlat */}
          <CardTitle className="text-2xl text-center font-semibold text-gray-900">
            AdminPlat
          </CardTitle>
          
          {/* Subtítulo */}
          <CardDescription className="text-center text-gray-600 text-sm">
            Inicia sesión en tu cuenta
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              {/* Campo Email */}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-gray-700">Email</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input 
                          type="email" 
                          placeholder="tu@email.com" 
                          className="pl-10 h-12 bg-gray-50 border-gray-300 text-gray-900 placeholder:text-gray-500 rounded-md"
                          {...field} 
                          data-testid="input-email"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Campo Contraseña */}
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-gray-700">Contraseña</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input 
                          type="password" 
                          placeholder="••••••••" 
                          className="pl-10 h-12 bg-gray-50 border-gray-300 text-gray-900 placeholder:text-gray-500 rounded-md"
                          {...field} 
                          data-testid="input-password"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Checkbox Recordar sesión */}
              <FormField
                control={form.control}
                name="rememberMe"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="checkbox-remember"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="text-sm text-gray-700">
                        Recordar mi sesión
                      </FormLabel>
                    </div>
                  </FormItem>
                )}
              />

              {/* Botón Iniciar sesión */}
              <Button 
                type="submit" 
                className="w-full h-12 bg-[#1e40af] text-white hover:bg-[#1d4ed8] font-medium rounded-md" 
                disabled={isLoading}
                data-testid="button-submit"
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Iniciar sesión
              </Button>
            </form>
          </Form>

          {/* Link inferior para crear cuenta */}
          <div className="text-center text-sm">
            <span className="text-gray-600">¿No tienes cuenta? </span>
            <button
              type="button"
              onClick={() => window.location.href = "/planes#elige-tu-plan"}
              className="text-blue-600 hover:text-blue-800 hover:underline"
              disabled={isLoading}
              data-testid="link-signup"
            >
              Crea aquí
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}