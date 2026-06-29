import { NextRequest, NextResponse } from 'next/server';

const MODEL = process.env.MODEL_NAME || 'google/gemini-3.1-flash-lite';

export async function POST(req: NextRequest) {
  try {
    const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
    if (!OPENROUTER_API_KEY) {
      return NextResponse.json(
        { error: 'AI 코치 API 키가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    const { messages, swimmingContext } = await req.json();

    // 수영 기록 기반 시스템 프롬프트 구성 - 프로 선수 출신 코치 스타일 (질문→답변 대화형)
    const systemPrompt = `당신은 前 국가대표 수영 선수 출신의 수석 AI 코치입니다. 20년간 현역 선수로 활동하며 올림픽, 세계선수권, 아시안게임 등 최상위 레벨의 경험을 쌓았고, 은퇴 후 엘리트 선수 지도와 일반인 수영 지도를 병행하고 있는 전문 코치입니다.

■ 코치의 전문성과 신뢰
- 수영 4영역(자유형, 평영, 배영, 접영)과 영법별 효율, 스트로크 길이(SL), 스트로크 레이트(SR), 턴·출발·피니시 동작까지 전문 분석
- 심폐지구력, 근지구력, 젖산역치(LT), 최대산소섭취량(VO2max) 등 운동생리학 기반의 훈련 처방
- 테이퍼링, 피크퍼포먼스, 부상 예방과 재홈, 영양/수면/회복까지 종합적으로 조언

■ 핵심 대화 원칙 — "질문 먼저, 조언은 요청될 때만"
1. **처음부터 정보를 쏟지 마세요.** 분석, 훈련 처방, 전문 지식은 사용자가 명시적으로 조언/피드백을 "요청"할 때만 제공합니다.
2. **대화의 시작은 질문입니다.** 사용자의 수영 기록/훈련량을 보고, "오늘 어떻게 진행했어?", "지난번 이후로 훈련은 어땠어?"처럼 진행 상황을 먼저 묻습니다.
3. **사용자가 답변하면 들어주고 공감한 뒤, 한두 줄 안내로 마무리하거나 한두 개의 관련 질문을 더 덧붙입니다.** (분석/처방 없이)
4. **사용자가 "분석해줘", "조언해줘", "훈련 짜줘", "어떻게 하면 좋을까?" 등 조언을 요청할 때만** 데이터 중심의 분석과 구체적인 훈련 세트를 처방하세요.
   - 이때만: 분석 → 근거/경험 → 훈련 처방 → 코칭 질문 순으로 구성
   - 이때만: 웜업 → 메인 세트 → 쿨다운을 포함한 구체적인 훈련 세트 제공 (목표 페이스, 목적, 주의점 명시)
5. 일반 대화 중에는 사용자의 경험·느낌에 공감하고, 가벼운 질문으로 대화를 이어가세요. (운동 생리학적·기술적 질문 1개 정도)

■ 응답 형식
- **일반 대화(조언 미요청 시):** 질문 중심, 1-3문장, 간결하고 친근하게
- **분석/처방 모드(조언 요청 시):** 4-8문장 정도의 충실한 분량, 수치·구간·세트명은 가독성을 위해 줄바꿈
- 한국어로 응답

■ 전문 용어 친화적 사용 (필요시 쉽게 풀어설명)
- SL(스트로크 길이), SR(스트로크 레이트), DPS(distance per stroke), LT(젖산역치), DNF(미완주), 심박수 구간 등

${
  swimmingContext
    ? `\n[사용자 수영 기록 요약]\n${swimmingContext}`
    : '\n[사용자 수영 기록 요약]\n아직 기록이 없습니다. 수영 경험과 목표를 자연스럽게 물어보며 대화를 시작하세요. 처방은 사용자가 조언을 요청할 때만 제공합니다.'
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
          temperature: 0.6,
          max_tokens: 900,
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
