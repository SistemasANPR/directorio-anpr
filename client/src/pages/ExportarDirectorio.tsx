import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, ApiError } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import {
  Package,
  Database,
  FileCode2,
  Download,
  RefreshCw,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Server,
} from "lucide-react";
import Swal from "sweetalert2";

/**
 * Pantalla de administración "Exportar Directorio".
 *
 * Permite descargar, en un solo paquete, todo lo necesario para levantar el
 * directorio en otro servidor: el código fuente completo, un respaldo íntegro de
 * la base de datos (usuarios, empresas, membresías/licencias, pagos, reseñas y
 * la integración de WordPress) y la guía de instalación.
 *
 * Los endpoints exigen una sesión de administrador verificada en el servidor,
 * así que esta pantalla solo dispara las descargas.
 */

interface ExportInfo {
  sourceAvailable: boolean;
  fileCount: number;
  sourceBytes: number;
  tableCount: number;
  approxRows: number;
  tables: Array<{ name: string; approxRows: number }>;
}

type ExportKind = "full" | "source" | "database";

function formatBytes(bytes: number): string {
  if (!bytes) return "0 MB";
  const mb = bytes / (1024 * 1024);
  return mb < 1 ? `${(bytes / 1024).toFixed(0)} KB` : `${mb.toFixed(1)} MB`;
}

