import puppeteer, { Browser, Page } from 'puppeteer';
import { NextRequest, NextResponse } from 'next/server';
import type { DynamicScrapingRequest, DynamicScrapedData } from '@/types/scraping';

interface DynamicScrapingResponse {
  success: boolean;
  data: DynamicScrapedData;
  screenshot?: string;
  scrapedAt: string;
}

interface ErrorResponse {
  error: string;
  message?: string;
  stack?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<DynamicScrapingResponse | ErrorResponse>> {
  let browser: Browser | null = null;
  
  try {
    const body = await request.json() as DynamicScrapingRequest;
    const { 
      url, 
      waitForSelector, 
      waitTime = 2000,
      viewport = { width: 1920, height: 1080 },
      screenshots = false 
    } = body;

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

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
        '--single-process',
        '--disable-gpu'
      ]
    });

    const page: Page = await browser.newPage();
    
    // Set viewport and user agent
    await page.setViewport(viewport);
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Block unnecessary resources for faster loading
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      if (['stylesheet', 'font', 'image'].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    // Navigate to page
    await page.goto(url, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });

    // Wait for specific selector if provided
    if (waitForSelector) {
      await page.waitForSelector(waitForSelector, { timeout: 10000 });
    }

    // Additional wait time for JavaScript execution
    await new Promise(res => setTimeout(res, waitTime));

    // Extract data
    const scrapedData = await page.evaluate((): DynamicScrapedData => {
      const data: DynamicScrapedData = {
        title: document.title,
        url: window.location.href,
        content: {
          textContent: [],
          links: [],
          dataAttributes: []
        },
        metadata: {
          loadTime: Date.now(),
          userAgent: navigator.userAgent
        }
      };

      // Extract text content
      const textElements = document.querySelectorAll('p, span, div, h1, h2, h3, h4, h5, h6');
      data.content.textContent = Array.from(textElements)
        .map(el => el.textContent?.trim())
        .filter((text): text is string => Boolean(text && text.length > 10))
        .slice(0, 50);

      // Extract links
      data.content.links = Array.from(document.querySelectorAll('a[href]'))
        .map(a => {
          const anchor = a as HTMLAnchorElement;
          return {
            text: anchor.textContent?.trim() || '',
            href: anchor.href
          };
        })
        .filter(link => link.text && link.href)
        .slice(0, 20);

      // Extract any data attributes
      const dataElements = document.querySelectorAll('[data-*]');
      data.content.dataAttributes = Array.from(dataElements)
        .map(el => {
          const attrs: Record<string, string> = {};
          Array.from(el.attributes).forEach(attr => {
            if (attr.name.startsWith('data-')) {
              attrs[attr.name] = attr.value;
            }
          });
          return { 
            element: el.tagName.toLowerCase(), 
            attributes: attrs 
          };
        })
        .slice(0, 10);

      return data;
    });

    // Take screenshot if requested
    let screenshotData: string | undefined = undefined;
    if (screenshots) {
      const screenshot = await page.screenshot({ 
        type: 'png',
        fullPage: false,
        encoding: 'base64'
      });
      screenshotData = `data:image/png;base64,${screenshot}`;
    }

    const result: DynamicScrapingResponse = {
      success: true,
      data: scrapedData,
      screenshot: screenshotData,
      scrapedAt: new Date().toISOString()
    };

    return NextResponse.json(result);

  } catch (error) {
    console.error('Puppeteer scraping error:', error);
    return NextResponse.json(
      { 
        error: 'Dynamic scraping failed', 
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: process.env.NODE_ENV === 'development' ? (error as Error).stack : undefined
      },
      { status: 500 }
    );
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}