// robots.txt de l'hôte admin : tout le dashboard est désindexé (meta noindex côté pages en
// plus — belt and suspenders, le crawl se fait par le Host servis sur admin.chauvierdelor.com).
export default defineEventHandler((event) => {
  setHeader(event, 'content-type', 'text/plain; charset=utf-8')
  return 'User-agent: *\nDisallow: /\n'
})
