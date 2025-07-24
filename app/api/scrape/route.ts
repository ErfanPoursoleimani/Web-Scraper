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
  RETRY_DELAY: 2000,
  LAZY_LOADING: {
    MAX_SCROLL_ATTEMPTS: 15,
    SCROLL_DELAY: 2000,
    STABILITY_THRESHOLD: 3,
    INTERSECTION_THRESHOLD: 0.1
  }
};

const PRODUCTS_CONFIG = {
  phones: {
    apple: {
      Emals: "https://emalls.ir/%D9%84%DB%8C%D8%B3%D8%AA-%D9%82%DB%8C%D9%85%D8%AA~Category~39~Search~Apple~o~pd~exist~1",
      Digikala: "https://www.digikala.com/search/category-mobile-phone/apple/?has_selling_stock=1&sort=21"
    },
    samsung: {
      Emals: "https://emalls.ir/%D9%84%DB%8C%D8%B3%D8%AA-%D9%82%DB%8C%D9%85%D8%AA~Category~39~Search~Samsung~o~pd~exist~1",
      Digikala: "https://www.digikala.com/search/category-mobile-phone/samsung/?has_selling_stock=1&sort=21"
    },
    xiaomi: {
      Emals: "https://emalls.ir/%D9%84%DB%8C%D8%B3%D8%AA-%D9%82%DB%8C%D9%85%D8%AA~Category~39~Search~Xiaomi~o~pd~exist~1",
      Digikala: "https://www.digikala.com/search/category-mobile-phone/xiaomi/?has_selling_stock=1&sort=21"
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

// Enhanced navigation with lazy loading handling
async function navigateToPage(page: Page, url: string): Promise<void> {
  await retryOperation(async () => {
    try {
      await page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: SCRAPE_CONFIG.TIMEOUT 
      });
      
      // Handle lazy loading by scrolling and waiting for content
      await handleLazyLoading(page);
      
    } catch (error) {
      throw error;
    }
  });
}

// Comprehensive lazy loading handler
async function handleLazyLoading(page: Page): Promise<void> {
  try {
    // Method 1: Wait for initial products to load
    await page.waitForSelector('[class="product-block-parent"]', { 
      timeout: 15000 
    }).catch(() => {
      console.warn('Initial products not found - might be empty results');
    });

    // Detect the pagination/loading pattern
    const pattern = await detectPaginationPattern(page);
    console.log(pattern)
    console.log(`Detected loading pattern: ${pattern}`);

    let previousCount = 0;
    let stableCount = 0;
    const maxScrollAttempts = SCRAPE_CONFIG.LAZY_LOADING.MAX_SCROLL_ATTEMPTS;
    const stabilityThreshold = SCRAPE_CONFIG.LAZY_LOADING.STABILITY_THRESHOLD;
    
    for (let i = 0; i < maxScrollAttempts; i++) {
        // Get current product count
        const currentCount = await page.evaluate(() => {
            return document.querySelectorAll('[class="product-block-parent"]').length;
        });
        
        console.log(`Scroll attempt ${i + 1}: Found ${currentCount} products`);
        
      // Check if we found new products
      if (currentCount === previousCount) {
        stableCount++;
        if (stableCount >= stabilityThreshold) {
          console.log('Product count stable, stopping scroll');
          break;
        }
      } else {
        stableCount = 0; // Reset stability counter
      }

      previousCount = currentCount;

      // Handle different loading patterns
      if (pattern === 'button') {
        const clicked = await clickLoadMoreButton(page);
        if (!clicked) {
          // If no button found, try scrolling
          await autoScroll(page);
        }
      } else {
        // For infinite scroll or unknown patterns, use scrolling
        await autoScroll(page);
      }

      // Wait for content to load
      await delay(SCRAPE_CONFIG.LAZY_LOADING.SCROLL_DELAY);

      // Wait for any lazy-loaded images
      await waitForLazyImages(page);

      // Check for loading indicators
      await waitForLoadingToComplete(page);
    }

    // Final wait for any remaining lazy content
    await delay(2000);

    const finalCount = await page.evaluate(() => {
      return document.querySelectorAll('[class="product-block-parent"]').length;
    });

    console.log(`Lazy loading complete. Final product count: ${finalCount}`);

  } catch (error) {
    console.warn('Error during lazy loading handling:', error);
    // Continue execution even if lazy loading fails
  }
}

// Helper function to click load more buttons
async function clickLoadMoreButton(page: Page): Promise<boolean> {
  try {
    const buttonSelectors = [
      'button:contains("بیشتر")',
      'button:contains("Load More")',
      '.load-more',
      '.show-more',
      '[data-load-more]',
      'button[class*="load"]',
      'a[class*="more"]'
    ];

    for (const selector of buttonSelectors) {
      const button = await page.$(selector);
      if (button) {
        const isVisible = await button.isIntersectingViewport();
        if (isVisible) {
          console.log(`Clicking load more button: ${selector}`);
          await button.click();
          await delay(3000); // Wait for new content
          return true;
        }
      }
    }
    return false;
  } catch (error) {
    console.warn('Error clicking load more button:', error);
    return false;
  }
}

// Wait for loading indicators to disappear
async function waitForLoadingToComplete(page: Page): Promise<void> {
  const loadingSelectors = [
    '.loading',
    '.spinner',
    '.load-indicator',
    '[data-loading]',
    '.lazy-loading',
    '.skeleton'
  ];

  for (const selector of loadingSelectors) {
    try {
      const hasLoader = await page.$(selector);
      if (hasLoader) {
        console.log(`Waiting for loader to disappear: ${selector}`);
        await page.waitForSelector(selector, { 
          hidden: true, 
          timeout: 10000 
        }).catch(() => {
          console.warn(`Loader ${selector} did not disappear in time`);
        });
      }
    } catch (error) {
      // Continue if selector fails
    }
  }
}

// Smooth auto-scroll function
async function autoScroll(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let totalHeight = 0;
      const distance = 300; // Scroll distance per step
      const delay = 100; // Delay between scrolls
      
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, delay);
    });
  });
}

