import cors from 'cors';
import express from 'express';
import apiRoutes from './routes/index.js';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';

const app = express();
const corsOptions =
  env.corsOrigin === '*'
    ? {}
    : {
        origin: env.corsOrigin.split(',').map((origin) => origin.trim()),
      };

app.use(cors(corsOptions));
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.status(200).json({
    message: 'Backend is running',
  });
});

app.use('/api', apiRoutes);
app.use(notFound);
app.use(errorHandler);

export default app;
