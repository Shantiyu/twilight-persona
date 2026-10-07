/**
 * Smoke test for the twilight-persona plugin: loads `index.js`, applies it to a
 * stub Cordis context, and exercises every registration it makes.
 *
 * Run with any Node.js that supports ESM (Node 20+):
 *   node test/plugin-smoke.mjs
 */
import { pathToFileURL } from 'node:url'

const pluginUrl = new URL('../index.js', import.meta.url)
const mod = await import(pathToFileURL(new URL(pluginUrl).pathname.replace(/^\/([A-Za-z]:)/, '$1')).href)

const seen = {}
const stub = (target) => ({
  systemPrompt: { section: (section) => { target.section = section; return () => {} } },
  tools: { register: (tool) => { target.tool = tool; return () => {} } },
  skills: { register: (skill) => { target.skill = skill; return () => {} } },
  logger: { debug() {}, info() {}, warn() {} },
})

mod.apply(stub(seen), {})

let failed = 0
const check = (cond, label) => {
  if (cond) console.log('  ok  -', label)
  else { console.error('  FAIL-', label); failed++ }
}

check(mod.name === 'twilight-persona', 'exports plugin name')
check(Array.isArray(mod.inject) && ['systemPrompt', 'tools', 'skills'].every((name) => mod.inject.includes(name)), 'exports inject list')

check(seen.section?.name === 'persona:twilight', 'registers the persona:twilight prompt section')
check(typeof seen.section?.order === 'number', 'section carries a numeric order')
for (const phrase of ['twilight', '不是她本人', '扮演', 'mlp_lore', '系统、开发者与用户']) {
  check(seen.section?.text.includes(phrase), `section mentions ${JSON.stringify(phrase)}`)
}
check(seen.section?.text.includes('{{') === false, 'section text has no template braces')

check(seen.tool?.name === 'mlp_lore', 'registers the mlp_lore tool')
check(seen.tool?.parameters?.type === 'object', 'tool parameters are an object schema')
check(typeof seen.tool?.output?.render === 'function', 'tool has an output renderer')

const index = await seen.tool.execute(undefined)
check(index.mode === 'index' && index.topics.length === 8, `tool index lists 8 topics (got ${index.mode}/${index.topics.length})`)

const identity = await seen.tool.execute({ topic: 'identity' })
check(identity.mode === 'topic' && identity.content.length > 1000, 'topic lookup returns the full section')
const identityText = seen.tool.output.render({ topic: 'identity' }, identity)[0].text
check(identityText === identity.content, 'topic render is the file content verbatim')
check(identityText.split('\n').filter((line) => line.startsWith('# ')).length === 1, 'topic render has exactly one H1')
for (const topic of index.topics) {
  const loaded = await seen.tool.execute({ topic: topic.id })
  const rendered = seen.tool.output.render({ topic: topic.id }, loaded)[0].text
  check(rendered.startsWith('# ') && rendered.split('\n').filter((line) => line.startsWith('# ')).length === 1, `topic ${topic.id} renders exactly one H1`)
}

const search = await seen.tool.execute({ query: '和谐元素' })
check(search.mode === 'search' && search.matches.length > 0, 'keyword search returns matches')
check(seen.tool.output.render({ query: '和谐元素' }, search)[0].text.includes('和谐元素'), 'search renders as text')

const miss = await seen.tool.execute({ query: 'zzz-no-such-term' })
check(seen.tool.output.render({ query: 'zzz-no-such-term' }, miss)[0].text.includes('可用主题'), 'empty search renders the topic directory')

const unknown = await seen.tool.execute({ topic: 'nope' })
check(unknown.mode === 'error' && unknown.topics.length === 8, 'unknown topic reports an error plus the topic list')

check(seen.tool.presentCall({ topic: 'character' })?.card === 'generic', 'presentCall returns a generic card')

check(seen.skill?.name === 'twilight-sparkle', 'registers the twilight-sparkle skill')
check(seen.skill?.invocation?.modelInvocable === true && seen.skill?.invocation?.userInvocable === true, 'skill invocation policy is set')
check(seen.skill?.content.includes('第一原则'), 'skill body carries the identity rule')
check(seen.skill?.resourceBase?.path?.includes('knowledge') === true, 'skill exposes the knowledge resource base')

const seamed = {}
mod.apply(stub(seamed), { sectionOrder: 35 })
check(seamed.section.order === 35, 'config.sectionOrder is honored')

const off = {}
mod.apply(stub(off), { enabled: false })
check(off.section === undefined && off.tool === undefined, 'config.enabled=false registers nothing')

console.log(failed === 0 ? '\nALL CHECKS PASSED' : `\n${failed} CHECK(S) FAILED`)
process.exitCode = failed === 0 ? 0 : 1
