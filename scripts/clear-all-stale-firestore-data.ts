import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, deleteDoc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const databaseId = (firebaseConfig as { firestoreDatabaseId?: string }).firestoreDatabaseId;
const db = databaseId && databaseId !== '(default)'
  ? getFirestore(app, databaseId)
  : getFirestore(app);

async function purgeAllStaleData() {
  console.log('--- Starting Complete Cleanup of Stale Firestore Data ---');

  // 1. Fetch all businesses
  const bizSnap = await getDocs(collection(db, 'businesses'));
  console.log(`Found ${bizSnap.size} businesses to purge.`);

  for (const bDoc of bizSnap.docs) {
    const bizId = bDoc.id;
    console.log(`Deleting business: ${bizId}`);

    const subcols = ['customers', 'inventory', 'deliveries', 'transactions', 'orders', 'workers'];
    for (const sc of subcols) {
      try {
        const subSnap = await getDocs(collection(db, `businesses/${bizId}/${sc}`));
        for (const sDoc of subSnap.docs) {
          await deleteDoc(doc(db, `businesses/${bizId}/${sc}`, sDoc.id));
          console.log(`  Deleted businesses/${bizId}/${sc}/${sDoc.id}`);
        }
      } catch (err) {
        console.warn(`  Could not list/delete ${sc} for ${bizId}:`, err);
      }
    }

    // Delete business document
    await deleteDoc(doc(db, 'businesses', bizId));
    console.log(`Deleted business document businesses/${bizId}`);
  }

  // 2. Delete all worker_assignments
  const assignSnap = await getDocs(collection(db, 'worker_assignments'));
  console.log(`Found ${assignSnap.size} worker assignments to purge.`);
  for (const aDoc of assignSnap.docs) {
    await deleteDoc(doc(db, 'worker_assignments', aDoc.id));
    console.log(`Deleted worker_assignments/${aDoc.id}`);
  }

  console.log('--- Successfully purged all stale data from Firestore! ---');
}

purgeAllStaleData().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('Error during cleanup:', err);
  process.exit(1);
});
