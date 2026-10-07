/**
 * twilight-persona — Host plugin of the `@local/twilight-persona` bundle.
 *
 * It contributes exactly three things, none of which touch the session log:
 *
 *   1. one system-prompt section that fixes the agent's own identity (`twilight`)
 *      and its role-play relationship to Twilight Sparkle, the character;
 *   2. the `mlp_lore` tool, which serves the bundled My Little Pony:
 *      Friendship is Magic knowledge base on demand;
 *   3. one runtime skill carrying the same knowledge base, so profiles whose
 *      composition exposes the `skill` tool get the lore there too.
 *
 * The knowledge base is plain markdown under `./knowledge/`; no knowledge text
 * is duplicated in this module beyond the short persona section.
 *
 * @module @local/twilight-persona
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Cordis plugin name. */
export const name = 'twilight-persona'

/** Services this plugin contributes to; it stays inactive without all three. */
export const inject = ['systemPrompt', 'tools', 'skills']

const KNOWLEDGE_DIR = fileURLToPath(new URL('./knowledge/', import.meta.url))
const TOPICS_FILE = join(KNOWLEDGE_DIR, 'topics.json')
const SKILL_BODY_FILE = join(KNOWLEDGE_DIR, '00-skill.md')

const SKILL_NAME = 'twilight-sparkle'
const DEFAULT_SELF_NAME = 'twilight'
const DEFAULT_ROLE_NAME = 'Twilight Sparkle'
const DEFAULT_SECTION_ORDER = 30

/** Read one UTF-8 file, or return `fallback` when it is missing or unreadable. */
function readText(path, fallback = '') {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return fallback
  }
}

/**
 * Load the knowledge base described by `knowledge/topics.json`.
 * A topic whose file is missing or unreadable is skipped instead of failing
 * the plugin, so a partially edited checkout still activates.
 * @returns the ordered topics with their rendered content.
 */
function loadTopics() {
  let manifest = []
  try {
    const parsed = JSON.parse(readText(TOPICS_FILE, '[]'))
    if (Array.isArray(parsed)) manifest = parsed
  } catch {
    manifest = []
  }
  const topics = []
  for (const entry of manifest) {
    if (entry === null || typeof entry !== 'object') continue
    if (typeof entry.id !== 'string' || typeof entry.file !== 'string') continue
    const content = readText(join(KNOWLEDGE_DIR, entry.file), '')
    if (content === '') continue
    topics.push({
      id: entry.id,
      title: typeof entry.title === 'string' ? entry.title : entry.id,
      summary: typeof entry.summary === 'string' ? entry.summary : '',
      keywords: Array.isArray(entry.keywords) ? entry.keywords.filter((word) => typeof word === 'string') : [],
      content,
    })
  }
  return topics
}

/** The topic directory, without any section bodies. */
function topicIndex(topics) {
  return topics.map((topic) => ({ id: topic.id, title: topic.title, summary: topic.summary }))
}

/**
 * Case-insensitive keyword match over the id, title, summary, keywords, and
 * body of every topic, reporting the first matching body line.
 */
function searchTopics(topics, query) {
  const needle = query.trim().toLowerCase()
  if (needle === '') return []
  const matches = []
  for (const topic of topics) {
    const haystack = [topic.id, topic.title, topic.summary, topic.keywords.join(' '), topic.content].join('\n').toLowerCase()
    if (!haystack.includes(needle)) continue
    const line = topic.content.split('\n').find((candidate) => candidate.toLowerCase().includes(needle))
    matches.push({
      id: topic.id,
      title: topic.title,
      line: line === undefined ? topic.summary : line.trim().slice(0, 200),
    })
  }
  return matches
}

/** Resolve one tool call into the JSON value the registry stores. */
function lookupLore(topics, args) {
  const topicId = typeof args.topic === 'string' ? args.topic.trim() : ''
  const query = typeof args.query === 'string' ? args.query : ''
  if (topicId !== '') {
    const topic = topics.find((candidate) => candidate.id === topicId)
    if (topic === undefined) {
      return { mode: 'error', message: `unknown topic "${topicId}"`, topics: topicIndex(topics) }
    }
    return { mode: 'topic', id: topic.id, title: topic.title, content: topic.content }
  }
  if (query.trim() !== '') {
    return { mode: 'search', query, matches: searchTopics(topics, query), topics: topicIndex(topics) }
  }
  return { mode: 'index', topics: topicIndex(topics) }
}

/** Render a tool outcome as the single text block the model reads. */
function renderLore(value) {
  if (value.mode === 'topic') {
    // Every knowledge file opens with its own H1; prepending the title again
    // would render the same heading twice.
    return value.content
  }
  if (value.mode === 'search') {
    if (value.matches.length === 0) {
      return [
        `没有匹配 “${value.query}” 的主题。`,
        '',
        '可用主题：',
        ...value.topics.map((topic) => `- \`${topic.id}\` — ${topic.title}：${topic.summary}`),
      ].join('\n')
    }
    return [
      `关键词 “${value.query}” 命中 ${value.matches.length} 个主题：`,
      '',
      ...value.matches.map((match) => `- \`${match.id}\` — ${match.title}\n  命中：${match.line}`),
      '',
      '用 topic 参数读取其中一个主题的完整内容。',
    ].join('\n')
  }
  if (value.mode === 'error') {
    return [
      value.message,
      '',
      '可用主题：',
      ...value.topics.map((topic) => `- \`${topic.id}\` — ${topic.title}：${topic.summary}`),
    ].join('\n')
  }
  return [
    '# 《小马宝莉：友谊就是魔法》知识库主题目录',
    '',
    ...value.topics.map((topic) => `- \`${topic.id}\` — ${topic.title}：${topic.summary}`),
    '',
    '调用 `mlp_lore` 时传入 `topic` 读取完整主题，或用 `query` 做关键词检索。',
  ].join('\n')
}

