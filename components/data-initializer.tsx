'use client'
import { useEffect, useState } from 'react';
import { useDataStore } from '../stores/dataStore';

interface DataInitializerProps {
    children: React.ReactNode;
}

export const DataInitializer: React.FC<DataInitializerProps> = ({ 
    children, 
}) => {
    const [isHydrated, setIsHydrated] = useState(false);
    const initializeStore = useDataStore((state) => state.initializeStore);

    useEffect(() => {
        const hydrate = async () => {
            // Rehydrate the persisted state first
            useDataStore.persist.rehydrate();
            
            // Then initialize the store with fresh data
            await initializeStore();
            
            setIsHydrated(true);
        };

        hydrate();
    }, [initializeStore]);

    // Show loading state during hydration
    if (!isHydrated) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
            </div>
        );
    }

    return (
        <>
            {children}
        </>
    );
};