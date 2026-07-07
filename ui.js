/**
 * ui.js
 * ------------------------------------------------------------------
 * Các hàm thao tác DOM thuần túy: render câu hỏi, hiển thị phản hồi đúng/sai,
 * render lỗi parser, render kết quả cuối, render chip chọn số câu/chế độ.
 * Không chứa logic điều khiển luồng (điều đó nằm ở app.js).
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

  /** Render danh sách chip chọn số câu hỏi, dựa trên tổng số câu hợp lệ. */
  function renderCountChips(total, onSelectCount) {
    const container = document.getElementById('count-row');
    container.innerHTML = '';

    const options = [];
    if (total > 10) options.push({ label: '10 câu', value: 10 });
    if (total > 20) options.push({ label: '20 câu', value: 20 });
    options.push({ label: `Tất cả (${total})`, value: total });

    options.forEach((opt, idx) => {
      const chip = document.createElement('div');
      chip.className = 'chip' + (idx === options.length - 1 ? ' active' : '');
      chip.textContent = opt.label;
      chip.dataset.count = opt.value;
      chip.addEventListener('click', () => {
        container.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        onSelectCount(opt.value);
      });
      container.appendChild(chip);
    });

    // Mặc định chọn "Tất cả"
    onSelectCount(total);
  }

  function wireModeChips(onSelectMode) {
    const container = document.getElementById('mode-row');
    container.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        container.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        onSelectMode(chip.dataset.mode);
      });
    });
  }

  function renderConfigTotal(total) {
    document.getElementById('config-total-text').textContent = `Tổng cộng: ${total} câu hợp lệ`;
  }

  /** Chỉ render lại danh sách nút đáp án (dùng khi vào câu mới HOẶC xáo lại sau câu sai). */
  function renderOptionsList(question, onSelectOption) {
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

    const feedbackEl = document.getElementById('quiz-feedback');
    feedbackEl.hidden = true;
    feedbackEl.className = 'feedback';
  }

  function renderQuestion(question, progress, onSelectOption) {
    document.getElementById('quiz-progress-text').textContent =
      `Câu ${progress.current} / ${progress.total}`;
    document.getElementById('quiz-score-live').textContent = `${progress.correctSoFar} đúng`;
    document.getElementById('progress-bar-fill').style.width =
      `${Math.round(((progress.current - 1) / progress.total) * 100)}%`;

    document.getElementById('quiz-question-text').textContent = question.content;

    renderOptionsList(question, onSelectOption);
  }

  /**
   * Hiển thị hiệu ứng đúng/sai sau khi người dùng chọn 1 đáp án.
   * Chỉ phụ trách hiệu ứng hiển thị; KHÔNG quyết định bước tiếp theo
   * (việc đó do app.js xử lý trong callback onDone).
   */
  function showAnswerFeedback(correct, selectedBtn, onDone) {
    const allButtons = Array.from(document.querySelectorAll('#quiz-options .option-btn'));
    allButtons.forEach(b => (b.disabled = true));

    selectedBtn.classList.add(correct ? 'selected-correct' : 'selected-wrong');

    const feedbackEl = document.getElementById('quiz-feedback');
    feedbackEl.hidden = false;
    feedbackEl.textContent = correct ? 'Chính xác!' : 'Sai rồi, hãy chọn lại.';
    feedbackEl.className = 'feedback ' + (correct ? 'correct' : 'wrong');

    setTimeout(onDone, FEEDBACK_DELAY_MS);
  }

  function renderResult(final) {
    document.getElementById('result-score').textContent = final.score;
    document.getElementById('result-detail').textContent =
      `Đúng ${final.correct} / ${final.total} câu`;

    const retryWrongBtn = document.getElementById('btn-retry-wrong');
    retryWrongBtn.hidden = final.wrongOriginalQuestions.length === 0;
  }

  const api = {
    renderErrors,
    renderCountChips,
    wireModeChips,
    renderConfigTotal,
    renderQuestion,
    renderOptionsList,
    showAnswerFeedback,
    renderResult
  };
  global.QuizUI = api;
})(typeof window !== 'undefined' ? window : globalThis);
