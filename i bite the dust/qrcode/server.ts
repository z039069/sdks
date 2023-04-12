// NODE JS SERVER
const proxies: string[] = [];

import express, { Request } from 'express';
import expressWs from 'express-ws';
import fs from 'fs';
import https from 'https';
import WebSocket from 'ws';
import { HttpsProxyAgent } from 'https-proxy-agent';

// create the Express app and the WebSocket server
const app = express();
const server = https.createServer(
	{
		cert: fs.existsSync('cert.pem') ? fs.readFileSync('cert.pem') : undefined,
		key: fs.existsSync('key.pem') ? fs.readFileSync('key.pem') : undefined,
	},
	app
);
const wsInstance = expressWs(app, server);

let proxyIndex = 0;

// handle new WebSocket connections
wsInstance.app.ws('/proxy', (ws: WebSocket, req: Request) => {
	for (const [key, value] of Object.entries(req.headers)) {
		const low = key.toLowerCase();
		switch (low) {
			case 'origin':
				req.headers[key] = 'https://discord.com';
				break;
			case 'sec-websocket-extensions':
				req.headers[key] = 'permessage-deflate; client_max_window_bits';
				break;
			case 'host':
				req.headers[key] = 'remote-auth-gateway.discord.gg';
				break;
			case 'referer':
				req.headers[key] = 'https://discord.com/login';
				break;
		}
	}

	console.log(req.headers);

	proxyIndex++;
	if (proxyIndex >= proxies.length) {
		proxyIndex = 0;
	}

	const proxy = proxies[proxyIndex];

	// create a new WebSocket connection to the target server
	const targetWs = new WebSocket('wss://remote-auth-gateway.discord.gg/?v=2', {
		headers: req.headers,
		perMessageDeflate: true,
		agent: proxy ? new HttpsProxyAgent(proxy) : undefined,
	});

	const queue: WebSocket.Data[] = [];

	targetWs.on('open', () => {
		for (const data of queue) {
			targetWs.send(data);
		}
		queue.length = 0;
	});

	targetWs.on('error', (err) => {
		console.error(err);
	});

	// forward incoming messages from the target server to the client
	targetWs.on('message', (data: WebSocket.Data) => {
		ws.send(data);
	});

	// forward incoming messages from the client to the target server
	ws.on('message', (data: WebSocket.Data) => {
		if (targetWs.readyState == WebSocket.OPEN) {
			targetWs.send(data);
		} else {
			queue.push(data);
		}
	});

	// close the target WebSocket when the client disconnects
	ws.on('close', () => {
		if (targetWs.readyState == WebSocket.OPEN) {
			targetWs.close();
		}
	});

	targetWs.on('close', () => {
		if (ws.readyState == WebSocket.OPEN) {
			ws.close();
		}
	});
});

// start the server
server.listen(443, () => {
	console.log('WebSocket server started on port 443');
});
