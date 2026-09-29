import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Lock, Mail, KeyRound, CheckCircle2, Info } from "lucide-react";
import { useLocation } from "wouter";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Alert, AlertDescription } from "@/components/ui/alert";

const activationSchema = z.object({
  email: z.string().email("Email inválido"),
  tempPassword: z.string().min(1, "La contraseña temporal es requerida"),
  newPassword: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  confirmPassword: z.string().min(8, "Confirma tu contraseña"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

type ActivationFormData = z.infer<typeof activationSchema>;

export default function ActivarCuenta() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isActivating, setIsActivating] = useState(false);
  const [verifiedUser, setVerifiedUser] = useState<any>(null);

  const form = useForm<ActivationFormData>({
    resolver: zodResolver(activationSchema),
    defaultValues: {
      email: "",
      tempPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data: ActivationFormData) => {
    setIsActivating(true);

    try {
      // Step 1: Verify temporary password
      const verifyResponse = await fetch("/api/verify-temp-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.email,
          tempPassword: data.tempPassword,
        }),
      });

      if (!verifyResponse.ok) {
        const error = await verifyResponse.json();
        throw new Error(error.error || "Contraseña temporal incorrecta");
      }

      const verifyData = await verifyResponse.json();
      setVerifiedUser(verifyData.user);

      // Step 2: Create Firebase account with new password
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        data.email,
        data.newPassword
      );

      // Step 3: Update database with new Firebase UID
      const activateResponse = await fetch("/api/activate-wordpress-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: verifyData.user.id,
          firebaseUid: userCredential.user.uid,
        }),
      });

      if (!activateResponse.ok) {
        throw new Error("Error al activar la cuenta");
      }

      // Step 4: Sign in automatically after activation
      await signInWithEmailAndPassword(auth, data.email, data.newPassword);

      // Get user role to redirect appropriately
      const userRole = verifyData.user.role;

      toast({
        title: "¡Cuenta activada!",
        description: "Tu cuenta ha sido activada correctamente. Redirigiendo...",
      });

      // Redirect based on role
      setTimeout(() => {
        if (userRole === 'admin') {
          setLocation("/admin/dashboard");
        } else if (userRole === 'representante') {
          setLocation("/representative/dashboard");
        } else {
          setLocation("/");
        }
      }, 1500);

    } catch (error: any) {
      console.error("Activation error:", error);
      
      let errorMessage = "No se pudo activar la cuenta";
      
      if (error.code === "auth/email-already-in-use") {
        errorMessage = "Este email ya tiene una cuenta de Firebase. Intenta iniciar sesión directamente.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsActivating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f2161] to-[#1a3278] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-[#bcce16] rounded-full flex items-center justify-center mb-4">
              <Lock className="w-6 h-6 text-[#0f2161]" />
            </div>
            <CardTitle className="text-2xl">Activar tu Cuenta</CardTitle>
            <CardDescription>
              Configura tu contraseña para acceder a tu cuenta ANPR
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert className="mb-6">
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Contraseña temporal:</strong> ANPR2024!
                <br />
                Usa esta contraseña temporal para activar tu cuenta.
              </AlertDescription>
            </Alert>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {/* Email */}
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Correo Electrónico</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                          <Input
                            type="email"
                            placeholder="tu@email.com"
                            className="pl-10"
                            {...field}
                            data-testid="input-email"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Temporary Password */}
                <FormField
                  control={form.control}
                  name="tempPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contraseña Temporal</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <KeyRound className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                          <Input
                            type="password"
                            placeholder="ANPR2024!"
                            className="pl-10"
                            {...field}
                            data-testid="input-temp-password"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* New Password */}
                <FormField
                  control={form.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nueva Contraseña</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                          <Input
                            type="password"
                            placeholder="Mínimo 8 caracteres"
                            className="pl-10"
                            {...field}
                            data-testid="input-new-password"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Confirm Password */}
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirmar Contraseña</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <CheckCircle2 className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                          <Input
                            type="password"
                            placeholder="Repite tu contraseña"
                            className="pl-10"
                            {...field}
                            data-testid="input-confirm-password"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Submit Button */}
                <Button
                  type="submit"
                  className="w-full bg-[#bcce16] hover:bg-[#a8b914] text-[#0f2161] font-semibold"
                  disabled={isActivating}
                  data-testid="button-activate"
                >
                  {isActivating ? "Activando cuenta..." : "Activar Cuenta"}
                </Button>
              </form>
            </Form>

            <div className="mt-6 text-center text-sm text-gray-600">
              <p>
                ¿Ya tienes cuenta?{" "}
                <a href="/login" className="text-[#0f2161] hover:underline font-medium">
                  Inicia sesión aquí
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
