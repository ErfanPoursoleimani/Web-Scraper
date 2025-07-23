import { GPUData, LaptopData, PhoneData, ProductsData, ScrapeResponse } from '@/types/scrape';
import { NextRequest, NextResponse } from 'next/server';
import puppeteer, { Browser, Page } from 'puppeteer';

// Configuration constants
const SCRAPE_CONFIG = {
  TIMEOUT: 60000, // Increased timeout
  VIEWPORT: { width: 1920, height: 1080 },
  USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  WAIT_TIME: 3000,
  MAX_RETRIES: 3,
  RETRY_DELAY: 2000
};

const PRODUCTS_CONFIG = {
  phones: {
    apple: {
      Emals: "https://emalls.ir/%D9%84%DB%8C%D8%B3%D8%AA-%D9%82%DB%8C%D9%85%D8%AA~Category~39~Search~Apple~exist~1"
    },
    samsung: {
      Emals: "https://emalls.ir/%D9%84%DB%8C%D8%B3%D8%AA-%D9%82%DB%8C%D9%85%D8%AA~Category~39~Search~Samsung~exist~1"
    },
    xiaomi: {
      Emals: "https://emalls.ir/%D9%84%DB%8C%D8%B3%D8%AA-%D9%82%DB%8C%D9%85%D8%AA~Category~39~Search~Xiaomi~exist~1"
    },
  }
};

// Utility function for delays
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Enhanced error handling with retry logic
async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = SCRAPE_CONFIG.MAX_RETRIES,
  retryDelay: number = SCRAPE_CONFIG.RETRY_DELAY
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      console.warn(`Attempt ${attempt}/${maxRetries} failed:`, error);
      
      if (attempt < maxRetries) {
        await delay(retryDelay * attempt); // Exponential backoff
      }
    }
  }
  
  throw lastError!;
}

// Optimized page setup function
async function setupPage(browser: Browser): Promise<Page> {
  const page = await browser.newPage();
  
  await page.setViewport(SCRAPE_CONFIG.VIEWPORT);
  await page.setUserAgent(SCRAPE_CONFIG.USER_AGENT);
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'fa-IR,fa;q=0.9,en;q=0.8'
  });
  
  // Optimized request interception
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const resourceType = req.resourceType();
    // Block unnecessary resources to speed up loading
    if (['stylesheet', 'font', 'image', 'media'].includes(resourceType)) {
      req.abort();
    } else {
      req.continue();
    }
  });
  
  return page;
}

// Enhanced navigation with better error handling
async function navigateToPage(page: Page, url: string): Promise<void> {
  await retryOperation(async () => {
    try {
      await page.goto(url, { 
        waitUntil: 'domcontentloaded', // Changed from networkidle2 for faster loading
        timeout: SCRAPE_CONFIG.TIMEOUT 
      });
      
      // Wait for content to load
      await delay(SCRAPE_CONFIG.WAIT_TIME);
      
      // Verify page loaded by checking for expected elements
      await page.waitForSelector('[class="product-block-parent"]', { 
        timeout: 10000 
      }).catch(() => {
        // If selector not found, still continue - might be empty results
        console.warn('Product selector not found, continuing...');
      });
      
    } catch (error) {
      throw error;
    }
  });
}

// Improved scraping function with better error handling
async function scrapeEmalsProducts(page: Page, company: string): Promise<PhoneData[]> {
  return await page.evaluate((companyName: string) => {
    const phones: PhoneData[] = [];
    
    try {
      const productCards = document.querySelectorAll('[class="product-block-parent"]');
      
      productCards.forEach((element, index) => {
        try {
          const titleElement = element.querySelector('a[class="prd-name"]') as HTMLElement;
          const priceElement = element.querySelector('span > div[class="prd-price"]') as HTMLElement;
          const imageElement = element.querySelector('img[src]') as HTMLImageElement;
          const linkElement = element.querySelector('a[href]') as HTMLAnchorElement;
          
          const title = titleElement?.textContent?.trim() || '';
          const price = priceElement?.textContent?.trim() || '';
          const image = imageElement?.src || '';
          const productUrl = linkElement?.href || '';

          if (title && title.length > 5) {
            phones.push({
              id: phones.length + 1,
              company: companyName,
              title: title,
              price: price,
              image: image || undefined,
              productUrl: productUrl || undefined,
              scrapedAt: new Date().toISOString()
            });
          }
        } catch (elementError) {
          console.warn(`Error processing product element ${index}:`, elementError);
        }
      });
    } catch (error) {
      console.error('Error in page evaluation:', error);
    }
    
    // Remove duplicates
    return phones.filter((phone, index, self) =>
      index === self.findIndex(p => p.title === phone.title)
    );
  }, company);
}

// Main scraping function for a single brand
async function scrapeBrand(browser: Browser, url: string, company: string): Promise<PhoneData[]> {
  let page: Page | null = null;
  
  try {
    page = await setupPage(browser);
    await navigateToPage(page, url);
    const results = await scrapeEmalsProducts(page, company);
    
    console.log(`Successfully scraped ${results.length} ${company} products`);
    return results;
    
  } catch (error) {
    console.error(`Error scraping ${company}:`, error);
    return []; // Return empty array instead of failing completely
  } finally {
    if (page) {
      await page.close().catch(console.warn);
    }
  }
}

export async function GET(request: NextRequest): Promise<NextResponse<ScrapeResponse>> {
  let browser: Browser | null = null;
  
  try {
    // Launch browser with optimized settings
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox', 
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    });

    // Scrape all brands concurrently for better performance
    const scrapingPromises = [
      scrapeBrand(browser, PRODUCTS_CONFIG.phones.apple.Emals, "Apple"),
      scrapeBrand(browser, PRODUCTS_CONFIG.phones.samsung.Emals, "Samsung"),
      scrapeBrand(browser, PRODUCTS_CONFIG.phones.xiaomi.Emals, "Xiaomi"), // Fixed: was using samsung URL
    ];

    const results = await Promise.allSettled(scrapingPromises);
    
    // Process results and handle any failures
    const phones: PhoneData[] = [];
    results.forEach((result, index) => {
      const brands = ['Apple', 'Samsung', 'Xiaomi'];
      if (result.status === 'fulfilled') {
        phones.push(...result.value);
      } else {
        console.error(`Failed to scrape ${brands[index]}:`, result.reason);
      }
    });

    const laptops: LaptopData[] = [];
    const GPUs: GPUData[] = [];

    const productsData: ProductsData = {
      phones,
      laptops,
      GPUs,
    };
    
    console.log(`Scraping completed. Total products: ${phones.length}`);
    
    return NextResponse.json({
      success: true,
      data: productsData,
      scrapedAt: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('Scraping failed:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Puppeteer scraping failed',
      error: error.message,
      data: {
        phones: [],
        laptops: [],
        GPUs: []
      } as ProductsData,
      scrapedAt: new Date().toISOString()
    }, { status: 500 });
    
  } finally {
    if (browser) {
      await browser.close().catch(console.warn);
    }
  }
}