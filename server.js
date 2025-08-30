'use strict';
const fastify = require('fastify');
const cors = require('@fastify/cors');
const cookie = require('@fastify/cookie');
const formbody = require('@fastify/formbody');
const websocket = require('@fastify/websocket');
const helmet = require('@fastify/helmet');
const crypto = require('crypto');
require('dotenv').config();

const { buildDiscordClient } = require('./lib/discord');
const { sessionPlugin } = require('./lib/sessions');

const app = fastify({ logger: true });

// Security headers
app.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", 'https:', "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: null,
    },
  },
});

app.register(cors, {
  origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  credentials: true,
});
app.register(cookie, { secret: process.env.COOKIE_SECRET || crypto.randomBytes(16).toString('hex') });
app.register(formbody);
app.register(websocket);
app.register(sessionPlugin);

// Health
app.get('/health', async () => ({ status: 'ok', uptime: process.uptime() }));

// Websocket for realtime status
app.register(async function (fastify) {
  fastify.get('/realtime', { websocket: true }, (connection /* SocketStream */, req) => {
    connection.socket.send(JSON.stringify({ type: 'hello', now: Date.now() }));
  });
});

// OAuth + API routes
app.register(require('./routes/auth'), { prefix: '/auth' });
app.register(require('./routes/api'), { prefix: '/api' });

// Bootstrap Discord app-side client (REST) once
buildDiscordClient({
  clientId: process.env.DISCORD_CLIENT_ID,
  clientSecret: process.env.DISCORD_CLIENT_SECRET,
  botToken: process.env.DISCORD_BOT_TOKEN,
});

const port = Number(process.env.PORT || 8082);
const host = process.env.HOST || '0.0.0.0';

app.listen({ port, host }).then(() => {
  app.log.info(`Backend listening on http://${host}:${port}`);
}).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
