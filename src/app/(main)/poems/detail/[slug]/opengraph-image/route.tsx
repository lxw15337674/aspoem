import { ImageResponse } from "next/og";
import { api } from "@/trpc/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const poem = await api.poem.findDetail({ slug }).catch(() => null);
  if (!poem) return new Response("Not found", { status: 404 });

  return new ImageResponse(
    <div
      style={{
        alignItems: "stretch",
        background: "#f5f3ef",
        color: "#1c1c1a",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        padding: "72px 88px",
        width: "100%",
      }}
    >
      <div
        style={{
          color: "#8b2f2f",
          display: "flex",
          fontSize: 24,
          letterSpacing: 6,
        }}
      >
        ASPOEM
      </div>
      <div
        style={{
          display: "flex",
          fontSize: 68,
          fontWeight: 700,
          marginTop: 72,
        }}
      >
        《{poem.title}》
      </div>
      <div
        style={{
          color: "#625f59",
          display: "flex",
          fontSize: 28,
          marginTop: 20,
        }}
      >
        {poem.dynasty?.name ?? ""} {poem.author.name}
      </div>
      <div
        style={{
          background: "#b7b1a8",
          display: "flex",
          height: 2,
          marginTop: 46,
          width: "100%",
        }}
      />
      <div
        style={{
          display: "flex",
          fontSize: 38,
          lineHeight: 1.55,
          marginTop: 38,
          whiteSpace: "pre-wrap",
        }}
      >
        {poem.paragraphs.join("\n").slice(0, 120)}
      </div>
    </div>,
    { width: 1200, height: 630 },
  );
}
