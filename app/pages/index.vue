<script setup lang="ts">
import { useRouter } from '#app/composables/router'

const router = useRouter()
router.replace('/projects')
</script>

<template>
  <div>
    <slot />
  </div>
</template>
