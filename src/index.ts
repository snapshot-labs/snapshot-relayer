import 'dotenv/config';
import './instrument';
import { fallbackLogger } from '@snapshot-labs/snapshot-sentry';
import bodyParser from 'body-parser';
import cors from 'cors';
import express from 'express';
import api from './api';
import './check';
import initMetrics from './metrics';

const app = express();
const PORT = process.env.PORT || 3000;

initMetrics(app);

app.disable('x-powered-by');
app.use(bodyParser.json({ limit: '4mb' }));
app.use(bodyParser.urlencoded({ limit: '4mb', extended: false }));
app.use(cors({ maxAge: 86400 }));
app.use('/', api);

fallbackLogger(app);

app.listen(PORT, () => console.log(`Listening at http://localhost:${PORT}`));
