import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import routes from './routes';
import { errorHandler } from './middlewares/errorHandler';
import { AppError } from './utils/errors';

const app = express();

// 1. Security Middlewares
app.use(helmet());
app.use(cors());

// 2. Request Parsing Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 3. Logger Middleware
app.use(morgan('dev'));

// 4. API Routes
app.use('/api', routes);

// 4.5 Welcome Route
app.get('/', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to the InfinityAI Backend API! 🧠',
    version: '1.0.0',
    status: 'online'
  });
});

// 5. Catch-all for undefined routes
app.use('*', (req, _res, next) => {
  next(new AppError(`Route ${req.originalUrl} not found`, 404));
});

// 6. Centralized Error Handling Middleware
app.use(errorHandler);

export default app;
