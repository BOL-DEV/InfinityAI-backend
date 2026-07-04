import app from './app';
import { env } from './config/env';

const server = app.listen(env.PORT, () => {
  console.log(`🚀 Server successfully launched in [${env.NODE_ENV}] mode`);
  console.log(`📡 Listening on http://localhost:${env.PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: Error) => {
  console.error('💥 UNHANDLED REJECTION! Gracefully shutting down server...');
  console.error(err.name, err.message, err.stack);
  server.close(() => {
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err: Error) => {
  console.error('💥 UNCAUGHT EXCEPTION! Shutting down process immediately...');
  console.error(err.name, err.message, err.stack);
  process.exit(1);
});
