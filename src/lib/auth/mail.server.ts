import nodemailer from "nodemailer";

export function mailConfigured() {
  return Boolean(process.env.SMTP_USER?.trim() && process.env.SMTP_PASS?.trim());
}

export async function sendConfirmation(to: string, name: string, url: string) {
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  if (!user || !pass) {
    throw new Error("SMTP не настроен");
  }
  const port = Number(process.env.SMTP_PORT || 465);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST?.trim() || "smtp.yandex.ru",
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  const who = name?.trim() ? `, ${name.trim()}` : "";
  await transporter.sendMail({
    from: process.env.SMTP_FROM?.trim() || user,
    to,
    subject: "Подтверди почту — ToDO-AKA",
    text: `Здравствуй${who}. Открой ссылку, чтобы подтвердить почту: ${url}`,
    html: `<p>Здравствуй${who}.</p><p>Нажми ссылку, чтобы подтвердить почту в ToDO-AKA:</p><p><a href="${url}">Подтвердить почту</a></p><p>Если это был не ты, письмо можно удалить.</p>`,
  });
}
