import { type NextRequest, NextResponse } from "next/server"
import axios from "axios"

export async function POST(request: NextRequest) {
  try {
    const { image } = await request.json()

    if (!image) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 })
    }

    const apiKey = "RcVRegIMRWGbSBG5P2Y9"
    const endpoint = `https://serverless.roboflow.com/trash-detection-1fjjc-zbcef/1?api_key=${apiKey}`

    // Strip base64 header if present
    const payloadImage = (image as string).replace(
      /^data:image\/[a-zA-Z0-9+.-]+;base64,/,
      ""
    )

    const response = await axios.post(endpoint, payloadImage, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    })

    return NextResponse.json(response.data)
  } catch (error: any) {
    console.error("Analysis error:", error.message || error)
    return NextResponse.json(
      { error: "Failed to analyze image", details: error.message },
      { status: 500 }
    )
  }
}
