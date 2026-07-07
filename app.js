/**
 * app.js
 * ------------------------------------------------------------------
 * Điều phối chính của ứng dụng: quản lý chuyển màn hình và kết nối
 * parser.js -> quiz-engine.js -> ui.js. Không chứa logic parse/shuffle/
 * chấm điểm (đã tách riêng ở các module tương ứng).
 * ------------------------------------------------------------------
 */

(function () {
  'use strict';

  const engine = window.QuizEngine.createEngine();
  let lastFinalResult = null; // lưu kết quả lượt vừa xong để phục vụ nút "Làm lại các câu đã sai"

  function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
  }

  function renderCurrentQuestion() {
    const question = engine.getCurrentQuestion();
    const progress = engine.getProgress();

    if (!question) {
      finishSession();
      return;
    }

    window.QuizUI.renderQuestion(question, progress, handleSelectOption);
  }

  function handleSelectOption(selectedIdx, selectedBtn) {
    const question = engine.getCurrentQuestion();
    const result = engine.submitAnswer(selectedIdx);

    window.QuizUI.showAnswerFeedback(
      selectedIdx,
      question.correctIndex,
      result.correct,
      selectedBtn,
      () => {
        if (result.correct) {
          if (result.sessionFinished) {
            finishSession();
          } else {
            renderCurrentQuestion();
          }
        }
        // Nếu sai: không làm gì thêm, người dùng thấy lại đúng câu hỏi hiện tại để chọn lại.
      }
    );
  }

  function finishSession() {
    lastFinalResult = engine.getFinalResult();
    window.QuizUI.renderResult(lastFinalResult);
    showScreen('screen-result');
  }

  function startQuizFromText(rawText) {
    const { questions, errors } = window.QuizParser.parseQuizText(rawText);

    window.QuizUI.renderErrors(errors);

    if (questions.length === 0) {
      // Không có câu nào hợp lệ -> không cho bắt đầu.
      return;
    }

    engine.setBank(questions);
    engine.startSession(questions);
    showScreen('screen-quiz');
    renderCurrentQuestion();
  }

  // ---------------- Wiring sự kiện ----------------

  document.getElementById('btn-go-input').addEventListener('click', () => {
    showScreen('screen-input');
  });

  document.getElementById('btn-back-home').addEventListener('click', () => {
    showScreen('screen-home');
  });

  document.getElementById('btn-start-quiz').addEventListener('click', () => {
    const rawText = document.getElementById('input-textarea').value;
    startQuizFromText(rawText);
  });

  document.getElementById('btn-retry-wrong').addEventListener('click', () => {
    if (!lastFinalResult || lastFinalResult.wrongOriginalQuestions.length === 0) return;
    engine.startSession(lastFinalResult.wrongOriginalQuestions);
    showScreen('screen-quiz');
    renderCurrentQuestion();
  });

  document.getElementById('btn-retry-all').addEventListener('click', () => {
    engine.startSession(engine.getBank());
    showScreen('screen-quiz');
    renderCurrentQuestion();
  });

  document.getElementById('btn-new-quiz').addEventListener('click', () => {
    document.getElementById('input-textarea').value = '';
    window.QuizUI.renderErrors([]);
    showScreen('screen-input');
  });

})();
