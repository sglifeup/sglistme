import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  query as firestoreQuery, 
  orderBy, 
  limit as firestoreLimit, 
  startAfter, 
  getDocs, 
  getCountFromServer, 
  Timestamp, 
  onSnapshot, 
  QuerySnapshot, 
  DocumentData, 
  where, 
  getDoc, 
  doc 
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

export interface Property {
  id: string;
  address: string;
  price: number;
  agent: string;
  size: string;
  date: string;
  layout: string;
  psf: number;
}

// Add a type for search fields
type SearchField = 'address' | 'agent' | 'layout' | 'size' | 'psf';

// Add a function to parse search terms
const parseSearchTerms = (searchTerms: string[]) => {
  const fieldSearches: Partial<Record<SearchField, string>> = {};
  const addressTerms: string[] = [];

  searchTerms.forEach(term => {
    const fieldMatch = term.match(/^(address|agent|layout|size|psf):(.+)/i);
    if (fieldMatch) {
      const [, field, value] = fieldMatch;
      fieldSearches[field.toLowerCase() as SearchField] = value.toLowerCase();
    } else {
      addressTerms.push(term.toLowerCase());
    }
  });

  return { fieldSearches, addressTerms };
};

export const getInitialProperties = async (
  pageSize: number, 
  searchTerms?: string[],
  onProgress?: (count: number) => void
) => {
  try {
    console.log('Getting initial properties:', { pageSize, searchTerms });
    const propertiesCol = collection(db, 'property');

    let baseQuery;
    if (searchTerms && searchTerms.length > 0) {
      // Check if it's a field-specific search
      const fieldMatch = searchTerms[0].match(/^(address|agent|layout|size|psf):(.+)/i);
      if (fieldMatch) {
        // Use regular query for field-specific searches
        baseQuery = firestoreQuery(
          propertiesCol,
          orderBy('date', 'desc'),
          firestoreLimit(pageSize * 2)
        );
      } else {
        // Use addressLower for regular address searches
        baseQuery = firestoreQuery(
          propertiesCol,
          where('addressLower', 'array-contains', searchTerms[0].toLowerCase()),
          orderBy('date', 'desc'),
          firestoreLimit(pageSize)
        );
      }
    } else {
      baseQuery = firestoreQuery(
        propertiesCol,
        orderBy('date', 'desc'),
        firestoreLimit(pageSize)
      );
    }

    const snapshot = await getDocs(baseQuery);
    
    if (snapshot.empty) {
      console.log('No properties found');
      return [];
    }

    let properties = snapshot.docs.map(doc => {
      const data = doc.data() as DocumentData;
      return {
        id: doc.id,
        address: data.address || '',
        price: data.price || 0,
        agent: data.agent || '',
        size: data.size || '',
        date: data.date instanceof Timestamp ? data.date.toDate().toISOString() : data.date,
        layout: data.layout || '',
        psf: data.psf || 0
      } as Property;
    });

    // Call progress callback with current count
    onProgress?.(properties.length);

    // Additional filtering for field-specific searches or multiple terms
    if (searchTerms && searchTerms.length > 0) {
      properties = properties.filter(property => {
        const searchableFields = {
          address: property.address.toLowerCase(),
          agent: property.agent.toLowerCase(),
          layout: property.layout.toLowerCase(),
          size: property.size.toLowerCase(),
          price: property.price.toString(),
          psf: property.psf.toString()
        };

        return searchTerms.every(term => {
          const termLower = term.toLowerCase();
          
          // Check if it's a field-specific search
          const fieldMatch = term.match(/^(address|agent|layout|size|psf):(.+)/i);
          if (fieldMatch) {
            const [, field, value] = fieldMatch;
            const propertyValue = String(property[field as keyof Property]).toLowerCase();
            return propertyValue.includes(value.toLowerCase());
          }
          
          // For regular terms, only filter if it's not the first term (already handled by addressLower)
          return searchTerms.indexOf(term) === 0 || 
            Object.values(searchableFields).some(value => value.includes(termLower));
        });
      });

      // Trim to requested page size if we fetched extra
      if (properties.length > pageSize) {
        properties = properties.slice(0, pageSize);
      }
    }

    return properties;
  } catch (error) {
    console.error('Error in getInitialProperties:', error);
    throw error;
  }
};

