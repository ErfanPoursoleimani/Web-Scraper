import axios from "axios";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface RateLimitEntry {
  requests: number[];
}

export class ScrapingService {
  private cache = new Map<string, CacheEntry<any>>();
  private rateLimits = new Map<string, RateLimitEntry>();
  
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly RATE_LIMIT = 10; // requests per minute
  private readonly RATE_WINDOW = 60 * 1000; // 1 minute

  checkRateLimit(identifier: string): void {
    const now = Date.now();
    const entry = this.rateLimits.get(identifier) || { requests: [] };
    
    // Clean old requests
    entry.requests = entry.requests.filter(time => now - time < this.RATE_WINDOW);
    
    if (entry.requests.length >= this.RATE_LIMIT) {
      throw new Error('Rate limit exceeded');
    }
    
    entry.requests.push(now);
    this.rateLimits.set(identifier, entry);
  }

  getCachedData<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  setCachedData<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  async scrapeWithRetry(url: string, maxRetries: number = 3): Promise<string> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await axios.get<string>(url, {
          timeout: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        return response.data;
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
      }
    }
    throw new Error('Max retries exceeded');
  }
}
