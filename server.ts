import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { getOrCreateUser } from './src/db/users.ts';
import { getLedgerState, saveLedgerState, addAuditLog, getRecentAuditLogs } from './src/db/ledger.ts';
import { optionalAuth, requireAuth, AuthRequest } from './src/middleware/auth.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  app.use(express.json({ limit: '10mb' }));

  // API Routes
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // User Profile Sync (Firebase Auth to PostgreSQL)
  app.post('/api/auth/sync', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user?.uid;
      const email = req.user?.email || '';
      const name = req.body?.name || req.user?.name;

      if (!uid || !email) {
        return res.status(400).json({ error: 'Missing UID or email in token' });
      }

      const user = await getOrCreateUser(uid, email, name);
      res.json({ success: true, user });
    } catch (error: any) {
      console.error('Error syncing user:', error);
      res.status(500).json({ error: error.message || 'Failed to sync user' });
    }
  });

  // Fetch shared ledger state from Cloud SQL
  app.get('/api/ledger', optionalAuth, async (_req, res) => {
    try {
      const ledger = await getLedgerState('shared_ledger');
      if (!ledger) {
        return res.json({ found: false, state: null });
      }
      res.json({ found: true, state: ledger.stateData, updatedAt: ledger.updatedAt, updatedBy: ledger.updatedBy });
    } catch (error: any) {
      console.error('Failed to get ledger state:', error);
      res.status(500).json({ error: 'Failed to retrieve ledger data from Cloud SQL' });
    }
  });

  // Save shared ledger state to Cloud SQL
  app.post('/api/ledger/save', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const { state, updatedBy } = req.body;
      if (!state || typeof state !== 'object') {
        return res.status(400).json({ error: 'Invalid state payload' });
      }

      const inv = state.inv || 'Main Store';
      const startDate = state.start || '';
      const cutDate = state.cut || '';
      const author = updatedBy || (req.user?.email || 'Store Terminal');

      const saved = await saveLedgerState('shared_ledger', inv, startDate, cutDate, state, author);
      res.json({ success: true, id: saved.id, updatedAt: saved.updatedAt });
    } catch (error: any) {
      console.error('Failed to save ledger state:', error);
      res.status(500).json({ error: 'Failed to persist ledger state in Cloud SQL' });
    }
  });

  // Audit Logs
  app.get('/api/logs', optionalAuth, async (_req, res) => {
    try {
      const logs = await getRecentAuditLogs(50);
      res.json({ success: true, logs });
    } catch (error: any) {
      console.error('Failed to get audit logs:', error);
      res.status(500).json({ error: 'Failed to retrieve audit logs' });
    }
  });

  app.post('/api/logs', optionalAuth, async (req: AuthRequest, res) => {
    try {
      const { timestamp, username, tab, action, description, date, location } = req.body;
      const user = username || req.user?.email || 'Staff';
      const logged = await addAuditLog(
        timestamp || new Date().toISOString(),
        user,
        tab || 'system',
        action || 'Update',
        description || '',
        date,
        location
      );
      res.json({ success: true, log: logged });
    } catch (error: any) {
      console.error('Failed to add audit log:', error);
      res.status(500).json({ error: 'Failed to record audit log' });
    }
  });

  // Vite middleware in dev or static files in production
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: PORT },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
