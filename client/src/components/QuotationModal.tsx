import { useState } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { Mail, Phone, Building, MessageSquare } from "lucide-react";

const quotationSchema = z.object({
  nombreCompleto: z.string().min(1, "El nombre completo es requerido"),
  email: z.string().email("Email inválido"),
  telefono: z.string().min(10, "El teléfono debe tener al menos 10 dígitos"),
  empresa: z.string().optional(),
  proyecto: z.string().min(10, "Describe brevemente tu proyecto (mínimo 10 caracteres)"),
  mensaje: z.string().min(20, "Proporciona más detalles sobre tu solicitud (mínimo 20 caracteres)"),
});

type QuotationFormData = z.infer<typeof quotationSchema>;

interface QuotationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyEmail: string;
  companyName: string;
}

export default function QuotationModal({ 
  open, 
  onOpenChange, 
  companyEmail, 
  companyName 
}: QuotationModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<QuotationFormData>({
    resolver: zodResolver(quotationSchema),
    defaultValues: {
      nombreCompleto: "",
      email: "",
      telefono: "",
      empresa: "",
      proyecto: "",
      mensaje: "",
    },
  });

  const onSubmit = async (data: QuotationFormData) => {
    setIsSubmitting(true);
    
    try {
      // Crear el cuerpo del email
      const emailBody = `
Solicitud de Cotización de ${data.nombreCompleto}

DATOS DE CONTACTO:
- Nombre: ${data.nombreCompleto}
- Email: ${data.email}
- Teléfono: ${data.telefono}
- Empresa: ${data.empresa || 'No especificada'}

PROYECTO:
${data.proyecto}

MENSAJE ADICIONAL:
${data.mensaje}

---
Esta solicitud fue enviada desde el Directorio de la Industria.
      `;

      // Crear enlace mailto
      const subject = `Solicitud de Cotización - ${data.nombreCompleto}`;
      const mailtoLink = `mailto:${companyEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`;
      
      // Abrir cliente de email
      window.location.href = mailtoLink;
      
      toast({
        title: "Solicitud de cotización enviada",
        description: `Tu solicitud de cotización ha sido enviada a ${companyName}. Se abrirá tu cliente de email para completar el envío.`,
      });
      
      // Limpiar formulario y cerrar modal
      form.reset();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo procesar tu solicitud. Inténtalo de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center text-xl">
            <Mail className="h-5 w-5 mr-2 text-blue-600" />
            Solicitar Cotización a {companyName}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Nombre completo */}
              <FormField
                control={form.control}
                name="nombreCompleto"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre Completo *</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input placeholder="Tu nombre completo" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Email */}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email *</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input placeholder="tu@email.com" className="pl-10" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Teléfono */}
              <FormField
                control={form.control}
                name="telefono"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teléfono *</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input placeholder="+52 555 123 4567" className="pl-10" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Empresa */}
              <FormField
                control={form.control}
                name="empresa"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Empresa (Opcional)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Building className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input placeholder="Nombre de tu empresa" className="pl-10" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Proyecto */}
            <FormField
              control={form.control}
              name="proyecto"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción del Proyecto *</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Describe brevemente tu proyecto o los productos/servicios que necesitas..."
                      className="min-h-[80px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Mensaje adicional */}
            <FormField
              control={form.control}
              name="mensaje"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mensaje Adicional *</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Proporciona detalles adicionales como: presupuesto estimado, fechas límite, ubicación del proyecto, etc."
                      className="min-h-[100px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-start space-x-3">
                <MessageSquare className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-900">¿Cómo funciona?</h4>
                  <p className="text-sm text-blue-700 mt-1">
                    Al enviar esta solicitud, se abrirá tu cliente de email predeterminado con un mensaje pre-redactado dirigido a <strong>{companyName}</strong>. Podrás revisar y modificar el mensaje antes de enviarlo.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isSubmitting ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Preparando...
                  </div>
                ) : (
                  <>
                    <Mail className="h-4 w-4 mr-2" />
                    Enviar Solicitud
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}