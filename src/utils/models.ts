export interface ModelOption {
  id: string
  name: string
  description: string
}

// Models served through Netlify AI Gateway
export const MODELS: ModelOption[] = [
  { id: 'claude-sonnet-5-5', name: 'Sonnet 5.5', description: 'Smart and fast for everyday work' },
  { id: 'claude-opus-5-5', name: 'Opus 5.5', description: 'Most capable, for hard problems' },
  { id: 'claude-haiku-5-5', name: 'Haiku 5.5', description: 'Fastest answers' },
]

export const DEFAULT_MODEL = MODELS[0].id
