import { Heart } from "lucide-react";

export function Header() {
  return (
    <header className="w-full bg-card/80 backdrop-blur-sm border-b border-border/50 sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
            <Heart className="h-5 w-5 text-primary fill-primary/20" />
          </div>
          <div className="text-center">
            <h1 className="text-xl md:text-2xl font-display font-bold text-foreground">
              Reffetorio Mérida
            </h1>
            <p className="text-xs text-muted-foreground">Portal de Voluntarios</p>
          </div>
        </div>
      </div>
    </header>
  );
}
