import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import HomeView from './HomeView.vue'

describe('HomeView', () => {
  it('describes the product and links to the editor', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/editor', component: { template: '<div />' } }],
    })

    await router.push('/')
    await router.isReady()

    const wrapper = mount(HomeView, {
      global: { plugins: [router] },
    })

    expect(wrapper.text()).toContain('变成可以拼的图纸')
    expect(wrapper.get('a.primary-link').attributes('href')).toBe('/editor')
  })
})
