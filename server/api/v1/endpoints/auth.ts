import { Router } from 'express';
import { authService } from '../../../services/authService.ts';
import { cppBridge } from '../../../core/cpp_bridge.ts';

export function createAuthRouter(onAuthFailure?: (identifier: string) => void) {
  const router = Router();

  router.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body || {};
      const session = await authService.login(email, password, onAuthFailure);
      res.json(session);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Credenciales inválidas';
      res.status(401).json({ detail: message });
    }
  });

  router.post('/register', async (req, res) => {
    try {
      const session = await authService.register(req.body || {});
      res.status(201).json(session);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al registrar usuario';
      res.status(400).json({ detail: message });
    }
  });

  router.post('/firebase-session', async (req, res) => {
    try {
      const { uid, email, name } = req.body || {};
      const session = await authService.loginWithFirebaseIdentity({ uid, email, name });
      res.json(session);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error vinculando sesión Firebase';
      res.status(400).json({ detail: message });
    }
  });

  router.get('/me', (req, res) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    const user = token ? authService.getUserFromToken(token) : null;
    if (!user) {
      return res.status(401).json({ detail: 'Sesión no válida o expirada' });
    }
    res.json({ user });
  });

  router.post('/logout', async (req, res) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    const user = token ? authService.getUserFromToken(token) : null;
    if (user) {
      await cppBridge.auditLog({ action: 'USER_LOGOUT', email: user.email });
    }
    res.json({ status: 'logged_out' });
  });

  return router;
}
