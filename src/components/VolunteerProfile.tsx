import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { User, Mail, MapPin, Phone, Calendar, Edit3, Save, X, History } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const phoneRegex = /^[0-9]{10}$/;

const profileSchema = z.object({
  first_name: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres").max(50),
  last_name: z.string().trim().min(2, "Los apellidos deben tener al menos 2 caracteres").max(100),
  age: z.number({ invalid_type_error: "Ingresa una edad válida" }).min(16).max(100),
  address: z.string().trim().min(10, "La dirección debe ser más específica").max(200),
  phone: z.string().trim().regex(phoneRegex, "Ingresa un número de 10 dígitos").optional().or(z.literal("")),
});

type ProfileFormData = z.infer<typeof profileSchema>;

interface Reservation {
  id: string;
  reservation_date: string;
  status: string;
  created_at: string;
}

interface VolunteerProfileProps {
  volunteerId: string;
  onBack: () => void;
}

export function VolunteerProfile({ volunteerId, onBack }: VolunteerProfileProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [volunteer, setVolunteer] = useState<any>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
  });

  useEffect(() => {
    loadProfile();
    loadReservations();
  }, [volunteerId]);

  const loadProfile = async () => {
    try {
      const { data, error } = await supabase
        .from("volunteers")
        .select("*")
        .eq("id", volunteerId)
        .single();

      if (error) throw error;
      setVolunteer(data);
      reset({
        first_name: data.first_name,
        last_name: data.last_name,
        age: data.age,
        address: data.address,
        phone: data.phone || "",
      });
    } catch (error) {
      console.error("Error loading profile:", error);
      toast.error("Error al cargar el perfil");
    } finally {
      setIsLoading(false);
    }
  };

  const loadReservations = async () => {
    const { data } = await supabase
      .from("reservations")
      .select("id, reservation_date, status, created_at")
      .eq("volunteer_id", volunteerId)
      .order("reservation_date", { ascending: false })
      .limit(10);

    setReservations(data || []);
  };

  const onSubmit = async (data: ProfileFormData) => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("volunteers")
        .update({
          first_name: data.first_name.trim(),
          last_name: data.last_name.trim(),
          age: data.age,
          address: data.address.trim(),
          phone: data.phone?.trim() || null,
        })
        .eq("id", volunteerId);

      if (error) throw error;

      toast.success("Perfil actualizado correctamente");
      setIsEditing(false);
      loadProfile();
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Error al actualizar el perfil");
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-warning/10 text-warning-foreground text-xs">Pendiente</Badge>;
      case "confirmed":
        return <Badge variant="outline" className="bg-success/10 text-success text-xs">Confirmado</Badge>;
      case "cancelled":
        return <Badge variant="outline" className="bg-destructive/10 text-destructive text-xs">Cancelado</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!volunteer) return null;

  return (
    <div className="w-full max-w-lg space-y-4 animate-fade-in">
      <Card className="shadow-lg border-border/50">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground">
              ← Volver
            </Button>
            {!isEditing ? (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                <Edit3 className="h-4 w-4 mr-1" />
                Editar
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => { setIsEditing(false); reset(); }}>
                <X className="h-4 w-4 mr-1" />
                Cancelar
              </Button>
            )}
          </div>
          <CardTitle className="text-xl font-display text-primary text-center">Mi Perfil</CardTitle>
          <CardDescription className="text-center">
            Registrado el {format(new Date(volunteer.created_at), "d 'de' MMMM, yyyy", { locale: es })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="first_name" className="text-xs flex items-center gap-1">
                    <User className="h-3 w-3 text-primary" /> Nombre
                  </Label>
                  <Input id="first_name" {...register("first_name")} />
                  {errors.first_name && <p className="text-xs text-destructive">{errors.first_name.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="last_name" className="text-xs flex items-center gap-1">
                    <User className="h-3 w-3 text-primary" /> Apellidos
                  </Label>
                  <Input id="last_name" {...register("last_name")} />
                  {errors.last_name && <p className="text-xs text-destructive">{errors.last_name.message}</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="age" className="text-xs flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-primary" /> Edad
                  </Label>
                  <Input id="age" type="number" {...register("age", { valueAsNumber: true })} />
                  {errors.age && <p className="text-xs text-destructive">{errors.age.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="phone" className="text-xs flex items-center gap-1">
                    <Phone className="h-3 w-3 text-primary" /> Teléfono
                  </Label>
                  <Input id="phone" type="tel" maxLength={10} {...register("phone")} />
                  {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="address" className="text-xs flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-primary" /> Dirección
                </Label>
                <Input id="address" {...register("address")} />
                {errors.address && <p className="text-xs text-destructive">{errors.address.message}</p>}
              </div>
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  <Mail className="h-3 w-3 text-muted-foreground" /> Correo (no editable)
                </Label>
                <Input value={volunteer.email} disabled className="bg-muted" />
              </div>
              <Button type="submit" className="w-full" disabled={isSaving}>
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? "Guardando..." : "Guardar Cambios"}
              </Button>
            </form>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <InfoField icon={<User className="h-3 w-3" />} label="Nombre" value={volunteer.first_name} />
                <InfoField icon={<User className="h-3 w-3" />} label="Apellidos" value={volunteer.last_name} />
                <InfoField icon={<Calendar className="h-3 w-3" />} label="Edad" value={`${volunteer.age} años`} />
                <InfoField icon={<Phone className="h-3 w-3" />} label="Teléfono" value={volunteer.phone || "No registrado"} />
              </div>
              <InfoField icon={<MapPin className="h-3 w-3" />} label="Dirección" value={volunteer.address} />
              <InfoField icon={<Mail className="h-3 w-3" />} label="Correo" value={volunteer.email} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reservation History */}
      {reservations.length > 0 && (
        <Card className="shadow-lg border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-display text-foreground flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Historial de Reservaciones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {reservations.map((r) => (
                <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/50">
                  <span className="text-sm text-foreground">
                    {format(new Date(r.reservation_date + "T12:00:00"), "EEE d 'de' MMM, yyyy", { locale: es })}
                  </span>
                  {getStatusBadge(r.status)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function InfoField({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground flex items-center gap-1">{icon} {label}</p>
      <p className="text-sm text-foreground font-medium">{value}</p>
    </div>
  );
}
