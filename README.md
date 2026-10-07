# twilight-persona

> **声明**：这个插件完全由 dsh 编写生成（代码、知识库、图标与文档）。

让本 Harness profile 里的 agent 变成 **`Twilight`**：它使用《小马宝莉：友谊就是魔法》(My Little Pony:
Friendship is Magic) 的 **Twilight Sparkle（暮光闪闪）** 的语气、价值观与知识结构，说话时带一点小马腔，
同时**始终清楚自己不是暮光本人**。

- **agent 自己的身份**：`Twilight` —— 本会话的 agent。
- **扮演的角色**：`Twilight Sparkle` —— 虚构角色，是 `Twilight` 扮演的对象。
- 两个名字只差一个词，但指向不同，永不互换：被问到身份时明确区分；不声称拥有她的记忆、身体、魔法或小马国经历。

## 这个插件做了什么

一个 Host-only bundle，全部由 `index.js` 里的一个插件行提供：

| 能力 | 机制 | 效果 |
|---|---|---|
| 人格与身份边界 | `ctx.systemPrompt.section()`（order 30，`persona:twilight`） | 每个请求都带上 `<twilight_persona>`：身份区分、扮演规则、语言与语气、正确性优先 |
| 小马腔（pony diction） | 同一段落里的一组规则 + `pony-diction` 主题 | 对话中自然使用 `everypony`／"各位小马""全小马利亚"、Pinkie Promise 等说法与典故 |
| 剧情知识库 | `mlp_lore` 工具（`ctx.tools.register()`） | 按需查询小马国角色、地理、魔法、时间线、剧集、语气与词表 |
| 同源技能 | `ctx.skills.register()`（`twilight-sparkle`，`source: custom`） | 组合里暴露 `skill` 工具的 profile 也能加载同一份知识库 |

知识库是 `knowledge/` 下的纯 markdown，插件只在 `mlp_lore` 被调用时读取，因此**不占用常驻上下文**；
常驻的只有那段约 450 token 的人格段落。

## 命名说明

- **agent 名是 `Twilight`**（首字母大写），出现在人格段落、README 与知识库里。
- **npm 包名不能含大写字母**，所以包名与目录名仍是 `@local/twilight-persona` / `twilight-persona`。
- 技能名受 kebab-case 语法限制，仍是 `twilight-sparkle`；提示段落内部名仍是 `persona:twilight`。这些是标识符，不是显示给用户的称呼。

## 安装与卸载

安装：

```
plugin_manager  action: install_bundle
                target: <本目录的绝对路径>
```

它会把本目录作为 `link:` 依赖写进 profile，并在 profile 的 bundle 列表里选中它；返回 `application: applied`
即已生效。若目标路径发生变化（例如把项目搬过盘），重新安装会返回 `application: restart-required`——
新的模块代需要重启 Harness 才会加载。

卸载：

```
plugin_manager  action: remove_bundle   target: @local/twilight-persona
```

只想临时停用（保留文件与配置）：`action: set_plugin, target: include:twilight-persona, enabled: false`。

> 本目录是 **link 安装**：`package.json` 的 `files` 不会过滤链接目录，源码与知识库直接来自本目录。

## 目录结构

```
twilight-persona/
├─ package.json            # dsh.bundle.patch 指向 cordis.patch.yml；导出 locale 与 icon
├─ cordis.patch.yml        # insert 一行：id=twilight-persona, name=@local/twilight-persona
├─ index.js                # 人格段落（含小马腔规则）+ mlp_lore 工具 + twilight-sparkle 技能
├─ icon.svg                # 原创图标（书本 + 星芒，非官方素材）
├─ locale/en.json          # 插件管理页显示名与描述（英文）
├─ locale/zh.json          # 同上（中文）
├─ LICENSE                 # MIT
├─ .gitignore / .gitattributes
├─ test/plugin-smoke.mjs   # 桩上下文冒烟测试：node test/plugin-smoke.mjs
└─ knowledge/
   ├─ 00-skill.md                    # 技能正文：第一原则 + 主题导航 + 小马腔 + 扮演强度
   ├─ topics.json                    # 工具的主题清单（id / 标题 / 摘要 / 关键词 / 文件）
   ├─ 01-identity-and-boundaries.md  # 身份边界、回答模板、禁止清单
   ├─ 02-twilight-character.md       # 角色档案：性格、习惯、成长、缺点
   ├─ 03-cast-and-relationships.md   # Mane Six、Spike、公主家族、学生、反派
   ├─ 04-equestria-and-places.md     # 地理、地标、节庆、族群
   ├─ 05-magic-and-artifacts.md      # 魔法体系、和谐元素、神器
   ├─ 06-timeline-and-arcs.md        # S1–S9 主线、剧场版、主题线
   ├─ 07-episode-index.md            # 高置信度剧集索引 + 核对提醒
   ├─ 08-voice-and-mannerisms.md     # 语气分级、句式、示例对话
   └─ 09-pony-diction.md             # 小马腔词表、典故出处与禁用场景
```

## `mlp_lore` 用法

| 调用 | 返回 |
|---|---|
| `mlp_lore()` | 主题目录（9 个主题的 id、标题、摘要） |
| `mlp_lore({ topic: "magic" })` | 该主题完整 markdown |
| `mlp_lore({ query: "和谐元素" })` | 命中主题列表 + 每个主题的命中行 |

主题 id：`identity`、`character`、`cast`、`world`、`magic`、`timeline`、`episodes`、`voice`、`pony-diction`。

## 小马腔是怎么生效的

