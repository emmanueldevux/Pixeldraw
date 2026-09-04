// ============================================================
// UXLLY — Telegram Delivery
// ============================================================

export async function sendTelegramContent(params: {
  chatId: string;
  caption: string;
  imageUrl?: string;
  platform: string;
}): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) throw new Error("TELEGRAM_BOT_TOKEN is not set");

  const baseUrl = `https://api.telegram.org/bot${botToken}`;

  if (params.imageUrl) {
    // Send photo with caption
    await fetch(`${baseUrl}/sendPhoto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: params.chatId,
        photo: params.imageUrl,
        caption: `🎨 ${params.platform}\n\n${params.caption}`,
        parse_mode: "Markdown",
      }),
    });
  } else {
    // Send text only
    await fetch(`${baseUrl}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: params.chatId,
        text: `🎨 *${params.platform}*\n\n${params.caption}`,
        parse_mode: "Markdown",
      }),
    });
  }
}
