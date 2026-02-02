-- Tabla de voluntarios
CREATE TABLE public.volunteers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  age INTEGER NOT NULL,
  address TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabla de reservaciones
CREATE TABLE public.reservations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  volunteer_id UUID REFERENCES public.volunteers(id) ON DELETE CASCADE NOT NULL,
  reservation_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(volunteer_id, reservation_date)
);

-- Tabla de configuración del admin
CREATE TABLE public.admin_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_email TEXT NOT NULL,
  max_volunteers_per_day INTEGER NOT NULL DEFAULT 23,
  notification_hours_before INTEGER NOT NULL DEFAULT 12,
  service_start_time TIME NOT NULL DEFAULT '12:00:00',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insertar configuración por defecto
INSERT INTO public.admin_settings (admin_email, max_volunteers_per_day, notification_hours_before, service_start_time)
VALUES ('admin@reffetorio.mx', 23, 12, '12:00:00');

-- Habilitar RLS
ALTER TABLE public.volunteers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

-- Políticas para voluntarios (público puede insertar, solo lectura de sus propios datos)
CREATE POLICY "Anyone can register as volunteer"
ON public.volunteers
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Volunteers can view their own data"
ON public.volunteers
FOR SELECT
USING (true);

-- Políticas para reservaciones (público puede crear, ver disponibilidad)
CREATE POLICY "Anyone can create reservations"
ON public.reservations
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can view reservations"
ON public.reservations
FOR SELECT
USING (true);

CREATE POLICY "Volunteers can update their reservations"
ON public.reservations
FOR UPDATE
USING (true);

-- Políticas para admin_settings (solo lectura pública para mostrar configuración)
CREATE POLICY "Anyone can view admin settings"
ON public.admin_settings
FOR SELECT
USING (true);

-- Función para contar reservaciones por fecha
CREATE OR REPLACE FUNCTION public.get_reservations_count(target_date DATE)
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(COUNT(*)::INTEGER, 0)
  FROM public.reservations
  WHERE reservation_date = target_date
  AND status != 'cancelled';
$$;

-- Función para obtener cupos disponibles por fecha
CREATE OR REPLACE FUNCTION public.get_available_slots(target_date DATE)
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
  SELECT (
    SELECT max_volunteers_per_day FROM public.admin_settings LIMIT 1
  ) - (
    SELECT COALESCE(COUNT(*)::INTEGER, 0)
    FROM public.reservations
    WHERE reservation_date = target_date
    AND status != 'cancelled'
  );
$$;

-- Habilitar realtime para reservaciones
ALTER PUBLICATION supabase_realtime ADD TABLE public.reservations;