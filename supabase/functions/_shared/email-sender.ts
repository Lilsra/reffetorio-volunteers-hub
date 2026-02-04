import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const SENDER_EMAIL = "Reffetorio Mérida <noreply@resend.dev>";

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  logId?: string;
}

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  emailType: string;
  /** Must be a valid UUID or undefined - non-UUID strings will be ignored */
  relatedId?: string;
  metadata?: Record<string, unknown>;
}

function getSupabaseClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

function getResendClient() {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    throw new Error("RESEND_API_KEY no está configurado");
  }
  return new Resend(apiKey);
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUUID(str: string | undefined): boolean {
  if (!str) return false;
  return UUID_REGEX.test(str);
}

async function logEmailAttempt(
  supabase: ReturnType<typeof getSupabaseClient>,
  payload: EmailPayload,
  status: 'pending' | 'sent' | 'failed' | 'retrying',
  resendMessageId?: string,
  errorMessage?: string,
  retryCount: number = 0
): Promise<string | null> {
  try {
    // Only include related_id if it's a valid UUID
    const validRelatedId = isValidUUID(payload.relatedId) ? payload.relatedId : null;
    
    const { data, error } = await supabase
      .from('email_logs')
      .insert({
        email_to: payload.to,
        email_type: payload.emailType,
        subject: payload.subject,
        status,
        resend_message_id: resendMessageId || null,
        error_message: errorMessage || null,
        retry_count: retryCount,
        related_id: validRelatedId,
        metadata: payload.metadata || {},
        sent_at: status === 'sent' ? new Date().toISOString() : null,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error logging email attempt:', error);
      return null;
    }

    return data?.id || null;
  } catch (err) {
    console.error('Exception logging email attempt:', err);
    return null;
  }
}

async function updateEmailLog(
  supabase: ReturnType<typeof getSupabaseClient>,
  logId: string,
  updates: {
    status: 'sent' | 'failed' | 'retrying';
    resend_message_id?: string;
    error_message?: string;
    retry_count?: number;
    sent_at?: string;
  }
): Promise<void> {
  try {
    await supabase
      .from('email_logs')
      .update(updates)
      .eq('id', logId);
  } catch (err) {
    console.error('Error updating email log:', err);
  }
}

async function checkDuplicateEmail(
  supabase: ReturnType<typeof getSupabaseClient>,
  to: string,
  emailType: string,
  relatedId?: string
): Promise<boolean> {
  // Only check for duplicates if we have a valid UUID
  if (!relatedId || !isValidUUID(relatedId)) return false;

  try {
    const { data, error } = await supabase
      .rpc('check_duplicate_email', {
        p_email_to: to,
        p_email_type: emailType,
        p_related_id: relatedId,
        p_time_window_minutes: 5
      });

    if (error) {
      console.error('Error checking duplicate:', error);
      return false;
    }

    return data === true;
  } catch (err) {
    console.error('Exception checking duplicate:', err);
    return false;
  }
}

export async function sendEmail(payload: EmailPayload): Promise<EmailSendResult> {
  const supabase = getSupabaseClient();
  const resend = getResendClient();

  // Check for duplicates
  const isDuplicate = await checkDuplicateEmail(
    supabase,
    payload.to,
    payload.emailType,
    payload.relatedId
  );

  if (isDuplicate) {
    console.log(`Duplicate email detected for ${payload.to}, type: ${payload.emailType}, related: ${payload.relatedId}`);
    return {
      success: true,
      error: 'Email already sent recently (duplicate prevention)',
    };
  }

  // Create initial log entry
  const logId = await logEmailAttempt(supabase, payload, 'pending');

  let lastError: Error | null = null;
  let retryCount = 0;

  while (retryCount < MAX_RETRIES) {
    try {
      console.log(`Sending email attempt ${retryCount + 1}/${MAX_RETRIES} to ${payload.to}`);

      const response = await resend.emails.send({
        from: SENDER_EMAIL,
        to: [payload.to],
        subject: payload.subject,
        html: payload.html,
      });

      // Validate response
      if (response?.data?.id) {
        console.log(`Email sent successfully. Resend ID: ${response.data.id}`);

        if (logId) {
          await updateEmailLog(supabase, logId, {
            status: 'sent',
            resend_message_id: response.data.id,
            retry_count: retryCount,
            sent_at: new Date().toISOString(),
          });
        }

        return {
          success: true,
          messageId: response.data.id,
          logId: logId || undefined,
        };
      }

      // No ID in response - treat as error
      if (response?.error) {
        throw new Error(response.error.message || 'Error desconocido de Resend');
      }

      throw new Error('Resend no devolvió un ID de mensaje válido');

    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.error(`Email send attempt ${retryCount + 1} failed:`, lastError.message);

      retryCount++;

      if (retryCount < MAX_RETRIES) {
        // Update log as retrying
        if (logId) {
          await updateEmailLog(supabase, logId, {
            status: 'retrying',
            error_message: lastError.message,
            retry_count: retryCount,
          });
        }

        // Exponential backoff
        const delay = RETRY_DELAY_MS * Math.pow(2, retryCount - 1);
        console.log(`Retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }

  // All retries exhausted
  console.error(`All ${MAX_RETRIES} email attempts failed for ${payload.to}`);

  if (logId) {
    await updateEmailLog(supabase, logId, {
      status: 'failed',
      error_message: lastError?.message || 'Error desconocido',
      retry_count: retryCount,
    });
  }

  return {
    success: false,
    error: lastError?.message || 'Error desconocido al enviar correo',
    logId: logId || undefined,
  };
}

export function formatDate(dateStr: string): string {
  const dateObj = new Date(dateStr + "T12:00:00");
  return dateObj.toLocaleDateString("es-MX", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
