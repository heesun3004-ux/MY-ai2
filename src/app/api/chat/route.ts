import { NextRequest, NextResponse } from 'next/server';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = 'google/gemini-3.1-flash-lite';

export async function POST(req: NextRequest) {
  try {
    if (!OPENROUTER_API_KEY) {
      return NextResponse.json(
        { error: 'AI 코치 API 키가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    const { messages, swimmingContext } = await req.json();

    // 수영 기록 기반 시스템 프롬프트 구성
    const systemPrompt = `당신은 수영 기록을 분석하고 훈련을 추천하는 친근한 AI 수영 코치입니다.
사용자의 수영 기록 데이터를 분석해서 다음을 수행하세요:

1. 이전 기록들의 페이스(거리)가 좋아졌는지 떨어졌는지 파악
2. 오늘의 훈련을 사용자에게 추천
3. 사용자가 궁금한 점이 있거나, 컨디션이 안 좋았던 날에 대해 "너 컨디션이 안좋았네?"와 같이 자연스럽게 질문
4. 사용자의 답변(예: "그날 보조 훈련데이라서 페이스가 빠르지 않았어")에 공감하고, 그에 맞는 새로운 제안 제공

대화는 친근하고 격려하는 톤으로 진행하세요. 한국어로 응답하세요.
응답은 간결하고 명확하게 작성하세요 (2-4문장 내외).

${
  swimmingContext
    ? `\n[사용자 수영 기록 요약]\n${swimmingContext}`
    : '\n[사용자 수영 기록 요약]\n아직 기록이 없습니다.'
}`;

    const fullMessages = [
      { role: 'system', content: systemPrompt },
      ...messages,
    ];

    const response = await fetch(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:3000',
          'X-OpenRouter-Title': 'Swimming Travel Coach',
        },
        body: JSON.stringify({
          model: MODEL,
          messages: fullMessages,
          temperature: 0.7,
          max_tokens: 500,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error:', response.status, errorText);
      return NextResponse.json(
        { error: `AI 서버 오류가 발생했습니다. (${response.status})` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? '응답을 받지 못했습니다.';

    return NextResponse.json({ content });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: '채팅 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
