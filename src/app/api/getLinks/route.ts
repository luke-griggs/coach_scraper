import OpenAI from "openai"
import { NextRequest, NextResponse } from "next/server"


const key = process.env.PERPLEXITY_KEY ?? ""

export async function POST(request: NextRequest){
     
     const body = await request.text();
     const schoolArray = JSON.parse(body);

    const client = new OpenAI({
        apiKey: key,
        baseURL: "https://api.perplexity.ai",
    })

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        {
          role: "user",
          content: `I'm going to give you an array of colleges, your task is to return to me the urls to each of these schools athletic staff directory sites. Your response should only include an array of these urls... nothing else. Here are the schools: ${schoolArray}`,
        },
      ];

    try{
        const response = await client.chat.completions.create({
            messages,
            model: "llama-3.1-sonar-small-128k-online"
        });

        const urlList = response.choices[0].message.content
        return NextResponse.json(urlList);
        
    
    } catch(error) {
        console.error(error);
        return NextResponse.json({error: "something went wrong while getting links"})
    }
}