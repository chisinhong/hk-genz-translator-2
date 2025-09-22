import { httpsCallable } from 'firebase/functions';
import {
  ensureFirebaseApp,
  ensureAuthUser,
  getAppId,
  getFirebaseFunctions,
} from './firebaseApp';

let validateQuotaCallable;

export async function validateUsageQuota(options = {}) {
  ensureFirebaseApp();
  await ensureAuthUser();

  const functionsInstance = getFirebaseFunctions();

  if (!validateQuotaCallable) {
    validateQuotaCallable = httpsCallable(functionsInstance, 'validateQuota');
  }

  const payload = {
    limitType: 'daily',
    requested: 1,
    consume: true,
    appId: getAppId(),
    ...options,
  };

  const response = await validateQuotaCallable(payload);

  return response.data;
}
