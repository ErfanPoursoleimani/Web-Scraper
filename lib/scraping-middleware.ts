import { NextRequest, NextResponse } from "next/server";

type RouteHandler = (request: NextRequest) => Promise<NextResponse>;

export function withScraping(handler: RouteHandler): RouteHandler {
  return async (request: NextRequest): Promise<NextResponse> => {
    const startTime = Date.now();
    
    try {
      // Add common headers
      const headers = new Headers();
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      headers.set('Access-Control-Allow-Headers', 'Content-Type');
      
      if (request.method === 'OPTIONS') {
        return new NextResponse(null, { status: 200, headers });
      }

      const result = await handler(request);
      
      // Add timing information
      if (result.ok) {
        try {
          const body = await result.json();
          body.processingTime = Date.now() - startTime;
          return NextResponse.json(body, { headers });
        } catch {
          // If response is not JSON, return as-is
          return result;
        }
      }
      
      return result;
      
    } catch (error) {
      console.error('Scraping middleware error:', error);
      return NextResponse.json(
        { 
          error: 'Internal server error',
          processingTime: Date.now() - startTime
        },
        { status: 500 }
      );
    }
  };
}