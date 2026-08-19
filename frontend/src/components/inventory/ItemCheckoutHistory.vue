<template>
  <section class="overflow-hidden rounded-lg border border-gray-700 bg-gray-800 shadow">
    <header class="border-b border-gray-700 px-4 py-5 sm:px-6">
      <h3 class="text-lg font-medium text-gray-100">Item check-in / checkout history</h3>
      <p class="mt-1 text-sm text-gray-400">Physical club items borrowed by this member.</p>
    </header>
    <div v-if="loading" class="p-6 text-center text-gray-400">Loading item history…</div>
    <div v-else-if="error" class="p-6 text-red-300">{{ error }}</div>
    <div v-else-if="!loans.length" class="p-8 text-center text-gray-400">No item checkouts yet.</div>
    <div v-else class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-700 text-sm">
        <thead class="bg-gray-900/60 text-left text-xs uppercase tracking-wide text-gray-400"><tr><th class="px-5 py-3">Item</th><th class="px-5 py-3">Checked out</th><th class="px-5 py-3">Checked in</th><th class="px-5 py-3">Status / location</th></tr></thead>
        <tbody class="divide-y divide-gray-700">
          <tr v-for="loan in loans" :key="loan.id">
            <td class="px-5 py-4"><div class="font-medium text-gray-100">{{ loan.item.name }}</div><div class="font-mono text-xs text-gray-500">{{ loan.item.barcode }}</div></td>
            <td class="whitespace-nowrap px-5 py-4 text-gray-300">{{ formatDate(loan.checkedOutAt) }}</td>
            <td class="whitespace-nowrap px-5 py-4 text-gray-300">{{ loan.checkedInAt ? formatDate(loan.checkedInAt) : '—' }}</td>
            <td class="px-5 py-4"><span v-if="!loan.checkedInAt" class="rounded-full bg-amber-900 px-2.5 py-1 text-xs font-medium text-amber-200">Currently checked out</span><span v-else class="text-gray-300">Returned{{ loan.returnBin ? ` to ${loan.returnBin.room ? `${loan.returnBin.room} · ` : ''}${loan.returnBin.name}` : '' }}</span></td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import apiService from '@/services/api'
import type { ItemLoan } from '@/types/api'

const props = defineProps<{ userId?: string }>()
const loans = ref<ItemLoan[]>([])
const loading = ref(true)
const error = ref('')

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    loans.value = (await apiService.getInventoryHistory(props.userId)).loans
  } catch (err: any) {
    error.value = err.response?.data?.error || 'Could not load item history'
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(() => props.userId, load)
</script>
