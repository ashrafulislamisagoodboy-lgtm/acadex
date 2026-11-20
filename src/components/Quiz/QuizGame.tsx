import React, { useState, useEffect, useRef } from 'react';
import { auth, db, collection, getDocs, getDoc, doc, startLocalQuiz, answerLocalQuiz } from '../../lib/local';
import { Trophy, Star, CheckCircle, XCircle, AlertCircle, Timer, Book, ChevronRight, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';

export default function QuizGame() {
  const [allQuestions, setAllQuestions] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [chapters, setChapters] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [consecutiveWrong, setConsecutiveWrong] = useState(0);
  const [xpGained, setXpGained] = useState(0);
  const [xpLost, setXpLost] = useState(0);
  const [userTotalXp, setUserTotalXp] = useState(0);
  const [totalQuestionsAttended, setTotalQuestionsAttended] = useState(0);
  const [showXpAnimation, setShowXpAnimation] = useState(false);
  const [animValue, setAnimValue] = useState(0);
  const [quizResults, setQuizResults] = useState<boolean[]>([]);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [quizId, setQuizId] = useState('');
  const answerLock = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    let active = true;
    Promise.all([getDocs(collection(db, 'questions')), getDoc(doc(db, 'users', auth.currentUser!.uid))])
      .then(([snapshot, user]) => {
        if (!active) return;
        const data = user.data();
        const admin = data?.role === 'admin';
        setIsAdmin(admin); setUserTotalXp(data?.xp || 0); setTotalQuestionsAttended(data?.totalQuestionsAttended || 0);
        const items = snapshot.docs.map((row: any) => ({ id: row.id, ...row.data() }));
        setAllQuestions(items);
        setSubjects(Array.from(new Set<string>(items.map((q: any) => (q.subject || 'Uncategorized').trim()))).filter(subject => admin || subject !== 'Uncategorized').sort());
      }).catch(error => { if (active) setNotification({ message: error.message, type: 'error' }); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; clearTimeout(timer.current); };
  }, []);
  useEffect(() => {
    setChapters(selectedSubject ? Array.from(new Set<string>(allQuestions.filter(q => (q.subject || 'Uncategorized').trim() === selectedSubject).map(q => (q.chapter || 'Default').trim()))).sort() : []);
  }, [selectedSubject, allQuestions]);

  const startQuiz = async (chapterOverride?: string) => {
    const chapter = chapterOverride || selectedChapter;
    if (!selectedSubject || !chapter) return;
    setLoading(true); setNotification(null); clearTimeout(timer.current);
    try {
      const quiz = await startLocalQuiz(selectedSubject, chapter);
      setQuizId(quiz.id); setQuestions(quiz.questions); setSelectedChapter(chapter);
      setCurrentIndex(0); setGameOver(false); setSelectedOption(null); setConsecutiveWrong(0);
      setXpGained(0); setXpLost(0); setQuizResults([]); setShowXpAnimation(false);
      answerLock.current = false; setPending(false);
    } catch (error) { setNotification({ message: (error as Error).message, type: 'error' }); }
    finally { setLoading(false); }
  };

  const handleAnswer = async (optionIndex: number) => {
    if (answerLock.current || selectedOption !== null || !quizId) return;
    answerLock.current = true; setPending(true); setNotification(null);
    try {
      const result = await answerLocalQuiz(quizId, currentIndex, optionIndex);
      setQuestions(previous => previous.map((question, index) => index === currentIndex ? { ...question, correctIndex: result.correctIndex } : question));
      setSelectedOption(optionIndex); setQuizResults(previous => [...previous, result.correct]);
      setUserTotalXp(result.xp); setTotalQuestionsAttended(result.totalQuestionsAttended);
      setXpGained(result.score); setXpLost(result.xpLost); setConsecutiveWrong(result.consecutiveWrong);
      if (result.milestone) { setAnimValue(result.milestonePoints); setShowXpAnimation(true); }
      setPending(false);
      timer.current = setTimeout(() => {
        if (result.completed) { setGameOver(true); }
        else { setCurrentIndex(index => index + 1); setSelectedOption(null); }
        answerLock.current = false;
      }, 1500);
    } catch (error) {
      answerLock.current = false; setPending(false);
      setNotification({ message: (error as Error).message, type: 'error' });
    }
  };
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-butter"></div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="p-6 space-y-8 max-w-4xl mx-auto">
        {notification && <p role="alert" className="text-red-400">{notification.message}</p>}
        <header className="chapter-heading"><span className="folio-kicker">Practice / Library</span>
          <h1>{selectedSubject || 'Practice library'}</h1>
          <p>{selectedSubject ? 'Select a chapter to start a round.' : 'Select a book, then a chapter.'}</p>
        </header>

        {subjects.length === 0 ? (
          <div className="p-12 text-center space-y-6 card bg-butter border-2 border-dashed border-forest/10">
            <div className="w-24 h-24 bg-forest/5 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="text-forest/20" size={48} />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-forest">No books on the shelf yet</h2>
              <p className="text-forest/60 max-w-xs mx-auto font-medium">{isAdmin ? 'Add questions under Admin → Books to open the first chapter.' : 'Your administrator hasn’t added questions yet.'}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {!selectedSubject ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {subjects.map((subject, idx) => (
                  <motion.button
                    key={idx}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    whileHover={{ y: -5, scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedSubject(subject)}
                    className="card p-8 flex flex-col items-center gap-6 hover:border-forest transition-all group bg-butter border-2 border-forest/10 shadow-xl shadow-black/10"
                  >
                    <div className="w-20 h-20 bg-forest/5 rounded-3xl flex items-center justify-center text-forest group-hover:bg-forest group-hover:text-butter transition-all shadow-inner">
                      <Book size={40} strokeWidth={2.5} />
                    </div>
                    <div className="text-center space-y-1">
                      <h3 className="text-xl font-black text-forest group-hover:text-forest transition-all uppercase tracking-tight">{subject}</h3>
                      <p className="text-[11px] font-black text-forest/40 uppercase tracking-widest">
                        {allQuestions.filter(q => (q.subject || 'Uncategorized') === subject).length} Questions Available
                      </p>
                    </div>
                  </motion.button>
                ))}
              </div>
            ) : !selectedChapter ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <button 
                    onClick={() => setSelectedSubject(null)}
                    className="text-butter font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-white/5 px-4 py-2 rounded-full transition-all"
                  >
                    ← Back to Books
                  </button>
                  <div className="h-px flex-1 bg-white/10 mx-4"></div>
                </div>
                
                <div className="grid gap-3">
                  {chapters.map((chapter, idx) => (
                    <motion.button
                      key={idx}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      whileHover={{ x: 10 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setSelectedChapter(chapter);
                        startQuiz(chapter);
                      }}
                      className="card p-6 flex items-center justify-between hover:border-forest transition-all group bg-butter border-2 border-forest/10 shadow-lg shadow-black/10"
                    >
                      <div className="flex items-center gap-5">
                        <div className="w-14 h-14 bg-forest/5 rounded-2xl flex items-center justify-center text-forest group-hover:bg-forest group-hover:text-butter transition-all shadow-inner">
                          <CheckCircle size={28} strokeWidth={2.5} />
                        </div>
                        <div className="text-left">
                          <h3 className="text-lg font-black text-forest group-hover:text-forest transition-all tracking-tight">{chapter}</h3>
                          <p className="text-[11px] font-black text-forest/40 uppercase tracking-widest">
                            {allQuestions.filter(q => (q.subject || 'Uncategorized') === selectedSubject && (q.chapter || 'Default') === chapter).length} Challenges
                          </p>
                        </div>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-forest/5 flex items-center justify-center text-forest/20 group-hover:bg-forest/10 group-hover:text-forest transition-all">
                        <ChevronRight size={20} strokeWidth={3} />
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const renderHeader = () => (
    <header className="practice-rule">
      <span>{selectedSubject} / {selectedChapter}</span>
      <span>{gameOver ? 'Round finished' : `Question ${currentIndex + 1} of ${questions.length}`}</span>
      <span>{userTotalXp} XP · Checkpoint {totalQuestionsAttended % 15}/15</span>
    </header>
  );

  const renderAnimation = () => showXpAnimation && (
    <motion.aside role="status" className="quiz-stamp" initial={{opacity: 0}} animate={{opacity: [0, 1, 1, 0]}}
      transition={{duration: 2.6, times: [0, .1, .9, 1]}} onAnimationComplete={() => setShowXpAnimation(false)}>
      <Trophy size={18}/> Practice checkpoint · {animValue} of 15 correct
    </motion.aside>
  );

  if (gameOver) {
    return (
      <div className="mx-auto max-w-4xl p-6 space-y-8 pb-24 relative min-h-full">
        {renderHeader()}
        {renderAnimation()}
        <div className="flex flex-col items-center justify-center text-center space-y-6 pt-4">
          <div className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center text-butter">
            <Trophy size={48} />
          </div>
          <h2 className="text-3xl font-black text-butter">Round complete</h2>
          <div className="card w-full p-6 space-y-4 bg-butter border-forest/10">
            <div className="flex justify-between items-center">
              <span className="text-forest/40 font-bold uppercase text-xs tracking-widest">XP Gained</span>
              <span className="text-2xl font-black text-green-600">+{xpGained}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-forest/40 font-bold uppercase text-xs tracking-widest">XP Lost</span>
              <span className="text-2xl font-black text-red-600">-{xpLost}</span>
            </div>
            <div className="pt-4 border-t border-forest/10 flex justify-between items-center">
              <span className="text-forest font-black uppercase text-sm tracking-widest">Net Result</span>
              <span className="text-3xl font-black text-forest">{xpGained - xpLost} XP</span>
            </div>
          </div>

          {/* Question Summary */}
          <div className="w-full space-y-3">
            <p className="text-xs font-black uppercase text-butter/40 tracking-widest text-left">Quiz Summary</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {quizResults.map((res, i) => (
                <div 
                  key={i} 
                  className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs shadow-sm",
                    res ? "bg-green-500 text-white" : "bg-red-500 text-white"
                  )}
                >
                  {i + 1}
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 w-full">
            {notification && <p role="alert" className="text-red-400">{notification.message}</p>}
            <button 
              onClick={() => startQuiz()} 
              className="btn-primary w-full bg-butter text-forest hover:bg-butter/90"
            >
              Play Again
              <ChevronRight size={20} />
            </button>
            <button 
              onClick={() => window.location.reload()} 
              className="text-butter/40 font-bold text-sm hover:text-butter transition-colors"
            >
              Back to Menu
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-6 space-y-8 pb-24 relative">
      {renderHeader()}
      {renderAnimation()}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className={cn(
              "fixed top-4 left-1/2 z-50 px-6 py-3 rounded-2xl shadow-xl font-bold flex items-center gap-2 min-w-[280px]",
              notification.type === 'success' ? "bg-green-500 text-white" : "bg-red-500 text-white"
            )}
          >
            {notification.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
            {notification.message}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-6">
        <div key={`${quizId}-${currentIndex}`} className="question-sheet">
          <span className="folio-kicker">Exercise {String(currentIndex + 1).padStart(2, '0')}</span>
          <h2>{currentQuestion.question}</h2>
        </div>
        <div className="space-y-3">
          {currentQuestion.options.map((option: string, idx: number) => {
            const isSelected = selectedOption === idx;
            const isCorrectOption = idx === currentQuestion.correctIndex;
            
            let statusClass = "bg-butter border-forest/10 hover:border-forest text-forest";
            if (selectedOption !== null) {
              if (isCorrectOption) statusClass = "bg-green-100 border-green-600 text-green-950";
              else if (isSelected) statusClass = "bg-red-100 border-red-600 text-red-950";
              else statusClass = "bg-butter border-forest/10 opacity-50 text-forest/40";
            }

            return (
              <motion.button
                key={idx}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleAnswer(idx)}
                disabled={pending || selectedOption !== null}
                data-mark={selectedOption === null ? undefined : isCorrectOption ? 'correct' : isSelected ? 'incorrect' : undefined}
                className={`answer-line ${statusClass}`}
              >
                <span className="answer-letter" aria-hidden="true">{'ABCD'[idx]}</span><span>{option}</span>
                {selectedOption !== null && isCorrectOption && <CheckCircle size={20} className="text-green-500" />}
                {selectedOption !== null && isSelected && !isCorrectOption && <XCircle size={20} className="text-red-500" />}
              </motion.button>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {consecutiveWrong > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="bg-red-500/10 p-4 rounded-2xl border border-red-500/20 flex items-center gap-3"
          >
            <AlertCircle className="text-red-500" size={20} />
            <p className="text-xs font-bold text-red-400">
              Warning: {consecutiveWrong}/10 consecutive wrong answers. 
              <span className="block font-medium opacity-70">Ten in a row costs up to 2 XP.</span>
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