export default function ExportarDirectorio() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [downloading, setDownloading] = useState<ExportKind | null>(null);
  const [downloadError, setDownloadError] = useState<Error | null>(null);

  const {
    data: adminSession,
    isLoading: checkingSession,
    error: sessionError,
    refetch: retrySession,
  } = useQuery<{ user: { id: number } }>({
    queryKey: ["/api/admin/session", user?.id],
    queryFn: async () => (await apiRequest("GET", "/api/admin/session")).json(),
    staleTime: 0,
    refetchOnMount: "always",
    retry: false,
  });
  const sessionVerified = !!adminSession?.user && !sessionError;

  const {
    data: info,
    isLoading,
    error: infoError,
    refetch,
  } = useQuery<ExportInfo>({
    queryKey: ["/api/admin/export-info", user?.id],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/export-info");
      return res.json();
    },
    enabled: sessionVerified,
    staleTime: 60_000,
    retry: false,
  });
  const accessError = [sessionError, infoError, downloadError].find(
    (error) => error instanceof ApiError && (error.status === 401 || error.status === 403),
  ) as ApiError | undefined;
  const verifiedAdmin = sessionVerified && !accessError;
  const reauthenticate = () => window.location.assign("/login?returnTo=%2Fexportar-directorio");

  // Extrae el nombre de archivo que propone el servidor en Content-Disposition.
  const filenameFromResponse = (response: Response, fallback: string): string => {
    const disposition = response.headers.get("Content-Disposition") || "";
    const match = /filename="?([^";]+)"?/i.exec(disposition);
    return match?.[1] ?? fallback;
  };

  const download = async (kind: ExportKind) => {
    if (downloading || !verifiedAdmin) return;

    const confirmation = await Swal.fire({
      title:
        kind === "database"
          ? "¿Descargar el respaldo de la base de datos?"
          : kind === "source"
            ? "¿Descargar el código fuente?"
            : "¿Descargar el paquete completo?",
      html:
        kind === "source"
          ? "Se generará un <b>.zip</b> con todo el código del directorio, sin datos."
          : "El archivo incluirá <b>todos los datos del sistema</b>: usuarios, empresas, " +
            "membresías y licencias, pagos, reseñas y configuración.<br><br>" +
            "<span style='color:#b45309'>Contiene información sensible (correos, " +
            "contraseñas cifradas y claves de pago). Guárdalo en un lugar seguro y no " +
            "lo subas a repositorios públicos.</span>",
      icon: kind === "source" ? "question" : "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, descargar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#bcce16",
      reverseButtons: true,
    });
    if (!confirmation.isConfirmed) return;

    setDownloading(kind);
    setDownloadError(null);
    let objectUrl: string | null = null;

    try {
      const url =
        kind === "database"
          ? "/api/admin/project-export?includeSource=false"
          : kind === "source"
            ? "/api/admin/project-export?includeDatabase=false"
            : "/api/admin/project-export";

      const response = await apiRequest("GET", url);
      const blob = await response.blob();
      const filename = filenameFromResponse(response, `directorio-${kind}.zip`);

      objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();

      const files = response.headers.get("X-Export-Files");
      const tables = response.headers.get("X-Export-Tables");
      const rows = response.headers.get("X-Export-Rows");

      const parts: string[] = [];
      if (files && Number(files) > 0) parts.push(`${files} archivo(s)`);
      if (tables) parts.push(`${tables} tabla(s)`);
      if (rows) parts.push(`${rows} registro(s)`);
      parts.push(formatBytes(blob.size));

      toast({
        title: "Descarga completada",
        description: `${filename} — ${parts.join(" · ")}`,
      });
    } catch (error: any) {
      setDownloadError(error);
      console.error("Error exportando:", error);
      toast({
        title: "No se pudo generar la exportación",
        description:
          error?.message ||
          "Revisa que hayas iniciado sesión como administrador e inténtalo de nuevo.",
        variant: "destructive",
      });
    } finally {
      if (objectUrl) setTimeout(() => URL.revokeObjectURL(objectUrl!), 60_000);
      setDownloading(null);
    }
  };

  const busy = downloading !== null;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Package className="h-8 w-8" />
          Exportar Directorio
        </h1>
        <p className="text-muted-foreground mt-2">
          Descarga el proyecto completo —código fuente y base de datos— listo para
          desplegarse en Vercel y conectarse a tu propio servidor PostgreSQL.
        </p>
      </div>

      {checkingSession ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Verificando sesión de administrador...
        </div>
      ) : sessionError || !verifiedAdmin ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">No se puede exportar sin una sesión de administrador verificada.</p>
          <p className="mt-1">
            {accessError
              ? "Tu sesión expiró o no tiene permisos de administrador. Vuelve a iniciar sesión. No necesitas licencia ni membresía."
              : (sessionError as Error)?.message || "No se pudo comprobar tu sesión."}
          </p>
          <div className="mt-3 flex gap-2">
            {!accessError && <Button type="button" variant="outline" size="sm" onClick={() => retrySession()}>
              Reintentar
            </Button>}
            <Button type="button" variant="outline" size="sm" onClick={reauthenticate}>
              Volver a iniciar sesión
            </Button>
          </div>
        </div>
      ) : null}

      {/* Resumen de lo que se va a exportar */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Contenido disponible
          </CardTitle>
          <CardDescription>
            Esto es lo que hay ahora mismo en el sistema y viajará en el paquete.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!verifiedAdmin ? (
            <p className="text-sm text-muted-foreground">Verifica tu sesión para consultar el contenido disponible.</p>
          ) : isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Calculando...
            </div>
          ) : infoError ? (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-start gap-2 text-sm text-red-700">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{(infoError as Error)?.message || "No se pudo obtener el resumen."}</span>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
                Reintentar
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-lg border p-4">
                  <p className="text-2xl font-semibold">{info?.fileCount ?? 0}</p>
                  <p className="text-sm text-muted-foreground">Archivos de código</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-2xl font-semibold">{formatBytes(info?.sourceBytes ?? 0)}</p>
                  <p className="text-sm text-muted-foreground">Tamaño del código</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-2xl font-semibold">{info?.tableCount ?? 0}</p>
                  <p className="text-sm text-muted-foreground">Tablas</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-2xl font-semibold">
                    {(info?.approxRows ?? 0).toLocaleString("es-MX")}
                  </p>
                  <p className="text-sm text-muted-foreground">Registros (aprox.)</p>
                </div>
              </div>

              {info && !info.sourceAvailable && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>
                    Este servidor no tiene acceso al código fuente, así que solo se puede
                    exportar la base de datos. Descarga el código desde el entorno de
                    desarrollo o desde tu repositorio de GitHub.
                  </span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Acciones de descarga */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="border-2 border-[#bcce16]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Package className="h-5 w-5" />
              Paquete completo
            </CardTitle>
            <CardDescription>
              Código fuente + base de datos + guía de instalación. Es lo que necesitas
              para montar el directorio desde cero en otro servidor.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="text-sm space-y-1.5">
              {[
                "Todo el código (cliente, servidor, API y esquema)",
                "Plugin de WordPress (SSO y membresías)",
                "database/backup.sql con todos los datos",
                "Usuarios, empresas, licencias y pagos",
                ".env.example e INSTALACION.md",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-[#8fa00f]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <Button
              type="button"
              onClick={() => download("full")}
              disabled={!verifiedAdmin || busy || info?.sourceAvailable === false}
              className="w-full bg-[#bcce16] hover:bg-[#a8b814] text-black"
            >
              {downloading === "full" ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Generando paquete...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Descargar todo (.zip)
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileCode2 className="h-5 w-5" />
              Solo el código
            </CardTitle>
            <CardDescription>
              El proyecto sin datos, listo para subir a GitHub y conectar con Vercel.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              No incluye <code>node_modules</code>, tus secretos ni las imágenes subidas
              por los usuarios (esas viven en Cloudinary).
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => download("source")}
              disabled={!verifiedAdmin || busy || info?.sourceAvailable === false}
              className="w-full"
            >
              {downloading === "source" ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Comprimiendo...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Descargar código (.zip)
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Database className="h-5 w-5" />
              Solo la base de datos
            </CardTitle>
            <CardDescription>
              Respaldo íntegro en formato <code>.sql</code>, restaurable en cualquier
              PostgreSQL.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Incluye estructura, datos, índices, claves foráneas y secuencias. Úsalo
              como copia de seguridad periódica.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => download("database")}
              disabled={!verifiedAdmin || busy}
              className="w-full"
            >
              {downloading === "database" ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Generando respaldo...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Descargar respaldo (.zip)
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Instrucciones de restauración */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Cómo desplegarlo</CardTitle>
          <CardDescription>
            Resumen rápido. El paquete incluye <code>INSTALACION.md</code> con los pasos
            detallados.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <p className="font-medium mb-1">1. Crear PostgreSQL en tu VPS de Hostinger</p>
            <pre className="overflow-x-auto rounded bg-muted p-3 text-xs">
{`sudo apt update && sudo apt install -y postgresql
sudo -u postgres psql -c "CREATE USER directorio_user WITH PASSWORD 'tu_password';"
sudo -u postgres psql -c "CREATE DATABASE directorio OWNER directorio_user;"`}
            </pre>
          </div>

          <div>
            <p className="font-medium mb-1">2. Restaurar el respaldo</p>
            <pre className="overflow-x-auto rounded bg-muted p-3 text-xs">
{`psql "postgresql://directorio_user:tu_password@IP_VPS:5432/directorio" < database/backup.sql`}
            </pre>
          </div>

          <div>
            <p className="font-medium mb-1">3. Desplegar en Vercel</p>
            <p className="text-muted-foreground">
              Sube el código a GitHub, impórtalo en Vercel con Build Command{" "}
              <code>npm run build</code> y Output Directory <code>dist/public</code>, y
              carga las variables de <code>.env.example</code> —sobre todo{" "}
              <code>DATABASE_URL</code> apuntando a tu VPS.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
        <div>
          <p className="font-medium">Manejo de información sensible</p>
          <p>
            El respaldo contiene correos, contraseñas cifradas y claves de configuración
            de pagos. Descárgalo solo en equipos de confianza, guárdalo cifrado y nunca lo
            subas a un repositorio o servicio público.
          </p>
        </div>
      </div>
    </div>
  );
}
