import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface TagSelectorProps {
  selectedTagIds: number[];
  onTagsChange: (tagIds: number[]) => void;
  className?: string;
}

export default function TagSelector({ selectedTagIds, onTagsChange, className }: TagSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  // Fetch available tags
  const { data: tags = [], isLoading } = useQuery({
    queryKey: ["/api/tags"],
    queryFn: async () => {
      const response = await fetch("/api/tags", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch tags");
      return response.json();
    },
  });

  const selectedTags = tags.filter((tag: any) => selectedTagIds.includes(tag.id));

  const handleTagSelect = (tagId: number) => {
    if (selectedTagIds.includes(tagId)) {
      onTagsChange(selectedTagIds.filter(id => id !== tagId));
    } else {
      onTagsChange([...selectedTagIds, tagId]);
    }
  };

  const handleTagRemove = (tagId: number) => {
    onTagsChange(selectedTagIds.filter(id => id !== tagId));
  };

  const filteredTags = tags.filter((tag: any) =>
    tag.nombre.toLowerCase().includes(searchValue.toLowerCase())
  );

  return (
    <div className={cn("space-y-2", className)}>
      {/* Selected Tags Display */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedTags.map((tag: any) => (
            <Badge
              key={tag.id}
              style={{ backgroundColor: tag.color, color: '#fff' }}
              className="flex items-center gap-1 text-white"
            >
              {tag.nombre}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 text-white hover:bg-white/20"
                onClick={() => handleTagRemove(tag.id)}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
        </div>
      )}

      {/* Tag Selector */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            {selectedTags.length === 0
              ? "Seleccionar etiquetas..."
              : `${selectedTags.length} etiqueta(s) seleccionada(s)`}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0">
          <Command>
            <CommandInput
              placeholder="Buscar etiquetas..."
              value={searchValue}
              onValueChange={setSearchValue}
            />
            <CommandEmpty>
              {isLoading ? "Cargando etiquetas..." : "No se encontraron etiquetas."}
            </CommandEmpty>
            <CommandGroup className="max-h-64 overflow-auto">
              {filteredTags.map((tag: any) => (
                <CommandItem
                  key={tag.id}
                  value={tag.nombre}
                  onSelect={() => handleTagSelect(tag.id)}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedTagIds.includes(tag.id) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <Badge
                    style={{ backgroundColor: tag.color, color: '#fff' }}
                    className="text-white"
                  >
                    {tag.nombre}
                  </Badge>
                  {tag.descripcion && (
                    <span className="text-sm text-gray-500 ml-2">
                      {tag.descripcion}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}