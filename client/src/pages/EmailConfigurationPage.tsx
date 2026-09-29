import EmailConfiguration from "@/components/EmailConfiguration";

export default function EmailConfigurationPage() {
  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Configuración de Correos</h1>
            <p className="text-gray-600">
              Sistema de correos transaccionales y plantillas de notificación
            </p>
          </div>
        </div>
        <EmailConfiguration />
      </div>
    </>
  );
}