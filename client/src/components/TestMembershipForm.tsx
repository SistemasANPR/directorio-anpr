import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const testSchema = z.object({
  nombrePlan: z.string().min(1, "Nombre del plan es requerido"),
  costo: z.number().min(0, "El costo debe ser mayor o igual a 0"),
  periodicidad: z.string().min(1, "Periodicidad es requerida"),
  cantidadProductosAdmitidos: z.number().min(0, "Debe ser un número mayor o igual a 0"),
  cantidadProyectosAdmitidos: z.number().min(0, "Debe ser un número mayor o igual a 0"),
});

type TestFormData = z.infer<typeof testSchema>;

export function TestMembershipForm({ onSubmit }: { onSubmit: (data: TestFormData) => void }) {
  const form = useForm<TestFormData>({
    resolver: zodResolver(testSchema),
    defaultValues: {
      nombrePlan: "",
      costo: 0,
      periodicidad: "",
      cantidadProductosAdmitidos: 0,
      cantidadProyectosAdmitidos: 0,
    },
  });

  return (
    <div className="p-6 border rounded-lg max-w-2xl mx-auto">
      <h3 className="text-lg font-semibold mb-4">Formulario de Prueba - Membresía</h3>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="nombrePlan"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nombre del Plan</FormLabel>
                <FormControl>
                  <Input placeholder="Ej. Básico, Premium..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="costo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Costo</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="periodicidad"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Periodicidad</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="monthly">Mensual</SelectItem>
                      <SelectItem value="yearly">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-4 p-4 border rounded-lg bg-blue-50">
            <FormField
              control={form.control}
              name="cantidadProductosAdmitidos"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-blue-800 font-semibold">Límite de Productos</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      placeholder="0"
                      className="border-blue-300"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      value={field.value || 0}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="cantidadProyectosAdmitidos"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-blue-800 font-semibold">Límite de Proyectos</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      placeholder="0"
                      className="border-blue-300"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      value={field.value || 0}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <Button type="submit" className="w-full">
            Probar Formulario
          </Button>
        </form>
      </Form>
    </div>
  );
}