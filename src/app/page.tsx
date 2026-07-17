import { ChatApp } from "@/components/chat-app";
import { isImageInputConfigured } from "@/lib/features/image-input";

export default function Home() {
  return <ChatApp imageFeatureConfigured={isImageInputConfigured()} />;
}
