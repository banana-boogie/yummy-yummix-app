import { SupabaseClient } from '@supabase/supabase-js';
import { toSnakeCaseKeys, toCamelCaseKeys } from '@/utils/transformers/caseTransform';

export class BaseService {
  protected supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  protected transformResponse<T>(data: any, options = { deep: true }): T | null {
    if (!data) return null;
    
    // Handle arrays
    if (Array.isArray(data)) {
      return data.map(item => this.transformResponse(item, options)) as unknown as T;
    }
    
    // Only process objects (not primitives, null, etc.)
    if (typeof data !== 'object' || data === null) {
      return data as unknown as T;
    }
    
    // Transform the base object
    const transformed = toCamelCaseKeys(data) as Record<string, any>;
    
    // Recursively transform nested objects if deep option is enabled
    if (options.deep) {
      for (const [key, value] of Object.entries(transformed)) {
        if (typeof value === 'object' && value !== null) {
          transformed[key] = this.transformResponse(value, options);
        }
      }
    }
    
    return transformed as T;
  }

  protected transformRequest(data: Record<string, any>, options = { deep: true }): Record<string, any> {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid data provided for transformation');
    }
    
    // Handle arrays
    if (Array.isArray(data)) {
      return data.map(item => 
        typeof item === 'object' ? this.transformRequest(item, options) : item
      );
    }
    
    // Transform the base object
    const transformed = toSnakeCaseKeys(data) as Record<string, any>;
    
    // Recursively transform nested objects if deep option is enabled
    if (options.deep) {
      for (const [key, value] of Object.entries(transformed)) {
        if (typeof value === 'object' && value !== null) {
          transformed[key] = this.transformRequest(value, options);
        }
      }
    }
    
    return transformed;
  }

  protected async transformedSelect<T>(query: any): Promise<T> {
    if (!query) {
      throw new Error('Invalid query provided');
    }
    const { data, error } = await query;
    if (error) throw error;
    return this.transformResponse<T>(data) as T;
  }

  protected async transformedUpdate<T>(table: string, id: string, updates: Record<string, any>): Promise<T | null> {
    if (!table || !id) {
      throw new Error('Table name and ID are required for update operation');
    }

    if (!updates || typeof updates !== 'object') {
      throw new Error('Invalid updates provided');
    }

    const { data, error } = await this.supabase
      .from(table)
      .update(this.transformRequest(updates))
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return this.transformResponse<T>(data);
  }

  protected async transformedInsert<T>(table: string, insertData: Record<string, any>): Promise<T> {
    if (!table) {
      throw new Error('Table name is required for insert operation');
    }

    if (!insertData || typeof insertData !== 'object') {
      throw new Error('Invalid data provided for insertion');
    }

    const { data, error } = await this.supabase
      .from(table)
      .insert(this.transformRequest(insertData))
      .select('*')
      .single();

    if (error) throw error;
    if (!data) {
      throw new Error('No data returned from insert operation');
    }
    return this.transformResponse<T>(data) as T;
  }

  protected async transaction<T>(callback: (supabase: SupabaseClient) => Promise<T>): Promise<T> {
    const { error: beginError } = await this.supabase.rpc('begin_transaction');
    if (beginError) throw beginError;

    try {
      const result = await callback(this.supabase);
      const { error: commitError } = await this.supabase.rpc('commit_transaction');
      if (commitError) throw commitError;
      return result;
    } catch (error) {
      const { error: rollbackError } = await this.supabase.rpc('rollback_transaction');
      if (rollbackError) {
        console.error('Error during rollback:', rollbackError);
      }
      throw error;
    }
  }
} 