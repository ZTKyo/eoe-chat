import { describe, expect, it } from "vitest";
import { analyzeConversation } from "./conversation-analyzer";

describe("Conversation Function classifier", () => {
  it.each([
    ["我最近压力很大，很焦虑", false, "empathize", "emotional"],
    ["这个报错为什么出现？", false, "explain", "technical"],
    ["我该怎么办，给我一个建议", false, "advise", "normal"],
    ["总结一下上面的重点", false, "summarize", "normal"],
    ["看看这张图", true, "analyze_image", "normal"],
  ] as const)("standardizes %s", (userMessage, hasImage, fn, sensitivity) => {
    const result = analyzeConversation({ userMessage, hasImage });
    expect(result.primaryFunction).toBe(fn);
    expect(result.sensitivity).toBe(sensitivity);
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  it("does not translate the user while classifying", () => {
    const input = "请只用中文，我没有看懂";
    const result = analyzeConversation({ userMessage: input, hasImage: false });
    expect(result.overlaySuitability).toBe("none");
    expect(JSON.stringify(result)).not.toContain("English");
  });
});
