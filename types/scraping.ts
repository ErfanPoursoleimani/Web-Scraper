export interface ScrapedData {
  title: string;
  description: string;
  headings: Heading[];
  links: Link[];
  images: Image[];
}

export interface Heading {
  level: string;
  text: string;
  id: string | null;
}

export interface Link {
  text: string;
  href: string;
}

export interface Image {
  src: string;
  alt: string;
}

export interface ScrapingResponse {
  success: boolean;
  url: string;
  data: ScrapedData;
  scrapedAt: string;
  cached?: boolean;
  processingTime?: number;
}

export interface CustomSelectors {
  [key: string]: string;
}

export interface DynamicScrapingRequest {
  url: string;
  waitForSelector?: string;
  waitTime?: number;
  viewport?: { width: number; height: number };
  screenshots?: boolean;
}

export interface DynamicScrapedData {
  title: string;
  url: string;
  content: {
    textContent: string[];
    links: Link[];
    dataAttributes: DataAttribute[];
  };
  metadata: {
    loadTime: number;
    userAgent: string;
  };
}

export interface DataAttribute {
  element: string;
  attributes: Record<string, string>;
}

export interface ErrorResponse {
  error: string;
  message?: string;
  stack?: string;
}