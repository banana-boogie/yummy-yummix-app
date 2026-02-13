import { Storage } from '@/utils/storage';
import { v4 as uuidv4 } from 'uuid';
import { ShoppingListItemCreate, ShoppingListItemUpdate } from '@/types/shopping-list.types';

export type MutationType =
    | 'ADD_ITEM'
    | 'UPDATE_ITEM'
    | 'DELETE_ITEM'
    | 'CHECK_ITEM'
    | 'BATCH_CHECK'
    | 'BATCH_DELETE'
    | 'REORDER_ITEMS';

// Strongly typed mutation payloads
export interface MutationPayloads {
    ADD_ITEM: { item: ShoppingListItemCreate; listId?: string };
    UPDATE_ITEM: { itemId: string; updates: ShoppingListItemUpdate; listId?: string };
    DELETE_ITEM: { itemId: string; listId?: string };
    CHECK_ITEM: { itemId: string; isChecked: boolean; listId?: string };
    BATCH_CHECK: { itemIds: string[]; isChecked: boolean; listId?: string };
    BATCH_DELETE: { itemIds: string[]; listId?: string };
    REORDER_ITEMS: { updates: Array<{ id: string; displayOrder: number }>; listId?: string };
}

export type MutationPayload = MutationPayloads[MutationType];

export interface PendingMutation {
    id: string;
    type: MutationType;
    payload: MutationPayload;
    timestamp: number;
    retryCount: number;
}

const MUTATION_QUEUE_KEY = 'shopping_list_mutation_queue';

class MutationQueue {
    private queue: PendingMutation[] = [];
    private isLoaded = false;
    private isProcessing = false;
    private onMutationProcessed?: (mutation: PendingMutation, success: boolean) => void;
    private namespace = 'anon';

    private get storageKey(): string {
        return `${MUTATION_QUEUE_KEY}:${this.namespace}`;
    }

    /**
     * Set namespace for queue storage (e.g., user id).
     * Resets in-memory queue to avoid cross-account leakage.
     */
    setNamespace(namespace: string | null | undefined): void {
        const next = namespace ?? 'anon';
        if (next === this.namespace) return;
        this.namespace = next;
        this.isLoaded = false;
        this.queue = [];
    }

    /**
     * Load queue from persistent storage
     */
    async load(): Promise<void> {
        if (this.isLoaded) return;

        try {
            const stored = await Storage.getItem(this.storageKey);
            if (stored) {
                this.queue = JSON.parse(stored);
            }
        } catch (error) {
            console.warn('Failed to load mutation queue:', error);
            this.queue = [];
        }
        this.isLoaded = true;
    }

    /**
     * Save queue to persistent storage
     */
    private async save(): Promise<void> {
        try {
            await Storage.setItem(this.storageKey, JSON.stringify(this.queue));
        } catch (error) {
            console.warn('Failed to save mutation queue:', error);
        }
    }

    /**
     * Add a mutation to the queue
     */
    async enqueue<T extends MutationType>(type: T, payload: MutationPayloads[T]): Promise<string> {
        await this.load();

        const mutation: PendingMutation = {
            id: uuidv4(),
            type,
            payload,
            timestamp: Date.now(),
            retryCount: 0,
        };

        this.queue.push(mutation);
        await this.save();

        return mutation.id;
    }

    /**
     * Remove a mutation from the queue
     */
    async dequeue(mutationId: string): Promise<void> {
        await this.load();

        this.queue = this.queue.filter(m => m.id !== mutationId);
        await this.save();
    }

    /**
     * Get all pending mutations
     */
    async getPending(): Promise<PendingMutation[]> {
        await this.load();
        return [...this.queue];
    }

    /**
     * Get count of pending mutations
     */
    async getCount(): Promise<number> {
        await this.load();
        return this.queue.length;
    }

    /**
     * Clear all pending mutations
     */
    async clear(): Promise<void> {
        this.queue = [];
        try {
            await Storage.removeItem(this.storageKey);
        } catch (error) {
            console.warn('Failed to clear mutation queue:', error);
        }
    }

    /**
     * Increment retry count for a mutation
     */
    async incrementRetry(mutationId: string): Promise<void> {
        await this.load();

        const mutation = this.queue.find(m => m.id === mutationId);
        if (mutation) {
            mutation.retryCount++;
            await this.save();
        }
    }

    /**
     * Set callback for when mutations are processed
     */
    setOnMutationProcessed(callback: (mutation: PendingMutation, success: boolean) => void): void {
        this.onMutationProcessed = callback;
    }

    /**
     * Process all pending mutations
     * @param executor Function that executes a single mutation
     * @returns Number of successfully processed mutations
     */
    async processAll(
        executor: (mutation: PendingMutation) => Promise<void>
    ): Promise<{ success: number; failed: number }> {
        if (this.isProcessing) {
            return { success: 0, failed: 0 };
        }

        this.isProcessing = true;
        await this.load();

        let successCount = 0;
        let failedCount = 0;

        // Process mutations in order (FIFO)
        const mutations = [...this.queue];

        for (const mutation of mutations) {
            try {
                await executor(mutation);
                await this.dequeue(mutation.id);
                successCount++;
                this.onMutationProcessed?.(mutation, true);
            } catch (error) {
                console.warn(`Failed to process mutation ${mutation.id}:`, error);

                // Check retry count BEFORE incrementing to ensure exactly 3 attempts
                if (mutation.retryCount >= 2) {
                    console.warn(`Removing mutation ${mutation.id} after 3 failed attempts`);
                    await this.dequeue(mutation.id);
                } else {
                    await this.incrementRetry(mutation.id);
                }

                failedCount++;
                this.onMutationProcessed?.(mutation, false);
            }
        }

        this.isProcessing = false;
        return { success: successCount, failed: failedCount };
    }

    /**
     * Check if queue is currently being processed
     */
    isCurrentlyProcessing(): boolean {
        return this.isProcessing;
    }
}

// Export singleton instance
export const mutationQueue = new MutationQueue();
