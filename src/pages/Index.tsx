import { useState } from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { VolunteerForm } from "@/components/VolunteerForm";
import { ReservationCalendar } from "@/components/ReservationCalendar";
import { VolunteerProfile } from "@/components/VolunteerProfile";

type Step = "register" | "calendar" | "profile";

interface VolunteerInfo {
  id: string;
  email: string;
}

const Index = () => {
  const [step, setStep] = useState<Step>("register");
  const [volunteerInfo, setVolunteerInfo] = useState<VolunteerInfo | null>(null);

  const handleRegistrationSuccess = (volunteerId: string, volunteerEmail: string) => {
    setVolunteerInfo({ id: volunteerId, email: volunteerEmail });
    setStep("calendar");
  };

  const handleBack = () => {
    setStep("register");
    setVolunteerInfo(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero Section */}
      <section className="relative py-8 md:py-12 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />
        <div className="container mx-auto px-4 relative">
          <div className="text-center mb-8 animate-fade-in">
            <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-3">
              {step === "register" ? "¡Únete como Voluntario!" : step === "calendar" ? "Reserva tu Día" : "Tu Perfil"}
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              {step === "register"
                ? "Tu ayuda hace la diferencia. Regístrate y selecciona los días que puedas apoyar en nuestra cocina comunitaria."
                : step === "calendar"
                ? "Selecciona el día que deseas asistir. El servicio es de 12:00 a 15:00 hrs."
                : "Revisa y actualiza tu información personal."}
            </p>
          </div>

          <div className="flex justify-center">
            {step === "register" ? (
              <VolunteerForm onSuccess={handleRegistrationSuccess} />
            ) : step === "calendar" ? (
              volunteerInfo && (
                <div className="space-y-4 w-full flex flex-col items-center">
                  <ReservationCalendar
                    volunteerId={volunteerInfo.id}
                    volunteerEmail={volunteerInfo.email}
                    onBack={handleBack}
                  />
                  <button
                    onClick={() => setStep("profile")}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors underline"
                  >
                    Ver mi perfil
                  </button>
                </div>
              )
            ) : (
              volunteerInfo && (
                <VolunteerProfile
                  volunteerId={volunteerInfo.id}
                  onBack={() => setStep("calendar")}
                />
              )
            )}
          </div>
        </div>
      </section>

      {/* Info Section */}
      <section className="py-12 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="text-center p-6 bg-card rounded-xl shadow-sm border border-border/50 animate-fade-in">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🍽️</span>
              </div>
              <h3 className="font-display font-semibold text-foreground mb-2">Servicio</h3>
              <p className="text-sm text-muted-foreground">
                Lunes a Viernes de 12:00 a 15:00 hrs
              </p>
            </div>

            <div className="text-center p-6 bg-card rounded-xl shadow-sm border border-border/50 animate-fade-in" style={{ animationDelay: "0.1s" }}>
              <div className="w-12 h-12 bg-secondary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">👥</span>
              </div>
              <h3 className="font-display font-semibold text-foreground mb-2">Cupos Diarios</h3>
              <p className="text-sm text-muted-foreground">
                Máximo 23 voluntarios por día
              </p>
            </div>

            <div className="text-center p-6 bg-card rounded-xl shadow-sm border border-border/50 animate-fade-in" style={{ animationDelay: "0.2s" }}>
              <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">📧</span>
              </div>
              <h3 className="font-display font-semibold text-foreground mb-2">Confirmación</h3>
              <p className="text-sm text-muted-foreground">
                Recibirás un correo cuando tu reservación sea confirmada
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 border-t border-border/50">
        <div className="container mx-auto px-4 text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Reffetorio Mérida. Todos los derechos reservados.
          </p>
          <Link 
            to="/admin/login" 
            className="text-xs text-muted-foreground/60 hover:text-primary transition-colors"
          >
            Administración
          </Link>
        </div>
      </footer>
    </div>
  );
};

export default Index;
