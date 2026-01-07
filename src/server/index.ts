import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { router } from './routes';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());

app.use((req, res, next) => {
    console.log(`[${req.method}] ${req.url}`);
    next();
});

// Serve static files from the React app (if built) or just API for now
// In development, we'll run this alongside the webpack dev server.
// In production web mode, we might want to serve static files too.

app.use('/api', router);

// Serve static assets if needed, similar to how Electron does it
app.use('/assets', express.static(path.join(__dirname, '../../assets')));

const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
server.setTimeout(300000); // 5 minutes timeout for long docker builds
