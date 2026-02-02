import { useState, useEffect } from "react";
import { format, addDays, startOfWeek, isSameDay, isWeekend, isBefore, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Users, Check, Calendar } from "lucide-react";

interface ReservationCalendarProps {
  volunteerId: string;
  volunteerEmail: string;
  onBack: () => void;
}

interface DayInfo {
  date: Date;
  availableSlots: number;
  hasReservation: boolean;
  reservationStatus?: string;
}

const MAX_SLOTS = 23;

export function ReservationCalendar({ volunteerId, volunteerEmail, onBack }: ReservationCalendarProps) {
  const [currentWeek, setCurrentWeek] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [weekDays, setWeekDays] = useState<DayInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadWeekData = async () => {
    setIsLoading(true);
    try {
      const days: DayInfo[] = [];
      
      for (let i = 0; i < 5; i++) {
        const date = addDays(currentWeek, i);
        const dateStr = format(date, "yyyy-MM-dd");

        // Get reservation count for this date
        const { count } = await supabase
          .from("reservations")
          .select("*", { count: "exact", head: true })
          .eq("reservation_date", dateStr)
          .neq("status", "cancelled");

        // Check if volunteer has a reservation for this date
        const { data: existingReservation } = await supabase
          .from("reservations")
          .select("status")
          .eq("volunteer_id", volunteerId)
          .eq("reservation_date", dateStr)
          .neq("status", "cancelled")
          .maybeSingle();

        days.push({
          date,
          availableSlots: MAX_SLOTS - (count || 0),
          hasReservation: !!existingReservation,
          reservationStatus: existingReservation?.status,
        });
      }

      setWeekDays(days);
    } catch (error) {
      console.error("Error loading week data:", error);
      toast.error("Error al cargar el calendario");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadWeekData();

    // Subscribe to realtime changes
    const channel = supabase
      .channel("reservations-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reservations" },
        () => {
          loadWeekData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentWeek, volunteerId]);

  const handleReservation = async () => {
    if (!selectedDate) return;

    setIsSubmitting(true);
    try {
      const dateStr = format(selectedDate, "yyyy-MM-dd");

      // Check available slots again
      const { count } = await supabase
        .from("reservations")
        .select("*", { count: "exact", head: true })
        .eq("reservation_date", dateStr)
        .neq("status", "cancelled");

      if ((count || 0) >= MAX_SLOTS) {
        toast.error("Lo sentimos, los cupos para este día se han agotado");
        loadWeekData();
        return;
      }

      // Create reservation
      const { error } = await supabase.from("reservations").insert({
        volunteer_id: volunteerId,
        reservation_date: dateStr,
        status: "pending",
      });

      if (error) {
        if (error.code === "23505") {
          toast.error("Ya tienes una reservación para este día");
        } else {
          throw error;
        }
        return;
      }

      toast.success(
        `¡Reservación enviada para el ${format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}! Recibirás un correo de confirmación.`
      );
      setSelectedDate(null);
      loadWeekData();
    } catch (error) {
      console.error("Error creating reservation:", error);
      toast.error("Error al crear la reservación");
    } finally {
      setIsSubmitting(false);
    }
  };

  const navigateWeek = (direction: "prev" | "next") => {
    setCurrentWeek((prev) => addDays(prev, direction === "next" ? 7 : -7));
  };

  const isPastDate = (date: Date) => {
    return isBefore(startOfDay(date), startOfDay(new Date()));
  };

  const getSlotColor = (slots: number) => {
    if (slots === 0) return "bg-destructive/10 text-destructive border-destructive/20";
    if (slots <= 5) return "bg-warning/10 text-warning-foreground border-warning/20";
    return "bg-success/10 text-success border-success/20";
  };

  return (
    <Card className="w-full max-w-2xl animate-fade-in shadow-lg border-border/50">
      <CardHeader className="text-center pb-2">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground">
            ← Volver
          </Button>
          <div className="flex-1 text-center">
            <CardTitle className="text-2xl font-display text-primary flex items-center justify-center gap-2">
              <Calendar className="h-6 w-6" />
              Calendario de Voluntariado
            </CardTitle>
          </div>
          <div className="w-16" />
        </div>
        <CardDescription className="text-muted-foreground">
          Selecciona el día que deseas asistir (Lunes a Viernes, 12:00 - 15:00)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Week Navigation */}
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigateWeek("prev")}
            disabled={isBefore(currentWeek, startOfWeek(new Date(), { weekStartsOn: 1 }))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="text-lg font-medium text-foreground">
            {format(currentWeek, "d 'de' MMMM", { locale: es })} -{" "}
            {format(addDays(currentWeek, 4), "d 'de' MMMM, yyyy", { locale: es })}
          </h3>
          <Button variant="outline" size="icon" onClick={() => navigateWeek("next")}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Days Grid */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            {weekDays.map((day) => {
              const isSelected = selectedDate && isSameDay(selectedDate, day.date);
              const isPast = isPastDate(day.date);
              const isFull = day.availableSlots === 0;
              const isDisabled = isPast || isFull || day.hasReservation;

              return (
                <button
                  key={day.date.toISOString()}
                  onClick={() => !isDisabled && setSelectedDate(day.date)}
                  disabled={isDisabled}
                  className={`
                    p-4 rounded-lg border-2 transition-all duration-200 text-left
                    ${isSelected ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border"}
                    ${isDisabled ? "opacity-50 cursor-not-allowed" : "hover:border-primary/50 hover:shadow-md cursor-pointer"}
                    ${day.hasReservation ? "bg-secondary/50" : ""}
                  `}
                >
                  <div className="text-center">
                    <p className="text-xs uppercase text-muted-foreground font-medium">
                      {format(day.date, "EEE", { locale: es })}
                    </p>
                    <p className="text-2xl font-bold text-foreground mt-1">
                      {format(day.date, "d")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(day.date, "MMM", { locale: es })}
                    </p>
                  </div>

                  <div className="mt-3">
                    {day.hasReservation ? (
                      <Badge
                        variant="secondary"
                        className="w-full justify-center text-xs py-1"
                      >
                        <Check className="h-3 w-3 mr-1" />
                        {day.reservationStatus === "confirmed" ? "Confirmado" : "Pendiente"}
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className={`w-full justify-center text-xs py-1 ${getSlotColor(day.availableSlots)}`}
                      >
                        <Users className="h-3 w-3 mr-1" />
                        {day.availableSlots} cupos
                      </Badge>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Reservation Button */}
        {selectedDate && (
          <div className="mt-6 p-4 bg-muted/50 rounded-lg animate-fade-in">
            <p className="text-center text-foreground mb-3">
              ¿Confirmar reservación para el{" "}
              <strong>{format(selectedDate, "EEEE d 'de' MMMM", { locale: es })}</strong>?
            </p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => setSelectedDate(null)}>
                Cancelar
              </Button>
              <Button
                onClick={handleReservation}
                disabled={isSubmitting}
                className="bg-primary hover:bg-primary/90"
              >
                {isSubmitting ? "Reservando..." : "Confirmar Reservación"}
              </Button>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="mt-6 flex flex-wrap gap-4 justify-center text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-success/30"></div>
            <span>Disponible</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-warning/30"></div>
            <span>Pocos cupos</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-destructive/30"></div>
            <span>Agotado</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
