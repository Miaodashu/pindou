import { createRouter, createWebHistory } from 'vue-router'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
    },
    {
      path: '/editor',
      name: 'editor',
      component: () => import('@/views/EditorView.vue'),
    },
    {
      path: '/draw',
      name: 'draw',
      component: () => import('@/views/DrawView.vue'),
    },
    {
      path: '/inventory',
      name: 'inventory',
      component: () => import('@/views/InventoryView.vue'),
    },
    {
      path: '/reconstruct',
      name: 'reconstruct',
      component: () => import('@/views/ReconstructionView.vue'),
    },
  ],
})
