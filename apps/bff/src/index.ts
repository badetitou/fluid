import 'dotenv/config';
import { onShutdownSignals, startServer } from './server';

startServer({
  port: Number(process.env.PORT ?? 4001),
  host: '0.0.0.0',
  staticDir: process.env.FLUID_STATIC_DIR,
}).then(
  (server) => onShutdownSignals(server.close),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