export const getNextProperties = async (
  lastProperty: Property, 
  pageSize: number,
  searchTerms?: string[]
) => {
  try {
    console.log('Getting next properties:', { lastProperty, pageSize, searchTerms });
    const propertiesCol = collection(db, 'property');
    
    // Get the reference to the last document using its ID directly
    const lastDocRef = doc(propertiesCol, `${lastProperty.address} ${lastProperty.agent} ${lastProperty.date}`);
    const lastDocSnapshot = await getDoc(lastDocRef);
    
    if (!lastDocSnapshot.exists()) {
      console.error('Could not find last document:', lastProperty);
      return [];
    }
    
    let baseQuery;
    if (searchTerms && searchTerms.length > 0) {
      // Check if it's a field-specific search
      const fieldMatch = searchTerms[0].match(/^(address|agent|layout|size|psf):(.+)/i);
      if (fieldMatch) {
        // Use regular query for field-specific searches
        baseQuery = firestoreQuery(
          propertiesCol,
          orderBy('date', 'desc'),
          startAfter(lastDocSnapshot),
          firestoreLimit(pageSize * 2)
        );
      } else {
        // Use addressLower for regular address searches
        baseQuery = firestoreQuery(
          propertiesCol,
          where('addressLower', 'array-contains', searchTerms[0].toLowerCase()),
          orderBy('date', 'desc'),
          startAfter(lastDocSnapshot),
          firestoreLimit(pageSize)
        );
      }
    } else {
      baseQuery = firestoreQuery(
        propertiesCol,
        orderBy('date', 'desc'),
        startAfter(lastDocSnapshot),
        firestoreLimit(pageSize)
      );
    }

    const snapshot = await getDocs(baseQuery);
    console.log('Got snapshot with size:', snapshot.size);

    let properties = snapshot.docs.map(doc => {
      const data = doc.data() as DocumentData;
      return {
        id: doc.id,
        address: data.address || '',
        price: data.price || 0,
        agent: data.agent || '',
        size: data.size || '',
        date: data.date instanceof Timestamp ? data.date.toDate().toISOString() : data.date,
        layout: data.layout || '',
        psf: data.psf || 0
      } as Property;
    });

    // Additional filtering for field-specific searches or multiple terms
    if (searchTerms && searchTerms.length > 0) {
      properties = properties.filter(property => {
        const searchableFields = {
          address: property.address.toLowerCase(),
          agent: property.agent.toLowerCase(),
          layout: property.layout.toLowerCase(),
          size: property.size.toLowerCase(),
          price: property.price.toString(),
          psf: property.psf.toString()
        };

        return searchTerms.every(term => {
          const termLower = term.toLowerCase();
          
          // Check if it's a field-specific search
          const fieldMatch = term.match(/^(address|agent|layout|size|psf):(.+)/i);
          if (fieldMatch) {
            const [, field, value] = fieldMatch;
            const propertyValue = String(property[field as keyof Property]).toLowerCase();
            return propertyValue.includes(value.toLowerCase());
          }
          
          // For regular terms, only filter if it's not the first term (already handled by addressLower)
          return searchTerms.indexOf(term) === 0 || 
            Object.values(searchableFields).some(value => value.includes(termLower));
        });
      });

      // Trim to requested page size if we fetched extra
      if (properties.length > pageSize) {
        properties = properties.slice(0, pageSize);
      }
    }

    console.log('Next page properties:', {
      count: properties.length,
      hasMore: properties.length === pageSize,
      firstDate: properties[0]?.date,
      lastDate: properties[properties.length - 1]?.date
    });

    return properties;
  } catch (error) {
    console.error('Error in getNextProperties:', error);
    throw error;
  }
};