// Advanced lazy loading detection and handling
async function waitForLazyImages(page: Page): Promise<void> {
  try {
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        const images: HTMLImageElement[] = Array.from(document.querySelectorAll('img[data-src], img[data-lazy-src], img[loading="lazy"]'));
        
        if (images.length === 0) {
          resolve();
          return;
        }

        let loadedCount = 0;
        const totalImages = images.length;

        const checkAllLoaded = () => {
          if (loadedCount >= totalImages) {
            resolve();
          }
        };

        images.forEach((img: HTMLImageElement) => {
          if (img.complete || img.src) {
            loadedCount++;
          } else {
            img.onload = () => {
              loadedCount++;
              checkAllLoaded();
            };
            img.onerror = () => {
              loadedCount++;
              checkAllLoaded();
            };
          }
        });

        // Timeout after 10 seconds
        setTimeout(() => {
          console.warn('Lazy image loading timeout');
          resolve();
        }, 10000);

        checkAllLoaded();
      });
    });
  } catch (error) {
    console.warn('Error waiting for lazy images:', error);
  }
}

// Detect pagination or infinite scroll patterns
async function detectPaginationPattern(page: Page): Promise<'infinite' | 'button' | 'pagination' | 'none'> {
  return await page.evaluate(() => {
    // Check for infinite scroll indicators
    const infiniteScrollSelectors = [
      '[data-infinite-scroll]',
      '.infinite-scroll',
      '.endless-scroll'
    ];

    for (const selector of infiniteScrollSelectors) {
      if (document.querySelector(selector)) {
        return 'infinite';
      }
    }

    // Check for load more buttons
    const loadMoreSelectors = [
      'button:contains("بیشتر")',
      'button:contains("Load More")',
      '.load-more',
      '.show-more',
      '[data-load-more]'
    ];

    for (const selector of loadMoreSelectors) {
      if (document.querySelector(selector)) {
        return 'button';
      }
    }

    // Check for pagination
    const paginationSelectors = [
      '.pagination',
      '.pager',
      '[data-pagination]',
      'nav[aria-label*="pagination"]'
    ];

    for (const selector of paginationSelectors) {
      if (document.querySelector(selector)) {
        return 'pagination';
      }
    }

    return 'none';
  });
}

