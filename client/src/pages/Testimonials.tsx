import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Star, MessageSquare, CheckCircle, Clock, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";

const testimonialSchema = z.object({
  nombre: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  cargo: z.string().min(2, "El cargo debe tener al menos 2 caracteres"),
  calificacion: z.number().min(1).max(5),
  comentario: z.string().min(10, "El comentario debe tener al menos 10 caracteres"),
});

type TestimonialForm = z.infer<typeof testimonialSchema>;

export default function Testimonials() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);

  const { user } = useAuth();

  const { data: testimonials, isLoading } = useQuery({
    queryKey: ["/api/opinions", { tipo: "plataforma", userId: user?.id }],
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `/api/opinions?tipo=plataforma&userId=${user?.id || 0}`,
      );
      return response.json();
    },
    enabled: !!user?.id,
  });

  const form = useForm<TestimonialForm>({
    resolver: zodResolver(testimonialSchema),
    defaultValues: {
      nombre: user?.nombre || "",
      email: user?.email || "",
      cargo: "",
      calificacion: 5,
      comentario: "",
    },
  });

  const createTestimonialMutation = useMutation({
    mutationFn: async (data: TestimonialForm) => {
      return apiRequest("POST", "/api/opinions", {
        ...data,
        tipo: "plataforma",
        userId: user?.id || null,
      });
    },
    onSuccess: () => {
      toast({
        title: "Testimonio enviado",
        description: "Su testimonio ha sido enviado y está pendiente de aprobación.",
      });
      form.reset();
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ["/api/opinions"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo enviar el testimonio.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: TestimonialForm) => {
    createTestimonialMutation.mutate(data);
  };

  const getStatusIcon = (estado: string) => {
    switch (estado) {
      case "aprobada":
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case "rechazada":
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Clock className="w-5 h-5 text-yellow-600" />;
    }
  };

  const getStatusText = (estado: string) => {
    switch (estado) {
      case "aprobada":
        return "Aprobado";
      case "rechazada":
        return "Rechazado";
      default:
        return "Pendiente";
    }
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${i < rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`}
      />
    ));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Testimonios de la Plataforma</h1>
          <p className="text-muted-foreground">
            Comparta su experiencia usando nuestra plataforma
          </p>
        </div>
        <Button onClick={() => setShowForm(true)} className="bg-[#bcce16] hover:bg-[#a8b814]">
          <MessageSquare className="w-4 h-4 mr-2" />
          Agregar Testimonio
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Nuevo Testimonio</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="nombre"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre</FormLabel>
                        <FormControl>
                          <Input placeholder="Su nombre completo" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input placeholder="su@email.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="cargo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cargo/Posición</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej: Director General, Gerente de Ventas" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="calificacion"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Calificación</FormLabel>
                        <Select
                          value={field.value.toString()}
                          onValueChange={(value) => field.onChange(parseInt(value))}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccione una calificación" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {[1, 2, 3, 4, 5].map((num) => (
                              <SelectItem key={num} value={num.toString()}>
                                <div className="flex items-center gap-2">
                                  <span>{num}</span>
                                  <div className="flex">
                                    {renderStars(num)}
                                  </div>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="comentario"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Testimonio</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Comparta su experiencia usando nuestra plataforma..."
                          className="min-h-[120px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-2">
                  <Button
                    type="submit"
                    disabled={createTestimonialMutation.isPending}
                    className="bg-[#bcce16] hover:bg-[#a8b814]"
                  >
                    {createTestimonialMutation.isPending ? "Enviando..." : "Enviar Testimonio"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                    Cancelar
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Mis Testimonios</h2>
        {testimonials?.opinions?.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Aún no ha enviado ningún testimonio.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {testimonials?.opinions?.map((testimonial: any) => (
              <Card key={testimonial.id}>
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex">
                          {renderStars(testimonial.calificacion)}
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {testimonial.calificacion}/5
                        </span>
                      </div>
                      <p className="font-medium">{testimonial.cargo}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(testimonial.estado)}
                      <span className="text-sm font-medium">
                        {getStatusText(testimonial.estado)}
                      </span>
                    </div>
                  </div>
                  
                  <p className="text-gray-700 mb-4">{testimonial.comentario}</p>
                  
                  <div className="text-xs text-muted-foreground">
                    Enviado el {new Date(testimonial.fechaCreacion).toLocaleDateString()}
                    {testimonial.fechaAprobacion && (
                      <span>
                        {" • "}
                        {testimonial.estado === "aprobada" ? "Aprobado" : "Revisado"} el{" "}
                        {new Date(testimonial.fechaAprobacion).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}