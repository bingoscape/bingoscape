export const createEnv = (config: Record<string, unknown>) => {
  return config.runtimeEnv || {}
}
