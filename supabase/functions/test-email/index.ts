import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { sendEmail } from "../_shared/email-sender.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface TestEmailRequest {
  to: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to }: TestEmailRequest = await req.json();

    if (!to) {
      throw new Error("Se requiere el campo 'to' con el correo destinatario");
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      throw new Error("Formato de correo inválido");
    }

    console.log(`Sending test email to: ${to}`);

    const testId = `test-${Date.now()}`;
    const now = new Date().toLocaleString("es-MX", {
      timeZone: "America/Mexico_City",
      dateStyle: "full",
      timeStyle: "long",
    });

    const emailResult = await sendEmail({
      to,
      subject: `Correo de prueba - Reffetorio Mérida`,
      emailType: 'test',
      relatedId: testId,
      metadata: {
        test_timestamp: new Date().toISOString(),
        requested_by: to,
      },
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #c45d35 0%, #d4a574 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #faf8f5; padding: 30px; border: 1px solid #e5ddd5; border-top: none; border-radius: 0 0 10px 10px; }
            .success-box { background: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745; text-align: center; }
            .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #c45d35; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
            .check { font-size: 48px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <p class="check">✅</p>
              <h1>Correo de Prueba Exitoso</h1>
              <p>Reffetorio Mérida - Sistema de Correos</p>
            </div>
            <div class="content">
              <div class="success-box">
                <h2 style="margin: 0; color: #155724;">El sistema de correos funciona correctamente</h2>
              </div>
              
              <div class="info-box">
                <h3 style="margin-top: 0; color: #c45d35;">Detalles del envío</h3>
                <p><strong>Destinatario:</strong> ${to}</p>
                <p><strong>Fecha y hora:</strong> ${now}</p>
                <p><strong>ID de prueba:</strong> ${testId}</p>
              </div>

              <p>Este correo confirma que:</p>
              <ul>
                <li>La API key de Resend está configurada correctamente</li>
                <li>El sistema de envío de correos funciona</li>
                <li>Los correos pueden llegar a tu bandeja de entrada</li>
              </ul>

              <p style="color: #666; font-size: 14px; margin-top: 20px;">
                Si estás recibiendo este correo, el sistema está funcionando correctamente. 
                Puedes revisar el registro de correos en la base de datos para ver el historial de envíos.
              </p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Reffetorio Mérida</p>
              <p>Sistema de Gestión de Voluntarios</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (!emailResult.success) {
      console.error("Test email failed:", emailResult.error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: emailResult.error,
          logId: emailResult.logId,
        }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Test email sent successfully:", emailResult.messageId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Correo de prueba enviado a ${to}`,
        messageId: emailResult.messageId,
        logId: emailResult.logId,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("Error sending test email:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
