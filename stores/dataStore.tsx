
import axios from 'axios';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { ProductsData } from '@/types/scrape';


interface DataStore {
    // State
    productsData: ProductsData;
    error: string;
    loading: boolean;
    
    // Actions
    setProductsData: (ProductsData: ProductsData) => void;
    setError: (error: string) => void;
    setLoading: (loading: boolean) => void;

    
    // API Actions
    fetchProductsData: () => Promise<void>;

    
    // Utility Actions
    initializeStore: () => Promise<void>;
    clearError: () => void;
}

// SSR-safe cookie manager
const cookieManager = {
    get: (name: string) => {
        if (typeof window === 'undefined') return null;
        try {
            const cookies = document.cookie.split(';');
            for (let cookie of cookies) {
                const [key, value] = cookie.trim().split('=');
                if (key === name) return decodeURIComponent(value);
            }
            return null;
        } catch (error) {
            console.error('Error reading cookie:', error);
            return null;
        }
    },
    delete: (name: string, path: string = '/', domain?: string) => {
        if (typeof window === 'undefined') return;
        try {
            // Set the cookie with an expired date to delete it
            let cookieString = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${path};`;
            
            // Add domain if specified
            if (domain) {
                cookieString += ` domain=${domain};`;
            }
            
            document.cookie = cookieString;
        } catch (error) {
            console.error('Error deleting cookie:', error);
        }
    },
};

// Create a storage adapter for Zustand that handles SSR
const createSSRStorage = () => {
    return {
        getItem: (name: string): string | null => {
            if (typeof window === 'undefined') return null;
            try {
                return localStorage.getItem(name);
            } catch (error) {
                console.error('Error reading from localStorage:', error);
                return cookieManager.get(name);
            }
        },
        setItem: (name: string, value: string): void => {
            if (typeof window === 'undefined') return;
            try {
                localStorage.setItem(name, value);
            } catch (error) {
                console.error('Error writing to localStorage:', error);
            }
        },
        removeItem: (name: string): void => {
            if (typeof window === 'undefined') return;
            try {
                localStorage.removeItem(name);
            } catch (error) {
                console.error('Error removing from localStorage:', error);
            }
        },
    };
};

export const useDataStore = create<DataStore>()(
    persist(
        (set, get) => ({
            // Initial State
            productsData: {} as ProductsData,

            error: '',
            loading: false,

            // Basic Setters
            setProductsData: (productsData: ProductsData) => set({ productsData }),
            setError: (error) => set({ error }),
            setLoading: (loading) => set({ loading }),
            

            fetchProductsData: async () => {
                try {
                    set({ loading: true });
                    const { data: { data } } = await axios.get(`/api/scrape`);
                    set({ productsData: data, loading: false });
                } catch (err) {
                    set({ error: err as string, loading: false });
                }
            },

            

            // Initialize Store (replaces your useEffect logic)
            initializeStore: async () => {
                
                // Fetch all data in parallel
                const promises = [
                    get().fetchProductsData(),
                ];

                try {
                    await Promise.all(promises);
                } catch (error) {
                    console.error('Error initializing store:', error);
                    set({ error: 'Failed to initialize store', loading: false });
                }
            },

            // Utility Actions
            clearError: () => set({ error: '' }),
        }),
        {
            name: 'data-store',
            storage: createJSONStorage(() => createSSRStorage()),
            partialize: (state) => ({
                productsData: state.productsData
            }),
            // Skip hydration to avoid SSR issues
            skipHydration: true,
        }
    )
);

// Export individual selectors for better performance
export const selectProductsData = (state: DataStore) => state.productsData;

export default useDataStore;