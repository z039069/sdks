import { proxies } from './config.ts';

const sessions: { [key: string]: Session } = {};
let proxyIndex = 0;

export function createSession(): Session {
	const id = uuidv4();

	let proxy: Deno.Proxy | undefined;

	const purl = proxies[proxyIndex++ % proxies.length];
	if (purl) {
		const url = new URL(purl.includes('://') ? purl : `http://${purl}`);
		proxy = {
			url: `${url.protocol}//${url.hostname}:${url.port}`,
			basicAuth:
				url.username && url.password
					? {
							username: url.username,
							password: url.password,
					  }
					: undefined,
		};
	}

	const session: Session = {
		id: id,
		proxy: proxy,
	};

	sessions[id] = session;
	return session;
}

export function getSession(id: string | undefined): Session | undefined {
	if (!id) {
		return undefined;
	}

	return sessions[id];
}

export function getSessionFromCookie(cookie: string | null): Session | undefined {
	if (!cookie) {
		return undefined;
	}

	const match = cookie.match(/dsess=([a-zA-Z0-9-]+)/);
	if (!match) {
		return undefined;
	}

	return getSession(match[1]);
}

function uuidv4(): string {
	const uuid = 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0,
			v = c == 'x' ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
	return uuid;
}

export type Session = {
	id: string;
	ip?: string;
	location?: string;
	token?: string;
	username?: string;
	proxy?: Deno.Proxy;
};
