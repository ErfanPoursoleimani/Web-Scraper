import axios, { AxiosError } from 'axios';
import * as cheerio from 'cheerio';
import { NextRequest, NextResponse } from 'next/server';
import type { ScrapedData, ScrapingResponse, ErrorResponse, CustomSelectors } from '@/types/scraping';

export async function GET(request: NextRequest): Promise<NextResponse<ScrapingResponse | ErrorResponse>> {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url) {
      return NextResponse.json(
        { error: 'URL parameter is required' },
        { status: 400 }
      );
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL provided' },
        { status: 400 }
      );
    }

    const response = await axios.get<string>(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 15000,
      maxRedirects: 5
    });

    const $ = cheerio.load(response.data);

    const scrapedData: ScrapedData = {
      title: $('title').text().trim(),
      description: $('meta[name="description"]').attr('content')?.trim() || '',
      headings: [],
      links: [],
      images: []
    };

    // Extract headings
    $('h1, h2, h3, h4').each((index, element) => {
      const text = $(element).text().trim();
      if (text) {
        scrapedData.headings.push({
          level: element.tagName.toLowerCase(),
          text: text,
          id: $(element).attr('id') || null
        });
      }
    });

    // Extract links (limit to first 20)
    $('a[href]').slice(0, 20).each((index, element) => {
      const href = $(element).attr('href');
      const text = $(element).text().trim();
      if (href && text) {
        scrapedData.links.push({
          text: text,
          href: href.startsWith('http') ? href : new URL(href, url).href
        });
      }
    });

    // Extract images (limit to first 10)
    $('img[src]').slice(0, 10).each((index, element) => {
      const src = $(element).attr('src');
      const alt = $(element).attr('alt') || '';
      if (src) {
        scrapedData.images.push({
          src: src.startsWith('http') ? src : new URL(src, url).href,
          alt: alt.trim()
        });
      }
    });

    const result: ScrapingResponse = {
      success: true,
      url,
      data: scrapedData,
      scrapedAt: new Date().toISOString()
    };

    return NextResponse.json(result);

  } catch (error) {
    console.error('Scraping error:', error);
    
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      
      if (axiosError.code === 'ENOTFOUND' || axiosError.code === 'ECONNREFUSED') {
        return NextResponse.json(
          { error: 'Unable to reach the specified URL' },
          { status: 404 }
        );
      }
      
      if (axiosError.code === 'ETIMEDOUT') {
        return NextResponse.json(
          { error: 'Request timeout - the website took too long to respond' },
          { status: 408 }
        );
      }
    }

    return NextResponse.json(
      { 
        error: 'Failed to scrape URL', 
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json() as { url: string; selectors?: CustomSelectors };
    const { url, selectors = {} } = body;

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required in request body' },
        { status: 400 }
      );
    }

    const response = await axios.get<string>(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 15000
    });

    const $ = cheerio.load(response.data);
    const customData: Record<string, any> = {};

    // Use custom selectors if provided
    Object.entries(selectors).forEach(([key, selector]) => {
      try {
        const elements = $(selector);
        if (elements.length === 1) {
          customData[key] = elements.text().trim();
        } else if (elements.length > 1) {
          customData[key] = elements.map((i, el) => $(el).text().trim()).get();
        } else {
          customData[key] = null;
        }
      } catch (err) {
        customData[key] = { error: `Invalid selector: ${selector}` };
      }
    });

    return NextResponse.json({
      success: true,
      url,
      data: customData,
      scrapedAt: new Date().toISOString()
    });

  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to scrape with custom selectors', 
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}