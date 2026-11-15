import { Router } from 'express';
import { aiService } from '../../../services/aiService.ts';

export function createAiRouter(getBunkerMode: () => boolean) {
  const router = Router();

  router.get('/diagnostics', (_req, res) => {
    const report = aiService.runModuleDiagnostics(getBunkerMode());
    res.json(report);
  });

  router.post('/assist', async (req, res) => {
    try {
      const { question, currentView, userRole, recentErrors } = req.body || {};
      if (!question || String(question).trim().length === 0) {
        return res.status(400).json({ detail: 'Escribe una pregunta o describe el error' });
      }
      const result = await aiService.assist({
        question: String(question),
        currentView: String(currentView || 'dashboard'),
        userRole: String(userRole || 'ADMIN'),
        recentErrors: Array.isArray(recentErrors) ? recentErrors.map(String) : [],
        bunkerMode: getBunkerMode(),
      });
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error consultando el asistente IA';
      res.status(500).json({ detail: message });
    }
  });

  return router;
}
