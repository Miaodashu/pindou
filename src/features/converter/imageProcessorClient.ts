import type { BeadPalette } from '@/domain/palette/types'
import type { QuantizeStrategy } from '@/core/quantize'
import type {
  BackgroundMode,
  ConversionPipelineVersion,
  ConvertImageRequest,
  ConvertImageResponse,
  ConvertImageSuccess,
} from './types'

interface PendingRequest {
  resolve: (result: ConvertImageSuccess) => void
  reject: (error: Error) => void
  timeout: number
}

let worker: Worker | undefined
const pending = new Map<string, PendingRequest>()

function getWorker() {
  if (worker) return worker
  worker = new Worker(new URL('./imageProcessor.worker.ts', import.meta.url), {
    type: 'module',
  })
  worker.addEventListener(
    'message',
    (event: MessageEvent<ConvertImageResponse>) => {
      const response = event.data
      const request = pending.get(response.id)
      if (!request) return
      window.clearTimeout(request.timeout)
      pending.delete(response.id)
      if (response.type === 'failure') {
        request.reject(new Error(response.message))
      } else {
        request.resolve(response)
      }
    },
  )
  worker.addEventListener('error', (event) => {
    const error = new Error(event.message || '图片处理线程异常终止。')
    pending.forEach((request) => {
      window.clearTimeout(request.timeout)
      request.reject(error)
    })
    pending.clear()
    worker?.terminate()
    worker = undefined
  })
  return worker
}

export function convertImageInWorker(
  source: ImageData,
  width: number,
  height: number,
  palette: BeadPalette,
  options: {
    maxColors: number
    strategy: QuantizeStrategy
    backgroundMode: BackgroundMode
    pipelineVersion?: ConversionPipelineVersion
  },
): Promise<ConvertImageSuccess> {
  const id = crypto.randomUUID()
  const request: ConvertImageRequest = {
    id,
    type: 'resize',
    source: {
      width: source.width,
      height: source.height,
      data: source.data.buffer.slice(0) as ArrayBuffer,
    },
    target: { width, height },
    palette: JSON.parse(JSON.stringify(palette)) as BeadPalette,
    maxColors: options.maxColors,
    strategy: options.strategy,
    backgroundMode: options.backgroundMode,
    pipelineVersion: options.pipelineVersion ?? 'v2-adaptive',
  }

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      pending.delete(id)
      reject(new Error('图片处理超过 30 秒，请减小原图尺寸后重试。'))
    }, 30_000)
    pending.set(id, { resolve, reject, timeout })
    getWorker().postMessage(request, [request.source.data])
  })
}
