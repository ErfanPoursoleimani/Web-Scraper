"use client"
import useDataStore from '@/stores/dataStore'
import { ProductsData } from '@/types/scrape';
import { useState, useMemo } from 'react';

interface Product {
  id: number;
  company: string,
  title: string;
  price: string;
  image?: string;
  productUrl?: string;
  scrapedAt: string;
}

const PriceMonitorDashboard = () => {
  const { productsData } = useDataStore();
  const [currentView, setCurrentView] = useState<'table' | 'card'>('table');
  const [sortOrder, setSortOrder] = useState('default');
  const [searchFilter, setSearchFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'phones' | 'laptops' | 'GPUs'>('all');

  // Combine all products into a single array with category information
  const allProducts = useMemo((): Product[] => {
    const products: Product[] = [];
    
    productsData.phones.forEach(phone => {
      products.push(phone);
    });

    productsData.laptops.forEach(laptop => {
      products.push(laptop);
    });

    productsData.GPUs.forEach(gpu => {
      products.push(gpu);
    });

    return products;
  }, [productsData]);

  const getFilteredAndSortedProducts = (): Product[] => {
    const searchTerm = searchFilter.toLowerCase();
    let filtered = allProducts.filter(product => {
      const matchesSearch = product.title.toLowerCase().includes(searchTerm) || product.company.toLowerCase().includes(searchTerm) /* || product.category.toLowerCase().includes(searchTerm) */;
      
      const matchesCategory = categoryFilter === 'all' /* || product.category === categoryFilter; */
      
      return matchesSearch && matchesCategory;
    });

    switch (sortOrder) {
      case 'priceAsc':
        filtered.sort((a, b) => parseFloat(a.price.replace(",", "")) - parseFloat(b.price.replace(",", "")));
        break;
      case 'priceDesc':
        filtered.sort((a, b) => parseFloat(b.price.replace(",", "")) - parseFloat(a.price.replace(",", "")));
        break;
      case 'name':
        filtered.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'company':
        filtered.sort((a, b) => a.company.localeCompare(b.company));
        break;
/*       case 'category':
        filtered.sort((a, b) => a.category.localeCompare(b.category));
        break; */
    }

    return filtered;
  };

/*   const getCategoryColor = (category: string): string => {
    switch (category) {
      case 'phones': return 'bg-blue-100 text-blue-800';
      case 'laptops': return 'bg-green-100 text-green-800';
      case 'GPUs': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }; */

/*   const getCategoryIcon = (category: string): string => {
    switch (category) {
      case 'phones': return '📱';
      case 'laptops': return '💻';
      case 'GPUs': return '🖥️';
      default: return '📦';
    }
  }; */

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const TableView = ({ products }: { products: Product[] }) => (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-gray-50">
            <th className="px-4 py-4 text-left font-semibold text-gray-700">Product</th>
            <th className="px-4 py-4 text-left font-semibold text-gray-700">Image</th>
            {/* <th className="px-4 py-4 text-left font-semibold text-gray-700">Category</th> */}
            <th className="px-4 py-4 text-left font-semibold text-gray-700">Company</th>
            <th className="px-4 py-4 text-left font-semibold text-gray-700">Price</th>
            <th className="px-4 py-4 text-left font-semibold text-gray-700">Last Updated</th>
            <th className="px-4 py-4 text-left font-semibold text-gray-700">Actions</th>
          </tr>
        </thead>
        <tbody>
          {products.map(product => (
            <tr key={`${product.title}`} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="px-4 py-4">
                <div className="font-semibold text-gray-900">{product.title}</div>
                <div className="text-xs text-gray-500 mt-1">
                  ID: {product.id}
                </div>
              </td>
              <td className="px-4 py-4">
                {product.image ? (
                  <img 
                    src={product.image} 
                    alt={product.title} 
                    className="w-10 h-10 object-cover rounded-lg border border-gray-200"
                  />
                ) : (
                  <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center text-gray-500 text-xs">
                    No Image
                  </div>
                )}
              </td>
              <td className="px-4 py-4">
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium `}>
                  {/* <span>{getCategoryIcon(product.category)}</span>
                  {product.category} ${getCategoryColor(product.category)}*/}
                </span>
              </td>
              <td className="px-4 py-4">
                <div className="font-medium text-gray-900">{product.company}</div>
              </td>
              <td className="px-4 py-4">
                <span className="text-green-600 font-semibold text-lg">
                  {product.price}
                </span>
              </td>
              <td className="px-4 py-4">
                <div className="text-sm text-gray-600">
                  {formatDate(product.scrapedAt)}
                </div>
              </td>
              <td className="px-4 py-4">
                {product.productUrl ? (
                  <a 
                    href={product.productUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    View →
                  </a>
                ) : (
                  <span className="text-gray-400 text-sm">No URL</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const CardView = ({ products }: { products: Product[] }) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
      {products.map(product => (
        <div key={`${product.title}`} className="bg-white rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between mb-3">
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium `}>
              {/* <span>{getCategoryIcon(product.category)}</span>
              {product.category} ${getCategoryColor(product.category)}*/}
            </span>
            <div className="text-xs text-gray-500">ID: {product.id}</div>
          </div>
          
          {product.image && (
            <div className="mb-3">
              <img 
                src={product.image} 
                alt={product.title} 
                className="w-full h-32 object-cover rounded-lg border border-gray-200"
              />
            </div>
          )}
          
          <div className="font-semibold text-gray-900 mb-2 line-clamp-2">{product.title}</div>
          
          <div className="mb-2">
            <span className="text-green-600 font-semibold text-lg">
              {product.price}
            </span>
          </div>
          
          <div className="text-sm text-gray-600 mb-2">
            <div className="font-medium">{product.company}</div>
          </div>
          
          <div className="text-xs text-gray-500 mb-3">
            Updated: {formatDate(product.scrapedAt)}
          </div>
          
          {product.productUrl ? (
            <a 
              href={product.productUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              View Product →
            </a>
          ) : (
            <span className="text-gray-400 text-sm">No URL available</span>
          )}
        </div>
      ))}
    </div>
  );

  const filteredProducts = getFilteredAndSortedProducts();
  const hasProducts = filteredProducts.length > 0;

  // Statistics
  const totalProducts = allProducts.length;
  const phoneCount = productsData.phones.length;
  const laptopCount = productsData.laptops.length;
  const gpuCount = productsData.GPUs.length;

  return (
    <div className="min-h-screen bg-gray-50 p-5">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-semibold text-gray-900 text-center mb-8">
          Price Monitor Dashboard
        </h1>

        {/* Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-4 rounded-lg shadow-sm text-center">
            <div className="text-2xl font-bold text-blue-600">{totalProducts}</div>
            <div className="text-sm text-gray-600">Total Products</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm text-center">
            <div className="text-2xl font-bold text-blue-600">{phoneCount}</div>
            <div className="text-sm text-gray-600">📱 Phones</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm text-center">
            <div className="text-2xl font-bold text-green-600">{laptopCount}</div>
            <div className="text-sm text-gray-600">💻 Laptops</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm text-center">
            <div className="text-2xl font-bold text-purple-600">{gpuCount}</div>
            <div className="text-sm text-gray-600">🖥️ GPUs</div>
          </div>
        </div>

        {/* Controls Section */}
        <div className="bg-white p-5 rounded-xl shadow-sm mb-8">
          <div className="flex flex-wrap gap-3 items-center">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as any)}
              className="min-w-[120px] px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Categories</option>
              <option value="phones">📱 Phones</option>
              <option value="laptops">💻 Laptops</option>
              <option value="GPUs">🖥️ GPUs</option>
            </select>
            
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="min-w-[150px] px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="default">Sort by: Default</option>
              <option value="priceAsc">Price: Low to High</option>
              <option value="priceDesc">Price: High to Low</option>
              <option value="name">Name A-Z</option>
              <option value="company">Company A-Z</option>
              <option value="category">Category</option>
            </select>
            
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search products, companies, categories..."
              className="flex-1 min-w-[250px] px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            
            <div className="text-sm text-gray-600">
              Showing {filteredProducts.length} of {totalProducts}
            </div>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex gap-2 mb-5">
          <button
            onClick={() => setCurrentView('table')}
            className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
              currentView === 'table'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'
            }`}
          >
            Table View
          </button>
          <button
            onClick={() => setCurrentView('card')}
            className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
              currentView === 'card'
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'
            }`}
          >
            Card View
          </button>
        </div>

        {/* Products Display */}
        {hasProducts ? (
          currentView === 'table' ? (
            <TableView products={filteredProducts} />
          ) : (
            <CardView products={filteredProducts} />
          )
        ) : (
          <div className="bg-white rounded-xl shadow-sm p-16 text-center">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {searchFilter || categoryFilter !== 'all' ? 'No products match your filters' : 'No products available'}
            </h3>
            <p className="text-gray-600">
              {searchFilter || categoryFilter !== 'all' 
                ? 'Try adjusting your search or filter criteria.' 
                : 'Products will appear here when data is available from your store.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PriceMonitorDashboard;