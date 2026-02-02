import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, X, LogOut, Users, Calendar, Download, Bell } from "lucide-react";

interface Reservation {
  id: string;
  reservation_date: string;
  status: string;
  created_at: string;
  volunteers: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    age: number;
    address: string;
  };
}

export default function AdminDashboard() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
    loadReservations();

    const channel = supabase
      .channel("admin-reservations")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, () => {
        loadReservations();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/admin/login");
    }
  };

  const loadReservations = async () => {
    try {
      const { data, error } = await supabase
        .from("reservations")
        .select(`
          *,
          volunteers (
            id,
            first_name,
            last_name,
            email,
            age,
            address
          )
        `)
        .order("reservation_date", { ascending: true })
        .order("created_at", { ascending: false });

      if (error) throw error;
      setReservations(data || []);
    } catch (error) {
      console.error("Error loading reservations:", error);
      toast.error("Error al cargar reservaciones");
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmation = async (reservationId: string, action: "confirm" | "cancel") => {
    setProcessingId(reservationId);
    try {
      const { error } = await supabase.functions.invoke("confirm-reservation", {
        body: { reservation_id: reservationId, action },
      });

      if (error) throw error;

      toast.success(action === "confirm" ? "Reservación confirmada" : "Reservación cancelada");
      loadReservations();
    } catch (error: any) {
      console.error("Error:", error);
      toast.error("Error al procesar la reservación");
    } finally {
      setProcessingId(null);
    }
  };

  const handleCheckUnfilled = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("check-unfilled-slots");
      if (error) throw error;
      
      if (data.message?.includes("weekend")) {
        toast.info("Mañana es fin de semana, no hay servicio");
      } else if (data.message?.includes("filled")) {
        toast.success("Todos los cupos para mañana están llenos");
      } else {
        toast.success(`Alerta enviada: ${data.slots_available} cupos disponibles para mañana`);
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("Error al verificar cupos");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/admin/login");
  };

  const exportToCSV = () => {
    const headers = ["Fecha", "Nombre", "Apellidos", "Email", "Edad", "Dirección", "Estado"];
    const rows = reservations.map((r) => [
      r.reservation_date,
      r.volunteers.first_name,
      r.volunteers.last_name,
      r.volunteers.email,
      r.volunteers.age,
      r.volunteers.address,
      r.status,
    ]);

    const csvContent = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `reservaciones_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
  };

  const pendingReservations = reservations.filter((r) => r.status === "pending");
  const confirmedReservations = reservations.filter((r) => r.status === "confirmed");
  const cancelledReservations = reservations.filter((r) => r.status === "cancelled");

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-warning/10 text-warning-foreground">Pendiente</Badge>;
      case "confirmed":
        return <Badge variant="outline" className="bg-success/10 text-success">Confirmado</Badge>;
      case "cancelled":
        return <Badge variant="outline" className="bg-destructive/10 text-destructive">Cancelado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const ReservationTable = ({ data, showActions = false }: { data: Reservation[]; showActions?: boolean }) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Fecha</TableHead>
          <TableHead>Voluntario</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Edad</TableHead>
          <TableHead>Estado</TableHead>
          {showActions && <TableHead className="text-right">Acciones</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.length === 0 ? (
          <TableRow>
            <TableCell colSpan={showActions ? 6 : 5} className="text-center text-muted-foreground py-8">
              No hay reservaciones
            </TableCell>
          </TableRow>
        ) : (
          data.map((reservation) => (
            <TableRow key={reservation.id}>
              <TableCell className="font-medium">
                {format(new Date(reservation.reservation_date + "T12:00:00"), "EEE d MMM", { locale: es })}
              </TableCell>
              <TableCell>
                {reservation.volunteers.first_name} {reservation.volunteers.last_name}
              </TableCell>
              <TableCell className="text-muted-foreground">{reservation.volunteers.email}</TableCell>
              <TableCell>{reservation.volunteers.age}</TableCell>
              <TableCell>{getStatusBadge(reservation.status)}</TableCell>
              {showActions && (
                <TableCell className="text-right">
                  <div className="flex gap-2 justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-success hover:bg-success/10"
                      onClick={() => handleConfirmation(reservation.id, "confirm")}
                      disabled={processingId === reservation.id}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => handleConfirmation(reservation.id, "cancel")}
                      disabled={processingId === reservation.id}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-display font-bold text-foreground">Panel de Administrador</h1>
            <p className="text-sm text-muted-foreground">Reffetorio Mérida</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleCheckUnfilled}>
              <Bell className="h-4 w-4 mr-2" />
              Verificar Cupos
            </Button>
            <Button variant="outline" size="sm" onClick={exportToCSV}>
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Salir
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-warning/10 rounded-full">
                  <Calendar className="h-6 w-6 text-warning-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{pendingReservations.length}</p>
                  <p className="text-sm text-muted-foreground">Pendientes</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-success/10 rounded-full">
                  <Check className="h-6 w-6 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{confirmedReservations.length}</p>
                  <p className="text-sm text-muted-foreground">Confirmadas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-full">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{reservations.length}</p>
                  <p className="text-sm text-muted-foreground">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Reservations Tabs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Reservaciones
            </CardTitle>
            <CardDescription>Gestiona las solicitudes de voluntariado</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <Tabs defaultValue="pending">
                <TabsList className="mb-4">
                  <TabsTrigger value="pending">
                    Pendientes ({pendingReservations.length})
                  </TabsTrigger>
                  <TabsTrigger value="confirmed">
                    Confirmadas ({confirmedReservations.length})
                  </TabsTrigger>
                  <TabsTrigger value="cancelled">
                    Canceladas ({cancelledReservations.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="pending">
                  <ReservationTable data={pendingReservations} showActions />
                </TabsContent>

                <TabsContent value="confirmed">
                  <ReservationTable data={confirmedReservations} />
                </TabsContent>

                <TabsContent value="cancelled">
                  <ReservationTable data={cancelledReservations} />
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
