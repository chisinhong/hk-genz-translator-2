import { collection, addDoc } from 'firebase/firestore';
import {
  ensureFirebaseApp,
  ensureAuthUser,
  getAppId,
} from './firebaseApp';

export async function submitContributionToFirebase(contribution) {
  const { db } = ensureFirebaseApp();
  if (!db) {
    throw new Error('Firestore 尚未初始化，無法提交貢獻。');
  }

  const user = await ensureAuthUser();
  const appId = getAppId();
  const createdAt = new Date();

  try {
    const docRef = await addDoc(
      collection(db, `artifacts/${appId}/public/data/contributions`),
      {
        ...contribution,
        userId: user.uid,
        status: 'pending',
        createdAt,
      }
    );

    return {
      firestoreId: docRef.id,
      userId: user.uid,
      status: 'pending',
      createdAt: createdAt.toISOString(),
      ...contribution,
    };
  } catch (error) {
    console.error('寫入 Firestore 失敗:', error);
    throw new Error('提交至伺服器失敗，請稍後再試。');
  }
}

export { isFirebaseConfigured } from './firebaseApp';
