import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const cropperMock = vi.hoisted(() => ({
  change: vi.fn(),
  center: vi.fn(),
  selection: {
    x: 200,
    y: 150,
    width: 400,
    height: 400,
    aspectRatio: 1,
    initialAspectRatio: 1,
  },
}))

vi.mock('cropperjs', () => {
  const selection = Object.assign(cropperMock.selection, {
    $change: vi.fn(
      (
        x: number,
        y: number,
        width: number,
        height: number,
        aspectRatio: number,
      ) => {
        Object.assign(selection, { x, y, width, height, aspectRatio })
        cropperMock.change(x, y, width, height, aspectRatio)
        return selection
      },
    ),
    $center: vi.fn(() => {
      selection.x = (1000 - selection.width) / 2
      selection.y = (800 - selection.height) / 2
      cropperMock.center()
      return selection
    }),
  })

  return {
    default: class MockCropper {
      getCropperSelection() {
        return selection
      }

      getCropperCanvas() {
        return { clientWidth: 1000, clientHeight: 800 }
      }

      destroy() {}
    },
  }
})

import ImageCropper from './ImageCropper.vue'

async function mountCropper() {
  const wrapper = mount(ImageCropper, {
    props: {
      src: 'blob:test-image',
      targetWidth: 80,
      targetHeight: 80,
      freeAspectRatio: false,
    },
  })
  await wrapper.get('img').trigger('load')
  await nextTick()
  cropperMock.change.mockClear()
  cropperMock.center.mockClear()
  return wrapper
}

describe('ImageCropper', () => {
  beforeEach(() => {
    cropperMock.change.mockClear()
    cropperMock.center.mockClear()
  })

  it('keeps the crop selection when grid dimensions change at the same ratio', async () => {
    const wrapper = await mountCropper()

    await wrapper.setProps({ targetWidth: 100, targetHeight: 100 })
    await nextTick()

    expect(cropperMock.change).not.toHaveBeenCalled()
    expect(cropperMock.center).not.toHaveBeenCalled()
  })

  it('preserves the selection center and approximate area when the ratio changes', async () => {
    const wrapper = await mountCropper()
    const before = { ...cropperMock.selection }

    await wrapper.setProps({ targetWidth: 120, targetHeight: 80 })
    await nextTick()

    const after = cropperMock.selection
    expect(after.x + after.width / 2).toBeCloseTo(before.x + before.width / 2)
    expect(after.y + after.height / 2).toBeCloseTo(before.y + before.height / 2)
    expect(after.width * after.height).toBeCloseTo(
      before.width * before.height,
      -2,
    )
    expect(after.width / after.height).toBeCloseTo(1.5)
    expect(cropperMock.center).not.toHaveBeenCalled()
  })

  it('keeps the crop selection geometry when switching to free crop', async () => {
    const wrapper = await mountCropper()
    const before = { ...cropperMock.selection }

    await wrapper.setProps({ freeAspectRatio: true })
    await nextTick()

    expect(cropperMock.selection.x).toBe(before.x)
    expect(cropperMock.selection.y).toBe(before.y)
    expect(cropperMock.selection.width).toBe(before.width)
    expect(cropperMock.selection.height).toBe(before.height)
    expect(cropperMock.change).not.toHaveBeenCalled()
    expect(cropperMock.center).not.toHaveBeenCalled()
  })
})
