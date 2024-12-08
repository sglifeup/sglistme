'use client'

import { useCallback, useEffect, useState, useRef } from 'react';
import { Property, getInitialProperties, getNextProperties, getTotalPropertiesCount, testDatabaseConnection } from '../../utils/firebase';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, Copy, X, Settings } from 'lucide-react';
import { Notification } from './Notification';
import debounce from 'lodash/debounce';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const columns = [
  { key: 'address', label: 'Address' },
  { key: 'price', label: 'Price' },
  { key: 'layout', label: 'Layout' },
  { key: 'size', label: 'Size' },
  { key: 'psf', label: 'PSF' },
  { key: 'agent', label: 'Agent' },
  { key: 'date', label: 'Date' }
] as const;

interface DataTableProps {
  isFavoritesTab?: boolean;
}

export default function DataTable({ isFavoritesTab = false }: DataTableProps) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [filteredProperties, setFilteredProperties] = useState<Property[]>([]);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Property; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [notifications, setNotifications] = useState<string[]>([]);
  const observer = useRef<IntersectionObserver | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [searchProgress, setSearchProgress] = useState<number>(0);
  const [cachedFavoriteProperties, setCachedFavoriteProperties] = useState<Property[]>([]);
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(() => {
    return columns.reduce((acc, column) => ({
      ...acc,
      [column.key]: true
    }), {});
  });

  useEffect(() => {
    const testConnection = async () => {
      try {
        const isConnected = await testDatabaseConnection();
        if (!isConnected) {
          setError('Failed to connect to database');
        }
      } catch (error: any) {
        console.error('Connection test failed:', error);
        if (error?.code === 'resource-exhausted') {
          setError('Database quota exceeded. Please try again later.');
        } else {
          setError('Database connection error');
        }
      }
    };

    testConnection();
  }, []);

  const debouncedSearch = useCallback(
    debounce(async (searchValue: string) => {
      if (searchValue.length < 2) {
        setIsInitialLoad(true);
        return;
      }

      const searchTerms = searchValue.toLowerCase()
        .split(/[\s,]+/)
        .map(term => term.trim())
        .filter(term => term.length > 0);
      
      if (searchTerms.length === 0) {
        setIsInitialLoad(true);
        return;
      }

      setIsSearching(true);
      setIsLoading(true);
      try {
        const initialProps = await getInitialProperties(50, searchTerms, (progress) => {
          setSearchProgress(progress);
        });

        if (isFavoritesTab) {
          const favoriteProps = initialProps.filter(prop => favorites.includes(prop.id));
          setProperties(favoriteProps);
          setFilteredProperties(favoriteProps);
          setTotalCount(favoriteProps.length);
        } else {
          setProperties(initialProps);
          setFilteredProperties(initialProps);
          setTotalCount(initialProps.length);
        }
        setHasMore(false);

      } catch (error: any) {
        console.error('Error in search:', error);
        if (error?.code === 'resource-exhausted') {
          setError('Database quota exceeded. Please try again in a few minutes.');
        } else {
          setError('Failed to search properties');
        }
      } finally {
        setIsLoading(false);
        setIsSearching(false);
      }
    }, 500),
    [isFavoritesTab, favorites]
  );

  // Initial load
  useEffect(() => {
    const loadInitialData = async () => {
      if (!isInitialLoad) return;
      
      setIsLoading(true);
      try {
        if (isFavoritesTab) {
          // For favorites tab, always use cached properties if available
          if (cachedFavoriteProperties.length > 0) {
            setProperties(cachedFavoriteProperties);
            setFilteredProperties(cachedFavoriteProperties);
            setTotalCount(cachedFavoriteProperties.length);
            setHasMore(false);
            setIsLoading(false);
            setIsInitialLoad(false);
            return;
          }
        }

        // Load from server for non-favorites or if cache is empty
        const [initialProps, count] = await Promise.all([
          getInitialProperties(50),
          getTotalPropertiesCount()
        ]);
        
        if (isFavoritesTab) {
          const favoriteProps = initialProps.filter(prop => favorites.includes(prop.id));
          if (favoriteProps.length > 0) {
            setProperties(favoriteProps);
            setFilteredProperties(favoriteProps);
            setTotalCount(favoriteProps.length);
            // Update cache
            setCachedFavoriteProperties(favoriteProps);
            localStorage.setItem('favoriteProperties', JSON.stringify(favoriteProps));
          }
          setHasMore(false);
        } else {
          setProperties(initialProps);
          setFilteredProperties(initialProps);
          setTotalCount(count);
          setHasMore(initialProps.length < count);
        }
      } catch (error) {
        console.error('Error in initial load:', error);
        setError('Failed to load properties');
      } finally {
        setIsLoading(false);
        setIsInitialLoad(false);
      }
    };

    loadInitialData();
  }, [isInitialLoad, isFavoritesTab, favorites, cachedFavoriteProperties]);

  const formatCurrency = useCallback((value: number) => {
    if (isNaN(value)) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(value);
  }, []);

  const formatDate = useCallback((dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'N/A';
      
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC'
      }).format(date);
    } catch {
      return 'N/A';
    }
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    setFavorites(prev => {
      const newFavorites = prev.includes(id)
        ? prev.filter(favId => favId !== id)
        : [...prev, id];
      
      // Save favorites list to localStorage
      localStorage.setItem('favorites', JSON.stringify(newFavorites));
      
      // Update cached properties
      const property = properties.find(p => p.id === id);
      if (property) {
        if (prev.includes(id)) {
          // Remove from cache if unfavoriting
          setCachedFavoriteProperties(cached => {
            const newCache = cached.filter(p => p.id !== id);
            localStorage.setItem('favoriteProperties', JSON.stringify(newCache));
            return newCache;
          });

          // If we're in favorites tab, also update filtered properties
          if (isFavoritesTab) {
            setFilteredProperties(prev => prev.filter(p => p.id !== id));
            setTotalCount(prev => (prev || 0) - 1);
          }
        } else {
          // Add to cache if favoriting
          setCachedFavoriteProperties(cached => {
            const newCache = [...cached, property];
            localStorage.setItem('favoriteProperties', JSON.stringify(newCache));
            return newCache;
          });
        }
      }
      
      // Add notification
      const message = prev.includes(id) 
        ? 'Property removed from favorites' 
        : 'Property added to favorites';
      setNotifications(prevNotifications => [message, ...prevNotifications]);
      
      return newFavorites;
    });
  }, [properties, isFavoritesTab]);

  const retryOperation = async (operation: () => Promise<any>, maxRetries = 3, delay = 1000) => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation();
      } catch (error: any) {
        if (error?.code === 'resource-exhausted' && i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
          continue;
        }
        throw error;
      }
    }
  };

  const loadMoreProperties = useCallback(async () => {
    if (isLoading || !hasMore || properties.length === 0) {
      console.log('Skipping loadMoreProperties:', { isLoading, hasMore, propertiesLength: properties.length });
      return;
    }

    setIsLoading(true);
    try {
      const lastProperty = properties[properties.length - 1];
      console.log('Loading more after:', lastProperty);
      
      const searchTerms = searchTerm.toLowerCase()
        .split(/[\s,]+/)
        .map(term => term.trim())
        .filter(term => term.length > 0);
      
      const newProperties = await getNextProperties(
        lastProperty, 
        50, 
        searchTerms.length > 0 ? searchTerms : undefined
      );

      if (newProperties.length > 0) {
        setProperties(prevProperties => {
          const existingIds = new Set(prevProperties.map(p => p.id));
          const uniqueNewProperties = newProperties.filter(p => !existingIds.has(p.id));
          return [...prevProperties, ...uniqueNewProperties];
        });

        setFilteredProperties(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const uniqueNewProperties = newProperties.filter(p => !existingIds.has(p.id));
          return [...prev, ...uniqueNewProperties];
        });

        setHasMore(newProperties.length === 50);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Error loading more properties:', error);
      setError('Failed to load more properties');
    } finally {
      setIsLoading(false);
    }
  }, [properties, isLoading, hasMore, searchTerm]);

  // Add scroll event listener for mobile
  useEffect(() => {
    let scrollTimeout: NodeJS.Timeout;
    
    const handleScroll = () => {
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
      
      scrollTimeout = setTimeout(() => {
        const scrollPosition = window.innerHeight + window.scrollY;
        const documentHeight = document.documentElement.scrollHeight;
        const scrollPercentage = (scrollPosition / documentHeight) * 100;
        
        if (scrollPercentage > 75 && !isLoading && hasMore) {
          console.log('Near bottom, loading more...', { scrollPercentage });
          loadMoreProperties();
        }
      }, 100);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
    };
  }, [loadMoreProperties, isLoading, hasMore]);

  const lastPropertyElementRef = useCallback((node: HTMLTableRowElement | null) => {
    if (isLoading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        console.log('Last property element is intersecting. Loading more properties...');
        loadMoreProperties();
      }
    }, {
      root: null,
      rootMargin: '300px',
      threshold: 0.1
    });
    
    if (node) {
      console.log('Observing last property element');
      observer.current.observe(node);
    }
  }, [isLoading, hasMore, loadMoreProperties]);

  const handleSort = useCallback((key: keyof Property) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key) {
      direction = sortConfig.direction === 'asc' ? 'desc' : 'asc';
    } else if (key === 'date') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });

    const sorted = [...filteredProperties].sort((a, b) => {
      const valueA = a[key];
      const valueB = b[key];

      if (valueA === undefined && valueB === undefined) return 0;
      if (valueA === undefined) return direction === 'asc' ? 1 : -1;
      if (valueB === undefined) return direction === 'asc' ? -1 : 1;

      if (key === 'date') {
        return direction === 'asc' 
          ? new Date(valueA).getTime() - new Date(valueB).getTime()
          : new Date(valueB).getTime() - new Date(valueA).getTime();
      }

      if (key === 'price' || key === 'psf') {
        return direction === 'asc' 
          ? Number(valueA) - Number(valueB)
          : Number(valueB) - Number(valueA);
      }

      if (typeof valueA === 'string' && typeof valueB === 'string') {
        return direction === 'asc' 
          ? valueA.localeCompare(valueB)
          : valueB.localeCompare(valueA);
      }

      return 0;
    });
    setFilteredProperties(sorted);
  }, [filteredProperties, sortConfig]);

  // Search functionality
  useEffect(() => {
    debouncedSearch(searchTerm);
    
    // Cleanup
    return () => {
      debouncedSearch.cancel();
    };
  }, [searchTerm, debouncedSearch]);

  useEffect(() => {
    try {
      const storedFavorites = localStorage.getItem('favorites');
      const storedFavoriteProperties = localStorage.getItem('favoriteProperties');
      
      if (storedFavorites) {
        const parsedFavorites = JSON.parse(storedFavorites);
        setFavorites(parsedFavorites);
      }
      
      if (storedFavoriteProperties) {
        const parsedProperties = JSON.parse(storedFavoriteProperties);
        if (Array.isArray(parsedProperties) && parsedProperties.length > 0) {
          setCachedFavoriteProperties(parsedProperties);
        }
      }
    } catch (error) {
      console.error('Error loading favorites from localStorage:', error);
    }
  }, []);

  const dismissNotification = useCallback((index: number) => {
    setNotifications(prev => prev.filter((_, i) => i !== index));
  }, []);

  const copyFavoritesToClipboard = useCallback(() => {
    const favoriteProperties = properties.filter(prop => favorites.includes(prop.id));
    const text = favoriteProperties.map(prop => (
      `${prop.address}\n` +
      `Price: ${formatCurrency(prop.price)}\n` +
      `Size: ${prop.size}\n` +
      `Layout: ${prop.layout}\n` +
      `PSF: $${prop.psf}\n` +
      `Agent: ${prop.agent}\n` +
      `Date: ${formatDate(prop.date)}\n` +
      '-------------------'
    )).join('\n\n');

    navigator.clipboard.writeText(text).then(() => {
      setNotifications(prev => ['Copied favorites to clipboard!', ...prev]);
    }).catch(() => {
      setNotifications(prev => ['Failed to copy to clipboard', ...prev]);
    });
  }, [properties, favorites, formatCurrency, formatDate]);

  return (
    <div className="space-y-4 relative pb-16">
      <div className="space-y-2">
        <div className="relative">
          <Input
            type="text"
            placeholder="Search (e.g., 'farrer park' or 'agent:john' or 'size:1000')"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full ${searchTerm ? 'pr-8' : ''}`}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="text-xs text-gray-500">
          Use prefixes: address:, agent:, layout:, size:, psf: (e.g., "agent:john size:1000")
        </div>
      </div>
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Error:</strong>
          <span className="block sm:inline"> {error}</span>
        </div>
      )}
      {totalCount !== null && (
        <div className="text-sm text-gray-500">
          {isSearching ? (
            `Searching... ${searchProgress} of ${totalCount} properties`
          ) : (
            filteredProperties.length === totalCount
              ? `Showing ${filteredProperties.length} ${filteredProperties.length === 1 ? 'property' : 'properties'}`
              : `Showing ${filteredProperties.length} of ${totalCount} properties`
          )}
        </div>
      )}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8 px-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="left">
                    {columns.map((column) => (
                      <DropdownMenuCheckboxItem
                        key={column.key}
                        checked={columnVisibility[column.key]}
                        onCheckedChange={(checked) => {
                          setColumnVisibility(prev => ({
                            ...prev,
                            [column.key]: checked
                          }));
                        }}
                      >
                        {column.label}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableHead>
              {columns.map((column) => (
                columnVisibility[column.key] && (
                  <TableHead key={column.key}>
                    <Button 
                      variant="ghost" 
                      onClick={() => handleSort(column.key as keyof Property)}
                      className="h-8 w-full justify-start text-left font-medium"
                    >
                      {column.label}
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                )
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProperties.length === 0 ? (
              <TableRow>
                <TableCell colSpan={Object.values(columnVisibility).filter(Boolean).length + 1} className="h-24 text-center">
                  {isLoading ? (
                    <div className="text-gray-500">
                      {searchTerm ? 'Searching...' : 'Loading properties...'}
                    </div>
                  ) : (
                    'No properties found.'
                  )}
                </TableCell>
              </TableRow>
            ) : (
              filteredProperties.map((property, index) => (
                <TableRow 
                  key={property.id} 
                  className={`cursor-pointer ${favorites.includes(property.id) ? 'bg-muted' : ''}`}
                  onClick={() => toggleFavorite(property.id)}
                  ref={index === filteredProperties.length - 1 ? lastPropertyElementRef : null}
                >
                  <TableCell className="w-8 px-2" />
                  {columnVisibility.address && <TableCell className="font-medium">{property.address || 'N/A'}</TableCell>}
                  {columnVisibility.price && <TableCell>{formatCurrency(property.price)}</TableCell>}
                  {columnVisibility.layout && <TableCell>{property.layout || 'N/A'}</TableCell>}
                  {columnVisibility.size && <TableCell>{property.size || 'N/A'}</TableCell>}
                  {columnVisibility.psf && <TableCell>{property.psf ? `$${property.psf.toFixed(2)}` : 'N/A'}</TableCell>}
                  {columnVisibility.agent && <TableCell>{property.agent || 'N/A'}</TableCell>}
                  {columnVisibility.date && <TableCell>{formatDate(property.date)}</TableCell>}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {!isLoading && !hasMore && filteredProperties.length > 0 && (
        <div className="text-center py-4 text-gray-500">
          No more properties to load.
        </div>
      )}
      <Notification messages={notifications} onDismiss={dismissNotification} />
      {isFavoritesTab && filteredProperties.length > 0 && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2">
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2 shadow-lg"
            onClick={copyFavoritesToClipboard}
          >
            <Copy className="h-4 w-4" />
            Copy {filteredProperties.length} Favorites
          </Button>
        </div>
      )}
    </div>
  );
}

