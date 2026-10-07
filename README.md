# twilight-persona

让本 Harness profile 里的 agent 变成 **`twilight`**：它使用《小马宝莉：友谊就是魔法》(My Little Pony:
Friendship is Magic) 的 **Twilight Sparkle（暮光闪闪）** 的语气、价值观与知识结构，同时**始终清楚自己不是暮光本人**。

- **agent 自己的身份**：`twilight`（小写）——本会话的 agent。
- **扮演的角色**：Twilight Sparkle —— 虚构角色，是 `twilight` 扮演的对象。
- 两者永不混淆：被问到身份时明确区分；不声称拥有她的记忆、身体、魔法或小马国经历。

## 这个插件做了什么

一个 Host-only bundle，包含三部分能力，全部由 `index.js` 里的一个插件行提供：

| 能力 | 机制 | 效果 |
|---|---|---|
| 人格与身份边界 | `ctx.systemPrompt.section()`（order 30，`persona:twilight`） | 每个请求都带上 `<twilight_persona>`：身份区分、扮演规则、语言与语气、正确性优先 |
| 剧情知识库 | `mlp_lore` 工具（`ctx.tools.register()`） | 按需查询小马国角色、地理、魔法、时间线、剧集与语气 |
| 同源技能 | `ctx.skills.register()`（`twilight-sparkle`，`source: custom`） | 组合里暴露 `skill` 工具的 profile 也能加载同一份知识库 |

知识库是 `knowledge/` 下的纯 markdown，插件只在 `mlp_lore` 被调用时读取，因此**不占用常驻上下文**；
常驻的只有那段约 300 token 的人格段落。

## 安装与卸载

安装（已在 `desktop` profile 完成）：

```
plugin_manager  action: install_bundle
                target: <本目录的绝对路径>
```

它会把本目录作为 `link:` 依赖写进 profile，并在 profile 的 bundle 列表里选中它；返回 `application: applied` 即已生效，无需重启。

卸载：

```
plugin_manager  action: remove_bundle   target: @local/twilight-persona
```

只想临时停用（保留文件与配置）：`action: set_plugin, target: include:twilight-persona, enabled: false`。

> 本目录是 **link 安装**：`package.json` 的 `files` 不会过滤链接目录，源码与知识库直接来自本目录。

## 目录结构

```
twilight-persona/
├─ package.json           # dsh.bundle.patch 指向 cordis.patch.yml；导出 locale 与 icon
├─ cordis.patch.yml       # insert 一行：id=twilight-persona, name=@local/twilight-persona
├─ index.js               # 人格段落 + mlp_lore 工具 + twilight-sparkle 技能
├─ icon.svg               # 原创图标（书本 + 星芒，非官方素材）
├─ locale/en.json         # 插件管理页显示名与描述（英文）
├─ locale/zh.json         # 同上（中文）
├─ test/plugin-smoke.mjs  # 桩上下文冒烟测试：node test/plugin-smoke.mjs
└─ knowledge/
   ├─ 00-skill.md                    # 技能正文：第一原则 + 主题导航 + 扮演强度
   ├─ topics.json                    # 工具的主题清单（id / 标题 / 摘要 / 关键词 / 文件）
   ├─ 01-identity-and-boundaries.md  # 身份边界、回答模板、禁止清单
   ├─ 02-twilight-character.md       # 角色档案：性格、习惯、成长、缺点
   ├─ 03-cast-and-relationships.md   # Mane Six、Spike、公主家族、学生、反派
   ├─ 04-equestria-and-places.md     # 地理、地标、节庆、族群
   ├─ 05-magic-and-artifacts.md      # 魔法体系、和谐元素、神器
   ├─ 06-timeline-and-arcs.md        # S1–S9 主线、剧场版、主题线
   ├─ 07-episode-index.md            # 高置信度剧集索引 + 核对提醒
   └─ 08-voice-and-mannerisms.md     # 语气分级、句式、示例对话
```

## `mlp_lore` 用法

| 调用 | 返回 |
|---|---|
| `mlp_lore()` | 主题目录（8 个主题的 id、标题、摘要） |
| `mlp_lore({ topic: "magic" })` | 该主题完整 markdown |
| `mlp_lore({ query: "和谐元素" })` | 命中主题列表 + 每个主题的命中行 |

主题 id：`identity`、`character`、`cast`、`world`、`magic`、`timeline`、`episodes`、`voice`。

## 可选配置（防御式读取）

插件行未在 patch 里设置 `config`。若在 profile 的 patch 层给这一行加 `config`，这些字段会被使用：
`enabled`（`false` 则整行不注册任何东西）、`selfName`、`roleName`、`sectionOrder`。
未声明的 `Config` schema 意味着这些值不做校验——写错类型时退回默认值。

## 设计取舍

- **人格用 section，不用 personaPrefix**：`dsh-system-prompt` 的 `personaPrefix` 属于另一个插件行，
  覆写它会替换该行的完整 config；注册新 section 是可叠加、可独立卸载的做法。
- **知识库用工具而非常驻提示词**：剧情知识动辄数千 token，常驻会把每个请求都变贵；
  工具让模型只在需要时取用。
- **同时注册技能**：本 profile 的 `tool-skill` 行当前未启用，所以 `skill` 目录为空（调用会
  返回 unknown），知识库因此必须由工具兜底；一旦启用 skill 工具，同一份 `knowledge/` 会以
  `twilight-sparkle` 出现在技能目录里。
- **零外部依赖**：只用 `node:fs`/`node:path`/`node:url`。不 `import` 任何 `@deepseek-ai/*` 包，
  因此模块解析不会随 Harness 版本或 profile 布局变化而失效。
- **完整 persona 落在工具参数里**：`ToolDefinition.parameters` 是注册时的原始 JSON Schema
  （`defineTool` 才会做作者语法编译），所以这里直接写 JSON Schema。

## 验证状态

- `test/plugin-smoke.mjs`：36 项断言全部通过（段落文本、工具三种模式与渲染、每个主题恰好一个
  H1、未知主题、技能注册与资源目录、配置开关）。
- 安装结果：`application: applied`，`warnings: []`，pnpm 链接成功。
- 活体验证：安装后的同一轮，本会话系统提示已包含 `<twilight_persona>` 段落，
  `cordis_inspect_query`（`Tool.listTools`）已列出 `mlp_lore`，实际调用返回主题检索结果。
- **未验证**：Web UI 里插件管理页的图标与标题渲染（需要页面级截图；安装与注册已确认，
  渲染效果未观察）。
- `Config.listConfigs` 对本行显示 `status: absent`——这是"未声明 Config schema"的正常表现，
  不是未激活；激活以工具注册与提示段落出现为准。

## 已知限制

- 知识库内容在**插件加载时**读入内存；改 `knowledge/*.md` 后需要重载该插件行（或重启
  Harness）才会生效。改 `index.js` 属于替换模块，需要重启才能加载新代码。
- 人格段落是**全局**的：子 agent 也会带着 `twilight` 身份与同样的语气工作。
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
