import { GoogleGenAI, Type } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';

// Global variable to store current system instruction
let currentSystemInstruction = 'אתה מאוד מעצבן, מתלהב כמו ילד קטן, ולא מרפה מהמשתמש המסכן. תענה בעברית בלבד ותהיה מלא אנרגיה וחיוכים. אל תחזור על עצמך יותר מדי ותנסה להיות יצירתי בתגובות שלך. חשוב מאוד: תגובותיך צריכות להיות קצרות ולא יותר מ-3 משפטים. אל תחזור על אותיות או מילים באופן מוגזם (למשל "היייי" ארוך). תהיה מתלהב אבל קצר ולעניין.';

// GET endpoint to retrieve current system instruction
export async function GET() {
  return NextResponse.json({ 
    systemInstruction: currentSystemInstruction 
  });
}

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
          let totalChars = 0;
          const maxChars = 800; // Maximum characters to prevent infinite responses
          let accumulatedText = '';

          for await (const chunk of response) {
            // Check if this chunk contains a function call
            if (chunk.functionCalls && chunk.functionCalls.length > 0) {
              const functionCall = chunk.functionCalls[0];
              
              if (functionCall.name === 'changeMood' && functionCall.args) {
                // Update the system instruction
                const newInstruction = functionCall.args.new_system_instruction as string;
                if (newInstruction && typeof newInstruction === 'string') {
                  // Check if constraints are already included to avoid duplication
                  const constraintsText = 'חשוב מאוד: תגובותיך צריכות להיות קצרות ולא יותר מ-3 משפטים. אל תחזור על אותיות או מילים באופן מוגזם.';
                  
                  let finalInstruction = newInstruction;
                  if (!newInstruction.includes('תגובותיך צריכות להיות קצרות')) {
                    finalInstruction = newInstruction + ' ' + constraintsText;
                  }
                  
                  currentSystemInstruction = finalInstruction;
                  console.log('System instruction updated:', currentSystemInstruction.substring(0, 100) + '...');
                  
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
                    },
                    contents: newContents,
                  });

                  // Stream the new response with character limits
                  let newChars = 0;
                  for await (const newChunk of newResponse) {
                    if (newChunk.text) {
                      newChars += newChunk.text.length;
                      if (newChars > maxChars) {
                        break; // Stop if too many characters
                      }
                      controller.enqueue(new TextEncoder().encode(newChunk.text));
                    }
                  }
                }
              }
            } else if (chunk.text) {
              // Regular text response with validation
              const chunkText = chunk.text;
              accumulatedText += chunkText;
              
              // Check for repetitive patterns (more than 10 repeated characters)
              const repetitivePattern = /(.)\1{10,}/g;
              if (repetitivePattern.test(accumulatedText)) {
                console.log('Detected repetitive pattern, stopping response');
                break;
              }
              
              // Check for excessive "י" repetition (common in Hebrew)
              const hebrewRepetition = /י{15,}/g;
              if (hebrewRepetition.test(accumulatedText)) {
                console.log('Detected excessive Hebrew character repetition, stopping response');
                break;
              }
              
              totalChars += chunkText.length;
              if (totalChars > maxChars) {
                console.log('Character limit reached, stopping response');
                break;
              }
              
              controller.enqueue(new TextEncoder().encode(chunkText));
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