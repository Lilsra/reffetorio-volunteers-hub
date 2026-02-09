import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { User, Mail, MapPin, Calendar, Phone, Camera, X } from "lucide-react";

const phoneRegex = /^[0-9]{10}$/;

const volunteerSchema = z.object({
  first_name: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres").max(50, "El nombre es demasiado largo"),
  last_name: z.string().trim().min(2, "Los apellidos deben tener al menos 2 caracteres").max(100, "Los apellidos son demasiado largos"),
  age: z.number({ invalid_type_error: "Ingresa una edad válida" }).min(16, "Debes tener al menos 16 años").max(100, "Edad inválida"),
  address: z.string().trim().min(10, "La dirección debe ser más específica").max(200, "La dirección es demasiado larga"),
  email: z.string().trim().email("Correo electrónico inválido").max(100, "El correo es demasiado largo").toLowerCase(),
  phone: z.string().trim().regex(phoneRegex, "Ingresa un número de 10 dígitos"),
});

type VolunteerFormData = z.infer<typeof volunteerSchema>;

interface VolunteerFormProps {
  onSuccess: (volunteerId: string, volunteerEmail: string) => void;
}

export function VolunteerForm({ onSuccess }: VolunteerFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<VolunteerFormData>({
    resolver: zodResolver(volunteerSchema),
  });

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Solo se permiten archivos de imagen");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("La imagen no debe pesar más de 2 MB");
      return;
    }

    setPhotoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const removePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const uploadPhoto = async (volunteerId: string): Promise<string | null> => {
    if (!photoFile) return null;
    try {
      const fileExt = photoFile.name.split(".").pop();
      const filePath = `${volunteerId}.${fileExt}`;

      const { error } = await supabase.storage
        .from("avatars")
        .upload(filePath, photoFile, { upsert: true });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      return `${urlData.publicUrl}?t=${Date.now()}`;
    } catch (error) {
      console.error("Error uploading photo:", error);
      return null;
    }
  };

  const onSubmit = async (data: VolunteerFormData) => {
    setIsLoading(true);
    try {
      // Check if email already exists
      const { data: existing } = await supabase
        .from("volunteers")
        .select("id, email, first_name, status")
        .eq("email", data.email)
        .maybeSingle();

      if (existing) {
        if (existing.status === "inactive") {
          toast.error("Tu cuenta está inactiva. Contacta al administrador.");
          return;
        }
        onSuccess(existing.id, existing.email);
        toast.info(`¡Bienvenido de nuevo, ${existing.first_name}! Selecciona tu día de voluntariado.`);
        return;
      }

      // Create new volunteer
      const { data: volunteer, error } = await supabase
        .from("volunteers")
        .insert({
          first_name: data.first_name.trim(),
          last_name: data.last_name.trim(),
          age: data.age,
          address: data.address.trim(),
          email: data.email.trim().toLowerCase(),
          phone: data.phone.trim(),
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          toast.error("Este correo ya está registrado. Intenta con otro.");
          return;
        }
        throw error;
      }

      // Upload photo if selected
      if (photoFile) {
        const avatarUrl = await uploadPhoto(volunteer.id);
        if (avatarUrl) {
          await supabase
            .from("volunteers")
            .update({ avatar_url: avatarUrl })
            .eq("id", volunteer.id);
        }
      }

      toast.success("¡Registro exitoso! Ahora selecciona tu día de voluntariado.");
      onSuccess(volunteer.id, volunteer.email);
      reset();
      removePhoto();
    } catch (error: any) {
      console.error("Error registering volunteer:", error);
      toast.error("Error al registrar. Por favor intenta de nuevo.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-lg animate-fade-in shadow-lg border-border/50">
      <CardHeader className="text-center pb-2">
        <CardTitle className="text-2xl font-display text-primary">
          Registro de Voluntario
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Únete a nuestra comunidad de voluntarios
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Optional Photo */}
          <div className="flex flex-col items-center">
            <div className="relative">
              <div className="w-20 h-20 rounded-full overflow-hidden border-3 border-dashed border-border bg-muted flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {photoPreview ? (
                  <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center">
                    <Camera className="h-6 w-6 text-muted-foreground mx-auto" />
                    <span className="text-[10px] text-muted-foreground">Opcional</span>
                  </div>
                )}
              </div>
              {photoPreview && (
                <button
                  type="button"
                  onClick={removePhoto}
                  className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-sm hover:bg-destructive/90"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoSelect}
            />
            <p className="text-xs text-muted-foreground mt-1">Foto de perfil (opcional, máx. 2 MB)</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name" className="flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                Nombre <span className="text-destructive">*</span>
              </Label>
              <Input
                id="first_name"
                placeholder="Tu nombre"
                {...register("first_name")}
                className="border-input focus:ring-primary"
              />
              {errors.first_name && (
                <p className="text-sm text-destructive">{errors.first_name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="last_name" className="flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                Apellidos <span className="text-destructive">*</span>
              </Label>
              <Input
                id="last_name"
                placeholder="Tus apellidos"
                {...register("last_name")}
              />
              {errors.last_name && (
                <p className="text-sm text-destructive">{errors.last_name.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="age" className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                Edad <span className="text-destructive">*</span>
              </Label>
              <Input
                id="age"
                type="number"
                placeholder="Tu edad"
                {...register("age", { valueAsNumber: true })}
              />
              {errors.age && (
                <p className="text-sm text-destructive">{errors.age.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-primary" />
                Teléfono <span className="text-destructive">*</span>
              </Label>
              <Input
                id="phone"
                type="tel"
                placeholder="9991234567"
                maxLength={10}
                {...register("phone")}
              />
              {errors.phone && (
                <p className="text-sm text-destructive">{errors.phone.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address" className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              Dirección <span className="text-destructive">*</span>
            </Label>
            <Input
              id="address"
              placeholder="Tu dirección completa"
              {...register("address")}
            />
            {errors.address && (
              <p className="text-sm text-destructive">{errors.address.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              Correo electrónico <span className="text-destructive">*</span>
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="tu@email.com"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Los campos marcados con <span className="text-destructive">*</span> son obligatorios.
          </p>

          <Button
            type="submit"
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
            disabled={isLoading}
          >
            {isLoading ? "Registrando..." : "Continuar al Calendario"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
