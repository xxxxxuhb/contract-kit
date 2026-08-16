export default defineEventHandler((event) => {
  const id = getRouterParam(event, 'id')
  if (!id || !listContracts().some((item) => item.id === id)) {
    throw createError({ statusCode: 404, message: '合同不存在' })
  }
  return {
    contractId: id,
    options: getFieldOptions(id),
  }
})
