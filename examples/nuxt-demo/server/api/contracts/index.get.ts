export default defineEventHandler(() => {
  return { items: listContracts() }
})
