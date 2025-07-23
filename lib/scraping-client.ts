import type { ScrapingResponse, DynamicScrapingRequest } from '@/types/scraping';
import axios from 'axios';

export class ScrapingClient {
  private baseUrl: string;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
  }

  async scrapeStatic(url: string): Promise<ScrapingResponse> {
    const response = await fetch(`${this.baseUrl}/api/scrape?url=${url}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  }

  async scrapeDynamic(request: DynamicScrapingRequest): Promise<any> {
    const response = await axios.post(`${this.baseUrl}/api/scrape-dynamic`, request);

    if (response.status !== 200) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.data;
  }
}
export default ScrapingClient;