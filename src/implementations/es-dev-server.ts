import fs from 'fs';
//@ts-ignore TS PR is WIP
import esDevServer from 'es-dev-server';
//@ts-ignore -> deepmerge has no types?
import deepmerge from 'deepmerge';
import { EventEmitter } from 'events';
import path from 'path';
import { Context, Next } from 'koa';
import parse from 'co-body';
import { logger } from '../core/logger.js';
import { Server } from '../core/Server.js';
import { BrowserResult } from '../core/runtime.js';

export function createEsDevServer(devServerConfig?: object): Server {
  const events = new EventEmitter();
  // TODO: EDS types
  let server: any;

  return {
    async start(config) {
      const testRunnerImport = process.env.LOCAL_TESTING
        ? config.testRunnerImport.replace('web-test-runner', '.')
        : config.testRunnerImport;

      const serverConfig = esDevServer.createConfig(
        deepmerge(
          {
            watch: config.watch,
            port: config.port,
            nodeResolve: true,
            middlewares: [
              async function middleware(ctx: Context, next: Next) {
                if (ctx.url.startsWith('/wtr/debug')) {
                  ctx.status = 200;
                  console.log(ctx.url.replace('/wtr/debug/', ''));
                  return;
                }

                if (ctx.url === '/wtr/browser-finished') {
                  ctx.status = 200;
                  const result = (await parse.json(ctx)) as BrowserResult;
                  events.emit('browser-finished', { result });
                  return;
                }

                await next();

                if (ctx.status === 404) {
                  const cleanUrl = ctx.url.split('?')[0].split('#')[0];
                  if (path.extname(cleanUrl) && !cleanUrl.endsWith('favicon.ico')) {
                    logger.error(`Could not find file: .${ctx.url}`);
                  }
                }
              },
            ],
            responseTransformers: [
              function serveTestHTML({ url }: { url: string }) {
                const cleanUrl = url.split('?')[0].split('#')[0];
                if (cleanUrl === '/') {
                  return {
                    body: `<html><head></head><body><script type="module">import "${testRunnerImport}";</script></body></html>`,
                  };
                }
              },
            ],
          },
          devServerConfig
        )
      );

      ({ server } = await esDevServer.startServer(serverConfig));
    },

    async stop() {
      await server.close();
    },
    events,
  };
}
