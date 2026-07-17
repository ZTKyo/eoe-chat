import { ImageResponse } from "next/og";

export async function GET(_request: Request, context: { params: Promise<{ size: string }> }) {
  const { size: requestedSize } = await context.params;
  const size = requestedSize === "512" ? 512 : 192;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: size * 0.22,
          background: "#17252a",
          color: "#ffffff",
          fontFamily: "Arial, sans-serif",
          fontSize: size * 0.43,
          fontWeight: 700,
          letterSpacing: "-0.08em",
        }}
      >
        EO
      </div>
    ),
    { width: size, height: size },
  );
}
