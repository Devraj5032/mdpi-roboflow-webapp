import { type NextRequest, NextResponse } from "next/server"
import axios from "axios"

export async function POST(request: NextRequest) {
  try {
    const { image } = await request.json()

    if (!image) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 })
    }

    // Define the three models and keys you want to query simultaneously
    const models = [
      { id: "trash-detection-1fjjc-zbcef", apiKey: "RcVRegIMRWGbSBG5P2Y9" },
      { id: "firstsetwaste-xkrmc", apiKey: "RcVRegIMRWGbSBG5P2Y9" },
      { id: "waste-detection-cbffo-foffi", apiKey: "JJXP81cU10vS9PXmL2iG" },
    ] as const

    // Strip base64 header if present
    const payloadImage = (image as string).replace(
      /^data:image\/[a-zA-Z0-9+.-]+;base64,/,
      ""
    )

    const requests = models.map((m) =>
      axios
        .post(`https://serverless.roboflow.com/${m.id}/1?api_key=${m.apiKey}`, payloadImage, {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        })
        .then((r) => ({ id: m.id, ok: true as const, data: r.data }))
        .catch((e) => ({ id: m.id, ok: false as const, error: e?.message || String(e) })),
    )

    const results = await Promise.all(requests)
    const payload: Record<string, unknown> = {}
    for (const r of results) {
      payload[r.id] = r.ok ? r.data : { error: true, message: r.error }
    }

    return NextResponse.json({ models: payload })
  } catch (error: any) {
    console.error("Analysis error:", error.message || error)
    return NextResponse.json(
      { error: "Failed to analyze image", details: error.message },
      { status: 500 }
    )
  }
}
