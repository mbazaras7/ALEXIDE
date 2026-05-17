import { openai, OPENAI_MODEL } from '../config/openai';
import { buildSubmissionFeedbackPrompt } from '../prompts/submissionFeedback';
import { AiFeedbackInput, AiFeedbackOutput } from '../types/aiFeedback';

export class AiFeedbackService {
  async generateSubmissionFeedback(input: AiFeedbackInput): Promise<AiFeedbackOutput> {
    const prompt = buildSubmissionFeedbackPrompt(input);

    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
      temperature: 0.7,
    });

    const feedback =
      response.choices[0]?.message?.content?.trim() ?? 'Feedback could not be generated.';

    return {
      feedback,
      generatedAt: new Date(),
    };
  }
}

export const aiFeedbackService = new AiFeedbackService();
