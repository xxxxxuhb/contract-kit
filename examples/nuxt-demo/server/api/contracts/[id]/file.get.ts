export default defineEventHandler((event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: '缺少 id' })
  }
  const file = readContractFile(id)
  if (!file) {
    throw createError({ statusCode: 404, message: '模板不存在' })
  }
  setHeader(event, 'Content-Type', file.contentType)
  setHeader(
    event,
    'Content-Disposition',
    `inline; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
  )
  setHeader(event, 'Cache-Control', 'no-store')
  return file.buffer
})
