# Segment Boundary Policy v1

## 目标

Semantic Segments 是 Overlay 的事实来源；Plain Text Projection 仅用于上下文、复制和可访问性。Segment 边界必须保留一条完整句子的语法、标点、空格、原意与阅读顺序。

## M2.1 边界规则

- English Chunk 默认位于两个 Text Segment 之间；句首、句尾或 standalone 只有 Registry 明确允许且通过 Soft Review 时才可用。
- 邻接 Text 必须保留必要的空格或兼容标点；Schema 不得 trim 掉有意义的边界空格。
- Phrase 后不得机械出现全角或半角冒号。
- 不得用换行、列表符号或标题文字隔离 Phrase。
- 不得出现连续边界空格、重复标点、空 Text Segment 或相邻重复 Segment。
- Phrase 的实际位置必须属于 preferredPositions 和 Candidate allowedPositions。
- requiresCopula、requiresSubject 与 grammaticalRole 必须得到句法支撑。
- Phrase 与后文不得构成直接中文翻译关系。
- UI 必须按 Segment 顺序渲染，不得从 Plain Text 反向识别英语。

## 正例

    [
      {
        "type": "text",
        "content": "我觉得先确认最重要的目标，是 ",
        "language": "zh"
      },
      {
        "type": "english_chunk",
        "content": "a good place to start",
        "phraseId": "p-good-place-to-start",
        "isNew": true,
        "assistanceAvailable": true
      },
      {
        "type": "text",
        "content": "；之后再决定具体动作。",
        "language": "zh"
      }
    ]

其投影必须精确等于：

> 我觉得先确认最重要的目标，是 a good place to start；之后再决定具体动作。

## 禁止边界

- english_chunk 后跟“：中文解释”；
- “英语表达”标签后跟 english_chunk；
- 换行 + 独立 Phrase + 换行；
- Text 末尾和下一 Text 开头包含重复空格；
- Phrase 前后均无 Text；
- 复制后语序变化；
- 屏幕阅读器将 Phrase 读成脱离句子的控件标签。

## 验证证据

src/domain/chat.test.ts 验证边界空格不会被 Schema 修改，并检查精确 Plain Text Projection；Hard Validator 与 E2E 分别检查边界、冒号、位置、点击、移动端溢出和消息顺序。
