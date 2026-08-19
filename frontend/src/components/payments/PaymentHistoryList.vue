<template>
  <section class="bg-gray-800 rounded-lg border border-gray-700 shadow">
    <div class="px-4 py-5 sm:p-6">
      <div class="flex items-center justify-between gap-4 mb-4">
        <div>
          <h3 class="text-lg font-medium text-gray-100">Payment History</h3>
          <p class="mt-1 text-sm text-gray-400">All current and past membership payments.</p>
        </div>
        <span v-if="!loading" class="text-xs text-gray-400">
          {{ payments.length }} {{ payments.length === 1 ? 'payment' : 'payments' }}
        </span>
      </div>

      <div v-if="loading" class="py-8 text-center text-sm text-gray-400">
        Loading payment history...
      </div>
      <div v-else-if="error" class="rounded-lg border border-red-800 bg-red-900/30 p-4 text-sm text-red-200">
        {{ error }}
      </div>
      <div v-else-if="payments.length === 0" class="rounded-lg bg-gray-700/60 py-8 text-center text-sm text-gray-400">
        No payment history yet.
      </div>
      <ul v-else class="divide-y divide-gray-700 rounded-lg border border-gray-700 overflow-hidden">
        <li v-for="payment in payments" :key="payment.id" class="bg-gray-750 px-4 py-4">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div class="flex flex-wrap items-center gap-2">
                <span class="font-medium text-gray-100">{{ formatMoney(payment.amount) }}</span>
                <span class="text-sm text-gray-300">{{ formatLabel(payment.paymentType) }}</span>
                <span v-if="payment.semester" class="rounded bg-gray-700 px-2 py-0.5 text-xs text-gray-300">
                  {{ formatLabel(payment.semester) }}
                </span>
              </div>
              <p class="mt-1 text-xs text-gray-400">
                {{ payment.paidAt ? `Paid ${formatDate(payment.paidAt)}` : `Created ${formatDate(payment.createdAt)}` }}
                <span aria-hidden="true"> · </span>
                Expires {{ formatDate(payment.expiresAt, true) }}
              </p>
              <p v-if="payment.paymentMethod" class="mt-1 text-xs text-gray-500">
                Method: {{ formatLabel(payment.paymentMethod) }}
              </p>
            </div>
            <span :class="statusClass(payment)" class="self-start rounded-full px-2.5 py-1 text-xs font-medium sm:self-center">
              {{ displayStatus(payment) }}
            </span>
          </div>
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { PaymentService } from '@/services/paymentService'
import type { Payment } from '@/types/api'

const props = defineProps<{ userId: string }>()
const paymentService = new PaymentService()
const payments = ref<Payment[]>([])
const loading = ref(false)
const error = ref('')

const loadPayments = async () => {
  if (!props.userId) return
  loading.value = true
  error.value = ''
  try {
    const result = await paymentService.getUserPaymentStatus(props.userId)
    payments.value = [...(result.payments || [])].sort(
      (a, b) => new Date(b.paidAt || b.createdAt).getTime() - new Date(a.paidAt || a.createdAt).getTime()
    )
  } catch (err) {
    console.error('Failed to load payment history:', err)
    error.value = 'Payment history could not be loaded.'
  } finally {
    loading.value = false
  }
}

const formatDate = (value: string, dateOnly = false) => new Date(value).toLocaleDateString('en-US', {
  year: 'numeric', month: 'short', day: 'numeric', ...(dateOnly ? { timeZone: 'UTC' } : {})
})
const formatMoney = (amount: number) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD'
}).format(Number(amount))
const formatLabel = (value: string) => value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase())
const isExpired = (payment: Payment) => payment.status === 'COMPLETED' && new Date(payment.expiresAt) <= new Date()
const displayStatus = (payment: Payment) => isExpired(payment) ? 'Expired' : formatLabel(payment.status)
const statusClass = (payment: Payment) => {
  if (isExpired(payment)) return 'bg-gray-700 text-gray-300'
  if (payment.status === 'COMPLETED') return 'bg-green-900 text-green-200'
  if (payment.status === 'PENDING') return 'bg-yellow-900 text-yellow-200'
  return 'bg-red-900 text-red-200'
}

onMounted(loadPayments)
watch(() => props.userId, loadPayments)
</script>
