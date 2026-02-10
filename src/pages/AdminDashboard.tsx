import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, X, LogOut, Users, Calendar, Download, Bell, Search, User, Mail, Phone, MapPin, CalendarCheck, CheckCircle2, Clock, AlertCircle, ArrowLeft } from "lucide-react";

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

interface Volunteer {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  age: number;
  address: string;
  phone: string | null;
  avatar_url: string | null;
  status: string;
  created_at: string;
}

interface VolunteerReservation {
  id: string;
  reservation_date: string;
  status: string;
  created_at: string;
}

export default function AdminDashboard() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingVolunteers, setIsLoadingVolunteers] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVolunteer, setSelectedVolunteer] = useState<Volunteer | null>(null);
  const [volunteerReservations, setVolunteerReservations] = useState<VolunteerReservation[]>([]);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const { signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadReservations();
    loadVolunteers();

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

  const loadVolunteers = async () => {
    try {
      const { data, error } = await supabase
        .from("volunteers")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setVolunteers(data || []);
    } catch (error) {
      console.error("Error loading volunteers:", error);
    } finally {
      setIsLoadingVolunteers(false);
    }
  };

  const openVolunteerDetail = async (volunteer: Volunteer) => {
    setSelectedVolunteer(volunteer);
    setIsLoadingDetail(true);
    try {
      const { data } = await supabase
        .from("reservations")
        .select("id, reservation_date, status, created_at")
        .eq("volunteer_id", volunteer.id)
        .order("reservation_date", { ascending: false });

      setVolunteerReservations(data || []);
    } catch {
      toast.error("Error al cargar historial");
    } finally {
      setIsLoadingDetail(false);
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
    await signOut();
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

  const filteredVolunteers = volunteers.filter((v) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      v.first_name.toLowerCase().includes(q) ||
      v.last_name.toLowerCase().includes(q) ||
      v.email.toLowerCase().includes(q)
    );
  });

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

  const getVolunteerStats = (volunteerId: string) => {
    const vReservations = reservations.filter((r) => r.volunteers.id === volunteerId);
    return {
      total: vReservations.length,
      confirmed: vReservations.filter((r) => r.status === "confirmed").length,
      pending: vReservations.filter((r) => r.status === "pending").length,
    };
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

  // Detail modal stats
  const detailStats = selectedVolunteer ? {
    total: volunteerReservations.length,
    confirmed: volunteerReservations.filter((r) => r.status === "confirmed").length,
    pending: volunteerReservations.filter((r) => r.status === "pending").length,
    cancelled: volunteerReservations.filter((r) => r.status === "cancelled").length,
  } : null;

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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
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
                  <p className="text-2xl font-bold text-foreground">{volunteers.length}</p>
                  <p className="text-sm text-muted-foreground">Voluntarios</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-accent/10 rounded-full">
                  <CalendarCheck className="h-6 w-6 text-accent-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{reservations.length}</p>
                  <p className="text-sm text-muted-foreground">Total Reservas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs: Reservaciones + Voluntarios */}
        <Tabs defaultValue="reservations" className="space-y-4">
          <TabsList>
            <TabsTrigger value="reservations" className="gap-2">
              <Calendar className="h-4 w-4" />
              Reservaciones
            </TabsTrigger>
            <TabsTrigger value="volunteers" className="gap-2">
              <Users className="h-4 w-4" />
              Voluntarios
            </TabsTrigger>
          </TabsList>

          {/* Reservations Tab */}
          <TabsContent value="reservations">
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
          </TabsContent>

          {/* Volunteers Tab */}
          <TabsContent value="volunteers">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Directorio de Voluntarios
                    </CardTitle>
                    <CardDescription>Consulta perfiles y actividad de cada voluntario</CardDescription>
                  </div>
                  <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nombre o correo..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingVolunteers ? (
                  <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : filteredVolunteers.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="h-10 w-10 mx-auto mb-2 opacity-40" />
                    <p>No se encontraron voluntarios</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Voluntario</TableHead>
                        <TableHead>Correo</TableHead>
                        <TableHead>Teléfono</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Solicitudes</TableHead>
                        <TableHead>Aprobadas</TableHead>
                        <TableHead className="text-right">Acción</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredVolunteers.map((v) => {
                        const stats = getVolunteerStats(v.id);
                        return (
                          <TableRow key={v.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center overflow-hidden border border-border">
                                  {v.avatar_url ? (
                                    <img src={v.avatar_url} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <User className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </div>
                                <span className="font-medium">{v.first_name} {v.last_name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{v.email}</TableCell>
                            <TableCell className="text-muted-foreground">{v.phone || "—"}</TableCell>
                            <TableCell>
                              <Badge variant={v.status === "active" ? "default" : "secondary"} className="text-xs">
                                {v.status === "active" ? "Activo" : "Inactivo"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">{stats.total}</TableCell>
                            <TableCell className="text-center">{stats.confirmed}</TableCell>
                            <TableCell className="text-right">
                              <Button size="sm" variant="outline" onClick={() => openVolunteerDetail(v)}>
                                Ver perfil
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Volunteer Detail Dialog */}
      <Dialog open={!!selectedVolunteer} onOpenChange={(open) => !open && setSelectedVolunteer(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {selectedVolunteer && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-primary/20">
                    {selectedVolunteer.avatar_url ? (
                      <img src={selectedVolunteer.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <User className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <p className="text-lg">{selectedVolunteer.first_name} {selectedVolunteer.last_name}</p>
                    <p className="text-sm font-normal text-muted-foreground">
                      Registrado el {format(new Date(selectedVolunteer.created_at), "d 'de' MMMM, yyyy", { locale: es })}
                    </p>
                  </div>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 mt-2">
                {/* Info */}
                <div className="grid grid-cols-2 gap-3 p-4 bg-muted/50 rounded-lg border border-border/50">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-primary" />
                    <span className="text-muted-foreground truncate">{selectedVolunteer.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-primary" />
                    <span className="text-muted-foreground">{selectedVolunteer.phone || "No registrado"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span className="text-muted-foreground">{selectedVolunteer.age} años</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Badge variant={selectedVolunteer.status === "active" ? "default" : "secondary"} className="text-xs">
                      {selectedVolunteer.status === "active" ? "Activo" : "Inactivo"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-sm col-span-2">
                    <MapPin className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-muted-foreground">{selectedVolunteer.address}</span>
                  </div>
                </div>

                {/* Stats */}
                {detailStats && (
                  <div className="grid grid-cols-4 gap-2">
                    <div className="text-center p-2 rounded-lg bg-primary/10 border border-border/30">
                      <p className="text-lg font-bold text-foreground">{detailStats.total}</p>
                      <p className="text-[10px] text-muted-foreground">Solicitados</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-success/10 border border-border/30">
                      <p className="text-lg font-bold text-foreground">{detailStats.confirmed}</p>
                      <p className="text-[10px] text-muted-foreground">Aprobados</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-warning/10 border border-border/30">
                      <p className="text-lg font-bold text-foreground">{detailStats.pending}</p>
                      <p className="text-[10px] text-muted-foreground">Pendientes</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-destructive/10 border border-border/30">
                      <p className="text-lg font-bold text-foreground">{detailStats.cancelled}</p>
                      <p className="text-[10px] text-muted-foreground">Cancelados</p>
                    </div>
                  </div>
                )}

                {/* History */}
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1">
                    <CalendarCheck className="h-4 w-4 text-primary" />
                    Historial de Reservaciones
                  </h4>
                  {isLoadingDetail ? (
                    <div className="flex justify-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                    </div>
                  ) : volunteerReservations.length > 0 ? (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {volunteerReservations.map((r) => (
                        <div key={r.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50 border border-border/30">
                          <span className="text-sm text-foreground">
                            {format(new Date(r.reservation_date + "T12:00:00"), "EEE d 'de' MMM, yyyy", { locale: es })}
                          </span>
                          {getStatusBadge(r.status)}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">Sin reservaciones registradas</p>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
