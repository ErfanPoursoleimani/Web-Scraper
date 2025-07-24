export interface PhoneData {
  id: number;
  company: string,
  title: string;
  price: string;
  image?: string;
  productUrl?: string;
  scrapedAt: string;
}

export interface LaptopData {
  id: number;
  company: string,
  title: string;
  price: string;
  image?: string;
  productUrl?: string;
  scrapedAt: string;
}

export interface GPUData {
  id: number;
  company: string,
  title: string;
  price: string;
  image?: string;
  productUrl?: string;
  scrapedAt: string;
}

export interface ProductsData {
  phones: PhoneData[],
  laptops: LaptopData[],
  GPUs: GPUData[],
}

export interface ScrapeResponse {
  success: boolean;
  data: ProductsData;
  scrapedAt: string;
  message?: string;
  error?: string;
}