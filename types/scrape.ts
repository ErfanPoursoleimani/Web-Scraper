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
  company: laptopModel,
  title: string;
  price: string;
  image?: string;
  productUrl?: string;
  scrapedAt: string;
}
export enum laptopModel {
  ASUS,
  LENOVO
}

export interface GPUData {
  id: number;
  company: GPUModel,
  title: string;
  price: string;
  image?: string;
  productUrl?: string;
  scrapedAt: string;
}
export enum GPUModel {
  INTEL,
  AMD
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