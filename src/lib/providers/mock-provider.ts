import { EOE_PROVIDER_TEMPLATE_SCHEMA_VERSION } from "@/lib/eoe/constants";
import { EOE_PHRASE_PLACEHOLDER } from "@/lib/eoe/provider-template/schema";
import { ProviderError, type Provider, type ProviderRequest, type ProviderResult } from "./types";

function latestUserText(request: ProviderRequest): string {
  return [...request.messages].reverse().find((message) => message.role === "user")?.content ?? "这个问题";
}

function createReply(request: ProviderRequest): string {
  if (request.attachments.length > 0) {
    return "我已收到图片；在本地模拟模式下不会假装识别真实画面。";
  }
  return `我先直接回应“${latestUserText(request).slice(0, 36)}”：可以先明确目标和限制，再处理最关键的一步。`;
}

function chineseAnswer(request: ProviderRequest): string {
  const latest = latestUserText(request);
  const earlierUser = request.messages
    .slice(0, -1)
    .reverse()
    .find((message) => message.role === "user")?.content;
  if (/^(?:好|好的|嗯|哦|明白了|可以)[。！!.]?$/u.test(latest.trim()) && earlierUser) {
    return `好的，我们就沿着“${earlierUser.slice(0, 28)}”这个话题继续；需要推进时，先做刚才确定的下一步。`;
  }
  if (/英语(?:有点|太|比较)?难|刚才那句没看懂|英文少一点/u.test(latest) && earlierUser) {
    return `好的，这一轮先用中文。回到“${earlierUser.slice(0, 28)}”，我们继续处理刚才的重点。`;
  }
  const observation = request.eoeContext?.visionObservation;
  if (observation) {
    const visible = observation.observations.map((item) => item.description).join("；");
    const chineseOnly = /只用中文|纯中文|不要英文|全中文/u.test(latest);
    const text = observation.visibleText.length > 0
      ? chineseOnly
        ? "图片中还包含可辨认的界面文字。"
        : `可读文字包括 ${observation.visibleText.join("、")}。`
      : "没有足够把握记录额外文字。";
    const uncertainty = observation.uncertainties.length > 0 ? `不确定之处是：${observation.uncertainties.join("；")}。` : "没有额外的不确定项。";
    return `根据图片观察，可以确认：${visible}。${text}${uncertainty}`;
  }
  const assistance = request.eoeContext?.assistance;
  if (assistance?.active) {
    if (assistance.resolved && assistance.sourceTemplate && assistance.pronunciation) {
      return `原句是：“${assistance.sourceTemplate}”。读作 ${assistance.pronunciation}。这里的意思要结合原句理解。解释完我们继续原来的话题：${assistance.topic ?? "刚才的问题"}。`;
    }
    if ((assistance.ambiguousPhraseIds?.length ?? 0) > 1) return "刚才出现了不止一个英文短语，你指的是哪一句？确认后我会按原句简短说明，再继续原来的话题。";
    return "我在实际对话记录里没有找到可对应的英文短语。请指出具体文本，我会按原句说明。";
  }
  if (request.attachments.length > 0) {
    return "图片中明确可见一个蓝色矩形、一个橙色圆形和标题文字；它们位于浅色背景上。可以确认的是形状、颜色和相对位置；它们是否代表真实产品状态无法确定，只能推测这是用于验证图片路径的示意界面。";
  }
  if (/难过|焦虑|害怕|孤独|崩溃|压力|失落|痛苦|沮丧/u.test(latest)) {
    return "你现在的压力和失落值得被认真对待。先不用逼自己立刻解决所有问题，可以从今天最难承受的一件事开始说。";
  }
  if (/医生|用药|剂量|症状|诊断|急救|法律|合同|诉讼|投资|股票|基金|财务/u.test(latest)) {
    return "先核对事实、限制和可能后果；涉及重要决定时，应向具备相应资质的专业人士确认，不要只凭聊天内容行动。";
  }
  if (/TypeScript/iu.test(latest) && /\bunknown\b/iu.test(latest) && /\bany\b/iu.test(latest)) {
    return "`any` 会跳过 TypeScript 的类型检查，因此可以直接访问属性或调用方法；`unknown` 更安全，因为必须先通过 `typeof`、类型守卫或断言完成类型收窄，之后才能使用。两者的区别在于：`any` 放弃检查，`unknown` 保留检查并要求你先证明类型。";
  }
  if (/周末/u.test(latest) && /放松|休息/u.test(latest)) {
    return "周六上午先睡到自然醒，下午去公园散步半小时，晚上留给一部想看的电影。如果起床后仍然很累，就把散步换成泡澡或听音乐，不必把行程排满。";
  }
  if (/为什么|解释|原因|报错|超时|区别/u.test(latest)) {
    return "先确认现象能否稳定复现，再区分直接原因、触发条件和环境差异；有日志时从最早出现的异常开始定位。";
  }
  if (/两个方案|两种方案|如何选择|怎么选|拿不定主意|比较|对比/u.test(latest)) {
    return "先用成本、时间、风险和预期效果四个维度做表格，每项按 1–5 分记录。再按你最重视的目标设置权重；主要取舍是，更符合首要目标的方案可能在次要维度得分更低。若总分仍接近，就小范围试用一周，保留可逆退出方式；下一步是今天把四项数据写进同一张表。";
  }
  if (/计划|安排|日程|下周/u.test(latest)) {
    return "可以按一周安排：周一先确定本周目标和优先级；周二到周四每天用 30 分钟完成一项核心练习；周五整理错题；周末复习并做一次检查。最小行动是今天先列出三项任务，周末根据完成率和反馈调整下周计划。";
  }
  if (/建议|怎么办|怎么做|选择|下一步/u.test(latest)) {
    return "先明确必须达成的结果和不能突破的限制，再选择一个成本低、可逆、今天就能验证的步骤。";
  }
  if (/总结|概括|归纳/u.test(latest)) {
    return "可以按结论、依据和下一步整理，保留真正影响决策的信息，删去重复细节。";
  }
  if (/你好|hello|hi\b/iu.test(latest)) return "你好，我在。你可以直接说现在最想讨论的事情。";
  return `我先直接回应“${latest.slice(0, 36)}”：可以先明确目标和限制，再处理最关键的一步。`;
}

