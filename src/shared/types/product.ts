export interface Product {
  id: string
  name: string
  weightGrams: number
  filamentType: string
  costPrice: number
  salePrice: number
  sold: boolean
  createdAt: number
  updatedAt: number
}

export interface ProductFormData {
  name: string
  weightGrams: number
  filamentType: string
  costPrice: number
  salePrice: number
}
