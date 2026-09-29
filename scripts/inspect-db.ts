import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, deleteDoc, writeBatch } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const databaseId = (firebaseConfig as { firestoreDatabaseId?: string }).firestoreDatabaseId;
const db = databaseId && databaseId !== '(default)'
  ? getFirestore(app, databaseId)
  : getFirestore(app);

async function inspectAndClean() {
  console.log('--- Inspecting Firestore Collections ---');
  
  // Check businesses
  const bizSnap = await getDocs(collection(db, 'businesses'));
  console.log(`Found ${bizSnap.size} businesses:`);
  for (const bDoc of bizSnap.docs) {
    console.log(`  Business ID: ${bDoc.id}`, bDoc.data());
    
    // Check subcollections
    const subcols = ['customers', 'inventory', 'deliveries', 'transactions', 'orders', 'workers'];
    for (const sc of subcols) {
      const subSnap = await getDocs(collection(db, `businesses/${bDoc.id}/${sc}`));
      console.log(`    Subcollection '${sc}': ${subSnap.size} docs`);
      subSnap.forEach(d => console.log(`      [${d.id}]:`, JSON.stringify(d.data())));
    }
  }

  // Check worker_assignments
  const assignSnap = await getDocs(collection(db, 'worker_assignments'));
  console.log(`Found ${assignSnap.size} worker_assignments:`);
  assignSnap.forEach(d => console.log(`  [${d.id}]:`, JSON.stringify(d.data())));
}

inspectAndClean().catch(err => {
  console.error('Inspection error:', err);
  process.exit(1);
});
