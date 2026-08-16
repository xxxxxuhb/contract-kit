export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, message: '缺少 id' })
  }
  const payload = getContractPayload(id)
  if (!payload) {
    throw createError({ statusCode: 404, message: '合同不存在' })
  }
  await new Promise((r) => setTimeout(r, 120))
  return payload
})
