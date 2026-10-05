# 🎤 Knovara — 5-Minute Live Presentation & Demo Walkthrough Script

Use this exact script for your final project evaluation, viva, or video demonstration. It walks examiners through the entire closed-loop architecture seamlessly.

---

## ⏱️ Timeline & Step-by-Step Walkthrough

### **[00:00 - 00:45] Introduction & The Core Problem**
- **Action**: Open the Knovara Landing Page (`http://localhost:5173`).
- **Say**:
  > *"Good morning respected evaluators. Today, I am proud to present **Knovara**, an AI-powered personalized tutoring and adaptive learning platform.*
  > 
  > *Current EdTech platforms have two major flaws: first, AI tutors often hallucinate without verifiable citations; second, testing and tutoring exist in silos. When a student fails a quiz, the platform just shows a red 'X' and leaves them stranded.*
  > 
  > *Knovara solves this by closing the pedagogical loop: connecting multimodal source-grounded RAG, diagnostic assessment with Bloom's taxonomy and error classification, Bayesian Knowledge Tracing, spaced repetition, and deep-linked Socratic remediation."*

---

### **[00:45 - 01:30] Course Workspace & Multimodal Ingestion**
- **Action**: Log in with `sarah@knovara.edu` / `StrongPassword2026!`. Click into **Machine Learning** course workspace.
- **Say**:
  > *"Here we are in the student's isolated course workspace. Notice the **'Seed Demo Scenario'** button in the header—with one click, the system can instantiate a complete, realistic presentation journey.*
  > 
  > *In the **Materials** and **Grounded RAG** tabs, we have multimodal documents: a 42-page PDF textbook, 18 lecture slides, and an 18-minute video transcript. Every knowledge chunk carries physical coordinates—page numbers, slide numbers, and video timestamps down to the second."*

---

### **[01:30 - 02:30] Adaptive Assessments, Bloom Progression & Error Taxonomy**
- **Action**: Switch to the **Assessments** tab. Click on **"Comprehensive Benchmark & Bloom Diagnostic"** attempt review.
- **Say**:
  > *"In the Assessments tab, questions are not arbitrary multiple choice. They are rigorously mapped across all 6 tiers of **Bloom's Revised Taxonomy**: from Remembering definitions to Evaluating model architectures and Creating novel regularizations.*
  > 
  > *Looking at this diagnostic review: the student achieved 40/60 points. Notice how the engine doesn't just say 'Wrong'—it classifies the mistake against our **5-category cognitive error taxonomy**. On Question 5, the student inverted the effect of the SVM slack parameter $C$, and on Question 6, committed a factual misconception regarding unsupervised clustering.*
  > 
  > *Crucially, notice this button: **'🧠 Remediate with AI Tutor'**."*

---

### **[02:30 - 03:30] Deep-Linked Socratic AI Tutor & Closed Remediation Loop**
- **Action**: Click **"🧠 Remediate with AI Tutor"** on Question 5 (SVM slack parameter).
- **Say**:
  > *"Notice what just happened: with a single click, we transitioned into the **AI Tutor** studio.*
  > 
  > *The system automatically selected the **'Misconception Buster'** pedagogical mode and pre-populated the session with the failed question, the student's erroneous choice, and exact video citations.*
  > 
  > *Notice that the AI does **not** give away the answer. Instead, it asks: 'In your own words, what was your initial intuition when you tackled this question?' The student replies, and the tutor scaffolds the mathematical formulation of the slack penalty until the student arrives at the correct insight themselves. This is true closed-loop remediation."*

---

### **[03:30 - 04:15] Bayesian Knowledge Tracing & Spaced Repetition (SM-2)**
- **Action**: Switch to **Mastery Model (BKT)** tab, then to **Spaced Repetition** tab.
- **Say**:
  > *"In the **Mastery Model** tab, we implement **Bayesian Knowledge Tracing (BKT)** using a Hidden Markov Model. Rather than flat test scores, Knovara tracks the latent mastery probability $P(L)$ across each concept with sparkline iteration histories.*
  > 
  > *Weak concepts ($P(L) < 0.60$) like SVM and Clustering are automatically flagged with high remediation urgency and feed directly into our **Spaced Repetition Flashcard Studio**.*
  > 
  > *In the Flashcard studio, the SuperMemo-2 (SM-2) algorithm schedules active recall based on ease factors and repetition intervals. When flashcards are successfully reviewed, the positive recall signal bidirectionally updates the student's BKT probability."*

---

### **[04:15 - 05:00] Learning Analytics, Retention Forecasts & Portfolio Export**
- **Action**: Switch to **Learning Analytics (Phase 11)** tab. Scroll down through KPI cards, Bloom radar, error profiler, and Ebbinghaus retention curve. Click **"Export Report (.md)"**.
- **Say**:
  > *"Finally, the **Learning Analytics** studio aggregates multi-source telemetry in real time:*
  > - *Learner Velocity score and study streaks.*
  > - *Bloom's Taxonomy cognitive depth profile.*
  > - *Misconception frequency distribution.*
  > - *A 14-day **Ebbinghaus Memory Retention Decay Forecast** predicting retention drop-off and upcoming review queues.*
  > - *And with one click on **'Export Report'**, the student or instructor downloads a formatted Markdown portfolio for academic review.*
  > 
  > *Every phase—from multimodal ingestion to BKT modeling and deep-linked remediation—is fully implemented, tested with 100% pass rates, and verified. Thank you, and I look forward to your questions."*
