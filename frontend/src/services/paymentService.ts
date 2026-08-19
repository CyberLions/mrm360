import { apiService } from './api'
import type { Payment, PaymentStats, UserPaymentStatus } from '@/types/api'

export interface CreatePaymentData {
  userId: string
  amount: number
  paymentType: 'SEMESTER' | 'YEARLY'
  paymentMethod?: string
  transactionId?: string
  semester?: string
}

export interface UpdatePaymentData {
  status?: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED'
  transactionId?: string
  reason?: string
}

export class PaymentService {
  private baseUrl = '/payments'

  /**
   * Get all payments with optional filters
   */
  async getPayments(filters?: {
    userId?: string
    status?: string
    paymentType?: string
    semester?: string
  }): Promise<{ payments: Payment[] }> {
    const params = new URLSearchParams()
    
    if (filters?.userId) params.append('userId', filters.userId)
    if (filters?.status) params.append('status', filters.status)
    if (filters?.paymentType) params.append('paymentType', filters.paymentType)
    if (filters?.semester) params.append('semester', filters.semester)

    const queryString = params.toString()
    const url = queryString ? `${this.baseUrl}?${queryString}` : this.baseUrl

    return apiService.api.get(url).then(response => response.data)
  }

  /**
   * Get payment by ID
   */
  async getPayment(paymentId: string): Promise<{ payment: Payment }> {
    return apiService.api.get(`${this.baseUrl}/${paymentId}`).then(response => response.data)
  }

  /**
   * Create a new payment
   */
  async createPayment(data: CreatePaymentData): Promise<{ payment: Payment }> {
    return apiService.api.post(this.baseUrl, data).then(response => response.data)
  }

  /**
   * Update a payment
   */
  async updatePayment(paymentId: string, data: UpdatePaymentData): Promise<{ payment: Payment }> {
    console.log('Updating payment:', paymentId, 'with data:', data)
    try {
      const response = await apiService.api.put(`${this.baseUrl}/${paymentId}`, data)
      console.log('Payment update response:', response.data)
      return response.data
    } catch (error) {
      console.error('Payment update error:', error)
      throw error
    }
  }

  /**
   * Delete a payment
   */
  async deletePayment(paymentId: string): Promise<{ message: string }> {
    return apiService.api.delete(`${this.baseUrl}/${paymentId}`).then(response => response.data)
  }

  /**
   * Get user's payment status
   */
  async getUserPaymentStatus(userId: string): Promise<UserPaymentStatus> {
    const response = await apiService.api.get(`${this.baseUrl}?userId=${userId}`)
    const data = response.data
    return {
      isPaid: data.isPaid,
      payments: data.payments,
      activePayments: data.activePayments,
      expiredPayments: data.expiredPayments,
      nextExpiration: data.nextExpiration
    }
  }

  /**
   * Get payment statistics
   */
  async getPaymentStats(): Promise<{ stats: PaymentStats }> {
    return apiService.api.get(`${this.baseUrl}/stats`).then(response => response.data)
  }

  /**
   * Check for expired payments
   */
  async checkExpiredPayments(immediate = false): Promise<{
    message: string
    jobId?: string
    results?: {
      usersProcessed: number
      details: Array<{
        userId: string
        email: string
        expiredPayments: number
        newPaidStatus: boolean
      }>
    }
  }> {
    return apiService.api.post(`${this.baseUrl}/check-expired`, { immediate }).then(response => response.data)
  }
}
