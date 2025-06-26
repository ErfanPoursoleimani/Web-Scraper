import { NextRequest, NextResponse } from 'next/server';
import { ScrapingService } from '@/lib/scraping-utils';
import * as cheerio from 'cheerio';
import { ScrapingResponse, ErrorResponse } from '@/types/scraping';

const scrapingService = new ScrapingService();

interface CachedScrapingResponse extends ScrapingResponse {
  cached: boolean;
  cacheHit?: boolean;
}

export async function GET(request: NextRequest): Promise<NextResponse<CachedScrapingResponse | ErrorResponse>> {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');
    const forceRefresh = searchParams.get('refresh') === 'true';

    if (!url) {
      return NextResponse.json(
        { error: 'URL parameter is required' },
        { status: 400 }
      );
    }

    // Get client identifier for rate limiting
    const forwardedFor = request.headers.get('x-forwarded-for');
    const clientIP = forwardedFor ? forwardedFor.split(',')[0] : 'unknown';
    
    // Check rate limit
    try {
      scrapingService.checkRateLimit(clientIP);
    } catch (error) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { 
          status: 429, 
          headers: { 'Retry-After': '60' } 
        }
      );
    }

    // Check cache first
    const cacheKey = `scrape:${url}`;
    if (!forceRefresh) {
      const cachedData = scrapingService.getCachedData<CachedScrapingResponse>(cacheKey);
      if (cachedData) {
        return NextResponse.json({
          ...cachedData,
          cached: true,
          cacheHit: true
        });
      }
    }

    // Perform scraping
    const html = await scrapingService.scrapeWithRetry(url);
    const $ = cheerio.load(html);

    const scrapedData: CachedScrapingResponse = {
      success: true,
      url,
      data: {
        title: $('title').text().trim(),
        description: $('meta[name="description"]').attr('content')?.trim() || '',
        headings: $('h1, h2, h3').map((i, el) => ({
          level: el.tagName.toLowerCase(),
          text: $(el).text().trim(),
          id: $(el).attr('id') || null
        })).get(),
        links: [],
        images: []
      },
      scrapedAt: new Date().toISOString(),
      cached: false
    };

    // Cache the result
    scrapingService.setCachedData(cacheKey, scrapedData);

    return NextResponse.json(scrapedData);

  } catch (error) {
    console.error('Cached scraping error:', error);
    return NextResponse.json(
      { 
        error: 'Scraping failed', 
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
