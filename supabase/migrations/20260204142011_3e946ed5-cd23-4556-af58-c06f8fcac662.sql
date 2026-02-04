-- Create email_logs table for tracking all email sends
CREATE TABLE public.email_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email_to TEXT NOT NULL,
  email_type TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  resend_message_id TEXT,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  related_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sent_at TIMESTAMP WITH TIME ZONE
);

-- Add comment for documentation
COMMENT ON TABLE public.email_logs IS 'Registry of all email sends for auditing and debugging';
COMMENT ON COLUMN public.email_logs.email_type IS 'Type: new_reservation, confirmation, cancellation, unfilled_slots_alert, test';
COMMENT ON COLUMN public.email_logs.status IS 'Status: pending, sent, failed, retrying';

-- Create index for faster lookups
CREATE INDEX idx_email_logs_email_to ON public.email_logs(email_to);
CREATE INDEX idx_email_logs_status ON public.email_logs(status);
CREATE INDEX idx_email_logs_email_type ON public.email_logs(email_type);
CREATE INDEX idx_email_logs_created_at ON public.email_logs(created_at DESC);
CREATE INDEX idx_email_logs_related_id ON public.email_logs(related_id);

-- Enable RLS
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for service role only (edge functions use service role)
CREATE POLICY "Service role can manage email_logs"
ON public.email_logs
FOR ALL
USING (true)
WITH CHECK (true);

-- Create function to check for duplicate emails
CREATE OR REPLACE FUNCTION public.check_duplicate_email(
  p_email_to TEXT,
  p_email_type TEXT,
  p_related_id UUID,
  p_time_window_minutes INTEGER DEFAULT 5
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.email_logs
    WHERE email_to = p_email_to
    AND email_type = p_email_type
    AND related_id = p_related_id
    AND status IN ('sent', 'pending')
    AND created_at > NOW() - (p_time_window_minutes || ' minutes')::INTERVAL
  );
END;
$$;