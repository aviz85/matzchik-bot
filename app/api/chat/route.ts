import { GoogleGenAI, Type } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';

// Global variable to store current system instruction
let currentSystemInstruction = 'אתה מאוד מעצבן, מתלהב כמו ילד קטן, ולא מרפה מהמשתמש המסכן. תענה בעברית בלבד ותהיה מלא אנרגיה וחיוכים. אל תחזור על עצמך יותר מדי ותנסה להיות יצירתי בתגובות שלך.';

export async function POST(request: NextRequest) {
  try {
    const { message, history } = await request.json();

    if (!process.env.GOOGLE_API_KEY) {
      return NextResponse.json(
        { error: 'Google API key not configured' },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GOOGLE_API_KEY,
    });

    // Define the changeMood function
    const tools = [
      {
        functionDeclarations: [
          {
            name: 'changeMood',
            description: 'the bot can change his mood according to the conversation, use it only if you need to change your mood once the conversation refer to it. you need to pass full system instruction that instruct the bot to the new behaviour with the new mood',
            parameters: {
              type: Type.OBJECT,
              properties: {
                new_system_instruction: {
                  type: Type.STRING,
                },
              },
            },
          },
        ],
      }
    ];

    const config = {
      tools,
      responseMimeType: 'text/plain',
    };

    const model = 'gemini-2.0-flash';

    // Build the conversation contents
    const contents = [
      {
        role: 'user',
        parts: [
          {
            text: currentSystemInstruction,
          },
        ],
      },
      ...history,
      {
        role: 'user',
        parts: [
          {
            text: message,
          },
        ],
      },
    ];

    const response = await ai.models.generateContentStream({
      model,
      config,
      contents,
    });

    // Create a ReadableStream to handle the response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of response) {
            // Check if this chunk contains a function call
            if (chunk.functionCalls && chunk.functionCalls.length > 0) {
              const functionCall = chunk.functionCalls[0];
              
              if (functionCall.name === 'changeMood' && functionCall.args) {
                // Update the system instruction
                const newInstruction = functionCall.args.new_system_instruction as string;
                if (newInstruction && typeof newInstruction === 'string') {
                  currentSystemInstruction = newInstruction;
                  
                  // Send a confirmation message to the stream
                  const confirmationText = '🎭 *מצב הרוח השתנה!* ';
                  controller.enqueue(new TextEncoder().encode(confirmationText));
                  
                  // Continue the conversation with new mood by making another request
                  const newContents = [
                    {
                      role: 'user',
                      parts: [
                        {
                          text: currentSystemInstruction,
                        },
                      ],
                    },
                    ...history,
                    {
                      role: 'user',
                      parts: [
                        {
                          text: message,
                        },
                      ],
                    },
                  ];

                  const newResponse = await ai.models.generateContentStream({
                    model,
                    config: {
                      responseMimeType: 'text/plain',
                      // Remove tools for the follow-up response to avoid infinite loops
                    },
                    contents: newContents,
                  });

                  // Stream the new response
                  for await (const newChunk of newResponse) {
                    if (newChunk.text) {
                      controller.enqueue(new TextEncoder().encode(newChunk.text));
                    }
                  }
                }
              }
            } else if (chunk.text) {
              // Regular text response
              controller.enqueue(new TextEncoder().encode(chunk.text));
            }
          }
        } catch (error) {
          console.error('Error in stream processing:', error);
          controller.error(error);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('Error in chat API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 