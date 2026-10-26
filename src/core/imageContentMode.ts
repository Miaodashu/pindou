export type ImageContentMode = 'photo' | 'illustration' | 'pixel-art'

export interface ImageContentModeOption {
  id: ImageContentMode
  label: string
  shortDescription: string
  description: string
  tradeoff: string
}

export const imageContentModeOptions: readonly ImageContentModeOption[] = [
  {
    id: 'photo',
    label: '照片',
    shortDescription: '保留自然明暗，净化背景杂点',
    description: '适合人像、宠物与实拍照片；平衡主体轮廓、自然明暗和颜色过渡。',
    tradeoff: '会适度合并背景中的细碎纹理，让成品更容易拼。',
  },
  {
    id: 'illustration',
    label: '插画与线稿',
    shortDescription: '加强轮廓、眉毛和嘴部等细线',
    description:
      '适合动漫、表情包、描边插画和带文字的图；优先保住细线与连接关系。',
    tradeoff: '可能会受控加粗细线，并简化部分柔和渐变。',
  },
  {
    id: 'pixel-art',
    label: '像素图',
    shortDescription: '保持硬边和原有像素块',
    description: '适合像素画、游戏素材和已有网格图；避免不必要的平滑与抖色。',
    tradeoff: '不适合直接处理照片，照片使用此模式可能显得生硬。',
  },
] as const

export function getImageContentModeOption(mode: ImageContentMode) {
  return imageContentModeOptions.find((option) => option.id === mode)!
}