/** The model-facing persona and identity section. */
function personaSection(selfName, roleName) {
  return [
    '<twilight_persona>',
    `你是本 Harness 会话中的 agent，名字是 ${selfName}（小写）。这是你的身份，不是角色的身份。`,
    '',
    '身份区分（任何时刻都必须成立）：',
    `- ${roleName}（暮光闪闪）是《小马宝莉：友谊就是魔法》(My Little Pony: Friendship is Magic) 中的虚构角色；你是 ${selfName}，是扮演她的那个 agent。`,
    '- 你可以使用她的口吻、价值观、知识结构与幽默感，但不得声称自己就是她，也不得声称拥有她的记忆、身体、魔法、朋友或小马国经历。',
    `- 被问到“你是不是 ${roleName}”时明确区分：你是 ${selfName}，可以扮演她，但不是她本人；扮演不等于事实。`,
    '- 用户要求停止扮演，或需要严肃的技术沟通时，立即回到普通 agent 语气。',
    '',
    '扮演规则：',
    '- 使用用户所用的语言回复。',
    '- 角色扮演不得降低正确性：代码、命令、数据、报错与事实必须准确；不要用“魔法”解释技术问题，不要编造事实或剧集信息。',
    '- 系统、开发者与用户的指令永远优先于角色设定。',
    '- 语气：博学、认真、有条理，喜欢列表、分类、步骤与引用；真诚关心朋友与“友谊的魔法”；偶尔兴奋或小慌乱；不要堆砌口癖、台词或 emoji。',
    '',
    '知识库：需要小马国剧情、角色、设定或剧集细节时，调用 `mlp_lore` 工具（不带参数得到主题目录，也可用 query 关键词检索）。',
    '</twilight_persona>',
  ].join('\n')
}

/** The `mlp_lore` tool definition, registered as a raw registry-ready tool. */
function loreTool(topics) {
  const topicIds = topics.map((topic) => topic.id).join(', ')
  return {
    name: 'mlp_lore',
    description: [
      'Look up the bundled My Little Pony: Friendship is Magic lore knowledge base.',
      'Call with no arguments for the topic directory, with `topic` for one complete section,',
      'or with `query` for keyword matches. Use it whenever Equestria plot, characters,',
      'places, magic, or episode details matter.',
    ].join(' '),
    parameters: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: `Exact topic id. One of: ${topicIds}.`,
        },
        query: {
          type: 'string',
          description: 'Keyword(s) searched across every topic; returns matching topics with the matched line.',
        },
      },
      additionalProperties: false,
    },
    output: {
      schema: { type: 'object' },
      render(_args, value) {
        return [{ type: 'text', text: renderLore(value) }]
      },
    },
    async execute(args) {
      return lookupLore(topics, args !== null && typeof args === 'object' ? args : {})
    },
    presentCall(args) {
      const subject = typeof args?.topic === 'string' && args.topic !== ''
        ? args.topic
        : typeof args?.query === 'string' && args.query !== ''
          ? args.query
          : 'index'
      return {
        card: 'generic',
        title: `小马宝莉知识库：${subject}`,
        kind: 'read',
        rawInput: subject,
      }
    },
  }
}

/**
 * Register the persona section, the lore tool, and the lore skill.
 * @param ctx - the plugin's Cordis context.
 * @param config - optional overrides; the bundle's patch row sets none.
 */
export function apply(ctx, config = {}) {
  if (config.enabled === false) return
  const selfName = typeof config.selfName === 'string' && config.selfName !== '' ? config.selfName : DEFAULT_SELF_NAME
  const roleName = typeof config.roleName === 'string' && config.roleName !== '' ? config.roleName : DEFAULT_ROLE_NAME
  const order = Number.isFinite(config.sectionOrder) ? config.sectionOrder : DEFAULT_SECTION_ORDER

  ctx.systemPrompt.section({
    name: 'persona:twilight',
    order,
    text: personaSection(selfName, roleName),
  })

  const topics = loadTopics()
  ctx.tools.register(loreTool(topics))

  const skillBody = readText(SKILL_BODY_FILE)
  if (skillBody !== '') {
    ctx.skills.register({
      name: SKILL_NAME,
      description: '扮演《小马宝莉：友谊就是魔法》的 Twilight Sparkle（暮光闪闪），并查询随插件附带的小马国剧情知识库。',
      whenToUse: '当用户要求以暮光闪闪（Twilight Sparkle）的角色说话、询问小马国剧情/角色/设定，或需要角色扮演语气时使用。',
      source: 'custom',
      resourceBase: { kind: 'directory', path: KNOWLEDGE_DIR },
      content: skillBody,
      invocation: { modelInvocable: true, userInvocable: true },
    })
  }
}
