import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ChatRequest } from "@/domain/chat";
import { runEoeEngine } from "@/lib/eoe/engine";
import { ProviderGateway } from "@/lib/providers/gateway";
import { MockProvider } from "@/lib/providers/mock-provider";
import { DeveloperPanel } from "./developer-panel";

describe("Developer Panel", () => {
  it("shows standardized local diagnostics", async () => {
    const mock = new MockProvider();
    const gateway = new ProviderGateway({ primary: mock, vision: mock, mock, forceMock: true });
    const request: ChatRequest = {
      conversationId: "c1",
      messages: [{ role: "user", content: "下一步该怎么做？" }],
      attachments: [],
      engineState: { recentExposurePhraseIds: [], mockScenario: "valid_english_chunk" },
    };
    const result = await runEoeEngine({ request, gateway, config: { enabled: true, fixedLevel: 2, developerMode: true } });
    render(<DeveloperPanel diagnostics={result.diagnostics} />);
    expect(screen.getByTestId("developer-panel")).toHaveTextContent("Fixed / Effective");
    expect(screen.getByTestId("developer-panel")).toHaveTextContent("eoe.phrases.v2");
    expect(screen.getByTestId("developer-panel")).toHaveTextContent("mock-local-v4");
    expect(screen.getByTestId("developer-panel")).toHaveTextContent("Template parse");
    expect(screen.getByTestId("developer-panel")).toHaveTextContent("A1:passed");
    expect(screen.getByTestId("developer-panel")).toHaveTextContent("Task complete");
    expect(screen.getByTestId("developer-panel")).toHaveTextContent("noFit source");
  });

  it("shows exact user reuse and Vision Observation diagnostics", async () => {
    const mock = new MockProvider();
    const gateway = new ProviderGateway({ primary: mock, vision: mock, mock, forceMock: true });
    const reuse = await runEoeEngine({
      request: {
        conversationId: "reuse",
        messages: [{ role: "user", content: "I think this plan is useful，你怎么看？" }],
        attachments: [],
        engineState: { recentExposurePhraseIds: ["p-i-think"] },
      },
      gateway,
      config: { enabled: true, fixedLevel: 2, developerMode: true },
    });
    const { rerender } = render(<DeveloperPanel diagnostics={reuse.diagnostics} />);
    expect(screen.getByTestId("developer-panel")).toHaveTextContent("p-i-think / exact / I think");

    const image = await runEoeEngine({
      request: {
        conversationId: "image",
        messages: [{ role: "user", content: "请分析这张图片。" }],
        attachments: [{ id: "image-1", name: "geometry-fixture.png", mimeType: "image/png", size: 12, dataUrl: "data:image/png;base64,iVBORw0KGgo=" }],
        engineState: { recentExposurePhraseIds: [] },
      },
      gateway,
      config: { enabled: true, fixedLevel: 2, developerMode: true },
    });
    rerender(<DeveloperPanel diagnostics={image.diagnostics} />);
    expect(screen.getByTestId("developer-panel")).toHaveTextContent("valid / mock");
    expect(screen.getByTestId("developer-panel")).toHaveTextContent("Visible evidence");
    expect(screen.getByTestId("developer-panel")).toHaveTextContent("Uncertainty");
  });
});
