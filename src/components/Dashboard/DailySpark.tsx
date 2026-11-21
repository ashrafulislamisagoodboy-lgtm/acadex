import { useState } from 'react';
import { Check, Zap } from 'lucide-react';

const prompts = [
  ['Astronomy', 'Why do we see different phases of the Moon?', ['Earth casts a shadow every night', 'We see different parts of its sunlit half'], 1, 'The Sun lights half the Moon. As the Moon orbits Earth, our view of that half changes.'],
  ['Mathematics', 'A notebook costs 80 after a 20% discount. What was its original price?', ['96', '100'], 1, 'The sale price is 80% of the original: 80 ÷ 0.8 = 100.'],
  ['Physics', 'Which arrives first from a distant lightning strike?', ['The flash', 'The thunder'], 0, 'Light travels much faster than sound, so the flash reaches you before the thunder.'],
  ['Geography', 'Where would your shadow be shortest at solar noon on an equinox?', ['At the equator', 'At the Arctic Circle'], 0, 'On an equinox the midday Sun is overhead at the equator.'],
  ['Mathematics', 'Which fraction is larger?', ['5/8', '2/3'], 1, 'With a common denominator, 5/8 is 15/24 and 2/3 is 16/24.'],
  ['Earth science', 'Why does an ice cube float in water?', ['Ice is less dense than liquid water', 'Ice contains no gravity'], 0, 'Freezing forms an open crystal structure, so the same mass occupies more space.'],
  ['Language', 'Which sentence uses a metaphor?', ['The library was like a lantern', 'The library was a lantern'], 1, 'A metaphor calls one thing another. A comparison using “like” is a simile.'],
] as const;

export default function DailySpark({ day }: { day: number }) {
  const [subject, question, options, correct, explanation] = prompts[day];
  const [answer, setAnswer] = useState<number | null>(null);
  return <section className="studio-panel spark-card" id="daily-spark" aria-labelledby="spark-title" tabIndex={-1}>
    <div className="studio-label"><Zap size={16} /> Daily spark <span>{subject}</span></div>
    <h2 id="spark-title">{question}</h2>
    <div className="spark-options">{options.map((option,i) => <button key={option} disabled={answer !== null} onClick={() => setAnswer(i)} data-correct={answer !== null && correct === i}>
      <b aria-hidden="true">{i ? 'B' : 'A'}</b>{option}{answer !== null && correct === i && <Check size={16} aria-hidden="true"/>}</button>)}</div>
    <p className="spark-note" aria-live="polite">{answer === null ? 'A no-pressure warm-up. No XP at stake.' : `${answer === correct ? 'That’s right.' : 'Here’s the idea.'} ${explanation}`}</p>
  </section>;
}