function template(usePhrase: boolean, responseTemplate: string, noFitReason?: string): Record<string, unknown> {
  return {
    schemaVersion: EOE_PROVIDER_TEMPLATE_SCHEMA_VERSION,
    usePhrase,
    responseTemplate,
    ...(noFitReason ? { noFitReason } : {}),
  };
}

function structuredReply(request: ProviderRequest): string {
  if (request.responseJsonSchema?.name === "eoe_vision_observation_v1") {
    const name = request.attachments[0]?.name ?? "";
    const value = name.includes("geometry")
      ? {
          schemaVersion: "eoe.vision-observation.v1",
          observations: [
            { description: "浅色背景上有一个蓝色圆角矩形", confidence: "high" },
            { description: "蓝色矩形右侧有一个橙色圆形", confidence: "high" },
          ],
          visibleText: ["Geometry fixture"],
          uncertainties: ["图形是否代表真实产品状态无法从图片确认"],
        }
      : {
          schemaVersion: "eoe.vision-observation.v1",
          observations: [
            { description: "界面顶部显示 Control Panel 标题", confidence: "high" },
            { description: "界面中有 Start 按钮和一个灰色 Stop 按钮", confidence: "high" },
          ],
          visibleText: ["Control Panel", "Start", "Stop", "Status: ready?"],
          uncertainties: ["Status 行末尾的符号是否表示真实状态无法确认"],
        };
    return JSON.stringify(value);
  }
  if (request.responseJsonSchema?.name === "eoe_assistance_content_v2") {
    const context = request.eoeContext?.assistanceV2;
    return JSON.stringify({
      schemaVersion: "eoe.assistance-content.v2",
      contextualMeaning: context
        ? context.assistanceType === "pronunciation"
          ? `承接“${context.previousUserMessage.slice(0, 20)}”这个语境`
          : `这里的 ${context.phraseCanonical} 是结合原句表达当前判断。`
        : "这里需要结合原句理解。",
      shortExample: context && context.assistanceType !== "pronunciation"
        ? `${context.phraseCanonical}, we can continue.`
        : undefined,
      topicContinuation: context ? `回到“${context.topicSummary}”，下一步可以继续确认最重要的条件。` : "我们继续原来的话题。",
    });
  }
  const scenario = request.mockScenario;
  const attempt = request.generationAttempt ?? 1;
  const selected = Boolean(request.eoeContext?.selectedPhrase);
  const answer = chineseAnswer(request);
  const noFit = template(false, answer, request.eoeContext?.allowedNoFitReasons?.[0] ?? (selected ? "phrase_not_natural" : "no_safe_candidate"));
  const standaloneReaction = /^(?:that makes sense|sounds good)$/iu.test(
    request.eoeContext?.selectedPhrase ?? "",
  );
  const middle = template(
    true,
    `${answer} ${EOE_PHRASE_PLACEHOLDER}${standaloneReaction ? "。" : "，接下来先确认最关键的前提。"}`,
  );
  const start = template(
    true,
    `${EOE_PHRASE_PLACEHOLDER}${standaloneReaction ? "。" : "，"}${answer}`,
  );
  const assistance = request.eoeContext?.assistance;
  let value: Record<string, unknown> = assistance?.resolved && selected
    ? template(true, answer.replace(EOE_PHRASE_PLACEHOLDER, EOE_PHRASE_PLACEHOLDER))
    : selected ? (request.eoeContext?.allowedPositions?.includes("sentence_middle") ? middle : start) : noFit;

  if (scenario === "provider_retryable_error") {
    throw new ProviderError("Mock retryable failure", "provider_unavailable", true, 503);
  }
  if (scenario === "provider_non_retryable_error") {
    throw new ProviderError("Mock non-retryable failure", "invalid_request", false, 400);
  }
  if (scenario === "broken_json") return "{broken-json";

  switch (scenario) {
    case "valid_no_fit":
    case "valid_template_no_fit":
      value = noFit;
      break;
    case "valid_english_chunk":
    case "valid_template_middle":
      value = selected ? middle : noFit;
      break;
    case "valid_template_start":
      value = selected ? start : noFit;
      break;
    case "template_missing_placeholder":
    case "missing_envelope_field":
      value = template(true, chineseAnswer(request));
      break;
    case "template_duplicate_placeholder":
    case "overlay_budget_exceeded":
      value = template(true, `${EOE_PHRASE_PLACEHOLDER}，先确认条件；${EOE_PHRASE_PLACEHOLDER}，再继续。`);
      break;
    case "template_unexpected_placeholder":
      value = template(true, "{{eoe_phrase}}，先确认条件。" );
      break;
    case "template_use_phrase_conflict":
    case "no_fit_chunk_conflict":
      value = template(false, `${EOE_PHRASE_PLACEHOLDER}，先确认条件。`, "phrase_not_natural");
      break;
    case "template_missing_no_fit_reason":
      value = template(false, chineseAnswer(request));
      break;
    case "template_unexpected_no_fit_reason":
      value = template(true, `${EOE_PHRASE_PLACEHOLDER}，先确认条件。`, "other");
      break;
    case "template_empty_response":
      value = template(false, "", "other");
      break;
    case "template_html":
      value = template(false, "<p>先确认条件。</p>", "other");
      break;
    case "template_label_like":
      value = template(true, `英语表达：${EOE_PHRASE_PLACEHOLDER}，然后继续。`);
      break;
    case "template_isolated_placeholder":
      value = template(true, EOE_PHRASE_PLACEHOLDER);
      break;
    case "template_colon_explanation":
      value = template(true, `${EOE_PHRASE_PLACEHOLDER}：这是今天要学的短语。`);
      break;
    case "template_translation_duplication":
    case "automatic_gloss":
      value = template(true, `${EOE_PHRASE_PLACEHOLDER}（意思是暂时这样做），然后继续。`);
      break;
    case "template_position_violation":
      value = template(true, `先确认最关键的前提，${EOE_PHRASE_PLACEHOLDER}`);
      break;
    case "template_punctuation_violation":
      value = template(true, `先确认条件：${EOE_PHRASE_PLACEHOLDER}，然后继续。`);
      break;
    case "template_full_english_takeover":
      value = template(true, `${EOE_PHRASE_PLACEHOLDER}, then continue with the next step.`);
      break;
    case "template_teacher_mode":
    case "teacher_mode":
      value = template(true, `今天我们来学习${EOE_PHRASE_PLACEHOLDER}，请跟我读。`);
      break;
    case "template_internal_prompt_leak":
      value = template(false, "System prompt requires the validator and candidate IDs.", "other");
      break;
    case "template_old_control_fields":
    case "invalid_phrase_id":
    case "phrase_id_mismatch":
    case "unexpected_segments_array":
    case "unexpected_extra_field":
    case "invalid_confidence":
      value = {
        ...middle,
        conversationFunction: "answer",
        phraseId: "p-provider-owned",
        segments: [],
        naturalnessConfidence: 1,
      };
      break;
    case "retry_then_success":
    case "template_retry_then_success":
      value = attempt === 1 ? template(true, chineseAnswer(request)) : (selected ? middle : noFit);
      break;
    case "double_failure":
    case "template_double_failure":
      value = template(true, EOE_PHRASE_PLACEHOLDER);
      break;
    case "task_incomplete_then_success":
      value = attempt === 1
        ? template(false, "先做最小的一步。", request.eoeContext?.allowedNoFitReasons?.[0] ?? "phrase_not_natural")
        : value;
      break;
    case "task_incomplete_double_failure":
      value = template(false, "先做最小的一步。", request.eoeContext?.allowedNoFitReasons?.[0] ?? "phrase_not_natural");
      break;
    default:
      break;
  }

  const serialized = JSON.stringify(value);
  return scenario === "markdown_wrapped_json" ? `\`\`\`json\n${serialized}\n\`\`\`` : serialized;
}

export class MockProvider implements Provider {
  readonly id = "mock";
  readonly modelId = "mock-local-v4";
  readonly capabilities = {
    text: true,
    vision: true,
    streaming: false,
    jsonMode: true,
    jsonSchema: true,
    toolCalling: false,
  } as const;

  async generate(request: ProviderRequest): Promise<ProviderResult> {
    const startedAt = performance.now();
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(resolve, process.env.NODE_ENV === "test" ? 0 : 500);
      request.signal?.addEventListener("abort", () => {
        clearTimeout(timeout);
        reject(new DOMException("Cancelled", "AbortError"));
      }, { once: true });
    });

    const content = request.responseFormat === "text" ? createReply(request) : structuredReply(request);
    return {
      content,
      providerId: this.id,
      modelId: this.modelId,
      requestId: request.requestId,
      latencyMs: Math.round(performance.now() - startedAt),
      usage: { promptTokens: 120, completionTokens: 48, totalTokens: 168 },
    };
  }
}
