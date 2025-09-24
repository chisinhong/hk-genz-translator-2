import { httpsCallable } from 'firebase/functions';
import {
  ensureFirebaseApp,
  ensureAuthUser,
  getAppId,
  getFirebaseFunctions,
} from './firebaseApp';

let completeTaskCallable;

export async function completeUserTask(taskId, payload = {}) {
  if (typeof taskId !== 'string' || !taskId.trim()) {
    throw new Error('TASK_ID_REQUIRED');
  }

  ensureFirebaseApp();
  await ensureAuthUser();

  if (!completeTaskCallable) {
    completeTaskCallable = httpsCallable(
      getFirebaseFunctions(),
      'completeTask'
    );
  }

  const request = {
    appId: getAppId(),
    taskId,
    ...payload,
  };

  const response = await completeTaskCallable(request);
  return response.data;
}

export const TASK_IDS = {
  instagram: 'instagram',
  threads: 'threads',
  submission: 'submission',
  invite: 'invite',
  share: 'share',
};

export const SHARE_REWARD_PER_USE = 2;
export const SHARE_DAILY_CAP = 10;