export const getTotalPropertiesCount = async (searchTerms?: string[]) => {
  try {
    const propertiesCol = collection(db, 'property');
    
    if (searchTerms?.length) {
      // For search, we need to get all documents to count matches
      const q = firestoreQuery(propertiesCol, orderBy('date', 'desc'));
      const snapshot = await getDocs(q);
      
      const filteredCount = snapshot.docs.filter(doc => {
        const data = doc.data();
        const searchableText = String(data.address || '').toLowerCase();
        return searchTerms.every(term => searchableText.includes(term.toLowerCase()));
      }).length;

      return filteredCount;
    }

    const snapshot = await getCountFromServer(propertiesCol);
    return snapshot.data().count;
  } catch (error) {
    console.error('Error in getTotalPropertiesCount:', error);
    throw error;
  }
};

export function subscribeToProperties(callback: (properties: Property[]) => void, pageSize: number = 20) {
  const propertiesCol = collection(db, 'property');
  const q = firestoreQuery(
    propertiesCol, 
    orderBy('date', 'desc'), 
    firestoreLimit(pageSize)
  );
  
  return onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
    const properties = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        date: data.date instanceof Timestamp ? data.date.toDate().toISOString() : data.date
      } as Property;
    });
    callback(properties);
  }, (error) => {
    console.error('Error in properties subscription:', error);
  });
}

export async function searchProperties(searchTerm: string): Promise<Property[]> {
  try {
    console.log('Starting search with term:', searchTerm);
    const propertiesCol = collection(db, 'property');
    
    // Get all properties without any filtering first
    const q = query(propertiesCol);
    
    console.log('Fetching properties from Firebase...');
    const snapshot = await getDocs(q);
    console.log('Total documents fetched:', snapshot.docs.length);
    
    // Map and filter the properties
    const searchTermLower = searchTerm.toLowerCase().trim();
    console.log('Normalized search term:', searchTermLower);
    
    const properties = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        date: data.date instanceof Timestamp ? data.date.toDate().toISOString() : data.date
      } as Property;
    });
    
    console.log('Sample of first 5 addresses before filtering:', 
      properties.slice(0, 5).map(p => p.address)
    );
    
    const filteredProperties = properties.filter(property => {
      const propertyAddress = (property.address || '').toLowerCase();
      const propertyAgent = (property.agent || '').toLowerCase();
      const propertyLayout = (property.layout || '').toLowerCase();
      
      // Simple includes check first
      const matches = propertyAddress.includes(searchTermLower) ||
                     propertyAgent.includes(searchTermLower) ||
                     propertyLayout.includes(searchTermLower);
      
      if (matches) {
        console.log('Found matching property:', property.address);
      }
      
      return matches;
    });
    
    console.log('Filtered results count:', filteredProperties.length);
    if (filteredProperties.length > 0) {
      console.log('First matching address:', filteredProperties[0].address);
    }
    
    return filteredProperties;
  } catch (error) {
    console.error('Error in searchProperties:', error);
    throw error;
  }
}

// Add a test function to verify database connection
export const testDatabaseConnection = async () => {
  try {
    console.log('Testing database connection...');
    const propertiesCol = collection(db, 'property');
    const testQuery = firestoreQuery(propertiesCol, firestoreLimit(1));
    const snapshot = await getDocs(testQuery);
    
    console.log('Database connection test:', {
      success: true,
      hasDocuments: !snapshot.empty,
      snapshotSize: snapshot.size,
      collectionPath: propertiesCol.path
    });

    return true;
  } catch (error) {
    console.error('Database connection test failed:', {
      error,
      message: error.message,
      code: error.code
    });
    return false;
  }
};

