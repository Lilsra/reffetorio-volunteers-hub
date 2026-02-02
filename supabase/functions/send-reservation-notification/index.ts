import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const adminEmail = Deno.env.get("ADMIN_EMAIL");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface NotificationRequest {
  reservation_id: string;
  volunteer_name: string;
  volunteer_email: string;
  reservation_date: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { reservation_id, volunteer_name, volunteer_email, reservation_date }: NotificationRequest = await req.json();

    if (!reservation_id || !volunteer_name || !volunteer_email || !reservation_date) {
      throw new Error("Faltan campos requeridos");
    }

    if (!adminEmail) {
      throw new Error("ADMIN_EMAIL no configurado");
    }

    // Format date for display
    const dateObj = new Date(reservation_date + "T12:00:00");
    const formattedDate = dateObj.toLocaleDateString("es-MX", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Get current reservations count for this date
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { count } = await supabase
      .from("reservations")
      .select("*", { count: "exact", head: true })
      .eq("reservation_date", reservation_date)
      .neq("status", "cancelled");

    const currentCount = count || 0;
    const availableSlots = 23 - currentCount;

    // Send notification to admin
    const emailResponse = await resend.emails.send({
      from: "Reffetorio Mérida <noreply@resend.dev>",
      to: [adminEmail],
      subject: `Nueva reservación de voluntario - ${formattedDate}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #c45d35 0%, #d4a574 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #faf8f5; padding: 30px; border: 1px solid #e5ddd5; border-top: none; border-radius: 0 0 10px 10px; }
            .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #c45d35; }
            .slots-info { background: ${availableSlots <= 5 ? '#fff3cd' : '#d4edda'}; padding: 15px; border-radius: 8px; text-align: center; margin-top: 20px; }
            .btn { display: inline-block; padding: 12px 30px; background: #c45d35; color: white; text-decoration: none; border-radius: 6px; margin-top: 20px; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🍽️ Nueva Reservación</h1>
              <p>Reffetorio Mérida - Portal de Voluntarios</p>
            </div>
            <div class="content">
              <p>¡Hola! Un nuevo voluntario ha solicitado reservar un día.</p>
              
              <div class="info-box">
                <h3 style="margin-top: 0; color: #c45d35;">Datos del Voluntario</h3>
                <p><strong>Nombre:</strong> ${volunteer_name}</p>
                <p><strong>Correo:</strong> ${volunteer_email}</p>
                <p><strong>Fecha solicitada:</strong> ${formattedDate}</p>
                <p><strong>ID Reservación:</strong> ${reservation_id}</p>
              </div>

              <div class="slots-info">
                <strong>Cupos para ese día:</strong> ${currentCount}/23 ocupados (${availableSlots} disponibles)
              </div>

              <p style="margin-top: 20px;">Por favor, confirma o rechaza esta reservación desde el panel de administrador.</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Reffetorio Mérida</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Admin notification sent:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
