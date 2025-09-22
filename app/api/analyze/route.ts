import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const { image } = await request.json()

    if (!image) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 })
    }

    // Extract base64 data from data URL
    const base64Data = image.replace(/^data:image\/[a-z]+;base64,/, "")

    // Make request to Roboflow API
    const response = await fetch("https://serverless.roboflow.com/waste-detection-cbffo-foffi/1", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        api_key: "JJXP81cU10vS9PXmL2iG",
        image: base64Data,
      }),
    })

    if (!response.ok) {
      throw new Error(`Roboflow API error: ${response.status}`)
    }

    const data = await response.json()

    return NextResponse.json(data)
  } catch (error) {
    console.error("Analysis error:", error)
    return NextResponse.json({ error: "Failed to analyze image" }, { status: 500 })
  }
}
