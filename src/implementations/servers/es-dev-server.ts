import { createConfig, startServer } from 'es-dev-server';
import deepmerge from 'deepmerge';
import { Context, Next } from 'koa';
import net from 'net';
import parse from 'co-body';
import { Server } from '../../core/Server';
import { RuntimeConfig, BrowserSessionResult } from '../../core/runtime/types';

export function createEsDevServer(devServerConfig: object = {}): Server {
  let server: net.Server;

  return {
    async start({ config, sessions, onSessionStarted, onSessionFinished }) {
      const testRunnerImport = process.env.LOCAL_TESTING
        ? config.testRunnerImport.replace('web-test-runner', '.')
        : config.testRunnerImport;

      const serverConfig = createConfig(
        deepmerge(
          {
            watch: config.watch,
            port: config.port,
            nodeResolve: true,
            middlewares: [
              async function middleware(ctx: Context, next: Next) {
                if (ctx.path.startsWith('/wtr/')) {
                  const [, , sessionId, command] = ctx.path.split('/');
                  if (!sessionId) return next();
                  if (!command) return next();

                  const session = sessions.get(sessionId);
                  if (!session) {
                    ctx.status = 400;
                    ctx.body = `Session id ${sessionId} not found`;
                    console.error(ctx.body);
                    return;
                  }

                  if (command === 'config') {
                    ctx.body = JSON.stringify({
                      ...session,
                      debug: !!config.debug,
                      watch: !!config.watch,
                      testIsolation: !!config.testIsolation,
                    } as RuntimeConfig);
                    return;
                  }

                  // TODO: Handle race conditions for these requests
                  if (command === 'session-started') {
                    ctx.status = 200;
                    onSessionStarted(sessionId);
                    return;
                  }

                  if (command === 'session-finished') {
                    ctx.status = 200;
                    const result = (await parse.json(ctx)) as BrowserSessionResult;
                    onSessionFinished(sessionId, result);
                    return;
                  }
                }

                await next();

                // TODO: 404 logging
                // if (ctx.status === 404) {
                //   const cleanUrl = ctx.url.split('?')[0].split('#')[0];
                //   if (path.extname(cleanUrl) && !cleanUrl.endsWith('favicon.ico')) {
                //     logger.error(`Could not find file: .${ctx.url}`);
                //   }
                // }
              },
            ],
            plugins: [
              {
                serve(context: Context) {
                  if (context.path === '/') {
                    return {
                      type: 'html',
                      body: `<html>
  <head></head>
  <body>
    <script type="module">
      import "${testRunnerImport}";
    </script>
  </body>
</html>`,
                    };
                  }
                },
              },
            ],
          },
          devServerConfig
        )
      );

      ({ server } = await startServer(serverConfig));
    },

    async stop() {
      await server.close();
    },
  };
}
