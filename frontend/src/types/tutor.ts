import type { SourceCitation } from './rag';

export type PedagogicalMode = 
  | 'socratic'
  | 'analogy'
  | 'first_principles'
  | 'misconception_buster'
  | 'exam_prep'
  | 'deep_dive'
  | 'quick_review';

export interface PedagogicalModeMeta {
  mode: PedagogicalMode;
  label: string;
  badge: string;
  description: string;
  iconName: string;
  colorClass: string;
  bgLightClass: string;
  borderClass: string;
  prompts: string[];
}

export interface TutorMessage {
  id: string;
  session_id: string;
  sender: 'user' | 'assistant';
  content: string;
  pedagogical_mode: PedagogicalMode;
  citations: SourceCitation[];
  created_at: string;
}

export interface TutorSession {
  id: string;
  course_id: string;
  user_id: string;
  title: string;
  pedagogical_mode: PedagogicalMode;
  created_at: string;
  updated_at: string;
}

export interface TutorSessionDetail extends TutorSession {
  messages: TutorMessage[];
}

export interface CreateSessionPayload {
  title?: string;
  pedagogical_mode?: PedagogicalMode;
}

export interface SendMessagePayload {
  content: string;
  language?: string;
}

export interface UpdateModePayload {
  pedagogical_mode: PedagogicalMode;
}

export interface RemediationSessionPayload {
  source_type: 'assessment_mistake' | 'bkt_concept';
  attempt_id?: string;
  question_id?: string;
  concept_label?: string;
  question_text?: string;
  student_answer?: string;
  correct_answer?: string;
  error_category?: string;
  misconception_explanation?: string;
  pedagogical_mode?: PedagogicalMode;
}

export const PEDAGOGICAL_MODES: Record<PedagogicalMode, PedagogicalModeMeta> = {
  socratic: {
    mode: 'socratic',
    label: 'Guided Thinking',
    badge: 'Think & Learn',
    description: 'Guides you with simple, friendly questions so you can easily understand the concept step-by-step.',
    iconName: 'HelpCircle',
    colorClass: 'text-amber-400',
    bgLightClass: 'bg-amber-500/10',
    borderClass: 'border-amber-500/30',
    prompts: [
      'Can you explain the main idea of my uploaded notes in simple words?',
      'Why is this concept important in this subject?',
      'How does this topic connect to the rest of my chapter?'
    ]
  },
  analogy: {
    mode: 'analogy',
    label: 'Simple Real-World Analogy',
    badge: 'Easy to Picture',
    description: 'Explains difficult ideas using simple, fun everyday examples and analogies.',
    iconName: 'Sparkles',
    colorClass: 'text-purple-400',
    bgLightClass: 'bg-purple-500/10',
    borderClass: 'border-purple-500/30',
    prompts: [
      'Can you explain this like I am 10 years old with a fun example?',
      'Give me an everyday real-world analogy to remember this concept.',
      'How would you describe this topic to someone who has never heard of it?'
    ]
  },
  first_principles: {
    mode: 'first_principles',
    label: 'Step-by-Step Breakdown',
    badge: 'Easy Steps',
    description: 'Breaks down the concept into simple, bite-sized steps that anyone can follow.',
    iconName: 'Atom',
    colorClass: 'text-cyan-400',
    bgLightClass: 'bg-cyan-500/10',
    borderClass: 'border-cyan-500/30',
    prompts: [
      'Break this concept down into 3 simple, easy-to-follow steps.',
      'What are the core fundamentals I need to understand first?',
      'Walk me through how this works from start to finish.'
    ]
  },
  misconception_buster: {
    mode: 'misconception_buster',
    label: 'Common Mistakes & Tips',
    badge: 'Mistake Buster',
    description: 'Highlights common student mistakes and shows you the easy way to avoid them.',
    iconName: 'AlertOctagon',
    colorClass: 'text-rose-400',
    bgLightClass: 'bg-rose-500/10',
    borderClass: 'border-rose-500/30',
    prompts: [
      'What are the most common mistakes students make on this topic?',
      'What is a common trap or misconception I should avoid on tests?',
      'What is the easiest way to never get confused on this concept?'
    ]
  },
  exam_prep: {
    mode: 'exam_prep',
    label: 'Exam & Test Ready',
    badge: 'High Importance',
    description: 'Focuses on the most important definitions, formulas, and questions likely to appear on exams.',
    iconName: 'GraduationCap',
    colorClass: 'text-emerald-400',
    bgLightClass: 'bg-emerald-500/10',
    borderClass: 'border-emerald-500/30',
    prompts: [
      'What are the top 3 most important points I must remember for an exam?',
      'Give me a sample practice question based on my uploaded notes.',
      'What definitions or key terms from this chapter should I memorize?'
    ]
  },
  deep_dive: {
    mode: 'deep_dive',
    label: 'Deep Explanation',
    badge: 'In-Depth',
    description: 'Provides a clear, thorough explanation with all the details and applications.',
    iconName: 'Cpu',
    colorClass: 'text-indigo-400',
    bgLightClass: 'bg-indigo-500/10',
    borderClass: 'border-indigo-500/30',
    prompts: [
      'Explain this topic in full detail with clear bullet points.',
      'How does this concept work in practical real-world applications?',
      'What are the pros, cons, and special cases mentioned in my notes?'
    ]
  },
  quick_review: {
    mode: 'quick_review',
    label: 'Quick 30-Sec Summary',
    badge: 'Rapid Recap',
    description: 'Gives you a fast, bulleted summary of key takeaways in 30 seconds.',
    iconName: 'Zap',
    colorClass: 'text-yellow-400',
    bgLightClass: 'bg-yellow-500/10',
    borderClass: 'border-yellow-500/30',
    prompts: [
      'Summarize this entire topic in 3 quick bullet points.',
      'Give me a 30-second refresher before class starts.',
      'What are the 3 main takeaways from my uploaded reading?'
    ]
  }
};
