import { withScraping } from '@/lib/scraping-middleware';
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';

async function handleScraping(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  
  if (!url) {
    return NextResponse.json(
      { error: 'URL parameter is required' },
      { status: 400 }
    );
  }
  
  const response = await axios.get<string>(url);
  const $ = cheerio.load(response.data);
  
  return NextResponse.json({
    success: true,
    data: { 
      title: $('title').text().trim(),
      headingCount: $('h1, h2, h3, h4, h5, h6').length
    }
  });
}

export const GET = withScraping(handleScraping);