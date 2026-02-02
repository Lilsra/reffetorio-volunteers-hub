import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { User, Mail, MapPin, Calendar } from "lucide-react";

const volunteerSchema = z.object({
  first_name: z.string().min(2, "El nombre debe tener al menos 2 caracteres").max(50),
  last_name: z.string().min(2, "Los apellidos deben tener al menos 2 caracteres").max(100),
  age: z.number().min(16, "Debes tener al menos 16 años").max(100, "Edad inválida"),
  address: z.string().min(10, "La dirección debe ser más específica").max(200),
  email: z.string().email("Correo electrónico inválido").max(100),
});

type VolunteerFormData = z.infer<typeof volunteerSchema>;

interface VolunteerFormProps {
  onSuccess: (volunteerId: string, volunteerEmail: string) => void;
}

export function VolunteerForm({ onSuccess }: VolunteerFormProps) {
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<VolunteerFormData>({
    resolver: zodResolver(volunteerSchema),
  });

  const onSubmit = async (data: VolunteerFormData) => {
    setIsLoading(true);
    try {
      // Check if email already exists
      const { data: existing } = await supabase
        .from("volunteers")
        .select("id, email")
        .eq("email", data.email)
        .maybeSingle();

      if (existing) {
        // Volunteer already registered, proceed to calendar
        onSuccess(existing.id, existing.email);
        toast.info("¡Ya estás registrado! Selecciona tu día de voluntariado.");
        return;
      }

      // Create new volunteer
      const { data: volunteer, error } = await supabase
        .from("volunteers")
        .insert({
          first_name: data.first_name,
          last_name: data.last_name,
          age: data.age,
          address: data.address,
          email: data.email,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("¡Registro exitoso! Ahora selecciona tu día de voluntariado.");
      onSuccess(volunteer.id, volunteer.email);
      reset();
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name" className="flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                Nombre
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
                Apellidos
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

          <div className="space-y-2">
            <Label htmlFor="age" className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Edad
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
            <Label htmlFor="address" className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              Dirección
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
              Correo electrónico
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
