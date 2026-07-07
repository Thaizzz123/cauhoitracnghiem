/**
 * ui.js
 * ------------------------------------------------------------------
 * Các hàm thao tác DOM thuần túy: render câu hỏi, hiển thị phản hồi đúng/sai,
 * render lỗi parser, render kết quả cuối. Không chứa logic điều khiển luồng
 * (điều đó nằm ở app.js).
 * ------------------------------------------------------------------
 */

(function (global) {
  'use strict';

  const FEEDBACK_DELAY_MS = 800; // thời gian giữ hiệu ứng đúng/sai trước khi cho phép thao tác tiếp

  function renderErrors(errors) {
    const box = document.getElementById('input-errors');
    if (!errors || errors.length === 0) {
      box.hidden = true;
      box.innerHTML = '';
      return;
    }
    const items = errors.map(e => {
      const label = e.number ? `Câu ${e.number}` : 'Lỗi chung';
      const snippet = e.snippet ? ` — "${e.snippet}${e.snippet.length >= 100 ? '...' : ''}"` : '';
      return `<li><strong>${label}:</strong> ${e.reason}${snippet}</li>`;
    }).join('');
    box.innerHTML = `<strong>Phát hiện ${errors.length} lỗi trong đề:</strong><ul>${items}</ul>`;
    box.hidden = false;
  }

  function renderQuestion(question, progress, onSelectOption) {
    document.getElementById('quiz-progress-text').textContent =
      `Câu ${progress.current} / ${progress.total}`;
    document.getElementById('progress-bar-fill').style.width =
      `${Math.round(((progress.current - 1) / progress.total) * 100)}%`;

    document.getElementById('quiz-question-text').textContent = question.content;

    const feedbackEl = document.getElementById('quiz-feedback');
    feedbackEl.hidden = true;
    feedbackEl.className = 'feedback';

    const optionsContainer = document.getElementById('quiz-options');
    optionsContainer.innerHTML = '';

    question.options.forEach((text, idx) => {
      const btn = document.createElement('button');
      btn.className = 'option-btn';
      btn.type = 'button';
      btn.textContent = `${String.fromCharCode(65 + idx)}. ${text}`;
      btn.addEventListener('click', () => onSelectOption(idx, btn));
      optionsContainer.appendChild(btn);
    });
  }

  /**
   * Hiển thị hiệu ứng đúng/sai sau khi người dùng chọn 1 đáp án.
   * @param {number} selectedIdx - chỉ số đáp án vừa chọn
   * @param {number} correctIdx - chỉ số đáp án đúng
   * @param {boolean} correct - đáp án vừa chọn có đúng không
   * @param {HTMLElement} selectedBtn - phần tử button vừa được bấm
   * @param {Function} onDone - callback gọi lại sau khi hiệu ứng kết thúc
   */
  function showAnswerFeedback(selectedIdx, correctIdx, correct, selectedBtn, onDone) {
    const allButtons = Array.from(document.querySelectorAll('#quiz-options .option-btn'));
    allButtons.forEach(b => (b.disabled = true));

    selectedBtn.classList.add(correct ? 'selected-correct' : 'selected-wrong');

    const feedbackEl = document.getElementById('quiz-feedback');
    feedbackEl.hidden = false;
    feedbackEl.textContent = correct ? 'Chính xác!' : 'Sai rồi, hãy chọn lại.';
    feedbackEl.className = 'feedback ' + (correct ? 'correct' : 'wrong');

    setTimeout(() => {
      if (correct) {
        onDone();
      } else {
        // Sai: gỡ trạng thái để người dùng bắt buộc chọn lại câu này.
        allButtons.forEach(b => {
          b.disabled = false;
          b.classList.remove('selected-wrong', 'selected-correct');
        });
        feedbackEl.hidden = true;
        onDone();
      }
    }, FEEDBACK_DELAY_MS);
  }

  function renderResult(final) {
    document.getElementById('result-score').textContent = final.score;
    document.getElementById('result-detail').textContent =
      `Đúng ${final.correct} / ${final.total} câu`;

    const retryWrongBtn = document.getElementById('btn-retry-wrong');
    retryWrongBtn.hidden = final.wrongOriginalQuestions.length === 0;
  }

  const api = { renderErrors, renderQuestion, showAnswerFeedback, renderResult };
  global.QuizUI = api;
})(typeof window !== 'undefined' ? window : globalThis);