- **默认轻度开启**（L1）：对话里每段点缀一两处，例如 `everypony`／"各位小马""每匹小马""没有哪匹小马"、
  "全小马利亚……"、"友谊的魔法"、"可爱标志"、Pinkie Promise、Rainbow Dash 的"20% 更酷"。
- **用户要求扮演**（L2/L3）：可以连续使用，先给结论再上腔调；重度时可写场景化叙述与对白。
- **硬禁区**：代码块与行内代码、命令与参数、路径与 URL、标识符与 API 名、报错与日志原文、引用文字、
  提交信息，以及要交付或发布的文件内容——一律保持原样，不改写、不翻译。
- 用户说"正常说话／别演了"后立即停用。
- 完整词表、典故出处与禁用清单在 `knowledge/09-pony-diction.md`，模型可通过 `mlp_lore` 的
  `pony-diction` 主题取用。

## 可选配置（防御式读取）

插件行未在 patch 里设置 `config`。若在 profile 的 patch 层给这一行加 `config`，这些字段会被使用：
`enabled`（`false` 则整行不注册任何东西）、`selfName`（默认 `Twilight`）、`roleName`（默认 `Twilight Sparkle`）、
`sectionOrder`。未声明的 `Config` schema 意味着这些值不做校验——写错类型时退回默认值。

## 设计取舍

- **人格用 section，不用 personaPrefix**：`dsh-system-prompt` 的 `personaPrefix` 属于另一个插件行，
  覆写它会替换该行的完整 config；注册新 section 是可叠加、可独立卸载的做法。
- **知识库用工具而非常驻提示词**：剧情知识动辄数千 token，常驻会把每个请求都变贵；
  工具让模型只在需要时取用，常驻的只有那段人格规则。
- **小马腔写成"规则 + 词表"两层**：段落里只放判断规则（哪里能用、哪里绝对不能用），
  具体词表与典故放进知识库按需加载，既省常驻 token，也方便你自己改词。
- **同时注册技能**：本 profile 的 `tool-skill` 行当前未启用，所以 `skill` 目录为空（调用会
  返回 unknown），知识库因此必须由工具兜底；一旦启用 skill 工具，同一份 `knowledge/` 会以
  `twilight-sparkle` 出现在技能目录里。
- **零外部依赖**：只用 `node:fs`/`node:path`/`node:url`。不 `import` 任何 `@deepseek-ai/*` 包，
  因此模块解析不会随 Harness 版本或 profile 布局变化而失效。
- **完整 persona 落在工具参数里**：`ToolDefinition.parameters` 是注册时的原始 JSON Schema
  （`defineTool` 才会做作者语法编译），所以这里直接写 JSON Schema。

## 验证状态

- `test/plugin-smoke.mjs`：**44 项断言**全部通过（段落文本与身份/小马腔规则、工具三种模式与渲染、
  9 个主题各自恰好一个 H1、未知主题、技能注册与资源目录、配置开关）。
- 安装：首次从工作区路径安装返回 `application: applied`、`warnings: []`；项目搬到 `H:\DSH_Workspace\`
  后重新安装返回 `application: restart-required`（路径变化需要新的模块代）。
- 活体验证：安装后的同一轮，本会话系统提示已包含 `<twilight_persona>` 段落，
  `cordis_inspect_query`（`Tool.listTools`）已列出 `mlp_lore`，实际调用返回主题检索结果。
- **未验证**：Web UI 里插件管理页的图标与标题渲染（需要页面级截图；安装与注册已确认，
  渲染效果未观察）。
- `Config.listConfigs` 对本行显示 `status: absent`——这是"未声明 Config schema"的正常表现，
  不是未激活；激活以工具注册与提示段落出现为准。
- 本文件描述的 `Twilight` 大写与"小马腔"规则属于代码/知识库改动，**重启 Harness 后**才进入运行时。

## 已知限制

- 知识库内容在**插件加载时**读入内存；改 `knowledge/*.md` 后需要重载该插件行（或重启
  Harness）才会生效。改 `index.js` 属于替换模块，需要重启才能加载新代码。
- 人格段落是**全局**的：子 agent 也会带着 `Twilight` 身份、同样的语气与小马腔规则工作。
- 小马腔是"风格建议"而不是硬过滤：它靠模型遵守规则，插件不做输出后处理，因此个别句子里仍可能
  出现腔调过重或位置不当的情况。要收紧就改 `index.js` 里的段落或 `09-pony-diction.md`。
- 知识库以主线剧情与高置信度设定为主；**季/集编号不保证全部准确**，文件内已写明
  "不确定就说不确定，需要时联网核对"。它是提示词素材，不是权威剧集数据库。
- 图标为原创 SVG（书本 + 星芒），不含官方素材；文档中的角色名与设定属于 Hasbro 的
  知识产权，这里只做描述性引用。

## 许可与商标

- 代码与本仓库文本以 **MIT** 许可发布，见 [`LICENSE`](LICENSE)。
- 《My Little Pony: Friendship is Magic》及其角色名称、世界观设定是 **Hasbro** 的商标与
  知识产权。本仓库是粉丝向的非商业性**描述性引用**：只使用角色名、剧情梗概与设定说明，
  不包含官方素材、剧照、音乐或歌词原文。图标为原创 SVG。
- 知识库面向提示词使用，**不是权威剧集数据库**；季/集编号请以官方或 Wikipedia 等来源核对。

## 相关链接

- DeepSeek Harness（本插件运行的宿主）：安装后即可用 `plugin_manager install_bundle`
  把本仓库目录装进 profile，详见上面「安装与卸载」。
