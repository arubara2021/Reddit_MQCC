import { redis, reddit, context } from '@devvit/web/server';
import { log } from './logger';
import { REDIS_KEYS, TTL } from './constants';
import type { ModPermissions } from '../../shared/api';

interface PermissionCheck {
  permissions: ModPermissions;
  username: string | null;
  subredditName: string;
}

const EMPTY_PERMISSIONS: ModPermissions = {
  canRemove: false,
  canBan: false,
  canApprove: false,
  canLock: false,
  canManageFlair: false,
  canAccessModLog: false,
  isMod: false,
};

export async function checkPermissions(): Promise<PermissionCheck> {
  const subredditName = context.subredditName || 'unknown';

  try {
    const currentUsername = await reddit.getCurrentUsername();

    if (!currentUsername) {
      log('permissions', 'info', 'No current user found');
      return {
        permissions: EMPTY_PERMISSIONS,
        username: null,
        subredditName,
      };
    }

    log('permissions', 'info', 'Current user resolved', {
      currentUsername,
      subredditName,
    });

    const storedMods = await getStoredMods();
    const setupDone = await isSetupComplete();

    if (storedMods.length > 0) {
      const isMod = storedMods.some(
        (mod) => mod.toLowerCase() === currentUsername.toLowerCase()
      );

      log('permissions', 'info', 'Checked stored mods', {
        currentUsername,
        isMod,
        storedModCount: storedMods.length,
      });

      if (isMod) {
        return {
          permissions: {
            isMod: true,
            canApprove: true,
            canRemove: true,
            canBan: true,
            canLock: true,
            canManageFlair: true,
            canAccessModLog: true,
          },
          username: currentUsername,
          subredditName,
        };
      }

      return {
        permissions: { ...EMPTY_PERMISSIONS, isMod: false },
        username: currentUsername,
        subredditName,
      };
    }

    if (!setupDone) {
      log('permissions', 'info', 'No stored mods and setup not complete, bootstrapping first user', {
        currentUsername,
        subredditName,
      });

      await addStoredMod(currentUsername);
      await markSetupComplete();

      log('permissions', 'info', 'First mod stored via bootstrap', {
        currentUsername,
      });

      return {
        permissions: {
          isMod: true,
          canApprove: true,
          canRemove: true,
          canBan: true,
          canLock: true,
          canManageFlair: true,
          canAccessModLog: true,
        },
        username: currentUsername,
        subredditName,
      };
    }

    log('permissions', 'info', 'Setup complete but user not in stored mods', {
      currentUsername,
    });

    return {
      permissions: { ...EMPTY_PERMISSIONS, isMod: false },
      username: currentUsername,
      subredditName,
    };
  } catch (e) {
    log('permissions', 'error', 'Permission check failed', {
      error: e instanceof Error ? e.message : String(e),
      subredditName,
    });
    return {
      permissions: EMPTY_PERMISSIONS,
      username: null,
      subredditName,
    };
  }
}

export async function addStoredMod(username: string): Promise<void> {
  const key = REDIS_KEYS.STORED_MODS + context.subredditId;

  try {
    const existing = await getStoredMods();

    const alreadyStored = existing.some(
      (mod) => mod.toLowerCase() === username.toLowerCase()
    );

    if (alreadyStored) {
      log('permissions', 'info', 'Mod already stored', { username });
      return;
    }

    existing.push(username);

    await redis.set(key, JSON.stringify(existing), {
      expiration: new Date(Date.now() + TTL.STORED_MODS_MS),
    });

    log('permissions', 'info', 'Mod stored successfully', {
      username,
      totalMods: existing.length,
    });
  } catch (e) {
    log('permissions', 'error', 'Failed to store mod', {
      username,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

export async function removeStoredMod(username: string): Promise<void> {
  const key = REDIS_KEYS.STORED_MODS + context.subredditId;

  try {
    const existing = await getStoredMods();
    const filtered = existing.filter(
      (mod) => mod.toLowerCase() !== username.toLowerCase()
    );

    await redis.set(key, JSON.stringify(filtered), {
      expiration: new Date(Date.now() + TTL.STORED_MODS_MS),
    });

    log('permissions', 'info', 'Mod removed', { username });
  } catch (e) {
    log('permissions', 'error', 'Failed to remove mod', {
      username,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

export async function getStoredMods(): Promise<string[]> {
  const key = REDIS_KEYS.STORED_MODS + context.subredditId;

  try {
    const raw = await redis.get(key);

    if (!raw) return [];

    const parsed = JSON.parse(raw as string);

    if (Array.isArray(parsed)) {
      return parsed.filter((m) => typeof m === 'string');
    }

    return [];
  } catch (e) {
    log('permissions', 'warn', 'Failed to read stored mods', {
      error: e instanceof Error ? e.message : String(e),
    });
    return [];
  }
}

async function isSetupComplete(): Promise<boolean> {
  const key = REDIS_KEYS.SETUP_COMPLETE + context.subredditId;

  try {
    const raw = await redis.get(key);
    return raw === 'true';
  } catch {
    return false;
  }
}

async function markSetupComplete(): Promise<void> {
  const key = REDIS_KEYS.SETUP_COMPLETE + context.subredditId;

  try {
    await redis.set(key, 'true', {
      expiration: new Date(Date.now() + TTL.STORED_MODS_MS),
    });
  } catch (e) {
    log('permissions', 'warn', 'Failed to mark setup complete', {
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

export async function requireMod(): Promise<{
  allowed: boolean;
  username: string | null;
  error?: string;
}> {
  const { permissions, username } = await checkPermissions();

  if (!permissions.isMod) {
    return {
      allowed: false,
      username,
      error: 'Moderator access required',
    };
  }

  return { allowed: true, username };
}
