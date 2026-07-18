import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PwaInstallButton } from "./pwa-install-button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function createBeforeInstallPromptEvent(outcome: "accepted" | "dismissed"): BeforeInstallPromptEvent {
  const prompt = vi.fn().mockResolvedValue(undefined);
  const userChoice = Promise.resolve({ outcome });
  const event = new Event("beforeinstallprompt") as BeforeInstallPromptEvent;
  Object.defineProperty(event, "prompt", { value: prompt });
  Object.defineProperty(event, "userChoice", { value: userChoice });
  Object.defineProperty(event, "preventDefault", { value: vi.fn() });
  return event;
}

describe("PwaInstallButton", () => {
  let originalMatchMedia: typeof window.matchMedia;
  let originalUserAgent: string;
  let originalStandalone: unknown;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
    originalUserAgent = navigator.userAgent;
    originalStandalone = (navigator as Navigator & { standalone?: boolean }).standalone;

    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    });
    delete (navigator as Navigator & { standalone?: boolean }).standalone;
  });

  afterEach(() => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: originalMatchMedia,
    });
    Object.defineProperty(navigator, "userAgent", { configurable: true, value: originalUserAgent });
    if (originalStandalone !== undefined) {
      (navigator as Navigator & { standalone?: boolean }).standalone = originalStandalone as boolean | undefined;
    } else {
      delete (navigator as Navigator & { standalone?: boolean }).standalone;
    }
    vi.clearAllMocks();
  });

  it("is hidden in standalone display mode", () => {
    (window.matchMedia as unknown as ReturnType<typeof vi.fn>).mockImplementation((query: string) => ({
      matches: query === "(display-mode: standalone)",
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    render(<PwaInstallButton />);
    expect(screen.queryByTestId("pwa-install-button")).not.toBeInTheDocument();
  });

  it("shows the install button after beforeinstallprompt and prompts on click", async () => {
    render(<PwaInstallButton />);
    // Before the event, the button is already visible in "unsupported" guidance mode.
    expect(screen.getByTestId("pwa-install-button")).toBeInTheDocument();

    const event = createBeforeInstallPromptEvent("accepted");
    await act(async () => {
      window.dispatchEvent(event);
    });

    const button = screen.getByTestId("pwa-install-button");
    expect(button).toHaveAccessibleName("安装 EOE Chat 到设备");

    await act(async () => {
      fireEvent.click(button);
    });
    await act(async () => {
      await event.userChoice;
    });

    expect(screen.queryByTestId("pwa-install-button")).not.toBeInTheDocument();
  });

  it("keeps the button after the user dismisses the prompt without re-prompting", async () => {
    render(<PwaInstallButton />);
    const event = createBeforeInstallPromptEvent("dismissed");
    await act(async () => {
      window.dispatchEvent(event);
    });
    const button = screen.getByTestId("pwa-install-button");
    await act(async () => {
      fireEvent.click(button);
    });
    await act(async () => {
      await event.userChoice;
    });
    // Button remains available; user may retry. We just verify it is still there.
    expect(screen.getByTestId("pwa-install-button")).toBeInTheDocument();
  });

  it("hides after appinstalled event", async () => {
    render(<PwaInstallButton />);
    const event = createBeforeInstallPromptEvent("accepted");
    await act(async () => {
      window.dispatchEvent(event);
    });
    const button = screen.getByTestId("pwa-install-button");
    await act(async () => {
      fireEvent.click(button);
    });
    await act(async () => {
      await event.userChoice;
    });
    // Re-render with a fresh event and then fire appinstalled.
    const secondEvent = createBeforeInstallPromptEvent("accepted");
    await act(async () => {
      window.dispatchEvent(secondEvent);
    });
    await act(async () => {
      window.dispatchEvent(new Event("appinstalled"));
    });
    expect(screen.queryByTestId("pwa-install-button")).not.toBeInTheDocument();
  });

  it("shows iOS instructions on iOS Safari", async () => {
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    });
    render(<PwaInstallButton />);
    const button = screen.getByTestId("pwa-install-button");
    await act(async () => {
      fireEvent.click(button);
    });
    const dialog = await screen.findByTestId("pwa-install-dialog");
    expect(dialog).toHaveAccessibleName("安装 EOE Chat 说明");
    expect(dialog).toHaveTextContent("添加到主屏幕");
  });

  it("shows unsupported-browser guidance when no install event arrives", async () => {
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    });
    // No beforeinstallprompt dispatched; component defaults to unsupported.
    render(<PwaInstallButton />);
    const button = screen.getByTestId("pwa-install-button");
    await act(async () => {
      fireEvent.click(button);
    });
    const dialog = await screen.findByTestId("pwa-install-dialog");
    expect(dialog).toHaveTextContent("Chrome");
    expect(dialog).toHaveTextContent("Edge");
  });

  it("is keyboard operable and exposes an accessible name", async () => {
    render(<PwaInstallButton />);
    const event = createBeforeInstallPromptEvent("accepted");
    await act(async () => {
      window.dispatchEvent(event);
    });
    const button = screen.getByTestId("pwa-install-button");
    expect(button).toHaveAttribute("aria-label");
    button.focus();
    expect(document.activeElement).toBe(button);
  });

  it("closes the install dialog via the close button", async () => {
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    });
    render(<PwaInstallButton />);
    const button = screen.getByTestId("pwa-install-button");
    await act(async () => {
      fireEvent.click(button);
    });
    const dialog = await screen.findByTestId("pwa-install-dialog");
    expect(dialog).toBeInTheDocument();
    const close = screen.getByRole("button", { name: "关闭安装说明" });
    await act(async () => {
      fireEvent.click(close);
    });
    expect(screen.queryByTestId("pwa-install-dialog")).not.toBeInTheDocument();
  });
});
