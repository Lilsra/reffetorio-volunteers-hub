import { useState, useEffect, useRef } from "react";
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
import { User, Mail, MapPin, Phone, Calendar, Edit3, Save, X, History, Camera, CalendarCheck, Clock, CheckCircle2, AlertCircle } from "lucide-react";
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
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [volunteer, setVolunteer] = useState<any>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      .order("reservation_date", { ascending: false });

    setReservations(data || []);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

    setIsUploadingPhoto(true);
    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `${volunteerId}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from("volunteers")
        .update({ avatar_url: avatarUrl })
        .eq("id", volunteerId);

      if (updateError) throw updateError;

      toast.success("Foto actualizada correctamente");
      loadProfile();
    } catch (error) {
      console.error("Error uploading photo:", error);
      toast.error("Error al subir la foto");
    } finally {
      setIsUploadingPhoto(false);
    }
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

  // Stats
  const totalRequested = reservations.length;
  const totalConfirmed = reservations.filter((r) => r.status === "confirmed").length;
  const totalPending = reservations.filter((r) => r.status === "pending").length;
  const totalCancelled = reservations.filter((r) => r.status === "cancelled").length;

  return (
    <div className="w-full max-w-lg space-y-4 animate-fade-in">
      {/* Profile Card */}
      <Card className="shadow-lg border-border/50">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground">
              ← Volver
            </Button>
            <div className="flex items-center gap-2">
              <Badge variant={volunteer.status === "active" ? "default" : "secondary"} className="text-xs">
                {volunteer.status === "active" ? "Activo" : "Inactivo"}
              </Badge>
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
          </div>

          {/* Avatar Section */}
          <div className="flex flex-col items-center pt-2 pb-1">
            <div className="relative group">
              <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-primary/20 bg-muted flex items-center justify-center shadow-md">
                {volunteer.avatar_url ? (
                  <img
                    src={volunteer.avatar_url}
                    alt="Foto de perfil"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="h-10 w-10 text-muted-foreground" />
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingPhoto}
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:bg-primary/90 transition-colors border-2 border-background"
              >
                {isUploadingPhoto ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-foreground border-t-transparent" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoUpload}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">Toca el ícono para cambiar tu foto</p>
          </div>

          <CardTitle className="text-xl font-display text-primary text-center">
            {volunteer.first_name} {volunteer.last_name}
          </CardTitle>
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

      {/* Stats Summary */}
      <Card className="shadow-lg border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-display text-foreground flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-primary" />
            Resumen de Actividad
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon={<Calendar className="h-5 w-5 text-primary" />}
              label="Días solicitados"
              value={totalRequested}
              bgClass="bg-primary/10"
            />
            <StatCard
              icon={<CheckCircle2 className="h-5 w-5 text-success" />}
              label="Días aprobados"
              value={totalConfirmed}
              bgClass="bg-success/10"
            />
            <StatCard
              icon={<Clock className="h-5 w-5 text-warning-foreground" />}
              label="Pendientes"
              value={totalPending}
              bgClass="bg-warning/10"
            />
            <StatCard
              icon={<AlertCircle className="h-5 w-5 text-destructive" />}
              label="Cancelados"
              value={totalCancelled}
              bgClass="bg-destructive/10"
            />
          </div>
          {totalRequested === 0 && (
            <p className="text-sm text-muted-foreground text-center mt-4">
              Aún no has solicitado ningún día de voluntariado.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Reservation History */}
      <Card className="shadow-lg border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-display text-foreground flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Historial de Reservaciones
          </CardTitle>
        </CardHeader>
        <CardContent>
          {reservations.length > 0 ? (
            <div className="space-y-2">
              {reservations.map((r) => (
                <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/50">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-foreground">
                      {format(new Date(r.reservation_date + "T12:00:00"), "EEEE d 'de' MMMM, yyyy", { locale: es })}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Solicitado el {format(new Date(r.created_at), "d MMM yyyy", { locale: es })}
                    </span>
                  </div>
                  {getStatusBadge(r.status)}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <Calendar className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No tienes reservaciones aún.</p>
              <p className="text-xs text-muted-foreground">Regresa al calendario para solicitar un día.</p>
            </div>
          )}
        </CardContent>
      </Card>
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

function StatCard({ icon, label, value, bgClass }: { icon: React.ReactNode; label: string; value: number; bgClass: string }) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg ${bgClass} border border-border/30`}>
      {icon}
      <div>
        <p className="text-xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
