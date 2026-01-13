import { useState, useEffect, useCallback } from 'react';
import { adminUsefulItemsService } from '@/services/admin/adminUsefulItemsService';
import { AdminUsefulItem } from '@/types/recipe.admin.types';

export function useUsefulItems() {
  const [loading, setLoading] = useState(true);
  const [usefulItems, setUsefulItems] = useState<AdminUsefulItem[]>([]);
  const [filteredUsefulItems, setFilteredUsefulItems] = useState<AdminUsefulItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const loadUsefulItems = useCallback(async () => {
    try {
      setLoading(true);
      const items = await adminUsefulItemsService.getAllUsefulItems();
      setUsefulItems(items);
      setFilteredUsefulItems(items);
    } catch (error) {
      console.error('Error loading useful items:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsefulItems();
  }, [loadUsefulItems]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredUsefulItems(usefulItems);
      return;
    }

    const lowerQuery = searchQuery.toLowerCase().trim();
    const filtered = usefulItems.filter(
      item => 
        item.nameEn.toLowerCase().includes(lowerQuery) || 
        item.nameEs.toLowerCase().includes(lowerQuery)
    );
    setFilteredUsefulItems(filtered);
  }, [searchQuery, usefulItems]);

  const handleDeleteUsefulItem = async (item: AdminUsefulItem) => {
    try {
      await adminUsefulItemsService.deleteUsefulItem(item.id);
      setUsefulItems(prev => prev.filter(i => i.id !== item.id));
      setFilteredUsefulItems(prev => prev.filter(i => i.id !== item.id));
    } catch (error) {
      console.error('Error deleting useful item:', error);
      throw error;
    }
  };

  return {
    loading,
    usefulItems,
    filteredUsefulItems,
    setFilteredUsefulItems,
    setUsefulItems,
    searchQuery,
    setSearchQuery,
    handleDeleteUsefulItem,
    refreshUsefulItems: loadUsefulItems,
  };
} 