import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail } from "../_shared/email-sender.ts";

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

    // Verify admin role
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const userId = claimsData.claims.sub;
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Se requieren permisos de administrador" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

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

    const volunteerList: string[] = [];
    if (volunteers) {
      for (const v of volunteers) {
        if (v.volunteers && typeof v.volunteers === 'object' && !Array.isArray(v.volunteers)) {
          const vol = v.volunteers as { first_name: string; last_name: string };
          volunteerList.push(`${vol.first_name} ${vol.last_name}`);
        }
      }
    }

    // Generate a unique ID for this alert (date-based to prevent duplicates same day)
    const alertId = `alert-${tomorrowStr}`;

    // Send alert to admin using shared email sender
    const emailResult = await sendEmail({
      to: adminEmail,
      subject: `Alerta: ${availableSlots} cupos sin llenar para mañana`,
      emailType: 'unfilled_slots_alert',
      relatedId: alertId,
      metadata: {
        target_date: tomorrowStr,
        current_count: currentCount,
        available_slots: availableSlots,
        confirmed_volunteers: volunteerList,
      },
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
              <h1>Alerta de Cupos</h1>
              <p>Reffetorio Mérida - Portal de Voluntarios</p>
            </div>
            <div class="content">
              <div class="alert-box">
                <h2 style="margin: 0; color: #856404;">Faltan voluntarios para mañana</h2>
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

    if (!emailResult.success) {
      console.error("Failed to send unfilled slots alert:", emailResult.error);
      throw new Error(`Error al enviar alerta: ${emailResult.error}`);
    }

    console.log("Unfilled slots alert sent:", emailResult.messageId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        slots_filled: currentCount, 
        slots_available: availableSlots,
        messageId: emailResult.messageId,
        logId: emailResult.logId,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error checking unfilled slots:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
