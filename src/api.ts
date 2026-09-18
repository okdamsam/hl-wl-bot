import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { getTeam, getTeamMembers } from './db/queries.js';
import { logger } from './lib/logger.js';

const allowedOrigins = new Set(
  (process.env['CORS_ORIGINS'] ?? 'https://docs.hardlight.space')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0),
);

function applyCors(request: IncomingMessage, response: ServerResponse): void {
  const origin = request.headers.origin;
  response.setHeader('Vary', 'Origin');
  if (!origin || !allowedOrigins.has(origin)) return;

  response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=30',
  });
  response.end(JSON.stringify(body));
}

function handleRequest(request: IncomingMessage, response: ServerResponse): void {
  applyCors(request, response);

  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.method !== 'GET') {
    sendJson(response, 405, { error: 'Method not allowed' });
    return;
  }

  const url = new URL(request.url ?? '/', 'http://localhost');
  if (url.pathname === '/health') {
    sendJson(response, 200, { status: 'ok' });
    return;
  }

  const match = /^\/api\/teams\/([^/]+)$/.exec(url.pathname);
  if (!match) {
    sendJson(response, 404, { error: 'Not found' });
    return;
  }

  const team = getTeam(decodeURIComponent(match[1]));
  if (!team || !team.active) {
    sendJson(response, 404, { error: 'Team not found' });
    return;
  }

  const roster = { leaders: [], seniors: [], members: [] } as Record<string, object[]>;
  for (const member of getTeamMembers(team.id)) {
    roster[`${member.team_role}s`].push({
      discordMember: member.discord_user_id,
      displayName: member.display_name,
      speciality: member.speciality,
    });
  }

  sendJson(response, 200, {
    team: team.slug,
    displayName: team.display_name,
    ...roster,
  });
}

export function startApiServer(): Server | null {
  const port = Number(process.env['PORT'] ?? 0);
  if (!port) {
    logger.warn('PORT is not set; public API server is disabled');
    return null;
  }

  const server = createServer(handleRequest);
  server.listen(port, '0.0.0.0', () => logger.info(`Public API listening on port ${port}`));
  return server;
}