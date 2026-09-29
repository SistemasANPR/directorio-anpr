import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Building, Mail, Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const forgotSchema = z.object({
  email: z.string().email("Email inválido"),
});

type ForgotFormData = z.infer<typeof forgotSchema>;

export default function ForgotPassword() {
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const form = useForm<ForgotFormData>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (data: ForgotFormData) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: data.email }),
      });
      const result = await response.json();

      // Correo no registrado: advertencia explícita, sin pasar a "enviado".
      if (response.status === 404 || result?.notFound) {
        form.setError("email", {
          type: "manual",
          message: "Correo no encontrado",
        });
        toast({
          title: "Correo no encontrado",
          description:
            result?.error ||
            "Este correo no está registrado. Verifica que esté escrito correctamente o regístrate.",
          variant: "destructive",
        });
        return;
      }

      // Cualquier otro error (validación, rate limit, fallo de envío).
      if (!response.ok || result?.success === false) {
        toast({
          title: "No se pudo procesar",
          description: result?.error || "Inténtalo de nuevo en unos minutos.",
          variant: "destructive",
        });
        return;
      }

      // Envío exitoso real.
      setSubmitted(true);
      toast({
        title: "Correo enviado",
        description:
          result.message ||
          "Te enviamos un enlace para restablecer tu contraseña. Revisa tu bandeja de entrada.",
      });
    } catch (error) {
      toast({
        title: "Error de conexión",
        description: "No se pudo conectar con el servidor. Inténtalo de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4" data-testid="forgot-password-page">
      <Card className="w-full max-w-md bg-white border border-gray-200 shadow-lg">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <div className="w-12 h-12 bg-[#1e40af] rounded-lg flex items-center justify-center">
              <Building className="text-white text-xl" />
            </div>
          </div>
          <CardTitle className="text-2xl text-center font-semibold text-gray-900">
            Recuperar contraseña
          </CardTitle>
          <CardDescription className="text-center text-gray-600 text-sm">
            {submitted
              ? "Revisa tu bandeja de entrada"
              : "Ingresa tu correo y te enviaremos instrucciones"}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {submitted ? (
            <div className="space-y-6 text-center">
              <div className="flex justify-center">
                <CheckCircle2 className="h-14 w-14 text-green-500" />
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">
                Si el correo está registrado, recibirás un mensaje desde{" "}
                <span className="font-medium text-gray-800">Sistemas@anpr.org.mx</span> con un
                enlace para restablecer tu contraseña. El enlace caduca en 60 minutos.
              </p>
              <Button
                type="button"
                className="w-full h-12 bg-[#1e40af] text-white hover:bg-[#1d4ed8] font-medium rounded-md"
                onClick={() => setLocation("/login")}
                data-testid="button-back-to-login"
              >
                Volver al inicio de sesión
              </Button>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
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

                <Button
                  type="submit"
                  className="w-full h-12 bg-[#1e40af] text-white hover:bg-[#1d4ed8] font-medium rounded-md"
                  disabled={isLoading}
                  data-testid="button-submit"
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Enviar instrucciones
                </Button>
              </form>
            </Form>
          )}

          {!submitted && (
            <div className="text-center text-sm">
              <button
                type="button"
                onClick={() => setLocation("/login")}
                className="inline-flex items-center text-blue-600 hover:text-blue-800 hover:underline"
                disabled={isLoading}
                data-testid="link-back-to-login"
              >
                <ArrowLeft className="mr-1 h-4 w-4" />
                Volver al inicio de sesión
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
