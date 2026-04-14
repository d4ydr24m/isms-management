import { apiClient, handleApiError } from './api'

export interface CycleInfo {
  cycle: string
  releaseLabel: string | null
  releaseDate: string | null
  eol: string | boolean | null
  latest: string | null
  lts: boolean | string | null
  support: string | boolean | null
  extendedSupport: string | boolean | null
}

export interface ProductCyclesResponse {
  product: string
  cycles: CycleInfo[]
}

export interface EolLookupResponse {
  product: string
  cycle: string | null
  eol: string | boolean | null
  releaseDate: string | null
  latest: string | null
  lts: boolean | string | null
  support: string | boolean | null
}

export const eolService = {
  async searchProducts(q: string): Promise<{ products: string[]; total: number }> {
    try {
      const response = await apiClient.get<{ products: string[]; total: number }>('/eol/products', {
        params: { q },
      })
      return response.data
    } catch (error) {
      return handleApiError(error)
    }
  },

  async getProductCycles(product: string): Promise<ProductCyclesResponse> {
    try {
      const response = await apiClient.get<ProductCyclesResponse>(`/eol/products/${product}/cycles`)
      return response.data
    } catch (error) {
      return handleApiError(error)
    }
  },

  async lookupEol(product: string, version?: string): Promise<EolLookupResponse> {
    try {
      const response = await apiClient.post<EolLookupResponse>('/eol/lookup', {
        product,
        version,
      })
      return response.data
    } catch (error) {
      return handleApiError(error)
    }
  },

  async applyEolToAsset(assetId: number, eolDate: string): Promise<void> {
    try {
      await apiClient.post('/eol/apply', { assetId, eolDate })
    } catch (error) {
      return handleApiError(error)
    }
  },
}
