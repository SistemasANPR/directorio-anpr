import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Building, Lock, Loader2, Eye, EyeOff, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const resetSchema = z
  .object({
    password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
    confirmPassword: z.string().min(8, "Confirma tu contraseña"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

type ResetFormData = z.infer<typeof resetSchema>;

function getTokenFromUrl(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("token") || "";
}

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [token] = useState<string>(getTokenFromUrl());
  const [tokenStatus, setTokenStatus] = useState<"checking" | "valid" | "invalid">("checking");
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const form = useForm<ResetFormData>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  // Validar el token al montar la pantalla.
  useEffect(() => {
    let active = true;
    const validate = async () => {
      if (!token || token.length < 20) {
        setTokenStatus("invalid");
        return;
      }
      try {
        const res = await fetch(
          `/api/reset-password/validate?token=${encodeURIComponent(token)}`,
          { credentials: "include" }
        );
        const data = await res.json();
        if (active) setTokenStatus(data.valid ? "valid" : "invalid");
      } catch {
        if (active) setTokenStatus("invalid");
      }
    };
    validate();
    return () => {
      active = false;
    };
  }, [token]);

  const onSubmit = async (data: ResetFormData) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          token,
          password: data.password,
          confirmPassword: data.confirmPassword,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "No se pudo restablecer la contraseña");
      }

      setSuccess(true);
      toast({
        title: "Contraseña actualizada",
        description: result.message || "Tu contraseña ha sido actualizada correctamente.",
      });
      // Redirigir al login tras confirmar.
      setTimeout(() => setLocation("/login"), 2500);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo restablecer la contraseña",
        variant: "destructive",
      });
      // Si el token dejó de ser válido, reflejarlo en la UI.
      if ((error.message || "").toLowerCase().includes("inválido") || (error.message || "").toLowerCase().includes("expirado")) {
        setTokenStatus("invalid");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4" data-testid="reset-password-page">
      <Card className="w-full max-w-md bg-white border border-gray-200 shadow-lg">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <div className="w-12 h-12 bg-[#1e40af] rounded-lg flex items-center justify-center">
              <Building className="text-white text-xl" />
            </div>
          </div>
          <CardTitle className="text-2xl text-center font-semibold text-gray-900">
            Nueva contraseña
          </CardTitle>
          <CardDescription className="text-center text-gray-600 text-sm">
            Crea una contraseña segura para tu cuenta
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {tokenStatus === "checking" && (
            <div className="flex flex-col items-center py-8 text-gray-600">
              <Loader2 className="h-8 w-8 animate-spin mb-3" />
              <p className="text-sm">Validando enlace…</p>
            </div>
          )}

          {tokenStatus === "invalid" && !success && (
            <div className="space-y-6 text-center">
              <div className="flex justify-center">
                <XCircle className="h-14 w-14 text-red-500" />
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">
                Este enlace de recuperación es inválido o ha expirado (los enlaces caducan en 60
                minutos). Solicita uno nuevo para continuar.
              </p>
              <Button
                type="button"
                className="w-full h-12 bg-[#1e40af] text-white hover:bg-[#1d4ed8] font-medium rounded-md"
                onClick={() => setLocation("/recuperar-contrasena")}
                data-testid="button-request-new"
              >
                Solicitar nuevo enlace
              </Button>
            </div>
          )}

          {success && (
            <div className="space-y-6 text-center">
              <div className="flex justify-center">
                <CheckCircle2 className="h-14 w-14 text-green-500" />
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">
                Tu contraseña fue actualizada correctamente. Te redirigiremos al inicio de sesión…
              </p>
              <Button
                type="button"
                className="w-full h-12 bg-[#1e40af] text-white hover:bg-[#1d4ed8] font-medium rounded-md"
                onClick={() => setLocation("/login")}
                data-testid="button-go-login"
              >
                Ir al inicio de sesión
              </Button>
            </div>
          )}

          {tokenStatus === "valid" && !success && (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">
                        Nueva contraseña
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="Mínimo 8 caracteres"
                            className="pl-10 pr-10 h-12 bg-gray-50 border-gray-300 text-gray-900 placeholder:text-gray-500 rounded-md"
                            {...field}
                            data-testid="input-password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                            tabIndex={-1}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium text-gray-700">
                        Confirmar contraseña
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                          <Input
                            type={showConfirm ? "text" : "password"}
                            placeholder="Repite la contraseña"
                            className="pl-10 pr-10 h-12 bg-gray-50 border-gray-300 text-gray-900 placeholder:text-gray-500 rounded-md"
                            {...field}
                            data-testid="input-confirm-password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirm((v) => !v)}
                            className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                            tabIndex={-1}
                          >
                            {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
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
                  Actualizar contraseña
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
