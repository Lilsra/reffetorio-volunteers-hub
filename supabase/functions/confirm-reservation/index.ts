import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail, formatDate } from "../_shared/email-sender.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ConfirmRequest {
  reservation_id: string;
  action: "confirm" | "cancel";
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify admin role
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Create a client with the user's token to verify identity
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

    // Verify admin role in database
    const { data: roleData } = await supabaseAdmin
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

    const { reservation_id, action }: ConfirmRequest = await req.json();

    if (!reservation_id || !action) {
      throw new Error("Faltan campos requeridos");
    }

    const supabase = supabaseAdmin;

    // Get reservation details with volunteer info
    const { data: reservation, error: fetchError } = await supabase
      .from("reservations")
      .select(`
        *,
        volunteers (
          first_name,
          last_name,
          email
        )
      `)
      .eq("id", reservation_id)
      .single();

    if (fetchError || !reservation) {
      throw new Error("Reservación no encontrada");
    }

    const newStatus = action === "confirm" ? "confirmed" : "cancelled";

    // Update reservation status
    const { error: updateError } = await supabase
      .from("reservations")
      .update({
        status: newStatus,
        confirmed_at: action === "confirm" ? new Date().toISOString() : null,
      })
      .eq("id", reservation_id);

    if (updateError) {
      throw new Error("Error al actualizar reservación");
    }

    const formattedDate = formatDate(reservation.reservation_date);
    const volunteerName = `${reservation.volunteers.first_name} ${reservation.volunteers.last_name}`;
    const volunteerEmail = reservation.volunteers.email;
    const isConfirmed = action === "confirm";
    const emailType = isConfirmed ? 'confirmation' : 'cancellation';

    // Send email to volunteer using shared email sender
    const emailResult = await sendEmail({
      to: volunteerEmail,
      subject: isConfirmed 
        ? `Tu reservación ha sido confirmada - ${formattedDate}`
        : `Reservación cancelada - ${formattedDate}`,
      emailType,
      relatedId: reservation_id,
      metadata: {
        volunteer_name: volunteerName,
        reservation_date: reservation.reservation_date,
        action,
      },
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, ${isConfirmed ? '#5a8f5a' : '#c45d35'} 0%, ${isConfirmed ? '#7ab37a' : '#d4a574'} 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #faf8f5; padding: 30px; border: 1px solid #e5ddd5; border-top: none; border-radius: 0 0 10px 10px; }
            .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${isConfirmed ? '#5a8f5a' : '#c45d35'}; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
            .emoji { font-size: 48px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <p class="emoji">${isConfirmed ? '✅' : '❌'}</p>
              <h1>${isConfirmed ? 'Reservación Confirmada' : 'Reservación Cancelada'}</h1>
              <p>Reffetorio Mérida</p>
            </div>
            <div class="content">
              <p>Hola <strong>${volunteerName}</strong>,</p>
              
              ${isConfirmed ? `
                <p>Nos da mucho gusto confirmar tu participación como voluntario.</p>
                
                <div class="info-box">
                  <h3 style="margin-top: 0; color: #5a8f5a;">Detalles de tu Reservación</h3>
                  <p><strong>Fecha:</strong> ${formattedDate}</p>
                  <p><strong>Horario:</strong> 12:00 - 15:00 hrs</p>
                  <p><strong>Ubicación:</strong> Reffetorio Mérida</p>
                </div>

                <h3>Recomendaciones:</h3>
                <ul>
                  <li>Llega 10 minutos antes de tu horario</li>
                  <li>Usa ropa cómoda y zapato cerrado</li>
                  <li>Trae buena actitud y ganas de ayudar</li>
                </ul>

                <p>Si no puedes asistir, por favor avísanos con anticipación.</p>
              ` : `
                <p>Lamentamos informarte que tu reservación para el <strong>${formattedDate}</strong> ha sido cancelada.</p>
                
                <div class="info-box">
                  <p>Si tienes alguna pregunta, no dudes en contactarnos.</p>
                  <p>Te invitamos a reservar otro día disponible.</p>
                </div>
              `}

              <p>Gracias por tu interés en apoyar a nuestra comunidad.</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Reffetorio Mérida</p>
              <p>Cocina Comunitaria</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (!emailResult.success) {
      console.error("Failed to send volunteer notification:", emailResult.error);
      // Don't throw - reservation was updated successfully, just log the email error
    } else {
      console.log("Volunteer notification sent:", emailResult.messageId);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      status: newStatus,
      emailSent: emailResult.success,
      messageId: emailResult.messageId,
      logId: emailResult.logId,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error confirming reservation:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
