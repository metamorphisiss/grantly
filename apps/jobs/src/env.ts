const req = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing env ${k}. Add it as a GitHub Actions secret (or in apps/jobs/.env locally).`);
  return v;
};

export const env = {
  supabaseUrl: req("SUPABASE_URL"),
  supabaseKey: req("SUPABASE_SECRET_KEY"),
  resendKey: process.env.RESEND_API_KEY ?? "",
  reminderFrom: process.env.REMINDER_FROM || "Grantly <onboarding@resend.dev>",
  appUrl: process.env.APP_URL || "http://localhost:3000",
  ocrLangs: process.env.OCR_LANGS || "eng+hin+mar",
  budgetMs: Number(process.env.TIME_BUDGET_MIN || 12) * 60000,
};
