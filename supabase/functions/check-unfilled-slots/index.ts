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

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!adminEmail) {
      throw new Error("ADMIN_EMAIL no configurado");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    // Check if tomorrow is a weekday (Monday = 1, Friday = 5)
    const dayOfWeek = tomorrow.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return new Response(
        JSON.stringify({ message: "Tomorrow is weekend, no check needed" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get reservation count for tomorrow
    const { count } = await supabase
      .from("reservations")
      .select("*", { count: "exact", head: true })
      .eq("reservation_date", tomorrowStr)
      .neq("status", "cancelled");

    const currentCount = count || 0;
    const maxSlots = 23;
    const availableSlots = maxSlots - currentCount;

    // Only send notification if slots are not full
    if (currentCount >= maxSlots) {
      return new Response(
        JSON.stringify({ message: "All slots filled for tomorrow", count: currentCount }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Format date for display
    const formattedDate = tomorrow.toLocaleDateString("es-MX", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Get list of confirmed volunteers for context
    const { data: volunteers } = await supabase
      .from("reservations")
      .select(`
        volunteers (
          first_name,
          last_name
        )
      `)
      .eq("reservation_date", tomorrowStr)
      .eq("status", "confirmed");

    const volunteerList = volunteers?.map(
      (v: any) => `${v.volunteers.first_name} ${v.volunteers.last_name}`
    ) || [];

    // Send alert to admin
    const emailResponse = await resend.emails.send({
      from: "Reffetorio Mérida <noreply@resend.dev>",
      to: [adminEmail],
      subject: `⚠️ Alerta: ${availableSlots} cupos sin llenar para mañana`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #f0ad4e 0%, #ec971f 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #faf8f5; padding: 30px; border: 1px solid #e5ddd5; border-top: none; border-radius: 0 0 10px 10px; }
            .alert-box { background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f0ad4e; text-align: center; }
            .stats { display: flex; justify-content: space-around; margin: 20px 0; }
            .stat { text-align: center; padding: 15px; background: white; border-radius: 8px; flex: 1; margin: 0 5px; }
            .stat-number { font-size: 32px; font-weight: bold; color: #c45d35; }
            .volunteer-list { background: white; padding: 15px; border-radius: 8px; margin-top: 20px; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⚠️ Alerta de Cupos</h1>
              <p>Reffetorio Mérida - Portal de Voluntarios</p>
            </div>
            <div class="content">
              <div class="alert-box">
                <h2 style="margin: 0; color: #856404;">¡Faltan voluntarios para mañana!</h2>
                <p style="margin-bottom: 0;">${formattedDate}</p>
              </div>

              <div class="stats">
                <div class="stat">
                  <div class="stat-number">${currentCount}</div>
                  <div>Confirmados</div>
                </div>
                <div class="stat">
                  <div class="stat-number" style="color: #f0ad4e;">${availableSlots}</div>
                  <div>Cupos vacíos</div>
                </div>
                <div class="stat">
                  <div class="stat-number">${maxSlots}</div>
                  <div>Total</div>
                </div>
              </div>

              ${volunteerList.length > 0 ? `
                <div class="volunteer-list">
                  <h3 style="margin-top: 0;">Voluntarios confirmados:</h3>
                  <ul>
                    ${volunteerList.map((name: string) => `<li>${name}</li>`).join("")}
                  </ul>
                </div>
              ` : `
                <div class="alert-box" style="background: #f8d7da; border-color: #f5c6cb;">
                  <p style="margin: 0; color: #721c24;">No hay voluntarios confirmados para mañana.</p>
                </div>
              `}

              <p style="margin-top: 20px;">Considera promover la oportunidad de voluntariado o contactar a voluntarios frecuentes.</p>
            </div>
            <div class="footer">
              <p>Este es un recordatorio automático enviado 12 horas antes del servicio.</p>
              <p>© ${new Date().getFullYear()} Reffetorio Mérida</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    console.log("Unfilled slots alert sent:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        slots_filled: currentCount, 
        slots_available: availableSlots,
        emailResponse 
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error checking unfilled slots:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
