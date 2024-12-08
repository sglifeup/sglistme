'use client'

import { useState, useEffect, useCallback } from 'react';
import { Property, subscribeToProperties } from '../../utils/firebase';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Heart, ArrowUpDown } from 'lucide-react';

const columns = [
  { key: 'address', label: 'Address' },
  { key: 'agent', label: 'Agent' },
  { key: 'price', label: 'Price' },
  { key: 'layout', label: 'Layout' },
  { key: 'size', label: 'Size' },
  { key: 'psf', label: 'PSF' },
  { key: 'date', label: 'Date' }
] as const;

export function FavoritesList() {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [filteredProperties, setFilteredProperties] = useState<Property[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Property; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });
  const [notifications, setNotifications] = useState<string[]>([]); // Added state for notifications

  useEffect(() => {
    const storedFavorites = localStorage.getItem('favorites');
    if (storedFavorites) {
      setFavorites(JSON.parse(storedFavorites));
    }

    const unsubscribe = subscribeToProperties((data) => {
      setProperties(data);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const favoriteProperties = properties.filter(property => favorites.includes(property.id));
    setFilteredProperties(favoriteProperties);
  }, [favorites, properties]);

  useEffect(() => {
    const filtered = filteredProperties.filter(property =>
      Object.values(property).some(value =>
        value?.toString().toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
    setFilteredProperties(filtered);
  }, [searchTerm]);

  useEffect(() => {
    console.log('Current notifications:', notifications);
  }, [notifications]); // Added useEffect for debugging notifications

  const removeFavorite = (id: string) => {
    const newFavorites = favorites.filter(favId => favId !== id);
    setFavorites(newFavorites);
    localStorage.setItem('favorites', JSON.stringify(newFavorites));
    setNotifications(prev => [`Property removed from favorites`, ...prev]);
  };

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

  return (
    <div className="space-y-4">
      <Input
        type="text"
        placeholder="Search favorites..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="w-full mb-4"
      />
      {filteredProperties.length === 0 ? (
        <p>No favorite properties found.</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((column) => (
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
                ))}
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProperties.map((property) => (
                <TableRow key={property.id}>
                  <TableCell className="font-medium">{property.address || 'N/A'}</TableCell>
                  <TableCell>{property.agent || 'N/A'}</TableCell>
                  <TableCell>{formatCurrency(property.price)}</TableCell>
                  <TableCell>{property.layout || 'N/A'}</TableCell>
                  <TableCell>{property.size || 'N/A'}</TableCell>
                  <TableCell>{property.psf ? `$${property.psf.toFixed(2)}` : 'N/A'}</TableCell>
                  <TableCell>{formatDate(property.date)}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFavorite(property.id)}
                      aria-label="Remove from favorites"
                    >
                      <Heart className="text-red-500 fill-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

