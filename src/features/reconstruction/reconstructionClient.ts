import type { BeadPalette } from '@/domain/palette/types'
import type {
  ReconstructionRequest,
  ReconstructionResponse,
  ReconstructionSuccess,
} from './types'

interface PendingRequest {
  resolve: (result: ReconstructionSuccess) => void
  reject: (error: Error) => void
  timeout: number
}

let worker: Worker | undefined
const pending = new Map<string, PendingRequest>()

function getWorker() {
  if (worker) return worker
  worker = new Worker(new URL('./reconstruction.worker.ts', import.meta.url), {
    type: 'module',
  })
  worker.addEventListener(
    'message',
    (event: MessageEvent<ReconstructionResponse>) => {
      const response = event.data
      const request = pending.get(response.id)
      if (!request) return
      window.clearTimeout(request.timeout)
      pending.delete(response.id)
      if (response.type === 'failure')
        request.reject(new Error(response.message))
      else request.resolve(response)
    },
  )
  worker.addEventListener('error', (event) => {
    const error = new Error(event.message || '图纸识别线程异常终止。')
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

export function reconstructInWorker(
  source: ImageData,
  columns: number,
  rows: number,
  palette: BeadPalette,
  allowedPaletteIndexes: number[] = [],
) {
  const id = crypto.randomUUID()
  const request: ReconstructionRequest = {
    id,
    type: 'reconstruct',
    source: {
      width: source.width,
      height: source.height,
      data: source.data.buffer.slice(0) as ArrayBuffer,
    },
    palette: JSON.parse(JSON.stringify(palette)) as BeadPalette,
    columns,
    rows,
    allowedPaletteIndexes,
  }

  return new Promise<ReconstructionSuccess>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      pending.delete(id)
      reject(new Error('图纸识别超过 30 秒，请减小原图后重试。'))
    }, 30_000)
    pending.set(id, { resolve, reject, timeout })
    getWorker().postMessage(request, [request.source.data])
  })
}
