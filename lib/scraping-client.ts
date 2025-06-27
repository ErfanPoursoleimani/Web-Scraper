import type { ScrapingResponse, DynamicScrapingRequest } from '@/types/scraping';

export class ScrapingClient {
  private baseUrl: string;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
  }

  async scrapeStatic(url: string): Promise<ScrapingResponse> {
    const response = await fetch(`${this.baseUrl}/api/scrape?url=${encodeURIComponent(url)}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  }

  async scrapeDynamic(request: DynamicScrapingRequest): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/scrape-dynamic`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }
}

// Usage in component
export async function useScrapingClient() {
  const client = new ScrapingClient();
  
  try {
    const result = await client.scrapeStatic('https://example.com');
    console.log('Scraped data:', result.data);
  } catch (error) {
    console.error('Scraping failed:', error);
  }
}