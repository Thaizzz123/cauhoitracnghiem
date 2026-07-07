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
  let lastFinalResult = null;   // kết quả lượt vừa xong, phục vụ nút "Làm lại các câu đã sai"
  let currentBank = [];         // câu hỏi hợp lệ vừa parse được, chờ cấu hình để bắt đầu
  let selectedCount = null;     // số câu được chọn ở màn hình cấu hình (null = tất cả)
  let selectedMode = 'shuffle'; // 'shuffle' | 'order'

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
    const result = engine.submitAnswer(selectedIdx);

    window.QuizUI.showAnswerFeedback(result.correct, selectedBtn, () => {
      if (result.correct) {
        if (result.sessionFinished) {
          finishSession();
        } else {
          renderCurrentQuestion();
        }
      } else {
        // Sai: xáo lại vị trí A/B/C/D của CHÍNH câu này rồi cho chọn lại,
        // để tránh việc chỉ nhớ vị trí thay vì nhớ nội dung đáp án đúng.
        const reshuffled = engine.reshuffleCurrentQuestion();
        window.QuizUI.renderOptionsList(reshuffled, handleSelectOption);
      }
    });
  }

  function finishSession() {
    lastFinalResult = engine.getFinalResult();
    window.QuizUI.renderResult(lastFinalResult);
    showScreen('screen-result');
  }

  function goToConfigScreen() {
    const { questions, errors } = window.QuizParser.parseQuizText(
      document.getElementById('input-textarea').value
    );

    window.QuizUI.renderErrors(errors);

    if (questions.length === 0) {
      // Không có câu nào hợp lệ -> không cho đi tiếp.
      return;
    }

    currentBank = questions;
    engine.setBank(questions);

    window.QuizUI.renderConfigTotal(currentBank.length);
    window.QuizUI.renderCountChips(currentBank.length, count => {
      selectedCount = count;
    });
    selectedMode = 'shuffle';

    showScreen('screen-config');
  }

  function beginQuizFromConfig() {
    engine.startSession(currentBank, { mode: selectedMode, count: selectedCount });
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

  document.getElementById('btn-go-config').addEventListener('click', goToConfigScreen);

  document.getElementById('btn-back-input').addEventListener('click', () => {
    showScreen('screen-input');
  });

  document.getElementById('btn-begin-quiz').addEventListener('click', beginQuizFromConfig);

  window.QuizUI.wireModeChips(mode => {
    selectedMode = mode;
  });

  document.getElementById('btn-retry-wrong').addEventListener('click', () => {
    if (!lastFinalResult || lastFinalResult.wrongOriginalQuestions.length === 0) return;
    // Luôn xáo cả thứ tự câu lẫn đáp án cho lượt luyện lại câu sai.
    engine.startSession(lastFinalResult.wrongOriginalQuestions, { mode: 'shuffle', count: null });
    showScreen('screen-quiz');
    renderCurrentQuestion();
  });

  document.getElementById('btn-retry-all').addEventListener('click', () => {
    window.QuizUI.renderConfigTotal(currentBank.length);
    window.QuizUI.renderCountChips(currentBank.length, count => {
      selectedCount = count;
    });
    showScreen('screen-config');
  });

  document.getElementById('btn-new-quiz').addEventListener('click', () => {
    document.getElementById('input-textarea').value = '';
    window.QuizUI.renderErrors([]);
    showScreen('screen-input');
  });

})();
