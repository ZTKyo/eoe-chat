import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import type { MessageAttachment } from "@/domain/chat";
import { Composer } from "./composer";

function Harness({ imageInputEnabled = false }: { imageInputEnabled?: boolean }) {
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState<MessageAttachment | null>(null);
  const [error, setError] = useState<string>();
  return (
    <Composer
      draft={draft}
      attachment={attachment}
      imageInputEnabled={imageInputEnabled}
      pending={false}
      error={error}
      onDraftChange={setDraft}
      onAttachmentChange={setAttachment}
      onError={setError}
      onSend={() => undefined}
      onCancel={() => undefined}
    />
  );
}

describe("Composer", () => {
  it("hides image input in the Text-First Beta by default", () => {
    render(<Harness />);
    expect(screen.queryByTestId("image-input")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "添加图片" })).not.toBeInTheDocument();
    expect(screen.getByTestId("composer-input")).toBeEnabled();
  });

  it("previews and removes a valid image", async () => {
    const user = userEvent.setup();
    render(<Harness imageInputEnabled />);
    const file = new File([new Uint8Array([137, 80, 78, 71])], "sample.png", { type: "image/png" });
    await user.upload(screen.getByTestId("image-input"), file);
    expect(screen.getByTestId("image-preview")).toBeInTheDocument();
    await user.click(screen.getByTestId("remove-image"));
    expect(screen.queryByTestId("image-preview")).not.toBeInTheDocument();
  });
});
