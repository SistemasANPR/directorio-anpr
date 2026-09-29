import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { 
  Palette, 
  FileText, 
  Save, 
  Upload, 
  Eye,
  RefreshCw,
  Settings,
  Monitor,
  Image as ImageIcon,
  X,
  Check
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

interface PdfSettings {
  id: number;
  companyName: string;
  companySubtitle: string | null;
  logoUrl: string | null;
  websiteUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  textColor: string;
  subtitleColor: string;
  headerHeight: number;
  fontSize: number;
  titleFontSize: number;
  showLogo: boolean;
  showWebsite: boolean;
  showAddress: boolean;
  footerText: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function PdfSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  // Fetch current PDF settings
  const { data: settings, isLoading } = useQuery<PdfSettings>({
    queryKey: ['/api/pdf-settings'],
  });

  // Form state
  const [formData, setFormData] = useState<Partial<PdfSettings>>({});
  
  // File upload state
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update form data when settings load
  useEffect(() => {
    if (settings) {
      setFormData(settings);
      // Set logo preview if exists
      if (settings.logoUrl) {
        setLogoPreview(`/uploads/pdf-logos/${settings.logoUrl}`);
      }
    }
  }, [settings]);

  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Error",
        description: "Por favor selecciona un archivo de imagen válido",
        variant: "destructive",
      });
      return;
    }

    // Validate image size (max 2 MiB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "La imagen supera el tamaño máximo permitido de 2 MB. Selecciona una imagen más ligera.",
        variant: "destructive",
      });
      return;
    }

    setLogoFile(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setLogoPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Upload logo file
  const uploadLogo = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('logo', file);

    const response = await fetch('/api/pdf-settings/upload-logo', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Error uploading logo');
    }

    const result = await response.json();
    return result.filename;
  };

  // Remove logo
  const removeLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    setFormData(prev => ({ ...prev, logoUrl: null }));
  };

  // Update PDF settings mutation
  const updateMutation = useMutation({
    mutationFn: async (data: Partial<PdfSettings>) => {
      const response = await fetch('/api/pdf-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Error updating PDF settings');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pdf-settings'] });
      toast({
        title: "Configuración actualizada",
        description: "Los ajustes de PDF han sido guardados correctamente",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "No se pudo actualizar la configuración de PDF",
        variant: "destructive",
      });
      console.error('Error:', error);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsUploading(true);
      let updatedFormData = { ...formData };
      
      // Upload logo if a new file is selected
      if (logoFile) {
        const filename = await uploadLogo(logoFile);
        updatedFormData.logoUrl = filename;
      }
      
      updateMutation.mutate(updatedFormData);
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al subir el logotipo",
        variant: "destructive",
      });
      console.error('Upload error:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleInputChange = (field: keyof PdfSettings, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const resetToDefaults = () => {
    setFormData({
      companyName: "ANPR México",
      companySubtitle: "Asociación Nacional de Profesionales en Relaciones Públicas",
      websiteUrl: "www.anpr.org.mx",
      primaryColor: "#bcce16",
      secondaryColor: "#2d3748",
      accentColor: "#f7fafc",
      textColor: "#000000",
      subtitleColor: "#505050",
      headerHeight: 30,
      fontSize: 10,
      titleFontSize: 22,
      showLogo: true,
      showWebsite: true,
      showAddress: true,
      footerText: "Este recibo fue generado automáticamente"
    });
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <FileText className="h-8 w-8 text-[#bcce16]" />
            Configuración de PDF de Pagos
          </h1>
          <p className="text-gray-600 mt-2">
            Personaliza la apariencia de los archivos PDF de recibos de pago
          </p>
        </div>
        
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => setIsPreviewMode(!isPreviewMode)}
            className="flex items-center gap-2"
          >
            <Eye className="h-4 w-4" />
            {isPreviewMode ? 'Ocultar Vista Previa' : 'Vista Previa'}
          </Button>
          
          <Button
            variant="outline"
            onClick={resetToDefaults}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Restaurar Defaults
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Configuration Form */}
        <div className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Branding Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Información de la Empresa
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="companyName">Nombre de la Empresa</Label>
                  <Input
                    id="companyName"
                    value={formData.companyName || ''}
                    onChange={(e) => handleInputChange('companyName', e.target.value)}
                    placeholder="ANPR México"
                  />
                </div>

                <div>
                  <Label htmlFor="companySubtitle">Subtítulo/Descripción</Label>
                  <Input
                    id="companySubtitle"
                    value={formData.companySubtitle || ''}
                    onChange={(e) => handleInputChange('companySubtitle', e.target.value)}
                    placeholder="Asociación Nacional de Profesionales..."
                  />
                </div>

                <div>
                  <Label htmlFor="websiteUrl">Sitio Web</Label>
                  <Input
                    id="websiteUrl"
                    value={formData.websiteUrl || ''}
                    onChange={(e) => handleInputChange('websiteUrl', e.target.value)}
                    placeholder="www.anpr.org.mx"
                  />
                </div>

                <div>
                  <Label>Logotipo de la Empresa</Label>
                  <div className="space-y-3">
                    {/* Logo preview */}
                    {logoPreview && (
                      <div className="relative inline-block">
                        <div className="w-32 h-20 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50 overflow-hidden">
                          <img 
                            src={logoPreview} 
                            alt="Logo preview" 
                            className="max-w-full max-h-full object-contain"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                          onClick={removeLogo}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    )}

                    {/* Upload area */}
                    <div 
                      className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer ${
                        logoPreview ? 'border-gray-200' : 'border-gray-300 hover:border-gray-400'
                      }`}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <ImageIcon className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                      <p className="text-sm text-gray-600 mb-1">
                        {logoPreview ? 'Cambiar logotipo' : 'Subir logotipo'}
                      </p>
                      <p className="text-xs text-gray-400">
                        PNG, JPG, SVG hasta 2 MB
                      </p>
                    </div>

                    {/* Hidden file input */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />

                    {/* Upload button */}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {logoPreview ? 'Cambiar logotipo' : 'Seleccionar archivo'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Colors Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5" />
                  Esquema de Colores
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="primaryColor">Color Primario (Header)</Label>
                    <div className="flex gap-2">
                      <Input
                        id="primaryColor"
                        type="color"
                        value={formData.primaryColor || '#bcce16'}
                        onChange={(e) => handleInputChange('primaryColor', e.target.value)}
                        className="w-16 h-10 p-1"
                      />
                      <Input
                        value={formData.primaryColor || '#bcce16'}
                        onChange={(e) => handleInputChange('primaryColor', e.target.value)}
                        placeholder="#bcce16"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="secondaryColor">Color Secundario (Texto)</Label>
                    <div className="flex gap-2">
                      <Input
                        id="secondaryColor"
                        type="color"
                        value={formData.secondaryColor || '#2d3748'}
                        onChange={(e) => handleInputChange('secondaryColor', e.target.value)}
                        className="w-16 h-10 p-1"
                      />
                      <Input
                        value={formData.secondaryColor || '#2d3748'}
                        onChange={(e) => handleInputChange('secondaryColor', e.target.value)}
                        placeholder="#2d3748"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="accentColor">Color de Fondo</Label>
                    <div className="flex gap-2">
                      <Input
                        id="accentColor"
                        type="color"
                        value={formData.accentColor || '#f7fafc'}
                        onChange={(e) => handleInputChange('accentColor', e.target.value)}
                        className="w-16 h-10 p-1"
                      />
                      <Input
                        value={formData.accentColor || '#f7fafc'}
                        onChange={(e) => handleInputChange('accentColor', e.target.value)}
                        placeholder="#f7fafc"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="textColor">Color de Texto Principal</Label>
                    <div className="flex gap-2">
                      <Input
                        id="textColor"
                        type="color"
                        value={formData.textColor || '#000000'}
                        onChange={(e) => handleInputChange('textColor', e.target.value)}
                        className="w-16 h-10 p-1"
                      />
                      <Input
                        value={formData.textColor || '#000000'}
                        onChange={(e) => handleInputChange('textColor', e.target.value)}
                        placeholder="#000000"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Layout Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Monitor className="h-5 w-5" />
                  Configuración de Diseño
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="headerHeight">Altura del Header (px)</Label>
                    <Input
                      id="headerHeight"
                      type="number"
                      value={formData.headerHeight || 30}
                      onChange={(e) => handleInputChange('headerHeight', parseInt(e.target.value))}
                      min="20"
                      max="60"
                    />
                  </div>

                  <div>
                    <Label htmlFor="fontSize">Tamaño de Fuente</Label>
                    <Input
                      id="fontSize"
                      type="number"
                      value={formData.fontSize || 10}
                      onChange={(e) => handleInputChange('fontSize', parseInt(e.target.value))}
                      min="8"
                      max="14"
                    />
                  </div>

                  <div>
                    <Label htmlFor="titleFontSize">Tamaño Título</Label>
                    <Input
                      id="titleFontSize"
                      type="number"
                      value={formData.titleFontSize || 22}
                      onChange={(e) => handleInputChange('titleFontSize', parseInt(e.target.value))}
                      min="16"
                      max="30"
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="showLogo">Mostrar Logo</Label>
                    <Switch
                      id="showLogo"
                      checked={formData.showLogo || false}
                      onCheckedChange={(checked) => handleInputChange('showLogo', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="showWebsite">Mostrar Sitio Web</Label>
                    <Switch
                      id="showWebsite"
                      checked={formData.showWebsite || false}
                      onCheckedChange={(checked) => handleInputChange('showWebsite', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="showAddress">Mostrar Dirección</Label>
                    <Switch
                      id="showAddress"
                      checked={formData.showAddress || false}
                      onCheckedChange={(checked) => handleInputChange('showAddress', checked)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Content Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Contenido del Documento
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="footerText">Texto del Pie de Página</Label>
                  <Textarea
                    id="footerText"
                    value={formData.footerText || ''}
                    onChange={(e) => handleInputChange('footerText', e.target.value)}
                    placeholder="Este recibo fue generado automáticamente"
                    rows={2}
                  />
                </div>

                <div>
                  <Label htmlFor="address">Dirección de la Empresa</Label>
                  <Textarea
                    id="address"
                    value={formData.address || ''}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    placeholder="Dirección completa de la empresa"
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="phone">Teléfono</Label>
                    <Input
                      id="phone"
                      value={formData.phone || ''}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      placeholder="+52 (55) 1234-5678"
                    />
                  </div>

                  <div>
                    <Label htmlFor="email">Email de Contacto</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email || ''}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      placeholder="contacto@empresa.com"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Save Button */}
            <Card>
              <CardContent className="pt-6">
                <Button
                  type="submit"
                  disabled={updateMutation.isPending || isUploading}
                  className="w-full bg-[#bcce16] hover:bg-[#a8b814] text-black"
                >
                  {isUploading ? (
                    <>
                      <Upload className="h-4 w-4 mr-2 animate-bounce" />
                      Subiendo logotipo...
                    </>
                  ) : updateMutation.isPending ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Guardando configuración...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Guardar Configuración
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </form>
        </div>

        {/* Preview Section */}
        {isPreviewMode && (
          <div className="lg:sticky lg:top-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Vista Previa del PDF
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div 
                  className="border rounded-lg p-6 bg-white shadow-sm"
                  style={{ 
                    backgroundColor: formData.accentColor || '#f7fafc',
                    color: formData.textColor || '#000000',
                    fontSize: `${formData.fontSize || 10}px`
                  }}
                >
                  {/* Header Preview */}
                  <div 
                    className="flex items-center justify-between p-4 rounded-t-lg mb-4"
                    style={{
                      backgroundColor: formData.primaryColor || '#bcce16',
                      height: `${formData.headerHeight || 30}px`,
                      minHeight: '60px'
                    }}
                  >
                    <div className="flex items-center gap-3">
                      {formData.showLogo && (
                        <div className="w-12 h-12 bg-white/20 rounded flex items-center justify-center">
                          <ImageIcon className="h-6 w-6 text-white" />
                        </div>
                      )}
                      <div>
                        <h2 
                          className="font-bold text-white"
                          style={{ fontSize: `${(formData.titleFontSize || 22) * 0.7}px` }}
                        >
                          {formData.companyName || 'ANPR México'}
                        </h2>
                        {formData.companySubtitle && (
                          <p className="text-white/80 text-xs">
                            {formData.companySubtitle}
                          </p>
                        )}
                      </div>
                    </div>
                    {formData.showWebsite && (
                      <div className="text-white text-sm">
                        {formData.websiteUrl || 'www.anpr.org.mx'}
                      </div>
                    )}
                  </div>

                  {/* Content Preview */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">RECIBO DE PAGO</h3>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <strong>Recibo #:</strong> REC-001-2025
                      </div>
                      <div>
                        <strong>Fecha:</strong> 19 Jun 2025
                      </div>
                      <div>
                        <strong>Cliente:</strong> Empresa Ejemplo
                      </div>
                      <div>
                        <strong>Plan:</strong> Membresía Básica
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <div className="flex justify-between">
                        <span>Membresía Anual</span>
                        <span>$2,500.00 MXN</span>
                      </div>
                    </div>

                    {formData.showAddress && formData.address && (
                      <div className="text-sm text-gray-600 mt-4">
                        <strong>Dirección:</strong> {formData.address}
                      </div>
                    )}
                  </div>

                  {/* Footer Preview */}
                  <div className="border-t mt-6 pt-4 text-center text-xs text-gray-500">
                    {formData.footerText || 'Este recibo fue generado automáticamente'}
                    <br />
                    {formData.companyName || 'ANPR México'} | {formData.websiteUrl || 'www.anpr.org.mx'}
                  </div>
                </div>

                <div className="mt-4 text-sm text-gray-600">
                  <Badge variant="outline" className="mb-2">Vista Previa Simplificada</Badge>
                  <p>Esta es una representación visual simplificada del PDF final.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}