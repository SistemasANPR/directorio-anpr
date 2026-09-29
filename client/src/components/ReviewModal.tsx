import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

const reviewSchema = z.object({
  nombre: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  calificacion: z.number().min(1, "Selecciona una calificación").max(5),
  comentario: z.string().min(10, "El comentario debe tener al menos 10 caracteres"),
});

type ReviewFormData = z.infer<typeof reviewSchema>;

interface ReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: number;
  companyName: string;
}

export default function ReviewModal({ 
  open, 
  onOpenChange, 
  companyId, 
  companyName 
}: ReviewModalProps) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<ReviewFormData>({
    resolver: zodResolver(reviewSchema),
    defaultValues: {
      nombre: user?.displayName || "",
      email: user?.email || "",
      calificacion: 0,
      comentario: "",
    },
  });

  const createReviewMutation = useMutation({
    mutationFn: async (data: ReviewFormData) => {
      const response = await fetch("/api/opinions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...data,
          companyId,
          userId: user?.id || null,
        }),
      });

      if (!response.ok) {
        throw new Error("Error al enviar la reseña");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Reseña enviada",
        description: "Tu reseña ha sido enviada y está pendiente de aprobación.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/opinions"] });
      onOpenChange(false);
      form.reset();
      setRating(0);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo enviar la reseña. Inténtalo de nuevo.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ReviewFormData) => {
    if (rating === 0) {
      toast({
        title: "Error",
        description: "Por favor selecciona una calificación.",
        variant: "destructive",
      });
      return;
    }

    createReviewMutation.mutate({
      ...data,
      calificacion: rating,
    });
  };

  const StarRating = () => {
    return (
      <div className="flex items-center space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            className="focus:outline-none"
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
            onClick={() => {
              setRating(star);
              form.setValue("calificacion", star);
            }}
          >
            <Star
              className={`h-8 w-8 ${
                star <= (hoverRating || rating)
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-gray-300"
              }`}
            />
          </button>
        ))}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Dejar una reseña para {companyName}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="nombre"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre completo</FormLabel>
                  <FormControl>
                    <Input placeholder="Tu nombre completo" {...field} />
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
                    <Input 
                      type="email" 
                      placeholder="tu@email.com" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <FormLabel>Calificación</FormLabel>
              <StarRating />
              <p className="text-sm text-gray-600">
                Selecciona de 1 a 5 estrellas
              </p>
            </div>

            <FormField
              control={form.control}
              name="comentario"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Comentario</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Comparte tu experiencia con esta empresa..."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createReviewMutation.isPending}
              >
                {createReviewMutation.isPending ? "Enviando..." : "Enviar Reseña"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}