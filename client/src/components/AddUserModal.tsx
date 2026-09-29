import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { UserPlus, Loader2, Copy, Check, Eye, EyeOff } from "lucide-react";

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AddUserModal({ isOpen, onClose }: AddUserModalProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    email: "",
    displayName: "",
    role: "user",
    password: "",
    autoGeneratePassword: true,
  });
  const [createdUser, setCreatedUser] = useState<{ email: string; tempPassword: string; displayName: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const generatePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
    let password = "";
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const createUserMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const tempPassword = data.autoGeneratePassword ? generatePassword() : data.password;
      const firebaseUid = `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const response = await apiRequest("POST", "/api/users", {
        email: data.email,
        displayName: data.displayName,
        role: data.role,
        firebaseUid,
        tempPassword,
        requirePasswordChange: true,
      });
      
      return { ...await response.json(), tempPassword };
    },
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/statistics"] });
      
      setCreatedUser({
        email: formData.email,
        tempPassword: response.tempPassword,
        displayName: formData.displayName,
      });
      
      toast({
        title: "Usuario creado",
        description: "El usuario ha sido creado exitosamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo crear el usuario",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email || !formData.displayName) {
      toast({
        title: "Campos requeridos",
        description: "Por favor completa el nombre y correo electrónico",
        variant: "destructive",
      });
      return;
    }

    if (!formData.autoGeneratePassword && (!formData.password || formData.password.length < 6)) {
      toast({
        title: "Contraseña inválida",
        description: "La contraseña debe tener al menos 6 caracteres",
        variant: "destructive",
      });
      return;
    }

    createUserMutation.mutate(formData);
  };

  const handleClose = () => {
    setFormData({ 
      email: "", 
      displayName: "", 
      role: "user",
      password: "",
      autoGeneratePassword: true,
    });
    setCreatedUser(null);
    setCopied(false);
    setShowPassword(false);
    onClose();
  };

  const copyCredentials = async () => {
    if (createdUser) {
      const text = `Email: ${createdUser.email}\nContraseña temporal: ${createdUser.tempPassword}`;
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            {createdUser ? "Usuario Creado" : "Nuevo Usuario"}
          </DialogTitle>
        </DialogHeader>

        {createdUser ? (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-800 font-medium mb-3">
                El usuario ha sido creado exitosamente
              </p>
              <div className="space-y-2 text-sm bg-white rounded p-3 border">
                <p><strong>Nombre:</strong> {createdUser.displayName}</p>
                <p><strong>Email:</strong> {createdUser.email}</p>
                <p><strong>Contraseña temporal:</strong> <code className="bg-gray-100 px-2 py-1 rounded">{createdUser.tempPassword}</code></p>
              </div>
            </div>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-xs text-yellow-800">
                Guarda estas credenciales. El usuario deberá cambiar su contraseña en el primer inicio de sesión.
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={copyCredentials}
                className="flex-1"
                data-testid="button-copy-credentials"
              >
                {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                {copied ? "Copiado" : "Copiar credenciales"}
              </Button>
              <Button
                type="button"
                onClick={handleClose}
                className="flex-1"
                data-testid="button-close-user-modal"
              >
                Cerrar
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">Nombre completo *</Label>
              <Input
                id="displayName"
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                placeholder="Juan Pérez"
                data-testid="input-user-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="usuario@ejemplo.com"
                data-testid="input-user-email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Rol *</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value })}
              >
                <SelectTrigger data-testid="select-user-role">
                  <SelectValue placeholder="Seleccionar rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="user">Usuario</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="autoGeneratePassword"
                  checked={formData.autoGeneratePassword}
                  onCheckedChange={(checked) => 
                    setFormData({ ...formData, autoGeneratePassword: checked === true, password: "" })
                  }
                  data-testid="checkbox-auto-password"
                />
                <Label htmlFor="autoGeneratePassword" className="text-sm font-normal cursor-pointer">
                  Generar contraseña automáticamente
                </Label>
              </div>

              {!formData.autoGeneratePassword && (
                <div className="space-y-2">
                  <Label htmlFor="password">Contraseña personalizada *</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      placeholder="Mínimo 6 caracteres"
                      className="pr-10"
                      data-testid="input-user-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className="flex-1"
                data-testid="button-cancel-user"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createUserMutation.isPending}
                className="flex-1"
                data-testid="button-create-user"
              >
                {createUserMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creando...
                  </>
                ) : (
                  "Crear Usuario"
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
