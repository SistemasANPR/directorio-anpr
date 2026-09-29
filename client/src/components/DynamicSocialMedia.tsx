import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Facebook, Instagram, Twitter, Linkedin, Youtube, Globe, Link } from "lucide-react";

interface SocialMediaEntry {
  id: string;
  platform: string | undefined;
  url: string;
}

interface DynamicSocialMediaProps {
  value?: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
  disabled?: boolean;
}

const SOCIAL_PLATFORMS = [
  { value: "facebook", label: "Facebook", icon: Facebook, placeholder: "https://facebook.com/tu-empresa", color: "bg-blue-600" },
  { value: "instagram", label: "Instagram", icon: Instagram, placeholder: "https://instagram.com/tu-empresa", color: "bg-pink-600" },
  { value: "x", label: "X", icon: Twitter, placeholder: "https://x.com/tu-empresa", color: "bg-black" },
  { value: "twitter", label: "X", icon: Twitter, placeholder: "https://x.com/tu-empresa", color: "bg-black" },
  { value: "linkedin", label: "LinkedIn", icon: Linkedin, placeholder: "https://linkedin.com/company/tu-empresa", color: "bg-blue-700" },
  { value: "youtube", label: "YouTube", icon: Youtube, placeholder: "https://youtube.com/@tu-empresa", color: "bg-red-600" },
  { value: "tiktok", label: "TikTok", icon: Link, placeholder: "https://tiktok.com/@tu-empresa", color: "bg-black" },
  { value: "whatsapp", label: "WhatsApp", icon: Link, placeholder: "https://wa.me/52XXXXXXXXXX", color: "bg-green-600" },
  { value: "telegram", label: "Telegram", icon: Link, placeholder: "https://t.me/tu-empresa", color: "bg-blue-500" },
  { value: "other", label: "Otro", icon: Link, placeholder: "https://ejemplo.com", color: "bg-gray-500" },
];

export default function DynamicSocialMedia({ value = {}, onChange, disabled = false }: DynamicSocialMediaProps) {
  const [entries, setEntries] = useState<SocialMediaEntry[]>([]);

  // Convert value object to entries array on mount and when value changes
  useEffect(() => {
    const newEntries: SocialMediaEntry[] = Object.entries(value).map(([platform, url], index) => ({
      id: `${platform}-${index}`,
      platform,
      url
    }));
    setEntries(newEntries);
  }, [value]);

  // Convert entries array back to object and call onChange
  const updateValue = (newEntries: SocialMediaEntry[]) => {
    const newValue: Record<string, string> = {};
    newEntries.forEach(entry => {
      if (entry.platform && entry.url.trim()) {
        newValue[entry.platform] = entry.url;
      }
    });
    onChange(newValue);
  };

  const addEntry = () => {
    const newEntry: SocialMediaEntry = {
      id: `new-${Date.now()}`,
      platform: undefined,
      url: ""
    };
    const newEntries = [...entries, newEntry];
    setEntries(newEntries);
  };

  const removeEntry = (id: string) => {
    const newEntries = entries.filter(entry => entry.id !== id);
    setEntries(newEntries);
    updateValue(newEntries);
  };

  const updateEntry = (id: string, field: 'platform' | 'url', newValue: string) => {
    const newEntries = entries.map(entry => 
      entry.id === id ? { ...entry, [field]: newValue } : entry
    );
    setEntries(newEntries);
    updateValue(newEntries);
  };

  const getPlatformInfo = (platformValue: string) => {
    return SOCIAL_PLATFORMS.find(p => p.value === platformValue) || SOCIAL_PLATFORMS.find(p => p.value === 'other');
  };

  const getAvailablePlatforms = (currentPlatform?: string) => {
    const usedPlatforms = entries.map(entry => entry.platform).filter((p): p is string => !!p && p !== currentPlatform);
    return SOCIAL_PLATFORMS.filter(platform => 
      !usedPlatforms.includes(platform.value) && platform.value !== "twitter"
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link className="h-5 w-5" />
          Redes Sociales
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {entries.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No hay redes sociales agregadas. Haz clic en "Agregar Red Social" para comenzar.
          </p>
        )}

        {entries.map((entry) => {
          const platformInfo = entry.platform ? getPlatformInfo(entry.platform) : null;
          const IconComponent = platformInfo?.icon || Link;
          
          return (
            <div key={entry.id} className="flex items-center gap-3 p-3 border rounded-lg bg-muted/30">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className={`p-2 rounded ${platformInfo?.color || 'bg-gray-500'} text-white`}>
                  <IconComponent className="h-4 w-4" />
                </div>
                
                <div className="flex-1 space-y-2">
                  <Select
                    value={entry.platform || ""}
                    onValueChange={(value) => updateEntry(entry.id, 'platform', value)}
                    disabled={disabled}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Plataforma" />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailablePlatforms(entry.platform).map((platform) => {
                        const Icon = platform.icon;
                        return (
                          <SelectItem key={platform.value} value={platform.value}>
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4" />
                              {platform.label}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  
                  <Input
                    placeholder={platformInfo?.placeholder || "https://ejemplo.com"}
                    value={entry.url}
                    onChange={(e) => updateEntry(entry.id, 'url', e.target.value)}
                    disabled={disabled || !entry.platform}
                    type="url"
                  />
                </div>
              </div>
              
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => removeEntry(entry.id)}
                disabled={disabled}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          );
        })}

        <Button
          type="button"
          variant="outline"
          onClick={addEntry}
          disabled={disabled || entries.length >= SOCIAL_PLATFORMS.length}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Agregar Red Social
        </Button>

        {entries.length > 0 && (
          <div className="mt-4 p-3 bg-muted/50 rounded-lg">
            <Label className="text-sm font-medium">Vista previa:</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {entries.filter((entry): entry is SocialMediaEntry & { platform: string } => !!entry.platform && !!entry.url).map((entry) => {
                const platformInfo = getPlatformInfo(entry.platform);
                const IconComponent = platformInfo?.icon || Link;
                
                return (
                  <Badge key={entry.id} variant="secondary" className="flex items-center gap-1">
                    <IconComponent className="h-3 w-3" />
                    {platformInfo?.label || entry.platform}
                  </Badge>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}