// Improved scraping function with lazy loading awareness
async function scrapeEmalsProducts(page: Page, company: string): Promise<PhoneData[]> {
  // Wait a bit more to ensure all lazy-loaded content is ready
  await delay(1000);
  
  return await page.evaluate((companyName: string) => {
    const phones: PhoneData[] = [];
    
    try {
      // Get all product cards (including lazy-loaded ones)
      const productCards = document.querySelectorAll('[class="product-block-parent"]');
      console.log(`Processing ${productCards.length} product cards for ${companyName}`);
      
      productCards.forEach((element, index) => {
        try {
          const titleElement = element.querySelector('a[class="prd-name"]') as HTMLElement;
          const priceElement = element.querySelector('span > div[class="prd-price"]') as HTMLElement;
          const imageElement = element.querySelector('img[src]') as HTMLImageElement;
          const linkElement = element.querySelector('a[href]') as HTMLAnchorElement;
          
          const title = titleElement?.textContent?.trim() || '';
          const price = priceElement?.textContent?.trim() || '';
          
          // Handle lazy-loaded images
          let image = imageElement?.src || '';
          if (!image || image.includes('data:image') || image.includes('placeholder')) {
            // Try data-src for lazy-loaded images
            image = imageElement?.getAttribute('data-src') || 
                   imageElement?.getAttribute('data-lazy-src') || 
                   imageElement?.getAttribute('data-original') || '';
          }
          
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

async function scrapeDigikalaProducts(page: Page, company: string): Promise<PhoneData[]> {
  // Wait a bit more to ensure all lazy-loaded content is ready
  await delay(1000);
  
  return await page.evaluate((companyName: string) => {
    const phones: PhoneData[] = [];
    
    try {
      // Get all product cards (including lazy-loaded ones)
      const productCards = document.querySelectorAll('a[class="styles_VerticalProductCard--hover__ud7aD"]');
      console.log(`Processing ${productCards.length} product cards for ${companyName}`);
      
      productCards.forEach((element, index) => {
        try {
          const titleElement = element.querySelector('h3[class="styles_VerticalProductCard__productTitle__6zjjN"]') as HTMLElement;
          const priceElement = element.querySelector('span[class="price-final"]') as HTMLElement;
          const imageElement = element.querySelector('img[src]') as HTMLImageElement;
          const linkElement = element as HTMLAnchorElement;
          
          const title = titleElement?.textContent?.trim() || '';
          const price = priceElement?.textContent?.trim() || '';
          
          // Handle lazy-loaded images
          let image = imageElement?.src || '';
          if (!image || image.includes('data:image') || image.includes('placeholder')) {
            // Try data-src for lazy-loaded images
            image = imageElement?.getAttribute('data-src') || 
                   imageElement?.getAttribute('data-lazy-src') || 
                   imageElement?.getAttribute('data-original') || '';
          }
          
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
    const results = (await scrapeEmalsProducts(page, company));
    
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
      scrapeBrand(browser, PRODUCTS_CONFIG.phones.apple.Digikala, "Apple"),
      scrapeBrand(browser, PRODUCTS_CONFIG.phones.samsung.Emals, "Samsung"),
      scrapeBrand(browser, PRODUCTS_CONFIG.phones.samsung.Digikala, "Samsung"),
      scrapeBrand(browser, PRODUCTS_CONFIG.phones.xiaomi.Emals, "Xiaomi"),
      scrapeBrand(browser, PRODUCTS_CONFIG.phones.xiaomi.Digikala, "Xiaomi"), 
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