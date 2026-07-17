import { describe, expect, it } from "vitest";
import { parseVisionObservation } from "./vision-observation";

describe("Vision Observation Contract", () => {
  it("accepts grounded observations", () => {
    expect(parseVisionObservation(JSON.stringify({
      schemaVersion: "eoe.vision-observation.v1",
      observations: [{ description: "界面中央有一个蓝色 Start 按钮", confidence: "high" }],
      visibleText: ["Start"],
      uncertainties: ["状态文字末尾被遮挡"],
    })).envelope?.observations).toHaveLength(1);
  });

  it("rejects an empty observation list", () => {
    expect(parseVisionObservation(JSON.stringify({
      schemaVersion: "eoe.vision-observation.v1",
      observations: [],
      visibleText: [],
      uncertainties: [],
    })).violations).toContain("vision_observation_missing");
  });

  it("normalizes the GLM Vision element/details response without weakening the Domain schema", () => {
    const result = parseVisionObservation(JSON.stringify({
      observations: [
        {
          element: "blue rectangle",
          confidence: "high",
          details: "left side of the image",
        },
      ],
      visibleText: "Geometry fixture",
      uncertainties: [],
    }));
    expect(result.violations).toEqual([]);
    expect(result.envelope).toEqual({
      schemaVersion: "eoe.vision-observation.v1",
      observations: [{ description: "blue rectangle: left side of the image", confidence: "high" }],
      visibleText: ["Geometry fixture"],
      uncertainties: [],
    });
  });

  it("normalizes object uncertainties and per-observation visible text", () => {
    const result = parseVisionObservation(JSON.stringify({
      observations: [
        {
          element: "按钮",
          confidence: "high",
          visibleText: "Continue",
          details: "界面底部的绿色按钮",
        },
      ],
      uncertainties: [
        { name: "按钮行为", details: "图片无法确认点击后的结果" },
      ],
    }));
    expect(result.violations).toEqual([]);
    expect(result.envelope?.visibleText).toEqual(["Continue"]);
    expect(result.envelope?.uncertainties).toEqual(["按钮行为: 图片无法确认点击后的结果"]);
  });
});
