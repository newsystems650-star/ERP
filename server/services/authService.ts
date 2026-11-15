import crypto from 'crypto';
import { cppBridge } from '../core/cpp_bridge.ts';
import { loadPersistedDatabase, savePersistedSection } from './persistence.ts';

export type UserRole = 'ADMIN' | 'MANAGER' | 'OPERATOR' | 'VIEWER';

export interface AuthUserRecord {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
}

function getTokenSecret(): string {
  return process.env.AUDIT_SECRET || 'niccore_session_secret_2026_key!';
}

function hashPassword(password: string, salt?: string): string {
  const usedSalt = salt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, usedSalt, 64).toString('hex');
  return `${usedSalt}:${derived}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, originalHex] = storedHash.split(':');
  if (!salt || !originalHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const original = Buffer.from(originalHex, 'hex');
  if (derived.length !== original.length) return false;
  return crypto.timingSafeEqual(derived, original);
}

function signToken(user: PublicUser): string {
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    exp: Date.now() + 1000 * 60 * 60 * 12,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', getTokenSecret()).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifyToken(token: string): { sub: string; email: string; role: UserRole; name: string } | null {
  try {
    const [encoded, sig] = token.split('.');
    if (!encoded || !sig) return null;
    const expectedSig = crypto
      .createHmac('sha256', getTokenSecret())
      .update(encoded)
      .digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function toPublicUser(u: AuthUserRecord): PublicUser {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    active: u.active,
    createdAt: u.createdAt,
  };
}

const initialUsers: AuthUserRecord[] = [
  {
    id: 'u_admin',
    name: 'Alonso Méndez',
    email: 'admin@niccore.mx',
    passwordHash: hashPassword('NicCore2026!'),
    role: 'ADMIN',
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'u_manager',
    name: 'Laura Sánchez',
    email: 'gerencia@niccore.mx',
    passwordHash: hashPassword('NicCore2026!'),
    role: 'MANAGER',
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'u_operator',
    name: 'Sofía Ramírez',
    email: 'caja@niccore.mx',
    passwordHash: hashPassword('NicCore2026!'),
    role: 'OPERATOR',
    active: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'u_viewer',
    name: 'Roberto Méndez',
    email: 'chofer@niccore.mx',
    passwordHash: hashPassword('NicCore2026!'),
    role: 'VIEWER',
    active: true,
    createdAt: new Date().toISOString(),
  },
];

class AuthService {
  private users: AuthUserRecord[];

  constructor() {
    const persisted = loadPersistedDatabase();
    if (Array.isArray(persisted.users) && persisted.users.length > 0) {
      this.users = persisted.users as AuthUserRecord[];
    } else {
      this.users = [...initialUsers];
      savePersistedSection('users', this.users);
    }
  }

  private persistUsers() {
    savePersistedSection('users', this.users);
  }

  async login(
    email: string,
    password: string,
    onAuthFailure?: (identifier: string) => void
  ): Promise<{ token: string; user: PublicUser }> {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const user = this.users.find((u) => u.email.toLowerCase() === normalizedEmail);

    if (!user || !user.active || !verifyPassword(password, user.passwordHash)) {
      if (onAuthFailure) {
        onAuthFailure(normalizedEmail || 'unknown_user');
      }
      await cppBridge.auditLog({
        action: 'FAILED_LOGIN',
        email: normalizedEmail,
      });
      throw new Error('Correo o contraseña incorrectos');
    }

    const publicUser = toPublicUser(user);
    const token = signToken(publicUser);
    await cppBridge.auditLog({
      action: 'USER_LOGIN',
      userId: user.id,
      email: user.email,
      role: user.role,
    });
    return { token, user: publicUser };
  }

  async register(input: {
    name: string;
    email: string;
    password: string;
    role?: UserRole;
  }): Promise<{ token: string; user: PublicUser }> {
    const name = String(input.name || '').trim();
    const email = String(input.email || '').trim().toLowerCase();
    const password = String(input.password || '');
    const role: UserRole =
      input.role && ['ADMIN', 'MANAGER', 'OPERATOR', 'VIEWER'].includes(input.role)
        ? input.role
        : 'OPERATOR';

    if (!name || !email.includes('@') || password.length < 6) {
      throw new Error('Ingresa nombre válido, correo y contraseña de al menos 6 caracteres');
    }

    if (this.users.some((u) => u.email.toLowerCase() === email)) {
      throw new Error('Ya existe una cuenta registrada con ese correo');
    }

    const newUser: AuthUserRecord = {
      id: `u_${Date.now().toString(36)}`,
      name,
      email,
      passwordHash: hashPassword(password),
      role,
      active: true,
      createdAt: new Date().toISOString(),
    };
    this.users.push(newUser);
    this.persistUsers();

    const publicUser = toPublicUser(newUser);
    const token = signToken(publicUser);
    await cppBridge.auditLog({
      action: 'USER_REGISTERED',
      userId: newUser.id,
      email: newUser.email,
      role: newUser.role,
    });
    return { token, user: publicUser };
  }

  async loginWithFirebaseIdentity(input: {
    uid: string;
    email: string;
    name?: string;
  }): Promise<{ token: string; user: PublicUser }> {
    const email = String(input.email || '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      throw new Error('Cuenta de Google sin correo válido');
    }

    let user = this.users.find((u) => u.email.toLowerCase() === email);
    if (!user) {
      const assignedRole: UserRole =
        email === 'newsystems650@gmail.com' ? 'ADMIN' : 'ADMIN';
      user = {
        id: input.uid || `u_${Date.now().toString(36)}`,
        name: String(input.name || email.split('@')[0]),
        email,
        passwordHash: hashPassword(crypto.randomBytes(16).toString('hex')),
        role: assignedRole,
        active: true,
        createdAt: new Date().toISOString(),
      };
      this.users.push(user);
      this.persistUsers();
    }

    const publicUser = toPublicUser(user);
    const token = signToken(publicUser);
    await cppBridge.auditLog({
      action: 'FIREBASE_GOOGLE_LOGIN',
      userId: user.id,
      email: user.email,
      role: user.role,
    });
    return { token, user: publicUser };
  }

  getUserFromToken(token: string): PublicUser | null {
    const decoded = verifyToken(token);
    if (!decoded) return null;
    const found = this.users.find((u) => u.id === decoded.sub && u.active);
    return found ? toPublicUser(found) : null;
  }

  listPublicUsers(): PublicUser[] {
    return this.users.map(toPublicUser);
  }
}

export const authService = new AuthService();
