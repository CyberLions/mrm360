<template>
  <div class="space-y-2">
    <select
      :value="creating ? NEW : modelValue"
      class="field"
      @change="pick(($event.target as HTMLSelectElement).value)"
    >
      <option value="">{{ emptyLabel }}</option>
      <option v-for="option in options" :key="option" :value="option">
        {{ option }}
      </option>
      <option :value="NEW">＋ {{ newLabel }}</option>
    </select>
    <input
      v-if="creating"
      ref="input"
      :value="modelValue"
      class="field"
      :placeholder="newPlaceholder"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
  </div>
</template>
<script setup lang="ts">
import { nextTick, ref } from "vue";
// A dropdown of the names that already exist, with a "new" choice that reveals a text box so
// adding a room or shelf never means leaving the form.
const NEW = "__new__";
const props = defineProps<{
  modelValue: string;
  options: string[];
  emptyLabel: string;
  newLabel: string;
  newPlaceholder: string;
}>();
const emit = defineEmits<{ "update:modelValue": [value: string] }>();
// A value that is not in the list (e.g. one typed earlier) is shown as a new name.
const creating = ref(!!props.modelValue && !props.options.includes(props.modelValue));
const input = ref<HTMLInputElement>();
function pick(value: string) {
  creating.value = value === NEW;
  emit("update:modelValue", creating.value ? "" : value);
  if (creating.value) nextTick(() => input.value?.focus());
}
</script>
<style scoped>
.field {
  @apply w-full rounded-lg border border-gray-600/50 bg-gray-700/50 px-4 py-2.5 text-gray-100 placeholder-gray-400 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/50;
}
</style>
