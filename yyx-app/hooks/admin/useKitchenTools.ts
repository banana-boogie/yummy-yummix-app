import { useState, useEffect, useCallback } from 'react';
import { adminKitchenToolsService } from '@/services/admin/adminKitchenToolsService';
import { AdminKitchenTool } from '@/types/recipe.admin.types';
import logger from '@/services/logger';

export function useKitchenTools() {
  const [loading, setLoading] = useState(true);
  const [kitchenTools, setKitchenTools] = useState<AdminKitchenTool[]>([]);
  const [filteredKitchenTools, setFilteredKitchenTools] = useState<AdminKitchenTool[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const loadKitchenTools = useCallback(async () => {
    try {
      setLoading(true);
      const items = await adminKitchenToolsService.getAllKitchenTools();
      setKitchenTools(items);
      setFilteredKitchenTools(items);
    } catch (error) {
      logger.error('Error loading kitchen tools:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadKitchenTools();
  }, [loadKitchenTools]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredKitchenTools(kitchenTools);
      return;
    }

    const lowerQuery = searchQuery.toLowerCase().trim();
    const filtered = kitchenTools.filter(item =>
      item.translations.some(t =>
        t.name?.toLowerCase().includes(lowerQuery)
      )
    );
    setFilteredKitchenTools(filtered);
  }, [searchQuery, kitchenTools]);

  const handleDeleteKitchenTool = async (item: AdminKitchenTool) => {
    try {
      await adminKitchenToolsService.deleteKitchenTool(item.id);
      setKitchenTools(prev => prev.filter(i => i.id !== item.id));
      setFilteredKitchenTools(prev => prev.filter(i => i.id !== item.id));
    } catch (error) {
      logger.error('Error deleting kitchen tool:', error);
      throw error;
    }
  };

  return {
    loading,
    kitchenTools,
    filteredKitchenTools,
    setFilteredKitchenTools,
    setKitchenTools,
    searchQuery,
    setSearchQuery,
    handleDeleteKitchenTool,
    refreshKitchenTools: loadKitchenTools,
  };
}
