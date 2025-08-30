'use strict';
const fastify = require('fastify');
const cors = require('@fastify/cors');
const cookie = require('@fastify/cookie');
const formbody = require('@fastify/formbody');
const websocket = require('@fastify/websocket');
const helmet = require('@fastify/helmet');
const crypto = require('crypto');

const { buildDiscordClient } = require('./lib/discord');
const { sessionPlugin } = require('./lib/sessions');

function createApp() {
  const app = fastify({ logger: true });

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

  // WebSocket not supported on Vercel serverless; guard by env
  if (!process.env.VERCEL) {
    app.register(websocket);
    app.register(async function (fastify) {
      fastify.get('/realtime', { websocket: true }, (connection) => {
        connection.socket.send(JSON.stringify({ type: 'hello', now: Date.now() }));
      });
    });
  }

  app.register(sessionPlugin);

  // Health
  app.get('/health', async () => ({ status: 'ok', uptime: process.uptime() }));

  // Routes
  app.register(require('./routes/auth'), { prefix: '/auth' });
  app.register(require('./routes/api'), { prefix: '/api' });

  // Bootstrap Discord REST client once
  buildDiscordClient({
    clientId: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    botToken: process.env.DISCORD_BOT_TOKEN,
  });

  return app;
}

module.exports = { createApp };
