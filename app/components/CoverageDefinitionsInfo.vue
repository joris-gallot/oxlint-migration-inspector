<script setup lang="ts">
defineProps<{
  note: string
}>()
</script>

<template>
  <div mb4 border="~ sky/35 rounded" bg-sky:8 p3 text-sm>
    <div mb2 text-sky font-semibold>
      Coverage Definitions
    </div>
    <div op90>
      <code>Native</code>: <code>jsPlugins=false</code>, <code>withNursery=false</code>, <code>typeAware=false</code>.
    </div>
    <div op90>
      <code>Default</code>: <code>jsPlugins=true</code>, <code>withNursery=false</code>, <code>typeAware=false</code>.
    </div>
    <div op90>
      <code>Max</code>: <code>jsPlugins=true</code>, <code>withNursery=true</code>, <code>typeAware=true</code>.
    </div>
    <div mt2 text-sky:80>
      {{ note }}
    </div>
  </div>
</template>
