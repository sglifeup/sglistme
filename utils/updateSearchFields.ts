import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  getDocs,
  writeBatch,
  query,
  limit
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const generateSearchTerms = (address: string): string[] => {
  const terms = address.toLowerCase()
    .replace(/[^\w\s]/g, ' ')  // Replace special chars with spaces
    .split(/[\s,]+/)           // Split on spaces and commas
    .filter(term => term.length > 0);
  
  // Add the full lowercase address as well
  terms.push(address.toLowerCase());
  
  // Remove duplicates
  return [...new Set(terms)];
};

export const updateAllDocuments = async () => {
  const BATCH_SIZE = 500;
  let processed = 0;
  let updated = 0;
  
  try {
    const propertiesCol = collection(db, 'property');
    const snapshot = await getDocs(propertiesCol);
    
    console.log(`Found ${snapshot.size} documents to process`);
    
    // Process in batches
    for (let i = 0; i < snapshot.size; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      let batchCount = 0;
      
      const batchDocs = snapshot.docs.slice(i, i + BATCH_SIZE);
      
      for (const doc of batchDocs) {
        const address = doc.data().address || '';
        const searchTerms = generateSearchTerms(address);
        
        batch.update(doc.ref, {
          addressLower: searchTerms
        });
        
        batchCount++;
      }
      
      if (batchCount > 0) {
        await batch.commit();
        processed += batchCount;
        updated += batchCount;
        console.log(`Processed ${processed} documents`);
      }
    }
    
    console.log(`Update complete. Updated ${updated} documents`);
    return { processed, updated };
    
  } catch (error) {
    console.error('Error updating documents:', error);
    throw error;
  }
};

// Run the update
updateAllDocuments().then(result => {
  console.log('Update completed successfully:', result);
}).catch(error => {
  console.error('Update failed:', error);
});

